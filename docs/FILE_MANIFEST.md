# Deliverable file manifest

The `work/full-theme-system` branch has no tracked baseline commit, so Git cannot
reliably classify paths as created versus modified. The list below is the
exhaustive current deliverable surface, excluding generated release output,
local agent metadata, and the unsafe reference composites. The retired
reconstructed offline-preview files, preview-only artwork, and comparison
screenshots are not deliverables.

## Agent operations

- `AGENTS.md`
- `docs/PROGRESS.md`
- `docs/THEME_KIT_SPEC.md`
- `docs/contracts/ASSET_CONTRACT.md`
- `docs/plans/BLOCKED.md`
- `docs/plans/QUEUE.md`
- `docs/plans/WORK_ORDERS.md`
- `docs/recipes/RECIPES.md`

## Aura Studio (hosted by WO-05)

- `studio/app.js`
- `studio/generated-themes.js`
- `studio/index.html`
- `studio/styles.css`

## Repository and policy

- `.github/ISSUE_TEMPLATE/bug.yml`
- `.github/workflows/ci.yml`
- `.gitignore`
- `config.example.json`
- `CONTRIBUTING.md`
- `Install Claude Aura.cmd`
- `Install Claude Aura.command`
- `LICENSE`
- `NOTICE.md`
- `package.json`
- `README.md`
- `SECURITY.md`
- `THIRD_PARTY_NOTICES.md`
- `Uninstall Claude Aura.cmd`

## Renderer and artwork

- `assets/base.css`
- `assets/brand/aura-mark.svg`
- `assets/brand/claude-aura.ico`
- `assets/renderer-inject.js`
- `assets/theme-variants.css`
- `assets/theme-art/README.md`

### Japanese Film Editorial runtime assets

Appearance-specific paper/ink backgrounds and portraits, derived
from the ignored source kit under `themes/japanese-film-editorial/`. The dark
background is independently authored rather than a tinted light layer.

- `assets/theme-art/japanese-film-editorial/light-background.webp`
- `assets/theme-art/japanese-film-editorial/dark-background.webp`
- `assets/theme-art/japanese-film-editorial/light-hero.webp`
- `assets/theme-art/japanese-film-editorial/dark-hero.webp`

### Korean Prestige runtime assets

Appearance-specific architectural backgrounds and clean-alpha portraits. The
approved dark background is retained from `themes/korean-prestige/`; the light
scene and matched portrait twins are independently authored derivatives.

- `assets/theme-art/korean-prestige/light-background.webp`
- `assets/theme-art/korean-prestige/light-hero.webp`
- `assets/theme-art/korean-prestige/dark-background.webp`
- `assets/theme-art/korean-prestige/dark-hero.webp`

### Cartoon Studio runtime assets

Derived inert artwork layers for the Cartoon Studio theme. The ignored source
kit lives under `themes/cartoon-studio/`; these WebPs are rebuilt with
`node scripts/convert-theme-assets.mjs cartoon-studio`.

- `assets/theme-art/cartoon-studio/background.webp`
- `assets/theme-art/cartoon-studio/dark-background.webp`
- `assets/theme-art/cartoon-studio/hero.webp`

### Anime Twilight runtime assets

Derived inert artwork for the Anime Twilight theme. The ignored PNG source kit
lives under `themes/anime-twilight/`; this WebP is rebuilt with
`node scripts/convert-theme-assets.mjs anime-twilight`.

- `assets/theme-art/anime-twilight/background.webp`

### Study Library runtime assets

Derived inert artwork for the Study Library theme. The ignored PNG source kit
lives under `themes/study-library/`; these WebPs are rebuilt with
`node scripts/convert-theme-assets.mjs study-library`.

- `assets/theme-art/study-library/background.webp`
- `assets/theme-art/study-library/corner-bottom.webp`
- `assets/theme-art/study-library/dark-background.webp`

### Aura Studio selector thumbnails

Small 640 × 360 WebP derivatives used only by the local Studio theme cards.
The raw reference composites remain gitignored and are not distributed.

