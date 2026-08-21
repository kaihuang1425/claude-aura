import { spawn } from "node:child_process";
import { createConnection } from "node:net";
import { createInterface } from "node:readline";

import { test, runIfMain } from "./support/harness.mjs";
import {
  PROJECT_ROOT,
  assert,
  fs,
  os,
  path,
} from "./support/context.mjs";

const panelPath = path.join(PROJECT_ROOT, "windows", "desktop-taskboard-panel.ps1");
const overlayPath = path.join(PROJECT_ROOT, "windows", "desktop-overlay-proof.ps1");
const desktopHostPath = path.join(PROJECT_ROOT, "windows", "aura-session-board-desktop.ps1");
const sessionDockPath = path.join(PROJECT_ROOT, "windows", "aura-session-dock.ps1");
const taskboardPath = path.join(PROJECT_ROOT, "windows", "aura-taskboard.ps1");
const uiPath = path.join(PROJECT_ROOT, "windows", "aura-ui.ps1");
const compactPath = path.join(PROJECT_ROOT, "studio", "work-hub.html");
const boardScriptPath = path.join(PROJECT_ROOT, "studio", "session-board.js");
const boardStylesPath = path.join(PROJECT_ROOT, "studio", "session-board.css");

const psPath = (value) => value.replaceAll("'", "''");
const contractId = "claude-aura-session-board-desktop-v1";
const unicodeTitle = "简体中文 | 繁體中文 | 日本語 | 한국어 | 𠀀 | 👩🏽‍💻 | Café | ⌘ § ∞ ⌁";

async function readIfPresent(file) {
  try { return await fs.readFile(file, "utf8"); }
  catch (error) {
    if (error?.code === "ENOENT") return "";
    throw error;
  }
}

