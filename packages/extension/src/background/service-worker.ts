import {
  secretConfigSchema,
  type Command,
  type SecretConfig,
} from '@haipham22/browser-ext-agent-shared';
import {
  STORAGE_KEYS,
  type PageCommand,
  type CommandResult,
} from '../shared/types.js';

/**
 * Service worker: WS client (dial-out, D3) + router command.
 * Chỉ nối WS khi user bật trong popup (D9).
 */

// content script đọc được storage.session sau setAccessLevel
chrome.storage.session.setAccessLevel({
  accessLevel: 'TRUSTED_AND_UNTRUSTED_CONTEXTS',
});

let ws: WebSocket | null = null;
let reconnectDelay = 1000;
let secretConfig: SecretConfig | null = null;
let backoffTimer: ReturnType<typeof setTimeout> | null = null;

async function getEnabled(): Promise<boolean> {
  const o = await chrome.storage.session.get(STORAGE_KEYS.ENABLED);
  return o[STORAGE_KEYS.ENABLED] === true;
}

function setBadge(on: boolean): void {
  chrome.action.setBadgeText({ text: on ? 'ON' : '' });
}

async function connect(): Promise<void> {
  if (await getEnabled() === false) return;
  if (ws && (ws.readyState === 0 || ws.readyState === 1)) return;

  const { [STORAGE_KEYS.SERVER_URL]: serverUrl } =
    await chrome.storage.local.get(STORAGE_KEYS.SERVER_URL);
  const { [STORAGE_KEYS.EXT_TOKEN]: extToken } =
    await chrome.storage.local.get(STORAGE_KEYS.EXT_TOKEN);
  const url = serverUrl || 'ws://localhost:8765';

  try {
    ws = new WebSocket(`${url}?token=${encodeURIComponent(extToken ?? '')}`);
  } catch {
    scheduleReconnect();
    return;
  }

  ws.onopen = () => {
    reconnectDelay = 1000;
    setBadge(true);
    chrome.storage.session.set({ [STORAGE_KEYS.CONNECTED]: true });
    console.info('[bea] connected', url);
  };
  ws.onclose = () => {
    ws = null;
    setBadge(false);
    chrome.storage.session.set({ [STORAGE_KEYS.CONNECTED]: false });
    scheduleReconnect();
  };
  ws.onmessage = (ev) => void handleServerMessage(String(ev.data));
  ws.onerror = () => {
    /* onclose sẽ chạy sau error */
  };
}

function scheduleReconnect(): void {
  if (backoffTimer) return;
  backoffTimer = setTimeout(() => {
    backoffTimer = null;
    void connect();
  }, reconnectDelay);
  reconnectDelay = Math.min(reconnectDelay * 2, 30_000);
}

async function handleServerMessage(raw: string): Promise<void> {
  let cmd: Command;
  try {
    cmd = JSON.parse(raw) as Command;
  } catch {
    return;
  }
  if (cmd.action === 'apply_config') {
    const parsed = secretConfigSchema.safeParse(cmd.params?.config);
    if (parsed.success) {
      secretConfig = parsed.data;
      await chrome.storage.session.set({
        [STORAGE_KEYS.SECRET_CONFIG]: parsed.data,
      });
    }
    return;
  }
  let response: { id: string; ok: boolean; result?: unknown; error?: { code: string; message: string } };
  try {
    const result = await routeCommand(cmd);
    response = { id: cmd.id, ok: true, result };
  } catch (e) {
    const err = e instanceof PageError ? e : null;
    response = {
      id: cmd.id,
      ok: false,
      error: {
        code: err?.code ?? 'COMMAND_TIMEOUT',
        message: e instanceof Error ? e.message : String(e),
      },
    };
  }
  if (ws && ws.readyState === 1) {
    ws.send(JSON.stringify(response));
  }
}

class PageError extends Error {
  constructor(public code: string, public detail: string) {
    super(`${code}: ${detail}`);
  }
}

/** Route 1 command tới chrome.* hoặc content script. Trả result (không bọc ok). */
async function routeCommand(cmd: { action: string; params: Record<string, unknown> }): Promise<unknown> {
  const p = cmd.params;
  switch (cmd.action) {
    case 'navigate': {
      const url = String(p.url);
      if (isBlockedDomain(url)) {
        throw new PageError('DOMAIN_BLOCKED', url);
      }
      return navigate(url, p.tabId as number | undefined);
    }
    case 'tab_list':
      return (await chrome.tabs.query({})).map((t) => ({
        id: t.id,
        title: t.title,
        url: t.url,
        active: t.active,
      }));
    case 'tab_new':
      return chrome.tabs.create({ url: p.url as string | undefined, active: true });
    case 'tab_select': {
      const id = p.tabId as number;
      await chrome.tabs.update(id, { active: true });
      return { selected: id };
    }
    case 'tab_close': {
      const id = (p.tabId as number | undefined) ?? (await getActiveTabId());
      await chrome.tabs.remove(id);
      return { closed: id };
    }
    case 'screenshot':
      return screenshot(p.tabId as number | undefined);
    default: {
      // các action cấp-trang còn lại -> content script của tab đích
      // sendToPage trả CommandResult — unwrap trước khi bọc vào WS response
      const tabId = await getPageTabId(p);
      const r = (await sendToPage(tabId, {
        type: 'command',
        action: cmd.action,
        params: p,
      })) as CommandResult;
      if (!r.ok) throw new PageError(r.error.code, r.error.message);
      // click/type may start a navigation -> wait for it so the attached
      // snapshot never reads the old page (D17)
      if (cmd.action === 'click' || cmd.action === 'type') await waitNavSettle(tabId);
      return r.result;
    }
  }
}

