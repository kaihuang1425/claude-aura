# Deliverable file manifest

The `work/full-theme-system` branch has no tracked baseline commit, so Git cannot
reliably classify paths as created versus modified. The list below is the
exhaustive current deliverable surface, excluding generated release output,
local workspace metadata, internal planning records, and the unsafe reference
surfaces outside the categorized asset tree. The retired reconstructed
offline-preview files and comparison screenshots are not deliverables.

## Product specifications

- `docs/THEME_KIT_SPEC.md`
- `docs/recipes/RECIPES.md`

## Aura Studio

- `studio/app.js`
- `studio/editor.css`
- `studio/editor.js`
- `studio/generated-themes.js`
- `studio/index.html`
- `studio/locales/de.js`
- `studio/locales/en-keys.json`
- `studio/locales/en.js`
- `studio/locales/es.js`
- `studio/locales/fr.js`
- `studio/locales/hi.js`
- `studio/locales/id.js`
- `studio/locales/it.js`
- `studio/locales/ja.js`
- `studio/locales/ko.js`
- `studio/locales/pl.js`
- `studio/locales/pt-BR.js`
- `studio/locales/tr.js`
- `studio/locales/vi.js`
- `studio/locales/zh-CN.js`
- `studio/locales/zh-HKTW.js`
- `studio/styles.css`

## Repository and policy

- `.gitattributes`
- `.github/ISSUE_TEMPLATE/bug.yml`
- `.github/workflows/ci.yml`
- `.gitignore`
- `config.example.json`
- `desktop-compatibility.json`
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

## Localized readmes

- `readmes/README.de.md`
- `readmes/README.es.md`
- `readmes/README.fr.md`
- `readmes/README.hi.md`
- `readmes/README.id.md`
- `readmes/README.it.md`
- `readmes/README.ja.md`
- `readmes/README.ko.md`
- `readmes/README.pl.md`
- `readmes/README.pt-BR.md`
- `readmes/README.tr.md`
- `readmes/README.vi.md`
- `readmes/README.zh-CN.md`
- `readmes/README.zh-HKTW.md`

## Renderer and artwork

- `assets/base.css`
- `assets/brand/aura-mark.svg`
- `assets/brand/claude-aura.ico`
- `assets/renderer-inject.js`
- `assets/renderer-prepaint.js`
- `assets/theme-variants.css`
- `assets/theme-art/README.md`

### Aura Studio preview media

Uncropped, preserved masters used only by the local Studio theme cards. Studio
stores framing metadata separately, so dragging or zooming a card never
rewrites these files. Full-interface concept images remain product selector
media only: they are never renderer backgrounds and never count as visual
acceptance evidence. The clearly separated `references/` directory is
repository-only and excluded from releases and installed copies.

- `assets/studio-previews/README.md`
- `assets/studio-previews/masters/anime-twilight.png`
- `assets/studio-previews/masters/cartoon-studio.png`
- `assets/studio-previews/masters/japanese-film-editorial.png`
- `assets/studio-previews/masters/japanese-idol.png`
- `assets/studio-previews/masters/korean-idol.png`
- `assets/studio-previews/masters/korean-prestige.png`
- `assets/studio-previews/masters/study-library.png`
- `assets/studio-previews/references/cartoon-ocean-alternate.png`
- `assets/studio-previews/references/launcher-marks-v2/PROMPTS.md`
- `assets/studio-previews/references/launcher-marks-v2/default.png`
- `assets/studio-previews/references/launcher-marks-v2/japanese-film-editorial.png`
- `assets/studio-previews/references/launcher-marks-v2/korean-prestige.png`
- `assets/studio-previews/references/launcher-marks-v2/cartoon-studio.png`
- `assets/studio-previews/references/launcher-marks-v2/anime-twilight.png`
- `assets/studio-previews/references/launcher-marks-v2/study-library.png`
- `assets/studio-previews/references/launcher-marks-v2/japanese-idol.png`
- `assets/studio-previews/references/launcher-marks-v2/korean-idol.png`
- `assets/studio-previews/references/in-page-brand-wordmarks-v1/PROMPTS.md`
- `assets/studio-previews/references/in-page-brand-wordmarks-v1/default.png`
- `assets/studio-previews/references/in-page-brand-wordmarks-v1/japanese-film-editorial.png`
- `assets/studio-previews/references/in-page-brand-wordmarks-v1/korean-prestige.png`
- `assets/studio-previews/references/in-page-brand-wordmarks-v1/cartoon-studio.png`
- `assets/studio-previews/references/in-page-brand-wordmarks-v1/anime-twilight.png`
- `assets/studio-previews/references/in-page-brand-wordmarks-v1/study-library.png`
- `assets/studio-previews/references/in-page-brand-wordmarks-v1/japanese-idol.png`
- `assets/studio-previews/references/in-page-brand-wordmarks-v1/korean-idol.png`

