import type { SecretConfig } from '@haipham22/browser-ext-agent-shared';

/**
 * Secret protection (D8): mọi text/value rời trang phải đi qua đây.
 * Chạy trong content script — tầng cuối trước khi data rời browser.
 */

const SENSITIVE_INPUT_TYPES = new Set(['password', 'email', 'tel']);
const SENSITIVE_AUTOCOMPLETE = /^cc-|^one-time-code$/;

export function isSensitiveInput(el: HTMLInputElement): boolean {
  const t = (el.getAttribute('type') ?? 'text').toLowerCase();
  if (t === 'password') return true;
  const ac = el.getAttribute('autocomplete') ?? '';
  if (SENSITIVE_AUTOCOMPLETE.test(ac)) return true;
  return false;
}

/** Input không bao giờ lộ value (kể cả không sensitive) — chỉ metadata + ••• . */
export function maskInputValue(v: string): string {
  return v ? '•••' : '';
}

export function redactText(text: string, patterns: RegExp[]): string {
  let out = text;
  for (const re of patterns) out = out.replace(re, '[REDACTED]');
  return out;
}

export function compilePatterns(cfg: SecretConfig | null): RegExp[] {
  const userPatterns = cfg?.sensitivePatterns ?? [];
  return userPatterns.map((p) => {
    try {
      return new RegExp(p, 'g');
    } catch {
      return null;
    }
  }).filter((r): r is RegExp => r !== null);
}

/** CSS selector do user cấu hình -> thêm vào bộ mask khi snapshot/screenshot. */
export function matchesBlockedSelector(
  el: Element,
  selectors: string[] | undefined,
): boolean {
  if (!selectors?.length) return false;
  try {
    return selectors.some((s) => {
      try {
        return el.matches(s);
      } catch {
        return false;
      }
    });
  } catch {
    return false;
  }
}
