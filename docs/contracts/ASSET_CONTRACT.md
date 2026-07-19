# Asset Generation Contract (Tier 2 — base-theme production)

──────────────────────────────────────────────────────────────────────────────
0. REPO ADAPTATION HEADER — read first; overrides any conflicting section below
──────────────────────────────────────────────────────────────────────────────

SCOPE. This contract governs ASSET-PRODUCING work orders for the eight base
themes (Tier 2). User-built custom themes follow `docs/THEME_KIT_SPEC.md`
(Tier 1) instead — never impose this contract's process on end users.
Plumbing/code work orders are governed by `AGENTS.md` alone.

PRODUCTION MODEL. Claude Aura skins the REAL claude.ai; in production the live
app supplies all interface structure, controls, and text. Any "reconstructed
live HTML interface" in this contract refers exclusively to the existing QA
surfaces: `preview/` (offline harness) and the payload harness
(`npm run verify:cycle`, which renders the actual injected payload against
`tests/fixtures/claude-dom.html`). Extend those when a surface is missing.
Never build a parallel Claude reconstruction, and never ship reconstructed
interface HTML as product.

LIVE AURA ACCEPTANCE. The QA surfaces are preflight evidence, not substitutes
for production inspection. A base theme cannot receive parity approval until
it has been reviewed in the actual Aura WebView2 window on real `claude.ai` in
light and dark per `docs/SCREENSHOT_PLAN.md`. Because the live site changes
independently, these captures are human-review evidence and never automated
goldens. Judge only Aura-controlled artwork, materials, palette, decorative
density, typography categories, and placement; never require Aura to recreate
the reference composite's interface structure, controls, or wording.

PATH REMAP.
  references/, concept/_provisional/, qa/  → themes/<id>/{references,provisional,qa}/
  integration/                             → the payload harness + preview/ (do not duplicate)
  approved concept freeze (§6)             → docs/golden/<id>/ plus a checksum line in
                                             docs/golden/REFERENCE_LOCK.md
  numbered-asset ZIP delivery (§17)        → source kit + derived assets/theme-art/<id>/ wired
                                             through the registry's artworkLayers, verified by
                                             `npm run verify:cycle`; archives come from
                                             `npm run release` only.

APPROVAL REMAP. "Phase 1 approval" = a HUMAN CHECKPOINT in
`docs/plans/QUEUE.md`. The approved deterministic render becomes the golden
image; the golden-diff step of `verify:cycle` then enforces §19 immutability
mechanically. Actual Aura captures remain separate human-review evidence and
are not hashed into the golden ledger. §11's internal candidates: cap at three,
keep them under `provisional/candidates/`, never show them at checkpoints.

QA CONSOLIDATION. The §12 outputs are panels of ONE generated `qa-board.png`
per asset (plus `status.json`), produced by
`node scripts/theme-cli.mjs qa <id>` — implement that command once (work order
WO-04) and reuse it; do not hand-compose QA imagery. §15 applies: the board
must be generated from the actual production files.

FORMAT POLICY. §7 (format follows appearance) supersedes any earlier blanket
"PNG not SVG" instruction. Painterly/photographic art ships as WebP with the
PNG master kept in the source kit. Genuinely flat geometry may remain SVG.

BUDGETS (absent from this contract, enforced by tests, non-negotiable):
per theme, payload minus artwork < 65 KB; total embedded artwork < 1.4 MB;
each raster layer < 400 KB. Budget beats "lossless": lossy WebP that is
visually indistinguishable at intended CSS size is compliant. An asset that
cannot meet both fidelity and budget is a §18 block — never a silent
downgrade.

TEXT INVENTORY. `content-inventory.json` covers ONLY decorative lettering
baked into artwork (exact Unicode, per theme, any language), constrained by
the project's localization rule: decorative foreign-script text stays minimal
and non-essential. Interface strings are the live app's own and are never
inventoried, rendered, or baked.

REFERENCE ANALYSIS TRIM. In §3, skip the interface surveying items (sidebar
width, composer/card/header bounds, spacing relationships, responsive
assumptions) — the live claude.ai dictates structure. Keep the art-direction
items: palette, opacity, borders, shadows, radii, illustration style,
decorative density, typography categories, ambiguities.