async function getPageTabId(p: Record<string, unknown>): Promise<number> {
  return (p.tabId as number | undefined) ?? (await getActiveTabId());
}

async function getActiveTabId(): Promise<number> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new PageError('NOT_ACTIVATED', 'no active tab');
  return tab.id;
}

function isBlockedDomain(url: string): boolean {
  if (!secretConfig?.blockedDomains.length) return false;
  try {
    const host = new URL(url).hostname;
    return secretConfig.blockedDomains.some(
      (d) => host === d || host.endsWith(`.${d}`),
    );
  } catch {
    return true; // URL hỏng -> chặn mặc định
  }
}

/** Navigate: đợi load xong (tabs.onUpdated, timeout 15s), trả title+url. */
async function navigate(url: string, tabId?: number): Promise<unknown> {
  let tab: chrome.tabs.Tab;
  if (tabId) {
    tab = await chrome.tabs.update(tabId, { url });
  } else {
    tab = await chrome.tabs.create({ url, active: true });
  }
  if (!tab.id) throw new PageError('TAB_NOT_FOUND', 'no tab id after create');
  await waitTabComplete(tab.id, 15_000);
  const done = await chrome.tabs.get(tab.id);
  return { tabId: done.id, title: done.title, url: done.url };
}

function waitTabComplete(id: number, timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      resolve(); // đợi lâu quá -> vẫn trả, agent tự snapshot xem tình hình
    }, timeoutMs);
    const listener = (
      tabId: number,
      info: chrome.tabs.TabChangeInfo,
    ) => {
      if (tabId === id && info.status === 'complete') {
        clearTimeout(timer);
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    };
    chrome.tabs.onUpdated.addListener(listener);
  });
}

/**
 * Click/type may start a navigation -> wait for it to finish loading before
 * returning, so the auto-attached snapshot never reads the OLD page (D17).
 * No navigation within the 2s grace (plain SPA click) -> return immediately.
 */
async function waitNavSettle(tabId: number): Promise<void> {
  const before = (await chrome.tabs.get(tabId)).url;
  const deadline = Date.now() + 12_000;
  let navStarted = false;
  while (Date.now() < deadline) {
    const tab = await chrome.tabs.get(tabId);
    if (tab.status === 'loading' || (tab.url && tab.url !== before)) {
      navStarted = true;
      break;
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  if (!navStarted) return;
  while (Date.now() < deadline) {
    const tab = await chrome.tabs.get(tabId);
    if (tab.status === 'complete') {
      // brief pause for content-script re-injection + first paint
      await new Promise((r) => setTimeout(r, 300));
      return;
    }
    await new Promise((r) => setTimeout(r, 100));
  }
}

/**
 * Screenshot: content script masks sensitive fields BEFORE the capture (D8),
 * then captureVisibleTab, then unmask.
 * captureVisibleTab always captures the VISIBLE tab of the window — a tabId
 * that is not the active tab of its window would capture the WRONG tab (D18):
 * fail with an error instead of returning a wrong image.
 */
async function screenshot(tabId?: number): Promise<unknown> {
  const id = tabId ?? (await getActiveTabId());
  const tab = await chrome.tabs.get(id);
  if (tabId != null && !tab.active) {
    throw new PageError(
      'TAB_NOT_VISIBLE',
      `tab ${id} is not the active tab of its window — select it first (tab_select)`,
    );
  }
  await sendToPage(id, { type: 'command', action: 'prepare_screenshot', params: {} });
  try {
    const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
      format: 'png',
    });
    return { dataUrl };
  } finally {
    await sendToPage(id, { type: 'command', action: 'finish_screenshot', params: {} });
  }
}

/** Gửi message tới content script; script chưa có -> inject rồi thử lại 1 lần. */
async function sendToPage(tabId: number, msg: PageCommand): Promise<unknown> {
  try {
    return await chrome.tabs.sendMessage(tabId, msg);
  } catch {
    await chrome.scripting.executeScript({
      files: ['content.js'],
      target: { tabId },
    });
    return chrome.tabs.sendMessage(tabId, msg);
  }
}

// ---- popup events ----
chrome.runtime.onMessage.addListener((msg: { type?: string }, _sender, sendResponse) => {
  if (msg?.type === 'popup_enabled_changed') {
    void syncConnection();
  }
  sendResponse({ received: true });
  return false;
});

async function syncConnection(): Promise<void> {
  if (await getEnabled()) {
    reconnectDelay = 1000;
    void connect();
  } else {
    if (backoffTimer) {
      clearTimeout(backoffTimer);
      backoffTimer = null;
    }
    if (ws) {
      ws.onclose = null;
      ws.close();
      ws = null;
    }
    setBadge(false);
    chrome.storage.session.set({ [STORAGE_KEYS.CONNECTED]: false });
  }
}

// worker wake-up: nếu user vẫn bật -> nối lại ngay
void syncConnection();
