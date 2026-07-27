import { test, runIfMain } from "./support/harness.mjs";
import {
  assert,
  buildPayloadFromCompiled,
  greetingPhraseDigest,
} from "./support/context.mjs";

const G = "data-claude-aura-greeting";
const H = "data-claude-aura-greeting-native";
const T = "data-claude-aura-greeting-text";
const K = "data-claude-aura-greeting-mark";
const RUNTIME_CSS = `[${G}]{--aura-greeting-x:.1;--aura-greeting-y:.05;--aura-greeting-max-ratio:.7}`;

class Style {
  values = new Map();
  priorities = new Map();

  get cssText() {
    return [...this.values].map(([name, value]) => `${name}:${value}${
      this.priorities.get(name) ? " !important" : ""
    }`).join(";");
  }

  set cssText(value) {
    this.values.clear();
    this.priorities.clear();
    for (const declaration of String(value).split(";")) {
      const [name, ...raw] = declaration.split(":");
      if (!name || !raw.length) continue;
      const joined = raw.join(":").trim();
      const important = /\s*!important$/i.test(joined);
      this.setProperty(name.trim(), joined.replace(/\s*!important$/i, ""), important ? "important" : "");
    }
  }

  setProperty(name, value, priority = "") {
    this.values.set(name, String(value));
    this.priorities.set(name, String(priority));
  }

  getPropertyValue(name) {
    return this.values.get(name) ?? "";
  }

  getPropertyPriority(name) {
    return this.priorities.get(name) ?? "";
  }

  removeProperty(name) {
    this.values.delete(name);
    this.priorities.delete(name);
  }
}

class Classes {
  values = new Set();
  add(...names) { names.forEach((name) => this.values.add(name)); }
  remove(...names) { names.forEach((name) => this.values.delete(name)); }
  contains(name) { return this.values.has(name); }
  toggle(name, force = !this.values.has(name)) {
    if (force) this.values.add(name);
    else this.values.delete(name);
    return force;
  }
}

class Element {
  constructor(tag, rect = { left: 0, top: 0, right: 20, bottom: 20, width: 20, height: 20 }) {
    this.tagName = tag.toUpperCase();
    this.nodeName = this.tagName;
    this.rect = rect;
    this.style = new Style();
    this.classList = new Classes();
    this.dataset = {};
    this.children = [];
    this.parentElement = null;
    this.parentNode = null;
    this.textContent = "";
    this.id = "";
    this.fontSize = 16;
  }

  get isConnected() {
    return this.tagName === "HTML" || Boolean(this.parentElement?.isConnected);
  }

  appendChild(child) {
    child.remove();
    this.children.push(child);
    child.parentElement = child.parentNode = this;
    return child;
  }

  prepend(child) {
    child.remove();
    this.children.unshift(child);
    child.parentElement = child.parentNode = this;
    return child;
  }

  insertBefore(child, before) {
    child.remove();
    const index = before ? this.children.indexOf(before) : -1;
    if (index < 0) this.children.push(child);
    else this.children.splice(index, 0, child);
    child.parentElement = child.parentNode = this;
    return child;
  }

  remove() {
    if (!this.parentElement) return;
    this.parentElement.children = this.parentElement.children.filter((child) => child !== this);
    this.parentElement = this.parentNode = null;
  }

  contains(node) {
    return node === this || this.children.some((child) => child.contains(node));
  }

  setAttribute(name, value) {
    this[name] = String(value);
  }

  getAttribute(name) {
    return Object.hasOwn(this, name) ? this[name] : null;
  }

  hasAttribute(name) {
    return Object.hasOwn(this, name);
  }

  removeAttribute(name) {
    delete this[name];
  }

  getBoundingClientRect() {
    for (let node = this.parentElement; node; node = node.parentElement) {
      if (node.style.getPropertyValue("display") === "none") {
        return { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 };
      }
    }
    let rect = this.rect;
    const fixed = this.style.getPropertyValue("position") === "fixed";
    if (this.getAttribute(G) === "new-chat") {
      rect = { left: 560, top: 300, right: 880, bottom: 350, width: 320, height: 50 };
    } else if (this.getAttribute(G) === "decoration") {
      const left = Number.parseFloat(this.style.getPropertyValue("left")) || 0;
      const top = Number.parseFloat(this.style.getPropertyValue("top")) || 0;
      const width = Number.parseFloat(this.style.getPropertyValue("width")) || 24;
      const height = Number.parseFloat(this.style.getPropertyValue("height")) || 24;
      rect = { left, top, right: left + width, bottom: top + height, width, height };
    } else if (this.getAttribute(K) === "compact"
        && this.parentElement?.getAttribute(G) === "decoration") {
      rect = this.parentElement.getBoundingClientRect();
    } else if (fixed) {
      const left = Number.parseFloat(this.style.getPropertyValue("left")) || 0;
      const top = Number.parseFloat(this.style.getPropertyValue("top")) || 0;
      const width = Number.parseFloat(this.style.getPropertyValue("width")) || this.rect.width;
      const height = Number.parseFloat(this.style.getPropertyValue("height")) || this.rect.height;
      rect = { left, top, right: left + width, bottom: top + height, width, height };
    }
    let dx = 0;
    let dy = 0;
    for (let node = this; node; node = fixed ? null : node.parentElement) {
      const [x = "0", y = "0"] = node.style.getPropertyValue("translate").split(/\s+/);
      dx += Number.parseFloat(x) || 0;
      dy += Number.parseFloat(y) || 0;
    }
    return {
      ...rect,
      left: rect.left + dx,
      right: rect.right + dx,
      top: rect.top + dy,
      bottom: rect.bottom + dy,
    };
  }

