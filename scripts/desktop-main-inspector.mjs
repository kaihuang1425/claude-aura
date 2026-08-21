import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { buildPayload } from "./theme-core/compile.mjs";
import {
  CDP_TIMEOUT_POLICY,
  parseCdpFrame,
  validateHttpEndpoint,
  validatePort,
  validateTimeoutPolicy,
} from "./desktop-cdp/validation.mjs";

const EXACT_DESKTOP_VERSION = "1.28929.0.0";
const MAX_HTTP_RESPONSE_BYTES = 262_144;
const MAX_THEME_PAYLOAD_BYTES = 1_000_000;
const MIN_HOLD_MS = 10_000;
const MAX_HOLD_MS = 60_000;
const SELF_CLEANUP_MS = 65_000;
const STATE_KEY = "__claudeAuraDesktopMainInspectorProofV1";
const THEME_STATE_KEY = "__claudeAuraDesktopMainRendererThemeV1";
const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PERMANENT_THEME_IDS = Object.freeze([
  "default",
  "japanese-film-editorial",
  "korean-prestige",
  "cartoon-studio",
  "anime-twilight",
  "study-library",
  "japanese-idol",
  "korean-idol",
]);
const PROOF_CSS = `
:root {
  --claude-aura-desktop-experimental-proof: 1;
}
html {
  box-shadow: inset 0 0 0 4px rgba(217, 119, 87, 0.98) !important;
}
@media (forced-colors: active) {
  html {
    box-shadow: inset 0 0 0 4px CanvasText !important;
  }
}
`;
const ALLOWED_CONTENT_TYPES = Object.freeze(["window"]);

function validateInspectorId(value) {
  if (typeof value !== "string" || !/^[A-Za-z0-9._-]{1,200}$/.test(value)) {
    throw new Error("desktop-main-inspector-id-invalid");
  }
  return value;
}

export function validatedMainInspectorUrl(value, port, expectedInspectorId) {
  const expectedPort = validatePort(port);
  const expectedId = validateInspectorId(expectedInspectorId);
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error("desktop-main-inspector-url-invalid");
  }
  if (url.protocol !== "ws:"
      || !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)
      || Number(url.port) !== expectedPort
      || url.username || url.password || url.search || url.hash
      || url.pathname !== `/${expectedId}`) {
    throw new Error("desktop-main-inspector-url-invalid");
  }
  return url.href;
}

function validateHoldMs(value) {
  const holdMs = Number(value);
  if (!Number.isInteger(holdMs) || holdMs < MIN_HOLD_MS || holdMs > MAX_HOLD_MS) {
    throw new Error("desktop-main-inspector-hold-invalid");
  }
  return holdMs;
}

function parseArgs(argv) {
  const values = new Map();
  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (!flag?.startsWith("--") || value === undefined) {
      throw new Error("desktop-main-inspector-arguments-invalid");
    }
    values.set(flag, value);
  }
  const endpoint = validateHttpEndpoint(values.get("--endpoint"));
  const endpointUrl = new URL(endpoint);
  const inspectorId = validateInspectorId(values.get("--inspector-id"));
  const timeoutMs = validateTimeoutPolicy(Number(values.get("--timeout-ms")));
  const holdMs = validateHoldMs(values.get("--hold-ms"));
  if (values.get("--desktop-version") !== EXACT_DESKTOP_VERSION
      || values.get("--packaging") !== "msix") {
    throw new Error("desktop-main-inspector-build-not-authorized");
  }
  const themeId = values.get("--theme-id") ?? null;
  const appearance = values.get("--appearance") ?? null;
  if ((themeId === null) !== (appearance === null)
      || (themeId !== null && !PERMANENT_THEME_IDS.includes(themeId))
      || (appearance !== null && !["system", "light", "dark"].includes(appearance))) {
    throw new Error("desktop-main-inspector-theme-invalid");
  }
  return {
    endpoint,
    inspectorId,
    port: Number(endpointUrl.port),
    timeoutMs,
    holdMs,
    themeId,
    appearance,
  };
}

