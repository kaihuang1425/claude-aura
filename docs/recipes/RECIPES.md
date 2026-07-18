# Per-theme visual recipes

Exact numbers. Apply them; do not re-derive taste. `inputBorderAlpha` feeds
WO-01 (soft borders on claude inputs/composer — focus rings untouched).
`surfaceAlpha`/`sidebarAlpha` pairs are light-mode / dark-mode and feed WO-02.
Slot lists name the PNG masters each theme's source kit needs (contract Tier
2); layer numbers are registry `artworkLayers` values.

Applied by WO-02 (final values; supersede any older numbers below):
- Art-led themes run a light, UNBLURRED content veil (`backdrop-filter: none`
  on the main canvas via theme-variants.css) so layered artwork stays crisp:
  japanese-idol surface 0.48/0.60, korean-idol 0.52/0.55, anime-twilight
  0.52/0.50, korean-prestige 0.58/0.55 (validator floor is now 0.35).
- Paper themes keep blurred fuller veils: japanese-film-editorial 0.82/0.80,
  cartoon-studio 0.86/0.82, study-library 0.86/0.84, default 0.90/0.84.

Shared rules:
- Focus ring: accent, 3px, always visible — never softened.
- Every hero layer uses mask `soft-right` unless stated; corners use `none`.
- Backgrounds: `position center / size cover / mobile keep / mask none`.
- Any slot marked (await) → asset-request.md entry, not procedural art.

## default
- No artwork. surfaceAlpha 0.90/0.84 (unchanged). inputBorderAlpha 0.14.

## japanese-film-editorial
- surfaceAlpha 0.82/0.80 · sidebarAlpha 0.94/0.92 · inputBorderAlpha 0.16
- Slots: background = warm paper grain with faint film strip (await);
  hero = charcoal-ink male portrait, right third, matte edges (await);
  corner-top-right = ink-brush branch (await).
- Layers: background opacity 0.45; hero right center, `auto min(80%, 700px)`,
  opacity 0.85; corner top-right `min(15vw, 240px) auto`, opacity 0.8,
  mobile hide.

## korean-prestige
- surfaceAlpha 0.76/0.72 · sidebarAlpha 0.88/0.86 · inputBorderAlpha 0.15
- SUPPLIED KIT: `themes/korean-prestige/` (K-pop asset packages; wordmark v2
  present, more arriving). Read each package's own spec/HANDOFF docs before
  wiring; use the package's @1x/@2x WebP outputs where provided.
- Slots: background = midnight architectural glass gradient (await);
  hero = editorial male portrait, cool rim light, right third (await).
- Layers: background opacity 0.55; hero right bottom,
  `auto min(84%, 740px)`, opacity 0.88.

## cartoon-studio
- surfaceAlpha 0.86/0.82 · sidebarAlpha 0.92/0.88 · inputBorderAlpha 0.20
  (borders stay 2px inked — soften color only, keep the ink personality)
- Slots: background = flat cream texture with sparse doodles (await);
  hero = original non-human mascot, bottom-right (await);
  card-1..3 = tool doodles (await).
- Layers: background opacity 0.5; mascot right bottom,
  `min(26vw, 420px) auto`, opacity 0.95, mask none (clean sticker edges).

## anime-twilight
- surfaceAlpha 0.70/0.66 · sidebarAlpha 0.84/0.80 · inputBorderAlpha 0.16
- Slots: background = twilight cityscape window light, cover (await);
  hero optional — environment carries this theme.
- Layers: background opacity 0.62 (this theme is background-led).

## study-library
- surfaceAlpha 0.86/0.84 · sidebarAlpha 0.92/0.90 · inputBorderAlpha 0.14
- No character (hard rule). Slots: background = ivory paper fiber (await);
  corner-bottom = desk/shelf still-life vignette, bottom-left (await).
- Layers: background opacity 0.4; corner bottom-left
  `min(20vw, 320px) auto`, opacity 0.6, mobile hide.

## japanese-idol (kawaii) — assets exist; parity pass only
- surfaceAlpha 0.72/0.76 · sidebarAlpha 0.88/0.90 · inputBorderAlpha 0.16
- Keep current four layers (background 0.5 / hero 0.92 soft-right /
  sakura-top-right 0.9 / sakura-bottom 0.75). Add from the kit when wiring
  decor slots: brand-mark = mark.svg; card-1..3 = existing card SVGs.
- Parity gaps vs board: kawaii logo in brand position, card illustrations,
  "keep shining" sticker near top-right (opacity 0.95, `min(6vw, 96px)`).

## korean-idol
- surfaceAlpha 0.74/0.70 · sidebarAlpha 0.88/0.84 · inputBorderAlpha 0.15
- Slots: background = holographic gradient with fine grid (await);
  hero = original K-pop-editorial female portrait, right third (await).
- Layers: background opacity 0.5; hero right center,
  `auto min(82%, 720px)`, opacity 0.85.
