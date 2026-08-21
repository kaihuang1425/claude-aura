import { spawnSync } from "node:child_process";
import { test, runIfMain } from "./support/harness.mjs";
import {
  PROJECT_ROOT,
  assert,
  fs,
  os,
  path,
} from "./support/context.mjs";

const modulePath = path.join(PROJECT_ROOT, "windows", "aura-web-tabs.ps1");
const taskboardPath = path.join(PROJECT_ROOT, "windows", "aura-taskboard.ps1");
const uiPath = path.join(PROJECT_ROOT, "windows", "aura-ui.ps1");
const psPath = (value) => value.replaceAll("'", "''");

test("main Aura tab document v2 keeps Work Hub synthetic and migrates v1", async () => {
  if (process.platform !== "win32") return;
  const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "aura-web-tabs-"));
  const harnessPath = path.join(temporaryRoot, "web-tabs-harness.ps1");
  const harness = `
$ErrorActionPreference='Stop'
$DataRoot='${psPath(path.join(temporaryRoot, "data"))}'
function Write-AuraUiLog { param([string]$Message) }
function Send-AuraTaskboardChanged { param([long]$Revision) }
function Refresh-AuraTaskboardQueue {}
. '${psPath(taskboardPath)}'
. '${psPath(modulePath)}'
$newDocument=New-AuraWebTabDocument
$id='11111111-1111-4111-8111-111111111111'
$v1=[PSCustomObject][ordered]@{
  schemaVersion=1;revision=7;activeTabId=$id;tabs=@(
    [PSCustomObject][ordered]@{id=$id;title='Existing session';url='https://claude.ai/chat/existing';createdAt=123}
  )
}
$zero=$null
$zeroError=''
try {
  $zero=ConvertTo-AuraWebTabDocument -Value ([PSCustomObject][ordered]@{
    schemaVersion=2;revision=0;activeTabId=$null;tabs=@()
  })
} catch { $zeroError=$_.Exception.Message }
$migrated=$null
$migrationError=''
try { $migrated=ConvertTo-AuraWebTabDocument -Value $v1 }
catch { $migrationError=$_.Exception.Message }
$lastDocument=ConvertTo-AuraWebTabDocument -Value $v1
$closedLast=Remove-AuraWebTabDocument -Document $lastDocument -Id $id
[ordered]@{
  newSchema=$newDocument.schemaVersion
  newCount=@($newDocument.tabs).Count
  newActiveNull=($null -eq $newDocument.activeTabId)
  zeroAccepted=($null -ne $zero)
  zeroError=$zeroError
  zeroCount=if($null -eq $zero){-1}else{@($zero.tabs).Count}
  zeroActiveNull=($null -ne $zero -and $null -eq $zero.activeTabId)
  migratedSchema=if($null -eq $migrated){-1}else{$migrated.schemaVersion}
  migrationError=$migrationError
  migrationLossless=($null -ne $migrated -and @($migrated.tabs).Count -eq 1 -and
    [string]$migrated.activeTabId -ceq $id -and [string]$migrated.tabs[0].id -ceq $id -and
    [string]$migrated.tabs[0].title -ceq 'Existing session' -and
    [string]$migrated.tabs[0].url -ceq 'https://claude.ai/chat/existing' -and
    [long]$migrated.tabs[0].createdAt -eq 123)
  lastClose=$closedLast.Code
  lastCount=@($lastDocument.tabs).Count
  lastActiveNull=($null -eq $lastDocument.activeTabId)
} | ConvertTo-Json -Compress
`;
  await fs.writeFile(harnessPath, harness, "utf8");
  try {
    const result = spawnSync("powershell.exe", [
      "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", harnessPath,
    ], { cwd: PROJECT_ROOT, encoding: "utf8", windowsHide: true });
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    assert.deepEqual(JSON.parse(result.stdout.trim().split(/\r?\n/u).at(-1)), {
      newSchema: 2,
      newCount: 0,
      newActiveNull: true,
      zeroAccepted: true,
      zeroError: "",
      zeroCount: 0,
      zeroActiveNull: true,
      migratedSchema: 2,
      migrationError: "",
      migrationLossless: true,
      lastClose: "tab-closed",
      lastCount: 0,
      lastActiveNull: true,
    });
  } finally {
    await fs.rm(temporaryRoot, { recursive: true, force: true });
  }
});

test("main Aura tab strip models and selects a synthetic pinned Work Hub", async () => {
  if (process.platform !== "win32") return;
  const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "aura-work-hub-tab-"));
  const harnessPath = path.join(temporaryRoot, "work-hub-tab-harness.ps1");
  const harness = `
$ErrorActionPreference='Stop'
$DataRoot='${psPath(path.join(temporaryRoot, "data"))}'
function Write-AuraUiLog { param([string]$Message) }
function Send-AuraTaskboardChanged { param([long]$Revision) }
function Refresh-AuraTaskboardQueue {}
. '${psPath(taskboardPath)}'
. '${psPath(modulePath)}'
function Save-AuraWebTabs {}
function Refresh-AuraWebTabStrip {}
$firstId='11111111-1111-4111-8111-111111111111'
$secondId='22222222-2222-4222-8222-222222222222'
$document=ConvertTo-AuraWebTabDocument -Value ([PSCustomObject][ordered]@{
  schemaVersion=2;revision=5;activeTabId=$secondId;tabs=@(
    [PSCustomObject][ordered]@{id=$firstId;title='First';url='https://claude.ai/chat/first';createdAt=100},
    [PSCustomObject][ordered]@{id=$secondId;title='Second';url='https://claude.ai/code/second';createdAt=200}
  )
})
$beforeModel=$document|ConvertTo-Json -Depth 6 -Compress
$modelCommand=Get-Command Get-AuraWebTabStripModel -ErrorAction SilentlyContinue
$selectCommand=Get-Command Select-AuraWebTabWorkHubDocument -ErrorAction SilentlyContinue
$model=@()
if($null -ne $modelCommand){$model=@(Get-AuraWebTabStripModel -Document $document)}
$afterModel=$document|ConvertTo-Json -Depth 6 -Compress
$firstRevision=-1L
$secondRevision=-1L
if($null -ne $selectCommand){
  [void](Select-AuraWebTabWorkHubDocument -Document $document)
  $firstRevision=[long]$document.revision
  [void](Select-AuraWebTabWorkHubDocument -Document $document)
  $secondRevision=[long]$document.revision
}
$workHubActiveNull=($null -eq $document.activeTabId)
$script:AuraWebTabDocument=$document
$selected=Set-AuraWebTabActiveDocument -Id $firstId
[ordered]@{
  modelAvailable=($null -ne $modelCommand)
  selectAvailable=($null -ne $selectCommand)
  model=@($model|ForEach-Object{[ordered]@{
    id=[string]$_.Id;kind=[string]$_.Kind;closable=[bool]$_.Closable;selected=[bool]$_.Selected
  }})
  modelReadOnly=($beforeModel -ceq $afterModel)
  persistedCount=@($document.tabs).Count
  workHubActiveNull=$workHubActiveNull
  firstRevision=$firstRevision
  secondRevision=$secondRevision
  userSelected=($null -ne $selected -and [string]$document.activeTabId -ceq $firstId)
  userRevision=[long]$document.revision
} | ConvertTo-Json -Depth 7 -Compress
`;
  await fs.writeFile(harnessPath, harness, "utf8");
  try {
    const result = spawnSync("powershell.exe", [
      "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", harnessPath,
    ], { cwd: PROJECT_ROOT, encoding: "utf8", windowsHide: true });
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    const actual = JSON.parse(result.stdout.trim().split(/\r?\n/u).at(-1));
    const source = await fs.readFile(modulePath, "utf8");
    actual.stripCallsWorkHubSelection = /Select-AuraWebTabWorkHubDocument -Document \$script:AuraWebTabDocument/u.test(source);
    actual.stripGuardsCloseButton = /if \(\$item\.Closable\)[\s\S]{0,500}?\$close/u.test(source);
    assert.deepEqual(actual, {
      modelAvailable: true,
      selectAvailable: true,
      model: [
        { id: "work-hub", kind: "work-hub", closable: false, selected: false },
        { id: "11111111-1111-4111-8111-111111111111", kind: "user", closable: true, selected: false },
        { id: "22222222-2222-4222-8222-222222222222", kind: "user", closable: true, selected: true },
      ],
      modelReadOnly: true,
      persistedCount: 2,
      workHubActiveNull: true,
      firstRevision: 6,
      secondRevision: 6,
      userSelected: true,
      userRevision: 7,
      stripCallsWorkHubSelection: true,
      stripGuardsCloseButton: true,
    });
  } finally {
    await fs.rm(temporaryRoot, { recursive: true, force: true });
  }
});

