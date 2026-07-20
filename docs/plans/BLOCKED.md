# Blocked items

Append-only. After two failed attempts at the same fix, record it here and
move to the next queue item. Format:

> **Evidence policy update (2026-07-20):** Fixture renders, offline UI boards,
> comparison screenshots, contact sheets, and golden images were retired and
> deleted. They must not be regenerated, retried, or proposed as an unblock.
> Visual review means the actual Aura whole window on live `claude.ai`.

```
## <date> — WO-NN — <one-line summary>
- Attempt 1: <what was tried> → <what happened>
- Attempt 2: <what was tried> → <what happened>
- Suspected cause:
- What would unblock it (tool, asset, or user decision):
```

## 2026-07-19 — WO-08 — Japanese Film corner conversion never completes
- Attempt 1: added the supplied Japanese Film background/hero copy jobs and
  wide-corner SVG WebP job, then ran
  `node scripts/convert-theme-assets.mjs japanese-film-editorial` → the two
  supplied WebPs copied, but headless Edge produced no corner output and the
  converter timed out after 90 seconds.
- Attempt 2: changed the Edge launch to a persistent remote-debugging process
  with compositor flushing, then reran the same theme conversion → the two
  supplied WebPs copied again, but the corner job still produced no response
  and timed out after 90 seconds.
- Suspected cause: sandbox-isolated Edge never executes the converter's
  local-loopback page; the server receives neither
  `/out/corner-top-right.webp` nor `/fail`. The required suite subsequently
  passed when its own headless-Edge QA launch was explicitly run outside the
  sandbox, which isolates the environment from the supplied art.
- What would unblock it (tool, asset, or user decision): authorize a fresh
  WO-08 attempt outside the sandbox, or supply a compliant derived
  `corner-top-right.webp`. After conversion, WO-08 still needs its status-only
  asset audit, actual Aura Light/Dark captures, and explicit approval.

## 2026-07-19 — WO-09 — Aura whole-window capture is unavailable
- Attempt 1: refreshed the installed app from the WO-09 worktree, launched the
  authenticated Korean Prestige WebView2 window through both hidden and visible
  PowerShell hosts, and polled the native Computer Use bridge → Aura created a
  real `Claude Aura` top-level window and CDP verified the expected theme and
  digest on `https://claude.ai/new`, but the bridge deliberately returned no
  PowerShell-hosted window, so it could not capture the required whole window.
- Attempt 2: built a disposable in-process native host so the same installed
  `aura-ui.ps1` window would be owned by a non-terminal executable and therefore
  targetable by the capture bridge → Windows antimalware blocked that unsigned
  helper as potentially unwanted before launch. No security control was
  bypassed or changed.
- Suspected cause: the available native-window bridge excludes PowerShell-owned
  WinForms windows, while the only safe ownership workaround is rejected by
  local endpoint protection. A WebView-only CDP screenshot exists, but the
  screenshot protocol explicitly forbids substituting it for the entire Aura
  window.
- What would unblock it (tool, asset, or user decision): a first-party capture
  path that can target the PowerShell-hosted `Claude Aura` window, or user-made
  whole-window light/dark captures plus the required viewport/scaling metadata.
  WO-09 also still needs explicit live mini-checkpoint approval; payload and
  asset integrity remain covered by non-image checks.
- Resolution (2026-07-20): the first-party Computer Use runtime can preserve a
  compliant capture even though it still does not enumerate the WinForms form.
  Install the current build, launch the installed shortcut through the
  interactive Explorer shell, select exactly one returned File Explorer window
  on that desktop, and obtain a fresh screenshot state without activating
  Explorer. The runtime returned a native 1920 x 1080 full-monitor JPEG that
  visibly contained the complete foreground Aura window, title bar, live
  `claude.ai`, real sidebar, and content canvas. The verified procedure and raw
  MIME-preservation rules are now mandatory in `docs/SCREENSHOT_PLAN.md`.
  Future agents must try that self-capture route before treating this historical
  blocker as current. The workaround is capture-only and does not make the Aura
  or Studio forms safe input targets.

## 2026-07-20 — WO-11 — 1920 × 1080 supplemental preview capture fails to launch
- Attempt 1: started the local preview server and invoked headless Edge with a
  1920 × 1080 window, a five-second virtual-time budget, and the selected Anime
  Twilight dark capture URL → Edge returned a nonzero exit without creating the
  screenshot.
- Attempt 2: retried through `Start-Process` with explicit absolute screenshot,
  profile, stdout, and stderr paths → Edge exited 13 and reported “Multiple
  targets are not supported in headless mode”; no image was written.
- Suspected cause: `Start-Process` did not preserve quoting around the
  space-bearing `--user-data-dir` and `--screenshot` values, so Edge parsed
  fragments as extra targets. Those offline renderer and board paths were later
  retired and deleted under the permanent evidence policy.
- What would unblock it (tool, asset, or user decision): nothing; the requested
  offline capture is permanently retired and must not be retried by any later
  sweep. The actual Aura 1920 × 1080 dark stress capture remains separately
  blocked by the WO-09 whole-window issue.
