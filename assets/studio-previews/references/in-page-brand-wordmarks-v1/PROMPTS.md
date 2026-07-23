# In-page brand wordmark sources

These files are repository-only production sources. They are normalized to a
transparent `344 × 124` RGBA canvas and are never loaded directly at runtime.
`scripts/build-brand-wordmarks.mjs` verifies their SHA-256 digests and emits
the shipped Light and Dark pairs under `assets/theme-art/<theme-id>/`.

Every source contains the exact word `Claude` once. The Japanese Film
Editorial and Japanese Idol sources are deterministic derivatives of their
supplied source-kit lockups. Korean Idol is the previously approved supplied
raster. The other five sources were authored with the built-in image generator
and then chroma-keyed, cropped, and resized by the deterministic local builder.
On 2026-07-23 the Default source received the geometry-preserving palette
revision recorded below so it matches the frozen cool indigo theme.

## Default

Style reference:
`assets/studio-previews/references/launcher-marks-v2/default.png`

```text
Use case: logo-brand
Asset type: compact horizontal in-page wordmark source for a desktop sidebar
Input images: Image 1 is a style reference only for the Default Aura identity palette and four-point orbital sparkle; do not copy its square composition.
Primary request: create one polished horizontal lockup containing the exact word “Claude” and a compact original sparkle/orbit mark to its left.
Subject: the word Claude, spelled exactly C-l-a-u-d-e, once and only once; elegant readable editorial serif lettering, paired with a simplified four-point orbital sparkle derived from the reference’s visual language.
Composition/framing: very wide horizontal 2.8:1 lockup, mark on the left and wordmark on the right, vertically centered, generous clear space, designed to remain legible at about 160 × 58 CSS pixels.
Color palette: deep aubergine and warm coral with restrained cream highlights, matching Image 1.
Scene/backdrop: perfectly flat solid #00ff00 chroma-key background for background removal. The background must be one uniform color with no shadows, gradients, texture, reflections, floor plane, or lighting variation.
Text (verbatim): “Claude”
Constraints: exact spelling; no other text; crisp isolated silhouette; generous padding; do not use #00ff00 anywhere in the logo; no cast shadow, no contact shadow, no reflection, no mockup, no watermark.
Avoid: square badge layout, app icon framing, extra letters, slogans, tiny illegible details, photographic scene.
```

Targeted palette revision used for the final source:

```text
Use case: precise-object-edit
Asset type: normalized horizontal Default in-page wordmark source
Input image: Image 1 is the approved Default horizontal Claude lockup.
Primary request: change only the warm aubergine, coral, and cream palette to the Default theme's cool indigo-violet, ice-lilac, and cyan language while keeping the exact word Claude and the existing orbital Aura mark.
Composition/framing: preserve the exact letters, serif geometry, mark silhouette, orbit, spacing, alignment, transparent canvas, and crop.
Color palette: cool ink #2A294E for the lettering, indigo-violet #5C4FB8 for the mark, luminous violet #7052E2 for the core, ice lilac #DDE2FF for the inner facet, cyan #4BC7EE for the orbit, and cool white #FAFCFF for the highlight.
Text (verbatim): "Claude"
Constraints: palette-only revision; keep the exact spelling once and only once; no letter, geometry, spacing, scale, crop, shadow, glow, texture, or background change.
Avoid: warm coral, orange, parchment, brown, magenta-pink, slogans, extra letters, and details that disappear at sidebar size.
```

## Korean Prestige

Style reference:
`themes/korean-prestige/korean-prestige-final-v1.0/groups/03-emblem/emblem-reference-192.png`

```text
Use case: logo-brand
Asset type: compact horizontal in-page wordmark source for a desktop sidebar
Input images: Image 1 is the approved Korean Prestige rosette reference; preserve its antique-gold radial character as the small mark, but create a new horizontal Claude lockup.
Primary request: create one refined Korean editorial horizontal lockup containing the exact word “Claude” with the compact antique-gold rosette on its left.
Subject: the word Claude, spelled exactly C-l-a-u-d-e, once and only once; high-contrast elegant editorial serif lettering with precise tailoring and restrained spacing.
Composition/framing: very wide horizontal 2.8:1 lockup, rosette on the left and wordmark on the right, vertically centered, generous clear space, designed to remain legible at about 160 × 58 CSS pixels.
Color palette: antique champagne gold and warm ivory, suitable for a midnight-navy premium interface.
Scene/backdrop: perfectly flat solid #00ff00 chroma-key background for background removal. The background must be one uniform color with no shadows, gradients, texture, reflections, floor plane, or lighting variation.
Text (verbatim): “Claude”
Constraints: exact spelling; no other text; retain a crisp isolated silhouette; generous padding; do not use #00ff00 anywhere in the logo; no cast shadow, no contact shadow, no reflection, no mockup, no watermark.
Avoid: Korean words, seals with text, slogans, extra letters, metallic 3D mockups, neon, photographic scenes.
```

## Cartoon Studio