  matches(selector) {
    return selector.split(",").some((part) => {
      const value = part.trim();
      if (value === "*") return true;
      if (value === "main") return this.tagName === "MAIN";
      if (value === "nav") return this.tagName === "NAV";
      if (value === "form") return this.tagName === "FORM";
      if (value === "button") return this.tagName === "BUTTON";
      if (value === "select") return this.tagName === "SELECT";
      if (value === "textarea:not([readonly])") {
        return this.tagName === "TEXTAREA" && !this.hasAttribute("readonly");
      }
      if (value === ".ProseMirror[contenteditable=\"true\"]") {
        return this.classList.contains("ProseMirror") && this.contenteditable === "true";
      }
      if (value === "[role=\"textbox\"][contenteditable=\"true\"]") {
        return this.role === "textbox" && this.contenteditable === "true";
      }
      const tagAttribute = value.match(/^([a-z0-9-]+)?\[([^=\]]+)(?:="([^"]*)")?\]$/i);
      if (tagAttribute) {
        const [, tag, name, expected] = tagAttribute;
        return (!tag || this.tagName === tag.toUpperCase())
          && this.hasAttribute(name)
          && (expected === undefined || this.getAttribute(name) === expected);
      }
      return this.tagName === value.toUpperCase();
    });
  }

  closest(selector) {
    for (let node = this; node; node = node.parentElement) {
      if (node.matches(selector)) return node;
    }
    return null;
  }

  querySelector(selector) {
    return this.querySelectorAll(selector)[0] ?? null;
  }

  querySelectorAll(selector) {
    return this.children.flatMap((child) => [
      ...(child.matches(selector) ? [child] : []),
      ...child.querySelectorAll(selector),
    ]);
  }
}

function makeGreetingBranch(top = 280) {
  const outer = new Element("div", {
    left: 430, top, right: 1010, bottom: top + 70, width: 580, height: 70,
  });
  const row = new Element("div", {
    left: 550, top: top + 10, right: 890, bottom: top + 60, width: 340, height: 50,
  });
  row.fontSize = 32;
  const mark = new Element("div", {
    left: 550, top: top + 20, right: 578, bottom: top + 48, width: 28, height: 28,
  });
  const text = new Element("span", {
    left: 590, top: top + 10, right: 890, bottom: top + 60, width: 300, height: 50,
  });
  text.fontSize = 32;
  text.textContent = "native words are never inspected by Aura";
  row.appendChild(mark);
  row.appendChild(text);
  outer.appendChild(row);
  return { outer, row, mark, text };
}

async function makePayload({ digest, phrases, mark = false, styled = true, shuffle = null }) {
  const phraseDigest = Array.isArray(phrases) && phrases.length
    ? greetingPhraseDigest(phrases)
    : null;
  const compiled = {
    css: RUNTIME_CSS,
    settings: {
      version: "test",
      theme: "default",
      appearance: "light",
      digest,
      imageDataUrl: null,
      imageOpacity: null,
      imageZoom: 1,
      artDataUrl: null,
      artLayers: [],
      backgroundScope: "full-window",
      newChatLayout: null,
      reduceMotion: false,
      greeting: { style: styled ? {} : null, phrases, phraseDigest, shuffle },
    },
  };
  const bundle = await buildPayloadFromCompiled(compiled, { enforceBudget: false });
  if (!mark) return bundle.payload;
  return bundle.payload.replace(
    /("g":\{[^{}]*)(\})/,
    `$1,"m":"data:image/svg+xml;base64,PHN2Zy8+"$2`,
  );
}