- Retirement (2026-07-20): the supplemental offline preview capture was removed
  from the acceptance path. Do not retry it. Only the actual Aura whole-window
  stress capture remains relevant.

## 2026-07-20 — WO-12 — Required Study Library live-Aura review is unavailable
- Attempt 1: inherited the first WO-09 whole-window attempt: the authenticated
  source app reached real `claude.ai` and CDP verified the expected theme and
  digest, but the capture bridge returned no PowerShell-owned Aura window → no
  compliant whole-window light/dark evidence. This blocked method was not
  retried for WO-12.
- Attempt 2: inherited the second WO-09 whole-window attempt: a disposable
  native host was rejected by endpoint protection before launch → no compliant
  capture. The helper and the blocked workaround were not recreated or retried.
- Suspected cause: the available Windows capture surface still excludes the
  PowerShell-hosted WinForms window. A 2026-07-20 unblock audit used the newly
  surfaced first-party Computer Use runtime after a normal source-app launch;
  it likewise returned no targetable `Claude Aura` window, so the launched
  processes were closed and no alternate fixture evidence was created.
- What would unblock it (tool, asset, or user decision): a first-party capture
  path that returns the PowerShell-hosted Aura window, or user-made Study
  Library whole-window light/dark captures with the metadata required by
  `docs/SCREENSHOT_PLAN.md`. Before approval, the then-current preflight also needed
  product-art correction: its Studio card preview contains only paper texture,
  and the bottom-left vignette is almost entirely hidden behind the sidebar in
  both payload modes. The former QA board and fixture renders were subsequently
  retired and deleted; the replacement audit is status-only.
- Resolution (2026-07-20): rebuilt the Studio card from both selected masters;
  anchored the corner layer to the measured live main-canvas edge; added the
  persisted Aura **System / Light / Dark** control when the live site exposed no
  usable mode selector; and received user-supplied whole-window light/dark Aura
  captures on real `claude.ai`. The user approved the resulting Study Library
  composition, so WO-12 is complete. The capture mechanism itself remains
  unavailable for other themes and stays recorded under WO-09.

## 2026-07-20 — WO-17 — RESOLVED 2026-07-21 — Live interaction and high-DPI evidence
- Attempt 1: installed the current workspace, launched Aura and Studio through
  the interactive Explorer shell, retried `sky.list_windows()` and
  `sky.list_apps()`, and followed the official recovery sequence → the bridge
  captured both forms on the live desktop but returned neither WinForms form as
  an input target. The returned Explorer window safely produced the complete
  16-image Light/Dark live-Aura matrix, Original-look capture, Studio capture,
  and notification-area/menu captures, but it cannot be used to send Aura or
  Studio coordinates.
- Attempt 2: inspected only Aura's running WebView2 process arguments for a
  supported existing automation endpoint → there was no remote-debugging port
  or other supported control endpoint. The live renderer reported
  `--device-scale-factor=1`, so this display also cannot prove high-DPI title-bar
  or notification-area rendering without changing system display settings.
- Suspected cause: this Computer Use runtime excludes PowerShell-owned WinForms
  windows from input selection. Full-monitor capture works through the Explorer
  anchor, but supported input remains window-bound. The available Windows
  session exposes only the normal-DPI Aura renderer.
- What would unblock it (tool, asset, or user decision): first follow the
  persisted self-capture procedure in `docs/SCREENSHOT_PLAN.md`; do not repeat
  the retired offline-host workarounds. If Aura and Studio still are not
  targetable, the user can open an existing conversation and place hover/focus
  where requested while the agent performs the native whole-window capture.
  High-DPI completion requires the same installed build on an actual high-DPI
  display, with whole-window Aura plus title-bar/notification-area evidence.
  Until those items exist, leave WO-17 unchecked, do not update its progress
  entry, do not commit it, and do not begin WO-13.
- Resolution (2026-07-21): the user's standing permission to install, launch,
  relaunch, and foreground Aura/Studio is now persisted as mandatory operating
  policy in `docs/SCREENSHOT_PLAN.md`. After the capture-only enumeration path
  above, a temporary process-scoped WebView2
  `--remote-debugging-port=0` launch exposed the unchanged installed Studio and
  signed-in live `claude.ai` WebViews for product-native input. Native Computer
  Use output—not DevTools screenshots—then supplied the accepted whole-window
  evidence.
- Result: the local gitignored manifest
  `dist/verify/live-aura/wo17-self-capture-manifest.json` records Korean Idol
  Light/Dark conversations, a live hover with the current conversation still
  selected, actual **Back to Claude Aura** activation, and Aura title-bar/tray
  identity at 200% Windows scaling. The original Korean Prestige/Dark config
  and single-primary 1920 × 1080 display topology were restored afterward.
  This WO-17 blocker is closed. Future agents must exhaust both the direct
  Computer Use and process-scoped WebView2 paths in the runbook before asking
  the user for captures; the standing launch permission does not need to be
  requested again.
