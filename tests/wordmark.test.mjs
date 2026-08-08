// Device-level personal wordmark tests: trusted storage resolution, compact
// renderer precedence, crop parity, deterministic baking, and host bridge shape.
import { test, runIfMain } from "./support/harness.mjs";
import {
  assert, fs, path, PROJECT_ROOT, DEFAULT_CONFIG,
  compileTheme, buildPayload, buildPayloadFromCompiled, writeConfig, readPayloadSettings, run,
  executeStudioRequest, hydrateStudioDraft,
} from "./support/context.mjs";
import { payloadBudget } from "../scripts/theme-core/validation.mjs";

await import("../studio/crop-math.js");

const WORDMARK_SOURCE = path.join(
  PROJECT_ROOT,
  "assets",
  "theme-art",
  "default",
  "brand-wordmark-light.png",
);
const PNG_1x1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

async function makePersonalWordmarkRoot(temporary, generation = "a".repeat(64)) {
  const root = path.join(temporary, "personal-wordmark");
  const generationDirectory = path.join(root, "generations", generation);
  const wordmarkPath = path.join(generationDirectory, "wordmark.png");
  await fs.mkdir(generationDirectory, { recursive: true });
  await fs.copyFile(WORDMARK_SOURCE, wordmarkPath);
  return { root, generationDirectory, wordmarkPath };
}

test("personal wordmark resolves only from the host generation root and overrides built-in assets", async () => {
  const temporary = await fs.mkdtemp(path.join(PROJECT_ROOT, "tests", ".tmp-wordmark-"));
  try {
    const configPath = path.join(temporary, "config.json");
    const { root, wordmarkPath } = await makePersonalWordmarkRoot(temporary);
    await writeConfig(configPath, {
      ...DEFAULT_CONFIG,
      theme: "korean-idol",
      personalWordmark: wordmarkPath,
    });

    const compiled = await compileTheme({ configPath });
    assert.equal(compiled.personalWordmark?.path, wordmarkPath);
    assert.match(compiled.settings.personalWordmark?.dataUrl ?? "", /^data:image\/png;base64,/);
    assert.equal(compiled.settings.brandWordmark, null,
      "The personal device preference must outrank a built-in theme wordmark");
    const bundle = await buildPayloadFromCompiled(compiled);
    const runtime = readPayloadSettings(bundle.payload);
    assert.deepEqual(runtime.personalWordmark, [
      compiled.settings.personalWordmark.dataUrl,
      136,
      160,
    ], "The compact W channel must carry one wide personal image and its safe widths");
    assert.equal(runtime.b, undefined,
      "A personal wordmark payload must not duplicate built-in appearance assets");
    assert(bundle.payload.includes("data-claude-aura-brand-image"),
      "The existing conservative brand overlay must remain present");
    const compactRuntime = { ...runtime, W: runtime.personalWordmark };
    delete compactRuntime.personalWordmark;
    const withoutPersonalAccounting = { ...compactRuntime };
    delete withoutPersonalAccounting.W;
    assert.equal(
      bundle.payloadBudget.embeddedArtworkBytes,
      payloadBudget(bundle.payload, withoutPersonalAccounting).embeddedArtworkBytes,
      "A device-owned personal image must not count against portable theme artwork",
    );
    assert(bundle.payloadBudget.chromeBytes
      < payloadBudget(bundle.payload, withoutPersonalAccounting).chromeBytes,
    "The personal data URL must be excluded from renderer chrome bytes");

    await writeConfig(configPath, {
      ...DEFAULT_CONFIG,
      enabled: false,
      personalWordmark: wordmarkPath,
    });
    const originalLook = await buildPayload({ configPath });
    assert.equal(readPayloadSettings(originalLook.payload).personalWordmark, undefined,
      "Original look must not activate the personal wordmark");
    assert(originalLook.settings.brandWordmark,
      "Compiling while Original look is selected must retain the normal theme fallback");

    const invalidCases = [
      path.join(temporary, "outside.png"),
      path.join(root, "missing.png"),
      "personal-wordmark/generations/a/wordmark.png",
    ];
    await fs.copyFile(WORDMARK_SOURCE, invalidCases[0]);
    for (const personalWordmark of invalidCases) {
      await writeConfig(configPath, { ...DEFAULT_CONFIG, personalWordmark });
      const invalid = await compileTheme({ configPath });
      assert.equal(invalid.personalWordmark, null);
      assert.equal(invalid.settings.personalWordmarkUnavailable, true);
      assert(invalid.settings.brandWordmark,
        "An untrusted or unavailable personal path must fail open to the theme wordmark");
    }

    const wrongSize = path.join(root, "generations", "b".repeat(64), "wordmark.png");
    await fs.mkdir(path.dirname(wrongSize), { recursive: true });
    await fs.writeFile(wrongSize, PNG_1x1);
    await writeConfig(configPath, { ...DEFAULT_CONFIG, personalWordmark: wrongSize });
    assert.equal((await compileTheme({ configPath })).personalWordmark, null,
      "The compiler must reject a host artifact with the wrong dimensions");

    const oversized = path.join(root, "generations", "c".repeat(64), "wordmark.png");
    await fs.mkdir(path.dirname(oversized), { recursive: true });
    await fs.writeFile(oversized, Buffer.concat([
      await fs.readFile(WORDMARK_SOURCE),
      Buffer.alloc(256 * 1024),
    ]));
    await writeConfig(configPath, { ...DEFAULT_CONFIG, personalWordmark: oversized });
    assert.equal((await compileTheme({ configPath })).personalWordmark, null,
      "The compiler must reject an oversized baked artifact");

    const linked = path.join(root, "generations", "d".repeat(64), "wordmark.png");
    await fs.mkdir(path.dirname(linked), { recursive: true });
    try {
      await fs.symlink(WORDMARK_SOURCE, linked, "file");
      await writeConfig(configPath, { ...DEFAULT_CONFIG, personalWordmark: linked });
      assert.equal((await compileTheme({ configPath })).personalWordmark, null,
        "The compiler must reject linked files even when their target is a valid PNG");
    } catch (error) {
      if (!["EPERM", "EACCES", "ENOTSUP"].includes(error?.code)) throw error;
    }
  } finally {
    await fs.rm(temporary, { recursive: true, force: true });
  }
});