INVARIANTS. `AGENTS.md` invariants (sign-in cover, UTF-8 decoding,
pointer-safe inert artwork, reversibility, no new dependencies, stable theme
IDs) apply throughout and outrank this contract where they conflict.

──────────────────────────────────────────────────────────────────────────────
CODEX-SPECIFIC ASSET GENERATION CONTRACT (as supplied — apply through the
adaptation header above)
──────────────────────────────────────────────────────────────────────────────

This section governs how Codex must execute the project.

It overrides any earlier instruction that would force an inappropriate
production format or permit a visually inaccurate shortcut.

──────────────────────────────────────────────────────────────────────────────
1. ALLOWED VISUAL SOURCES
──────────────────────────────────────────────────────────────────────────────

Use only:

1. The supplied default Claude Desktop screenshots
2. The supplied theme-preview screenshot
3. The approved Phase 1 interface screenshot after approval
4. Files generated inside this project from those references

Do not browse the web for additional visual references.

Do not introduce outside UI kits, illustrations, characters, logos, fonts,
patterns, stickers, or visual motifs.

Do not use remembered versions of Claude as a substitute for inspecting the
supplied Claude screenshots.

Inspect every supplied reference at its native resolution before beginning.

──────────────────────────────────────────────────────────────────────────────
2. SOURCE-OF-TRUTH CHAIN
──────────────────────────────────────────────────────────────────────────────

Before Phase 1 approval:

- Claude screenshots are authoritative for interface structure.
- The theme preview is authoritative for visual language.

After Phase 1 approval:

- The approved Phase 1 screenshot becomes authoritative for the exact visual
  appearance, composition, proportions, subject styling, asset placement,
  decorative density, wording, and material treatment.
- Claude screenshots remain authoritative for interface behavior and structure.
- The original theme preview becomes secondary and may only resolve details
  that are not visible in the approved concept.

Never reinterpret an approved visual element from scratch when its appearance
is already defined in the approved concept.

──────────────────────────────────────────────────────────────────────────────
3. MANDATORY REFERENCE ANALYSIS
──────────────────────────────────────────────────────────────────────────────

Before generating Phase 1, create the following internal project files:

- `reference-analysis.md`
- `visual-tokens.json`
- `component-map.json`
- `content-inventory.json`
- `asset-map.json`
- `DECISIONS.md`

`reference-analysis.md` must document:

- Native dimensions of every reference
- Which screenshot defines which Claude surface
- Palette samples
- Surface opacity
- Border personality
- Shadow and glow personality
- Corner-radius families
- Illustration style
- Decorative density
- Typography categories
- Areas where the references are ambiguous

`content-inventory.json` must contain every visible required decorative
string exactly, including:

- Wording in each language used by the artwork
- Capitalization
- Punctuation
- Hearts and sparkle characters
- Dates and times

Do not rely on memory for any string.

`asset-map.json` must record, for every proposed art asset:

- Asset ID
- Name
- Reference screenshot
- Reference bounding box
- Intended rendered bounding box
- Anchor point
- Z-index
- Safe area
- Production format
- Native export size
- Intended CSS size
- Whether the asset is decorative or meaningful
- Whether the asset is provisional, approved, superseded, or production-ready

──────────────────────────────────────────────────────────────────────────────
4. PHASE 1 MUST BE AN ASSEMBLED INTERFACE
──────────────────────────────────────────────────────────────────────────────

Do not create the Phase 1 interface as a single one-shot generated image.

Instead:

1. Use the existing live QA surfaces (preview/ and the payload harness).
2. Keep all navigation, cards, labels, buttons, composer controls, menus,
   selection states, and interface text live.
3. Generate provisional artwork as separate layers.
4. Composite those layers into the live interface.
5. Render the interface in a real browser at the exact requested dimensions.
6. Capture one full-window screenshot.
7. Deliver only that screenshot during Phase 1.

The Phase 1 screenshot must be the result of the actual layered composition,
not an illustration that merely resembles an application.

All visible interface text must be rendered as live text so that it is exact,
readable, and free of image-generation spelling errors.

──────────────────────────────────────────────────────────────────────────────
5. PROVISIONAL CONCEPT ART
──────────────────────────────────────────────────────────────────────────────

During Phase 1, Codex may create provisional internal art layers when necessary
to assemble the concept.

