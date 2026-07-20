# Work order specs

Every order: repo must be green (`npm run check`) before its commit; visual
orders additionally run `npm run verify:cycle` and the images must be LOOKED
at, not just generated. Commit subject: `WO-NN: <imperative>`.

---

## WO-01 — Soften input/composer borders (D1)

Goal: claude.ai's message box and search inputs currently render a harsh
saturated accent border under themed CSS. Make input borders soft while
keeping a clearly visible `:focus-visible` ring.

Files: `assets/base.css`, `assets/theme-variants.css`,
`scripts/theme-core.mjs` (the `--claude-border*` mappings in
`semanticToLegacy`), `tests/fixtures/claude-dom.html` only if a missing input
shape must be added.

Steps: locate every rule that drives input/composer border color from
`--aura-accent-primary` or a high-alpha border token; retarget to the alpha
values in `docs/recipes/RECIPES.md` (per-theme `inputBorderAlpha`). Do not
touch `:focus-visible` outlines.

Verify: `npm run verify:cycle`; in every theme's render the composer textarea
and the search pill show a soft border, and the autofocused control shows an
obvious focus ring. Done when: all 16 tests pass and the borders in
`dist/verify/*.png` are visibly soft in all 8 themes, both defect surfaces.

---

## WO-02 — Reveal artwork: surface alphas (D2)

Goal: art-heavy themes look washed out because content surfaces sit at ~0.9
alpha over the artwork.

Files: `themes/<id>.json` wallpaper blocks only.

Steps: apply the `surfaceAlpha` / `sidebarAlpha` values from RECIPES.md
per theme, light and dark. Change nothing else.

Verify: `npm run verify:cycle`; hero/background artwork clearly visible in
each art theme while body text stays comfortably readable in the fixture's
text block. Done when: tests green + renders match the recipe intent.

---

## WO-03 — `theme-cli scaffold`

Goal: `node scripts/theme-cli.mjs scaffold <id>` creates a complete starter
kit per `docs/THEME_KIT_SPEC.md`.

Files: `scripts/theme-cli.mjs` (new subcommand), a template embedded in the
script or under `docs/` (no new top-level dirs), `docs/THEME_KIT_SPEC.md` if
flags change, `tests/run-tests.mjs` (add coverage: scaffold into a temp dir,
validate the result, clean up).

Steps: generate `themes/<id>.json` from a commented copy of
`themes/default.json` with the new id; emit a registry snippet to stdout; make
the slot folder with `CHECKLIST.md` naming each slot and its spec. Refuse ids
that already exist or don't match `^[a-z][a-z0-9-]{1,39}$`.

Done when: scaffold → validate passes on a fresh id in a temp dir, test added,
tests green.

---

## WO-04 — `theme-cli qa` (QA board)

Goal: one command generates the contract §12 QA board from actual production
files, including every registry `artworkLayers` entry, plus an in-context
payload-harness render.

Files: `scripts/theme-cli.mjs`, may add `scripts/qa-board.mjs`; reuse the
headless-Edge + local-loopback pattern from `scripts/convert-theme-assets.mjs`
and `scripts/verify-cycle.mjs`. No new dependencies.

Output: `themes/<id>/qa/qa-board.png` + `status.json` (or
`dist/qa/<id>/` for themes without kits).

Done when: `theme-cli qa japanese-idol` produces a board whose panels are
generated from the real files under `assets/theme-art/kawaii-idol/`; layered
themes decode and place every `artworkLayers` entry rather than falling back
to the legacy single `artwork` slot; and a test asserts the command exists and
runs.

---

## WO-05 — Aura Studio window

Goal: host the prebuilt `studio/` app in a second WebView2 window; the design
is FROZEN — do not restyle it; you are wiring plumbing only.

Files: `windows/aura-ui.ps1` (additive; restricted-file rules apply),
`studio/app.js` (bridge glue only, marked section), `windows/ui-copy.json`
(tray strings), `tests/run-tests.mjs` (static assertions).

Steps:
1. Create the Studio form: a WebView2 in a normal resizable window titled from
   ui-copy `studioTitle`; load via
   `CoreWebView2.SetVirtualHostNameToFolderMapping("aura.studio", <app>\studio, Allow)`
   and navigate to `https://aura.studio/index.html`. Studio must work offline.
2. Bridge: handle `WebMessageReceived` for exactly
   `get-state`, `set-theme`, `set-image`, `clear-image`, `set-enabled`,
   `open-desktop`, `import-theme`. Validate every payload; theme ids by
   regex; file paths ONLY from a host-side OpenFileDialog (the page never
   supplies paths). Push state to the page with `PostWebMessageAsJson`
   after every change and on load.
