import {
  CDP_TIMEOUT_POLICY,
  parseCdpFrame,
  validatedDebuggerUrl,
} from "./validation.mjs";

const ALLOWED_METHODS = new Set([
  "Page.createIsolatedWorld",
  "Page.getFrameTree",
  "Runtime.evaluate",
]);
const MAX_EXPRESSION_BYTES = 262_144;

export class DesktopCdpSession {
  #allowedExpression;
  #closed = false;
  #commandTimeoutMs;
  #nextId = 1;
  #pending = new Map();
  #socket = null;
  #socketOpenTimeoutMs;
  #url;
  #WebSocketImpl;

  constructor(target, port, {
    WebSocketImpl = WebSocket,
    commandTimeoutMs = CDP_TIMEOUT_POLICY.commandMs,
    socketOpenTimeoutMs = CDP_TIMEOUT_POLICY.socketOpenMs,
    allowedExpression,
  } = {}) {
    if (typeof allowedExpression !== "string" || !allowedExpression
        || Buffer.byteLength(allowedExpression, "utf8") > MAX_EXPRESSION_BYTES) {
      throw new Error("desktop-cdp-expression-policy-invalid");
    }
    if (!Number.isInteger(commandTimeoutMs) || commandTimeoutMs < 1
        || commandTimeoutMs > CDP_TIMEOUT_POLICY.commandMs
        || !Number.isInteger(socketOpenTimeoutMs) || socketOpenTimeoutMs < 1
        || socketOpenTimeoutMs > CDP_TIMEOUT_POLICY.socketOpenMs) {
      throw new Error("desktop-cdp-timeout-invalid");
    }
    this.#url = validatedDebuggerUrl(target, port);
    this.#WebSocketImpl = WebSocketImpl;
    this.#commandTimeoutMs = commandTimeoutMs;
    this.#socketOpenTimeoutMs = socketOpenTimeoutMs;
    this.#allowedExpression = allowedExpression;
    Object.preventExtensions(this);
  }

  async open() {
    if (this.#socket) throw new Error("desktop-cdp-session-already-open");
    const socket = new this.#WebSocketImpl(this.#url);
    this.#socket = socket;
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        try {
          socket.close();
        } catch {}
        reject(new Error("desktop-cdp-socket-timeout"));
      }, this.#socketOpenTimeoutMs);
      socket.addEventListener("open", () => {
        clearTimeout(timeout);
        resolve();
      }, { once: true });
      socket.addEventListener("error", () => {
        clearTimeout(timeout);
        reject(new Error("desktop-cdp-socket-failed"));
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
    if (!Number.isInteger(message.id)) return;
    const waiter = this.#pending.get(message.id);
    if (!waiter) return;
    this.#pending.delete(message.id);
    clearTimeout(waiter.timeout);
    if (message.error) waiter.reject(new Error("desktop-cdp-command-failed"));
    else waiter.resolve(message.result ?? {});
  }

  #onClose() {
    if (this.#closed) return;
    this.#closed = true;
    for (const waiter of this.#pending.values()) {
      clearTimeout(waiter.timeout);
      waiter.reject(new Error("desktop-cdp-socket-closed"));
    }
    this.#pending.clear();
  }

  #send(method, params = {}) {
    if (!ALLOWED_METHODS.has(method)) {
      return Promise.reject(new Error("desktop-cdp-method-rejected"));
    }
    if (!this.#socket || this.#closed
        || this.#socket.readyState !== this.#WebSocketImpl.OPEN) {
      return Promise.reject(new Error("desktop-cdp-session-closed"));
    }
    const id = this.#nextId++;
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.#pending.delete(id);
        reject(new Error("desktop-cdp-command-timeout"));
      }, this.#commandTimeoutMs);
      this.#pending.set(id, { resolve, reject, timeout });
      try {
        this.#socket.send(JSON.stringify({ id, method, params }));
      } catch {
        clearTimeout(timeout);
        this.#pending.delete(id);
        reject(new Error("desktop-cdp-command-send-failed"));
      }
    });
  }

  async topFrameId() {
    const result = await this.#send("Page.getFrameTree");
    const frameId = result?.frameTree?.frame?.id;
    if (typeof frameId !== "string" || !/^[A-Za-z0-9._-]{1,200}$/.test(frameId)) {
      throw new Error("desktop-cdp-frame-invalid");
    }
    return frameId;
  }

  async isolatedContext(name = "claude-aura-desktop") {
    if (!/^[a-z][a-z0-9-]{1,47}$/.test(name)) {
      throw new Error("desktop-cdp-world-name-invalid");
    }
    const frameId = await this.topFrameId();
    const result = await this.#send("Page.createIsolatedWorld", {
      frameId,
      worldName: name,
      grantUniveralAccess: false,
    });
    if (!Number.isInteger(result?.executionContextId) || result.executionContextId < 1) {
      throw new Error("desktop-cdp-context-invalid");
    }
    return result.executionContextId;
  }

  async evaluate(expression, contextId) {
    if (typeof expression !== "string" || expression !== this.#allowedExpression) {
      throw new Error("desktop-cdp-expression-rejected");
    }
    if (Buffer.byteLength(expression, "utf8") > MAX_EXPRESSION_BYTES) {
      throw new Error("desktop-cdp-expression-invalid");
    }
    if (!Number.isInteger(contextId) || contextId < 1) {
      throw new Error("desktop-cdp-context-invalid");
    }
    const result = await this.#send("Runtime.evaluate", {
      expression,
      contextId,
      returnByValue: true,
      awaitPromise: true,
      userGesture: false,
    });
    if (result?.exceptionDetails || !result?.result || result.result.type === "undefined") {
      throw new Error("desktop-cdp-evaluation-failed");
    }
    return result.result.value;
  }

  close() {
    if (this.#closed) return;
    this.#closed = true;
    try {
      this.#socket?.close();
    } catch {}
    for (const waiter of this.#pending.values()) {
      clearTimeout(waiter.timeout);
      waiter.reject(new Error("desktop-cdp-socket-closed"));
    }
    this.#pending.clear();
  }
}
