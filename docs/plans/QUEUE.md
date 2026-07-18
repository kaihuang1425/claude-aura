# Work queue

Take the first unchecked item. Open its spec in `WORK_ORDERS.md`. Complete it
end-to-end, verify per its verify block, commit (`WO-NN: subject`), check it
off here, append a `docs/PROGRESS.md` entry. Stop at every HUMAN CHECKPOINT.

- [x] WO-01 — Soften input/composer borders across all themes (defect D1)
- [ ] WO-02 — Reveal artwork: apply per-theme surface alphas from RECIPES.md (defect D2)
- [ ] **HUMAN CHECKPOINT A** — contact sheet of all 8 themes (payload harness,
      light+dark) for user review; user approvals become golden images
- [ ] WO-03 — `theme-cli scaffold` command + slot kit template
- [ ] WO-04 — `theme-cli qa` command (QA board generator, headless Edge)
- [ ] WO-05 — Aura Studio window: host `studio/` in a second WebView2 window
      (virtual host mapping), wire the postMessage bridge, tray icon
- [ ] **HUMAN CHECKPOINT B** — Studio walkthrough screenshots (both locales,
      keyboard traversal evidence) for user review
- [ ] WO-06 — Remove the main-window toolbar and the WinForms gallery
      (only after Checkpoint B approval)
- [ ] WO-07 — User themes directory + Studio "Install theme from folder"
- [ ] WO-08 — Asset production: japanese-film-editorial (ASSET_CONTRACT)
- [ ] WO-09 — Asset production: korean-prestige (ASSET_CONTRACT)
- [ ] WO-10 — Asset production: cartoon-studio (ASSET_CONTRACT)
- [ ] WO-11 — Asset production: anime-twilight (ASSET_CONTRACT)
- [ ] WO-12 — Asset production: study-library (ASSET_CONTRACT)
- [ ] WO-13 — Asset polish: japanese-idol parity pass (ASSET_CONTRACT)
- [ ] WO-14 — Asset production: korean-idol (ASSET_CONTRACT)
- [ ] **HUMAN CHECKPOINT C** — per-theme parity contact sheets vs boards;
      approvals freeze goldens (REFERENCE_LOCK.md)
- [ ] WO-15 — THEMING.md rewrite as the 30-minute tutorial; prove gate G6 by
      scaffolding, installing, applying, and deleting a demo theme
- [ ] WO-16 — Full verification sweep, release rebuild, final report

Notes:
- WO-08..14 each end with their own mini-checkpoint if provisional art was
  generated (user may replace generated art with supplied kits at any time).
- If a work order blocks twice, log it in BLOCKED.md and continue.
