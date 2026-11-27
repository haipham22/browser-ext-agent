# SETUP — chạy được ngay sau khi clone

Từ zero tới lúc agent điều khiển được browser của bạn: ~5 phút.

## Yêu cầu

| Cần | Ghi chú |
|---|---|
| Node.js ≥ 20 | [nodejs.org](https://nodejs.org) hoặc `mise use node@20` |
| pnpm ≥ 9 | `corepack enable` (đã có sẵn theo Node) hoặc `npm i -g pnpm` |
| Chrome / Edge / Brave | Bản mới (MV3 service worker + WebSocket giữ worker sống cần Chrome ≥ 116) |
| Claude Code (hoặc MCP client khác) | Để agent gọi tools |

## 1. Clone + cài đặt + build

```bash
git clone https://github.com/haipham22/browser-ext-agent.git
cd browser-ext-agent
pnpm install
pnpm build                       # typecheck + bundle server ra packages/server/release/
cd packages/extension && node compile.mjs   # bundle extension ra packages/extension/release/
cd ../..
```

## 2. Cài extension vào Chrome

1. Mở `chrome://extensions`
2. Bật **Developer mode** (góc phải trên)
3. **Load unpacked** → chọn thư mục `packages/extension/release/`
4. (Nên) Ghim extension ra toolbar cho dễ click

## 3. Chạy server

```bash
node packages/server/release/index.js
```

Log mong đợi: `[browser-ext-agent] MCP ready (stdio) | WS ws://localhost:8765 | token: none`

Cổng/bind khác:

```bash
node packages/server/release/index.js --port 9000              # đổi cổng
node packages/server/release/index.js --host 0.0.0.0 --token <secret>   # browser ở máy khác
```

Tương đương bằng env: `PORT`, `HOST`, `EXT_TOKEN` (xem `deployment/.env.example`).

## 4. Nối extension ↔ server

Click icon **Browser Ext Agent** trên toolbar:

- **Server URL**: giữ mặc định `ws://localhost:8765` (đổi nếu server chạy máy khác)
- **Token**: điền nếu server yêu cầu
- Nhấn **Enable** → badge **ON** trên icon = đã nối

> Extension mặc định TẮT. Agent không tự bật được — đây là thiết kế (bạn mới là người cho phép).

## 5. Đăng ký MCP cho agent

```bash
claude mcp add browser-ext-agent -- node /absolute/path/to/browser-ext-agent/packages/server/release/index.js
```

(Thay đường dẫn absolute nơi bạn clone. Restart session Claude Code.)

## 6. Thử

Trong session agent, gọi lần lượt:

```
browser_navigate  { "url": "https://example.com" }
browser_snapshot  {}
browser_click     { "ref": "e12" }        # ref lấy từ snapshot
browser_console_logs {}
```

Ví dụ câu thật: *"Mở voz.vn, liệt kê các chủ đề mới nhất ở box Máy tính"* — agent sẽ tự navigate → snapshot (lật pagination nếu trang dài) → đọc.

## Xử lý lỗi nhanh

| Hiện tượng | Nguyên nhân / cách xử lý |
|---|---|
| Tool trả `extension is not connected` | Server chưa chạy, hoặc sai URL/token trong popup — sửa rồi Enable lại |
| Tool trả `extension is turned off` | Mở popup nhấn **Enable** |
| Load unpacked không thấy extension | Kiểm tra đã build bước 1 (file `release/manifest.json` tồn tại); Google Chrome branded ≥137 chặn `--load-extension` qua CLI — dùng Load unpacked trên UI là bình thường |
| Badge OFF dù đã Enable | Server chưa nghe đúng cổng — xem log bước 3 |
| Snapshot báo `(... of N entries — next page ...)` | Trang dài — gọi `browser_snapshot {offset: <số trong footer>}` |
| Muốn chặn domain nhạy cảm | Tạo file config JSON (`blockedDomains`, `blockedSelectors`, `sensitivePatterns`) rồi chạy server với `SECRET_CONFIG_PATH=/đường/dẫn/file.json` |

## Chạy test / dev

```bash
pnpm test                                   # 16 unit tests
pnpm --filter @haipham22/browser-ext-agent-extension exec tsc --noEmit   # typecheck
cd packages/extension && node compile.mjs --watch  # rebuild extension khi sửa code
pnpm dev:server                             # server chạy TS trực tiếp, auto-restart
```

Chi tiết kiến trúc: [`context/ARCHITECTURE.md`](context/ARCHITECTURE.md) · Quyết định thiết kế: [`context/DECISIONS.md`](context/DECISIONS.md) · License: [MIT](LICENSE)
