# Eight-theme acceptance audit

This matrix records the evidence available through 2026-07-21. **Proven** means the
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
| Distinct typography, shapes, effects, controls, cards, composer, navigation, status, and theme variants | Per-theme typography/shape/effect data; centralized component recipes in `assets/theme-variants.css`; payload compilation checks and 2026-07-21 whole-window live-Aura Light/Dark captures for all eight themes | Proven for the WO-17 theme matrix; Checkpoint C retains its broader parity/stress review |
| Theme gallery with name, subtitle, card image, swatches, selected state, keyboard access, immediate application, adjustable card framing, and appearance mode | Aura Studio gallery in `studio/app.js`; strict allowlisted bridge and isolated local virtual hosts in `windows/aura-ui.ps1`; seven packaged 640 x 360 selector images; polished 3:2 card frames; shared pointer-drag/native-range framing dialog; native System/Light/Dark radio group; Windows assertions in `tests/run-tests.mjs`; 2026-07-18 en/zh-TW/zh-CN WebView2 walkthrough | Proven; user approved HUMAN CHECKPOINT B on 2026-07-19 and the appearance control during WO-12 on 2026-07-20 |
| Persistent selection, immediate reapplication, legacy migration, safe Default fallback, and persisted framing | Registry aliases, atomic configuration handling, strict focal-point/zoom validation, corrupt-file preservation/recovery in `scripts/theme-core.mjs` and `scripts/theme-cli.mjs`; payload-returning init/set/recovery tests; Windows startup and navigation reapply flow; the 2026-07-18 Studio bridge walkthrough restored both card and background crop values after reload | Proven for storage, migration, recovery, framing, and Studio reload; a visible native close-and-reopen run in the production window remains pending |
| Aura System/Light/Dark preference is persisted, reversible, and independent of Claude account settings | Strict `appearance` config/CLI validation and atomic writes; `CoreWebView2Profile.PreferredColorScheme` before first navigation and after live config changes; Aura-owned selected/effective-mode attributes with `matchMedia` listener cleanup; Original look returns the profile to Auto; no Claude class, `data-mode`, storage, or account mutation; executable and static regressions in `tests/run-tests.mjs`; actual Study Library light/dark Aura captures | Proven |
| English, Simplified Chinese, and Traditional Chinese metadata and Windows picker UI copy remain independent of theme styling | Localized registry fields; `windows/ui-copy.json`; native Studio framing labels/status/errors in `studio/app.js`; locale normalization and complete-key assertions in `tests/run-tests.mjs`; explicit UTF-8 loading in Windows PowerShell; zh-CN and zh-TW framing walkthroughs | Proven |
| Original Claude identity remains present and themeable | Starburst selectors and treatments in `assets/base.css` and `assets/theme-variants.css` | Partial — source coverage is present; live upstream selector coverage is pending |
| Isolated, optional, pointer-inert renderer artwork; no composite screenshot UI | Isolated SVG/WebP renderer layers under `assets/theme-art/`; seven decorative 640 x 360 Studio selector thumbnails with live adjacent labels; asset policy tests; `NOTICE.md`; `THIRD_PARTY_NOTICES.md`; raw-reference release and installer exclusions | Proven |
| Cartoon Studio production artwork | Approved appearance-specific background and mascot WebPs under `assets/theme-art/cartoon-studio/`; source checksum freeze; status-only asset audit; exact recipe-layer assertions; Light/Dark payload compilation | Proven for production files and payload integration. On 2026-07-20 the user authorized the unavailable whole-window Light/Dark and 1280 x 720 evidence to remain deferred to HUMAN CHECKPOINT C/WO-16. |
| Anime Twilight production artwork | Approved cityscape WebP under `assets/theme-art/anime-twilight/`; source checksum freeze and exact prompt; status-only asset audit; exact recipe-layer assertions; Light/Dark payload compilation | Proven for production files and payload integration. The unavailable Aura whole-window Light/Dark and 1920 x 1080 Dark evidence remains deferred to HUMAN CHECKPOINT C/WO-16 under WO-09. |
| Study Library production artwork | Approved appearance-specific paper backgrounds and alpha still-life WebP under `assets/theme-art/study-library/`; source checksum freeze; status-only asset audit; exact recipe/main-canvas anchor assertions; Light/Dark payload compilation; actual Aura Light/Dark whole-window captures under gitignored `dist/verify/live-aura/` | Proven. The user approved the Light/Dark Study Library composition on 2026-07-20; the live captures are the visual review evidence. |
| Japanese Idol production artwork | Light floral background and new-chat portrait plus dedicated Dark new-chat/conversation WebPs under `assets/theme-art/kawaii-idol/`; source/runtime checksums recorded; status-only dimensional, alpha, raster, and payload-budget audit; exact four-layer assertions; actual Aura Light/Dark new-chat/conversation whole-window captures under `dist/verify/live-aura/` | Proven for production files, payload integration, decoded artwork, and context-specific live selection. HUMAN CHECKPOINT C approval remains pending. |
| Interface remains usable when artwork is absent or fails | Artwork resolution returns a non-blocking unavailable state; shared backgrounds and component styles do not depend on artwork; failure-path tests | Proven |
| Contrast, focus, readable sizes, high contrast, forced colors, and reduced motion | Contrast guardrail tests; focus/high-contrast/reduced-motion rules in `assets/base.css` and `assets/theme-variants.css`; native high-contrast handling in `windows/aura-ui.ps1`; 2026-07-18 Studio walkthroughs confirmed a visible keyboard ring | Partial — automated/source and Studio keyboard focus are covered; the live assistive-technology and OS-preference matrix remains pending |
| Responsive behavior at 1280×720, 1440×900, 1905×1026, 1920×1080, and high-DPI equivalent | Responsive CSS, artwork reduce/hide policy, DPI-aware native layout, normal-display whole-window matrix, and 2560 × 1600 at 200% actual-display review | Partial — WO-17 normal/high-DPI identity and Korean Idol context checks pass; Checkpoint C/WO-16 retains the broader normal/fullscreen stress matrix |
| Theme switching is responsive, active artwork only is loaded, and decoration avoids layout shift or continuous motion | Active-theme-only artwork compilation; one-pass native save/startup payload path; cached image/art CSS values; direct-node observer; pointer-inert assets; reduced-motion tests; live Light/Dark matrix, context switching, and representative hover review | Proven for WO-17 switching/context/interaction scope; production paint timing remains a later performance observation |
| Best-effort native Windows title-bar integration | `Set-AuraUiTitleBarPalette` in `windows/aura-ui.ps1`; deterministic Aura SVG/ICO; live title-bar and notification-area identity at normal DPI and 200% Windows scaling | Proven for WO-17 identity on the reviewed Windows system; cross-version DWM color behavior remains best-effort |
| Existing WebView2 navigation, sign-in, Claude loading, restore, background, and Desktop app behavior remain intact | Existing WebView2 companion flow in `windows/aura-ui.ps1`; exact background cover/framing geometry shared by Studio and renderer; marker-owned content-addressed Studio background cache; executable same-size/same-timestamp, oversized-replacement, and junction-alias regressions; platform parsing and WebView2 policy tests; 2026-07-18 signed-in loading plus live theme/background/enabled interactions | Partial — the signed-in core flow and framing contract are proven; Desktop-app launch and restore edge cases remain source-verified only |
| No runtime font CDN, new npm dependency, account sync, subscription, or analytics dependency | `package.json`; system font stacks; dependency statement in `docs/IMPLEMENTATION_REPORT.md`; vendored WebView2 notices | Proven |
| Installation is non-elevated, allowlisted, documented, and safely reversible | `windows/install.ps1`; `windows/uninstall.ps1`; Start-menu uninstaller; owned-path guards; explicit opt-in removal of settings/WebView data; `README.md` and `SECURITY.md` | Proven in source; live install/uninstall observation remains advisable |
| Tests, parsing, payload cycle, Studio metadata build, and release exclusions | Twenty checks in `tests/run-tests.mjs`, including executable Studio framing/cache and layered-art regressions; PowerShell parse; `npm run verify:cycle` payload-only Light/Dark compilation for all eight themes; results recorded in `docs/IMPLEMENTATION_REPORT.md`; `scripts/build-release.mjs` exclusion policy | Proven for current non-visual checks |
| Final release archive matches the completed source and includes final evidence | Versioned release builder and SHA-256 generation in `scripts/build-release.mjs` | Proven — the 2026-07-21 completion rebuild passed and archive inspection found the canonical SVG and nine-frame ICO |
| Whole-window screenshots of all eight themes and live theme-switch verification | 2026-07-21 local gitignored evidence: all eight themes in Light/Dark, Original look, Studio selection/navigation, representative live hover/selected state, Korean Idol new-chat/conversation contexts, and normal/200% DPI Aura identity | Proven for WO-17; Checkpoint C remains open until its later ordered parity review |

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
matrix, title-bar platform variance, live uninstall, and the ordered HUMAN
CHECKPOINT C/WO-16 sweep.
