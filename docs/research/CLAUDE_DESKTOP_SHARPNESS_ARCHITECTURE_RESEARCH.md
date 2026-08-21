# Claude Desktop sharpness architecture research - 2026-08-13

Scope: primary Microsoft, Chromium, Electron, CDP, comparator-source, and
current-project evidence for the low-resolution / outlined-text report in the
source-only Claude Aura Desktop presentation layer. This note did not launch,
capture, inspect, focus, or modify a live application. Recommendations are
implementation decisions, not installed-runtime or visual acceptance.

## Decision

| Candidate | Decision | Reason |
|---|---|---|
| More thresholds, sharpening, or glyph-coverage reconstruction in the current shader | **NO-GO** | The helper receives final color pixels, not glyph outlines or antialiasing coverage. Four bounded reconstructions already passed mechanical checks and failed actual-window review. |
| Renderer-native CSS through an app-owned Electron/WebView2 hook | **Correct route for native text quality; NO-GO for the current signed Claude boundary** | CSS participates in Blink style and paint, so text is painted again by the renderer. The current signed-Claude evidence has no supported external hook and its debug port/pipe is token-gated. |
| Exact-HWND capture with a source-faithful base plus Aura-owned decoration | **GO; recommended immediate architecture** | Keep Claude's rasterized text, icons, controls, and composer pixels unchanged at 1:1. Retain artwork, frame, halo, rail, taskboard, queue, Original look, cleanup, and bounded geometry accents as separate Aura-owned channels. |
| Full Light-to-Dark or Dark-to-Light conversion of captured source pixels while also promising native text | **NO-GO** | A final bitmap does not carry enough information to change both the background and the original glyph foreground while reproducing renderer-native antialiasing. |
| Small same-appearance global tint | **CONDITIONAL GO** | A bounded continuous transform can preserve spatial resolution, but it can still alter per-channel text coverage. It must never be described as semantic component theming and needs actual-window review. |

The product constraint is an impossible three-way combination on the current
signed app: (1) no package/renderer access, (2) exact internal Light/Dark
component recoloring, and (3) renderer-native text. Aura can retain (1) and
(3) now by relaxing exact recoloring of Claude-owned pixels. It can still keep
all functional features and all Aura-owned visual features.

## 1. The current defect is not source-image scaling

