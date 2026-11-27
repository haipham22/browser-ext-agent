#!/usr/bin/env bash
# Reload the browser-ext-agent Chrome extension and verify it reconnects.
#
# Requires: orca CLI + Chrome running. The extension's "Enabled" flag persists
# in chrome.storage.local (D19), so a reload keeps it enabled — no popup dance.
#
# Usage: scripts/reload-browser-ext-agent.sh [ws-port]
set -euo pipefail

PORT="${1:-8765}"
APP="com.google.Chrome"
EXT_NAME="Browser Ext Agent"

tree() { orca computer get-app-state --app "$APP" --no-screenshot --json 2>/dev/null | python3 -c "
import json,sys
print(json.load(sys.stdin).get('result',{}).get('snapshot',{}).get('treeText',''))"; }

ws_connected() { lsof -iTCP:"$PORT" -sTCP:ESTABLISHED -P 2>/dev/null | grep -q .; }

# already connected -> nothing to do (still reload on request? no: exit early)
if ws_connected; then
  echo "already connected to ws://localhost:$PORT — reloading anyway"
fi

echo "[1/3] opening chrome://extensions"
addr_idx=$(tree | python3 -c "
import sys,re
for l in sys.stdin:
    m=re.match(r'\s*(\d+)\s+text field \(settable\) Address and search bar',l)
    if m: print(m.group(1)); break")
[ -n "${addr_idx:-}" ] || { echo "FAIL: address bar not found" >&2; exit 1; }
orca computer set-value --app "$APP" --element-index "$addr_idx" --value "chrome://extensions" --no-screenshot --json >/dev/null
orca computer press-key --app "$APP" --key Return --no-screenshot --json >/dev/null
sleep 1.5

echo "[2/3] clicking Reload on the $EXT_NAME card"
reload_idx=$(tree | python3 -c "
import sys,re
lines=sys.stdin.read().split('\n')
for i,l in enumerate(lines):
    if re.search(r'heading $EXT_NAME',l):
        for j in range(i+1,min(i+15,len(lines))):
            m=re.match(r'\s*(\d+)\s+button Reload',lines[j])
            if m: print(m.group(1)); sys.exit()")
[ -n "${reload_idx:-}" ] || { echo "FAIL: $EXT_NAME card/Reload not found" >&2; exit 1; }
orca computer click --app "$APP" --element-index "$reload_idx" --no-screenshot --json >/dev/null

echo "[3/3] waiting for WS connection on port $PORT"
for _ in $(seq 1 20); do
  if ws_connected; then echo "OK: reloaded and connected to ws://localhost:$PORT"; exit 0; fi
  sleep 0.5
done
echo "FAIL: not connected after 10s — bootstrap once: open chrome-extension://<ext-id>/popup.html in a tab and click Enable" >&2
exit 1