test("main Aura tabs initialize persisted Work Hub state without bootstrapping or null dereference", async () => {
  if (process.platform !== "win32") return;
  const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "aura-work-hub-init-"));
  const harnessPath = path.join(temporaryRoot, "work-hub-init-harness.ps1");
  const harness = `
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
$DataRoot='${psPath(path.join(temporaryRoot, "data"))}'
function Write-AuraUiLog { param([string]$Message) }
function Send-AuraTaskboardChanged { param([long]$Revision) }
function Refresh-AuraTaskboardQueue {}
. '${psPath(taskboardPath)}'
. '${psPath(modulePath)}'
$script:UiCopy=[PSCustomObject]@{newTab='New tab';closeTab='Close tab'}
$script:Fixture=$null
function Read-AuraWebTabDocument { return ConvertTo-AuraWebTabDocument -Value $script:Fixture }
function Save-AuraWebTabs {}
function Invoke-AuraWorkHubInitializationFixture {
  param([Parameter(Mandatory=$true)][object]$Fixture)
  $script:Fixture=$Fixture
  $script:Form=[System.Windows.Forms.Form]::new()
  $content=[System.Windows.Forms.Panel]::new()
  [void]$script:Form.Controls.Add($content)
  $initialView=[PSCustomObject]@{IsDisposed=$false}
  $errorMessage=''
  try {
    [void](Initialize-AuraWebTabs -ContentPanel $content -InitialWebView $initialView -InitialUrl 'https://claude.ai/new')
  } catch { $errorMessage=$_.Exception.Message }
  $workHubVariable=Get-Variable -Name AuraWebTabWorkHubControl -Scope Script -ErrorAction SilentlyContinue
  $workHub=if($null-eq$workHubVariable){$null}else{$workHubVariable.Value}
  $result=[PSCustomObject][ordered]@{
    error=$errorMessage
    count=if($null-eq$script:AuraWebTabDocument){-1}else{@($script:AuraWebTabDocument.tabs).Count}
    activeNull=($null-ne$script:AuraWebTabDocument-and$null-eq$script:AuraWebTabDocument.activeTabId)
    workHubOwned=($null-ne$workHub-and$workHub.Parent-eq$content-and[string]$workHub.Tag-ceq'work-hub')
  }
  if($null-ne$script:AuraWebTabStrip-and-not$script:AuraWebTabStrip.IsDisposed){$script:AuraWebTabStrip.Dispose()}
  $script:Form.Dispose()
  $script:AuraWebTabRuntime=@{}
  return $result
}
$empty=Invoke-AuraWorkHubInitializationFixture -Fixture ([PSCustomObject][ordered]@{
  schemaVersion=2;revision=4;activeTabId=$null;tabs=@()
})
$id='11111111-1111-4111-8111-111111111111'
$withUser=Invoke-AuraWorkHubInitializationFixture -Fixture ([PSCustomObject][ordered]@{
  schemaVersion=2;revision=5;activeTabId=$null;tabs=@(
    [PSCustomObject][ordered]@{id=$id;title='Mounted later';url='https://claude.ai/chat/mounted-later';createdAt=100}
  )
})
[ordered]@{empty=$empty;withUser=$withUser}|ConvertTo-Json -Depth 6 -Compress
`;
  await fs.writeFile(harnessPath, harness, "utf8");
  try {
    const result = spawnSync("powershell.exe", [
      "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", harnessPath,
    ], { cwd: PROJECT_ROOT, encoding: "utf8", windowsHide: true });
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    assert.deepEqual(JSON.parse(result.stdout.trim().split(/\r?\n/u).at(-1)), {
      empty: { error: "", count: 0, activeNull: true, workHubOwned: true },
      withUser: { error: "", count: 1, activeNull: true, workHubOwned: true },
    });
  } finally {
    await fs.rm(temporaryRoot, { recursive: true, force: true });
  }
});

test("main Aura runtime transitions mounted WebViews through the pinned Work Hub", async () => {
  if (process.platform !== "win32") return;
  const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "aura-work-hub-runtime-"));
  const harnessPath = path.join(temporaryRoot, "work-hub-runtime-harness.ps1");
  const harness = `
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
$DataRoot='${psPath(path.join(temporaryRoot, "data"))}'
function Write-AuraUiLog { param([string]$Message) }
function Send-AuraTaskboardChanged { param([long]$Revision) }
function Refresh-AuraTaskboardQueue {}
. '${psPath(taskboardPath)}'
. '${psPath(modulePath)}'
$script:UiCopy=[PSCustomObject]@{newTab='New tab';closeTab='Close tab';openingClaude='Opening Claude'}
$id='11111111-1111-4111-8111-111111111111'
$script:Fixture=[PSCustomObject][ordered]@{
  schemaVersion=2;revision=5;activeTabId=$id;tabs=@(
    [PSCustomObject][ordered]@{id=$id;title='Current';url='https://claude.ai/chat/current';createdAt=100}
  )
}
function Read-AuraWebTabDocument { return ConvertTo-AuraWebTabDocument -Value $script:Fixture }
$script:SaveCount=0
function Save-AuraWebTabs { $script:SaveCount+=1 }
function New-FakeAuraControl {
  param([bool]$InitiallyVisible)
  $control=[PSCustomObject]@{
    IsDisposed=$false;Visible=$InitiallyVisible;HideCount=0;ShowCount=0;FrontCount=0;DisposeCount=0
    Source=[Uri]'https://claude.ai/chat/current';CoreWebView2=[PSCustomObject]@{DocumentTitle='Current'}
  }
  $control|Add-Member ScriptMethod Hide {$this.Visible=$false;$this.HideCount+=1}
  $control|Add-Member ScriptMethod Show {$this.Visible=$true;$this.ShowCount+=1}
  $control|Add-Member ScriptMethod BringToFront {$this.FrontCount+=1}
  $control|Add-Member ScriptMethod Dispose {$this.IsDisposed=$true;$this.DisposeCount+=1}
  return $control
}
$userView=New-FakeAuraControl -InitiallyVisible $true
$workHubView=New-FakeAuraControl -InitiallyVisible $false
$script:Form=[System.Windows.Forms.Form]::new()
$content=[System.Windows.Forms.Panel]::new()
[void]$script:Form.Controls.Add($content)
$script:OriginalRefresh=(Get-Command Refresh-AuraWebTabStrip).ScriptBlock
$script:RefreshCount=0
function Refresh-AuraWebTabStrip {$script:RefreshCount+=1;&$script:OriginalRefresh}
[void](Initialize-AuraWebTabs -ContentPanel $content -InitialWebView $userView -InitialUrl 'https://claude.ai/new')
$script:AuraWebTabWorkHubControl=$workHubView
$script:RefreshCount=0
$script:SaveCount=0
$workHubButton=$script:AuraWebTabList.Controls[0].Controls[0]
$onClick=[System.Windows.Forms.Button].GetMethod('OnClick',
  [Reflection.BindingFlags]::Instance-bor[Reflection.BindingFlags]::NonPublic)
[void]$onClick.Invoke($workHubButton,@([EventArgs]::Empty))
$afterHub=[PSCustomObject][ordered]@{
  activeNull=($null-eq$script:AuraWebTabDocument.activeTabId)
  saved=($script:SaveCount-eq1)
  refreshed=($script:RefreshCount-eq1)
  userHidden=($userView.HideCount-eq1-and-not$userView.IsDisposed)
  workHubShown=($workHubView.ShowCount-eq1-and$workHubView.FrontCount-eq1)
}
[void](Set-AuraWebTabActiveDocument -Id '11111111-1111-4111-8111-111111111111')
$afterUser=[PSCustomObject][ordered]@{
  selected=([string]$script:AuraWebTabDocument.activeTabId-ceq'11111111-1111-4111-8111-111111111111')
  userMounted=(-not$userView.IsDisposed)
}
$closeResult=Remove-AuraWebTabRuntime -Id '11111111-1111-4111-8111-111111111111'
$afterClose=[PSCustomObject][ordered]@{
  closed=([string]$closeResult.Code-ceq'tab-closed')
  count=@($script:AuraWebTabDocument.tabs).Count
  activeNull=($null-eq$script:AuraWebTabDocument.activeTabId)
  userDisposed=$userView.IsDisposed
  workHubShownAgain=($workHubView.ShowCount-eq2-and$workHubView.FrontCount-eq2)
}
[ordered]@{afterHub=$afterHub;afterUser=$afterUser;afterClose=$afterClose}|ConvertTo-Json -Depth 6 -Compress
`;
  await fs.writeFile(harnessPath, harness, "utf8");
  try {
    const result = spawnSync("powershell.exe", [
      "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", harnessPath,
    ], { cwd: PROJECT_ROOT, encoding: "utf8", windowsHide: true });
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    const actual = JSON.parse(result.stdout.trim().split(/\r?\n/u).at(-1));
    const ui = await fs.readFile(uiPath, "utf8");
    const activeStart = ui.indexOf("function Set-AuraUiActiveWebTab");
    const activeEnd = ui.indexOf("function Request-AuraUiSelectWebTab", activeStart);
    const activeSource = ui.slice(activeStart, activeEnd);
    actual.afterUser.userTransitionWired = /\.Hide\(\)[\s\S]*?Ensure-AuraWebTabView[\s\S]*?\.Show\(\)[\s\S]*?\.BringToFront\(\)/u.test(activeSource)
      && !/\.Dispose\(\)/u.test(activeSource);
    actual.afterUser.workHubHideWired = /AuraWebTabWorkHubControl[\s\S]{0,240}?\.Hide\(\)/u.test(activeSource);
    assert.deepEqual(actual, {
      afterHub: {
        activeNull: true, saved: true, refreshed: true, userHidden: true, workHubShown: true,
      },
      afterUser: {
        selected: true, userMounted: true, userTransitionWired: true, workHubHideWired: true,
      },
      afterClose: { closed: true, count: 0, activeNull: true, userDisposed: true, workHubShownAgain: true },
    });
  } finally {
    await fs.rm(temporaryRoot, { recursive: true, force: true });
  }
});

