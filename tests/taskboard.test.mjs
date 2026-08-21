import { spawnSync } from "node:child_process";
import { DatabaseSync } from "node:sqlite";
import vm from "node:vm";
import { test, runIfMain } from "./support/harness.mjs";
import {
  PROJECT_ROOT,
  assert,
  fs,
  os,
  path,
} from "./support/context.mjs";

const taskboardPath = path.join(PROJECT_ROOT, "windows", "aura-taskboard.ps1");
const taskctlPath = path.join(PROJECT_ROOT, "windows", "aura-taskctl.ps1");
const promptShelfPath = path.join(PROJECT_ROOT, "windows", "aura-prompt-shelf.ps1");
const uiPath = path.join(PROJECT_ROOT, "windows", "aura-ui.ps1");
const desktopPanelPath = path.join(PROJECT_ROOT, "windows", "desktop-taskboard-panel.ps1");
const desktopOverlayPath = path.join(PROJECT_ROOT, "windows", "desktop-overlay-proof.ps1");
const studioIndexPath = path.join(PROJECT_ROOT, "studio", "index.html");
const studioAppPath = path.join(PROJECT_ROOT, "studio", "app.js");
const taskboardAppPath = path.join(PROJECT_ROOT, "studio", "taskboard.js");
const taskboardStylesPath = path.join(PROJECT_ROOT, "studio", "taskboard.css");
const enLocalePath = path.join(PROJECT_ROOT, "studio", "locales", "en.js");
const codexSessionIndexPath = path.join(PROJECT_ROOT, "scripts", "codex-session-index.mjs");

const psPath = (value) => value.replaceAll("'", "''");

test("Timeline keeps the final due date visible and exposes date ticks", async () => {
  const source = await fs.readFile(taskboardAppPath, "utf8");
  const context = { window: {} };
  vm.runInNewContext(source, context, { filename: taskboardAppPath });
  const scale = context.window.CLAUDE_AURA_TASKBOARD.buildTimelineScale([
    { id: "first", startDate: null, dueDate: "2026-08-11" },
    { id: "last", startDate: null, dueDate: "2026-08-15" },
  ]);

  assert.equal(scale.ranges.length, 2);
  assert.equal(scale.ranges[0].left, 0);
  assert.equal(scale.ranges[0].width, 20);
  assert.equal(scale.ranges[1].left, 80);
  assert.equal(scale.ranges[1].width, 20);
  assert.deepEqual([...scale.tickDates], [
    "2026-08-11", "2026-08-12", "2026-08-13",
    "2026-08-14", "2026-08-15", "2026-08-16",
  ]);
});

test("Linked-session presentation distinguishes provider activity from explicit usage-limit termination", async () => {
  const source = await fs.readFile(taskboardAppPath, "utf8");
  assert.doesNotMatch(source, /\u7e5a/u);
  assert.match(source, /\\u00B7/u);
  const context = { window: {} };
  vm.runInNewContext(source, context, { filename: taskboardAppPath });
  const present = context.window.CLAUDE_AURA_TASKBOARD.sessionPresentation;

  assert.equal(typeof present, "function");
  assert.equal(present({
    providerThreadId: "",
    sessionState: "unlinked",
    sessionTerminationReason: null,
    sessionEvidence: null,
  }), null);
  assert.deepEqual(JSON.parse(JSON.stringify(present({
    providerThreadId: "019ff38c-1816-7ef0-b185-26db0d8f4422",
    sessionState: "active",
    sessionTerminationReason: null,
    sessionEvidence: "provider-observed",
  }))), {
    state: "active",
    labelKey: "taskboardSessionActive",
    evidenceKey: "taskboardSessionEvidenceProviderObserved",
  });
  assert.deepEqual(JSON.parse(JSON.stringify(present({
    providerThreadId: "019ff38c-1816-7ef0-b185-26db0d8f4422",
    sessionState: "terminated",
    sessionTerminationReason: "usage-limit",
    sessionEvidence: "user-reported",
  }))), {
    state: "terminated",
    labelKey: "taskboardSessionTerminatedUsageLimit",
    evidenceKey: "taskboardSessionEvidenceUserReported",
  });
});

