# Claude Aura

**A fast, reversible theme companion for Claude.**

Claude Aura opens the real `claude.ai` interface in a dedicated Windows app
window and applies a local theme through Microsoft WebView2. Theme, background,
and restore controls stay in the window, with no command prompt to manage and no
changes to Anthropic's installed application.

> Claude Aura is unofficial and is not affiliated with, endorsed by, or
> sponsored by Anthropic. It does not patch Claude Desktop, `app.asar`, Windows
> packages, code signatures, accounts, chats, API keys, model providers, or
> Claude settings.

## What's new in 0.3

Claude Aura now includes one default theme and seven complete optional themes.
The update adds:

- a centralized, keyboard-accessible theme gallery with previews, swatches,
  descriptions, and an unambiguous selected state;
- English, Simplified Chinese, and Traditional Chinese theme metadata;
- semantic light and dark tokens for navigation, panels, cards, the composer,
  focus, status, and other shared interface roles;
- distinct typography, shape, shadow, control, and widget treatments for every
  theme;
- isolated SVG and WebP renderer artwork for the seven optional themes;
- persistent stable theme IDs, safe fallback to Default, and migration aliases
  for the four earlier theme names.

The Windows implementation remains a WebView2 companion window. Anthropic's
signed desktop shell remains unchanged, and **Desktop app** still opens the
official application when its desktop-only features are needed.

## Install on Windows

Requirements:

- Windows 10 or 11;
- Node.js 22 or newer; and
- Microsoft Edge WebView2 Runtime. It is present on most current Windows
  computers and uses Microsoft's automatically updated Evergreen channel.

Install and launch:

1. Double-click **Install Claude Aura.cmd**.
2. Wait for the **Claude Aura** window to appear; the installer closes itself.
3. Sign in once if Claude asks.
4. Select **Customize themes**, then choose a theme.

Installation runs the repository checks, copies the verified application to
`%LOCALAPPDATA%\ClaudeAura\app`, and creates a **Claude Aura** shortcut on the
Desktop and in the Start menu. Theme and image settings are stored separately
under `%LOCALAPPDATA%\ClaudeAura\data` so reinstalling the application does not
silently replace them.

Older **Switch Theme** and **Restore** shortcuts are removed during install.

The installer is non-elevated and copies only the allowlisted project
directories and top-level files. The `-ExecutionPolicy Bypass` argument in the
double-click launcher is limited to that one PowerShell process; it does not
change Windows policy. For manual review, inspect `windows/install.ps1`, run
`npm test`, and then run the installer script directly. Release downloads
include a `.sha256` file that can be compared with
`Get-FileHash -Algorithm SHA256` before extraction.

