# Actual Aura visual-evidence protocol

This protocol defines the only accepted UI visual evidence for Claude Aura:
a whole-window capture of the actual Aura WebView2 application displaying live
`claude.ai`. It does not authorize any offline visual surrogate.

## Permanent non-image verification policy

`npm run verify:cycle` compiles and validates the production renderer payload
for all eight stable theme IDs in both Light and Dark. It does not open Edge,
load a reconstructed or fake Claude DOM, render an interface, take a
screenshot, compare pixels, or write image files.

`node scripts/theme-cli.mjs qa <id>` audits the registered production assets
and both payload modes, then writes `status.json` only. It does not produce a
board, preview, composite, crop, checker, or other image.

The following are permanently excluded from build, verification, acceptance,
and documentation workflows:

- reconstructed or fake Claude DOM pages;
- fixture UI images and headless-browser screenshots;
- QA-board images, contact sheets, pixel-diff images, and image goldens;
- offline theme previews or reconstructed interface screenshots; and
- relabelling any offline render as actual Aura evidence.

Production artwork and decorative Studio card media remain product assets, not
evidence. Source references and asset guides may inform production work, but
they never prove runtime behavior.

## Actual Aura WebView2 review

For every visual-acceptance pass, launch the real Aura main window with an
authenticated live `claude.ai` document.
Claude Desktop, an ordinary browser, a content-only WebView capture, Studio,
an asset guide, and any reconstructed page are not whole-window Aura evidence.

Prefer a dedicated test account or profile with no private history. Keep the
real sidebar visible so the themed canvas, sidebar overlay, and Windows chrome
are exercised together. If account data cannot be excluded, store captures
only under the gitignored `dist/verify/live-aura/` tree; never copy them into
tracked documentation, release archives, issues, or pull requests.

For each capture:

1. Apply the requested theme and Light or Dark appearance through Aura Studio.
   This local Aura preference must not alter Claude account settings.
2. Confirm that the WebView document is live `claude.ai`, the loading cover is
   gone, and the root reports the expected Aura theme, payload digest, selected
   appearance, effective mode, and page context.
3. Wait for every applicable production artwork layer to decode and for two
   animation frames to settle. A missing, duplicated, ghosted, or wrong-context
   layer fails the capture.
4. Capture the entire Aura window, including title bar, WebView bounds, real
   sidebar, content canvas, and any requested live menu or dialog. Do not crop
   to WebView content, reconstruct the page, or edit captured pixels.
5. Record theme ID, appearance, `new-chat|conversation|other` context, UTC
   timestamp, commit, payload digest, outer-window pixels, WebView CSS viewport,
   DPR, Windows display scaling, maximized state, and capture path in a manifest
   beside the images.

## Required live matrix

Capture all eight stable theme IDs in both Light and Dark at a normal desktop
window size, in registry order. Use filenames of the form
`<order>-<theme>-<mode>-aura-window.<native-extension>`; the extension must
match the untouched capture MIME (`.jpg` for `image/jpeg`, `.png` for
`image/png`). Record the actual viewport rather than claiming a target size
that Windows chrome or display scaling did not produce.

For themes with context-specific artwork or prompt placement, capture both an
empty new chat and an existing conversation. Korean Idol specifically requires:

- Light and Dark new-chat scenes with the upward-framed prompt composition;
- Light and Dark conversation scenes using the conversation framing without
  moving the conversation composer; and
- normal-window and maximized/fullscreen captures proving a single intended
  scene, stable focal point, and no duplicate portrait or ghost layer.

Also capture these stress cases when the available display supports them:

- Cartoon Studio Light at approximately 1280 × 720;
- Anime Twilight Dark at approximately 1920 × 1080;
- Korean Idol Dark at high DPI; and
- one real Claude menu plus one real modal or dialog across the art-heavy
  themes, proving decoration neither overlaps nor intercepts those surfaces.