Store them under:

`themes/<id>/provisional/`

These files:

- Are not yet production assets
- Must not be delivered as numbered asset packages
- Must remain separate from interface controls
- Must be generated at sufficient resolution for later production use
- Must not contain unrelated interface elements
- Must not be deleted after the screenshot is approved

Examples include:

- Provisional hero subject
- Provisional atmospheric background
- Provisional logo artwork
- Provisional stickers
- Provisional card illustrations
- Provisional decorative clusters

After approval, Codex should promote, clean, rematte, upscale, crop, or re-export
the exact provisional source whenever doing so preserves the approved result.

Do not regenerate a new hero subject, new face, new logo shape, new sticker
lettering, or new illustration style after approval merely because production
has begun.

──────────────────────────────────────────────────────────────────────────────
6. FREEZE THE APPROVED CONCEPT
──────────────────────────────────────────────────────────────────────────────

Immediately after Phase 1 approval:

1. Copy the approved screenshot to `docs/golden/<id>/` using the
   verify-cycle naming convention.

2. Calculate and record its SHA-256 checksum in `docs/golden/REFERENCE_LOCK.md`.

3. Record:

   - Native dimensions
   - Approval date
   - Screenshot checksum
   - Reference hierarchy
   - Approved visible decorative strings
   - Approved asset bounding boxes

4. Never overwrite this file.

5. Every asset specification must name the approved screenshot checksum
   against which it was produced.

If the approved concept changes, explicitly invalidate affected downstream
assets and request fresh approval. Do not silently update them.

──────────────────────────────────────────────────────────────────────────────
7. FORMAT FOLLOWS APPEARANCE
──────────────────────────────────────────────────────────────────────────────

Choose the production format according to the approved appearance, not according
to the asset category name.

Use live HTML/CSS for:

- Interface text
- Navigation
- Buttons
- Inputs
- Composer
- Cards
- Menus
- Statuses
- Focus states
- Simple borders
- Simple shadows
- Simple gradients
- Layout
- Responsive behavior
- Generic library icons

Use WebP (PNG master retained in the source kit) for:

- Photographic subjects
- Painterly subjects
- Glossy miniatures
- Pearlescent objects
- Soft glowing hearts
- Bloom-heavy sparkles
- Complex stickers
- Hand-painted lettering
- Atmospheric clusters
- Detailed textures
- Artwork whose appearance depends on soft translucency or layered shading

Use SVG only when the approved artwork is genuinely:

- Flat
- Geometric
- Line-based
- Shape-driven
- Cleanly reproducible as vector paths
- Intended for runtime recoloring

Do not use SVG merely because the asset is called a:

- Logo
- Motif
- Sticker
- Badge
- Card illustration
- Icon

Do not manually approximate soft painterly or glossy artwork using thick SVG
outlines, generic gradients, or procedural primitives.

Do not create `currentColor` variants, symbol sprites, compact marks, dark-mode
variants, monochrome variants, or alternate versions unless:

- They are visibly defined in the approved design, or
- They are genuinely required by the implementation.

The simplest faithful production format is preferred.

──────────────────────────────────────────────────────────────────────────────
8. TOOL-CHOICE RULE
──────────────────────────────────────────────────────────────────────────────

Use image generation or image editing for artwork that requires:

- A photographic or painterly subject
- Soft three-dimensional rendering
- Complex material appearance
- Gloss
- Pearlescence
- Organic handwriting
- Complex translucency
- Detailed atmospheric imagery

Use image-processing code for:

- Cropping
- Compositing
- Alpha cleanup
- Background removal
- Edge decontamination
- Matting
- Resizing
- Color-profile conversion
- Density exports
- Contact sheets
- Preview boards
- QA comparisons
- Checksums

Use procedural drawing only when the reference clearly consists of simple,
repeatable geometry.

Do not use procedural Python or SVG drawing as a substitute for a capable image
generation/editing tool when it visibly reduces fidelity.

If no capable image-generation tool is available in your environment, follow
§18: write `asset-request.md` in the source kit (sizes, transparency, safe
areas, focal points, and a ready-to-paste generation prompt per asset), mark
the theme "awaiting art", and continue with other queue work. Procedural
output may only ever be a placeholder and must carry `PLACEHOLDER` in its
filename.