To uninstall, open **Claude Aura > Uninstall Claude Aura** from the Start menu
or double-click **Uninstall Claude Aura.cmd** in the release. The default removes
the installed application and shortcuts but keeps local theme settings and the
separate WebView sign-in profile for a later reinstall. Answer **y** only when
you also want those local settings and sign-in data erased. The uninstaller
never touches Anthropic's Claude installation or account data.
Administrators can preview the owned paths without removing anything:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\windows\uninstall.ps1 -RemoveData -WhatIf
```

The repository still includes the earlier macOS launcher and reversible
injection scripts for development and legacy use. The supported non-technical
consumer experience described here is the Windows WebView2 companion.

## Use Aura

| Control | What it does |
| --- | --- |
| **Customize themes** | Opens the gallery and saves immediately; a ready Claude view updates at once, while startup or sign-in applies it when the view becomes ready |
| **Background...** | Adds a local PNG, JPEG, WebP, GIF, or AVIF image up to 16 MB |
| **Clear image** | Keeps the theme and removes only the custom image |
| **Original look** | Removes Aura styling without changing Claude or restarting the window |
| **Apply theme** | Restores the saved Aura theme after using Original look |
| **Desktop app** | Opens the official Claude Desktop app without modifying it |

The floating Aura launcher follows the active theme. At rest it is a quiet
48 px mark; hover expands it to show **Open Studio** and a separate six-dot
drag grip, so opening and moving it are distinct actions. Aura keeps it at
least 16 px from the content edge. Each built-in theme ships its own local
mark and material treatment; custom themes may provide one, and an absent or
invalid design falls back to Default without removing Studio access.
That same validated mark is the running app identity: switching themes updates
the Aura window, Studio window, taskbar, notification area, floating launcher,
and Studio rail together. Original look returns all of those surfaces to the
Default Aura mark.

The selected theme persists across restarts. A custom image is decorative and
never replaces Claude with a screenshot. Wide, quiet images with low contrast
usually work best. Animated GIF backgrounds are hidden when Aura or the operating
system requests reduced motion; the same safeguard covers APNG, animated WebP,
and animated AVIF backgrounds.

### Create a custom theme

Open **Claude Aura Studio** and choose **Duplicate to customize** on any
built-in theme. Built-ins remain unchanged; Studio creates an editable copy and
applies its last valid draft to the real Aura window. You can edit Light and
Dark tokens independently, copy one token set to the other, choose approved
system fonts and material settings, position the new-chat prompt, and arrange
up to eight decorative artwork layers.

A duplicate keeps the built-in theme's complete visual recipe, including its
Dark-specific composition and layout. Studio does not rebuild Dark from Light;
only an explicit **Copy Light to Dark** action replaces the Dark token set.
Untouched interface-font, display-font, radius/shape, and shadow controls keep
following Aura's bundled source recipe; editing one customizes only that control
group. Recipe references are restricted to the eight built-in IDs and are
always resolved from Aura's own validated theme files.

Each layer can target an appearance, page context, and normal or
wide/fullscreen viewport. Its normal and wide framing remain independent.
Choose **Content canvas** to keep artwork out of the sidebar or **Full window**
to continue it behind the translucent sidebar. Imported PNG, JPEG, WebP, or
AVIF files are converted locally to budgeted WebP assets; Studio never receives
their source paths and makes no network request.

The local artwork prompt builder includes an **App + launcher mark** option. It
produces a ready-to-copy brief for the exact 96 × 96 transparent asset, compact
safe area, small-size legibility, and every Aura surface that reuses the mark.

Contrast and byte-budget results update with the draft. An invalid change stays
editable, but Aura continues showing the last valid draft. Undo, redo, reset,
cancel, save, restart persistence, and deletion all operate on Aura-owned local
data. Deleting the active user theme first returns Aura to Default. See
[docs/THEME_KIT_SPEC.md](docs/THEME_KIT_SPEC.md) for the complete editor and
theme-kit contract.

## Built-in themes

The registry order and stable IDs are:

| Order | Theme | ID | Character |
| ---: | --- | --- | --- |
| 1 | Default | `default` | Familiar indigo foundation with calm, balanced controls |
| 2 | Japanese Film Editorial | `japanese-film-editorial` | Warm paper, charcoal ink, muted indigo, and vermilion |
| 3 | Korean Prestige | `korean-prestige` | Midnight navy, silver structure, and architectural glass |
| 4 | Cartoon Studio | `cartoon-studio` | Cream, coral, teal, sunny yellow, and friendly inked details |
| 5 | Anime Twilight | `anime-twilight` | Twilight blue glass, pale cyan, violet, and warm window light |
| 6 | Study Library | `study-library` | Ivory paper, forest green, oxblood, graphite, and quiet brass |
| 7 | Japanese Idol | `japanese-idol` | Warm cream, blush, rose, pearlescent lilac, and fine ribbons |
| 8 | Korean Idol | `korean-idol` | Cool white, periwinkle, holographic silver, and structured music glass |

Earlier saved IDs migrate automatically: `midnight` to `default`, `ember` to
`japanese-film-editorial`, `forest` to `study-library`, and `sakura` to
`japanese-idol`. An unknown ID falls back safely to `default`.

## For contributors

The project has no npm or runtime font dependencies. Node.js uses built-in
modules to validate themes, generate the renderer payload and Aura Studio
metadata, and create release archives. The WebView2 SDK files are vendored with
their license and notice.

Useful commands:

```powershell
npm run themes
node scripts/theme-cli.mjs list --locale zh-TW
node scripts/theme-cli.mjs validate --theme anime-twilight
npm run studio:build
npm test
npm run check
npm run release
```

Add themes through the central registry rather than by scattering theme checks
through application code. See [docs/THEMING.md](docs/THEMING.md) for the schema
and [docs/IMPLEMENTATION_REPORT.md](docs/IMPLEMENTATION_REPORT.md) for the system
overview. The exhaustive deliverable path list is in
[docs/FILE_MANIFEST.md](docs/FILE_MANIFEST.md).

Aura Studio preview media lives under `assets/studio-previews/`. Each theme card
loads an uncropped master and applies `x`, `y`, and `zoom` framing at display
time, so dragging the crop window never overwrites the source and it can always
be reframed. These full concept images are picker media only: the renderer never
loads them as Claude artwork or backgrounds, and they are not visual evidence.
Alternate art direction is clearly separated under `references/` and excluded
from releases and installed copies. Release archives use an explicit allowlist,
so local configuration, saved state, internal workspace metadata, and unrelated
files are not packaged.

## Troubleshooting and security

See [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) for sign-in, loading,
image, and WebView2 help. See [SECURITY.md](SECURITY.md) for the trust boundary.

Microsoft recommends Evergreen WebView2 for most applications because the
runtime is serviced and updated automatically. See Microsoft's
[WebView2 distribution guidance](https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/distribution)
and [Evergreen overview](https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/evergreen-vs-fixed-version).

## License

MIT. See [LICENSE](LICENSE), [NOTICE.md](NOTICE.md), and
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
