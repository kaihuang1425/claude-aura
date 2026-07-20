# Eight-theme implementation report

## 0.3.x follow-up fixes

Five changes landed after the initial eight-theme system:

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
4. **Aura appearance preference.** Aura Studio now persists an independent
   System/Light/Dark selection. The Windows host applies the supported WebView2
   profile preference before navigation and after live changes, while the
   renderer maintains only namespaced selected/effective-mode attributes for
   token fallback. It never mutates Claude mode classes, attributes, storage, or
   account settings, and Original look restores the profile to Auto.
5. **Appearance-authored production artwork.** Themes no longer rely on a
   blanket darkening pass for pale artwork. Japanese Film Editorial, Cartoon
   Studio, Study Library, Japanese Idol, Korean Idol, and Korean Prestige select
   dedicated dark production layers where needed. Anime Twilight intentionally
   reuses its intrinsically dark cityscape, and Default remains artwork-free.

## Japanese Idol runtime artwork

The `themes/japanese-idol/` production asset kit is the supplied, gitignored
source of truth. Its shippable derivatives under
`assets/theme-art/kawaii-idol/` are the light background and portrait plus
independently authored dark new-chat and conversation scenes. The two dark
scenes use consistent night lighting but different subject framing: higher and
farther right for new chat, lower and smaller for conversation. The renderer
selects only the appearance/context-matched layers as inert, pointer-safe
decoration scoped to `[data-claude-aura-theme="japanese-idol"]`. In light
appearance the isolated portrait is new-chat-only; conversation pages keep the
floral atmosphere without placing a faint face behind Claude content. After
Checkpoint C rejected the original bottom-right Light framing, the portrait was
reframed to `right top / auto min(74%, 660px)`, matching Dark's high/right focal
height while keeping the live greeting and composer off the face.

WO-13's 2026-07-21 actual-Aura evidence records Japanese Idol in Light and Dark
across both new-chat and conversation contexts under
`dist/verify/live-aura/wo13-japanese-idol-*-revision-normal-aura-window.jpg`.
The superseding live review confirms two Light layers on new chat, the floral
background alone in Light conversation, and exactly one matching
context-specific Dark scene in
each Dark capture, with legible controls and no cross-theme artwork. The user
approved HUMAN CHECKPOINT C on 2026-07-21; the four production assets and their
recorded source/runtime hashes are frozen.

The runtime claude.ai skin ships real artwork through a layered artwork system:
a theme may declare up to four `artworkLayers` (optimized WebP or SVG), each
embedded as a data URL only when that theme is active and rendered as an inert,
pointer-safe backdrop with per-layer position, size, opacity, mobile behavior,
appearance, semantic context, and an optional edge-fade mask. Japanese Idol
uses four registered files but displays at most its two light layers or one
context-specific dark scene. Budgets are enforced by tests: chrome payload
under 65 KB and embedded artwork under 1.4 MB. `npm run verify:cycle` compiles
and syntax-checks the exact payload for all eight themes in Light and Dark
without rendering or writing images. Visual approval requires the real Aura
WebView2 window on live `claude.ai`.

## Cartoon Studio approved artwork

WO-10 replaced the procedural Cartoon Studio stand-in with an approved 1600 x
900 cream paper/doodle background and an original 835 x 1032 transparent
mascot. WO-17 adds an independently authored 1600 x 900 deep teal-charcoal
background selected only in Dark appearance; the mascot is safely reused in
both modes on new chat and hidden on conversation pages. Three approved tool
doodles remain source-only because
the changing live Claude DOM does not provide stable card-art anchors. The
generated source kit, hashes, and provenance live under the gitignored
`themes/cartoon-studio/`; the three shippable derivatives live under
`assets/theme-art/cartoon-studio/`. `theme-cli qa cartoon-studio` records a
status-only asset and payload audit. The 2026-07-21 WO-17 actual-Aura matrix
records both Light and Dark on live `claude.ai`; the separate approximately
1280 × 720 stress review remains ordered under WO-16.

