import { z } from 'zod';

/** Protocol server <-> extension (WebSocket). 1 scenario (v2) = list step nay (D7). */

export const COMMAND_ACTIONS = [
  'navigate',
  'click',
  'type',
  'scroll',
  'snapshot',
  'screenshot',
  'wait_for',
  'tab_list',
  'tab_new',
  'tab_select',
  'tab_close',
  'console_logs',
  'apply_config',
] as const;

export type CommandAction = (typeof COMMAND_ACTIONS)[number];

export const commandSchema = z.object({
  id: z.string().min(1),
  action: z.enum(COMMAND_ACTIONS),
  params: z.record(z.unknown()).default({}),
});
export type Command = z.infer<typeof commandSchema>;

export const responseSchema = z.object({
  id: z.string().min(1),
  ok: z.boolean(),
  result: z.unknown().optional(),
  error: z.object({ code: z.string(), message: z.string() }).optional(),
});
export type AgentResponse = z.infer<typeof responseSchema>;

export const secretConfigSchema = z.object({
  blockedDomains: z.array(z.string()).default([]),
  blockedSelectors: z.array(z.string()).default([]),
  sensitivePatterns: z.array(z.string()).default([]),
});
export type SecretConfig = z.infer<typeof secretConfigSchema>;

/** Scenario (v2, D7): list step cung shape voi 1 command. */
export const scenarioStepSchema = z.object({
  action: z.enum(COMMAND_ACTIONS),
  params: z.record(z.unknown()).default({}),
});
export type ScenarioStep = z.infer<typeof scenarioStepSchema>;

export const scenarioSchema = z.object({
  name: z.string().min(1),
  steps: z.array(scenarioStepSchema).min(1),
});
export type Scenario = z.infer<typeof scenarioSchema>;
