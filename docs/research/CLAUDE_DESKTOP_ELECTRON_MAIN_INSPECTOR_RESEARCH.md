# Claude Desktop Electron main-inspector research — 2026-08-09

Scope: primary Electron, Node.js, Chromium DevTools Protocol, Microsoft, and
Microsoft Playwright documentation/source for one reversible experiment against
the stock signed Claude Desktop MSIX. This note does not launch Claude, alter
the package, read `app.asar`, attach to an account page, or claim the route works
on Claude Desktop `1.26832.0.0`.

## Decision

A **new, one-shot Gate A is technically justified** using Electron's
main-process Node inspector:

```text
ActivateApplication(
  "Claude_pzs8sxrjxfjjc!Claude",
  "--inspect=127.0.0.1:<fresh-high-port>",
  AO_NONE,
  out processId)
```

This is not a rerun of the failed renderer-CDP route. `--remote-debugging-port`
asks Chromium to expose renderer/browser targets. `--inspect` asks Electron's
embedded Node/V8 runtime to expose the **main process**. If the latter opens, a
client can obtain Electron's main-process module and use `webContents.insertCSS`
without a Chromium remote-debugging endpoint.

Success is still build-specific. Claude's MSIX launcher must forward the
argument, and its signed Electron binary must retain the `nodeCliInspect` fuse.
No official source establishes either fact for Claude; the live listener is the
only acceptable proof.

## What the primary sources establish

### Launch and security

