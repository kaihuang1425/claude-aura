# Build your first Claude Aura theme in 30 minutes

You do not need to know JSON, CSS, or this repository to make a theme. Start
with Aura Studio. It keeps the built-in themes unchanged, checks your work as
you go, and saves the result only on this Windows device.

By the end of this tutorial, you will have:

- made a custom Light and Dark theme;
- checked it in the actual Aura window on live `claude.ai`;
- saved it and confirmed that it survives a restart; and
- learned how to delete it completely.

The second half shows the folder-and-command route for contributors. You can
skip it if you only want to use Studio.

> **What counts as a visual check?** Studio's canvas is a placement aid. Even
> when it shows a private in-memory capture, it is not acceptance evidence.
> Judge the final result in the separate, whole Aura window on live
> `claude.ai`.

## Before you start

For the Studio route, you need:

- Claude Aura installed;
- an internet connection and a signed-in `claude.ai` session in Aura; and
- about 30 uninterrupted minutes.

For the command route, you also need:

- a Claude Aura source checkout;
- Node.js 22 or newer;
- Git available from PowerShell; and
- PowerShell opened at the checkout's top-level folder, the one containing
  `package.json`, `scripts`, and `themes`.

The button and page names below assume Studio is using English. On a first
launch, choose **English** in **Meet Claude Aura**. If Studio is already using
another language, choose **Settings** > **Interface language** > **English**
for this walkthrough.

## Route A: make a theme in Aura Studio

This is the recommended route. It requires no code and never overwrites a
built-in theme.

### Minute 0-3: open the visual editor

1. Open **Claude Aura Studio** from the Start menu. You can also right-click
   Aura's floating button, choose **Open Studio**, and then choose
   **Create a theme**.
2. If **Meet Claude Aura** opens, choose **English**, then choose **Skip** or
   close the welcome guide.
3. In Studio's left rail, choose **Create a theme**.
4. Choose **Customize Default**.
5. Leave **Quick customize** selected for your first pass.

Studio creates an editable draft. Every valid change is also applied to the
actual Aura window, while an invalid change leaves Aura on the last valid
version.

### Minute 3-7: name it

1. Choose **Document details**.
2. Enter a short English name and a concrete one-sentence description.
3. Open **Theme languages** only if you have reviewed copy for another
   language. English is required; unselected languages use English.

Good names describe a visual direction, such as `Quiet Moss` or
`Midnight Paper`. Avoid version numbers and words that promise behavior the
theme does not provide.

### Minute 7-14: set Light and Dark

1. Choose **Interface**.
2. Select **Light** under **Theme mode**.
3. Adjust the main colors first. Keep the page background calm, the text easy
   to read, and the accent obvious without making every surface compete.
4. Choose an interface font, corner radius, and shadow.
5. Select **Dark** and repeat the same pass. Dark mode needs its own readable
   colors; it is not an automatic inversion of Light mode.
6. Watch the status near the editor controls. Continue only when it says the
   preview is up to date and the contrast and size checks pass.

If you want the two modes to start alike, switch to **Advanced** and use
**Copy Light colors to Dark** or **Copy Dark colors to Light**, then tune the
copied mode.

### Minute 14-19: add optional artwork

Skip this section for a colors-only theme.

1. Choose **Background**.
2. Choose whether the background covers the **Entire window** or the
   **Main area only**.
3. Under **Images**, choose an image type and then **Add image...**.
4. Pick a local image that you own or have permission to distribute.
5. Drag the image in the canvas or use its controls to position it.
6. Check both **New chat** and **Conversation**, both **Standard** and
   **Wide**, and both theme modes.

Keep detailed subjects outside the text-safe and composer zones. Artwork is
decorative: it must not contain fake controls, interface text, borrowed logos,
or a person whose image you do not have permission to use.

For an app mark, choose **Widgets** > **App identity** > **Replace mark** and
use a static transparent 96 x 96 PNG. Keep the silhouette clear at 24-48 px.

