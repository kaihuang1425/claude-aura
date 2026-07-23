// studio-editor tests. Extracted from the former monolithic tests/run-tests.mjs.
import { test, runIfMain } from "./support/harness.mjs";
import {
  AURA_VERSION,
  DEFAULT_CONFIG,
  PROJECT_ROOT,
  REQUIRED_SEMANTIC_TOKENS,
  STUDIO_FONT_DISPLAY_STACKS,
  STUDIO_FONT_UI_STACKS,
  STUDIO_MAX_LAYERS,
  STUDIO_PREVIEW_MASTERS,
  STUDIO_SHADOWS,
  STUDIO_THEME_SCHEMA_VERSION,
  studioStyleFromTheme,
  THEME_IDS,
  assert,
  buildAuraIcon,
  buildLauncherAssets,
  buildPayload,
  buildPayloadFromCompiled,
  compileTheme,
  contrast,
  crypto,
  deliverableFiles,
  executeStudioRequest,
  fs,
  hslToRgb,
  hydrateStudioDraft,
  listThemes,
  luminance,
  normalizeLocale,
  os,
  path,
  readPayloadSettings,
  readThemeKit,
  readThemeRegistry,
  resolveArtwork,
  run,
  spawnSync,
  validateTheme,
  writeConfig,
  zipEntryNames,
} from "./support/context.mjs";
test("Windows uses a content-only WebView2 window with Aura Studio and tray controls", async () => {
  const start = await fs.readFile(path.join(PROJECT_ROOT, "windows", "start.ps1"), "utf8");
  const ui = await fs.readFile(path.join(PROJECT_ROOT, "windows", "aura-ui.ps1"), "utf8");
  const powershellFunction = (name) => {
    const startIndex = ui.indexOf(`function ${name}`);
    assert(startIndex >= 0, `Aura UI is missing ${name}`);
    const endIndex = ui.indexOf("\nfunction ", startIndex + 1);
    return ui.slice(startIndex, endIndex < 0 ? ui.length : endIndex);
  };
  const install = await fs.readFile(path.join(PROJECT_ROOT, "windows", "install.ps1"), "utf8");
  const uninstall = await fs.readFile(path.join(PROJECT_ROOT, "windows", "uninstall.ps1"), "utf8");
  const common = await fs.readFile(path.join(PROJECT_ROOT, "windows", "common.ps1"), "utf8");
  const studioApp = await fs.readFile(path.join(PROJECT_ROOT, "studio", "app.js"), "utf8");
  const studioEditor = await fs.readFile(path.join(PROJECT_ROOT, "studio", "editor.js"), "utf8");
  const studioEditorCss = await fs.readFile(path.join(PROJECT_ROOT, "studio", "editor.css"), "utf8");
  const studioCss = await fs.readFile(path.join(PROJECT_ROOT, "studio", "styles.css"), "utf8");
  const studioHtml = await fs.readFile(path.join(PROJECT_ROOT, "studio", "index.html"), "utf8");
  const studioGenerated = await fs.readFile(path.join(PROJECT_ROOT, "studio", "generated-themes.js"), "utf8");
  const studioCore = await fs.readFile(path.join(PROJECT_ROOT, "scripts", "theme-core", "studio.mjs"), "utf8");
  const baseCss = await fs.readFile(path.join(PROJECT_ROOT, "assets", "base.css"), "utf8");
  assert.match(studioHtml, /^<!doctype html>/i,
    "Studio must use standards mode so its full-height grid tracks the WebView client area");
  assert.match(studioCss, /\[hidden\]\s*\{\s*display:\s*none\s*!important\s*;/,
    "Studio author display rules must never override the native hidden state");
  const unsavedWorkSource = studioEditor.match(
    /const hasUnsavedEditorWork = \(work\) => Boolean\([\s\S]*?\n  \);/,
  )?.[0];
  assert(unsavedWorkSource, "Studio must centralize the complete unsaved-work predicate");
  const hasUnsavedEditorWork = Function(`${unsavedWorkSource}; return hasUnsavedEditorWork;`)();
  const settledWork = {
    dirty: false,
    deferred: 0,
    coalesced: 0,
    debounce: null,
    inFlight: 0,
    stageKeys: 0,
    stageKeyDebounce: null,
  };
  assert.equal(hasUnsavedEditorWork(settledWork), false,
    "A fully settled clean draft must report Saved");
  for (const key of Object.keys(settledWork)) {
    assert.equal(hasUnsavedEditorWork({ ...settledWork, [key]: 1 }), true,
      `${key} work must keep the persistent status Unsaved`);
  }
  assert.match(studioEditor,
    /const reflectButtonStates = \(\) => \{\s*if \(!state\) return;\s*reflectDirtyState\(\);/,
    "Every queue-state refresh must update the persistent Saved/Unsaved status");
  assert.match(start, /\$auraArguments\s*=\s*@\{\s*Mode\s*=\s*['"]Open['"]\s*\}/,
    "The launch wrapper must use named hashtable splatting for Aura host parameters");
  assert.match(start, /aura-ui\.ps1['"]\)\s+@auraArguments/,
    "The launch wrapper must not pass parameter-name strings positionally");
  assert(!start.includes("@arguments"), "The launch wrapper must not array-splat named parameters");
  const assetConverter = await fs.readFile(path.join(PROJECT_ROOT, "scripts", "convert-theme-assets.mjs"), "utf8");
  const uiCopy = JSON.parse(await fs.readFile(path.join(PROJECT_ROOT, "windows", "ui-copy.json"), "utf8"));
  for (const [name, source] of [["start", start], ["UI", ui], ["installer", install]]) {
    assert(!/remote-debugging-(?:port|pipe)/i.test(source), `${name} still launches a debugging endpoint`);
    assert(!/45\s+seconds/i.test(source), `${name} still contains the old startup wait`);
  }
  assert.match(start, /aura-ui\.ps1/);
  assert.match(ui, /CoreWebView2Environment/);
  assert.match(ui, /ExecuteScriptAsync/);
  assert.match(ui, /--locale/);
  assert.match(ui, /CurrentUICulture/);
  assert.match(ui, /AccessibleName/);
  for (const removedMainWindowMarker of [
    "ThemeGalleryForm",
    "ThemeOptionButtons",
    "New-AuraToolbarButton",
    "$script:Toolbar",
    "Set-AuraUiTitleBarPalette",
    "Get-AuraUiThemePalette",
    "DwmSetWindowAttribute",
  ]) {
    assert(!ui.includes(removedMainWindowMarker),
      `The removed main-window gallery/palette plumbing still contains ${removedMainWindowMarker}`);
  }
  const mainFormControlAdds = [...ui.matchAll(/\$script:Form\.Controls\.Add\s*\(\s*(\$[\w:]+)\s*\)/g)]
    .map((match) => match[1]);
  assert.match(ui, /\$content\s*=\s*\[System\.Windows\.Forms\.Panel\]::new\(\)/,
    "The main form's sole child must be a content panel");
  assert.deepEqual(mainFormControlAdds, ["$content"],
    "The main form must still receive only the Claude content panel");
  assert(!/\$script:Form\.Controls\.AddRange\s*\(/.test(ui),
    "The main form must not receive controls through an unverified AddRange call");
  const contentControlAdds = [...ui.matchAll(/\$content\.Controls\.Add\s*\(\s*(\$script:[A-Za-z0-9]+)\s*\)/g)]
    .map((match) => match[1]);
  assert.deepEqual(contentControlAdds, ["$script:WebView", "$script:LoadingPanel"],
    "The Claude content panel must contain only the Claude WebView and loading panel");
  assert(!/\$content\.Controls\.AddRange\s*\(/.test(ui),
    "The content panel must not receive controls through an unverified AddRange call");
  // The Aura launcher is a separate owned overlay window, not chrome inside the
  // Claude content. It floats over the WebView (top-level windows escape the
  // windowed-WebView2 airspace limit), reserves no layout space, never reflows
  // the page, and keeps the main window content-only while still giving Studio a
  // discoverable in-window entry alongside the tray and keyboard accelerators.
  assert.match(ui, /\$script:Launcher\s*=\s*\[System\.Windows\.Forms\.Form\]::new\(\)/,
    "The Aura launcher must be its own top-level overlay window, not chrome inside the Claude content");
  assert.match(ui, /\$script:Launcher\.FormBorderStyle\s*=\s*\[System\.Windows\.Forms\.FormBorderStyle\]::None/,
    "The launcher must be a borderless floating control");
  assert.match(ui, /\$script:Launcher\.Show\(\s*\$script:Form\s*\)/,
    "The launcher must be shown as an owned window so it tracks the main window's minimize/restore and z-order");
  assert.match(ui, /\$script:LauncherButton\.add_MouseMove/,
    "The launcher must be draggable");
  assert.match(ui, /\$wasClickArmed\s*\)\s*\{\s*Show-AuraUiStudio/,
    "A left click that was not a drag must open Aura Studio");
  assert.match(ui, /\$dragThreshold = ConvertTo-AuraUiLauncherPixels -Logical 6[\s\S]{0,500}?Get-AuraUiLauncherClampedLocation/,
    "A DPI-scaled movement threshold must separate dragging the launcher from clicking it");
  assert.match(ui, /LauncherSafeGap\s*=\s*16/,
    "The floating launcher must retain a safe inset from the Aura window edges");
  assert.match(ui, /Update-AuraUiLauncherStyle/,
    "Theme changes must reapply the launcher material and mark");
  assert.match(ui, /Save-AuraUiLauncherPosition/,
    "Dragging the launcher must persist its position");
  assert.match(ui, /\$script:LauncherCompactSize\s*=\s*48/,
    "The launcher circle must remain 48 logical px");
  assert.match(ui,
    /\$script:LauncherButton\.Bounds\s*=\s*\[Drawing\.Rectangle\]::new\(\s*\$launcherMetrics\.Halo,\s*\$launcherMetrics\.Halo,\s*\$launcherMetrics\.Compact,\s*\$launcherMetrics\.Compact\)/,
    "The visible circle must remain the launcher hit surface, inset by its transparent halo");
  assert.match(ui,
    /function New-AuraUiLauncherRegion[\s\S]{0,700}?\$metrics\.Halo,\s*\$metrics\.Halo,\s*\$metrics\.Compact,\s*\$metrics\.Compact/,
    "The classic fallback region must clip the same halo-inset circle the layered surface paints");
  // The launcher composites through UpdateLayeredWindow so its circular edge
  // antialiases and its shadow/hover growth live in a transparent halo; the
  // 1-bit region path must survive as an automatic fallback, never the default.
  assert.match(ui, /UpdateLayeredWindow/,
    "The launcher must present per-pixel alpha frames, not only a 1-bit region");
  assert.match(ui, /function Update-AuraUiLauncherSurface[\s\S]{0,400}?LauncherLayeredActive/,
    "Launcher rendering must route through the layered surface pipeline");
  assert.match(ui, /function Disable-AuraUiLauncherLayering[\s\S]{0,600}?Update-AuraUiLauncherRegion/,
    "A layered-composition failure must degrade to the classic region look");
  assert.match(ui, /\$script:LauncherAnimTimer\.Interval\s*=\s*15/,
    "The hover microinteraction must animate on a UI timer, not jump states");
  // The hover caption is its own non-activating window; the old expanding hover
  // bar (Set-AuraUiLauncherExpanded) stays removed, which the AST regression
  // below enforces separately.
  assert.match(ui, /function Show-AuraUiLauncherTip[\s\S]{0,3200}?ShowWindow\(\$script:LauncherTip\.Handle,\s*8\)/,
    "The hover tip must appear via SW_SHOWNA without stealing activation");
  assert.match(ui, /launcherTipTitle/,
    "The hover tip must carry the localized Aura Studio caption");
  // The launch hint is a real-control card: closable for the session, or
  // permanently dismissed through its marker file.
  assert.match(ui, /function Show-AuraUiLauncherHint[\s\S]{0,800}?launcher-hint-dismissed/,
    "The launch hint must honor its dismissal marker before showing");
  assert.match(ui, /launcherHintDismiss/,
    "The launch hint must offer a never-show-again action");
  assert(!ui.includes("Show-AuraUiFirstRunNavHint"),
    "The tray balloon hint is replaced by the launcher hint card");
  assert.match(ui, /add_AcceleratorKeyPressed/,
    "A keyboard accelerator must provide a second route to Studio");
  assert.match(ui, /SetCurrentProcessExplicitAppUserModelID\(\s*'ClaudeAura'\s*\)/,
    "The process must claim a stable taskbar identity rather than the generic PowerShell host");
  assert.match(ui, /function Register-AuraUiJumpList[\s\S]{0,900}?System\.Windows\.Shell\.JumpList/,
    "The taskbar Jump List must use the managed WPF JumpList, never hand-written COM interop");
  assert.match(ui, /function Register-AuraUiJumpList[\s\S]{0,900}?-OpenStudio/,
    "The Jump List task must open Studio through the single-instance signal");
  assert.match(ui,
    /\$script:LoadingPanel\.Controls\.AddRange\s*\(\s*@\([\s\S]{0,240}?\$script:RetryButton[\s\S]{0,120}?\)\s*\)/,
    "The retry control must remain inside the loading panel");
  assert.match(ui, /\$script:RetryButton\.add_Click\(\s*\{/,
    "The loading-panel retry control must remain wired");
  assert.match(ui, /Get-AuraUiCopy/);
  assert.match(ui, /ui-copy\.json/);
  assert.match(ui, /\$script:StudioForm\.Text\s*=\s*"\$\(\$script:UiCopy\.studioTitle\)"/,
    "The Studio window title must come from localized UI copy");
  assert.match(ui,
    /SetVirtualHostNameToFolderMapping\(\s*['"]aura\.studio['"]\s*,[\s\S]{0,300}?CoreWebView2HostResourceAccessKind\]::Allow\s*\)/,
    "Studio must use the allowlisted aura.studio virtual host mapping");
  assert.match(ui,
    /SetVirtualHostNameToFolderMapping\(\s*['"]aura\.assets['"]\s*,\s*\$ThemeArtRoot\s*,[\s\S]{0,160}?CoreWebView2HostResourceAccessKind\]::Allow\s*\)/,
    "Studio selector artwork must use its own local virtual host mapping");
  assert.match(ui,
    /SetVirtualHostNameToFolderMapping\(\s*['"]aura\.background['"]\s*,\s*\$StudioBackgroundRoot\s*,[\s\S]{0,160}?CoreWebView2HostResourceAccessKind\]::Allow\s*\)/,
    "Studio background previews must come from the isolated app-data folder");
  assert.match(ui,
    /SetVirtualHostNameToFolderMapping\(\s*['"]aura\.editor['"]\s*,\s*\$StudioEditorPreviewRoot\s*,[\s\S]{0,160}?CoreWebView2HostResourceAccessKind\]::Allow\s*\)/,
    "Editor previews must come only from the app-owned preview folder");
  assert.match(ui, /function Assert-AuraUiStudioEditorRoots[\s\S]{0,2300}?ReparsePoint/,
    "Editor storage must reject symbolic links and junctions before any draft write");
  assert.match(ui,
    /function Invoke-AuraUiStudioEditorCore[\s\S]{0,400}?Assert-AuraUiStudioEditorRoots -Create[\s\S]{0,160}?Assert-AuraUiThemeInstallRoot -Create/,
    "Every Studio editor request must reject a redirected installed-theme root before invoking Node");
  assert.match(ui,
    /function Get-AuraUiStudioEditorCoreState[\s\S]{0,500}?['"]studio-state['"][\s\S]{0,220}?ConvertFrom-AuraUiStudioEditorResponse/,
    "Studio restart hydration must use the same validated core response boundary as editor actions");
  assert.match(ui,
    /['"]get-state['"]\s*\{[\s\S]{0,160}?Sync-AuraUiStudioEditorDraft[\s\S]{0,120}?Send-AuraUiStudioState/,
    "Studio get-state must hydrate a persisted draft before posting canonical editor state");
  const startupDraftHydrationIndex = ui.lastIndexOf("[void](Sync-AuraUiStudioEditorDraft)");
  const startupWinFormsIndex = ui.indexOf("Add-Type -AssemblyName System.Windows.Forms", startupDraftHydrationIndex);
  assert(startupDraftHydrationIndex >= 0 && startupWinFormsIndex > startupDraftHydrationIndex,
    "Aura startup must restore the draft payload before creating its WebView");
  const beginThemeEditFunction = ui.match(/function Invoke-AuraUiBeginThemeEdit\s*\{([\s\S]*?)\n\}/)?.[1] ?? "";
  assert.match(beginThemeEditFunction,
    /if \(\$active\)[\s\S]*?\$Request\.reset[\s\S]*?\$activeId[\s\S]*?else\s*\{[\s\S]*?Get-AuraUiStudioKnownTheme[^\n]*-UserOnly/,
    "Resetting an active unsaved duplicate must not require the copy to be installed first");
  assert.match(ui, /\$StudioEditorRoot\s*=\s*Join-Path\s+\$DataRoot\s+['"]theme-drafts['"]/,
    "Editor drafts must stay below Claude Aura app data");
  assert.match(ui,
    /Assert-AuraUiStudioEditorPublicValue[\s\S]{0,2400}?\$propertyName\s+-cin\s+@\(['"]path['"][\s\S]{0,180}?cannot expose a filesystem property/,
    "Editor state must reject filesystem-bearing private fields before posting to the page");
  assert(ui.includes("$text -cnotmatch '^https://aura\\.editor/active/layer-[a-f0-9]{32}\\.webp\\?v=[a-f0-9]{64}$'"),
    "Editor state must allow only opaque, digest-versioned preview URLs");
  assert.match(ui,
    /function Get-AuraUiStudioUrl[\s\S]{0,420}?https:\/\/aura\.studio\/index\.html\?locale=\{0\}[\s\S]{0,180}?EscapeDataString\(\$script:Locale\)/,
    "Studio must build its URL from the exact offline host and an encoded host-owned locale");
  assert.match(ui, /\.Navigate\(\(Get-AuraUiStudioUrl\)\)/,
    "Studio must navigate only through the validated local URL builder");
  const studioCoreIndex = ui.indexOf("$studioCore = $script:StudioWebView.CoreWebView2");
  const studioAppearanceIndex = ui.indexOf("Set-AuraUiPreferredColorScheme", studioCoreIndex);
  const studioNavigateIndex = ui.indexOf("$studioCore.Navigate((Get-AuraUiStudioUrl))", studioCoreIndex);
  assert(studioCoreIndex >= 0 && studioAppearanceIndex > studioCoreIndex && studioAppearanceIndex < studioNavigateIndex,
    "Studio must apply the WebView2 color preference before its first navigation");
  const mainCoreIndex = ui.indexOf("$core = $script:WebView.CoreWebView2");
  const mainAppearanceIndex = ui.indexOf("Set-AuraUiPreferredColorScheme", mainCoreIndex);
  const mainNavigateIndex = ui.indexOf("$core.Navigate('https://claude.ai/')", mainCoreIndex);
  assert(mainCoreIndex >= 0 && mainAppearanceIndex > mainCoreIndex && mainAppearanceIndex < mainNavigateIndex,
    "Aura must apply the WebView2 color preference before claude.ai navigation");
  assert.match(ui, /\.add_WebMessageReceived\(\s*\{/);
  assert.match(ui, /PostWebMessageAsJson\s*\(/);
  assert.match(ui, /\[switch\]\$OpenStudio/,
    "The Aura host must expose the Studio-only launch switch");
  assert.match(ui,
    /\$script:StudioOpenSignal\s*=\s*\[System\.Threading\.EventWaitHandle\]::new\([\s\S]{0,180}?\[System\.Threading\.EventResetMode\]::AutoReset[\s\S]{0,180}?"Local\\ClaudeAura\.\$sid\.OpenStudio"/,
    "Studio launch signaling must be a per-user AutoReset event");
  const existingInstanceIndex = ui.indexOf("if (-not $createdNew)");
  const existingStudioBranchIndex = ui.indexOf("if ($OpenStudio)", existingInstanceIndex);
  const existingSignalIndex = ui.indexOf("[void]$script:StudioOpenSignal.Set()", existingStudioBranchIndex);
  const existingReturnIndex = ui.indexOf("return", existingSignalIndex);
  assert(existingInstanceIndex >= 0 && existingStudioBranchIndex > existingInstanceIndex
      && existingSignalIndex > existingStudioBranchIndex && existingReturnIndex > existingSignalIndex,
    "-OpenStudio must signal the already-running Aura instance before the second process returns");
  assert.match(ui,
    /if \(\$OpenStudio\) \{ \[void\]\$script:StudioOpenSignal\.Set\(\) \}/,
    "A first Aura instance launched with -OpenStudio must queue Studio opening");
  assert.match(ui,
    /\$script:StudioOpenSignal\.WaitOne\(0\)[\s\S]{0,100}?Show-AuraUiStudio/,
    "The UI loop must consume the Studio-open signal without blocking");
  assert.match(ui,
    /function Show-AuraUiStudio[\s\S]{0,800}?\.Activate\(\)[\s\S]{0,120}?\.BringToFront\(\)/,
    "A signaled Studio window must be restored and foregrounded");
  assert.match(ui, /\$script:StudioOpenSignal\.Dispose\(\)/,
    "The named Studio signal must be disposed during shutdown");

  const expectedStudioMessageTypes = [
    "get-state",
    "set-theme",
    "set-appearance",
    "set-locale",
    "complete-studio-introduction",
    "set-image",
    "clear-image",
    "set-image-framing",
    "set-card-preview-crop",
    "set-enabled",
    "open-aura",
    "open-desktop",
    "import-theme",
    "create-theme-copy",
    "begin-theme-edit",
    "set-theme-token",
    "set-theme-layer",
    "apply-theme-patch",
    "pick-theme-layer-image",
    "pick-theme-launcher-mark",
    "remove-theme-layer",
    "move-theme-layer",
    "undo-theme-edit",
    "redo-theme-edit",
    "save-theme-edit",
    "discard-theme-edit",
    "delete-user-theme",
    "set-aura-preview",
    "set-aura-topmost",
    "refresh-aura-mirror",
  ];
  const studioMessageTypesMatch = ui.match(/\$script:StudioMessageTypes\s*=\s*@\(([\s\S]*?)\)/);
  assert(studioMessageTypesMatch, "The Studio host message allowlist is missing");
  const studioMessageTypes = [...studioMessageTypesMatch[1].matchAll(/['"]([^'"]+)['"]/g)]
    .map((match) => match[1]);
  assert.deepEqual(studioMessageTypes, expectedStudioMessageTypes,
    "Studio must expose only the user-approved host actions");
  const studioPageMessageTypesMatch = studioApp.match(
    /const STUDIO_PAGE_MESSAGE_TYPES = Object\.freeze\(\[([\s\S]*?)\]\)/);
  assert(studioPageMessageTypesMatch, "The Studio page message allowlist is missing");
  const studioPageMessageTypes = [...studioPageMessageTypesMatch[1].matchAll(/["']([^"']+)["']/g)]
    .map((match) => match[1]);
  assert.deepEqual(studioPageMessageTypes, expectedStudioMessageTypes,
    "The Studio page and host must allow the same exact action set");
  const expectedPropertiesMatch = ui.match(/\$expectedProperties\s*=\s*@\(switch -CaseSensitive \(\$type\) \{([\s\S]*?)\}\)/);
  assert(expectedPropertiesMatch, "Studio exact message-shape switch is missing");
  assert.match(expectedPropertiesMatch[1], /default\s*\{\s*['"]type['"];\s*break\s*\}/,
    "Type-only Studio actions must reject every extra property");
  assert(!expectedPropertiesMatch[1].includes("'open-aura'"),
    "open-aura must use the exact type-only message shape");
  const localeShape = expectedPropertiesMatch[1].match(/'set-locale'\s*\{([^}]*)\}/);
  assert(localeShape, "Studio exact message-shape switch is missing set-locale");
  assert.deepEqual([...localeShape[1].matchAll(/['"]([^'"]+)['"]/g)].map((match) => match[1]), ["type", "locale"],
    "set-locale must accept only its exact locale property");
  assert(!expectedPropertiesMatch[1].includes("'complete-studio-introduction'"),
    "complete-studio-introduction must retain the default type-only message shape");
  const expectedEditorMessageShapes = {
    "create-theme-copy": ["type", "theme"],
    "begin-theme-edit": ["type", "theme", "reset"],
    "set-theme-token": ["type", "session", "revision", "mode", "token", "value"],
    "set-theme-layer": ["type", "session", "revision", "index", "preset", "property", "value"],
    "apply-theme-patch": ["type", "session", "revision", "changes"],
    "pick-theme-layer-image": ["type", "session", "revision", "index", "role", "appearance", "context"],
    "pick-theme-launcher-mark": ["type", "session", "revision"],
    "remove-theme-layer": ["type", "session", "revision", "index"],
    "move-theme-layer": ["type", "session", "revision", "index", "direction"],
    "undo-theme-edit": ["type", "session", "revision"],
    "redo-theme-edit": ["type", "session", "revision"],
    "save-theme-edit": ["type", "session", "revision"],
    "discard-theme-edit": ["type", "session", "revision"],
    "delete-user-theme": ["type", "theme"],
  };
  for (const [action, expectedShape] of Object.entries(expectedEditorMessageShapes)) {
    const escapedAction = action.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const shapeMatch = expectedPropertiesMatch[1].match(new RegExp(`'${escapedAction}'\\s*\\{([^}]*)\\}`));
    assert(shapeMatch, `Studio exact message-shape switch is missing ${action}`);
    assert.deepEqual([...shapeMatch[1].matchAll(/['"]([^'"]+)['"]/g)].map((match) => match[1]), expectedShape,
      `${action} accepts missing, reordered, or extra page properties`);
  }
  const patchValidation = ui.match(/'apply-theme-patch'\s*\{([\s\S]*?)\n\s*'pick-theme-layer-image'\s*\{/)?.[1] ?? "";
  assert.match(patchValidation, /\$Message\.changes\s+-isnot\s+\[System\.Array\]/,
    "Theme patches must require a JSON array instead of coercing a scalar change");
  assert.match(patchValidation, /\$changes\.Count\s+-lt\s+1\s+-or\s+\$changes\.Count\s+-gt\s+16/,
    "Theme patches must contain between one and sixteen changes");
  for (const [kind, exactProperties] of Object.entries({
    token: ["kind", "mode", "token", "value"],
    layer: ["kind", "index", "preset", "property", "value"],
    metadata: ["kind", "field", "locale", "value"],
  })) {
    const kindBlock = patchValidation.match(new RegExp(`'${kind}'\\s*\\{([\\s\\S]*?)(?=\\n\\s*'|\\n\\s*default)`))?.[1] ?? "";
    for (const property of exactProperties) {
      assert(kindBlock.includes(`'${property}'`), `Theme ${kind} patches do not require ${property}`);
    }
  }
  assert.match(patchValidation, /\$change\.field\s+-cnotin\s+@\('label',\s*'description'\)/,
    "Metadata patches must expose only localized names and descriptions");
  assert.match(patchValidation, /\$change\.locale\s+-cnotin\s+@\('en',\s*'zh-CN',\s*'zh-TW'\)/,
    "Metadata patches must use exactly the three supported locales");
  assert.match(patchValidation, /\$maximum\s*=\s*if\s*\(\$change\.field\s+-ceq\s*'label'\)\s*\{\s*80\s*\}\s*else\s*\{\s*220\s*\}/,
    "Metadata patch limits must match the theme-kit label and description contracts");
  const corePatchBlock = studioCore.match(/export async function applyThemePatch\([\s\S]*?\n\}/)?.[0] ?? "";
  assert.equal((corePatchBlock.match(/mutateStudio\(/g) ?? []).length, 1,
    "A bounded patch must create exactly one history entry and compile exactly once");
  assert.match(corePatchBlock, /for\s*\(const change of context\.changes\)/,
    "One atomic patch must apply every validated scalar change to the same candidate document");
  assert.match(ui, /'open-aura'\s*\{\s*Show-AuraUiMain;\s*break\s*\}/,
    "The open-aura host action must only foreground the Aura window");
  const previewShape = expectedPropertiesMatch[1].match(/'set-aura-preview'\s*\{([^}]*)\}/);
  assert(previewShape, "Studio exact message-shape switch is missing set-aura-preview");
  assert.deepEqual([...previewShape[1].matchAll(/['"]([^'"]+)['"]/g)].map((match) => match[1]), ["type", "size", "request"],
    "set-aura-preview accepts missing, reordered, or extra page properties");
  assert.match(ui, /\$message\.size\s+-isnot\s+\[string\]/,
    "Aura preview size messages must carry a string");
  assert.match(ui, /Aura preview request[\s\S]{0,120}?-Minimum\s+1\s+-Maximum\s+2147483647|ConvertTo-AuraUiStudioInteger[\s\S]{0,180}?Aura preview request/,
    "Aura preview messages must carry a bounded request acknowledgement id");
  assert.match(ui, /function Set-AuraUiPreviewSize[\s\S]{0,600}?-cnotin\s+@\('launch',\s*'wide',\s*'full'\)/,
    "Aura preview sizes must be strictly allowlisted");
  assert.match(ui, /function Set-AuraUiPreviewSize[\s\S]{0,240}?\^\(\\d\{3,4\}\)x\(\\d\{3,4\}\)\$/,
    "Custom preview dimensions must be pattern-checked before use");
  assert.match(ui, /\$customWidth -lt 920 -or \$customWidth -gt 3840 -or \$customHeight -lt 620 -or \$customHeight -gt 2400/,
    "Custom preview dimensions must be bounded");
  assert.match(ui, /function Set-AuraUiPreviewSize[\s\S]{0,1400}?Maximized/,
    "The preview action must drive the real, resizable Aura window");
  const previewSizeFunction = ui.match(/function Set-AuraUiPreviewSize\s*\{[\s\S]*?\n\}/)?.[0] ?? "";
  assert(!/Show-AuraUiMain(?:\s|$)/.test(previewSizeFunction),
    "Preview-size changes must not use the foregrounding open-Aura path");
  assert(!/\$script:Form\.(?:Activate|BringToFront)\(\)/.test(previewSizeFunction),
    "Preview-size changes must not focus or foreground the Aura form");
  assert.match(previewSizeFunction, /Restore-AuraUiStudioFocus/,
    "Preview-size changes must repair focus only if resizing displaced Studio");
  const restoreStudioFocus = ui.match(/function Restore-AuraUiStudioFocus\s*\{[\s\S]*?\n\}/)?.[0] ?? "";
  assert.match(restoreStudioFocus, /\$PreviousForeground\s+-ne\s+\$script:StudioForm\.Handle[\s\S]{0,40}?return/,
    "Preview resizing must not foreground Studio when another app was active first");
  assert.match(restoreStudioFocus, /\$currentForeground\s+-ne\s+\$script:Form\.Handle[\s\S]{0,80}?return/,
    "Preview resizing must not reclaim focus after the user switches to an unrelated window");
  assert.match(ui, /function Show-AuraUiMainForPreview[\s\S]{0,500}?ShowWindow\(\$script:Form\.Handle,\s*4\)/,
    "A hidden or minimized preview window must use non-activating restore");
  assert.match(studioEditor, /type:\s*"set-aura-preview",\s*size/,
    "Studio must request real-window preview sizes through the validated bridge");
  const topmostShape = expectedPropertiesMatch[1].match(/'set-aura-topmost'\s*\{([^}]*)\}/);
  assert(topmostShape, "Studio exact message-shape switch is missing set-aura-topmost");
  assert.deepEqual([...topmostShape[1].matchAll(/['"]([^'"]+)['"]/g)].map((match) => match[1]), ["type", "enabled"],
    "set-aura-topmost accepts missing, reordered, or extra page properties");
  assert(!expectedPropertiesMatch[1].includes("'refresh-aura-mirror'"),
    "refresh-aura-mirror must use the exact type-only message shape");
  assert.match(ui, /CapturePreviewAsync\(\s*\[Microsoft\.Web\.WebView2\.Core\.CoreWebView2CapturePreviewImageFormat\]::Jpeg/,
    "The Studio mirror must capture the actual Aura WebView through CapturePreviewAsync");
  assert.match(ui, /\$script:MirrorStream = \[IO\.MemoryStream\]::new\(\)/,
    "Mirror captures must stay in memory, never on disk");
  assert.match(ui, /function Update-AuraUiMirror[\s\S]{0,240}?IsCompleted/,
    "The mirror pump must poll capture tasks without blocking the UI thread");
  assert.match(ui, /data-claude-aura-main-canvas[\s\S]{0,240}?data-claude-aura-prompt/,
    "The mirror probe must read the renderer's marked live layout");
  assert.match(ui,
    /claudeAuraViewport[\s\S]{0,180}?viewport === "normal" \|\| viewport === "wide" \? viewport : null/,
    "The mirror probe must carry the renderer's effective normal/wide viewport without inferring it from width");
  assert.match(ui, /\$script:MirrorProbeTask = \$script:WebView\.CoreWebView2\.ExecuteScriptAsync\(\$probe\)/,
    "Mirror geometry must come from a non-blocking layout probe of the live page");
  assert.match(ui, /\$core\.add_SourceChanged\(\{\s*Request-AuraUiContextMirror\s*}\)/,
    "Aura source changes must refresh the active editor's private mirror");
  assert.match(ui, /\$core\.add_HistoryChanged\(\{\s*Request-AuraUiContextMirror\s*}\)/,
    "Aura SPA history changes must refresh the active editor's private mirror");
  assert.match(ui,
    /function Request-AuraUiContextMirror[\s\S]{0,420}?MirrorSemanticRetries\s*=\s*3[\s\S]{0,120}?MirrorSemanticPreviousContext/,
    "Context navigation must start a bounded semantic-settle check");
  assert.match(ui,
    /\$semanticUnsettled[\s\S]{0,320}?MirrorSemanticRetries\s+-gt\s+0[\s\S]{0,180}?MirrorDue\s*=\s*\[DateTime\]::UtcNow\.AddMilliseconds\(250\)/,
    "A context probe must retry briefly while Claude's semantic marker is unsettled");
  assert.match(studioEditor, /type:\s*"set-appearance",\s*appearance/,
    "Editor light\/dark switching must drive the real window's appearance");
  assert.match(studioApp, /data\.type === "aura-mirror"[\s\S]{0,120}?receiveMirror/,
    "The Studio bridge listener must route mirror frames to the editor controller");
  assert.match(studioEditor, /data:image\/jpeg;base64,/,
    "The editor must accept only in-memory JPEG data URLs as mirror frames");
  const hostMirrorLimit = ui.match(/\$StudioMirrorJpegMaxBytes\s*=\s*(\d+)/);
  const studioMirrorLimit = studioEditor.match(/MIRROR_MAX_RAW_BYTES\s*=\s*([\d_]+)/);
  assert(hostMirrorLimit && studioMirrorLimit, "Mirror raw-byte limits must be explicit on both bridge sides");
  assert.equal(Number(hostMirrorLimit[1]), Number(studioMirrorLimit[1].replaceAll("_", "")),
    "The host and Studio must enforce the same decoded mirror-byte limit");
  assert.equal(Number(hostMirrorLimit[1]), 8_000_000,
    "The agreed mirror limit must remain eight million decoded JPEG bytes");
  assert.match(ui, /\$stream\.Length\s+-gt\s+0\s+-and\s+\$stream\.Length\s+-le\s+\$StudioMirrorJpegMaxBytes/,
    "The host must enforce its mirror-byte constant before Base64 encoding");
  assert.match(ui,
    /function Request-AuraUiMirror\s*\{[\s\S]{0,520}?StudioEditorState[\s\S]{0,160}?['"]active['"][\s\S]{0,100}?-ne\s+\$true[\s\S]{0,100}?MirrorDue\s*=\s*\$null[\s\S]{0,40}?return/,
    "Mirror capture requests must be gated on an active privacy-noticed editor session");
  const startMirrorCapture = ui.match(/function Start-AuraUiMirrorCapture\s*\{[\s\S]*?\n\}/)?.[0] ?? "";
  const updateMirrorCapture = ui.match(/function Update-AuraUiMirror\s*\{[\s\S]*?\n\}/)?.[0] ?? "";
  assert.match(updateMirrorCapture,
    /\$mirrorViewport[\s\S]{0,160}?-in\s+@\('normal',\s*'wide'\)[\s\S]{0,1200}?viewport\s*=\s*\$mirrorViewport/,
    "The host must omit measured geometry unless the renderer supplied an allowlisted effective viewport");
  assert.match(startMirrorCapture, /MirrorCaptureSession\s*=\s*\[string\][\s\S]{0,160}?StudioEditorState[\s\S]{0,100}?['"]session['"]/,
    "A private capture must be bound to the editor session that requested it");
  assert.match(startMirrorCapture, /MirrorCaptureRevision\s*=\s*\[long\][\s\S]{0,160}?StudioEditorState[\s\S]{0,100}?['"]revision['"]/,
    "A private capture must be bound to the accepted editor revision that requested it");
  assert.match(startMirrorCapture, /MirrorCapturePreviewRequest\s*=\s*\[int\]\$script:MirrorPreviewRequest/,
    "A private capture must retain the preview resize request that produced it");
  assert.match(startMirrorCapture, /StudioForm[\s\S]{0,100}?StudioForm\.Visible[\s\S]{0,40}?return/,
    "A private capture must not begin after Studio is hidden");
  assert.match(updateMirrorCapture, /\$captureSession\s+-and\s+\$captureSession\s+-ceq\s+\$activeSession/,
    "A late private capture must be dropped after its editor session changes");
  assert.match(updateMirrorCapture, /\$captureRevision\s+-eq\s+\$activeRevision/,
    "A late private capture must be dropped after the accepted theme revision changes");
  assert.match(updateMirrorCapture, /\$capturePreviewRequest\s+-eq\s+\$script:MirrorPreviewRequest/,
    "A late private capture must be dropped after a newer preview size request");
  assert.match(updateMirrorCapture, /revision\s*=\s*\$captureRevision/,
    "Studio mirror messages must identify the exact accepted theme revision they show");
  assert.match(updateMirrorCapture, /StudioForm\.Visible[\s\S]*?PostWebMessageAsJson/,
    "A completed private capture must not be posted after Studio is hidden");
  assert.match(ui, /function Request-AuraUiMirror\s*\{[\s\S]{0,320}?MirrorGeneration\s*=\s*\[long\]\$script:MirrorGeneration\s*\+\s*1/,
    "Every mirror request must invalidate older asynchronous work");
  assert.match(updateMirrorCapture, /\$captureGeneration\s+-eq\s+\$script:MirrorGeneration/,
    "A superseded capture must not rewind the live canvas to an older size");
  assert.match(updateMirrorCapture, /\$probeGeneration\s+-ne\s+\$script:MirrorGeneration[\s\S]{0,40}?return/,
    "A superseded layout probe must not start an obsolete capture");
  assert.match(ui,
    /function Complete-AuraUiStudioEditorAction[\s\S]*?\$Result\.Apply\s+-ceq\s+'none'\)\s*\{\s*Request-AuraUiMirror\s*\}/,
    "An invalid editor revision must refresh the honest last-valid live capture instead of leaving its preview empty");
  assert(!studioHtml.includes('id="stage-mirror"'),
    "The actual Aura capture must not be duplicated below the primary canvas");
  assert(!studioHtml.includes('id="stage-mirror-image"'),
    "The primary stage backdrop must be the only visual presentation of the private capture");
  assert.match(studioHtml, /id="stage-mirror-caption"[^>]+role="status"[^>]+aria-live="polite"/,
    "The primary live canvas must expose capture status without a duplicate image panel");
  assert.match(studioHtml, /id="stage-mirror-refresh"/,
    "The primary live canvas must expose a capture refresh action");
  assert.match(studioHtml, /id="stage-open-aura"[^>]+data-editor-i18n="openAuraWindow"/,
    "Foregrounding the separate Aura window must remain an explicit action");
  assert.match(studioHtml, /id="stage-matrix"/,
    "The editor must expose the light\/dark and context state matrix");
  assert.match(studioHtml, /id="stage-backdrop"/,
    "The stage must offer the live-capture backdrop toggle");
  assert.match(studioEditorCss, /data-backdrop="capture"/,
    "Capture mode must restyle the stage so the real window shows through");
  assert.match(studioEditor, /stage-layers-panel/,
    "The stage must expose its layer selection panel");
  assert.equal((studioHtml.match(/type="radio" name="editor-level"/g) ?? []).length, 2,
    "The editor must offer native Quick customize and Advanced mode radios");
  assert.match(studioHtml, /name="editor-level" value="simple" checked>[\s\S]{0,100}?data-editor-i18n="levelSimple"/,
    "Quick customize must remain the default editor level");
  assert.match(studioHtml,
    /data-editor-i18n="levelSimple">Quick customize<\/span>[\s\S]{0,160}?data-editor-i18n="levelAdvanced">Advanced<\/span>/,
    "The fallback document must use the approved Quick customize and Advanced labels");
  assert(studioEditor.includes('levelSimple: "Quick customize"')
      && studioEditor.includes('levelAdvanced: "Advanced"')
      && studioEditor.includes('levelSimple: "快速自定义"')
      && studioEditor.includes('levelAdvanced: "高级"')
      && studioEditor.includes('levelSimple: "快速自訂"')
      && studioEditor.includes('levelAdvanced: "進階"'),
  "Every supported locale must name Quick customize and Advanced independently");
  assert.match(studioEditorCss, /\.editor-view\[data-level="simple"\]\s+\.advanced-only\s*\{[^}]*display:\s*none/,
    "Quick customize must hide only controls explicitly classified as Advanced");
  const simpleVisibilityRules = [...studioEditorCss.matchAll(/\.editor-view\[data-level="simple"\][^{]*\{[^}]*display:\s*none[^}]*\}/g)]
    .map((match) => match[0]).join("\n");
  assert(!simpleVisibilityRules.includes(".editor-controls"),
    "Quick customize must retain its current-language name, essential colors, images, and recovery controls");
  assert.match(studioHtml,
    /class="editor-inspector-nav"(?![^>]*advanced-only)[\s\S]{0,500}?data-editor-panel-target="design"[\s\S]{0,500}?data-editor-panel-target="artwork"/,
    "Quick customize must use contextual Style and Images navigation instead of one long inspector");
  assert.match(studioHtml,
    /class="editor-inspector-tab advanced-only" data-editor-panel-target="layout"[\s\S]{0,300}?class="editor-inspector-tab advanced-only" data-editor-panel-target="checks"/,
    "Placement and Checks navigation must remain Advanced-only");
  assert.match(studioHtml, /class="editor-section" data-editor-panel="design" aria-labelledby="editor-materials-title"/,
    "Quick customize Style must expose its understandable interface font, corner, and shadow controls");
  assert.match(studioHtml, /class="editor-field advanced-only" for="editor-font-display"/,
    "Display typography must remain an Advanced control");
  assert.match(studioHtml, /class="editor-field advanced-only" for="editor-blur"/,
    "Surface blur must remain an Advanced control");
  assert.match(studioHtml,
    /id="editor-radius"[^>]+aria-describedby="editor-radius-inherited"[\s\S]{0,300}?id="editor-radius-inherited"[^>]+data-editor-i18n="inheritedRadiusHelp"[^>]+hidden/,
    "An inherited corner radius must explain that moving the control creates one shared radius");
  assert(studioEditor.includes('const THEME_ORIGINAL = "theme-original";')
      && studioEditor.includes("option.disabled = true;")
      && studioEditor.includes('if (input.value === THEME_ORIGINAL) return;'),
  "Inherited font and shadow choices must use a selected presentation-only option that cannot be sent");
  assert(studioEditor.includes('themeOriginal: "Theme original"')
      && studioEditor.includes('themeOriginal: "主题原有设置"')
      && studioEditor.includes('themeOriginal: "沿用主題設定"'),
  "Theme-original controls must use independently written labels in every supported locale");
  assert.match(studioEditorCss, /\.editor-inherited-note\s*\{[^}]*color:\s*var\(--ink-muted\)/,
    "Inherited values must be disclosed with a quiet inline note instead of another boxed widget");
  assert.match(studioHtml, /class="editor-section" data-editor-panel="design" aria-labelledby="editor-app-identity-title"/,
    "Quick customize Style must expose the essential App identity colors");
  const editorIds = [...studioHtml.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
  assert.equal(new Set(editorIds).size, editorIds.length,
    "Studio must not expose duplicate HTML IDs to labels or accessibility APIs");
  assert.equal((studioHtml.match(/data-editor-launcher="(?:surface|surfaceHover|foreground|accent|border)"/g) ?? []).length, 5,
    "App identity must expose each validated launcher color exactly once");
  assert.match(studioHtml, /id="editor-launcher-radius"[^>]+min="8"[^>]+max="24"/);
  assert.match(studioHtml, /id="editor-launcher-border-width"[^>]+min="1"[^>]+max="3"/);
  assert.match(studioHtml, /data-editor-i18n="appIdentityHelp">[^<]*static, transparent 96 × 96 PNG/i,
    "The editor must state the exact safe launcher-mark input contract");
  assert.match(studioHtml, /id="editor-launcher-replace"[^>]+data-editor-i18n="replaceAppMark"/,
    "Quick customize App identity must expose the host-owned mark replacement action");
  assert.match(studioEditor, /const reflectLauncher[\s\S]{0,1800}?launcherPreview\.style\.background[\s\S]{0,500}?--editor-launcher-hover[\s\S]{0,200}?--editor-launcher-accent/,
    "App identity edits must render immediately in an honest local preview");
  const launcherPreviewNormalizer = studioEditor.slice(
    studioEditor.indexOf("function normalizeLauncherPreviewUrl"),
    studioEditor.indexOf("function normalizeFrame"),
  );
  assert(launcherPreviewNormalizer.includes("aura\\.assets")
      && launcherPreviewNormalizer.includes("aura\\.editor\\/active\\/launcher-")
      && !launcherPreviewNormalizer.includes("aura\\.user-themes"),
  "The identity preview must accept only frozen built-in or digest-owned editor marks");
  assert.match(studioEditor,
    /replaceLauncherMarkButton\?\.addEventListener\("click"[\s\S]{0,300}?type:\s*"pick-theme-launcher-mark"/,
    "Replacing the launcher mark must use the exact host-owned picker action");
  assert(!studioEditor.includes("railThemeMark"),
    "The identity preview must not copy another rendered widget's potentially stale mark");
  assert.match(studioEditor, /launcherInputs[\s\S]{0,1800}?queueTokenChange\("shared", launcherToken\(key\)/,
    "App identity controls must use the guarded editor mutation pipeline");
  assert.match(studioCore,
    /export async function storeStudioLauncherMark[\s\S]{0,1500}?isPathWithin\(paths\.root[\s\S]{0,800}?validateLauncherPngBytes[\s\S]{0,500}?sha256/,
    "The core must independently contain, validate, and fingerprint every host-picked mark");
  assert.match(studioCore,
    /launcherUndo[\s\S]{0,6000}?lastValidLauncherMarkDigest[\s\S]{0,12000}?materializeStudioLauncherMark/,
    "Launcher bytes must participate in Undo/Redo and last-valid draft state");
  assert.match(ui,
    /function Invoke-AuraUiPickThemeLauncherMark[\s\S]{0,2200}?PNG \(\*\.png\)\|\*\.png[\s\S]{0,800}?ReparsePoint[\s\S]{0,500}?400000[\s\S]{0,700}?\[IO\.File\]::Copy[\s\S]{0,500}?-AssetPath \$targetPath[\s\S]{0,1000}?Studio launcher import cleanup failed/,
    "The launcher picker must be host-owned, PNG-only, size-bounded, copied into app data, and cleaned up");
  assert.match(ui, /Invoke-AuraUiPickThemeLauncherMark[\s\S]{0,500}?UiCopy\.chooseThemeLauncherMarkTitle/,
    "The mark picker must identify its purpose instead of reusing generic artwork copy");
  assert.equal((ui.match(/StudioEditorState\['error'\]\s*=\s*'picker-cancelled'/g) ?? []).length, 2,
    "Closing either host-owned image picker must be acknowledged as neutral cancellation");
  assert.equal((ui.match(/Send-AuraUiStudioState -Action 'pick-theme-(?:layer-image|launcher-mark)' -ActionSucceeded \$true/g) ?? []).length, 2,
    "Picker cancellation must settle the pending action without reporting an edit failure");
  assert.match(studioEditor,
    /actionError === "picker-cancelled"[\s\S]{0,500}?settledAction === "pick-theme-launcher-mark"[\s\S]{0,300}?launcherMarkImported[\s\S]{0,400}?identity-apply-failed[\s\S]{0,200}?launcherMarkApplyFailed/,
    "The editor must preserve neutral cancellation and actionable mark replacement results");
  const guardedPost = studioEditor.slice(
    studioEditor.indexOf("const post = (message)"),
    studioEditor.indexOf("const mutationBase"),
  );
  const patchSettlement = studioEditor.slice(
    studioEditor.indexOf("const settlePendingAction"),
    studioEditor.indexOf("const receive = (rawState", studioEditor.indexOf("const settlePendingAction")),
  );
  assert(studioEditor.includes("let actionAfterPatch = null")
      && guardedPost.includes("actionAfterPatch = { ...message }")
      && patchSettlement.includes("const followup = actionAfterPatch")
      && patchSettlement.includes("{ ...followup, ...base }")
      && patchSettlement.includes("post(rebased)"),
  "A mark or layer action clicked after a staged tweak must replay once with the acknowledged revision");
  assert.match(ui,
    /function Get-AuraUiLauncherAssetPath[\s\S]{0,4500}?expectedEditorDigest[\s\S]{0,1800}?SHA256[\s\S]{0,500}?ComputeHash[\s\S]{0,600}?actualDigest/,
    "The Windows host must verify editor preview bytes against the digest in their exact URL");
  for (const locale of ["en", "zh-CN", "zh-TW"]) {
    assert(uiCopy[locale].chooseThemeLauncherMarkTitle
      && uiCopy[locale].themeLauncherMarkImported
      && uiCopy[locale].themeLauncherMarkFailed
      && uiCopy[locale].themeLauncherMarkApplyFailed,
    `${locale} must localize the mark picker and its result`);
    assert.match(uiCopy[locale].themeLauncherMarkFailed, /(?:static|静态|靜態)/,
      `${locale} must explain that animated launcher marks are rejected`);
  }
  assert.match(ui,
    /function Update-AuraUiLauncherStyle[\s\S]{0,500}?LauncherStyleAppliedAsRequested\s*=\s*\$false[\s\S]{0,1600}?\$styles\s*=\s*@\(\$requestedStyle,\s*\$defaultStyle\)[\s\S]{0,1800}?LauncherStyleAppliedAsRequested\s*=\s*\(\$attempt -eq 0\)/,
    "The unified identity transaction must distinguish the requested app identity from its one safe fallback");
  assert.match(ui,
    /Complete-AuraUiStudioEditorAction[\s\S]{0,2500}?pick-theme-launcher-mark[\s\S]{0,400}?LauncherStyleAppliedAsRequested[\s\S]{0,500}?identity-apply-failed[\s\S]{0,600}?themeLauncherMarkApplyFailed/,
    "A Windows identity-application failure must not be reported as a clean mark replacement");
  assert.match(studioHtml, /class="editor-section" data-editor-panel="design" aria-labelledby="editor-background-title"/,
    "Quick customize must expose the theme background scope");
  assert.match(studioEditor,
    /input\.dataset\.editorMetadata === "label"[\s\S]{0,180}?input\.dataset\.editorLocale !== normalizedLocale[\s\S]{0,180}?classList\.add\("advanced-only"\)/,
    "Quick customize Style must show only the current locale name while Advanced retains every locale");
  assert.match(studioHtml, /class="editor-review-states advanced-only"/,
    "Responsive state review must stay available without overwhelming Quick customize");
  const quickCanvasControls = studioHtml.slice(
    studioHtml.indexOf('<div class="stage-toolbar stage-toolbar-primary stage-viewport-toolbar">'),
    studioHtml.indexOf('<div id="editor-stage"'),
  );
  for (const id of ["stage-real-width", "stage-real-height"]) {
    assert(quickCanvasControls.includes(`id="${id}"`),
      `${id} must stay available in Quick customize beside the live preview`);
  }
  assert(!studioHtml.includes('id="stage-real-apply"'),
    "Preview dimensions must update directly instead of requiring a redundant Apply action");
  assert.match(studioEditor,
    /for \(const input of \[previewWidthInput, previewHeightInput\]\)[\s\S]{0,240}?addEventListener\("input",\s*\(\)\s*=>\s*\{[\s\S]{0,120}?previewSizeEditing\s*=\s*true[\s\S]{0,100}?schedulePreviewSize\(\)[\s\S]{0,140}?addEventListener\("change",\s*\(\)\s*=>\s*commitPreviewSize/,
    "Both preview dimensions must update the canvas live and commit their final value");
  assert.equal((quickCanvasControls.match(/name="stage-viewport"/g) ?? []).length, 2,
    "Quick customize must expose both persisted responsive placement sets");
  assert.equal((quickCanvasControls.match(/name="editor-mode"/g) ?? []).length, 2,
    "Light and Dark must remain visible beside the preview in every inspector context");
  assert.equal((quickCanvasControls.match(/name="stage-context"/g) ?? []).length, 2,
    "New chat and conversation must remain visible beside the preview in every inspector context");
  assert.match(studioHtml, /class="editor-section editor-prompt-context"[\s\S]{0,1800}?data-editor-prompt="width"/,
    "New-chat placement controls must live in one identifiable contextual section");
  assert.match(studioHtml,
    /id="editor-prompt-native"[^>]+data-editor-i18n="nativePromptHelp"[^>]+hidden/,
    "A native Claude layout must be identified before Studio authors placement values");
  assert(studioEditor.includes('nativePromptHelp: "Using Claude\'s current layout.')
      && studioEditor.includes('nativePromptHelp: "正在沿用 Claude 当前布局。')
      && studioEditor.includes('nativePromptHelp: "目前沿用 Claude 的版面。'),
  "Native-layout guidance must be independently authored in all three locales");
  assert.match(studioEditor,
    /const measuredNativePrompt[\s\S]{0,1500}?prompt\.width\s*\/\s*mainMetrics\.width[\s\S]{0,500}?prompt\.left\s*\+\s*\(prompt\.width\s*\/\s*2\)/,
    "The first authored layout must seed from the measured live prompt rather than a guessed width");
  const clampedMainSource = studioEditor.match(
    /const clampedMirrorMainMetrics\s*=\s*\(main,\s*logicalWidth,\s*logicalHeight\)\s*=>\s*\{[\s\S]*?\n\s{2}\};/,
  )?.[0] ?? "";
  assert(clampedMainSource, "Studio is missing its renderer-aligned main-canvas clamp");
  const clampMirrorMain = new Function(`${clampedMainSource}; return clampedMirrorMainMetrics;`)();
  const shortMain = clampMirrorMain(
    { left: 280, top: 120, width: 900, height: 500 }, 1180, 640,
  );
  assert.deepEqual(shortMain, { left: 280, top: 120, width: 900, height: 500 },
    "A shorter captured main canvas must retain its measured height instead of expanding to the WebView");
  assert.deepEqual(
    clampMirrorMain({ left: 240, top: -80, width: 1040, height: 900 }, 1180, 640),
    { left: 240, top: 0, width: 940, height: 640 },
    "Captured main geometry must clamp to the same visible viewport bounds as the renderer");
  assert.equal(clampMirrorMain({ left: 1150, top: 0, width: 200, height: 640 }, 1180, 640), null,
    "Studio must reject captured main geometry with no usable visible canvas");
  assert.equal(0.1 * shortMain.height, 50,
    "A ten-percent prompt Y delta must resolve against the captured main height");
  assert.match(studioEditor,
    /const deltaY[\s\S]{0,180}?\*\s*mainMetrics\.height/,
    "The captured prompt outline must convert Y deltas with the clamped main-canvas height");
  assert.match(studioEditor,
    /mainHeight:\s*mainMetrics\.height/,
    "Prompt drags must capture the clamped main-canvas height at pointerdown");
  assert.match(studioEditor,
    /shared\.prompt\.y[\s\S]{0,180}?dy\s*\/\s*drag\.mainHeight/,
    "Prompt pointer drags must normalize Y movement with that same captured main-canvas height");
  assert.match(studioEditor,
    /const seedNativePromptOverrides[\s\S]{0,500}?\["width",\s*"x",\s*"y"\][\s\S]{0,220}?setStageOverride/,
    "The native prompt must be adopted as one complete width-and-offset tuple");
  assert.match(studioEditor,
    /const adoptsNativePrompt[\s\S]{0,650}?adoptsNativePrompt\s*&&\s*promptKey/,
    "A first prompt gesture must commit every measured placement scalar in one patch");
  assert.match(studioHtml, /class="editor-section editor-prompt-unavailable"[^>]+hidden[\s\S]{0,300}?data-editor-i18n="conversationLayoutHelp"/,
    "Conversation mode must replace new-chat placement controls with an explicit explanation");
  const stageToolbarSyncBlock = studioEditor.match(/const syncStageToolbar\s*=\s*\(\)\s*=>\s*\{[\s\S]*?\n\s*};/)?.[0] ?? "";
  assert.match(stageToolbarSyncBlock,
    /stageContext === "new-chat"[\s\S]{0,220}?promptContextSection\.hidden = !newChat[\s\S]{0,120}?promptContextSection\.inert = !newChat[\s\S]{0,160}?promptContextUnavailable\.hidden = newChat/,
    "Conversation mode must make new-chat placement controls both hidden and inert");
  assert((studioEditor.match(/if \(stageContext !== "new-chat"\) return/g) ?? []).length >= 3,
    "Every slider and exact-value path must reject prompt edits outside New chat");
  assert.match(quickCanvasControls, /<legend data-editor-i18n="previewPage">Preview page<\/legend>/,
    "The page selector must identify itself as a preview target rather than an implicit navigation command");
  const stageContextChangeBlock = studioEditor.match(
    /stageContextInputs\.forEach\([\s\S]*?\n\s*}\)\);/)?.[0] ?? "";
  assert.match(stageContextChangeBlock,
    /stageContextTouched\s*=\s*true[\s\S]{0,160}?stageContext\s*=\s*input\.value[\s\S]{0,160}?selectStageMirror\(\)[\s\S]{0,120}?renderStage\(\)/,
    "An explicit page selection must stay pinned and select its matching capture before rendering");
  assert.match(studioEditor,
    /type:\s*"pick-theme-layer-image"[\s\S]{0,180}?index:\s*-1[\s\S]{0,140}?appearance:\s*selectedMode[\s\S]{0,100}?context:\s*stageContext/,
    "New images must default to the exact Light\/Dark and New chat\/Conversation state being edited");
  assert.match(studioEditor,
    /const stageLayerGate[\s\S]{0,500}?appearance === "all" \|\| appearance === selectedMode[\s\S]{0,160}?context === "all" \|\| context === stageContext/,
    "The stage must never expose a state-specific image in another appearance or page context");
  const stageLayerPaletteBlock = studioEditor.match(
    /const renderStageLayersPanel\s*=\s*\(\)\s*=>\s*\{[\s\S]*?\n\s*};/)?.[0] ?? "";
  assert(stageLayerPaletteBlock.includes("const gated = !stageLayerGate(layer)")
      && stageLayerPaletteBlock.includes("select.disabled = gated")
      && stageLayerPaletteBlock.includes("eye.disabled = gated"),
    "A layer outside the selected appearance, page, or viewport must not be manipulable from the canvas palette");
  const renderFrameBlock = studioEditor.match(/const renderFrame\s*=\s*\([\s\S]*?\n\s*};/)?.[0] ?? "";
  assert.match(renderFrameBlock, /fieldset\.disabled = disabled[\s\S]{0,80}?dataset\.gated = String\(disabled\)/,
    "Advanced framing controls must be inert when their layer is outside the selected preview state");
  assert.match(studioEditor,
    /renderFrame\(layer, "normal", gated\),\s*renderFrame\(layer, "wide", gated\)/,
    "Layer framing gates must follow the same appearance and page state as the canvas");
  const layerGateBadgeBlock = studioEditor.match(
    /const updateLayerGateBadges\s*=\s*\(\)\s*=>\s*\{[\s\S]*?\n\s*};/)?.[0] ?? "";
  assert(layerGateBadgeBlock.includes("const gated = !stageLayerGate(layer)")
      && layerGateBadgeBlock.includes("control.disabled = gated"),
  "Switching Light/Dark or New chat/Conversation must immediately gate the matching Advanced framing controls");
  assert(studioHtml.indexOf('class="stage-panel"') < studioHtml.indexOf('class="stage-toolbar stage-toolbar-primary stage-viewport-toolbar"')
      && studioHtml.indexOf('class="stage-toolbar stage-toolbar-primary stage-viewport-toolbar"') < studioHtml.indexOf('id="editor-stage"'),
    "Responsive dimensions must stay in the persistent canvas chrome instead of scrolling away with the inspector");
  assert.match(studioEditor, /const reflectStageViewport\s*=\s*\(\)\s*=>[\s\S]{0,160}?input\.checked\s*=\s*input\.value\s*===\s*stageViewport/,
    "Custom dimensions must keep the visible responsive framing selector synchronized");
  assert((studioEditor.match(/reflectStageViewport\(\)/g) ?? []).length >= 4,
    "Every capture, custom-size, and maximize path must reflect the active normal/wide set");
  assert.match(studioHtml, /id="editor-quick-feedback"[^>]+role="status"[^>]+aria-live="polite"/,
    "Quick customize must retain an announced validation summary");
  assert.match(studioEditor, /stageHiddenLayers/,
    "Stage eye toggles must stay session-local instead of editing the draft");
  assert.match(studioEditor, /stageSelection\.id/,
    "The active stage selection must follow an opaque layer identity across reorder responses");
  assert.match(studioEditor, /stageHiddenLayers\.has\(layer\.id\)/,
    "Hide-while-editing state must follow the same artwork layer after reordering");
  assert.match(studioEditor, /selectedLayerId/,
    "The Advanced inspector must retain the selected image identity while indexes change");
  assert.match(studioCore, /id:\s*layer\.id,[\s\S]{0,180}?index/,
    "Canonical editor state must expose the app-owned stable layer id alongside its current index");
  assert.match(ui, /\$layerIds\s*=\s*\[Collections\.Generic\.HashSet\[string\]\][\s\S]{0,360}?\^layer-\[a-f0-9\]\{32\}\$/,
    "The host must reject malformed or duplicate canonical layer identities");
  assert.match(studioEditor, /dataset\.stageHandle = "move"/,
    "Selection chrome must include keyboard-focusable move handles");
  assert.match(studioEditor, /dataset\.stageHandle = "scale"/,
    "Selection chrome must include keyboard-focusable resize handles");
  assert.match(ui,
    /function Show-AuraUiMain[\s\S]{0,420}?\.Activate\(\)[\s\S]{0,120}?\.BringToFront\(\)/,
    "The open-aura action must restore and foreground the main Aura window");
  assert.match(ui,
    /(?:\$script:StudioMessageTypes\s+-cnotcontains\s+\$message\.type|\$message\.type\s+-cnotin\s+\$script:StudioMessageTypes)/i,
    "Studio message actions must be checked case-sensitively against the allowlist");
  assert.match(ui, /\$message\.type\s+-isnot\s+\[string\]/i,
    "Studio messages must carry a string action type");
  assert.match(ui, /\$message\.PSObject\.Properties/i,
    "Studio messages must validate their exact property shape");
  assert.match(ui, /\$Json\.Length\s+-gt\s+16384/,
    "Studio must keep the larger bounded patch envelope below 16 KiB before parsing JSON");
  assert.match(ui, /\$sourceUri\.Scheme\s+-cne\s+['"]https['"][\s\S]{0,120}?\$sourceUri\.Host\s+-cne\s+['"]aura\.studio['"]/,
    "Studio bridge messages must come from the exact offline HTTPS host");
  assert.match(ui, /\^\[a-f0-9\]\{8\}-\[a-f0-9\]\{4\}-4\[a-f0-9\]\{3\}-\[89ab\]\[a-f0-9\]\{3\}-\[a-f0-9\]\{12\}\$/,
    "Studio edit sessions must be canonical lowercase UUIDv4 values");
  assert.match(ui, /rejected an editor message from a different session/);
  assert.match(ui, /rejected a stale editor revision/);
  assert.match(ui, /ConvertTo-AuraUiStudioInteger\s+-Value\s+\$Message\.revision\s+-Minimum\s+0\s+-Maximum\s+2147483647/,
    "Studio revisions must be bounded integers, not coercible arbitrary values");
  assert.match(ui, /\$Message\.index\s+-Minimum\s+-1\s+-Maximum\s+7/,
    "Artwork attachment must use only add or one of eight layer indexes");
  assert.match(ui, /\$Message\.value\s+-Minimum\s+0\.25\s+-Maximum\s+3\s+-Label\s+['"]Theme layer scale['"]/,
    "Studio must reject out-of-range layer scaling at the host boundary");
  assert(!/\$message\.(?:path|file|fileName)\b/i.test(ui),
    "Editor bridge messages must never accept a page-supplied filesystem path");
  assert.match(ui, /-c(?:not)?match\s+['"]\^\[a-z\]\[a-z0-9-\]\{1,39\}\$['"]/,
    "Studio theme IDs must use the canonical case-sensitive kebab-case check");
  assert.match(ui, /\$message\.enabled\s+-isnot\s+\[bool\]/i,
    "Studio enabled-state messages must carry a real Boolean");
  assert.match(ui, /\$message\.appearance\s+-isnot\s+\[string\]/i,
    "Studio appearance messages must carry a string");
  assert.match(ui, /\$Appearance\s+-cnotin\s+@\(\s*['"]system['"]\s*,\s*['"]light['"]\s*,\s*['"]dark['"]\s*\)/,
    "Studio appearance values must be checked case-sensitively against the exact enum");
  assert.match(ui, /CoreWebView2PreferredColorScheme\]::Auto/);
  assert.match(ui, /CoreWebView2PreferredColorScheme\]::Light/);
  assert.match(ui, /CoreWebView2PreferredColorScheme\]::Dark/);
  assert.match(ui,
    /function Set-AuraUiPreferredColorScheme[\s\S]*?\[bool\]\$Enabled\s*=\s*\(Get-AuraUiEnabled\)[\s\S]*?if \(-not \$Enabled\)[\s\S]*?CoreWebView2PreferredColorScheme\]::Auto/,
    "Original look must restore WebView2 to the system color scheme");
  assert.match(ui, /Profile\.PreferredColorScheme\s*=\s*\$scheme/,
    "The host must apply appearance through the supported WebView2 profile API");
  const setEnabled = powershellFunction("Invoke-AuraUiSetEnabled");
  assert.match(setEnabled,
    /if \(-not \$Enabled\)\s*\{\s*\$options \+= @\('--appearance', 'system'\)\s*\}/,
    "Original look must persist System appearance together with the disabled state");
  const enabledConfigIndex = setEnabled.indexOf("Set-AuraUiConfig -Options $options");
  const enabledSchemeIndex = setEnabled.indexOf(
    "Set-AuraUiPreferredColorScheme -Appearance $appearance -Enabled $Enabled");
  const enabledCleanupIndex = setEnabled.indexOf("window.__CLAUDE_AURA_DISABLED__");
  assert(enabledConfigIndex >= 0 && enabledSchemeIndex > enabledConfigIndex
      && enabledCleanupIndex > enabledSchemeIndex,
  "Original look must persist System and reset the profile preference before renderer cleanup");
  assert.match(ui,
    /if \(\$Mode -eq 'Restore'\)\s*\{\s*\$initialOptions \+= @\('--enabled', 'false', '--appearance', 'system'\)\s*\}/,
    "The command-line Restore path must also persist Original look in System appearance");
  const setAppearance = powershellFunction("Invoke-AuraUiSetAppearance");
  assert.match(setAppearance,
    /\$enabled = Get-AuraUiEnabled[\s\S]{0,120}?\$effectiveAppearance = if \(\$enabled\) \{ \$Appearance \} else \{ 'system' \}[\s\S]{0,180}?Set-AuraUiConfig -Options @\('--appearance', \$effectiveAppearance\)/,
    "A direct appearance request must persist System while Original look is active");
  assert.match(setAppearance,
    /Set-AuraUiPreferredColorScheme -Appearance \$effectiveAppearance -Enabled \$enabled[\s\S]{0,100}?if \(\$enabled\) \{ Apply-AuraUiTheme \}/,
    "Original look must not apply a forced theme appearance after clamping the persisted mode");
  assert.match(ui,
    /function Set-AuraUiConfig[\s\S]*?Set-AuraUiPayloadState[^\n]*\n\s*if \(\$script:WebReady -or \$script:StudioReady\) \{ Set-AuraUiPreferredColorScheme \}/,
    "Every live config mutation that can enable a theme must refresh the WebView2 preference");
  assert.match(ui, /appearance\s*=\s*\(Get-AuraUiAppearance\)/,
    "Studio state must report the persisted appearance");
  assert.match(studioHtml, /<fieldset[^>]+id="appearance-mode"[^>]+aria-describedby="appearance-help"/,
    "Studio appearance must use a labelled native fieldset");
  assert.equal((studioHtml.match(/type="radio" name="appearance"/g) ?? []).length, 3,
    "Studio must expose exactly System, Light, and Dark radio choices");
  assert.match(studioApp, /type:\s*"set-appearance",\s*appearance:\s*input\.value/,
    "Studio must send the selected appearance through the strict bridge");
  assert.match(studioApp,
    /appearanceMode\.disabled\s*=\s*appearancePending\s*\|\|\s*!state\.enabled/,
    "Studio must disable forced appearance choices while Original look is active");
  assert.match(studioApp,
    /if \(!input\.checked\s*\|\|\s*appearancePending\s*\|\|\s*!state\.enabled\s*\|\|\s*!appearanceModes\.has\(input\.value\)\) return/,
    "A stale or scripted appearance change must not leave Studio while Original look is active");
  for (const copy of ["Appearance mode", "外观模式", "外觀模式", "跟随系统", "跟隨系統"]) {
    assert(studioApp.includes(copy), `Studio appearance copy is missing ${copy}`);
  }
  for (const copy of [
    "System follows Windows. Light and Dark apply to Claude Aura and Studio.",
    "“跟随系统”会使用 Windows 的外观设置；选择“浅色”或“深色”后，Claude Aura 和 Studio 会同步切换。",
    "「跟隨系統」會使用 Windows 的外觀設定；選擇「淺色」或「深色」後，Claude Aura 和 Studio 會一起切換。",
  ]) {
    assert(studioApp.includes(`appearanceHelp: "${copy}"`),
      `Studio appearance help does not explain the shared Aura/Studio effect: ${copy}`);
  }
  const applyStudioStyleStart = studioApp.indexOf("const applyStudioStyle = () => {");
  const applyStudioStyleEnd = studioApp.indexOf("railThemeMark.addEventListener", applyStudioStyleStart);
  assert(applyStudioStyleStart >= 0 && applyStudioStyleEnd > applyStudioStyleStart,
    "Studio's theme-style applicator could not be isolated");
  const applyStudioStyleBlock = studioApp.slice(applyStudioStyleStart, applyStudioStyleEnd);
  assert.match(applyStudioStyleBlock, /activeEditorStyle\s*=\s*state\.enabled\s*\?\s*editorStudioStyle\s*:\s*null/,
    "An active editor draft must style Studio only while theming is enabled");
  assert.match(applyStudioStyleBlock,
    /activeEditorStyle\s*\?\s*editorStudioThemeId\s*:\s*\(state\.enabled\s*\?\s*state\.theme\s*:\s*"default"\)/,
    "Original look must restore Studio's Default shell instead of retaining the selected theme");
  assert.match(applyStudioStyleBlock,
    /activeEditorStyle\s*\?\?\s*themes\[themeId\]\?\.studioStyle\s*\?\?\s*themes\.default\?\.studioStyle/,
    "Studio must fall back from a draft to the selected theme and then the Default style");
  assert.match(applyStudioStyleBlock, /window\.CLAUDE_AURA_EDITOR\?\.normalizeStudioStyle\?\.\(candidate\)/,
    "Studio must validate a style DTO before writing any CSS property");
  assert.match(applyStudioStyleBlock, /const mode\s*=\s*effectiveStudioMode\(\)/,
    "Studio must resolve System, Light, and Dark through one effective appearance mode");
  assert.match(studioApp,
    /effectiveStudioMode\s*=\s*\(\)\s*=>\s*\(!state\.enabled\s*\|\|\s*state\.appearance\s*===\s*"system"\)[\s\S]{0,120}?studioColorScheme\?\.matches\s*\?\s*"dark"\s*:\s*"light"/,
    "Original look and System mode must both follow the live Windows color scheme");
  assert.match(applyStudioStyleBlock,
    /safeStudioComposite\(colors\.surface,\s*colors\.canvas,\s*colors\.surfaceAlpha,\s*\[[\s\S]{0,180}?colors\.textSecondary,\s*4\.5[\s\S]{0,100}?colors\.textMuted,\s*4\.5[\s\S]{0,100}?colors\.border,\s*3/,
    "Translucent Studio surfaces must fall back when compositing would break text or border contrast");
  assert.match(applyStudioStyleBlock,
    /safeStudioComposite\(colors\.sidebar,\s*colors\.canvas,\s*colors\.sidebarAlpha,\s*\[[\s\S]{0,140}?colors\.sidebarText,\s*7[\s\S]{0,100}?colors\.sidebarTextMuted,\s*4\.5/,
    "Translucent Studio rails must fall back when compositing would break sidebar contrast");
  for (const [property, value] of [
    ["--bg", "colors.canvas"],
    ["--raised", "colors.raised"],
    ["--ink", "colors.text"],
    ["--ink-secondary", "colors.textSecondary"],
    ["--ink-muted", "colors.textMuted"],
    ["--accent", "colors.accent"],
    ["--accent-ink", "colors.accentText"],
    ["--border", "colors.border"],
    ["--ring", "colors.focus"],
    ["--rail-ink", "colors.sidebarText"],
    ["--rail-ink-muted", "colors.sidebarTextMuted"],
  ]) {
    assert(applyStudioStyleBlock.includes(`"${property}": ${value}`),
      `Studio style application omits ${property}`);
  }
  for (const property of ["--surface", "--rail-bg", "--shadow", "--radius", "--studio-blur", "--font-ui", "--font-display"]) {
    assert(applyStudioStyleBlock.includes(`"${property}"`), `Studio style application omits ${property}`);
  }
  assert.match(applyStudioStyleBlock, /root\.style\.colorScheme\s*=\s*mode/,
    "Studio must expose its effective theme mode to native controls");
  assert.match(studioApp, /const bundledThemeIds\s*=\s*new Set\(Object\.keys\(themes\)\)/,
    "Studio must freeze its permanent shell authority before host-added themes arrive");
  assert.match(applyStudioStyleBlock,
    /root\.dataset\.studioShell\s*=\s*!state\.enabled\s*\?\s*"default"\s*:\s*activeEditorStyle\s*\?\s*"custom"\s*:\s*bundledThemeIds\.has\(themeId\)\s*\?\s*themeId\s*:\s*"custom"/,
    "Studio shell recipes must resolve Original look to Default, drafts and user themes to neutral chrome, and only bundled IDs to permanent profiles");
  assert(!/(?:url\(|backgroundImage|studioPreview|artwork)/i.test(applyStudioStyleBlock),
    "Studio shell theming must never inject artwork, preview files, or raw background URLs");
  assert.match(studioApp,
    /onStudioStyleChange:\s*\(style,\s*themeId,\s*launcherStyle,\s*launcherUrl\)\s*=>\s*\{[\s\S]{0,180}?editorStudioStyle\s*=\s*style[\s\S]{0,260}?editorLauncherStyle\s*=\s*style\s*\?[\s\S]{0,180}?editorLauncherMarkUrl\s*=\s*style\s*\?/,
    "Valid editor responses must immediately adopt the same last-valid Studio and App identity styles");
  assert.match(studioApp,
    /const applyLauncherMaterial[\s\S]{0,900}?--launcher-surface[\s\S]{0,300}?--launcher-foreground[\s\S]{0,300}?--launcher-accent[\s\S]{0,300}?--launcher-border-width/,
    "Every exposed App identity material token must project through fixed Studio-owned CSS variables");
  assert.match(studioApp,
    /const activeEditorLauncher\s*=\s*state\.enabled\s*\?\s*editorLauncherStyle\s*:\s*null[\s\S]{0,180}?const disconnectedLauncher\s*=\s*activeEditorLauncher\s*\?\?\s*identityTheme\?\.launcher[\s\S]{0,300}?const connectedIdentity\s*=\s*state\.effectiveIdentity\s*\?\?[\s\S]{0,220}?applyLauncherMaterial\(state\.connected\s*\?\s*connectedIdentity\.launcher\s*:\s*disconnectedLauncher\)/,
    "Connected Studio must render the host-committed App material while retaining a safe disconnected draft fallback");
  assert.match(studioApp,
    /const disconnectedMarkUrl\s*=\s*activeEditorLauncher\s*&&\s*editorLauncherMarkUrl[\s\S]{0,100}?editorLauncherMarkUrl[\s\S]{0,100}?launcherMarkUrl\(identityTheme\)[\s\S]{0,120}?const themeMarkUrl\s*=\s*state\.connected\s*\?\s*connectedIdentity\.previewUrl\s*:\s*disconnectedMarkUrl/,
    "Connected Studio must use only the host-committed mark URL while retaining a contained disconnected fallback");
  assert.match(studioApp,
    /const normalizeEffectiveIdentity[\s\S]{0,220}?hasExactKeys\(value,\s*\["launcher", "previewUrl"\]\)[\s\S]{0,160}?hasExactKeys\(value\.launcher,\s*LAUNCHER_MATERIAL_KEYS\)[\s\S]{0,220}?return launcher && previewUrl\s*\?\s*\{ launcher, previewUrl \}\s*:\s*null/,
    "The host identity boundary must reject an extra key or either invalid member as one complete unit");
  const railMarkErrorStart = studioApp.indexOf('railThemeMark.addEventListener("error"');
  const railMarkErrorEnd = studioApp.indexOf("const setStatus", railMarkErrorStart);
  const railMarkError = studioApp.slice(railMarkErrorStart, railMarkErrorEnd);
  const fallbackMaterialIndex = railMarkError.indexOf(
    "applyLauncherMaterial(themes.default?.launcher)");
  const fallbackMarkIndex = railMarkError.indexOf("railThemeMark.src = fallbackUrl");
  const fallbackFaviconIndex = railMarkError.indexOf("studioThemeIcon.href = fallbackUrl");
  assert(railMarkErrorStart >= 0 && fallbackMaterialIndex >= 0
      && fallbackMarkIndex > fallbackMaterialIndex && fallbackFaviconIndex > fallbackMarkIndex
      && railMarkError.includes('removeAttribute("src")')
      && railMarkError.includes('removeAttribute("href")'),
  "A failed committed mark must fall back material and mark together, then hide both if Default also fails");
  assert.match(studioApp,
    /if\s*\(!state\.enabled\s*\|\|\s*state\.appearance\s*===\s*"system"\)\s*applyStudioStyle\(\)/,
    "Studio must react when Windows switches color scheme in System or Original-look mode");
  assert.match(studioApp, /value\.studioStyle[\s\S]{0,180}?normalizeStudioStyle\?\.\(value\.studioStyle\)/,
    "Host theme metadata must pass the strict Studio-style normalizer");
  assert.match(ui,
    /function ConvertTo-AuraUiThemeMetadata[\s\S]{0,2400}?studioStyle\s*=\s*Get-AuraUiPropertyValue\s+-InputObject\s+\$Item\s+-Names\s+@\('studioStyle'\)/,
    "The Windows host must preserve the sanitized Studio style in theme metadata");
  const editorStateConverterStart = ui.indexOf("function ConvertTo-AuraUiStudioEditorState");
  const editorStateConverterEnd = ui.indexOf("function ", editorStateConverterStart + 10);
  const editorStateConverterBlock = ui.slice(editorStateConverterStart, editorStateConverterEnd);
  assert(editorStateConverterStart >= 0 && editorStateConverterBlock.includes("'studioStyle'")
      && editorStateConverterBlock.includes("Assert-AuraUiStudioStyle -Style $State.studioStyle"),
  "The Windows host must require and validate Studio style on every active editor state");
  assert(editorStateConverterBlock.includes("'launcher'") && editorStateConverterBlock.includes("'launcherStyle'")
      && editorStateConverterBlock.includes("Assert-AuraUiStudioLauncherStyle -Style $State.launcher")
      && editorStateConverterBlock.includes("Assert-AuraUiStudioLauncherStyle -Style $State.launcherStyle"),
  "The Windows host must require current and last-valid App identity styles on every active editor state");
  const launcherStyleValidatorStart = ui.indexOf("function Assert-AuraUiStudioLauncherStyle");
  const launcherStyleValidatorEnd = ui.indexOf("function ", launcherStyleValidatorStart + 10);
  const launcherStyleValidator = ui.slice(launcherStyleValidatorStart, launcherStyleValidatorEnd);
  assert.match(launcherStyleValidator,
    /assets\/theme-art\/\(default\|japanese-film-editorial\|korean-prestige\|cartoon-studio\|anime-twilight\|study-library\|japanese-idol\|korean-idol\)\/launcher-mark/,
    "The host launcher boundary must allow only the eight frozen built-in mark roots or the kit-local mark");

  const fallbackVariables = (block) => Object.fromEntries(
    [...block.matchAll(/--([a-z-]+):\s*(#[0-9a-f]{6})\s*;/gi)].map((match) => [match[1], match[2]]),
  );
  const lightFallbackBlock = studioCss.match(/:root\s*\{([^}]*)\}/)?.[1] ?? "";
  const darkFallbackBlock = studioCss.match(/@media\s*\(prefers-color-scheme:\s*dark\)\s*\{\s*:root\s*\{([^}]*)\}/)?.[1] ?? "";
  const hexLuminance = (value) => value.match(/[0-9a-f]{2}/gi)
    .map((channel) => Number.parseInt(channel, 16) / 255)
    .map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4)
    .reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0);
  const hexContrast = (left, right) => {
    const values = [hexLuminance(left), hexLuminance(right)].sort((a, b) => b - a);
    return (values[0] + 0.05) / (values[1] + 0.05);
  };
  for (const [mode, values] of [["light", fallbackVariables(lightFallbackBlock)], ["dark", fallbackVariables(darkFallbackBlock)]]) {
    for (const [foreground, background, minimum] of [
      ["ink", "bg", 7],
      ["ink-secondary", "surface", 4.5],
      ["ink-muted", "surface", 4.5],
      ["accent", "bg", 3],
      ["accent-ink", "accent", 4.5],
      ["border", "bg", 3],
      ["ring", "bg", 3],
      ["rail-ink", "rail-bg", 7],
      ["rail-ink-muted", "rail-bg", 4.5],
    ]) {
      assert(values[foreground] && values[background], `${mode} Studio fallback omits ${foreground} or ${background}`);
      assert(hexContrast(values[foreground], values[background]) >= minimum,
        `${mode} Studio fallback ${foreground}/${background} is below ${minimum}:1`);
    }
  }
  const shellVariableKeys = [
    "shell-card-border-width", "shell-card-lift", "shell-card-radius", "shell-card-shadow",
    "shell-heading-tracking", "shell-heading-weight", "shell-panel-border-width", "shell-panel-radius",
    "shell-panel-shadow", "shell-rail-divider-width", "shell-rail-indicator-inset", "shell-rail-indicator-radius",
    "shell-rail-indicator-width", "shell-rail-item-radius", "shell-rail-shadow", "shell-section-rule-style",
    "shell-section-rule-width", "shell-title-rule-height", "shell-title-rule-radius", "shell-title-rule-width",
  ];
  const shellProfileBlocks = [...studioCss.matchAll(
    /:root\[data-studio-shell="([a-z0-9-]+)"\]\s*\{([^}]*)\}/g,
  )].map((match) => ({ id: match[1], css: match[2] }));
  assert.deepEqual(shellProfileBlocks.map((profile) => profile.id), THEME_IDS,
    "Studio must ship exactly one shell profile for each frozen permanent theme, in registry order");
  const structuralKeys = [
    "shell-card-border-width", "shell-card-lift", "shell-card-radius", "shell-heading-tracking",
    "shell-heading-weight", "shell-panel-border-width", "shell-panel-radius", "shell-rail-divider-width",
    "shell-rail-indicator-inset", "shell-rail-indicator-radius", "shell-rail-indicator-width",
    "shell-rail-item-radius", "shell-section-rule-style", "shell-section-rule-width",
    "shell-title-rule-height", "shell-title-rule-radius", "shell-title-rule-width",
  ];
  const structuralSignatures = [];
  for (const profile of shellProfileBlocks) {
    const declarations = Object.fromEntries([...profile.css.matchAll(/--([a-z-]+):\s*([^;]+);/g)]
      .map((match) => [match[1], match[2].trim()]));
    assert.deepEqual(Object.keys(declarations).sort(), shellVariableKeys,
      `${profile.id} does not define the complete closed Studio shell profile`);
    assert(!/(?:url\(|image-set\(|assets\/|artwork|[a-z]:\\|#[0-9a-f]{3,8})/i.test(profile.css),
      `${profile.id} shell profile contains media, a path, or a raw color`);
    structuralSignatures.push(structuralKeys.map((key) => declarations[key]));
  }
  assert.equal(new Set(structuralSignatures.map((signature) => JSON.stringify(signature))).size, THEME_IDS.length,
    "Every permanent Studio shell must have a distinct non-color structural signature");
  for (let left = 0; left < structuralSignatures.length; left += 1) {
    for (let right = left + 1; right < structuralSignatures.length; right += 1) {
      const differences = structuralSignatures[left]
        .filter((value, index) => value !== structuralSignatures[right][index]).length;
      assert(differences >= 2,
        `${THEME_IDS[left]} and ${THEME_IDS[right]} need at least two distinct non-color shell cues`);
    }
  }
  assert.match(studioCss, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.theme-card-choice:hover label\s*\{\s*transform:\s*none/,
    "Reduced motion must remove profile-specific card lift");
  const contrastRoot = studioCss.match(/@media\s*\(prefers-contrast:\s*more\)\s*\{\s*:root\s*\{([^}]*)\}/)?.[1] ?? "";
  for (const [key, value] of [
    ["shell-card-lift", "0px !important"],
    ["shell-card-shadow", "none !important"],
    ["shell-panel-shadow", "none !important"],
    ["shell-rail-shadow", "none !important"],
    ["shell-title-rule-width", "0px !important"],
    ["shell-title-rule-height", "0px !important"],
  ]) {
    assert.match(contrastRoot, new RegExp(`--${key}:\\s*${value.replace(" ", "\\s+")}`),
      `High contrast must override permanent-profile ${key}`);
  }
  assert.match(studioCss, /@media\s*\(forced-colors:\s*active\)[\s\S]*?--bg:\s*Canvas\s*!important[\s\S]*?--ink:\s*CanvasText\s*!important[\s\S]*?--accent:\s*Highlight\s*!important[\s\S]*?--accent-ink:\s*HighlightText\s*!important/,
    "Studio theme variables must yield to Windows forced colors");
  const forcedColorsRoot = studioCss.match(/@media\s*\(forced-colors:\s*active\)\s*\{\s*:root\s*\{([^}]*)\}/)?.[1] ?? "";
  const forcedShellDeclarations = Object.fromEntries([...forcedColorsRoot.matchAll(/--(shell-[a-z-]+):\s*([^;]+);/g)]
    .map((match) => [match[1], match[2].trim()]));
  assert.deepEqual(Object.keys(forcedShellDeclarations).sort(), shellVariableKeys,
    "Forced colors must reset the complete permanent-shell profile");
  for (const [key, value] of Object.entries(forcedShellDeclarations)) {
    assert(value.endsWith(" !important"), `Forced-colors ${key} must override permanent-profile specificity`);
  }
  assert.match(studioCss, /\.rail-item:hover\s*\{[^}]*background:\s*var\(--rail-hover\)[^}]*color:\s*var\(--rail-ink\)/,
    "Studio rail hover styling must remain on the rail's own contrast-safe palette");
  assert.match(studioCss, /\.rail-item\.is-current\s*\{[^}]*background:\s*var\(--rail-selected\)[^}]*color:\s*var\(--rail-ink\)/,
    "Studio's selected rail item must remain on the rail's own contrast-safe palette");
  assert.match(studioCss, /\.rail-item\.is-current::before\s*\{[^}]*background:\s*var\(--rail-ink\)/,
    "Studio's permanent-profile rail marker must use the contrast-validated rail ink");
  assert.match(studioCss, /\.rail\s+:focus-visible\s*\{\s*outline-color:\s*var\(--rail-ink\)/,
    "Studio rail focus outlines must use a rail-contrasting color");
  assert.match(studioCss, /\.appearance-option:has\(input:checked\)/,
    "The selected appearance must have a visible state");
  assert.match(ui, /ConvertTo-AuraUiStudioNumber[\s\S]*?\[double\]::IsNaN[\s\S]*?\[double\]::IsInfinity/,
    "Studio crop values must reject non-finite numbers");
  assert.match(ui, /\[Globalization\.CultureInfo\]::InvariantCulture/,
    "Studio crop values must serialize with a CSS-safe invariant decimal separator");
  assert.match(ui, /backgroundAspectRatio\s*=\s*Get-AuraUiBackgroundAspectRatio/,
    "Studio must receive the current Claude WebView aspect ratio for WYSIWYG background framing");
  assert.match(ui, /\[IO\.FileShare\]::Read\)[\s\S]*?ComputeHash\(\$sourceStream\)[\s\S]*?Clear-AuraUiStudioBackgroundPreview[\s\S]*?\$sourceStream\.CopyTo\(\$targetStream\)/,
    "Studio preview copies must hash and hold the source open while clearing owned cache files");
  assert.match(ui, /\$StudioBackgroundMaxBytes\s*=\s*16\s*\*\s*1024\s*\*\s*1024[\s\S]*?\$sourceStream\.Length[\s\S]*?-gt\s+\$StudioBackgroundMaxBytes/,
    "Studio preview copies must recheck the open source against the 16 MB limit");
  assert.match(ui, /\.aura-cache/,
    "Studio preview cleanup must be limited to marker-owned cache files");
  assert.match(baseCss, /\.claude-aura-image\s*\{[^}]*inset:\s*0[^}]*transform:\s*scale\(var\(--aura-image-scale,\s*1\)\)/s,
    "The live image layer must use the same exact frame and zoom model as Studio");
  const contentScopeArtRule = baseCss.match(/#claude-aura-backdrop\[data-art-scope="content"\]\s+\.claude-aura-theme-art\s*\{([^}]*)\}/)?.[1] ?? "";
  assert.match(contentScopeArtRule, /left:\s*var\(--aura-main-start,\s*0\)/,
    "Content-canvas artwork must begin after the marked live sidebar");
  assert.match(contentScopeArtRule, /overflow:\s*hidden/,
    "Content-canvas framed artwork must clip before it can spill under the sidebar");
  assert(!/#claude-aura-backdrop\[data-art-scope="full-window"\]\s+\.claude-aura-theme-art\s*\{[^}]*overflow:\s*hidden/s.test(baseCss),
    "Full-window artwork must remain free to continue behind the translucent sidebar");
  assert.match(studioApp, /send\(\{\s*type:\s*"set-image"\s*\}\)/,
    "The Studio page must let the host choose image paths");
  for (const action of ["set-theme", "set-appearance", "set-image", "clear-image", "set-enabled", "open-aura", "open-desktop"]) {
    assert(new RegExp(`type:\\s*"${action}"`).test(studioApp),
      `Studio must retain the ${action} capability removed from the main toolbar`);
  }
  assert.match(studioApp, /\{\s*type:\s*"set-image-framing"\s*,\s*\.\.\.saved\s*\}/,
    "The Studio page must persist background framing without supplying a path");
  assert.match(studioApp, /\{\s*type:\s*"set-card-preview-crop"\s*,\s*theme:/,
    "The Studio page must persist per-theme card framing");
  assert.match(studioApp, /send\(\{\s*type:\s*"import-theme"\s*\}\)/,
    "The Studio page must let the host choose import paths");
  assert.match(studioHtml,
    /<button\s+type="button"\s+id="open-aura"\s+class="ghost-button"\s+data-i18n="auraWindow">Back to Claude Aura<\/button>/,
    "Studio must expose an accessible, localized route back to its Aura window");
  assert.match(studioApp,
    /document\.getElementById\("open-aura"\)\.addEventListener\("click",\s*\(\)\s*=>\s*send\(\{\s*type:\s*"open-aura"\s*\}\)\)/,
    "Studio must send a type-only open-aura bridge message");
  for (const copy of ["Back to Claude Aura", "返回 Claude Aura", "回到 Claude Aura"]) {
    assert(studioApp.includes(`auraWindow: "${copy}"`), `Studio back-navigation copy is missing ${copy}`);
  }
  const documentFrameRule = studioCss.match(/html,\s*\nbody\s*\{([^}]*)\}/)?.[1] ?? "";
  assert.match(documentFrameRule, /width:\s*100%/);
  assert.match(documentFrameRule, /height:\s*100%/);
  assert.match(documentFrameRule, /overflow:\s*hidden/,
    "The Studio document must not create a blank outer scrollbar");
  const studioShellRule = studioCss.match(/\.studio\s*\{([^}]*)\}/)?.[1] ?? "";
  assert.match(studioShellRule, /min-width:\s*0/);
  assert.match(studioShellRule, /min-height:\s*0/);
  assert.match(studioShellRule, /overflow:\s*hidden/,
    "The Studio shell must contain scrolling inside its intended region");
  const studioContentRule = studioCss.match(/(?:^|\n)\.content\s*\{([^}]*)\}/)?.[1] ?? "";
  assert.match(studioContentRule, /min-width:\s*0/);
  assert.match(studioContentRule, /min-height:\s*0/);
  assert.match(studioContentRule, /overflow:\s*auto/,
    "Studio content must remain usable at its supported minimum size");
  const studioRailRule = studioCss.match(/\.rail\s*\{([^}]*)\}/)?.[1] ?? "";
  assert(!/overflow(?:-x|-y)?:\s*(?:auto|scroll)/.test(studioRailRule),
    "The Studio rail must not become a competing page scroller");
  assert.match(studioCss, /\.rail-foot\s*\{[^}]*display:\s*grid[^}]*gap:\s*8px[^}]*\}/,
    "The Aura and official Desktop actions must remain separately usable in the rail");
  assert.match(ui, /\$script:StudioForm\.MinimumSize\s*=\s*\[Drawing\.Size\]::new\(760,\s*560\)/,
    "Studio must retain its tested minimum window size");
  assert.match(studioApp, /syncHostThemes\(data\.themes\)/,
    "Studio must refresh its theme cards from validated host metadata after import");
  assert.match(studioApp, /source !== "builtin"[\s\S]{0,80}?source !== "user"/,
    "Studio must reject unknown host theme sources");
  assert.match(studioApp, /Object\.hasOwn\(themes,\s*incomingTheme\.name\)\s*\?\s*themes\[incomingTheme\.name\]\s*:\s*null/,
    "Studio must treat valid ids such as constructor as own theme keys, not inherited object properties");
  assert.match(studioHtml, /class="rail-item is-current"[^>]*aria-current="page"/,
    "Studio must expose the current navigation destination semantically");
  assert.match(studioApp, /removeAttribute\("aria-current"\)/);
  assert.match(studioApp, /setAttribute\("aria-current",\s*"page"\)/);
  assert.match(studioApp,
    /const activateRailLink[\s\S]{0,900}?window\.scrollTo\(0,\s*0\)[\s\S]{0,300}?content\.scrollTo\([\s\S]{0,900}?link\.addEventListener\("click",\s*\(event\)\s*=>\s*\{[\s\S]{0,180}?event\.preventDefault\(\)/,
    "Rail navigation must scroll only Studio content and repair any displaced WebView root scroll");
  assert.match(studioEditor,
    /const resetStudioViewport[\s\S]{0,300}?history\.replaceState\(null,\s*"",\s*hash\)[\s\S]{0,220}?window\.scrollTo\(0,\s*0\)[\s\S]{0,100}?content\.scrollTop\s*=\s*0/,
    "Editor transitions must reset the hidden outer scroller and the ordinary content pane");
  assert.match(studioEditor,
    /const showEditor[\s\S]{0,480}?resetStudioViewport\("#editor"\)[\s\S]{0,260}?requestAnimationFrame\(\(\)\s*=>\s*\{[\s\S]{0,100}?resetStudioViewport\("#editor"\)/,
    "Opening the editor must reassert its clean viewport after the hidden sections reflow");
  assert.match(studioApp, /image\.className = "theme-card-preview";[\s\S]{0,160}?image\.alt = "";[\s\S]{0,160}?image\.setAttribute\("aria-hidden", "true"\)/,
    "Studio selector previews must be decorative images");
  assert.match(studioHtml, /<dialog id="crop-dialog"[\s\S]*?id="crop-stage"[\s\S]*?id="crop-zoom"/,
    "Studio must provide one reusable, labelled framing dialog with zoom");
  assert.match(studioApp, /setPointerCapture\(event\.pointerId\)/,
    "Studio framing must keep pointer drags captured outside the crop stage");
  assert.match(studioHtml, /id="crop-x"[^>]*type="range"[\s\S]*id="crop-y"[^>]*type="range"[\s\S]*id="crop-zoom"[^>]*type="range"/,
    "Studio framing must expose native keyboard-operable controls for every crop dimension");
  assert(!/id="crop-stage"[^>]*tabindex/.test(studioHtml),
    "The pointer-only crop canvas must not masquerade as a keyboard control");
  assert.match(studioHtml, /id="crop-error"[^>]*role="status"[^>]*aria-live="polite"/,
    "Crop failures must be announced inside the modal dialog");
  assert.match(studioApp, /pendingCropSave[\s\S]*cropsEqual\(persisted,\s*pending\.crop\)/,
    "Studio must wait for host-confirmed persisted crop state before closing the dialog");
  assert.match(studioApp, /addEventListener\("pointerdown"[\s\S]{0,240}?pendingCropSave/,
    "Studio must freeze pointer dragging while a framing save acknowledgement is pending");
  assert.match(studioApp, /data\.action\s*===\s*pendingCropSave\.action[\s\S]*data\.actionSucceeded/,
    "Studio must ignore unrelated host state while a framing save is pending");
  assert.match(studioApp, /cropCancelButtons[\s\S]*button\.disabled\s*=\s*busy[\s\S]*addEventListener\("cancel"[\s\S]*pendingCropSave[\s\S]*preventDefault/,
    "Studio must prevent closing and reopening a crop editor while its save acknowledgement is pending");
  assert.match(studioHtml, /id="crop-notice"[^>]*role="status"/,
    "Studio must disclose when an advanced CSS position will be normalized by the visual editor");
  assert.match(studioCss, /\.crop-stage\s*\{[^}]*touch-action:\s*none[^}]*\}/,
    "Touch gesture suppression must be scoped to the crop stage");
  assert.match(assetConverter, /const cardSelection = cardsOnly\s*\?[\s\S]{0,280}:\s*\{\};/,
    "Ordinary runtime-asset conversion must not depend on gitignored Studio reference images");
  assert.match(assetConverter, /args\[0\]\s*===\s*['"]--studio-import['"]/,
    "Artwork conversion must use a dedicated host-only mode");
  assert.match(assetConverter, /args\.length\s*!==\s*6[\s\S]{0,180}?--target[\s\S]{0,180}?--output-root/,
    "Studio conversion must reject unrecognized or missing command arguments");
  assert.match(assetConverter, /sourceStat\.isSymbolicLink\(\)[\s\S]{0,180}?16\s*\*\s*1024\s*\*\s*1024/,
    "Studio conversion must reject symbolic-link and oversized source files");
  assert.match(assetConverter, /!rootStat\.isDirectory\(\)\s*\|\|\s*rootStat\.isSymbolicLink\(\)/,
    "Studio conversion must reject a redirected output root");
  assert.match(assetConverter, /!parentStat\.isDirectory\(\)\s*\|\|\s*parentStat\.isSymbolicLink\(\)/,
    "Studio conversion must reject a redirected output folder");
  assert.match(assetConverter, /pathIsWithin\(resolvedRoot,\s*resolvedTarget\)[\s\S]{0,180}?\^layer-\[0-9a-f\]\{32\}\\\.webp\$/,
    "Studio conversion targets must be opaque WebP names below the editor root");
  assert.match(assetConverter, /for\s*\(let step = 0; step < 18 && !selected; step \+= 1\)/,
    "Studio conversion must make a bounded series of resize/quality attempts");
  assert.match(assetConverter, /Math\.pow\(0\.84,\s*Math\.floor\(step\s*\/\s*qualities\.length\)\)/);
  assert.match(assetConverter, /blob\.size\s*>\s*0\s*&&\s*blob\.size\s*<\s*400000/,
    "Studio conversion must keep resizing until the raster fits its layer budget");
  assert.match(assetConverter, /detectStudioImage\(bytes\)\s*!==\s*['"]image\/webp['"]/,
    "Studio conversion must verify WebP content before writing");
  assert.match(assetConverter, /!Number\.isInteger\(width\)[\s\S]{0,180}?!Number\.isInteger\(height\)[\s\S]{0,180}?dimensions are invalid/,
    "Studio conversion must verify positive integer dimensions before writing");
  assert.match(assetConverter, /await fs\.writeFile\(temporary,[\s\S]{0,180}?await fs\.rename\(temporary,\s*resolvedTarget\)/,
    "Studio conversion must publish through an atomic temporary-file rename");
  const unknownRuntimeTheme = spawnSync(process.execPath, [
    path.join(PROJECT_ROOT, "scripts", "convert-theme-assets.mjs"),
    "not-installed",
  ], { cwd: PROJECT_ROOT, encoding: "utf8" });
  assert.notEqual(unknownRuntimeTheme.status, 0,
    "Unknown runtime theme IDs must not become silent no-ops");
  assert.match(`${unknownRuntimeTheme.stdout}\n${unknownRuntimeTheme.stderr}`, /Unknown theme/);

  const cardBodyRule = studioCss.match(/\.theme-card-body\s*\{([^}]*)\}/)?.[1] ?? "";
  assert.match(cardBodyRule, /display:\s*block/,
    "Theme-card body padding must contain its block children");
  assert.match(cardBodyRule, /padding:\s*14px\s+16px\s+16px/,
    "Theme-card labels need a comfortable inset from the border");
  const currentRailRule = studioCss.match(/\.rail-item\.is-current\s*\{([^}]*)\}/)?.[1] ?? "";
  assert(!/box-shadow/.test(currentRailRule),
    "Current navigation must not stack an inset shadow under the focus ring");
  assert.match(studioCss, /\.rail-item:focus-visible\s*\{[^}]*outline-width:\s*2px[^}]*\}/);
  const checkedCardRule = studioCss.match(/\.theme-card input:checked \+ label\s*\{([^}]*)\}/)?.[1] ?? "";
  assert(!/0\s+0\s+0/.test(checkedCardRule),
    "Selected cards must not add a second ring-like box shadow");
  assert.match(studioCss, /\.theme-card-preview\s*\{[^}]*object-fit:\s*cover[^}]*\}/);
  assert.match(studioCss, /\.theme-card-preview-frame\s*\{[^}]*aspect-ratio:\s*3\s*\/\s*2[^}]*\}/,
    "Card framing needs a real crop window instead of the source image's identical 16:9 ratio");
  assert.match(studioApp, /const CARD_PREVIEW_MAX_ZOOM\s*=\s*6/,
    "Full Studio preview masters need enough zoom to reach the former tight crops");
  assert.match(studioApp, /defaultCropForTheme[\s\S]{0,320}?studioPreviewFrame/,
    "Studio cards must apply registry framing metadata without rewriting their masters");
  assert.match(studioApp, /aura\.previews[\s\S]{0,180}?\.png/,
    "Studio cards must load preserved preview masters from their isolated virtual host");
  assert.match(ui, /SetVirtualHostNameToFolderMapping\(\s*['"]aura\.previews['"][\s\S]{0,120}?\$StudioPreviewRoot/,
    "The host must expose only the categorized preview-master directory");
  assert.match(ui, /SetVirtualHostNameToFolderMapping\(\s*['"]aura\.user-themes['"][\s\S]{0,120}?\$UserThemesRoot/,
    "Studio must be able to display a validated user theme's app mark");
  assert.match(studioHtml, /id="rail-theme-mark"/,
    "Aura Studio must show the active theme identity in its own rail");
  assert.match(studioApp, /launcherMarkUrl\(identityTheme\)/,
    "Switching the active theme must update Studio's app identity");

  const editorScriptIndex = studioHtml.indexOf('<script src="editor.js"></script>');
  const appScriptIndex = studioHtml.indexOf('<script src="app.js"></script>');
  assert(editorScriptIndex >= 0 && appScriptIndex > editorScriptIndex,
    "The isolated editor module must load before the Studio bridge glue");
  assert.equal((studioApp.match(/bridge\.addEventListener\("message"/g) ?? []).length, 1,
    "Studio must retain one host bridge listener for gallery and editor state");
  assert.match(studioApp, /editorController\s*=\s*window\.CLAUDE_AURA_EDITOR\?\.createController/,
    "Studio must initialize the isolated editor controller through its public API");
  assert.match(studioApp, /editorController\?\.receive\(data\.editor,\s*state\.appearance\)/,
    "The sole Studio bridge listener must pass validated editor state to the editor controller");
  assert.match(studioHtml, /id="start-theme"[^>]+data-i18n="startTheme"/,
    "The Create page must offer a direct visual-editor entry instead of leading with CLI setup");
  assert.match(studioApp,
    /getElementById\("start-theme"\)\.addEventListener\("click",[\s\S]{0,180}?type:\s*"create-theme-copy",\s*theme:\s*"default"/,
    "The visual creation entry must duplicate Default through the existing validated action");
  assert.match(studioHtml, /<details class="create-inline-guide">[\s\S]*?data-i18n="createStepName"[\s\S]*?<\/details>/,
    "The Create page must explain the casual visual flow inline");
  assert(!studioHtml.includes('id="open-guide"') && !studioApp.includes('"open-guide"'),
    "Studio must not expose the unsupported open-guide bridge action");
  const literalPageActions = new Set([
    ...studioApp.matchAll(/send\(\{\s*type:\s*"([a-z-]+)"/g),
    ...studioEditor.matchAll(/send\(\{\s*type:\s*"([a-z-]+)"/g),
  ].map((match) => match[1]));
  for (const action of literalPageActions) {
    assert(studioMessageTypes.includes(action), `The page emits ${action}, which the host bridge does not allow`);
  }
  assert.match(studioApp, /source === "builtin"[\s\S]{0,260}?type:\s*"create-theme-copy"/,
    "Built-in theme cards must expose duplicate-to-customize instead of direct editing");
  assert.match(studioApp, /type:\s*"begin-theme-edit",\s*theme:\s*theme\.name,\s*reset:\s*false/,
    "User theme cards must begin an explicit edit session");
  assert.match(studioEditor, /send\(\{\s*type:\s*"delete-user-theme",\s*theme\s*\}\)/,
    "User theme deletion must send only the validated theme id");
  assert.match(studioEditor, /\["launcher-mark",\s*"slotLauncherMark"\]/,
    "The local customization prompt builder must offer the app and launcher mark slot");
  assert.match(studioEditor, /launcherPromptTemplate[\s\S]{0,420}?96×96[\s\S]{0,260}?72×72/,
    "The launcher prompt must name the exact output size and compact safe area");
  assert.match(studioEditor, /promptRuleLauncher[\s\S]{0,280}?(?:title bar|标题栏|標題列)/,
    "The launcher prompt must explain that one theme mark serves the complete app identity");
  assert(!/(?:fetch\s*\(|XMLHttpRequest|WebSocket|EventSource|chrome\s*\.\s*webview|postMessage\s*\()/i.test(studioEditor),
    "The editor module must not own network or host-bridge access");
  assert(!/(?:dragstart|dragend|ondrop|dataTransfer)/i.test(studioEditor),
    "The editor must not use HTML5 drag-and-drop; stage drags are pointer events with keyboard alternatives");
  assert.match(studioEditor, /direction:\s*"up"/,
    "Layer ordering must keep its keyboard-operable move-up button");
  assert.match(studioEditor, /direction:\s*"down"/,
    "Layer ordering must keep its keyboard-operable move-down button");
  assert.match(studioEditor, /"ArrowLeft"[\s\S]{0,900}?"ArrowRight"[\s\S]{0,900}?"ArrowUp"[\s\S]{0,900}?"ArrowDown"/,
    "Every stage pointer drag must keep an arrow-key alternative");
  assert.match(studioEditor, /tabIndex = 0/,
    "Stage items must be keyboard focusable");
  assert.match(studioEditor, /const stageKeyPaths = new Set\(\)/,
    "Debounced keyboard edits must retain every affected path");
  const flushStageKeyBlock = studioEditor.match(/const flushStageKeyChanges\s*=\s*\(\)\s*=>[\s\S]*?\n\s*};/)?.[0] ?? "";
  assert.match(flushStageKeyBlock, /stageKeyPaths\.clear\(\)[\s\S]{0,180}?commitStagePaths\(paths\)/,
    "Debounced keyboard edits must flush their pending paths before document actions");
  const stageEscapeBlock = studioEditor.match(/if \(event\.key === "Escape"\) \{[\s\S]*?\n\s*return;\n\s*}/)?.[0] ?? "";
  assert.match(stageEscapeBlock, /stageKeyPaths\.delete\(path\)[\s\S]{0,400}?reflectStageInputs\(paths\)/,
    "Escape must cancel pending keyboard paths and restore their inspector values");
  const buttonStateBlock = studioEditor.match(/const reflectButtonStates\s*=\s*\(\)\s*=>[\s\S]*?\n\s*};/)?.[0] ?? "";
  assert.match(buttonStateBlock, /stageKeyTimer\s*\|\|\s*stageKeyPaths\.size/,
    "Document actions must remain gated until keyboard adjustments are committed");
  assert.match(studioEditor,
    /eye\.setAttribute\("aria-pressed",[\s\S]{0,240}?format\(tr\("stageEyeToggle"\),\s*layer\.index \+ 1/,
    "Preview visibility toggles must have stable, image-specific accessible names");
  for (const queueContract of ["coalescedChanges", "queueThemeChange", "queueThemeChanges", "flushThemeChanges"]) {
    assert(studioEditor.includes(queueContract), `Editor mutation coalescing is missing ${queueContract}`);
  }
  assert.match(studioEditor, /coalescedChanges\.(?:set|has)\(/,
    "Rapid edits must coalesce by logical field instead of being dropped while a request is pending");
  const queueThemeChangesBlock = studioEditor.match(/const queueThemeChanges\s*=\s*\([\s\S]*?\n\s*};/)?.[0] ?? "";
  assert.match(queueThemeChangesBlock, /coalescedChanges\.set\(/,
    "The mutation queue must keep the latest value for each logical field");
  assert.match(studioEditor, /type:\s*"apply-theme-patch"[\s\S]{0,180}?changes/,
    "Every queued editor gesture must cross the bridge as one bounded theme patch");
  assert.match(studioEditor, /state\s*=\s*normalized[\s\S]{0,900}?flushThemeChanges\(\)/,
    "Queued rapid edits must resume with the host-confirmed revision after each patch response");
  const patchSettlementBlock = studioEditor.match(/const settlePendingAction\s*=\s*\(normalized\)[\s\S]*?\n\s*};/)?.[0] ?? "";
  assert.match(patchSettlementBlock, /normalized\.revision\s*!==\s*inFlightRevision\s*\+\s*1/,
    "A repeated prior patch result must not acknowledge the current in-flight patch");
  assert.match(patchSettlementBlock,
    /actionError\s*===\s*"request-rejected"[\s\S]*?normalized\.revision\s*>\s*inFlightRevision[\s\S]*?requeueInFlightChanges\(\)[\s\S]*?deferInFlightChanges\(\)/,
    "Only a confirmed stale revision may auto-requeue a rejected patch");
  assert.match(studioEditor, /settlement\s*!==\s*"blocked"[\s\S]{0,100}?flushThemeChanges\(\)/,
    "A same-revision permanent rejection must stop instead of retrying forever");
  assert.match(studioEditor, /const deferredChanges\s*=\s*new Map\(\)/,
    "Rejected local values must remain deferred for a fresh user edit");
  assert.match(studioEditor, /const queueTokenChange[\s\S]{0,260}?queueThemeChange/,
    "Palette, style, and layout token edits must use the same coalescing queue as the stage");
  assert.match(studioEditor, /const queueLayerChange[\s\S]{0,260}?queueThemeChange/,
    "Layer inspector edits must use the same coalescing queue as stage gestures");
  const frameCopyBlock = studioEditor.match(/const copyLayerFraming\s*=\s*\([\s\S]*?\n\s*};/)?.[0] ?? "";
  assert.match(frameCopyBlock, /queueStageMutations/,
    "Copying a framing preset must submit one atomic patch");
  assert.match(studioEditor, /const queueStageMutations[\s\S]{0,700}?queueThemeChanges/,
    "Stage gesture batches must enter the shared atomic mutation queue");
  for (const property of ["anchor", "focalX", "focalY", "positionX", "positionY", "scale"]) {
    assert(frameCopyBlock.includes(`"${property}"`), `Atomic frame copy omits ${property}`);
  }
  assert.match(studioHtml, /id="editor-stage"[^>]*role="group"/,
    "The live framing stage must be a labelled group, not a reconstructed Claude page");
  assert.equal((studioHtml.match(/type="radio" name="stage-viewport"/g) ?? []).length, 2,
    "The stage must expose native normal and wide framing toggles");
  assert.equal((studioHtml.match(/type="radio" name="stage-context"/g) ?? []).length, 2,
    "The stage must expose native new-chat and conversation context toggles");
  assert.match(studioEditor,
    /window\.CLAUDE_AURA_EDITOR\s*=\s*Object\.freeze\(\{\s*createController,\s*normalizeEditorState,\s*normalizeStudioStyle\s*\}\)/,
    "The editor module must expose only its controller and strict state/style validators");

  const editorActionMatch = studioEditor.match(/const ACTIONS\s*=\s*new Set\(\[([\s\S]*?)\]\);/);
  assert(editorActionMatch, "The editor action allowlist is missing");
  assert.deepEqual([...editorActionMatch[1].matchAll(/["']([^"']+)["']/g)].map((match) => match[1]),
    Object.keys(expectedEditorMessageShapes),
  "The editor page and Windows host must share the exact editor action allowlist");

  const editorStringsMatch = studioEditor.match(/const STRINGS\s*=\s*(\{[\s\S]*?\n  \});\n\n  const ID_PATTERN/);
  assert(editorStringsMatch, "Editor locale dictionaries could not be isolated");
  const editorStrings = new Function(`return (${editorStringsMatch[1]});`)();
  assert.deepEqual(Object.keys(editorStrings).sort(), ["en", "zh-CN", "zh-TW"]);
  const editorCopyKeys = Object.keys(editorStrings.en).sort();
  assert(editorCopyKeys.length >= 180, "The editor locale surface is unexpectedly incomplete");
  for (const locale of ["zh-CN", "zh-TW"]) {
    assert.deepEqual(Object.keys(editorStrings[locale]).sort(), editorCopyKeys,
      `${locale} editor copy does not cover the same UI states as English`);
    for (const key of editorCopyKeys) assert(String(editorStrings[locale][key]).trim(), `${locale}.${key} is empty`);
  }
  assert.equal(editorStrings["zh-CN"].interfaceFont, "界面字体");
  assert.equal(editorStrings["zh-CN"].addLayer, "添加图层");
  assert.equal(editorStrings["zh-CN"].saveTheme, "保存主题");
  assert.equal(editorStrings["zh-CN"].fullWindow, "整个窗口");
  assert.equal(editorStrings["zh-TW"].interfaceFont, "介面字體");
  assert.equal(editorStrings["zh-TW"].addLayer, "新增圖層");
  assert.equal(editorStrings["zh-TW"].saveTheme, "儲存主題");
  assert.equal(editorStrings["zh-TW"].fullWindow, "整個視窗");
  assert.notEqual(editorStrings["zh-CN"].guideOnlyNotice, editorStrings["zh-TW"].guideOnlyNotice,
    "Simplified and Traditional Chinese editor guidance must remain independently authored");
  assert.match(editorStrings.en.stageContextMismatch, /Open \{0} in Aura once[\s\S]*editing session/);
  assert.match(editorStrings["zh-CN"].stageContextMismatch, /Aura[\s\S]*打开一次\{0}[\s\S]*本次编辑/);
  assert.match(editorStrings["zh-TW"].stageContextMismatch, /Aura[\s\S]*開啟一次\{0}[\s\S]*這次編輯/);

  assert.match(studioHtml, /id="nav-editor"[^>]+href="#editor"[^>]+hidden/,
    "The editor navigation destination must appear only during an active edit session");
  assert.equal((studioHtml.match(/type="radio" name="editor-mode"/g) ?? []).length, 2,
    "The editor must use native Light and Dark radio controls");
  assert((studioHtml.match(/class="[^"]*segmented-control[^"]*"/g) ?? []).length >= 4,
    "Closely related preview and editor-mode choices must share one quiet segmented-control language");
  assert.match(studioEditorCss,
    /\.segmented-control input\s*\{[^}]*position:\s*absolute[^}]*clip-path:\s*inset\(50%\)/,
    "Segmented controls must retain native focusable radios while hiding redundant radio dots visually");
  assert.match(studioEditorCss,
    /\.segmented-control label:has\(input:focus-visible\)\s*\{[^}]*outline:\s*3px solid var\(--ring\)/,
    "The de-boxed segmented controls must keep an explicit keyboard focus treatment");
  assert.equal((studioHtml.match(/type="radio" name="background-scope"/g) ?? []).length, 2,
    "The editor must use native Main area only and Entire window radio controls");
  assert.match(studioHtml,
    /data-editor-i18n="contentCanvas">Main area only<\/span>[\s\S]{0,500}?data-editor-i18n="fullWindow">Entire window<\/span>/,
    "The no-script fallback must use the same background-scope labels as the English editor");
  for (const control of [
    "editor-font-ui", "editor-font-display", "editor-radius", "editor-blur", "editor-shadow",
    "editor-prompt-width", "editor-prompt-x", "editor-prompt-y", "editor-undo", "editor-redo",
    "editor-reset", "editor-add-layer", "editor-back", "editor-cancel", "editor-save",
  ]) assert(studioHtml.includes(`id="${control}"`), `Editor is missing the native ${control} control`);
  assert.equal((studioHtml.match(/id="editor-save"/g) ?? []).length, 1,
    "The persistent header Save action must be unique");
  assert.match(studioHtml, /class="editor-section editor-identity"/,
    "Quick customize must expose theme identity without opening Advanced");
  assert.match(studioHtml, /class="editor-section editor-prompt-context" data-editor-panel="layout"/,
    "Quick customize canvas selection must have a real new-chat placement context even though its navigation tab is Advanced-only");
  for (const [id, locale] of [["editor-label-en", "en"], ["editor-label-zh-cn", "zh-CN"], ["editor-label-zh-tw", "zh-TW"]]) {
    assert.match(studioHtml, new RegExp(`id="${id}"[^>]+maxlength="80"[^>]+data-editor-metadata="label"[^>]+data-editor-locale="${locale}"`),
      `${locale} theme names must use the localized 80-character metadata contract`);
  }
  for (const [id, locale] of [["editor-description-en", "en"], ["editor-description-zh-cn", "zh-CN"], ["editor-description-zh-tw", "zh-TW"]]) {
    assert.match(studioHtml, new RegExp(`id="${id}"[^>]+maxlength="220"[^>]+data-editor-metadata="description"[^>]+data-editor-locale="${locale}"`),
      `${locale} theme descriptions must use the localized 220-character metadata contract`);
  }
  const metadataChangeBlock = studioEditor.match(/metadataInputs\.forEach\([\s\S]*?\n\s*}\)\);/)?.[0] ?? "";
  assert.match(metadataChangeBlock, /queueThemeChange\s*\(\s*\{[\s\S]{0,120}?kind:\s*"metadata"/,
    "Localized identity edits must use the same lossless mutation queue as visual controls");
  assert.match(metadataChangeBlock, /editorMetadata[\s\S]{0,360}?editorLocale/,
    "Localized identity edits must preserve the allowlisted metadata field and locale");
  const addRoleMarkup = studioHtml.match(/<select id="editor-add-layer-role">([\s\S]*?)<\/select>/)?.[1] ?? "";
  assert.deepEqual([...addRoleMarkup.matchAll(/<option value="([^"]+)"/g)].map((match) => match[1]),
    ["background", "hero", "corner", "decoration"],
    "Quick image import must offer the four supported image types without four exposed radio boxes");
  assert.match(studioEditor, /const selectedArtworkRole[\s\S]{0,180}?ROLE_IDS\.includes\(addLayerRoleSelect\?\.value\)/,
    "Image import must validate the compact type selector before passing the role to the host");
  const privacyNotice = studioHtml.match(/<p\b[^>]*class="[^"]*mirror-privacy-notice[^"]*"[^>]*data-editor-i18n="mirrorPrivacy"[^>]*>/)?.[0] ?? "";
  assert(privacyNotice && !privacyNotice.includes("advanced-only"),
    "The local-capture privacy disclosure must remain visible in Quick customize");
  assert(privacyNotice.includes('id="stage-privacy"')
      && /id="editor-stage"[^>]+aria-describedby="stage-privacy"/.test(studioHtml),
    "The direct-manipulation canvas must be explicitly associated with its privacy disclosure");
  assert(studioHtml.indexOf(privacyNotice) < studioHtml.indexOf('id="editor-stage"'),
    "The local-capture privacy disclosure must precede the primary live canvas");
  assert(studioHtml.indexOf('class="editor-body"') < studioHtml.indexOf('id="editor-quick-feedback"')
      && studioHtml.indexOf('class="stage-toolbar stage-toolbar-primary stage-viewport-toolbar"') < studioHtml.indexOf('id="editor-stage"')
      && studioHtml.indexOf('id="editor-stage"') < studioHtml.indexOf('id="editor-quick-feedback"'),
    "The canvas and its dimension chrome must appear before inspector feedback and history on entry");
  assert(studioHtml.indexOf('id="editor-stage"') < studioHtml.indexOf('data-editor-i18n="stageNotice"')
      && studioHtml.indexOf('id="editor-stage"') < studioHtml.indexOf('class="editor-review-states advanced-only"'),
    "The canvas must appear before explanatory and advanced review content at supported window heights");
  assert.match(studioHtml, /id="editor-live"[^>]+role="status"[^>]+aria-live="polite"/,
    "Editor mutations must be announced through a polite live region");
  assert.match(studioHtml, /id="editor-error-summary"[^>]+role="status"[^>]+aria-live="polite"[^>]+tabindex="-1"/,
    "Editor validation errors must be focusable and announced");
  assert.match(studioEditor, /focusBelowInspector\(errorSummary\)/,
    "A blocked save must move focus to its visible validation summary");
  assert.match(studioEditor, /data-editor-focus[\s\S]{0,240}?\.focus\(\)/,
    "Rerendered editor controls must restore logical keyboard focus");
  assert.match(studioEditor, /(?:function|const)\s+revealAdvancedForError\b/,
    "Validation recovery must reveal Advanced controls before focusing a hidden issue");
  assert.match(studioEditor, /focusError[\s\S]{0,240}?revealAdvancedForError/,
    "Go to first issue must make its target actionable from Quick customize");
  const focusErrorBlock = studioEditor.match(/const focusError\s*=\s*\([\s\S]*?\n\s*};/)?.[0] ?? "";
  assert.match(focusErrorBlock,
    /const contrast[\s\S]{0,700}?target\?\.closest\("\.advanced-only"\)[\s\S]{0,260}?editor\.dataset\.level\s*=\s*"advanced"/,
    "A Quick customize contrast issue must reveal its Advanced color group");
  assert.match(focusErrorBlock,
    /target\?\.closest\("details"\)\?\.setAttribute\("open",\s*""\)[\s\S]{0,80}?focusBelowInspector\(target\)/,
    "Validation recovery must open a collapsed palette group before focusing its control");
  const focusBelowInspectorBlock = studioEditor.match(
    /const focusBelowInspector\s*=\s*\([\s\S]*?\n\s*};/)?.[0] ?? "";
  assert.match(focusBelowInspectorBlock, /focus\(\{\s*preventScroll:\s*true\s*}\)/,
    "Validation focus must suppress the browser's sticky-header-obscured scroll position");
  assert.match(focusBelowInspectorBlock,
    /inspectorHead\.getBoundingClientRect\(\)\.bottom[\s\S]{0,400}?editorControls\.scrollTop\s*\+=\s*delta/,
    "Validation recovery must measure the live inspector header and scroll the target below it");
  assert.match(studioEditor, /(?:function|const)\s+validationMessageFor\b/,
    "Validation summaries must translate safe error categories into recovery guidance");
  assert(!/format\(tr\("validationIssue"\),\s*first\.field\)/.test(studioEditor),
    "Quick validation must not expose raw schema paths to casual users");
  assert.match(studioEditor, /queueTokenChange\("mode-copy",\s*"tokens",\s*"light"\)/);
  assert.match(studioEditor, /queueTokenChange\("mode-copy",\s*"tokens",\s*"dark"\)/,
    "Light and Dark token-copy conveniences must use validated bridge enums");
  assert.match(studioEditor, /queueTokenChange\("shared",\s*"backgroundScope",\s*input\.value\)/,
    "Background scope must persist through the validated shared-token route");
  assert.match(studioEditor, /input\.valueAsNumber\s*\/\s*100/,
    "Prompt placement ranges must normalize to the schema ratios");
  const layerRangeBlock = studioEditor.match(/const layerRange\s*=\s*\([\s\S]*?\n\s*};\s*\n\s*\n\s*const renderFrame/)?.[0] ?? "";
  assert.match(layerRangeBlock, /layer-range-pair/,
    "Advanced layer sliders must be grouped with an exact numeric input");
  assert.match(layerRangeBlock, /type\s*=\s*"number"[\s\S]{0,240}?layer-exact-value/,
    "Advanced layer framing must accept copyable exact numeric values");
  assert.match(layerRangeBlock, /\.min\s*=\s*(?:range\.)?min|\.min\s*=\s*String\(min\)/,
    "The exact layer input must retain the slider's minimum");
  assert.match(layerRangeBlock, /\.max\s*=\s*(?:range\.)?max|\.max\s*=\s*String\(max\)/,
    "The exact layer input must retain the slider's maximum");
  assert.match(layerRangeBlock, /\.step\s*=\s*(?:range\.)?step|\.step\s*=\s*String\(step\)/,
    "The exact layer input must retain the slider's precision");
  assert((layerRangeBlock.match(/addEventListener\("(?:input|change)"/g) ?? []).length >= 3,
    "Range and numeric layer controls must mirror each other and commit the exact value");
  assert.match(studioEditor, /state\.layers\.length\s*>=\s*8/,
    "The editor must disable or reject a ninth artwork layer");
  assert.match(studioEditor,
    /saveButton\.disabled\s*=\s*busy\s*\|\|\s*\(state\.feedback\.valid\s*&&\s*\(blocked\s*\|\|\s*\(!state\.dirty\s*&&\s*!state\.isNew\)\)\)/,
    "A fresh duplicate and an invalid draft must keep Save actionable for saving or issue recovery");
  assert.match(studioHtml,
    /id="editor-save"[^>]+aria-describedby="editor-quick-feedback editor-error-summary"/,
    "The persistent Save action must expose its nearby validation explanation");
  const saveHandlerBlock = studioEditor.match(
    /const performSave\s*=\s*\(\)\s*=>\s*\{[\s\S]*?\n\s*};/)?.[0] ?? "";
  assert.match(studioEditor, /saveButton\.addEventListener\("click",\s*performSave\)/,
    "The Save button must invoke the shared save handler so click and keyboard save behave identically");
  assert.match(saveHandlerBlock,
    /!state\?\.feedback\.valid[\s\S]{0,180}?focusBelowInspector\(errorSummary\)[\s\S]{0,120}?announce\(tr\("saveBlocked"\),\s*"error"\)/,
    "Activating Save on an invalid draft must focus and announce its recovery summary");
  assert.match(studioEditor, /const performUndo = \(\) => \{\s*if \(undoButton\.disabled\) return;/,
    "Undo must share one guarded handler so the button and keyboard obey the same disabled state");
  assert.match(studioEditor, /const performRedo = \(\) => \{\s*if \(redoButton\.disabled\) return;/,
    "Redo must share one guarded handler so the button and keyboard obey the same disabled state");
  assert.match(studioEditor, /const performSave = \(\) => \{\s*if \(saveButton\.disabled\) return;/,
    "Keyboard save must respect the same disabled state as the Save button");
  const shortcutBlock = studioEditor.match(
    /document\.addEventListener\("keydown",\s*\(event\)\s*=>\s*\{[\s\S]*?\n\s*}\);/)?.[0] ?? "";
  assert.match(shortcutBlock, /if \(!state \|\| editor\.hidden\) return;/,
    "Editor shortcuts must only fire while the editor is open");
  assert.match(shortcutBlock, /event\.ctrlKey \|\| event\.metaKey/,
    "Editor shortcuts must accept both Ctrl and Cmd");
  assert.match(shortcutBlock, /dialog\[open\]/,
    "Editor shortcuts must not fire while a modal dialog is open");
  assert.match(shortcutBlock, /key === "s"[\s\S]{0,80}?performSave\(\)/,
    "Ctrl/Cmd+S must save the theme instead of the browser page");
  assert.match(shortcutBlock, /editingText[\s\S]{0,60}?return;/,
    "Undo/redo shortcuts must yield to native text history inside text fields");
  assert.match(shortcutBlock, /key === "z" && !event\.shiftKey[\s\S]{0,80}?performUndo\(\)/,
    "Ctrl/Cmd+Z must undo the last theme edit");
  assert.match(shortcutBlock, /key === "y" \|\| \(key === "z" && event\.shiftKey\)[\s\S]{0,80}?performRedo\(\)/,
    "Ctrl/Cmd+Y and Ctrl/Cmd+Shift+Z must redo");
  assert.match(studioEditor,
    /const hasUnsavedEdits = \(\) => hasUnsavedEditorWork\(\{[\s\S]{0,120}?state\?\.dirty[\s\S]{0,160}?coalescedChanges\.size[\s\S]{0,180}?inFlightChanges\.length[\s\S]{0,160}?stageKeyPaths\.size[\s\S]{0,100}?stageKeyTimer/,
    "Exit must treat queued, debounced, and in-flight edits as unsaved, not only host-acknowledged dirty state");
  assert.match(studioEditor,
    /const requestExit = \(opener\) => \{\s*if \(!hasUnsavedEdits\(\)\) \{ discard\(\); return; \}/,
    "Leaving with any unsaved edit must prompt for confirmation before discarding");
  assert.match(studioEditor,
    /const isBlockingAction = \(\) => Boolean\(pendingAction\) && pendingAction !== "apply-theme-patch";/,
    "Only structural actions block the editor; background value patches must not");
  const setPendingBlock = studioEditor.match(/const setPending = \(action = null\) => \{[\s\S]*?\n\s*};/)?.[0] ?? "";
  assert.match(setPendingBlock, /const blocking = Boolean\(action\) && action !== "apply-theme-patch";/,
    "setPending must distinguish a blocking structural action from a background patch");
  assert.match(setPendingBlock, /for \(const button of editor\.querySelectorAll\("button"\)\) button\.disabled = blocking;/,
    "setPending must only disable every control for a structural action, letting background patches sync without a freeze");
  assert.match(studioEditor,
    /cancelButton\.disabled = isBlockingAction\(\);\s*backButton\.disabled = isBlockingAction\(\);/,
    "Cancel and Back must stay usable while edits are still settling");
  assert.match(studioEditor,
    /const signature = layerRenderSignature\(\);\s*if \(signature === renderedLayerSignature && layerList\.querySelector\(".layer-card"\)\) return;/,
    "An unrelated edit must reuse the existing layer DOM instead of rebuilding and reloading thumbnails");
  assert.match(studioEditor,
    /const layerRenderSignature = \(\) => \{[\s\S]{0,700}?LAYER_SIGNATURE_FRAME/,
    "The layer signature must cover shared and per-frame values so real layer changes still rebuild");
  assert(!/normalized\??\.error/.test(studioEditor),
    "Editor failure announcements must use localized copy instead of exposing raw core error codes");
  assert.match(studioEditor, /returnTheme\s*=\s*normalized\.isNew\s*\?\s*normalized\.sourceId\s*:\s*normalized\.id/,
    "An unsaved duplicate must remember its source theme for focus restoration");
  assert.match(studioEditor, /const focusId\s*=\s*action\s*===\s*"delete-user-theme"\s*\?\s*"default"\s*:\s*returnTheme[\s\S]{0,120}?focusThemeCard\?\.\(focusId\)/,
    "Closing an unsaved duplicate must return keyboard focus to its source card");
  const hideEditorBlock = studioEditor.match(/const hideEditor\s*=\s*\(action\s*=\s*""\)[\s\S]*?\n\s*};/)?.[0] ?? "";
  assert.match(hideEditorBlock,
    /stageMirror\s*=\s*null[\s\S]*?stageLiveMirror\s*=\s*null[\s\S]*?stageMirrorCache\.clear\(\)[\s\S]*?stageBackdropImg\.removeAttribute\("src"\)/,
    "Closing the editor must discard every private in-memory context capture");
  const rememberMirrorBlock = studioEditor.match(/const rememberStageMirror\s*=\s*\(mirror\)\s*=>[\s\S]*?\n\s*};/)?.[0] ?? "";
  assert.match(rememberMirrorBlock,
    /mirror\.revision\s*!==\s*state\?\.revision[\s\S]{0,100}?hasUsableMirrorGeometry\(mirror\)/,
    "A context capture must match the current draft revision and usable measured geometry before caching");
  assert.match(rememberMirrorBlock,
    /stageMirrorCacheBasis\s*!==\s*basis[\s\S]*?stageMirrorCache\.clear\(\)[\s\S]*?stageMirrorCache\.set\(geometry\.context,\s*mirror\)/,
    "Context captures must be bounded to one exact revision, appearance, viewport, and size with at most two page entries");
  assert.match(studioEditor,
    /const mirrorBasis\s*=\s*\(revision,\s*mode,\s*viewport,\s*width,\s*height\)[\s\S]{0,180}?\$\{viewport\}/,
    "The private mirror cache key must include the renderer's effective viewport");
  const receiveMirrorBlock = studioEditor.match(/const receiveMirror\s*=\s*\(raw\)\s*=>[\s\S]*?\n\s*};/)?.[0] ?? "";
  assert.match(studioEditor,
    /exactShape\(value,\s*\["type",\s*"image",\s*"width",\s*"height",\s*"revision",\s*"request"\]/,
    "Studio must reject mirror messages that omit the accepted editor revision or preview request id");
  assert.match(studioEditor,
    /exactShape\(value\.geometry,\s*\["context",\s*"mode",\s*"viewport",\s*"main",\s*"prompt"\]\)[\s\S]{0,260}?enumValue\(value\.geometry\.viewport,\s*\["normal",\s*"wide"\]\)/,
    "Studio must require an exact renderer-provided normal/wide viewport on measured geometry");
  assert.match(receiveMirrorBlock,
    /mirror\.revision\s*!==\s*state\?\.revision[\s\S]{0,180}?mirror\.request\s*!==\s*previewExpectedRequest[\s\S]{0,180}?previewSizeEditing[\s\S]{0,260}?mirror\.width\s*!==\s*previewSizeIntent\[0\]/,
    "Stale revisions and old-size frames must not replace the selected page or overwrite dimensions being edited");
  assert.match(studioEditor,
    /const schedulePreviewSize[\s\S]{0,180}?clearTimeout\(previewResizeTimer\)[\s\S]{0,180}?if\s*\(!dimensions\)\s*\{[\s\S]{0,80}?previewSizeIntent\s*=\s*null[\s\S]{0,80}?previewExpectedRequest\s*=\s*null[\s\S]{0,40}?return/,
    "An invalid intermediate dimension must cancel its old commit and reject mirrors instead of retaining a stale size intent");
  assert.match(studioEditor,
    /const sendPreviewSize[\s\S]{0,260}?previewExpectedRequest\s*=\s*request[\s\S]{0,160}?type:\s*"set-aura-preview",\s*size,\s*request/,
    "Every size including maximized must stay guarded until its exact host request is captured");
  assert.match(receiveMirrorBlock,
    /!stageContextTouched[\s\S]{0,140}?stageContext\s*=\s*realContext/,
    "The first asynchronous live capture must not overwrite an explicit page selection");
  assert.match(receiveMirrorBlock,
    /!hasUsableMirrorGeometry\(mirror\)[\s\S]{0,180}?stageMirror\s*=\s*null[\s\S]{0,220}?stageViewport\s*=\s*mirror\.geometry\.viewport/,
    "Studio must fall back from missing geometry and otherwise use the renderer's exact viewport");
  assert(!/mirror(?:\.|\?\.)width\s*>=\s*1440/.test(studioEditor),
    "Studio must not guess the renderer's viewport from mirror width");
  assert.match(receiveMirrorBlock, /rememberStageMirror\(mirror\)[\s\S]*?selectStageMirror\(\)/,
    "A validated live capture must be cached before resolving the selected page preview");
  const backdropBlock = studioEditor.match(/const stageBackdropOn\s*=\s*\(\)[\s\S]*?\n\s*};/)?.[0] ?? "";
  assert.match(backdropBlock, /stageMirror\?\.revision\s*===\s*state\?\.revision/,
    "A live backdrop must show the current accepted draft revision only");
  assert.match(backdropBlock, /geometry\.mode\s*===\s*selectedMode/,
    "A live backdrop must match the appearance being edited");
  assert.match(backdropBlock, /geometry\.viewport\s*===\s*stageViewport/,
    "A live backdrop must match the exact renderer viewport being edited");
  assert.match(backdropBlock, /hasUsableMirrorGeometry\(stageMirror\)/,
    "A live backdrop must have usable measured content geometry");
  const layerGridRules = [...studioEditorCss.matchAll(/\.layer-grid\s*\{([^}]*)\}/g)]
    .map((match) => match[1]);
  assert.equal(layerGridRules.length, 1,
    "Artwork exact-value grids must not change columns at outer-window breakpoints");
  assert.match(layerGridRules[0], /grid-template-columns:\s*minmax\(0,\s*1fr\)/,
    "Artwork exact-value grids must remain one safe column within the bounded inspector");
  assert.match(studioEditorCss,
    /\.layer-range-pair,\s*\.prompt-range-pair\s*\{[^}]*grid-template-columns:\s*minmax\(90px,\s*1fr\)\s+82px/,
    "Exact artwork values must retain a usable slider-and-number pair");
  assert.match(studioEditor, /replace\(\/\(\?:https\?\|file\):\\\/\\\/\\S\+\/gi/,
    "The local prompt builder must remove URL-like input");
  assert.match(studioEditor, /replace\(\/\[A-Za-z\]:\\\\\\S\*\/g/,
    "The local prompt builder must remove Windows path-like input");

  const guideMatch = studioHtml.match(/<figure class="asset-guide"[\s\S]*?<\/figure>/);
  assert(guideMatch, "The editor asset guide is missing");
  assert(!/<(?:button|input|select|textarea|a)\b/i.test(guideMatch[0]),
    "The abstract asset guide must not simulate an interactive Claude interface");
  assert.match(studioHtml, /Guide only — this is not a Claude preview/,
    "The asset guide must explicitly distinguish itself from live Aura evidence");
  const stageEvidence = studioHtml.match(
    /<span class="([^"]*)" data-editor-i18n="stageEvidence">([^<]+)<\/span>/);
  assert(stageEvidence && !/\b(?:sr-only|advanced-only)\b/.test(stageEvidence[1])
      && stageEvidence[2].includes("not a Claude preview")
      && stageEvidence[2].includes("acceptance evidence"),
  "Quick and Advanced must both show the compact not-Claude/not-evidence stage caveat");
  for (const copy of [
    "Placement aid · not a Claude preview or acceptance evidence",
    "构图辅助 · 不是 Claude 预览或验收证据",
    "構圖輔助 · 不是 Claude 預覽或驗收依據",
  ]) {
    assert(studioEditor.includes(`stageEvidence: "${copy}"`),
      `The visible stage caveat is missing native locale copy: ${copy}`);
  }
  assert.match(studioHtml, /Nothing is sent to a model or network service/,
    "The local prompt builder must disclose its offline behavior");
  assert.match(studioEditorCss, /@media\s*\(prefers-reduced-motion:\s*reduce\)/,
    "The editor must honor reduced-motion preferences");
  assert.match(studioEditorCss, /@media\s*\(forced-colors:\s*active\)/,
    "The editor must remain operable in forced-colors mode");
  assert.match(studioEditorCss,
    /@media\s*\(forced-colors:\s*active\)[\s\S]*?\.editor-level label:has\(input:checked\)[\s\S]*?\.editor-inspector-tab\[aria-pressed="true"\][\s\S]*?outline:\s*3px solid Highlight/,
    "Flattened mode and inspector selections must regain explicit boundaries in Windows forced colors");
  assert.match(studioEditorCss,
    /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.editor-stagecol,\s*\.editor-controls\s*\{[^}]*scroll-behavior:\s*auto/,
    "Independent editor panes must not smooth-scroll when reduced motion is requested");
  const studioClientSize = ui.match(/\$script:StudioForm\.ClientSize\s*=\s*\[Drawing\.Size\]::new\((\d+),\s*(\d+)\)/);
  assert.deepEqual(studioClientSize?.slice(1), ["1080", "720"],
    "Studio's normal client size must remain the layout acceptance viewport");
  const editorBodyRule = studioEditorCss.match(/\.editor-body\s*\{([^}]*)\}/)?.[1] ?? "";
  assert.match(editorBodyRule,
    /grid-template-columns:\s*minmax\(340px,\s*1fr\)\s+clamp\(272px,\s*32vw,\s*480px\)/,
    "The supported editor must keep a materially sized canvas left of an inspector that can grow at wide sizes");
  assert.match(editorBodyRule, /align-items:\s*stretch/,
    "Both bounded editor panes must span the available workspace height");
  const stageColumnRule = studioEditorCss.match(/\.editor-stagecol\s*\{([^}]*)\}/)?.[1] ?? "";
  assert.match(stageColumnRule, /align-self:\s*stretch/,
    "The live-preview pane must span the bounded editor workspace");
  const stageCornerRule = studioEditorCss.match(/\.stage-corner\s*\{([^}]*)\}/)?.[1] ?? "";
  assert.match(stageCornerRule, /width:\s*24px[\s\S]*?height:\s*24px/,
    "Canvas resize handles must meet the 24px direct-manipulation target minimum");
  assert(!studioEditor.includes('className = "stage-chip-order"'),
    "The compact canvas picker must not duplicate the inspector's layer-order commands");
  assert.match(studioEditor, /post\(\{ type: "move-theme-layer"/,
    "Image ordering must remain available in the selected-image inspector");
  assert(!/@media\s*\(max-width:\s*939px\)[\s\S]{0,240}?\.editor-stagecol[\s\S]{0,100}?order:\s*-1/.test(studioEditorCss),
    "Supported narrow Studio windows must never stack the live canvas above the inspector");
  assert.match(stageColumnRule, /overflow-y:\s*auto[\s\S]*?overscroll-behavior:\s*contain[\s\S]*?scrollbar-gutter:\s*stable/,
    "The live preview and its lower details must scroll together inside the left pane");
  const editorControlsRule = studioEditorCss.match(/\.editor-controls\s*\{([^}]*)\}/)?.[1] ?? "";
  assert.match(editorControlsRule, /overflow-y:\s*auto[\s\S]*?overscroll-behavior:\s*contain[\s\S]*?scrollbar-gutter:\s*stable/,
    "The inspector must scroll independently without moving the live preview over lower content");
  assert.match(editorControlsRule, /padding-top:\s*22px/,
    "Initial inspector spacing must belong to the scrolling column rather than its sticky header");
  assert.match(editorControlsRule, /container:\s*theme-inspector\s*\/\s*inline-size/,
    "Inspector density must respond to the inspector itself rather than the outer window");
  const wideInspectorQuery = studioEditorCss.match(
    /@container theme-inspector \(min-width: 380px\)\s*\{([\s\S]*?)\n\}/)?.[1] ?? "";
  assert(!wideInspectorQuery.includes(".editor-token-groups"),
    "Essential colors must remain one scannable list instead of becoming cramped cards");
  assert.match(studioEditorCss,
    /\.editor-view\[data-level="simple"\]\s+\.quick-essential\s*>\s*summary[\s\S]{0,600}?display:\s*none/,
    "Quick customize must remove duplicate schema-group headings from its color rows");
  assert.match(studioEditor, /studioShell\.dataset\.editorActive\s*=\s*"true"/,
    "Entering the editor must switch Studio into its focused canvas workspace");
  assert.match(hideEditorBlock, /removeAttribute\("data-editor-active"\)/,
    "Leaving the editor must restore the ordinary Studio shell");
  assert.match(studioCss, /\.studio\[data-editor-active="true"\]\s*\{[^}]*grid-template-columns:\s*56px\s+minmax\(0,\s*1fr\)/,
    "The editor workspace must collapse the ordinary rail to preserve horizontal canvas room");
  assert.match(studioCss, /\.studio\[data-editor-active="true"\]\s+\.rail-brand/,
    "The collapsed editor rail must retain the active theme identity mark");
  const railMarkRule = studioCss.match(/\.rail-mark\s*\{([^}]*)\}/)?.[1] ?? "";
  assert.match(railMarkRule,
    /border:\s*var\(--launcher-border-width\)[\s\S]*?var\(--launcher-border\)[\s\S]*?border-radius:\s*var\(--launcher-radius\)[\s\S]*?background:\s*var\(--launcher-surface\)/,
    "Studio's real rail mark must use the validated App identity material");
  assert.match(studioCss, /\.rail-brand:hover\s+\.rail-mark\s*\{[^}]*var\(--launcher-surface-hover\)/,
    "The App identity hover color must have a visible Studio runtime effect");
  assert.match(studioCss, /\.rail-mark::before\s*\{[^}]*var\(--launcher-foreground\)[^}]*\}/,
    "The App identity foreground token must style Studio's owned grip");
  assert.match(studioCss, /\.rail-mark::after\s*\{[^}]*var\(--launcher-accent\)[^}]*\}/,
    "The App identity accent token must remain visible with an authored mark");
  assert.match(studioCss, /\.studio\[data-editor-active="true"\]\s+\.content\s*\{[^}]*overflow:\s*hidden/,
    "The outer Studio document must stop scrolling while the two editor panes own their content");
  const editorLiveRule = studioEditorCss.match(/\.editor-live\s*\{([^}]*)\}/)?.[1] ?? "";
  const stagePanelRule = studioEditorCss.match(/\.stage-panel\s*\{([^}]*)\}/)?.[1] ?? "";
  assert.match(editorLiveRule, /position:\s*absolute[\s\S]*?width:\s*1px[\s\S]*?height:\s*1px/,
    "Mutation announcements must remain accessible without pushing the initial canvas below the viewport");
  assert.match(stagePanelRule, /position:\s*static/,
    "The live preview must remain in the left pane's document flow instead of hovering over its details");
  assert(!/position:\s*sticky/.test(stagePanelRule),
    "The live preview must not become a page-level overlay while either pane scrolls");
  assert.match(stagePanelRule, /border:\s*0[\s\S]*?background:\s*transparent[\s\S]*?box-shadow:\s*none/,
    "The live preview must use the workspace surface instead of another decorative card");
  for (const [selector, label] of [
    ["token-group", "color groups"],
    ["layer-card", "image rows"],
  ]) {
    const rule = studioEditorCss.match(new RegExp(`\\.${selector}\\s*\\{([^}]*)\\}`))?.[1] ?? "";
    assert.match(rule, /border:\s*0[\s\S]*?border-bottom:\s*1px[\s\S]*?background:\s*transparent[\s\S]*?box-shadow:\s*none/,
      `${label} must use flat rows and dividers instead of nested cards`);
  }
  assert.match(studioEditorCss,
    /\.editor-layer-empty\s*\{[^}]*border:\s*0[^}]*text-align:\s*left/,
    "The zero-image state must remain inline instead of becoming another bordered card");
  assert(!studioHtml.includes('class="editor-savebar"'),
    "Persistent editor actions must not be duplicated in an end-of-document footer");
  assert.match(studioEditor, /Math\.min\(1,\s*stageHostWidth\s*\/\s*logicalWidth,\s*availableFrameHeight\s*\/\s*logicalHeight\)/,
    "The live canvas must fit both available width and height without upscaling beyond its actual capture size");
  assert.match(studioEditor,
    /const compactLayers\s*=\s*frameWidth\s*<\s*720\s*\|\|\s*frameHeight\s*<\s*360[\s\S]{0,120}?compactLayers\s*\|\|\s*!stageLayersUserToggled/,
    "Compact canvas safety must override a stale manual layer-palette expansion");
  assert.match(hideEditorBlock,
    /stageLayersUserToggled\s*=\s*false[\s\S]{0,120}?setStageLayersCollapsed\(true\)/,
    "Layer-palette disclosure state must reset between editor sessions");
  const stageObserverBlock = studioEditor.match(
    /if \(typeof ResizeObserver === "function"\) \{[\s\S]*?\n\s*} else \{[\s\S]*?\n\s*}/)?.[0] ?? "";
  assert.match(stageObserverBlock, /stageLayoutObserver\.observe\(stageRoot\)/);
  assert.match(stageObserverBlock, /stageLayoutObserver\.observe\(stageColumn\)/,
    "Height-only Studio resizes must refit the canvas from its bounded preview pane");
  assert.match(stageObserverBlock, /window\.addEventListener\("resize",\s*applyStageLayout,\s*\{\s*passive:\s*true\s*}\)/,
    "Canvas fitting must retain a window-resize fallback when ResizeObserver is unavailable");
  assert.match(studioHtml, /data-editor-panel-target="design"[\s\S]{0,600}?data-editor-panel-target="artwork"[\s\S]{0,600}?data-editor-panel-target="layout"[\s\S]{0,600}?data-editor-panel-target="checks"/,
    "Advanced must use contextual Style, Images, Placement, and Checks sections");
  assert.match(studioHtml, /<div class="editor-inspector-head">[\s\S]{0,1800}?class="editor-inspector-nav"/,
    "Quick customize and Advanced navigation must share one measured sticky inspector header with the level switch");
  const inspectorNavRule = studioEditorCss.match(/\.editor-inspector-nav\s*\{([^}]*)\}/)?.[1] ?? "";
  assert(!/position:\s*sticky/.test(inspectorNavRule) && !/top:\s*108px/.test(inspectorNavRule),
    "Advanced navigation must not use a second hard-coded sticky offset that can cover controls");
  assert.match(inspectorNavRule, /repeat\(2,\s*minmax\(0,\s*1fr\)\)/,
    "Quick navigation must devote the full row to its two contexts");
  assert.match(studioEditorCss,
    /\.editor-view\[data-level="advanced"\]\s+\.editor-inspector-nav\s*\{[^}]*repeat\(4,\s*minmax\(0,\s*1fr\)\)/,
    "Advanced navigation must expand to all four contexts");
  const inspectorHeadRule = studioEditorCss.match(/\.editor-inspector-head\s*\{([^}]*)\}/)?.[1] ?? "";
  assert.match(inspectorHeadRule, /position:\s*sticky[\s\S]*?top:\s*0/);
  assert.match(inspectorHeadRule, /margin-top:\s*0/,
    "The sticky inspector header must not leave a scroll-through strip above itself");
  assert.match(inspectorHeadRule, /border:\s*0[\s\S]*?border-bottom:\s*1px[\s\S]*?background:\s*var\(--surface\)[\s\S]*?box-shadow:\s*none/,
    "The inspector header must be opaque and flat so scrolled controls cannot leak through it");
  assert.match(studioEditorCss, /\.color-field\s*\{[^}]*grid-template-areas:[^}]*"label label"[^}]*"picker value"/,
    "Compact token cards must place labels above their picker and value instead of overflowing fixed columns");
  const stageSelectionBlock = studioEditor.match(
    /const selectStageItem\s*=\s*\([\s\S]*?\n\s*};/)?.[0] ?? "";
  assert.match(stageSelectionBlock,
    /selection\?\.kind === "layer"[\s\S]{0,700}?setInspectorPanel\("artwork"\)/,
    "Selecting artwork on the canvas must open its inspector in Quick and Advanced");
  assert(!/dataset\.level === "advanced"[\s\S]{0,100}?setInspectorPanel\("artwork"\)/.test(stageSelectionBlock),
    "Quick artwork selection must not be gated behind Advanced mode");
  assert.match(stageSelectionBlock,
    /selection\?\.kind === "prompt"[\s\S]{0,120}?setInspectorPanel\("layout"\)/,
    "Selecting the new-chat area must never leave unrelated image controls visible in Quick customize");
  assert.match(studioEditor,
    /stageRing\.dataset\.stageHandle\s*=\s*"move"[\s\S]{0,100}?stageRing\.setAttribute\("aria-hidden",\s*"true"\)/,
    "The current selection ring must provide a pointer move surface without becoming a duplicate keyboard control");
  const stageRingRule = studioEditorCss.match(/\.stage-hud-ring\s*\{([^}]*)\}/)?.[1] ?? "";
  assert.match(stageRingRule, /pointer-events:\s*auto[\s\S]*?cursor:\s*move/,
    "The selected layer's ring must intercept interior drags above overlapping artwork");
  const stagePointerBlock = studioEditor.match(
    /stageRoot\.addEventListener\("pointerdown"[\s\S]*?\n\s*}\);/)?.[0] ?? "";
  assert.match(stagePointerBlock,
    /let selection = stageSelection[\s\S]{0,120}?if \(itemNode\)[\s\S]{0,120}?stageSelectionFromNode\(itemNode\)/,
    "Dragging the selection ring must preserve the layer chosen in the palette while direct image clicks may retarget it");
  assert.match(stagePointerBlock, /!state \|\| isBlockingAction\(\)/,
    "A structural (index-changing) response must settle before another pointer drag can resolve the selected layer ID to an index; background value patches must not block it");
  const stageKeyboardBlock = studioEditor.match(
    /stageRoot\.addEventListener\("keydown"[\s\S]*?\n\s*}\);/)?.[0] ?? "";
  assert.match(stageKeyboardBlock, /!state \|\| isBlockingAction\(\)/,
    "Keyboard framing must also pause while a structural reorder response is pending, but not while a value patch syncs");
  assert.match(studioEditor,
    /stageOpacityInput\.addEventListener\("input"[\s\S]{0,100}?isBlockingAction\(\)[\s\S]*?stageOpacityInput\.addEventListener\("change"[\s\S]{0,100}?isBlockingAction\(\)/,
    "Opacity changes must not race an artwork reorder");
  assert.match(studioEditor,
    /const colorPreview = captureActive && \[\.\.\.stageOverrides\.keys\(\)\]\.some/,
    "An uncommitted colour or material edit over a live capture must enter a preview state so the change is visible before recapture");
  assert.match(studioEditor, /stageFrame\.dataset\.colorPreview = colorPreview \? "true" : "";/,
    "The stage must flag the colour-preview state for styling");
  assert.match(studioEditor, /stageSidebarEl\.hidden = captureActive && !colorPreview;/,
    "The schematic sidebar must reappear to preview its colour over the capture");
  assert.match(studioEditorCss,
    /\.stage-frame\[data-color-preview="true"\] \.stage-backdrop\s*\{[^}]*opacity/,
    "The capture must dim while a colour edit previews so the schematic shows through");
  assert.match(studioEditorCss,
    /\.stage-frame\[data-backdrop="capture"\]:not\(\[data-color-preview="true"\]\) \.stage-prompt \{/,
    "The capture-mode surface hiding must pause during a colour preview so the schematic fills show the change");
  assert.match(studioEditor, /className = "help layer-placement-scope"[\s\S]{0,500}?layerPlacementShared/,
    "Shared appearance or page placement must be disclosed instead of silently leaking across preview states");
  const levelSwitchBlock = studioEditor.match(
    /levelInputs\.forEach\([\s\S]*?\n\s*}\)\);/)?.[0] ?? "";
  assert.match(levelSwitchBlock,
    /input\.value === "simple"[\s\S]{0,220}?stageSelection\?\.kind === "layer"[\s\S]{0,80}?setInspectorPanel\("artwork"\)/);
  assert.match(levelSwitchBlock,
    /input\.value === "simple"[\s\S]{0,180}?querySelectorAll\("\.quick-essential"\)[\s\S]{0,80}?details\.open\s*=\s*true/,
    "Returning to Quick customize must reopen essential color rows whose headings are intentionally hidden");
  assert.match(levelSwitchBlock,
    /stageSelection\?\.kind === "prompt"[\s\S]{0,80}?setInspectorPanel\("layout"\)/,
    "Returning to Quick customize must preserve a selected new-chat area's contextual placement controls");
  assert.match(studioEditor,
    /setInspectorPanel\(tab\.dataset\.editorPanelTarget|setInspectorPanel\(panel,\s*\{\s*reveal:\s*true\s*\}\)/,
    "Explicit inspector navigation must reveal the new section below the sticky header");
  assert.match(studioEditor,
    /const setInspectorPanel[\s\S]{0,900}?inspectorHead\.getBoundingClientRect\(\)\.bottom[\s\S]{0,240}?editorControls\.scrollTop\s*\+=/,
    "Inspector navigation must reveal controls inside the independent inspector pane");
  assert(!/selectStageItem[\s\S]{0,700}?scrollIntoView/.test(studioEditor),
    "Selecting artwork on the live canvas must not scroll the inspector away from the canvas");
  assert.match(studioHtml,
    /<div class="editor-inspector-head">[\s\S]{0,500}?id="editor-back"[\s\S]{0,500}?id="editor-dirty"[\s\S]{0,300}?id="editor-valid"[\s\S]{0,500}?id="editor-cancel"[\s\S]{0,300}?id="editor-save"/,
    "Back, save status, Cancel, and Save must remain together in the persistent inspector header");
  assert.equal((studioHtml.match(/id="editor-(?:back|cancel|save)"/g) ?? []).length, 3,
    "Persistent editor actions must appear exactly once");

  const editorWindow = {};
  new Function("window", studioEditor)(editorWindow);
  const validEditorState = {
    active: true,
    id: "studio-copy",
    sourceId: "default",
    source: "builtin",
    isNew: true,
    session: "12345678-1234-4abc-8def-1234567890ab",
    revision: 0,
    dirty: false,
    canUndo: false,
    canRedo: false,
    label: "Studio Copy",
    metadata: {
      labels: { en: "Studio Copy", "zh-CN": "Studio 副本", "zh-TW": "Studio 副本" },
      descriptions: { en: "Custom theme", "zh-CN": "自定义主题", "zh-TW": "自訂主題" },
    },
    tokens: {
      light: { canvas: "#F8F8F8", sidebar: "#EFEFEF", surface: "#FFFFFF", text: "#202020", accent: "#805AD5", border: "#777777", surfaceAlpha: 0.9, sidebarAlpha: 0.8 },
      dark: { canvas: "#181818", sidebar: "#202020", surface: "#282828", text: "#F0F0F0", accent: "#B794F4", border: "#999999", surfaceAlpha: 0.85, sidebarAlpha: 0.75 },
    },
    studioStyle: {
      light: {
        canvas: "#F8F8F8", sidebar: "#EFEFEF", surface: "#FFFFFF", raised: "#FFFFFF",
        text: "#202020", textSecondary: "#404040", textMuted: "#606060",
        sidebarText: "#202020", sidebarTextMuted: "#606060", accent: "#805AD5",
        accentText: "#FFFFFF", border: "#777777", focus: "#805AD5",
        surfaceAlpha: 0.9, sidebarAlpha: 0.8,
      },
      dark: {
        canvas: "#181818", sidebar: "#202020", surface: "#282828", raised: "#303030",
        text: "#F0F0F0", textSecondary: "#D0D0D0", textMuted: "#A0A0A0",
        sidebarText: "#F0F0F0", sidebarTextMuted: "#A0A0A0", accent: "#B794F4",
        accentText: "#181818", border: "#999999", focus: "#B794F4",
        surfaceAlpha: 0.85, sidebarAlpha: 0.75,
      },
      shared: { fontUi: "system-sans", fontDisplay: "editorial-serif", radius: 12, blur: 16, shadow: "soft" },
    },
    launcher: {
      asset: "assets/theme-art/default/launcher-mark.png",
      surface: "#2F2937", surfaceHover: "#3B3346", foreground: "#F4DFBB",
      accent: "#D66D4B", border: "#655C70", radius: 16, borderWidth: 1,
    },
    launcherStyle: {
      asset: "assets/theme-art/default/launcher-mark.png",
      surface: "#2F2937", surfaceHover: "#3B3346", foreground: "#F4DFBB",
      accent: "#D66D4B", border: "#655C70", radius: 16, borderWidth: 1,
    },
    launcherPreviewUrl: "https://aura.assets/default/launcher-mark.png",
    launcherStylePreviewUrl: "https://aura.assets/default/launcher-mark.png",
    shared: {
      fontUi: "system-sans", fontDisplay: "editorial-serif", radius: 12, blur: 16,
      shadow: "soft", backgroundScope: "content", prompt: { native: false, width: 0.7, x: 0, y: 0 },
      inherited: { fontUi: false, fontDisplay: false, radius: false, shadow: false },
    },
    layers: [{
      id: "layer-00000000000000000000000000000000", index: 0,
      role: "hero", appearance: "all", context: "new-chat", viewport: "normal",
      visible: true, opacity: 0.9, mask: "soft-right", mobile: "reduce", bytes: 399_999,
      previewUrl: "https://aura.editor/active/layer-00000000000000000000000000000000.webp?v=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
      frames: {
        normal: { anchor: "right", focalX: 70, focalY: 50, positionX: 0, positionY: 0, scale: 1 },
        wide: { anchor: "bottom-right", focalX: 75, focalY: 55, positionX: -5, positionY: 5, scale: 1.1 },
      },
    }],
    feedback: {
      valid: true,
      contrast: { light: [], dark: [] },
      budget: {
        chromeBytes: 60_000, chromeLimit: 65_000, embeddedArtworkBytes: 399_999,
        embeddedArtworkLimit: 1_400_000, sourceArtworkBytes: 399_999, sourceArtworkLimit: 1_400_000,
        pass: true, layers: [{ id: 0, bytes: 399_999, limit: 400_000, pass: true }],
      },
      errors: [],
    },
  };
  const normalizedStudioStyle = editorWindow.CLAUDE_AURA_EDITOR.normalizeStudioStyle(
    structuredClone(validEditorState.studioStyle));
  assert(normalizedStudioStyle, "The Studio page rejected a valid theme-style DTO");
  assert.deepEqual(Object.keys(normalizedStudioStyle).sort(), ["dark", "light", "shared"]);
  const studioModeStyleKeys = [
    "accent", "accentText", "border", "canvas", "focus", "raised", "sidebar", "sidebarAlpha",
    "sidebarText", "sidebarTextMuted", "surface", "surfaceAlpha", "text", "textMuted", "textSecondary",
  ];
  for (const mode of ["light", "dark"]) {
    assert.deepEqual(Object.keys(normalizedStudioStyle[mode]).sort(), studioModeStyleKeys,
      `${mode} Studio style changed its exact DTO shape`);
  }
  assert.deepEqual(Object.keys(normalizedStudioStyle.shared).sort(),
    ["blur", "fontDisplay", "fontUi", "radius", "shadow"]);
  const normalizedEditorState = editorWindow.CLAUDE_AURA_EDITOR.normalizeEditorState(
    structuredClone(validEditorState));
  assert(normalizedEditorState, "The Studio page rejected a valid host editor state");
  assert.deepEqual(normalizedEditorState.studioStyle, normalizedStudioStyle,
    "Editor-state validation changed the independently validated Studio style");
  assert.deepEqual(normalizedEditorState.launcher, validEditorState.launcher,
    "Editor-state validation changed the editable App identity style");
  assert.deepEqual(normalizedEditorState.launcherStyle, validEditorState.launcherStyle,
    "Editor-state validation changed the last-valid App identity style");
  assert.deepEqual(normalizedEditorState.shared.inherited, validEditorState.shared.inherited,
    "Editor-state validation changed which shared controls still inherit the theme's original CSS");
  assert.equal(normalizedEditorState.shared.prompt.native, false,
    "Editor-state validation changed an authored prompt into a native layout");
  const missingNativePromptState = structuredClone(validEditorState);
  delete missingNativePromptState.shared.prompt.native;
  assert.equal(editorWindow.CLAUDE_AURA_EDITOR.normalizeEditorState(missingNativePromptState), undefined,
    "Editor state accepted an ambiguous prompt layout without its native/authored marker");
  const malformedNativePromptState = structuredClone(validEditorState);
  malformedNativePromptState.shared.prompt.native = "false";
  assert.equal(editorWindow.CLAUDE_AURA_EDITOR.normalizeEditorState(malformedNativePromptState), undefined,
    "Editor state accepted a non-boolean native-prompt marker");
  const malformedInheritedState = structuredClone(validEditorState);
  malformedInheritedState.shared.inherited.radius = "false";
  assert.equal(editorWindow.CLAUDE_AURA_EDITOR.normalizeEditorState(malformedInheritedState), undefined,
    "Editor state accepted a non-boolean inherited-control flag");
  const extraInheritedState = structuredClone(validEditorState);
  extraInheritedState.shared.inherited.blur = true;
  assert.equal(editorWindow.CLAUDE_AURA_EDITOR.normalizeEditorState(extraInheritedState), undefined,
    "Editor state accepted an uncontracted inherited-control flag");
  for (const property of ["launcherPreviewUrl", "launcherStylePreviewUrl"]) {
    const unsafePreviewState = structuredClone(validEditorState);
    unsafePreviewState[property] = "https://example.com/launcher.png";
    assert.equal(editorWindow.CLAUDE_AURA_EDITOR.normalizeEditorState(unsafePreviewState), undefined,
      `Editor state accepted a remote ${property}`);
  }
  for (const [label, mutate] of [
    ["an extra launcher property", (launcher) => { launcher.rawCss = "body{}"; }],
    ["a remote launcher asset", (launcher) => { launcher.asset = "https://example.com/mark.png"; }],
    ["a lowercase launcher color", (launcher) => { launcher.surface = "#abcdef"; }],
    ["an out-of-range launcher radius", (launcher) => { launcher.radius = 25; }],
    ["a string launcher border width", (launcher) => { launcher.borderWidth = "1"; }],
  ]) {
    for (const property of ["launcher", "launcherStyle"]) {
      const malformed = structuredClone(validEditorState);
      mutate(malformed[property]);
      assert.equal(editorWindow.CLAUDE_AURA_EDITOR.normalizeEditorState(malformed), undefined,
        `The Studio page accepted ${label} in ${property}`);
    }
  }
  const pathState = structuredClone(validEditorState);
  pathState.layers[0].previewUrl = "file:///C:/private/theme.webp";
  assert.equal(editorWindow.CLAUDE_AURA_EDITOR.normalizeEditorState(pathState), undefined,
    "The Studio page accepted a filesystem URL in editor state");
  const remoteState = structuredClone(validEditorState);
  remoteState.layers[0].previewUrl = "https://example.com/layer.webp?v=0123456789abcdef0123456789abcdef";
  assert.equal(editorWindow.CLAUDE_AURA_EDITOR.normalizeEditorState(remoteState), undefined,
    "The Studio page accepted a remote artwork preview origin");
  const extraState = { ...structuredClone(validEditorState), draftPath: "C:\\private\\draft" };
  assert.equal(editorWindow.CLAUDE_AURA_EDITOR.normalizeEditorState(extraState), undefined,
    "The Studio page accepted an unexpected or path-bearing state property");
  const ninthLayerState = structuredClone(validEditorState);
  ninthLayerState.layers = Array.from({ length: 9 }, (_, index) => ({
    ...structuredClone(validEditorState.layers[0]), index,
  }));
  assert.equal(editorWindow.CLAUDE_AURA_EDITOR.normalizeEditorState(ninthLayerState), undefined,
    "The Studio page accepted a ninth artwork layer");
  const staleShapeState = structuredClone(validEditorState);
  staleShapeState.revision = "0";
  assert.equal(editorWindow.CLAUDE_AURA_EDITOR.normalizeEditorState(staleShapeState), undefined,
    "The Studio page accepted a nonnumeric edit revision");
  const malformedMetadataState = structuredClone(validEditorState);
  malformedMetadataState.metadata.labels.en = "";
  assert.equal(editorWindow.CLAUDE_AURA_EDITOR.normalizeEditorState(malformedMetadataState), undefined,
    "The Studio page accepted an empty localized theme name");
  const unknownMetadataLocaleState = structuredClone(validEditorState);
  unknownMetadataLocaleState.metadata.labels.ja = "Studio copy";
  assert.equal(editorWindow.CLAUDE_AURA_EDITOR.normalizeEditorState(unknownMetadataLocaleState), undefined,
    "The Studio page accepted an uncontracted metadata locale");
  const rejectedStudioStyles = [
    ["an unsafe color", (style) => { style.light.canvas = "url(https://example.com/theme.css)"; }],
    ["an extra top-level property", (style) => { style.customCss = "body{}"; }],
    ["an extra mode property", (style) => { style.dark.backgroundImage = "none"; }],
    ["a missing mode property", (style) => { delete style.light.focus; }],
    ["a string material value", (style) => { style.dark.surfaceAlpha = "0.8"; }],
    ["an out-of-range material value", (style) => { style.light.sidebarAlpha = 1.01; }],
    ["an unknown font id", (style) => { style.shared.fontUi = "url-font"; }],
    ["an unknown shadow id", (style) => { style.shared.shadow = "drop-shadow(1px 1px)"; }],
    ["an out-of-range measurement", (style) => { style.shared.blur = 41; }],
    ["a non-finite measurement", (style) => { style.shared.radius = Number.POSITIVE_INFINITY; }],
  ];
  for (const [label, mutate] of rejectedStudioStyles) {
    const style = structuredClone(validEditorState.studioStyle);
    mutate(style);
    assert.equal(editorWindow.CLAUDE_AURA_EDITOR.normalizeStudioStyle(style), null,
      `The Studio style normalizer accepted ${label}`);
    const state = structuredClone(validEditorState);
    state.studioStyle = style;
    assert.equal(editorWindow.CLAUDE_AURA_EDITOR.normalizeEditorState(state), undefined,
      `The Studio page accepted ${label} in editor state`);
  }
  const duplicateLayerIdentityState = structuredClone(validEditorState);
  duplicateLayerIdentityState.layers.push({ ...structuredClone(validEditorState.layers[0]), index: 1 });
  assert.equal(editorWindow.CLAUDE_AURA_EDITOR.normalizeEditorState(duplicateLayerIdentityState), undefined,
    "The Studio page accepted duplicate stable artwork identities");
  const malformedLayerIdentityState = structuredClone(validEditorState);
  malformedLayerIdentityState.layers[0].id = "layer-0";
  assert.equal(editorWindow.CLAUDE_AURA_EDITOR.normalizeEditorState(malformedLayerIdentityState), undefined,
    "The Studio page accepted a malformed stable artwork identity");

  const generatedMatch = studioGenerated.match(/window\.CLAUDE_AURA_THEMES\s*=\s*([\s\S]+);\s*$/);
  assert(generatedMatch, "Studio theme metadata could not be parsed");
  const studioThemes = JSON.parse(generatedMatch[1]);
  assert.deepEqual(Object.keys(studioThemes), THEME_IDS);
  const registryThemes = new Map((await listThemes()).map((theme) => [theme.name, theme]));
  let selectorPreviewCount = 0;
  for (const themeId of THEME_IDS) {
    const expectedPath = themeId === "default" ? null : `assets/studio-previews/masters/${themeId}.png`;
    assert.deepEqual(studioThemes[themeId].studioStyle,
      studioStyleFromTheme(registryThemes.get(themeId)),
      `${themeId} Studio shell style differs from its validated theme tokens`);
    assert(editorWindow.CLAUDE_AURA_EDITOR.normalizeStudioStyle(
      structuredClone(studioThemes[themeId].studioStyle)),
    `${themeId} generated an invalid Studio shell style`);
    assert.equal(studioThemes[themeId].source, "builtin",
      `${themeId} Studio metadata must mark immutable bundled themes explicitly`);
    assert.equal(studioThemes[themeId].studioPreview, expectedPath,
      `${themeId} Studio preview metadata is incorrect`);
    if (!expectedPath) {
      assert.equal(studioThemes[themeId].studioPreviewFrame, null);
      continue;
    }
    selectorPreviewCount += 1;
    const bytes = await fs.readFile(path.join(PROJECT_ROOT, expectedPath));
    assert(bytes.length > 0 && bytes.length < 3_000_000, `${themeId} Studio master exceeds its product-media budget`);
    assert.deepEqual([...bytes.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
    assert.deepEqual([bytes.readUInt32BE(16), bytes.readUInt32BE(20)],
      STUDIO_PREVIEW_MASTERS[themeId].dimensions, `${themeId} Studio master dimensions changed`);
    assert.equal(crypto.createHash("sha256").update(bytes).digest("hex"),
      STUDIO_PREVIEW_MASTERS[themeId].sha256, `${themeId} Studio master was rewritten or cropped`);
    assert.deepEqual(studioThemes[themeId].studioPreviewFrame, STUDIO_PREVIEW_MASTERS[themeId].frame,
      `${themeId} Studio starting frame does not match the approved legacy composition`);
  }
  assert.equal(selectorPreviewCount, 7);
  await assert.rejects(fs.access(path.join(PROJECT_ROOT, "theme_demo_previews")),
    "Theme demo previews must live under the categorized assets tree");
  const alternateReference = await fs.readFile(path.join(
    PROJECT_ROOT, "assets", "studio-previews", "references", "cartoon-ocean-alternate.png"));
  assert.equal(crypto.createHash("sha256").update(alternateReference).digest("hex"),
    "bbc7c3271ab67abcf21ffb177723d5f4d85cb13456d528f29b4904969a75e7a7",
    "The unassigned ocean reference must remain preserved byte-for-byte");
  assert(!/theme_demo_previews|Claude app interface with K-pop|Elegant Japanese-inspired/i.test(studioGenerated),
    "Generated Studio metadata must use categorized, theme-scoped master paths");
  assert(!/\$message\.(?:path|file|fileName)\b/i.test(ui),
    "The Studio host must never accept a page-supplied file path");
  assert.match(ui, /\$UserThemesRoot\s*=\s*Join-Path\s+\$DataRoot\s+['"]themes['"]/,
    "Installed themes must live under the user data themes folder");
  assert.match(ui, /\[System\.Windows\.Forms\.FolderBrowserDialog\]::new\(\)/,
    "Theme kit paths must come from a host-owned folder picker");
  assert.match(ui, /Invoke-AuraUiNode[\s\S]{0,400}?['"]validate['"][\s\S]{0,240}?\$dialog\.SelectedPath/,
    "The host must validate the selected kit folder through the Node helper before copying it");
  assert.match(ui, /Assert-AuraUiThemeKitTree[\s\S]{0,1400}?ReparsePoint/,
    "Theme installation must reject junctions and symbolic links");
  assert.match(ui, /function Assert-AuraUiThemeInstallRoot[\s\S]{0,2400}?ReparsePoint/,
    "Theme installation must reject a redirected app-data destination root");
  const stagingIndex = ui.indexOf("'.install-{0}-{1}' -f $Id");
  const atomicMoveIndex = ui.indexOf("[IO.Directory]::Move($staging, $destination)", stagingIndex);
  assert(stagingIndex >= 0 && atomicMoveIndex > stagingIndex,
    "Theme installation must copy to a private staging folder before an atomic directory move");
  assert.match(ui, /\$expectedTarget\s*=\s*\[IO\.Path\]::GetFullPath\(\(Join-Path \$userRoot \$Id\)\)/,
    "Theme rollback must only remove the exact user-root/id destination");
  assert.match(ui, /Update-AuraUiThemes[\s\S]{0,500}?Invoke-AuraUiSelectTheme\s+-Theme\s+\$importedId/,
    "A validated imported theme must refresh the registry and apply immediately");
  const configSnapshotIndex = ui.indexOf("$previousConfigJson = [IO.File]::ReadAllText");
  const configRestoreIndex = ui.indexOf("Restore-AuraUiConfigSnapshot -Json $previousConfigJson", configSnapshotIndex);
  assert(configSnapshotIndex >= 0 && configRestoreIndex > configSnapshotIndex,
    "A failed post-copy import must restore the complete pre-import configuration");
  assert(!/SetVirtualHostNameToFolderMapping\([\s\S]{0,120}?\$imageValue/i.test(ui),
    "Studio must never map the selected image's source directory");
  assert.match(ui, /\[System\.Windows\.Forms\.OpenFileDialog\]::new\(\)/,
    "Image paths must come from a host-side OpenFileDialog");

  assert.match(ui, /\[System\.Windows\.Forms\.NotifyIcon\]::new\(\)/);
  assert.match(ui, /\[System\.Windows\.Forms\.ContextMenuStrip\]::new\(\)/);
  assert.match(ui, /\$script:TrayOpenStudioItem\.add_Click\(\s*\{\s*Show-AuraUiStudio\s*\}\)/,
    "The tray must retain access to Studio after the main toolbar is removed");
  assert.match(ui,
    /\$script:TrayAppearanceItem\.add_Click\(\s*\{[\s\S]{0,300}?Invoke-AuraUiSetEnabled/,
    "The tray must retain the Original look toggle after the main toolbar is removed");
  assert.match(ui,
    /\$script:TrayOpenDesktopItem\.add_Click\(\s*\{[\s\S]{0,300}?Invoke-AuraUiOpenDesktopApp/,
    "The tray must retain the desktop-app action after the main toolbar is removed");
  assert.match(ui, /\$script:TrayIcon\.add_(?:Mouse)?DoubleClick\(\s*\{[\s\S]{0,300}?Show-AuraUiStudio/,
    "Double-clicking the tray icon must open Studio");
  assert.match(ui, /\$script:TrayIcon\.Dispose\(\)/,
    "The tray icon must be disposed when Claude Aura closes");
  assert.match(ui, /\$AuraIconPath\s*=\s*Join-Path\s+\$Root\s+['"]assets\\brand\\claude-aura\.ico['"]/,
    "Aura forms and notification area must load the owned application icon");
  const iconFactoryStart = ui.indexOf("function New-AuraUiIcon");
  const iconFactoryEnd = ui.indexOf("\nfunction ", iconFactoryStart + 1);
  const iconFactory = ui.slice(iconFactoryStart, iconFactoryEnd);
  assert.match(iconFactory, /\[IO\.File\]::Open\(\$AuraIconPath/);
  assert.match(iconFactory, /\[Drawing\.Icon\]::new\(\$stream,\s*\$Size,\s*\$Size\)/);
  assert.match(iconFactory, /return \[Drawing\.Icon\]\$source\.Clone\(\)/,
    "Each consumer must own its cloned icon instance");
  assert.match(iconFactory, /\$source\.Dispose\(\)[\s\S]*?\$stream\.Dispose\(\)/,
    "Temporary icon resources must be disposed");
  assert(!/Get-AuraClaudeInstall|ExtractAssociatedIcon|\.Executable/.test(iconFactory),
    "Aura must not borrow the official Claude executable icon");
  assert.match(ui, /\$script:MainIcon\s*=\s*New-AuraUiIcon -Size 64/);
  assert.match(ui, /\$script:StudioIcon\s*=\s*New-AuraUiIcon -Size 64/);
  assert.match(ui, /\$script:NotificationIcon\s*=\s*New-AuraUiIcon -Size 32/);
  assert.match(ui, /\$script:Form\.Icon\s*=\s*\$script:MainIcon/);
  assert.match(ui, /\$script:StudioForm\.Icon\s*=\s*\$script:StudioIcon/);
  assert.match(ui, /\$script:TrayIcon\.Icon\s*=\s*\$script:NotificationIcon/);
  const themeIconFactory = powershellFunction("New-AuraUiThemeIcon");
  assert.match(themeIconFactory,
    /GetExtension\(\$Path\)[\s\S]*?['"]\.ico['"][\s\S]*?\[Drawing\.Icon\]::new\(\$stream,\s*\$Size,\s*\$Size\)/,
    "Built-in theme ICOs must retain their native Windows density frames");
  assert.match(themeIconFactory, /\.GetHicon\(\)[\s\S]*?DestroyIcon/,
    "PNG fallback marks must be converted to owned Windows icons without leaking handles");
  const dpiAwarenessIndex = ui.indexOf("SetProcessDpiAwarenessContext($perMonitorV2)");
  const dpiThreadIndex = ui.indexOf("SetThreadDpiAwarenessContext($perMonitorV2)");
  const visualStylesIndex = ui.indexOf("[System.Windows.Forms.Application]::EnableVisualStyles()");
  const firstFormIndex = ui.indexOf("$script:Form = [System.Windows.Forms.Form]::new()");
  assert(dpiAwarenessIndex >= 0 && dpiThreadIndex > dpiAwarenessIndex
      && visualStylesIndex > dpiThreadIndex && firstFormIndex > visualStylesIndex,
  "Per-monitor-v2 process and STA-thread awareness must be requested before visual styles or any Aura form");
  assert.match(ui,
    /SetProcessDpiAwarenessContext[\s\S]{0,500}?SetThreadDpiAwarenessContext[\s\S]{0,500}?GetDpiForWindow[\s\S]{0,300}?GetDpiForSystem[\s\S]{0,300}?GetSystemMetricsForDpi[\s\S]{0,500}?LoadImageW[\s\S]{0,500}?SendMessage/,
    "Aura interop must expose the complete DPI-aware native icon path");
  assert.match(ui,
    /class AuraIconWindow[\s\S]{0,900}?base\.WndProc\(ref message\)[\s\S]{0,220}?message\.Msg == 0x02E0[\s\S]{0,220}?DpiChanged/,
    "A native window tracker must observe WM_DPICHANGED after the base non-client handling");
  const nativeIconLoader = powershellFunction("New-AuraUiNativeIconHandle");
  assert.match(nativeIconLoader,
    /LoadImageW\([\s\S]{0,180}?1,\s*\$Width,\s*\$Height,\s*0x00000010\)/,
    "Native identity handles must load exact requested dimensions from an owned ICO");
  assert(!/0x00008000|LR_SHARED/.test(nativeIconLoader),
    "Native identity handles must never use shared ownership");
  const iconDimensions = powershellFunction("Get-AuraUiSystemIconDimensions");
  for (const metric of [49, 50, 11, 12]) {
    assert(iconDimensions.includes(String(metric)),
      `DPI-aware identity sizing must query Windows metric ${metric}`);
  }
  const nativePairFactory = powershellFunction("New-AuraUiNativeFormIconPair");
  const pairSmallIndex = nativePairFactory.indexOf("$small = New-AuraUiNativeIconHandle");
  const pairLargeIndex = nativePairFactory.indexOf("$large = New-AuraUiNativeIconHandle");
  const pairReturnIndex = nativePairFactory.indexOf("return [PSCustomObject]");
  assert(pairSmallIndex >= 0 && pairLargeIndex > pairSmallIndex && pairReturnIndex > pairLargeIndex,
    "Both small and large native handles must load before a window icon pair is returned");
  const nativePairApply = powershellFunction("Set-AuraUiNativeFormIcons");
  assert.match(nativePairApply,
    /SendMessage\(\$handle,\s*0x0080,\s*\[IntPtr\]::Zero,\s*\$Small\)[\s\S]{0,180}?SendMessage\(\$handle,\s*0x0080,\s*\[IntPtr\]::new\(1\),\s*\$Large\)/,
    "Each form must receive distinct WM_SETICON small and large handles");
  for (const [formName, trackerName] of [["Form", "MainIconWindow"], ["StudioForm", "StudioIconWindow"]]) {
    const formStart = ui.indexOf(`$script:${formName} = [System.Windows.Forms.Form]::new()`);
    const firstHandleForcingUse = formName === "Form"
      ? ui.indexOf("Set-AuraUiFormWithinWorkingArea -Form $script:Form", formStart)
      : ui.indexOf("$script:StudioForm.Controls.Add($script:StudioWebView)", formStart);
    const createdIndex = ui.indexOf(`$script:${formName}.add_HandleCreated({`, formStart);
    const destroyedIndex = ui.indexOf(`$script:${formName}.add_HandleDestroyed({`, formStart);
    const trackerIndex = ui.indexOf(`$script:${trackerName} = [AuraIconWindow]::new()`, formStart);
    assert(formStart >= 0 && trackerIndex > formStart && createdIndex > trackerIndex
        && destroyedIndex > createdIndex && firstHandleForcingUse > destroyedIndex,
    `${formName} must register native handle/DPI tracking before any handle-forcing layout or child control`);
  }
  assert.match(ui,
    /\$script:LauncherDpiWindow = \[AuraIconWindow\]::new\(\)[\s\S]{0,500}?Update-AuraUiLauncherDpi[\s\S]{0,1400}?\$launcherMetrics = Get-AuraUiLauncherMetrics/,
    "The owner-drawn launcher must keep its logical 48 px size under per-monitor-v2 scaling");
  assert.match(ui,
    /function Get-AuraUiLauncherMetrics[\s\S]{0,700}?ConvertTo-AuraUiLauncherPixels -Logical \$script:LauncherCompactSize/,
    "Launcher metrics must derive every dimension from the logical compact size");
  assert(!/function Set-AuraUiLauncherExpanded/.test(ui),
    "The launcher must stay a collapsed circular button with no hover-expanded bar");
  assert(!/Test-AuraUiLauncherGrip/.test(ui),
    "Whole-button dragging replaces the removed expanded-bar grip");
  const launcherPaintStart = ui.indexOf("$script:LauncherButton.add_Paint({");
  const launcherPaintEnd = ui.indexOf("$script:LauncherButton.add_MouseDown(", launcherPaintStart);
  const launcherPaint = ui.slice(launcherPaintStart, launcherPaintEnd);
  const launcherScaleIndex = launcherPaint.indexOf("Get-AuraUiLauncherScale");
  const launcherTransformIndex = launcherPaint.indexOf("ScaleTransform", launcherScaleIndex);
  const launcherRestoreIndex = launcherPaint.indexOf("Restore($graphicsState)", launcherTransformIndex);
  assert(launcherPaintStart >= 0 && launcherPaintEnd > launcherPaintStart
      && launcherScaleIndex >= 0 && launcherTransformIndex > launcherScaleIndex
      && launcherRestoreIndex > launcherTransformIndex,
  "Launcher artwork and hit geometry must paint in DPI-scaled logical coordinates");

  const windowsIconValidator = powershellFunction("Test-AuraUiWindowsIcon");
  assert.match(windowsIconValidator, /\$expectedSizes\s*=\s*@\(16, 20, 24, 32, 40, 48, 64, 128, 256\)/,
    "Windows identity validation must require every supported density frame");
  assert.match(windowsIconValidator,
    /ToUInt16\(\$bytes, 0\)[\s\S]*?ToUInt16\(\$bytes, 2\)[\s\S]*?ToUInt16\(\$bytes, 4\)[\s\S]*?\$expectedSizes\.Count/,
    "Windows identity validation must verify the ICO header and frame count");
  assert.match(windowsIconValidator,
    /\$frameOffset\s+-ne\s+\$expectedOffset[\s\S]*?\$frameOffset\s*\+\s*\[uint64\]\$frameLength[\s\S]*?\$bytes\.Length/,
    "Windows identity validation must reject out-of-order or out-of-bounds frames");
  assert.match(windowsIconValidator, /return \$expectedOffset -eq \$bytes\.Length/,
    "Windows identity validation must reject unindexed trailing bytes");

  const customIconEncoder = powershellFunction("New-AuraUiMultiFramePngIconBytes");
  assert.match(customIconEncoder, /\$sizes\s*=\s*@\(16, 20, 24, 32, 40, 48, 64, 128, 256\)/,
    "Custom launcher marks must generate the complete nine-frame Windows icon");
  assert.match(customIconEncoder,
    /foreach \(\$size in \$sizes\)[\s\S]*?\$bitmap\.Save\(\$memory,\s*\[Drawing\.Imaging\.ImageFormat\]::Png\)[\s\S]*?\[IO\.BinaryWriter\]::new/,
    "Each custom density frame must be rendered losslessly and indexed into one ICO");
  assert(!/\$icon\.Save\(/.test(customIconEncoder),
    "Custom launcher marks must not collapse to a single Icon.Save frame");

  const builtInIconResolver = powershellFunction("Get-AuraUiBuiltInThemeIconPath");
  assert.match(builtInIconResolver, /launcher-mark\.ico/);
  assert.match(builtInIconResolver, /Test-AuraUiIdentityFileWithinRoot[\s\S]*?Test-AuraUiWindowsIcon/,
    "Built-in theme identity must be both root-contained and structurally valid");

  const themeIconSetFactory = powershellFunction("New-AuraUiThemeIconSet");
  assert.match(themeIconSetFactory,
    /Test-AuraUiWindowsIcon -Path \$AssetPath[\s\S]{0,180}?throw 'The prepared theme identity is not a complete Windows icon\.'/,
    "A runtime identity candidate must start from a complete validated multi-frame ICO");
  const identityDigestIndex = themeIconSetFactory.indexOf("Get-AuraUiIdentityDigest -Path $AssetPath");
  const mainDpiIndex = themeIconSetFactory.indexOf("$mainDpi = Get-AuraUiWindowDpi -Form $script:Form");
  const studioDpiIndex = themeIconSetFactory.indexOf("$studioDpi = Get-AuraUiWindowDpi -Form $script:StudioForm");
  const mainIconIndex = themeIconSetFactory.indexOf(
    "$mainNative = New-AuraUiNativeFormIconPair -Path $AssetPath -Dpi $mainDpi");
  const studioIconIndex = themeIconSetFactory.indexOf(
    "$studioNative = New-AuraUiNativeFormIconPair -Path $AssetPath -Dpi $studioDpi");
  const trayIconIndex = themeIconSetFactory.indexOf("$notification = New-AuraUiNotificationIcon -Path $AssetPath");
  const iconSetPathIndex = themeIconSetFactory.indexOf("AssetPath = [IO.Path]::GetFullPath($AssetPath)");
  const iconSetDigestIndex = themeIconSetFactory.indexOf("Digest = $digest", iconSetPathIndex);
  assert(identityDigestIndex >= 0 && mainDpiIndex > identityDigestIndex
      && studioDpiIndex > mainDpiIndex && mainIconIndex > studioDpiIndex
      && studioIconIndex > mainIconIndex && trayIconIndex > studioIconIndex
      && iconSetPathIndex > trayIconIndex && iconSetDigestIndex > iconSetPathIndex,
  "DPI-specific window pairs and the tray icon must share one validated ICO path and digest");
  assert.match(themeIconSetFactory,
    /catch\s*\{[\s\S]{0,180}?\$notification\.Dispose\(\)[\s\S]{0,180}?Dispose-AuraUiNativeFormIconPair -Pair \$mainNative[\s\S]{0,120}?Dispose-AuraUiNativeFormIconPair -Pair \$studioNative[\s\S]{0,80}?throw/,
    "A partially prepared icon set must be disposed without changing the running identity");
  assert.match(ui, /\$script:ThemeIdentityDigest\s*=\s*\$null/,
    "Running identity state must track a content digest as well as a path");
  assert.match(ui, /\$script:ThemeIdentityLock\s*=\s*\$null/,
    "Running identity state must retain the exact committed ICO snapshot");
  const dpiIdentityRefresh = powershellFunction("Update-AuraUiNativeIdentityForDpi");
  assert.match(dpiIdentityRefresh,
    /Test-AuraUiOwnedShortcutIconPath -Path \$script:ThemeIdentityAssetPath[\s\S]{0,220}?Get-AuraUiIdentityDigest -Path \$script:ThemeIdentityAssetPath[\s\S]{0,180}?\$script:ThemeIdentityDigest[\s\S]{0,260}?New-AuraUiNativeFormIconPair/,
    "A DPI refresh must revalidate containment, ICO structure, and the committed digest before replacing handles");
  const notificationIconFactory = powershellFunction("New-AuraUiNotificationIcon");
  assert.match(notificationIconFactory,
    /\$width = \[Math\]::Max\(64, \$size\.Width\)[\s\S]{0,100}?\$height = \[Math\]::Max\(64, \$size\.Height\)/,
    "The notification-area source must remain high-resolution where per-monitor callbacks are unavailable");

  const launcherStyleResolver = powershellFunction("Get-AuraUiLauncherStyle");
  assert(launcherStyleResolver.includes("$editorActive = $enabled -and")
      && launcherStyleResolver.includes("-Names @('launcherStyle')")
      && launcherStyleResolver.includes("$raw = $draftLauncher"),
    "The active last-valid editor draft must drive launcher material before Save");
  assert(!launcherStyleResolver.includes("editorMatches"),
    "Draft launcher styling must not depend on the persisted selected theme id");
  assert.match(launcherStyleResolver,
    /\$editorSourceId[\s\S]{0,500}?\$themeName\s*=\s*\$editorSourceId/,
    "An unsaved copy must resolve its unchanged mark through its validated source theme");
  assert(launcherStyleResolver.includes("launcherStylePreviewUrl")
      && launcherStyleResolver.includes("aura\\.editor/active/launcher-")
      && launcherStyleResolver.includes("$style.source = if ($editorLocalMark)")
      && launcherStyleResolver.includes("'editor'"),
  "A replaced draft mark must resolve only through its validated digest-owned editor preview");

  const identityCandidateBuilder = powershellFunction("New-AuraUiIdentityCandidate");
  assert.match(identityCandidateBuilder,
    /\$null -eq \$script:Launcher[\s\S]{0,500}?\$null -eq \$script:LauncherButton[\s\S]{0,500}?\$null -eq \$script:Form[\s\S]{0,500}?\$null -eq \$script:StudioForm[\s\S]{0,500}?\$null -eq \$script:TrayIcon/,
    "Identity preparation must require every launcher, window, Studio, and tray consumer");
  const assetLockIndex = identityCandidateBuilder.indexOf("$assetLock = [IO.File]::Open(");
  const assetShareIndex = identityCandidateBuilder.indexOf(
    "[IO.FileShare]::Read)", assetLockIndex);
  const lockedAssetRevalidationIndex = identityCandidateBuilder.indexOf(
    "$lockedAssetPath = Get-AuraUiLauncherAssetPath -Style $Style", assetShareIndex);
  const assetCopyIndex = identityCandidateBuilder.indexOf(
    "$assetLock.CopyTo($assetMemory)", lockedAssetRevalidationIndex);
  const snapshotResolveIndex = identityCandidateBuilder.indexOf(
    "Resolve-AuraUiLauncherAppearance -Style $Style", assetCopyIndex);
  const snapshotBytesIndex = identityCandidateBuilder.indexOf(
    "-ResolvedAssetPath $assetPath -AssetBytes $assetBytes", snapshotResolveIndex);
  assert(assetLockIndex >= 0 && assetShareIndex > assetLockIndex
      && lockedAssetRevalidationIndex > assetShareIndex && assetCopyIndex > lockedAssetRevalidationIndex
      && snapshotResolveIndex > assetCopyIndex && snapshotBytesIndex > snapshotResolveIndex,
  "A candidate must revalidate and derive its painted mark from one write-locked PNG snapshot");
  assert.match(identityCandidateBuilder,
    /New-AuraUiMultiFramePngIconBytes -SourceBytes \$assetBytes[\s\S]{0,260}?Get-AuraUiShortcutIconPath -Style \$Style[\s\S]{0,180}?-LauncherAssetBytes \$assetBytes -ExpectedIconBytes \$expectedIconBytes[\s\S]{0,260}?Test-AuraUiOwnedShortcutIconPath -Path \$shortcutIconPath/,
    "The candidate ICO must resolve through the contained Aura-owned shortcut path");
  const customIdentityIndex = identityCandidateBuilder.indexOf(
    "\"$($Style.source)\" -cin @('user', 'editor')");
  const customIcoGuardIndex = identityCandidateBuilder.indexOf("[a-f0-9]{{16}}\\.ico$", customIdentityIndex);
  const runtimeIcoReuseIndex = identityCandidateBuilder.indexOf(
    "New-AuraUiThemeIconSet -AssetPath $shortcutIconPath", customIcoGuardIndex);
  assert(customIdentityIndex >= 0 && customIcoGuardIndex > customIdentityIndex
      && runtimeIcoReuseIndex > customIcoGuardIndex,
  "A custom mark must reuse its content-addressed multi-frame shortcut ICO for every running icon");
  assert.match(identityCandidateBuilder,
    /\$identityLock = \[IO\.File\]::Open\([\s\S]{0,180}?\[IO\.FileShare\]::Read\)[\s\S]{0,300}?\$identityLock\.CopyTo\(\$identityMemory\)[\s\S]{0,420}?\$identityBytes\[\$index\] -ne \$expectedIconBytes\[\$index\][\s\S]{0,260}?not derived from the locked launcher-mark snapshot/,
    "Custom runtime identity must byte-match the ICO derived from the same locked PNG snapshot");
  assert.match(identityCandidateBuilder,
    /New-AuraUiThemeIconSet -AssetPath \$shortcutIconPath[\s\S]{0,180}?New-AuraUiLauncherRegion[\s\S]{0,700}?New-AuraUiLauncherSurfaceBitmap[\s\S]{0,300}?Get-AuraUiLauncherPreviewUrl -Style \$Style[\s\S]{0,900}?ShortcutIconPath = \[IO\.Path\]::GetFullPath\(\$shortcutIconPath\)[\s\S]{0,180}?AssetLock = \$assetLock[\s\S]{0,100}?IdentityLock = \$identityLock/,
    "The candidate must fully prepare icons, launcher region, layered surface, material, and safe preview URL before commit");
  assert.match(identityCandidateBuilder,
    /catch\s*\{[\s\S]{0,500}?\$appearance\.Mark\.Dispose\(\)[\s\S]{0,300}?\$region\.Dispose\(\)[\s\S]{0,220}?Dispose-AuraUiThemeIconSet -IconSet \$iconSet[\s\S]{0,220}?\$identityLock\.Dispose\(\)[\s\S]{0,160}?\$assetLock\.Dispose\(\)[\s\S]{0,220}?return \$null/,
    "Failed candidate preparation must dispose every owned resource and leave no partial candidate");

  const identityCandidateCommit = powershellFunction("Set-AuraUiIdentityCandidate");
  for (const field of [
    "LauncherStyle",
    "LauncherMark",
    "NotificationIcon",
    "MainWindowIconPair",
    "StudioWindowIconPair",
    "ThemeIdentityAssetPath",
    "ThemeIdentityDigest",
    "ThemeIdentityLock",
    "ShellIdentityIconPath",
    "EffectiveLauncherIdentity",
  ]) {
    assert(identityCandidateCommit.includes(`${field} = $script:${field}`),
      `The identity transaction must snapshot ${field} before mutation`);
  }
  assert.match(identityCandidateCommit,
    /\$script:Launcher\.Region\s*=\s*\$Candidate\.Region[\s\S]{0,500}?\$script:TrayIcon\.Icon\s*=\s*\$Candidate\.IconSet\.Notification[\s\S]{0,180}?Set-AuraUiNativeFormIcons -Form \$script:Form[\s\S]{0,180}?\$Candidate\.IconSet\.MainNative\.Small[\s\S]{0,180}?Set-AuraUiNativeFormIcons -Form \$script:StudioForm[\s\S]{0,180}?\$Candidate\.IconSet\.StudioNative\.Small/,
    "Launcher geometry, tray icon, and both DPI-aware window pairs must swap from one candidate");
  assert.match(identityCandidateCommit,
    /\$script:LauncherStyle\s*=\s*\$Candidate\.Style[\s\S]{0,180}?\$script:LauncherMark\s*=\s*\$Candidate\.Mark[\s\S]{0,300}?\$script:MainWindowIconPair\s*=\s*\$Candidate\.IconSet\.MainNative[\s\S]{0,180}?\$script:StudioWindowIconPair\s*=\s*\$Candidate\.IconSet\.StudioNative[\s\S]{0,400}?\$script:ThemeIdentityLock\s*=\s*\$Candidate\.IdentityLock[\s\S]{0,180}?\$script:ShellIdentityIconPath\s*=\s*\$Candidate\.ShortcutIconPath[\s\S]{0,260}?\$script:EffectiveLauncherIdentity\s*=\s*\[PSCustomObject\]\[ordered\]@\{\s*launcher = \$Candidate\.Material\s*previewUrl = \$Candidate\.PreviewUrl/,
    "The visible launcher, shell path, and Studio-facing effective identity must commit together");
  assert.match(identityCandidateCommit,
    /\$Candidate\.Mark\s*=\s*\$null[\s\S]{0,400}?\$Candidate\.Region\s*=\s*\$null[\s\S]{0,240}?\$Candidate\.IconSet\s*=\s*\$null[\s\S]{0,100}?\$Candidate\.IdentityLock\s*=\s*\$null[\s\S]{0,600}?foreach \(\$resource in @\([\s\S]{0,220}?\$resource\.Dispose\(\)[\s\S]{0,180}?Dispose-AuraUiNativeFormIconPair -Pair \$old\.MainWindowIconPair[\s\S]{0,120}?Dispose-AuraUiNativeFormIconPair -Pair \$old\.StudioWindowIconPair[\s\S]{0,180}?\$old\.ThemeIdentityLock\.Dispose\(\)[\s\S]{0,80}?return \$true/,
    "A successful commit must transfer candidate ownership before disposing the prior complete identity");
  for (const rollbackSurface of [
    "launcher-region", "launcher-material", "notification-area", "Aura-window", "Studio-window",
  ]) {
    assert(identityCandidateCommit.includes(`Theme identity ${rollbackSurface} rollback failed`),
      `Runtime rollback must isolate failures on the ${rollbackSurface} surface`);
  }
  assert.match(identityCandidateCommit,
    /\$script:ThemeIdentityLock\s*=\s*\$old\.ThemeIdentityLock[\s\S]{0,180}?\$script:ShellIdentityIconPath\s*=\s*\$old\.ShellIdentityIconPath[\s\S]{0,180}?\$script:EffectiveLauncherIdentity\s*=\s*\$old\.EffectiveLauncherIdentity[\s\S]{0,260}?IdentityRollbackIncomplete[\s\S]{0,260}?return \$false/,
    "A runtime commit failure must restore prior state and flag any independently failed surface rollback");

  const launcherStyleUpdate = powershellFunction("Update-AuraUiLauncherStyle");
  assert.match(launcherStyleUpdate,
    /\$requestedStyle = Get-AuraUiLauncherStyle[\s\S]{0,180}?\$defaultStyle = Get-AuraUiLauncherDefaultStyle[\s\S]{0,350}?source -NotePropertyValue 'builtin'[\s\S]{0,180}?theme -NotePropertyValue 'default'[\s\S]{0,120}?\$styles = @\(\$requestedStyle, \$defaultStyle\)/,
    "The transaction must try the requested identity and then exactly one complete Default identity");
  assert.match(launcherStyleUpdate,
    /for \(\$attempt = 0; \$attempt -lt 2; \$attempt\+\+\)[\s\S]{0,180}?\$candidate = New-AuraUiIdentityCandidate -Style \$styles\[\$attempt\]/,
    "Identity fallback must remain a bounded requested-then-Default sequence");
  const shortcutApplyIndex = launcherStyleUpdate.indexOf(
    "$shortcutSnapshot = Update-AuraUiOwnedShortcuts -IconPath $candidate.ShortcutIconPath");
  const runtimeCommitIndex = launcherStyleUpdate.indexOf(
    "Set-AuraUiIdentityCandidate -Candidate $candidate", shortcutApplyIndex);
  assert(shortcutApplyIndex >= 0 && runtimeCommitIndex > shortcutApplyIndex,
    "All four shortcuts must commit transactionally before the runtime candidate becomes visible");
  const shortcutIncompleteIndex = launcherStyleUpdate.indexOf(
    "$shortcutSnapshot.RollbackIncomplete -eq $true");
  const shortcutSuccessIndex = launcherStyleUpdate.indexOf(
    "$shortcutSnapshot.Success -ne $true", shortcutIncompleteIndex);
  assert(shortcutIncompleteIndex >= 0 && shortcutSuccessIndex > shortcutIncompleteIndex
      && launcherStyleUpdate.slice(shortcutIncompleteIndex, shortcutSuccessIndex)
        .includes("Stop-AuraUiAfterIdentityFailure"),
  "An incomplete shortcut rollback must abort fallback and fail closed before any ordinary candidate handling");
  assert.equal((launcherStyleUpdate.match(/Restore-AuraUiOwnedShortcuts -Snapshot \$shortcutSnapshot/g) ?? []).length, 2,
    "Both a rejected runtime commit and a later transaction exception must restore shortcut identity");
  assert.match(launcherStyleUpdate,
    /if \(-not \(Set-AuraUiIdentityCandidate -Candidate \$candidate\)\)\s*\{[\s\S]{0,180}?Restore-AuraUiOwnedShortcuts -Snapshot \$shortcutSnapshot[\s\S]{0,400}?IdentityRollbackIncomplete[\s\S]{0,500}?DeferredIdentityCandidates\.Add\(\$candidate\)[\s\S]{0,100}?\$candidate = \$null[\s\S]{0,100}?break[\s\S]{0,100}?continue/,
    "A failed runtime commit must restore shortcuts before trying Default");
  assert.match(launcherStyleUpdate,
    /finally\s*\{[\s\S]{0,120}?Dispose-AuraUiIdentityCandidate -Candidate \$candidate[\s\S]{0,100}?\}[\s\S]{0,180}?Theme identity remained unchanged[\s\S]{0,80}?return \$false/,
    "Failed attempts must dispose candidates and preserve the complete prior identity");
  assert(!/\$script:(?:LauncherStyle|LauncherMark|NotificationIcon|MainWindowIconPair|StudioWindowIconPair|ThemeIdentityAssetPath|ThemeIdentityDigest|ThemeIdentityLock|ShellIdentityIconPath|EffectiveLauncherIdentity)\s*=/.test(launcherStyleUpdate),
    "The coordinator must not mutate prior runtime identity outside the rollback-capable commit function");
  const identityFailureStop = powershellFunction("Stop-AuraUiAfterIdentityFailure");
  for (const hiddenSurface of [
    "$script:TrayIcon.Visible = $false",
    "$script:Launcher.Hide()",
    "$script:StudioForm.Hide()",
    "$script:Form.Hide()",
  ]) {
    assert(identityFailureStop.includes(hiddenSurface),
      `Incomplete rollback shutdown must immediately hide ${hiddenSurface}`);
  }
  assert.match(identityFailureStop,
    /BeginInvoke\(\$closeAction\)[\s\S]{0,180}?catch\s*\{[\s\S]{0,100}?\$script:Form\.Close\(\)/,
    "Incomplete rollback shutdown must close on the UI queue with a direct fallback");

  const studioStateSender = powershellFunction("Send-AuraUiStudioState");
  assert.match(studioStateSender,
    /effectiveIdentity\s*=\s*\$script:EffectiveLauncherIdentity/,
    "Studio host state must publish the successfully committed effective identity as one DTO");
  assert.match(studioApp,
    /state\.effectiveIdentity\s*=\s*normalizeEffectiveIdentity\(data\.effectiveIdentity\)/,
    "Studio must validate the complete effective identity received from the host");
  assert.match(studioApp,
    /const connectedIdentity\s*=\s*state\.effectiveIdentity\s*\?\?[\s\S]{0,260}?applyLauncherMaterial\(state\.connected\s*\?\s*connectedIdentity\.launcher\s*:\s*disconnectedLauncher\)[\s\S]{0,300}?const themeMarkUrl\s*=\s*state\.connected\s*\?\s*connectedIdentity\.previewUrl[\s\S]{0,300}?railThemeMark\.src\s*=\s*themeMarkUrl[\s\S]{0,120}?studioThemeIcon\.href\s*=\s*themeMarkUrl/,
    "The committed host identity must drive both Studio's rail mark and favicon");

  const mouseEnterStart = ui.indexOf("$launcherPointerEnter = {");
  const mouseEnterEnd = ui.indexOf("$launcherPointerLeave = {", mouseEnterStart);
  assert(mouseEnterStart >= 0 && mouseEnterEnd > mouseEnterStart,
    "The launcher pointer-enter handler is missing");
  assert(!ui.slice(mouseEnterStart, mouseEnterEnd).includes("Update-AuraUiLauncherStyle"),
    "Pointer enter must never lazily initialize or mutate identity");
  assert.match(ui, /\$script:LauncherButton\.add_MouseEnter\(\$launcherPointerEnter\)/,
    "The shared pointer-enter handler must be wired to the launcher button");
  const initialIdentityIndex = ui.lastIndexOf(
    "try { $initialIdentityReady = [bool](Update-AuraUiLauncherStyle) }");
  const trayVisibleIndex = ui.indexOf("$script:TrayIcon.Visible = $true", initialIdentityIndex);
  const mainFormRunIndex = ui.indexOf("[System.Windows.Forms.Application]::Run($script:Form)", initialIdentityIndex);
  for (const controlCreation of [
    "$script:Form = [System.Windows.Forms.Form]::new()",
    "$script:StudioForm = [System.Windows.Forms.Form]::new()",
    "$script:TrayIcon = [System.Windows.Forms.NotifyIcon]::new()",
    "$script:Launcher = [System.Windows.Forms.Form]::new()",
  ]) {
    const creationIndex = ui.indexOf(controlCreation);
    assert(creationIndex >= 0 && creationIndex < initialIdentityIndex,
      `${controlCreation.split(" = ")[0]} must exist before the initial identity transaction`);
  }
  assert(initialIdentityIndex >= 0 && trayVisibleIndex > initialIdentityIndex
      && mainFormRunIndex > trayVisibleIndex,
  "The initial identity transaction must finish before the tray or main form becomes visible");
  assert.match(ui,
    /try \{ \$initialIdentityReady = \[bool\]\(Update-AuraUiLauncherStyle\) \}[\s\S]{0,220}?if \(-not \$initialIdentityReady\)\s*\{[\s\S]{0,180}?throw 'Claude Aura could not establish a complete safe application identity\.'[\s\S]{0,140}?\$script:TrayIcon\.Visible = \$true/,
    "Startup must fail closed instead of revealing tray or launcher surfaces without a complete identity");
  const launcherPositionUpdate = powershellFunction("Update-AuraUiLauncherPosition");
  assert.match(launcherPositionUpdate,
    /if \(-not \$script:Launcher\.Visible\)\s*\{[\s\S]{0,220}?-not \(Update-AuraUiLauncherStyle\)[\s\S]{0,80}?return[\s\S]{0,220}?\$null -eq \$script:EffectiveLauncherIdentity[\s\S]{0,80}?return[\s\S]{0,120}?\$script:Launcher\.Show\(\$script:Form\)/,
    "The launcher must never Show unless a complete effective identity exists");
  assert.match(launcherPositionUpdate, /Update-AuraUiLauncherHintPosition/,
    "Aura window geometry changes must reposition an open launcher guide");
  const launcherHintPositionUpdate = powershellFunction("Update-AuraUiLauncherHintPosition");
  assert.match(launcherHintPositionUpdate,
    /\$script:Launcher\.Location\.X[\s\S]{0,180}?\$script:LauncherHint\.Width[\s\S]{0,180}?\$script:Launcher\.Location\.Y[\s\S]{0,180}?\$script:LauncherHint\.Height/,
    "The launcher guide must derive its position from the current launcher geometry");
  assert.match(launcherHintPositionUpdate,
    /PointToScreen[\s\S]{0,260}?ClientSize\.Width[\s\S]{0,100}?ClientSize\.Height[\s\S]{0,500}?\$script:LauncherHint\.Location\s*=\s*\$desired/,
    "The launcher guide must clamp its refreshed position to the current Aura client area");
  assert.match(ui,
    /\$script:Launcher\.add_LocationChanged\(\{\s*Update-AuraUiLauncherHintPosition\s*\}\)/,
    "Dragging or DPI-moving the launcher must carry its open guide with it");
  const launcherHintShow = powershellFunction("Show-AuraUiLauncherHint");
  assert.match(launcherHintShow,
    /\$script:LauncherHint\s*=\s*\$hint[\s\S]{0,180}?Update-AuraUiLauncherHintPosition[\s\S]{0,220}?ShowWindow\(\$hint\.Handle,\s*8\)/,
    "The launcher guide must use the same live positioning path before its first frame");
  const trayAppearanceRefresh = powershellFunction("Update-AuraUiTrayAppearance");
  assert(!trayAppearanceRefresh.includes("Update-AuraUiLauncherStyle"),
    "Opening a tray or launcher menu must refresh labels only, never run an identity transaction");

  assert.match(ui,
    /if \(\$null -ne \$script:LauncherMark\)[\s\S]{0,500}?DrawImage\(\$script:LauncherMark[\s\S]{0,420}?FromHtml\("\$\(\$style\.accent\)"\)[\s\S]{0,180}?FillEllipse\(\$badge/,
    "The launcher accent token must remain visible when an authored mark is loaded");
  assert.match(ui,
    /foreach \(\$ownedIcon in @\(\$script:MainIcon, \$script:StudioIcon, \$script:NotificationIcon\)\)[\s\S]{0,220}?\$ownedIcon\.Dispose\(\)/,
    "Every owned form and notification icon must be disposed");
  assert(!/ExtractAssociatedIcon/.test(ui), "Aura must never extract an icon from the official Claude app");

  assert.match(common,
    /function Test-AuraUiHostRunning[\s\S]{0,300}?Mutex\]::OpenExisting\("Local\\ClaudeAura\.\$sid\.Ui"\)[\s\S]{0,220}?WaitHandleCannotBeOpenedException/,
    "Installer preflight must detect the exact per-user Aura single-instance mutex");
  const installHostCheckIndices = [...install.matchAll(/if \(Test-AuraUiHostRunning\)/g)]
    .map((match) => match.index);
  const installValidationIndex = install.indexOf(
    "if (Test-Path -LiteralPath (Join-Path $SourceRoot '.git'))");
  const installSelfUpdateRejectionIndex = install.indexOf(
    "Claude Aura cannot update itself in place.");
  const installSafeLocationIndex = install.indexOf(
    "Set-Location -LiteralPath $safeWorkingDirectory");
  const installStageIndex = install.indexOf(
    "New-AuraInstallStage -AuraRoot $auraRoot -StageRoot $stageRoot");
  const installRenameIndex = install.indexOf(
    "-Source $installRoot -Destination $backupRoot");
  assert.equal(installHostCheckIndices.length, 2,
    "Installer must probe for Aura before validation and again at the swap boundary");
  assert(installHostCheckIndices[0] < installValidationIndex
      && installSelfUpdateRejectionIndex > installHostCheckIndices[0]
      && installSelfUpdateRejectionIndex < installValidationIndex
      && installSafeLocationIndex > installValidationIndex
      && installValidationIndex < installStageIndex
      && installSafeLocationIndex < installStageIndex
      && installStageIndex < installHostCheckIndices[1]
      && installHostCheckIndices[1] < installRenameIndex,
  "Installer must reject in-place self-update, leave the app working directory, and exclude a live host at both boundaries");
  const installOperationUnlockIndex = install.indexOf("Exit-AuraOperationLock -Mutex $lock");
  const deferredLaunchIndex = install.indexOf(
    "Start-Process -FilePath $deferredLaunchPowerShell");
  assert(installOperationUnlockIndex >= 0 && deferredLaunchIndex > installOperationUnlockIndex,
    "Installer -Launch must start Aura only after releasing the startup-operation mutex");
  const uiStartupLockIndex = ui.indexOf("$startupOperationLock = Enter-AuraOperationLock");
  const uiStartupWriteIndex = ui.indexOf(
    "[void](Assert-AuraUiStudioEditorRoots -Create)", uiStartupLockIndex);
  const uiMutexIndex = ui.indexOf(
    '$mutex = [System.Threading.Mutex]::new($true, "Local\\ClaudeAura.$sid.Ui"');
  const uiStartupUnlockIndex = ui.indexOf(
    "Exit-AuraOperationLock -Mutex $startupOperationLock");
  assert(uiStartupLockIndex >= 0 && uiStartupWriteIndex > uiStartupLockIndex
      && uiMutexIndex > uiStartupWriteIndex && uiStartupUnlockIndex > uiMutexIndex,
  "Aura startup must hold the install-operation mutex until its UI mutex is observable");
  const uninstallOperationLockIndex = uninstall.indexOf(
    "$operationLock = Enter-AuraOperationLock");
  const uninstallMutexIndex = uninstall.indexOf(
    '[System.Threading.Mutex]::OpenExisting("Local\\ClaudeAura.$sid.Ui")');
  const uninstallRemovalIndex = uninstall.indexOf("Remove-Item");
  assert(uninstallOperationLockIndex >= 0 && uninstallMutexIndex > uninstallOperationLockIndex
      && uninstallRemovalIndex > uninstallMutexIndex,
  "Uninstaller must serialize startup and refuse the live identity lock before removing product files");
  assert.match(uninstall,
    /function Assert-AuraOwnedTreeHasNoReparsePoints[\s\S]{0,1400}?FileAttributes\]::ReparsePoint[\s\S]{0,700}?Get-ChildItem -LiteralPath \$directory -Force/,
    "Uninstaller must reject reparse points throughout every recursively removed product tree");
  assert.match(uninstall,
    /\^\\\.app-\(\?:stage\|backup\|rollback\)-\[0-9a-f\]\{32\}\$/,
    "Uninstaller must recognize only exact managed installer-transaction siblings");
  assert.match(uninstall,
    /foreach \(\$managedAppRoot in \$managedAppRoots\)[\s\S]{0,260}?Assert-AuraOwnedTreeHasNoReparsePoints[\s\S]{0,260}?Remove-Item -LiteralPath \$managedAppRoot -Recurse -Force/,
    "Uninstaller must validate and remove the active app plus exact retained transaction trees");

  const shortcutDefinitionsMatch = install.match(/\$shortcutDefinitions\s*=\s*@\(([\s\S]*?)\n\s*\)\s*\n\s*foreach \(\$folder/);
  assert(shortcutDefinitionsMatch, "Installer shortcut definitions are missing");
  const shortcutNames = [...shortcutDefinitionsMatch[1].matchAll(/Name\s*=\s*['"]([^'"]+\.lnk)['"]/g)]
    .map((match) => match[1]);
  assert.deepEqual(shortcutNames, ["Claude Aura.lnk", "Claude Aura Studio.lnk"],
    "Installer must create separate normal Aura and Studio shortcuts");
  assert.match(shortcutDefinitionsMatch[1],
    /Name\s*=\s*['"]Claude Aura Studio\.lnk['"][\s\S]{0,160}?Arguments\s*=\s*"\$baseArguments -OpenStudio"/,
    "The Studio shortcut must use the dedicated -OpenStudio route");
  assert.match(install, /foreach \(\$folder in @\(\$desktop, \$menuRoot\)\)/,
    "Normal Aura and Studio shortcuts must be installed on Desktop and Start menu");
  assert.match(install, /\$shortcut\.IconLocation\s*=\s*"\$iconPath,0"/,
    "Aura-owned shortcuts must use the selected installed theme icon");
  assert.match(install,
    /\$canonicalThemeIds\s+-ccontains\s+\$installedConfig\.theme[\s\S]{0,320}?Get-AuraInstalledThemeIconPath\s+-InstallRoot\s+\$installRoot\s+-ThemeId\s+\$selectedBuiltInTheme/,
    "Installer shortcuts must initialize from the enabled selected built-in theme only");
  assert.match(install,
    /if \(-not \$iconPath -and \$selectedBuiltInTheme -cne ['"]default['"]\)[\s\S]{0,180}?ThemeId ['"]default['"]/,
    "Installer shortcut identity must fall back to Default");
  assert.match(install,
    /function Get-AuraInstalledThemeIconPath[\s\S]{0,900}?GetFullPath[\s\S]{0,900}?StartsWith[\s\S]{0,1200}?ReparsePoint/,
    "Installer theme icon resolution must be contained and reject redirected paths");
  assert(!/ExtractAssociatedIcon|IconLocation\s*=\s*[^\r\n]*(?:Claude\.exe|\$claude)/i.test(install),
    "Installer shortcuts must not borrow the official Claude executable icon");

  const ownedShortcutUpdater = powershellFunction("Update-AuraUiOwnedShortcuts");
  const refreshedShortcutNames = [...ownedShortcutUpdater.matchAll(/['"](Claude Aura(?: Studio)?\.lnk)['"]/g)]
    .map((match) => match[1]);
  assert.deepEqual(refreshedShortcutNames, [
    "Claude Aura.lnk",
    "Claude Aura Studio.lnk",
    "Claude Aura.lnk",
    "Claude Aura Studio.lnk",
  ], "Theme changes may update only the four Desktop/Start-menu Aura shortcuts");
  assert.match(ownedShortcutUpdater,
    /\$installedScript[\s\S]*?\$currentScript[\s\S]*?Equals\(\$currentScript,\s*\$installedScript/,
    "Shortcut refresh must run only from the exact installed aura-ui.ps1");
  assert.match(ownedShortcutUpdater,
    /\$present\s*=\s*@\(\$ownedShortcuts \| Where-Object[\s\S]{0,240}?\$present\.Count -eq 0[\s\S]{0,220}?Managed = \$false[\s\S]{0,180}?\$present\.Count -ne \$ownedShortcuts\.Count[\s\S]{0,220}?return \$null/,
    "Shortcut refresh may skip a machine with no Aura links, but must reject a partial four-link set");
  const shortcutValidationIndex = ownedShortcutUpdater.indexOf("foreach ($owned in $ownedShortcuts)");
  const shortcutValidatedIndex = ownedShortcutUpdater.indexOf("$validated.Add(", shortcutValidationIndex);
  const shortcutMutationIndex = ownedShortcutUpdater.indexOf("foreach ($entry in $validated)", shortcutValidatedIndex);
  assert(shortcutValidationIndex >= 0 && shortcutValidatedIndex > shortcutValidationIndex
      && shortcutMutationIndex > shortcutValidatedIndex,
  "All four owned shortcuts must be validated before the first shortcut is mutated");
  assert.match(ownedShortcutUpdater,
    /foreach \(\$owned in \$ownedShortcuts\)[\s\S]{0,300}?ReparsePoint[\s\S]{0,500}?Test-AuraUiOwnedShortcutTarget[\s\S]{0,400}?\$validated\.Add\(/,
    "Every shortcut must be non-redirected and match Aura's exact installed target before mutation");
  const rollbackSnapshotIndex = ownedShortcutUpdater.indexOf(
    "for ($rollbackIndex = $validated.Count - 1; $rollbackIndex -ge 0; $rollbackIndex--)");
  const rollbackIconIndex = ownedShortcutUpdater.indexOf(
    "$rollback.IconLocation = $validated[$rollbackIndex].PreviousIcon", rollbackSnapshotIndex);
  const rollbackSaveIndex = ownedShortcutUpdater.indexOf("$rollback.Save()", rollbackIconIndex);
  const rollbackThrowIndex = ownedShortcutUpdater.indexOf("throw", rollbackSaveIndex);
  assert(rollbackSnapshotIndex >= 0 && rollbackIconIndex > rollbackSnapshotIndex
      && rollbackSaveIndex > rollbackIconIndex && rollbackThrowIndex > rollbackSaveIndex,
  "A shortcut Save that writes and then throws must roll back the complete prevalidated snapshot");
  assert.match(ownedShortcutUpdater,
    /\$rollbackComplete = \$false[\s\S]{0,700}?if \(-not \$rollbackComplete\)\s*\{[\s\S]{0,220}?Success = \$false[\s\S]{0,180}?RollbackIncomplete = \$true/,
    "An incomplete internal shortcut rollback must be reported distinctly, never collapsed to an ordinary candidate miss");
  assert.match(ownedShortcutUpdater,
    /SHChangeNotify\(0x00002000,\s*0x0005,\s*\$entry\.Path[\s\S]*?SHChangeNotify\(0x08000000/,
    "Explorer must be notified after owned shortcut icons change");
  assert.match(ownedShortcutUpdater,
    /return \[PSCustomObject\]@\{\s*Success = \$true;\s*Managed = \$true;\s*Changes = @\(\$changed\)\s*\}/,
    "A successful four-shortcut transaction must return the exact rollback snapshot");
  const ownedShortcutRollback = powershellFunction("Restore-AuraUiOwnedShortcuts");
  assert.match(ownedShortcutRollback,
    /\$null -eq \$Snapshot[\s\S]{0,180}?\$Snapshot\.Managed[\s\S]{0,180}?\$Snapshot\.Changes[\s\S]{0,500}?foreach \(\$entry in @\(\$Snapshot\.Changes\)\)[\s\S]{0,300}?\$shortcut\.IconLocation = \$entry\.PreviousIcon[\s\S]{0,120}?\$shortcut\.Save\(\)/,
    "Coordinator rollback must restore every changed shortcut from the returned snapshot");
  assert.match(ownedShortcutRollback,
    /\$restored = \$false[\s\S]{0,500}?return \$restored/,
    "Shortcut rollback must report incomplete restoration instead of claiming success");
  assert(!/ExtractAssociatedIcon|Claude\.exe|Get-AuraClaudeInstall/i.test(ownedShortcutUpdater),
    "Dynamic shortcut identity must never borrow a Claude executable icon");

  const customShortcutIcon = powershellFunction("New-AuraUiCustomShortcutIcon");
  assert.match(customShortcutIcon,
    /ComputeHash\(\$LauncherAssetBytes\)[\s\S]*?\$digest\.Substring\(0, 16\)/,
    "Custom identity filenames must be content-addressed");
  assert.match(customShortcutIcon,
    /\$existingBytes\.Length -eq \$ExpectedIconBytes\.Length[\s\S]{0,260}?\$existingBytes\[\$index\] -ne \$ExpectedIconBytes\[\$index\][\s\S]{0,300}?Test-AuraUiWindowsIcon -Path \$target/,
    "A cached content-addressed ICO must byte-match the freshly derived expected icon before reuse");
  const customWriteIndex = customShortcutIcon.indexOf(
    "$output.Write($ExpectedIconBytes, 0, $ExpectedIconBytes.Length)");
  const customValidateIndex = customShortcutIcon.indexOf(
    "Test-AuraUiWindowsIcon -Path $temporary", customWriteIndex);
  const customMoveIndex = customShortcutIcon.indexOf("[IO.File]::Move", customValidateIndex);
  assert(customWriteIndex >= 0 && customValidateIndex > customWriteIndex && customMoveIndex > customValidateIndex,
    "Custom identity must write expected snapshot bytes, validate them, and atomically install in that order");
  const shortcutIconCleanup = powershellFunction("Remove-AuraUiUnusedShortcutIcons");
  assert.match(shortcutIconCleanup,
    /ReparsePoint[\s\S]{0,900}?TopDirectoryOnly[\s\S]{0,800}?\^\[a-z\]\[a-z0-9-\][\s\S]{0,300}?Test-AuraUiIdentityFileWithinRoot[\s\S]{0,200}?\[IO\.File\]::Delete/,
    "Custom icon cleanup must stay non-recursive, exact-name allowlisted, contained, and reparse-safe");
  const jumpListRegistration = powershellFunction("Register-AuraUiJumpList");
  assert.match(jumpListRegistration,
    /\$jumpList\.Apply\(\)[\s\S]{0,140}?JumpListIdentityPath\s*=\s*\$jumpIconPath[\s\S]{0,80}?return \$true[\s\S]{0,180}?return \$false/,
    "Jump List identity must report and remember only a completed shell refresh");
  assert.match(launcherStyleUpdate,
    /\$jumpListCurrent = \$script:JumpListRegistered -and \[string\]::Equals\([\s\S]{0,180}?\$script:JumpListIdentityPath,\s*\$script:ShellIdentityIconPath[\s\S]{0,300}?if \(\$script:JumpListRegistered\)[\s\S]{0,500}?Register-AuraUiJumpList[\s\S]{0,500}?if \(\$jumpListCurrent\)\s*\{[\s\S]{0,120}?Remove-AuraUiUnusedShortcutIcons -KeepPath \$script:ShellIdentityIconPath/,
    "Old custom ICOs may be pruned only after the Jump List is confirmed on the current committed identity");
  const timerStart = ui.indexOf("$timer.add_Tick({");
  const timerIdentityEnd = ui.indexOf("if ($null -ne $script:StudioOpenSignal", timerStart);
  const timerIdentityRetry = ui.slice(timerStart, timerIdentityEnd);
  assert(timerStart >= 0 && timerIdentityEnd > timerStart,
    "The Jump List retry timer block is missing");
  assert.match(timerIdentityRetry,
    /Register-AuraUiJumpList[\s\S]{0,300}?\$script:JumpListRegistered[\s\S]{0,400}?\[string\]::Equals\(\$script:JumpListIdentityPath,\s*\$script:ShellIdentityIconPath[\s\S]{0,180}?Remove-AuraUiUnusedShortcutIcons -KeepPath \$script:ShellIdentityIconPath/,
    "Deferred cleanup must also prove the retried Jump List matches the current identity");
  assert.equal((ui.match(/Remove-AuraUiUnusedShortcutIcons -KeepPath \$script:ShellIdentityIconPath/g) ?? []).length, 2,
    "Custom ICO cleanup must have no path that bypasses current Jump List confirmation");
  const uninstallShortcutBlock = uninstall.match(
    /\$shortcutDefinitions\s*=\s*@\(([\s\S]*?)\n\s*\)\s*\n\s*\$shortcutShell\s*=\s*New-Object/);
  assert(uninstallShortcutBlock, "Uninstaller shortcut allowlist is missing");
  const uninstalledShortcutNames = [...uninstallShortcutBlock[1].matchAll(/['"]([^'"]+\.lnk)['"]/g)]
    .map((match) => match[1]);
  assert.deepEqual(uninstalledShortcutNames, [
    "Claude Aura.lnk",
    "Claude Aura Studio.lnk",
    "Claude Aura.lnk",
    "Claude Aura Studio.lnk",
    "Uninstall Claude Aura.lnk",
  ], "Uninstaller must remove exactly four Aura launch shortcuts plus its owned uninstall shortcut");
  assert.match(uninstall,
    /function Test-AuraOwnedShortcutTarget[\s\S]*?TargetPath[\s\S]*?ExpectedPowerShell[\s\S]*?Arguments[\s\S]*?ExpectedArguments[\s\S]*?ExpectedScript/,
    "Uninstaller must validate the owned PowerShell target, exact arguments, and -File script");
  assert.match(uninstall,
    /foreach \(\$definition in \$shortcutDefinitions\)[\s\S]*?Test-AuraOwnedShortcutTarget[\s\S]*?Remove-Item -LiteralPath \$definition\.Path -Force/,
    "Uninstaller shortcut removal must stay literal and scoped");
  for (const copyKey of ["openStudio", "originalLook", "applyTheme", "openDesktopApp", "exitApp"]) {
    assert(ui.includes(`UiCopy.${copyKey}`), `Tray action ${copyKey} must use localized UI copy`);
  }
  // The Node helper emits UTF-8; decode it as UTF-8 so localized metadata does not
  // corrupt (and break JSON parsing) when the console falls back to an OEM code
  // page such as Big5 on a Traditional Chinese system.
  assert.match(ui, /StandardOutputEncoding\s*=\s*\[System\.Text\.UTF8Encoding\]::new\(\$false\)/);
  assert.match(ui, /StandardErrorEncoding\s*=\s*\[System\.Text\.UTF8Encoding\]::new\(\$false\)/);
  assert(!/Get-Content -LiteralPath \$ConfigPath -Raw \|/.test(ui),
    "Config reads must decode as UTF-8, not the default ANSI code page");
  // First-sign-in blank-screen fix: the opaque loading cover must be hidden on the
  // real navigation signal, never gated on the async theme-injection result. A
  // theme hiccup over a loaded claude.ai must not re-cover the page.
  assert(!/Apply-AuraUiTheme\s+-Cover\s+\$true/.test(ui),
    "Navigation must not gate the loading cover on themed-apply success");
  assert.match(ui, /\$script:PageReady\s*=\s*\$true[\s\S]{0,400}?Hide-AuraUiLoading/,
    "A loaded claude.ai document must mark the page ready and hide the cover");
  const navigationCompletionDisposition = powershellFunction("Get-AuraUiNavigationCompletionDisposition");
  assert.match(navigationCompletionDisposition,
    /\[UInt64\]\$CurrentNavigationId\s+-ne\s+\$CompletedNavigationId[\s\S]*?return\s+['"]Ignore['"]/,
    "A superseded OAuth navigation completion must be ignored by NavigationId");
  assert.match(navigationCompletionDisposition,
    /\$IsSuccess\s+-or[\s\S]*?\[UInt64\]\$ReadyNavigationId\s+-eq\s+\$CompletedNavigationId[\s\S]*?return\s+['"]Loaded['"]/,
    "DOMContentLoaded must keep a usable post-auth document visible when completion reports cancellation");
  assert.match(ui,
    /\$core\.add_NavigationStarting\(\{\s*param\(\$sender,\s*\$eventArgs\)[\s\S]{0,240}?\$script:ActiveNavigationId\s*=\s*\[UInt64\]\$eventArgs\.NavigationId/,
    "Every main navigation must record its WebView2 NavigationId");
  assert.match(ui,
    /\$core\.add_DOMContentLoaded\(\{[\s\S]{0,700}?\$script:ReadyNavigationId\s*=\s*\[UInt64\]\$eventArgs\.NavigationId[\s\S]{0,220}?Hide-AuraUiLoading/,
    "A current claude.ai DOMContentLoaded signal must reveal the usable post-auth document");
  assert.match(ui,
    /Get-AuraUiNavigationCompletionDisposition[\s\S]{0,700}?if\s*\(\$navigationDisposition\s+-eq\s+['"]Ignore['"]\)\s*\{[\s\S]{0,260}?return/,
    "A stale completion must return before it can change the loading cover");
  const newWindowDisposition = powershellFunction("Get-AuraUiNewWindowDisposition");
  assert.match(newWindowDisposition, /return\s+['"]Popup['"]/,
    "Claude and sign-in windows must retain real popup semantics");
  assert(!ui.includes("$script:WebView.CoreWebView2.Navigate($uri.AbsoluteUri)"),
    "A requested sign-in popup must never be substituted with a main-view navigation");
  assert.match(ui,
    /if\s*\(\$newWindowDisposition\s+-eq\s+['"]Popup['"]\)\s*\{[\s\S]{0,360}?return\s*\}[\s\S]{0,120}?\$eventArgs\.Handled\s*=\s*\$true/,
    "The popup branch must return while Handled is still false so window.opener remains valid");
  assert.match(ui, /elseif\s*\(\$script:PageReady\)/,
    "A theme-injection failure over a ready page must not show the opaque cover");
  assert.match(ui, /\$script:PendingApply/,
    "A skipped navigation-time apply must be retried, not dropped");
  assert.match(ui, /if\s*\(\$Action\s+-eq\s+['"]Restore['"]\)\s*\{[\s\S]{0,240}?\$script:PendingRestore\s*=\s*\$true[\s\S]{0,160}?\$script:PendingApply\s*=\s*\$false/,
    "A busy renderer must queue Restore and cancel a stale pending Apply");
  assert.match(ui, /if\s*\(\$script:PendingRestore\)\s*\{[\s\S]{0,500}?Start-AuraUiScript\s+-Source\s+\$cleanup\s+-Action\s+Restore/,
    "Queued Restore must run as soon as the active renderer task completes");
  assert(!ui.includes("'Customize themes'"), "Picker chrome must come from localized UI copy");
  assert(!ui.includes("'Applying your look...'"), "Loading status must come from localized UI copy");
  assert.match(ui, /themeFallbackDescription/);
  assert.deepEqual(Object.keys(uiCopy).sort(), ["en", "zh-CN", "zh-TW"]);
  const copyKeys = Object.keys(uiCopy.en).sort();
  for (const locale of ["zh-CN", "zh-TW"]) {
    assert.deepEqual(Object.keys(uiCopy[locale]).sort(), copyKeys, `${locale} UI copy is incomplete`);
    for (const key of copyKeys) assert(String(uiCopy[locale][key]).trim(), `${locale}.${key} is empty`);
  }
  assert.equal(uiCopy["zh-CN"].customizeThemes, "\u81ea\u5b9a\u4e49\u4e3b\u9898");
  assert.equal(uiCopy["zh-TW"].customizeThemes, "\u81ea\u8a02\u4e3b\u984c");
  assert.notEqual(uiCopy["zh-CN"].themeApplyDescription, uiCopy["zh-TW"].themeApplyDescription);
  const expectedStudioCopy = {
    en: {
      studioTitle: "Claude Aura Studio",
      openStudio: "Open Studio",
      openDesktopApp: "Open desktop app",
      exitApp: "Exit Claude Aura",
      studioImportPending: "Theme installation isn't available yet.",
      chooseThemeFolder: "Choose a Claude Aura theme kit folder.",
      installingTheme: "Validating and installing theme...",
      themeInstalled: "{0} was installed and applied.",
      themeInstallFailed: "Theme could not be installed: {0}",
      themeAlreadyInstalled: "A theme named {0} is already installed.",
    },
    "zh-CN": {
      studioTitle: "Claude Aura 工作室",
      openStudio: "打开工作室",
      openDesktopApp: "打开桌面版",
      exitApp: "退出 Claude Aura",
      studioImportPending: "主题安装功能暂不可用。",
      chooseThemeFolder: "请选择 Claude Aura 主题包文件夹。",
      installingTheme: "正在校验并安装主题…",
      themeInstalled: "{0}已安装并应用。",
      themeInstallFailed: "主题安装失败：{0}",
      themeAlreadyInstalled: "名为{0}的主题已安装。",
    },
    "zh-TW": {
      studioTitle: "Claude Aura 工作室",
      openStudio: "開啟工作室",
      openDesktopApp: "開啟桌面版",
      exitApp: "結束 Claude Aura",
      studioImportPending: "目前還不能安裝主題。",
      chooseThemeFolder: "選擇 Claude Aura 主題套件資料夾。",
      installingTheme: "正在檢查並安裝主題…",
      themeInstalled: "已安裝並套用{0}。",
      themeInstallFailed: "無法安裝主題：{0}",
      themeAlreadyInstalled: "已安裝名為{0}的主題。",
    },
  };
  for (const [locale, expected] of Object.entries(expectedStudioCopy)) {
    for (const [key, value] of Object.entries(expected)) {
      assert.equal(uiCopy[locale][key], value, `${locale}.${key} must use approved native UI copy`);
    }
  }
  assert.match(ui, /Set-AuraUiFormWithinWorkingArea/);
  assert.match(ui, /Screen\]::FromControl\(\$Form\)\.WorkingArea/);
  assert.match(install, /WindowStyle Hidden/);
  assert.match(install, /Claude Aura\.lnk/);
  assert.match(install, /\$releaseDirectories\s*=\s*\[ordered\]@\{[\s\S]{0,500}?studio\s*=\s*@\('\.css', '\.html', '\.js'\)/,
    "The Windows exact-tree installer must include Aura Studio");

  if (process.platform === "win32") {
    const signInNavigationRegression = [
      "$ErrorActionPreference='Stop'",
      `$uiPath='${path.join(PROJECT_ROOT, "windows", "aura-ui.ps1").replaceAll("'", "''")}'`,
      "$tokens=$null;$errors=$null",
      "$ast=[System.Management.Automation.Language.Parser]::ParseFile($uiPath,[ref]$tokens,[ref]$errors)",
      "if($errors.Count){throw 'Could not parse Aura UI for sign-in navigation regression'}",
      "foreach($name in @('Test-AuraUiClaudeUri','Test-AuraUiSignInUri','Get-AuraUiNewWindowDisposition','Get-AuraUiNavigationCompletionDisposition')){",
      "  $definition=$ast.Find({param($node)$node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -ceq $name},$true)",
      "  if($null -eq $definition){throw \"Missing sign-in navigation function $name\"}",
      "  Invoke-Expression $definition.Extent.Text",
      "}",
      "if((Get-AuraUiNewWindowDisposition -Value 'https://claude.ai/login') -cne 'Popup'){throw 'Claude popup lost its opener semantics'}",
      "if((Get-AuraUiNewWindowDisposition -Value 'https://accounts.google.com/o/oauth2/v2/auth') -cne 'Popup'){throw 'OAuth popup lost its opener semantics'}",
      "if((Get-AuraUiNewWindowDisposition -Value 'https://example.com/help') -cne 'External'){throw 'External HTTPS window was not separated'}",
      "if((Get-AuraUiNewWindowDisposition -Value 'file:///C:/Windows/win.ini') -cne 'Block'){throw 'Unsafe popup scheme was not blocked'}",
      "$stale=Get-AuraUiNavigationCompletionDisposition -CurrentNavigationId ([UInt64]22) -ReadyNavigationId $null -CompletedNavigationId ([UInt64]11) -IsSuccess $false",
      "if($stale -cne 'Ignore'){throw 'A superseded OAuth completion could still re-cover the current page'}",
      "$readyAbort=Get-AuraUiNavigationCompletionDisposition -CurrentNavigationId ([UInt64]22) -ReadyNavigationId ([UInt64]22) -CompletedNavigationId ([UInt64]22) -IsSuccess $false",
      "if($readyAbort -cne 'Loaded'){throw 'A DOM-ready post-auth cancellation could still re-cover the page'}",
      "$currentFailure=Get-AuraUiNavigationCompletionDisposition -CurrentNavigationId ([UInt64]22) -ReadyNavigationId $null -CompletedNavigationId ([UInt64]22) -IsSuccess $false",
      "if($currentFailure -cne 'Failure'){throw 'A genuine current-document failure lost its Retry path'}",
      "$currentSuccess=Get-AuraUiNavigationCompletionDisposition -CurrentNavigationId ([UInt64]22) -ReadyNavigationId $null -CompletedNavigationId ([UInt64]22) -IsSuccess $true",
      "if($currentSuccess -cne 'Loaded'){throw 'A successful current navigation was not accepted'}",
    ].join("\n");
    run("powershell.exe", ["-NoProfile", "-EncodedCommand",
      Buffer.from(signInNavigationRegression, "utf16le").toString("base64")]);

    const launcherCollapseRegression = [
      "$ErrorActionPreference='Stop'",
      `$uiPath='${path.join(PROJECT_ROOT, "windows", "aura-ui.ps1").replaceAll("'", "''")}'`,
      "$tokens=$null;$errors=$null",
      "$ast=[System.Management.Automation.Language.Parser]::ParseFile($uiPath,[ref]$tokens,[ref]$errors)",
      "if($errors.Count){throw 'Could not parse Aura UI for launcher collapse regression'}",
      "$expansion=$ast.Find({param($node)$node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -ceq 'Set-AuraUiLauncherExpanded'},$true)",
      "if($null -ne $expansion){throw 'The launcher hover bar must stay removed'}",
      "$definition=$ast.Find({param($node)$node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -ceq 'Update-AuraUiLauncherDpi'},$true)",
      "if($null -eq $definition){throw 'Missing Update-AuraUiLauncherDpi'}",
      "Invoke-Expression $definition.Extent.Text",
      "Add-Type -AssemblyName System.Drawing",
      "function ConvertTo-AuraUiLauncherPixels { param([double]$Logical,[int]$Dpi=$script:LauncherDpi);$script:ConvertedLogicalWidths+=$Logical;return [int]$Logical }",
      "function Update-AuraUiLauncherSurface {}",
      "function Update-AuraUiLauncherPosition {}",
      "$script:Launcher=[pscustomobject]@{IsDisposed=$false;ClientSize=$null}",
      "$script:Form=$null;$script:LauncherButton=$null",
      "$script:LauncherCompactSize=48;$script:LauncherHaloSize=10;$script:LauncherDpi=96",
      "$script:ConvertedLogicalWidths=@()",
      "Update-AuraUiLauncherDpi -Dpi 144",
      "if(($script:ConvertedLogicalWidths -join ',') -cne '48'){throw 'Launcher DPI update must size only the collapsed circular button'}",
    ].join("\n");
    run("powershell.exe", ["-NoProfile", "-EncodedCommand",
      Buffer.from(launcherCollapseRegression, "utf16le").toString("base64")]);

    const originalAppearanceRegression = [
      "$ErrorActionPreference='Stop'",
      `$uiPath='${path.join(PROJECT_ROOT, "windows", "aura-ui.ps1").replaceAll("'", "''")}'`,
      "$tokens=$null;$errors=$null",
      "$ast=[System.Management.Automation.Language.Parser]::ParseFile($uiPath,[ref]$tokens,[ref]$errors)",
      "if($errors.Count){throw 'Could not parse Aura UI for Original-look appearance regression'}",
      "$definition=$ast.Find({param($node)$node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -ceq 'Invoke-AuraUiSetAppearance'},$true)",
      "if($null -eq $definition){throw 'Missing Invoke-AuraUiSetAppearance'}",
      "Invoke-Expression $definition.Extent.Text",
      "function Get-AuraUiEnabled { return $script:Enabled }",
      "function Set-AuraUiConfig { param([string[]]$Options);$script:Options=@($Options) }",
      "function Set-AuraUiPreferredColorScheme { param([string]$Appearance,[bool]$Enabled);$script:Scheme=\"$Appearance/$Enabled\" }",
      "function Apply-AuraUiTheme { $script:ApplyCount++ }",
      "function Send-AuraUiStudioState { $script:SendCount++ }",
      "$script:Enabled=$false;$script:ApplyCount=0;$script:SendCount=0",
      "Invoke-AuraUiSetAppearance -Appearance dark",
      "if(($script:Options -join '/') -cne '--appearance/system'){throw 'Original look persisted a forced appearance'}",
      "if($script:Scheme -cne 'system/False' -or $script:ApplyCount -ne 0 -or $script:SendCount -ne 1){throw 'Original look applied a forced appearance'}",
      "$script:Enabled=$true;$script:ApplyCount=0;$script:SendCount=0",
      "Invoke-AuraUiSetAppearance -Appearance dark",
      "if(($script:Options -join '/') -cne '--appearance/dark'){throw 'Enabled appearance was not preserved'}",
      "if($script:Scheme -cne 'dark/True' -or $script:ApplyCount -ne 1 -or $script:SendCount -ne 1){throw 'Enabled appearance was not applied'}",
    ].join("\n");
    run("powershell.exe", ["-NoProfile", "-EncodedCommand",
      Buffer.from(originalAppearanceRegression, "utf16le").toString("base64")]);

    const importCopyTestRoot = path.join(PROJECT_ROOT, "dist", `test-theme-import-${process.pid}-${Date.now()}`);
    const psPath = (value) => value.replaceAll("'", "''");
    const importCopyRegression = [
      "$ErrorActionPreference='Stop'",
      `$uiPath='${psPath(path.join(PROJECT_ROOT, "windows", "aura-ui.ps1"))}'`,
      `$testRoot='${psPath(importCopyTestRoot)}'`,
      "$tokens=$null;$errors=$null",
      "$ast=[System.Management.Automation.Language.Parser]::ParseFile($uiPath,[ref]$tokens,[ref]$errors)",
      "if($errors.Count){throw 'Could not parse Aura UI for theme import regression'}",
      "foreach($name in @('Assert-AuraUiThemeKitTree','Assert-AuraUiThemeInstallRoot','Copy-AuraUiThemeKit','Remove-AuraUiInstalledTheme','Restore-AuraUiConfigSnapshot')){",
      "  $definition=$ast.Find({param($node)$node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -ceq $name},$true)",
      "  if($null -eq $definition){throw \"Missing theme import function $name\"}",
      "  Invoke-Expression $definition.Extent.Text",
      "}",
      "function Invoke-AuraUiNode { param([string[]]$CommandArguments); return 'restored-payload' }",
      "function Set-AuraUiPayloadState { param([string]$Payload); $script:RestoredPayload=$Payload }",
      "function Update-AuraUiTrayAppearance { $script:TrayRestored=$true }",
      "function Apply-AuraUiTheme { $script:ThemeRestored=$true }",
      "$script:UiCopy=[pscustomobject]@{themeAlreadyInstalled='A theme named {0} is already installed.'}",
      "$script:Locale='en'",
      "$sourceRoot=Join-Path $testRoot 'source-kit'",
      "$outsideRoot=Join-Path $testRoot 'outside'",
      "$originalLocalAppData=$env:LOCALAPPDATA",
      "$env:LOCALAPPDATA=Join-Path $testRoot 'local-app-data'",
      "$DataRoot=Join-Path $env:LOCALAPPDATA 'ClaudeAura\\data'",
      "$UserThemesRoot=Join-Path $DataRoot 'themes'",
      "$ConfigPath=Join-Path $DataRoot 'config.json'",
      "$ThemeCli='theme-cli.mjs'",
      "$userRootJunction=$false",
      "try {",
      "  [IO.Directory]::CreateDirectory((Join-Path $sourceRoot 'notes'))|Out-Null",
      "  [IO.Directory]::CreateDirectory($outsideRoot)|Out-Null",
      "  [IO.File]::WriteAllText((Join-Path $sourceRoot 'theme.json'),'{}')",
      "  [IO.File]::WriteAllText((Join-Path $sourceRoot 'notes\\CHECKLIST.md'),'copy proof')",
      "  $destination=Copy-AuraUiThemeKit -Source $sourceRoot -Id 'demo-theme'",
      "  if($destination -cne (Join-Path $UserThemesRoot 'demo-theme')){throw 'Theme copy returned the wrong destination'}",
      "  if([IO.File]::ReadAllText((Join-Path $destination 'notes\\CHECKLIST.md')) -cne 'copy proof'){throw 'Theme copy lost nested kit files'}",
      "  $duplicateRejected=$false",
      "  try { Copy-AuraUiThemeKit -Source $sourceRoot -Id 'demo-theme'|Out-Null } catch { $duplicateRejected=$_.Exception.Message -like '*demo-theme*' }",
      "  if(-not $duplicateRejected){throw 'Theme copy accepted an existing destination'}",
      "  Remove-AuraUiInstalledTheme -Path $destination -Id 'demo-theme'",
      "  if(Test-Path -LiteralPath $destination){throw 'Theme uninstall left its destination folder behind'}",
      "  $outsideMarker=Join-Path $outsideRoot 'keep.txt'",
      "  [IO.File]::WriteAllText($outsideMarker,'keep')",
      "  $outsideRejected=$false",
      "  try { Remove-AuraUiInstalledTheme -Path $outsideRoot -Id 'outside' } catch { $outsideRejected=$true }",
      "  if(-not $outsideRejected -or -not (Test-Path -LiteralPath $outsideMarker -PathType Leaf)){throw 'Theme rollback escaped the exact user-theme destination'}",
      "  $nestedFake=Join-Path $UserThemesRoot 'other\\demo-theme'",
      "  [IO.Directory]::CreateDirectory($nestedFake)|Out-Null",
      "  $nestedMarker=Join-Path $nestedFake 'keep.txt'",
      "  [IO.File]::WriteAllText($nestedMarker,'keep')",
      "  $nestedRemovalRejected=$false",
      "  try { Remove-AuraUiInstalledTheme -Path $nestedFake -Id 'demo-theme' } catch { $nestedRemovalRejected=$true }",
      "  if(-not $nestedRemovalRejected -or -not (Test-Path -LiteralPath $nestedMarker -PathType Leaf)){throw 'Theme rollback accepted a nested lookalike destination'}",
      "  [IO.Directory]::Delete((Join-Path $UserThemesRoot 'other'),$true)",
      "  [IO.Directory]::Delete($UserThemesRoot)",
      "  $redirectTarget=Join-Path $outsideRoot 'redirect-target'",
      "  [IO.Directory]::CreateDirectory($redirectTarget)|Out-Null",
      "  New-Item -ItemType Junction -Path $UserThemesRoot -Target $redirectTarget|Out-Null",
      "  $userRootJunction=$true",
      "  $junctionRejected=$false",
      "  try { Copy-AuraUiThemeKit -Source $sourceRoot -Id 'redirected-theme'|Out-Null } catch { $junctionRejected=$_.Exception.Message -like '*symbolic links or junctions*' }",
      "  if(-not $junctionRejected -or (Test-Path -LiteralPath (Join-Path $redirectTarget 'redirected-theme'))){throw 'Theme copy followed a redirected install root'}",
      "  [IO.Directory]::Delete($UserThemesRoot)",
      "  $userRootJunction=$false",
      "  [IO.Directory]::CreateDirectory($UserThemesRoot)|Out-Null",
      "  [IO.File]::WriteAllText((Join-Path $DataRoot 'theme.json'),'{}')",
      "  $nestedRejected=$false",
      "  try { Copy-AuraUiThemeKit -Source $DataRoot -Id 'nested-theme'|Out-Null } catch { $nestedRejected=$_.Exception.Message -like '*outside the installed user themes folder*' }",
      "  if(-not $nestedRejected -or (Test-Path -LiteralPath (Join-Path $UserThemesRoot 'nested-theme'))){throw 'Theme copy allowed its staging root inside the selected source'}",
      "  $insideSource=Join-Path $UserThemesRoot 'inside-source'",
      "  [IO.Directory]::CreateDirectory($insideSource)|Out-Null",
      "  [IO.File]::WriteAllText((Join-Path $insideSource 'theme.json'),'{}')",
      "  $insideRejected=$false",
      "  try { Copy-AuraUiThemeKit -Source $insideSource -Id 'inside-theme'|Out-Null } catch { $insideRejected=$_.Exception.Message -like '*outside the installed user themes folder*' }",
      "  if(-not $insideRejected){throw 'Theme copy accepted a source inside the install root'}",
      "  $snapshot='{\"theme\":\"default\",\"enabled\":false,\"customTheme\":\"legacy.json\"}'",
      "  [IO.File]::WriteAllText($ConfigPath,'{\"theme\":\"constructor\",\"enabled\":true}')",
      "  Restore-AuraUiConfigSnapshot -Json $snapshot",
      "  $restored=[IO.File]::ReadAllText($ConfigPath)|ConvertFrom-Json",
      "  if($restored.theme -cne 'default' -or $restored.enabled -ne $false -or $restored.customTheme -cne 'legacy.json'){throw 'Theme import rollback did not restore the complete config'}",
      "  if($script:RestoredPayload -cne 'restored-payload' -or -not $script:TrayRestored -or -not $script:ThemeRestored){throw 'Theme import rollback did not rebuild runtime state'}",
      "} finally {",
      "  if($userRootJunction -and (Test-Path -LiteralPath $UserThemesRoot)){[IO.Directory]::Delete($UserThemesRoot)}",
      "  $env:LOCALAPPDATA=$originalLocalAppData",
      "  if(Test-Path -LiteralPath $testRoot){[IO.Directory]::Delete($testRoot,$true)}",
      "}",
    ].join("\n");
    try {
      run("powershell.exe", ["-NoProfile", "-EncodedCommand", Buffer.from(importCopyRegression, "utf16le").toString("base64")]);
    } finally {
      await fs.rm(importCopyTestRoot, { recursive: true, force: true });
    }

    const deleteRollbackTestRoot = path.join(PROJECT_ROOT, "dist", `test-theme-delete-rollback-${process.pid}-${Date.now()}`);
    const deleteRollbackRegression = [
      "$ErrorActionPreference='Stop'",
      `$uiPath='${psPath(path.join(PROJECT_ROOT, "windows", "aura-ui.ps1"))}'`,
      `$testRoot='${psPath(deleteRollbackTestRoot)}'`,
      "$tokens=$null;$errors=$null",
      "$ast=[System.Management.Automation.Language.Parser]::ParseFile($uiPath,[ref]$tokens,[ref]$errors)",
      "if($errors.Count){throw 'Could not parse Aura UI for theme-delete rollback regression'}",
      "$names=@('Get-AuraUiPropertyValue','Get-AuraUiEnabled','Test-AuraUiByteSequenceEqual','New-AuraUiDeleteRecoverySnapshot','Restore-AuraUiDeleteConfigBytes','Restore-AuraUiDeleteInMemoryState','Remove-AuraUiDeleteRecoverySnapshot','Invoke-AuraUiDeleteUserTheme')",
      "foreach($name in $names){",
      "  $definition=$ast.Find({param($node)$node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -ceq $name},$true)",
      "  if($null -eq $definition){throw \"Missing theme-delete rollback function $name\"}",
      "  Invoke-Expression $definition.Extent.Text",
      "}",
      "function Get-AuraUiStudioKnownTheme { param([string]$Theme,[switch]$UserOnly);[pscustomobject]@{name=$Theme;source='user'} }",
      "function Set-AuraUiConfig {",
      "  param([string[]]$Options)",
      "  $script:SeenOptions=$Options",
      "  $theme=$Options[[array]::IndexOf($Options,'--theme')+1]",
      "  $enabled=$Options[[array]::IndexOf($Options,'--enabled')+1] -ceq 'true'",
      "  [IO.File]::WriteAllText($ConfigPath,'{\"theme\":\"default\",\"enabled\":false}',[Text.UTF8Encoding]::new($false))",
      "  $script:Config=[pscustomobject]@{theme=$theme;enabled=$enabled}",
      "  $script:ActiveThemeName=$theme;$script:ActiveLabel='Default';$script:Payload='switched-payload'",
      "}",
      "function Apply-AuraUiTheme { $script:ApplyCount++ }",
      "function Invoke-AuraUiStudioEditorCore { param($Request);throw [InvalidOperationException]::new('injected core delete failure') }",
      "function Complete-AuraUiStudioEditorAction { throw 'Theme-delete failure unexpectedly completed' }",
      "function Set-AuraUiPreferredColorScheme { $script:SchemeCount++ }",
      "function Update-AuraUiTrayAppearance { $script:TrayCount++ }",
      "function Write-AuraUiLog { param([string]$Message);$script:Logs+=@($Message) }",
      "$originalConfigBytes=[Convert]::FromBase64String('77u/ew0KICAidGhlbWUiOiAidXNlci10aGVtZSIsICJlbmFibGVkIjogZmFsc2UNCn0NCg==')",
      "$originalConfigState=[pscustomobject]@{theme='user-theme';enabled=$false}",
      "function Reset-DeleteState {",
      "  [IO.File]::WriteAllBytes($ConfigPath,$originalConfigBytes)",
      "  $script:Config=$originalConfigState;$script:Payload='original-payload-原始'",
      "  $script:ActiveThemeName='user-theme';$script:ActiveLabel='Original'",
      "  $script:StudioEditorState=[ordered]@{active=$false}",
      "  $script:ApplyCount=0;$script:SchemeCount=0;$script:TrayCount=0;$script:Logs=@()",
      "}",
      "[IO.Directory]::CreateDirectory($testRoot)|Out-Null",
      "$ConfigPath=Join-Path $testRoot 'config.json';$DataRoot=$testRoot",
      "try {",
      "  Reset-DeleteState",
      "  $ordinaryFailure=$null",
      "  try { Invoke-AuraUiDeleteUserTheme -Request ([pscustomobject]@{type='delete-user-theme';theme='user-theme'})|Out-Null } catch { $ordinaryFailure=$_.Exception }",
      "  if($null -eq $ordinaryFailure -or $ordinaryFailure -is [AggregateException] -or $ordinaryFailure.Message -notlike '*injected core delete failure*'){throw 'An ordinary successful rollback did not preserve the primary delete error'}",
      "  if(-not(Test-AuraUiByteSequenceEqual -First ([IO.File]::ReadAllBytes($ConfigPath)) -Second $originalConfigBytes)){throw 'Theme-delete rollback changed the exact config bytes'}",
      "  if(-not[object]::ReferenceEquals($script:Config,$originalConfigState) -or $script:Payload -cne 'original-payload-原始' -or $script:ActiveThemeName -cne 'user-theme' -or $script:ActiveLabel -cne 'Original'){throw 'Theme-delete rollback did not restore exact in-memory state'}",
      "  if($script:SeenOptions[-1] -cne 'false'){throw 'Theme deletion changed disabled=false while switching to Default'}",
      "  if($script:ApplyCount -ne 1 -or $script:SchemeCount -ne 1 -or $script:TrayCount -ne 1){throw 'Theme-delete rollback did not rebuild each runtime surface'}",
      "  if(@(Get-ChildItem -LiteralPath $testRoot -Directory -Filter '.delete-recovery-*').Count -ne 0){throw 'Successful theme-delete rollback left recovery artifacts'}",
      "  Reset-DeleteState",
      "  function Restore-AuraUiDeleteConfigBytes { param([byte[]]$Bytes,[string]$RecoveryPath);throw [IO.IOException]::new('injected config rollback failure') }",
      "  $aggregate=$null",
      "  try { Invoke-AuraUiDeleteUserTheme -Request ([pscustomobject]@{type='delete-user-theme';theme='user-theme'})|Out-Null } catch { $aggregate=$_.Exception }",
      "  if($aggregate -isnot [AggregateException]){throw 'Incomplete theme-delete rollback did not throw AggregateException'}",
      "  $innerMessages=@($aggregate.Flatten().InnerExceptions|ForEach-Object{$_.Message}) -join ' | '",
      "  if($innerMessages -notlike '*injected core delete failure*' -or $innerMessages -notlike '*injected config rollback failure*'){throw 'AggregateException did not retain primary and rollback failures'}",
      "  $recovery=@(Get-ChildItem -LiteralPath $testRoot -Directory -Filter '.delete-recovery-*')",
      "  if($recovery.Count -ne 1 -or $aggregate.Message -notlike \"*$($recovery[0].FullName)*\"){throw 'Incomplete rollback did not report and retain its recovery directory'}",
      "  if(-not(Test-AuraUiByteSequenceEqual -First ([IO.File]::ReadAllBytes((Join-Path $recovery[0].FullName 'config.snapshot.json'))) -Second $originalConfigBytes)){throw 'Recovery config snapshot was not byte-exact'}",
      "  if([IO.File]::ReadAllText((Join-Path $recovery[0].FullName 'payload.snapshot.js'),[Text.Encoding]::UTF8) -cne 'original-payload-原始'){throw 'Recovery payload snapshot was not exact'}",
      "  if($script:Payload -cne 'original-payload-原始' -or $script:ActiveThemeName -cne 'user-theme'){throw 'Config rollback failure prevented in-memory recovery'}",
      "} finally {",
      "  if(Test-Path -LiteralPath $testRoot){[IO.Directory]::Delete($testRoot,$true)}",
      "}",
    ].join("\n");
    try {
      run("powershell.exe", ["-NoProfile", "-EncodedCommand", Buffer.from(deleteRollbackRegression, "utf16le").toString("base64")]);
    } finally {
      await fs.rm(deleteRollbackTestRoot, { recursive: true, force: true });
    }

    const cacheTestRoot = path.join(PROJECT_ROOT, "dist", `test-studio-cache-${process.pid}-${Date.now()}`);
    const cacheRegression = [
      "$ErrorActionPreference='Stop'",
      `$uiPath='${psPath(path.join(PROJECT_ROOT, "windows", "aura-ui.ps1"))}'`,
      `$testRoot='${psPath(cacheTestRoot)}'`,
      "$tokens=$null;$errors=$null",
      "$ast=[System.Management.Automation.Language.Parser]::ParseFile($uiPath,[ref]$tokens,[ref]$errors)",
      "if($errors.Count){throw 'Could not parse Aura UI for cache regression'}",
      "foreach($name in @('ConvertTo-AuraUiStudioNumber','Get-AuraUiStudioBackgroundCrop','Get-AuraUiStudioBackgroundSourcePath','Clear-AuraUiStudioBackgroundPreview','Sync-AuraUiStudioBackgroundPreview')){",
      "  $definition=$ast.Find({param($node)$node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -ceq $name},$true)",
      "  if($null -eq $definition){throw \"Missing cache function $name\"}",
      "  Invoke-Expression $definition.Extent.Text",
      "}",
      "function Get-AuraUiPropertyValue { param($InputObject,[string[]]$Names); foreach($name in $Names){$property=$InputObject.PSObject.Properties[$name];if($null -ne $property){return $property.Value}};return $null }",
      "function Write-AuraUiLog { param([string]$Message) }",
      "$aliasRoot=$null",
      "try {",
      "  [IO.Directory]::CreateDirectory($testRoot)|Out-Null",
      "  $StudioBackgroundRoot=Join-Path $testRoot 'cache'",
      "  $StudioBackgroundMaxBytes=16*1024*1024",
      "  [IO.Directory]::CreateDirectory($StudioBackgroundRoot)|Out-Null",
      "  $ConfigPath=Join-Path $testRoot 'config.json'",
      "  $sourcePath=Join-Path $testRoot 'source.png'",
      "  [IO.File]::WriteAllText($sourcePath,'AAAA')",
      "  $fixedStamp=[DateTime]::UtcNow.AddMinutes(-10)",
      "  [IO.File]::SetLastWriteTimeUtc($sourcePath,$fixedStamp)",
      "  $script:Config=[pscustomobject]@{image=$sourcePath}",
      "  $script:StudioBackgroundFingerprint=$null;$script:StudioBackgroundPreviewUrl=$null;$script:StudioBackgroundPreviewPath=$null",
      "  $firstUrl=Sync-AuraUiStudioBackgroundPreview",
      "  if(-not $firstUrl -or [IO.File]::ReadAllText($script:StudioBackgroundPreviewPath) -cne 'AAAA'){throw 'Initial preview copy failed'}",
      "  [IO.File]::WriteAllText($sourcePath,'BBBB')",
      "  [IO.File]::SetLastWriteTimeUtc($sourcePath,$fixedStamp)",
      "  $secondUrl=Sync-AuraUiStudioBackgroundPreview",
      "  if($secondUrl -ceq $firstUrl){throw 'Equal-size equal-timestamp replacement reused its cache URL'}",
      "  if([IO.File]::ReadAllText($script:StudioBackgroundPreviewPath) -cne 'BBBB'){throw 'Replacement preview kept stale bytes'}",
      "  $ownedPreview=$script:StudioBackgroundPreviewPath",
      "  $aliasRoot=Join-Path $testRoot 'cache-alias'",
      "  New-Item -ItemType Junction -Path $aliasRoot -Target $StudioBackgroundRoot|Out-Null",
      "  $aliasSource=Join-Path $aliasRoot ([IO.Path]::GetFileName($ownedPreview))",
      "  $script:Config=[pscustomobject]@{image=$aliasSource}",
      "  $aliasUrl=Sync-AuraUiStudioBackgroundPreview",
      "  if(-not $aliasUrl){throw 'Junction-aliased source could not be copied'}",
      "  if(-not (Test-Path -LiteralPath $aliasSource -PathType Leaf)){throw 'Cache cleanup deleted a junction-aliased source'}",
      "  if(-not (Test-Path -LiteralPath $script:StudioBackgroundPreviewPath -PathType Leaf)){throw 'Junction-safe preview copy is missing'}",
      "  if([IO.File]::ReadAllText($script:StudioBackgroundPreviewPath) -cne 'BBBB'){throw 'Junction-safe preview copied the wrong bytes'}",
      "  $oversizePath=Join-Path $testRoot 'oversize.png'",
      "  $oversizeStream=[IO.File]::Open($oversizePath,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None)",
      "  try{$oversizeStream.SetLength($StudioBackgroundMaxBytes+1)}finally{$oversizeStream.Dispose()}",
      "  $script:Config=[pscustomobject]@{image=$oversizePath}",
      "  if(Sync-AuraUiStudioBackgroundPreview){throw 'Oversized replacement received a Studio preview URL'}",
      "  if($script:StudioBackgroundPreviewPath){throw 'Oversized replacement remained in the Studio preview cache'}",
      "  $positionCases=[ordered]@{'top'='50,0';'left'='0,50';'top left'='0,0';'bottom right'='100,100';'center right'='100,50';'25%'='25,50'}",
      "  foreach($position in $positionCases.Keys){",
      "    $script:Config=[pscustomobject]@{imagePosition=$position;imageZoom=1}",
      "    $crop=Get-AuraUiStudioBackgroundCrop",
      "    $actual=\"$($crop.x),$($crop.y)\"",
      "    if(-not $crop.supported -or $actual -cne $positionCases[$position]){throw \"Position '$position' became $actual supported=$($crop.supported)\"}",
      "  }",
      "  $script:Config=[pscustomobject]@{imagePosition='right 20px bottom 10px';imageZoom=1}",
      "  if((Get-AuraUiStudioBackgroundCrop).supported){throw 'Advanced CSS position was presented as a centered numeric crop'}",
      "} finally {",
      "  if($aliasRoot -and (Test-Path -LiteralPath $aliasRoot)){[IO.Directory]::Delete($aliasRoot)}",
      "}",
    ].join("\n");
    try {
      run("powershell.exe", ["-NoProfile", "-EncodedCommand", Buffer.from(cacheRegression, "utf16le").toString("base64")]);
    } finally {
      await fs.rm(cacheTestRoot, { recursive: true, force: true });
    }

    const editorRootsTestRoot = path.join(PROJECT_ROOT, "dist", `test-studio-editor-roots-${process.pid}-${Date.now()}`);
    const validStudioStyleJson = JSON.stringify(validEditorState.studioStyle).replaceAll("'", "''");
    const validLauncherStyleJson = JSON.stringify(validEditorState.launcherStyle).replaceAll("'", "''");
    const studioStyleBridgeRegression = [
      "$ErrorActionPreference='Stop'",
      `$uiPath='${psPath(path.join(PROJECT_ROOT, "windows", "aura-ui.ps1"))}'`,
      "$tokens=$null;$errors=$null",
      "$ast=[System.Management.Automation.Language.Parser]::ParseFile($uiPath,[ref]$tokens,[ref]$errors)",
      "if($errors.Count){throw 'Could not parse Aura UI for Studio style regression'}",
      "foreach($name in @('ConvertTo-AuraUiStudioNumber','Test-AuraUiStudioExactProperties','Assert-AuraUiStudioStyle','Assert-AuraUiStudioLauncherStyle')){",
      "  $definition=$ast.Find({param($node)$node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -ceq $name},$true)",
      "  if($null -eq $definition){throw \"Missing Studio style bridge function $name\"}",
      "  Invoke-Expression $definition.Extent.Text",
      "}",
      "function Assert-Rejected { param([scriptblock]$Operation,[string]$Label);$rejected=$false;try{&$Operation|Out-Null}catch{$rejected=$true};if(-not $rejected){throw \"Studio accepted $Label\"} }",
      `$validStudioStyle=ConvertFrom-Json -InputObject '${validStudioStyleJson}'`,
      "Assert-AuraUiStudioStyle -Style $validStudioStyle",
      `$validLauncherStyle=ConvertFrom-Json -InputObject '${validLauncherStyleJson}'`,
      "Assert-AuraUiStudioLauncherStyle -Style $validLauncherStyle",
      "$extraLauncherStyle=ConvertFrom-Json -InputObject ($validLauncherStyle|ConvertTo-Json -Compress -Depth 8)",
      "$extraLauncherStyle|Add-Member -NotePropertyName rawCss -NotePropertyValue 'body{}'",
      "Assert-Rejected { Assert-AuraUiStudioLauncherStyle -Style $extraLauncherStyle } 'an extra launcher property'",
      "$unknownLauncherRoot=ConvertFrom-Json -InputObject ($validLauncherStyle|ConvertTo-Json -Compress -Depth 8)",
      "$unknownLauncherRoot.asset='assets/theme-art/not-a-frozen-theme/launcher-mark.png'",
      "Assert-Rejected { Assert-AuraUiStudioLauncherStyle -Style $unknownLauncherRoot } 'an unknown built-in launcher root'",
      "$unsafeLauncherColor=ConvertFrom-Json -InputObject ($validLauncherStyle|ConvertTo-Json -Compress -Depth 8)",
      "$unsafeLauncherColor.surface='url(https://example.com/mark.png)'",
      "Assert-Rejected { Assert-AuraUiStudioLauncherStyle -Style $unsafeLauncherColor } 'an unsafe launcher color'",
      "$extraStudioStyle=ConvertFrom-Json -InputObject ($validStudioStyle|ConvertTo-Json -Compress -Depth 8)",
      "$extraStudioStyle.light|Add-Member -NotePropertyName rawCss -NotePropertyValue 'body{}'",
      "Assert-Rejected { Assert-AuraUiStudioStyle -Style $extraStudioStyle } 'an extra Studio style property'",
      "$missingStudioStyle=ConvertFrom-Json -InputObject ($validStudioStyle|ConvertTo-Json -Compress -Depth 8)",
      "$missingStudioStyle.dark.PSObject.Properties.Remove('focus')",
      "Assert-Rejected { Assert-AuraUiStudioStyle -Style $missingStudioStyle } 'a missing Studio style property'",
      "$unsafeStudioStyle=ConvertFrom-Json -InputObject ($validStudioStyle|ConvertTo-Json -Compress -Depth 8)",
      "$unsafeStudioStyle.light.canvas='url(https://example.com/theme.css)'",
      "Assert-Rejected { Assert-AuraUiStudioStyle -Style $unsafeStudioStyle } 'an unsafe Studio style color'",
      "$stringAlphaStudioStyle=ConvertFrom-Json -InputObject ($validStudioStyle|ConvertTo-Json -Compress -Depth 8)",
      "$stringAlphaStudioStyle.dark.surfaceAlpha='0.8'",
      "Assert-Rejected { Assert-AuraUiStudioStyle -Style $stringAlphaStudioStyle } 'a string Studio material value'",
      "$fontStudioStyle=ConvertFrom-Json -InputObject ($validStudioStyle|ConvertTo-Json -Compress -Depth 8)",
      "$fontStudioStyle.shared.fontUi='remote-font'",
      "Assert-Rejected { Assert-AuraUiStudioStyle -Style $fontStudioStyle } 'an unknown Studio font id'",
      "$measurementStudioStyle=ConvertFrom-Json -InputObject ($validStudioStyle|ConvertTo-Json -Compress -Depth 8)",
      "$measurementStudioStyle.shared.radius=33",
      "Assert-Rejected { Assert-AuraUiStudioStyle -Style $measurementStudioStyle } 'an out-of-range Studio measurement'",
    ].join("\n");
    run("powershell.exe", ["-NoProfile", "-EncodedCommand",
      Buffer.from(studioStyleBridgeRegression, "utf16le").toString("base64")]);

    const editorBridgeRegression = [
      "$ErrorActionPreference='Stop'",
      `$uiPath='${psPath(path.join(PROJECT_ROOT, "windows", "aura-ui.ps1"))}'`,
      `$testRoot='${psPath(editorRootsTestRoot)}'`,
      "$tokens=$null;$errors=$null",
      "$ast=[System.Management.Automation.Language.Parser]::ParseFile($uiPath,[ref]$tokens,[ref]$errors)",
      "if($errors.Count){throw 'Could not parse Aura UI for editor bridge regression'}",
      "foreach($name in @('Get-AuraUiPropertyValue','ConvertTo-AuraUiStudioNumber','ConvertTo-AuraUiStudioInteger','Assert-AuraUiStudioEditorRoots','Test-AuraUiStudioExactProperties','Assert-AuraUiStudioEditorPublicValue','Assert-AuraUiStudioEditorMessage','Get-AuraUiStudioMessage','Assert-AuraUiStudioEditorSession','Request-AuraUiMirror')){",
      "  $definition=$ast.Find({param($node)$node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -ceq $name},$true)",
      "  if($null -eq $definition){throw \"Missing Studio editor bridge function $name\"}",
      "  Invoke-Expression $definition.Extent.Text",
      "}",
      "function Assert-Rejected { param([scriptblock]$Operation,[string]$Label);$rejected=$false;try{&$Operation|Out-Null}catch{$rejected=$true};if(-not $rejected){throw \"Studio accepted $Label\"} }",
      "Add-Type -AssemblyName System.Windows.Forms",
      "$script:StudioMessageTypes=@('get-state','set-theme','set-appearance','set-locale','complete-studio-introduction','set-image','clear-image','set-image-framing','set-card-preview-crop','set-enabled','open-aura','open-desktop','import-theme','create-theme-copy','begin-theme-edit','set-theme-token','set-theme-layer','apply-theme-patch','pick-theme-layer-image','pick-theme-launcher-mark','remove-theme-layer','move-theme-layer','undo-theme-edit','redo-theme-edit','save-theme-edit','discard-theme-edit','delete-user-theme','set-aura-preview','set-aura-topmost','refresh-aura-mirror')",
      "$session='12345678-1234-4abc-8def-1234567890ab'",
      "$source='https://aura.studio/index.html'",
      "$script:StudioForm=[pscustomobject]@{IsDisposed=$false;Visible=$true}",
      "$script:Form=[pscustomobject]@{IsDisposed=$false;WindowState=[System.Windows.Forms.FormWindowState]::Normal}",
      "$script:MirrorDue=[DateTime]::UtcNow;$script:StudioEditorState=[pscustomobject]@{active=$false};Request-AuraUiMirror",
      "if($null -ne $script:MirrorDue){throw 'Inactive editor did not clear a pending mirror capture'}",
      "$script:StudioEditorState=[pscustomobject]@{active=$true};Request-AuraUiMirror",
      "if($null -eq $script:MirrorDue){throw 'Active editor could not schedule a mirror capture'}",
      "$script:StudioEditorState=[pscustomobject]@{active=$false}",
      "$valid=@(",
      "  [ordered]@{type='set-locale';locale='zh-TW'},",
      "  [ordered]@{type='complete-studio-introduction'},",
      "  [ordered]@{type='create-theme-copy';theme='default'},",
      "  [ordered]@{type='begin-theme-edit';theme='user-theme';reset=$false},",
      "  [ordered]@{type='set-theme-token';session=$session;revision=0;mode='light';token='canvas';value='#123ABC'},",
      "  [ordered]@{type='set-theme-token';session=$session;revision=0;mode='shared';token='backgroundScope';value='full-window'},",
      "  [ordered]@{type='set-theme-layer';session=$session;revision=0;index=7;preset='wide';property='scale';value=3},",
      "  [ordered]@{type='apply-theme-patch';session=$session;revision=0;changes=@(",
      "    [ordered]@{kind='token';mode='shared';token='radius';value=12},",
      "    [ordered]@{kind='layer';index=0;preset='normal';property='scale';value=1.25},",
      "    [ordered]@{kind='metadata';field='label';locale='zh-TW';value='Studio Copy'}",
      "  )},",
      "  [ordered]@{type='pick-theme-layer-image';session=$session;revision=0;index=-1;role='hero';appearance='dark';context='conversation'},",
      "  [ordered]@{type='move-theme-layer';session=$session;revision=0;index=7;direction='up'},",
      "  [ordered]@{type='undo-theme-edit';session=$session;revision=0},",
      "  [ordered]@{type='save-theme-edit';session=$session;revision=0},",
      "  [ordered]@{type='delete-user-theme';theme='user-theme'}",
      ")",
      "foreach($message in $valid){$parsed=Get-AuraUiStudioMessage -Json ($message|ConvertTo-Json -Compress -Depth 8) -Source $source;if($parsed.type -cne $message.type){throw 'Valid editor message changed type'}}",
      "Assert-Rejected { Get-AuraUiStudioMessage -Json '{\"type\":4}' -Source $source } 'a non-string action type'",
      "Assert-Rejected { Get-AuraUiStudioMessage -Json '{\"type\":\"Set-Theme-Token\"}' -Source $source } 'a case-changed action'",
      "Assert-Rejected { Get-AuraUiStudioMessage -Json '{\"type\":\"get-state\"}' -Source 'https://evil.invalid/' } 'a message from another origin'",
      "Assert-Rejected { Get-AuraUiStudioMessage -Json '{\"type\":\"set-locale\"}' -Source $source } 'a locale action with no locale'",
      "Assert-Rejected { Get-AuraUiStudioMessage -Json '{\"type\":\"set-locale\",\"locale\":\"ja\"}' -Source $source } 'an unsupported locale'",
      "Assert-Rejected { Get-AuraUiStudioMessage -Json '{\"type\":\"set-locale\",\"locale\":4}' -Source $source } 'a non-string locale'",
      "Assert-Rejected { Get-AuraUiStudioMessage -Json '{\"type\":\"set-locale\",\"locale\":\"zh-tw\"}' -Source $source } 'a case-changed locale'",
      "Assert-Rejected { Get-AuraUiStudioMessage -Json '{\"type\":\"set-locale\",\"locale\":\"en\",\"extra\":true}' -Source $source } 'an extra locale property'",
      "Assert-Rejected { Get-AuraUiStudioMessage -Json '{\"type\":\"complete-studio-introduction\",\"completed\":true}' -Source $source } 'an extra introduction property'",
      "$safeProse=[pscustomobject]@{metadata=[pscustomobject]@{description='Try C:\\Themes\\sample or file: notes when documenting a theme.'}}",
      "Assert-AuraUiStudioEditorPublicValue -Value $safeProse",
      "$privateState=[pscustomobject]@{draftPath='C:\\private\\draft'}",
      "Assert-Rejected { Assert-AuraUiStudioEditorPublicValue -Value $privateState } 'a filesystem-bearing private state field'",
      "$filePreview=[pscustomobject]@{previewUrl='file:///C:/private/theme.webp'}",
      "Assert-Rejected { Assert-AuraUiStudioEditorPublicValue -Value $filePreview } 'a filesystem preview URL'",
      "$extra=[ordered]@{type='set-theme-token';session=$session;revision=0;mode='light';token='canvas';value='#123456';path='C:\\private.png'}",
      "Assert-Rejected { Get-AuraUiStudioMessage -Json ($extra|ConvertTo-Json -Compress) -Source $source } 'an extra path property'",
      "$badSession=[ordered]@{type='undo-theme-edit';session=$session.ToUpperInvariant();revision=0}",
      "Assert-Rejected { Get-AuraUiStudioMessage -Json ($badSession|ConvertTo-Json -Compress) -Source $source } 'a noncanonical session'",
      "$stringRevision=[ordered]@{type='undo-theme-edit';session=$session;revision='0'}",
      "Assert-Rejected { Get-AuraUiStudioMessage -Json ($stringRevision|ConvertTo-Json -Compress) -Source $source } 'a string revision'",
      "$fractionRevision=[ordered]@{type='undo-theme-edit';session=$session;revision=0.5}",
      "Assert-Rejected { Get-AuraUiStudioMessage -Json ($fractionRevision|ConvertTo-Json -Compress) -Source $source } 'a fractional revision'",
      "$staleState=[pscustomobject]@{active=$true;session=$session;revision=4}",
      "$script:StudioEditorState=$staleState",
      "Assert-Rejected { Assert-AuraUiStudioEditorSession -Request ([pscustomobject]@{session='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';revision=4}) } 'another active session'",
      "Assert-Rejected { Assert-AuraUiStudioEditorSession -Request ([pscustomobject]@{session=$session;revision=3}) } 'a stale active revision'",
      "$badIndex=[ordered]@{type='set-theme-layer';session=$session;revision=4;index=8;preset='shared';property='role';value='hero'}",
      "Assert-Rejected { Get-AuraUiStudioMessage -Json ($badIndex|ConvertTo-Json -Compress) -Source $source } 'a ninth layer index'",
      "$badScale=[ordered]@{type='set-theme-layer';session=$session;revision=4;index=0;preset='normal';property='scale';value=3.01}",
      "Assert-Rejected { Get-AuraUiStudioMessage -Json ($badScale|ConvertTo-Json -Compress) -Source $source } 'an out-of-range scale'",
      "$badBoolean=[ordered]@{type='set-theme-layer';session=$session;revision=4;index=0;preset='shared';property='visible';value='true'}",
      "Assert-Rejected { Get-AuraUiStudioMessage -Json ($badBoolean|ConvertTo-Json -Compress) -Source $source } 'a string visibility flag'",
      "$badScope=[ordered]@{type='set-theme-token';session=$session;revision=4;mode='shared';token='backgroundScope';value='sidebar'}",
      "Assert-Rejected { Get-AuraUiStudioMessage -Json ($badScope|ConvertTo-Json -Compress) -Source $source } 'an unknown background scope'",
      "$scalarPatch=[ordered]@{type='apply-theme-patch';session=$session;revision=4;changes=[ordered]@{kind='token';mode='shared';token='radius';value=12}}",
      "Assert-Rejected { Get-AuraUiStudioMessage -Json ($scalarPatch|ConvertTo-Json -Compress -Depth 8) -Source $source } 'a scalar patch change instead of an array'",
      "$emptyPatch=[ordered]@{type='apply-theme-patch';session=$session;revision=4;changes=@()}",
      "Assert-Rejected { Get-AuraUiStudioMessage -Json ($emptyPatch|ConvertTo-Json -Compress -Depth 8) -Source $source } 'an empty theme patch'",
      "$oversizedPatch=[ordered]@{type='apply-theme-patch';session=$session;revision=4;changes=@(1..17|ForEach-Object{[ordered]@{kind='token';mode='shared';token='radius';value=12}})}",
      "Assert-Rejected { Get-AuraUiStudioMessage -Json ($oversizedPatch|ConvertTo-Json -Compress -Depth 8) -Source $source } 'a seventeen-change theme patch'",
      "$nestedExtraPatch=[ordered]@{type='apply-theme-patch';session=$session;revision=4;changes=@([ordered]@{kind='layer';index=0;preset='normal';property='scale';value=1;path='C:\\private.webp'})}",
      "Assert-Rejected { Get-AuraUiStudioMessage -Json ($nestedExtraPatch|ConvertTo-Json -Compress -Depth 8) -Source $source } 'an extra nested patch property'",
      "$badPatchKind=[ordered]@{type='apply-theme-patch';session=$session;revision=4;changes=@([ordered]@{kind='custom-css';value='body{}'})}",
      "Assert-Rejected { Get-AuraUiStudioMessage -Json ($badPatchKind|ConvertTo-Json -Compress -Depth 8) -Source $source } 'an unknown patch kind'",
      "$badMetadataLocale=[ordered]@{type='apply-theme-patch';session=$session;revision=4;changes=@([ordered]@{kind='metadata';field='label';locale='ja';value='Theme'})}",
      "Assert-Rejected { Get-AuraUiStudioMessage -Json ($badMetadataLocale|ConvertTo-Json -Compress -Depth 8) -Source $source } 'an unsupported metadata locale'",
      "$longMetadataLabel=[ordered]@{type='apply-theme-patch';session=$session;revision=4;changes=@([ordered]@{kind='metadata';field='label';locale='en';value=('x'*81)})}",
      "Assert-Rejected { Get-AuraUiStudioMessage -Json ($longMetadataLabel|ConvertTo-Json -Compress -Depth 8) -Source $source } 'an 81-character theme name'",
      "$longMetadataDescription=[ordered]@{type='apply-theme-patch';session=$session;revision=4;changes=@([ordered]@{kind='metadata';field='description';locale='en';value=('x'*221)})}",
      "Assert-Rejected { Get-AuraUiStudioMessage -Json ($longMetadataDescription|ConvertTo-Json -Compress -Depth 8) -Source $source } 'a 221-character theme description'",
      "$originalLocalAppData=$env:LOCALAPPDATA",
      "try{",
      "  $env:LOCALAPPDATA=Join-Path $testRoot 'local-app-data'",
      "  $DataRoot=Join-Path (Join-Path $env:LOCALAPPDATA 'ClaudeAura') 'data'",
      "  $StudioEditorRoot=Join-Path $DataRoot 'theme-drafts'",
      "  $StudioEditorPreviewRoot=Join-Path $StudioEditorRoot 'preview'",
      "  $StudioEditorImportRoot=Join-Path $StudioEditorRoot 'imports'",
      "  [void](Assert-AuraUiStudioEditorRoots -Create)",
      "  $outside=Join-Path $testRoot 'outside';[IO.Directory]::CreateDirectory($outside)|Out-Null",
      "  [IO.Directory]::Delete($StudioEditorPreviewRoot)",
      "  New-Item -ItemType Junction -Path $StudioEditorPreviewRoot -Target $outside|Out-Null",
      "  Assert-Rejected { Assert-AuraUiStudioEditorRoots } 'a reparse-point editor preview root'",
      "}finally{",
      "  $env:LOCALAPPDATA=$originalLocalAppData",
      "  if(Test-Path -LiteralPath $StudioEditorPreviewRoot){[IO.Directory]::Delete($StudioEditorPreviewRoot)}",
      "  if(Test-Path -LiteralPath $testRoot){[IO.Directory]::Delete($testRoot,$true)}",
      "}",
    ].join("\n");
    try {
      run("powershell.exe", ["-NoProfile", "-EncodedCommand", Buffer.from(editorBridgeRegression, "utf16le").toString("base64")]);
    } finally {
      await fs.rm(editorRootsTestRoot, { recursive: true, force: true });
    }
  }

  for (const architecture of ["x64", "x86", "arm64"]) {
    const loader = path.join(PROJECT_ROOT, "vendor", "webview2", "runtimes", architecture, "WebView2Loader.dll");
    assert((await fs.stat(loader)).isFile(), `Missing ${architecture} WebView2 loader`);
  }
  for (const file of ["Microsoft.Web.WebView2.Core.dll", "Microsoft.Web.WebView2.WinForms.dll", "LICENSE.txt", "NOTICE.txt"]) {
    assert((await fs.stat(path.join(PROJECT_ROOT, "vendor", "webview2", file))).isFile(), `Missing vendored WebView2 ${file}`);
  }
});

test("Aura Studio persists an exact locale and offers a host-acknowledged welcome guide", async () => {
  const studioHtml = await fs.readFile(path.join(PROJECT_ROOT, "studio", "index.html"), "utf8");
  const studioApp = await fs.readFile(path.join(PROJECT_ROOT, "studio", "app.js"), "utf8");
  const studioCss = await fs.readFile(path.join(PROJECT_ROOT, "studio", "styles.css"), "utf8");
  const studioEditor = await fs.readFile(path.join(PROJECT_ROOT, "studio", "editor.js"), "utf8");
  const ui = await fs.readFile(path.join(PROJECT_ROOT, "windows", "aura-ui.ps1"), "utf8");
  const uiCopy = JSON.parse(await fs.readFile(path.join(PROJECT_ROOT, "windows", "ui-copy.json"), "utf8"));

  assert.match(studioHtml, /class="rail-item" href="#settings" data-i18n="navSettings"/,
    "Studio must expose Settings as a permanent ordinary-shell destination");
  assert.match(studioHtml, /<section id="settings" aria-labelledby="settings-title">/,
    "The Settings destination must be a labelled section");
  const settingsLocales = [...studioHtml.matchAll(
    /<input type="radio" name="settings-locale" value="([^"]+)"/g,
  )].map((match) => match[1]);
  const welcomeLocales = [...studioHtml.matchAll(
    /<input type="radio" name="welcome-locale" value="([^"]+)"/g,
  )].map((match) => match[1]);
  assert.deepEqual(settingsLocales, ["en", "zh-CN", "zh-TW"],
    "Settings must expose only the three exact host-owned locales");
  assert.deepEqual(welcomeLocales, settingsLocales,
    "The welcome guide and Settings must offer the same exact locale set");
  for (const fieldset of ["language-settings", "welcome-language"]) {
    assert.match(studioHtml,
      new RegExp(`<fieldset id="${fieldset}"[^>]+aria-describedby="([^"]+)"[\\s\\S]{0,1000}?<legend[^>]*>[\\s\\S]*?<\\/legend>`),
      `${fieldset} must keep a native legend and an explicit help relationship`);
  }
  for (const locale of ["en", "zh-CN", "zh-TW"]) {
    assert.match(studioHtml, new RegExp(`<span lang="${locale}">[^<]+<\\/span>`),
      `${locale} must expose its autonym with the correct language metadata`);
  }
  assert.match(studioHtml,
    /<dialog id="welcome-dialog"[^>]+aria-labelledby="welcome-title"[^>]+aria-describedby="welcome-body"/,
    "The welcome dialog must expose a stable accessible name and description");
  for (const id of ["welcome-close", "welcome-later", "welcome-try-theme"]) {
    assert.match(studioHtml, new RegExp(`<button type="button" id="${id}"`),
      `${id} must remain an explicit keyboard-operable action`);
  }
  assert.match(studioEditor,
    /const ordinarySections = \["themes", "background", "create", "settings"\]/,
    "Settings must leave the ordinary shell with the other sections during an editor session");

  const stringsMatch = studioApp.match(/const STRINGS = (\{[\s\S]*?\n  \});\n\n  const params/);
  assert(stringsMatch, "Studio locale dictionaries could not be isolated");
  const studioStrings = Function(`"use strict"; return (${stringsMatch[1]});`)();
  assert.deepEqual(Object.keys(studioStrings).sort(), ["en", "zh-CN", "zh-TW"]);
  const studioStringKeys = Object.keys(studioStrings.en).sort();
  const htmlTranslationKeys = [...studioHtml.matchAll(
    /\sdata-i18n(?:-aria-label)?="([^"]+)"/g,
  )].map((match) => match[1]);
  for (const key of htmlTranslationKeys) {
    assert(studioStringKeys.includes(key), `Studio HTML references missing locale key ${key}`);
  }
  for (const locale of ["zh-CN", "zh-TW"]) {
    assert.deepEqual(Object.keys(studioStrings[locale]).sort(), studioStringKeys,
      `${locale} Studio copy does not cover every Settings and welcome state`);
    for (const key of studioStringKeys) {
      assert(String(studioStrings[locale][key]).trim(), `${locale}.${key} is empty`);
    }
  }
  assert.equal(studioStrings["zh-CN"].settingsTitle, "\u8bbe\u7f6e");
  assert.equal(studioStrings["zh-TW"].settingsTitle, "\u8a2d\u5b9a");
  for (const key of [
    "settingsLede", "languageHelp", "gettingStartedBody", "welcomeBody",
    "welcomeThemeBody", "welcomeControlBody", "welcomeCreateBody", "welcomeLauncherNote",
    "welcomeLater", "statusWelcomeBusy",
  ]) {
    assert.notEqual(studioStrings["zh-CN"][key], studioStrings["zh-TW"][key],
      `${key} must be independently authored for zh-CN and zh-TW`);
  }

  const welcomeFlow = studioApp.slice(
    studioApp.indexOf("const openWelcome ="),
    studioApp.indexOf("if (bridge) {", studioApp.indexOf("const openWelcome =")),
  );
  assert.match(welcomeFlow,
    /introductionCompletionDestination = destination;[\s\S]{0,400}?send\(\{ type: "complete-studio-introduction" \}\)/,
    "Automatic welcome exits must request host persistence before closing");
  assert(!studioApp.includes("state.introductionPending = false;"),
    "The Studio page must never acknowledge its own introduction completion");
  assert.match(studioApp,
    /introductionAcknowledged = Boolean\([\s\S]{0,180}?data\.introductionPending === false/,
    "The page must derive introduction completion only from canonical host state");
  assert.match(studioApp,
    /if \(introductionAcknowledged && welcomeDialog\.open\)[\s\S]{0,500}?welcomeDialog\.close\(destination\)/,
    "Only a host state acknowledgement may close the automatic welcome guide");
  assert.match(welcomeFlow,
    /welcomeDialog\.addEventListener\("cancel", \(event\) => \{\s*event\.preventDefault\(\);\s*requestWelcomeDestination\("later"\)/,
    "Escape must share the host-acknowledged skip path");
  assert.match(welcomeFlow,
    /welcomeTryTheme\.addEventListener\("click", \(\) => requestWelcomeDestination\("try-theme"\)\)/,
    "Try a theme must use the same acknowledgement boundary");
  assert.match(studioApp,
    /window\.setTimeout\(\(\) => \{[\s\S]{0,600}?statusWelcomeRetry[\s\S]{0,260}?send\(\{ type: "get-state" \}\)/,
    "A missing host acknowledgement must unlock the dialog and request canonical state");
  assert.match(studioApp,
    /welcomeStatus\.textContent = t\("statusWelcomeBusy"\)[\s\S]{0,120}?welcomeStatus\.removeAttribute\("data-tone"\)/,
    "Welcome persistence progress must be announced inside the modal subtree");
  assert.match(studioHtml, /id="welcome-status"[^>]+role="status"[^>]+aria-live="polite"/,
    "The welcome dialog must expose its own polite live status");
  assert.match(studioApp,
    /const restoreIntroductionFocus[\s\S]{0,300}?requestAnimationFrame\(\(\) => target\.focus\(\)\)/,
    "A failed welcome save must restore focus to the initiating modal control");
  assert.match(studioApp,
    /input\.checked = input\.value === \(localePending \?\? state\.locale\)/,
    "A pending locale must remain visibly selected until the host responds");
  assert.match(studioApp,
    /sessionStorage\.setItem\("claude-aura:resume-welcome", "true"\)/,
    "A manual guide must record a one-shot resume before changing locale");
  assert.match(studioApp,
    /manualWelcomeResumePending[\s\S]{0,220}?openWelcome\(\{ opener: openWelcomeButton \}\)/,
    "A manually reopened welcome guide must resume after its locale reload");
  assert(!/type:\s*"set-theme"/.test(welcomeFlow),
    "The welcome flow must not apply or preview a theme");
  assert.match(welcomeFlow,
    /destination === "try-theme"[\s\S]{0,180}?themesLink\?\.click\(\)[\s\S]{0,180}?themeCardInput\(state\.theme\)\?\.focus\(\)/,
    "Try a theme must move the user to the existing Gallery without selecting a new theme");
  assert.match(studioCss,
    /@media \(forced-colors: active\)[\s\S]*?\.welcome-brand\s*\{\s*background:\s*Canvas;[\s\S]*?\.welcome-step-number/,
    "The welcome guide must retain structure in Windows forced colors");
  assert.match(studioCss,
    /@media \(prefers-reduced-motion: reduce\)\s*\{[\s\S]*?\*\s*\{[^}]*transition:\s*none !important/,
    "The welcome guide must inherit Studio's reduced-motion treatment");
  assert.match(studioApp,
    /const initialRailLink = railLinks\.find\(\(link\) => link\.hash === window\.location\.hash[\s\S]{0,180}?activateRailLink\(initialRailLink, \{ smooth: false \}\)/,
    "A locale reload must restore both the Settings scroll target and its aria-current rail state");

  assert.match(ui, /\$StudioPreferencesPath\s*=\s*Join-Path \$DataRoot 'studio-preferences\.json'/,
    "Studio preferences must stay in a separate device-local host file");
  assert.match(ui,
    /function Write-AuraUiStudioPreferences[\s\S]{0,1600}?\[IO\.File\]::WriteAllText\(\$temporary[\s\S]{0,500}?\[IO\.File\]::Replace\(\$temporary,\s*\$StudioPreferencesPath,\s*\$backup\)[\s\S]{0,180}?\[IO\.File\]::Move\(\$temporary,\s*\$StudioPreferencesPath\)/,
    "Studio preferences must use UTF-8 temporary-write plus atomic replace-or-move persistence");
  assert.match(ui,
    /function Send-AuraUiStudioState[\s\S]{0,1800}?locale = "\$\(\$script:Locale\)"[\s\S]{0,180}?introductionPending =[\s\S]{0,220}?introductionRequested =/,
    "The host must own locale, introduction completion, and launcher-entry state");
  assert.match(ui,
    /function Show-AuraUiStudio\s*\{\s*param\(\[switch\]\$OfferIntroduction\)[\s\S]{0,180}?StudioIntroductionRequested = \$true/,
    "Only an explicit host opening path may request the first-run introduction");
  assert.match(ui, /\$script:LauncherStudioItem\.add_Click\(\{ Show-AuraUiStudio -OfferIntroduction \}\)/,
    "The launcher menu entry must offer the introduction");
  assert.match(ui,
    /\} elseif \(\$wasClickArmed\) \{\s*Show-AuraUiStudio -OfferIntroduction/,
    "A direct launcher click must offer the introduction");
  assert.match(ui, /\$script:TrayOpenStudioItem\.add_Click\(\{ Show-AuraUiStudio \}\)/,
    "The tray entry must not impersonate the Aura launcher introduction path");
  assert.match(ui,
    /function Invoke-AuraUiSetLocale[\s\S]{0,550}?StudioEditorState[\s\S]{0,120}?active[\s\S]{0,260}?throw[\s\S]{0,1600}?Get-AuraUiStudioUrl -PreserveFragment/,
    "A locale change must preserve an active draft and the current ordinary Settings destination");
  assert.match(ui,
    /function Invoke-AuraUiSetLocale[\s\S]{0,1300}?Write-AuraUiStudioPreferences[\s\S]{0,300}?\$script:Locale = \$Locale[\s\S]{0,120}?Get-AuraUiCopy/,
    "The host must persist a locale before changing localized runtime state");
  assert.match(ui,
    /function Invoke-AuraUiCompleteStudioIntroduction[\s\S]{0,500}?Write-AuraUiStudioPreferences[\s\S]{0,180}?Send-AuraUiStudioState/,
    "The host must acknowledge introduction completion with canonical state");
  for (const locale of ["en", "zh-CN", "zh-TW"]) {
    assert(uiCopy[locale].localeNotChangedMessage && uiCopy[locale].studioPreferencesNotSaved,
      `${locale} must localize host-side locale and welcome persistence failures`);
  }
  assert.notEqual(uiCopy["zh-CN"].localeNotChangedMessage, uiCopy["zh-TW"].localeNotChangedMessage);
  assert.notEqual(uiCopy["zh-CN"].studioPreferencesNotSaved, uiCopy["zh-TW"].studioPreferencesNotSaved);

  if (process.platform === "win32") {
    const preferenceRoot = await fs.mkdtemp(path.join(os.tmpdir(), "aura-studio-preferences-"));
    const escapedUiPath = path.join(PROJECT_ROOT, "windows", "aura-ui.ps1").replaceAll("'", "''");
    const escapedRoot = preferenceRoot.replaceAll("'", "''");
    const preferenceRegression = [
      "$ErrorActionPreference='Stop'",
      `$uiPath='${escapedUiPath}'`,
      `$DataRoot='${escapedRoot}'`,
      "$StudioPreferencesPath=Join-Path $DataRoot 'studio-preferences.json'",
      "$StudioIntroductionVersion=1",
      "$tokens=$null;$errors=$null",
      "$ast=[System.Management.Automation.Language.Parser]::ParseFile($uiPath,[ref]$tokens,[ref]$errors)",
      "if($errors.Count){throw 'Could not parse Aura UI for Studio preference regression'}",
      "foreach($name in @('ConvertTo-AuraUiLocale','Get-AuraUiDefaultLocale','Get-AuraUiStudioPreferences','Write-AuraUiStudioPreferences','Get-AuraUiStudioUrl')){",
      "  $definition=$ast.Find({param($node)$node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -ceq $name},$true)",
      "  if($null -eq $definition){throw \"Missing Studio preference function $name\"}",
      "  Invoke-Expression $definition.Extent.Text",
      "}",
      "function Write-AuraUiLog { param([string]$Message) }",
      "function Assert-Rejected { param([scriptblock]$Operation,[string]$Label);$rejected=$false;try{&$Operation|Out-Null}catch{$rejected=$true};if(-not $rejected){throw \"Aura accepted $Label\"} }",
      "$localeCases=[ordered]@{",
      "  'zh-CN'='zh-CN';'zh-SG'='zh-CN';'zh-Hans'='zh-CN';'zh-Hans-CN'='zh-CN';'zh_CN_variant'='zh-CN';",
      "  'zh-TW'='zh-TW';'zh-HK'='zh-TW';'zh-MO'='zh-TW';'zh-Hant'='zh-TW';'zh-Hant-HK'='zh-TW';",
      "  'en-US'='en';'ja-JP'='en';'zh'='en';''='en'",
      "}",
      "foreach($entry in $localeCases.GetEnumerator()){if((ConvertTo-AuraUiLocale -Locale $entry.Key) -cne $entry.Value){throw \"Locale normalization failed for $($entry.Key)\"}}",
      "$fallback=Get-AuraUiStudioPreferences",
      "if($fallback.locale -cnotin @('en','zh-CN','zh-TW') -or $fallback.introductionVersion -ne 0){throw 'Missing preferences did not use the supported OS fallback'}",
      "$saved=Write-AuraUiStudioPreferences -Locale 'zh-TW' -IntroductionVersion 1",
      "if($saved.locale -cne 'zh-TW' -or $saved.introductionVersion -ne 1){throw 'Preference writer changed canonical values'}",
      "$bytes=[IO.File]::ReadAllBytes($StudioPreferencesPath)",
      "if($bytes.Length -ge 3 -and $bytes[0] -eq 239 -and $bytes[1] -eq 187 -and $bytes[2] -eq 191){throw 'Studio preferences unexpectedly contain a UTF-8 BOM'}",
      "$json=[Text.Encoding]::UTF8.GetString($bytes)|ConvertFrom-Json",
      "$names=@($json.PSObject.Properties|ForEach-Object{$_.Name})",
      "if($names.Count -ne 3 -or $names -cnotcontains 'schemaVersion' -or $names -cnotcontains 'locale' -or $names -cnotcontains 'introductionVersion'){throw 'Preference writer widened its schema'}",
      "$roundTrip=Get-AuraUiStudioPreferences",
      "if($roundTrip.locale -cne 'zh-TW' -or $roundTrip.introductionVersion -ne 1){throw 'Studio preferences did not round-trip'}",
      "[void](Write-AuraUiStudioPreferences -Locale 'en' -IntroductionVersion 0)",
      "if(@(Get-ChildItem -LiteralPath $DataRoot -Filter '.studio-preferences-*').Count -ne 0){throw 'Atomic preference files were not cleaned up'}",
      "Assert-Rejected { Write-AuraUiStudioPreferences -Locale 'ja' -IntroductionVersion 0 } 'an unsupported saved locale'",
      "[IO.File]::WriteAllText($StudioPreferencesPath,'{\"schemaVersion\":\"1\",\"locale\":\"zh-TW\",\"introductionVersion\":1}',[Text.UTF8Encoding]::new($false))",
      "$invalid=Get-AuraUiStudioPreferences",
      "if($invalid.introductionVersion -ne 0 -or $invalid.locale -cnotin @('en','zh-CN','zh-TW')){throw 'A wrong-typed preference did not fall back safely'}",
      "$script:Locale='zh-CN'",
      "$script:StudioWebView=[pscustomobject]@{Source=[Uri]'https://aura.studio/index.html?locale=en#settings'}",
      "if((Get-AuraUiStudioUrl) -cne 'https://aura.studio/index.html?locale=zh-CN'){throw 'Studio URL did not use the exact host locale'}",
      "if((Get-AuraUiStudioUrl -PreserveFragment) -cne 'https://aura.studio/index.html?locale=zh-CN#settings'){throw 'Locale reload did not preserve Settings'}",
      "$script:StudioWebView.Source=[Uri]'https://aura.studio/index.html?locale=en#editor'",
      "if((Get-AuraUiStudioUrl -PreserveFragment) -ne 'https://aura.studio/index.html?locale=zh-CN'){throw 'Studio URL preserved a non-ordinary fragment'}",
      "$script:Locale='ja'",
      "Assert-Rejected { Get-AuraUiStudioUrl } 'an unsupported navigation locale'",
    ].join("\n");
    try {
      run("powershell.exe", [
        "-NoProfile",
        "-EncodedCommand",
        Buffer.from(preferenceRegression, "utf16le").toString("base64"),
      ]);
    } finally {
      await fs.rm(preferenceRoot, { recursive: true, force: true });
    }
  }
});

runIfMain(import.meta.url);