async function runtime(options = {}) {
  const {
    count = 1,
    phrases = ["First phrase", "Second phrase"],
    mark = false,
    styled = true,
    digest = "greeting-runtime-a",
    nativeStyle = null,
    nativeMarkStyle = null,
    headingTag = null,
    semanticLevel = null,
    semanticSiblingMark = false,
    parallelNativeMarks = false,
    parallelNativeMarkCount = parallelNativeMarks ? 1 : 0,
    controlDecoys = false,
    greetingX = 0.1,
    greetingY = 0.05,
    greetingMax = 0.7,
    greetingMarkScale = 1,
    shuffle = null,
  } = options;
  const html = new Element("html");
  const head = new Element("head");
  const body = new Element("body");
  html.appendChild(head);
  html.appendChild(body);
  const main = new Element("main", {
    left: 250, top: 0, right: 1440, bottom: 900, width: 1190, height: 900,
  });
  body.appendChild(main);
  const greetings = Array.from({ length: count }, (_, index) => makeGreetingBranch(260 + index * 4));
  if (semanticSiblingMark) for (const { text } of greetings) {
    text.tagName = text.nodeName = "H1";
  }
  if (parallelNativeMarkCount) for (const greeting of greetings) {
    greeting.parallelMarks = Array.from({ length: parallelNativeMarkCount }, () => {
      const parallelMark = new Element("span", {
        left: 704, top: greeting.text.rect.top + 11, right: 732,
        bottom: greeting.text.rect.top + 39, width: 28, height: 28,
      });
      parallelMark.appendChild(new Element("svg", {
        left: 706, top: greeting.text.rect.top + 13, right: 730,
        bottom: greeting.text.rect.top + 37, width: 24, height: 24,
      }));
      greeting.text.appendChild(parallelMark);
      return parallelMark;
    });
    [greeting.parallelMark] = greeting.parallelMarks;
  }
  for (const { row } of greetings) {
    if (headingTag) row.tagName = row.nodeName = headingTag.toUpperCase();
    if (semanticLevel) {
      row.setAttribute("role", "heading");
      row.setAttribute("aria-level", String(semanticLevel));
    }
  }
  if (nativeStyle) for (const { row } of greetings) {
    if (nativeStyle.ariaHidden !== undefined) row.setAttribute("aria-hidden", nativeStyle.ariaHidden);
    for (const [property, value, priority = ""] of nativeStyle.properties ?? []) {
      row.style.setProperty(property, value, priority);
    }
  }
  if (nativeMarkStyle) for (const { mark } of greetings) {
    for (const [property, value, priority = ""] of nativeMarkStyle.properties ?? []) {
      mark.style.setProperty(property, value, priority);
    }
  }
  greetings.forEach(({ outer }) => main.appendChild(outer));
  const decoys = [];
  if (controlDecoys) {
    const definitions = [
      ["button", null, null],
    ];
    definitions.forEach(([tag, attribute, value], index) => {
      const wrapper = new Element(tag, {
        left: 520, top: 300 + index, right: 920, bottom: 370 + index, width: 400, height: 70,
      });
      if (attribute) wrapper.setAttribute(attribute, value);
      if (value === "textbox") wrapper.setAttribute("contenteditable", "true");
      const heading = new Element("h2", {
        left: 560, top: 310 + index, right: 880, bottom: 360 + index, width: 320, height: 50,
      });
      heading.fontSize = 34;
      wrapper.appendChild(heading);
      main.appendChild(wrapper);
      decoys.push({ wrapper, heading });
    });
  }
  const group = new Element("section", {
    left: 430, top: 400, right: 1030, bottom: 620, width: 600, height: 220,
  });
  const shell = new Element("section", {
    left: 430, top: 430, right: 1030, bottom: 570, width: 600, height: 140,
  });
  const editor = new Element("textarea", {
    left: 450, top: 450, right: 1010, bottom: 500, width: 560, height: 50,
  });
  shell.appendChild(editor);
  shell.appendChild(new Element("button", {
    left: 450, top: 520, right: 474, bottom: 544, width: 24, height: 24,
  }));
  group.appendChild(shell);
  main.appendChild(group);
  const walk = (node) => [node, ...node.children.flatMap(walk)];
  const documentListeners = new Map();
  const document = {
    documentElement: html,
    head,
    body,
    fullscreenElement: null,
    createElement: (tag) => new Element(tag),
    querySelector: (selector) => walk(html).find((node) => node.matches(selector)) ?? null,
    querySelectorAll: (selector) => walk(html).filter((node) => node.matches(selector)),
    getElementById: (id) => walk(html).find((node) => node.id === id) ?? null,
    addEventListener(type, listener) {
      const listeners = documentListeners.get(type) ?? new Set();
      listeners.add(listener);
      documentListeners.set(type, listeners);
    },
    removeEventListener(type, listener) { documentListeners.get(type)?.delete(listener); },
  };
  const mediaListeners = new Set();
  let forced = false;
  const forcedQuery = {
    get matches() { return forced; },
    addEventListener(type, listener) { if (type === "change") mediaListeners.add(listener); },
    removeEventListener(type, listener) { if (type === "change") mediaListeners.delete(listener); },
  };
  const normalQuery = { matches: false, addEventListener() {}, removeEventListener() {} };
  const listeners = new Map();
  const navigationListeners = new Set();
  const resizeObservers = new Set();
  class ResizeObserver {
    constructor(callback) {
      this.callback = callback;
      this.targets = new Set();
      resizeObservers.add(this);
    }
    observe(target) { this.targets.add(target); }
    disconnect() { this.targets.clear(); }
  }
  const navigation = {
    currentEntry: { key: "visit-1" },
    addEventListener(type, listener) { if (type === "currententrychange") navigationListeners.add(listener); },
    removeEventListener(type, listener) { if (type === "currententrychange") navigationListeners.delete(listener); },
  };
  const frames = [];
  const window = {
    innerWidth: 1440,
    innerHeight: 900,
    screen: { availWidth: 1440, availHeight: 900 },
    navigation,
    ResizeObserver,
    matchMedia: (query) => query === "(forced-colors: active)" ? forcedQuery : normalQuery,
    requestAnimationFrame(callback) { frames.push(callback); return frames.length; },
    getComputedStyle(element) {
      const inheritedFont = (() => {
        for (let node = element; node; node = node.parentElement) {
          if (node.fontSize) return `${node.fontSize}px`;
        }
        return "16px";
      })();
      return {
        display: element.style.getPropertyValue("display") || "block",
        visibility: element.style.getPropertyValue("visibility") || "visible",
        opacity: element.style.getPropertyValue("opacity") || "1",
        translate: element.style.getPropertyValue("translate") || "none",
        fontSize: inheritedFont,
        backgroundColor: "rgba(0, 0, 0, 0)",
        backgroundImage: "none",
        getPropertyValue(name) {
          if (name === "font-size") return inheritedFont;
          if (name === "font-family") return "sans-serif";
          if (name === "font-weight") return "400";
          if (name === "line-height") return "1.5";
          if (name === "color") return "rgb(0, 0, 0)";
          if (name === "text-align") return "center";
          if (name === "--aura-greeting-x") return String(greetingX);
          if (name === "--aura-greeting-y") return String(greetingY);
          if (name === "--aura-greeting-max-ratio") return String(greetingMax);
          if (name === "--aura-greeting-mark-scale") return String(greetingMarkScale);
          return element.style.getPropertyValue(name);
        },
      };
    },
    addEventListener(type, listener) {
      const set = listeners.get(type) ?? new Set();
      set.add(listener);
      listeners.set(type, set);
    },
    removeEventListener(type, listener) { listeners.get(type)?.delete(listener); },
  };
  let timer = 0;
  const intervals = new Set();
  const timeouts = new Map();
  const setInterval = () => { const id = ++timer; intervals.add(id); return id; };
  const clearInterval = (id) => intervals.delete(id);
  const setTimeout = (callback) => { const id = ++timer; timeouts.set(id, callback); return id; };
  const clearTimeout = (id) => timeouts.delete(id);
  class MutationObserver {
    observe() {}
    disconnect() {}
  }
  const injectPayload = async (nextDigest = digest) => {
    const payload = await makePayload({ digest: nextDigest, phrases, mark, styled, shuffle });
    const inject = new Function(
      "window", "document", "MutationObserver",
      "setInterval", "clearInterval", "setTimeout", "clearTimeout",
      payload,
    );
    return inject(window, document, MutationObserver, setInterval, clearInterval, setTimeout, clearTimeout);
  };
  await injectPayload();
  const flushFrame = () => frames.shift()?.();
  const flushTimeout = () => {
    const next = timeouts.entries().next().value;
    if (!next) return false;
    const [id, callback] = next;
    timeouts.delete(id);
    callback();
    return true;
  };
  const replacements = () => document.querySelectorAll(`[${G}="new-chat"]`);
  const ownerCount = () => {
    const native = greetings.filter(({ text }) => text.isConnected
      && text.getBoundingClientRect().width > 0
      && window.getComputedStyle(text).display !== "none"
      && text.getAttribute("aria-hidden") !== "true").length;
    const aura = replacements().filter((node) => window.getComputedStyle(node).display !== "none"
      && window.getComputedStyle(node).visibility !== "hidden"
      && node.getAttribute("aria-hidden") !== "true").length;
    return native + aura;
  };
  return {
    window,
    document,
    main,
    group,
    shell,
    decoys,
    greetings,
    mediaListeners,
    navigationListeners,
    replacements,
    ownerCount,
    flushFrame,
    flushTimeout,
    injectPayload,
    activeResizeObservers() {
      return [...resizeObservers].filter((observer) => observer.targets.size).length;
    },
    triggerResize(target) {
      for (const observer of resizeObservers) {
        if (observer.targets.has(target)) {
          observer.callback([{ target, contentRect: target.getBoundingClientRect() }], observer);
        }
      }
    },
    setForced(value) {
      forced = value;
      mediaListeners.forEach((listener) => listener({ matches: value }));
    },
    remountGreeting() {
      greetings[0]?.outer.remove();
      const next = makeGreetingBranch(260);
      greetings.splice(0, greetings.length, next);
      main.insertBefore(next.outer, group);
      return next;
    },
  };
}

