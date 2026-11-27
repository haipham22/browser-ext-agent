/**
 * Optional Playwright bridge (D21): connectOverCDP to the user's real Chrome
 * (`--remote-debugging-port=9222`) so tools can run JS in a real tab — things
 * the WS protocol doesn't cover (eval, DOM probes).
 *
 * playwright-core is loaded lazily via dynamic import: the standalone bin
 * bundle (npx-from-git) must boot without it — the CDP fallback is opt-in.
 */

import { ExtAgentError } from '@haipham22/browser-ext-agent-shared';

type PWBrowser = import('playwright-core').Browser;
let browser: PWBrowser | null = null;
let connecting: Promise<PWBrowser> | null = null;

async function getBrowser(cdpUrl: string): Promise<PWBrowser> {
  if (browser) return browser;
  if (!connecting) {
    connecting = import('playwright-core')
      .then((pw) => pw.chromium.connectOverCDP(cdpUrl))
      .then((b) => {
        browser = b;
        connecting = null;
        return b;
      })
      .catch((e: unknown) => {
        connecting = null;
        const missing = e instanceof Error && 'code' in e && (e as { code?: string }).code === 'ERR_MODULE_NOT_FOUND';
        throw missing
          ? new ExtAgentError(
              'CDP_NOT_AVAILABLE',
              'playwright-core is not installed — required only for the CDP fallback: npm i playwright-core',
            )
          : e;
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