For reusable new-chat starters, choose **Widgets** > **Instant prompts**,
choose **Add prompt**, and enter a short label plus the text Aura should place
in the composer. An optional icon is imported locally. Use the state controls
to check hover, focus, pressed, and expanded treatments. In Conversation the
selected ticket remains visible as **New chat only**; choose **Switch to New
chat** to edit it. Activating a saved ticket inserts text and focuses the real
composer, but never sends.

### Minute 19-25: review the real result

1. Choose **Review states**.
2. Check Light and Dark, New chat and Conversation, and Standard and Wide.
3. Fix every highlighted contrast, size, or budget issue.
4. Choose **Review in Aura**.
5. In the actual Aura window, check that you can still:
   - read the sidebar and conversation;
   - use the composer and its controls;
   - open menus and dialogs; and
   - see focus clearly when using the keyboard.
6. Return to Studio and choose **Save theme**.
7. Wait until Studio returns to **Themes** and your new theme card says
   **Selected**. Do not exit while the save is still in progress.

The Studio canvas helps with placement, but only the separate Aura window is
the real interface review. If the live window is unavailable, save the draft
but leave visual approval open.

### Minute 25-28: prove restart persistence

1. Right-click Aura's floating button and choose **Exit Claude Aura**. Do not
   end its PowerShell host in Task Manager.
2. Reopen **Claude Aura** from the Start menu.
3. Open Studio, choose **Themes**, and confirm that your custom theme card says
   **Selected**.
4. Under **Appearance mode**, choose **Light**, then choose
   **Back to Claude Aura** and inspect the actual Aura window.
5. Return to Studio, choose **Dark**, then choose **Back to Claude Aura** and
   inspect the actual Aura window again.

Your theme lives under
`%LOCALAPPDATA%\ClaudeAura\data\themes\<theme-id>`. Reinstalling Aura does not
silently replace it.

### Minute 28-30: delete the practice theme

1. In Studio, choose **Themes** and open your custom theme.
2. Choose **Delete**.
3. Confirm with **Delete theme**.

If the deleted theme was active, Aura applies Default first. Deletion removes
that theme's one owned folder; built-in themes and other user themes are not
changed.

You are done when the custom card is gone, Aura uses Default, and reopening
Studio does not bring the deleted theme back.

## Share a theme as one `.aura` file

Only saved user themes can be exported. On the theme's Studio card, choose
**Export theme...**, then keep the suggested `<theme-id>.aura` name. To install
one, choose **Create a theme** > **Install theme...** and select either the
`.aura` file or a folder kit's `theme.json` file. Built-in themes must first be
duplicated and saved, so an export never depends on files inside the installed
application.

An `.aura` file is a ZIP container. Aura writes ordinary stored ZIP entries;
the importer accepts stored or deflated entries only. The root
`manifest.json` has this exact version-1 shape:

```json
{
  "format": "claude-aura-theme",
  "schemaVersion": 1,
  "themeId": "quiet-moss",
  "createdWith": "0.3.0",
  "files": [
    {
      "path": "theme.json",
      "size": 18420,
      "sha256": "64 lowercase hexadecimal characters"
    }
  ]
}
```

`files` is sorted by its forward-slash path and lists every other archive
entry exactly once. `schemaVersion` is the package-manifest version; the
theme-kit schema remains `theme.json`'s `schemaVersion`. Packages round-trip
kit schemas v1 through v6 without upgrading them.

The version-1 file allowlist is deliberately small:

- `theme.json`, optional `card-preview.webp`, `launcher-mark.png`, and
  `sidebar-identity.png`;
- legacy root artwork slots: `background`, `hero`, `corner-top-right`,
  `corner-bottom`, `card-1` through `card-3`, and `brand-mark`, using the
  image extensions already accepted by the kit validator;
- content-addressed `artwork/layer-<32 lowercase hex>.webp` files; and
- content-addressed `loading/mark-<sha256>.png` and
  `loading/artwork-<sha256>.webp` files.

