# User-customizable in-page wordmark plan

## Decision summary

Implement the top-left customization as a **device-level personal wordmark override**, not as theme artwork and not as a user-theme schema field. Reuse Aura Studio's existing avatar image-selection and framing pipeline, but give the wordmark its own wide framing profile, faithful light/dark previews, generation-safe persistence, and runtime fallback rules.

The smallest feasible first release is one uploaded image, one 2.77:1 crop, and faithful previews on light and dark surfaces. A later enhancement can accept separate light- and dark-surface variants without changing the core model.

This preserves the existing built-in wordmarks, Claude's native link and accessible name, Original look behavior, and all current fail-open protections.

## What is blocked today

The current implementation is intentionally closed in four places:

1. **Ownership:** the in-page wordmark pair is Aura-owned and selected only from an immutable built-in map. User themes cannot provide or redirect it.
2. **Compilation:** `brandWordmark` is resolved from the selected built-in theme and compiled into runtime settings; there is no personal override in config.
3. **Runtime discovery:** the renderer replaces the visual only after uniquely finding an expanded sidebar brand host with enough horizontal room. This is correct and should remain the safety boundary.
4. **Studio bridge:** Studio already supports avatar choose/preview/crop/save messages, but there are no equivalent wordmark messages or state fields.

The blockage is therefore not the crop interaction. The existing avatar editor proves that local file selection, host-served previews, pointer drag, zoom, async persistence, alpha handling, and fail-open errors already work. The missing work is a new personal asset contract and adapting framing from a circular 1:1 output to the wordmark's wide display geometry.

## Evidence from the current implementation

This proposal should extend mechanisms that are already exercised in production code and automated tests rather than introduce a parallel upload stack:

- `studio/app.js` already implements a reusable crop state (`x`, `y`, `zoom`), cover-scale math, pointer capture, slider controls, reset, pending-save disabling, preview URL validation, and authoritative close-after-host-state behavior for avatar, wallpaper, and theme-card previews.
- `studio/styles.css` already makes the modal scroll within short viewports, collapses controls at compact widths, provides forced-colors behavior, and uses a circular mask only when `data-kind="avatar"`. A `wordmark` kind can reuse the base stage without duplicating dialog CSS.
- `windows/aura-ui.ps1` already copies the avatar source into Aura-owned storage, keeps sidecar crop/hash/alpha state, bakes a normalized output with GDI+, points config at the baked file, applies the theme, and returns authoritative Studio state.
- `scripts/theme-core/registry.mjs` validates image extension and magic bytes, caps avatar bytes, fails open when the generated file is absent, and emits a data URL only after validation.
- `assets/renderer-inject.js` already performs conservative unique-brand discovery, decode-before-hide replacement, cleanup, and remount recovery.
- `tests/avatar.test.mjs` already verifies compile-in/compile-out behavior, byte-budget separation, DOM overlay geometry, single-overlay behavior, data URL propagation, and teardown.

These are **proven repository methods**, but they are not all sufficient unchanged. The wordmark implementation should reuse their control flow and test harnesses while correcting the weaknesses identified below.

## Critique and iteration of the initial solution

The first version of this plan was directionally correct but too abstract in several technical areas. The revised solution makes these corrections:

