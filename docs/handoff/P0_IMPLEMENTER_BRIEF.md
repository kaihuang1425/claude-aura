# P0 implementer brief — Aura Code and Claude Desktop styling

Written for a high-effort external implementation agent (GPT-5.6 Sol Max
class) picking up the two P0 paths with no prior context in this repository.

Priority context: [`../P0_STYLING_PATHS.md`](../P0_STYLING_PATHS.md).
Approved plans (unmerged branches, read them first):

```bash
git show origin/work/investigate-claude-code-stylization-issues:docs/CODE_STYLIZATION_PLAN.md
git show origin/work/investigate-solutions-for-claude-desktop-stylization:docs/CLAUDE_DESKTOP_STYLING_PLAN.md
```

Three parts: [the prompt](#1-the-prompt), [operating rules](#2-operating-rules),
[work items](#3-work-items).

The agent this is written for is strong at implementation and weak at
stopping. It over-invests in tests, builds fallbacks nobody asked for, and
re-opens settled questions for hours. Parts 2 and 3 remove the excuses to
deliberate: every foreseeable open question already has a decided answer below.
An answer that is already written is not a question.

---

## 1. The prompt

````
You are implementing the two P0 paths in the claude-aura repository. Read
docs/P0_STYLING_PATHS.md and docs/handoff/P0_IMPLEMENTER_BRIEF.md first, then
the two approved plans at the refs the brief names. Follow the brief's
budgets, decision defaults, and forbidden list exactly; they override your
usual habits.

Path 1 is Aura Code: style the real claude.ai/code session list and Remote
Control view, and export the same palette as an official Claude Code terminal
theme. Path 2 is Claude Desktop styling: connect Aura to the running,
unmodified, signed Desktop app under explicit consent and a verified version
allowlist. Neither path patches anything Anthropic ships. Until the Desktop
plan's Gates A-C pass, "Claude Desktop opens unchanged and unthemed" stays
the only true statement about Desktop, and nothing you write may imply
otherwise.

Both plans open with human spikes on real Windows hardware that you cannot
run. Implement only the four work items in the brief, in this order,
committing after each:

  1. Terminal-theme projection (Code plan Phase 4) — pure and deterministic.
  2. Desktop spike tooling (Desktop plan Spike A) — read-only capability
     probe plus CDP validators extracted from scripts/injector.mjs. No
     launcher, config, or UI change; this is what the human spike runs with,
     not the product.
  3. Code adapter framework (Code plan Phase 3) — the discover / validate /
     prepare / commit / observe / rollback protocol behind a versioned
     role-signature descriptor. The live DOM inventory does not exist yet, so
     the descriptor registers no signature and the adapter stays inert. That
     is the correct fail-open state; do not invent selectors to make it do
     something.
  4. Spike runbook — checklists and go/no-go record templates for the four
     Path 1 spikes and Desktop Gates A-C.

Hard limits:
- No new dependencies. No lockfile, bundler, TypeScript, or test framework.
  Node 22 and the existing tests/support/harness.mjs only.
- One new test suite per work item, 250 lines maximum each, registered in
  tests/run-tests.mjs. Reuse the DOM stub pattern in
  tests/greeting-runtime.test.mjs. Do not build a new harness, mock server,
  fixture UI, screenshot, QA board, or image golden.
- Do not refactor scripts/theme-core/studio.mjs, compile.mjs, or
  validation.mjs beyond the additive hooks the brief names. Item 2's
  extraction from scripts/injector.mjs must preserve current behaviour
  exactly; the existing injector tests must pass untouched.
- Do not add artwork contexts, Code-specific editor controls, telemetry,
  retry loops, launcher or config changes, or speculative process management.
- New documentation files must be registered in BOTH docs/FILE_MANIFEST.md
  and the deliverableDocumentation set in tests/support/context.mjs, or the
  manifest test fails.
- `npm test` takes a few minutes. Run `npm test && npm run studio:build &&
  npm run check` once per work item, after that item is written, not after
  each edit. Run `npm run verify:cycle` once at the very end.

When something is unverifiable offline — live claude.ai/code structure, real
CDP behaviour against Desktop, official terminal-theme token names, spike
outcomes — write it into the PENDING-LIVE list in your report and keep going.
Never simulate a live surface, never assert a capture you did not take, never
invent an official schema key. Marking something PENDING-LIVE is a complete,
correct outcome, not a failure to fix.

You have one clarification question, batched, and only if the brief's
decision-defaults table does not cover it. Otherwise take the default, record
it under Decisions, and never revisit it. If you edit the same file three
times for the same reason, stop editing and write the reason in your report.

Finish with the report format in the brief: files touched, decisions taken,
PENDING-LIVE items, check results verbatim. No progress narration in between.
````

---

## 2. Operating rules

### Budgets

| Work item | Files touched (max) | New test files | New assertions (target) | Checks |
| --- | --- | --- | --- | --- |
| 1 — terminal projection | 8 | 1 (`tests/terminal-theme.test.mjs`) | 10–14 | once, at item end |
| 2 — Desktop spike tooling | 10 | 1 (`tests/desktop-cdp.test.mjs`) | 12–16 | once, at item end |
| 3 — Code adapter framework | 10 | 1 (`tests/code-adapter.test.mjs`) | 10–16 | once, at item end |
| 4 — spike runbook | 3 | 0 | 0 | none |

A budget is a ceiling, not a target. Coming in under it is a good result and
needs no justification.

### Test rules

The suite is already 29,000 lines across 99 tests and takes minutes. It does
not need proportional growth; it needs the new behaviour covered once, at the
boundary, and nothing else.

Cover exactly these classes, one assertion each:

- the normal case (all eight built-ins where the loop is free);
- determinism — same input, byte-identical output;
- the fail-open path — ambiguous, missing, or unknown input yields native
  behaviour and no partial state;
- the removal path — cleanup leaves no marker and repeats harmlessly;
- one hostile-input rejection per validator;
- one interruption case where a write is involved — crash before and after
  promotion leaves a complete old or new document.

Do not add: permutation matrices over every theme × mode × role, property-based
generators, performance benchmarks, tests asserting the shape of your own
private helpers, or a second test that differs from the first only by input
value.

### Forbidden

- Any new runtime or dev dependency, `package-lock.json`, or `node_modules`
  addition.
- Any change to `.github/workflows/ci.yml`, the release scripts, or the
  installer.
- Reading, extracting, patching, or hashing Claude Desktop's package contents,
  `app.asar`, or signatures. Read-only *install identity* — normalized
  executable path, signature validity, version, PID, creation time — is the
  entire permitted surface.
- Enabling the CDP Network, Storage, DOMSnapshot, Fetch, or download domains,
  or accepting a non-loopback endpoint, a title-only target match, or an
  endpoint you cannot bind to a proven process identity.
- Persisting ports, PIDs, browser IDs, target IDs, session URLs, credentials,
  transcripts, prompts, diffs, tool output, exact project paths, hostnames, or
  account identity.
- Launcher, `launchMode` config, choice UI, or product wiring for Path 2. Those
  are post-gate items in the Desktop plan and stay unwritten.
- Fixture UI images, offline previews, contact sheets, QA boards, image
  goldens.
- Locale work. English copy only; the `locale:export` / `locale:import` round
  trip happens after copy approval.
- Editing documents outside the ones each item lists.

### Anti-loop rules

1. Every question in [Decision defaults](#decision-defaults) is answered. Take
   the answer.
2. A question not in the table: one batched clarification, then proceed on your
   own stated assumption if no answer arrives. Do not block.
3. Third edit to the same file for the same reason means stop. Write what you
   were fighting into the report.
4. Unverifiable offline means `PENDING-LIVE`, not "one more approach".
5. Do not re-derive a decision recorded earlier in your own run. Re-reading
   your Decisions list is cheaper than re-deciding, and re-deciding is the
   failure mode.
6. Do not write defensive code for conditions the guardrails already reject.
   `validateTheme` runs before your code; a theme reaching you is valid.
7. An inert adapter with no registered signature is finished work, not an
   unfinished feature. Do not keep going until it "does something".

### Decision defaults

| Question | Decided answer |
| --- | --- |
| Official terminal-theme token names unconfirmed? | Put every token name in one descriptor at the top of `scripts/theme-core/terminal.mjs`, seeded from the Code plan's Phase 4 mapping table. Confirm against current official documentation if reachable; if not, set `schemaSource: "unverified"` and list it PENDING-LIVE. Never invent extra keys to look thorough. |
| Terminal tokens Aura has no semantic for? | Omit them and let the documented Light or Dark base supply the value. Aura projects only what it owns. No generated palettes, no hue rotation. |
| A built-in fails the contrast floor after projection? | Clamp lightness against the base using the existing `contrastRatio` helper, record the clamped theme and mode in the report. Do not redesign the theme. |
| Export file format? | `Claude Aura — <theme name> Light` / `Dark` display names, deterministic slug filenames, 2-space JSON, one trailing newline, no timestamps or generator comments. Ownership marker lives in a separate Aura-owned manifest, never inside the official JSON. |
| Should the export install itself into `~/.claude/themes/`? | Write to an Aura-owned staging directory. Installation is preview → validate → explicit user action, refuses to overwrite any file Aura does not own by digest, and never selects a theme in a running CLI. `/theme` stays the user's step. |
| Where do the extracted CDP validators live? | `scripts/desktop-cdp/validation.mjs`. `scripts/injector.mjs` becomes a thin caller with identical behaviour. If a behaviour difference appears, keep the injector's current behaviour and note it. |
| Desktop version allowlist content? | `desktop-compatibility.json` ships with an empty verified range and `unknown` as the default decision. Unknown versions are disabled, never optimistically matched. Populating the range is a Gate A output, PENDING-LIVE. |
| Code adapter selectors? | None yet. The role-signature descriptor is empty until the Phase 0 live DOM inventory exists. Probe order is semantic element → ARIA role/state → stable data attribute → narrow structural relationship, and a generated utility class is never an identity on its own. |
| Contexts for the Code route? | `code-list` and `code-session`, registered beside the chat contexts. No theme schema change, no schema version bump, no migration. |
| Safety-sensitive role is ambiguous? | Roll back the entire Code adapter for that route. Never leave a permission or dialog surface partly themed. |
| Should artwork, greetings, or prompt widgets appear on Code? | No, and Studio's live-page mirror stays disabled across the whole Code route. |
| Process launch, Job Objects, stop semantics, consent UI? | Out of scope for all four items. They are post-spike work in the plans. |
| Screenshots or capture evidence? | Human-only. Produce none, assert none. |
| New doc file added? | Register it in `docs/FILE_MANIFEST.md` *and* `deliverableDocumentation` in `tests/support/context.mjs`. |

---

## 3. Work items

### Item 1 — terminal-theme projection

**New:** `scripts/theme-core/terminal.mjs`

```js
export function buildTerminalTheme(theme, mode) // -> JSON-ready object
export const TERMINAL_THEME_SCHEMA               // token names + schemaSource
```

Mapping, from the Code plan's Phase 4 table:

| Aura semantic | Terminal intent |
| --- | --- |
| `--aura-accent-primary` | `claude` |
| `--aura-text-primary` / `--aura-text-secondary` / `--aura-text-muted` | `text`, `inactive`, `subtle` |
| focus / selection derivation | `suggestion`, `permission` |
| `--aura-success` / `--aura-destructive` / `--aura-warning` | `success`, `error`, `warning` |
| `--aura-composer-background` | input-mode borders, `userMessageBackground` where documented |
| `--aura-success` / `--aura-destructive` at diff weight | `diffAdded`, `diffRemoved` |

Reuse `hslRgb`, `hexToHsl`, and `contrastRatio` from
`scripts/theme-core/validation.mjs`. Do not write new colour maths. Artwork,
typography, blur, shadow, radius, and layout never transfer.

**Wire up:** barrel export in `scripts/theme-core.mjs`; an
`export-terminal <theme-id> [--out <dir>]` command in the existing dispatch
chain of `scripts/theme-cli.mjs` honouring `--user-themes`; atomic
same-directory temporary-file promotion for the written files; a short
`docs/THEMING.md` section covering export, the `/theme` selection step the user
performs, and the *matching colours, not the same theme* wording.

**Tests** — `tests/terminal-theme.test.mjs`: eight built-ins × both modes
produce complete output passing the contrast floor; identical input is
byte-identical; a theme missing a required token throws; the output contains no
artwork path, geometry, greeting, or wallpaper field; a foreign-owned
collision refuses to overwrite; interruption before and after promotion leaves
a complete document.

### Item 2 — Desktop spike tooling

**New:** `scripts/desktop-cdp/validation.mjs` — endpoint URL validation
(IPv4 and IPv6 loopback, no credentials, query, fragment, or unexpected path),
browser-ID pinning, target-ID validation, timeout policy, version allowlisting,
and log sanitisation. Extract these from `scripts/injector.mjs` without
behaviour change; the injector becomes a thin caller.

**New:** `scripts/desktop-probe.mjs` — queries only `/json/version` and
`/json/list`, records sanitized target types, origins, and marker booleans, and
emits a bounded JSON result with reason codes. No titles, DOM text, full URLs,
cookies, or network traffic.

**New:** `windows/desktop-capability.ps1` — read-only install and process
discovery reusing `Get-AuraClaudeInstall`; reports package kind, normalized
executable path, signature validity, product version, PID, parent PID, creation
time, and already-running state, with reason codes.

**New:** `desktop-compatibility.json` — schema for tested version ranges,
packaging, required marker sets, supported surfaces, and payload schema, shipped
empty with `unknown` as the default decision.

**Tests** — `tests/desktop-cdp.test.mjs`: hostile fixtures for every validator
(non-loopback host, credentials in URL, path traversal, IPv6 forms, oversized
fields, malformed frames); version allowlist rejects unknown versions; log
sanitisation drops paths, URLs, and titles; a source assertion that forbidden
CDP domains and package-mutation strings appear nowhere in production
`scripts/` and `windows/` sources.

### Item 3 — Code adapter framework

Register `code-list` and `code-session` contexts, then implement the two-phase
commit protocol from the Code plan:

1. **Discover** into a detached result object — cardinality, stable attributes,
   geometry, visibility, containment. No DOM mutation.
2. **Validate** — require the minimum role set for the current signature;
   classify optional roles independently; reject ambiguous safety-sensitive
   roles.
3. **Prepare** — build one style element and marker set off-DOM, scoped to the
   exact root marker and adapter version.
4. **Commit** — attach style then markers in one animation frame, only if
   navigation and signature are still current.
5. **Observe** — coalesce mutations, revalidate only the affected role group,
   rate-limit full discovery, never scan the document continuously.
6. **Rollback** — markers before style, disconnect observers and listeners,
   cancel scheduled work, restore prior inline values; repeating is harmless.

Budgets: no synchronous task over 8 ms, commit under 100 ms after a stable
route, one coalesced mutation pass per animation frame, no polling loop.

The signature descriptor is empty. Every entry point checks it, finds no
registered signature, and returns native. Chat-only decoration and Studio's
live-page mirror stay disabled on the route regardless.

**Tests** — `tests/code-adapter.test.mjs`, using the existing DOM stub pattern:
an empty descriptor commits nothing and leaves the DOM untouched; a fixture
signature commits all-or-nothing; a duplicate safety-sensitive role rolls the
whole adapter back; route change mid-commit aborts cleanly; rollback is
idempotent; artwork, greeting, and prompt widgets never attach.

### Item 4 — spike runbook

`docs/handoff/P0_SPIKE_RUNBOOK.md`, under 200 lines: a checklist per spike
(Code plan spikes 1–4, Desktop Gates A–C) with the exact commands or steps, the
evidence to record, the privacy rules for that evidence, and a go/no-go record
template naming the decision, date, tested versions, and doc review date.
Register it in `docs/FILE_MANIFEST.md` and `tests/support/context.mjs`.

---

## 4. PENDING-LIVE protocol

Anything needing the live site, a real Claude Code or Desktop install, or a
human capture is recorded, not attempted:

```
PENDING-LIVE: <what> — <why it cannot be verified offline> — <who closes it>
```

These are expected outcomes. Official terminal-theme token names, the real
`claude.ai/code` role structure, Desktop CDP availability, the verified version
range, `/theme` selection behaviour, and every checkpoint capture will all land
here. A report with a well-formed PENDING-LIVE list is complete work.

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
