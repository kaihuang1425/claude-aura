# Visual completion audit — 2026-08-08

## Verdict

**The goal is not complete.** The ordered queue names WO-27 as the current item,
then requires HUMAN CHECKPOINT CODE before WO-15/WO-16
(`docs/plans/QUEUE.md:3-12`, `docs/plans/QUEUE.md:303-327`). The stable embedded
Code surface is still a hard NO-GO, and the current source-only visual output is
not fully live-verified. Mechanical green results do not prove installation,
live rendering, or user approval.

Evidence labels below mean: **implemented** = source exists; **mechanical** =
current automated checks pass; **live** = actual Aura/Claude or Claude Code was
exercised; **approved** = the owner accepted that exact visual; **blocked** = an
authoritative gate forbids or prevents completion.

## Requirement and evidence audit

| Requirement / component | Current evidence | Status |
| --- | --- | --- |
| Earlier v1 visual baseline through WO-18 | The queue marks WO-18 and HUMAN CHECKPOINT D complete, including the all-eight Studio, loading-cover, wordmark, sidebar/composer, accessibility, and locale matrix (`docs/plans/QUEUE.md:281-302`). The progress ledger records installed owner approval (`docs/PROGRESS.md:221-233`). | **Approved for that recorded release candidate.** This does not approve later visual amendments automatically. |
| Frozen-theme asset orders WO-08 and WO-09 | The queue still records both as blocked (`docs/plans/QUEUE.md:265-269`). WO-08 still needs a compliant corner asset, audit, Light/Dark live captures, and approval (`docs/plans/BLOCKED.md:19-37`). WO-09's blocker record contains a later capture workaround (`docs/plans/BLOCKED.md:39-72`), but the queue was never reconciled and still says its live evidence is unavailable. | **Not complete in the authoritative queue; not current work.** A literal “all visual components” claim is therefore already unproved. |
| Stable/release Aura Code View | The feasibility record remains failed because the Aura-hosted sentinel is partial and embedded auth/support is NO-GO (`docs/plans/AURA_CODE_SPIKE.md:320-336`). BLOCKED explicitly forbids production Code signatures, onboarding, project persistence, activation, and styling until an affirmative support contract or separately approved architecture exists (`docs/plans/BLOCKED.md:501-525`). The 2026-08-08 official-source refresh found no unblock (`docs/handoff/WO27_OFFICIAL_RESEARCH_2026-08-08.md:5-12`, `docs/handoff/WO27_OFFICIAL_RESEARCH_2026-08-08.md:127-150`). | **Blocked.** The full WO-27 visual/product interface is neither authorized nor implemented. |
| Supported terminal-theme visual fallback | Studio creates an export action for every theme (`studio/app.js:981-996`); the host uses two native Save dialogs and a strict pair exporter (`windows/aura-ui.ps1:7834-7888`). Current tests cover all built-ins, semantic exclusions, collisions, and atomic rollback. A sample Light/Dark pair was selected and reviewed in official Claude Code (`docs/plans/AURA_CODE_SPIKE.md:470-503`). | **Implemented + mechanical + one live format sample.** Installed Studio button/dialog interaction and user acceptance remain explicitly pending (`docs/PROGRESS.md:139-164`). It cannot substitute for Aura Code View (`docs/plans/WORK_ORDERS.md:1381-1384`). |
| `desktop-guidance-only` fallback | The native host exposes a consent-first, fixed allowlisted documentation link (`windows/aura-ui.ps1:7462-7500`) from tray and launcher (`windows/aura-ui.ps1:9977-10014`, `windows/aura-ui.ps1:10115-10155`). | **Implemented + mechanical; installed interaction not live-approved.** It must remain guidance only and Claude Desktop must remain stock (`docs/plans/WORK_ORDERS.md:1162-1172`). |
| Source-checkout Code shell background and material cues | The only authorized experiment is exactly one visible `aside` plus one visible `main`, with semantic background colours and compiler-owned inset cues; descendants, typography, artwork, installed/release activation, and Desktop styling remain forbidden (`docs/plans/QUEUE.md:29-56`). The descriptor supplies fixed per-theme cues (`scripts/theme-core/code-adapter.mjs:6-65`), and the adapter enforces dialog veto, unique shell roles, native-shadow veto, contrast media gates, and rollback (`scripts/theme-core/code-adapter.mjs:95-185`). Production compilation strips active Code blocks (`scripts/theme-core/compile.mjs:1089-1108`), while CLI activation requires an explicit real source checkout (`scripts/theme-cli.mjs:281-301`). | **Implemented + mechanical only for the current material-cue revision.** Five Light captures and owner acceptance cover the earlier background-shell foundation, not the later material cues (`docs/PROGRESS.md:54-76`). The ledger still lists 11 unobserved background cells: Default, Anime Twilight, and Study Library Light, plus all eight Dark (`docs/PROGRESS.md:63-70`). No cited live evidence approves the current inset cues in any cell. |
| HUMAN CHECKPOINT CODE | It requires installed Aura, a real disposable CLI-first session, local read/write and permission lifecycle, Chat/Code cleanup, all eight themes in Light/Dark on list and active-session states, accessibility/fallback/Original look, terminal export, Desktop contract, and localized disclosures (`docs/plans/WORK_ORDERS.md:1484-1524`). Whole-window actual Aura on live `claude.ai/code` is the only UI evidence (`docs/plans/WORK_ORDERS.md:1526-1532`). | **Open and presently unreachable as a full stable checkpoint** while the support gate is NO-GO. The narrower source experiment can be reviewed, but cannot close WO-27 or this checkpoint. |
| Later visual components | Phase 2 prompt widgets, overlay editor, greeting, component overrides, responsive layouts, custom loading editor, and Checkpoints E/F are all unchecked and expressly may not start before WO-16 (`docs/plans/QUEUE.md:329-345`). | **Deferred / not currently permitted.** Existing partial source must not be upgraded to queue completion or approval. |

