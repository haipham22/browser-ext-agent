import { readFileSync } from 'node:fs';
import { WebSocket } from 'ws';

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import { loadConfig } from './config.js';
import { WsServer } from './ws-server.js';
import { makeSendCommand } from './bridge.js';
import { registerTools, type SendCommand } from './mcp/tools.js';
import { loadSecretConfig } from './secret-config.js';
import { cdpClose } from './cdp.js';

function pkgVersion(): string {
  try {
    // bundle ra 1 file nằm cạnh package.json -> 'ihpack' trở lên 1 cấp
    const url = new URL('../package.json', import.meta.url);
    return JSON.parse(readFileSync(url, 'utf8')).version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}

const cfg = loadConfig();
const secretConfig = loadSecretConfig(process.env.SECRET_CONFIG_PATH);

// Multi-session (D23): nhiều Claude session spawn server cùng lúc — chỉ MỘT
// process giữ port và nối với extension (owner); các process còn lại chạy
// proxy mode, forward lệnh qua WS tới owner. Owner chết → một proxy tự lên
// làm owner, extension tự reconnect lại trong backoff.
type SendFn = (action: string, params?: Record<string, unknown>) => Promise<{ result?: unknown }>;
const transport: { send: SendFn; ws: WsServer | null } = {
  send: (async () => ({}) as { result?: unknown }) as unknown as SendFn,
  ws: null,
};

function onExtensionChange(connected: boolean): void {
  console.error(`[browser-ext-agent] extension ${connected ? 'connected' : 'disconnected'}`);
}

function becomeOwner(): void {
  transport.ws = new WsServer(cfg.port, cfg.host, cfg.extToken, 30_000, onExtensionChange);
  transport.ws.setSecretConfig(secretConfig);
  transport.send = makeSendCommand(transport.ws) as unknown as SendFn;
}

function becomeProxy(): void {
  transport.ws = null;
  const peer = new WebSocket(`ws://localhost:${cfg.port}?role=peer`);
  const pending = new Map<string, { resolve: (r: { result?: unknown }) => void; reject: (e: Error) => void; timer: NodeJS.Timeout }>();
  let seq = 0;
  peer.on('message', (data: unknown) => {
    let r: { id?: string; result?: unknown; ok?: boolean; error?: { code: string; message: string } };
    try {
      r = JSON.parse(String(data));
    } catch {
      return;
    }
    const entry = r.id ? pending.get(r.id) : undefined;
    if (!entry) return;
    clearTimeout(entry.timer);
    pending.delete(r.id!);
    if (r.ok) entry.resolve({ result: r.result });
    else entry.reject(new Error(`${r.error?.code ?? 'COMMAND_TIMEOUT'}: ${r.error?.message ?? 'peer error'}`));
  });
  peer.on('open', () => {
    transport.send = (action, params = {}) => {
      const id = `peer-${++seq}-${Date.now()}`;
      return new Promise<{ result?: unknown }>((resolve, reject) => {
        const timer = setTimeout(() => {
          pending.delete(id);
          reject(new Error('COMMAND_TIMEOUT: peer request timed out'));
        }, 30_000);
        pending.set(id, { resolve, reject, timer });
        peer.send(JSON.stringify({ id, action, params }));
      });
    };
    console.error(`[browser-ext-agent] proxy mode → forwarding to ws://localhost:${cfg.port}`);
  });
  peer.on('close', () => {
    // owner biến mất — thử lên làm owner (extension sẽ reconnect về 8765)
    setTimeout(() => {
      peer.removeAllListeners();
      becomeOwner();
      void wsServerReady();
    }, 2_000);
  });
  peer.on('error', () => {});
}

async function wsServerReady(): Promise<void> {
  const ws = transport.ws;
  if (!ws) return;
  try {
    await ws.waitForListening();
    console.error(`[browser-ext-agent] owner mode | WS ws://${cfg.host}:${cfg.port}`);
  } catch {
    transport.ws?.close();
    transport.ws = null;
    becomeProxy();
  }
}

const mcp = new McpServer(
  { name: 'browser-ext-agent', version: pkgVersion() },
  { capabilities: { tools: {} } },
);
registerTools(mcp, { send: (a, p) => transport.send(a, p), cdpUrl: cfg.cdpUrl });

// graceful shutdown (CONVENTIONS §6): ngừng nhận mới, đóng resource cuối cùng
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
function shutdown(): void {
  transport.ws?.close();
  void cdpClose();
  process.exit(0);
}

async function main(): Promise<void> {
  becomeOwner();
  const ready = wsServerReady().then(() =>
    mcp.connect(new StdioServerTransport()),
  ).then(() => {
    console.error(
      `[browser-ext-agent] MCP ready (stdio) | WS ws://${cfg.host}:${cfg.port}` +
        (cfg.extToken ? ' | token: required' : ' | token: none'),
    );
  });
  await ready;
}

main().catch((e) => {
  console.error('[browser-ext-agent] fatal:', e);
  process.exit(1);
});
