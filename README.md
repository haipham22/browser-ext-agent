# browser-ext-agent

Let your AI agent drive **your real browser** — via a Chrome extension, only while **you** have it enabled.

```
agent ⇄ MCP (stdio) ⇄ server (Node) ⇄ WebSocket ⇄ Chrome extension (MV3) ⇄ web page
```

Built for debugging and automation: your agent reads the page, clicks, types, scrolls, screenshots, evaluates JS, and reads console logs — on the browser that already has your sessions, extensions and login state. No headless setup, no re-authentication. Published on npm as [`browser-ext-agent`](https://www.npmjs.com/package/browser-ext-agent).

## Highlights

- **Consent by default** — the extension connects *only* after you click **Enable** in its popup. Turn it off and every tool call fails immediately. The agent has no way to enable itself.
- **Secret protection** — input values are never returned to the agent (`value=•••`), password/OTP/card fields are masked entirely, screenshots blur sensitive fields *before* capture, and token-like strings (`sk-…`, `Bearer …`, AWS keys, JWTs) are redacted from page text.
- **Token-cheap observations** — the agent sees a compact text outline with stable element refs (`[ref=e12] button "Place order"`), not raw HTML. Screenshots on demand.
- **Scenario runner** — `browser_scenario` takes a list of steps + a JS `extract` and runs them server-side, returning only the distilled result. One small tool call replaces a dozen snapshot round-trips.
- **Trusted input** — clicks, wheel scrolls and PageUp/PageDown go through `chrome.debugger` as real (`isTrusted`) events when a site ignores synthetic ones — Shopee's variation picker and lazy-feed sites included.
- **`browser_eval`** — run JS in a real tab (DOM probes, computed data) via `chrome.debugger`; optional Playwright-over-CDP fallback.
- **One npm package** — MCP server + WebSocket server ship as a single `npx`-able binary; the extension installs unpacked.

## Tools exposed to the agent

| Tool | What it does |
|---|---|
| `browser_navigate` | Open a URL (returns title + url + snapshot) |
| `browser_snapshot` | Text outline of interactive elements + text, each with a `ref`; paginated |
| `browser_click` / `browser_type` | Act on an element by `ref`; `trusted: true` sends a real mouse event for anti-bot paths |
| `browser_type` | Typing supports `submit` |
| `browser_scroll` | Trusted wheel or PageDown/PageUp (`method: "wheel" \| "key"`) |
| `browser_wait_for` | Wait for text or a selector to appear |
| `browser_eval` | Run JS in the tab via `chrome.debugger` (CDP fallback needs `playwright-core` + a debug-port Chrome) |
| `browser_scenario` | Multi-step flow server-side; returns per-step summaries + a JS `extract` — the context saver |
| `browser_screenshot` | PNG of the tab (sensitive fields pre-masked) |
| `browser_tab_list` / `browser_tab_new` / `browser_tab_select` / `browser_tab_close` | Tab management |
| `browser_console_logs` | Captured console logs / exceptions per tab |

## Setup

Zero-to-running guide: **[SETUP.md](SETUP.md)**. Quick version:

**1. Add the MCP server to your agent**

```bash
# from the npm registry
claude mcp add browser-ext-agent -- npx -y browser-ext-agent

# or pinned to this GitHub repo
claude mcp add browser-ext-agent -- npx -y github:haipham22/browser-ext-agent

# or from a local clone (while developing)
pnpm install && pnpm build
claude mcp add browser-ext-agent -- node /absolute/path/packages/server/dist/index.js
```

Server options: `--port`, `--host` (bind non-localhost requires `--token`), or env `PORT` / `HOST` / `EXT_TOKEN` / `SECRET_CONFIG_PATH` / `CDP_URL`.

**2. Install the extension**

Chrome → `chrome://extensions` → Developer mode → **Load unpacked** → `packages/extension/release/`

**3. Connect**

Click the extension icon → server URL (default is already right for localhost) → token if the server requires one → **Enable**. The badge shows **ON** while connected. The Enabled flag survives extension reloads (stored in `chrome.storage.local`).

Then try: `browser_navigate` → `browser_snapshot` → `browser_click` → `browser_console_logs`.

## Security model

Redaction happens **inside the content script** — the last layer before data leaves your browser. The server and agent never have a code path to the raw values.

Known limits (stated plainly): if a page *displays* a secret as plain text (e.g. a token printed on a dashboard), it can appear in a snapshot — token-pattern redaction mitigates common formats. There are deliberately **no** tools for cookies, localStorage, network traffic or history. Tune the extra guards via `SECRET_CONFIG_PATH` (JSON with `blockedDomains`, `blockedSelectors`, `sensitivePatterns` regexes).

Trusted input goes through `chrome.debugger`, so Chrome briefly shows its "being debugged" banner during a trusted click, scroll or eval. Anti-bot walls (login captchas, slider puzzles, per-session feed throttles) are deliberately **not** bypassed — solve those as a human, then the agent continues.

## Architecture

- [`packages/shared`](packages/shared) — zod protocol (commands/responses), central error codes, secret config, scenario schema
- [`packages/server`](packages/server) — WebSocket server + bridge + 14 MCP tools in one Node process; optional Playwright-over-CDP bridge
- [`packages/extension`](packages/extension) — MV3 service worker (WS client, router, trusted input via `chrome.debugger`), content script (snapshot refs, redact, actions, console capture), popup

Design decisions and rationale: [`context/DECISIONS.md`](context/DECISIONS.md). Architecture doc: [`context/ARCHITECTURE.md`](context/ARCHITECTURE.md).

## Development

```bash
pnpm test                                # 16 tests across the 3 packages
pnpm --filter @haipham22/browser-ext-agent-extension exec tsc --noEmit   # typecheck
cd packages/extension && node compile.mjs                                # rebuild extension bundle
```

**Releases are version-driven**: bump `version` in `package.json`, push `main` — CI (`.github/workflows/npm-publish.yml`) tests, packages, and publishes to npm via OIDC trusted publishing (no npm token secret needed), then tags `v<version>`.

## License

[MIT](LICENSE)
