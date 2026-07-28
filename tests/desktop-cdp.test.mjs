import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { test, runIfMain } from "./support/harness.mjs";
import { PROJECT_ROOT } from "./support/context.mjs";
import { runDesktopProbe } from "../scripts/desktop-probe.mjs";
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
