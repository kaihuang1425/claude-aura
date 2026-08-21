import { spawnSync } from "node:child_process";
import vm from "node:vm";

import { test, runIfMain } from "./support/harness.mjs";
import {
  PROJECT_ROOT,
  assert,
  crypto,
  fs,
  os,
  path,
  readHostCopy,
} from "./support/context.mjs";

const petsScriptPath = path.join(PROJECT_ROOT, "studio", "pets.js");
const studioIndexPath = path.join(PROJECT_ROOT, "studio", "index.html");
const studioAppPath = path.join(PROJECT_ROOT, "studio", "app.js");
const petsHostPath = path.join(PROJECT_ROOT, "windows", "aura-pets.ps1");
const taskboardPath = path.join(PROJECT_ROOT, "windows", "aura-taskboard.ps1");
const uiPath = path.join(PROJECT_ROOT, "windows", "aura-ui.ps1");
const psPath = (value) => value.replaceAll("'", "''");

const PET_ASSETS = Object.freeze({
  nori: "a52f9f054e181803e5de51b010b7ca35761bea9a983d1a063e983fca43393e7f",
  pip: "b9e92e7007c11620041ab6eac643e48f7dd8bf06439c3934318fe9c051e36601",
  moss: "c04fd15b5a2655fa7d48e41721f3f658db6b3c801b69b473516c61f8ed46372a",
});

class FakeElement {
  constructor(tagName = "div") {
    this.tagName = tagName.toUpperCase();
    this.children = [];
    this.dataset = {};
    this.attributes = new Map();
    this.listeners = new Map();
    this.style = { setProperty() {} };
    this.classList = { toggle() {} };
    this.textContent = "";
    this.disabled = false;
  }

  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this.children = [...children]; }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  addEventListener(name, listener) { this.listeners.set(name, listener); }
  querySelectorAll(selector) {
    const own = selector === "button[data-pet-id]"
      && this.tagName === "BUTTON"
      && typeof this.dataset.petId === "string";
    return [
      ...(own ? [this] : []),
      ...this.children.flatMap((child) => child?.querySelectorAll?.(selector) ?? []),
    ];
  }
}

function createPetDocument() {
  const ids = [
    "pets", "pet-catalog", "pet-refresh", "pet-settings", "pet-show",
    "pet-hide", "pet-selected-preview", "pet-status",
  ];
  const elements = Object.fromEntries(ids.map((id) => [id, new FakeElement()]));
  return {
    elements,
    document: {
      defaultView: { clearTimeout() {}, setTimeout() { return 1; } },
      createElement: (tagName) => new FakeElement(tagName),
      getElementById: (id) => elements[id] ?? null,
    },
  };
}

function walk(element) {
  return [element, ...element.children.flatMap((child) => walk(child))];
}

function validPetState(selectedPetId = "moss") {
  return {
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
    selection: { enabled: true, selectedPetId, revision: 8 },
    action: "select",
    actionSucceeded: true,
    errorCode: null,
  };
}

