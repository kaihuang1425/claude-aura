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

- `japanese-film-editorial.svg` — warm paper, ink, film-frame details, and an editorial portrait.
- `korean-prestige.svg` — midnight architectural glass and blue-silver structure.
- `cartoon-studio/` — generated cream paper background and an original transparent non-human productivity mascot, plus the Studio selector preview.
- `anime-twilight/` — generated painterly twilight cityscape background plus the Studio selector preview.
- `study-library/` — generated ivory paper background and a transparent books, index-cards, fountain-pen, and shelf still life, plus the Studio selector preview.
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
