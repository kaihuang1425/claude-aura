# Theme artwork

This directory contains optional, pointer-inert theme artwork plus small local
theme-card thumbnails for Aura Studio. Default intentionally has no decorative
runtime artwork and uses the Studio's neutral token miniature.

## Provenance

Runtime SVGs and the isolated Japanese/Korean Idol layers are project artwork
created or derived from source kits supplied for Claude Aura. They remain
separate from the real Claude interface and fail safely when unavailable.

The seven `*/card-preview.webp` files are 640 × 360 selector-only derivatives.
Six are art-led, text-free crops of the project-supplied theme demo references;
Study Library is rasterized from its current isolated SVG so the card represents
the implemented theme honestly. The opaque reference composites remain
gitignored and unshipped. Selector previews are never injected into Claude as
backgrounds or treated as reconstructed product UI.

Project assets are distributed under the repository's MIT License. No runtime
font, image, or other resource is fetched from the network.

## Runtime assets

- `japanese-film-editorial.svg` — warm paper, ink, film-frame details, and an editorial portrait.
- `korean-prestige.svg` — midnight architectural glass and blue-silver structure.
- `cartoon-studio.svg` — cream studio textures and a non-human productivity mascot.
- `anime-twilight.svg` — a twilight science-fiction environment with constellation lines.
- `study-library.svg` — books, index cards, a fountain pen, grid paper, and research diagrams.
- `kawaii-idol/` — layered Japanese Idol background, hero, sakura, marks, and motifs.
- `korean-idol/` — layered Korean Idol atmosphere, constellation, and hero.

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
