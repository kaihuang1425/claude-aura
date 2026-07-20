# Blocked items

Append-only. After two failed attempts at the same fix, record it here and
move to the next queue item. Format:

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
  `corner-top-right.webp`. After conversion, WO-08 still needs its QA board,
  actual Aura light/dark captures, and explicit approval before replacing the
  locked Checkpoint A goldens.

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
  WO-09 also still needs explicit mini-checkpoint approval and replacement of
  both locked Korean Prestige deterministic goldens.

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
  fragments as extra targets. The fixed 1440 × 900 payload renderer and QA-board
  browser launches both work and are unaffected.
- What would unblock it (tool, asset, or user decision): a later queued capture
  sweep may use the existing Node spawn-based screenshot launcher, which passes
  each argument without PowerShell re-tokenization. Per the two-attempt rule,
  WO-11 makes no third capture attempt here. The actual Aura 1920 × 1080 dark
  stress capture remains separately blocked by the WO-09 whole-window issue.

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
  `docs/SCREENSHOT_PLAN.md`. Before approval, the current preflight also needs
  product-art correction: its Studio card preview contains only paper texture,
  and the bottom-left vignette is almost entirely hidden behind the sidebar in
  both payload modes. The QA board and fixture renders remain preflight only.
- Resolution (2026-07-20): rebuilt the Studio card from both selected masters;
  anchored the corner layer to the measured live main-canvas edge; added the
  persisted Aura **System / Light / Dark** control when the live site exposed no
  usable mode selector; and received user-supplied whole-window light/dark Aura
  captures on real `claude.ai`. The user approved the resulting Study Library
  composition, so WO-12 is complete. The capture mechanism itself remains
  unavailable for other themes and stays recorded under WO-09.
