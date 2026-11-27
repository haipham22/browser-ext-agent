# SETUP — from clone to running

Zero to your agent driving your browser: ~5 minutes.

## Prerequisites

| Need | Notes |
|---|---|
| Node.js ≥ 20 | [nodejs.org](https://nodejs.org) or `mise use node@20` |
| pnpm ≥ 9 | `corepack enable` (bundled with Node) or `npm i -g pnpm` |
| Chrome / Edge / Brave | Recent build (MV3 service worker + WebSocket keep-alive needs Chrome ≥ 116) |
| Claude Code (or any MCP client) | So the agent can call the tools |

## 1. Clone, install, compile

```bash
git clone https://github.com/haipham22/browser-ext-agent.git
cd browser-ext-agent
pnpm install
pnpm build                       # typecheck + bundle the server into packages/server/release/
cd packages/extension && node compile.mjs   # bundle the extension into packages/extension/release/
cd ../..
```

## 2. Load the extension into Chrome

1. Open `chrome://extensions`
2. Toggle **Developer mode** (top right)
3. **Load unpacked** → pick the `packages/extension/release/` folder
4. (Recommended) Pin the extension to the toolbar

## 3. Run the server

```bash
node packages/server/release/index.js
```

Expected log: `[browser-ext-agent] MCP ready (stdio) | WS ws://localhost:8765 | token: none`

Different port/bind:

```bash
node packages/server/release/index.js --port 9000              # different port
node packages/server/release/index.js --host 0.0.0.0 --token <secret>   # browser on another machine
```

Env equivalents: `PORT`, `HOST`, `EXT_TOKEN` (see `deployment/.env.example`).

## 4. Connect the extension to the server

Click the **Browser Ext Agent** icon in the toolbar:

- **Server URL**: keep the default `ws://localhost:8765` (change it if the server runs on another machine)
- **Token**: fill in if the server requires one
- Press **Enable** → badge shows **ON** when connected

> The extension is OFF by default. The agent cannot enable itself — by design, you are the gatekeeper.

## 5. Register the MCP server with your agent

```bash
claude mcp add browser-ext-agent -- node /absolute/path/to/browser-ext-agent/packages/server/release/index.js
```

(Use the absolute path where you cloned. Restart your Claude Code session.)

## 6. Try it

In the agent session, call the tools in order:

```
browser_navigate  { "url": "https://example.com" }
browser_snapshot  {}
browser_click     { "ref": "e12" }        # ref comes from the snapshot
browser_console_logs {}
```

Real-world prompt example: *"Open news.ycombinator.com and list the newest stories"* — the agent will navigate → snapshot (paging through if the page is long) → read.

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| Tool returns `extension is not connected` | Server not running, or wrong URL/token in the popup — fix it, then Enable again |
| Tool returns `extension is turned off` | Open the popup, press **Enable** |
| Extension missing after Load unpacked | Check step 1 (does `release/manifest.json` exist?); note Google Chrome branded ≥137 blocks the `--load-extension` CLI flag — the UI button ("Load unpacked") is unaffected |
| Badge OFF despite Enable | Server isn't listening on that port — check the step-3 log |
| Snapshot footer shows `(... of N entries — next page ...)` | Long page — call `browser_snapshot {offset: <number from the footer>}` |
| Want to block sensitive domains | Create a JSON config (`blockedDomains`, `blockedSelectors`, `sensitivePatterns`) and start the server with `SECRET_CONFIG_PATH=/path/to/file.json` |

## Tests / development

```bash
pnpm test                                   # 16 unit tests
pnpm --filter @haipham22/browser-ext-agent-extension exec tsc --noEmit   # typecheck
cd packages/extension && node compile.mjs --watch  # rebuild the extension on change
pnpm dev:server                             # run the server from TS with auto-restart
```

Architecture: [`context/ARCHITECTURE.md`](context/ARCHITECTURE.md) · Design decisions: [`context/DECISIONS.md`](context/DECISIONS.md) · License: [MIT](LICENSE)
