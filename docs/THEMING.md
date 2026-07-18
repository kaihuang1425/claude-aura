# Theme authoring

Claude Aura themes are registered interface systems. A theme combines localized
picker metadata, semantic light and dark tokens, typography, shape, effects,
wallpaper behavior, optional component variants, and optional isolated artwork.

Do not add a theme by placing an unregistered JSON file in `themes/`. The
registry is the source of truth for order, stable IDs, labels, descriptions,
swatches, preview colors, and artwork slots.

## Architecture

| File | Responsibility |
| --- | --- |
| `themes/registry.json` | Canonical order, Default ID, legacy aliases, localized picker metadata, swatches, preview colors, and artwork metadata |
| `themes/<id>.json` | Light/dark semantic values, typography, shape, effects, wallpaper behavior, and optional custom CSS |
| `scripts/theme-core.mjs` | Schema validation, locale normalization, fallback resolution, semantic defaults, compatibility-token expansion, artwork validation, and payload compilation |
| `assets/base.css` | Shared runtime styling driven by semantic variables |
| `assets/theme-variants.css` | Centralized component-level differentiation selected by the stable root theme attribute |
| `assets/renderer-inject.js` | Reversible in-page installation and cleanup of the compiled theme payload |
| `windows/aura-ui.ps1` | Localized, persistent, keyboard-accessible theme gallery for the Windows companion |
| `scripts/build-preview.mjs` | Generates the offline harness data from `listThemes()` |

The compiler applies the selected ID through
`data-claude-aura-theme="<id>"`. Shared components consume semantic variables;
theme-specific structural refinements live under root selectors such as:

```css
html.claude-aura[data-claude-aura-theme="my-theme"] [role="dialog"] {
  border-radius: var(--aura-card-radius);
}
```

Keep theme checks in the registry, compiler, or centralized variant stylesheet.
Do not scatter ID checks through unrelated application logic.

## Canonical themes

Registry order is part of the picker experience:

1. `default` — Default
2. `japanese-film-editorial` — Japanese Film Editorial
3. `korean-prestige` — Korean Prestige
4. `cartoon-studio` — Cartoon Studio
5. `anime-twilight` — Anime Twilight
6. `study-library` — Study Library
7. `japanese-idol` — Japanese Idol
8. `korean-idol` — Korean Idol

IDs are lowercase kebab-case and must remain stable after release. The Default
theme is the safe fallback.

## Register a theme

Add one entry to `themes/registry.json`. The following is a valid structural
example; replace the locale placeholders with reviewed copy before committing:

```json
{
  "id": "my-theme",
  "labels": {
    "en": "My Theme",
    "zh-CN": "<localized name>",
    "zh-TW": "<localized name>"
  },
  "descriptions": {
    "en": "A short, concrete description of the interface character.",
    "zh-CN": "<localized description>",
    "zh-TW": "<localized description>"
  },
  "swatches": ["#F5F1E8", "#26312B", "#527A65", "#B66C4A"],
  "preview": {
    "chrome": "#202722",
    "background": "#EEE9DE",
    "surface": "#FAF7F0",
    "accent": "#527A65",
    "text": "#252A27"
  },
  "artwork": null
}
```

Rules enforced by the registry validator:

- every ID is unique and references `themes/<id>.json`;
- `labels` and `descriptions` include `en`, `zh-CN`, and `zh-TW`;
- three to six six-digit hexadecimal swatches are provided;
- `preview` defines `chrome`, `background`, `surface`, `accent`, and `text`; and
- artwork, when present, stays under `assets/theme-art` (one subdirectory level
  is allowed) and uses an approved SVG, PNG, WebP, or AVIF extension.

A theme may declare either a single `artwork` slot or an `artworkLayers` array
of one to four layers. Each layer supports `path`, `position`, `size`,
`mobile` (`reduce`, `hide`, or `keep`), `opacity` (0–1), and `mask`
(`soft-right` for the right-anchored edge fade, or `none`). Layers are embedded
as data URLs only for the active theme and render as inert, pointer-safe
backdrop divs behind the interface (see the japanese-idol entry for a layered
example: watercolor background, hero portrait, and two sakura clusters). Keep
raster layers optimized WebP; `scripts/convert-theme-assets.mjs` shows the
local conversion pattern. The chrome portion of every payload must stay under
65 KB and total embedded artwork under 1.4 MB (enforced by the tests).

`listThemes({ locale })` resolves display copy from this registry. Windows uses
the current UI culture when requesting picker metadata. Locale normalization
maps `zh-CN`, `zh-SG`, and `zh-Hans` tags to `zh-CN`; it maps `zh-TW`,
`zh-HK`, `zh-MO`, and `zh-Hant` tags to `zh-TW`. Other tags use English.

Theme code must remain language-independent. Do not put localized interface
copy in theme CSS or artwork.

## Define the interface system

Create `themes/<id>.json`. Copy `themes/default.json` when starting a new theme
so both modes and every component profile field are present.

Top-level fields are:

| Field | Purpose |
| --- | --- |
| `name` | Stable ID matching the registry entry and filename |
| `variant` | Central component-variant ID; normally the same as `name` |
| `blur` | Shared backdrop blur amount from 0 to 40 |
| `typography` | UI, display, body, and monospace system-font stacks plus display weight and tracking |
| `shape` | Control, card, composer, and icon radii plus border width |
| `effects` | Soft/elevated shadows, hover lift, and transition duration |
| `light`, `dark` | Semantic colors and wallpaper behavior for each appearance mode |
| `customCss` | Optional narrowly scoped CSS for exceptional cases |

Use reliable system-font fallbacks. Claude Aura has no runtime font CDN and
does not bundle third-party font files.

