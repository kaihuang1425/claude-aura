# Theme artwork

This directory contains seven lightweight, self-contained SVG backgrounds for the optional Claude Aura themes. The Default theme intentionally has no theme-art asset.

## Provenance and licence

All artwork in this directory is original project artwork created specifically for Claude Aura. It is not a crop, trace, vectorization, or pixel-derived copy of any supplied reference image. The human figures are abstract fictional adults and do not depict or imply any real person, celebrity, performer, or endorsement.

Copyright (c) 2026 I-Kai Huang and Claude Aura contributors. These files are distributed under the MIT License in the repository root (`LICENSE`). No third-party artwork, fonts, raster images, or external resources are embedded.

## Assets

- `japanese-film-editorial.svg` — warm paper, ink, film-frame details, and an abstract fictional adult male editorial portrait.
- `korean-prestige.svg` — midnight architectural glass, silver structure, blue rim light, and an abstract fictional adult male profile.
- `cartoon-studio.svg` — cream studio textures and an original non-human productivity mascot carrying a pencil.
- `anime-twilight.svg` — an untexted twilight science-fiction city environment with glass architecture and constellation lines.
- `study-library.svg` — books, index cards, a fountain pen, grid paper, and research diagrams; no character or mascot.
- `japanese-idol.svg` — a warm editorial composition with an abstract fictional adult female portrait, ribbons, stage light, and restrained music motifs.
- `korean-idol.svg` — a cool geometric composition with an abstract fictional adult female portrait, holographic facets, waveform rhythm, and music motifs.

## Integration

The SVG roots are marked `aria-hidden`, non-focusable, and pointer-inert. Use them only as optional decorative layers, retain an empty accessible name when rendered through an image element, and also apply `pointer-events: none` in host CSS. Keep functional controls and readable copy outside these files. Position artwork responsively with a stable aspect-ratio box or background layer so loading or failure cannot shift layout or block interaction.