async function fetchJson(url, timeoutMs, fetchImpl) {
  const response = await fetchImpl(url, {
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(Math.min(timeoutMs, CDP_TIMEOUT_POLICY.endpointMs)),
  });
  if (!response.ok) throw new Error("desktop-main-inspector-http-failed");
  const text = await response.text();
  if (Buffer.byteLength(text, "utf8") > MAX_HTTP_RESPONSE_BYTES) {
    throw new Error("desktop-main-inspector-http-oversized");
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error("desktop-main-inspector-http-invalid");
  }
}

async function pinnedInspectorTarget(options, fetchImpl) {
  const listUrl = new URL("json/list", options.endpoint);
  const targets = await fetchJson(listUrl, options.timeoutMs, fetchImpl);
  if (!Array.isArray(targets) || targets.length !== 1) {
    throw new Error("desktop-main-inspector-target-count-invalid");
  }
  const [target] = targets;
  if (target?.type !== "node" || target.id !== options.inspectorId) {
    throw new Error("desktop-main-inspector-target-invalid");
  }
  return {
    id: options.inspectorId,
    webSocketDebuggerUrl: validatedMainInspectorUrl(
      target.webSocketDebuggerUrl,
      options.port,
      options.inspectorId,
    ),
  };
}

export class DesktopMainInspectorSession {
  #allowedExpressions;
  #closed = false;
  #commandTimeoutMs;
  #contextAmbiguous = false;
  #contextWaiters = [];
  #defaultContextId = null;
  #nextId = 1;
  #pending = new Map();
  #socket = null;
  #socketOpenTimeoutMs;
  #url;
  #WebSocketImpl;

  constructor(target, port, inspectorId, allowedExpressions, {
    WebSocketImpl = WebSocket,
    commandTimeoutMs = CDP_TIMEOUT_POLICY.commandMs,
    socketOpenTimeoutMs = CDP_TIMEOUT_POLICY.socketOpenMs,
  } = {}) {
    if (!(allowedExpressions instanceof Set) || allowedExpressions.size < 1
        || [...allowedExpressions].some((value) => typeof value !== "string" || !value)) {
      throw new Error("desktop-main-inspector-expression-policy-invalid");
    }
    this.#url = validatedMainInspectorUrl(target.webSocketDebuggerUrl, port, inspectorId);
    this.#allowedExpressions = new Set(allowedExpressions);
    this.#WebSocketImpl = WebSocketImpl;
    this.#commandTimeoutMs = commandTimeoutMs;
    this.#socketOpenTimeoutMs = socketOpenTimeoutMs;
    Object.preventExtensions(this);
  }

