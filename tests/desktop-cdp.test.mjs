import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test, runIfMain } from "./support/harness.mjs";
import { PROJECT_ROOT } from "./support/context.mjs";
import { runDesktopProbe } from "../scripts/desktop-probe.mjs";
import {
  diagnosticExpression,
  runDesktopProfile,
} from "../scripts/desktop-profile.mjs";
import {
  mainInspectorApplyExpression,
  mainInspectorCleanupExpression,
  mainInspectorThemeApplyExpression,
  mainInspectorThemeCleanupExpression,
  runDesktopMainInspectorProof,
  validatedMainInspectorUrl,
} from "../scripts/desktop-main-inspector.mjs";
import { DesktopCdpSession } from "../scripts/desktop-cdp/session.mjs";
import {
  assertBrowserIdentity,
  BrowserIdentityChangedError,
  browserIdFromVersion,
  decideDesktopCompatibility,
  parseCdpFrame,
  sanitizeLogRecord,
  validateCompatibilityManifest,
  validateHttpEndpoint,
  validatedDebuggerUrl,
  validateTargetId,
  validateTimeoutPolicy,
} from "../scripts/desktop-cdp/validation.mjs";

const PORT = 9394;

function powershellFunction(source, name) {
  const start = source.indexOf(`function ${name} {`);
  assert(start >= 0, `Missing PowerShell function ${name}`);
  const end = source.indexOf("\nfunction ", start + 1);
  return source.slice(start, end < 0 ? source.length : end);
}

async function desktopGeometryProbe(overlaySource) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "aura-desktop-geometry-"));
  const harness = path.join(root, "probe.ps1");
  const addTypeStart = overlaySource.indexOf("function Add-AuraDesktopOverlayType {");
  const addTypeEnd = overlaySource.indexOf("\n}\n\n$overlayMutex", addTypeStart);
  assert(addTypeStart >= 0 && addTypeEnd > addTypeStart,
    "Missing bounded Add-AuraDesktopOverlayType function");
  const addType = overlaySource.slice(addTypeStart, addTypeEnd + 2);
  const script = [
    "$ErrorActionPreference = 'Stop'",
    addType,
    "Add-AuraDesktopOverlayType",
    "$assembly = [ClaudeAuraDesktopExperiment.DesktopAccentOverlay].Assembly",
    "$formType = $assembly.GetType('ClaudeAuraDesktopExperiment.AccentOverlayForm', $true)",
    "$compositionType = $assembly.GetType('ClaudeAuraDesktopExperiment.ThemeComposition', $true)",
    "$parse = $compositionType.GetMethod('ParseAll', [Reflection.BindingFlags]'Public,Static')",
    "$parts = @('', '0', '0', '', '0', '0', '0', '0', '0', '0.4', '800',",
    "  '0', '0', '1', '0', '0.6', '-0.12', '-0.02', '34', '650', '0', '-0.025', '3', '0.9',",
    "  '0.76', '-0.07', '0', '18', '18', '12', '1',",
    "  '0', '0', '1', '0', '0.56', '-0.16', '-0.01', '40', '650', '0', '-0.03', '3', '0.95')",
    "$parseArguments = [object[]]::new(1)",
    "$parseArguments[0] = [string[]]@(($parts -join '|'))",
    "$composition = ($parse.Invoke($null, $parseArguments)).GetValue(0)",
    "$flags = [Reflection.BindingFlags]'NonPublic,Static'",
    "$promptMethod = $formType.GetMethod('ResolvePromptBounds', $flags)",
    "$promptArguments = [object[]]::new(9)",
    "$promptArguments[0] = 1960; $promptArguments[1] = 1074",
    "$promptArguments[2] = 0; $promptArguments[3] = 0; $promptArguments[4] = 6",
    "$promptArguments[5] = [single]2.0",
    "$promptArguments[6] = [Drawing.Rectangle]::new(0, 0, 658, 1074)",
    "$promptArguments[7] = [Drawing.Rectangle]::new(806, 714, 1006, 310)",
    "$promptArguments[8] = $composition",
    "$prompt = $promptMethod.Invoke($null, $promptArguments)",
    "$greetingMethod = $formType.GetMethod('ResolveGreetingBounds', $flags)",
    "$greetingArguments = [object[]]::new(7)",
    "$greetingArguments[0] = 1960; $greetingArguments[1] = 1074; $greetingArguments[2] = 192",
    "$greetingArguments[3] = [Drawing.Rectangle]::new(0, 0, 658, 1074)",
    "$greetingArguments[4] = [Drawing.Rectangle]::new(806, 500, 600, 100)",
    "$greetingArguments[5] = $composition; $greetingArguments[6] = $false",
    "$greeting = $greetingMethod.Invoke($null, $greetingArguments)",
    "$compactPromptArguments = [object[]]::new(9)",
    "$compactPromptArguments[0] = 980; $compactPromptArguments[1] = 531",
    "$compactPromptArguments[2] = 0; $compactPromptArguments[3] = 0; $compactPromptArguments[4] = 3",
    "$compactPromptArguments[5] = [single]1.0",
    "$compactPromptArguments[6] = [Drawing.Rectangle]::new(0, 0, 330, 531)",
    "$compactPromptArguments[7] = [Drawing.Rectangle]::new(402, 357, 504, 163)",
    "$compactPromptArguments[8] = $composition",
    "$compactPrompt = $promptMethod.Invoke($null, $compactPromptArguments)",
    "$compactGreetingArguments = [object[]]::new(7)",
    "$compactGreetingArguments[0] = 980; $compactGreetingArguments[1] = 531; $compactGreetingArguments[2] = 96",
    "$compactGreetingArguments[3] = [Drawing.Rectangle]::new(0, 0, 330, 531)",
    "$compactGreetingArguments[4] = [Drawing.Rectangle]::new(405, 289, 468, 40)",
    "$compactGreetingArguments[5] = $composition; $compactGreetingArguments[6] = $false",
    "$compactGreeting = $greetingMethod.Invoke($null, $compactGreetingArguments)",
    "$wideMethod = $compositionType.GetMethod('UsesWideGreeting', [Reflection.BindingFlags]'Public,Instance')",
    "$compactWide = $wideMethod.Invoke($composition, [object[]]@(980, 96))",
    "[pscustomobject]@{",
    "  prompt = [pscustomobject]@{ x=$prompt.X; y=$prompt.Y; width=$prompt.Width; height=$prompt.Height }",
    "  greeting = [pscustomobject]@{ x=$greeting.X; y=$greeting.Y; width=$greeting.Width; height=$greeting.Height }",
    "  compact = [pscustomobject]@{",
    "    wide=[bool]$compactWide",
    "    prompt=[pscustomobject]@{ x=$compactPrompt.X; y=$compactPrompt.Y; width=$compactPrompt.Width; height=$compactPrompt.Height }",
    "    greeting=[pscustomobject]@{ x=$compactGreeting.X; y=$compactGreeting.Y; width=$compactGreeting.Width; height=$compactGreeting.Height }",
    "  }",
    "} | ConvertTo-Json -Compress",
  ].join("\n");
  try {
    await fs.writeFile(harness, script, "utf8");
    const result = spawnSync("powershell.exe", [
      "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", harness,
    ], { cwd: PROJECT_ROOT, encoding: "utf8", timeout: 30_000 });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    return JSON.parse(result.stdout.trim());
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
}

async function desktopPresentationStateSyncProbe() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "aura-desktop-state-sync-"));
  const statePath = path.join(root, "desktop-presentation.json");
  const absentPath = path.join(root, "not-opted-in.json");
  const initializedPath = path.join(root, "initialized.json");
  const harness = path.join(root, "probe.ps1");
  const signalName = `Local\\ClaudeAura.Test.${crypto.randomUUID().replaceAll("-", "")}`;
  const psLiteral = (value) => `'${value.replaceAll("'", "''")}'`;
  await fs.writeFile(statePath,
    '{"schemaVersion":2,"themeId":"cartoon-studio","appearance":"light","originalLook":false}',
    "utf8");
  const script = [
    "$ErrorActionPreference = 'Stop'",
    `. ${psLiteral(path.join(PROJECT_ROOT, "windows", "common.ps1"))}`,
    `$signalName = ${psLiteral(signalName)}`,
    "$signal = [Threading.EventWaitHandle]::new($false, [Threading.EventResetMode]::AutoReset, $signalName)",
    `$synced = Sync-AuraDesktopPresentationState -StatePath ${psLiteral(statePath)} -ThemeId 'korean-prestige' -Appearance 'dark' -OriginalLook $false -SignalMode sync -SignalEventName $signalName`,
    "$signalReceived = $signal.WaitOne(0)",
    "$signal.Dispose()",
    `$absent = Sync-AuraDesktopPresentationState -StatePath ${psLiteral(absentPath)} -ThemeId 'default' -Appearance 'system' -OriginalLook $false -SignalMode none`,
    `$initialized = Sync-AuraDesktopPresentationState -StatePath ${psLiteral(initializedPath)} -ThemeId 'japanese-idol' -Appearance 'light' -OriginalLook $false -SignalMode none -CreateIfMissing`,
    `[pscustomobject]@{ synchronized=[bool]$synced.Synchronized; signaled=[bool]$synced.Signaled; signalReceived=[bool]$signalReceived; reasonCode=[string]$synced.ReasonCode; json=[IO.File]::ReadAllText(${psLiteral(statePath)}, [Text.Encoding]::UTF8); absentSynchronized=[bool]$absent.Synchronized; absentReasonCode=[string]$absent.ReasonCode; absentCreated=[IO.File]::Exists(${psLiteral(absentPath)}); initialized=[bool]$initialized.Synchronized; initializedReasonCode=[string]$initialized.ReasonCode; initializedJson=[IO.File]::ReadAllText(${psLiteral(initializedPath)}, [Text.Encoding]::UTF8); files=[int][IO.Directory]::GetFiles(${psLiteral(root)}).Count } | ConvertTo-Json -Compress`,
  ].join("\n");
  try {
    await fs.writeFile(harness, script, "utf8");
    const result = spawnSync("powershell.exe", [
      "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", harness,
    ], { cwd: PROJECT_ROOT, encoding: "utf8", timeout: 30_000 });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    return JSON.parse(result.stdout.trim());
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
}