function withTimeout(promise, timeoutMs, label) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out`)), timeoutMs);
    promise.then(
      (value) => { clearTimeout(timer); resolve(value); },
      (error) => { clearTimeout(timer); reject(error); },
    );
  });
}

function waitForOutputLine(stream, expected, getStderr, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    let buffered = "";
    const timer = setTimeout(() => finish(new Error(
      `timeout waiting for ${expected}\n${getStderr()}`)), timeoutMs);
    const finish = (error) => {
      clearTimeout(timer);
      stream.off("data", onData);
      if (error) reject(error); else resolve();
    };
    const onData = (chunk) => {
      buffered += chunk.toString("utf8");
      for (;;) {
        const newline = buffered.indexOf("\n");
        if (newline < 0) return;
        const line = buffered.slice(0, newline).trim();
        buffered = buffered.slice(newline + 1);
        if (line === expected) return finish();
      }
    };
    stream.on("data", onData);
  });
}

function waitForSocketClose(socket, label, timeoutMs = 2000) {
  return withTimeout(new Promise((resolve) => {
    const finish = () => {
      socket.off("close", finish);
      socket.off("end", finish);
      socket.off("error", finish);
      resolve();
    };
    socket.once("close", finish);
    socket.once("end", finish);
    socket.once("error", finish);
  }), timeoutMs, label);
}

async function connectPipe(pipeName, timeoutMs = 3000) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      return await withTimeout(new Promise((resolve, reject) => {
        const socket = createConnection(`\\\\.\\pipe\\${pipeName}`);
        const fail = (error) => { socket.destroy(); reject(error); };
        socket.once("error", fail);
        socket.once("connect", () => {
          socket.off("error", fail);
          resolve(socket);
        });
      }), Math.max(1, deadline - Date.now()), "Desktop Work Hub pipe connection");
    } catch (error) {
      if (Date.now() >= deadline) throw error;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  }
}

async function nextJson(iterator, label) {
  const item = await withTimeout(iterator.next(), 3000, label);
  assert.equal(item.done, false, `${label} closed before a response`);
  return { raw: item.value, value: JSON.parse(item.value) };
}

function desktopHello(discovery, overrides = {}) {
  return {
    schemaVersion: 1,
    contractId,
    kind: "hello",
    token: discovery.token,
    instanceId: discovery.instanceId,
    clientId: "desktop-work-hub",
    clientVersion: "1.0.0",
    ...overrides,
  };
}

async function connectAuthenticatedPipe(discovery) {
  const socket = await connectPipe(discovery.pipe);
  const lines = createInterface({ input: socket, crlfDelay: Infinity })[Symbol.asyncIterator]();
  socket.write(`${JSON.stringify(desktopHello(discovery))}\n`);
  const ready = await nextJson(lines, "Desktop Work Hub hello");
  assert.deepEqual(ready.value, {
    schemaVersion: 1, contractId, kind: "ready", instanceId: discovery.instanceId,
  });
  return { socket, lines };
}

async function expectHelloRejection(discovery, overrides, label) {
  const socket = await connectPipe(discovery.pipe);
  try {
    const rejected = waitForSocketClose(socket, label);
    socket.write(`${JSON.stringify(desktopHello(discovery, overrides))}\n`);
    await rejected;
  } finally {
    socket.destroy();
  }
}

async function readCallCounts(file) {
  return JSON.parse(await fs.readFile(file, "utf8"));
}

test("signed Desktop panel renders only the shared body-free Work Hub", async () => {
  const [panel, overlay, compact, boardScript, boardStyles] = await Promise.all([
    fs.readFile(panelPath, "utf8"),
    fs.readFile(overlayPath, "utf8"),
    fs.readFile(compactPath, "utf8"),
    fs.readFile(boardScriptPath, "utf8"),
    fs.readFile(boardStylesPath, "utf8"),
  ]);
  assert(
    panel.includes("Navigate('https://aura.studio/work-hub.html')"),
    "Desktop panel still navigates the obsolete Studio taskboard instead of work-hub.html",
  );
  assert.match(panel, /IsOwnedTarget\(target, expectedProcessId\)/u);
  assert.match(panel, /GetWindowThreadProcessId\(target, out actualProcessId\)/u);
  assert.match(panel, /GetForegroundWindow\(\)/u);
  assert.match(panel, /GetWindowRect\(target, out frame\)/u);
  assert.match(panel, /EventWaitHandle/u, "Panel-only close remains available");
  assert.doesNotMatch(panel,
    /index\.html|taskboard|prompt-shelf|aura-taskboard|Read-AuraTaskboard|Write-AuraTaskboard|PromptShelf/iu);
  assert.doesNotMatch(panel,
    /ExecuteScriptAsync|AddScriptToExecuteOnDocumentCreated|remote-debugging|app\.asar|AutomationElement/iu);
  assert.match(compact, /session-board\.js\?v=\d+/u);
  assert.match(compact, /session-board\.css\?v=\d+/u);
  assert.match(boardScript, /session-board-read/u);
  assert.match(boardStyles, /session-board-card/u);

  const controller = /internal sealed class DesktopWorkHubPanelController[\s\S]*?^  \}/mu.exec(overlay)?.[0] ?? "";
  assert(controller, "The overlay owns a bounded Work Hub panel controller");
  assert.match(controller, /ProcessStartInfo/u);
  assert.match(controller, /UseShellExecute\s*=\s*false/u);
  assert.match(controller, /CreateNoWindow\s*=\s*true/u);
  assert.match(controller, /WindowStyle\s*=\s*ProcessWindowStyle\.Hidden/u);
  assert.doesNotMatch(controller, /Stop-Process|\.Kill\(|OpenMain|Set\(\).*opened/iu);
});

test("Desktop Work Hub transport is a bounded current-user local pipe", async () => {
  const helper = await readIfPresent(desktopHostPath);
  assert(helper, "windows/aura-session-board-desktop.ps1 must own the Desktop RPC seam");
  for (const name of [
    "Initialize-AuraSessionBoardDesktopHost",
    "Update-AuraSessionBoardDesktopHost",
    "Dispose-AuraSessionBoardDesktopHost",
    "Invoke-AuraSessionBoardDesktopClientRequest",
  ]) {
    assert.match(helper, new RegExp(`function ${name}\\b`, "u"));
  }
  assert.match(helper, /CreateNamedPipe/u);
  assert.match(helper, /NamedPipeClientStream/u);
  assert.match(helper, /PIPE_REJECT_REMOTE_CLIENTS|PipeRejectRemoteClients/u);
  assert.match(helper, /GetNamedPipeClientProcessId/u);
  assert.match(helper, /GetNamedPipeClientSid/u);
  assert.match(helper, /\.SessionId/u);
  assert.match(helper, /4096/u, "Requests are bounded to 4 KiB");
  assert.match(helper, /262144/u, "Responses are bounded to 256 KiB");
  assert.match(helper, /ConnectDeadlineUtc|ConnectTimeout/u);
  assert.match(helper, /RequestDeadlineUtc|RequestTimeout/u);
  assert.match(helper, /ReceiptCache/u);
  assert.match(helper, /256/u, "The replay receipt cache is bounded");
  assert.match(helper, new RegExp(contractId, "u"));
  assert((helper.match(/Test-AuraSessionBoardDesktopUniqueJsonProperties\s+-Json/gu) ?? []).length >= 5,
    "Request, discovery, hello, ready, and response parsing reject duplicate JSON names");
  assert.doesNotMatch(helper, /https:\/\/claude\.ai|prompt|body|taskboard|project/iu);
});

test("Desktop Work Hub pipe correlates body-free reads and actual opens with replay protection", async () => {
  if (process.platform !== "win32") return;
  const testSource = new TextDecoder("utf-8", { fatal: true }).decode(
    await fs.readFile(new URL(import.meta.url)),
  );
  assert(testSource.includes(unicodeTitle), "The multilingual fixture is stored as exact UTF-8 source bytes");
  assert.equal(Buffer.from(unicodeTitle, "utf8").toString("utf8"), unicodeTitle);
  assert.doesNotMatch(unicodeTitle, /\uFFFD/u);
  assert.equal(await fs.stat(desktopHostPath).then(() => true, () => false), true,
    "Desktop RPC helper is required before the real-pipe contract can run");
  const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "aura-desktop-session-board-"));
  const harnessPath = path.join(temporaryRoot, "host.ps1");
  const fixturePath = path.join(temporaryRoot, "unicode-title.json");
  const countsPath = path.join(temporaryRoot, "call-counts.json");
  const localAppData = path.join(temporaryRoot, "local-app-data");
  const dataRoot = path.join(localAppData, "ClaudeAura", "data");
  const fixtureJson = JSON.stringify({ title: unicodeTitle });
  await fs.writeFile(fixturePath, fixtureJson, "utf8");
  assert.equal(
    new TextDecoder("utf-8", { fatal: true }).decode(await fs.readFile(fixturePath)),
    fixtureJson,
  );
  const harness = `
