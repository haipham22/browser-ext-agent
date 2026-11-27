import { randomUUID } from 'node:crypto';

import {
  ERROR_CODES,
  ExtAgentError,
  type ErrorCode,
  type CommandAction,
  type AgentResponse,
} from '@haipham22/browser-ext-agent-shared';
import type { WsServer } from './ws-server.js';

function toExtError(e: unknown): ExtAgentError {
  if (e instanceof ExtAgentError) return e;
  const msg = e instanceof Error ? e.message : String(e);
  const code: ErrorCode =
    msg in ERROR_CODES ? (msg as ErrorCode) : 'COMMAND_TIMEOUT';
  return new ExtAgentError(code);
}

/**
 * Bridge: 1 lệnh agent -> 1 command qua WS -> chờ response (timeout ở WsServer).
 * Extension chưa nối / chưa bật -> lỗi rõ ràng cho agent (D9).
 */
export function makeSendCommand(ws: WsServer) {
  return function sendCommand(
    action: CommandAction,
    params: Record<string, unknown> = {},
  ): Promise<AgentResponse> {
    if (!ws.isExtensionConnected) {
      return Promise.reject(new ExtAgentError('EXTENSION_NOT_CONNECTED'));
    }
    const id = randomUUID();
    return new Promise((resolve, reject) => {
      ws.dispatch(
        { id, action, params },
        (r) => {
          if (r.ok) {
            resolve(r);
          } else {
            const code: ErrorCode =
              r.error?.code && r.error.code in ERROR_CODES
                ? (r.error.code as ErrorCode)
                : 'COMMAND_TIMEOUT';
            reject(new ExtAgentError(code, r.error?.message));
          }
        },
        (e) => reject(toExtError(e)),
      );
    });
  };
}