At WO-10 completion, the available bridge could not target the
PowerShell-hosted Aura window; the two exhausted attempts remain recorded under
WO-09 in `docs/plans/BLOCKED.md`. The later WO-17 matrix supplied actual-Aura
Light/Dark evidence, and the user approved it at HUMAN CHECKPOINT C on
2026-07-21. Fixture and QA images have been deleted and cannot be regenerated
as a substitute.

## Anime Twilight approved artwork

WO-11 replaces the procedural Anime Twilight stand-in with one approved inert
1600 x 900 WebP background: a painterly indigo/violet cityscape with pale-cyan
atmosphere and restrained warm window light. The generated source kit, exact
prompt, checksum freeze, and provenance live under the gitignored
`themes/anime-twilight/`; the shippable derivative lives at
`assets/theme-art/anime-twilight/background.webp`. `theme-cli qa
anime-twilight` records a status-only asset and Light/Dark payload audit.

The 2026-07-21 WO-17 actual-Aura matrix records Anime Twilight Light and Dark
at 1920 × 1080 on live `claude.ai`; the user approved that evidence at HUMAN
CHECKPOINT C. A separate two-attempt failure for the retired supplemental
offline capture is preserved as history under WO-11 in
`docs/plans/BLOCKED.md`; that method is no longer part of the verification or
acceptance path.

## Study Library approved artwork

WO-12 replaced the procedural Study Library SVG with a 1600 x 900 ivory
paper-fiber background and a 640 x 527 transparent desk/library still life.
WO-17 adds an independently authored 1600 x 900 deep forest-charcoal archival
paper background selected only in Dark appearance; the still life is safely
reused. The renderer measures the live main-canvas edge so only the `left
bottom` vignette—not either full-bleed background—is offset around Claude's
sidebar. The Studio selector card is deterministically composed from the light
masters. Source masters, prompts, provenance, and checksums remain in the
gitignored `themes/study-library/`; the shippable derivatives live under
`assets/theme-art/study-library/`. `theme-cli qa study-library` records a
status-only asset and Light/Dark payload audit.

WO-17's 2026-07-21 live matrix records the dedicated Dark artwork in the actual
Aura window. Separate earlier user-supplied whole-window captures at
`dist/verify/live-aura/06-study-library-{light,dark}-aura-window.png` show the
actual Aura WebView2 on live `claude.ai`, decoded art, clear controls, and
legible Light/Dark materials. The user approved that mini-checkpoint on
2026-07-20; these live captures are the visual review evidence.

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
| 2 | `japanese-film-editorial` | Japanese Film Editorial | Appearance-specific light/dark backgrounds and matched portraits under `assets/theme-art/japanese-film-editorial/` |
| 3 | `korean-prestige` | Korean Prestige | Pearl-day/midnight architectural backgrounds plus matched clean-alpha portraits |
| 4 | `cartoon-studio` | Cartoon Studio | Appearance-specific light/dark backgrounds plus shared original mascot |
| 5 | `anime-twilight` | Anime Twilight | One layered `assets/theme-art/anime-twilight/background.webp` cityscape |
| 6 | `study-library` | Study Library | Appearance-specific light/dark paper backgrounds plus shared bottom-left still life |
| 7 | `japanese-idol` | Japanese Idol | Light background/portrait plus mutually exclusive dark new-chat/conversation scenes |
| 8 | `korean-idol` | Korean Idol | Four `assets/theme-art/korean-idol/*.webp` assets: light scene, hero, dark new-chat scene, and dark conversation scene |

The order is defined once in `themes/registry.json` and reused by command-line,
Aura Studio, and validation consumers.

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
| Compiler and commands | `scripts/theme-core.mjs`, `scripts/theme-cli.mjs`, `scripts/webview-cli.mjs`, `scripts/state-cli.mjs`, `scripts/injector.mjs`, `scripts/asset-audit.mjs`, `scripts/build-studio-themes.mjs`, `scripts/build-release.mjs` | Validation, compilation, persistence aliases, localized payload metadata, legacy injection, status-only artwork auditing, Studio metadata generation, and release collection |
| Windows experience | `Install Claude Aura.cmd`, `Uninstall Claude Aura.cmd`, `windows/*.ps1`, `windows/ui-copy.json`, `studio/` | DPI-aware localized native gallery plus Aura Studio, live application, adjustable card/background framing, accessibility, best-effort DWM title-bar palette, allowlisted install, verification/restore helpers, and explicit app/data removal |
| macOS compatibility | `Install Claude Aura.command`, `macos/*.sh`, `macos/launchers/*.command` | Reversible, allowlisted legacy installation, theme switching, verification, and restore without reference composites |
| Verification | `tests/run-tests.mjs`, `scripts/verify-cycle.mjs`, `scripts/asset-audit.mjs`, `package.json`, `config.example.json` | Twenty end-to-end/static checks, payload-only Light/Dark compilation for all eight themes, status-only artwork audits, build commands, and Default baseline |
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