## Safe work remaining before HUMAN CHECKPOINT CODE

No additional **production Aura Code UI** source work is authorized under the
current blocker. The safely permitted source slices—terminal export, Desktop
guidance, and the opt-in outer-shell experiment—already exist and pass current
mechanical checks. The remaining in-scope movement is evidence work:

1. Launch the explicit source experiment only after the ordinary single-instance
   owner exits through Aura's own X/tray Exit; the recorded rule forbids another
   launch or process termination while it remains (`docs/plans/BLOCKED.md:576-599`).
2. Review the final material-cue revision in actual Aura across all eight themes
   in Light/Dark. Earlier five-cell captures do not prove the changed pixels.
3. Exercise the installed terminal-export and Desktop-guidance interactions.
4. Keep full WO-27/HUMAN CHECKPOINT CODE open unless the support unblock occurs;
   do not implement the forbidden onboarding/project/process/inner-Code UI as a
   way around the gate.

## Current mechanical snapshot

Run against the dirty working tree on 2026-08-08:

- `npm.cmd run check`: **174/174 passed**.
- `npm.cmd run verify:cycle`: **17/17 passed**; the command itself states visual
  approval still requires actual Aura on live `claude.ai`.
- `git diff --check`: passed.
- Branch `work/full-theme-system` is 27 commits ahead of its upstream. Before
  this report, 26 tracked files were modified, `.tmp/` was untracked, and
  nothing was staged. Those unstaged diagnostic/locale changes are not counted
  as committed, installed, or approved visual evidence.

Separately, committed `HEAD` (`555a236`) was cloned without hardlinks and used
as the installation source so no dirty-worktree bytes could enter the installed
application. The installer passed **170/170** tests, installed successfully, and
launched Aura. A post-install SHA-256 comparison covered 61 installed files
changed by the current visual commits with **zero mismatches**. The same clean
clone then passed `npm.cmd run verify:cycle` at **17/17**. Windows reported the
real Aura and Studio top-level windows visible at 1293 x 765; the built-in
Computer Use enumerator still omitted these PowerShell-owned windows, so this is
installed/runtime evidence but not visual inspection or owner approval.
