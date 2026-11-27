---
type: architecture
tier: T0
status: DRAFT
last_reviewed: "2026-11-27"
---

# ARCHITECTURE — browser-ext-agent

> **Thin but decisive.** Enough for the agent to decide while coding without asking. Not a 20-page HLD.
>
> **System size — rule #5: one app, one DB, one deploy place — no microservices.** §1 is exactly one row, §2 exactly one row, §3 says `—`.
> Multi-target projects: one folder per boundary/experience, declared in §1–§3 — **never spawn targets beyond that declared list.**
>
> Remove every `_TO_FILL_` marker once filled in.

---

## 1. Backend boundaries

<!-- Default: exactly ONE row named `app`; "Owns data" lists the entities from §6.
     Multi-target: one row per boundary — the name doubles as the code folder name.
     "Loop" column: which loop ships this boundary (per context/ROADMAP.md §1). -->

| Boundary | Job (1 line) | Owns data | Loop |
|---|---|---|---|
| `server` (npm `@haipham22/browser-ext-agent`) | Nhận tool call từ agent (MCP stdio), route qua WS tới extension | secret-config, pending command map | 1 |

## 2. Frontend experiences — web

<!-- Default: one row (or `—` when backend-only).
     Multi-target: one row per experience; the name = the code folder name.

     The "Design system" column is the SINGLE source mapping experience → design-system package.
     Value = the package name.

     · One design system → keep `—`; every check runs against the one token table, nothing to declare.
     · MULTIPLE packages → this column is MANDATORY on every row; empty means red. Two experiences
       sharing one package is normal.

     Example (two design systems):
     | admin-console | P-OWNER | calendar admin, reports | 1 | admin |
     | shop-web      | P-BUYER | booking, status view   | 2 | shop  | -->

| Experience | Persona | Exposed capability | Loop | Design system |
|---|---|---|---|---|
| `extension` (Chrome MV3: popup + service worker + content script) | P-OWNER (user, consent qua popup D9) | Điều khiển trang: click/type/scroll/snapshot/screenshot/console; secret redact (D8) | 1 | — |

## 3. Frontend experiences — mobile

<!-- No mobile → keep `—` and delete the table. "Design system" column: see §2. -->

| Experience | Platform | Persona | Loop | Design system |
|---|---|---|---|---|
| — | | | | — |

## 4. Diagram

```
Agent (Claude Code)
  | MCP stdio (12 tools)
  v
server (1 process Node: WsServer + bridge + MCP)
  | WebSocket ws://host:8765 (dial-out tu extension, D3/D4)
  v
extension MV3 (service worker: WS client + router)
  | chrome.tabs / captureVisibleTab / tabs.sendMessage
  v
content script (snapshot + redact + actions + console capture)
  | DOM events trong trang
  v
web page
```
Response di nguoc lai dung duong nay.

<!-- ASCII or mermaid. Minimum need: user → app → DB → external services.
     Example:
       User ──► Next.js (Vercel) ──► Postgres (Neon)
                           ├──► Clerk (auth)
                           └──► Resend (email)

     Keep the topology: experience → BFF (if any) → boundary → datastore,
     plus notable external infrastructure. -->

## 5. Contracts between targets

<!-- Only when there is more than one target. One app → delete the table, write `—`:
     no boundary left to sign a contract across.
     Each row = one surface other sides depend on. This is also the source of
     BACKWARD-COMPATIBILITY-CHECKLIST.md §1 from loop 2 — changing here means changing the contract. -->

| Contract | Provider | Consumer | Kind | Loop |
|---|---|---|---|---|
| WS protocol (command/response, zod schema trong `packages/shared`) | server | extension | JSON qua WebSocket | 1 |
| MCP tools (12) | server | agent (Claude Code...) | stdio JSON-RPC | 1 |
| chrome.runtime messaging (PageCommand/CommandResult) | service worker | content script | chrome message | 1 |

## 6. Core data model

<!-- Main entities + relations + important constraints. This is where the agent looks when unsure
     "why does this field exist", "is this unique". Write enough so nobody has to ask.
     Multi-target: one table block per data-owning boundary, headed `### <boundary>`. -->

| Entity | Key fields | Relations | Constraints |
|---|---|---|---|
| Command | id (uuid), action, params | — | action thuoc COMMAND_ACTIONS; response cung id |
| AgentResponse | id, ok, result?, error{code,message} | Command | error.code thuoc ERROR_CODES |
| SecretConfig | blockedDomains, blockedSelectors, sensitivePatterns | — | server push xuong extension khi connect (D8) |
| Scenario (v2, D14) | name, steps[] | steps ~ Command | v1 chi schema, chua runner |

**Decided edge cases** (source: `PRD.md §7`):

