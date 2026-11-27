import { describe, it, expect } from 'vitest';
import {
  commandSchema,
  responseSchema,
  scenarioSchema,
  secretConfigSchema,
} from '../src/index.js';
import { ExtAgentError, ERROR_CODES } from '../src/errors.js';

describe('commandSchema', () => {
  it('parses a valid command', () => {
    const c = commandSchema.parse({
      id: 'c1',
      action: 'click',
      params: { ref: 'e12' },
    });
    expect(c.params).toEqual({ ref: 'e12' });
  });

  it('defaults params to {}', () => {
    const c = commandSchema.parse({ id: 'c3', action: 'tab_list' });
    expect(c.params).toEqual({});
  });
  it('rejects unknown action', () => {
    expect(() =>
      commandSchema.parse({ id: 'c2', action: 'hack' }),
    ).toThrow();
  });
});

describe('responseSchema', () => {
  it('parses ok response', () => {
    const r = responseSchema.parse({ id: 'c1', ok: true, result: { x: 1 } });
    expect(r.ok).toBe(true);
  });
  it('parses error response', () => {
    const r = responseSchema.parse({
      id: 'c1',
      ok: false,
      error: { code: 'COMMAND_TIMEOUT', message: 'late' },
    });
    expect(r.error?.code).toBe('COMMAND_TIMEOUT');
  });
});

describe('scenarioSchema', () => {
  it('accepts step list', () => {
    const s = scenarioSchema.parse({
      name: 'login',
      steps: [{ action: 'navigate', params: { url: 'https://example.com' } }],
    });
    expect(s.steps).toHaveLength(1);
  });
  it('rejects empty steps', () => {
    expect(() => scenarioSchema.parse({ name: 'x', steps: [] })).toThrow();
  });
});

describe('secretConfigSchema', () => {
  it('accepts patterns list', () => {
    const c = secretConfigSchema.parse({
      sensitivePatterns: ['sk-[A-Za-z0-9]{20}'],
    });
    expect(c.sensitivePatterns).toHaveLength(1);
  });
});

describe('ExtAgentError', () => {
  it('uses central message table', () => {
    const e = new ExtAgentError('COMMAND_TIMEOUT', '3s');
    expect(e.message).toContain(ERROR_CODES.COMMAND_TIMEOUT);
  });
});
