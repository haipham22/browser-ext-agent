# browser-ext-agent

Agent (Claude Code / MCP client) điều khiển browser thật của bạn qua extension Chrome — chỉ khi bạn bật.

```
agent ⇄ MCP (stdio) ⇄ server (Node) ⇄ WebSocket ⇄ extension (MV3) ⇄ trang web
```

## Dùng thử (cục bộ)

```bash
pnpm install && pnpm test          # 16 tests
cd packages/extension && node compile.mjs   # bundle extension → release/
cd ../server && npx esbuild src/index.ts --bundle --platform=node --format=esm \
  --outfile=release/index.js --external:ws --external:@modelcontextprotocol/sdk --external:zod
node release/index.js              # MCP (stdio) + WS localhost:8765
```

1. Chrome → `chrome://extensions` → Developer mode → **Load unpacked** → `packages/extension/release/`
2. Click icon extension → nhập URL server (mặc định đúng) → **Enable**
3. `claude mcp add browser-ext-agent -- node /abs/path/packages/server/release/index.js`
4. Trong session: `browser_navigate` → `browser_snapshot` → `browser_click` → `browser_console_logs`

## Secret protection (D8)

- Snapshot không bao giờ trả value của input (chỉ `value=•••`).
- Password/OTP/card + `blockedSelectors` → mask hẳn, chỉ hiện `[masked sensitive field]`.
- Screenshot che sensitive trước khi chụp, xong bỏ che.
- `SECRET_CONFIG_PATH` (JSON: `blockedDomains`, `blockedSelectors`, `sensitivePatterns` regex)

## Docs

Kiến trúc/decision: `context/` (source of truth). Plan gốc: `~/.claude/plans/gi-t-mu-n-witty-fern.md`.