Style reference: `assets/studio-previews/masters/cartoon-studio.png`

```text
Use case: logo-brand
Asset type: compact horizontal in-page wordmark source for a desktop sidebar
Input images: Image 1 is a style reference only for the Cartoon Studio identity. Preserve its coral radial burst, friendly bold lettering, and small teal hand-drawn accent, but do not reproduce the interface screenshot.
Primary request: create one cheerful polished horizontal lockup containing the exact word “Claude” with a compact coral radial burst on its left and a restrained teal doodle accent.
Subject: the word Claude, spelled exactly C-l-a-u-d-e, once and only once; highly readable bold rounded display lettering with playful animation-studio character.
Composition/framing: very wide horizontal 2.8:1 lockup, radial mark on the left and wordmark on the right, vertically centered, with the tiny teal squiggle or dots used only as a supporting accent; generous clear space; legible at about 160 × 58 CSS pixels.
Color palette: warm coral-orange, deep chocolate or near-black lettering, and bright teal accent, matching Image 1.
Scene/backdrop: perfectly flat solid #00ff00 chroma-key background for background removal. The background must be one uniform color with no shadows, gradients, texture, reflections, floor plane, or lighting variation.
Text (verbatim): “Claude”
Constraints: exact spelling; no other text; crisp isolated silhouette; generous padding; do not use #00ff00 anywhere in the logo; no cast shadow, no contact shadow, no reflection, no mockup, no watermark.
Avoid: mascots, clouds, full interface panels, slogans, extra letters, 3D text, photographic scenes.
```

## Anime Twilight

Style reference: `assets/studio-previews/masters/anime-twilight.png`

```text
Use case: logo-brand
Asset type: compact horizontal in-page wordmark source for a desktop sidebar
Input images: Image 1 is a style reference only for the Anime Twilight identity. Preserve its lavender radial star and refined pale serif wordmark feeling, but do not reproduce the landscape or interface screenshot.
Primary request: create one elegant dreamy horizontal lockup containing the exact word “Claude” with a compact lavender radial star on its left.
Subject: the word Claude, spelled exactly C-l-a-u-d-e, once and only once; highly readable graceful high-contrast editorial serif lettering with subtle anime-title refinement.
Composition/framing: very wide horizontal 2.8:1 lockup, radial star on the left and wordmark on the right, vertically centered, generous clear space, designed to remain legible at about 160 × 58 CSS pixels.
Color palette: twilight violet, soft lavender, muted indigo, and pale moonlit lilac, matching Image 1.
Scene/backdrop: perfectly flat solid #00ff00 chroma-key background for background removal. The background must be one uniform color with no shadows, gradients, texture, reflections, floor plane, or lighting variation.
Text (verbatim): “Claude”
Constraints: exact spelling; no other text; crisp isolated silhouette; generous padding; do not use #00ff00 anywhere in the logo; no cast shadow, no contact shadow, no reflection, no mockup, no watermark.
Avoid: landscape scenes, moon or mountains, characters, interface panels, slogans, extra letters, tiny sparkles that disappear at sidebar size.
```

## Study Library

Style reference:
`assets/studio-previews/references/launcher-marks-v2/study-library.png`

```text
Use case: logo-brand
Asset type: compact horizontal in-page wordmark source for a desktop sidebar
Input images: Image 1 is a style reference only for the Study Library identity. Preserve the recognizable open-book and fountain-nib visual language as a small mark, but create a new horizontal Claude lockup.
Primary request: create one polished literary horizontal lockup containing the exact word “Claude” with a compact open-book-and-fountain-nib emblem on its left.
Subject: the word Claude, spelled exactly C-l-a-u-d-e, once and only once; highly readable classic bookplate serif lettering with quiet scholarly character.
Composition/framing: very wide horizontal 2.8:1 lockup, emblem on the left and wordmark on the right, vertically centered, generous clear space, designed to remain legible at about 160 × 58 CSS pixels.
Color palette: forest green, oxblood burgundy, antique gold, warm ivory, and deep charcoal, matching a refined old-library aesthetic.
Scene/backdrop: perfectly flat solid #00ff00 chroma-key background for background removal. The background must be one uniform color with no shadows, gradients, texture, reflections, floor plane, or lighting variation.
Text (verbatim): “Claude”
Constraints: exact spelling; no other text; crisp isolated silhouette; generous padding; do not use #00ff00 anywhere in the logo; no cast shadow, no contact shadow, no reflection, no mockup, no watermark.
Avoid: library room scenes, piles of books, slogans, extra letters, tiny ornamental text, photographic imagery.
```

## Direct source adaptations

- `japanese-film-editorial.png` is rasterized from
  `themes/japanese-film-editorial/asset-03-theme-brand-mark/jp-prestige-claude-lockup.svg`.
- `japanese-idol.png` is normalized from
  `themes/japanese-idol/claude-kawaii-logo-horizontal@2x.png`.
- `korean-idol.png` is the approved supplied transparent source from the
  Korean Idol wordmark package.
