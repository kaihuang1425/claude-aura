import { spawn, spawnSync } from "node:child_process";
import { createConnection } from "node:net";
import { test, runIfMain } from "./support/harness.mjs";
import {
  PROJECT_ROOT,
  assert,
  fs,
  os,
  path,
} from "./support/context.mjs";

const modulePath = path.join(PROJECT_ROOT, "windows", "aura-session-dock.ps1");
const taskboardPath = path.join(PROJECT_ROOT, "windows", "aura-taskboard.ps1");
const webTabsPath = path.join(PROJECT_ROOT, "windows", "aura-web-tabs.ps1");
const uiPath = path.join(PROJECT_ROOT, "windows", "aura-ui.ps1");
const releaseBuilderPath = path.join(PROJECT_ROOT, "scripts", "build-release.mjs");
const installerAuditPath = path.join(PROJECT_ROOT, "scripts", "audit-installer.mjs");
const fileManifestPath = path.join(PROJECT_ROOT, "docs", "FILE_MANIFEST.md");
const studioAppPath = path.join(PROJECT_ROOT, "studio", "app.js");
const workHubPath = path.join(PROJECT_ROOT, "studio", "work-hub.html");
const sessionBoardScriptPath = path.join(PROJECT_ROOT, "studio", "session-board.js");
const sessionBoardCssPath = path.join(PROJECT_ROOT, "studio", "session-board.css");
const psPath = (value) => value.replaceAll("'", "''");

test("compact Work Hub uses Gemini Aura hierarchy with progressive disclosure", async () => {
  const [script, css] = await Promise.all([
    fs.readFile(sessionBoardScriptPath, "utf8"),
    fs.readFile(sessionBoardCssPath, "utf8"),
  ]);
  assert.match(script, /const info = make\("button", "session-board-info"\)/,
    "Work Hub must expose its local-observation contract through one info control");
  assert.match(script, /const disclosure = make\("aside", "session-board-disclosure"\)[\s\S]{0,600}?disclosure\.append\(disclosureScope\)/,
    "The info control must retain the evidence-state disclaimer without duplicating hero copy");
  assert.match(script, /info\.setAttribute\("aria-expanded", String\(expanded\)\)[\s\S]{0,100}?disclosure\.hidden = !expanded/,
    "The disclaimer must stay hidden until the info control is activated");
  assert.match(script, /headingCopy\.append\(kicker, title, lede\)/,
    "The dashboard must retain one short navigation subtitle below its title");
  assert.doesNotMatch(script, /summary\.append\(status, scope\)/,
    "The evidence-state disclaimer must not remain permanently visible in the dashboard hierarchy");
  assert.match(script, /host\.append\(header, summary, laneGrid\)/,
    "The Work Hub summary must sit between the hero and dashboard lanes");
  assert.match(css,
    /body:has\(\[data-session-board-mode="compact"\]\)[\s\S]{0,320}?padding:\s*clamp\(28px, 5vw, 72px\)[\s\S]{0,240}?var\(--accent/,
    "Compact Work Hub must retain the spacious Gemini-style page inset");
  assert.match(css,
    /\.session-board-lane-list\[data-empty="true"\][\s\S]{0,120}?overflow-y:\s*hidden/,
    "Empty lanes must not show inert vertical scrollbars");
  assert.match(css,
    /\[data-session-board-mode="compact"\][\s\S]{0,140}?max-width:\s*1180px[\s\S]{0,120}?margin:\s*0 auto/,
    "Compact Work Hub content must use a centered readable dashboard width");
  assert.match(css,
    /\[data-session-board-mode="compact"\] \.session-board-lane[\s\S]{0,240}?min-height:\s*max\(260px, calc\(100vh - 330px\)\)[\s\S]{0,180}?border-radius:\s*18px/,
    "Compact Work Hub lanes must fill tall windows instead of floating above unused canvas");
  assert.match(css,
    /\[data-session-board-mode="compact"\] \.session-board-empty[\s\S]{0,220}?min-height:\s*max\(172px, calc\(100vh - 405px\)\)[\s\S]{0,180}?border:\s*1px dashed/,
    "Empty Work Hub lanes must retain the dashed treatment while using the available height");
});

test("pet runway projects encrypted Aura-observed Claude Chat and Claude Code history", async () => {
  if (process.platform !== "win32") return;
  const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "aura-session-dock-"));
  const harnessPath = path.join(temporaryRoot, "session-dock-harness.ps1");
  const localAppData = path.join(temporaryRoot, "local-app-data");
  const harness = `
$ErrorActionPreference='Stop'
$env:LOCALAPPDATA='${psPath(localAppData)}'
$DataRoot='${psPath(path.join(temporaryRoot, "data"))}'
function Write-AuraUiLog { param([string]$Message) }
function Send-AuraTaskboardChanged { param([long]$Revision) }
function Refresh-AuraTaskboardQueue {}
. '${psPath(taskboardPath)}'
. '${psPath(modulePath)}'
$script:AuraSessionHistoryDocument=New-AuraSessionHistoryDocument
$emptyProjection=Get-AuraSessionDockProjection
[void](Register-AuraSessionObservation -Url 'https://claude.ai/chat/chat-one?panel=details#latest' -Title 'Plan the release' -ObservedAt 100 -Opened)
[void](Register-AuraSessionObservation -Url 'https://claude.ai/code/code-one?private=removed' -Title 'Fix Windows install' -ObservedAt 200 -Opened)
[void](Register-AuraSessionObservation -Url 'https://claude.ai/chat/chat-two' -Title 'Review pet behavior' -ObservedAt 300 -Opened)
$invalid=@(
  (ConvertTo-AuraSessionRoute -Value 'https://claude.ai/new'),
  (ConvertTo-AuraSessionRoute -Value 'https://claude.ai/code'),
  (ConvertTo-AuraSessionRoute -Value 'https://claude.ai/chat/chat-one/details'),
  (ConvertTo-AuraSessionRoute -Value 'https://example.com/chat/chat-one')
)
$script:AuraWebTabDocument=[PSCustomObject][ordered]@{
  schemaVersion=1;revision=7;activeTabId='22222222-2222-4222-8222-222222222222';tabs=@(
    [PSCustomObject][ordered]@{id='11111111-1111-4111-8111-111111111111';title='Plan the release';url='https://claude.ai/chat/chat-one';createdAt=100},
    [PSCustomObject][ordered]@{id='22222222-2222-4222-8222-222222222222';title='Fix Windows install';url='https://claude.ai/code/code-one';createdAt=200}
  )
}
$pastRecord=@($script:AuraSessionHistoryDocument.sessions|Where-Object{$_.route -ceq 'https://claude.ai/chat/chat-two'})[0]
$pastRecord.responseState='failed'
$pastRecord.responseChangedAt=[long]350
[void](Start-AuraSessionResponseObservation -TabId '11111111-1111-4111-8111-111111111111' -RequestId 'request-one' -ObservedAt 400)
$workingProjection=Get-AuraSessionDockProjection
[void](Complete-AuraSessionResponseObservation -RequestId 'request-one' -Outcome completed -ObservedAt 500)
$projection=Get-AuraSessionDockProjection
$script:AuraWebTabDocument.tabs=@($script:AuraWebTabDocument.tabs|Where-Object{$_.id -cne '11111111-1111-4111-8111-111111111111'})
$afterClose=Get-AuraSessionDockProjection
$closedSession=@($afterClose.sessions|Where-Object{$_.title -ceq '[Claude Chat] Plan the release'})[0]
$written=Write-AuraSessionHistoryDocument -Document $script:AuraSessionHistoryDocument
$read=Read-AuraSessionHistoryDocument
$raw=[IO.File]::ReadAllBytes($script:AuraSessionHistoryPath)
$projectionJson=$projection|ConvertTo-Json -Depth 8 -Compress
$rawText=[Text.Encoding]::UTF8.GetString($raw)
[ordered]@{
  emptyCount=$emptyProjection.sessions.Count
  invalidRoutes=@($invalid|Where-Object{$null-ne$_}).Count
  count=$projection.sessions.Count
  states=@($projection.sessions|ForEach-Object{$_.state})
  titles=@($projection.sessions|ForEach-Object{$_.title})
  workingStates=@($workingProjection.sessions|ForEach-Object{$_.response.state})
  responseStates=@($projection.sessions|ForEach-Object{$_.response.state})
  responseEvidence=@($projection.sessions|ForEach-Object{$_.response.evidence})
  exactProjectionFields=@($projection.PSObject.Properties.Name)
  exactSessionFields=@($projection.sessions[0].PSObject.Properties.Name)
  exactResponseFields=@($projection.sessions[0].response.PSObject.Properties.Name)
  capabilities=@($projection.capabilities.openSession,$projection.capabilities.queueSession,$projection.capabilities.steerSession)
  openToPast=($closedSession.state -ceq 'past')
  revisionAdvanced=([long]$afterClose.revision -gt [long]$projection.revision)
  bodyFree=(-not $projectionJson.Contains('https://') -and -not $projectionJson.Contains('chat-one') -and -not $projectionJson.Contains('prompt body') -and -not $projectionJson.Contains('task'))
  encrypted=(-not $rawText.Contains('chat-one') -and -not $rawText.Contains('Plan the release'))
  roundTrip=($read.sessions.Count -eq 3 -and $written.revision -eq $read.revision)
} | ConvertTo-Json -Depth 6 -Compress
`;
  await fs.writeFile(harnessPath, harness, "utf8");
  try {
    const result = spawnSync("powershell.exe", [
      "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", harnessPath,
    ], { cwd: PROJECT_ROOT, encoding: "utf8", windowsHide: true });
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    assert.deepEqual(JSON.parse(result.stdout.trim().split(/\r?\n/u).at(-1)), {
      emptyCount: 0,
      invalidRoutes: 0,
      count: 3,
      states: ["active", "open", "past"],
      titles: [
        "[Claude Code] Fix Windows install",
        "[Claude Chat] Plan the release",
        "[Claude Chat] Review pet behavior",
      ],
      workingStates: ["unknown", "working", "failed"],
      responseStates: ["unknown", "completed", "failed"],
      responseEvidence: ["none", "network", "network"],
      exactProjectionFields: [
        "schemaVersion", "contractId", "kind", "sequence", "revision",
        "changedAt", "sessions", "capabilities",
      ],
      exactSessionFields: ["id", "title", "state", "firstSeenAt", "lastOpenedAt", "response"],
      exactResponseFields: ["state", "evidence", "changedAt"],
      capabilities: [true, true, true],
      openToPast: true,
      revisionAdvanced: true,
      bodyFree: true,
      encrypted: true,
      roundTrip: true,
    });
  } finally {
    await fs.rm(temporaryRoot, { recursive: true, force: true });
  }
});

