import vm from "node:vm";
import { test, runIfMain } from "./support/harness.mjs";
import { PROJECT_ROOT, assert, fs, path } from "./support/context.mjs";

const SESSION = "01234567-89ab-4cde-8fab-0123456789ab";
const LAYER_ID = "layer-0123456789abcdef0123456789abcdef";
const WIDGET_ID = "prompt-0123456789abcdef0123456789abcdef";
const GREETING_GEOMETRY = Object.freeze({
  fontSize: 34,
  lineHeight: 1.15,
  maxWidthRatio: 0.72,
  xRatio: 0,
  yRatio: -0.08,
  markScale: 1,
});

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
  dispatch(type, event = {}) {
    const message = {
      preventDefault() {},
      stopPropagation() {},
      button: 0,
      pointerId: 1,
      altKey: false,
      ctrlKey: false,
      metaKey: false,
      shiftKey: false,
      currentTarget: this,
      ...event,
    };
    for (const listener of this.listeners.get(type) ?? []) listener(message);
  }
  attachShadow() {
    this.shadowRoot = new MockElement("shadow-root");
    return this.shadowRoot;
  }
  focus() { this.focused = true; }
  matches(selector) {
    return selector.split(",").some((part) => {
      const match = /^\[([^=\]]+)(?:="([^"]*)")?\]$/.exec(part.trim());
      if (!match) return false;
      return this.getAttribute(match[1]) !== null
        && (match[2] === undefined || this.getAttribute(match[1]) === match[2]);
    });
  }
  closest(selector) {
    for (let node = this; node; node = node.parentElement) {
      if (node.matches(selector)) return node;
    }
    return null;
  }
  querySelectorAll(selector) {
    return this.children.flatMap((child) => [
      ...(child.matches(selector) ? [child] : []),
      ...child.querySelectorAll(selector),
    ]);
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] ?? null; }
  getBoundingClientRect() {
    const rect = this.rect ?? { left: 0, top: 0, width: 0, height: 0 };
    return { ...rect, right: rect.left + rect.width, bottom: rect.top + rect.height };
  }
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
    querySelector: (selector) => html.querySelector(selector),
    querySelectorAll: (selector) => html.querySelectorAll(selector),
    elementFromPoint: () => null,
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

const overlayConfig = (copy) => ({
  version: 1,
  session: SESSION,
  revision: 7,
  nonce: "0123456789abcdef0123456789abcdef",
  copy,
  greeting: {
    light: { standard: { ...GREETING_GEOMETRY }, wide: { ...GREETING_GEOMETRY, xRatio: 0.08 } },
    dark: { standard: { ...GREETING_GEOMETRY, fontSize: 36 }, wide: { ...GREETING_GEOMETRY, fontSize: 38 } },
  },
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
});

