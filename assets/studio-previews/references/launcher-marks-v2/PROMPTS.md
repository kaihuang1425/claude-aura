# Launcher identity source prompts

These eight source marks were created for Claude Aura on 2026-07-22 with the
built-in image-generation mode. Chroma-key backgrounds were removed locally;
the transparent source PNGs were then downsampled deterministically by
`scripts/build-launcher-assets.mjs`. Preview images named in a prompt were used
only as palette and visual-language references.

The sources in this directory are repository-only production inputs. They are
excluded from installers and releases. Shipping derivatives live at
`assets/theme-art/<id>/launcher-mark.png` and `launcher-mark.ico`.

## Default

```text
Use case: logo-brand
Asset type: premium Windows app identity and compact launcher mark
Primary request: create one original Claude Aura default identity symbol, an elegant four-point aura star nested with a subtle offset halo/orbit and a warm coral luminous core; sophisticated editorial geometry, calm and premium, recognizable without resembling any existing company logo
Style/medium: clean vector-friendly brand mark with polished flat color shapes and immaculate antialiased edges
Composition/framing: exactly one centered compact symbol, balanced negative space, contained inside the central 72% of the square, strong silhouette readable at 16–48 px
Color palette: warm parchment #F4DFBB, coral #D66D4B, deep plum #2F2937, tiny warm-white highlight
Scene/backdrop: perfectly flat solid #00ff00 chroma-key background for local background removal
Constraints: background must be one uniform color with no shadows, gradients, texture, reflections, floor plane, or lighting variation; crisp separated edges; generous padding; do not use #00ff00 in the symbol; no text, letters, borrowed logos, watermark, border, badge container, rounded-square tile, cast shadow, mockup, 3D extrusion, or extra symbols
```

## Japanese Film Editorial

```text
Use case: logo-brand
Asset type: high-resolution transparent launcher identity mark source
Input images: Image 1 is a style and palette reference only. Do not reproduce, trace, or include its interface, typography, layout, imagery, or person.
Primary request: Create one original premium compact symbol for the “Japanese Film Editorial” visual theme: an expressive sumi-ink ensō whose negative space subtly suggests a camera aperture, paired with one restrained small vermilion sun/seal accent. It must feel art-directed, timeless, editorial, and distinctly Japanese without using any letters or stock cultural clip-art.
Scene/backdrop: perfectly flat solid #00ff00 chroma-key background for local background removal.
Subject: exactly one centered standalone emblem, cohesive rather than multiple floating objects; dominant black-charcoal brush aperture/ensō with a refined warm vermilion circular accent.
Style/medium: vector-friendly logo mark with authentic dry-brush character controlled into bold, clean geometry; premium print-editorial finish; mostly flat opaque color; crisp silhouette.
Composition/framing: centered square composition, emblem fills about 58% of the canvas, balanced negative space, generous even padding, no crop. Strong, instantly recognizable silhouette and simplified internal detail legible at 24–48 px.
Color palette: sumi black, warm charcoal, restrained vermilion; tiny optional warm ivory highlight only. Do not use green or #00ff00 anywhere in the emblem.
Constraints: one mark only; original design; no text, letters, kanji, numbers, signature, watermark, border, badge, enclosing tile, app-icon container, mockup, face, person, portrait, scenery, interface, or extra decorative objects. No cast shadow, contact shadow, reflection, glow, 3D extrusion, bevel, metallic foil, gradients, semi-transparent haze, stray ink splatter outside the compact silhouette, or floor plane. Background must be exactly one uniform #00ff00 with no variation, lighting, texture, or vignette. Keep all emblem edges fully separated from the background and clean enough for chroma-key removal.
Avoid: generic zen-circle clip art; obvious iris icon; thin fragile lines; micro-details; pixelation; fuzzy low-resolution texture; stock-logo look; green fringe.
```

## Korean Prestige

Original generation prompt:

