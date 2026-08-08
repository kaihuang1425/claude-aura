import { test, runIfMain } from "./support/harness.mjs";
import {
  DEFAULT_CONFIG,
  PROJECT_ROOT,
  assert,
  buildPayload,
  fs,
  path,
} from "./support/context.mjs";

class StyleDeclaration {
  constructor() {
    this.values = new Map();
  }

  setProperty(name, value) {
    this.values.set(name, String(value));
  }

  getPropertyValue(name) {
    return this.values.get(name) ?? "";
  }

  removeProperty(name) {
    this.values.delete(name);
  }
}

class ClassList {
  constructor() {
    this.values = new Set();
  }

  add(...names) {
    for (const name of names) this.values.add(name);
  }

  remove(...names) {
    for (const name of names) this.values.delete(name);
  }

  toggle(name, force) {
    if (force === undefined ? !this.values.has(name) : force) this.values.add(name);
    else this.values.delete(name);
  }

  contains(name) {
    return this.values.has(name);
  }
}

class Element {
  constructor(tagName) {
    this.tagName = tagName.toUpperCase();
    this.nodeName = this.tagName;
    this.children = [];
    this.parentNode = null;
    this.dataset = {};
    this.style = new StyleDeclaration();
    this.classList = new ClassList();
    this.attributes = new Map();
    this.id = "";
    this.className = "";
    this.textContent = "";
  }

  appendChild(child) {
    child.remove();
    child.parentNode = this;
    this.children.push(child);
    return child;
  }

  prepend(child) {
    child.remove();
    child.parentNode = this;
    this.children.unshift(child);
    return child;
  }

  remove() {
    if (!this.parentNode) return;
    this.parentNode.children = this.parentNode.children.filter((child) => child !== this);
    this.parentNode = null;
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }

  getAttribute(name) {
    return this.attributes.get(name) ?? null;
  }
}

class PrepaintDocument {
  constructor() {
    this.documentElement = new Element("html");
    this.head = null;
    this.body = null;
    this.fullscreenElement = null;
    this.listeners = new Map();
  }

  createElement(tagName) {
    return new Element(tagName);
  }

  getElementById(id) {
    const visit = (element) => {
      if (!element) return null;
      if (element.id === id) return element;
      for (const child of element.children) {
        const match = visit(child);
        if (match) return match;
      }
      return null;
    };
    return visit(this.documentElement) || visit(this.head) || visit(this.body);
  }

  addEventListener(name, listener) {
    const listeners = this.listeners.get(name) ?? [];
    listeners.push(listener);
    this.listeners.set(name, listeners);
  }

  removeEventListener(name, listener) {
    this.listeners.set(name, (this.listeners.get(name) ?? []).filter((item) => item !== listener));
  }

  dispatch(name) {
    for (const listener of [...(this.listeners.get(name) ?? [])]) listener();
  }

  querySelector() {
    throw new Error("Passive prepaint must not inspect Claude's document");
  }
}

function payloadArguments(payload) {
  const invocationIndex = payload.lastIndexOf("})(");
  const settingsIndex = payload.lastIndexOf('",{');
  assert(invocationIndex >= 0 && settingsIndex > invocationIndex);
  return {
    cssJson: payload.slice(invocationIndex + 3, settingsIndex + 1),
    settingsJson: payload.slice(settingsIndex + 2, -1),
  };
}

function compilePrepaint(template, payload) {
  const { cssJson, settingsJson } = payloadArguments(payload);
  const source = template
    .replace("__AURA_CSS_JSON__", cssJson)
    .replace("__AURA_SETTINGS_JSON__", settingsJson);
  assert(!source.includes("__AURA_CSS_JSON__") && !source.includes("__AURA_SETTINGS_JSON__"));
  return source;
}

function executePrepaint(source, locationOverride = {}) {
  const document = new PrepaintDocument();
  const window = {
    innerWidth: 1180,
    innerHeight: 640,
    screen: { availWidth: 1920, availHeight: 1080 },
    matchMedia: () => ({ matches: false }),
  };
  window.top = window;
  const location = {
    protocol: "https:",
    hostname: "claude.ai",
    pathname: "/",
    ...locationOverride,
  };
  new Function("window", "document", "location", source)(window, document, location);
  return { document, window, location };
}

