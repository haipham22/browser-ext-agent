import { getRef } from './refs.js';
import {
  isSensitiveInput,
  matchesBlockedSelector,
} from './redact.js';

const MASK_CLASS = 'bea-blur-secret';
const MASK_STYLE = 'filter:blur(10px);';

function collectSensitiveElements(blockedSelectors: string[]): Element[] {
  const out: Element[] = [];
  for (const el of Array.from(document.querySelectorAll('input, textarea'))) {
    if (
      el instanceof HTMLInputElement &&
      isSensitiveInput(el)
    ) {
      out.push(el);
      continue;
    }
    if (matchesBlockedSelector(el, blockedSelectors)) out.push(el);
  }
  return out;
}

/** D8: che sensitive trước khi captureVisibleTab, xong thì bỏ che. */
export function prepareScreenshot(blockedSelectors: string[]): number {
  for (const el of collectSensitiveElements(blockedSelectors)) {
    el.classList.add(MASK_CLASS);
  }
  const style = document.createElement('style');
  style.id = 'bea-mask-style';
  style.textContent = `.${MASK_CLASS} { ${MASK_STYLE} }`;
  document.head.appendChild(style);
  return document.querySelectorAll(`.${MASK_CLASS}`).length;
}

export function finishScreenshot(): void {
  document.getElementById('bea-mask-style')?.remove();
  document.querySelectorAll(`.${MASK_CLASS}`).forEach((el) => {
    el.classList.remove(MASK_CLASS);
  });
}

// ---- click / type / scroll / wait_for ----

export function clickByRef(ref: string): unknown {
  const el = getRef(ref);
  if (!el) throw new Error('ELEMENT_NOT_FOUND: stale or unknown ref');
  el.scrollIntoView({ block: 'center' });
  if (el instanceof HTMLElement) {
    el.focus();
    el.click();
    return { clicked: ref, tag: el.tagName.toLowerCase() };
  }
  el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  return { clicked: ref };
}

export function typeByRef(
  ref: string,
  text: string,
  submit?: boolean,
): unknown {
  const el = getRef(ref);
  if (!el) throw new Error('ELEMENT_NOT_FOUND: stale or unknown ref');
  const input = el as HTMLInputElement | HTMLTextAreaElement;
  if (!(el instanceof HTMLInputElement) && !(el instanceof HTMLTextAreaElement)) {
    throw new Error('ELEMENT_NOT_FOUND: ref is not an editable field');
  }
  input.focus();
  // native setter -> React/Vue cũng nhận được sự kiện input
  const proto = el instanceof HTMLTextAreaElement
    ? HTMLTextAreaElement.prototype
    : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
  setter?.call(input, text);
  input.dispatchEvent(new Event('input', { bubbles: true }));

  if (submit) {
    const form = input.form;
    if (form) {
      form.requestSubmit();
      return { typed: ref, submitted: true };
    }
    input.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
    );
    return { typed: ref, enterSent: true };
  }
  return { typed: ref };
}

export function scrollPage(direction: 'up' | 'down', amount?: number): unknown {
  const px = amount ?? 600;
  const before = window.scrollY;
  window.scrollBy(0, direction === 'down' ? px : -px);
  return { scrollY: window.scrollY, before };
}

export function waitFor(
  text?: string,
  selector?: string,
  timeoutMs = 10_000,
): Promise<unknown> {
  const check = (): boolean => {
    if (selector && document.querySelector(selector)) return true;
    if (text && document.body?.innerText.includes(text)) return true;
    return false;
  };
  return new Promise((resolve, reject) => {
    if (check()) {
      resolve({ found: true });
      return;
    }
    const start = Date.now();
    const timer = setInterval(() => {
      if (check()) {
        clearInterval(timer);
        resolve({ found: true });
      } else if (Date.now() - start > timeoutMs) {
        clearInterval(timer);
        reject(new Error('COMMAND_TIMEOUT: wait_for condition not met'));
      }
    }, 300);
  });
}