1. **Do not store only a final cropped PNG.** That would make later “Adjust position” operations lossy or impossible. Match the avatar mechanism: retain an Aura-owned normalized source, keep a small sidecar state record, and generate a separate baked runtime PNG.
2. **Do not claim WebP support in the Windows picker until the decoder supports it.** The current host crop path uses GDI+ and accepts PNG, JPEG, and GIF. V1 should accept static PNG/JPEG and optionally static GIF only after frame-zero behavior is explicitly tested. WebP belongs behind a conversion-capability check, not marketing copy.
3. **Do not add a speculative light/dark segmented control in v1.** It adds a decision before there is evidence that users need it, and “automatic contrast” is difficult to make reliable for arbitrary artwork. V1 should preview the image faithfully on two small light/dark chips and preserve alpha; paired variants can follow later.
4. **Do not depend on runtime contrast plates.** A plate changes the supplied identity and adds theme-dependent rendering complexity. Prefer a deterministic transparent crop and let the user verify both surface previews. If one image is unreadable, provide a non-blocking warning, not an automatic visual mutation.
5. **Do not clear the prior asset before a replacement is proven valid.** The current avatar selection path clears existing files early. For smoother operation, wordmark replacement must stage, decode, bake, validate, and apply before atomically promoting the new generation.
6. **Do not duplicate crop mathematics in PowerShell and JavaScript without a contract test.** Preview/runtime drift is a high-confidence source of dissatisfaction. Define the cover-scale equations once as test vectors and require both implementations to match within one output pixel.
7. **Do not expose crop state in the main config unless the compiler needs it.** Following avatar, the public config should reference only the baked asset; editable source/crop state belongs to host-owned sidecar storage. This keeps config portable and runtime compilation simple.

The refined recommendation is therefore: **avatar-style UI + generation-based host storage + deterministic bake + existing conservative renderer**, with fewer appearance controls than originally proposed.

## Product boundary

### Included

- Replace only the visual Claude logo + wordmark in the top-left expanded sidebar.
- Keep customization local to the device and apply it across themes.
- Upload, reposition, zoom, reset, replace, and remove the image.
- Preview the result in a wide safe-area frame before saving.
- Preserve the native clickable wrapper, destination, keyboard behavior, and accessible name.
- Fall back to the current built-in wordmark, then Claude's native brand, whenever the custom asset cannot be used.

### Excluded

- Changing the app/taskbar/launcher icon.
- Changing the Studio rail identity.
- Adding custom HTML, SVG markup, CSS, or remote URLs.
- Moving or resizing Claude's native sidebar brand host.
- Supporting text entry as a logo generator in the first release.
- Writing personal branding into theme documents, theme exports, or shared kits.

## Recommended UX

### Placement

Add a **Sidebar wordmark** section immediately below **Account avatar** on Studio's **Personal wallpaper** page. Rename the page/navigation label to **Personalization** only when localization work is scheduled; do not block the first release on that broader copy change.

Use the same lightweight three-action pattern as avatar:

- **Choose an image…** — primary only when no custom wordmark exists; otherwise label it **Replace image…** and render it as a secondary action.
- **Adjust position** — visible only when a valid preview is available.
- **Remove custom wordmark** — visible only when configured.

Show a compact read-only thumbnail/status row above the actions after selection. It should communicate the current result without adding another always-visible editor.

Recommended helper copy:

> Customize the logo shown at the top of Claude's expanded sidebar. It stays on this device and keeps Claude's original link and accessible name.

> PNG or JPEG up to 2 MB. Transparent, wide images work best. Recommended canvas: 688 × 248 px or larger.

### Upload and adjustment flow

1. The user selects **Choose an image…**.
2. The native host picker accepts PNG and JPEG. GIF, WebP, and AVIF remain hidden until the host conversion path has explicit decoder and animation policy tests.
3. After validation, Studio immediately opens the shared framing dialog, matching the avatar flow.
4. The dialog title becomes **Position your sidebar wordmark**.
5. The stage uses the production asset ratio, **344:124 (2.774:1)**, with a centered safe-area guide rather than avatar's circular mask or the generic rule-of-thirds grid.
6. The user drags the image and adjusts zoom. The image always covers the output canvas, so no accidental empty edges appear.
7. Two small, non-interactive surface chips show the same crop on representative light and dark backgrounds. If measured contrast is poor, show a non-blocking “May be hard to read” note; never alter the image automatically.
8. **Save** commits the crop and closes only after the host reports the persisted state. **Cancel** leaves the previous saved asset unchanged.
9. The applied result is reflected in Aura immediately. Failure retains the prior custom wordmark or built-in/native fallback and shows a concise recoverable error.

