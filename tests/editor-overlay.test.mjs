import vm from "node:vm";
import { test, runIfMain } from "./support/harness.mjs";
import { PROJECT_ROOT, assert, fs, path } from "./support/context.mjs";

const SESSION = "01234567-89ab-4cde-8fab-0123456789ab";
const LAYER_ID = "layer-0123456789abcdef0123456789abcdef";
const WIDGET_ID = "prompt-0123456789abcdef0123456789abcdef";

class MockStyle {
  #values = new Map();
  setProperty(name, value) { this.#values.set(name, String(value)); }
  getPropertyValue(name) { return this.#values.get(name) ?? ""; }
  removeProperty(name) { this.#values.delete(name); }
}

class MockElement {
  constructor(tagName) {
    this.tagName = tagName.toUpperCase();
    this.parentElement = null;
    this.children = [];
    this.attributes = new Map();
    this.listeners = new Map();
    this.style = new MockStyle();
    this.hidden = false;
    this.textContent = "";
    this.id = "";
  }
  get isConnected() { return this.tagName === "HTML" || Boolean(this.parentElement?.isConnected); }
  append(...nodes) { for (const node of nodes) this.appendChild(node); }
  appendChild(node) { node.remove(); node.parentElement = this; this.children.push(node); return node; }
  replaceChildren(...nodes) {
    for (const child of this.children) child.parentElement = null;
    this.children = [];
    this.append(...nodes);
  }
  remove() {
    if (!this.parentElement) return;
    this.parentElement.children = this.parentElement.children.filter((node) => node !== this);
    this.parentElement = null;
  }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  addEventListener(type, listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(listener);
  }
  removeEventListener(type, listener) { this.listeners.get(type)?.delete(listener); }
  attachShadow() { return new MockElement("shadow-root"); }
  focus() { this.focused = true; }
  querySelector() { return null; }
}

const findById = (node, id) => {
  if (node.id === id) return node;
  for (const child of node.children) {
    const found = findById(child, id);
    if (found) return found;
  }
  return null;
};

const overlayHarness = () => {
  const html = new MockElement("html");
  const body = new MockElement("body");
  html.appendChild(body);
  const document = {
    documentElement: html,
    body,
    createElement: (tag) => new MockElement(tag),
    getElementById: (id) => findById(html, id),
    querySelector: () => null,
  };
  const messages = [];
  const listeners = new Map();
  const window = {
    innerWidth: 1560,
    innerHeight: 940,
    chrome: { webview: { postMessage: (message) => messages.push(message) } },
    addEventListener(type, listener) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(listener);
    },
    removeEventListener(type, listener) { listeners.get(type)?.delete(listener); },
  };
  return { document, window, messages, listeners };
};

test("live editor overlay validates configuration, authenticates messages, and leaves no residue", async () => {
  const source = await fs.readFile(path.join(PROJECT_ROOT, "assets", "editor-overlay.js"), "utf8");
  const harness = overlayHarness();
  const copy = Object.fromEntries([
    "title", "pick", "done", "move", "scale", "opacity", "keyboard",
    "selected", "missing", "ambiguous",
  ].map((key) => [key, key]));
  const config = {
    version: 1,
    session: SESSION,
    revision: 7,
    nonce: "0123456789abcdef0123456789abcdef",
    copy,
    layers: [{
      id: LAYER_ID,
      opacity: 0.8,
      frames: {
        normal: { positionX: 90, positionY: -80, scale: 2.5 },
        wide: { positionX: 0, positionY: 0, scale: 1 },
      },
    }],
    widgets: [{
      id: WIDGET_ID,
      opacity: 1,
      frames: {
        normal: { positionX: 0, positionY: 0, scale: 1 },
        wide: { positionX: 12, positionY: 8, scale: 1.25 },
      },
    }],
  };
  const compiled = source.replace("__AURA_EDITOR_OVERLAY_CONFIG__", JSON.stringify(config));
  const result = vm.runInNewContext(compiled, {
    document: harness.document,
    window: harness.window,
    requestAnimationFrame: (callback) => { callback(); return 1; },
    cancelAnimationFrame() {},
  });
  assert.equal(result, true);
  assert.equal(harness.messages.length, 1);
  assert.deepEqual(
    JSON.parse(JSON.stringify(harness.messages[0])),
    {
      type: "aura-editor-overlay",
      version: 1,
      session: SESSION,
      revision: 7,
      nonce: config.nonce,
      sequence: 1,
      event: "ready",
      payload: { viewport: { width: 1560, height: 940, frame: "wide" } },
    },
  );
  assert(harness.document.getElementById("claude-aura-editor-overlay"));
  assert.equal(Object.hasOwn(harness.window.__CLAUDE_AURA_EDITOR_OVERLAY__, "nonce"), false,
    "the page-visible teardown handle exposed the host nonce");
  harness.window.__CLAUDE_AURA_EDITOR_OVERLAY__.stop("done");
  assert.equal(harness.messages.at(-1).event, "stop");
  assert.equal(harness.messages.at(-1).sequence, 2);
  assert.equal(harness.document.getElementById("claude-aura-editor-overlay"), null);
  assert.equal(harness.window.__CLAUDE_AURA_EDITOR_OVERLAY__, undefined);
  assert.equal([...harness.listeners.values()].reduce((count, group) => count + group.size, 0), 0);
  const foreign = new MockElement("div");
  foreign.id = "claude-aura-editor-overlay";
  harness.document.body.appendChild(foreign);
  const collision = vm.runInNewContext(compiled, {
    document: harness.document,
    window: harness.window,
    requestAnimationFrame: (callback) => { callback(); return 1; },
    cancelAnimationFrame() {},
  });
  assert.equal(collision, false);
  assert.equal(harness.document.getElementById("claude-aura-editor-overlay"), foreign,
    "overlay startup removed a foreign ID collision");
  assert.equal(harness.messages.length, 2);
});

test("Studio rejects malformed overlay state and geometry before routing it", async () => {
  const editorSource = await fs.readFile(path.join(PROJECT_ROOT, "studio", "editor.js"), "utf8");
  const sandbox = { window: { CLAUDE_AURA_STRINGS: {} } };
  vm.runInNewContext(editorSource, sandbox, { filename: "studio/editor.js" });
  const api = sandbox.window.CLAUDE_AURA_EDITOR;
  const active = {
    type: "aura-editor-overlay-state",
    version: 1,
    active: true,
    pending: false,
    session: SESSION,
    revision: 7,
    error: null,
  };
  assert.equal(api.normalizeOverlayState(active).revision, 7);
  assert.equal(api.normalizeOverlayState({ ...active, extra: true }), null);
  assert.equal(api.normalizeOverlayState({ ...active, session: null }), null);

  const selection = {
    status: "found",
    kind: "widget",
    targetId: "widgets.instant-prompts",
    itemId: WIDGET_ID,
    tokenIds: ["surface", "text", "border", "accent"],
    rect: { left: 12, top: 18, width: 220, height: 44 },
    viewport: { width: 1560, height: 940, frame: "wide" },
    geometry: { opacity: 0.72, frame: "wide", positionX: 12, positionY: 8, scale: 1.25 },
  };
  const message = {
    type: "aura-editor-overlay",
    version: 1,
    session: SESSION,
    revision: 7,
    event: "commit",
    selection,
  };
  assert.equal(api.normalizeOverlayMessage(message).selection.itemId, WIDGET_ID);
  assert.equal(api.normalizeOverlayMessage({
    ...message,
    selection: { ...selection, geometry: { ...selection.geometry, scale: 1.76 } },
  }), null);
  assert.equal(api.normalizeOverlayMessage({
    ...message,
    event: "selection",
    selection: {
      ...selection,
      status: "missing",
      kind: "background",
      targetId: "interface.theme",
      itemId: null,
      rect: null,
      geometry: null,
    },
  }), null);
  assert.equal(api.normalizeOverlayMessage({ ...message, event: "preview", extra: true }), null);
});

test("host and Studio expose one bounded live-window edit protocol with teardown hooks", async () => {
  const [html, app, editor, host, renderer] = await Promise.all([
    "studio/index.html", "studio/app.js", "studio/editor.js",
    "windows/aura-ui.ps1", "assets/renderer-inject.js",
  ].map((file) => fs.readFile(path.join(PROJECT_ROOT, file), "utf8")));
  assert.match(html, /id="stage-window-edit"/);
  assert.match(html, /id="window-editor-inspector"/);
  assert.match(app, /"start-window-edit", "stop-window-edit"/);
  assert.match(app, /aura-editor-overlay-state[\s\S]*receiveOverlayState/);
  assert.match(editor, /normalized\.session !== state\?\.session[\s\S]*normalized\.revision !== state\?\.revision/);
  assert.match(editor, /queueThemeChanges\(changes, \{ immediate: true \}\)/);
  assert.match(editor, /field: "layout", locale: null, value: layout/);
  assert.match(host, /Invoke-AuraUiEditorOverlayMessage[\s\S]*WebMessageAsJson[\s\S]*eventArgs\.Source/);
  assert.match(host, /EditorOverlayNonce[\s\S]*EditorOverlayLastSequence/);
  assert.match(host, /data-claude-aura-editor-overlay[\s\S]*s\?\.root!==r/,
    "host cleanup must fail closed on a foreign overlay ID collision");
  for (const reason of ["navigation", "disabled", "studio-closed", "host"]) {
    assert.match(host, new RegExp(`Stop-AuraUiEditorOverlay -Reason ${reason}`));
  }
  assert.match(renderer, /element\.id = layer\.i/);
});

runIfMain(import.meta.url);
