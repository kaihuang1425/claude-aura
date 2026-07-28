# Claude Desktop styling: investigation and implementation plan

## Decision to prepare

Aura should offer two explicit launch modes, in this order:

1. **Style Claude Desktop (experimental)** — use the installed, authentic Claude
   Desktop application and apply Aura only when a supported, authenticated
   renderer connection can be established.
2. **Open Aura web window** — retain the current dedicated WebView2 experience as
   the reliable fallback.

This document is a plan, not approval to patch or redistribute Claude Desktop.
No Desktop files, package contents, signatures, update settings, or account data
should be changed. The Desktop option must remain hidden behind a capability
check until the spike gates below pass.

## What is preventing the Desktop path today

### 1. Aura owns no execution point inside Claude Desktop

The supported Windows host owns its WebView2 controller, so it can register a
prepaint script and call `ExecuteScriptAsync`. Aura does not own Claude
Desktop's renderer or its startup arguments. Finding a signed executable and
opening it, which Aura already does, proves installation only; it provides no
renderer connection and cannot apply the compiled payload.

The legacy `scripts/injector.mjs` is useful groundwork because it validates a
loopback Chrome DevTools Protocol (CDP) endpoint, pins a browser identity, filters
page targets, probes renderer markers, injects the existing payload, watches
navigation, removes Aura-owned nodes, and can capture a screenshot. Nothing in
the supported startup flow currently launches Desktop with an endpoint or
provides a verified browser identity to that injector.

### 2. There is no established public Desktop theming contract

The repository has no documented Claude Desktop theme API, extension point, or
host permission that permits arbitrary CSS/JavaScript. A CDP-based route is
therefore an integration with runtime behavior, not a stable product API. It
must be treated as experimental and version-gated rather than described as a
supported native theme.

The investigation must verify the current shipped application rather than
assuming it is Electron, assuming a fixed renderer URL, or relying on historical
class names. The signed executable/package discovery already distinguishes MSIX
and unpackaged installs, but it does not establish the renderer technology or
whether a remote-debugging switch is honored.

### 3. Attaching safely is harder than merely opening a debug port

A fixed port can collide with another process, can expose a privileged debugging
surface to other local processes, and cannot prove that the endpoint belongs to
the Claude process Aura launched. Target titles and URLs alone are insufficient
identity. Aura also needs lifecycle ownership, a random per-run port, browser-ID
pinning, loopback-only validation, process creation time, executable path,
signature, and a closed-endpoint check after shutdown.

CDP grants page-level script execution. That is more authority than a visual
theme needs. The Desktop adapter must allow only the minimum methods required
for target discovery, isolated-world evaluation, navigation observation, and
cleanup; it must never inspect or persist conversation text, cookies, tokens,
network bodies, local files, or account storage.

### 4. Launch and session ownership are unresolved

The Desktop app may already be running, may enforce a single-instance lock, or
may forward a second launch to the existing instance. In those cases Aura cannot
assume its requested arguments reached the owning process. Killing and relaunching
an existing app would risk drafts and active work, so it is not acceptable.

The spike must establish one of these truthful outcomes:

- **managed launch:** Desktop was not running; Aura starts it with an ephemeral
  endpoint and retains exact process identity;
- **verified attach:** an official opt-in/debug mechanism exposes an endpoint
  that can be bound to the existing signed Desktop process; or
- **unavailable:** Aura explains why and offers the WebView2 path without trying
  to restart, patch, or weaken Desktop.

### 5. The renderer contract can diverge from `claude.ai`

The shared compiled payload currently targets the live web renderer. Desktop can
have native title bars, desktop-only navigation, Code surfaces, nested webviews,
different CSP behavior, and renderer changes on an independent release cadence.
Passing injection on one window does not prove all windows are safe. Selector,
layout, keyboard, drag-region, modal, update, sign-in, permission, and local-file
surfaces need a Desktop-specific compatibility manifest and acceptance matrix.

### 6. Updates and recovery need a fail-open design