```text
Use case: logo-brand
Asset type: high-resolution transparent launcher identity mark source
Input images: Image 1 is a style and palette reference only. Do not reproduce, trace, or include its interface, typography, layout, imagery, or person.
Primary request: Create one original premium compact symbol for the “Korean Prestige” visual theme: an elegant faceted celestial ice prism, merging a refined cut crystal silhouette with a subtle four-point star motif. It should feel poised, couture-level, cinematic, and quietly luxurious—not playful or game-like.
Scene/backdrop: perfectly flat solid #00ff00 chroma-key background for local background removal.
Subject: exactly one centered standalone emblem, a vertically poised abstract crystal/prism with a distinctive asymmetrical crown and a small integrated celestial glint created by the facets—not a separate floating object.
Style/medium: vector-friendly logo mark; bold precise geometry; crisp flat opaque facets, fine but sturdy champagne separators, premium editorial identity design. Suggest crystal through shape and color blocking, not transparency, glass effects, or reflections.
Composition/framing: centered square composition, emblem fills about 56% of the canvas, balanced negative space, generous even padding, no crop. Strong refined silhouette and simplified facets legible at 24–48 px.
Color palette: midnight navy and ink blue foundation, ice blue and pale silver-blue facets, restrained champagne-gold accent. Do not use green or #00ff00 anywhere in the emblem.
Constraints: one mark only; original design; no text, letters, Hangul, numbers, signature, watermark, border, badge, enclosing tile, app-icon container, mockup, face, person, portrait, scenery, interface, crown, jewelry setting, snowflake, gemstone ring, or extra decorative objects. No cast shadow, contact shadow, reflection, glow, bloom, 3D extrusion, bevel, transparent glass, gradients, semi-transparent haze, sparkles outside the compact silhouette, or floor plane. Background must be exactly one uniform #00ff00 with no variation, lighting, texture, or vignette. Keep all emblem edges fully separated from the background and clean enough for chroma-key removal.
Avoid: generic diamond clip art; esports logo; fantasy-game inventory icon; overly symmetrical stock-logo look; thin fragile lines; micro-details; pixelation; fuzzy edges; green fringe.
```

Targeted silhouette revision used for the final source:

```text
Use case: precise-object-edit
Asset type: high-resolution transparent launcher identity mark source
Input image: Image 1 is the edit target.
Primary request: broaden only the emblem's overall silhouette so it reads as a confident faceted celestial crystal crest at 16–48 px. Replace the overly tall needle-like proportion with a balanced compact diamond/crest approximately 0.68–0.75 as wide as it is tall, while preserving the midnight navy, ice-blue, pale silver-blue, champagne-gold palette, the integrated central four-point glint, and the premium couture-level facet language.
Scene/backdrop: replace transparency with a perfectly flat solid #00ff00 chroma-key background for local background removal.
Composition/framing: one centered emblem, maximum dimension about 58% of the canvas, even generous padding, no crop.
Constraints: change only the silhouette proportion and necessary facet arrangement; keep the same concept and palette. One mark only; crisp opaque separated edges; no green in the emblem; no text, letters, crown, person, badge, enclosing tile, border, cast shadow, reflection, glow, bloom, mockup, 3D extrusion, extra sparkles, watermark, or floor plane. Background must be one perfectly uniform #00ff00 with no gradient, texture, shadow, lighting variation, or vignette.
```

## Cartoon Studio