test("Work Hub reads real Codex session names without exposing database prompt text", async () => {
  const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "aura-codex-sessions-"));
  const indexPath = path.join(temporaryRoot, "session_index.jsonl");
  const databasePath = path.join(temporaryRoot, "state_5.sqlite");
  const currentId = "019ffb9a-b1d3-7381-b98c-f3c4f4bc902d";
  const archivedId = "019ff9f5-31a1-7851-a047-d71b6385e74e";
  const agentId = "019ff9f4-ee3a-7db3-aae3-1563bc0d1c05";
  await fs.writeFile(indexPath, [
    JSON.stringify({ id: currentId, thread_name: "Fix install command", updated_at: "2026-08-13T14:50:53.7570055Z" }),
    JSON.stringify({ id: archivedId, thread_name: "Archived task", updated_at: "2026-08-13T15:00:00Z" }),
    JSON.stringify({ id: agentId, thread_name: "Background reviewer", updated_at: "2026-08-13T16:00:00Z" }),
  ].join("\n"), "utf8");
  const database = new DatabaseSync(databasePath);
  try {
    database.exec(`
      CREATE TABLE threads (
        id TEXT PRIMARY KEY, cwd TEXT, git_branch TEXT, archived INTEGER,
        agent_role TEXT, updated_at_ms INTEGER, recency_at_ms INTEGER,
        is_pinned INTEGER, title TEXT, first_user_message TEXT, preview TEXT
      )
    `);
    const insert = database.prepare(`
      INSERT INTO threads
        (id, cwd, git_branch, archived, agent_role, updated_at_ms, recency_at_ms,
         is_pinned, title, first_user_message, preview)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insert.run(currentId, "C:\\work\\claude-aura", "work/full-theme-system", 0, null,
      1786632653757, 1786632653757, 1, "PRIVATE DATABASE TITLE", "SECRET PROMPT", "SECRET PREVIEW");
    insert.run(archivedId, "C:\\work\\gemini-aura", "work/aura-theme-port", 1, null,
      1786633200000, 1786633200000, 0, "Archived", "", "");
    insert.run(agentId, "C:\\work\\claude-aura", "work/full-theme-system", 0, "reviewer",
      1786636800000, 1786636800000, 0, "Agent", "", "");
  } finally {
    database.close();
  }
  try {
    const result = spawnSync(process.execPath, [
      codexSessionIndexPath, "--index", indexPath, "--database", databasePath, "--limit", "12",
    ], { cwd: PROJECT_ROOT, encoding: "utf8", windowsHide: true });
    assert.equal(result.status, 0, result.stderr);
    const output = JSON.parse(result.stdout);
    assert.deepEqual(output, {
      schemaVersion: 1,
      available: true,
      sessions: [{
        id: currentId,
        title: "Fix install command",
        updatedAt: 1786632653757,
        workspace: "claude-aura",
        branch: "work/full-theme-system",
        pinned: true,
      }],
    });
    assert.doesNotMatch(result.stdout, /PRIVATE|SECRET/u);
  } finally {
    await fs.rm(temporaryRoot, { recursive: true, force: true });
  }
});

test("Active tab visibility follows the resized tab-strip viewport", async () => {
  const source = await fs.readFile(taskboardAppPath, "utf8");
  const context = { window: {} };
  vm.runInNewContext(source, context, { filename: taskboardAppPath });
  const target = context.window.CLAUDE_AURA_TASKBOARD.destinationScrollTarget;

  assert.equal(target(0, 300, 500, 100), 300);
  assert.equal(target(400, 300, 350, 100), 350);
  assert.equal(target(400, 300, 450, 100), 400);
  assert.match(source, /ResizeObserver/);
});

test("Tight Side Panel keeps Action Queue visually identifiable", async () => {
  const styles = await fs.readFile(taskboardStylesPath, "utf8");
  assert.match(
    styles,
    /@media \(max-width: 760px\), \(max-height: 430px\)[\s\S]*?data-taskboard-destination="action-queue"\]::after[\s\S]*?mask-image:/,
  );
});

test("Side Panel counts only attention states and explicitly opened existing tasks", async () => {
  const source = await fs.readFile(taskboardAppPath, "utf8");
  const context = { window: {} };
  vm.runInNewContext(source, context, { filename: taskboardAppPath });
  const counts = context.window.CLAUDE_AURA_TASKBOARD.buildSideRouteCounts({
    tasks: [
      { id: "waiting", status: "needs-input" },
      { id: "reviewing", status: "review" },
      { id: "blocked", status: "blocked" },
      { id: "running", status: "in-progress" },
    ],
    activity: [
      { taskId: "waiting", kind: "opened" },
      { taskId: "waiting", kind: "opened" },
      { taskId: "running", kind: "opened" },
      { taskId: "reviewing", kind: "updated" },
      { taskId: "deleted", kind: "opened" },
    ],
    queue: [
      { status: "queued" },
      { status: "awaiting_user_action" },
      { status: "completed" },
    ],
  });

  assert.equal(counts.attention, 3);
  assert.equal(counts.recent, 2);
  assert.equal(counts["action-queue"], 2);
});

test("Studio accepts the body-free Action Queue projection and rejects prompt text", async () => {
  const source = await fs.readFile(taskboardAppPath, "utf8");
  const context = { window: {} };
  vm.runInNewContext(source, context, { filename: taskboardAppPath });
  const normalizeQueue = context.window.CLAUDE_AURA_TASKBOARD.normalizeQueue;
  const item = {
    commandId: "20000000-0000-4000-8000-000000000001",
    draftId: "a".repeat(32),
    draftFingerprint: "c".repeat(64),
    taskId: "30000000-0000-4000-8000-000000000001",
    localTargetId: "10000000-0000-5000-8000-000000000001",
    adapterKind: "claude-ai-assisted",
    adapterEpoch: 0,
    sequence: 0,
    causationCommandId: null,
    status: "queued",
    position: 0,
    priority: 40,
    receiptStage: "local_enqueued",
    receiptCertainty: "certain",
    drainMode: "user_mediated",
    statusApplicationMode: "automatic",
    statusEvidenceClass: "local",
    createdAt: 1786464000000,
    updatedAt: 1786464000000,
  };

  const normalized = normalizeQueue([item]);
  assert.equal(normalized.length, 1);
  assert.equal(normalized[0].draftId, item.draftId);
  assert.equal(normalizeQueue([{ ...item, text: "must stay encrypted" }]), null);
});

test("Task detail leads unfinished work into its Next message", async () => {
  const source = await fs.readFile(taskboardAppPath, "utf8");
  const context = { window: {} };
  vm.runInNewContext(source, context, { filename: taskboardAppPath });
  const primaryAction = context.window.CLAUDE_AURA_TASKBOARD.taskDestinationPrimaryAction;

  assert.equal(primaryAction({ status: "in-progress" }), "next-message");
  assert.equal(primaryAction({ status: "needs-input" }), "next-message");
  assert.equal(primaryAction({ status: "done" }), "edit");
});

test("Action Queue shows one primary action only for the current placeable head", async () => {
  const source = await fs.readFile(taskboardAppPath, "utf8");
  const context = { window: {} };
  vm.runInNewContext(source, context, { filename: taskboardAppPath });
  const presentation = context.window.CLAUDE_AURA_TASKBOARD.queueRowPresentation;
  const ready = {
    status: "queued",
    promptAvailable: true,
    fingerprintMatches: true,
    insertionAvailable: true,
    targetMatches: true,
    isHead: true,
  };

  assert.equal(presentation(ready).kind, "place");
  assert.equal(presentation({ ...ready, isHead: false }).reason, "taskboardQueueWaitingTurn");
  assert.equal(presentation({ ...ready, targetMatches: false }).reason, "taskboardQueueTargetChanged");
  assert.equal(presentation({ ...ready, fingerprintMatches: false }).reason, "taskboardQueuePromptChanged");
  assert.equal(presentation({ ...ready, status: "awaiting_user_action" }).kind, "sent-next");
  assert.equal(presentation({ ...ready, status: "completed" }).kind, "none");
});

test("Saved Prompt Action Queue remains explicit review-before-send compatibility logic", async () => {
  const [app, taskboard, styles, enLocale] = await Promise.all([
    fs.readFile(studioAppPath, "utf8"),
    fs.readFile(taskboardAppPath, "utf8"),
    fs.readFile(taskboardStylesPath, "utf8"),
    fs.readFile(enLocalePath, "utf8"),
  ]);

  assert.match(app, /getSavedPrompts:\s*\(\)\s*=>\s*promptShelf\.items/);
  assert.match(taskboard, /prompt\?\.fingerprint === item\.draftFingerprint/);
  assert.match(app,
    /insertSavedPrompt:[\s\S]{0,300}?"prompt-shelf-insert"[\s\S]{0,180}?queueCommandId[\s\S]{0,80}?draftFingerprint/);
  assert.match(app, /createSavedPrompt:[\s\S]{0,300}?"prompt-shelf-create"/);
  assert.match(app, /queueAfterRefresh/);
  assert.match(app,
    /readRequests\.delete\(requestId\)[\s\S]{0,500}?queueAfterRefresh[\s\S]{0,220}?cancelDraftCreation/);
  assert.match(app,
    /const promptShelfRefreshStarted = requestPromptShelfState\(\);[\s\S]{0,260}?cancelDraftCreation/);
  assert.match(taskboard, /renderActionQueue\b/);
  assert.match(taskboard, /mutate\("queue-draft"/);
  assert.match(taskboard, /createSavedPrompt\(text,[\s\S]{0,220}?taskId:/);
  assert.match(taskboard, /queueCreatedDraft/);
  assert.match(taskboard, /mutate\("queue-resolve"/);
  assert.match(taskboard,
    /insertSavedPrompt\(item\.draftId, item\.commandId, item\.draftFingerprint\)/);
  assert.doesNotMatch(taskboard, /recordPlacement:/);
  assert.doesNotMatch(app, /promptShelfInsert\.addEventListener/);
  assert.doesNotMatch(taskboard, /studio:\(tasks\|themes\|prompt-shelf\|/);
  assert.match(styles, /\.taskboard-queue-row/);
  assert.match(enLocale, /navActionQueue:\s*"Action Queue"/);
  assert.match(enLocale, /taskboardAddToQueue:\s*"Add to queue"/);
  assert.match(enLocale, /taskboardPlaceInComposer:\s*"Place in composer"/);
  assert.match(enLocale, /taskboardQueueSentNext:\s*"Sent - next"/);
});

test("Aura launcher opens a current-target Next action surface instead of Prompt Shelf", async () => {
  const [ui, taskboard, shelf, enHost, zhCnHost, zhHktwHost] = await Promise.all([
    fs.readFile(uiPath, "utf8"),
    fs.readFile(taskboardPath, "utf8"),
    fs.readFile(promptShelfPath, "utf8"),
    fs.readFile(path.join(PROJECT_ROOT, "windows", "locales", "en.json"), "utf8"),
    fs.readFile(path.join(PROJECT_ROOT, "windows", "locales", "zh-CN.json"), "utf8"),
    fs.readFile(path.join(PROJECT_ROOT, "windows", "locales", "zh-HKTW.json"), "utf8"),
  ]);

  assert.match(ui,
    /LauncherActionQueueItem\s*=\s*\[System\.Windows\.Forms\.ToolStripMenuItem\]::new\("\$\(\$script:UiCopy\.openActionQueue\)"\)/);
  assert.match(ui, /LauncherActionQueueItem\.ShortcutKeyDisplayString\s*=\s*'Ctrl\+Shift\+P'/);
  assert.match(ui, /LauncherActionQueueItem\.add_Click\(\{ Show-AuraTaskboardQueue \}\)/);
  assert.match(ui, /0x50\s*\{\s*\$eventArgs\.Handled\s*=\s*\$true;\s*Show-AuraTaskboardQueue/);
  assert.doesNotMatch(ui, /LauncherPromptShelfItem/);

  for (const name of [
    "Get-AuraTaskboardCurrentTargetQueue",
    "Invoke-AuraTaskboardHostMutation",
    "Complete-AuraTaskboardQueuePlacement",
    "Refresh-AuraTaskboardQueue",
    "New-AuraTaskboardQueueForm",
    "Show-AuraTaskboardQueue",
    "Dispose-AuraTaskboardQueue",
  ]) assert.match(taskboard, new RegExp(`function ${name}\\b`));
  assert.match(taskboard, /\[Windows\.Forms\.Form\]::new\(\)/);
  assert.match(taskboard, /Get-AuraPromptShelfCurrentTargetId/);
  assert.match(taskboard, /ConvertTo-AuraPromptShelfDraftFingerprint/);
  assert.match(taskboard, /Invoke-AuraPromptShelfInsert[\s\S]{0,260}?-QueueCommandId/);
  assert.match(taskboard, /queue-placement[\s\S]{0,260}?outcome = \$Outcome/);
  assert.match(taskboard, /queue-resolve[\s\S]{0,260}?outcome = 'sent'/);
  assert.doesNotMatch(taskboard, /SendKeys|keybd_event|mouse_event|auto[-_ ]?send/i);
  const projectionStart = taskboard.indexOf("function Get-AuraTaskboardCompanionProjection {");
  const projectionEnd = taskboard.indexOf("\nfunction ", projectionStart + 10);
  assert(projectionStart >= 0 && projectionEnd > projectionStart,
    "Taskboard is missing the bounded companion projection");
  const petProjection = taskboard.slice(projectionStart, projectionEnd);
  for (const key of [
    "schemaVersion", "revision", "targetAvailable", "queueCount",
    "headStatus", "canPlace", "uncertain", "changedAt",
  ]) assert.match(petProjection, new RegExp(`\\b${key}\\b`));
  assert.doesNotMatch(petProjection, /draftId|draftFingerprint|taskId|text|prompt/i,
    "Pet projection must stay body- and identity-free");
  assert.match(shelf, /QueueCommandId = \$QueueCommandId/);
  assert.match(shelf,
    /Complete-AuraTaskboardQueuePlacement[\s\S]{0,260}?QueueCommandId[\s\S]{0,160}?Outcome/);

  assert.equal(JSON.parse(enHost).openActionQueue, "Open Action Queue");
  assert.equal(JSON.parse(zhCnHost).openActionQueue, "打开操作队列");
  assert.equal(JSON.parse(zhHktwHost).openActionQueue, "開啟操作佇列");
});

test("Task rendering stays local and never infers provider state from Claude content", async () => {
  const [taskboard, panel] = await Promise.all([
    fs.readFile(taskboardAppPath, "utf8"),
    fs.readFile(desktopPanelPath, "utf8"),
  ]);
  assert.doesNotMatch(taskboard,
    /\b(?:fetch|WebSocket|EventSource|XMLHttpRequest)\b|claude\.ai|sessionStorage|localStorage/i);
  assert.doesNotMatch(panel,
    /CapturePreview|UIAutomation|ReadProcessMemory|GetWindowText|DevToolsProtocol|claude\.ai|Cookies?|sessionStorage|localStorage/i);
  assert.match(taskboard, /user-accepted/);
  assert.match(taskboard, /provider-observed/);
  assert.match(taskboard, /"accept-task"/);
  assert.match(panel, /SetVirtualHostNameToFolderMapping\(\s*'aura\.studio'/);
});

test("Studio bridge accepts only exact local taskboard messages", async () => {
  const [ui, taskboard] = await Promise.all([
    fs.readFile(uiPath, "utf8"),
    fs.readFile(taskboardPath, "utf8"),
  ]);
  assert.match(ui, /\. \(Join-Path \$PSScriptRoot 'aura-taskboard\.ps1'\)/);
  assert.match(ui, /'taskboard-read'/);
  assert.match(ui, /'taskboard-mutate'/);
  assert.match(ui, /Assert-AuraTaskboardStudioRequest -Message \$message/);
  assert.match(ui, /Test-AuraUiStudioDocumentUri -Uri \$sourceUri -AllowFragment/);
  assert.match(ui, /New-AuraTaskboardStudioSession/);
  assert.match(ui, /Send-AuraTaskboardStudioFailure -RequestId \$failedRequestId/);
  assert.match(taskboard,
    /'type', 'version', 'requestId', 'session', 'revision',[\s\S]{0,100}'commandEpoch', 'operation', 'payload'/);
  assert.match(taskboard, /Taskboard mutation session is invalid/);
  assert.match(taskboard, /revision-conflict/);
  assert.match(taskboard, /task-version-conflict/);
});

test("Action Queue records body-free target-bound local intent", async () => {
  if (process.platform !== "win32") return;
  const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "aura-action-queue-"));
  const harnessPath = path.join(temporaryRoot, "action-queue-smoke.ps1");
  const harness = `
$ErrorActionPreference='Stop'
$DataRoot='${psPath(temporaryRoot)}'
$script:StudioWebView=$null
. '${psPath(taskboardPath)}'
$document=New-AuraTaskboardDocument
$create=[PSCustomObject]@{
  title='Prepare the next review';description='Queue metadata must not contain this body.'
  status='todo';priority='high';labels=@();assignee='';startDate=$null;dueDate=$null
  relationIds=@();branch='';worktree='';providerThreadId=''
}
[void](Apply-AuraTaskboardMutation -Document $document -Operation 'create-task' -Payload $create)
$taskId=[string]$document.tasks[0].id
$taskVersion=[int]$document.tasks[0].version
$draftId=('a' * 32)
$targetId='10000000-0000-5000-8000-000000000001'
$payload=[PSCustomObject]@{
  taskId=$taskId;taskVersion=$taskVersion;draftId=$draftId;draftFingerprint=('c' * 64)
  localTargetId=$targetId;priority=40
}
Assert-AuraTaskboardStudioRequest -Message ([PSCustomObject]@{
  type='taskboard-mutate';version=1;requestId=[Guid]::NewGuid().ToString('D').ToLowerInvariant()
  session=[Guid]::NewGuid().ToString('D').ToLowerInvariant();revision=$document.revision
  commandEpoch=1;operation='queue-draft';payload=$payload
})
$queued=Apply-AuraTaskboardMutation -Document $document -Operation 'queue-draft' -Payload $payload
$commandId=[string]$document.queue[0].commandId
$placementPayload=[PSCustomObject]@{
  commandId=$commandId;draftFingerprint=('c' * 64);outcome='inserted'
}
Assert-AuraTaskboardStudioRequest -Message ([PSCustomObject]@{
  type='taskboard-mutate';version=1;requestId=[Guid]::NewGuid().ToString('D').ToLowerInvariant()
  session=[Guid]::NewGuid().ToString('D').ToLowerInvariant();revision=$document.revision
  commandEpoch=2;operation='queue-placement';payload=$placementPayload
})
$placed=Apply-AuraTaskboardMutation -Document $document -Operation 'queue-placement' -Payload $placementPayload
$placedItem=(ConvertTo-AuraTaskboardDocument -Value $document).queue[0]
$uncertainDraft=('b' * 32)
$uncertainQueuePayload=[PSCustomObject]@{
  taskId=$taskId;taskVersion=$taskVersion;draftId=$uncertainDraft;draftFingerprint=('d' * 64)
  localTargetId=$targetId;priority=20
}
[void](Apply-AuraTaskboardMutation -Document $document -Operation 'queue-draft' -Payload $uncertainQueuePayload)
$uncertainCommandId=[string]$document.queue[1].commandId
$changedPlacement=Apply-AuraTaskboardMutation -Document $document -Operation 'queue-placement' -Payload ([PSCustomObject]@{
  commandId=$uncertainCommandId;draftFingerprint=('e' * 64);outcome='inserted'
})
$uncertainPlacement=Apply-AuraTaskboardMutation -Document $document -Operation 'queue-placement' -Payload ([PSCustomObject]@{
  commandId=$uncertainCommandId;draftFingerprint=('d' * 64);outcome='uncertain'
})
$resolvePayload=[PSCustomObject]@{commandId=$commandId;outcome='sent'}
Assert-AuraTaskboardStudioRequest -Message ([PSCustomObject]@{
  type='taskboard-mutate';version=1;requestId=[Guid]::NewGuid().ToString('D').ToLowerInvariant()
  session=[Guid]::NewGuid().ToString('D').ToLowerInvariant();revision=$document.revision
  commandEpoch=3;operation='queue-resolve';payload=$resolvePayload
})
$resolved=Apply-AuraTaskboardMutation -Document $document -Operation 'queue-resolve' -Payload $resolvePayload
$normalized=ConvertTo-AuraTaskboardDocument -Value $document
$item=$placedItem
$finalFirst=$normalized.queue[0]
$uncertainItem=$normalized.queue[1]
$script:projectionFingerprintMatches=$false
function Get-AuraTaskboardCurrentTargetQueue {
  [PSCustomObject]@{
    Document=$normalized;TargetId=$targetId;InsertionAvailable=$true;Items=@($uncertainItem)
  }
}
function Test-AuraTaskboardQueueFingerprint { return $script:projectionFingerprintMatches }
$changedProjection=Get-AuraTaskboardCompanionProjection
$script:projectionFingerprintMatches=$true
$matchingProjection=Get-AuraTaskboardCompanionProjection
[ordered]@{
  result=$queued.Code
  placement=$placed.Code
  changedPlacement=$changedPlacement.Code
  uncertainPlacement=$uncertainPlacement.Code
  resolved=$resolved.Code
  schema=$normalized.schemaVersion
  projectName=$normalized.project.name
  queueCount=$normalized.queue.Count
  taskId=$item.taskId
  draftId=$item.draftId
  draftFingerprint=$item.draftFingerprint
  localTargetId=$item.localTargetId
  status=$item.status
  position=$item.position
  priority=$item.priority
  receiptStage=$item.receiptStage
  receiptCertainty=$item.receiptCertainty
  drainMode=$item.drainMode
  applicationMode=$item.statusApplicationMode
  evidence=$item.statusEvidenceClass
  resolvedStatus=$finalFirst.status
  resolvedEvidence=$finalFirst.statusEvidenceClass
  resolvedStage=$finalFirst.receiptStage
  uncertainStatus=$uncertainItem.status
  uncertainStage=$uncertainItem.receiptStage
  uncertainCertainty=$uncertainItem.receiptCertainty
  uncertainDrain=$uncertainItem.drainMode
  uncertainEvidence=$uncertainItem.statusEvidenceClass
  nextPosition=$uncertainItem.position
  receiptCount=$normalized.receipts.Count
  receiptStages=@($normalized.receipts | ForEach-Object { $_.stage })
  receiptCertainties=@($normalized.receipts | ForEach-Object { $_.certainty })
  projectionBlocksChangedDraft=(-not $changedProjection.canPlace)
  projectionAllowsMatchingDraft=$matchingProjection.canPlace
  taskVersionStable=([int]$normalized.tasks[0].version -eq $taskVersion)
  hasBody=($null -ne $item.PSObject.Properties['text'] -or $null -ne $item.PSObject.Properties['body'] -or
    @($normalized.receipts | Where-Object {
      $null -ne $_.PSObject.Properties['text'] -or $null -ne $_.PSObject.Properties['body']
    }).Count -gt 0)
} | ConvertTo-Json -Compress
`;
  await fs.writeFile(harnessPath, harness, "utf8");
  try {
    const result = spawnSync("powershell.exe", [
      "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", harnessPath,
    ], { cwd: PROJECT_ROOT, encoding: "utf8", windowsHide: true });
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    const output = JSON.parse(result.stdout.trim().split(/\r?\n/u).at(-1));
    assert.deepEqual(output, {
      result: "draft-queued",
      schema: 6,
      projectName: "Aura",
      queueCount: 2,
      taskId: output.taskId,
      draftId: "a".repeat(32),
      draftFingerprint: "c".repeat(64),
      localTargetId: output.localTargetId,
      placement: "draft-inserted",
      changedPlacement: "queue-draft-changed",
      uncertainPlacement: "draft-placement-uncertain",
      resolved: "queue-item-sent",
      status: "awaiting_user_action",
      position: 0,
      priority: 40,
      receiptStage: "draft_inserted",
      receiptCertainty: "certain",
      drainMode: "user_mediated",
      applicationMode: "user_mediated",
      evidence: "transport",
      resolvedStatus: "sent",
      resolvedEvidence: "user_reported",
      resolvedStage: "user_reported_sent",
      uncertainStatus: "uncertain",
      uncertainStage: "draft_inserted",
      uncertainCertainty: "uncertain",
      uncertainDrain: "retained",
      uncertainEvidence: "transport",
      nextPosition: 0,
      receiptCount: 5,
      receiptStages: [
        "local_enqueued", "draft_inserted", "local_enqueued", "draft_inserted",
        "user_reported_sent",
      ],
      receiptCertainties: ["certain", "certain", "certain", "uncertain", "certain"],
      projectionBlocksChangedDraft: true,
      projectionAllowsMatchingDraft: true,
      taskVersionStable: true,
      hasBody: false,
    });
    assert.match(output.taskId, /^[a-f0-9-]{36}$/u);
    assert.match(output.localTargetId, /^[a-f0-9-]{36}$/u);
  } finally {
    await fs.rm(temporaryRoot, { recursive: true, force: true });
  }
});

test("Linked real sessions persist explicit and provider-observed usage-limit termination", async () => {
  if (process.platform !== "win32") return;
  const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "aura-linked-session-"));
  const harnessPath = path.join(temporaryRoot, "linked-session-smoke.ps1");
  const harness = `
$ErrorActionPreference='Stop'
$DataRoot='${psPath(temporaryRoot)}'
$script:StudioWebView=$null
. '${psPath(taskboardPath)}'
$threadId='019ff38c-1816-7ef0-b185-26db0d8f4422'
$replacementThreadId='019ff75c-9b96-7172-9c9d-17696a1bfff4'
$document=New-AuraTaskboardDocument
$create=[PSCustomObject]@{
  title='Continue the real Codex session';description='';status='in-progress';priority='high'
  labels=@();assignee='';startDate=$null;dueDate=$null;relationIds=@();branch='';worktree=''
  providerThreadId=$threadId
}
$created=Apply-AuraTaskboardMutation -Document $document -Operation 'create-task' -Payload $create
$task=$document.tasks[0]
$initial=[ordered]@{
  state=$task.sessionState;reason=$task.sessionTerminationReason
  evidence=$task.sessionEvidence;updatedAt=$task.sessionUpdatedAt
}
$legacyTask=[PSCustomObject][ordered]@{
  id=$task.id;number=$task.number;version=$task.version;title=$task.title;description=$task.description
  status=$task.status;priority=$task.priority;labels=$task.labels;assignee=$task.assignee
  startDate=$task.startDate;dueDate=$task.dueDate;relationIds=$task.relationIds;comments=$task.comments
  branch=$task.branch;worktree=$task.worktree;providerThreadId=$task.providerThreadId
  createdAt=$task.createdAt;updatedAt=$task.updatedAt;acceptedAt=$task.acceptedAt
}
$legacyDocument=[PSCustomObject][ordered]@{
  schemaVersion=5;revision=$document.revision;nextTaskNumber=$document.nextTaskNumber
  project=$document.project;tasks=@($legacyTask);activity=$document.activity
  navigation=$document.navigation;queue=@();receipts=@()
}
$migratedLegacy=ConvertTo-AuraTaskboardDocument -Value $legacyDocument
$migratedLegacyTask=$migratedLegacy.tasks[0]
$legacySnapshot=[ordered]@{
  schema=$migratedLegacy.schemaVersion;state=$migratedLegacyTask.sessionState
  reason=$migratedLegacyTask.sessionTerminationReason;evidence=$migratedLegacyTask.sessionEvidence
}
$reportPayload=[PSCustomObject]@{
  id=$task.id;taskVersion=$task.version;providerThreadId=$threadId;reason='usage-limit'
}
Assert-AuraTaskboardStudioRequest -Message ([PSCustomObject]@{
  type='taskboard-mutate';version=1;requestId=[Guid]::NewGuid().ToString('D').ToLowerInvariant()
  session=[Guid]::NewGuid().ToString('D').ToLowerInvariant();revision=$document.revision
  commandEpoch=1;operation='report-session-termination';payload=$reportPayload
})
$studioObserveRejected=$false
try {
  Assert-AuraTaskboardStudioRequest -Message ([PSCustomObject]@{
    type='taskboard-mutate';version=1;requestId=[Guid]::NewGuid().ToString('D').ToLowerInvariant()
    session=[Guid]::NewGuid().ToString('D').ToLowerInvariant();revision=$document.revision
    commandEpoch=2;operation='observe-session-state';payload=[PSCustomObject]@{}
  })
} catch { $studioObserveRejected=$true }
$reported=Apply-AuraTaskboardMutation -Document $document -Operation 'report-session-termination' -Payload $reportPayload
$reportedTask=$document.tasks[0]
$reportedSnapshot=[ordered]@{
  status=$reportedTask.status;state=$reportedTask.sessionState
  reason=$reportedTask.sessionTerminationReason;evidence=$reportedTask.sessionEvidence
  activityKind=$document.activity[-1].kind;activityEvidence=$document.activity[-1].evidence
}
$resetStatePayload=[PSCustomObject]@{
  id=$reportedTask.id;taskVersion=$reportedTask.version;providerThreadId=$threadId
}
Assert-AuraTaskboardStudioRequest -Message ([PSCustomObject]@{
  type='taskboard-mutate';version=1;requestId=[Guid]::NewGuid().ToString('D').ToLowerInvariant()
  session=[Guid]::NewGuid().ToString('D').ToLowerInvariant();revision=$document.revision
  commandEpoch=3;operation='reset-session-state';payload=$resetStatePayload
})
$resetState=Apply-AuraTaskboardMutation -Document $document -Operation 'reset-session-state' -Payload $resetStatePayload
$resetStateTask=$document.tasks[0]
$resetStateSnapshot=[ordered]@{
  state=$resetStateTask.sessionState;reason=$resetStateTask.sessionTerminationReason
  evidence=$resetStateTask.sessionEvidence;status=$resetStateTask.status
}
$reportedAgain=Apply-AuraTaskboardMutation -Document $document -Operation 'report-session-termination' -Payload ([PSCustomObject]@{
  id=$resetStateTask.id;taskVersion=$resetStateTask.version;providerThreadId=$threadId;reason='usage-limit'
})
$terminatedAgainTask=$document.tasks[0]
$mismatch=Apply-AuraTaskboardMutation -Document $document -Operation 'report-session-termination' -Payload ([PSCustomObject]@{
  id=$terminatedAgainTask.id;taskVersion=$terminatedAgainTask.version
  providerThreadId=$replacementThreadId;reason='usage-limit'
})
$retarget=Apply-AuraTaskboardMutation -Document $document -Operation 'update-task' -Payload ([PSCustomObject]@{
  id=$terminatedAgainTask.id;taskVersion=$terminatedAgainTask.version
  patch=[PSCustomObject]@{providerThreadId=$replacementThreadId}
})
$retargetedTask=$document.tasks[0]
$retargetSnapshot=[ordered]@{
  state=$retargetedTask.sessionState;reason=$retargetedTask.sessionTerminationReason
  evidence=$retargetedTask.sessionEvidence;updatedAt=$retargetedTask.sessionUpdatedAt
}
$persistedReset=Write-AuraTaskboardDocument -Document $document
$active=Invoke-AuraTaskboardHostMutation -Operation 'observe-session-state' -Payload ([PSCustomObject]@{
  id=$retargetedTask.id;taskVersion=$retargetedTask.version;providerThreadId=$replacementThreadId
  state='active';reason=$null
})
$afterActive=Read-AuraTaskboardDocument
$activeTask=$afterActive.tasks[0]
$activeSnapshot=[ordered]@{
  state=$activeTask.sessionState;reason=$activeTask.sessionTerminationReason
  evidence=$activeTask.sessionEvidence
}
$observed=Invoke-AuraTaskboardHostMutation -Operation 'observe-session-state' -Payload ([PSCustomObject]@{
  id=$activeTask.id;taskVersion=$activeTask.version;providerThreadId=$replacementThreadId
  state='terminated';reason='usage-limit'
})
$afterObserved=Read-AuraTaskboardDocument
$observedTask=$afterObserved.tasks[0]
$resumed=Invoke-AuraTaskboardHostMutation -Operation 'observe-session-state' -Payload ([PSCustomObject]@{
  id=$observedTask.id;taskVersion=$observedTask.version;providerThreadId=$replacementThreadId
  state='active';reason=$null
})
$afterResumed=Read-AuraTaskboardDocument
$resumedTask=$afterResumed.tasks[0]
$resumedSnapshot=[ordered]@{
  state=$resumedTask.sessionState;reason=$resumedTask.sessionTerminationReason
  evidence=$resumedTask.sessionEvidence
}
$observedAgain=Invoke-AuraTaskboardHostMutation -Operation 'observe-session-state' -Payload ([PSCustomObject]@{
  id=$resumedTask.id;taskVersion=$resumedTask.version;providerThreadId=$replacementThreadId
  state='terminated';reason='usage-limit'
})
$read=Read-AuraTaskboardDocument
$finalTask=$read.tasks[0]
$raw=[IO.File]::ReadAllBytes($script:AuraTaskboardStatePath)
$plaintext=[Text.Encoding]::UTF8.GetString($raw)
[ordered]@{
  create=$created.Code;schema=$read.schemaVersion
  initial=$initial;legacySnapshot=$legacySnapshot
  reported=$reported.Code;reportedSnapshot=$reportedSnapshot
  studioObserveRejected=$studioObserveRejected
  resetState=$resetState.Code;resetStateSnapshot=$resetStateSnapshot
  reportedAgain=$reportedAgain.Code;mismatch=$mismatch.Code
  retarget=$retarget.Code;retargetSnapshot=$retargetSnapshot
  active=$active.Code;activeSnapshot=$activeSnapshot;observed=$observed.Code
  resumed=$resumed.Code;resumedSnapshot=$resumedSnapshot;observedAgain=$observedAgain.Code
  finalState=$finalTask.sessionState;finalReason=$finalTask.sessionTerminationReason
  finalEvidence=$finalTask.sessionEvidence;finalTaskStatus=$finalTask.status
  plaintextLeaked=$plaintext.Contains($threadId)
} | ConvertTo-Json -Depth 5 -Compress
`;
  await fs.writeFile(harnessPath, harness, "utf8");
  try {
    const result = spawnSync("powershell.exe", [
      "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", harnessPath,
    ], { cwd: PROJECT_ROOT, encoding: "utf8", windowsHide: true });
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    const output = JSON.parse(result.stdout.trim().split(/\r?\n/u).at(-1));
    assert.deepEqual(output, {
      create: "created",
      schema: 6,
      initial: {
        state: "linked", reason: null, evidence: "local",
        updatedAt: output.initial.updatedAt,
      },
      legacySnapshot: { schema: 6, state: "linked", reason: null, evidence: "local" },
      reported: "session-terminated",
      reportedSnapshot: {
        status: "in-progress", state: "terminated", reason: "usage-limit",
        evidence: "user-reported", activityKind: "session-state-changed",
        activityEvidence: "user-reported",
      },
      studioObserveRejected: true,
      resetState: "session-reset",
      resetStateSnapshot: {
        state: "linked", reason: null, evidence: "local", status: "in-progress",
      },
      reportedAgain: "session-terminated",
      mismatch: "session-link-mismatch",
      retarget: "updated",
      retargetSnapshot: {
        state: "linked", reason: null, evidence: "local",
        updatedAt: output.retargetSnapshot.updatedAt,
      },
      active: "session-active",
      activeSnapshot: { state: "active", reason: null, evidence: "provider-observed" },
      observed: "session-terminated",
      resumed: "session-active",
      resumedSnapshot: { state: "active", reason: null, evidence: "provider-observed" },
      observedAgain: "session-terminated",
      finalState: "terminated",
      finalReason: "usage-limit",
      finalEvidence: "provider-observed",
      finalTaskStatus: "in-progress",
      plaintextLeaked: false,
    });
    assert.equal(Number.isSafeInteger(output.initial.updatedAt), true);
    assert.equal(Number.isSafeInteger(output.retargetSnapshot.updatedAt), true);
  } finally {
    await fs.rm(temporaryRoot, { recursive: true, force: true });
  }
});

test("Task store is bounded, current-user encrypted, ACL-hardened, and atomically replaced", async () => {
  const source = await fs.readFile(taskboardPath, "utf8");
  assert.match(source, /AuraTaskboardMaximumFileBytes\s*=\s*2 \* 1024 \* 1024/);
  assert.match(source, /AuraTaskboardMaximumTasks\s*=\s*1000/);
  assert.match(source, /AuraTaskboardMaximumTabs\s*=\s*20/);
  assert.match(source,
    /ProtectedData\]::Protect\([\s\S]{0,220}?DataProtectionScope\]::CurrentUser/);
  assert.match(source,
    /ProtectedData\]::Unprotect\([\s\S]{0,220}?DataProtectionScope\]::CurrentUser/);
  assert.match(source, /SetAccessRuleProtection\(\$true, \$false\)/);
  assert.match(source, /LocalSystemSid/);
  assert.match(source, /\[IO\.File\]::Replace\(/);
  assert.match(source, /Assert-AuraTaskboardNotReparsePoint/);
  assert.doesNotMatch(source, /ConvertTo-SecureString|Export-Clixml/);
});

test("Task mutations persist through an encrypted PowerShell 5.1 round trip", async () => {
  if (process.platform !== "win32") return;
  const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "aura-taskboard-"));
  const harnessPath = path.join(temporaryRoot, "taskboard-smoke.ps1");
  const harness = `
$ErrorActionPreference='Stop'
$DataRoot='${psPath(temporaryRoot)}'
$script:StudioWebView=$null
. '${psPath(taskboardPath)}'
$document=New-AuraTaskboardDocument
$legacy=[PSCustomObject][ordered]@{
  schemaVersion=1;revision=0;nextTaskNumber=$document.nextTaskNumber;project=$document.project
  tasks=@();activity=@()
}
$migrated=ConvertTo-AuraTaskboardDocument -Value $legacy
$migratedAgain=ConvertTo-AuraTaskboardDocument -Value $legacy
$legacyV2=[PSCustomObject][ordered]@{
  schemaVersion=2;revision=0;nextTaskNumber=$document.nextTaskNumber;project=$document.project
  tasks=@();activity=@();navigation=$document.navigation
}
$migratedV2=ConvertTo-AuraTaskboardDocument -Value $legacyV2
$retiredShelfTabId='40000000-0000-4000-8000-000000000001'
$legacyPromptShelf=[PSCustomObject][ordered]@{
  schemaVersion=2;revision=0;nextTaskNumber=$document.nextTaskNumber;project=$document.project
  tasks=@();activity=@();navigation=[PSCustomObject][ordered]@{
    tabs=@([PSCustomObject][ordered]@{
      id=$retiredShelfTabId;destinationId='studio:prompt-shelf'
      destinationType='studio-page';safeTitle='Prompt Shelf'
    });activeTabId=$retiredShelfTabId
  }
}
$migratedPromptShelf=ConvertTo-AuraTaskboardDocument -Value $legacyPromptShelf
$retiredWorkHubTabId='40000000-0000-4000-8000-000000000002'
$legacyWorkHub=[PSCustomObject][ordered]@{
  schemaVersion=2;revision=0;nextTaskNumber=$document.nextTaskNumber;project=$document.project
  tasks=@();activity=@();navigation=[PSCustomObject][ordered]@{
    tabs=@([PSCustomObject][ordered]@{
      id=$retiredWorkHubTabId;destinationId='work-hub'
      destinationType='work-hub';safeTitle='Work Hub'
    });activeTabId=$retiredWorkHubTabId
  }
}
$migratedWorkHub=ConvertTo-AuraTaskboardDocument -Value $legacyWorkHub
$startsTabless=($document.navigation.tabs.Count -eq 0 -and $null -eq $document.navigation.activeTabId)
$pinnedHubDocument=New-AuraTaskboardDocument
$pinnedHub=Apply-AuraTaskboardMutation -Document $pinnedHubDocument -Operation 'open-destination' -Payload ([PSCustomObject]@{
  destinationId='work-hub';newTab=$false
})
$pinnedHubIsSynthetic=($pinnedHubDocument.navigation.tabs.Count -eq 0 -and
  $null -eq $pinnedHubDocument.navigation.activeTabId)
$create=[PSCustomObject]@{
  title='Inspect actual Studio taskboard';description='No provider transcript is stored.'
  status='needs-input';priority='high';labels=@('visual');assignee='Owner';startDate=$null
  dueDate=$null;relationIds=@();branch='work/taskboard';worktree='';providerThreadId=''
}
Assert-AuraTaskboardTaskFields -Value $create
$created=Apply-AuraTaskboardMutation -Document $document -Operation 'create-task' -Payload $create
$written=Write-AuraTaskboardDocument -Document $document
$read=Read-AuraTaskboardDocument
$id=[string]$read.tasks[0].id
$versionBeforeOpen=[int]$read.tasks[0].version
$updatedBeforeOpen=[long]$read.tasks[0].updatedAt
$projectUpdatedBeforeOpen=[long]$read.project.updatedAt
$opened=Apply-AuraTaskboardMutation -Document $read -Operation 'open-task' -Payload ([PSCustomObject]@{id=$id;newTab=$false})
$tabCountAfterOpen=[int]$read.navigation.tabs.Count
$openedAgain=Apply-AuraTaskboardMutation -Document $read -Operation 'open-task' -Payload ([PSCustomObject]@{id=$id;newTab=$false})
$tabCountAfterFocus=[int]$read.navigation.tabs.Count
$duplicated=Apply-AuraTaskboardMutation -Document $read -Operation 'open-task' -Payload ([PSCustomObject]@{id=$id;newTab=$true})
$taskTabs=@($read.navigation.tabs | Where-Object { $_.destinationId -ceq "task:$id" })
$reordered=Apply-AuraTaskboardMutation -Document $read -Operation 'reorder-tab' -Payload ([PSCustomObject]@{
  tabId=$taskTabs[1].id;index=0
})
$versionAfterOpen=[int]$read.tasks[0].version
$updatedAfterOpen=[long]$read.tasks[0].updatedAt
$projectUpdatedAfterOpen=[long]$read.project.updatedAt
$update=[PSCustomObject]@{id=$id;taskVersion=1;patch=[PSCustomObject]@{status='review'}}
Assert-AuraTaskboardStudioRequest -Message ([PSCustomObject]@{
  type='taskboard-mutate';version=1;requestId=[Guid]::NewGuid().ToString('D')
  session=[Guid]::NewGuid().ToString('D');revision=$read.revision;commandEpoch=1
  operation='update-task';payload=$update
})
$updated=Apply-AuraTaskboardMutation -Document $read -Operation 'update-task' -Payload $update
$accepted=Apply-AuraTaskboardMutation -Document $read -Operation 'accept-task' -Payload ([PSCustomObject]@{id=$id;taskVersion=2})
$locked=Apply-AuraTaskboardMutation -Document $read -Operation 'update-task' -Payload ([PSCustomObject]@{
  id=$id;taskVersion=3;patch=[PSCustomObject]@{title='Must stay locked'}
})
$final=Write-AuraTaskboardDocument -Document $read
$recovery=New-AuraTaskboardDocument
[void](Apply-AuraTaskboardMutation -Document $recovery -Operation 'create-task' -Payload $create)
$recoveryId=[string]$recovery.tasks[0].id
[void](Apply-AuraTaskboardMutation -Document $recovery -Operation 'open-task' -Payload ([PSCustomObject]@{id=$recoveryId;newTab=$false}))
[void](Apply-AuraTaskboardMutation -Document $recovery -Operation 'delete-task' -Payload ([PSCustomObject]@{id=$recoveryId;taskVersion=1}))
$unavailableTab=@($recovery.navigation.tabs | Where-Object { $_.destinationId -ceq "task:$recoveryId" })[0]
$unavailableRetained=($recovery.tasks.Count -eq 0 -and $null -ne $unavailableTab -and $unavailableTab.safeTitle -ceq $create.title)
$closed=Apply-AuraTaskboardMutation -Document $recovery -Operation 'close-tab' -Payload ([PSCustomObject]@{tabId=$unavailableTab.id})
$recoveryReturnedToHub=($recovery.navigation.tabs.Count -eq 0 -and $null -eq $recovery.navigation.activeTabId)
$capacity=New-AuraTaskboardDocument
for($slot=0;$slot -lt 20;$slot+=1){
  $capacityOpen=Apply-AuraTaskboardMutation -Document $capacity -Operation 'open-destination' -Payload ([PSCustomObject]@{
    destinationId='attention';newTab=$true
  })
  if(-not $capacityOpen.Ok){ throw "Capacity setup failed at slot $slot." }
}
$capacityBefore=[int]$capacity.navigation.tabs.Count
$capacityRefused=Apply-AuraTaskboardMutation -Document $capacity -Operation 'open-destination' -Payload ([PSCustomObject]@{
  destinationId='attention';newTab=$true
})
$capacityPreserved=($capacity.navigation.tabs.Count -eq 20 -and $capacity.navigation.activeTabId -ceq $capacity.navigation.tabs[-1].id)
$routes=New-AuraTaskboardDocument
foreach($destinationId in @('work-hub','attention','recent','action-queue','projects')){
  $routeOpen=Apply-AuraTaskboardMutation -Document $routes -Operation 'open-destination' -Payload ([PSCustomObject]@{
    destinationId=$destinationId;newTab=$false
  })
  if(-not $routeOpen.Ok){throw "Route open failed: $destinationId"}
}
$routeTypes=@($routes.navigation.tabs | ForEach-Object {[string]$_.destinationType})
$hubWithOpenTabs=New-AuraTaskboardDocument
foreach($destinationId in @('attention','recent','action-queue','projects','work-hub')){
  $routeOpen=Apply-AuraTaskboardMutation -Document $hubWithOpenTabs -Operation 'open-destination' -Payload ([PSCustomObject]@{
    destinationId=$destinationId;newTab=$false
  })
  if(-not $routeOpen.Ok){throw "Pinned route setup failed: $destinationId"}
}
$hubRoundTrip=ConvertTo-AuraTaskboardDocument -Value $hubWithOpenTabs
$hubWithOpenTabsStable=($hubRoundTrip.navigation.tabs.Count -eq 4 -and
  $null -eq $hubRoundTrip.navigation.activeTabId)
$raw=[IO.File]::ReadAllBytes($script:AuraTaskboardStatePath)
$plaintext=[Text.Encoding]::UTF8.GetString($raw)
[ordered]@{
  create=$created.Code;open=$opened.Code;update=$updated.Code;accept=$accepted.Code;locked=$locked.Code
  openAgain=$openedAgain.Code;duplicate=$duplicated.Code
  reorder=$reordered.Code
  recoveryClose=$closed.Code
  status=$final.tasks[0].status;evidence=$final.activity[-1].evidence
  openKind=$final.activity[1].kind
  schema=$final.schemaVersion;migratedSchema=$migrated.schemaVersion
  migratedV2Schema=$migratedV2.schemaVersion
  migratedPromptShelfDestination=$migratedPromptShelf.navigation.tabs[0].destinationId
  migratedWorkHubPinned=($migratedWorkHub.navigation.tabs.Count -eq 0 -and $null -eq $migratedWorkHub.navigation.activeTabId)
  startsTabless=$startsTabless
  pinnedHubCode=$pinnedHub.Code
  pinnedHubIsSynthetic=$pinnedHubIsSynthetic
  migratedTabless=($migrated.navigation.tabs.Count -eq 0 -and $null -eq $migrated.navigation.activeTabId)
  migratedTabStable=($migrated.navigation.tabs.Count -eq $migratedAgain.navigation.tabs.Count -and
    $migrated.navigation.activeTabId -eq $migratedAgain.navigation.activeTabId)
  normalOpenReused=($tabCountAfterOpen -eq 1 -and $tabCountAfterFocus -eq 1)
  duplicateCount=$taskTabs.Count
  duplicateIdsDistinct=($taskTabs[0].id -cne $taskTabs[1].id)
  activeTabPersisted=($final.navigation.activeTabId -ceq $taskTabs[1].id)
  reorderPersisted=($final.navigation.tabs[0].id -ceq $taskTabs[1].id)
  unavailableRetained=$unavailableRetained
  recoveryReturnedToHub=$recoveryReturnedToHub
  capacityBefore=$capacityBefore
  capacityCode=$capacityRefused.Code
  capacityPreserved=$capacityPreserved
  routeTypes=($routeTypes -join ',')
  hubWithOpenTabsStable=$hubWithOpenTabsStable
  openVersionStable=($versionBeforeOpen -eq $versionAfterOpen)
  openUpdatedStable=($updatedBeforeOpen -eq $updatedAfterOpen)
  projectUpdatedStable=($projectUpdatedBeforeOpen -eq $projectUpdatedAfterOpen)
  plaintextLeaked=$plaintext.Contains('Inspect actual Studio taskboard')
  revision=$final.revision
} | ConvertTo-Json -Compress
`;
  await fs.writeFile(harnessPath, harness, "utf8");
  try {
    const result = spawnSync("powershell.exe", [
      "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", harnessPath,
    ], { cwd: PROJECT_ROOT, encoding: "utf8", windowsHide: true });
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    const output = JSON.parse(result.stdout.trim().split(/\r?\n/u).at(-1));
    assert.deepEqual(output, {
      create: "created",
      open: "tab-opened",
      openAgain: "tab-focused",
      duplicate: "tab-duplicated",
      reorder: "tab-reordered",
      recoveryClose: "tab-closed",
      update: "updated",
      accept: "accepted",
      locked: "accepted-task-locked",
      status: "done",
      evidence: "user-accepted",
      openKind: "opened",
      schema: 6,
      migratedSchema: 6,
      migratedV2Schema: 6,
      migratedPromptShelfDestination: "studio:tasks",
      migratedWorkHubPinned: true,
      startsTabless: true,
      pinnedHubCode: "work-hub-pinned",
      pinnedHubIsSynthetic: true,
      migratedTabless: true,
      migratedTabStable: true,
      normalOpenReused: true,
      duplicateCount: 2,
      duplicateIdsDistinct: true,
      activeTabPersisted: true,
      reorderPersisted: true,
      unavailableRetained: true,
      recoveryReturnedToHub: true,
      capacityBefore: 20,
      capacityCode: "tab-limit",
      capacityPreserved: true,
      routeTypes: "attention,recent,action-queue,projects",
      hubWithOpenTabsStable: true,
      openVersionStable: true,
      openUpdatedStable: true,
      projectUpdatedStable: true,
      plaintextLeaked: false,
      revision: 7,
    });
  } finally {
    await fs.rm(temporaryRoot, { recursive: true, force: true });
  }
});

test("taskctl links the actual Codex thread and updates it without synthetic duplicates", async () => {
  if (process.platform !== "win32") return;
  const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "aura-taskctl-"));
  const dataRoot = path.join(temporaryRoot, "data");
  const threadId = "019ffb9a-b1d3-7381-b98c-f3c4f4bc902d";
  const baseArgs = [
    "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", taskctlPath,
    "sync", "-DataRoot", dataRoot, "-ThreadId", threadId,
    "-Worktree", PROJECT_ROOT, "-Branch", "work/full-theme-system", "-Json",
  ];
  try {
    const created = spawnSync("powershell.exe", [
      ...baseArgs, "-Title", "Actual Codex session",
    ], { cwd: PROJECT_ROOT, encoding: "utf8", windowsHide: true });
    assert.equal(created.status, 0, `${created.stdout}\n${created.stderr}`);
    const first = JSON.parse(created.stdout.trim().split(/\r?\n/u).at(-1));
    assert.equal(first.outcome, "created");
    assert.equal(first.task.threadId, threadId);
    assert.equal(first.task.sessionState, "active");

    const updated = spawnSync("powershell.exe", [
      ...baseArgs, "-Title", "Actual Codex session updated", "-Status", "needs-input",
    ], { cwd: PROJECT_ROOT, encoding: "utf8", windowsHide: true });
    assert.equal(updated.status, 0, `${updated.stdout}\n${updated.stderr}`);
    const second = JSON.parse(updated.stdout.trim().split(/\r?\n/u).at(-1));
    assert.equal(second.outcome, "updated");
    assert.equal(second.task.title, "Actual Codex session updated");
    assert.equal(second.task.status, "needs-input");
    assert.equal(second.task.sessionState, "active");

    const listed = spawnSync("powershell.exe", [
      "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", taskctlPath,
      "list", "-DataRoot", dataRoot, "-Json",
    ], { cwd: PROJECT_ROOT, encoding: "utf8", windowsHide: true });
    assert.equal(listed.status, 0, `${listed.stdout}\n${listed.stderr}`);
    const board = JSON.parse(listed.stdout.trim().split(/\r?\n/u).at(-1));
    assert.equal(board.tasks.length, 1);
    assert.equal(board.tasks[0].threadId, threadId);
    const encrypted = await fs.readFile(path.join(dataRoot, "taskboard", "tasks.bin"));
    assert.equal(encrypted.includes(Buffer.from(threadId, "utf8")), false,
      "The encrypted Work Hub file must not expose the Codex thread id");
  } finally {
    await fs.rm(temporaryRoot, { recursive: true, force: true });
  }
});

test("Desktop Work Hub panel is bounded to the verified Claude window and closes cleanly", async () => {
  const [panel, overlay] = await Promise.all([
    fs.readFile(desktopPanelPath, "utf8"),
    fs.readFile(desktopOverlayPath, "utf8"),
  ]);
  assert.match(panel, /IsOwnedTarget\(target, expectedProcessId\)/);
  assert.match(panel, /GetWindowThreadProcessId\(target, out actualProcessId\)/);
  assert.match(panel, /GetWindowRect\(target, out frame\)/);
  assert.match(panel, /GetForegroundWindow\(\)/);
  assert.match(panel, /width - sidebarInset - edgeInset/);
  assert.match(panel, /Invoke-AuraSessionBoardDesktopClientRequest/);
  assert.match(panel, /Navigate\('https:\/\/aura\.studio\/work-hub\.html'\)/);
  assert.match(panel, /ClaudeAura\.WorkHubPanel/);
  assert.match(panel, /\[Threading\.EventWaitHandle\]::new/);
  assert.match(overlay, /DesktopWorkHubPanelController/);
  assert.match(overlay, /desktop-taskboard-panel\.ps1/);
  assert.match(overlay, /else if \(index == -4\) toggleWorkHub\(\)/);
  assert.doesNotMatch(`${panel}\n${overlay}`, /Stop-Process|\.Kill\(\)/);
});

test("Desktop panel host and overlay C# compile under Windows PowerShell", async () => {
  if (process.platform !== "win32") return;
  const panelResult = spawnSync("powershell.exe", [
    "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", desktopPanelPath,
    "-TargetWindow", "1", "-TargetProcessId", "1",
  ], { cwd: PROJECT_ROOT, encoding: "utf8", windowsHide: true });
  assert.notEqual(panelResult.status, 0);
  assert.match(`${panelResult.stdout}\n${panelResult.stderr}`, /desktop-work-hub-target-invalid/);
  assert.doesNotMatch(`${panelResult.stdout}\n${panelResult.stderr}`, /Add-Type|CompilerError|error CS\d+/i);

  const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "aura-taskboard-compile-"));
  const harnessPath = path.join(temporaryRoot, "compile-overlay.ps1");
  const harness = `
$ErrorActionPreference='Stop'
$content=Get-Content -LiteralPath '${psPath(desktopOverlayPath)}' -Raw
$marker="-TypeDefinition @'"
$start=$content.IndexOf($marker,[StringComparison]::Ordinal)+$marker.Length
if($content.Substring($start,2) -eq "\u0060r\u0060n"){$start+=2}else{$start+=1}
$end=$content.IndexOf("\u0060n'@",$start,[StringComparison]::Ordinal)
$source=$content.Substring($start,$end-$start)
foreach($assembly in @('System.Windows.Forms','System.Drawing','PresentationCore','WindowsBase','System.Xaml','UIAutomationClient','UIAutomationTypes')){Add-Type -AssemblyName $assembly}
Add-Type -ReferencedAssemblies @('System.Windows.Forms','System.Drawing','PresentationCore','WindowsBase','System.Xaml','UIAutomationClient','UIAutomationTypes') -TypeDefinition $source
'compiled'
`;
  await fs.writeFile(harnessPath, harness, "utf8");
  try {
    const result = spawnSync("powershell.exe", [
      "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", harnessPath,
    ], { cwd: PROJECT_ROOT, encoding: "utf8", windowsHide: true });
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    assert.match(result.stdout, /compiled/);
  } finally {
    await fs.rm(temporaryRoot, { recursive: true, force: true });
  }
});

runIfMain(import.meta.url);
