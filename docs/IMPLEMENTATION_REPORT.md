# Eight-theme implementation report

## Scope

Claude Aura 0.3 preserves the existing WebView2 companion, renderer injection,
configuration, and restore model while replacing the earlier four-name palette
set with eight canonical interface systems. The implementation themes shared
navigation, content surfaces, controls, cards, composer, menus, dialogs,
status, focus, typography, shape, effects, and decoration without replacing the
real Claude interface with screenshots.

## Canonical registry

| Order | Stable ID | Display name | Artwork |
| ---: | --- | --- | --- |
| 1 | `default` | Default | None |
| 2 | `japanese-film-editorial` | Japanese Film Editorial | `assets/theme-art/japanese-film-editorial.svg` |
| 3 | `korean-prestige` | Korean Prestige | `assets/theme-art/korean-prestige.svg` |
| 4 | `cartoon-studio` | Cartoon Studio | `assets/theme-art/cartoon-studio.svg` |
| 5 | `anime-twilight` | Anime Twilight | `assets/theme-art/anime-twilight.svg` |
| 6 | `study-library` | Study Library | `assets/theme-art/study-library.svg` |
| 7 | `japanese-idol` | Japanese Idol | `assets/theme-art/japanese-idol.svg` |
| 8 | `korean-idol` | Korean Idol | `assets/theme-art/korean-idol.svg` |

The order is defined once in `themes/registry.json` and reused by command-line,
Windows picker, validation, and preview consumers.

## Data and rendering flow

1. `themes/registry.json` provides the stable ID, order, localized labels and
   descriptions, swatches, compact preview colors, and optional artwork slot.
2. `themes/<id>.json` provides the component profile and light/dark semantic
   values.
3. `listThemes()` validates and combines both sources. Callers never need to
   reconstruct metadata from filenames or raw colors.
4. `compileTheme()` resolves aliases and fallback, expands semantic values into
   Claude compatibility tokens, validates optional user images and registered
   artwork, and builds one payload for the active theme.
5. The renderer applies a stable `data-claude-aura-theme` root attribute.
   `assets/base.css` handles shared semantics and `assets/theme-variants.css`
   supplies centralized component-level differences.
6. Cleanup removes the injected style and decorative layers without modifying
   Claude's installed files or account data.

This separation keeps theme IDs out of unrelated application logic and lets the
interface remain usable when decorative artwork cannot load.

## Change-set inventory

The working branch has no tracked baseline commit, so Git cannot distinguish
new files from modified files. `docs/FILE_MANIFEST.md` provides the exhaustive
path-level deliverable list; the table below summarizes that implementation
surface by responsibility.

| Area | Files | Responsibility |
| --- | --- | --- |
| Registry and themes | `themes/registry.json`, the eight canonical theme JSON files, and compatibility files `themes/midnight.json`, `themes/ember.json`, `themes/forest.json`, and `themes/sakura.json` | Canonical IDs, localized metadata, semantic light/dark roles, typography, shape, effects, wallpaper recipes, and legacy migration |
| Shared renderer styling | `assets/base.css`, `assets/theme-variants.css`, `assets/renderer-inject.js` | Semantic production coverage, centralized component variants, root attributes, artwork layers, cleanup, and accessibility preferences |
| Original artwork | `assets/theme-art/*.svg`, `assets/theme-art/README.md` | Seven isolated, optional, self-contained decorative assets and provenance |
| Compiler and commands | `scripts/theme-core.mjs`, `scripts/theme-cli.mjs`, `scripts/webview-cli.mjs`, `scripts/state-cli.mjs`, `scripts/injector.mjs`, `scripts/build-preview.mjs`, `scripts/preview-server.mjs`, `scripts/build-release.mjs` | Validation, compilation, persistence aliases, localized payload metadata, legacy injection, preview generation/server, and release collection |
| Windows experience | `Install Claude Aura.cmd`, `Uninstall Claude Aura.cmd`, `windows/*.ps1`, `windows/ui-copy.json` | DPI-aware localized native theme gallery, live application, accessibility, best-effort DWM title-bar palette, allowlisted install, verification/restore helpers, and explicit app/data removal |
| macOS compatibility | `Install Claude Aura.command`, `macos/*.sh`, `macos/launchers/*.command` | Reversible, allowlisted legacy installation, theme switching, verification, and restore without reference composites |
| Offline QA | `preview/index.html`, `preview/styles.css`, `preview/app.js`, `preview/generated-themes.js` | Eight-theme Home/Code harness with representative controls and states |
| Verification | `tests/run-tests.mjs`, `package.json`, `config.example.json` | Sixteen end-to-end/static checks, build commands, and Default baseline |
| Documentation and policy | `README.md`, `CONTRIBUTING.md`, `docs/THEMING.md`, `docs/TROUBLESHOOTING.md`, `docs/FILE_MANIFEST.md`, `docs/SCREENSHOT_PLAN.md`, `docs/ACCEPTANCE_AUDIT.md`, this report, `SECURITY.md`, `NOTICE.md`, `THIRD_PARTY_NOTICES.md`, `.gitignore` | Use, maintenance, troubleshooting, exhaustive file inventory, repeatable capture, acceptance evidence, licensing, exclusions, and deliverables |