### Floating launcher marks

Eight distinct deterministic transparent 96×96 Aura marks and complete native
Windows icon frame sets. Missing or invalid identity assets fall back to
Default as one unit.

- `assets/theme-art/default/launcher-mark.png`
- `assets/theme-art/default/launcher-mark.ico`
- `assets/theme-art/japanese-film-editorial/launcher-mark.png`
- `assets/theme-art/japanese-film-editorial/launcher-mark.ico`
- `assets/theme-art/korean-prestige/launcher-mark.png`
- `assets/theme-art/korean-prestige/launcher-mark.ico`
- `assets/theme-art/cartoon-studio/launcher-mark.png`
- `assets/theme-art/cartoon-studio/launcher-mark.ico`
- `assets/theme-art/anime-twilight/launcher-mark.png`
- `assets/theme-art/anime-twilight/launcher-mark.ico`
- `assets/theme-art/study-library/launcher-mark.png`
- `assets/theme-art/study-library/launcher-mark.ico`
- `assets/theme-art/japanese-idol/launcher-mark.png`
- `assets/theme-art/japanese-idol/launcher-mark.ico`
- `assets/theme-art/korean-idol/launcher-mark.png`
- `assets/theme-art/korean-idol/launcher-mark.ico`

### Supporting compact brand-mark derivatives

Three supplied-reference, text-free SVG derivatives remain as provenance and
supporting assets. The active built-in replacement path uses the full
appearance-specific wordmark PNGs below; these compact files never substitute
for a horizontal lockup or Aura's launcher identity.

- `assets/theme-art/japanese-film-editorial/brand-mark.svg`
- `assets/theme-art/korean-prestige/brand-mark.svg`
- `assets/theme-art/japanese-idol/brand-mark.svg`

### Built-in in-page wordmarks

The repository-only reference tree contains one normalized horizontal source
per frozen built-in plus `PROMPTS.md`. Japanese Film Editorial and Japanese
Idol reuse exact supplied full lockups, Korean Idol reuses its approved raster,
and the other five directions are newly authored to their recipes. The
deterministic builder emits separate Light and Dark runtime PNGs for every
built-in. The renderer uses one full wordmark only when the live sidebar has a
unique expanded host; Claude's native visual remains the collapsed and
fail-safe path.

- `assets/theme-art/default/brand-wordmark-light.png`
- `assets/theme-art/default/brand-wordmark-dark.png`
- `assets/theme-art/japanese-film-editorial/brand-wordmark-light.png`
- `assets/theme-art/japanese-film-editorial/brand-wordmark-dark.png`
- `assets/theme-art/korean-prestige/brand-wordmark-light.png`
- `assets/theme-art/korean-prestige/brand-wordmark-dark.png`
- `assets/theme-art/cartoon-studio/brand-wordmark-light.png`
- `assets/theme-art/cartoon-studio/brand-wordmark-dark.png`
- `assets/theme-art/anime-twilight/brand-wordmark-light.png`
- `assets/theme-art/anime-twilight/brand-wordmark-dark.png`
- `assets/theme-art/study-library/brand-wordmark-light.png`
- `assets/theme-art/study-library/brand-wordmark-dark.png`
- `assets/theme-art/japanese-idol/brand-wordmark-light.png`
- `assets/theme-art/japanese-idol/brand-wordmark-dark.png`
- `assets/theme-art/korean-idol/brand-wordmark-light.png`
- `assets/theme-art/korean-idol/brand-wordmark-dark.png`

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

### Legacy Aura Studio selector thumbnails

Small 640 × 360 WebP derivatives retained as compatibility fallbacks. Current
cards load the uncropped masters above and apply their saved frame at display
time.

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