test("plain-div greeting binds outside the composer group and swaps with exactly one owner", async () => {
  const app = await runtime({
    mark: true,
    nativeStyle: {
      ariaHidden: "false",
      properties: [["display", "grid", "important"]],
    },
  });
  const state = app.window.__CLAUDE_AURA_STATE__;
  const native = app.greetings[0].row;
  assert.equal(app.document.getElementById("claude-aura-style").textContent, RUNTIME_CSS,
    "the runtime CSS dictionary did not decode before style installation");
  assert.equal(state.getGreetingProbe().status, "pending");
  assert.equal(state.getGreetingProbe().candidateCount, 1);
  assert.equal(app.ownerCount(), 1, "pending replacement must not create a second visible owner");
  assert.equal(native.getAttribute("aria-hidden"), "false");
  assert.equal(native.style.getPropertyValue("display"), "grid");
  app.flushFrame();
  assert.equal(state.getGreetingProbe().status, "verifying");
  assert.equal(app.ownerCount(), 1, "activation frame must hand off to exactly one owner");
  assert.equal(app.greetings[0].row.getAttribute(H), null,
    "custom wording must not hide the wrapper that owns Claude's native mark");
  assert.equal(app.greetings[0].text.getAttribute(H), "true");
  assert.equal(app.greetings[0].mark.getAttribute(K), "native");
  app.flushFrame();
  assert.equal(state.getGreetingProbe().status, "custom");
  assert.equal(app.ownerCount(), 1);
  assert.equal(app.replacements()[0].parentElement, app.greetings[0].row,
    "native mark and Aura text must remain in Claude's original flex/grid row");
  assert.equal(app.greetings[0].mark.style.getPropertyValue("position"), "fixed",
    "the native mark still participates in the greeting row layout");
  assert.equal(app.replacements()[0].style.getPropertyValue("font-family"), "",
    "native computed typography overrode the compiled greeting style");
  assert.equal(app.replacements()[0].style.getPropertyValue("overflow-wrap"), "anywhere",
    "custom text can overflow its bounded measure");
  const phrase = app.replacements()[0].querySelector(`[${T}]`).textContent;
  const compactDecoration = app.document.querySelector(`[${G}="decoration"]`);
  assert(compactDecoration?.querySelector(`[${K}="compact"]`),
    "custom greeting did not receive its registered compact mark");
  assert.equal(compactDecoration.style.getPropertyValue("position"), "fixed",
    "an opacity-zero compact mark must not reserve a layout gap");
  const probe = state.getGreetingProbe();
  assert.deepEqual(Object.keys(probe), [
    "version", "digest", "context", "status", "candidateCount", "source",
    "nativeConnected", "replacementConnected", "replacementVisible",
    "nativeHidden", "visitEpoch", "shuffle", "rect",
  ]);
  assert(!JSON.stringify(probe).includes(phrase), "probe leaked personalized greeting text");
  assert.deepEqual(Object.keys(probe.shuffle), [
    "themeId", "phraseDigest", "order", "cursor", "lastIndex",
  ]);
  assert.equal(probe.shuffle.themeId, "default");
  assert.match(probe.shuffle.phraseDigest, /^[a-f0-9]{64}$/);
  assert.deepEqual([...probe.shuffle.order].sort(), [0, 1]);
  assert.equal(probe.shuffle.cursor, 1);
  assert.equal(probe.shuffle.lastIndex, probe.shuffle.order[0]);
  assert(!JSON.stringify(probe.shuffle).includes(phrase),
    "shuffle checkpoint leaked personalized greeting text");

  const resumed = await runtime({ shuffle: probe.shuffle });
  resumed.flushFrame();
  resumed.flushFrame();
  assert.notEqual(
    resumed.replacements()[0].querySelector(`[${T}]`).textContent,
    phrase,
    "a fresh runtime did not resume at the next persisted shuffle index",
  );

  state.ensure();
  assert.equal(app.replacements()[0].querySelector(`[${T}]`).textContent, phrase);
  assert.equal(state.getGreetingProbe().visitEpoch, probe.visitEpoch);
  assert.deepEqual(
    [
      state.getGreetingProbe().rect.left,
      state.getGreetingProbe().rect.top,
      state.getGreetingProbe().rect.width,
      state.getGreetingProbe().rect.height,
    ],
    [679, 345, 320, 50],
    "the mirror rect must describe only the independently positioned greeting text",
  );
  app.setForced(true);
  assert.equal(state.getGreetingProbe().status, "forced-colors");
  assert.equal(app.ownerCount(), 1);
  assert.equal(native.getAttribute("aria-hidden"), "false");
  assert.equal(native.style.getPropertyValue("display"), "grid");
  assert.equal(native.style.getPropertyPriority("display"), "important");
  app.setForced(false);
  app.flushFrame();
  app.flushFrame();
  assert.equal(app.replacements()[0].querySelector(`[${T}]`).textContent, phrase,
    "forced-colors repair rerolled the semantic visit");

  const epoch = state.getGreetingProbe().visitEpoch;
  await app.injectPayload("greeting-runtime-b");
  app.flushFrame();
  app.flushFrame();
  assert.equal(app.replacements()[0].querySelector(`[${T}]`).textContent, phrase,
    "appearance-like reinjection rerolled the semantic visit");
  assert.equal(app.window.__CLAUDE_AURA_STATE__.getGreetingProbe().visitEpoch, epoch);

  app.remountGreeting();
  app.window.__CLAUDE_AURA_STATE__.ensure();
  app.flushFrame();
  app.flushFrame();
  assert.equal(app.replacements()[0].querySelector(`[${T}]`).textContent, phrase,
    "Claude remount rerolled the semantic visit");

  app.window.navigation.currentEntry = { key: "visit-2" };
  app.navigationListeners.forEach((listener) => listener());
  app.window.__CLAUDE_AURA_STATE__.ensure();
  assert.notEqual(app.replacements()[0].querySelector(`[${T}]`).textContent, phrase,
    "new navigation did not advance the shuffle bag");
  assert(app.window.__CLAUDE_AURA_STATE__.getGreetingProbe().visitEpoch > epoch);

  const remounted = app.greetings[0].row;
  app.window.__CLAUDE_AURA_STATE__.cleanup();
  assert.equal(remounted.getAttribute("aria-hidden"), null);
  assert.equal(remounted.style.getPropertyValue("display"), "");
  assert.equal(app.replacements().length, 0);
});

