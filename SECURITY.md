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

To report a vulnerability, open a private security advisory in the repository
instead of a public issue.
