#!/bin/bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd -P)"
. "$SCRIPT_DIR/common.sh"

find_node
discover_claude
acquire_lock
trap release_lock EXIT
THEME_JSON_NAMES=(
  registry.json default.json japanese-film-editorial.json korean-prestige.json
  cartoon-studio.json anime-twilight.json study-library.json japanese-idol.json
  korean-idol.json midnight.json ember.json forest.json sakura.json
)
CANONICAL_THEME_IDS=(
  default japanese-film-editorial korean-prestige cartoon-studio
  anime-twilight study-library japanese-idol korean-idol
)
DOCUMENTATION_NAMES=(
  ACCEPTANCE_AUDIT.md FILE_MANIFEST.md IMPLEMENTATION_REPORT.md
  SCREENSHOT_PLAN.md THEME_KIT_SPEC.md THEMING.md TROUBLESHOOTING.md
  WINDOWS_INSTALLER.md
)
if [ -e "$ROOT/.git" ]; then
  "$NODE" "$ROOT/tests/run-tests.mjs"
else
  for theme_id in "${CANONICAL_THEME_IDS[@]}"; do
    "$NODE" "$ROOT/scripts/theme-cli.mjs" validate --theme "$theme_id" >/dev/null
  done
fi
INSTALL_ROOT="$STATE_ROOT/app"
/bin/mkdir -p "$STATE_ROOT" "$DATA_ROOT"
if [ "$ROOT" != "$INSTALL_ROOT" ]; then
  /bin/mkdir -p "$INSTALL_ROOT"
  for directory in assets macos scripts studio tests vendor windows; do
    /usr/bin/ditto "$ROOT/$directory" "$INSTALL_ROOT/$directory"
  done
  /bin/mkdir -p "$INSTALL_ROOT/themes"
  for theme_json_name in "${THEME_JSON_NAMES[@]}"; do
    [ -f "$ROOT/themes/$theme_json_name" ] || { printf 'Required theme descriptor is missing: %s\n' "$ROOT/themes/$theme_json_name" >&2; exit 1; }
    /bin/cp "$ROOT/themes/$theme_json_name" "$INSTALL_ROOT/themes/$theme_json_name"
  done
  /bin/mkdir -p "$INSTALL_ROOT/docs"
  for documentation_name in "${DOCUMENTATION_NAMES[@]}"; do
    [ -f "$ROOT/docs/$documentation_name" ] || { printf 'Required documentation is missing: %s\n' "$ROOT/docs/$documentation_name" >&2; exit 1; }
    /bin/cp "$ROOT/docs/$documentation_name" "$INSTALL_ROOT/docs/$documentation_name"
  done
  for installed_documentation in "$INSTALL_ROOT"/docs/*; do
    [ -e "$installed_documentation" ] || continue
    documentation_name="$(basename "$installed_documentation")"
    keep_documentation=0
    for allowed_documentation_name in "${DOCUMENTATION_NAMES[@]}"; do
      [ "$documentation_name" != "$allowed_documentation_name" ] || { keep_documentation=1; break; }
    done
    [ "$keep_documentation" -eq 0 ] || continue
    case "$installed_documentation" in
      "$INSTALL_ROOT"/docs/*) /bin/rm -rf -- "$installed_documentation" ;;
      *) printf 'Refusing to remove path outside Aura installation: %s\n' "$installed_documentation" >&2; exit 1 ;;
    esac
  done
  for file in README.md SECURITY.md NOTICE.md THIRD_PARTY_NOTICES.md LICENSE package.json config.example.json \
    'Install Claude Aura.cmd' 'Install Claude Aura.command' 'Uninstall Claude Aura.cmd'; do
    [ ! -f "$ROOT/$file" ] || /bin/cp "$ROOT/$file" "$INSTALL_ROOT/$file"
  done
fi
/bin/mkdir -p "$INSTALL_ROOT/themes"
for theme_entry in "$INSTALL_ROOT"/themes/*; do
  [ -e "$theme_entry" ] || continue
  theme_name="$(basename "$theme_entry")"
  keep_theme=0
  for theme_json_name in "${THEME_JSON_NAMES[@]}"; do
    [ "$theme_name" != "$theme_json_name" ] || { keep_theme=1; break; }
  done
  [ "$keep_theme" -eq 0 ] || continue
  case "$theme_entry" in
    "$INSTALL_ROOT"/themes/*) /bin/rm -rf -- "$theme_entry" ;;
    *) printf 'Refusing to remove path outside Aura installation: %s\n' "$theme_entry" >&2; exit 1 ;;
  esac
done
for obsolete_path in \
  "$INSTALL_ROOT/preview" \
  "$INSTALL_ROOT/scripts/build-preview.mjs" \
  "$INSTALL_ROOT/scripts/preview-server.mjs" \
  "$INSTALL_ROOT/scripts/qa-board.mjs" \
  "$INSTALL_ROOT/docs/preview.png" \
  "$INSTALL_ROOT/docs/golden" \
  "$INSTALL_ROOT/docs/theme-screenshots" \
  "$INSTALL_ROOT/tests/fixtures" \
  "$INSTALL_ROOT/dist/qa" \
  "$INSTALL_ROOT/assets/studio-previews/references" \
  "$INSTALL_ROOT/assets/theme-art/japanese-film-editorial.svg" \
  "$INSTALL_ROOT/assets/theme-art/japanese-film-editorial/hero.webp" \
  "$INSTALL_ROOT/assets/theme-art/korean-prestige.svg" \
  "$INSTALL_ROOT/assets/theme-art/korean-idol/background.webp" \
  "$INSTALL_ROOT/assets/theme-art/korean-idol/constellation.webp" \
  "$INSTALL_ROOT/assets/theme-art/kawaii-idol/mark.svg" \
  "$INSTALL_ROOT/assets/theme-art/kawaii-idol/sakura-bottom-right.webp" \
  "$INSTALL_ROOT/assets/theme-art/kawaii-idol/sakura-top-right.webp" \
  "$INSTALL_ROOT/assets/theme-art/kawaii-idol/card-analyze.svg" \
  "$INSTALL_ROOT/assets/theme-art/kawaii-idol/card-brainstorm.svg" \
  "$INSTALL_ROOT/assets/theme-art/kawaii-idol/card-continue.svg" \
  "$INSTALL_ROOT/assets/theme-art/kawaii-idol/keep-shining-sticker.svg" \
  "$INSTALL_ROOT/assets/theme-art/kawaii-idol/logo-horizontal.svg" \
  "$INSTALL_ROOT/assets/theme-art/kawaii-idol/note-heart.svg" \
  "$INSTALL_ROOT/assets/theme-art/kawaii-idol/signature-hinata.svg" \
  "$INSTALL_ROOT/assets/theme-art/kawaii-idol/sparkle-8.svg" \
  "$INSTALL_ROOT/assets/theme-art/kawaii-idol/sparkle-cluster.svg" \
  "$INSTALL_ROOT/assets/theme-art/kawaii-idol/sparkle-soft.svg" \
  "$INSTALL_ROOT/assets/theme-art/kawaii-idol/star-outline.svg"; do
  case "$obsolete_path" in
    "$INSTALL_ROOT"/*) /bin/rm -rf -- "$obsolete_path" ;;
    *) printf 'Refusing to remove path outside Aura installation: %s\n' "$obsolete_path" >&2; exit 1 ;;
  esac
done
INSTALLED_VERIFY_ROOT="$INSTALL_ROOT/dist/verify"
if [ -d "$INSTALLED_VERIFY_ROOT" ]; then
  for verify_entry in "$INSTALLED_VERIFY_ROOT"/*; do
    [ -e "$verify_entry" ] || continue
    verify_name="$(basename "$verify_entry")"
    case "$verify_name" in
      live-aura|live-content-audit|wo17-icon|*-live-content.avif|*-live-content.jpg|*-live-content.jpeg|*-live-content.png|*-live-content.webp) continue ;;
    esac
    case "$verify_entry" in
      "$INSTALLED_VERIFY_ROOT"/*) /bin/rm -rf -- "$verify_entry" ;;
      *) printf 'Refusing to remove path outside Aura installation: %s\n' "$verify_entry" >&2; exit 1 ;;
    esac
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
