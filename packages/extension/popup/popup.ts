import { STORAGE_KEYS } from '../src/shared/types.js';

const el = (id: string): HTMLElement => document.getElementById(id) as HTMLElement;

function render(enabled: boolean, connected: boolean): void {
  (el('enabled') as HTMLInputElement).checked = enabled;
  const dot = document.querySelector('.dot');
  const status = el('status');
  if (enabled && connected) {
    dot?.classList.remove('off');
    dot?.classList.add('on');
    status.innerHTML = '<span class="dot on"></span>connected — agent may drive this browser';
  } else {
    dot?.classList.remove('on');
    dot?.classList.add('off');
    status.innerHTML = '<span class="dot off"></span>' +
      (enabled ? 'enabled — waiting for server' : 'disabled — browser is yours');
  }
}

async function init(): Promise<void> {
  const local = await chrome.storage.local.get([STORAGE_KEYS.SERVER_URL, STORAGE_KEYS.EXT_TOKEN]);
  (el('server-url') as HTMLInputElement).value = local[STORAGE_KEYS.SERVER_URL] ?? 'ws://localhost:8765';
  (el('ext-token') as HTMLInputElement).value = local[STORAGE_KEYS.EXT_TOKEN] ?? '';

  const sess = await chrome.storage.session.get([STORAGE_KEYS.ENABLED, STORAGE_KEYS.CONNECTED]);
  render(sess[STORAGE_KEYS.ENABLED] === true, sess[STORAGE_KEYS.CONNECTED] === true);

  chrome.storage.session.onChanged.addListener(() => {
    void chrome.storage.session
      .get([STORAGE_KEYS.ENABLED, STORAGE_KEYS.CONNECTED])
      .then((o) =>
        render(o[STORAGE_KEYS.ENABLED] === true, o[STORAGE_KEYS.CONNECTED] === true),
      );
  });

  (el('enabled') as HTMLInputElement).addEventListener('change', (ev) => {
    const checked = (ev.target as HTMLInputElement).checked;
    void chrome.storage.session.set({ [STORAGE_KEYS.ENABLED]: checked });
  });

  const save = async () => {
    await chrome.storage.local.set({
      [STORAGE_KEYS.SERVER_URL]:
        (el('server-url') as HTMLInputElement).value.trim() || 'ws://localhost:8765',
      [STORAGE_KEYS.EXT_TOKEN]: (el('ext-token') as HTMLInputElement).value,
    });
  };
  (el('server-url') as HTMLInputElement).addEventListener('change', save);
  (el('ext-token') as HTMLInputElement).addEventListener('change', save);

  // 2 nút = 2 gesture tường minh; checkbox là hiển thị trạng thái
  el('toggle-on').addEventListener('click', async () => {
    await save();
    await chrome.storage.session.set({ [STORAGE_KEYS.ENABLED]: true });
    await chrome.runtime.sendMessage({ type: 'popup_enabled_changed' });
    render(true, false);
  });
  el('toggle-off').addEventListener('click', async () => {
    await chrome.storage.session.set({ [STORAGE_KEYS.ENABLED]: false });
    await chrome.runtime.sendMessage({ type: 'popup_enabled_changed' });
    render(false, false);
  });
}

void init();
