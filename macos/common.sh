#!/bin/bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
STATE_ROOT="${CLAUDE_AURA_STATE_ROOT:-$HOME/Library/Application Support/ClaudeAura}"
DATA_ROOT="$STATE_ROOT/data"
STATE_PATH="$DATA_ROOT/state.json"
CONFIG_PATH_DEFAULT="$DATA_ROOT/config.json"
INJECTOR="$ROOT/scripts/injector.mjs"
THEME_CLI="$ROOT/scripts/theme-cli.mjs"
STATE_CLI="$ROOT/scripts/state-cli.mjs"
EXPECTED_TEAM_ID="${CLAUDE_AURA_EXPECTED_TEAM_ID:-Q6L2SF6YDW}"
LOCK_DIR="$STATE_ROOT/operation.lock"

fail() {
  printf 'Claude Aura: %s\n' "$*" >&2
  exit 1
}

find_node() {
  NODE="$(command -v node || true)"
  [ -n "$NODE" ] || fail 'Node.js 22 or newer was not found in PATH.'
  NODE="$(cd "$(dirname "$NODE")" && pwd -P)/$(basename "$NODE")"
  NODE_VERSION="$($NODE -p 'process.versions.node')"
  NODE_MAJOR="${NODE_VERSION%%.*}"
  case "$NODE_MAJOR" in ''|*[!0-9]*) fail "Could not parse Node.js version: $NODE_VERSION" ;; esac
  [ "$NODE_MAJOR" -ge 22 ] || fail "Node.js 22 or newer is required; found $NODE_VERSION."
  export NODE NODE_VERSION
}

team_id_for() {
  /usr/bin/codesign -dv --verbose=4 "$1" 2>&1 | /usr/bin/awk -F= '/^TeamIdentifier=/{print $2; exit}'
}

discover_claude() {
  local candidates=()
  [ -z "${CLAUDE_APP_BUNDLE:-}" ] || candidates+=("$CLAUDE_APP_BUNDLE")
  candidates+=("/Applications/Claude.app" "$HOME/Applications/Claude.app")
  CLAUDE_BUNDLE=''
  local candidate identifier executable_name team
  for candidate in "${candidates[@]}"; do
    [ -f "$candidate/Contents/Info.plist" ] || continue
    identifier="$(/usr/bin/plutil -extract CFBundleIdentifier raw -o - "$candidate/Contents/Info.plist" 2>/dev/null || true)"
    identifier_lower="$(printf '%s' "$identifier" | /usr/bin/tr '[:upper:]' '[:lower:]')"
    case "$identifier_lower" in
      com.anthropic.claude|com.anthropic.claudefordesktop) ;;
      *) continue ;;
    esac
    /usr/bin/codesign --verify --deep --strict "$candidate" >/dev/null 2>&1 || continue
    team="$(team_id_for "$candidate")"
    [ "$team" = "$EXPECTED_TEAM_ID" ] || continue
    CLAUDE_BUNDLE="$candidate"
    CLAUDE_BUNDLE_ID="$identifier"
    CLAUDE_TEAM_ID="$team"
    break
  done
  [ -n "$CLAUDE_BUNDLE" ] || fail 'The official Anthropic-signed Claude.app could not be found in /Applications or ~/Applications.'
  executable_name="$(/usr/bin/plutil -extract CFBundleExecutable raw -o - "$CLAUDE_BUNDLE/Contents/Info.plist")"
  CLAUDE_EXE="$CLAUDE_BUNDLE/Contents/MacOS/$executable_name"
  CLAUDE_VERSION="$(/usr/bin/plutil -extract CFBundleShortVersionString raw -o - "$CLAUDE_BUNDLE/Contents/Info.plist" 2>/dev/null || printf unknown)"
  [ -x "$CLAUDE_EXE" ] || fail "Claude executable is missing: $CLAUDE_EXE"
  export CLAUDE_BUNDLE CLAUDE_BUNDLE_ID CLAUDE_TEAM_ID CLAUDE_EXE CLAUDE_VERSION
}

acquire_lock() {
  /bin/mkdir -p "$STATE_ROOT"
  if /bin/mkdir "$LOCK_DIR" 2>/dev/null; then
    printf '%s\n' "$$" > "$LOCK_DIR/pid"
    return
  fi
  local owner=''
  [ ! -f "$LOCK_DIR/pid" ] || owner="$(/bin/cat "$LOCK_DIR/pid" 2>/dev/null || true)"
  if [ -n "$owner" ] && /bin/kill -0 "$owner" 2>/dev/null; then
    fail 'Another Claude Aura operation is already running.'
  fi
  /bin/rm -f "$LOCK_DIR/pid" 2>/dev/null || true
  /bin/rmdir "$LOCK_DIR" 2>/dev/null || fail 'A stale operation lock could not be removed.'
  /bin/mkdir "$LOCK_DIR" || fail 'Could not acquire the operation lock.'
  printf '%s\n' "$$" > "$LOCK_DIR/pid"
}

release_lock() {
  /bin/rm -f "$LOCK_DIR/pid" 2>/dev/null || true
  /bin/rmdir "$LOCK_DIR" 2>/dev/null || true
}

process_executable() {
  /usr/sbin/lsof -a -p "$1" -d txt -Fn 2>/dev/null | /usr/bin/sed -n 's/^n//p' | /usr/bin/head -n 1
}

claude_pids() {
  local pid executable
  while IFS= read -r pid; do
    [ -n "$pid" ] || continue
    executable="$(process_executable "$pid")"
    [ "$executable" = "$CLAUDE_EXE" ] && printf '%s\n' "$pid"
  done < <(/usr/bin/pgrep -f "$CLAUDE_EXE" 2>/dev/null || true)
}