──────────────────────────────────────────────────────────────────────────────
9. NO INVENTED ASSETS
──────────────────────────────────────────────────────────────────────────────

Do not invent an asset merely because it would be convenient.

Examples:

- Do not invent a compact logo if the approved concept does not define one.
- Do not invent custom icons for generic interface actions.
- Do not invent mobile compositions that are not supported by the references.
- Do not invent alternate stickers.
- Do not invent new wording.
- Do not invent a named identity for an unnamed hero subject.
- Do not invent dark-mode artwork unless requested.

When an asset is not visibly defined, omit it or mark it as unresolved in
`DECISIONS.md`.

──────────────────────────────────────────────────────────────────────────────
10. EXACT TEXT AND LETTERING
──────────────────────────────────────────────────────────────────────────────

All live interface wording must remain live text supplied by the real app.

For decorative lettering that is integral artwork:

- Use the exact required Unicode string.
- Preserve capitalization, punctuation, spacing, hearts, and sparkle symbols.
- Verify each language independently.
- Do not substitute similar wording.
- Do not approximate handwriting with an unrelated italic or script font.
- Do not distribute font files.
- Do not allow generated documentation previews to alter or misspell the text.

Before delivery, compare the artwork against `content-inventory.json`.

A single missing, misspelled, or substituted word is a failed asset.

──────────────────────────────────────────────────────────────────────────────
11. INTERNAL CANDIDATE AND SELF-REVIEW PROCESS
──────────────────────────────────────────────────────────────────────────────

For each asset:

1. Extract the corresponding approved-concept crop.
2. Generate or reconstruct up to three internal candidates when necessary.
3. Render every candidate at its intended CSS size.
4. Composite each candidate into the cumulative live interface.
5. Compare each result with the approved concept.
6. Select the closest candidate.
7. Continue revising internally if none meet the acceptance criteria.
8. Deliver only the selected candidate.

Do not make the user approve obviously inferior drafts that Codex can identify
and correct itself.

Do not present multiple candidates unless the references genuinely permit more
than one interpretation.

──────────────────────────────────────────────────────────────────────────────
12. REQUIRED VISUAL QA FOR EVERY ASSET
──────────────────────────────────────────────────────────────────────────────

Before an asset is production-ready, generate its `qa-board.png` (via
`theme-cli qa <id>`) whose panels include:

- Reference crop
- Production render at intended size
- Side-by-side comparison
- Overlay comparison (production over reference at ~50% opacity)
- Transparent-checker view
- Intended-surface composite
- White-surface and dark-edge tests
- Small-scale test
- In-context deterministic payload-harness render

For full-bleed backgrounds, test responsive `cover` crops instead of alpha.

For vectors, rasterize the actual production SVG for QA.

For raster assets, decode the actual production WebP for QA.

Do not create QA from an alternate source file that differs from the delivered
production asset.

The actual Aura WebView2 review is separate checkpoint evidence because it
depends on an authenticated external service. Perform it at theme completion
under `docs/SCREENSHOT_PLAN.md`; never fabricate it as a QA-board panel or
replace it with the deterministic in-context render.

──────────────────────────────────────────────────────────────────────────────
13. VISUAL ACCEPTANCE CRITERIA
──────────────────────────────────────────────────────────────────────────────

An asset fails if any of the following are true:

- Its silhouette materially differs from the approved concept.
- Its pose or subject changes.
- Its scale or anchor visibly differs.
- Its stroke weight changes the style.
- Its gloss, bloom, texture, or dimensionality is lost.
- It becomes a generic flat vector approximation.
- It contains a visible rectangular background.
- It has pale, dark, or colored alpha halos.
- Its colors feel materially different at intended UI size.
- Its decorative density differs from the approved composition.
- Its wording is wrong.
- It is unreadable at intended size.
- It overlaps live text or controls.
- It includes unrelated interface elements.
- It requires a hardcoded screen position to appear correct.
- It looks correct only inside the documentation preview.
- The preview does not use the actual production files.

Do not describe an asset as reference-locked unless the comparison files
demonstrate that claim.

──────────────────────────────────────────────────────────────────────────────
14. CUMULATIVE LIVE INTEGRATION
──────────────────────────────────────────────────────────────────────────────

