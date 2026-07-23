<a id="readme-top"></a>

# Claude Aura

<p align="center">
  <strong>English</strong> ·
  <a href="./README.zh-CN.md">简体中文</a> ·
  <a href="./README.zh-TW.md">繁體中文</a>
</p>

<p align="center">
  <strong>A reversible Windows theme companion for the live Claude website.</strong><br>
  Local themes · No Claude Desktop patching · One-click return to the original look
</p>

<p align="center">
  <a href="#getting-started">Get started</a> ·
  <a href="#theme-showcase">See the themes</a> ·
  <a href="#create-a-custom-theme">Create a theme</a> ·
  <a href="./docs/TROUBLESHOOTING.md">Troubleshooting</a> ·
  <a href="./SECURITY.md">Security</a>
</p>

> **Independent project.** Claude Aura is unofficial and is not affiliated
> with, endorsed by, sponsored by, or approved by Anthropic PBC. Aura displays
> the live website at `claude.ai`; it does not provide Claude or modify
> Anthropic's installed applications. Claude, Anthropic, and related names and
> marks belong to Anthropic PBC. The project license grants no rights to those
> materials.
>
> **Before public or commercial release:** Anthropic's current
> [Trademark Guidelines](https://www.anthropic.com/legal/trademark-guidelines)
> require prior approval for its names and marks and prohibit altered marks. A
> disclaimer is not permission. A release that keeps the **Claude Aura** name
> or theme-styled Claude wordmarks needs written permission and appropriate
> legal review.

## Contents

- [About Claude Aura](#about-claude-aura)
- [Theme showcase](#theme-showcase)
- [Built with](#built-with)
- [Getting started](#getting-started)
- [Use Aura](#use-aura)
- [Built-in themes](#built-in-themes)
- [Create a custom theme](#create-a-custom-theme)
- [Local data](#local-data)
- [Safety and privacy](#safety-and-privacy)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [License and notices](#license-and-notices)
- [Support](#support)
- [Acknowledgments](#acknowledgments)

## About Claude Aura

Claude Aura opens the real `claude.ai` website in a dedicated Microsoft Edge
WebView2 window and applies a local visual theme. It is designed for people who
want a more personal workspace without patching Claude Desktop or replacing the
live interface with a screenshot.

| Aura does | Aura does not |
| --- | --- |
| Loads the live `claude.ai` interface in WebView2 | Replace Claude with a reconstructed interface |
| Applies reversible local styling | Patch Claude Desktop, `app.asar`, Windows packages, or code signatures |
| Includes eight built-in themes | Change Claude accounts, chats, API keys, models, or provider settings |
| Provides Studio for local custom themes | Claim to be an Anthropic product or official theme system |
| Offers **Original look** inside the app | Delete saved themes when styling is turned off |

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Theme showcase

> **Reference status:** These user-supplied images communicate the intended
> visual direction. They may contain illustrative interface content and are
> not live acceptance evidence or proof of current `claude.ai` behavior. They
> are not theme backgrounds, must not be imported into Aura, and are excluded
> from release installers.
>
> The previews contain third-party product UI, names or marks, and human-like
> portrait artwork. Their inclusion does not grant reuse rights. Confirm the
> applicable interface, trademark, artwork, and likeness rights before further
> publication or redistribution.

### Japanese Film Editorial

Warm paper, charcoal ink, muted indigo, and restrained vermilion.

<p align="center">
  <img src="./docs/readme-showcase/japanese-film-editorial-dark-new-chat.png"
       alt="Japanese Film Editorial dark new-chat reference preview"
       width="900"><br>
  <sub>Dark · New chat · user-supplied documentation showcase</sub>
</p>

<details>
<summary>See the Conversation view</summary>

<p align="center">
  <img src="./docs/readme-showcase/japanese-film-editorial-dark-conversation.png"
       alt="Japanese Film Editorial dark conversation reference preview"
       width="900"><br>
  <sub>Dark · Conversation · user-supplied documentation showcase</sub>
</p>

</details>

### Japanese Idol

Warm cream, blush, rose, pearlescent lilac, and fine ribbon details.

<p align="center">
  <img src="./docs/readme-showcase/japanese-idol-light-new-chat.png"
       alt="Japanese Idol light new-chat reference preview"
       width="900"><br>
  <sub>Light · New chat · user-supplied documentation showcase</sub>
</p>

<details>
<summary>See the Conversation view</summary>

<p align="center">
  <img src="./docs/readme-showcase/japanese-idol-light-conversation.png"
       alt="Japanese Idol light conversation reference preview"
       width="900"><br>
  <sub>Light · Conversation · user-supplied documentation showcase</sub>
</p>

</details>

### Korean Idol

Cool white, periwinkle, holographic silver, and structured music glass.

<p align="center">
  <img src="./docs/readme-showcase/korean-idol-light-new-chat.png"
       alt="Korean Idol light new-chat reference preview"
       width="900"><br>
  <sub>Light · New chat · user-supplied documentation showcase</sub>
</p>

<details>
<summary>See the Conversation view</summary>

<p align="center">
  <img src="./docs/readme-showcase/korean-idol-light-conversation.png"
       alt="Korean Idol light conversation reference preview"
       width="900"><br>
  <sub>Light · Conversation · user-supplied documentation showcase</sub>
</p>

</details>

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Built with

| Part | Purpose |
| --- | --- |
| Windows PowerShell and WinForms | Installer, Aura window, Studio, shortcuts, and local controls |
| Microsoft Edge WebView2 | Displays the real `claude.ai` website |
| Node.js 22+ | Validates themes and builds the local theme styling |
| Local HTML, CSS, JavaScript, SVG, and WebP | Supplies Aura styling and built-in theme assets |

The project has no npm package or runtime font dependency.

## Getting started

### Requirements

- Windows 10 or Windows 11
- Internet access and a Claude account
- [Node.js 22 or newer](https://nodejs.org/en/download)
- [Microsoft Edge WebView2 Runtime](https://developer.microsoft.com/en-us/microsoft-edge/webview2/)

WebView2 is present on most current Windows computers. If Aura cannot open its
browser window, install or repair the Evergreen WebView2 Runtime and try again.
Claude Desktop is optional and remains a separate application.

### Installation

1. Download the
   [latest release ZIP](https://github.com/erichuang1425/claude-aura/releases).
2. In File Explorer, right-click the ZIP and select **Extract All**.
3. Open the extracted folder and double-click **Install Claude Aura.cmd**.
4. Wait for the installer to close and the **Claude Aura** window to open.
5. Sign in inside Aura if `claude.ai` asks you to.
6. Click the floating Aura button to open Studio, then choose **Themes**.

The non-elevated installer runs its built-in validation checks, then copies the
application files to:

```text
%LOCALAPPDATA%\ClaudeAura\app
```

It creates **Claude Aura** and **Claude Aura Studio** shortcuts on the Desktop
and in the Start menu. Theme settings and sign-in data are stored separately
from the application, so reinstalling Aura does not silently replace them.

Installation does not patch or replace Claude Desktop.

Developers may clone the repository instead of downloading a ZIP and run the
same installer from the checkout. A checkout runs the complete repository test
suite before installation.

### Uninstall

First right-click the floating Aura button and select **Exit Claude Aura**.
Then open **Start > Claude Aura > Uninstall Claude Aura**, or double-click
**Uninstall Claude Aura.cmd** in an extracted release. The uninstaller refuses
to continue while Aura is still open.

By default, uninstall removes the Aura application and shortcuts but keeps local
theme settings and Aura's separate WebView sign-in profile for a later
reinstall. The uninstaller asks before removing those folders too. That optional
erase removes Aura's local sign-in session; it never removes Claude Desktop,
the user's Anthropic account, or server-side account data.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Use Aura

| Action | What it does |
| --- | --- |
| Click the floating Aura button | Opens Claude Aura Studio |
| **Themes** | Opens the built-in gallery and saves the selected theme |
| **Create a theme** | Creates or edits an Aura-owned custom theme |
| **Personal wallpaper > Choose wallpaper…** | Selects a local image separately from the active theme |
| **Clear wallpaper** | Stops using the wallpaper without deleting its source file |
| **Original look** | Removes Aura styling and shows the live site without the selected theme |
| **Apply theme** | Restores the saved Aura theme after Original look |
| **Open desktop app** | Opens Claude Desktop without modifying it |

The selected theme persists across Aura restarts. **Original look** turns off
Aura's presentation layer; it does not delete saved themes or custom artwork.
**Default** is Aura's first built-in theme; it is not the same as Original look.

The floating Aura launcher stays as a compact circular control. Click it to
open Studio, drag it to move it, or right-click it for the Aura menu.

Personal wallpaper remains linked to the original image path. Moving or
deleting that file makes the wallpaper unavailable. Theme artwork imported
through the editor follows a different path: Studio copies or converts it into
Aura-owned theme folders.

## Built-in themes

Aura ships with eight built-in themes in a stable order:

| # | Theme | Stable ID |
| ---: | --- | --- |
| 1 | Default | `default` |
| 2 | Japanese Film Editorial | `japanese-film-editorial` |
| 3 | Korean Prestige | `korean-prestige` |
| 4 | Cartoon Studio | `cartoon-studio` |
| 5 | Anime Twilight | `anime-twilight` |
| 6 | Study Library | `study-library` |
| 7 | Japanese Idol | `japanese-idol` |
| 8 | Korean Idol | `korean-idol` |

Built-ins are read-only. Studio makes an editable copy when you want to
customize one.

## Create a custom theme

1. Open **Claude Aura Studio** from the Desktop or Start menu.
2. Open **Create a theme** and select **Customize Default**, or open **Themes**,
   choose a built-in, and select **Duplicate to customize**.
3. Adjust Light and Dark colors, typography, shapes, effects, and local artwork.
4. Check New chat and Conversation layouts in the Studio preview.
5. Resolve any contrast or file-size warnings.
6. Select **Save theme**.

Built-in files are never overwritten. If a draft becomes invalid, it stays
editable while Aura continues displaying the last valid version.

Imported PNG, JPEG, WebP, or AVIF artwork is converted locally to budgeted WebP
assets. Studio does not store the source file path inside the theme. For the
complete editor and theme contract, see the
[Theme Kit Specification](./docs/THEME_KIT_SPEC.md).

When available, Studio can use a capture of the actual Aura window as its
editing backdrop. That capture may contain conversation content, stays in
memory only for the current editing session, and is never written to disk.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Local data

Aura separates its application, settings, themes, drafts, and browser profile:

| Path | Contents |
| --- | --- |
| `%LOCALAPPDATA%\ClaudeAura\app` | Installed Aura application |
| `%LOCALAPPDATA%\ClaudeAura\data` | Settings, logs, and Aura-owned local state |
| `%LOCALAPPDATA%\ClaudeAura\data\themes` | Saved custom themes and derived artwork |
| `%LOCALAPPDATA%\ClaudeAura\data\theme-drafts` | In-progress Studio drafts |
| `%LOCALAPPDATA%\ClaudeAura\webview` | Aura's separate WebView2 sign-in profile |

Treat the `webview` folder like any signed-in browser profile. Do not publish
or share it. The default uninstall keeps `data` and `webview`; choose the
explicit removal option only when you also want those local settings, themes,
and the separate sign-in profile erased.

## Safety and privacy

- Aura loads the real HTTPS website at `claude.ai` in Microsoft Edge WebView2.
- Sign-in provider pages are not themed.
- Aura does not open a remote-debugging port or patch Claude Desktop.
- Theme files and imported artwork stay in Aura-owned local folders.
- The live webpage still connects to Anthropic as normal.
- The WebView profile contains sign-in session data and must be protected.
- Studio live-page captures stay in memory for the editing session and are not
  saved to disk.
- Do not select a sensitive background image; the live page can technically
  access DOM data inside its own process.
- Use of the live service remains subject to Anthropic's current
  [Consumer Terms](https://www.anthropic.com/terms) and
  [Usage Policy](https://www.anthropic.com/legal/aup).

Read [SECURITY.md](./SECURITY.md) for the trust boundary and
[Troubleshooting](./docs/TROUBLESHOOTING.md) for sign-in, loading, theme, image,
and WebView2 help.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Roadmap

- [x] Dedicated Windows WebView2 companion and reversible **Original look**
- [x] Eight stable built-in themes with Light and Dark support
- [ ] Complete and review the no-code Studio visual editor
- [ ] Publish the 30-minute custom-theme tutorial
- [ ] Run the final release verification sweep

See the
[implementation report](./docs/IMPLEMENTATION_REPORT.md) and
[repository issues](https://github.com/erichuang1425/claude-aura/issues) for
public status. A reference preview never substitutes for required live Aura
acceptance evidence.

## Contributing

Run the required checks before submitting a change:

```powershell
npm run check
npm run verify:cycle
```

For a single built-in theme audit:

```powershell
node scripts/theme-cli.mjs qa <id>
```

Please keep these project boundaries intact:

- Do not add npm or runtime font dependencies.
- Keep the eight stable theme IDs and their order unchanged.
- Do not ship reconstructed Claude interface HTML as product content.
- Do not submit reference images as UI acceptance evidence.
- Include source, license, and distribution information for contributed media.

See [CONTRIBUTING.md](./CONTRIBUTING.md), the
[Theming guide](./docs/THEMING.md), the
[Theme Kit Specification](./docs/THEME_KIT_SPEC.md), and the
[File Manifest](./docs/FILE_MANIFEST.md) before changing the theme system or
release tree.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## License and notices

Project-authored software is distributed under the [MIT License](./LICENSE).
Also read [NOTICE.md](./NOTICE.md) and
[THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md).

The MIT License does not grant rights to Anthropic's names, marks, interface,
website, or applications. Showcase captions do not grant reuse rights to
displayed UI, artwork, names, marks, or human likenesses. File-specific source
and rights notices still apply.

Review the current
[Anthropic Trademark Guidelines](https://www.anthropic.com/legal/trademark-guidelines)
and [Consumer Terms](https://www.anthropic.com/terms). Obtain any required
permission from the relevant rightsholder before publishing, modifying, or
redistributing protected names, marks, interface captures, artwork, or
recognizable likenesses. This repository and README do not grant that
permission.

## Support

Start with [Troubleshooting](./docs/TROUBLESHOOTING.md). For a reproducible bug
or feature request, use the
[repository's Issues page](https://github.com/erichuang1425/claude-aura/issues).

When reporting a bug, include the Windows, Node.js, and WebView2 versions, the
active theme ID, and the steps that reproduce the problem. Review logs before
sharing them; Aura's UI log is stored at:

```text
%LOCALAPPDATA%\ClaudeAura\data\aura-ui.log
```

Report security issues through a private repository security advisory, as
described in [SECURITY.md](./SECURITY.md).

## Acknowledgments

- [Codex Dream Skin](https://github.com/Fei-Away/Codex-Dream-Skin) informed the
  original loopback validation workflow and the approachable showcase pattern.
- [claude-desktop-bin](https://github.com/patrickjaja/claude-desktop-bin)
  informed the early semantic theme mapping.
- [Best README Template](https://github.com/othneildrew/Best-README-Template)
  informed this README's reader-first structure.
- Microsoft Edge WebView2 supplies the embedded browser runtime.

Detailed licenses and provenance are recorded in
[THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md). Acknowledgment does not
imply affiliation, sponsorship, or endorsement.

<p align="right">(<a href="#readme-top">back to top</a>)</p>
