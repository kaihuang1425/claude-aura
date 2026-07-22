# Theme artwork

This directory contains optional, pointer-inert theme artwork plus small local
theme-card thumbnails for Aura Studio. Default intentionally has no decorative
runtime artwork and uses the Studio's neutral token miniature.

## Provenance

Runtime artwork and the isolated Japanese/Korean Idol layers are project artwork
created or derived from source kits supplied for Claude Aura. They remain
separate from the real Claude interface and fail safely when unavailable.

The seven `*/card-preview.webp` files are 640 × 360 selector-only derivatives.
Six are art-led, text-free crops of the project-supplied theme demo references;
Study Library composes its retained paper and still-life masters so the card
represents the two production layers honestly. The opaque reference composites
and PNG source kits remain gitignored and unshipped. Selector previews are never
injected into Claude as backgrounds or treated as reconstructed product UI.

Project assets are distributed under the repository's MIT License. No runtime
font, image, or other resource is fetched from the network.

## Runtime assets

- `japanese-film-editorial/` — independent light and dark paper/ink
  backgrounds plus appearance-matched editorial portraits.
- `korean-prestige/` — independent pearl-day and midnight architectural
  backgrounds plus matched clean-alpha portraits.
- `cartoon-studio/` — independent cream-day and deep-teal-night backgrounds,
  with one shared transparent non-human productivity mascot.
- `anime-twilight/` — one painterly twilight cityscape intentionally reused in
  both appearances because it is already dark-authored.
- `study-library/` — independent ivory and deep-forest archival paper
  backgrounds with one shared books, index-cards, pen, and shelf still life.
- `kawaii-idol/` — light background and portrait plus mutually exclusive dark
  new-chat and conversation scenes.
- `korean-idol/` — a light scene and portrait plus mutually exclusive dark
  new-chat and conversation scenes, derived from `themes/korean-idol/`.

Default intentionally has no runtime artwork. Dedicated dark files are real
production layers, never blanket color filters over the light artwork.

## Floating launcher marks

Every permanent theme has one `launcher-mark.png`: a static, transparent
96×96 PNG built from Aura's eight-ray identity geometry and the theme's own
palette. One validated file serves the running main window, Studio window,
taskbar, notification area, Studio rail, and floating launcher. These marks are
Aura chrome, not Claude-page artwork. They contain no text, load only from
allowlisted local theme folders, and fall back to `default/launcher-mark.png`
as one unit if a theme omits or loses its mark.

Regenerate all eight byte-stable marks with:

```powershell
node scripts/build-launcher-assets.mjs
```

The theme JSON controls the surrounding surface, hover surface, label/grip
foreground, accent, border, radius, and border width. The Windows host retains
the click target, dedicated drag grip, safe edge spacing, and accessibility
name regardless of theme styling.

## Studio selector previews

- `anime-twilight/card-preview.webp`
- `cartoon-studio/card-preview.webp`
- `japanese-film-editorial/card-preview.webp`
- `japanese-idol/card-preview.webp`
- `korean-idol/card-preview.webp`
- `korean-prestige/card-preview.webp`
- `study-library/card-preview.webp`

## Integration

Renderer artwork is `aria-hidden`, non-focusable, and pointer-inert. Keep
functional controls and readable copy outside artwork. Studio selector images
use empty alternative text because each adjacent live card label names and
describes the theme.