test("Work Hub startup defers its standby WebView and later opens the saved user URL", async () => {
  if (process.platform !== "win32") return;
  const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "aura-work-hub-standby-"));
  const harnessPath = path.join(temporaryRoot, "work-hub-standby-harness.ps1");
  const harness = `
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
$DataRoot='${psPath(path.join(temporaryRoot, "data"))}'
function Write-AuraUiLog { param([string]$Message) }
function Send-AuraTaskboardChanged { param([long]$Revision) }
function Refresh-AuraTaskboardQueue {}
. '${psPath(taskboardPath)}'
. '${psPath(modulePath)}'
$id='11111111-1111-4111-8111-111111111111'
$script:Fixture=[PSCustomObject][ordered]@{
  schemaVersion=2;revision=5;activeTabId=$null;tabs=@(
    [PSCustomObject][ordered]@{id=$id;title='Saved code';url='https://claude.ai/code/saved-code';createdAt=100}
  )
}
function Read-AuraWebTabDocument { return ConvertTo-AuraWebTabDocument -Value $script:Fixture }
function Save-AuraWebTabs {}
$script:LoadingPanel=[PSCustomObject]@{Visible=$true;HideCount=0}
function Hide-AuraUiLoading {$script:LoadingPanel.Visible=$false;$script:LoadingPanel.HideCount+=1}
function Show-AuraUiLoading {param([string]$Message)$script:LoadingPanel.Visible=$true}
function New-FakeStandbyView {
  $view=[PSCustomObject]@{
    IsDisposed=$false;HideCount=0;ShowCount=0;FrontCount=0;DisposeCount=0
    EnsureCount=0;NavigateCount=0;Source=$null;CoreWebView2=$null
  }
  $view|Add-Member ScriptMethod Hide {$this.HideCount+=1}
  $view|Add-Member ScriptMethod Show {$this.ShowCount+=1}
  $view|Add-Member ScriptMethod BringToFront {$this.FrontCount+=1}
  $view|Add-Member ScriptMethod Dispose {$this.IsDisposed=$true;$this.DisposeCount+=1}
  $view|Add-Member ScriptMethod EnsureCoreWebView2Async {param($environment)$this.EnsureCount+=1;return [PSCustomObject]@{}}
  $view|Add-Member ScriptMethod Navigate {param($url)$this.NavigateCount+=1;$this.Source=[Uri]$url}
  return $view
}
$standby=New-FakeStandbyView
$script:UiCopy=[PSCustomObject]@{newTab='New tab';closeTab='Close tab';openingClaude='Opening Claude'}
$script:Form=[System.Windows.Forms.Form]::new()
$content=[System.Windows.Forms.Panel]::new()
[void]$script:Form.Controls.Add($content)
[void](Initialize-AuraWebTabs -ContentPanel $content -InitialWebView $standby -InitialUrl 'https://claude.ai/new')
$ownedWorkHub=$script:AuraWebTabWorkHubControl
$startup=[PSCustomObject][ordered]@{
  activeNull=($null-eq$script:AuraWebTabDocument.activeTabId)
  ensureDeferred=($standby.EnsureCount-eq0)
  navigationDeferred=($standby.NavigateCount-eq0)
  loadingHidden=(-not$script:LoadingPanel.Visible)
  workHubFront=($null-ne$ownedWorkHub-and$content.Controls.GetChildIndex($ownedWorkHub)-eq0)
}
$uiSource=Get-Content -LiteralPath '${psPath(uiPath)}' -Raw
$tokens=$null;$parseErrors=$null
$ast=[System.Management.Automation.Language.Parser]::ParseInput($uiSource,[ref]$tokens,[ref]$parseErrors)
foreach($name in @('Start-AuraUiWebTabCore','Set-AuraUiActiveWebTab')){
  $definition=@($ast.FindAll({param($node)$node-is[System.Management.Automation.Language.FunctionDefinitionAst]-and$node.Name-ceq$name},$true))[0]
  Invoke-Expression $definition.Extent.Text
}
function Test-AuraUiClaudeUri { return $true }
function Set-AuraUiPreferredColorScheme {}
function Start-AuraUiDocumentPrepaintRegistration {}
function Get-AuraUiEnabled { return $true }
function Apply-AuraUiTheme {}
function Request-AuraUiContextMirror {}
function Request-AuraUiLauncherLayoutProbe {}
$script:WebViewEnvironment=[PSCustomObject]@{}
$script:WebReady=$false;$script:PageReady=$false;$script:WebView=$standby
$script:PrepaintScriptId=$null;$script:PrepaintRegisteredGeneration=-1L;$script:PrepaintGeneration=0L
[void](Set-AuraUiActiveWebTab -Id '11111111-1111-4111-8111-111111111111')
$selected=[PSCustomObject][ordered]@{
  ensureStarted=($standby.EnsureCount-eq1)
  savedUrl=((Get-AuraWebTabInitialUrl -Fallback 'https://claude.ai/new')-ceq'https://claude.ai/code/saved-code')
  fallbackAvoided=((Get-AuraWebTabInitialUrl -Fallback 'https://claude.ai/new')-cne'https://claude.ai/new')
}
$loadedWorkHub=New-FakeStandbyView
$script:AuraWebTabWorkHubControl=$loadedWorkHub
$standby.CoreWebView2=[PSCustomObject]@{DocumentTitle='Saved code'}
$script:LoadingPanel.Visible=$true
[void](Set-AuraWebTabWorkHubActive)
$returned=[PSCustomObject][ordered]@{
  loadingHidden=(-not$script:LoadingPanel.Visible)
  userHidden=($standby.HideCount-gt0)
  userUndisposed=(-not$standby.IsDisposed)
  workHubShown=($loadedWorkHub.ShowCount-eq1-and$loadedWorkHub.FrontCount-eq1)
}
[ordered]@{startup=$startup;selected=$selected;returned=$returned}|ConvertTo-Json -Depth 6 -Compress
`;
  await fs.writeFile(harnessPath, harness, "utf8");
  try {
    const result = spawnSync("powershell.exe", [
      "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", harnessPath,
    ], { cwd: PROJECT_ROOT, encoding: "utf8", windowsHide: true });
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    const actual = JSON.parse(result.stdout.trim().split(/\r?\n/u).at(-1));
    const ui = await fs.readFile(uiPath, "utf8");
    const environmentStart = ui.indexOf("if ($null -ne $script:EnvironmentTask");
    const environmentEnd = ui.indexOf("if ($null -ne $script:StudioEnsureTask", environmentStart);
    const environmentSource = ui.slice(environmentStart, environmentEnd);
    actual.startupEnsureGuarded = /activeTabId|Test-AuraWebTabProviderActivationRequired/u.test(environmentSource);
    actual.loadingCoverNotForcedFront = !/Initialize-AuraWebTabs[\s\S]{0,260}?\$script:LoadingPanel\.BringToFront\(\)/u.test(ui);
    assert.deepEqual(actual, {
      startup: {
        activeNull: true, ensureDeferred: true, navigationDeferred: true,
        loadingHidden: true, workHubFront: true,
      },
      selected: { ensureStarted: true, savedUrl: true, fallbackAvoided: true },
      returned: { loadingHidden: true, userHidden: true, userUndisposed: true, workHubShown: true },
      startupEnsureGuarded: true,
      loadingCoverNotForcedFront: true,
    });
  } finally {
    await fs.rm(temporaryRoot, { recursive: true, force: true });
  }
});