Windows Graphics Capture yields `Direct3D11CaptureFrame` objects whose public
content is a Direct3D surface, content size, and timestamp. The frame pool is
created for a pixel format and size. That is a final pixel-frame contract, not
a DOM, layout, glyph, or text-rendering contract. [Microsoft screen-capture
documentation](https://learn.microsoft.com/en-us/windows/apps/develop/media-authoring-processing/screen-capture)

The current helper already takes the two measures required to prevent ordinary
stretch blur:

- its swap chain uses `DXGI_SCALING_NONE`, which Microsoft defines as presenting
  the back buffer without scaling;
- its source UI path uses `Texture2D.Load`, which Microsoft defines as reading
  texels without filtering or sampling; and
- it drops a frame unless source, capture, swap-chain, and output-client pixel
  dimensions all match.

Sources: [DXGI scaling](https://learn.microsoft.com/en-us/windows/win32/api/dxgi1_2/ne-dxgi1_2-dxgi_scaling),
[HLSL `Load`](https://learn.microsoft.com/en-us/windows/win32/direct3dhlsl/dx-graphics-hlsl-to-load),
and the current helper's [swap-chain setup](../../windows/native/desktop-capture-filter.cpp#L676),
[integer source read](../../windows/native/desktop-capture-filter.cpp#L796), and
[one-to-one frame gate](../../windows/native/desktop-capture-filter.cpp#L1192).

The destructive step comes afterward. The shader estimates luminance, chroma,
neighbour contrast, source appearance, surface tiers, ink coverage, and
subpixel evidence, then replaces 90% of neutral Light pixels and 96% of neutral
Dark pixels with target surface/text/border colors. See the current
[semantic-neutral remap](../../windows/native/desktop-capture-filter.cpp#L824)
and [final replacements](../../windows/native/desktop-capture-filter.cpp#L909).
The greeting path separately derives a new glyph mask with `smoothstep` and can
change weight, italic shear, placement, and scale after the original text has
already been rasterized. See [greeting reconstruction](../../windows/native/desktop-capture-filter.cpp#L1058).

Therefore the accurate diagnosis is **post-raster recoloring damage**, not
insufficient capture resolution in the current source. The earlier 2026-08-12
actual-window evidence reached the same boundary: equal `980x531` dimensions
looked sharper in Light, while four text-mapping variants still left small Dark
labels bright-fringed or hollow. [Project blocker record](../plans/BLOCKED.md#L980)

## 2. Why antialiased text cannot be recovered reliably from the frame

Microsoft documents two relevant text models:

- ClearType computes separate coverage for the red, green, and blue elements
  of each pixel; there is no single per-pixel alpha value.
- Grayscale antialiasing has one coverage value and can be rendered to a
  transparent bitmap for later composition.

[DirectWrite antialiasing modes](https://learn.microsoft.com/en-us/windows/win32/api/dwrite_1/ne-dwrite_1-dwrite_text_antialias_mode)

DirectComposition can preserve ClearType coverage through a special per-channel
alpha path, but only when the producer first uses Direct2D/DirectWrite to write
that subpixel coverage and supplies a text color for composition. A captured
BGRA window frame contains the already-composited color result, not that
separate producer-side coverage. [Microsoft DirectComposition bitmap
surfaces](https://learn.microsoft.com/en-us/windows/win32/directcomp/bitmap-surfaces)

Implementation inference: for a grayscale edge, the observed pixel is roughly
`P = (1-a)B + aF`, where background `B`, foreground `F`, and coverage `a` are
all unknown to Aura. A final `P` does not uniquely determine those values.
ClearType can have three channel coverages, making the inverse still more
underdetermined. Neighbour classifiers can guess; they cannot recreate the
renderer input. This explains why changing `smoothstep`, gamma, a monotonic
ramp, or RGB-fringe handling did not converge.

Sharpening is not a repair. It amplifies the incorrectly reconstructed edge;
linear upscaling blurs it; nearest-neighbour upscaling enlarges the artifact.
The current 1:1 `Load` path should remain.

## 3. Why Gemini Aura and Codex Dream Skin look sharper

### Gemini Aura

The local primary comparator does not capture and recolor the Gemini window.
Its Electron main process calls `WebFrameMain.executeJavaScript` with an Aura
apply script, and that script installs or replaces a document `<style>` node
before setting the root theme state:

- `C:\Users\erich\Documents\In Progress\gemini-aura\src\main\aura\auraThemeManager.ts:1130-1221`
- `C:\Users\erich\Documents\In Progress\gemini-aura\src\main\aura\auraInjection.ts:334-345`

These are checkout-local primary-source citations; that Aura port is not part
of the public upstream commit and must not be represented as upstream behavior.

Electron's public API confirms the architecture: `webContents` owns rendering
of the page, `insertCSS` injects a stylesheet into that page, and the returned
key can remove it. [Electron `webContents.insertCSS` and
`removeInsertedCSS`](https://www.electronjs.org/docs/latest/api/web-contents#contentsinsertcsscss-options)

### Codex Dream Skin

Dream Skin's own source connects to the local CDP renderer and sends
`Runtime.evaluate`; its renderer payload installs a constructable stylesheet or
a `<style>` fallback into the document. Sources: [official injector](https://github.com/Fei-Away/Codex-Dream-Skin/blob/main/windows/scripts/injector.mjs),
[official renderer payload](https://github.com/Fei-Away/Codex-Dream-Skin/blob/main/windows/assets/renderer-inject.js),
and its [documented local-loopback CDP boundary](https://github.com/Fei-Away/Codex-Dream-Skin/blob/main/README.en.md#what-it-does).

CDP explicitly supports creating a stylesheet in a frame and inserting rules.
[Chrome DevTools Protocol CSS domain](https://chromedevtools.github.io/devtools-protocol/tot/CSS/)

### Rendering consequence

Blink's documented lifecycle converts DOM and computed style through layout
and paint into compositor display items. Its paint invalidator specifically
invalidates text display items when their painting changes. Renderer-native CSS
therefore lets Chromium paint text again against the selected CSS foreground
and background; it is not recoloring a previously captured glyph bitmap.
[Chromium Blink paint architecture](https://chromium.googlesource.com/chromium/src/+/refs/heads/main/third_party/blink/renderer/core/paint/README.md)

That architectural difference - not an image-resolution setting - is why the
two comparators can preserve native-looking text while changing component colors.

## 4. Signed Claude Desktop support boundary

Renderer-native CSS requires cooperation from one of these owners:

1. Claude's Electron main process (`webContents.insertCSS` or its internal
   `webContents.debugger`);
2. a verified external CDP endpoint; or
3. an official extension/plugin/theme interface.

Electron documents `webContents.debugger` as a main-process return object, not
an externally constructible API. [Electron Debugger](https://www.electronjs.org/docs/latest/api/debugger)

The project's completed read-only inspection of signed MSIX `1.26832.0.0`
records that Claude rejects remote-debugging port and pipe arguments unless an
Anthropic-signed short-lived `CLAUDE_CDP_AUTH` token is valid for the exact
profile, and that Node CLI inspection is fused off. The record closes token
bypass, package change, and private-signature substitution. This is dated
project primary evidence, not a claim about every future Claude build.
[Renderer-access implementation follow-up](./CLAUDE_DESKTOP_PIPE_RENDERER_AND_HWND_CAPTURE_RESEARCH.md#implementation-follow-up---2026-08-09)

Modifying the package is not a safe substitute. MSIX signatures and block maps
let Windows verify package contents and detect tampering; Electron fuses are
set before code signing so OS signature validation protects them afterward.
Sources: [Microsoft MSIX signing and integrity](https://learn.microsoft.com/en-us/windows/msix/package/signing-package-overview)
and [Electron fuses](https://www.electronjs.org/docs/latest/tutorial/fuses).
Electron's ASAR integrity feature can also terminate the app when the packaged
header hash does not match. [Electron ASAR integrity](https://www.electronjs.org/docs/latest/tutorial/asar-integrity)

No primary source found in this review establishes a supported third-party
renderer hook for signed Claude Desktop. Until Anthropic exposes one, Aura
must not copy Dream Skin's transport assumption, bypass the debug token, edit
`app.asar`, flip fuses, replace the executable, or re-sign the package.

## 5. Feature-preserving mitigation

### Recommended default: source-native sharp compositor

Keep the exact-HWND capture, GPU-only privacy boundary, no-activate/click-through
overlay, identity binding, lifecycle, and Original-look cleanup. Change only
what happens to Claude-owned pixels:

1. Start every output pixel as the exact `source.rgb` texel.
2. Remove the native-source `inkCoverage`, `subpixelInkEvidence`, `mappedText`,
   `accentTextEvidence`, and 90%/96% `neutralAmount` replacement path.
3. Never infer or repaint a native glyph, icon, border, or control edge.
4. Permit artwork/surface influence only on confidently flat, low-frequency
   regions, with a strict detail rejection and bounded opacity. Any ambiguous
   pixel remains the source pixel.
5. If requested appearance and detected source appearance differ, fail sharp:
   keep Claude-owned pixels unchanged instead of attempting Light/Dark inversion.

This preserves the spatial and channel values that Claude's renderer chose for
text. It also keeps artwork, feature art, wordmark, frame, halo, theme rail,
theme selection, appearance selection, user-theme discovery, taskboard/queue,
geometry accents, persistence, Original look, privacy reporting, and cleanup.
The honest product label is **external sharp presentation**, not internal
semantic palette parity.

### Channel-specific treatment

| Existing feature | Sharp treatment |
|---|---|
| Native text, icons, menus, composer, controls | Exact 1:1 source pass-through. |
| Background and feature artwork | Keep the existing GPU asset decode and placement; blend only through a flat-surface mask that rejects all detail. |
| Sidebar/panel/raised hierarchy | Prefer existing Aura-owned low-opacity geometry cues and shell materials. Do not replace native edge/text pixels. |
| Accent tint | Optional low-amplitude same-appearance continuous transform; no edge/chroma class switch. |
| Greeting relocation/restyling | Stop glyph-mask reconstruction. Keep the native greeting in place and add only Aura-owned mark/hero decoration. A sharp moved/restyled copy requires renderer text or separately authored Aura text. |
| Taskboard and Action Queue | Unchanged because they are Aura-owned native surfaces, not reconstructed Claude pixels. |

The greeting is the one visual effect that cannot retain its present exact
behavior and gain native sharpness under the current privacy boundary. Moving,
scaling, weighting, or italicizing the original words requires either the
original glyph/text input or lossy bitmap reconstruction. Preserve the native
greeting rather than obscuring it with a lower-quality copy.

## 6. Implementation and acceptance plan

1. **Mechanical identity gate:** retain `DXGI_SCALING_NONE`, integer `Load`,
   equal-dimension frame rejection, and no CPU readback. Add a focused contract
   that rejects any native-source linear sampler or edge-dependent text remap.
2. **Sharp-base change:** bypass the semantic text/neutral recoloring path and
   the reconstructed greeting glyph path. Leave every other owned channel and
   lifecycle contract in place.
3. **Mismatch guard:** when source and requested appearance differ, keep the
   source base and use only owned theme accents/artwork. Do not silently claim
   a native Dark renderer.
4. **Actual-window gate:** review the signed whole window at 100% capture scale
   in Light and Dark, concentrating on small sidebar/list labels, icons,
   composer text, and the greeting. Parser/build/test/hash evidence cannot
   promote this to visual acceptance.
5. **Comparator claim:** claim only that text is source-native and sharp after
   actual-window acceptance. Do not claim Gemini Aura / Dream Skin renderer
   parity until a supported renderer-native Claude route exists.

## Verification boundary

This research establishes why the current post-raster text mapping cannot be
made equivalent to renderer-native CSS and chooses a safe mitigation. It does
not prove that a future shader edit is visually accepted, that the installed
helper contains it, or that a newer Claude build retains the dated debug-token
boundary. Those require the repository's normal source, installed-runtime, and
whole-window actual-Aura gates.
