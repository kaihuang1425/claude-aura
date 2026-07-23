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

test("JavaScript and platform scripts parse", async () => {
  const themeCoreModules = (await fs.readdir(path.join(PROJECT_ROOT, "scripts", "theme-core")))
    .filter((file) => file.endsWith(".mjs"))
    .sort()
    .map((file) => `scripts/theme-core/${file}`);
  const jsFiles = [
    "assets/renderer-inject.js",
    "studio/app.js",
    "studio/editor.js",
    "scripts/build-aura-icon.mjs",
    "scripts/build-launcher-assets.mjs",
    "scripts/build-studio-themes.mjs",
    "scripts/build-release.mjs",
    "scripts/injector.mjs",
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
  const bash = process.platform === "win32" ? spawnSync("where.exe", ["bash.exe"], { encoding: "utf8" }) : null;
  const bashPath = process.platform === "win32" ? bash?.stdout?.split(/\r?\n/).find(Boolean) : "/bin/bash";
  if (bashPath) {
    const shellFiles = (await fs.readdir(path.join(PROJECT_ROOT, "macos"))).filter((file) => file.endsWith(".sh"));
    run(bashPath.trim(), ["-n", ...shellFiles.map((file) => path.join(PROJECT_ROOT, "macos", file))]);
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
      "} finally { $form.Dispose() }",
    ].join("\n");
    run("powershell.exe", ["-NoProfile", "-STA", "-EncodedCommand", Buffer.from(powershell, "utf16le").toString("base64")]);
  }
});

test("Studio-generated metadata preserves every theme descriptor", async () => {
  const builderSource = await fs.readFile(path.join(PROJECT_ROOT, "scripts", "build-studio-themes.mjs"), "utf8");
  assert.match(builderSource, /RETRIABLE_WINDOWS_WRITE_CODES[\s\S]+\["EACCES", "EBUSY", "EPERM", "UNKNOWN"\]/,
    "Studio metadata generation must tolerate known transient Windows write locks");
  assert.match(builderSource, /MAX_WRITE_ATTEMPTS\s*=\s*6/,
    "Studio metadata generation must keep its Windows lock retry bounded");
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
      ? theme.artworkLayers.map(({ path: artworkPath, position, size, mobile, opacity, mask, role, appearance, contextOverrides }) => ({
        path: artworkPath,
        position,
        size,
        mobile,
        opacity,
        mask,
        role,
        appearance,
        contextOverrides,
      }))
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
    const names = zipEntryNames(await fs.readFile(release.outputPath));
    assert(names.includes("claude-aura/package.json"), "Release allowlist omitted package.json");
    for (const rootFile of [
      "CONTRIBUTING.md",
      "Install Claude Aura.cmd",
      "Install Claude Aura.command",
      "LICENSE",
      "NOTICE.md",
      "README.md",
      "README.zh-CN.md",
      "README.zh-TW.md",
      "SECURITY.md",
      "THIRD_PARTY_NOTICES.md",
      "Uninstall Claude Aura.cmd",
      "config.example.json",
      "package.json",
    ]) {
      assert(names.includes(`claude-aura/${rootFile}`), `Release omitted required root file ${rootFile}`);
    }
    assert.deepEqual(names.filter((name) => name.startsWith("claude-aura/docs/")).sort(), [
      "claude-aura/docs/ACCEPTANCE_AUDIT.md",
      "claude-aura/docs/FILE_MANIFEST.md",
      "claude-aura/docs/IMPLEMENTATION_REPORT.md",
      "claude-aura/docs/SCREENSHOT_PLAN.md",
      "claude-aura/docs/THEME_KIT_SPEC.md",
      "claude-aura/docs/THEMING.md",
      "claude-aura/docs/TROUBLESHOOTING.md",
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
      "windows/aura-ui.ps1",
      "windows/install.ps1",
      "windows/uninstall.ps1",
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
