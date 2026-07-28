# Aura Code stylization readiness plan

**Status:** planning only; no implementation is authorized by this document  
**Research reviewed:** 2026-07-28  
**Target:** release-blocking WO-27 / HUMAN CHECKPOINT CODE

## Decision summary

Aura can deliver a credible Claude Code experience without patching a native
application or rebuilding a coding client. The successful path is a two-part,
official-surface integration:

1. style the real `claude.ai/code` session list and active Remote Control view
   through a new, fail-open Aura renderer adapter; and
2. export the same Aura palette as Claude Code's supported custom-theme JSON
   for users working directly in the terminal.

The primary blockage is no longer the absence of an official local-to-web
bridge or terminal theme format. Current Claude Code documentation now provides
both Remote Control server modes and custom themes. The remaining blockers are
Aura-owned discovery, lifecycle, security, UX, projection, and live acceptance
work. Aura must not claim that ordinary web chat gained local authority, that a
pinned project is connected, or that native Claude Desktop was themed.

## What is preventing delivery today

| Blocker | Why it blocks release | Preparation that removes it |
| --- | --- | --- |
| No Code route adapter | Aura recognizes new-chat and conversation contexts, but has no closed role map for the session list, transcript, tools, diffs, permissions, composer, connection states, or Code navigation. Broad selectors would be fragile and could alter safety UI. | Capture the current live semantic/ARIA structure, define a versioned `code` capability adapter, and require unique role discovery with native fallback on zero or multiple matches. |
| No local-engine controller | The repository has no consent flow, executable capability probe, process ownership model, or exact-process stop/reconnect behavior. Starting a hidden process now would be misleading and unsafe. | Add a host-only controller behind explicit consent. Probe rather than assume CLI version, login eligibility, endpoint policy, Remote Control support, and Git availability before offering actions. |
| Outdated concurrency assumption | The existing acceptance text allows either worktree isolation or one process per session, but current Remote Control server mode supports `--spawn worktree`, `--spawn session`, and bounded `--capacity`. Starting many unmanaged processes is no longer the best default. | Spike official server mode first. Prefer one visible, Aura-owned server with `--spawn worktree` for Git repositories and conservative capacity; use `--spawn session` only for a single-session fallback. Never use shared `same-dir` for concurrent editing. |
| No safe project registry | Aura has no schema for user-approved project shortcuts, no redacted diagnostics contract, and no distinction between configured, launching, connected, disconnected, and stopped. | Store only an opaque ID, user label, normalized path, selected spawn policy, and timestamps needed for lifecycle. Never store a Remote Control URL, credential, transcript, prompt, diff, tool output, or file content. Show connection state separately from the shortcut. |
| No native-gesture boundary | A web page or Studio bridge must never be able to start a process, choose a directory, reveal a path, or stop a local session. | Put folder selection and every privileged action in native host UI. Issue short-lived host action IDs from a current user gesture; expose only sanitized status DTOs to Studio and the remote page. |
| No theme projection | Aura's HSL semantic system does not yet map to Claude Code's documented custom-theme tokens, base presets, or accepted color formats. A CSS export cannot theme the CLI. | Define a deterministic semantic-to-terminal mapping and generate separate Light and Dark JSON files under an Aura-owned export/staging location. Validate token names, colors, contrast, and atomic install into `~/.claude/themes/` only after consent. |
| Upstream eligibility is variable | Remote Control depends on a current supported CLI, eligible login, the standard API endpoint, network reachability, and organization policy. Aura cannot bypass any of these. | Present a capability report with actionable official setup links. Keep **Continue without local editing** fully functional and make eligibility failure non-destructive. |
| Process and privacy truth are unspecified | Remote Control execution and filesystem access are local, but the synchronized transcript and tool activity are stored remotely. The local process must remain alive, and long outages can end it. | Write reviewed disclosure copy before implementation. Show where execution happens, what must stay running, what may be synchronized, what Aura stores, and what Stop/Forget each does. |
| Desktop and IDE handoffs are unproven | Native Desktop and VS Code are separate products with distinct session and workspace semantics. A generic launch is not proof of a safe direct handoff. | Keep Desktop as guidance-only unless an official, versioned deep-link or command passes an end-to-end spike. Treat VS Code as an optional later adapter; do not put either on the critical path. |
| Live evidence is incomplete | Static tests and fixture renders cannot prove local filesystem access, permission preservation, reconnection, responsive Code styling, or cleanup. | Complete the disposable-repository functional proof and the whole-window Light/Dark matrix already defined by HUMAN CHECKPOINT CODE. |

