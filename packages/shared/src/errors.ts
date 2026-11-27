/**
 * Error codes tập trung — mọi tầng dùng đúng bảng này (CONVENTIONS §5).
 * Client (extension / agent) map code -> message, không tự chế code mới.
 */
export const ERROR_CODES = {
  EXTENSION_NOT_ENABLED:
    'extension is turned off — click the extension icon and press Enable',
  EXTENSION_NOT_CONNECTED:
    'extension is not connected to the server — check server URL in extension popup',
  NOT_ACTIVATED: 'extension is enabled but has no active browser session',
  COMMAND_TIMEOUT: 'command timed out on the browser side',
  TAB_NOT_FOUND: 'target tab no longer exists',
  REF_STALE: 'element ref is stale after navigation — take a new snapshot',
  ELEMENT_NOT_FOUND: 'element not found for the given ref',
  DOMAIN_BLOCKED:
    'domain is blocked by secret config — remove it from blockedDomains to proceed',
  INVALID_URL: 'url must be http(s)',
  INVALID_PARAMS: 'invalid command params',
  SECRET_MASKED: 'field value is masked — reading is not allowed',
  CDP_NOT_AVAILABLE:
    'Playwright bridge cannot reach Chrome DevTools — start Chrome with --remote-debugging-port=9222 or set CDP_URL',
} as const;

export type ErrorCode = keyof typeof ERROR_CODES;

export class ExtAgentError extends Error {
  constructor(
    public readonly code: ErrorCode,
    detail?: string,
  ) {
    super(detail ? `${ERROR_CODES[code]} (${detail})` : ERROR_CODES[code]);
    this.name = 'ExtAgentError';
  }
}
