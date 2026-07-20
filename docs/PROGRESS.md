# Progress log

Append one dated entry per completed work order. Keep entries short and
factual; link test output and, for visual claims, only actual whole-window Aura
captures of live `claude.ai`.

> **Evidence policy update (2026-07-20):** All fixture renders, offline UI
> boards, contact sheets, comparison screenshots, and golden images referenced
> in older entries were retired and deleted. Those paths remain below only as
> historical context and must not be regenerated or used as acceptance evidence.
> `npm run verify:cycle` is now payload-only, and `theme-cli qa <id>` writes only
> a status JSON asset audit.

Format:

```
## <date> — WO-NN — <subject>
- What changed: <files / behavior>
- Evidence: actual-Aura whole-window capture path when available; test summary
- Parity scores (visual orders only): <theme>: atmosphere/artwork/typography/
  controls/composer/sidebar/states/readability → red|yellow|green each
- Follow-ups discovered: <queued as new WO / noted / none>
```

## 2026-07-21 — HUMAN CHECKPOINT C — Per-theme parity review

- Approval: the user approved the actual-Aura parity review after the Japanese
  Idol Light composition was revised to match Dark's stronger focal hierarchy.
- Evidence: the whole-window live `claude.ai` matrix and Korean Idol
  new-chat/conversation, sidebar, and interaction-state captures are indexed in
  `dist/verify/live-aura/wo17-self-capture-manifest.json`. The superseding four
  Japanese Idol revision captures are named
  `wo13-japanese-idol-*-revision-normal-aura-window.jpg` in the same directory.
- Parity scores: all eight themes —
  atmosphere/artwork/typography/controls/composer/sidebar/states/readability —
  green/green/green/green/green/green/green/green in the approved review.
- Follow-ups discovered: none. The queue advances to WO-18.

## 2026-07-21 — WO-13 — Japanese Idol parity pass

- What changed: matched the approved Japanese Idol composition with the recipe
  Light/Dark surface alphas, retained the light floral background and
  new-chat-only portrait, retired the two sakura corner derivatives, and added
  mutually exclusive full-bleed Dark new-chat and conversation scenes. The
  first Checkpoint C review found Dark's composition stronger, so the Light
  portrait was reframed from bottom-right at 86%/760px to top-right at
  74%/660px. This aligns its face with Dark's high/right focal height while
  keeping the live greeting and composer clear; Dark and Light conversation
  behavior remain unchanged. The production audit now records decoded
  dimensions, alpha/full-bleed
  expectations, per-raster limits, and embedded-art/chrome payload budgets;
  tests lock the exact four-layer registry contract.
- Evidence: actual Aura whole-window captures on signed-in live `claude.ai`:
  `dist/verify/live-aura/wo13-japanese-idol-light-new-chat-revision-normal-aura-window.jpg`,
  `dist/verify/live-aura/wo13-japanese-idol-light-conversation-revision-normal-aura-window.jpg`,
  `dist/verify/live-aura/wo13-japanese-idol-dark-new-chat-revision-normal-aura-window.jpg`,
  and
  `dist/verify/live-aura/wo13-japanese-idol-dark-conversation-revision-normal-aura-window.jpg`.
  Runtime artwork totals 489,780 bytes. The status audit passes for all eight
  themes; Japanese Idol embeds 653,140 artwork bytes with 64,536/64,535-byte
  Light/Dark chrome payloads. `npm run check` passed 20/20, `npm run
  verify:cycle` passed 17/17, and the PowerShell parser passed.
- Parity scores (visual orders only): japanese-idol:
  atmosphere/artwork/typography/controls/composer/sidebar/states/readability —
  green/green/green/green/green/green/green/green in the user-approved revision.
- Approval: the user approved HUMAN CHECKPOINT C on 2026-07-21 after reviewing
  the superseding Light revision with the unchanged Dark composition. The
  approved production artwork and recorded hashes are frozen.
- Follow-ups discovered: none. The queue advances to WO-18.

## 2026-07-21 — WO-17 — Live Aura UX, identity, and context adaptation

- What changed: added the canonical Aura SVG and deterministic nine-frame ICO;
  installed separate Aura/Studio Desktop and Start-menu shortcuts; wired
  single-instance Studio launch and a strict **Back to Claude Aura** action;
  applied Aura identity to both forms and the notification area; replaced loud
  lift/tint interaction styling with restrained surfaces and shadows; marked
  one semantic live sidebar; maintained SPA context markers; added bounded,
  clamped new-chat prompt presets and context-aware artwork overrides; and
  repaired Studio to one intentional content scroller. Original look removes
  all Aura markers, styles, art, layout, context, and forced appearance. The
  retired offline preview, fixture images, QA boards, comparison images, and
  image goldens were removed and cannot be regenerated as evidence.