test("account transitions clear Claude session history and publish through a Claude-only endpoint", async () => {
  if (process.platform !== "win32") return;
  const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "aura-session-account-reset-"));
  const harnessPath = path.join(temporaryRoot, "session-account-reset-harness.ps1");
  const localAppData = path.join(temporaryRoot, "local-app-data");
  const harness = `
$ErrorActionPreference='Stop'
$env:LOCALAPPDATA='${psPath(localAppData)}'
$DataRoot='${psPath(path.join(temporaryRoot, "data"))}'
function Write-AuraUiLog { param([string]$Message) }
function Send-AuraTaskboardChanged { param([long]$Revision) }
function Refresh-AuraTaskboardQueue {}
. '${psPath(taskboardPath)}'
. '${psPath(modulePath)}'
$script:AuraSessionHistoryDocument=New-AuraSessionHistoryDocument
[void](Register-AuraSessionObservation -Url 'https://claude.ai/chat/old-account-session' -Title 'Old account task' -ObservedAt 100 -Opened)
$before=Get-AuraSessionDockProjection
$reset=Reset-AuraSessionHistoryForAccountTransition
$after=Get-AuraSessionDockProjection
$stored=Read-AuraSessionHistoryDocument
[ordered]@{
  beforeCount=@($before.sessions).Count
  reset=$reset
  afterCount=@($after.sessions).Count
  storedCount=@($stored.sessions).Count
  liveRequests=$script:AuraSessionResponseRequests.Count
  discoveryPath=[IO.Path]::GetFullPath($script:AuraSessionDockDiscoveryPath)
  expectedPath=[IO.Path]::GetFullPath((Join-Path $env:LOCALAPPDATA 'ClaudeAura\\pet-plugin\\session-dock-v2.json'))
} | ConvertTo-Json -Compress
`;
  await fs.writeFile(harnessPath, harness, "utf8");
  try {
    const result = spawnSync("powershell.exe", [
      "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", harnessPath,
    ], { cwd: PROJECT_ROOT, encoding: "utf8", windowsHide: true });
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    assert.deepEqual(JSON.parse(result.stdout.trim().split(/\r?\n/u).at(-1)), {
      beforeCount: 1,
      reset: true,
      afterCount: 0,
      storedCount: 0,
      liveRequests: 0,
      discoveryPath: path.join(localAppData, "ClaudeAura", "pet-plugin", "session-dock-v2.json"),
      expectedPath: path.join(localAppData, "ClaudeAura", "pet-plugin", "session-dock-v2.json"),
    });
  } finally {
    await fs.rm(temporaryRoot, { recursive: true, force: true });
  }
});

