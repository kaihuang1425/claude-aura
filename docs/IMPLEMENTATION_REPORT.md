# Eight-theme implementation report

## 0.3.x follow-up fixes

Eight changes landed after the initial eight-theme system:

1. **First-sign-in blank screen (fixed).** The WebView loading cover only hid when
   the async theme-injection script confirmed `"installed":true`. The first
   sign-in's OAuth redirect/reload burst could invalidate that script, stranding
   the opaque cover over a loaded, signed-in page until a restart. The first repair
   decoupled page reveal from theme injection, but a live recurrence exposed two
   remaining OAuth races: Aura replaced a requested sign-in popup with a navigation
   in the main WebView, breaking the popup/opener handoff, and an older cancelled
   navigation could complete after its replacement and put the cover back. Aura now
   leaves trusted Claude/sign-in popups unhandled so WebView2 preserves the real
   `window.opener`, correlates starts and completions by `NavigationId`, ignores
   superseded completions, and treats a current claude.ai `DOMContentLoaded` event
   as concrete readiness even when completion later reports cancellation. Theme
   injection remains non-blocking, while genuine current-document failures retain
   the Retry cover. The executable redirect-sequence regression covers stale
   failure, DOM-ready cancellation, genuine failure, success, popup allowlisting,
   and unsafe-scheme blocking. The verified build was installed and the user
   confirmed a successful first sign-in on 2026-07-23. See
   `windows/aura-ui.ps1` and `tests/studio-editor.test.mjs`.
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
6. **Theme-aware running-app identity and Studio launcher.** All eight permanent
   themes now use distinct authored 1254×1254 transparent identity sources,
   deterministically reduced to a transparent 96×96 PNG and a native nine-frame
   ICO at 16/20/24/32/40/48/64/128/256 px. The active identity is shared by the
   main/Studio windows, taskbar, notification area, Studio rail, floating
   launcher, the exact four owned Aura/Studio Desktop and Start shortcuts, and
   exact-target-validated top-level taskbar pins. The running process and every
   managed shortcut persist the same explicit `ClaudeAura` AppUserModelID so
   Windows groups a pinned entry with its live Aura window.
   The host presents one permanently circular 48 px control with a 16 px safe
   edge gap. A whole-button press becomes a drag beyond a DPI-scaled 6 px
   threshold; release before that threshold opens the host action menu with
   Studio and Prompt Shelf visible, and right-click opens the same menu. Hover
   changes material only. It falls back to the complete
   Default design when metadata or an asset is absent or Original look is
   active. Custom schema-v1/v2 kits still opt into one exact
   kit-local 96×96 PNG; the host derives a content-addressed ICO under Aura-owned
    data, while validation enforces dimensions, alpha, contrast, paths, and byte
    budgets.
7. **Theme-aware Studio shell.** Selecting a built-in or user theme now applies
   the same validated visual language to Studio's content shell through one
   strict, artwork-free `studioStyle` projection. Light/Dark colors and alphas,
   approved fonts, radius, blur, and shadow are derived by the theme core and
   exact-shape validated again at the bridge and page boundaries. Active edits
   project the same last-valid document Aura is rendering; Original look applies
   the complete Default projection in System appearance. Renderer artwork,
   personal wallpaper, arbitrary CSS, remote resources, and source paths are
   excluded.