- Evidence: local gitignored
  `dist/verify/live-aura/wo17-self-capture-manifest.json` records a 16-image
  whole-window matrix of the actual Aura WebView2 on signed-in live
  `claude.ai` (all eight themes × Light/Dark), Original-look cleanup, Studio
  selected/navigation/scroll behavior, notification-area identity, Korean Idol
  new-chat and Light/Dark conversation contexts, representative live
  hover/selected state, and actual **Back to Claude Aura** activation. The
  conversation hashes are
  `5f2c809e0b7a3e9237c2851466a288f03f092054cb4081de544b612ecc179fdd`
  and `23cbad22018324746bcd7a81c83df2d335c5542efbf92f2b252b00c575309293`;
  hover is
  `e88209085500bd77215681a1eac001b6c55973e90ba719b437448f37f41bddbb`.
  An actual 2560 × 1600 display at 200% supplied the complete high-DPI Aura
  title-bar capture
  `cc13896dab1d0a72aea8e56695f84468df7146204386b60af234e9a52a5e04df`
  and supplemental notification-area capture
  `99bf6f3facac294ab97dbd00f020407422eea01f0d50f9d09d780fe4da864ea1`.
  The original Korean Prestige/Dark config and single-primary 1920 × 1080
  topology were restored.
- Verification: PowerShell parser passed (11,986 tokens, zero errors);
  `npm run check` passed 20/20; `npm run verify:cycle` passed 17/17. The explicit
  48-case payload audit measured a 64,700-byte maximum payload-minus-art and
  653,140-byte maximum embedded art. `npm run release` passed on the completed
  source; archive inspection confirmed both `assets/brand/aura-mark.svg` and
  `assets/brand/claude-aura.ico`.
- Parity scores (visual orders only): all eight stable themes:
  atmosphere/artwork/typography/controls/composer/sidebar/states/readability —
  green/green/green/green/green/green/green/green for the WO-17 live matrix.
- Follow-ups discovered: none within WO-17. The queue pointer advances to
  WO-13, which was not begun.

## 2026-07-20 — WO-12 — Study Library artwork and Aura appearance modes

- What changed: replaced the procedural Study SVG with approved 1600 x 900
  paper-fiber and 640 x 527 alpha still-life WebPs; anchored the corner layer to
  the measured live main canvas; rebuilt the Studio card from both masters;
  froze the sources/runtime checksums and added a status-only asset audit; and
  added a persisted, localized, keyboard-operable **System / Light / Dark**
  Aura Studio selector using WebView2's supported profile preference plus a
  namespaced renderer fallback. Original look restores the profile to Auto.
- Evidence: actual Aura whole-window captures
  `dist/verify/live-aura/06-study-library-{light,dark}-aura-window.png`.
  The live images are 1177 x 664 and 1172 x 668 with SHA-256
  `930a65512092c3d450f1c583b16a369b942f75843ffb4bb3b83de0816aa39d15`
  and `68b64d2caea345ebe776d57446557775e64f739bcd0dd4dafe3e41f03c510d27`;
  they are the visual review evidence. Runtime art totals 58,098 bytes;
  `npm run check` passed 19/19 at completion. The current payload-only cycle
  compiles both appearance modes, and maximum non-art payload is 64,055 bytes,
  below the 65 KB cap.
- Parity scores (visual orders only): study-library:
  atmosphere/artwork/typography/controls/composer/sidebar/states/readability —
  green/green/green/green/green/green/green/green.
- Follow-ups discovered: the user requested theme-specific new-chat prompt
  positioning to match Korean Idol's demo composition; bounded live placement,
  context-aware hero treatment, Studio navigation/icon/state repair, and the
  later user-editable layout controls are queued under WO-17 and WO-18.

## 2026-07-20 — WO-11 — Anime Twilight artwork

- What changed: replaced the procedural Anime Twilight SVG with one approved,
  checksum-frozen painterly cityscape WebP; added exact `center / cover / keep /
  0.62 / none` layered-art metadata, conversion and source-audit support,
  preview metadata, and regression assertions.
- Evidence: the 60,964-byte runtime WebP decodes at 1600 x 900;
  `npm run check` passed 19/19 at completion, and the status-only asset audit
  plus current payload-only cycle cover both appearance modes. Actual Aura
  visual evidence remains pending.
- Parity scores (visual orders only): anime-twilight:
  atmosphere/artwork/typography/controls/composer/sidebar/states/readability —
  green/green/green/green/green/green/green/green.
- Follow-ups discovered: the user approved the artwork with the unavailable
  live evidence disclosed. Actual
  Aura light/dark and 1920 x 1080 dark captures remain deferred to HUMAN
  CHECKPOINT C/WO-16 under WO-09; the separate two-attempt supplemental capture
  failure is recorded historically under WO-11 in `docs/plans/BLOCKED.md`.

## 2026-07-20 — WO-10 — Cartoon Studio artwork

- What changed: replaced the procedural Cartoon Studio SVG with approved,
  checksum-frozen WebP background and original mascot layers; retained three
  approved card-doodle masters source-only; added generic layered-art preview
  data/rendering and source-aware audit/conversion coverage.
- Evidence: runtime WebPs are
  50,686 and 80,854 bytes and decode at 1600 x 900 RGB and 835 x 1032 RGBA.
  `npm run check` passed 19/19 at completion; the status-only asset audit and
  current payload-only cycle cover both appearance modes. Actual Aura visual
  evidence remains pending.
