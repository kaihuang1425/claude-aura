import { test, runIfMain } from "./support/harness.mjs";
import {
  PROJECT_ROOT,
  assert,
  fs,
  os,
  path,
  spawnSync,
} from "./support/context.mjs";
import { buildInstallerAssets } from "../scripts/build-installer-assets.mjs";

const installerScriptPath = path.join(PROJECT_ROOT, "installer", "ClaudeAura.iss");
const installerQuickBuildPath = path.join(PROJECT_ROOT, "installer", "Build Installer.cmd");
const installerQuickWorkflowPath = path.join(PROJECT_ROOT, "installer", "build-update.mjs");
const installerBuildPath = path.join(PROJECT_ROOT, "scripts", "build-installer.mjs");
const installerAuditPath = path.join(PROJECT_ROOT, "scripts", "audit-installer.mjs");
const installerAssetBuildPath = path.join(PROJECT_ROOT, "scripts", "build-installer-assets.mjs");
const installBackendPath = path.join(PROJECT_ROOT, "windows", "install.ps1");
const uninstallBackendPath = path.join(PROJECT_ROOT, "windows", "uninstall.ps1");
const appTransactionPath = path.join(PROJECT_ROOT, "installer", "app-transaction.ps1");
const localeDirectory = path.join(PROJECT_ROOT, "installer", "locales");
const artworkDirectory = path.join(PROJECT_ROOT, "installer", "assets");

const parseMessages = (source) => {
  const messages = {};
  for (const line of source.replace(/^\uFEFF/u, "").split(/\r?\n/)
    .filter((candidate) => candidate && !candidate.startsWith("["))) {
    const equals = line.indexOf("=");
    assert(equals > 0, `Invalid installer locale line: ${line}`);
    const key = line.slice(0, equals);
    assert(!Object.hasOwn(messages, key), `Duplicate installer locale key: ${key}`);
    messages[key] = line.slice(equals + 1);
  }
  return messages;
};

const placeholders = (value) => [...value.matchAll(/%\d+/gu)]
  .map((match) => match[0]).sort();

const pngDimensions = (bytes) => {
  assert.deepEqual([...bytes.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10],
    "Installer artwork is not a PNG");
  assert.equal(bytes.subarray(12, 16).toString("ascii"), "IHDR");
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
};

