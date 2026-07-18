# Progress log

Append one dated entry per completed work order. Keep entries short and
factual; link evidence (screenshot paths, test output) rather than describing
it.

Format:

```
## <date> — WO-NN — <subject>
- What changed: <files / behavior>
- Evidence: dist/verify/<...>.png, test summary
- Parity scores (visual orders only): <theme>: atmosphere/artwork/typography/
  controls/composer/sidebar/states/readability → red|yellow|green each
- Follow-ups discovered: <queued as new WO / noted / none>
```

## 2026-07-18 — WO-05 — Aura Studio window and tray controls

- What changed: added a normal resizable Studio WebView2 window on the local
  `aura.studio` virtual host; strict nine-action host bridge; shared theme,
  background, enabled-state, and Desktop actions; localized tray menu with
  Studio launch, appearance toggle, Desktop launch, and clean exit. A queued
  Restore now wins over an in-flight Apply so live state cannot diverge from
  the saved config. The user-requested Checkpoint B revision adds seven local
  art-led 3:2 theme-card previews, contained label padding, one clean selection/
  focus treatment, and one reusable framing dialog for both per-theme card
  previews and the user-selected Claude background. Pointer dragging, native
  keyboard-operable focal-point/zoom controls, reset/cancel/save, exact live
  background aspect ratio, host-confirmed persistence, and native en/zh-CN/
  zh-TW copy are included. Background preview bytes are served only from a
  marker-owned, content-addressed `aura.background` cache; Studio never receives
  or supplies the source path. The config schema and renderer now preserve the
  strict focal-point/zoom values atomically and apply the same cover geometry.
- Evidence: `dist/verify/wo05-studio-live-en.png`,
  `dist/verify/checkpoint-b-v2-zh-tw-themes.png`,
  `dist/verify/checkpoint-b-v2-zh-tw-keyboard.png`,
  `dist/verify/checkpoint-b-v2-zh-cn-themes.png`, and
  `dist/verify/checkpoint-b-v2-zh-cn-keyboard.png`; live Studio exercised all
  eight themes and persisted theme/enabled/background changes through
  `config.json`; the revised gallery loaded all seven selector images in a real
  WebView2 host, applied selections immediately, and showed a single 2 px
  keyboard ring. The framing revision was exercised at the product's 1080 x 720
  viewport with the WebView bridge contract: actual pointer drags changed and
  saved both crops, the dialog waited for the host acknowledgement before
  closing, reload restored both positions, zh-TW and zh-CN labels were inspected,
  and a fresh run logged no warnings or errors. Screenshots:
  `dist/verify/checkpoint-b-studio-framing-zh-tw.png`,
  `dist/verify/checkpoint-b-card-framing-before.png`,
  `dist/verify/checkpoint-b-card-framing-after-drag.png`,
  `dist/verify/checkpoint-b-background-framing-before.png`,
  `dist/verify/checkpoint-b-background-framing-after-drag.png`, and
  `dist/verify/checkpoint-b-card-framing-zh-cn.png`. Executable regressions cover
  same-size/same-timestamp and oversized background replacement, junction
  aliases, strict numeric validation, atomic crop writes, pending-save input
  freezing, and unsupported CSS-position notices.
  `npm run check` 16/16; PowerShell parse pass; `npm run verify:cycle` 17/17
  with all 16 light/dark renders opened and inspected.
- Follow-ups discovered: theme-folder installation remains WO-07; the Studio
  guide action stays outside WO-05's exact nine-action host allowlist. The user
  approved HUMAN CHECKPOINT B on 2026-07-19.

## 2026-07-18 — WO-14 — korean-idol real artwork (out of order per user directive)

- User directive: replace SVG stand-in characters; ONLY kawaii (japanese-idol)
  and the K-pop idol kit have assets ready — other themes keep their stand-ins
  until their kits arrive. The kit at themes/korean-prestige/ is the
  KOREAN-IDOL kit (its approved concept is the lavender K-pop board); mapping
  recorded in scripts/convert-theme-assets.mjs.
- What changed: generalized converter (convert-kawaii-assets.mjs →
  convert-theme-assets.mjs, per-theme jobs/copies); derived
  assets/theme-art/korean-idol/{background,constellation,hero}.webp (6 KB
  lossy re-encode of the deliberately low-detail atmosphere master / 17 KB /
  232 KB untouched kit hero); korean-idol switched to three artworkLayers;
  stand-in korean-idol.svg deleted; ki dark surfaceAlpha 0.55 → 0.42 so the
  pale portrait survives the dark veil.
- Verified: switch mechanism probe (single backdrop, correct tokens after
  ji→ki switch); 17/17 verify-cycle gates; renders inspected light+dark.
- Follow-ups: user real-app symptom of kawaii art under Korean Idol is a
  stale install or a user-set Background image (persists across themes by
  design; Clear image removes it).

## 2026-07-17 — WO-02 — Reveal artwork (D2)

- What changed: per-theme surface/sidebar alphas applied; the surfaceAlpha
  validator floor relaxed 0.62 → 0.35 (sidebar floor unchanged; the
  prefers-contrast override still forces 1); art-led themes (japanese-idol,
  korean-idol, anime-twilight, korean-prestige) additionally drop the content
  canvas backdrop blur, which was smearing layered artwork behind the veil.
  Variants CSS compacted to stay inside the 65 KB chrome budget (556 B
  headroom on the worst theme).
- Amendment to the order as written: the "wallpaper blocks only" scope was
  insufficient — the blur and the 0.62 floor were the real blockers; both
  changes recorded here and in RECIPES.md.
- Evidence: dist/verify/*-1440x900.png, 17/17 gates; hero crisp and clearly
  visible in japanese-idol light, grid + figure visible in korean-idol dark,
  body text readable in the fixture's check block in all renders.
- Follow-ups discovered: korean-idol/korean-prestige/others still render
  stand-in SVG figures — replaced by WO-08..14 kit production.

## 2026-07-17 — WO-01 — Soften input/composer borders (D1)

- What changed: new per-theme `--aura-input-border-alpha` token (base.css
  default 0.15, per-theme values in theme-variants.css); `--claude-border-300*`
  mappings in theme-core now var-driven (peak alpha 0.62 → ~0.26); harsh
  accent composer borders softened (jfe 0.52→0.24, at 0.34→0.22, idols
  0.28→0.2, cartoon dashed 0.52→0.32). Focus-visible ring untouched.
- Evidence: dist/verify/*-light/dark-1440x900.png (17/17 gates); soft resting
  borders on search pill + composer textarea in all 8 themes; strong ring only
  on the autofocused control (intended).
- Follow-ups discovered: none.

## 2026-07-17 — Scaffolding baseline (pre-queue)

- Repo state: 16/16 tests green at commit b9fa75d; layered kawaii artwork
  ships in the runtime; sign-in cover fix and UTF-8 fixes committed.
- Known defects queued: D1 harsh input borders, D2 washed-out artwork.
- Studio shell prebuilt under studio/ (design frozen); verification harness
  `npm run verify:cycle` and DOM fixture added.
