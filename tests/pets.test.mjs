import { spawnSync } from "node:child_process";
import vm from "node:vm";
import { test, runIfMain } from "./support/harness.mjs";
import {
  PROJECT_ROOT,
  assert,
  fs,
  os,
  path,
} from "./support/context.mjs";

const petsScriptPath = path.join(PROJECT_ROOT, "studio", "pets.js");
const petsStylesPath = path.join(PROJECT_ROOT, "studio", "pets.css");
const studioIndexPath = path.join(PROJECT_ROOT, "studio", "index.html");
const studioAppPath = path.join(PROJECT_ROOT, "studio", "app.js");
const uiPath = path.join(PROJECT_ROOT, "windows", "aura-ui.ps1");
const taskboardPath = path.join(PROJECT_ROOT, "windows", "aura-taskboard.ps1");
const petsHostPath = path.join(PROJECT_ROOT, "windows", "aura-pets.ps1");
const releaseBuilderPath = path.join(PROJECT_ROOT, "scripts", "build-release.mjs");
const installerAuditPath = path.join(PROJECT_ROOT, "scripts", "audit-installer.mjs");
const psPath = (value) => value.replaceAll("'", "''");

const validState = () => ({
  type: "pet-plugin-state",
  version: 1,
  contractId: "gemini-aura-pet-selection-v1",
  catalogVersion: 1,
  availability: "ready",
  applyMode: "when-companion-running",
  liveReceipt: false,
  pets: [
    { id: "nori", name: "Nori" },
    { id: "pip", name: "Pip" },
    { id: "moss", name: "Moss" },
  ],
  selection: { enabled: false, selectedPetId: "pip", revision: 4 },
  action: "read",
  actionSucceeded: true,
  errorCode: null,
});

test("pet state is body-free, exact, and limited to the fixed companion catalog", async () => {
  const source = await fs.readFile(petsScriptPath, "utf8");
  const context = { window: {} };
  vm.runInNewContext(source, context, { filename: petsScriptPath });
  const normalize = context.window.CLAUDE_AURA_PETS.normalizeState;

  assert.deepEqual(JSON.parse(JSON.stringify(normalize(validState()))), {
    availability: "ready",
    enabled: false,
    selectedPetId: "pip",
    revision: 4,
    action: "read",
    actionSucceeded: true,
    errorCode: null,
  });
  assert.equal(normalize({ ...validState(), conversation: "must not cross" }), null);
  assert.equal(normalize({ ...validState(), pets: [{ id: "pip", name: "Other" }] }), null);
  assert.equal(normalize({
    ...validState(),
    selection: { enabled: true, selectedPetId: null, revision: 4 },
  }), null);
});

