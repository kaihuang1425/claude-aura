import { test, runIfMain } from "./support/harness.mjs";
import assert from "node:assert/strict";
import {
  CODE_ROLE_SIGNATURES,
  codeContextFromUrl,
  createCodeAdapter,
} from "../scripts/theme-core/code-adapter.mjs";

const ROOT = "data-claude-aura-code-root";
const ROLE = "data-claude-aura-code-role";

class Element {
  constructor(tag) {
    this.tagName = tag.toUpperCase();
    this.nodeName = this.tagName;
    this.attributes = new Map();
    this.children = [];
    this.parentElement = null;
    this.style = { setProperty() {}, removeProperty() {} };
    this.textContent = "";
  }
  get isConnected() {
    return this.tagName === "HTML" || Boolean(this.parentElement?.isConnected);
  }
  appendChild(child) {
    child.remove();
    this.children.push(child);
    child.parentElement = this;
    return child;
  }
  remove() {
    if (!this.parentElement) return;
    this.parentElement.children = this.parentElement.children.filter((item) => item !== this);
    this.parentElement = null;
  }
  contains(node) {
    return node === this || this.children.some((child) => child.contains(node));
  }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  hasAttribute(name) { return this.attributes.has(name); }
  removeAttribute(name) { this.attributes.delete(name); }
  getAttributeNames() { return [...this.attributes.keys()]; }
  get id() { return this.getAttribute("id") ?? ""; }
  set id(value) { this.setAttribute("id", value); }
  getBoundingClientRect() {
    return { left: 0, top: 0, right: 800, bottom: 600, width: 800, height: 600 };
  }
  matches(selector) {
    if (selector === "*") return true;
    if (/^[a-z]+$/i.test(selector)) return this.tagName === selector.toUpperCase();
    const match = selector.match(/^\[([^=]+)="([^"]+)"\]$/);
    return Boolean(match && this.getAttribute(match[1]) === match[2]);
  }
  querySelectorAll(selector) {
    return this.children.flatMap((child) => [
      ...(child.matches(selector) ? [child] : []),
      ...child.querySelectorAll(selector),
    ]);
  }
}

class Document {
  constructor() {
    this.documentElement = new Element("html");
    this.head = this.documentElement.appendChild(new Element("head"));
    this.body = this.documentElement.appendChild(new Element("body"));
  }
  createElement(tag) { return new Element(tag); }
  querySelectorAll(selector) { return this.documentElement.querySelectorAll(selector); }
  getElementById(id) {
    return this.querySelectorAll("*").find((element) => element.id === id) ?? null;
  }
}

class Observer {
  constructor(callback) {
    this.callback = callback;
    Observer.latest = this;
  }
  observe() {}
  disconnect() {}
}

const SIGNATURES = {
  version: 1,
  signatures: [{
    id: "fixture-v1",
    context: "code-session",
    rootProbes: [{ kind: "semantic", selector: "main" }],
    roles: [
      {
        name: "navigation", group: "navigation", required: true,
        probes: [{ kind: "semantic", selector: "nav" }], css: "color:#111",
      },
      {
        name: "transcript", group: "transcript", required: true,
        probes: [{ kind: "data", selector: '[data-role="transcript"]' }], css: "color:#222",
      },
      {
        name: "composer", group: "composer", required: true,
        probes: [{ kind: "semantic", selector: "form" }], css: "color:#333",
      },
      {
        name: "permission", group: "safety", required: false, safetySensitive: true,
        probes: [{ kind: "aria", selector: '[role="dialog"]' }], css: "color:#444",
      },
    ],
  }],
};

function fixture({ dialogs = 1 } = {}) {
  const document = new Document();
  const main = document.body.appendChild(new Element("main"));
  const nav = main.appendChild(new Element("nav"));
  const transcript = main.appendChild(new Element("section"));
  transcript.setAttribute("data-role", "transcript");
  const composer = main.appendChild(new Element("form"));
  const dialogNodes = [];
  for (let index = 0; index < dialogs; index += 1) {
    const dialog = main.appendChild(new Element("section"));
    dialog.setAttribute("role", "dialog");
    dialogNodes.push(dialog);
  }
  return { document, main, nav, transcript, composer, dialogNodes };
}

