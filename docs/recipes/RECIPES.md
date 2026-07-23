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
- Light appearance keeps the four previously dark-railed themes visibly light
  while retaining their identity colour. Exact sidebar
  background/text/muted/selected values are: Japanese Film Editorial
  `38 20% 84%` / `210 9% 14%` / `210 6% 37%` / `12 28% 69%`; Korean
  Prestige `216 24% 84%` / `220 32% 14%` / `218 12% 37%` /
  `216 32% 71%`; Anime Twilight `228 22% 90%` / `232 34% 18%` /
  `230 12% 42%` / `248 24% 80%`; Study Library `44 28% 90%` /
  `70 10% 17%` / `70 6% 39%` / `139 16% 78%`. Dark appearance keeps its
  existing rail recipes.
- Light primary-action fills use the softened accent values Korean Prestige
  `216 44% 45%` and Anime Twilight `258 38% 49%`. Every other theme and Dark
  appearance keep their regular accent fill.

Shared rules:
- Focus ring: accent, 3px, always visible — never softened.
- Every hero layer uses mask `soft-right` unless stated; corners use `none`.
- Backgrounds: `position center / size cover / mobile keep / mask none`.
- Any slot marked (await) → asset-request.md entry, not procedural art.

Live native-chrome baseline (WO-18; fixed recipes, not user-schema fields):

- Apply these recipes only to uniquely marked existing Claude roles. Missing,
  ambiguous, collapsed, forced-colors, cleanup, and Original-look states keep
  native presentation. The inner editor is transparent; the measured inner
  composer shell owns material and `:focus-within`, while only the outer
  new-chat group owns width/translation.
- Primary sidebar action: `accent-primary` base with `text-on-accent`; optional
  `accent-secondary` sheen at the theme-specific alpha below. Hover adds
  `hover-surface / 0.10`; press adds `text-primary / 0.08` inset. Use the
  existing control radius and state shadow.
- Ordinary/current rows: transparent rest; `sidebar-selected / 0.42` hover,
  `/ 0.58` press, `/ 0.68` current; `border-subtle / 0.12`; current icons use
  `sidebar-indicator`. Section rules use `border-subtle / 0.24`, section labels
  use `sidebar-text-muted`, and the existing footer/account control may use
  `elevated-surface / 0.28`.
- Composer shell: `composer-background / 0.94`, border
  `border-emphasis / (inputBorderAlpha + 0.04)`, existing composer radius,
  elevated shadow, and `accent-primary / 0.05` outer keyline. Editor background,
  border, and inset shadow are transparent/none. Focus moves the existing focus
  ring to the shell without suppressing the caret or editor semantics.
- Toolbar icon/pill/toggle controls: `elevated-surface / 0.28` rest,
  `hover-surface / 0.42` hover, `selected-surface / 0.58` press,
  `accent-primary` plus `text-on-accent` selected, and
  `disabled-surface / 0.66` disabled. Keep native dimensions, order, labels,
  menus, and state attributes.

| Theme | Primary sheen | Fixed live-chrome cue |
| --- | ---: | --- |
| default | 0.08 | balanced soft surface; no extra edge |
| japanese-film-editorial | 0 | flat fill; 2 px block-end editorial rule on the primary action |
| korean-prestige | 0.14 | fine inset highlight `border-emphasis / 0.12` |
| cartoon-studio | 0 | 2 px ink border and existing offset card shadow |
| anime-twilight | 0.22 | restrained accent glow `accent-secondary / 0.10` |
| study-library | 0 | 3 px block-start book-tab rule on the primary action |
| japanese-idol | 0.18 | pearlescent highlight `accent-secondary / 0.10` |
| korean-idol | 0.32 | violet-to-cyan sheen and `accent-secondary / 0.09` composer glow |

The fixed formulas above resolve through each built-in's exact Light/Dark
semantic tokens, shape, and shadow values. A user theme receives the same
neutral formulas with zero primary sheen unless it inherits a built-in
`sourceRecipe`; explicit existing palette/radius/shadow overrides still win.
WO-25 may later store validated component overrides, but it must reuse these
same runtime roles and fallback lifecycle.

Floating launcher material (derived assets are
`assets/theme-art/<theme-id>/launcher-mark.png` and `launcher-mark.ico` for
every row):

Each theme has a distinct authored identity source at 1254×1254, not one
generic mark recolored eight ways. The deterministic build emits a transparent
96×96 PNG plus a nine-frame ICO at 16/20/24/32/40/48/64/128/256 px. The active
identity spans both Aura windows, taskbar, notification area, Studio rail,
floating launcher, and the exact four Aura/Studio Desktop and Start shortcuts;
Original look uses Default. Source images and prompts stay repository-only.
Only the surrounding launcher material uses the table below.

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

The launcher is permanently 48×48 px and circular, with a 16 px safe edge gap.
Hover changes only the validated material/opacity. A whole-button press becomes
a drag after a DPI-scaled 6 px movement threshold; release before that threshold
opens Studio, and right-click opens the host menu. Theme styling never changes
those host-owned interaction dimensions or semantics.

