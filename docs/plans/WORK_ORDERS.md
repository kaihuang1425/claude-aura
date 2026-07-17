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
files, plus an in-context payload-harness render.

Files: `scripts/theme-cli.mjs`, may add `scripts/qa-board.mjs`; reuse the
headless-Edge + local-loopback pattern from `scripts/convert-kawaii-assets.mjs`
and `scripts/verify-cycle.mjs`. No new dependencies.

Output: `themes/<id>/qa/qa-board.png` + `status.json` (or
`dist/qa/<id>/` for themes without kits).

Done when: `theme-cli qa japanese-idol` produces a board whose panels are
generated from the real files under `assets/theme-art/kawaii-idol/`, and a
test asserts the command exists and runs.

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

Done when: Studio opens from the tray, lists all 8 themes with correct
localized names, selection applies + persists (verify via config.json),
background pick/clear works, `npm run check` green, PS parses.

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
render. If image generation is unavailable, write the kit's
`asset-request.md` and mark awaiting-art per contract §8/§18 — do not ship
procedural art. japanese-idol (WO-13) is a parity pass: assets exist; close
the gap to its board.

Done when (per theme): recipe layers wired, budgets pass, QA board generated,
render matches the board's composition, or the theme is cleanly awaiting-art.

---

## WO-15 — Tutorial + gate G6 proof

Rewrite `docs/THEMING.md` as the 30-minute tutorial (Tier 1 voice, zero
assumed repo knowledge). Then prove it: following ONLY the tutorial, scaffold
`demo-proof`, give it one background PNG, validate, qa, install via Studio,
apply, restart-persist, then delete it fully. Record the transcript in
PROGRESS.md. Done when: the walkthrough succeeds without consulting any other
doc and the repo is clean afterward.

---

## WO-16 — Final sweep

`npm run check`, `npm run verify:cycle` (all goldens), fresh-state run
(sandbox-wipe `%LOCALAPPDATA%\ClaudeAura\data`, run `windows/verify.ps1`),
screenshots per SCREENSHOT_PLAN, `npm run release`, update
IMPLEMENTATION_REPORT / ACCEPTANCE_AUDIT / FILE_MANIFEST, write the final
report (architecture, per-theme scorecard with image paths, asset provenance
user-supplied vs generated, licenses, limitations).