Desktop can update independently of Aura. An unknown version must not receive a
best-effort payload. If discovery, identity, marker, injection, or cleanup fails,
Aura must leave Desktop usable in its original appearance, report a concise
reason, and keep the web fallback available. Original look must remove only
Aura-owned state from every attached renderer without closing Desktop.

## Research spike: evidence required before product implementation

Create a disposable Windows test matrix covering the current stable Claude
Desktop build on Windows 10 and 11, both MSIX and unpackaged packaging when each
is still distributed. Record versions and hashes, but never commit user data or
application binaries.

### Spike A — runtime and launch capability

1. Extend read-only diagnostics around `Get-AuraClaudeInstall` to record package
   kind, signed executable path, product version, process path, PID, parent PID,
   creation time, and whether Desktop was already running.
2. From a clean signed-in test account, launch with a random high port reserved
   immediately before process creation. Test whether the current Desktop build
   explicitly honors a loopback remote-debugging argument.
3. Prove whether the actual owning process is newly created, inherited, or an
   existing single instance. Reject the run if ownership cannot be proven.
4. Query only `/json/version` and `/json/list`; record sanitized target types,
   origins, and marker booleans. Do not record titles containing user content,
   DOM text, URLs with paths/query strings, cookies, or network traffic.
5. Close the managed test instance normally and prove the endpoint disappears.

**Gate A passes only if** a stock, signed Desktop install exposes a loopback-only
CDP endpoint through a repeatable user-consented launch, the endpoint is bound to
the expected process instance, no package modification is needed, and normal
launch/update behavior is preserved.

If Gate A fails, stop the Desktop-direct implementation. Ship the two-choice UI
with **Style Claude Desktop** unavailable and a specific reason; keep **Open Aura
web window** as the working path. Do not attempt package extraction, archive
patching, DLL injection, global proxying, certificate installation, or signature
bypass as a fallback.

### Spike B — renderer compatibility

Using a harmless diagnostic payload before any complete theme:

1. Enumerate top-level page targets and child targets across sign-in, new chat,
   conversation, Settings, Projects, Artifacts, file picker/permission UI, and
   Code if available to the test account.
2. Classify each target as `themeable`, `native-or-protected`, or `unknown` using
   origin plus a versioned set of semantic markers. Default to `unknown`.
3. In a CDP isolated world, add one namespaced root attribute and a tiny style
   that changes only a diagnostic custom property. Verify removal, reload,
   renderer restart, window recreation, sleep/resume, and app update behavior.
4. Compare the Desktop DOM contract with the live-web contract. Produce a list
   of shared semantic selectors and Desktop-only exceptions; never broaden a
   selector merely to make a test pass.
5. Confirm that native drag regions, menus, keyboard shortcuts, focus rings,
   screen-reader names, permissions, update prompts, and sign-in remain intact.

**Gate B passes only if** eligible targets can be identified without reading user
content, isolated-world installation and cleanup are deterministic, and the
unmodified application remains fully usable after every tested failure.

### Spike C — policy and distribution review

Before exposing the option outside development builds:

1. Obtain maintainer/legal review of current Claude consumer terms and Desktop
   distribution terms for runtime debugging and local styling.
2. Describe the feature accurately as an experimental local presentation layer,
   not an official plugin or supported Claude theme system.
3. Publish the exact security boundary, collected diagnostics, known version
   range, recovery procedure, and automatic-disable policy.

Unresolved policy review blocks release even if the technical spikes pass.

## Proposed implementation after all gates pass

### Architecture

Add a host-neutral adapter boundary rather than mixing Desktop behavior into the
existing WebView2 lifecycle:

```text
Theme compiler -> renderer payload
                         |
          +--------------+---------------+
          |                              |
 WebView2RendererAdapter          DesktopCdpAdapter
 (existing supported host)       (experimental, version-gated)
```

Both adapters implement the same small contract:

