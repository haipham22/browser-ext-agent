---
type: decisions
tier: T0
append_only: true
last_reviewed: "2026-11-27"
---

# DECISIONS — browser-ext-agent

> **Append-only.** Never edit an old row; when a new decision supersedes an old one, add a new row and note `supersedes: DN`. Rows are numbered sequentially — reference a decision by its `DN`.
>
> This file **replaces asking the project owner**. From now on, anything ambiguous → pick the most reasonable option according to
> `PRD.md` / `ARCHITECTURE.md` / `TECHSTACK.md` → log one row here → keep going.
> The project owner reads it once at the end of the session, without being interrupted mid-row.

**When to log**: stack, main libraries, data model, money calculation, auth, edge-case handling, performance trade-offs — anything that, 3 days later, you'll look back at and ask "why did we do it that way?".

**When not needed**: naming a variable, splitting a file, picking a small utility library that can be swapped anytime.

---

| # | Date | Decision | Reason | Standing assumption | Reversible? |
|---|---|---|---|---|---|
| D1 | (template) | Log decisions in this file | Small solo product, needs to ship within a week to test the response | Scope can be locked within 2 hours | Yes — switch to a heavier process if that limit is exceeded |
| D2 | 2026-11-27 | TypeScript toàn bộ, pnpm workspaces: `packages/shared` + `server` + `extension` | 1 bộ type protocol dùng chung 3 tầng, 1 ngôn ngữ | Node ≥ 20 có sẵn ở mọi máy dùng | Yes — tách ngôn ngữ sau nếu cần, protocol schema là ranh giới |
| D3 | 2026-11-27 | MCP transport stdio; WS server + MCP server cùng 1 process Node | Dùng cá nhân local, không auth phức tạp; 1 lệnh boot | Claude Code là client chính | Yes — thêm streamable HTTP sau nếu agent gọi từ xa |
| D4 | 2026-11-27 | Extension dial-out qua WebSocket tới server (không nhận connection vào) | MV3 service worker không listen được; dial-out + reconnect backoff là pattern chuẩn | Chrome ≥ 116 (WS giữ worker sống) | No — kiến trúc cốt lõi |
| D5 | 2026-11-27 | Target Chrome/Chromium MV3 | Phủ Chrome/Edge/Brave/Arc; Firefox để sau | Không cần hỗ trợ MV2 | Yes — thêm Firefox bằng layer polyfill sau |
| D6 | 2026-11-27 | v1 action set: navigate, click, type, scroll, snapshot, screenshot, wait_for, tab_list/new/select/close, console_logs | Đủ để agent tự thao tác + debug; scroll nâng cao/hover/select/download để v2 | Agent compose chuỗi tool = kịch bản một lần gọi | Yes — thêm action = thêm 1 case ở 3 tầng |
| D7 | 2026-11-27 | Click/type đánh ref id (`e12`) do content script gán khi snapshot, thực hiện bằng DOM events | Agent không biết selector; DOM events thật đúng nhất cho trang có framework | Ref sống theo vòng đời trang, stale sau navigation | Yes — chrome.debugger/CDP làm fallback sau |
| D8 | 2026-11-27 | Secret protection chặn ở content script — redact TRƯỚC khi rời browser; không tool nào expose cookie/localStorage/network | Server/agent chỉ thấy được thứ extension đã lọc; chặn ở biên gần nguồn chặt nhất | Không hoàn hảo 100% với secret in ra text thường — user tự quyết mở trang nào | Hard — liên quan trust model |
| D9 | 2026-11-27 | Extension passive mặc định; chỉ active khi user click Enable trong popup (consent gesture duy nhất) | Mục đích debug khi cần; agent không được tự ý điều khiển | Khi tắt: WS ngắt, mọi tool trả lỗi rõ ràng | No — yêu cầu sản phẩm |
| D10 | 2026-11-27 | Console capture (log/info/warn/error + exception) ring buffer 500 entry/tab, chỉ chạy khi đã bật | Cặp năng lực debug cốt lõi cùng snapshot | Reload trang mất buffer (đủ dùng cho debug) | Yes |
| D11 | 2026-11-27 | Đầu vào chính của agent = snapshot outline text kèm ref; screenshot/console là kênh phụ; không trả raw HTML | Text outline rẻ token 10–50×, ref ổn định để click; HTML dư + selector gãy | Snapshot tự kèm sau navigate/click/type | Yes — thêm tool eval_js (v2+) khi cần |
| D12 | 2026-11-27 | Publish 1 npm package duy nhất chứa MCP + WS server (bin `browser-ext-agent`), shared bundle thẳng vào dist | Máy khác chỉ cần `npx -y` là chạy; không publish package phụ | Tên package: `@haipham22/browser-ext-agent` | Yes |
| D13 | 2026-11-27 | WS bind mặc định localhost:8765; `--port/--host` + env; extension cấu hình URL + token trong popup | Browser và npx thường cùng máy; tách máy thì host 0.0.0.0 + EXT_TOKEN bắt buộc | Token check ở server, extension gửi qua query param | Yes |
| D14 | 2026-11-27 | Scenario (v2, D7-ref): 1 scenario = JSON list bước tái dùng đúng action protocol; schema `scenarioSchema` sẵn trong shared, runner đặt ở server | Chạy tay hay chạy kịch bản dùng chung 1 đường code; extension không đổi gì | v1 chỉ validate schema, chưa có runner | Yes |
| D15 | 2026-11-27 | Repo GitHub **private** tại `haipham22/browser-ext-agent` | Tool cá nhân, an toàn mặc định | Lật public bất cứ lúc nào: `gh repo edit --visibility public` | Yes |
| D16 | 2026-11-27 | Repo chuyển thành **public** theo yêu cầu project owner | Dùng chung / showcase | Không có secret trong repo (đã kiểm tra: chỉ `.env.example`, không `.env`) | Yes — lật private lại bất cứ lúc nào |
| D17 | 2026-11-27 | Click/type waits for navigation settle (2s grace, 12s cap) before returning; no navigation → return after grace | Snapshots attached to click/type used to return the OLD page (dogfood 2026-11-27) — the agent read stale DOM right after clicking | Plain SPA clicks now cost an extra 2s grace; fetch-then-redirect slower than 2s can still be missed | Yes — drop the wait, revert to old behavior |
| D18 | 2026-11-27 | Screenshot with a background tabId fails with `TAB_NOT_VISIBLE` instead of capturing the window's visible tab | captureVisibleTab captures the visible tab; a silent wrong capture = wrong image + sensitive masking applied to the wrong tab | Agent must `tab_select` before screenshotting a background tab | Yes — drop the guard, return wrong images as before |
| D19 | 2026-11-27 | Enabled flag moved from `storage.session` to `storage.local` | Reloading the extension wipes session storage → the SW never reconnects on its own, manual popup Enable every dev cycle (dogfood 2026-11-27) | The Enabled choice now survives browser restarts too; badge/popup toggle still turns it off anytime | Yes — move back to session storage |
| D20 | 2026-11-27 | Server pings the extension WS every 25s | Chrome MV3 stops an SW whose WS sees no activity; after `apply_config` the wire goes silent → SW killed → reconnect loop (dogfood 2026-11-27 churn) | Protocol-level pong counts as activity, zero extension code; 25s < 30s idle window | Yes — remove the interval |
| D21 | 2026-11-27 | Optional Playwright bridge on the server: `browser_eval` runs JS in a real tab over CDP (`playwright-core`, connectOverCDP, default `http://localhost:9222`) | Dogfood spent ~20 tool calls guessing DOM structure (snapshot walker bugs); eval answers those in 1 call — unlocks the eval_js capability parked in D11 | MV3 cannot host Playwright, so it lives server-side; needs Chrome started with `--remote-debugging-port`; tab matched by URL substring, not tabId | Yes — remove `browser_eval` + the cdp module |
| D22 | 2026-11-27 | `browser_eval` prefers the extension's `chrome.debugger` (attach → Runtime.evaluate → detach); Playwright CDP is only the fallback | No Chrome flags or restart needed on the main path — project stays single-channel (extension); a "debugging this tab" banner flashes per call, accepted | debugger permission shows an install warning; blocked-domain guard applies to eval as well | Yes — drop the eval_js case, tool falls back to CDP-only |
| D23 | 2026-11-27 | Multi-session peer-proxy: the first MCP server process binds the port (owner, serves the extension); later processes boot as proxies forwarding commands over a `role=peer` WebSocket; on owner death a proxy promotes itself | Every Claude session spawns its own MCP server — a fixed port means the second session crashed with EADDRINUSE and lost all browser tools (user report: multi-session Claude) | Owner is single point; proxy promotion has a 2s retry loop; commands queue per caller timeout (30s) | Yes — revert to fail-fast EADDRINUSE |
<!-- The seed row above deliberately carries the date "(template)" so it does NOT count as a decision —
     a decision only counts when it has an ISO date logged by this project itself. -->

<!-- Sample rows (continue the numbering from the seed row):
| D2 | 2026-08-01 | Soft delete instead of hard delete for orders | Orders may need restoring when a customer calls back; AC-4 mentions "mistaken cancellation" | Low order volume, no risk of table bloat early on | Yes — switch to hard delete with a migration |
| D3 | 2026-08-01 | Clerk for auth instead of building it | 20 minutes instead of 1 day; PRD §7 locked Google sign-in | Accept a third-party dependency + cost at scale | Hard — switching providers means migrating users |
-->