8. **Bespoke permanent-theme Studio chrome.** The eight immutable built-in
   themes now add distinct fixed shell structure on top of the validated colour
   projection: heading/rule proportions, panel/card edge and elevation, rail
   geometry and active marker, and section treatment. Studio freezes the
   generated built-in key set before accepting host metadata, so user themes
   and active drafts retain neutral chrome and cannot claim a permanent
   profile. Reduced motion removes lift; increased contrast and forced colours
   remove decorative profile treatments; the editor stage remains isolated.

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
a theme may declare up to eight `artworkLayers` (optimized WebP or SVG), each
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
PowerShell-hosted Aura window. The later WO-17 matrix supplied actual-Aura
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
CHECKPOINT C. The retired supplemental offline capture method is no longer
part of the verification or acceptance path.

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
| 1 | `default` | Default | No scene artwork; separate Light/Dark full in-page wordmark PNGs |
| 2 | `japanese-film-editorial` | Japanese Film Editorial | Appearance-specific light/dark backgrounds and matched portraits plus separate Light/Dark full in-page wordmark PNGs under `assets/theme-art/japanese-film-editorial/` |
| 3 | `korean-prestige` | Korean Prestige | Pearl-day/midnight architectural backgrounds, matched clean-alpha portraits, and separate Light/Dark full in-page wordmark PNGs |
| 4 | `cartoon-studio` | Cartoon Studio | Appearance-specific light/dark backgrounds, shared original mascot, and separate Light/Dark full in-page wordmark PNGs |
| 5 | `anime-twilight` | Anime Twilight | One layered `assets/theme-art/anime-twilight/background.webp` cityscape plus separate Light/Dark full in-page wordmark PNGs |
| 6 | `study-library` | Study Library | Appearance-specific light/dark paper backgrounds, shared bottom-left still life, and separate Light/Dark full in-page wordmark PNGs |
| 7 | `japanese-idol` | Japanese Idol | Light background/portrait, mutually exclusive dark new-chat/conversation scenes, and separate Light/Dark full in-page wordmark PNGs |
| 8 | `korean-idol` | Korean Idol | Four `assets/theme-art/korean-idol/*.webp` scene assets plus separate Light/Dark full in-page wordmark PNGs |

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

Git tracks the repository baseline, while the current WO-18 work tree also
contains uncommitted implementation changes. `docs/FILE_MANIFEST.md` provides
the exhaustive path-level deliverable list; the table below summarizes that
implementation surface by responsibility.

| Area | Files | Responsibility |
| --- | --- | --- |
| Registry and themes | `themes/registry.json`, the eight canonical theme JSON files, and compatibility files `themes/midnight.json`, `themes/ember.json`, `themes/forest.json`, and `themes/sakura.json` | Canonical IDs, localized metadata, semantic light/dark roles, typography, shape, effects, wallpaper recipes, and legacy migration |
| Shared renderer styling | `assets/base.css`, `assets/theme-variants.css`, `assets/renderer-inject.js` | Semantic production coverage, centralized component variants, root attributes, artwork layers, cleanup, and accessibility preferences |
| Runtime artwork and app identity | `assets/theme-art/`, `assets/theme-art/README.md` | Isolated optional renderer layers, eight separate Light/Dark in-page wordmark pairs, plus eight deterministic 96×96 PNG/nine-frame ICO pairs shared by running and installed identity surfaces |
| Studio selector media and source references | `assets/studio-previews/` | Seven preserved uncropped, user-framable masters plus clearly separated repository-only alternates, authored 1254×1254 launcher sources, eight normalized in-page wordmark sources, prompts, and provenance |
| Compiler and commands | `scripts/theme-core.mjs`, `scripts/theme-core/*.mjs`, `scripts/theme-cli.mjs`, `scripts/webview-cli.mjs`, `scripts/state-cli.mjs`, `scripts/injector.mjs`, `scripts/asset-audit.mjs`, `scripts/build-brand-wordmarks.mjs`, `scripts/build-launcher-assets.mjs`, `scripts/build-studio-themes.mjs`, `scripts/build-release.mjs`, `scripts/build-installer*.mjs` | Validation, compilation, persistence aliases, localized payload metadata, legacy injection, status-only artwork/identity auditing, deterministic artwork generation, Studio metadata generation, release collection, and signed/unsigned Windows installer builds |
| Windows experience | `installer/`, `Install Claude Aura.cmd`, `Uninstall Claude Aura.cmd`, `windows/*.ps1`, `windows/ui-copy.json`, `studio/` | Native per-user setup/uninstall lifecycle, localized trust and prerequisite UI, journaled app-tree prepare/commit/rollback, versioned retry-safe maintenance, DPI-aware content-only host plus Aura Studio, live application, adjustable card/background framing, dynamic theme identity, accessibility, verification/restore helpers, and explicit app/data removal |
| macOS compatibility | `Install Claude Aura.command`, `macos/*.sh`, `macos/launchers/*.command` | Reversible, allowlisted legacy installation, theme switching, verification, and restore without reference composites |
| Verification | `tests/run-tests.mjs`, `scripts/verify-cycle.mjs`, `scripts/asset-audit.mjs`, `package.json`, `config.example.json` | Twenty end-to-end/static checks, payload-only Light/Dark compilation for all eight themes, status-only artwork audits, build commands, and Default baseline |
| Documentation and policy | `README.md`, `CONTRIBUTING.md`, `docs/THEMING.md`, `docs/TROUBLESHOOTING.md`, `docs/WINDOWS_INSTALLER.md`, `docs/FILE_MANIFEST.md`, `docs/SCREENSHOT_PLAN.md`, `docs/ACCEPTANCE_AUDIT.md`, this report, `SECURITY.md`, `NOTICE.md`, `THIRD_PARTY_NOTICES.md`, `.gitignore` | Use, maintenance, installer signing and release procedure, troubleshooting, exhaustive file inventory, repeatable capture, acceptance evidence, licensing, exclusions, and deliverables |

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

