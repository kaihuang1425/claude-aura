import { test, runIfMain } from "./support/harness.mjs";
import assert from "node:assert/strict";
import {
  CODE_ROLE_SIGNATURES,
  codeContextFromUrl,
  createCodeAdapter,
  createExperimentalCodeAdapter,
  createExperimentalCodeDescriptor,
} from "../scripts/theme-core/code-adapter.mjs";
import { compileTheme, PROJECT_ROOT, THEME_IDS } from "./support/context.mjs";

const ROOT = "data-claude-aura-code-root";
const ROLE = "data-claude-aura-code-role";
const EXPERIMENTAL_MARKER = "data-aura-code";

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
    const match = selector.match(/^\[([^$=]+)(\$)?=(?:"([^"]+)"|([^\]]+))\]$/);
    if (!match) return false;
    const actual = this.getAttribute(match[1]);
    const expected = match[3] ?? match[4];
    return match[2] ? actual?.endsWith(expected) === true : actual === expected;
  }
  querySelectorAll(selector) {
    const alternatives = selector.split(",").map((item) => item.trim()).filter(Boolean);
    if (alternatives.length > 1) {
      return [...new Set(alternatives.flatMap((item) => this.querySelectorAll(item)))];
    }
    const parts = selector.trim().split(/\s+/);
    if (parts.length > 1) {
      const [ancestor, ...descendant] = parts;
      return this.querySelectorAll(ancestor)
        .flatMap((element) => element.querySelectorAll(descendant.join(" ")));
    }
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
      {
        name: "activity", group: "activity", required: false,
        probes: [{ kind: "data", selector: '[data-role="activity"]' }], css: "color:#555",
      },
    ],
  }],
};