### Dialog controls

Reuse the existing crop dialog and its interaction model:

- drag directly on the image;
- Zoom slider, 100–200% for v1;
- horizontal and vertical position sliders for precise/keyboard adjustment;
- Reset framing;
- Cancel and Save;
- Escape closes without saving;
- focus returns to the invoking button;
- `aria-live` status for save/failure.

For normal extension/new-tab sizes:

- desktop/spacious: stage fills the dialog width, capped around 620 px;
- compact: single-column controls and a stage width of `100%`;
- short viewport: dialog scrolls while actions remain reachable;
- reduced motion: no animated transitions are required;
- forced colors: hide decorative guides and retain an explicit border.

Do not add rotation, filters, freeform aspect ratios, corner-radius controls, or manual pixel dimensions. They increase visual noise and cannot affect the fixed runtime slot.

## Appearance strategy

V1 should be deliberately source-faithful:

1. Preserve alpha in the baked PNG.
2. Show the exact crop on light and dark preview chips before save.
3. Calculate a coarse luminance/alpha coverage score only to produce a warning; never block saving and never invert, recolor, shadow, or plate the image automatically.
4. Use the same baked asset for every theme and appearance. The user's personal override is stable, while built-in fallback remains appearance-aware.
5. Leave the sidecar schema versioned so a future release can add independent light/dark sources without migrating theme documents.

This is more predictable than automatic treatment. Contrast analysis cannot reliably understand multicolor marks, photographs, intentional low-contrast art, or transparency, while a faithful two-surface preview gives the user immediate control with almost no UI noise.

## Data and persistence contract

Follow the proven avatar separation between runtime config and editable host state. Main device config contains only the baked runtime asset path:

```json
{
  "personalWordmark": "/aura-user-data/personal-wordmark/current/wordmark.png"
}
```

Host-owned state lives beside the source and is never compiled, exported, or exposed to Studio as a path:

```json
{
  "schemaVersion": 1,
  "generation": "<sha256-prefix>",
  "source": "source.png",
  "sourceSha256": "<sha256>",
  "crop": { "x": 50, "y": 50, "zoom": 1 },
  "output": { "width": 344, "height": 124, "sha256": "<sha256>" }
}
```

Use generation directories (`staging/<uuid>` then `generations/<digest>`) and an atomic config update to promote a complete generation. Keep the previous generation until the new payload has compiled and applied successfully. Cleanup of older generations happens after success and is best-effort. This provides rollback without a database or complex journal.

Compatibility rules:

- missing key: unchanged current behavior;
- legacy string path: normalize and validate like avatar;
- invalid state or missing baked file: ignore it, fall back, and report `personalWordmarkUnavailable` to Studio only;
- corrupt source but valid baked file: continue displaying the baked file, disable **Adjust position**, and offer **Replace image…**;
- removal: first clear config/apply the fallback, then best-effort delete host files;
- Original look: suppress every Aura wordmark override, including the personal one, and show Claude's native visual;
- theme switching: keep the personal override because it is user-owned and theme-independent;
- uninstall/restore: follow the same personal-data retention policy as avatar and wallpaper.

## Host and processing design

Extend the existing Studio message allowlist with:

- `set-personal-wordmark`
- `clear-personal-wordmark`
- `set-personal-wordmark-framing`

Extend Studio state with:

- `hasPersonalWordmark`
- `personalWordmarkPreviewUrl`
- `personalWordmarkCrop`
- `personalWordmarkUnavailable`

The host workflow should:

