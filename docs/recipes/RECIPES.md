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

Floating launcher material (asset is
`assets/theme-art/<theme-id>/launcher-mark.png` for every row):

The asset is also the running theme identity for both Aura windows, taskbar,
notification area, and Studio rail; only the surrounding launcher material
uses the table below.

| Theme | Surface | Hover | Foreground | Accent | Border | Radius | Width |
| --- | --- | --- | --- | --- | --- | ---: | ---: |
| default | `#2F2937` | `#3B3346` | `#F4DFBB` | `#D66D4B` | `#655C70` | 16 | 1 |
| japanese-film-editorial | `#F2E8D5` | `#E7D7BC` | `#252725` | `#B64B32` | `#8E7B62` | 12 | 1 |
| korean-prestige | `#071426` | `#10243C` | `#EDF3FA` | `#5A91E6` | `#66758B` | 14 | 1 |
| cartoon-studio | `#FFF6E7` | `#FFE8C4` | `#302820` | `#EA6047` | `#302820` | 18 | 2 |
| anime-twilight | `#111A49` | `#202A68` | `#F1F1FF` | `#F0B875` | `#756FC0` | 18 | 1 |
| study-library | `#F4EEDC` | `#E7DEC4` | `#292B26` | `#AA884C` | `#1F523F` | 10 | 1 |
| japanese-idol | `#FFF5F1` | `#FFE5EB` | `#3B2930` | `#DA6F8D` | `#C7B3E6` | 20 | 1 |
| korean-idol | `#241D43` | `#33275C` | `#F7F6FF` | `#79D7E4` | `#8F78DF` | 16 | 1 |

The compact launcher is 48×48 px with a 16 px safe edge gap. Hover expands
to 176×48 px, exposes the localized Studio label and a dedicated six-dot drag
grip, and keeps the icon under the pointer whether expansion opens left or
right. Theme styling never changes those interaction dimensions.

## default
- No artwork. surfaceAlpha 0.90/0.84 (unchanged). inputBorderAlpha 0.14.

## japanese-film-editorial
- surfaceAlpha 0.82/0.80 · sidebarAlpha 0.94/0.92 · inputBorderAlpha 0.16
- Slots: light-background = warm paper/ink editorial atmosphere;
  dark-background = independently authored charcoal-night paper/ink
  atmosphere; light-hero/dark-hero = matched charcoal-ink portraits with
  appearance-authored light, right third, matte edges.
- Layers: appearance-matched background opacity 0.45; matched hero right center,
  `auto min(80%, 700px)`, opacity 0.85; conversation and unknown contexts hide
  the hero so Claude content remains unobstructed.

## korean-prestige
- surfaceAlpha 0.76/0.72 · sidebarAlpha 0.88/0.86 · inputBorderAlpha 0.15
- SUPPLIED KIT: `themes/korean-prestige/` (K-pop asset packages; wordmark v2
  present, more arriving). Read each package's own spec/HANDOFF docs before
  wiring; use the package's @1x/@2x WebP outputs where provided.
- Slots: light-background = pearl/ice-blue architectural glass;
  dark-background = supplied midnight architectural glass; light-hero and
  dark-hero = matched clean-alpha editorial portraits, right third.
- Layers: appearance-matched background opacity 0.55; matched hero right
  bottom, `auto min(84%, 740px)`, opacity 0.88; conversation and unknown
  contexts hide the hero so Claude content remains unobstructed.

## cartoon-studio
- surfaceAlpha 0.86/0.82 · sidebarAlpha 0.92/0.88 · inputBorderAlpha 0.20
  (borders stay 2px inked — soften color only, keep the ink personality)
- Slots: light-background = flat cream texture with sparse doodles;
  dark-background = independently authored deep teal-charcoal paper with
  edge doodles; hero = shared original non-human mascot, bottom-right.
- Layers: appearance-matched background opacity 0.5; mascot right bottom,
  `min(26vw, 420px) auto`, opacity 0.95, mask none (clean sticker edges),
  conversation and unknown contexts hidden.

## anime-twilight
- surfaceAlpha 0.70/0.66 · sidebarAlpha 0.84/0.80 · inputBorderAlpha 0.16
- Slots: background = twilight cityscape window light, cover (await);
  hero optional — environment carries this theme.
- Layers: background opacity 0.62 (this theme is background-led).

## study-library
- surfaceAlpha 0.86/0.84 · sidebarAlpha 0.92/0.90 · inputBorderAlpha 0.14
- No character (hard rule). Slots: light-background = ivory paper fiber;
  dark-background = independently authored deep forest-charcoal archival
  paper; shared corner-bottom = desk/shelf still-life vignette, bottom-left.
- Layers: appearance-matched background opacity 0.4; corner bottom-left
  `min(20vw, 320px) auto`, opacity 0.6, mobile hide.

## japanese-idol (kawaii) — assets exist; parity pass only
- surfaceAlpha 0.72/0.76 · sidebarAlpha 0.88/0.90 · inputBorderAlpha 0.16
- Light keeps the approved background at 0.5 and hero at 0.92 with a soft-right
  mask on new chat; conversation and unknown contexts hide the portrait.
- Dark uses two independently authored, full-bleed scenes with consistent
  night lighting: upward/right subject for new chat, preserved lower/right
  subject for conversation. They are mutually exclusive at `right top / cover /
  keep / opacity 0.82 / mask none`; unknown contexts show neither.
- Preview-only cards, marks, stickers, and decorative SVGs are retired and are
  not runtime assets.

## korean-idol
- surfaceAlpha 0.52/0.55 · sidebarAlpha 0.88/0.84 · inputBorderAlpha 0.15.
- SUPPLIED KIT: `themes/korean-idol/`. Light uses the approved atmosphere plus
  constellation composite and its isolated portrait. Dark uses two approved
  full-scene assets: the upward-shifted subject for new-chat and the preserved
  lower subject for conversation.
- Dark context scenes are mutually exclusive, `right top / cover / keep /
  opacity 0.78 / mask none`; unknown contexts show neither. Light retains its
  atmosphere and portrait composition on new chat, while conversation and
  unknown contexts hide the isolated portrait.
