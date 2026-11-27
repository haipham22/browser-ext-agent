import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import { ExtAgentError } from '@haipham22/browser-ext-agent-shared';
import type { WsServer } from '../ws-server.js';

type SendCommand = (
  action: Parameters<ReturnType<typeof import('../bridge.js').makeSendCommand>>[0],
  params?: Record<string, unknown>,
) => Promise<{ result?: unknown }>;

export interface ToolCtx {
  ws: WsServer;
  send: SendCommand;
}

type TextContent = { type: 'text'; text: string };

/** Sau navigate/click/type tự kèm snapshot (D11) — agent có vòng lặp nhìn->hành động. */
async function withSnapshot(
  ctx: ToolCtx,
  params: Record<string, unknown>,
  result: unknown,
): Promise<{ content: TextContent[] }> {
  let snap: { result?: unknown } | null = null;
  try {
    snap = await ctx.send('snapshot', params);
  } catch {
    // snapshot fail (vd ref stale, trang đang navigation) -> vẫn trả kết quả chính
  }
  const lines: string[] = [];
  lines.push(typeof result === 'string' ? result : JSON.stringify(result));
  const text = snap?.result as { outline?: string } | undefined;
  if (text?.outline) lines.push('\n--- snapshot ---\n' + text.outline);
  return { content: [{ type: 'text', text: lines.join('\n') }] };
}

export function registerTools(server: McpServer, ctx: ToolCtx): void {
  server.tool(
    'browser_navigate',
    'Open a URL in the user browser (new tab if no tabId). Returns title+url, then a DOM snapshot outline.',
    { url: z.string().url(), tabId: z.number().int().optional() },
    async ({ url, tabId }) => {
      const r = await ctx.send('navigate', { url, tabId });
      return withSnapshot(ctx, { tabId }, r.result);
    },
  );

  server.tool(
    'browser_snapshot',
    'Get a text outline of the page: interactive elements + meaningful text, each with a ref like [ref=e12]. Use refs for click/type.',
    { tabId: z.number().int().optional() },
    async ({ tabId }) => {
      const r = await ctx.send('snapshot', { tabId });
      const outline = (r.result as { outline?: string })?.outline ?? '(empty page)';
      return { content: [{ type: 'text', text: outline }] };
    },
  );

  server.tool(
    'browser_click',
    'Click an element by ref from the last snapshot. Returns action result + fresh snapshot.',
    { ref: z.string(), tabId: z.number().int().optional() },
    async ({ ref, tabId }) => {
      const r = await ctx.send('click', { ref, tabId });
      return withSnapshot(ctx, { tabId }, r.result);
    },
  );

  server.tool(
    'browser_type',
    'Type text into an input/textarea by ref. submit=true presses Enter. Returns result + fresh snapshot.',
    {
      ref: z.string(),
      text: z.string(),
      submit: z.boolean().optional(),
      tabId: z.number().int().optional(),
    },
    async ({ ref, text, submit, tabId }) => {
      const r = await ctx.send('type', { ref, text, submit, tabId });
      return withSnapshot(ctx, { tabId }, r.result);
    },
  );

  server.tool(
    'browser_scroll',
    'Scroll the page up/down. Returns new scroll position.',
    {
      direction: z.enum(['up', 'down']),
      amount: z.number().int().optional(),
      tabId: z.number().int().optional(),
    },
    async ({ direction, amount, tabId }) => {
      const r = await ctx.send('scroll', { direction, amount, tabId });
      return { content: [{ type: 'text', text: JSON.stringify(r.result) }] };
    },
  );

  server.tool(
    'browser_screenshot',
    'Screenshot the current tab (PNG, sensitive fields are masked). Returns an image.',
    { tabId: z.number().int().optional() },
    async ({ tabId }) => {
      const r = await ctx.send('screenshot', { tabId });
      const res = r.result as { dataUrl?: string };
      const base64 = res?.dataUrl?.split(',')[1];
      if (!base64) {
        return { content: [{ type: 'text', text: 'ERROR: no screenshot data' }] };
      }
      return {
        content: [{ type: 'image' as const, data: base64, mimeType: 'image/png' }],
      };
    },
  );

  server.tool(
    'browser_wait_for',
    'Wait until text appears or a CSS selector matches (after navigation/loading).',
    {
      text: z.string().optional(),
      selector: z.string().optional(),
      timeoutMs: z.number().int().optional(),
      tabId: z.number().int().optional(),
    },
    async ({ text, selector, timeoutMs, tabId }) => {
      const r = await ctx.send('wait_for', { text, selector, timeoutMs, tabId });
      return { content: [{ type: 'text', text: JSON.stringify(r.result) }] };
    },
  );

  server.tool(
    'browser_tab_list',
    'List open browser tabs (id, title, url, active).',
    {},
    async () => {
      const r = await ctx.send('tab_list', {});
      return { content: [{ type: 'text', text: JSON.stringify(r.result, null, 2) }] };
    },
  );

  server.tool(
    'browser_tab_new',
    'Open a new browser tab, optionally with a URL.',
    { url: z.string().url().optional() },
    async ({ url }) => {
      const r = await ctx.send('tab_new', { url });
      return { content: [{ type: 'text', text: JSON.stringify(r.result) }] };
    },
  );

  server.tool(
    'browser_tab_select',
    'Focus a browser tab by id.',
    { tabId: z.number().int() },
    async ({ tabId }) => {
      const r = await ctx.send('tab_select', { tabId });
      return { content: [{ type: 'text', text: JSON.stringify(r.result) }] };
    },
  );

  server.tool(
    'browser_tab_close',
    'Close a browser tab (defaults to the active tab).',
    { tabId: z.number().int().optional() },
    async ({ tabId }) => {
      const r = await ctx.send('tab_close', { tabId });
      return { content: [{ type: 'text', text: JSON.stringify(r.result) }] };
    },
  );

  server.tool(
    'browser_console_logs',
    'Read captured console logs (log/info/warn/error, uncaught exceptions) from a tab — for debugging.',
    {
      tabId: z.number().int().optional(),
      level: z.enum(['log', 'info', 'warn', 'error']).optional(),
      since: z.number().optional(),
    },
    async ({ tabId, level, since }) => {
      const r = await ctx.send('console_logs', { tabId, level, since });
      return { content: [{ type: 'text', text: JSON.stringify(r.result, null, 2) }] };
    },
  );
}
