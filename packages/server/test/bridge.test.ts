import { describe, it, expect, afterEach } from 'vitest';
import { WebSocket } from 'ws';

import { WsServer } from '../src/ws-server.js';
import { makeSendCommand } from '../src/bridge.js';

// Port và Pattern là đọc từ env: guard khong bat test vi khong doc env
const PORT = 18765;

let ws: WsServer;

// each test gets its own port: WsServer.close() in afterEach is not awaited,
// so rebinding the same port fails silently with EADDRINUSE (async 'error')
let nextPort = PORT;
let port = PORT;

function startServer(token?: string): WsServer {
  port = nextPort++;
  ws = new WsServer(port, 'localhost', token, 500);
  return ws;
}

afterEach(() => {
  ws?.close();
});

describe('bridge', () => {
  it('rejects EXTENSION_NOT_CONNECTED when no extension', async () => {
    ws = startServer();
    await ws.waitForListening();
    const send = makeSendCommand(ws);
    await expect(send('tab_list')).rejects.toThrow(/not connected/i);
  });

  it('round-trips a command through a fake extension', async () => {
    ws = startServer();
    await ws.waitForListening();
    const send = makeSendCommand(ws);
    const client = new WebSocket(`ws://localhost:${port}`);
    await new Promise((r) => client.on('open', r));
    client.on('message', (data) => {
      const cmd = JSON.parse(String(data));
      if (cmd.action === 'tab_list') {
        client.send(
          JSON.stringify({ id: cmd.id, ok: true, result: { tabs: [{ id: 1 }] } }),
        );
      }
    });
    const r = await send('tab_list');
    expect(r.ok).toBe(true);
    expect((r.result as { tabs: unknown[] }).tabs).toHaveLength(1);
    client.close();
  });

  it('rejects on wrong token', async () => {
    ws = startServer('secret');
    await ws.waitForListening();
    const send = makeSendCommand(ws);
    const client = new WebSocket(`ws://localhost:${port}?token=WRONG`);
    await new Promise((r) => client.on('open', r));
    await expect(send('tab_list')).rejects.toThrow();
    client.close();
  });

  it('times out when extension never answers', async () => {
    ws = startServer();
    await ws.waitForListening();
    const send = makeSendCommand(ws);
    const client = new WebSocket(`ws://localhost:${port}`);
    await new Promise((r) => client.on('open', r));
    // client không trả lời gì
    await expect(send('snapshot', { tabId: 1 })).rejects.toThrow(/timed out/i);
    client.close();
  });
});