test("Claude auth navigation invalidates the prior account session board", async () => {
  const [source, sessionDock, studioApp, workHub] = await Promise.all([
    fs.readFile(uiPath, "utf8"),
    fs.readFile(modulePath, "utf8"),
    fs.readFile(studioAppPath, "utf8"),
    fs.readFile(workHubPath, "utf8"),
  ]);
  assert.match(source,
    /add_NavigationStarting\(\{[\s\S]*?Test-AuraUiAccountTransitionUri -Value \$eventArgs\.Uri[\s\S]*?Reset-AuraSessionHistoryForAccountTransition/u);
  assert.match(sessionDock,
    /Reset-AuraSessionHistoryForAccountTransition[\s\S]*?Publish-AuraSessionBoardInvalidation/u);
  assert.match(studioApp,
    /session-board-invalidate[\s\S]*?sessionBoardController\?\.refresh\?\.\(\)/u);
  assert.match(workHub,
    /session-board-invalidate[\s\S]*?ensureController\(\)\?\.refresh\?\.\(\)/u);
});

test("pet runway quick navigation reuses open Aura tabs and opens only known past sessions", async () => {
  if (process.platform !== "win32") return;
  const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "aura-session-navigation-"));
  const harnessPath = path.join(temporaryRoot, "session-navigation-harness.ps1");
  const harness = `
$ErrorActionPreference='Stop'
$DataRoot='${psPath(path.join(temporaryRoot, "data"))}'
function Write-AuraUiLog { param([string]$Message) }
function Send-AuraTaskboardChanged { param([long]$Revision) }
function Refresh-AuraTaskboardQueue {}
. '${psPath(taskboardPath)}'
. '${psPath(modulePath)}'
$script:AuraSessionHistoryDocument=New-AuraSessionHistoryDocument
[void](Register-AuraSessionObservation -Url 'https://claude.ai/chat/chat-open' -Title 'Open chat' -ObservedAt 100 -Opened)
[void](Register-AuraSessionObservation -Url 'https://claude.ai/code/code-past' -Title 'Past code session' -ObservedAt 200 -Opened)
$openSession=@($script:AuraSessionHistoryDocument.sessions|Where-Object{$_.route -ceq 'https://claude.ai/chat/chat-open'})[0]
$pastSession=@($script:AuraSessionHistoryDocument.sessions|Where-Object{$_.route -ceq 'https://claude.ai/code/code-past'})[0]
$script:AuraWebTabDocument=[PSCustomObject][ordered]@{
  schemaVersion=1;revision=1;activeTabId='11111111-1111-4111-8111-111111111111';tabs=@(
    [PSCustomObject][ordered]@{id='11111111-1111-4111-8111-111111111111';title='Home';url='https://claude.ai/';createdAt=1},
    [PSCustomObject][ordered]@{id='22222222-2222-4222-8222-222222222222';title='Open chat';url='https://claude.ai/chat/chat-open';createdAt=2}
  )
}
$script:selected=@();$script:opened=@();$script:selectAllowed=$true
function Request-AuraUiSelectWebTab {
  param([string]$Id)
  if (-not $script:selectAllowed) { return $false }
  $script:selected += $Id
  return $true
}
function Request-AuraUiNewWebTab { param([string]$Url) $script:opened += $Url; return $true }
$projection=Get-AuraSessionDockProjection
$openReceipt=Invoke-AuraSessionDockCommand -Message ([PSCustomObject][ordered]@{
  schemaVersion=2;contractId='gemini-aura-session-dock-v2';kind='command'
  commandId='33333333-3333-4333-8333-333333333333';expectedRevision=$projection.revision
  action='open-session';sessionId=[string]$openSession.id
})
$pastReceipt=Invoke-AuraSessionDockCommand -Message ([PSCustomObject][ordered]@{
  schemaVersion=2;contractId='gemini-aura-session-dock-v2';kind='command'
  commandId='44444444-4444-4444-8444-444444444444';expectedRevision=$projection.revision
  action='open-session';sessionId=[string]$pastSession.id
})
$script:selectAllowed=$false
$blockedReceipt=Invoke-AuraSessionDockCommand -Message ([PSCustomObject][ordered]@{
  schemaVersion=2;contractId='gemini-aura-session-dock-v2';kind='command'
  commandId='88888888-8888-4888-8888-888888888888';expectedRevision=$projection.revision
  action='open-session';sessionId=[string]$openSession.id
})
$staleReceipt=Invoke-AuraSessionDockCommand -Message ([PSCustomObject][ordered]@{
  schemaVersion=2;contractId='gemini-aura-session-dock-v2';kind='command'
  commandId='55555555-5555-4555-8555-555555555555';expectedRevision=0
  action='open-session';sessionId=[string]$pastSession.id
})
$rejected=$false
try {
  [void](Invoke-AuraSessionDockCommand -Message ([PSCustomObject][ordered]@{
    schemaVersion=2;contractId='gemini-aura-session-dock-v2';kind='command'
    commandId='66666666-6666-4666-8666-666666666666';expectedRevision=$projection.revision
    action='create-task';text='forbidden'
  }))
} catch { $rejected=$true }
[ordered]@{
  selected=$script:selected
  opened=$script:opened
  outcomes=@($openReceipt.outcome,$pastReceipt.outcome,$blockedReceipt.outcome,$staleReceipt.outcome)
  evidence=@($openReceipt.evidence,$pastReceipt.evidence,$blockedReceipt.evidence,$staleReceipt.evidence)
  receiptFields=@($openReceipt.PSObject.Properties.Name)
  rejected=$rejected
} | ConvertTo-Json -Depth 5 -Compress
`;
  await fs.writeFile(harnessPath, harness, "utf8");
  try {
    const result = spawnSync("powershell.exe", [
      "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", harnessPath,
    ], { cwd: PROJECT_ROOT, encoding: "utf8", windowsHide: true });
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    assert.deepEqual(JSON.parse(result.stdout.trim().split(/\r?\n/u).at(-1)), {
      selected: ["22222222-2222-4222-8222-222222222222"],
      opened: ["https://claude.ai/code/code-past"],
      outcomes: ["opened", "opened", "unavailable", "stale"],
      evidence: ["local", "local", "local", "local"],
      receiptFields: [
        "schemaVersion", "contractId", "kind", "commandId", "action",
        "outcome", "evidence", "revision", "at",
      ],
      rejected: true,
    });
  } finally {
    await fs.rm(temporaryRoot, { recursive: true, force: true });
  }
});

test("Aura WebView tab observation feeds the runway without a manual task", async () => {
  if (process.platform !== "win32") return;
  const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "aura-session-observation-"));
  const harnessPath = path.join(temporaryRoot, "session-observation-harness.ps1");
  const harness = `
$ErrorActionPreference='Stop'
$DataRoot='${psPath(path.join(temporaryRoot, "data"))}'
function Write-AuraUiLog { param([string]$Message) }
function Send-AuraTaskboardChanged { param([long]$Revision) }
function Refresh-AuraTaskboardQueue {}
. '${psPath(taskboardPath)}'
. '${psPath(modulePath)}'
. '${psPath(webTabsPath)}'
$script:AuraSessionHistoryDocument=New-AuraSessionHistoryDocument
$script:AuraWebTabDocument=New-AuraWebTabDocument -InitialUrl 'https://claude.ai/chat/observed-chat'
$script:AuraWebTabRuntime=@{}
$id=[string]$script:AuraWebTabDocument.activeTabId
$core=[PSCustomObject]@{DocumentTitle='Observed chat title'}
$view=[PSCustomObject]@{Source=[Uri]'https://claude.ai/chat/observed-chat?panel=one';CoreWebView2=$core;IsDisposed=$false}
[void](New-AuraWebTabRuntimeRecord -Id $id -View $view)
Sync-AuraWebTabMetadata -Core $core
$stored=Read-AuraSessionHistoryDocument
$projection=Get-AuraSessionDockProjection
[ordered]@{
  stored=$stored.sessions.Count
  route=$stored.sessions[0].route
  title=$projection.sessions[0].title
  state=$projection.sessions[0].state
  noTaskStore=(-not (Test-Path -LiteralPath (Join-Path $DataRoot 'taskboard\\tasks.bin')))
} | ConvertTo-Json -Compress
`;
  await fs.writeFile(harnessPath, harness, "utf8");
  try {
    const result = spawnSync("powershell.exe", [
      "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", harnessPath,
    ], { cwd: PROJECT_ROOT, encoding: "utf8", windowsHide: true });
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    assert.deepEqual(JSON.parse(result.stdout.trim().split(/\r?\n/u).at(-1)), {
      stored: 1,
      route: "https://claude.ai/chat/observed-chat",
      title: "[Claude Chat] Observed chat title",
      state: "active",
      noTaskStore: true,
    });
  } finally {
    await fs.rm(temporaryRoot, { recursive: true, force: true });
  }
});