The WO-18 feasibility amendment makes the editor task-oriented at the same
1080 × 720 product window. **Create** starts a visual copy of Default.
**Quick customize** keeps localized naming, four essential colour rows,
background scope, basic image actions, privacy, validation, and Save visible
without exposing passing ratios or raw schema groups. **Advanced** retains the
complete state matrix, supporting colours, placement, and exact numeric inputs
beside sliders. Both levels use the same flat image list and selection model.
Light/Dark, page, and Standard/Wide are global preview controls beside the live
preview; dimensions update directly without an Apply step. Selecting an image
or the new-chat area opens its relevant inspector, while explicit inspector
navigation corrects any scroll offset below the opaque sticky header. Image
selection and temporary preview-only hiding use opaque layer identities, so
reorder does not silently switch the edited subject. Personal wallpaper is
labelled as device-local and separate from theme-owned artwork.

The page control is a deterministic preview selector rather than a hidden
navigation command. An explicit New chat or Conversation choice stays pinned
when an asynchronous mirror arrives. Studio keeps a bounded, session-only cache
of at most two validated, exact-size, exact-mode captures—one for each semantic
page—and swaps them immediately. Claude source and SPA-history changes schedule
a new capture through the existing coalesced, generation-guarded mirror path.
When a matching page has not been captured, Studio shows the labelled placement
guide and an explicit **Switch in Aura…** action instead of displaying the other
page as live. This avoids guessing a conversation or abandoning unsent input.

All editor mutations now pass through one serialized/coalescing path. The new
`apply-theme-patch` action accepts one to sixteen exact allowlisted token,
layer, or localized-metadata changes. The page resolves layer identities to the
latest index immediately before sending; PowerShell and Node validate the
envelope independently; and Node applies one patch to a cloned document as one
revision, compile, persistence write, live apply, and Undo entry. Theme IDs are
not editable. The bridge keeps filesystem paths and arbitrary CSS unavailable.

Theme selection now restyles Studio's HTML shell as well as Aura. Both the
registered-theme list and the active editor state receive the canonical
`studioStyle` DTO from the theme core. Its Light/Dark maps carry the validated
canvas, sidebar, surface, raised surface, text hierarchy, accent, on-accent,
border, focus, and alpha values; the shared map carries only approved font IDs,
bounded radius/blur, and a shadow enum. PowerShell and the Studio page require
the exact object shape, then `studio/app.js` maps it to a fixed set of root CSS
variables used by `studio/styles.css` and `studio/editor.css`. The on-accent
value is used for filled controls, and forced-colors rules clear projected
colors so Windows can retain authority.

An active edit's shell style is deliberately calculated from
`lastValidDocument`, even while current invalid values and feedback stay in the
controls. This keeps the Aura payload and Studio shell on the same accepted
revision through rapid edits, Undo/Redo, restart, and recovery. Original look
uses the complete Default projection and System/Windows effective mode rather
than retaining part of the previous custom theme. The projection carries no
artwork or personal-wallpaper URL and exposes no custom CSS or filesystem path;
theme cards, the labelled stage/guide, and the validated launcher mark remain
separate bounded media surfaces.

