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
  for the four earlier theme names; and
- an offline QA preview covering Home, Code, composer controls, menus, dialogs,
  and common interface states.

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

The selected theme persists across restarts. A custom image is decorative and
never replaces Claude with a screenshot. Wide, quiet images with low contrast
usually work best. Animated GIF backgrounds are hidden when Aura or the operating
system requests reduced motion; the same safeguard covers APNG, animated WebP,
and animated AVIF backgrounds.

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

## Offline preview

The offline preview is an illustrative QA harness, not a copy of the production
Claude interface. It uses the same registry metadata and design tokens as the
runtime implementation.

```powershell
npm run preview:build
npm run preview:serve
```

Then open `http://127.0.0.1:4173/preview/`. Theme and mode selections in the
preview use browser-local storage and do not change the installed app's saved
configuration. Repeatable screenshot URLs, readiness checks, responsive sizes,
and evidence filenames are defined in
[docs/SCREENSHOT_PLAN.md](docs/SCREENSHOT_PLAN.md).

## For contributors

The project has no npm or runtime font dependencies. Node.js uses built-in
modules to validate themes, generate the renderer payload, build the preview,
and create release archives. The WebView2 SDK files are vendored with their
license and notice.

Useful commands:

```powershell
npm run themes
node scripts/theme-cli.mjs list --locale zh-TW
node scripts/theme-cli.mjs validate --theme anime-twilight
npm run preview:build
npm test
npm run check
npm run release
```

Add themes through the central registry rather than by scattering theme checks
through application code. See [docs/THEMING.md](docs/THEMING.md) for the schema
and [docs/IMPLEMENTATION_REPORT.md](docs/IMPLEMENTATION_REPORT.md) for the system
overview. The exhaustive deliverable path list is in
[docs/FILE_MANIFEST.md](docs/FILE_MANIFEST.md).

The `theme_demo_previews` directory contains art-direction references only. Its
raw composite images are never used as runtime UI or preview backgrounds, and
the release builder excludes the entire directory. Six text-free derivatives
under `assets/theme-art/<id>/card-preview.webp` are used only by Aura Studio's
theme cards; they are never injected into Claude. Release archives are built
from an explicit file and directory allowlist, so local configuration, saved
state, agent metadata, and unrelated workspace files are not packaged.

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