test("Queue waits for current request evidence while Steer inserts a reviewable draft", async () => {
  if (process.platform !== "win32") return;
  const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "aura-session-prompts-"));
  const harnessPath = path.join(temporaryRoot, "session-prompts-harness.ps1");
  const harness = `
$ErrorActionPreference='Stop'
$env:LOCALAPPDATA='${psPath(path.join(temporaryRoot, "local-app-data"))}'
$DataRoot='${psPath(path.join(temporaryRoot, "data"))}'
function Write-AuraUiLog { param([string]$Message) }
function Send-AuraTaskboardChanged { param([long]$Revision) }
function Refresh-AuraTaskboardQueue {}
function Request-AuraUiHostWork {}
. '${psPath(taskboardPath)}'
. '${psPath(modulePath)}'
$script:AuraSessionHistoryDocument=New-AuraSessionHistoryDocument
[void](Register-AuraSessionObservation -Url 'https://claude.ai/chat/prompt-session' -Title 'Prompt target' -ObservedAt 100 -Opened)
$session=$script:AuraSessionHistoryDocument.sessions[0]
$tabId='11111111-1111-4111-8111-111111111111'
$script:AuraWebTabDocument=[PSCustomObject][ordered]@{
  schemaVersion=1;revision=1;activeTabId=$tabId;tabs=@(
    [PSCustomObject][ordered]@{id=$tabId;title='Prompt target';url='https://claude.ai/chat/prompt-session';createdAt=1}
  )
}
$script:capturedScripts=@()
$core=New-Object PSObject
$core|Add-Member -MemberType ScriptMethod -Name ExecuteScriptAsync -Value {
  param([string]$Source)
  $script:capturedScripts += $Source
  $operationId=[regex]::Match($Source,'[a-f0-9]{32}').Value
  $queue=$Source.Contains('queue-session')
  $result=[ordered]@{
    operationId=$operationId;route='https://claude.ai/chat/prompt-session'
    inserted=$true;submitScheduled=$queue
    reason=$(if($queue){'queue-session'}else{'steer-session'})
  }|ConvertTo-Json -Compress
  return [Threading.Tasks.Task[string]]::FromResult($result)
}
$view=[PSCustomObject]@{CoreWebView2=$core;Source=[Uri]'https://claude.ai/chat/prompt-session';IsDisposed=$false}
$script:AuraWebTabRuntime=@{$tabId=[PSCustomObject]@{View=$view;Initialized=$true;PageReady=$true}}
function Request-AuraUiSelectWebTab { param([string]$Id) return $Id -ceq $tabId }
function Request-AuraUiNewWebTab { param([string]$Url) return $false }
$projection=Get-AuraSessionDockProjection
[void](Start-AuraSessionResponseObservation -TabId $tabId -RequestId 'active-request' -ObservedAt 200)
$queueCommand=[PSCustomObject][ordered]@{
  schemaVersion=2;contractId='gemini-aura-session-dock-v2';kind='command'
  commandId='22222222-2222-4222-8222-222222222222';expectedRevision=(Get-AuraSessionDockProjection).revision
  action='queue-session';sessionId=[string]$session.id;text='Queue after the active request'
}
$queueReceipt=Invoke-AuraSessionDockCommand -Message $queueCommand
Update-AuraSessionDockPromptOperations
$beforeSettleScripts=$script:capturedScripts.Count
[void](Complete-AuraSessionResponseObservation -RequestId 'active-request' -Outcome completed -ObservedAt 300)
Update-AuraSessionDockPromptOperations
Update-AuraSessionDockPromptOperations
$steerCommand=[PSCustomObject][ordered]@{
  schemaVersion=2;contractId='gemini-aura-session-dock-v2';kind='command'
  commandId='33333333-3333-4333-8333-333333333333';expectedRevision=(Get-AuraSessionDockProjection).revision
  action='steer-session';sessionId=[string]$session.id;text='Place this for review'
}
$steerImmediate=Invoke-AuraSessionDockCommand -Message $steerCommand
Update-AuraSessionDockPromptOperations
Update-AuraSessionDockPromptOperations
$steerCached=$script:AuraSessionDockReceipts[[string]$steerCommand.commandId].Receipt
[ordered]@{
  queueOutcome=$queueReceipt.outcome
  queuedWhileWorking=($beforeSettleScripts -eq 0)
  queueExecuted=($script:capturedScripts.Count -ge 2 -and $script:capturedScripts[0].Contains('queue-session'))
  steerDeferred=($null -eq $steerImmediate)
  steerOutcome=$steerCached.outcome
  steerReviewOnly=($script:capturedScripts[1].Contains('steer-session') -and -not $script:capturedScripts[1].Contains('auto-submit'))
  pendingCount=$script:AuraSessionDockPromptOperations.Count
} | ConvertTo-Json -Compress
`;
  await fs.writeFile(harnessPath, harness, "utf8");
  try {
    const result = spawnSync("powershell.exe", [
      "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", harnessPath,
    ], { cwd: PROJECT_ROOT, encoding: "utf8", windowsHide: true });
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    assert.deepEqual(JSON.parse(result.stdout.trim().split(/\r?\n/u).at(-1)), {
      queueOutcome: "queued",
      queuedWhileWorking: true,
      queueExecuted: true,
      steerDeferred: true,
      steerOutcome: "placed-review-required",
      steerReviewOnly: true,
      pendingCount: 0,
    });
  } finally {
    await fs.rm(temporaryRoot, { recursive: true, force: true });
  }
});

test("persisted WebView tab changes wake the runway projection", async () => {
  const source = await fs.readFile(webTabsPath, "utf8");
  assert.match(source, /function Save-AuraWebTabs[\s\S]*?Request-AuraUiHostWork[\s\S]*?function Set-AuraWebTabActiveDocument/u);
  assert.match(source, /function Remove-AuraWebTabRuntime[\s\S]*?Unregister-AuraSessionResponseObserver -TabId \$Id/u);
});

test("Aura host loads the session adapter before WebView tabs", async () => {
  const source = await fs.readFile(uiPath, "utf8");
  const sessionIndex = source.indexOf(". (Join-Path $PSScriptRoot 'aura-session-dock.ps1')");
  const tabsIndex = source.indexOf(". (Join-Path $PSScriptRoot 'aura-web-tabs.ps1')");
  assert(sessionIndex >= 0 && sessionIndex < tabsIndex);
});

test("Aura host owns the session runway async lifecycle without blocking the UI thread", async () => {
  const source = await fs.readFile(uiPath, "utf8");
  assert.match(source,
    /if \(-not \$script:IsRescueSession\) \{\s*\[void\]\(Initialize-AuraSessionDock\)\s*\[void\]\(Initialize-AuraSessionBoardDesktopHost\)\s*\}/u);
  assert.match(source,
    /Update-AuraSessionDock\s+Update-AuraSessionBoardDesktopHost\s+Update-AuraDraftHandoff/u);
  for (const task of [
    "$script:AuraSessionDockAcceptTask",
    "$script:AuraSessionDockReadTask",
    "$script:AuraSessionDockWriteTask",
  ]) {
    assert(source.includes(task), `${task} must wake the Aura host loop`);
  }
  assert((source.match(/Dispose-AuraSessionDock/gu) ?? []).length >= 2);
  const mutexIndex = source.indexOf('$mutex = [System.Threading.Mutex]::new($true, "Local\\ClaudeAura.$sid.Ui"');
  const initializeIndex = source.indexOf("[void](Initialize-AuraSessionDock)", mutexIndex);
  assert(mutexIndex >= 0 && initializeIndex > mutexIndex,
    "the primary instance must own the UI mutex before publishing discovery");
});

test("session runway v2 keeps Claude request observation body-free and fail-closed", async () => {
  const source = await fs.readFile(modulePath, "utf8");
  assert.match(source, /AddWebResourceRequestedFilter\(\$filter, \$context, \$sourceKinds\)/u);
  assert.match(source, /add_WebResourceRequested/u);
  assert.match(source, /add_WebResourceResponseReceived/u);
  assert.match(source, /chat_conversations[^\r\n]+completion/u);
  assert.doesNotMatch(source,
    /GetDevToolsProtocolEventReceiver|CallDevToolsProtocolMethodAsync|GetContentAsync|\.Content\b|\.Headers\b|postData|response body/iu);
  assert.match(source, /function Start-AuraSessionResponseObservation\b/u);
  assert.match(source, /function Complete-AuraSessionResponseObservation\b/u);
});

