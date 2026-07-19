# Eight-theme implementation report

## 0.3.x follow-up fixes

Three changes landed after the initial eight-theme system:

1. **First-sign-in blank screen (fixed).** The WebView loading cover only hid when
   the async theme-injection script confirmed `"installed":true`. The first
   sign-in's OAuth redirect/reload burst could invalidate that script, stranding
   the opaque cover over a loaded, signed-in page until a restart. The cover is now
   hidden on the real `NavigationCompleted` signal for a claude.ai document, with
   theme injection running non-blockingly and self-healing; the opaque cover is
   reserved for genuine navigation/process failures. See `windows/aura-ui.ps1`.
2. **UTF-8 helper decoding (fixed).** `aura-ui.ps1` now sets an explicit UTF-8
   `StandardOutputEncoding` on the Node helper and reads `config.json` as UTF-8, so
   localized theme metadata no longer corrupts on OEM-code-page systems (Big5/GBK).
3. **Idol artwork integration.** The theme-art backdrop layer previously rendered
   each art SVG's opaque background as a hard, washed rectangle. `base.css` now
   applies a right-anchored radial mask that dissolves the artwork's other edges, so
   it reads as an integrated corner presence; the japanese-idol and korean-idol art
   sizes and opacities were retuned to match.

## Kawaii idol preview showcase

The `themes/japanese-idol/` production asset kit (supplied, gitignored source of
truth) is integrated into the japanese-idol theme's offline preview as a deeply
art-directed skin: derived, isolated runtime assets under
`assets/theme-art/kawaii-idol/` (kawaii logo, hero portrait, sakura clusters,
sparkles, signature, "keep shining" sticker, and per-card illustrations) are
composed as inert, pointer-safe, independently positioned decorative layers over
the live HTML/CSS components. The treatment is scoped to
`[data-claude-aura-theme="japanese-idol"]`, is token-driven so it reads correctly
in light and dark modes, and leaves the other seven themes unchanged.

The runtime claude.ai skin now ships the same real artwork through a layered
artwork system: a theme may declare up to four `artworkLayers` (optimized WebP or
SVG), each embedded as a data URL only when that theme is active and rendered as
inert, pointer-safe backdrop divs with per-layer position, size, opacity,
mobile behavior, and an optional right-anchored edge-fade mask. Japanese Idol
uses four layers — the sakura watercolor background, the hero portrait, and the
  two sakura corner clusters — derived from the supplied kit via
  `scripts/convert-theme-assets.mjs`. Budgets are enforced by tests: chrome
payload under 65 KB, embedded artwork under 1.4 MB (Japanese Idol totals about
579 KB). The exact compiled payload was rendered in a standalone harness to
confirm the layers paint correctly through the production injection path.

## Cartoon Studio approved artwork

WO-10 replaces the procedural Cartoon Studio stand-in with two approved inert
WebP layers: a 1600 x 900 cream paper/doodle background and an original 835 x
1032 transparent mascot. Three approved tool doodles remain source-only because
the changing live Claude DOM does not provide stable card-art anchors. The
generated source kit, hashes, provenance, and 2160 x 4600 QA board live under
the gitignored `themes/cartoon-studio/`; the two shippable derivatives live
under `assets/theme-art/cartoon-studio/`. Their exact light/dark payload renders
are locked in `docs/golden/REFERENCE_LOCK.md` after the user-approved WO-10
mini-checkpoint.

The required whole-window Aura capture could not target the PowerShell-hosted
window through the available first-party bridge; the two exhausted attempts are
recorded under WO-09 in `docs/plans/BLOCKED.md`. On 2026-07-20 the user
authorized WO-10 completion with its real-Aura light/dark and 1280 x 720 stress
evidence deferred to HUMAN CHECKPOINT C/WO-16. This exception does not relabel
fixture or QA images as live evidence.

## Anime Twilight approved artwork

WO-11 replaces the procedural Anime Twilight stand-in with one approved inert
1600 x 900 WebP background: a painterly indigo/violet cityscape with pale-cyan
atmosphere and restrained warm window light. The generated source kit, exact
prompt, checksum freeze, provenance, and 2160 x 3060 QA board live under the
gitignored `themes/anime-twilight/`; the shippable derivative lives at
`assets/theme-art/anime-twilight/background.webp`. Its exact light/dark payload
renders are locked in `docs/golden/REFERENCE_LOCK.md` after the user-approved
WO-11 mini-checkpoint.