test("tab keyboard navigation includes Work Hub and numbered synthetic positions", async () => {
  if (process.platform !== "win32") return;
  const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "aura-work-hub-keys-"));
  const harnessPath = path.join(temporaryRoot, "work-hub-keys-harness.ps1");
  const harness = `
$ErrorActionPreference='Stop'
$DataRoot='${psPath(path.join(temporaryRoot, "data"))}'
function Write-AuraUiLog { param([string]$Message) }
function Send-AuraTaskboardChanged { param([long]$Revision) }
function Refresh-AuraTaskboardQueue {}
. '${psPath(taskboardPath)}'
. '${psPath(modulePath)}'
$uiSource=Get-Content -LiteralPath '${psPath(uiPath)}' -Raw
$tokens=$null;$parseErrors=$null
$ast=[System.Management.Automation.Language.Parser]::ParseInput($uiSource,[ref]$tokens,[ref]$parseErrors)
foreach($name in @('Request-AuraUiCycleWebTab','Request-AuraUiCloseWebTab')){
  $definition=@($ast.FindAll({param($node)$node-is[System.Management.Automation.Language.FunctionDefinitionAst]-and$node.Name-ceq$name},$true))[0]
  Invoke-Expression $definition.Extent.Text
}
function Test-AuraUiWebTabTransitionAllowed { return $true }
function Save-AuraWebTabRuntimeState {}
$script:Selections=@()
function Request-AuraUiSelectWebTab {param([string]$Id)$script:Selections+=$Id;return $true}
function Set-AuraWebTabWorkHubActive {$script:Selections+='work-hub';return $true}
$first='11111111-1111-4111-8111-111111111111'
$last='22222222-2222-4222-8222-222222222222'
function New-KeyDocument {
  param([AllowNull()][object]$Active,[switch]$One)
  $tabs=@([PSCustomObject][ordered]@{id=$first;title='First';url='https://claude.ai/chat/first';createdAt=1})
  if(-not$One){$tabs+=([PSCustomObject][ordered]@{id=$last;title='Last';url='https://claude.ai/code/last';createdAt=2})}
  return ConvertTo-AuraWebTabDocument -Value ([PSCustomObject][ordered]@{
    schemaVersion=2;revision=1;activeTabId=$Active;tabs=$tabs
  })
}
function Invoke-CycleCase {
  param([AllowNull()][object]$Active,[switch]$Reverse,[switch]$One)
  $script:AuraWebTabDocument=New-KeyDocument -Active $Active -One:$One
  $script:Selections=@()
  [void](Request-AuraUiCycleWebTab -Reverse:$Reverse)
  if($script:Selections.Count -eq 0){ return '' }
  return [string]$script:Selections[-1]
}
$cycles=[ordered]@{
  oneForwardFromHub=Invoke-CycleCase -Active $null -One
  oneReverseFromHub=Invoke-CycleCase -Active $null -Reverse -One
  oneForwardFromUser=Invoke-CycleCase -Active $first -One
  twoForwardFromHub=Invoke-CycleCase -Active $null
  twoReverseFromHub=Invoke-CycleCase -Active $null -Reverse
}
$ordinalCommand=Get-Command Request-AuraUiSelectWebTabByOrdinal -ErrorAction SilentlyContinue
$script:AuraWebTabDocument=New-KeyDocument -Active $null
$script:Selections=@()
if($null-ne$ordinalCommand){
  Request-AuraUiSelectWebTabByOrdinal -Ordinal 1
  Request-AuraUiSelectWebTabByOrdinal -Ordinal 2
  Request-AuraUiSelectWebTabByOrdinal -Ordinal 9
}
$ordinalSelections=@($script:Selections)
$script:AuraWebTabDocument=New-KeyDocument -Active $null
$beforeClose=$script:AuraWebTabDocument|ConvertTo-Json -Depth 6 -Compress
$closeError=''
try { Request-AuraUiCloseWebTab } catch { $closeError=$_.Exception.Message }
$afterClose=$script:AuraWebTabDocument|ConvertTo-Json -Depth 6 -Compress
[ordered]@{
  cycles=$cycles
  ordinalAvailable=($null-ne$ordinalCommand)
  ordinalSelections=$ordinalSelections
  workHubCloseError=$closeError
  workHubCloseNoOp=($beforeClose-ceq$afterClose)
}|ConvertTo-Json -Depth 6 -Compress
`;
  await fs.writeFile(harnessPath, harness, "utf8");
  try {
    const result = spawnSync("powershell.exe", [
      "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", harnessPath,
    ], { cwd: PROJECT_ROOT, encoding: "utf8", windowsHide: true });
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    const actual = JSON.parse(result.stdout.trim().split(/\r?\n/u).at(-1));
    const ui = await fs.readFile(uiPath, "utf8");
    actual.numberKeysWired = /0x31[\s\S]*?Request-AuraUiSelectWebTabByOrdinal[\s\S]*?0x32[\s\S]*?0x39/u.test(ui);
    assert.deepEqual(actual, {
      cycles: {
        oneForwardFromHub: "11111111-1111-4111-8111-111111111111",
        oneReverseFromHub: "11111111-1111-4111-8111-111111111111",
        oneForwardFromUser: "work-hub",
        twoForwardFromHub: "11111111-1111-4111-8111-111111111111",
        twoReverseFromHub: "22222222-2222-4222-8222-222222222222",
      },
      ordinalAvailable: true,
      ordinalSelections: [
        "work-hub",
        "11111111-1111-4111-8111-111111111111",
        "22222222-2222-4222-8222-222222222222",
      ],
      workHubCloseError: "",
      workHubCloseNoOp: true,
      numberKeysWired: true,
    });
  } finally {
    await fs.rm(temporaryRoot, { recursive: true, force: true });
  }
});

