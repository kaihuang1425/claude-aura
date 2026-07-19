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

(no blocked items yet)

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
