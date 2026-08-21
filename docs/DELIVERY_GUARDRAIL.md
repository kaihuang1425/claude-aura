# Delivery guardrail

Claude Aura is **done locally** only when `npm.cmd run delivery:gate` reports
`DONE`. Source tests, an installer build, or a running process cannot satisfy
that claim alone.

## What the finished product must do

The user must verify all seven behaviors in the current installed build:

1. Aura opens the real `claude.ai` inside its own WebView2 host, not Claude
   Desktop.
2. A selected theme remains applied when entering Code, leaving Code, and
   returning to the chat page.
3. The Aura window provides the multi-tab web interface and restores its tabs.
4. Dashboard displays actual local Codex sessions rather than sample or
   synthetic cards.
5. Pip, Nori, and Moss can be loaded with their available settings.
6. Theme, tabs, Dashboard state, and pet settings survive a normal restart.
7. Original look removes Aura styling and artwork without damaging the site.

The review must use the installed application on live `claude.ai`. A fixture,
headless page, source screenshot, Claude Desktop window, or process listing is
not visual acceptance.

## One delivery path

1. Inspect a fresh interactive-desktop view with Computer Use. If Aura or
   Studio is open, exit it through Aura's own window or tray controls.
2. Run `npm.cmd run delivery:refresh`. It runs the repository checks and theme
   cycle, rebuilds the one Setup under `release/windows`, audits it, installs
   that exact Setup, audits the installed tree, writes a source-bound receipt,
   and launches the installed Studio.
3. Exercise the seven behaviors above. Save one unobstructed whole-window
   capture under `dist/verify/live-aura/` as required by
   `docs/SCREENSHOT_PLAN.md`.
4. Only after the user explicitly approves all seven behaviors, record the
   review:

   ```powershell
   node scripts/delivery-gate.mjs accept --capture "dist/verify/live-aura/<capture>.png" --user-approved-all
   ```

5. Run `npm.cmd run delivery:gate`. Only `DONE` permits a local-completion
   claim.

`delivery:refresh` never closes or terminates Aura. If a host is running, it
stops before tests or installation and tells the operator to perform the fresh
desktop check and normal product exit.

## Gate states

- `BLOCKED`: source, Setup, installed payload, or runtime evidence is missing
  or stale. Follow the single printed next action.
- `READY FOR LIVE REVIEW`: current source, Setup, installed payload, and live
  runtime agree. Visual behavior and user approval are still pending.
- `DONE`: all five evidence classes agree, including a hash-bound live capture
  and explicit user approval.

The delivery receipt is `dist/delivery/latest.json`. The approval receipt is
`dist/verify/live-aura/delivery-acceptance.json`. Both are local evidence and
remain outside release artifacts.

An unsigned-development Setup can reach local `DONE`, but it remains
non-release-eligible. Public release, signing, commit, and deployment are
separate states and must never be inferred from this gate.