The earlier legacy theme JSON files remain for compatibility but are not exposed
as additional picker entries; registry aliases migrate their saved IDs.

## Semantic system

Each theme supplies a light and dark semantic map for:

- primary, secondary, sidebar, panel, elevated, overlay, card, and composer
  surfaces;
- primary, secondary, muted, disabled, sidebar, and on-accent text;
- primary and secondary accents;
- subtle and emphasized borders plus the focus ring;
- hover, selected, and disabled states; and
- destructive, success, warning, and informational status.

Theme files also define UI/display/body/monospace system-font stacks, control
and surface radii, border width, shadows, hover lift, transition timing, blur,
and wallpaper behavior. The compiler derives missing secondary semantic roles
and creates the compatibility variables expected by Claude's current theme
surface.

Distinct component rules remain centralized under root selectors. This allows,
for example, editorial dividers, architectural glass, inked cartoon controls,
twilight panels, academic notebook structure, soft ribbon framing, and
holographic geometry without duplicating application markup.

## Picker and localization

The Windows toolbar opens one modeless **Customize themes** gallery. Each native
radio option includes a display name, short description, color swatches,
miniature interface preview, and visible selected state. The gallery supports
keyboard focus, Tab navigation, scrolling, Escape-to-close, high contrast, and
DPI-scaled layout.

On supported Windows versions, Aura also makes best-effort Desktop Window
Manager calls for the dark-caption preference and the caption, caption-text,
and border colors of the main and gallery windows. Unsupported attributes,
system policy, and platform-controlled chrome are allowed to win; API exceptions
are logged, and unsuccessful requests do not prevent the toolbar, gallery,
WebView, or theme selection from working.

Theme metadata and Windows picker chrome, status, error, and accessibility copy
support `en`, `zh-CN`, and `zh-TW`. Windows passes the current UI culture to the
theme CLI. Locale normalization maps `zh-CN`, `zh-SG`, and
`zh-Hans` tags to `zh-CN`; it maps `zh-TW`, `zh-HK`, `zh-MO`, and `zh-Hant`
tags to `zh-TW`. Other tags fall back to English. Theme CSS and artwork contain
no localized functional copy.

The offline preview builds its gallery from the same `listThemes()` data. It is
an illustrative QA harness with Home and Code views and representative control,
status, menu, dialog, and composer states. Its browser-local selection is
separate from the installed application's configuration. A strict capture URL
contract selects theme, mode, screen, and overlay without mutating saved preview
state; capture mode freezes transient pixels and exposes a visible state plate
plus a ready marker only after artwork decode, font readiness, and layout frames.

## Persistence and compatibility

The selected canonical ID is written atomically to the user's local
`config.json` and reapplied on restart. A ready Claude view updates immediately;
during startup or sign-in, the saved selection applies when the view becomes
ready. Theme selection does not require an account, subscription, sync service,
or network-side preference.

The registry keeps these migrations:

| Legacy ID | Canonical ID |
| --- | --- |
| `midnight` | `default` |
| `ember` | `japanese-film-editorial` |
| `forest` | `study-library` |
| `sakura` | `japanese-idol` |

An invalid saved ID falls back to `default`, while compiler output retains the
original request as fallback diagnostic information. Malformed or non-object
configuration also recovers to Default; the next atomic write first preserves
the unreadable source as a uniquely named `.corrupt-…json` diagnostic backup.

## Artwork and licensing

The seven optional artwork files are original, self-contained project SVGs
distributed under the repository's MIT License. They are separate from the
functional interface, contain no embedded controls or UI text, and are marked
non-focusable, hidden from assistive technology, and pointer-inert. Human forms
are abstract fictional adults and imply no real person or endorsement. Default
uses no art asset.

The `theme_demo_previews` composites are art-direction references only. Neither
the runtime compiler nor the offline preview builder reads or embeds them. The
release builder skips the directory entirely.

User-selected background images remain local decorative inputs and are
validated for supported extension, matching content signature, and size before
compilation. Animated GIF, APNG, WebP, and AVIF layers are suppressed whenever
Aura or the operating system requests reduced motion.

## Performance safeguards