test("live editor overlay validates configuration, authenticates messages, and leaves no residue", async () => {
  const source = await fs.readFile(path.join(PROJECT_ROOT, "assets", "editor-overlay.js"), "utf8");
  const harness = overlayHarness();
  const copy = Object.fromEntries([
    "title", "pick", "done", "move", "scale", "opacity", "keyboard",
    "selected", "missing", "ambiguous",
  ].map((key) => [key, key]));
  const config = overlayConfig(copy);
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
  const invalidHarness = overlayHarness();
  const invalidGreeting = vm.runInNewContext(
    source.replace("__AURA_EDITOR_OVERLAY_CONFIG__", JSON.stringify({
      ...config,
      greeting: {
        ...config.greeting,
        dark: {
          ...config.greeting.dark,
          wide: { ...config.greeting.dark.wide, fontSize: 72.01 },
        },
      },
    })),
    {
      document: invalidHarness.document,
      window: invalidHarness.window,
      requestAnimationFrame: (callback) => { callback(); return 1; },
      cancelAnimationFrame() {},
    },
  );
  assert.equal(invalidGreeting, false);
  assert.equal(invalidHarness.messages.length, 0);
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

test("live greeting handles emit one bounded real-frame commit through an overlay proxy", async () => {
  const source = await fs.readFile(path.join(PROJECT_ROOT, "assets", "editor-overlay.js"), "utf8");
  const harness = overlayHarness();
  harness.document.documentElement.setAttribute("data-claude-aura-effective-mode", "dark");
  const canvas = new MockElement("main");
  canvas.setAttribute("data-claude-aura-main-canvas", "true");
  canvas.rect = { left: 280, top: 80, width: 1120, height: 760 };
  const greeting = new MockElement("h1");
  greeting.setAttribute("data-claude-aura-greeting", "native");
  greeting.rect = { left: 560, top: 300, width: 420, height: 60 };
  canvas.appendChild(greeting);
  harness.document.body.appendChild(canvas);
  harness.document.elementFromPoint = () => greeting;
  const copy = Object.fromEntries([
    "title", "pick", "done", "move", "scale", "opacity", "keyboard",
    "selected", "missing", "ambiguous",
  ].map((key) => [key, key]));
  const config = overlayConfig(copy);
  const result = vm.runInNewContext(
    source.replace("__AURA_EDITOR_OVERLAY_CONFIG__", JSON.stringify(config)),
    {
      document: harness.document,
      window: harness.window,
      requestAnimationFrame: (callback) => { callback(); return 1; },
      cancelAnimationFrame() {},
    },
  );
  assert.equal(result, true);
  const root = harness.document.getElementById("claude-aura-editor-overlay");
  const [, pickCover, ring, bar] = root.shadowRoot.children;
  const pickButton = bar.children[1];
  pickButton.dispatch("click");
  pickCover.dispatch("pointerdown", { clientX: 680, clientY: 330 });
  const selection = harness.messages.at(-1);
  assert.equal(selection.event, "selection");
  assert.equal(selection.payload.targetId, "interface.greeting");
  assert.equal(selection.payload.itemId, "interface.greeting");
  assert.equal(selection.payload.geometry.appearance, "dark");
  assert.equal(selection.payload.geometry.frame, "wide");
  assert.equal(selection.payload.geometry.fontSize, 38);
  assert.equal(ring.children[2].hidden, true, "Greeting exposed an opacity control");

  const moveHandle = ring.children[0];
  moveHandle.dispatch("keydown", { key: "ArrowRight" });
  const move = harness.messages.at(-1);
  assert.equal(move.event, "commit");
  assert(move.payload.geometry.xRatio > selection.payload.geometry.xRatio);
  assert.equal(move.payload.geometry.fontSize, 38);
  assert.equal(greeting.style.getPropertyValue("--aura-greeting-x"), "",
    "The overlay edited the marked native heading instead of its proxy");

  const scaleHandle = ring.children[1];
  scaleHandle.dispatch("keydown", { key: "ArrowUp", altKey: true });
  const resize = harness.messages.at(-1);
  assert.equal(resize.event, "commit");
  assert(resize.payload.geometry.fontSize > move.payload.geometry.fontSize);
  assert(resize.payload.geometry.lineHeight > move.payload.geometry.lineHeight);
  assert(resize.payload.geometry.maxWidthRatio > move.payload.geometry.maxWidthRatio);
  assert(resize.payload.geometry.markScale > move.payload.geometry.markScale);
  harness.window.__CLAUDE_AURA_EDITOR_OVERLAY__.stop("done", false);
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

  const greetingSelection = {
    status: "found",
    kind: "interface",
    targetId: "interface.greeting",
    itemId: "interface.greeting",
    tokenIds: ["text", "accent"],
    rect: { left: 420, top: 260, width: 440, height: 58 },
    viewport: { width: 1560, height: 940, frame: "wide" },
    geometry: {
      appearance: "dark",
      frame: "wide",
      ...GREETING_GEOMETRY,
      fontSize: 38,
    },
  };
  const greetingMessage = { ...message, selection: greetingSelection };
  assert.equal(
    api.normalizeOverlayMessage(greetingMessage).selection.geometry.appearance,
    "dark",
  );
  assert.equal(api.normalizeOverlayMessage({
    ...greetingMessage,
    selection: {
      ...greetingSelection,
      geometry: { ...greetingSelection.geometry, fontSize: 72.01 },
    },
  }), null);
  assert.equal(api.normalizeOverlayMessage({
    ...greetingMessage,
    selection: { ...greetingSelection, targetId: "interface.theme" },
  }), null);
});

test("host and Studio expose one bounded live-window edit protocol with teardown hooks", async () => {
  const [html, app, editor, host, renderer, overlay] = await Promise.all([
    "studio/index.html", "studio/app.js", "studio/editor.js",
    "windows/aura-ui.ps1", "assets/renderer-inject.js", "assets/editor-overlay.js",
  ].map((file) => fs.readFile(path.join(PROJECT_ROOT, file), "utf8")));
  assert.match(html, /id="stage-window-edit"/);
  assert.match(html, /id="window-editor-inspector"/);
  assert.match(app, /"start-window-edit", "stop-window-edit"/);
  assert.match(app, /aura-editor-overlay-state[\s\S]*receiveOverlayState/);
  assert.match(editor, /normalized\.session !== state\?\.session[\s\S]*normalized\.revision !== state\?\.revision/);
  assert.match(editor, /queueThemeChanges\(changes, \{ immediate: true \}\)/);
  assert.match(editor, /field: "layout", locale: null, value: layout/);
  assert.match(editor, /selection\.targetId === "interface\.greeting"[\s\S]*queueGreetingFrame\(next/,
    "Studio must route one complete live greeting frame through its existing Undo path");
  assert.match(editor, /fontSize:\s*geometry\.fontSize[\s\S]*markScale:\s*geometry\.markScale/,
    "live greeting resize must use real bounded typography and mark fields");
  assert.match(host, /Invoke-AuraUiEditorOverlayMessage[\s\S]*WebMessageAsJson[\s\S]*eventArgs\.Source/);
  assert.match(host, /EditorOverlayNonce[\s\S]*EditorOverlayLastSequence/);
  assert.match(host, /Assert-AuraUiEditorOverlayGreetingGeometry[\s\S]*interface\.greeting/);
  assert.match(host, /data-claude-aura-editor-overlay[\s\S]*s\?\.root!==r/,
    "host cleanup must fail closed on a foreign overlay ID collision");
  for (const reason of ["navigation", "disabled", "studio-closed", "host"]) {
    assert.match(host, new RegExp(`Stop-AuraUiEditorOverlay -Reason ${reason}`));
  }
  assert.match(renderer, /element\.id = layer\.i/);
  assert.match(renderer, /data-claude-aura-greeting/,
    "the overlay target must be backed by the renderer's bounded greeting ownership marker");
  assert.match(overlay, /GREETING_TARGET = "interface\.greeting"[\s\S]*greetingOwner/);
  assert.match(overlay, /selectedProxyRect[\s\S]*geometry\.fontSize \/ base\.fontSize/,
    "native greeting manipulation must remain an overlay-owned proxy");
  assert.match(overlay, /next\.fontSize = clamp[\s\S]*next\.lineHeight = clamp[\s\S]*next\.maxWidthRatio = clamp[\s\S]*next\.markScale = clamp/,
    "pointer resize must change real greeting metrics instead of transform scale");
});

runIfMain(import.meta.url);