- `installer/Build Installer.cmd`
- `installer/ClaudeAura.iss`
- `installer/app-transaction.ps1`
- `installer/assets/wizard-dark.png`
- `installer/assets/wizard-light.png`
- `installer/assets/wizard-small-dark.png`
- `installer/assets/wizard-small-light.png`
- `installer/build-update.mjs`
- `installer/install-trigger.txt`
- `installer/locales/en.isl`
- `installer/locales/zh-CN.isl`
- `installer/locales/zh-HKTW.isl`
- `scripts/asset-audit.mjs`
- `scripts/build-aura-icon.mjs`
- `scripts/build-brand-wordmarks.mjs`
- `scripts/build-installer-assets.mjs`
- `scripts/build-installer.mjs`
- `scripts/build-launcher-assets.mjs`
- `scripts/build-studio-themes.mjs`
- `scripts/build-release.mjs`
- `scripts/convert-theme-assets.mjs`
- `scripts/desktop-cdp/validation.mjs`
- `scripts/desktop-probe.mjs`
- `scripts/injector.mjs`
- `scripts/locale-tasks.mjs`
- `scripts/state-cli.mjs`
- `scripts/theme-cli.mjs`
- `scripts/theme-core.mjs`
- `scripts/theme-core/artwork.mjs`
- `scripts/theme-core/compile.mjs`
- `scripts/theme-core/code-adapter.mjs`
- `scripts/theme-core/constants.mjs`
- `scripts/theme-core/greeting.mjs`
- `scripts/theme-core/registry.mjs`
- `scripts/theme-core/studio.mjs`
- `scripts/theme-core/terminal.mjs`
- `scripts/theme-core/validation.mjs`
- `scripts/verify-cycle.mjs`
- `scripts/webview-cli.mjs`
- `tests/aura-rescue.test.mjs`
- `tests/artwork.test.mjs`
- `tests/avatar.test.mjs`
- `tests/config.test.mjs`
- `tests/code-adapter.test.mjs`
- `tests/draft-handoff.test.mjs`
- `tests/desktop-cdp.test.mjs`
- `tests/greeting-runtime.test.mjs`
- `tests/greeting.test.mjs`
- `tests/installer.test.mjs`
- `tests/locales.test.mjs`
- `tests/payload.test.mjs`
- `tests/platform.test.mjs`
- `tests/prompt-shelf.test.mjs`
- `tests/prepaint.test.mjs`
- `tests/run-tests.mjs`
- `tests/studio-editor.test.mjs`
- `tests/support/context.mjs`
- `tests/support/harness.mjs`
- `tests/terminal-theme.test.mjs`
- `tests/theme-cli.test.mjs`
- `tests/themes.test.mjs`
- `tests/user-kits.test.mjs`

## Windows application

- `windows/aura-draft-handoff.ps1`
- `windows/desktop-capability.ps1`
- `windows/aura-ui.ps1`
- `windows/aura-prompt-shelf.ps1`
- `windows/common.ps1`
- `windows/install.ps1`
- `windows/locales/de.json`
- `windows/locales/en.json`
- `windows/locales/es.json`
- `windows/locales/fr.json`
- `windows/locales/hi.json`
- `windows/locales/id.json`
- `windows/locales/it.json`
- `windows/locales/ja.json`
- `windows/locales/ko.json`
- `windows/locales/pl.json`
- `windows/locales/pt-BR.json`
- `windows/locales/tr.json`
- `windows/locales/vi.json`
- `windows/locales/zh-CN.json`
- `windows/locales/zh-HKTW.json`
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
- `docs/WINDOWS_INSTALLER.md`
- `docs/handoff/P0_SPIKE_RUNBOOK.md`

## Vendored WebView2 runtime integration

- `vendor/webview2/LICENSE.txt`
- `vendor/webview2/NOTICE.txt`
- `vendor/webview2/Microsoft.Web.WebView2.Core.dll`
- `vendor/webview2/Microsoft.Web.WebView2.WinForms.dll`
- `vendor/webview2/WebView2Loader.dll`
- `vendor/webview2/runtimes/arm64/WebView2Loader.dll`
- `vendor/webview2/runtimes/x64/WebView2Loader.dll`
- `vendor/webview2/runtimes/x86/WebView2Loader.dll`