test("an active editor draft recompiles against the device wordmark without serializing it", async () => {
  const temporary = await fs.mkdtemp(path.join(PROJECT_ROOT, "tests", ".tmp-wordmark-editor-"));
  try {
    const configPath = path.join(temporary, "config.json");
    const userThemesDir = path.join(temporary, "themes");
    const editorRoot = path.join(temporary, "editor");
    await fs.mkdir(userThemesDir, { recursive: true });
    await writeConfig(configPath, { ...structuredClone(DEFAULT_CONFIG) });
    const opened = await executeStudioRequest({
      request: { type: "create-theme-copy", theme: "default" },
      configPath,
      userThemesDir,
      editorRoot,
      locale: "en",
    });
    assert.equal(opened.state.active, true);
    const { wordmarkPath } = await makePersonalWordmarkRoot(temporary);
    const config = JSON.parse(await fs.readFile(configPath, "utf8"));
    await writeConfig(configPath, { ...config, personalWordmark: wordmarkPath });

    const hydrated = await hydrateStudioDraft({
      configPath,
      userThemesDir,
      editorRoot,
      locale: "en",
    });
    assert.equal(hydrated.state.session, opened.state.session);
    assert.equal(hydrated.state.revision, opened.state.revision,
      "A device preference refresh must not create a theme edit or Undo entry");
    assert.match(readPayloadSettings(hydrated.payload).personalWordmark?.[0] ?? "",
      /^data:image\/png;base64,/,
      "The last-valid theme draft must be recompiled with the personal wordmark");
    const serializedDraft = await fs.readFile(path.join(editorRoot, "active", "theme.json"), "utf8");
    assert(!serializedDraft.includes("personalWordmark") && !serializedDraft.includes(wordmarkPath),
      "The device wordmark leaked into the portable theme draft");
  } finally {
    await fs.rm(temporary, { recursive: true, force: true });
  }
});

