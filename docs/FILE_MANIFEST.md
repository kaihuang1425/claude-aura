# Deliverable file manifest

The `work/full-theme-system` branch has no tracked baseline commit, so Git cannot
reliably classify paths as created versus modified. The list below is the
exhaustive current deliverable surface, excluding generated release output,
local agent metadata, the unsafe reference composites, and the obsolete ignored
`docs/preview.png`. The comparison screenshots were captured on 2026-07-17 and
are listed under Visual evidence below.

## Agent operations

- `AGENTS.md`
- `docs/PROGRESS.md`
- `docs/THEME_KIT_SPEC.md`
- `docs/contracts/ASSET_CONTRACT.md`
- `docs/golden/README.md`
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
- `assets/renderer-inject.js`
- `assets/theme-variants.css`
- `assets/theme-art/README.md`
- `assets/theme-art/anime-twilight.svg`
- `assets/theme-art/cartoon-studio.svg`
- `assets/theme-art/japanese-film-editorial.svg`
- `assets/theme-art/korean-prestige.svg`
- `assets/theme-art/study-library.svg`

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

### Kawaii idol runtime assets

Derived, isolated decorative assets for the japanese-idol (kawaii idol) theme —
the runtime layered artwork (WebP) and the preview showcase (SVG motifs). The
originals live in the gitignored source kit `themes/japanese-idol/`; the WebP
copies are regenerated with `node scripts/convert-theme-assets.mjs`.

- `assets/theme-art/korean-idol/background.webp`
- `assets/theme-art/korean-idol/constellation.webp`
- `assets/theme-art/korean-idol/hero.webp`
- `assets/theme-art/kawaii-idol/logo-horizontal.svg`
- `assets/theme-art/kawaii-idol/mark.svg`
- `assets/theme-art/kawaii-idol/sparkle-cluster.svg`
- `assets/theme-art/kawaii-idol/sparkle-soft.svg`
- `assets/theme-art/kawaii-idol/sparkle-8.svg`
- `assets/theme-art/kawaii-idol/star-outline.svg`
- `assets/theme-art/kawaii-idol/note-heart.svg`
- `assets/theme-art/kawaii-idol/signature-hinata.svg`
- `assets/theme-art/kawaii-idol/keep-shining-sticker.svg`
- `assets/theme-art/kawaii-idol/card-brainstorm.svg`
- `assets/theme-art/kawaii-idol/card-continue.svg`
- `assets/theme-art/kawaii-idol/card-analyze.svg`
- `assets/theme-art/kawaii-idol/background.webp`
- `assets/theme-art/kawaii-idol/hero.webp`
- `assets/theme-art/kawaii-idol/sakura-bottom-right.webp`
- `assets/theme-art/kawaii-idol/sakura-top-right.webp`

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

- `scripts/build-preview.mjs`
- `scripts/build-release.mjs`
- `scripts/convert-theme-assets.mjs`
- `scripts/injector.mjs`
- `scripts/preview-server.mjs`
- `scripts/qa-board.mjs`
- `scripts/state-cli.mjs`
- `scripts/theme-cli.mjs`
- `scripts/theme-core.mjs`
- `scripts/verify-cycle.mjs`
- `scripts/webview-cli.mjs`
- `tests/fixtures/claude-dom.html`
- `tests/run-tests.mjs`

## Offline QA

- `preview/app.js`
- `preview/generated-themes.js`
- `preview/index.html`
- `preview/styles.css`

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

## Visual evidence

### User-approved payload goldens

- `docs/golden/REFERENCE_LOCK.md`
- `docs/golden/anime-twilight/anime-twilight-dark-1440x900.png`
- `docs/golden/anime-twilight/anime-twilight-light-1440x900.png`
- `docs/golden/cartoon-studio/cartoon-studio-dark-1440x900.png`
- `docs/golden/cartoon-studio/cartoon-studio-light-1440x900.png`
- `docs/golden/default/default-dark-1440x900.png`
- `docs/golden/default/default-light-1440x900.png`
- `docs/golden/japanese-film-editorial/japanese-film-editorial-dark-1440x900.png`
- `docs/golden/japanese-film-editorial/japanese-film-editorial-light-1440x900.png`
- `docs/golden/japanese-idol/japanese-idol-dark-1440x900.png`
- `docs/golden/japanese-idol/japanese-idol-light-1440x900.png`
- `docs/golden/korean-idol/korean-idol-dark-1440x900.png`
- `docs/golden/korean-idol/korean-idol-light-1440x900.png`
- `docs/golden/korean-prestige/korean-prestige-dark-1440x900.png`
- `docs/golden/korean-prestige/korean-prestige-light-1440x900.png`
- `docs/golden/study-library/study-library-dark-1440x900.png`
- `docs/golden/study-library/study-library-light-1440x900.png`

### Comparison and responsive captures

- `docs/theme-screenshots/01-default-home-light-1440x900.png`
- `docs/theme-screenshots/02-japanese-film-editorial-home-light-1440x900.png`
- `docs/theme-screenshots/03-korean-prestige-home-light-1440x900.png`
- `docs/theme-screenshots/04-cartoon-studio-home-light-1440x900.png`
- `docs/theme-screenshots/05-anime-twilight-home-light-1440x900.png`
- `docs/theme-screenshots/06-study-library-home-light-1440x900.png`
- `docs/theme-screenshots/07-japanese-idol-home-light-1440x900.png`
- `docs/theme-screenshots/08-korean-idol-home-light-1440x900.png`
- `docs/theme-screenshots/responsive-1280x720-cartoon-studio.png`
- `docs/theme-screenshots/responsive-1905x1026-study-library-code.png`
- `docs/theme-screenshots/responsive-1920x1080-anime-twilight-dark.png`
- `docs/theme-screenshots/responsive-3810x2052-korean-idol-dark.png`
- `docs/theme-screenshots/overlay-menu-korean-prestige-home-light.png`
- `docs/theme-screenshots/overlay-dialog-japanese-idol-home-light.png`