test("native tab focus routes Form shortcuts without duplicating provider accelerators", async () => {
  if (process.platform !== "win32") return;
  const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "aura-native-tab-keys-"));
  const harnessPath = path.join(temporaryRoot, "native-tab-keys-harness.ps1");
  const harness = `
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Windows.Forms
$DataRoot='${psPath(path.join(temporaryRoot, "data"))}'
function Write-AuraUiLog { param([string]$Message) }
function Send-AuraTaskboardChanged { param([long]$Revision) }
function Refresh-AuraTaskboardQueue {}
. '${psPath(taskboardPath)}'
. '${psPath(modulePath)}'
$uiSource=Get-Content -LiteralPath '${psPath(uiPath)}' -Raw
$tokens=$null;$parseErrors=$null
$ast=[System.Management.Automation.Language.Parser]::ParseInput($uiSource,[ref]$tokens,[ref]$parseErrors)
$closeDefinition=@($ast.FindAll({param($node)
  $node-is[System.Management.Automation.Language.FunctionDefinitionAst]-and
    $node.Name-ceq'Request-AuraUiCloseWebTab'
},$true))[0]
Invoke-Expression $closeDefinition.Extent.Text
$registrationDefinition=@($ast.FindAll({param($node)
  $node-is[System.Management.Automation.Language.FunctionDefinitionAst]-and
    $node.Name-ceq'Register-AuraUiNativeTabAccelerators'
},$true))[0]
$registrationAvailable=$null-ne$registrationDefinition
if($registrationAvailable){ Invoke-Expression $registrationDefinition.Extent.Text }
$id='11111111-1111-4111-8111-111111111111'
$script:AuraWebTabDocument=ConvertTo-AuraWebTabDocument -Value ([PSCustomObject][ordered]@{
  schemaVersion=2;revision=1;activeTabId=$null;tabs=@(
    [PSCustomObject][ordered]@{id=$id;title='Saved';url='https://claude.ai/chat/saved';createdAt=1}
  )
})
$script:AuraWebTabRuntime=@{}
$script:Actions=[Collections.Generic.List[string]]::new()
$script:RemoveCount=0
function Test-AuraUiWebTabTransitionAllowed { return $true }
function Save-AuraWebTabRuntimeState {}
function Remove-AuraWebTabRuntime {param([string]$Id)$script:RemoveCount+=1;return[PSCustomObject]@{Ok=$true;ActiveTabId=$null}}
function Request-AuraUiNewWebTab {[void]$script:Actions.Add('new');return $true}
function Request-AuraUiCycleWebTab {param([switch]$Reverse)
  [void]$script:Actions.Add($(if($Reverse){'cycle-reverse'}else{'cycle-forward'}))
}
function Request-AuraUiSelectWebTabByOrdinal {param([int]$Ordinal)
  [void]$script:Actions.Add("ordinal-$Ordinal");return $true
}
$script:WebView=[PSCustomObject]@{ContainsFocus=$false}
$form=[System.Windows.Forms.Form]::new()
$onKeyDown=$form.GetType().GetMethod('OnKeyDown',[Reflection.BindingFlags]'Instance,NonPublic')
function Send-NativeKey {
  param([System.Windows.Forms.Keys]$KeyData)
  $eventArgs=[System.Windows.Forms.KeyEventArgs]::new($KeyData)
  [void]$onKeyDown.Invoke($form,[object[]]@($eventArgs))
  return [PSCustomObject]@{Handled=$eventArgs.Handled;Suppressed=$eventArgs.SuppressKeyPress}
}
$nativeResults=@()
if($registrationAvailable){
  Register-AuraUiNativeTabAccelerators -Form $form
  $nativeResults+=Send-NativeKey -KeyData ([System.Windows.Forms.Keys]::Control-bor[System.Windows.Forms.Keys]::T)
  $nativeResults+=Send-NativeKey -KeyData ([System.Windows.Forms.Keys]::Control-bor[System.Windows.Forms.Keys]::W)
  $nativeResults+=Send-NativeKey -KeyData ([System.Windows.Forms.Keys]::Control-bor[System.Windows.Forms.Keys]::Tab)
  $nativeResults+=Send-NativeKey -KeyData ([System.Windows.Forms.Keys]::Control-bor[System.Windows.Forms.Keys]::Shift-bor[System.Windows.Forms.Keys]::Tab)
  foreach($key in [int][System.Windows.Forms.Keys]::D1..[int][System.Windows.Forms.Keys]::D9){
    $nativeResults+=Send-NativeKey -KeyData ([System.Windows.Forms.Keys]([int][System.Windows.Forms.Keys]::Control-bor$key))
  }
}
$beforeProvider=$script:Actions.Count
$script:WebView.ContainsFocus=$true
$providerResult=if($registrationAvailable){
  Send-NativeKey -KeyData ([System.Windows.Forms.Keys]::Control-bor[System.Windows.Forms.Keys]::T)
}else{[PSCustomObject]@{Handled=$false;Suppressed=$false}}
[ordered]@{
  registrationAvailable=$registrationAvailable
  keyPreview=$form.KeyPreview
  actions=@($script:Actions)
  allNativeHandled=($nativeResults.Count-eq13-and@($nativeResults|Where-Object{-not$_.Handled}).Count-eq0)
  workHubCloseNoOp=($script:RemoveCount-eq0-and$null-eq$script:AuraWebTabDocument.activeTabId)
  providerIgnored=($script:Actions.Count-eq$beforeProvider-and-not$providerResult.Handled)
}|ConvertTo-Json -Depth 6 -Compress
`;
  await fs.writeFile(harnessPath, harness, "utf8");
  try {
    const result = spawnSync("powershell.exe", [
      "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", harnessPath,
    ], { cwd: PROJECT_ROOT, encoding: "utf8", windowsHide: true });
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    const actual = JSON.parse(result.stdout.trim().split(/\r?\n/u).at(-1));
    const ui = await fs.readFile(uiPath, "utf8");
    actual.formWiring = /Register-AuraUiNativeTabAccelerators\s+-Form\s+\$script:Form/u.test(ui)
      && /\.KeyPreview\s*=\s*\$true[\s\S]*?\.add_KeyDown/u.test(ui);
    actual.providerFocusGate = /ContainsFocus|Test-AuraUiProviderWebViewOwnsFocus/u.test(ui);
    assert.deepEqual(actual, {
      registrationAvailable: true,
      keyPreview: true,
      actions: [
        "new", "cycle-forward", "cycle-reverse",
        "ordinal-1", "ordinal-2", "ordinal-3", "ordinal-4", "ordinal-5",
        "ordinal-6", "ordinal-7", "ordinal-8", "ordinal-9",
      ],
      allNativeHandled: true,
      workHubCloseNoOp: true,
      providerIgnored: true,
      formWiring: true,
      providerFocusGate: true,
    });
  } finally {
    await fs.rm(temporaryRoot, { recursive: true, force: true });
  }
});

test("middle-click closes user tabs but never the pinned Work Hub", async () => {
  if (process.platform !== "win32") return;
  const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "aura-tab-middle-click-"));
  const harnessPath = path.join(temporaryRoot, "tab-middle-click-harness.ps1");
  const harness = `
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
$DataRoot='${psPath(path.join(temporaryRoot, "data"))}'
function Write-AuraUiLog { param([string]$Message) }
function Send-AuraTaskboardChanged { param([long]$Revision) }
function Refresh-AuraTaskboardQueue {}
. '${psPath(taskboardPath)}'
. '${psPath(modulePath)}'
$id='11111111-1111-4111-8111-111111111111'
$script:Fixture=[PSCustomObject][ordered]@{
  schemaVersion=2;revision=1;activeTabId=$id;tabs=@(
    [PSCustomObject][ordered]@{id=$id;title='Saved';url='https://claude.ai/chat/saved';createdAt=1}
  )
}
function Read-AuraWebTabDocument { return ConvertTo-AuraWebTabDocument -Value $script:Fixture }
function Save-AuraWebTabs {}
$script:Closed=[Collections.Generic.List[string]]::new()
function Request-AuraUiCloseWebTab {param([string]$Id)[void]$script:Closed.Add($Id)}
function Request-AuraUiSelectWebTab {param([string]$Id)}
$standby=[PSCustomObject]@{IsDisposed=$false}
$standby|Add-Member ScriptMethod Hide {}
$standby|Add-Member ScriptMethod Dispose {$this.IsDisposed=$true}
$script:UiCopy=[PSCustomObject]@{newTab='New tab';closeTab='Close tab'}
$script:Form=[System.Windows.Forms.Form]::new()
$content=[System.Windows.Forms.Panel]::new()
[void]$script:Form.Controls.Add($content)
Initialize-AuraWebTabs -ContentPanel $content -InitialWebView $standby -InitialUrl 'https://claude.ai/'
function Get-NativeSelectButton {
  param([string]$Tag)
  foreach($container in @($script:AuraWebTabList.Controls)){
    foreach($control in @($container.Controls)){
      if($control-is[System.Windows.Forms.Button]-and[string]$control.Tag-ceq$Tag-and
          $control.Text-cne[string][char]0x00D7){ return $control }
    }
  }
  return $null
}
$userButton=Get-NativeSelectButton -Tag $id
$workHubButton=Get-NativeSelectButton -Tag 'work-hub'
$middleArgs=[System.Windows.Forms.MouseEventArgs]::new(
  [System.Windows.Forms.MouseButtons]::Middle,1,4,4,0)
$raiseUser=$userButton.GetType().GetMethod('OnMouseUp',[Reflection.BindingFlags]'Instance,NonPublic')
$raiseHub=$workHubButton.GetType().GetMethod('OnMouseUp',[Reflection.BindingFlags]'Instance,NonPublic')
[void]$raiseUser.Invoke($userButton,[object[]]@($middleArgs))
$afterUser=@($script:Closed)
[void]$raiseHub.Invoke($workHubButton,[object[]]@($middleArgs))
[ordered]@{
  controlsFound=($null-ne$userButton-and$null-ne$workHubButton)
  afterUser=$afterUser
  afterWorkHub=@($script:Closed)
}|ConvertTo-Json -Depth 5 -Compress
`;
  await fs.writeFile(harnessPath, harness, "utf8");
  try {
    const result = spawnSync("powershell.exe", [
      "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", harnessPath,
    ], { cwd: PROJECT_ROOT, encoding: "utf8", windowsHide: true });
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    const actual = JSON.parse(result.stdout.trim().split(/\r?\n/u).at(-1));
    const module = await fs.readFile(modulePath, "utf8");
    const stripStart = module.indexOf("function Refresh-AuraWebTabStrip");
    const stripEnd = module.indexOf("function Save-AuraWebTabs", stripStart);
    const stripSource = module.slice(stripStart, stripEnd);
    actual.middleMouseWired = /add_MouseUp/u.test(stripSource)
      && /MouseButtons\]::Middle/u.test(stripSource);
    assert.deepEqual(actual, {
      controlsFound: true,
      afterUser: ["11111111-1111-4111-8111-111111111111"],
      afterWorkHub: ["11111111-1111-4111-8111-111111111111"],
      middleMouseWired: true,
    });
  } finally {
    await fs.rm(temporaryRoot, { recursive: true, force: true });
  }
});

