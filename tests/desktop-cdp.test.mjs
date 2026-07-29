import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { test, runIfMain } from "./support/harness.mjs";
import { PROJECT_ROOT } from "./support/context.mjs";
import { runDesktopProbe } from "../scripts/desktop-probe.mjs";
import {
  diagnosticExpression,
  runDesktopProfile,
} from "../scripts/desktop-profile.mjs";
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

test("Desktop identity lookup is opt-in and unpackaged capability fails closed", async () => {
  const [common, capability, controller, ui, releaseBuilder] = await Promise.all([
    fs.readFile(path.join(PROJECT_ROOT, "windows", "common.ps1"), "utf8"),
    fs.readFile(path.join(PROJECT_ROOT, "windows", "desktop-capability.ps1"), "utf8"),
    fs.readFile(path.join(PROJECT_ROOT, "windows", "desktop-presentation.ps1"), "utf8"),
    fs.readFile(path.join(PROJECT_ROOT, "windows", "aura-ui.ps1"), "utf8"),
    fs.readFile(path.join(PROJECT_ROOT, "scripts", "build-release.mjs"), "utf8"),
  ]);
  const converter = powershellFunction(common, "ConvertTo-AuraMsixInstall");
  const installResolver = powershellFunction(common, "Get-AuraClaudeInstall");
  const identityResolver = powershellFunction(
    common,
    "Get-AuraClaudeMsixApplicationIdentity",
  );
  const genericDesktopAction = powershellFunction(ui, "Invoke-AuraUiOpenDesktopApp");
  assert.doesNotMatch(converter, /Get-AppxPackageManifest|ApplicationId|AppUserModelId/,
    "Generic MSIX discovery must not depend on registered-application lookup");
  assert.doesNotMatch(installResolver,
    /Get-AppxPackageManifest|Get-AuraClaudeMsixApplicationIdentity/,
    "Generic Claude Desktop discovery must retain its previous fallback behavior");
  assert.match(identityResolver,
    /Claude_pzs8sxrjxfjjc[\s\S]+Get-AppxPackageManifest[\s\S]+app\\Claude\.exe[\s\S]+AppUserModelId/);
  assert.match(genericDesktopAction, /Get-AuraClaudeInstall/);
  assert.doesNotMatch(genericDesktopAction, /Get-AuraClaudeMsixApplicationIdentity/,
    "The existing generic Desktop button must not acquire the experimental identity gate");
  const unsupportedIndex = capability.indexOf("reasonCode = 'desktop-msix-required'");
  const identityCallIndex = capability.indexOf(
    "Get-AuraClaudeMsixApplicationIdentity -Install $install",
  );
  assert(unsupportedIndex >= 0 && identityCallIndex > unsupportedIndex,
    "The capability probe must reject unpackaged Desktop before manifest lookup");
  assert.match(capability, /reasonCode\s*=\s*'desktop-application-identity-unavailable'/);
  assert.match(capability, /schemaVersion\s*=\s*2/);
  assert(!/^\s+executablePath\s*=/m.test(capability),
    "Desktop capability output must not expose the local executable path");
  assert(!/^\s+processes\s*=/m.test(capability),
    "Desktop capability output must not expose process identities");
  assert.equal(
    (capability.match(/Get-AuraClaudeMsixApplicationIdentity/g) ?? []).length,
    1,
  );
  assert.equal(
    (controller.match(/Get-AuraClaudeMsixApplicationIdentity/g) ?? []).length,
    1,
  );
  assert.match(controller,
    /\$script:DesktopPresentationGateAEnabled\s*=\s*\$false[\s\S]+desktop-presentation-gate-a-no-go[\s\S]+Get-AuraClaudeMsixApplicationIdentity[\s\S]+\$launchProcess\s*=\s*Start-AuraDesktopPackage/,
    "The exhausted Gate A controller must refuse before identity lookup or launch");
  assert.match(controller, /Start-Process -FilePath \$ExecutablePath[\s\S]+--remote-debugging-address=127\.0\.0\.1/);
  assert.match(controller, /Get-NetTCPConnection/);
  assert.match(controller, /Test-AuraPathEqual/);
  assert.match(controller, /CreationTime/);
  assert.match(controller, /ConfirmExperimentalGateA/);
  assert.match(controller, /LaunchProcessId/);
  assert.match(controller, /desktop-presentation-identity-changed/);
  assert.match(controller, /Close-AuraDesktopDiagnosticInstance[\s\S]+CloseMainWindow/);
  assert.match(controller, /Restore-AuraStockDesktop[\s\S]+shell:AppsFolder/);
  assert.match(controller, /cleanupComplete[\s\S]+stockRelaunch/);
  assert.match(controller, /desktop-restart-required/);
  assert(!/Stop-Process|taskkill|TerminateProcess|Kill\(/i.test(controller));
  const sourceOnlyFiles = releaseBuilder.match(
    /const SOURCE_ONLY_RELEASE_FILES = new Set\(\[[\s\S]*?\]\);/,
  )?.[0] ?? "";
  for (const file of [
    "scripts/desktop-cdp/session.mjs",
    "scripts/desktop-profile.mjs",
    "windows/desktop-presentation.ps1",
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
