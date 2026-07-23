# Actual Aura visual-evidence protocol

This protocol defines the only accepted UI visual evidence for Claude Aura:
a whole-window capture of the actual Aura WebView2 application displaying live
`claude.ai`. It does not authorize any offline visual surrogate.

## Permanent non-image verification policy

`npm run verify:cycle` compiles and validates the production renderer payload
for all eight stable theme IDs in both Light and Dark. It does not open Edge,
load a reconstructed or fake Claude DOM, render an interface, take a
screenshot, compare pixels, or write image files.

`node scripts/theme-cli.mjs qa <id>` audits the registered production assets
and both payload modes, then writes `status.json` only. It does not produce a
board, preview, composite, crop, checker, or other image.

The following are permanently excluded from build, verification, acceptance,
and documentation workflows:

- reconstructed or fake Claude DOM pages;
- fixture UI images and headless-browser screenshots;
- QA-board images, contact sheets, pixel-diff images, and image goldens;
- offline theme previews or reconstructed interface screenshots; and
- relabelling any offline render as actual Aura evidence.

Production artwork and decorative Studio card media remain product assets, not
evidence. Source references and asset guides may inform production work, but
they never prove runtime behavior.

## Actual Aura WebView2 review

For every visual-acceptance pass, launch the real Aura main window with an
authenticated live `claude.ai` document.
Claude Desktop, an ordinary browser, a content-only WebView capture, Studio,
an asset guide, and any reconstructed page are not whole-window Aura evidence.

Prefer a dedicated test account or profile with no private history. Keep the
real sidebar visible so the themed canvas, sidebar overlay, and Windows chrome
are exercised together. If account data cannot be excluded, store captures
only under the gitignored `dist/verify/live-aura/` tree; never copy them into
tracked documentation, release archives, issues, or pull requests.

For each capture:

1. Apply the requested theme and Light or Dark appearance through Aura Studio.
   This local Aura preference must not alter Claude account settings.
2. Confirm that the WebView document is live `claude.ai`, the loading cover is
   gone, and the root reports the expected Aura theme, payload digest, selected
   appearance, effective mode, and page context.
3. Wait for every applicable production artwork layer to decode and for two
   animation frames to settle. A missing, duplicated, ghosted, or wrong-context
   layer fails the capture.
4. Capture the entire Aura window, including title bar, WebView bounds, real
   sidebar, content canvas, and any requested live menu or dialog. Do not crop
   to WebView content, reconstruct the page, or edit captured pixels.
5. Record theme ID, appearance, `new-chat|conversation|other` context, UTC
   timestamp, commit, payload digest, outer-window pixels, WebView CSS viewport,
   DPR, Windows display scaling, maximized state, and capture path in a manifest
   beside the images.

## Required live matrix

Capture all eight stable theme IDs in both Light and Dark at a normal desktop
window size, in registry order. Use filenames of the form
`<order>-<theme>-<mode>-aura-window.<native-extension>`; the extension must
match the untouched capture MIME (`.jpg` for `image/jpeg`, `.png` for
`image/png`). Record the actual viewport rather than claiming a target size
that Windows chrome or display scaling did not produce.

For themes with context-specific artwork or prompt placement, capture both an
empty new chat and an existing conversation. Korean Idol specifically requires:

- Light and Dark new-chat scenes with the upward-framed prompt composition;
- Light and Dark conversation scenes using the conversation framing without
  moving the conversation composer; and
- normal-window and maximized/fullscreen captures proving a single intended
  scene, stable focal point, and no duplicate portrait or ghost layer.

Also capture these stress cases when the available display supports them:

- Cartoon Studio Light at approximately 1280 × 720;
- Anime Twilight Dark at approximately 1920 × 1080;
- Korean Idol Dark at high DPI; and
- one real Claude menu plus one real modal or dialog across the art-heavy
  themes, proving decoration neither overlaps nor intercepts those surfaces.

For a Full-window background scope, the artwork must visibly extend behind the
sidebar and the marked sidebar must remain legible as one translucent overlay.
For Content-canvas scope, the sidebar must remain outside the artwork field.
Exercise both scopes during custom-theme acceptance.

### Floating launcher interaction

