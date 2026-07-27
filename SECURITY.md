# Security

On Windows, Claude Aura uses Microsoft Edge WebView2 to load `https://claude.ai/`
in a dedicated local profile. Aura injects its stylesheet only after the
current page belongs to an HTTPS `claude.ai` or `claude.com` host. Sign-in
provider pages are not themed.

Aura does not enable a remote-debugging port, patch Claude Desktop, change
package permissions, bypass Anthropic's signed debugging authorization, or
modify account, model, provider, or conversation data. The **Desktop app**
button launches the official executable normally.

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
Releases page. When the developer does not have a code-signing certificate, a
release may provide two explicitly no-certificate paths:

- the allowlisted release ZIP, its SHA-256, and the readable
  `Install Claude Aura.cmd` source-script entry point; and
- a guided native Setup whose filename ends in `-UNSIGNED.exe`, accompanied by
  its SHA-256 and build manifest.

SHA-256 detects changed bytes but does not authenticate a publisher. The
unsigned Setup must identify that limitation in its filename, first wizard
page, manifest, documentation, and release notes. If Windows warns about or
blocks it, users must use the ZIP/CMD path instead of bypassing the warning.

A Setup filename without `-UNSIGNED` is a signed release path. It must have a
valid Authenticode signature, expected certificate thumbprint, and timestamp
certificate; its publisher must match the release notes. An executable ending
in `-UNSIGNED-DEV.exe` remains local-development-only and must never be a
release asset.

Claude Aura does not ask users to install a root certificate, disable
SmartScreen, ignore a publisher mismatch, or run Setup as administrator.
Neither install path downloads its application payload, adds a service, creates
a scheduled task, installs a driver, or modifies Claude Desktop. Both check the
installed Node.js and WebView2 prerequisites before changing the app.
Interrupted app replacement is guarded and recoverable. See
`docs/WINDOWS_INSTALLER.md` for the ZIP, signing, recovery, and release
contract.

To report a vulnerability, open a private security advisory in the repository
instead of a public issue.