```text
Use case: logo-brand
Asset type: high-resolution transparent-source launcher identity mark
Primary request: Create one original, premium compact symbol for a “Cartoon Studio” theme: a charming Shiba Inu mascot head subtly fused with a sharpened pencil and a tiny four-point creative spark. The pencil integration should feel clever and structural (for example one ear or cheek line becoming the pencil), not like a loose extra object.
Subject: one forward-facing simplified Shiba head only; friendly but refined, no body, no human traits, no text.
Style/medium: exceptionally clean vector-friendly brand mark, flat solid color shapes, decisive dark-ink outline, balanced negative space, crisp geometric curves, restrained storybook charm; polished app-icon identity quality, not clip art.
Composition/framing: exactly one centered compact symbol, roughly circular overall footprint, generous even padding on all sides, strong silhouette and uncomplicated internal detail legible at 24–48 px.
Color palette: warm cream #F8E9D3, coral #E95F3C, deep teal #238D8A, dark warm ink #2B2119; use only these subject colors and small tonal variations if essential. Never use bright chroma green in the symbol.
Scene/backdrop: perfectly flat solid #00ff00 chroma-key background for background removal. The entire canvas outside the symbol must be one uniform exact green with no variation.
Constraints: no text, letters, numbers, words, watermark, signature, border, badge, circle, square, container, frame, mockup, background scene, face/person beyond the stylized animal mascot head, cast shadow, contact shadow, reflection, glow, gradients, texture, 3D extrusion, fuzzy edges, tiny decorative clutter, or interface elements. Do not reproduce any existing character or trademark. Keep the subject fully separated from the background with crisp antialiased edges. No #00ff00 anywhere in the subject.
```

## Anime Twilight

```text
Use case: logo-brand
Asset type: high-resolution transparent launcher identity mark source
Input images: Image 1 is a style and palette reference only. Do not reproduce, trace, or include its interface, typography, layout, landscape, or any character/person.
Primary request: Create one original premium compact symbol for the “Anime Twilight” visual theme: a graceful crescent moon integrated into one flowing aurora ribbon that resolves into a tiny warm lantern-star. The three ideas must interlock as one cohesive emblem with magical twilight energy, sophisticated enough for a premium desktop companion rather than childish mascot art.
Scene/backdrop: perfectly flat solid #00ff00 chroma-key background for local background removal.
Subject: exactly one centered standalone emblem; a bold indigo-violet crescent cradling a concise cyan-to-violet aurora ribbon, with one small warm-gold four-point lantern-star integrated at the ribbon’s tip or inner crescent.
Style/medium: vector-friendly anime-inspired identity mark; clean elegant curves; crisp flat opaque color shapes; refined cel-graphic finish; strong silhouette.
Composition/framing: centered square composition, emblem fills about 57% of the canvas, balanced negative space, generous even padding, no crop. Simplified internal detail legible at 24–48 px; crescent remains instantly readable at icon scale.
Color palette: deep indigo, midnight blue, electric cyan-blue, luminous violet, restrained warm gold. Use discrete flat color bands rather than transparency or glow. Do not use green or #00ff00 anywhere in the emblem.
Constraints: one mark only; original design; no text, letters, Japanese characters, numbers, signature, watermark, border, badge, enclosing tile, app-icon container, mockup, face, person, anime character, mascot, scenery, clouds, mountains, interface, extra stars, or floating decorative objects. No cast shadow, contact shadow, reflection, glow, bloom, 3D extrusion, bevel, gradients, transparency, haze, sparkle dust, or floor plane. Background must be exactly one uniform #00ff00 with no variation, lighting, texture, or vignette. Keep all emblem edges fully separated from the background and clean enough for chroma-key removal.
Avoid: Sailor Moon-like symbols; generic moon-and-star clip art; gaming guild emblem; kawaii face; overly thin ribbon; fragile lines; micro-details; pixelation; fuzzy edges; green fringe.
```

## Study Library

