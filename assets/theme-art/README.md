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

Every permanent theme has its own authored identity, not a palette swap of one
generic geometry. The repository-only 1254×1254 transparent source under
`assets/studio-previews/references/launcher-marks-v2/<id>.png` is reduced
deterministically to two shipped files here:

- `launcher-mark.png`: transparent 96×96 runtime mark; and
- `launcher-mark.ico`: native frames at 16, 20, 24, 32, 40, 48, 64, 128, and
  256 px.

The active built-in ICO serves the Aura and Studio windows, taskbar,
notification area, and the exact four installed **Claude Aura**/**Claude Aura
Studio** Desktop and Start shortcuts. The PNG serves the floating launcher and
Studio rail. These marks are Aura chrome, not Claude-page artwork. They contain
no text, load only from allowlisted local theme folders, and fall back to the
Default mark as one unit if a theme omits or loses its identity. **Original
look** also uses Default identity on every surface.

Regenerate all eight byte-stable marks with:

```powershell
node scripts/build-launcher-assets.mjs
```

Standalone custom themes still provide only one validated transparent 96×96
`launcher-mark.png`. The Windows host derives a content-addressed ICO in
Aura-owned data for native surfaces and shortcuts; the kit never supplies or
controls an ICO path.

The theme JSON controls the surrounding surface, hover surface, label/grip
foreground, accent, border, radius, and border width. The Windows host retains
the click target, dedicated drag grip, safe edge spacing, and accessibility
name regardless of theme styling.

## In-page brand assets

Every frozen built-in has a complete theme-stylized horizontal `Claude`
lockup with the same two shipped filenames:

- `brand-wordmark-light.png`; and
- `brand-wordmark-dark.png`.

Each file is a transparent 344×124 production raster. The normalized source
for each theme and its prompt/provenance record stay in the repository-only,
release-excluded
`assets/studio-previews/references/in-page-brand-wordmarks-v1/` tree.

Source direction:

- Japanese Film Editorial and Japanese Idol reuse their exact supplied full
  lockups;
- Korean Idol reuses its approved supplied raster; and
- Default, Korean Prestige, Cartoon Studio, Anime Twilight, and Study Library
  use newly authored lockups matched to their frozen visual recipes.

Three exact, text-free supporting derivatives also remain:

- `japanese-film-editorial/brand-mark.svg` — the supplied 64-unit cinnabar
  chrysanthemum/starburst geometry with the approved `#B24C2C` treatment;
- `korean-prestige/brand-mark.svg` — the supplied 24-unit compact rosette in
  approved antique gold `#C7A46B`; and
- `japanese-idol/brand-mark.svg` — the supplied 128-unit twelve-petal mark with
  its approved pink gradient.

The source geometry remains in the gitignored theme kits. These shipped copies
bake any `currentColor` value so they work through an image data URL, and each
is intended to be `aria-hidden`, non-focusable, and pointer-inert. They are
source-faithful supporting assets, not the active full-wordmark channel.

Rebuild all sixteen runtime PNGs with
`node scripts/build-brand-wordmarks.mjs`. One shared renderer channel chooses
the current built-in and effective appearance, then uses the complete lockup
only in a uniquely discovered expanded sidebar. It does not crop the lockup
into an icon or borrow Aura's launcher identity. The native Claude wrapper
retains interaction, focus, and accessibility; collapsed or undersized layout,
ambiguous discovery, failed decode, forced colors, cleanup, SPA remount, and
Original look retain or restore the native visual.

The reference tree freezes:

- `PROMPTS.md`;
- `default.png`;
- `japanese-film-editorial.png`;
- `korean-prestige.png`;
- `cartoon-studio.png`;
- `anime-twilight.png`;
- `study-library.png`;
- `japanese-idol.png`; and
- `korean-idol.png`.

The builder and asset audit own the exact source digests, dimensions, runtime
dimensions, appearance distinction, and byte-budget checks. The source set and
offline asset inspection are not evidence that upstream selector discovery,
native interaction, or visual quality works in the live application. The
all-eight actual-Aura review remains open at HUMAN CHECKPOINT D. Launcher marks
remain a separate Aura-only identity surface and must never substitute for
these files. Custom themes cannot provide or redirect this built-in-only
wordmark map.

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
