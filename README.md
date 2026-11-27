# browser-ext-agent

Let your AI agent drive **your real browser** — via a Chrome extension, only while **you** have it enabled.

```
agent ⇄ MCP (stdio) ⇄ server (Node) ⇄ WebSocket ⇄ Chrome extension (MV3) ⇄ web page
```

Built for debugging: your agent reads the page, clicks, types, scrolls, screenshots, and reads console logs — on the browser that already has your sessions, extensions and login state. No headless setup, no re-authentication.

## Highlights

- **Consent by default** — the extension connects *only* after you click **Enable** in its popup. Turn it off and every tool call fails immediately. The agent has no way to enable itself.
- **Secret protection** — input values are never returned to the agent (`value=•••`), password/OTP/card fields are masked entirely, screenshots blur sensitive fields *before* capture, and token-like strings (`sk-…`, `Bearer …`, AWS keys, JWTs) are redacted from page text.
- **Token-cheap observations** — the agent sees a compact text outline with stable element refs (`[ref=e12] button "Place order"`), not raw HTML. Screenshots on demand.
- **Console capture** — `console.*` output and uncaught exceptions are buffered per tab and readable via a tool. Made for debugging apps in the page.
- **One npm package** — MCP server + WebSocket server ship as a single `npx`-able binary; the extension installs unpacked.

## Tools exposed to the agent

| Tool | What it does |
|---|---|
| `browser_navigate` | Open a URL (returns title + url + snapshot) |
| `browser_snapshot` | Text outline of interactive elements + text, each with a `ref` |
| `browser_click` / `browser_type` | Act on an element by `ref`; typing supports `submit` |
| `browser_scroll` / `browser_wait_for` | Scroll; wait for text or a selector |
| `browser_screenshot` | PNG of the tab (sensitive fields pre-masked) |
| `browser_tab_list` / `browser_tab_new` / `browser_tab_select` / `browser_tab_close` | Tab management |
| `browser_console_logs` | Captured console logs / exceptions per tab |

## Setup

Zero-to-running guide: **[SETUP.md](SETUP.md)**. Quick version:

**1. Compile & run the server**

```bash
pnpm install
pnpm build
node packages/server/release/index.js     # MCP on stdio + WS on ws://localhost:8765
```

Options: `--port`, `--host` (bind non-localhost requires `--token`), or env `PORT` / `HOST` / `EXT_TOKEN` / `SECRET_CONFIG_PATH`.

**2. Install the extension**

Chrome → `chrome://extensions` → Developer mode → **Load unpacked** → `packages/extension/release/`

**3. Connect**

Click the extension icon → server URL (default is already right for localhost) → token if the server requires one → **Enable**. The badge shows **ON** while connected.

**4. Add the MCP server to your agent**

```bash
# straight from GitHub — no clone needed
claude mcp add browser-ext-agent -- npx -y github:haipham22/browser-ext-agent

# or from a local clone (while developing)
claude mcp add browser-ext-agent -- node /absolute/path/packages/server/release/index.js
```

Then try: `browser_navigate` → `browser_snapshot` → `browser_click` → `browser_console_logs`.

## Security model

Redaction happens **inside the content script** — the last layer before data leaves your browser. The server and agent never have a code path to the raw values.

Known limits (stated plainly): if a page *displays* a secret as plain text (e.g. a token printed on a dashboard), it can appear in a snapshot — token-pattern redaction mitigates common formats. There are deliberately **no** tools for cookies, localStorage, network traffic or history. Tune the extra guards via `SECRET_CONFIG_PATH` (JSON with `blockedDomains`, `blockedSelectors`, `sensitivePatterns` regexes).

## Architecture

- [`packages/shared`](packages/shared) — zod protocol (commands/responses), central error codes, secret config, scenario schema (v2-ready)
- [`packages/server`](packages/server) — WebSocket server + bridge + 12 MCP tools in one Node process
- [`packages/extension`](packages/extension) — MV3 service worker (WS client, router), content script (snapshot refs, redact, actions, console capture), popup

Design decisions and rationale: [`context/DECISIONS.md`](context/DECISIONS.md). Architecture doc: [`context/ARCHITECTURE.md`](context/ARCHITECTURE.md).

## Development

```bash
pnpm test                                # 16 tests across the 3 packages
pnpm --filter @haipham22/browser-ext-agent-extension exec tsc --noEmit   # typecheck
cd packages/extension && node compile.mjs                                # rebuild extension bundle
```

Planned (v2): scenario runner — a scenario is just a JSON list of steps reusing the same command protocol (`scenarioSchema` is already in `shared`).

## License

[MIT](LICENSE)
