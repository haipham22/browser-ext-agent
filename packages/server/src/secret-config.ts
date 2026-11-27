import { readFileSync } from 'node:fs';

import {
  secretConfigSchema,
  type SecretConfig,
} from '@haipham22/browser-ext-agent-shared';

export const DEFAULT_SECRET_CONFIG: SecretConfig = {
  blockedDomains: [],
  blockedSelectors: [],
  sensitivePatterns: [
    // token phổ biến: OpenAI/Anthropic-style sk-, Bearer, AWS, Google API, JWT
    'sk-[A-Za-z0-9_-]{20,}',
    'Bearer\\s+[A-Za-z0-9._-]{15,}',
    'AKIA[0-9A-Z]{16}',
    'AIza[A-Za-z0-9_-]{35}',
    'eyJ[A-Za-z0-9_-]{10,}\\.[A-Za-z0-9_-]{10,}\\.[A-Za-z0-9_-]{10,}',
  ],
};

/** Nạp secret-config.json nếu có; không có -> dùng default (không die). */
export function loadSecretConfig(path?: string): SecretConfig {
  if (!path) return DEFAULT_SECRET_CONFIG;
  try {
    const raw = JSON.parse(readFileSync(path, 'utf8'));
    const user = secretConfigSchema.parse(raw);
    return {
      blockedDomains: [...DEFAULT_SECRET_CONFIG.blockedDomains, ...user.blockedDomains],
      blockedSelectors: [...DEFAULT_SECRET_CONFIG.blockedSelectors, ...user.blockedSelectors],
      sensitivePatterns: [...DEFAULT_SECRET_CONFIG.sensitivePatterns, ...user.sensitivePatterns],
    };
  } catch (e) {
    // config lỗi -> chạy với default, báo rõ để không im lặng
    console.error('[browser-ext-agent] secret-config load failed, using defaults:', e instanceof Error ? e.message : e);
    return DEFAULT_SECRET_CONFIG;
  }
}