Only the selected theme's optional artwork is read and embedded in a renderer
payload. The seven artwork files total 20,820 bytes and each stays below the
100 KB asset ceiling. Warm local eight-theme compilation on 2026-07-16 had a
median near 1–2 ms. Across all three locales, the largest built-in payload is
64,924 bytes. A full native save, atomic configuration write, and payload-return
audit measured about 52 ms median and below 60 ms maximum across the eight
themes. The automated suite enforces a strict 65,000-byte budget for all 24
locale/theme combinations without a user image and asserts exactly zero artwork
data URLs for Default or one for the selected decorated theme.

Decorative layers are fixed and pointer-inert, so they do not participate in
document layout. Responsive rules reduce or remove them at narrower widths;
motion is one-shot or interaction-triggered and is disabled by both Aura's
reduced-motion setting and the operating-system preference.

User images retain the existing 16 MB input cap. At that edge, base64 encoding
can produce a renderer payload of roughly 22.4 MB. The Windows save path now
reads and encodes the image once rather than twice, and the renderer caches the
prepared CSS value instead of rebuilding or reassigning it on its four-second
self-heal interval. The observer watches only Aura's direct root/head/body
state, not normal Claude SPA subtree mutations.

## Dependencies

No npm package, cloud service, analytics SDK, subscription, or runtime font was
added for the theme system. Node.js 22 or newer and its built-in modules perform
validation and builds. Existing vendored Microsoft WebView2 SDK assemblies
remain the Windows rendering integration and retain their bundled license and
notice.

## Verification and release procedure

The repository provides these repeatable checks:

```powershell
npm run themes
npm run preview:build
npm test
npm run check
```

The automated suite covers the eight-theme registry, semantic completeness,
contrast guardrails, locale metadata, fallback and persistence behavior,
payload/root-attribute behavior, isolated artwork policy, script parsing,
Windows picker metadata, preview coverage, and release exclusions.

Results recorded on 2026-07-16:

| Check | Result |
| --- | --- |
| `npm test` | Passed, 16/16 |
| `npm run check` | Passed; JavaScript, Windows PowerShell, and shell parsing plus the 16-test suite |
| Lint | Not configured in the repository; there is no linter dependency or lint script, so this gate is explicitly not applicable rather than represented by `npm run check` |
| Typecheck | Not applicable; the project contains JavaScript, PowerShell, and shell sources with no TypeScript sources, `tsconfig.json`, or typecheck script |
| `npm run preview:build` | Passed; regenerated metadata for all eight themes |
| `npm run release` | Passed; produced the versioned ZIP and matching SHA-256 sidecar from the explicit distribution allowlist |
| Preview server smoke test | `/preview/` 200, approved SVG 200, non-public repository file 403 |
| Release archive rebuild | Passed on 2026-07-17 after screenshots were captured; the versioned ZIP and matching SHA-256 sidecar were regenerated from the explicit distribution allowlist, with no local configuration, composite-reference, or nested-release entries |
| Windows title-bar source check | Passed; best-effort DWM dark-caption and caption/text/border attributes are present with a non-fatal fallback path |
| Windows uninstaller dry run | Passed with `-WhatIf`; enumerated only Claude Aura shortcuts plus `%LOCALAPPDATA%\ClaudeAura\app`, `data`, and `webview` |
| Browser interaction, console, responsive sizes, and screenshots | Passed on 2026-07-17 in the offline QA harness (Chromium/WebView2 engine). All eight themes switch through one stable `data-claude-aura-theme` root attribute with distinct accent, display font, radius, and border-width values; no console output, and only same-origin `/preview/` and local `data:`/SVG requests (zero remote or mixed-content requests) across all eight; decorative artwork stays `pointer-events:none` and never wins the hit-test at the composer center; persistence survives reload and query-parameter overrides do not overwrite saved state; visible focus ring, labelled modal dialog with focus trap, keyboard tab/arrow/Escape, and disabled styling all confirmed; no horizontal overflow. Fourteen screenshots recorded under `docs/theme-screenshots/` (see Visual evidence) |

Before creating an archive, run the checks and then:

```powershell
npm run release
```

The release builder creates a versioned ZIP and SHA-256 file from explicit
distributable top-level files, directories, and supported file types. Source
control and agent metadata, local configuration/state, dependency/build output,
temporary files, logs, existing release output, and `theme_demo_previews` are
therefore excluded. Windows and macOS installers also run the test suite before
copying an installation.

## Visual evidence

The required captures were produced on 2026-07-17 from the deterministic
`capture=1` preview contract in `docs/SCREENSHOT_PLAN.md`, using the headless
Chromium engine that backs WebView2, and stored under `docs/theme-screenshots/`.
Each capture waited for the `[data-preview-ready="true"]` marker (artwork decode,
font readiness, and two settled frames) before rendering. Every file was verified
to the exact pixel dimensions listed.

