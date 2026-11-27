/**
 * Capture console + exception ở MAIN world — console của trang chỉ patch được
 * từ main world (isolated world có console object riêng, đã verify thực nghiệm).
 * Channel sang isolated world: dataset trên DOM (shared giữa 2 worlds) +
 * plain Event — CustomEvent.detail bị Chrome strip qua world boundary.
 */
type Level = 'log' | 'info' | 'warn' | 'error';

const emit = (level: Level, text: string): void => {
  // sync per-dispatch: ghi dataset rồi dispatch — không bị ghi đè giữa chừng
  document.documentElement.dataset.beaLog = JSON.stringify({
    ts: Date.now(),
    level,
    text,
  });
  document.dispatchEvent(new Event('bea-log'));
};

const fmt = (args: unknown[]): string =>
  args
    .map((a) => {
      if (a instanceof Error) return `${a.name}: ${a.message}`;
      if (typeof a === 'string') return a;
      try {
        return JSON.stringify(a);
      } catch {
        return String(a);
      }
    })
    .join(' ')
    .slice(0, 500);

const wrap = (level: Level): void => {
  const original = console[level].bind(console);
  console[level] = (...args: unknown[]) => {
    emit(level, fmt(args));
    original(...args);
  };
};
wrap('log');
wrap('info');
wrap('warn');
wrap('error');

window.addEventListener('error', (ev) => {
  emit('error', `${ev.message} (${ev.filename}:${ev.lineno})`);
});
window.addEventListener('unhandledrejection', (ev) => {
  emit('error', `unhandledrejection: ${String(ev.reason)}`);
});