3. Tray: NotifyIcon (Application icon is fine) — double-click opens the
   Studio; context menu: open Studio / original look–apply theme / open
   desktop app / exit. Dispose the icon on close.
4. Keep the existing toolbar functional in this order (removal is WO-06).

Checkpoint B user-approved revisions: the frozen-design limit is lifted only
for the requested theme-card polish and reusable framing editor. Add
`set-image-framing` and `set-card-preview-crop` to the exact bridge allowlist;
persist strict numeric focal-point/zoom values; serve the selected background
preview only through an app-owned, isolated local folder; never expose or
accept its source path. The same labelled dialog must support pointer drag,
native keyboard-operable range controls, reset/cancel/save, host-confirmed
persistence, and native en/zh-CN/zh-TW copy.

Done when: Studio opens from the tray, lists all 8 themes with correct
localized names, selection applies + persists (verify via config.json),
background pick/clear/framing and per-theme card framing work, `npm run check`
green, PS parses.

---

## WO-06 — Remove toolbar + WinForms gallery

Only after HUMAN CHECKPOINT B approval. Delete the toolbar strip, the WinForms
theme gallery, and their palette plumbing from `windows/aura-ui.ps1`; the main
window becomes WebView + loading/error cover only; all controls live in the
Studio + tray. Update tests that referenced the old gallery, keeping the
regression assertions for I1/I2. Done when: main window shows only Claude,
every old capability is reachable via Studio/tray, tests green.

---

## WO-07 — User themes directory + Studio import