```text
Use case: logo-brand
Asset type: high-resolution transparent-source launcher identity mark
Primary request: Create one original, premium compact symbol for a “Study Library” theme: a refined open book whose central negative space and page fold form a fountain-pen nib, creating a monogram-like unified emblem rather than separate book and pen objects.
Subject: one abstract open-book/fountain-nib hybrid emblem only.
Style/medium: timeless vector-friendly editorial brand mark, flat solid color planes, precise symmetrical construction, subtly heraldic proportions, confident line weights, sophisticated restrained detailing; premium private-library stationery identity, not clip art or a literal illustration.
Composition/framing: exactly one centered compact symbol, near-square overall footprint, generous even padding, strong silhouette, balanced negative space, minimal internal cuts that remain unmistakable at 24–48 px.
Color palette: deep forest #1F4A37, burgundy #8D2430, antique gold #C6A257, ivory #F5EDD8, with a very dark forest outline; no bright green or neon color in the subject.
Scene/backdrop: perfectly flat solid #00ff00 chroma-key background for background removal. The entire canvas outside the emblem must be one uniform exact green with no variation.
Constraints: no text, letters, numbers, words, watermark, signature, border, badge, shield, circle, square, container, frame, mockup, bookshelves, loose stationery, cast shadow, contact shadow, reflection, glow, gradients, paper texture, metallic shine, 3D extrusion, fuzzy edges, tiny flourishes, or interface elements. No person or face. Keep the emblem fully separated from the background with crisp antialiased edges. No #00ff00 anywhere in the subject.
```

## Japanese Idol

```text
Use case: logo-brand
Asset type: high-resolution transparent-source launcher identity mark
Primary request: Create one original, premium compact symbol for a “Japanese Idol” theme: an elegant couture ribbon bow whose central knot and one folded tail subtly resolve into a sakura petal, accompanied by one tiny four-point petal sparkle integrated tightly into the silhouette.
Subject: one refined ribbon-bow/sakura hybrid emblem only; sophisticated and graceful, not juvenile or toy-like.
Style/medium: polished vector-friendly fashion identity mark, flat solid color shapes, precise ribbon geometry, graceful tapered curves, restrained high-end Japanese pop editorial finish; crisp and minimal, not clip art.
Composition/framing: exactly one centered compact symbol, balanced almost-square footprint, generous even padding, strong recognizable silhouette and very limited internal detail legible at 24–48 px.
Color palette: blush pink #F18FA5, soft lavender #B7A4DC, warm white #FFF7F2, deep muted rose #7A4D61 for selective outline/contrast; use no green in the subject.
Scene/backdrop: perfectly flat solid #00ff00 chroma-key background for background removal. The entire canvas outside the emblem must be one uniform exact green with no variation.
Constraints: no text, letters, numbers, words, watermark, signature, border, badge, circle, square, container, frame, mockup, background scene, person, face, hair, clothing, character, microphone, music notes, cast shadow, contact shadow, reflection, glow, gradients, glitter field, texture, 3D extrusion, fuzzy edges, tiny ornamental clutter, or interface elements. Keep the emblem fully separated from the background with crisp antialiased edges. No #00ff00 anywhere in the subject.
```

## Korean Idol

```text
Use case: logo-brand
Asset type: Korean Idol theme Windows app identity and compact launcher mark
Input image: the supplied Korean Idol preview is a palette and visual-language reference only; do not reproduce its interface or person
Primary request: create one original iridescent jewel-star symbol with a tiny heart-shaped negative-space glint and one clean orbital accent, expressing polished contemporary Korean idol energy without using a person or text
Style/medium: premium vector-friendly brand mark, smooth luminous flat-color facets, crisp silhouette, mature and refined
Composition/framing: exactly one centered compact symbol, balanced negative space, contained inside the central 72% of the square, instantly recognizable at 16–48 px
Color palette: vivid violet #8F78DF, electric cyan #79D7E4, soft lilac #C6B7F2, pearl white #F7F6FF; use restrained tonal facets, no green
Scene/backdrop: perfectly flat solid #00ff00 chroma-key background for local background removal
Constraints: background must be one uniform color with no shadows, gradients, texture, reflections, floor plane, or lighting variation; crisp separated edges; generous padding; do not use #00ff00 in the symbol; no text, letters, face, person, borrowed logos, watermark, border, badge container, rounded-square tile, cast shadow, mockup, 3D extrusion, or extra symbols
```
