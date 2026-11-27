import type { SecretConfig } from '@haipham22/browser-ext-agent-shared';

/** Keys trong chrome.storage — 1 chỗ duy nhất, không rải string magic. */
export const STORAGE_KEYS = {
  ENABLED: 'enabled',
  CONNECTED: 'connected',
  SERVER_URL: 'serverUrl',
  EXT_TOKEN: 'extToken',
  SECRET_CONFIG: 'secretConfig',
} as const;

/** SW -> content: chạy 1 action trong trang. */
export interface PageCommand {
  type: 'command';
  action: string;
  params: Record<string, unknown>;
}

export type CommandResult =
  | { ok: true; result: unknown }
  | { ok: false; error: { code: string; message: string } };

export interface SecretConfigMessage {
  type: 'config_updated';
  config: SecretConfig;
}