Permanent-theme chrome is an additional closed page policy, not kit data.
`studio/app.js` snapshots the initially generated built-in IDs, maps only those
eight IDs to fixed `data-studio-shell` branches, and maps host-added themes and
active editor drafts to neutral chrome. `studio/styles.css` gives every
permanent profile a complete and pairwise-distinct non-colour signature across
heading/rule, card/panel, rail/marker, and section variables. The same variables
style the gallery and editor components without touching preview or stage
pixels. No profile block contains raw colours, URLs, paths, images, or artwork.

On supported Windows versions, Aura also makes best-effort Desktop Window
Manager calls for the dark-caption preference and the caption, caption-text,
and border colors of the main and Studio windows. Unsupported attributes,
system policy, and platform-controlled chrome are allowed to win; API exceptions
are logged, and unsuccessful requests do not prevent Studio, the WebView, or
theme selection from working.

Theme metadata and Windows picker chrome, status, error, and accessibility copy
support `en`, `zh-CN`, and `zh-HKTW`. Windows passes the current UI culture to the
theme CLI and decodes the helper's UTF-8 output with an explicit UTF-8
`StandardOutputEncoding`, and reads `config.json` with `-Encoding UTF8`, so
localized metadata is not corrupted when the console falls back to an OEM code
page such as Big5 (cp950) on a Traditional Chinese system. Locale normalization
maps `zh-CN`, `zh-SG`, and
`zh-Hans` tags to `zh-CN`; it maps `zh-HKTW`, `zh-HK`, `zh-MO`, and `zh-Hant`
tags to `zh-HKTW`. Other tags fall back to English. Theme CSS and artwork contain
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

Studio selector media is a distinct asset class under
`assets/studio-previews/masters/`. Seven non-Default cards load preserved,
uncropped PNG masters through the isolated `aura.previews` virtual host. The
registry supplies each initial `x`, `y`, and `zoom` frame, user adjustments are
stored in config, and no crop operation rewrites a master. Six files preserve
the supplied full concept images byte-for-byte; Study Library uses a
byte-for-byte copy of its transparent source-kit book artwork.

These images are decorative picker media beside live labels. They are never
injected into Claude, used as renderer backgrounds, or accepted as visual
evidence. The unused ocean concept is categorized separately under
`assets/studio-previews/references/` and is excluded from releases and installed
copies. `convert-theme-assets.mjs --card-previews` now rebuilds only legacy 640
× 360 compatibility fallbacks without modifying the masters.

The same source-only references area contains
`launcher-marks-v2/`: eight distinct authored transparent 1254×1254 sources and
their exact prompt record. `build-launcher-assets.mjs` deterministically derives
each shipped transparent 96×96 PNG and nine-frame ICO. Sources and prompts never
ship. Built-ins consume the ICO directly for native Windows surfaces and owned
shortcuts; custom themes continue to supply only a 96×96 PNG, from which the host
creates a content-addressed Aura-owned ICO.

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

Results recorded through 2026-07-23:

The current shared work tree has completed every non-visual gate below. Windows
release candidates are built from the explicit distribution allowlist and
checked byte-for-byte against the workspace and installed application. Each
source edit invalidates that snapshot, so the authoritative archive digest is
the generated `.sha256` sidecar and the final candidate must be rebuilt and
reinstalled after the source tree and live checkpoint settle.

