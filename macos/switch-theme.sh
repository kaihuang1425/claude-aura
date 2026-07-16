#!/bin/bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd -P)"
. "$SCRIPT_DIR/common.sh"

THEME=''
IMAGE=''
IMAGE_OPACITY=''
IMAGE_POSITION=''
CLEAR_IMAGE=false
CHOOSE_IMAGE=false
REDUCE_MOTION=''
CONFIG_PATH="$CONFIG_PATH_DEFAULT"
LIST=false
while [ "$#" -gt 0 ]; do
  case "$1" in
    --theme) THEME="$2"; shift 2 ;;
    --image) IMAGE="$2"; shift 2 ;;
    --choose-image) CHOOSE_IMAGE=true; shift ;;
    --clear-image) CLEAR_IMAGE=true; shift ;;
    --image-opacity) IMAGE_OPACITY="$2"; shift 2 ;;
    --image-position) IMAGE_POSITION="$2"; shift 2 ;;
    --reduce-motion) REDUCE_MOTION="$2"; shift 2 ;;
    --config) CONFIG_PATH="$2"; shift 2 ;;
    --list) LIST=true; shift ;;
    *) fail "Unknown argument: $1" ;;
  esac
done

find_node
acquire_lock
trap release_lock EXIT
/bin/mkdir -p "$DATA_ROOT"
"$NODE" "$THEME_CLI" init --config "$CONFIG_PATH" >/dev/null
if [ "$LIST" = true ]; then "$NODE" "$THEME_CLI" list; exit 0; fi
if [ -z "$THEME" ] && [ -z "$IMAGE" ] && [ "$CHOOSE_IMAGE" = false ] && [ "$CLEAR_IMAGE" = false ] && \
   [ -z "$IMAGE_OPACITY" ] && [ -z "$IMAGE_POSITION" ] && [ -z "$REDUCE_MOTION" ]; then
  "$NODE" "$THEME_CLI" list
  printf 'Theme name: '
  IFS= read -r THEME
  [ -n "$THEME" ] || fail 'Theme selection was cancelled.'
fi
if [ "$CHOOSE_IMAGE" = true ]; then
  IMAGE="$(/usr/bin/osascript -e 'POSIX path of (choose file with prompt "Choose a Claude Aura background image")' 2>/dev/null || true)"
fi
args=("$THEME_CLI" set --config "$CONFIG_PATH")
[ -z "$THEME" ] || args+=(--theme "$THEME")
[ -z "$IMAGE" ] || args+=(--image "$IMAGE")
[ "$CLEAR_IMAGE" = false ] || args+=(--clear-image)
[ -z "$IMAGE_OPACITY" ] || args+=(--image-opacity "$IMAGE_OPACITY")
[ -z "$IMAGE_POSITION" ] || args+=(--image-position "$IMAGE_POSITION")
[ -z "$REDUCE_MOTION" ] || args+=(--reduce-motion "$REDUCE_MOTION")
"$NODE" "${args[@]}"

if [ -f "$STATE_PATH" ]; then
  port="$(state_get port || true)"
  browser_id="$(state_get browser-id || true)"
  config_saved="$(state_get config-path || printf '%s' "$CONFIG_PATH")"
  /bin/sleep 2
  if "$NODE" "$INJECTOR" --verify --port "$port" --browser-id "$browser_id" --config "$config_saved" --timeout-ms 15000 >/dev/null 2>&1; then
    printf 'Theme switched live.\n'
    exit 0
  fi
fi
printf 'Theme saved. It will apply the next time Claude Aura starts.\n'

