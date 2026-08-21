<a id="readme-top"></a>

# Claude Aura

<p align="center">
  <strong>English</strong> ·
  <a href="./readmes/README.zh-CN.md">简体中文</a> ·
  <a href="./readmes/README.zh-HKTW.md">繁體中文</a> ·
  <a href="./readmes/README.hi.md">हिंदी</a> ·
  <a href="./readmes/README.es.md">Español</a> ·
  <a href="./readmes/README.fr.md">Français</a> ·
  <a href="./readmes/README.id.md">Bahasa Indonesia</a> ·
  <a href="./readmes/README.ja.md">日本語</a> ·
  <a href="./readmes/README.ko.md">한국어</a> ·
  <a href="./readmes/README.pt-BR.md">Português (Brasil)</a> ·
  <a href="./readmes/README.de.md">Deutsch</a> ·
  <a href="./readmes/README.it.md">Italiano</a> ·
  <a href="./readmes/README.vi.md">Tiếng Việt</a> ·
  <a href="./readmes/README.pl.md">Polski</a> ·
  <a href="./readmes/README.tr.md">Türkçe</a>
</p>

<p align="center">
  <strong>Give the live Claude website a personal, reversible theme on Windows.</strong><br>
  Local themes · No Claude Desktop patching · One-click return to the original look
</p>

<p align="center">
  <a href="#getting-started">Get started</a> ·
  <a href="#theme-showcase">See the themes</a> ·
  <a href="#create-a-custom-theme">Create a theme</a> ·
  <a href="./docs/TROUBLESHOOTING.md">Troubleshooting</a> ·
  <a href="./SECURITY.md">Security</a>
</p>

<p align="center">
  If Claude Aura is useful to you,
  <a href="https://github.com/kaihuang1425/claude-aura"><strong>star the project on GitHub</strong></a>.
</p>

<p align="center">
  <img src="./docs/readme-showcase/japanese-film-editorial-dark-new-chat.png"
       alt="Japanese Film Editorial dark new-chat reference preview"
       width="900"><br>
  <sub>Dark · New chat · user-supplied documentation showcase</sub>
</p>

<p align="center"><sub>Reference preview · not an importable theme background or live acceptance evidence</sub></p>

> **Independent project.** Claude Aura is unofficial and is not affiliated
> with, endorsed by, sponsored by, or approved by Anthropic PBC. Aura displays
> the live website at `claude.ai`; it does not provide Claude or modify
> Anthropic's installed applications. Claude, Anthropic, and related names and
> marks belong to Anthropic PBC. The project license grants no rights to those
> materials.

<details>
<summary><strong>Public or commercial release trademark note</strong></summary>

