#!/bin/bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd -P)"
. "$SCRIPT_DIR/common.sh"

SCREENSHOT=''
MODE='--verify'
while [ "$#" -gt 0 ]; do
  case "$1" in
    --screenshot) SCREENSHOT="$2"; shift 2 ;;
    --diagnose) MODE='--diagnose'; shift ;;
    *) fail "Unknown argument: $1" ;;
  esac
done
find_node
discover_claude
acquire_lock
trap release_lock EXIT
[ -f "$STATE_PATH" ] || fail 'Claude Aura is not active; no state file was found.'
port="$(state_get port)"
browser_id="$(state_get browser-id)"
config_path="$(state_get config-path)"
saved_exe="$(state_get claude-exe)"
[ "$saved_exe" = "$CLAUDE_EXE" ] || fail 'Claude updated or moved after Aura started. Restore or close it, then start Aura again.'
current_id="$(cdp_browser_id "$port" || true)"
[ "$current_id" = "$browser_id" ] || fail 'The saved Claude Aura browser session is no longer active.'
args=("$INJECTOR" "$MODE" --port "$port" --browser-id "$browser_id" --config "$config_path" --timeout-ms 30000)
[ -z "$SCREENSHOT" ] || args+=(--screenshot "$SCREENSHOT")
"$NODE" "${args[@]}"

