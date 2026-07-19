# Screenshot evidence protocol

This protocol makes the final visual evidence repeatable. It is a capture plan,
not a substitute for the required images or live browser observations.

## Evidence roles

The three evidence layers have different jobs:

- `npm run verify:cycle` produces deterministic payload-harness goldens for
  automated regression detection.
- `preview/` provides deterministic responsive and interaction coverage against
  representative interface states.
- The actual Aura WebView2 window on real `claude.ai` proves the production
  result users see.

Passing either deterministic surface never substitutes for the live Aura
review. Conversely, live `claude.ai` captures are not suitable for automated
pixel diffs because the external product changes independently of Aura.

## Deterministic preview state

Build and serve the offline QA surface:

```powershell
npm run preview:build
node scripts/preview-server.mjs --host 127.0.0.1 --port 4173
```

The preview accepts these strict query parameters:

- `capture`: set to `1` to freeze transitions, animation, scrolling, and the text caret;
- `theme`: one of the eight stable IDs from `themes/registry.json`;
- `mode`: `light` or `dark`;
- `screen`: `home` or `code`; and
- `overlay`: `none`, `menu`, or `dialog`.

When `capture=1`, all four state values are required and invalid values stop the
preview instead of silently capturing a fallback theme.

For example:

```text
http://127.0.0.1:4173/preview/?capture=1&theme=anime-twilight&mode=dark&screen=home&overlay=none
```

Wait until the document root matches `[data-preview-ready="true"]` before
capturing. The marker is set only after the active artwork, system fonts, and two
animation frames have settled. Verify the root `data-claude-aura-theme`,
`data-mode`, `data-preview-screen`, and `data-preview-overlay` values before every
capture. The visible QA state plate must show the same theme, current mode,
screen, overlay, CSS viewport, and device-pixel ratio.

Query parameters override saved preview theme/mode values for that page load but
do not overwrite browser storage. Interactive theme and mode changes continue to
persist normally.

## Actual Aura WebView2 parity review

At every WO-08..WO-14 mini-checkpoint, and again at HUMAN CHECKPOINT C and
WO-16, launch the real Aura main window with an authenticated `claude.ai`
document. The offline preview, payload fixture, Claude Desktop, and an ordinary
browser window are not substitutes.

Prefer a dedicated test account or profile with no private history. Open an
empty new chat and keep the real sidebar visible so both the themed canvas and
navigation are exercised. If account data cannot be excluded, keep all live
captures under the gitignored `dist/verify/live-aura/` tree and do not copy them
into `docs/`, release archives, issues, or pull requests.

For each capture:

1. Apply the requested theme through Aura and switch real Claude to the
   requested light or dark mode.
2. Confirm the WebView document is `claude.ai`, the loading cover is gone, and
   the document root reports the expected `data-claude-aura-theme` and
   `data-claude-aura-digest` values.
3. Wait for every configured artwork layer to decode and for two animation
   frames to settle. A missing or wrong-theme layer fails the capture.
4. Capture the entire Aura window, including its real WebView2 bounds; do not
   substitute a reconstructed page or edit the captured pixels.
5. Record theme ID, mode, UTC timestamp, commit, payload digest, outer window
   pixels, WebView CSS viewport, DPR, Windows display scaling, and capture path
   in a manifest beside the images.

Capture all eight stable theme IDs in both modes at a target WebView client area
of 1440 × 900, for sixteen primary images. Use registry order and filenames of
the form `<order>-<theme>-<mode>-aura-window.png`. Record the actual viewport
when Windows chrome or display scaling prevents the exact target.

Also perform three live stress captures: Cartoon Studio light at 1280 × 720,
Anime Twilight dark at 1920 × 1080, and Korean Idol dark at DPR 2 when the
available display supports it. Open one real Claude menu and one real modal or
dialog across the art-heavy themes and confirm that artwork does not overlap or
intercept either surface.