claude_is_running() {
  [ -n "$(claude_pids | /usr/bin/head -n 1)" ]
}

stop_claude() {
  local allow_force="${1:-false}"
  claude_is_running || return 0
  /usr/bin/osascript -e "tell application id \"$CLAUDE_BUNDLE_ID\" to quit" >/dev/null 2>&1 || true
  local deadline=$((SECONDS + 15))
  while claude_is_running && [ "$SECONDS" -lt "$deadline" ]; do /bin/sleep 0.25; done
  claude_is_running || return 0
  [ "$allow_force" = 'true' ] || fail 'Claude did not close within 15 seconds; explicit restart authorization is required.'
  local pid executable
  while IFS= read -r pid; do
    executable="$(process_executable "$pid")"
    [ "$executable" = "$CLAUDE_EXE" ] && /bin/kill "$pid" 2>/dev/null || true
  done < <(claude_pids)
  /bin/sleep 1
  while IFS= read -r pid; do
    executable="$(process_executable "$pid")"
    [ "$executable" = "$CLAUDE_EXE" ] && /bin/kill -9 "$pid" 2>/dev/null || true
  done < <(claude_pids)
  /bin/sleep 0.3
  claude_is_running && fail 'Claude could not be stopped safely.'
}

port_listeners() {
  /usr/sbin/lsof -nP -iTCP:"$1" -sTCP:LISTEN -t 2>/dev/null | /usr/bin/sort -u || true
}

port_available() {
  [ -z "$(port_listeners "$1")" ]
}

select_port() {
  local candidate="$1" limit=$((1 + $1 + 100))
  [ "$limit" -gt 65536 ] && limit=65536
  while [ "$candidate" -lt "$limit" ]; do
    if port_available "$candidate"; then printf '%s\n' "$candidate"; return; fi
    candidate=$((candidate + 1))
  done
  fail "No free loopback port was found near $1."
}

port_owned_by_claude() {
  local port="$1" pid executable details
  details="$(/usr/sbin/lsof -nP -iTCP:"$port" -sTCP:LISTEN -Fp -Fn 2>/dev/null || true)"
  [ -n "$details" ] || return 1
  printf '%s\n' "$details" | /usr/bin/grep -Eq "^n(127\\.0\\.0\\.1|\\[::1\\]):$port$" || return 1
  while IFS= read -r pid; do
    [ -n "$pid" ] || continue
    executable="$(process_executable "$pid")"
    [ "$executable" = "$CLAUDE_EXE" ] || return 1
  done < <(printf '%s\n' "$details" | /usr/bin/sed -n 's/^p//p' | /usr/bin/sort -u)
}

cdp_browser_id() {
  local port="$1" version
  port_owned_by_claude "$port" || return 1
  version="$(/usr/bin/curl --silent --show-error --fail --max-time 2 "http://127.0.0.1:$port/json/version" 2>/dev/null)" || return 1
  printf '%s' "$version" | "$NODE" -e '
    let source="";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", chunk => source += chunk);
    process.stdin.on("end", () => {
      try {
        const port = Number(process.argv[1]);
        const data = JSON.parse(source);
        const url = new URL(data.webSocketDebuggerUrl);
        const match = url.pathname.match(/^\/devtools\/browser\/([A-Za-z0-9._-]{1,200})$/);
        const loopback = ["127.0.0.1", "localhost", "::1", "[::1]"].includes(url.hostname);
        if (url.protocol !== "ws:" || Number(url.port) !== port || !loopback || url.username || url.password || url.search || url.hash || !match) process.exit(2);
        process.stdout.write(match[1]);
      } catch { process.exit(2); }
    });
  ' "$port" || return 1
  port_owned_by_claude "$port"
}

state_get() {
  "$NODE" "$STATE_CLI" get --path "$STATE_PATH" --field "$1" 2>/dev/null
}

stop_recorded_injector() {
  [ -f "$STATE_PATH" ] || return 0
  local pid node_path injector_path port browser_id command executable
  pid="$(state_get injector-pid || true)"
  [ -n "$pid" ] || return 0
  /bin/kill -0 "$pid" 2>/dev/null || return 0
  node_path="$(state_get node-path || true)"
  injector_path="$(state_get injector-path || true)"
  port="$(state_get port || true)"
  browser_id="$(state_get browser-id || true)"
  command="$(/bin/ps -p "$pid" -o command= 2>/dev/null || true)"
  executable="$(process_executable "$pid")"
  [ "$executable" = "$node_path" ] || return 1
  case "$command" in *"$injector_path"*'--watch'*'--port '"$port"*'--browser-id '"$browser_id"*) ;; *) return 1 ;; esac
  /bin/kill "$pid" 2>/dev/null || true
  local deadline=$((SECONDS + 5))
  while /bin/kill -0 "$pid" 2>/dev/null && [ "$SECONDS" -lt "$deadline" ]; do /bin/sleep 0.2; done
  /bin/kill -0 "$pid" 2>/dev/null && /bin/kill -9 "$pid" 2>/dev/null || true
  ! /bin/kill -0 "$pid" 2>/dev/null
}

confirm_restart() {
  /usr/bin/osascript -e 'display dialog "Claude must restart once to enable Claude Aura. Unsaved input may be lost." buttons {"Cancel", "Restart and apply"} default button "Restart and apply" with title "Claude Aura"' >/dev/null 2>&1
}
