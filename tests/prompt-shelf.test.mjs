import { test, runIfMain } from "./support/harness.mjs";
import {
  PROJECT_ROOT,
  STUDIO_LOCALES,
  UI_LOCALES,
  assert,
  fs,
  listThemes,
  os,
  path,
  readHostCopy,
  readStudioCopy,
  run,
  studioStyleFromTheme,
} from "./support/context.mjs";

const shelfPath = path.join(PROJECT_ROOT, "windows", "aura-prompt-shelf.ps1");
const uiPath = path.join(PROJECT_ROOT, "windows", "aura-ui.ps1");
const rendererPath = path.join(PROJECT_ROOT, "assets", "renderer-inject.js");
const studioIndexPath = path.join(PROJECT_ROOT, "studio", "index.html");
const studioAppPath = path.join(PROJECT_ROOT, "studio", "app.js");
const studioStylesPath = path.join(PROJECT_ROOT, "studio", "styles.css");

const powershellFunction = (source, name) => {
  const start = source.indexOf(`function ${name}`);
  assert(start >= 0, `Prompt Shelf is missing ${name}`);
  const end = source.indexOf("\nfunction ", start + 1);
  return source.slice(start, end < 0 ? source.length : end);
};

const insertionTemplate = (shelf) => {
  const builder = powershellFunction(shelf, "New-AuraPromptShelfInsertionScript");
  const match = builder.match(
    /\$source\s*=\s*@'\r?\n([\s\S]*?)\r?\n'@/,
  );
  assert(match, "Prompt Shelf insertion must use one bounded literal template");
  return match[1];
};