test("Studio exposes visible previews plus separate Select, Show, Hide, and Settings controls", async () => {
  const [html, app, script, styles, host, ui, release, audit] = await Promise.all([
    fs.readFile(studioIndexPath, "utf8"),
    fs.readFile(studioAppPath, "utf8"),
    fs.readFile(petsScriptPath, "utf8"),
    fs.readFile(petsStylesPath, "utf8"),
    fs.readFile(petsHostPath, "utf8"),
    fs.readFile(uiPath, "utf8"),
    fs.readFile(releaseBuilderPath, "utf8"),
    fs.readFile(installerAuditPath, "utf8"),
  ]);
  assert.match(html, /data-studio-view="pets"/);
  assert.match(html, /id="pet-selected-preview"/);
  for (const id of ["pet-show", "pet-hide", "pet-settings", "pet-refresh"]) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
  assert.doesNotMatch(html, /id="pet-toggle"/);
  for (const pet of ["nori", "pip", "moss"]) {
    assert.match(script, new RegExp(`pets/${pet}\\.png`));
  }
  assert.match(script, /show\.disabled = pending \|\| !usable \|\| !state\.selectedPetId/);
  assert.match(script, /hide\.disabled = pending \|\| !usable \|\| !state\.enabled/);
  assert.match(script, /button\.setAttribute\("aria-pressed", String\(selected\)\)/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(styles, /@media \(forced-colors: active\)/);
  assert.match(app, /"tasks", "themes", "pets"/);
  assert.match(app, /"pet-plugin-read", "pet-plugin-select", "pet-plugin-show", "pet-plugin-hide"/);
  assert.match(host, /gemini-aura-pet-selection-v1/);
  assert.match(host, /GeminiAura\\pet-plugin/);
  assert.match(host, /\$startInfo\.UseShellExecute = \$false/);
  assert.match(host, /\$startInfo\.CreateNoWindow = \$true/);
  assert.match(host, /\$startInfo\.WindowStyle = \[Diagnostics\.ProcessWindowStyle\]::Hidden/);
  assert.match(host, /\[Diagnostics\.Process\]::Start\(\$startInfo\)/);
  assert.match(ui, /\. \(Join-Path \$PSScriptRoot 'aura-pets\.ps1'\)/);
  for (const source of [release, audit]) {
    assert.match(source, /studio\/pets\.js/);
    assert.match(source, /studio\/pets\/nori\.png/);
    assert.match(source, /windows\/aura-pets\.ps1/);
  }
});

test("Windows pet selection enables the companion while Hide retains selection and failed Show rolls back", async () => {
  if (process.platform !== "win32") return;
  const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "claude-aura-pets-"));
  const harnessPath = path.join(temporaryRoot, "pets-harness.ps1");
  const localAppData = path.join(temporaryRoot, "local-app-data");
  const harness = `
$ErrorActionPreference='Stop'
$env:LOCALAPPDATA='${psPath(localAppData)}'
$DataRoot='${psPath(path.join(temporaryRoot, "data"))}'
function Write-AuraUiLog { param([string]$Message) }
function Send-AuraTaskboardChanged { param([long]$Revision) }
function Refresh-AuraTaskboardQueue {}
. '${psPath(taskboardPath)}'
. '${psPath(petsHostPath)}'
$script:States=@()
$script:PetLaunchSucceeds=$true
function Get-AuraPetManagerExecutable { return $null }
function Start-AuraPetManager { return [bool]$script:PetLaunchSucceeds }
function Send-AuraPetPluginState {
  param([object]$Intent,[string]$Availability,[string]$Action,[bool]$ActionSucceeded,[object]$ErrorCode=$null)
  $script:States += [PSCustomObject][ordered]@{
    availability=$Availability;action=$Action;ok=$ActionSucceeded;error=$ErrorCode
    enabled=[bool]$Intent.enabled;selectedPetId=$Intent.selectedPetId;revision=[long]$Intent.revision
  }
  return $true
}
Invoke-AuraPetPluginStudioRequest -Message ([PSCustomObject][ordered]@{type='pet-plugin-read'})
Invoke-AuraPetPluginStudioRequest -Message ([PSCustomObject][ordered]@{type='pet-plugin-select';petId='pip'})
Invoke-AuraPetPluginStudioRequest -Message ([PSCustomObject][ordered]@{type='pet-plugin-show'})
Invoke-AuraPetPluginStudioRequest -Message ([PSCustomObject][ordered]@{type='pet-plugin-hide'})
$beforeFailedShow=Read-AuraPetIntent
$beforeFailedShowRaw=[IO.File]::ReadAllText($script:AuraPetIntentPath,[Text.UTF8Encoding]::new($false,$true))
$beforeFailedShowRevision=[long]$beforeFailedShow.revision
$script:PetLaunchSucceeds=$false
Invoke-AuraPetPluginStudioRequest -Message ([PSCustomObject][ordered]@{type='pet-plugin-show'})
$intent=Read-AuraPetIntent
$raw=[IO.File]::ReadAllText($script:AuraPetIntentPath,[Text.UTF8Encoding]::new($false,$true))
[ordered]@{
  actions=@($script:States | ForEach-Object { $_.action })
  readReady=($script:States[0].availability -ceq 'ready')
  selectedAndEnabled=($script:States[1].ok -and $script:States[1].enabled -and $script:States[1].selectedPetId -ceq 'pip')
  showEnabled=($script:States[2].ok -and $script:States[2].enabled)
  hideRetained=($script:States[3].ok -and -not $script:States[3].enabled -and $script:States[3].selectedPetId -ceq 'pip')
  failedShowRolledBack=(-not $script:States[4].ok -and $script:States[4].error -ceq 'companion-unavailable' -and -not $intent.enabled)
  failedShowBytesUnchanged=($beforeFailedShowRaw -ceq $raw -and [long]$intent.revision -eq $beforeFailedShowRevision)
  finalPet=$intent.selectedPetId
  revision=$intent.revision
  bodyFree=(-not $raw.Contains('conversation') -and -not $raw.Contains('prompt') -and -not $raw.Contains('message'))
  exactPath=([IO.Path]::GetFullPath($script:AuraPetIntentPath) -ceq [IO.Path]::GetFullPath((Join-Path $env:LOCALAPPDATA 'GeminiAura\\pet-plugin\\selection-v1.json')))
} | ConvertTo-Json -Compress
`;
  await fs.writeFile(harnessPath, harness, "utf8");
  try {
    const result = spawnSync("powershell.exe", [
      "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", harnessPath,
    ], { cwd: PROJECT_ROOT, encoding: "utf8", windowsHide: true });
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    assert.deepEqual(JSON.parse(result.stdout.trim().split(/\r?\n/u).at(-1)), {
      actions: ["read", "select", "show", "hide", "show"],
      readReady: true,
      selectedAndEnabled: true,
      showEnabled: true,
      hideRetained: true,
      failedShowRolledBack: true,
      failedShowBytesUnchanged: true,
      finalPet: "pip",
      revision: 3,
      bodyFree: true,
      exactPath: true,
    });
  } finally {
    await fs.rm(temporaryRoot, { recursive: true, force: true });
  }
});

runIfMain(import.meta.url);