- `assets/theme-art/anime-twilight/card-preview.webp`
- `assets/theme-art/cartoon-studio/card-preview.webp`
- `assets/theme-art/japanese-film-editorial/card-preview.webp`
- `assets/theme-art/japanese-idol/card-preview.webp`
- `assets/theme-art/korean-idol/card-preview.webp`
- `assets/theme-art/korean-prestige/card-preview.webp`
- `assets/theme-art/study-library/card-preview.webp`

### Korean Idol runtime assets

Derived light and context-specific dark artwork from the gitignored source kit
`themes/korean-idol/`. The dark new-chat and conversation scenes are mutually
exclusive at runtime.

- `assets/theme-art/korean-idol/dark-conversation.webp`
- `assets/theme-art/korean-idol/dark-new-chat.webp`
- `assets/theme-art/korean-idol/hero.webp`
- `assets/theme-art/korean-idol/light-scene.webp`

### Japanese Idol runtime assets

Derived, isolated decorative assets for the Japanese Idol theme. The originals
live in the gitignored source kit `themes/japanese-idol/`; the WebP copies are
regenerated with `node scripts/convert-theme-assets.mjs`. Light appearance uses
the background and portrait layers. Dark appearance uses mutually exclusive,
full-bleed new-chat and conversation scenes with purpose-built night lighting.
Superseded sakura/mark derivatives and the eleven SVGs that existed only for
the retired reconstructed preview are not deliverables.

- `assets/theme-art/kawaii-idol/background.webp`
- `assets/theme-art/kawaii-idol/dark-conversation.webp`
- `assets/theme-art/kawaii-idol/dark-new-chat.webp`
- `assets/theme-art/kawaii-idol/hero.webp`

## Themes

- `themes/registry.json`
- `themes/default.json`
- `themes/japanese-film-editorial.json`
- `themes/korean-prestige.json`
- `themes/cartoon-studio.json`
- `themes/anime-twilight.json`
- `themes/study-library.json`
- `themes/japanese-idol.json`
- `themes/korean-idol.json`
- `themes/midnight.json`
- `themes/ember.json`
- `themes/forest.json`
- `themes/sakura.json`

## Compiler, commands, and verification

- `scripts/asset-audit.mjs`
- `scripts/build-aura-icon.mjs`
- `scripts/build-studio-themes.mjs`
- `scripts/build-release.mjs`
- `scripts/convert-theme-assets.mjs`
- `scripts/injector.mjs`
- `scripts/state-cli.mjs`
- `scripts/theme-cli.mjs`
- `scripts/theme-core.mjs`
- `scripts/verify-cycle.mjs`
- `scripts/webview-cli.mjs`
- `tests/run-tests.mjs`

## Windows application

- `windows/aura-ui.ps1`
- `windows/common.ps1`
- `windows/install.ps1`
- `windows/restore.ps1`
- `windows/start.ps1`
- `windows/switch-theme.ps1`
- `windows/ui-copy.json`
- `windows/uninstall.ps1`
- `windows/verify.ps1`

## macOS compatibility

- `macos/common.sh`
- `macos/install.sh`
- `macos/restore.sh`
- `macos/start.sh`
- `macos/switch-theme.sh`
- `macos/verify.sh`
- `macos/launchers/Claude Aura.command`
- `macos/launchers/Claude Aura - Restore.command`
- `macos/launchers/Claude Aura - Switch Theme.command`

## Documentation

- `docs/ACCEPTANCE_AUDIT.md`
- `docs/FILE_MANIFEST.md`
- `docs/IMPLEMENTATION_REPORT.md`
- `docs/SCREENSHOT_PLAN.md`
- `docs/THEMING.md`
- `docs/TROUBLESHOOTING.md`

## Vendored WebView2 runtime integration

- `vendor/webview2/LICENSE.txt`
- `vendor/webview2/NOTICE.txt`
- `vendor/webview2/Microsoft.Web.WebView2.Core.dll`
- `vendor/webview2/Microsoft.Web.WebView2.WinForms.dll`
- `vendor/webview2/WebView2Loader.dll`
- `vendor/webview2/runtimes/arm64/WebView2Loader.dll`
- `vendor/webview2/runtimes/x64/WebView2Loader.dll`
- `vendor/webview2/runtimes/x86/WebView2Loader.dll`