> **Before public or commercial release:** Anthropic's current
> [Trademark Guidelines](https://www.anthropic.com/legal/trademark-guidelines)
> require prior approval for its names and marks and prohibit altered marks. A
> disclaimer is not permission. A release that keeps the **Claude Aura** name
> or theme-styled Claude wordmarks needs written permission and appropriate
> legal review.

</details>

<a id="contents"></a>
<details>
<summary><strong>Contents</strong></summary>

- [Claude Aura](#claude-aura)
  - [Why Aura](#why-aura)
  - [Quick start](#quick-start)
    - [Requirements](#requirements)
    - [Installation](#installation)
    - [Uninstall](#uninstall)
  - [Theme showcase](#theme-showcase)
    - [Japanese Film Editorial](#japanese-film-editorial)
    - [Japanese Idol](#japanese-idol)
    - [Korean Idol](#korean-idol)
  - [Use Aura](#use-aura)
  - [Create a custom theme](#create-a-custom-theme)
  - [How Aura works](#how-aura-works)
  - [Safety and privacy](#safety-and-privacy)
  - [Roadmap](#roadmap)
  - [Support and documentation](#support-and-documentation)
    - [Documentation map](#documentation-map)
  - [Charitable support](#charitable-support)
  - [License and notices](#license-and-notices)
  - [Acknowledgments](#acknowledgments)

</details>

<a id="about-claude-aura"></a>
## Why Aura

- **Use the live Claude website.** Aura keeps the real interface and native controls instead of replacing them with a reconstructed screen.
- **Keep the change local and reversible.** It applies local styling without patching Claude Desktop, and **Original look** removes Aura's presentation layer in one click.
- **Start with eight built-in themes.** Each is available as a stable, read-only starting point for a personalized workspace.
- **Create themes without overwriting the originals.** Claude Aura Studio supports local colors, typography, shapes, effects, and artwork.

Aura 0.3 currently themes the live website only. It does not yet theme native
Claude Desktop Code or the Claude Code terminal, and ordinary chat inside Aura
does not gain local-project access. Before the final release, Aura Code must
pass a release-blocking proof with a themed official
[Remote Control](https://code.claude.com/docs/en/remote-control) session on live
`claude.ai/code`; matching terminal-theme export covers restricted
environments without patching Claude Desktop.

<details>
<summary><strong>Complete capabilities and exclusions</strong></summary>

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

</details>

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<a id="getting-started"></a>
## Quick start

### Requirements

- Windows 10 or Windows 11
- Internet access and a Claude account
- [Node.js 22 or newer](https://nodejs.org/en/download)
- [Microsoft Edge WebView2 Runtime](https://developer.microsoft.com/en-us/microsoft-edge/webview2/)

WebView2 is present on most current Windows computers. If Aura cannot open its
browser window, install or repair the Evergreen WebView2 Runtime and try again.
Claude Desktop is optional and remains a separate application.

### Installation

Open the [latest release](https://github.com/kaihuang1425/claude-aura/releases)
and download the single Claude Aura Setup executable, its `.sha256`, and its
`.manifest.json`. Do not use GitHub's automatic **Source code** archives or an
installer copied from an older release folder.

1. Under **Assets**, download the `-UNSIGNED.exe`, its `.sha256`, and its
   `.manifest.json`. Do not use GitHub's automatic **Source code** archives.
2. Compare the Setup file's SHA-256 with both companion files. Stop and delete
   the downloads if any value differs.
3. Windows cannot verify this installer's publisher because the developer does
   not have a code-signing certificate. If Windows warns about or blocks it,
   do not bypass the warning.
4. If it opens normally, follow Setup. It checks Node.js and WebView2, installs
   below `%LOCALAPPDATA%\ClaudeAura`, adds **Installed apps** registration and
   shortcuts, then opens Aura.

After Setup, sign in inside Aura if `claude.ai` asks you to. Click the
floating Aura button, choose **Open Studio**, then choose **Themes**.

An asset named `Claude-Aura-Setup-v<version>.exe` without `-UNSIGNED` is a
different, signed path and must show the publisher named in that release's
notes. An asset ending in `-UNSIGNED-DEV.exe` is never public.

Installation does not patch or replace Claude Desktop.

<details>
<summary><strong>Installer behavior, application location, and uninstall</strong></summary>

Setup runs without an administrator prompt, validates prerequisites, refuses
to replace files while Aura is open, and performs Aura's guarded app-tree swap.
Application files are installed to:

```text
%LOCALAPPDATA%\ClaudeAura\app
```

It creates **Claude Aura**, **Claude Aura Studio**, and uninstall shortcuts in
the Start menu and on the Desktop. Theme settings and sign-in data are stored
separately from the application, so reinstalling Aura does not silently replace
them. Setup adds an **Installed apps** entry and native uninstaller.

Developers may clone the repository and build the explicitly named unsigned
development installer for local inspection. It is distinct from the clearly
marked public unsigned Setup. The build commands, pinned compiler, verification
gates, and release checklist are documented in the
[Windows installer guide](./docs/WINDOWS_INSTALLER.md).

### Uninstall

First right-click the floating Aura button and select **Exit Claude Aura**.
Then open **Start > Claude Aura > Uninstall Claude Aura**, or use **Settings >
Apps > Installed apps > Claude Aura > Uninstall**. The uninstaller refuses to
continue while Aura is still open.

By default, uninstall removes the Aura application and shortcuts but keeps local
theme settings and Aura's separate WebView sign-in profile for a later
reinstall. The uninstaller asks before removing those folders too. That optional
erase removes Aura's local sign-in session; it never removes Claude Desktop,
the user's Anthropic account, or server-side account data.

</details>

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<a id="theme-showcase"></a>
## Theme showcase

Aura's visual system is demonstrated below through New chat and Conversation references. The featured Japanese Film Editorial New chat preview appears at the top of this README.

**Default · Japanese Film Editorial · Korean Prestige · Cartoon Studio · Anime Twilight · Study Library · Japanese Idol · Korean Idol**

### Japanese Film Editorial

Warm paper, charcoal ink, muted indigo, and restrained vermilion.

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

<details>
<summary><strong>Reference status and reuse boundaries</strong></summary>

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

</details>

<a id="built-in-themes"></a>
<details>
<summary><strong>All built-in themes and stable IDs</strong></summary>

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

</details>

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<a id="use-aura"></a>
## Use Aura

| Action | What it does |
| --- | --- |
| Click the floating Aura button | Opens the Aura menu with Prompt Shelf and Studio |
| **Themes** | Opens the built-in gallery and saves the selected theme |
| **Create a theme** | Creates or edits an Aura-owned custom theme |
| **Personal wallpaper > Choose wallpaper…** | Selects a local image separately from the active theme |
| **Clear wallpaper** | Stops using the wallpaper without deleting its source file |
| **Sidebar wordmark > Choose an image…** | Frames one device-local PNG or JPEG for Claude's expanded-sidebar wordmark |
| **Remove custom wordmark** | Restores the selected theme's built-in wordmark, or Claude's native logo when no Aura wordmark is available |
| **Original look** | Removes Aura styling and shows the live site without the selected theme |
| **Apply theme** | Restores the saved Aura theme after Original look |
| **Open desktop app** | Opens Claude Desktop without modifying it |

The selected theme persists across Aura restarts. **Original look** turns off
Aura's presentation layer; it does not delete saved themes or custom artwork.
**Default** is Aura's first built-in theme; it is not the same as Original look.

The floating Aura launcher stays as a compact circular control. Click or
right-click it to open the Aura menu, where Prompt Shelf and Studio are both
visible; drag it to move it.

Personal wallpaper remains linked to the original image path. Moving or
deleting that file makes the wallpaper unavailable. Theme artwork imported
through the editor follows a different path: Studio copies or converts it into
Aura-owned theme folders.

The sidebar wordmark also stays separate from themes, but Aura copies its
source into local app data so it can be reframed later. Studio bakes a
transparent 344 × 124 PNG for the live sidebar; the image never enters theme
kits or exports. **Original look** always shows Claude's native brand, and an
invalid or missing saved wordmark fails open to the normal theme/native
fallback.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<a id="create-a-custom-theme"></a>
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

<a id="built-with"></a>
## How Aura works

| Part | Purpose |
| --- | --- |
| Windows PowerShell and WinForms | Installer, Aura window, Studio, shortcuts, and local controls |
| Microsoft Edge WebView2 | Displays the real `claude.ai` website |
| Node.js 22+ | Validates themes and builds the local theme styling |
| Local HTML, CSS, JavaScript, SVG, and WebP | Supplies Aura styling and built-in theme assets |

The project has no npm package or runtime font dependency.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<a id="safety-and-privacy"></a>
## Safety and privacy

- Aura loads the real HTTPS website at `claude.ai` in Microsoft Edge WebView2.
- Sign-in provider pages are not themed.
- Aura does not open a remote-debugging port or patch Claude Desktop.
- Theme files and imported artwork stay in Aura-owned local folders.
- Saved Prompt Shelf drafts are encrypted for the current Windows user. Insert
  changes only the composer text; Aura never presses Enter or logs draft text.
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

<a id="local-data"></a>
<details>
<summary><strong>Local data folders and uninstall retention</strong></summary>

Aura separates its application, settings, themes, drafts, and browser profile:

| Path | Contents |
| --- | --- |
| `%LOCALAPPDATA%\ClaudeAura\app` | Installed Aura application |
| `%LOCALAPPDATA%\ClaudeAura\data` | Settings, logs, and Aura-owned local state |
| `%LOCALAPPDATA%\ClaudeAura\data\themes` | Saved custom themes and derived artwork |
| `%LOCALAPPDATA%\ClaudeAura\data\theme-drafts` | In-progress Studio drafts |
| `%LOCALAPPDATA%\ClaudeAura\data\prompt-shelf\drafts.bin` | Prompt Shelf drafts encrypted with Windows DPAPI CurrentUser |
| `%LOCALAPPDATA%\ClaudeAura\webview` | Aura's separate WebView2 sign-in profile |

Treat the `webview` folder like any signed-in browser profile. Do not publish
or share it. The default uninstall keeps `data` and `webview`; choose the
explicit removal option only when you also want those local settings, themes,
Prompt Shelf drafts, and the separate sign-in profile erased. Deleting a draft
inside Prompt Shelf also removes it from the encrypted store.

Aura restricts an older plaintext Prompt Shelf file to the current user before
reading it. It writes and verifies the DPAPI-protected replacement before
deleting the legacy file. If migration fails, saved-draft features remain
unavailable and the protected legacy file is retained for recovery; Aura does
not put draft text in its log.

</details>

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<a id="roadmap"></a>
## Roadmap

- [x] Dedicated Windows WebView2 companion and reversible **Original look**
- [x] Eight stable built-in themes with Light and Dark support
- [ ] Complete and review the no-code Studio visual editor
- [ ] Complete and approve Aura Code for official local Claude Code Remote
      Control, with matching terminal-theme export
- [ ] Publish the 30-minute custom-theme tutorial
- [ ] Run the final release verification sweep

See the
[implementation report](./docs/IMPLEMENTATION_REPORT.md) and
[repository issues](https://github.com/kaihuang1425/claude-aura/issues) for
public status. A reference preview never substitutes for required live Aura
acceptance evidence.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<a id="support"></a>
## Support and documentation

Start with [Troubleshooting](./docs/TROUBLESHOOTING.md). For a reproducible bug
or feature request, use the
[repository's Issues page](https://github.com/kaihuang1425/claude-aura/issues).

When reporting a bug, include the Windows, Node.js, and WebView2 versions, the
active theme ID, and the steps that reproduce the problem. Review logs before
sharing them; Aura's UI log is stored at:

```text
%LOCALAPPDATA%\ClaudeAura\data\aura-ui.log
```

Report security issues through a private repository security advisory, as
described in [SECURITY.md](./SECURITY.md).

### Documentation map

- [Troubleshooting](./docs/TROUBLESHOOTING.md)
- [Security and trust boundary](./SECURITY.md)
- [Theming guide](./docs/THEMING.md)
- [Theme Kit Specification](./docs/THEME_KIT_SPEC.md)
- [Implementation report](./docs/IMPLEMENTATION_REPORT.md)
- [File Manifest](./docs/FILE_MANIFEST.md)
- [Contributing guide](./CONTRIBUTING.md)
- [Repository issues](https://github.com/kaihuang1425/claude-aura/issues)

<a id="contributing"></a>
<details>
<summary><strong>Contributing checks and project boundaries</strong></summary>

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

</details>

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<a id="charitable-support"></a>
## Charitable support

Claude Aura does not accept personal donations, tips, sponsorships, referral
payments, or other financial support. The owner is currently in the United
Kingdom under [Student route conditions](https://www.gov.uk/guidance/immigration-rules/immigration-rules-appendix-student),
which prohibit self-employment or business activity except in limited
circumstances. To avoid any potential conflict with those conditions, the owner
cannot accept project-linked donations or tips while they apply.

If Claude Aura is useful to you, the simplest non-financial way to support it
is to [star the repository](https://github.com/kaihuang1425/claude-aura).

<details>
<summary><strong>Student-route context, independent nonprofits, and donation boundaries</strong></summary>

Readers who would like to support related public-interest work may donate
directly to either independent nonprofit:

- [International Rescue Committee UK](https://help.rescue-uk.org/donate-web)
  helps people affected by conflict and disaster, including refugees rebuilding
  their lives in the United Kingdom. The wider International Rescue Committee
  also participates in Claude Corps.
- [CodePath](https://www.every.org/codepath) provides free technical education
  and works with Anthropic as the nonprofit partner for
  [Claude Corps](https://www.anthropic.com/news/claude-corps).

These links lead directly to third parties. Claude Aura and its owner do not
collect, process, control, receive, or financially benefit from any donation.
The organizations handle their own donation processing and receipts. Their
listing does not imply affiliation, sponsorship, endorsement, or an official
fundraising partnership with Claude Aura.

</details>

<a id="license-and-notices"></a>
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

<a id="acknowledgments"></a>
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