test("WebView2 request metadata drives working and confirmed completion only", async () => {
  if (process.platform !== "win32") return;
  const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "aura-session-observer-"));
  const harnessPath = path.join(temporaryRoot, "session-observer-harness.ps1");
  const harness = `
$ErrorActionPreference='Stop'
$env:LOCALAPPDATA='${psPath(path.join(temporaryRoot, "local-app-data"))}'
$DataRoot='${psPath(path.join(temporaryRoot, "data"))}'
function Write-AuraUiLog { param([string]$Message) }
function Send-AuraTaskboardChanged { param([long]$Revision) }
function Refresh-AuraTaskboardQueue {}
function Request-AuraUiHostWork {}
. '${psPath(taskboardPath)}'
. '${psPath(modulePath)}'
  Add-Type -TypeDefinition @'
using System;
public sealed class FakeWebResourceRequest {
  public string Method { get; private set; }
  public string Uri { get; private set; }
  public FakeWebResourceRequest(string method, string uri) { Method = method; Uri = uri; }
}
public sealed class FakeWebResourceResponse {
  public int StatusCode { get; private set; }
  public FakeWebResourceResponse(int statusCode) { StatusCode = statusCode; }
}
public sealed class FakeWebResourceRequestedEventArgs : EventArgs {
  public FakeWebResourceRequest Request { get; private set; }
  public FakeWebResourceRequestedEventArgs(FakeWebResourceRequest request) { Request = request; }
}
public sealed class FakeWebResourceResponseReceivedEventArgs : EventArgs {
  public FakeWebResourceRequest Request { get; private set; }
  public FakeWebResourceResponse Response { get; private set; }
  public FakeWebResourceResponseReceivedEventArgs(FakeWebResourceRequest request, FakeWebResourceResponse response) {
    Request = request; Response = response;
  }
}
public sealed class FakeWebResourceCore {
  public event EventHandler<FakeWebResourceRequestedEventArgs> WebResourceRequested;
  public event EventHandler<FakeWebResourceResponseReceivedEventArgs> WebResourceResponseReceived;
  public int FilterCount { get; private set; }
  public void AddWebResourceRequestedFilter(string pattern, object context, object sourceKinds) { FilterCount += 1; }
  public void RemoveWebResourceRequestedFilter(string pattern, object context) { FilterCount -= 1; }
  public void RaiseRequested(string method, string uri) {
    var handler = WebResourceRequested;
    if (handler != null) handler(this,
      new FakeWebResourceRequestedEventArgs(new FakeWebResourceRequest(method, uri)));
  }
  public void RaiseResponse(string method, string uri, int statusCode) {
    var handler = WebResourceResponseReceived;
    if (handler != null) handler(this, new FakeWebResourceResponseReceivedEventArgs(
      new FakeWebResourceRequest(method, uri), new FakeWebResourceResponse(statusCode)));
  }
}
'@
$script:AuraSessionHistoryDocument=New-AuraSessionHistoryDocument
[void](Register-AuraSessionObservation -Url 'https://claude.ai/chat/observed-request' -Title 'Observed request' -ObservedAt 100 -Opened)
$tabId='11111111-1111-4111-8111-111111111111'
$script:AuraWebTabDocument=[PSCustomObject][ordered]@{
  schemaVersion=1;revision=1;activeTabId=$tabId;tabs=@(
    [PSCustomObject][ordered]@{id=$tabId;title='Observed request';url='https://claude.ai/chat/observed-request';createdAt=1}
  )
}
$core=[FakeWebResourceCore]::new()
$registered=Register-AuraSessionResponseObserver -Core $core -TabId $tabId
$core.RaiseRequested('POST','https://claude.ai/api/organizations/org/other')
$afterIgnored=Get-AuraSessionDockProjection
$core.RaiseRequested('POST','https://claude.ai/api/organizations/org/chat_conversations/conversation/completion')
$working=Get-AuraSessionDockProjection
$core.RaiseResponse('POST','https://claude.ai/api/organizations/org/chat_conversations/conversation/completion',200)
$completed=Get-AuraSessionDockProjection
[ordered]@{
  registered=$registered
  filters=$core.FilterCount
  ignored=$afterIgnored.sessions[0].response.state
  working=$working.sessions[0].response.state
  completed=$completed.sessions[0].response.state
  evidence=$completed.sessions[0].response.evidence
  requests=$script:AuraSessionResponseRequests.Count
} | ConvertTo-Json -Compress
`;
  await fs.writeFile(harnessPath, harness, "utf8");
  try {
    const result = spawnSync("powershell.exe", [
      "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", harnessPath,
    ], { cwd: PROJECT_ROOT, encoding: "utf8", windowsHide: true });
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    assert.deepEqual(JSON.parse(result.stdout.trim().split(/\r?\n/u).at(-1)), {
      registered: true,
      filters: 1,
      ignored: "unknown",
      working: "working",
      completed: "completed",
      evidence: "network",
      requests: 0,
    });
  } finally {
    await fs.rm(temporaryRoot, { recursive: true, force: true });
  }
});

test("session runway retains outbound bytes until WriteAsync completes", async () => {
  const source = await fs.readFile(modulePath, "utf8");
  const start = source.slice(
    source.indexOf("function Start-AuraSessionDockWrite"),
    source.indexOf("function Add-AuraSessionDockFrame"),
  );
  assert.match(start, /AuraSessionDockWriteBuffer\s*=\s*\$script:AuraSessionDockWriteQueue\.Dequeue\(\)[\s\S]*?WriteAsync/u);
  assert.doesNotMatch(start, /Array\]::Clear\(\$script:AuraSessionDockWriteBuffer/u);
  const completion = source.slice(
    source.indexOf("if ($null -ne $script:AuraSessionDockWriteTask -and"),
    source.indexOf("if ($null -ne $script:AuraSessionDockReadTask -and"),
  );
  assert.match(completion, /AuraSessionDockWriteTask\.IsCompleted[\s\S]*?GetAwaiter\(\)\.GetResult\(\)[\s\S]*?Array\]::Clear\(\$buffer/u);
});

test("release, installer audit, and deliverable manifest include the session runway host", async () => {
  const sources = await Promise.all([
    fs.readFile(releaseBuilderPath, "utf8"),
    fs.readFile(installerAuditPath, "utf8"),
    fs.readFile(fileManifestPath, "utf8"),
  ]);
  for (const source of sources) {
    assert.match(source, /windows\/aura-session-dock\.ps1/u);
  }
});