Host loading cover (WO-18 fixed permanent recipes; not user-schema fields):

- Fill the entire Aura content area with a 32° gradient from the effective
  `studioStyle.canvas` to `studioStyle.raised`. Use `studioStyle.text` for the
  localized status, `studioStyle.accent` for the 320×6 progress indicator, and
  the validated accent/text-on-accent/border combination for Retry.
- Center the shipped 96×96 launcher mark at 76×76 above the status. Keep it
  decorative, pointer-inert, and absent in high contrast. The progress segment
  is 28% of its track and becomes a centered stationary segment when Windows
  animation is disabled.
- Draw only the row's fixed quiet cue: the primary line is
  `studioStyle.accent / 0.13`; the secondary line is the listed colour `/ 0.16`;
  secondary fills use the listed colour `/ 0.15`. These host-painted cues
  contain no text, remote resource, page reconstruction, or theme-supplied
  drawing instruction.

| Theme | Secondary | Fixed loading cue |
| --- | --- | --- |
| default | `#4BC7EE` | centred crossing orbital ellipses |
| japanese-film-editorial | `#B64B32` | left editorial rule, baseline, and registration dot |
| korean-prestige | `#5A91E6` | centred tailored diamond facet |
| cartoon-studio | `#EA6047` | offset double ink frame and corner dot |
| anime-twilight | `#F0B875` | paired dusk arcs and low horizon rule |
| study-library | `#AA884C` | folio margin plus four ruled baselines |
| japanese-idol | `#C7B3E6` | one asymmetric ribbon curve and sparkle dot |
| korean-idol | `#79D7E4` | three offset capsule outlines |

Original look, unknown themes, and user themes without `sourceRecipe` use the
Default row. Untouched user-theme copies inherit their frozen source row while
their validated palette overrides still colour the base surface and primary
accent. High contrast uses Windows system colours with no mark or cue. A
missing asset or invalid profile falls back without changing the existing
DOMContentLoaded/NavigationCompleted reveal lifecycle.

In-page wordmarks (all-eight built-in expansion authorized 2026-07-23):

Every built-in emits the same two runtime filenames:
`assets/theme-art/<theme-id>/brand-wordmark-light.png` and
`assets/theme-art/<theme-id>/brand-wordmark-dark.png`. Each transparent
344×124 raster contains the complete horizontal `Claude` lockup, not a cropped
symbol. The renderer targets a readable width of 160–172 CSS px on a uniquely
discovered expanded desktop sidebar.

| Theme | Frozen source direction | Light treatment | Dark treatment |
| --- | --- | --- | --- |
| Default | Newly authored editorial `Claude` lockup with Aura's cool indigo-violet orbital sparkle language | Cool ink serif with violet, ice-lilac, and cyan detail | Lifted ice-lilac lettering with retained violet/cyan identity detail |
| Japanese Film Editorial | Exact supplied full lockup; preserve its cinnabar chrysanthemum/starburst and serif lettering | Cinnabar and charcoal on paper | Warm cinnabar and paper-ivory on charcoal |
| Korean Prestige | Newly authored full lockup using the approved antique-gold rosette and tailored editorial serif | Midnight-navy lettering with antique gold | Warm ivory lettering with champagne gold |
| Cartoon Studio | Newly authored full lockup matching the approved coral radial mark, bold rounded lettering, and restrained teal doodle accent | Dark ink, coral, and teal | Warm cream, coral, and brightened teal |
| Anime Twilight | Newly authored full lockup matching the approved lavender radial mark and elegant dusk serif | Twilight navy with lavender | Pale lavender/ivory with luminous violet |
| Study Library | Newly authored literary bookplate lockup using the approved open-book/fountain-nib identity language | Forest, burgundy, antique gold, and charcoal | Warm ivory, antique gold, and softened forest |
| Japanese Idol | Exact supplied kawaii horizontal lockup; preserve the pink radial mark, handwritten lettering, wave, sparkle, and ribbon details | Approved pink and dark-cocoa treatment | Pink and pale-blush adaptation with identical geometry |
| Korean Idol | Exact approved supplied raster; preserve its sparkle, dot, heart, lettering, and spacing | Approved violet-to-pink treatment | Appearance-adapted pale-violet treatment with identical geometry |

The frozen source directory is
`assets/studio-previews/references/in-page-brand-wordmarks-v1/`, with one
`<theme-id>.png` per built-in and `PROMPTS.md` recording provenance and exact
generation prompts. Japanese Film Editorial and Japanese Idol reuse supplied
full-lockup sources; Korean Idol reuses its approved raster; Default, Korean
Prestige, Cartoon Studio, Anime Twilight, and Study Library are newly authored.
The source tree is repository-only and release-excluded.

