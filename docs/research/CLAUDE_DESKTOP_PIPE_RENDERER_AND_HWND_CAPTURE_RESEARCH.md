# Claude Desktop pipe-renderer and exact-HWND capture research - 2026-08-09

Scope: primary Chromium, Electron, and Microsoft sources for one genuinely new,
reversible renderer-access experiment against the stock signed Claude Desktop
MSIX `1.26832.0.0`, plus an exact-HWND GPU presentation fallback. This note did
not stop, launch, debug, capture, or modify Claude. It did not read `app.asar`,
account data, or package files beyond registered manifest metadata.

## Decision

| Candidate | Decision | Reason |
|---|---|---|
| Attach a pipe to the already-running Desktop process | **NO-GO** | Electron starts its pipe handler from a startup command-line switch. Windows cannot retrofit the required inherited pipe handles into a handler that was never started. |
| AUMID activation plus `--remote-debugging-pipe` | **NO-GO** | `ActivateApplication` accepts an AUMID, argument string, options, and returned PID; it has no handle-inheritance channel. Chromium's Windows pipe requires two handles inherited with the same numeric values. |
| Redirected stdin/stdout alone | **NO-GO** | The default Chromium transport reads CRT descriptors 3 and 4, not standard descriptors 0 and 1. Current Windows Chromium instead supports two explicit inherited handles through `--remote-debugging-io-pipes`. |
| Direct `CreateProcessW` of the exact signed package executable with two explicitly inherited handles | **CONDITIONAL GO for one source-only startup handshake** | This is the only bounded mechanism found that can satisfy Chromium's actual Windows pipe contract without a TCP listener or binary/package edit. It is not registered-app activation and is not a supported product route; exact package/AUMID identity and visible-window behavior must pass live or the route stops immediately. |
| Windows Graphics Capture plus a D3D11 shader | **CONDITIONAL GO as a presentation fallback; NO-GO as renderer injection** | It can capture one exact HWND into GPU surfaces and render a transformed GPU-only copy without CPU readback. It still captures pixels, adds frame latency, and cannot semantically restyle DOM, typography, or layout. |

The recommended next experiment is therefore a **pipe-handshake gate only**.
Do not combine first contact with CSS injection. A successful pipe handshake
would open a separate, explicitly approved renderer-marker gate; it would not
by itself prove safe theme injection or parity.

## Current local boundary

A fresh read-only capability probe reported the current-user installation as:

- signed MSIX `1.26832.0.0`;
- AUMID `Claude_pzs8sxrjxfjjc!Claude`; and
- already running at the time of research.

A separate registered-manifest query reported
`Executable="app\\Claude.exe"`, `EntryPoint="Windows.FullTrustApplication"`,
and zero `windows.appExecutionAlias` declarations. Its registered extension
categories were protocol, service, and startup task only. The current runbook
records that AUMID activation with `--remote-debugging-port` produced no
verified IPv4 or IPv6 endpoint, and that the distinct Node main-process
`--inspect` route was unavailable. This note does not reinterpret either
negative result as renderer evidence.

## What is genuinely new

### The Windows pipe contract is not ordinary stdio