1. open the local picker;
2. validate extension and content signature independently;
3. reject files over 2 MB and dimensions outside a documented safe range (recommended: 64–8192 px per side, with at least 344 × 124 effective crop resolution);
4. decode in the existing isolated conversion path;
5. apply crop to a transparent 688 × 248 working canvas, then downsample to 344 × 124 for runtime;
6. strip metadata and encode deterministic PNG;
7. write source, state, and baked output into a staging generation; validate the baked file again, then promote the complete generation and update config;
8. return a capability-scoped `https://aura.wordmark/...` preview URL rather than a local file path or data URL to Studio;
9. rebuild/apply the runtime payload;
10. send authoritative state back so Studio closes the dialog only after persistence succeeds; if compile/apply fails, restore the prior config generation and return an error without losing the user's prior wordmark.

The 688 × 248 intermediate keeps crop quality while the final dimensions remain compatible with the established built-in contract. If the current conversion stack cannot guarantee deterministic alpha PNG output on every supported Windows version, use the already packaged image conversion mechanism rather than adding browser-side canvas persistence.

### Crop parity contract

Use the same normalized crop semantics already used by Studio:

- `x` and `y` are clamped percentages from 0 to 100 across the overflow remaining after cover scale;
- `zoom` is clamped from 1 to 2;
- base scale is `max(outputWidth/sourceWidth, outputHeight/sourceHeight)`;
- effective scale is `baseScale × zoom`;
- source offset is `-(scaledDimension - outputDimension) × axisPercent / 100`;
- raster coordinates use invariant-culture decimals and one documented rounding rule (round half away from zero at final device pixels).

Create a fixture table covering landscape, portrait, square, exact-ratio, one-pixel overflow, alpha edges, `x/y` at 0/50/100, and zoom at 1/1.37/2. The JavaScript preview helper and PowerShell/GDI+ bake helper must produce matching source rectangles within one final pixel. This is more reliable than screenshot-only comparison and directly prevents the common “saved crop moved” defect.

### Operation state machine

Keep interaction states explicit so duplicate messages, late host responses, and replacement failures cannot corrupt UI state:

| State | User actions | Host behavior | Exit |
|---|---|---|---|
| `idle-empty` | Choose | none | picker or `validating` |
| `idle-ready` | Replace, Adjust, Remove | none | picker, `editing`, or `removing` |
| `validating` | Cancel picker only | stage and decode source | `editing-new` or prior idle state |
| `editing` / `editing-new` | Drag, sliders, Reset, Cancel, Save | no persistence during input | prior idle state or `saving` |
| `saving` | no duplicate save/close | bake, verify, promote, compile, apply | `idle-ready` or return to editor with error |
| `removing` | no duplicate actions | clear config, apply fallback, cleanup | `idle-empty` or `idle-ready` on rollback |

Every Studio request carries a monotonically increasing `requestId`. State replies echo it; Studio ignores older replies for action completion while still accepting newer authoritative snapshots. Host actions are serialized through the existing Studio action gate. This removes race conditions from quick replace/remove clicks without adding visible UI.

### Smooth-operation budgets

Treat performance as an acceptance contract, measured on the slowest supported test environment rather than assumed:

- pointer/slider preview: no host round trip; target 60 Hz and never block the main thread on source hashing or encoding;
- dialog open after file selection: preview-ready target under 300 ms for a 2 MB source, with a busy state instead of a frozen stage;
- save/apply: target p95 under 1.5 s; show one stable **Applying…** label after 150 ms to avoid flicker on fast saves;
- repeated slider input: only local DOM transforms; bake exactly once on Save;
- payload: final baked asset capped separately (proposed 256 KiB) and total compiled payload checked before promotion;
- preview cache: URL includes generation digest so replacement cannot reuse stale WebView cache content.

These numbers are provisional gates for the Phase 0 spike. If GDI+ cannot meet them or preserve alpha deterministically, the spike must select the packaged converter before feature implementation continues.

### Transaction and recovery sequence

