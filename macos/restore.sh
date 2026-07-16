#!/bin/bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd -P)"
. "$SCRIPT_DIR/common.sh"

LEAVE_CLOSED=false
[ "${1:-}" != '--leave-closed' ] || LEAVE_CLOSED=true
find_node
discover_claude
acquire_lock
trap release_lock EXIT
if [ ! -f "$STATE_PATH" ]; then printf 'Claude Aura is not active. Nothing was changed.\n'; exit 0; fi
stop_recorded_injector || fail 'The saved watcher identity did not match. State was preserved.'
port="$(state_get port)"
browser_id="$(state_get browser-id)"
saved_exe="$(state_get claude-exe)"
if [ "$saved_exe" = "$CLAUDE_EXE" ]; then
  current_id="$(cdp_browser_id "$port" || true)"
  if [ -n "$current_id" ]; then
    [ "$current_id" = "$browser_id" ] || fail 'The saved port belongs to a different Claude browser session. State was preserved.'
    "$NODE" "$INJECTOR" --remove --port "$port" --browser-id "$browser_id" --timeout-ms 5000 >/dev/null 2>&1 || true
    stop_claude true
    [ "$LEAVE_CLOSED" = true ] || /usr/bin/open -na "$CLAUDE_BUNDLE" >/dev/null
  elif ! port_available "$port"; then
    fail 'The saved CDP port is occupied by an unverified listener. State was preserved.'
  elif [ "$LEAVE_CLOSED" = false ] && ! claude_is_running; then
    /usr/bin/open -na "$CLAUDE_BUNDLE" >/dev/null
  fi
else
  port_available "$port" || fail 'Claude updated while the old debug session is still open. Close that Claude window manually; state was preserved.'
  printf 'Warning: Claude updated after Aura started; the old session is closed, so stale state is safe to remove.\n' >&2
  if [ "$LEAVE_CLOSED" = false ] && ! claude_is_running; then /usr/bin/open -na "$CLAUDE_BUNDLE" >/dev/null; fi
fi
"$NODE" "$STATE_CLI" remove --path "$STATE_PATH"
if [ "$LEAVE_CLOSED" = true ]; then
  printf 'Claude Aura was removed and Claude was left closed.\n'
else
  printf 'Claude Aura was removed and Claude was reopened normally.\n'
fi
