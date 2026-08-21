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

## Claude shows a blank page or browser check

Some Claude access checks are served by Cloudflare as a real top-level
`claude.ai` response. Aura recognizes Cloudflare's `cf-mitigated: challenge`
response marker only when it belongs to the current Claude navigation. It then
reveals the genuine page, pauses theme injection and Studio mirroring, and
stops automatic retry behavior. Aura does not replace, hide, solve, or
automate the check. WebView2 does not guarantee when the response observer runs.
Aura therefore reveals a completed Claude page immediately but briefly holds
only theme injection and Studio mirroring so a late challenge marker can still
be correlated at any valid response status. A current top-level Claude HTTP 403
also receives immediate fail-native protection while that marker is pending.

The native **Claude Aura recovery** card offers three user-controlled choices:

- **Continue in browser** opens the fixed `https://claude.ai/` address in the
  default browser.
- **Start clean session** closes Aura and reopens it with a temporary WebView2
  private session. It starts signed out and is discarded when that Aura window
  closes. The normal Aura profile and its saved sign-in remain untouched.
- **Retry in Aura** makes one explicit retry. A repeated challenge reopens the
  circuit breaker instead of starting a reload loop.

If the check also appears in the clean session, use the normal browser and
check the network path. A VPN, proxy, filtering DNS service, corporate gateway,
or the current public IP can cause the same server-side decision across every
fresh local profile. No local wrapper can guarantee a Cloudflare bypass; the
site owner controls that decision.

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
Claude interface. Aura 0.3 also does not theme native Claude Desktop Code or
the Claude Code terminal, and ordinary Claude chat inside Aura cannot read a
local project.

Aura Code is release-blocking work for the final release and is not currently
a supported, stable, installed, or released Aura feature. Its approved plan is
CLI-first: Aura will guide the user to an official local Claude Code/Remote
Control engine only after the remaining support and live-human gates pass.
The first Code activation will offer local Aura setup, an existing session,
the full native Desktop workspace, or no local editing, with the setup and its
benefits, limitations, and privacy details available again in Settings.
Matching official terminal themes support direct CLI and Agent View use.
Claude Desktop remains the unchanged, unthemed full-workspace destination
rather than a hidden Aura dependency. Aura will use a direct handoff only if
that documented route passes its feasibility gate; otherwise it will offer
truthful current guidance. Optional Agent View status, Desktop minimization,
and VS Code theming ship only if their separate feasibility gates pass.

### Source-checkout Aura Code styling experiment and detour recovery

Developers can opt into a reversible source-checkout-only styling experiment.
Installers, ordinary launches, release payloads, and Claude Desktop remain
unchanged. The experiment requires exactly one visible `aside` and one visible
`main`; it themes only those two structural surfaces with the selected
built-in's background palette and fixed inset material cue. Inner regions,
lists, editors, controls, and unknown structures stay native. Existing native
shell elevation, malformed material data, or any visible native `dialog`, ARIA
`dialog`, or ARIA `alertdialog` rolls the entire experiment back to native
presentation. Forced colors and every requested contrast mode also stay
native.

Start it explicitly from the repository root:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\windows\start.ps1 -ExperimentalCodeStyle -ExperimentalCodeStart
```

If WebView2 reports a canceled or aborted handoff while the verified Code
document is still current, Aura reveals that document. Otherwise Aura shows
**Return to Aura Code**. Select it to navigate to the fixed
`https://claude.ai/code` route. Aura does not retry automatically, replay the
failed destination, or retain that destination. It does not automate sign-in,
trust, prompts, permissions, or project access, and it does not read or retain
Code text, paths, files, transcripts, or session URLs. Ordinary launches,
failed classification, **Original look**, and cleanup keep or restore native
behavior. Passing developer tests or a private live observation does not make
this experiment release-eligible; the full WO-27 checkpoint remains open.

## A custom image does not appear

Use PNG, JPEG, WebP, GIF, or AVIF and keep the file below 16 MB. Moving or
deleting the image after selecting it prevents Aura from rebuilding the theme.
Choose the image again from **Background...**.

## My sidebar wordmark does not appear

Open Studio's **Personal wallpaper** page and replace the image with a PNG or
JPEG no larger than 2 MB and at least 344 × 124 px. Aura keeps the source in
its own local data folder and uses a fixed transparent crop. If the saved file
cannot be validated, Aura shows the selected theme's built-in wordmark or
Claude's native logo instead. A collapsed or narrow sidebar, ambiguous live
logo target, forced-colors mode, and **Original look** intentionally keep the
native Claude visual.

## I want to remove Aura styling

Click **Original look** in the top bar. It removes the injected stylesheet and
background immediately. Click **Apply theme** to restore it. No Claude restart
is needed.

## I want to uninstall Claude Aura

Use **Settings > Apps > Installed apps > Claude Aura > Uninstall**, open
**Claude Aura > Uninstall Claude Aura** from the Start menu, or use **Settings
> Apps > Installed apps > Claude Aura > Uninstall**. Close the Claude Aura
window first. The default removes the local application copy and shortcuts
while keeping theme settings and Aura's separate WebView sign-in profile.
Choose the data-erasure option only if you also want to remove those local
settings and the saved Aura sign-in session. Anthropic's Claude installation
is not changed.

## Windows warns about the installer publisher

The public `Claude-Aura-Setup-v<version>-UNSIGNED.exe` has no Authenticode
publisher identity. Its filename, first wizard page, checksum, and manifest all
say so. If Windows warns about or blocks it, do not bypass the warning. A
checksum detects changed bytes; it does not authenticate a publisher. Stop if
the filename, location, checksum, or manifest differs from the release notes.

A Setup filename without `-UNSIGNED` must be Authenticode-signed and
timestamped. Open **Properties > Digital Signatures** and compare its publisher
with the release notes. An executable ending in `-UNSIGNED-DEV.exe` is never a
public release asset. The project never asks you to disable SmartScreen,
install a root certificate, ignore a publisher mismatch, or run Setup as
administrator.

If uninstall stops partway through, fix the reported cause and run the same
native uninstaller again. Its versioned maintenance helper and Installed apps
entry remain available until guarded cleanup succeeds.

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