test("installed companion contract authenticates to Aura over a body-free local pipe", async () => {
  if (process.platform !== "win32") return;
  const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "aura-session-pipe-"));
  const harnessPath = path.join(temporaryRoot, "session-pipe-harness.ps1");
  const localAppData = path.join(temporaryRoot, "local-app-data");
  const harness = `
$ErrorActionPreference='Stop'
$env:LOCALAPPDATA='${psPath(localAppData)}'
$DataRoot='${psPath(path.join(temporaryRoot, "data"))}'
function Write-AuraUiLog { param([string]$Message) }
function Send-AuraTaskboardChanged { param([long]$Revision) }
function Refresh-AuraTaskboardQueue {}
function Request-AuraUiHostWork {}
. '${psPath(taskboardPath)}'
. '${psPath(modulePath)}'
$script:AuraSessionHistoryDocument=New-AuraSessionHistoryDocument
[void](Register-AuraSessionObservation -Url 'https://claude.ai/code/code-pipe' -Title 'Pipe-visible session' -ObservedAt 100 -Opened)
$script:AuraWebTabDocument=[PSCustomObject][ordered]@{
  schemaVersion=1;revision=1;activeTabId='11111111-1111-4111-8111-111111111111';tabs=@(
    [PSCustomObject][ordered]@{id='11111111-1111-4111-8111-111111111111';title='Pipe-visible session';url='https://claude.ai/code/code-pipe';createdAt=1}
  )
}
Initialize-AuraSessionDock
[Console]::Out.WriteLine('READY')
[Console]::Out.Flush()
while ($true) { Update-AuraSessionDock; Start-Sleep -Milliseconds 10 }
`;
  await fs.writeFile(harnessPath, harness, "utf8");
  const child = spawn("powershell.exe", [
    "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", harnessPath,
  ], { cwd: PROJECT_ROOT, stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
  let stderr = "";
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk) => { stderr += chunk; });
  const waitForLine = (stream, predicate, timeoutMs = 5000) => new Promise((resolve, reject) => {
    let buffered = "";
    const timer = setTimeout(() => finish(new Error(`timeout waiting for frame\n${stderr}`)), timeoutMs);
    const finish = (error, value) => {
      clearTimeout(timer);
      stream.off("data", onData);
      if (error) reject(error); else resolve(value);
    };
    const onData = (chunk) => {
      buffered += chunk.toString("utf8");
      for (;;) {
        const newline = buffered.indexOf("\n");
        if (newline < 0) return;
        const line = buffered.slice(0, newline).trim();
        buffered = buffered.slice(newline + 1);
        if (predicate(line)) return finish(null, line);
      }
    };
    stream.on("data", onData);
  });
  let socket;
  try {
    await waitForLine(child.stdout, (line) => line === "READY");
    const discoveryPath = path.join(localAppData, "ClaudeAura", "pet-plugin", "session-dock-v2.json");
    const discovery = JSON.parse(await fs.readFile(discoveryPath, "utf8"));
    assert.deepEqual(Object.keys(discovery), [
      "schemaVersion", "contractId", "pipe", "token", "instanceId", "createdAt",
    ]);
    assert.equal(discovery.contractId, "gemini-aura-session-dock-v2");
    socket = createConnection(`\\\\.\\pipe\\${discovery.pipe}`);
    await new Promise((resolve, reject) => {
      socket.once("connect", resolve);
      socket.once("error", reject);
    });
    socket.write(`${JSON.stringify({
      schemaVersion: 2,
      contractId: "gemini-aura-session-dock-v2",
      kind: "hello",
      token: discovery.token,
      clientId: "pet-status",
      clientVersion: "0.0.0",
    })}\n`);
    const projection = JSON.parse(await waitForLine(socket, (line) => line.startsWith("{")));
    assert.deepEqual(projection.sessions.map((session) => ({ title: session.title, state: session.state })), [
      { title: "[Claude Code] Pipe-visible session", state: "active" },
    ]);
    assert(!JSON.stringify(projection).includes("https://"));
    const commandId = "77777777-7777-4777-8777-777777777777";
    socket.write(`${JSON.stringify({
      schemaVersion: 2,
      contractId: "gemini-aura-session-dock-v2",
      kind: "command",
      commandId,
      expectedRevision: projection.revision,
      action: "refresh",
    })}\n`);
    const receipt = JSON.parse(await waitForLine(socket, (line) => line.includes(`\"commandId\":\"${commandId}\"`)));
    assert.deepEqual({ action: receipt.action, outcome: receipt.outcome, evidence: receipt.evidence }, {
      action: "refresh", outcome: "refreshed", evidence: "local",
    });
  } finally {
    socket?.destroy();
    if (child.exitCode === null && child.signalCode === null) {
      const closed = new Promise((resolve) => child.once("close", resolve));
      child.kill();
      await closed;
    }
    await fs.rm(temporaryRoot, { recursive: true, force: true });
  }
});