test("Desktop CDP endpoints accept exact IPv4, localhost, and IPv6 loopback forms", () => {
  assert.equal(validateHttpEndpoint(`http://127.0.0.1:${PORT}`), `http://127.0.0.1:${PORT}/`);
  assert.equal(validateHttpEndpoint(`http://localhost:${PORT}/`), `http://localhost:${PORT}/`);
  assert.equal(validateHttpEndpoint(`http://[::1]:${PORT}/`), `http://[::1]:${PORT}/`);
  assert.equal(
    validatedDebuggerUrl(`ws://[::1]:${PORT}/devtools/page/page-1`, PORT),
    `ws://[::1]:${PORT}/devtools/page/page-1`,
  );
});

test("Desktop CDP endpoint validation rejects every hostile URL boundary", () => {
  const hostile = [
    `http://example.com:${PORT}/`,
    `http://user@127.0.0.1:${PORT}/`,
    `http://127.0.0.1:${PORT}/?query=1`,
    `http://127.0.0.1:${PORT}/#fragment`,
    `http://127.0.0.1:${PORT}/json/list`,
    `http://127.0.0.1:${PORT}/%2e%2e/`,
    `ws://127.0.0.1:${PORT}/devtools/page/../page/page-1`,
  ];
  for (const value of hostile) {
    assert.throws(
      () => value.startsWith("ws:")
        ? validatedDebuggerUrl(value, PORT)
        : validateHttpEndpoint(value),
    );
  }
});

test("browser and target identities are pinned and strictly bounded", () => {
  const version = {
    webSocketDebuggerUrl: `ws://127.0.0.1:${PORT}/devtools/browser/browser-1`,
  };
  assert.equal(browserIdFromVersion(version, PORT), "browser-1");
  assert.throws(
    () => assertBrowserIdentity(version, PORT, "browser-2"),
    BrowserIdentityChangedError,
  );
  assert.equal(validateTargetId("page_1.test"), "page_1.test");
  assert.throws(() => validateTargetId("../page"));
  assert.throws(() => validateTargetId("x".repeat(201)));
});

test("timeout and CDP frame policies reject hostile values", () => {
  assert.equal(validateTimeoutPolicy(30_000), 30_000);
  assert.throws(() => validateTimeoutPolicy(249));
  assert.throws(() => validateTimeoutPolicy(120_001));
  assert.throws(() => parseCdpFrame("{"));
  assert.throws(() => parseCdpFrame(JSON.stringify({ value: "x".repeat(300_000) })));
  assert.deepEqual(parseCdpFrame('{"id":1,"result":{}}'), { id: 1, result: {} });
});

test("empty Desktop compatibility data rejects every version as unknown", async () => {
  const manifest = validateCompatibilityManifest(JSON.parse(await fs.readFile(
    path.join(PROJECT_ROOT, "desktop-compatibility.json"),
    "utf8",
  )));
  assert.deepEqual(
    decideDesktopCompatibility(manifest, {
      version: "1.2.3",
      packaging: "msix",
      payloadSchema: 1,
      surface: "main",
      markers: ["claudeOrigin"],
    }),
    { decision: "unknown", reasonCode: "desktop-version-unverified" },
  );
  assert.throws(() => validateCompatibilityManifest({
    ...manifest,
    verifiedRanges: [{ id: "hostile", requiredMarkerSets: { main: ["x".repeat(60)] } }],
  }));
});

test("Desktop diagnostics keep bounded origins and markers but drop paths, URLs, and titles", () => {
  const sanitized = sanitizeLogRecord({
    reasonCode: "desktop-probe-complete",
    type: "page",
    url: "https://claude.ai/private/conversation?account=secret",
    title: "Private project title",
    executablePath: "C:\\Users\\person\\AppData\\Local\\Claude\\Claude.exe",
    markers: { page: true, invalid_key: true, ["x".repeat(60)]: true },
    detail: "https://example.com/private",
  });
  assert.deepEqual(sanitized, {
    reasonCode: "desktop-probe-complete",
    type: "page",
    origin: "https://claude.ai",
    markers: { page: true },
  });
  assert(!JSON.stringify(sanitized).includes("Private project"));
  assert(!JSON.stringify(sanitized).includes("Users"));
});

test("Desktop probe reads only version and list resources and emits sanitized target records", async () => {
  const resources = [];
  const responses = {
    "/json/version": {
      webSocketDebuggerUrl: `ws://127.0.0.1:${PORT}/devtools/browser/browser-1`,
    },
    "/json/list": [{
      id: "page-1",
      type: "page",
      title: "Private session title",
      url: "https://claude.ai/code/private-session?account=hidden",
      webSocketDebuggerUrl: `ws://127.0.0.1:${PORT}/devtools/page/page-1`,
    }],
  };
  const result = await runDesktopProbe({
    endpoint: `http://127.0.0.1:${PORT}/`,
    browserId: "browser-1",
    version: "1.2.3",
    packaging: "msix",
    payloadSchema: 1,
    timeoutMs: 5_000,
    compatibility: path.join(PROJECT_ROOT, "desktop-compatibility.json"),
  }, {
    fetch: async (url) => {
      resources.push(url.pathname);
      return {
        ok: true,
        text: async () => JSON.stringify(responses[url.pathname]),
      };
    },
  });
  assert.deepEqual(resources, ["/json/version", "/json/list"]);
  assert.deepEqual(result.targets, [{
    type: "page",
    origin: "https://claude.ai",
    markers: {
      claudeOrigin: true,
      debuggerUrlValid: true,
      page: true,
      targetIdValid: true,
    },
  }]);
  assert(!JSON.stringify(result).includes("Private session"));
});