| Check | Result |
| --- | --- |
| `npm test` | Passed, 22/22 |
| `npm run check` | Passed, 22/22; includes JavaScript and platform parsing plus the complete test suite |
| `npm run verify:cycle` | Passed, 17/17; the payload-only verifier runs the test suite, then compiles and syntax-checks all eight themes in Light and Dark; it launches no browser and writes no images |
| PowerShell parser | Passed for all eight `windows/*.ps1` files through the suite; the edited `windows/aura-ui.ps1`, `windows/install.ps1`, and `windows/uninstall.ps1` also pass an explicit zero-error parse |
| Explicit payload budgets | Passed 48 locale/theme/appearance cases; maximum payload-minus-art 64,430 bytes and maximum embedded art 662,664 bytes |
| Lint | Not configured in the repository; there is no linter dependency or lint script, so this gate is explicitly not applicable rather than represented by `npm run check` |
| Typecheck | Not applicable; the project contains JavaScript, PowerShell, and shell sources with no TypeScript sources, `tsconfig.json`, or typecheck script |
| Historical `npm run release` snapshot | The earlier 2026-07-22 WO-18 snapshot produced a 153-entry, 15,024,082-byte archive with SHA-256 `8d2e113aaca9483ea9802f0e647f15a6403641106358c3461df485e3ba3ff248`. It predates the current uncommitted fixes and is not current release evidence. |
| Current Windows release status | A provisional versioned candidate is present and has passed exact workspace ↔ ZIP ↔ installed-tree path/hash comparison. Its digest is recorded only in the generated `.sha256` sidecar so the packaged report does not invalidate its own archive. Rebuild, reinstall, and repeat the comparison after every source edit and once more after HUMAN CHECKPOINT D and HUMAN CHECKPOINT CODE. |
| WO-18 in-page brand identity | The repository-only reference tree freezes one normalized horizontal `Claude` source per built-in and records source provenance/prompts: exact supplied full lockups for Japanese Film Editorial and Japanese Idol, the approved supplied Korean Idol raster, and newly authored Default, Korean Prestige, Cartoon Studio, Anime Twilight, and Study Library directions. The deterministic builder emits appearance-specific Light/Dark PNGs under all eight theme-art directories. One artwork-budgeted renderer channel preserves the native wrapper, reveals one inert image only after decode on a unique expanded host, and restores the native visual for collapsed/undersized, ambiguous, failed, forced-colors, Original-look, cleanup, and remount paths. Runtime derivatives and the builder ship; normalized sources, prompts, and ignored source kits do not. This is mechanical implementation evidence only: live expanded-sidebar Light/Dark quality across all eight themes and selector/fallback behavior remain open at HUMAN CHECKPOINT D. |
| Windows title-bar source check | Passed; best-effort DWM dark-caption and caption/text/border attributes are present with a non-fatal fallback path |
| Windows uninstaller dry run | Passed with `-WhatIf`; enumerated only Claude Aura shortcuts plus `%LOCALAPPDATA%\ClaudeAura\app`, `data`, and `webview` |
| Aura Studio framing simulator exercise | Mechanically exercised on 2026-07-18 at the product 1080 x 720 viewport with a WebView bridge simulator. Pointer drags adjusted card and background framing; native range controls, reset/cancel/save, host acknowledgement, reload persistence, live background aspect ratio, zh-HKTW/zh-CN copy, image-load failure handling, and zero fresh-run warnings/errors were checked. This was not an acceptance pass: the offline walkthrough images were retired and deleted on 2026-07-20, and actual-Aura review remains the only visual evidence. |
| WO-10 Cartoon Studio asset cycle | Source/runtime checksum freeze, two-layer decode, status-only asset audit, Light/Dark payload compilation, and actual-Aura Light/Dark review pass. The user approved the visual evidence at HUMAN CHECKPOINT C; the narrower 1280 x 720 stress case remains in WO-16. |
| WO-11 Anime Twilight asset cycle | Source/runtime checksum freeze, one-layer decode, status-only asset audit, Light/Dark payload compilation, and actual-Aura Light/Dark 1920 x 1080 review pass. The user approved the visual evidence at HUMAN CHECKPOINT C. |
| WO-12 Study Library asset and appearance cycle | Two-layer decode, main-canvas anchor, status-only asset audit, source/runtime checksum freeze, localized persisted System/Light/Dark control, Light/Dark payload compilation, and user-approved whole-window Light/Dark Aura captures on real `claude.ai`. |
| WO-17 live Aura UX and identity cycle | Complete actual-Aura Light/Dark matrix for all eight themes on live `claude.ai`; Original-look cleanup; Korean Idol new-chat/conversation contexts; representative hover/selected state; Studio Back-to-Aura activation; one content scroller; and Aura title-bar/tray identity at normal DPI and actual 2560 × 1600 / 200% display scaling. |
| WO-18 themed identity/launcher/preview amendment | Twenty-two automated checks, all eight Light/Dark payload cycles, eight status-only asset audits, deterministic mark rebuild equality, exact preview-master hashes/dimensions, non-destructive frame metadata, release/install scoping, and dynamic running-app identity source assertions pass. The installed focused smoke check in `dist/verify/live-aura/wo18-identity-preview-smoke/manifest.json` cycled all eight marks, visibly synchronized Japanese Film across the running app surfaces available in one native full-monitor capture, and proved persisted/resettable 600% framing against an unchanged 1709×920 master. The complete localized editor and permanent-circle launcher cold-start/hover/click/whole-button-drag/menu walkthrough remains HUMAN CHECKPOINT D. |
| WO-18 premium identity correction | The prior generic palette-swapped mark direction was rejected on 2026-07-22. Eight distinct authored sources, deterministic 96×96 PNGs, per-theme nine-frame ICOs, owned Desktop/Start shortcut switching, custom content-addressed ICO derivation, and Original-look Default fallback supersede it. The current source snapshot passes `npm run check` 22/22, `npm run verify:cycle` 17/17, all eight `theme-cli qa <id>` audits with the exact 16/20/24/32/40/48/64/128/256 ICO frame set, and zero parse errors across all eight Windows PowerShell files. The release must still be regenerated after HUMAN CHECKPOINT D and the final source tree settle. WO-18 is not complete; corrected live quality and the complete interaction review remain open. |
| Pinned taskbar identity correction | Installer-created Aura and Studio shortcuts now receive the same explicit `ClaudeAura` AppUserModelID as the running process. A theme change includes only top-level taskbar pins whose exact PowerShell target, installed script, launch arguments, reparse status, and existing identity pass validation; their theme icon and AppUserModelID update in the existing prevalidated transaction and restore together on rollback. Executable Windows regression coverage creates real temporary `.lnk` files, proves identity set/read/clear behavior, discovers the valid pinned copy, and leaves a foreign-identity shortcut unchanged. `npm.cmd run check` passes 64/64, `npm.cmd run verify:cycle` passes 17/17, the edited PowerShell files parse without errors, and `git diff --check` passes. HUMAN CHECKPOINT D remains open for the installed multi-theme taskbar visual review. |
| WO-18 editor-feasibility amendment | The current shared snapshot passes `npm run check` 22/22, `npm run verify:cycle` 17/17, all eight status-only theme audits, and all eight Windows PowerShell parses. Executable core tests cover bounded exact patches, rollback, one-step multi-field Undo/Redo, localized metadata persistence, stable layer identities through reorder, route-section exclusivity, renderer-selected Standard/Wide framing, clipped live-main geometry, and queued/debounced/in-flight unsaved status. Front-end contracts cover visual Create, Quick/Advanced separation, coalescing, exact numeric controls, privacy, validation recovery, the persistent Back/status/Cancel/Save header, and the 1080 px two-pane breakpoint. Exact Windows package/install comparison must be repeated after every source edit. The actual-window interaction and visual approval remain open at HUMAN CHECKPOINT D; no offline substitute is accepted. |
| WO-18 Studio-shell theming amendment | `studioStyleFromTheme` supplies one canonical dual-mode projection to generated built-ins, runtime user-theme listings, and last-valid editor state. Exact bridge/page validation, fixed root-variable mapping, contrast-safe material compositing, Default/System Original-look fallback, on-accent foreground use, forced-colors reset, and artwork/wallpaper/CSS/path exclusions have direct regression coverage. The complete mechanical gates and Windows package/install parity are rechecked after source edits. Acceptance remains Partial until the installed all-eight Light/Dark/System cycle, valid/invalid draft synchronization, user-theme restart, Original-look reset, and accessibility/media-exclusion review complete at HUMAN CHECKPOINT D. |
| WO-18 permanent Studio-shell profiles | Eight closed Aura-owned profile branches add pairwise-distinct non-colour structure for the permanent themes. Selection is limited to the immutable generated-theme snapshot; host-added themes and active drafts use neutral chrome. Regressions require the exact eight IDs, a complete variable set, at least two structural differences per pair, no raw colour/media/path channel, reduced-motion lift removal, and high-contrast/forced-colours decoration removal. `npm run check` passes 22/22, `npm run verify:cycle` passes 17/17, all eight status-only audits pass, and the focused Studio regression passes. Exact Windows package/install comparison must be repeated after every source edit. Acceptance remains Partial until the installed 1080×720 Gallery/settings Light/Dark/System walkthrough confirms each profile and the neutral Quick/Advanced draft boundary. |
| WO-13 Japanese Idol parity cycle | Four production WebPs totaling 489,780 bytes; decoded dimensions, alpha/full-bleed expectations, raster limits, and Light/Dark payload budgets pass. After the first Checkpoint C review rejected the Light framing, the top-right 74%/660px revision was recaptured in actual Aura across Light/Dark new-chat/conversation; Dark is unchanged. The user approved HUMAN CHECKPOINT C on 2026-07-21 and the recorded assets/hashes are frozen. |

