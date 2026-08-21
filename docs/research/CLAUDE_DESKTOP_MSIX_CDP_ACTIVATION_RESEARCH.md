# Claude Desktop MSIX CDP activation research - 2026-08-09

Scope: primary Microsoft, Electron, and Chromium documentation/source for a reversible launch or attach path that can expose a loopback-only Chrome DevTools Protocol (CDP) endpoint from the stock signed Claude Desktop MSIX. This note does not launch, stop, modify, re-register, unpack, or debug the package, and it does not claim Gate A has passed.

## Local baseline

The repository's read-only capability probe reported Claude Desktop `1.25927.0.0`, MSIX, signed, with AUMID `Claude_pzs8sxrjxfjjc!Claude`. A separate read-only manifest query found `Executable="app\\Claude.exe"`, `EntryPoint="Windows.FullTrustApplication"`, and only startup-task, protocol, and service extensions; there is no `windows.appExecutionAlias`. Desktop was already running, so no launch experiment was attempted.

The prior Gate A record for `1.24012.9.0` exhausted three routes: shell/AUMID activation, direct packaged-executable launch, and `Invoke-CommandInDesktopPackage` with package identity plus arguments. The changed build legitimately reopens the gate, but does not convert old negative evidence into a pass.

## Decision

**One genuinely new, officially supported launch route exists:** after the user closes every Claude Desktop process normally, instantiate Windows' `IApplicationActivationManager` out of process and call:

```text
ActivateApplication(
  "Claude_pzs8sxrjxfjjc!Claude",
  "--remote-debugging-port=<fresh-high-port>",
  AO_NONE,
  out processId)
```