## Research findings that change the plan

### Remote Control is now the correct local bridge

The official Remote Control contract states that the CLI process, execution,
and filesystem access remain local while `claude.ai/code` acts as the remote
view. The client makes outbound HTTPS connections and does not open an inbound
port. The synchronized transcript, responses, and tool activity are stored by
the service, so Aura's privacy copy must not imply that all coding-session data
stays on-device.

Current server mode exposes the controls Aura needs for a bounded first
implementation: named sessions, `--spawn worktree`, `--spawn session`,
`--capacity`, optional initial-session creation, sandbox flags, and explicit
resume options. It also documents reconnection and failure limits. This makes a
CLI-first bridge feasible without inventing a protocol.

Source: [Remote Control documentation](https://code.claude.com/docs/en/remote-control.md).

### Terminal stylization has a supported format

Claude Code v2.1.118 or later supports custom JSON themes in
`~/.claude/themes/`. A theme has a display name, a documented Light or Dark
base, and token overrides; invalid values are ignored, and existing theme files
are watched for changes. This replaces the earlier uncertainty around a
terminal-theme export and gives Aura a stable, bounded color-only projection.
It does not permit Aura artwork, layout, typography, blur, or arbitrary CSS in
the terminal.

Source: [terminal configuration and custom themes](https://code.claude.com/docs/en/terminal-config.md#create-a-custom-theme).

### Native Desktop is complementary, not the implementation substrate

Current Desktop documentation describes a full coding workspace with parallel
sessions, Git isolation, terminal/editor surfaces, and visual diff review.
Those capabilities make Desktop an appropriate explicit destination, but not a
surface Aura can safely restyle. Aura should retain the current unchanged-app
boundary and require a separate spike before claiming any direct session
handoff.

Source: [Desktop application documentation](https://code.claude.com/docs/en/desktop.md).

### VS Code remains optional

The VS Code extension can start Remote Control and can switch to terminal mode,
but its bundled CLI is not placed on the user's `PATH`; standalone terminal use
requires a separate CLI installation. The extension and CLI also have distinct
UI and capability boundaries. Aura should not require VS Code and should not
infer CLI readiness from extension installation.

Source: [VS Code integration documentation](https://code.claude.com/docs/en/vs-code.md).

## Proposed product experience

### First Code activation

Use one quiet, single-page choice instead of a wizard stack:

1. **Use local projects in Aura** — recommended; explains that an official
   local CLI process powers the session and opens capability setup.
2. **Connect to an existing session** — navigates to the real Code session list
   without claiming process ownership or requesting a path.
3. **Open the full Desktop workspace** — opens the unchanged native product or,
   until a direct-handoff gate passes, current official guidance.
4. **Continue without local editing** — opens Code/cloud-capable surfaces with
   no local process, folder, or setting change.
5. **Back** — returns to Chat without side effects.

The page should show a short benefits/limits summary with one expandable
privacy section. No filesystem chooser, process launch, config mutation, or
auto-connect may occur until the user selects the local option and confirms a
project.

### Local setup and steady state

- Run a native capability probe and show one result at a time: CLI found,
  minimum version met, login/endpoint eligible, Git repository detected, and
  Remote Control launch succeeded.
- Let the user choose a folder through the native picker and give it a
  non-sensitive display label. Keep the exact path only in host-owned config
  and never send it to page JavaScript.
- For a Git repository, default to server mode with worktree spawning and a
  small capacity. Explain that concurrent sessions are isolated. For a
  non-Git folder, offer a single-session process; do not silently downgrade to
  concurrent shared-directory editing.
- Show explicit states: **Not running**, **Starting**, **Available**,
  **Connected**, **Reconnecting**, **Needs attention**, and **Stopped**.
- Always provide **Open console** for truthful process visibility and **Stop**
  for the exact Aura-owned process tree. **Forget project** removes only the
  Aura shortcut and asks separately whether to stop an owned running process.
- Keep setup, privacy, saved projects, engine status, terminal-theme export,
  and Original look recovery available from Settings.

### Visual direction

- Reuse existing semantic tokens and permanent theme identities; do not create
  a second Code-only theme system.
- Style only discovered roles for navigation, session cards, transcript,
  tool/result blocks, diffs, composer, status, focus, and permission surfaces.
- Exclude chat-only artwork, greeting replacement, portrait layers, and prompt
  widgets from Code routes. Code should feel calmer and denser than chat while
  keeping the same palette, radius, typography hierarchy, and material family.
- Preserve literal status wording, icons, permission semantics, ordering, and
  interaction. Styling may clarify hierarchy but never mute warnings or make a
  permission choice look preselected.
- At narrow widths, remove decoration before reducing information density.
  Retain one primary action per state and move secondary actions into an
  accessible overflow menu.
- On discovery failure, render the untouched native surface. A partially
  themed safety or permission dialog is worse than no theme.

## Solution iteration and technical preparation

### Critical review of the proposed solution

The first version of this plan established the right boundaries but left too
many operational choices implicit. The following criticisms tighten the design
before implementation:

1. **A managed server is not automatically safer than one process per
   session.** It reduces process sprawl, but it also enlarges the failure domain:
   one crash, credential failure, or mistaken Stop can affect every child
   session. Therefore `managed-server-worktree` is a hypothesis, not the default
   merely because the CLI supports it. The spike must compare blast radius,
   recovery, per-session attribution, and user comprehension against explicit
   single-session processes.
2. **A path cannot be both host-only and remotely useful without careful
   wording.** The local CLI necessarily receives the selected path and may show
   filenames in the synchronized transcript. Aura can keep paths out of its own
   page bridge, config diagnostics, and captures, but it cannot promise that the
   coding service never receives path-related context. Consent copy must explain
   that distinction instead of using the vague phrase “stays local.”
3. **A current native gesture is necessary but insufficient authorization.** A
   click can be replayed, raced, or applied after the visible state changes.
   Privileged actions also need a one-shot nonce, short expiry, expected route,
   expected project revision, and exact action type. The host must consume the
   authorization before starting work.
4. **DOM role discovery cannot become a permanent compatibility claim.** Even
   semantic and ARIA structure can change. Each adapter needs a tested signature
   version and a kill switch. Unknown signatures must stay native, and support
   diagnostics should report only the adapter result—not DOM text or HTML.
5. **Terminal export is not visual parity.** The supported format is a bounded
   color projection. Marketing and UI copy must say “matching colors,” not
   “the same theme,” because artwork, typography, geometry, effects, and layout
   cannot transfer.
6. **Auto-installing exports creates avoidable ownership ambiguity.** A safer
   v1 is preview → validate → explicit Install. Aura should never select a theme
   in a running CLI on the user's behalf. The user confirms it through
   `/theme`, which also proves the official client accepted the file.
7. **A visible console alone does not prove truthful ownership.** Aura needs the
   OS process handle, creation time, launch nonce, and job/process-tree boundary.
   Window title, command line, PID, or executable name alone can all match an
   unrelated process.
8. **Thirty-two theme captures can reward breadth over correctness.** Before
   the full visual matrix, one representative Light and Dark theme must pass the
   complete permission, failure, reconnection, cleanup, and responsive matrix.
   Only then should visual parity fan out across all themes.

These changes deliberately reduce ambition where a polished interface could
otherwise disguise an unproven capability. The release should prefer a clear
existing-session flow over a fragile managed engine.

### Proven repository methods to reuse

“Proven” here means already implemented and exercised in Aura, not merely a
familiar industry pattern. WO-27 should extend these contracts instead of
introducing parallel infrastructure:

| Existing method | Current evidence | WO-27 reuse |
| --- | --- | --- |
| Atomic temporary-file replacement | `scripts/theme-core/studio.mjs` writes randomized temporary files and promotes them; registry and asset tooling use the same family of pattern. | Use same-directory temporary files, flush/close, replace, and cleanup for project metadata and terminal exports. Test interruption before and after promotion. |
| Revision-bound commands | Studio editor and Prompt Shelf requests carry session/revision values and reject stale mutations. | Every project mutation and privileged setup response carries `schemaVersion`, `projectRevision`, and `requestId`; stale UI cannot stop or replace a newer engine. |
| Exact bridge allowlists | `windows/aura-ui.ps1` maps each message type to an exact property set and rejects unsupported shapes. | Define separate read-only status and native-action envelopes. Reject unknown fields, type coercion, oversized strings, duplicated request IDs, and page-origin paths. |
| Navigation-correlated lifecycle | The Windows host correlates navigation IDs and ignores stale document completions. | Bind Code adapter activation and gesture grants to the current top-level navigation ID and allowed `https://claude.ai/code` route. Revoke them on redirect, reload, route exit, or rescue mode. |
| Fail-open renderer cleanup | Existing theme, greeting, artwork, and rescue paths restore native presentation when discovery or decoding fails. | Code probes commit styling only after the complete minimum role set validates. Cleanup is idempotent and runs on any partial failure. |
| Transaction markers and recovery | Built-in authoring records transaction identity and can recover or roll back incomplete work. | Record only non-sensitive launch intent and the config transaction. Do not persist runtime secrets. On restart, reconcile to **Disconnected** rather than assuming a process survived. |
| Content/ownership boundaries | Release and asset checks distinguish owned files and refuse unsafe paths or collisions. | Terminal exports use deterministic content plus a separate Aura-owned manifest; uninstall removes a file only when its current digest matches the owned digest. |
| Status-only audits | Asset QA reports validity without manufacturing acceptance imagery. | Code diagnostics report capability category, adapter signature, and state transition counts without transcript, DOM, URL, path, command output, or account data. |

Reuse still requires new tests. Existing atomic writes do not prove safe writes
into another tool's configuration directory, and existing bridge validation
does not prove that a live remote page cannot trigger local execution.

### Operational contract

#### Engine state machine

The host is the sole authority for engine state. UI labels are projections of
these states and cannot advance them optimistically:

| State | Enter only when | Allowed user actions | Required exit behavior |
| --- | --- | --- | --- |
| `unconfigured` | no consent decision exists | Learn more, use local, existing session, no local, Back | no file or process change |
| `probing` | one-shot native setup grant is consumed | Cancel | cancel probe; persist no partial capability result |
| `unavailable` | probe returns a categorized failure | Retry, open official guidance, continue without local | retain no process claim |
| `ready` | capability and selected-project validation pass | Start, change project, export colors | invalidate readiness when CLI/path/config revision changes |
| `starting` | exact argument vector is finalized and launch intent is registered | Cancel | terminate only the just-created owned process; remove launch intent |
| `available` | owned process handle is live and Remote Control readiness is proven | Open Code list, open console, Stop | never imply that a browser client is attached |
| `connected` | official surface independently shows the chosen session online | Open session, open console, Stop | downgrade on observed disconnect without killing the process |
| `reconnecting` | owned process remains live but remote readiness is temporarily lost | Open console, Stop, Wait | time out to `needs-attention`; do not loop forever |
| `needs-attention` | process error, policy/login change, timeout, or ambiguous ownership occurs | Diagnose, Stop if still owned, Forget | raw details remain console-only |
| `stopping` | Stop consumed a current action grant | none except force-close console | bounded graceful stop, then owned-tree termination if user confirmed |
| `stopped` | owned handle exited and children are accounted for | Restart, Forget | clear ephemeral identifiers and readiness |
| `disconnected` | Aura restarted or cannot prove ownership | Reconnect as existing, start new, Forget | never Stop an unowned matching process |

Every transition records only monotonic time, previous/next state, sanitized
reason code, project opaque ID, and adapter version in a fixed-size in-memory
ring buffer. No persistent operational log is required for v1. A user may copy
a redacted capability report that contains versions and reason codes but no
path, hostname, URL, account, session title, or process output.

#### Process launch and stop protocol

1. Canonicalize the native-picker result, reject device roots and unsupported
   path kinds, open a directory handle, and verify the chosen directory has not
   been swapped before launch. Do not accept a page-provided path.
2. Construct an argument array from a closed policy. Set the working directory
   through the process API rather than a `cd` shell fragment. Give the session a
   neutral user-editable label; never derive a default from hostname or path.
3. Create a launch nonce and pending record, start the process without shell
   interpretation, retain its process handle and creation time, then attach the
   process tree to an Aura-owned Windows Job Object where CLI behavior permits.
4. Treat stdout/stderr as console data, not a control protocol. Determine
   readiness through a documented machine-readable signal if one is discovered;
   otherwise require official session-list observation or a bounded user
   confirmation. Never scrape a session URL into Aura storage.
5. On Stop, revalidate action nonce, project revision, process handle, creation
   time, and ownership boundary. Request graceful exit, wait a bounded interval,
   then offer—not silently perform—owned-tree termination.
6. Close every handle and erase ephemeral action/launch identifiers on exit.
   Stop is idempotent: repeating it returns the final state without targeting a
   newly reused PID.

If a Job Object prevents expected CLI child behavior or detachment, the spike
must reject managed-background mode. The fallback is a foreground console whose
closure semantics remain owned by the user.

#### Gesture authorization envelope

The native host creates, displays, and consumes this conceptual envelope; the
page never chooses its privileged fields:

```text
version, action, oneShotNonce, issuedMonotonic, expiresMonotonic,
navigationId, projectOpaqueId, projectRevision, expectedVisibleState
```

- expiry target: 10 seconds, shortened if usability testing shows no need for
  the full window;
- one action per nonce, consumed before asynchronous work begins;
- constant-time nonce comparison and a bounded replay cache;
- cancellation on navigation, Studio close, modal replacement, project change,
  or application deactivation before consumption; and
- no wildcard action, route, project, or revision.

#### Project registry and privacy contract

Persist only:

```text
schemaVersion, opaqueId, userLabel, normalizedPath, spawnPolicy,
createdAt, updatedAt, projectRevision
```

The exact path is necessary for a saved local shortcut, but remains native-host
data. Encrypting it would not protect it from software running as the same user,
so the plan should not market local encryption as a security boundary. Instead,
use per-user ACLs, exclude the registry from logs/exports, never return the path
through WebView messaging, and provide explicit removal. Labels are length-
bounded plain text and never interpreted as markup, arguments, or filenames.

Forget is a transaction: remove the shortcut atomically, keep the engine state
separate, and ask whether an exactly owned live process should also stop. A
failed config write must not stop the process; a failed stop must not delete the
only recovery shortcut until the user confirms that tradeoff.

#### Code adapter commit protocol

Use a two-phase renderer update so users never see a half-themed permission
surface:

1. **Discover:** in a detached result object, locate roles and record cardinality,
   stable attributes, geometry, visibility, and containment. Do not mutate DOM.
2. **Validate:** require the minimum role set for the current route signature;
   independently classify optional roles. Reject ambiguous safety-sensitive
   roles.
3. **Prepare:** create one style element and marker set off-DOM. Scope every rule
   to the exact root marker and adapter version.
4. **Commit:** attach the style, then markers, in one animation frame only if the
   navigation and signature are still current.
5. **Observe:** coalesce mutations, revalidate only the affected role group, and
   rate-limit full discovery. Never continuously scan the document.
6. **Rollback:** remove marker attributes before the style element, disconnect
   observers/listeners, cancel scheduled work, and restore any exact prior inline
   values. Repeated rollback must be harmless.

The minimum set should exclude optional decoration but include navigation,
primary transcript, composer, and any visible permission/dialog root. If a
permission surface cannot be uniquely classified, roll back the entire Code
adapter rather than leaving the rest styled.

### Tested-method ladder

Each risk advances through the same evidence ladder; skipping a rung requires a
written reason and reviewer approval:

1. **Pure contract test:** parsers, schemas, allowlists, state transitions,
   color mapping, and redaction with no OS or DOM dependency.
2. **Deterministic fake test:** controllable clocks, process handles, PID reuse,
   navigation changes, duplicate messages, DOM remounts, and write failures.
3. **Disposable integration test:** real temporary directories, real child
   processes that contain no account access, atomic writes, ACLs, Job Object
   behavior, crash/restart, and uninstall ownership.
4. **Official-client feasibility run:** current CLI and live Code surface in a
   sentinel repository, with versions and doc review date recorded.
5. **Installed-package run:** exact packaged scripts/assets, normal user
   permissions, upgrade/repair/uninstall boundaries, and WebView2 host.
6. **Human acceptance:** responsive visual polish, comprehension, keyboard and
   assistive settings, permission meaning, privacy copy, and Original look.

A method is “tested” only for the rung it passed. For example, a fake PID-reuse
test does not prove Windows process ownership, and a successful live edit does
not prove the absence of forbidden persisted fields.

#### Fault-injection matrix

At minimum, automate or deliberately exercise these failures:

| Boundary | Injected fault | Expected invariant |
| --- | --- | --- |
| capability | missing/old CLI, unsupported flag, ineligible login, endpoint policy | no process claim; no config corruption; no-local path remains usable |
| gesture | expired/replayed nonce, stale navigation, changed project revision | privileged operation rejected before side effects |
| launch | executable disappears, path swapped, process exits immediately | pending record cleared; no unrelated process targeted |
| runtime | child exits, network loss, sleep/resume, >10-minute outage | truthful state; bounded reconnect; console remains available while owned |
| concurrency | two sessions edit same sentinel, worktree creation fails | no silent `same-dir` downgrade; user chooses single-session fallback |
| persistence | disk full, access denied, crash before/after rename | old or new complete document; never truncated JSON |
| export | foreign filename collision, malformed owned file, live reload absent | refuse overwrite; preserve foreign data; show manual `/theme` recovery |
| renderer | missing/duplicate role, route changes mid-commit, SPA remount | no partial theme; native interaction and navigation remain usable |
| safety UI | permission dialog appears during revalidation | complete validated styling or complete native fallback, never mixed semantics |
| shutdown | Stop repeated, PID reused, child resists exit, Aura crashes | only exact owned handles affected; restart becomes disconnected |
| privacy | hostile label, URL in output, path in error, oversized transcript | output never enters bridge/config/diagnostic report |

#### Smooth-operation budgets

Set measurable budgets before UI polish so “smooth” has an operational meaning:

- Code route discovery: no synchronous task over 8 ms on the UI thread and no
  full-document polling loop;
- theme commit after a stable route: target under 100 ms, with native content
  visible rather than a blocking veil if exceeded;
- mutation processing: one coalesced pass per animation frame, with a bounded
  node count and backoff to native fallback under churn;
- host status propagation: deduplicated state changes only, never fixed-rate
  WebView polling;
- capability probe: independently timed steps, cancellable, with progress after
  500 ms and a categorized timeout rather than an infinite spinner;
- graceful Stop: bounded wait followed by an explicit escalation choice;
- persistent state: small, schema-bounded records and fixed-size diagnostics;
  and
- accessibility: no status conveyed by color alone, no focus theft on
  background transitions, and announcements only on meaningful state changes.

Budgets become warning thresholds in development telemetry, not permanent user
tracking. Production v1 retains no analytics.

### Phase 0 — freeze contracts before code

1. Record tested CLI and `claude.ai/code` versions plus the official-doc review
   date.
2. Capture a privacy-safe DOM/ARIA inventory for the Code list and one
   disposable active session across idle, running, permission, diff, error,
   disconnected, and completed states.
3. Define the host/page trust boundary and a threat model covering forged
   bridge messages, path disclosure, URL leakage, stale PIDs, PID reuse,
   symlink/junction paths, inherited handles, process-tree termination, and
   malicious project labels.
4. Approve localized consent, privacy, limitation, and recovery copy in
   English, Simplified Chinese, and Traditional Chinese.
5. Lock a minimum supported CLI version based on the features actually used,
   not merely custom-theme support.

**Exit gate:** reviewed role inventory, threat model, DTO schemas, copy, and
minimum-version decision; no runtime implementation begins before this gate.

### Phase 1 — feasibility spikes

Run four disposable, throwaway spikes that produce findings rather than
shipping code:

1. **Remote server spike:** start server mode with `--spawn worktree`, bounded
   capacity, a sanitized fixed prefix, and no initial session if supported;
   prove list discovery, one approved edit, interruption, rejection, process
   exit, reconnect, and two isolated sessions.
2. **Process ownership spike:** prove retained process identity, child-tree
   enumeration, console visibility, stop semantics, stale-handle/PID-reuse
   defense, and clean Aura restart recovery under normal user permissions.
3. **Desktop handoff spike:** look only for a current documented direct route.
   If the route cannot prove the selected project/session and safe fallback,
   formally select `desktop-guidance-only`.
4. **Terminal-theme spike:** generate one built-in and one user theme, install
   atomically without overwriting a foreign file, select through `/theme`, and
   verify Light/Dark, forced-color-friendly fallbacks, and live reload.

**Exit gate:** adopt `managed-server-worktree` only if spikes 1 and 2 pass;
otherwise reduce v1 to user-started/existing sessions. Desktop is independently
`desktop-direct` or `desktop-guidance-only`. VS Code remains out of scope unless
its own later spike passes.

### Phase 2 — host-owned local bridge

1. Add a versioned config section for onboarding choice, project shortcuts,
   engine policy, and terminal exports. Keep runtime credentials, URLs, PIDs,
   and transcripts out of persistent config.
2. Implement a strict command builder with an argument array, never a shell
   string. Allow only known flags and bounded values.
3. Add capability probes and sanitized error categories. Raw CLI output stays
   in the user-visible console and is not copied into Aura diagnostics.
4. Add an in-memory process registry keyed by an unguessable Aura action ID,
   backed by OS process handles and creation time rather than PID alone.
5. Expose a narrow bridge: request native picker, launch approved project,
   open console, stop owned process, forget shortcut, and read sanitized state.
   Reject commands without a current native gesture and reject all page-origin
   path/argument input.
6. Implement restart reconciliation that marks shortcuts disconnected; never
   infer ownership of an arbitrary matching process.

### Phase 3 — Code renderer adapter

1. Register `code-list` and `code-session` contexts beside existing chat
   contexts without changing theme schema.
2. Build role probes in priority order: semantic element, ARIA role/state,
   stable data attribute, then narrowly tested structural relationship. Never
   bind a generated utility class as the only identity.
3. Require uniqueness and geometry validation for safety-sensitive roles.
4. Apply Code-only markers and a bounded stylesheet derived from the current
   theme payload. Keep all observers route-scoped and idempotent.
5. Disable Studio live-page capture and every chat-only decoration on Code
   routes.
6. On navigation, Original look, ambiguous discovery, or injection failure,
   remove every Code marker, style, observer, and listener before returning to
   native presentation.

### Phase 4 — terminal theme projection

Map Aura semantics to documented terminal tokens rather than attempting visual
parity:

| Aura semantic | Terminal intent |
| --- | --- |
| primary accent | `claude` |
| primary / secondary / muted text | `text`, `inactive`, `subtle` |
| focus / selection | `suggestion`, `permission` |
| success / destructive / warning | `success`, `error`, `warning` |
| composer / user message | input-mode borders and `userMessageBackground` where documented |
| diff additions / removals | `diffAdded`, `diffRemoved` |

Generate separate `Claude Aura — <theme> Light` and Dark files with matching
documented bases. Derive only allowlisted colors, clamp contrast against the
base, and omit unsupported artwork, font, blur, shadow, radius, and layout
properties. Use deterministic slugs and an Aura ownership marker outside the
official JSON if the schema has no metadata field. Back up and refuse to
overwrite any non-owned collision. Removal deletes only exact owned exports.

### Phase 5 — polished UX and recovery

1. Build the consent/setup surface and Settings recovery panel using the
   existing Studio design system.
2. Keep each state to one clear headline, one sentence, one primary action,
   and optional details. Avoid terminal jargon until diagnostics are expanded.
3. Add keyboard order, visible focus, screen-reader status announcements,
   reduced motion, increased contrast, and forced-colors behavior.
4. Verify normal new-tab/extension-like sizes, 1280×720, 1440×900, wide
   desktop, and the selected high-DPI equivalent.
5. Provide safe recovery for missing CLI, old CLI, ineligible login, blocked
   endpoint, non-Git concurrency, process exit, network timeout, missing Code
   structure, corrupt Aura config, and export collision.

## Test and acceptance plan

### Automated gates

- Unit-test config migration, path normalization, label sanitization, argument
  construction, version parsing, capability results, state transitions, and
  redaction.
- Use fake processes to test exact-handle ownership, child tracking, launch
  failure, stale PID, timeout, stop/forget choices, and restart reconciliation.
- Test that page/Studio messages cannot supply paths, flags, commands, URLs, or
  process identifiers and cannot invoke privileged verbs without a gesture.
- Fixture-test every Code role independently, then test missing, duplicate,
  disconnected, remounted, and route-transition cases for fail-open cleanup.
- Snapshot every terminal export and validate its JSON, documented bases,
  token allowlist, contrast, deterministic names, ownership, collision, atomic
  write, and exact removal behavior.
- Extend the release collector and installed-source parity checks so the Code
  adapter and localized copy cannot drift between source and package.

### Manual release gate

Use only a newly created repository with non-sensitive sentinel files. Prove:

- first-click no-local and local-consent paths with zero pre-consent changes;
- the official session list and active local session inside installed Aura;
- one bounded read/write, one interrupt, and one rejected permission request;
- before/after file hashes and isolated concurrent worktrees;
- visible process lifecycle, close/keep/stop choices, disconnect, restart, and
  reconnect;
- all eight built-ins in Light and Dark on both Code list and active session;
- keyboard, focus, narrow/wide, DPI, forced colors, increased contrast, and
  reduced motion;
- Chat → Code list → session → Chat cleanup and complete Original look removal;
- one built-in and one user terminal theme selected through `/theme`; and
- unchanged native Desktop behavior plus the chosen direct-or-guidance
  contract.

Follow the privacy and capture rules already specified in
`docs/SCREENSHOT_PLAN.md`: no account identity, hostname, exact path, session
URL, credential, or real project material may enter evidence.

## Scope controls

### Required for v1

- consent-based local/no-local entry;
- official Remote Control capability probe and launch/attach flow;
- truthful project and process lifecycle;
- fail-open Code list/session theme adapter;
- all-theme Light/Dark responsive and accessibility coverage;
- supported terminal custom-theme export;
- Settings recovery, localization, privacy disclosure, and Original look; and
- HUMAN CHECKPOINT CODE approval.

### Explicitly deferred unless separately proven

- styling or patching native Desktop;
- a reconstructed Code client or private Remote Control protocol;
- VS Code theme or session handoff;
- Agent View-specific controls;
- background/minimized process management beyond a user-visible console;
- Code-specific artwork, layout editing, greetings, prompt widgets, or schema
  expansion; and
- automatic project discovery, automatic process launch, or account-based sync.

## Recommended execution order

1. Complete HUMAN CHECKPOINT D so existing Studio and identity uncertainty does
   not contaminate Code diagnosis.
2. Execute Phase 0 and approve the trust/copy contracts.
3. Run the four Phase 1 spikes and publish explicit go/no-go decisions.
4. Implement the host bridge and tests before any renderer styling.
5. Implement the fail-open Code adapter and terminal projection independently.
6. Add the polished onboarding and Settings surfaces after engine states are
   real, so UI copy cannot get ahead of capability.
7. Run automated package parity, then HUMAN CHECKPOINT CODE on the installed
   build.
8. Begin tutorial and final release work only after that checkpoint passes.

This order prepares Aura for Claude Code stylization while preserving its core
promise: the real interface, local and reversible presentation, explicit user
control, and native fallback whenever Aura cannot prove a safe integration.
