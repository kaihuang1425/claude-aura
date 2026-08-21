# Claude Desktop Magnification color-effect research - 2026-08-09

Scope: first-party Microsoft documentation for a source-only, reversible color
surface over the stock signed Claude Desktop window. This note does not run the
experiment, change Claude, read account content, or claim visual parity.

## Decision

**Conditional GO for one bounded live prototype. NO-GO as a route to Claude
Aura Web visual parity.**

A native x64 helper can place a windowed Magnifier control over the exact
validated Claude Desktop bounds, use a 1.0 transform, and apply a theme-specific
5-by-5 color matrix. The helper owns the overlay; it does not alter Claude's
window, process, package, DOM, settings, or account. Microsoft explicitly
documents windowed Magnifier controls, 1.0 as an allowed factor, full-window
color effects, layered hosts, and click-through hosts. [Magnification API
overview](https://learn.microsoft.com/en-us/previous-versions/windows/desktop/magapi/magapi-intro),
[`MagSetColorEffect`](https://learn.microsoft.com/en-us/windows/win32/api/magnification/nf-magnification-magsetcoloreffect)

This path can recolor the live client and title bar more deeply than Aura's
current border/halo layer, but its matrix is global. It cannot select DOM
components, change typography or layout, add theme artwork in the renderer, or
react to Claude page context. It is one additional presentation channel, not
renderer injection.

## Documented contract

### Runtime and host

- Call `MagInitialize` before using Magnification APIs and `MagUninitialize`
  when finished. The control class is `WC_MAGNIFIER`; after creating it, call
  `MagSetWindowTransform`. [Initialization and control setup](https://learn.microsoft.com/en-us/previous-versions/windows/desktop/magapi/magapi-intro),
  [`MagInitialize`](https://learn.microsoft.com/en-us/windows/win32/api/magnification/nf-magnification-maginitialize),
  [`MagUninitialize`](https://learn.microsoft.com/en-us/windows/win32/api/magnification/nf-magnification-maguninitialize)
- The control's top-level host must use `WS_EX_LAYERED`, followed by
  `SetLayeredWindowAttributes`. Microsoft documents `WS_EX_TRANSPARENT` on this
  host as passing mouse clicks to the object behind it. Its sample combines
  `WS_EX_TOPMOST | WS_EX_LAYERED | WS_EX_TRANSPARENT` with a child
  `WC_MAGNIFIER` control. [Creating the Magnifier control](https://learn.microsoft.com/en-us/previous-versions/windows/desktop/magapi/magapi-intro#creating-the-magnifier-control),
  [Microsoft sample source](https://github.com/microsoft/Windows-classic-samples/blob/main/Samples/Magnification/cpp/Windowed/MagnifierSample.cpp)
- `WS_EX_NOACTIVATE` keeps a top-level helper from becoming the foreground
  window and keeps it out of keyboard navigation by accessibility tools.
  Microsoft does not specifically test that style in the Magnifier sample, so
  the combination remains a live gate rather than a documented result.
  [`WS_EX_NOACTIVATE`](https://learn.microsoft.com/en-us/windows/win32/winmsg/extended-window-styles)
- The API is unsupported under WOW64: a 32-bit helper does not run correctly on
  64-bit Windows. The experiment must fail unless the helper is a native x64
  process on this x64 installation. [Magnification API runtime requirements](https://learn.microsoft.com/en-us/windows/win32/winauto/magapi/entry-magapi-sdk)
- Microsoft's legacy sample says it must run elevated and is not designed for
  multiple monitors, although the API reference does not state those as general
  requirements for this control path. Start the gate non-elevated on the current
  single display; do not silently add elevation, UIAccess, or a multimonitor
  claim if it fails. [Microsoft sample source](https://github.com/microsoft/Windows-classic-samples/blob/main/Samples/Magnification/cpp/Windowed/MagnifierSample.cpp)

### Source, effect, and exclusion

- `MagSetWindowSource` takes a rectangle in desktop coordinates, not a target
  HWND. The helper must continuously derive that rectangle from the already
  signature/package/PID-bound Claude HWND and hide immediately when that HWND is
  hidden, minimized, destroyed, or no longer foreground. [`MagSetWindowSource`](https://learn.microsoft.com/en-us/windows/win32/api/magnification/nf-magnification-magsetwindowsource)
- `MagSetColorEffect` applies the most recently supplied 5-by-5 matrix to the
  entire Magnifier control. Passing `NULL` removes the effect. It requires a
  WDDM-capable video card. [`MagSetColorEffect`](https://learn.microsoft.com/en-us/windows/win32/api/magnification/nf-magnification-magsetcoloreffect)
- The magnification window is automatically excluded, preventing its rendered
  image from recursively magnifying itself. Use
  `MagSetWindowFilterList(MW_FILTERMODE_EXCLUDE, ...)` for every other Aura-owned
  overlay HWND, including the host. Microsoft does not promise automatic
  exclusion of the whole host/owned-window tree, so recursion remains a live
  check. On Windows 7 and newer, `MW_FILTERMODE_INCLUDE` is unsupported;
  therefore this API cannot whitelist only Claude. The filter operation also
  requires WDDM. [`MagSetWindowFilterList`](https://learn.microsoft.com/en-us/windows/win32/api/magnification/nf-magnification-magsetwindowfilterlist)

That last point is the largest limitation: exact signed-HWND validation binds
position and lifecycle, but **does not isolate the sampled pixels to that HWND**.
An unrelated toast or topmost window crossing the source rectangle may appear
in the compositor. A prototype must remain private, retain no frames, run only
while Claude is foreground, and fail closed on ambiguity. It cannot claim
HWND-isolated capture.

### Pixel and content boundary

The windowed control internally copies the desktop source rectangle to an
off-screen bitmap, transforms it, and displays it. In the proposed API path the
application supplies only HWNDs, rectangles, and matrices and receives only
success/failure values; it receives no frame or pixel pointer. [Magnifier source
rectangle model](https://learn.microsoft.com/en-us/previous-versions/windows/desktop/magapi/magapi-intro#source-rectangle)

The one Magnification mechanism that does expose `srcdata` and `destdata`
buffers is `MagImageScalingCallback`. Microsoft deprecated it in Windows 7,
says not to use it in new applications, and says it works only with DWM off.
Microsoft also documents DWM as always on from Windows 8, so this is not a
usable modern-Windows escape hatch.
The prototype must never register, retrieve, or implement that callback and
must not call any screenshot or save API. [`MagImageScalingCallback`](https://learn.microsoft.com/en-us/windows/win32/api/magnification/nc-magnification-magimagescalingcallback),
[`MagSetImageScalingCallback`](https://learn.microsoft.com/en-us/windows/win32/api/magnification/nf-magnification-magsetimagescalingcallback),
[DWM always on](https://learn.microsoft.com/en-us/windows/compatibility/desktop-window-manager-is-always-on)

Accordingly, this route fits the existing privacy boundary as
**no DOM/text/value/pixel readback and no target mutation**, with the explicit
qualification that Windows still rasterizes and visually duplicates the source
rectangle into the helper-owned surface.

### Accessibility and input

- Do not use `MS_SHOWMAGNIFIEDCURSOR`; the normal cursor should remain visible
  once, over the underlying Claude window.
- Do not call `MagSetInputTransform`. Click-through at aligned 1.0 scale needs no
  pen/touch coordinate remapping, and Microsoft requires UIAccess privileges for
  that API. [Input-transform boundary](https://learn.microsoft.com/en-us/previous-versions/windows/desktop/magapi/magapi-intro#input-transform)
- Query `SPI_GETHIGHCONTRAST` and `SPI_GETDISABLEOVERLAPPEDCONTENT` at startup
  and on system-color changes. If high contrast or disabled overlapped content
  is active, keep this color layer off. Microsoft tells apps to honor the user's
  foreground/background pair and warns that alpha blending and overlapped
  content can reduce legibility. [High-contrast parameter](https://learn.microsoft.com/en-us/windows/win32/winauto/high-contrast-parameter)
- Also keep an immediate **Original look** escape. A global matrix may reduce
  contrast or compound another color-assistance tool even when High Contrast is
  off; Microsoft does not document interoperability between multiple active
  color-transform tools.

## Bounded live protocol

1. Revalidate the exact signed Claude package, executable, PID, and top-level
   HWND. Require a native x64 helper and a WDDM display.
2. Call `MagInitialize`; create one helper-owned layered, click-through,
   no-activate tool window and one child `WC_MAGNIFIER`. Do not mutate styles or
   attributes on Claude's HWND.
3. Set an identity 1.0 `MAGTRANSFORM`, exclude all Aura helper HWNDs, set the
   Claude desktop rectangle as the source, then apply one restrained matrix.
   Never register an image-scaling callback.
4. Poll only HWND identity, foreground state, visibility, bounds, DPI/monitor,
   and accessibility settings. Revalidate HWND-to-PID identity because HWNDs
   can be recycled. Use DPI-aware visible-frame geometry: Microsoft documents
   `GetWindowRect` as DPI-virtualized and inclusive of invisible resize borders.
   Hide before updating when any condition is ambiguous; show again only after
   a complete valid snapshot. [`GetWindowRect`](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-getwindowrect)
5. Verify on the live signed window: complete coverage, actual color change,
   no black/stale/recursive area, no duplicate cursor, click/scroll/typing and
   focus pass-through, move/resize/minimize/restore tracking, and immediate
   Original-look restoration. Record counters and booleans only, never pixels.
6. Cleanup in a `finally` path: hide the host, remove the color effect, destroy
   the child and host windows, then call `MagUninitialize`. Process exit is a
   second rollback boundary because Claude was never modified.

## Stop conditions

Stop and mark this route **NO-GO** if the live gate shows any input capture,
focus theft, recursive/foreign pixels, protected/black Electron content,
material lag, conflict with High Contrast or Magnifier, incomplete cleanup, or
any need for `MagImageScalingCallback`/screen capture. Microsoft now recommends
Windows Graphics Capture or desktop duplication instead of the Magnification
API generally; neither alternative preserves this experiment's no-pixel-readback
property without building a separate capture/render pipeline. [Microsoft's API
recommendation](https://learn.microsoft.com/en-us/previous-versions/windows/desktop/magapi/magapi-intro)

Passing this gate would prove only a reversible, live, whole-window color
effect on the tested Desktop build and display. It would not prove visual
parity, renderer access, other DPI/monitor configurations, release readiness,
or user acceptance.