| Situation | Handling |
|---|---|
| 2 connection extension | Moi nhat thang; cu bi close(4000), pending bi reject (EXTENSION_NOT_CONNECTED) |
| Command timeout | 30s o server (WsServer timer); extension khong tra loi -> fail sach |
| Extension mat ket noi giua command | Pending reject EXTENSION_NOT_CONNECTED; tool bao loi cho agent |
| Ref stale sau navigation | ELEMENT_NOT_FOUND / REF_STALE -> agent snapshot lai |
| Trang qua dai | Snapshot cat 200 dong + note scroll-re-snapshot (D11) |
| Worker bi kill (MV3 idle) | WS activity giu worker song; wake-up -> syncConnection tu noi lai (D9) |

## 7. Core flow

<!-- The most important end-to-end flow — the one that must run first, and the one every
     review walkthrough goes through. Write step by step, noting where it touches the DB,
     where it calls out, where it crosses a target boundary. -->

```
1. Agent goi MCP tool (vd browser_click {ref: e12})
2. registerTools handler -> bridge.sendCommand(action, params)
3. WsServer.dispatch: generate id, luu pending map, JSON qua WS toi extension
4. Service worker routeCommand: cap-tab (navigate/tab_*) -> chrome.tabs;
   cap-trang (click/type/...) -> tabs.sendMessage toi content script
   (script chua co -> executeScript inject roi thu lai 1 lan)
5. Content script handleAction -> DOM events trong trang; tra CommandResult
6. SW ws.send({id, ok, result|error}) -> WsServer gỡ pending, resolve bridge
7. Tool format (withSnapshot tu kem snapshot sau navigate/click/type, D11)
   -> MCP content -> agent doc va quyet dinh buoc tiep theo
```

Consent gate (D9): worker chi noi WS khi user bat; tool tra
EXTENSION_NOT_CONNECTED kem huong dan bat trong popup.

## 8. Module boundaries

<!-- How the code splits, who may call whom. Stops the agent from putting logic in the wrong place.
     Default — structure inside the single app at the repo root:
       app/       routing + layout
       features/  by feature: UI + hook + local state
       lib/       shared: db client, auth, utilities
       server/    business logic + DB access   ← the ONLY place that touches the DB
     Multi-target — the structure INSIDE each target folder (per that target's stack skill),
     plus the rule: a target never imports another target's code directly; go through the §5 contract. -->

| Directory | Contains | Callable by | Must not do |
|---|---|---|---|
| `packages/shared/src` | protocol zod schema, ERROR_CODES, SecretConfig/Scenario | server + extension | khong import code 2 package kia |
| `packages/server/src` | index (bin), config, ws-server, bridge, mcp/tools, secret-config | — | khong doi cham DOM/browser API |
| `packages/server/src/mcp` | 12 tool def, withSnapshot helper | index | khong biet WS ton tai (chi qua bridge) |
| `packages/extension/src/background` | service worker: WS client, router, navigate/screenshot/tab | — | khong doi cham DOM |
| `packages/extension/src/content` | snapshot, refs, actions, redact, console-capture, main (dispatcher) | service worker message | khong goi server truc tiep; khong network |
| `packages/extension/popup` | UI bat/tat + URL server + token | — | khong route command |

Ground rules:
- Secret redact chi o content script (D8) — server/agent khong co code path thay ban goc.
- stdout cua server la kenh MCP stdio — log chi ra stderr.
- Ref registry + console buffer song theo trang; navigation lam moi (D10/D11).

Ground rules that never change:
- Only **one layer** touches the DB. The UI never queries directly.
- Business logic does not live in components.
- External service calls go through one single place (easy to mock in tests, easy to swap when a provider breaks).

## 9. External services

| Service | Used for | If it breaks |
|---|---|---|
| npm registry | `npx -y` bin cho may khac (D12) | install/phan phoi bi tre; server van chay tu repo |
| Chrome extension platform (tabs/scripting/storage APIs) | moi hanh dong | tool tra loi loi ro rang; khong crash server |

## 10. Deliberately NOT doing

<!-- State it explicitly so the agent doesn't "helpfully" add: cache layer, queue, websocket, multi-tenant,
     i18n, dark mode... Not in this loop does not mean never — anything needed goes to ROADMAP. -->

- DB / ORM (server stateless)
- Auth user (token shared secret thoi, D13)
- Cookie/localStorage/network tools (D8 — phai co decision moi + redact)
- i18n, dark mode, multi-tenant
- Scenario runner (v2 — schema da san trong shared, D14)

## 11. Change log

| Date | Change | Reason |
|---|---|---|
| 2026-11-27 | Created from template | — |
| 2026-11-27 | Điền kiến trúc v1 sau lần dựng đầu | Code v1 tồn tại |