## Semantic tokens

Semantic values use HSL components without `hsl()`, for example
`258 66% 38%`. Each mode must directly define:

- `--aura-background-primary`
- `--aura-background-secondary`
- `--aura-sidebar-background`
- `--aura-panel-background`
- `--aura-elevated-surface`
- `--aura-text-primary`
- `--aura-text-secondary`
- `--aura-text-muted`
- `--aura-text-on-accent`
- `--aura-accent-primary`
- `--aura-accent-secondary`
- `--aura-border-emphasis`
- `--aura-composer-background`
- `--aura-card-background`
- `--aura-destructive`
- `--aura-success`
- `--aura-warning`

The validator derives consistent defaults for overlay, sidebar text, sidebar
selection, disabled text, subtle borders, focus rings, hover/selected/disabled
surfaces, and informational status. Define those optional roles explicitly when
the default relationship is not appropriate for the theme.

The compiler then generates Claude compatibility variables from the semantic
map. This keeps legacy Claude token names at the integration boundary while
theme authors work with stable roles. New themes should not be authored as raw
color swaps of `--bg-*` and `--text-*` ramps.

## Wallpaper behavior

Each light and dark mode also defines:

| Field | Purpose |
| --- | --- |
| `gradient` | CSS gradient used when no custom image is present |
| `surfaceAlpha` | Opacity of content surfaces over decoration |
| `sidebarAlpha` | Opacity of the sidebar over decoration |
| `imageOpacity` | Default opacity for a user-provided background image |
| `artOpacity` | Opacity of registered theme artwork |
| `textureOpacity` | Strength of the shared lightweight texture layer |

Decoration must not be required to understand or operate the interface. Keep a
readable text-safe region and verify the theme with artwork unavailable.

## Component variants

Tokens establish the shared color and material system. Use
`assets/theme-variants.css` for meaningful differences in typography,
navigation, cards, composer treatment, icon containers, menus, dialogs, and
selected states.

Every selector must begin with the stable root attribute. Prefer semantic
elements, roles, ARIA state, stable data attributes, and existing shared hooks.
Generated utility classes can change on any `claude.ai` deployment.

Do not:

- hide permission, safety, sign-in, error, or account controls;
- replace interactive content with generated images;
- bake fake controls into artwork;
- reduce readable body or control copy below 12 px; or
- add constant or distracting motion.

## Artwork

Optional bundled art is registered separately from the theme JSON. Use only an
isolated asset under `assets/theme-art`:

```json
"artwork": {
  "path": "assets/theme-art/my-theme.svg",
  "position": "right center",
  "size": "min(58vw, 860px) auto",
  "mobile": "reduce"
}
```

Set `mobile` to `reduce` or `hide`. Artwork layers are loaded only for the
active theme, receive an empty accessible name, and remain pointer-inert.

Bundled SVG requirements:

- original project artwork with a documented license;
- self-contained, lightweight, and free of external or embedded resources;
- no functional controls, rasterized interface, or embedded UI text;
- `aria-hidden="true"`, `focusable="false"`, and `pointer-events="none"` on
  the root; and
- fictional, non-endorsing figures when a human form is used.

The composites under `theme_demo_previews` are art-direction references only.
Never register, read, trace, vectorize, or embed them in a runtime theme. The
renderer and preview builder do not read them, and the release builder excludes
the directory. The built-in Studio selector pipeline is the only narrow
exception: maintainers may use `convert-theme-assets.mjs --card-previews` to
produce explicit text- and control-free 640 x 360 crops under
`assets/theme-art/<id>/card-preview.webp`. Those files are decorative picker
media, not theme backgrounds; user themes must provide their own distributable
selector artwork.

## Contrast and accessibility

- Keep normal text at 4.5:1 or better against its actual surface.
- Verify text on both primary and secondary accent colors.
- Make focus visible in every mode; do not rely on color alone for selection.
- Preserve keyboard operation, text resizing, reduced motion, and forced-color
  behavior.
- Test loading, error, disabled, hover, active, selected, menu, and dialog
  states—not only the home canvas.
- Check representative desktop sizes and Windows scaling at 100%, 125%, and
  150%.

## Custom CSS

`customCss` is intentionally powerful and should be rare. Keep selectors narrow
and rooted to the theme. All `@import` rules, `url()` functions, and backslash
escapes are rejected, including protocol-relative forms. Shared component changes belong in `assets/base.css` or
`assets/theme-variants.css`, not repeated in multiple theme files.

## Persistence and migration

The installed app stores the selected stable ID in its local `config.json`.
Theme changes are written atomically. A ready Claude view updates immediately;
during startup or sign-in, the saved selection applies when the view becomes
ready. Invalid or removed IDs fall back to `default`.

Legacy aliases currently preserve earlier saved choices:

| Earlier ID | Canonical ID |
| --- | --- |
| `midnight` | `default` |
| `ember` | `japanese-film-editorial` |
| `forest` | `study-library` |
| `sakura` | `japanese-idol` |

Do not remove an alias while released configurations may still contain it.

The offline preview stores its own theme and mode in browser-local storage. It
does not update the installed app configuration.

## Validate and preview

```powershell
npm run themes
node scripts/theme-cli.mjs list --locale zh-CN
node scripts/theme-cli.mjs validate --theme my-theme
npm run preview:build
npm run preview:serve
npm test
npm run check
```

Open `http://127.0.0.1:4173/preview/` after starting the preview server. Inspect
both modes, Home and Code, keyboard focus, the composer, menus, dialogs, and the
component-state examples.

Before packaging, run the checks and then:

```powershell
npm run release
```

The release archive intentionally omits `.git`, dependency/build directories,
logs, temporary files, and `theme_demo_previews`.