test("native and compact marks follow text without changing greeting geometry", async () => {
  for (const phrases of [null, ["Only phrase"]]) {
    const options = { phrases, greetingX: 0, greetingY: 0 };
    const unmarked = await runtime({ ...options, mark: false });
    const anchored = await runtime({ ...options, mark: true });
    const moved = await runtime({
      ...options, mark: true, greetingX: 0.12, greetingY: 0.04,
    });
    const scaled = await runtime({
      ...options, mark: true, greetingMarkScale: 1.5,
    });
    for (const app of [unmarked, anchored, moved, scaled]) {
      app.flushFrame();
      app.flushFrame();
    }
    const unmarkedRect = unmarked.window.__CLAUDE_AURA_STATE__.getGreetingProbe().rect;
    const anchoredRect = anchored.window.__CLAUDE_AURA_STATE__.getGreetingProbe().rect;
    const movedRect = moved.window.__CLAUDE_AURA_STATE__.getGreetingProbe().rect;
    const scaledRect = scaled.window.__CLAUDE_AURA_STATE__.getGreetingProbe().rect;
    assert.deepEqual(anchoredRect, unmarkedRect,
      "adding a compact mark changed the greeting text geometry");
    assert.deepEqual(scaledRect, unmarkedRect,
      "changing mark size changed the greeting text geometry");
    const anchoredMark = anchored.document.querySelector(`[${G}="decoration"]`).getBoundingClientRect();
    const movedMark = moved.document.querySelector(`[${G}="decoration"]`).getBoundingClientRect();
    assert.equal(movedMark.left - anchoredMark.left, movedRect.left - anchoredRect.left,
      "the mark did not follow the greeting's horizontal movement");
    assert.equal(movedMark.top - anchoredMark.top, movedRect.top - anchoredRect.top,
      "the mark did not follow the greeting's vertical movement");
    assert.equal(anchored.greetings[0].mark.style.getPropertyValue("position"), "fixed");
    for (const app of [unmarked, anchored, moved, scaled]) {
      app.window.__CLAUDE_AURA_STATE__.cleanup();
    }
  }
});

test("custom wording without a portable style keeps native typography and safe wrapping", async () => {
  const app = await runtime({
    styled: false,
    phrases: ["A".repeat(120)],
  });
  app.flushFrame();
  app.flushFrame();
  const replacement = app.replacements()[0];
  assert.equal(app.window.__CLAUDE_AURA_STATE__.getGreetingProbe().status, "custom");
  assert.equal(replacement.style.getPropertyValue("font-family"), "sans-serif",
    "unstyled custom wording did not inherit Claude's typography");
  assert.equal(replacement.style.getPropertyValue("max-width"), "100%",
    "unstyled custom wording lost its renderer-owned width bound");
  assert.equal(replacement.style.getPropertyValue("white-space"), "normal");
  assert.equal(replacement.style.getPropertyValue("overflow-wrap"), "anywhere",
    "unstyled long wording can overflow instead of wrapping");
});

