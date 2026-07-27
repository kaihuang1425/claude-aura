// platform tests. Extracted from the former monolithic tests/run-tests.mjs.
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
test("legacy macOS CDP validation rejects unsafe endpoints", async () => {
  const output = run(process.execPath, ["scripts/injector.mjs", "--self-test", "--port", "9394"]);
  const result = JSON.parse(output);
  assert.equal(result.pass, true);
  const injector = await fs.readFile(path.join(PROJECT_ROOT, "scripts", "injector.mjs"), "utf8");
  for (const marker of ["claude-aura-animated-image", "--aura-theme-art", "claudeAuraTheme", "claudeAuraArtMobile", "claudeAuraDigest"]) {
    assert(injector.includes(marker), `Legacy cleanup does not cover ${marker}`);
  }
});

// Windows can expose several bash launchers. The WindowsApps alias is WSL, which
// rejects Windows paths, so prefer a native (Git for Windows) bash, probe that the
// launcher actually starts, and always pass repo-relative arguments every launcher
// resolves against PROJECT_ROOT.
function resolveBashPath() {
  if (process.platform !== "win32") return "/bin/bash";
  const discovered = (spawnSync("where.exe", ["bash.exe"], { encoding: "utf8" }).stdout ?? "")
    .split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const isAlias = (candidate) => /[\\/]WindowsApps[\\/]/i.test(candidate);
  const gitBash = [process.env.ProgramFiles, process.env["ProgramFiles(x86)"], process.env.LOCALAPPDATA]
    .filter(Boolean).map((root) => path.join(root, "Git", "bin", "bash.exe"));
  const ranked = [...new Set([
    ...discovered.filter((candidate) => !isAlias(candidate)),
    ...gitBash,
    ...discovered.filter(isAlias),
  ])];
  for (const candidate of ranked) {
    const probe = spawnSync(candidate, ["-c", "exit 0"], { cwd: PROJECT_ROOT, encoding: "utf8" });
    if (!probe.error && probe.status === 0) return candidate;
  }
  return null;
}

test("JavaScript and platform scripts parse", async () => {
  const themeCoreModules = (await fs.readdir(path.join(PROJECT_ROOT, "scripts", "theme-core")))
    .filter((file) => file.endsWith(".mjs"))
    .sort()
    .map((file) => `scripts/theme-core/${file}`);
  const studioLocaleScripts = (await fs.readdir(path.join(PROJECT_ROOT, "studio", "locales")))
    .filter((file) => file.endsWith(".js"))
    .sort()
    .map((file) => `studio/locales/${file}`);
  const jsFiles = [
    "assets/renderer-inject.js",
    "assets/renderer-prepaint.js",
    "studio/app.js",
    "studio/editor.js",
    ...studioLocaleScripts,
    "scripts/build-aura-icon.mjs",
    "scripts/build-launcher-assets.mjs",
    "scripts/build-studio-themes.mjs",
    "scripts/build-release.mjs",
    "scripts/injector.mjs",
    "scripts/locale-tasks.mjs",
    "scripts/asset-audit.mjs",
    "scripts/state-cli.mjs",
    "scripts/theme-cli.mjs",
    "scripts/theme-core.mjs",
    "scripts/webview-cli.mjs",
    ...themeCoreModules,
  ];
  for (const file of jsFiles) run(process.execPath, ["--check", file]);

  if (process.platform === "win32") {
    const psFiles = (await fs.readdir(path.join(PROJECT_ROOT, "windows"))).filter((file) => file.endsWith(".ps1"));
    const command = [
      "$ErrorActionPreference='Stop'",
      "$failed=$false",
      ...psFiles.map((file) => `$tokens=$null;$errors=$null;$ast=[System.Management.Automation.Language.Parser]::ParseFile('${path.join(PROJECT_ROOT, "windows", file).replaceAll("'", "''")}',[ref]$tokens,[ref]$errors);if($errors.Count){$errors|ForEach-Object{Write-Error $_};$failed=$true};$bareIfCommands=@($ast.FindAll({param($node) $node -is [System.Management.Automation.Language.CommandAst] -and $node.GetCommandName() -ceq 'if'},$true));if($bareIfCommands.Count){$bareIfCommands|ForEach-Object{Write-Error \"Flow-control keyword parsed as a command at $($_.Extent.File):$($_.Extent.StartLineNumber): $($_.Extent.Text)\"};$failed=$true}`),
      "if($failed){exit 1}",
    ].join(";");
    run("powershell.exe", ["-NoProfile", "-Command", command]);
  }
  const bashPath = resolveBashPath();
  if (bashPath) {
    const shellFiles = (await fs.readdir(path.join(PROJECT_ROOT, "macos"))).filter((file) => file.endsWith(".sh"));
    run(bashPath, ["-n", ...shellFiles.map((file) => `macos/${file}`)]);
  }
});