Microsoft documents `ActivateApplication` as the generic AUMID launch contract, with an optional app-specific argument string and the PID of the app instance fulfilling the contract. For a short-lived launcher, Microsoft recommends creating the activation manager with `CLSCTX_LOCAL_SERVER`. [Interface and lifetime guidance](https://learn.microsoft.com/en-us/windows/win32/api/shobjidl_core/nn-shobjidl_core-iapplicationactivationmanager), [`ActivateApplication`](https://learn.microsoft.com/en-us/windows/win32/api/shobjidl_core/nf-shobjidl_core-iapplicationactivationmanager-activateapplication)

Microsoft's current WinApp CLI calls this same API for AUMID launch, passing its documented `--args` value unchanged to `ActivateApplication`. That is strong first-party implementation evidence that this is the intended identity-preserving argument path for packaged desktop apps. It is not proof that Claude's entry point will let Electron consume the switch. [WinApp CLI `run` contract](https://github.com/microsoft/winappCli/blob/main/docs/usage.md#run), [Microsoft launcher source](https://github.com/microsoft/winappCli/blob/main/src/winapp-CLI/WinApp.Cli/Services/AppLauncherService.cs)

This route is new relative to the old shell/AUMID attempt because `explorer.exe shell:AppsFolder\\<AUMID>` carried no diagnostic argument string. It is safer than `Invoke-CommandInDesktopPackage` because it performs real registered-app activation, not creation of a debugging process with only a similar package token. It requires no package edit, debug-mode setting, alternate profile, or persistent registration; normal Exit should remove the endpoint.

## Electron and Chromium facts

- Electron explicitly supports `--remote-debugging-port=<port>`, which enables remote debugging over HTTP. Its example appends the switch before the app `ready` event. Electron also warns that unsupported command-line switches have no effect. [`Supported Command Line Switches`](https://www.electronjs.org/docs/latest/api/command-line-switches)
- Electron does **not** document `--remote-debugging-address`. Chromium removed that address override from headless Chromium in 2024 because unauthenticated remote CDP exposure was too dangerous. Do not use this switch as a loopback guarantee. [Chromium removal change](https://chromium.googlesource.com/chromium/src/+/6fee475feb9bc9aaded8f9b6443d18edb22de86b%5E%21/)
- Current Chromium source creates the normal DevTools HTTP socket on `127.0.0.1`, falling back to `::1`; it does not accept an arbitrary bind address. A valid `--remote-debugging-port` is `0..65535`; port `0` requests an ephemeral port and causes the selected port to be written to `DevToolsActivePort` in the user-data directory. [Chromium remote-debugging server source](https://chromium.googlesource.com/chromium/src/+/main/chrome/browser/devtools/remote_debugging_server.cc)
- For this gate, a prechecked random high port is simpler than port `0`, because the installed Electron user-data path and `DevToolsActivePort` placement have not been proven. Accept only an actual listener on `127.0.0.1` or `::1`; never treat the flag alone as evidence.
- The Chrome 136+ default-profile restriction in current Chromium source is enabled for Google Chrome branding, not ordinary Chromium branding except under a test override. Adding `--user-data-dir` to this Electron experiment is therefore unsupported inference and would abandon the real signed-in profile that Gate A is meant to test. This must still be validated against Claude's embedded Electron/Chromium build rather than assumed from Chromium `main`.

## MSIX activation routes compared

| Route | Official boundary | Gate-A assessment |
|---|---|---|
| Old shell/AUMID (`shell:AppsFolder`) | Normal registered-app activation, but the used form has no separate argument channel. | Keep only as stock restore/normal launch; it cannot establish CDP by itself. |
| Old direct `app\\Claude.exe` launch | Starts a file path rather than using the package's AUMID activation contract. | Already failed on the old build; not the preferred MSIX route. |
| Old `Invoke-CommandInDesktopPackage` | Microsoft now calls it a debugging tool. Its token is similar to, but not identical to, a real AppId process; behavior beyond package identity/virtualized resources is not guaranteed, and side effects are undefined. | Do not promote to product launch. The old identity-plus-arguments failure remains valid evidence for that build. [Microsoft cmdlet reference](https://learn.microsoft.com/en-us/powershell/module/appx/invoke-commandindesktoppackage?view=windowsserver2025-ps) |
| App execution alias | Supported command-line activation only when the package publisher declares `windows.appExecutionAlias` in the signed manifest. | Unavailable: the installed `1.25927.0.0` manifest has no alias. Adding one would modify/repackage the signed product. [Microsoft packaging extensions](https://learn.microsoft.com/en-us/windows/apps/desktop/modernize/desktop-to-uwp-extensions#start-your-application-by-using-an-alias) |
| **New COM AUMID + arguments** | `IApplicationActivationManager::ActivateApplication(AUMID, arguments, AO_NONE, out PID)`. | **Safest new Gate A candidate.** Real package activation, explicit args, no persistent package change. Runtime result remains unknown. |

Microsoft identifies the AUMID as the application identity Windows uses to reason about a packaged application at runtime. [Package/application identity](https://learn.microsoft.com/en-us/windows/apps/desktop/modernize/package-identity-overview#applicationusermodelid-aumid)

## Attach-to-running boundary

No supported external mechanism was found that retrofits renderer CDP onto an already-running Electron process that started without a DevTools endpoint:

- Electron's `webContents.debugger.attach()` is an alternate in-process CDP transport. The `Debugger` class is not exported from Electron and is available only through a `webContents` object in the app's main process. An external Aura process cannot invoke it without cooperation from Claude's code. [Electron `Debugger`](https://www.electronjs.org/docs/latest/api/debugger)
- Visual Studio/WinDbg can attach a native or managed debugger to a running packaged process. That attaches an OS debugger; it does not start Chromium's DevTools HTTP server. [Microsoft MSIX debugging](https://learn.microsoft.com/en-us/windows/msix/desktop/desktop-to-uwp-debug)
- `IPackageDebugSettings::EnableDebugging` can arrange debugger attach on activation, but it changes package lifecycle behavior by disabling activation timeouts, suspension, termination, and resumption until `DisableDebugging` is called. Its `debuggerCommandLine` names the debugger, not extra arguments for the target Electron app. It is reversible but is not a CDP route and is outside the no-package-debug-state candidate. [`EnableDebugging`](https://learn.microsoft.com/en-us/windows/win32/api/shobjidl_core/nf-shobjidl_core-ipackagedebugsettings-enabledebugging)
- Chrome 144 introduced a user-approved `chrome://inspect/#remote-debugging` auto-connect flow for a running **Google Chrome** instance. The official documentation does not extend it to Electron, and Electron does not document an equivalent UI or API. It is therefore not a supported Claude Desktop route. [Chrome auto-connect documentation](https://developer.chrome.com/blog/chrome-devtools-mcp-debug-your-browser-session)

This is a documented-search boundary, not proof that no private or unsupported injection technique exists. Unsupported DLL injection, package edits, `app.asar` changes, debugger shims, or reconstructed UI remain outside scope.

## Recommended one-shot Gate A protocol

The following is an implementation inference from the documented APIs, not a completed test:

1. Obtain explicit user consent, close Claude Desktop through its own Exit path, and prove no matching stock process or diagnostic listener remains.
2. Re-run the signed-package probe and require exactly version `1.25927.0.0`, the expected AUMID, full-trust entry point, and valid Anthropic signature.
3. Select and precheck a fresh high port on both loopback families. Do not pass `--remote-debugging-address`, `--user-data-dir`, `--inspect`, or any sandbox-weakening switch.
4. Create `IApplicationActivationManager` with `CLSCTX_LOCAL_SERVER`; call `ActivateApplication` with only `--remote-debugging-port=<port>` and `AO_NONE`.
5. Bind the returned PID and any proven child tree to the expected package identity, executable signature, creation time, and listener owner. Reject an existing-instance handoff, unrelated listener, wildcard/non-loopback bind, ambiguous lineage, or unexpected process count.
6. Query `/json/version` only through the proven loopback address, validate its WebSocket URL and browser ID, then run the existing read-only renderer probe.
7. Close Desktop normally, require the endpoint to disappear, then verify a later ordinary stock launch exposes no diagnostic listener and preserves update behavior.

If the activated stock process does not survive with the switch or no verified loopback endpoint appears, stop. There is no supported attach-to-running fallback to try on that instance.

## Exact evidence boundary

This research establishes only that COM AUMID activation with an argument string is documented, identity-preserving, non-persistent, and materially distinct from the three recorded routes. The local checks establish the installed version, signature boolean, AUMID, entry point, and absence of an execution alias.

It does **not** establish that Claude Desktop receives the argument as an Electron switch, that its embedded Chromium starts CDP, that a listener is loopback-only, that Aura can attach, that injection works, or that cleanup passes. Those claims require a fresh consented live Gate A run after the currently running Desktop instance is closed normally.
