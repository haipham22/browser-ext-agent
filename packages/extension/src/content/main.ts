import { secretConfigSchema, type SecretConfig } from '@haipham22/browser-ext-agent-shared';
import { STORAGE_KEYS, type PageCommand, type CommandResult } from '../shared/types.js';
import { buildSnapshot } from './snapshot.js';
import {
  clickByRef,
  typeByRef,
  scrollPage,
  waitFor,
  prepareScreenshot,
  finishScreenshot,
} from './actions.js';
import {
  startCapture,
  stopCapture,
  getLogs,
} from './console-capture.js';
import { compilePatterns } from './redact.js';

/** Content script: nhận command từ SW, chạy trong trang, trả CommandResult. */

function getConfig(): SecretConfig {
  const cached = (window as { __beaConfig?: unknown }).__beaConfig;
  return secretConfigSchema.parse(cached ?? {});
}

function setConfig(cfg: SecretConfig): void {
  (window as { __beaConfig?: unknown }).__beaConfig = cfg;
}

async function readSessionConfig(): Promise<SecretConfig> {
  const o = await chrome.storage.session.get(STORAGE_KEYS.SECRET_CONFIG);
  const cfg = secretConfigSchema.safeParse(o[STORAGE_KEYS.SECRET_CONFIG]);
  return cfg.success ? cfg.data : { blockedDomains: [], blockedSelectors: [], sensitivePatterns: [] };
}

function handleAction(action: string, p: Record<string, unknown>): unknown {
  const config = getConfig();
  const patterns = compilePatterns(config);
  const blocked = config.blockedSelectors;
  switch (action) {
    case 'snapshot':
      return buildSnapshot({ sensitivePatterns: patterns, blockedSelectors: blocked });
    case 'click':
      return clickByRef(String(p.ref));
    case 'type':
      return typeByRef(String(p.ref), String(p.text), p.submit as boolean | undefined);
    case 'scroll':
      return scrollPage(p.direction as 'up' | 'down', p.amount as number | undefined);
    case 'wait_for':
      return waitFor(
        p.text as string | undefined,
        p.selector as string | undefined,
        (p.timeoutMs as number | undefined) ?? 10_000,
      );
    case 'console_logs':
      return { entries: getLogs({ level: p.level as string | undefined, since: p.since as number | undefined }) };
    case 'prepare_screenshot':
      return { masked: prepareScreenshot(blocked) };
    case 'finish_screenshot':
      finishScreenshot();
      return { done: true };
    default:
      throw new Error(`UNKNOWN_ACTION: ${action}`);
  }
}

chrome.runtime.onMessage.addListener(
  (msg: PageCommand, _sender, sendResponse) => {
    if (msg?.type !== 'command') return false;
    void (async () => {
      let reply: CommandResult;
      try {
        const result = handleAction(msg.action, msg.params ?? {});
        const r = result instanceof Promise ? await result : result;
        reply = { ok: true, result: r };
      } catch (e) {
        const raw = e instanceof Error ? e.message : String(e);
        const code = raw.split(':')[0] ?? 'COMMAND_TIMEOUT';
        reply = { ok: false, error: { code, message: raw } };
      }
      sendResponse(reply);
    })();
    return true; // giữ kênh message mở cho sendResponse async
  },
);

// config từ SW (apply_config qua storage.session) -> cache vào window
chrome.storage.session.get(STORAGE_KEYS.SECRET_CONFIG).then((o) => {
  const cfg = secretConfigSchema.safeParse(o[STORAGE_KEYS.SECRET_CONFIG]);
  if (cfg.success) setConfig(cfg.data);
});
chrome.storage.session.onChanged.addListener((changes) => {
  const c = changes[STORAGE_KEYS.SECRET_CONFIG];
  if (c?.newValue) {
    const cfg = secretConfigSchema.safeParse(c.newValue);
    if (cfg.success) setConfig(cfg.data);
  }
  const en = changes[STORAGE_KEYS.ENABLED];
  if (en) {
    if (en.newValue === true) startCapture();
    else stopCapture();
  }
});

// nếu extension đã bật trước khi trang load -> bắt đầu capture ngay
void readSessionConfig().then((cfg) => {
  setConfig(cfg);
  void chrome.storage.session.get(STORAGE_KEYS.ENABLED).then((o) => {
    if (o[STORAGE_KEYS.ENABLED] === true) startCapture();
  });
});
