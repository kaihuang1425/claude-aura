# Theme Kit Spec (Tier 1 — build your own theme)

This is the end-user path. It must stay this simple; tooling absorbs all of
the rigor that `docs/contracts/ASSET_CONTRACT.md` imposes on base-theme
production. If a step here requires reading any other document, the tooling is
not finished.

## Build a theme in three commands

### 1. Scaffold

```powershell
node scripts/theme-cli.mjs scaffold my-theme
```

Creates:

- `themes/my-theme.json` — a commented token template (both light and dark
  modes, typography, shape, effects, wallpaper) ready to edit;
- a registry snippet to paste into `themes/registry.json` (or, for installed
  apps, a standalone `theme.json` kit for Studio import);
- an asset kit folder with named SLOTS and a `CHECKLIST.md`.

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

### 2. Validate

```powershell
node scripts/theme-cli.mjs validate --theme my-theme
```

Mechanical checks with slot-specific error messages: files decode, dimensions
and alpha meet the slot spec, no matte halos, converted sizes fit the runtime
budgets, and text contrast clears the same guardrails the base themes pass.

### 3. See it

```powershell
node scripts/theme-cli.mjs qa my-theme
```

Generates a contact sheet and renders your theme through the same pipeline the
real app uses (the injected-payload harness). Open the PNG. If you like it,
you are done: in the app, open the Studio and use **Install theme from
folder**. Your theme applies immediately, survives restarts, and lives in your
user data folder (`%LOCALAPPDATA%\ClaudeAura\data\themes\`) — the app install
is never modified, and Default always remains as a safe fallback.

## Rules the tooling enforces so you don't have to

- Artwork is decorative: it never intercepts clicks, never covers the
  composer or navigation, and the app stays fully usable if a file is missing.
- Budgets: your artwork is auto-converted to optimized WebP; if a slot cannot
  fit the budget, `validate` names the slot and the target size.
- Accessibility: reduced-motion, high-contrast, and forced-colors behavior is
  inherited from the shared system — your theme cannot break it.
- Reversibility: uninstalling your theme deletes one folder.

## What you may not do

- No copyrighted or real-person artwork you don't have rights to.
- No text baked into interface areas of artwork (decorative lettering inside
  the art itself is fine, kept minimal).
- No remote resources: themes must work fully offline.