test("tab display titles preserve multilingual graphemes and truncate safely", async () => {
  if (process.platform !== "win32") return;
  const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "aura-tab-title-unicode-"));
  const harnessPath = path.join(temporaryRoot, "tab-title-unicode-harness.ps1");
  const encode = (value) => Buffer.from(value, "utf8").toString("base64");
  const samples = {
    simplified: "简体中文会话",
    traditional: "繁體中文會話",
    japanese: "日本語の会話",
    korean: "한국어 대화",
    combining: "Cafe\u0301",
    emoji: "Aura 👩‍💻 🐢",
    rareCjk: "𠀀野家",
    niche: "∑ ∞ ↯ ⌘ ⟡",
  };
  const harness = `
$ErrorActionPreference='Stop'
$DataRoot='${psPath(path.join(temporaryRoot, "data"))}'
function Write-AuraUiLog { param([string]$Message) }
function Send-AuraTaskboardChanged { param([long]$Revision) }
function Refresh-AuraTaskboardQueue {}
. '${psPath(taskboardPath)}'
. '${psPath(modulePath)}'
function Read-Utf8Base64 {param([string]$Value)
  return [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($Value))
}
$simplified=Read-Utf8Base64 '${encode(samples.simplified)}'
$traditional=Read-Utf8Base64 '${encode(samples.traditional)}'
$japanese=Read-Utf8Base64 '${encode(samples.japanese)}'
$korean=Read-Utf8Base64 '${encode(samples.korean)}'
$combining=Read-Utf8Base64 '${encode(samples.combining)}'
$emoji=Read-Utf8Base64 '${encode(samples.emoji)}'
$rareCjk=Read-Utf8Base64 '${encode(samples.rareCjk)}'
$niche=Read-Utf8Base64 '${encode(samples.niche)}'
$grinning=Read-Utf8Base64 '${encode("😀")}'
$womanTechnologist=Read-Utf8Base64 '${encode("👩‍💻")}'
$accent=[string][char]0x0301
function Test-SafeTitleTruncation {
  param([string]$InputText,[string]$OutputText)
  if($OutputText-ceq$InputText-or-not$OutputText.EndsWith([string][char]0x2026)){return $false}
  if($OutputText.Contains([string][char]0xFFFD)){return $false}
  $prefix=$OutputText.Substring(0,$OutputText.Length-1)
  if(-not$InputText.StartsWith($prefix,[StringComparison]::Ordinal)){return $false}
  if($prefix.Length-eq0){return $false}
  $last=$prefix[$prefix.Length-1]
  if([char]::IsHighSurrogate($last)-or[int]$last-eq0x200D){return $false}
  $boundaries=[Globalization.StringInfo]::ParseCombiningCharacters($InputText)
  return $prefix.Length-eq$InputText.Length-or$boundaries-contains$prefix.Length
}
$surrogateLong=('a'*22)+$grinning+'tail'
$combiningLong=('b'*22)+'e'+$accent+'tail'
$joinerLong=('c'*20)+$womanTechnologist+'tail'
$surrogateResult=Get-AuraWebTabDisplayTitle -Title $surrogateLong
$combiningResult=Get-AuraWebTabDisplayTitle -Title $combiningLong
$joinerResult=Get-AuraWebTabDisplayTitle -Title $joinerLong
[ordered]@{
  unchanged=[ordered]@{
    simplified=(Get-AuraWebTabDisplayTitle -Title $simplified)-ceq$simplified
    traditional=(Get-AuraWebTabDisplayTitle -Title $traditional)-ceq$traditional
    japanese=(Get-AuraWebTabDisplayTitle -Title $japanese)-ceq$japanese
    korean=(Get-AuraWebTabDisplayTitle -Title $korean)-ceq$korean
    combining=(Get-AuraWebTabDisplayTitle -Title $combining)-ceq$combining
    emoji=(Get-AuraWebTabDisplayTitle -Title $emoji)-ceq$emoji
    rareCjk=(Get-AuraWebTabDisplayTitle -Title $rareCjk)-ceq$rareCjk
    niche=(Get-AuraWebTabDisplayTitle -Title $niche)-ceq$niche
  }
  safe=[ordered]@{
    surrogate=Test-SafeTitleTruncation -InputText $surrogateLong -OutputText $surrogateResult
    combining=Test-SafeTitleTruncation -InputText $combiningLong -OutputText $combiningResult
    joiner=Test-SafeTitleTruncation -InputText $joinerLong -OutputText $joinerResult
    noReplacement=(-not($surrogateResult+$combiningResult+$joinerResult).Contains([string][char]0xFFFD))
  }
}|ConvertTo-Json -Depth 6 -Compress
`;
  await fs.writeFile(harnessPath, harness, "utf8");
  try {
    const result = spawnSync("powershell.exe", [
      "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", harnessPath,
    ], { cwd: PROJECT_ROOT, encoding: "utf8", windowsHide: true });
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    const actual = JSON.parse(result.stdout.trim().split(/\r?\n/u).at(-1));
    assert.deepEqual(actual, {
      unchanged: {
        simplified: true, traditional: true, japanese: true, korean: true,
        combining: true, emoji: true, rareCjk: true, niche: true,
      },
      safe: { surrogate: true, combining: true, joiner: true, noReplacement: true },
    });
  } finally {
    await fs.rm(temporaryRoot, { recursive: true, force: true });
  }
});

test("Claude session URLs normalize only exact Chat and Code session routes", async () => {
  if (process.platform !== "win32") return;
  const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "aura-session-url-"));
  const harnessPath = path.join(temporaryRoot, "session-url-harness.ps1");
  const harness = `
$ErrorActionPreference='Stop'
$DataRoot='${psPath(path.join(temporaryRoot, "data"))}'
function Write-AuraUiLog { param([string]$Message) }
function Send-AuraTaskboardChanged { param([long]$Revision) }
function Refresh-AuraTaskboardQueue {}
. '${psPath(taskboardPath)}'
. '${psPath(modulePath)}'
$normalizer=Get-Command ConvertTo-AuraWebTabSessionUrl -ErrorAction SilentlyContinue
function Read-SessionUrl {
  param([AllowNull()][object]$Value)
  if($null-eq$normalizer){return $null}
  try{return ConvertTo-AuraWebTabSessionUrl -Value $Value}catch{return $null}
}
$chatId='01234567-89ab-4cde-8f01-234567890abc'
$codeId='Opaque_ID-9'
$accepted=[ordered]@{
  chat=Read-SessionUrl "https://claude.ai/chat/\${chatId}?mode=focus#draft"
  code=Read-SessionUrl "https://claude.ai/code/\${codeId}?view=work#anchor"
}
$rejected=[ordered]@{}
$invalid=[ordered]@{
  credentials='https://user:secret@claude.ai/chat/id'
  nondefaultPort='https://claude.ai:444/chat/id'
  spoofedHost='https://claude.ai.evil.example/chat/id'
  externalHost='https://example.com/chat/id'
  newRoute='https://claude.ai/new'
  bareCode='https://claude.ai/code'
  bareChat='https://claude.ai/chat/'
  nested='https://claude.ai/chat/id/extra'
  encodedSlash='https://claude.ai/chat/id%2Fextra'
  dotId='https://claude.ai/chat/id.withdot'
  tildeId='https://claude.ai/chat/id~tilde'
  encodedOpaque='https://claude.ai/chat/id%2Did'
  malformed='https://claude.ai/chat/%ZZ'
  oversizedId=('https://claude.ai/chat/'+('a'*513))
  oversizedValue=('https://claude.ai/chat/'+('b'*2050))
}
foreach($entry in $invalid.GetEnumerator()){
  $rejected[$entry.Key]=$null-eq(Read-SessionUrl $entry.Value)
}
[ordered]@{
  normalizerAvailable=$null-ne$normalizer
  accepted=$accepted
  rejected=$rejected
}|ConvertTo-Json -Depth 6 -Compress
`;
  await fs.writeFile(harnessPath, harness, "utf8");
  try {
    const result = spawnSync("powershell.exe", [
      "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", harnessPath,
    ], { cwd: PROJECT_ROOT, encoding: "utf8", windowsHide: true });
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    const actual = JSON.parse(result.stdout.trim().split(/\r?\n/u).at(-1));
    assert.deepEqual(actual, {
      normalizerAvailable: true,
      accepted: {
        chat: "https://claude.ai/chat/01234567-89ab-4cde-8f01-234567890abc",
        code: "https://claude.ai/code/Opaque_ID-9",
      },
      rejected: {
        credentials: true, nondefaultPort: true, spoofedHost: true, externalHost: true,
        newRoute: true, bareCode: true, bareChat: true, nested: true,
        encodedSlash: true, dotId: true, tildeId: true, encodedOpaque: true,
        malformed: true, oversizedId: true, oversizedValue: true,
      },
    });
  } finally {
    await fs.rm(temporaryRoot, { recursive: true, force: true });
  }
});

