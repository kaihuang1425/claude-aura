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

const sessionDockPath = path.join(PROJECT_ROOT, "windows", "aura-session-dock.ps1");
const webTabsPath = path.join(PROJECT_ROOT, "windows", "aura-web-tabs.ps1");
const uiPath = path.join(PROJECT_ROOT, "windows", "aura-ui.ps1");
const compactPath = path.join(PROJECT_ROOT, "studio", "work-hub.html");
const studioAppPath = path.join(PROJECT_ROOT, "studio", "app.js");
const psPath = (value) => value.replaceAll("'", "''");

async function runPowerShellHarness(prefix, source) {
  const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
  const harnessPath = path.join(temporaryRoot, "harness.ps1");
  await fs.writeFile(harnessPath, source, "utf8");
  try {
    const result = spawnSync("powershell.exe", [
      "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", harnessPath,
    ], { cwd: PROJECT_ROOT, encoding: "utf8", windowsHide: true });
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    return JSON.parse(result.stdout.trim().split(/\r?\n/u).at(-1));
  } finally {
    await fs.rm(temporaryRoot, { recursive: true, force: true });
  }
}

test("native Work Hub accepts only exact v1 requests from its two local documents", async () => {
  if (process.platform !== "win32") return;
  const dataRoot = await fs.mkdtemp(path.join(os.tmpdir(), "aura-session-board-parse-data-"));
  try {
    const actual = await runPowerShellHarness("aura-session-board-parse-", `
$ErrorActionPreference='Stop'
[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false)
$OutputEncoding=[Console]::OutputEncoding
$DataRoot='${psPath(dataRoot)}'
. '${psPath(sessionDockPath)}'
$parser=Get-Command Get-AuraSessionBoardHostRequest -ErrorAction SilentlyContinue
$readId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
$openId='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
$sessionId='11111111-1111-4111-8111-111111111111'
$studio='https://aura.studio/index.html?locale=en#tasks'
$compact='https://aura.studio/work-hub.html'
$read=$null;$open=$null;$rejected=0
function Test-Rejected {param([string]$Json,[string]$Source,[string]$Surface)
  try{[void](Get-AuraSessionBoardHostRequest -Json $Json -Source $Source -Surface $Surface);return $false}
  catch{return $true}
}
if($null-ne$parser){
  $read=Get-AuraSessionBoardHostRequest -Json ('{"type":"session-board-read","version":1,"requestId":"'+$readId+'"}') -Source $studio -Surface studio
  $open=Get-AuraSessionBoardHostRequest -Json ('{"type":"session-board-open","version":1,"requestId":"'+$openId+'","sessionId":"'+$sessionId+'"}') -Source $compact -Surface compact
  $cases=@(
    [PSCustomObject]@{Json='{"type":"session-board-read","version":1,"requestId":"'+$readId+'","extra":true}';Source=$studio;Surface='studio'},
    [PSCustomObject]@{Json='{"type":"session-board-read","version":2,"requestId":"'+$readId+'"}';Source=$studio;Surface='studio'},
    [PSCustomObject]@{Json='{"type":"session-board-read","version":1,"requestId":"BAD"}';Source=$studio;Surface='studio'},
    [PSCustomObject]@{Json='{"type":"session-board-open","version":1,"requestId":"'+$openId+'"}';Source=$compact;Surface='compact'},
    [PSCustomObject]@{Json='{"type":"session-board-open","version":1,"requestId":"'+$openId+'","sessionId":"bad"}';Source=$compact;Surface='compact'},
    [PSCustomObject]@{Json='{"type":"session-board-open","version":1,"requestId":"'+$openId+'","sessionId":"'+$sessionId+'","extra":true}';Source=$compact;Surface='compact'},
    [PSCustomObject]@{Json='{"type":"taskboard-read","version":1,"requestId":"'+$readId+'"}';Source=$studio;Surface='studio'},
    [PSCustomObject]@{Json='{"type":"session-board-read","version":1,"requestId":"'+$readId+'"}';Source='https://evil.example/index.html';Surface='studio'},
    [PSCustomObject]@{Json='{"type":"session-board-read","version":1,"requestId":"'+$readId+'"}';Source='https://aura.studio.evil.example/index.html';Surface='studio'},
    [PSCustomObject]@{Json='{"type":"session-board-read","version":1,"requestId":"'+$readId+'"}';Source='https://user@aura.studio/index.html?locale=en';Surface='studio'},
    [PSCustomObject]@{Json='{"type":"session-board-read","version":1,"requestId":"'+$readId+'"}';Source='https://aura.studio:444/index.html?locale=en';Surface='studio'},
    [PSCustomObject]@{Json='{"type":"session-board-read","version":1,"requestId":"'+$readId+'"}';Source=$compact;Surface='studio'},
    [PSCustomObject]@{Json='{"type":"session-board-read","version":1,"requestId":"'+$readId+'"}';Source=$studio;Surface='compact'},
    [PSCustomObject]@{Json='{"type":"session-board-read","version":1,"requestId":"'+$readId+'"}';Source='https://aura.studio/work-hub.html?locale=en';Surface='compact'}
  )
  foreach($case in $cases){if(Test-Rejected -Json $case.Json -Source $case.Source -Surface $case.Surface){$rejected+=1}}
}
$readFields=@();$openFields=@()
if($null-ne$read){$readFields=@($read.PSObject.Properties.Name)}
if($null-ne$open){$openFields=@($open.PSObject.Properties.Name)}
[ordered]@{
  available=$null-ne$parser
  readFields=$readFields
  readType=if($null-eq$read){''}else{[string]$read.type}
  readVersion=if($null-eq$read){0}else{[int]$read.version}
  readRequestId=if($null-eq$read){''}else{[string]$read.requestId}
  openFields=$openFields
  openType=if($null-eq$open){''}else{[string]$open.type}
  openRequestId=if($null-eq$open){''}else{[string]$open.requestId}
  openSessionId=if($null-eq$open){''}else{[string]$open.sessionId}
  rejected=$rejected
}|ConvertTo-Json -Depth 5 -Compress
`);
    assert.deepEqual(actual, {
      available: true,
      readFields: ["type", "version", "requestId"],
      readType: "session-board-read",
      readVersion: 1,
      readRequestId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      openFields: ["type", "version", "requestId", "sessionId"],
      openType: "session-board-open",
      openRequestId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      openSessionId: "11111111-1111-4111-8111-111111111111",
      rejected: 14,
    });
  } finally {
    await fs.rm(dataRoot, { recursive: true, force: true });
  }
});

