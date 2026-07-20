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

## Codex desktop-agent launch and capture runbook

This section is the operational runbook for GPT-5.6 Sol Max and later Codex
desktop agents. It does not relax the evidence rules above. The user gave
standing approval on 2026-07-20 for an agent working in this repository to
install, launch, relaunch, and foreground Claude Aura and Claude Aura Studio
whenever live product verification requires it. That approval does not extend
to entering credentials, changing Claude account data, publishing captures,
deleting unrelated processes, pushing, or merging.

Treat that approval as persistent project authorization. Do not ask the user to
repeat it in a later work order or agent session. Before declaring an
actual-Aura checkpoint blocked, the agent must attempt the complete install,
launch, window-selection, and native-capture sequence below and record the
exact failure. The user-supplied fallback is permitted only after those
self-capture attempts fail.

### 1. Prepare the current build

1. Read `AGENTS.md`, the active work order, and this complete protocol.
2. Confirm the branch and preserve every pre-existing worktree change. Never
   reset or clean the repository to prepare a capture.
3. Run the work order's mechanical gates before visual review. At minimum this
   includes the PowerShell parser check, `npm run check`,
   `npm run verify:cycle`, and the explicit payload-minus-art budget check.
4. Install the current workspace so the live window cannot accidentally use an
   older `%LOCALAPPDATA%\ClaudeAura\app` copy. Run the installer with the shell
   tool, not by typing a command into a Windows application:

   ```powershell
   powershell.exe -NoProfile -ExecutionPolicy Bypass -File "<repo>\windows\install.ps1"
   ```

   The installer writes to the per-user application, Desktop, and Start-menu
   locations, so request the required sandbox escalation directly. The user's
   standing launch approval means no separate conversational confirmation is
   needed. A successful install prints the install root and passes the current
   test suite before copying the application.
5. If an older Aura instance prevents installation, first use Aura's own tray
   **Exit** action. Never terminate an arbitrary `powershell.exe`. A process may
   be stopped only when its exact command line has been safely confirmed as the
   Aura host and normal product shutdown is unavailable.

### 2. Launch or foreground Aura and Studio

Use the shell tool to invoke the installed shortcuts. Do not automate a
terminal, the Windows Run dialog, a `.cmd` file, or PowerShell through Computer
Use. The two responsibilities remain separate: the shell launches the product;
Computer Use controls and captures the resulting window.

```powershell
$desktop = [Environment]::GetFolderPath('Desktop')
Start-Process -FilePath (Join-Path $desktop 'Claude Aura.lnk')
Start-Process -FilePath (Join-Path $desktop 'Claude Aura Studio.lnk')
```

If `Start-Process` creates a valid Aura host whose WinForms window is not on the
interactive desktop returned by Computer Use, do not conclude that capture is
unavailable. Confirm the exact host command line, close only that confirmed
Aura host when normal product shutdown is unavailable, and launch the shortcut
through the interactive Explorer shell:

```powershell
explorer.exe "<absolute Desktop path>\Claude Aura.lnk"
explorer.exe "<absolute Desktop path>\Claude Aura Studio.lnk"
```

This Explorer-launch recovery was verified on 2026-07-20. It placed both forms
on the same desktop exposed by the official Computer Use capture runtime. Never
use it as authority to terminate an unverified `powershell.exe` process.

