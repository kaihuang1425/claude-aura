#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { AURA_VERSION, buildPayload, PROJECT_ROOT } from "./theme-core.mjs";

const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "[::1]", "::1"]);
const ID_PATTERN = /^[A-Za-z0-9._-]{1,200}$/;

class BrowserIdentityChangedError extends Error {}

function parseArgs(argv) {
  const options = {
    mode: "watch",
    port: 9394,
    browserId: null,
    configPath: path.join(PROJECT_ROOT, "config.example.json"),
    timeoutMs: 30000,
    screenshot: null,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--watch") options.mode = "watch";
    else if (arg === "--apply" || arg === "--once") options.mode = "apply";
    else if (arg === "--verify") options.mode = "verify";
    else if (arg === "--remove") options.mode = "remove";
    else if (arg === "--diagnose") options.mode = "diagnose";
    else if (arg === "--self-test") options.mode = "self-test";
    else if (arg === "--check-payload") options.mode = "check-payload";
    else if (arg === "--port") options.port = Number(argv[++index]);
    else if (arg === "--browser-id") options.browserId = argv[++index];
    else if (arg === "--config") options.configPath = path.resolve(argv[++index]);
    else if (arg === "--timeout-ms") options.timeoutMs = Number(argv[++index]);
    else if (arg === "--screenshot") options.screenshot = path.resolve(argv[++index]);
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (!Number.isInteger(options.port) || options.port < 1024 || options.port > 65535) {
    throw new Error(`Invalid port: ${options.port}`);
  }
  if (!Number.isInteger(options.timeoutMs) || options.timeoutMs < 250 || options.timeoutMs > 120000) {
    throw new Error(`Invalid timeout: ${options.timeoutMs}`);
  }
  if (options.browserId !== null && !ID_PATTERN.test(options.browserId)) {
    throw new Error(`Invalid browser ID: ${options.browserId}`);
  }
  if (["watch", "apply", "verify", "remove", "diagnose"].includes(options.mode) && !options.browserId) {
    throw new Error(`--browser-id is required in ${options.mode} mode`);
  }
  return options;
}

function validatedDebuggerUrl(value, port) {
  const source = typeof value === "string" ? value : value?.webSocketDebuggerUrl;
  const url = new URL(source);
  const pathIsValid = /^\/devtools\/(?:page|browser)\/[A-Za-z0-9._-]{1,200}$/.test(url.pathname);
  if (url.protocol !== "ws:" || !LOOPBACK_HOSTS.has(url.hostname) || Number(url.port) !== port ||
      url.username || url.password || url.search || url.hash || !pathIsValid) {
    throw new Error("Rejected a CDP WebSocket URL outside the loopback endpoint");
  }
  return url.href;
}

function browserIdFromVersion(version, port) {
  const url = new URL(validatedDebuggerUrl(version, port));
  const match = url.pathname.match(/^\/devtools\/browser\/([A-Za-z0-9._-]{1,200})$/);
  if (!match || !ID_PATTERN.test(match[1])) throw new Error("Rejected an invalid CDP browser identity");
  return match[1];
}

function potentialClaudeUrl(value) {
  try {
    const url = new URL(value);
    if (["file:", "app:"].includes(url.protocol)) return true;
    if (url.protocol === "about:" && url.pathname === "blank") return true;
    if (!["https:", "http:"].includes(url.protocol)) return false;
    const host = url.hostname.toLowerCase();
    return host === "claude.ai" || host.endsWith(".claude.ai");
  } catch {
    return false;
  }
}

function validPageTarget(target, port) {
  if (target?.type !== "page" || typeof target.id !== "string" || !ID_PATTERN.test(target.id) ||
      typeof target.url !== "string" || !potentialClaudeUrl(target.url)) return false;
  try {
    const url = new URL(validatedDebuggerUrl(target, port));
    return url.pathname === `/devtools/page/${target.id}`;
  } catch {
    return false;
  }
}

class CdpSession {
  constructor(target, port) {
    this.target = target;
    this.ws = new WebSocket(validatedDebuggerUrl(target, port));
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = new Map();
    this.closed = false;
  }

  async open() {
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        try { this.ws.close(); } catch {}
        reject(new Error("CDP WebSocket open timed out"));
      }, 5000);
      this.ws.addEventListener("open", () => { clearTimeout(timeout); resolve(); }, { once: true });
      this.ws.addEventListener("error", () => { clearTimeout(timeout); reject(new Error("CDP WebSocket open failed")); }, { once: true });
    });
    this.ws.addEventListener("message", (event) => this.onMessage(event));
    this.ws.addEventListener("error", () => this.close());
    this.ws.addEventListener("close", () => {
      this.closed = true;
      for (const waiter of this.pending.values()) {
        clearTimeout(waiter.timeout);
        waiter.reject(new Error("CDP socket closed"));
      }
      this.pending.clear();
    });
    await this.send("Runtime.enable");
    await this.send("Page.enable");
    return this;
  }

  onMessage(event) {
    let message;
    try {
      message = JSON.parse(String(event.data));
    } catch {
      this.close();
      return;
    }
    if (message.id) {
      const waiter = this.pending.get(message.id);
      if (!waiter) return;
      clearTimeout(waiter.timeout);
      this.pending.delete(message.id);
      if (message.error) waiter.reject(new Error(`${message.error.message} (${message.error.code})`));
      else waiter.resolve(message.result);
      return;
    }
    for (const listener of this.listeners.get(message.method) ?? []) listener(message.params ?? {});
  }

  on(method, listener) {
    const listeners = this.listeners.get(method) ?? [];
    listeners.push(listener);
    this.listeners.set(method, listeners);
  }

  send(method, params = {}) {
    if (this.closed) return Promise.reject(new Error("CDP session is closed"));
    return new Promise((resolve, reject) => {
      const id = this.nextId++;
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`CDP command timed out: ${method}`));
      }, 10000);
      this.pending.set(id, { resolve, reject, timeout });
      try {
        this.ws.send(JSON.stringify({ id, method, params }));
      } catch (error) {
        clearTimeout(timeout);
        this.pending.delete(id);
        reject(error);
      }
    });
  }

  async evaluate(expression) {
    const result = await this.send("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
      userGesture: false,
    });
    if (result.exceptionDetails) {
      const detail = result.exceptionDetails.exception?.description ?? result.exceptionDetails.text;
      throw new Error(`Renderer evaluation failed: ${detail}`);
    }
    return result.result?.value;
  }

  close() {
    for (const waiter of this.pending.values()) {
      clearTimeout(waiter.timeout);
      waiter.reject(new Error("CDP session closed"));
    }
    this.pending.clear();
    if (!this.closed) {
      try { this.ws.close(); } catch {}
    }
    this.closed = true;
  }
}

