---
type: techstack
tier: T0
status: DRAFT
last_reviewed: "2026-11-27"
---

# TECHSTACK — browser-ext-agent

> Locked upfront, with a one-line reason in `DECISIONS.md`. Changing the stack after the lock breaks rule #1 — the trade-off must be logged.

---

## 1. Stack per target

<!-- Keep exactly ONE block below, named `app` — one app, one DB,
     one deploy place (rule #5), scaffold straight into the repo root per the stack skill.

     MULTI-TARGET PROJECTS ONLY: repeat the `### Target: <name>` block for every boundary/experience,
     named after the code folder. Keep the chosen choices + reasons even when they differ from the
     skill's default — don't swap Sequelize + Chakra for Prisma + shadcn just to match the skill.
     Delete rows the target doesn't use; add rows that exist in the project but aren't listed. -->

### Target: `server` (npm package, publish) và `extension` (Chrome MV3, không publish)

| Item | Choice | Version | Reason |
|---|---|---|---|
| Skill in use | custom | — | Browser-agent stack riêng, không thuộc Next/Nest/Go |
| Language | TypeScript (strict) | 5.7 | 1 ngôn ngữ cho cả 3 tầng — xem DECISIONS D2 |
| Runtime | Node.js | ≥ 20 (dev trên 24) | MCP SDK + ws chạy Node; `npx` bin |
| WS server | `ws` | 8.18 | Nhẹ, chuẩn de-facto for Node WS |
| MCP SDK | `@modelcontextprotocol/sdk` | 1.x | Stdio transport, `server.tool()` API |
| Validation | zod 3.24 | 3.24 | Protocol schema dùng chung server + extension |
| Extension target | Chrome MV3 | — | D5 |
| Bundler | esbuild | 0.21 | Bundle server (1 file) + extension 3 entry |
| Test runner | vitest | 2.1 | ESM-native, nhanh |
| Database | none | — | Server stateless |
| Deploy | npm publish (server); Chrome Web Store sau (extension) | — | D12 |

`Skill in use` = `custom` — không stack skill nào khớp browser-agent stack này.

## 2. Shared infrastructure

| Item | Choice | Version | Used by which target |
|---|---|---|---|
| Error tracking | none (v1) | — | — |
| Analytics | none (v1) | — | — |

## 3. Why this stack

TS xuyên suốt để protocol chia sẻ type giữa extension/server/agent-facing tool (D2); Node + `ws` vì agent chạy local qua stdio (D3/D12); Chrome MV3 vì user dùng Chrome-family (D5). Chi tiết từng quyết định xem DECISIONS D2–D14.

## 4. Version pinning

```
node >= 20 (dev: 24.18) · typescript 5.7 · zod 3.24 · ws 8.18 ·
@modelcontextprotocol/sdk 1.x · esbuild 0.21 · vitest 2.1 · @types/chrome 0.0.287
```

## 5. Command contract

| Command | What it does | Working? |
|---|---|---|
| `make dev` | `pnpm dev:server` (server + MCP stdio) | ☐ thay bằng lệnh dưới |
| `pnpm dev:server` | Chạy server (TS trực tiếp, node strip-types) | ✅ |
| `pnpm build` | Typecheck + bundle cả workspace | ✅ |
| `pnpm test` | vitest cả 3 package (16 tests) | ✅ |
| `node packages/server/release/index.js` | Chạy bin đúng như `npx` sẽ chạy | ✅ |
| `pnpm --filter extension exec node compile.mjs` | Bundle extension → `packages/extension/release/` (load unpacked) | ✅ |
| `make migrate` | n/a — không DB | — |
| `make deploy` | `pnpm publish` workspace server (D12) | ☐ khi lên npm |

## 6. Environment variables

Full list in `deployment/.env.example`.

| Variable | Used for | Target | Required? |
|---|---|---|---|
| PORT | WS port (default 8765) | server | No |
| HOST | Bind address (default localhost) | server | No |
| EXT_TOKEN | Token extension gửi khi connect; bắt buộc khi HOST ngoài localhost | server + extension | No (local), Yes (remote) |
| SECRET_CONFIG_PATH | Đường dẫn secret-config.json (blockedDomains/sensitivePatterns) | server | No |

## 7. Change log

| Date | Change | Reason |
|---|---|---|
| 2026-11-27 | Created from template | — |
| 2026-11-27 | Điền stack thật sau lần dựng v1 | Code v1 tồn tại |
