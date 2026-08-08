# Theme Kit Spec (Tier 1 — build your own theme)

This is the end-user path. It must stay this simple; tooling absorbs the
base-theme production rigor. If a step here requires reading any other
document, the tooling is not finished.

## Create visually in Studio

1. Open **Claude Aura Studio**, then use **Create** to start visually from
   Default or choose **Duplicate to customize** on another built-in look. A
   built-in is immutable. For an installed user theme, choose **Edit**.
   The ordinary Studio rail opens **Themes**, **Prompt Shelf**, **Personal
   wallpaper**, **Create a theme**, and **Settings** as five exclusive pages
   inside the same Studio window. Switching destinations never reveals the
   next section below the current one, reloads the WebView, or changes product
   state. The rail remains visible, marks exactly one current page, and keeps
   `.content` as the only ordinary page scroller.
2. **Quick customize** opens by default in one focused workspace: the live
   preview stays on the left and its compact inspector stays on the right at
   every supported Studio width. The ordinary gallery rail collapses to its
   identity mark while editing. The inspector uses five non-linear workflow
   stages: **Details**, **Interface**, **Background**, **Widgets**, and
   **Review**. They are destinations, not completion gates; move between them
   in any order without changing the draft. Exactly three of those stages are
   capability branches: **Interface** for the overall palette, materials,
   type, current new-chat prompt target, and **Greeting**; **Background** for
   canvas scope and artwork layers; and **Widgets** for Aura app identity and
   the floating launcher plus **Instant prompts**. Capabilities stay in those
   branches instead of adding destinations or empty placeholders. The fixed
   command and stage header stays outside the inspector's one body scroller,
   so its scrollbar begins below the header. Light/Dark, page, and
   Standard/Wide stay beside the preview in every capability branch. The
   preview and inspector body scroll independently inside the editor
   workspace; the preview is not sticky and never floats over controls lower
   in the inspector. The generated theme ID remains immutable.
3. Edit Light and Dark independently. Advanced Interface provides **Copy Light
   colors to Dark** and **Copy Dark colors to Light** for the editable colour
   and alpha set; each mode can then be refined without changing the other.
   Duplicating a built-in retains its
   complete source recipe, including its Dark-specific composition; Studio
   never derives Dark from Light unless you explicitly choose that copy action.
4. Add up to eight images. Choose Background, Main subject, Corner graphic, or
   Decoration from one **Image type** selector before the host opens its picker.
   The host converts PNG, JPEG,
   WebP, or AVIF input to WebP locally; the Studio page never sends or receives
   a filesystem path. Quick customize Background keeps replace, removal from
   the theme, saved visibility, depth order, and image type available in one
   flat selected-image inspector. A new image defaults to the currently selected Light/Dark
   appearance and New chat/Conversation page instead of leaking into another
   state. A layer intentionally set to All appearances or All pages is labelled
   as shared. For schema-v2 artwork, **All pages** means New chat and
   Conversation only; it never opts the layer into Aura Code. Selection,
   pointer drag, keyboard movement, and reorder keep the same opaque layer ID
   even when another layer is visually above it.
5. The preview and dimension controls stay beside the live preview in both
   editor levels. Choose Standard or Wide, or type a bounded width and height;
   width below 1440 uses the Standard position set and width at or above 1440
   uses the Wide set. There is no Apply action and custom dimensions do not
   silently create more saved sets. The effective preview-result label follows
   the width, but the edit-target selector never moves unless you explicitly
   choose Standard or Wide. Studio echoes dimensions immediately,
   coalesces rapid changes, resizes the
   actual Aura window without bringing it in front, and replaces the canvas
   capture when the matching frame is ready.
6. Switch to **Advanced** for deeper controls inside the same Interface,
   Background, or Widgets branch. Placement, responsive applicability, effects,
   visibility, and diagnostics are property groups for the selected target,
   never more top-level destinations. The preview, branch, target, preview
   context, edit scope, and draft stay in place when the level changes. For an
   image, Advanced adds its exact appearance, page, viewport, mask, mobile
   behavior, and Standard/Wide framing. Pointer dragging, keyboard operation,
   sliders, and exact numeric fields edit the same safe values. Selection and
   temporary **Hide while editing** follow the same layer after reorder and do
   not change saved visibility by accident. In Conversation, a selected
   New-chat-area or Greeting target stays selected but unavailable and inert,
   explains that it is New chat only, and offers **Switch preview** instead of
   silently choosing another object. Greeting provides independent Light/Dark
   and Standard/Wide controls for placement, width, typography, alignment,
   decoration, and an approved native or compact mark.