test("wide crop math matches the Windows bake contract and produces deterministic alpha PNGs", async () => {
  const api = globalThis.CLAUDE_AURA_CROP_MATH;
  assert(api?.coverLayout && api?.contractVectors?.length >= 6,
    "Studio must expose shared crop math and the agreed edge-case vectors");
  for (const vector of api.contractVectors) {
    assert.deepEqual(api.coverLayout(vector.input).source, vector.expected,
      `${vector.name} drifted from the crop contract`);
  }
  if (process.platform !== "win32") return;

  const temporary = await fs.mkdtemp(path.join(PROJECT_ROOT, "tests", ".tmp-wordmark-crop-"));
  try {
    const vectorsPath = path.join(temporary, "vectors.json");
    const outputA = path.join(temporary, "a.png");
    const outputB = path.join(temporary, "b.png");
    await fs.writeFile(vectorsPath, JSON.stringify(api.contractVectors.map(({ input }) => input)));
    const quote = (value) => `'${String(value).replaceAll("'", "''")}'`;
    const cropScript = path.join(PROJECT_ROOT, "windows", "image-crop.ps1");
    const parityCommand = [
      "$ErrorActionPreference='Stop'",
      `. ${quote(cropScript)}`,
      `$items=Get-Content -LiteralPath ${quote(vectorsPath)} -Raw -Encoding UTF8 | ConvertFrom-Json`,
      "$results=@()",
      "foreach($item in $items){$results += [pscustomobject](Get-AuraUiCoverCropRectangle -SourceWidth $item.sourceWidth -SourceHeight $item.sourceHeight -OutputWidth $item.outputWidth -OutputHeight $item.outputHeight -X $item.x -Y $item.y -Zoom $item.zoom)}",
      "$results | ConvertTo-Json -Compress",
    ].join("; ");
    const hostResults = JSON.parse(run("powershell.exe", [
      "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", parityCommand,
    ]));
    assert.deepEqual(hostResults, api.contractVectors.map(({ expected }) => expected),
      "Studio preview math and the Windows crop rectangle must stay identical");

    const bakeCommand = [
      "$ErrorActionPreference='Stop'",
      `. ${quote(cropScript)}`,
      `Invoke-AuraUiBakeWidePng -SourcePath ${quote(WORDMARK_SOURCE)} -OutputPath ${quote(outputA)} -X 13 -Y 87 -Zoom 1.37 | Out-Null`,
      `Invoke-AuraUiBakeWidePng -SourcePath ${quote(WORDMARK_SOURCE)} -OutputPath ${quote(outputB)} -X 13 -Y 87 -Zoom 1.37 | Out-Null`,
    ].join("; ");
    run("powershell.exe", [
      "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", bakeCommand,
    ]);
    const [bakedA, bakedB] = await Promise.all([fs.readFile(outputA), fs.readFile(outputB)]);
    assert.deepEqual(bakedA, bakedB, "Identical source and framing must bake byte-identically");
    assert.equal(bakedA.readUInt32BE(16), 344);
    assert.equal(bakedA.readUInt32BE(20), 124);
    assert.equal(bakedA[24], 8);
    assert([4, 6].includes(bakedA[25]), "The baked PNG must preserve an alpha channel");
    assert(bakedA.length < 256 * 1024, "The baked runtime image must remain below its hard cap");
  } finally {
    await fs.rm(temporary, { recursive: true, force: true });
  }
});