```text
probe() -> host identity, version, eligible surfaces, capabilities
install(payloadDigest, payload) -> per-surface result
watch(onSurfaceAdded, onSurfaceRemoved, onNavigation)
remove(payloadDigest?) -> per-surface cleanup result
dispose() -> close Aura's connection; never terminate an unmanaged host
```

Keep compilation, theme persistence, Studio editing, artwork validation, and
Original-look semantics shared. Keep host discovery, transport, lifecycle, and
compatibility policy separate.

### Concrete repository TODOs

1. **Configuration and state**
   - Add `launchMode: "ask" | "desktop" | "web"` to the validated config, default
     existing users to `ask`, and store `desktopConsentVersion` separately.
   - Add transient states `checking`, `available`, `managed`, `attached`,
     `unsupported-version`, `already-running-unattachable`, `endpoint-failed`,
     and `renderer-mismatch`. Never persist ports, PIDs, browser IDs, or target IDs.
   - Extend `scripts/state-cli.mjs` and config tests with strict enums, atomic
     writes, backward migration, and corruption recovery.

2. **Read-only capability probe**
   - Add `windows/desktop-capability.ps1` for signed install/process discovery.
     Reuse `Get-AuraClaudeInstall`; compare normalized executable paths, signature,
     version, PID, and creation time. Output a bounded JSON schema with reason codes.
   - Add `scripts/desktop-probe.mjs` for endpoint identity and sanitized target
     capability checks. Extract the URL, browser-ID, target-ID, timeout, and
     loopback validators from `scripts/injector.mjs` into
     `scripts/desktop-cdp/validation.mjs` with unit tests.
   - Maintain `desktop-compatibility.json` with explicit tested version ranges,
     packaging, required marker sets, supported surfaces, and payload schema.
     Unknown versions are disabled, not optimistically matched.

3. **Consent-based managed launcher**
   - Add `windows/desktop-launch.ps1`. Refuse if any verified Claude Desktop
     process is already running unless Spike A proves a supported attach route.
   - Reserve an ephemeral loopback port, generate a run nonce, capture pre-launch
     process inventory, launch the signed executable, then bind the endpoint to
     the post-launch process using all available identity evidence. The nonce is
     correlation data only and must not be injected into page content or logs.
   - Apply a short deadline. On failure, disconnect, show the reason, and offer
     the web path. Never retry in a loop or terminate a process Aura did not own.

4. **Desktop CDP adapter**
   - Refactor `scripts/injector.mjs` into a thin CLI over
     `scripts/desktop-cdp/adapter.mjs`, `session.mjs`, `targets.mjs`, and
     `validation.mjs`.
   - Allowlist the minimum CDP methods. Use an isolated world where supported;
     keep the current browser-identity pin and validate every WebSocket URL as
     loopback with no credentials, query, fragment, or unexpected path.
   - Match targets with origin + compatibility markers + process/session
     identity. Do not accept title-only matching. Never enable Network, Storage,
     DOMSnapshot, Fetch, or download domains.
   - Track each eligible surface independently. Install only the existing
     content-addressed payload, verify its digest/root marker, reapply after a
     verified navigation, and call payload cleanup before detaching.

5. **Desktop renderer profile**
   - Add a `hostProfile` input to `buildPayload`, with `webview` and `desktop`
     profiles. Share semantic tokens and components; isolate Desktop selectors in
     `assets/desktop.css` and Desktop lifecycle hooks in
     `assets/desktop-renderer.js`.
   - Protect title-bar drag regions, window controls, native bridges, update and
     permission UI, popovers, focus handling, and non-page targets with explicit
     exclusions. Desktop-specific CSS must reduce noise without hiding or moving
     features.
   - Preserve the premium, simple direction: one coherent background layer,
     restrained elevation, intentional motion, clear selected/focus states, and
     responsive layouts at compact, normal, maximized, and high-DPI sizes.

