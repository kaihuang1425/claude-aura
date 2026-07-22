# Eight-theme acceptance audit

This matrix records the evidence available through 2026-07-22. **Proven** means the
implementation and a directly relevant check are present. **Partial** means
source or automated evidence exists but the required live behavior has not yet
been observed. **Pending** means the final artifact or runtime evidence still
needs to be produced. Current visual acceptance evidence consists of
interactive signed-in production `claude.ai` runs, localized Aura Studio
walkthroughs in a real WebView2 host, and explicitly identified whole-window
Aura captures. Fixture renders, offline UI boards, comparison screenshots, and
golden images were retired and deleted on 2026-07-20; they cannot satisfy any
current or future acceptance gate.

| Requirement | Evidence | Status |
| --- | --- | --- |
| Default plus seven named themes, with stable IDs and one registry | `themes/registry.json`; eight canonical `themes/<id>.json` files; exact-order registry test in `tests/run-tests.mjs` | Proven |
| Central semantic-token architecture and stable root theme attribute | `scripts/theme-core.mjs`; `assets/base.css`; `assets/theme-variants.css`; `assets/renderer-inject.js`; semantic-completeness and payload tests | Proven |
| Distinct typography, shapes, effects, controls, cards, composer, navigation, status, and theme variants | Per-theme typography/shape/effect data; centralized component recipes in `assets/theme-variants.css`; payload compilation checks and 2026-07-21 whole-window live-Aura Light/Dark captures for all eight themes | Proven for the WO-17 theme matrix and user-approved HUMAN CHECKPOINT C parity review |
| Theme gallery with name, subtitle, card image, swatches, selected state, keyboard access, immediate application, adjustable card framing, and appearance mode | Aura Studio gallery in `studio/app.js`; strict allowlisted bridge and isolated local virtual hosts in `windows/aura-ui.ps1`; seven packaged uncropped PNG masters with frozen source hashes and registry starting frames; polished 3:2 card windows; shared pointer-drag/native-range framing dialog up to 600% card zoom; native System/Light/Dark radio group; Windows assertions in `tests/run-tests.mjs`; 2026-07-18 en/zh-TW/zh-CN WebView2 walkthrough | Proven for the non-destructive master/framing contract and historical gallery walkthrough; the updated full-master framing remains part of HUMAN CHECKPOINT D |
| Theme-aware floating Studio launcher and running-app identity with safe fallback | Optional validated launcher schema; eight deterministic transparent marks; one active mark shared by the main and Studio window icons, taskbar, notification area, Studio rail/favicon, and floating launcher; 4.5:1 label contrast; 48 px compact control; localized hover expansion; dedicated six-dot grip; 16 px edge gap; strict local path/dimension/alpha/budget checks; automated Windows source assertions; all eight status audits; release and installed-file SHA-256 parity; focused installed-app smoke manifest at `dist/verify/live-aura/wo18-identity-preview-smoke/manifest.json` | Partial — all eight live Studio mark URLs cycled and the Japanese Film identity visibly synchronized across the main/Studio title bars, taskbar, rail, and expanded launcher; notification-area plus hover/click/grip review remains in HUMAN CHECKPOINT D |
| Persistent selection, immediate reapplication, legacy migration, safe Default fallback, and persisted framing | Registry aliases, atomic configuration handling, strict focal-point/zoom validation, corrupt-file preservation/recovery in `scripts/theme-core.mjs` and `scripts/theme-cli.mjs`; payload-returning init/set/recovery tests; Windows startup and navigation reapply flow; the 2026-07-18 Studio bridge walkthrough restored both card and background crop values after reload | Proven for storage, migration, recovery, framing, and Studio reload; a visible native close-and-reopen run in the production window remains pending |
| Aura System/Light/Dark preference is persisted, reversible, and independent of Claude account settings | Strict `appearance` config/CLI validation and atomic writes; `CoreWebView2Profile.PreferredColorScheme` before first navigation and after live config changes; Aura-owned selected/effective-mode attributes with `matchMedia` listener cleanup; Original look returns the profile to Auto; no Claude class, `data-mode`, storage, or account mutation; executable and static regressions in `tests/run-tests.mjs`; actual Study Library light/dark Aura captures | Proven |
| English, Simplified Chinese, and Traditional Chinese metadata and Windows picker UI copy remain independent of theme styling | Localized registry fields; `windows/ui-copy.json`; native Studio framing labels/status/errors in `studio/app.js`; locale normalization and complete-key assertions in `tests/run-tests.mjs`; explicit UTF-8 loading in Windows PowerShell; zh-CN and zh-TW framing walkthroughs | Proven |
| Original Claude identity remains present and themeable | Starburst selectors and treatments in `assets/base.css` and `assets/theme-variants.css` | Partial — source coverage is present; live upstream selector coverage is pending |
| Isolated, optional, pointer-inert renderer artwork; concept composites never become renderer UI | Isolated SVG/WebP renderer layers under `assets/theme-art/`; seven decorative uncropped Studio masters with live adjacent labels and separately stored framing; source-only alternate exclusion; asset policy tests; `NOTICE.md`; `THIRD_PARTY_NOTICES.md` | Proven |
| Cartoon Studio production artwork | Approved appearance-specific background and mascot WebPs under `assets/theme-art/cartoon-studio/`; source checksum freeze; status-only asset audit; exact recipe-layer assertions; Light/Dark payload compilation; actual Aura Light/Dark captures | Proven and approved at HUMAN CHECKPOINT C. The narrower 1280 x 720 stress case remains part of WO-16's broader sweep. |
| Anime Twilight production artwork | Approved cityscape WebP under `assets/theme-art/anime-twilight/`; source checksum freeze and exact prompt; status-only asset audit; exact recipe-layer assertions; Light/Dark payload compilation; actual Aura Light/Dark 1920 x 1080 captures | Proven and approved at HUMAN CHECKPOINT C. |
| Study Library production artwork | Approved appearance-specific paper backgrounds and alpha still-life WebP under `assets/theme-art/study-library/`; source checksum freeze; status-only asset audit; exact recipe/main-canvas anchor assertions; Light/Dark payload compilation; actual Aura Light/Dark whole-window captures under gitignored `dist/verify/live-aura/` | Proven. The user approved the Light/Dark Study Library composition on 2026-07-20; the live captures are the visual review evidence. |
| Japanese Idol production artwork | Light floral background and top-right new-chat portrait plus dedicated Dark new-chat/conversation WebPs under `assets/theme-art/kawaii-idol/`; source/runtime checksums recorded; status-only dimensional, alpha, raster, and payload-budget audit; exact four-layer assertions; superseding actual Aura Light/Dark new-chat/conversation whole-window revision captures under `dist/verify/live-aura/` | Proven and approved. The first Checkpoint C review rejected the Light framing; the user approved the revised 74%/660px top-right composition with Dark unchanged on 2026-07-21. The four production assets and recorded hashes are frozen. |
| Interface remains usable when artwork is absent or fails | Artwork resolution returns a non-blocking unavailable state; shared backgrounds and component styles do not depend on artwork; failure-path tests | Proven |
| Contrast, focus, readable sizes, high contrast, forced colors, and reduced motion | Contrast guardrail tests; focus/high-contrast/reduced-motion rules in `assets/base.css` and `assets/theme-variants.css`; native high-contrast handling in `windows/aura-ui.ps1`; 2026-07-18 Studio walkthroughs confirmed a visible keyboard ring | Partial — automated/source and Studio keyboard focus are covered; the live assistive-technology and OS-preference matrix remains pending |
| Responsive behavior at 1280×720, 1440×900, 1905×1026, 1920×1080, and high-DPI equivalent | Responsive CSS, artwork reduce/hide policy, DPI-aware native layout, normal-display whole-window matrix, and 2560 × 1600 at 200% actual-display review | Partial — HUMAN CHECKPOINT C approved the recorded normal/high-DPI review; WO-16 retains the broader normal/fullscreen stress matrix |
| Theme switching is responsive, active artwork only is loaded, and decoration avoids layout shift or continuous motion | Active-theme-only artwork compilation; one-pass native save/startup payload path; cached image/art CSS values; direct-node observer; pointer-inert assets; reduced-motion tests; live Light/Dark matrix, context switching, and representative hover review | Proven for WO-17 switching/context/interaction scope; production paint timing remains a later performance observation |
| Theme-aware native Windows identity | Deterministic Aura SVG/ICO bootstrap; validated PNG-to-owned-icon conversion with native handle cleanup; atomic main window, Studio window, taskbar, and notification-area mark updates on theme switch | Partial — automated lifetime and switching-source checks pass; live multi-theme title-bar/taskbar/tray review remains in HUMAN CHECKPOINT D |
| Existing WebView2 navigation, sign-in, Claude loading, restore, background, and Desktop app behavior remain intact | Existing WebView2 companion flow in `windows/aura-ui.ps1`; exact background cover/framing geometry shared by Studio and renderer; marker-owned content-addressed Studio background cache; executable same-size/same-timestamp, oversized-replacement, and junction-alias regressions; platform parsing and WebView2 policy tests; 2026-07-18 signed-in loading plus live theme/background/enabled interactions | Partial — the signed-in core flow and framing contract are proven; Desktop-app launch and restore edge cases remain source-verified only |
| No runtime font CDN, new npm dependency, account sync, subscription, or analytics dependency | `package.json`; system font stacks; dependency statement in `docs/IMPLEMENTATION_REPORT.md`; vendored WebView2 notices | Proven |
| Installation is non-elevated, allowlisted, documented, and safely reversible | `windows/install.ps1`; `windows/uninstall.ps1`; Start-menu uninstaller; owned-path guards; explicit opt-in removal of settings/WebView data; `README.md` and `SECURITY.md` | Proven in source; live install/uninstall observation remains advisable |
| Tests, parsing, payload cycle, Studio metadata build, and release exclusions | Twenty checks in `tests/run-tests.mjs`, including executable Studio framing/cache and layered-art regressions; PowerShell parse; `npm run verify:cycle` payload-only Light/Dark compilation for all eight themes; results recorded in `docs/IMPLEMENTATION_REPORT.md`; `scripts/build-release.mjs` exclusion policy | Proven for current non-visual checks |
| Final release archive matches the completed source and includes final evidence | Versioned release builder and SHA-256 generation in `scripts/build-release.mjs` | Proven — the 2026-07-21 completion rebuild passed and archive inspection found the canonical SVG and nine-frame ICO |
| Whole-window screenshots of all eight themes and live theme-switch verification | 2026-07-21 local gitignored evidence: all eight themes in Light/Dark, Original look, Studio selection/navigation, representative live hover/selected state, Korean Idol new-chat/conversation contexts, and normal/200% DPI Aura identity | Proven for WO-17 and approved at HUMAN CHECKPOINT C on 2026-07-21 |