test("document-start prepaint renders passive theme chrome without inspecting Claude", async () => {
  const template = await fs.readFile(
    path.join(PROJECT_ROOT, "assets", "renderer-prepaint.js"),
    "utf8",
  );
  assert.doesNotMatch(template,
    /querySelector|MutationObserver|ResizeObserver|setInterval|setTimeout|fetch\s*\(|XMLHttpRequest|chrome\.webview/,
    "Prepaint must remain passive and local until response verification completes");

  const bundle = await buildPayload({
    config: {
      ...DEFAULT_CONFIG,
      theme: "korean-idol",
      appearance: "light",
    },
  });
  const source = compilePrepaint(template, bundle.payload);
  new Function(source);

  const { document, window } = executePrepaint(source);
  const root = document.documentElement;
  assert(root.classList.contains("claude-aura"));
  assert.equal(root.dataset.claudeAuraTheme, "korean-idol");
  assert.equal(root.dataset.claudeAuraEffectiveMode, "light");
  assert.equal(root.dataset.claudeAuraContext, "new-chat");
  const earlyStyle = document.getElementById("claude-aura-style");
  assert(earlyStyle && earlyStyle.textContent.includes("html.claude-aura"));
  assert.equal(document.getElementById("claude-aura-backdrop"), null,
    "Backdrop must wait until a real body exists");

  document.head = new Element("head");
  document.body = new Element("body");
  document.dispatch("readystatechange");
  const style = document.getElementById("claude-aura-style");
  const backdrop = document.getElementById("claude-aura-backdrop");
  assert.equal(style.parentNode, document.head);
  assert.equal(style.dataset.claudeAuraPrepaint, "true");
  assert(backdrop);
  assert.equal(backdrop.getAttribute("aria-hidden"), "true");
  assert.equal(backdrop.dataset.claudeAuraPrepaint, "true");
  assert.match(backdrop.dataset.claudeAuraOwned, /:prepaint$/,
    "The semantic renderer must rebuild live artwork bindings when it takes ownership");
  assert(backdrop.children.some((child) => child.className.includes("claude-aura-theme-art")),
    "Prepaint must start approved active-theme artwork before the cover reveals Claude");

  assert.equal(window.__CLAUDE_AURA_PREPAINT__.digest, bundle.digest);
  assert.equal(window.__CLAUDE_AURA_PREPAINT__.cleanup(), true);
  assert.equal(document.getElementById("claude-aura-style"), null);
  assert.equal(document.getElementById("claude-aura-backdrop"), null);
  assert(!root.classList.contains("claude-aura"));
});

test("document-start prepaint is top-level Claude-only and cannot tear down the full renderer", async () => {
  const template = await fs.readFile(
    path.join(PROJECT_ROOT, "assets", "renderer-prepaint.js"),
    "utf8",
  );
  const bundle = await buildPayload({
    config: { ...DEFAULT_CONFIG, theme: "default", appearance: "dark" },
  });
  const source = compilePrepaint(template, bundle.payload);

  const outside = executePrepaint(source, { hostname: "example.com" });
  assert(!outside.document.documentElement.classList.contains("claude-aura"));
  assert.equal(outside.window.__CLAUDE_AURA_PREPAINT__, undefined);

  const handedOff = executePrepaint(source);
  handedOff.document.head = new Element("head");
  handedOff.document.body = new Element("body");
  handedOff.document.dispatch("readystatechange");
  const handedOffStyle = handedOff.document.getElementById("claude-aura-style");
  const handedOffBackdrop = handedOff.document.getElementById("claude-aura-backdrop");
  assert.equal(handedOff.window.__CLAUDE_AURA_PREPAINT__.handoff(), true);
  assert.equal(handedOff.window.__CLAUDE_AURA_PREPAINT__, undefined);
  assert.equal(handedOff.document.getElementById("claude-aura-style"), handedOffStyle);
  assert.equal(handedOff.document.getElementById("claude-aura-backdrop"), handedOffBackdrop);
  handedOff.document.dispatch("readystatechange");
  assert.equal(handedOff.document.getElementById("claude-aura-backdrop"), handedOffBackdrop,
    "A late document event must not reassert passive ownership after handoff");

  const replaced = executePrepaint(source);
  replaced.document.head = new Element("head");
  replaced.document.body = new Element("body");
  replaced.document.dispatch("readystatechange");
  const firstGeneration = replaced.window.__CLAUDE_AURA_PREPAINT__;
  const firstBackdrop = replaced.document.getElementById("claude-aura-backdrop");
  new Function("window", "document", "location", source)(
    replaced.window,
    replaced.document,
    replaced.location,
  );
  const replacementBackdrop = replaced.document.getElementById("claude-aura-backdrop");
  assert.equal(firstGeneration.handoff(), false,
    "A replacement registration must retire the older document listeners");
  assert.notEqual(replacementBackdrop, firstBackdrop,
    "A replacement registration must rebuild the passive shell under one owner");
  replaced.document.dispatch("readystatechange");
  assert.equal(replaced.document.getElementById("claude-aura-backdrop"), replacementBackdrop,
    "A superseded registration must not reassert stale artwork");

  const active = executePrepaint(source);
  active.document.head = new Element("head");
  active.document.body = new Element("body");
  active.document.dispatch("readystatechange");
  active.window.__CLAUDE_AURA_STATE__ = { installed: true };
  assert.equal(active.window.__CLAUDE_AURA_PREPAINT__.cleanup(), false);
  assert(active.document.getElementById("claude-aura-style"),
    "Late challenge cleanup must not remove an installed full renderer");
  assert.equal(active.window.__CLAUDE_AURA_PREPAINT__, undefined);
});

test("Windows registers passive prepaint before initial navigation and keeps fail-open rescue", async () => {
  const ui = await fs.readFile(path.join(PROJECT_ROOT, "windows", "aura-ui.ps1"), "utf8");
  const renderer = await fs.readFile(
    path.join(PROJECT_ROOT, "assets", "renderer-inject.js"),
    "utf8",
  );
  assert.match(renderer.slice(0, 180),
    /__CLAUDE_AURA_PREPAINT__\?\.handoff\?\.\(\)/,
    "The full renderer must synchronously retire document-start listeners before taking ownership");
  const registrationStart = ui.indexOf("function Start-AuraUiDocumentPrepaintRegistration");
  const registrationEnd = ui.indexOf("\nfunction ", registrationStart + 1);
  const registration = ui.slice(registrationStart, registrationEnd);
  assert.match(registration, /AddScriptToExecuteOnDocumentCreatedAsync/);
  assert.match(registration, /PrepaintRegistrationDueUtc\s*=\s*\[DateTime\]::UtcNow\.AddMilliseconds\(1500\)/);

  const completionStart = ui.indexOf("function Complete-AuraUiDocumentPrepaintRegistration");
  const completionEnd = ui.indexOf("\nfunction ", completionStart + 1);
  const completion = ui.slice(completionStart, completionEnd);
  assert.match(completion,
    /timed out; continuing fail-open[\s\S]{0,240}?Navigate\(\$ClaudeInitialUrl\)/,
    "A prepaint registration failure must not strand the loading cover");
  assert.match(ui,
    /\$ClaudeInitialUrl\s*=\s*if\s*\(\$ExperimentalCodeStart\)\s*\{\s*'https:\/\/claude\.ai\/code'\s*\}\s*else\s*\{\s*'https:\/\/claude\.ai\/'\s*\}/,
    "The fail-open navigation target must stay on one of the two fixed Claude origins");

  const coreReady = ui.slice(
    ui.indexOf("$script:WebReady = $true"),
    ui.indexOf("if ($null -ne $script:ScriptTask", ui.indexOf("$script:WebReady = $true")),
  );
  assert.match(coreReady,
    /\$script:InitialNavigationPending\s*=\s*\$true[\s\S]{0,120}?Start-AuraUiDocumentPrepaintRegistration/);
  assert.doesNotMatch(coreReady, /\$core\.Navigate\(/,
    "Initial navigation must not race ahead of document-start registration");

  const responseStart = ui.indexOf("$core.add_WebResourceResponseReceived({");
  const responseEnd = ui.indexOf("$core.add_NavigationStarting({", responseStart);
  const responseHandler = ui.slice(responseStart, responseEnd);
  assert.match(responseHandler,
    /Request-AuraUiDocumentPrepaintCleanup[\s\S]{0,180}?Stop-AuraUiMirrorForRescue[\s\S]{0,520}?Hide-AuraUiLoading/,
    "An authoritative challenge marker must remove passive styling before revealing its document");

  const verificationStart = ui.indexOf("function Complete-AuraUiPendingNavigationVerification");
  const verificationEnd = ui.indexOf("\nfunction ", verificationStart + 1);
  const verification = ui.slice(verificationStart, verificationEnd);
  assert.match(verification, /Apply-AuraUiTheme/,
    "Semantic renderer work must remain behind late-response verification");
});

test("Windows keeps the WebView controller color-compatible with the startup cover", async () => {
  const ui = await fs.readFile(path.join(PROJECT_ROOT, "windows", "aura-ui.ps1"), "utf8");
  const loadingThemeStart = ui.indexOf("function Update-AuraUiLoadingTheme");
  const loadingThemeEnd = ui.indexOf("\nfunction ", loadingThemeStart + 1);
  const loadingTheme = ui.slice(loadingThemeStart, loadingThemeEnd);
  const webViewCreated = ui.indexOf(
    "$script:WebView = [Microsoft.Web.WebView2.WinForms.WebView2]::new()",
  );
  const initialCoverPrepared = ui.indexOf("\n  Update-AuraUiLoadingTheme", webViewCreated);
  const formContentAttached = ui.indexOf("$script:Form.Controls.Add($content)", webViewCreated);

  assert.match(loadingTheme,
    /\$script:WebView\.DefaultBackgroundColor\s*=\s*\$profile\.Background/,
    "The separately composed WebView surface must match the native cover before navigation");
  assert.ok(webViewCreated >= 0 &&
    initialCoverPrepared > webViewCreated &&
    initialCoverPrepared < formContentAttached,
    "The selected cover and controller color must be prepared before the form can present content");
});

runIfMain(import.meta.url);