The actual Aura light/dark and 1920 x 1080 dark stress captures remain blocked
by the WO-09 whole-window limitation and are deferred to HUMAN CHECKPOINT C and
WO-16. A separate two-attempt failure for the supplemental deterministic stress
capture is recorded under WO-11 in `docs/plans/BLOCKED.md`; no fixture image is
represented as live evidence.

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
| 4 | `cartoon-studio` | Cartoon Studio | Two layered `assets/theme-art/cartoon-studio/*.webp` assets (background and original mascot) |
| 5 | `anime-twilight` | Anime Twilight | One layered `assets/theme-art/anime-twilight/background.webp` cityscape |
| 6 | `study-library` | Study Library | `assets/theme-art/study-library.svg` |
| 7 | `japanese-idol` | Japanese Idol | Four layered `assets/theme-art/kawaii-idol/*.webp` assets (background, hero, two sakura clusters) |
| 8 | `korean-idol` | Korean Idol | Three layered `assets/theme-art/korean-idol/*.webp` assets (background, constellation, hero) |

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
| Runtime artwork and Studio selectors | `assets/theme-art/`, `assets/theme-art/README.md` | Isolated optional renderer layers plus seven small local, user-framable theme-card thumbnails and provenance |
| Compiler and commands | `scripts/theme-core.mjs`, `scripts/theme-cli.mjs`, `scripts/webview-cli.mjs`, `scripts/state-cli.mjs`, `scripts/injector.mjs`, `scripts/build-preview.mjs`, `scripts/preview-server.mjs`, `scripts/build-release.mjs` | Validation, compilation, persistence aliases, localized payload metadata, legacy injection, preview generation/server, and release collection |
| Windows experience | `Install Claude Aura.cmd`, `Uninstall Claude Aura.cmd`, `windows/*.ps1`, `windows/ui-copy.json`, `studio/` | DPI-aware localized native gallery plus Aura Studio, live application, adjustable card/background framing, accessibility, best-effort DWM title-bar palette, allowlisted install, verification/restore helpers, and explicit app/data removal |
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

Aura Studio provides the replacement path approved at HUMAN CHECKPOINT B on
2026-07-19.
Its eight cards use live localized labels and art-led 3:2 previews with one
selection/focus treatment. The selected theme exposes an **Adjust card preview**
action, while a chosen custom background exposes **Adjust framing**. Both open
the same labelled dialog: users can drag the image, use native range controls
for horizontal position, vertical position, and zoom, reset, cancel, or save.
The background stage receives the live Claude WebView aspect ratio, and Studio
waits for a host acknowledgement before reporting success or closing.

On supported Windows versions, Aura also makes best-effort Desktop Window
Manager calls for the dark-caption preference and the caption, caption-text,
and border colors of the main and gallery windows. Unsupported attributes,
system policy, and platform-controlled chrome are allowed to win; API exceptions
are logged, and unsuccessful requests do not prevent the toolbar, gallery,
WebView, or theme selection from working.

Theme metadata and Windows picker chrome, status, error, and accessibility copy
support `en`, `zh-CN`, and `zh-TW`. Windows passes the current UI culture to the
theme CLI and decodes the helper's UTF-8 output with an explicit UTF-8
`StandardOutputEncoding`, and reads `config.json` with `-Encoding UTF8`, so
localized metadata is not corrupted when the console falls back to an OEM code
page such as Big5 (cp950) on a Traditional Chinese system. Locale normalization
maps `zh-CN`, `zh-SG`, and
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

Three themes use self-contained project SVG renderer art. Cartoon Studio uses
two project-generated, user-approved WebP layers with frozen source masters
under `themes/cartoon-studio/`, and Anime Twilight uses one project-generated,
user-approved WebP background with its frozen source master under
`themes/anime-twilight/`. Japanese Idol uses derived, isolated WebP/SVG copies
from the supplied kit under
`themes/japanese-idol/`, and Korean Idol uses three derived WebP layers from the
kit currently supplied under `themes/korean-prestige/`; both source directories
remain gitignored. Runtime artwork is separate from the functional interface,
contains no embedded controls or UI text, and is non-focusable, hidden from
assistive technology, and pointer-inert. Default uses no renderer artwork.

