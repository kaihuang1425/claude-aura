#!/bin/bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd -P)"
. "$SCRIPT_DIR/common.sh"

find_node
discover_claude
acquire_lock
trap release_lock EXIT
"$NODE" "$ROOT/tests/run-tests.mjs"
INSTALL_ROOT="$STATE_ROOT/app"
/bin/mkdir -p "$STATE_ROOT" "$DATA_ROOT"
if [ "$ROOT" != "$INSTALL_ROOT" ]; then
  /bin/mkdir -p "$INSTALL_ROOT"
  for directory in assets macos preview scripts studio themes tests vendor windows; do
    /usr/bin/ditto "$ROOT/$directory" "$INSTALL_ROOT/$directory"
  done
  /bin/mkdir -p "$INSTALL_ROOT/docs"
  /bin/cp "$ROOT"/docs/*.md "$INSTALL_ROOT/docs/"
  for file in README.md SECURITY.md NOTICE.md THIRD_PARTY_NOTICES.md LICENSE package.json config.example.json \
    'Install Claude Aura.cmd' 'Install Claude Aura.command' 'Uninstall Claude Aura.cmd'; do
    [ ! -f "$ROOT/$file" ] || /bin/cp "$ROOT/$file" "$INSTALL_ROOT/$file"
  done
fi
/bin/chmod +x "$INSTALL_ROOT"/macos/*.sh "$INSTALL_ROOT"/macos/launchers/*.command "$INSTALL_ROOT"/*.command 2>/dev/null || true
"$NODE" "$INSTALL_ROOT/scripts/theme-cli.mjs" init --config "$DATA_ROOT/config.json" >/dev/null
/bin/mkdir -p "$HOME/Desktop"
for launcher in "$INSTALL_ROOT"/macos/launchers/*.command; do
  /bin/cp "$launcher" "$HOME/Desktop/$(basename "$launcher")"
  /bin/chmod +x "$HOME/Desktop/$(basename "$launcher")"
done
printf 'Claude Aura installed at %s\n' "$INSTALL_ROOT"
printf 'Use Claude Aura.command on your Desktop to launch it.\n'