test("a failed compact mark restores Claude's native greeting", async () => {
  const app = await runtime({ mark: true });
  app.flushFrame();
  app.flushFrame();
  const image = app.document.querySelector(`[${G}="decoration"]`)?.querySelector(`[${K}="compact"]`);
  assert.equal(typeof image?.onerror, "function", "compact mark has no decode failure path");
  image.onerror();
  assert.equal(app.window.__CLAUDE_AURA_STATE__.getGreetingProbe().status, "unmeasurable");
  assert.equal(app.replacements().length, 0);
  assert.equal(app.greetings[0].text.getAttribute(H), null);
  assert.equal(app.greetings[0].text.style.getPropertyValue("display"), "");
  assert.equal(app.ownerCount(), 1, "compact mark failure did not fail open to Claude");
  app.window.__CLAUDE_AURA_STATE__.ensure();
  assert.equal(app.replacements().length, 0, "repair retried a failed compact mark");
  assert.equal(app.ownerCount(), 1, "repair hid Claude again after compact mark failure");
});

test("a failed compact mark also removes native-mode styling", async () => {
  const app = await runtime({ mark: true, phrases: null });
  const { row, text } = app.greetings[0];
  const image = app.document.querySelector(`[${G}="decoration"]`)?.querySelector(`[${K}="compact"]`);
  assert.equal(row.getAttribute(G), "native");
  image.onerror();
  assert.equal(app.window.__CLAUDE_AURA_STATE__.getGreetingProbe().status, "unmeasurable");
  assert.equal(row.getAttribute(G), null);
  assert.equal(text.getAttribute(H), null);
  assert.equal(app.document.querySelector(`[${G}="decoration"]`), null);
  app.window.__CLAUDE_AURA_STATE__.ensure();
  assert.equal(row.getAttribute(G), null, "native styling retried after compact mark failure");
});

test("missing and ambiguous plain-div greetings fail open without mutation", async () => {
  const missing = await runtime({ count: 0 });
  assert.equal(missing.window.__CLAUDE_AURA_STATE__.getGreetingProbe().status, "missing");
  assert.equal(missing.window.__CLAUDE_AURA_STATE__.getGreetingProbe().candidateCount, 0);
  assert.equal(missing.replacements().length, 0);

  const ambiguous = await runtime({ count: 2 });
  const probe = ambiguous.window.__CLAUDE_AURA_STATE__.getGreetingProbe();
  assert.equal(probe.status, "ambiguous");
  assert.equal(probe.candidateCount, 2);
  assert.equal(ambiguous.replacements().length, 0);
  for (const { row, mark } of ambiguous.greetings) {
    assert.equal(row.getAttribute(H), null);
    assert.equal(row.getAttribute(G), null);
    assert.equal(mark.getAttribute(K), null);
  }
});

test("heading-like text inside a control is never owned", async () => {
  const app = await runtime({ controlDecoys: true });
  app.flushFrame();
  app.flushFrame();
  assert.equal(app.window.__CLAUDE_AURA_STATE__.getGreetingProbe().status, "custom");
  assert.equal(app.window.__CLAUDE_AURA_STATE__.getGreetingProbe().candidateCount, 1);
  assert.equal(app.ownerCount(), 1);
  for (const { wrapper, heading } of app.decoys) {
    assert.equal(wrapper.getAttribute(G), null);
    assert.equal(heading.getAttribute(G), null);
    assert.equal(wrapper.getAttribute(H), null);
    assert.equal(heading.getAttribute(H), null);
  }
});

test("native and custom placement clamp to the nearest safe canvas edge", async () => {
  const custom = await runtime({ greetingY: -0.4 });
  custom.flushFrame();
  custom.flushFrame();
  const customProbe = custom.window.__CLAUDE_AURA_STATE__.getGreetingProbe();
  assert.equal(customProbe.status, "custom");
  assert(customProbe.rect.top >= custom.main.rect.top - 2);
  assert(customProbe.rect.top + customProbe.rect.height <= custom.shell.rect.top + 2);
  assert.equal(custom.replacements().length, 1);
  assert.equal(custom.ownerCount(), 1);

  const native = await runtime({ greetingY: -0.4, phrases: null });
  const nativeProbe = native.window.__CLAUDE_AURA_STATE__.getGreetingProbe();
  assert.equal(nativeProbe.status, "native");
  assert(nativeProbe.rect.top >= native.main.rect.top - 2);
  assert(nativeProbe.rect.top + nativeProbe.rect.height <= native.shell.rect.top + 2);
  assert.equal(native.greetings[0].row.getAttribute(G), "native");
  assert.equal(native.ownerCount(), 1);
});

test("decorated greetings clamp their complete mark-and-text union at horizontal edges", async () => {
  for (const phrases of [null, ["Only phrase"]]) {
    for (const greetingX of [-0.45, 0.45]) {
      const app = await runtime({ phrases, mark: true, greetingX });
      app.flushFrame();
      app.flushFrame();
      const probe = app.window.__CLAUDE_AURA_STATE__.getGreetingProbe();
      assert.equal(probe.status, phrases ? "custom" : "native");
      const text = {
        ...probe.rect,
        right: probe.rect.left + probe.rect.width,
        bottom: probe.rect.top + probe.rect.height,
      };
      const decorations = app.document
        .querySelectorAll(`[${K}="native"],[${G}="decoration"]`)
        .map((node) => node.getBoundingClientRect())
        .filter((rect) => rect.width > 0 && rect.height > 0);
      const union = [text, ...decorations];
      assert(Math.min(...union.map((rect) => rect.left)) >= app.main.rect.left - 2,
        "a greeting mark escaped the left canvas edge");
      assert(Math.max(...union.map((rect) => rect.right)) <= app.main.rect.right + 2,
        "a greeting mark escaped the right canvas edge");
      assert.equal(app.ownerCount(), 1);
    }
  }
});

