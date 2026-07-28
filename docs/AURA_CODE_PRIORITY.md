# Aura Code priority brief — P0

**Status: P0. Declared 2026-07-28. Single active work order.**

WO-27 is the only work order that may consume implementation time until both
of its paths land. Every other open item is frozen (see
[Frozen work](#frozen-work)). This brief is the scheduling authority; the
technical contract still lives in
[`THEME_KIT_SPEC.md`](./THEME_KIT_SPEC.md), the evidence contract in
[`SCREENSHOT_PLAN.md`](./SCREENSHOT_PLAN.md), and the audit position in
[`ACCEPTANCE_AUDIT.md`](./ACCEPTANCE_AUDIT.md). Nothing in this brief relaxes
those three.

## The two paths

### Path A — Aura Code View (live `claude.ai/code`)

Register `code` beside `new-chat` and `conversation`. The accepted theme's
semantic palette, typography, shapes, focus rings, and materials project onto a
closed set of host-discovered roles on the live `claude.ai/code` page. The
official local Claude Code CLI, in the Remote Control mode chosen by the
feasibility spike, remains the engine and owns the filesystem, tools, MCP,
project configuration, worktrees, execution, and permissions. The themed page
never gains project authority.

Path A splits into two shippable halves:

| Half | Contents | Lands as |
| --- | --- | --- |
| **A1 — styling adapter** | `code` context detection, role allowlist, semantic projection, artwork/greeting/prompt-widget suppression, Original-look removal, fail-open behaviour | Mergeable code + unit tests |
| **A2 — engine and consent route** | First-click local/existing/Desktop/no-local/Back choice, benefits/limitations/privacy disclosure, Settings recovery, project shortcut, process lifecycle, `desktop-direct` or `desktop-guidance-only` contract | Implementation-ready plan first, then code |

A1 is verifiable offline and merges on its own. A2 must not be half-built: it
carries consent, privacy, and process-lifecycle promises that a partial
implementation would misrepresent.

### Path B — terminal-theme export (the second path)

Export any built-in or valid user theme as official Light/Dark Claude Code
terminal-theme JSON, selectable through the official `/theme` flow. This is the
route that covers restricted environments and the CLI and Agent View surfaces
people use next to Claude Desktop, without patching anything Anthropic ships.

**Truth boundary, non-negotiable.** Path B does not theme native Claude
Desktop. Claude Desktop and its native Code tab stay unchanged and unthemed. A
terminal theme is a bounded colour projection; it is never evidence that
Desktop Code was styled, and no copy in the product, the README, or a release
note may imply otherwise. The nearest true statement is: *Aura can export a
matching terminal theme for the official Claude Code CLI and Agent View that
run alongside Claude Desktop.*

## Execution order

1. **B — terminal-theme export.** Deterministic, offline-testable, no live
   dependency. It closes one named requirement of HUMAN CHECKPOINT CODE by
   itself and unblocks the restricted-environment story immediately.
2. **A1 — styling adapter.** The largest reviewable chunk of the checkpoint
   matrix, and the part a human capture session cannot begin without.
3. **A2 — plan, then code.** Written contract before implementation, because
   the consent and lifecycle promises are auditable claims.
4. **Checkpoint preparation.** Assemble the capture list; the captures
   themselves stay human work.

B before A1 is a deliberate inversion of the old sequence. B is small and
finishes; A1 is large and benefits from B's token-projection helpers already
existing.

## Frozen work

Paused until both paths land and HUMAN CHECKPOINT CODE is scheduled:

- WO-19 instant prompts, WO-20 live selection, WO-25 Interface targets,
  WO-26 responsive layout sets
- Remaining Studio polish that is not blocking A1
- The 30-minute custom-theme tutorial
- The final release verification sweep
- New built-in themes, new artwork, identity re-cuts

Checkpoint D items already in flight may finish; nothing new may start under
them. HUMAN CHECKPOINT CODE no longer waits for Checkpoint D to close — it is
scheduled as soon as B and A1 land, and the two capture sessions may run in
either order.

## Boundaries that cannot be traded for speed

These are release-blocking regardless of schedule pressure:

- No patching of Claude Desktop, `app.asar`, Windows packages, or code
  signatures, and no bypass of any signature or trust check.
- No new runtime dependency. Aura ships with none, and that is a documented
  product claim.
- No remote resources in themes or exports; no analytics; no account, model,
  or provider settings touched.
- **Original look** removes every Aura Code style and marker without stopping
  the local process.
- Missing or ambiguous host roles fail open to native Claude. Aura never
  guesses at structure it did not discover.
- Aura-owned config, logs, and diagnostics never persist a session URL,
  credential, prompt, transcript, diff, tool output, exact project path, or
  account identity.
- No fixture UI images, QA boards, contact sheets, offline previews, or image
  goldens — banned by [`CONTRIBUTING.md`](../CONTRIBUTING.md) and unable to
  satisfy any checkpoint.

## Definition of done

**Merge-done** (what implementation can close on its own):

- Path B: export command, deterministic Light/Dark JSON for all eight built-ins
  and valid user themes, contrast guardrails reused from
  `scripts/theme-core/validation.mjs`, unit coverage, docs updated.
- Path A1: `code` context detected and themed on the live page, artwork and
  greeting and prompt widgets suppressed there, Original look clean, fail-open
  paths covered, unit coverage, docs updated.
- Path A2: an implementation-ready plan naming the `desktop-direct` or
  `desktop-guidance-only` contract and the concurrency contract.
- `npm test`, `npm run studio:build`, `npm run check`, `npm run verify:cycle`
  all pass.

**Checkpoint-done** (human only, and never claimed by implementation):

Everything in *Styled local Claude Code (HUMAN CHECKPOINT CODE)* in
[`SCREENSHOT_PLAN.md`](./SCREENSHOT_PLAN.md): 32 whole-window actual-Aura
states plus stress and fallback captures, the local read/write proof, the
process-lifecycle and concurrency results, the `/theme` selection run, and the
`en`/`zh-CN`/`zh-HKTW` copy review. Implementation work marks these
`PENDING-LIVE`; it never simulates, reconstructs, or asserts them.

## Handoff

The implementation prompt and operating rules for an external implementation
agent are in
[`handoff/AURA_CODE_IMPLEMENTER_BRIEF.md`](./handoff/AURA_CODE_IMPLEMENTER_BRIEF.md).