test("active exact session-to-home navigation opens a separate tab without touching its source", async () => {
  if (process.platform !== "win32") return;
  const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "aura-new-session-nav-"));
  const harnessPath = path.join(temporaryRoot, "new-session-nav-harness.ps1");
  const harness = `
$ErrorActionPreference='Stop'
$DataRoot='${psPath(path.join(temporaryRoot, "data"))}'
function Write-AuraUiLog { param([string]$Message) }
function Send-AuraTaskboardChanged { param([long]$Revision) }
function Refresh-AuraTaskboardQueue {}
. '${psPath(taskboardPath)}'
. '${psPath(modulePath)}'
$uiSource=Get-Content -LiteralPath '${psPath(uiPath)}' -Raw
$tokens=$null;$parseErrors=$null
$ast=[System.Management.Automation.Language.Parser]::ParseInput($uiSource,[ref]$tokens,[ref]$parseErrors)
$definition=@($ast.FindAll({param($node)
  $node-is[System.Management.Automation.Language.FunctionDefinitionAst]-and
    $node.Name-ceq'Request-AuraUiInterceptNewSessionNavigation'
},$true))[0]
$interceptorAvailable=$null-ne$definition
if($interceptorAvailable){Invoke-Expression $definition.Extent.Text}
$script:ActiveCore=[PSCustomObject]@{Name='active'}
$backgroundCore=[PSCustomObject]@{Name='background'}
function Test-AuraWebTabCoreActive {param([object]$Core)return $Core-eq$script:ActiveCore}
$script:CreateSucceeds=$true
$script:Requests=[Collections.Generic.List[string]]::new()
function Request-AuraUiNewWebTab {param([string]$Url)
  [void]$script:Requests.Add($Url)
  return $script:CreateSucceeds
}
$script:SourceView=[PSCustomObject]@{NavigateCount=0;DisposeCount=0;RefreshCount=0}
$script:SourceView|Add-Member ScriptMethod Navigate {param($url)$this.NavigateCount+=1}
$script:SourceView|Add-Member ScriptMethod Dispose {$this.DisposeCount+=1}
$script:SourceView|Add-Member ScriptMethod Reload {$this.RefreshCount+=1}
function Invoke-InterceptCase {
  param([object]$Core,[string]$Source,[string]$Target,[bool]$Create=$true)
  $script:CreateSucceeds=$Create
  if(-not$interceptorAvailable){return $false}
  return [bool](Request-AuraUiInterceptNewSessionNavigation -Core $Core -SourceUrl $Source -TargetUrl $Target)
}
$results=[ordered]@{
  chatToNew=Invoke-InterceptCase $script:ActiveCore 'https://claude.ai/chat/current-id' 'https://claude.ai/new'
  codeToCode=Invoke-InterceptCase $script:ActiveCore 'https://claude.ai/code/current-id' 'https://claude.ai/code'
  inactive=Invoke-InterceptCase $backgroundCore 'https://claude.ai/chat/current-id' 'https://claude.ai/new'
  reload=Invoke-InterceptCase $script:ActiveCore 'https://claude.ai/chat/current-id' 'https://claude.ai/chat/current-id'
  auth=Invoke-InterceptCase $script:ActiveCore 'https://claude.ai/chat/current-id' 'https://claude.ai/login'
  account=Invoke-InterceptCase $script:ActiveCore 'https://claude.ai/chat/current-id' 'https://claude.ai/settings'
  external=Invoke-InterceptCase $script:ActiveCore 'https://claude.ai/chat/current-id' 'https://example.com/new'
  sessionToSession=Invoke-InterceptCase $script:ActiveCore 'https://claude.ai/chat/current-id' 'https://claude.ai/chat/other-id'
  rootSource=Invoke-InterceptCase $script:ActiveCore 'https://claude.ai/' 'https://claude.ai/new'
  newSource=Invoke-InterceptCase $script:ActiveCore 'https://claude.ai/new' 'https://claude.ai/new'
  targetWithQuery=Invoke-InterceptCase $script:ActiveCore 'https://claude.ai/chat/current-id' 'https://claude.ai/new?from=chat'
  failedCreate=Invoke-InterceptCase $script:ActiveCore 'https://claude.ai/chat/current-id' 'https://claude.ai/new' $false
}
[ordered]@{
  interceptorAvailable=$interceptorAvailable
  results=$results
  requests=@($script:Requests)
  sourceUntouched=($script:SourceView.NavigateCount-eq0-and
    $script:SourceView.DisposeCount-eq0-and$script:SourceView.RefreshCount-eq0)
}|ConvertTo-Json -Depth 6 -Compress
`;
  await fs.writeFile(harnessPath, harness, "utf8");
  try {
    const result = spawnSync("powershell.exe", [
      "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", harnessPath,
    ], { cwd: PROJECT_ROOT, encoding: "utf8", windowsHide: true });
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    const actual = JSON.parse(result.stdout.trim().split(/\r?\n/u).at(-1));
    const ui = await fs.readFile(uiPath, "utf8");
    const navigationStart = ui.indexOf("$core.add_NavigationStarting");
    const navigationEnd = ui.indexOf("$core.add_WebMessageReceived", navigationStart);
    const navigationSource = ui.slice(navigationStart, navigationEnd);
    actual.navigationHookWired = /Request-AuraUiInterceptNewSessionNavigation/u.test(navigationSource)
      && /eventArgs\.Cancel/u.test(navigationSource);
    actual.noEnglishSelectorDependency = !/aria-label|New chat|New session/iu.test(navigationSource);
    assert.deepEqual(actual, {
      interceptorAvailable: true,
      results: {
        chatToNew: true, codeToCode: true,
        inactive: false, reload: false, auth: false, account: false, external: false,
        sessionToSession: false, rootSource: false, newSource: false,
        targetWithQuery: false, failedCreate: false,
      },
      requests: [
        "https://claude.ai/new",
        "https://claude.ai/code",
        "https://claude.ai/new",
      ],
      sourceUntouched: true,
      navigationHookWired: true,
      noEnglishSelectorDependency: true,
    });
  } finally {
    await fs.rm(temporaryRoot, { recursive: true, force: true });
  }
});