test("an established custom greeting reclamps when the observed canvas shifts", async () => {
  const app = await runtime();
  app.flushFrame();
  app.flushFrame();
  const state = app.window.__CLAUDE_AURA_STATE__;
  const phrase = app.replacements()[0].querySelector(`[${T}]`).textContent;
  const cursor = state.getGreetingProbe().shuffle.cursor;
  assert.equal(app.activeResizeObservers(), 1, "greeting lifecycle created duplicate active observers");

  app.triggerResize(app.main);
  assert.equal(app.flushTimeout(), true, "main ResizeObserver did not schedule a repair");
  assert.equal(state.getGreetingProbe().status, "custom");
  assert.equal(app.replacements()[0].querySelector(`[${T}]`).textContent, phrase,
    "a geometry-only repair rerolled the greeting");
  assert.equal(state.getGreetingProbe().shuffle.cursor, cursor);
  assert.equal(app.activeResizeObservers(), 1, "stable repair rebound duplicate observers");

  app.main.rect = {
    left: 700, top: 0, right: 1440, bottom: 900, width: 740, height: 900,
  };
  app.triggerResize(app.main);
  assert.equal(app.flushTimeout(), true);
  const shiftedProbe = state.getGreetingProbe();
  assert.equal(shiftedProbe.status, "custom");
  assert(shiftedProbe.rect.left >= app.main.rect.left - 2);
  assert.equal(app.replacements().length, 1);
  assert.equal(app.ownerCount(), 1, "canvas movement duplicated greeting ownership");
  assert.equal(app.activeResizeObservers(), 1);
});

test("a greeting wider than the observed canvas still fails open", async () => {
  const app = await runtime();
  app.flushFrame();
  app.flushFrame();
  const state = app.window.__CLAUDE_AURA_STATE__;
  app.main.rect = {
    left: 800, top: 0, right: 1000, bottom: 900, width: 200, height: 900,
  };
  app.triggerResize(app.main);
  assert.equal(app.flushTimeout(), true);
  assert(!["custom", "native"].includes(state.getGreetingProbe().status));
  assert.equal(app.replacements().length, 0);
  assert.equal(app.ownerCount(), 1, "oversized greeting did not restore Claude's greeting");
  assert.equal(app.activeResizeObservers(), 0, "failed ownership left a ResizeObserver bound");
});

test("an established custom greeting reclamps when the observed composer moves", async () => {
  const app = await runtime();
  app.flushFrame();
  app.flushFrame();
  const state = app.window.__CLAUDE_AURA_STATE__;
  app.shell.rect = {
    left: 430, top: 330, right: 1030, bottom: 470, width: 600, height: 140,
  };
  app.triggerResize(app.shell);
  assert.equal(app.flushTimeout(), true, "composer ResizeObserver did not schedule a repair");
  const probe = state.getGreetingProbe();
  assert.equal(probe.status, "custom");
  assert(probe.rect.top + probe.rect.height <= app.shell.rect.top + 2);
  assert.equal(app.replacements().length, 1);
  assert.equal(app.ownerCount(), 1, "composer movement duplicated greeting ownership");
  assert.equal(app.activeResizeObservers(), 1);
});

test("a reparented native leaf restores even after its saved wrapper disconnects", async () => {
  const app = await runtime();
  app.flushFrame();
  app.flushFrame();
  const state = app.window.__CLAUDE_AURA_STATE__;
  const { outer, text } = app.greetings[0];
  const safeHost = new Element("section", {
    left: 500, top: 250, right: 940, bottom: 350, width: 440, height: 100,
  });
  app.main.insertBefore(safeHost, app.group);
  outer.remove();
  safeHost.appendChild(text);

  state.ensure();
  assert.equal(state.getGreetingProbe().status, "missing");
  assert.equal(text.getAttribute(H), null, "connected native leaf kept Aura's ownership marker");
  assert.equal(text.getAttribute("aria-hidden"), null, "connected native leaf stayed hidden");
  assert.equal(text.style.getPropertyValue("display"), "", "connected native leaf stayed display:none");
  assert.equal(app.replacements().length, 0);
  assert.equal(app.ownerCount(), 1);
  assert.equal(app.activeResizeObservers(), 0);
});

test("a prior greeting owner is rejected after reparenting into a control or dialog", async () => {
  for (const excluded of [
    { tag: "button" },
    { tag: "section", role: "dialog" },
  ]) {
    const app = await runtime();
    app.flushFrame();
    app.flushFrame();
    const state = app.window.__CLAUDE_AURA_STATE__;
    const container = new Element(excluded.tag, {
      left: 500, top: 250, right: 940, bottom: 350, width: 440, height: 100,
    });
    if (excluded.role) container.setAttribute("role", excluded.role);
    app.main.insertBefore(container, app.group);
    container.appendChild(app.greetings[0].row);

    state.ensure();
    assert.equal(state.getGreetingProbe().status, "missing");
    assert.equal(app.replacements().length, 0);
    assert.equal(app.greetings[0].text.getAttribute(H), null);
    assert.equal(app.greetings[0].text.style.getPropertyValue("display"), "");
    assert.equal(app.ownerCount(), 1,
      `${excluded.role ?? excluded.tag} reparenting did not fail open to Claude`);
    assert.equal(app.activeResizeObservers(), 0);
  }
});

