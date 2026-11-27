import { WebSocketServer, type WebSocket } from 'ws';

import {
  commandSchema,
  responseSchema,
  secretConfigSchema,
  type Command,
  type AgentResponse,
  type SecretConfig,
} from '@haipham22/browser-ext-agent-shared';

export interface PendingEntry {
  resolve: (r: AgentResponse) => void;
  reject: (e: Error) => void;
  timer: NodeJS.Timeout;
}

export class WsServer {
  private socket: WebSocket | null = null;
  private pending = new Map<string, PendingEntry>();
  private peers = new Set<WebSocket>();
  private wss: WebSocketServer;
  private currentConfig: SecretConfig | null = null;
  private pingTimer: NodeJS.Timeout;

  constructor(
    port: number,
    host: string,
    private extToken?: string,
    private commandTimeoutMs = 30_000,
    private onExtensionChange: (connected: boolean) => void = () => {},
  ) {
    this.wss = new WebSocketServer({ host, port });
    this.wss.on('connection', (ws, req) => this.onConnection(ws, req));
    // Chrome MV3 stops an SW whose WebSocket sees no JS-visible activity;
    // protocol pings/pongs don't count, so send a real message the extension
    // already handles (apply_config is a no-op re-store) every 25s (D20)
    this.pingTimer = setInterval(() => {
      if (this.socket && this.socket.readyState === 1) {
        this.socket.send(
          JSON.stringify({ id: `ka-${Date.now()}`, action: 'apply_config', params: { config: this.currentConfig } }),
        );
      }
    }, 25_000);
    this.wss.on('close', () => clearInterval(this.pingTimer));
  }

  get isExtensionConnected(): boolean {
    return this.socket !== null && this.socket.readyState === 1;
  }

  /** Resolves once the underlying server is listening — clients may connect. */
  waitForListening(): Promise<void> {
    if (this.wss.address()) return Promise.resolve();
    return new Promise((resolve, reject) => {
      this.wss.once('listening', resolve);
      this.wss.once('error', reject);
    });
  }

  get secretConfig(): SecretConfig | null {
    return this.currentConfig;
  }

  /** Đặt secret config (nạp từ file config ở server, đẩy xuống extension). */
  setSecretConfig(cfg: SecretConfig): void {
    this.currentConfig = secretConfigSchema.parse(cfg);
    if (this.isExtensionConnected) {
      this.dispatch(
        {
          id: `cfg-${Date.now()}`,
          action: 'apply_config',
          params: { config: this.currentConfig },
        },
        () => {}, // fire-and-forget
        () => {}, // ngắt kết nối thì thôi, config sẽ đẩy lại khi connect
      );
    }
  }

  /** Gửi command tới extension, trả qua callback; reply id = command id. */
  dispatch(
    command: Command,
    reply: (r: AgentResponse) => void,
    fail: (e: Error) => void,
  ): void {
    if (!this.isExtensionConnected) {
      fail(new Error('EXTENSION_NOT_CONNECTED'));
      return;
    }
    // Nếu có command cũ cùng id (không nên xảy ra) -> fail sạch.
    const prev = this.pending.get(command.id);
    if (prev) {
      clearTimeout(prev.timer);
      prev.reject(new Error('COMMAND_TIMEOUT'));
    }

    const timer = setTimeout(() => {
      this.pending.delete(command.id);
      fail(new Error('COMMAND_TIMEOUT'));
    }, this.commandTimeoutMs);

    this.pending.set(command.id, { resolve: reply, reject: fail, timer });
    this.socket!.send(JSON.stringify(command));
  }

  private onConnection(ws: WebSocket, req: { url?: string }): void {
    // Token check: bắt buộc khi server bind ngoài localhost (D13).
    if (this.extToken) {
      const url = new URL(req.url ?? '/', 'http://x');
      const token = url.searchParams.get('token');
      if (token !== this.extToken) {
        ws.close(4001, 'EXT_TOKEN mismatch');
        return;
      }
    }
    // Peer connections (MCP servers in proxy mode) forward commands to the
    // extension socket — they never take the extension slot.
    if ((req.url ?? '').includes('role=peer')) {
      ws.on('message', (data) => {
        let parsed: unknown;
        try {
          parsed = JSON.parse(String(data));
        } catch {
          return;
        }
        const r = commandSchema.safeParse(parsed);
        if (!r.success) return;
        this.dispatch(
          r.data,
          (result) => {
            if (ws.readyState === 1) {
              ws.send(JSON.stringify({ id: r.data.id, ok: true, result }));
            }
          },
          (err) => {
            if (ws.readyState === 1) {
              const code = err.message.split(':')[0] ?? 'COMMAND_TIMEOUT';
              ws.send(JSON.stringify({ id: r.data.id, ok: false, error: { code, message: err.message } }));
            }
          },
        );
      });
      ws.on('close', () => this.peers.delete(ws));
      this.peers.add(ws);
      return;
    }
    // Connection mới thắng connection cũ (reload extension...).
    if (this.socket && this.socket !== ws) {
      this.rejectPending('EXTENSION_NOT_CONNECTED');
      this.socket.close(4000, 'replaced by new connection');
    }
    this.socket = ws;
    this.onExtensionChange(true);

    if (this.currentConfig) {
      ws.send(
        JSON.stringify({
          id: `cfg-${Date.now()}`,
          action: 'apply_config',
          params: { config: this.currentConfig },
        }),
      );
    }

    ws.on('message', (data) => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(String(data));
      } catch {
        return; // frame rác -> bỏ qua, không kill connection
      }
      const r = responseSchema.safeParse(parsed);
      if (!r.success) return;
      const entry = this.pending.get(r.data.id);
      if (!entry) return;
      clearTimeout(entry.timer);
      this.pending.delete(r.data.id);
      entry.resolve(r.data);
    });

    ws.on('close', () => {
      if (this.socket === ws) {
        this.socket = null;
        this.rejectPending('EXTENSION_NOT_CONNECTED');
        this.onExtensionChange(false);
      }
    });

    ws.on('error', () => {
      // close event sẽ chạy sau error -> dọn dẹp ở đó.
    });
  }

  private rejectPending(code: string): void {
    for (const entry of this.pending.values()) {
      clearTimeout(entry.timer);
      entry.reject(new Error(code));
    }
    this.pending.clear();
  }

  close(): void {
    this.rejectPending('EXTENSION_NOT_CONNECTED');
    if (this.socket) this.socket.close();
    this.wss.close();
  }
}

