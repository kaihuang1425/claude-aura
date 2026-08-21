# WO-23 macOS primary-source research - 2026-08-09

Scope: plan-only research for `docs/plans/WORK_ORDERS.md:2450-2457`. Platform
claims use Apple or WebKit sources; local findings are labeled separately. This
is not `MAC_PLAN.md`, does not authorize code, and contains no runtime proof.

## Bottom line

- Use an AppKit `NSApplication` with a normal Dock window containing live
  `WKWebView`, a separate local Studio `WKWebView`, native menus, and an optional
  `NSStatusItem`.
- Prefer **macOS 14+**: it provides named persistent `WKWebsiteDataStore`
  profiles that Aura can restore and delete deterministically.
- Inject prepaint and renderer scripts at document start in an isolated
  `WKContentWorld`; use targeted JavaScript evaluation for immediate switching.
- Prefer a Developer ID-signed, hardened, notarized universal app for v1. Mac
  App Store distribution requires App Sandbox and conflicts more directly with
  the current external Node runtime model.
- Plan-critical correction: the Studio UI/core can remain canonical, but a
  narrow generated macOS URL/bridge adapter is required. Public WKWebView APIs
  cannot reproduce WebView2's local `https://aura.*` virtual-host mapping.

## Local findings and Dream Skin boundary

Current Studio has two WebView2 seams:

- `studio/app.js:733` and `assets/editor-overlay.js:249-261` use
  `window.chrome.webview`.
- `studio/index.html:8`, `studio/app.js:380-434`, `studio/editor.js:645-721`,
  and `scripts/theme-core/studio.mjs:1326-1449` use fixed
  `https://aura.assets`, `aura.previews`, `aura.user-themes`, and `aura.editor`
  URLs. Windows maps them at `windows/aura-ui.ps1:12642-12680`.

The nearby reference is `C:\Users\erich\Documents\In Progress\Codex-Dream-Skin\Codex-Dream-Skin-main`.
It is a loopback-CDP injector around the official Codex app, not a WKWebView host
(`macos/README.md:7,61-68`; `macos/references/runtime-notes.md:3-14`). Its menu
path also depends on SwiftBar (`macos/scripts/install-menubar-macos.sh:3,62-80`).
Reuse only its operational patterns: local data, exact job identity,
apply/pause/restore, doctor checks, and live verification. Do not reuse CDP,
another app's Node, launchd babysitting, or SwiftBar.

## Documented facts

### Injection and host bridge