test("native greeting styles and compact decoration restore Claude state exactly", async () => {
  const app = await runtime({
    phrases: null,
    mark: true,
    nativeStyle: {
      ariaHidden: "false",
      properties: [
        ["display", "flex", "important"],
        ["translate", "3px 4px", "important"],
        ["max-width", "444px", "important"],
      ],
    },
    nativeMarkStyle: {
      properties: [
        ["position", "relative", "important"],
        ["left", "7px"],
        ["margin", "2px 3px"],
      ],
    },
  });
  const { row, mark } = app.greetings[0];
  const probe = app.window.__CLAUDE_AURA_STATE__.getGreetingProbe();
  assert.equal(probe.status, "native");
  assert.equal(row.getAttribute(G), "native");
  assert.equal(mark.getAttribute(K), "native");
  assert.equal(mark.style.getPropertyValue("position"), "fixed");
  assert.equal(mark.style.getPropertyPriority("position"), "important");
  assert(app.document.querySelector(`[${G}="decoration"]`)?.querySelector(`[${K}="compact"]`),
    "native words did not receive an inert compact-mark alternative");
  app.window.__CLAUDE_AURA_STATE__.cleanup();
  assert.equal(row.getAttribute(G), null);
  assert.equal(mark.getAttribute(K), null);
  assert.equal(row.getAttribute("aria-hidden"), "false");
  assert.equal(row.style.getPropertyValue("display"), "flex");
  assert.equal(row.style.getPropertyPriority("display"), "important");
  assert.equal(row.style.getPropertyValue("translate"), "3px 4px");
  assert.equal(row.style.getPropertyPriority("translate"), "important");
  assert.equal(row.style.getPropertyValue("max-width"), "444px");
  assert.equal(row.style.getPropertyPriority("max-width"), "important");
  assert.equal(mark.style.getPropertyValue("position"), "relative");
  assert.equal(mark.style.getPropertyPriority("position"), "important");
  assert.equal(mark.style.getPropertyValue("left"), "7px");
  assert.equal(mark.style.getPropertyValue("margin"), "2px 3px");
  assert.equal(app.document.querySelector(`[${G}="decoration"]`), null);
});

test("custom greeting copies a bounded native semantic heading level", async () => {
  for (const options of [{ headingTag: "h2" }, { semanticLevel: 3 }]) {
    const app = await runtime(options);
    app.flushFrame();
    app.flushFrame();
    const replacement = app.replacements()[0];
    assert.equal(replacement.getAttribute("aria-level"), options.headingTag ? "2" : "3");
    assert.equal(app.greetings[0].row.getAttribute(H), "true",
      "a semantic native heading must be hidden as one unit");
    assert.equal(app.ownerCount(), 1);
    app.window.__CLAUDE_AURA_STATE__.cleanup();
  }
});

test("semantic heading beside Claude's native mark binds the shared row", async () => {
  const app = await runtime({ mark: true, semanticSiblingMark: true });
  app.flushFrame();
  app.flushFrame();
  const { row, mark, text } = app.greetings[0];
  assert.equal(app.window.__CLAUDE_AURA_STATE__.getGreetingProbe().status, "custom");
  assert.equal(row.getAttribute(G), "native-mark",
    "the renderer left an adjacent live Claude mark outside its greeting owner");
  assert.equal(text.getAttribute(H), "true");
  assert.equal(mark.getAttribute(K), "native",
    "the adjacent native mark was not selected for compact-mark replacement");
  const decoration = app.document.querySelector(`[${G}="decoration"]`);
  const decorationRect = decoration?.getBoundingClientRect();
  const replacementRect = app.replacements()[0].getBoundingClientRect();
  assert(decorationRect.right <= replacementRect.left || decorationRect.left >= replacementRect.right,
    "the registered compact mark was not anchored outside the replacement text");
  assert.equal(app.ownerCount(), 1);
  app.window.__CLAUDE_AURA_STATE__.cleanup();
  assert.equal(row.getAttribute(G), null);
  assert.equal(text.getAttribute(H), null);
  assert.equal(mark.getAttribute(K), null);
  assert.equal(app.document.querySelector(`[${G}="decoration"]`), null);
});

test("compact greeting owns every bounded native mark and restores them together", async () => {
  const app = await runtime({
    mark: true,
    semanticSiblingMark: true,
    parallelNativeMarks: true,
  });
  app.flushFrame();
  app.flushFrame();
  const { row, mark, parallelMark } = app.greetings[0];
  assert.equal(app.window.__CLAUDE_AURA_STATE__.getGreetingProbe().status, "custom");
  assert.equal(row.getAttribute(G), "native-mark");
  assert.equal(app.greetings[0].text.getAttribute(H), "true");
  assert.equal(mark.getAttribute(K), "native");
  assert.equal(parallelMark.getAttribute(K), "native",
    "a nested parallel Claude mark escaped Greeting ownership");
  assert.equal(app.document.querySelectorAll(`[${G}="decoration"]`).length, 1,
    "compact mode rendered more than one Aura decoration");
  const decoration = app.document.querySelector(`[${G}="decoration"]`);
  const decorationRect = decoration.getBoundingClientRect();
  const textRect = app.replacements()[0].getBoundingClientRect();
  assert(decorationRect.right <= textRect.left || decorationRect.left >= textRect.right,
    "the compact mark was anchored on top of the greeting wording");
  app.window.__CLAUDE_AURA_STATE__.cleanup();
  assert.equal(row.getAttribute(G), null);
  assert.equal(mark.getAttribute(K), null);
  assert.equal(parallelMark.getAttribute(K), null);
  assert.equal(app.document.querySelector(`[${G}="decoration"]`), null);
});

test("a fifth bounded native mark fails open instead of escaping ownership", async () => {
  const app = await runtime({
    phrases: ["Good evening, {name}"],
    mark: true,
    semanticSiblingMark: true,
    parallelNativeMarkCount: 4,
  });
  const { row, mark, text, parallelMarks } = app.greetings[0];
  assert.equal(app.window.__CLAUDE_AURA_STATE__.getGreetingProbe().status, "missing");
  assert.equal(app.ownerCount(), 1);
  assert.equal(row.getAttribute(G), null);
  assert.equal(text.getAttribute(H), null);
  assert.equal(mark.getAttribute(K), null);
  assert(parallelMarks.every((parallelMark) => parallelMark.getAttribute(K) === null));
  assert.equal(app.document.querySelector(`[${G}="decoration"]`), null);
});

await runIfMain(import.meta.url);