test("Windows wordmark publication rolls back a failed replacement and removes only after fallback", async () => {
  if (process.platform !== "win32") return;
  const temporary = await fs.mkdtemp(path.join(PROJECT_ROOT, "tests", ".tmp-wordmark-host-"));
  try {
    const quote = (value) => `'${String(value).replaceAll("'", "''")}'`;
    const cropScript = path.join(PROJECT_ROOT, "windows", "image-crop.ps1");
    const mechanismScript = path.join(PROJECT_ROOT, "windows", "personal-wordmark.ps1");
    const themeCli = path.join(PROJECT_ROOT, "scripts", "theme-cli.mjs");
    const exampleConfig = path.join(PROJECT_ROOT, "config.example.json");
    const command = [
      "$ErrorActionPreference='Stop'",
      "Add-Type -AssemblyName System.Windows.Forms",
      `$ThemeCli=${quote(themeCli)}`,
      `$ConfigPath=${quote(path.join(temporary, "config.json"))}`,
      `$UserThemesRoot=${quote(path.join(temporary, "user-themes"))}`,
      "$Node=(Get-Command node.exe -ErrorAction Stop).Source",
      "[IO.Directory]::CreateDirectory($UserThemesRoot)|Out-Null",
      `[IO.File]::Copy(${quote(exampleConfig)},$ConfigPath,$false)`,
      `$PersonalWordmarkRoot=${quote(path.join(temporary, "personal-wordmark"))}`,
      "$PersonalWordmarkStagingRoot=Join-Path $PersonalWordmarkRoot 'staging'",
      "$PersonalWordmarkGenerationsRoot=Join-Path $PersonalWordmarkRoot 'generations'",
      "$PersonalWordmarkSourceMaxBytes=2*1024*1024",
      "$PersonalWordmarkOutputMaxBytes=256*1024",
      `. ${quote(cropScript)}`,
      `. ${quote(mechanismScript)}`,
      "function Get-AuraUiPropertyValue { param($InputObject,[string[]]$Names);foreach($name in $Names){$property=$InputObject.PSObject.Properties[$name];if($null -ne $property){return $property.Value}};return $null }",
      "function ConvertTo-AuraUiStudioNumber { param($Value,[double]$Minimum,[double]$Maximum,[string]$Label);$number=[Convert]::ToDouble($Value,[Globalization.CultureInfo]::InvariantCulture);if([double]::IsNaN($number)-or[double]::IsInfinity($number)-or$number-lt$Minimum-or$number-gt$Maximum){throw \"$Label invalid\"};return $number }",
      "function Get-AuraUiEnabled { return [bool]$script:Config.enabled }",
      "function Set-AuraUiConfig { param([string[]]$Options);[void]$script:Events.Add(('set '+($Options-join ' ')));if($script:FailSet){throw 'simulated config failure'};$arguments=@($ThemeCli,'set','--config',$ConfigPath,'--user-themes',$UserThemesRoot)+$Options+@('--payload');$script:Payload=((& $Node @arguments)|Out-String).Trim();if($LASTEXITCODE-ne0-or-not$script:Payload){throw 'real theme CLI config update failed'};$script:Config=Get-Content -LiteralPath $ConfigPath -Raw -Encoding UTF8|ConvertFrom-Json }",
      "function Apply-AuraUiTheme { [void]$script:Events.Add('apply') }",
      "function Send-AuraUiStudioState { param([string]$Status,[string]$Tone,[string]$Action,[bool]$ActionSucceeded=$true,[string]$RequestId);[void]$script:Events.Add(\"state $Action $ActionSucceeded\") }",
      "function Write-AuraUiLog { param([string]$Message) }",
      "function Show-AuraUiMessage { param([string]$Title,[string]$Icon,[string]$Message) }",
      "$script:Events=[Collections.Generic.List[string]]::new()",
      "$script:Config=Get-Content -LiteralPath $ConfigPath -Raw -Encoding UTF8|ConvertFrom-Json",
      "$script:PersonalWordmarkRevision=[long]0",
      "$script:PersonalWordmarkSession='12345678-1234-4abc-8def-1234567890ab'",
      "$script:PersonalWordmarkDraft=$null",
      "$script:UiCopy=[pscustomobject]@{wordmarkPositionSaved='saved';removingWordmark='removed'}",
      "Initialize-AuraUiPersonalWordmarkStorage",
      "$firstDraft=Join-Path $PersonalWordmarkStagingRoot ('1'*32)",
      "[IO.Directory]::CreateDirectory($firstDraft)|Out-Null",
      `$firstSource=Join-Path $firstDraft 'source.png';[IO.File]::Copy(${quote(WORDMARK_SOURCE)},$firstSource)`,
      "$script:PersonalWordmarkDraft=[pscustomobject]@{Directory=$firstDraft;SourceName='source.png';SourcePath=$firstSource;Hash=(Get-AuraUiSha256 -Path $firstSource);Crop=[ordered]@{x=50;y=50;zoom=1}}",
      "$expectedPreview='https://aura.wordmark/staging/'+('1'*32)+'/source.png?v='+$script:PersonalWordmarkDraft.Hash",
      "$actualPreview=Get-AuraUiPersonalWordmarkPreviewUrl",
      "if($actualPreview-cne$expectedPreview){throw \"personal wordmark preview URL was malformed: $actualPreview\"}",
      "Invoke-AuraUiSetPersonalWordmarkFraming -X 50 -Y 50 -Zoom 1 -RequestId 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'",
      "$firstPath=[string]$script:Config.personalWordmark",
      "if(-not(Test-AuraUiPersonalWordmarkRuntimePath -Path $firstPath)-or$null-ne$script:PersonalWordmarkDraft-or$script:PersonalWordmarkRevision-ne1){throw 'first publication was not authoritative'}",
      "if($script:Payload-cnotmatch '\"W\":\\[\"data:image/png;base64,'){throw 'real compiled payload omitted the personal wordmark channel'}",
      "$secondDraft=Join-Path $PersonalWordmarkStagingRoot ('2'*32)",
      "[IO.Directory]::CreateDirectory($secondDraft)|Out-Null",
      `$secondSource=Join-Path $secondDraft 'source.png';[IO.File]::Copy(${quote(WORDMARK_SOURCE)},$secondSource)`,
      "$script:PersonalWordmarkDraft=[pscustomobject]@{Directory=$secondDraft;SourceName='source.png';SourcePath=$secondSource;Hash=(Get-AuraUiSha256 -Path $secondSource);Crop=[ordered]@{x=20;y=80;zoom=1.2}}",
      "$script:FailSet=$true;$failed=$false",
      "try{Invoke-AuraUiSetPersonalWordmarkFraming -X 20 -Y 80 -Zoom 1.2 -RequestId 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'}catch{$failed=$true}",
      "if(-not$failed-or$script:Config.personalWordmark-cne$firstPath-or$null-eq$script:PersonalWordmarkDraft-or$script:PersonalWordmarkRevision-ne1){throw 'failed replacement did not retain the prior config and editable draft'}",
      "if(@(Get-ChildItem -LiteralPath $PersonalWordmarkGenerationsRoot -Directory).Count-ne1){throw 'failed replacement left a published generation behind'}",
      "$script:FailSet=$false;$beforeClear=$script:Events.Count",
      "Invoke-AuraUiClearPersonalWordmark -RequestId 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'",
      "if($null-ne$script:Config.personalWordmark-or@(Get-ChildItem -LiteralPath $PersonalWordmarkGenerationsRoot -Directory).Count-ne0){throw 'clear did not restore fallback before cleanup'}",
      "$clearEvents=@($script:Events[$beforeClear..($script:Events.Count-1)])",
      "if($clearEvents[0]-cnotlike 'set --clear-personal-wordmark*'-or$clearEvents[1]-cne'apply'){throw 'clear removed files before applying fallback'}",
      "'real CLI host transaction OK'",
    ].join("; ");
    assert.match(run("powershell.exe", [
      "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", command,
    ]), /real CLI host transaction OK/);
  } finally {
    await fs.rm(temporary, { recursive: true, force: true });
  }
});