1. Snapshot the prior config value and active generation.
2. Create a unique staging directory under the same volume as the generation root.
3. Copy and hash the source while enforcing a streamed byte limit.
4. Decode once to validate dimensions; bake the output; reopen the output to validate signature, dimensions, alpha, and byte cap.
5. Write sidecar JSON with no byte-order mark, flush files, and rename staging to its digest generation. Same-volume rename makes generation publication atomic.
6. Update config using the repository's existing temporary-file + rename/retry mechanism.
7. Compile and apply. Only after success send the saved authoritative state and prune older generations.
8. On config/compile/apply failure, restore the snapshot, reapply the prior payload, retain diagnostic logs without local source paths, and leave the editor open with the draft intact.
9. On startup, delete abandoned staging folders older than 24 hours and retain at most the current plus one previous generation.

This sequence improves on the current avatar replacement behavior because a bad new image can never destroy the last valid customization.

## Compiler precedence

Resolve wordmarks in this order:

1. Original look or Aura disabled → no Aura replacement; native Claude visual.
2. Valid `personalWordmark` → processed personal image plus fixed geometry metadata.
3. No valid personal override and selected frozen built-in has a wordmark → existing light/dark built-in pair.
4. No usable Aura wordmark → native Claude visual.

Keep the runtime settings shape compact. A personal override needs only its data URL and the same `minWidth`/`width` geometry used by built-ins. Do not expose arbitrary width or minimum sidebar width in config.

Personal image bytes should be treated like avatar bytes: excluded from the fixed theme-art chrome budget but included in total payload limits and separately capped. The compiled-out path must remain byte-stable when no personal wordmark is configured.

## Renderer design

Reuse the current `findBrand`, host-preservation, image decode, teardown, SPA-remount, collapsed-sidebar, forced-colors, and ambiguity protections. Change only asset selection:

- select the personal image before the built-in light/dark pair;
- continue to insert exactly one `aria-hidden` and pointer-inert `<img>`;
- never remove or replace the native interactive wrapper;
- hide only the native visual after the custom image has decoded;
- restore the native visual on decode error, insufficient width, duplicate matches, collapse, forced colors, cleanup, or Original look;
- preserve the current width/min-width constants to prevent layout shift;
- use `object-fit: contain`, not `cover`, at runtime because crop processing has already produced the exact canvas.

Do not broaden selectors as part of this feature. Selector resilience and user customization should remain independently testable.

## Feasibility options considered

| Option | Benefits | Problems | Decision |
|---|---|---|---|
| Theme-kit `brand-mark`/wordmark field | Portable with themes | Violates current ownership boundary; leaks personal branding into exports; complicates untrusted kit validation | Reject |
| Raw file path compiled directly | Minimal backend work | File can disappear; payload and dimensions are uncontrolled; Studio crop cannot be authoritative | Reject |
| Browser canvas creates the final data URL | Fast prototype | Large bridge messages, inconsistent codecs, metadata/alpha behavior, harder atomic persistence | Reject for production |
| Host-processed personal asset using avatar-style UI | Reuses proven UX and security boundaries; deterministic; local; theme-independent | Requires host messages, processing, config, compiler, and tests | **Recommend** |
| Separate light/dark uploads in v1 | Best appearance control | Doubles decisions and UI surface before demand is proven | Defer; keep schema extensible |

## Delivery plan

### Phase 0 — contract spike

- Confirm the host conversion path can produce a transparent 344 × 124 PNG from crop coordinates on all supported Windows environments.
- Record output byte size and compile/apply latency for representative transparent logos, opaque banners, phone photos, and very large sources.
- Confirm the existing renderer geometry accepts a single exact-ratio asset without CSS changes.
- Exit criterion: processed asset remains within the proposed cap, preview and runtime pixels match, and apply latency meets the current avatar interaction expectation.

### Phase 1 — persistence and compiler

- Add config normalization/defaults and personal asset resolution.
- Add secure image validation and transactional processing.
- Add runtime precedence and unavailable diagnostics.
- Ensure no-config builds remain unchanged and Original look suppresses the override.

### Phase 2 — Studio UX