Interface overrides, filters, responsive layouts, widgets, and portable
greeting/loading-screen settings live inside the validated `theme.json` and
therefore need no executable package format. Personal wallpaper, avatar,
display-name phrases, shuffle state, window layout, Studio preferences,
configuration, account data, and host filesystem paths are never included.

Before creating any install staging folder, Aura rejects an archive if its
manifest version is unknown, a SHA-256 or ZIP CRC does not match, a path is
absolute or uses `..`, a file is outside the allowlist, entries overlap or use
unsupported ZIP features, or content exceeds these bounds:

- 24 kit files;
- 400,000 bytes per kit file;
- 1,800,000 bytes across kit files;
- 64,000 bytes for `manifest.json`; and
- 2,000,000 bytes for the complete archive.

After those checks, Aura extracts into a new app-owned staging folder, runs
the same Light/Dark kit and payload validation used for a folder install, and
then uses the existing staged atomic installer. A failure removes staging and
leaves the current theme and configuration unchanged. Package content is read
as data only: it is never executed or evaluated, and non-empty `customCss`
remains invalid.

## Route B: build and install a folder kit

This route is for contributors or people who want a portable local theme kit.
The example deliberately uses the ID `demo-proof`. Run every command from the
top-level Claude Aura source folder.

### 1. Check the starting folder

```powershell
node --version
git --version
Test-Path -LiteralPath package.json
Test-Path -LiteralPath scripts\theme-cli.mjs
Test-Path -LiteralPath themes\demo-proof
Test-Path -LiteralPath themes\demo-proof.json
git status --short
```

Node must report version 22 or newer, and Git must report a version. The first
two `Test-Path` commands must print `True`; the two `demo-proof` checks must
print `False`. `git status --short` must print nothing. If it lists existing
work, use a separate clean clone for this proof. Do not reset or delete someone
else's changes.

### 2. Scaffold `demo-proof`

```powershell
node scripts/theme-cli.mjs scaffold demo-proof
```

This creates:

- `themes/demo-proof/theme.json` - the standalone kit Studio installs;
- `themes/demo-proof/CHECKLIST.md` - the optional artwork slot guide; and
- `themes/demo-proof.json` - a source-tree token template.

The command also prints a registry snippet. You do not need to paste that
snippet for this local proof.

### 3. Give it one real production artwork file

For this proof, reuse the repository's canonical Default launcher mark. This
is a byte-for-byte copy of a production asset, not a generated image, fixture,
render, or screenshot.

```powershell
Copy-Item -LiteralPath assets\theme-art\default\launcher-mark.png `
  -Destination themes\demo-proof\launcher-mark.png