Aura Studio is the supported customization path approved at HUMAN CHECKPOINT B
on 2026-07-19.
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
are logged, and unsuccessful requests do not prevent Studio, the WebView, or
theme selection from working.

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

Korean Prestige uses appearance-specific architectural WebP backgrounds and
matched clean-alpha portrait twins. Japanese Film Editorial uses appearance-
specific WebP backgrounds and matched transparent portraits. Their hero WebPs
carry real alpha and are new-chat-only; a regression assertion rejects baked
checkerboard or matte exports. Cartoon Studio
uses appearance-specific project-generated backgrounds plus one shared mascot
with frozen source masters under `themes/cartoon-studio/`, and Anime Twilight
uses one project-generated, user-approved WebP background with its frozen source
master under `themes/anime-twilight/`. Study Library uses appearance-specific
paper backgrounds plus one shared still life with frozen source masters under
`themes/study-library/`. Japanese Idol uses four derived WebP copies from the supplied kit under
`themes/japanese-idol/`, and Korean Idol uses four derived WebP layers from the
kit supplied under `themes/korean-idol/`: `light-scene`, `hero`,
`dark-new-chat`, and `dark-conversation`. Both source directories remain
gitignored. Runtime artwork is separate from the functional interface,
contains no embedded controls or UI text, and is non-focusable, hidden from
assistive technology, and pointer-inert. Default uses no renderer artwork.

Studio selector media is a distinct asset class: six cards use small art-only
crops from the supplied visual references and Study Library uses a
deterministic composition of its two approved source masters. Reference pixels
occur only in these decorative selector thumbnails, next to live labels; full
interface composites are never injected into Claude as renderer art.

The raw `theme_demo_previews` composites remain art-direction sources only. The
runtime compiler never reads or embeds them, and the release builder skips the
directory entirely. `convert-theme-assets.mjs` may derive small text-free
Studio selector crops into `assets/theme-art/<id>/`; only those compressed
derivatives are served by the local `aura.assets` virtual host.

User-selected background images remain local decorative inputs and are
validated for supported extension, matching content signature, and size before
compilation. Animated GIF, APNG, WebP, and AVIF layers are suppressed whenever
Aura or the operating system requests reduced motion.

