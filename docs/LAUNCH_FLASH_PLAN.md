# Launch loading-screen flash: investigation and implementation plan

## Decision status

This document is a plan only. It does not change launch behavior.

The present blocker is not a missing loading design. Aura already has a themed
native cover and a document-start theme prepaint. The blocker is that there is
no frame-level evidence identifying **which rendering boundary flashes** on the
affected Windows machine. Three independently rendered surfaces meet during
startup:

1. the WinForms form and `LoadingPanel`;
2. the WebView2 controller surface; and
3. the first `claude.ai` document, followed by Aura's prepaint/full-renderer
   handoff.

Source inspection can identify races across those boundaries, but it cannot
prove whether the reported frame is the form's initial default paint, the
WebView2 controller's default background, unthemed Claude, or a cover repaint.
Implementing visual changes before that distinction is measured risks hiding
one transition while adding another.

This distinction changes the implementation. A native-frame defect is fixed by
preparing and gating HWND/controller visibility. A document-frame defect is
fixed by moving trusted theme initialization earlier. Treating both as a CSS
problem, adding an arbitrary delay, or making the loader more elaborate cannot
establish either guarantee.

## What the current launch path does

- The form and WebView start with a hard-coded light `#F4F1EA` background.
- `Update-AuraUiLoadingTheme` derives the selected theme's effective palette,
  updates native window chrome, form, WebView, and cover colors, creates the
  cover bitmap, and invalidates the panel.
- The WebView and loading panel are fill-docked siblings. The panel is placed
  last and brought forward, but the WebView remains visible for its complete
  environment/controller initialization and navigation lifecycle.
- The form's `Shown` handler calls `Show-AuraUiLoading`, which recomputes the
  theme/bitmap once more after the native window is already eligible to paint.
- WebView2 is then initialized asynchronously. Aura registers
  `renderer-prepaint.js` with
  `AddScriptToExecuteOnDocumentCreatedAsync` before initial navigation, with a
  1.5-second fail-open deadline.
- A successful Claude `NavigationCompleted` hides the native cover immediately.
  The semantic renderer is applied only after a further 360 ms response-marker
  verification turn. The document-start prepaint is intended to bridge this
  interval.

The prepaint protects the **document styling boundary**. It cannot color the
WebView2 controller before a document exists, prevent a native sibling/child
window z-order frame, or make the WinForms cover's first bitmap paint atomic.

## Most likely causes, in priority order

### P0 — visible WebView2 controller during covered startup

The WebView control is never made invisible while `LoadingPanel` is visible.
`BringToFront()` expresses WinForms z-order intent, but it is not an explicit
startup visibility contract for the separately rendered WebView2 surface. When
the controller is created, resized, or navigated, one controller-colored frame
can become observable before the next native cover paint.

**Expected signature:** a white or WebView-colored whole-content flash around
controller creation, before Claude content is usable.

### P0 — controller background is never set

