# P0 — the two styling paths

**Status: P0, declared 2026-07-28. These two paths are the only work that may
consume implementation time.**

Aura ships a themed web window. The two things people ask for next — a styled
Claude Code experience, and a styled Claude Desktop — are both unstarted, both
release-blocking, and both already planned in detail. They are now the
forefront work, ahead of every other open item.

| | Path | Approved plan |
| --- | --- | --- |
| **Path 1** | **Aura Code** — style the real `claude.ai/code` session list and active Remote Control view, and export the same palette as an official Claude Code terminal theme | `docs/CODE_STYLIZATION_PLAN.md` on branch `work/investigate-claude-code-stylization-issues` |
| **Path 2** | **Claude Desktop styling** — apply Aura to the installed, authentic Claude Desktop application through a consented, version-gated runtime connection, with the Aura web window as the permanent fallback | `docs/CLAUDE_DESKTOP_STYLING_PLAN.md` on branch `work/investigate-solutions-for-claude-desktop-stylization` |

Both plan documents live on unmerged branches. Merge them into the working
branch before implementation starts, or read them at those refs:

```bash
git show origin/work/investigate-claude-code-stylization-issues:docs/CODE_STYLIZATION_PLAN.md
git show origin/work/investigate-solutions-for-claude-desktop-stylization:docs/CLAUDE_DESKTOP_STYLING_PLAN.md
```

This brief changes priority and sequencing only. It grants no permission those
plans withhold, and it relaxes nothing in
[`THEME_KIT_SPEC.md`](./THEME_KIT_SPEC.md),
[`SCREENSHOT_PLAN.md`](./SCREENSHOT_PLAN.md), or
[`ACCEPTANCE_AUDIT.md`](./ACCEPTANCE_AUDIT.md).

## What each path claims, and what it must never claim

**Path 1.** The official Claude Code CLI in Remote Control mode stays the
engine and owns the filesystem, tools, MCP, worktrees, execution, and
permissions. Aura styles the official web surface and exports terminal colours.
It never claims that ordinary web chat gained local authority, that a saved
project shortcut is a connection, or that the terminal export is visual parity
— the supported format is a bounded colour projection, so the honest phrase is
*matching colours*, not *the same theme*.

**Path 2.** Aura styles Claude Desktop only by connecting to the running,
unmodified, signed application with the user's explicit consent, and only for
Desktop versions it has verified. It never patches Desktop files, package
contents, `app.asar`, signatures, or update settings, and it never falls back
to package extraction, DLL injection, proxying, or certificate installation
when that connection is unavailable. Until Gates A, B, and C in the Desktop
plan pass, Desktop styling is not a product claim: the current true statement
stays *Claude Desktop opens unchanged and unthemed*.

Neither path ships a reconstructed client, and neither is evidence for the
other. A terminal theme is not Desktop styling; a styled Desktop window is not
Aura Code.

## Execution order

Both paths open with spikes their plans define, and both have real work that is
implementable today without a live environment. Run them in parallel at the
boundary between what is provable offline and what is not:

1. **Path 1, terminal-theme projection** (Phase 4 of the Code plan). Pure,
   deterministic, unit-testable, no live dependency. Finish it first.
2. **Path 2, spike tooling** (Spike A of the Desktop plan). Read-only
   capability probe plus the CDP validators extracted out of
   `scripts/injector.mjs`, with hostile-fixture tests. No launcher, config, or
   UI change — this is what the human spike runs *with*, not the product.
3. **Path 1, Code adapter framework** (Phase 3 of the Code plan). The
   discover / validate / prepare / commit / observe / rollback protocol, driven
   by a versioned role-signature descriptor. Without the Phase 0 live DOM
   inventory the descriptor registers no signature and the adapter stays inert
   by construction — that is the correct fail-open state, not a stub.
4. **Spike checklists and go/no-go templates** for the four Path 1 spikes and
   Desktop Gates A–C, so the human runs are recorded rather than re-litigated.

Everything past that waits on a spike result. Nothing in steps 1–4 requires one.

## Frozen work

Paused until both paths **resolve** their gates. Resolved means a published
decision either way: a go that starts that path's product work, or a no-go that
ends it and keeps the current fallback — the Aura web window for Path 2,
existing-session guidance for Path 1. A no-go unfreezes this list exactly like a
go does; nothing here waits on a path that has already been decided against.

Frozen while the gates are still open:

- WO-19 instant prompts, WO-20 live selection, WO-25 Interface targets,
  WO-26 responsive layout sets
- Studio polish that does not block a P0 step
- The 30-minute custom-theme tutorial
- The final release verification sweep
- New built-in themes, new artwork, identity re-cuts

Checkpoint D work already in flight may finish; nothing new starts under it.
HUMAN CHECKPOINT CODE no longer waits for Checkpoint D to close — it is
scheduled as soon as Path 1 has something installable to capture, and the two
capture sessions may run in either order.

## Boundaries that cannot be traded for speed

- No modification of any Anthropic-shipped file, package, or signature, and no
  signature or trust bypass — on either path, at any gate result.
- No new runtime dependency. Aura ships with none, and that is a public claim.
- CDP authority stays minimal: an allowlist of methods, isolated worlds where
  supported, loopback-only endpoints bound to a proven process identity, and
  never the Network, Storage, DOMSnapshot, Fetch, or download domains.
- No page-origin path, argument, flag, URL, or process identifier is ever
  accepted from the remote page or Studio, and no privileged action runs
  without a current native gesture.
- Aura-owned config, logs, diagnostics, and captures never hold a session URL,
  credential, prompt, transcript, diff, tool output, exact project path,
  hostname, or account identity.
- **Original look** removes every Aura marker and style from every attached
  surface without stopping a local process or quitting Desktop.
- Discovery failure means the untouched native surface. A partly themed
  permission or safety dialog is worse than no theme.
- No fixture UI images, offline previews, contact sheets, QA boards, or image
  goldens — banned by [`CONTRIBUTING.md`](../CONTRIBUTING.md), and unable to
  satisfy any checkpoint.

## Definition of done

**Merge-done** — what implementation can close on its own: the four steps in
[Execution order](#execution-order), each covered at the contract and
deterministic-fake rungs of the Code plan's tested-method ladder, with
`npm test`, `npm run studio:build`, `npm run check`, and `npm run verify:cycle`
passing.

**Gate-done** — human spike runs on real Windows hardware: Path 1 spikes 1–4
(remote server, process ownership, Desktop handoff, terminal theme) with
published go/no-go decisions, and Path 2 Gates A, B, and C including the policy
and distribution review. A failed gate is a legitimate outcome that stops that
path's product work; it never authorises an invasive alternative.

**Checkpoint-done** — HUMAN CHECKPOINT CODE in
[`SCREENSHOT_PLAN.md`](./SCREENSHOT_PLAN.md) for Path 1, and the manual Windows
matrix plus release gates in the Desktop plan for Path 2. Implementation marks
these `PENDING-LIVE`; it never simulates or asserts them.

## Handoff

The implementation prompt, budgets, and per-step file-level specs for an
external implementation agent are in
[`handoff/P0_IMPLEMENTER_BRIEF.md`](./handoff/P0_IMPLEMENTER_BRIEF.md).
