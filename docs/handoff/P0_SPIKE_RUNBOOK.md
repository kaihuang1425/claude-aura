# P0 live-spike runbook

Run these checks only on real Windows hardware with stock, signed applications
and explicit user consent. Use a disposable Git repository containing only
non-sensitive sentinel files. Until Desktop Gates A–C all pass, the supported
result is: **Claude Desktop opens unchanged and unthemed.**

Review the current [Remote Control documentation](https://code.claude.com/docs/en/remote-control)
and [terminal-theme documentation](https://code.claude.com/docs/en/terminal-config)
before starting. This runbook was reviewed against both on 2026-07-29.

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

- [ ] Export one built-in and one user theme to Aura staging:

  ```powershell
  node .\scripts\theme-cli.mjs export-terminal default --out .\dist\terminal-themes
  node .\scripts\theme-cli.mjs export-terminal <user-id> --user-themes <user-theme-root> --out .\dist\terminal-themes
  ```

- [ ] Parse each JSON file with `Get-Content -Raw | ConvertFrom-Json`; confirm
  deterministic Light/Dark names and that the ownership manifest is separate.
- [ ] Preview and validate, then explicitly install with a same-directory
  temporary file. Refuse an existing destination unless its digest is owned by
  Aura; prove a foreign collision remains byte-identical.
- [ ] In Claude Code v2.1.118 or later, run `/theme` and select each installed
  Light/Dark theme. Aura must not select it automatically.
- [ ] Confirm matching colors, readable forced-colors fallback, live reload, and
  digest-matched cleanup. Do not claim artwork or layout parity.
- Evidence: CLI version, exported filenames/digests, JSON-valid booleans,
  foreign-collision hash, `/theme` acceptance, mode/accessibility/reload results.
- Go only if official selection, reload, collision refusal, and cleanup pass.

## Desktop Gate A — Runtime and launch capability

- [ ] With Desktop closed, run the read-only install/process probe:

  ```powershell
  powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\windows\desktop-capability.ps1
  ```

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
  proven stock process with no package modification. Otherwise stop Desktop-direct.

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