class BrowserAnchor {
  constructor(url) {
    this.ws = new WebSocket(url);
    this.closed = false;
    this.ws.addEventListener("close", () => { this.closed = true; });
    this.ws.addEventListener("error", () => {
      this.closed = true;
      try { this.ws.close(); } catch {}
    });
  }

  async open() {
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => { this.close(); reject(new Error("Browser identity anchor timed out")); }, 5000);
      this.ws.addEventListener("open", () => { clearTimeout(timeout); resolve(); }, { once: true });
      this.ws.addEventListener("error", () => { clearTimeout(timeout); reject(new Error("Browser identity anchor failed")); }, { once: true });
    });
    return this;
  }

  close() {
    if (!this.closed) {
      try { this.ws.close(); } catch {}
    }
    this.closed = true;
  }
}

async function fetchCdpJson(port, resource) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2000);
  try {
    const response = await fetch(`http://127.0.0.1:${port}${resource}`, {
      redirect: "error",
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`CDP HTTP ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

async function assertBrowserIdentity(port, expectedBrowserId) {
  const version = await fetchCdpJson(port, "/json/version");
  const actualBrowserId = browserIdFromVersion(version, port);
  if (actualBrowserId !== expectedBrowserId) {
    throw new BrowserIdentityChangedError(`CDP browser identity changed from ${expectedBrowserId} to ${actualBrowserId}`);
  }
  return version;
}

async function connectBrowserAnchor(port, expectedBrowserId) {
  const version = await assertBrowserIdentity(port, expectedBrowserId);
  return new BrowserAnchor(validatedDebuggerUrl(version, port)).open();
}

async function listTargets(port, expectedBrowserId) {
  await assertBrowserIdentity(port, expectedBrowserId);
  const targets = await fetchCdpJson(port, "/json/list");
  if (!Array.isArray(targets)) throw new Error("CDP target list is not an array");
  return targets.filter((target) => validPageTarget(target, port));
}

async function probeSession(session) {
  return session.evaluate(`(() => {
    const root = document.documentElement;
    if (!root) return { claude: false, markers: {} };
    const style = getComputedStyle(root);
    const host = location.hostname.toLowerCase();
    const protocol = location.protocol;
    const title = document.title || '';
    const markers = {
      claudeHost: host === 'claude.ai' || host.endsWith('.claude.ai'),
      semanticTokens: Boolean(style.getPropertyValue('--bg-100').trim() || style.getPropertyValue('--claude-background-color').trim()),
      desktopFrame: Boolean(document.querySelector('.dframe-root, .dframe-sidebar, .dframe-content, .cds-root')),
      editor: Boolean(document.querySelector('.ProseMirror, [contenteditable="true"], textarea')),
      claudeTitle: /(^|\\s)Claude(\\s|$)/i.test(title),
    };
    const localClaudeFrame = (protocol === 'file:' || protocol === 'app:' || protocol === 'about:') &&
      (markers.semanticTokens || markers.desktopFrame || markers.claudeTitle);
    return {
      claude: markers.claudeHost || localClaudeFrame,
      markers,
      title: title.slice(0, 120),
      url: location.href.slice(0, 400),
    };
  })()`);
}

async function connectClaudeTargets(options) {
  const deadline = Date.now() + options.timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    const connected = [];
    try {
      const targets = await listTargets(options.port, options.browserId);
      for (const target of targets) {
        let session;
        try {
          session = await new CdpSession(target, options.port).open();
          const probe = await probeSession(session);
          if (probe?.claude) connected.push({ target, session, probe });
          else session.close();
        } catch (error) {
          session?.close();
          lastError = error;
        }
      }
      if (connected.length) return connected;
      lastError = new Error("No page matched Claude renderer markers");
    } catch (error) {
      for (const item of connected) item.session.close();
      if (error instanceof BrowserIdentityChangedError) throw error;
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 350));
  }
  throw new Error(`No verified Claude renderer on 127.0.0.1:${options.port}: ${lastError?.message ?? "timed out"}`);
}

async function removeFromSession(session) {
  return session.evaluate(`(() => {
    window.__CLAUDE_AURA_DISABLED__ = true;
    const state = window.__CLAUDE_AURA_STATE__;
    if (state?.cleanup) return state.cleanup();
    document.getElementById('claude-aura-style')?.remove();
    document.getElementById('claude-aura-backdrop')?.remove();
    const html = document.documentElement;
    html?.classList.remove('claude-aura', 'claude-aura-reduce-motion', 'claude-aura-animated-image');
    html?.style.removeProperty('--aura-image');
    html?.style.removeProperty('--aura-image-opacity');
    html?.style.removeProperty('--aura-image-position');
    html?.style.removeProperty('--aura-theme-art');
    html?.style.removeProperty('--aura-art-position');
    html?.style.removeProperty('--aura-art-size');
    if (html?.dataset) {
      delete html.dataset.claudeAuraTheme;
      delete html.dataset.claudeAuraVariant;
      delete html.dataset.claudeAuraArtMobile;
      delete html.dataset.claudeAuraDigest;
    }
    delete window.__CLAUDE_AURA_STATE__;
    return true;
  })()`);
}

async function verifyRemoved(session) {
  return session.evaluate(`(() => {
    const html = document.documentElement;
    return !html?.classList.contains('claude-aura') &&
      !html?.classList.contains('claude-aura-reduce-motion') &&
      !html?.classList.contains('claude-aura-animated-image') &&
      !document.getElementById('claude-aura-style') &&
      !document.getElementById('claude-aura-backdrop') &&
      !html?.style.getPropertyValue('--aura-image') &&
      !html?.style.getPropertyValue('--aura-theme-art') &&
      !html?.dataset?.claudeAuraTheme &&
      !html?.dataset?.claudeAuraVariant &&
      !html?.dataset?.claudeAuraArtMobile &&
      !html?.dataset?.claudeAuraDigest &&
      !window.__CLAUDE_AURA_STATE__;
  })()`);
}

async function verifySession(session, expectedDigest) {
  return session.evaluate(`(() => {
    const style = document.getElementById('claude-aura-style');
    const backdrop = document.getElementById('claude-aura-backdrop');
    const state = window.__CLAUDE_AURA_STATE__;
    const result = {
      installed: document.documentElement?.classList.contains('claude-aura') || false,
      version: state?.version ?? null,
      theme: state?.theme ?? null,
      digest: state?.digest ?? null,
      expectedDigest: ${JSON.stringify(expectedDigest)},
      stylePresent: Boolean(style),
      backdropPresent: Boolean(backdrop),
      backdropPointerEvents: backdrop ? getComputedStyle(backdrop).pointerEvents : null,
      interactiveSurface: Boolean(document.querySelector('.dframe-root, .ProseMirror, [contenteditable="true"], textarea, input, button')),
      viewport: { width: innerWidth, height: innerHeight },
    };
    result.pass = result.installed && result.version === ${JSON.stringify(AURA_VERSION)} &&
      result.digest === result.expectedDigest && result.stylePresent && result.backdropPresent &&
      result.backdropPointerEvents === 'none';
    return result;
  })()`);
}

async function waitForVerify(session, expectedDigest, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let result;
  while (Date.now() < deadline) {
    result = await verifySession(session, expectedDigest);
    if (result?.pass) return result;
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  return result;
}

async function capture(session, outputPath) {
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  const result = await session.send("Page.captureScreenshot", {
    format: "png",
    fromSurface: true,
    captureBeyondViewport: false,
  });
  await fs.writeFile(outputPath, Buffer.from(result.data, "base64"));
}

async function dependencySignature(bundle) {
  const files = [
    bundle.configPath,
    bundle.themePath,
    bundle.image?.path,
    path.join(PROJECT_ROOT, "assets", "base.css"),
    path.join(PROJECT_ROOT, "assets", "renderer-inject.js"),
  ].filter(Boolean);
  const rows = [];
  for (const file of files) {
    try {
      const stat = await fs.stat(file);
      rows.push(`${file}\0${stat.size}\0${stat.mtimeMs}`);
    } catch (error) {
      rows.push(`${file}\0${error.code ?? "missing"}`);
    }
  }
  return rows.join("\n");
}

async function runOneShot(options) {
  const connected = await connectClaudeTargets(options);
  const bundle = ["apply", "verify"].includes(options.mode)
    ? await buildPayload({ configPath: options.configPath })
    : null;
  const results = [];
  let captured = false;
  try {
    for (const { target, session, probe } of connected) {
      try {
        let result;
        if (options.mode === "diagnose") {
          result = { pass: true, probe };
        } else if (options.mode === "remove") {
          await removeFromSession(session);
          result = await verifyRemoved(session);
        } else {
          if (options.mode === "apply") await session.evaluate(bundle.payload);
          result = await waitForVerify(session, bundle.digest, options.timeoutMs);
        }
        results.push({ targetId: target.id, targetUrl: target.url.slice(0, 400), markers: probe.markers, result });
        if (options.screenshot && !captured) {
          await capture(session, options.screenshot);
          captured = true;
        }
      } finally {
        session.close();
      }
    }
  } finally {
    for (const item of connected) item.session.close();
  }
  const output = { mode: options.mode, port: options.port, theme: bundle?.theme.name ?? null, targets: results };
  console.log(JSON.stringify(output, null, 2));
  const failed = results.length === 0 || results.some((item) =>
    options.mode === "remove" ? item.result !== true : !item.result?.pass);
  if (failed) process.exitCode = 2;
}

async function runWatch(options) {
  const anchor = await connectBrowserAnchor(options.port, options.browserId);
  const sessions = new Map();
  const failures = new Map();
  let stopping = false;
  let bundle = await buildPayload({ configPath: options.configPath });
  let signature = await dependencySignature(bundle);
  let lastDependencyCheck = 0;
  const stop = () => { stopping = true; };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);

  const applyCurrent = async (id, session) => {
    const probe = await probeSession(session);
    if (!probe?.claude) {
      session.close();
      sessions.delete(id);
      return false;
    }
    await session.evaluate(bundle.payload);
    const item = sessions.get(id);
    if (item) item.digest = bundle.digest;
    return true;
  };

  try {
    while (!stopping) {
      if (anchor.closed) {
        console.error("[claude-aura] original CDP browser identity closed; watcher is stopping");
        process.exitCode = 3;
        break;
      }

      if (Date.now() - lastDependencyCheck >= 1500) {
        lastDependencyCheck = Date.now();
        const nextSignature = await dependencySignature(bundle);
        if (nextSignature !== signature) {
          try {
            const nextBundle = await buildPayload({ configPath: options.configPath });
            bundle = nextBundle;
            signature = await dependencySignature(bundle);
            for (const [id, item] of sessions) {
              try { await applyCurrent(id, item.session); } catch (error) {
                console.error(`[claude-aura] live theme update failed for ${id}: ${error.message}`);
              }
            }
            console.log(`[claude-aura] switched live to ${bundle.theme.name} (${bundle.digest.slice(0, 10)})`);
          } catch (error) {
            console.error(`[claude-aura] config change rejected; keeping previous theme: ${error.message}`);
          }
        }
      }

      let targets;
      try {
        targets = await listTargets(options.port, options.browserId);
      } catch (error) {
        if (error instanceof BrowserIdentityChangedError) throw error;
        console.error(`[claude-aura] target scan failed: ${error.message}`);
        await new Promise((resolve) => setTimeout(resolve, 1200));
        continue;
      }
      const activeIds = new Set(targets.map((target) => target.id));
      for (const [id, item] of sessions) {
        if (!activeIds.has(id) || item.session.closed) {
          item.session.close();
          sessions.delete(id);
        }
      }
      for (const id of failures.keys()) if (!activeIds.has(id)) failures.delete(id);

      for (const target of targets) {
        if (sessions.has(target.id) || (failures.get(target.id) ?? 0) > Date.now()) continue;
        let session;
        try {
          session = await new CdpSession(target, options.port).open();
          const probe = await probeSession(session);
          if (!probe?.claude) {
            session.close();
            failures.set(target.id, Date.now() + 5000);
            continue;
          }
          const item = { session, digest: null };
          sessions.set(target.id, item);
          session.on("Page.loadEventFired", () => {
            setTimeout(() => applyCurrent(target.id, session).catch((error) => {
              console.error(`[claude-aura] reinjection failed for ${target.id}: ${error.message}`);
            }), 280);
          });
          await applyCurrent(target.id, session);
          failures.delete(target.id);
          console.log(`[claude-aura] themed ${target.id} (${probe.title || target.url})`);
        } catch (error) {
          session?.close();
          sessions.delete(target.id);
          failures.set(target.id, Date.now() + 3000);
          console.error(`[claude-aura] target ${target.id} rejected: ${error.message}`);
        }
      }
      await new Promise((resolve) => setTimeout(resolve, 1100));
    }
  } finally {
    anchor.close();
    for (const item of sessions.values()) item.session.close();
  }
}

async function selfTest(options) {
  const validPage = {
    id: "page-test",
    type: "page",
    url: "https://claude.ai/new",
    webSocketDebuggerUrl: `ws://127.0.0.1:${options.port}/devtools/page/page-test`,
  };
  const validBrowser = { webSocketDebuggerUrl: `ws://127.0.0.1:${options.port}/devtools/browser/browser-test` };
  if (!validPageTarget(validPage, options.port) || browserIdFromVersion(validBrowser, options.port) !== "browser-test") {
    throw new Error("Valid CDP fixtures were rejected");
  }
  const unsafeUrls = [
    "ws://example.com/devtools/page/page-test",
    `ws://127.0.0.1:${options.port + 1}/devtools/page/page-test`,
    `wss://127.0.0.1:${options.port}/devtools/page/page-test`,
    `ws://user@127.0.0.1:${options.port}/devtools/page/page-test`,
    `ws://127.0.0.1:${options.port}/devtools/page/page-test?query=1`,
    `ws://127.0.0.1:${options.port}/unexpected/page-test`,
  ];
  for (const value of unsafeUrls) {
    let rejected = false;
    try { validatedDebuggerUrl(value, options.port); } catch { rejected = true; }
    if (!rejected) throw new Error(`Unsafe WebSocket URL was accepted: ${value}`);
  }
  const unsafeTargets = [
    { ...validPage, url: "https://example.com/" },
    { ...validPage, id: "other", webSocketDebuggerUrl: validPage.webSocketDebuggerUrl },
    { ...validPage, type: "service_worker" },
    { ...validPage, webSocketDebuggerUrl: `ws://127.0.0.1:${options.port}/devtools/browser/page-test` },
  ];
  if (unsafeTargets.some((target) => validPageTarget(target, options.port))) {
    throw new Error("Unsafe CDP target fixture was accepted");
  }
  console.log(JSON.stringify({ pass: true, version: AURA_VERSION, test: "loopback-cdp-validation" }));
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.mode === "self-test") return selfTest(options);
  if (options.mode === "check-payload") {
    const bundle = await buildPayload({ configPath: options.configPath });
    if (bundle.payload.includes("__AURA_CSS_JSON__") || bundle.payload.includes("__AURA_SETTINGS_JSON__")) {
      throw new Error("Payload placeholders remain");
    }
    new Function(bundle.payload);
    console.log(JSON.stringify({ pass: true, version: AURA_VERSION, theme: bundle.theme.name, payloadBytes: Buffer.byteLength(bundle.payload) }));
    return;
  }
  if (options.mode === "watch") return runWatch(options);
  return runOneShot(options);
}

main().catch((error) => {
  console.error(`[claude-aura] ${error.message}`);
  process.exitCode = 1;
});