Studio selector media is a distinct asset class: six cards use small art-only
crops from the supplied visual references and Study Library uses a rasterized
crop of its implemented SVG. The photorealistic reference pixels occur only in
these decorative selector thumbnails, next to live labels; they are never
injected into Claude as renderer art.

The raw `theme_demo_previews` composites remain art-direction sources only. The
runtime compiler and offline preview builder never read or embed them, and the
release builder skips the directory entirely. `convert-theme-assets.mjs` may
derive small text-free Studio selector crops into `assets/theme-art/<id>/`; only
those compressed derivatives are served by the local `aura.assets` virtual host.

User-selected background images remain local decorative inputs and are
validated for supported extension, matching content signature, and size before
compilation. Animated GIF, APNG, WebP, and AVIF layers are suppressed whenever
Aura or the operating system requests reduced motion.

The background's focal point and zoom are persisted as strict numeric values and
compiled into the renderer's exact cover geometry. For editing, the host copies
the selected bytes into a marker-owned, content-addressed cache exposed only as
the isolated `aura.background` virtual host; neither the source path nor an
arbitrary page-supplied path crosses the bridge. Replacing an image with different
bytes at the same size and timestamp produces a new preview URL, and junction
aliases cannot turn cache cleanup into source deletion. The open source stream is
also checked again against the 16 MB limit before hashing or copying, so replacing
a selected file with an oversized one cannot bypass the original image guard.
Existing advanced CSS
positions that cannot be represented by the editor remain unchanged until the
user explicitly saves a supported framing value.

## Performance safeguards

Only the selected theme's optional artwork is read and embedded in a renderer
payload. SVG artwork stays below the 100 KB ceiling and raster layers below
400 KB each; the chrome portion of every payload stays under 65 KB and total
embedded artwork under 1.4 MB (Japanese Idol's four layers total about 579 KB
encoded). Warm local eight-theme compilation on 2026-07-16 had a
median near 1–2 ms. A full native save, atomic configuration write, and payload-return
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
Windows picker metadata, Studio bridge/framing validation and cache regressions,
preview coverage, and release exclusions.

Results recorded through 2026-07-20:

| Check | Result |
| --- | --- |
| `npm test` | Passed, 16/16 |
| `npm run check` | Passed; JavaScript, Windows PowerShell, and shell parsing plus the 16-test suite |
| `npm run verify:cycle` | Passed, 17/17; all sixteen 1440 x 900 light/dark theme renders under `dist/verify/` were opened and inspected for readability, clipping, artwork layering, and blank output |
| Lint | Not configured in the repository; there is no linter dependency or lint script, so this gate is explicitly not applicable rather than represented by `npm run check` |
| Typecheck | Not applicable; the project contains JavaScript, PowerShell, and shell sources with no TypeScript sources, `tsconfig.json`, or typecheck script |
| `npm run preview:build` | Passed; regenerated metadata for all eight themes |
| `npm run release` | Passed; produced the versioned ZIP and matching SHA-256 sidecar from the explicit distribution allowlist |
| Preview server smoke test | `/preview/` 200, approved SVG 200, non-public repository file 403 |
| Release archive rebuild | Passed on 2026-07-17 after screenshots were captured; the versioned ZIP and matching SHA-256 sidecar were regenerated from the explicit distribution allowlist, with no local configuration, composite-reference, or nested-release entries |
| Windows title-bar source check | Passed; best-effort DWM dark-caption and caption/text/border attributes are present with a non-fatal fallback path |
| Windows uninstaller dry run | Passed with `-WhatIf`; enumerated only Claude Aura shortcuts plus `%LOCALAPPDATA%\ClaudeAura\app`, `data`, and `webview` |
| Browser interaction, console, responsive sizes, and screenshots | Passed on 2026-07-17 in the offline QA harness (Chromium/WebView2 engine). All eight themes switch through one stable `data-claude-aura-theme` root attribute with distinct accent, display font, radius, and border-width values; no console output, and only same-origin `/preview/` and local `data:`/SVG requests (zero remote or mixed-content requests) across all eight; decorative artwork stays `pointer-events:none` and never wins the hit-test at the composer center; persistence survives reload and query-parameter overrides do not overwrite saved state; visible focus ring, labelled modal dialog with focus trap, keyboard tab/arrow/Escape, and disabled styling all confirmed; no horizontal overflow. Fourteen screenshots recorded under `docs/theme-screenshots/` (see Visual evidence) |
| Aura Studio framing walkthrough | Passed on 2026-07-18 at the product 1080 x 720 viewport with a WebView bridge simulator. Actual pointer drags adjusted card and background framing; native range controls, reset/cancel/save, host acknowledgement, reload persistence, live background aspect ratio, zh-TW/zh-CN copy, image-load failure handling, and zero fresh-run warnings/errors were verified. Evidence is under `dist/verify/checkpoint-b-*-framing*.png` and the explicitly named files in `docs/PROGRESS.md` |
| WO-10 Cartoon Studio asset cycle | Passed on 2026-07-20: source/runtime checksum freeze, two-layer decode and QA board, `npm run check` 19/19, and `npm run verify:cycle` 33/33 with the approved light/dark goldens at zero delta. The user-authorized live-capture deferral remains explicit for Checkpoint C/WO-16. |
| WO-11 Anime Twilight asset cycle | Passed on 2026-07-20: source/runtime checksum freeze, one-layer decode and QA board, `npm run check` 19/19, and `npm run verify:cycle` 33/33 with the approved light/dark goldens at zero delta. Actual Aura light/dark and 1920 x 1080 dark evidence remains explicitly deferred to Checkpoint C/WO-16 under WO-09. |

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
| `05-anime-twilight-home-light-1440x900.png` | Anime Twilight | Historical pre-WO-11 twilight-glass frame; the approved painterly cityscape is locked under `docs/golden/anime-twilight/` |
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
treated as a substitute for it. An interactive 2026-07-18 run exercised all
eight selections against the signed-in production `claude.ai` WebView2 window
and persisted theme, enabled, and background state. The revised Aura Studio
gallery was also inspected in a real WebView2 host in zh-TW and zh-CN, including
immediate selection updates and keyboard focus traversal. Its later framing
revision was exercised separately at the exact product viewport with a WebView
bridge simulator, including pointer drag, host acknowledgement, reload
persistence, both Chinese locales, and fresh-run console inspection.