Setting `WebView2.BackColor` colors the WinForms control; it does not establish
the WebView2 controller's composition background. Aura never sets
`CoreWebView2Controller.DefaultBackgroundColor`. Microsoft documents that
controller property as the color shown behind web content and notes that its
default is white. See the official
[`DefaultBackgroundColor` documentation](https://learn.microsoft.com/dotnet/api/microsoft.web.webview2.core.corewebview2controller.defaultbackgroundcolor).

**Expected signature:** a white frame after controller initialization or during
top-level navigation even though the native cover itself has the correct theme.

### P1 — the cover is materially rebuilt after the form becomes visible

The cover is themed during construction and then themed again from
`Show-AuraUiLoading` in `Shown`. Each pass can replace the mark and full-window
bitmap, update window chrome, and invalidate controls. The second pass adds an
avoidable first-frame race and synchronous full-window bitmap allocation on the
UI thread.

**Expected signature:** a brief hard-coded/default or blank native cover,
followed by the selected themed cover before WebView content appears.

### P1 — reveal is tied to navigation, not to a painted theme sentinel

`NavigationCompleted` means navigation completed; it does not prove the first
themed document frame has been presented. Aura hides the cover before the full
renderer is allowed to run and assumes document-start prepaint has painted.
Registration can deliberately fail open after 1.5 seconds, so this assumption
is not guaranteed.

**Expected signature:** Claude's default canvas or unthemed UI flashes between
the loading cover and the themed page. The existing 360 ms verification delay
does not prevent it because the cover is already hidden.

### P2 — appearance resolution changes during startup

The initial form/WebView fallback is always light, while the actual loading
profile may be dark or follow system appearance. If theme/config loading happens
after handle creation on a slower machine, the mismatch makes even a single
native frame conspicuous.

## Critique of the first proposal

The first version of this plan pointed in the correct direction but asserted
more certainty than the available evidence supports. The implementation must
account for the following weaknesses before work begins:

1. **`Visible = false` is a candidate, not yet a proven universal fix.** It gives
   a strong host-side invariant, but WebView2 can reduce work for a hidden
   controller. A reveal protocol that depends on `requestAnimationFrame` while
   the controller is hidden can deadlock or wait for the timeout on every
   launch. The readiness signal must therefore be synchronous after passive DOM
   installation and must not claim that a frame was presented.
2. **A JavaScript message has no intrinsic navigation ID.** A document can echo
   a digest and registration generation, but those values alone do not bind the
   message to the host's active top-level navigation. The host must combine
   trusted `Source`, active navigation state, and a host-generated per-navigation
   nonce that document-start code receives. If the SDK event does not expose a
   trustworthy source for this version, do not use the message as a security
   decision; use it only as a visual optimization behind existing response
   verification.
3. **`NavigationCompleted` plus prepaint-ready still does not prove physical
   presentation.** Neither WebView2 event nor JavaScript execution confirms that
   DWM displayed a pixel. The realistic guarantee is narrower: the controller
   background and first eligible document are color-compatible and fully styled
   before the host makes the controller visible. Frame capture remains the only
   acceptance proof for the reported visual defect.
4. **WinForms `SuspendLayout` is not a compositor transaction.** It reduces
   managed layout churn but cannot make the WebView2 and WinForms HWNDs switch in
   the same DWM commit. It should be used for efficiency, not described as
   atomic presentation.
5. **Reflection is already a compatibility liability.** Aura currently reaches
   the controller's private field for accelerators. Reusing that path for a
   correctness-critical background increases SDK fragility. First test whether
   the pinned WinForms control exposes `DefaultBackgroundColor` publicly; if
   not, isolate reflection in one capability probe with a safe fallback and a
   versioned regression.
6. **A 1.5-second timeout is a ceiling, not a smoothing technique.** Arbitrary
   waits make fast launches slower and slow launches no safer. Every wait needs
   a named prerequisite, monotonic deadline, cancellation on superseding
   navigation, and an explicit timeout disposition.

These criticisms change the recommendation from “build the entire state machine
and acknowledgement immediately” to a measured escalation ladder: first remove
the two native color/repaint mismatches, then add visibility gating, and add a
document acknowledgement only if frame evidence proves it is still necessary.

## Phase 1: obtain the missing evidence

Do this before selecting a fix variant.

1. Add a development-only launch trace behind `CLAUDE_AURA_LAUNCH_TRACE=1`.
   Write monotonic elapsed milliseconds, UTC time, theme, effective appearance,
   form handle state, form/WebView/cover visibility, client size, and navigation
   ID for these events:
   `HandleCreated`, `Shown`, environment completion, controller completion,
   prepaint registration start/result/timeout, `NavigationStarting`, main
   document response, `DOMContentLoaded`, `NavigationCompleted`, prepaint-ready
   acknowledgement, full-renderer acknowledgement, and cover reveal. Never log
   full URLs, query strings, document text, cookies, or payload artwork.
2. Add a development-only 4 px corner marker to the native cover and distinct
   solid diagnostic colors for the WinForms host, WebView controller, prepaint,
   and semantic renderer. This makes every captured frame attributable without
   exposing page content. Do not ship the markers.
3. Capture cold starts at 60 fps or higher on the affected device for light,
   dark, and system appearance at 100%, 150%, and 200% scaling. Include a warm
   start and a throttled/offline start. Record the first visible frame through
   the first stable themed frame.
4. Correlate frame timestamps with the trace and classify the flash as
   **native-before-cover**, **controller**, **document-before-prepaint**, or
   **prepaint-to-renderer**. A fix may proceed only when at least two cold-start
   recordings reproduce the same class.
5. Run one-factor probes before production changes:
   - set only the controller background;
   - remove only the second loading-theme rebuild;
   - hide only the WebView until `NavigationCompleted`;
   - retain current behavior as the control.
   Capture at least ten cold starts per probe. This distinguishes a causal fix
   from a run that merely happened not to reproduce the race.

Deliverable: `dist/verify/live-aura/launch-flash/<run>/` containing the local
trace, recording/frame strip, OS build, WebView2 runtime version, GPU name,
scaling, appearance, theme, and classification. Keep this evidence out of the
release package and Git.

## Phase 2: implement the minimum proven correction

Implement the following in `windows/aura-ui.ps1`; do not add fades or a second
splash window.

### 2.1 Introduce a small launch-visual state machine

Add `Set-AuraUiLaunchVisualState` with exactly these states:

- `CoverPrepared`: selected loading profile and bitmap are complete; WebView is
  hidden; cover is visible and frontmost.
- `ControllerCovered`: controller exists, its default background matches the
  active cover, and WebView remains hidden.
- `DocumentPrepared`: the current navigation has produced a matching
  document-start ready acknowledgement, or Aura has selected an explicit
  fail-open disposition.
- `Revealed`: WebView is visible and cover is hidden in the same UI-thread turn.
- `Failure`: WebView remains hidden and the cover shows its retry state.

Make transitions idempotent and navigation-ID/generation scoped. Route
`Show-AuraUiLoading`, `Hide-AuraUiLoading`, retry, rescue, process failure, and
window reopen through the state machine. Reject stale navigation completions.

Use a pure transition function that returns effects rather than directly
mutating controls. Keep the mutable shell thin:

```text
reduceLaunchVisual(state, event) -> { nextState, effects[] }

effects = PrepareCover | SetControllerColor | SetWebViewVisible |
          SetCoverVisible | StartDeadline | CancelDeadline |
          ShowRetry | EnterRescue | MeasureLauncher
```

This makes illegal transitions testable without WebView2 and prevents event
handlers from independently hiding the cover. The host applies effects on its
UI thread and checks the active generation again immediately before each async
completion is reduced.

| Current state | Accepted event | Next state | Required visible surface |
| --- | --- | --- | --- |
| `CoverPrepared` | controller ready | `ControllerCovered` | cover only |
| `ControllerCovered` | navigation starts | `ControllerCovered` | cover only |
| `ControllerCovered` | document prepared | `DocumentPrepared` | cover only |
| `DocumentPrepared` | valid reveal | `Revealed` | WebView only |
| any covered state | failure | `Failure` | retry cover only |
| any state | newer navigation | `CoverPrepared` | cover only |
| `Revealed` | SPA/history change | `Revealed` | WebView only |

No transition may show both the launcher and cover, reveal a stale generation,
or turn a renderer failure into a loading cover over an already usable page.

### 2.2 Prepare before showing the form

- Resolve the loading profile once after config/themes are loaded but before the
  main form handle is shown.
- Assign the selected background to the form, content panel, WebView host, and
  cover before adding controls or creating the visible handle.
- Build the first cover bitmap before `Form.Show()`/the message loop's first
  presentation. `Shown` should start asynchronous initialization only; it must
  not rebuild the same theme.
- In the first production experiment, set `WebView.Visible = $false` before it
  is added to the content panel. While cover state is active, the controller
  surface is then not displayable regardless of sibling z-order. Promote this
  to the permanent invariant only after the cold-start probe proves that hidden
  initialization still completes reliably on the supported WebView2 runtime.
- If hidden initialization stalls, keep the WebView visible but clipped behind
  an **opaque native sibling with a verified HWND z-order**, and test controller
  creation/resizing. Do not introduce a separate splash window unless both
  in-form options fail; ownership, focus, DPI, taskbar, and shutdown behavior
  make a second window substantially riskier.

This preserves the current premium loading composition and reduces work rather
than adding visual noise.

### 2.3 Color the actual WebView2 controller

Immediately after `EnsureCoreWebView2Async` succeeds and before navigation:

- obtain the controller (use the already guarded controller reflection helper,
  or add one shared helper rather than duplicating reflection);
- set `DefaultBackgroundColor` to the active loading profile background;
- update that color when appearance/theme changes before a navigation reveal;
- log a fixed diagnostic and continue if the pinned SDK/runtime does not expose
  the property.

Cache the last applied ARGB value and write only on change. Convert from the
already validated six-digit theme color to an opaque `Drawing.Color`; never pass
theme text or CSS through this native boundary. Reapply after controller
recreation/process recovery because controller state is not application state.

Keep the WinForms `BackColor` assignment as a fallback, not as the controller
solution. Do not use transparency: opaque theme-matched color is predictable
across GPU/runtime combinations and avoids exposing content underneath.

### 2.4 Add a bounded document-ready acknowledgement

This phase is conditional. Implement it only if native-boundary experiments
still capture an unthemed document frame.

Extend `renderer-prepaint.js` without inspecting Claude's DOM:

- after applying root CSS and mounting the backdrop, synchronously post a
  minimal WebView message
  `{ type: "aura-prepaint-ready", digest, generation, nonce }` once
  `document.body` exists;
- send it only for the current top-level approved Claude origin;
- retain current handoff/cleanup ownership rules.

Do not use `requestAnimationFrame`: a hidden/minimized controller may throttle
it, and the callback would still not prove DWM presentation.

In the host, accept the message only when trusted source origin, active
navigation, payload digest, registration generation, and one-use nonce match.
Consume the nonce so a duplicate cannot advance state. Reveal on the later of
successful `NavigationCompleted` and matching prepaint-ready. The WebView2
message contract and source validation should follow Microsoft's official
[`WebMessageReceived` guidance](https://learn.microsoft.com/dotnet/api/microsoft.web.webview2.core.corewebview2.webmessagereceived).

Use a bounded 1.5-second post-navigation fallback so script registration or
messaging can never strand the cover:

- verified ordinary Claude document: reveal with controller background and log
  `prepaint-ready timeout`;
- verified challenge: clean prepaint, keep existing rescue behavior, then
  reveal the challenge document;
- genuine navigation/process failure: keep the retry cover.

Do not wait for the semantic renderer. The passive prepaint is the reveal
sentinel; response verification and full injection remain fail-open and keep
their current security boundary.

### 2.5 Reveal in one bounded UI turn, without animation

On one WinForms UI-thread callback:

1. suspend content layout;
2. confirm cover/state/navigation invariants;
3. make WebView visible;
4. hide the cover;
5. resume layout once and invalidate the content panel;
6. update launcher position only after reveal.

Call this a **single-turn reveal**, not an atomic compositor swap. Instrument the
time from visibility mutation to the next UI timer turn and use frame capture to
verify the result. If a controller-colored frame remains, keep its color equal
to the cover so the compositor boundary is visually continuous.

Do not crossfade. Opacity animation would composite two expensive surfaces,
increase motion, and make the race longer. One deliberate cut between identical
background/theme frames is simpler and more polished.

## Phase 3: regression coverage

### Automated source/state tests

Extend `tests/prepaint.test.mjs` and the Windows lifecycle tests to prove:

- the WebView starts hidden and cannot become visible in any covered/failure
  state;
- cover preparation occurs before the form's first show;
- controller background is assigned before initial navigation;
- navigation cannot reveal until both navigation completion and the matching
  prepaint acknowledgement are present;
- stale digest, generation, origin, and navigation acknowledgements are ignored;
- the bounded timeout reveals a genuine Claude page but not a failed page;
- challenge cleanup/rescue remains ahead of reveal;
- theme disabled/original-look, sign-in redirects, retry, process failure,
  window reopen, Studio-only launch, and clean rescue session preserve current
  behavior;
- high contrast and reduced motion remain static and readable;
- each transition produces only one cover bitmap replacement and one reveal.

Add a pure transition helper if necessary so ordering can be exercised on
non-Windows CI; retain PowerShell source assertions for WebView2 event wiring.

### Deterministic event-order tests

Table-drive permutations instead of testing only the happy path:

- controller completion before/after cover preparation;
- prepaint registration completion, rejection, and timeout;
- `NavigationCompleted` before/after readiness;
- two overlapping navigations whose older events complete last;
- retry followed by success, retry followed by process failure;
- challenge response before/after navigation completion;
- close/minimize/reopen during every covered state;
- theme or system-appearance change during controller initialization.

For each permutation assert the complete effect sequence, final state, maximum
one reveal, no stale deadline, and no moment where neither cover nor an approved
WebView surface is intended to be visible.

### Performance and smoothness budgets

Record these budgets in the evidence manifest; a visually correct fix that
regresses startup responsiveness does not pass:

- no synchronous file or image decode added to the `Shown` handler;
- no repeated full-window bitmap creation when theme, size, and DPI are
  unchanged;
- loading animation timer work below 2 ms at the 95th percentile on the test
  machine;
- no more than one cover-to-WebView visibility transition per navigation;
- no fixed delay on the successful fast path;
- no increase greater than 100 ms in median time-to-usable across 30 warm starts
  compared with baseline, and report the 95th percentile rather than hiding
  outliers in an average;
- working set and WebView process count return to baseline after retry/process
  recovery.

Use ETW/WPR with the **GPU Activity**, **DWM Core**, **Win32k**, and **Edge/WebView2**
providers for anomalous runs, then inspect in Windows Performance Analyzer. The
screen recording proves the symptom; ETW establishes whether UI-thread work,
HWND presentation, or WebView rendering caused it.

### Concrete implementation map

Keep the patch localized and auditable:

| File/area | Planned responsibility |
| --- | --- |
| `windows/aura-ui.ps1` startup state declarations | generation, nonce, deadline, state, and last controller color only |
| `Get-AuraUiLoadingProfile` | remain the single color/profile source; no WebView side effects |
| `Update-AuraUiLoadingTheme` | update cached native assets only when profile/size/DPI fingerprint changes |
| `Show-AuraUiLoading` / `Hide-AuraUiLoading` | become reducer event adapters; no independent visibility decisions |
| environment/ensure completion | capability-probe and set controller background before navigation |
| navigation/response/process handlers | emit typed reducer events with active generation; preserve rescue verification |
| `assets/renderer-prepaint.js` | optional one-shot, passive readiness message; no Claude DOM query |
| `tests/prepaint.test.mjs` | origin/digest/generation/nonce and passive-script contract |
| Windows lifecycle test module | reducer permutations, deadline cancellation, and source-wiring assertions |

Use `System.Diagnostics.Stopwatch.GetTimestamp()` for monotonic trace ordering and
convert ticks only when writing the trace. Use the existing WinForms timer to
drain completed tasks/deadlines; do not add blocking `.Wait()`, `.Result`, sleep,
polling thread, or nested message loop. Dispose replaced bitmaps only after they
are detached from controls, as the current code does, and make cleanup safe to
call twice.

### Rollout and rollback

Ship the work behind one temporary local capability switch for installed smoke
testing, with the old path remaining intact for one release candidate. The
switch chooses a complete launch protocol; it must not mix old hide/show calls
with the new reducer. Record only the selected protocol name in diagnostics.

Promote the new protocol to default after the acceptance rule passes, then
remove the switch and old path in the next cleanup change. If crash-free launch,
time-to-usable, sign-in completion, or rescue success regresses, rollback the
protocol as a unit rather than disabling individual guards. Controller-color
matching is safe to retain independently because it does not alter navigation
or security decisions.

Trace and diagnostic markers must be compile/package-audited as inert by
default. Unknown environment values mean disabled. Trace write failure must be
ignored after one fixed log entry and must never change launch state.

### Required Windows acceptance matrix

Pass all of the following with no unmatched-color or unthemed frame in a 60 fps
frame-by-frame review:

| Path | Variants |
| --- | --- |
| Cold/warm launch | light, dark, system; built-in and user theme |
| Display | 100%, 150%, 200%; compact and spacious saved window |
| Runtime | current Evergreen WebView2; software rendering if available |
| Network | normal, throttled, offline/retry |
| Identity | enabled, original look, high contrast, reduced motion |
| Authentication | signed in, signed out, first sign-in return |
| Recovery | challenge/rescue, renderer process failure, reopen from tray |

Also confirm that the launcher remains absent over the cover and appears only
after current geometry is measured, with no regressions to focus, keyboard,
resizing, Studio, or popup sign-in.

### Proven-method acceptance rule

A method is “proven” for this issue only when all four are true:

1. the baseline reproduces the classified flash on the same machine;
2. the one-factor experiment removes that classified frame in ten consecutive
   cold starts without relying on a longer fixed delay;
3. automated ordering/failure tests pass; and
4. the full matrix passes with trace mode disabled in the shipping path.

Passing unit tests alone proves state logic, not smooth presentation. A single
clean recording proves neither reliability nor causality. Conversely, visual
capture without event correlation cannot show which fix should be retained.

## Recommended delivery sequence

1. **Evidence PR:** trace flag, diagnostic markers, and reproducible capture
   instructions only.
2. **Native color PR:** pre-show cover preparation, eliminate duplicate bitmap
   work, and set the controller background. This is the least invasive fix.
3. **Visibility PR:** add the covered-startup state reducer and the winning
   hidden-versus-opaque-sibling experiment.
4. **Document boundary PR:** add nonce-bound prepaint acknowledgement and a
   bounded reveal gate only if recordings still show an unthemed document frame.
5. **Acceptance PR:** automated transition coverage and checked-in textual
   results; keep recordings in the existing ignored verification output.

Do not combine this work with loading-screen redesign, launcher restyling, or
theme schema changes. The goal is one continuous visual surface at launch while
preserving every existing feature and fail-open recovery path.
