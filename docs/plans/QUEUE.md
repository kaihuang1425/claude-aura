# Work queue

Take the first unchecked item. Open its spec in `WORK_ORDERS.md`. Complete it
end-to-end, verify per its verify block, commit (`WO-NN: subject`), check it
off here, append a `docs/PROGRESS.md` entry. Stop at every HUMAN CHECKPOINT.

**CURRENT NEXT: WO-13 — Asset polish: japanese-idol parity pass.** Entries marked
**BLOCKED** are status records, not unchecked work. Do not retry one until its
stated unblock condition in `BLOCKED.md` changes or the user explicitly
authorizes a new attempt. After completing the current item, advance this
pointer to the next unblocked unchecked item in the same commit.

- [x] WO-01 — Soften input/composer borders across all themes (defect D1)
- [x] WO-02 — Reveal artwork: apply per-theme surface alphas from RECIPES.md (defect D2)
- [x] WO-05 — Aura Studio window: host `studio/` in a second WebView2 window
      (virtual host mapping), wire the postMessage bridge, tray icon
- [x] **HUMAN CHECKPOINT B** — historical Studio walkthrough approval; its
      offline screenshot artifacts are retired and are not current evidence
- [x] **HUMAN CHECKPOINT A** — historical eight-theme review; its fixture
      artifacts are retired and are not current evidence
- [x] WO-03 — `theme-cli scaffold` command + slot kit template
- [x] WO-04 — `theme-cli qa` command (non-image `status.json` asset audit)
- [x] WO-06 — Remove the main-window toolbar and the WinForms gallery
      (only after Checkpoint B approval)
- [x] WO-07 — User themes directory + Studio "Install theme from folder"
- **BLOCKED — WO-08** — Asset production: japanese-film-editorial; corner
      conversion and required live evidence remain unavailable (see
      `BLOCKED.md`)
- **BLOCKED — WO-09** — Asset production: korean-prestige; required Aura
      whole-window capture remains unavailable (see `BLOCKED.md`)
- [x] WO-10 — Asset production: cartoon-studio (ASSET_CONTRACT)
- [x] WO-11 — Asset production: anime-twilight (ASSET_CONTRACT)
- [x] WO-12 — Asset production: study-library (ASSET_CONTRACT)
- [x] WO-17 — Live Aura UX, identity, prompt placement, and context adaptation
- [ ] WO-13 — Asset polish: japanese-idol parity pass (ASSET_CONTRACT)
- [x] WO-14 — Asset production: korean-idol (real kit art wired; live-Aura
      parity polish remains for Checkpoint C)
- [ ] **HUMAN CHECKPOINT C** — per-theme parity review using only whole-window
      actual Aura WebView2 captures of live `claude.ai` in Light and Dark.
      Confirm legible hover/active/selected states, the live sidebar treatment,
      and Korean Idol new-chat/conversation artwork and prompt placement.
- [ ] WO-18 — Aura Studio visual theme editor
- [ ] **HUMAN CHECKPOINT D** — localized, keyboard-accessible editor walkthrough,
      including duplicate/edit/undo/save/restart/delete and actual-Aura
      light/dark apply evidence across both background scopes,
      new-chat/conversation, and normal/fullscreen sizes
- [ ] WO-15 — THEMING.md rewrite as the 30-minute tutorial; prove gate G6 by
      scaffolding, installing, applying, and deleting a demo theme
- [ ] WO-16 — Full verification sweep, release rebuild, final report

Phase 2 — post-1.0 (user-authorized 2026-07-20; specs in `WORK_ORDERS.md`).
Do not start any Phase 2 item before WO-16 is complete:

- [ ] WO-19 — Interactive new-chat prompt widgets (bounded invariant
      relaxation; insert-only, never auto-send)
- [ ] **HUMAN CHECKPOINT E** — live quick-prompt widget walkthrough in actual
      Aura, light/dark, keyboard evidence
- [ ] WO-20 — Live overlay edit mode and token inspector
- [ ] WO-21 — Greeting personalization (Aura-owned greeting element; Claude
      wording untouched)
- [ ] WO-22 — `.aura` theme package export/import
- [ ] **HUMAN CHECKPOINT F** — Phase 2 UX review: overlay editing, greetings,
      and package round-trip, all on actual Aura
- [ ] WO-23 — macOS port (`docs/plans/MAC_PLAN.md` first; no code before plan
      approval)
- [ ] WO-24 — Desktop pet companion (`docs/plans/PET_PLAN.md` first; no code
      before plan approval)

Notes:
- User-authorized permanent evidence policy (2026-07-20): remove and never
  regenerate the reconstructed offline preview, fake/fixture UI images,
  headless screenshots, QA boards, contact sheets, pixel comparisons, and
  image goldens. `npm run verify:cycle` is a non-image payload compilation for
  all eight themes × Light/Dark; `theme-cli qa` writes `status.json` only.
  Studio card/background images remain product assets rather than evidence.
  The only UI visual evidence is a whole-window actual Aura WebView2 capture on
  live `claude.ai`. If capture stays unavailable, follow the blocking rule or
  ask the user to inspect/provide the live captures.
- Checkpoint B revision requested (2026-07-18): use impactful local artwork in
  the theme cards and correct card-label spacing and stacked selection/focus
  treatments. A second revision adds user-adjustable, persisted card-preview
  and custom-background framing through one pointer-drag editor with native
  keyboard-operable controls. The user approved the revised checkpoint on
  2026-07-19.
- The user approved the historical Checkpoint A review on 2026-07-19. Its
  fixture frames and baselines were retired on 2026-07-20 and must not be used
  or regenerated as evidence.
- The user approved Study Library in actual Aura Light/Dark on 2026-07-20. Its
  production layers are frozen; prompt placement customization requested during
  review is queued under WO-17/WO-18.
- WO-08..14 each end with their own actual-Aura mini-checkpoint if provisional
  art was generated (user may replace generated art with supplied kits at any
  time).
- User-authorized scope expansion (2026-07-20): WO-18's artwork-layer cap
  rises from four to eight (byte budgets unchanged) and gains a
  copy-light/dark token convenience; Phase 2 (WO-19..24) is authorized after
  the v1 release. Each Phase 2 order names the single v1 invariant it
  relaxes, and the relaxation applies only inside that order's bounds —
  outside them, every v1 rule (reversibility, no Claude-owned content
  changes, offline operation, host-owned paths) still holds.
- User-authorized Studio artwork amendment (2026-07-20): WO-18 persists a
  Content-canvas/Full-window background scope. Full-window art spans the Aura
  WebView behind a token-controlled translucent sidebar; artwork may be shared
  or dedicated by light/dark appearance, new-chat/conversation context, and
  normal/wide-fullscreen framing, within the existing eight-layer and byte
  budgets.
- If a work order blocks twice, log it in BLOCKED.md and continue.