test("Prompt Shelf is a localized native host surface with reversible lifecycle hooks", async () => {
  const [shelf, ui, renderer, hostCopy] = await Promise.all([
    fs.readFile(shelfPath, "utf8"),
    fs.readFile(uiPath, "utf8"),
    fs.readFile(rendererPath, "utf8"),
    readHostCopy(),
  ]);

  assert.match(shelf,
    /\$script:PromptShelfStoreRoot\s*=\s*Join-Path \$DataRoot 'prompt-shelf'[\s\S]{0,160}?\$script:PromptShelfStatePath\s*=\s*Join-Path \$script:PromptShelfStoreRoot 'drafts\.bin'/,
    "Prompt drafts must use a dedicated protected local store");
  for (const name of [
    "Initialize-AuraPromptShelfStorage",
    "Initialize-AuraPromptShelfPersistence",
    "Set-AuraPromptShelfSecureAcl",
    "Read-AuraPromptShelfEncryptedItems",
    "Invoke-AuraPromptShelfLegacyMigration",
    "Invoke-AuraPromptShelfAddOrSave",
    "Invoke-AuraPromptShelfEdit",
    "Invoke-AuraPromptShelfMove",
    "Invoke-AuraPromptShelfDelete",
    "Remove-AuraPromptShelfItemById",
    "Invoke-AuraPromptShelfInsert",
    "New-AuraPromptShelfInsertionScript",
    "Complete-AuraPromptShelfInsertTask",
    "Draw-AuraPromptShelfButton",
    "Advance-AuraPromptShelfPageEpoch",
    "Confirm-AuraPromptShelfComposerChecked",
    "Get-AuraPromptShelfFollowBounds",
    "Set-AuraPromptShelfBounds",
    "Update-AuraPromptShelfVisibleBounds",
    "New-AuraPromptShelfForm",
    "Dispose-AuraPromptShelf",
    "Set-AuraPromptShelfAvailability",
  ]) powershellFunction(shelf, name);

  const form = powershellFunction(shelf, "New-AuraPromptShelfForm");
  assert.match(form, /\[Windows\.Forms\.Form\]::new\(\)/,
    "Prompt Shelf must be a native host-owned window");
  assert.match(form, /\$script:PromptShelfDraftBox\.Multiline\s*=\s*\$true/);
  assert.match(form, /\$script:PromptShelfDraftBox\.AcceptsReturn\s*=\s*\$true/);
  assert.match(form, /\$script:PromptShelfList\s*=\s*\[Windows\.Forms\.ListBox\]::new\(\)/);
  assert.match(form,
    /\$script:PromptShelfList\.DrawMode\s*=\s*\[Windows\.Forms\.DrawMode\]::OwnerDrawFixed/);
  assert.match(form, /\$script:PromptShelfRoot\.AutoScroll\s*=\s*\$true/);
  assert.match(form,
    /add_DpiChanged\(\{[\s\S]{0,180}?Update-AuraPromptShelfResponsiveLayout[\s\S]{0,180}?Update-AuraPromptShelfVisibleBounds/,
    "A visible Shelf must reflow and return inside its working area after DPI changes");
  const visibleBounds = powershellFunction(shelf, "Update-AuraPromptShelfVisibleBounds");
  assert.match(visibleBounds,
    /PromptShelfForm\.IsDisposed[\s\S]{0,100}?PromptShelfForm\.Visible/,
    "Host resize handling must require an existing visible Shelf");
  assert.doesNotMatch(visibleBounds,
    /\b(?:New-AuraPromptShelfForm|Show-AuraPromptShelf|Show|Activate|BringToFront|Focus)\b/,
    "A host resize must never create, reveal, activate, or focus Prompt Shelf");
  assert.match(ui,
    /\$script:Form\.add_SizeChanged\(\{[\s\S]{0,700}?Update-AuraPromptShelfVisibleBounds -HostForm \$script:Form/,
    "A visible Shelf must follow Aura maximize and restore");
  assert.match(ui,
    /\$script:StudioForm\.add_SizeChanged\(\{[\s\S]{0,320}?Update-AuraPromptShelfVisibleBounds -HostForm \$script:StudioForm/,
    "A visible Shelf must follow Studio maximize and restore");
  assert.match(ui,
    /\$script:Launcher\.add_LocationChanged\(\{\s*Update-AuraPromptShelfVisibleBounds -HostForm \$script:Form/,
    "Prompt Shelf must repair its anchor after the launcher reaches its new position");
  assert.match(powershellFunction(shelf, "Draw-AuraPromptShelfListItem"),
    /\[Windows\.Forms\.ControlPaint\]::DrawFocusRectangle\(/,
    "The themed native list must retain a visible keyboard focus rectangle");
  assert.match(powershellFunction(shelf, "New-AuraPromptShelfButton"),
    /\.add_Paint\(\{[\s\S]{0,180}?Draw-AuraPromptShelfButton/,
    "Every Shelf button must repair the native disabled-text paint path");
  const buttonPainter = powershellFunction(shelf, "Draw-AuraPromptShelfButton");
  assert.match(buttonPainter, /if \(\$Button\.Enabled/);
  assert.match(buttonPainter, /\[Windows\.Forms\.SystemInformation\]::HighContrast/);
  assert.match(buttonPainter, /\$script:PromptShelfProfile\.HighContrast/,
    "Custom disabled painting must bypass both live and projected High Contrast");
  assert.match(buttonPainter, /\$Button\.ForeColor/);
  assert.match(buttonPainter, /\$Button\.BackColor/);
  assert.match(buttonPainter, /\[Windows\.Forms\.TextRenderer\]::DrawText\(/,
    "Disabled button copy must use the active Aura palette");
  assert.match(powershellFunction(shelf, "Update-AuraPromptShelfButtonThemes"),
    /PromptShelfInsertNowButton -Profile \$Profile\r?\n/,
    "Insert without saving must remain a secondary action");
  assert.doesNotMatch(powershellFunction(shelf, "Update-AuraPromptShelfButtonThemes"),
    /PromptShelfInsertNowButton[^\r\n]*-Primary/,
    "The two draft actions must not compete as primary buttons");
  assert.doesNotMatch(powershellFunction(shelf, "Update-AuraPromptShelfList"),
    /'\{0\} - \{1\}'/,
    "The saved count must not be assembled as locale-sensitive sentence copy");
  const show = powershellFunction(shelf, "Show-AuraPromptShelf");
  assert.match(show,
    /if \(-not \$script:PromptShelfForm\.IsHandleCreated\)[\s\S]{0,700}?\[void\]\$script:PromptShelfForm\.Handle/,
    "The Shelf must resolve per-monitor DPI before it clamps its window size");
  assert.match(form, /\[Windows\.Forms\.Keys\]::Escape[\s\S]{0,120}?\$sender\.Hide\(\)/,
    "Escape must hide the Shelf without deleting drafts");
  assert.doesNotMatch(shelf, /\.AcceptButton\s*=/,
    "Enter must never be assigned to a default form action");
  for (const index of Array.from({ length: 11 }, (_, value) => value)) {
    assert.match(form, new RegExp(`TabIndex = ${index}\\b|TabIndex ${index}\\b`),
      `Prompt Shelf is missing keyboard tab stop ${index}`);
  }
  for (const action of [
    "Invoke-AuraPromptShelfAddOrSave",
    "Reset-AuraPromptShelfEditor",
    "Invoke-AuraPromptShelfEdit",
    "Invoke-AuraPromptShelfMove -Delta -1",
    "Invoke-AuraPromptShelfMove -Delta 1",
    "Invoke-AuraPromptShelfDelete",
    "Invoke-AuraPromptShelfInsertSelected",
    "Confirm-AuraPromptShelfComposerChecked",
  ]) assert(form.includes(action), `Prompt Shelf does not wire ${action}`);

  assert.match(ui, /\. \(Join-Path \$PSScriptRoot 'aura-prompt-shelf\.ps1'\)/);
  assert.match(ui,
    /\$script:LauncherPromptShelfItem\s*=\s*\[System\.Windows\.Forms\.ToolStripMenuItem\]::new\(/);
  assert.match(ui,
    /\$script:LauncherMenu\.Items\.AddRange\(@\([\s\S]{0,180}?\$script:LauncherPromptShelfItem,/);
  assert.match(ui,
    /\$script:LauncherPromptShelfItem\.add_Click\(\{\s*Show-AuraPromptShelf\s*\}\)/);
  assert.match(ui,
    /\$script:LauncherPromptShelfItem\.ShortcutKeyDisplayString\s*=\s*'Ctrl\+Shift\+P'/,
    "The launcher menu must expose the existing Prompt Shelf shortcut");
  assert.match(powershellFunction(ui, "Show-AuraUiLauncherMenu"),
    /\$script:LauncherMenu\.Show\(\[System\.Windows\.Forms\.Cursor\]::Position\)/,
    "Ordinary click and right-click must share the existing launcher menu");
  assert.match(ui,
    /\$eventArgs\.Button -eq \[System\.Windows\.Forms\.MouseButtons\]::Right[\s\S]{0,220}?Show-AuraUiLauncherMenu/,
    "Right-click must continue to open the launcher menu");
  assert.match(ui,
    /\$wasClickArmed[\s\S]{0,260}?Show-AuraUiLauncherMenu/,
    "An undragged left click must make Prompt Shelf discoverable through the launcher menu");
  assert.match(ui, /0x50\s*\{\s*\$eventArgs\.Handled\s*=\s*\$true;\s*Show-AuraPromptShelf/,
    "Ctrl+Shift+P must provide a keyboard route into the Shelf");
  for (const eventName of ["NavigationStarting", "SourceChanged", "HistoryChanged", "ProcessFailed"]) {
    assert.match(ui, new RegExp(`add_${eventName}\\(\\{[\\s\\S]{0,120}?Advance-AuraPromptShelfPageEpoch`),
      `${eventName} must invalidate a pending insertion target`);
  }
  assert.match(powershellFunction(ui, "Invoke-AuraUiSetEnabled"),
    /Set-AuraPromptShelfAvailability -Enabled \$Enabled/);
  assert.match(powershellFunction(ui, "Update-AuraUiLocalizedChrome"),
    /Update-AuraPromptShelfCopy/);
  assert.match(powershellFunction(ui, "Set-AuraUiPreferredColorScheme"),
    /Update-AuraPromptShelfTheme/);
  assert.match(ui, /Complete-AuraPromptShelfInsertTask[\s\S]{0,80}?Update-AuraUiMirror/,
    "The existing UI tick must service only the bounded WebView task result");

  const availability = powershellFunction(shelf, "Set-AuraPromptShelfAvailability");
  assert.match(availability, /if \(-not \$Enabled\) \{ Dispose-AuraPromptShelf \}/,
    "Original look must dispose the native Shelf");
  assert.match(renderer, /"discoverComposer": discoverComposer,/,
    "Renderer state must expose its existing composer discovery");
  assert.doesNotMatch(renderer, /AURA_PROMPT_SHELF|aura-prompt-shelf-(?:insert|result)/,
    "WO-30 must not add a persistent page listener or a second renderer");
  assert.match(renderer, /delete window\[STATE_KEY\]/,
    "Original look must remove the composer-discovery capability with renderer state");
  assert.doesNotMatch(shelf, /WebMessageReceived|add_WebMessageReceived/,
    "Prompt Shelf must not retain a claude.ai or Studio page message listener");
  const studioSender = powershellFunction(shelf, "Send-AuraPromptShelfStudioMessage");
  assert.match(studioSender,
    /\$script:StudioWebView\.CoreWebView2\.PostWebMessageAsJson\(\$json\)/,
    "Prompt Shelf may post only through its explicit Aura Studio response helper");
  assert.equal((shelf.match(/PostWebMessageAsJson/g) ?? []).length, 1,
    "The explicit Aura Studio response helper must be the Shelf's only outbound message path");
  assert.match(shelf, /ProtectedData\]::Protect\([\s\S]{0,180}?DataProtectionScope\]::CurrentUser/,
    "Saved prompt bodies must use Windows current-user data protection");
  const secureAcl = powershellFunction(shelf, "Set-AuraPromptShelfSecureAcl");
  assert.match(secureAcl, /LocalSystemSid/,
    "Shelf state must retain LocalSystem access");
  assert.match(secureAcl, /SetAccessRuleProtection\(\$true, \$false\)/,
    "Shelf state must remove inherited access");
  assert.match(shelf.trimEnd(), /Initialize-AuraPromptShelfPersistence$/,
    "Aura startup must secure or migrate saved drafts before Shelf opens");

  const shelfKeys = new Set([
    "openPromptShelf",
    ...[...shelf.matchAll(/Get-AuraPromptShelfCopy -Name '([^']+)'/g)]
      .map((match) => match[1]),
  ]);
  assert(shelfKeys.size >= 20, "Prompt Shelf copy surface is incomplete");
  assert.deepEqual(Object.keys(hostCopy).sort(), [...UI_LOCALES].sort());
  for (const [locale, copy] of Object.entries(hostCopy)) {
    for (const key of shelfKeys) {
      assert.equal(typeof copy[key], "string", `${locale} is missing ${key}`);
      assert(copy[key].trim(), `${locale} has empty Prompt Shelf copy ${key}`);
    }
    if (locale === "en" || locale === "zh-CN" || locale === "zh-HKTW") {
      assert(copy.launcherTipHint.includes(copy.promptShelf),
        `${locale} hover guidance must use its authored Prompt Shelf name`);
      assert(copy.launcherHintBody.includes(copy.promptShelf),
        `${locale} first-use guidance must use its authored Prompt Shelf name`);
    }
  }
});

test("Prompt Shelf follows host height without widening or revealing a hidden window", async () => {
  const shelf = await fs.readFile(shelfPath, "utf8");
  const follow = powershellFunction(shelf, "Get-AuraPromptShelfFollowBounds");
  const repair = powershellFunction(shelf, "Set-AuraPromptShelfBounds");
  const visibleRepair = powershellFunction(shelf, "Update-AuraPromptShelfVisibleBounds");
  const show = powershellFunction(shelf, "Show-AuraPromptShelf");

  assert.match(follow,
    /\$hostHeightAtShelfDpi[\s\S]*?\$HostHeight \* \$ShelfDpi \/ \[double\]\$HostDpi/,
    "Mixed-DPI host height must be normalized before sizing the Shelf");
  assert.match(follow,
    /\$width\s*=\s*\[Math\]::Min\([\s\S]*?\$PreferredSize\.Width,\s*\$CurrentSize\.Width/,
    "Host growth must preserve Prompt Shelf's readable user width");
  assert.match(repair,
    /PromptShelfForm\.MinimumSize\s*=\s*\$layout\.MinimumSize[\s\S]*?PromptShelfForm\.Bounds\s*=\s*\$layout\.Bounds/,
    "A formerly constrained Shelf must restore its minimum before it grows");
  assert.doesNotMatch(visibleRepair, /\b(?:New-AuraPromptShelfForm|Show|Activate|Focus)\b/,
    "The visible-only resize path must have no creation or focus side effect");
  assert.match(show,
    /Set-AuraPromptShelfBounds -HostForm \$script:Form[\s\S]*?PromptShelfForm\.Show\(\$script:Form\)[\s\S]*?Activate\(\)[\s\S]*?PromptShelfDraftBox\.Focus\(\)/,
    "Only the explicit Show path may reveal and focus the repaired Shelf");

  if (process.platform === "win32") {
    const powershell = [
      "$ErrorActionPreference='Stop'",
      "Add-Type -AssemblyName System.Windows.Forms",
      "Add-Type -AssemblyName System.Drawing",
      follow,
      visibleRepair,
      "function Set-AuraPromptShelfBounds { param([AllowNull()][System.Windows.Forms.Form]$HostForm) $script:FollowCallCount++ }",
      "$hostForm=[Windows.Forms.Form]::new(); $hostForm.ShowInTaskbar=$false; $hostForm.Opacity=0; $hostForm.Location=[Drawing.Point]::new(-20000,-20000); $hostForm.Show()",
      "$script:FollowCallCount=0; $script:PromptShelfForm=[Windows.Forms.Form]::new(); $script:PromptShelfForm.ShowInTaskbar=$false; $script:PromptShelfForm.Opacity=0; $script:PromptShelfForm.Location=[Drawing.Point]::new(-20000,-20000); $script:PromptShelfForm.Show($hostForm); $script:PromptShelfForm.Hide(); $script:Form=$hostForm",
      "if(-not $script:PromptShelfForm.IsHandleCreated -or -not $hostForm.Visible){throw 'Hidden-Shelf fixture did not model an existing user-hidden window'}",
      "Update-AuraPromptShelfVisibleBounds -HostForm $hostForm",
      "if($script:FollowCallCount -ne 0 -or $script:PromptShelfForm.Visible){throw 'User-hidden Prompt Shelf was touched by visible-only repair'}",
      "$script:PromptShelfForm.Dispose(); $hostForm.Dispose(); $script:PromptShelfForm=$null; $script:Form=$null",
      "$preferred=[Drawing.Size]::new(516,629)",
      "$minimum=[Drawing.Size]::new(440,580)",
      "$large=[Drawing.Rectangle]::new(0,0,1920,1040)",
      "$expanded=Get-AuraPromptShelfFollowBounds -CurrentSize $preferred -PreferredSize $preferred -PreferredMinimumSize $minimum -WorkingArea $large -AnchorX 1880 -AnchorY 1000 -HostHeight 1040 -HostDpi 96 -ShelfDpi 96",
      "if($expanded.Bounds -ne [Drawing.Rectangle]::new(1364,12,516,1016)){throw \"Expanded bounds were $($expanded.Bounds)\"}",
      "$restored=Get-AuraPromptShelfFollowBounds -CurrentSize $expanded.Bounds.Size -PreferredSize $preferred -PreferredMinimumSize $minimum -WorkingArea $large -AnchorX 1180 -AnchorY 700 -HostHeight 700 -HostDpi 96 -ShelfDpi 96",
      "if($restored.Bounds.Width -ne 516 -or $restored.Bounds.Height -ne 676){throw \"Restored bounds were $($restored.Bounds)\"}",
      "$mixed=Get-AuraPromptShelfFollowBounds -CurrentSize $preferred -PreferredSize $preferred -PreferredMinimumSize $minimum -WorkingArea $large -AnchorX 1880 -AnchorY 1000 -HostHeight 700 -HostDpi 144 -ShelfDpi 192",
      "if($mixed.Bounds.Height -ne 885){throw \"Mixed-DPI height was $($mixed.Bounds.Height)\"}",
      "$small=Get-AuraPromptShelfFollowBounds -CurrentSize $preferred -PreferredSize $preferred -PreferredMinimumSize $minimum -WorkingArea ([Drawing.Rectangle]::new(-800,0,800,560)) -AnchorX -20 -AnchorY 520 -HostHeight 560 -HostDpi 96 -ShelfDpi 96",
      "if($small.MinimumSize.Height -ne 536 -or $small.Bounds.Left -lt -788 -or $small.Bounds.Right -gt -12 -or $small.Bounds.Top -lt 12 -or $small.Bounds.Bottom -gt 548){throw \"Small-area repair escaped: $($small.Bounds)\"}",
      "$grown=Get-AuraPromptShelfFollowBounds -CurrentSize $small.Bounds.Size -PreferredSize $preferred -PreferredMinimumSize $minimum -WorkingArea $large -AnchorX 1880 -AnchorY 1000 -HostHeight 1040 -HostDpi 96 -ShelfDpi 96",
      "if($grown.MinimumSize -ne $minimum -or $grown.Bounds.Height -ne 1016){throw 'Shelf did not regrow after leaving the small monitor'}",
    ].join("\n");
    run("powershell.exe", [
      "-NoProfile",
      "-STA",
      "-EncodedCommand",
      Buffer.from(powershell, "utf16le").toString("base64"),
    ]);
  }
});

test("Aura Studio manages the same encrypted Prompt Shelf through a strict local bridge", async () => {
  const [shelf, ui, renderer, html, app, styles, studioCopy] = await Promise.all([
    fs.readFile(shelfPath, "utf8"),
    fs.readFile(uiPath, "utf8"),
    fs.readFile(rendererPath, "utf8"),
    fs.readFile(studioIndexPath, "utf8"),
    fs.readFile(studioAppPath, "utf8"),
    fs.readFile(studioStylesPath, "utf8"),
    readStudioCopy(),
  ]);

  const shelfSectionMatch = html.match(
    /<section id="prompt-shelf"[\s\S]*?(?=<section id="background")/,
  );
  assert(shelfSectionMatch, "Aura Studio is missing its Prompt Shelf page");
  const shelfSection = shelfSectionMatch[0];
  assert.match(html,
    /<a class="rail-item" href="#prompt-shelf" data-studio-view="prompt-shelf" data-i18n="navPromptShelf">/,
    "Prompt Shelf must be a first-class Studio rail destination");
  assert.match(shelfSection,
    /data-studio-page="prompt-shelf"[^>]*aria-labelledby="prompt-shelf-title" aria-busy="false" hidden inert/,
    "Prompt Shelf must start as a separate inactive Studio page");
  assert.match(app,
    /if \(nextView === "prompt-shelf"\) ensurePromptShelfState\(\);/,
    "Opening the Prompt Shelf page must request its host-owned state immediately");
  assert.doesNotMatch(app,
    /content\.addEventListener\("scroll"[\s\S]{0,500}?ensurePromptShelfState/,
    "Prompt Shelf must not depend on scrolling near a hidden section to load");
  assert.match(shelfSection,
    /<input id="prompt-shelf-search" type="search"[\s\S]{0,180}?data-i18n-placeholder="promptShelfSearchPlaceholder"/,
    "Saved drafts need a localized native search control");
  assert.match(shelfSection,
    /<ol id="prompt-shelf-list"[^>]*aria-labelledby="prompt-shelf-saved-title"><\/ol>/,
    "Saved drafts must render as an ordered list");
  assert.match(shelfSection,
    /<template id="prompt-shelf-item-template">[\s\S]{0,220}?<button type="button" class="prompt-shelf-item-button">/,
    "Each saved draft must be a keyboard-operable button");
  assert.match(shelfSection,
    /<textarea id="prompt-shelf-text"[^>]*maxlength="8000"[^>]*aria-describedby="prompt-shelf-character-count prompt-shelf-status"/,
    "The Studio editor must share the host's 8,000-character limit and status semantics");
  assert.match(shelfSection,
    /id="prompt-shelf-insert"[\s\S]{0,160}?aria-describedby="prompt-shelf-insert-help"[^>]*disabled/,
    "Insert in Aura must start disabled and retain explicit no-send guidance");
  assert.match(html,
    /<dialog id="prompt-shelf-delete-dialog"[\s\S]{0,220}?aria-describedby="prompt-shelf-delete-body"/,
    "Destructive deletion must use a labeled confirmation dialog");

  const promptShelfStart = app.indexOf("const promptShelfUuidPattern");
  const promptShelfEnd = app.indexOf("const handleStudioColorSchemeChange", promptShelfStart);
  assert(promptShelfStart >= 0 && promptShelfEnd > promptShelfStart,
    "Studio is missing its bounded Prompt Shelf controller");
  const promptShelfController = app.slice(promptShelfStart, promptShelfEnd);
  for (const type of [
    "prompt-shelf-read",
    "prompt-shelf-create",
    "prompt-shelf-update",
    "prompt-shelf-move",
    "prompt-shelf-delete",
    "prompt-shelf-insert",
    "prompt-shelf-confirm-checked",
  ]) {
    assert(app.includes(`"${type}"`), `Studio does not allow ${type}`);
    assert(ui.includes(`'${type}'`), `The host does not allow ${type}`);
  }
  assert.match(app,
    /const ordinaryStudioViews = Object\.freeze\(\[[\s\S]{0,120}?"prompt-shelf"[\s\S]{0,120}?\]\);[\s\S]{0,260}?ordinaryStudioViewSet\.has\(requestedView\)/,
    "Locale reloads and deep links must preserve the ordinary Prompt Shelf view");
  assert.match(promptShelfController, /window\.crypto\?\.randomUUID\?\.\(\)/);
  assert.match(promptShelfController, /window\.crypto\.getRandomValues\(bytes\)/,
    "Request correlation must retain a cryptographically random fallback");
  assert.match(promptShelfController,
    /send\(\{ type: "prompt-shelf-read", version: promptShelfBridgeVersion, requestId \}\)/);
  assert.match(promptShelfController,
    /version: promptShelfBridgeVersion,[\s\S]{0,180}?revision: promptShelf\.revision,[\s\S]{0,80}?commandEpoch: promptShelf\.commandEpoch/,
    "Every Studio mutation must bind the current protocol, revision, and command epoch");
  assert.match(promptShelfController,
    /"prompt-shelf-insert",\s*"insert",\s*\{ id: selected\.id \}/,
    "Insert must send only the immutable item id, never a second copy of its body");
  assert.match(promptShelfController,
    /promptShelfHasExactKeys\(data, \[\s*"type", "version", "requestId", "session", "revision", "commandEpoch",\s*"persistenceAvailable", "insertionAvailable", "insertState", "items",\s*\]\)/,
    "Studio must reject expanded or partial body-bearing state snapshots");
  assert.match(promptShelfController,
    /promptShelfHasExactKeys\(data, \[\s*"type", "version", "requestId", "session", "action",\s*"ok", "code", "revision", "commandEpoch", "itemId",\s*\]\)/,
    "Studio must reject expanded or partial mutation receipts");
  assert.match(promptShelfController,
    /promptShelfHasExactKeys\(data, \[\s*"type", "version", "session", "revision", "commandEpoch",\s*\]\)/,
    "Change notifications must remain body-free");
  assert.match(promptShelfController,
    /promptShelf\.readRequests\.has\(data\.requestId\)/);
  assert.match(promptShelfController,
    /data\.requestId !== promptShelf\.pending\.requestId/);
  assert.match(promptShelfController,
    /data\.session !== promptShelf\.session/);
  assert.match(promptShelfController,
    /data\.action !== promptShelf\.pending\.action/);
  assert.doesNotMatch(promptShelfController,
    /\b(?:localStorage|sessionStorage|indexedDB|IDBDatabase)\b/,
    "Prompt bodies must not gain a second browser-owned persistence path");
  assert.doesNotMatch(promptShelfController, /\.innerHTML\b/,
    "Prompt text must render through textContent, never HTML parsing");
  assert.match(promptShelfController,
    /\.prompt-shelf-item-title"\)\.textContent = display\.title/);
  assert.match(promptShelfController, /preview\.textContent = display\.preview/);

  const stateSender = powershellFunction(shelf, "Send-AuraPromptShelfStudioState");
  const changedSender = powershellFunction(shelf, "Send-AuraPromptShelfStudioChanged");
  const resultSender = powershellFunction(shelf, "Send-AuraPromptShelfStudioResult");
  const receiptStore = powershellFunction(shelf, "Add-AuraPromptShelfStudioReceipt");
  const requestValidator = powershellFunction(shelf, "Assert-AuraPromptShelfStudioRequest");
  const studioRequest = powershellFunction(shelf, "Invoke-AuraPromptShelfStudioRequest");
  const newStudioSession = powershellFunction(shelf, "New-AuraPromptShelfStudioSession");
  const saveCandidate = powershellFunction(shelf, "Save-AuraPromptShelfCandidate");
  const normalStudioState = powershellFunction(ui, "Send-AuraUiStudioState");
  const studioDocumentUri = powershellFunction(ui, "Test-AuraUiStudioDocumentUri");
  const studioParser = powershellFunction(ui, "Get-AuraUiStudioMessage");

  assert.match(stateSender,
    /type = 'prompt-shelf-state'[\s\S]{0,500}?items = @\([\s\S]{0,180}?text = \[string\]\$item\.text/,
    "Only an explicitly requested prompt-shelf-state snapshot may carry bodies");
  for (const [name, source] of [
    ["prompt-shelf-state", stateSender],
    ["prompt-shelf-result", resultSender],
    ["prompt-shelf-changed", changedSender],
  ]) {
    assert.match(source, /version = 1/,
      `${name} must carry the frozen protocol version`);
    assert.match(source, /commandEpoch = \[long\]\$script:PromptShelfStudioCommandEpoch/,
      `${name} must report the current replay epoch`);
  }
  for (const [name, source] of [
    ["prompt-shelf-result", resultSender],
    ["prompt-shelf-changed", changedSender],
    ["cached receipt", receiptStore],
    ["ordinary Studio state", normalStudioState],
  ]) {
    assert.doesNotMatch(source, /\b(?:text|body|items)\s*=/i,
      `${name} must stay prompt-body-free`);
  }
  assert.doesNotMatch(shelf,
    /Write-AuraPromptShelfEvent[^\r\n]*(?:\$text|\.text\b)/i,
    "Fixed-code logs must never interpolate a prompt body");
  assert.match(powershellFunction(shelf, "Write-AuraPromptShelfEvent"),
    /"Prompt Shelf event: \$Code"/);
  assert.equal((shelf.match(/PostWebMessageAsJson/g) ?? []).length, 1,
    "All Shelf-to-Studio messages must use the reviewed response helper");
  assert.doesNotMatch(shelf, /WebMessageReceived|add_WebMessageReceived/,
    "The Shelf module must not listen to claude.ai or bypass the host Studio parser");
  assert.doesNotMatch(renderer, /prompt-shelf|AURA_PROMPT_SHELF/i,
    "Prompt Shelf must not add a persistent listener to claude.ai");
  assert.doesNotMatch(shelf, /SetVirtualHostNameToFolderMapping/);
  assert.doesNotMatch(ui,
    /SetVirtualHostNameToFolderMapping\([\s\S]{0,180}?\$script:PromptShelf(?:StoreRoot|StatePath)/,
    "The encrypted Shelf store must never be exposed as a virtual WebView host");

  assert.match(studioParser,
    /\$sourceUri\.Scheme -cne 'https' -or \$sourceUri\.Host -cne 'aura\.studio'/);
  assert.match(studioParser,
    /\$sourceUri\.AbsolutePath -cne '\/index\.html'/,
    "Prompt Shelf commands must come from the exact Studio document path");
  assert.match(studioParser, /Test-AuraUiStudioDocumentUri -Uri \$sourceUri -AllowFragment/);
  assert.match(studioDocumentUri,
    /\^\\\?locale=\(\[\^&\]\+\)\(\?:&view=\(\[\^&\]\+\)\)\?\$/,
    "Studio message sources must use only the locale and optional view query fields");
  assert.match(studioDocumentUri, /\$locale -cnotin \$StudioLocaleIds/);
  assert.match(studioDocumentUri,
    /'themes', 'prompt-shelf', 'background', 'create', 'settings'/);
  for (const shape of [
    "'prompt-shelf-read' { 'type'; 'version'; 'requestId'; break }",
    "'type'; 'version'; 'requestId'; 'session'; 'revision'; 'commandEpoch'; 'text'",
    "'type'; 'version'; 'requestId'; 'session'; 'revision'; 'commandEpoch'; 'id'; 'text'",
    "'type'; 'version'; 'requestId'; 'session'; 'revision'; 'commandEpoch'; 'id'",
    "'type'; 'version'; 'requestId'; 'session'; 'revision'; 'commandEpoch'",
  ]) assert(studioParser.includes(shape), `Studio parser is missing exact shape: ${shape}`);
  assert.match(requestValidator,
    /\$Message\.version -isnot \[int\][\s\S]{0,100}?\[long\]\$Message\.version -ne 1/);
  assert.match(requestValidator,
    /Test-AuraPromptShelfStudioUuid -Value \(\[string\]\$Message\.requestId\)/);
  assert.match(requestValidator,
    /Test-AuraPromptShelfStudioUuid -Value \(\[string\]\$Message\.session\)/);
  assert.match(requestValidator,
    /\$Message\.revision -isnot \[int\][\s\S]{0,100}?\[long\]\$Message\.revision -lt 0/);
  assert.match(requestValidator,
    /\$Message\.commandEpoch -isnot \[int\][\s\S]{0,120}?\[long\]\$Message\.commandEpoch -lt 0/);
  assert.match(newStudioSession,
    /\[Guid\]::NewGuid\(\)\.ToString\('D'\)\.ToLowerInvariant\(\)/);
  assert.match(newStudioSession,
    /\$script:PromptShelfStudioReceipts = @\{\}[\s\S]{0,100}?\$script:PromptShelfStudioReceiptOrder = \[Collections\.Generic\.Queue\[string\]\]::new\(\)/,
    "A new host navigation session must invalidate all prior replay receipts");
  assert.match(newStudioSession,
    /PromptShelfInsertOperation\.StudioSession[\s\S]{0,180}?PromptShelfInsertOperation\.State -cin @\('dispatching', 'delayed'\)[\s\S]{0,120}?Set-AuraPromptShelfOperationUncertain -EventCode 'studio-session-changed'/,
    "Rotating Studio authority must make an in-flight Studio insertion uncertain");
  assert.match(receiptStore,
    /Fingerprint = \$Fingerprint/);
  assert.doesNotMatch(receiptStore, /\b(?:Text|Body|Items)\s*=/,
    "Replay receipts must store only a payload fingerprint and body-free result");
  assert.match(ui,
    /\$studioCore\.add_NavigationStarting\(\{[\s\S]{0,1000}?\[void\]\(New-AuraPromptShelfStudioSession\)/,
    "Every accepted Studio document navigation must receive a fresh Shelf session");
  assert.match(shelf, /\$script:PromptShelfStudioReceiptLimit\s*=\s*64/);
  assert.match(studioRequest,
    /\$script:PromptShelfStudioReceipts\.ContainsKey\(\$requestId\)[\s\S]{0,260}?\[string\]\$cached\.Type -ceq \$type[\s\S]{0,100}?\[string\]\$cached\.Fingerprint -ceq \$requestFingerprint/,
    "Cached replay requires the exact command type and payload fingerprint");
  assert.match(studioRequest,
    /-RequestId \$requestId -Action \$action -Ok \$false -Code 'request-conflict'/);
  assert.match(studioRequest,
    /\[string\]\$Message\.session -cne \$script:PromptShelfStudioSession[\s\S]{0,180}?-Code 'stale'/);
  assert.match(studioRequest,
    /\[long\]\$Message\.revision -ne \[long\]\$script:PromptShelfStudioRevision -or[\s\S]{0,120}?\[long\]\$Message\.commandEpoch -ne \[long\]\$script:PromptShelfStudioCommandEpoch[\s\S]{0,180}?-Code 'stale'/);
  assert.match(studioRequest,
    /Advance-AuraPromptShelfStudioCommandEpoch[\s\S]{0,180}?prompt-shelf-confirm-checked/,
    "Every accepted command, including acknowledgement, must consume its command epoch");
  assert.match(saveCandidate,
    /\$script:PromptShelfStudioRevision \+= 1[\s\S]{0,100}?Update-AuraPromptShelfList[\s\S]{0,100}?Send-AuraPromptShelfStudioChanged/,
    "Successful native or Studio mutations must advance one shared revision");
  assert.match(studioRequest,
    /\$itemId = \[Guid\]::NewGuid\(\)\.ToString\('N'\)/,
    "The host, not Studio, must mint persisted draft ids");

  assert.match(styles,
    /\.prompt-shelf-workspace\s*\{[\s\S]{0,180}?grid-template-columns:/);
  assert.match(styles,
    /@media \(max-width: 760px\)[\s\S]{0,520}?\.prompt-shelf-workspace \{ grid-template-columns: minmax\(0, 1fr\); \}/,
    "The two-pane manager must collapse for narrow Studio windows");
  assert.match(styles,
    /@media \(prefers-contrast: more\)[\s\S]*?\.prompt-shelf-index,[\s\S]*?#prompt-shelf-text/);
  assert.match(styles,
    /@media \(forced-colors: active\)[\s\S]*?\.prompt-shelf-item\.is-selected/);

  assert.deepEqual([...studioCopy.locales].sort(), [...STUDIO_LOCALES].sort());
  const promptShelfLocaleKeys = Object.keys(studioCopy.shell.en)
    .filter((key) => key === "navPromptShelf" || key.startsWith("promptShelf"));
  assert(promptShelfLocaleKeys.length >= 55,
    "Studio Prompt Shelf localization surface is unexpectedly incomplete");
  for (const locale of STUDIO_LOCALES) {
    for (const key of promptShelfLocaleKeys) {
      assert.equal(typeof studioCopy.shell[locale]?.[key], "string",
        `${locale} is missing Studio Prompt Shelf copy ${key}`);
      assert(studioCopy.shell[locale][key].trim(),
        `${locale} has empty Studio Prompt Shelf copy ${key}`);
    }
  }
});

test("Prompt Shelf keeps all three authored host locales usable at default and minimum size", async () => {
  if (process.platform !== "win32") return;
  const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "aura-prompt-shelf-layout-"));
  try {
    const quote = (value) => `'${value.replaceAll("'", "''")}'`;
    const localePaths = Object.fromEntries(["en", "zh-CN", "zh-HKTW"].map((locale) => [
      locale,
      path.join(PROJECT_ROOT, "windows", "locales", `${locale}.json`),
    ]));
    const iconStub = [
      "using System;",
      "public sealed class AuraIconWindow : IDisposable {",
      "public void Attach(IntPtr handle) {}",
      "public void Detach() {}",
      "public void SetDarkMode(bool dark) {}",
      "public void SetCaptionColor(byte red, byte green, byte blue) {}",
      "public void Dispose() {}",
      "}",
    ].join(" ");
    const profileSpecs = (await listThemes()).flatMap((theme) => {
      const style = studioStyleFromTheme(theme);
      return ["light", "dark"].map((appearance) => {
        const palette = style[appearance];
        return {
          themeId: theme.name,
          appearance,
          background: palette.canvas,
          surface: palette.raised,
          text: palette.text,
          muted: palette.textMuted,
          accent: palette.accent,
          accentText: palette.accentText,
          border: palette.border,
        };
      });
    });
    const regression = [
      "$ErrorActionPreference='Stop'",
      "Add-Type -AssemblyName System.Windows.Forms",
      "Add-Type -AssemblyName System.Drawing",
      `Add-Type -TypeDefinition ${quote(iconStub)}`,
      `$DataRoot=${quote(temporaryRoot)}`,
      "$script:StudioIcon=$null",
      `$localePaths=@{en=${quote(localePaths.en)};'zh-CN'=${quote(localePaths["zh-CN"])};'zh-HKTW'=${quote(localePaths["zh-HKTW"])}}`,
      `$profileSpecs=${quote(JSON.stringify(profileSpecs))}|ConvertFrom-Json`,
      "$script:UiCopy=[IO.File]::ReadAllText($localePaths.en,[Text.Encoding]::UTF8)|ConvertFrom-Json",
      "function Write-AuraUiLog { param([string]$Message) }",
      "function ConvertTo-TestProfile([object]$Spec){[PSCustomObject]@{ThemeId=[string]$Spec.themeId;Appearance=[string]$Spec.appearance;Cue='orbit';HighContrast=$false;Background=[Drawing.ColorTranslator]::FromHtml([string]$Spec.background);Surface=[Drawing.ColorTranslator]::FromHtml([string]$Spec.surface);Text=[Drawing.ColorTranslator]::FromHtml([string]$Spec.text);Muted=[Drawing.ColorTranslator]::FromHtml([string]$Spec.muted);Accent=[Drawing.ColorTranslator]::FromHtml([string]$Spec.accent);AccentSecondary=[Drawing.ColorTranslator]::FromHtml([string]$Spec.accent);AccentText=[Drawing.ColorTranslator]::FromHtml([string]$Spec.accentText);Border=[Drawing.ColorTranslator]::FromHtml([string]$Spec.border)}}",
      "$script:PromptShelfTestProfile=ConvertTo-TestProfile $profileSpecs[0]",
      "function Get-AuraUiLoadingProfile { $script:PromptShelfTestProfile }",
      `. ${quote(shelfPath)}`,
      "$script:PromptShelfItems=@([PSCustomObject][ordered]@{id=('a'*32);text=\"First draft`nA second line\"},[PSCustomObject][ordered]@{id=('b'*32);text='Second draft'},[PSCustomObject][ordered]@{id=('c'*32);text='Third draft'})",
      "$script:PromptShelfItemsLoaded=$true",
      "New-AuraPromptShelfForm",
      "$script:PromptShelfForm.Opacity=0",
      "$script:PromptShelfForm.Location=[Drawing.Point]::new(-32000,-32000)",
      "$script:PromptShelfForm.Show()",
      "[Windows.Forms.Application]::DoEvents()",
      "$defaultSize=$script:PromptShelfForm.Size",
      "$minimumSize=$script:PromptShelfForm.MinimumSize",
      "function Find-Control([Windows.Forms.Control]$Root,[string]$Name){if($Root.Name -ceq $Name){return $Root};foreach($child in $Root.Controls){$found=Find-Control $child $Name;if($null -ne $found){return $found}};return $null}",
      "function Assert-Within([Windows.Forms.Control]$Control){$parent=$Control.Parent;if($Control.Left -lt 0 -or $Control.Top -lt 0 -or $Control.Right -gt ($parent.ClientSize.Width+1) -or $Control.Bottom -gt ($parent.ClientSize.Height+1)){throw \"Control $($Control.Name) escaped $($parent.Name)\"}}",
      "function Assert-NoOverlap([Windows.Forms.Control]$Parent){$controls=@($Parent.Controls|Where-Object{$_.Visible});for($left=0;$left -lt $controls.Count;$left+=1){Assert-Within $controls[$left];if($controls[$left] -is [Windows.Forms.Button] -and ($controls[$left].Width -lt $controls[$left].PreferredSize.Width -or $controls[$left].Height -lt $controls[$left].PreferredSize.Height)){throw \"Button $($controls[$left].Name) clipped its copy\"};for($right=$left+1;$right -lt $controls.Count;$right+=1){if($controls[$left].Bounds.IntersectsWith($controls[$right].Bounds)){throw \"Action controls overlap in $($Parent.Name)\"}}}}",
      "function Get-LinearChannel([byte]$Channel){$value=[double]$Channel/255.0;if($value -le 0.04045){return $value/12.92};return [Math]::Pow((($value+0.055)/1.055),2.4)}",
      "function Get-ColorLuminance([Drawing.Color]$Color){return (0.2126*(Get-LinearChannel $Color.R))+(0.7152*(Get-LinearChannel $Color.G))+(0.0722*(Get-LinearChannel $Color.B))}",
      "function Get-ColorContrast([Drawing.Color]$Foreground,[Drawing.Color]$Background){$left=Get-ColorLuminance $Foreground;$right=Get-ColorLuminance $Background;return ([Math]::Max($left,$right)+0.05)/([Math]::Min($left,$right)+0.05)}",
      "function Assert-ButtonTheme([Windows.Forms.Button]$Button,[Drawing.Color]$Foreground,[Drawing.Color]$Background,[string]$Context){if($Button.FlatStyle -ne [Windows.Forms.FlatStyle]::Flat -or $Button.UseVisualStyleBackColor){throw \"$Context left native light-theme painting enabled on $($Button.Name)\"};if($Button.ForeColor.ToArgb() -ne $Foreground.ToArgb() -or $Button.BackColor.ToArgb() -ne $Background.ToArgb()){throw \"$Context assigned the wrong palette to $($Button.Name)\"};$contrast=Get-ColorContrast $Button.ForeColor $Button.BackColor;if($contrast -lt 4.5){throw \"$Context has $([Math]::Round($contrast,2)):1 button contrast on $($Button.Name)\"}}",
      "function Assert-ButtonInteractionContrast([Windows.Forms.Button]$Button,[string]$Context){$hover=Get-ColorContrast $Button.ForeColor $Button.FlatAppearance.MouseOverBackColor;$pressed=Get-ColorContrast $Button.ForeColor $Button.FlatAppearance.MouseDownBackColor;if($hover -lt 4.5){throw \"$Context has $([Math]::Round($hover,2)):1 hover contrast on $($Button.Name)\"};if($pressed -lt 4.5){throw \"$Context has $([Math]::Round($pressed,2)):1 pressed contrast on $($Button.Name)\"}}",
      "function Assert-HighContrastButton([Windows.Forms.Button]$Button,[string]$Context){if($Button.FlatStyle -ne [Windows.Forms.FlatStyle]::System -or -not $Button.UseVisualStyleBackColor){throw \"$Context did not restore native High Contrast painting on $($Button.Name)\"}}",
      "foreach($locale in @('en','zh-CN','zh-HKTW')){",
      "  $script:UiCopy=[IO.File]::ReadAllText($localePaths[$locale],[Text.Encoding]::UTF8)|ConvertFrom-Json",
      "  foreach($profileSpec in $profileSpecs){",
      "    $script:PromptShelfTestProfile=ConvertTo-TestProfile $profileSpec",
      "    $profile=$script:PromptShelfTestProfile",
      "    $context=\"$locale/$($profile.ThemeId)/$($profile.Appearance)\"",
      "    Update-AuraPromptShelfTheme",
      "    Set-AuraPromptShelfStatus -Text 'stale-language-status'",
      "    Update-AuraPromptShelfCopy",
      "    if($script:PromptShelfStatusLabel.Text){throw \"$context retained stale status copy\"}",
      "    $primaryButtons=@($script:PromptShelfAddButton,$script:PromptShelfInsertButton)",
      "    $secondaryButtons=@($script:PromptShelfCancelButton,$script:PromptShelfInsertNowButton,$script:PromptShelfEditButton,$script:PromptShelfMoveUpButton,$script:PromptShelfMoveDownButton,$script:PromptShelfDeleteButton,$script:PromptShelfResolveButton)",
      "    foreach($button in @($primaryButtons+$secondaryButtons)){$button.Enabled=$true}",
      "    Update-AuraPromptShelfButtonThemes -Profile $profile",
      "    [Windows.Forms.Application]::DoEvents()",
      "    foreach($button in $primaryButtons){Assert-ButtonTheme $button $profile.AccentText $profile.Accent \"$context/enabled-primary\"}",
      "    foreach($button in $secondaryButtons){Assert-ButtonTheme $button $profile.Text $profile.Surface \"$context/enabled-secondary\"}",
      "    foreach($button in @($primaryButtons+$secondaryButtons)){Assert-ButtonInteractionContrast $button \"$context/enabled-interaction\"}",
      "    foreach($button in @($primaryButtons+$secondaryButtons)){$button.Enabled=$false}",
      "    Update-AuraPromptShelfButtonThemes -Profile $profile",
      "    [Windows.Forms.Application]::DoEvents()",
      "    foreach($button in @($primaryButtons+$secondaryButtons)){Assert-ButtonTheme $button $profile.Muted $profile.Surface \"$context/disabled\"}",
      "    Update-AuraPromptShelfActions",
      "    $script:PromptShelfInsertOperation=[PSCustomObject][ordered]@{OperationId=('d'*32);PageEpoch=1;Target='https://claude.ai/';State='uncertain';Task=$null}",
      "    Set-AuraPromptShelfStatusCopy -Name 'promptShelfInsertUncertain' -Fallback 'uncertain'",
      "    Update-AuraPromptShelfActions",
      "    Update-AuraPromptShelfCopy",
      "    if($script:PromptShelfStatusLabel.Text -cne $script:UiCopy.promptShelfInsertUncertain -or -not $script:PromptShelfResolveButton.Visible){throw \"$context lost the recoverable uncertainty state\"}",
      "    $script:PromptShelfList.SelectedIndex=1",
      "    Invoke-AuraPromptShelfEdit | Out-Null",
      "    Set-AuraPromptShelfStatus -Text $script:UiCopy.promptShelfDeleteMessage",
      "    foreach($size in @($defaultSize,$minimumSize)){",
      "      $script:PromptShelfForm.Size=$size",
      "      [Windows.Forms.Application]::DoEvents()",
      "      $script:PromptShelfForm.PerformLayout()",
      "      $script:PromptShelfRoot.PerformLayout()",
      "      if($script:PromptShelfDraftBox.Height -lt 40){throw \"$context collapsed the draft editor\"}",
      "      if($script:PromptShelfList.Height -lt 56){throw \"$context collapsed the saved list\"}",
      "      if($script:PromptShelfSavedLabel.Text -cne $script:UiCopy.promptShelfSavedDrafts -or $script:PromptShelfSavedCountLabel.Text -cne '3'){throw \"$context mixed its saved label and count\"}",
      "      if($script:PromptShelfMoveUpButton.AccessibleName -cne $script:UiCopy.promptShelfMoveUp -or $script:PromptShelfMoveDownButton.AccessibleName -cne $script:UiCopy.promptShelfMoveDown){throw \"$context lost accessible reorder copy\"}",
      "      Assert-NoOverlap (Find-Control $script:PromptShelfForm 'PromptShelfDraftActions')",
      "      Assert-NoOverlap (Find-Control $script:PromptShelfForm 'PromptShelfItemUtilities')",
      "      Assert-NoOverlap (Find-Control $script:PromptShelfForm 'PromptShelfStatusPanel')",
      "      Assert-Within $script:PromptShelfInsertButton",
      "      foreach($control in @($script:PromptShelfHeader,$script:PromptShelfDraftCard,$script:PromptShelfSavedCard,$script:PromptShelfStatusPanel)){if($control.Right -gt $script:PromptShelfRoot.DisplayRectangle.Right){throw \"$context escaped the root width\"}}",
      "    }",
      "    Confirm-AuraPromptShelfComposerChecked",
      "    Reset-AuraPromptShelfEditor | Out-Null",
      "  }",
      "}",
      "$highContrastProfile=ConvertTo-TestProfile $profileSpecs[0]",
      "$highContrastProfile.HighContrast=$true",
      "$script:PromptShelfProfile=$highContrastProfile",
      "$highContrastProbe=[Windows.Forms.Button]::new()",
      "$highContrastProbe.Name='PromptShelfHighContrastProbe'",
      "$highContrastProbe.Enabled=$false",
      "Set-AuraPromptShelfButtonTheme -Button $highContrastProbe -Profile $highContrastProfile -Primary",
      "Assert-HighContrastButton $highContrastProbe 'high-contrast'",
      "$highContrastProbe.Dispose()",
      "if(-not $script:PromptShelfRoot.AutoScroll -or $script:PromptShelfRoot.AutoScrollMinSize.Height -le 0){throw 'High-DPI fallback scrolling is unavailable'}",
      "Dispose-AuraPromptShelf",
    ].join("\n");
    const regressionPath = path.join(temporaryRoot, "layout-regression.ps1");
    await fs.writeFile(regressionPath, `\uFEFF${regression}`, "utf8");
    run("powershell.exe", [
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-STA",
      "-File",
      regressionPath,
    ]);
  } finally {
    await fs.rm(temporaryRoot, { recursive: true, force: true });
  }
});

test("Prompt Shelf secures and verifies legacy state before plaintext deletion", async () => {
  const shelf = await fs.readFile(shelfPath, "utf8");
  const migration = powershellFunction(shelf, "Invoke-AuraPromptShelfLegacyMigration");
  const encryptedReader = powershellFunction(shelf, "Read-AuraPromptShelfEncryptedItems");

  const secureLegacy = migration.indexOf("Set-AuraPromptShelfSecureAcl -Path $LegacyPath");
  const readLegacy = migration.indexOf("[IO.File]::ReadAllBytes($LegacyPath)");
  const writeReplacement = migration.indexOf("Write-AuraPromptShelfItems -Items $legacyItems");
  const verifyReplacement = migration.indexOf("Read-AuraPromptShelfEncryptedItems -Path $Path");
  const compareReplacement = migration.indexOf("Test-AuraPromptShelfItemsEqual");
  const deleteLegacy = migration.indexOf("Remove-Item -LiteralPath $LegacyPath -Force");

  assert(secureLegacy >= 0 && secureLegacy < readLegacy,
    "Legacy plaintext must receive the current-user DACL before its first read");
  assert(readLegacy < writeReplacement && writeReplacement < verifyReplacement,
    "Migration must encrypt only the validated legacy state, then read the replacement back");
  assert(verifyReplacement < compareReplacement && compareReplacement < deleteLegacy,
    "Migration must prove an exact encrypted round trip before deleting legacy plaintext");
  assert.match(encryptedReader,
    /\[Security\.Cryptography\.ProtectedData\]::Unprotect\([\s\S]{0,220}?\[Security\.Cryptography\.DataProtectionScope\]::CurrentUser/,
    "Encrypted Prompt Shelf reads must remain bound to DPAPI CurrentUser");
  assert.match(powershellFunction(shelf, "Write-AuraPromptShelfItems"),
    /\[Security\.Cryptography\.ProtectedData\]::Protect\([\s\S]{0,220}?\[Security\.Cryptography\.DataProtectionScope\]::CurrentUser/,
    "Encrypted Prompt Shelf writes must remain bound to DPAPI CurrentUser");
  assert.match(migration,
    /if \(-not \$migrationCommitted -and \$createdReplacement[\s\S]{0,420}?Remove-Item -LiteralPath \$Path -Force/,
    "A failed verification must roll back only the replacement created by that migration");
});

test("Prompt Shelf storage round-trips Unicode and rejects partial or malformed state", async () => {
  if (process.platform !== "win32") return;
  const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "aura-prompt-shelf-"));
  try {
    const coreDll = path.join(PROJECT_ROOT, "vendor", "webview2",
      "Microsoft.Web.WebView2.Core.dll");
    const statePath = path.join(temporaryRoot, "prompt-shelf", "drafts.bin");
    const quote = (value) => `'${value.replaceAll("'", "''")}'`;
    const regression = [
      "$ErrorActionPreference='Stop'",
      "Add-Type -AssemblyName System.Windows.Forms",
      "Add-Type -AssemblyName System.Drawing",
      `Add-Type -Path ${quote(coreDll)}`,
      `$DataRoot=${quote(temporaryRoot)}`,
      "$script:UiCopy=$null",
      "$script:events=@()",
      "function Write-AuraUiLog { param([string]$Message); $script:events += $Message }",
      `$path=${quote(statePath)}`,
      "$legacyPath=Join-Path $DataRoot 'prompt-shelf.json'",
      "$first=[PSCustomObject][ordered]@{id=('a' * 32);text=\"First line`n繁體提示\"}",
      "$second=[PSCustomObject][ordered]@{id=('b' * 32);text='Second draft'}",
      "$legacy=[ordered]@{schemaVersion=1;items=@($first,$second)}|ConvertTo-Json -Compress -Depth 4",
      "[IO.File]::WriteAllText($legacyPath,$legacy,[Text.UTF8Encoding]::new($false))",
      `. ${quote(shelfPath)}`,
      "$roundTrip=@($script:PromptShelfItems)",
      "if(-not $script:PromptShelfItemsLoaded -or -not $script:PromptShelfPersistenceAvailable){throw 'Shelf persistence was not secured during startup'}",
      "if(Test-Path -LiteralPath $legacyPath){throw 'Plaintext legacy state survived secure migration'}",
      "if(-not (Test-Path -LiteralPath $path -PathType Leaf)){throw 'Secure state was not created'}",
      "$bytes=[IO.File]::ReadAllBytes($path)",
      "$header=[Text.Encoding]::ASCII.GetString($bytes,0,$script:PromptShelfStateMagic.Length)",
      "if($header -cne \"CLAUDE-AURA-PROMPT-SHELF-1`n\"){throw 'Shelf state lacks its encrypted envelope header'}",
      "if([Text.Encoding]::UTF8.GetString($bytes) -match 'First line|Second draft|繁體提示'){throw 'Shelf state exposed a plaintext prompt body'}",
      "if($roundTrip.Count -ne 2 -or $roundTrip[0].id -cne ('a' * 32) -or $roundTrip[0].text -cne \"First line`n繁體提示\" -or $roundTrip[1].id -cne ('b' * 32)){throw 'Shelf order or Unicode text did not survive restart read'}",
      "$userSid=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value",
      "$systemSid=[Security.Principal.SecurityIdentifier]::new([Security.Principal.WellKnownSidType]::LocalSystemSid,$null).Value",
      "foreach($securePath in @($script:PromptShelfStoreRoot,$path)){",
      "  $acl=Get-Acl -LiteralPath $securePath",
      "  if(-not $acl.AreAccessRulesProtected){throw \"Shelf path retained inherited access: $securePath\"}",
      "  $rules=@($acl.GetAccessRules($true,$false,[Security.Principal.SecurityIdentifier]))",
      "  if($rules.Count -ne 2 -or @($rules|Where-Object{$_.IsInherited -or $_.AccessControlType -ne [Security.AccessControl.AccessControlType]::Allow -or $_.IdentityReference.Value -cnotin @($userSid,$systemSid)}).Count){throw \"Shelf path has an unexpected DACL: $securePath\"}",
      "}",
      "$replacement=[PSCustomObject][ordered]@{id=('c' * 32);text='Replacement'}",
      "Write-AuraPromptShelfItems -Items @($replacement) -Path $path",
      "$stable=[IO.File]::ReadAllBytes($path)",
      "$script:OriginalPromptShelfSetAcl=${function:Set-AuraPromptShelfSecureAcl}",
      "$script:FailPromptShelfAclPath=$path",
      "$script:FailPromptShelfAclOnce=$true",
      "$script:FailPromptShelfAclOnBackup=$false",
      "function Set-AuraPromptShelfSecureAcl {",
      "  param([Parameter(Mandatory=$true)][string]$Path,[switch]$Directory)",
      "  $pathMatch=$script:FailPromptShelfAclPath -and [string]::Equals([IO.Path]::GetFullPath($Path),[IO.Path]::GetFullPath($script:FailPromptShelfAclPath),[StringComparison]::OrdinalIgnoreCase) -and (Test-Path -LiteralPath $Path -PathType Leaf)",
      "  $backupMatch=$script:FailPromptShelfAclOnBackup -and ([IO.Path]::GetFileName($Path) -like '.prompt-shelf-*.bak')",
      "  if($script:FailPromptShelfAclOnce -and ($pathMatch -or $backupMatch)){",
      "    $script:FailPromptShelfAclOnce=$false",
      "    throw 'simulated post-publication ACL failure'",
      "  }",
      "  & $script:OriginalPromptShelfSetAcl -Path $Path -Directory:$Directory",
      "}",
      "$failedReplacement=[PSCustomObject][ordered]@{id=('f' * 32);text='Must roll back'}",
      "$rejected=$false",
      "try { Write-AuraPromptShelfItems -Items @($failedReplacement) -Path $path } catch { $rejected=$true }",
      "if(-not $rejected){throw 'Post-publication replacement failure was accepted'}",
      "if(-not [Linq.Enumerable]::SequenceEqual([byte[]]$stable,[byte[]][IO.File]::ReadAllBytes($path))){throw 'Failed replacement did not restore prior encrypted state'}",
      "$restored=@(Read-AuraPromptShelfItems -Path $path)",
      "if($restored.Count -ne 1 -or $restored[0].id -cne $replacement.id -or $restored[0].text -cne $replacement.text){throw 'Failed replacement changed the prior library'}",
      "if(-not $script:PromptShelfPersistenceAvailable){throw 'Verified replacement rollback disabled persistence'}",
      "$script:FailPromptShelfAclPath=''",
      "$script:FailPromptShelfAclOnBackup=$true",
      "$script:FailPromptShelfAclOnce=$true",
      "$rejected=$false",
      "try { Write-AuraPromptShelfItems -Items @($failedReplacement) -Path $path } catch { $rejected=$true }",
      "if(-not $rejected){throw 'Post-publication backup failure was accepted'}",
      "if(-not [Linq.Enumerable]::SequenceEqual([byte[]]$stable,[byte[]][IO.File]::ReadAllBytes($path))){throw 'Backup ACL failure did not restore prior encrypted state'}",
      "if(-not $script:PromptShelfPersistenceAvailable){throw 'Verified backup rollback disabled persistence'}",
      "$script:FailPromptShelfAclOnBackup=$false",
      "$newPath=Join-Path $script:PromptShelfStoreRoot 'new-drafts.bin'",
      "$script:FailPromptShelfAclPath=$newPath",
      "$script:FailPromptShelfAclOnce=$true",
      "$rejected=$false",
      "try { Write-AuraPromptShelfItems -Items @($failedReplacement) -Path $newPath } catch { $rejected=$true }",
      "if(-not $rejected -or (Test-Path -LiteralPath $newPath)){throw 'Failed first write did not restore an empty state'}",
      "Set-Item -LiteralPath Function:\\Set-AuraPromptShelfSecureAcl -Value $script:OriginalPromptShelfSetAcl",
      "$positionA=[PSCustomObject][ordered]@{id=('d' * 32);text='Position A'}",
      "$positionB=[PSCustomObject][ordered]@{id=('e' * 32);text='Position B'}",
      "$script:PromptShelfItems=@($positionA,$positionB)",
      "Write-AuraPromptShelfItems -Items $script:PromptShelfItems -Path $path",
      "Remove-AuraPromptShelfItemById -Id $positionA.id",
      "$afterFirst=@(Read-AuraPromptShelfItems)",
      "if($afterFirst.Count -ne 1 -or $afterFirst[0].id -cne $positionB.id){throw 'Deleting the first of two drafts removed the wrong item'}",
      "$script:PromptShelfItems=@($positionA,$positionB)",
      "Write-AuraPromptShelfItems -Items $script:PromptShelfItems -Path $path",
      "Remove-AuraPromptShelfItemById -Id $positionB.id",
      "$afterSecond=@(Read-AuraPromptShelfItems)",
      "if($afterSecond.Count -ne 1 -or $afterSecond[0].id -cne $positionA.id){throw 'Deleting the second of two drafts removed the wrong item'}",
      "$script:PromptShelfItems=@($positionA)",
      "Write-AuraPromptShelfItems -Items $script:PromptShelfItems -Path $path",
      "Remove-AuraPromptShelfItemById -Id $positionA.id",
      "if(@(Read-AuraPromptShelfItems).Count -ne 0 -or $script:PromptShelfItems.Count -ne 0){throw 'Deleting the final draft did not persist an empty Shelf'}",
      "Write-AuraPromptShelfItems -Items @($replacement) -Path $path",
      "$script:PromptShelfItems=@($replacement)",
      "$stable=[IO.File]::ReadAllBytes($path)",
      "try { Write-AuraPromptShelfItems -Items @($replacement,$replacement) -Path $path; throw 'Duplicate id was accepted' } catch { if($_.Exception.Message -ceq 'Duplicate id was accepted'){throw} }",
      "if(-not [Linq.Enumerable]::SequenceEqual([byte[]]$stable,[byte[]][IO.File]::ReadAllBytes($path))){throw 'Rejected write changed valid state'}",
      "$tampered=[byte[]]$stable.Clone()",
      "$tampered[$tampered.Length-1]=$tampered[$tampered.Length-1] -bxor 1",
      "[IO.File]::WriteAllBytes($path,$tampered)",
      "Set-AuraPromptShelfSecureAcl -Path $path",
      "try { [void](Read-AuraPromptShelfItems -Path $path); throw 'Tampered state was accepted' } catch { if($_.Exception.Message -ceq 'Tampered state was accepted'){throw} }",
      "if(-not ($script:events -contains 'Prompt Shelf event: state-read-rejected')){throw 'Tampered state rejection was not recorded'}",
      "Write-AuraPromptShelfItems -Items @($replacement) -Path $path",
      "$stable=[IO.File]::ReadAllBytes($path)",
      "$probe='Quoted \"draft\" with a slash \\ and newline' + [Environment]::NewLine + 'second line __AURA_PROMPT_TEXT__ __AURA_OPERATION_ID__ __AURA_PAGE_EPOCH__ __AURA_TARGET__'",
      "$built=New-AuraPromptShelfInsertionScript -Text $probe -OperationId ('d'*32) -PageEpoch 7 -Target 'https://claude.ai/chat/test'",
      "$encoded=$probe | ConvertTo-Json -Compress",
      "if(-not $built.Contains($encoded)){throw 'Insertion script did not JSON-encode the draft'}",
      "if(-not [Linq.Enumerable]::SequenceEqual([byte[]]$stable,[byte[]][IO.File]::ReadAllBytes($path))){throw 'Insert without saving changed persistent state'}",
      "if(($script:events -join \"`n\") -match '繁體提示|Replacement|Quoted'){throw 'Prompt bodies leaked into event logs'}",
      "$leftovers=@(Get-ChildItem -LiteralPath $script:PromptShelfStoreRoot -Force | Where-Object { $_.Name -like '.prompt-shelf-*.tmp' -or $_.Name -like '.prompt-shelf-*.bak' -or $_.Name -like '.prompt-shelf-*.rollback' })",
      "if($leftovers.Count){throw 'Shelf left transaction files behind'}",
    ].join("\n");
    run("powershell.exe", [
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-STA",
      "-EncodedCommand",
      Buffer.from(regression, "utf16le").toString("base64"),
    ]);
  } finally {
    await fs.rm(temporaryRoot, { recursive: true, force: true });
  }
});

test("Prompt Shelf migration failure rolls back encryption and retains protected legacy state", async () => {
  if (process.platform !== "win32") return;
  const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "aura-prompt-shelf-rollback-"));
  try {
    const quote = (value) => `'${value.replaceAll("'", "''")}'`;
    const regression = [
      "$ErrorActionPreference='Stop'",
      "Add-Type -AssemblyName System.Windows.Forms",
      `$DataRoot=${quote(temporaryRoot)}`,
      "$script:UiCopy=$null",
      "$script:events=@()",
      "function Write-AuraUiLog { param([string]$Message); $script:events += $Message }",
      `. ${quote(shelfPath)}`,
      "$legacyPath=Join-Path $DataRoot 'prompt-shelf.json'",
      "$statePath=Join-Path (Join-Path $DataRoot 'prompt-shelf') 'drafts.bin'",
      "$canary='migration rollback canary'",
      "$item=[PSCustomObject][ordered]@{id=('a'*32);text=$canary}",
      "$legacy=[ordered]@{schemaVersion=1;items=@($item)}|ConvertTo-Json -Compress -Depth 4",
      "[IO.File]::WriteAllText($legacyPath,$legacy,[Text.UTF8Encoding]::new($false))",
      "function Read-AuraPromptShelfEncryptedItems { param([string]$Path); throw 'simulated body-free verification failure' }",
      "$rejected=$false",
      "try { Invoke-AuraPromptShelfLegacyMigration -LegacyPath $legacyPath -Path $statePath } catch { $rejected=$true }",
      "if(-not $rejected){throw 'Simulated verification failure was accepted'}",
      "if(Test-Path -LiteralPath $statePath -PathType Leaf){throw 'Failed migration retained its unverified replacement'}",
      "if(-not (Test-Path -LiteralPath $legacyPath -PathType Leaf)){throw 'Failed migration discarded recoverable legacy state'}",
      "$acl=Get-Acl -LiteralPath $legacyPath",
      "$userSid=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value",
      "$systemSid=[Security.Principal.SecurityIdentifier]::new([Security.Principal.WellKnownSidType]::LocalSystemSid,$null).Value",
      "$rules=@($acl.GetAccessRules($true,$false,[Security.Principal.SecurityIdentifier]))",
      "if(-not $acl.AreAccessRulesProtected -or $rules.Count -ne 2 -or @($rules|Where-Object{$_.IsInherited -or $_.AccessControlType -ne [Security.AccessControl.AccessControlType]::Allow -or $_.IdentityReference.Value -cnotin @($userSid,$systemSid)}).Count){throw 'Migration failure left broadly readable plaintext'}",
      "$retained=[IO.File]::ReadAllText($legacyPath,[Text.UTF8Encoding]::new($false))|ConvertFrom-Json",
      "if($retained.items[0].text -cne $canary){throw 'Migration rollback changed retained legacy state'}",
      "if(($script:events -join \"`n\").Contains($canary)){throw 'Migration failure logged prompt text'}",
      "$leftovers=@(Get-ChildItem -LiteralPath $script:PromptShelfStoreRoot -Force|Where-Object{$_.Name -like '.prompt-shelf-*.tmp' -or $_.Name -like '.prompt-shelf-*.bak'})",
      "if($leftovers.Count){throw 'Migration rollback left transaction files'}",
    ].join("\n");
    run("powershell.exe", [
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-STA",
      "-EncodedCommand",
      Buffer.from(regression, "utf16le").toString("base64"),
    ]);
  } finally {
    await fs.rm(temporaryRoot, { recursive: true, force: true });
  }
});

test("Aura Studio Prompt Shelf CRUD is revision-bound, replay-safe, and body-confined", async () => {
  if (process.platform !== "win32") return;
  const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "aura-prompt-shelf-studio-"));
  try {
    const quote = (value) => `'${value.replaceAll("'", "''")}'`;
    const coreDll = path.join(PROJECT_ROOT, "vendor", "webview2",
      "Microsoft.Web.WebView2.Core.dll");
    const statePath = path.join(temporaryRoot, "prompt-shelf", "drafts.bin");
    const regression = [
      "$ErrorActionPreference='Stop'",
      "Add-Type -AssemblyName System.Windows.Forms",
      "Add-Type -AssemblyName System.Drawing",
      `Add-Type -Path ${quote(coreDll)}`,
      `$DataRoot=${quote(temporaryRoot)}`,
      `$uiPath=${quote(uiPath)}`,
      `$statePath=${quote(statePath)}`,
      "$script:UiCopy=$null",
      "$script:events=@()",
      "function Write-AuraUiLog { param([string]$Message); $script:events += $Message }",
      "function Get-AuraUiEnabled { return $true }",
      "function Test-AuraUiClaudeUri { param($Value); return $true }",
      "function Show-AuraUiMain {}",
      `. ${quote(shelfPath)}`,
      "$script:StudioReady=$true",
      "$script:WebReady=$false",
      "$script:StudioWebView=$null",
      "$script:studioMessages=[Collections.Generic.List[object]]::new()",
      "function Send-AuraPromptShelfStudioMessage {",
      "  param([Parameter(Mandatory=$true)][Collections.IDictionary]$Message)",
      "  $clone=($Message|ConvertTo-Json -Depth 8 -Compress)|ConvertFrom-Json",
      "  [void]$script:studioMessages.Add($clone)",
      "  return $true",
      "}",
      "function Get-LastStudioMessage {",
      "  if($script:studioMessages.Count -eq 0){throw 'Studio emitted no message'}",
      "  return $script:studioMessages[$script:studioMessages.Count-1]",
      "}",
      "function Assert-ByteEqual([byte[]]$Left,[byte[]]$Right,[string]$Label){",
      "  if(-not [Linq.Enumerable]::SequenceEqual($Left,$Right)){throw $Label}",
      "}",
      "function Assert-Rejected([scriptblock]$Operation,[string]$Label){",
      "  $rejected=$false;try{&$Operation|Out-Null}catch{$rejected=$true}",
      "  if(-not $rejected){throw \"Studio accepted $Label\"}",
      "}",
      "function Invoke-ValidatedShelfMessage([Collections.IDictionary]$Message){",
      "  $request=[pscustomobject]$Message",
      "  Assert-AuraPromptShelfStudioRequest -Message $request",
      "  Invoke-AuraPromptShelfStudioRequest -Message $request",
      "}",
      "$tokens=$null;$errors=$null",
      "$ast=[System.Management.Automation.Language.Parser]::ParseFile($uiPath,[ref]$tokens,[ref]$errors)",
      "if($errors.Count){throw 'Could not parse Aura UI for Prompt Shelf bridge regression'}",
      "foreach($name in @('Test-AuraUiStudioDocumentUri','Get-AuraUiStudioMessage')){",
      "  $definition=$ast.Find({param($node)$node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -ceq $name},$true)",
      "  if($null -eq $definition){throw \"Missing Studio bridge function $name\"}",
      "  Invoke-Expression $definition.Extent.Text",
      "}",
      "$StudioLocaleIds=@('en','hi','es','fr','id','ja','ko','pt-BR','de','it','vi','pl','tr','zh-CN','zh-HKTW')",
      "$script:StudioMessageTypes=@('prompt-shelf-read','prompt-shelf-create','prompt-shelf-update','prompt-shelf-move','prompt-shelf-delete','prompt-shelf-insert','prompt-shelf-confirm-checked')",
      "$script:PromptShelfStudioSession=New-AuraPromptShelfStudioSession",
      "$session=$script:PromptShelfStudioSession",
      "$source='https://aura.studio/index.html?locale=en&view=prompt-shelf'",
      "$readId='a1111111-1111-4111-8111-111111111111'",
      "$createId='22222222-2222-4222-8222-222222222222'",
      "$secondCreateId='33333333-3333-4333-8333-333333333333'",
      "$updateId='44444444-4444-4444-8444-444444444444'",
      "$moveId='55555555-5555-4555-8555-555555555555'",
      "$staleId='66666666-6666-4666-8666-666666666666'",
      "$snapshotId='77777777-7777-4777-8777-777777777777'",
      "$deleteSecondId='88888888-8888-4888-8888-888888888888'",
      "$deleteFirstId='99999999-9999-4999-8999-999999999999'",
      "$invalidTextId='b1111111-1111-4111-8111-111111111111'",
      "$staleEpochId='b2222222-2222-4222-8222-222222222222'",
      "$failedInsertId='b3333333-3333-4333-8333-333333333333'",
      "$staleConfirmId='b4444444-4444-4444-8444-444444444444'",
      "$staleRevisionConfirmId='b5555555-5555-4555-8555-555555555555'",
      "$confirmId='b6666666-6666-4666-8666-666666666666'",
      "$rotationInsertId='b7777777-7777-4777-8777-777777777777'",
      "$canary=\"Studio body canary`n简体／繁體／日本語\"",
      "$updatedCanary=\"Updated body canary`n第二行🙂\"",
      "$staleCanary='STALE BODY MUST NEVER ESCAPE'",
      "$read=[ordered]@{type='prompt-shelf-read';version=1;requestId=$readId}",
      "$parsedRead=Get-AuraUiStudioMessage -Json ($read|ConvertTo-Json -Compress) -Source $source",
      "if($parsedRead.type -cne 'prompt-shelf-read' -or $parsedRead.version -ne 1){throw 'Exact Studio source changed a valid protocol-v1 read'}",
      "Assert-Rejected { Get-AuraUiStudioMessage -Json ($read|ConvertTo-Json -Compress) -Source 'https://aura.studio/Index.html' } 'a case-changed Studio path'",
      "Assert-Rejected { Get-AuraUiStudioMessage -Json ($read|ConvertTo-Json -Compress) -Source 'https://aura.studio/editor-preview.html' } 'another aura.studio document'",
      "Assert-Rejected { Get-AuraUiStudioMessage -Json ($read|ConvertTo-Json -Compress) -Source 'https://aura.studio.invalid/index.html' } 'another Studio origin'",
      "Assert-Rejected { Get-AuraUiStudioMessage -Json ($read|ConvertTo-Json -Compress) -Source 'https://aura.studio/index.html?locale=en&view=prompt-shelf&extra=1' } 'an expanded Studio query'",
      "Assert-Rejected { Get-AuraUiStudioMessage -Json ($read|ConvertTo-Json -Compress) -Source 'https://aura.studio/index.html?locale=EN&view=prompt-shelf' } 'a case-changed Studio locale'",
      "Assert-Rejected { Get-AuraUiStudioMessage -Json ($read|ConvertTo-Json -Compress) -Source 'https://aura.studio/index.html?locale=en&view=editor' } 'the private editor view'",
      "$extraRead=[ordered]@{type='prompt-shelf-read';version=1;requestId=$readId;text=$canary}",
      "Assert-Rejected { Get-AuraUiStudioMessage -Json ($extraRead|ConvertTo-Json -Compress) -Source $source } 'a body-bearing read'",
      "$missingVersion=[ordered]@{type='prompt-shelf-read';requestId=$readId}",
      "Assert-Rejected { Get-AuraUiStudioMessage -Json ($missingVersion|ConvertTo-Json -Compress) -Source $source } 'a versionless read'",
      "$unsupportedVersion=[ordered]@{type='prompt-shelf-read';version=2;requestId=$readId}",
      "Assert-Rejected { Get-AuraUiStudioMessage -Json ($unsupportedVersion|ConvertTo-Json -Compress) -Source $source } 'an unsupported protocol version'",
      "$create=[ordered]@{type='prompt-shelf-create';version=1;requestId=$createId;session=$session;revision=0;commandEpoch=0;text=$canary}",
      "$parsedCreate=Get-AuraUiStudioMessage -Json ($create|ConvertTo-Json -Compress) -Source $source",
      "if($parsedCreate.text -cne $canary){throw 'Studio parser changed Unicode prompt text'}",
      "$clientIdCreate=[ordered]@{type='prompt-shelf-create';version=1;requestId=$createId;session=$session;revision=0;commandEpoch=0;id=('a'*32);text=$canary}",
      "Assert-Rejected { Get-AuraUiStudioMessage -Json ($clientIdCreate|ConvertTo-Json -Compress) -Source $source } 'a client-minted persisted id'",
      "$upperRequest=[ordered]@{type='prompt-shelf-read';version=1;requestId=$readId.ToUpperInvariant()}",
      "Assert-Rejected { Get-AuraUiStudioMessage -Json ($upperRequest|ConvertTo-Json -Compress) -Source $source } 'a noncanonical request id'",
      "$stringRevision=[ordered]@{type='prompt-shelf-create';version=1;requestId=$createId;session=$session;revision='0';commandEpoch=0;text=$canary}",
      "Assert-Rejected { Get-AuraUiStudioMessage -Json ($stringRevision|ConvertTo-Json -Compress) -Source $source } 'a string revision'",
      "$stringEpoch=[ordered]@{type='prompt-shelf-create';version=1;requestId=$createId;session=$session;revision=0;commandEpoch='0';text=$canary}",
      "Assert-Rejected { Get-AuraUiStudioMessage -Json ($stringEpoch|ConvertTo-Json -Compress) -Source $source } 'a string command epoch'",
      "Invoke-ValidatedShelfMessage $read",
      "$initialState=Get-LastStudioMessage",
      "if($initialState.type -cne 'prompt-shelf-state' -or $initialState.version -ne 1 -or $initialState.requestId -cne $readId -or $initialState.session -cne $session -or $initialState.revision -ne 0 -or $initialState.commandEpoch -ne 0 -or @($initialState.items).Count -ne 0){throw 'Initial Shelf snapshot changed shape or correlation'}",
      "Invoke-ValidatedShelfMessage $create",
      "$created=Get-LastStudioMessage",
      "if($created.type -cne 'prompt-shelf-result' -or $created.version -ne 1 -or -not $created.ok -or $created.action -cne 'create' -or $created.code -cne 'ok' -or $created.revision -ne 1 -or $created.commandEpoch -ne 1 -or $created.itemId -cnotmatch '^[a-f0-9]{32}$'){throw 'Unicode create did not return a host-generated id and command epoch'}",
      "$firstItemId=[string]$created.itemId",
      "if($firstItemId -ceq ('a'*32)){throw 'Studio supplied the persisted draft id'}",
      "$stableAfterCreate=[IO.File]::ReadAllBytes($statePath)",
      "$revisionAfterCreate=[long]$script:PromptShelfStudioRevision",
      "$epochAfterCreate=[long]$script:PromptShelfStudioCommandEpoch",
      "$messageCount=$script:studioMessages.Count",
      "Invoke-ValidatedShelfMessage $create",
      "$duplicate=Get-LastStudioMessage",
      "if($script:studioMessages.Count -ne ($messageCount+1) -or -not $duplicate.ok -or $duplicate.itemId -cne $firstItemId -or $duplicate.revision -ne $revisionAfterCreate -or $duplicate.commandEpoch -ne $epochAfterCreate -or $script:PromptShelfStudioRevision -ne $revisionAfterCreate -or $script:PromptShelfStudioCommandEpoch -ne $epochAfterCreate){throw 'Duplicate request id was not idempotent'}",
      "Assert-ByteEqual $stableAfterCreate ([IO.File]::ReadAllBytes($statePath)) 'Duplicate request id rewrote encrypted state'",
      "$changedPayload=[ordered]@{type='prompt-shelf-create';version=1;requestId=$createId;session=$session;revision=0;commandEpoch=0;text=$updatedCanary}",
      "Invoke-ValidatedShelfMessage $changedPayload",
      "$conflictResult=Get-LastStudioMessage",
      "if($conflictResult.ok -or $conflictResult.code -cne 'request-conflict' -or $conflictResult.commandEpoch -ne 1 -or $script:PromptShelfStudioRevision -ne 1 -or $script:PromptShelfStudioCommandEpoch -ne 1){throw 'Same request id and type accepted a changed payload while cached'}",
      "Assert-ByteEqual $stableAfterCreate ([IO.File]::ReadAllBytes($statePath)) 'Changed-payload request id conflict changed encrypted state'",
      "$conflict=[ordered]@{type='prompt-shelf-update';version=1;requestId=$createId;session=$session;revision=1;commandEpoch=1;id=$firstItemId;text=$updatedCanary}",
      "Invoke-ValidatedShelfMessage $conflict",
      "$crossTypeConflict=Get-LastStudioMessage",
      "if($crossTypeConflict.ok -or $crossTypeConflict.code -cne 'request-conflict' -or $script:PromptShelfStudioCommandEpoch -ne 1){throw 'Request id reuse across action types was accepted'}",
      "$second=[ordered]@{type='prompt-shelf-create';version=1;requestId=$secondCreateId;session=$session;revision=1;commandEpoch=1;text='Second Unicode draft — 第二'}",
      "Invoke-ValidatedShelfMessage $second",
      "$secondResult=Get-LastStudioMessage",
      "if(-not $secondResult.ok -or $secondResult.revision -ne 2 -or $secondResult.commandEpoch -ne 2 -or $secondResult.itemId -cnotmatch '^[a-f0-9]{32}$' -or $secondResult.itemId -ceq $firstItemId){throw 'Second create did not mint a distinct id and epoch'}",
      "$secondItemId=[string]$secondResult.itemId",
      "$acceptedFailure=[ordered]@{type='prompt-shelf-create';version=1;requestId=$invalidTextId;session=$session;revision=2;commandEpoch=2;text='   '}",
      "Invoke-ValidatedShelfMessage $acceptedFailure",
      "$failed=Get-LastStudioMessage",
      "if($failed.ok -or $failed.code -cne 'invalid-text' -or $failed.revision -ne 2 -or $failed.commandEpoch -ne 3 -or $script:PromptShelfStudioCommandEpoch -ne 3){throw 'Accepted validation failure did not consume one command epoch'}",
      "$stableBeforeStale=[IO.File]::ReadAllBytes($statePath)",
      "$stale=[ordered]@{type='prompt-shelf-update';version=1;requestId=$staleId;session=$session;revision=1;commandEpoch=3;id=$firstItemId;text=$staleCanary}",
      "Invoke-ValidatedShelfMessage $stale",
      "$staleResult=Get-LastStudioMessage",
      "if($staleResult.ok -or $staleResult.code -cne 'stale' -or $staleResult.revision -ne 2 -or $staleResult.commandEpoch -ne 3 -or $script:PromptShelfStudioCommandEpoch -ne 3){throw 'Mutation with stale revision was accepted or consumed an epoch'}",
      "$staleEpoch=[ordered]@{type='prompt-shelf-update';version=1;requestId=$staleEpochId;session=$session;revision=2;commandEpoch=2;id=$firstItemId;text=$staleCanary}",
      "Invoke-ValidatedShelfMessage $staleEpoch",
      "$staleEpochResult=Get-LastStudioMessage",
      "if($staleEpochResult.ok -or $staleEpochResult.code -cne 'stale' -or $staleEpochResult.revision -ne 2 -or $staleEpochResult.commandEpoch -ne 3 -or $script:PromptShelfStudioCommandEpoch -ne 3){throw 'Mutation with stale command epoch was accepted or consumed an epoch'}",
      "Assert-ByteEqual $stableBeforeStale ([IO.File]::ReadAllBytes($statePath)) 'Stale revision or command epoch changed encrypted state'",
      "$update=[ordered]@{type='prompt-shelf-update';version=1;requestId=$updateId;session=$session;revision=2;commandEpoch=3;id=$firstItemId;text=$updatedCanary}",
      "Invoke-ValidatedShelfMessage $update",
      "$updated=Get-LastStudioMessage",
      "if(-not $updated.ok -or $updated.revision -ne 3 -or $updated.commandEpoch -ne 4 -or $script:PromptShelfItems[0].text -cne $updatedCanary){throw 'Unicode update did not persist'}",
      "$move=[ordered]@{type='prompt-shelf-move';version=1;requestId=$moveId;session=$session;revision=3;commandEpoch=4;id=$secondItemId;direction='up'}",
      "Invoke-ValidatedShelfMessage $move",
      "$moved=Get-LastStudioMessage",
      "if(-not $moved.ok -or $moved.revision -ne 4 -or $moved.commandEpoch -ne 5 -or $script:PromptShelfItems[0].id -cne $secondItemId -or $script:PromptShelfItems[1].id -cne $firstItemId){throw 'Studio reorder did not persist exact item order'}",
      "$snapshot=[ordered]@{type='prompt-shelf-read';version=1;requestId=$snapshotId}",
      "Invoke-ValidatedShelfMessage $snapshot",
      "$bodyState=Get-LastStudioMessage",
      "if($bodyState.type -cne 'prompt-shelf-state' -or $bodyState.version -ne 1 -or $bodyState.revision -ne 4 -or $bodyState.commandEpoch -ne 5 -or @($bodyState.items).Count -ne 2 -or $bodyState.items[0].id -cne $secondItemId -or $bodyState.items[1].text -cne $updatedCanary){throw 'Body-bearing snapshot lost order, text, revision, or command epoch'}",
      "$failedInsert=[ordered]@{type='prompt-shelf-insert';version=1;requestId=$failedInsertId;session=$session;revision=4;commandEpoch=5;id=$firstItemId}",
      "Invoke-ValidatedShelfMessage $failedInsert",
      "$insertFailure=Get-LastStudioMessage",
      "if($insertFailure.ok -or $insertFailure.code -cne 'runtime-unavailable' -or $insertFailure.revision -ne 4 -or $insertFailure.commandEpoch -ne 6 -or $script:PromptShelfStudioCommandEpoch -ne 6){throw 'Accepted insert failure did not consume one command epoch'}",
      "$script:PromptShelfInsertOperation=[PSCustomObject][ordered]@{OperationId=('c'*32);PageEpoch=1;Target='https://claude.ai/';State='uncertain';Task=$null;StudioRequestId=$failedInsertId;StudioSession=$session;StudioItemId=$firstItemId;StudioRequestFingerprint=('c'*64)}",
      "$staleConfirm=[ordered]@{type='prompt-shelf-confirm-checked';version=1;requestId=$staleConfirmId;session=$session;revision=4;commandEpoch=5}",
      "Invoke-ValidatedShelfMessage $staleConfirm",
      "$staleConfirmResult=Get-LastStudioMessage",
      "if($staleConfirmResult.ok -or $staleConfirmResult.code -cne 'stale' -or $script:PromptShelfStudioCommandEpoch -ne 6 -or $null -eq $script:PromptShelfInsertOperation){throw 'Confirm accepted a stale command epoch'}",
      "$staleRevisionConfirm=[ordered]@{type='prompt-shelf-confirm-checked';version=1;requestId=$staleRevisionConfirmId;session=$session;revision=3;commandEpoch=6}",
      "Invoke-ValidatedShelfMessage $staleRevisionConfirm",
      "$staleRevisionConfirmResult=Get-LastStudioMessage",
      "if($staleRevisionConfirmResult.ok -or $staleRevisionConfirmResult.code -cne 'stale' -or $script:PromptShelfStudioCommandEpoch -ne 6 -or $null -eq $script:PromptShelfInsertOperation){throw 'Confirm accepted a stale revision'}",
      "$confirm=[ordered]@{type='prompt-shelf-confirm-checked';version=1;requestId=$confirmId;session=$session;revision=4;commandEpoch=6}",
      "Invoke-ValidatedShelfMessage $confirm",
      "$confirmed=@($script:studioMessages|Where-Object{$_.type -ceq 'prompt-shelf-result' -and $_.requestId -ceq $confirmId})[-1]",
      "if(-not $confirmed.ok -or $confirmed.code -cne 'ok' -or $confirmed.action -cne 'confirm' -or $confirmed.commandEpoch -ne 7 -or $script:PromptShelfStudioCommandEpoch -ne 7 -or $null -ne $script:PromptShelfInsertOperation){throw 'Current revision and command epoch did not acknowledge uncertainty exactly once'}",
      "$stableBeforeEviction=[IO.File]::ReadAllBytes($statePath)",
      "for($index=0;$index -lt 70;$index++){",
      "  $epoch=[long]$script:PromptShelfStudioCommandEpoch",
      "  $missing=[ordered]@{type='prompt-shelf-update';version=1;requestId=[Guid]::NewGuid().ToString('D').ToLowerInvariant();session=$session;revision=4;commandEpoch=$epoch;id=('f'*32);text='missing'}",
      "  Invoke-ValidatedShelfMessage $missing",
      "  $missingResult=Get-LastStudioMessage",
      "  if($missingResult.ok -or $missingResult.code -cne 'not-found' -or $missingResult.revision -ne 4 -or $missingResult.commandEpoch -ne ($epoch+1)){throw 'Accepted not-found failure did not consume exactly one command epoch'}",
      "}",
      "if($script:PromptShelfStudioReceiptOrder.Count -ne 64 -or $script:PromptShelfStudioReceipts.Count -ne 64){throw 'Receipt FIFO did not retain its bounded 64 entries'}",
      "if($script:PromptShelfStudioReceipts.ContainsKey($createId)){throw 'Old create receipt was not evicted from the bounded FIFO'}",
      "$epochAfterEviction=[long]$script:PromptShelfStudioCommandEpoch",
      "Invoke-ValidatedShelfMessage $create",
      "$evictedReplay=Get-LastStudioMessage",
      "if($evictedReplay.ok -or $evictedReplay.code -cne 'stale' -or $evictedReplay.revision -ne 4 -or $evictedReplay.commandEpoch -ne $epochAfterEviction -or $script:PromptShelfStudioCommandEpoch -ne $epochAfterEviction -or $script:PromptShelfItems.Count -ne 2){throw 'Evicted replay was not held stale by revision and command epoch'}",
      "Assert-ByteEqual $stableBeforeEviction ([IO.File]::ReadAllBytes($statePath)) 'Evicted replay rewrote encrypted state'",
      "$deleteSecond=[ordered]@{type='prompt-shelf-delete';version=1;requestId=$deleteSecondId;session=$session;revision=4;commandEpoch=$epochAfterEviction;id=$secondItemId}",
      "Invoke-ValidatedShelfMessage $deleteSecond",
      "$deletedSecond=Get-LastStudioMessage",
      "if(-not $deletedSecond.ok -or $deletedSecond.revision -ne 5 -or $deletedSecond.commandEpoch -ne ($epochAfterEviction+1) -or $script:PromptShelfItems.Count -ne 1 -or $script:PromptShelfItems[0].id -cne $firstItemId){throw 'Deleting the first ordered item removed the wrong draft'}",
      "$deleteFirst=[ordered]@{type='prompt-shelf-delete';version=1;requestId=$deleteFirstId;session=$session;revision=5;commandEpoch=($epochAfterEviction+1);id=$firstItemId}",
      "Invoke-ValidatedShelfMessage $deleteFirst",
      "$deletedFirst=Get-LastStudioMessage",
      "if(-not $deletedFirst.ok -or $deletedFirst.revision -ne 6 -or $deletedFirst.commandEpoch -ne ($epochAfterEviction+2) -or $script:PromptShelfItems.Count -ne 0 -or @(Read-AuraPromptShelfItems).Count -ne 0){throw 'Deleting the final Studio draft did not persist an empty Shelf'}",
      "$encrypted=[Text.Encoding]::UTF8.GetString([IO.File]::ReadAllBytes($statePath))",
      "if($encrypted.Contains($canary) -or $encrypted.Contains($updatedCanary) -or $encrypted.Contains($staleCanary)){throw 'Studio mutation exposed a plaintext prompt body on disk'}",
      "foreach($receipt in $script:PromptShelfStudioReceipts.Values){",
      "  $receiptNames=@($receipt.Message.Keys)",
      "  if($receiptNames.Count -ne 10 -or $receiptNames -ccontains 'text' -or $receiptNames -ccontains 'body' -or $receiptNames -ccontains 'items' -or [string]$receipt.Fingerprint -cnotmatch '^[a-f0-9]{64}$'){throw 'Replay receipt retained a prompt body field or invalid fingerprint'}",
      "}",
      "$receiptJson=$script:PromptShelfStudioReceipts.Values|ConvertTo-Json -Depth 8 -Compress",
      "if($receiptJson.Contains($canary) -or $receiptJson.Contains($updatedCanary) -or $receiptJson.Contains($staleCanary)){throw 'Replay cache retained a plaintext prompt body'}",
      "$rotationFingerprint=Get-AuraPromptShelfStudioRequestFingerprint -Message ([pscustomobject][ordered]@{type='prompt-shelf-insert';version=1;requestId=$rotationInsertId;session=$session;revision=6;commandEpoch=($epochAfterEviction+2);id=('e'*32)})",
      "$script:PromptShelfInsertOperation=[PSCustomObject][ordered]@{OperationId=('d'*32);PageEpoch=9;Target='https://claude.ai/chat/test';State='dispatching';Task=[PSCustomObject]@{};StudioRequestId=$rotationInsertId;StudioSession=$session;StudioItemId=('e'*32);StudioRequestFingerprint=$rotationFingerprint}",
      "$rotatedSession=New-AuraPromptShelfStudioSession",
      "if($rotatedSession -ceq $session -or $script:PromptShelfStudioSession -cne $rotatedSession -or $script:PromptShelfStudioCommandEpoch -ne 0 -or $script:PromptShelfStudioReceipts.Count -ne 0){throw 'Studio session rotation did not reset replay authority'}",
      "if($script:PromptShelfInsertOperation.State -cne 'uncertain' -or $null -ne $script:PromptShelfInsertOperation.Task -or -not ($script:events -contains 'Prompt Shelf event: studio-session-changed')){throw 'Studio session rotation did not make its in-flight insertion explicitly uncertain'}",
      "$rotationResult=@($script:studioMessages|Where-Object{$_.type -ceq 'prompt-shelf-result' -and $_.requestId -ceq $rotationInsertId})[-1]",
      "if($null -eq $rotationResult -or $rotationResult.version -ne 1 -or $rotationResult.session -cne $session -or $rotationResult.action -cne 'insert' -or $rotationResult.code -cne 'uncertain' -or $rotationResult.ok){throw 'Session rotation did not emit a correlated body-free uncertainty receipt'}",
      "foreach($message in $script:studioMessages){",
      "  if($message.version -ne 1){throw \"Outbound Shelf envelope $($message.type) omitted protocol version 1\"}",
      "  $names=@($message.PSObject.Properties.Name)",
      "  if($message.type -ceq 'prompt-shelf-state'){",
      "    $expected=@('type','version','requestId','session','revision','commandEpoch','persistenceAvailable','insertionAvailable','insertState','items')",
      "  }elseif($message.type -ceq 'prompt-shelf-result'){",
      "    $expected=@('type','version','requestId','session','action','ok','code','revision','commandEpoch','itemId')",
      "  }elseif($message.type -ceq 'prompt-shelf-changed'){",
      "    $expected=@('type','version','session','revision','commandEpoch')",
      "  }else{throw \"Unknown outbound Shelf message $($message.type)\"}",
      "  if($names.Count -ne $expected.Count -or @($expected|Where-Object{$names -cnotcontains $_}).Count){throw \"Expanded outbound Shelf message $($message.type)\"}",
      "  if($message.type -cne 'prompt-shelf-state' -and @($names|Where-Object{$_ -cin @('text','body','items')}).Count){throw \"Prompt body field escaped through $($message.type)\"}",
      "}",
      "$bodyMessages=@($script:studioMessages|Where-Object{$_.type -ceq 'prompt-shelf-state' -and @($_.items|Where-Object{$_.text -ceq $updatedCanary}).Count -eq 1})",
      "if($bodyMessages.Count -ne 1 -or $bodyMessages[0].type -cne 'prompt-shelf-state'){throw 'Prompt body was not confined to one requested state snapshot'}",
      "if(($script:events -join \"`n\").Contains($canary) -or ($script:events -join \"`n\").Contains($updatedCanary) -or ($script:events -join \"`n\").Contains($staleCanary)){throw 'Prompt body entered host logs'}",
      "$nonStateJson=@($script:studioMessages|Where-Object{$_.type -cne 'prompt-shelf-state'})|ConvertTo-Json -Depth 8 -Compress",
      "if($nonStateJson.Contains($canary) -or $nonStateJson.Contains($updatedCanary) -or $nonStateJson.Contains($staleCanary)){throw 'Prompt body entered a receipt or invalidation'}",
    ].join("\n");
    const regressionPath = path.join(temporaryRoot, "studio-regression.ps1");
    await fs.writeFile(regressionPath, `\uFEFF${regression}`, "utf8");
    run("powershell.exe", [
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-STA",
      "-File",
      regressionPath,
    ]);
  } finally {
    await fs.rm(temporaryRoot, { recursive: true, force: true });
  }
});

test("Prompt Shelf inserts once at the retained native caret without a send path", async () => {
  const shelf = await fs.readFile(shelfPath, "utf8");
  const template = insertionTemplate(shelf);
  for (const forbidden of [
    /\brequestSubmit\b/,
    /\.submit\s*\(/,
    /\.click\s*\(/,
    /\bKeyboardEvent\b/,
    /\b(?:Enter|NumpadEnter|SendKeys)\b/,
    /\b(?:navigator\.)?clipboard\b/i,
    /\bsetInterval\b/,
    /\bsetTimeout\b/,
    /\bMutationObserver\b/,
    /\b(?:generation|streaming|response-complete)\b/i,
    /addEventListener/,
  ]) {
    assert.doesNotMatch(template, forbidden,
      `Insertion template contains a send, retry, polling, or listener path: ${forbidden}`);
  }
  assert.match(template, /__CLAUDE_AURA_STATE__\?\.discoverComposer\?\.\(\)/);
  assert.match(template, /setRangeText\(text, editor\.selectionStart, editor\.selectionEnd, "end"\)/);
  assert.match(template, /document\.execCommand\("insertText", false, text\)/);
  assert.match(template, /document\.activeElement !== editor/);
  assert.match(template,
    /editor\.contains\(selection\.anchorNode\)[\s\S]{0,100}?editor\.contains\(selection\.focusNode\)/);

  const inputEvents = [];
  const documentStub = {
    activeElement: null,
    selection: null,
    getSelection() {
      return this.selection;
    },
    execCommand() {
      throw new Error("Unexpected content-editable insertion");
    },
  };
  class FakeInputEvent {
    constructor(type, options) {
      this.type = type;
      Object.assign(this, options);
    }
  }
  let found;
  const windowStub = {
    __CLAUDE_AURA_STATE__: {
      discoverComposer: () => found,
    },
  };
  const operationId = "d".repeat(32);
  const pageEpoch = 42;
  const currentTarget = "https://claude.ai/chat/test";
  const locationStub = {
    origin: "https://claude.ai",
    pathname: "/chat/test",
    search: "",
  };
  const execute = (text, expectedTarget = currentTarget) => {
    const source = `${template}(${JSON.stringify(text)}, ${JSON.stringify(operationId)}, `
      + `${pageEpoch}, ${JSON.stringify(expectedTarget)})`;
    return new Function("window", "document", "InputEvent", "location",
      `return ${source};`)(
      windowStub, documentStub, FakeInputEvent, locationStub,
    );
  };

  const textarea = {
    tagName: "TEXTAREA",
    value: "Hello world",
    selectionStart: 5,
    selectionEnd: 5,
    matches: () => false,
    contains: () => false,
    setRangeText(text, start, end) {
      this.value = `${this.value.slice(0, start)}${text}${this.value.slice(end)}`;
      this.selectionStart = start + text.length;
      this.selectionEnd = this.selectionStart;
    },
    dispatchEvent(event) {
      inputEvents.push(event);
      return true;
    },
  };
  found = { context: "conversation", editor: textarea };
  documentStub.activeElement = textarea;
  assert.deepEqual(execute(" thoughtful"), {
    operationId,
    pageEpoch,
    target: currentTarget,
    inserted: true,
    context: "conversation",
    reason: "inserted",
    certainty: "certain",
  });
  assert.equal(textarea.value, "Hello thoughtful world");
  assert.equal(inputEvents.length, 1);
  assert.equal(inputEvents[0].type, "input");
  assert.equal(inputEvents[0].inputType, "insertText");
  const formerPlaceholderTokens = [
    "__AURA_PROMPT_TEXT__",
    "__AURA_OPERATION_ID__",
    "__AURA_PAGE_EPOCH__",
    "__AURA_TARGET__",
  ].join(" ");
  textarea.selectionStart = textarea.value.length;
  textarea.selectionEnd = textarea.value.length;
  assert.equal(execute(formerPlaceholderTokens).inserted, true);
  assert(textarea.value.endsWith(formerPlaceholderTokens),
    "Prompt text containing former template tokens must remain byte-for-byte unchanged");
  const textareaInputEventCount = inputEvents.length;

  const anchor = {};
  let content = "";
  const editable = {
    tagName: "DIV",
    matches: () => false,
    contains: (node) => node === anchor,
  };
  found = { context: "new-chat", editor: editable };
  documentStub.activeElement = editable;
  documentStub.selection = { anchorNode: anchor, focusNode: anchor };
  documentStub.execCommand = (command, _showUi, text) => {
    assert.equal(command, "insertText");
    content += text;
    return true;
  };
  assert.deepEqual(execute("Content-editable draft"), {
    operationId,
    pageEpoch,
    target: currentTarget,
    inserted: true,
    context: "new-chat",
    reason: "inserted",
    certainty: "certain",
  });
  assert.equal(content, "Content-editable draft");
  assert.equal(inputEvents.length, textareaInputEventCount,
    "Content-editable insertion must use its native input transaction");

  documentStub.execCommand = () => false;
  assert.deepEqual(execute("Unconfirmed draft"), {
    operationId,
    pageEpoch,
    target: currentTarget,
    inserted: false,
    context: "new-chat",
    reason: "insertion-uncertain",
    certainty: "uncertain",
  });

  assert.deepEqual(execute("wrong route", "https://claude.ai/chat/other"), {
    operationId,
    pageEpoch,
    target: currentTarget,
    inserted: false,
    context: "other",
    reason: "stale-target",
    certainty: "certain",
  });

  found = { context: "other", editor: null };
  assert.deepEqual(execute("ignored"), {
    operationId,
    pageEpoch,
    target: currentTarget,
    inserted: false,
    context: "other",
    reason: "composer-unavailable",
    certainty: "certain",
  });
});

test("Permanently missing Prompt Shelf acknowledgement becomes uncertain and keeps retry locked", async () => {
  if (process.platform !== "win32") return;
  const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "aura-prompt-shelf-delay-"));
  try {
    const quote = (value) => `'${value.replaceAll("'", "''")}'`;
    const regression = [
      "$ErrorActionPreference='Stop'",
      "Add-Type -AssemblyName System.Windows.Forms",
      `$DataRoot=${quote(temporaryRoot)}`,
      "$script:UiCopy=$null",
      "$script:events=@()",
      "function Write-AuraUiLog { param([string]$Message); $script:events += $Message }",
      "function Test-AuraUiClaudeUri { param($Value); return $true }",
      `. ${quote(shelfPath)}`,
      "$script:PromptShelfPageEpoch=7",
      "$script:WebView=[PSCustomObject]@{Source=[Uri]'https://claude.ai/chat/test'}",
      "$tcs=[Threading.Tasks.TaskCompletionSource[string]]::new()",
      "$task=$tcs.Task",
      "$operation=[PSCustomObject][ordered]@{OperationId=('d'*32);PageEpoch=7;Target='https://claude.ai/chat/test';State='dispatching';Task=$task}",
      "$script:PromptShelfInsertOperation=$operation",
      "Dispose-AuraPromptShelf",
      "if($script:PromptShelfInsertOperation -ne $operation -or -not [object]::ReferenceEquals($operation.Task,$task)){throw 'Closing the Shelf released its in-flight operation'}",
      "Ensure-AuraPromptShelfInsertTimeout",
      "$script:PromptShelfInsertTimeout.Interval=100",
      "$script:PromptShelfInsertUncertainTimeout.Interval=600",
      "$script:PromptShelfInsertTimeout.Start()",
      "$clock=[Diagnostics.Stopwatch]::StartNew()",
      "while($operation.State -cne 'delayed' -and $clock.ElapsedMilliseconds -lt 1200){[Windows.Forms.Application]::DoEvents();[Threading.Thread]::Sleep(10)}",
      "if($script:PromptShelfInsertOperation -ne $operation -or $operation.State -cne 'delayed' -or -not [object]::ReferenceEquals($operation.Task,$task)){throw 'Delayed insertion released its task or retry lock'}",
      "if($script:PromptShelfStatusCopyName -cne 'promptShelfInsertDelayed'){throw 'Delayed insertion lost its explicit status'}",
      "$message=[ordered]@{operationId=('d'*32);pageEpoch=7;target='https://claude.ai/chat/test';inserted=$true;context='conversation';reason='inserted';certainty='certain'}|ConvertTo-Json -Compress",
      "$tcs.SetResult($message)",
      "Complete-AuraPromptShelfInsertTask",
      "if($null -ne $script:PromptShelfInsertOperation -or $script:PromptShelfStatusCopyName -cne 'promptShelfInserted'){throw 'Late certain result did not complete the serialized operation'}",
      "$missing=[Threading.Tasks.TaskCompletionSource[string]]::new()",
      "$missingTask=$missing.Task",
      "$missingOperation=[PSCustomObject][ordered]@{OperationId=('f'*32);PageEpoch=7;Target='https://claude.ai/chat/test';State='dispatching';Task=$missingTask}",
      "$script:PromptShelfInsertOperation=$missingOperation",
      "$script:PromptShelfInsertTimeout.Interval=100",
      "$script:PromptShelfInsertUncertainTimeout.Interval=250",
      "$script:PromptShelfInsertTimeout.Start()",
      "$clock.Restart()",
      "while($missingOperation.State -cne 'uncertain' -and $clock.ElapsedMilliseconds -lt 1500){[Windows.Forms.Application]::DoEvents();[Threading.Thread]::Sleep(10)}",
      "if($script:PromptShelfInsertOperation -ne $missingOperation -or $missingOperation.State -cne 'uncertain' -or $null -ne $missingOperation.Task -or $script:PromptShelfStatusCopyName -cne 'promptShelfInsertUncertain'){throw 'Missing acknowledgement did not become explicit uncertainty with the retry lock retained'}",
      "if($missingTask.IsCompleted){throw 'Timeout completed or retried the missing renderer task'}",
      "$lockedOperation=$script:PromptShelfInsertOperation",
      "Invoke-AuraPromptShelfInsert -Text 'retry must stay locked'",
      "if($script:PromptShelfInsertOperation -ne $lockedOperation){throw 'Insertion retried before composer acknowledgement'}",
      "Confirm-AuraPromptShelfComposerChecked",
      "if($null -ne $script:PromptShelfInsertOperation -or $script:PromptShelfStatusCopyName -cne 'promptShelfChecked'){throw 'Explicit composer acknowledgement did not release the retry lock'}",
      "$bad=[Threading.Tasks.TaskCompletionSource[string]]::new()",
      "$bad.SetResult('{}')",
      "$script:PromptShelfInsertOperation=[PSCustomObject][ordered]@{OperationId=('e'*32);PageEpoch=7;Target='https://claude.ai/chat/test';State='dispatching';Task=$bad.Task}",
      "Complete-AuraPromptShelfInsertTask",
      "if($script:PromptShelfInsertOperation.State -cne 'uncertain' -or $null -ne $script:PromptShelfInsertOperation.Task -or $script:PromptShelfStatusCopyName -cne 'promptShelfInsertUncertain'){throw 'Malformed result did not enter explicit uncertainty'}",
      "Confirm-AuraPromptShelfComposerChecked",
      "if($null -ne $script:PromptShelfInsertOperation -or $script:PromptShelfStatusCopyName -cne 'promptShelfChecked'){throw 'Composer acknowledgement did not release the retry lock'}",
      "if(-not ($script:events -contains 'Prompt Shelf event: insert-delayed') -or -not ($script:events -contains 'Prompt Shelf event: insert-acknowledgement-timeout') -or -not ($script:events -contains 'Prompt Shelf event: result-rejected')){throw 'Body-free delayed and uncertainty events were not recorded'}",
      "Dispose-AuraPromptShelf -Final",
    ].join("\n");
    run("powershell.exe", [
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-STA",
      "-EncodedCommand",
      Buffer.from(regression, "utf16le").toString("base64"),
    ]);
  } finally {
    await fs.rm(temporaryRoot, { recursive: true, force: true });
  }
});

test("Prompt Shelf uses a dedicated body-free WebView task result contract", async () => {
  const [shelf, ui, renderer] = await Promise.all([
    fs.readFile(shelfPath, "utf8"),
    fs.readFile(uiPath, "utf8"),
    fs.readFile(rendererPath, "utf8"),
  ]);
  const invoke = powershellFunction(shelf, "Invoke-AuraPromptShelfInsert");
  const complete = powershellFunction(shelf, "Complete-AuraPromptShelfInsertTask");
  const dispose = powershellFunction(shelf, "Dispose-AuraPromptShelf");
  const timeout = powershellFunction(shelf, "Ensure-AuraPromptShelfInsertTimeout");
  const uncertain = powershellFunction(shelf, "Set-AuraPromptShelfOperationUncertain");
  const template = insertionTemplate(shelf);

  assert.match(invoke, /New-AuraPromptShelfInsertionScript[\s\S]{0,100}?-Text \$Text/);
  assert.match(invoke,
    /\$script:PromptShelfInsertOperation\.Task\s*=\s*\(\s*\$script:WebView\.CoreWebView2\.ExecuteScriptAsync\(\$source\)\)/);
  assert.doesNotMatch(invoke,
    /PromptShelfInsertOperation\s*=\s*\[PSCustomObject\][\s\S]{0,400}?\b(?:Text|Body)\s*=/i,
    "The host operation record must not retain prompt bodies");
  assert.doesNotMatch(invoke, /Start-AuraUiScript|PostWebMessage|ScriptTask\b/,
    "Shelf insertion must not enter the theme task queue or a page message channel");
  assert.equal((invoke.match(/ExecuteScriptAsync\(/g) ?? []).length, 1,
    "Each explicit Insert action must dispatch exactly one renderer operation");
  assert.match(complete, /\$names\.Count -ne 7/);
  for (const field of [
    "operationId", "pageEpoch", "target", "inserted", "context", "reason", "certainty",
  ]) {
    assert.match(complete, new RegExp(`\\$names -cnotcontains '${field}'`));
  }
  assert.doesNotMatch(complete, /\$Text\b|\.text\b|message\.text\b/i,
    "Task completion must not receive or retain prompt bodies");
  assert.match(complete, /\$message\.operationId -cne \[string\]\$operation\.OperationId/);
  assert.match(complete, /\[long\]\$message\.pageEpoch -ne \[long\]\$operation\.PageEpoch/);
  assert.match(complete, /\[string\]\$message\.target -cne \[string\]\$operation\.Target/);
  assert.match(complete, /\$currentTarget -cne \[string\]\$operation\.Target/);
  assert.match(complete, /'new-chat', 'conversation', 'other'/);
  assert.match(complete,
    /'inserted', 'invalid-text', 'composer-unavailable', 'editor-readonly',[\s\S]{0,100}?'stale-target', 'insertion-failed', 'insertion-uncertain'/);
  assert.match(complete, /'certain', 'uncertain'/);
  assert.match(timeout, /\$script:PromptShelfInsertOperation\.State\s*=\s*'delayed'/);
  assert.match(timeout, /\$script:PromptShelfInsertUncertainTimeout\.Start\(\)/);
  assert.match(timeout,
    /PromptShelfInsertUncertainTimeout\.add_Tick\(\{[\s\S]{0,260}?Set-AuraPromptShelfOperationUncertain[\s\S]{0,120}?'insert-acknowledgement-timeout'/,
    "The bounded second timeout must convert a permanently delayed operation to uncertainty");
  assert.doesNotMatch(timeout, /PromptShelfInsertOperation\s*=\s*\$null|\.Task\s*=\s*\$null/,
    "Timeout must retain the task and retry lock until a result arrives");
  assert.match(uncertain, /\$operation\.State\s*=\s*'uncertain'[\s\S]{0,80}?\$operation\.Task\s*=\s*\$null/);
  assert.match(dispose, /if \(\$Final\) \{\s*\$script:PromptShelfInsertOperation\s*=\s*\$null/);
  assert.equal((dispose.match(/\$script:PromptShelfInsertOperation\s*=\s*\$null/g) ?? []).length, 1,
    "Only final app shutdown may release an in-flight operation");
  assert.doesNotMatch(dispose, /PromptShelfStatePath|Remove-Item/,
    "Original look must not delete saved drafts");
  assert.match(ui, /Complete-AuraPromptShelfInsertTask/);
  assert.match(renderer, /"discoverComposer": discoverComposer,/);
  assert.match(template,
    /const result = \(inserted, reason, certainty = "certain"\) => \(\{\s*operationId, pageEpoch, target, inserted, context, reason, certainty,\s*\}\)/,
    "Insertion result must contain the body-free correlation, target, outcome, and certainty");
  assert.doesNotMatch(template, /\btext\s*:/,
    "Insertion result must never echo a prompt body to the host");
});

test("Prompt Shelf has no automatic insertion retry, clipboard, polling, or prompt logging path", async () => {
  const [shelf, studioApp] = await Promise.all([
    fs.readFile(shelfPath, "utf8"),
    fs.readFile(studioAppPath, "utf8"),
  ]);
  const template = insertionTemplate(shelf);
  const timeout = powershellFunction(shelf, "Ensure-AuraPromptShelfInsertTimeout");
  const eventWriter = powershellFunction(shelf, "Write-AuraPromptShelfEvent");
  const retryHandler = studioApp.match(
    /promptShelfRetryAction\.addEventListener\("click",[\s\S]*?\n\s*\}\);/,
  )?.[0] ?? "";

  for (const forbidden of [
    /\brequestSubmit\b/,
    /\.submit\s*\(/,
    /\bKeyboardEvent\b/,
    /\b(?:Enter|NumpadEnter|SendKeys)\b/,
    /\b(?:navigator\.)?clipboard\b/i,
    /\bsetInterval\b/,
    /\bsetTimeout\b/,
    /\bMutationObserver\b/,
    /\bfetch\s*\(/,
    /\bXMLHttpRequest\b/,
  ]) {
    assert.doesNotMatch(template, forbidden,
      `Renderer insertion gained a forbidden send, keyboard, clipboard, or polling path: ${forbidden}`);
  }
  assert.doesNotMatch(timeout, /Invoke-AuraPromptShelfInsert|ExecuteScriptAsync/,
    "Neither acknowledgement timeout may retry renderer insertion");
  assert.match(studioApp,
    /promptShelf\.pending\.recoveryVisible = action !== "insert"/,
    "Studio must not expose its transport retry for an unacknowledged insertion");
  assert.match(retryHandler, /pending\.action === "insert"\) return/,
    "Studio transport recovery must refuse to replay an insertion envelope");
  assert.equal((shelf.match(/Write-AuraUiLog/g) ?? []).length, 1,
    "Prompt Shelf must have one body-free event logging boundary");
  assert.match(eventWriter, /param\(\[Parameter\(Mandatory = \$true\)\]\[string\]\$Code\)/);
  assert.doesNotMatch(eventWriter, /\$(?:Text|Body|Items?)\b/i,
    "Prompt Shelf event logging must not accept prompt bodies");
});

runIfMain(import.meta.url);
