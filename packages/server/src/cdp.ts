import { chromium } from 'playwright-core';

/**
 * Optional Playwright bridge (D21): connectOverCDP to the user's real Chrome
 * (`--remote-debugging-port=9222`) so tools can run JS in a real tab — things
 * the WS protocol doesn't cover (eval, DOM probes).
 */

import { ExtAgentError } from '@haipham22/browser-ext-agent-shared';

let browser: import('playwright-core').Browser | null = null;
let connecting: Promise<import('playwright-core').Browser> | null = null;

async function getBrowser(cdpUrl: string): Promise<import('playwright-core').Browser> {
  if (browser) return browser;
  if (!connecting) {
    connecting = chromium.connectOverCDP(cdpUrl).then((b) => {
      browser = b;
      connecting = null;
      return b;
    }).catch((e) => {
      connecting = null;
      throw e;
    });
  }
  return connecting;
}

export interface CdpEvalResult {
  value: string;
}

/** Eval a JS expression in the tab whose URL contains `urlPart`. */
export async function cdpEval(
  cdpUrl: string,
  urlPart: string,
  expression: string,
): Promise<CdpEvalResult> {
  let b: import('playwright-core').Browser;
  try {
    b = await getBrowser(cdpUrl);
  } catch {
    throw new ExtAgentError(
      'CDP_NOT_AVAILABLE',
      `cannot connect to Chrome DevTools at ${cdpUrl} — start Chrome with --remote-debugging-port=9222`,
    );
  }
  const contexts = b.contexts();
  for (const ctx of contexts) {
    for (const page of ctx.pages()) {
      if (page.url().includes(urlPart)) {
        const raw = await page.evaluate(expression);
        return { value: typeof raw === 'string' ? raw : JSON.stringify(raw) };
      }
    }
  }
  throw new ExtAgentError('TAB_NOT_FOUND', `no open tab matches url part: ${urlPart}`);
}

export async function cdpClose(): Promise<void> {
  if (browser) {
    await browser.close().catch(() => {});
    browser = null;
    connecting = null;
  }
}