Before creating an archive, run the checks and then:

```powershell
npm run release
```

The release builder creates a versioned ZIP and SHA-256 file from explicit
distributable top-level files, directories, and supported file types. Source
control metadata, internal planning records, local configuration/state,
dependency/build output, temporary files, logs, existing release output, and
source-only `assets/studio-previews/references/` are therefore excluded,
including launcher source images and their prompt record. The derived
`assets/theme-art/<id>/launcher-mark.png` and `launcher-mark.ico` files and the
registered preview masters are shipped product media. The native installer
embeds only the release builder's allowlisted ZIP content, re-verifies that
archive before compilation, and performs a hash-verified exact-tree swap.
Repository tests and payload-cycle checks are separate build gates rather than
hidden work performed on the user's computer.

## Visual evidence

Actual whole-window Aura captures on live `claude.ai` are the sole UI visual
evidence. On 2026-07-20 all fixture renders, offline UI boards, comparison
screenshots, and golden images were retired and deleted. `npm run verify:cycle`
is now payload-only and cannot create images; `theme-cli qa <id>` is a
status-only asset audit.

An interactive 2026-07-18 run exercised all eight selections against the
signed-in production `claude.ai` WebView2 window and persisted theme, enabled,
and background state. The revised Aura Studio gallery was inspected in a real
WebView2 host in zh-HKTW and zh-CN, including immediate selection updates and
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

