# Actual Aura whole-window capture research - 2026-08-09

Scope: first-party Microsoft APIs, documentation, and source for capturing the real PowerShell-hosted WinForms/WebView2 Aura window when the bundled controller does not enumerate it. This note does not change `docs/SCREENSHOT_PLAN.md` or claim that a capture has been performed.

## Decision

**Yes: a compliant capture is technically available without reconstructing the UI.** A visible WinForms form owns a native `HWND`; Windows Graphics Capture can target either a user-selected application window or a specific `HWND` and save the resulting frame as PNG. The controller's missing app/window entry is therefore not, by itself, evidence that Windows cannot capture the form. [WinForms `Control.Handle`](https://learn.microsoft.com/en-us/dotnet/api/system.windows.forms.control.handle), [Windows screen capture](https://learn.microsoft.com/en-us/windows/apps/develop/media-authoring-processing/screen-capture), [`CreateForWindow`](https://learn.microsoft.com/en-us/windows/win32/api/windows.graphics.capture.interop/nf-windows-graphics-capture-interop-igraphicscaptureiteminterop-createforwindow)

The lowest-risk immediate route is the signed Windows **Snipping Tool** in **Window** mode: bring the actual Aura window to the visible desktop, choose Window mode, select Aura, and save the untouched capture. This selection does not depend on the bundled controller's enumeration. For a state involving a separate native popup, dialog, floating launcher, or tray surface, use **Full screen** mode and retain the untouched full-monitor image so every HWND remains in the same real desktop frame. [Microsoft Snipping Tool documentation](https://support.microsoft.com/en-us/windows/apps/use-snipping-tool-to-capture-screenshots)

## Supported repeatable route

For a repeatable capture-only tool, use `Windows.Graphics.Capture` rather than a DOM screenshot or reconstructed page:

1. Call `GraphicsCaptureSession.IsSupported()`.
2. Preferred when a human can select the target: launch `GraphicsCapturePicker`, initialized with the helper's owner HWND, and select the visible **Claude Aura** window. Microsoft documents this as the secure system UI for selecting an application window or display.
3. For deterministic automation, resolve Aura's native top-level `HWND`, then call `IGraphicsCaptureItemInterop::CreateForWindow(hwnd, ...)`. `CreateForWindow` explicitly targets one window and is supported from Windows 10 version 1903, build 18362.
4. Size the frame pool from `GraphicsCaptureItem.Size`, copy only the valid `Direct3D11CaptureFrame.ContentSize`, and save that frame directly as PNG. Do not crop, annotate, composite, or rescale it.

Microsoft's [screen-capture walkthrough](https://learn.microsoft.com/en-us/windows/apps/develop/media-authoring-processing/screen-capture) documents the picker, frame pool, valid-content rectangle, and PNG save path. Microsoft's official [ScreenCaptureforHWND sample](https://github.com/microsoft/Windows.UI.Composition-Win32-Samples/tree/master/cpp/ScreenCaptureforHWND) demonstrates Win32 top-level window enumeration and HWND capture; it also warns that minimized windows are enumerated but not captured.

If direct targeting is required, use native `EnumWindows` rather than the bundled controller's list. `EnumWindows` enumerates top-level desktop-app windows; `GetWindowThreadProcessId` binds a candidate HWND to its creating process. Match the known launched Aura PID, exact title, visible/root status, and non-minimized state. If that does not produce exactly one candidate, stop and use the system picker instead of guessing among PowerShell windows. [`EnumWindows`](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-enumwindows), [`GetWindowThreadProcessId`](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-getwindowthreadprocessid)

Do not repeat the blocked workaround that changes Aura's host ownership. The capture helper, if used, remains external and capture-only; the target stays the installed PowerShell-hosted Aura form.

## Window capture versus monitor capture

`CreateForWindow` targets one HWND. As an implementation inference, a separately owned WinForms dialog, launcher window, system menu, or tray flyout cannot be assumed to be part of that one capture item. For those required states, use the system picker on the display or `CreateForMonitor(HMONITOR)` and retain the untouched monitor frame. Microsoft provides a separate API specifically for a monitor capture item. [`CreateForMonitor`](https://learn.microsoft.com/en-us/windows/win32/api/windows.graphics.capture.interop/nf-windows-graphics-capture-interop-igraphicscaptureiteminterop-createformonitor)

A monitor image can satisfy the existing protocol when it visibly contains the complete Aura title bar, host chrome, WebView bounds, live sidebar, content canvas, and requested popup in one unedited frame. It carries greater privacy exposure, so it belongs only under the gitignored `dist/verify/live-aura/` tree when private account content cannot be excluded.

## Paths that do not satisfy the protocol

- `CoreWebView2.CapturePreviewAsync` captures what the WebView displays. It omits the WinForms title bar and host-owned surfaces, so it remains content-only diagnostic evidence, not whole-window Aura evidence. [WebView2 `CapturePreviewAsync`](https://learn.microsoft.com/en-us/dotnet/api/microsoft.web.webview2.core.corewebview2.capturepreviewasync)
- A DOM/headless screenshot, fixture, offline renderer, asset composite, or manually rebuilt title bar remains forbidden by the existing protocol.
- A stitched image of separately captured HWNDs is edited/composited pixels. Use one monitor frame instead.
- A blank, black, stale, minimized, partially clipped, or content-only result fails. Do not bypass Windows capture protection or weaken the gate.

## Exact evidence boundary

A Snipping Tool or Windows Graphics Capture image is eligible as whole-window actual-Aura evidence only after direct inspection confirms all of the following:

- it is the current installed Aura build, not an older still-running instance;
- the frame shows the complete Aura title bar, WebView bounds, real sidebar, content canvas, and the requested live state on authenticated `claude.ai`;
- the loading cover is gone and the expected theme, appearance, context, and payload digest were confirmed before capture;
- the saved file is the untouched native PNG (or untouched full-monitor capture), with no crop, annotation, reconstruction, stitching, or pixel editing; and
- the adjacent manifest records theme ID, appearance, context, UTC timestamp, commit, payload digest, outer-window pixels, WebView CSS viewport, DPR, display scaling, maximized state, capture path, and file hash.

That artifact proves only the pixels visible in that one captured state. It does not prove animation timing, keyboard order, accessible names, hit testing, restart persistence, failure recovery, or user approval; those require the separate mechanical/accessibility passes and explicit review already required by `docs/SCREENSHOT_PLAN.md`.

## Recommendation

Use Snipping Tool Window mode first for ordinary Aura states because it is signed, user-directed, and requires no new helper or controller enumeration. Use untouched full-screen capture for launcher/native-popup states. If the matrix later needs automation, implement the documented `GraphicsCapturePicker`/`CreateForWindow` path in an external capture-only utility based on Microsoft's sample, but count it as accepted evidence only after a live frame passes every boundary above.