  async open() {
    if (this.#socket) throw new Error("desktop-main-inspector-session-already-open");
    const socket = new this.#WebSocketImpl(this.#url);
    this.#socket = socket;
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        try { socket.close(); } catch {}
        reject(new Error("desktop-main-inspector-socket-timeout"));
      }, this.#socketOpenTimeoutMs);
      socket.addEventListener("open", () => {
        clearTimeout(timeout);
        resolve();
      }, { once: true });
      socket.addEventListener("error", () => {
        clearTimeout(timeout);
        reject(new Error("desktop-main-inspector-socket-failed"));
      }, { once: true });
    });
    socket.addEventListener("message", (event) => this.#onMessage(event));
    socket.addEventListener("error", () => this.close());
    socket.addEventListener("close", () => this.#onClose());
    return this;
  }

  #onMessage(event) {
    let message;
    try {
      message = parseCdpFrame(event.data);
    } catch {
      this.close();
      return;
    }
    if (message.method === "Runtime.executionContextCreated") {
      const context = message.params?.context;
      if (!Number.isInteger(context?.id) || context?.auxData?.isDefault !== true) return;
      if (this.#defaultContextId !== null && this.#defaultContextId !== context.id) {
        this.#contextAmbiguous = true;
        for (const waiter of this.#contextWaiters.splice(0)) {
          clearTimeout(waiter.timeout);
          waiter.reject(new Error("desktop-main-inspector-context-ambiguous"));
        }
        return;
      }
      this.#defaultContextId = context.id;
      for (const waiter of this.#contextWaiters.splice(0)) {
        clearTimeout(waiter.timeout);
        waiter.resolve(context.id);
      }
      return;
    }
    if (!Number.isInteger(message.id)) return;
    const pending = this.#pending.get(message.id);
    if (!pending) return;
    this.#pending.delete(message.id);
    clearTimeout(pending.timeout);
    if (message.error) pending.reject(new Error("desktop-main-inspector-command-failed"));
    else pending.resolve(message.result ?? {});
  }

  #onClose() {
    if (this.#closed) return;
    this.#closed = true;
    for (const pending of this.#pending.values()) {
      clearTimeout(pending.timeout);
      pending.reject(new Error("desktop-main-inspector-socket-closed"));
    }
    this.#pending.clear();
    for (const waiter of this.#contextWaiters.splice(0)) {
      clearTimeout(waiter.timeout);
      waiter.reject(new Error("desktop-main-inspector-socket-closed"));
    }
  }

  #send(method, params) {
    if (!["Runtime.enable", "Runtime.evaluate"].includes(method)) {
      return Promise.reject(new Error("desktop-main-inspector-method-rejected"));
    }
    if (!this.#socket || this.#closed
        || this.#socket.readyState !== this.#WebSocketImpl.OPEN) {
      return Promise.reject(new Error("desktop-main-inspector-session-closed"));
    }
    const id = this.#nextId++;
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.#pending.delete(id);
        reject(new Error("desktop-main-inspector-command-timeout"));
      }, this.#commandTimeoutMs);
      this.#pending.set(id, { resolve, reject, timeout });
      this.#socket.send(JSON.stringify({ id, method, params }));
    });
  }

  async enable() {
    await this.#send("Runtime.enable", {});
    if (this.#contextAmbiguous) {
      throw new Error("desktop-main-inspector-context-ambiguous");
    }
    if (this.#defaultContextId !== null) return this.#defaultContextId;
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        const index = this.#contextWaiters.findIndex((entry) => entry.resolve === resolve);
        if (index >= 0) this.#contextWaiters.splice(index, 1);
        reject(new Error("desktop-main-inspector-context-timeout"));
      }, this.#commandTimeoutMs);
      this.#contextWaiters.push({ resolve, reject, timeout });
    });
  }

  async evaluate(expression, contextId) {
    if (!this.#allowedExpressions.has(expression)) {
      throw new Error("desktop-main-inspector-expression-rejected");
    }
    if (!Number.isInteger(contextId) || contextId !== this.#defaultContextId
        || this.#contextAmbiguous) {
      throw new Error("desktop-main-inspector-context-invalid");
    }
    const result = await this.#send("Runtime.evaluate", {
      expression,
      contextId,
      includeCommandLineAPI: true,
      awaitPromise: true,
      returnByValue: true,
      generatePreview: false,
    });
    if (result.exceptionDetails || result.result?.type !== "object"
        || result.result?.value === null || typeof result.result?.value !== "object") {
      throw new Error("desktop-main-inspector-evaluation-failed");
    }
    return result.result.value;
  }

  close() {
    if (this.#closed) return;
    this.#closed = true;
    try { this.#socket?.close(); } catch {}
    for (const pending of this.#pending.values()) {
      clearTimeout(pending.timeout);
      pending.reject(new Error("desktop-main-inspector-session-closed"));
    }
    this.#pending.clear();
    for (const waiter of this.#contextWaiters.splice(0)) {
      clearTimeout(waiter.timeout);
      waiter.reject(new Error("desktop-main-inspector-session-closed"));
    }
  }
}

export function mainInspectorApplyExpression() {
  const css = JSON.stringify(PROOF_CSS);
  const stateKey = JSON.stringify(STATE_KEY);
  const allowedTypes = JSON.stringify(ALLOWED_CONTENT_TYPES);
  const selfCleanupMs = JSON.stringify(SELF_CLEANUP_MS);
  return `(async () => {
    const stateKey = ${stateKey};
    const allowedTypes = new Set(${allowedTypes});
    const electron = typeof require === "function"
      ? require("electron")
      : process.mainModule?.require?.("electron");
    if (!electron?.app || !electron?.webContents) {
      return { pass: false, reasonCode: "desktop-main-inspector-electron-unavailable" };
    }
    if (globalThis[stateKey]) {
      return { pass: false, reasonCode: "desktop-main-inspector-owner-exists" };
    }
    const allContents = electron.webContents.getAllWebContents()
      .filter((contents) => !contents.isDestroyed());
    const typeCounts = {};
    for (const contents of allContents) {
      const type = contents.getType();
      typeCounts[type] = (typeCounts[type] ?? 0) + 1;
    }
    const focused = electron.webContents.getFocusedWebContents();
    const windows = allContents.filter((contents) => contents.getType() === "window");
    if (!focused || focused.isDestroyed() || !allowedTypes.has(focused.getType())
        || windows.length !== 1 || windows[0].id !== focused.id) {
      return {
        pass: false,
        reasonCode: "desktop-main-inspector-focused-window-ambiguous",
        typeCounts,
      };
    }
    let cleanupStarted = false;
    let insertedKey = null;
    let selfCleanupTimer = null;
    const apply = async () => {
      if (focused.isDestroyed() || cleanupStarted) return false;
      if (insertedKey) {
        try { await focused.removeInsertedCSS(insertedKey); } catch {}
        insertedKey = null;
      }
      try {
        insertedKey = await focused.insertCSS(${css}, { cssOrigin: "user" });
        return true;
      } catch {
        return false;
      }
    };
    const reload = () => { void apply(); };
    const failClosed = () => { void cleanup(false); };
    const onCreated = (_event, contents) => {
      if (!contents.isDestroyed() && contents.getType() === "window"
          && contents.id !== focused.id) failClosed();
    };
    const cleanup = async (quitAfter) => {
      if (cleanupStarted) {
        if (quitAfter) setTimeout(() => electron.app.quit(), 0);
        return {
          pass: true,
          reasonCode: "desktop-main-inspector-cleanup-complete",
          cleanupComplete: true,
          removedCount: 0,
          quitScheduled: Boolean(quitAfter),
        };
      }
      cleanupStarted = true;
      if (selfCleanupTimer) clearTimeout(selfCleanupTimer);
      electron.app.removeListener("web-contents-created", onCreated);
      if (!focused.isDestroyed()) {
        focused.removeListener("did-finish-load", reload);
        focused.removeListener("destroyed", failClosed);
        focused.removeListener("render-process-gone", failClosed);
      }
      let removedCount = 0;
      if (insertedKey && !focused.isDestroyed()) {
        try {
          await focused.removeInsertedCSS(insertedKey);
          removedCount = 1;
        } catch {}
      }
      insertedKey = null;
      delete globalThis[stateKey];
      if (quitAfter) setTimeout(() => electron.app.quit(), 0);
      return {
        pass: true,
        reasonCode: "desktop-main-inspector-cleanup-complete",
        cleanupComplete: true,
        removedCount,
        quitScheduled: Boolean(quitAfter),
      };
    };
    globalThis[stateKey] = { cleanup };
    focused.on("did-finish-load", reload);
    focused.once("destroyed", failClosed);
    focused.once("render-process-gone", failClosed);
    electron.app.on("web-contents-created", onCreated);
    selfCleanupTimer = setTimeout(() => { void cleanup(false); }, ${selfCleanupMs});
    const applied = await apply();
    return {
      pass: applied,
      reasonCode: applied
        ? "desktop-main-inspector-proof-applied"
        : "desktop-main-inspector-css-insertion-failed",
      appliedCount: applied ? 1 : 0,
      eligibleCount: 1,
      focusedType: focused.getType(),
      typeCounts,
    };
  })()`;
}

export function mainInspectorCleanupExpression() {
  const stateKey = JSON.stringify(STATE_KEY);
  return `(async () => {
    const state = globalThis[${stateKey}];
    if (!state?.cleanup) {
      return { pass: false, reasonCode: "desktop-main-inspector-state-missing" };
    }
    return state.cleanup(true);
  })()`;
}

function validatePermanentTheme(themeId, appearance) {
  if (!PERMANENT_THEME_IDS.includes(themeId)
      || !["system", "light", "dark"].includes(appearance)) {
    throw new Error("desktop-main-inspector-theme-invalid");
  }
}

export async function buildDesktopThemePayload({ themeId, appearance }) {
  validatePermanentTheme(themeId, appearance);
  const compiled = await buildPayload({
    configPath: path.join(PROJECT_ROOT, "config.example.json"),
    config: {
      enabled: true,
      theme: themeId,
      appearance,
      reduceMotion: false,
      imagePosition: "center",
      imageZoom: 1,
    },
  });
  const payloadBytes = Buffer.byteLength(compiled.payload ?? "", "utf8");
  if (compiled.theme?.name !== themeId
      || compiled.settings?.appearance !== appearance
      || typeof compiled.payload !== "string" || payloadBytes < 1
      || payloadBytes > MAX_THEME_PAYLOAD_BYTES
      || !/^[a-f0-9]{64}$/u.test(compiled.digest ?? "")) {
    throw new Error("desktop-main-inspector-theme-payload-invalid");
  }
  return {
    payload: compiled.payload,
    payloadBytes,
    digest: compiled.digest,
    themeId,
    appearance,
  };
}

export function mainInspectorThemeApplyExpression(themePayload) {
  const actualPayloadBytes = typeof themePayload?.payload === "string"
    ? Buffer.byteLength(themePayload.payload, "utf8") : 0;
  if (!themePayload || typeof themePayload.payload !== "string"
      || actualPayloadBytes < 1 || actualPayloadBytes > MAX_THEME_PAYLOAD_BYTES
      || themePayload.payloadBytes !== actualPayloadBytes
      || !/^[a-f0-9]{64}$/u.test(themePayload.digest ?? "")) {
    throw new Error("desktop-main-inspector-theme-payload-invalid");
  }
  validatePermanentTheme(themePayload.themeId, themePayload.appearance);
  const payload = JSON.stringify(themePayload.payload);
  const stateKey = JSON.stringify(THEME_STATE_KEY);
  const allowedTypes = JSON.stringify(ALLOWED_CONTENT_TYPES);
  const expectedTheme = JSON.stringify(themePayload.themeId);
  const expectedAppearance = JSON.stringify(themePayload.appearance);
  const expectedDigest = JSON.stringify(themePayload.digest);
  const payloadBytes = JSON.stringify(themePayload.payloadBytes);
  const selfCleanupMs = JSON.stringify(SELF_CLEANUP_MS);
  const rendererCleanup = JSON.stringify(`(() => {
    const state = globalThis.__CLAUDE_AURA_STATE__;
    if (!state?.cleanup) return true;
    return state.cleanup(false) !== false;
  })()`);
  return `(async () => {
    const stateKey = ${stateKey};
    const allowedTypes = new Set(${allowedTypes});
    const expectedTheme = ${expectedTheme};
    const expectedAppearance = ${expectedAppearance};
    const expectedDigest = ${expectedDigest};
    const payloadBytes = ${payloadBytes};
    const rendererPayload = ${payload};
    const rendererCleanup = ${rendererCleanup};
    const electron = typeof require === "function"
      ? require("electron")
      : process.mainModule?.require?.("electron");
    if (!electron?.app || !electron?.webContents) {
      return { pass: false, reasonCode: "desktop-main-inspector-electron-unavailable" };
    }
    if (globalThis[stateKey]) {
      return { pass: false, reasonCode: "desktop-main-inspector-owner-exists" };
    }
    const allContents = electron.webContents.getAllWebContents()
      .filter((contents) => !contents.isDestroyed());
    const typeCounts = {};
    for (const contents of allContents) {
      const type = contents.getType();
      typeCounts[type] = (typeCounts[type] ?? 0) + 1;
    }
    const focused = electron.webContents.getFocusedWebContents();
    const windows = allContents.filter((contents) => contents.getType() === "window");
    if (!focused || focused.isDestroyed() || !allowedTypes.has(focused.getType())
        || windows.length !== 1 || windows[0].id !== focused.id) {
      return {
        pass: false,
        reasonCode: "desktop-main-inspector-focused-window-ambiguous",
        typeCounts,
      };
    }
    let cleanupStarted = false;
    let rendererApplied = false;
    let selfCleanupTimer = null;
    const apply = async () => {
      if (focused.isDestroyed() || cleanupStarted) return false;
      try {
        const result = await focused.executeJavaScript(rendererPayload, true);
        rendererApplied = result?.installed === true
          && result.theme === expectedTheme && result.digest === expectedDigest;
        return rendererApplied;
      } catch {
        rendererApplied = false;
        return false;
      }
    };
    const reload = () => { void apply(); };
    const failClosed = () => { void cleanup(false); };
    const onCreated = (_event, contents) => {
      if (!contents.isDestroyed() && contents.getType() === "window"
          && contents.id !== focused.id) failClosed();
    };
    const cleanup = async (quitAfter) => {
      if (cleanupStarted) {
        if (quitAfter) setTimeout(() => electron.app.quit(), 0);
        return {
          pass: true,
          reasonCode: "desktop-main-inspector-theme-cleanup-complete",
          cleanupComplete: true,
          removedCount: 0,
          quitScheduled: Boolean(quitAfter),
        };
      }
      cleanupStarted = true;
      if (selfCleanupTimer) clearTimeout(selfCleanupTimer);
      electron.app.removeListener("web-contents-created", onCreated);
      if (!focused.isDestroyed()) {
        focused.removeListener("did-finish-load", reload);
        focused.removeListener("destroyed", failClosed);
        focused.removeListener("render-process-gone", failClosed);
      }
      let removedCount = 0;
      if (rendererApplied && !focused.isDestroyed()) {
        try {
          if (await focused.executeJavaScript(rendererCleanup, true) === true) {
            removedCount = 1;
          }
        } catch {}
      }
      rendererApplied = false;
      delete globalThis[stateKey];
      if (quitAfter) setTimeout(() => electron.app.quit(), 0);
      return {
        pass: true,
        reasonCode: "desktop-main-inspector-theme-cleanup-complete",
        cleanupComplete: true,
        removedCount,
        quitScheduled: Boolean(quitAfter),
      };
    };
    globalThis[stateKey] = { cleanup };
    focused.on("did-finish-load", reload);
    focused.once("destroyed", failClosed);
    focused.once("render-process-gone", failClosed);
    electron.app.on("web-contents-created", onCreated);
    selfCleanupTimer = setTimeout(() => { void cleanup(false); }, ${selfCleanupMs});
    const applied = await apply();
    return {
      pass: applied,
      reasonCode: applied
        ? "desktop-main-inspector-theme-applied"
        : "desktop-main-inspector-theme-injection-failed",
      appliedCount: applied ? 1 : 0,
      eligibleCount: 1,
      focusedType: focused.getType(),
      typeCounts,
      themeId: expectedTheme,
      appearance: expectedAppearance,
      payloadBytes,
    };
  })()`;
}

export function mainInspectorThemeCleanupExpression() {
  const stateKey = JSON.stringify(THEME_STATE_KEY);
  return `(async () => {
    const state = globalThis[${stateKey}];
    if (!state?.cleanup) {
      return { pass: false, reasonCode: "desktop-main-inspector-state-missing" };
    }
    return state.cleanup(true);
  })()`;
}

function validateProofResult(value) {
  if (value?.pass !== true || value.reasonCode !== "desktop-main-inspector-proof-applied"
      || !Number.isInteger(value.appliedCount) || value.appliedCount < 1
      || !Number.isInteger(value.eligibleCount) || value.eligibleCount < value.appliedCount
      || value.focusedType !== "window" || value.typeCounts === null
      || typeof value.typeCounts !== "object" || Array.isArray(value.typeCounts)
      || Object.entries(value.typeCounts).length > 16
      || Object.entries(value.typeCounts).some(([type, count]) =>
        !/^[A-Za-z-]{1,40}$/.test(type) || !Number.isInteger(count) || count < 1 || count > 100)) {
    throw new Error("desktop-main-inspector-proof-invalid");
  }
  return value;
}

function validateCleanupResult(value) {
  if (value?.pass !== true
      || value.reasonCode !== "desktop-main-inspector-cleanup-complete"
      || value.cleanupComplete !== true || value.quitScheduled !== true
      || !Number.isInteger(value.removedCount) || value.removedCount < 1) {
    throw new Error("desktop-main-inspector-cleanup-invalid");
  }
  return value;
}

function validateThemeProofResult(value, themePayload) {
  if (value?.pass !== true
      || value.reasonCode !== "desktop-main-inspector-theme-applied"
      || value.themeId !== themePayload.themeId
      || value.appearance !== themePayload.appearance
      || value.payloadBytes !== themePayload.payloadBytes
      || !Number.isInteger(value.appliedCount) || value.appliedCount !== 1
      || !Number.isInteger(value.eligibleCount) || value.eligibleCount !== 1
      || value.focusedType !== "window" || value.typeCounts === null
      || typeof value.typeCounts !== "object" || Array.isArray(value.typeCounts)
      || Object.entries(value.typeCounts).length > 16
      || Object.entries(value.typeCounts).some(([type, count]) =>
        !/^[A-Za-z-]{1,40}$/.test(type) || !Number.isInteger(count)
        || count < 1 || count > 100)) {
    throw new Error("desktop-main-inspector-theme-proof-invalid");
  }
  return value;
}

function validateThemeCleanupResult(value) {
  if (value?.pass !== true
      || value.reasonCode !== "desktop-main-inspector-theme-cleanup-complete"
      || value.cleanupComplete !== true || value.quitScheduled !== true
      || !Number.isInteger(value.removedCount) || value.removedCount < 1) {
    throw new Error("desktop-main-inspector-theme-cleanup-invalid");
  }
  return value;
}

export async function runDesktopMainInspectorProof(options, {
  fetch: fetchImpl = fetch,
  WebSocketImpl = WebSocket,
  sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
} = {}) {
  const timeoutMs = validateTimeoutPolicy(options.timeoutMs);
  const holdMs = validateHoldMs(options.holdMs);
  const endpoint = validateHttpEndpoint(options.endpoint);
  const endpointUrl = new URL(endpoint);
  const inspectorId = validateInspectorId(options.inspectorId);
  const normalized = {
    endpoint,
    inspectorId,
    port: Number(endpointUrl.port),
    timeoutMs,
    holdMs,
  };
  const target = await pinnedInspectorTarget(normalized, fetchImpl);
  const applyExpression = mainInspectorApplyExpression();
  const cleanupExpression = mainInspectorCleanupExpression();
  const session = new DesktopMainInspectorSession(
    target,
    normalized.port,
    inspectorId,
    new Set([applyExpression, cleanupExpression]),
    { WebSocketImpl },
  );
  let applyAttempted = false;
  let cleanup;
  try {
    await session.open();
    const contextId = await session.enable();
    applyAttempted = true;
    const proof = validateProofResult(await session.evaluate(applyExpression, contextId));
    await sleep(holdMs);
    cleanup = validateCleanupResult(await session.evaluate(cleanupExpression, contextId));
    return {
      schemaVersion: 1,
      status: "ok",
      reasonCode: "desktop-main-inspector-proof-complete",
      inspectorPinned: true,
      loopbackOnly: true,
      holdMs,
      appliedCount: proof.appliedCount,
      eligibleCount: proof.eligibleCount,
      focusedType: proof.focusedType,
      typeCounts: proof.typeCounts,
      cleanupComplete: cleanup.cleanupComplete,
      removedCount: cleanup.removedCount,
      quitScheduled: cleanup.quitScheduled,
    };
  } finally {
    if (applyAttempted && !cleanup) {
      try {
        const contextId = await session.enable();
        await session.evaluate(cleanupExpression, contextId);
      } catch {}
    }
    session.close();
  }
}

export async function runDesktopMainInspectorThemeProof(options, {
  fetch: fetchImpl = fetch,
  WebSocketImpl = WebSocket,
  sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
} = {}) {
  const timeoutMs = validateTimeoutPolicy(options.timeoutMs);
  const holdMs = validateHoldMs(options.holdMs);
  const endpoint = validateHttpEndpoint(options.endpoint);
  const endpointUrl = new URL(endpoint);
  const inspectorId = validateInspectorId(options.inspectorId);
  const themePayload = await buildDesktopThemePayload({
    themeId: options.themeId,
    appearance: options.appearance,
  });
  const normalized = {
    endpoint,
    inspectorId,
    port: Number(endpointUrl.port),
    timeoutMs,
    holdMs,
  };
  const target = await pinnedInspectorTarget(normalized, fetchImpl);
  const applyExpression = mainInspectorThemeApplyExpression(themePayload);
  const cleanupExpression = mainInspectorThemeCleanupExpression();
  const session = new DesktopMainInspectorSession(
    target,
    normalized.port,
    inspectorId,
    new Set([applyExpression, cleanupExpression]),
    { WebSocketImpl },
  );
  let applyAttempted = false;
  let cleanup;
  try {
    await session.open();
    const contextId = await session.enable();
    applyAttempted = true;
    const proof = validateThemeProofResult(
      await session.evaluate(applyExpression, contextId),
      themePayload,
    );
    await sleep(holdMs);
    cleanup = validateThemeCleanupResult(
      await session.evaluate(cleanupExpression, contextId),
    );
    return {
      schemaVersion: 1,
      status: "ok",
      reasonCode: "desktop-main-inspector-theme-proof-complete",
      inspectorPinned: true,
      rendererPayloadApplied: true,
      contentAccess: true,
      contentAccessKind: "local-renderer-theme-payload",
      contentEgress: false,
      loopbackOnly: true,
      themeId: themePayload.themeId,
      appearance: themePayload.appearance,
      payloadBytes: themePayload.payloadBytes,
      holdMs,
      appliedCount: proof.appliedCount,
      eligibleCount: proof.eligibleCount,
      focusedType: proof.focusedType,
      typeCounts: proof.typeCounts,
      cleanupComplete: cleanup.cleanupComplete,
      removedCount: cleanup.removedCount,
      quitScheduled: cleanup.quitScheduled,
    };
  } finally {
    if (applyAttempted && !cleanup) {
      try {
        const contextId = await session.enable();
        await session.evaluate(cleanupExpression, contextId);
      } catch {}
    }
    session.close();
  }
}

function failureReason(error) {
  if (error?.name === "AbortError") return "desktop-main-inspector-timeout";
  if (typeof error?.message === "string"
      && /^[a-z][a-z0-9-]{1,63}$/.test(error.message)) return error.message;
  return "desktop-main-inspector-failed";
}

async function main() {
  try {
    const options = parseArgs(process.argv.slice(2));
    const result = options.themeId
      ? await runDesktopMainInspectorThemeProof(options)
      : await runDesktopMainInspectorProof(options);
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } catch (error) {
    process.stdout.write(`${JSON.stringify({
      schemaVersion: 1,
      status: "blocked",
      reasonCode: failureReason(error),
    })}\n`);
    process.exitCode = 1;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) await main();