$ErrorActionPreference='Stop'
[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false)
$env:LOCALAPPDATA='${psPath(localAppData)}'
$DataRoot='${psPath(dataRoot)}'
$script:UnicodeTitle=[string](Get-Content -LiteralPath '${psPath(fixturePath)}' -Raw -Encoding UTF8|ConvertFrom-Json).title
$script:CountsPath='${psPath(countsPath)}'
function Write-AuraUiLog {param([string]$Message)}
function Send-AuraTaskboardChanged {param([long]$Revision)}
function Refresh-AuraTaskboardQueue {}
function Request-AuraUiHostWork {}
. '${psPath(taskboardPath)}'
. '${psPath(sessionDockPath)}'
. '${psPath(desktopHostPath)}'
$script:OpenCalls=0;$script:ShowCalls=0
function Write-AuraDesktopHarnessCounts {
  $json=[PSCustomObject][ordered]@{openCalls=$script:OpenCalls;showCalls=$script:ShowCalls}|ConvertTo-Json -Compress
  [IO.File]::WriteAllText($script:CountsPath,$json,[Text.UTF8Encoding]::new($false))
}
Write-AuraDesktopHarnessCounts
function Get-AuraSessionWorkHubProjection {
  [PSCustomObject][ordered]@{schemaVersion=1;kind='session-board-state';revision=7;changedAt=8;sessions=@(
    [PSCustomObject][ordered]@{id='11111111-1111-4111-8111-111111111111';url='https://claude.ai/chat/private-route';title=$script:UnicodeTitle;kind='chat';state='past';firstSeenAt=1;lastOpenedAt=2;response=[PSCustomObject][ordered]@{state='unknown';evidence='none';changedAt=$null}}
  )}
}
function Open-AuraSessionWorkHubSession {param([string]$SessionId)
  $script:OpenCalls+=1;Write-AuraDesktopHarnessCounts
  if($SessionId-ceq'11111111-1111-4111-8111-111111111111'){return 'opened'}
  return 'not-found'
}
function Show-AuraUiMain {$script:ShowCalls+=1;Write-AuraDesktopHarnessCounts}
if(-not(Initialize-AuraSessionBoardDesktopHost)){throw 'desktop-host-not-started'}
[Console]::Out.WriteLine('READY');[Console]::Out.Flush()
$deadline=[DateTime]::UtcNow.AddSeconds(20)
$gate=[Threading.ManualResetEventSlim]::new($false)
try{
  while([DateTime]::UtcNow-lt$deadline){Update-AuraSessionBoardDesktopHost;[void]$gate.Wait(1)}
}finally{$gate.Dispose();Dispose-AuraSessionBoardDesktopHost}
`;
  await fs.writeFile(harnessPath, harness, "utf8");
  const child = spawn("powershell.exe", [
    "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", harnessPath,
  ], { cwd: PROJECT_ROOT, stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
  let stderr = "";
  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk) => { stderr += chunk; });
  let socket;
  let lines;
  try {
    await waitForOutputLine(child.stdout, "READY", () => stderr);
    const discoveryPath = path.join(dataRoot, "session-board", "desktop-host-v1.json");
    const discovery = JSON.parse(await fs.readFile(discoveryPath, "utf8"));
    assert.deepEqual(Object.keys(discovery), [
      "schemaVersion", "contractId", "pipe", "token", "instanceId", "createdAt",
    ]);
    assert.equal(discovery.schemaVersion, 1);
    assert.equal(discovery.contractId, contractId);
    assert.match(discovery.instanceId, /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/u);
    assert.match(discovery.token, /^[a-f0-9]{64}$/u);
    assert.deepEqual(await readCallCounts(countsPath), { openCalls: 0, showCalls: 0 });

    const duplicateHelloClient = await connectPipe(discovery.pipe);
    try {
      const rejected = waitForSocketClose(
        duplicateHelloClient,
        "duplicate Desktop Work Hub hello property rejection",
      );
      const duplicateHello = JSON.stringify(desktopHello(discovery)).replace(
        '"schemaVersion":1',
        '"schemaVersion":1,"\\u0073chemaVersion":1',
      );
      duplicateHelloClient.write(`${duplicateHello}\n`);
      await rejected;
    } finally {
      duplicateHelloClient.destroy();
    }
    assert.deepEqual(await readCallCounts(countsPath), { openCalls: 0, showCalls: 0 });

    const staleToken = `${discovery.token[0] === "0" ? "1" : "0"}${discovery.token.slice(1)}`;
    await expectHelloRejection(discovery, { token: staleToken }, "stale Desktop Work Hub token rejection");
    assert.deepEqual(await readCallCounts(countsPath), { openCalls: 0, showCalls: 0 });
    await expectHelloRejection(discovery, {
      instanceId: "00000000-0000-4000-8000-000000000000",
    }, "stale Desktop Work Hub instance rejection");
    assert.deepEqual(await readCallCounts(countsPath), { openCalls: 0, showCalls: 0 });
    await expectHelloRejection(discovery, { schemaVersion: 2 }, "wrong Desktop Work Hub schema rejection");
    assert.deepEqual(await readCallCounts(countsPath), { openCalls: 0, showCalls: 0 });

    const oversizedClient = await connectAuthenticatedPipe(discovery);
    try {
      const oversizedFrame = JSON.stringify({
        type: "session-board-read",
        version: 1,
        requestId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
        padding: "x".repeat(4200),
      });
      assert(Buffer.byteLength(`${oversizedFrame}\n`, "utf8") > 4096);
      const rejected = waitForSocketClose(
        oversizedClient.socket,
        "oversized Desktop Work Hub request rejection",
      );
      oversizedClient.socket.write(`${oversizedFrame}\n`);
      await rejected;
    } finally {
      await oversizedClient.lines.return?.();
      oversizedClient.socket.destroy();
    }
    assert.deepEqual(await readCallCounts(countsPath), { openCalls: 0, showCalls: 0 });

    const duplicateRequestClient = await connectAuthenticatedPipe(discovery);
    try {
      const rejected = waitForSocketClose(
        duplicateRequestClient.socket,
        "duplicate Desktop Work Hub request property rejection",
      );
      duplicateRequestClient.socket.write(
        '{"type":"session-board-read","\\u0074ype":"session-board-read",' +
        '"version":1,"requestId":"99999999-9999-4999-8999-999999999999"}\n',
      );
      await rejected;
    } finally {
      await duplicateRequestClient.lines.return?.();
      duplicateRequestClient.socket.destroy();
    }
    assert.deepEqual(await readCallCounts(countsPath), { openCalls: 0, showCalls: 0 });

    const open = {
      type: "session-board-open", version: 1,
      requestId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      sessionId: "11111111-1111-4111-8111-111111111111",
    };
    const oldDiscovery = { ...discovery, createdAt: Date.now() - 10 * 60 * 1000 };
    await fs.writeFile(discoveryPath, JSON.stringify(oldDiscovery), "utf8");
    const oldDiscoveryClientPath = path.join(temporaryRoot, "old-discovery-client.ps1");
    const oldDiscoveryClient = `