Cycle all eight stable themes and confirm the permanently compact 48×48
circular launcher changes to the registered local mark, surface, border, and
hover material without moving closer than 16 px to a content edge. It must be
visible at the correct bottom-right inset immediately after a cold launch from
an installed shortcut, without first moving the Aura window. For each switch,
confirm that the same mark also appears on the Aura and Studio windows,
taskbar, notification area, Studio rail, and the exact four installed
**Claude Aura**/**Claude Aura Studio** Desktop and Start shortcuts; unrelated
shortcuts must remain untouched. Original look must restore Default across all
of them. Inspect native identity at normal and high DPI so the
16/20/24/32/40/48/64/128/256 ICO frames remain crisp rather than a single
upscaled bitmap.

Keep whole-window evidence for at least one light launcher and one dark
launcher at rest and on hover. Both states remain the same 48×48 circular
window; there is no expanded pill, text label, divider, or grip. Press anywhere
on the launcher and move beyond the DPI-scaled 6 px threshold to drag it, then
release and confirm the position persists and remains clamped after restart and
a DPI change. Separately press and release without crossing the threshold to
open Studio, and confirm right-click opens the host menu. Finally apply a
temporary theme with no `launcher` object and confirm the complete Default
design appears. Theme styling must never hide the launcher, change its
host-owned click/drag/menu semantics, or create more than one launcher window.

For the temporary custom theme, provide only its validated transparent 96×96
PNG and confirm Aura derives and reuses a content-addressed ICO under its owned
data root. The custom kit must not supply an ICO or shortcut path. This complete
revised identity-quality and shortcut cycle remains open at HUMAN CHECKPOINT D
until it is observed in the actual Aura application.

### Built-in in-page wordmarks

In the installed Aura application, cycle all eight built-in themes and inspect
the real top-left navigation in both Light and Dark. At an expanded desktop
sidebar, confirm each complete horizontal `Claude` lockup is readable,
theme-specific, and uncropped. Preserve the defining details: Default's
aubergine/coral orbital sparkle; Japanese Film Editorial's cinnabar
chrysanthemum and serif; Korean Prestige's antique-gold rosette and tailored
serif; Cartoon Studio's coral radial, rounded lettering, and teal accent; Anime
Twilight's lavender radial and dusk serif; Study Library's literary book/nib
language; Japanese Idol's pink handwritten lockup and ornaments; and Korean
Idol's sparkle, dot, heart, lettering, and spacing.

For every theme, the existing native link/button must retain its focus ring,
accessible name, and click behavior. Collapse or narrow the sidebar and confirm
Claude's native compact visual returns without collision or layout shift.
Also cover appearance switching, an asset-load failure, forced colors,
Original look, a same-theme reapply, and a live `claude.ai` SPA navigation.
Each transition must show at most one wordmark and must return to the native
visual whenever discovery or decoding is not safe.

Record whole-window actual Aura evidence for all eight expanded Light/Dark
pairs plus representative collapsed/native and failure fallback, including at
least one exact-source lockup and one newly authored lockup. Generated PNGs,
asset crops, or an offline composite cannot satisfy this check; the all-theme
wordmark review remains open at HUMAN CHECKPOINT D.

### Live sidebar and composer baseline

The supplied Korean Idol concept is a material-and-state direction, not a
Claude feature inventory. Aura may theme only the navigation rows, sections,
footer, composer shell, editor, toolbar, and controls that the authenticated
live page actually supplies. Do not fail a review because Claude says **New
chat** instead of **New session**, exposes a different navigation set, omits a
Chat/Cowork switch, shows real account history, or uses a different model name.
Aura must not add, rename, move, reorder, or hide native content to make a
capture resemble the concept.

Reuse the required all-eight Light/Dark whole-window matrix where possible. In
each expanded-sidebar new-chat frame confirm the existing primary action,
current/selectable rows, section/list regions, footer/account region, raised
composer shell, transparent editor, and native toolbar controls share the
theme's fixed component recipe. The prompt width and position must resolve
against the full unobstructed content canvas beside the sidebar, not a centered
inner column. In each conversation frame confirm the same composer material
without any new-chat translation.

Add representative whole-window states for:

- expanded and collapsed sidebars, including rest, hover, pressed, current,
  keyboard focus, and a disabled state when Claude provides one;
- an empty, focused, typed, long/wrapped, and attachment-expanded composer;
- the model menu plus microphone, voice, native mode, and other icon/pill
  controls when present, and one live layout where an optional control is
  absent;
- normal and wide/maximized geometry, Light/Dark switching, SPA navigation,
  reinjection, and a same-theme reapply with no stale role marker;
- an unrelated editor plus one native menu/dialog proving marker-scoped rules
  do not leak; and
- forced colors and Original look restoring native presentation and focus.

Record the marked full-canvas, outer prompt-group, inner composer-shell, and
sidebar rectangles in the capture manifest when the live probe exposes them.
Missing or ambiguous discovery must fail open. A capture never proves keyboard
order or accessible names, so record a separate keyboard/accessibility pass
confirming that text, roles, names, hit targets, DOM order, menus, and click
behavior remain native. This fixed baseline is part of HUMAN CHECKPOINT D;
post-1.0 WO-25 separately makes the same closed surfaces user-editable.

### Studio locale and introduction

Use an installed profile with its active theme, appearance, personal
wallpaper/assets, preview framing, and any saved or in-progress draft recorded.
With no completed introduction, open Studio from the existing Aura launcher
entry. Confirm one labelled modal greets the user, offers `en`, `zh-CN`, and
`zh-TW`, explains how to try a theme, and leaves every recorded value
unchanged. Complete the dialog using only the keyboard, including focus entry,
Tab/Shift+Tab, language choice, **Try a theme**, **Skip**, Escape, visible
focus, and close-destination focus. Confirm **Try a theme**, **Skip**, and
Escape each persist completion only after host acknowledgement. From Settings,
**Skip** and Escape return focus to the opener; on automatic first run they
focus the Themes navigation item. **Try a theme** focuses the Gallery but must
not apply or preview a theme.

For each supported locale, select it in Settings, close and reopen Studio, and
confirm the choice persists. Reopen the introduction from Settings and inspect
its complete visible, status, and accessible copy in that locale; no mixed
locale, missing key, clipped CJK text, or mechanically reused zh-CN/zh-TW copy
passes. Exit through the named path under test, restart again, and confirm it
does not reopen automatically. Record the mechanical cases proving an unset
or invalid saved choice maps `zh-CN`/`zh-SG`/`zh-Hans` Windows tags to `zh-CN`,
maps `zh-TW`/`zh-HK`/`zh-MO`/`zh-Hant` tags to `zh-TW`, and maps every other
tag to `en`, with `_` normalized to `-` and descendant tags covered.

Before and after the matrix, compare the host-confirmed active theme,
appearance, enabled state, assets, wallpaper, preview framing, and editor draft.
Confirm the live Claude page and account locale are unchanged. Also repeat the
dialog and Settings path in forced colors and reduced motion. Studio captures
may document this Studio-specific flow but cannot replace required
whole-window live-Aura evidence. The first-run, Settings-reopen, persistence,
keyboard, state-preservation, and all-three-locale matrix is part of the
still-open HUMAN CHECKPOINT D.

### Custom-theme workflow

Before beginning the custom edit, cycle all eight registered themes in the
installed Studio under Light and Dark. Confirm that the content canvas, rail,
surfaces, raised surfaces, text hierarchy, accent and filled-accent text,
emphasis borders, focus ring, approved font categories, radius, blur, and shadow
change as one readable shell without a stale-theme flash. Exercise System mode
across an actual Windows Light/Dark change as well. A whole-window Studio
capture may document this Studio-specific review, but it is not whole-window
Aura evidence and cannot replace any live `claude.ai` capture below.

Before editing a theme, open **Adjust card preview** for two built-ins. Drag to
a distant part of each uncropped master, zoom beyond 200%, save, reopen the
dialog, and confirm the frame persists. Reset one theme and confirm its
registry starting frame returns. The master file hashes must remain unchanged;
only `studioPreviewCrops` may change.

Create one temporary custom theme through the installed Studio and keep its
captures under `dist/verify/live-aura/checkpoint-d/`. Record the complete
host-confirmed sequence in the adjacent manifest:

Before creating the temporary theme, cycle all eight permanent themes in the
installed 1080×720 Studio window under Light and Dark, then sample System
before and after a real Windows appearance change. For each theme inspect the
Gallery plus the ordinary wallpaper/Create settings and record at least two
recognizable non-colour cues: heading/rule proportions, card or panel edge and
lift, rail/item geometry, active marker, or section-rule treatment. Confirm no
profile clips actions, changes the one-scroller layout, or alters preview/stage
pixels. This is a live Studio walkthrough, not a replacement for the required
whole-window Aura captures.

1. enter through Create's visual path, duplicate a built-in, give the copy
   distinct en, zh-CN, and zh-TW metadata, and make valid Dark token changes in
   Quick customize. Confirm entering the draft switches to neutral chrome and
   that Quick customize and Advanced keep the same neutral profile. At both the
   normal 1080×720 size and the supported 760×560 minimum, confirm the primary
   canvas remains left of the inspector rather than above it, the ordinary rail
   collapses to its identity mark, and `.content` remains the only page
   scroller. Scroll from the first to the last Quick customize and Advanced control and
   confirm the canvas never gives way to a blank leading pane, token and artwork
   controls remain inside the inspector, and no end action covers either pane.
   Confirm the one-piece sticky inspector header and its Back/status/Cancel/Save
   controls never clip a section. The workspace should use one pane divider, the live-preview frame,
   native input boundaries, and one selected-object treatment; token groups,
   image rows and history actions must not read as nested cards.
   In Quick customize and Advanced, **Interface**, **Background**, and
   **Widgets** must be the only content-family branches. Switching branch or
   detail level changes only the trailing inspector and preserves the selected
   target, preview context, edit scope, draft revision, and canvas position.
   Selecting the prompt outline routes to Interface > New chat area; selecting
   an artwork layer routes to Background and its opaque layer ID; and the
   keyboard target picker can select Widgets > App identity. Every canvas route
   has a complete keyboard alternative. Validation must deep-link to the exact
   branch, target, scope, and visible control rather than becoming a fourth
   branch. No unavailable Phase 2 target may appear as a placeholder. The
   compact target or layer picker must not create a third permanent pane or
   nested page scroller.
   The Light/Dark, page, and Standard/Wide controls must stay beside the preview
   in every inspector context. Editing, Applies to, and Source remain visible
   above the selected target's properties. Before the first host capture
   arrives, select the page
   Aura is not showing and confirm the later capture does not reset that explicit
   choice. For any uncaptured page, confirm the canvas shows the labelled guide,
   **Switch in Aura…**, and no stale capture from the other page. Visit New chat
   and one Conversation in Aura at the same size and theme mode, return to
   Studio, then toggle between them repeatedly; both exact captures must switch
   immediately without another window change. Change two
   controls rapidly and confirm the last visible
   values both reach the host. Confirm the accepted revision updates both the
   actual Aura window and Studio's shell projection. Then create a contrast or
   budget error: the invalid control and feedback must remain visible while
   both windows retain the same previously applied last-valid revision. In
   Advanced, perform one multi-field framing gesture and confirm one Undo
   reverses the complete gesture and one Redo restores it. Reset once; after
   reset, confirm the duplicate still uses the built-in variant recipe and has
   returned to the source's approved Dark composition before continuing;
2. select a layer explicitly scoped to Dark, New chat, and Wide. Switch only
   the preview to Light, Conversation, and a custom Standard width. Confirm the
   selected layer, Applies-to values, Source, draft revision, and Undo history
   remain unchanged. Direct handles must be inert until **Edit this state** or
   **Switch preview** is chosen. Then change the scope explicitly and confirm
   exactly one patch, one revision, and one Undo item. Before importing a new
   layer, confirm its proposed appearance/page scope is visible before the
   picker commits the import. Switch between Standard and Wide, then type
   dimensions immediately below and above 1440 px. Confirm the effective
   preview-result label follows the width while the edit-target selector does
   not, the canvas echoes every valid dimension without waiting for a host
   frame, and the next matching in-memory capture replaces it without an Apply
   step. Confirm these dimensions create no patch, override, Undo item, or third
   saved set and still map to exactly two persisted framing sets.
   During every size change, keep keyboard focus in Studio and confirm Aura does
   not cover or steal focus from the inspector. Use **Review in Aura** once
   and confirm foregrounding the detached live window occurs only from that
   explicit action;
3. import at least one raster through the host picker, confirm local WebP
   conversion and budget feedback, save, apply, close Aura, and relaunch it;
4. prove the saved theme, artwork, and dual-mode Studio shell projection survive
   restart. If the editor is reopened while its current document is invalid,
   confirm Studio restores the persisted last-valid projection rather than the
   invalid controls. Then exercise both visible background choices: **Main area
   only** (the Content-canvas contract) and **Entire window** (the Full-window
   contract);
5. select **Original look** while a distinctive custom shell is visible. Confirm
   that Studio switches to the complete Default projection, appearance returns
   to System, and the effective mode follows Windows rather than retaining any
   custom variable. Reapply the saved theme and confirm its projection returns;
6. for each background scope, in the real signed-in Aura window capture Light
   and Dark at an empty new chat and an existing conversation, first at a
   normal window size and then maximized/fullscreen (the complete scope ×
   appearance × context × viewport matrix); and
7. navigate, change appearance, and resize between captures, confirming one
   mutually exclusive intended scene with no duplicate or ghosted layer. End by
   deleting the temporary theme and verify that Default is active first and no
   installed or draft residue remains.

The evidence set must include the whole Aura outer window and live
`claude.ai`. It must show that **Main area only** / Content-canvas artwork
excludes the sidebar and **Entire window** / Full-window artwork continues
behind one readable translucent sidebar. Record
the Studio locale used for the walkthrough, the usable Quick/Advanced layout at
the normal 1080×720 Studio size, the persistent header Back/status/Cancel/Save controls,
the personal-wallpaper distinction, the
visible in-memory-capture privacy notice, actionable validation recovery,
keyboard operation of every edited control, visible focus, the host-confirmed
save result, and the restart boundary.
Record the automated complete-key localization result for en, zh-CN, and zh-TW
alongside the locale used for the end-to-end walkthrough.
Also enter Windows forced-colors/high-contrast mode and confirm Studio ignores
the projected colors where required, preserves visible native focus and readable
controls, and remains keyboard operable. Confirm that renderer artwork and the
personal wallpaper never become Studio-shell backgrounds; only bounded theme
cards, the labelled guide/stage, and the launcher mark may show their intended
media. Studio itself and its asset guide may support the walkthrough record but
are never substitutes for these live Aura captures. These Studio-shell checks
are part of the still-open HUMAN CHECKPOINT D.

### Phase 2 instant prompts (HUMAN CHECKPOINT E)

This is future WO-19 evidence only. It does not expand HUMAN CHECKPOINT D or
authorize Phase 2 before WO-16. First record the widget-schema, insertion,
cleanup, persistence, localization, and accessibility mechanical results
required by WO-19.

In the installed Aura application on live `claude.ai`, record Instant prompts
under the existing **Widgets** branch in Light and Dark on New chat. Select the
same stable card once from the capture-backed Studio canvas and once from the
keyboard target picker. In Conversation, confirm that the card remains
selected but unavailable, is labelled New chat only, and offers **Switch
preview**. Activate a card by pointer and keyboard; its text must enter and
focus the real composer without sending. Confirm visible focus, no composer or
sidebar overlap, restart persistence, and complete removal of the block and
listeners after Original look, cleanup, and navigation. Whole-window actual
Aura evidence is required; a Studio-only widget preview is insufficient.

### Phase 2 unified editor and responsive surfaces (HUMAN CHECKPOINT F)

This covers WO-20, WO-25, WO-26, and WO-22 after their mechanical gates pass.
It does not authorize them before WO-16 and does not complete Checkpoint F
before package work is ready.

For WO-20, start **Edit on window** from Studio and select representative
registered Interface, Background, and Widgets targets in the actual Aura page.
Confirm every selection returns the stable registered target and routes to the
existing branch; missing or ambiguous probes cannot invent a selector or
target. Drag one eligible target and repeat the change by keyboard. Esc,
closing Studio, and session exit must each remove every overlay node, handle,
marker, and listener without changing normal Claude interaction.

For WO-25, exercise Overall interface, Sidebar, Sidebar identity, Prompt block,
Greeting, one background layer, Instant prompts, and App launcher through the
compact target picker and direct selection where supported. Record:

- native, Theme original, and Customized sidebar identity; the custom mark and
  Light/Dark label font/colour must preserve the literal `Claude` wording,
  native wrapper, destination, accessible name, focus, and hit target;
- expanded presentation plus collapsed/undersized, missing, ambiguous,
  decode-failure, remount, forced-colors, Original-look, and cleanup fallback to
  the complete native sidebar identity;
- prompt-block material and geometry in New chat plus conversation-safe
  presentation, with no change to composer content, focus, submission, hit
  testing, or accessibility;
- neutral and non-neutral bounded hue, saturation, brightness, contrast, and
  blur values in the fixed filter order, including rejection recovery;
- base, Light/Dark, registered-view, and Standard/Wide sparse values with
  truthful Editing, Applies to, and Source labels; Reset must delete the
  override and reveal the inherited result rather than copy it; and
- future-view registration, unavailable-target messaging, Quick/Advanced
  continuity, keyboard parity, and no Cartesian state tree, third pane, nested
  scroller, or unregistered placeholder.

For WO-26, review both a migrated `step` theme and an explicitly opted-in
`fluid` target at CSS widths below 1180, exactly 1180, midpoint 1370, 1439,
1440, exactly 1560, and above 1560. Record the resolved values from theme core,
Studio, renderer, and overlay in the manifest and confirm they agree. Standard
and Wide must remain the only saved endpoints; merely resizing or typing a
custom dimension creates no patch or Undo entry. At the midpoint, verify the
disclosed Both endpoints gesture and the Advanced Standard-only/Wide-only
alternatives. Confirm categorical asset, anchor, text, page, visibility, mask,
and interaction values never interpolate, incompatible endpoints stay `step`
with a named reason, and navigation/resizing leaves no cross-fade, duplicate,
or ghosted surface.

For WO-22, export the latest schema-v5 temporary theme and import it into a
clean profile. Confirm its content-addressed sidebar mark, Interface overrides,
bounded filters, responsive mode/endpoints, portable greeting style, and
Instant prompts round-trip byte- and value-correctly. Confirm personal greeting
names, phrases, shuffle state, wallpaper, launcher position, and every other
host-owned preference are absent. Tampered checksums, paths, unknown manifest
versions, unsupported entries, and oversized packages must fail with the named
reason and leave the installed theme unchanged.

### Phase 2 new-chat greeting personalization (HUMAN CHECKPOINT F)

This is future WO-21 evidence only. It does not expand HUMAN CHECKPOINT D or
authorize Phase 2 before WO-16. First record the mechanical schema, discovery,
privacy, cleanup, accessibility, migration, persistence, and worst-case payload
results required by WO-21.

In the installed Aura application on live `claude.ai`, record the all-eight
built-in greeting profiles in **Use my phrases** mode across Light/Dark and
Standard/Wide: 32 whole-window new-chat states. Keep the Aura outer window,
live page, composer, greeting, theme artwork, and sidebar visible, and record
outer dimensions, CSS viewport, and DPR as for the primary matrix. Confirm each
greeting uses its exact theme recipe, remains inside the main canvas, does not
collide with the composer or artwork, and wraps without clipping.

Add representative whole-window and manifest evidence for:

- **Use Claude greeting**, a missing/empty/invalid custom list, disabled
  personalization, Original look, conversation navigation, and deletion of a
  temporary custom theme, each restoring Claude's native greeting exactly;
- long Latin and CJK phrases, `{name}` substitution from the Studio-entered
  name, and per-theme-over-global phrase precedence;
- resize, Standard/Wide switching, appearance changes, SPA remount, and
  same-theme reapply without a reroll, duplicate heading, or stale marker;
- missing or ambiguous discovery, registered-mark failure, reinjection, and
  cleanup failing open with the native greeting visible; and
- Windows forced colors restoring the untouched native heading with no Aura
  decoration.

Screenshots cannot prove accessibility or keyboard behavior. Record a
Narrator/accessibility-tree pass showing that custom mode exposes the visible
phrase exactly once with heading semantics, hides duplicate native semantics
only after the replacement is ready, remains non-focusable and non-live, and
restores the native heading on failure. Complete the Studio and WO-20 greeting
controls using only the keyboard with visible focus, including source change,
phrase editing, Standard/Wide selection, movement, resize, Undo/Redo,
validation recovery, save, restart, and Reset to Claude.

Judge only what Aura controls: artwork identity, visibility, crop, focal
position, context/appearance/viewport selection, materials, palette,
decorative density, typography category, pointer safety, unobstructed controls,
and sidebar treatment. Exact Claude layout, wording, feature inventory, and
personalized content are out of scope because the live site supplies them.

After cycling all themes, select **Original look** and confirm that every Aura
style, marker, backdrop, context/layout adjustment, and forced appearance is
removed. If live sign-in, the service, or automated whole-window capture is
unavailable, leave the checkpoint open and ask the user to inspect Aura or
provide the required live captures. Never manufacture an offline substitute.

## Recording outcomes

Record live capture paths, dimensions, hashes where useful, and the explicit
user review outcome in `docs/IMPLEMENTATION_REPORT.md` and
`docs/ACCEPTANCE_AUDIT.md`. Record `npm run check`, the non-image
`npm run verify:cycle`, and the applicable `status.json` asset audits as
separate mechanical evidence. Rerun `npm run check` before any commit or
release build.