function runtime(options = {}) {
  const dom = fixture(options);
  const frames = [];
  let navigation = "nav-1";
  let context = "code-session";
  const adapter = createCodeAdapter({
    document: dom.document,
    requestAnimationFrame: (callback) => (frames.push(callback), callback),
    cancelAnimationFrame: (callback) => {
      const index = frames.indexOf(callback);
      if (index >= 0) frames.splice(index, 1);
    },
    now: () => 10,
    getNavigationKey: () => navigation,
    getContext: () => context,
    getComputedStyle: () => ({ display: "block", visibility: "visible" }),
    MutationObserver: Observer,
  }, SIGNATURES);
  return {
    ...dom,
    adapter,
    setNavigation: (value) => { navigation = value; },
    setContext: (value) => { context = value; },
    flush: () => frames.splice(0).forEach((callback) => callback(10)),
  };
}

const markerState = (view) => [
  view.main.getAttribute(ROOT),
  view.nav.getAttribute(ROLE),
  view.transcript.getAttribute(ROLE),
  view.composer.getAttribute(ROLE),
  ...view.dialogNodes.map((node) => node.getAttribute(ROLE)),
];

test("code contexts register and an empty descriptor stays native", async () => {
  const view = runtime();
  const before = markerState(view);
  const adapter = createCodeAdapter({ document: view.document }, CODE_ROLE_SIGNATURES);
  assert.equal(codeContextFromUrl("https://claude.ai/code"), "code-list");
  assert.equal(codeContextFromUrl("https://claude.ai/code/session-1"), "code-session");
  assert.equal((await adapter.activate("code-session")).reason, "signature-unregistered");
  assert.deepEqual(markerState(view), before);
});

test("a fixture signature commits one scoped style and every marker together", async () => {
  const view = runtime();
  const pending = view.adapter.activate();
  view.flush();
  assert.equal((await pending).status, "styled");
  assert.equal(view.document.querySelectorAll("style").length, 1);
  assert.deepEqual(markerState(view), [
    "fixture-v1", "navigation", "transcript", "composer", "permission",
  ]);
});

test("an ambiguous safety role rolls back the whole transaction", async () => {
  const view = runtime();
  const pending = view.adapter.activate();
  view.flush();
  await pending;
  const duplicate = view.main.appendChild(new Element("section"));
  duplicate.setAttribute("role", "dialog");
  view.dialogNodes.push(duplicate);
  Observer.latest.callback([{ target: duplicate }]);
  view.flush();
  assert.equal(view.adapter.getState().status, "native");
  assert.deepEqual(markerState(view), [null, null, null, null, null, null]);
});

test("a route change before promotion aborts without partial state", async () => {
  const view = runtime();
  const pending = view.adapter.activate();
  view.setNavigation("nav-2");
  view.adapter.rollback("route-changed");
  view.flush();
  assert.deepEqual(await pending, {
    status: "native", reason: "route-changed", signature: "fixture-v1",
  });
  assert.deepEqual(markerState(view), [null, null, null, null, null]);
});

test("rollback restores prior markers and is idempotent", async () => {
  const view = runtime();
  view.composer.setAttribute(ROLE, "native-owner");
  const pending = view.adapter.activate();
  view.flush();
  await pending;
  view.adapter.rollback();
  view.adapter.rollback();
  assert.equal(view.composer.getAttribute(ROLE), "native-owner");
  assert.equal(view.document.querySelectorAll("style").length, 0);
});

test("the Code adapter never creates chat-only decoration", async () => {
  const view = runtime();
  const pending = view.adapter.activate();
  view.flush();
  await pending;
  const forbidden = view.document.querySelectorAll("*").filter((element) =>
    [...element.attributes.keys()].some((name) =>
      /art|greeting|prompt|wallpaper/i.test(name))
    || /backdrop|greeting|prompt|wallpaper/i.test(element.id));
  assert.deepEqual(forbidden, []);
});

runIfMain(import.meta.url);