test("Desktop profile diagnostic changes only its owned marker and custom property", async () => {
  const source = diagnosticExpression();
  assert.match(source, /data-claude-aura-desktop-probe/);
  assert.match(source, /--claude-aura-desktop-probe:1/);
  assert.match(source, /try\s*\{[\s\S]*finally\s*\{/,
    "the diagnostic must clean its marker even after an evaluation failure");
  assert(!/querySelector|querySelectorAll|innerHTML|innerText|outerHTML|document\.title|location\.|localStorage|sessionStorage|indexedDB|cookie|clipboard|fetch\(|XMLHttpRequest|WebSocket/.test(source));
  assert(!/(?:background|color|display|position|opacity|transform)\s*:/.test(source),
    "the diagnostic must not make a visible style change");
  const profileModule = await fs.readFile(
    path.join(PROJECT_ROOT, "scripts", "desktop-profile.mjs"),
    "utf8",
  );
  assert.match(profileModule,
    /const PROFILE_GATE_A_ENABLED = false;[\s\S]+desktop-profile-gate-a-no-go/,
    "Direct profile execution must remain locked after the Gate A no-go");
  assert.doesNotMatch(profileModule, /createHash|urlDigest/,
    "The source-only profile must not retain a digest derived from a full target URL");
});

test("Desktop CDP session exposes no raw command channel and pins one expression", async () => {
  const session = new DesktopCdpSession({
    webSocketDebuggerUrl: `ws://127.0.0.1:${PORT}/devtools/page/page-1`,
  }, PORT, { allowedExpression: "fixed-diagnostic" });
  assert.equal(session.send, undefined);
  assert.equal(session.socket, undefined);
  assert.equal(session.url, undefined);
  assert.equal(session.allowedExpression, undefined);
  assert.equal(Object.isExtensible(session), false);
  assert.throws(() => {
    session.allowedExpression = "arbitrary-page-script";
  }, TypeError);
  assert.throws(() => {
    session.socket = { send() {} };
  }, TypeError);
  await assert.rejects(
    session.evaluate("arbitrary-page-script", 1),
    /desktop-cdp-expression-rejected/,
  );
});

test("Desktop profile orchestration passes only its pinned diagnostic expression", async () => {
  class FakeWebSocket {
    static OPEN = 1;

    constructor() {
      this.readyState = FakeWebSocket.OPEN;
      this.listeners = new Map();
      queueMicrotask(() => this.emit("open", {}));
    }

    addEventListener(type, listener) {
      const listeners = this.listeners.get(type) ?? [];
      listeners.push(listener);
      this.listeners.set(type, listeners);
    }

    emit(type, event) {
      for (const listener of this.listeners.get(type) ?? []) listener(event);
    }

    send(source) {
      const request = JSON.parse(source);
      const results = {
        "Page.getFrameTree": { frameTree: { frame: { id: "frame-1" } } },
        "Page.createIsolatedWorld": { executionContextId: 1 },
        "Runtime.evaluate": {
          result: {
            type: "object",
            value: {
              pass: true,
              reasonCode: "desktop-profile-complete",
              markers: {
                body: true,
                documentRoot: true,
                probeApplied: true,
                cleanupComplete: true,
                themeVariables: false,
              },
              variables: [],
            },
          },
        },
      };
      queueMicrotask(() => this.emit("message", {
        data: JSON.stringify({ id: request.id, result: results[request.method] }),
      }));
    }

    close() {
      this.readyState = 3;
      this.emit("close", {});
    }
  }

  const resources = [];
  const version = {
    webSocketDebuggerUrl: `ws://127.0.0.1:${PORT}/devtools/browser/browser-1`,
  };
  const result = await runDesktopProfile({
    endpoint: `http://127.0.0.1:${PORT}/`,
    browserId: "browser-1",
    timeoutMs: 5_000,
  }, {
    WebSocketImpl: FakeWebSocket,
    fetch: async (url) => {
      resources.push(url.pathname);
      return {
        ok: true,
        text: async () => JSON.stringify(url.pathname === "/json/version"
          ? version
          : [{
            id: "page-1",
            type: "page",
            url: "https://claude.ai/code/private-session?account=hidden",
            webSocketDebuggerUrl:
              `ws://127.0.0.1:${PORT}/devtools/page/page-1`,
          }]),
      };
    },
  });

  assert.equal(result.status, "ok");
  assert.deepEqual(resources, [
    "/json/version",
    "/json/list",
    "/json/version",
    "/json/list",
    "/json/version",
    "/json/list",
    "/json/version",
    "/json/list",
    "/json/version",
  ]);
  assert(!JSON.stringify(result).includes("private-session"));
  assert(!JSON.stringify(result).includes("account"));
});

test("Desktop main-inspector proof is focused-window-only, content-blind, and reversible", () => {
  const inspectorId = "a1b2c3d4-proof";
  assert.equal(
    validatedMainInspectorUrl(
      `ws://127.0.0.1:${PORT}/${inspectorId}`,
      PORT,
      inspectorId,
    ),
    `ws://127.0.0.1:${PORT}/${inspectorId}`,
  );
  for (const hostile of [
    `ws://example.com:${PORT}/${inspectorId}`,
    `ws://127.0.0.1:${PORT}/other`,
    `ws://user@127.0.0.1:${PORT}/${inspectorId}`,
    `ws://127.0.0.1:${PORT}/${inspectorId}?query=1`,
  ]) {
    assert.throws(() => validatedMainInspectorUrl(hostile, PORT, inspectorId));
  }
  const apply = mainInspectorApplyExpression();
  const cleanup = mainInspectorCleanupExpression();
  const themeRendererPayload = "({ installed: true, theme: 'anime-twilight', digest: '"
    + "a".repeat(64) + "' })";
  const themePayload = {
    payload: themeRendererPayload,
    payloadBytes: Buffer.byteLength(themeRendererPayload, "utf8"),
    themeId: "anime-twilight",
    appearance: "dark",
    digest: "a".repeat(64),
  };
  const themeApply = mainInspectorThemeApplyExpression(themePayload);
  const themeCleanup = mainInspectorThemeCleanupExpression();
  assert.match(apply, /getFocusedWebContents\(\)/);
  assert.match(apply, /windows\.length !== 1/);
  assert.match(apply, /insertCSS/);
  assert.match(apply, /removeInsertedCSS/);
  assert.match(apply, /did-finish-load/);
  assert.match(apply, /render-process-gone/);
  assert.match(apply, /web-contents-created/);
  assert.match(apply, /setTimeout\(\(\) => \{ void cleanup\(false\); \}, 65000\)/);
  assert.match(apply, /setTimeout\(\(\) => electron\.app\.quit\(\), 0\)/);
  assert.match(cleanup, /state\.cleanup\(true\)/);
  assert.match(themeApply, /executeJavaScript/);
  assert.match(themeApply, /__CLAUDE_AURA_STATE__/);
  assert.match(themeApply, /desktop-main-inspector-theme-applied/);
  assert.match(themeApply, /did-finish-load/);
  assert.match(themeApply, /content/);
  assert.match(themeCleanup, /state\.cleanup\(true\)/);
  assert.doesNotMatch(themeApply,
    /getURL|querySelector|innerHTML|innerText|localStorage|sessionStorage|indexedDB|cookie|clipboard|fetch\(|XMLHttpRequest|WebSocket/,
    "The theme bridge may execute the reviewed Aura payload but must not return or separately inspect renderer content");
  assert.doesNotMatch(apply,
    /getURL|executeJavaScript|querySelector|innerHTML|innerText|document\.|location\.|localStorage|sessionStorage|indexedDB|cookie|clipboard|fetch\(|XMLHttpRequest|WebSocket/,
    "The main-inspector proof must not cross into renderer content");
  assert.doesNotMatch(apply, /url\(|@font-face|animation\s*:|transition\s*:|pointer-events/,
    "The proof stylesheet must stay inert and offline");
});

test("Desktop main-inspector orchestration enables Runtime and pins its default context", async () => {
  const inspectorId = "main-inspector-1";
  const requests = [];
  const resources = [];
  const sleeps = [];
  let evaluationCount = 0;
  class FakeWebSocket {
    static OPEN = 1;

    constructor() {
      this.readyState = FakeWebSocket.OPEN;
      this.listeners = new Map();
      queueMicrotask(() => this.emit("open", {}));
    }

    addEventListener(type, listener) {
      const listeners = this.listeners.get(type) ?? [];
      listeners.push(listener);
      this.listeners.set(type, listeners);
    }

    emit(type, event) {
      for (const listener of this.listeners.get(type) ?? []) listener(event);
    }

    send(source) {
      const request = JSON.parse(source);
      requests.push(request);
      if (request.method === "Runtime.enable") {
        queueMicrotask(() => {
          this.emit("message", { data: JSON.stringify({
            method: "Runtime.executionContextCreated",
            params: { context: { id: 7, auxData: { isDefault: true } } },
          }) });
          this.emit("message", { data: JSON.stringify({ id: request.id, result: {} }) });
        });
        return;
      }
      evaluationCount += 1;
      const value = evaluationCount === 1
        ? {
          pass: true,
          reasonCode: "desktop-main-inspector-proof-applied",
          appliedCount: 1,
          eligibleCount: 1,
          focusedType: "window",
          typeCounts: { window: 1, "service-worker": 2 },
        }
        : {
          pass: true,
          reasonCode: "desktop-main-inspector-cleanup-complete",
          cleanupComplete: true,
          removedCount: 1,
          quitScheduled: true,
        };
      queueMicrotask(() => this.emit("message", {
        data: JSON.stringify({
          id: request.id,
          result: { result: { type: "object", value } },
        }),
      }));
    }

    close() {
      this.readyState = 3;
      this.emit("close", {});
    }
  }

  const result = await runDesktopMainInspectorProof({
    endpoint: `http://127.0.0.1:${PORT}/`,
    inspectorId,
    timeoutMs: 30_000,
    holdMs: 10_000,
  }, {
    WebSocketImpl: FakeWebSocket,
    fetch: async (url) => {
      resources.push(url.pathname);
      return {
        ok: true,
        text: async () => JSON.stringify([{
          id: inspectorId,
          type: "node",
          webSocketDebuggerUrl: `ws://127.0.0.1:${PORT}/${inspectorId}`,
        }]),
      };
    },
    sleep: async (milliseconds) => { sleeps.push(milliseconds); },
  });

  assert.equal(result.status, "ok");
  assert.deepEqual(resources, ["/json/list"]);
  assert.deepEqual(sleeps, [10_000]);
  assert.deepEqual(requests.map((request) => request.method), [
    "Runtime.enable",
    "Runtime.evaluate",
    "Runtime.evaluate",
  ]);
  for (const request of requests.filter((item) => item.method === "Runtime.evaluate")) {
    assert.equal(request.params.contextId, 7);
    assert.equal(request.params.includeCommandLineAPI, true);
    assert.equal(request.params.returnByValue, true);
    assert.equal(request.params.awaitPromise, true);
  }
});

test("Desktop greeting and prompt geometry follows the Aura Web parent-area contract", async () => {
  const overlay = await fs.readFile(
    path.join(PROJECT_ROOT, "windows", "desktop-overlay-proof.ps1"),
    "utf8",
  );
  const geometry = await desktopGeometryProbe(overlay);
  assert.deepEqual(geometry.prompt, {
    x: 806,
    y: 714,
    width: 1006,
    height: 310,
  }, "Desktop prompt treatment must follow the live native composer exactly");
  assert.deepEqual(geometry.greeting, {
    x: 806,
    y: 500,
    width: 600,
    height: 100,
  }, "Desktop greeting treatment must retain the sharp native greeting rectangle");
  assert.deepEqual(geometry.compact, {
    wide: false,
    prompt: { x: 402, y: 357, width: 504, height: 163 },
    greeting: { x: 405, y: 289, width: 468, height: 40 },
  }, "Compact Desktop treatment diverged from the live native geometry");
});

test("Studio can atomically synchronize an existing opted-in Desktop presentation state", async () => {
  const result = await desktopPresentationStateSyncProbe();
  assert.deepEqual(result, {
    synchronized: true,
    signaled: true,
    signalReceived: true,
    reasonCode: "desktop-presentation-state-synchronized",
    json: '{"schemaVersion":2,"themeId":"korean-prestige","appearance":"dark","originalLook":false}',
    absentSynchronized: false,
    absentReasonCode: "desktop-presentation-state-not-present",
    absentCreated: false,
    initialized: true,
    initializedReasonCode: "desktop-presentation-state-initialized",
    initializedJson: '{"schemaVersion":2,"themeId":"japanese-idol","appearance":"light","originalLook":false}',
    files: 3,
  });
});

test("Desktop presentation experiments bind the signed package and remain reversible source-only tools", async () => {
  const [common, capability, controller, overlay, desktopSession,
    captureBuild, captureSource, releaseBuilder] = await Promise.all([
    fs.readFile(path.join(PROJECT_ROOT, "windows", "common.ps1"), "utf8"),
    fs.readFile(path.join(PROJECT_ROOT, "windows", "desktop-capability.ps1"), "utf8"),
    fs.readFile(path.join(PROJECT_ROOT, "windows", "desktop-presentation.ps1"), "utf8"),
    fs.readFile(path.join(PROJECT_ROOT, "windows", "desktop-overlay-proof.ps1"), "utf8"),
    fs.readFile(path.join(PROJECT_ROOT, "windows", "desktop-aura-session.ps1"), "utf8"),
    fs.readFile(path.join(PROJECT_ROOT, "windows", "build-desktop-capture-filter.ps1"), "utf8"),
    fs.readFile(path.join(PROJECT_ROOT, "windows", "native", "desktop-capture-filter.cpp"), "utf8"),
    fs.readFile(path.join(PROJECT_ROOT, "scripts", "build-release.mjs"), "utf8"),
  ]);
  const converter = powershellFunction(common, "ConvertTo-AuraMsixInstall");
  const installResolver = powershellFunction(common, "Get-AuraClaudeInstall");
  assert.match(converter,
    /Claude_pzs8sxrjxfjjc[\s\S]+Test-AuraAnthropicSignature[\s\S]+Get-AppxPackageManifest[\s\S]+app\\Claude\.exe[\s\S]+\$applications\.Count -ne 1[\s\S]+ApplicationId[\s\S]+AppUserModelId/,
    "MSIX discovery must bind the signed executable to one exact manifest identity");
  assert.match(installResolver,
    /Packaging = 'desktop'[\s\S]+ApplicationId = \$null[\s\S]+AppUserModelId = \$null/,
    "The unpackaged fallback must never claim an application identity");
  assert.match(capability, /applicationId[\s\S]+appUserModelId/);
  assert.match(capability, /schemaVersion\s*=\s*2/);
  assert.match(capability,
    /reasonCode\s*=\s*'desktop-not-found'[\s\S]{0,160}?alreadyRunning\s*=\s*\$null[\s\S]{0,100}?processCount\s*=\s*\$null/,
    "a missing current-user package cannot prove that Desktop is not running");
  assert(!/^\s+executablePath\s*=/m.test(capability),
    "Desktop capability output must not expose the local executable path");
  assert(!/^\s+processes\s*=/m.test(capability),
    "Desktop capability output must not expose process identities");
  const installIndex = capability.indexOf("$install = Get-AuraClaudeInstall");
  const msixGuardIndex = capability.indexOf("reasonCode = if ($packageKind -cne 'msix')");
  const executableIndex = capability.indexOf("$executablePath =");
  const processDiscoveryIndex = capability.indexOf("Get-CimInstance");
  assert(installIndex >= 0
    && msixGuardIndex > installIndex
    && executableIndex > msixGuardIndex
    && processDiscoveryIndex > executableIndex,
  "The MSIX identity gate must fail closed before executable or process inspection");
  assert.match(capability, /'desktop-msix-required'/);
  assert.match(capability, /'desktop-application-identity-unavailable'/);
  assert.match(capability,
    /if \(-not \$msixIdentityValid\)[\s\S]+applicationId = \$null[\s\S]+appUserModelId = \$null[\s\S]+alreadyRunning = \$null[\s\S]+processCount = \$null/,
    "Unsupported identity results must expose neither identity nor inferred process state");
  assert.match(controller,
    /IApplicationActivationManager[\s\S]+CoCreateInstance[\s\S]+IntPtr\.Zero, 4[\s\S]+ActivateApplication/,
    "Desktop launch must use registered AUMID activation out of process");
  assert.match(controller, /--remote-debugging-port=\$Port/);
  assert.match(controller, /--inspect=127\.0\.0\.1:\$Port/);
  assert.doesNotMatch(controller,
    /--remote-debugging-address|Invoke-CommandInDesktopPackage/,
    "The source-only candidates must use only documented Electron switches");
  assert.match(controller, /Get-NetTCPConnection/);
  assert.match(controller, /Test-AuraPathEqual/);
  assert.match(controller, /CreationTime/);
  assert.match(controller, /ConfirmExperimentalGateA/);
  assert.match(controller, /ConfirmUnsupportedDesktopExperiment/);
  assert.match(controller,
    /ValidateSet\('GateA', 'Profile', 'MainInspectorProof', 'MainThemeProof'\)/);
  assert.match(controller,
    /MainThemeProof[\s\S]+--theme-id[\s\S]+--appearance[\s\S]+rendererPayloadApplied[\s\S]+contentEgress[\s\S]+desktop-main-inspector-theme-proof-complete/,
    "The reviewed main-inspector route must support one bounded full Aura renderer-theme proof with no content egress");
  assert.match(controller,
    /Get-AuraDesktopMainInspectorIdentity[\s\S]+json\/list[\s\S]+type\)" -cne 'node'/,
    "The main inspector must be a pinned Node target owned by the launched build");
  assert.match(controller,
    /Wait-AuraDesktopMainInspectorExit[\s\S]+DesktopProcesses[\s\S]+listeners\.Count -eq 0/,
    "Main-inspector cleanup must prove both process and listener exit");
  assert.match(controller,
    /\$script:DesktopPresentationGateACandidateVersions\s*=\s*@\(\)/,
    "No reviewed Desktop build may be retested at Gate A");
  assert.match(controller,
    /Get-AuraClaudeInstall[\s\S]+DesktopPresentationGateACandidateVersions -cnotcontains[\s\S]+desktop-presentation-build-not-authorized[\s\S]+\$launchProcessId\s*=\s*Start-AuraDesktopApplicationActivation/,
    "The controller must reject every unreviewed build before launch");
  assert.match(controller, /desktop-presentation-gate-a-complete/);
  assert.match(controller, /LaunchProcessId/);
  assert.match(controller, /desktop-presentation-identity-changed/);
  assert.match(controller, /Close-AuraDesktopDiagnosticInstance[\s\S]+CloseMainWindow/);
  assert.match(controller, /Restore-AuraStockDesktop[\s\S]+shell:AppsFolder/);
  assert.match(controller, /cleanupComplete[\s\S]+stockRelaunch/);
  assert.match(controller, /desktop-restart-required/);
  assert(!/Stop-Process|taskkill|TerminateProcess|Kill\(/i.test(controller));
  assert.match(overlay,
    /DesktopOverlayCandidateVersions\s*=\s*@\('1\.28929\.0\.0'\)[\s\S]+Claude_pzs8sxrjxfjjc!Claude[\s\S]+Test-AuraAnthropicSignature/,
    "The overlay must pin the exact reviewed signed MSIX build");
  for (const themeId of [
    "default",
    "japanese-film-editorial",
    "korean-prestige",
    "cartoon-studio",
    "anime-twilight",
    "study-library",
    "japanese-idol",
    "korean-idol",
  ]) {
    assert(overlay.includes(`'${themeId}'`),
      `The source-only Desktop layer must accept the frozen ${themeId} theme`);
    const descriptor = JSON.parse(await fs.readFile(
      path.join(PROJECT_ROOT, "themes", `${themeId}.json`),
      "utf8",
    ));
    assert.equal(descriptor.name, themeId);
    for (const field of ["accent", "border", "surface", "surfaceHover", "foreground"]) {
      assert.match(descriptor.launcher[field], /^#[0-9a-f]{6}$/iu,
        `${themeId} must provide a bounded Desktop-frame ${field} color`);
    }
    assert(descriptor.launcher.radius >= 8 && descriptor.launcher.radius <= 24);
    assert(descriptor.launcher.borderWidth >= 1 && descriptor.launcher.borderWidth <= 3);
  }
  assert.match(overlay,
    /Get-AuraDesktopOverlayThemes[\s\S]+theme-cli\.mjs[\s\S]+list[\s\S]+--user-themes[\s\S]+StandardOutputEncoding[\s\S]+ConvertFrom-Json/,
    "The Desktop layer must use the existing UTF-8 theme registry path for validated built-in and user themes");
  assert.match(overlay,
    /sourceRecipe[\s\S]+frozenThemeIds -cnotcontains \$sourceRecipe[\s\S]+presentationRecipe[\s\S]+artworkById\[\$presentationRecipe\][\s\S]+resolveIdentityPair \$presentationRecipe/,
    "Studio user themes may inherit only one frozen source recipe's permanent artwork and wordmark");
  assert.match(overlay,
    /adaptUserComposition[\s\S]+parts\.Count -ne 44[\s\S]+parts\[12\] = '1'[\s\S]+parts\[22\][\s\S]+parts\[27\][\s\S]+parts\[30\][\s\S]+parts\[32\] = '1'[\s\S]+parts\[42\]/,
    "Studio user themes must emit the current 44-field Desktop contract while applying their mark, type, and shape edits");
  assert.match(overlay,
    /\$themeItems\.Count -lt \$frozenThemeIds\.Count[\s\S]+\$themeItems\.Count -gt 32[\s\S]+\$themeItems\[\$index\]\.source[\s\S]+Sort-Object -Unique/,
    "The Desktop rail must preserve all eight frozen themes and strictly bound appended user themes");
  assert.match(overlay,
    /fontUi[\s\S]+fontDisplay[\s\S]+launcher\.radius[\s\S]+launcher\.borderWidth[\s\S]+launcherPalette[\s\S]+surfaceHover[\s\S]+studioStyle\.light\.accent[\s\S]+studioStyle\.dark\.accent[\s\S]+launcher-mark\.png[\s\S]+ReparsePoint/,
    "Every rail identity, type role, and Light/Dark material palette must come from validated theme metadata and owned marks");
  assert.match(overlay,
    /studioStyle\.light\.surfaceAlpha[\s\S]+studioStyle\.light\.sidebarAlpha[\s\S]+studioStyle\.dark\.surfaceAlpha[\s\S]+studioStyle\.dark\.sidebarAlpha[\s\S]+studioStyle\.light\.canvas[\s\S]+studioStyle\.light\.accentText[\s\S]+studioStyle\.light\.sidebarTextMuted[\s\S]+studioStyle\.light\.textSecondary[\s\S]+studioStyle\.dark\.canvas[\s\S]+studioStyle\.dark\.textSecondary[\s\S]+lightCanvasPalette[\s\S]+darkCanvasPalette/,
    "The Desktop GPU palette must carry all 15 validated semantic roles in each appearance");
  assert.match(overlay,
    /ThemeRailForm[\s\S]+selectTheme[\s\S]+selectOriginal[\s\S]+OriginalBounds[\s\S]+SelectOriginalLook/,
    "The Desktop layer must expose all-theme switching and a reversible Original look");
  assert.match(overlay,
    /surfaceHovers[\s\S]+launcherRadii[\s\S]+launcherBorderWidths[\s\S]+uiFontIds[\s\S]+displayFontIds[\s\S]+UpdateThemeRegion[\s\S]+FontFamilyFor/,
    "The Aura-owned rail must use each permanent theme's launcher hover, radius, border, and type roles");
  assert.match(overlay,
    /CloseBounds[\s\S]+closeSession[\s\S]+sessionClosed = true; Close\(\)[\s\S]+desktop-overlay-session-closed/,
    "A normal source-only session must be closable from its own rail without closing Claude");
  assert.match(overlay,
    /TopMost = true[\s\S]+SetWindowPos\(Handle, new IntPtr\(-1\)[\s\S]+rail\.PlaceAndShow/,
    "The material frame and rail must preserve their z-order after a live theme switch");
  assert.match(overlay,
    /processIds\.Count -eq 0 -and -not \$DoNotLaunchClaude[\s\S]+shell:AppsFolder\\\$\(\$install\.AppUserModelId\)/,
    "The source-only controller may launch only the already-validated registered Claude identity");
  assert.match(overlay,
    /Local\\ClaudeAuraDesktopPresentation[\s\S]+WaitOne\(0\)[\s\S]+desktop-overlay-already-running/,
    "Only one Desktop presentation controller may own the live rail");
  assert.match(overlay,
    /desktop-presentation\.json[\s\S]+stateItem\.Length -gt 768[\s\S]+ReparsePoint[\s\S]+appearance,originalLook,schemaVersion,themeId/,
    "Desktop theme persistence must be bounded, atomic, schema-closed, and sanitized");
  const stateSync = powershellFunction(common, "Sync-AuraDesktopPresentationState");
  for (const contract of [
    /ValidateSet\('none', 'sync', 'reload'\)/,
    /DesktopPresentationSync/,
    /DesktopPresentationReload/,
    /EventWaitHandle]::OpenExisting/,
    /\.Set\(\)/,
  ]) {
    assert.match(stateSync, contract,
      "Studio must atomically update and signal only an already opted-in source Desktop session");
  }
  assert.match(overlay,
    /DesktopPresentationSync[\s\S]+DesktopPresentationReload[\s\S]+WaitOne\(0\)[\s\S]+ApplyExternalPresentationState[\s\S]+desktop-overlay-state-reload-requested/,
    "The exact-HWND controller must apply saved Studio state live and request a clean definition reload");
  assert.match(desktopSession,
    /desktop-overlay-state-reload-requested[\s\S]+definitionReloadCount[\s\S]+desktop-session-reload-loop/,
    "The source session must restart only for a bounded edited-theme definition reload");
  assert.match(desktopSession,
    /Action -ceq 'Install'[\s\S]+config\.json[\s\S]+Sync-AuraDesktopPresentationState[\s\S]+CreateIfMissing/,
    "Source install must bootstrap Desktop from the validated current Studio theme state");
  assert.match(overlay,
    /UTF8Encoding\(false\)[\s\S]+File\.Replace[\s\S]+PersistenceWriteCount/,
    "Desktop theme persistence must replace one UTF-8 state document atomically");
  assert.match(overlay,
    /NoPersist[\s\S]+persistenceEnabled[\s\S]+persistenceStateLoaded[\s\S]+persistenceWriteCount/,
    "Persistence must remain explicitly suppressible and report only bounded state evidence");
  assert.match(overlay, /routeAgnosticPresentation\s*=\s*\$true/,
    "The external exact-HWND presentation must explicitly remain route-agnostic across Home and Code");
  assert.match(overlay,
    /matrixCycleStep < 7[\s\S]+SelectTheme\(matrixCycleStep \+ 1\)[\s\S]+matrixCycleStep == 7[\s\S]+SelectAppearance\(2\)[\s\S]+SelectTheme\(14 - matrixCycleStep\)[\s\S]+SelectOriginalLook\(\)/,
    "The optimized matrix must cover the eight permanent themes in Light and Dark and restore Original look");
  assert.match(overlay,
    /matrixCycleStep == 16[\s\S]+matrixCycleCompleted = true[\s\S]+sessionClosed = true/,
    "The optimized matrix must close itself only after all states complete");
  assert.match(overlay,
    /CyclePermanentThemeMatrix[\s\S]+-not \$NoPersist[\s\S]+desktop-overlay-matrix-mode-invalid/,
    "The matrix must be a transient, bounded, self-closing mode");
  assert.match(overlay, /matrixCycleRequested[\s\S]+matrixCycleCompleted[\s\S]+matrixStateCount/,
    "The matrix must report its bounded completion evidence");
  assert.match(overlay,
    /ValidateSet\('system', 'light', 'dark'\)[\s\S]+AppearanceBounds[\s\S]+SelectAppearance[\s\S]+AppsUseLightTheme[\s\S]+effectiveAppearance[\s\S]+appearanceSwitchCount/,
    "The rail must expose System, Light, and Dark modes, follow the Windows app preference, and report bounded transitions");
  assert.match(overlay,
    /ReadStructure[\s\S]+detectedSidebarRight[\s\S]+SidebarBounds[\s\S]+DrawSidebarMaterial[\s\S]+sidebarAlpha[\s\S]+applyShellTint/,
    "The optional shell treatment must follow bounded live geometry, use the theme sidebar material, and remain removable");
  assert.match(overlay, /NoShellTint[\s\S]+shellTintEnabled/);
  assert.match(overlay,
    /NoArtwork[\s\S]+themes\\registry\.json[\s\S]+contextOverrides[\s\S]+'new-chat'[\s\S]+\.Length -ge 409600[\s\S]+selectLayer[\s\S]+'background'[\s\S]+'hero'[\s\S]+'decoration'[\s\S]+PresentationCore[\s\S]+BitmapDecoder[\s\S]+DrawArtworkLayer[\s\S]+BackgroundOpacity \* 0\.20f[\s\S]+FeatureOpacity \* 0\.32f[\s\S]+backgroundArtworkRenderCount[\s\S]+featureArtworkRenderCount/,
    "Artwork must use bounded permanent-theme new-chat backgrounds and features, decode in memory, and remain suppressible");
  assert.match(overlay,
    /NoIdentity[\s\S]+DrawWordmark[\s\S]+wrapperHeight = \(int\)Math\.Round\(48 \* scale\)[\s\S]+targetWidth = \(int\)Math\.Round\(160 \* scale\)[\s\S]+minimumWidth = \(int\)Math\.Round\(136 \* scale\)[\s\S]+InterpolationMode\.HighQualityBicubic[\s\S]+width >= \(int\)Math\.Round\(760 \* scale\)[\s\S]+brand-wordmark-\$wordmarkAppearance\.png[\s\S]+desktop-overlay-identity-invalid[\s\S]+identityRenderCount/,
    "The appearance-matched identity must render the Web contract's full-width high-quality wordmark inside the sidebar, avoid narrow layouts, fail open, and remain suppressible");
  assert.match(overlay,
    /identityAvailableThemeCount = \[int\]\$identityAvailableThemeCount/,
    "Desktop evidence must count inherited Studio identity pairs instead of assuming only built-ins have them");
  assert.match(overlay,
    /NoStructureAccents[\s\S]+UIAutomationClient[\s\S]+UIAutomationTypes[\s\S]+elementCount >= 512[\s\S]+ControlTypeProperty[\s\S]+BoundingRectangleProperty[\s\S]+IsOffscreenProperty/,
    "Structural accents must use only bounded control types and geometry and remain suppressible");
  assert.match(overlay,
    /DrawStructureAccents[\s\S]+accessibilityGeometryAccess/,
    "Structural accents must disclose accessibility geometry access");
  assert.match(overlay,
    /ControlType\.Image[\s\S]+ControlType\.List[\s\S]+listCount >= 4[\s\S]+imageCount >= 10[\s\S]+accent\.Kind == 8[\s\S]+accent\.Kind == 7/,
    "Grouped-list materials and icon rings must remain type/geometry bounded");
  assert.match(overlay,
    /themeDescriptor\.shape\.composer[\s\S]+themeDescriptor\.shape\.card[\s\S]+themeDescriptor\.shape\.control[\s\S]+themeDescriptor\.shape\.borderWidth[\s\S]+ThemeComposition\.ParseAll[\s\S]+composition\.ComposerRadius[\s\S]+composition\.CardRadius[\s\S]+composition\.ControlRadius/,
    "Desktop composition must use each permanent theme's validated Web composer, card, control, and border shapes");
  assert.match(overlay,
    /themeBlurs\[selectedThemeIndex\][\s\S]+OverlayMargin\(int dpi, int themeBlur\)[\s\S]+themeBlur \* 0\.18[\s\S]+theme\.studioStyle\.shared\.blur[\s\S]+\$blurValue -gt 40[\s\S]+themeBlur = \[int\]\$blurPalette/,
    "Aura-owned halo breadth must use the validated theme blur without reading or blurring Claude pixels");
  assert.match(overlay,
    /materialSurfaces = effectiveDark[\s\S]+materialRaisedSurfaces[\s\S]+DrawPromptMaterial[\s\S]+surfaceAlpha[\s\S]+composition\.ComposerRadius[\s\S]+studioStyle\.light\.surface[\s\S]+studioStyle\.light\.raised/,
    "The prompt material must use validated panel colors, opacity, and composer geometry");
  assert.match(overlay,
    /newChatLayout[\s\S]+offsetYRatio[\s\S]+Greeting\.decoration[\s\S]+Greeting\.mark\.source[\s\S]+newChatGreetingStyle[\s\S]+\.standard[\s\S]+\.wide[\s\S]+ResolvedGreetingFontSize[\s\S]+ResolvePromptBounds[\s\S]+ResolveGreetingBounds[\s\S]+DrawGreetingTreatment[\s\S]+promptCompositionCount[\s\S]+greetingCompositionCount/,
    "Prompt and greeting treatments must carry both permanent Aura Web viewport frames without reading Claude text");
  assert.match(overlay,
    /Rectangle resolvedGreetingBounds = structureGreetingBounds/,
    "The sharp Desktop compositor must not relocate native greeting pixels");
  assert.match(overlay,
    /soft-right[\s\S]+feature\.size/,
    "Permanent artwork must preserve each recipe's bounded size and mask instead of one generic hero treatment");
  for (const field of [
    "FeatureMask",
    "FeatureSizeMode",
    "ResolvedFeatureMaximumWidthRatio",
    "ResolvedFeatureMaximumHeightRatio",
    "--feature-mask",
    "--greeting-compact-mark",
  ]) {
    assert(overlay.includes(field), `Missing permanent artwork composition field ${field}`);
  }
  assert.match(captureSource,
    /featureMask[\s\S]+greetingDestinationRect[\s\S]+greetingWeight[\s\S]+greetingItalic[\s\S]+greetingFont[\s\S]+greetingMarkSource[\s\S]+greetingMarkScale[\s\S]+sidebarRatio - 0\.012/,
    "The GPU compositor must consume exact artwork, sidebar, and greeting presentation geometry");
  assert.doesNotMatch(overlay,
    /NameProperty|ValueProperty|AutomationIdProperty|HelpTextProperty|ItemStatusProperty|TextPattern|ValuePattern|InvokePattern|SelectionPattern|LegacyIAccessiblePattern|Current\.Name/,
    "The structural channel must never read accessibility content, identifiers, or interaction patterns");
  assert.match(overlay,
    /NoColorFilter[\s\S]+Magnification\.dll[\s\S]+MagInitialize[\s\S]+MagSetWindowSource[\s\S]+MagSetWindowFilterList[\s\S]+MagSetColorEffect[\s\S]+CreateWindowEx/,
    "The compositor color channel must use only the windowed Magnifier control and remain suppressible");
  assert.match(overlay,
    /MW_FILTERMODE_EXCLUDE[\s\S]+SPI_GETDISABLEOVERLAPPEDCONTENT[\s\S]+SystemInformation\.MonitorCount == 1/,
    "The compositor color channel must remain exclusion-only and x64/single-display bounded");
  assert.match(overlay,
    /Get-AuraDesktopCaptureFilterExecutable[\s\S]+GpuCaptureColorFilterController[\s\S]+gpuFilterApplied[\s\S]+colorFilter\.PlaceAndShow/,
    "The exact-window GPU path must be preferred while the bounded Magnifier path remains a fallback");
  assert.match(overlay,
    /desktop-capture-filter-stopped-before-frame[\s\S]+stoppedBeforeFrame[\s\S]+CleanupComplete = CleanupComplete && clean/,
    "A focus-loss stop before the first frame must stay a clean cancellation rather than poison session cleanup evidence");
  assert.match(overlay,
    /ClaudeAuraDesktopGpuReady-[\s\S]+--ready-event[\s\S]+readyEvent\.WaitOne\(25\)[\s\S]+Initialized = true/,
    "GPU startup must use an owned readiness handshake that does not depend on overlay visibility");
  assert.match(overlay,
    /SystemInformation\.HighContrast[\s\S]+Apply\(Color accent, Color focus, Color accentText, Color border,[\s\S]+Color sidebar, Color sidebarText, Color sidebarTextMuted,[\s\S]+Color text, Color textSecondary, Color textMuted,[\s\S]+Color surface, Color raised, Color canvas,[\s\S]+double surfaceAlpha, double sidebarAlpha, bool dark, bool sourceDark,[\s\S]+ThemeComposition composition, bool applyArtwork, bool landingLayout,[\s\S]+double sidebarRatio, double titleRatio, Rectangle greetingBounds,[\s\S]+Rectangle greetingDestinationBounds, int targetWidth, int targetHeight,[\s\S]+int targetDpi, bool wideGreeting\)[\s\S]+--focus[\s\S]+--accent-text[\s\S]+--sidebar-text-muted[\s\S]+--text-secondary[\s\S]+--surface-alpha[\s\S]+--sidebar-alpha[\s\S]+--source-dark/,
    "The GPU path must disable itself in High Contrast and receive semantic, translucency, artwork, and live-layout roles");
  assert.match(overlay,
    /mainCollectionCount == 0[\s\S]+RefreshStructure\(rectangle, dpi\)[\s\S]+filterComposition[\s\S]+filterSidebarRatio[\s\S]+filterTitleRatio[\s\S]+artworkEnabled && !gpuFilterApplied/,
    "Hero art must be restricted to a collection-free greeting layout and move beneath live content on the GPU path");
  assert.match(overlay,
    /sourceDark = EffectiveDarkAppearance\("system"\)[\s\S]+sourceAppearanceHint[\s\S]+sourceAppearanceBasis = 'gpu-top-chrome-sampling-with-windows-fallback'/,
    "Continuous neutral-tone mapping must treat Windows appearance only as a fallback hint for GPU source sampling");
  assert.match(overlay,
    /semanticPaletteMapping[\s\S]+coverageSafeAffineMapping[\s\S]+nonlinearTextRemap[\s\S]+GpuSemanticPaletteMapping[\s\S]+GpuCoverageSafeAffineMapping[\s\S]+GpuNonlinearTextRemap[\s\S]+GpuNativeResolutionPreserved[\s\S]+GpuCaptureWidth[\s\S]+GpuSwapChainWidth[\s\S]+GpuOutputClientWidth[\s\S]+schemaVersion = 6/,
    "Desktop evidence must validate semantic palette, coverage-safe affine mapping, no nonlinear text remap, and native-resolution dimensions");
  assert.match(overlay,
    /ReadUnsignedEvidence[\s\S]+dpiAwarenessPerMonitorV2[\s\S]+nativeResolutionPreserved[\s\S]+CaptureWidth == SwapChainWidth[\s\S]+CaptureWidth == OutputClientWidth/,
    "The host must reject a transformed-frame claim unless capture, swap chain, and output client dimensions are one-for-one");
  assert.match(overlay,
    /colorFilterBackend = if \(\[int\]\$preview\.ColorFilterPresentCount -le 0\)[\s\S]+'none'[\s\S]+windows-graphics-capture-exact-hwnd-gpu[\s\S]+magnification-desktop-rectangle[\s\S]+exactHwndIsolation = \[bool\]\$preview\.GpuColorFilterStarted[\s\S]+pixelReadback = \$false/,
    "Desktop evidence must distinguish exact-HWND GPU transformation from desktop-rectangle fallback");
  assert.doesNotMatch(overlay,
    /MagImageScalingCallback|MagSetImageScalingCallback|MagGetImageScalingCallback|MW_FILTERMODE_INCLUDE|MagSetInputTransform|MS_SHOWMAGNIFIEDCURSOR/,
    "The compositor channel must never expose pixel callbacks, remap input, duplicate the cursor, or claim unsupported HWND inclusion");
  assert.match(overlay,
    /SelectOriginalLook\(\)[\s\S]+gpuColorFilter\.HideFilter\(\)[\s\S]+colorFilter\.HideFilter\(\)[\s\S]+HidePresentation\(\)[\s\S]+private void HideAll\(\)[\s\S]+colorFilter\.HideFilter\(\)/,
    "Original look and foreground loss must remove both compositor and decoration channels");
  assert.match(overlay,
    /\[switch\]\$OriginalLook[\s\S]+if \(\$OriginalLook\) \{[\s\S]+\$initialOriginalLook = \$true/,
    "Original look must have a direct transient preview entry point without saved-state mutation");
  assert.match(overlay,
    /presentationVisible = \[int\]\$preview\.PresentCount -gt 0[\s\S]+controllerVisible = \[int\]\$preview\.ControlPresentCount -gt 0/,
    "Evidence must distinguish themed presentation from the still-available Aura controller");
  assert.match(overlay,
    /WS_EX_LAYERED[\s\S]+WS_EX_TRANSPARENT[\s\S]+WS_EX_TOOLWINDOW[\s\S]+WS_EX_NOACTIVATE/,
    "The external frame must remain decorative, click-through, and activation-free");
  assert.match(overlay,
    /WM_NCHITTEST[\s\S]+HTTRANSPARENT[\s\S]+WM_MOUSEACTIVATE[\s\S]+MA_NOACTIVATE/,
    "The frame must fail input hit-testing even if Windows changes style handling");
  assert.match(overlay,
    /IsIconic[\s\S]+TargetIsForeground[\s\S]+HidePresentation[\s\S]+SW_HIDE[\s\S]+UpdateLayeredWindow/,
    "The frame must track the live window and disappear when it is not active");
  assert.match(overlay,
    /HiddenTransitions[\s\S]+SurfaceBuildCount[\s\S]+hiddenTransitions[\s\S]+surfaceBuildCount/,
    "The proof must report sanitized hide and resize lifecycle evidence");
  assert.match(overlay,
    /ThemeSwitchCount[\s\S]+OriginalLookTransitions[\s\S]+themeSwitchCount[\s\S]+originalLookTransitions/,
    "The proof must report sanitized live theme and Original-look transitions");
  assert.match(overlay,
    /RunUntilClaudeCloses[\s\S]+effectiveDuration\s*=\s*if \(\$RunUntilClaudeCloses\) \{ 0 \}/,
    "An explicit source-only session may stay attached until Claude closes");
  assert.match(overlay, /deadlineEnabled\s*=\s*durationSeconds > 0[\s\S]+DateTime\.MaxValue/);
  assert.match(overlay,
    /SetProcessDpiAwarenessContext[\s\S]+new IntPtr\(-4\)[\s\S]+EnablePerMonitorDpiAwareness/,
    "The external frame must use physical per-monitor coordinates");
  assert.match(overlay,
    /cleanupComplete[\s\S]+contentAccess = \[bool\]\$preview\.GpuColorFilterStarted[\s\S]+gpu-window-frame-transform-only[\s\S]+inputIntercepted = \$false/,
    "GPU-frame access must be disclosed without upgrading it to CPU readback or input access");
  assert.doesNotMatch(overlay,
    /GetWindowText|SendMessage|PrintWindow|BitBlt|CopyFromScreen|GetPixel|SetWindowLong|DwmSetWindowAttribute/,
    "The external frame must neither inspect content nor mutate the Claude window");
  assert(!/Stop-Process|taskkill|TerminateProcess|Kill\(/i.test(overlay));
  assert.match(desktopSession,
    /ValidateSet\('Run', 'Install', 'Remove', 'Status'\)[\s\S]+\.git[\s\S]+Claude Aura Source Experiments[\s\S]+Claude Aura Desktop\.lnk/,
    "The ordinary Desktop entry point must remain explicitly source-checkout-only and separately named");
  assert.match(desktopSession,
    /WScript\.Shell[\s\S]+TargetPath = \$powerShellPath[\s\S]+Arguments = \$shortcutArguments[\s\S]+WorkingDirectory = \$projectRoot[\s\S]+IconLocation/,
    "The Start-menu shortcut must pin the owned PowerShell, arguments, working directory, and icon");
  assert.match(desktopSession,
    /shortcutOwned[\s\S]+desktop-session-shortcut-conflict[\s\S]+RunUntilClaudeCloses[\s\S]+ConfirmUnsupportedDesktopExperiment/,
    "Install/remove must reject foreign shortcuts and Run must preserve explicit experiment consent and session cleanup");
  assert.match(desktopSession,
    /NoShellTint[\s\S]+NoArtwork[\s\S]+NoIdentity[\s\S]+NoStructureAccents[\s\S]+NoColorFilter[\s\S]+\$overlayArguments\[\$name\] = \$true/,
    "Direct source sessions must propagate every owned visual-channel opt-out");
  assert(!/Stop-Process|taskkill|TerminateProcess|Kill\(/i.test(desktopSession));
  assert.match(captureBuild,
    /Is64BitOperatingSystem[\s\S]+native\\desktop-capture-filter\.cpp[\s\S]+Get-FileHash[\s\S]+VC\.Tools\.x86\.x64[\s\S]+windowscodecs\.lib[\s\S]+sourceOnly = \$true/,
    "The local helper build must remain x64, source-pinned, hash-verified, and source-only");
  assert.match(captureSource,
    /CreateDirect3D11DeviceFromDXGIDevice[\s\S]+IGraphicsCaptureItemInterop[\s\S]+CreateForWindow[\s\S]+CreateFreeThreaded[\s\S]+IDirect3DDxgiInterfaceAccess/,
    "The helper must capture one exact HWND and keep the frame in Direct3D");
  assert.match(captureSource,
    /HTTRANSPARENT[\s\S]+MA_NOACTIVATE[\s\S]+WS_EX_NOACTIVATE[\s\S]+WS_EX_TRANSPARENT[\s\S]+WS_EX_TOPMOST/,
    "The GPU presentation must remain topmost, click-through, and activation-free");
  assert.match(captureSource,
    /CreateWindowExW\([\s\S]{0,220}?WS_EX_LAYERED[\s\S]{0,160}?WS_EX_TRANSPARENT[\s\S]{0,220}?Claude Aura Desktop GPU presentation/,
    "The cross-process GPU presentation must be layered or WS_EX_TRANSPARENT cannot pass mouse input to Claude");
  assert.match(captureSource,
    /GetWindowLongPtrW[\s\S]+GWL_EXSTYLE[\s\S]+WS_EX_LAYERED[\s\S]+inputTransparent[\s\S]+inputIntercepted/,
    "The native helper must verify its effective click-through style before claiming input safety");
  assert.match(captureSource,
    /--stop-event[\s\S]+OpenEventW[\s\S]+WaitForSingleObject[\s\S]+cleanupComplete/,
    "Theme switches and Original look must stop the helper through a graceful owned event");
  assert.match(captureSource,
    /stopRequested[\s\S]+desktop-capture-filter-stopped-before-frame[\s\S]+complete \|\| stoppedBeforeFrame/,
    "An owned stop before the first frame must be reported as a clean bounded cancellation");
  assert.match(captureSource,
    /--ready-event[\s\S]+OpenEventW\(EVENT_MODIFY_STATE[\s\S]+SetEvent\(g_readyEvent\)[\s\S]+readySignaled/,
    "The native helper must signal readiness only after its exact-HWND capture pipeline starts");
  assert.match(captureSource,
    /unbounded run requires stop event[\s\S]+targetProcessId[\s\S]+TargetIdentityIntact/,
    "An unbounded helper must have an owned stop event and reject HWND reuse across processes");
  assert.match(captureSource,
    /ResizeSwapChain[\s\S]+ResizeBuffers[\s\S]+framePool_\.Recreate/,
    "The GPU presentation must resize both its swap chain and capture pool on live window changes");
  assert.match(captureSource,
    /SetProcessDpiAwarenessContext\(DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2\)/,
    "The native capture helper must opt into per-monitor-v2 DPI awareness");
  assert.match(captureSource,
    /size_ = item_\.Size\(\)[\s\S]+description\.Width = static_cast<UINT>\(\(std::max\)\(1, size_\.Width\)\)[\s\S]+description\.Height = static_cast<UINT>\(\(std::max\)\(1, size_\.Height\)\)[\s\S]+DXGI_SCALING_NONE[\s\S]+GetClientRect[\s\S]+nativeResolutionPreserved/,
    "The helper must enter per-monitor-v2 DPI awareness and bind the captured pixel dimensions one-for-one to an unscaled output swap chain");
  assert.match(captureSource,
    /sampleSourcePixel[\s\S]+sourceTexture\.Load/,
    "Claude source pixels must use integer texel loads instead of a filtering sampler");
  assert.equal((captureSource.match(/sourceTexture\.Sample/g) || []).length, 0,
    "Claude source pixels must never pass through linear texture sampling");
  assert.match(captureSource,
    /Present\(1, 0\)[\s\S]+g_evidence\.gpuPixelTransform = true[\s\S]+g_evidence\.frames/,
    "GPU transformation evidence must become true only after a frame is actually presented");
  assert.match(captureSource,
    /float4 accent[\s\S]+float4 focus[\s\S]+float4 accentText[\s\S]+float4 border[\s\S]+float4 sidebar[\s\S]+float4 sidebarText[\s\S]+float4 sidebarTextMuted[\s\S]+float4 text[\s\S]+float4 textSecondary[\s\S]+float4 textMuted[\s\S]+float4 surface[\s\S]+float4 raised[\s\S]+float4 canvas/,
    "The native shader must bind the complete 13-color semantic palette");
  assert.match(captureSource,
    /coverageSafeAffineMap[\s\S]+sourceCoverage[\s\S]+mainAffine[\s\S]+sidebarAffine/,
    "The native shader must theme the captured UI with one coverage-safe affine transform per broad region so glyph and icon antialiasing stays native");
  for (const role of [
    "sourceChroma", "targetBackground", "targetForeground", "capturedSourceDark",
  ]) assert.match(captureSource, new RegExp(role));
  assert.doesNotMatch(captureSource,
    /rawInkCoverage|subpixelInkEvidence|accentTextEvidence|semanticNeutral|neutralAmount/,
    "The sharp compositor must not classify or repaint individual text-edge pixels");
  assert.match(captureSource,
    /IWICFormatConverter[\s\S]+D3D11_USAGE_IMMUTABLE[\s\S]+backgroundTexture\s*:\s*register\(t1\)[\s\S]+featureTexture\s*:\s*register\(t2\)[\s\S]+artworkScene[\s\S]+surfaceConfidence[\s\S]+underlaySurface/,
    "Validated theme artwork must be decoded separately from captured frames and composited beneath surface-like pixels on the GPU");
  assert.match(captureSource,
    /--greeting-x[\s\S]+--greeting-destination-x[\s\S]+--greeting-mark-scale[\s\S]+--greeting-compact-mark[\s\S]+greetingDestinationRect/,
    "The host may retain bounded greeting geometry for owned decoration without reading its text");
  assert.doesNotMatch(captureSource,
    /greetingInkValue|insideOriginalMark|insideDestinationMark|styledUv|weightStrength|glyphCoverage/,
    "The sharp compositor must leave Claude's native greeting pixels in place instead of reconstructing or scaling a bitmap glyph mask");
  assert.doesNotMatch(captureSource, /farTexel|farNeighborColor|farContrast/,
    "The shader must not create displaced text echoes from wide-neighborhood samples");
  assert.match(captureSource,
    /surfacePaletteMapping[\s\S]+surfacePaletteSize\\\":13[\s\S]+semanticPaletteMapping[\s\S]+semanticPaletteSize\\\":13[\s\S]+surfaceAlphaMapping[\s\S]+darkNeutralRemap[\s\S]+coverageSafeAffineMapping[\s\S]+nonlinearTextRemap\\\":false/,
    "The native helper must disclose coverage-safe affine mapping, no nonlinear text remap, and the retained 13-color palette contract");
  assert.match(captureSource,
    /exactHwndIsolation[\s\S]+gpuPixelTransform[\s\S]+pixelReadback\\\":false[\s\S]+cpuFrameAccess\\\":false[\s\S]+screenshotWritten\\\":false/,
    "Helper evidence must disclose GPU pixel transformation and reject CPU or screenshot claims");
  assert.doesNotMatch(captureSource,
    /\b(?:Map|GetData|CopyFromScreen|PrintWindow|BitBlt|GetPixel|WICBitmap|stbi_write)\s*\(/,
    "The exact-HWND helper must not map frames to CPU memory or write screenshots");
  assert(!/Stop-Process|taskkill|TerminateProcess|Kill\(/i.test(captureBuild));
  const sourceOnlyFiles = releaseBuilder.match(
    /const SOURCE_ONLY_RELEASE_FILES = new Set\(\[[\s\S]*?\]\);/,
  )?.[0] ?? "";
  for (const file of [
    "scripts/desktop-cdp/session.mjs",
    "scripts/desktop-main-inspector.mjs",
    "scripts/desktop-profile.mjs",
    "windows/build-desktop-capture-filter.ps1",
    "windows/desktop-aura-session.ps1",
    "windows/desktop-overlay-proof.ps1",
    "windows/desktop-presentation.ps1",
    "windows/native/desktop-capture-filter.cpp",
  ]) {
    assert(sourceOnlyFiles.includes(`"${file}"`),
      `${file} must be explicitly excluded from release builds`);
  }
});

async function productionSources() {
  const files = [];
  for (const root of ["scripts", "windows"]) {
    const directory = path.join(PROJECT_ROOT, root);
    const entries = await fs.readdir(directory, { recursive: true, withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile() || !/\.(?:mjs|js|ps1)$/i.test(entry.name)) continue;
      files.push(path.join(entry.parentPath, entry.name));
    }
  }
  return Promise.all(files.map(async (file) => ({
    file,
    source: await fs.readFile(file, "utf8"),
  })));
}

test("production spike tooling contains no forbidden CDP domains or package mutation path", async () => {
  const sources = await productionSources();
  const forbiddenDomains = /\b(?:Network|Storage|DOMSnapshot|Fetch)\s*\.\s*(?:enable|get|set|clear|delete|take|continue|fulfill)\b/;
  const mutation = /app\.asar|asar\s+(?:extract|pack)|package extraction|signature bypass|dll injection/i;
  const violations = sources.flatMap(({ file, source }) => [
    ...(forbiddenDomains.test(source) ? [`${file}: forbidden CDP domain`] : []),
    ...(mutation.test(source) ? [`${file}: package mutation`] : []),
  ]);
  assert.deepEqual(violations, []);
  const probe = await fs.readFile(path.join(PROJECT_ROOT, "scripts", "desktop-probe.mjs"), "utf8");
  assert.deepEqual(
    [...probe.matchAll(/"\/json\/[a-z]+"/g)].map(([value]) => value).sort(),
    ['"/json/list"', '"/json/list"', '"/json/version"', '"/json/version"'],
  );
});

runIfMain(import.meta.url);