The Start-menu copies live under
`%APPDATA%\Microsoft\Windows\Start Menu\Programs\Claude Aura\`. Launching
**Claude Aura** again foregrounds the existing single instance. Launching
**Claude Aura Studio** again signals the existing Aura process and foregrounds
Studio. The normal Aura and Studio shortcuts must remain separate.

After launch, allow the WebView2 processes to initialize. A running PowerShell
host or `msedgewebview2.exe` process is readiness information only; it is never
visual evidence.

### 3. Select a window through Computer Use

Use the `computer-use` skill and read its `SKILL.md`, `guidance`, and
`confirmations` documentation before Windows automation. Initialize the
official client in `node_repl`; do not build a custom helper or use PowerShell
UI Automation.

1. Call `sky.list_apps()` or `sky.list_windows()`.
2. Filter the returned windows for the exact title `Claude Aura` or
   `Claude Aura Studio`.
3. Continue only when the filter returns exactly one window. Rehydrate that
   returned object with `sky.get_window(...)`, activate it, and obtain a fresh
   `sky.get_window_state(...)` before every state-derived action.
4. Never invent a window object, guess an HWND, reuse a stale screenshot ID, or
   act on coordinates from an earlier observation.

Aura is a PowerShell-hosted WinForms/WebView2 application. Some Computer Use
runtime versions do not enumerate its form even while the product is visibly
running. An exact returned Aura window remains the preferred control and
capture target. If no exact Aura window is returned:

1. use the interactive Explorer-launch recovery above, then launch the
   applicable shortcut once more to exercise the single-instance foreground
   signal;
2. wait two seconds and retry `list_windows()` once;
3. follow the Computer Use recovery guidance once, including a runtime reset
   only when that guidance calls for it;
4. if Aura is visibly foreground but still not enumerated, select exactly one
   File Explorer window returned on that same interactive desktop and request
   a fresh screenshot state without activating Explorer. The 2026-07-20
   runtime returned a `zIndex: 0`, origin `(0, 0)`, 1920 x 1080 full-monitor
   screenshot in addition to the Explorer-region screenshot. The unaltered
   full-monitor image is valid capture evidence only when it visibly includes
   the complete foreground Aura outer window, title bar, and live `claude.ai`;
   and
5. treat this as capture-only recovery. Do not send Aura coordinates or input
   through the Explorer target. If there is no native full-monitor screenshot
   containing the complete Aura window, stop.

If that sequence provides native capture but not Aura/Studio input, continue
with the mandatory process-scoped WebView2 control path below. Automated
capture is unavailable only after both paths fail. Do not bypass them with a
fabricated window handle, direct PowerShell screen capture, an ordinary browser
render, or reconstructed HTML. Leave the checkpoint open and ask the user for
the whole-window captures described below only after recording both failures.

### 3A. Drive the installed WebViews when WinForms is capture-only

Microsoft documents `--remote-debugging-port=0` as the WebView2 agent-control
path. Use it only as a process-scoped launch argument for the unchanged,
installed Aura build. The reference is
[Microsoft Edge DevTools MCP for WebView2](https://learn.microsoft.com/en-us/microsoft-edge/web-platform/devtools-mcp-server).
Do not add a registry value, edit a shortcut, patch Aura, or persist a debug
switch.

1. Preserve the current `%LOCALAPPDATA%\ClaudeAura\data\config.json`, record
   the exact display topology, and identify the Aura host by its full command
   line. Close only that verified host if Aura's own **Exit** action is not
   targetable.
2. Set `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=0` only
   in the shell process that starts the installed
   `%LOCALAPPDATA%\ClaudeAura\app\windows\aura-ui.ps1`. Start with
   `-OpenStudio` when Studio is part of the review, then immediately restore or
   remove the environment variable in the controlling shell. The child keeps
   the launch-scoped setting; later normal launches do not.
3. Wait for `DevToolsActivePort` below the owned
   `%LOCALAPPDATA%\ClaudeAura\webview` tree. Read its first line as the local
   port and attach the bundled Playwright client to
   `http://127.0.0.1:<port>`. Accept only the two real targets:
   `https://aura.studio/index.html` and signed-in `https://claude.ai/...`.
   Never attach to an authentication, password-manager, CAPTCHA, or unrelated
   target.
4. Drive state only through the product's real surfaces: choose the theme and
   appearance in Studio, activate Studio's `#open-aura` action, and use an
   existing live Claude navigation link to reach `new-chat` or `conversation`.
   It is acceptable to inspect Aura-owned root markers, artwork decode state,
   viewport size, and computed hover/focus styling. Do not send a prompt,
   modify account data, or use script-created DOM as evidence.
5. Use Computer Use native whole-window/full-monitor output for every accepted
   image. A Playwright or DevTools screenshot is never visual evidence. The
   process-scoped connection supplies input and machine-readable state only.
6. Close the debug-scoped Aura host after capture, relaunch the normal shortcut,
   restore the exact saved config and display topology, and verify that no
   debug argument remains in the normal Aura/WebView2 process command line.

This path was exercised successfully on 2026-07-21 after Aura and Studio were
visible in native capture but absent from `sky.list_windows()` and
`sky.list_apps()`. Consequently, that enumeration limitation alone is not a
valid reason to block a future live-Aura work order.

### 4. Drive the live review

When both windows are targetable:

1. In Studio, choose the required theme and **Light** or **Dark** appearance and
   wait for the host-confirmed state update.
