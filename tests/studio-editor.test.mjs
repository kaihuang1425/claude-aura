// studio-editor tests. Extracted from the former monolithic tests/run-tests.mjs.
import { test, runIfMain } from "./support/harness.mjs";
import {
  AURA_VERSION,
  DEFAULT_CONFIG,
  PROJECT_ROOT,
  REQUIRED_SEMANTIC_TOKENS,
  STUDIO_FONT_DISPLAY_STACKS,
  STUDIO_FONT_UI_STACKS,
  STUDIO_LOCALES,
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
  readHostCopy,
  readPayloadSettings,
  readStudioCopy,
  readThemeKit,
  readThemeRegistry,
  realpathSync,
  resolveArtwork,
  run,
  spawnSync,
  validateTheme,
  writeConfig,
  zipEntryNames,
} from "./support/context.mjs";
import {
  defaultStudioGreetingStyle,
  mutateStudioGreetingDocument,
  studioGreetingCompactMarkAvailable,
  studioGreetingPreferenceError,
  studioGreetingState,
} from "../scripts/theme-core/studio.mjs";
test("Windows uses a content-only WebView2 window with Aura Studio and tray controls", async () => {
  const start = await fs.readFile(path.join(PROJECT_ROOT, "windows", "start.ps1"), "utf8");
  const ui = await fs.readFile(path.join(PROJECT_ROOT, "windows", "aura-ui.ps1"), "utf8");
  const powershellFunction = (name) => {
    const startIndex = ui.indexOf(`function ${name}`);
    assert(startIndex >= 0, `Aura UI is missing ${name}`);
    const endIndex = ui.indexOf("\nfunction ", startIndex + 1);
    return ui.slice(startIndex, endIndex < 0 ? ui.length : endIndex);
  };
  const cssAtRuleBlock = (source, marker) => {
    const startIndex = source.indexOf(marker);
    assert(startIndex >= 0, `Studio CSS is missing ${marker}`);
    const openIndex = source.indexOf("{", startIndex);
    assert(openIndex >= 0, `Studio CSS has no block for ${marker}`);
    let depth = 0;
    for (let index = openIndex; index < source.length; index += 1) {
      if (source[index] === "{") depth += 1;
      if (source[index] === "}") depth -= 1;
      if (depth === 0) return source.slice(startIndex, index + 1);
    }
    assert.fail(`Studio CSS has an unterminated block for ${marker}`);
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
  const rendererInject = await fs.readFile(path.join(PROJECT_ROOT, "assets", "renderer-inject.js"), "utf8");
  const visualRecipes = await fs.readFile(path.join(PROJECT_ROOT, "docs", "recipes", "RECIPES.md"), "utf8");
  const screenshotPlan = await fs.readFile(path.join(PROJECT_ROOT, "docs", "SCREENSHOT_PLAN.md"), "utf8");
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
  const uiCopy = await readHostCopy();
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
  assert(!/DwmExtendFrameIntoClientArea|WM_NCCALCSIZE|DwmDefWindowProc|WM_NCHITTEST/.test(ui),
    "Aura must not expand WebView content over the native caption controls");
  assert.match(ui,
    /DwmSetWindowAttribute\(Handle,\s*20[\s\S]{0,180}?DwmSetWindowAttribute\(Handle,\s*19/,
    "System caption controls must follow Light, Dark, and system appearance");
  assert.match(ui,
    /captionColor\s*>=\s*0[\s\S]{0,160}?DwmSetWindowAttribute\(Handle,\s*35/,
    "The retained native caption must use Aura's readable theme-aware color");
  assert.match(ui,
    /DwmSetWindowAttribute\(Handle,\s*34/,
    "The retained native caption must suppress only the outer border");
  assert.match(ui,
    /\$script:Form\.FormBorderStyle\s*=\s*\[System\.Windows\.Forms\.FormBorderStyle\]::Sizable/,
    "The Aura window must keep its native resizable frame");
  assert.match(ui,
    /\$script:StudioForm\.FormBorderStyle\s*=\s*\[System\.Windows\.Forms\.FormBorderStyle\]::Sizable/,
    "The Studio window must keep its native resizable frame");
  // The caption still reads as untitled, but it stays untitled by painting the
  // title in the caption color rather than by leaving the window text empty --
  // an empty caption made Aura invisible to every window-capture picker.
  assert.match(ui, /DwmSetWindowAttribute\(Handle,\s*36,\s*ref textColor/,
    "The retained native caption must hide the title via DWMWA_TEXT_COLOR, not an empty title");
  assert.match(ui, /int textColor = captionColor;/,
    "The caption title must be painted in the caption's own color");
  for (const form of ["Form", "StudioForm"]) {
    assert.doesNotMatch(ui, new RegExp(`\\$script:${form}\\.Text\\s*=\\s*''`),
      `${form} must not blank its window text; recorders skip zero-length titles`);
    assert.match(ui, new RegExp(`\\$script:${form}\\.ShowIcon\\s*=\\s*\\$false`),
      `${form} must hide only the caption icon`);
    for (const control of ["ControlBox", "MinimizeBox", "MaximizeBox"]) {
      assert.match(ui, new RegExp(`\\$script:${form}\\.${control}\\s*=\\s*\\$true`),
        `${form} must retain its native ${control}`);
    }
  }
  assert.match(ui, /\$script:Form\.AccessibleName\s*=\s*'Claude Aura'/,
    "Hiding the painted title must not remove Aura's accessible window name");
  const exitRequest = powershellFunction("Request-AuraUiExit");
  assert.match(exitRequest,
    /\$script:ExitRequested\s*=\s*\$true[\s\S]{0,180}?\$script:Form\.Close\(\)/,
    "Explicit Exit must be marked before closing the main form");
  assert.match(ui,
    /\$script:TrayExitItem\.add_Click\(\{\s*Request-AuraUiExit\s*\}\)/,
    "The tray Exit command must still close the complete application");
  assert(powershellFunction("Fail-AuraUiStartup").includes("Request-AuraUiExit")
      && powershellFunction("Stop-AuraUiAfterIdentityFailure").includes("Request-AuraUiExit"),
    "Fatal startup and identity failures must bypass hide-on-close preservation");
  const mainClosingStart = ui.indexOf("$script:Form.add_FormClosing({");
  const mainClosingEnd = ui.indexOf("[System.Windows.Forms.Application]::Run($script:Form)", mainClosingStart);
  const mainClosing = ui.slice(mainClosingStart, mainClosingEnd);
  const preserveStudioIndex = mainClosing.indexOf("$eventArgs.CloseReason -eq [System.Windows.Forms.CloseReason]::UserClosing");
  const teardownIndex = mainClosing.indexOf("$script:Closing = $true");
  assert(mainClosingStart >= 0 && mainClosingEnd > mainClosingStart
      && preserveStudioIndex >= 0 && teardownIndex > preserveStudioIndex,
  "The visible-Studio preservation branch must run before application teardown");
  assert(mainClosing.includes("-not $script:ExitRequested")
      && mainClosing.includes("$script:StudioForm.Visible")
      && mainClosing.includes("$eventArgs.Cancel = $true")
      && mainClosing.includes("$sender.Hide()")
      && mainClosing.includes("Update-AuraUiLauncherPosition")
      && mainClosing.indexOf("return", preserveStudioIndex) < teardownIndex,
  "Closing Aura while Studio is visible must hide only Aura and leave Studio running");
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
  assert.match(ui, /\$wasClickArmed\s*\)\s*\{\s*Show-AuraUiLauncherMenu/,
    "A left click that was not a drag must reveal the launcher action menu");
  const launcherMenuShow = powershellFunction("Show-AuraUiLauncherMenu");
  assert.match(launcherMenuShow,
    /Hide-AuraUiLauncherTip[\s\S]{0,160}?\$script:LauncherMenu\.Show\(\[System\.Windows\.Forms\.Cursor\]::Position\)/,
    "The launcher must use one shared menu-opening path without changing its circle");
  assert.match(ui,
    /\$eventArgs\.Button -eq \[System\.Windows\.Forms\.MouseButtons\]::Right[\s\S]{0,220}?Show-AuraUiLauncherMenu/,
    "Right-click must remain an alias for the same launcher menu");
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
    /\$script:LauncherButton\.AccessibleRole\s*=\s*\[System\.Windows\.Forms\.AccessibleRole\]::ButtonMenu/,
    "Assistive technology must identify the launcher as a menu button");
  assert.match(ui,
    /\$script:LauncherButton\.AccessibleDescription\s*=\s*"\$\(\$script:UiCopy\.launcherTipHint\)"/,
    "The launcher must expose its localized click, shortcut, and drag guidance");
  assert.match(ui,
    /\$script:LauncherButton\.Bounds\s*=\s*\[Drawing\.Rectangle\]::new\(\s*\$launcherMetrics\.Halo,\s*\$launcherMetrics\.Halo,\s*\$launcherMetrics\.Compact,\s*\$launcherMetrics\.Compact\)/,
    "The visible circle must remain the launcher hit surface, inset by its transparent halo");
  assert.match(ui,
    /function New-AuraUiLauncherRegion[\s\S]{0,700}?\$metrics\.Halo,\s*\$metrics\.Halo,\s*\$metrics\.Compact,\s*\$metrics\.Compact/,
    "The classic fallback region must clip the same halo-inset circle the layered surface paints");
  assert.match(ui, /\$script:LauncherLayeredActive\s*=\s*\$false/,
    "The launcher must remain inactive until the hidden capability smoke succeeds");
  assert.match(ui, /Format32bppPArgb/,
    "The layered launcher must render a premultiplied frame for UpdateLayeredWindow");
  assert.match(ui, /UpdateLayeredWindow/,
    "The launcher must present per-pixel alpha frames, not only a 1-bit region");
  const launcherLayeredActivation = powershellFunction("Enable-AuraUiLauncherLayering");
  const launcherSmokePresent = launcherLayeredActivation.indexOf("Push-AuraUiLauncherFrame");
  const launcherSmokeCommit = launcherLayeredActivation.indexOf("$script:LauncherLayeredActive = $true");
  assert(launcherLayeredActivation.includes("$script:Launcher.Visible")
      && launcherSmokePresent >= 0 && launcherSmokeCommit > launcherSmokePresent,
  "Layering must activate only after a real hidden-window frame succeeds");
  assert.match(ui,
    /\$initialIdentityReady[\s\S]{0,500}?if\s*\(\$launcherClassicRequested\)[\s\S]{0,180}?Disable-AuraUiLauncherLayering[\s\S]{0,180}?Enable-AuraUiLauncherLayering[\s\S]{0,180}?\$script:TrayIcon\.Visible\s*=\s*\$true/,
    "Backend selection must run while the launcher is hidden and before tray visibility");
  assert.match(powershellFunction("Write-AuraUiLauncherBackendDiagnostic"),
    /LauncherBackendDiagnosticWritten[\s\S]*?Launcher backend selected:/,
    "Launcher backend selection must write one bounded local diagnostic");
  assert.match(ui, /function Update-AuraUiLauncherSurface[\s\S]{0,400}?LauncherLayeredActive/,
    "Launcher rendering must route through the layered surface pipeline");
  assert.match(powershellFunction("Disable-AuraUiLauncherLayering"), /Update-AuraUiLauncherRegion/,
    "A layered-composition failure must degrade to the classic region look");
  assert.match(ui, /\$script:LauncherAnimTimer\.Interval\s*=\s*15/,
    "The hover microinteraction must animate on a UI timer, not jump states");
  // The hover caption is its own non-activating window; the old expanding hover
  // bar (Set-AuraUiLauncherExpanded) stays removed, which the AST regression
  // below enforces separately.
  assert.match(ui, /function Show-AuraUiLauncherTip[\s\S]{0,3200}?ShowWindow\(\$script:LauncherTip\.Handle,\s*8\)/,
    "The hover tip must appear via SW_SHOWNA without stealing activation");
  assert.match(ui,
    /function Show-AuraUiLauncherTip[\s\S]{0,3200}?\$tipInitialAlpha\s*=\s*if\s*\(\$script:LauncherLayeredActive\)\s*\{\s*\[byte\]0\s*\}\s*else\s*\{\s*\[byte\]255\s*\}[\s\S]{0,500}?Apply\(\$script:LauncherTip\.Handle,\s*\$bitmap,\s*\$tipInitialAlpha\)/,
    "The classic circular launcher must present its hover tip fully opaque instead of waiting on the disabled layered fade");
  assert.match(ui,
    /\$script:LauncherTipAlpha\s*=\s*\[int\]\$tipInitialAlpha[\s\S]{0,300}?if\s*\(\$script:LauncherLayeredActive[\s\S]{0,180}?\$script:LauncherAnimTimer\.Start\(\)/,
    "Only the layered launcher may defer tooltip visibility to the animation timer");
  assert.match(ui, /launcherTipTitle/,
    "The hover tip must carry the localized launcher-menu caption");
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
  assert.match(common, /\$AuraAppUserModelId\s*=\s*['"]ClaudeAura['"]/,
    "The shared Windows shortcut helpers must define Aura's stable AppUserModelID once");
  assert.match(ui, /SetCurrentProcessExplicitAppUserModelID\(\s*\$AuraAppUserModelId\s*\)/,
    "The running process must use the same stable taskbar identity as Aura shortcuts");
  assert.match(ui, /function Register-AuraUiJumpList[\s\S]{0,900}?System\.Windows\.Shell\.JumpList/,
    "The taskbar Jump List must use the managed WPF JumpList, never hand-written COM interop");
  assert.match(ui, /function Register-AuraUiJumpList[\s\S]{0,900}?-OpenStudio/,
    "The Jump List task must open Studio through the single-instance signal");
  assert.match(ui,
    /\$script:LoadingPanel\.Controls\.AddRange\s*\(\s*@\([\s\S]{0,240}?\$script:RetryButton[\s\S]{0,120}?\)\s*\)/,
    "The retry control must remain inside the loading panel");
  const permanentLoadingThemes = powershellFunction("Get-AuraUiPermanentThemeIds");
  for (const themeId of THEME_IDS) {
    assert(permanentLoadingThemes.includes(`'${themeId}'`),
      `${themeId} is missing from the host loading-screen allowlist`);
  }
  const loadingThemeResolver = powershellFunction("Get-AuraUiLoadingThemeId");
  assert.match(loadingThemeResolver, /if\s*\(-not\s*\(Get-AuraUiEnabled\)\)\s*\{\s*return\s+['"]default['"]/,
    "Original look must use the Default loading presentation");
  assert.match(loadingThemeResolver,
    /sourceRecipe[\s\S]{0,260}?\$permanentThemeIds\s+-ccontains\s+\$sourceRecipe[\s\S]{0,120}?return\s+\$sourceRecipe/,
    "An untouched user theme must inherit only a frozen source loading profile");
  assert.match(loadingThemeResolver, /return\s+['"]default['"]\s*\}\s*$/,
    "Unknown loading profiles must fail to Default");
  const loadingProfile = powershellFunction("Get-AuraUiLoadingProfile");
  for (const cue of [
    "orbit", "editorial-rule", "facet", "ink-frame",
    "horizon", "folio", "ribbon", "capsule",
  ]) {
    assert(loadingProfile.includes(`'${cue}'`), `The permanent loading cue ${cue} is missing`);
  }
  assert(loadingProfile.includes("Test-AuraUiDarkChrome")
      && loadingProfile.includes("'studioStyle'")
      && /Property\s+['"]canvas['"]/.test(loadingProfile)
      && /Property\s+['"]accent['"]/.test(loadingProfile),
  "The loading cover must derive its Light/Dark surface from validated Studio theme colours");
  assert.match(loadingProfile,
    /selectedSourceRecipe[\s\S]{0,320}?selectedHasPermanentProfile[\s\S]{0,620}?StudioEditorState[\s\S]{0,420}?['"]studioStyle['"]/,
    "A last-valid editor palette and a source-recipe user theme must color their inherited loading profile");
  assert.match(loadingProfile, /SystemInformation\]::HighContrast[\s\S]{0,900}?Drawing\.SystemColors/,
    "High contrast must replace loading-screen decoration with Windows system colours");
  const loadingMarkResolver = powershellFunction("New-AuraUiLoadingMarkBitmap");
  assert.match(loadingMarkResolver,
    /Get-AuraUiPermanentThemeIds[\s\S]{0,500}?StartsWith[\s\S]{0,500}?\$source\.Width\s+-ne\s+96[\s\S]{0,100}?\$source\.Height\s+-ne\s+96/,
    "Loading marks must be frozen-theme, root-contained, validated 96px local assets");
  assert.match(loadingMarkResolver,
    /\$cropByTheme\s*=\s*@\{[\s\S]{0,1200}?78\.0\s*\/\s*\$sourceBounds\.Width[\s\S]{0,900}?\[Drawing\.Bitmap\]::new\(88,\s*88/,
    "Loading marks must be optically normalized without modifying their shipped assets");
  const loadingScale = powershellFunction("Get-AuraUiLoadingScale");
  assert.match(loadingScale,
    /LoadingMark\.Width\s*\/\s*88\.0[\s\S]{0,300}?DeviceDpi\s*\/\s*96\.0/,
    "Loading portal geometry must follow the host's effective DPI scale");
  const loadingPainter = powershellFunction("Paint-AuraUiLoadingPanel");
  assert.match(loadingPainter, /switch\s+-CaseSensitive/,
    "The host must select loading portals from its fixed cue allowlist");
  for (const cue of [
    "orbit", "editorial-rule", "facet", "ink-frame",
    "horizon", "folio", "ribbon", "capsule",
  ]) {
    assert(loadingPainter.includes(`'${cue}' {`),
      `The host painter is missing the bounded ${cue} loading portal`);
  }
  assert(!/Invoke-Expression|ScriptBlock/.test(loadingPainter),
    "Loading portals must not accept theme-supplied drawing code");
  const loadingAnimationPreference = powershellFunction("Test-AuraUiLoadingAnimationEnabled");
  assert.match(loadingAnimationPreference,
    /HighContrast[\s\S]{0,500}?WindowMetrics[\s\S]{0,300}?MinAnimate[\s\S]{0,180}?-ceq\s+['"]0['"]/,
    "The loading indicator must honor Windows high contrast and reduced animation");
  assert.match(ui, /\$script:LoadingMark\s*=\s*\[System\.Windows\.Forms\.PictureBox\]::new\(\)/,
    "The loading cover must display the selected permanent theme mark");
  assert.match(ui,
    /\$script:LoadingPanel\.Controls\.AddRange\s*\(\s*@\([\s\S]{0,160}?\$script:LoadingMark[\s\S]{0,400}?\)\s*\)/,
    "The loading mark must sit directly in the painted theme portal");
  assert(!ui.includes("$script:LoadingMarkPlate"),
    "A generic circular mark plate must not flatten the eight loading identities");
  assert.match(ui,
    /function Update-AuraUiLoadingBackground[\s\S]{0,1000}?BackgroundImage\s*=\s*\$nextBackground[\s\S]{0,300}?\$previousBackground\.Dispose\(\)/,
    "The painted cover must back transparent controls with one owned bitmap");
  const loadingLayout = powershellFunction("Set-AuraUiLoadingLayout");
  assert(loadingLayout.includes(
    "Set-AuraUiRoundedControlRegion -Control $script:LoadingProgress")
      && loadingLayout.includes(
        "Set-AuraUiRoundedControlRegion -Control $script:LoadingProgressIndicator"),
  "The loading track and moving segment must retain rounded bounds");
  assert.match(powershellFunction("Update-AuraUiLoadingTheme"),
    /null\s+-eq\s+\$nextMark[\s\S]{0,180}?Get-AuraUiLoadingProfile\s+-ThemeIdOverride\s+['"]default['"][\s\S]{0,140}?New-AuraUiLoadingMarkBitmap\s+-ThemeId\s+['"]default['"]/,
    "A missing selected mark must restore the complete Default loading presentation");
  assert(!loadingPainter.includes("$height * 0.68"),
    "The Japanese Idol ribbon must not cross the status row");
  assert.match(ui,
    /\$script:LoadingProgress\s*=\s*\[System\.Windows\.Forms\.Panel\]::new\(\)[\s\S]{0,700}?\$script:LoadingProgressIndicator/,
    "The native generic marquee must be replaced by the theme-coloured host indicator");
  assert.match(ui,
    /\$script:LoadingAnimationTimer\.Interval\s*=\s*30[\s\S]{0,1200}?\$script:LoadingProgressIndicator\.Left\s*=\s*\$nextLeft/,
    "Loading motion must remain bounded to one host UI timer");
  const payloadState = powershellFunction("Set-AuraUiPayloadState");
  assert.match(payloadState,
    /Update-AuraUiLoadingTheme/,
    "Theme changes must refresh the host loading presentation");
  assert.match(payloadState, /"\(\?:theme\|t\)"/,
    "Payload identity must accept the compiler's compact theme key");
  assert.match(payloadState, /"\(\?:digest\|x\)"/,
    "Payload identity must accept the compiler's compact digest key");
  assert.match(ui,
    /function Set-AuraUiPreferredColorScheme[\s\S]{0,1800}?Update-AuraUiLoadingTheme/,
    "Appearance changes must refresh the Light/Dark loading presentation");
  for (const cue of [
    "orbital aperture", "offset editorial sheet", "split tailored facets",
    "inked skew panel", "eclipse disc", "open folio",
    "asymmetric ribbon field", "layered capsule portal",
  ]) {
    assert(visualRecipes.includes(cue), `The permanent loading recipe is missing ${cue}`);
  }
  const launcherPosition = powershellFunction("Update-AuraUiLauncherPosition");
  assert.match(launcherPosition,
    /LoadingPanel[\s\S]{0,180}?Visible[\s\S]{0,220}?Launcher\.Hide\(\)[\s\S]{0,120}?Hide-AuraUiLauncherTip/,
    "The floating launcher must stay out of the host-owned loading composition");
  assert.match(powershellFunction("Show-AuraUiLoading"),
    /LoadingPanel\.Visible\s*=\s*\$true[\s\S]{0,180}?Update-AuraUiLauncherPosition/,
    "Showing the cover must suppress the floating launcher immediately");
  assert.match(powershellFunction("Hide-AuraUiLoading"),
    /LoadingPanel\.Visible\s*=\s*\$false[\s\S]{0,360}?Update-AuraUiLauncherPosition/,
    "Revealing the page must restore normal launcher positioning");
  assert.match(screenshotPlan,
    /### Permanent themed loading covers[\s\S]{0,1800}?16 whole-window states[\s\S]{0,2200}?fail-open/,
    "Checkpoint D must require actual-Aura loading-cover evidence and fail-open lifecycle proof");
  assert.match(screenshotPlan,
    /For WO-28[\s\S]{0,1200}?Widgets → Loading screen[\s\S]{0,1200}?eight-second timeout[\s\S]{0,1800}?schema-v6[\s\S]{0,900}?loading-screen data\/assets/,
    "Checkpoint F must retain the custom loading-screen editor, host preview, and package plan");
  assert.match(ui, /\$script:RetryButton\.add_Click\(\s*\{/,
    "The loading-panel retry control must remain wired");
  assert.match(ui, /Get-AuraUiCopy/);
  assert.match(ui, /Join-Path \$PSScriptRoot 'locales'/);
  assert.match(ui, /\$script:StudioForm\.AccessibleName\s*=\s*"\$\(\$script:UiCopy\.studioTitle\)"/,
    "The Studio window's accessible name must come from localized UI copy");
  // Screen recorders and the Chromium/Electron screen pickers drop any window
  // whose GetWindowTextLength is 0, so both primary windows need real captions.
  assert.match(ui, /\$script:Form\.Text\s*=\s*'Claude Aura'/,
    "The main Aura window needs a non-empty caption to appear in window-capture pickers");
  assert.match(ui, /\$script:StudioForm\.Text\s*=\s*"\$\(\$script:UiCopy\.studioTitle\)"/,
    "The Studio window needs a non-empty caption to appear in window-capture pickers");
  assert.match(ui,
    /function Update-AuraUiLocalizedChrome[\s\S]{0,400}?\$script:StudioForm\.Text\s*=\s*"\$\(\$script:UiCopy\.studioTitle\)"/,
    "A locale change must retitle the Studio window, not just its accessible name");
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
    /function Get-AuraUiStudioEditorCoreState[\s\S]{0,500}?['"]studio-state['"][\s\S]{0,420}?ConvertFrom-AuraUiStudioEditorResponse/,
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
    /if \(\$active\)[\s\S]*?\$Request\.reset[\s\S]*?\$activeId[\s\S]*?else\s*\{[\s\S]*?\$knownTheme = Get-AuraUiStudioKnownTheme[\s\S]*?\$knownTheme\.source[\s\S]*?\$script:BuiltInAuthoring/,
    "Resetting an active draft must not require installation, while direct built-in edits stay host-authorized");
  assert.match(ui,
    /\$StudioEditorDirectoryName\s*=\s*if\s*\(\$script:BuiltInAuthoring\)\s*\{\s*['"]theme-drafts-builtin-authoring['"]\s*\}\s*else\s*\{\s*['"]theme-drafts['"]\s*\}[\s\S]{0,120}?\$StudioEditorRoot\s*=\s*Join-Path\s+\$DataRoot\s+\$StudioEditorDirectoryName/,
    "Ordinary and built-in authoring drafts must use separate persistent app-data roots");
  assert.match(ui,
    /function Assert-AuraUiStudioEditorRoots[\s\S]{0,1200}?\$expectedEditorDirectoryName\s*=\s*if\s*\(\$script:BuiltInAuthoring\)[\s\S]{0,220}?theme-drafts-builtin-authoring[\s\S]{0,120}?theme-drafts[\s\S]{0,500}?Join-Path \$dataRootPath \$expectedEditorDirectoryName/,
    "Editor-root validation must enforce the host-selected ordinary or built-in root");
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
  const mainNavigationPendingIndex = ui.indexOf("$script:InitialNavigationPending = $true", mainCoreIndex);
  const mainPrepaintStartIndex = ui.indexOf("Start-AuraUiDocumentPrepaintRegistration", mainNavigationPendingIndex);
  assert(mainCoreIndex >= 0
      && mainAppearanceIndex > mainCoreIndex
      && mainNavigationPendingIndex > mainAppearanceIndex
      && mainPrepaintStartIndex > mainNavigationPendingIndex,
  "Aura must apply the WebView2 color preference before its gated claude.ai navigation");
  assert.match(ui,
    /function Complete-AuraUiInitialNavigationAfterPrepaint[\s\S]{0,500}?CoreWebView2\.Navigate\('https:\/\/claude\.ai\/'\)/,
    "The gated initial navigation must still target claude.ai after passive prepaint registration");
  assert.match(ui, /\.add_WebMessageReceived\(\s*\{/);
  assert.match(ui, /PostWebMessageAsJson\s*\(/);
  assert.match(ui, /\[switch\]\$OpenStudio/,
    "The Aura host must expose the Studio-only launch switch");
  assert.match(ui,
    /\$script:StudioOpenSignal\s*=\s*\[System\.Threading\.EventWaitHandle\]::new\([\s\S]{0,180}?\[System\.Threading\.EventResetMode\]::AutoReset[\s\S]{0,180}?"Local\\ClaudeAura\.\$sid\.OpenStudio"/,
    "Studio launch signaling must be a per-user AutoReset event");
  assert.match(ui,
    /\$script:MainOpenSignal\s*=\s*\[System\.Threading\.EventWaitHandle\]::new\([\s\S]{0,180}?\[System\.Threading\.EventResetMode\]::AutoReset[\s\S]{0,180}?"Local\\ClaudeAura\.\$sid\.OpenMain"/,
    "Titleless main-window launch signaling must be a per-user AutoReset event");
  const existingInstanceIndex = ui.indexOf("if (-not $createdNew)");
  const existingStudioBranchIndex = ui.indexOf("if ($OpenStudio)", existingInstanceIndex);
  const existingSignalIndex = ui.indexOf("[void]$script:StudioOpenSignal.Set()", existingStudioBranchIndex);
  const existingReturnIndex = ui.indexOf("return", existingSignalIndex);
  assert(existingInstanceIndex >= 0 && existingStudioBranchIndex > existingInstanceIndex
      && existingSignalIndex > existingStudioBranchIndex && existingReturnIndex > existingSignalIndex,
    "-OpenStudio must signal the already-running Aura instance before the second process returns");
  assert.match(ui,
    /if \(\$OpenStudio\)[\s\S]{0,120}?\$script:StudioOpenSignal\.Set\(\)[\s\S]{0,120}?else\s*\{[\s\S]{0,100}?\$script:MainOpenSignal\.Set\(\)/,
    "A normal second launch must foreground the titleless main window through its named signal");
  assert.match(ui,
    /if \(\$OpenStudio\) \{ \[void\]\$script:StudioOpenSignal\.Set\(\) \}/,
    "A first Aura instance launched with -OpenStudio must queue Studio opening");
  const namedSignalRegistration = powershellFunction("Register-AuraUiNamedSignalWaits");
  assert.match(namedSignalRegistration,
    /\$script:StudioOpenSignal[\s\S]{0,160}?Show-AuraUiStudio/,
    "A registered wait must post the Studio-open signal to the UI thread");
  assert.match(namedSignalRegistration,
    /\$script:MainOpenSignal[\s\S]{0,160}?Show-AuraUiMain/,
    "A registered wait must post the main-window foreground signal to the UI thread");
  assert.match(powershellFunction("Show-AuraUiStudio"),
    /\.Activate\(\)[\s\S]{0,120}?\.BringToFront\(\)/,
    "A signaled Studio window must be restored and foregrounded");
  assert.match(powershellFunction("Show-AuraUiStudio"),
    /StudioLastWindowState[\s\S]*?FormWindowState\]::Maximized/,
    "A signaled Studio window must preserve minimized-from-maximized state");
  assert.match(ui, /\$script:StudioOpenSignal\.Dispose\(\)/,
    "The named Studio signal must be disposed during shutdown");
  assert.match(ui, /\$script:MainOpenSignal\.Dispose\(\)/,
    "The named main-window signal must be disposed during shutdown");

  const expectedStudioMessageTypes = [
    "get-state",
    "set-theme",
    "set-appearance",
    "set-locale",
    "complete-studio-introduction",
    "set-image",
    "clear-image",
    "set-avatar",
    "clear-avatar",
    "set-avatar-framing",
    "set-image-framing",
    "set-card-preview-crop",
    "set-enabled",
    "open-aura",
    "open-desktop",
    "import-theme",
    "export-terminal-themes",
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
    "set-greeting-phrases",
    "reset-greeting",
    "set-aura-preview",
    "set-aura-topmost",
    "refresh-aura-mirror",
    "prompt-shelf-read",
    "prompt-shelf-create",
    "prompt-shelf-update",
    "prompt-shelf-move",
    "prompt-shelf-delete",
    "prompt-shelf-insert",
    "prompt-shelf-confirm-checked",
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
  const terminalExportShape = expectedPropertiesMatch[1].match(
    /'export-terminal-themes'\s*\{([^}]*)\}/,
  );
  assert(terminalExportShape, "Studio exact message-shape switch is missing export-terminal-themes");
  assert.deepEqual(
    [...terminalExportShape[1].matchAll(/['"]([^'"]+)['"]/g)].map((match) => match[1]),
    ["type", "theme"],
    "Terminal export must accept only its exact theme identifier",
  );
  assert.match(ui,
    /\$type -ceq 'export-terminal-themes'[\s\S]{0,320}?\$sourceUri\.AbsolutePath -cne '\/index\.html'[\s\S]{0,240}?Test-AuraUiStudioDocumentUri -Uri \$sourceUri -AllowFragment[\s\S]{0,320}?\$message\.theme -isnot \[string\][\s\S]{0,220}?\^\[a-z\]\[a-z0-9-\]\{1,39\}\$/,
    "Terminal export must validate its exact Studio document and bounded theme id");
  const expectedPromptShelfMessageShapes = {
    "prompt-shelf-read": ["type", "version", "requestId"],
    "prompt-shelf-create": ["type", "version", "requestId", "session", "revision", "commandEpoch", "text"],
    "prompt-shelf-update": ["type", "version", "requestId", "session", "revision", "commandEpoch", "id", "text"],
    "prompt-shelf-move": ["type", "version", "requestId", "session", "revision", "commandEpoch", "id", "direction"],
    "prompt-shelf-delete": ["type", "version", "requestId", "session", "revision", "commandEpoch", "id"],
    "prompt-shelf-insert": ["type", "version", "requestId", "session", "revision", "commandEpoch", "id"],
    "prompt-shelf-confirm-checked": ["type", "version", "requestId", "session", "revision", "commandEpoch"],
  };
  for (const [action, expectedShape] of Object.entries(expectedPromptShelfMessageShapes)) {
    const escapedAction = action.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const shapeMatch = expectedPropertiesMatch[1].match(new RegExp(`'${escapedAction}'\\s*\\{([^}]*)\\}`));
    assert(shapeMatch, `Studio exact message-shape switch is missing ${action}`);
    assert.deepEqual([...shapeMatch[1].matchAll(/['"]([^'"]+)['"]/g)].map((match) => match[1]), expectedShape,
      `${action} accepts missing, reordered, or extra page properties`);
  }
  assert(!expectedPromptShelfMessageShapes["prompt-shelf-insert"].includes("text"),
    "Prompt Shelf insertion must identify a saved host draft without carrying its body");
  assert.match(ui,
    /\$type -clike 'prompt-shelf-\*'[\s\S]{0,240}?\$sourceUri\.AbsolutePath -cne '\/index\.html'[\s\S]{0,300}?Test-AuraUiStudioDocumentUri -Uri \$sourceUri -AllowFragment[\s\S]{0,220}?Assert-AuraPromptShelfStudioRequest -Message \$message/,
    "Prompt Shelf messages must use the exact, allowlisted Studio document URL before their bounded fields are validated");
  assert.match(ui,
    /function Test-AuraUiStudioDocumentUri[\s\S]{0,900}?\^\\\?locale=\(\[\^&\]\+\)\(\?:&view=\(\[\^&\]\+\)\)\?\$[\s\S]{0,900}?'themes', 'prompt-shelf', 'background', 'create', 'settings'/,
    "Studio document URLs must allow only a supported locale and ordinary optional view");
  assert.match(studioApp,
    /send\(\{ type: "prompt-shelf-read", version: promptShelfBridgeVersion, requestId \}\)/,
    "Prompt Shelf reads must send only protocol identity and a fresh request identity");
  assert.match(studioApp,
    /const message = \{\s*type,\s*version: promptShelfBridgeVersion,\s*requestId,\s*session: promptShelf\.session,\s*revision: promptShelf\.revision,\s*commandEpoch: promptShelf\.commandEpoch,\s*\.\.\.fields,\s*\}/,
    "Every Prompt Shelf command must share the version/session/revision/epoch envelope");
  const promptShelfInsertHandler = studioApp.match(
    /promptShelfInsert\.addEventListener\("click",[\s\S]*?\n\s*\}\);/)?.[0] ?? "";
  assert.match(promptShelfInsertHandler,
    /sendPromptShelfAction\("prompt-shelf-insert", "insert", \{ id: selected\.id \}\)/,
    "The Studio Insert action must send only the selected host-owned draft id");
  assert(!promptShelfInsertHandler.includes("text"),
    "The Studio Insert action must not copy prompt text into its command envelope");
  assert.match(studioApp, /promptShelfText\.readOnly = pending/,
    "A pending Shelf mutation must freeze the editor until its result is reconciled");
  assert.match(studioApp,
    /if \(itemTarget\) itemTarget\.focus\(\);[\s\S]{0,180}?promptShelfIsDirty\(\) \|\| promptShelfNew\.disabled[\s\S]{0,100}?promptShelfText\.focus\(\)[\s\S]{0,100}?promptShelfNew\.focus\(\)/,
    "Refresh focus recovery must fall back when the previous Shelf row no longer exists");
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
    "set-greeting-phrases": [
      "type", "session", "revision", "enabled", "source", "displayName",
      "globalPhrases", "overrideMode", "overridePhrases",
    ],
    "reset-greeting": ["type", "session", "revision"],
  };
  for (const [action, expectedShape] of Object.entries(expectedEditorMessageShapes)) {
    const escapedAction = action.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const shapeMatch = expectedPropertiesMatch[1].match(new RegExp(`'${escapedAction}'\\s*\\{([^}]*)\\}`));
    assert(shapeMatch, `Studio exact message-shape switch is missing ${action}`);
    assert.deepEqual([...shapeMatch[1].matchAll(/['"]([^'"]+)['"]/g)].map((match) => match[1]), expectedShape,
      `${action} accepts missing, reordered, or extra page properties`);
  }
  const greetingShuffleValidator = powershellFunction("ConvertTo-AuraUiGreetingShuffleCheckpoint");
  assert.match(greetingShuffleValidator,
    /'themeId',\s*'phraseDigest',\s*'order',\s*'cursor',\s*'lastIndex'/,
    "The host must accept only the privacy-bounded greeting shuffle shape");
  assert.match(greetingShuffleValidator, /ExpectedTheme[\s\S]*?\[StringComparison\]::Ordinal/,
    "The host must bind a greeting checkpoint to the exact active theme");
  const greetingShuffleWriter = powershellFunction("Invoke-AuraUiGreetingShuffleCheckpoint");
  assert.match(greetingShuffleWriter,
    /\$ThemeCli,\s*'greeting-checkpoint',\s*'--config',\s*\$ConfigPath,\s*'--state-base64'/,
    "The host must persist renderer shuffle progress through the bounded CLI command");
  assert(!/(?:Set-AuraUiPayloadState|Apply-AuraUiTheme|Send-AuraUiStudioState)/.test(greetingShuffleWriter),
    "Checkpoint persistence must not compile, apply, reroll, or echo personal greeting state");
  const greetingProbeUpdater = powershellFunction("Update-AuraUiGreetingProbe");
  assert.match(greetingProbeUpdater,
    /'nativeHidden',\s*'visitEpoch',\s*'shuffle',\s*'rect'/,
    "The renderer probe contract must include only the bounded shuffle checkpoint");
  assert.match(greetingProbeUpdater,
    /Invoke-AuraUiGreetingShuffleCheckpoint\s+-Shuffle\s+\$shuffleCheckpoint/,
    "A settled custom greeting probe must checkpoint its advanced shuffle state");
  const rejectedMessageHandler = ui.slice(
    ui.indexOf("$studioCore.add_WebMessageReceived({"),
    ui.indexOf("$studioCore.add_NewWindowRequested({"),
  );
  for (const action of Object.keys(expectedEditorMessageShapes)) {
    const escapedAction = action.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    assert((rejectedMessageHandler.match(new RegExp(`'${escapedAction}'`, "g")) ?? []).length >= 2,
      `${action} rejection must be recognized and acknowledged immediately`);
  }
  for (const cropAction of ["set-image-framing", "set-avatar-framing", "set-card-preview-crop"]) {
    assert(rejectedMessageHandler.includes(`'${cropAction}'`),
      `${cropAction} rejection must release the crop-save pending state`);
  }
  const resetGreetingBridge = powershellFunction("Invoke-AuraUiResetGreeting");
  assert.match(resetGreetingBridge,
    /Assert-AuraUiStudioEditorSession[\s\S]*Invoke-AuraUiStudioEditorRequest/,
    "Reset greeting must validate the active revision and reach the Node editor core");
  assert.match(ui,
    /'reset-greeting'\s*\{\s*\[void\]\(Invoke-AuraUiResetGreeting -Request \$message\);\s*break\s*\}/,
    "The reset-greeting host action must dispatch instead of being accepted as a no-op");
  const patchValidation = ui.match(/'apply-theme-patch'\s*\{([\s\S]*?)\n\s*'pick-theme-layer-image'\s*\{/)?.[1] ?? "";
  assert.match(patchValidation, /\$Message\.changes\s+-isnot\s+\[System\.Array\]/,
    "Theme patches must require a JSON array instead of coercing a scalar change");
  assert.match(patchValidation, /\$changes\.Count\s+-lt\s+1\s+-or\s+\$changes\.Count\s+-gt\s+16/,
    "Theme patches must contain between one and sixteen changes");
  for (const [kind, exactProperties] of Object.entries({
    token: ["kind", "mode", "token", "value"],
    layer: ["kind", "index", "preset", "property", "value"],
    metadata: ["kind", "field", "locale", "value"],
    "metadata-locale": ["kind", "locale", "enabled"],
    greeting: ["kind", "operation", "appearance", "frame", "value"],
  })) {
    const kindBlock = patchValidation.match(new RegExp(`'${kind}'\\s*\\{([\\s\\S]*?)(?=\\n\\s*'|\\n\\s*default)`))?.[1] ?? "";
    for (const property of exactProperties) {
      assert(kindBlock.includes(`'${property}'`), `Theme ${kind} patches do not require ${property}`);
    }
  }
  assert.match(patchValidation, /\$change\.field\s+-cnotin\s+@\('label',\s*'description'\)/,
    "Metadata patches must expose only localized names and descriptions");
  assert.match(patchValidation, /\$change\.locale\s+-cnotin\s+\$StudioLocaleIds/,
    "Metadata patches must use the canonical fifteen Studio locales");
  assert.match(patchValidation,
    /'metadata-locale'\s*\{[\s\S]{0,700}?\$change\.enabled\s+-isnot\s+\[bool\][\s\S]{0,300}?\$change\.locale\s+-ceq\s+'en'\s+-and\s+-not\s+\$change\.enabled/,
    "Locale selection must be Boolean and keep English as the immutable fallback");
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
  assert.match(rendererInject,
    /const MAIN_MARKER = "data-claude-aura-main-canvas";[\s\S]{0,120}?const PROMPT_MARKER = "data-claude-aura-prompt";/,
    "The renderer layout probe must measure the marked live main and prompt layout");
  assert.match(rendererInject,
    /const lp = \(\) => \{[\s\S]{0,1200}?"frame": viewport\(\) === "w" \? "wide" : "normal"[\s\S]{0,420}?"main": lr\(f\.main\)[\s\S]{0,180}?"prompt": lr\(f\.prompt\)/,
    "The shared renderer probe must carry its explicit normal/wide frame and marked rectangles");
  assert.match(ui,
    /typeof state\.getLayoutProbe === "function" \? state\.getLayoutProbe\(\) : null/,
    "The mirror host must consume the renderer's shared layout probe instead of duplicating DOM inference");
  assert.match(ui, /\$script:MirrorProbeTask = \$script:WebView\.CoreWebView2\.ExecuteScriptAsync\(\$probe\)/,
    "Mirror geometry must come from a non-blocking layout probe of the live page");
  assert.match(ui,
    /\$core\.add_SourceChanged\(\{[\s\S]{0,160}?Request-AuraUiContextMirror[\s\S]{0,160}?}\)/,
    "Aura source changes must refresh the active editor's private mirror");
  assert.match(ui,
    /\$core\.add_HistoryChanged\(\{[\s\S]{0,160}?Request-AuraUiContextMirror[\s\S]{0,160}?}\)/,
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
    /\$mirrorViewport[\s\S]{0,160}?-in\s+@\('normal',\s*'wide'\)[\s\S]{0,4000}?viewport\s*=\s*\$mirrorViewport/,
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
  const editorLocaleCopy = (await readStudioCopy()).editor;
  for (const locale of STUDIO_LOCALES) {
    const copy = editorLocaleCopy[locale];
    assert(typeof copy?.levelSimple === "string" && copy.levelSimple.trim()
        && typeof copy?.levelAdvanced === "string" && copy.levelAdvanced.trim()
        && copy.levelSimple !== copy.levelAdvanced,
    `${locale} must name Quick customize and Advanced independently`);
  }
  assert.equal(editorLocaleCopy.en.levelSimple, "Quick customize");
  assert.equal(editorLocaleCopy.en.levelAdvanced, "Advanced");
  assert.match(studioEditorCss, /\.editor-view\[data-level="simple"\]\s+\.advanced-only\s*\{[^}]*display:\s*none/,
    "Quick customize must hide only controls explicitly classified as Advanced");
  const simpleVisibilityRules = [...studioEditorCss.matchAll(/\.editor-view\[data-level="simple"\][^{]*\{[^}]*display:\s*none[^}]*\}/g)]
    .map((match) => match[0]).join("\n");
  assert(!simpleVisibilityRules.includes(".editor-controls"),
    "Quick customize must retain its current-language name, essential colors, images, and recovery controls");
  assert.deepEqual(
    [...studioHtml.matchAll(/data-editor-branch-target="([^"]+)"/g)].map((match) => match[1]),
    ["interface", "background", "widgets"],
    "Quick customize and Advanced must share exactly Interface, Background, and Widgets",
  );
  assert(!studioHtml.includes("data-editor-panel")
      && !studioEditor.includes("dataEditorPanel")
      && !studioEditor.includes("setInspectorPanel"),
    "The superseded Style, Images, Placement, and Checks panel model must be removed");
  assert.match(studioHtml,
    /data-editor-branch-target="interface"[\s\S]{0,1200}?data-editor-branch-target="background"[\s\S]{0,1200}?data-editor-branch-target="widgets"/,
    "The three object-family branches must stay in their frozen order");
  assert.match(studioHtml,
    /class="editor-inspector-nav" role="toolbar" aria-orientation="horizontal"/,
    "The five workflow pages must share one compact nonlinear toolbar");
  assert.deepEqual(
    [...studioHtml.matchAll(/data-editor-page-target="([^"]+)"/g)].map((match) => match[1]),
    ["details", "interface", "background", "widgets", "review"],
    "The workflow must expose Details, the three capability branches, and Review in order",
  );
  assert.equal((studioHtml.match(/class="editor-branch-glyph"/g) ?? []).length, 5,
    "Each workflow page must have its own recognizable glyph");
  const branchToolCopy = (await readStudioCopy()).editor;
  for (const locale of STUDIO_LOCALES) {
    for (const key of ["branchInterfaceDetail", "branchBackgroundDetail", "branchWidgetsDetail"]) {
      assert(String(branchToolCopy[locale]?.[key] ?? "").trim(),
        `${locale} is missing native branch-tool copy for ${key}`);
    }
  }
  assert.match(studioHtml, /id="editor-branch-help"[^>]+aria-live="polite"/,
    "The active selection tool must explain what the canvas can select");
  assert(!/class="editor-inspector-tab[^"]*advanced-only[^"]*"[^>]+data-editor-branch-target/.test(studioHtml),
    "No content-family branch may disappear in Quick customize");
  assert.match(studioHtml,
    /class="editor-section" data-editor-branch="interface" data-editor-targets="interface\.theme" aria-labelledby="editor-materials-title"/,
    "Interface must expose its understandable interface font, corner, and shadow controls");
  assert.match(studioHtml, /id="editor-target-picker"/,
    "The inspector must provide one compact target picker instead of a third pane");
  for (const id of [
    "editor-context-editing", "editor-context-applies", "editor-context-source", "editor-context-frame",
  ]) assert(studioHtml.includes(`id="${id}"`), `${id} is missing from the persistent context strip`);
  assert.match(studioHtml,
    /id="editor-document-details" class="editor-document-details-panel"[^>]+hidden/,
    "Localized names and descriptions must remain available as document details");
  assert.equal((studioHtml.match(/data-editor-branch="widgets"/g) ?? []).length, 1,
    "Widgets must contain only the already authorized App identity surface");
  assert.equal((studioHtml.match(/data-editor-targets="widgets\.[^"]+"/g) ?? []).length, 1);
  const widgetsMarkup = studioHtml.slice(
    studioHtml.indexOf('data-editor-branch="widgets"'),
    studioHtml.indexOf('data-editor-branch="background"'),
  );
  assert.match(widgetsMarkup,
    /<button type="button" id="editor-launcher-preview"[^>]+data-editor-i18n-aria-label="replaceAppMark"/,
    "The App identity preview must truthfully name the mark-replacement file action");
  const widgetSelectionCopy = (await readStudioCopy()).editor;
  for (const locale of STUDIO_LOCALES) {
    assert(String(widgetSelectionCopy[locale]?.replaceAppMark ?? "").trim(),
      `${locale} is missing the App identity mark-replacement action`);
  }
  assert.match(studioHtml,
    /class="editor-section editor-feedback" data-editor-global data-editor-workflow-page="review"/,
    "Validation and budgets must own the dedicated Review page without becoming a capability branch");
  const inspectorContextBlock = studioEditor.match(
    /const refreshInspectorContext\s*=\s*\(\)\s*=>\s*\{[\s\S]*?\n\s*};/)?.[0] ?? "";
  const inspectorSourceBlock = studioEditor.match(
    /const fieldUsesThemeOriginal\s*=\s*\(field\)\s*=>\s*\{[\s\S]*?\n\s*};/)?.[0] ?? "";
  assert.match(inspectorSourceBlock,
    /state\.shared\.prompt\.native[\s\S]{0,180}?hasStageOverridePrefix\("shared\.prompt"\)/,
    "New-chat placement provenance must follow its native inherited state and local override");
  assert.match(inspectorSourceBlock,
    /state\.shared\.inherited\[inherited\[1\]\][\s\S]{0,120}?stageOverrides\.has\(field\)/,
    "Shared material provenance must follow the selected field rather than unrelated draft edits");
  assert(!inspectorContextBlock.includes("hasUnsavedEdits()"),
    "Source must not make every target Customized because an unrelated field is dirty");
  assert.match(inspectorContextBlock, /const tokenMode[\s\S]*?contextApplies\.textContent/,
    "Applies-to text must derive the active color mode from the selected field");
  for (const target of ["background.layer", "interface.new-chat-area", "interface.greeting"]) {
    assert(inspectorContextBlock.includes(`inspectorTarget === "${target}"`),
      `Applies-to text does not describe ${target}`);
  }
  assert.match(inspectorContextBlock,
    /: tokenMode\s*\?\s*`\$\{tr\(tokenMode === "dark" \? "appearanceDark" : "appearanceLight"\)}/,
    "Mode-specific colors must name their selected appearance");
  const layerScopeBlock = studioEditor.match(
    /const layerScopeLabel\s*=\s*\(layer\)\s*=>\s*\{[\s\S]*?\n\s*};/,
  )?.[0] ?? "";
  assert.match(layerScopeBlock,
    /stageOverrides\.get\(`layers\[\$\{layer\.index}]\.\$\{property}`\) \?\? layer\[property\]/,
    "Layer Applies to must reflect a staged scope immediately, including while host sync is deferred");
  assert.match(inspectorContextBlock,
    /const fieldFrame\s*=\s*\/\^layers[\s\S]{0,300}?shared\\\.greeting\\\.frames[\s\S]{0,180}?contextFrameRow\.hidden\s*=\s*!fieldFrame/,
    "Only a responsive image or greeting-frame property may show the Standard or Wide edit target");
  assert.match(inspectorContextBlock,
    /const editFrameLabel[\s\S]{0,140}?const previewFrameLabel\s*=\s*tr\(stageViewport[\s\S]{0,320}?editFrameLabel[\s\S]{0,120}?customFrameUses"\), previewFrameLabel/,
    "A custom preview must name its resolved saved set without replacing the field's edit target");
  const targetPickerBlock = studioEditor.match(
    /const syncTargetPicker\s*=\s*\(\)\s*=>\s*\{[\s\S]*?\n\s*};/)?.[0] ?? "";
  assert.match(targetPickerBlock,
    /const onlyTarget\s*=\s*entries\.length === 1[\s\S]{0,180}?targetPicker\.hidden\s*=\s*onlyTarget[\s\S]{0,180}?contextEditing\.hidden\s*=\s*!onlyTarget/,
    "A one-target branch must show its target as context instead of a redundant dropdown");
  const editingTargetLabelBlock = studioEditor.match(
    /const editingTargetLabel\s*=\s*\(target\)\s*=>\s*\{[\s\S]*?\n\s*};/,
  )?.[0] ?? "";
  assert.match(editingTargetLabelBlock,
    /target !== "background\.layer"[\s\S]{0,220}?selectedLayer\.index \+ 1/,
    "The Background target picker must identify the selected image instead of only saying Images");
  assert.match(targetPickerBlock, /option\.textContent\s*=\s*editingTargetLabel\(entry\.id\)/,
    "The selected-image label must be visible in the multi-target picker");
  const setInspectorTargetBlock = studioEditor.match(
    /const setInspectorTarget\s*=\s*\([\s\S]*?\n\s*};/)?.[0] ?? "";
  assert.match(setInspectorTargetBlock,
    /targetByBranch\[inspectorBranch\]\s*=\s*target[\s\S]{0,360}?dataset\.inspectorBranch[\s\S]{0,100}?dataset\.inspectorTarget/,
    "Each capability branch must remember its last selected target");
  assert.match(setInspectorTargetBlock,
    /if \(routePage\)\s*\{\s*inspectorPage\s*=\s*capability\.branch;\s*\}/,
    "Canvas and issue target routing must activate the owning workflow page");
  assert.match(setInspectorTargetBlock,
    /syncInspectorPagePresentation\(\{\s*focusPage:\s*focusBranch\s*\}\)/,
    "Target routing must synchronize the active workflow-page presentation");
  assert(!studioHtml.includes("editor-section-progress")
      && !studioEditor.includes("syncSectionProgress")
      && !studioEditorCss.includes(".editor-section-progress"),
  "Dedicated target pages must remove the retired within-page section rail completely");
  const trackInspectorFieldBlock = studioEditor.match(
    /const trackInspectorField\s*=\s*\(event\)\s*=>\s*\{[\s\S]*?\n\s*};/,
  )?.[0] ?? "";
  assert.match(trackInspectorFieldBlock,
    /closest\?\.\("\.editor-section\[data-editor-branch]\[data-editor-targets]"\)[\s\S]{0,300}?inspectorSectionTarget\(section\)[\s\S]{0,220}?target !== inspectorTarget[\s\S]{0,160}?setInspectorTarget\(target\)/,
    "Using a control on the selected target page must retain exact target context");
  assert.match(studioEditor,
    /const inspectorSectionTarget[\s\S]{0,300}?targets\.length === 1 \? targets\[0] : null/,
    "A shared Background guide must not arbitrarily replace the current exact target");
  assert(studioEditor.includes('editorControls?.addEventListener("click", trackInspectorField)'),
    "Section actions without a data field must still update the active inspector target");
  const syncStageToolbarBlock = studioEditor.match(
    /const syncStageToolbar\s*=\s*\(\)\s*=>\s*\{[\s\S]*?\n\s*};/,
  )?.[0] ?? "";
  assert.match(syncStageToolbarBlock,
    /promptContextSection\.hidden = !newChat[\s\S]{0,420}?greetingContextUnavailable\.hidden = newChat/,
    "New-chat and conversation switches must preserve the dedicated target replacement sections");
  assert(studioHtml.indexOf("editor-prompt-unavailable") < studioHtml.indexOf("editor-greeting-unavailable"),
    "Conversation replacements must preserve New chat area before Greeting in target-page order");
  const pageNavigationBlock = studioEditor.match(
    /workflowTabs\.forEach\(\(tab\)\s*=>\s*tab\.addEventListener\("click"[\s\S]*?\n\s*}\)\);/)?.[0] ?? "";
  assert.match(pageNavigationBlock,
    /dataset\.editorPageTarget[\s\S]{0,120}?setInspectorPage\(page,[\s\S]{0,220}?targetByBranch\[page\]/,
    "Workflow changes must restore the remembered target for capability pages");
  assert(!/(?:stageContext|stageViewport|selectedMode|backgroundScope)\s*=/.test(pageNavigationBlock),
    "Workflow changes must preserve preview context, responsive scope, and appearance");
  assert.match(studioEditor,
    /workflowTabs\.forEach\(\(tab\)\s*=>\s*tab\.addEventListener\("keydown"[\s\S]{0,500}?(?:ArrowLeft|ArrowRight)[\s\S]{0,500}?availableTabs\s*=\s*workflowTabs\.filter\([\s\S]{0,500}?availableTabs\[nextIndex\]\.click\(\)/,
    "The workflow toolbar must rove only across visible enabled pages");
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
  const themeOriginalCopy = (await readStudioCopy()).editor;
  for (const locale of STUDIO_LOCALES) {
    assert(String(themeOriginalCopy[locale]?.themeOriginal ?? "").trim(),
      `${locale} must name the inherited theme-original setting`);
  }
  assert.match(studioEditorCss, /\.editor-inherited-note\s*\{[^}]*color:\s*var\(--ink-muted\)/,
    "Inherited values must be disclosed with a quiet inline note instead of another boxed widget");
  assert.match(studioHtml,
    /class="editor-section" data-editor-branch="widgets" data-editor-targets="widgets\.app-identity" aria-labelledby="editor-app-identity-title"/,
    "Widgets must expose the authorized App identity controls");
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
  const requestLauncherMarkBlock = studioEditor.match(
    /const requestLauncherMark\s*=\s*\(\)\s*=>\s*\{[\s\S]*?\n\s*};/,
  )?.[0] ?? "";
  assert.match(requestLauncherMarkBlock,
    /const base = mutationBase\(\);[\s\S]{0,120}?post\(\{ type: "pick-theme-launcher-mark", \.\.\.base }\)/,
    "App identity replacement must use the active editor session and exact host-owned picker action");
  assert(!requestLauncherMarkBlock.includes("editorMessageBase"),
    "App identity replacement must not call a nonexistent editor message helper");
  assert.match(studioEditor,
    /launcherPreview\?\.addEventListener\("click"[\s\S]{0,300}?requestLauncherMark\(\)/,
    "Selecting the App identity preview must open the mark picker instead of reselecting an unchanged target");
  assert.match(studioEditor,
    /replaceLauncherMarkButton\?\.addEventListener\("click", requestLauncherMark\)/,
    "The preview and Replace mark button must share one working picker path");
  assert(studioEditor.includes('widgets: "appIdentityHelp"')
      && studioEditor.includes('announce(tr("appIdentityHelp"))'),
    "Widgets guidance must describe replacement instead of promising a no-op selection");
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
  for (const locale of ["en", "zh-CN", "zh-HKTW"]) {
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
  assert.match(studioHtml,
    /class="editor-section" data-editor-branch="background" data-editor-targets="background\.canvas background\.layer" aria-labelledby="editor-background-title"/,
    "Background scope must stay visible before or after an image is selected");
  assert.match(studioHtml,
    /data-editor-targets="background\.canvas background\.layer" aria-labelledby="editor-layers-title"[\s\S]{0,1100}?id="editor-add-layer"/,
    "Background must expose Add image on first entry without requiring Image 1");
  assert.match(studioEditor,
    /const scopeRect = backgroundScopeRect\(scope,[\s\S]{0,260}?const backgroundSelected = backgroundScopeUiActive\(inspectorPage,\s*isBuiltInLayoutEdit\(\)\)[\s\S]{0,520}?stageBackgroundSelection\.style\.width/,
    "Background must visibly outline its effective sidebar, main-area, or full-window canvas");
  assert.match(studioEditorCss,
    /\.stage-background-selection\s*\{[^}]*border:\s*2px solid var\(--active-branch-tool\)[^}]*pointer-events:\s*none/,
    "The Background scope outline must be visible without blocking direct canvas controls");
  assert.match(studioEditor,
    /stageScopeZone\("sidebar",\s*"groupSidebar"\)[\s\S]{0,160}?stageScopeZone\("content",\s*"contentCanvas"\)/,
    "The canvas must label the sidebar and main-area preview zones");
  assert.doesNotMatch(studioEditor, /stageScopePicker|backgroundScopeFromPointer/,
    "The preview must not duplicate or silently rewrite the inspector's explicit scope choice");
  assert.doesNotMatch(studioEditorCss, /\.stage-scope-picker/,
    "Removed preview scope controls must not retain a conflicting CSS path");
  const documentDetailsMarkup = studioHtml.slice(
    studioHtml.indexOf('data-editor-workflow-page="details"'),
    studioHtml.indexOf('id="editor-advanced-notice"'),
  );
  assert.equal((documentDetailsMarkup.match(/data-editor-metadata-locale=/g) ?? []).length, 15,
    "Details must offer every canonical Studio locale");
  assert.match(documentDetailsMarkup,
    /value="en" data-editor-metadata-locale="en" checked disabled/,
    "English must be selected and locked as the theme metadata fallback");
  assert.match(documentDetailsMarkup,
    /id="editor-language-picker"[\s\S]*?id="editor-language-selection"[\s\S]*?id="editor-language-options"/,
    "The locale selector must disclose its purpose and summarize the current selection");
  assert.match(documentDetailsMarkup,
    /id="editor-metadata-locales" class="editor-locale-cards"/,
    "Details must reserve one dynamic card host for paired locale fields");
  assert.equal((documentDetailsMarkup.match(/data-editor-metadata="(?:label|description)"/g) ?? []).length, 0,
    "Static metadata fields must not survive beside the generated locale cards");
  assert(!documentDetailsMarkup.includes("advanced-only"),
    "Details metadata must not disappear when the editor level changes");
  for (const locale of [
    "en", "hi", "es", "fr", "id", "ja", "ko", "pt-BR", "de", "it", "vi", "pl", "tr", "zh-CN", "zh-HKTW",
  ]) {
    assert(documentDetailsMarkup.includes(`data-editor-metadata-locale="${locale}"`),
      `Details must expose the ${locale} metadata locale`);
  }
  assert.equal((studioHtml.match(/data-editor-page-target=/g) ?? []).length, 5,
    "The editor must expose exactly five nonlinear workflow pages");
  assert.match(studioHtml,
    /class="editor-inspector-head"[\s\S]{0,7000}?id="editor-quick-feedback"[\s\S]{0,500}?class="editor-inspector-body"/,
    "Blocked-live-apply feedback must remain beside the controls instead of being hidden on Review");
  assert.match(studioHtml,
    /class="editor-section editor-feedback"[^>]+data-editor-workflow-page="review"[\s\S]{0,900}?id="editor-error-summary"[\s\S]{0,500}?id="editor-feedback"[\s\S]{0,500}?id="editor-save"/,
    "Review must retain detailed validation, budgets, and Save");
  assert.match(studioApp,
    /const getThemeCardPreview = \(themeId\) => \{[\s\S]{0,900}?Object\.freeze\(\{ themeId, imageUrl, crop, defaultCrop, label \}\)/,
    "The editor may receive only a frozen card-preview view model, never a source path");
  assert.match(studioApp,
    /const openThemeCardPreview = \(themeId, opener\) => \{[\s\S]{0,500}?openCropEditor\(\{[\s\S]{0,260}?kind: "card"[\s\S]{0,400}?crop: preview\.crop[\s\S]{0,260}?defaultCrop: preview\.defaultCrop/,
    "Details must reuse the existing persistent card-crop transaction");
  const cardPreviewBlock = studioEditor.slice(
    studioEditor.indexOf("const normalizeCardPreview ="),
    studioEditor.indexOf("const option = (value, label)"),
  );
  assert(cardPreviewBlock.includes("https://aura.previews/${value.themeId}.png")
      && cardPreviewBlock.includes("https://aura.assets/${value.themeId}/card-preview.webp")
      && cardPreviewBlock.includes("https://aura.user-themes/${value.themeId}/card-preview.webp")
      && cardPreviewBlock.includes("getThemeCardPreview(state.id)"),
  "Details must reject arbitrary preview URLs and show preview controls only for its saved theme");
  assert.match(studioEditor,
    /if \(state && !isBuiltInLayoutEdit\(\) && typeof getThemeCardPreview === "function"\)[\s\S]{0,700}?cardPreviewPanel\.hidden = !preview/,
    "Preview framing must stay hidden when the current editable theme has no persisted preview master");
  assert(!documentDetailsMarkup.includes('type="file"')
      && !documentDetailsMarkup.includes("pick-theme-preview"),
  "Details must not pretend that preview-photo upload is implemented");
  const metadataInputBlock = studioEditor.slice(
    studioEditor.indexOf("const syncMetadataInputState"),
    studioEditor.indexOf("sharedInputs.forEach"),
  );
  assert(metadataInputBlock.includes('addEventListener("input"')
      && metadataInputBlock.includes("metadataInputInvalid = metadataInputs().some")
      && metadataInputBlock.includes('input.toggleAttribute("aria-invalid", !value)')
      && metadataInputBlock.includes('kind: "metadata"')
      && metadataInputBlock.includes('kind: "metadata-locale"'),
  "Metadata edits must validate and stage while the user types instead of silently retaining an old value");
  assert.match(metadataInputBlock,
    /setStageOverride\(`metadata\.locale\.\$\{locale\}`,\s*enabled\)[\s\S]{0,1800}?queueThemeChanges\(\[[\s\S]{0,160}?kind: "metadata-locale", locale, enabled[\s\S]{0,160}?\], \{ immediate: true \}\)/,
    "Selecting a locale must immediately create or remove its paired persisted draft fields");
  assert.match(studioEditor,
    /if \(!builtInLayout && metadataInputInvalid\)[\s\S]{0,300}?setInspectorPage\("details"[\s\S]{0,300}?focusBelowInspector\(firstInvalidMetadata\)[\s\S]{0,200}?validationMetadataFix/,
    "Save must route an empty required metadata field back to Details");
  assert.match(studioEditorCss,
    /\.editor-view\[data-inspector-page="details"\],\s*\.editor-view\[data-inspector-page="review"\]\s*\{[^}]*--active-branch-tool:\s*var\(--accent\)/,
    "Details and Review must use a stable neutral accent instead of inheriting navigation history");
  assert.match(studioEditorCss,
    /\.editor-mode-support\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s+auto/,
    "Document details must keep the mode choice compact beside its explanation");
  assert.match(studioHtml,
    /class="stage-choice segmented-control editor-mode-support-control"[\s\S]{0,500}?name="editor-details-mode"[\s\S]{0,250}?value="light"[\s\S]{0,300}?name="editor-details-mode"[\s\S]{0,250}?value="dark"/,
    "Document details must let the user select the Light or Dark editing mode");
  assert.match(studioEditor,
    /const modeInputs = \[\.\.\.document\.querySelectorAll\("\[data-editor-mode\]"\)\]/,
    "Both mode selectors must register with the shared preview context");
  assert.match(studioEditor,
    /const syncModeInputs = \(\) => \{[\s\S]{0,160}?input\.checked = input\.value === selectedMode[\s\S]{0,80}?\}/,
    "The canvas and Document details mode choices must stay synchronized");
  assert.match(studioEditorCss,
    /\.stage-toolbar-primary\s*\{[^}]*padding:\s*10px 4px/,
    "The leading Theme mode control needs a locale-independent inset instead of touching the clipped pane edge");
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
  const nativePromptCopy = (await readStudioCopy()).editor;
  for (const locale of STUDIO_LOCALES) {
    assert(String(nativePromptCopy[locale]?.nativePromptHelp ?? "").trim(),
      `${locale} must explain the native Claude layout`);
  }
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
  const promptCommitStagePathsBlock = studioEditor.slice(
    studioEditor.indexOf("const commitStagePaths"),
    studioEditor.indexOf("const flushStageKeyChanges"),
  );
  assert.match(promptCommitStagePathsBlock,
    /const adoptsNativePrompt[\s\S]*?adoptsNativePrompt\s*&&\s*promptKey/,
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
  assert(!/(?:queueThemeChange|queueTokenChange|setStageOverride|apply-theme-patch|revision\s*\+\+|stageSelection\s*=\s*null)/.test(stageContextChangeBlock),
    "Preview-only page changes must create no patch, revision, Undo entry, or silent target reset");
  assert.match(studioHtml,
    /id="editor-switch-supported-preview"[^>]+data-editor-i18n="switchPreview"/,
    "A mismatched new-chat target must offer an explicit supported-preview action");
  const switchPreviewBlock = studioEditor.match(
    /const switchToNewChatPreview\s*=\s*\(\)\s*=>\s*\{[\s\S]*?\n\s*};/)?.[0] ?? "";
  assert.match(switchPreviewBlock,
    /stageContext\s*=\s*"new-chat"[\s\S]{0,180}?selectStageMirror\(\)[\s\S]{0,100}?renderStage\(\)/,
    "The explicit preview action must return a mismatched target to New chat");
  assert(!/(?:queueThemeChange|queueTokenChange|setStageOverride|apply-theme-patch|revision\s*\+\+)/.test(switchPreviewBlock),
    "The explicit preview action must remain preview-only");
  assert.match(studioEditor,
    /switchSupportedPreviewButton\?\.addEventListener\("click", switchToNewChatPreview\)/,
    "The general unavailable-target action must use the preview-only switch");
  assert.match(studioEditor,
    /greetingSwitchPreviewButton\?\.addEventListener\("click", switchToNewChatPreview\)/,
    "Greeting's New-chat-only action must use the preview-only switch");
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
  const showMain = powershellFunction("Show-AuraUiMain");
  assert.match(showMain,
    /WindowState -eq \[System\.Windows\.Forms\.FormWindowState\]::Minimized\)[\s\S]*?AuraLastWindowState[\s\S]*?FormWindowState\]::Maximized[\s\S]*?\.Activate\(\)[\s\S]{0,120}?\.BringToFront\(\)[\s\S]{0,220}?AuraWindow\]::SetForegroundWindow\(\$script:Form\.Handle\)/,
    "The open-aura action must natively restore and foreground the main Aura window");
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
  const appearanceCopy = (await readStudioCopy()).shell;
  for (const locale of STUDIO_LOCALES) {
    for (const key of ["appearanceMode", "appearanceSystem", "appearanceLight", "appearanceDark", "appearanceHelp"]) {
      assert(String(appearanceCopy[locale]?.[key] ?? "").trim(),
        `${locale} is missing Studio appearance copy for ${key}`);
    }
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
  const spaciousShellRule = studioCss.match(/(?:^|\n)\.studio\s*\{([^}]*)\}/)?.[1] ?? "";
  const ordinaryContentRule = studioCss.match(/(?:^|\n)\.content\s*\{([^}]*)\}/)?.[1] ?? "";
  const ordinaryRailRule = studioCss.match(/(?:^|\n)\.rail\s*\{([^}]*)\}/)?.[1] ?? "";
  assert.match(spaciousShellRule,
    /grid-template-columns:\s*232px\s+minmax\(0,\s*1fr\)/,
    "The spacious ordinary Studio shell must retain its full 232px rail");
  assert.match(studioCss,
    /html,\s*body\s*\{[^}]*height:\s*100%[^}]*overflow:\s*hidden/,
    "The document viewport must not become a second page scroller");
  assert.match(spaciousShellRule, /overflow:\s*hidden/,
    "The Studio grid must contain page scrolling within its content track");
  assert.match(ordinaryContentRule, /overflow:\s*auto/,
    "The ordinary .content track must remain Studio's page scroller");
  assert(!/overflow(?:-[xy])?:\s*(?:auto|scroll)/.test(ordinaryRailRule),
    "The full ordinary rail must not compete with .content as a page scroller");
  const spaciousPromptShelf = cssAtRuleBlock(
    studioCss,
    "@media (min-width: 761px)",
  );
  assert.match(spaciousPromptShelf,
    /\.content > \.prompt-shelf-page:not\(\[hidden\]\)\s*\{[^}]*display:\s*flex[^}]*min-height:\s*100%[^}]*flex-direction:\s*column/,
    "A visible spacious Prompt Shelf page must consume the available Studio height");
  assert.match(spaciousPromptShelf,
    /\.content > \.prompt-shelf-page:not\(\[hidden\]\) > \.prompt-shelf-workspace\s*\{[^}]*flex:\s*1 1 auto/,
    "Prompt Shelf workspace must grow with the maximized Studio window");
  assert.match(spaciousPromptShelf,
    /\.content > \.prompt-shelf-page:not\(\[hidden\]\) \.prompt-shelf-list\s*\{[^}]*max-height:\s*none/,
    "The saved-draft list must use spacious height instead of retaining its compact cap");
  assert(!/(?:height:\s*100vh|overflow(?:-[xy])?:\s*(?:auto|scroll))/.test(spaciousPromptShelf),
    "Prompt Shelf growth must preserve .content as the sole page scroller");
  const basePromptShelfList = studioCss.match(
    /(?:^|\n)\.prompt-shelf-list\s*\{([^}]*)\}/,
  )?.[1] ?? "";
  assert.match(basePromptShelfList,
    /min-height:\s*0[\s\S]*?max-height:\s*408px[\s\S]*?flex:\s*1 1 auto[\s\S]*?overflow:\s*auto/,
    "Narrow Prompt Shelf must retain its bounded independently scrollable list");

  const compactShell = cssAtRuleBlock(
    studioCss,
    "@media (max-width: 960px), (max-height: 680px)",
  );
  const tightShell = cssAtRuleBlock(
    studioCss,
    "@media (max-width: 640px), (max-height: 430px)",
  );
  assert.match(compactShell,
    /\.studio:not\(\[data-editor-active="true"\]\)\s*\{[^}]*grid-template-columns:\s*184px\s+minmax\(0,\s*1fr\)/,
    "Compact ordinary Studio must use the intended 184px rail");
  assert.match(compactShell,
    /section \+ section:not\(\.studio-page\)/,
    "Compact density must not restore stacked-section spacing on exclusive pages");
  assert.match(tightShell,
    /\.studio:not\(\[data-editor-active="true"\]\)\s*\{[^}]*grid-template-columns:\s*56px\s+minmax\(0,\s*1fr\)/,
    "Tight ordinary Studio must morph to the intended 56px rail");
  for (const [name, shell] of [["compact", compactShell], ["tight", tightShell]]) {
    assert(shell.includes('.studio:not([data-editor-active="true"])'),
      `The ${name} shell must explicitly exclude the immersive editor`);
    assert(!/\.studio\[data-editor-active="true"\]/.test(shell),
      `The ${name} ordinary-shell mode must not override the active editor`);
  }
  assert.match(tightShell,
    /\.rail-item,[\s\S]{0,160}?\.rail-foot \.ghost-button\s*\{[^}]*width:\s*44px[^}]*min-width:\s*44px[^}]*min-height:\s*44px/,
    "Tight rail links and buttons must retain 44px pointer targets");
  const tightDisclosureRule = tightShell.match(
    /\.rail-item:is\(:hover,\s*:focus-visible\),[\s\S]{0,220}?\.rail-foot \.ghost-button:is\(:hover,\s*:focus-visible\)\s*\{([^}]*)\}/,
  )?.[1] ?? "";
  assert.match(tightDisclosureRule, /font-size:\s*13px/,
    "Tight rail labels must reveal on both pointer hover and keyboard focus");
  const tightDisclosureWidens = /width:\s*max-content/.test(tightDisclosureRule);
  const tightShellReflowsForDisclosure =
    /\.studio:not\(\[data-editor-active="true"\]\):has\(\s*\.rail-item:is\(:hover,\s*:focus-visible\),\s*\.rail-foot \.ghost-button:is\(:hover,\s*:focus-visible\)\s*\)\s*\{[^}]*grid-template-columns:\s*min\(184px,\s*46vw\)\s+minmax\(0,\s*1fr\)/.test(tightShell);
  assert(!tightDisclosureWidens || tightShellReflowsForDisclosure,
    "A tight hover or focus disclosure must reflow the rail track before widening beyond its resting 44px control");
  if (tightDisclosureWidens) {
    assert.match(tightDisclosureRule,
      /max-width:\s*100%[\s\S]*?overflow:\s*hidden[\s\S]*?text-overflow:\s*ellipsis/,
      "A widened tight-rail label must remain bounded by the reflowed rail instead of covering Studio content");
  }
  const railActions = [...(studioHtml.match(/<nav class="rail"[\s\S]*?<\/nav>/)?.[0] ?? "")
    .matchAll(/<(?:a|button)\b[^>]*class="[^"]*(?:rail-item|ghost-button)[^"]*"[^>]*>/g)]
    .map((match) => match[0]);
  assert(railActions.length >= 8, "Studio must retain every ordinary rail action in tight mode");
  for (const action of railActions) {
    assert(/\bdata-(?:editor-)?i18n="[^"]+"/.test(action),
      "A tight rail action must reveal its localized DOM label, not CSS-authored copy");
  }
  const tightEditorShell = cssAtRuleBlock(
    studioEditorCss,
    "@media (max-width: 640px), (max-height: 430px)",
  );
  assert.match(tightEditorShell,
    /\.editor-body\s*\{[^}]*grid-template-columns:\s*minmax\(132px,\s*0\.8fr\)\s+minmax\(176px,\s*1\.2fr\)/,
    "A tight high-DPI viewport must keep the live stage and inspector side by side");
  assert(!/\.editor-body\s*\{[^}]*grid-template-columns:\s*(?:1fr|minmax\(0,\s*1fr\))\s*;/.test(tightEditorShell),
    "The tight high-DPI editor must not collapse into a single stacked column");
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
  const forcedColorsShell = cssAtRuleBlock(studioCss, "@media (forced-colors: active)");
  assert.match(forcedColorsShell,
    /\.studio:not\(\[data-editor-active="true"\]\) \.rail-item:is\(:hover,\s*:focus-visible\),[\s\S]{0,220}?background:\s*Canvas[^}]*color:\s*CanvasText/,
    "Tight localized rail labels must stay visible in Windows forced colors");
  assert.match(forcedColorsShell,
    /\.rail-item::after,[\s\S]{0,160}?\.rail-foot \.ghost-button::after\s*\{[^}]*forced-color-adjust:\s*none/,
    "Tight rail glyphs must retain a deliberate forced-colors treatment");
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
  const auraNavigationCopy = (await readStudioCopy()).shell;
  for (const locale of STUDIO_LOCALES) {
    assert(String(auraNavigationCopy[locale]?.auraWindow ?? "").trim(),
      `${locale} is missing the Studio back-navigation label`);
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
  const metadataLocaleDeclaration = studioApp.match(
    /const hostThemeLocales = new Set\(\[([\s\S]*?)\]\);/,
  )?.[1] ?? "";
  assert.deepEqual(
    [...metadataLocaleDeclaration.matchAll(/"([^"]+)"/g)].map((match) => match[1]),
    STUDIO_LOCALES,
    "Theme metadata selection must use the same canonical locale order as Studio",
  );
  assert.match(studioApp,
    /if \(\(labels === undefined\) !== \(descriptions === undefined\)\) return null;[\s\S]{0,500}?Object\.hasOwn\(labels, "en"\)[\s\S]{0,500}?Object\.hasOwn\(descriptions, locale\)/,
    "Host theme metadata must require English and identical name/description locale sets");
  const syncHostThemesBlock = studioApp.slice(
    studioApp.indexOf("const syncHostThemes ="),
    studioApp.indexOf("const syncBuiltInAuthoringCards"),
  );
  assert.match(syncHostThemesBlock,
    /incomingTheme\.labels === undefined[\s\S]{0,180}?\{ \.\.\.incomingTheme\.labels \}[\s\S]{0,240}?incomingTheme\.descriptions === undefined[\s\S]{0,180}?\{ \.\.\.incomingTheme\.descriptions \}/,
    "A host refresh must replace selected locale maps so a removed language cannot survive in the gallery");
  assert.doesNotMatch(syncHostThemesBlock,
    /\.\.\.\(existing\.(?:labels|descriptions)[\s\S]{0,100}?\.\.\.\(incomingTheme\.(?:labels|descriptions)/,
    "Theme-card refresh must not merge stale localized metadata back into a saved theme");
  assert.match(studioApp, /source !== "builtin"[\s\S]{0,80}?source !== "user"/,
    "Studio must reject unknown host theme sources");
  assert.match(studioApp, /Object\.hasOwn\(themes,\s*incomingTheme\.name\)\s*\?\s*themes\[incomingTheme\.name\]\s*:\s*null/,
    "Studio must treat valid ids such as constructor as own theme keys, not inherited object properties");
  assert.match(studioHtml,
    /class="rail-item is-current"[^>]*data-studio-view="themes"[^>]*aria-current="page"/,
    "Studio must expose the current navigation destination semantically");
  assert.match(studioApp, /removeAttribute\("aria-current"\)/);
  assert.match(studioApp, /setAttribute\("aria-current",\s*"page"\)/);
  const studioViewRouter = studioApp.slice(
    studioApp.indexOf("activateStudioView ="),
    studioApp.indexOf("const focusAdjacentStudioView"),
  );
  assert.match(studioViewRouter,
    /for \(const \[pageView, page\] of ordinaryStudioPages\)[\s\S]{0,300}?page\.hidden = !selected;[\s\S]{0,100}?page\.inert = !selected;[\s\S]{0,120}?classList\.toggle\("is-current-page", selected\)/,
    "A Studio destination must replace the ordinary page instead of scrolling to a stacked section");
  assert.match(studioViewRouter,
    /window\.scrollTo\(0,\s*0\)[\s\S]{0,300}?content\.scrollTo\(\{ top: scrollTop, left: 0, behavior: "auto" \}\)/,
    "Page routing must repair the hidden WebView root scroll and move only Studio content");
  assert.match(studioViewRouter,
    /nextPage\.querySelector\("h1\[tabindex='-1'\], h2\[tabindex='-1'\]"\)[\s\S]{0,180}?heading\.focus\(\{ preventScroll: true \}\)/,
    "Keyboard page changes must announce their destination through a focusable page heading");
  assert.match(studioCss,
    /\.content > \.studio-page\s*\{[^}]*margin-top:\s*0[^}]*padding-top:\s*0[^}]*border-top:\s*0/,
    "Exclusive pages must not retain the separators used by the former stacked document");
  assert.match(studioEditor,
    /const resetStudioViewport[\s\S]{0,300}?history\.replaceState\(null,\s*"",\s*hash\)[\s\S]{0,220}?window\.scrollTo\(0,\s*0\)[\s\S]{0,100}?content\.scrollTop\s*=\s*0/,
    "Editor transitions must reset the hidden outer scroller and the ordinary content pane");
  assert.match(studioEditor,
    /const showEditor[\s\S]{0,480}?resetStudioViewport\("#editor"\)[\s\S]{0,260}?requestAnimationFrame\(\(\)\s*=>\s*\{[\s\S]{0,100}?resetStudioViewport\("#editor"\)/,
    "Opening the editor must reassert its clean viewport after the hidden sections reflow");
  assert.match(studioEditor,
    /const showEditor[\s\S]{0,520}?stageColumn\) stageColumn\.scrollTop\s*=\s*0[\s\S]{0,100}?inspectorBody\) inspectorBody\.scrollTop\s*=\s*0/,
    "Opening the editor must reset both independent pane scrollers");
  assert.match(studioEditor,
    /const ordinaryViewRestored = onOrdinaryViewRestore\?\.\("themes"\) === true;[\s\S]{0,320}?section\.hidden = !selected;[\s\S]{0,100}?section\.inert = !selected/,
    "Closing the editor must return through the ordinary page router with an exclusive Themes fallback");
  assert.match(studioApp,
    /onOrdinaryViewRestore:\s*\(view\) => activateStudioView\(view,[\s\S]{0,180}?restoreScroll:\s*false/,
    "The app shell must remain the sole owner of ordinary page restoration");
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
  const themeCardActions = studioApp.slice(
    studioApp.indexOf("const syncThemeCardActions ="),
    studioApp.indexOf("const removeHostThemeCard ="),
  );
  const exportActionIndex = themeCardActions.indexOf("const exportTerminalThemes");
  assert(exportActionIndex > themeCardActions.indexOf("actions.append(action, remove);")
      && themeCardActions.indexOf("card.appendChild(actions);", exportActionIndex) > exportActionIndex,
  "Every built-in and user theme card must receive the same terminal export action");
  assert.match(themeCardActions,
    /exportTerminalThemes\.dataset\.terminalThemeExport\s*=\s*""[\s\S]{0,360}?exportTerminalThemes\.disabled\s*=\s*terminalThemeExportPending/,
    "Terminal export buttons must share one pending gate");
  assert.match(themeCardActions,
    /setStatus\(t\("terminalThemesExporting"\), "busy"\)[\s\S]{0,180}?send\(\{ type: "export-terminal-themes", theme: theme\.name \}\)/,
    "A theme card must send only the selected theme id after showing localized busy state");
  assert.match(studioApp,
    /const setTerminalThemeExportPending[\s\S]{0,260}?\[data-terminal-theme-export\][\s\S]{0,180}?button\.disabled = terminalThemeExportPending/,
    "All export buttons must remain disabled while either native picker is open");
  assert.match(studioApp,
    /terminalThemeExportPending[\s\S]{0,120}?data\.action === "export-terminal-themes"[\s\S]{0,100}?typeof data\.actionSucceeded === "boolean"[\s\S]{0,420}?terminalThemesExported[\s\S]{0,220}?terminalThemesExportFailed[\s\S]{0,180}?statusReady/,
    "Studio must distinguish path-free export success, failure, and cancellation acknowledgements");
  const terminalExportCopy = (await readStudioCopy()).shell;
  assert.equal(terminalExportCopy.en.terminalThemesExported,
    "Light and Dark terminal theme files saved. Put both in Claude Code's themes folder, then select one with /theme.");
  assert.equal(terminalExportCopy["zh-CN"].terminalThemesExported,
    "浅色和深色终端主题文件已保存。请将两个文件放入 Claude Code 的主题文件夹，然后使用 /theme 选择主题。");
  assert.equal(terminalExportCopy["zh-HKTW"].terminalThemesExported,
    "已儲存淺色與深色終端機主題檔案。請將兩個檔案放入 Claude Code 的主題資料夾，再使用 /theme 選擇主題。");
  assert.match(studioApp, /if \(source === "builtin"\)[\s\S]{0,1200}?type:\s*"create-theme-copy"/,
    "Built-in theme cards must retain duplicate-to-customize in every mode");
  assert.match(studioApp,
    /builtInAuthoring:\s*false[\s\S]*?state\.builtInAuthoring\s*=\s*data\.builtInAuthoring\s*===\s*true/,
    "Built-in authoring must default off and become available only from the host's exact boolean");
  const builtInCardActions = studioApp.slice(
    studioApp.indexOf('if (source === "builtin")'),
    studioApp.indexOf("} else {", studioApp.indexOf('if (source === "builtin")')),
  );
  assert(
    builtInCardActions.indexOf("theme-builtin-layout-action")
      < builtInCardActions.indexOf("duplicateToCustomize"),
    "Permanent layout editing must appear before the safer duplicate path in authoring mode");
  assert.match(builtInCardActions,
    /theme-builtin-layout-action[\s\S]*?editTheme[\s\S]*?builtInTheme[\s\S]*?branchInterfaceDetail[\s\S]*?type:\s*"begin-theme-edit",\s*theme:\s*theme\.name,\s*reset:\s*false/,
    "A host-authorized built-in card must expose an unmistakable layout edit action");
  assert.match(studioApp,
    /actions\.setAttribute\("role",\s*"group"\)[\s\S]{0,320}?quickActions[\s\S]{0,140}?themeLabel/,
    "Repeated card actions must form a group named for their theme");
  assert.match(builtInCardActions,
    /authorLayout\.setAttribute\("aria-label",\s*`\$\{authorLayout\.textContent\}:\s*\$\{themeLabel\}`\)[\s\S]*?action\.setAttribute\("aria-label",\s*`\$\{action\.textContent\}:\s*\$\{themeLabel\}`\)/,
    "Built-in action names must identify the affected theme");
  assert.match(studioHtml,
    /id="built-in-authoring-banner"[^>]+class="built-in-authoring-banner"[^>]+role="status"[^>]+hidden[\s\S]{0,420}?data-editor-i18n="editTheme"[\s\S]*?data-editor-i18n="builtInTheme"[\s\S]*?data-editor-i18n="branchInterfaceDetail"/,
    "The Themes gallery needs a localized source-authoring mode signal");
  assert.match(studioApp,
    /builtInAuthoringBanner\.hidden\s*=\s*!state\.builtInAuthoring/,
    "Only the exact host authoring flag may reveal the gallery mode signal");
  assert.match(studioEditorCss,
    /\.theme-card-actions\.is-builtin-authoring\s*\{[^}]*display:\s*grid[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)[^}]*\}[\s\S]*?\.theme-card-actions\.is-builtin-authoring \.theme-builtin-layout-action\s*\{/,
    "Authoring actions must stack without ambiguous wrapping and emphasize permanent editing");
  assert.match(studioEditorCss,
    /@media \(forced-colors:\s*active\)[\s\S]*?\.built-in-authoring-banner[\s\S]*?background:\s*Canvas/,
    "The authoring signal must keep system color authority");
  assert.match(studioHtml,
    /id="editor-built-in-authoring"[^>]+class="editor-authoring-pill"[^>]+role="status"[^>]+hidden[\s\S]{0,220}?data-editor-i18n="builtInTheme"[\s\S]{0,120}?data-editor-i18n="branchInterfaceDetail"/,
    "Permanent-theme layout authoring needs a persistent localized mode signal");
  assert.match(studioEditor,
    /editor\.dataset\.editKind\s*=\s*"builtin-layout"[\s\S]{0,240}?studioShell\.dataset\.editorKind\s*=\s*"builtin-layout"/,
    "The editor and persistent shell must both identify a built-in layout session");
  assert.match(studioEditor,
    /saveButton\.textContent\s*=\s*builtInLayout[\s\S]{0,120}?saveTheme[\s\S]{0,120}?builtInTheme[\s\S]{0,120}?:\s*tr\("saveTheme"\)/,
    "Built-in saves must be unmistakable while ordinary Save theme copy remains unchanged");
  assert.match(studioEditor,
    /saveButton\.setAttribute\([\s\S]{0,220}?editor-built-in-authoring editor-quick-feedback editor-error-summary[\s\S]{0,160}?editor-quick-feedback editor-error-summary/,
    "Built-in Save must describe its permanent-authoring scope without changing ordinary editing");
  const builtInLayoutCss = studioEditorCss.slice(
    studioEditorCss.indexOf('.editor-view[data-edit-kind="builtin-layout"]'),
    studioEditorCss.indexOf(".editor-live", studioEditorCss.indexOf('.editor-view[data-edit-kind="builtin-layout"]')),
  );
  for (const forbiddenSurface of [
    "#editor-document-details",
    '[data-editor-targets~="interface.theme"]',
    '[data-editor-targets~="background.canvas"]',
    '[data-editor-targets~="widgets.app-identity"]',
    ".editor-greeting-personal",
    "#editor-greeting-reset",
    ".editor-add-artwork",
    ".layer-management-help",
    ".editor-guide-section",
    ".layer-shared-controls",
    "[data-layer-structure]",
    ".stage-opacity",
    ".stage-eye",
  ]) {
    assert(builtInLayoutCss.includes(forbiddenSurface),
      `Built-in layout mode still exposes forbidden surface ${forbiddenSurface}`);
  }
  assert.match(studioEditor,
    /const BUILTIN_LAYOUT_TARGETS = new Set\(\[[\s\S]{0,180}?"interface\.new-chat-area"[\s\S]{0,120}?"interface\.greeting"[\s\S]{0,120}?"background\.layer"/,
    "Built-in layout navigation must contain only prompt, greeting, and existing artwork framing");
  assert.match(studioEditor,
    /const BUILTIN_LAYOUT_LAYER_PROPERTIES = new Set\(\[[\s\S]{0,180}?"anchor"[\s\S]{0,180}?"scale"/,
    "Built-in artwork editing must retain bounded Normal/Wide framing properties");
  assert.match(studioEditor,
    /const builtInLayoutChangeAllowed[\s\S]{0,700}?change\.mode === "shared"[\s\S]{0,180}?change\.kind === "greeting"[\s\S]{0,260}?\["normal", "wide"\]\.includes\(change\.preset\)/,
    "The page-side authoring guard must admit only prompt, greeting presentation, and frame patches");
  assert.match(studioEditor,
    /const completesBuiltInPrompt[\s\S]{0,360}?isBuiltInLayoutEdit\(\)[\s\S]{0,360}?for \(const path of STAGE_PROMPT_PATHS\)[\s\S]{0,360}?promptStateValue\(key\)[\s\S]{0,220}?messages\.push\(messageForStagePath\(path, value\)\)/,
    "Every built-in prompt gesture must send width and both offsets as one complete layout");
  assert.match(studioEditor,
    /if \(isBuiltInLayoutEdit\(\)\)[\s\S]{0,400}?message\.changes\.every\(builtInLayoutChangeAllowed\)[\s\S]{0,220}?return false/,
    "Hidden controls must not be able to post a forbidden permanent-theme mutation");
  assert.match(studioEditor,
    /editor\.dataset\.level\s*=\s*"advanced"[\s\S]{0,700}?setInspectorTarget\("interface\.new-chat-area"\)[\s\S]{0,120}?stageSelection\s*=\s*\{\s*kind:\s*"prompt"\s*\}/,
    "Built-in layout entry must open on a valid, fully exposed layout target");
  const builtInPresentationBlock = studioEditor.slice(
    studioEditor.indexOf("const syncBuiltInLayoutPresentation"),
    studioEditor.indexOf("setInspectorTarget(inspectorTarget)"),
  );
  assert(!builtInPresentationBlock.includes("!CAPABILITY_BRANCHES.includes(inspectorPage)")
      && builtInPresentationBlock.includes("!workflowPageAvailable(inspectorPage)"),
  "Built-in layout authoring must preserve its available Review page instead of forcing Interface");
  assert.match(studioApp, /type:\s*"begin-theme-edit",\s*theme:\s*theme\.name,\s*reset:\s*false/,
    "User theme cards must begin an explicit edit session");
  // The page rejects a whole theme list when one entry carries an unexpected
  // key, so a saved duplicate silently never reaches the gallery if the host
  // and the page disagree on this shape. Keep both sides of the wire in step.
  const themeMetadataBody = powershellFunction("ConvertTo-AuraUiThemeMetadata");
  const hostMetadataKeys = [...themeMetadataBody
    .slice(themeMetadataBody.indexOf("[PSCustomObject]@{"))
    .matchAll(/^\s{4}([A-Za-z][A-Za-z0-9]*)\s*=/gm)].map((match) => match[1]);
  assert(hostMetadataKeys.length > 0, "The host theme metadata shape could not be read");
  const pageThemeKeys = [...(studioApp.match(/const hostThemeKeys = new Set\(\[[\s\S]*?\]\)/) ?? [""])[0]
    .matchAll(/"([a-zA-Z]+)"/g)].map((match) => match[1]);
  assert.deepEqual(hostMetadataKeys.slice().sort(), pageThemeKeys.slice().sort(),
    "Every theme field the host posts must be one the Studio page accepts, and vice versa");
  assert.match(studioApp,
    /value\.studioPreview !== null && !studioPreviewUrl[\s\S]{0,400}?value\.studioPreviewFrame !== undefined && value\.studioPreviewFrame !== null/,
    "A theme with no card preview must normalize as unframed instead of invalidating the whole posted list");
  assert.match(studioEditor, /send\(\{\s*type:\s*"delete-user-theme",\s*theme\s*\}\)/,
    "User theme deletion must send only the validated theme id");
  assert.match(studioEditor, /\["launcher-mark",\s*"slotLauncherMark"\]/,
    "The local customization prompt builder must offer the app and launcher mark slot");
  const localizedLauncherCopy = (await readStudioCopy()).editor;
  for (const locale of STUDIO_LOCALES) {
    const launcherPrompt = String(localizedLauncherCopy[locale]?.launcherPromptTemplate ?? "");
    assert(/96\u00d796/.test(launcherPrompt) && /72\u00d772/.test(launcherPrompt),
      `${locale} launcher prompt must name the exact output size and compact safe area`);
  }
  for (const locale of STUDIO_LOCALES) {
    const launcherRule = String(localizedLauncherCopy[locale]?.promptRuleLauncher ?? "");
    assert(launcherRule.trim(), `${locale} launcher prompt must explain its app-identity role`);
  }
  assert.match(String(localizedLauncherCopy.en?.promptRuleLauncher ?? ""), /title bar/i,
    "The English launcher prompt must explain that one theme mark serves the complete app identity");

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
  const commitStagePathsBlock = studioEditor.match(
    /const commitStagePaths\s*=\s*\(paths\)\s*=>\s*\{[\s\S]*?\n\s*};/,
  )?.[0] ?? "";
  assert.match(commitStagePathsBlock,
    /Math\.abs\(value - saved\) < 0\.00005\)\s*\{[\s\S]{0,100}?stageOverrides\.delete\(path\)/,
    "Returning a gesture to its saved value must clear stale Customized provenance");
  const endStageDragBlock = studioEditor.match(
    /const endStageDrag\s*=\s*\(event\)\s*=>\s*\{[\s\S]*?\n\s*};/,
  )?.[0] ?? "";
  assert.match(endStageDragBlock,
    /commitStagePaths\(drag\.paths\)[\s\S]{0,100}?renderStage\(\)[\s\S]{0,100}?refreshInspectorContext\(\)/,
    "Ending a no-op gesture must refresh provenance after local overrides are cleared");
  const stageEscapeBlock = studioEditor.match(
    /if \(event\.key === "Escape"\) \{[\s\S]*?}\s*const step =/,
  )?.[0] ?? "";
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
  assert.match(studioEditor,
    /const settlement = settlePendingAction\(normalized\)[\s\S]{0,180}?clearSettledStageOverrides\(\)[\s\S]{0,120}?reflect\(/,
    "Undo, Redo, and Reset must clear settled preview overrides before controls reflect host state");
  assert.match(studioEditor,
    /const clearSettledStageOverrides[\s\S]{0,180}?!stageDrag[\s\S]{0,260}?!inFlightChanges\.length[\s\S]{0,180}?stageOverrides\.clear\(\)/,
    "Active drags and unsettled live or keyboard work must retain their local preview overrides");
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
  assert.match(studioEditor,
    /const duplicatesConfirmedTokenChange[\s\S]{0,260}?inFlightChanges\.find[\s\S]{0,260}?reconcileDuplicateTokenValue\([\s\S]{0,260}?confirmedTokenValue\(change\)/,
    "Returning to the in-flight or confirmed value must cancel a duplicate patch and Undo step");
  assert.match(studioEditor,
    /const confirmedTokenValue[\s\S]{0,360}?state\?\.shared\?\.inherited\?\.\[change\.token\]\) return undefined/,
    "Choosing an inherited effective value must still persist an explicit control override");
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
    /window\.CLAUDE_AURA_EDITOR\s*=\s*Object\.freeze\(\{\s*createController,\s*normalizeEditorState,\s*normalizeStudioStyle,\s*normalizeCapabilityRegistry,\s*reconcileDuplicateTokenValue,\s*backgroundScopeUiActive,\s*capabilityRegistry:\s*EDITOR_CAPABILITY_REGISTRY,?\s*\}\)/,
    "The editor module must expose its controller, strict validators, and read-only capability registry");

  const editorActionMatch = studioEditor.match(/const ACTIONS\s*=\s*new Set\(\[([\s\S]*?)\]\);/);
  assert(editorActionMatch, "The editor action allowlist is missing");
  assert.deepEqual([...editorActionMatch[1].matchAll(/["']([^"']+)["']/g)].map((match) => match[1]),
    Object.keys(expectedEditorMessageShapes),
  "The editor page and Windows host must share the exact editor action allowlist");

  // A lost host reply used to strand `pendingAction` forever, and flushThemeChanges
  // then queued every later edit without ever sending it: the editor looked alive
  // while silently discarding the user's work. The watchdog must recover the session.
  const pendingWatchdogBlock = studioEditor.match(/const setPending = \([\s\S]*?\n    \};/)?.[0] ?? "";
  assert(pendingWatchdogBlock, "the editor pending-action gate could not be isolated");
  assert.match(pendingWatchdogBlock, /pendingWatchdog = setTimeout\(/,
    "a pending editor action must arm a watchdog so a lost reply cannot strand the session");
  assert.match(pendingWatchdogBlock, /requeueInFlightChanges\(\)[\s\S]{0,120}?flushThemeChanges\(\)/,
    "a timed-out action must requeue its in-flight changes and flush them again");
  assert.match(pendingWatchdogBlock, /WATCHDOG_EXEMPT_ACTIONS\.has\(action\)/,
    "file-picker actions wait on the user and must be exempt from the watchdog");
  assert.match(studioEditor,
    /WATCHDOG_EXEMPT_ACTIONS = new Set\(\["pick-theme-layer-image", "pick-theme-launcher-mark"\]\)/,
    "only the two picker actions may skip the pending-action watchdog");

  assert.match(studioEditor,
    /const STRINGS = Object\.fromEntries\(\s*Object\.entries\(window\.CLAUDE_AURA_STRINGS \?\? \{\}\)/,
    "Editor copy must come from the per-language files in studio/locales");
  const studioCopy = await readStudioCopy();
  const editorStrings = studioCopy.editor;
  assert.deepEqual(studioCopy.locales.sort(), STUDIO_LOCALES.slice().sort());
  const editorCopyKeys = Object.keys(editorStrings.en).sort();
  assert(editorCopyKeys.length >= 180, "The editor locale surface is unexpectedly incomplete");
  for (const locale of STUDIO_LOCALES.filter((locale) => locale !== "en")) {
    assert.deepEqual(Object.keys(editorStrings[locale]).sort(), editorCopyKeys,
      `${locale} editor copy does not cover the same UI states as English`);
    for (const key of editorCopyKeys) assert(String(editorStrings[locale][key]).trim(), `${locale}.${key} is empty`);
  }
  assert.equal(editorStrings["zh-CN"].interfaceFont, "界面字体");
  assert.equal(editorStrings["zh-CN"].addLayer, "添加图层");
  assert.equal(editorStrings["zh-CN"].saveTheme, "保存主题");
  assert.equal(editorStrings["zh-CN"].fullWindow, "整个窗口");
  assert.equal(editorStrings["zh-CN"].targetInterfaceTheme, "常规");
  assert.equal(editorStrings["zh-HKTW"].interfaceFont, "介面字體");
  assert.equal(editorStrings["zh-HKTW"].addLayer, "新增圖層");
  assert.equal(editorStrings["zh-HKTW"].saveTheme, "儲存主題");
  assert.equal(editorStrings["zh-HKTW"].fullWindow, "整個視窗");
  assert.equal(editorStrings["zh-HKTW"].targetInterfaceTheme, "一般");
  assert.equal(editorStrings.en.targetInterfaceTheme, "General");
  assert.notEqual(editorStrings["zh-CN"].guideOnlyNotice, editorStrings["zh-HKTW"].guideOnlyNotice,
    "Simplified and Traditional Chinese editor guidance must remain independently authored");
  assert.match(editorStrings.en.stageContextMismatch, /Open \{0} in Aura once[\s\S]*editing session/);
  assert.match(editorStrings["zh-CN"].stageContextMismatch, /Aura[\s\S]*打开一次\{0}[\s\S]*本次编辑/);
  assert.match(editorStrings["zh-HKTW"].stageContextMismatch, /Aura[\s\S]*開啟一次\{0}[\s\S]*這次編輯/);

  assert.match(studioHtml, /id="nav-editor"[^>]+href="#editor"[^>]+hidden/,
    "The editor navigation destination must appear only during an active edit session");
  assert.equal((studioHtml.match(/type="radio" name="editor-mode"/g) ?? []).length, 2,
    "The preview toolbar must use native Light and Dark radio controls");
  assert.equal((studioHtml.match(/type="radio" name="editor-details-mode"/g) ?? []).length, 2,
    "Document details must repeat the native Light and Dark radio controls");
  assert.equal((studioHtml.match(/data-editor-mode/g) ?? []).length, 4,
    "Both mode selectors must participate in the synchronized editor context");
  assert((studioHtml.match(/class="[^"]*segmented-control[^"]*"/g) ?? []).length >= 4,
    "Closely related preview and editor-mode choices must share one quiet segmented-control language");
  assert.match(studioEditorCss,
    /\.segmented-control input\s*\{[^}]*position:\s*absolute[^}]*clip-path:\s*inset\(50%\)/,
    "Segmented controls must retain native focusable radios while hiding redundant radio dots visually");
  assert.match(studioEditorCss,
    /\.segmented-control label:has\(input:focus-visible\)\s*\{[^}]*outline:\s*3px solid var\(--ring\)/,
    "The de-boxed segmented controls must keep an explicit keyboard focus treatment");
  assert.equal((studioHtml.match(/type="radio" name="background-scope"/g) ?? []).length, 3,
    "The editor must use native Sidebar, Main area only, and Entire window radio controls");
  assert.match(studioHtml,
    /value="sidebar"[\s\S]{0,220}?data-editor-i18n="groupSidebar">Sidebar<\/span>[\s\S]{0,500}?data-editor-i18n="contentCanvas">Main area only<\/span>[\s\S]{0,500}?data-editor-i18n="fullWindow">Entire window<\/span>/,
    "The no-script fallback must use the same background-scope labels as the English editor");
  for (const control of [
    "editor-font-ui", "editor-font-display", "editor-radius", "editor-blur", "editor-shadow",
    "editor-prompt-width", "editor-prompt-x", "editor-prompt-y", "editor-undo", "editor-redo",
    "editor-reset", "editor-add-layer", "editor-back", "editor-cancel", "editor-save",
  ]) assert(studioHtml.includes(`id="${control}"`), `Editor is missing the native ${control} control`);
  assert.equal((studioHtml.match(/id="editor-save"/g) ?? []).length, 1,
    "The Review-owned Save action must be unique");
  assert.match(studioHtml,
    /id="editor-document-details"[\s\S]{0,3200}?id="editor-language-picker"[\s\S]{0,500}?data-editor-i18n="themeLanguagesHelp"/,
    "Quick customize must expose selectable localized identity through Document details");
  assert.match(studioHtml,
    /id="editor-document-details-toggle"[^>]+data-editor-page-target="details"[^>]+aria-pressed="false"[^>]+aria-controls="editor-document-details"/,
    "Details must be a persistent workflow-page button");
  assert(!studioHtml.includes('id="editor-document-details-toggle" class="editor-inspector-tab" data-editor-page-target="details" aria-pressed="false" aria-expanded=')
      && !studioEditor.includes('documentDetailsPanel?.addEventListener("keydown"'),
  "Details must not retain disclosure-only aria-expanded or Escape-to-close behavior");
  assert.match(studioHtml,
    /class="editor-section editor-prompt-context" data-editor-branch="interface" data-editor-targets="interface\.new-chat-area"/,
    "Canvas selection must route the new-chat area to its Interface target in both editor levels");
  const metadataCardBlock = studioEditor.slice(
    studioEditor.indexOf("const renderMetadataLocales"),
    studioEditor.indexOf("const reflectMetadata"),
  );
  assert.match(metadataCardBlock,
    /nameInput\.maxLength = 80[\s\S]{0,300}?nameInput\.dataset\.editorMetadata = "label"/,
    "Generated theme names must keep the localized 80-character metadata contract");
  assert.match(metadataCardBlock,
    /descriptionInput\.maxLength = 220[\s\S]{0,300}?descriptionInput\.dataset\.editorMetadata = "description"/,
    "Generated theme descriptions must keep the localized 220-character metadata contract");
  assert.match(metadataCardBlock,
    /selectedMetadataLocales\(\)[\s\S]{0,900}?editor-locale-card[\s\S]{0,1800}?editor-locale-card-fields/,
    "Every selected locale must render one card that keeps its Name and Description together");
  const metadataChangeBlock = studioEditor.slice(
    studioEditor.indexOf("metadataLocalesHost?.addEventListener"),
    studioEditor.indexOf("sharedInputs.forEach"),
  );
  assert.match(metadataChangeBlock, /queueThemeChange\s*\(\s*\{[\s\S]{0,120}?kind:\s*"metadata"/,
    "Localized identity edits must use the same lossless mutation queue as visual controls");
  assert.match(metadataChangeBlock, /editorMetadata[\s\S]{0,360}?editorLocale/,
    "Localized identity edits must preserve the allowlisted metadata field and locale");
  assert.match(metadataChangeBlock,
    /metadataLocaleOptions\?\.addEventListener\("change"[\s\S]{0,3000}?kind: "metadata-locale"/,
    "The language selector must use the same Undo-aware mutation queue");
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
      && /id="editor-stage"[^>]+aria-describedby="[^"]*\bstage-privacy\b[^"]*"/.test(studioHtml),
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
  assert.match(focusErrorBlock,
    /CONTRAST_FOCUS_TOKENS\[contrast\[2\]\][\s\S]{0,320}?candidates\.includes\(activeToken\) \? activeToken : candidates\[0\]/,
    "Contrast recovery must retain the implicated color the user just edited when it is one side of the failing pair");
  const focusBelowInspectorBlock = studioEditor.match(
    /const focusBelowInspector\s*=\s*\([\s\S]*?\n\s*};/)?.[0] ?? "";
  assert.match(focusBelowInspectorBlock, /focus\(\{\s*preventScroll:\s*true\s*}\)/,
    "Validation focus must suppress the browser's sticky-header-obscured scroll position");
  assert.match(focusBelowInspectorBlock, /revealWithinInspector\(target\)/,
    "Validation recovery and target navigation must share one viewport reveal path");
  const revealDeltaSource = studioEditor.match(
    /const inspectorRevealDelta\s*=\s*\(rect,\s*visibleTop,\s*visibleBottom\)\s*=>\s*\{[\s\S]*?\n\s*};/,
  )?.[0] ?? "";
  assert(revealDeltaSource, "Inspector reveal geometry helper is missing");
  const inspectorRevealDelta = Function(
    `${revealDeltaSource}; return inspectorRevealDelta;`,
  )();
  assert.equal(inspectorRevealDelta({ top: 32, bottom: 60 }, 20, 100), 0);
  assert.equal(inspectorRevealDelta({ top: 8, bottom: 30 }, 20, 100), -12);
  assert.equal(inspectorRevealDelta({ top: 90, bottom: 118 }, 20, 100), 18,
    "A target below the inspector viewport must scroll downward into view");
  assert.match(studioEditor, /(?:function|const)\s+validationMessageFor\b/,
    "Validation summaries must translate safe error categories into recovery guidance");
  assert(!/format\(tr\("validationIssue"\),\s*first\.field\)/.test(studioEditor),
    "Quick validation must not expose raw schema paths to casual users");
  assert.match(studioEditor, /queueTokenChange\("mode-copy",\s*"tokens",\s*"light"\)/);
  assert.match(studioEditor, /queueTokenChange\("mode-copy",\s*"tokens",\s*"dark"\)/,
    "Light and Dark token-copy conveniences must use validated bridge enums");
  assert.match(studioEditor,
    /const setBackgroundScope\s*=[\s\S]{0,900}?queueTokenChange\("shared",\s*"backgroundScope",\s*scope\)/,
    "Canvas choices and native radios must share the validated background-scope route");
  const buildTokenControlsBlock = studioEditor.match(
    /const buildTokenControls\s*=\s*\(\)\s*=>\s*\{[\s\S]*?\n\s*};/,
  )?.[0] ?? "";
  assert.match(buildTokenControlsBlock,
    /picker\.addEventListener\("input"[\s\S]{0,360}?queueTokenChange\(selectedMode,\s*token/);
  assert.match(buildTokenControlsBlock,
    /range\.addEventListener\("input"[\s\S]{0,360}?queueTokenChange\(selectedMode,\s*token/,
    "Valid color and opacity drags must reach Aura through the coalesced live mutation queue");
  assert.match(studioEditor,
    /sharedInputs\.forEach[\s\S]{0,700}?input\.addEventListener\("input"[\s\S]{0,360}?queueTokenChange\("shared",\s*key,\s*input\.valueAsNumber\)/,
    "Valid material sliders must reach Aura while they are dragged");
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
    /const localGreetingWork\s*=\s*!builtInLayout\s*&&\s*\(greetingPreferenceDraftDirty\s*\|\|\s*greetingPreferenceInputDirty\)/,
    "Ordinary theme saves must treat greeting drafts and invalid input as local work without leaking personal data into built-ins");
  assert.match(studioEditor,
    /saveButton\.disabled\s*=\s*busy[\s\S]{0,180}?state\.feedback\.valid[\s\S]{0,140}?!state\.dirty\s*&&\s*!localEditorWork\s*&&\s*!state\.isNew/,
    "A fresh duplicate and an invalid draft must keep Save actionable for saving or issue recovery");
  assert.match(studioHtml,
    /id="editor-save"[^>]+aria-describedby="editor-quick-feedback editor-error-summary"/,
    "The persistent Save action must expose its nearby validation explanation");
  const saveHandlerBlock = studioEditor.match(
    /const performSave\s*=\s*\(\)\s*=>\s*\{[\s\S]*?\n\s*};/)?.[0] ?? "";
  assert.match(studioEditor, /saveButton\.addEventListener\("click",\s*performSave\)/,
    "The Save button must invoke the shared save handler so click and keyboard save behave identically");
  assert.match(saveHandlerBlock,
    /!state\?\.feedback\.valid[\s\S]{0,500}?focusBelowInspector\(errorSummary\)[\s\S]{0,120}?announce\(tr\("saveBlocked"\),\s*"error"\)/,
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
    /const signature = layerRenderSignature\(\);\s*if \(signature === renderedLayerSignature && layerList\.querySelector\(".layer-card"\)\) \{\s*refreshInspectorContext\(\);\s*return;\s*\}/,
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
  const followMirrorAxesBlock = studioEditor.match(
    /const followLiveMirrorAxes\s*=\s*\([\s\S]*?\n\s*};/,
  )?.[0] ?? "";
  assert.match(studioEditor,
    /exactShape\(value,\s*\["type",\s*"image",\s*"width",\s*"height",\s*"revision",\s*"request",\s*"sizing"\],\s*\["geometry"\]\)/,
    "Studio must require the exact mirror identity, CSS dimensions, request, and sizing envelope");
  assert.match(studioEditor,
    /exactShape\(value,\s*\[\s*"requestedWidth",\s*"requestedHeight",\s*"actualWidth",\s*"actualHeight",\s*"nativeWidth",\s*"nativeHeight",\s*"dpr",\s*"settled",\s*\]\)/,
    "Mirror sizing must use one closed requested-CSS, actual-CSS, native-pixel, DPR, and settled shape");
  assert.match(studioEditor,
    /exactShape\(value\.geometry,\s*\["context",\s*"mode",\s*"viewport",\s*"main",\s*"prompt",\s*"greeting"\]\)[\s\S]{0,360}?enumValue\(value\.geometry\.viewport,\s*\["normal",\s*"wide"\]\)/,
    "Studio must require an exact renderer-provided normal/wide viewport on measured geometry");
  assert.match(receiveMirrorBlock,
    /mirror\.revision\s*!==\s*state\?\.revision[\s\S]{0,180}?mirror\.request\s*!==\s*previewExpectedRequest[\s\S]{0,180}?previewSizeEditing[\s\S]{0,260}?mirror\.sizing\.requestedWidth\s*!==\s*previewSizeIntent\[0\][\s\S]{0,100}?mirror\.sizing\.requestedHeight\s*!==\s*previewSizeIntent\[1\]/,
    "Preview acknowledgement must validate the requested CSS intent carried by the sizing envelope");
  assert(!/mirror\.sizing\.native(?:Width|Height)\s*!==\s*previewSizeIntent/.test(receiveMirrorBlock),
    "Preview acknowledgement must never compare native pixels with a CSS-pixel request");

  const normalizeMirrorRectBlock = studioEditor.match(
    /const normalizeMirrorRect\s*=\s*\(value\)\s*=>\s*\{[\s\S]*?\n\s{4}};/,
  )?.[0] ?? "";
  const normalizeMirrorSizingBlock = studioEditor.match(
    /const normalizeMirrorSizing\s*=\s*\(value,\s*width,\s*height\)\s*=>\s*\{[\s\S]*?\n\s{4}};/,
  )?.[0] ?? "";
  const normalizeMirrorBlock = studioEditor.match(
    /const normalizeMirror\s*=\s*\(value\)\s*=>\s*\{[\s\S]*?\n\s{4}};/,
  )?.[0] ?? "";
  assert(normalizeMirrorRectBlock && normalizeMirrorSizingBlock && normalizeMirrorBlock && receiveMirrorBlock,
    "Studio must expose extractable mirror validation and receive functions");
  const mirrorHarness = Function(`
    "use strict";
    const plainRecord = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
    const finite = (value) => typeof value === "number" && Number.isFinite(value);
    const inRange = (value, minimum, maximum) => finite(value) && value >= minimum && value <= maximum;
    const integer = (value, minimum, maximum) => Number.isInteger(value) && value >= minimum && value <= maximum;
    const exactShape = (value, required, optional = []) => {
      if (!plainRecord(value)) return false;
      const allowed = new Set([...required, ...optional]);
      const keys = Object.keys(value);
      return required.every((key) => Object.hasOwn(value, key))
        && keys.every((key) => allowed.has(key));
    };
    const enumValue = (value, values) => typeof value === "string" && values.includes(value);
    const MIRROR_PREFIX = "data:image/jpeg;base64,";
    const MIRROR_MAX_RAW_BYTES = 8_000_000;
    const MIRROR_MAX_BASE64_LENGTH = Math.ceil(MIRROR_MAX_RAW_BYTES / 3) * 4;
    ${normalizeMirrorRectBlock}
    ${normalizeMirrorSizingBlock}
    ${normalizeMirrorBlock}
    let state = { revision: 17 };
    let previewExpectedRequest = 41;
    let previewSizeEditing = true;
    let previewSizeIntent = [1180, 640];
    let stageLiveMirror = null;
    let stagePreviewSize = [0, 0];
    let reflectedPreviewSize = [0, 0];
    let rememberedMirror = null;
    const rememberStageMirror = (mirror) => { rememberedMirror = mirror; };
    const setPreviewInputValues = (width, height) => { reflectedPreviewSize = [width, height]; };
    const backdropToggleInput = { checked: false };
    ${receiveMirrorBlock}
    return {
      normalizeMirror,
      receiveMirror,
      reset(intent = [1180, 640], request = 41) {
        previewExpectedRequest = request;
        previewSizeEditing = true;
        previewSizeIntent = intent;
        stageLiveMirror = null;
        stagePreviewSize = [0, 0];
        reflectedPreviewSize = [0, 0];
        rememberedMirror = null;
      },
      snapshot() {
        return {
          previewExpectedRequest,
          previewSizeEditing,
          previewSizeIntent,
          stagePreviewSize,
          reflectedPreviewSize,
          rememberedMirror,
        };
      },
    };
  `)();
  const highDpiMirror = {
    type: "aura-mirror",
    image: "data:image/jpeg;base64,AA==",
    width: 1180,
    height: 640,
    revision: 17,
    request: 41,
    sizing: {
      requestedWidth: 1180,
      requestedHeight: 640,
      actualWidth: 1180,
      actualHeight: 640,
      nativeWidth: 2360,
      nativeHeight: 1280,
      dpr: 2,
      settled: true,
    },
  };
  assert.deepEqual(mirrorHarness.normalizeMirror(highDpiMirror)?.sizing, highDpiMirror.sizing,
    "Studio must retain truthful CSS and 2x native mirror dimensions");
  assert.equal(mirrorHarness.normalizeMirror({
    ...highDpiMirror,
    sizing: { ...highDpiMirror.sizing, extra: true },
  }), null, "Studio must reject extra mirror-sizing fields");
  assert.equal(mirrorHarness.normalizeMirror({
    ...highDpiMirror,
    sizing: { ...highDpiMirror.sizing, actualWidth: 1179 },
  }), null, "Studio must reject sizing dimensions that disagree with the captured CSS frame");
  assert.equal(mirrorHarness.normalizeMirror({
    ...highDpiMirror,
    sizing: { ...highDpiMirror.sizing, requestedHeight: null },
  }), null, "Studio must reject a half-present requested CSS size");
  assert.equal(mirrorHarness.normalizeMirror({ ...highDpiMirror, unexpected: true }), null,
    "Studio must reject extra mirror-envelope fields");
  mirrorHarness.reset();
  assert.equal(mirrorHarness.receiveMirror(highDpiMirror), true,
    "A truthful 1180x640 CSS mirror must be accepted when its native capture is 2360x1280");
  assert.deepEqual(mirrorHarness.snapshot().stagePreviewSize, [1180, 640],
    "The editor stage must follow the accepted CSS dimensions, not native capture pixels");
  assert.equal(mirrorHarness.snapshot().previewSizeEditing, false,
    "A matching requested CSS intent must settle the pending preview edit");
  mirrorHarness.reset();
  assert.equal(mirrorHarness.receiveMirror({
    ...highDpiMirror,
    sizing: {
      ...highDpiMirror.sizing,
      requestedWidth: 2360,
      requestedHeight: 1280,
    },
  }), false, "Native-sized requested dimensions must not acknowledge a 1180x640 CSS request");
  assert.equal(mirrorHarness.snapshot().previewSizeEditing, true,
    "A mismatched requested CSS intent must remain pending");
  assert.match(studioEditor,
    /const schedulePreviewSize[\s\S]{0,180}?clearTimeout\(previewResizeTimer\)[\s\S]{0,180}?if\s*\(!dimensions\)\s*\{[\s\S]{0,80}?previewSizeIntent\s*=\s*null[\s\S]{0,80}?previewExpectedRequest\s*=\s*null[\s\S]{0,40}?return/,
    "An invalid intermediate dimension must cancel its old commit and reject mirrors instead of retaining a stale size intent");
  assert.match(studioEditor,
    /const sendPreviewSize[\s\S]{0,260}?previewExpectedRequest\s*=\s*request[\s\S]{0,160}?type:\s*"set-aura-preview",\s*size,\s*request/,
    "Every size including maximized must stay guarded until its exact host request is captured");
  assert.match(followMirrorAxesBlock,
    /!stageContextTouched[\s\S]{0,140}?stageContext\s*=\s*realContext/,
    "The first asynchronous live capture must not overwrite an explicit page selection");
  assert.match(receiveMirrorBlock,
    /!hasUsableMirrorGeometry\(mirror\)[\s\S]{0,180}?stageMirror\s*=\s*null[\s\S]*?followLiveMirrorAxes\(mirror/,
    "Studio must fall back from missing geometry and otherwise use the renderer's exact viewport");
  assert.match(followMirrorAxesBlock, /stageViewport\s*=\s*mirror\.geometry\.viewport/,
    "The live-axis helper must use the renderer's exact viewport");
  assert(!/mirror(?:\.|\?\.)width\s*>=\s*1440/.test(studioEditor),
    "Studio must not guess the renderer's viewport from mirror width");
  assert.match(receiveMirrorBlock, /rememberStageMirror\(mirror\)[\s\S]*?selectStageMirror\(\)/,
    "A validated live capture must be cached before resolving the selected page preview");
  assert.match(studioEditor,
    /const priorLayerIds = new Set\([\s\S]{0,260}?const pickedLayerId = pendingAction === "pick-theme-layer-image"[\s\S]{0,1600}?state = normalized;[\s\S]{0,100}?selectedLayerId = pickedLayerId/,
    "A newly added image must become the selected image instead of reopening Image 1");
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
  const stageEvidenceCopy = (await readStudioCopy()).editor;
  for (const locale of STUDIO_LOCALES) {
    assert(String(stageEvidenceCopy[locale]?.stageEvidence ?? "").trim(),
      `${locale} is missing the visible stage caveat`);
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
    /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.editor-stagecol,\s*\.editor-inspector-body\s*\{[^}]*scroll-behavior:\s*auto/,
    "Independent editor panes must not smooth-scroll when reduced motion is requested");
  const studioClientSize = ui.match(/\$script:StudioForm\.ClientSize\s*=\s*\[Drawing\.Size\]::new\((\d+),\s*(\d+)\)/);
  assert.deepEqual(studioClientSize?.slice(1), ["1080", "720"],
    "Studio's normal client size must remain the layout acceptance viewport");
  const editorBodyRule = studioEditorCss.match(/\.editor-body\s*\{([^}]*)\}/)?.[1] ?? "";
  assert.match(editorBodyRule,
    /grid-template-columns:\s*minmax\(340px,\s*1fr\)\s+clamp\(272px,\s*32vw,\s*510px\)/,
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
  assert.match(editorControlsRule,
    /display:\s*grid[\s\S]*?grid-template-rows:\s*auto\s+minmax\(0,\s*1fr\)/,
    "The inspector shell must reserve a fixed header row above its bounded content row");
  assert(!/overflow(?:-[xy])?\s*:\s*(?:auto|scroll)\b/.test(editorControlsRule),
    "The inspector shell must not paint a scrollbar through its persistent header");
  assert.match(editorControlsRule, /padding-top:\s*22px/,
    "Initial inspector spacing must remain outside the persistent header");
  assert.match(editorControlsRule, /container:\s*theme-inspector\s*\/\s*inline-size/,
    "Inspector density must respond to the inspector itself rather than the outer window");
  const inspectorBodyRule = studioEditorCss.match(/\.editor-inspector-body\s*\{([^}]*)\}/)?.[1] ?? "";
  assert.match(inspectorBodyRule,
    /min-height:\s*0[\s\S]*?overflow-y:\s*auto[\s\S]*?overscroll-behavior:\s*contain[\s\S]*?scrollbar-gutter:\s*stable/,
    "Only the inspector body may scroll beneath the persistent action header");
  assert.match(inspectorBodyRule, /scroll-padding-block:\s*12px/,
    "Inspector focus and reveal movement must retain breathing room at both scroll edges");
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
  assert.match(studioHtml, /<div class="editor-inspector-head">[\s\S]*?class="editor-inspector-nav"/,
    "Quick customize and Advanced navigation must share one measured fixed inspector header with the level switch");
  const inspectorNavRule = [
    ...studioEditorCss.matchAll(/\.editor-inspector-nav\s*\{([^}]*)\}/g),
  ].map((match) => match[1]).find((rule) => /repeat\(5,\s*minmax\(0,\s*1fr\)\)/.test(rule)) ?? "";
  assert(!/position:\s*sticky/.test(inspectorNavRule) && !/top:\s*108px/.test(inspectorNavRule),
    "Stage navigation must not use a hard-coded sticky offset that can cover controls");
  assert.match(inspectorNavRule, /repeat\(5,\s*minmax\(0,\s*1fr\)\)/,
    "All five labeled stages must share one equal route at every supported inspector width");
  assert.doesNotMatch(studioEditorCss,
    /\.editor-inspector-tab:nth-child\([^)]*\)\s*\{[^}]*grid-column:\s*span|@container theme-inspector \(min-width: 620px\)/,
    "The narrow inspector must not fall back to the uneven two-plus-three stage mosaic");
  assert.match(studioEditorCss,
    /--branch-interface:\s*#[0-9a-f]{6}[\s\S]{0,120}?--branch-background:\s*#[0-9a-f]{6}[\s\S]{0,120}?--branch-widgets:\s*#[0-9a-f]{6}/i,
    "The three tools must keep stable, distinct orientation cues across Studio themes");
  assert.match(studioEditorCss,
    /\.editor-inspector-tab\[aria-pressed="true"\]\s+\.editor-branch-glyph\s*\{[^}]*background:\s*var\(--branch-tool\)/,
    "The active stage must retain a recognizable filled glyph");
  assert.match(studioEditorCss,
    /\.editor-inspector-tab\[aria-pressed="true"\]\s*\{[^}]*box-shadow:\s*inset 0 -3px var\(--branch-tool\)/,
    "The active stage must mark its position on the five-step route");
  const branchDetailRule = [
    ...studioEditorCss.matchAll(/\.editor-branch-copy small\s*\{([^}]*)\}/g),
  ].map((match) => match[1]).find((rule) => rule.includes("display:")) ?? "";
  assert.match(branchDetailRule, /display:\s*none/,
    "The route must omit secondary branch prose that cannot fit the narrow inspector");
  assert.match(studioEditorCss,
    /@container theme-inspector \(max-width: 319px\)[\s\S]{0,900}?\.editor-inspector-tab\s*\{[^}]*grid-template-rows:\s*18px minmax\(20px,\s*auto\)[\s\S]{0,900}?\.editor-branch-glyph\s*\{[^}]*width:\s*18px/,
    "An exceptionally narrow inspector must compact icons without dropping stage names");
  assert(!/@container theme-inspector \(max-width: 319px\)[\s\S]{0,1400}?\.editor-branch-copy\s*\{[^}]*clip:/.test(studioEditorCss),
    "Normal Studio widths must never reduce the five stages to unlabeled icons");
  assert.match(studioEditorCss,
    /\.editor-inspector-title-row\s*\{[^}]*grid-template-areas:\s*"back actions"\s*"title title"\s*"state state"[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s+auto/,
    "Localized state text must occupy its own row instead of collapsing Back and Cancel");
  assert.match(studioEditorCss,
    /\.editor-inspector-title-row > \.editor-state\s*\{[^}]*justify-self:\s*stretch[^}]*justify-content:\s*flex-start/,
    "The editor state must use the full header width and read from the left");
  assert.match(studioEditorCss,
    /\.editor-inspector-title-row > \.editor-back\s*\{[^}]*white-space:\s*nowrap/,
    "Back to themes must keep its arrow and label on one line");
  assert.match(studioEditorCss,
    /\.editor-command-row\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)[^}]*gap:\s*4px/,
    "Editing mode and history controls must stay stacked so every shipped locale fits");
  assert.match(studioEditorCss,
    /\.editor-quick-feedback\s*\{[^}]*min-height:\s*48px[^}]*block-size:\s*48px[^}]*overflow:\s*hidden[^}]*padding:\s*5px 10px/,
    "Valid and invalid feedback must reserve the same fixed-header footprint");
  assert.match(studioEditorCss,
    /\.editor-quick-feedback > span\s*\{[^}]*-webkit-line-clamp:\s*2/,
    "Long localized repair text must stay inside the reserved feedback area");
  assert.match(studioEditorCss,
    /\.editor-quick-feedback button:focus-visible\s*\{[^}]*outline-offset:\s*-2px/,
    "The fixed feedback area must keep its keyboard focus ring inside the clipped box");
  assert(!/\.editor-quick-feedback\[data-pass="true"\]\s*\{[^}]*(?:display:\s*none|visibility:\s*hidden)/.test(studioEditorCss),
    "The reserved valid-state feedback area must remain useful instead of becoming a blank gap");
  assert.match(studioEditor,
    /const livePausedSummary = tr\("livePausedNotice"\)\.replace\([\s\S]{0,160}?quickText\.textContent\s*=\s*state\.feedback\.valid[\s\S]{0,120}?livePausedSummary/,
    "Invalid feedback must state that Aura live updates are paused, not misdescribe the editable canvas");
  assert.match(studioEditorCss,
    /:root\[data-studio-mode="light"\] \.editor-view\s*\{[^}]*--editor-status-dirty:\s*#[0-9a-f]{6}[^}]*--editor-status-valid:\s*#[0-9a-f]{6}[^}]*--editor-status-invalid:\s*#[0-9a-f]{6}/i,
    "Header status labels must use readable explicit Light colors");
  assert.match(studioEditorCss,
    /:root\[data-studio-mode="dark"\] \.editor-view\s*\{[^}]*--editor-status-dirty:\s*#[0-9a-f]{6}[^}]*--editor-status-valid:\s*#[0-9a-f]{6}[^}]*--editor-status-invalid:\s*#[0-9a-f]{6}/i,
    "Header status labels must use readable explicit Dark colors");
  assert.match(studioEditorCss,
    /\.editor-inspector-head-actions\s*\{[^}]*justify-self:\s*end/,
    "Cancel must stay aligned to the right of the escape row");
  assert(!/data-level="advanced"[^{}]*\.editor-inspector-nav/.test(studioEditorCss),
    "Advanced must not replace or reorder the shared three-branch architecture");
  const inspectorHeadRule = studioEditorCss.match(/\.editor-inspector-head\s*\{([^}]*)\}/)?.[1] ?? "";
  assert(!/position:\s*sticky/.test(inspectorHeadRule),
    "The persistent header must occupy its own grid row instead of sharing the scrollbar");
  assert.match(inspectorHeadRule, /margin-top:\s*0/,
    "The persistent inspector header must not leave a scroll-through strip above itself");
  assert.match(inspectorHeadRule, /border:\s*0[\s\S]*?border-bottom:\s*1px[\s\S]*?background:\s*var\(--surface\)[\s\S]*?box-shadow:\s*none/,
    "The inspector header must be opaque and flat so scrolled controls cannot leak through it");
  const studioVariableDeclarations = new Set(
    [...`${studioCss}\n${studioEditorCss}`.matchAll(/--([a-z0-9-]+)\s*:/gi)]
      .map((match) => `--${match[1]}`),
  );
  const unresolvedEditorVariables = [
    ...studioEditorCss.matchAll(/var\(\s*(--[a-z0-9-]+)\s*([,)])/gi),
  ]
    .filter(([, name, separator]) => (
      separator === ")" && !studioVariableDeclarations.has(name)
    ))
    .map(([, name]) => name);
  assert.deepEqual([...new Set(unresolvedEditorVariables)].sort(), [],
    "Editor CSS must not use an undeclared custom property without a fallback");
  const editorScrollerSelectors = [
    ...studioEditorCss.matchAll(/([^{}]+)\{([^{}]*)\}/g),
  ]
    .filter(([, , declarations]) => (
      /overflow(?:-[xy])?\s*:\s*(?:auto|scroll)\b/.test(declarations)
    ))
    .flatMap(([, selectors]) => selectors.split(",").map((value) => value.trim()))
    .filter((selector) => selector.startsWith(".editor-"));
  assert.deepEqual(
    [...new Set(editorScrollerSelectors)].sort(),
    [".editor-inspector-body", ".editor-stagecol"],
    "Inspector disclosures must not add another editor-prefixed scroller",
  );
  const documentDetailsPanelRule = studioEditorCss.match(
    /\.editor-document-details-panel\s*\{([^}]*)\}/,
  )?.[1] ?? "";
  assert.match(documentDetailsPanelRule, /background:\s*var\(--raised\)/,
    "Document details must have an opaque declared Studio surface");
  assert(!/position:\s*(?:absolute|fixed|sticky)\b/.test(documentDetailsPanelRule)
      && !/max-height\s*:|overflow(?:-[xy])?\s*:\s*(?:auto|scroll)\b/.test(documentDetailsPanelRule),
    "Document details must remain in inspector flow and use the inspector scrollbar");
  const htmlElementBlock = (source, opening) => {
    const start = source.indexOf(opening);
    if (start < 0) return "";
    const tag = /^<([a-z][\w-]*)\b/i.exec(opening)?.[1];
    if (!tag) return "";
    const token = new RegExp(`<${tag}\\b|</${tag}>`, "gi");
    token.lastIndex = start;
    let depth = 0;
    for (let match; (match = token.exec(source));) {
      depth += match[0][1] === "/" ? -1 : 1;
      if (depth === 0) return source.slice(start, token.lastIndex);
    }
    return "";
  };
  const inspectorHeadMarkup = htmlElementBlock(
    studioHtml, '<div class="editor-inspector-head">',
  );
  const inspectorControlsMarkup = htmlElementBlock(
    studioHtml, '<div class="editor-controls">',
  );
  assert(inspectorHeadMarkup.includes('id="editor-document-details-toggle"'),
    "Document details must remain available from the persistent header");
  assert(!inspectorHeadMarkup.includes('class="editor-document-details-panel"')
      && !inspectorHeadMarkup.includes('id="editor-advanced-notice"'),
  "Disclosures and notices must scroll in normal flow instead of covering properties");
  assert(inspectorControlsMarkup.includes('class="editor-document-details-panel"'),
    "Document details must remain an in-flow part of the inspector");
  assert.match(studioEditorCss, /\.color-field\s*\{[^}]*grid-template-areas:[^}]*"label label"[^}]*"picker value"/,
    "Compact token cards must place labels above their picker and value instead of overflowing fixed columns");
  const stageSelectionBlock = studioEditor.match(
    /const selectStageItem\s*=\s*\([\s\S]*?\n\s*};/)?.[0] ?? "";
  assert.match(stageSelectionBlock, /if \(!stageSelectionAllowed\(selection\)\) return false;/,
    "A canvas object from another branch must never retarget the active tool");
  assert.match(stageSelectionBlock,
    /selection\?\.kind === "layer"[\s\S]{0,220}?selectedLayerId = selection\.id[\s\S]{0,500}?setInspectorTarget\("background\.layer"\)/,
    "Selecting artwork must route to Background while preserving its opaque layer ID");
  assert.match(stageSelectionBlock,
    /const card = layerList\.querySelector[\s\S]{0,700}?revealWithinInspector\(card\.querySelector\("summary"\) \?\? card\)/,
    "Selecting artwork on the canvas must reveal its corresponding inspector card");
  assert(!/dataset\.level === "advanced"[\s\S]{0,120}?setInspectorTarget\("background\.layer"\)/.test(stageSelectionBlock),
    "Quick artwork selection must not be gated behind Advanced mode");
  assert.match(stageSelectionBlock,
    /selection\?\.kind === "prompt"[\s\S]{0,160}?setInspectorTarget\("interface\.new-chat-area",\s*\{\s*reveal\s*}\)/,
    "Selecting the new-chat area must route to and reveal Interface without leaving image controls visible");
  assert.match(studioEditor,
    /stageRing\.dataset\.stageHandle\s*=\s*"move"[\s\S]{0,100}?stageRing\.setAttribute\("aria-hidden",\s*"true"\)/,
    "The current selection ring must provide a pointer move surface without becoming a duplicate keyboard control");
  const stageRingRule = studioEditorCss.match(/\.stage-hud-ring\s*\{([^}]*)\}/)?.[1] ?? "";
  assert.match(stageRingRule, /pointer-events:\s*auto[\s\S]*?cursor:\s*move/,
    "The selected layer's ring must intercept interior drags above overlapping artwork");
  const stagePointerBlock = studioEditor.match(
    /stageRoot\.addEventListener\("pointerdown"[\s\S]*?\n    \}\);\n\n    \/\/ Turn a pointer sample/)?.[0] ?? "";
  assert.match(stagePointerBlock,
    /const directSelection = itemNode \? stageSelectionFromNode\(itemNode\) : null[\s\S]{0,240}?let selection = stageSelection[\s\S]{0,120}?if \(directSelection\)/,
    "Dragging the selection ring must preserve the layer chosen in the palette while direct image clicks may retarget it");
  assert.match(stagePointerBlock,
    /if \(!handle && !directSelection\)[\s\S]{0,160}?if \(selectStageBranchSurface\(\)\) event\.preventDefault\(\)/,
    "Blank canvas clicks must be consumed only when that branch has a truthful canvas target");
  assert(stagePointerBlock.includes(
    'inspectorField = `layers[${index}].frames.${stageViewport}.${handleKind === "scale" ? "scale" : "positionX"}`;',
  ),
    "An explicit artwork gesture must align the inspector with the frame it will edit");
  assert.match(stagePointerBlock, /!state \|\| isBlockingAction\(\)/,
    "A structural (index-changing) response must settle before another pointer drag can resolve the selected layer ID to an index; background value patches must not block it");
  const stageSelectionModeBlock = studioEditor.match(
    /const syncStageSelectionMode\s*=\s*\(\)\s*=>\s*\{[\s\S]*?\n\s*};/)?.[0] ?? "";
  assert.match(stageSelectionModeBlock,
    /const neutralPage\s*=\s*!CAPABILITY_BRANCHES\.includes\(inspectorPage\)[\s\S]{0,300}?neutralPage \|\| inspectorPage === "interface"[\s\S]{0,240}?neutralPage \|\| inspectorPage === "interface"[\s\S]{0,260}?neutralPage \|\| inspectorPage === "background"/,
    "Capability pages must scope canvas hit-testing while Details and Review keep every routable object available");
  assert.match(stageSelectionModeBlock,
    /palette\.hidden\s*=\s*inspectorPage !== "background"/,
    "The image palette must appear only on the Background workflow page");
  assert.match(stageSelectionModeBlock,
    /backgroundScopeUiActive\(inspectorPage,\s*isBuiltInLayoutEdit\(\)\)[\s\S]{0,320}?\.stage-scope-zones, \.stage-background-selection[\s\S]{0,300}?node\.hidden = !scopeActive/,
    "Leaving Background must immediately hide its scope preview");
  const stageNodeInteractiveBlock = studioEditor.match(
    /const setStageNodeInteractive\s*=\s*\([\s\S]*?\n\s*};/)?.[0] ?? "";
  assert.match(stageNodeInteractiveBlock,
    /tabIndex\s*=\s*interactive \? 0 : -1[\s\S]{0,120}?toggleAttribute\("inert",\s*!interactive\)[\s\S]{0,180}?aria-hidden/,
    "Non-matching canvas objects must leave both the pointer path and keyboard/accessibility tree");
  const selectStageBranchSurfaceBlock = studioEditor.match(
    /const selectStageBranchSurface\s*=\s*\(\)\s*=>\s*\{[\s\S]*?\n\s*};/,
  )?.[0] ?? "";
  assert.match(selectStageBranchSurfaceBlock,
    /inspectorBranch === "widgets"[\s\S]{0,160}?return false/,
    "Widgets must reject blank WebView canvas selection");
  assert.match(selectStageBranchSurfaceBlock,
    /inspectorBranch === "interface" \? "interface\.theme" : "background\.canvas"/,
    "A blank Background click may select the canvas without changing its scope");
  assert.doesNotMatch(selectStageBranchSurfaceBlock, /setBackgroundScope|backgroundScopeFromPointer/,
    "Blank preview clicks must not overwrite an explicit background scope");
  assert.match(studioEditor,
    /scopeInputs\.forEach\(\(input\) => input\.addEventListener\("change"[\s\S]{0,160}?setBackgroundScope\(input\.value\)/,
    "Only the inspector scope radios may write background scope");
  assert.match(studioEditor,
    /const backgroundSelected = backgroundScopeUiActive\(inspectorPage,\s*isBuiltInLayoutEdit\(\)\)/,
    "Scope selection chrome must disappear as soon as Details or Review becomes active");
  assert.match(stagePointerBlock,
    /const scopeRect = backgroundScopeRect\([\s\S]{0,320}?selection\.kind === "layer" && scopeRect\.width <= 0\) return/,
    "A collapsed live sidebar must stop artwork drag setup");
  assert.match(stagePointerBlock, /artWidth:\s*scopeRect\.width/,
    "Artwork movement must use the same validated scope width");
  assert.match(selectStageBranchSurfaceBlock,
    /inspectorBranch === "interface" \? "interface\.theme"\s*:\s*"background\.canvas"/,
    "Non-pointer branch selection must stay inside the active capability");
  assert(!selectStageBranchSurfaceBlock.includes('"widgets.app-identity"'),
    "The host-only App identity may be selected only through its local preview");
  assert(!studioEditor.includes("stage-chip-prompt"),
    "The Background image palette must not expose an Interface target");
  const clickThroughRule = studioEditorCss.match(
    /\.editor-stage\[data-selection-branch="interface"\]\s+\.stage-layer\s+\.stage-item,[\s\S]*?\{[^}]*pointer-events:\s*none;[^}]*\}/,
  )?.[0] ?? "";
  for (const selector of [
    '.editor-stage[data-selection-branch="background"] .stage-prompt',
    '.editor-stage[data-selection-branch="background"] .stage-greeting',
    '.editor-stage[data-selection-branch="widgets"] .stage-prompt',
    '.editor-stage[data-selection-branch="widgets"] .stage-greeting',
  ]) {
    assert(clickThroughRule.includes(selector),
      `${selector} must remain click-through for the active selection tool`);
  }
  const stageKeyboardBlock = studioEditor.match(
    /stageRoot\.addEventListener\("keydown"[\s\S]*?\n\s*}\);/)?.[0] ?? "";
  assert.match(stageKeyboardBlock, /!state \|\| isBlockingAction\(\)/,
    "Keyboard framing must also pause while a structural reorder response is pending, but not while a value patch syncs");
  assert.match(studioEditor,
    /stageOpacityInput\.addEventListener\("input"[\s\S]{0,100}?isBlockingAction\(\)[\s\S]*?stageOpacityInput\.addEventListener\("change"[\s\S]{0,100}?isBlockingAction\(\)/,
    "Opacity changes must not race an artwork reorder");
  assert.match(studioEditor,
    /const invalidColorDraft = !state\.feedback\.valid && state\.feedback\.errors\.some\(\(error\) =>[\s\S]{0,100}?error\.code\.includes\("contrast"\) && error\.field\.startsWith\(`\$\{selectedMode}\.`\)/,
    "A settled invalid colour draft must remain visible and editable instead of snapping back to the last-valid capture");
  assert(!/invalidColorDraft[\s\S]{0,220}?\|\| mode/.test(studioEditor),
    "Launcher identity contrast must not dim a canvas that cannot preview launcher materials");
  assert.match(studioEditor,
    /const colorPreview = captureActive && \(invalidColorDraft[\s\S]{0,220}?\[\.\.\.stageOverrides\.keys\(\)\]\.some/,
    "Both invalid drafts and uncommitted colour or material edits must enter the local preview state");
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
  const renderFeedbackBlock = studioEditor.match(
    /const renderFeedback\s*=\s*\(\)\s*=>\s*\{[\s\S]*?\n\s*};/,
  )?.[0] ?? "";
  assert.match(renderFeedbackBlock,
    /quickFeedback\.hidden = false;[\s\S]{0,80}?errorSummary\.hidden = true/,
    "A new validation render must restore the compact feedback row and hide the Save-only summary");
  assert(!renderFeedbackBlock.includes("errorSummary.hidden = false"),
    "Live validation must not duplicate the same blocking warning in two adjacent boxes");
  assert(!renderFeedbackBlock.includes('tr("studioLastValid")'),
    "The compact warning must not claim the editor canvas is showing last-valid colors while it previews the draft");
  const performSaveBlock = studioEditor.match(
    /const performSave\s*=\s*\(\)\s*=>\s*\{[\s\S]*?\n\s*};/,
  )?.[0] ?? "";
  assert.match(performSaveBlock,
    /quickFeedback\.hidden = true;[\s\S]{0,80}?errorSummary\.hidden = false;[\s\S]{0,120}?focusBelowInspector\(errorSummary\)/,
    "An invalid Save must replace the compact warning with one focused detailed summary");
  assert(!studioHtml.includes("editor-live-paused"),
    "The quick feedback row already explains last-valid behavior and must not be followed by a third warning");
  assert.match(studioEditor, /className = "help layer-placement-scope"[\s\S]{0,500}?layerPlacementShared/,
    "Shared appearance or page placement must be disclosed instead of silently leaking across preview states");
  const levelSwitchBlock = studioEditor.match(
    /levelInputs\.forEach\([\s\S]*?\n\s*}\)\);/)?.[0] ?? "";
  assert.match(levelSwitchBlock,
    /input\.value === "simple"[\s\S]{0,180}?querySelectorAll\("\.quick-essential"\)[\s\S]{0,80}?details\.open\s*=\s*true/,
    "Returning to Quick customize must reopen essential color rows whose headings are intentionally hidden");
  assert.match(levelSwitchBlock,
    /setInspectorTarget\(inspectorTarget,\s*\{\s*routePage:\s*false,\s*resetScroll:\s*false\s*\}\)[\s\S]{0,80}?renderStage\(\)/,
    "Changing editor level must preserve the same workflow page, branch, target, and scroll position");
  assert(!/(?:stageContext|selectedMode|backgroundScope|inspectorTarget)\s*=/.test(levelSwitchBlock),
    "Changing editor level must not rewrite preview context, appearance, scope, or target");
  const viewportSwitchBlock = studioEditor.match(
    /stageViewportInputs\.forEach\([\s\S]*?\n\s*}\)\);/,
  )?.[0] ?? "";
  assert(!/inspectorField\s*=/.test(viewportSwitchBlock),
    "Changing Previewing dimensions alone must not retarget Applies to or Edit target");
  assert.match(viewportSwitchBlock, /refreshInspectorContext\(\)/,
    "Changing Previewing dimensions must still refresh the custom-size resolution label");
  assert.match(studioEditor,
    /setInspectorTarget\(target,\s*\{\s*reveal:\s*true\s*\}\)/,
    "Explicit branch and target navigation must reveal the selected section below the persistent header");
  const revealWithinInspectorBlock = studioEditor.match(
    /const revealWithinInspector\s*=\s*\(target\)\s*=>\s*\{[\s\S]*?\n\s*};/,
  )?.[0] ?? "";
  assert.match(revealWithinInspectorBlock,
    /inspectorBody\.getBoundingClientRect\(\)[\s\S]{0,180}?bodyRect\.top\s*\+\s*12[\s\S]{0,180}?bodyRect\.bottom\s*-\s*12[\s\S]{0,180}?inspectorRevealDelta[\s\S]{0,160}?inspectorBody\.scrollTop\s*\+=\s*delta/,
    "Target navigation must reveal controls above or below the independent inspector viewport");
  assert.match(setInspectorTargetBlock,
    /querySelector\(":scope > h2, :scope > h3"\)[\s\S]{0,120}?revealWithinInspector\(heading\)/,
    "Target navigation must reveal the section heading rather than bottom-aligning a tall section");
  assert(!/selectStageItem[\s\S]{0,700}?scrollIntoView/.test(studioEditor),
    "Selecting artwork on the live canvas must not scroll the inspector away from the canvas");
  assert.match(studioHtml,
    /<div class="editor-inspector-head">[\s\S]{0,500}?id="editor-back"[\s\S]{0,1100}?id="editor-dirty"[\s\S]{0,300}?id="editor-valid"[\s\S]{0,500}?id="editor-cancel"/,
    "Back, save status, and Cancel must remain in the persistent inspector header");
  assert.match(studioHtml,
    /id="editor-back"[\s\S]{0,180}?class="editor-back-icon"[\s\S]{0,120}?aria-hidden="true"[\s\S]{0,180}?data-editor-i18n="backToThemes"/,
    "Back to themes must keep a decorative left arrow before its localized label");
  assert.match(studioEditorCss,
    /\.editor-toolbar button\s*\{[\s\S]{0,180}?border-color:\s*var\(--border\)[\s\S]{0,180}?box-shadow:/,
    "Undo, Redo, and Reset must retain a visible border and shadow");
  const editorBackRule = studioEditorCss.match(
    /\.editor-inspector-title-row\s*>\s*\.editor-back\s*\{[\s\S]*?\n\}/,
  )?.[0] ?? "";
  assert(!/border-color:\s*transparent/.test(editorBackRule),
    "Back to themes must inherit the same visible ghost-button border as Cancel");
  assert.match(studioHtml,
    /data-editor-workflow-page="review"[\s\S]{0,1200}?id="editor-feedback"[\s\S]{0,500}?id="editor-save"/,
    "The Review page must own validation and the final Save action");
  assert.equal((studioHtml.match(/id="editor-(?:back|cancel|save)"/g) ?? []).length, 3,
    "Back, Cancel, and Review Save must each appear exactly once");

  const editorWindow = {};
  new Function("window", studioEditor)(editorWindow);
  const editorApi = editorWindow.CLAUDE_AURA_EDITOR;
  assert.equal(editorApi.backgroundScopeUiActive("background", false), true);
  assert.equal(editorApi.backgroundScopeUiActive("review", false), false);
  assert.equal(editorApi.backgroundScopeUiActive("details", false), false);
  assert.equal(editorApi.backgroundScopeUiActive("background", true), false,
    "Background scope controls must be active only on editable Background pages");
  const queuedTokenChanges = new Map([["token:light:canvas", { value: "#BBBBBB" }]]);
  assert.equal(editorApi.reconcileDuplicateTokenValue({
    key: "token:light:canvas",
    value: "#AAAAAA",
    inFlight: { value: "#AAAAAA" },
    confirmedValue: "#999999",
    queued: queuedTokenChanges,
  }), true);
  assert.equal(queuedTokenChanges.size, 0,
    "Returning to an in-flight value must cancel a newer queued value");
  queuedTokenChanges.set("token:light:canvas", { value: "#BBBBBB" });
  assert.equal(editorApi.reconcileDuplicateTokenValue({
    key: "token:light:canvas",
    value: "#AAAAAA",
    inFlight: null,
    confirmedValue: "#AAAAAA",
    queued: queuedTokenChanges,
  }), true);
  assert.equal(queuedTokenChanges.size, 0,
    "Returning to the confirmed value before flush must cancel the no-op patch");
  const deferredTokenChanges = new Map([["token:light:canvas", { value: "#BBBBBB" }]]);
  assert.equal(editorApi.reconcileDuplicateTokenValue({
    key: "token:light:canvas",
    value: "#AAAAAA",
    inFlight: null,
    confirmedValue: "#AAAAAA",
    queued: queuedTokenChanges,
    deferred: deferredTokenChanges,
  }), true);
  assert.equal(deferredTokenChanges.size, 0,
    "Returning to the confirmed value must clear a rejected deferred token");
  assert.equal(editorApi.reconcileDuplicateTokenValue({
    key: "token:light:canvas",
    value: "#CCCCCC",
    inFlight: { value: "#BBBBBB" },
    confirmedValue: "#AAAAAA",
    queued: queuedTokenChanges,
  }), false,
  "A value different from the in-flight mutation must remain queued for the next revision");
  assert.deepEqual(
    editorApi.capabilityRegistry.map((entry) => entry.id),
    [
      "interface.theme",
      "interface.new-chat-area",
      "interface.greeting",
      "background.canvas",
      "background.layer",
      "widgets.app-identity",
    ],
    "The host-owned capability registry must contain the WO-18 targets plus the WO-21 greeting",
  );
  assert(editorApi.capabilityRegistry
    .find((entry) => entry.id === "interface.greeting")?.axes.includes("frame"),
    "The greeting target must retain Light/Dark and Standard/Wide edit axes");
  // The dropdown selects a complete target page. Sections may be shared by
  // declaring more than one exact target, without exposing sibling pages.
  const sectionTargets = new Set(
    [...studioHtml.matchAll(/data-editor-targets="([^"]+)"/g)]
      .flatMap((match) => match[1].split(/\s+/)),
  );
  assert(sectionTargets.has("interface.greeting"),
    "The greeting control section must declare the interface.greeting target");
  for (const target of editorApi.capabilityRegistry.map((entry) => entry.id)) {
    assert(studioEditorCss.includes(
      `data-inspector-target="${target}"] [data-editor-targets~="${target}"]`,
    ), `editor.css has no dedicated section-page rule for ${target}`);
  }
  for (const branch of ["interface", "background", "widgets"]) {
    assert(!studioEditorCss.includes(
      `data-inspector-branch="${branch}"] [data-editor-branch="${branch}"]`,
    ), `editor.css still exposes the entire ${branch} branch as one long page`);
  }
  assert.match(studioHtml,
    /data-editor-targets="background\.canvas background\.layer"/,
    "The asset and safe-zone guide must remain shared by both Background pages");
  assert.deepEqual(
    editorApi.capabilityRegistry.find((entry) => entry.id === "interface.new-chat-area")?.axes,
    [],
    "Shared new-chat placement must not claim separate Standard and Wide saved values",
  );
  assert.equal(
    editorApi.capabilityRegistry.find((entry) => entry.id === "interface.new-chat-area")?.selectionBehavior,
    "stage-prompt",
    "New-chat-area selection must route to the prompt geometry",
  );
  assert.equal(
    editorApi.capabilityRegistry.find((entry) => entry.id === "interface.greeting")?.selectionBehavior,
    "stage-greeting",
    "Greeting selection must route to the greeting geometry",
  );
  assert(editorApi.capabilityRegistry
    .find((entry) => entry.id === "background.layer")?.axes.includes("frame"),
    "Artwork framing must retain its real Standard and Wide edit axis");
  for (const entry of editorApi.capabilityRegistry) {
    assert.deepEqual(
      Object.keys(entry).sort(),
      ["axes", "branch", "captureGeometry", "id", "selectionBehavior", "views"],
      `${entry.id} exposes an unregistered route, selector, or extension field`,
    );
    assert(Object.isFrozen(entry) && Object.isFrozen(entry.views) && Object.isFrozen(entry.axes),
      `${entry.id} must be immutable after validation`);
  }
  const capabilityDto = () => editorApi.capabilityRegistry.map((entry) => ({
    ...entry,
    views: [...entry.views],
    axes: [...entry.axes],
  }));
  assert(editorApi.normalizeCapabilityRegistry(capabilityDto()),
    "The editor rejected its own exact capability DTO");
  for (const [label, mutate] of [
    ["unknown target", (registry) => { registry[0].id = "interface.sidebar"; }],
    ["unknown view", (registry) => { registry[0].views.push("code"); }],
    ["unknown axis", (registry) => { registry[0].axes.push("selector"); }],
    ["branch mismatch", (registry) => { registry[0].branch = "widgets"; }],
    ["extra selector", (registry) => { registry[0].selector = "main"; }],
    ["extra target", (registry) => { registry.push({ ...registry[0], id: "background.extra" }); }],
  ]) {
    const candidate = capabilityDto();
    mutate(candidate);
    assert.equal(editorApi.normalizeCapabilityRegistry(candidate), null,
      `Capability registry accepted ${label}`);
  }
  const greetingFrame = {
    font: "editorial-serif", color: "primary", fontSize: 34, weight: 500,
    italic: false, align: "center", letterSpacing: -0.01, lineHeight: 1.15,
    maxWidthRatio: 0.72, xRatio: 0, yRatio: 0, decoration: "none",
    markSource: "native", markScale: 1,
  };
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
      labels: { en: "Studio Copy", "zh-CN": "Studio 副本", "zh-HKTW": "Studio 副本" },
      descriptions: { en: "Custom theme", "zh-CN": "自定义主题", "zh-HKTW": "自訂主題" },
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
      greeting: {
        native: false,
        compactMarkAvailable: false,
        frames: {
          light: {
            standard: { ...greetingFrame },
            wide: { ...greetingFrame, maxWidthRatio: 0.66 },
          },
          dark: {
            standard: { ...greetingFrame, color: "accent" },
            wide: { ...greetingFrame, color: "accent", xRatio: -0.05 },
          },
        },
      },
      inherited: { fontUi: false, fontDisplay: false, radius: false, shadow: false },
    },
    greetingPreferences: {
      enabled: true,
      source: "custom",
      displayName: "Eric",
      globalPhrases: ["Hey, early bird", "Welcome back, {name}"],
      themeOverrides: { "studio-copy": { mode: "global", phrases: [] } },
      shuffle: null,
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
  const sidebarScopeState = structuredClone(validEditorState);
  sidebarScopeState.shared.backgroundScope = "sidebar";
  assert.equal(
    editorWindow.CLAUDE_AURA_EDITOR.normalizeEditorState(sidebarScopeState)?.shared.backgroundScope,
    "sidebar",
    "The browser state gate rejected the validated panel-only background scope",
  );
  const builtInLayoutState = structuredClone(validEditorState);
  builtInLayoutState.id = "default";
  builtInLayoutState.sourceId = "default";
  builtInLayoutState.isNew = false;
  builtInLayoutState.editKind = "builtin-layout";
  const normalizedBuiltInLayout = editorWindow.CLAUDE_AURA_EDITOR.normalizeEditorState(
    builtInLayoutState,
  );
  assert.equal(normalizedBuiltInLayout?.editKind, "builtin-layout",
    "The page rejected the core's exact built-in layout edit kind");
  const ordinaryNullEditKind = structuredClone(validEditorState);
  ordinaryNullEditKind.editKind = null;
  assert.equal(
    editorWindow.CLAUDE_AURA_EDITOR.normalizeEditorState(ordinaryNullEditKind)?.editKind,
    null,
    "An ordinary duplicate must retain a null edit kind",
  );
  for (const [label, mutate] of [
    ["an unknown edit kind", (candidate) => { candidate.editKind = "builtin-theme"; }],
    ["a new built-in destination", (candidate) => { candidate.isNew = true; }],
    ["a user source", (candidate) => { candidate.source = "user"; }],
    ["a different source id", (candidate) => { candidate.sourceId = "korean-idol"; }],
    ["a missing built-in edit kind", (candidate) => { delete candidate.editKind; }],
  ]) {
    const candidate = structuredClone(builtInLayoutState);
    mutate(candidate);
    assert.equal(editorWindow.CLAUDE_AURA_EDITOR.normalizeEditorState(candidate), undefined,
      `Editor state accepted ${label} for permanent-theme layout authoring`);
  }
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
  // WO-21 greeting: the shared state carries the exact independent
  // Light/Dark x Standard/Wide matrix. Every frame round-trips unchanged and
  // rejects unknown fields plus every out-of-bounds control value.
  const greetingFrameKeys = [
    "align", "color", "decoration", "font", "fontSize", "italic", "letterSpacing",
    "lineHeight", "markScale", "markSource", "maxWidthRatio", "weight", "xRatio", "yRatio",
  ];
  assert.deepEqual(Object.keys(normalizedEditorState.shared.greeting).sort(),
    ["compactMarkAvailable", "frames", "native"],
    "Editor state changed the exact greeting DTO shape");
  assert.deepEqual(Object.keys(normalizedEditorState.shared.greeting.frames).sort(), ["dark", "light"]);
  for (const appearance of ["light", "dark"]) {
    assert.deepEqual(
      Object.keys(normalizedEditorState.shared.greeting.frames[appearance]).sort(),
      ["standard", "wide"],
    );
    for (const frame of ["standard", "wide"]) {
      assert.deepEqual(
        Object.keys(normalizedEditorState.shared.greeting.frames[appearance][frame]).sort(),
        greetingFrameKeys,
      );
    }
  }
  assert.deepEqual(normalizedEditorState.shared.greeting, validEditorState.shared.greeting,
    "Editor-state validation changed the projected greeting style");
  const emojiNameState = structuredClone(validEditorState);
  emojiNameState.greetingPreferences.displayName = "😀".repeat(40);
  assert(editorWindow.CLAUDE_AURA_EDITOR.normalizeEditorState(emojiNameState),
    "Editor state rejected a valid 40-scalar supplementary-plane display name");
  const overlongEmojiNameState = structuredClone(validEditorState);
  overlongEmojiNameState.greetingPreferences.displayName = "😀".repeat(41);
  assert.equal(editorWindow.CLAUDE_AURA_EDITOR.normalizeEditorState(overlongEmojiNameState), undefined,
    "Editor state counted a display name by UTF-16 code units instead of Unicode scalars");
  const completeGreetingState = structuredClone(validEditorState);
  completeGreetingState.shared.greeting.frames.light.standard.weight = 650;
  completeGreetingState.shared.greeting.frames.light.standard.decoration = "glow";
  assert(editorWindow.CLAUDE_AURA_EDITOR.normalizeEditorState(completeGreetingState),
    "Editor state rejected core-supported weight 650 or glow decoration");
  const unavailableCompactState = structuredClone(validEditorState);
  unavailableCompactState.shared.greeting.frames.light.standard.markSource = "compact";
  assert.equal(editorWindow.CLAUDE_AURA_EDITOR.normalizeEditorState(unavailableCompactState), undefined,
    "Editor state accepted a compact mark without a registered recipe capability");
  const availableCompactState = structuredClone(unavailableCompactState);
  availableCompactState.shared.greeting.compactMarkAvailable = true;
  assert(editorWindow.CLAUDE_AURA_EDITOR.normalizeEditorState(availableCompactState),
    "Editor state rejected a compact mark for a registered recipe");
  for (const [label, mutate] of [
    ["a missing greeting projection", (state) => { delete state.shared.greeting; }],
    ["an extra greeting field", (state) => { state.shared.greeting.uppercase = true; }],
    ["a non-boolean native marker", (state) => { state.shared.greeting.native = "false"; }],
    ["a missing frame", (state) => { delete state.shared.greeting.frames.dark.wide; }],
    ["a non-boolean italic flag", (state) => { state.shared.greeting.frames.light.standard.italic = 1; }],
    ["an out-of-range size", (state) => { state.shared.greeting.frames.light.standard.fontSize = 200; }],
    ["an unknown font category", (state) => { state.shared.greeting.frames.light.standard.font = "comic-sans"; }],
    ["an unknown colour role", (state) => { state.shared.greeting.frames.light.standard.color = "muted"; }],
    ["an unsupported weight", (state) => { state.shared.greeting.frames.light.standard.weight = 450; }],
    ["an out-of-range offset", (state) => { state.shared.greeting.frames.light.standard.xRatio = 5; }],
    ["an unknown mark source", (state) => { state.shared.greeting.frames.light.standard.markSource = "hero"; }],
  ]) {
    const candidate = structuredClone(validEditorState);
    mutate(candidate);
    assert.equal(editorWindow.CLAUDE_AURA_EDITOR.normalizeEditorState(candidate), undefined,
      `Editor state accepted ${label}`);
  }
  // Greeting controls emit one complete bounded frame for the selected
  // appearance/viewport, route it through one history mutation, and project
  // the full matrix back into canonical state.
  assert.match(studioEditor,
    /kind:\s*"greeting",\s*operation:\s*"set-frame",\s*appearance,\s*frame:\s*frameId,\s*value:\s*frame/,
    "Greeting controls must emit one complete scoped greeting frame");
  assert.match(studioCore,
    /greeting:\s*\["kind",\s*"operation",\s*"appearance",\s*"frame",\s*"value"\]/,
    "The host must accept the exact greeting patch shape");
  assert.match(corePatchBlock, /change\.kind === "greeting"\)\s*mutateStudioGreetingDocument/,
    "One atomic patch must route greeting changes to the greeting mutator");
  assert.match(studioCore,
    /greeting:\s*studioGreetingState\([\s\S]{0,120}?studioGreetingCompactMarkAvailable\(document\)/,
    "Canonical Studio state must project greeting frames and compact-mark capability together");
  assert.match(studioCore, /document\.newChatGreetingStyle\s*=\s*validateNewChatGreetingStyle\(/,
    "Greeting edits must re-validate the exact newChatGreetingStyle shape before persisting");

  // WO-21 personal greeting words. This envelope is host-owned config, never
  // theme data. It round-trips with an aligned private history so theme and
  // personal drafts save or cancel as one transaction.
  assert.deepEqual(Object.keys(normalizedEditorState.greetingPreferences).sort(),
    ["displayName", "enabled", "globalPhrases", "shuffle", "source", "themeOverrides"],
    "The personal greeting envelope changed its exact DTO shape");
  assert.deepEqual(normalizedEditorState.greetingPreferences, validEditorState.greetingPreferences,
    "Editor-state validation changed the personal greeting envelope");
  for (const [label, mutate] of [
    ["a missing personal envelope", (state) => { delete state.greetingPreferences; }],
    ["an extra personal field", (state) => { state.greetingPreferences.rawHtml = "<b>x</b>"; }],
    ["a non-boolean enabled marker", (state) => { state.greetingPreferences.enabled = "true"; }],
    ["an unknown greeting source", (state) => { state.greetingPreferences.source = "random"; }],
    ["an over-long display name", (state) => { state.greetingPreferences.displayName = "n".repeat(41); }],
    ["too many phrases", (state) => { state.greetingPreferences.globalPhrases = Array.from({ length: 13 }, (_, i) => `p${i}`); }],
    ["a duplicate phrase", (state) => { state.greetingPreferences.globalPhrases = ["same", "same"]; }],
    ["an over-long phrase", (state) => { state.greetingPreferences.globalPhrases = ["p".repeat(121)]; }],
    ["a repeated name token", (state) => { state.greetingPreferences.globalPhrases = ["{name} and {name}"]; }],
    ["an unknown token", (state) => { state.greetingPreferences.globalPhrases = ["Hi, {account}"]; }],
    ["an invalid override mode", (state) => { state.greetingPreferences.themeOverrides["studio-copy"].mode = "inherit"; }],
    ["an empty custom override", (state) => {
      state.greetingPreferences.themeOverrides["studio-copy"] = { mode: "custom", phrases: [] };
    }],
    ["an invalid shuffle digest", (state) => {
      state.greetingPreferences.shuffle = {
        themeId: "studio-copy", phraseDigest: "nope", order: [0], cursor: 0, lastIndex: null,
      };
    }],
  ]) {
    const candidate = structuredClone(validEditorState);
    mutate(candidate);
    assert.equal(editorWindow.CLAUDE_AURA_EDITOR.normalizeEditorState(candidate), undefined,
      `Editor state accepted ${label}`);
  }
  const greetingPhrasesBlock = studioCore.match(
    /export async function setGreetingPhrases\([\s\S]*?\n\}/)?.[0] ?? "";
  assert(greetingPhrasesBlock, "The host personal greeting handler is missing");
  assert.match(greetingPhrasesBlock, /mutateStudio\(/,
    "Personal greeting words must participate in the aligned Studio history");
  assert(!/writeConfig\(/.test(greetingPhrasesBlock),
    "Personal words must remain staged until the atomic Save");
  assert.match(greetingPhrasesBlock, /cloneJson\(internal\.greetingCurrent\.themeOverrides/,
    "A per-theme greeting edit must preserve every other local override");
  assert.match(studioCore, /greetingPreferences:\s*cloneJson\(internal\.greetingCurrent\)/,
    "Canonical Studio state must project the current host-owned greeting draft");
  assert.match(studioEditor, /stageContext === "new-chat"\s*\?\s*\[stageGreetingEl, stagePromptEl\]/,
    "The stage must draw the greeting above the new-chat prompt so placement controls have an effect");
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
  assert.notEqual(editorWindow.CLAUDE_AURA_EDITOR.normalizeEditorState(malformedMetadataState), undefined,
    "The Studio page rejected an incomplete but recoverable localized draft");
  const selectedJapaneseMetadataState = structuredClone(validEditorState);
  selectedJapaneseMetadataState.metadata.labels.ja = "Studio copy";
  selectedJapaneseMetadataState.metadata.descriptions.ja = "Studio theme";
  assert.notEqual(editorWindow.CLAUDE_AURA_EDITOR.normalizeEditorState(selectedJapaneseMetadataState), undefined,
    "The Studio page rejected a selected canonical metadata locale");
  const mismatchedMetadataState = structuredClone(selectedJapaneseMetadataState);
  delete mismatchedMetadataState.metadata.descriptions.ja;
  assert.equal(editorWindow.CLAUDE_AURA_EDITOR.normalizeEditorState(mismatchedMetadataState), undefined,
    "The Studio page accepted mismatched name and description locale sets");
  const unknownMetadataLocaleState = structuredClone(validEditorState);
  unknownMetadataLocaleState.metadata.labels.ru = "Studio copy";
  unknownMetadataLocaleState.metadata.descriptions.ru = "Studio theme";
  assert.equal(editorWindow.CLAUDE_AURA_EDITOR.normalizeEditorState(unknownMetadataLocaleState), undefined,
    "The Studio page accepted metadata outside the canonical fifteen locales");
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
  const compactGreetingRecipes = new Set([
    "japanese-film-editorial", "korean-prestige", "study-library", "japanese-idol",
  ]);
  for (const themeId of THEME_IDS) {
    const candidate = structuredClone(validEditorState);
    candidate.shared.greeting = studioGreetingState(
      registryThemes.get(themeId).newChatGreetingStyle,
      compactGreetingRecipes.has(themeId),
    );
    const normalized = editorWindow.CLAUDE_AURA_EDITOR.normalizeEditorState(candidate);
    assert(normalized, `${themeId} greeting recipe was rejected by the browser-state validator`);
    assert.equal(normalized.shared.greeting.compactMarkAvailable, compactGreetingRecipes.has(themeId),
      `${themeId} projected the wrong compact-mark capability`);
  }
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
    /class AuraIconWindow[\s\S]*?\n    base\.WndProc\(ref message\);\s*\n    if \(message\.Msg == WM_DPICHANGED\)[\s\S]{0,220}?DpiChanged/,
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
      ? ui.indexOf("Initialize-AuraUiWindowLayoutForForm -Kind aura -Form $script:Form", formStart)
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
  assert(launcherStyleResolver.includes("$studioStyle = if ($editorActive)")
      && launcherStyleResolver.includes("-Names @('studioStyle')")
      && launcherStyleResolver.includes("Resolve-AuraUiLauncherModeMaterial")
      && launcherStyleResolver.includes("Test-AuraUiDarkChrome"),
    "Launcher appearance must resolve from the active last-valid Studio palette");
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
  const launcherModeResolver = powershellFunction("Resolve-AuraUiLauncherModeMaterial");
  assert(launcherModeResolver.includes("$authoredDark -eq $Dark")
      && launcherModeResolver.includes("$palette = Get-AuraUiPropertyValue")
      && launcherModeResolver.includes("surface = Get-AuraUiPropertyValue -InputObject $palette -Names @('surface')")
      && launcherModeResolver.includes("surfaceHover = Get-AuraUiPropertyValue -InputObject $palette -Names @('raised')")
      && launcherModeResolver.includes("foreground = Get-AuraUiPropertyValue -InputObject $palette -Names @('text')")
      && launcherModeResolver.includes("border = Get-AuraUiPropertyValue -InputObject $palette -Names @('border')"),
    "Only an opposite-polarity launcher may derive its surface, hover, text, and border from the mode palette");
  assert(launcherModeResolver.includes(
    "accent = Get-AuraUiPropertyValue -InputObject $Raw -Names @('accent')",
  ),
    "Appearance adaptation must retain the authored launcher accent");
  const launcherModeRegression = [
    "$ErrorActionPreference='Stop'",
    "Add-Type -AssemblyName System.Drawing",
    powershellFunction("Get-AuraUiPropertyValue"),
    launcherModeResolver,
    "$rawDark=[pscustomobject]@{asset='assets/theme-art/korean-idol/launcher-mark.png';surface='#241D43';surfaceHover='#33275C';foreground='#F7F6FF';accent='#79D7E4';border='#8F78DF';radius=16;borderWidth=1}",
    "$darkPalette=[pscustomobject]@{surface='#25213F';raised='#2E2A4C';text='#EDECF9';border='#BFBAE3'}",
    "$lightPalette=[pscustomobject]@{surface='#F7F7FD';raised='#FAFAFF';text='#241F3D';border='#2E2848'}",
    "$studio=[pscustomobject]@{light=$lightPalette;dark=$darkPalette}",
    "$nativeDark=Resolve-AuraUiLauncherModeMaterial -Raw $rawDark -StudioStyle $studio -Dark $true",
    "if(-not [object]::ReferenceEquals($nativeDark,$rawDark)){throw 'Dark-authored launcher changed in Dark mode'}",
    "$light=Resolve-AuraUiLauncherModeMaterial -Raw $rawDark -StudioStyle $studio -Dark $false",
    "if($light.surface -cne '#F7F7FD' -or $light.surfaceHover -cne '#FAFAFF' -or $light.foreground -cne '#241F3D' -or $light.border -cne '#2E2848'){throw 'Dark-authored launcher did not adopt the Light palette'}",
    "if($light.asset -cne $rawDark.asset -or $light.accent -cne $rawDark.accent -or $light.radius -ne 16 -or $light.borderWidth -ne 1){throw 'Light adaptation changed launcher identity'}",
    "$rawLight=[pscustomobject]@{asset='assets/theme-art/japanese-idol/launcher-mark.png';surface='#FFF5F1';surfaceHover='#FFE5EB';foreground='#3B2930';accent='#DA6F8D';border='#C7B3E6';radius=20;borderWidth=1}",
    "$idolStudio=[pscustomobject]@{light=[pscustomobject]@{surface='#FDF8F7';raised='#FEFBFA';text='#38242B';border='#462B35'};dark=[pscustomobject]@{surface='#38242C';raised='#432D37';text='#F7ECE8';border='#DEBAC1'}}",
    "$nativeLight=Resolve-AuraUiLauncherModeMaterial -Raw $rawLight -StudioStyle $idolStudio -Dark $false",
    "if(-not [object]::ReferenceEquals($nativeLight,$rawLight)){throw 'Light-authored launcher changed in Light mode'}",
    "$dark=Resolve-AuraUiLauncherModeMaterial -Raw $rawLight -StudioStyle $idolStudio -Dark $true",
    "if($dark.surface -cne '#38242C' -or $dark.surfaceHover -cne '#432D37' -or $dark.foreground -cne '#F7ECE8' -or $dark.border -cne '#DEBAC1'){throw 'Light-authored launcher did not adopt the Dark palette'}",
    "$invalid=[pscustomobject]@{light=[pscustomobject]@{surface='#F7F7FD';raised='#FAFAFF';text='#241F3D';border='invalid'}}",
    "$fallback=Resolve-AuraUiLauncherModeMaterial -Raw $rawDark -StudioStyle $invalid -Dark $false",
    "if(-not [object]::ReferenceEquals($fallback,$rawDark)){throw 'Malformed palette partially changed the launcher'}",
  ].join("\n");
  if (process.platform === "win32") {
    run("powershell.exe", [
      "-NoProfile",
      "-EncodedCommand",
      Buffer.from(launcherModeRegression, "utf16le").toString("base64"),
    ]);
  }

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
  // A duplicated theme is a user theme carrying a built-in mark. Rebuilding an
  // ICO from the 96 px PNG can never match the authored multi-frame file, so
  // that identity must take the built-in branch instead of failing to Default.
  assert.match(identityCandidateBuilder,
    /\$builtInThemeId = Get-AuraUiBuiltInLauncherThemeId -Style \$Style\s*\$expectedIconBytes = if \(-not \$builtInThemeId -and "\$\(\$Style\.source\)" -cin @\('user', 'editor'\)\)/,
    "Only a genuinely custom mark may have its Windows identity rebuilt from the launcher PNG");
  const builtInBranchIndex = identityCandidateBuilder.indexOf("if ($builtInThemeId) {");
  assert(builtInBranchIndex > identityCandidateBuilder.indexOf("$builtInThemeId = Get-AuraUiBuiltInLauncherThemeId"),
    "The built-in identity branch must reuse the same resolved theme id as the ICO derivation gate");
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
    /\$requestedStyle = Get-AuraUiLauncherStyle[\s\S]{0,400}?\$defaultStyle = Resolve-AuraUiLauncherModeMaterial -Raw \(Get-AuraUiLauncherDefaultStyle\)[\s\S]{0,320}?-Dark \(Test-AuraUiDarkChrome\)[\s\S]{0,180}?source -NotePropertyValue 'builtin'[\s\S]{0,180}?theme -NotePropertyValue 'default'[\s\S]{0,120}?\$styles = @\(\$requestedStyle, \$defaultStyle\)/,
    "The transaction must try the requested identity and then exactly one complete Default identity, resolved for the current appearance so a fallback never paints a dark launcher over a light theme");
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
    /\$closeAction\s*=\s*\[Action\]\s*\{\s*Request-AuraUiExit\s*\}[\s\S]{0,120}?BeginInvoke\(\$closeAction\)[\s\S]{0,180}?catch\s*\{\s*try\s*\{\s*Request-AuraUiExit/,
    "Incomplete rollback shutdown must request explicit exit on the UI queue with a direct fallback");

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
  const nodeHelper = powershellFunction("Invoke-AuraUiNode");
  assert.match(nodeHelper, /\[switch\]\$PrivateDiagnostics/,
    "The Node helper must expose an explicit private-diagnostics mode");
  assert.match(nodeHelper,
    /if \(\$PrivateDiagnostics\)\s*\{\s*throw 'A private Claude Aura helper operation failed\.'/,
    "Private helper failures must replace path-bearing stderr with one fixed error");
  assert.match(nodeHelper,
    /if \(-not \$PrivateDiagnostics -and \$stderr\.Trim\(\)\)\s*\{[\s\S]{0,160}?Write-AuraUiLog/,
    "Private helper warnings must not reach the Aura log");
  const terminalThemeExport = powershellFunction("Invoke-AuraUiExportTerminalThemes");
  assert.equal((terminalThemeExport.match(/\[System\.Windows\.Forms\.SaveFileDialog\]::new\(\)/g) ?? []).length, 2,
    "Terminal export must ask separately for the Light and Dark JSON names");
  assert.equal((terminalThemeExport.match(/\.ShowDialog\(\$Owner\)/g) ?? []).length, 2,
    "Both terminal filenames must use Studio-owned native save dialogs");
  assert.match(terminalThemeExport,
    /Get-AuraUiClaudeCodeThemesDirectory[\s\S]{0,100}?\$lightDialog\.InitialDirectory = \$claudeThemesDirectory/,
    "An existing host-only Claude Code themes folder must be the optional first save location");
  assert.doesNotMatch(terminalThemeExport, /CreateDirectory|New-Item/,
    "Terminal export must never create Claude Code's themes folder");
  const claudeCodeThemesResolver = powershellFunction("Get-AuraUiClaudeCodeThemesDirectory");
  assert.match(claudeCodeThemesResolver,
    /GetEnvironmentVariable\('CLAUDE_CONFIG_DIR'\)[\s\S]{0,160}?if \(\$null -ne \$override\)[\s\S]{0,180}?else\s*\{[\s\S]{0,180}?GetEnvironmentVariable\('USERPROFILE'\)[\s\S]{0,180}?'\.claude'/,
    "CLAUDE_CONFIG_DIR must take precedence, with USERPROFILE fallback only when it is unset");
  assert.match(claudeCodeThemesResolver,
    /GetPathRoot\(\$configCandidate\)[\s\S]{0,300}?\$isDriveAbsolute[\s\S]{0,180}?\$isUncAbsolute[\s\S]{0,180}?GetFullPath\(\$configCandidate\)/,
    "The optional Claude config root must be a resolvable absolute Windows path");
  assert.match(claudeCodeThemesResolver,
    /Directory\]::Exists\(\$configDirectory\)[\s\S]{0,220}?Combine\(\$configDirectory, 'themes'\)[\s\S]{0,180}?Directory\]::Exists\(\$themesDirectory\)/,
    "The resolver must require both the config root and its existing themes child");
  assert.doesNotMatch(claudeCodeThemesResolver,
    /CreateDirectory|New-Item|Write-AuraUiLog|Send-AuraUiStudioState/,
    "Resolving a host-only Claude Code path must not create, log, or send it");
  assert.match(terminalThemeExport, /\$dialog\.OverwritePrompt\s*=\s*\$false/,
    "The native dialog must not imply that the strict exporter can overwrite a collision");
  assert.match(terminalThemeExport,
    /Invoke-AuraUiNode -CommandArguments @\([\s\S]{0,180}?['"]export-terminal-pair['"][\s\S]{0,180}?['"]--light['"], \$lightPath, ['"]--dark['"], \$darkPath[\s\S]{0,180}?['"]--user-themes['"], \$UserThemesRoot[\s\S]{0,100}?\) -PrivateDiagnostics/,
    "The host must defer collision-safe pair publication to the strict private CLI path");
  assert.match(terminalThemeExport,
    /Assert-AuraUiTerminalThemeExportResult[\s\S]{0,180}?-Result \$result -Theme \$themeId -LightPath \$lightPath -DarkPath \$darkPath[\s\S]{0,180}?Send-AuraUiStudioState -Action 'export-terminal-themes' -ActionSucceeded \$true/,
    "The host must validate the exact pair result before acknowledging success");
  const terminalResultValidator = powershellFunction("Assert-AuraUiTerminalThemeExportResult");
  assert.match(terminalResultValidator,
    /Test-AuraUiStudioExactProperties -Message \$Result -Names @\('pass', 'theme', 'files'\)[\s\S]{0,360}?\$Result\.files -isnot \[System\.Array\]/,
    "Terminal helper output must have the exact top-level schema and an array of files");
  assert.match(terminalResultValidator,
    /Test-AuraUiStudioExactProperties -Message \$file -Names @\('mode', 'path', 'sha256'\)[\s\S]{0,360}?\$file\.mode -cne \$expectedModes\[\$index\]/,
    "Each terminal helper file must have the exact schema and ordered Light/Dark mode");
  assert(terminalResultValidator.includes(
    "$file.sha256 -isnot [string] -or $file.sha256 -cnotmatch '^[0-9a-f]{64}$'"),
    "Both helper digests must be lowercase 64-hex SHA-256 strings");
  assert.match(terminalResultValidator,
    /\[IO\.Path\]::GetFullPath\(\$LightPath\)[\s\S]{0,120}?\[IO\.Path\]::GetFullPath\(\$DarkPath\)[\s\S]{0,700}?\[IO\.Path\]::GetFullPath\(\[string\]\$file\.path\)[\s\S]{0,220}?\[StringComparison\]::OrdinalIgnoreCase/,
    "Normalized helper paths must equal both host-selected destinations");
  assert.equal((terminalThemeExport.match(
    /Send-AuraUiStudioState -Action 'export-terminal-themes' -ActionSucceeded \$false/g,
  ) ?? []).length, 2, "Canceling either dialog must return one non-error cancellation acknowledgement");
  assert.match(terminalThemeExport,
    /Write-AuraUiLog -Message 'Terminal theme export failed\.'[\s\S]{0,120}?Send-AuraUiStudioState -Tone error -Action 'export-terminal-themes' -ActionSucceeded \$false/,
    "Terminal export failures must use fixed, path-free log and Studio messages");
  const terminalExportPublicCalls = terminalThemeExport.split(/\r?\n/)
    .filter((line) => /(?:Send-AuraUiStudioState|Write-AuraUiLog)/.test(line))
    .join("\n");
  assert.doesNotMatch(terminalExportPublicCalls, /\$_|Exception|\$[A-Za-z]*Path/,
    "Terminal export must never place a selected path or exception detail in remote state or logs");
  const rejectedStudioMessageHandler = ui.slice(
    ui.indexOf("$studioCore.add_WebMessageReceived"),
    ui.indexOf("$studioCore.add_NewWindowRequested", ui.indexOf("$studioCore.add_WebMessageReceived")),
  );
  assert(rejectedStudioMessageHandler.includes("'export-terminal-themes'"),
    "Rejected terminal export messages must be recognized as a bounded action");
  assert.match(rejectedStudioMessageHandler,
    /Send-AuraUiStudioState[^\r\n]*-Tone error -Action \$failedAction -ActionSucceeded \$false/,
    "A rejected terminal export request must release the page pending gate with a path-free failure");

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
    /try \{ \$initialIdentityReady = \[bool\]\(Update-AuraUiLauncherStyle\) \}[\s\S]{0,220}?if \(-not \$initialIdentityReady\)\s*\{[\s\S]{0,180}?throw 'Claude Aura could not establish a complete safe application identity\.'[\s\S]{0,700}?\$script:TrayIcon\.Visible = \$true/,
    "Startup must fail closed instead of revealing tray or launcher surfaces without a complete identity");
  const launcherPositionUpdate = powershellFunction("Update-AuraUiLauncherPosition");
  assert.match(launcherPositionUpdate,
    /if \(-not \$script:Launcher\.Visible\)\s*\{[\s\S]{0,220}?-not \(Update-AuraUiLauncherStyle\)[\s\S]{0,80}?return[\s\S]{0,220}?\$null -eq \$script:EffectiveLauncherIdentity[\s\S]{0,80}?return[\s\S]{0,120}?\$script:Launcher\.Show\(\$script:Form\)/,
    "The launcher must never Show unless a complete effective identity exists");
  assert.match(launcherPositionUpdate,
    /Update-AuraUiLauncherHintPosition[\s\S]{0,80}?Update-AuraUiLauncherTipPosition/,
    "Aura window geometry changes must reposition every open launcher popup");
  const launcherPopupLocation = powershellFunction("Get-AuraUiLauncherPopupLocation");
  assert.match(launcherPopupLocation,
    /\$rawCandidates\s*=\s*@\([\s\S]*?\$rightAligned,\s*\[int\]\$above[\s\S]*?\$leftAligned,\s*\[int\]\$above[\s\S]*?\$rightAligned,\s*\[int\]\$below[\s\S]*?\$leftAligned,\s*\[int\]\$below/,
    "A launcher popup must try deterministic above and below placements from both anchor edges");
  assert.match(launcherPopupLocation,
    /\$blocked\s*=\s*\$RequireCollisionFree -and \$popup\.IntersectsWith\(\$Anchor\)[\s\S]*?foreach \(\$avoid in \$expandedAvoid\)[\s\S]*?\$popup\.IntersectsWith\(\$avoid\)/,
    "Collision-free popup placement must reject both its launcher anchor and live page obstacles");
  const launcherPopupRegression = [
    "$ErrorActionPreference='Stop'",
    "Add-Type -AssemblyName System.Drawing",
    `$uiPath='${path.join(PROJECT_ROOT, "windows", "aura-ui.ps1").replaceAll("'", "''")}'`,
    "$tokens=$null;$errors=$null",
    "$ast=[System.Management.Automation.Language.Parser]::ParseFile($uiPath,[ref]$tokens,[ref]$errors)",
    "if($errors.Count){throw 'Could not parse Aura UI for launcher popup regression'}",
    "$definition=$ast.Find({param($node)$node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -ceq 'Get-AuraUiLauncherPopupLocation'},$true)",
    "if($null -eq $definition){throw 'Missing launcher popup placement helper'}",
    "Invoke-Expression $definition.Extent.Text",
    "$bounds=[Drawing.Rectangle]::new(100,200,1000,700)",
    "$popup=[Drawing.Size]::new(336,148)",
    "$defaultAnchor=[Drawing.Rectangle]::new(1000,800,48,48)",
    "$default=Get-AuraUiLauncherPopupLocation -Anchor $defaultAnchor -PopupSize $popup -Bounds $bounds -Gap 12 -RequireCollisionFree",
    "if($default.X -ne 712 -or $default.Y -ne 640){throw 'Default launcher popup placement changed'}",
    "$leftAnchor=[Drawing.Rectangle]::new(116,600,48,48)",
    "$movedLeftAnchor=[Drawing.Rectangle]::new(146,600,48,48)",
    "$nearLeft=Get-AuraUiLauncherPopupLocation -Anchor $leftAnchor -PopupSize $popup -Bounds $bounds -Gap 12 -RequireCollisionFree",
    "$movedRight=Get-AuraUiLauncherPopupLocation -Anchor $movedLeftAnchor -PopupSize $popup -Bounds $bounds -Gap 12 -RequireCollisionFree",
    "if($nearLeft.X -ne 100 -or $movedRight.X -ne 100){throw 'Left-edge popup did not remain within the live bounds'}",
    "if(([Drawing.Rectangle]::new($nearLeft,$popup)).IntersectsWith($leftAnchor) -or ([Drawing.Rectangle]::new($movedRight,$popup)).IntersectsWith($movedLeftAnchor)){throw 'Left-edge popup covered its launcher anchor'}",
    "$topAnchor=[Drawing.Rectangle]::new(500,216,48,48)",
    "$nearTop=Get-AuraUiLauncherPopupLocation -Anchor $topAnchor -PopupSize $popup -Bounds $bounds -Gap 12 -RequireCollisionFree",
    "if($nearTop.X -ne 212 -or $nearTop.Y -ne 276){throw 'Top-edge popup did not flip below the launcher'}",
    "$highDpiBounds=[Drawing.Rectangle]::new(0,0,2000,1400)",
    "$highDpiAnchor=[Drawing.Rectangle]::new(32,800,96,96)",
    "$highDpiMovedAnchor=[Drawing.Rectangle]::new(72,800,96,96)",
    "$highDpiPopup=[Drawing.Size]::new(672,296)",
    "$highDpi=Get-AuraUiLauncherPopupLocation -Anchor $highDpiAnchor -PopupSize $highDpiPopup -Bounds $highDpiBounds -Gap 24 -RequireCollisionFree",
    "$highDpiMoved=Get-AuraUiLauncherPopupLocation -Anchor $highDpiMovedAnchor -PopupSize $highDpiPopup -Bounds $highDpiBounds -Gap 24 -RequireCollisionFree",
    "if($highDpi.X -ne 0 -or $highDpi.Y -ne 480 -or $highDpiMoved.X -ne 0){throw 'DPI-scaled popup escaped its bounded collision-free placement'}",
  ].join("\n");
  if (process.platform === "win32") {
    run("powershell.exe", [
      "-NoProfile",
      "-EncodedCommand",
      Buffer.from(launcherPopupRegression, "utf16le").toString("base64"),
    ]);
  }
  const launcherTipPositionUpdate = powershellFunction("Update-AuraUiLauncherTipPosition");
  assert.match(launcherTipPositionUpdate,
    /Get-AuraUiLauncherPopupLocation[\s\S]{0,180}?\$script:LauncherTip\.Size/,
    "The hover caption must use the shared live launcher-popup geometry");
  const launcherHintPositionUpdate = powershellFunction("Update-AuraUiLauncherHintPosition");
  assert.match(launcherHintPositionUpdate,
    /\$script:Launcher\.Location\.X[\s\S]{0,180}?\$script:Launcher\.Location\.Y[\s\S]{0,500}?Get-AuraUiLauncherPopupLocation[\s\S]{0,180}?\$script:LauncherHint\.Size/,
    "The launcher guide must derive its position from the current launcher geometry");
  assert.match(launcherHintPositionUpdate,
    /PointToScreen[\s\S]{0,260}?ClientSize\.Width[\s\S]{0,100}?ClientSize\.Height[\s\S]{0,500}?Get-AuraUiLauncherPopupLocation/,
    "The launcher guide must clamp its refreshed position to the current Aura client area");
  assert.match(ui,
    /\$script:Launcher\.add_LocationChanged\(\{\s*(?:\[void\]\()?Update-AuraUiLauncherHintPosition\)?\s*(?:\[void\]\()?Update-AuraUiLauncherTipPosition\)?\s*\}\)/,
    "Dragging or DPI-moving the launcher must carry every open popup with it");
  const launcherTipShow = powershellFunction("Show-AuraUiLauncherTip");
  assert.match(launcherTipShow,
    /\$script:LauncherTip\.ClientSize[\s\S]{0,340}?if \(-not \(Update-AuraUiLauncherTipPosition\)\)[\s\S]{0,1200}?ShowWindow\(\$script:LauncherTip\.Handle,\s*8\)/,
    "The hover caption must use the same live positioning path before its first frame");
  const launcherHintShow = powershellFunction("Show-AuraUiLauncherHint");
  assert.match(launcherHintShow,
    /\$script:LauncherHint\s*=\s*\$hint[\s\S]{0,520}?\[void\]\(Update-AuraUiLauncherHintPosition\)/,
    "The launcher guide must use the same live positioning path before its first frame");
  assert.match(launcherHintPositionUpdate,
    /if \(\$null -eq \$location\)[\s\S]{0,220}?return \$false[\s\S]{0,180}?\$script:LauncherHint\.Location\s*=\s*\$location[\s\S]{0,160}?ShowWindow\(\$script:LauncherHint\.Handle,\s*8\)/,
    "Only a collision-free launcher guide position may become visible");
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

  const shortcutDefinitionsMatch = install.match(
    /\$shortcutDefinitions\s*=\s*@\(([\s\S]*?)\n\s*\)\s*\n\s*\$shortcutFolders\s*=\s*@\(\$menuRoot\)/);
  assert(shortcutDefinitionsMatch, "Installer shortcut definitions are missing");
  const shortcutNames = [...shortcutDefinitionsMatch[1].matchAll(/Name\s*=\s*['"]([^'"]+\.lnk)['"]/g)]
    .map((match) => match[1]);
  assert.deepEqual(shortcutNames, ["Claude Aura.lnk", "Claude Aura Studio.lnk"],
    "Installer must create separate normal Aura and Studio shortcuts");
  assert.match(shortcutDefinitionsMatch[1],
    /Name\s*=\s*['"]Claude Aura Studio\.lnk['"][\s\S]{0,160}?Arguments\s*=\s*"\$baseArguments -OpenStudio"/,
    "The Studio shortcut must use the dedicated -OpenStudio route");
  assert.match(install,
    /\$shortcutFolders\s*=\s*@\(\$menuRoot\)[\s\S]{0,100}?if \(-not \$NoDesktopShortcuts\)\s*\{[\s\S]{0,100}?\$shortcutFolders\s*=\s*@\(\$desktop, \$menuRoot\)/,
    "Normal Aura and Studio shortcuts must always reach Start and conditionally reach Desktop");
  assert.match(install, /foreach \(\$folder in \$shortcutFolders\)/,
    "Normal Aura and Studio shortcuts must use the validated destination list");
  assert.match(install, /\$shortcut\.IconLocation\s*=\s*"\$iconPath,0"/,
    "Aura-owned shortcuts must use the selected installed theme icon");
  assert.match(install,
    /\$shortcut\.Save\(\)[\s\S]{0,120}?Set-AuraShortcutAppUserModelId -Path \$shortcutPath/,
    "Installer-created Aura shortcuts must receive the process AppUserModelID before they can be pinned");
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
  ], "Theme changes must retain the exact four installed Desktop/Start-menu Aura shortcuts");
  assert.match(ownedShortcutUpdater,
    /\$installedScript[\s\S]*?\$currentScript[\s\S]*?Equals\(\$currentScript,\s*\$installedScript/,
    "Shortcut refresh must run only from the exact installed aura-ui.ps1");
  assert.match(ownedShortcutUpdater,
    /\$present\s*=\s*@\(\$installedShortcuts \| Where-Object[\s\S]{0,240}?\$present\.Count -eq 0[\s\S]{0,220}?Managed = \$false[\s\S]{0,180}?\$present\.Count -ne \$installedShortcuts\.Count[\s\S]{0,220}?return \$null/,
    "Shortcut refresh may skip a machine with no Aura links, but must reject a partial four-link set");
  const pinnedShortcutScanner = powershellFunction("Get-AuraUiPinnedTaskbarShortcuts");
  assert.match(pinnedShortcutScanner,
    /Microsoft\\Internet Explorer\\Quick Launch\\User Pinned\\TaskBar[\s\S]{0,700}?ReparsePoint[\s\S]{0,500}?TopDirectoryOnly[\s\S]{0,180}?\$inspected -gt 256/,
    "Pinned shortcut discovery must be top-level, bounded, contained in AppData, and reparse-safe");
  assert.equal((pinnedShortcutScanner.match(/Test-AuraUiOwnedShortcutTarget/g) ?? []).length, 2,
    "A taskbar pin must match the exact installed main or Studio launch contract");
  assert.match(pinnedShortcutScanner,
    /Get-AuraShortcutAppUserModelId -Path \$candidateFull[\s\S]{0,260}?\$AuraAppUserModelId[\s\S]{0,220}?continue/,
    "A taskbar pin carrying another AppUserModelID must be left unchanged");
  assert.match(ownedShortcutUpdater,
    /Get-AuraUiPinnedTaskbarShortcuts[\s\S]{0,220}?\$ownedShortcuts = @\(\$installedShortcuts\) \+ \$pinnedShortcuts/,
    "Target-validated pinned copies must join the installed shortcut transaction");
  const shortcutValidationIndex = ownedShortcutUpdater.indexOf("foreach ($owned in $ownedShortcuts)");
  const shortcutValidatedIndex = ownedShortcutUpdater.indexOf("$validated.Add(", shortcutValidationIndex);
  const shortcutMutationIndex = ownedShortcutUpdater.indexOf("foreach ($entry in $validated)", shortcutValidatedIndex);
  assert(shortcutValidationIndex >= 0 && shortcutValidatedIndex > shortcutValidationIndex
      && shortcutMutationIndex > shortcutValidatedIndex,
  "All installed and pinned Aura shortcuts must be validated before the first shortcut is mutated");
  assert.match(ownedShortcutUpdater,
    /foreach \(\$owned in \$ownedShortcuts\)[\s\S]{0,300}?ReparsePoint[\s\S]{0,500}?Test-AuraUiOwnedShortcutTarget[\s\S]{0,500}?Get-AuraShortcutAppUserModelId[\s\S]{0,500}?\$validated\.Add\(/,
    "Every shortcut must be non-redirected and match Aura's exact target and AppUserModelID contract before mutation");
  assert.match(ownedShortcutUpdater,
    /\$iconCurrent[\s\S]{0,220}?\$appIdCurrent[\s\S]{0,500}?Set-AuraShortcutAppUserModelId -Path \$entry\.Path[\s\S]{0,100}?\$changed\.Add\(\$entry\)/,
    "Each changed shortcut must commit both its current theme icon and Aura AppUserModelID");
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
    /\$rollback\.Save\(\)[\s\S]{0,120}?Set-AuraShortcutAppUserModelId -Path \$validated\[\$rollbackIndex\]\.Path[\s\S]{0,140}?PreviousAppUserModelId/,
    "Internal rollback must restore the prior shortcut AppUserModelID with its icon");
  assert.match(ownedShortcutUpdater,
    /\$rollbackComplete = \$false[\s\S]{0,700}?if \(-not \$rollbackComplete\)\s*\{[\s\S]{0,220}?Success = \$false[\s\S]{0,180}?RollbackIncomplete = \$true/,
    "An incomplete internal shortcut rollback must be reported distinctly, never collapsed to an ordinary candidate miss");
  assert.match(ownedShortcutUpdater,
    /SHChangeNotify\(0x00002000,\s*0x0005,\s*\$entry\.Path[\s\S]*?SHChangeNotify\(0x08000000/,
    "Explorer must be notified after owned shortcut icons change");
  assert.match(ownedShortcutUpdater,
    /return \[PSCustomObject\]@\{\s*Success = \$true;\s*Managed = \$true;\s*Changes = @\(\$changed\)\s*\}/,
    "A successful shell-shortcut transaction must return the exact rollback snapshot");
  const ownedShortcutRollback = powershellFunction("Restore-AuraUiOwnedShortcuts");
  assert.match(ownedShortcutRollback,
    /\$null -eq \$Snapshot[\s\S]{0,180}?\$Snapshot\.Managed[\s\S]{0,180}?\$Snapshot\.Changes[\s\S]{0,500}?foreach \(\$entry in @\(\$Snapshot\.Changes\)\)[\s\S]{0,300}?\$shortcut\.IconLocation = \$entry\.PreviousIcon[\s\S]{0,120}?\$shortcut\.Save\(\)[\s\S]{0,160}?PreviousAppUserModelId/,
    "Coordinator rollback must restore every changed shortcut icon and AppUserModelID");
  assert.match(ownedShortcutRollback,
    /\$restored = \$false[\s\S]{0,500}?return \$restored/,
    "Shortcut rollback must report incomplete restoration instead of claiming success");
  assert(!/ExtractAssociatedIcon|Claude\.exe|Get-AuraClaudeInstall/i.test(ownedShortcutUpdater),
    "Dynamic shortcut identity must never borrow a Claude executable icon");
  assert.match(common,
    /9F4C2855-9F79-4B39-A8D0-E1D42DE1D5F3["']\),\s*5\)/,
    "Shortcut identity must use the documented System.AppUserModel.ID property key");
  assert.match(common,
    /IPropertyStore[\s\S]{0,2600}?SetValue\(ref key, ref value\)[\s\S]{0,180}?persist\.Save\(path, true\)/,
    "Shortcut AppUserModelID writes must use the Shell property store and persist the link");
  assert.match(common,
    /VariantBasicString\s*=\s*8[\s\S]{0,140}?VariantUnicodeString\s*=\s*31[\s\S]{0,1800}?ValueType == VariantBasicString[\s\S]{0,180}?PtrToStringBSTR[\s\S]{0,220}?ValueType == VariantUnicodeString[\s\S]{0,180}?PtrToStringUni/,
    "Shortcut AppUserModelID reads must accept both Inno Setup BSTR values and Aura LPWSTR values");
  assert.match(common,
    /ValueType == VariantUnicodeString[\s\S]{0,260}?unsupported AppUserModelID property type/,
    "Shortcut AppUserModelID reads must continue rejecting non-string property types");
  if (process.platform === "win32") {
    // Windows CI runners can expose TMP through an 8.3 short path. Resolve the
    // real path once because the probe compares shortcut paths and arguments.
    const shortcutProbeRoot = realpathSync.native(
      await fs.mkdtemp(path.join(os.tmpdir(), "aura-shortcut-appid-")));
    try {
      const commonPath = path.join(PROJECT_ROOT, "windows", "common.ps1").replaceAll("'", "''");
      const probePath = shortcutProbeRoot.replaceAll("'", "''");
      const shortcutIdentityRegression = [
        "$ErrorActionPreference='Stop'",
        `. '${commonPath}'`,
        powershellFunction("Test-AuraUiOwnedShortcutTarget"),
        pinnedShortcutScanner,
        "function Write-AuraUiLog { param([string]$Message); $script:ProbeLogs.Add($Message) }",
        `$testRoot='${probePath}'`,
        "$env:APPDATA=Join-Path $testRoot 'AppData'",
        "$taskbarRoot=Join-Path $env:APPDATA 'Microsoft\\Internet Explorer\\Quick Launch\\User Pinned\\TaskBar'",
        "[void][IO.Directory]::CreateDirectory($taskbarRoot)",
        "$expectedPowerShell=[IO.Path]::GetFullPath((Get-Command powershell.exe -ErrorAction Stop).Source)",
        "$expectedScript=Join-Path $testRoot 'app\\windows\\aura-ui.ps1'",
        "$baseArguments='-NoProfile -STA -ExecutionPolicy Bypass -WindowStyle Hidden -File \"' + $expectedScript + '\"'",
        "$studioArguments=\"$baseArguments -OpenStudio\"",
        "$shell=New-Object -ComObject WScript.Shell",
        "$shortcut=$null",
        // Report the live shortcut/property-store state if a runner-only
        // assertion fails, without weakening any assertion.
        "function Get-AuraProbeState {",
        "  param([object[]]$Found=@())",
        "  $lines=[Collections.Generic.List[string]]::new()",
        "  $lines.Add(\"expected target:    $expectedPowerShell\")",
        "  $lines.Add(\"expected arguments: $baseArguments\")",
        "  $lines.Add(\"expected pin:       $pinPath\")",
        "  $lines.Add(\"discovered $($Found.Count) shortcut(s)\")",
        "  foreach($entry in $Found){ $lines.Add(\"  discovered: $($entry.Path)\") }",
        "  foreach($probe in @($pinPath,$otherPath)){",
        "    $lines.Add(\"  link: $probe\")",
        "    try {",
        "      $link=$shell.CreateShortcut($probe)",
        "      try {",
        "        $lines.Add(\"    target:    $($link.TargetPath)\")",
        "        $lines.Add(\"    arguments: $($link.Arguments)\")",
        "      } finally { [void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($link) }",
        "      $lines.Add(\"    appid:     $(Get-AuraShortcutAppUserModelId -Path $probe)\")",
        "    } catch { $lines.Add(\"    unreadable: $($_.Exception.Message)\") }",
        "  }",
        "  $lines.Add(\"skip log entries: $($script:ProbeLogs.Count)\")",
        "  foreach($message in $script:ProbeLogs){ $lines.Add(\"  logged: $message\") }",
        "  return ($lines -join [Environment]::NewLine)",
        "}",
        "try {",
        "  $pinPath=Join-Path $taskbarRoot 'Claude Aura.lnk'",
        "  $shortcut=$shell.CreateShortcut($pinPath)",
        "  $shortcut.TargetPath=$expectedPowerShell",
        "  $shortcut.Arguments=$baseArguments",
        "  $shortcut.IconLocation=\"$expectedPowerShell,0\"",
        "  $shortcut.Save()",
        "  [void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($shortcut)",
        "  $shortcut=$null",
        "  $otherPath=Join-Path $taskbarRoot 'Claude Aura custom.lnk'",
        "  $shortcut=$shell.CreateShortcut($otherPath)",
        "  $shortcut.TargetPath=$expectedPowerShell",
        "  $shortcut.Arguments=$baseArguments",
        "  $shortcut.IconLocation=\"$expectedPowerShell,0\"",
        "  $shortcut.Save()",
        "  [void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($shortcut)",
        "  $shortcut=$null",
        "  Initialize-AuraShortcutPropertyStore",
        "  Set-AuraShortcutAppUserModelId -Path $pinPath",
        "  [AuraShortcutPropertyStore]::SetAppUserModelId($otherPath,'Other.Product')",
        "  if((Get-AuraShortcutAppUserModelId -Path $otherPath) -cne 'Other.Product'){throw 'Foreign AppUserModelID fixture setup failed'}",
        "  $script:ProbeExpectedPowerShell=$expectedPowerShell",
        "  $script:ProbeMainArguments=$baseArguments",
        "  $probeShell=[PSCustomObject]@{}",
        "  Add-Member -InputObject $probeShell -MemberType ScriptMethod -Name CreateShortcut -Value { param([string]$path); return [PSCustomObject]@{TargetPath=$script:ProbeExpectedPowerShell;Arguments=$script:ProbeMainArguments} }",
        "  $script:ProbeLogs=[Collections.Generic.List[string]]::new()",
        "  $found=@(Get-AuraUiPinnedTaskbarShortcuts -Shell $probeShell -ExpectedPowerShell $expectedPowerShell -ExpectedScript $expectedScript -MainArguments $baseArguments -StudioArguments $studioArguments)",
        "  if($found.Count -ne 1 -or -not [string]::Equals($found[0].Path,$pinPath,[StringComparison]::OrdinalIgnoreCase)){",
        "    Write-Output (Get-AuraProbeState -Found $found)",
        "    throw 'Pinned Aura shortcut discovery mismatch'",
        "  }",
        "  if($script:ProbeLogs.Count -ne 1){",
        "    Write-Output (Get-AuraProbeState -Found $found)",
        "    throw 'Foreign AppUserModelID pin was not explicitly skipped'",
        "  }",
        "  Set-AuraShortcutAppUserModelId -Path $pinPath",
        "  if((Get-AuraShortcutAppUserModelId -Path $pinPath) -cne $AuraAppUserModelId){",
        "    Write-Output (Get-AuraProbeState -Found $found)",
        "    throw 'Aura AppUserModelID assignment mismatch'",
        "  }",
        "  Set-AuraShortcutAppUserModelId -Path $pinPath -AppUserModelId $null",
        "  if(Get-AuraShortcutAppUserModelId -Path $pinPath){",
        "    Write-Output (Get-AuraProbeState -Found $found)",
        "    throw 'Aura AppUserModelID rollback mismatch'",
        "  }",
        "} finally {",
        "  if($null -ne $shortcut -and [Runtime.InteropServices.Marshal]::IsComObject($shortcut)){[void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($shortcut)}",
        "  if([Runtime.InteropServices.Marshal]::IsComObject($shell)){[void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($shell)}",
        "}",
      ].join("\n");
      run("powershell.exe", [
        "-NoProfile",
        "-STA",
        "-ExecutionPolicy",
        "Bypass",
        "-EncodedCommand",
        Buffer.from(shortcutIdentityRegression, "utf16le").toString("base64"),
      ]);
    } finally {
      await fs.rm(shortcutProbeRoot, { recursive: true, force: true });
    }
  }

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
  const hostWorkStart = ui.indexOf("$script:HostWorkAction = [Action]{");
  const hostWorkIdentityEnd = ui.indexOf("Update-AuraDraftHandoff", hostWorkStart);
  const hostWorkIdentityRetry = ui.slice(hostWorkStart, hostWorkIdentityEnd);
  assert(hostWorkStart >= 0 && hostWorkIdentityEnd > hostWorkStart,
    "The event-driven Jump List retry block is missing");
  assert.match(hostWorkIdentityRetry,
    /Register-AuraUiJumpList[\s\S]{0,300}?\$script:JumpListRegistered[\s\S]{0,400}?\[string\]::Equals\(\$script:JumpListIdentityPath,\s*\$script:ShellIdentityIconPath[\s\S]{0,180}?Remove-AuraUiUnusedShortcutIcons -KeepPath \$script:ShellIdentityIconPath/,
    "Deferred cleanup must also prove the retried Jump List matches the current identity");
  assert(!ui.includes("$timer.Interval = 60") && !ui.includes("WaitOne(0)"),
    "Aura must not retain its 60 ms task and named-signal polling loop");
  assert.match(ui,
    /public static class AuraUiAsyncDispatch[\s\S]{0,800}?BeginInvoke[\s\S]{0,1000}?ContinueWith/,
    "Task completion must marshal host work back to the UI thread");
  assert.match(ui, /ThreadPool\.RegisterWaitForSingleObject/,
    "Named Aura signals must use registered waits instead of UI polling");
  assert.match(powershellFunction("Initialize-AuraUiEventDispatch"),
    /add_Tick\(\{[\s\S]{0,120}?\.Stop\(\)[\s\S]{0,120}?Request-AuraUiHostWork/,
    "Host deadlines must use a self-stopping one-shot timer");
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
  assert.deepEqual(Object.keys(uiCopy).sort(), [...STUDIO_LOCALES].sort());
  const copyKeys = Object.keys(uiCopy.en).sort();
  for (const locale of ["zh-CN", "zh-HKTW"]) {
    assert.deepEqual(Object.keys(uiCopy[locale]).sort(), copyKeys, `${locale} UI copy is incomplete`);
    for (const key of copyKeys) assert(String(uiCopy[locale][key]).trim(), `${locale}.${key} is empty`);
  }
  assert.equal(uiCopy["zh-CN"].customizeThemes, "\u81ea\u5b9a\u4e49\u4e3b\u9898");
  assert.equal(uiCopy["zh-HKTW"].customizeThemes, "\u81ea\u8a02\u4e3b\u984c");
  assert.notEqual(uiCopy["zh-CN"].themeApplyDescription, uiCopy["zh-HKTW"].themeApplyDescription);
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
    "zh-HKTW": {
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
    const terminalExportResultRegression = [
      "$ErrorActionPreference='Stop'",
      `$uiPath='${path.join(PROJECT_ROOT, "windows", "aura-ui.ps1").replaceAll("'", "''")}'`,
      "$tokens=$null;$errors=$null",
      "$ast=[System.Management.Automation.Language.Parser]::ParseFile($uiPath,[ref]$tokens,[ref]$errors)",
      "if($errors.Count){throw 'Could not parse Aura UI for terminal export result regression'}",
      "foreach($name in @('Test-AuraUiStudioExactProperties','Assert-AuraUiTerminalThemeExportResult','Get-AuraUiClaudeCodeThemesDirectory')){",
      "  $definition=$ast.Find({param($node)$node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -ceq $name},$true)",
      "  if($null -eq $definition){throw \"Missing terminal export result function $name\"}",
      "  Invoke-Expression $definition.Extent.Text",
      "}",
      "function Assert-FixedRejected { param([scriptblock]$Operation,[string]$Label);try{&$Operation|Out-Null}catch{if($_.Exception.Message -cne 'The terminal theme helper returned an invalid result.'){throw \"$Label exposed private details\"};return};throw \"$Label was accepted\" }",
      "$root=[IO.Path]::GetTempPath()",
      "$light=Join-Path $root 'aura-terminal-light.json'",
      "$dark=Join-Path $root 'aura-terminal-dark.json'",
      "$lightReturned=Join-Path $root 'nested\\..\\aura-terminal-light.json'",
      "$darkReturned=Join-Path $root 'nested\\..\\aura-terminal-dark.json'",
      "$digest=('a'*64)-join ''",
      "$valid=[pscustomobject][ordered]@{pass=$true;theme='default';files=@(",
      "  [pscustomobject][ordered]@{mode='light';path=$lightReturned;sha256=$digest},",
      "  [pscustomobject][ordered]@{mode='dark';path=$darkReturned;sha256=$digest}",
      ")}",
      "if(-not (Assert-AuraUiTerminalThemeExportResult -Result $valid -Theme 'default' -LightPath $light -DarkPath $dark)){throw 'Valid terminal pair was rejected'}",
      "$extraTop=$valid|ConvertTo-Json -Depth 6|ConvertFrom-Json;$extraTop|Add-Member -NotePropertyName outputDirectory -NotePropertyValue $root",
      "Assert-FixedRejected { Assert-AuraUiTerminalThemeExportResult -Result $extraTop -Theme 'default' -LightPath $light -DarkPath $dark } 'an extra top-level property'",
      "$extraFile=$valid|ConvertTo-Json -Depth 6|ConvertFrom-Json;$extraFile.files[0]|Add-Member -NotePropertyName bytes -NotePropertyValue 1",
      "Assert-FixedRejected { Assert-AuraUiTerminalThemeExportResult -Result $extraFile -Theme 'default' -LightPath $light -DarkPath $dark } 'an extra file property'",
      "$scalarFiles=$valid|ConvertTo-Json -Depth 6|ConvertFrom-Json;$scalarFiles.files=$scalarFiles.files[0]",
      "Assert-FixedRejected { Assert-AuraUiTerminalThemeExportResult -Result $scalarFiles -Theme 'default' -LightPath $light -DarkPath $dark } 'a scalar files value'",
      "$badMode=$valid|ConvertTo-Json -Depth 6|ConvertFrom-Json;$badMode.files[0].mode='dark'",
      "Assert-FixedRejected { Assert-AuraUiTerminalThemeExportResult -Result $badMode -Theme 'default' -LightPath $light -DarkPath $dark } 'an incorrect mode'",
      "$badPath=$valid|ConvertTo-Json -Depth 6|ConvertFrom-Json;$badPath.files[1].path=(Join-Path $root 'other.json')",
      "Assert-FixedRejected { Assert-AuraUiTerminalThemeExportResult -Result $badPath -Theme 'default' -LightPath $light -DarkPath $dark } 'a changed destination'",
      "$badDigest=$valid|ConvertTo-Json -Depth 6|ConvertFrom-Json;$badDigest.files[1].sha256=(('A'*64)-join '')",
      "Assert-FixedRejected { Assert-AuraUiTerminalThemeExportResult -Result $badDigest -Theme 'default' -LightPath $light -DarkPath $dark } 'an uppercase digest'",
      "$missingDigest=$valid|ConvertTo-Json -Depth 6|ConvertFrom-Json;$missingDigest.files[0].PSObject.Properties.Remove('sha256')",
      "Assert-FixedRejected { Assert-AuraUiTerminalThemeExportResult -Result $missingDigest -Theme 'default' -LightPath $light -DarkPath $dark } 'a missing digest'",
      "$locationRoot=Join-Path $root ('aura-terminal-location-'+[Guid]::NewGuid().ToString('N'))",
      "$overrideConfig=Join-Path $locationRoot 'override-config'",
      "$overrideThemes=Join-Path $overrideConfig 'themes'",
      "$profileRoot=Join-Path $locationRoot 'profile'",
      "$defaultThemes=Join-Path (Join-Path $profileRoot '.claude') 'themes'",
      "$noThemesConfig=Join-Path $locationRoot 'no-themes-config'",
      "$originalOverride=[Environment]::GetEnvironmentVariable('CLAUDE_CONFIG_DIR')",
      "$originalProfile=[Environment]::GetEnvironmentVariable('USERPROFILE')",
      "try{",
      "  [void][IO.Directory]::CreateDirectory($overrideThemes)",
      "  [void][IO.Directory]::CreateDirectory($defaultThemes)",
      "  [void][IO.Directory]::CreateDirectory($noThemesConfig)",
      "  [Environment]::SetEnvironmentVariable('USERPROFILE',$profileRoot)",
      "  [Environment]::SetEnvironmentVariable('CLAUDE_CONFIG_DIR',$overrideConfig)",
      "  $resolved=Get-AuraUiClaudeCodeThemesDirectory",
      "  if(-not [string]::Equals($resolved,[IO.Path]::GetFullPath($overrideThemes),[StringComparison]::OrdinalIgnoreCase)){throw 'CLAUDE_CONFIG_DIR did not take precedence'}",
      "  [Environment]::SetEnvironmentVariable('CLAUDE_CONFIG_DIR',$null)",
      "  $resolved=Get-AuraUiClaudeCodeThemesDirectory",
      "  if(-not [string]::Equals($resolved,[IO.Path]::GetFullPath($defaultThemes),[StringComparison]::OrdinalIgnoreCase)){throw 'Unset override did not use USERPROFILE fallback'}",
      "  [Environment]::SetEnvironmentVariable('CLAUDE_CONFIG_DIR','relative-config')",
      "  if($null -ne (Get-AuraUiClaudeCodeThemesDirectory)){throw 'Relative override fell back to USERPROFILE'}",
      "  [Environment]::SetEnvironmentVariable('CLAUDE_CONFIG_DIR',(Join-Path $locationRoot 'missing-config'))",
      "  if($null -ne (Get-AuraUiClaudeCodeThemesDirectory)){throw 'Missing absolute override fell back to USERPROFILE'}",
      "  [Environment]::SetEnvironmentVariable('CLAUDE_CONFIG_DIR',$noThemesConfig)",
      "  if($null -ne (Get-AuraUiClaudeCodeThemesDirectory)){throw 'Override without themes fell back to USERPROFILE'}",
      "  if([IO.Directory]::Exists((Join-Path $noThemesConfig 'themes'))){throw 'Resolver created a missing themes directory'}",
      "}finally{",
      "  [Environment]::SetEnvironmentVariable('CLAUDE_CONFIG_DIR',$originalOverride)",
      "  [Environment]::SetEnvironmentVariable('USERPROFILE',$originalProfile)",
      "  if([IO.Directory]::Exists($locationRoot)){[IO.Directory]::Delete($locationRoot,$true)}",
      "}",
    ].join("\n");
    run("powershell.exe", ["-NoProfile", "-EncodedCommand",
      Buffer.from(terminalExportResultRegression, "utf16le").toString("base64")]);

    const privateNodeDiagnosticsRegression = [
      "$ErrorActionPreference='Stop'",
      `$uiPath='${path.join(PROJECT_ROOT, "windows", "aura-ui.ps1").replaceAll("'", "''")}'`,
      "$tokens=$null;$errors=$null",
      "$ast=[System.Management.Automation.Language.Parser]::ParseFile($uiPath,[ref]$tokens,[ref]$errors)",
      "if($errors.Count){throw 'Could not parse Aura UI for private Node diagnostics regression'}",
      "foreach($name in @('ConvertTo-AuraUiArgument','Invoke-AuraUiNode')){",
      "  $definition=$ast.Find({param($node)$node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -ceq $name},$true)",
      "  if($null -eq $definition){throw \"Missing private Node diagnostics function $name\"}",
      "  Invoke-Expression $definition.Extent.Text",
      "}",
      "$script:Node=[pscustomobject]@{Path='" + process.execPath.replaceAll("'", "''") + "'}",
      "$script:LogMessages=[Collections.Generic.List[string]]::new()",
      "function Write-AuraUiLog { param([string]$Message);$script:LogMessages.Add($Message) }",
      "$failed=$false",
      "try{Invoke-AuraUiNode -PrivateDiagnostics -CommandArguments @('-e','process.stderr.write(\"C:/private/theme.json\");process.exit(7)')|Out-Null}",
      "catch{$failed=$true;if($_.Exception.Message -cne 'A private Claude Aura helper operation failed.'){throw 'Private helper exposed its stderr'}}",
      "if(-not $failed){throw 'Private helper failure was not reported'}",
      "if($script:LogMessages.Count -ne 0){throw 'Private helper failure reached the log'}",
      "$result=Invoke-AuraUiNode -PrivateDiagnostics -CommandArguments @('-e','process.stderr.write(\"C:/private/theme.json\");process.stdout.write(\"ok\")')",
      "if($result -cne 'ok'){throw 'Private helper changed successful stdout'}",
      "if($script:LogMessages.Count -ne 0){throw 'Private helper warning reached the log'}",
    ].join("\n");
    run("powershell.exe", ["-NoProfile", "-EncodedCommand",
      Buffer.from(privateNodeDiagnosticsRegression, "utf16le").toString("base64")]);

    const compactPayloadStateRegression = [
      "$ErrorActionPreference='Stop'",
      `$uiPath='${path.join(PROJECT_ROOT, "windows", "aura-ui.ps1").replaceAll("'", "''")}'`,
      "$tokens=$null;$errors=$null",
      "$ast=[System.Management.Automation.Language.Parser]::ParseFile($uiPath,[ref]$tokens,[ref]$errors)",
      "if($errors.Count){throw 'Could not parse Aura UI for compact payload-state regression'}",
      "foreach($name in @('Get-AuraUiPropertyValue','ConvertFrom-AuraUiPayloadSettings','Set-AuraUiPayloadState')){",
      "  $definition=$ast.Find({param($node)$node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -ceq $name},$true)",
      "  if($null -eq $definition){throw \"Missing payload-state function $name\"}",
      "  Invoke-Expression $definition.Extent.Text",
      "}",
      "function Set-AuraUiDocumentPrepaintSource { param([string]$Payload) }",
      "function Update-AuraUiLauncherStyle {}",
      "function Update-AuraUiLoadingTheme {}",
      "function Update-AuraUiLauncherPosition {}",
      "$script:ActiveThemeName=$null;$script:ActivePayloadDigest=$null;$script:ActiveLabel='honest label'",
      "$digest=('a' * 64) -join ''",
      "$poisonDigest=('b' * 64) -join ''",
      "$css='body::before{content:''\"\"t\"\":\"\"poison-theme\"\" \"\"x\"\":\"\"' + $poisonDigest + '\"\" \"\"label\"\":\"\"poison label\"\"''}'",
      "$settings=[ordered]@{t='studio-copy';x=$digest}",
      "$payload='(() => {})(' + (ConvertTo-Json $css -Compress) + ',' + ($settings|ConvertTo-Json -Compress) + ')'",
      "Set-AuraUiPayloadState -Payload $payload",
      "if($script:ActiveThemeName -cne 'studio-copy'){throw 'Compact payload theme key did not update ActiveThemeName'}",
      "if($script:ActivePayloadDigest -cne $digest){throw 'Compact payload digest key did not update ActivePayloadDigest'}",
      "if($script:ActiveLabel -cne 'honest label'){throw 'CSS text impersonated the stripped runtime label'}",
    ].join("\n");
    run("powershell.exe", ["-NoProfile", "-EncodedCommand",
      Buffer.from(compactPayloadStateRegression, "utf16le").toString("base64")]);

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

    const loadingCoverRegression = [
      "$ErrorActionPreference='Stop'",
      "Add-Type -AssemblyName System.Windows.Forms",
      "Add-Type -AssemblyName System.Drawing",
      `$uiPath='${path.join(PROJECT_ROOT, "windows", "aura-ui.ps1").replaceAll("'", "''")}'`,
      `$ThemeArtRoot='${path.join(PROJECT_ROOT, "assets", "theme-art").replaceAll("'", "''")}'`,
      "$tokens=$null;$errors=$null",
      "$ast=[System.Management.Automation.Language.Parser]::ParseFile($uiPath,[ref]$tokens,[ref]$errors)",
      "if($errors.Count){throw 'Could not parse Aura UI for loading-cover regression'}",
      "$names=@('Get-AuraUiPropertyValue','Get-AuraUiThemeByName','Get-AuraUiSelectedThemeName','Get-AuraUiEnabled','Get-AuraUiPermanentThemeIds','Get-AuraUiLoadingThemeId','Get-AuraUiLoadingColorValue','Get-AuraUiLoadingProfile','Get-AuraUiLoadingScale','New-AuraUiLoadingMarkBitmap','New-AuraUiRoundedRectanglePath','ConvertTo-AuraUiBlendedColor','Paint-AuraUiLoadingPanel','Update-AuraUiLoadingBackground','Set-AuraUiRoundedControlRegion','Set-AuraUiLoadingLayout')",
      "foreach($name in $names){",
      "  $definition=$ast.Find({param($node)$node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -ceq $name},$true)",
      "  if($null -eq $definition){throw \"Missing loading-cover function $name\"}",
      "  Invoke-Expression $definition.Extent.Text",
      "}",
      "function Test-AuraUiDarkChrome { return $false }",
      "function Test-AuraUiLoadingAnimationEnabled { return $false }",
      "function Write-AuraUiLog { param([string]$Message);throw $Message }",
      "$script:Config=[pscustomobject]@{enabled=$true;appearance='light';theme='default'}",
      "$script:StudioEditorState=[ordered]@{active=$false}",
      "$ids=@(Get-AuraUiPermanentThemeIds)",
      "$cues=@('orbit','editorial-rule','facet','ink-frame','horizon','folio','ribbon','capsule')",
      "$script:Themes=@()",
      "foreach($id in $ids){",
      "  $style=[pscustomobject]@{",
      "    light=[pscustomobject]@{canvas='#F1F2F9';raised='#FBFCFE';text='#171A31';textMuted='#5F647C';accent='#4721A1';accentText='#FFFFFF';border='#21243B'}",
      "    dark=[pscustomobject]@{canvas='#1B1D2C';raised='#282B3E';text='#E9ECF6';textMuted='#979DB4';accent='#BA8BF4';accentText='#0F101F';border='#B2BADC'}",
      "  }",
      "  $script:Themes+=,[pscustomobject]@{name=$id;source='builtin';sourceRecipe=$null;studioStyle=$style}",
      "}",
      "$script:LoadingPanel=[System.Windows.Forms.Panel]::new()",
      "$script:LoadingPanel.ClientSize=[Drawing.Size]::new(1180,640)",
      "$script:LoadingPanel.BackColor=[Drawing.ColorTranslator]::FromHtml('#F1F2F9')",
      "$script:LoadingMark=[System.Windows.Forms.PictureBox]::new()",
      "$script:LoadingMark.Size=[Drawing.Size]::new(88,88)",
      "$script:LoadingLabel=[System.Windows.Forms.Label]::new()",
      "$script:LoadingLabel.Size=[Drawing.Size]::new(500,44)",
      "$script:LoadingProgress=[System.Windows.Forms.Panel]::new()",
      "$script:LoadingProgress.Size=[Drawing.Size]::new(320,6)",
      "$script:LoadingProgressIndicator=[System.Windows.Forms.Panel]::new()",
      "$script:LoadingProgressIndicator.Size=[Drawing.Size]::new(90,6)",
      "$script:LoadingProgress.Controls.Add($script:LoadingProgressIndicator)",
      "$script:RetryButton=[System.Windows.Forms.Button]::new()",
      "$script:RetryButton.Size=[Drawing.Size]::new(96,38)",
      "$script:LoadingPanel.Controls.AddRange(@($script:LoadingMark,$script:LoadingLabel,$script:LoadingProgress,$script:RetryButton))",
      "for($index=0;$index -lt $ids.Count;$index++){",
      "  $script:ActiveThemeName=$ids[$index]",
      "  $profile=Get-AuraUiLoadingProfile",
      "  if($profile.ThemeId -cne $ids[$index] -or $profile.Cue -cne $cues[$index]){throw \"Loading profile mismatch: $($ids[$index])\"}",
      "  $mark=New-AuraUiLoadingMarkBitmap -ThemeId $ids[$index]",
      "  if($null -eq $mark -or $mark.Width -ne 88 -or $mark.Height -ne 88){throw \"Loading mark mismatch: $($ids[$index])\"}",
      "  $mark.Dispose()",
      "  $script:LoadingProfile=$profile",
      "  Set-AuraUiLoadingLayout",
      "  Update-AuraUiLoadingBackground",
      "  if($null -eq $script:LoadingPanel.BackgroundImage -or $script:LoadingPanel.BackgroundImage.Width -ne 1180 -or $script:LoadingPanel.BackgroundImage.Height -ne 640){throw \"Loading background ownership mismatch: $($ids[$index])\"}",
      "  if($script:LoadingMark.Left -ne 546 -or $null -eq $script:LoadingProgress.Region -or $null -eq $script:LoadingProgressIndicator.Region){throw \"Loading portal layout mismatch: $($ids[$index])\"}",
      "  $bitmap=[Drawing.Bitmap]::new(1180,640)",
      "  $graphics=[Drawing.Graphics]::FromImage($bitmap)",
      "  try { Paint-AuraUiLoadingPanel -Graphics $graphics -Bounds ([Drawing.Rectangle]::new(0,0,1180,640)) }",
      "  finally { $graphics.Dispose();$bitmap.Dispose() }",
      "}",
      "$script:LoadingPanel.ClientSize=[Drawing.Size]::new(1770,960)",
      "$script:LoadingMark.Size=[Drawing.Size]::new(132,132)",
      "$script:LoadingLabel.Size=[Drawing.Size]::new(750,66)",
      "$script:LoadingProgress.Size=[Drawing.Size]::new(480,9)",
      "$script:LoadingProgressIndicator.Size=[Drawing.Size]::new(135,9)",
      "$script:RetryButton.Size=[Drawing.Size]::new(144,57)",
      "Set-AuraUiLoadingLayout",
      "Update-AuraUiLoadingBackground",
      "if($script:LoadingMark.Left -ne 819 -or $script:LoadingLabel.Top -le $script:LoadingMark.Bottom -or $script:LoadingProgress.Top -le $script:LoadingLabel.Bottom){throw 'Loading portal lost its 150 percent DPI spacing'}",
      "if($script:LoadingPanel.BackgroundImage.Width -ne 1770 -or $script:LoadingPanel.BackgroundImage.Height -ne 960){throw 'Loading portal lost its 150 percent DPI background'}",
      "$script:LoadingPanel.BackgroundImage.Dispose()",
      "$script:LoadingPanel.BackgroundImage=$null",
      "$script:LoadingPanel.Dispose()",
      "$copyStyle=[pscustomobject]@{",
      "  light=[pscustomobject]@{canvas='#010203';raised='#111213';text='#F0F1F2';textMuted='#A0A1A2';accent='#212223';accentText='#FFFFFF';border='#313233'}",
      "  dark=[pscustomobject]@{canvas='#040506';raised='#141516';text='#E0E1E2';textMuted='#909192';accent='#242526';accentText='#FFFFFF';border='#343536'}",
      "}",
      "$script:Themes+=,[pscustomobject]@{name='user-copy';source='user';sourceRecipe='korean-idol';studioStyle=$copyStyle}",
      "$script:ActiveThemeName='user-copy'",
      "$copyProfile=Get-AuraUiLoadingProfile",
      "if($copyProfile.ThemeId -cne 'korean-idol' -or $copyProfile.Cue -cne 'capsule' -or $copyProfile.Background.R -ne 1 -or $copyProfile.Background.G -ne 2 -or $copyProfile.Background.B -ne 3){throw 'Source-recipe loading inheritance lost the user theme palette'}",
      "$script:Themes+=,[pscustomobject]@{name='orphan-user';source='user';sourceRecipe=$null;studioStyle=$copyStyle}",
      "$script:ActiveThemeName='orphan-user'",
      "$orphanProfile=Get-AuraUiLoadingProfile",
      "if($orphanProfile.ThemeId -cne 'default' -or $orphanProfile.Background.R -ne 241 -or $orphanProfile.Background.G -ne 242 -or $orphanProfile.Background.B -ne 249){throw 'A user theme without a source recipe did not use complete Default loading presentation'}",
      "$script:Config.enabled=$false",
      "if((Get-AuraUiLoadingProfile).ThemeId -cne 'default'){throw 'Original look did not restore the Default loading profile'}",
    ].join("\n");
    run("powershell.exe", ["-NoProfile", "-EncodedCommand",
      Buffer.from(loadingCoverRegression, "utf16le").toString("base64")]);

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
      `$promptShelfPath='${psPath(path.join(PROJECT_ROOT, "windows", "aura-prompt-shelf.ps1"))}'`,
      `$testRoot='${psPath(editorRootsTestRoot)}'`,
      "$tokens=$null;$errors=$null",
      "$ast=[System.Management.Automation.Language.Parser]::ParseFile($uiPath,[ref]$tokens,[ref]$errors)",
      "if($errors.Count){throw 'Could not parse Aura UI for editor bridge regression'}",
      "foreach($name in @('Get-AuraUiPropertyValue','Get-AuraUiUnicodeScalarLength','ConvertTo-AuraUiStudioNumber','ConvertTo-AuraUiStudioInteger','Assert-AuraUiStudioEditorRoots','Test-AuraUiStudioExactProperties','Test-AuraUiStudioMetadataText','Assert-AuraUiStudioEditorPublicValue','Assert-AuraUiStudioEditorMessage','Test-AuraUiStudioDocumentUri','Get-AuraUiStudioMessage','Assert-AuraUiStudioEditorSession','Request-AuraUiMirror','ConvertTo-AuraUiGreetingShuffleCheckpoint')){",
      "  $definition=$ast.Find({param($node)$node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -ceq $name},$true)",
      "  if($null -eq $definition){throw \"Missing Studio editor bridge function $name\"}",
      "  Invoke-Expression $definition.Extent.Text",
      "}",
      "$promptTokens=$null;$promptErrors=$null",
      "$promptAst=[System.Management.Automation.Language.Parser]::ParseFile($promptShelfPath,[ref]$promptTokens,[ref]$promptErrors)",
      "if($promptErrors.Count){throw 'Could not parse Prompt Shelf for Studio bridge regression'}",
      "foreach($name in @('Test-AuraPromptShelfStudioUuid','Assert-AuraPromptShelfStudioRequest')){",
      "  $definition=$promptAst.Find({param($node)$node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -ceq $name},$true)",
      "  if($null -eq $definition){throw \"Missing Prompt Shelf Studio bridge function $name\"}",
      "  Invoke-Expression $definition.Extent.Text",
      "}",
      "function Assert-Rejected { param([scriptblock]$Operation,[string]$Label);$rejected=$false;try{&$Operation|Out-Null}catch{$rejected=$true};if(-not $rejected){throw \"Studio accepted $Label\"} }",
      "Add-Type -AssemblyName System.Windows.Forms",
      "$StudioLocaleIds=@('en','hi','es','fr','id','ja','ko','pt-BR','de','it','vi','pl','tr','zh-CN','zh-HKTW')",
      "$script:StudioMessageTypes=@('get-state','set-theme','set-appearance','set-locale','complete-studio-introduction','set-image','clear-image','set-avatar','clear-avatar','set-avatar-framing','set-image-framing','set-card-preview-crop','set-enabled','open-aura','open-desktop','import-theme','export-terminal-themes','create-theme-copy','begin-theme-edit','set-theme-token','set-theme-layer','apply-theme-patch','pick-theme-layer-image','pick-theme-launcher-mark','remove-theme-layer','move-theme-layer','undo-theme-edit','redo-theme-edit','save-theme-edit','discard-theme-edit','delete-user-theme','set-greeting-phrases','reset-greeting','set-aura-preview','set-aura-topmost','refresh-aura-mirror','prompt-shelf-read','prompt-shelf-create','prompt-shelf-update','prompt-shelf-move','prompt-shelf-delete','prompt-shelf-insert','prompt-shelf-confirm-checked')",
      "$script:PromptShelfMaxTextLength=8000",
      "$session='12345678-1234-4abc-8def-1234567890ab'",
      "$requestId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'",
      "$shelfSession='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'",
      "$itemId='0123456789abcdef0123456789abcdef'",
      "$source='https://aura.studio/index.html?locale=en&view=prompt-shelf'",
      "$script:StudioForm=[pscustomobject]@{IsDisposed=$false;Visible=$true}",
      "$script:Form=[pscustomobject]@{IsDisposed=$false;WindowState=[System.Windows.Forms.FormWindowState]::Normal}",
      "$script:MirrorDue=[DateTime]::UtcNow;$script:StudioEditorState=[pscustomobject]@{active=$false};Request-AuraUiMirror",
      "if($null -ne $script:MirrorDue){throw 'Inactive editor did not clear a pending mirror capture'}",
      "$script:StudioEditorState=[pscustomobject]@{active=$true};Request-AuraUiMirror",
      "if($null -eq $script:MirrorDue){throw 'Active editor could not schedule a mirror capture'}",
      "$script:StudioEditorState=[pscustomobject]@{active=$false}",
      "$valid=@(",
      "  [ordered]@{type='set-locale';locale='ja'},",
      "  [ordered]@{type='set-locale';locale='zh-HKTW'},",
      "  [ordered]@{type='complete-studio-introduction'},",
      "  [ordered]@{type='export-terminal-themes';theme='default'},",
      "  [ordered]@{type='create-theme-copy';theme='default'},",
      "  [ordered]@{type='begin-theme-edit';theme='user-theme';reset=$false},",
      "  [ordered]@{type='set-theme-token';session=$session;revision=0;mode='light';token='canvas';value='#123ABC'},",
      "  [ordered]@{type='set-theme-token';session=$session;revision=0;mode='shared';token='backgroundScope';value='full-window'},",
      "  [ordered]@{type='set-theme-layer';session=$session;revision=0;index=7;preset='wide';property='scale';value=3},",
      "  [ordered]@{type='apply-theme-patch';session=$session;revision=0;changes=@(",
      "    [ordered]@{kind='token';mode='shared';token='radius';value=12},",
      "    [ordered]@{kind='layer';index=0;preset='normal';property='scale';value=1.25},",
      "    [ordered]@{kind='metadata';field='label';locale='zh-HKTW';value='Studio Copy'},",
      "    [ordered]@{kind='metadata-locale';locale='ja';enabled=$true}",
      "  )},",
      "  [ordered]@{type='pick-theme-layer-image';session=$session;revision=0;index=-1;role='hero';appearance='dark';context='conversation'},",
      "  [ordered]@{type='move-theme-layer';session=$session;revision=0;index=7;direction='up'},",
      "  [ordered]@{type='undo-theme-edit';session=$session;revision=0},",
      "  [ordered]@{type='save-theme-edit';session=$session;revision=0},",
      "  [ordered]@{type='delete-user-theme';theme='user-theme'},",
      "  [ordered]@{type='set-greeting-phrases';session=$session;revision=0;enabled=$true;source='custom';displayName=(([char]::ConvertFromUtf32(0x1F642)*40)-join '');globalPhrases=@((([char]::ConvertFromUtf32(0x1F642)*120)-join ''),'Welcome, {name}');overrideMode='custom';overridePhrases=@('Theme hello')},",
      "  [ordered]@{type='reset-greeting';session=$session;revision=0},",
      "  [ordered]@{type='prompt-shelf-read';version=1;requestId=$requestId},",
      "  [ordered]@{type='prompt-shelf-create';version=1;requestId=$requestId;session=$shelfSession;revision=0;commandEpoch=0;text='Review this draft'},",
      "  [ordered]@{type='prompt-shelf-update';version=1;requestId=$requestId;session=$shelfSession;revision=0;commandEpoch=0;id=$itemId;text='Revised draft'},",
      "  [ordered]@{type='prompt-shelf-move';version=1;requestId=$requestId;session=$shelfSession;revision=0;commandEpoch=0;id=$itemId;direction='up'},",
      "  [ordered]@{type='prompt-shelf-delete';version=1;requestId=$requestId;session=$shelfSession;revision=0;commandEpoch=0;id=$itemId},",
      "  [ordered]@{type='prompt-shelf-insert';version=1;requestId=$requestId;session=$shelfSession;revision=0;commandEpoch=0;id=$itemId},",
      "  [ordered]@{type='prompt-shelf-confirm-checked';version=1;requestId=$requestId;session=$shelfSession;revision=0;commandEpoch=0}",
      ")",
      "foreach($message in $valid){$parsed=Get-AuraUiStudioMessage -Json ($message|ConvertTo-Json -Compress -Depth 8) -Source $source;if($parsed.type -cne $message.type){throw 'Valid editor message changed type'}}",
      "Assert-Rejected { Get-AuraUiStudioMessage -Json '{\"type\":4}' -Source $source } 'a non-string action type'",
      "Assert-Rejected { Get-AuraUiStudioMessage -Json '{\"type\":\"Set-Theme-Token\"}' -Source $source } 'a case-changed action'",
      "Assert-Rejected { Get-AuraUiStudioMessage -Json '{\"type\":\"get-state\"}' -Source 'https://evil.invalid/' } 'a message from another origin'",
      "Assert-Rejected { Get-AuraUiStudioMessage -Json '{\"type\":\"set-locale\"}' -Source $source } 'a locale action with no locale'",
      "Assert-Rejected { Get-AuraUiStudioMessage -Json '{\"type\":\"set-locale\",\"locale\":\"xx\"}' -Source $source } 'an unsupported locale'",
      "Assert-Rejected { Get-AuraUiStudioMessage -Json '{\"type\":\"set-locale\",\"locale\":4}' -Source $source } 'a non-string locale'",
      "Assert-Rejected { Get-AuraUiStudioMessage -Json '{\"type\":\"set-locale\",\"locale\":\"zh-hktw\"}' -Source $source } 'a case-changed locale'",
      "Assert-Rejected { Get-AuraUiStudioMessage -Json '{\"type\":\"set-locale\",\"locale\":\"en\",\"extra\":true}' -Source $source } 'an extra locale property'",
      "Assert-Rejected { Get-AuraUiStudioMessage -Json '{\"type\":\"complete-studio-introduction\",\"completed\":true}' -Source $source } 'an extra introduction property'",
      "$terminalExport=[ordered]@{type='export-terminal-themes';theme='default'}",
      "$terminalExportWithPath=[ordered]@{type='export-terminal-themes';theme='default';path='C:\\private\\theme.json'}",
      "Assert-Rejected { Get-AuraUiStudioMessage -Json ($terminalExportWithPath|ConvertTo-Json -Compress) -Source $source } 'a terminal export carrying a path'",
      "Assert-Rejected { Get-AuraUiStudioMessage -Json ($terminalExport|ConvertTo-Json -Compress) -Source 'https://aura.studio/not-index.html?locale=en' } 'a terminal export from another Studio path'",
      "$terminalExportBadTheme=[ordered]@{type='export-terminal-themes';theme='Default'}",
      "Assert-Rejected { Get-AuraUiStudioMessage -Json ($terminalExportBadTheme|ConvertTo-Json -Compress) -Source $source } 'a noncanonical terminal export theme'",
      "$promptRead=[ordered]@{type='prompt-shelf-read';version=1;requestId=$requestId}",
      "Assert-Rejected { Get-AuraUiStudioMessage -Json ($promptRead|ConvertTo-Json -Compress) -Source 'https://aura.studio/not-index.html' } 'a Prompt Shelf message from another Studio path'",
      "Assert-Rejected { Get-AuraUiStudioMessage -Json ($promptRead|ConvertTo-Json -Compress) -Source 'https://aura.studio/index.html?locale=en&view=prompt-shelf&extra=1' } 'a Prompt Shelf message with an extra URL parameter'",
      "Assert-Rejected { Get-AuraUiStudioMessage -Json ($promptRead|ConvertTo-Json -Compress) -Source 'https://aura.studio/index.html?locale=xx' } 'a Prompt Shelf message with an unsupported URL locale'",
      "$unsupportedPromptRead=[ordered]@{type='prompt-shelf-read';version=2;requestId=$requestId}",
      "Assert-Rejected { Get-AuraUiStudioMessage -Json ($unsupportedPromptRead|ConvertTo-Json -Compress) -Source $source } 'an unsupported Prompt Shelf bridge version'",
      "$insertWithBody=[ordered]@{type='prompt-shelf-insert';version=1;requestId=$requestId;session=$shelfSession;revision=0;commandEpoch=0;id=$itemId;text='private'}",
      "Assert-Rejected { Get-AuraUiStudioMessage -Json ($insertWithBody|ConvertTo-Json -Compress) -Source $source } 'a Prompt Shelf insertion carrying draft text'",
      "$badPromptItem=[ordered]@{type='prompt-shelf-delete';version=1;requestId=$requestId;session=$shelfSession;revision=0;commandEpoch=0;id='ABC'}",
      "Assert-Rejected { Get-AuraUiStudioMessage -Json ($badPromptItem|ConvertTo-Json -Compress) -Source $source } 'an invalid Prompt Shelf item id'",
      "$badPromptRevision=[ordered]@{type='prompt-shelf-move';version=1;requestId=$requestId;session=$shelfSession;revision=0.5;commandEpoch=0;id=$itemId;direction='up'}",
      "Assert-Rejected { Get-AuraUiStudioMessage -Json ($badPromptRevision|ConvertTo-Json -Compress) -Source $source } 'a fractional Prompt Shelf revision'",
      "$extraPromptConfirm=[ordered]@{type='prompt-shelf-confirm-checked';version=1;requestId=$requestId;session=$shelfSession;revision=0;commandEpoch=0;extra=$true}",
      "Assert-Rejected { Get-AuraUiStudioMessage -Json ($extraPromptConfirm|ConvertTo-Json -Compress) -Source $source } 'an extra Prompt Shelf confirmation property'",
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
      "$badScope=[ordered]@{type='set-theme-token';session=$session;revision=4;mode='shared';token='backgroundScope';value='page'}",
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
      "$badMetadataLocale=[ordered]@{type='apply-theme-patch';session=$session;revision=4;changes=@([ordered]@{kind='metadata';field='label';locale='ru';value='Theme'})}",
      "Assert-Rejected { Get-AuraUiStudioMessage -Json ($badMetadataLocale|ConvertTo-Json -Compress -Depth 8) -Source $source } 'an unsupported metadata locale'",
      "$longMetadataLabel=[ordered]@{type='apply-theme-patch';session=$session;revision=4;changes=@([ordered]@{kind='metadata';field='label';locale='en';value=('x'*81)})}",
      "Assert-Rejected { Get-AuraUiStudioMessage -Json ($longMetadataLabel|ConvertTo-Json -Compress -Depth 8) -Source $source } 'an 81-character theme name'",
      "$longMetadataDescription=[ordered]@{type='apply-theme-patch';session=$session;revision=4;changes=@([ordered]@{kind='metadata';field='description';locale='en';value=('x'*221)})}",
      "Assert-Rejected { Get-AuraUiStudioMessage -Json ($longMetadataDescription|ConvertTo-Json -Compress -Depth 8) -Source $source } 'a 221-character theme description'",
      "$caseChangedGreetingToken=[ordered]@{type='set-greeting-phrases';session=$session;revision=4;enabled=$true;source='custom';displayName='';globalPhrases=@('Hello, {NAME}');overrideMode='global';overridePhrases=@()}",
      "Assert-Rejected { Get-AuraUiStudioMessage -Json ($caseChangedGreetingToken|ConvertTo-Json -Compress -Depth 8) -Source $source } 'a case-changed greeting name token'",
      "$emoji=[char]::ConvertFromUtf32(0x1F642)",
      "$longGreetingName=[ordered]@{type='set-greeting-phrases';session=$session;revision=4;enabled=$true;source='custom';displayName=(($emoji*41)-join '');globalPhrases=@('Hello');overrideMode='global';overridePhrases=@()}",
      "Assert-Rejected { Get-AuraUiStudioMessage -Json ($longGreetingName|ConvertTo-Json -Compress -Depth 8) -Source $source } 'a 41-scalar greeting name'",
      "$longGreetingPhrase=[ordered]@{type='set-greeting-phrases';session=$session;revision=4;enabled=$true;source='custom';displayName='';globalPhrases=@((($emoji*121)-join ''));overrideMode='global';overridePhrases=@()}",
      "Assert-Rejected { Get-AuraUiStudioMessage -Json ($longGreetingPhrase|ConvertTo-Json -Compress -Depth 8) -Source $source } 'a 121-scalar greeting phrase'",
      "$canonicalDuplicate=[ordered]@{type='set-greeting-phrases';session=$session;revision=4;enabled=$true;source='custom';displayName='';globalPhrases=@(('e'+[char]0x301),'é');overrideMode='global';overridePhrases=@()}",
      "Assert-Rejected { Get-AuraUiStudioMessage -Json ($canonicalDuplicate|ConvertTo-Json -Compress -Depth 8) -Source $source } 'canonically equivalent duplicate greetings'",
      "$validShuffle=ConvertFrom-Json -InputObject ('{\"themeId\":\"user-theme\",\"phraseDigest\":\"'+('a'*64)+'\",\"order\":[1,0],\"cursor\":1,\"lastIndex\":1}')",
      "$shuffleCheckpoint=ConvertTo-AuraUiGreetingShuffleCheckpoint -Value $validShuffle -ExpectedTheme 'user-theme'",
      "if($shuffleCheckpoint.order -isnot [System.Array] -or $shuffleCheckpoint.order.Count -ne 2 -or $shuffleCheckpoint.order[0] -ne 1 -or $shuffleCheckpoint.lastIndex -ne 1){throw 'Valid greeting shuffle checkpoint changed shape'}",
      "$duplicateShuffle=ConvertFrom-Json -InputObject ('{\"themeId\":\"user-theme\",\"phraseDigest\":\"'+('a'*64)+'\",\"order\":[0,0],\"cursor\":1,\"lastIndex\":0}')",
      "Assert-Rejected { ConvertTo-AuraUiGreetingShuffleCheckpoint -Value $duplicateShuffle -ExpectedTheme 'user-theme' } 'a duplicate greeting shuffle index'",
      "Assert-Rejected { ConvertTo-AuraUiGreetingShuffleCheckpoint -Value $validShuffle -ExpectedTheme 'other-theme' } 'a greeting shuffle checkpoint for another theme'",
      "$extraShuffle=ConvertFrom-Json -InputObject ('{\"themeId\":\"user-theme\",\"phraseDigest\":\"'+('a'*64)+'\",\"order\":[1,0],\"cursor\":1,\"lastIndex\":1,\"phrase\":\"private\"}')",
      "Assert-Rejected { ConvertTo-AuraUiGreetingShuffleCheckpoint -Value $extraShuffle -ExpectedTheme 'user-theme' } 'a greeting shuffle checkpoint containing phrase text'",
      "$extraReset=[ordered]@{type='reset-greeting';session=$session;revision=4;extra=$true}",
      "Assert-Rejected { Get-AuraUiStudioMessage -Json ($extraReset|ConvertTo-Json -Compress) -Source $source } 'an extra reset-greeting property'",
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
    const editorBridgeScript = path.join(
      PROJECT_ROOT,
      "dist",
      `test-studio-editor-bridge-${process.pid}-${Date.now()}.ps1`,
    );
    try {
      const utf16leBom = Buffer.from([0xff, 0xfe]);
      await fs.writeFile(
        editorBridgeScript,
        Buffer.concat([utf16leBom, Buffer.from(editorBridgeRegression, "utf16le")]),
      );
      run("powershell.exe", [
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        editorBridgeScript,
      ]);
    } finally {
      await fs.rm(editorBridgeScript, { force: true });
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
  const uiCopy = await readHostCopy();

  assert.match(studioHtml,
    /class="rail-item" href="#prompt-shelf" data-studio-view="prompt-shelf" data-i18n="navPromptShelf"/,
    "Studio must expose Prompt Shelf as a permanent ordinary-shell destination");
  assert.match(studioHtml,
    /<section id="prompt-shelf" class="studio-page prompt-shelf-page" data-studio-page="prompt-shelf" aria-labelledby="prompt-shelf-title" aria-busy="false" hidden inert>/,
    "The Prompt Shelf destination must start as an inactive, labelled, host-busy-aware page");
  for (const id of [
    "prompt-shelf-new", "prompt-shelf-search", "prompt-shelf-count", "prompt-shelf-list",
    "prompt-shelf-text", "prompt-shelf-save", "prompt-shelf-cancel", "prompt-shelf-move-up",
    "prompt-shelf-move-down", "prompt-shelf-delete", "prompt-shelf-insert",
    "prompt-shelf-refresh", "prompt-shelf-retry-action", "prompt-shelf-confirm-checked",
    "prompt-shelf-status", "prompt-shelf-item-template",
    "prompt-shelf-delete-dialog", "prompt-shelf-delete-confirm", "prompt-shelf-delete-cancel",
  ]) {
    assert(studioHtml.includes(`id="${id}"`), `Studio Prompt Shelf is missing ${id}`);
  }
  assert.match(studioHtml,
    /<textarea id="prompt-shelf-text"[^>]+maxlength="8000"[^>]+aria-describedby="prompt-shelf-character-count prompt-shelf-status"/,
    "Prompt editing must keep its storage limit and announced count/status relationships");
  assert.match(studioHtml,
    /class="rail-item" href="#settings" data-studio-view="settings" data-i18n="navSettings"/,
    "Studio must expose Settings as a permanent ordinary-shell destination");
  assert.match(studioHtml,
    /<section id="settings" class="studio-page" data-studio-page="settings" aria-labelledby="settings-title" hidden inert>/,
    "The Settings destination must start as an inactive labelled page");
  const ordinaryPageEntries = [...studioHtml.matchAll(
    /<section id="([^"]+)"[^>]*data-studio-page="([^"]+)"/g,
  )].map((match) => [match[1], match[2]]);
  assert.deepEqual(ordinaryPageEntries, [
    ["themes", "themes"],
    ["prompt-shelf", "prompt-shelf"],
    ["background", "background"],
    ["create", "create"],
    ["settings", "settings"],
  ], "Studio must expose exactly five matching ordinary page IDs and route IDs");
  assert.match(studioHtml,
    /<section id="themes" class="studio-page is-current-page"[^>]*>[\s\S]{0,180}?<h1 id="themes-title" tabindex="-1"/,
    "Themes must be the only initially active page and expose a programmatic focus target");
  for (const view of ["prompt-shelf", "background", "create", "settings"]) {
    const pageTag = studioHtml.match(new RegExp(`<section id="${view}"[^>]*>`))?.[0] ?? "";
    assert.match(pageTag, /\shidden(?:\s|>)/, `${view} must be initially hidden`);
    assert.match(pageTag, /\sinert(?:\s|>)/, `${view} must be initially inert`);
  }
  const settingsLocales = [...studioHtml.matchAll(
    /<input type="radio" name="settings-locale" value="([^"]+)"/g,
  )].map((match) => match[1]);
  const welcomeLocales = [...studioHtml.matchAll(
    /<input type="radio" name="welcome-locale" value="([^"]+)"/g,
  )].map((match) => match[1]);
  assert.deepEqual(settingsLocales, STUDIO_LOCALES,
    "Settings must expose every supported Studio locale in its canonical order");
  assert.deepEqual(welcomeLocales, settingsLocales,
    "The welcome guide and Settings must offer the same exact locale set");
  const supportedLocalesStart = studioApp.indexOf("const supportedLocales =");
  const normalizeLocaleStart = studioApp.indexOf("const normalizeLocale =");
  const localeBoundaryStart = Math.min(supportedLocalesStart, normalizeLocaleStart);
  const localeBoundaryEnd = studioApp.indexOf("const rawLocale =", localeBoundaryStart);
  assert(localeBoundaryStart >= 0 && localeBoundaryEnd > localeBoundaryStart,
    "Studio must expose one browser-side locale boundary before resolving the requested locale");
  const normalizeStudioLocale = Function(
    `"use strict";\n${studioApp.slice(localeBoundaryStart, localeBoundaryEnd)}\nreturn normalizeLocale;`,
  )();
  for (const locale of STUDIO_LOCALES) {
    assert.equal(normalizeStudioLocale(locale), locale,
      `Studio changed the canonical ${locale} locale`);
  }
  const studioLocaleCases = new Map([
    ["hi-IN", "hi"], ["es-MX", "es"], ["fr-CA", "fr"], ["id-ID", "id"],
    ["ja-JP", "ja"], ["ko-KR", "ko"], ["pt-PT", "pt-BR"], ["de-CH", "de"],
    ["it-CH", "it"], ["vi-VN", "vi"], ["pl-PL", "pl"], ["tr-TR", "tr"],
    ["zh-Hans-CN", "zh-CN"], ["zh-Hant-HK", "zh-HKTW"], ["unknown", "en"],
  ]);
  for (const [input, expected] of studioLocaleCases) {
    assert.equal(normalizeStudioLocale(input), expected,
      `Studio normalized ${input} to the wrong UI locale`);
  }
  assert.match(studioApp,
    /document\.documentElement\.lang = locale === "zh-HKTW"\s*\?\s*"zh-Hant-TW"\s*:\s*locale === "zh-CN" \? "zh-Hans-CN" : locale/,
    "Studio must expose valid BCP-47 document languages without changing its canonical locale ids");
  const localeHandlerStart = studioApp.indexOf(
    "for (const input of localeInputs) {",
    studioApp.indexOf("END HOST BRIDGE"),
  );
  const localeHandlerEnd = studioApp.indexOf(
    "// Bundled themes render through the same DOM builder",
    localeHandlerStart,
  );
  const localeHandler = studioApp.slice(localeHandlerStart, localeHandlerEnd);
  assert.match(localeHandler, /supportedLocales\.has\(input\.value\)/,
    "The locale switch must validate against every supported Studio UI locale");
  assert.doesNotMatch(localeHandler, /hostThemeLocales/,
    "The locale switch must not reuse the three-locale theme-metadata boundary");
  assert.match(studioApp,
    /typeof data\.locale === "string" && supportedLocales\.has\(data\.locale\)/,
    "Studio must accept canonical host state for every supported UI locale");
  for (const fieldset of ["language-settings", "welcome-language"]) {
    assert.match(studioHtml,
      new RegExp(`<fieldset id="${fieldset}"[^>]+aria-describedby="([^"]+)"[\\s\\S]{0,1000}?<legend[^>]*>[\\s\\S]*?<\\/legend>`),
      `${fieldset} must keep a native legend and an explicit help relationship`);
  }
  for (const locale of STUDIO_LOCALES) {
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
    /const ordinarySections = \["themes", "prompt-shelf", "background", "create", "settings"\]\s*\.map\(\(id\) => document\.getElementById\(id\)\)/,
    "Prompt Shelf must leave the ordinary shell with the other sections during an editor session");
  assert.match(studioEditor,
    /const showEditor = \(\) => \{[\s\S]{0,120}?for \(const section of ordinarySections\) section\.hidden = true/,
    "Opening the theme editor must hide Prompt Shelf with every ordinary destination");
  assert.match(studioEditor,
    /const hideEditor = \(action = ""\) => \{[\s\S]{0,320}?onOrdinaryViewRestore\?\.\("themes"\)[\s\S]{0,260}?section\.id === "themes"[\s\S]{0,140}?section\.hidden = !selected/,
    "Closing the theme editor must restore Themes as one exclusive page while keeping every destination registered");

  assert.match(studioApp,
    /const STRINGS = Object\.fromEntries\(\s*Object\.entries\(window\.CLAUDE_AURA_STRINGS \?\? \{\}\)/,
    "Studio page copy must come from the per-language files in studio/locales");
  const studioStrings = (await readStudioCopy()).shell;
  assert.deepEqual(Object.keys(studioStrings).sort(), STUDIO_LOCALES.slice().sort());
  const studioStringKeys = Object.keys(studioStrings.en).sort();
  const expectedPromptShelfStringKeys = [
    "navPromptShelf",
    "promptShelfKicker", "promptShelfTitle", "promptShelfLede", "promptShelfNew",
    "promptShelfSearchLabel", "promptShelfSearchPlaceholder", "promptShelfSavedTitle",
    "promptShelfCountLabel", "promptShelfEmptyTitle", "promptShelfEmptyBody",
    "promptShelfNoResultsTitle", "promptShelfNoResultsBody", "promptShelfEditorKicker",
    "promptShelfEditorNewTitle", "promptShelfEditorSelectedTitle",
    "promptShelfCharacterCountLabel", "promptShelfTextLabel", "promptShelfSave",
    "promptShelfSaveChanges", "promptShelfCancel", "promptShelfMoveUp",
    "promptShelfMoveDown", "promptShelfDelete", "promptShelfInsertHelp",
    "promptShelfInsertUnavailable", "promptShelfInsert", "promptShelfRefresh",
    "promptShelfRetryAction", "promptShelfConfirmChecked",
    "promptShelfDeleteKicker", "promptShelfDeleteTitle", "promptShelfDeleteBody",
    "promptShelfDeleteCancel", "promptShelfDeleteConfirm", "promptShelfStatusLoading",
    "promptShelfStatusReady", "promptShelfStatusSaving", "promptShelfStatusCreated",
    "promptShelfStatusUpdated", "promptShelfStatusMoved", "promptShelfStatusDeleted",
    "promptShelfStatusInserting", "promptShelfStatusInserted",
    "promptShelfStatusInsertDelayed", "promptShelfStatusInsertUncertain",
    "promptShelfStatusChecked", "promptShelfStatusInsertFailed",
    "promptShelfStatusInsertUnavailable", "promptShelfStatusInsertBusy",
    "promptShelfStatusBlank", "promptShelfStatusInvalidText", "promptShelfStatusFull",
    "promptShelfStatusNotFound", "promptShelfStatusStale",
    "promptShelfStatusStorageUnavailable", "promptShelfStatusActionFailed",
    "promptShelfStatusUnknown", "promptShelfStatusFinishEditing",
    "promptShelfStatusDisconnected",
  ].sort();
  assert.deepEqual(
    studioStringKeys.filter((key) => key === "navPromptShelf" || key.startsWith("promptShelf")).sort(),
    expectedPromptShelfStringKeys,
    "English must expose the complete Prompt Shelf shell contract",
  );
  for (const locale of STUDIO_LOCALES) {
    assert.deepEqual(
      Object.keys(studioStrings[locale])
        .filter((key) => key === "navPromptShelf" || key.startsWith("promptShelf"))
        .sort(),
      expectedPromptShelfStringKeys,
      `${locale} must expose the complete Prompt Shelf shell contract`,
    );
  }
  const htmlTranslationKeys = [...studioHtml.matchAll(
    /\sdata-i18n(?:-aria-label)?="([^"]+)"/g,
  )].map((match) => match[1]);
  for (const key of htmlTranslationKeys) {
    assert(studioStringKeys.includes(key), `Studio HTML references missing locale key ${key}`);
  }
  for (const locale of STUDIO_LOCALES.filter((locale) => locale !== "en")) {
    assert.deepEqual(Object.keys(studioStrings[locale]).sort(), studioStringKeys,
      `${locale} Studio copy does not cover every Settings and welcome state`);
    for (const key of studioStringKeys) {
      assert(String(studioStrings[locale][key]).trim(), `${locale}.${key} is empty`);
    }
  }
  assert.equal(studioStrings["zh-CN"].settingsTitle, "\u8bbe\u7f6e");
  assert.equal(studioStrings["zh-HKTW"].settingsTitle, "\u8a2d\u5b9a");
  for (const key of [
    "settingsLede", "languageHelp", "gettingStartedBody", "welcomeBody",
    "welcomeThemeBody", "welcomeControlBody", "welcomeCreateBody", "welcomeLauncherNote",
    "welcomeLater", "statusWelcomeBusy",
  ]) {
    assert.notEqual(studioStrings["zh-CN"][key], studioStrings["zh-HKTW"][key],
      `${key} must be independently authored for zh-CN and zh-HKTW`);
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
  const ordinaryViewDeclaration = studioApp.match(
    /const ordinaryStudioViews = Object\.freeze\(\[([\s\S]*?)\]\);/,
  )?.[1] ?? "";
  assert.deepEqual(
    [...ordinaryViewDeclaration.matchAll(/"([^"]+)"/g)].map((match) => match[1]),
    ["themes", "prompt-shelf", "background", "create", "settings"],
    "Studio must keep one closed allowlist for host-preserved ordinary pages",
  );
  assert.match(studioApp,
    /const requestedView = params\.get\("view"\);\s*const requestedViewHash = ordinaryStudioViewSet\.has\(requestedView\)[\s\S]{0,100}?#\$\{requestedView\}/,
    "Studio must allowlist a host-owned reload view instead of trusting a fragment");
  assert.match(studioApp,
    /const initialDestination = requestedViewHash \|\| window\.location\.hash;[\s\S]{0,180}?const initialView = studioViewFromHash\(initialDestination\);[\s\S]{0,260}?activateStudioView\(initialView,[\s\S]{0,220}?restoreScroll:\s*false/,
    "A locale reload must restore one exclusive page without invoking root fragment scrolling");
  assert.match(studioApp,
    /const canonicalUrl = new URL\(window\.location\.href\);[\s\S]{0,120}?canonicalUrl\.searchParams\.delete\("view"\);[\s\S]{0,120}?canonicalUrl\.hash = nextView;[\s\S]{0,220}?history\.replaceState/,
    "A locale-preserved query destination must canonicalize back to the current hash page");
  assert.match(studioApp,
    /const focusAdjacentStudioView[\s\S]{0,700}?event\.key === "ArrowUp"[\s\S]{0,140}?event\.key === "ArrowDown"[\s\S]{0,160}?event\.key === "Home" \|\| event\.key === "End"[\s\S]{0,500}?availableLinks\[nextIndex\]\.focus\(\)/,
    "The vertical Studio rail must support arrow, Home, and End focus movement");
  assert.match(studioApp,
    /link\.addEventListener\("keydown"[\s\S]{0,240}?event\.key !== " "[\s\S]{0,100}?event\.preventDefault\(\);[\s\S]{0,80}?link\.click\(\)/,
    "Space must activate a focused Studio destination like Enter activates its native link");

  assert.match(ui, /\$StudioPreferencesPath\s*=\s*Join-Path \$DataRoot 'studio-preferences\.json'/,
    "Studio preferences must stay in a separate device-local host file");
  assert.match(ui,
    /function Write-AuraUiStudioPreferences[\s\S]{0,1600}?\[IO\.File\]::WriteAllText\(\$temporary[\s\S]{0,500}?\[IO\.File\]::Replace\(\$temporary,\s*\$StudioPreferencesPath,\s*\$backup\)[\s\S]{0,180}?\[IO\.File\]::Move\(\$temporary,\s*\$StudioPreferencesPath\)/,
    "Studio preferences must use UTF-8 temporary-write plus atomic replace-or-move persistence");
  assert.match(ui,
    /function Send-AuraUiStudioState[\s\S]{0,2000}?locale = "\$\(\$script:Locale\)"[\s\S]{0,180}?introductionPending =[\s\S]{0,220}?introductionRequested =/,
    "The host must own locale, introduction completion, and launcher-entry state");
  assert.match(ui,
    /function Show-AuraUiStudio\s*\{\s*param\(\[switch\]\$OfferIntroduction\)[\s\S]{0,180}?StudioIntroductionRequested = \$true/,
    "Only an explicit host opening path may request the first-run introduction");
  assert.match(ui, /\$script:LauncherStudioItem\.add_Click\(\{ Show-AuraUiStudio -OfferIntroduction \}\)/,
    "The launcher menu entry must offer the introduction");
  assert.match(ui,
    /\} elseif \(\$wasClickArmed\) \{\s*Show-AuraUiLauncherMenu/,
    "A direct launcher click must reveal the menu whose Studio entry offers the introduction");
  assert.match(ui, /\$script:TrayOpenStudioItem\.add_Click\(\{ Show-AuraUiStudio \}\)/,
    "The tray entry must not impersonate the Aura launcher introduction path");
  assert.match(ui,
    /function Invoke-AuraUiSetLocale[\s\S]{0,550}?StudioEditorState[\s\S]{0,120}?active[\s\S]{0,260}?throw[\s\S]{0,1600}?Get-AuraUiStudioUrl -PreserveView/,
    "A locale change must preserve an active draft and the current ordinary Settings destination");
  assert.match(ui,
    /function Invoke-AuraUiSetLocale[\s\S]{0,1300}?Write-AuraUiStudioPreferences[\s\S]{0,300}?\$script:Locale = \$Locale[\s\S]{0,120}?Get-AuraUiCopy/,
    "The host must persist a locale before changing localized runtime state");
  assert.match(ui,
    /function Invoke-AuraUiCompleteStudioIntroduction[\s\S]{0,500}?Write-AuraUiStudioPreferences[\s\S]{0,180}?Send-AuraUiStudioState/,
    "The host must acknowledge introduction completion with canonical state");
  for (const locale of ["en", "zh-CN", "zh-HKTW"]) {
    assert(uiCopy[locale].localeNotChangedMessage && uiCopy[locale].studioPreferencesNotSaved,
      `${locale} must localize host-side locale and welcome persistence failures`);
  }
  assert.notEqual(uiCopy["zh-CN"].localeNotChangedMessage, uiCopy["zh-HKTW"].localeNotChangedMessage);
  assert.notEqual(uiCopy["zh-CN"].studioPreferencesNotSaved, uiCopy["zh-HKTW"].studioPreferencesNotSaved);

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
      "foreach($name in @('ConvertTo-AuraUiLocale','Get-AuraUiDefaultLocale','Get-AuraUiStudioPreferences','Write-AuraUiStudioPreferences','Get-AuraUiStudioUrl','Invoke-AuraUiCompleteStudioIntroduction')){",
      "  $definition=$ast.Find({param($node)$node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -ceq $name},$true)",
      "  if($null -eq $definition){throw \"Missing Studio preference function $name\"}",
      "  Invoke-Expression $definition.Extent.Text",
      "}",
      "$StudioLocaleIds=@('en','hi','es','fr','id','ja','ko','pt-BR','de','it','vi','pl','tr','zh-CN','zh-HKTW')",
      "function Write-AuraUiLog { param([string]$Message) }",
      "function Assert-Rejected { param([scriptblock]$Operation,[string]$Label);$rejected=$false;try{&$Operation|Out-Null}catch{$rejected=$true};if(-not $rejected){throw \"Aura accepted $Label\"} }",
      "$localeCases=[ordered]@{",
      "  'hi-IN'='hi';'es-MX'='es';'fr-CA'='fr';'id-ID'='id';'ja-JP'='ja';'ko-KR'='ko';'pt-PT'='pt-BR';",
      "  'de-CH'='de';'it-CH'='it';'vi-VN'='vi';'pl-PL'='pl';'tr-TR'='tr';",
      "  'zh-CN'='zh-CN';'zh-SG'='zh-CN';'zh-Hans'='zh-CN';'zh-Hans-CN'='zh-CN';'zh_CN_variant'='zh-CN';",
      "  'zh-HKTW'='zh-HKTW';'zh-HK'='zh-HKTW';'zh-MO'='zh-HKTW';'zh-Hant'='zh-HKTW';'zh-Hant-HK'='zh-HKTW';",
      "  'en-US'='en';'zh'='en';''='en'",
      "}",
      "foreach($entry in $localeCases.GetEnumerator()){if((ConvertTo-AuraUiLocale -Locale $entry.Key) -cne $entry.Value){throw \"Locale normalization failed for $($entry.Key)\"}}",
      "$fallback=Get-AuraUiStudioPreferences",
      "if($fallback.locale -cnotin $StudioLocaleIds -or $fallback.introductionVersion -ne 0){throw 'Missing preferences did not use the supported OS fallback'}",
      "$saved=Write-AuraUiStudioPreferences -Locale 'zh-HKTW' -IntroductionVersion 1",
      "if($saved.locale -cne 'zh-HKTW' -or $saved.introductionVersion -ne 1){throw 'Preference writer changed canonical values'}",
      "$bytes=[IO.File]::ReadAllBytes($StudioPreferencesPath)",
      "if($bytes.Length -ge 3 -and $bytes[0] -eq 239 -and $bytes[1] -eq 187 -and $bytes[2] -eq 191){throw 'Studio preferences unexpectedly contain a UTF-8 BOM'}",
      "$json=[Text.Encoding]::UTF8.GetString($bytes)|ConvertFrom-Json",
      "$names=@($json.PSObject.Properties|ForEach-Object{$_.Name})",
      "if($names.Count -ne 3 -or $names -cnotcontains 'schemaVersion' -or $names -cnotcontains 'locale' -or $names -cnotcontains 'introductionVersion'){throw 'Preference writer widened its schema'}",
      "$roundTrip=Get-AuraUiStudioPreferences",
      "if($roundTrip.locale -cne 'zh-HKTW' -or $roundTrip.introductionVersion -ne 1){throw 'Studio preferences did not round-trip'}",
      "function Send-AuraUiStudioState {}",
      "$script:Locale='ja'",
      "$script:StudioIntroductionRequested=$true",
      "Invoke-AuraUiCompleteStudioIntroduction",
      "if($script:StudioPreferences.locale -cne 'ja' -or $script:StudioPreferences.introductionVersion -ne 1){throw 'Welcome completion changed the active Studio locale'}",
      "if($script:StudioIntroductionRequested -ne $false){throw 'Welcome completion did not clear its host request'}",
      "[void](Write-AuraUiStudioPreferences -Locale 'en' -IntroductionVersion 0)",
      "if(@(Get-ChildItem -LiteralPath $DataRoot -Filter '.studio-preferences-*').Count -ne 0){throw 'Atomic preference files were not cleaned up'}",
      "Assert-Rejected { Write-AuraUiStudioPreferences -Locale 'xx' -IntroductionVersion 0 } 'an unsupported saved locale'",
      "[IO.File]::WriteAllText($StudioPreferencesPath,'{\"schemaVersion\":\"1\",\"locale\":\"zh-HKTW\",\"introductionVersion\":1}',[Text.UTF8Encoding]::new($false))",
      "$invalid=Get-AuraUiStudioPreferences",
      "if($invalid.introductionVersion -ne 0 -or $invalid.locale -cnotin $StudioLocaleIds){throw 'A wrong-typed preference did not fall back safely'}",
      "$script:Locale='zh-CN'",
      "$script:StudioWebView=[pscustomobject]@{Source=[Uri]'https://aura.studio/index.html?locale=en#settings'}",
      "if((Get-AuraUiStudioUrl) -cne 'https://aura.studio/index.html?locale=zh-CN'){throw 'Studio URL did not use the exact host locale'}",
      "if((Get-AuraUiStudioUrl -PreserveView) -cne 'https://aura.studio/index.html?locale=zh-CN&view=settings'){throw 'Locale reload did not preserve Settings without a root fragment'}",
      "$script:StudioWebView.Source=[Uri]'https://aura.studio/index.html?locale=en#prompt-shelf'",
      "if((Get-AuraUiStudioUrl -PreserveView) -cne 'https://aura.studio/index.html?locale=zh-CN&view=prompt-shelf'){throw 'Locale reload did not preserve Prompt Shelf without a root fragment'}",
      "$script:StudioWebView.Source=[Uri]'https://aura.studio/index.html?locale=en#editor'",
      "if((Get-AuraUiStudioUrl -PreserveView) -ne 'https://aura.studio/index.html?locale=zh-CN'){throw 'Studio URL preserved a non-ordinary view'}",
      "$script:Locale='ja'",
      "if((Get-AuraUiStudioUrl) -cne 'https://aura.studio/index.html?locale=ja'){throw 'Studio URL did not preserve a supported locale'}",
      "$script:Locale='xx'",
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

test("WO-21 Studio keeps greeting frames and personal drafts transactional", async () => {
  const document = { newChatGreetingStyle: defaultStudioGreetingStyle() };
  assert.equal(studioGreetingCompactMarkAvailable({
    id: "constructor",
    sourceRecipe: null,
    theme: { variant: "constructor" },
  }), false, "A prototype-named custom theme inherited an unregistered compact mark");
  const before = structuredClone(document.newChatGreetingStyle);
  const replacement = {
    ...studioGreetingState(document.newChatGreetingStyle).frames.dark.wide,
    fontSize: 57,
    xRatio: -0.2,
  };
  mutateStudioGreetingDocument(document, {
    operation: "set-frame",
    appearance: "dark",
    frame: "wide",
    value: replacement,
  });
  assert.equal(document.newChatGreetingStyle.dark.wide.fontSize, 57);
  assert.equal(document.newChatGreetingStyle.dark.wide.xRatio, -0.2);
  assert.deepEqual(document.newChatGreetingStyle.light.standard, before.light.standard,
    "editing Dark/Wide changed Light/Standard");
  assert.deepEqual(document.newChatGreetingStyle.light.wide, before.light.wide,
    "editing Dark/Wide changed Light/Wide");
  assert.deepEqual(document.newChatGreetingStyle.dark.standard, before.dark.standard,
    "editing Dark/Wide changed Dark/Standard");
  assert.deepEqual(Object.keys(studioGreetingState(document.newChatGreetingStyle).frames).sort(),
    ["dark", "light"]);
  mutateStudioGreetingDocument(document, {
    operation: "reset",
    appearance: "dark",
    frame: "wide",
    value: null,
  });
  assert.equal(document.newChatGreetingStyle, null);

  const editorSource = await fs.readFile(path.join(PROJECT_ROOT, "studio", "editor.js"), "utf8");
  const editorCssSource = await fs.readFile(path.join(PROJECT_ROOT, "studio", "editor.css"), "utf8");
  const coreSource = await fs.readFile(path.join(PROJECT_ROOT, "scripts", "theme-core", "studio.mjs"), "utf8");
  const htmlSource = await fs.readFile(path.join(PROJECT_ROOT, "studio", "index.html"), "utf8");
  assert.match(htmlSource, /id="editor-greeting-name"[^>]+maxlength="80"/,
    "The name input must admit up to 40 supplementary-plane Unicode scalars");
  assert.equal((htmlSource.match(/name="greeting-source"/g) ?? []).length, 2,
    "Greeting wording must use one mutually exclusive Claude/custom choice");
  assert.doesNotMatch(htmlSource, /editor-greeting-personal-enabled/,
    "Greeting wording must not retain a second conflicting enable switch");
  assert.match(htmlSource, /id="editor-greeting-collision-warning"[^>]+role="note"/,
    "Custom artwork and greeting styling need a truthful non-blocking collision warning");
  assert.match(htmlSource,
    /id="editor-greeting-sample"[^>]+data-greeting-preview-ready="false"/,
    "The static greeting fallback must stay hidden until its first fully styled render");
  assert.doesNotMatch(htmlSource, /editor-greeting-completion|editor-greeting-update/,
    "Greeting wording must not retain a second Save path");
  assert.doesNotMatch(editorCssSource, /editor-greeting-completion|editor-greeting-update/,
    "Removed greeting submission paths must not retain dead presentation logic");
  assert.equal((htmlSource.match(/id="editor-save"/g) ?? []).length, 1,
    "Studio must expose one persistent Save action");
  assert.match(editorCssSource,
    /\.editor-greeting-preview p\s*\{[\s\S]{0,160}?visibility:\s*hidden[\s\S]{0,160}?\[data-greeting-preview-ready="true"\]\s*\{[\s\S]{0,80}?visibility:\s*visible/,
    "The in-panel greeting preview can flash its unstyled fallback before hydration");
  assert.match(editorSource,
    /stageGreetingAnchor\.append\(stageGreetingText, stageGreetingMark\);[\s\S]{0,80}?stageGreetingEl\.append\(stageGreetingAnchor\)/,
    "The schematic mark must trail its text through a separate relative anchor");
  assert.match(editorCssSource,
    /\.stage-greeting-anchor\s*\{[^}]*position:\s*relative[^}]*display:\s*inline-block[\s\S]{0,120}?\.stage-greeting-mark\s*\{[^}]*position:\s*absolute[^}]*left:\s*calc\(100% \+ 0\.35em\)/,
    "The mark must follow the greeting without contributing to the greeting's measured placement");
  assert.match(editorSource,
    /greetingSample\.dataset\.greetingPreviewReady = "true"/,
    "The in-panel greeting preview never reveals after its styled render");
  assert.doesNotMatch(editorSource,
    /reflectGreetingCompletion|submitGreetingOnFocusExit|greetingUpdateButton|submitGreetingPhrases/,
    "Removed greeting submission paths must not remain wired in JavaScript");
  assert.match(editorSource,
    /const GREETING_DECORATION_IDS = Object\.freeze\(\["none", "underline", "hairline", "glow"\]\)/);
  assert.match(editorSource,
    /const GREETING_WEIGHT_IDS = Object\.freeze\(\[300, 400, 500, 600, 650, 700\]\)/);
  assert.equal((editorSource.match(/textShadow = greeting\.decoration === "glow"/g) ?? []).length, 2,
    "Glow must render and clear in both the stage and the in-panel preview");
  assert.match(editorSource,
    /compactOption\.disabled = !greetingState\.compactMarkAvailable;[\s\S]{0,120}?compactOption\.hidden = !greetingState\.compactMarkAvailable/,
    "Unavailable compact marks must not remain an actionable generic option");
  assert.match(editorSource,
    /greetingCollisionWarning\.hidden = greetingNative[\s\S]{0,180}?state\.layers\.length === 0/,
    "The custom-artwork collision warning must follow actual style and artwork state");
  assert.match(editorSource,
    /greetingEnableInput\?\.addEventListener\("change"[\s\S]{0,420}?kind:\s*"greeting"[\s\S]{0,180}?operation:\s*"reset"/,
    "Turning off portable styling must emit only the greeting theme reset patch");
  const greetingEnableHandler = editorSource.match(
    /greetingEnableInput\?\.addEventListener\("change"[\s\S]*?\n    \}\);/,
  )?.[0] ?? "";
  assert.doesNotMatch(greetingEnableHandler, /type:\s*"reset-greeting"/,
    "Turning off style must not also reset personal wording");
  assert.match(editorSource,
    /greetingResetButton\?\.addEventListener\("click"[\s\S]{0,180}?type:\s*"reset-greeting"/,
    "Only the explicit Reset to Claude control should reset style and wording together");
  const parserSource = editorSource.match(
    /function parseGreetingPhrases\(text\) \{[\s\S]*?\n  \}/,
  )?.[0] ?? "";
  assert(parserSource, "The strict greeting textarea parser is missing");
  const parsePhrases = Function(`${parserSource}; return parseGreetingPhrases;`)();
  assert.deepEqual(parsePhrases(" Hello \n\nWelcome, {name}"), ["Hello", "Welcome, {name}"]);
  for (const [label, value] of [
    ["duplicate", "same\nsame"],
    ["thirteenth line", Array.from({ length: 13 }, (_, index) => `line ${index}`).join("\n")],
    ["overlong line", "x".repeat(121)],
    ["unknown token", "Hello, {account}"],
    ["repeated token", "{name} and {name}"],
    ["control character", "hello\u0001there"],
  ]) {
    assert.equal(parsePhrases(value), null, `The greeting parser silently altered a ${label}`);
  }
  assert.match(editorSource,
    /greetingPreferenceInputDirty = true;\s*greetingPreferenceInputInvalid = true;[\s\S]{0,100}?showGreetingInputError\(\)/,
    "Invalid visible greeting input must remain tracked instead of falling back to the prior draft");
  assert.match(editorSource,
    /const personal = greetingPreferenceInputDirty[\s\S]{0,800}?greetingPreferenceInputInvalid[\s\S]{0,500}?saveBlocked/,
    "Save must stop on invalid visible greeting input instead of ignoring it");
  const personalHandler = coreSource.match(
    /export async function setGreetingPhrases\([\s\S]*?\n\}/,
  )?.[0] ?? "";
  assert(personalHandler);
  assert(!/writeConfig\(/.test(personalHandler),
    "personal edits must remain staged until Save");
  assert.match(coreSource,
    /const savedGreetingPreferences = reconcileStudioGreetingShuffle\([\s\S]{0,180}?greetingPreferences:\s*savedGreetingPreferences/,
    "Save must commit the staged personal envelope while preserving a newer runtime shuffle");
  assert.match(editorSource,
    /actionAfterPatch = \{ type: "save-theme-edit", \.\.\.base \};[\s\S]{0,180}?postGreetingPreferences/,
    "the first Save click must flush personal words and chain the save");
  assert.match(editorSource,
    /greetingExactInputs[\s\S]{0,2200}?gestureScope \?\?= greetingScopeFromFieldPath\(exact\.dataset\.editorField\)[\s\S]{0,600}?const \{ appearance, frameId \} = gestureScope;[\s\S]{0,220}?queueGreetingFrame\([\s\S]{0,100}?greetingFrameFromControls\(field, value, appearance, frameId\),[\s\S]{0,100}?\{ appearance, frameId \}/,
    "exact numeric greeting edits must emit a complete frame for their captured axes");
  assert.match(editorSource,
    /const queueGreetingFrame = \([\s\S]{0,260}?appearance = selectedMode[\s\S]{0,160}?frameId = greetingFrameId\(\)[\s\S]{0,260}?operation:\s*"set-frame"[\s\S]{0,120}?appearance,[\s\S]{0,80}?frame:\s*frameId[\s\S]{0,80}?value:\s*frame/,
    "greeting patches must carry one complete scoped frame");
  assert.match(editorSource,
    /const activeGreetingFrame = \([\s\S]{0,500}?stageOverrides\.has\(path\)\) draft\[field\] = stageOverrides\.get\(path\)/,
    "reflections must preserve the current local greeting draft until its acknowledgement");
  assert.match(editorSource,
    /const confirmedGreeting = state\?\.shared\?\.greeting\?\.frames\?\.\[selectedMode\]\?\.\[greetingFrameId\(\)\][\s\S]{0,1200}?stageValue\(`\$\{greetingStagePrefix\(\)\}xRatio`\)\) - confirmedGreeting\.xRatio/,
    "a live greeting outline must measure local movement from the confirmed frame, not from itself");
  assert.match(editorSource,
    /const gestureAppearance = selectedMode;[\s\S]{0,180}?const gestureFrame = greetingFrameId\(\);[\s\S]{0,220}?stageItemPaths\(selection, \{[\s\S]{0,160}?appearance: gestureAppearance,[\s\S]{0,100}?frame: gestureFrame/,
    "a greeting drag must stay bound to the appearance and viewport where it began");
  assert.match(editorSource,
    /stageDrag = \{[\s\S]{0,1000}?paths: gesturePaths,[\s\S]{0,100}?appearance: gestureAppearance,[\s\S]{0,100}?frame: gestureFrame,[\s\S]{0,100}?viewport: gestureViewport/,
    "the immutable greeting axes and paths must be stored with the active gesture");
  assert.match(editorSource,
    /const drag = stageDrag;[\s\S]{0,120}?stageDrag = null;[\s\S]{0,120}?commitStagePaths\(drag\.paths\)/,
    "a greeting drag must commit the immutable paths captured at pointer down");
  assert.match(editorSource,
    /const greetingScopes = new Map\(\);[\s\S]{0,700}?activeGreetingFrame\(appearance, frameId\)[\s\S]{0,600}?queueGreetingFrame\(frame, \{[\s\S]{0,100}?appearance,[\s\S]{0,80}?frameId/,
    "gesture commits must route each complete frame back to its encoded axes");
  assert.match(editorSource,
    /const greetingUsesNativeLayout = \(\) => greetingStyleIntent === null[\s\S]{0,180}?state\?\.shared\?\.greeting\?\.native && !greetingHasLocalFrameDraft\(\)/,
    "a stale host reflection must not hide an unacknowledged local greeting edit");
  assert.match(editorSource,
    /const syncGreetingFrameControls = \(\) => \{[\s\S]{0,260}?isBlockingAction\(\)[\s\S]{0,120}?greetingStyleIntent !== null[\s\S]{0,260}?greetingInputs[\s\S]{0,160}?greetingExactInputs/,
    "greeting appearance controls must lock while Save or a style toggle is settling");
  assert.match(editorSource,
    /greetingEnableInput\?\.addEventListener\("change"[\s\S]{0,180}?greetingStyleIntent = greetingEnableInput\.checked[\s\S]{0,500}?reflectGreeting\(\)[\s\S]{0,100}?reflectButtonStates\(\)/,
    "the greeting style toggle must expose one optimistic intent until its patch settles");
  assert.match(editorSource,
    /const greetingAcknowledged = \["set-greeting-phrases", "reset-greeting"\]\.includes\(pendingAction\)[\s\S]{0,160}?normalized\.actionSucceeded !== false/,
    "a rejected wording or reset request must not acknowledge and erase the recoverable draft");
  assert.match(editorSource,
    /const greetingGestureActive = Boolean\(activeGreetingControlScope\)[\s\S]{0,120}?stageDrag\?\.selection\?\.kind === "greeting"[\s\S]{0,180}?greetingMirrorAxesDeferred = true/,
    "live mirror axes must wait until an active greeting gesture finishes");

  const oversizedPreferences = {
    enabled: true,
    source: "custom",
    displayName: "",
    globalPhrases: Array.from(
      { length: 12 },
      (_, index) => String.fromCodePoint(0x4E00 + index).repeat(120),
    ),
    themeOverrides: { "studio-copy": { mode: "global", phrases: [] } },
    shuffle: null,
  };
  assert.deepEqual(
    studioGreetingPreferenceError(oversizedPreferences, "studio-copy"),
    { code: "invalid-greeting", field: "greetingPreferences" },
    "Studio accepted an active custom list that cannot fit the compiled greeting ceiling",
  );
  oversizedPreferences.themeOverrides["studio-copy"] = { mode: "claude", phrases: [] };
  assert.equal(studioGreetingPreferenceError(oversizedPreferences, "studio-copy"), null,
    "An explicit Claude override should remain a valid native-mode choice");
  assert.match(coreSource,
    /const greetingError = studioGreetingPreferenceError\(greetingPreferences, document\.id\);[\s\S]{0,300}?valid:\s*false/,
    "Studio evaluation must preserve an un-compilable custom list as invalid last-valid state");
  const saveHandler = coreSource.match(/export async function saveThemeEdit\([\s\S]*?\n\}/)?.[0] ?? "";
  assert(saveHandler.indexOf("if (!evaluated.feedback.valid)") >= 0
      && saveHandler.indexOf("if (!evaluated.feedback.valid)") < saveHandler.indexOf("await writeConfig("),
    "Save must reject invalid greeting feedback before any config write");
  assert.match(saveHandler,
    /if \(!evaluated\.feedback\.valid\)[\s\S]{0,600}?configChanged:\s*false/,
    "A rejected greeting Save must report no persisted config change");
});

test("WO-21 greeting reset, shuffle checkpoint, and delete stay recoverable", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "aura-greeting-transaction-"));
  const configPath = path.join(root, "config.json");
  const userThemesDir = path.join(root, "themes");
  const editorRoot = path.join(root, "editor");
  const invoke = (request, options = {}) => executeStudioRequest({
    request,
    configPath,
    userThemesDir,
    editorRoot,
    locale: "en",
    ...options,
  });
  const mutate = (result, type, values = {}) => ({
    type,
    session: result.state.session,
    revision: result.state.revision,
    ...values,
  });
  try {
    await fs.mkdir(userThemesDir, { recursive: true });
    await writeConfig(configPath, { ...structuredClone(DEFAULT_CONFIG) });
    let result = await invoke({ type: "create-theme-copy", theme: "default" });
    const themeId = result.state.id;
    const destination = path.join(userThemesDir, themeId);
    const emojiName = "😀".repeat(40);
    result = await invoke(mutate(result, "set-greeting-phrases", {
      enabled: true,
      source: "custom",
      displayName: emojiName,
      globalPhrases: ["Welcome, {name}"],
      overrideMode: "global",
      overridePhrases: [],
    }));
    assert.equal(result.state.greetingPreferences.displayName, emojiName);
    assert.equal(result.state.greetingPreferences.source, "custom");

    result = await invoke(mutate(result, "apply-theme-patch", {
      changes: [{
        kind: "greeting",
        operation: "reset",
        appearance: "light",
        frame: "standard",
        value: null,
      }],
    }));
    assert.equal(result.state.shared.greeting.native, true,
      "Turning off greeting style did not reset only the portable presentation");
    assert.equal(result.state.greetingPreferences.source, "custom",
      "Turning off greeting style also reset personal wording");
    assert.deepEqual(result.state.greetingPreferences.globalPhrases, ["Welcome, {name}"]);
    result = await invoke(mutate(result, "undo-theme-edit"));
    assert.equal(result.state.shared.greeting.native, false);
    assert.equal(result.state.greetingPreferences.source, "custom");

    const beforeClaudeResetRevision = result.state.revision;
    result = await invoke(mutate(result, "reset-greeting"));
    assert.equal(result.state.revision, beforeClaudeResetRevision + 1);
    assert.equal(result.state.shared.greeting.native, true);
    assert.equal(result.state.greetingPreferences.source, "claude");
    assert.equal(result.state.greetingPreferences.displayName, emojiName,
      "Reset to Claude discarded a reusable personal name");
    assert.deepEqual(result.state.greetingPreferences.globalPhrases, ["Welcome, {name}"]);
    result = await invoke(mutate(result, "undo-theme-edit"));
    assert.equal(result.state.shared.greeting.native, false,
      "One Undo did not restore greeting style after Reset to Claude");
    assert.equal(result.state.greetingPreferences.source, "custom",
      "One Undo did not restore personal wording after Reset to Claude");

    result = await invoke(mutate(result, "set-greeting-phrases", {
      enabled: false,
      source: result.state.greetingPreferences.source,
      displayName: result.state.greetingPreferences.displayName,
      globalPhrases: result.state.greetingPreferences.globalPhrases,
      overrideMode: result.state.greetingPreferences.themeOverrides[themeId].mode,
      overridePhrases: result.state.greetingPreferences.themeOverrides[themeId].phrases,
    }));
    assert.equal(result.state.greetingPreferences.enabled, false,
      "The personal-enabled control did not participate in Studio history");
    result = await invoke(mutate(result, "undo-theme-edit"));
    assert.equal(result.state.greetingPreferences.enabled, true);

    const runtimeShuffle = {
      themeId,
      phraseDigest: "a".repeat(64),
      order: [0],
      cursor: 0,
      lastIndex: null,
    };
    await writeConfig(configPath, {
      ...structuredClone(DEFAULT_CONFIG),
      greetingPreferences: {
        ...structuredClone(result.state.greetingPreferences),
        shuffle: runtimeShuffle,
      },
    });
    result = await invoke(mutate(result, "save-theme-edit"));
    const savedConfig = JSON.parse(await fs.readFile(configPath, "utf8"));
    assert.deepEqual(savedConfig.greetingPreferences.shuffle, runtimeShuffle,
      "Save overwrote a newer runtime shuffle checkpoint despite unchanged editable fields");
    assert.equal(savedConfig.theme, themeId);
    result = await invoke(mutate(result, "discard-theme-edit"));
    assert.equal(result.state.active, false);
    const canonicalDestination = await fs.realpath(destination);

    await writeConfig(configPath, {
      ...savedConfig,
      theme: "default",
    });
    await assert.rejects(
      invoke(
        { type: "delete-user-theme", theme: themeId },
        {
          faultInjector(stage) {
            if (stage === "before-delete-greeting-config") {
              throw new Error("injected greeting config failure");
            }
          },
        },
      ),
      /injected greeting config failure/,
    );
    assert.equal((await fs.stat(destination)).isDirectory(), true,
      "Config failure did not restore the deleted theme directory");
    let currentConfig = JSON.parse(await fs.readFile(configPath, "utf8"));
    assert(Object.hasOwn(currentConfig.greetingPreferences.themeOverrides, themeId));
    assert.equal(
      (await fs.readdir(userThemesDir)).some((name) => name.startsWith(`.delete-${themeId}-`)),
      false,
      "Successful delete rollback left a tombstone",
    );

    let incomplete = null;
    try {
      await invoke(
        { type: "delete-user-theme", theme: themeId },
        {
          faultInjector(stage) {
            if (stage === "before-delete-greeting-config") {
              throw new Error("injected delete failure");
            }
          },
          recoveryFaultInjector(stage) {
            if (stage === "rollback-deleted-theme") {
              throw new Error("injected delete rollback failure");
            }
          },
        },
      );
    } catch (error) {
      incomplete = error;
    }
    assert(incomplete instanceof AggregateError,
      "Incomplete theme-delete rollback did not surface an AggregateError");
    assert.equal(incomplete.code, "STUDIO_ROLLBACK_INCOMPLETE");
    assert.match(incomplete.message, /remains recoverable at/);
    assert.equal(incomplete.recoveryDestination, canonicalDestination);
    assert.equal(incomplete.recoveryArtifacts.length, 1);
    assert.equal((await fs.stat(incomplete.recoveryArtifacts[0])).isDirectory(), true,
      "Incomplete rollback did not retain its recoverable tombstone");
    assert.equal(await fs.stat(destination).then(() => true, () => false), false);
    currentConfig = JSON.parse(await fs.readFile(configPath, "utf8"));
    assert(Object.hasOwn(currentConfig.greetingPreferences.themeOverrides, themeId),
      "Incomplete rollback changed greeting config before reporting recovery metadata");

    await fs.rename(incomplete.recoveryArtifacts[0], destination);
    const deleted = await invoke({ type: "delete-user-theme", theme: themeId });
    assert.equal(deleted.configChanged, true);
    assert.equal(await fs.stat(destination).then(() => true, () => false), false);
    currentConfig = JSON.parse(await fs.readFile(configPath, "utf8"));
    assert.equal(Object.hasOwn(currentConfig.greetingPreferences.themeOverrides, themeId), false);
    assert.equal(currentConfig.greetingPreferences.shuffle, null,
      "Deleting a theme left a shuffle checkpoint keyed to the deleted theme");
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("WO-29 activates the layered launcher and dispatches host work without polling", async () => {
  const uiPath = path.join(PROJECT_ROOT, "windows", "aura-ui.ps1");
  const ui = await fs.readFile(uiPath, "utf8");
  assert(!ui.includes("$timer.Interval = 60") && !ui.includes("WaitOne(0)"));
  assert.match(ui, /Format32bppPArgb/);
  assert.match(ui, /ThreadPool\.RegisterWaitForSingleObject/);
  assert.match(ui, /BeginInvoke[\s\S]{0,1000}?ContinueWith/);
  if (process.platform !== "win32") return;

  const quotedUiPath = uiPath.replaceAll("'", "''");
  const smoke = [
    "$ErrorActionPreference='Stop'",
    "Add-Type -AssemblyName System.Windows.Forms",
    "Add-Type -AssemblyName System.Drawing",
    `$uiPath='${quotedUiPath}'`,
    "$tokens=$null",
    "$errors=$null",
    "$ast=[System.Management.Automation.Language.Parser]::ParseFile($uiPath,[ref]$tokens,[ref]$errors)",
    "if($errors.Count){throw ($errors|ForEach-Object{$_.ToString()}|Out-String)}",
    "$strings=@($ast.FindAll({param($node) $node -is [System.Management.Automation.Language.StringConstantExpressionAst]},$true))",
    "$layeredSource=@($strings|Where-Object{$_.Value.Contains('public static class AuraLayered')})[0].Value",
    "$dispatchSource=@($strings|Where-Object{$_.Value.Contains('public static class AuraUiAsyncDispatch')})[0].Value",
    "if(-not $layeredSource -or -not $dispatchSource){throw 'Aura native helper source is missing'}",
    "Add-Type -TypeDefinition $layeredSource -ReferencedAssemblies System.Windows.Forms,System.Drawing",
    "Add-Type -TypeDefinition $dispatchSource -ReferencedAssemblies System.Windows.Forms",
    "$names=@(",
    "  'New-AuraUiRoundedRectanglePath',",
    "  'Get-AuraUiLauncherScale',",
    "  'ConvertTo-AuraUiLauncherPixels',",
    "  'Get-AuraUiLauncherMetrics',",
    "  'New-AuraUiLauncherRegion',",
    "  'Update-AuraUiLauncherRegion',",
    "  'ConvertTo-AuraUiBlendedColor',",
    "  'New-AuraUiLauncherSurfaceBitmap',",
    "  'Push-AuraUiLauncherFrame',",
    "  'Write-AuraUiLauncherBackendDiagnostic',",
    "  'Disable-AuraUiLauncherLayering',",
    "  'Enable-AuraUiLauncherLayering'",
    ")",
    "$definitions=[Collections.Generic.List[string]]::new()",
    "foreach($name in $names){",
    "  $match=@($ast.FindAll({param($node) $node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -ceq $name},$true))",
    "  if($match.Count -ne 1){throw \"Aura function extraction failed: $name\"}",
    "  $definitions.Add($match[0].Extent.Text)",
    "}",
    "Invoke-Expression ($definitions -join [Environment]::NewLine)",
    "$script:LauncherCompactSize=48",
    "$script:LauncherHaloSize=10",
    "$script:LauncherDpi=96",
    "$script:LauncherStyle=[PSCustomObject]@{",
    "  surface='#2F2937';surfaceHover='#3A3345';border='#7A6E89';borderWidth=1;",
    "  foreground='#F5F1FA';accent='#D97757'",
    "}",
    "$script:LauncherMark=$null",
    "$script:LauncherButton=$null",
    "$script:LauncherAnimValue=0.0",
    "$script:LauncherPressed=$false",
    "$script:LauncherBackendDiagnostics=[Collections.Generic.List[string]]::new()",
    "function Write-AuraUiLog{param([string]$Message) $script:LauncherBackendDiagnostics.Add($Message)}",
    "$script:Launcher=[Windows.Forms.Form]::new()",
    "$script:Launcher.FormBorderStyle=[Windows.Forms.FormBorderStyle]::None",
    "$metrics=Get-AuraUiLauncherMetrics",
    "$script:Launcher.ClientSize=[Drawing.Size]::new($metrics.Client,$metrics.Client)",
    "[void]$script:Launcher.Handle",
    "if($script:Launcher.Visible){throw 'Launcher smoke form became visible'}",
    "$frame=New-AuraUiLauncherSurfaceBitmap -Style $script:LauncherStyle -Mark $null",
    "try{if($frame.PixelFormat -ne [Drawing.Imaging.PixelFormat]::Format32bppPArgb){throw 'Launcher frame is not premultiplied'}}finally{$frame.Dispose()}",
    "$script:LauncherLayeredActive=$false",
    "$script:LauncherBackendDiagnosticWritten=$false",
    "if(-not (Enable-AuraUiLauncherLayering)){throw 'Layered launcher smoke did not activate'}",
    "if(-not $script:LauncherLayeredActive -or $null -ne $script:Launcher.Region){throw 'Layered launcher state was not committed'}",
    "if($script:LauncherBackendDiagnostics.Count -ne 1 -or $script:LauncherBackendDiagnostics[0] -notmatch 'layered'){throw 'Layered backend diagnostic mismatch'}",
    "$script:Launcher.Dispose()",
    "function Push-AuraUiLauncherFrame{param([Drawing.Bitmap]$Bitmap,[byte]$Alpha=255) return $false}",
    "$script:Launcher=[Windows.Forms.Form]::new()",
    "$script:Launcher.FormBorderStyle=[Windows.Forms.FormBorderStyle]::None",
    "$script:Launcher.ClientSize=[Drawing.Size]::new($metrics.Client,$metrics.Client)",
    "[void]$script:Launcher.Handle",
    "$script:LauncherLayeredActive=$false",
    "$script:LauncherBackendDiagnosticWritten=$false",
    "$script:LauncherBackendDiagnostics.Clear()",
    "if(Enable-AuraUiLauncherLayering){throw 'Failed layered smoke did not select classic fallback'}",
    "if($script:LauncherLayeredActive -or $null -eq $script:Launcher.Region){throw 'Classic launcher region was not restored'}",
    "if($script:LauncherBackendDiagnostics.Count -ne 1 -or $script:LauncherBackendDiagnostics[0] -notmatch 'classic'){throw 'Classic backend diagnostic mismatch'}",
    "$script:Launcher.Region.Dispose()",
    "$script:Launcher.Dispose()",
    "$dispatchForm=[Windows.Forms.Form]::new()",
    "[void]$dispatchForm.Handle",
    "$script:taskHits=0",
    "$taskSource=[Threading.Tasks.TaskCompletionSource[bool]]::new()",
    "[AuraUiAsyncDispatch]::Watch($taskSource.Task,$dispatchForm,[Action]{$script:taskHits++})",
    "$taskSource.SetResult($true)",
    "$watch=[Diagnostics.Stopwatch]::StartNew()",
    "while($script:taskHits -lt 1 -and $watch.ElapsedMilliseconds -lt 2000){[Windows.Forms.Application]::DoEvents();[Threading.Thread]::Sleep(5)}",
    "if($script:taskHits -ne 1){throw 'Task continuation was not posted to the UI thread'}",
    "$script:signalHits=0",
    "$signal=[Threading.AutoResetEvent]::new($false)",
    "$registered=[AuraUiAsyncDispatch]::RegisterSignal($signal,$dispatchForm,[Action]{$script:signalHits++})",
    "[void]$signal.Set()",
    "$watch.Restart()",
    "while($script:signalHits -lt 1 -and $watch.ElapsedMilliseconds -lt 2000){[Windows.Forms.Application]::DoEvents();[Threading.Thread]::Sleep(5)}",
    "if($script:signalHits -ne 1){throw 'Registered signal was not posted to the UI thread'}",
    "[void]$registered.Unregister($null)",
    "$signal.Dispose()",
    "$dispatchForm.Dispose()",
    "Write-Output 'WO-29 launcher and dispatch smoke: PASS'",
  ].join("\n");
  const output = run("powershell.exe", [
    "-NoProfile",
    "-STA",
    "-ExecutionPolicy",
    "Bypass",
    "-EncodedCommand",
    Buffer.from(smoke, "utf16le").toString("base64"),
  ], { timeout: 30_000 });
  assert.match(output, /WO-29 launcher and dispatch smoke: PASS/);
});

runIfMain(import.meta.url);