test("Studio pet cards and selected preview use the exact real companion PNGs", async () => {
  for (const [petId, expectedHash] of Object.entries(PET_ASSETS)) {
    const assetPath = path.join(PROJECT_ROOT, "studio", "pets", `${petId}.png`);
    let bytes;
    try {
      bytes = await fs.readFile(assetPath);
    } catch {
      assert.fail(`Missing canonical PNG preview: studio/pets/${petId}.png`);
    }
    assert.deepEqual([...bytes.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
    assert.equal(bytes.readUInt32BE(16), 192);
    assert.equal(bytes.readUInt32BE(20), 208);
    assert.equal(crypto.createHash("sha256").update(bytes).digest("hex"), expectedHash);
  }

  const source = await fs.readFile(petsScriptPath, "utf8");
  const context = { window: {} };
  vm.runInNewContext(source, context, { filename: petsScriptPath });
  const view = createPetDocument();
  const controller = context.window.CLAUDE_AURA_PETS.create({
    rootDocument: view.document,
    send: () => true,
    t: (key) => key,
  });
  assert(controller);
  assert(controller.receive(validPetState("moss")));
  assert.deepEqual(
    walk(view.elements["pet-catalog"]).filter((node) => node.tagName === "IMG").map((node) => node.src),
    ["pets/nori.png", "pets/pip.png", "pets/moss.png"],
  );
  const previewImages = walk(view.elements["pet-selected-preview"])
    .filter((node) => node.tagName === "IMG");
  assert.equal(previewImages.length, 1);
  assert.equal(previewImages[0].src, "pets/moss.png");
});

test("selecting a hidden pet enables it only after verified companion start and fails atomically", async () => {
  if (process.platform !== "win32") return;
  const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "claude-aura-pet-select-"));
  const harnessPath = path.join(temporaryRoot, "pet-select-contract.ps1");
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
$script:LaunchCalls=0
$script:LaunchSucceeds=$true
function Start-AuraPetManager {
  $script:LaunchCalls += 1
  return [bool]$script:LaunchSucceeds
}
function Send-AuraPetPluginState {
  param([object]$Intent,[string]$Availability,[string]$Action,[bool]$ActionSucceeded,[object]$ErrorCode=$null)
  $script:States += [PSCustomObject][ordered]@{
    action=$Action;ok=$ActionSucceeded;error=$ErrorCode
    enabled=[bool]$Intent.enabled;pet=$Intent.selectedPetId;revision=[long]$Intent.revision
  }
  return $true
}
$hidden=New-AuraPetIntentRevision -Current (New-AuraPetIntent) -Enabled $false -SelectedPetId 'nori'
[void](Write-AuraPetIntent -Intent $hidden)
Invoke-AuraPetPluginStudioRequest -Message ([PSCustomObject][ordered]@{type='pet-plugin-select';petId='pip'})
$success=Read-AuraPetIntent
$successReceipt=$script:States[-1]
$prior=New-AuraPetIntentRevision -Current $success -Enabled $false -SelectedPetId 'nori'
[void](Write-AuraPetIntent -Intent $prior)
$priorRaw=[IO.File]::ReadAllText($script:AuraPetIntentPath,[Text.UTF8Encoding]::new($false,$true))
$priorRevision=[long]$prior.revision
$script:LaunchSucceeds=$false
Invoke-AuraPetPluginStudioRequest -Message ([PSCustomObject][ordered]@{type='pet-plugin-select';petId='moss'})
$after=Read-AuraPetIntent
$afterRaw=[IO.File]::ReadAllText($script:AuraPetIntentPath,[Text.UTF8Encoding]::new($false,$true))
$failureReceipt=$script:States[-1]
[ordered]@{
  launchCalls=$script:LaunchCalls
  successEnabled=[bool]$success.enabled
  successPet=$success.selectedPetId
  successAction=$successReceipt.action
  successOk=[bool]$successReceipt.ok
  failureUnchanged=($priorRaw -ceq $afterRaw -and [long]$after.revision -eq $priorRevision)
  failureEnabled=[bool]$after.enabled
  failurePet=$after.selectedPetId
  failureAction=$failureReceipt.action
  failureOk=[bool]$failureReceipt.ok
  failureError=$failureReceipt.error
} | ConvertTo-Json -Compress
`;
  await fs.writeFile(harnessPath, harness, "utf8");
  try {
    const result = spawnSync("powershell.exe", [
      "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", harnessPath,
    ], { cwd: PROJECT_ROOT, encoding: "utf8", windowsHide: true });
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    assert.deepEqual(JSON.parse(result.stdout.trim().split(/\r?\n/u).at(-1)), {
      launchCalls: 2,
      successEnabled: true,
      successPet: "pip",
      successAction: "select",
      successOk: true,
      failureUnchanged: true,
      failureEnabled: false,
      failurePet: "nori",
      failureAction: "select",
      failureOk: false,
      failureError: "companion-unavailable",
    });
  } finally {
    await fs.rm(temporaryRoot, { recursive: true, force: true });
  }
});

test("main pet actions expose localized dynamic visibility through one body-free model", async () => {
  const failures = [];
  const copy = await readHostCopy();
  for (const [locale, strings] of Object.entries(copy)) {
    for (const key of ["showPet", "hidePet", "petSettings"]) {
      if (typeof strings[key] !== "string" || !strings[key].trim()) failures.push(`${locale}.${key}`);
    }
  }

  if (process.platform === "win32") {
    const harness = `
$ErrorActionPreference='Stop'
$env:LOCALAPPDATA='${psPath(path.join(os.tmpdir(), "claude-aura-pet-model"))}'
$DataRoot='${psPath(path.join(os.tmpdir(), "claude-aura-pet-model-data"))}'
function Write-AuraUiLog { param([string]$Message) }
function Send-AuraTaskboardChanged { param([long]$Revision) }
function Refresh-AuraTaskboardQueue {}
. '${psPath(taskboardPath)}'
. '${psPath(petsHostPath)}'
$copy=[PSCustomObject][ordered]@{showPet='Show pet';hidePet='Hide pet';petSettings='Pet settings'}
$hidden=New-AuraPetIntentRevision -Current (New-AuraPetIntent) -Enabled $false -SelectedPetId 'nori'
$visible=New-AuraPetIntentRevision -Current $hidden -Enabled $true -SelectedPetId 'nori'
$hiddenModel=Get-AuraPetPluginMainActionModel -Intent $hidden -Copy $copy
$visibleModel=Get-AuraPetPluginMainActionModel -Intent $visible -Copy $copy
[ordered]@{hidden=$hiddenModel;visible=$visibleModel} | ConvertTo-Json -Depth 5 -Compress
`;
    const result = spawnSync("powershell.exe", [
      "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", harness,
    ], { cwd: PROJECT_ROOT, encoding: "utf8", windowsHide: true });
    if (result.status !== 0) failures.push(`model seam: ${result.stderr.trim().split(/\r?\n/u).at(-1)}`);
    else {
      const model = JSON.parse(result.stdout.trim().split(/\r?\n/u).at(-1));
      try {
        assert.deepEqual(model, {
          hidden: {
            visibilityText: "Show pet",
            visibilityRequest: { type: "pet-plugin-show" },
            settingsText: "Pet settings",
            settingsRequest: { type: "pet-plugin-open-settings" },
          },
          visible: {
            visibilityText: "Hide pet",
            visibilityRequest: { type: "pet-plugin-hide" },
            settingsText: "Pet settings",
            settingsRequest: { type: "pet-plugin-open-settings" },
          },
        });
      } catch (error) { failures.push(`model behavior: ${error.message}`); }
    }
  }
  assert.deepEqual(failures, []);
});

test("tray and Aura launcher wire both pet actions through the validated pet request seam", async () => {
  const source = await fs.readFile(uiPath, "utf8");
  for (const name of [
    "TrayPetVisibilityItem", "TrayPetSettingsItem",
    "LauncherPetVisibilityItem", "LauncherPetSettingsItem",
  ]) {
    assert.match(source, new RegExp(`\\$script:${name}\\s*=\\s*\\[System\\.Windows\\.Forms\\.ToolStripMenuItem\\]::new`));
  }
  assert.match(source, /function Update-AuraUiPetMainActions\b/u);
  assert.match(source, /Get-AuraPetPluginMainActionModel/u);
  assert.match(source, /Invoke-AuraPetPluginStudioRequest\s+-Message/u);
  assert.doesNotMatch(source, /Write-AuraPetIntent/u,
    "Aura chrome must use the existing validated request seam, not become a second writer");
});

test("Studio retains explicit Show Pet and Hide Pet controls on the same request seam", async () => {
  const [html, app, pets] = await Promise.all([
    fs.readFile(studioIndexPath, "utf8"),
    fs.readFile(studioAppPath, "utf8"),
    fs.readFile(petsScriptPath, "utf8"),
  ]);
  assert.match(html, /id="pet-show"/u);
  assert.match(html, /id="pet-hide"/u);
  assert.match(app, /"pet-plugin-show"/u);
  assert.match(app, /"pet-plugin-hide"/u);
  assert.match(pets, /show\.addEventListener\("click", \(\) => request\(\{ type: "pet-plugin-show" \}\)\)/u);
  assert.match(pets, /hide\.addEventListener\("click", \(\) => request\(\{ type: "pet-plugin-hide" \}\)\)/u);
});

runIfMain(import.meta.url);
