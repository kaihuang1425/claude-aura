# Screenshot evidence protocol

This protocol makes the final visual evidence repeatable. It is a capture plan,
not a substitute for the required images or live browser observations.

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

## Eight-theme comparison set

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