For a Full-window background scope, the artwork must visibly extend behind the
sidebar and the marked sidebar must remain legible as one translucent overlay.
For Content-canvas scope, the sidebar must remain outside the artwork field.
Exercise both scopes during custom-theme acceptance.

### Floating launcher interaction

Cycle all eight stable themes and confirm the compact launcher changes to the
registered local mark, surface, border, and radius without moving closer than
16 px to a content edge. For each switch, confirm that the same mark also
appears on the Aura and Studio windows, taskbar, notification area, and Studio
rail; Original look must restore Default across all of them. Keep whole-window evidence for at least one light
launcher and one dark launcher in both states: compact 48×48 and hovered
176×48 with the localized **Open Studio** label and visible six-dot grip. Click
the body to open Studio; separately drag only from the grip, then confirm a
later body click still opens Studio. Finally apply a temporary theme with no
`launcher` object and confirm the complete Default design appears. Theme
styling must never hide the launcher, turn the body into a drag zone, or create
more than one launcher window.

### Custom-theme workflow

Before editing a theme, open **Adjust card preview** for two built-ins. Drag to
a distant part of each uncropped master, zoom beyond 200%, save, reopen the
dialog, and confirm the frame persists. Reset one theme and confirm its
registry starting frame returns. The master file hashes must remain unchanged;
only `studioPreviewCrops` may change.

Create one temporary custom theme through the installed Studio and keep its
captures under `dist/verify/live-aura/checkpoint-d/`. Record the complete
host-confirmed sequence in the adjacent manifest:

1. duplicate a built-in, make a valid Dark token change, undo it, redo it, and
   reset once; after reset, confirm the duplicate still uses the built-in
   variant recipe and has returned to the source's approved Dark composition
   before continuing;
2. import at least one raster through the host picker, confirm local WebP
   conversion and budget feedback, save, apply, close Aura, and relaunch it;
3. prove the saved theme and artwork survive restart, then exercise Content
   canvas and Full window scope;
4. for each background scope, in the real signed-in Aura window capture Light
   and Dark at an empty new chat and an existing conversation, first at a
   normal window size and then maximized/fullscreen (the complete scope ×
   appearance × context × viewport matrix); and
5. navigate, change appearance, and resize between captures, confirming one
   mutually exclusive intended scene with no duplicate or ghosted layer. End by
   deleting the temporary theme and verify that Default is active first and no
   installed or draft residue remains.

The evidence set must include the whole Aura outer window and live
`claude.ai`. It must show that Content-canvas artwork excludes the sidebar and
Full-window artwork continues behind one readable translucent sidebar. Record
the Studio locale used for the walkthrough, keyboard operation of every edited
control, visible focus, the host-confirmed save result, and the restart boundary.
Record the automated complete-key localization result for en, zh-CN, and zh-TW
alongside the locale used for the end-to-end walkthrough.
Studio itself and its asset guide may support the walkthrough record but are
never substitutes for these live Aura captures.

Judge only what Aura controls: artwork identity, visibility, crop, focal
position, context/appearance/viewport selection, materials, palette,
decorative density, typography category, pointer safety, unobstructed controls,
and sidebar treatment. Exact Claude layout, wording, feature inventory, and
personalized content are out of scope because the live site supplies them.

After cycling all themes, select **Original look** and confirm that every Aura
style, marker, backdrop, context/layout adjustment, and forced appearance is
removed. If live sign-in, the service, or automated whole-window capture is
unavailable, leave the checkpoint open and ask the user to inspect Aura or
provide the required live captures. Never manufacture an offline substitute.

## Recording outcomes

Record live capture paths, dimensions, hashes where useful, and the explicit
user review outcome in `docs/IMPLEMENTATION_REPORT.md` and
`docs/ACCEPTANCE_AUDIT.md`. Record `npm run check`, the non-image
`npm run verify:cycle`, and the applicable `status.json` asset audits as
separate mechanical evidence. Rerun `npm run check` before any commit or
release build.