test("Work Hub projects all body-free observations from the same encrypted history", async () => {
  if (process.platform !== "win32") return;
  const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "aura-work-hub-projection-"));
  const harnessPath = path.join(temporaryRoot, "work-hub-projection-harness.ps1");
  const encode = (value) => Buffer.from(value, "utf8").toString("base64");
  const unicodeTitles = [
    "简体中文会话",
    "繁體中文會話",
    "日本語の会話",
    "한국어 대화",
    "𠀀研究 👩‍💻",
    "Cafe\u0301 ∑∞",
  ];
  const harness = `
$ErrorActionPreference='Stop'
$DataRoot='${psPath(path.join(temporaryRoot, "data"))}'
function Write-AuraUiLog { param([string]$Message) }
function Send-AuraTaskboardChanged { param([long]$Revision) }
function Refresh-AuraTaskboardQueue {}
. '${psPath(taskboardPath)}'
. '${psPath(modulePath)}'
function Read-AuraTaskboardDocument { throw 'Work Hub must not read the taskboard store.' }
function Write-AuraTaskboardDocument { throw 'Work Hub must not write the taskboard store.' }
function Initialize-AuraPromptShelfStorage { throw 'Work Hub must not initialize Prompt Shelf storage.' }
function Initialize-AuraPromptShelfPersistence { throw 'Work Hub must not initialize Prompt Shelf persistence.' }
function Read-AuraPromptShelfEncryptedItems { throw 'Work Hub must not read Prompt Shelf storage.' }
function Read-AuraPromptShelfItems { throw 'Work Hub must not read Prompt Shelf items.' }
function Write-AuraPromptShelfItems { throw 'Work Hub must not write Prompt Shelf items.' }
function Read-Utf8Base64 {param([string]$Value)
  return [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($Value))
}
$unicodeTitles=@(
  (Read-Utf8Base64 '${encode(unicodeTitles[0])}'),
  (Read-Utf8Base64 '${encode(unicodeTitles[1])}'),
  (Read-Utf8Base64 '${encode(unicodeTitles[2])}'),
  (Read-Utf8Base64 '${encode(unicodeTitles[3])}'),
  (Read-Utf8Base64 '${encode(unicodeTitles[4])}'),
  (Read-Utf8Base64 '${encode(unicodeTitles[5])}')
)
$fixture=New-AuraSessionHistoryDocument
$fixture.revision=[long]44
$fixture.changedAt=[long]9000
$ids=@()
$sessions=@()
for($index=1;$index-le100;$index+=1){
  $id=('{0:x8}-0000-4000-8000-{0:x12}'-f$index)
  $ids+=$id
  $kind=if($index%2-eq0){'code'}else{'chat'}
  $title=if($index-le$unicodeTitles.Count){$unicodeTitles[$index-1]}else{"Session $index"}
  $responseState=if($index-eq1){'completed'}elseif($index-eq2){'failed'}else{'unknown'}
  $sessions+=[PSCustomObject][ordered]@{
    id=$id;kind=$kind;route="https://claude.ai/$kind/session_$index";title=$title
    firstSeenAt=[long](1000+$index);lastOpenedAt=[long](2000+$index)
    responseState=$responseState
    responseChangedAt=if($responseState-ceq'unknown'){$null}else{[long](3000+$index)}
  }
}
$fixture.sessions=@($sessions)
$script:Fixture=ConvertTo-AuraSessionHistoryDocument -Value $fixture
$script:HistoryReads=0
function Read-AuraSessionHistoryDocument {
  $script:HistoryReads+=1
  return $script:Fixture
}
$script:AuraSessionHistoryDocument=$null
$script:AuraSessionResponseLiveByRoute['https://claude.ai/chat/session_3']=1
$script:AuraSessionResponseChangedAtByRoute['https://claude.ai/chat/session_3']=[long]4003
$script:AuraWebTabDocument=[PSCustomObject][ordered]@{
  schemaVersion=2;revision=9;activeTabId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';tabs=@(
    [PSCustomObject][ordered]@{id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';title='Active';url='https://claude.ai/chat/session_1';createdAt=1},
    [PSCustomObject][ordered]@{id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';title='Open code';url='https://claude.ai/code/session_2';createdAt=2},
    [PSCustomObject][ordered]@{id='cccccccc-cccc-4ccc-8ccc-cccccccccccc';title='Open chat';url='https://claude.ai/chat/session_3';createdAt=3}
  )
}
function Get-DataPaths {
  if(-not(Test-Path -LiteralPath $DataRoot)){return @()}
  return @(Get-ChildItem -LiteralPath $DataRoot -Recurse -Force|ForEach-Object{$_.FullName})
}
$beforePaths=@(Get-DataPaths)
$dock=Get-AuraSessionDockProjection
$workHubCommand=Get-Command Get-AuraSessionWorkHubProjection -ErrorAction SilentlyContinue
function Invoke-WorkHubProjection {
  if($null-eq$workHubCommand){return $null}
  return Get-AuraSessionWorkHubProjection
}
$workHub=Invoke-WorkHubProjection
$workHubSame=Invoke-WorkHubProjection
$dockAfterStableReads=Get-AuraSessionDockProjection
$script:AuraWebTabDocument.activeTabId='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
$workHubLocalChanged=Invoke-WorkHubProjection
$workHubLocalSame=Invoke-WorkHubProjection
$script:AuraSessionResponseLiveByRoute['https://claude.ai/code/session_4']=1
$script:AuraSessionResponseChangedAtByRoute['https://claude.ai/code/session_4']=[long]5004
$workHubResponseChanged=Invoke-WorkHubProjection
$workHubResponseSame=Invoke-WorkHubProjection
$script:AuraSessionHistoryDocument=New-AuraSessionHistoryDocument
$script:AuraWebTabDocument=[PSCustomObject][ordered]@{
  schemaVersion=2;revision=10;activeTabId=$null;tabs=@()
}
$emptyWorkHub=Invoke-WorkHubProjection
$emptyWorkHubSame=Invoke-WorkHubProjection
$afterPaths=@(Get-DataPaths)
$workHubSessions=if($null-eq$workHub){@()}else{@($workHub.sessions)}
$workHubSnapshots=@(
  $workHub,$workHubSame,$workHubLocalChanged,
  $workHubLocalSame,$workHubResponseChanged,$workHubResponseSame,
  $emptyWorkHub,$emptyWorkHubSame
)
function Test-SafeWorkHubInteger {param([AllowNull()][object]$Value)
  if($null-eq$Value){return $false}
  try{$number=[decimal]$Value}catch{return $false}
  return [decimal]::Truncate($number)-eq$number-and
    $number-gt0-and$number-le[decimal]9007199254740991
}
$expectedIds=@($ids[0],$ids[2],$ids[1])
for($index=99;$index-ge3;$index-=1){$expectedIds+=$ids[$index]}
$actualIds=@($workHubSessions|ForEach-Object{$_.id})
$definitionSource=''
if($null-ne$workHubCommand){
  $definitionSource=[string]$workHubCommand.Definition
}
$workHubJson=if($null-eq$workHub){''}else{$workHub|ConvertTo-Json -Depth 8 -Compress}
$unicodeActual=@()
foreach($id in $ids[0..5]){
  $unicodeActual+=@($workHubSessions|Where-Object{$_.id-ceq$id})[0].title
}
$responseById=[ordered]@{}
foreach($id in $ids[0..3]){
  $session=@($workHubSessions|Where-Object{$_.id-ceq$id})[0]
  $responseById[$id]=if($null-eq$session){''}else{[string]$session.response.state}
}
[ordered]@{
  available=$null-ne$workHubCommand
  historyReads=$script:HistoryReads
  rootSchemaVersion=if($null-eq$workHub){-1}else{[int]$workHub.schemaVersion}
  rootKind=if($null-eq$workHub){''}else{[string]$workHub.kind}
  safeChangeEvidence=@($workHubSnapshots|Where-Object{
    $null-eq$_-or-not(Test-SafeWorkHubInteger -Value $_.revision)-or
      -not(Test-SafeWorkHubInteger -Value $_.changedAt)
  }).Count-eq0
  stableIdenticalReads=$null-ne$workHub-and
    [long]$workHub.revision-eq[long]$workHubSame.revision-and
    [long]$workHub.changedAt-eq[long]$workHubSame.changedAt
  localStateAdvances=$null-ne$workHubLocalChanged-and
    [long]$workHubLocalChanged.revision-gt[long]$workHubSame.revision-and
    [long]$workHubLocalChanged.changedAt-gt[long]$workHubSame.changedAt
  stableAfterLocalChange=$null-ne$workHubLocalSame-and
    [long]$workHubLocalSame.revision-eq[long]$workHubLocalChanged.revision-and
    [long]$workHubLocalSame.changedAt-eq[long]$workHubLocalChanged.changedAt
  responseStateAdvances=$null-ne$workHubResponseChanged-and
    [long]$workHubResponseChanged.revision-gt[long]$workHubLocalSame.revision-and
    [long]$workHubResponseChanged.changedAt-gt[long]$workHubLocalSame.changedAt
  stableAfterResponseChange=$null-ne$workHubResponseSame-and
    [long]$workHubResponseSame.revision-eq[long]$workHubResponseChanged.revision-and
    [long]$workHubResponseSame.changedAt-eq[long]$workHubResponseChanged.changedAt
  emptySchemaVersion=if($null-eq$emptyWorkHub){-1}else{[int]$emptyWorkHub.schemaVersion}
  emptyKind=if($null-eq$emptyWorkHub){''}else{[string]$emptyWorkHub.kind}
  emptyFields=if($null-eq$emptyWorkHub){@()}else{@($emptyWorkHub.PSObject.Properties.Name)}
  emptyCount=if($null-eq$emptyWorkHub){-1}else{@($emptyWorkHub.sessions).Count}
  emptyStable=$null-ne$emptyWorkHubSame-and
    [long]$emptyWorkHubSame.revision-eq[long]$emptyWorkHub.revision-and
    [long]$emptyWorkHubSame.changedAt-eq[long]$emptyWorkHub.changedAt
  localStateVisible=$null-ne$workHubLocalChanged-and
    [string](@($workHubLocalChanged.sessions|Where-Object{$_.id-ceq$ids[0]})[0].state)-ceq'open'-and
    [string](@($workHubLocalChanged.sessions|Where-Object{$_.id-ceq$ids[1]})[0].state)-ceq'active'
  responseStateVisible=$null-ne$workHubResponseChanged-and
    [string](@($workHubResponseChanged.sessions|Where-Object{$_.id-ceq$ids[3]})[0].response.state)-ceq'working'
  dockRevisionStable=[long]$dock.revision-eq[long]$dockAfterStableReads.revision-and
    [long]$dock.changedAt-eq[long]$dockAfterStableReads.changedAt
  dockSequenceAdvances=[long]$dockAfterStableReads.sequence-gt[long]$dock.sequence
  rootFields=if($null-eq$workHub){@()}else{@($workHub.PSObject.Properties.Name)}
  sessionFields=if($workHubSessions.Count-eq0){@()}else{@($workHubSessions[0].PSObject.Properties.Name)}
  responseFields=if($workHubSessions.Count-eq0){@()}else{@($workHubSessions[0].response.PSObject.Properties.Name)}
  count=$workHubSessions.Count
  dockCount=$dock.sessions.Count
  dockFields=if($dock.sessions.Count-eq0){@()}else{@($dock.sessions[0].PSObject.Properties.Name)}
  orderMatches=(@($actualIds)-join'|')-ceq(@($expectedIds)-join'|')
  states=@($workHubSessions|Group-Object state|Sort-Object Name|ForEach-Object{"$($_.Name):$($_.Count)"})
  responseStates=@($responseById.Values)
  unicodeExact=(@($unicodeActual)-join'|')-ceq(@($unicodeTitles)-join'|')
  canonicalUrls=@($workHubSessions|Where-Object{$_.url-cnotmatch'^https://claude[.]ai/(chat|code)/[A-Za-z0-9_-]+$'}).Count-eq0
  kinds=@($workHubSessions|Where-Object{$_.kind-cnotin@('chat','code')}).Count-eq0
  bodyFree=($workHubJson-cnotmatch'(?i)prompt|responseBody|providerBody|messageBody')
  noForbiddenStoreSource=$definitionSource-cnotmatch'(?i)taskboard|prompt|todo|project|studio'
  noFilesCreated=(@($beforePaths)-join'|')-ceq(@($afterPaths)-join'|')
}|ConvertTo-Json -Depth 8 -Compress
`;
  await fs.writeFile(harnessPath, harness, "utf8");
  try {
    const result = spawnSync("powershell.exe", [
      "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", harnessPath,
    ], { cwd: PROJECT_ROOT, encoding: "utf8", windowsHide: true });
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    const actual = JSON.parse(result.stdout.trim().split(/\r?\n/u).at(-1));
    assert.deepEqual(actual, {
      available: true,
      historyReads: 1,
      rootSchemaVersion: 1,
      rootKind: "session-board-state",
      safeChangeEvidence: true,
      stableIdenticalReads: true,
      localStateAdvances: true,
      stableAfterLocalChange: true,
      responseStateAdvances: true,
      stableAfterResponseChange: true,
      emptySchemaVersion: 1,
      emptyKind: "session-board-state",
      emptyFields: ["schemaVersion", "kind", "revision", "changedAt", "sessions"],
      emptyCount: 0,
      emptyStable: true,
      localStateVisible: true,
      responseStateVisible: true,
      dockRevisionStable: true,
      dockSequenceAdvances: true,
      rootFields: ["schemaVersion", "kind", "revision", "changedAt", "sessions"],
      sessionFields: [
        "id", "url", "title", "kind", "state",
        "firstSeenAt", "lastOpenedAt", "response",
      ],
      responseFields: ["state", "evidence", "changedAt"],
      count: 100,
      dockCount: 12,
      dockFields: ["id", "title", "state", "firstSeenAt", "lastOpenedAt", "response"],
      orderMatches: true,
      states: ["active:1", "open:2", "past:97"],
      responseStates: ["completed", "failed", "working", "unknown"],
      unicodeExact: true,
      canonicalUrls: true,
      kinds: true,
      bodyFree: true,
      noForbiddenStoreSource: true,
      noFilesCreated: true,
    });
  } finally {
    await fs.rm(temporaryRoot, { recursive: true, force: true });
  }
});