test("Windows Studio bridge validates selectable metadata locales without rejecting incomplete drafts", async () => {
  const ui = await fs.readFile(path.join(PROJECT_ROOT, "windows", "aura-ui.ps1"), "utf8");
  const powershellFunction = (name) => {
    const start = ui.indexOf(`function ${name} {`);
    assert(start >= 0, `aura-ui.ps1 is missing ${name}`);
    const end = ui.indexOf("\nfunction ", start + 1);
    return ui.slice(start, end < 0 ? ui.length : end);
  };

  const metadataText = powershellFunction("Test-AuraUiStudioMetadataText");
  assert.match(metadataText,
    /\$Value -is \[string\][\s\S]*?\$Value\.Length -le \$Maximum[\s\S]*?\$Value -cnotmatch '\[\\x00-\\x08\\x0B\\x0C\\x0E-\\x1F\]'/,
    "Metadata text must remain bounded and reject control characters while allowing an empty draft value");
  assert(!metadataText.includes(".Trim()"),
    "The host text gate must not reject a selected locale merely because its draft value is blank");

  const stateValidation = powershellFunction("ConvertTo-AuraUiStudioEditorState");
  assert.match(stateValidation,
    /\$locales -cnotcontains 'en'[\s\S]*?\$_ -cnotin \$StudioLocaleIds/,
    "Editor state metadata must require English and use the canonical 15-locale allowlist");
  assert.match(stateValidation,
    /\$metadataLocales\.labels\.Count -ne \$metadataLocales\.descriptions\.Count[\s\S]*?\$_ -cnotin \$metadataLocales\.descriptions/,
    "Editor state labels and descriptions must expose an identical selected locale subset");
  assert.match(stateValidation,
    /Test-AuraUiStudioMetadataText -Value \$text -Maximum \$maximum/,
    "Editor state metadata must validate every selected locale with the shared bounded-text gate");

  const messageValidation = powershellFunction("Assert-AuraUiStudioEditorMessage");
  assert.match(messageValidation,
    /'metadata' \{[\s\S]*?\$change\.locale -cnotin \$StudioLocaleIds[\s\S]*?Test-AuraUiStudioMetadataText -Value \$change\.value -Maximum \$maximum/,
    "Metadata value patches must accept every canonical Studio locale and retain incomplete bounded text");
  assert.match(messageValidation,
    /'metadata-locale' \{[\s\S]*?@\('kind', 'locale', 'enabled'\)[\s\S]*?\$change\.locale -cnotin \$StudioLocaleIds[\s\S]*?\$change\.enabled -isnot \[bool\][\s\S]*?\$change\.locale -ceq 'en' -and -not \$change\.enabled/,
    "Metadata-locale patches must have an exact shape, canonical locale, Boolean state, and immutable English fallback");
});

test("Windows launcher avoids live page controls without mutating the saved position", async () => {
  const uiPath = path.join(PROJECT_ROOT, "windows", "aura-ui.ps1");
  const ui = await fs.readFile(uiPath, "utf8");
  const powershellFunction = (name) => {
    const start = ui.indexOf(`function ${name} {`);
    assert(start >= 0, `aura-ui.ps1 is missing ${name}`);
    const end = ui.indexOf("\nfunction ", start + 1);
    return ui.slice(start, end < 0 ? ui.length : end);
  };

  const positionUpdate = powershellFunction("Update-AuraUiLauncherPosition");
  const avoidCollector = powershellFunction("Get-AuraUiLauncherAvoidRectangles");
  const probeValidation = powershellFunction("Assert-AuraUiLauncherLayoutProbe");
  const probeRequest = powershellFunction("Request-AuraUiLauncherLayoutProbe");
  const probeUpdate = powershellFunction("Update-AuraUiLauncherLayoutProbe");
  const probeStop = powershellFunction("Stop-AuraUiLauncherLayoutProbe");
  const popupPlacement = powershellFunction("Get-AuraUiLauncherPopupLocation");
  const tipPositionUpdate = powershellFunction("Update-AuraUiLauncherTipPosition");
  const hintPositionUpdate = powershellFunction("Update-AuraUiLauncherHintPosition");
  const tipShow = powershellFunction("Show-AuraUiLauncherTip");
  const mirrorUpdate = powershellFunction("Update-AuraUiMirror");
  const automaticPlacement = [
    positionUpdate,
    avoidCollector,
    probeRequest,
    probeUpdate,
    probeStop,
  ].join("\n");

  assert.doesNotMatch(automaticPlacement, /Save-AuraUiLauncherPosition/,
    "Automatic collision avoidance must never overwrite the user's saved launcher gaps");
  assert.match(positionUpdate,
    /Get-AuraUiLauncherClampedLocation[\s\S]*?Get-AuraUiLauncherAvoidRectangles[\s\S]*?Get-AuraUiLauncherCollisionFreeLocation/,
    "Launcher placement must solve from the clamped saved preference and bounded live obstacles");
  assert.match(probeValidation,
    /\$Value\.controls -isnot \[System\.Array\][\s\S]*?@\(\$Value\.controls\)\.Count -gt 12/,
    "The host must reject non-array or over-budget control collections");
  assert.match(probeValidation,
    /foreach \(\$control in @\(\$Value\.controls\)\)[\s\S]*?ConvertTo-AuraUiLauncherProbeRectangle[\s\S]*?-Label "Aura control \$controlIndex"/,
    "Every accepted control rectangle must pass the bounded rectangle validator");
  assert.match(probeUpdate,
    /\$generation -ne \$script:LauncherProbeGeneration/,
    "A completed launcher probe must be rejected after its request generation becomes stale");
  assert.match(probeUpdate,
    /\[string\]::Equals\([\s\S]*?\$expectedDigest,[\s\S]*?\$script:ActivePayloadDigest,[\s\S]*?\[StringComparison\]::Ordinal\)/,
    "A completed launcher probe must still belong to the active renderer payload");
  assert.match(probeUpdate,
    /\$script:WebView\.ClientSize\.Width -ne \$taskClientSize\.Width[\s\S]*?\$script:WebView\.ClientSize\.Height -ne \$taskClientSize\.Height/,
    "A completed launcher probe must be rejected after the native WebView client size changes");
  const pendingAssignmentIndex = probeRequest.indexOf("$script:LauncherLayoutPending =");
  const probeClearIndex = probeRequest.indexOf("$script:LauncherLayoutProbe = $null");
  assert(pendingAssignmentIndex >= 0 && probeClearIndex > pendingAssignmentIndex,
    "A fresh launcher request must establish pending state before discarding the previous page geometry");
  assert.match(probeRequest,
    /\$script:LauncherLayoutPending\s*=\s*\[bool\]\([\s\S]*?Get-AuraUiEnabled[\s\S]*?\$script:ActivePayloadDigest[\s\S]*?\)/,
    "Pending startup gating must apply to an enabled themed payload while Original look remains available");
  assert.match(probeStop, /\$script:LauncherLayoutPending\s*=\s*\$false/,
    "Stopping the themed launcher probe must retire its pending state");
  assert.match(probeUpdate,
    /Assert-AuraUiLauncherLayoutProbe[\s\S]*?\$script:LauncherLayoutProbeClientSize\s*=\s*\[Drawing\.Size\]::new\([\s\S]*?\$script:LauncherLayoutPending\s*=\s*\$false/,
    "Only a validated current probe and client-size snapshot may leave pending state");
  const pendingPlacementIndex = positionUpdate.indexOf("if ($script:LauncherLayoutPending)");
  const pendingReturnIndex = positionUpdate.indexOf("\n    return", pendingPlacementIndex);
  const launcherShowIndex = positionUpdate.indexOf("$script:Launcher.Show($script:Form)");
  assert(pendingPlacementIndex >= 0 && pendingReturnIndex > pendingPlacementIndex
      && launcherShowIndex > pendingReturnIndex,
  "The first themed startup must reject pending geometry before the launcher can become visible");
  assert.match(tipShow,
    /if \([\s\S]{0,160}?\$script:LauncherLayoutPending[\s\S]{0,160}?\)\s*\{\s*return\s*\}/,
    "A help tip must not appear while its page-avoidance geometry is pending");
  assert.match(popupPlacement,
    /\[AllowNull\(\)\]\[object\[\]\]\$AvoidRectangles[\s\S]*?\[switch\]\$RequireCollisionFree/,
    "Popup placement must accept the same live avoid rectangles and a fail-closed collision mode");
  for (const [name, updater] of [
    ["tip", tipPositionUpdate],
    ["hint", hintPositionUpdate],
  ]) {
    assert.match(updater,
      /Get-AuraUiLauncherPopupLocation[\s\S]*?-AvoidRectangles\s+@\(Get-AuraUiLauncherAvoidRectangles\)[\s\S]*?-RequireCollisionFree/,
      `The launcher ${name} must place against the same live composer and toolbar geometry as its anchor`);
    assert.match(updater, /if \(\$null -eq \$location\)[\s\S]{0,220}?(?:Hide|ShowWindow)[\s\S]{0,140}?return/,
      `The launcher ${name} must stay hidden when no collision-free popup placement exists`);
  }
  for (const launcherLifecycle of [probeRequest, probeUpdate, probeStop]) {
    assert.doesNotMatch(launcherLifecycle, /\$script:Mirror(?:Probe|Geometry|Capture|Generation|Due)/,
      "Launcher probe lifecycle must not borrow Studio mirror state");
  }
  assert.doesNotMatch(mirrorUpdate, /\$script:Launcher(?:Probe|LayoutProbe)/,
    "Studio mirror lifecycle must not borrow launcher probe state");

  if (process.platform === "win32") {
    const regression = [
      "$ErrorActionPreference='Stop'",
      "Add-Type -AssemblyName System.Drawing",
      `$uiPath='${uiPath.replaceAll("'", "''")}'`,
      "$tokens=$null;$errors=$null",
      "$ast=[System.Management.Automation.Language.Parser]::ParseFile($uiPath,[ref]$tokens,[ref]$errors)",
      "if($errors.Count){throw 'Could not parse Aura UI for launcher collision regression'}",
      "$names=@('ConvertTo-AuraUiLauncherScreenRectangle','Get-AuraUiLauncherCollisionFreeLocation','Get-AuraUiLauncherPopupLocation')",
      "foreach($name in $names){",
      "  $definition=$ast.Find({param($node)$node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -ceq $name},$true)",
      "  if($null -eq $definition){throw \"Missing launcher geometry function $name\"}",
      "  Invoke-Expression $definition.Extent.Text",
      "}",
      "function Assert-Point {",
      "  param([Drawing.Point]$Actual,[int]$X,[int]$Y,[string]$Label)",
      "  if($Actual.X -ne $X -or $Actual.Y -ne $Y){throw \"$Label was $($Actual.X),$($Actual.Y); expected $X,$Y\"}",
      "}",
      "$bounds=[Drawing.Rectangle]::new(0,0,1000,700)",
      "$preferred=[Drawing.Point]::new(900,620)",
      "$clear=Get-AuraUiLauncherCollisionFreeLocation -Preferred $preferred -Bounds $bounds -CircleSize 48 -Halo 8 -Gap 16 -AvoidRectangles @()",
      "Assert-Point -Actual $clear -X 900 -Y 620 -Label 'Clear preferred placement'",
      "$composer=[Drawing.Rectangle]::new(720,540,260,150)",
      "$composerAvoided=Get-AuraUiLauncherCollisionFreeLocation -Preferred $preferred -Bounds $bounds -CircleSize 48 -Halo 8 -Gap 16 -AvoidRectangles @($composer)",
      "Assert-Point -Actual $composerAvoided -X 900 -Y 468 -Label 'Composer avoidance'",
      "$toolbar=[Drawing.Rectangle]::new(850,560,130,100)",
      "$control=[Drawing.Rectangle]::new(720,480,200,100)",
      "$overlapAvoided=Get-AuraUiLauncherCollisionFreeLocation -Preferred $preferred -Bounds $bounds -CircleSize 48 -Halo 8 -Gap 16 -AvoidRectangles @($toolbar,$control)",
      "Assert-Point -Actual $overlapAvoided -X 778 -Y 620 -Label 'Overlapping toolbar and control avoidance'",
      "$highDpi=Get-AuraUiLauncherCollisionFreeLocation -Preferred ([Drawing.Point]::new(1800,1240)) -Bounds ([Drawing.Rectangle]::new(0,0,2000,1400)) -CircleSize 96 -Halo 16 -Gap 32 -AvoidRectangles @([Drawing.Rectangle]::new(1440,1080,520,300))",
      "Assert-Point -Actual $highDpi -X 1800 -Y 936 -Label 'DPI-scaled composer avoidance'",
      "$edgeClamped=Get-AuraUiLauncherCollisionFreeLocation -Preferred ([Drawing.Point]::new(-200,900)) -Bounds $bounds -CircleSize 48 -Halo 8 -Gap 16 -AvoidRectangles @()",
      "Assert-Point -Actual $edgeClamped -X 8 -Y 628 -Label 'Visible-circle edge clamp'",
      "$restored=Get-AuraUiLauncherCollisionFreeLocation -Preferred $preferred -Bounds $bounds -CircleSize 48 -Halo 8 -Gap 16 -AvoidRectangles @()",
      "Assert-Point -Actual $restored -X 900 -Y 620 -Label 'Preferred placement after obstruction removal'",
      "$noSolution=Get-AuraUiLauncherCollisionFreeLocation -Preferred ([Drawing.Point]::new(20,20)) -Bounds ([Drawing.Rectangle]::new(0,0,100,100)) -CircleSize 48 -Halo 8 -Gap 16 -AvoidRectangles @([Drawing.Rectangle]::new(0,0,100,100))",
      "Assert-Point -Actual $noSolution -X 20 -Y 20 -Label 'No-solution preferred fallback'",
      "$script:WebView=[PSCustomObject]@{IsDisposed=$false;ClientSize=[Drawing.Size]::new(1500,1000)}",
      "$script:WebView | Add-Member -MemberType ScriptMethod -Name PointToScreen -Value { param($point) [Drawing.Point]::new(100 + $point.X,200 + $point.Y) }",
      "$probe=[PSCustomObject]@{viewport=[PSCustomObject]@{width=1000.0;height=500.0;dpr=3.0}}",
      "$cssRectangle=[PSCustomObject]@{left=800.0;top=400.0;width=100.0;height=50.0}",
      "$scaled=ConvertTo-AuraUiLauncherScreenRectangle -Rectangle $cssRectangle -Probe $probe",
      "if($scaled.Left -ne 1300 -or $scaled.Top -ne 1000 -or $scaled.Width -ne 150 -or $scaled.Height -ne 100){throw 'CSS-to-screen conversion used DPR instead of measured per-axis client scale'}",
      "$popupBounds=[Drawing.Rectangle]::new(0,0,1000,700)",
      "$popupAnchor=[Drawing.Rectangle]::new(800,300,48,48)",
      "$popupSize=[Drawing.Size]::new(300,100)",
      "$composerObstacle=[Drawing.Rectangle]::new(500,160,400,150)",
      "$remoteToolbar=[Drawing.Rectangle]::new(40,40,120,60)",
      "$safePopup=Get-AuraUiLauncherPopupLocation -Anchor $popupAnchor -PopupSize $popupSize -Bounds $popupBounds -Gap 12 -AvoidRectangles @($composerObstacle,$remoteToolbar) -RequireCollisionFree",
      "if($null -eq $safePopup){throw 'Popup avoidance hid a help card even though a safe candidate existed'}",
      "$safePopupBounds=[Drawing.Rectangle]::new($safePopup,$popupSize)",
      "if($safePopupBounds.IntersectsWith($popupAnchor) -or $safePopupBounds.IntersectsWith($composerObstacle) -or $safePopupBounds.IntersectsWith($remoteToolbar)){throw 'Popup avoidance returned a help card over its launcher or live page controls'}",
      "$blockingToolbar=[Drawing.Rectangle]::new(500,340,400,140)",
      "$blockedPopup=Get-AuraUiLauncherPopupLocation -Anchor $popupAnchor -PopupSize $popupSize -Bounds $popupBounds -Gap 12 -AvoidRectangles @($composerObstacle,$blockingToolbar) -RequireCollisionFree",
      "if($null -ne $blockedPopup){throw 'Popup avoidance covered controls instead of failing closed when every candidate was blocked'}",
      "$anchorBlocked=Get-AuraUiLauncherPopupLocation -Anchor ([Drawing.Rectangle]::new(176,126,48,48)) -PopupSize ([Drawing.Size]::new(360,260)) -Bounds ([Drawing.Rectangle]::new(0,0,400,300)) -Gap 12 -AvoidRectangles @() -RequireCollisionFree",
      "if($null -ne $anchorBlocked){throw 'Clamped popup covered its launcher anchor instead of failing closed'}",
    ].join("\n");
    run("powershell.exe", [
      "-NoProfile",
      "-EncodedCommand",
      Buffer.from(regression, "utf16le").toString("base64"),
    ]);
  }
});

test("Aura identity assets are deterministic and the icon contains every required Windows frame", async () => {
  const expectedSizes = [16, 20, 24, 32, 40, 48, 64, 128, 256];
  const sourcePath = path.join(PROJECT_ROOT, "assets", "brand", "aura-mark.svg");
  const committedPath = path.join(PROJECT_ROOT, "assets", "brand", "claude-aura.ico");
  const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "claude-aura-icon-"));
  try {
    const firstPath = path.join(temporaryRoot, "first.ico");
    const secondPath = path.join(temporaryRoot, "second.ico");
    const first = await buildAuraIcon({ sourcePath, outputPath: firstPath });
    const second = await buildAuraIcon({ sourcePath, outputPath: secondPath });
    assert.deepEqual(first.sizes, expectedSizes);
    assert.deepEqual(second.sizes, expectedSizes);
    assert.equal(first.sha256, second.sha256, "Repeated icon builds must have the same digest");

    const [firstBytes, secondBytes, committedBytes] = await Promise.all([
      fs.readFile(firstPath),
      fs.readFile(secondPath),
      fs.readFile(committedPath),
    ]);
    assert.deepEqual(firstBytes, secondBytes, "Repeated icon builds must be byte-for-byte identical");
    assert.deepEqual(committedBytes, firstBytes, "The committed ICO must be derived from the canonical SVG");
    assert.equal(first.bytes, firstBytes.length);
    assert.equal(firstBytes.readUInt16LE(0), 0, "ICO reserved field must be zero");
    assert.equal(firstBytes.readUInt16LE(2), 1, "ICO must identify itself as an icon");
    assert.equal(firstBytes.readUInt16LE(4), expectedSizes.length, "ICO frame count is incomplete");

    let expectedOffset = 6 + expectedSizes.length * 16;
    const actualSizes = [];
    for (let index = 0; index < expectedSizes.length; index += 1) {
      const entry = 6 + index * 16;
      const size = firstBytes[entry] || 256;
      const height = firstBytes[entry + 1] || 256;
      const byteLength = firstBytes.readUInt32LE(entry + 8);
      const imageOffset = firstBytes.readUInt32LE(entry + 12);
      actualSizes.push(size);
      assert.equal(height, size, `ICO frame ${size}px must be square`);
      assert.equal(firstBytes[entry + 2], 0, `ICO frame ${size}px must not use a palette`);
      assert.equal(firstBytes[entry + 3], 0, `ICO frame ${size}px reserved byte must be zero`);
      assert.equal(firstBytes.readUInt16LE(entry + 4), 1, `ICO frame ${size}px must have one plane`);
      assert.equal(firstBytes.readUInt16LE(entry + 6), 32, `ICO frame ${size}px must be 32-bit`);
      assert(byteLength > 0, `ICO frame ${size}px is empty`);
      assert.equal(imageOffset, expectedOffset, `ICO frame ${size}px has an unexpected offset`);
      assert(imageOffset + byteLength <= firstBytes.length, `ICO frame ${size}px exceeds the file boundary`);
      if (size === 256) {
        assert.deepEqual([...firstBytes.subarray(imageOffset, imageOffset + 8)], [137, 80, 78, 71, 13, 10, 26, 10],
          "The 256px ICO frame must use its lossless PNG representation");
      } else {
        assert.equal(firstBytes.readUInt32LE(imageOffset), 40, `ICO frame ${size}px needs a BITMAPINFOHEADER`);
        assert.equal(firstBytes.readInt32LE(imageOffset + 4), size, `ICO frame ${size}px DIB width is incorrect`);
        assert.equal(firstBytes.readInt32LE(imageOffset + 8), size * 2, `ICO frame ${size}px DIB height must include its mask`);
        assert.equal(firstBytes.readUInt16LE(imageOffset + 12), 1, `ICO frame ${size}px DIB must have one plane`);
        assert.equal(firstBytes.readUInt16LE(imageOffset + 14), 32, `ICO frame ${size}px DIB must be 32-bit`);
      }
      expectedOffset += byteLength;
    }
    assert.deepEqual(actualSizes, expectedSizes);
    assert.equal(expectedOffset, firstBytes.length, "ICO contains unindexed trailing data");

    const firstLauncherRoot = path.join(temporaryRoot, "launcher-first");
    const secondLauncherRoot = path.join(temporaryRoot, "launcher-second");
    const [firstLaunchers, secondLaunchers] = await Promise.all([
      buildLauncherAssets({ outputRoot: firstLauncherRoot }),
      buildLauncherAssets({ outputRoot: secondLauncherRoot }),
    ]);
    const launcherResult = ({
      theme, sourceWidth, sourceHeight, visibleBounds, width, height, bytes, sha256,
      iconSizes, iconBytes, iconSha256,
    }) => ({
      theme, sourceWidth, sourceHeight, visibleBounds, width, height, bytes, sha256,
      iconSizes, iconBytes, iconSha256,
    });
    assert.deepEqual(firstLaunchers.map(launcherResult), secondLaunchers.map(launcherResult),
      "Repeated launcher builds must report identical results");
    assert.deepEqual(firstLaunchers.map((result) => result.theme), THEME_IDS);

    const markDigests = new Set();
    const iconDigests = new Set();
    for (const result of firstLaunchers) {
      assert(result.sourceWidth >= 512 && result.sourceHeight >= 512,
        `${result.theme} launcher source must retain high-resolution detail`);
      assert(result.visibleBounds.left > 0 && result.visibleBounds.top > 0
          && result.visibleBounds.right < result.sourceWidth - 1
          && result.visibleBounds.bottom < result.sourceHeight - 1,
      `${result.theme} launcher source needs transparent edge padding`);
      assert.deepEqual(result.iconSizes, expectedSizes, `${result.theme} launcher ICO frame set is incomplete`);
      assert(result.iconBytes > 0 && result.iconBytes < 400_000, `${result.theme} launcher ICO exceeds its budget`);
      const [firstMark, secondMark, committedMark, firstIcon, secondIcon, committedIcon, sourceMark] = await Promise.all([
        fs.readFile(path.join(firstLauncherRoot, result.theme, "launcher-mark.png")),
        fs.readFile(path.join(secondLauncherRoot, result.theme, "launcher-mark.png")),
        fs.readFile(path.join(PROJECT_ROOT, "assets", "theme-art", result.theme, "launcher-mark.png")),
        fs.readFile(path.join(firstLauncherRoot, result.theme, "launcher-mark.ico")),
        fs.readFile(path.join(secondLauncherRoot, result.theme, "launcher-mark.ico")),
        fs.readFile(path.join(PROJECT_ROOT, "assets", "theme-art", result.theme, "launcher-mark.ico")),
        fs.readFile(path.join(PROJECT_ROOT, "assets", "studio-previews", "references", "launcher-marks-v2", `${result.theme}.png`)),
      ]);
      assert.deepEqual([...sourceMark.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
      assert(sourceMark.readUInt32BE(16) >= 512 && sourceMark.readUInt32BE(20) >= 512,
        `${result.theme} launcher source is too small for premium resampling`);
      assert.equal(sourceMark[25], 6, `${result.theme} launcher source must retain RGBA transparency`);
      assert.deepEqual(firstMark, secondMark, `${result.theme} launcher builds must be byte-for-byte identical`);
      assert.deepEqual(committedMark, firstMark, `${result.theme} committed launcher mark is stale`);
      assert.deepEqual(firstIcon, secondIcon, `${result.theme} launcher ICO builds must be byte-for-byte identical`);
      assert.deepEqual(committedIcon, firstIcon, `${result.theme} committed launcher ICO is stale`);
      assert.equal(firstIcon.readUInt16LE(0), 0, `${result.theme} ICO reserved field must be zero`);
      assert.equal(firstIcon.readUInt16LE(2), 1, `${result.theme} ICO must identify itself as an icon`);
      assert.equal(firstIcon.readUInt16LE(4), expectedSizes.length, `${result.theme} ICO frame count is incomplete`);
      let launcherIconOffset = 6 + expectedSizes.length * 16;
      const launcherIconSizes = [];
      for (let index = 0; index < expectedSizes.length; index += 1) {
        const entry = 6 + index * 16;
        const size = firstIcon[entry] || 256;
        const height = firstIcon[entry + 1] || 256;
        const byteLength = firstIcon.readUInt32LE(entry + 8);
        const imageOffset = firstIcon.readUInt32LE(entry + 12);
        launcherIconSizes.push(size);
        assert.equal(height, size, `${result.theme} ICO frame ${size}px must be square`);
        assert.equal(firstIcon.readUInt16LE(entry + 4), 1, `${result.theme} ICO frame ${size}px must have one plane`);
        assert.equal(firstIcon.readUInt16LE(entry + 6), 32, `${result.theme} ICO frame ${size}px must be 32-bit`);
        assert.equal(imageOffset, launcherIconOffset, `${result.theme} ICO frame ${size}px has an unexpected offset`);
        assert(byteLength > 0 && imageOffset + byteLength <= firstIcon.length,
          `${result.theme} ICO frame ${size}px exceeds the file boundary`);
        if (size === 256) {
          assert.deepEqual([...firstIcon.subarray(imageOffset, imageOffset + 8)],
            [137, 80, 78, 71, 13, 10, 26, 10], `${result.theme} 256px ICO frame must be lossless PNG`);
        } else {
          assert.equal(firstIcon.readUInt32LE(imageOffset), 40,
            `${result.theme} ICO frame ${size}px needs a BITMAPINFOHEADER`);
          assert.equal(firstIcon.readInt32LE(imageOffset + 4), size,
            `${result.theme} ICO frame ${size}px DIB width is incorrect`);
          assert.equal(firstIcon.readInt32LE(imageOffset + 8), size * 2,
            `${result.theme} ICO frame ${size}px DIB height must include its mask`);
        }
        launcherIconOffset += byteLength;
      }
      assert.deepEqual(launcherIconSizes, expectedSizes);
      assert.equal(launcherIconOffset, firstIcon.length, `${result.theme} ICO contains unindexed trailing data`);
      markDigests.add(result.sha256);
      iconDigests.add(result.iconSha256);
    }
    assert.equal(markDigests.size, THEME_IDS.length,
      "Every built-in theme must have a visually distinct launcher mark");
    assert.equal(iconDigests.size, THEME_IDS.length,
      "Every built-in theme must have a distinct Windows launcher icon");
  } finally {
    await fs.rm(temporaryRoot, { recursive: true, force: true });
  }
});

test("Windows window clamp fits a synthetic 1280x720 working area", async () => {
  const ui = await fs.readFile(path.join(PROJECT_ROOT, "windows", "aura-ui.ps1"), "utf8");
  const functionMatch = ui.match(/function Set-AuraUiFormWithinWorkingArea \{[\s\S]*?\r?\n\}/);
  assert(functionMatch, "The working-area clamp function could not be isolated");
  const functionSource = functionMatch[0];
  assert.match(functionSource, /\$maximumWidth\s*=\s*\[Math\]::Max\(1,\s*\$workingArea\.Width\s*-\s*\(\$Margin\s*\*\s*2\)\)/);
  assert.match(functionSource, /\$maximumHeight\s*=\s*\[Math\]::Max\(1,\s*\$workingArea\.Height\s*-\s*\(\$Margin\s*\*\s*2\)\)/);
  assert.match(functionSource, /\$width\s*=\s*\[Math\]::Min\(\$Form\.Width,\s*\$maximumWidth\)/);
  assert.match(functionSource, /\$height\s*=\s*\[Math\]::Min\(\$Form\.Height,\s*\$maximumHeight\)/);
  assert.match(functionSource,
    /if \(\$Form\.WindowState -ne \[System\.Windows\.Forms\.FormWindowState\]::Normal\) \{ return \}/,
    "Working-area repair must not corrupt maximized or minimized restore bounds");

  const clientSizeMatch = ui.match(/\$script:Form\.ClientSize\s*=\s*\[Drawing\.Size\]::new\((\d+),\s*(\d+)\)/);
  const minimumSizeMatch = ui.match(/\$script:Form\.MinimumSize\s*=\s*\[Drawing\.Size\]::new\((\d+),\s*(\d+)\)/);
  assert(clientSizeMatch, "The main window client size is missing");
  assert(minimumSizeMatch, "The main window minimum size is missing");

  const syntheticArea = { left: 0, top: 0, width: 1280, height: 720 };
  const margin = 12;
  const clamp = (width, height) => {
    const maximumWidth = Math.max(1, syntheticArea.width - (margin * 2));
    const maximumHeight = Math.max(1, syntheticArea.height - (margin * 2));
    const clampedWidth = Math.min(width, maximumWidth);
    const clampedHeight = Math.min(height, maximumHeight);
    return {
      width: clampedWidth,
      height: clampedHeight,
      left: syntheticArea.left + Math.max(margin, Math.floor((syntheticArea.width - clampedWidth) / 2)),
      top: syntheticArea.top + Math.max(margin, Math.floor((syntheticArea.height - clampedHeight) / 2)),
    };
  };
  const oversized = clamp(1600, 900);
  assert.deepEqual(oversized, { width: 1256, height: 696, left: 12, top: 12 });
  assert(oversized.left + oversized.width <= syntheticArea.width - margin);
  assert(oversized.top + oversized.height <= syntheticArea.height - margin);
  assert(Number(minimumSizeMatch[1]) <= oversized.width && Number(minimumSizeMatch[2]) <= oversized.height,
    "The minimum window size cannot fit the synthetic working area");

  if (process.platform === "win32") {
    const injectedFunction = functionSource
      .replace("function Set-AuraUiFormWithinWorkingArea", "function Test-AuraUiFormWithinWorkingArea")
      .replace(
        "param([AllowNull()][System.Windows.Forms.Form]$Form, [int]$Margin = 12)",
        "param([AllowNull()][System.Windows.Forms.Form]$Form, [int]$Margin = 12, [Drawing.Rectangle]$SyntheticWorkingArea)",
      )
      .replace(
        "$workingArea = [System.Windows.Forms.Screen]::FromControl($Form).WorkingArea",
        "$workingArea = $SyntheticWorkingArea",
      );
    assert.notEqual(injectedFunction, functionSource, "The clamp function could not accept a synthetic working area");
    assert.match(injectedFunction, /\$workingArea = \$SyntheticWorkingArea/);

    const defaultWidth = Number(clientSizeMatch[1]);
    const defaultHeight = Number(clientSizeMatch[2]);
    const minimumWidth = Number(minimumSizeMatch[1]);
    const minimumHeight = Number(minimumSizeMatch[2]);
    const powershell = [
      "$ErrorActionPreference='Stop'",
      "Add-Type -AssemblyName System.Windows.Forms",
      "Add-Type -AssemblyName System.Drawing",
      injectedFunction,
      "$area=[Drawing.Rectangle]::new(0,0,1280,720)",
      "$form=[System.Windows.Forms.Form]::new()",
      "try {",
      `  $form.MinimumSize=[Drawing.Size]::new(${minimumWidth},${minimumHeight})`,
      `  $form.ClientSize=[Drawing.Size]::new(${defaultWidth},${defaultHeight})`,
      "  Test-AuraUiFormWithinWorkingArea -Form $form -Margin 12 -SyntheticWorkingArea $area",
      "  if($form.Left -lt 12 -or $form.Top -lt 12 -or $form.Right -gt 1268 -or $form.Bottom -gt 708){throw \"Default window escaped the synthetic working area: $($form.Bounds)\"}",
      "  $form.Size=[Drawing.Size]::new(1600,900)",
      "  Test-AuraUiFormWithinWorkingArea -Form $form -Margin 12 -SyntheticWorkingArea $area",
      "  if($form.Bounds -ne [Drawing.Rectangle]::new(12,12,1256,696)){throw \"Oversized window clamped to unexpected bounds: $($form.Bounds)\"}",
      "  foreach($state in @([Windows.Forms.FormWindowState]::Maximized,[Windows.Forms.FormWindowState]::Minimized)){",
      "    $form.WindowState=$state",
      "    $before=$form.Bounds",
      "    Test-AuraUiFormWithinWorkingArea -Form $form -Margin 12 -SyntheticWorkingArea $area",
      "    if($form.WindowState -ne $state -or $form.Bounds -ne $before){throw \"Clamp changed $state window geometry\"}",
      "  }",
      "} finally { $form.Dispose() }",
    ].join("\n");
    run("powershell.exe", ["-NoProfile", "-STA", "-EncodedCommand", Buffer.from(powershell, "utf16le").toString("base64")]);
  }
});

test("Windows startup layout separates compact maximize from spacious saved bounds", async () => {
  const ui = await fs.readFile(path.join(PROJECT_ROOT, "windows", "aura-ui.ps1"), "utf8");
  const functionSource = (name, nextName) => {
    const start = ui.indexOf(`function ${name} {`);
    const end = ui.indexOf(`function ${nextName} {`, start);
    assert(start >= 0 && end > start, `Could not isolate ${name}`);
    return ui.slice(start, end);
  };
  const displayClass = functionSource(
    "Get-AuraUiWindowDisplayClass",
    "Get-AuraUiWindowBoundsWithinWorkingArea",
  );
  const boundsClamp = functionSource(
    "Get-AuraUiWindowBoundsWithinWorkingArea",
    "Set-AuraUiFormBoundsWithinWorkingArea",
  );
  const boundsSetter = functionSource(
    "Set-AuraUiFormBoundsWithinWorkingArea",
    "Get-AuraUiWindowStartupScreen",
  );
  const initialize = functionSource(
    "Initialize-AuraUiWindowLayoutForForm",
    "Update-AuraUiWindowNormalSnapshot",
  );
  const normalSnapshot = functionSource(
    "Update-AuraUiWindowNormalSnapshot",
    "Save-AuraUiWindowLayoutForForm",
  );
  const save = functionSource("Save-AuraUiWindowLayoutForForm", "New-AuraUiIcon");
  const writer = functionSource(
    "Write-AuraUiWindowLayoutState",
    "Get-AuraUiWindowDisplayClass",
  );
  const showStudio = functionSource("Show-AuraUiStudio", "Show-AuraUiMain");
  const showMain = functionSource("Show-AuraUiMain", "Show-AuraUiMainForPreview");

  assert.match(ui,
    /\$WindowLayoutPath\s*=\s*Join-Path \$DataRoot 'window-layout\.json'/,
    "Window geometry must stay in a separate device-local state file");
  assert.match(displayClass,
    /\$logicalWidth[\s\S]*?\$WorkingArea\.Width \* 96\.0 \/ \$Dpi[\s\S]*?\$logicalHeight[\s\S]*?\$WorkingArea\.Height \* 96\.0 \/ \$Dpi/,
    "Compact detection must use DPI-normalized working area, not raw resolution");
  assert.match(initialize,
    /\$record\s*=\s*\$script:WindowLayoutState\.\$Kind\.\$displayClass[\s\S]*?Update-AuraUiWindowNormalSnapshot -Kind \$Kind -Form \$Form[\s\S]*?if \(\$displayClass -ceq 'compact'\)[\s\S]*?FormWindowState\]::Maximized[\s\S]*?else\s*\{[\s\S]*?FormWindowState\]::Normal/,
    "Compact startup must maximize after seeding restore bounds; spacious startup must remain normal");
  assert.match(normalSnapshot,
    /bounds\s*=\s*\[Drawing\.Rectangle\]::new\([\s\S]*?\$Form\.Bounds\.X[\s\S]*?dpi\s*=\s*\[int\]\(Get-AuraUiWindowDpi -Form \$Form\)/,
    "Normal bounds and their monitor DPI must be captured as one paired snapshot");
  assert.match(save,
    /WindowState -eq \[System\.Windows\.Forms\.FormWindowState\]::Normal[\s\S]*?Update-AuraUiWindowNormalSnapshot[\s\S]*?\$bounds\s*=\s*\[Drawing\.Rectangle\]\$snapshot\.bounds[\s\S]*?\$dpi\s*=\s*\[int\]\$snapshot\.dpi/,
    "Maximized or minimized geometry must persist paired normal bounds and DPI");
  assert.match(save,
    /MirrorRequestedCssRequest -ne 0[\s\S]*?PreviewClientResizeActive/,
    "Studio preview sizing must not overwrite the human Aura window preference");
  assert.match(writer,
    /WriteAllText\(\$temporary[\s\S]*?\[IO\.File\]::Replace\(\$temporary, \$WindowLayoutPath, \$backup\)[\s\S]*?\[IO\.File\]::Move\(\$temporary, \$WindowLayoutPath\)/,
    "Window layout persistence must use the repository's atomic replace pattern");
  assert.match(writer,
    /try\s*\{\s*\[void\]\[IO\.Directory\]::CreateDirectory\(\$DataRoot\)/,
    "A transient data-directory failure must stay inside the fail-open persistence boundary");
  assert.match(ui,
    /\$script:Form\.add_ResizeEnd\(\{\s*Save-AuraUiWindowLayoutForForm -Kind aura/,
    "Aura must save settled normal bounds after a human move or resize");
  assert.match(ui,
    /\$script:StudioForm\.add_ResizeEnd\(\{[\s\S]{0,120}?Save-AuraUiWindowLayoutForForm -Kind studio/,
    "Studio must save its own settled normal bounds independently");
  assert.match(showStudio,
    /StudioLastWindowState -eq \[System\.Windows\.Forms\.FormWindowState\]::Maximized[\s\S]*?FormWindowState\]::Maximized[\s\S]*?FormWindowState\]::Normal/,
    "Reopening minimized Studio must preserve its last non-minimized state");
  assert.doesNotMatch(showStudio,
    /if \(\$script:StudioForm\.WindowState -eq [^{]+\{\s*\$script:StudioForm\.WindowState = \[System\.Windows\.Forms\.FormWindowState\]::Normal\s*\}/,
    "Studio must not always normalize a window that was minimized from maximized");
  assert.match(showMain,
    /AuraLastWindowState -eq \[System\.Windows\.Forms\.FormWindowState\]::Maximized/,
    "Aura foreground signaling must preserve a minimized-from-maximized state");

  if (process.platform === "win32") {
    const powershell = [
      "$ErrorActionPreference='Stop'",
      "Add-Type -AssemblyName System.Windows.Forms",
      "Add-Type -AssemblyName System.Drawing",
      displayClass,
      boundsClamp,
      boundsSetter,
      initialize,
      normalSnapshot,
      save,
      "$compact=Get-AuraUiWindowDisplayClass -WorkingArea ([Drawing.Rectangle]::new(0,0,1920,1040)) -Dpi 144",
      "if($compact -cne 'compact'){throw \"Scaled laptop area classified as $compact\"}",
      "$spacious=Get-AuraUiWindowDisplayClass -WorkingArea ([Drawing.Rectangle]::new(0,0,3840,2080)) -Dpi 192",
      "if($spacious -cne 'spacious'){throw \"Scaled large display classified as $spacious\"}",
      "$negative=Get-AuraUiWindowBoundsWithinWorkingArea -Bounds ([Drawing.Rectangle]::new(-2000,-100,1800,1000)) -WorkingArea ([Drawing.Rectangle]::new(-1600,40,1600,860)) -MinimumSize ([Drawing.Size]::new(920,620)) -Margin 12",
      "if($negative -ne [Drawing.Rectangle]::new(-1588,52,1576,836)){throw \"Negative-origin clamp returned $negative\"}",
      "$script:MirrorRequestedCssRequest=0; $script:PreviewClientResizeActive=$false; $script:AuraNormalWindowSnapshot=$null",
      "function Get-AuraUiWindowDpi { param($Form) return $script:SimulatedDpi }",
      "$form=[Windows.Forms.Form]::new(); $form.StartPosition='Manual'; $form.Bounds=[Drawing.Rectangle]::new(-1400,80,1100,700); [void]$form.Handle",
      "$script:SimulatedDpi=144; Update-AuraUiWindowNormalSnapshot -Kind aura -Form $form",
      "$form.WindowState=[Windows.Forms.FormWindowState]::Maximized; $script:SimulatedDpi=192; Update-AuraUiWindowNormalSnapshot -Kind aura -Form $form",
      "if($script:AuraNormalWindowSnapshot.bounds -ne [Drawing.Rectangle]::new(-1400,80,1100,700) -or $script:AuraNormalWindowSnapshot.dpi -ne 144){throw 'Maximized cross-DPI state replaced the paired normal snapshot'}",
      "$form.Dispose()",
      "function Get-AuraUiWindowStartupScreen { param([AllowNull()][System.Windows.Forms.Form]$AnchorForm) return [Windows.Forms.Screen]::PrimaryScreen }",
      "function Get-AuraUiWindowDisplayClass { param([AllowNull()][System.Windows.Forms.Form]$Form,[Drawing.Rectangle]$WorkingArea=[Drawing.Rectangle]::Empty,[int]$Dpi=0) return $script:SimulatedDisplayClass }",
      "function Write-AuraUiWindowLayoutState { $script:LayoutWriteCount++ }",
      "$working=[Windows.Forms.Screen]::PrimaryScreen.WorkingArea",
      "$compactRecord=[PSCustomObject]@{x=$working.Left+40;y=$working.Top+40;width=700;height=460;dpi=96}",
      "$script:WindowLayoutState=[PSCustomObject]@{schemaVersion=1;aura=[PSCustomObject]@{compact=$compactRecord;spacious=$null};studio=[PSCustomObject]@{compact=$null;spacious=$null}}",
      "$script:AuraWindowLayoutInitialized=$false; $script:AuraNormalWindowSnapshot=$null; $script:SimulatedDpi=144; $script:SimulatedDisplayClass='compact'; $script:LayoutWriteCount=0",
      "$compactForm=[Windows.Forms.Form]::new(); $compactForm.StartPosition='Manual'; $compactForm.MinimumSize=[Drawing.Size]::new(320,240)",
      "Initialize-AuraUiWindowLayoutForForm -Kind aura -Form $compactForm",
      "if($compactForm.WindowState -ne [Windows.Forms.FormWindowState]::Maximized){throw 'Compact startup did not maximize'}",
      "if($null -eq $script:AuraNormalWindowSnapshot -or $script:AuraNormalWindowSnapshot.dpi -ne 144 -or $compactForm.RestoreBounds -ne $script:AuraNormalWindowSnapshot.bounds){throw 'Compact startup did not seed paired restore bounds before maximizing'}",
      "Save-AuraUiWindowLayoutForForm -Kind aura -Form $compactForm",
      "if($script:LayoutWriteCount -ne 1 -or $script:WindowLayoutState.aura.compact.dpi -ne 144 -or $script:WindowLayoutState.aura.compact.x -ne $script:AuraNormalWindowSnapshot.bounds.X){throw 'Maximized save did not persist the paired compact snapshot'}",
      "$compactForm.Dispose()",
      "$spaciousRecord=[PSCustomObject]@{x=$working.Left+60;y=$working.Top+60;width=600;height=400;dpi=144}",
      "$script:WindowLayoutState.studio.spacious=$spaciousRecord; $script:StudioWindowLayoutInitialized=$false; $script:StudioNormalWindowSnapshot=$null; $script:SimulatedDpi=192; $script:SimulatedDisplayClass='spacious'; $script:LayoutWriteCount=0",
      "$studioForm=[Windows.Forms.Form]::new(); $studioForm.StartPosition='Manual'; $studioForm.MinimumSize=[Drawing.Size]::new(320,240)",
      "$expected=Get-AuraUiWindowBoundsWithinWorkingArea -Bounds ([Drawing.Rectangle]::new($spaciousRecord.x,$spaciousRecord.y,800,533)) -WorkingArea $working -MinimumSize $studioForm.MinimumSize -Margin 12",
      "Initialize-AuraUiWindowLayoutForForm -Kind studio -Form $studioForm",
      "if($studioForm.WindowState -ne [Windows.Forms.FormWindowState]::Normal -or $studioForm.Bounds -ne $expected){throw \"Spacious startup did not restore scaled saved bounds: $($studioForm.Bounds) expected $expected\"}",
      "Save-AuraUiWindowLayoutForForm -Kind studio -Form $studioForm",
      "if($script:LayoutWriteCount -ne 1 -or $script:WindowLayoutState.studio.spacious.dpi -ne 192 -or $script:WindowLayoutState.studio.spacious.width -ne $expected.Width){throw 'Spacious save did not persist independent paired bounds'}",
      "$studioForm.Dispose()",
    ].join("\n");
    run("powershell.exe", [
      "-NoProfile",
      "-STA",
      "-EncodedCommand",
      Buffer.from(powershell, "utf16le").toString("base64"),
    ]);
  }
});

test("Studio-generated metadata preserves every theme descriptor", async () => {
  const builderSource = await fs.readFile(path.join(PROJECT_ROOT, "scripts", "build-studio-themes.mjs"), "utf8");
  assert.match(builderSource, /RETRIABLE_WINDOWS_WRITE_CODES[\s\S]+\["EACCES", "EBUSY", "EPERM", "UNKNOWN"\]/,
    "Studio metadata generation must tolerate known transient Windows write locks");
  assert.match(builderSource, /MAX_WRITE_ATTEMPTS\s*=\s*6/,
    "Studio metadata generation must keep its Windows lock retry bounded");
  assert.match(builderSource,
    /if \(layered && artwork\.id\)[\s\S]{0,900}?id:\s*artwork\.id[\s\S]{0,400}?context:\s*artwork\.context[\s\S]{0,300}?viewport:\s*artwork\.viewport[\s\S]{0,300}?visible:\s*artwork\.visible[\s\S]{0,500}?normal:\s*\{\s*\.\.\.artwork\.frames\.normal\s*\}[\s\S]{0,200}?wide:\s*\{\s*\.\.\.artwork\.frames\.wide\s*\}/,
    "Studio metadata generation must preserve the exact identity, applicability, visibility, and frames of authored built-in layers");
  run(process.execPath, ["scripts/build-studio-themes.mjs"]);
  const generated = await fs.readFile(path.join(PROJECT_ROOT, "studio", "generated-themes.js"), "utf8");
  for (const id of THEME_IDS) assert(generated.includes(`\"${id}\"`), `Studio metadata is missing ${id}`);
  const generatedMatch = generated.match(/window\.CLAUDE_AURA_THEMES\s*=\s*([\s\S]+);\s*$/);
  assert(generatedMatch, "Studio theme metadata could not be parsed");
  const studioThemes = JSON.parse(generatedMatch[1]);
  for (const theme of await listThemes()) {
    const expectedArtwork = theme.artwork
      ? (({ path: artworkPath, position, size, mobile }) => ({ path: artworkPath, position, size, mobile }))(theme.artwork)
      : null;
    const expectedLayers = theme.artworkLayers?.length
      ? theme.artworkLayers.map((layer) => layer.id ? ({
        id: layer.id,
        path: layer.path,
        role: layer.role,
        appearance: layer.appearance,
        context: layer.context,
        viewport: layer.viewport,
        visible: layer.visible,
        opacity: layer.opacity,
        mask: layer.mask,
        mobile: layer.mobile,
        frames: {
          normal: { ...layer.frames.normal },
          wide: { ...layer.frames.wide },
        },
      }) : (({
        path: artworkPath, position, size, mobile, opacity, mask, role, appearance, contextOverrides,
      }) => ({
        path: artworkPath,
        position,
        size,
        mobile,
        opacity,
        mask,
        role,
        appearance,
        contextOverrides,
      }))(layer))
      : null;
    const expectedMode = (mode) => ({
      semantic: { ...mode.semantic },
      compat: Object.fromEntries(Object.entries(mode.tokens).filter(([name]) => !name.startsWith("--aura-"))),
      tokens: { ...mode.tokens },
      wallpaper: { ...mode.wallpaper },
    });
    assert.deepEqual(studioThemes[theme.name], {
      name: theme.name,
      source: theme.source,
      variant: theme.variant,
      label: theme.label,
      description: theme.description,
      labels: { ...theme.labels },
      descriptions: { ...theme.descriptions },
      swatches: [...theme.swatches],
      preview: { ...theme.preview },
      studioStyle: studioStyleFromTheme(theme),
      studioPreview: theme.studioPreview,
      studioPreviewFrame: theme.studioPreviewFrame ? { ...theme.studioPreviewFrame } : null,
      launcher: { ...theme.launcher },
      newChatLayout: theme.newChatLayout ? { ...theme.newChatLayout } : null,
      artwork: expectedArtwork,
      artworkLayers: expectedLayers,
      radius: theme.radius,
      blur: theme.blur,
      typography: { ...theme.typography },
      shape: { ...theme.shape },
      effects: { ...theme.effects },
      light: expectedMode(theme.light),
      dark: expectedMode(theme.dark),
    }, `${theme.name} Studio metadata differs from the validated registry theme`);
  }
  const packageJson = JSON.parse(await fs.readFile(path.join(PROJECT_ROOT, "package.json"), "utf8"));
  assert.equal(packageJson.scripts["studio:build"], "node scripts/build-studio-themes.mjs");
  assert.equal(packageJson.scripts["preview:build"], undefined);
  assert.equal(packageJson.scripts["preview:serve"], undefined);
});

test("release and installers exclude unsafe composite references and binary patching", async () => {
  const manifest = await fs.readFile(path.join(PROJECT_ROOT, "docs", "FILE_MANIFEST.md"), "utf8");
  const listedFiles = [...manifest.matchAll(/^- `([^`]+)`$/gm)].map((match) => match[1]).sort();
  assert.deepEqual(listedFiles, (await deliverableFiles()).sort(), "Deliverable file manifest is incomplete or stale");
  const releaseBuilder = await fs.readFile(path.join(PROJECT_ROOT, "scripts", "build-release.mjs"), "utf8");
  assert.match(releaseBuilder, /RELEASE_ROOT_FILES/);
  assert.match(releaseBuilder, /RELEASE_DIRECTORIES/);
  assert.match(releaseBuilder, /RELEASE_DOCUMENT_FILES/);
  assert.match(releaseBuilder, /RETIRED_RELEASE_FILES/);
  assert.match(releaseBuilder, /RETIRED_RELEASE_DIRECTORIES/);
  assert.match(releaseBuilder, /SOURCE_ONLY_RELEASE_DIRECTORIES/);
  assert.match(releaseBuilder, /REQUIRED_THEME_DESCRIPTOR_FILES/);
  assert.match(releaseBuilder, /REQUIRED_APP_SURFACE_FILES/);
  assert.match(releaseBuilder, /REQUIRED_RELEASE_FILES/);
  assert.match(releaseBuilder,
    /const REQUIRED_RELEASE_FILES = new Set\(\[[\s\S]{0,160}?\.\.\.RELEASE_ROOT_FILES,[\s\S]{0,80}?\.\.\.RELEASE_DOCUMENT_FILES,[\s\S]{0,80}?\.\.\.REQUIRED_THEME_DESCRIPTOR_FILES,[\s\S]{0,80}?\.\.\.REQUIRED_APP_SURFACE_FILES,/,
    "Release builds must reject packages missing an installer-required surface");
  assert.match(releaseBuilder, /\["studio",\s*new Set\(\["\.css",\s*"\.html",\s*"\.js"\]\)\]/,
    "The release allowlist must include Aura Studio");
  assert.match(releaseBuilder, /\.corrupt-/);
  for (const extension of [".avif", ".ico", ".png", ".svg", ".webp"]) {
    assert(releaseBuilder.includes(`"${extension}"`), `Release allowlist omits supported artwork type ${extension}`);
  }
  assert.match(releaseBuilder, /import \{ buildAuraIcon \} from "\.\/build-aura-icon\.mjs";/,
    "Release builds must use the deterministic Aura icon builder");
  assert.match(releaseBuilder, /import \{ buildLauncherAssets \} from "\.\/build-launcher-assets\.mjs";/,
    "Release builds must use the deterministic launcher-mark builder");
  assert.match(releaseBuilder, /import \{ buildBrandWordmarks \} from "\.\/build-brand-wordmarks\.mjs";/,
    "Release builds must use the deterministic built-in wordmark builder");
  const releaseIconBuildIndex = releaseBuilder.indexOf("await buildAuraIcon()");
  const releaseLauncherBuildIndex = releaseBuilder.indexOf("await buildLauncherAssets()");
  const releaseWordmarkBuildIndex = releaseBuilder.indexOf("await buildBrandWordmarks()");
  const releaseCollectIndex = releaseBuilder.indexOf("await collect(PROJECT_ROOT)");
  assert(releaseIconBuildIndex >= 0 && releaseLauncherBuildIndex > releaseIconBuildIndex
      && releaseWordmarkBuildIndex > releaseLauncherBuildIndex
      && releaseCollectIndex > releaseWordmarkBuildIndex,
  "Release builds must refresh derived identity assets before collecting files");
  const windowsInstall = await fs.readFile(path.join(PROJECT_ROOT, "windows", "install.ps1"), "utf8");
  const windowsInstallCommand = await fs.readFile(path.join(PROJECT_ROOT, "Install Claude Aura.cmd"), "utf8");
  const macInstall = await fs.readFile(path.join(PROJECT_ROOT, "macos", "install.sh"), "utf8");
  const commandPathIndex = windowsInstallCommand.indexOf('set "AURA_INSTALLER=%~dp0windows\\install.ps1"');
  const commandLocationIndex = windowsInstallCommand.indexOf('cd /d "%LOCALAPPDATA%"');
  const commandLaunchIndex = windowsInstallCommand.indexOf(
    'powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%AURA_INSTALLER%" -Launch');
  assert(commandPathIndex >= 0 && commandLocationIndex > commandPathIndex
      && commandLaunchIndex > commandLocationIndex,
  "The Windows package launcher must leave a potentially installed working directory before update");
  const macCopyList = macInstall.match(/for directory in ([^;]+); do/)?.[1] ?? "";
  assert(!/\b(?:preview|themes)\b/.test(macCopyList),
    "macOS install copy list retained an offline or source-kit directory");
  assert.match(windowsInstall, /function Get-AuraInstallSourceFiles/);
  assert.match(windowsInstall, /function New-AuraInstallStage/);
  assert.match(windowsInstall, /Get-FileHash[\s\S]{0,220}?SHA256/,
    "Windows installs must verify every staged application file");
  assert.match(windowsInstall,
    /Move-AuraManagedAppTree[\s\S]{0,180}?-Source \$installRoot -Destination \$backupRoot[\s\S]{0,500}?-Source \$stageRoot -Destination \$installRoot/,
    "Windows installs must swap a complete staged tree behind a recoverable backup");
  assert.match(windowsInstall,
    /if \(\$replacementActivated\)[\s\S]{0,500}?Restore-AuraInstalledAppTree[\s\S]{0,700}?Restore-AuraConfigInstallSnapshot[\s\S]{0,700}?Restore-AuraShortcutInstallSnapshot/,
    "Windows install rollback must restore the app, config, and every touched shortcut");
  assert.match(windowsInstall, /Assert-AuraInstallTreeHasNoReparsePoints/);
  assert.match(windowsInstall, /\.app-(?:stage|backup|rollback)-/);
  for (const themeName of ["registry.json", "japanese-idol.json", "korean-idol.json", "sakura.json"]) {
    assert(windowsInstall.includes(`'${themeName}'`) && macInstall.includes(themeName),
      `Installers do not explicitly copy top-level descriptor ${themeName}`);
  }
  for (const documentationName of [
    "ACCEPTANCE_AUDIT.md",
    "FILE_MANIFEST.md",
    "IMPLEMENTATION_REPORT.md",
    "SCREENSHOT_PLAN.md",
    "THEME_KIT_SPEC.md",
    "THEMING.md",
    "TROUBLESHOOTING.md",
    "WINDOWS_INSTALLER.md",
  ]) {
    assert(windowsInstall.includes(`'${documentationName}'`) && macInstall.includes(documentationName),
      `Installers do not explicitly copy public documentation ${documentationName}`);
  }
  assert(!windowsInstall.includes("docs\\*.md") && !macInstall.includes('docs/*.md'),
    "Installers must not copy every workspace document");
  assert(windowsInstall.includes("'recipes/RECIPES.md'"),
    "Windows exact-tree installer omits the public recipe contract");
  assert(macInstall.includes('for installed_documentation in "$INSTALL_ROOT"/docs/*'),
    "macOS installer does not prune non-public documentation");
  assert(windowsInstall.includes("assets/studio-previews/references")
      && macInstall.includes("assets/studio-previews/references"),
  "Installers must keep alternate Studio references in the source tree only");
  assert.match(windowsInstall,
    /\$themesRoot[\s\S]{0,900}?if \(\$themeEntry\.PSIsContainer\) \{ continue \}/,
    "Windows installer must enumerate top-level descriptors without entering source-kit directories");
  assert(macInstall.includes('for theme_entry in "$INSTALL_ROOT"/themes/*'),
    "macOS installer does not prune stale theme-kit directories");
  for (const obsoleteName of [
    "build-preview.mjs",
    "preview-server.mjs",
    "card-analyze.svg",
    "theme-screenshots",
  ]) {
    assert(macInstall.includes(obsoleteName), `macOS installer does not remove stale ${obsoleteName}`);
  }
  for (const [windowsPath, macPath] of [
    ["scripts\\qa-board.mjs", "scripts/qa-board.mjs"],
    ["docs\\golden", "docs/golden"],
    ["tests\\fixtures", "tests/fixtures"],
    ["dist\\qa", "dist/qa"],
  ]) {
    assert(macInstall.includes(macPath), `macOS installer does not remove stale fixture surface ${macPath}`);
    if (macPath !== "dist/qa") {
      assert(windowsInstall.includes(macPath),
        `Windows exact-tree source filter does not exclude ${macPath}`);
    }
  }
  for (const preservedName of ["live-aura", "live-content-audit", "wo17-icon", "-live-content"]) {
    assert(macInstall.includes(preservedName),
      `macOS installer fixture cleanup does not preserve live evidence marker ${preservedName}`);
  }
  for (const obsoleteName of ["background.webp", "constellation.webp"]) {
    assert(macInstall.includes(`assets/theme-art/korean-idol/${obsoleteName}`),
      `macOS installer does not remove stale Korean Idol ${obsoleteName}`);
  }
  assert(windowsInstall.includes("Test-Path -LiteralPath (Join-Path $SourceRoot '.git')")
    && windowsInstall.includes("validate --theme $themeId"),
  "Windows release installs must use shipped-content validation instead of repository-only tests");
  assert(macInstall.includes('[ -e "$ROOT/.git" ]')
    && macInstall.includes('validate --theme "$theme_id"'),
  "macOS release installs must use shipped-content validation instead of repository-only tests");
  assert.match(windowsInstall,
    /function Assert-AuraManagedAppPath[\s\S]{0,900}?Split-Path \$pathFull -Parent[\s\S]{0,400}?\.app-\(\?:stage\|backup\|rollback\)-/,
    "Windows app-tree mutation must remain within exact managed sibling paths");
  assert.match(macInstall, /"\$INSTALL_ROOT"\/\*\)/,
    "macOS stale-surface cleanup must remain below the verified install root");
  const privateName = `private-release-state-${process.pid}-${Date.now()}.json`;
  const privatePath = path.join(PROJECT_ROOT, privateName);
  try {
    await fs.writeFile(privatePath, '{"secret":"must-not-ship"}\n', "utf8");
    const release = JSON.parse(run(process.execPath, ["scripts/build-release.mjs"]));
    const releaseBytes = await fs.readFile(release.outputPath);
    const names = zipEntryNames(releaseBytes);
    const expectedChecksum = `${crypto.createHash("sha256").update(releaseBytes).digest("hex")}  ${path.basename(release.outputPath)}\n`;
    assert.equal(await fs.readFile(`${release.outputPath}.sha256`, "utf8"), expectedChecksum,
      "The public CMD ZIP must ship with a checksum of its final bytes");
    assert(!names.some((name) => /\.exe$/iu.test(name) || /UNSIGNED-DEV/iu.test(name)),
      "The public CMD ZIP must not contain a Setup executable or unsigned-development artifact");
    assert(names.includes("claude-aura/package.json"), "Release allowlist omitted package.json");
    for (const rootFile of [
      "CONTRIBUTING.md",
      "Install Claude Aura.cmd",
      "Install Claude Aura.command",
      "LICENSE",
      "NOTICE.md",
      "README.md",
      "SECURITY.md",
      "THIRD_PARTY_NOTICES.md",
      "Uninstall Claude Aura.cmd",
      "config.example.json",
      "package.json",
    ]) {
      assert(names.includes(`claude-aura/${rootFile}`), `Release omitted required root file ${rootFile}`);
    }
    for (const localizedReadme of ["README.zh-CN.md", "README.zh-HKTW.md"]) {
      assert(names.includes(`claude-aura/readmes/${localizedReadme}`),
        `Release omitted localized readme ${localizedReadme}`);
    }
    assert.deepEqual(names.filter((name) => name.startsWith("claude-aura/docs/")).sort(), [
      "claude-aura/docs/ACCEPTANCE_AUDIT.md",
      "claude-aura/docs/FILE_MANIFEST.md",
      "claude-aura/docs/IMPLEMENTATION_REPORT.md",
      "claude-aura/docs/SCREENSHOT_PLAN.md",
      "claude-aura/docs/THEME_KIT_SPEC.md",
      "claude-aura/docs/THEMING.md",
      "claude-aura/docs/TROUBLESHOOTING.md",
      "claude-aura/docs/WINDOWS_INSTALLER.md",
      "claude-aura/docs/recipes/RECIPES.md",
    ].sort(), "Release documentation differs from the public allowlist");
    for (const themeDescriptor of [
      "registry.json",
      "default.json",
      "japanese-film-editorial.json",
      "korean-prestige.json",
      "cartoon-studio.json",
      "anime-twilight.json",
      "study-library.json",
      "japanese-idol.json",
      "korean-idol.json",
      "midnight.json",
      "ember.json",
      "forest.json",
      "sakura.json",
    ]) {
      assert(names.includes(`claude-aura/themes/${themeDescriptor}`),
        `Release omitted required theme descriptor ${themeDescriptor}`);
    }
    for (const appSurface of [
      "macos/install.sh",
      "scripts/theme-cli.mjs",
      "studio/index.html",
      "tests/run-tests.mjs",
      "vendor/webview2/Microsoft.Web.WebView2.Core.dll",
      "windows/aura-draft-handoff.ps1",
      "windows/aura-ui.ps1",
      "windows/install.ps1",
      "windows/uninstall.ps1",
      "windows/verify.ps1",
    ]) {
      assert(names.includes(`claude-aura/${appSurface}`),
        `Release omitted required app surface ${appSurface}`);
    }
    for (const identityFile of [
      "assets/brand/aura-mark.svg",
      "assets/brand/claude-aura.ico",
      "scripts/build-aura-icon.mjs",
      "scripts/build-brand-wordmarks.mjs",
      "scripts/build-launcher-assets.mjs",
    ]) {
      assert(names.includes(`claude-aura/${identityFile}`), `Release omitted Aura identity file ${identityFile}`);
    }
    for (const themeId of THEME_IDS) {
      assert(names.includes(`claude-aura/assets/theme-art/${themeId}/launcher-mark.png`),
        `Release omitted ${themeId} launcher mark`);
      assert(names.includes(`claude-aura/assets/theme-art/${themeId}/launcher-mark.ico`),
        `Release omitted ${themeId} multi-frame launcher icon`);
    }
    const brandMarkThemes = new Set(["japanese-film-editorial", "korean-prestige", "japanese-idol"]);
    for (const themeId of THEME_IDS) {
      assert.equal(
        names.includes(`claude-aura/assets/theme-art/${themeId}/brand-mark.svg`),
        brandMarkThemes.has(themeId),
        `Release brand-mark set is incorrect for ${themeId}`,
      );
    }
    for (const themeId of THEME_IDS) {
      for (const appearance of ["light", "dark"]) {
        assert(
          names.includes(`claude-aura/assets/theme-art/${themeId}/brand-wordmark-${appearance}.png`),
          `Release omitted ${themeId} ${appearance} in-page wordmark`,
        );
      }
    }
    for (const themeId of THEME_IDS.filter((id) => id !== "default")) {
      assert(names.includes(`claude-aura/assets/studio-previews/masters/${themeId}.png`),
        `Release omitted ${themeId} uncropped Studio preview master`);
    }
    assert(!names.some((name) => name.startsWith("claude-aura/assets/studio-previews/references/")),
      "Release included source-only alternate preview references");
    assert(!names.some((name) => name.startsWith("claude-aura/themes/korean-idol/")),
      "Release included the Korean Idol source kit");
    assert(names.includes("claude-aura/scripts/asset-audit.mjs"),
      "Release omitted the non-image asset audit");
    for (const studioFile of ["app.js", "editor.css", "editor.js", "generated-themes.js", "index.html", "styles.css"]) {
      assert(names.includes(`claude-aura/studio/${studioFile}`), `Release omitted Studio ${studioFile}`);
    }
    assert(!names.some((name) => name.startsWith("claude-aura/preview/")),
      "Release included the removed offline preview surface");
    assert(!names.some((name) => /^claude-aura\/docs\/.*\.(?:avif|jpe?g|png|webp)$/i.test(name)),
      "Release included obsolete documentation screenshots");
    assert(!names.includes("claude-aura/scripts/qa-board.mjs"),
      "Release included the retired fixture-board generator");
    assert(!names.some((name) => name.startsWith("claude-aura/docs/golden/")
      || name.startsWith("claude-aura/docs/theme-screenshots/")
      || name.startsWith("claude-aura/tests/fixtures/")),
    "Release included a retired fixture or screenshot surface");
    for (const themeId of THEME_IDS.filter((id) => id !== "default")) {
      assert(names.includes(`claude-aura/assets/theme-art/${themeId}/card-preview.webp`),
        `Release omitted ${themeId} legacy selector fallback`);
    }
    assert(!names.includes(`claude-aura/${privateName}`), "Release included an unlisted local file");
    assert(!names.some((name) => name.split("/").slice(1).some((segment) => segment.startsWith("."))),
      "Release included hidden workspace metadata");
    assert(!names.some((name) => name.includes("theme_demo_previews")),
      "Release included an unsafe reference composite");
    assert(!names.some((name) => /^claude-aura\/themes\/[^/]+\//.test(name)),
      "Release included files from a per-theme source kit directory");
  } finally {
    await fs.rm(privatePath, { force: true });
  }
  const files = [
    ...(await fs.readdir(path.join(PROJECT_ROOT, "windows"))).map((file) => path.join(PROJECT_ROOT, "windows", file)),
    ...(await fs.readdir(path.join(PROJECT_ROOT, "macos"))).filter((file) => file.endsWith(".sh")).map((file) => path.join(PROJECT_ROOT, "macos", file)),
  ];
  for (const file of files) {
    const stat = await fs.stat(file);
    if (!stat.isFile()) continue;
    const source = await fs.readFile(file, "utf8");
    assert(!/\b(?:takeown|icacls)\b/i.test(source), `${file} contains a package-ownership command`);
    assert(!/app\.asar/i.test(source), `${file} references app.asar`);
  }
  const productionSources = [
    path.join(PROJECT_ROOT, "assets", "base.css"),
    path.join(PROJECT_ROOT, "assets", "theme-variants.css"),
    path.join(PROJECT_ROOT, "assets", "renderer-inject.js"),
    path.join(PROJECT_ROOT, "assets", "renderer-prepaint.js"),
    path.join(PROJECT_ROOT, "scripts", "theme-core.mjs"),
    ...(await fs.readdir(path.join(PROJECT_ROOT, "scripts", "theme-core")))
      .filter((file) => file.endsWith(".mjs"))
      .sort()
      .map((file) => path.join(PROJECT_ROOT, "scripts", "theme-core", file)),
    path.join(PROJECT_ROOT, "themes", "registry.json"),
  ];
  for (const file of productionSources) {
    const source = await fs.readFile(file, "utf8");
    assert(!/theme_demo_previews|Claude app interface with K-pop|Elegant Japanese-inspired/i.test(source));
  }
  const installer = await fs.readFile(path.join(PROJECT_ROOT, "windows", "install.ps1"), "utf8");
  const uninstaller = await fs.readFile(path.join(PROJECT_ROOT, "windows", "uninstall.ps1"), "utf8");
  assert.match(installer, /Uninstall Claude Aura\.lnk/);
  assert.match(installer, /Uninstall Claude Aura\.cmd/);
  assert.match(uninstaller, /Assert-AuraOwnedPath -Path \$installRoot/);
  assert.match(uninstaller, /Assert-AuraOwnedPath -Path \$dataRoot/);
  assert.match(uninstaller, /Assert-AuraOwnedPath -Path \$webViewRoot/);
  assert.match(uninstaller, /SupportsShouldProcess\s*=\s*\$true/);
  assert.match(uninstaller, /\$PSCmdlet\.ShouldProcess/);
  assert.match(uninstaller, /if \(\$RemoveData -and \(Test-Path -LiteralPath \$dataRoot\)\)/);
  assert.match(uninstaller, /if \(\$RemoveData -and \(Test-Path -LiteralPath \$webViewRoot\)\)/);
  assert(!/AnthropicClaude|Programs\\Claude|app\.asar/i.test(uninstaller), "Uninstaller must not target Anthropic's installation");
});

runIfMain(import.meta.url);