test("native Work Hub dispatches one shared body-free projection and explicit open receipts", async () => {
  if (process.platform !== "win32") return;
  const unicodeTitle = "\u7B80\u4F53\u4E2D\u6587 \u7E41\u9AD4\u4E2D\u6587 \u{20000} \uD83E\uDDE0";
  const unicodeTitleBase64 = Buffer.from(unicodeTitle, "utf8").toString("base64");
  const dataRoot = await fs.mkdtemp(path.join(os.tmpdir(), "aura-session-board-dispatch-data-"));
  try {
    const actual = await runPowerShellHarness("aura-session-board-dispatch-", `
$ErrorActionPreference='Stop'
[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false)
$OutputEncoding=[Console]::OutputEncoding
$DataRoot='${psPath(dataRoot)}'
. '${psPath(sessionDockPath)}'
$dispatcher=Get-Command Invoke-AuraSessionBoardHostRequest -ErrorAction SilentlyContinue
$script:ProjectionCalls=0;$script:OpenCalls=[Collections.Generic.List[string]]::new();$script:ShowCalls=0;$script:ProjectionFails=$false
function Get-AuraSessionWorkHubProjection {
  $script:ProjectionCalls+=1
  if($script:ProjectionFails){throw 'projection unavailable'}
  return [PSCustomObject][ordered]@{schemaVersion=1;kind='session-board-state';revision=7;changedAt=9000;sessions=@(
    [PSCustomObject][ordered]@{
      id='11111111-1111-4111-8111-111111111111';url='https://claude.ai/chat/opaque_one'
      title=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${unicodeTitleBase64}'))
      kind='chat';state='active';firstSeenAt=1000;lastOpenedAt=2000
      response=[PSCustomObject][ordered]@{state='working';evidence='network';changedAt=3000}
    }
  )}
}
function Open-AuraSessionWorkHubSession {param([string]$SessionId)
  [void]$script:OpenCalls.Add($SessionId)
  if($SessionId-ceq'11111111-1111-4111-8111-111111111111'){return 'opened'}
  return 'unavailable'
}
function Open-AuraKnownSession {throw 'Host must call only Open-AuraSessionWorkHubSession.'}
function Open-AuraSessionDockSession {throw 'Host must call only Open-AuraSessionWorkHubSession.'}
function Show-AuraUiMain {$script:ShowCalls+=1}
function Read-AuraTaskboardDocument {throw 'Session board must not read taskboard.'}
function Write-AuraTaskboardDocument {throw 'Session board must not write taskboard.'}
function Read-AuraPromptShelfItems {throw 'Session board must not read Prompt Shelf.'}
$readId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';$openId='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';$failId='cccccccc-cccc-4ccc-8ccc-cccccccccccc'
$studio='https://aura.studio/index.html?locale=en#tasks';$compact='https://aura.studio/work-hub.html'
$state=$null;$opened=$null;$failed=$null;$readError=$null
if($null-ne$dispatcher){
  $state=Invoke-AuraSessionBoardHostRequest -Json ('{"type":"session-board-read","version":1,"requestId":"'+$readId+'"}') -Source $studio -Surface studio
  $opened=Invoke-AuraSessionBoardHostRequest -Json ('{"type":"session-board-open","version":1,"requestId":"'+$openId+'","sessionId":"11111111-1111-4111-8111-111111111111"}') -Source $studio -Surface studio
  $failed=Invoke-AuraSessionBoardHostRequest -Json ('{"type":"session-board-open","version":1,"requestId":"'+$failId+'","sessionId":"22222222-2222-4222-8222-222222222222"}') -Source $compact -Surface compact
  $script:ProjectionFails=$true
  $readError=Invoke-AuraSessionBoardHostRequest -Json ('{"type":"session-board-read","version":1,"requestId":"'+$failId+'"}') -Source $compact -Surface compact
}
$session=if($null-eq$state-or$null-eq$state.state-or@($state.state.sessions).Count-eq0){$null}else{@($state.state.sessions)[0]}
$json=if($null-eq$state){''}else{$state|ConvertTo-Json -Depth 8 -Compress}
$definition=if($null-eq$dispatcher){''}else{[string]$dispatcher.Definition}
$stateFields=@();$projectionFields=@();$sessionFields=@();$responseFields=@();$openedFields=@();$errorFields=@()
if($null-ne$state){$stateFields=@($state.PSObject.Properties.Name)}
if($null-ne$state-and$null-ne$state.state){$projectionFields=@($state.state.PSObject.Properties.Name)}
if($null-ne$session){$sessionFields=@($session.PSObject.Properties.Name);$responseFields=@($session.response.PSObject.Properties.Name)}
if($null-ne$opened){$openedFields=@($opened.PSObject.Properties.Name)}
if($null-ne$readError){$errorFields=@($readError.PSObject.Properties.Name)}
[ordered]@{
  available=$null-ne$dispatcher
  stateFields=$stateFields
  stateType=if($null-eq$state){''}else{[string]$state.type}
  stateRequestId=if($null-eq$state){''}else{[string]$state.requestId}
  projectionFields=$projectionFields
  sessionFields=$sessionFields
  responseFields=$responseFields
  unicodeTitle=if($null-eq$session){''}else{[string]$session.title}
  bodyFree=$json-cnotmatch'(?i)https?:|url|prompt|body|todo|project'
  openedFields=$openedFields
  opened=if($null-eq$opened){$null}else{$opened}
  failed=if($null-eq$failed){$null}else{$failed}
  errorFields=$errorFields
  error=if($null-eq$readError){$null}else{$readError}
  projectionCalls=$script:ProjectionCalls
  openCalls=@($script:OpenCalls)
  showCalls=$script:ShowCalls
  sharedOnly=$definition-cmatch'Get-AuraSessionWorkHubProjection'-and$definition-cmatch'Open-AuraSessionWorkHubSession'-and$definition-cnotmatch'(?i)taskboard|prompt-shelf|Open-AuraKnownSession|Open-AuraSessionDockSession'
}|ConvertTo-Json -Depth 9 -Compress
`);
    assert.equal(actual.available, true);
    assert.deepEqual(actual.stateFields, ["type", "version", "requestId", "state"]);
    assert.equal(actual.stateType, "session-board-state");
    assert.equal(actual.stateRequestId, "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
    assert.deepEqual(actual.projectionFields, ["schemaVersion", "kind", "revision", "changedAt", "sessions"]);
    assert.deepEqual(actual.sessionFields,
      ["id", "title", "kind", "state", "firstSeenAt", "lastOpenedAt", "response"]);
    assert.deepEqual(actual.responseFields, ["state", "evidence", "changedAt"]);
    assert.equal(actual.unicodeTitle, unicodeTitle);
    assert.equal(actual.bodyFree, true);
    assert.deepEqual(actual.openedFields,
      ["type", "version", "requestId", "sessionId", "ok", "outcome"]);
    assert.deepEqual(actual.opened, {
      type: "session-board-open-result",
      version: 1,
      requestId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      sessionId: "11111111-1111-4111-8111-111111111111",
      ok: true,
      outcome: "opened",
    });
    assert.deepEqual(actual.failed, {
      type: "session-board-open-result",
      version: 1,
      requestId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      sessionId: "22222222-2222-4222-8222-222222222222",
      ok: false,
      outcome: "unavailable",
    });
    assert.deepEqual(actual.errorFields, ["type", "version", "requestId", "action", "code"]);
    assert.deepEqual(actual.error, {
      type: "session-board-error",
      version: 1,
      requestId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      action: "read",
      code: "unavailable",
    });
    assert.equal(actual.projectionCalls, 2);
    assert.deepEqual(actual.openCalls, [
      "11111111-1111-4111-8111-111111111111",
      "22222222-2222-4222-8222-222222222222",
    ]);
    assert.equal(actual.showCalls, 1, "Only a successful Studio open brings Aura main forward");
    assert.equal(actual.sharedOnly, true);
  } finally {
    await fs.rm(dataRoot, { recursive: true, force: true });
  }
});

test("main compact and Studio surfaces wire the same native host without touching provider navigation", async () => {
  const [dock, tabs, ui, compact, app] = await Promise.all([
    fs.readFile(sessionDockPath, "utf8"),
    fs.readFile(webTabsPath, "utf8"),
    fs.readFile(uiPath, "utf8"),
    fs.readFile(compactPath, "utf8"),
    fs.readFile(studioAppPath, "utf8"),
  ]);
  const native = `${tabs}\n${ui}`;
  assert.match(dock, /function Get-AuraSessionBoardHostRequest\b/u);
  assert.match(dock, /function Invoke-AuraSessionBoardHostRequest\b/u);
  assert.match(dock, /Get-AuraSessionWorkHubProjection/u);
  assert.match(dock, /Open-AuraSessionWorkHubSession/u);

  assert.match(tabs, /AuraWebTabWorkHubWebView/u);
  assert.match(native, /Microsoft\.Web\.WebView2\.WinForms\.WebView2\]::new\(\)/u);
  assert.match(tabs, /AuraWebTabWorkHubControl\.Controls\.Add\([^)]*AuraWebTabWorkHubWebView/u);
  assert.match(native, /https:\/\/aura\.studio\/work-hub\.html/u);
  assert.match(native, /SetVirtualHostNameToFolderMapping\([\s\S]{0,120}?'aura\.studio'/u);
  assert.match(native,
    /add_NavigationStarting[\s\S]{0,700}?Test-AuraSessionBoardDocumentUri[\s\S]{0,220}?\$eventArgs\.Cancel\s*=\s*\$true/u);
  assert.match(native, /add_WebMessageReceived[\s\S]{0,700}?Invoke-AuraSessionBoardHostRequest[\s\S]{0,220}?Surface\s+'compact'[\s\S]{0,220}?PostWebMessageAsJson/u);
  const workHubActivation = /function Set-AuraWebTabWorkHubActive\b[\s\S]*?^\}/mu.exec(tabs)?.[0] ?? "";
  assert(workHubActivation);
  assert.doesNotMatch(workHubActivation,
    /EnsureCoreWebView2Async|\.Navigate\(|\.Reload\(|\.Dispose\(/u,
    "Selecting Work Hub must not initialize, navigate, refresh, or dispose a provider view");

  assert.match(ui, /'session-board-read'/u);
  assert.match(ui, /'session-board-open'/u);
  assert.match(ui, /Invoke-AuraSessionBoardHostRequest[\s\S]{0,300}?Surface\s+'studio'/u);
  assert.match(ui, /PostWebMessageAsJson/u);
  assert.match(ui, /https:\/\/aura\.studio\/index\.html/u);
  assert.doesNotMatch(ui,
    /session-board-(?:read|open)[\s\S]{0,500}?(?:Read-AuraTaskboardDocument|Read-AuraPromptShelfItems)/u);

  assert.match(compact, /session-board\.css\?v=\d+/u);
  assert.match(compact, /session-board\.js\?v=\d+/u);
  const inlineScripts = [...compact.matchAll(/<script>([\s\S]*?)<\/script>/gu)];
  assert(inlineScripts.length > 0, "Compact Work Hub bootstrap script is missing");
  const received = { presentation: [], controller: [], render: 0, ensure: 0 };
  let messageListener = null;
  const presenter = {
    t: (key) => key,
    refreshSystemAppearance() {},
    receive(message) {
      received.presentation.push(message);
      return message?.type === "session-board-presentation";
    },
  };
  const controller = {
    ensure() { received.ensure += 1; },
    render() { received.render += 1; },
    receive(message) { received.controller.push(message); return true; },
  };
  const window = {
    chrome: { webview: {
      addEventListener(type, listener) { if (type === "message") messageListener = listener; },
      postMessage() {},
    } },
    matchMedia: () => ({ matches: false, addEventListener() {} }),
    CLAUDE_AURA_STRINGS: {},
    CLAUDE_AURA_THEMES: {},
    CLAUDE_AURA_SESSION_BOARD_PRESENTATION: {
      createSessionBoardPresentation: () => presenter,
    },
    CLAUDE_AURA_SESSION_BOARD: { createSessionBoard: () => controller },
  };
  vm.runInNewContext(inlineScripts.at(-1)[1], {
    window,
    document: { querySelector: () => ({}) },
  }, { filename: compactPath });
  assert.equal(typeof messageListener, "function");
  const presentationMessage = { type: "session-board-presentation" };
  const sessionMessage = { type: "session-board-state" };
  messageListener({ data: presentationMessage });
  messageListener({ data: sessionMessage });
  assert.deepEqual(received.presentation, [presentationMessage, sessionMessage]);
  assert.deepEqual(received.controller, [sessionMessage]);
  assert.equal(received.ensure, 1);
  assert.equal(received.render, 1);
  assert.doesNotMatch(compact, /set-theme|set-locale|taskboard|prompt-shelf/iu);
  assert.match(app, /sessionBoardController\?\.receive\?\.\(data\)/u);
});

runIfMain(import.meta.url);
