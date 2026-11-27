import { describe, it, expect } from 'vitest';
import {
  maskInputValue,
  redactText,
  compilePatterns,
} from '../src/content/redact.js';

describe('redact', () => {
  it('masks any non-empty input value', () => {
    expect(maskInputValue('hunter2')).toBe('•••');
    expect(maskInputValue('')).toBe('');
  });

  it('redacts token-like text', () => {
    const pats = compilePatterns({
      blockedDomains: [],
      blockedSelectors: [],
      sensitivePatterns: ['sk-[A-Za-z0-9_-]{20,}'],
    });
    expect(redactText('key is sk-abc123456789012345678', pats)).toContain('[REDACTED]');
    expect(redactText('harmless text', pats)).toBe('harmless text');
  });

  it('ignores invalid regex in config', () => {
    const pats = compilePatterns({
      blockedDomains: [],
      blockedSelectors: [],
      sensitivePatterns: ['([bad'],
    });
    expect(pats).toHaveLength(0);
  });
});
