#!/bin/bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd -P)"
. "$SCRIPT_DIR/common.sh"

PORT=9394
PORT_EXPLICIT=false
RESTART_EXISTING=false
PROMPT_RESTART=false
THEME=''
IMAGE=''
IMAGE_OPACITY=''
CLEAR_IMAGE=false
CONFIG_PATH="$CONFIG_PATH_DEFAULT"

while [ "$#" -gt 0 ]; do
  case "$1" in
    --port) PORT="$2"; PORT_EXPLICIT=true; shift 2 ;;
    --restart-existing) RESTART_EXISTING=true; shift ;;
    --prompt-restart) PROMPT_RESTART=true; shift ;;
    --theme) THEME="$2"; shift 2 ;;
    --image) IMAGE="$2"; shift 2 ;;
    --image-opacity) IMAGE_OPACITY="$2"; shift 2 ;;
    --clear-image) CLEAR_IMAGE=true; shift ;;
    --config) CONFIG_PATH="$2"; shift 2 ;;
    *) fail "Unknown argument: $1" ;;
  esac
done
case "$PORT" in ''|*[!0-9]*) fail 'Port must be a number.' ;; esac
[ "$PORT" -ge 1024 ] && [ "$PORT" -le 65535 ] || fail 'Port must be between 1024 and 65535.'

find_node
discover_claude
acquire_lock
trap release_lock EXIT
/bin/mkdir -p "$DATA_ROOT"
"$NODE" "$THEME_CLI" init --config "$CONFIG_PATH" >/dev/null
theme_args=("$THEME_CLI" set --config "$CONFIG_PATH")
[ -z "$THEME" ] || theme_args+=(--theme "$THEME")
[ -z "$IMAGE" ] || theme_args+=(--image "$IMAGE")
[ "$CLEAR_IMAGE" = false ] || theme_args+=(--clear-image)
[ -z "$IMAGE_OPACITY" ] || theme_args+=(--image-opacity "$IMAGE_OPACITY")
[ "${#theme_args[@]}" -eq 4 ] || "$NODE" "${theme_args[@]}" >/dev/null

if [ -f "$STATE_PATH" ]; then
  if [ "$PORT_EXPLICIT" = false ]; then PORT="$(state_get port || printf '%s' "$PORT")"; fi
  stop_recorded_injector || fail 'The saved Aura watcher identity did not match. State was preserved.'
fi

identity="$(cdp_browser_id "$PORT" || true)"
launched=false
closed_existing=false
if [ -z "$identity" ] && claude_is_running; then
  authorized="$RESTART_EXISTING"
  if [ "$authorized" = false ] && [ "$PROMPT_RESTART" = true ]; then
    if confirm_restart; then authorized=true; fi
  fi
  [ "$authorized" = true ] || fail 'Claude is open without a verified Aura CDP endpoint. Close it or pass --restart-existing.'
  stop_claude true
  closed_existing=true
fi

if [ -z "$(cdp_browser_id "$PORT" || true)" ]; then
  if ! port_available "$PORT"; then
    [ "$PORT_EXPLICIT" = false ] || fail "Port $PORT is occupied by an unverified listener."
    PORT="$(select_port "$PORT")"
  fi
  /usr/bin/open -na "$CLAUDE_BUNDLE" --args --remote-debugging-address=127.0.0.1 --remote-debugging-port="$PORT" >/dev/null
  launched=true
fi

deadline=$((SECONDS + 45))
identity="$(cdp_browser_id "$PORT" || true)"
while [ -z "$identity" ] && [ "$SECONDS" -lt "$deadline" ]; do
  /bin/sleep 0.4
  identity="$(cdp_browser_id "$PORT" || true)"
done
if [ -z "$identity" ]; then
  if [ "$launched" = true ]; then stop_claude true || true; fi
  if [ "$closed_existing" = true ] || [ "$launched" = true ]; then /usr/bin/open -na "$CLAUDE_BUNDLE" >/dev/null 2>&1 || true; fi
  fail "Claude did not expose a verified loopback CDP endpoint on port $PORT."
fi

stdout_path="$DATA_ROOT/injector.log"
stderr_path="$DATA_ROOT/injector-error.log"
verify_path="$DATA_ROOT/verify.log"
/usr/bin/nohup "$NODE" "$INJECTOR" --watch --port "$PORT" --browser-id "$identity" --config "$CONFIG_PATH" >>"$stdout_path" 2>>"$stderr_path" &
watcher_pid=$!
/bin/sleep 0.6
if ! /bin/kill -0 "$watcher_pid" 2>/dev/null; then
  [ "$launched" = false ] || { stop_claude true || true; /usr/bin/open -na "$CLAUDE_BUNDLE" >/dev/null 2>&1 || true; }
  fail "The Aura watcher exited during startup. See $stderr_path"
fi

"$NODE" "$STATE_CLI" remove --path "$STATE_PATH" 2>/dev/null || true
"$NODE" "$STATE_CLI" write --path "$STATE_PATH" --platform macos --port "$PORT" --browser-id "$identity" \
  --injector-pid "$watcher_pid" --injector-path "$INJECTOR" --node-path "$NODE" --node-version "$NODE_VERSION" \
  --config-path "$CONFIG_PATH" --claude-bundle "$CLAUDE_BUNDLE" --claude-exe "$CLAUDE_EXE" \
  --claude-version "$CLAUDE_VERSION" --claude-bundle-id "$CLAUDE_BUNDLE_ID" --claude-team-id "$CLAUDE_TEAM_ID"

if ! "$NODE" "$INJECTOR" --verify --port "$PORT" --browser-id "$identity" --config "$CONFIG_PATH" --timeout-ms 30000 >"$verify_path" 2>&1; then
  /bin/kill "$watcher_pid" 2>/dev/null || true
  "$NODE" "$STATE_CLI" remove --path "$STATE_PATH" 2>/dev/null || true
  if [ "$launched" = true ]; then stop_claude true || true; /usr/bin/open -na "$CLAUDE_BUNDLE" >/dev/null 2>&1 || true; fi
  fail "Claude Aura verification failed. See $verify_path"
fi
printf 'Claude Aura is active on verified loopback port %s.\n' "$PORT"