- Add the Personalization section, current thumbnail, choose/replace/adjust/remove actions, and localized copy.
- Generalize the shared crop editor with a `wordmark` profile: 344:124 ratio, safe-area guide, zoom bounds, and faithful dual-surface preview.
- Add bridge allowlist, authoritative state reconciliation, busy/error behavior, and keyboard/focus support.

### Phase 3 — renderer and resilience

- Select the personal asset through the existing safe brand host path.
- Verify theme switches, light/dark changes, sidebar collapse/expand, SPA remounts, Aura disable/enable, and teardown.
- Ship source-faithful rendering; use Phase 0 contrast findings only to tune the non-blocking warning threshold, not to mutate the image.

### Phase 4 — polish and rollout

- Run localization key parity and responsive/forced-colors/reduced-motion checks.
- Add documentation explaining local storage, recommended files, fallback behavior, and removal.
- Gate release on automated tests plus screenshot review at compact and spacious Studio sizes and expanded/collapsed Aura sidebar sizes.
- Consider paired light/dark uploads only after real usage demonstrates that automatic presentation is insufficient.

## Test plan

### Core and security

- Accept valid PNG/JPEG by matching extension and magic bytes; reject mismatch, unsupported codecs, malformed data, oversize files, decompression bombs, and unsafe dimensions.
- Verify metadata is removed and output is exactly 344 × 124 PNG.
- Verify preview URLs accept only the expected scheme, host, digest, and extension.
- Verify no absolute path or raw source bytes enter Studio messages, theme JSON, exports, logs, or errors.
- Verify atomic replacement preserves the prior valid asset when processing or config write fails.

### Compiler

- No custom setting produces the existing built-in payload behavior.
- Valid personal asset wins over every built-in wordmark.
- Missing/corrupt personal asset falls back to built-in, then native, and exposes only a stripped Studio diagnostic.
- Personal asset is separately budgeted and does not count as theme artwork.
- Original look and Aura disabled ship no active replacement.

### Studio

- Picking an image opens adjustment immediately.
- Cancel preserves the previous asset and framing.
- Save waits for authoritative host state; duplicate clicks are blocked.
- Replace, adjust, reset, remove, and failed retry behave predictably.
- Drag, sliders, arrow keys, tab order, Escape, focus return, and live status work.
- Compact width, short height, 200% text zoom, forced colors, and reduced motion remain usable.
- Every locale contains the same keys and no untranslated fallback appears.

### Runtime

- Exactly one overlay appears in the uniquely discovered expanded sidebar.
- Native wrapper, href, accessible name, focus, click, and context behavior remain intact.
- No overlay appears when collapsed, undersized, ambiguous, decode-failed, forced-colors, disabled, or Original look.
- Native visual returns during cleanup and SPA remount; no orphan images or attributes remain.
- Theme and appearance switching do not flash both native and custom visuals after initial decode.

## Risks and mitigations

- **Claude DOM changes:** keep the existing fail-closed discovery and test the selection logic separately; never solve this by accepting ambiguous matches.
- **Unreadable artwork:** exact dual-surface preview, recommendation copy, safe-area guide, and a non-blocking contrast warning; preserve the source rather than applying an unpredictable automatic treatment.
- **Payload growth:** fixed processed dimensions, deterministic PNG, strict source/output caps, and compiled-out code/data when absent.
- **Blur from narrow/tall uploads:** enforce minimum effective crop resolution and warn before save rather than silently upscaling poor sources.
- **Configuration ambiguity:** one device-level owner and explicit precedence; never combine theme and personal wordmarks.
- **Accidental rebranding outside the target:** keep launcher, taskbar, Studio rail, and theme identity contracts separate.

## Acceptance criteria

The feature is ready when a user can choose a local image, frame it in the avatar-style editor, save it, and see it replace only the expanded sidebar's top-left visual across themes; the native wrapper and accessible name remain unchanged; removal restores the built-in/native fallback; Original look remains native; invalid assets fail open; compact Studio layouts remain usable; and no personal asset enters theme kits or exports.