Judge only what Aura controls: artwork identity, visibility, crop and focal
position; material, palette, decorative density, and typography category;
light/dark legibility; pointer safety; and unobstructed controls. Exact Claude
layout, wording, feature inventory, and personalized content are out of scope
because the live site supplies them. After cycling all themes, select Original
look and confirm that all Aura styling and artwork disappear.

Live captures are human-review evidence, not `REFERENCE_LOCK.md` goldens. Keep
the deterministic payload images as the byte-stable goldens, and record the
live review outcome and evidence paths in `docs/IMPLEMENTATION_REPORT.md` and
`docs/ACCEPTANCE_AUDIT.md`. If sign-in, the live service, or window capture is
unavailable, leave the checkpoint open; never replace this gate with a fixture.

## Offline eight-theme comparison set

Capture the Home view in light mode at 1440 × 900 and save under
`docs/theme-screenshots/`:

| Order | Theme ID | Filename |
| ---: | --- | --- |
| 1 | `default` | `01-default-home-light-1440x900.png` |
| 2 | `japanese-film-editorial` | `02-japanese-film-editorial-home-light-1440x900.png` |
| 3 | `korean-prestige` | `03-korean-prestige-home-light-1440x900.png` |
| 4 | `cartoon-studio` | `04-cartoon-studio-home-light-1440x900.png` |
| 5 | `anime-twilight` | `05-anime-twilight-home-light-1440x900.png` |
| 6 | `study-library` | `06-study-library-home-light-1440x900.png` |
| 7 | `japanese-idol` | `07-japanese-idol-home-light-1440x900.png` |
| 8 | `korean-idol` | `08-korean-idol-home-light-1440x900.png` |

Each image must show the sidebar, Home/Code tabs, theme picker, navigation,
cards/widgets, status examples, composer, model selector, Chat/Cowork controls,
microphone, voice, and the active-theme label without clipping.

## Responsive and interaction evidence

Record overflow, hit-testing, and control visibility at every requested size:

| Viewport | Suggested deterministic state | Evidence filename |
| --- | --- | --- |
| 1280 × 720 | Cartoon Studio, Home, light | `responsive-1280x720-cartoon-studio.png` |
| 1440 × 900 | Eight-theme comparison set above | eight comparison files |
| 1905 × 1026 | Study Library, Code, light | `responsive-1905x1026-study-library-code.png` |
| 1920 × 1080 | Anime Twilight, Home, dark | `responsive-1920x1080-anime-twilight-dark.png` |
| 1905 × 1026 CSS at DPR 2 | Korean Idol, Home, dark; expected 3810 × 2052 output | `responsive-3810x2052-korean-idol-dark.png` |

Treat a literal 3810 × 2052 CSS viewport as a large-viewport proxy, not high-DPI
proof. If the approved browser cannot configure DPR 2, record that limitation and
retain the proxy as supplemental evidence.

Also capture one open menu and one modal dialog through `overlay=menu` and
`overlay=dialog`. Exercise, but do not necessarily capture, keyboard tab/arrow/Escape
behavior, visible focus, active/hover/disabled states, the Code view, Chat/Cowork,
model selection, microphone/voice toggles, composer loading/completion, and the
empty/error/success/warning examples.

## Persistence and console checks

1. Load the preview without query parameters and select a non-Default theme and
   dark mode using the interface.
2. Reload and verify the same theme and mode return from local storage.
3. Open a query-parameter URL for another theme, then reload the parameter-free
   preview and confirm the saved interactive selection was not overwritten.
4. Use **Reset preview settings**, reload, and verify Default/light returns.
5. Confirm there are no uncaught errors, failed artwork requests, mixed-content
   requests, or remote-resource requests while switching all eight themes.
6. Confirm decorative artwork never receives pointer input and does not cover the
   composer or navigation at any viewport.

After capture, enumerate every evidence file and its observed state in
`docs/IMPLEMENTATION_REPORT.md`, update `docs/ACCEPTANCE_AUDIT.md`, rerun the full
check, and rebuild the versioned archive and SHA-256 sidecar.
