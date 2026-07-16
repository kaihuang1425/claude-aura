# Troubleshooting

## I am signed in elsewhere, but Aura asks me to sign in

Aura has its own WebView2 profile so it does not borrow cookies from Claude
Desktop or your normal browser. Sign in once inside Aura. The profile is kept
under `%LOCALAPPDATA%\ClaudeAura\webview` and should remember you afterward.

## Aura stays on Opening Claude

Check that ordinary `https://claude.ai/` pages load on your network. A proxy,
VPN, captive portal, firewall, or sign-in service can delay navigation. Close
and reopen Aura after completing any network login.

If the window says the browser could not start, repair or install the Microsoft
Edge WebView2 Runtime. Aura uses the installed Evergreen runtime rather than
shipping a separate browser engine.

Technical startup errors are written to
`%LOCALAPPDATA%\ClaudeAura\data\aura-ui.log`. The log is not intended to
capture chats.

## Claude loads but the theme does not

Close and reopen Aura. The theme is applied only to HTTPS pages owned by
`claude.ai` or `claude.com`; sign-in provider pages deliberately keep their
normal appearance. After sign-in redirects back to Claude, Aura applies the
selected theme automatically.

Run this developer check if needed:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\windows\verify.ps1
```

## Theme settings become damaged

Aura recovers to the Default theme when its local configuration is truncated or
is not a JSON object. Before the repaired settings are written, the unreadable
file is preserved beside `config.json` with a
`config.json.corrupt-<timestamp>-<suffix>.json` name. Choose your preferred
theme again after recovery; delete the backup only after you no longer need it
for diagnosis.

## Claude Desktop opens without a theme

That is expected in Aura 0.3. The **Desktop app** button opens Anthropic's
signed application unchanged. Use the main Claude Aura window for the themed
Claude interface.

## A custom image does not appear

Use PNG, JPEG, WebP, GIF, or AVIF and keep the file below 16 MB. Moving or
deleting the image after selecting it prevents Aura from rebuilding the theme.
Choose the image again from **Background...**.

## I want to remove Aura styling

Click **Original look** in the top bar. It removes the injected stylesheet and
background immediately. Click **Apply theme** to restore it. No Claude restart
is needed.

## I want to uninstall Claude Aura

Open **Claude Aura > Uninstall Claude Aura** from the Start menu or run
**Uninstall Claude Aura.cmd** from the release. Close the Claude Aura window
first. The default removes the local application copy and shortcuts while
keeping theme settings and Aura's separate WebView sign-in profile. Choose the
data-erasure option only if you also want to remove those local settings and
the saved Aura sign-in session. Anthropic's Claude installation is not changed.

## Node.js is missing

Install Node.js 22 or newer from the official Node.js distribution, then run
the installer again. Aura launches its helper processes invisibly; no terminal
is left open during normal use.

## Claude Desktop prints extension or Bluetooth errors

Messages mentioning `getInstalledExtensionsWithState`, `_parse`,
`BuddyBleTransport`, or missing BLE handlers come from Claude Desktop itself.
They are not the reason Aura's former debugging-port launch failed and are not
used by the WebView2 companion. Report them to Anthropic only if the related
official Claude feature is broken.