7. In Background, choose **Sidebar**, **Main area only**, or **Entire window**.
   The canvas keeps the sidebar and main area visibly labelled: clicking a
   blank region selects it, while the explicit Entire window choice combines
   both. The selected image remains available to drag immediately, and artwork
   is clipped to that same measured region in live Aura. The personal wallpaper
   page is separate and does not become part of the theme.
8. The primary canvas uses an in-memory capture of the actual Aura WebView when
   its dimensions, appearance, and page context match the selected state. Drag,
   resize, select, hide-for-editing, and adjust opacity directly over that
   capture; if no matching capture is available, the same canvas falls back to
   the labelled placement guide. On New chat, the renderer marks the detected
   native composer geometry before any custom placement has been authored, so
   the initial selection outline matches the live composer; saved placement
   values override it only when they exist. **Preview page** keeps the user's
   explicit New chat or Conversation choice pinned. Studio remembers at most
   one matching real capture for each page in memory for the current editing
   session, so switching is immediate after both pages have been visited once
   in Aura. A missing page offers **Switch in Aura…**; Aura does not choose an
   arbitrary conversation or navigate away from an unsent prompt. The host refreshes the
   capture after Claude's source or in-page history changes. Captures are never
   written to disk, and the privacy notice remains visible in both editor
   levels. Aura Code is deliberately excluded from this mirror because it may
   contain source, diffs, paths, and tool output. Code inherits validated theme
   presentation but does not become an artwork-placement page. Captures are
   placement aids, not acceptance evidence. **Review in Aura**
   is an explicit detached review action; routine size changes keep Studio in
   front so they do not force a window switch after every adjustment. The local
   prompt builder only drafts asset-generation text and makes no model or
   network call.
9. Choose **Edit on window** to manipulate eligible Aura-owned visuals in the
   actual Aura window on live `claude.ai`. The temporary toolbar first asks you
   to **Pick element**. Recognized Claude sidebar, composer, card, dialog, and
   canvas surfaces route to existing Interface token controls; they are never
   moved or rewritten. A marked new-chat Greeting routes to the existing
   Interface Greeting target. Its overlay-owned proxy can move or resize the
   active Light/Dark and Standard/Wide frame; resize writes real bounded font
   size, line height, maximum width, and mark size rather than a transform.
   A registered artwork layer routes to Background by its opaque layer ID, and
   an Instant prompt routes to Widgets by its opaque card ID. Drag the move or
   scale handle, use the opacity control where offered, or use the arrow keys;
   Alt + arrows resizes and Ctrl + arrows changes opacity or Greeting width.
   Each completed
   pointer or keyboard gesture is one draft change and one Undo step. Missing
   and overlapping probes report missing or ambiguous instead of guessing a
   selector. **Done**, **End window edit**, Esc, navigation, Original look,
   closing Studio, and app exit remove the complete toolbar, handles,
   temporary styles, observers, and listeners. Native Greeting preview stays in
   the overlay proxy until the complete validated frame commits through the
   renderer. This session-only overlay never stores page content, edits a
   Claude-owned node, or runs in Aura Code.
10. Open **Review** for the compact global validation status, then Save. Review
   is a workflow stage, not a fourth capability branch. Passing contrast ratios
   stay out of Quick customize; a problem links to its exact branch, target,
   scope, and visible control, while Advanced provides the full diagnostic
   detail. Back, save status, and Cancel remain together in the fixed inspector
   header outside the body scroller and never cover controls. The final Save
   action belongs to Review. Undo, redo, reset, and delete remain available.
   Deleting the selected user theme first applies Default; built-in themes
   cannot be deleted.

### Staged inspector pages

The five workflow stages organize one draft without turning editing into a
linear wizard:

- **Details / General** is one complete document page. It lets the author
  choose any of Studio's fifteen interface languages and creates one paired
  Name + Description card for each selected language. English (`en`) is the
  required fallback and cannot be removed; the other languages are optional.
  It also shows a truthful Light/Dark support summary. Every theme supports
  both appearances and Save validates both, so Light and Dark are status, not
  switches that can disable one mode.
- **Interface**, **Background**, and **Widgets** are the only capability
  branches. Within the active branch, the target dropdown contains only
  Aura-registered targets. Choosing a target replaces the inspector body with
  that target's one complete page; it never jumps within a stacked,
  multi-target document. Canvas selection may route only among these registered
  branch targets.