```

Open both of these JSON files in your text editor:

- `themes/demo-proof/theme.json`
- `themes/demo-proof.json`

In each file, find the `launcher` object's `asset` value and change only that
value:

```json
"asset": "launcher-mark.png"
```

Do not copy a whole built-in theme folder. A standalone kit may refer only to
files inside its own folder.

Optional copy check:

```powershell
(Get-FileHash assets\theme-art\default\launcher-mark.png).Hash
(Get-FileHash themes\demo-proof\launcher-mark.png).Hash
```

The two SHA-256 values must match.

### 4. Validate both modes

```powershell
node scripts/theme-cli.mjs validate themes/demo-proof
```

Success is JSON containing all three of these values:

```json
{"pass":true,"theme":"demo-proof","source":"folder"}
```

The full result also reports Light and Dark payload budgets. Validation writes
no UI screenshot, preview board, contact sheet, or image golden.

### 5. Install and apply it

1. Open **Claude Aura Studio**.
2. If **Meet Claude Aura** opens, choose **English**, then choose **Skip**.
3. Choose **Create a theme**.
4. Choose **Install theme...**.
5. Select the exact `themes\demo-proof\theme.json` file.
6. Choose **Themes** and wait for the **Demo Proof** card to say **Selected**.
7. Choose **Back to Claude Aura** and check the real Aura window on live
   `claude.ai`.

Studio validates the folder again, copies it to the user-theme directory, and
applies it. It never changes the source kit or the installed application.

Confirm that the installed artwork is the same file:

```powershell
(Get-FileHash themes\demo-proof\launcher-mark.png).Hash
(Get-FileHash "$env:LOCALAPPDATA\ClaudeAura\data\themes\demo-proof\launcher-mark.png").Hash
```

The hashes must match. This disposable theme deliberately keeps Default's
colors and reuses Default's launcher mark, so it will look like Default in
Aura. The **Selected** card and matching installed-file hash prove which theme
is active; the whole Aura review checks that the real interface still works.

### 6. Restart and recheck

1. Choose **Exit Claude Aura** from Aura's own menu.
2. Reopen Aura from the Start menu.
3. Open Studio and choose **Themes**.
4. Confirm that the **Demo Proof** card still says **Selected**.
5. Under **Appearance mode**, choose **Light**, then choose
   **Back to Claude Aura** and inspect the live window.
6. Return to Studio and repeat with **Dark**.

### 7. Delete the installed theme and clean the proof files

First delete **Demo Proof** in Studio: open its theme card, choose **Delete**,
and confirm **Delete theme**. Confirm that Aura returns to Default.

Then remove only the two scaffold outputs you just created:

```powershell
Remove-Item -LiteralPath themes\demo-proof -Recurse
Remove-Item -LiteralPath themes\demo-proof.json
Test-Path -LiteralPath themes\demo-proof
Test-Path -LiteralPath themes\demo-proof.json
Test-Path -LiteralPath "$env:LOCALAPPDATA\ClaudeAura\data\themes\demo-proof"
git status --short
```

All three `Test-Path` commands must print `False`, and `git status --short`
must print nothing, matching the clean start. The kit directory is ignored by
Git, so `git status` alone cannot prove it was removed. Do not use a glob or
delete the whole `themes` directory.

## Where `qa` fits

`validate` is the correct command for a standalone folder kit. `qa` is the
non-image production-asset audit for a theme that is already registered in
the repository.

To prove the existing production audit without registering the disposable
kit, run it on a built-in theme:

```powershell
node scripts/theme-cli.mjs qa default
```

It validates both payload modes and writes only `status.json`, normally under
`dist/qa/default/`. It does not render interface imagery. Running
`qa demo-proof` before adding `demo-proof` to the production registry will
correctly report `Unknown theme`; that is not an install or folder-validation
failure.

## Quick troubleshooting

| What you see | What to do |
| --- | --- |
| `Theme id already exists: demo-proof` | Check whether the two exact `demo-proof` scaffold paths are yours. Delete only those paths, or choose a new lowercase kebab-case ID. |
| Studio says `theme.json` is missing | Select the exact `themes\demo-proof\theme.json` file. |
| The launcher asset is rejected | Confirm the file is named `launcher-mark.png`, is a static transparent 96 x 96 PNG, and both JSON asset values match it. |
| Aura keeps the last valid preview | Read the highlighted Studio issue, fix that one field, and wait for the preview-up-to-date status. |
| The custom theme disappears after restart | Open Studio and confirm it was saved or installed, not left as an unsaved draft. |
| `qa demo-proof` says `Unknown theme` | Use `validate themes/demo-proof` for a standalone kit. `qa` accepts registered production IDs. |

## Safety rules that always apply

- Use local files only. Themes cannot load remote fonts, scripts, or artwork.
- Use artwork you have the right to distribute.
- Keep `customCss` empty in a standalone kit.
- Do not put fake Claude controls or copied interface text into artwork.
- Original look and Default remain safe fallbacks.
- Removing a user theme removes one owned folder and must not affect the app,
  another theme, Claude Desktop, or your Claude account.

For schema fields and advanced artwork framing after you finish this tutorial,
see `docs/THEME_KIT_SPEC.md`.
