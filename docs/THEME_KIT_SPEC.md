# Theme Kit Spec (Tier 1 — build your own theme)

This is the end-user path. It must stay this simple; tooling absorbs the
base-theme production rigor. If a step here requires reading any other
document, the tooling is not finished.

## Create visually in Studio

1. Open **Claude Aura Studio**. A built-in theme is immutable, so choose
   **Duplicate to customize**. For an installed user theme, choose **Edit**.
2. Edit Light and Dark tokens independently. **Copy Light to Dark** and **Copy
   Dark to Light** copy the editable color and alpha set; each appearance can
   then be refined without changing the other. Duplicating a built-in retains
   its complete source recipe, including its Dark-specific composition; Studio
   never derives Dark from Light unless you explicitly choose that copy action.
3. Choose an approved system font stack, radius, blur, shadow, and new-chat
   prompt width and offsets. Studio does not load remote fonts.
4. Add up to eight artwork layers. The host opens the file picker and converts
   PNG, JPEG, WebP, or AVIF input to WebP locally; the Studio page never sends
   or receives a filesystem path.
5. For each layer, choose its role, appearance, page context, viewport,
   visibility, opacity, mask, and mobile behavior. Normal and wide/fullscreen
   presets keep independent anchor, focal point, position, and scale values.
   Every pointer-adjustable control also has a native keyboard control.
6. Choose **Content canvas** to begin artwork at the measured live main canvas,
   or **Full window** to continue it behind the translucent live sidebar.
7. Use the labelled asset and safe-zone guide to plan placement. It is a guide,
   not a Claude preview. The local prompt builder only drafts asset-generation
   text and makes no model or network call. Its **App + launcher mark** slot
   includes the exact 96 × 96 output, safe-area, and small-size requirements.
8. Watch the contrast and byte-budget results, then save. Undo, redo, reset,
   cancel, and delete remain available. Deleting the selected user theme first
   applies Default; built-in themes cannot be deleted.

Studio applies the last valid draft directly to the actual Aura WebView on live
`claude.ai`. An invalid edit remains in the editor with named feedback while the
previous valid payload stays active. Save stages the complete kit, validates
both Light and Dark payloads, and atomically replaces the installed user theme;
a failure restores the previous theme and configuration. Saved themes and
their artwork live under `%LOCALAPPDATA%\ClaudeAura\data\themes\`, while active
drafts stay under `%LOCALAPPDATA%\ClaudeAura\data\theme-drafts\`. A saved theme
survives an Aura restart.

### Studio-authored schema v2

Studio saves `theme.json` with `schemaVersion: 2`. The document carries the
localized metadata and a validated, Studio-normalized `theme` token object
forward from schema v1, and adds:

- `backgroundScope`: `content` or `full-window`;
- `newChatLayout`: `widthRatio` (0.4–0.96), `offsetXRatio` (-0.35–0.35), and
  `offsetYRatio` (-0.3–0.3), or `null`;
- `sourceRecipe`: `null` or one of the eight frozen built-in IDs;
- `controlOverrides`: a unique list containing only `fontUi`, `fontDisplay`,
  `radius`, or `shadow`;
- `artworkLayers`: zero to eight entries using app-owned
  `artwork/layer-<32 lowercase hex>.webp` files; and
- per-layer `role`, `appearance`, `context`, `viewport`, `visible`, `opacity`,
  `mask`, `mobile`, plus exact `normal` and `wide` frame objects.

Every schema version may also carry an optional `theme.launcher` object. If it
is absent, Aura supplies the complete Default launcher, so older and
tokens-only themes remain usable. The object contains `asset`, `surface`,
`surfaceHover`, `foreground`, `accent`, `border`, `radius`, and `borderWidth`.
Colours are six-digit hex values; foreground text must maintain 4.5:1 contrast
against both surfaces; radius is 8–24 px; and border width is 1–3 px. A custom
kit may set `asset` to `launcher-mark.png` beside `theme.json`; it must be a
static, transparent 96×96 PNG below 400 KB. Built-in launcher assets remain
under `assets/theme-art/<id>/launcher-mark.png`. Remote paths, linked files,
and other filenames are rejected. The current Studio editor preserves this
metadata during duplicate, edit, save, and restart flows, and its local prompt
builder drafts the asset brief. The same validated mark identifies the running
Aura window, Studio window, taskbar, notification area, floating launcher, and
Studio rail; switching themes changes them together. Presentation is optional;
the launcher itself, its click action, keyboard name, safe edge gap, and
dedicated drag grip remain host-owned and cannot be removed by a theme.

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

A frame contains `anchor`, `positionX`, `positionY`, `focalX`, `focalY`, and
`scale`. Anchors are the nine compass positions; positions range from -100 to
100, focal coordinates from 0 to 100, and scale from 0.25 to 3. Artwork roles
are `background`, `hero`, `corner`, or `decoration`. Appearance is `all`,
`light`, or `dark`; context is `all`, `new-chat`, or `conversation`; viewport
is `all`, `normal`, or `wide`.

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
| `brand-mark` | optional, small, flat; restyles the starburst identity |
| `launcher-mark` | optional static 96×96 transparent PNG, legible at 24–48 px inside a centered 72×72 safe area; one mark serves the running app and launcher; set `theme.launcher.asset` to `launcher-mark.png` |

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
