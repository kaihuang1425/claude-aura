# Eight-theme acceptance audit

This matrix records the evidence available through 2026-07-18. **Proven** means the
implementation and a directly relevant check are present. **Partial** means
source or automated evidence exists but the required live behavior has not yet
been observed. **Pending** means the final artifact or runtime evidence still
needs to be produced. Evidence now includes comparison screenshots from the
offline QA harness, an interactive signed-in production `claude.ai` run, and
localized Aura Studio walkthroughs in a real WebView2 host.

| Requirement | Evidence | Status |
| --- | --- | --- |
| Default plus seven named themes, with stable IDs and one registry | `themes/registry.json`; eight canonical `themes/<id>.json` files; exact-order registry test in `tests/run-tests.mjs` | Proven |
| Central semantic-token architecture and stable root theme attribute | `scripts/theme-core.mjs`; `assets/base.css`; `assets/theme-variants.css`; `assets/renderer-inject.js`; semantic-completeness and payload tests | Proven |
| Distinct typography, shapes, effects, controls, cards, composer, navigation, status, and theme variants | Per-theme typography/shape/effect data; centralized component recipes in `assets/theme-variants.css`; representative Home/Code harness in `preview/`; 2026-07-17 harness run confirmed distinct accent, display font, card radius, and border width per theme, plus the eight comparison screenshots; 2026-07-18 signed-in run applied all eight selections | Proven in the QA harness and for live application; a systematic theme-by-theme production parity review remains pending |
| Theme gallery with name, subtitle, preview, swatches, selected state, keyboard access, and immediate application | Aura Studio gallery in `studio/app.js`; strict bridge and local virtual hosts in `windows/aura-ui.ps1`; seven packaged 640 x 360 selector images; Windows assertions in `tests/run-tests.mjs`; 2026-07-18 en/zh-TW/zh-CN WebView2 interaction and keyboard evidence | Proven |
| Persistent selection, immediate reapplication, legacy migration, and safe Default fallback | Registry aliases, atomic configuration handling, corrupt-file preservation/recovery in `scripts/theme-core.mjs` and `scripts/theme-cli.mjs`; payload-returning init/set/recovery tests; Windows startup and navigation reapply flow; 2026-07-17 harness reload confirmed a non-Default theme plus dark mode return from storage, a capture URL does not overwrite that saved state, and Reset restores Default/light | Proven for storage, migration, recovery, and reload; a visible native close-and-reopen run in the production window remains pending |
| English, Simplified Chinese, and Traditional Chinese metadata and Windows picker UI copy remain independent of theme styling | Localized registry fields; `windows/ui-copy.json`; locale normalization and complete-key assertions in `tests/run-tests.mjs`; explicit UTF-8 loading in Windows PowerShell | Proven |
| Original Claude identity remains present and themeable | Starburst selectors and treatments in `assets/base.css`, `assets/theme-variants.css`, and the offline QA harness | Partial — source/preview evidence is present; live upstream selector coverage is pending |
| Isolated, optional, pointer-inert renderer artwork; no composite screenshot UI | Isolated SVG/WebP renderer layers under `assets/theme-art/`; seven decorative 640 x 360 Studio selector thumbnails with live adjacent labels; asset policy tests; `NOTICE.md`; `THIRD_PARTY_NOTICES.md`; raw-reference release and installer exclusions | Proven |
| Interface remains usable when artwork is absent or fails | Artwork resolution returns a non-blocking unavailable state; shared backgrounds and component styles do not depend on artwork; failure-path tests | Proven |
| Contrast, focus, readable sizes, high contrast, forced colors, and reduced motion | Contrast guardrail tests; focus/high-contrast/reduced-motion rules in `assets/base.css` and `preview/styles.css`; native high-contrast handling in `windows/aura-ui.ps1`; 2026-07-17 harness confirmed a visible 3 px focus outline, a labelled modal with focus trap, and disabled controls at reduced opacity with `not-allowed` cursor; 2026-07-18 Studio walkthroughs confirmed one visible 2 px keyboard ring | Proven for automated/source, harness, and Studio keyboard focus; the full assistive-technology and OS-preference matrix in production remains pending |
| Responsive behavior at 1280×720, 1440×900, 1905×1026, 1920×1080, and high-DPI equivalent | Responsive CSS, artwork reduce/hide policy, DPI-aware native layout, deterministic preview readiness/state plate, and `docs/SCREENSHOT_PLAN.md` evidence matrix; 2026-07-17 captures at 1280×720, 1440×900 (×8), 1905×1026, 1920×1080, and a true device-pixel-ratio-2 render at 3810×2052; harness reported no horizontal overflow (`scrollWidth == clientWidth`) | Proven for the requested sizes and true DPR-2 evidence via the offline harness; the same production-window size/DPI matrix remains pending |
| Theme switching is responsive, active artwork only is loaded, and decoration avoids layout shift or continuous motion | Active-theme-only artwork compilation; one-pass native save/startup payload path; cached image/art CSS values; direct-node observer; small pointer-inert SVG assets; reduced-motion tests for GIF/APNG/WebP/AVIF; local save/build audit around 52 ms median and below 60 ms maximum; 2026-07-17 harness confirmed `pointer-events:none` decorative layers, the composer-center hit-test resolves to the `textarea` (not artwork), and same-origin/`data:` requests only when cycling all eight themes | Proven for source/automated safeguards and harness decode, pointer hit-test, and request observation; production-window paint timing remains pending |
| Best-effort native Windows title-bar integration | `Set-AuraUiTitleBarPalette` in `windows/aura-ui.ps1` attempts DWM dark-mode, caption, caption-text, and border attributes and catches API exceptions; static assertion in `tests/run-tests.mjs` | Partial — graceful source path is proven; results remain Windows-version and system-policy dependent and need live observation |
| Existing WebView2 navigation, sign-in, Claude loading, restore, background, and Desktop app behavior remain intact | Existing WebView2 companion flow in `windows/aura-ui.ps1`; platform parsing and WebView2 policy tests; 2026-07-18 signed-in loading plus live theme/background/enabled interactions | Partial — the signed-in core flow is proven; Desktop-app launch and restore edge cases remain source-verified only |
| No runtime font CDN, new npm dependency, account sync, subscription, or analytics dependency | `package.json`; system font stacks; dependency statement in `docs/IMPLEMENTATION_REPORT.md`; vendored WebView2 notices | Proven |
| Installation is non-elevated, allowlisted, documented, and safely reversible | `windows/install.ps1`; `windows/uninstall.ps1`; Start-menu uninstaller; owned-path guards; explicit opt-in removal of settings/WebView data; `README.md` and `SECURITY.md` | Proven in source; live install/uninstall observation remains advisable |
| Tests, parsing, preview build, and release exclusions | Sixteen checks in `tests/run-tests.mjs`; results recorded in `docs/IMPLEMENTATION_REPORT.md`; `scripts/build-release.mjs` exclusion policy | Proven for current source checks |
| Final release archive matches the completed source and includes final evidence | Versioned release builder and SHA-256 generation in `scripts/build-release.mjs` | Proven — rebuilt on 2026-07-18 with Aura Studio and all seven selector thumbnails; versioned ZIP and SHA-256 sidecar regenerated |
| Screenshots of all eight themes and live theme-switch console verification | Deterministic capture protocol in `docs/SCREENSHOT_PLAN.md`; fourteen images under `docs/theme-screenshots/`; 2026-07-17 harness switch verification recorded no console output and only same-origin/`data:` requests across all eight themes; 2026-07-18 signed-in run confirmed all eight selections apply | Proven for screenshots, harness instrumentation, and signed-in application; production console/network instrumentation remains pending |

## Deliverable evidence

The architecture summary, change-set inventory, canonical IDs, dependency
rationale, asset licensing, unsafe-reference list, recorded automated results,
and remaining limitations are maintained in
`docs/IMPLEMENTATION_REPORT.md`. The implementation is on
`work/full-theme-system`.

As of 2026-07-18, the requested responsive checks, the eight-theme comparison
screenshots, the menu/dialog overlays, live theme-switch console and request
verification, persistence-across-reload, and the release rebuild are complete in
the offline QA harness. Signed-in production loading and all eight theme
selections were also observed. Remaining production-only checks are targeted:
console/network instrumentation, full assistive-technology coverage, the full
responsive/DPI matrix, title-bar platform variance, and live install/uninstall.