function fixture({ dialogs = 0, activities = 0 } = {}) {
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
  const activityNodes = [];
  for (let index = 0; index < activities; index += 1) {
    const activity = main.appendChild(new Element("section"));
    activity.setAttribute("data-role", "activity");
    activityNodes.push(activity);
  }
  return { document, main, nav, transcript, composer, dialogNodes, activityNodes };
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

const EXPERIMENTAL = {
  l: ["20 20% 90%", "20 20% 95%"],
  d: ["240 20% 8%", "240 20% 12%"],
};

const EXPERIMENTAL_THEME_PALETTES = Object.freeze({
  default: {
    l: ["234 30% 92%", "232 38% 96%"],
    d: ["236 29% 8%", "233 24% 14%"],
  },
  "japanese-film-editorial": {
    l: ["38 20% 84%", "42 38% 94%"],
    d: ["210 10% 7%", "210 10% 12%"],
  },
  "korean-prestige": {
    l: ["216 24% 84%", "216 29% 94%"],
    d: ["218 55% 6%", "216 46% 10%"],
  },
  "cartoon-studio": {
    l: ["42 52% 93%", "40 62% 95%"],
    d: ["185 26% 8%", "184 22% 14%"],
  },
  "anime-twilight": {
    l: ["228 22% 90%", "229 45% 94%"],
    d: ["232 56% 8%", "232 48% 14%"],
  },
  "study-library": {
    l: ["44 28% 90%", "44 43% 93%"],
    d: ["139 26% 7%", "138 20% 13%"],
  },
  "japanese-idol": {
    l: ["13 56% 95%", "13 58% 96%"],
    d: ["339 28% 8%", "337 24% 14%"],
  },
  "korean-idol": {
    l: ["248 58% 96%", "246 55% 97%"],
    d: ["250 41% 8%", "248 34% 15%"],
  },
});

function experimentalRuntime({
  context = "code-list",
  asideCount = 1,
  dialogs = 0,
  nativeDialogs = 0,
  editors = context === "code-session" ? 1 : 0,
  regionCount = 1,
  listCount = context === "code-list" ? 1 : 0,
  outsideListCount = 0,
  mainCount = 1,
  descriptor = EXPERIMENTAL,
} = {}) {
  const document = new Document();
  const asides = [];
  for (let index = 0; index < asideCount; index += 1) {
    asides.push(document.body.appendChild(new Element("aside")));
  }
  const mains = [];
  const regions = [];
  const lists = [];
  const outsideLists = [];
  const editorNodes = [];
  for (let index = 0; index < mainCount; index += 1) {
    const main = document.body.appendChild(new Element("main"));
    mains.push(main);
    if (index === 0) {
      for (let regionIndex = 0; regionIndex < regionCount; regionIndex += 1) {
        const region = main.appendChild(new Element("section"));
        region.setAttribute("role", "region");
        regions.push(region);
      }
      const innerRoot = regions[0] ?? main;
      for (let listIndex = 0; listIndex < listCount; listIndex += 1) {
        const list = innerRoot.appendChild(new Element("section"));
        list.setAttribute("role", "list");
        lists.push(list);
      }
      for (let editorIndex = 0; editorIndex < editors; editorIndex += 1) {
        const editor = innerRoot.appendChild(new Element("div"));
        editor.setAttribute("contenteditable", "true");
        editorNodes.push(editor);
      }
    }
  }
  for (let index = 0; index < outsideListCount; index += 1) {
    const list = document.body.appendChild(new Element("section"));
    list.setAttribute("role", "list");
    outsideLists.push(list);
  }
  for (let index = 0; index < dialogs; index += 1) {
    const dialog = document.body.appendChild(new Element("section"));
    dialog.setAttribute("role", "dialog");
  }
  for (let index = 0; index < nativeDialogs; index += 1) {
    document.body.appendChild(new Element("dialog"));
  }
  let mode = "light";
  let currentContext = context;
  const adapter = createExperimentalCodeAdapter([
    document,
    () => ({ display: "block", visibility: "visible" }),
    () => mode,
  ], descriptor);
  return {
    document,
    aside: asides[0] ?? null,
    asides,
    mains,
    region: regions[0] ?? null,
    regions,
    list: lists[0] ?? null,
    lists,
    outsideLists,
    editorNodes,
    adapter,
    activate: () => adapter.activate(currentContext),
    setMode: (value) => { mode = value; },
    setContext: (value) => { currentContext = value; },
  };
}

const markerState = (view) => [
  view.main.getAttribute(ROOT),
  view.nav.getAttribute(ROLE),
  view.transcript.getAttribute(ROLE),
  view.composer.getAttribute(ROLE),
  ...view.dialogNodes.map((node) => node.getAttribute(ROLE)),
  ...view.activityNodes.map((node) => node.getAttribute(ROLE)),
];

test("the experimental descriptor derives both palettes from the selected theme", async () => {
  const compiled = await compileTheme({
    projectRoot: PROJECT_ROOT,
    config: { enabled: true, theme: "anime-twilight", appearance: "system" },
  });
  const descriptor = createExperimentalCodeDescriptor(compiled.theme);
  const palette = (mode) => {
    const semantic = compiled.theme[mode].semantic;
    return [
      semantic["--aura-sidebar-background"],
      semantic["--aura-background-primary"],
    ];
  };
  assert.deepEqual(descriptor.l, palette("light"));
  assert.deepEqual(descriptor.d, palette("dark"));
});

test("all built-ins project exact unique Light and Dark Code shell palettes", async () => {
  assert.deepEqual(
    Object.keys(EXPERIMENTAL_THEME_PALETTES).sort(),
    [...THEME_IDS].sort(),
    "The experimental matrix must cover every frozen built-in exactly once",
  );
  const unique = { l: new Set(), d: new Set() };
  for (const theme of THEME_IDS) {
    const compiled = await compileTheme({
      projectRoot: PROJECT_ROOT,
      config: { enabled: true, theme, appearance: "system" },
    });
    const descriptor = createExperimentalCodeDescriptor(compiled.theme);
    assert.deepEqual(descriptor, EXPERIMENTAL_THEME_PALETTES[theme],
      `${theme} must keep its reviewed semantic shell palette`);

    for (const [mode, key] of [["light", "l"], ["dark", "d"]]) {
      unique[key].add(descriptor[key].join(" / "));
      const view = experimentalRuntime({ descriptor });
      view.setMode(mode);
      assert.equal((await view.activate()).status, "styled");
      const [style] = view.document.querySelectorAll("style");
      for (const value of descriptor[key]) assert.match(style.textContent, new RegExp(`hsl\\(${value}\\)`));
      assert.doesNotMatch(style.textContent, /background-image|gradient\(|(?:^|[;{])background:/,
        `${theme} ${mode} must preserve every native Code background layer`);
    }
  }
  assert.equal(unique.l.size, THEME_IDS.length,
    "Every built-in must remain visually distinguishable in Light mode");
  assert.equal(unique.d.size, THEME_IDS.length,
    "Every built-in must remain visually distinguishable in Dark mode");
});

test("the source experiment styles only the exact Code shell roles", async () => {
  const view = experimentalRuntime();
  assert.equal((await view.activate()).status, "styled");
  assert.equal(view.document.body.getAttribute(EXPERIMENTAL_MARKER), null);
  assert.equal(view.aside.getAttribute(EXPERIMENTAL_MARKER), "v1n");
  assert.equal(view.mains[0].getAttribute(EXPERIMENTAL_MARKER), "v1c");
  assert.equal(view.region.getAttribute(EXPERIMENTAL_MARKER), null);
  assert.equal(view.list.getAttribute(EXPERIMENTAL_MARKER), null);
  const style = view.document.querySelectorAll("style")[0];
  assert.match(
    style.textContent,
    /^@media\(forced-colors:none\) and \(prefers-contrast:no-preference\)\{/,
    "The experimental palette must yield to forced-colors and increased-contrast modes",
  );
  assert.match(style.textContent, /hsl\(20 20% 90%\)/);
  assert.doesNotMatch(style.textContent, /hsl\(240 20% 8%\)/);
  assert.match(style.textContent,
    /\[data-aura-code=v1n\]/,
    "Code rules must require Aura's versioned ownership value");
  for (const match of style.textContent.matchAll(/\[data-aura-code=([^\]]+)\]/g)) {
    assert.match(match[1], /^-?[_a-zA-Z][-_a-zA-Z0-9]*$/,
      "Every unquoted Code ownership value must be a valid CSS identifier");
  }
  assert.match(style.textContent, /background-color:/,
    "Code surfaces should retain native background imagery");
  assert.doesNotMatch(style.textContent, /(?:^|[;{])color:/,
    "Code shells must not pass an Aura text color into unclassified descendants");
  assert.doesNotMatch(style.textContent, /(?:box-shadow|outline|border):/,
    "Code styling must preserve native focus, selection, and elevation frames");
  assert.doesNotMatch(style.textContent, /(?:^|[;{])background:/,
    "Code styling must not reset native background layers");
});

test("an unowned Code style id collision stays native and untouched", async () => {
  const view = experimentalRuntime();
  const pageStyle = view.document.head.appendChild(new Element("style"));
  pageStyle.id = "claude-aura-code-style";
  pageStyle.textContent = "main{background:page-owned}";

  assert.equal((await view.activate()).status, "native");
  assert.equal(pageStyle.isConnected, true);
  assert.equal(pageStyle.textContent, "main{background:page-owned}");
  assert.equal(view.aside.getAttribute(EXPERIMENTAL_MARKER), null);
  assert.equal(view.mains[0].getAttribute(EXPERIMENTAL_MARKER), null);
  assert.deepEqual(view.document.querySelectorAll("style"), [pageStyle]);
});

test("the source experiment reapplies the selected dark palette", async () => {
  const view = experimentalRuntime({ context: "code-session" });
  await view.activate();
  view.setMode("dark");
  await view.activate();
  const styles = view.document.querySelectorAll("style");
  assert.equal(styles.length, 1);
  assert.match(styles[0].textContent, /hsl\(240 20% 8%\)/);
  assert.equal(view.editorNodes[0].getAttribute(EXPERIMENTAL_MARKER), null,
    "A generic editable element must remain native");
});

test("safety UI or a missing or ambiguous required Code role keeps the experiment native", async () => {
  for (const view of [
    experimentalRuntime({ dialogs: 1 }),
    experimentalRuntime({ nativeDialogs: 1 }),
    experimentalRuntime({ asideCount: 0 }),
    experimentalRuntime({ asideCount: 2 }),
    experimentalRuntime({ mainCount: 0 }),
    experimentalRuntime({ mainCount: 2 }),
  ]) {
    assert.equal((await view.activate()).status, "native");
    for (const aside of view.asides) {
      assert.equal(aside.getAttribute(EXPERIMENTAL_MARKER), null);
    }
    assert.equal(view.document.querySelectorAll("style").length, 0);
  }
});

test("a malformed experimental palette keeps the Code page native", async () => {
  for (const descriptor of [
    {
      ...EXPERIMENTAL,
      l: [EXPERIMENTAL.l[0], "20 20% 90%;color:red"],
    },
    {
      ...EXPERIMENTAL,
      l: EXPERIMENTAL.l.slice(0, 1),
    },
    {
      ...EXPERIMENTAL,
      l: [`${EXPERIMENTAL.l[0]},${EXPERIMENTAL.l[1]}`],
    },
  ]) {
    const view = experimentalRuntime({ descriptor });
    assert.equal((await view.activate()).status, "native");
    assert.equal(view.aside.getAttribute(EXPERIMENTAL_MARKER), null);
    assert.equal(view.document.querySelectorAll("style").length, 0);
  }
});

test("missing or ambiguous inner roles stay native while safe outer roles style", async () => {
  const view = experimentalRuntime({
    context: "code-list",
    regionCount: 2,
    listCount: 2,
    editors: 2,
  });
  assert.equal((await view.activate()).status, "styled");
  assert.equal(view.aside.getAttribute(EXPERIMENTAL_MARKER), "v1n");
  assert.equal(view.mains[0].getAttribute(EXPERIMENTAL_MARKER), "v1c");
  assert.deepEqual(
    view.regions.map((region) => region.getAttribute(EXPERIMENTAL_MARKER)),
    [null, null],
  );
  assert.deepEqual(
    view.lists.map((list) => list.getAttribute(EXPERIMENTAL_MARKER)),
    [null, null],
  );
  assert.deepEqual(
    view.editorNodes.map((editor) => editor.getAttribute(EXPERIMENTAL_MARKER)),
    [null, null],
  );
});

test("inner roles outside the unique Code main also stay native", async () => {
  const view = experimentalRuntime({ listCount: 0, outsideListCount: 1 });
  assert.equal((await view.activate()).status, "styled");
  assert.equal(view.aside.getAttribute(EXPERIMENTAL_MARKER), "v1n");
  assert.equal(view.mains[0].getAttribute(EXPERIMENTAL_MARKER), "v1c");
  assert.equal(view.outsideLists[0].getAttribute(EXPERIMENTAL_MARKER), null);
});

test("a newly visible dialog rolls back all styling and clean structure can reapply", async () => {
  const view = experimentalRuntime();
  assert.equal((await view.activate()).status, "styled");
  const dialog = view.document.body.appendChild(new Element("section"));
  dialog.setAttribute("role", "alertdialog");
  assert.equal((await view.activate()).status, "native");
  assert.equal(view.aside.getAttribute(EXPERIMENTAL_MARKER), null);
  assert.equal(view.mains[0].getAttribute(EXPERIMENTAL_MARKER), null);
  assert.equal(view.document.querySelectorAll("style").length, 0);
  dialog.remove();
  assert.equal((await view.activate()).status, "styled");
});

test("throwing DOM probes fail native without leaking partial state", async () => {
  const document = new Document();
  document.querySelectorAll = () => { throw new Error("probe failed"); };
  const adapter = createExperimentalCodeAdapter([
    document,
    () => ({ display: "block", visibility: "visible" }),
    () => "light",
  ], EXPERIMENTAL);
  await assert.doesNotReject(async () => adapter.activate("code-list"));
  assert.equal((await adapter.activate("code-list")).status, "native");
});

test("leaving Code restores prior markers and removes the experimental sheet", async () => {
  const view = experimentalRuntime({ context: "code-session" });
  view.aside.setAttribute(EXPERIMENTAL_MARKER, "preexisting-owner");
  await view.activate();
  view.setContext(null);
  assert.equal((await view.activate()).status, "native");
  assert.equal(view.aside.getAttribute(EXPERIMENTAL_MARKER), "preexisting-owner");
  assert.equal(view.document.body.getAttribute(EXPERIMENTAL_MARKER), null);
  assert.equal(view.document.querySelectorAll("style").length, 0);
});

test("failed cleanup stays pending and retries the exact Aura mutations", async () => {
  const view = experimentalRuntime();
  view.aside.setAttribute(EXPERIMENTAL_MARKER, "page-owner");
  await view.activate();
  const style = view.document.querySelectorAll("style")[0];
  const setAttribute = view.aside.setAttribute.bind(view.aside);
  const remove = style.remove.bind(style);
  let blocked = true;
  view.aside.setAttribute = (name, value) => {
    if (blocked && name === EXPERIMENTAL_MARKER) throw new Error("restore blocked");
    setAttribute(name, value);
  };
  style.remove = () => {
    if (blocked) throw new Error("remove blocked");
    remove();
  };

  assert.equal(view.adapter.rollback(), false);
  assert.equal(view.aside.getAttribute(EXPERIMENTAL_MARKER), "v1n");
  assert.equal(style.isConnected, true);

  blocked = false;
  assert.equal(view.adapter.rollback(), true);
  assert.equal(view.aside.getAttribute(EXPERIMENTAL_MARKER), "page-owner");
  assert.equal(style.isConnected, false);
});

test("cleanup relinquishes a shell marker changed after Aura applied it", async () => {
  const view = experimentalRuntime();
  view.aside.setAttribute(EXPERIMENTAL_MARKER, "page-before");
  await view.activate();
  view.aside.setAttribute(EXPERIMENTAL_MARKER, "page-after");

  assert.equal(view.adapter.rollback(), true);
  assert.equal(view.aside.getAttribute(EXPERIMENTAL_MARKER), "page-after");
  assert.equal(view.mains[0].getAttribute(EXPERIMENTAL_MARKER), null);
  assert.equal(view.document.querySelectorAll("style").length, 0);
});

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
    "fixture-v1", "navigation", "transcript", "composer",
  ]);
});

test("a uniquely discovered safety role keeps the complete adapter native", async () => {
  const view = runtime({ dialogs: 1 });
  const pending = view.adapter.activate();
  assert.deepEqual(await pending, {
    status: "native", reason: "safety-role-detected", signature: null,
  });
  assert.deepEqual(markerState(view), [null, null, null, null, null]);
  assert.equal(view.document.querySelectorAll("style").length, 0);
});

test("an ambiguous optional role keeps the complete adapter native", async () => {
  const view = runtime({ activities: 2 });
  const pending = view.adapter.activate();
  assert.deepEqual(await pending, {
    status: "native", reason: "role-ambiguous", signature: null,
  });
  assert.deepEqual(markerState(view), [null, null, null, null, null, null]);
  assert.equal(view.document.querySelectorAll("style").length, 0);
});

test("an emergent safety role rolls back the whole transaction", async () => {
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
  assert.deepEqual(markerState(view), [null, null, null, null, null]);
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
  assert.deepEqual(markerState(view), [null, null, null, null]);
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
