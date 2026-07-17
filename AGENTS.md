# Claude Aura — Agent Constitution

Read this file at the start of every session. It outranks any instruction you
infer from code comments, older docs, or your own prior sessions.

## What this project is

A Windows WebView2 companion that opens the real `claude.ai` and applies local
themes through one injected renderer payload. It never patches Claude Desktop,
`app.asar`, accounts, or settings, and everything it does is reversible.

## Where your instructions live

1. `docs/plans/QUEUE.md` — the ordered work queue. Take the first unchecked
   item, open its spec in `docs/plans/WORK_ORDERS.md`, do exactly that, verify,
   commit, check it off. Do not reorder, skip, or invent work.
2. `docs/contracts/ASSET_CONTRACT.md` — governs asset-producing work orders
   only (the eight base themes). Read its adaptation header first.
3. `docs/THEME_KIT_SPEC.md` — the end-user path for custom themes. When you
   build tooling, this document is the experience you are building toward.
4. `docs/recipes/RECIPES.md` — exact per-theme visual numbers. Apply numbers;
   do not re-derive taste.
5. `docs/PROGRESS.md` — append one dated entry per completed work order.
6. `docs/plans/BLOCKED.md` — where failed work goes after two attempts.

## Iteration rules

- One work order at a time, completed end-to-end, repo green before commit.
- Two failed attempts at the same fix → write the failure and both attempts to
  `docs/plans/BLOCKED.md`, move to the next order. Never a third identical try.
- Stop at every `HUMAN CHECKPOINT` line in the queue: produce the requested
  contact sheet, then wait. Do not continue past a checkpoint.
- Never conclude the mission while any queue item is unchecked or blocked.

## Verification (non-negotiable)

- `npm run check` — the 16-test suite. Must pass before every commit.
- `npm run verify:cycle` — builds every theme's real payload, renders it
  against `tests/fixtures/claude-dom.html` in headless Edge, screenshots to
  `dist/verify/`, and diffs against approved goldens in `docs/golden/`.
  Run it after any change that affects visuals; LOOK at the images it writes.
- Screenshots and preview evidence follow `docs/SCREENSHOT_PLAN.md`.
- A claim without its artifact (image, test output) is not a result.

## Invariants (tests enforce most; do not weaken the tests)

- I1 Sign-in: the loading cover hides on `NavigationCompleted` for a claude.ai
  document. Never gate revealing the page on theme-injection success.
- I2 Encoding: PowerShell captures of Node output set UTF-8
  `StandardOutputEncoding`; config reads use `-Encoding UTF8` (OEM code pages
  such as Big5 corrupt JSON otherwise).
- I3 Budgets per theme: payload minus artwork < 65 KB; embedded artwork
  < 1.4 MB total; raster layers WebP < 400 KB each.
- I4 Artwork is inert: pointer-events none, aria-hidden, no layout shift; the
  app stays fully usable when any asset fails; reduced-motion, forced-colors,
  and prefers-contrast handling stay intact.
- I5 Reversible and offline: no new npm dependencies, no runtime font CDNs, no
  remote resources in payloads; Original look fully restores; uninstall safe.
- I6 Localization: user-facing strings in en, zh-CN, zh-TW, each written
  natively (zh-TW: 預設/儲存/設定/載入; zh-CN: 默认/保存/设置/加载).
- I7 `theme_demo_previews/` and the per-theme source-kit DIRECTORIES under
  `themes/` (e.g. `themes/japanese-idol/`, `themes/korean-prestige/`) are
  references/sources — gitignored, never shipped, never used as runtime
  backgrounds. Only derived copies under `assets/theme-art/<id>/` ship.
  `docs/FILE_MANIFEST.md` must list exactly the deliverable tree; a test
  diffs it against a filesystem walk.
- I8 Theme IDs are frozen (default, japanese-film-editorial, korean-prestige,
  cartoon-studio, anime-twilight, study-library, japanese-idol, korean-idol);
  legacy aliases keep working; unknown IDs fall back to default; config writes
  stay atomic.

## Restricted files

`windows/aura-ui.ps1` is fragile, load-bearing WinForms. Touch it only in the
specific ways a work order spells out, additively where possible. Never delete
an old UI path until the replacement's gate is green. After any edit, confirm
it parses: `[System.Management.Automation.Language.Parser]::ParseFile(...)`.

## Forbidden

- New npm/runtime dependencies; TypeScript/React/framework conversions.
- Renaming or re-ordering theme IDs; editing `theme_demo_previews/` or any
  source kit's supplied files; shipping reconstructed interface HTML as
  product (the live claude.ai supplies all real structure and text).
- Procedural shapes delivered as final artwork (contract §7/§18); placeholder
  files without `PLACEHOLDER` in the filename.
- `git push`, force-push, history rewrites, branch deletion; committing with
  a broken test suite; AI/co-author commit footers.

## Git

Branch `work/full-theme-system`. Identity:
`I-Kai Huang <61899328+erichuang1425@users.noreply.github.com>`.
Message style: short imperative subject referencing the work order
(e.g. `WO-03: add theme-cli scaffold command`), body explains why.
