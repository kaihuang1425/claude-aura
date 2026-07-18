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