## Supplied references, identity sources, and Studio preview masters

Six supplied full-interface concept images are preserved byte-for-byte and
renamed by frozen theme ID under `assets/studio-previews/masters/`:

- `assets/studio-previews/masters/anime-twilight.png`
- `assets/studio-previews/masters/cartoon-studio.png`
- `assets/studio-previews/masters/japanese-film-editorial.png`
- `assets/studio-previews/masters/japanese-idol.png`
- `assets/studio-previews/masters/korean-idol.png`
- `assets/studio-previews/masters/korean-prestige.png`

`assets/studio-previews/masters/study-library.png` is the preserved transparent
book artwork from that source kit. The unused ocean concept moved to
`assets/studio-previews/references/cartoon-ocean-alternate.png`; it remains in
the repository for future art direction but does not ship. Full composites may
contain sample interface controls and text, so their scope is deliberately
narrow: Aura Studio theme-selection media only, never renderer structure,
Claude backgrounds, or visual evidence. The 640 × 360 WebPs under
`assets/theme-art/<id>/card-preview.webp` remain compatibility fallbacks.
They are never injected into Claude or used as runtime backgrounds.

`assets/studio-previews/references/launcher-marks-v2/` holds the eight authored
transparent 1254×1254 built-in identity sources and exact prompt record. They
remain repository-only; deterministic transparent 96×96 PNGs and nine-frame
ICOs under `assets/theme-art/<id>/` are the distributable derivatives. These
source and derived assets are not live visual evidence. The complete revised
identity-quality review remains pending HUMAN CHECKPOINT D.