Apple documents `WKUserScript` as the page-injection API. Add it to the
configuration's `WKUserContentController` before creating the web view;
`.atDocumentStart` runs after the document element exists but before other
content loads. [`WKUserScript`](https://developer.apple.com/documentation/webkit/wkuserscript), [`atDocumentStart`](https://developer.apple.com/documentation/webkit/wkuserscriptinjectiontime/atdocumentstart)

`WKContentWorld` isolates JavaScript globals while keeping DOM mutations shared.
Native code can evaluate a new payload in the same world for immediate apply.
[`WKContentWorld`](https://developer.apple.com/documentation/webkit/wkcontentworld), [`evaluateJavaScript`](https://developer.apple.com/documentation/webkit/wkwebview/evaluatejavascript%28_%3Ain%3Acontentworld%3A%29)

Message handlers can be content-world-scoped. Inference: install an isolated
`window.chrome.webview` shim for the live overlay and a page-world shim only in
trusted local Studio; validate view, frame, origin, schema, and size natively.
[`addScriptMessageHandler`](https://developer.apple.com/documentation/webkit/wkusercontentcontroller/addscriptmessagehandler%28_%3Acontentworld%3Aname%3A%29)

Use `WKNavigationDelegate` for navigation, auth, downloads, failures, and
content-process termination; use `WKUIDelegate` for popups, files, and
permissions. Recreate the Claude/sign-in allowlist and open unrelated HTTPS
externally. [`WKNavigationDelegate`](https://developer.apple.com/documentation/webkit/wknavigationdelegate),
[`WKUIDelegate`](https://developer.apple.com/documentation/webkit/wkuidelegate)

### Website data and profile

`WKWebsiteDataStore` owns cookies, caches, and other site data. The default store
persists; `nonPersistent()` is memory-only. macOS 14 added named persistent
stores and supported removal after releasing web views that use the store.
[`WKWebsiteDataStore`](https://developer.apple.com/documentation/webkit/wkwebsitedatastore), [WebKit profile API](https://webkit.org/blog/14423/building-profiles-with-new-webkit-api/), [`remove(forIdentifier:)`](https://developer.apple.com/documentation/webkit/wkwebsitedatastore/remove%28foridentifier%3Acompletionhandler%3A%29)

Inference: use one stable named store for live Aura and a separate nonpersistent
store for Studio. Do not copy Safari cookies. Fresh sign-in, OAuth, passkeys,
and popup compatibility require live `claude.ai` proof; Apple docs cannot prove
that the current service accepts embedded WKWebView authentication.

### Local-only assets: required correction

Signed resources belong in the app bundle. WKWebView can serve programmatic
local resources through `WKURLSchemeHandler`, but Apple says registering a
handler for a WebKit-owned scheme such as `https` is a programmer error.
[`Bundle`](https://developer.apple.com/documentation/foundation/bundle),
[`WKURLSchemeHandler`](https://developer.apple.com/documentation/webkit/wkurlschemehandler),
[`setURLSchemeHandler`](https://developer.apple.com/documentation/webkit/wkwebviewconfiguration/seturlschemehandler%28_%3Aforurlscheme%3A%29)

Therefore current `https://aura.*` resources have no direct public WKWebView
folder mapping. Recommended inference: generate a derived Studio resource copy
using an Aura custom scheme, and translate only allowlisted preview URLs at the
native bridge boundary. Keep canonical UI, schemas, and theme core shared. A
loopback server would add a listener, origin/TLS work, and attack surface.

Live renderer artwork is already compiled into bounded data URLs, so the live
view needs no file URL, server, or remote theme resource. Treat the page's CSP
compatibility as a live test, not a documented guarantee.

### Appearance and native shell

AppKit appearance inherits from app to window to view, with explicit overrides
available. WebKit supports `prefers-color-scheme`/`color-scheme` but does not
auto-darken arbitrary pages. [`NSAppearance`](https://developer.apple.com/documentation/appkit/nsappearance),
[Dark Mode in WebKit](https://webkit.org/blog/8840/dark-mode-support-in-webkit/)

Inference: System inherits; Light/Dark assign `.aqua`/`.darkAqua` to both
windows and compile the same explicit appearance into the payload. Verify
`matchMedia` and Claude appearance alignment live.

`NSStatusItem` is the menu-bar analogue of a Windows tray icon. Apple says menu
bar items should be sparse, may not always be available, and need a hide option.
`.regular` apps have Dock/menu presence; `.accessory` apps do not. Recommend a
regular app with optional status item, never status-item-only recovery.
[`NSStatusBar`](https://developer.apple.com/documentation/appkit/nsstatusbar),
[`NSApplication.ActivationPolicy`](https://developer.apple.com/documentation/appkit/nsapplication/activationpolicy-swift.enum)

### Distribution, updates, and uninstall

Mac App Store apps must enable App Sandbox. Direct notarized apps must enable
Hardened Runtime; sandboxing is optional. A sandboxed Aura needs outgoing
network access and user-selected file access for import/export.
[`Preparing for distribution`](https://developer.apple.com/documentation/xcode/preparing-your-app-for-distribution),
[`macOS App Sandbox`](https://developer.apple.com/documentation/xcode/configuring-the-macos-app-sandbox),
[`network.client`](https://developer.apple.com/documentation/bundleresources/entitlements/com.apple.security.network.client)

For direct distribution: Developer ID-sign every executable, build universal
`arm64`/`x86_64`, enable Hardened Runtime, submit with `notarytool`, inspect the
log, and staple the ticket. A bundled JIT runtime needs a specific `allow-jit`
assessment; do not add broad exceptions speculatively.
[`Notarizing macOS software`](https://developer.apple.com/documentation/security/notarizing-macos-software-before-distribution),
[`Universal binary`](https://developer.apple.com/documentation/apple-silicon/building-a-universal-macos-binary),
[`allow-jit`](https://developer.apple.com/documentation/bundleresources/entitlements/com.apple.security.cs.allow-jit)

The Mac App Store supplies updates. Direct builds need a manual signed-release
path or a separately approved updater. Deleting an app may leave app data or
login items, so Aura needs explicit reset/remove-data actions. A full removal
must release web views, delete the named store, unregister any login service,
and separately ask whether to preserve user kits.
[Apple app updates](https://support.apple.com/en-us/102629),
[Apple uninstall guidance](https://support.apple.com/en-ie/102610),
[`SMAppService`](https://developer.apple.com/documentation/servicemanagement/smappservice)

### Accessibility

Standard AppKit controls provide built-in accessibility; custom controls need
appropriate roles. Observe Reduce Motion, Reduce Transparency, Increase
Contrast, and Differentiate Without Color, including preference-change
notifications. Keep renderer artwork inert/`aria-hidden`, stop decorative
motion under `prefers-reduced-motion`, and do not equate Windows forced-colors
with macOS Increase Contrast. [`Accessibility for AppKit`](https://developer.apple.com/documentation/appkit/accessibility-for-appkit),
[`accessibilityDisplayShouldReduceMotion`](https://developer.apple.com/documentation/appkit/nsworkspace/accessibilitydisplayshouldreducemotion),
[WebKit reduced motion](https://webkit.org/blog/7551/responsive-design-for-motion/)

## Proposed acceptance matrix (inference)

| Layer | Required proof |
| --- | --- |
| Shared core | Existing check/payload cycle on macOS Node 22; all eight Light/Dark themes; kit import/export; corrupt-state recovery |
| Host | document-start injection, switch/cleanup, SPA reload, terminated content process, popup policy, upload/download, microphone, offline/failure reveal |
| Profile | first sign-in, relaunch, sign-out, Studio isolation, reset, named-store deletion, single-instance behavior |
| Appearance/accessibility | System/Light/Dark, 100%/200% scale, Reduce Motion/Transparency, Increase Contrast, VoiceOver, keyboard-only |
| Package | clean Intel and Apple-silicon Macs, valid signature, accepted/stapled notarization, offline launch, upgrade/rollback, app/data/login-item removal |
| Visual | whole actual Aura window on live signed-in `claude.ai`; complete actual Studio window; no fixture, Studio canvas as Aura proof, or WKWebView-only snapshot |

Use XCTest/XCUIAutomation for host workflows; keep installed/live proof separate.
[`XCTest`](https://developer.apple.com/documentation/xctest/)

## Unresolved owner decisions

1. Developer ID direct distribution (recommended) or Mac App Store sandbox.
2. Validated external Node 22 prerequisite, or a bundled universal Node helper
   with added size/signing/JIT work. Never borrow another app's Node.
3. Approve the generated custom-scheme/bridge adapter (recommended), or relax
   the local-only/no-server boundary. Byte-identical local `https://aura.*`
   mapping is not supplied by public WKWebView APIs.
4. macOS 14+ (recommended) or an older floor with weaker profile management.
5. Regular Dock/menu app plus optional status item (recommended), or accessory.
6. Preserve user kits on data removal (recommended) or separately confirm erase;
   decide whether reset deliberately signs out by deleting website data.
7. Exact login/popup origins and required passkey, upload/download, voice,
   notification, and payment flows; every selected capability needs live proof.