test("native tab strip accepts exactly one canonical dropped Claude session", async () => {
  if (process.platform !== "win32") return;
  const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "aura-tab-drop-"));
  const harnessPath = path.join(temporaryRoot, "tab-drop-harness.ps1");
  const harness = `
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
$DataRoot='${psPath(path.join(temporaryRoot, "data"))}'
function Write-AuraUiLog { param([string]$Message) }
function Send-AuraTaskboardChanged { param([long]$Revision) }
function Refresh-AuraTaskboardQueue {}
. '${psPath(taskboardPath)}'
. '${psPath(modulePath)}'
$script:Fixture=New-AuraWebTabDocument
function Read-AuraWebTabDocument {return ConvertTo-AuraWebTabDocument -Value $script:Fixture}
function Save-AuraWebTabs {}
$script:Requests=[Collections.Generic.List[string]]::new()
$script:CreateSucceeds=$true
function Request-AuraUiNewWebTab {param([string]$Url)
  [void]$script:Requests.Add($Url)
  return $script:CreateSucceeds
}
function New-DropData {param([string]$Format,[string]$Value)
  $data=[System.Windows.Forms.DataObject]::new()
  $data.SetData($Format,$Value)
  return $data
}
$canonical='https://claude.ai/chat/Drop_ID-9'
$uriData=New-DropData 'UniformResourceLocatorW' "\${canonical}?view=list#draft"
$listData=New-DropData 'text/uri-list' ("# Claude session"+[Environment]::NewLine+
  "https://claude.ai/code/Code_ID-7?x=1#y"+[Environment]::NewLine)
$plainData=New-DropData 'text/plain' 'https://claude.ai/chat/Plain_ID-4#draft'
$multipleData=New-DropData 'text/uri-list' ("https://claude.ai/chat/one"+[Environment]::NewLine+
  "https://claude.ai/chat/two")
$externalData=New-DropData 'text/plain' 'https://example.com/chat/id'
$newData=New-DropData 'text/plain' 'https://claude.ai/new'
$bareData=New-DropData 'text/plain' 'https://claude.ai/code'
$normalizer=Get-Command Get-AuraWebTabDroppedSessionUrl -ErrorAction SilentlyContinue
$dropRequest=Get-Command Request-AuraUiOpenDroppedSession -ErrorAction SilentlyContinue
function Read-DroppedUrl {param([object]$Data)
  if($null-eq$normalizer){return $null}
  return Get-AuraWebTabDroppedSessionUrl -DataObject $Data
}
function Open-DroppedUrl {param([object]$Data)
  if($null-eq$dropRequest){return $false}
  return [bool](Request-AuraUiOpenDroppedSession -DataObject $Data)
}
$normalized=[ordered]@{
  uri=Read-DroppedUrl $uriData
  list=Read-DroppedUrl $listData
  plain=Read-DroppedUrl $plainData
}
$opened=[ordered]@{
  uri=Open-DroppedUrl $uriData
  list=Open-DroppedUrl $listData
  plain=Open-DroppedUrl $plainData
  multiple=Open-DroppedUrl $multipleData
  external=Open-DroppedUrl $externalData
  newRoute=Open-DroppedUrl $newData
  bareRoute=Open-DroppedUrl $bareData
}
$script:CreateSucceeds=$false
$opened.failedValid=Open-DroppedUrl $plainData
$script:CreateSucceeds=$true
$standby=[PSCustomObject]@{IsDisposed=$false}
$standby|Add-Member ScriptMethod Hide {}
$standby|Add-Member ScriptMethod Dispose {$this.IsDisposed=$true}
$script:UiCopy=[PSCustomObject]@{newTab='New tab';closeTab='Close tab'}
$script:Form=[System.Windows.Forms.Form]::new()
$content=[System.Windows.Forms.Panel]::new()
[void]$script:Form.Controls.Add($content)
Initialize-AuraWebTabs -ContentPanel $content -InitialWebView $standby -InitialUrl 'https://claude.ai/'
$surfaces=[Collections.Generic.List[object]]::new()
foreach($surface in @($script:AuraWebTabStrip,$script:AuraWebTabList,$script:AuraWebTabNewButton)){
  if($null-ne$surface){[void]$surfaces.Add($surface)}
}
foreach($container in @($script:AuraWebTabList.Controls)){
  [void]$surfaces.Add($container)
  foreach($control in @($container.Controls)){[void]$surfaces.Add($control)}
}
$allAllowDrop=$surfaces.Count-ge5-and@($surfaces|Where-Object{-not$_.AllowDrop}).Count-eq0
$validEnter=[System.Windows.Forms.DragEventArgs]::new(
  $plainData,0,0,0,[System.Windows.Forms.DragDropEffects]::Copy,[System.Windows.Forms.DragDropEffects]::None)
$invalidEnter=[System.Windows.Forms.DragEventArgs]::new(
  $multipleData,0,0,0,[System.Windows.Forms.DragDropEffects]::Copy,[System.Windows.Forms.DragDropEffects]::None)
$validDrop=[System.Windows.Forms.DragEventArgs]::new(
  $plainData,0,0,0,[System.Windows.Forms.DragDropEffects]::Copy,[System.Windows.Forms.DragDropEffects]::None)
$raiseEnter=$script:AuraWebTabStrip.GetType().GetMethod('OnDragEnter',[Reflection.BindingFlags]'Instance,NonPublic')
$raiseDrop=$script:AuraWebTabStrip.GetType().GetMethod('OnDragDrop',[Reflection.BindingFlags]'Instance,NonPublic')
[void]$raiseEnter.Invoke($script:AuraWebTabStrip,[object[]]@($validEnter))
[void]$raiseEnter.Invoke($script:AuraWebTabStrip,[object[]]@($invalidEnter))
[void]$raiseDrop.Invoke($script:AuraWebTabStrip,[object[]]@($validDrop))
$stripModel=@(Get-AuraWebTabStripModel -Document $script:AuraWebTabDocument)
[ordered]@{
  normalizerAvailable=$null-ne$normalizer
  dropRequestAvailable=$null-ne$dropRequest
  normalized=$normalized
  opened=$opened
  requests=@($script:Requests)
  requestCount=$script:Requests.Count
  allAllowDrop=$allAllowDrop
  validEffect=[string]$validEnter.Effect
  invalidEffect=[string]$invalidEnter.Effect
  workHubPinned=($stripModel[0].Id-ceq'work-hub'-and-not$stripModel[0].Closable)
}|ConvertTo-Json -Depth 7 -Compress
`;
  await fs.writeFile(harnessPath, harness, "utf8");
  try {
    const result = spawnSync("powershell.exe", [
      "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", harnessPath,
    ], { cwd: PROJECT_ROOT, encoding: "utf8", windowsHide: true });
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    const actual = JSON.parse(result.stdout.trim().split(/\r?\n/u).at(-1));
    const module = await fs.readFile(modulePath, "utf8");
    actual.realDropWiring = /\.add_DragEnter/u.test(module) && /\.add_DragDrop/u.test(module);
    assert.deepEqual(actual, {
      normalizerAvailable: true,
      dropRequestAvailable: true,
      normalized: {
        uri: "https://claude.ai/chat/Drop_ID-9",
        list: "https://claude.ai/code/Code_ID-7",
        plain: "https://claude.ai/chat/Plain_ID-4",
      },
      opened: {
        uri: true, list: true, plain: true,
        multiple: false, external: false, newRoute: false, bareRoute: false,
        failedValid: false,
      },
      requests: [
        "https://claude.ai/chat/Drop_ID-9",
        "https://claude.ai/code/Code_ID-7",
        "https://claude.ai/chat/Plain_ID-4",
        "https://claude.ai/chat/Plain_ID-4",
        "https://claude.ai/chat/Plain_ID-4",
      ],
      requestCount: 5,
      allAllowDrop: true,
      validEffect: "Copy",
      invalidEffect: "None",
      workHubPinned: true,
      realDropWiring: true,
    });
  } finally {
    await fs.rm(temporaryRoot, { recursive: true, force: true });
  }
});

test("main Aura window wires real WebView2 tabs and keyboard tab actions", async () => {
  const [module, ui] = await Promise.all([
    fs.readFile(modulePath, "utf8"),
    fs.readFile(uiPath, "utf8"),
  ]);
  assert.match(module, /Microsoft\.Web\.WebView2\.WinForms\.WebView2\]::new\(\)/);
  assert.match(module, /ProtectedData\]::Protect/);
  assert.match(module, /ClaudeAura\.WebTabs\.v1/);
  assert.match(module, /FlowLayoutPanel/);
  assert.match(module, /Request-AuraUiSelectWebTab/);
  assert.match(ui, /\. \(Join-Path \$PSScriptRoot 'aura-web-tabs\.ps1'\)/);
  assert.match(ui, /Initialize-AuraWebTabs/);
  assert.match(ui, /Register-AuraWebTabInitialized/);
  assert.match(ui, /Request-AuraUiNewWebTab/);
  assert.match(ui, /function Request-AuraUiNewWebTab\s*\{\s*param\(\[string\]\$Url = 'https:\/\/claude\.ai\/'\)/);
  assert.match(ui, /Add-AuraWebTabRuntime -Url \$Url/);
  assert.match(ui, /Request-AuraUiNewWebTab -Url 'https:\/\/claude\.ai\/code'/);
  assert.match(ui, /\$sender\.Navigate\('https:\/\/claude\.ai\/code'\)/);
  assert.match(ui, /Request-AuraUiCloseWebTab/);
  assert.match(ui, /Request-AuraUiCycleWebTab/);
  assert.match(ui, /0x54 \{ \$eventArgs\.Handled = \$true; Request-AuraUiNewWebTab/);
  assert.match(ui, /0x57 \{ \$eventArgs\.Handled = \$true; Request-AuraUiCloseWebTab/);
});

runIfMain(import.meta.url);
