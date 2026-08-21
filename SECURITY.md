# Security

On Windows, Claude Aura uses Microsoft Edge WebView2 to load `https://claude.ai/`
in a dedicated local profile. Aura injects its stylesheet only after the
current page belongs to an HTTPS `claude.ai` or `claude.com` host. Sign-in
provider pages are not themed.

Aura does not enable a remote-debugging port, patch Claude Desktop, change
package permissions, bypass Anthropic's signed debugging authorization, or
modify account, model, provider, or conversation data. The **Desktop app**
button launches the official executable normally.

The source-only Claude Desktop overlay can show Aura's local Work Hub beside
the verified signed Claude Desktop window. The panel loads only the packaged
`work-hub.html` surface and never injects into, automates, or reads Claude
Desktop. It talks to the running Aura Main process over a rotating,
current-user-only local named pipe. Requests are authenticated, bounded, and
replay-protected; responses contain only body-free observed-session fields and
never expose provider routes. A card reports `opened` only after Aura Main has
actually selected or opened that observed session, and Aura Main is brought to
the foreground only after that success.

The WebView2 profile under `%LOCALAPPDATA%\ClaudeAura\webview` contains browser
session data and should be protected like any other signed-in browser profile.
Aura does not deliberately read or log chat text. Technical exceptions are
written to `%LOCALAPPDATA%\ClaudeAura\data\aura-ui.log`.

## Prompt Shelf draft protection

Prompt Shelf is a local draft store, not a send queue. Its Insert actions place
text at the current Claude composer caret exactly once and do not submit the
form, press Enter, use the clipboard, poll response state, or retry
automatically.

Saved drafts are encrypted at rest with Windows DPAPI `CurrentUser`. The store
directory and file use a protected access-control list limited to the current
Windows user and Local System. Draft bodies are not written to Aura's technical
log or to body-bearing insertion receipts.

Drafts remain until the user deletes them or explicitly removes Aura's local
data. Original look, restart, reinstall, and the default uninstall retain the
encrypted store. The uninstaller's explicit local-data removal option deletes
it with the rest of Aura-owned data.

When Aura finds the legacy plaintext store, it first replaces inherited file
permissions with the protected access-control list. It then validates the
legacy state, writes a DPAPI `CurrentUser` replacement, decrypts that
replacement, and verifies the exact item order and text before deleting the
legacy file. A failed migration rolls back a newly created replacement, keeps
the legacy file access-restricted, disables saved-draft operations, and logs
only a content-free event code.

Aura Rescue Mode recognizes a Cloudflare access check from the
`cf-mitigated: challenge` response header only when the response URL exactly
matches the current top-level HTTPS Claude navigation. It reads no request
headers, cookies, response body, challenge markup, page text, or challenge URL
for logging. Because WebView2's response observer is non-blocking, Aura reveals
the genuine completed document immediately and uses a short, in-memory gate
before renderer or mirror work. This lets a late marked response at any valid
status enter Rescue Mode; a matching top-level Claude HTTP 403 receives
immediate fail-native protection while the marker is pending. Rescue Mode
leaves the response document untouched. It does not automate or bypass the
challenge.

The optional clean session uses WebView2's InPrivate controller mode. It
requires a new sign-in, keeps its browser data temporary, and does not clear,
delete, or replace the normal Aura profile. Starting it always requires a
native confirmation.

The Windows uninstaller removes only `%LOCALAPPDATA%\ClaudeAura\app` and Aura's
shortcuts by default. Erasing `%LOCALAPPDATA%\ClaudeAura\data` and
`%LOCALAPPDATA%\ClaudeAura\webview` requires an explicit confirmation or the
`-RemoveData` switch. Neither path belongs to Anthropic's installed Claude app.

A selected background image is converted to a local data URL and placed in the
Claude page's memory so CSS can display it. Aura does not upload that image,
but the page can technically access DOM data in its own process. Do not select
a sensitive image, and review screenshots before sharing them.

Themes may include local `customCss`, which is intentionally powerful. The
validator rejects remote stylesheet resources. Contributors must not hide
permission, safety, account, or billing controls.

## Installer authenticity

Official public Windows distributions come only from the repository's GitHub
Releases page. Each release provides one guided native Setup, accompanied by
its SHA-256 and build manifest. When the developer does not have a code-signing
certificate, its filename ends in `-UNSIGNED.exe`.

SHA-256 detects changed bytes but does not authenticate a publisher. The
unsigned Setup must identify that limitation in its filename, first wizard
page, manifest, documentation, and release notes. If Windows warns about or
blocks it, users must stop instead of bypassing the warning.

A Setup filename without `-UNSIGNED` is a signed release path. It must have a
valid Authenticode signature, expected certificate thumbprint, and timestamp
certificate; its publisher must match the release notes. An executable ending
in `-UNSIGNED-DEV.exe` remains local-development-only and must never be a
release asset.

Claude Aura does not ask users to install a root certificate, disable
SmartScreen, ignore a publisher mismatch, or run Setup as administrator.
Setup does not download its application payload, add a service, create a
scheduled task, install a driver, or modify Claude Desktop. It checks the
installed Node.js and WebView2 prerequisites before changing the app.
Interrupted app replacement is guarded and recoverable. See
`docs/WINDOWS_INSTALLER.md` for signing, recovery, and the release contract.

To report a vulnerability, open a private security advisory in the repository
instead of a public issue.
