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
  'label',
  'summary',
]);
const TEXT_TAGS = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6']);
const SKIP_TAGS = new Set(['script', 'style', 'noscript', 'svg', 'template', 'iframe']);
const MAX_TEXT = 80;
const MAX_DEPTH = 15;
const MAX_LINES = 200;

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
  const aria = el.getAttribute('aria-label');
  if (aria) return aria.trim();
  const labelledby = el.getAttribute('aria-labelledby');
  if (labelledby) {
    const ref = document.getElementById(labelledby);
    if (ref?.textContent) return ref.textContent.trim();
  }
  if (el instanceof HTMLInputElement) {
    const id = el.id;
    if (id) {
      const label = document.querySelector(`label[for="${CSS.escape(id)}"]`);
      if (label?.textContent) return label.textContent.trim();
    }
    return (el.placeholder ?? '').trim();
  }
  return (el.textContent ?? '').trim().slice(0, MAX_TEXT);
}

export function buildSnapshot(config: {
  sensitivePatterns: RegExp[];
  blockedSelectors: string[];
}): { outline: string; truncated: boolean } {
  const lines: string[] = [];
  let truncated = false;

  const walk = (el: Element, depth: number): void => {
    if (truncated || depth > MAX_DEPTH) return;
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

    if (isInteractive) {
      const ref = registerRef(el);
      const role = el.getAttribute('role') ?? tag;
      let line = `- [ref=${ref}] ${role}`;
      const name = accessibleName(el);
      if (name) line += ` "${redactText(name, config.sensitivePatterns).slice(0, MAX_TEXT)}"`;
      if (el instanceof HTMLInputElement) {
        const sensitive = isSensitiveInput(el) ||
          matchesBlockedSelector(el, config.blockedSelectors);
        if (sensitive) {
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
    } else if (TEXT_TAGS.has(tag) && text) {
      lines.push(`  ${'  '.repeat(depth)}- ${tag} "${text.slice(0, MAX_TEXT)}"`);
    } else if (tag === 'p' || tag === 'li' || tag === 'span') {
      const ownText = text || (el.children.length === 0 ? (el.textContent ?? '') : '');
      const t = redactText(ownText.trim(), config.sensitivePatterns);
      if (!t) return;
      lines.push(`  ${'  '.repeat(depth)}- "${t.slice(0, MAX_TEXT)}"`);
    }

    for (const child of el.children) walk(child, depth + 1);
  };

  walk(document.body, 0);
  if (lines.length >= MAX_LINES) {
    lines.length = MAX_LINES;
    truncated = true;
    lines.push('(snapshot truncated — scroll and snapshot again for more)');
  }
  return { outline: lines.join('\n'), truncated };
}