$ErrorActionPreference='Stop'
[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false)
. '${psPath(desktopHostPath)}'
$request='${psPath(JSON.stringify(open))}'
[Console]::Out.WriteLine([string](Invoke-AuraSessionBoardDesktopClientRequest -RequestJson $request -DataRoot '${psPath(dataRoot)}'))
`;
    await fs.writeFile(oldDiscoveryClientPath, oldDiscoveryClient, "utf8");
    const oldClient = spawn("powershell.exe", [
      "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", oldDiscoveryClientPath,
    ], { cwd: PROJECT_ROOT, stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
    let oldClientStdout = "";
    let oldClientStderr = "";
    oldClient.stdout.setEncoding("utf8");
    oldClient.stderr.setEncoding("utf8");
    oldClient.stdout.on("data", (chunk) => { oldClientStdout += chunk; });
    oldClient.stderr.on("data", (chunk) => { oldClientStderr += chunk; });
    const oldClientExit = await withTimeout(new Promise((resolve, reject) => {
      oldClient.once("error", reject);
      oldClient.once("close", resolve);
    }), 5000, "live Desktop Work Hub with old discovery metadata");
    assert.equal(oldClientExit, 0, oldClientStderr);
    assert.deepEqual(JSON.parse(oldClientStdout.trim().split(/\r?\n/u).at(-1)), {
      type: "session-board-open-result", version: 1,
      requestId: open.requestId, sessionId: open.sessionId, ok: true, outcome: "opened",
    });
    assert.deepEqual(await readCallCounts(countsPath), { openCalls: 1, showCalls: 1 });

    ({ socket, lines } = await connectAuthenticatedPipe(discovery));

    const readId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    socket.write(`${JSON.stringify({ type: "session-board-read", version: 1, requestId: readId })}\n`);
    const state = await nextJson(lines, "Desktop Work Hub state");
    assert.equal(state.value.requestId, readId);
    assert.deepEqual(Object.keys(state.value.state.sessions[0]),
      ["id", "title", "kind", "state", "firstSeenAt", "lastOpenedAt", "response"]);
    assert.equal(state.value.state.sessions[0].title, unicodeTitle);
    assert.doesNotMatch(state.raw, /\uFFFD/u);
    assert.doesNotMatch(state.raw, /https?:|url|route|prompt|body|task|project/iu);

    socket.write(`${JSON.stringify(open)}\n`);
    const opened = await nextJson(lines, "Desktop Work Hub open receipt");
    assert.deepEqual(opened.value, {
      type: "session-board-open-result", version: 1,
      requestId: open.requestId, sessionId: open.sessionId, ok: true, outcome: "opened",
    });
    assert.deepEqual(await readCallCounts(countsPath), { openCalls: 1, showCalls: 1 });
    socket.write(`${JSON.stringify(open)}\n`);
    const replay = await nextJson(lines, "Desktop Work Hub cached receipt");
    assert.equal(replay.raw, opened.raw, "An identical replay returns the identical cached receipt");
    assert.deepEqual(replay.value, opened.value, "The cached replay is semantically identical");
    assert.deepEqual(await readCallCounts(countsPath), { openCalls: 1, showCalls: 1 });

    const conflictRejected = waitForSocketClose(
      socket,
      "conflicting Desktop Work Hub replay rejection",
    );
    socket.write(`${JSON.stringify({ ...open, sessionId: "22222222-2222-4222-8222-222222222222" })}\n`);
    await conflictRejected;
    assert.deepEqual(await readCallCounts(countsPath), { openCalls: 1, showCalls: 1 });
  } finally {
    lines?.return?.();
    socket?.destroy();
    if (child.exitCode === null && child.signalCode === null) {
      const closed = new Promise((resolve) => child.once("close", resolve));
      child.kill();
      await closed;
    }
    await fs.rm(temporaryRoot, { recursive: true, force: true });
  }
});

test("Desktop Work Hub client fails boundedly instead of claiming opened without Aura Main", async () => {
  if (process.platform !== "win32") return;
  const helper = await readIfPresent(desktopHostPath);
  assert(helper, "The Desktop Work Hub client seam is required for bounded unavailable receipts");
  const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "aura-desktop-client-unavailable-"));
  const harnessPath = path.join(temporaryRoot, "client.ps1");
  const missingDataRoot = path.join(temporaryRoot, "missing-main", "data");
  const deadPipeDataRoot = path.join(temporaryRoot, "dead-pipe", "data");
  const discoveryRoot = path.join(deadPipeDataRoot, "session-board");
  const deadPipeName = `ClaudeAura.SessionBoardDesktopV1.NoMain.${process.pid}`;
  await fs.mkdir(discoveryRoot, { recursive: true });
  await fs.writeFile(path.join(discoveryRoot, "desktop-host-v1.json"), JSON.stringify({
    schemaVersion: 1,
    contractId,
    pipe: deadPipeName,
    token: "0".repeat(64),
    instanceId: "33333333-3333-4333-8333-333333333333",
    createdAt: Date.now(),
  }), "utf8");
  const harness = `
