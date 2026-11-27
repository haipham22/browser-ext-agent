import {
  isSensitiveInput,
  maskInputValue,
  redactText,
  matchesBlockedSelector,
} from './redact.js';
import { getRef, registerRef } from './refs.js';

const INTERACTIVE_TAGS = new Set([
  'a',
  'button',
  'input',
  'select',
  'textarea',
  'summary',
]);
const TEXT_TAGS = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6']);
const SKIP_TAGS = new Set(['script', 'style', 'noscript', 'svg', 'template', 'iframe']);
// Container trung gian được in ra để agent thấy CÂY (nhóm nào chứa nút nào)
const STRUCTURAL_TAGS = new Set([
  'nav',
  'header',
  'footer',
  'main',
  'aside',
  'form',
  'table',
  'ul',
  'ol',
  'details',
  'section',
]);
const MAX_TEXT = 80;
const MAX_DEPTH = 15;
/** Số entry tối đa mỗi trang snapshot — agent lật bằng offset (pagination). */
export const SNAPSHOT_PAGE_SIZE = 200;

export interface SnapshotLine {
  depth: number;
  line: string;
}

function isVisible(el: Element): boolean {
  const s = getComputedStyle(el);
  if (s.display === 'none') return false;
  if (s.visibility !== 'visible') return false;
  const r = el.getBoundingClientRect();
  return r.width > 0 || r.height > 0;
}

function accessibleName(el: Element): string {
  const oneLine = (s: string): string => s.replace(/\s+/g, ' ').trim();
  const aria = el.getAttribute('aria-label');
  if (aria) return oneLine(aria);
  const labelledby = el.getAttribute('aria-labelledby');
  if (labelledby) {
    const ref = document.getElementById(labelledby);
    if (ref?.textContent) return oneLine(ref.textContent).slice(0, MAX_TEXT);
  }
  if (el instanceof HTMLInputElement) {
    const id = el.id;
    if (id) {
      const label = document.querySelector(`label[for="${CSS.escape(id)}"]`);
      if (label?.textContent) return oneLine(label.textContent).slice(0, MAX_TEXT);
    }
    return oneLine(el.placeholder ?? '');
  }
  return oneLine(el.textContent ?? '').slice(0, MAX_TEXT);
}

/** Gọn mọi whitespace thô (HTML minified) về 1 dòng — 1 entry = 1 dòng thật. */
function oneLine(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

/** Role theo ARIA — agent đọc `textbox`/`link` hiểu ngay, không đoán tag. */
function ariaRole(el: Element): string {
  const explicit = el.getAttribute('role');
  if (explicit) return explicit;
  const tag = el.tagName.toLowerCase();
  if (el instanceof HTMLInputElement) {
    const t = (el.getAttribute('type') ?? 'text').toLowerCase();
    if (t === 'checkbox') return 'checkbox';
    if (t === 'radio') return 'radio';
    if (t === 'button' || t === 'submit') return 'button';
    return 'textbox';
  }
  if (el instanceof HTMLTextAreaElement) return 'textbox';
  if (el instanceof HTMLSelectElement) return 'combobox';
  if (tag === 'a') return 'link';
  return tag;
}

export function buildSnapshot(
  config: {
    sensitivePatterns: RegExp[];
    blockedSelectors: string[];
  },
  offset = 0,
  limit = SNAPSHOT_PAGE_SIZE,
): {
  outline: string;
  total: number;
  nextOffset: number | null;
} {
  const lines: string[] = [];

  const walk = (el: Element, depth: number, suppressText = false): void => {
    if (depth > MAX_DEPTH) return;
    if (SKIP_TAGS.has(el.tagName.toLowerCase())) return;
    if (!isVisible(el)) return;

    const tag = el.tagName.toLowerCase();
    const isInteractive =
      INTERACTIVE_TAGS.has(tag) ||
      el.hasAttribute('role') ||
      el.hasAttribute('onclick') ||
      el.getAttribute('contenteditable') === 'true';

    const text = redactText(el.hasAttribute('aria-label')
      ? el.getAttribute('aria-label')!
      : (el.childNodes.length && el.children.length === 0
        ? (el.textContent ?? '')
        : ''), config.sensitivePatterns);

    // element đã in tên -> con cháu chỉ text là trùng, bỏ qua (trừ interactive/structural)
    if (suppressText && !isInteractive && !STRUCTURAL_TAGS.has(tag) &&
        !TEXT_TAGS.has(tag) && tag !== 'p' && tag !== 'li' && tag !== 'span') {
      return;
    }

    if (isInteractive) {
      const ref = registerRef(el);
      const role = ariaRole(el);
      let line = `- [ref=${ref}] ${role}`;
      const name = accessibleName(el);
      if (name) line += ` "${redactText(name, config.sensitivePatterns).slice(0, MAX_TEXT)}"`;
      let masked = false;
      if (el instanceof HTMLInputElement) {
        const sensitive = isSensitiveInput(el) ||
          matchesBlockedSelector(el, config.blockedSelectors);
        if (sensitive) {
          masked = true;
          line = `- [ref=${ref}] [masked sensitive field] (${tag})`;
        } else {
          if (el.value) line += ` value=${maskInputValue(el.value)}`;
          if (el.required) line += ' (required)';
        }
      }
      if (el instanceof HTMLTextAreaElement && el.value) {
        line += ` value=${maskInputValue(el.value)}`;
      }
      lines.push('  '.repeat(depth) + line);
      for (const child of el.children) walk(child, depth + 1, !masked && !!name);
      return;
    } else if (STRUCTURAL_TAGS.has(tag)) {
      // dòng nhóm: agent nhìn thấy phân cấp, form/table còn có ref để type/đọc.
      // Tên structural CHỈ lấy aria-label — textContent của nav/ul là toàn bộ
      // nội dung nhóm, in ra là nhiễu.
      const shallow = oneLine(el.getAttribute('aria-label') ?? '');
      if (tag === 'form' || tag === 'table' || tag === 'details') {
        const ref = registerRef(el);
        lines.push(
          '  '.repeat(depth) + `- [ref=${ref}] ${tag}${shallow ? ` "${shallow.slice(0, MAX_TEXT)}"` : ''}`,
        );
      } else {
        lines.push('  '.repeat(depth) + `- ${tag}${shallow ? ` "${shallow.slice(0, MAX_TEXT)}"` : ''}`);
      }
    } else if (TEXT_TAGS.has(tag) && text) {
      lines.push(`  ${'  '.repeat(depth)}- ${tag} "${oneLine(text.slice(0, MAX_TEXT))}"`);
    } else if (tag === 'p' || tag === 'li' || tag === 'span') {
      // cha (interactive) đã in tên -> text con chắc chắn trùng
      if (suppressText) return;
      const ownText = text || (el.children.length === 0 ? (el.textContent ?? '') : '');
      const t = redactText(oneLine(ownText), config.sensitivePatterns);
      // a textless span/p/li must still walk its children — containers like HN's
      // span.titleline wrap the whole subtree (early return dropped all titles)
      if (t) lines.push(`  ${'  '.repeat(depth)}- "${t.slice(0, MAX_TEXT)}"`);
    }

    for (const child of el.children) walk(child, depth + 1, suppressText);
  };

  walk(document.body, 0);
  // pagination theo offset: walk đủ DOM rồi mới cắt — refs ổn định,
  // agent lấy trang kế tiếp bằng offset (không phụ thuộc scroll position)
  const total = lines.length;
  const page = lines.slice(offset, offset + limit);
  const nextOffset = offset + limit < total ? offset + limit : null;
  return { outline: page.join('\n'), total, nextOffset };
}