2. Exercise the selected, hover/active, and visible keyboard-focus treatments.
   Keep labels as live text and verify the Studio content region scrolls at its
   supported minimum size without a blank nested document scroller.
3. Use Studio's **Back to Claude Aura** action and confirm it foregrounds the
   Aura window. Keep the separate official Claude Desktop action distinct.
4. In Aura, confirm the loading cover is gone and the displayed document is the
   authenticated live `claude.ai`, not Claude Desktop or an ordinary browser.
5. Capture an empty new chat and an existing conversation wherever the theme
   has context-specific art or prompt placement. Never reposition or send the
   conversation composer as part of testing.
6. Wait for all applicable artwork to decode and for two animation frames to
   settle before taking each capture.
7. After the matrix, select **Original look** and confirm all Aura styles,
   markers, backdrop layers, prompt placement, context adjustments, and forced
   appearance are removed.
8. For a high-DPI requirement, first record
   `[System.Windows.Forms.Screen]::AllScreens`. Use an actual Windows display
   whose current Settings accessibility tree reports the required scale and
   recommended physical resolution; do not simulate DPI in CSS or DevTools.
   Relaunch Aura on that display, preserve one native whole-Aura capture plus a
   supplemental native notification-area capture, then restore and verify the
   original display topology before continuing.

Never automate sign-in, passwords, password managers, or authentication
dialogs. If the live profile is signed out, ask the user to complete sign-in.

### 5. Save an automated capture without altering it

Call `sky.get_window_state({ window, include_screenshot: true })` on the exact
returned Aura window, or use the capture-only Explorer recovery above. The
accepted image is the native screenshot that already contains the complete Aura
outer window, including its title bar. Do not crop, compose multiple
screenshots, resize, annotate, recolor, or re-encode it.

When the task requires a persistent evidence file, the raw data-URL bytes may
be written once under the gitignored `dist/verify/live-aura/` directory. This
is evidence preservation, not a second inspection pass. A future agent may use
the following pattern in `node_repl`, with a fresh `state` and an absolute
output path:

```js
{
  const shot = state.screenshots.find((candidate) =>
    candidate.id === "<fresh whole-window screenshot id>",
  );
  const match = shot?.url?.match(/^data:image\/(png|jpeg|webp);base64,(.+)$/s);
  if (!match) {
    throw new Error("Expected one native PNG, JPEG, or WebP capture");
  }
  const extension = match[1] === "jpeg" ? "jpg" : match[1];
  const bytes = Buffer.from(match[2], "base64");
  const fs = await import("node:fs/promises");
  await fs.writeFile(`<absolute capture path>.${extension}`, bytes);
}
```

The official runtime returned native JPEG data on 2026-07-20. Preserve the
reported MIME type and matching extension; a PNG-only assumption or JPEG-to-PNG
conversion would alter the evidence. For Explorer recovery, identify the fresh
full-monitor screenshot by its returned metadata and visually confirm that it
contains the complete Aura window before preserving those exact bytes.

If the API returns separate parent-window and popup screenshots, do not combine
them. Obtain a native whole-window capture that already includes the requested
menu or dialog, or request that capture from the user.

Studio, Desktop-shortcut, Start-menu, and notification-area images may support
the identity and navigation review, but they never replace an Aura capture of
live `claude.ai`. Record the Aura and Studio title-bar icons, the two separate
shortcuts, and the notification-area icon at normal and high DPI when the
available display supports those checks.

### 6. User-supplied fallback

If automated whole-window capture is unavailable, foreground Aura with the
shortcut and give the user these exact instructions:

1. click the Aura window so it is active;
2. press **Alt+Print Screen** to capture the complete active window, including
   the title bar;
3. paste into Paint and save directly as PNG without cropping or editing; and
4. place the files under `dist/verify/live-aura/` using the filenames below.

Ask the user to report the selected theme, appearance, page context, Windows
display scaling, and normal/maximized state. The agent can calculate the PNG
dimensions and hashes afterward. Do not check off the work order, update a
visual approval claim, or commit until the required files and explicit review
outcome exist.

## Actual Aura WebView2 review

At each asset mini-checkpoint and again at HUMAN CHECKPOINT C and WO-16, launch
the real Aura main window with an authenticated live `claude.ai` document.
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
Exercise both scopes during WO-18 acceptance.

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