- Electron documents `--inspect[=[host:]port]` for main-process debugging and
  `--inspect-brk` as the same facility paused on the first JavaScript line.
  Electron's switch reference gives the default as `127.0.0.1:9229` and says
  the transport is the Chrome DevTools Protocol over TCP. Use `--inspect`, not
  `--inspect-brk`, so Claude can start normally. [Electron main-process
  debugging](https://www.electronjs.org/docs/latest/tutorial/debugging-main-process),
  [Electron command-line switches](https://www.electronjs.org/docs/latest/api/command-line-switches#--inspecthostport)
- Electron's upstream `nodeCliInspect` fuse is enabled by default, but a packager
  may disable it; when disabled, `--inspect`, `--inspect-brk`, and related flags
  are ignored. Fuses are changed at package time before signing, so this
  experiment must never try to flip Claude's signed binary. [Electron
  fuses](https://www.electronjs.org/docs/latest/tutorial/fuses#nodecliinspect)
- Node documents the same loopback default, publishes the WebSocket identifier
  at `/json/list`, and warns that a public or `0.0.0.0` inspector permits remote
  code execution. An exact `127.0.0.1` listener is therefore a minimum safety
  condition, not a complete trust boundary. [Node command-line API](https://nodejs.org/docs/latest/api/cli.html#--inspecthostport)
- Microsoft documents `IApplicationActivationManager::ActivateApplication` as
  the AUMID generic-launch API and gives it an optional app-specific argument
  string plus the PID fulfilling the activation. That is a documented argument
  channel, but it does not promise that a particular packaged app forwards or
  accepts a particular Electron flag. [`ActivateApplication`](https://learn.microsoft.com/en-us/windows/win32/api/shobjidl_core/nf-shobjidl_core-iapplicationactivationmanager-activateapplication)

### From inspector to `require('electron')`

- Node's inspector API uses `Runtime.evaluate`; the DevTools Runtime domain says
  `Runtime.enable` immediately reports existing execution contexts and
  `Runtime.evaluate` evaluates an expression in a selected context. [Node
  inspector](https://nodejs.org/api/inspector.html), [DevTools Runtime
  domain](https://chromedevtools.github.io/devtools-protocol/tot/Runtime/)
- Electron warns that `require` can be absent from a main-process DevTools
  console. The supported experiment must not assume a bare console evaluation
  works. [Electron application debugging](https://www.electronjs.org/docs/latest/tutorial/application-debugging#main-process)
- Microsoft's current Playwright Electron driver provides the exact precedent:
  it launches Electron with `--inspect=0`, enables `Runtime`, selects the default
  main-process execution context, then evaluates `require('electron')` with
  `includeCommandLineAPI: true` (required after Electron 28). The same source
  adds its loader only for non-packaged apps and notes that packaged apps may
  have their own command-line handling. [Playwright Electron driver
  source](https://github.com/microsoft/playwright/blob/main/packages/playwright-core/src/server/electron/electron.ts#L67-L78),
  [launch source](https://github.com/microsoft/playwright/blob/main/packages/playwright-core/src/server/electron/electron.ts#L166-L203)

Therefore the capability probe is:

1. `Runtime.enable`.
2. Select only the default execution context reported by the main-process Node
   target.
3. Evaluate `require('electron')` with `includeCommandLineAPI: true`.
4. Return by value only booleans, Electron/Node version strings, and aggregate
   `WebContents` type counts. Reject exceptions or any non-Electron context.

### Styling and lifecycle APIs

- `webContents.getAllWebContents()` returns every window, webview, opened
  DevTools instance, and extension background page. It must not be used as an
  indiscriminate styling list. `getFocusedWebContents()` and `getType()` allow a
  first experiment to require one user-focused `window` without reading a URL,
  title, DOM, or page text. [Electron `webContents`](https://www.electronjs.org/docs/latest/api/web-contents#webcontentsgetallwebcontents)
- `insertCSS(css, { cssOrigin })` injects into the current page and resolves to
  a unique key; `removeInsertedCSS(key)` removes that exact sheet. Electron's
  own example performs insertion on `did-finish-load`. Keep every returned key
  and remove it on rollback. [Electron `insertCSS` and
  `removeInsertedCSS`](https://www.electronjs.org/docs/latest/api/web-contents#contentsinsertcsscss-options)
- `executeJavaScript` is also available and evaluates code in the page, but it
  is unnecessary for CSS injection and crosses the content boundary. It is
  explicitly excluded from the first experiment. [Electron
  `executeJavaScript`](https://www.electronjs.org/docs/latest/api/web-contents#contentsexecutejavascriptcode-usergesture)
- Electron emits `app`'s `web-contents-created` for future contents, and each
  `WebContents` exposes `did-finish-load`, `render-process-gone`, `destroyed`,
  and `isDestroyed()`. These are sufficient to reapply after a document load
  and fail closed when the target disappears or a second top-level window
  makes selection ambiguous. [Electron app lifecycle](https://www.electronjs.org/docs/latest/api/app#event-web-contents-created),
  [Electron WebContents lifecycle](https://www.electronjs.org/docs/latest/api/web-contents#event-did-finish-load)

## Why this differs from the failed renderer route

The recorded `1.26832.0.0` run passed the signed-package/AUMID checks but
`--remote-debugging-port=<port>` produced no verified IPv4 or IPv6 endpoint;
no renderer probe or styling ran. See the [local Gate A
record](../handoff/P0_SPIKE_RUNBOOK.md#2026-08-09-desktop-gate-a-second-changed-build-record).

| Property | Failed renderer route | Main-inspector candidate |
|---|---|---|
| Launch switch | `--remote-debugging-port=<port>` | `--inspect=127.0.0.1:<port>` |
| Endpoint owner | Chromium DevTools server | Node/V8 main process |
| Required build gate | Chromium remote debugging accepted | Electron `nodeCliInspect` fuse enabled |
| Access after attach | Renderer/browser CDP targets | Main-process `require('electron')` |
| Styling operation | Renderer expression | Main-process `webContents.insertCSS` |

Microsoft Playwright normally uses **both** switches because it automates both
the Electron main process and Chromium pages. Aura needs only the Node-inspector
side for this experiment. The previous Chromium failure lowers confidence in
MSIX argument forwarding, but it does not prove the distinct Node flag/fuse is
disabled.

## One-shot experimental protocol

1. Obtain action-time consent, verify exact signed MSIX version and AUMID, then
   exit Claude through its own **File > Exit** path. Require zero matching
   Claude processes. Do not terminate an unrelated process.
2. Pick one fresh high port, prove it is unused, and call
   `ActivateApplication` with only `--inspect=127.0.0.1:<port>` and `AO_NONE`.
   Do not pass `--inspect-brk`, `--remote-debugging-port`, `--user-data-dir`, a
   sandbox switch, a preload/loader, or an environment injection.
3. Within a short timeout, accept exactly one listener on `127.0.0.1:<port>`.
   Bind its owner, creation time, signed executable/package identity, and launch
   lineage to this activation. Reject wildcard, IPv6-any, unrelated, existing-
   instance, or ambiguous ownership.
4. Query only loopback `/json/list`; require one Node inspector target whose
   WebSocket host and port exactly match. Connect one local client and enable
   `Runtime`.
5. Run the capability probe above. Ask the user to focus Claude first; require
   `getFocusedWebContents()` to exist, be non-destroyed, and have type `window`.
   Record only version strings, aggregate type counts, and pass/fail booleans.
6. Install a unique main-process experiment object that refuses an existing
   owner. It stores the selected `WebContents`, listener functions, each
   `insertCSS` key, and an idempotent async `cleanup()`. Attach
   `did-finish-load` for reinsertion, `destroyed`/`render-process-gone` for
   cleanup, and `web-contents-created` only to fail closed if another top-level
   window appears. Add a short self-cleaning timer.
7. Inject only an inert diagnostic sheet through
   `insertCSS(..., { cssOrigin: 'user' })`, for example an unmistakable inset
   outline plus a namespaced custom property. It must contain no `url()`, font,
   network reference, animation, pointer behavior, generated text, or layout
   change. Do not call `executeJavaScript` or inspect DOM/content.
8. Capture a whole-window image of the actual Claude Desktop window only after
   the user confirms the visible diagnostic marker. This proves styling, not
   production-theme compatibility.
9. Call and await `cleanup()`: remove every inserted key, detach every listener,
   clear the timer and global owner, and return only cleanup booleans. Visually
   confirm the marker is gone before disconnecting the inspector.
10. Exit Claude normally, require the inspector listener to disappear, then
    stock-launch Claude without flags and prove the port stays closed. Any
    uncertainty is a NO-GO with stock Claude restored.

## Safety and evidence boundary

- The inspector is a local arbitrary-code-execution surface. Keep it explicit
  `127.0.0.1`, single-client, identity-bound, time-limited, foreground-only,
  and absent from ordinary launches. Never expose `0.0.0.0` or a LAN address.
- Do not read or log URLs, titles, DOM, messages, prompts, account data,
  cookies, storage, clipboard, network bodies, console history, files, or
  screenshots through the inspector. Do not modify the package, `app.asar`,
  user profile, settings, or update registration.
- A listener proves only launch capability. `require('electron')` proves only
  main-process API access. A returned CSS key plus visible marker and verified
  removal proves reversible styling for that exact build and state. None of
  these alone proves all surfaces, restart persistence, update compatibility,
  or release readiness.
- If the fuse is disabled, the argument is discarded, `require('electron')`
  fails, target selection is ambiguous, cleanup cannot be proven, or the stock
  relaunch still exposes a listener, stop. Do not patch the signed binary or
  substitute DLL injection, package debugging state, preload shims, or ASAR
  modification.