test("Windows Setup uses a native, per-user, offline trust boundary", async () => {
  const [script, transaction] = await Promise.all([
    fs.readFile(installerScriptPath, "utf8"),
    fs.readFile(appTransactionPath, "utf8"),
  ]);

  assert.match(script, /#define AppGuid "49DD4496-1ABF-5202-B127-3D7E919318C5"/);
  assert.match(script, /^AppId=\{\{\{#AppGuid\}\}$/m,
    "The stable Installed apps identity changed");
  assert.match(script, /^PrivilegesRequired=lowest$/m);
  assert.match(script, /^ArchitecturesInstallIn64BitMode=win64$/m,
    "64-bit Windows must launch native PowerShell and WebView2");
  assert.doesNotMatch(script, /^PrivilegesRequiredOverridesAllowed=/m,
    "Setup must not permit an all-users privilege override");
  assert.match(script, /#define ProductRoot "\{localappdata\}\\ClaudeAura"/);
  assert.match(script, /^DefaultDirName=\{#ProductRoot\}$/m);
  assert.match(script, /^MinVersion=10\.0$/m);
  assert.match(script, /^WizardStyle=modern dynamic windows11 hidebevels$/m);
  assert.match(script, /^SetupLogging=yes$/m);
  assert.match(script, /^UninstallLogging=yes$/m);
  assert.match(script, /^AllowUNCPath=no$/m);
  assert.match(script, /^AllowNetworkDrive=no$/m);
  assert.match(script, /^CloseApplications=no$/m);
  assert.match(script, /^RestartApplications=no$/m);
  assert.match(script, /^RestartIfNeededByRun=no$/m);
  assert.match(script, /^AppPublisher=I-Kai Huang$/m);
  assert.match(script, /^AppPublisherURL=https:\/\/github\.com\/erichuang1425\/claude-aura$/m);
  assert.doesNotMatch(script, /^AppPublisher=.*Anthropic/im);
  assert.match(script,
    /#ifdef UnsignedPublicBuild\s+VersionInfoDescription=Claude Aura Installer \(Unsigned\)/,
    "The public unsigned executable must identify itself in Windows file metadata");
  assert.match(script,
    /#ifdef UnsignedPublicBuild[\s\S]{0,180}?UnsignedTrustPageTitle[\s\S]{0,100}?UnsignedTrustPageSubtitle[\s\S]{0,80}?#else/,
    "The public unsigned wizard must open with an explicit localized trust warning");

  assert.match(script,
    /Source: "\{#SourceRoot\}\\\*"; DestDir: "\{tmp\}\\claude-aura"; Flags: ignoreversion recursesubdirs createallsubdirs/,
    "Setup must use only the locally staged, release-built payload");
  assert.match(script,
    /Source: "install-trigger\.txt"[\s\S]*AfterInstall: PrepareAuraAppTransaction/);
  assert.match(script,
    /procedure CurStepChanged\(CurStep: TSetupStep\)[\s\S]*ssPostInstall[\s\S]*RunSetupTransaction\('commit'/,
    "The app swap must not commit before native setup surfaces are finalized");
  assert.match(script, /procedure DeinitializeSetup[\s\S]*RunSetupTransaction\('rollback'/,
    "A cancelled or failed native install must roll back the prepared app swap");
  assert.match(script, /SaveStringToFile\([\s\S]*TransactionFinalized/,
    "Crash recovery needs a finalization marker written after Inno succeeds");
  assert.match(script,
    /RegWriteStringValue\(HKCU, '\{#NativeUninstallSubkey\}',[\s\S]*PreparedTransactionId\)/,
    "Installed apps finalization must be correlated to the exact app transaction");
  assert.match(script, /AppUserModelID: "\{#AuraAppUserModelId\}"/,
    "Native Aura shortcuts must carry the stable AppUserModelID");
  assert.match(script, /Name: "\{group\}\\Claude Aura"/);
  assert.match(script, /Name: "\{autodesktop\}\\Claude Aura"[\s\S]*Tasks: desktopicons/);
  assert.match(script, /ExecAndLogOutput\(NodeExecutablePath, '--version',[\s\S]*SW_HIDE/);
  assert.doesNotMatch(script, /ExpandConstant\('\{userprofile\}/i,
    "Setup must use Inno's supported environment expansion for user-profile tools");
  assert.match(script, /ExpandConstant\('\{%USERPROFILE\}\\\.volta\\bin\\node\.exe'\)/);
  assert.match(script,
    /WebView2ClientSubkey[\s\S]*F3017226-FE2A-4295-8BDF-00C3A9A7E4C5/);
  assert.match(script, /RegQueryStringValue\(HKCU, WebView2ClientSubkey, 'pv'/);
  assert.match(script, /RegQueryStringValue\(HKLM32, WebView2ClientSubkey, 'pv'/);
  assert.match(script,
    /else if not DetectWebView2 then\s+Result := CustomMessage\('WebViewBlockedBody'\)/);
  assert.doesNotMatch(script, /ExecAndLogOutput\('node\.exe'/,
    "Setup must never execute Node through Windows' current-directory search order");
  assert.match(script, /if IsAdmin then\s+Result := CustomMessage\('AdminBlockedBody'\)/);
  assert.match(script, /else if IsAuraRunning then\s+Result := CustomMessage\('AuraRunningBody'\)/);
  assert.doesNotMatch(script, /downloadpage|downloadtemporaryfile|urldownloadtofile/i,
    "Setup must not gain a hidden downloader");
  assert.doesNotMatch(script, /\b(?:service|scheduledtask|schtasks|driver)\b/i,
    "Setup must not add persistent system machinery");
  assert.doesNotMatch(script, /Root:\s*HKLM|PrivilegesRequired=admin/i,
    "Setup must remain inside the current Windows account");

  assert.match(transaction, /\[ValidateSet\('prepare', 'commit', 'rollback', 'recover'\)\]/);
  assert.match(transaction, /Write-AuraAtomicText -Path \$journalPath/);
  assert.match(transaction, /Assert-AuraTreeHasNoReparsePoints/);
  assert.match(transaction,
    /function Get-AuraFileSha256[\s\S]*?\[Security\.Cryptography\.SHA256\]::Create\(\)/,
    "Native Setup must hash with the .NET runtime available in its maintenance process");
  assert.doesNotMatch(transaction, /\bGet-FileHash\b/,
    "Native Setup must not depend on PowerShell module autoloading for app verification");
  assert.match(transaction, /AURA_INSTALL_TRANSACTION=\$id/);
  const finalizedFunction = transaction.match(
    /function Test-AuraTransactionFinalized[\s\S]*?(?=function Complete-AuraCommit)/u,
  )?.[0] ?? "";
  assert.match(finalizedFunction, /ClaudeAuraTransactionId|\$transactionRegistryValue/);
  assert.match(finalizedFunction, /\$Journal\.transactionId/);
  assert.doesNotMatch(finalizedFunction, /DisplayVersion|targetVersion/,
    "A same-version registration must not finalize a different transaction");
  assert.match(transaction, /'rollingBack',\s*'rolledBack'/);
  assert.match(transaction,
    /\$Journal\.state = 'rolledBack'\s+Write-AuraJournal -Journal \$Journal/);
  assert.doesNotMatch(transaction, /Invoke-WebRequest|Start-BitsTransfer|https?:\/\//i,
    "The app transaction must be strictly local");
});

test("native uninstall keeps data by default and requires an explicit erase choice", async () => {
  const [script, uninstaller] = await Promise.all([
    fs.readFile(installerScriptPath, "utf8"),
    fs.readFile(uninstallBackendPath, "utf8"),
  ]);
  assert.match(script, /^UninstallFilesDir=\{#MaintenanceRoot\}$/m);
  assert.match(script, /#define MaintenanceBackend MaintenanceRoot \+ "\\backend-" \+ AppVersion/);
  assert.match(script, /AddQuotes\(ExpandConstant\('\{#MaintenanceTransaction\}'\)\)[\s\S]*' -Mode recover'/);
  assert.match(script, /AddQuotes\(ExpandConstant\('\{#MaintenanceUninstall\}'\)\)[\s\S]*' -NativeBackend'/);
  assert.doesNotMatch(script,
    /AddQuotes\(ExpandConstant\('\{#InstalledApp\}\\windows\\uninstall\.ps1'\)\)/,
    "Retry-safe uninstall code must live outside the app tree it removes");
  assert.match(script,
    /SuppressibleTaskDialogMsgBox\([\s\S]{0,500}?MB_YESNOCANCEL[\s\S]{0,300}?0, IDYES\)/,
    "Silent/default uninstall must keep local data");
  assert.match(script, /RemoveLocalData := Choice = IDNO/);
  assert.match(script, /if RemoveLocalData then\s+Parameters := Parameters \+ ' -RemoveData'/);
  assert.match(script, /CurUninstallStepChanged\(CurUninstallStep: TUninstallStep\)/);
  assert.match(script, /CurUninstallStep = usUninstall[\s\S]{0,1800}?\bAbort;/,
    "A failed backend uninstall must stop native unregistration");
  assert.match(script,
    /CurUninstallStep = usPostUninstall[\s\S]{0,200}?RemoveDir\(ExpandConstant\('\{#ProductRoot\}'\)\)/);
  assert.doesNotMatch(script,
    /Parameters := '-NoProfile[^;]{0,500}? -RemoveData/,
    "RemoveData must never be part of the default uninstall command");
  assert.match(uninstaller, /\[switch\]\$NativeBackend/);
  assert.match(uninstaller, /\^backend-\(\?<version>\\d\+/);
  assert.match(uninstaller,
    /\$NativeBackend[\s\S]*\$PSScriptRoot[\s\S]*registered maintenance backend/);
  assert.match(uninstaller,
    /\$registration\.DisplayVersion[\s\S]*\$nativeBackendVersion/);
  assert.match(uninstaller, /Get-AuraRegisteredNativeUninstaller/);
  assert.match(uninstaller, /unins\\d\{3\}\\\.exe/);
  assert.match(uninstaller,
    /if \(-not \$NativeBackend -and -not \$WhatIfPreference\)[\s\S]*Start-Process -FilePath \$nativeUninstaller -Wait -PassThru/,
    "Legacy uninstall entry points must delegate to the registered native uninstaller");
  if (process.platform === "win32") {
    const powerShell = path.join(
      process.env.SystemRoot,
      "System32",
      "WindowsPowerShell",
      "v1.0",
      "powershell.exe",
    );
    const invalidBackend = spawnSync(powerShell, [
      "-NoProfile",
      "-NonInteractive",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      uninstallBackendPath,
      "-NativeBackend",
      "-WhatIf",
    ], {
      cwd: PROJECT_ROOT,
      encoding: "utf8",
      windowsHide: true,
    });
    assert.notEqual(invalidBackend.status, 0,
      "The app/ZIP uninstall script must not impersonate the native backend");
    assert.match(`${invalidBackend.stdout}\n${invalidBackend.stderr}`,
      /outside its registered maintenance backend/);
  }
});

test("repository installs serialize the mandatory Windows check gate", async () => {
  const installer = await fs.readFile(installBackendPath, "utf8");
  const repositoryGate = installer.match(
    /if \(Test-Path -LiteralPath \(Join-Path \$SourceRoot '\.git'\)\) \{[\s\S]*?\n  \} else \{/u,
  )?.[0] ?? "";

  assert.match(repositoryGate,
    /SetEnvironmentVariable\('AURA_TEST_JOBS', '1', 'Process'\)[\s\S]*tests\\run-tests\.mjs/,
    "Repository installs must avoid parallel Windows loader pressure");
  assert.match(repositoryGate,
    /finally \{[\s\S]*SetEnvironmentVariable\('AURA_TEST_JOBS', \$previousTestJobs, 'Process'\)/,
    "Repository installs must restore the caller's test concurrency setting");
});

test("installer locales are complete, independent, and preserve placeholders", async () => {
  const localeFiles = ["en.isl", "zh-CN.isl", "zh-HKTW.isl"];
  const localeEntries = await Promise.all(localeFiles.map(async (name) => {
    const bytes = await fs.readFile(path.join(localeDirectory, name));
    assert.deepEqual([...bytes.subarray(0, 3)], [0xef, 0xbb, 0xbf],
      `${name} must declare UTF-8 explicitly for reproducible Inno compilation`);
    const source = bytes.toString("utf8");
    assert(!source.includes("\uFFFD"), `${name} contains a Unicode replacement character`);
    assert(!/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(source),
      `${name} contains a forbidden control character`);
    return [name, parseMessages(source)];
  }));
  const locales = Object.fromEntries(localeEntries);
  const canonicalKeys = Object.keys(locales["en.isl"]).sort();
  assert(canonicalKeys.length >= 35, "Installer trust and lifecycle copy is unexpectedly incomplete");

  for (const [name, messages] of Object.entries(locales)) {
    assert.deepEqual(Object.keys(messages).sort(), canonicalKeys,
      `${name} does not match the installer locale schema`);
    for (const [key, value] of Object.entries(messages)) {
      assert(value.trim(), `${name} has an empty ${key} translation`);
      assert.deepEqual(placeholders(value), placeholders(locales["en.isl"][key]),
        `${name} changed placeholders in ${key}`);
    }
  }
  assert(/[\u4e00-\u9fff]/u.test(locales["zh-CN.isl"].TrustPageTitle));
  assert(/[\u4e00-\u9fff]/u.test(locales["zh-HKTW.isl"].TrustPageTitle));
  assert.notEqual(locales["zh-CN.isl"].TrustPageSubtitle,
    locales["zh-HKTW.isl"].TrustPageSubtitle,
  "Chinese installer copy must be maintained independently");

  const script = await fs.readFile(installerScriptPath, "utf8");
  const referenced = new Set([
    ...[...script.matchAll(/CustomMessage\('([^']+)'\)/g)].map((match) => match[1]),
    ...[...script.matchAll(/\{cm:([^}]+)\}/g)].map((match) => match[1]),
  ]);
  for (const key of referenced) {
    assert(canonicalKeys.includes(key), `Installer source references missing locale key ${key}`);
  }
});

test("installer artwork is deterministic and has exact native-wizard dimensions", async () => {
  const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "claude-aura-installer-art-"));
  try {
    const generated = await buildInstallerAssets({ outputDirectory: temporaryRoot });
    const expected = new Map([
      ["wizard-light.png", { width: 480, height: 918 }],
      ["wizard-dark.png", { width: 480, height: 918 }],
      ["wizard-small-light.png", { width: 128, height: 128 }],
      ["wizard-small-dark.png", { width: 128, height: 128 }],
    ]);
    for (const [name, dimensions] of expected) {
      const [tracked, rebuilt] = await Promise.all([
        fs.readFile(path.join(artworkDirectory, name)),
        fs.readFile(path.join(temporaryRoot, name)),
      ]);
      assert.deepEqual(rebuilt, tracked, `${name} is stale or nondeterministic`);
      assert.deepEqual(pngDimensions(rebuilt), dimensions, `${name} has the wrong dimensions`);
    }
    assert.equal(new Set(generated.themeSpine).size, 8,
      "The installer signature spine must represent all eight built-in themes");
  } finally {
    const resolved = path.resolve(temporaryRoot);
    assert(resolved.startsWith(`${path.resolve(os.tmpdir())}${path.sep}claude-aura-installer-art-`));
    await fs.rm(resolved, { recursive: true, force: true });
  }
});

test("one-click release builds one current Setup and keeps trust modes explicit", async () => {
  const [launcher, workflow] = await Promise.all([
    fs.readFile(installerQuickBuildPath, "utf8"),
    fs.readFile(installerQuickWorkflowPath, "utf8"),
  ]);
  assert.match(launcher, /node\.exe "%~dp0build-update\.mjs" %\*/,
    "The one-click batch file must delegate beside itself without depending on the working directory");
  assert.match(workflow, /mode: null/);
  assert.match(workflow, /options\.mode \?\?= "unsigned-development"/,
    "Double-clicking must default to the local-development Setup executable");
  assert.match(workflow,
    /argument === "--signed"[\s\S]{0,100}?"--unsigned"[\s\S]{0,100}?"--unsigned-dev"/,
    "Every non-default trust mode must require an explicit option");
  assert.doesNotMatch(workflow, /--zip|public ZIP \+ CMD/,
    "The one-click installer builder must not create a second user-facing installer format");
  assert.match(workflow,
    /"signed"[\s\S]*"unsigned-release"[\s\S]*"unsigned-development"/,
    "A signed public build must require an explicit option");
  const checkIndex = workflow.indexOf('runNpm("check")');
  const verifyIndex = workflow.indexOf('runNpm("verify:cycle")');
  const buildIndex = workflow.indexOf("runNpm(buildScript)");
  assert(checkIndex >= 0 && verifyIndex > checkIndex && buildIndex > verifyIndex,
    "The one-click builder must pass checks and theme verification before building an artifact");
  assert.match(workflow, /process\.env\.ComSpec/);
  assert.match(workflow, /path\.win32\.basename\(commandProcessor\).*"cmd\.exe"/);
  assert.match(workflow,
    /spawnSync\(commandProcessor, \["\/d", "\/s", "\/c", `npm\.cmd run \$\{script\}`\]/);
  assert.match(workflow, /--no-open/);
  assert.match(workflow, /--no-pause/);
  assert.match(workflow, /Claude-Aura-Setup-v\$\{packageJson\.version\}-UNSIGNED\.exe/);
  assert.match(workflow, /Claude-Aura-Setup-v\$\{packageJson\.version\}-UNSIGNED-DEV\.exe/);
  assert.match(workflow, /Claude-Aura-Setup-v\$\{packageJson\.version\}\.exe/);
  assert.match(workflow, /const outputDirectory = "windows"/,
    "The build launcher must publish only to the canonical Setup folder");
  assert.doesNotMatch(`${launcher}\n${workflow}`,
    /\bgit\b|npm\.cmd version|\bnpm publish\b|\bgh\b/i,
    "Building an installer must not change versions or publish repository state");
});

test("installer build signs before hashing and rejects stale or ambiguous artifacts", async () => {
  const [builder, auditor, artworkBuilder, packageSource] = await Promise.all([
    fs.readFile(installerBuildPath, "utf8"),
    fs.readFile(installerAuditPath, "utf8"),
    fs.readFile(installerAssetBuildPath, "utf8"),
    fs.readFile(path.join(PROJECT_ROOT, "package.json"), "utf8"),
  ]);
  for (const marker of [
    "safeArchivePath",
    "MAX_ARCHIVE_FILES",
    "MAX_ARCHIVE_BYTES",
    "duplicate path",
    "escaped its staging root",
    "unsupported ZIP features",
    "crc32(content)",
    "Release archive SHA-256 changed after the release builder returned",
  ]) assert(builder.includes(marker), `Installer ZIP validation is missing ${marker}`);
  assert.match(builder, /AURA_SIGNTOOL_COMMAND/);
  assert.match(builder, /AURA_SIGNER_THUMBPRINT/);
  assert.match(builder, /signCommand\.includes\("\$f"\)/);
  assert.match(builder, /timestampThumbprint/);
  assert.match(builder, /PINNED_INNO_SETUP[\s\S]*version: "7\.0\.2"/);
  assert.match(builder, /compilerSha256 !== PINNED_INNO_SETUP\.isccSha256/);
  assert.match(builder, /--allow-unsigned-development/);
  assert.match(builder, /--allow-unsigned-release/);
  assert.match(builder, /UnsignedPublicBuild/);
  assert.match(builder, /UNSIGNED-DEV/);
  assert.match(builder,
    /SETUP_RELEASE_DIRECTORY = path\.join\(RELEASE_ROOT, "windows"\)/);
  assert.doesNotMatch(builder, /PORTABLE_RELEASE_DIRECTORY/,
    "Setup builds must keep their intermediate ZIP outside the user-facing release tree");
  assert.match(builder, /const payloadOutputDirectory = path\.join\(stagingParent, "payload"\)/);
  assert.match(builder, /buildRelease\(payloadOutputDirectory\)/);
  assert.match(builder,
    /"scripts\/build-release\.mjs",\s*"--native-payload",\s*"--output-directory"/,
    "Native Setup must build a payload that excludes portable installer wrappers");
  assert.match(builder, /release\.files !== staged\.files \|\| release\.unpackedBytes !== staged\.bytes/,
    "Setup builds must compare the extracted payload inventory with the payload builder");
  assert.match(builder, /bytes: release\.bytes,[\s\S]{0,80}?unpackedBytes: staged\.bytes/,
    "Setup manifests must distinguish archive bytes from extracted bytes");
  assert.match(builder, /removeSupersededInstallerOutputs/,
    "Publishing a Setup must remove older Setup modes from the canonical folder");
  assert.match(builder, /releaseEligible: options\.signed \|\| options\.unsignedRelease/);
  assert.match(builder,
    /buildType: options\.signed[\s\S]{0,180}?"unsigned-release"[\s\S]{0,100}?"unsigned-development"/);
  assert.match(builder,
    /trust: options\.signed[\s\S]{0,180}?"sha256-only"[\s\S]{0,100}?"development-only"/);
  assert.doesNotMatch(builder, /checkedCommand\("powershell\.exe"/,
    "Build-time signature checks must use the absolute system PowerShell path");
  assert.match(builder, /PSModulePath: trustedModulePath/,
    "Signature inspection must not inherit PowerShell 7 module paths");
  assert.match(builder, /if \(options\.signed && signature\.status !== "Valid"\)/);
  const signatureIndex = builder.indexOf(
    "const signature = powershellSignature(powerShellPath, stagedArtifactPath)",
  );
  const digestIndex = builder.indexOf("const digest = crypto.createHash");
  const checksumIndex = builder.indexOf("stagedChecksumPath,");
  const promotionIndex = builder.indexOf("await promoteInstallerOutputs([");
  assert(signatureIndex >= 0 && digestIndex > signatureIndex
      && checksumIndex > digestIndex && promotionIndex > checksumIndex,
    "Installer checksum must be generated only after signing and verification");
  assert.match(builder,
    /const compilerOutputDirectory = path\.join\(stagingParent, "compiled"\)/);
  assert.match(builder, /`\/O\$\{compilerOutputDirectory\}`/);
  assert.match(builder,
    /promoteInstallerOutputs\(\[[\s\S]*stagedArtifactPath[\s\S]*stagedChecksumPath[\s\S]*stagedManifestPath/);
  assert.match(builder, /\.incoming-\$\{token\}/);
  assert.match(builder, /\.previous-\$\{token\}/);
  assert.match(builder, /await fs\.mkdtemp\(path\.join\(os\.tmpdir\(\), "claude-aura-installer-"\)\)/);
  assert.match(builder, /await fs\.rm\(resolved, \{ recursive: true, force: true \}\)/);
  assert.doesNotMatch(builder, /\bfetch\s*\(|https\.request|Invoke-WebRequest/i,
    "The installer builder must not fetch tools or payloads");
  assert.match(artworkBuilder, /const THEME_SPINE = Object\.freeze\(\[/);
  const packageJson = JSON.parse(packageSource);
  assert.match(packageJson.scripts.installer, /build-installer\.mjs --signed && node scripts\/audit-installer\.mjs/);
  assert.match(packageJson.scripts["installer:unsigned"],
    /build-installer\.mjs --allow-unsigned-release && node scripts\/audit-installer\.mjs/);
  assert.match(packageJson.scripts["installer:dev"],
    /build-installer\.mjs --allow-unsigned-development && node scripts\/audit-installer\.mjs/);
  assert.match(auditor, /Expected one Setup executable and no alternate installers/);
  assert.match(auditor, /The Setup executable embeds a stale payload/);
  assert.match(auditor, /Installed Claude Aura contains a nested portable installer/);
  assert.match(auditor, /The Setup payload includes a nested portable installer/);
  assert.match(auditor, /manifest\?\.payload\?\.unpackedBytes !== current\.unpackedBytes/,
    "The installer audit must compare extracted payload size with the current source payload");
  assert.match(auditor, /Installed Claude Aura is stale or incomplete/);
  assert(packageJson.scripts.check.includes("node --check scripts/build-installer.mjs"));
});

test("same-version registration finalizes only its correlated app transaction", async () => {
  if (process.platform !== "win32") return;
  const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "claude-aura-finalization-"));
  const localAppData = path.join(temporaryRoot, "local");
  const productRoot = path.join(localAppData, "ClaudeAura");
  const powerShell = path.join(
    process.env.SystemRoot,
    "System32",
    "WindowsPowerShell",
    "v1.0",
    "powershell.exe",
  );
  const probe = String.raw`
$ErrorActionPreference = 'Stop'
$transactionScript = [IO.Path]::GetFullPath($env:AURA_TEST_TRANSACTION_PATH)
$productRoot = [IO.Path]::GetFullPath($env:AURA_TEST_PRODUCT_ROOT)
. $transactionScript -Mode recover
$finalizedPath = [IO.Path]::GetFullPath((Join-Path $productRoot '.native-install-finalized'))
$uninstallKey = 'HKCU:\Software\ClaudeAuraTests\simulated'
$installerRoot = Join-Path $productRoot 'installer'
$uninstaller = Join-Path $installerRoot 'unins000.exe'
$journal = [PSCustomObject]@{
  transactionId = '0123456789abcdef0123456789abcdef'
  targetVersion = '9.8.7'
}
try {
  New-Item -ItemType Directory -Path $installerRoot -Force | Out-Null
  New-Item -ItemType File -Path $uninstaller -Force | Out-Null
  $script:FakeRegistration = [PSCustomObject]@{
    DisplayVersion = '9.8.7'
    UninstallString = '"' + $uninstaller + '"'
  }
  function Get-ItemProperty {
    [CmdletBinding()]
    param([string]$LiteralPath)
    return $script:FakeRegistration
  }
  if (Test-AuraTransactionFinalized -Journal $journal) {
    throw 'A same-version registration finalized an unrelated transaction.'
  }
  $script:FakeRegistration | Add-Member -NotePropertyName 'ClaudeAuraTransactionId' -NotePropertyValue ('0' * 32)
  if (Test-AuraTransactionFinalized -Journal $journal) {
    throw 'A prior transaction id finalized the current transaction.'
  }
  $script:FakeRegistration.ClaudeAuraTransactionId = $journal.transactionId
  if (-not (Test-AuraTransactionFinalized -Journal $journal)) {
    throw 'The matching transaction id did not finalize its transaction.'
  }
} finally {}
`;
  try {
    const result = spawnSync(powerShell, [
      "-NoProfile",
      "-NonInteractive",
      "-ExecutionPolicy",
      "Bypass",
      "-Command",
      probe,
    ], {
      cwd: PROJECT_ROOT,
      encoding: "utf8",
      env: {
        ...process.env,
        LOCALAPPDATA: localAppData,
        AURA_TEST_TRANSACTION_PATH: appTransactionPath,
        AURA_TEST_PRODUCT_ROOT: productRoot,
      },
      windowsHide: true,
    });
    assert.equal(result.status, 0,
      `Transaction finalization probe failed:\n${result.stdout}\n${result.stderr}`);
  } finally {
    await fs.rm(temporaryRoot, { recursive: true, force: true });
  }
});

test("native app transaction restores upgrades exactly and commits cleanly", async () => {
  if (process.platform !== "win32") return;
  const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "claude-aura-native-transaction-"));
  const localAppData = path.join(temporaryRoot, "local");
  const sourceRoot = path.join(temporaryRoot, "source");
  const appRoot = path.join(localAppData, "ClaudeAura", "app");
  const powerShell = path.join(
    process.env.SystemRoot,
    "System32",
    "WindowsPowerShell",
    "v1.0",
    "powershell.exe",
  );
  const testMutex = `Local\\ClaudeAura.Test.${process.pid}.${path.basename(temporaryRoot)}`;
  const transactionProbe = String.raw`
$ErrorActionPreference = 'Stop'
. $env:AURA_TEST_TRANSACTION_PATH -Mode recover
$script:TestMutexName = $env:AURA_TEST_MUTEX
function Enter-AuraTransactionLock {
  $mutex = [Threading.Mutex]::new($false, $script:TestMutexName)
  $acquired = $false
  try {
    $acquired = $mutex.WaitOne(0)
  } catch [Threading.AbandonedMutexException] {
    $acquired = $true
  }
  if (-not $acquired) {
    $mutex.Dispose()
    throw 'The isolated transaction-test mutex is already held.'
  }
  return $mutex
}
if ($env:AURA_TEST_UI_RUNNING -ceq '1') {
  function Test-AuraUiHostRunning { return $true }
}
$parameters = @{ Mode = $env:AURA_TEST_MODE }
if ($env:AURA_TEST_SOURCE_ROOT) {
  $parameters.SourceRoot = $env:AURA_TEST_SOURCE_ROOT
}
if ($env:AURA_TEST_TRANSACTION_ID) {
  $parameters.TransactionId = $env:AURA_TEST_TRANSACTION_ID
}
if ($env:AURA_TEST_TARGET_VERSION) {
  $parameters.TargetVersion = $env:AURA_TEST_TARGET_VERSION
}
Invoke-AuraTransaction @parameters
`;
  const runTransaction = (mode, extra = [], expectSuccess = true, uiRunning = false) => {
    const extraValues = {};
    for (let index = 0; index < extra.length; index += 2) {
      extraValues[extra[index]] = extra[index + 1];
    }
    const result = spawnSync(powerShell, [
      "-NoProfile",
      "-NonInteractive",
      "-ExecutionPolicy",
      "Bypass",
      "-Command",
      transactionProbe,
    ], {
      cwd: PROJECT_ROOT,
      encoding: "utf8",
      env: {
        ...process.env,
        LOCALAPPDATA: localAppData,
        AURA_TEST_TRANSACTION_PATH: appTransactionPath,
        AURA_TEST_MUTEX: testMutex,
        AURA_TEST_MODE: mode,
        AURA_TEST_SOURCE_ROOT: extraValues["-SourceRoot"] ?? "",
        AURA_TEST_TRANSACTION_ID: extraValues["-TransactionId"] ?? "",
        AURA_TEST_TARGET_VERSION: extraValues["-TargetVersion"] ?? "",
        AURA_TEST_UI_RUNNING: uiRunning ? "1" : "0",
      },
      windowsHide: true,
    });
    if (expectSuccess) {
      assert.equal(result.status, 0,
        `Transaction ${mode} failed:\n${result.stdout}\n${result.stderr}`);
    } else {
      assert.notEqual(result.status, 0,
        `Transaction ${mode} unexpectedly succeeded`);
    }
    return result;
  };
  try {
    await fs.mkdir(path.join(appRoot, "nested"), { recursive: true });
    await fs.writeFile(path.join(appRoot, "old.txt"), "old-app\n", "utf8");
    await fs.writeFile(path.join(appRoot, "nested", "state.bin"),
      Buffer.from([0, 1, 2, 250, 255]));
    await fs.mkdir(path.join(sourceRoot, "nested"), { recursive: true });
    await fs.writeFile(path.join(sourceRoot, "new.txt"), "new-app\n", "utf8");
    await fs.writeFile(path.join(sourceRoot, "nested", "state.bin"),
      Buffer.from([9, 8, 7, 6]));

    const runningBlocked = runTransaction("prepare", [
      "-SourceRoot", sourceRoot,
      "-TargetVersion", "9.8.7",
    ], false, true);
    assert.match(`${runningBlocked.stdout}\n${runningBlocked.stderr}`,
      /Exit Claude Aura from its window or tray/i,
      "Native Setup must explain how to release the live app before updating");
    assert.equal(await fs.readFile(path.join(appRoot, "old.txt"), "utf8"), "old-app\n",
      "Native Setup changed the installed app while Aura was running");

    const prepared = runTransaction("prepare", [
      "-SourceRoot", sourceRoot,
      "-TargetVersion", "9.8.7",
    ]);
    const id = prepared.stdout.match(/AURA_INSTALL_TRANSACTION=([0-9a-f]{32})/u)?.[1];
    assert(id, "Prepare did not return a valid native transaction id");
    assert.equal(await fs.readFile(path.join(appRoot, "new.txt"), "utf8"), "new-app\n");
    assert.equal(await fs.readFile(path.join(
      localAppData, "ClaudeAura", `.app-native-backup-${id}`, "old.txt",
    ), "utf8"), "old-app\n");

    await fs.writeFile(
      path.join(localAppData, "ClaudeAura", ".native-install-finalized"),
      "00000000000000000000000000000000",
      "utf8",
    );
    runTransaction("rollback", ["-TransactionId", id]);
    assert.equal(await fs.readFile(path.join(appRoot, "old.txt"), "utf8"), "old-app\n");
    assert.deepEqual(await fs.readFile(path.join(appRoot, "nested", "state.bin")),
      Buffer.from([0, 1, 2, 250, 255]));

    const preparedForRetry = runTransaction("prepare", [
      "-SourceRoot", sourceRoot,
      "-TargetVersion", "9.8.7",
    ]);
    const retryId = preparedForRetry.stdout
      .match(/AURA_INSTALL_TRANSACTION=([0-9a-f]{32})/u)?.[1];
    assert(retryId, "Second prepare did not return a valid transaction id");
    const injectedStage = path.join(
      localAppData,
      "ClaudeAura",
      `.app-native-stage-${retryId}`,
    );
    const injectedLink = path.join(injectedStage, "cleanup-blocked");
    await fs.mkdir(injectedStage);
    await fs.symlink(sourceRoot, injectedLink, "junction");
    const failedRollback = runTransaction(
      "rollback",
      ["-TransactionId", retryId],
      false,
    );
    assert.match(`${failedRollback.stdout}\n${failedRollback.stderr}`, /reparse point/i);
    assert.equal(await fs.readFile(path.join(appRoot, "old.txt"), "utf8"), "old-app\n",
      "Cleanup failure must not undo restoration of the prior app");
    const pendingJournal = JSON.parse(await fs.readFile(
      path.join(localAppData, "ClaudeAura", ".native-install-transaction.json"),
      "utf8",
    ));
    assert.equal(pendingJournal.state, "rolledBack",
      "Rollback must persist restoration before fallible cleanup");
    await fs.unlink(injectedLink);
    runTransaction("recover");
    runTransaction("recover");

    const preparedAgain = runTransaction("prepare", [
      "-SourceRoot", sourceRoot,
      "-TargetVersion", "9.8.7",
    ]);
    const committedId = preparedAgain.stdout
      .match(/AURA_INSTALL_TRANSACTION=([0-9a-f]{32})/u)?.[1];
    assert(committedId, "Third prepare did not return a valid transaction id");
    runTransaction("commit", ["-TransactionId", committedId]);
    assert.equal(await fs.readFile(path.join(appRoot, "new.txt"), "utf8"), "new-app\n");
    const productEntries = await fs.readdir(path.join(localAppData, "ClaudeAura"));
    assert.deepEqual(productEntries.sort(), ["app"],
      "Commit left an app backup, rollback tree, or journal behind");
  } finally {
    await fs.rm(temporaryRoot, { recursive: true, force: true });
  }
});

runIfMain(import.meta.url);
