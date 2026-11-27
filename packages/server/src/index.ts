import { readFileSync } from 'node:fs';

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import { loadConfig } from './config.js';
import { WsServer } from './ws-server.js';
import { makeSendCommand } from './bridge.js';
import { registerTools } from './mcp/tools.js';
import { loadSecretConfig } from './secret-config.js';
import { cdpClose } from './cdp.js';

function pkgVersion(): string {
  try {
    // bundle ra 1 file nằm cạnh package.json -> 'ihpack' trở lên 1 cấp
    const url = new URL('../package.json', import.meta.url);
    return JSON.parse(readFileSync(url, 'utf8')).version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}

const cfg = loadConfig();
const secretConfig = loadSecretConfig(process.env.SECRET_CONFIG_PATH);

const wsServer = new WsServer(cfg.port, cfg.host, cfg.extToken, 30_000, (connected) => {
  // stderr-only: stdout là kênh stdio của MCP, không được bẩn
  console.error(`[browser-ext-agent] extension ${connected ? 'connected' : 'disconnected'}`);
});
wsServer.setSecretConfig(secretConfig);

const mcp = new McpServer(
  { name: 'browser-ext-agent', version: pkgVersion() },
  { capabilities: { tools: {} } },
);
registerTools(mcp, { ws: wsServer, send: makeSendCommand(wsServer), cdpUrl: cfg.cdpUrl });

// graceful shutdown (CONVENTIONS §6): ngừng nhận mới, đóng resource cuối cùng
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
function shutdown(): void {
  wsServer.close();
  void cdpClose();
  process.exit(0);
}

async function main(): Promise<void> {
  await mcp.connect(new StdioServerTransport());
  console.error(
    `[browser-ext-agent] MCP ready (stdio) | WS ws://${cfg.host}:${cfg.port}` +
      (cfg.extToken ? ' | token: required' : ' | token: none'),
  );
}

main().catch((e) => {
  console.error('[browser-ext-agent] fatal:', e);
  process.exit(1);
});