test("Work Hub card navigation reuses open tabs and opens only known canonical history", async () => {
  if (process.platform !== "win32") return;
  const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "aura-work-hub-open-"));
  const harnessPath = path.join(temporaryRoot, "work-hub-open-harness.ps1");
  const harness = `
$ErrorActionPreference='Stop'
$DataRoot='${psPath(path.join(temporaryRoot, "data"))}'
function Write-AuraUiLog { param([string]$Message) }
function Send-AuraTaskboardChanged { param([long]$Revision) }
function Refresh-AuraTaskboardQueue {}
. '${psPath(taskboardPath)}'
. '${psPath(modulePath)}'
function Read-AuraTaskboardDocument { throw 'Work Hub must not read the taskboard store.' }
function Write-AuraTaskboardDocument { throw 'Work Hub must not write the taskboard store.' }
function Initialize-AuraPromptShelfStorage { throw 'Work Hub must not initialize Prompt Shelf storage.' }
function Initialize-AuraPromptShelfPersistence { throw 'Work Hub must not initialize Prompt Shelf persistence.' }
function Read-AuraPromptShelfEncryptedItems { throw 'Work Hub must not read Prompt Shelf storage.' }
function Read-AuraPromptShelfItems { throw 'Work Hub must not read Prompt Shelf items.' }
function Write-AuraPromptShelfItems { throw 'Work Hub must not write Prompt Shelf items.' }
$openSession='11111111-1111-4111-8111-111111111111'
$pastSession='22222222-2222-4222-8222-222222222222'
$staleSession='33333333-3333-4333-8333-333333333333'
$unknownSession='44444444-4444-4444-8444-444444444444'
$script:AuraSessionHistoryDocument=ConvertTo-AuraSessionHistoryDocument -Value ([PSCustomObject][ordered]@{
  schemaVersion=2;revision=3;changedAt=30;sessions=@(
    [PSCustomObject][ordered]@{id=$openSession;kind='chat';route='https://claude.ai/chat/open_one';title='Open';firstSeenAt=1;lastOpenedAt=10;responseState='unknown';responseChangedAt=$null},
    [PSCustomObject][ordered]@{id=$pastSession;kind='code';route='https://claude.ai/code/past_two';title='Past';firstSeenAt=2;lastOpenedAt=20;responseState='unknown';responseChangedAt=$null}
  )
})
$script:AuraSessionHistoryDocument.sessions+=([PSCustomObject][ordered]@{
  id=$staleSession;kind='chat';route='https://example.com/chat/stale';title='Stale'
  firstSeenAt=3;lastOpenedAt=30;responseState='unknown';responseChangedAt=$null
})
$openTab='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
$script:AuraWebTabDocument=[PSCustomObject][ordered]@{
  schemaVersion=2;revision=1;activeTabId=$null;tabs=@(
    [PSCustomObject][ordered]@{id=$openTab;title='Open';url='https://claude.ai/chat/open_one';createdAt=1}
  )
}
$script:Selected=[Collections.Generic.List[string]]::new()
$script:Opened=[Collections.Generic.List[string]]::new()
$script:SelectSucceeds=$true
$script:OpenSucceeds=$true
function Request-AuraUiSelectWebTab {param([string]$Id)[void]$script:Selected.Add($Id);return $script:SelectSucceeds}
function Request-AuraUiNewWebTab {param([string]$Url)[void]$script:Opened.Add($Url);return $script:OpenSucceeds}
$command=Get-Command Open-AuraSessionWorkHubSession -ErrorAction SilentlyContinue
function Invoke-WorkHubOpen {param([string]$Id)
  if($null-eq$command){return 'missing'}
  return [string](Open-AuraSessionWorkHubSession -SessionId $Id)
}
$outcomes=[ordered]@{
  existing=Invoke-WorkHubOpen $openSession
  past=Invoke-WorkHubOpen $pastSession
  malformed=Invoke-WorkHubOpen 'not-a-session-id'
  unknown=Invoke-WorkHubOpen $unknownSession
  staleRoute=Invoke-WorkHubOpen $staleSession
}
$script:SelectSucceeds=$false
$outcomes.existingUnavailable=Invoke-WorkHubOpen $openSession
$script:OpenSucceeds=$false
$outcomes.pastUnavailable=Invoke-WorkHubOpen $pastSession
[ordered]@{
  available=$null-ne$command
  outcomes=$outcomes
  selected=@($script:Selected)
  opened=@($script:Opened)
  exactRequests=($script:Selected.Count-eq2-and$script:Opened.Count-eq2)
  sourceBodyFree=if($null-eq$command){$true}else{[string]$command.Definition-cnotmatch'(?i)prompt|body|todo|project|studio'}
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
      available: true,
      outcomes: {
        existing: "opened",
        past: "opened",
        malformed: "not-found",
        unknown: "not-found",
        staleRoute: "not-found",
        existingUnavailable: "unavailable",
        pastUnavailable: "unavailable",
      },
      selected: [
        "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      ],
      opened: [
        "https://claude.ai/code/past_two",
        "https://claude.ai/code/past_two",
      ],
      exactRequests: true,
      sourceBodyFree: true,
    });
  } finally {
    await fs.rm(temporaryRoot, { recursive: true, force: true });
  }
});

runIfMain(import.meta.url);