- **Review** is one complete page for global validation, budgets, recovery
  links, and final checks. It does not receive canvas selection or add a
  capability target.

The fixed header and stage navigation do not live inside the scrolling body.
The inspector has one vertical body scroller, every page starts at its top when
selected, and no section rail or nested page scrollbar can extend above the
header.

When a theme already has a saved Studio preview master, Details may expose its
device-local card crop and position. That framing is gallery metadata rather
than portable theme content. Studio does not currently support uploading,
replacing, or importing a preview photo from the editor, and the Details page
must not imply that it does.

The explicit built-in layout-authoring mode is capability-filtered instead of
showing disabled or misleading stages. It omits Details and Widgets, exposes
Interface only for the authorized new-chat prompt and Greeting presentation
targets, exposes Background only when the built-in already has artwork and only
for authorized framing, and keeps Review for validation. It cannot change
localized metadata, add preview media, add or remove theme artwork, personalize
greeting words, or edit other unauthorized surfaces.

The editor keeps four questions visibly separate:

- **Previewing** says which appearance, page, dimensions, and effective
  Standard/Wide result the canvas shows.
- **Editing** names the selected target.
- **Applies to** names the appearance, page, and frame scope the next edit will
  change. Shared is an Applies-to value.
- **Source** says Theme original or Customized in schema v2. Later sparse
  schemas may name the exact inherited source, including Standard when Wide is
  linked; they never mislabel shared scope as provenance.

Changing Previewing alone may update the in-memory capture or resize the Aura
window, but it cannot send a theme patch, advance the draft revision, add an
Undo item, or retarget Applies to. If the selected target is unavailable in
the previewed page, Studio preserves it, disables its value controls, explains
the supported page, and offers **Switch preview**. Direct preview selection
routes the prompt outline to Interface, an artwork layer to Background, and a
registered Aura-owned widget to Widgets; the compact keyboard target picker
does the same without adding another permanent pane.