All eight pairs use one shared compiled wordmark channel. It keeps Claude's
native interactive wrapper, focus behavior, and accessible name, reveals one
pointer-inert, `aria-hidden` image only after successful decode, and restores
the native visual on failure, forced colors, ambiguous discovery, undersized or
collapsed layout, SPA remount, cleanup, or Original look. Aura launcher marks
are a separate identity class and are never used here. Custom themes cannot
provide or select this built-in-only channel.

## default
- No scene artwork. surfaceAlpha 0.90/0.84 (unchanged). inputBorderAlpha 0.14.
- Expanded desktop navigation uses the Default Light/Dark wordmark pair above;
  collapsed navigation keeps Claude's native compact visual.

## japanese-film-editorial
- Expanded desktop navigation uses the Japanese Film Editorial Light/Dark
  wordmark pair above; collapsed navigation keeps Claude's native compact
  visual.
- surfaceAlpha 0.82/0.80 · sidebarAlpha 0.94/0.92 · inputBorderAlpha 0.16
- Slots: light-background = warm paper/ink editorial atmosphere;
  dark-background = independently authored charcoal-night paper/ink
  atmosphere; light-hero/dark-hero = matched charcoal-ink portraits with
  appearance-authored light, right third, matte edges.
- Layers: appearance-matched background opacity 0.45; matched hero right center,
  `auto min(80%, 700px)`, opacity 0.85; conversation and unknown contexts hide
  the hero so Claude content remains unobstructed.

## korean-prestige
- Expanded desktop navigation uses the Korean Prestige Light/Dark wordmark pair
  above; collapsed navigation keeps Claude's native compact visual.
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
- Expanded desktop navigation uses the Cartoon Studio Light/Dark wordmark pair
  above; collapsed navigation keeps Claude's native compact visual.
- surfaceAlpha 0.86/0.82 · sidebarAlpha 0.92/0.88 · inputBorderAlpha 0.20
  (borders stay 2px inked — soften color only, keep the ink personality)
- Slots: light-background = flat cream texture with sparse doodles;
  dark-background = independently authored deep teal-charcoal paper with
  edge doodles; hero = shared original non-human mascot, bottom-right.
- Layers: appearance-matched background opacity 0.5; mascot right bottom,
  `min(26vw, 420px) auto`, opacity 0.95, mask none (clean sticker edges),
  conversation and unknown contexts hidden.

## anime-twilight
- Expanded desktop navigation uses the Anime Twilight Light/Dark wordmark pair
  above; collapsed navigation keeps Claude's native compact visual.
- surfaceAlpha 0.70/0.66 · sidebarAlpha 0.84/0.80 · inputBorderAlpha 0.16
- Slots: background = twilight cityscape window light, cover (await);
  hero optional — environment carries this theme.
- Layers: background opacity 0.62 (this theme is background-led).

## study-library
- Expanded desktop navigation uses the Study Library Light/Dark wordmark pair
  above; collapsed navigation keeps Claude's native compact visual.
- surfaceAlpha 0.86/0.84 · sidebarAlpha 0.92/0.90 · inputBorderAlpha 0.14
- No character (hard rule). Slots: light-background = ivory paper fiber;
  dark-background = independently authored deep forest-charcoal archival
  paper; shared corner-bottom = desk/shelf still-life vignette, bottom-left.
- Layers: appearance-matched background opacity 0.4; corner bottom-left
  `min(20vw, 320px) auto`, opacity 0.6, mobile hide.

## japanese-idol (kawaii) — assets exist; parity pass only
- Expanded desktop navigation uses the exact-source Japanese Idol Light/Dark
  wordmark pair above; collapsed navigation keeps Claude's native compact
  visual.
- surfaceAlpha 0.72/0.76 · sidebarAlpha 0.88/0.90 · inputBorderAlpha 0.16
- Light keeps the approved background at 0.5 and hero at 0.92 with a soft-right
  mask on new chat; conversation and unknown contexts hide the portrait.
- Dark uses two independently authored, full-bleed scenes with consistent
  night lighting: upward/right subject for new chat, preserved lower/right
  subject for conversation. They are mutually exclusive at `right top / cover /
  keep / opacity 0.82 / mask none`; unknown contexts show neither.
- Preview-only cards, stickers, and unrelated decorative SVGs remain retired.
  Only the exact full wordmark source named in the shared rule above is
  reactivated through its derived Light/Dark pair.

## korean-idol
- surfaceAlpha 0.52/0.55 · sidebarAlpha 0.88/0.84 · inputBorderAlpha 0.15.
- Expanded desktop navigation uses the appearance-specific full wordmark pair
  named in the shared rule above; collapsed navigation keeps Claude's native
  compact mark.
- SUPPLIED KIT: `themes/korean-idol/`. Light uses the approved atmosphere plus
  constellation composite and its isolated portrait. Dark uses two approved
  full-scene assets: the upward-shifted subject for new-chat and the preserved
  lower subject for conversation.
- Dark context scenes are mutually exclusive, `right top / cover / keep /
  opacity 0.78 / mask none`; unknown contexts show neither. Light retains its
  atmosphere and portrait composition on new chat, while conversation and
  unknown contexts hide the isolated portrait.