test("Studio and the Windows host keep personal wordmark mutations exact and transactional", async () => {
  const [studio, html, editor, editorCss, host, mechanism, crop] = await Promise.all([
    fs.readFile(path.join(PROJECT_ROOT, "studio", "app.js"), "utf8"),
    fs.readFile(path.join(PROJECT_ROOT, "studio", "index.html"), "utf8"),
    fs.readFile(path.join(PROJECT_ROOT, "studio", "editor.js"), "utf8"),
    fs.readFile(path.join(PROJECT_ROOT, "studio", "editor.css"), "utf8"),
    fs.readFile(path.join(PROJECT_ROOT, "windows", "aura-ui.ps1"), "utf8"),
    fs.readFile(path.join(PROJECT_ROOT, "windows", "personal-wordmark.ps1"), "utf8"),
    fs.readFile(path.join(PROJECT_ROOT, "windows", "image-crop.ps1"), "utf8"),
  ]);
  for (const action of [
    "set-personal-wordmark",
    "clear-personal-wordmark",
    "set-personal-wordmark-framing",
  ]) {
    assert(studio.includes(`"${action}"`), `Studio omitted ${action}`);
    assert(host.includes(`'${action}'`), `The Windows host omitted ${action}`);
  }
  assert.match(host, /'set-personal-wordmark'\s*\{\s*'type';\s*'requestId';\s*'session';\s*'revision';\s*'operation'/);
  assert.match(host, /'clear-personal-wordmark'\s*\{\s*'type';\s*'requestId';\s*'session';\s*'revision'/);
  assert.match(host, /'set-personal-wordmark-framing'\s*\{[\s\S]{0,180}?'x';\s*'y';\s*'zoom'/);
  assert.match(studio, /const newPersonalWordmarkMessage = \(type, fields = \{\}\) => \{[\s\S]{0,100}?const requestId = newPromptShelfRequestId\(\)/,
    "Every personal wordmark mutation must receive a fresh UUID");
  assert.match(studio, /return \{\s*type,\s*requestId,\s*session:\s*state\.personalWordmarkSession,\s*revision:\s*state\.personalWordmarkRevision/,
    "Every mutation must carry a fresh UUID plus the authoritative host session and revision");
  assert.match(studio, /if \(pendingCropSave[\s\S]{0,120}?data\.action === pendingCropSave\.action[\s\S]{0,160}?data\.requestId === pendingCropSave\.requestId/,
    "The crop dialog must wait for the matching authoritative save response");
  assert.match(studio, /pending\.timer = window\.setTimeout\(\(\) => \{[\s\S]{0,220}?clearPendingCropSave\(\)[\s\S]{0,120}?setCropError\(t\("saveFailed"\)\)/,
    "A lost framing response must unlock the dialog and keep the draft recoverable");
  const wordmarkActionBlock = studio.slice(
    studio.indexOf("const sendPersonalWordmarkAction"),
    studio.indexOf("const promptShelfTextIsValid"),
  );
  assert(wordmarkActionBlock.indexOf("pendingWordmarkAction = pending")
      < wordmarkActionBlock.indexOf("if (!send(message))"),
  "Studio must register the correlated wordmark action before crossing the host boundary");
  const cropSaveBlock = studio.slice(
    studio.indexOf('cropSave.addEventListener("click"'),
    studio.indexOf('cropDialog.addEventListener("close"'),
  );
  assert(cropSaveBlock.indexOf("pendingCropSave = pending")
      < cropSaveBlock.indexOf("if (!send(message))"),
  "Studio must register the crop save before a fast authoritative host response can arrive");
  assert.match(studio,
    /cropImage\.src = imageUrl;\s*if \(cropImage\.complete && cropImage\.naturalWidth\) finishCropImageLoad\(\)/,
    "A cached wordmark preview must unlock Save without waiting for a second load event");
  assert.match(mechanism, /\[IO\.Directory\]::Move\(\$transactionDirectory,\s*\$publishedDirectory\)/,
    "A baked generation must publish atomically before config changes");
  assert.match(mechanism, /Restore-AuraUiPersonalWordmarkConfig -PreviousValue \$previousValue[\s\S]{0,800}?configuration could not be committed/,
    "A failed config or compile step must restore the previous preference");
  assert.match(mechanism, /Set-AuraUiConfig[\s\S]{0,180}?'--clear-personal-wordmark'[\s\S]{0,260}?Apply-AuraUiTheme[\s\S]{0,500}?Get-ChildItem/,
    "Remove must apply the normal fallback before deleting retained generations");
  assert.match(mechanism, /PersonalWordmarkSourceMaxBytes[\s\S]{0,260}?Test-AuraUiPersonalWordmarkSourceSignature/);
  assert.match(crop, /Format32bppArgb[\s\S]{0,1400}?CompositingMode\]::SourceCopy/,
    "The baker must preserve transparent pixels instead of flattening them");
  assert.equal((html.match(/data-personal-wordmark-panel/g) ?? []).length, 2,
    "The ordinary page and Interface target must share the same personal-wordmark control contract");
  assert.match(html, /data-i18n="avatarHelp"[\s\S]{0,800}?id="personal-wordmark-current"/,
    "The wordmark editor must appear immediately below the account avatar");
  assert.match(html,
    /data-editor-branch="interface" data-editor-targets="interface\.sidebar-wordmark" data-personal-wordmark-panel/,
    "The theme editor Interface dropdown must expose a complete Sidebar wordmark page");
  assert.match(editor,
    /id:\s*"interface\.sidebar-wordmark"[\s\S]{0,180}?captureGeometry:\s*"local-preview"[\s\S]{0,100}?selectionBehavior:\s*"picker"/,
    "The device-level page must use a local preview without claiming live-canvas selection");
  assert(editorCss.includes(
    'data-inspector-target="interface.sidebar-wordmark"] [data-editor-targets~="interface.sidebar-wordmark"]',
  ), "The Interface target must reveal only its own complete page");
  const setConfigBlock = host.slice(
    host.indexOf("function Set-AuraUiConfig"),
    host.indexOf("function Test-AuraUiClaudeUri"),
  );
  assert.match(setConfigBlock,
    /\$editorActive[\s\S]{0,900}?Get-AuraUiStudioEditorCoreState[\s\S]{0,500}?Set-AuraUiPayloadState -Payload \$payload/,
    "A device setting changed during theme editing must rebuild, then apply, the active draft payload");
  assert.doesNotMatch(setConfigBlock, /\$editorPayload[\s\S]{0,300}?\$script:Payload/,
    "The active editor must not retain a stale payload that omits the new personal wordmark");
  assert.match(html, /id="wordmark-surface-light-image"[\s\S]{0,500}?id="wordmark-surface-dark-image"/,
    "Framing must provide faithful light and dark sidebar previews");
  assert.doesNotMatch(mechanism, /Write-AuraUiLog[^\r\n]*\$chosen/,
    "Host logs must not disclose the selected source path");
});

runIfMain(import.meta.url);
