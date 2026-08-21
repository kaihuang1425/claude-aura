# P0 live-spike runbook

Run these checks only on real Windows hardware with stock, signed applications
and explicit user consent. Use a disposable Git repository containing only
non-sensitive sentinel files. Until Desktop Gates A–C all pass, the supported
result is: **Claude Desktop opens unchanged and unthemed.**
The owner-approved source-checkout presentation experiment below is a separate
local result; it does not change that supported/release statement.

Review the current [Remote Control documentation](https://code.claude.com/docs/en/remote-control)
and [terminal-theme documentation](https://code.claude.com/docs/en/terminal-config)
before starting. This runbook was reviewed against both on 2026-07-30.
The Desktop, Remote Control, and
[Desktop deep-link](https://support.claude.com/en/articles/14729294-open-claude-desktop-with-a-link)
contracts were rechecked on 2026-07-30. The documented Code deep link starts a
new Desktop session. `/desktop` is a user-operated exact CLI-to-Desktop
transfer, but no Aura-initiated existing-session handoff or Desktop-to-Aura
return contract was documented, so `desktop-guidance-only` remains selected.

The current [Claude account authentication guidance](https://support.claude.com/en/articles/13189465-log-in-to-your-claude-account)
directs third-party products to API-key authentication and does not establish a
supported contract for a subscription-authenticated third-party WebView.
Claude Code 2.1.220 passed its documented eligibility-gated
`remote-control --help` preflight, but Aura-hosted production Code remains
**NO-GO** on support grounds.

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
- Never modify Desktop package contents or `app.asar`, and never commit an
  application binary, extracted source, or user data. The one owner-authorized
  read-only startup/fuse inspection of `1.26832.0.0` is complete; do not repeat
  or broaden package inspection without a changed build and fresh authority.
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

> **CURRENT INSTALLED BUILD: NO-GO - DO NOT RERUN `1.26832.0.0`.**
> The owner approved Claude's visible update action and the signed current-user
> MSIX changed from the earlier no-go `1.25927.0.0` to `1.26832.0.0`. The
> corrected candidate again used Microsoft's registered-app AUMID activation
> API and only Electron's documented `--remote-debugging-port=<port>` switch.
> No verified IPv4 or IPv6 loopback endpoint appeared. No probe attached and no
> styling ran. The later owner-authorized startup/fuse inspection confirmed the
> app rejects both debug port and pipe switches without its Anthropic-signed
> short-lived authorization token, while Node CLI inspection is fused off. Do
> not attempt a token bypass. Keep compatibility `unknown` and Gates B/C closed.

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
  before calling
  `IApplicationActivationManager::ActivateApplication(<AUMID>,
  "--remote-debugging-port=<port>", AO_NONE, out <pid>)`. Create the COM
  activation manager out of process. Make no package or config change and do
  not add an undocumented address, profile, inspect, or sandbox switch.
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
  A third user-authorized route, `Invoke-CommandInDesktopPackage` with the
  verified package family and application id, was the only remaining mechanism
  supplying package identity together with arguments. The cmdlet accepted and
  completed without error, but process-survived, listener-observed, and
  endpoint-verified were all false. Graceful cleanup completed, the diagnostic
  endpoint was gone, normal stock Desktop was restored, and ordinary stock
  launch exposed no diagnostic listener. This eliminates missing package
  identity as an explanation and localizes the guard to the application.
  The current source-only controller and profile CLI are hard-disabled by this
  no-go and excluded from public archives and repo/dev installs.
Failed or pending checkpoints: Desktop Gates B and C not opened
Required fallback: normal stock launch; compatibility remains unknown
Next review date: only after a changed Desktop build; the launch-mechanism
  search space is closed on 1.24012.9.0 and no fourth variation is authorized
Approvers: user-authorized local diagnostic; no maintainer/legal release review
```

### 2026-08-09 Desktop Gate A changed-build record

```text
Decision: Desktop Gate A
Result: no-go
Date: 2026-08-09
Tester: current interactive Windows user; identity intentionally not retained
Tested application/CLI versions and packaging: Claude Desktop 1.25927.0.0, MSIX
Official-document review date: 2026-08-09
Evidence summary (sanitized): exact current-user package/AUMID and Anthropic
  signature passed; Desktop was normally exited before each launch. Direct
  launch with the historical flags exposed no endpoint. The packaged-command
  debugging route failed before endpoint verification and left no surviving
  exact process. Primary-source review then corrected the candidate to
  IApplicationActivationManager AUMID activation with only Electron's
  documented --remote-debugging-port switch and acceptance of exactly one IPv4
  or IPv6 loopback listener. That corrected activation also exposed no verified
  endpoint. No CDP probe attached and no style applied. Normal stock Desktop
  was restored without the diagnostic listener.
Failed or pending checkpoints: Desktop Gates B and C not opened
Required fallback: normal stock launch; compatibility remains unknown
Next review date: only after the installed Desktop build changes; a visible
  1.26832.0 update offer was not activated without action-time confirmation
Approvers: user-authorized priority/retry; no maintainer/legal release review
```

### 2026-08-09 Desktop Gate A second changed-build record

```text
Decision: Desktop Gate A
Result: no-go
Date: 2026-08-09
Tester: current interactive Windows user; identity intentionally not retained
Tested application/CLI versions and packaging: Claude Desktop 1.26832.0.0, MSIX
Official-document review date: 2026-08-09
Evidence summary (sanitized): the owner approved Claude's visible app-owned
  relaunch-to-update action. Schema-2 capability output and Get-AppxPackage
  independently confirmed signed current-user MSIX 1.26832.0.0. Claude was
  normally exited through Menu > File > Exit and the exact Desktop process
  count reached zero. The focused 12-test Desktop contract and PowerShell parse
  passed. One bounded corrected IApplicationActivationManager AUMID activation
  used only --remote-debugging-port and returned
  desktop-presentation-endpoint-unverified after 45 seconds. No probe attached,
  no renderer expression ran, and no style was applied. Cleanup relaunched
  ordinary stock Desktop; schema-2 output reported it running and a fresh
  interactive desktop view showed one visible Claude window.
Failed or pending checkpoints: Desktop Gates B and C not opened
Required fallback: normal stock launch; compatibility remains unknown
Next review date: only after the installed Desktop build changes; do not rerun
  Gate A on 1.26832.0.0
Approvers: user-authorized update and bounded retry; no maintainer/legal release
  review
```

### 2026-08-09 Desktop external-frame fallback record

Bounded preview from a source checkout:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\windows\desktop-overlay-proof.ps1 `
  -ThemeId japanese-film-editorial -DurationSeconds 60 `
  -ConfirmUnsupportedDesktopExperiment
```

Explicit local session, which removes the frame when Claude closes:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\windows\desktop-overlay-proof.ps1 `
  -ThemeId default -RunUntilClaudeCloses `
  -ConfirmUnsupportedDesktopExperiment
```

```text
Decision: Desktop external-frame visual proof
Result: go (source-only proof; internal Gates A/B unchanged)
Date: 2026-08-09
Tester: current interactive Windows user; identity intentionally not retained
Windows version: Windows 11 Home 25H2, build 26200.8875, x64; 200% DPI
Tested application/CLI versions and packaging: Claude Desktop 1.26832.0.0,
  signed current-user MSIX
Evidence summary (sanitized): renderer CDP, Electron main-process inspection,
  and built-in DevTools were unavailable. The owner then authorized a separate
  click-through presentation fallback. The helper bound one visible HWND from
  the exact signed package process set, applied an Aura-theme-derived layered
  frame without reading content, remained usable through Home/Code navigation,
  and removed the full surface on exit without restarting Claude. Japanese
  Film Editorial was visually inspected on the actual whole window; Korean
  Prestige completed a second bounded run. A lifecycle run then hid the layer
  on minimize, resumed it on restore, rebuilt for maximize/restore, returned
  Claude to its original normal state, and reported complete cleanup. Focused
  verification passed 14 tests in one suite and PowerShell parsing passed.
  An explicit session-mode run then ended on Claude's normal File > Exit,
  returned desktop-overlay-target-closed with complete cleanup and empty
  stderr, left zero overlay helpers, and was followed by a verified ordinary
  stock relaunch.
  The owner subsequently repeated the documented flow and confirmed the border
  was visibly present on the real Claude window and that the helper terminated
  when Claude closed. The owner observed no other feature; this is expected and
  limits acceptance to the external frame plus lifecycle cleanup.
Failed or pending checkpoints: cross-monitor move/DPI observation, all eight
  theme palettes as live visuals, high-contrast observation, user visual
  acceptance, and any release review. Internal CDP Gates A/B remain
  no-go/unopened.
Required fallback: helper absent or any ambiguity leaves ordinary stock Claude;
  no installer or release path includes the external-frame source.
Next review date: after the external eight-theme/lifecycle matrix or a changed
  installed Desktop build
Approvers: owner-authorized unsupported local experiment; no Gate C or release
  approval
```

### 2026-08-09 Desktop interactive theme-rail record

The same command now presents the Aura theme rail by default and launches the
validated registered Claude app when it is not already running:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\windows\desktop-overlay-proof.ps1 `
  -ThemeId japanese-film-editorial -Appearance system -RunUntilClaudeCloses `
  -ConfirmUnsupportedDesktopExperiment
```

Use `-FrameOnly` only to omit the interactive rail. Use
`-DoNotLaunchClaude` only when a missing Claude process should fail closed.
`-Appearance` accepts `system`, `light`, or `dark`; System follows the current
Windows app appearance. The rail appends validated kits from
`%LOCALAPPDATA%\ClaudeAura\data\themes\` after the eight built-ins.
Registered built-in background art and appearance-matched title wordmarks are
enabled by default. Use `-NoArtwork` or `-NoIdentity` to suppress either owned
visual channel. Content-blind structural accents are also enabled by default;
they read only UI Automation control type, bounding rectangle, and offscreen
state from the exact signed target, never names/text/values/IDs/patterns. Use
`-NoStructureAccents` to suppress that channel. None of these switches changes
Claude or the stored theme selection. The primary color path now locally builds
the checked-in x64 helper, captures only the validated Claude HWND with Windows
Graphics Capture, applies a restrained selected-accent D3D11 shader, and keeps
the frame GPU-only. It truthfully reports GPU window-frame access while using no
CPU mapping, encoding, retention, network transfer, or screenshot. The earlier
windowed-Magnifier desktop-rectangle path remains only a fail-open fallback on
its supported single-display configuration. Use `-NoColorFilter` to suppress
both paths. Neither compositor is renderer/DOM evidence.
The selected validated theme blur controls only Aura's external halo breadth;
it never samples or blurs Claude pixels. `-Appearance dark` selects Aura's dark
palette, artwork, wordmark, and matrix but cannot force the native Claude
renderer itself into Dark.
Use `-OriginalLook` for a transient stock-Claude preview that bypasses every
theme-rendering channel without reading or writing the saved presentation
selection; the Aura rail remains available to resume a theme.

Install or inspect the separately named source-only Start-menu entry:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\windows\desktop-aura-session.ps1 `
  -Action Install -ConfirmUnsupportedDesktopExperiment
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\windows\desktop-aura-session.ps1 `
  -Action Status
```

The shortcut launches session mode with a hidden console. Use the rail's close
control to remove the presentation helper without closing Claude. `-Action
Remove -ConfirmUnsupportedDesktopExperiment` removes only an ownership-checked
source-experiment shortcut; it does not uninstall Claude Aura Web.

```text
Decision: Desktop interactive external presentation
Result: go (source-only live proof; internal Gates A/B unchanged)
Date: 2026-08-09
Tested application and display: signed Claude Desktop MSIX 1.26832.0.0;
  Windows 11 at 200% DPI
Evidence summary (sanitized): the helper auto-launched the exact registered
  AUMID in a 15-second preview and returned schema 3 with the theme rail and
  click-through material frame visible. A separate live session visibly
  switched Japanese Film Editorial to Korean Prestige, selected Original look
  to remove the complete frame and badge, then resumed Anime Twilight. The
  rail used the eight validated shipped launcher marks; the target content was
  neither read nor intercepted. Closing only the helper removed the rail,
  badge, halo, and frame while Claude remained open and stock. Final output:
  themeSwitchCount=2, originalLookTransitions=1, surfaceBuildCount=3,
  contentAccess=false, inputIntercepted=false, cleanupComplete=true, empty
  stderr, and zero remaining helper processes. The focused Desktop suite
  passed 14/14 and PowerShell parsing passed. A subsequent persistence proof
  wrote Cartoon Studio immediately, loaded it on a fresh invocation with no
  theme argument, then restored the stored preference to Default. Korean
  Prestige also visibly applied the low-opacity click-through top-chrome and
  sidebar material wash; helper-only exit removed it completely.
  A subsequent live appearance run switched Dark to Light to System, reporting
  `appearanceSwitchCount=2` and `surfaceBuildCount=3`. One temporary validated
  installed kit appeared as theme 9 of 9, rendered in Dark, persisted across a
  fresh helper process with Dark, and was then removed after Default/System was
  restored. Exact legacy state migrated to schema 2 by adding only
  `appearance`; zero helper processes remained.
  The source-only Start-menu entry was then installed, re-read as owned, and
  launched. Its rail appeared on the signed app; the rail close control exited
  only the helper while Claude remained running. The owned shortcut remains
  available and both source scripts remain release-excluded.
  One subsequent live run covered all eight frozen themes in Light and Dark on
  the actual whole window. Its 16 single-state captures had 16 distinct hashes;
  output reported themeSwitchCount=14, appearanceSwitchCount=1,
  surfaceBuildCount=16, contentAccess=false, inputIntercepted=false, empty
  stderr, and complete cleanup. Every cell showed the correct mark, active rail
  state, frame/halo, and material-shell palette. The private captures were sent
  to the Recycle Bin after review.
  The next content-blind slice added bounded registered background artwork and
  appearance-matched built-in wordmarks. Cartoon Studio Light visibly showed
  both on the actual signed whole window. One optimized Light/Dark traversal
  then reported surfaceBuildCount=16, identityRenderCount=16,
  artworkRenderCount=14, zero identity/artwork failures, themeSwitchCount=14,
  appearanceSwitchCount=1, contentAccess=false, inputIntercepted=false, empty
  stderr, and complete cleanup. Its private proof frame was recycled.
  The next bounded slice used only UI Automation control type, bounding
  rectangle, and offscreen state to follow real component geometry. On the
  signed Korean Prestige Light whole window it visited 271 bounded elements,
  drew 24 low-opacity accents across real sidebar controls, cards, selectors,
  header/composer groups, and section-heading rules, refreshed eight times, and
  reported zero structural failures. Sanitized output explicitly reported
  accessibilityGeometryAccess=true, accessibilityTextAccess=false,
  contentAccess=false, empty stderr, and complete cleanup. The private capture
  was then sent to the Recycle Bin.
  A separate live `-NoStructureAccents` run reported that channel disabled,
  zero snapshots/elements/accents, accessibility geometry/text access false,
  content access false, empty stderr, and complete cleanup. Direct `-Action
  Run` source sessions propagate that opt-out with the artwork, identity, and
  shell switches.
  Primary-source Microsoft review then authorized one bounded, non-elevated x64
  compositor prototype. It presented 189 globally color-transformed frames at
  1.0 scale with no black/recursive/stale region, retained native focus, never
  declared a pixel callback, and cleaned up fully. The first integrated frame
  revealed that the compositor incorrectly covered Aura-owned visuals despite
  green counters. Moving its host to the normal window band fixed the z-order.
  The corrected Korean Prestige Light whole-window review retained the rail,
  artwork, wordmark, 24 component accents, heading rules, frame, and halo above
  172 filtered frames. Filter/structure/artwork/identity failures were all zero;
  pixelReadback=false, exactHwndIsolation=false, stderr was empty, and cleanup
  completed. An optimized Anime Twilight Dark representative then presented 141
  filtered frames with filter/structure/artwork/identity failures all zero,
  empty stderr, and complete cleanup. A separate `-NoColorFilter` run produced
  zero initialization or filter presentations while the remaining layer stayed
  usable. All private
  frames and throwaway prototype files were recycled or removed.
  A final content-blind geometry audit rejected Pane/Document whole-window
  duplicates, a 1x1 StatusBar sentinel, and the sidebar Thumb, then safely added
  two grouped List materials and six Image/icon rings. The Korean Prestige Light
  whole-window review therefore drew 32 restrained cues over 271 bounded UIA
  elements and presented 171 filtered frames; the rings and group boundaries
  did not cover icons or labels. Anime Twilight Dark presented 142 filtered
  frames with the same 32 cues. Both runs recorded zero
  filter/structure/artwork/identity failures and complete cleanup, and the
  private Light frame was sent to the Recycle Bin.
  The cue renderer then adopted each selected theme's already validated
  `studioStyle.shared.radius` token. Whole-window reviews of Japanese Film
  Editorial Light at radius 4 and Japanese Idol Light at radius 20 visibly
  confirmed crisp versus rounded group/card/control paths with all 32 cues still
  aligned. They presented 172 and 174 filtered frames, respectively, with zero
  visual failures, no input interception, empty stderr, complete cleanup, and
  both private captures recycled.
  The outer halo then adopted each theme's validated `studioStyle.shared.blur`.
  Study Library Light blur 6 and Korean Idol Dark blur 26 whole-window reviews
  visibly confirmed tight versus broad falloff outside native controls. They
  presented 174 and 171 filtered frames with 32 cues, zero visual failures, no
  input interception, empty stderr, and complete cleanup. No Claude pixel was
  read or blurred, and both private captures were recycled.
  A final Korean Prestige Light review applied its validated panel and
  raised-surface colors only to low-opacity Aura group/card fills. All 32 cues
  remained readable across 173 filtered frames with zero visual failures, no
  input interception, empty stderr, complete cleanup, and the private capture
  recycled.
  A reversible same-display responsive review then resized Claude to 1400x820
  physical pixels at 200% DPI. Claude collapsed its sidebar; Aura adapted from
  32 to 17 visible cues, omitted the wide wordmark, kept the rail outside the
  target, and presented 175 filtered frames with zero failures or input
  interception. Cleanup passed, the exact original `WINDOWPLACEMENT` was
  restored, and the private capture was recycled. This is not second-display or
  non-200%-DPI evidence.
  A direct `-OriginalLook -NoPersist` run reported
  presentationVisible=false, controllerVisible=true, and zero filter,
  structure, surface, artwork, or identity presentations. It wrote no state,
  intercepted no input, accessed no content/accessibility text/pixels, and
  completed cleanup.
  The next source-only slice replaced the primary desktop-rectangle color path
  with exact-HWND Windows Graphics Capture plus a D3D11 shader. A bounded Light
  run on the signed `1.26832.0.0` window reported
  `colorFilterBackend:windows-graphics-capture-exact-hwnd-gpu`,
  `exactHwndIsolation:true`, `gpuPixelTransform:true`, `pixelReadback:false`,
  one presented static frame, valid helper evidence, and complete cleanup. Four
  background-only diagnostic samples visibly changed under a deliberately
  strong proof accent without examining readable content; that private image
  and every temporary log/object were sent to the Recycle Bin.
  A direct Original run then reported backend/source `none`, no GPU start, no
  content access, no state write, and complete cleanup. Finally, the actual Aura
  rail switched Japanese Film Editorial Light to Korean Prestige, selected
  Dark, and restored Original at 200% DPI. Sanitized output recorded one theme
  switch, one appearance switch, one Original transition, three GPU starts,
  seven frames across a 1400x820 resize and exact placement restore, zero GPU
  failures, valid evidence, no pixel readback, and clean shutdown with zero
  helper processes.
  The schema-5 continuation replaced the single-accent shader input with each
  appearance's validated canvas, sidebar, surface, raised, text, border, and
  accent colors. A Korean Prestige Light-to-Dark-to-Original run reported
  `gpuSurfacePaletteMapping:true`, `gpuDarkNeutralRemap:true`, two successful
  helper starts, zero failures, no readback, and clean shutdown. Four fixed
  content-blind points changed from average luminance 248.98 to 52.24; no image
  or readable content was retained.
  One optimized follow-up traversed every built-in in Light and Dark before
  restoring Original. It reported 14 theme switches, one appearance switch, 16
  successful GPU starts/frames, 14/14 artwork renders, 16/16 identity renders,
  and zero GPU/artwork/identity/structure failures. Light samples ranged from
  229.85 to 251.24 average luminance and Dark from 52.24 to 65.03. Stderr was
  empty, cleanup completed, and no screenshot or readable content was retained.
  The schema-6 semantic refinement now carries all 13 appearance colors plus
  surface/sidebar alpha, and the Aura-owned rail follows launcher shape and
  font-category tokens. A live critique corrected harsh neutral-text edging and
  reduced geometry-border weight. The final transient all-theme Light/Dark run
  recorded 14 theme switches, one appearance switch, one Original transition,
  16 GPU starts, 17 frames, 14 artwork and 16 identity renders, zero visual
  failures, empty stderr, no persisted state, and complete cleanup. Temporary
  QA images and logs were removed after review.
  The owner later rejected that visual result: its in-page wordmarks were too
  small and Dark labels still read as hollow-edged text. The superseding
  `1.28929.0.0` source proof draws each approved full lockup at a 160 px target
  width (136 px minimum) and derives source polarity from captured top chrome.
  All eight permanent themes were then reviewed live in Light and Dark, but the
  owner rejected the Dark small-label rendering after that review; the prior
  text-refinement record is therefore not visual acceptance. A 2026-08-12
  native-resolution repair now sizes the initial swap chain from the capture
  item, disables DXGI stretch scaling, and reads Claude through integer texel
  loads. The host requires `gpuNativeResolutionPreserved:true` and equal
  capture, swap-chain, and output-client dimensions before accepting helper
  evidence. Japanese Film Editorial Light and Dark both proved exact
  `980x531` dimensions at 96 DPI with clean teardown. Light looked materially
  sharper, but Dark small labels still looked hollow/bright-fringed. Two
  edge-coverage adjustments and two monotonic neutral-ramp adjustments failed
  fresh whole-window review and were reverted; `BLOCKED.md` records them. The
  resolution repair remains, but Dark text and all-theme visual acceptance are
  still open and release-inert.
Failed or pending checkpoints: cross-monitor movement and non-200%-DPI
  observation require hardware not present on this one-display 200%-DPI
  machine; internal typography/layout/semantic component binding,
  native-quality Dark text, context-sensitive heroes/loading states,
  Magnifier-fallback foreign-occluder behavior, and release review remain open.
  Claude's native content canvas remains unchanged beneath the external layer.
Required fallback: Original look or helper absence leaves Claude stock; an
  unknown build, invalid signature, ambiguous window, high contrast, or second
  controller fails closed
Approvers: owner-authorized unsupported local experiment; no Gate C or release
  approval
```

### 2026-08-12 Desktop Gate A third changed-build record

```text
Decision: Desktop Gate A — Electron main inspector
Result: no-go
Date: 2026-08-12
Tested application and packaging: Claude Desktop 1.28929.0.0, signed
  current-user MSIX
Evidence summary (sanitized): the owner approved the normal app-owned update
  and one bounded changed-build retest. After a normal File > Exit, registered
  AUMID activation supplied only --inspect=127.0.0.1:<fresh-port>. No validated
  loopback inspector endpoint appeared, so no runtime expression executed and
  no style was inserted. The controller requested manual cleanup; Claude was
  exited through its own File > Exit path, the exact package process and owned
  listener counts both reached zero, and stock Claude was relaunched without a
  debug argument or listener.
Failed or pending checkpoints: Desktop Gates B and C not opened
Required fallback: normal stock launch; the independent exact-HWND source
  presentation remains optional and release-inert
Next review date: only after another installed Desktop build change and fresh
  owner authorization; the controller candidate list is empty
Approvers: owner-authorized update and bounded retry; no Gate C or release
  approval
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
| 4 | Interrupt one turn and reject one permission request | Native device re-verification stayed visible and user-operated in the route diagnostic. Claude Code 2.1.220 passed its documented eligibility-gated Remote Control help preflight. Official authentication guidance does not establish third-party subscription-authenticated WebView support, so the embedded product support decision is NO-GO. Interruption, normal embedded permission approval, and rejection remain unproved. | Do not exercise the retired embedded path unless official support changes. After such an unblock, exercise native account pairing, trust/permission, interruption, rejection, policy, and error behavior in the disposable installed-Aura session. | **PENDING** |
| 5 | Named concurrency contract | `one-process-per-session` is selected after two server/worktree attempts produced no selectable session or worktree. No server capacity or worktree controls may ship. | Prove two explicit sessions, each backed by its own visible user-owned process, and verify Aura presents no server multiplexing controls. | **PENDING** |
| 6 | Pin, restart, remove, and privacy scan | Persistence schema and product flow are not implemented while the hard substrate gates remain open. The earlier outside-Aura canary scan found no forbidden value in existing Aura-owned config/logs. | Prove label/path/route-only storage, removal, zero automatic recents, and clean config/log/diagnostic canary scans without reading official site storage. | **PENDING** |
| 7 | Visible/minimized/background lifecycle, disconnect, restart, reconnect | `manual-launch-only` is selected; managed ownership and exact-process Stop are omitted. One previous user-started interactive session worked before later becoming unavailable. | Prove visible or normally minimized user-owned process state, truthful disconnect, restart, and reconnect without restarting Aura. | **PENDING** |
| 8 | Chat -> Code list -> session -> Chat cleanup | The fixed same-window diagnostic completed the route cycle at HTTP 200 and returned through fixed `/new`; the content-blind route enum passed. It was not installed Aura. | Repeat in installed Aura and prove zero stale marker, observer, artwork, forced appearance, or Studio mirror work. | **PENDING** |
| 9 | Eight themes in Light/Dark on Code list and active session | `CODE_ROLE_SIGNATURES` remains intentionally empty; no production Code styling is enabled. | Complete the 32-state installed-Aura matrix plus representative code/diff/tool, focus, selected, disabled, warning/error, connection, and permission states. | **PENDING** |
| 10 | Layout, keyboard, forced colors, reduced motion, Original look, and failure fallback | Fail-native adapter mechanics cover atomic rollback, ambiguity, safety-sensitive discovery, route changes, and chat-decoration exclusion. | Complete normal/wide/DPI, keyboard, forced-colors, reduced-motion, unavailable-structure, theme-failure, and Original-look review in installed Aura. | **PENDING** |
| 11 | Built-in and user-theme terminal exports | Official schema, deterministic Light/Dark output, collision refusal, contrast, and one built-in `/theme` selection passed. | Exercise the installed Studio/host save workflow for one built-in and one valid user theme, then validate and select all four files. | **PENDING** |
| 12 | Named Desktop contract and unchanged native Desktop | `desktop-guidance-only` is selected. The signed stock MSIX and application identity were verified. Installed Aura's host, Studio action, and `en`, `zh-CN`, and `zh-HKTW` locale copies exactly match the committed guidance build. The action uses a default-No consent dialog and can open only the exact allowlisted official `https://code.claude.com/docs/en/desktop#coming-from-the-cli` URL after Yes. All three authored locales explicitly say Aura does not select or transfer a Remote Control session, send a project path or prompt, or style Claude Desktop. The user directly confirmed that Claude Desktop was visibly open; Computer Use target enumeration omitted its window, so presence is user-confirmed rather than tool-confirmed. No Desktop probe attached or style applied. This is installed-artifact, localized-copy, presence, and safety evidence, not live click-through or visual acceptance. WO-32 Gate A is exhausted and Gates B/C never opened. | Observe default-No/no-side-effect and explicit-Yes guidance opening in installed Aura. | **PENDING** |
| 13 | Complete disclosures in `en`, `zh-CN`, and `zh-HKTW`; shipped optional routes | The planning copy records benefits, limitations, local/Anthropic data path, separate histories, and omitted Agent View/minimize/VS Code results. Product copy is not implemented while activation is gated. | Review complete installed first-run and Settings copy in all three locales; exercise only optional routes that actually ship. | **PENDING** |

No row above is approved. HUMAN CHECKPOINT CODE remains unchecked until the
installed-product evidence exists and the user explicitly accepts the complete
matrix.
