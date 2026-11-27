/**
 * Ring buffer console + exception (D10), isolated world.
 * Log của TRANG: console-main.ts (main world — console của trang chỉ patch
 * được từ đó, verified E2E) đẩy qua dataset + plain Event 'bea-log'
 * (CustomEvent.detail bị Chrome strip qua world boundary).
 * wrap() phía dưới bắt log của chính extension trong trang.
 */
export interface LogEntry {
  ts: number;
  level: 'log' | 'info' | 'warn' | 'error';
  text: string;
}

const MAX_ENTRIES = 500;
const buffer: LogEntry[] = [];
let installed = false;

function pushEntry(level: LogEntry['level'], args: unknown[]): void {
  const text = args
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
  buffer.push({ ts: Date.now(), level, text });
  if (buffer.length > MAX_ENTRIES) buffer.shift();
}

export function startCapture(): void {
  if (installed) return;
  installed = true;

  const wrap = (level: LogEntry['level']) => {
    const original = console[level].bind(console);
    console[level] = (...args: unknown[]) => {
      pushEntry(level, args);
      original(...args);
    };
  };
  wrap('log');
  wrap('info');
  wrap('warn');
  wrap('error');

  // log của TRANG đến từ console-main.ts (main world) qua dataset + plain Event
  document.addEventListener('bea-log', () => {
    const raw = document.documentElement.dataset.beaLog;
    if (!raw) return;
    try {
      const d = JSON.parse(raw) as LogEntry;
      if (d?.ts && d?.level) {
        buffer.push(d);
        if (buffer.length > MAX_ENTRIES) buffer.shift();
      }
    } catch {
      // frame lỗi -> bỏ qua
    }
  }, true);

  window.addEventListener('error', (ev) => {
    pushEntry('error', [`${ev.message} (${ev.filename}:${ev.lineno})`]);
  });
  window.addEventListener('unhandledrejection', (ev) => {
    pushEntry('error', [`unhandledrejection: ${String(ev.reason)}`]);
  });
}

export function stopCapture(): void {
  // đã wrap thì giữ nguyên — reload trang mới khởi lại; chỉ ngừng ghi
  installed = false;
}

export function getLogs(filter: {
  level?: string;
  since?: number;
}): LogEntry[] {
  return buffer.filter(
    (e) =>
      (!filter.level || e.level === filter.level) &&
      (!filter.since || e.ts > filter.since),
  );
}