Chromium's public `DevToolsAgentHost` contract defines descriptor 3 as the
DevTools input and descriptor 4 as its output. A Chromium hardening change
explains why those descriptors are checked early: starting with
`--remote-debugging-pipe` when the parent did not supply them could otherwise
make the protocol parser read or write unrelated files. [Chromium public
contract](https://chromium.googlesource.com/chromium/src/+/master/content/public/browser/devtools_agent_host.h),
[Chromium descriptor-preflight change](https://chromium.googlesource.com/chromium/src/+/e972c575b9a075ab5dcadddf269d60bb23d4af35)

Current Chromium has a Windows-specific alternative. The parent serializes two
anonymous-pipe `HANDLE` values as unsigned integers in
`--remote-debugging-io-pipes=<input>,<output>`. Chromium verifies that each
value names a pipe, converts the handles to CRT descriptors, and gives them to
the DevTools pipe handler. The implementation explicitly relies on inherited
handles having the same value and access rights in the child. [Chromium pipe
adoption source](https://chromium.googlesource.com/chromium/src/+/refs/tags/134.0.6998.1/content/browser/devtools/devtools_agent_host_impl.cc),
[Chromium switch definition](https://chromium.googlesource.com/chromium/src/+/refs/heads/main/content/public/common/content_switches.cc)

ChromeDriver's first-party implementation shows the complete Windows pattern:
create two anonymous pipes, serialize only the two child-end handle values,
append `remote-debugging-io-pipes`, and put those exact handles in the child's
inherit list. [Chromium ChromeDriver pipe builder](https://chromium.googlesource.com/chromium/src/+/main/chrome/test/chromedriver/net/pipe_builder.cc)

The default protocol is NUL-terminated JSON. Chromium's writer appends one
zero byte after every message; no HTTP server, WebSocket endpoint, or TCP
listener is involved. [Chromium pipe handler](https://chromium.googlesource.com/chromium/src/+/main/content/browser/devtools/devtools_pipe_handler.cc)

### Electron has a native renderer-pipe path

Current upstream Electron checks for `--remote-debugging-pipe` in native
browser startup and calls Chromium's `StartRemoteDebuggingPipeHandler`. This is
separate from the Node/V8 `--inspect` listener. Electron's current disconnect
callback also requests browser quit, so controller loss can terminate the app;
that lifecycle coupling is a mandatory live check, not an implementation
detail to hide. [Electron browser-main source](https://github.com/electron/electron/blob/main/shell/browser/electron_browser_main_parts.cc)

Electron documents `nodeCliInspect` as a package-time fuse controlling
`--inspect`, `--inspect-brk`, and related Node inspector switches. Its current
fuse list does not define a corresponding Chromium remote-debugging fuse, and
the pipe handler is native rather than `require('electron')`-based. Therefore a
disabled `nodeCliInspect` fuse can explain a failed main-inspector route without
logically disabling the Chromium pipe route. This does **not** prove that
Claude's embedded Electron/Chromium revision includes the Windows handle
switch or leaves it usable; only a live pipe response proves that for
`1.26832.0.0`. [Electron fuses](https://www.electronjs.org/docs/latest/tutorial/fuses),
[Electron command-line switches](https://www.electronjs.org/docs/latest/api/command-line-switches)

No fuse should be read or changed in Claude's binary for this experiment.
Electron states that fuses are flipped before code signing; changing one would
edit the signed executable and cross the package-integrity boundary.

## Why the allowed launch routes do not carry the pipe

### Registered AUMID activation: no handle channel

`IApplicationActivationManager::ActivateApplication` exposes only the AUMID,
an app-specific argument string, activation options, and an output PID. It has
no `STARTUPINFOEX`, inheritance boolean, or handle list. Passing two handle
numbers as text is insufficient because those numbers are meaningful only if
the same handles exist in the activated process. [`ActivateApplication`](https://learn.microsoft.com/en-us/windows/win32/api/shobjidl_core/nf-shobjidl_core-iapplicationactivationmanager-activateapplication)

This is a contract-level NO-GO, not another launch attempt. The activation
broker is not required to inherit arbitrary handles from Aura, and relying on
an undocumented accidental inheritance path would fail the exact-ownership
and repeatability gates.

### `Invoke-CommandInDesktopPackage`: not authoritative

Microsoft describes `Invoke-CommandInDesktopPackage` as a troubleshooting
tool whose process token is similar to, but not identical to, a real AppId
process. It exposes only command and argument parameters, makes no handle
inheritance promise, and explicitly says not to rely on its undefined side
effects. Wrapping another launcher inside this debugging context would add a
second ambiguous process boundary without turning it into registered app
activation. [Microsoft cmdlet reference](https://learn.microsoft.com/en-us/powershell/module/appx/invoke-commandindesktoppackage)

### Direct process creation: viable only as a proof gate

`CreateProcessW` can inherit handles with the same values and access rights
when `bInheritHandles` is true. `STARTUPINFOEX` plus
`PROC_THREAD_ATTRIBUTE_HANDLE_LIST` can constrain inheritance to an explicit
list, preventing unrelated inheritable handles from leaking into Claude.
[Microsoft `CreateProcess`](https://learn.microsoft.com/en-us/windows/win32/api/processthreadsapi/nf-processthreadsapi-createprocessw)

That supplies the missing transport, but it is not the documented AUMID
activation route. Microsoft separately warns in its package-identity debugging
guidance that directly launching an executable cannot generally be assumed to
reproduce AUMID activation identity; development tools create a separate debug
identity when they need that property. Creating such an identity would change
registration state and is outside this experiment. [Microsoft package-identity
debugging guidance](https://learn.microsoft.com/en-us/windows/apps/dev-tools/winapp-cli/debugging)

Accordingly, a direct launch is accepted only if the resulting exact process
independently reports the expected package full name and AUMID, retains the
valid Anthropic signature, and owns the one visible Claude window.
`GetPackageFullName` and `GetApplicationUserModelId` are the documented
read-only process checks. [`GetPackageFullName`](https://learn.microsoft.com/en-us/windows/win32/api/appmodel/nf-appmodel-getpackagefullname),
[`GetApplicationUserModelId`](https://learn.microsoft.com/en-us/windows/win32/api/appmodel/nf-appmodel-getapplicationusermodelid)

## Existing-window attach remains NO-GO

The pipe handler is selected during Electron browser startup. Neither adding a
command-line switch after creation nor duplicating a handle into a running
process starts that handler. AUMID activation of an already-running
single-instance app is also ambiguous: it can redirect activation to the
existing process rather than create the handle-bearing child.

Electron's in-process alternative, `webContents.debugger`, is available only
from a main-process `WebContents` object; its `Debugger` class is not exported
as a separately constructible external API. `webContents.insertCSS` and its
reversible key likewise require main-process cooperation. [Electron
`Debugger`](https://www.electronjs.org/docs/latest/api/debugger), [Electron
`webContents`](https://www.electronjs.org/docs/latest/api/web-contents)

Native debugger attachment, DLL injection, IFEO, package-debug settings,
sparse debug identities, preload shims, and `app.asar` edits do not create a
supported external renderer channel within the stated boundary. They are not
fallback attempts.

## Gate P0 - exact pipe-handshake protocol

This is a protocol recommendation, not a completed live result.

1. Obtain action-time approval. Exit Claude through its own **File > Exit**
   command and require zero matching processes. Do not terminate by name.
2. Re-run the schema-2 capability probe. Require exactly MSIX
   `1.26832.0.0`, AUMID `Claude_pzs8sxrjxfjjc!Claude`, expected package family,
   and a valid signature. Resolve the executable from registered package
   metadata; never hard-code a mutable WindowsApps path.
3. Create two anonymous pipes. Make only the child read end and child write end
   inheritable. Clear inheritance on both parent ends.
4. Build one `STARTUPINFOEX` attribute list containing exactly those two child
   handles. Call `CreateProcessW` with an explicit application path, a mutable
   quoted command line, `bInheritHandles=TRUE`, and only:

   ```text
   --remote-debugging-pipe
   --remote-debugging-io-pipes=<child-read-handle>,<child-write-handle>
   ```

   Do not pass `--remote-debugging-port`, `--inspect`, `--user-data-dir`,
   `--no-sandbox`, logging, proxy, certificate, profile, or debugging-address
   switches. Do not redirect standard input/output; they are unrelated to this
   transport.
5. Before sending a protocol message, bind the returned process handle to its
   creation time, exact executable, signature, package full name, AUMID, and
   one visible top-level HWND. Reject a launcher handoff, missing identity,
   second instance, unexpected child owner, hidden/windowless result, or any
   TCP debugging listener.
6. Send exactly one NUL-terminated `Browser.getVersion` request and accept one
   response with the matching numeric request ID. Retain only schema booleans
   and version fields; never retain the raw response. Send no `Target`,
   `Runtime`, `Page`, `DOM`, `Network`, `Storage`, `Fetch`, or capture command in
   Gate P0.
7. Let the user exit normally. Require pipe EOF, zero exact processes, closed
   handles, and no helper. Relaunch once through the ordinary registered AUMID
   and verify that stock Claude is visible and no TCP or pipe controller is
   present.

### P0 GO evidence

GO requires all of these in one run:

- exact version/signature/package/AUMID/process/HWND booleans are true;
- exactly two intended handles were inherited;
- one valid, request-ID-matched browser response arrived through the private
  pipe;
- no loopback, wildcard, or non-loopback debugging listener existed;
- no account/target command was sent and no raw protocol payload was retained;
- normal Exit closed the pipe and process; and
- an ordinary AUMID relaunch returned to stock behavior.

Any failed identity check, missing response, process handoff, unexpected
listener, unproven cleanup, or stock-relaunch difference makes the route
**NO-GO for `1.26832.0.0`**. Do not retry with broader switches or package
state changes.

## Gate P1 - renderer marker only after P0

Pipe success grants powerful browser-level CDP access. It does not authorize
reading renderer content. A separate marker gate may use server-side
`Target.setAutoAttach` filtering for `page` targets and extract only ephemeral
session IDs. Standard Target events still contain `TargetInfo`, including URL
and title fields. A compliant streaming parser must skip and immediately
discard those fields without comparing, logging, hashing, or returning them.
If mere receipt of those bytes is considered account-content access, P1 is
**NO-GO**; public CDP target discovery does not offer a field-redaction option.
[CDP Target domain](https://chromedevtools.github.io/devtools-protocol/tot/Target/)

If that boundary is approved, the first marker must be fixed code that:

- gates internally on `https:` plus exact hostname `claude.ai` and returns only
  a boolean;
- adds one namespaced inert style/attribute and no script-visible API;
- reads no text, value, title, URL path, IDs, cookies, storage, clipboard,
  network data, console output, accessibility data, or files;
- uses no Network, Storage, DOMSnapshot, Fetch, download, screenshot, or
  tracing domain; and
- removes its exact style/attribute and any new-document script before normal
  Exit.

Visible marker application plus verified removal would prove reversible CSS
injection for one build and state only. It would not prove route coverage,
theme parity, update compatibility, policy approval, or release readiness.

## Exact-HWND GPU fallback

### What Windows Graphics Capture can do

`IGraphicsCaptureItemInterop::CreateForWindow` creates a capture item for one
specified HWND and is available from Windows 10 version 1903. This is materially
stronger target isolation than the current Magnification fallback, whose source
is a desktop rectangle and can include a foreign occluder. [`CreateForWindow`](https://learn.microsoft.com/en-us/windows/win32/api/windows.graphics.capture.interop/nf-windows-graphics-capture-interop-igraphicscaptureiteminterop-createforwindow)

Windows delivers each frame as a `Direct3D11CaptureFrame` with a Direct3D
surface. Microsoft's Win32 HWND sample obtains the frame's `ID3D11Texture2D`,
copies it into a DXGI swap-chain back buffer, and presents it through Windows
Composition. `ID3D11DeviceContext::CopyResource` explicitly performs its copy
on the GPU. [Microsoft screen-capture guidance](https://learn.microsoft.com/en-us/windows/apps/develop/media-authoring-processing/screen-capture),
[frame-surface API](https://learn.microsoft.com/en-us/uwp/api/windows.graphics.capture.direct3d11captureframe.surface),
[Direct3D/DXGI surface interop](https://learn.microsoft.com/en-us/windows/win32/api/windows.graphics.directx.direct3d11.interop/nf-windows-graphics-directx-direct3d11-interop-idirect3ddxgiinterfaceaccess-getinterface),
[Microsoft HWND capture sample](https://github.com/microsoft/Windows.UI.Composition-Win32-Samples/blob/master/cpp/ScreenCaptureforHWND/ScreenCaptureforHWND/SimpleCapture.cpp),
[`CopyResource`](https://learn.microsoft.com/en-us/windows/win32/api/d3d11/nf-d3d11-id3d11devicecontext-copyresource)

A bounded Aura variant can keep the pipeline GPU-only:

1. Create the capture item from the already signature/PID-bound Claude HWND.
2. Receive the frame surface, GPU-copy it into an Aura-owned default-usage
   shader-resource texture, run a D3D11 pixel shader into a swap-chain render
   target, and present that swap chain in a click-through, no-activate overlay.
   Use only GPU-default resources and an HWND swap chain. [`D3D11_USAGE_DEFAULT`](https://learn.microsoft.com/en-us/windows/win32/api/d3d11/ne-d3d11-d3d11_usage),
   [`CreateSwapChainForHwnd`](https://learn.microsoft.com/en-us/windows/win32/api/dxgi1_2/nf-dxgi1_2-idxgifactory2-createswapchainforhwnd)
3. Never create a staging or CPU-readable texture; never call `Map`, WIC, PNG,
   video encoding, screenshot, or save APIs; never retain a frame after present.
4. Set `IsCursorCaptureEnabled=false` where supported so the real underlying
   cursor is not duplicated. [Cursor-capture control](https://learn.microsoft.com/en-us/uwp/api/windows.graphics.capture.graphicscapturesession.iscursorcaptureenabled)
5. Keep the system capture border. Disabling it requires an explicit
   `GraphicsCaptureAccessKind.Borderless` consent request and a
   `graphicsCaptureWithoutBorder` package capability; that is outside the
   current source-only helper. [Borderless-capture consent](https://learn.microsoft.com/en-us/uwp/api/windows.graphics.capture.graphicscapturesession.isborderrequired)

This can support a global color matrix, multi-pass blur, tonal mapping, and
GPU-composited Aura artwork over the exact window. It cannot identify native
Claude components, alter DOM layout, change typography, restyle menus, or
react semantically to page context. It is a transformed mirror with capture
latency, not an in-place renderer effect.

### Capture privacy and evidence boundary

This route must never be described as “no pixel access.” Windows Graphics
Capture places the exact Claude pixels in GPU resources owned by the helper.
The narrower truthful claim is:

> exact-HWND Windows capture; GPU-only transform and presentation; no CPU
> mapping, readback, encoding, retention, network transfer, or saved frame.

That claim needs both static API auditing and a live gate. Stop on black or
protected content, stale frames, capture-border failure, cursor duplication,
focus/input interception, material latency, size/DPI mismatch, target identity
change, frame retention, device loss without clean recovery, or incomplete
cleanup. Closing the session, frame pool, D3D resources, swap chain, and overlay
must immediately reveal untouched stock Claude.

Passing this fallback gate would prove exact-HWND GPU presentation on the one
tested display and build. It would not prove renderer injection, account-data
privacy equivalent to the current no-pixel-readback Magnification path, or
Claude Aura Web-level visual parity.

## Final recommendation

1. **Implement Gate P0 only** as a source-only native launcher/controller. It is
   the sole new renderer-capable transport with a concrete Windows handle
   contract.
2. If P0 passes, stop and record it before seeking separate approval for P1's
   unavoidable TargetInfo-receipt boundary.
3. In parallel product direction, treat exact-HWND Windows Graphics Capture as
   the next presentation experiment only if its weaker pixel-privacy boundary
   is acceptable. Keep it explicitly separate from renderer access.
4. Keep production, installer, archive, ordinary shortcut, package, profile,
   and stock AUMID launches unchanged until renderer compatibility, privacy,
   policy, update, and cleanup gates all pass.

## Implementation follow-up - 2026-08-09

Later owner-authorized inspection and live implementation changed both
candidate decisions for the installed build:

- The signed app's startup source explicitly rejects both remote-debugging
  port and pipe arguments unless `CLAUDE_CDP_AUTH` carries a short-lived token
  valid for the exact user-data path under an embedded Anthropic public key.
  The executable also has Electron's Node CLI inspect fuse disabled. Therefore
  direct `CreateProcessW` pipe launch is **NO-GO for `1.26832.0.0`** without a
  package change or unavailable private signature; neither is authorized.
- The exact-HWND fallback was implemented in
  `windows/native/desktop-capture-filter.cpp` with a hash-pinned local builder.
  It uses `CreateForWindow`, a free-threaded Direct3D11 frame pool, GPU default
  resources, a D3D11 shader, and a click-through/no-activate topmost swap-chain
  window. Static audit found no CPU mapping or screenshot path.
- A bounded signed-window Light run reported exact-HWND isolation, GPU pixel
  transformation, one presented frame, zero readback, valid evidence, and clean
  shutdown. Three independent start/stop cycles passed. A live rail sequence
  switched theme, resized to 1400x820, selected Dark, restored the exact window
  placement, then restored Original. The final readiness-hardened run produced
  three helper starts, seven valid frames, zero failures, and complete cleanup.
- Original look starts no helper and reports backend/source `none`. The earlier
  Magnifier desktop-rectangle implementation remains only a fail-open fallback.
- The schema-5 continuation supplies the shader with all seven validated
  appearance roles: canvas, sidebar, surface, raised, text, border, and accent.
  It separates flat neutral regions from edge detail and performs a stronger
  neutral remap in Dark. A Korean Prestige Light-to-Dark-to-Original live run
  reported valid mapping/remap evidence, two successful GPU starts, zero
  failures, no readback, and clean removal. Four fixed content-blind points
  changed from average luminance 248.98 to 52.24; no screenshot was retained.
- A single optimized runtime traversal then exercised all eight built-ins in
  Light and Dark before Original. It recorded 16 successful GPU starts/frames,
  14/14 artwork renders, 16/16 identity renders, and no visual-channel failures.
  Light states ranged from 229.85 to 251.24 average luminance and Dark states
  from 52.24 to 65.03. No image or readable content was retained.
- The schema-6 refinement expanded the bounded helper input to 13 semantic
  colors plus panel/sidebar alpha, with continuous source-tone text coverage
  and no wide spatial samples. A fresh transient all-theme Light/Dark cycle
  recorded 16 GPU starts, 17 frames, all 14 artwork and 16 identity states,
  zero visual-channel failures, and complete Original-look cleanup. Temporary
  full-screen QA captures used for visual critique were removed afterward.

The resulting claim is exact-HWND GPU presentation with heuristic 13-color
semantic/surface mapping and two translucency roles on this build and available
200%-DPI display. It is not
DOM access, semantic component styling, renderer injection, multimonitor
evidence, or release approval.