Eight-theme comparison — Home, light, 1440 × 900:

| File | Theme | Observed |
| --- | --- | --- |
| `01-default-home-light-1440x900.png` | Default | Indigo baseline, no artwork, balanced controls |
| `02-japanese-film-editorial-home-light-1440x900.png` | Japanese Film Editorial | Serif display, vermilion accents, charcoal sidebar, editorial rules, ruled paper texture |
| `03-korean-prestige-home-light-1440x900.png` | Korean Prestige | Midnight navy, silver borders, architectural glass panels, geometric icon containers |
| `04-cartoon-studio-home-light-1440x900.png` | Cartoon Studio | Inked 2 px outlines, rounded pill controls, teal/coral on cream, dashed composer |
| `05-anime-twilight-home-light-1440x900.png` | Anime Twilight | Twilight-blue glass, cyan edge light, constellation dot texture |
| `06-study-library-home-light-1440x900.png` | Study Library | Ruled-paper background, forest-green/oxblood, index-tab sidebar, no character artwork |
| `07-japanese-idol-home-light-1440x900.png` | Japanese Idol | Warm cream/blush, rounded pill controls, ribbon dividers, pearlescent cards |
| `08-korean-idol-home-light-1440x900.png` | Korean Idol | Periwinkle/lavender, holographic grid, music-player controls, sharper type |

Responsive, high-DPI, and interaction evidence:

| File | State | Output size |
| --- | --- | --- |
| `responsive-1280x720-cartoon-studio.png` | Cartoon Studio, Home, light | 1280 × 720 |
| `responsive-1905x1026-study-library-code.png` | Study Library, Code view, light | 1905 × 1026 |
| `responsive-1920x1080-anime-twilight-dark.png` | Anime Twilight, Home, dark | 1920 × 1080 |
| `responsive-3810x2052-korean-idol-dark.png` | Korean Idol, Home, dark at device-pixel-ratio 2 | 3810 × 2052 (true high-DPI, crisp) |
| `overlay-menu-korean-prestige-home-light.png` | Korean Prestige with the "More" menu open | 1440 × 900 |
| `overlay-dialog-japanese-idol-home-light.png` | Japanese Idol with the modal "Theme details" dialog and scrim | 1440 × 900 |

The offline preview shares the registry metadata, semantic design tokens, and
renderer CSS with the runtime path. It is an illustrative QA harness, not a copy
of the production Claude interface; automated and source-only checks are not
treated as a substitute for it. Observation inside the signed-in production
`claude.ai` WebView2 window was not performed in this environment (it requires an
interactive signed-in session) and remains the one outstanding runtime check.

## Supplied references excluded from production

All seven supplied files were opaque full-interface composites rather than
isolated, licensed decorative artwork. They were used only for art direction and
are ignored by Git, installers, preview generation, and release collection:

- `theme_demo_previews/c1cad58a-97a8-4dd1-8270-14a52658fa4f.png`
- `theme_demo_previews/Claude app interface with K-pop theme.png`
- `theme_demo_previews/Claude's friendly productivity dashboard.png`
- `theme_demo_previews/Claude's ocean-themed assistant dashboard.png`
- `theme_demo_previews/Elegant Japanese-inspired app interface.png`
- `theme_demo_previews/Kawaii idol-themed app interface.png`
- `theme_demo_previews/Sleek dark mode app dashboard.png`

No pixels, portraits, controls, or embedded text from those composites are
present in runtime or release assets.

## Remaining limitations

- Production styling targets the current semantic and ARIA structure rendered by
  `claude.ai`; selectors should be rechecked when that upstream interface changes.
- Native title-bar colors are best-effort. On supported Windows builds, Aura
  requests matching DWM dark-caption, caption, caption-text, and border colors;
  unsupported attributes or system policy can leave some chrome unchanged. The
  themed toolbar and WebView remain independent of this enhancement, and no
  Claude or Windows binary is patched.
- The supplied portraits could not be safely isolated from the composite
  screenshots. The release therefore uses original abstract fictional artwork.
  Closer portrait fidelity would require separately licensed, isolated source art.
- The macOS scripts remain a reversible legacy launcher; the native, non-technical
  rich gallery is the supported Windows WebView2 experience.

## Maintenance notes

- Keep stable IDs and released legacy aliases intact.
- Add picker metadata and both appearance modes before registering a theme.
- Preserve readable, operable UI when artwork is absent.
- Update shared semantic styling before adding one-off selectors.
- Recheck selectors when `claude.ai` changes its rendered structure.
- Treat screenshot composites as references, never shippable interface assets.
