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

## 2026-07-17 — Scaffolding baseline (pre-queue)

- Repo state: 16/16 tests green at commit b9fa75d; layered kawaii artwork
  ships in the runtime; sign-in cover fix and UTF-8 fixes committed.
- Known defects queued: D1 harsh input borders, D2 washed-out artwork.
- Studio shell prebuilt under studio/ (design frozen); verification harness
  `npm run verify:cycle` and DOM fixture added.