6. **Choice UI and recovery**
   - Replace the current direct-start assumption with a small native choice card:
     **Style Claude Desktop** first and **Open Aura web window** second. Show one
     sentence of tradeoff and a live status beside Desktop; avoid a third pane or
     technical log in the primary UI.
   - If Desktop is installed but unavailable, keep the first option visible but
     disabled with one actionable reason such as “Close Claude Desktop and try
     again” or “This Desktop version has not been verified.” Never use a generic
     failure when a stable reason code exists.
   - Add **Always use this choice**, reversible in Settings. Add **Original look**
     and **Disconnect Aura** actions that do not quit Desktop. Keep **Open Aura web
     window** reachable from the tray and recovery dialogs.
   - Localize all new copy through `windows/ui-copy.json` and locale files, with
     layout tests for long translations and 200% scaling.

7. **Installer and diagnostics**
   - Do not make Desktop a prerequisite. Installer copy should say the web mode is
     always available and Desktop styling is enabled only for verified builds.
   - Add a privacy-safe diagnostic export containing Aura version, Desktop
     version/packaging, compatibility decision, reason code, target-type counts,
     and payload digest. Exclude paths beyond normalized executable identity,
     page text, page titles, full URLs, account data, and CDP messages.
   - Preserve the current separate WebView2 profile and uninstall behavior. Add
     no firewall rule, service, scheduled task, certificate, or machine-wide
     setting.

## Test and acceptance plan

### Automated tests

- Unit-test port allocation, URL validation (IPv4/IPv6 loopback), browser-ID
  pinning, target-ID validation, timeouts, version allowlisting, and sanitized
  logging with hostile fixtures.
- Simulate endpoint replacement, browser-ID changes, PID reuse, stale creation
  times, single-instance forwarding, target churn, navigation races, renderer
  crashes, malformed CDP frames, and cleanup failures.
- Assert that forbidden CDP domains and package mutation strings never occur in
  production Windows/scripts sources.
- Run every existing payload, theme, artwork, Studio, locale, installer, and
  WebView2 test unchanged; the fallback must remain a first-class supported path.
- Add deterministic adapter contract tests proving the same theme digest installs
  and removes through fake WebView2 and fake CDP transports.

### Manual Windows matrix

For every allowlisted Desktop version, test Windows 10 and 11; standard and
administrator accounts while Aura itself remains non-elevated; MSIX/unpackaged
forms; fresh, signed-in, signed-out, already-running, multiple-window, update,
sleep/resume, offline, proxy, crash, and uninstall flows. Exercise all eight
themes in Light/Dark/System at 100%, 150%, and 200% scaling, keyboard-only,
screen reader, reduced motion, forced colors, compact window, and maximized.

Capture whole-window evidence for new chat, conversation, Settings, one modal,
one permission surface, one failure/recovery state, Original look, and the web
fallback. Screenshots must use disposable content with no account or project
identifiers.

### Release gates

Desktop styling ships only when all are true:

- stock signed application; zero file/package/signature modification;
- explicit consent and repeatable, process-bound loopback connection;
- allowlisted current Desktop version and renderer markers;
- deterministic install, navigation recovery, cleanup, and endpoint shutdown;
- no collection of content, credentials, cookies, tokens, or network bodies;
- no regression to Desktop features or the existing WebView2 path;
- accessibility and full visual matrix approved;
- policy/distribution review complete; and
- emergency compatibility denylist can disable Desktop styling without disabling
  the web fallback.

## Recommended sequence

1. Complete Spikes A–C without changing the normal launcher.
2. If any gate fails, implement only the polished two-choice/fallback explanation
   and stop; do not pursue invasive alternatives.
3. If all gates pass, build the adapter boundary and fake-transport tests before
   adding the native choice UI.
4. Add the Desktop renderer profile incrementally: Original look, Default, then
   the other seven themes; approve each against the Desktop matrix.
5. Enable the option only for the exact compatibility range proven in release
   testing. Keep **Open Aura web window** as the permanent second path.

This order resolves the central uncertainty first: whether current stock Claude
Desktop provides a safe, consent-based runtime attachment point. UI polish and
theme selector work should not begin until that capability and its policy boundary
are demonstrated.