- Parity scores (visual orders only): cartoon-studio:
  atmosphere/artwork/typography/controls/composer/sidebar/states/readability —
  green/green/green/green/green/green/green/green.
- Follow-ups discovered: the PowerShell-hosted Aura whole-window capture path
  remains unavailable as recorded under WO-09 in `docs/plans/BLOCKED.md`. On
  2026-07-20 the user authorized WO-10 completion with its live light/dark and
  1280 x 720 evidence explicitly deferred to HUMAN CHECKPOINT C/WO-16.

## 2026-07-19 — WO-07 — user theme installation

- What changed: added standalone `theme.json` kits, merged user themes from
  `%LOCALAPPDATA%\ClaudeAura\data\themes\<id>\` after built-ins, preserved
  built-in/alias precedence with warnings, and wired Studio's host-owned folder
  picker through helper validation, staged copy, registry refresh, immediate
  apply, restart persistence, and one-folder uninstall fallback. Standalone
  kits reject non-empty custom CSS, unsafe SVG artwork, malformed explicit
  metadata, linked install roots, and path-redirected rollback targets; failed
  post-copy imports restore the complete prior config atomically.
- Evidence: `npm run check` 19/19, including a `constructor`-ID lifecycle,
  invalid-kit validator messages, collision warnings, restart/uninstall, exact
  PowerShell copy/delete, junction-root rejection, and full-config rollback.
  The image-producing cycle recorded at completion was retired on 2026-07-20;
  the current cycle performs payload-only Light/Dark compilation.
- Follow-ups discovered: named-slot discovery/conversion and full asset-quality
  validation remain part of the queued end-user tutorial/proof work in WO-15.

## 2026-07-19 — WO-06 — content-only main window

- What changed: removed the main-window toolbar, WinForms theme gallery,
  dynamic palette/title-bar plumbing, and their handlers from
  `windows/aura-ui.ps1`. The main form now contains only the Claude WebView2
  content panel and its loading/error cover; theme, background, Original look,
  and Desktop actions remain available through Studio and the tray.
- Evidence: PowerShell parse pass and `npm run check` 18/18 at completion. The
  then-current fixture/contact-sheet cycle was retired and deleted on
  2026-07-20; current verification is payload-only.
- Follow-ups discovered: none.

## 2026-07-19 — WO-04 — theme-cli QA board

- What changed: added `theme-cli qa <id>` and a dependency-free local
  Edge renderer that enumerates registry `artworkLayers` in order, rejects
  partial or legacy fallback, decodes the delivered WebP/SVG bytes, generates
  all contract §12 evidence panels, and embeds the real deterministic payload
  fixture. Browser-observed dimensions, alpha, panels, placement, hashes, and
  payload layer/digest evidence are written beside the board in `status.json`;
  regeneration preserves review notes but invalidates approval when production
  hashes change.
- Evidence: `npm run check` 18/18 at original completion. The current
  status-only audit verifies registered asset bytes, hashes, and both payload
  modes without creating a visual artifact.
- Parity scores (visual orders only): japanese-idol:
  atmosphere/artwork/typography/controls/composer/sidebar/states/readability →
  green/green/green/green/green/green/green/green.
- Follow-ups discovered: asset-producing WO-08..WO-13 must add their
  source-master mapping when wiring new registry layers; no new work order.
- Retirement (2026-07-20): the image-producing QA-board implementation and its
  generated boards were deleted. `theme-cli qa <id>` now performs only a
  status-JSON asset/hash and Light/Dark payload audit.

## 2026-07-19 — WO-03 — theme-cli scaffold

- What changed: added `theme-cli scaffold <id>` with exact ID validation,
  registered-ID/alias and filesystem collision protection, a valid commented
  Default-token template, an eight-slot source-kit checklist, and a paste-ready
  localized registry entry on stdout. Fresh unregistered scaffolds now validate
  through the documented `validate --theme <id>` flow instead of silently
  falling back to Default. Scaffold writes are exclusive and failed writes do
  not overwrite an existing theme.
- Evidence: the new temp-directory regression scaffolds ordinary and regex-edge
  IDs, validates the generated theme through both `validateTheme` and the CLI,
  checks every slot/spec and en/zh-CN/zh-TW metadata, proves reruns are
  non-destructive, rejects invalid/reserved IDs, and cleans up; `npm run check`
  17/17.
- Follow-ups discovered: asset conversion/QA remains WO-04; Studio folder
  installation remains WO-07.

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
- Retirement (2026-07-20): every offline Studio image named in this historical
  entry was deleted and is not current acceptance evidence.
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
- Checkpoint A approval (2026-07-19): the user approved all sixteen light/dark
  payload frames in the now-retired fixture harness. Those frames, hashes,
  harness, and golden locks were deleted on 2026-07-20 and no longer satisfy an
  acceptance gate. `npm run verify:cycle` is now payload-only.
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
  `npm run verify:cycle` and DOM fixture added. The fixture and image-producing
  harness were retired on 2026-07-20; the command is now payload-only.