`assets/studio-previews/references/in-page-brand-wordmarks-v1/` preserves one
normalized 344×124 horizontal `Claude` source per built-in plus `PROMPTS.md`.
Japanese Film Editorial and Japanese Idol reuse exact supplied full lockups,
Korean Idol reuses its approved supplied raster, and Default, Korean Prestige,
Cartoon Studio, Anime Twilight, and Study Library use newly authored sources
matched to their frozen recipes. `scripts/build-brand-wordmarks.mjs` validates
the source set and emits a separate shipped Light/Dark pair under every
`assets/theme-art/<id>/`. The source tree is excluded from releases, and the
renderer keeps Claude's native compact visual outside a uniquely discovered
expanded sidebar. Mechanical wiring does not replace the required all-eight
actual-Aura Light/Dark and fallback review.

## Remaining limitations

- Aura 0.3 currently themes the live Claude website only. It does not theme the
  native Claude Desktop Code tab or the Claude Code terminal, and it gives
  ordinary web chat no local-project authority. Release-blocking WO-27 is now
  specified as CLI-first: it must prove an official local CLI/Remote Control
  engine through live `claude.ai/code`, consent-based local/no-local setup,
  truthful project/process state, Settings recovery, a named Desktop
  direct-handoff or guidance-only contract, optional VS Code handoff, complete
  benefits/limitations/privacy disclosure, the fixed Aura Code adapter, and
  matching terminal-theme export. Native Desktop remains unchanged and
  unthemed. HUMAN CHECKPOINT CODE must pass before the tutorial or final
  release sweep can begin. WO-27 and the separately planned Claude Desktop
  styling path are now the project's two P0 items: they run ahead of every
  other open item, and the remaining work orders are frozen behind them.
  Desktop styling is a consented, version-gated runtime connection to the
  unmodified signed application, blocked on its own feasibility and policy
  gates; until those pass, native Desktop stays unchanged and unthemed. See
  [`P0_STYLING_PATHS.md`](./P0_STYLING_PATHS.md) for the execution order,
  freeze list, and definition of done, and
  [`handoff/P0_IMPLEMENTER_BRIEF.md`](./handoff/P0_IMPLEMENTER_BRIEF.md)
  for the implementation prompt and budgets.
- Production styling targets the current semantic and ARIA structure rendered by
  `claude.ai`; selectors should be rechecked when that upstream interface changes.
- Native title-bar colors are best-effort. On supported Windows builds, Aura
  requests matching DWM dark-caption, caption, caption-text, and border colors;
  unsupported attributes or system policy can leave some chrome unchanged. The
  themed toolbar and WebView remain independent of this enhancement, and no
  Claude or Windows binary is patched.
- Supplied portrait pixels appear only in uncropped Studio selector masters.
  Renderer backgrounds continue to use isolated project artwork; closer runtime
  portrait fidelity still requires separately licensed, isolated source art.
- The revised themed identity requires an actual-Aura quality pass across the
  running surfaces and four owned Desktop/Start shortcuts at HUMAN CHECKPOINT D;
  source files and offline asset inspection cannot close that gate.
- The eight built-in in-page wordmark pairs require the same actual-Aura
  checkpoint in expanded Light and Dark navigation plus collapsed/native,
  asset-failure, forced-colors, Original-look, and SPA-remount fallback states.
  Compiled payload and lifecycle assertions cannot prove current upstream
  selector compatibility, native interaction preservation, or final visual
  fit.
- Studio shell projection intentionally excludes renderer artwork and personal
  wallpaper. Its all-eight mode cycle, last-valid/error behavior, saved-theme
  restart, Original-look reset, and forced-colors behavior still require the
  installed live review at HUMAN CHECKPOINT D.
- The macOS scripts remain a reversible legacy launcher; the native, non-technical
  rich gallery is the supported Windows WebView2 experience.

## Maintenance notes

- Keep stable IDs and released legacy aliases intact.
- Add picker metadata and both appearance modes before registering a theme.
- Preserve readable, operable UI when artwork is absent.
- Update shared semantic styling before adding one-off selectors.
- Recheck selectors when `claude.ai` changes its rendered structure.
- Register a full concept composite only as a theme-scoped Studio master under
  `assets/studio-previews/masters/`, with separate framing metadata. Put
  unassigned alternates under source-only `references/`. Never inject either
  class into Claude as runtime artwork or use it as visual evidence.