Goal: themes load from `%LOCALAPPDATA%\ClaudeAura\data\themes\<id>\` in
addition to the app's `themes/`; Studio "Install theme from folder" copies a
validated kit there.

Files: `scripts/theme-core.mjs` (registry merge: user themes append after
built-ins; id collisions prefer built-ins and surface a warning),
`scripts/theme-cli.mjs` (`validate` accepts a kit folder), `windows/aura-ui.ps1`
(bridge `import-theme` → folder picker → validate via helper → copy),
`studio/app.js` (marked glue section), tests.

Done when: a scaffolded demo theme imports through the Studio, applies,
survives restart, uninstalls by deleting its folder; invalid kits are rejected
with the validator's message; tests green.

---

## WO-08..WO-14 — Per-theme asset production

Governed by `docs/contracts/ASSET_CONTRACT.md` (adaptation header first) plus
the theme's section in `docs/recipes/RECIPES.md` (slot list + layer numbers).

Per theme: build/receive the source kit → derive WebP via
`scripts/convert-theme-assets.mjs` (generalize the kawaii converter in WO-08
and reuse it) → wire `artworkLayers` → `theme-cli qa` board → verify-cycle
render → actual Aura WebView2 light+dark capture on real `claude.ai` →
mini-checkpoint. The live capture is human-review evidence governed by
`docs/SCREENSHOT_PLAN.md`; never substitute the offline preview or payload
harness for it. Compare only Aura-controlled artwork, materials, palette,
decorative density, typography categories, and placement — the live site owns
its interface structure, controls, and wording. If image generation is
unavailable, write the kit's
`asset-request.md` and mark awaiting-art per contract §8/§18 — do not ship
procedural art. japanese-idol (WO-13) is a parity pass: assets exist; close
the gap to its board.

Done when (per theme): recipe layers wired, budgets pass, QA board generated,
the deterministic render matches the board's composition, and actual Aura
captures show the intended art decoded, correctly cropped, legible in both
modes, free of control overlap, and free of cross-theme artwork; or the theme
is cleanly awaiting-art and receives no parity approval.

### WO-12 acceptance amendment — Aura appearance preference

User-authorized 2026-07-20 after the live Study review exposed that current
Claude offers no light/dark control and WebView2 System mode remained light
even while Windows apps were dark. WO-12 may add the minimum product plumbing
needed to exercise its required live light/dark gate: a persisted,
keyboard-operable **System / Light / Dark** selector in Aura Studio. Apply the
selection through `CoreWebView2Profile.PreferredColorScheme` before navigation
and immediately on change, with a namespaced Aura effective-mode fallback for
theme tokens. Never alter Claude-owned classes, attributes, storage, or account
preferences.

Permitted amendment files: `config.example.json`, `scripts/theme-core.mjs`,
`scripts/theme-cli.mjs`, `assets/renderer-inject.js`, `assets/base.css`,
`scripts/injector.mjs` if cleanup requires it, `scripts/verify-cycle.mjs` and
`scripts/qa-board.mjs` only to pass their explicit render mode, `studio/index.html`,
`studio/app.js`, `studio/styles.css`, `windows/aura-ui.ps1` (additive restricted
change: appearance mapping, startup application, strict `set-appearance`
bridge action/state only), `tests/run-tests.mjs`, and directly affected
documentation. Preserve the NavigationCompleted reveal invariant and all
payload/artwork budgets. The broader Studio navigation, Windows identity,
cross-theme interaction polish, live sidebar repair, and context-aware artwork
work remain separate queued work.

---

## WO-17 — Live Aura UX, identity, prompt placement, and context adaptation

Correct the defects visible in the supplied actual-Aura screenshots while
preserving the Claude-only main WebView. Add discoverable Windows navigation to
Studio, an Aura-owned icon, restrained interaction states, reliable live-sidebar
styling, and context-aware artwork and prompt placement.

Permitted files: `assets/base.css`, `assets/theme-variants.css`,
`assets/renderer-inject.js`, new canonical `assets/brand/aura-mark.svg` and
derived `assets/brand/claude-aura.ico`, `themes/registry.json`,
`scripts/theme-core.mjs`, new deterministic `scripts/build-aura-icon.mjs`,
`scripts/build-preview.mjs` and generated theme mirrors only for schema
propagation, `studio/index.html`, `studio/styles.css`, `studio/app.js`,
`windows/aura-ui.ps1`, `windows/install.ps1`, `windows/uninstall.ps1`,
`windows/ui-copy.json`, `scripts/build-release.mjs`, `tests/run-tests.mjs`, and
directly affected manifest, screenshot-plan, reference-lock, acceptance, and
progress documents. Do not develop the offline preview, QA boards, or fixture
interface as product surfaces.

Restricted-file authorization for `windows/aura-ui.ps1`: add `-OpenStudio`,
per-user single-instance Studio signaling, one strict `open-aura` bridge action,
and Aura icon loading/disposal for both forms and the notification-area icon.
Do not change the `NavigationCompleted` reveal invariant or inject controls into
Claude.

Requirements:

1. Generate the Aura identity icon deterministically from the canonical SVG,
   with ICO frames at 16, 20, 24, 32, 40, 48, 64, 128, and 256 px. Do not borrow
   the Claude executable icon.
2. Install separate normal Aura and `Claude Aura Studio` Desktop/Start-menu
   shortcuts. `-OpenStudio` foregrounds the existing Studio or starts Aura and
   opens Studio; uninstall removes only the owned shortcuts.
3. Add an accessible Studio action that returns to the Aura window while
   retaining the separate official Desktop-app action.
4. Replace blanket icon boxes, colored borders, label-tinting hover states, and
   lift transforms with theme-appropriate text, low-alpha surfaces, restrained
   shadow, and the existing visible `:focus-visible` ring. Native labels remain
   live text; do not replace them with images.
5. Discover the current live sidebar from semantic DOM signals, mark exactly one
   element with `data-claude-aura-sidebar`, and remove that marker on cleanup.
   Do not depend on localized sidebar wording.
6. Maintain `data-claude-aura-context="new-chat|conversation|other"` across SPA
   navigation. Cleanup removes every Aura context/layout marker.
7. Extend validated registry metadata with bounded new-chat layout presets for
   the real prompt block: width plus horizontal/vertical offsets inside the
   measured live main canvas. Apply them only when the semantic new-chat prompt
   root is discovered, clamp them to the viewport, preserve keyboard/focus
   behavior, and never reposition the conversation composer. Korean Idol must
   match the approved demo composition without covering its hero.
8. Extend artwork-layer metadata with bounded role/context overrides. Korean
   Idol uses separately approved new-chat and conversation hero placement;
   hiding or reducing its conversation hero is acceptable when needed to keep
   content, attachments, title, and composer unobstructed.
9. Fix only the current Studio overflow defect needed for navigation: one
   intentional content scrolling region at the supported minimum size, with no
   blank nested document scroller.

Done when: PowerShell parses; `npm run check` and `npm run verify:cycle` pass;
all generated frames are inspected; payload-minus-art remains below 65 KB;
Original look removes all styles, markers, artwork, context, prompt placement,
and forced appearance; release output contains the SVG/ICO; shortcut, title-bar,
and notification-area icons are inspected at normal/high DPI; and actual Aura
evidence covers all eight themes in light/dark with representative
hover/selected states plus Korean Idol new-chat and conversation layouts. If
whole-window capture remains unavailable, stop for user-provided live captures;
never substitute fixture output.

---

## WO-18 — Aura Studio visual theme editor

Make no-code custom theme creation possible from Studio without simulating
Claude. Built-in themes are immutable and expose **Duplicate to customize**.
The editor controls a validated local theme and applies the last valid draft to
the actual Aura WebView on live `claude.ai`.

Permitted files: `studio/index.html`, `studio/styles.css`, `studio/app.js`, new
`studio/editor.css` and `studio/editor.js`, `windows/aura-ui.ps1`,
`windows/ui-copy.json`, `scripts/theme-core.mjs`, `scripts/theme-cli.mjs`,
`scripts/convert-theme-assets.mjs`, renderer/shared CSS only for the validated
editor schema, generated theme mirrors only for schema propagation,
`docs/THEME_KIT_SPEC.md`, `docs/SCREENSHOT_PLAN.md`, `docs/FILE_MANIFEST.md`,
`README.md`, tests, and acceptance/progress documents.

Scope: light/dark canvas, sidebar, surface, text, accent, and border tokens;
approved local/system font stacks; radius, blur, and soft shadow; up to four
background/hero/corner/inert-decoration layers; per-layer anchor, position,
scale, opacity, mask, mobile behavior, visibility, and new-chat/conversation
presets; host-owned local artwork import and WebP conversion; prompt-block
new-chat positioning; undo/redo/reset/save/cancel/delete/restart persistence;
contrast and budget feedback; a clearly labelled asset/safe-zone guide (not a
reconstructed Claude preview); and a local slot-specific prompt builder with no
network model call.

Exact new host actions: `create-theme-copy`, `begin-theme-edit`,
`set-theme-token`, `set-theme-layer`, `pick-theme-layer-image`,
`remove-theme-layer`, `move-theme-layer`, `undo-theme-edit`, `redo-theme-edit`,
`save-theme-edit`, `discard-theme-edit`, and `delete-user-theme`. The page never
supplies a filesystem path; the host owns file dialogs and strictly allowlists
IDs, modes, tokens, enums, counts, and numeric ranges.

Preserve schema-v1 user themes. Drafts stay under app-owned data. Save through
staging, full validation, and atomic replacement with rollback; invalid edits
leave the last valid payload active. Deleting an active user theme applies
Default first and never deletes a built-in. Imported rasters remain below 400
KB each and total artwork below 1.4 MB. `customCss` remains unavailable.
“Widgets” mean pointer-inert decoration, never interactive UI inside Claude.

Use independent native en, zh-CN, and zh-TW copy. Every drag has a keyboard
alternative, with logical tab order, visible focus, labelled controls, live
validation, reduced-motion, and forced-colors handling.

Done when: PowerShell parses; tests cover duplication, v1 compatibility,
validation, prompt/context placement, undo/redo, atomic rollback, deletion
safety, path rejection, and bridge allowlists; `npm run check` and
`npm run verify:cycle` pass and images are inspected; a temporary theme is
duplicated, edited, imported, saved, applied, restart-tested, and deleted; and
actual Aura demonstrates it in new-chat/conversation and light/dark. No asset
guide or offline render may be described as live evidence.

---

## WO-15 — Tutorial + gate G6 proof

Rewrite `docs/THEMING.md` as the 30-minute tutorial (Tier 1 voice, zero assumed
repo knowledge). The Studio visual editor is the primary no-code route, while
the existing scaffold/validate/QA/install commands remain documented and must
still prove gate G6. Following ONLY the tutorial, create `demo-proof`, give it
one background PNG, validate, install/apply, restart-persist, then delete it
fully. Record the transcript in PROGRESS.md. Done when both the Studio-first
walkthrough and the existing command path succeed without consulting any other
doc and the repo is clean afterward.

---

## WO-16 — Final sweep

`npm run check`, `npm run verify:cycle` (all goldens), fresh-state run
(sandbox-wipe `%LOCALAPPDATA%\ClaudeAura\data`, run `windows/verify.ps1`),
screenshots per SCREENSHOT_PLAN (including the complete live-Aura matrix and
Checkpoint C approval), `npm run release`, update
IMPLEMENTATION_REPORT / ACCEPTANCE_AUDIT / FILE_MANIFEST, write the final
report (architecture, per-theme scorecard with image paths, asset provenance
user-supplied vs generated, licenses, limitations).