Studio applies the last valid draft directly to the actual Aura WebView on live
`claude.ai`. An invalid edit remains in the editor with named feedback while the
previous valid payload stays active. Save stages the complete kit, validates
both Light and Dark payloads, and atomically replaces the installed user theme;
a failure restores the previous theme and configuration. Saved themes and
their artwork live under `%LOCALAPPDATA%\ClaudeAura\data\themes\`, while active
drafts stay under `%LOCALAPPDATA%\ClaudeAura\data\theme-drafts\`. A saved theme
survives an Aura restart.

Each Undo and Redo entry also retains the valid payload that was active at that
point. Revisiting an invalid editable value therefore restores its historical
valid predecessor instead of leaving a visually unrelated later theme active.

Rapid edits are serialized and coalesced, so a second input is not discarded
while the host validates the first. A multi-field gesture such as copying or
dragging a frame is one bounded patch: one revision, one validation/compile,
one persisted draft, and one Undo step. The host and theme core both reject
unknown fields, extra properties, and patches larger than sixteen changes.
Brief hover, press, selection, and handle feedback keeps manipulation legible;
reduced-motion mode removes those transitions without changing the controls.

Quick customize Interface exposes the shared interface font, corner radius,
and shadow; Advanced adds display font and surface blur. These are theme values
rather than Studio-only decoration: once valid, the same edit applies to live
Aura and to Studio's validated shell projection. **Widgets > App identity**
can replace the Aura app mark through a host-owned PNG picker and style its
surrounding material. The mark must be one local, static, transparent 96 × 96
PNG below 400 KB; Studio never receives its filesystem path. Quick customize
exposes Replace mark, surface, and accent; Advanced adds hover surface,
foreground, border, radius, and border width. A valid replacement updates
Aura, Studio, the floating launcher, taskbar, system tray, and owned shortcuts
together. This app identity is separate from the Claude sidebar identity.

### New-chat greeting

**Interface > Greeting** edits a surface that exists only on New chat. Quick
customize can keep Claude's wording or use personal phrases, enable or remove
the portable style, enter an optional display name for the exact `{name}`
token, choose the font category, size, colour role, and position, or use
**Reset to Claude** to restore both native wording and native presentation in
one Undo-able action. Changing the preview to Conversation keeps Greeting
selected, disables its controls, and offers **Switch preview**.

Advanced exposes the independent Light/Dark and Standard/Wide frames. Each
frame has exact numeric controls for X/Y position, maximum width, size,
tracking, line height, and mark scale, plus allowlisted alignment, weight,
italic, decoration, and mark choices. Pointer movement, keyboard movement or
resize, sliders, and exact inputs all submit one complete bounded frame and
create one Undo item.

The portable theme document stores presentation only. Personal wording remains
in device-local `greetingPreferences`: Claude or custom source, display name,
one global list, optional per-theme Claude/global/custom overrides, and bounded
shuffle state. Those values are excluded from theme duplication and package
data. Save commits the theme and personal draft together; Cancel restores both,
and deleting a user theme atomically removes only that theme's personal
override.

Each list accepts at most twelve NFC-normalized phrases of 120 Unicode scalar
values each. A display name accepts 40 scalar values. `{name}` is the only
token and may appear once per phrase; control characters, duplicates, invalid
tokens, and an effective compiled list above 2 KB are rejected. Aura inserts
custom wording only as plain text. Empty, invalid, missing, or ambiguous data,
conversation navigation, forced colours, Original look, and cleanup all fail
open to Claude's native greeting.

### Instant prompts

Under **Widgets** > **Instant prompts**, add up to twelve reusable prompt
tickets. Each ticket has one stable identity, a short label, prompt text, and
an optional locally imported icon. Studio exposes one label and prompt field
for every language enabled in the theme; English remains the fallback.
Tickets can be reordered or removed without changing the identities of the
remaining tickets.

Each ticket stores one shared opacity and separate Standard/Wide placement.
Opacity is `0`–`1`; horizontal and vertical offsets are `-50`–`50` viewport
percent; scale is `0.5`–`1.75`. A legacy ticket without layout migrates to
opacity `1`, zero offsets, and scale `1` in both frames. Studio, the compiled
payload, and Edit on window use this same bounded layout object, so saving and
restarting cannot reinterpret a live gesture.

The preview places the ticket rail immediately above the new-chat composer.
Choose a ticket on the canvas or through the keyboard target picker to route
that same ticket to the inspector. **Default**, **Hover**, **Focus**,
**Pressed**, and **Expanded** preview states are local checks for the selected
ticket; they do not create theme modes or saved page variants.

Instant prompts apply only to New chat. In Conversation, Studio keeps the
selected ticket visible and disabled, labels it **New chat only**, and offers
**Switch to New chat**. In Aura, activating a ticket focuses the real composer
and inserts its prompt as text. Aura never sends it. Original look, navigation
away from New chat, forced colours, or renderer cleanup removes the complete
Aura-owned ticket block and its listener.

### Branch growth after 1.0

The branch map stays fixed as the editor grows. **Greeting** is registered
under Interface. **Instant prompts** is registered under Widgets; WO-20 adds
temporary selection and manipulation inside the actual Aura page. WO-25 then
adds Interface targets for Sidebar, Sidebar identity, and Prompt block plus
bounded Background hue, saturation, brightness, contrast, and blur controls.
It may replace only the visual Claude sidebar mark and style the unchanged
literal `Claude` label with approved font and Light/Dark colour controls. The
native wrapper, destination, accessible name, focus, wording, and collapsed or
failure fallback remain Claude-owned.

WO-20's live selection protocol carries exactly one capability kind
(`interface`, `background`, or `widget`), one registered target ID, and—only
for an eligible Aura-owned visual—its opaque item ID and bounded geometry.
Interface selections carry an allowlisted token list but no geometry. The host
accepts events only from the current HTTPS Claude document with the current
editor session, draft revision, one-time nonce, and increasing sequence. The
preview page remains a view choice; selecting a live object does not silently
change the draft's appearance, page applicability, or another frame.

An Aura-owned capability registry declares which registered views, axes, and
properties each target supports. Themes cannot add a page, selector, route, or
target. If Claude adds a page later, Aura adds one tested registry adapter and
the editor presents it in the existing View control; it does not add another
navigation tier or build a Light/Dark × page × dimensions folder tree.

Before the v1 tutorial and release sweep, WO-27 registers `code` beside
`new-chat` and `conversation`. Code applies the accepted theme's semantic
palette, typography, shapes, focus, and materials to a closed set of
host-discovered roles on live `claude.ai/code`. It does not add schema-v2
artwork contexts or Code-specific editor controls, and it never gives the page
project authority. WO-27 is CLI-first: the official local Claude Code CLI, in
the Remote Control mode selected by its feasibility spike, is the default
engine and owns filesystem access, tools, MCP, project configuration,
worktrees, execution, and permissions. Claude Desktop is an explicit full
native workspace destination rather than a hidden Aura dependency; its direct
handoff is used only if the dedicated gate passes, otherwise Aura offers
truthful current guidance. VS Code is an optional separately gated themeable
IDE route. Missing or ambiguous live-web roles stay native; Original look
removes the Code adapter.
Matching Claude Code terminal and optional VS Code theme exports are separate
bounded colour projections, not copies of Aura artwork or layout and never
evidence that native Claude Desktop Code was styled.

WO-26 upgrades responsive themes to a bounded track of one to six named layout
sets. Each set records an exact reference width and height; Standard 1180×640
and Wide 1560×940 are migration seeds rather than permanent schema keys. Users
may add a set at the current custom preview size, duplicate, rename, resize, or
remove one, while the inspector keeps Previewing, Editing layout, Between, and
Source separate.

Existing themes keep the discrete 1440 px Standard/Wide behavior until an
explicit responsive edit upgrades them. Fluid mode orders saved sets by width
and interpolates only allowlisted numeric geometry such as position, focal
point, scale, width, and offsets. Height remains the truthful Aura/Studio
reference size and affects normalized geometry, but it is not a second
ambiguous selection axis. Asset identity, anchor, text, appearance, page,
visibility, mask, and interaction state never blend.

A custom dimension is always preview-only. At an intermediate size, direct
handles remain inert until the user chooses **Add layout set here** or selects
an existing saved set to edit. Merely resizing the preview never creates a
state, modifies both neighbours, advances the revision, or creates an Undo
entry.

### Studio shell follows the validated theme

Selecting any registered built-in or user theme also restyles Studio's own
content shell. The theme core derives an exact `studioStyle` projection from
the already validated theme rather than accepting presentation code from a kit.
It contains separate Light and Dark values for canvas, sidebar, surface, raised
surface, primary/secondary/muted and sidebar text, accent, text on accent,
emphasis border, focus ring, and the two surface alpha values. Its shared values
are restricted to approved interface/display font IDs, radius and blur ranges,
and the `none`, `soft`, or `elevated` shadow enum. The host bridge and Studio
page validate that exact shape, reject missing or extra fields, and project the
result only into Aura-owned CSS custom properties.

The eight frozen built-in themes add a second, app-owned shell layer with
distinct non-colour structure: heading and rule proportions, panel/card edges,
rail and active-marker geometry, and restrained lift or shadow. Studio freezes
the initially bundled ID set before it accepts runtime theme metadata, so only
those eight IDs can select a permanent profile. A host-added user theme and an
active editor draft use neutral chrome while retaining their validated
`studioStyle` palette, fonts, radius, blur, and shadow. `sourceRecipe` may
inherit bounded theme controls, but it does not let a kit claim permanent
Studio chrome. Theme kits never store or supply profile CSS or profile IDs.

While an edit is active, Studio derives this shell projection from the same
`lastValidDocument` whose payload is active in the Aura WebView. A currently
invalid control value and its feedback remain editable, but neither Aura nor
Studio advances until a valid draft is accepted. Undo, redo, reset, save, and a
restart therefore keep the two windows on one applied revision. Saved schema-v1
and schema-v2 user themes carry both modes through the normal validated theme
load; they do not store arbitrary Studio CSS.

**Original look** is a complete fallback, not a partial clearing operation. It
applies the Default Studio projection and uses System as the effective
appearance so Light/Dark follows Windows, without overwriting the saved theme
appearance; applying the saved theme restores both saved choices. Theme
renderer artwork, personal wallpaper, remote
URLs, custom CSS, and filesystem paths never style the Studio shell. Theme-card
media, the editor's labelled asset guide/stage, and the validated launcher mark
remain their own bounded product surfaces.

### Studio-authored schemas v2, v3, and v4

Studio saves an edited `theme.json` with `schemaVersion: 4`. Schema v3 carries
the schema-v2 document forward and adds optional `newChatGreetingStyle`; `null`
means Claude-native presentation. Schema v4 adds localized metadata, bounded
interface surfaces, and background filters. Localized metadata may use a
selected subset of Studio's fifteen interface locales. `labels` and
`descriptions` must have the same locale keys, `en` must be present, and every
selected locale must have a completed name and description before Save.
Unselected locales fall back to English at runtime. Opening a schema-v1,
schema-v2, or schema-v3 user theme normalizes only the in-memory editing
history and does not rewrite the installed kit until Save. The document
carries localized metadata and a validated, Studio-normalized `theme` token
object forward from schema v1, and adds:

- `backgroundScope`: `sidebar`, `content`, or `full-window`;
- `newChatLayout`: `widthRatio` (0.4–0.96), `offsetXRatio` (-0.35–0.35), and
  `offsetYRatio` (-0.3–0.3), or `null`;
- `sourceRecipe`: `null` or one of the eight frozen built-in IDs;
- `controlOverrides`: a unique list containing only `fontUi`, `fontDisplay`,
  `radius`, or `shadow`;
- `interfaceSurfaces`: `null` or exact sparse wrappers for `sidebar`,
  `sidebarIdentity`, and `promptBlock`; unsupported properties, selectors,
  URLs, paths, HTML, CSS strings, and font sources are rejected;
- `newChatGreetingStyle`: `null` or exact Light/Dark × Standard/Wide greeting
  presentation and frame values;
- `artworkLayers`: zero to eight entries using app-owned
  `artwork/layer-<32 lowercase hex>.webp` files; and
- per-layer `role`, `appearance`, `context`, `viewport`, `visible`, `opacity`,
  `mask`, `mobile`, optional bounded `filters`, plus exact `normal` and `wide`
  frame objects.

Each interface surface uses the sparse wrapper `{ base, appearance, view,
frame }`, but validation exposes only the axes owned by that surface. Shared
material belongs in `base`; `appearance` permits only `light` and `dark`; and
the prompt block alone may use `frame.standard` and `frame.wide` for new-chat
width and offsets. Resolution is deterministic: base, then appearance, then
view, then frame. Reset removes the authored leaf, so the inherited token or
native value becomes visible again. Studio's preview width still maps to the
frozen Standard/Wide switch and does not create a new stored state.

`sidebar` contains only approved colours, an interface-font category, row
radius, and compact/comfortable spacing controls. `promptBlock` contains only
approved material, editor-inset, toolbar/control-state, and bounded
Standard/Wide geometry controls. The WO-21 greeting remains its own validated
`newChatGreetingStyle`; schema v4 does not duplicate it inside
`interfaceSurfaces`.

Every schema version may also carry an optional `theme.launcher` object. If it
is absent, Aura supplies the complete Default launcher, so older and
tokens-only themes remain usable. The object contains `asset`, `surface`,
`surfaceHover`, `foreground`, `accent`, `border`, `radius`, and `borderWidth`.
Colours are six-digit hex values; foreground text must maintain 4.5:1 contrast
against both surfaces; radius is 8–24 px; and border width is 1–3 px. A custom
kit may set `asset` to `launcher-mark.png` beside `theme.json`; it must be a
static, transparent 96×96 PNG below 400 KB. Built-in launcher assets remain
under `assets/theme-art/<id>/launcher-mark.png` and `launcher-mark.ico`.
Remote paths, linked files, and other filenames are rejected. The current
Studio editor preserves this metadata during duplicate, edit, save, and restart
flows. Its App identity controls edit the seven validated material scalars
around the current `asset`: `surface`, `surfaceHover`, `foreground`, `accent`,
`border`, `radius`, and `borderWidth`. **Replace mark** uses an exact
host-owned action; the core validates and fingerprints the copied PNG, keeps
immutable mark bytes alongside document history, and stages only the canonical
`launcher-mark.png` on Save. Undo, Redo, reset, discard, invalid-draft fallback,
and restart therefore restore the matching artwork as well as its material. An
invalid current material value and its named feedback remain in the editor
while Aura and Studio continue applying `launcherStyle` and the mark from the
last valid document. The local prompt
builder drafts the asset brief. The same validated mark identifies the running
Aura window, Studio window, taskbar, notification area, floating launcher,
Studio rail, and the four installed Aura/Studio Desktop and Start shortcuts;
switching themes changes them together. Original look uses the Default identity
on every surface. Aura stores the derived custom ICO under its own data root;
themes cannot provide an ICO or shortcut path. Presentation is optional; the
launcher itself, its permanent 48×48 circular geometry, keyboard name, safe
edge gap, whole-button 6 px drag threshold, and click-or-right-click action
menu remain host-owned and cannot be changed by a theme.

The eight frozen built-ins also have a separate Aura-owned in-page wordmark
pair at
`assets/theme-art/<built-in-id>/brand-wordmark-light.png` and
`brand-wordmark-dark.png`. These complete horizontal `Claude` lockups are
selected only from Aura's immutable built-in map. An untouched duplicate
inherits this pair through `sourceRecipe`; it does not copy or redirect the
repository assets and they are not derived from `theme.launcher.asset`.

Schema v4 may deliberately add `interfaceSurfaces.sidebarIdentity`. Its modes
are `native`, `inherited-builtin`, `styled-label`, and `local-mark`. A styled
label always renders the literal `Claude` with an approved display-font
category, weight, size, tracking, and Light/Dark colour. A local mark uses one
static transparent 96×96 `sidebar-identity.png` below 400 KB, addressed in the
document by its lowercase SHA-256 `markDigest`; the path itself is never a
page-visible value. Light and Dark may independently select their mode, size,
and original/foreground/accent treatment, while both appearances share that
one content-addressed PNG. The mark is portable theme content and is separate
from the host-owned launcher mark.

The renderer preserves Claude's native interactive wrapper, exact visible
label, accessible name, destination, focus behavior, hit target, and DOM order.
It shows one decoded `aria-hidden`, pointer-inert replacement only in a uniquely
discovered expanded sidebar. Collapsed or undersized layout, missing or
ambiguous discovery, failed decode, forced colors, cleanup, SPA remount, and
Original look restore the complete native visual before Aura ownership is
removed.

Studio can additionally store one **device-level personal wordmark** under
Aura's local data root. It is not a theme field and never enters a theme kit,
duplicate, or export. The host retains the validated source and crop sidecar,
bakes a transparent 344 × 124 PNG, and exposes only that fixed host-generated
asset to the compiler. A valid personal wordmark takes visual precedence over
both an inherited built-in pair and a portable schema-v4 sidebar identity;
removing it or failing validation restores the stored theme identity and then
its native fallback. Original look suppresses every replacement. The personal
asset, crop state, and host storage never overwrite or serialize the portable
`sidebar-identity.png`. The same conservative renderer discovery, decoded
single-overlay rule, native wrapper, and accessible-name protections apply.

`theme.variant` remains separate from the installed theme ID. Schema v1
requires it to equal that ID; schema v2 permits either the theme's own ID or one
of the eight frozen built-in IDs. A built-in duplicate retains its source ID as
both `theme.variant` and `sourceRecipe`: the variant selects the source's CSS
recipe, while `sourceRecipe` controls inheritance for the bounded Studio
controls without changing the copy's identity. The copied artwork layers and
legacy framing separately preserve the source's Dark-specific composition.

For a theme with `sourceRecipe`, an untouched `fontUi` group inherits the
canonical UI and body fonts, `fontDisplay` inherits the display font, `radius`
inherits the complete radius/shape policy, and `shadow` inherits the canonical
soft and elevated shadows. Editing one of those controls adds only that group
to `controlOverrides`, so the explicit Studio value takes over while the other
groups continue following the source recipe. The recipe ID must match
`theme.variant`; duplicate override names, other names, and overrides without a
source recipe are rejected. Aura always resolves the recipe from its own
validated `themes/<built-in-id>.json` file. A user theme cannot supply or
redirect the recipe data.

Studio presents an inherited control as **Theme original** until it is changed;
it does not claim that the nearest approved font or shadow preset is the active
source value. Once a radius or shadow override is authored, the compiler also
neutralizes the matching fixed detail in the trusted variant recipe, so the
visible Aura result follows the control. Untouched duplicates continue using
the source recipe exactly.

A frame contains `anchor`, `positionX`, `positionY`, `focalX`, `focalY`, and
`scale`. Anchors are the nine compass positions; positions range from -100 to
100, focal coordinates from 0 to 100, and scale from 0.25 to 3. Artwork roles
are `background`, `hero`, `corner`, or `decoration`. Appearance is `all`,
`light`, or `dark`; context is `all`, `new-chat`, or `conversation`; viewport
is `all`, `normal`, or `wide`. In this artwork contract, context `all` means
both supported chat contexts and excludes the registered Code view.

Advanced background controls may add only
`filters: { hueDeg?, saturation?, brightness?, contrast?, blurPx? }` to a
layer. The ranges are -180–180 degrees, 0–2 saturation, 0.5–1.5 brightness,
0.5–1.5 contrast, and 0–24 CSS px blur. Neutral values are removed from the
saved sparse object. The runtime emits the fixed order hue, saturation,
brightness, contrast, then blur; no raw filter string is accepted. Filters
follow the layer's existing appearance, context, viewport, visibility,
forced-colors, reduced-motion, failure, and Original-look lifecycle.

For a legacy layer, those two frame objects are dormant compatibility seeds
until the first framing edit. Studio computes them from the actual WebP
dimensions plus the legacy CSS `position` and `size` at the Standard and Wide
reference viewports. It recomputes old synthetic seeds when an existing saved
theme or active draft opens. The untouched payload still emits the exact
legacy CSS; the first deliberate frame edit switches to the precomputed frame
without moving the other responsive set.

When `newChatLayout` is `null`, Studio labels the placement as Claude's native
layout. The initial outline follows measured live geometry. The first pointer,
keyboard, slider, or numeric adjustment submits the measured width and both
offsets together in one patch and one Undo item; a partial native-layout patch
is rejected instead of filling missing values from a guess.

Schema-v1 user themes continue to validate, install, apply, and open in Studio.
Opening one creates an app-owned editor draft without rewriting the installed
kit. Existing WebP artwork is copied into the draft; supported PNG or AVIF
artwork is converted locally to a budgeted WebP. Legacy placement and size
remain active until the layer's framing is edited; legacy context overrides
remain active until its context or framing is edited. Saving upgrades the
installed theme to schema v2 through the same staged validation and rollback
path. `customCss` remains unavailable in both standalone formats. Unknown
properties, out-of-range values, remote resources, linked files, and paths
outside the owned kit are rejected.

## Build a theme in three commands

### 1. Scaffold

```powershell
node scripts/theme-cli.mjs scaffold my-theme
```

Creates:

- `themes/my-theme.json` — a commented token template (both light and dark
  modes, typography, shape, effects, wallpaper) ready to edit;
- `themes/my-theme/theme.json` — the standalone kit that Studio validates and
  installs;
- `themes/my-theme/CHECKLIST.md` — the named asset-slot checklist;
- a registry snippet on stdout for source-tree development.

Slot table (drop a PNG into any slot you want; empty slots are simply
skipped — a tokens-only theme with zero artwork is completely valid):

| Slot | Spec |
| --- | --- |
| `background` | ≥1600 px wide, opaque, low-detail center-left (text sits there) |
| `hero` | ≥1000 px, transparent or soft-matte edges, subject inside the right 60% |
| `corner-top-right` | transparent, safe to clip at the viewport edge |
| `corner-bottom` | transparent, safe to clip at the viewport edge |
| `card-1` / `card-2` / `card-3` | square, transparent, subject in the bottom-right 40% |
| `brand-mark` | optional small, flat reserved kit-artwork slot; it does not control the top-left wordmark. The fixed all-eight built-in map and the separate device-level personal preference are Aura-owned, not kit extension points |
| `launcher-mark` | optional static 96×96 transparent PNG, legible at 24–48 px inside a centered 72×72 safe area; Aura derives the content-addressed Windows ICO; set `theme.launcher.asset` to `launcher-mark.png` |

### 2. Validate

```powershell
node scripts/theme-cli.mjs validate themes/my-theme
```

Mechanical checks with slot-specific error messages: files decode, dimensions
and alpha meet the slot spec, no matte halos, converted sizes fit the runtime
budgets, and text contrast clears the same guardrails the base themes pass.

### 3. Audit and apply it

```powershell
node scripts/theme-cli.mjs qa my-theme
```

Audits the actual production files, validates both Light and Dark payloads, and
writes `status.json`. It does not generate a preview, board, contact sheet, or
other UI image. Then open Aura Studio and use **Install theme from folder**.
Apply the theme in the actual Aura WebView2 window on live `claude.ai`; that is
the only supported visual review. Your theme applies immediately, survives
restarts, and lives in your user data folder
(`%LOCALAPPDATA%\ClaudeAura\data\themes\`) — the app install is never modified,
and Default always remains as a safe fallback.

## Rules the tooling enforces so you don't have to

- Artwork is decorative: it never intercepts clicks, never covers the
  composer or navigation, and the app stays fully usable if a file is missing.
- Budgets: your artwork is auto-converted to optimized WebP; if a slot cannot
  fit the budget, `validate` names the slot and the target size. Every raster is
  below 400 KB, unique source artwork and embedded artwork each total less than
  1.4 MB (including a custom launcher mark), and the payload excluding artwork
  remains below 65 KB.
- Accessibility: reduced-motion, high-contrast, and forced-colors behavior is
  inherited from the shared system — your theme cannot break it.
- Reversibility: uninstalling your theme deletes one folder.

## What you may not do

- No copyrighted or real-person artwork you don't have rights to.
- No text baked into interface areas of artwork (decorative lettering inside
  the art itself is fine, kept minimal).
- No remote resources: themes must work fully offline.