The cumulative implementation IS the repository: registry `artworkLayers`,
`assets/theme-art/<id>/`, and the QA surfaces.

After every approved asset:

1. Wire it through the registry.
2. Run `npm run verify:cycle` and inspect the theme's render.
3. Compare it against the approved concept (golden diff).
4. Check that previously approved assets have not moved or changed.
5. Record the result in the source kit's `status.json`.

At per-theme completion, capture and review the cumulative composition in the
actual Aura WebView2 window in both modes before granting parity approval.

Do not wait until the final asset to discover that individually acceptable
assets do not work together.

──────────────────────────────────────────────────────────────────────────────
15. DOCUMENTATION PREVIEWS MUST BE REAL
──────────────────────────────────────────────────────────────────────────────

Do not use an image-generation model to create:

- Labeled preview boards
- Contact sheets
- Code samples
- Specification diagrams
- Transparency checkers
- Before-and-after comparisons
- File listings

Generate documentation previews programmatically from:

- The actual production asset files
- Actual text
- Actual filenames
- Actual dimensions
- Actual code snippets

Open and decode every preview before delivery.

A polished but fabricated preview is a failed deliverable.

──────────────────────────────────────────────────────────────────────────────
16. PRODUCTION ECONOMY
──────────────────────────────────────────────────────────────────────────────

Do not maximize the number of files.

Maximize fidelity, usability, and clarity.

Only create:

- Formats the implementation will actually use
- Density variants that are useful
- Fallbacks that are necessary
- Documentation that proves correct usage
- Variants supported by the approved design

Do not create unnecessary:

- CurrentColor versions
- Symbol sprites
- Standalone duplicates
- Fake compact marks
- Unused icon sets
- Alternate colorways
- Dark variants
- Placeholder assets
- Preview-only art

Completeness is not measured by file count.

──────────────────────────────────────────────────────────────────────────────
17. FILE VALIDATION
──────────────────────────────────────────────────────────────────────────────

Before declaring a theme's assets production-ready:

- Decode every PNG.
- Decode every WebP or AVIF.
- Parse every SVG.
- Confirm native dimensions.
- Confirm the expected alpha channel.
- Confirm that transparent assets contain nonzero visible pixels.
- Confirm that no image contains an unintended matte.
- Confirm that registry paths resolve and budgets pass (`npm run check`).
- Confirm the QA board renders from the production files.

If any validation fails, repair it before delivery. Release archives are
produced only by `npm run release`.

──────────────────────────────────────────────────────────────────────────────
18. BLOCKED-QUALITY RULE
──────────────────────────────────────────────────────────────────────────────

If available tools cannot reproduce an approved asset to the required visual
standard:

- Do not substitute generic vector artwork.
- Do not quietly downgrade the material style.
- Do not deliver a placeholder as production.
- Do not claim that the result is reference-locked.
- Mark the asset as blocked in `docs/plans/BLOCKED.md` and the kit's
  `status.json`.
- State the precise mismatch.
- State which tool or source limitation caused it.
- Write the `asset-request.md` entry so the user can generate the art.
- Ask one targeted question only when user input can resolve the block.

──────────────────────────────────────────────────────────────────────────────
19. APPROVAL IMMUTABILITY
──────────────────────────────────────────────────────────────────────────────

After an asset is explicitly approved:

- Freeze its production files.
- Record their checksums in the kit's `SHA256SUMS.txt`.
- Mark them approved in the kit's `status.json`.
- Do not regenerate them.
- Do not recolor them.
- Do not merge them into another asset.
- Do not silently replace them.

Any necessary revision to an approved asset creates a new version and requires
new approval.

──────────────────────────────────────────────────────────────────────────────
20. DEFINITION OF DONE
──────────────────────────────────────────────────────────────────────────────

A theme's asset set is done only when:

- The actual production files exist and are wired through the registry.
- The output format matches the approved material style.
- Each asset matches its approved reference crop.
- Exact decorative wording has been verified.
- Transparency or full-bleed behavior has been tested.
- Each asset works at intended CSS size.
- The cumulative render passes the golden diff.
- The live interface still matches Claude's supplied structure.
- Accessibility behavior is documented.
- Responsive behavior is documented.
- `npm run check` and `npm run verify:cycle` pass.
- No unrelated content is baked into any asset.
- No previously approved asset has changed.