## Deliverable evidence

The architecture summary, change-set inventory, canonical IDs, dependency
rationale, asset licensing, unsafe-reference list, recorded automated results,
and remaining limitations are maintained in
`docs/IMPLEMENTATION_REPORT.md`. The implementation is on
`work/full-theme-system`.

As of 2026-07-20, the old reconstructed-harness captures and claims are retired
and do not satisfy any live acceptance gate. Signed-in production loading and
all eight theme selections were observed. The Aura Studio framing revision was
exercised at its exact product viewport with pointer drag, native keyboard
controls,
host-confirmed save, reload persistence, both Chinese locales, and no fresh-run
console warnings or errors. The user approved HUMAN CHECKPOINT B on 2026-07-19.
Study Library additionally has approved actual-Aura light/dark evidence and
checksum-frozen production art from WO-12.

WO-17 adds a complete 16-state Light/Dark matrix of the actual Aura window on
live `claude.ai`, plus Original look, Studio, normal/high-DPI identity,
Korean Idol conversation, and live hover evidence. The images remain private
under `dist/verify/live-aura/`; their machine-readable inventory and hashes are
in `wo17-self-capture-manifest.json`. The context probe reported exactly one
`data-claude-aura-sidebar`, conversation context, zero new-chat prompt markers,
and four conversation-scoped artwork layers. Studio's real **Back to Claude
Aura** action foregrounded the existing Aura window. The 200% review used an
actual 2560 × 1600 display and the original 1920 × 1080 topology was restored.

Remaining production-only checks are targeted: console/network instrumentation,
full assistive-technology coverage, the broader normal/fullscreen stress
matrix, title-bar platform variance, the themed launcher's hover/click/grip
interaction, live uninstall, and the ordered WO-16 sweep. The user approved
HUMAN CHECKPOINT C on 2026-07-21.