$ErrorActionPreference='Stop'
[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false)
. '${psPath(desktopHostPath)}'
function Invoke-UnavailableCase {
  param([string]$RequestId,[string]$Root)
  $request=[PSCustomObject][ordered]@{
    type='session-board-open';version=1;requestId=$RequestId
    sessionId='11111111-1111-4111-8111-111111111111'
  }|ConvertTo-Json -Compress
  $watch=[Diagnostics.Stopwatch]::StartNew()
  $raw=[string](Invoke-AuraSessionBoardDesktopClientRequest -RequestJson $request -DataRoot $Root -ConnectTimeoutMilliseconds 150 -RequestTimeoutMilliseconds 250)
  $watch.Stop()
  [PSCustomObject][ordered]@{
    elapsedMilliseconds=[long]$watch.ElapsedMilliseconds
    response=($raw|ConvertFrom-Json -ErrorAction Stop)
  }
}
$missing=Invoke-UnavailableCase -RequestId 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee' -Root '${psPath(missingDataRoot)}'
$timeout=Invoke-UnavailableCase -RequestId 'ffffffff-ffff-4fff-8fff-ffffffffffff' -Root '${psPath(deadPipeDataRoot)}'
[PSCustomObject][ordered]@{missing=$missing;timeout=$timeout}|ConvertTo-Json -Depth 6 -Compress
`;
  await fs.writeFile(harnessPath, harness, "utf8");
  const child = spawn("powershell.exe", [
    "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", harnessPath,
  ], { cwd: PROJECT_ROOT, stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
  let stdout = "";
  let stderr = "";
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk) => { stdout += chunk; });
  child.stderr.on("data", (chunk) => { stderr += chunk; });
  try {
    const exitCode = await withTimeout(new Promise((resolve, reject) => {
      child.once("error", reject);
      child.once("close", resolve);
    }), 5000, "bounded Desktop Work Hub unavailable client");
    assert.equal(exitCode, 0, stderr);
    const outputLine = stdout.trim().split(/\r?\n/u).at(-1);
    const actual = JSON.parse(outputLine);
    const unavailable = (requestId) => ({
      type: "session-board-error",
      version: 1,
      requestId,
      action: "open",
      code: "unavailable",
    });
    assert.deepEqual(actual.missing.response,
      unavailable("eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee"));
    assert.deepEqual(actual.timeout.response,
      unavailable("ffffffff-ffff-4fff-8fff-ffffffffffff"));
    assert(actual.missing.elapsedMilliseconds <= 1500, "Missing Aura Main fails within 1.5 seconds");
    assert(actual.timeout.elapsedMilliseconds <= 1500, "Unreachable Aura Main times out within 1.5 seconds");
    assert.doesNotMatch(JSON.stringify(actual), /"(?:ok|outcome)"\s*:\s*(?:true|"opened")/u);
  } finally {
    if (child.exitCode === null && child.signalCode === null) {
      const closed = new Promise((resolve) => child.once("close", resolve));
      child.kill();
      await closed;
    }
    await fs.rm(temporaryRoot, { recursive: true, force: true });
  }
});

test("Aura Main owns Desktop Work Hub dispatch and foregrounds only an actual successful open", async () => {
  const [helper, panel, overlay, ui] = await Promise.all([
    readIfPresent(desktopHostPath),
    fs.readFile(panelPath, "utf8"),
    fs.readFile(overlayPath, "utf8"),
    fs.readFile(uiPath, "utf8"),
  ]);
  assert(helper, "The dedicated Desktop Work Hub transport helper is missing");
  assert.match(helper,
    /Invoke-AuraSessionBoardHostRequest[\s\S]{0,260}?Surface\s+'desktop'/u);
  assert.match(helper,
    /outcome[\s\S]{0,180}?'opened'[\s\S]{0,260}?Show-AuraUiMain/u,
    "Aura Main is foregrounded only after the business seam reports opened");
  assert.doesNotMatch(helper, /MainOpenSignal|StudioOpenSignal|Start-Process|ProcessStartInfo/u);
  assert.match(ui, /Initialize-AuraSessionBoardDesktopHost/u);
  assert.match(ui, /Update-AuraSessionBoardDesktopHost/u);
  assert.match(ui, /Dispose-AuraSessionBoardDesktopHost/u);
  assert.match(panel, /aura-session-board-desktop\.ps1/u);
  assert.match(panel, /Invoke-AuraSessionBoardDesktopClientRequest/u);
  assert.match(overlay, /DesktopWorkHubPanelController/u);
  assert.match(overlay, /desktop-taskboard-panel\.ps1/u,
    "The existing source-only packaging path is retained");
  assert.match(overlay, /hint\s*=\s*"work-hub"/u);
  assert.doesNotMatch(`${helper}\n${panel}`, /OpenMain|MainOpenSignal|Set\(\).*opened/iu,
    "A signal, queued frame, or launcher action is never an open receipt");
});

runIfMain(import.meta.url);