The background's focal point and zoom are persisted as strict numeric values and
compiled into the renderer's exact cover geometry. For editing, the host copies
the selected bytes into a marker-owned, content-addressed cache exposed only as
the isolated `aura.background` virtual host; neither the source path nor an
arbitrary page-supplied path crosses the bridge. Replacing an image with different
bytes at the same size and timestamp produces a new Studio image URL, and junction
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
embedded artwork under 1.4 MB (Japanese Idol is currently the largest at about
653 KB encoded across its four registered layers). Warm local eight-theme compilation on 2026-07-16 had a
median near 1–2 ms. A full native save, atomic configuration write, and payload-return
audit measured about 52 ms median and below 60 ms maximum across the eight
themes. The automated suite enforces a strict 65,000-byte budget for all 24
locale/theme combinations without a user image and asserts zero artwork data
URLs for Default or the validated registered-layer count for a decorated theme.
The 2026-07-21 explicit 48-case locale/theme/Light-Dark audit measured a
64,700-byte maximum payload-minus-art value (`zh-CN`, Korean Idol, Light) and a
653,140-byte maximum embedded-art value (Japanese Idol), below the 65,000-byte
and 1,400,000-byte limits.

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
npm run studio:build
npm test
npm run check
npm run verify:cycle
```

The automated suite covers the eight-theme registry, semantic completeness,
contrast guardrails, locale metadata, fallback and persistence behavior,
payload/root-attribute behavior, isolated artwork policy, script parsing,
Windows picker metadata, Studio bridge/framing validation and cache regressions,
payload compilation in both appearance modes, the prohibition on fixture-image
generation, and release exclusions. `theme-cli qa <id>` writes only a JSON
asset/payload status record; it does not create a UI board or screenshot.

Results recorded through 2026-07-21:

| Check | Result |
| --- | --- |
| `npm test` | Passed, 20/20 |
| `npm run check` | Passed; JavaScript and platform parsing plus the 20-test suite |
| `npm run verify:cycle` | Payload-only verifier: runs the test suite, then compiles and syntax-checks all eight themes in Light and Dark (17 gates); it launches no browser and writes no images |
| PowerShell parser | Passed on `windows/aura-ui.ps1`: 11,986 tokens, zero errors |
| Explicit payload budgets | Passed 48 locale/theme/appearance cases; maximum payload-minus-art 64,700 bytes and maximum embedded art 653,140 bytes |
| Lint | Not configured in the repository; there is no linter dependency or lint script, so this gate is explicitly not applicable rather than represented by `npm run check` |
| Typecheck | Not applicable; the project contains JavaScript, PowerShell, and shell sources with no TypeScript sources, `tsconfig.json`, or typecheck script |
| `npm run release` | Passed on the completed source; archive inspection found `assets/brand/aura-mark.svg` and `assets/brand/claude-aura.ico` |
| Release archive rebuild | Passed on 2026-07-17; the versioned ZIP and matching SHA-256 sidecar were regenerated from the explicit distribution allowlist, with no local configuration, composite-reference, or nested-release entries |
| Windows title-bar source check | Passed; best-effort DWM dark-caption and caption/text/border attributes are present with a non-fatal fallback path |
| Windows uninstaller dry run | Passed with `-WhatIf`; enumerated only Claude Aura shortcuts plus `%LOCALAPPDATA%\ClaudeAura\app`, `data`, and `webview` |
| Aura Studio framing walkthrough | Passed on 2026-07-18 at the product 1080 x 720 viewport with a WebView bridge simulator. Pointer drags adjusted card and background framing; native range controls, reset/cancel/save, host acknowledgement, reload persistence, live background aspect ratio, zh-TW/zh-CN copy, image-load failure handling, and zero fresh-run warnings/errors were verified. The offline walkthrough images were retired and deleted on 2026-07-20 and are not acceptance evidence. |
| WO-10 Cartoon Studio asset cycle | Source/runtime checksum freeze, two-layer decode, status-only asset audit, Light/Dark payload compilation, and actual-Aura Light/Dark review pass. The user approved the visual evidence at HUMAN CHECKPOINT C; the narrower 1280 x 720 stress case remains in WO-16. |
| WO-11 Anime Twilight asset cycle | Source/runtime checksum freeze, one-layer decode, status-only asset audit, Light/Dark payload compilation, and actual-Aura Light/Dark 1920 x 1080 review pass. The user approved the visual evidence at HUMAN CHECKPOINT C. |
| WO-12 Study Library asset and appearance cycle | Two-layer decode, main-canvas anchor, status-only asset audit, source/runtime checksum freeze, localized persisted System/Light/Dark control, Light/Dark payload compilation, and user-approved whole-window Light/Dark Aura captures on real `claude.ai`. |
| WO-17 live Aura UX and identity cycle | Complete actual-Aura Light/Dark matrix for all eight themes on live `claude.ai`; Original-look cleanup; Korean Idol new-chat/conversation contexts; representative hover/selected state; Studio Back-to-Aura activation; one content scroller; and Aura title-bar/tray identity at normal DPI and actual 2560 × 1600 / 200% display scaling. |
| WO-13 Japanese Idol parity cycle | Four production WebPs totaling 489,780 bytes; decoded dimensions, alpha/full-bleed expectations, raster limits, and Light/Dark payload budgets pass. After the first Checkpoint C review rejected the Light framing, the top-right 74%/660px revision was recaptured in actual Aura across Light/Dark new-chat/conversation; Dark is unchanged. The user approved HUMAN CHECKPOINT C on 2026-07-21 and the recorded assets/hashes are frozen. |

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

Actual whole-window Aura captures on live `claude.ai` are the sole UI visual
evidence. On 2026-07-20 all fixture renders, offline UI boards, comparison
screenshots, and golden images were retired and deleted. `npm run verify:cycle`
is now payload-only and cannot create images; `theme-cli qa <id>` is a
status-only asset audit.

An interactive 2026-07-18 run exercised all eight selections against the
signed-in production `claude.ai` WebView2 window and persisted theme, enabled,
and background state. The revised Aura Studio gallery was inspected in a real
WebView2 host in zh-TW and zh-CN, including immediate selection updates and
keyboard focus traversal. Its framing behavior is also covered by executable
bridge, persistence, and input-validation checks; retired simulator images are
not evidence.

WO-17 adds a native 16-image whole-window matrix for every stable theme in
Light and Dark, plus the live context and identity checks below. The raw files
remain gitignored because the authenticated sidebar contains user account data;
the local `dist/verify/live-aura/wo17-self-capture-manifest.json` records every
matrix filename, timestamp, byte count, and SHA-256 digest.

| WO-17 live Aura evidence | SHA-256 | Result |
| --- | --- | --- |
| `08-korean-idol-dark-conversation-normal-aura-window.jpg` | `5f2c809e0b7a3e9237c2851466a288f03f092054cb4081de544b612ecc179fdd` | Dark conversation art/context; composer untouched |
| `08-korean-idol-light-conversation-wide-aura-window.jpg` | `23cbad22018324746bcd7a81c83df2d335c5542efbf92f2b252b00c575309293` | Light conversation art/context; composer untouched |
| `wo17-live-hover-selected-light-conversation-aura-window.jpg` | `e88209085500bd77215681a1eac001b6c55973e90ba719b437448f37f41bddbb` | Live low-alpha hover with selected conversation still visible and no transform |
| `wo17-aura-titlebar-high-dpi-200pct-live-new-chat-window.jpg` | `cc13896dab1d0a72aea8e56695f84468df7146204386b60af234e9a52a5e04df` | Complete Aura window on live `claude.ai` at 200% scaling |
| `wo17-notification-area-overflow-high-dpi-200pct.jpg` | `99bf6f3facac294ab97dbd00f020407422eea01f0d50f9d09d780fe4da864ea1` | Supplemental 200% notification-area icon inspection |

The live DOM probe reported the expected theme/appearance/context, exactly one
Aura sidebar marker, no new-chat prompt marker on conversation pages, and all
four Korean Idol layers scoped to `conversation`. Studio's actual
`#open-aura` action foregrounded the existing Aura window while the separate
Claude Desktop action remained distinct. Original look visibly removed Aura
artwork, sidebar material, prompt styling, and forced appearance. After the
high-DPI review, the Korean Prestige/Dark user config and original single
primary 1920 × 1080 display topology were restored.

WO-12 adds the first per-theme approved whole-window production pair. Both
files remain under the gitignored live-evidence tree because the authenticated
sidebar contains user account data:

| Live Aura file | Mode | Outer pixels | SHA-256 | Review |
| --- | --- | ---: | --- | --- |
| `dist/verify/live-aura/06-study-library-light-aura-window.png` | light | 1177 x 664 | `930a65512092c3d450f1c583b16a369b942f75843ffb4bb3b83de0816aa39d15` | Approved 2026-07-20 |
| `dist/verify/live-aura/06-study-library-dark-aura-window.png` | dark | 1172 x 668 | `68b64d2caea345ebe776d57446557775e64f739bcd0dd4dafe3e41f03c510d27` | Approved 2026-07-20 |

These are real Aura WebView2 captures of live `claude.ai`; their recorded hashes
identify the reviewed files without establishing an automated image baseline.

## Supplied references and Studio selector derivatives

All seven supplied source files are opaque full-interface composites rather than
isolated renderer artwork. The originals are ignored by Git, installers,
runtime compilation, and release collection:

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
Study Library card is composed from its two approved source masters instead.
These local thumbnails are decorative selector media with live adjacent labels.
They are never injected into Claude or used as runtime backgrounds.

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
