# P0 live-spike runbook

Run these checks only on real Windows hardware with stock, signed applications
and explicit user consent. Use a disposable Git repository containing only
non-sensitive sentinel files. Until Desktop Gates A–C all pass, the supported
result is: **Claude Desktop opens unchanged and unthemed.**

Review the current [Remote Control documentation](https://code.claude.com/docs/en/remote-control)
and [terminal-theme documentation](https://code.claude.com/docs/en/terminal-config)
before starting. This runbook was reviewed against both on 2026-07-29.
The Desktop, Remote Control, and
[Desktop deep-link](https://support.claude.com/en/articles/14729294-open-claude-desktop-with-a-link)
contracts were rechecked on 2026-07-30. The documented Code deep link starts a
new Desktop session; no existing-session handoff or Desktop-to-Aura return
contract was documented, so `desktop-guidance-only` remains selected.

The historical Aura Code popup diagnostic is now source-only and its live
WebView path is hard-disabled. `-ClassifyOnly` remains available for the bounded
URI-policy regression; do not rerun the retired live diagnostic.

## Evidence and privacy rules

- Record tested versions, packaging, OS version, document review date, reason
  codes, pass/fail booleans, and non-sensitive sentinel-file hashes.
- Human captures must follow `docs/SCREENSHOT_PLAN.md`. Capture only the real
  app, remove account and user content, and never create fixture UI evidence.
- Never retain ports, PIDs, browser/target IDs, session URLs, credentials,
  titles, transcripts, prompts, diffs, tool output, exact project paths,
  hostnames, account identity, DOM text, HTML, or full URLs.
- Process identity and endpoint values may be viewed transiently during a run.
  Do not paste them into the record, commit them, or include them in captures.
- Never read, extract, hash, or modify Desktop package contents or `app.asar`.
  Do not commit application binaries or user data.
- If a step cannot be completed, record
  `PENDING-LIVE: <what> — <why> — <owner>` and make no substitute claim.

## Code spike 1 — Remote server

Status for the current build: **no-go; attempts exhausted**. The checklist is
retained as the acceptance contract only. Do not rerun it unless the stated
unblock condition changes and the user authorizes a fresh attempt. V1 selects
`one-process-per-session`.

- [ ] Record `claude --version`; confirm eligible claude.ai login, standard API
  endpoint, organization policy, and workspace trust.
- [ ] In the disposable Git repository, run:

  ```powershell
  claude remote-control --spawn worktree --capacity 2 --no-create-session-in-dir --remote-control-session-name-prefix aura-spike
  ```

- [ ] Open `https://claude.ai/code` manually; confirm list discovery without
  copying the generated session URL.
- [ ] Start two on-demand sessions. Confirm they use distinct worktrees without
  recording either path and never fall back to shared `same-dir`.
- [ ] Approve one bounded sentinel edit, reject one permission request, interrupt
  one turn, disconnect/reconnect once, and verify both sessions remain isolated.
- [ ] End the server with Ctrl+C; confirm both sessions become unavailable and
  no child process remains.
- Evidence: CLI version, command flags, two-session isolation boolean, approved /
  rejected / interrupted / reconnected booleans, sentinel hashes, exit result.
- Go only if every proof passes with no shared-directory downgrade or sensitive
  evidence. Otherwise select user-started/existing sessions for v1.

## Code spike 2 — Process ownership

Status for the current build: **no-go for managed ownership**. The automatic
launch attempts did not establish an exact retained process boundary. V1
selects `manual-launch-only`; do not repeat the exhausted launcher route.

- [ ] Start the spike-1 server in a visible console under normal user
  permissions.
- [ ] Inspect its process and children transiently:

  ```powershell
  Get-CimInstance Win32_Process -Filter "Name = 'claude.exe'" |
    Select-Object ProcessId,ParentProcessId,CreationDate,ExecutablePath
  ```

- [ ] Bind ownership to the executable identity, creation time, retained OS
  process handle, and child tree; name/PID/command line alone must not pass.
- [ ] Confirm the console stays visible and normal Ctrl+C accounts for the full
  owned tree.
- [ ] Exercise stale-handle/PID-reuse defense with a benign replacement process.
  A stale identity must refuse Stop and must not affect the replacement.
- [ ] Restart Aura while the server remains alive. Recovery must be
  `disconnected`, never assumed ownership; no arbitrary matching process may be
  stopped.
- Evidence: identity-factor booleans, child count only, visible-console boolean,
  normal/repeated Stop results, stale-identity refusal, restart state.
- Go with spike 1 only if all ownership proofs pass. Otherwise
  `managed-server-worktree` is no-go.

## Code spike 3 — Desktop handoff

Status for the current build: direct handoff is **no-go** and
`desktop-guidance-only` is selected. The signed installed Desktop package does
not supply a documented existing-session deep link or Desktop-to-Aura return
contract.

- [ ] Review current official Desktop and Remote Control documentation for an
  explicit project/session route; record links and review date.
- [ ] Test only a documented route. A generic app launch, title match, or
  unverified deep link is not evidence.
- [ ] Confirm the route binds the selected disposable project and exact session,
  and that absence/failure returns safely to the web path.
- Evidence: documented contract link, tested versions, project-bound boolean,
  session-bound boolean, fallback result.
- If any proof is absent, record `desktop-guidance-only`. Do not investigate an
  undocumented protocol.

## Code spike 4 — Terminal themes

Status: terminal-theme feasibility passed independently. Exporter
implementation and verification may continue, but cannot substitute for Aura
Code gates 3 and 4 or HUMAN CHECKPOINT CODE.

- [ ] Export one built-in and one user theme as strict Light/Dark pairs. Use
  absolute JSON paths inside an existing directory; the exporter must not
  create that directory:

  ```powershell
  node .\scripts\theme-cli.mjs export-terminal-pair default `
    --light "C:\existing\claude-aura-default-light.json" `
    --dark "C:\existing\claude-aura-default-dark.json"
  node .\scripts\theme-cli.mjs export-terminal-pair <user-id> `
    --user-themes <user-theme-root> `
    --light "C:\existing\claude-aura-<user-id>-light.json" `
    --dark "C:\existing\claude-aura-<user-id>-dark.json"
  ```

- [ ] Parse each JSON file with `Get-Content -Raw | ConvertFrom-Json`; confirm
  deterministic Light/Dark names and that each document contains only `name`,
  `base`, and `overrides`. No ownership manifest is written.
- [ ] Refuse either existing destination and prove both pre-existing files stay
  byte-identical. Simulate a second-file publication failure and prove that no
  partial pair remains.
- [ ] In Claude Code v2.1.118 or later, run `/theme` and select each installed
  Light/Dark theme. Aura must not select it automatically.
- [ ] Confirm matching colors, readable forced-colors fallback, live reload, and
  manual removal of only the four files chosen for this test. Do not claim
  artwork or layout parity.
- Evidence: CLI version, exported filenames/digests, JSON-valid booleans,
  foreign-collision hash, `/theme` acceptance, mode/accessibility/reload results.
- Go only if official selection, reload, collision refusal, and cleanup pass.

## Desktop Gate A — Runtime and launch capability

> **CURRENT BUILD: ATTEMPTS EXHAUSTED - DO NOT RERUN.**
> Both permitted stock-launch routes failed before exposing a verified
> loopback endpoint. Keep Desktop stock, keep compatibility `unknown`, and do
> not open Gates B or C unless the documented unblock condition changes and
> the user authorizes a fresh gate.

- [ ] With Desktop closed, run the read-only install/process probe:

  ```powershell
  powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\windows\desktop-capability.ps1
  ```

- [ ] Run the probe from ordinary PowerShell under the same interactive Windows
  account that owns Claude Desktop. A sandbox, service account, or another
  user's package registry is not valid install or process evidence.
- [ ] Treat schema 2 output as the only retainable capability record. It emits
  the verified package/AUMID fields, running state, and bounded process count;
  executable paths, PIDs, parent PIDs, and creation times remain internal.
- [ ] Confirm stock signature, package kind, product version, and not-running
  state. Keep executable path and process identity transient.
- [ ] After explicit consent, reserve a random loopback high port immediately
  before launching the verified executable with
  `--remote-debugging-address=127.0.0.1` and
  `--remote-debugging-port=<port>`. Make no package or config change.
- [ ] Query `/json/version` transiently, derive the browser ID from its validated
  loopback WebSocket URL, then run:

  ```powershell
  node .\scripts\desktop-probe.mjs --endpoint "http://127.0.0.1:<port>/" --browser-id "<browser-id>" --desktop-version "<version>" --packaging "<desktop|msix>"
  ```

- [ ] Bind the endpoint to the expected executable identity, signature, process,
  and creation time. Existing/single-instance ambiguity is a failure.
- [ ] Close Desktop normally; rerun the capability probe and confirm the endpoint
  disappears. Confirm later normal launch and update behavior remain unchanged.
- Evidence: sanitized probe JSON fields only, version/package, signature boolean,
  ownership-match boolean, close/endpoint-gone/normal-launch booleans.
- Gate A passes only for repeatable, consented, loopback-only attachment to the
  proven stock process with no package modification. Otherwise stop the WO-32
  Desktop styling experiment; this gate does not change WO-27's separate
  `desktop-guidance-only` handoff contract.

## Desktop Gate B — Renderer compatibility

- [ ] Run only after Gate A passes. Across sign-in, new chat, conversation,
  Settings, Projects, Artifacts, permission/file UI, and Code if available, run
  the sanitized Desktop probe and record target-type counts, origins, and marker
  booleans—never titles or content.
- [ ] Classify each target from origin plus a versioned semantic marker set as
  `themeable`, `native-or-protected`, or `unknown`; unknown is the default.
- [ ] Through an isolated CDP world, add one namespaced root attribute and a tiny
  style that changes only a diagnostic custom property. Use only Target, Page,
  Runtime, and necessary session methods.
- [ ] Prove complete removal after explicit cleanup, reload, renderer restart,
  window recreation, sleep/resume, and app update.
- [ ] Compare sanitized semantic roles with live web; do not broaden selectors.
  Confirm drag regions, menus, shortcuts, focus, screen-reader names,
  permissions, updates, and sign-in remain native and usable.
- Evidence: versioned marker matrix, classification counts, cleanup matrix,
  accessibility/permission/update booleans, sanitized reason codes.
- Gate B passes only with content-free identification, deterministic cleanup, and
  native usability after every failure. Never enable Network, Storage,
  DOMSnapshot, Fetch, or download domains.

## Desktop Gate C — Policy and distribution

- [ ] Obtain named maintainer and legal reviews of the current consumer and
  Desktop distribution terms for runtime debugging and local styling.
- [ ] Approve wording: experimental local presentation layer; not an official
  plugin or supported Claude theme system.
- [ ] Approve the security boundary, sanitized diagnostics, exact tested version
  range, recovery steps, and automatic-disable policy for unknown versions.
- Evidence: reviewer roles/names, decision dates, source links, approved wording
  revision, version range, next mandatory review date.
- Gate C passes only with explicit approval. Unresolved review is release-blocking
  even when Gates A and B pass.

## Go/no-go record

```text
Decision: <remote-server | process-ownership | desktop-handoff |
  terminal-theme | Desktop Gate A | Desktop Gate B | Desktop Gate C>
Result: <go | no-go | PENDING-LIVE>
Date:
Tester:
Windows version:
Tested application/CLI versions and packaging:
Official-document review date:
Evidence summary (sanitized):
Failed or pending checkpoints:
Required fallback:
Next review date:
Approvers:
```

### 2026-07-30 Remote server record

```text
Decision: remote-server
Result: no-go
Date: 2026-07-30
Tester: current interactive Windows user; identity intentionally not retained
Windows version: Windows 11 Home 25H2, build 26200.8875, x64
Tested application/CLI versions and packaging: signed Claude Code 2.1.218;
  Git 2.54.0.windows.1
Official-document review date: 2026-07-30
Evidence summary (sanitized): the user-started server remained alive; the first
  user-operated Brave attempt disconnected, and the second accepted a
  submission but remained stalled. The visible signed stock Desktop later
  reported that the prior disposable task's remote environment was unavailable.
  Neither attempt created a selectable disposable session or Git worktree.
Failed or pending checkpoints: two concurrent server sessions, isolated
  worktrees, reconnect, and server ownership were not proved
Required fallback: manual-launch-only plus one visible user-owned process per
  explicit session; expose no server capacity, spawn, multiplexing, or
  worktree controls
Next review date: only after the official substrate changes and the user
  authorizes a fresh materially different attempt
Approvers: user-authorized local diagnostic; HUMAN CHECKPOINT CODE remains open
```

### 2026-07-30 Process ownership record

```text
Decision: process-ownership
Result: no-go
Date: 2026-07-30
Tester: current interactive Windows user; identity intentionally not retained
Windows version: Windows 11 Home 25H2, build 26200.8875, x64
Tested application/CLI versions and packaging: signed Claude Code 2.1.218
Official-document review date: 2026-07-30
Evidence summary (sanitized): two exact visible automated launcher attempts
  exited before Aura could retain and verify a process/child boundary; the
  later successful official flow was user-started and user-owned
Failed or pending checkpoints: retained handle, creation identity, pre-resume
  Job Object assignment, restart recovery, and exact-process Stop were not
  proved
Required fallback: manual-launch-only with a visible or normally minimized
  user-owned terminal; Aura never stops a process by name or PID alone
Next review date: only after a supported exact Windows launch/ownership
  contract changes the failed condition
Approvers: user-authorized local diagnostic; managed-background not approved
```

### 2026-07-30 Desktop handoff record

```text
Decision: desktop-handoff
Result: no-go
Date: 2026-07-30
Tester: current interactive Windows user; identity intentionally not retained
Windows version: Windows 11 Home 25H2, build 26200.8875, x64
Tested application/CLI versions and packaging: Claude Desktop 1.24012.9.0,
  signed current-user MSIX; Claude Code 2.1.218
Official-document review date: 2026-07-30
Evidence summary (sanitized): installation and registered application identity
  were verified. Current documentation describes CLI /desktop continuation and
  a new-session Desktop link, but no direct existing-Remote-Control-session
  link or Desktop-to-Aura return contract was proved.
Failed or pending checkpoints: project/session-bound direct handoff and return
  to Aura
Required fallback: desktop-guidance-only; open current official guidance,
  synthesize no deep link, and keep Desktop native and unthemed
Next review date: when official Desktop handoff documentation materially
  changes
Approvers: user-authorized documentation and local capability review; no
  direct-handoff approval
```

### 2026-07-30 Desktop Gate A record

```text
Decision: Desktop Gate A
Result: no-go
Date: 2026-07-30
Tester: current interactive Windows user; identity intentionally not retained
Windows version: Windows 11 Home 25H2, build 26200.8875, x64
Tested application/CLI versions and packaging: Claude Desktop 1.24012.9.0, MSIX
Official-document review date: 2026-07-30
Evidence summary (sanitized): signed stock identity and normal Exit passed;
  registered-application and exact-executable launches both exited before a
  verified loopback listener existed; no probe attached and no style applied.
  The current source-only controller and profile CLI are hard-disabled by this
  no-go and excluded from public archives and repo/dev installs.
Failed or pending checkpoints: Desktop Gates B and C not opened
Required fallback: normal stock launch; compatibility remains unknown
Next review date: only after a supported or independently verified launch
  contract changes the Gate A condition
Approvers: user-authorized local diagnostic; no maintainer/legal release review
```

## HUMAN CHECKPOINT CODE evidence ledger

Status: **USER ACCEPTANCE PENDING**

This ledger separates mechanical evidence, preliminary runtime observations,
installed-Aura evidence, and user approval. A preliminary diagnostic or
outside-Aura result never completes a checkpoint row. No retained record below
contains an account identity, session identifier, Remote Control URL, exact
project path, prompt, transcript, diff, file content, process output, or
terminal screenshot.

| Row | Requirement | Safely available evidence | Installed-Aura evidence still required | User approval |
| ---: | --- | --- | --- | --- |
| 1 | First-click Aura Local / existing session / Desktop / no-local / Back; Settings reopen/change/forget; no pre-consent side effect | Contract and mechanical scaffolding only; product activation remains disabled while substrate gates 3 and 4 are open. | Complete all choices, restart persistence, invalid-state fallback, and Settings recovery in the installed product. | **PENDING** |
| 2 | Visible CLI-first setup and selection of a local Remote Control session inside Aura | A user-started official session previously appeared in Claude's web list; the same-window host diagnostic selected an existing session. Neither is installed-product evidence. | Start one visible user-owned `claude --remote-control` process for the disposable repository and select it in installed Aura. | **PENDING** |
| 3 | Sentinel read and one bounded approved write from Aura | The bounded edit passed outside Aura: one tracked file, one added line, no deletion, exact marker count, and independent before/after hashes. Aura-owned canary scans were clean. | Repeat the fixed bounded request from installed Aura Code View and verify only hashes and exact-change booleans outside Aura. | **PENDING** |
| 4 | Interrupt one turn and reject one permission request | Native device re-verification stayed visible and user-operated in the route diagnostic. Interruption, normal embedded permission approval, and rejection are unproved. | Exercise native trust/permission, interruption, rejection, eligibility, policy, and error behavior in the disposable installed-Aura session. | **PENDING** |
| 5 | Named concurrency contract | `one-process-per-session` is selected after two server/worktree attempts produced no selectable session or worktree. No server capacity or worktree controls may ship. | Prove two explicit sessions, each backed by its own visible user-owned process, and verify Aura presents no server multiplexing controls. | **PENDING** |
| 6 | Pin, restart, remove, and privacy scan | Persistence schema and product flow are not implemented while the hard substrate gates remain open. The earlier outside-Aura canary scan found no forbidden value in existing Aura-owned config/logs. | Prove label/path/route-only storage, removal, zero automatic recents, and clean config/log/diagnostic canary scans without reading official site storage. | **PENDING** |
| 7 | Visible/minimized/background lifecycle, disconnect, restart, reconnect | `manual-launch-only` is selected; managed ownership and exact-process Stop are omitted. One previous user-started interactive session worked before later becoming unavailable. | Prove visible or normally minimized user-owned process state, truthful disconnect, restart, and reconnect without restarting Aura. | **PENDING** |
| 8 | Chat -> Code list -> session -> Chat cleanup | The fixed same-window diagnostic completed the route cycle at HTTP 200 and returned through fixed `/new`; the content-blind route enum passed. It was not installed Aura. | Repeat in installed Aura and prove zero stale marker, observer, artwork, forced appearance, or Studio mirror work. | **PENDING** |
| 9 | Eight themes in Light/Dark on Code list and active session | `CODE_ROLE_SIGNATURES` remains intentionally empty; no production Code styling is enabled. | Complete the 32-state installed-Aura matrix plus representative code/diff/tool, focus, selected, disabled, warning/error, connection, and permission states. | **PENDING** |
| 10 | Layout, keyboard, forced colors, reduced motion, Original look, and failure fallback | Fail-native adapter mechanics cover atomic rollback, ambiguity, safety-sensitive discovery, route changes, and chat-decoration exclusion. | Complete normal/wide/DPI, keyboard, forced-colors, reduced-motion, unavailable-structure, theme-failure, and Original-look review in installed Aura. | **PENDING** |
| 11 | Built-in and user-theme terminal exports | Official schema, deterministic Light/Dark output, collision refusal, contrast, and one built-in `/theme` selection passed. | Exercise the installed Studio/host save workflow for one built-in and one valid user theme, then validate and select all four files. | **PENDING** |
| 12 | Named Desktop contract and unchanged native Desktop | `desktop-guidance-only` is selected. The signed stock MSIX and application identity were verified; Computer Use confirmed exactly one visible running Desktop window. No Desktop probe attached or style applied. This is presence and safety evidence, not installed-product visual acceptance. WO-32 Gate A is exhausted and Gates B/C never opened. | Verify installed Aura opens current official guidance only and makes no direct-handoff, existing-session, transfer, or styling claim. | **PENDING** |
| 13 | Complete disclosures in `en`, `zh-CN`, and `zh-HKTW`; shipped optional routes | The planning copy records benefits, limitations, local/Anthropic data path, separate histories, and omitted Agent View/minimize/VS Code results. Product copy is not implemented while activation is gated. | Review complete installed first-run and Settings copy in all three locales; exercise only optional routes that actually ship. | **PENDING** |

No row above is approved. HUMAN CHECKPOINT CODE remains unchecked until the
installed-product evidence exists and the user explicitly accepts the complete
matrix.
