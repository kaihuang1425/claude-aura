# Aura Code P0 — external implementer brief

Written for a high-effort external implementation agent (GPT-5.6 Sol Max
class) picking up WO-27 with no prior context in this repository.

Priority context: [`../AURA_CODE_PRIORITY.md`](../AURA_CODE_PRIORITY.md).

This file has three parts:

1. [The prompt](#1-the-prompt) — paste verbatim, nothing else needed.
2. [Operating rules](#2-operating-rules) — budgets and stop conditions.
3. [Task specifications](#3-task-specifications) — file-level contracts.

The agent this is written for is strong at implementation and weak at
stopping. It over-invests in tests, builds fallbacks nobody asked for, and
re-opens settled questions for hours. Parts 2 and 3 exist to remove every
excuse to deliberate: each foreseeable open question already has a decided
answer below. An answer that is already written is not a question.

---

## 1. The prompt

````
You are implementing WO-27 in the claude-aura repository. Read
docs/AURA_CODE_PRIORITY.md and docs/handoff/AURA_CODE_IMPLEMENTER_BRIEF.md
first. Follow the brief's budgets, decision defaults, and forbidden list
exactly; they override your usual habits.

WO-27 is the only P0. It has two paths:

  Path B — export any Aura theme as official Light/Dark Claude Code
  terminal-theme JSON, selectable through the official /theme flow. This
  covers restricted environments and the CLI and Agent View surfaces used
  alongside Claude Desktop. It does NOT theme native Claude Desktop, and no
  code, comment, doc, or commit message you write may imply that it does.

  Path A1 — register a `code` view beside `new-chat` and `conversation` so
  the accepted theme's semantic palette, typography, shapes, focus, and
  materials project onto a closed set of host-discovered roles on live
  claude.ai/code. Chat artwork, greetings, and prompt widgets stay off that
  route. Original look removes every Code style and marker. Missing or
  ambiguous roles fail open to native Claude.

  Path A2 — do NOT implement. Produce docs/handoff/WO27_A2_PLAN.md only.

Work in this order, committing after each: B, then A1, then the A2 plan.

Hard limits:
- No new dependencies. No lockfile, bundler, TypeScript, or test framework.
  Node 22 and the existing tests/support/harness.mjs only.
- One new test suite per path, 250 lines maximum each, registered in
  tests/run-tests.mjs. Reuse the DOM stub pattern already in
  tests/greeting-runtime.test.mjs. Do not build a new harness, mock server,
  fixture UI, screenshot, QA board, or image golden.
- Do not refactor scripts/theme-core/studio.mjs, compile.mjs, or
  validation.mjs beyond the additive hooks the brief names.
- Do not add artwork contexts, Code-specific editor controls, telemetry,
  retry loops, or speculative multi-session infrastructure.
- Run `npm test && npm run studio:build && npm run check` once per path,
  after that path is written, not after each edit. Run
  `npm run verify:cycle` once at the very end.

When something is unverifiable offline — live claude.ai/code structure, the
official terminal-theme key names, real Remote Control behaviour — write it
into the PENDING-LIVE list in your report and keep going. Never simulate a
live surface, never assert a capture you did not take, never invent an
official schema key. Marking something PENDING-LIVE is a complete, correct
outcome, not a failure to fix.

You have one clarification question, batched, and only if the brief's
decision-defaults table does not cover it. Otherwise take the default,
record it under Decisions, and never revisit it. If you edit the same file
three times for the same reason, stop editing and write the reason in your
report.

Finish with the report format in the brief: files touched, decisions taken,
PENDING-LIVE items, check results verbatim. No progress narration in
between.
````

---

## 2. Operating rules

### Budgets

| Path | Files touched (max) | New test files | New test assertions (target) | Checks run |
| --- | --- | --- | --- | --- |
| B | 8 | 1 (`tests/terminal-theme.test.mjs`) | 10–14 | once, at path end |
| A1 | 10 | 1 (`tests/code-view.test.mjs`) | 10–16 | once, at path end |
| A2 plan | 2 | 0 | 0 | none |

A budget is a ceiling, not a target. Coming in under it is a good result and
needs no justification in the report.

### Test rules

The suite is already 29,000 lines. It does not need proportional growth; it
needs the new behaviour covered once, at the boundary, and nothing else.

Cover exactly these classes, one assertion each:

- correct output for the normal case (all eight built-ins where the loop is
  free);
- determinism (same input, byte-identical output);
- the fail-open path (ambiguous or missing input yields native behaviour);
- the removal path (Original look / cleanup leaves no marker);
- one guardrail rejection (invalid input throws).

Do not add: permutation matrices over every theme × mode × role, property
based generators, performance benchmarks, tests asserting the shape of your
own private helpers, or a second test that differs from the first only by
input value.

### Forbidden

- Any new runtime or dev dependency, `package-lock.json`, or `node_modules`
  addition. Aura ships zero dependencies and says so publicly.
- Any change to `.github/workflows/ci.yml`, the release scripts, or the
  installer.
- Fixture UI images, offline previews, contact sheets, QA boards, image
  goldens — explicitly banned by `CONTRIBUTING.md`.
- Patching, probing, or reading Claude Desktop's installed files, `app.asar`,
  packages, or signatures. Aura's whole trust position depends on never doing
  this.
- Writing a session URL, credential, prompt, transcript, diff, tool output,
  exact project path, or account identity into config, logs, or diagnostics.
- Locale work. English copy only; the `locale:export` / `locale:import` round
  trip happens after copy approval, not during implementation.
- Editing documents outside the ones each task lists.
- Claiming, anywhere, that native Claude Desktop is themed.

### Anti-loop rules

1. Every question in [Decision defaults](#decision-defaults) is answered. Take
   the answer.
2. A question not in the table: one batched clarification, then proceed with
   your own stated assumption if no answer arrives. Do not block.
3. Third edit to the same file for the same reason means stop. Write what you
   were fighting into the report and move on.
4. Unverifiable offline means `PENDING-LIVE`, not "one more approach".
5. Do not re-derive a decision recorded earlier in your own run. Re-reading
   your Decisions list is cheaper than re-deciding, and re-deciding is the
   failure mode.
6. Do not write defensive code for conditions the guardrails already reject.
   `validateTheme` runs before your code; a theme reaching you is valid.

### Decision defaults

| Question | Decided answer |
| --- | --- |
| Official terminal-theme JSON key names unconfirmed? | Put every key name in one descriptor object (`TERMINAL_THEME_SCHEMA`) at the top of `scripts/theme-core/terminal.mjs`. Take names from current official Claude Code documentation if reachable; if not, set `schemaSource: "unverified"` on the descriptor, keep the projection logic complete, and list it PENDING-LIVE. Never invent extra keys to look thorough. |
| ANSI slots with no matching Aura token? | Leave the official default for that mode untouched. Aura projects only what it owns. No hue-rotation schemes, no generated palettes. |
| A built-in fails the contrast floor after projection? | Clamp lightness using the existing `contrastRatio` helper until it passes, record the clamped theme and mode in the report. Do not redesign the theme. |
| Colour format in the export? | Lowercase `#rrggbb`, 2-space JSON indent, descriptor key order, one trailing newline. No timestamps, no version stamps, no generator comments. |
| How does the `code` route get detected? | Extend the existing `detectContext` in `assets/renderer-inject.js`. One discovery pass, host roles only. No selector stacking, no second MutationObserver, no polling. |
| Ambiguous or missing role on the Code page? | Fail open to native for that role. The rest of the page still themes. Same pattern as the greeting `fail(...)` path. |
| Should Code get artwork contexts? | No. Artwork context keys stay `{"new-chat": "n", conversation: "c", other: "o"}`. Code is semantic projection only. |
| Should the theme schema version change? | No. Both paths are additive and need no migration or back-compat shim. |
| Multi-session, worktree, or process-lifecycle work in A1? | Out of scope. It belongs to A2 and stays on paper. |
| Consent UI copy? | A2 plan only, English, not implemented. |
| Studio editor controls for Code? | None. Not in WO-27. |
| Screenshots or capture evidence? | Human-only. Produce none, assert none. |

---

## 3. Task specifications

### Path B — terminal-theme export

**New:** `scripts/theme-core/terminal.mjs`

```js
export function buildTerminalTheme(theme, mode) // -> plain JSON-ready object
export const TERMINAL_THEME_SCHEMA               // key names + schemaSource
```

Read `theme[mode].semantic` and project these roles. Left column is the Aura
token; right column is the role the descriptor binds to an official key:

| Aura token | Terminal role |
| --- | --- |
| `--aura-background-primary` | background |
| `--aura-panel-background` | secondary / panel background |
| `--aura-text-primary` | foreground |
| `--aura-text-secondary` | secondary text |
| `--aura-text-muted` | muted / dim text |
| `--aura-accent-primary` | accent, cursor |
| `--aura-accent-secondary` | secondary accent |
| `--aura-success` | success, diff added |
| `--aura-destructive` | error, diff removed |
| `--aura-warning` | warning |
| `--aura-border-emphasis` | rules and separators |

Selection colour composites `--aura-accent-primary` over the background at a
fixed ratio; pick one ratio, write it as a named constant, do not expose it as
an option.

Reuse from `scripts/theme-core/validation.mjs`: `hslRgb` for channel
conversion, `hexToHsl` where a hex input needs normalising, `contrastRatio`
for the floor check. Do not write new colour maths.

Guardrail: foreground against background must reach 4.5:1, and each of
success / error / warning against background must reach 3:1, in both modes,
for all eight built-ins.

**Wire up:**

- `scripts/theme-core.mjs` — re-export `buildTerminalTheme` from the barrel.
- `scripts/theme-cli.mjs` — add an `export-terminal <theme-id> [--out <dir>]`
  command in the existing `command === "..."` dispatch chain (around
  line 257 onward). It writes `<theme-id>-light.json` and
  `<theme-id>-dark.json`, and honours the existing `--user-themes` option so
  user kits export too.
- `docs/THEMING.md` — one short section: how to export and how to select the
  file through the official `/theme` flow, with the Desktop truth boundary
  stated plainly.
- `docs/FILE_MANIFEST.md` — register the new files.

**Tests** — `tests/terminal-theme.test.mjs`, registered in
`tests/run-tests.mjs`: eight built-ins × both modes produce complete output
passing the contrast floor; identical input produces byte-identical output; a
theme missing a required token throws; the export contains no artwork path,
layout geometry, greeting, or wallpaper field.

### Path A1 — Code styling adapter

**`assets/renderer-inject.js`**

- `detectContext` (around line 542) returns `"code"` when the host structure
  for the Code route is discovered. Keep the existing early `other` returns
  intact; add one discovery branch, not a new detection layer.
- `applyArtworkContext` (around line 661) suppresses artwork for `code`. The
  three artwork context keys stay as they are.
- The `new-chat` prompt-layout call (around line 1078) stays gated to
  `new-chat`; Code must not reach it.
- The greeting runtime must not run on Code.
- Add the Code marker attribute to the existing cleanup/Original-look path and
  to the observer's `attributeFilter` list (around line 1331) if the marker
  needs to survive SPA remounts.

**Role allowlist:** one frozen array in the renderer, host-discovered roles
only — transcript, tool/result block, code/diff block, composer, navigation,
session list, focus/selected/disabled state, connection and permission
status. A role that is not discovered stays native. Aura never adds a page,
route, selector, or target on a theme's behalf.

**Never on this route:** project verbs, exact paths, session URLs, privileged
local actions, or anything that reads as Aura owning the engine.

**Docs:** `docs/THEME_KIT_SPEC.md` (Code adapter's shipped scope),
`docs/TROUBLESHOOTING.md` (what a user sees when roles are missing),
`docs/FILE_MANIFEST.md`.

**Tests** — `tests/code-view.test.mjs`: the DOM stub detects `code`; artwork
and greeting and prompt layout stay absent there; every allowlisted role gets
themed values; an undiscovered role stays native while the rest still theme;
cleanup removes every Code marker.

### Path A2 — plan only

`docs/handoff/WO27_A2_PLAN.md`, no implementation. It must name:

- the first-click choice surface (local / existing session / full Desktop /
  no local editing / Back) and where consent is stored;
- the benefits, limitations, privacy, and separate-history disclosure, plus
  its Settings re-entry point;
- the `desktop-direct` or `desktop-guidance-only` contract, with the
  feasibility evidence each would require;
- the `multi-session-worktree` or `one-process-per-session` concurrency
  contract;
- the process lifecycle: visible, minimized, background, stop, restart,
  keep-or-stop on close;
- what Aura-owned project config and logs may contain (label, path, route —
  and nothing else);
- the mapping from each of the above to its HUMAN CHECKPOINT CODE capture in
  `docs/SCREENSHOT_PLAN.md`.

Keep it under 200 lines. It is a contract, not a design essay.

---

## 4. PENDING-LIVE protocol

Anything that needs the live site, a real Claude Code install, or a human
capture is recorded, not attempted:

```
PENDING-LIVE: <what> — <why it cannot be verified offline> — <who closes it>
```

These are expected outcomes. The official terminal-theme key names, the real
`claude.ai/code` role structure, `/theme` selection behaviour, and every
checkpoint capture will all land here. A report with a well-formed
PENDING-LIVE list is complete work.

## 5. Report format

```
## Files touched
<path> — <one line>

## Decisions
<question> → <answer taken> (default | own assumption)

## PENDING-LIVE
<entries in the format above>

## Checks
npm test              -> <verbatim final line>
npm run studio:build  -> <verbatim final line>
npm run check         -> <verbatim final line>
npm run verify:cycle  -> <verbatim final line>

## Not done
<anything in scope you did not finish, and why>
```

No progress narration, no summaries of the brief back to the reader, no
restatement of decisions already listed.