## Supplied references and Studio selector derivatives

All seven supplied source files are opaque full-interface composites rather than
isolated renderer artwork. The originals are ignored by Git, installers,
preview generation, and release collection:

- `theme_demo_previews/c1cad58a-97a8-4dd1-8270-14a52658fa4f.png`
- `theme_demo_previews/Claude app interface with K-pop theme.png`
- `theme_demo_previews/Claude's friendly productivity dashboard.png`
- `theme_demo_previews/Claude's ocean-themed assistant dashboard.png`
- `theme_demo_previews/Elegant Japanese-inspired app interface.png`
- `theme_demo_previews/Kawaii idol-themed app interface.png`
- `theme_demo_previews/Sleek dark mode app dashboard.png`

No full composite, interface control, or baked interface text is distributed.
For the Checkpoint B Studio picker, six small 640 × 360 art-led crops are
derived from these references and stored under `assets/theme-art/<id>/`; the
Study Library card is derived from its implemented SVG instead. These local
thumbnails are decorative selector media with live adjacent labels. They are
never injected into Claude or used as runtime backgrounds.

## Remaining limitations

- Production styling targets the current semantic and ARIA structure rendered by
  `claude.ai`; selectors should be rechecked when that upstream interface changes.
- Native title-bar colors are best-effort. On supported Windows builds, Aura
  requests matching DWM dark-caption, caption, caption-text, and border colors;
  unsupported attributes or system policy can leave some chrome unchanged. The
  themed toolbar and WebView remain independent of this enhancement, and no
  Claude or Windows binary is patched.
- Supplied portrait pixels appear only in the small Studio selector thumbnails.
  Renderer backgrounds continue to use isolated project artwork; closer runtime
  portrait fidelity still requires separately licensed, isolated source art.
- The macOS scripts remain a reversible legacy launcher; the native, non-technical
  rich gallery is the supported Windows WebView2 experience.

## Maintenance notes

- Keep stable IDs and released legacy aliases intact.
- Add picker metadata and both appearance modes before registering a theme.
- Preserve readable, operable UI when artwork is absent.
- Update shared semantic styling before adding one-off selectors.
- Recheck selectors when `claude.ai` changes its rendered structure.
- Treat screenshot composites as raw references. Only explicit, text-free Studio
  selector derivatives under `assets/theme-art/<id>/` may ship; never inject a
  composite or selector thumbnail into Claude as runtime artwork.
