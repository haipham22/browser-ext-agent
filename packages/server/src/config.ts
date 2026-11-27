import { parseArgs } from 'node:util';

import { ExtAgentError } from '@haipham22/browser-ext-agent-shared';

export interface ServerConfig {
  port: number;
  host: string;
  extToken?: string;
}

/**
 * Config: flag CLI thắng env (D12/D13). Mặc định localhost:8765.
 * Mọi giá trị đều có default an toàn — app không bao giờ half-running.
 */
export function loadConfig(argv: string[] = process.argv): ServerConfig {
  const { values } = parseArgs({
    args: argv.slice(2),
    options: {
      port: { type: 'string', short: 'p' },
      host: { type: 'string', short: 'H' },
      token: { type: 'string', short: 't' },
      help: { type: 'boolean' },
    },
    allowPositionals: false,
  });

  const port = Number(values.port ?? process.env.PORT ?? 8765);
  const host = values.host ?? process.env.HOST ?? 'localhost';
  const extToken = values.token ?? process.env.EXT_TOKEN;

  if (!Number.isInteger(port) || port <= 0) {
    throw new ExtAgentError('INVALID_PARAMS', `bad port: ${port}`);
  }
  if (host !== 'localhost' && host !== '127.0.0.1' && !extToken) {
    // Local bind không cần token; bind ra ngoài phải có token (D13).
    throw new ExtAgentError(
      'INVALID_PARAMS',
      `EXT_TOKEN is required when host is ${host}`,
    );
  }
  return { port, host, extToken };
}
