// payload tests. Extracted from the former monolithic tests/run-tests.mjs.
import { test, runIfMain } from "./support/harness.mjs";
import {
  AURA_VERSION,
  BUILTIN_BRAND_WORDMARK_ASSETS,
  DEFAULT_CONFIG,
  PROJECT_ROOT,
  REQUIRED_SEMANTIC_TOKENS,
  STUDIO_FONT_DISPLAY_STACKS,
  STUDIO_FONT_UI_STACKS,
  STUDIO_LOCALES,
  STUDIO_MAX_LAYERS,
  STUDIO_PREVIEW_MASTERS,
  STUDIO_SHADOWS,
  STUDIO_THEME_SCHEMA_VERSION,
  THEME_IDS,
  assert,
  buildAuraIcon,
  buildLauncherAssets,
  buildPayload,
  buildPayloadFromCompiled,
  compileTheme,
  contrast,
  crypto,
  deliverableFiles,
  executeStudioRequest,
  fs,
  hslToRgb,
  hydrateStudioDraft,
  listThemes,
  luminance,
  normalizeLocale,
  os,
  path,
  readPayloadSettings,
  readThemeKit,
  readThemeRegistry,
  resolveArtwork,
  run,
  spawnSync,
  validateTheme,
  writeConfig,
  zipEntryNames,
} from "./support/context.mjs";
import {
  createExperimentalCodeAdapter,
  createExperimentalCodeDescriptor,
} from "../scripts/theme-core/code-adapter.mjs";

test("WO-25 enters schema v4 with the full built-in matrix at or below 57 KB", async () => {
  const greetingPreferences = {
    enabled: true,
    source: "global",
    displayName: "N".repeat(40),
    globalPhrases: Array.from(
      { length: 12 },
      (_, index) => `${String(index).padStart(2, "0")} ${"x".repeat(117)}`,
    ),
    themeOverrides: {},
    shuffle: null,
  };
  let peak = null;
  let cells = 0;
  for (const locale of STUDIO_LOCALES) {
    for (const appearance of ["light", "dark", "system"]) {
      for (const theme of THEME_IDS) {
        const bundle = await buildPayload({
          config: { ...DEFAULT_CONFIG, theme, appearance, greetingPreferences },
          locale,
        });
        const result = { locale, appearance, theme, chromeBytes: bundle.payloadBudget.chromeBytes };
        if (!peak || result.chromeBytes > peak.chromeBytes) peak = result;
        cells += 1;
      }
    }
  }
  assert.equal(cells, STUDIO_LOCALES.length * 3 * THEME_IDS.length);
  assert(peak.chromeBytes <= 57_000,
    `${peak.locale}/${peak.appearance}/${peak.theme} enters WO-25 at ${peak.chromeBytes} non-artwork bytes`);
});

test("production payload keeps the Code adapter inert independently of registry contents", async () => {
  const publicThemeCore = await import("../scripts/theme-core.mjs");
  assert.equal(Object.hasOwn(publicThemeCore, "createCodeAdapter"), false,
    "The dormant active adapter must not be part of the production theme-core API");
  const compilerSource = await fs.readFile(
    path.join(PROJECT_ROOT, "scripts", "theme-core", "compile.mjs"),
    "utf8",
  );
  assert(!compilerSource.includes("CODE_ROLE_SIGNATURES"),
    "Production compilation must not activate Code when the dormant registry changes");
  assert(!compilerSource.includes("createCodeAdapter"),
    "Production compilation must not import or serialize the dormant active adapter");
  assert.match(compilerSource, /const codeAdapterFactory = createInertCodeAdapter;/);
  assert.match(
    compilerSource,
    /rendererSource = rendererSource\.replace\(CODE_ADAPTER_ACTIVE_PATTERN, ""\);/,
  );

  const bundle = await buildPayloadFromCompiled({
    css: "",
    settings: { digest: "inert-code-adapter" },
  });
  assert(!bundle.payload.includes("__AURA_RENDERER_WINDOW__"),
    "Production payloads must resolve the prepaint handoff window placeholder");
  assert.match(bundle.payload, /function createInertCodeAdapter/);
  for (const forbidden of [
    "function createCodeAdapter",
    "claude-aura-code-style",
    "data-claude-aura-code-root",
    "querySelectorAll(entry.selector)",
    "role.css",
    "__AURA_CODE_WINDOW__",
    "__AURA_CODE_DOCUMENT__",
    "const $w=window,$d=document",
  ]) {
    assert(!bundle.payload.includes(forbidden),
      `Production payload must not contain dormant Code adapter source: ${forbidden}`);
  }
});

test("compiled payload uses one stable root attribute and active-theme-only artwork", async () => {
  const rendererSource = await fs.readFile(path.join(PROJECT_ROOT, "assets", "renderer-inject.js"), "utf8");
  const baseCss = await fs.readFile(path.join(PROJECT_ROOT, "assets", "base.css"), "utf8");
  assert.match(baseCss, /\[data-claude-aura-prompt="authored"\]\s*\{[^}]*inline-size:\s*var\(--aura-prompt-width\)/s,
    "Only an authored prompt marker may own Aura's width");
  assert.match(baseCss,
    /\[data-aura-role="composer-editor"\]\s*\{[^}]*max-block-size:\s*min\(40dvh,\s*22rem\)[^}]*overflow-y:\s*auto[^}]*overflow-wrap:\s*anywhere/s,
    "A long prompt must scroll and wrap inside the viewport instead of growing through it");
  assert(!/\[data-claude-aura-prompt="native"\]\s*\{[^}]*inline-size:/s.test(baseCss),
    "The native measurement marker must not reset Claude's prompt width");
  assert.match(rendererSource, /const imageCssValue =/);
  assert.match(rendererSource, /const artCssValue =/);
  assert.match(rendererSource, /attributeFilter:/);
  assert.match(rendererSource, /document\["hidden"\]\?0:setInterval\(ensure,15e3\)/,
    "The renderer watchdog must run only while the document is visible");
  assert.match(rendererSource, /visibilitychange/,
    "The renderer must resume its watchdog from the browser visibility signal");
  assert(!/setInterval\(ensure,\s*1500\)/.test(rendererSource),
    "The renderer must not retain its old 1.5-second perpetual poll");
  assert(!/observe\(document\.documentElement,\s*\{\s*childList:\s*true,\s*subtree:\s*true/.test(rendererSource),
    "Renderer must not observe the entire Claude SPA subtree");
  const defaultBundle = await buildPayload({ configPath: path.join(PROJECT_ROOT, "config.example.json") });
  assert.equal(defaultBundle.settings.version, AURA_VERSION);
  assert.equal(defaultBundle.settings.theme, "default");
  assert.equal(defaultBundle.settings.appearance, "system");
  assert.equal(defaultBundle.settings.artDataUrl, null);
  assert.equal(defaultBundle.settings.artUnavailable, false);
  const watchdogBudget = await buildPayload({
    config: { ...DEFAULT_CONFIG, theme: "study-library", locale: "en", appearance: "light" },
  });
  assert(watchdogBudget.payloadBudget.chromeBytes <= 60_737,
    `Visibility-aware watchdog grew renderer chrome above its 60,737-byte baseline: ${
      watchdogBudget.payloadBudget.chromeBytes
    } bytes`);
  assert.match(defaultBundle.settings.brandWordmark?.lightDataUrl ?? "", /^data:image\/png;base64,/);
  assert.match(defaultBundle.settings.brandWordmark?.darkDataUrl ?? "", /^data:image\/png;base64,/);
  assert.match(defaultBundle.css, /--aura-background-primary/);
  assert.match(defaultBundle.css, /data-claude-aura-theme="cartoon-studio"/);
  assert.match(defaultBundle.css, /data-claude-aura-effective-mode="light"/);
  assert.match(defaultBundle.css, /data-claude-aura-effective-mode="dark"/);
  assert.match(defaultBundle.payload, /dataset\.claudeAuraTheme/);
  assert.match(defaultBundle.payload, /dataset\.claudeAuraEffectiveMode/);
  assert.match(defaultBundle.payload, /dataset\.claudeAuraContext/);
  assert.match(defaultBundle.payload, /data-claude-aura-prompt/);
  assert.match(defaultBundle.payload, /data-claude-aura-sidebar/);
  assert.match(defaultBundle.payload, /data-aura-role/);
  assert(defaultBundle.css.includes('[data-aura-role="sidebar-primary"]'),
    "Compiled themes must project the fixed primary-action recipe only through its runtime role");
  assert(defaultBundle.css.includes('[data-aura-role="composer-shell"]'),
    "Compiled themes must project composer material only through its runtime role");
  assert(!defaultBundle.css.includes('.input-box') && !defaultBundle.css.includes('[data-testid="composer"]'),
    "Composer replacement rules must not target unrelated editors through broad host selectors");
  assert(!/\[data-claude-aura-sidebar\]\s+:is\([^{}]*(?:button|a\[href\])/.test(defaultBundle.css),
    "Sidebar state styling must use discovered subroles rather than every descendant control");
  assert.match(defaultBundle.payload, /textarea:not\(\[readonly\]\)/);
  assert(!/placeholder|location\.pathname|New chat|Write a message/.test(rendererSource),
    "Context discovery must not depend on localized wording, placeholders, or URL routes");
  assert(!/dataset\.(?:mode|theme)\s*=/.test(rendererSource),
    "Aura appearance must not mutate Claude-owned mode or theme attributes");
  assert.match(defaultBundle.payload, /claude-aura-theme-art/);
  assert(defaultBundle.css.includes("data-claude-aura-brand-image"),
    "Built-in themes must include the decoded wordmark replacement CSS");
  const quotedCss = 'a::before { content: "a; b /* c */ > d"; margin: calc(100% - 2px); }';
  const quotedPayload = await buildPayloadFromCompiled({ css: quotedCss, settings: { digest: "quoted-css" } });
  assert(quotedPayload.payload.includes(JSON.stringify('a::before{content:"a; b /* c */ > d";margin:calc(100% - 2px)}')),
    "Payload CSS compaction must preserve quoted values and calculation whitespace");
  const descendantPseudoCss = 'html .sidebar :is(a, button) { color: red; }';
  const descendantPseudoPayload = await buildPayloadFromCompiled({
    css: descendantPseudoCss,
    settings: { digest: "descendant-pseudo-css" },
  });
  assert(descendantPseudoPayload.payload.includes(JSON.stringify('html .sidebar :is(a,button){color:red}')),
    "Payload CSS compaction must preserve descendant whitespace before pseudo selectors");
  assert(!defaultBundle.payload.includes("__AURA_CSS_JSON__"));
  assert(!defaultBundle.payload.includes("__AURA_SETTINGS_JSON__"));
  new Function(defaultBundle.payload);

  const themed = await compileTheme({
    configPath: path.join(PROJECT_ROOT, "config.example.json"),
    config: { ...DEFAULT_CONFIG, theme: "anime-twilight" },
  });
  assert.equal(themed.settings.artDataUrl, null);
  assert.equal(themed.settings.artLayers?.length, 1);
  assert.match(themed.settings.artLayers[0].dataUrl, /^data:image\/webp;base64,/);
  assert.equal(themed.artwork, null);
  assert.equal(themed.artworkLayers[0].path.endsWith(path.join("anime-twilight", "background.webp")), true);
  assert.equal(themed.settings.artUnavailable, false);

  const koreanIdolBundle = await compileTheme({
    config: { ...DEFAULT_CONFIG, theme: "korean-idol" },
  });
  assert.deepEqual(koreanIdolBundle.settings.newChatLayout, {
    widthRatio: 0.64,
    offsetXRatio: 0,
    offsetYRatio: 0,
  });
  assert.equal(koreanIdolBundle.settings.artLayers.find((layer) => layer.role === "hero")
    .contextOverrides.conversation.hidden, true);
  assert.deepEqual(koreanIdolBundle.settings.artLayers.map((layer) => layer.appearance),
    ["light", "light", "dark", "dark"]);
  assert.match(koreanIdolBundle.settings.brandWordmark?.lightDataUrl ?? "", /^data:image\/png;base64,/);
  assert.match(koreanIdolBundle.settings.brandWordmark?.darkDataUrl ?? "", /^data:image\/png;base64,/);
  assert.notEqual(
    koreanIdolBundle.settings.brandWordmark.lightDataUrl,
    koreanIdolBundle.settings.brandWordmark.darkDataUrl,
    "Korean Idol Dark must compile a clean appearance-specific derivative",
  );
  assert.equal(koreanIdolBundle.settings.brandWordmark.minWidth, 136);
  assert.equal(koreanIdolBundle.settings.brandWordmark.width, 160);
  assert.match(koreanIdolBundle.css,
    /\[data-claude-aura-brand-image\][^{]*\{[^}]*visibility:\s*hidden/s,
    "Pending wordmarks must remain invisible until decode succeeds");
  assert.match(koreanIdolBundle.css,
    /\[data-claude-aura-brand-host="ready"\]\s*>\s*\[data-claude-aura-brand-image\][^{]*\{[^}]*visibility:\s*visible/s,
    "Only a decoded ready-state wordmark may become visible");
  assert.match(koreanIdolBundle.css,
    /\[data-claude-aura-brand-loader\][^{]*\{[^}]*display:\s*block!important[^}]*width:\s*100%!important[^}]*height:\s*100%!important[^}]*object-fit:\s*contain!important/s,
    "The decoded full-color wordmark must be the visible, fitted image");
  assert.doesNotMatch(koreanIdolBundle.css,
    /\[data-claude-aura-brand-image\][^{]*\{[^}]*(?:background-color:\s*currentColor|mask-image:\s*var\(--aura-brand-mask\))/s,
    "Theme wordmarks must preserve their authored colors instead of becoming monochrome masks");

  for (const locale of ["en", "zh-CN", "zh-HKTW"]) {
    for (const appearance of ["light", "dark", "system"]) {
      for (const theme of await listThemes({ locale })) {
        const bundle = await buildPayload({
          config: { ...DEFAULT_CONFIG, theme: theme.name, appearance },
          locale,
        });
        // WO-18 preserves at least 3 KB of repair headroom under the permanent
        // 65 KB invariant across the complete locale/appearance matrix.
        const artBytes = (bundle.settings.artLayers ?? [])
          .reduce((total, layer) => total + Buffer.byteLength(layer.dataUrl, "utf8"), 0)
          + (bundle.settings.artDataUrl ? Buffer.byteLength(bundle.settings.artDataUrl, "utf8") : 0)
          + (bundle.settings.brandWordmark
            ? Buffer.byteLength(bundle.settings.brandWordmark.lightDataUrl, "utf8")
              + Buffer.byteLength(bundle.settings.brandWordmark.darkDataUrl, "utf8")
            : 0)
          + (bundle.settings.greeting?.markDataUrl
            ? Buffer.byteLength(bundle.settings.greeting.markDataUrl, "utf8")
            : 0);
        const payloadBytes = Buffer.byteLength(bundle.payload, "utf8");
        assert(payloadBytes - artBytes <= 62_000,
          `${locale}/${appearance}/${theme.name} exceeds the 62 KB WO-18 reserve ceiling`);
        assert(artBytes < 1_400_000,
          `${locale}/${appearance}/${theme.name} embedded artwork exceeds the 1.4 MB decorative budget`);
        const embeddedArtworkCount = bundle.payload.match(/data:image\/(?:svg\+xml|webp|png|avif);base64/g)?.length ?? 0;
        const expectedArtwork = (theme.artworkLayers ? theme.artworkLayers.length : (theme.artwork ? 1 : 0))
          + 2 + (bundle.settings.greeting?.markDataUrl ? 1 : 0);
        assert.equal(embeddedArtworkCount, expectedArtwork, `${locale}/${theme.name} did not embed exactly its active artwork`);
        assert(bundle.settings.brandWordmark,
          `${locale}/${theme.name} did not compile its built-in wordmark channel`);
        const registeredWordmark = BUILTIN_BRAND_WORDMARK_ASSETS[theme.name];
        assert(bundle.brandWordmark.light.path.endsWith(path.normalize(registeredWordmark.light))
          && bundle.brandWordmark.dark.path.endsWith(path.normalize(registeredWordmark.dark)),
          `${locale}/${theme.name} resolved a wordmark outside its registered built-in pair`);
        assert.deepEqual(
          [bundle.settings.brandWordmark.minWidth, bundle.settings.brandWordmark.width],
          [registeredWordmark.minWidth, registeredWordmark.width],
          `${locale}/${theme.name} compiled the wrong wordmark width range`,
        );
        if (theme.artwork) assert(bundle.artwork.path.endsWith(path.basename(theme.artwork.path)));
        if (theme.artworkLayers) {
          assert.equal(bundle.settings.artLayers?.length, theme.artworkLayers.length,
            `${locale}/${theme.name} did not resolve every artwork layer`);
          assert.equal(bundle.settings.artDataUrl, null,
            `${locale}/${theme.name} must not duplicate layered artwork in the legacy slot`);
        }
      }
    }
  }
});

test("built-in wordmark swaps only after decode and fails back to the native logo", async () => {
  class FakeStyle {
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

  class FakeClassList {
    constructor() {
      this.values = new Set();
    }

    add(...names) {
      for (const name of names) this.values.add(name);
    }

    remove(...names) {
      for (const name of names) this.values.delete(name);
    }

    contains(name) {
      return this.values.has(name);
    }

    toggle(name, force) {
      if (force === undefined) force = !this.values.has(name);
      if (force) this.values.add(name);
      else this.values.delete(name);
      return force;
    }
  }

  class FakeElement {
    constructor(tagName) {
      this.tagName = tagName.toUpperCase();
      this.nodeName = this.tagName;
      this.id = "";
      this.dataset = {};
      this.style = new FakeStyle();
      this.classList = new FakeClassList();
      this.children = [];
      this.parentNode = null;
      this.parentElement = null;
      this.textContent = "";
      this.naturalWidth = 0;
      this.rect = { left: 0, top: 0, right: 20, bottom: 20, width: 20, height: 20 };
      if (this.tagName === "IMG") {
        this.decode = () => new Promise((resolve, reject) => {
          this.resolveDecode = resolve;
          this.rejectDecode = reject;
        });
      }
    }

    get childNodes() {
      return this.children;
    }

    get isConnected() {
      return this.tagName === "HTML" || Boolean(this.parentNode?.isConnected);
    }

    getBoundingClientRect() {
      return { ...this.rect };
    }

    appendChild(child) {
      child.remove();
      this.children.push(child);
      child.parentNode = this;
      child.parentElement = this;
      return child;
    }

    prepend(child) {
      child.remove();
      this.children.unshift(child);
      child.parentNode = this;
      child.parentElement = this;
      return child;
    }

    remove() {
      if (!this.parentNode) return;
      this.parentNode.children = this.parentNode.children.filter((child) => child !== this);
      this.parentNode = null;
      this.parentElement = null;
    }

    contains(candidate) {
      return candidate === this || this.children.some((child) => child.contains(candidate));
    }

    setAttribute(name, value) {
      this[name] = String(value);
    }

    getAttribute(name) {
      return this[name] ?? null;
    }

    removeAttribute(name) {
      delete this[name];
    }

    matches(selector) {
      return selector.split(",").some((part) => {
        const simple = part.trim();
        if (simple === "a[href]") return this.tagName === "A" && Boolean(this.href);
        if (simple === "nav") return this.tagName === "NAV";
        if (simple === "button") return this.tagName === "BUTTON";
        if (simple === "select") return this.tagName === "SELECT";
        if (simple === "span") return this.tagName === "SPAN";
        if (simple === "div") return this.tagName === "DIV";
        if (simple === "p") return this.tagName === "P";
        if (simple === '[role="link"]') return this.role === "link";
        if (simple === '[role="button"]') return this.role === "button";
        if (simple === ".claude-logo") return this.classList.contains("claude-logo");
        if (simple === '[data-cds="ClaudeLogo"]') return this["data-cds"] === "ClaudeLogo";
        if (simple === '[aria-label="Claude" i]') {
          return this["aria-label"]?.toLowerCase() === "claude";
        }
        if (simple === 'a[aria-label="Claude" i]') {
          return this.tagName === "A" && this["aria-label"]?.toLowerCase() === "claude";
        }
        return false;
      });
    }

    closest(selector) {
      for (let candidate = this; candidate; candidate = candidate.parentElement) {
        if (candidate.matches(selector)) return candidate;
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

  const document = {
    documentElement: new FakeElement("html"),
    head: new FakeElement("head"),
    body: new FakeElement("body"),
    createElement: (tagName) => new FakeElement(tagName),
    addEventListener() {},
    removeEventListener() {},
  };
  document.documentElement.appendChild(document.head);
  document.documentElement.appendChild(document.body);
  const walk = (element) => [element, ...element.children.flatMap(walk)];
  const sidebar = new FakeElement("nav");
  let sidebarWidth = 48;
  sidebar.getBoundingClientRect = () => ({
    left: 0, top: 0, right: sidebarWidth, bottom: 900, width: sidebarWidth, height: 900,
  });
  document.body.appendChild(sidebar);
  const makeBrandHost = (left) => {
    const row = new FakeElement("div");
    row.rect = { left: 8, top: 8, right: 272, bottom: 56, width: 264, height: 48 };
    const inner = new FakeElement("div");
    inner.rect = { left, top: 16, right: left + 80, bottom: 48, width: 80, height: 32 };
    const host = new FakeElement("a");
    host.href = "/new";
    host.rect = { left, top: 16, right: left + 80, bottom: 48, width: 80, height: 32 };
    const native = new FakeElement("svg");
    native.setAttribute("data-cds", "ClaudeLogo");
    native.setAttribute("role", "img");
    native.setAttribute("aria-label", "Claude home");
    native.rect = { left: left + 4, top: 22, right: left + 72, bottom: 42, width: 68, height: 20 };
    host.appendChild(native);
    inner.appendChild(host);
    const search = new FakeElement("button");
    search.rect = { left: 220, top: 20, right: 244, bottom: 44, width: 24, height: 24 };
    const toggle = new FakeElement("button");
    toggle.rect = { left: 250, top: 20, right: 274, bottom: 44, width: 24, height: 24 };
    row.appendChild(inner);
    row.appendChild(search);
    row.appendChild(toggle);
    sidebar.prepend(row);
    return { row, host, native, search, toggle };
  };
  const first = makeBrandHost(12);
  document.querySelectorAll = (selector) => {
    if (selector === 'main,[role="main"]') return [];
    const markers = [...selector.matchAll(/\[([^\]=]+)(?:=[^\]]+)?\]/g)].map((match) => match[1]);
    if (markers.some((name) => name.startsWith("data-claude-aura-"))) {
      return walk(document.documentElement)
        .filter((element) => markers.some((name) => Object.hasOwn(element, name)));
    }
    return walk(document.documentElement).filter((element) => element.matches(selector));
  };
  document.getElementById = (id) => walk(document.documentElement)
    .find((element) => element.id === id) ?? null;

  let timerId = 0;
  const intervals = new Set();
  const timeouts = new Set();
  const setInterval = () => {
    const id = ++timerId;
    intervals.add(id);
    return id;
  };
  const clearInterval = (id) => intervals.delete(id);
  const setTimeout = () => {
    const id = ++timerId;
    timeouts.add(id);
    return id;
  };
  const clearTimeout = (id) => timeouts.delete(id);
  class FakeMutationObserver {
    observe() {}
    disconnect() {}
  }

  let mediaDark = false;
  let forcedColorsActive = false;
  let brandLabelColor = "rgb(34, 33, 65)";
  const mediaListeners = new Set();
  const forcedColorListeners = new Set();
  const mediaQuery = {
    get matches() { return mediaDark; },
    addEventListener(type, listener) { if (type === "change") mediaListeners.add(listener); },
    removeEventListener(type, listener) { if (type === "change") mediaListeners.delete(listener); },
  };
  const forcedColorQuery = {
    get matches() { return forcedColorsActive; },
    addEventListener(type, listener) { if (type === "change") forcedColorListeners.add(listener); },
    removeEventListener(type, listener) { if (type === "change") forcedColorListeners.delete(listener); },
  };
  const windowListeners = new Map();
  const window = {
    innerWidth: 1440,
    innerHeight: 900,
    matchMedia: (query) => query === "(forced-colors: active)" ? forcedColorQuery : mediaQuery,
    getComputedStyle: (element) => ({
      display: element.style.getPropertyValue("display") || "block",
      visibility: "visible",
      translate: element.style.getPropertyValue("translate") || "none",
      color: brandLabelColor,
    }),
    addEventListener(type, listener) {
      const listeners = windowListeners.get(type) ?? new Set();
      listeners.add(listener);
      windowListeners.set(type, listeners);
    },
    removeEventListener(type, listener) {
      windowListeners.get(type)?.delete(listener);
    },
    navigation: {
      addEventListener() {},
      removeEventListener() {},
    },
  };

  const bundle = await buildPayload({ config: { ...DEFAULT_CONFIG, theme: "korean-idol" } });
  const runtimeSettings = readPayloadSettings(bundle.payload);
  assert.deepEqual(runtimeSettings.b, [
    bundle.settings.brandWordmark.lightDataUrl,
    bundle.settings.brandWordmark.darkDataUrl,
    [136, 160],
    [136, 160],
  ], "The compact renderer channel must retain both appearance assets and their safe width range");
  const inject = new Function(
    "window", "document", "MutationObserver", "setInterval", "clearInterval", "setTimeout", "clearTimeout",
    bundle.payload,
  );
  inject(window, document, FakeMutationObserver, setInterval, clearInterval, setTimeout, clearTimeout);

  const brandImages = () => document.querySelectorAll("[data-claude-aura-brand-image]");
  assert.equal(brandImages().length, 0, "A collapsed sidebar must retain Claude's native compact logo");
  assert.equal(first.host["data-claude-aura-brand-native"], undefined);

  sidebarWidth = 280;
  first.search.rect = { ...first.search.rect, left: 142, right: 166 };
  window.__CLAUDE_AURA_STATE__.ensure();
  assert.equal(brandImages().length, 0,
    "A wide header row must retain the native logo when its first control leaves less than 136px");
  first.search.rect = { ...first.search.rect, left: 220, right: 244 };
  window.__CLAUDE_AURA_STATE__.ensure();
  assert.equal(brandImages().length, 1,
    "A small native brand target inside a wide, collision-free header row must receive one wordmark");
  const failedLightMark = brandImages()[0];
  const failedLightImage = failedLightMark.children[0];
  assert.equal(failedLightMark.parentElement, first.row,
    "The overlay must use the wide header row instead of stretching the small native brand link");
  assert.equal(failedLightImage.src, bundle.settings.brandWordmark.lightDataUrl);
  assert.equal(failedLightImage.alt, "");
  assert.equal(failedLightImage["aria-hidden"], "true");
  assert.equal(failedLightImage.draggable, false);
  assert.equal(failedLightMark["aria-hidden"], "true");
  assert.equal(
    failedLightMark.style.getPropertyValue("--aura-brand-mask"),
    "",
    "The Light lockup must render the authored raster instead of masking it",
  );
  assert.equal(first.row["data-claude-aura-brand-host"], undefined,
    "The host must not hide its native logo while the Light wordmark is pending");
  assert.equal(first.host["data-claude-aura-brand-native"], undefined);
  assert(first.search.isConnected && first.toggle.isConnected,
    "Creating the pending overlay must preserve the header controls");
  failedLightImage.naturalWidth = 344;
  failedLightImage.onload();
  await Promise.resolve();
  failedLightImage.rejectDecode(new Error("decode failed"));
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(brandImages().length, 0, "A decode failure must remove the unusable overlay");
  assert.equal(first.row["data-claude-aura-brand-host"], undefined,
    "A decode failure must leave the native logo visible");
  assert.equal(first.host["data-claude-aura-brand-native"], undefined);

  window.__CLAUDE_AURA_STATE__.ensure();
  assert.equal(brandImages().length, 1, "A later ensure may retry after a transient decode failure");
  const lightMark = brandImages()[0];
  const lightImage = lightMark.children[0];
  lightImage.naturalWidth = 344;
  lightImage.onload();
  await Promise.resolve();
  assert.equal(first.row["data-claude-aura-brand-host"], undefined,
    "The native logo must remain visible until image.decode() resolves");
  lightImage.resolveDecode();
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(first.row["data-claude-aura-brand-host"], "ready");
  assert.equal(first.row["data-claude-aura-brand-flow"], "true",
    "Only the statically positioned header row may receive Aura's relative-position marker");
  assert.equal(first.host["data-claude-aura-brand-native"], "true",
    "Only the original small brand target may be hidden after decode");
  for (const control of [first.search, first.toggle]) {
    assert(control.isConnected, "Search and sidebar-toggle controls must remain connected");
    assert.equal(control["data-claude-aura-brand-native"], undefined,
      "Header controls must never be hidden with the native brand");
    assert.equal(control["data-claude-aura-brand-host"], undefined,
      "Header controls must never become wordmark positioning hosts");
  }

  first.search.rect = { ...first.search.rect, left: 164, right: 188 };
  window.__CLAUDE_AURA_STATE__.ensure();
  assert.equal(lightMark.isConnected, false,
    "Changing available header width must retire the stale wordmark geometry");
  const resizedLightMark = brandImages()[0];
  const resizedLightImage = resizedLightMark.children[0];
  assert.equal(resizedLightMark.style.getPropertyValue("width"), "144px",
    "The replacement wordmark did not track the newly available header width");
  resizedLightImage.naturalWidth = 344;
  resizedLightImage.onload();
  resizedLightImage.resolveDecode();
  await Promise.resolve();
  await Promise.resolve();

  brandLabelColor = "rgb(242, 239, 255)";
  mediaDark = true;
  for (const listener of mediaListeners) listener({ matches: true });
  assert.equal(first.row["data-claude-aura-brand-host"], undefined,
    "Changing appearance must reveal the native logo while the replacement changes");
  assert.equal(first.host["data-claude-aura-brand-native"], undefined);
  assert.equal(resizedLightMark.isConnected, false);
  assert.equal(brandImages().length, 1);
  const darkMark = brandImages()[0];
  const darkImage = darkMark.children[0];
  assert.equal(darkImage.src, bundle.settings.brandWordmark.darkDataUrl);
  assert.equal(
    darkMark.style.getPropertyValue("--aura-brand-mask"),
    "",
    "The Dark lockup must render its appearance-specific raster instead of masking it",
  );
  darkImage.naturalWidth = 344;
  darkImage.onload();
  darkImage.resolveDecode();
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(first.row["data-claude-aura-brand-host"], "ready");
  assert(first.search.isConnected && first.toggle.isConnected,
    "Dark replacement must preserve the same header controls");

  brandLabelColor = "rgb(34, 33, 65)";
  window.__CLAUDE_AURA_STATE__.ensure();
  assert.equal(darkMark.isConnected, false,
    "The selected wordmark asset must follow the live label color, not only appearance mode");
  assert.equal(brandImages()[0].children[0].src, bundle.settings.brandWordmark.lightDataUrl,
    "A dark sidebar label must select the authored Light wordmark even in Dark appearance");

  sidebarWidth = 48;
  window.__CLAUDE_AURA_STATE__.ensure();
  assert.equal(brandImages().length, 0);
  assert.equal(first.row["data-claude-aura-brand-host"], undefined);
  assert.equal(first.row["data-claude-aura-brand-flow"], undefined);
  assert.equal(first.host["data-claude-aura-brand-native"], undefined);

  sidebarWidth = 280;
  const second = makeBrandHost(20);
  window.__CLAUDE_AURA_STATE__.ensure();
  assert.equal(brandImages().length, 0, "Ambiguous logo hosts must fail closed to Claude's native branding");
  assert.equal(first.host["data-claude-aura-brand-native"], undefined);
  assert.equal(second.host["data-claude-aura-brand-native"], undefined);

  second.row.remove();
  window.__CLAUDE_AURA_STATE__.ensure();
  assert.equal(brandImages().length, 1);
  assert.equal(window.__CLAUDE_AURA_STATE__.cleanup(), true);
  assert.equal(brandImages().length, 0);
  assert.equal(first.row["data-claude-aura-brand-host"], undefined);
  assert.equal(first.host["data-claude-aura-brand-native"], undefined);
  assert.equal(intervals.size, 0);
  assert.equal(timeouts.size, 0);
  assert.equal(mediaListeners.size, 0);
  assert.equal(forcedColorListeners.size, 0);

  const mixedIdentityCompiled = await compileTheme({
    config: { ...DEFAULT_CONFIG, theme: "korean-idol" },
  });
  mixedIdentityCompiled.settings.brandWordmark = {
    ...mixedIdentityCompiled.settings.brandWordmark,
    lightMinWidth: 96,
    lightWidth: 104,
    darkMinWidth: 36,
    darkWidth: 60,
    lightKind: "wordmark",
    darkKind: "local",
    lightTreatment: "original",
    darkTreatment: "accent",
  };
  const mixedIdentityBundle = await buildPayloadFromCompiled(mixedIdentityCompiled);
  assert.deepEqual(readPayloadSettings(mixedIdentityBundle.payload).b, [
    mixedIdentityCompiled.settings.brandWordmark.lightDataUrl,
    mixedIdentityCompiled.settings.brandWordmark.darkDataUrl,
    [96, 104],
    [36, 60],
    ["w", "m"],
    ["o", "a"],
  ], "The compact identity channel flattened appearance-specific mode, size, or treatment");
  const injectMixedIdentity = new Function(
    "window", "document", "MutationObserver", "setInterval", "clearInterval", "setTimeout", "clearTimeout",
    mixedIdentityBundle.payload,
  );
  mediaDark = false;
  brandLabelColor = "rgb(34, 33, 65)";
  injectMixedIdentity(
    window, document, FakeMutationObserver, setInterval, clearInterval, setTimeout, clearTimeout,
  );
  const mixedLightMark = brandImages()[0];
  assert.equal(mixedLightMark.style.getPropertyValue("width"), "104px");
  assert.equal(mixedLightMark.style.getPropertyValue("aspect-ratio"), "");
  assert.equal(mixedLightMark.style.getPropertyValue("mask-image"), "");

  brandLabelColor = "rgb(242, 239, 255)";
  mediaDark = true;
  for (const listener of mediaListeners) listener({ matches: true });
  const mixedDarkMark = brandImages()[0];
  const mixedDarkImage = mixedDarkMark.children[0];
  assert.equal(mixedDarkMark.style.getPropertyValue("width"), "60px");
  assert.equal(mixedDarkMark.style.getPropertyValue("aspect-ratio"), "1");
  assert.equal(mixedDarkMark.style.getPropertyValue("background-color"),
    "hsl(var(--aura-accent-primary))");
  assert(mixedDarkMark.style.getPropertyValue("mask-image"),
    "A foreground/accent identity treatment omitted the standard CSS mask");
  assert.equal(
    mixedDarkMark.style.getPropertyValue("-webkit-mask-image"),
    mixedDarkMark.style.getPropertyValue("mask-image"),
    "The local identity mask omitted its conservative WebKit fallback",
  );
  assert.equal(mixedDarkImage.style.getPropertyValue("opacity"), "0");
  assert.equal(window.__CLAUDE_AURA_STATE__.cleanup(), true);
  assert.equal(brandImages().length, 0);

  const personalTemporary = await fs.mkdtemp(path.join(PROJECT_ROOT, "tests", ".tmp-wordmark-dom-"));
  try {
    const generationDirectory = path.join(
      personalTemporary,
      "personal-wordmark",
      "generations",
      "a".repeat(64),
    );
    const personalPath = path.join(generationDirectory, "wordmark.png");
    const configPath = path.join(personalTemporary, "config.json");
    await fs.mkdir(generationDirectory, { recursive: true });
    await fs.copyFile(
      path.join(PROJECT_ROOT, "assets", "theme-art", "default", "brand-wordmark-light.png"),
      personalPath,
    );
    await writeConfig(configPath, {
      ...DEFAULT_CONFIG,
      theme: "korean-idol",
      personalWordmark: personalPath,
    });
    const personalBundle = await buildPayload({ configPath });
    const personalRuntime = readPayloadSettings(personalBundle.payload);
    assert(Array.isArray(personalRuntime.personalWordmark));
    assert.equal(personalRuntime.b, undefined,
      "The personal payload must reach the renderer without a built-in wordmark channel");
    const injectPersonal = new Function(
      "window", "document", "MutationObserver", "setInterval", "clearInterval", "setTimeout", "clearTimeout",
      personalBundle.payload,
    );
    injectPersonal(
      window,
      document,
      FakeMutationObserver,
      setInterval,
      clearInterval,
      setTimeout,
      clearTimeout,
    );
    assert.equal(brandImages().length, 1,
      "A personal-only W channel must mount through the conservative brand discovery path");
    const personalMark = brandImages()[0];
    const personalImage = personalMark.children[0];
    assert.equal(personalImage.src, personalRuntime.personalWordmark[0]);
    assert.equal(personalMark["aria-hidden"], "true");
    assert.equal(personalImage["aria-hidden"], "true");
    personalImage.naturalWidth = 344;
    personalImage.onload();
    personalImage.resolveDecode();
    await Promise.resolve();
    await Promise.resolve();
    assert.equal(first.row["data-claude-aura-brand-host"], "ready");

    mediaDark = !mediaDark;
    for (const listener of mediaListeners) listener({ matches: mediaDark });
    assert.equal(brandImages()[0], personalMark,
      "Appearance changes must not remount a personal image that serves both surfaces");
    assert.equal(window.__CLAUDE_AURA_STATE__.cleanup(), true);
    assert.equal(brandImages().length, 0);
  } finally {
    await fs.rm(personalTemporary, { recursive: true, force: true });
  }
});

test("renderer switching keeps one lifecycle, Code cleanup, and stable root writes", async () => {
  class FakeStyle {
    constructor() {
      this.values = new Map();
      this.setCalls = 0;
    }

    setProperty(name, value) {
      this.setCalls += 1;
      this.values.set(name, String(value));
    }

    getPropertyValue(name) {
      return this.values.get(name) ?? "";
    }

    removeProperty(name) {
      this.values.delete(name);
    }
  }

  class FakeClassList {
    constructor() {
      this.values = new Set();
    }

    add(...names) {
      for (const name of names) this.values.add(name);
    }

    remove(...names) {
      for (const name of names) this.values.delete(name);
    }

    contains(name) {
      return this.values.has(name);
    }

    toggle(name, force) {
      if (force === undefined) force = !this.values.has(name);
      if (force) this.values.add(name);
      else this.values.delete(name);
      return force;
    }
  }

  class FakeElement {
    constructor(tagName) {
      this.tagName = tagName.toUpperCase();
      this.nodeName = this.tagName;
      this.id = "";
      this.dataset = {};
      this.style = new FakeStyle();
      this.classList = new FakeClassList();
      this.children = [];
      this.parentNode = null;
      this.parentElement = null;
      this.textContent = "";
      this.innerHTML = "";
      this.rect = { left: 0, top: 0, right: 20, bottom: 20, width: 20, height: 20 };
    }

    get isConnected() {
      return this.tagName === "HTML" || Boolean(this.parentNode?.isConnected);
    }

    appendChild(child) {
      child.remove();
      this.children.push(child);
      child.parentNode = this;
      child.parentElement = this;
      return child;
    }

    prepend(child) {
      child.remove();
      this.children.unshift(child);
      child.parentNode = this;
      child.parentElement = this;
      return child;
    }

    remove() {
      if (!this.parentNode) return;
      this.parentNode.children = this.parentNode.children.filter((child) => child !== this);
      this.parentNode = null;
      this.parentElement = null;
    }

    contains(candidate) {
      return candidate === this || this.children.some((child) => child.contains(candidate));
    }

    getBoundingClientRect() {
      return { ...this.rect };
    }

    setAttribute(name, value) {
      this[name] = String(value);
    }

    getAttribute(name) {
      return this[name] ?? null;
    }

    hasAttribute(name) {
      return Object.hasOwn(this, name);
    }

    removeAttribute(name) {
      delete this[name];
    }

    matches(selector) {
      return selector.split(",").some((part) => {
        const simple = part.trim();
        if (simple === "nav") return this.tagName === "NAV";
        if (simple === "aside") return this.tagName === "ASIDE";
        if (simple === "section") return this.tagName === "SECTION";
        if (simple === "ul") return this.tagName === "UL";
        if (simple === "ol") return this.tagName === "OL";
        if (simple === "button") return this.tagName === "BUTTON";
        if (simple === "select") return this.tagName === "SELECT";
        if (simple === "a[href]") return this.tagName === "A" && Boolean(this.href);
        if (simple === "textarea:not([readonly])") {
          return this.tagName === "TEXTAREA" && !this.hasAttribute("readonly");
        }
        if (simple === '.ProseMirror[contenteditable="true"]') {
          return this.classList.contains("ProseMirror") && this.contenteditable === "true";
        }
        if (simple === '[role="textbox"][contenteditable="true"]') {
          return this.role === "textbox" && this.contenteditable === "true";
        }
        if (simple === '[role="button"]') return this.role === "button";
        if (simple === '[role="switch"]') return this.role === "switch";
        if (simple === '[role="combobox"]') return this.role === "combobox";
        if (simple === '[role="link"]') return this.role === "link";
        if (simple === '[role="menuitem"]') return this.role === "menuitem";
        if (simple === '[role="list"]') return this.role === "list";
        if (simple === '[role="dialog"]') return this.role === "dialog";
        if (simple === '[role="alertdialog"]') return this.role === "alertdialog";
        if (simple === '[role="group"]') return this.role === "group";
        if (simple === '[role="navigation"]') return this.role === "navigation";
        if (simple === '[role="toolbar"]') return this.role === "toolbar";
        if (simple === '[aria-haspopup="menu"]') return this["aria-haspopup"] === "menu";
        if (simple === '[data-state="checked"]') return this["data-state"] === "checked";
        if (simple === '[data-state="unchecked"]') return this["data-state"] === "unchecked";
        if (simple === '[data-claude-aura-prompt="authored"]') {
          return this["data-claude-aura-prompt"] === "authored";
        }
        if (simple === '[data-testid="new-chat"]') return this["data-testid"] === "new-chat";
        if (simple === '[data-testid="new-chat-button"]') return this["data-testid"] === "new-chat-button";
        if (simple === 'a[href="/new"]') return this.tagName === "A" && this.href === "/new";
        if (simple === 'a[href^="/new?"]') return this.tagName === "A" && this.href?.startsWith("/new?");
        if (simple === 'a[href$="/new"]') return this.tagName === "A" && this.href?.endsWith("/new");
        return false;
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

  let documentHidden = false;
  const documentListeners = new Map();
  const document = {
    documentElement: new FakeElement("html"),
    head: new FakeElement("head"),
    body: new FakeElement("body"),
    createElement: (tagName) => new FakeElement(tagName),
    get hidden() { return documentHidden; },
    addEventListener(type, listener) {
      const listeners = documentListeners.get(type) ?? new Set();
      listeners.add(listener);
      documentListeners.set(type, listeners);
    },
    removeEventListener(type, listener) {
      documentListeners.get(type)?.delete(listener);
    },
  };
  document.documentElement.appendChild(document.head);
  document.documentElement.appendChild(document.body);
  const sidebar = new FakeElement("nav");
  let sidebarWidth = 48;
  sidebar.getBoundingClientRect = () => ({
    left: 0, top: 0, right: sidebarWidth, bottom: 900, width: sidebarWidth, height: 900,
  });
  document.body.appendChild(sidebar);
  const main = new FakeElement("main");
  let mainRect = { left: 250, top: 0, right: 1440, bottom: 900, width: 1190, height: 900 };
  main.getBoundingClientRect = () => ({ ...mainRect });
  document.body.appendChild(main);
  document.querySelector = (selector) => selector === "main" ? main : null;
  let sidebarCandidates = [sidebar];
  let mainCandidates = [main];
  const walk = (element) => [element, ...element.children.flatMap(walk)];
  document.querySelectorAll = (selector) => {
    if (selector === "main" || selector === 'main,[role="main"]') return mainCandidates;
    if (selector.includes("aside") || selector.includes('[role="navigation"]')) return sidebarCandidates;
    if (selector.includes("dialog")) {
      return walk(document.documentElement).filter((element) => element.matches(selector));
    }
    const markers = [...selector.matchAll(/\[([^\]=]+)(?:=[^\]]+)?\]/g)].map((match) => match[1]);
    if (markers.some((name) => name.startsWith("data-claude-aura-") || name.startsWith("data-aura-"))) {
      return walk(document.documentElement).filter((element) => markers.some((name) => Object.hasOwn(element, name)));
    }
    return [];
  };
  document.getElementById = (id) => {
    const find = (element) => element.id === id
      ? element
      : element.children.map(find).find(Boolean);
    return find(document.documentElement) ?? null;
  };

  let timerId = 0;
  const intervals = new Map();
  const timeouts = new Map();
  const observers = new Set();
  const setInterval = (callback, delay) => {
    const id = ++timerId;
    intervals.set(id, { callback, delay });
    return id;
  };
  const clearInterval = (id) => intervals.delete(id);
  const setTimeout = (callback, delay) => {
    const id = ++timerId;
    timeouts.set(id, { callback, delay });
    return id;
  };
  const clearTimeout = (id) => timeouts.delete(id);
  class FakeMutationObserver {
    constructor(callback) {
      this.callback = callback;
    }

    observe() {
      observers.add(this);
    }

    disconnect() {
      observers.delete(this);
    }
  }

  let mediaDark = false;
  let forcedColorsActive = false;
  const mediaListeners = new Set();
  const forcedColorListeners = new Set();
  const mediaQuery = {
    get matches() { return mediaDark; },
    addEventListener(type, listener) { if (type === "change") mediaListeners.add(listener); },
    removeEventListener(type, listener) { if (type === "change") mediaListeners.delete(listener); },
  };
  const forcedColorQuery = {
    get matches() { return forcedColorsActive; },
    addEventListener(type, listener) { if (type === "change") forcedColorListeners.add(listener); },
    removeEventListener(type, listener) { if (type === "change") forcedColorListeners.delete(listener); },
  };
  const windowListeners = new Map();
  const navigationListeners = new Set();
  const window = {
    innerWidth: 1440,
    innerHeight: 900,
    location: { href: "https://claude.ai/new", pathname: "/new" },
    matchMedia: (query) => query === "(forced-colors: active)" ? forcedColorQuery : mediaQuery,
    getComputedStyle: (element) => ({
      display: element.style.getPropertyValue("display") || "block",
      visibility: "visible",
      translate: element.style.getPropertyValue("translate") || "none",
      overflowY: element.style.getPropertyValue("overflow-y") || "visible",
      backgroundColor: element.style.getPropertyValue("background-color") || "rgba(0, 0, 0, 0)",
      backgroundImage: element.style.getPropertyValue("background-image") || "none",
      boxShadow: element.style.getPropertyValue("box-shadow") || "none",
    }),
    addEventListener: (type, listener) => {
      const listeners = windowListeners.get(type) ?? new Set();
      listeners.add(listener);
      windowListeners.set(type, listeners);
    },
    removeEventListener: (type, listener) => windowListeners.get(type)?.delete(listener),
    navigation: {
      addEventListener: (type, listener) => { if (type === "currententrychange") navigationListeners.add(listener); },
      removeEventListener: (type, listener) => { if (type === "currententrychange") navigationListeners.delete(listener); },
    },
  };
  let koreanPayload = null;
  let prestigePayload = null;
  for (const theme of await listThemes()) {
    const bundle = await buildPayload({ config: { ...DEFAULT_CONFIG, theme: theme.name } });
    if (theme.name === "korean-idol") koreanPayload = bundle.payload;
    if (theme.name === "korean-prestige") prestigePayload = bundle.payload;
    const inject = new Function(
      "window",
      "document",
      "MutationObserver",
      "setInterval",
      "clearInterval",
      "setTimeout",
      "clearTimeout",
      bundle.payload,
    );
    inject(window, document, FakeMutationObserver, setInterval, clearInterval, setTimeout, clearTimeout);
    assert.equal(window.__CLAUDE_AURA_STATE__.theme, theme.name);
    assert.equal(document.documentElement.dataset.claudeAuraTheme, theme.name);
    assert.equal(document.documentElement.dataset.claudeAuraAppearance, "system");
    assert.equal(document.documentElement.dataset.claudeAuraEffectiveMode, "light");
    assert.equal(document.documentElement.dataset.claudeAuraContext, "other");
    assert.equal(sidebar["data-claude-aura-sidebar"], undefined,
      `${theme.name} styled the collapsed navigation rail instead of leaving it native`);
    assert.equal(mediaListeners.size, 1, `${theme.name} left duplicate appearance listeners`);
    assert.equal(forcedColorListeners.size, 1, `${theme.name} left duplicate forced-colors listeners`);
    assert.equal(intervals.size, 1, `${theme.name} left duplicate renderer timers`);
    assert.equal(observers.size, 1, `${theme.name} left duplicate mutation observers`);
    const backdrop = document.getElementById("claude-aura-backdrop");
    const layers = backdrop.children.filter((child) => String(child.class ?? "").includes("claude-aura-theme-art-layer"));
    const expectedLayers = theme.artworkLayers ?? [];
    assert.equal(layers.length, expectedLayers.length, `${theme.name} rendered the wrong layered-art count`);
    if (expectedLayers.length) {
      assert.equal(backdrop["aria-hidden"], "true");
      assert.deepEqual(layers.map((layer) => layer.style.getPropertyValue("opacity")),
        expectedLayers.map((layer) => String(layer.opacity)));
      assert.deepEqual(layers.map((layer) => layer.style.getPropertyValue("--aura-layer-opacity")),
        expectedLayers.map((layer) => String(layer.opacity)));
      assert.deepEqual(layers.map((layer) => layer.style.getPropertyValue("background-position")),
        expectedLayers.map((layer) => layer.position));
      assert.deepEqual(layers.map((layer) => layer.style.getPropertyValue("background-size")),
        expectedLayers.map((layer) => layer.size));
      assert.deepEqual(layers.map((layer) => layer.dataset.artMask),
        expectedLayers.map((layer) => layer.mask));
      assert.deepEqual(layers.map((layer) => layer.dataset.artMobile),
        expectedLayers.map((layer) => layer.mobile));
    }
    if (theme.name === "study-library") {
      assert.equal(document.documentElement.style.getPropertyValue("--aura-main-start"), "250px");
    }
  }
  const visibilityListeners = documentListeners.get("visibilitychange") ?? new Set();
  assert.equal(visibilityListeners.size, 1,
    "Renderer reinjection left duplicate visibility watchdog listeners");
  documentHidden = true;
  for (const listener of visibilityListeners) listener();
  assert.equal(intervals.size, 0, "Hidden documents must suspend the renderer watchdog");
  document.documentElement.classList.remove("claude-aura");
  documentHidden = false;
  for (const listener of visibilityListeners) listener();
  assert.equal(document.documentElement.classList.contains("claude-aura"), true,
    "Returning visibility must immediately repair the renderer root");
  assert.deepEqual([...intervals.values()].map(({ delay }) => delay), [15_000],
    "Visible documents must use one 15-second fallback watchdog");

  const sidebarSection = new FakeElement("section");
  sidebarSection.role = "group";
  sidebarSection.rect = { left: 8, top: 64, right: 272, bottom: 760, width: 264, height: 696 };
  const sidebarList = new FakeElement("div");
  sidebarList.role = "list";
  sidebarList.rect = { left: 8, top: 130, right: 272, bottom: 720, width: 264, height: 590 };
  const primaryAction = new FakeElement("a");
  const primarySurface = new FakeElement("div");
  const primaryIcon = new FakeElement("svg");
  const primaryIconTitle = new FakeElement("title");
  primaryIconTitle.textContent = "Create";
  primaryIcon.appendChild(primaryIconTitle);
  const hiddenPrimaryLabel = new FakeElement("span");
  hiddenPrimaryLabel.textContent = "Create a new chat";
  hiddenPrimaryLabel.rect = { left: 0, top: 0, right: 1, bottom: 1, width: 1, height: 1 };
  const primaryShortcut = new FakeElement("kbd");
  const paintedShortcut = new FakeElement("kbd");
  primarySurface.textContent = "New chat";
  primaryShortcut.textContent = "Ctrl+Shift+O";
  paintedShortcut.textContent = "⌘K";
  paintedShortcut.style.setProperty("background-color", "rgb(20, 20, 24)");
  primaryAction.href = "/new";
  primaryAction.tabIndex = 0;
  primaryAction.rect = { left: 16, top: 76, right: 264, bottom: 120, width: 248, height: 44 };
  primarySurface.appendChild(primaryIcon);
  primarySurface.appendChild(hiddenPrimaryLabel);
  primarySurface.appendChild(primaryShortcut);
  primarySurface.appendChild(paintedShortcut);
  primarySurface.childNodes = [
    primaryIcon,
    hiddenPrimaryLabel,
    { nodeType: 3, textContent: "New chat" },
    primaryShortcut,
    paintedShortcut,
  ];
  primaryAction.appendChild(primarySurface);
  const ordinaryRow = new FakeElement("a");
  ordinaryRow.href = "/chat/one";
  ordinaryRow.tabIndex = 0;
  ordinaryRow.rect = { left: 16, top: 146, right: 264, bottom: 186, width: 248, height: 40 };
  const currentRow = new FakeElement("a");
  currentRow.href = "/chat/two";
  currentRow.tabIndex = 0;
  currentRow.setAttribute("aria-current", "page");
  currentRow.rect = { left: 16, top: 194, right: 264, bottom: 234, width: 248, height: 40 };
  const footerControl = new FakeElement("button");
  footerControl.tabIndex = 0;
  footerControl.setAttribute("aria-haspopup", "menu");
  footerControl.rect = { left: 16, top: 826, right: 264, bottom: 870, width: 248, height: 44 };
  sidebarList.appendChild(ordinaryRow);
  sidebarList.appendChild(currentRow);
  sidebarSection.appendChild(sidebarList);
  sidebar.appendChild(primaryAction);
  sidebar.appendChild(sidebarSection);
  sidebar.appendChild(footerControl);
  sidebarWidth = 280;
  window.__CLAUDE_AURA_STATE__.ensure();
  assert.equal(sidebar["data-claude-aura-sidebar"], "expanded");
  assert.equal(primaryAction["data-aura-role"], "sidebar-primary");
  assert.equal(ordinaryRow["data-aura-role"], "sidebar-row");
  assert.equal(currentRow["data-aura-role"], "sidebar-row");
  assert.equal(sidebarList["data-aura-role"], "sidebar-list");
  assert.equal(sidebarSection["data-aura-role"], "sidebar-section");
  assert.equal(footerControl["data-aura-role"], "sidebar-footer");
  assert.equal(currentRow["aria-current"], "page",
    "Runtime role discovery must preserve Claude's current-row state");
  assert.equal(primarySurface.textContent, "New chat",
    "Runtime role discovery must preserve the nested primary-action label");
  assert.equal(primarySurface["data-aura-f"], "p",
    "Runtime role discovery must mark the primary label that shares Aura's state foreground");
  assert.equal(primarySurface["data-aura-bg"], "",
    "Runtime role discovery must mark only the primary label's native paint chain");
  assert.equal(primaryIcon["data-aura-f"], undefined,
    "A leading titled icon must not displace the visible primary label");
  assert.equal(hiddenPrimaryLabel["data-aura-f"], undefined,
    "A clipped accessibility label must not displace the visible primary label");
  assert.equal(primaryShortcut["data-aura-f"], "s",
    "Runtime role discovery must pair a visible secondary shortcut label");
  assert.equal(primaryShortcut["data-aura-bg"], undefined,
    "Runtime role discovery must preserve the shortcut's own optional material");
  assert.equal(paintedShortcut["data-aura-f"], undefined,
    "A self-painted shortcut must retain its native foreground/background pair");
  assert.deepEqual([primaryAction.tabIndex, ordinaryRow.tabIndex, currentRow.tabIndex, footerControl.tabIndex],
    [0, 0, 0, 0], "Runtime role discovery must preserve keyboard order");

  const independentSidebar = new FakeElement("nav");
  independentSidebar.rect = { left: 0, top: 0, right: 276, bottom: 900, width: 276, height: 900 };
  document.body.appendChild(independentSidebar);
  sidebarCandidates = [sidebar, independentSidebar];
  window.__CLAUDE_AURA_STATE__.ensure();
  assert.equal(sidebar["data-claude-aura-sidebar"], undefined,
    "Two independent left rails must fail open");
  assert.equal(primaryAction["data-aura-role"], undefined,
    "Ambiguous sidebar discovery must clear every prior subrole");
  assert.equal(primarySurface["data-aura-bg"], undefined,
    "Ambiguous sidebar discovery must also clear the paired label paint marker");
  assert.equal(primarySurface["data-aura-f"], undefined,
    "Ambiguous sidebar discovery must also clear the paired label foreground marker");

  independentSidebar.remove();
  const nestedSidebarCandidate = new FakeElement("nav");
  nestedSidebarCandidate.rect = { left: 0, top: 0, right: 280, bottom: 900, width: 280, height: 900 };
  sidebar.appendChild(nestedSidebarCandidate);
  sidebarCandidates = [sidebar, nestedSidebarCandidate];
  window.__CLAUDE_AURA_STATE__.ensure();
  assert.equal(sidebar["data-claude-aura-sidebar"], "expanded",
    "Nested candidates representing one rail must collapse to their outer owner");
  nestedSidebarCandidate.remove();
  sidebarCandidates = [sidebar];
  sidebarWidth = 48;
  window.__CLAUDE_AURA_STATE__.ensure();
  assert.equal(sidebar["data-claude-aura-sidebar"], undefined);
  assert.equal(primaryAction["data-aura-role"], undefined,
    "Collapsing the sidebar must restore its native control presentation");

  const reinjectKorean = new Function(
    "window", "document", "MutationObserver", "setInterval", "clearInterval", "setTimeout", "clearTimeout",
    koreanPayload,
  );
  reinjectKorean(window, document, FakeMutationObserver, setInterval, clearInterval, setTimeout, clearTimeout);
  assert.equal(document.getElementById("claude-aura-backdrop").children
    .filter((child) => String(child.class ?? "").includes("claude-aura-theme-art-layer")).length, 4,
  "Same-digest reinjection must recreate and rebind every artwork layer");
  assert.equal(mediaListeners.size, 1, "Same-digest reinjection left duplicate appearance listeners");

  const composer = new FakeElement("section");
  const editor = new FakeElement("textarea");
  const editorScrollHost = new FakeElement("div");
  const firstControl = new FakeElement("button");
  const secondControl = new FakeElement("button");
  const modelBadge = new FakeElement("span");
  const modelExtra = new FakeElement("span");
  const modelHint = new FakeElement("span");
  const compactPill = new FakeElement("button");
  const pressedControl = new FakeElement("button");
  const toggleControl = new FakeElement("button");
  const toolbar = new FakeElement("div");
  toolbar.setAttribute("role", "toolbar");
  toolbar.rect = { left: 430, top: 356, right: 1030, bottom: 396, width: 600, height: 40 };
  firstControl.tabIndex = 0;
  firstControl.setAttribute("aria-label", "Attach");
  firstControl.rect = { left: 440, top: 356, right: 480, bottom: 396, width: 40, height: 40 };
  secondControl.tabIndex = 0;
  secondControl.setAttribute("aria-label", "Model");
  secondControl.rect = { left: 490, top: 356, right: 610, bottom: 396, width: 120, height: 40 };
  modelExtra.textContent = "Extra";
  modelBadge.style.setProperty("background-color", "rgb(32, 34, 42)");
  modelBadge.appendChild(modelExtra);
  modelHint.textContent = "Beta";
  secondControl.appendChild(modelBadge);
  secondControl.appendChild(modelHint);
  secondControl.textContent = "Sonnet 5";
  secondControl.childNodes = [
    { nodeType: 3, textContent: "Sonnet 5" },
    modelBadge,
    modelHint,
  ];
  compactPill.tabIndex = 0;
  compactPill.setAttribute("aria-label", "Plan");
  compactPill.rect = { left: 612, top: 356, right: 676, bottom: 396, width: 64, height: 40 };
  const compactPillLabel = new FakeElement("span");
  compactPillLabel.textContent = "Plan";
  compactPill.appendChild(compactPillLabel);
  pressedControl.tabIndex = 0;
  pressedControl.setAttribute("aria-label", "Plan");
  pressedControl.setAttribute("aria-pressed", "false");
  pressedControl.rect = { left: 678, top: 356, right: 742, bottom: 396, width: 64, height: 40 };
  const pressedSurface = new FakeElement("span");
  const pressedLabel = new FakeElement("span");
  pressedLabel.textContent = "Plan";
  pressedSurface.appendChild(pressedLabel);
  pressedControl.appendChild(pressedSurface);
  toggleControl.tabIndex = 0;
  toggleControl.setAttribute("role", "switch");
  toggleControl.setAttribute("aria-checked", "false");
  toggleControl.rect = { left: 620, top: 356, right: 664, bottom: 396, width: 44, height: 40 };
  const popup = new FakeElement("div");
  popup.setAttribute("role", "dialog");
  const popupControl = new FakeElement("button");
  popupControl.tabIndex = 0;
  popupControl.rect = { left: 700, top: 356, right: 780, bottom: 396, width: 80, height: 40 };
  popup.appendChild(popupControl);
  toolbar.appendChild(firstControl);
  toolbar.appendChild(secondControl);
  toolbar.appendChild(compactPill);
  toolbar.appendChild(pressedControl);
  toolbar.appendChild(toggleControl);
  editorScrollHost.style.setProperty("overflow-y", "auto");
  editorScrollHost.appendChild(editor);
  composer.appendChild(editorScrollHost);
  composer.appendChild(toolbar);
  composer.appendChild(popup);
  const promptRoot = new FakeElement("div");
  promptRoot.appendChild(composer);
  const contentParent = new FakeElement("div");
  let contentParentRect = null;
  contentParent.getBoundingClientRect = () => ({ ...(contentParentRect ?? mainRect) });
  main.appendChild(promptRoot);
  let composerEditors = [editor];
  let hasConversationMessage = false;
  let composerBaseTop = 300;
  let editorHeight = 40;
  let composerHeight = 100;
  editor.getBoundingClientRect = () => ({
    left: 430,
    top: composerBaseTop + 12,
    right: 930,
    bottom: composerBaseTop + 12 + editorHeight,
    width: 500,
    height: editorHeight,
  });
  editorScrollHost.getBoundingClientRect = () => ({
    left: 420,
    top: composerBaseTop + 6,
    right: 940,
    bottom: composerBaseTop + 6 + Math.min(384, editorHeight),
    width: 520,
    height: Math.min(384, editorHeight),
  });
  composer.getBoundingClientRect = () => ({
    left: 430,
    top: composerBaseTop,
    right: 1030,
    bottom: composerBaseTop + composerHeight,
    width: 600,
    height: composerHeight,
  });
  promptRoot.getBoundingClientRect = () => {
    const parentRect = contentParentRect ?? mainRect;
    const width = Number.parseFloat(promptRoot.style.getPropertyValue("--aura-prompt-width")) || 600;
    const x = Number.parseFloat(promptRoot.style.getPropertyValue("--aura-prompt-x")) || 0;
    const y = Number.parseFloat(promptRoot.style.getPropertyValue("--aura-prompt-y")) || 0;
    const left = parentRect.left + (parentRect.width / 2) - (width / 2) + x;
    const height = composerHeight + 20;
    return { left, top: composerBaseTop + y, right: left + width, bottom: composerBaseTop + y + height, width, height };
  };
  main.querySelectorAll = (selector) => selector.includes("textarea:not([readonly])")
    ? composerEditors
    : FakeElement.prototype.querySelectorAll.call(main, selector);
  main.querySelector = (selector) => selector.includes('[data-testid="user-message"]')
    ? (hasConversationMessage ? new FakeElement("article") : null)
    : FakeElement.prototype.querySelector.call(main, selector);

  const nativeLayoutCompiled = await compileTheme({
    config: { ...DEFAULT_CONFIG, theme: "japanese-film-editorial" },
  });
  const nativeLayoutBundle = await buildPayloadFromCompiled({
    ...nativeLayoutCompiled,
    settings: {
      ...nativeLayoutCompiled.settings,
      newChatLayout: null,
      digest: "native-layout-regression",
    },
  });
  assert.equal(nativeLayoutBundle.settings.newChatLayout, null);
  const injectNativeLayout = new Function(
    "window", "document", "MutationObserver", "setInterval", "clearInterval", "setTimeout", "clearTimeout",
    nativeLayoutBundle.payload,
  );
  injectNativeLayout(window, document, FakeMutationObserver, setInterval, clearInterval, setTimeout, clearTimeout);
  assert.equal(document.documentElement.dataset.claudeAuraContext, "new-chat");
  assert.equal(main["data-claude-aura-main-canvas"], "true");
  assert.equal(promptRoot["data-claude-aura-prompt"], "native",
    "A native new-chat composer must remain measurable before Studio authors a layout");
  assert.equal(composer["data-aura-role"], "composer-shell");
  assert.equal(editor["data-aura-role"], "composer-editor");
  assert.equal(toolbar["data-aura-role"], "composer-toolbar");
  assert.equal(firstControl["data-aura-role"], "control-icon");
  assert.equal(secondControl["data-aura-role"], "control-pill");
  assert.equal(compactPill["data-aura-role"], "control-pill",
    "A compact Plan-like control in the former aspect-ratio gap must remain styled");
  assert.equal(pressedControl["data-aura-role"], "control-toggle",
    "A native aria-pressed control must retain toggle-state styling");
  assert.equal(secondControl["data-aura-f"], "p",
    "Direct control text must remain primary in DOM order");
  assert.equal(modelBadge["data-aura-f"], undefined);
  assert.equal(modelExtra["data-aura-f"], undefined,
    "A nested self-painted model badge must retain its native foreground/background pair");
  assert.equal(modelHint["data-aura-f"], "s",
    "An unpainted secondary model label must keep a separately paired foreground");
  assert.equal(pressedLabel["data-aura-f"], "p",
    "An aria-pressed Plan label must follow its selected or hover foreground");
  assert.equal(pressedSurface["data-aura-bg"], "",
    "An aria-pressed Plan paint wrapper must not cover Aura's paired state background");
  assert.equal(toggleControl["data-aura-role"], "control-toggle");
  assert.equal(popupControl["data-aura-role"], undefined,
    "Controls owned by a dialog inside the composer must retain native presentation");
  assert.deepEqual(
    [
      firstControl.tabIndex,
      firstControl["aria-label"],
      secondControl.tabIndex,
      secondControl["aria-label"],
      compactPill.tabIndex,
      compactPill["aria-label"],
      compactPillLabel.textContent,
      pressedControl.tabIndex,
      pressedControl["aria-pressed"],
      pressedLabel.textContent,
      toggleControl.tabIndex,
      toggleControl.role,
      toggleControl["aria-checked"],
    ],
    [0, "Attach", 0, "Model", 0, "Plan", "Plan", 0, "false", "Plan", 0, "switch", "false"],
    "Composer role discovery must not change nested labels, names, states, or keyboard order",
  );
  assert.equal(promptRoot.style.getPropertyValue("--aura-prompt-width"), "",
    "Measuring a native new-chat composer must not author its width");
  assert.equal(promptRoot.style.getPropertyValue("--aura-prompt-x"), "",
    "Measuring a native new-chat composer must not author its horizontal position");
  assert.equal(promptRoot.style.getPropertyValue("--aura-prompt-y"), "",
    "Measuring a native new-chat composer must not author its vertical position");

  const probeRectKeys = ["height", "left", "top", "width"];
  const assertProbeRect = (rect, label, viewport) => {
    assert(rect, `${label} must be measurable`);
    assert.deepEqual(Object.keys(rect).sort(), probeRectKeys,
      `${label} must expose geometry only`);
    for (const [key, value] of Object.entries(rect)) {
      assert(Number.isFinite(value), `${label}.${key} must be finite`);
    }
    assert(rect.width > 0 && rect.height > 0,
      `${label} must have positive dimensions`);
    assert(rect.left >= 0 && rect.top >= 0
      && rect.left + rect.width <= viewport.width
      && rect.top + rect.height <= viewport.height,
    `${label} must stay inside the CSS viewport`);
  };
  window.devicePixelRatio = 1.5;
  const layoutProbe = window.__CLAUDE_AURA_STATE__.getLayoutProbe();
  assert.deepEqual(Object.keys(layoutProbe).sort(), [
    "composer", "context", "controls", "digest", "frame", "greeting", "main",
    "mode", "prompt", "toolbar", "version", "viewport",
  ]);
  assert.deepEqual(Object.keys(layoutProbe.viewport).sort(), ["dpr", "height", "width"]);
  assert.deepEqual(layoutProbe.viewport, { width: 1440, height: 900, dpr: 1.5 },
    "Layout probes must report the live CSS viewport and browser DPR");
  assert.deepEqual(
    [layoutProbe.version, layoutProbe.digest, layoutProbe.context, layoutProbe.mode, layoutProbe.frame],
    [1, "native-layout-regression", "new-chat", "light", "wide"],
    "Layout probes must bind geometry to the active renderer and semantic scene",
  );
  assert.deepEqual(Object.keys(layoutProbe.greeting).sort(), ["rect", "source", "status"]);
  assert(["inactive", "missing", "ambiguous", "found"].includes(layoutProbe.greeting.status),
    "Greeting probe status escaped its bounded vocabulary");
  assert(["none", "native", "custom"].includes(layoutProbe.greeting.source),
    "Greeting probe source escaped its bounded vocabulary");
  assert.equal(layoutProbe.greeting.rect, null,
    "A missing greeting must not leak a stale rectangle");
  assert(Array.isArray(layoutProbe.controls) && layoutProbe.controls.length === 5,
    "A valid composer must expose its bounded control rectangles");
  for (const [key, rect] of Object.entries({
    main: layoutProbe.main,
    prompt: layoutProbe.prompt,
    composer: layoutProbe.composer,
    toolbar: layoutProbe.toolbar,
  })) {
    assertProbeRect(rect, key, layoutProbe.viewport);
  }
  layoutProbe.controls.forEach((rect, index) =>
    assertProbeRect(rect, `controls[${index}]`, layoutProbe.viewport));
  const serializedLayoutProbe = JSON.stringify(layoutProbe);
  assert.deepEqual(JSON.parse(serializedLayoutProbe), layoutProbe,
    "Layout probes must be plain serializable data");
  assert.doesNotMatch(serializedLayoutProbe,
    /Attach|Model|Sonnet|textarea|section|button|aria-|data-|querySelector/i,
    "Layout probes must not transport text, selectors, attributes, or DOM details");

  const firstControlRect = firstControl.rect;
  firstControl.rect = { ...firstControl.rect, left: Number.NaN };
  assert.equal(window.__CLAUDE_AURA_STATE__.getLayoutProbe().controls, null,
    "One invalid control rectangle must fail the complete control set closed");
  firstControl.rect = firstControlRect;

  const overflowControls = Array.from({ length: 8 }, (_, index) => {
    const control = new FakeElement("button");
    control.rect = {
      left: 750 + index * 20,
      top: 356,
      right: 766 + index * 20,
      bottom: 372,
      width: 16,
      height: 16,
    };
    composer.appendChild(control);
    return control;
  });
  assert.equal(window.__CLAUDE_AURA_STATE__.getLayoutProbe().controls, null,
    "More than twelve composer controls must fail closed");
  overflowControls.forEach((control) => control.remove());
  assert.equal(window.__CLAUDE_AURA_STATE__.getLayoutProbe().controls.length, 5,
    "The control probe must recover after an oversized set disappears");

  window.innerWidth = 1180;
  window.innerHeight = 640;
  window.devicePixelRatio = 1.25;
  mainRect = { left: 210, top: 0, right: 1180, bottom: 640, width: 970, height: 640 };
  composerBaseTop = 220;
  const resizedLayoutProbe = window.__CLAUDE_AURA_STATE__.getLayoutProbe();
  assert.deepEqual(resizedLayoutProbe.viewport, { width: 1180, height: 640, dpr: 1.25 });
  assert.equal(resizedLayoutProbe.frame, "normal");
  assert.equal(resizedLayoutProbe.composer.top, 220,
    "Layout probes must remeasure rather than cache composer geometry after resize");
  window.innerWidth = 1440;
  window.innerHeight = 900;
  window.devicePixelRatio = 1;
  mainRect = { left: 250, top: 0, right: 1440, bottom: 900, width: 1190, height: 900 };
  composerBaseTop = 300;

  const replacementPrompt = new FakeElement("div");
  const replacementComposer = new FakeElement("section");
  const replacementEditor = new FakeElement("textarea");
  const replacementToolbar = new FakeElement("div");
  const replacementControlA = new FakeElement("button");
  const replacementControlB = new FakeElement("button");
  replacementToolbar.setAttribute("role", "toolbar");
  replacementEditor.rect = { left: 470, top: 262, right: 930, bottom: 302, width: 460, height: 40 };
  replacementComposer.rect = { left: 450, top: 250, right: 970, bottom: 360, width: 520, height: 110 };
  replacementToolbar.rect = { left: 460, top: 310, right: 960, bottom: 350, width: 500, height: 40 };
  replacementControlA.rect = { left: 470, top: 310, right: 510, bottom: 350, width: 40, height: 40 };
  replacementControlB.rect = { left: 820, top: 310, right: 950, bottom: 350, width: 130, height: 40 };
  replacementPrompt.rect = { left: 450, top: 250, right: 970, bottom: 380, width: 520, height: 130 };
  replacementToolbar.appendChild(replacementControlA);
  replacementToolbar.appendChild(replacementControlB);
  replacementComposer.appendChild(replacementEditor);
  replacementComposer.appendChild(replacementToolbar);
  replacementPrompt.appendChild(replacementComposer);
  promptRoot.remove();
  main.appendChild(replacementPrompt);
  composerEditors = [replacementEditor];
  const replacementLayoutProbe = window.__CLAUDE_AURA_STATE__.getLayoutProbe();
  assert.deepEqual(replacementLayoutProbe.composer, {
    left: 450, top: 250, width: 520, height: 110,
  }, "Layout probes must discover and measure a replaced composer node live");
  assert.equal(replacementLayoutProbe.controls.length, 2);
  replacementPrompt.remove();
  main.appendChild(promptRoot);
  composerEditors = [editor];
  window.__CLAUDE_AURA_STATE__.ensure();

  toolbar.remove();
  popup.remove();
  window.__CLAUDE_AURA_STATE__.ensure();
  assert.equal(composer["data-aura-role"], "composer-shell",
    "A composer with optional controls absent must retain its shell role");
  assert.equal(editor["data-aura-role"], "composer-editor");
  toolbar.appendChild(firstControl);
  toolbar.appendChild(secondControl);
  toolbar.appendChild(compactPill);
  toolbar.appendChild(pressedControl);
  toolbar.appendChild(toggleControl);
  composer.appendChild(toolbar);
  composer.appendChild(popup);
  editorHeight = 132;
  composerHeight = 192;
  window.__CLAUDE_AURA_STATE__.ensure();
  assert.equal(composer["data-aura-role"], "composer-shell",
    "Long input or attachment growth must not drop the composer shell role");
  assert.equal(editor["data-aura-role"], "composer-editor");
  assert.equal(firstControl["data-aura-role"], "control-icon");
  editorHeight = 40;
  composerHeight = 100;
  window.__CLAUDE_AURA_STATE__.ensure();

  const independentMain = new FakeElement("main");
  independentMain.rect = { left: 300, top: 0, right: 1440, bottom: 900, width: 1140, height: 900 };
  document.body.appendChild(independentMain);
  mainCandidates = [main, independentMain];
  window.__CLAUDE_AURA_STATE__.ensure();
  assert.equal(main["data-claude-aura-main-canvas"], undefined,
    "Two independent main regions must fail open");
  assert.equal(composer["data-aura-role"], undefined,
    "Ambiguous main discovery must clear prior composer roles");
  assert.equal(promptRoot["data-claude-aura-prompt"], undefined);
  assert.equal(document.documentElement.dataset.claudeAuraContext, "other");
  independentMain.remove();
  mainCandidates = [main];
  window.__CLAUDE_AURA_STATE__.ensure();
  assert.equal(composer["data-aura-role"], "composer-shell",
    "Composer roles must recover after main-region ambiguity clears");

  sidebarWidth = 280;
  window.__CLAUDE_AURA_STATE__.ensure();
  assert.equal(primaryAction["data-aura-role"], "sidebar-primary");
  forcedColorsActive = true;
  for (const listener of forcedColorListeners) listener({ matches: true });
  assert.equal(sidebar["data-claude-aura-sidebar"], undefined);
  assert.equal(primaryAction["data-aura-role"], undefined);
  assert.equal(main["data-claude-aura-main-canvas"], undefined);
  assert.equal(composer["data-aura-role"], undefined);
  assert.equal(promptRoot["data-claude-aura-prompt"], undefined);
  assert.equal(document.documentElement.dataset.claudeAuraContext, "other",
    "Forced colors must leave native chrome unmarked and fail open");
  forcedColorsActive = false;
  for (const listener of forcedColorListeners) listener({ matches: false });
  assert.equal(primaryAction["data-aura-role"], "sidebar-primary");
  assert.equal(composer["data-aura-role"], "composer-shell");
  assert.equal(promptRoot["data-claude-aura-prompt"], "native");

  promptRoot.style.setProperty("translate", "7px 0px");
  reinjectKorean(window, document, FakeMutationObserver, setInterval, clearInterval, setTimeout, clearTimeout);
  window.__CLAUDE_AURA_STATE__.ensure();
  assert.equal(document.documentElement.dataset.claudeAuraContext, "new-chat");
  assert.equal(promptRoot["data-claude-aura-prompt"], "native",
    "An authored recipe must fail open when Claude already owns a translation");
  assert.equal(promptRoot.style.getPropertyValue("--aura-prompt-width"), "");
  assert.equal(promptRoot.style.getPropertyValue("--aura-prompt-x"), "");
  assert.equal(promptRoot.style.getPropertyValue("--aura-prompt-y"), "");
  promptRoot.style.removeProperty("translate");
  window.__CLAUDE_AURA_STATE__.ensure();
  assert.equal(promptRoot["data-claude-aura-prompt"], "authored");
  assert.equal(composer["data-claude-aura-prompt"], undefined,
    "Prompt placement must move the complete composer shell, not its inner field row");
  assert.equal(promptRoot.style.getPropertyValue("--aura-prompt-width"), "761.6px");
  const placed = promptRoot.getBoundingClientRect();
  assert(placed.left >= 266 && placed.right <= 1424, "Korean Idol prompt escaped the measured main canvas");
  assert.equal(composer.style.getPropertyValue("position"), "");
  assert.equal(composer.style.getPropertyValue("transform"), "");

  window.innerWidth = 1180;
  window.innerHeight = 640;
  mainRect = { left: 0, top: 0, right: 1180, bottom: 640, width: 1180, height: 640 };
  contentParentRect = { left: 306, top: 0, right: 1162, bottom: 640, width: 856, height: 640 };
  promptRoot.remove();
  contentParent.appendChild(promptRoot);
  main.appendChild(contentParent);
  composerBaseTop = 220;
  const injectPrestige = new Function(
    "window", "document", "MutationObserver", "setInterval", "clearInterval", "setTimeout", "clearTimeout",
    prestigePayload,
  );
  injectPrestige(window, document, FakeMutationObserver, setInterval, clearInterval, setTimeout, clearTimeout);
  window.__CLAUDE_AURA_STATE__.ensure();
  const alignedPrompt = promptRoot.getBoundingClientRect();
  const alignmentResult = {
    promptCenter: Math.round((alignedPrompt.left + alignedPrompt.right) / 2),
    parentCenter: Math.round((contentParentRect.left + contentParentRect.right) / 2),
  };

  composerBaseTop = 350;
  editorHeight = 580;
  composerHeight = 298;
  const promptInputListeners = documentListeners.get("input") ?? new Set();
  assert.equal(promptInputListeners.size, 1,
    "An authored prompt must remeasure immediately when its editor grows");
  for (const listener of promptInputListeners) listener({ target: editor });
  assert.equal(timeouts.size, 1,
    "One growing prompt input must schedule one bounded geometry refresh");
  for (const [id, timer] of [...timeouts]) {
    timeouts.delete(id);
    timer.callback();
  }
  const compactLongPrompt = promptRoot.getBoundingClientRect();
  const compactLongPromptProbe = window.__CLAUDE_AURA_STATE__.getLayoutProbe();
  const liveRegressionResult = {
    alignmentResult,
    context: document.documentElement.dataset.claudeAuraContext,
    promptMarker: promptRoot["data-claude-aura-prompt"],
    editorRole: editor["data-aura-role"],
    probeContext: compactLongPromptProbe.context,
    probePromptPresent: Boolean(compactLongPromptProbe.prompt),
    contained: compactLongPrompt.left >= contentParentRect.left + 16
      && compactLongPrompt.right <= contentParentRect.right - 16
      && compactLongPrompt.top >= mainRect.top + 16
      && compactLongPrompt.bottom <= mainRect.bottom - 16,
  };
  window.innerWidth = 1440;
  window.innerHeight = 900;
  mainRect = { left: 250, top: 0, right: 1440, bottom: 900, width: 1190, height: 900 };
  promptRoot.remove();
  main.appendChild(promptRoot);
  contentParent.remove();
  contentParentRect = null;
  composerBaseTop = 300;
  editorHeight = 40;
  composerHeight = 100;
  window.__CLAUDE_AURA_STATE__.ensure();
  assert.deepEqual(liveRegressionResult, {
    alignmentResult: { promptCenter: 734, parentCenter: 734 },
    context: "new-chat",
    promptMarker: "authored",
    editorRole: "composer-editor",
    probeContext: "new-chat",
    probePromptPresent: true,
    contained: true,
  }, "Live Home geometry must align to its content parent and retain long-prompt containment");

  injectNativeLayout(window, document, FakeMutationObserver, setInterval, clearInterval, setTimeout, clearTimeout);
  window.__CLAUDE_AURA_STATE__.ensure();
  assert.equal(promptRoot["data-claude-aura-prompt"], "native",
    "Switching back to a native recipe did not retain the measurement marker");
  assert.equal(promptRoot.style.getPropertyValue("--aura-prompt-width"), "",
    "Switching back to native left a stale authored width");
  assert.equal(promptRoot.style.getPropertyValue("--aura-prompt-x"), "");
  assert.equal(promptRoot.style.getPropertyValue("--aura-prompt-y"), "");
  reinjectKorean(window, document, FakeMutationObserver, setInterval, clearInterval, setTimeout, clearTimeout);
  window.__CLAUDE_AURA_STATE__.ensure();
  const activeBackdrop = document.getElementById("claude-aura-backdrop");
  const koreanLayers = activeBackdrop.children
    .filter((child) => String(child.class ?? "").includes("claude-aura-theme-art-layer"));
  const heroLayer = activeBackdrop.children.find((child) => child.dataset.artRole === "hero");
  assert(heroLayer, "Korean Idol hero role was not propagated to the renderer");
  assert.equal(heroLayer.dataset.artContext, "new-chat");
  assert.equal(heroLayer.style.getPropertyValue("opacity"), "0.96");
  assert.equal(heroLayer.style.getPropertyValue("--aura-layer-opacity"), "0.96");
  assert.deepEqual(koreanLayers.map((layer) => layer.style.getPropertyValue("display")), ["", "", "none", "none"],
    "Korean Idol light new-chat must show only its two light layers");
  mediaDark = true;
  for (const listener of mediaListeners) listener({ matches: true });
  assert.deepEqual(koreanLayers.map((layer) => layer.style.getPropertyValue("display")), ["none", "none", "", "none"],
    "Korean Idol dark new-chat must show exactly the upward-shifted scene");
  window.innerWidth = 1915;
  window.innerHeight = 1006;
  mainRect = { left: 288, top: 0, right: 1915, bottom: 1006, width: 1627, height: 1006 };
  window.__CLAUDE_AURA_STATE__.ensure();
  const widePlaced = promptRoot.getBoundingClientRect();
  assert(widePlaced.left >= 304 && widePlaced.right <= 1899,
    "Korean Idol prompt escaped the measured main canvas at fullscreen width");
  assert.deepEqual(koreanLayers.map((layer) => layer.style.getPropertyValue("display")), ["none", "none", "", "none"],
    "Fullscreen resize introduced a duplicate Korean Idol dark scene");
  assert.equal(koreanLayers[2].style.getPropertyValue("background-position"), "right top");
  assert.equal(koreanLayers[2].style.getPropertyValue("background-size"), "cover");
  window.innerWidth = 1440;
  window.innerHeight = 900;
  mainRect = { left: 250, top: 0, right: 1440, bottom: 900, width: 1190, height: 900 };
  mediaDark = false;
  for (const listener of mediaListeners) listener({ matches: false });
  window.__CLAUDE_AURA_STATE__.ensure();

  hasConversationMessage = true;
  window.__CLAUDE_AURA_STATE__.ensure();
  assert.equal(document.documentElement.dataset.claudeAuraContext, "conversation");
  assert.equal(promptRoot["data-claude-aura-prompt"], undefined);
  assert.equal(promptRoot.style.getPropertyValue("--aura-prompt-width"), "");
  assert.equal(composer["data-aura-role"], "composer-shell",
    "Conversation context must keep native composer material without repositioning it");
  assert.equal(editor["data-aura-role"], "composer-editor");
  assert.equal(toolbar["data-aura-role"], "composer-toolbar");
  assert.equal(firstControl["data-aura-role"], "control-icon");
  assert.equal(composer.style.getPropertyValue("position"), "");
  assert.equal(composer.style.getPropertyValue("transform"), "");
  assert.equal(heroLayer.dataset.artContext, "conversation");
  assert.deepEqual(koreanLayers.map((layer) => layer.style.getPropertyValue("display")), ["", "none", "none", "none"],
    "Korean Idol light conversation must retain only its atmosphere and hide the portrait");
  mediaDark = true;
  for (const listener of mediaListeners) listener({ matches: true });
  assert.deepEqual(koreanLayers.map((layer) => layer.style.getPropertyValue("display")), ["none", "none", "none", ""],
    "Korean Idol dark conversation must show exactly the preserved lower scene");
  mediaDark = false;
  for (const listener of mediaListeners) listener({ matches: false });

  hasConversationMessage = false;
  const secondComposer = new FakeElement("section");
  const secondEditor = new FakeElement("textarea");
  secondComposer.appendChild(secondEditor);
  secondComposer.appendChild(new FakeElement("button"));
  secondComposer.appendChild(new FakeElement("button"));
  secondComposer.getBoundingClientRect = () => ({ left: 430, top: 460, right: 1030, bottom: 580, width: 600, height: 120 });
  secondEditor.getBoundingClientRect = () => ({ left: 450, top: 472, right: 950, bottom: 512, width: 500, height: 40 });
  secondComposer.querySelectorAll = (selector) => selector === 'button,[role="button"],[role="switch"],[role="combobox"],select'
    ? secondComposer.children.slice(1)
    : [];
  main.appendChild(secondComposer);
  composerEditors = [editor, secondEditor];
  window.__CLAUDE_AURA_STATE__.ensure();
  assert.equal(document.documentElement.dataset.claudeAuraContext, "other");
  assert.equal(promptRoot["data-claude-aura-prompt"], undefined);
  assert.equal(composer["data-aura-role"], undefined,
    "Ambiguous composer discovery must clear every semantic chrome role");
  assert.equal(editor["data-aura-role"], undefined);
  assert.equal(firstControl["data-aura-role"], undefined);
  assert.equal(heroLayer.style.getPropertyValue("display"), "none",
    "An ambiguous page must hide Korean Idol's hero rather than cover unknown content");
  mediaDark = true;
  for (const listener of mediaListeners) listener({ matches: true });
  assert.deepEqual(koreanLayers.map((layer) => layer.style.getPropertyValue("display")), ["none", "none", "none", "none"],
    "An ambiguous dark page must fail closed instead of stacking both scenes");
  mediaDark = false;
  for (const listener of mediaListeners) listener({ matches: false });

  secondComposer.remove();
  composerEditors = [editor];
  composerBaseTop = 740;
  window.__CLAUDE_AURA_STATE__.ensure();
  assert.equal(document.documentElement.dataset.claudeAuraContext, "other",
    "A bottom-anchored message-free composer must fail closed instead of moving");
  assert.equal(composer["data-aura-role"], undefined,
    "A bottom-anchored ambiguous composer must retain native presentation");

  // A sparse schema-v5 prompt frame inherits geometry from the live native
  // composer. The payload must preserve a null base instead of inventing a
  // legacy 0.64/0/0 placement, and the renderer must resolve the missing axes
  // from the measured native rectangle without emitting NaN transforms.
  composerBaseTop = 300;
  composerEditors = [editor];
  hasConversationMessage = false;
  window.innerWidth = 1200;
  window.innerHeight = 800;
  mainRect = { left: 220, top: 0, right: 1200, bottom: 800, width: 980, height: 800 };
  promptRoot.style.removeProperty("translate");
  const responsivePromptBase = await compileTheme({ config: { ...DEFAULT_CONFIG, theme: "default" } });
  const responsivePromptBundle = await buildPayloadFromCompiled({
    ...responsivePromptBase,
    settings: {
      ...responsivePromptBase.settings,
      digest: "responsive-native-prompt",
      responsiveLayouts: {
        mode: "step",
        axis: "width",
        sets: [
          { id: "standard", label: "Standard", width: 1180, height: 640 },
          { id: "wide", label: "Wide", width: 1560, height: 940 },
        ],
        breakpoints: [1440],
      },
      newChatLayout: null,
      promptFrames: { standard: { widthRatio: 0.7 } },
    },
  });
  assert.deepEqual(readPayloadSettings(responsivePromptBundle.payload).n,
    [null, [[0.7, null, null], null]],
    "Responsive prompt packing invented a legacy base or filled sparse axes");
  const injectResponsivePrompt = new Function(
    "window", "document", "MutationObserver", "setInterval", "clearInterval", "setTimeout", "clearTimeout",
    responsivePromptBundle.payload,
  );
  injectResponsivePrompt(window, document, FakeMutationObserver, setInterval, clearInterval, setTimeout, clearTimeout);
  window.__CLAUDE_AURA_STATE__.ensure();
  assert.equal(promptRoot["data-claude-aura-prompt"], "authored");
  assert.equal(promptRoot.style.getPropertyValue("--aura-prompt-width"), "686px");
  assert.equal(promptRoot.style.getPropertyValue("--aura-prompt-x"), "0px");
  assert.equal(promptRoot.style.getPropertyValue("--aura-prompt-y"), "0px");

  // Exercise Studio's schema-v2 gates as one atomic scene. Reinjecting or
  // switching mode/context/viewport must reuse one backdrop and reveal only
  // the mutually compatible layers.
  composerBaseTop = 300;
  composerEditors = [editor];
  hasConversationMessage = false;
  window.innerWidth = 1200;
  window.innerHeight = 800;
  mainRect = { left: 220, top: 0, right: 1200, bottom: 800, width: 980, height: 800 };
  const studioRuntimeBase = await compileTheme({ config: { ...DEFAULT_CONFIG, theme: "default" } });
  const studioDataUrl = "data:image/webp;base64,UklGRgAAAABXRUJQVlA4IAAAAAAwAQCdASoBAAEAAUAmJaQAA3AA/v89WAAAAA==";
  const frame = (anchor, positionX, positionY, focalX, focalY, scale) => ({
    anchor, positionX, positionY, focalX, focalY, scale,
  });
  const layer = (index, options = {}) => ({
    dataUrl: studioDataUrl,
    position: "center",
    size: "cover",
    mobile: "reduce",
    opacity: 1,
    mask: "none",
    role: "decoration",
    contextOverrides: null,
    id: `layer-${index.toString(16).padStart(32, "0")}`,
    appearance: "all",
    context: "all",
    viewport: "all",
    visible: true,
    frames: {
      normal: frame("center", 0, 0, 50, 50, 1),
      wide: frame("center", 0, 0, 50, 50, 1),
    },
    ...options,
  });
  const studioRuntimeLayers = [
    layer(0, {
      role: "background",
      frames: {
        normal: frame("top-left", 10, 20, 25, 30, 1.2),
        wide: frame("bottom-right", -5, -10, 75, 80, 0.8),
      },
    }),
    layer(1, { appearance: "light", context: "new-chat", viewport: "normal", role: "hero" }),
    layer(2, { appearance: "dark", context: "new-chat", viewport: "wide", role: "hero" }),
    layer(3, { context: "conversation", role: "corner" }),
    layer(4, { appearance: "light", viewport: "wide" }),
    layer(5, { appearance: "dark", context: "conversation", viewport: "normal" }),
    layer(6, { visible: false }),
    layer(7, { context: "new-chat", viewport: "normal", opacity: 0.45, mask: "soft-right", mobile: "hide" }),
  ];
  const studioRuntimeSettings = {
    ...studioRuntimeBase.settings,
    digest: "studio-v2-content",
    appearance: "system",
    backgroundScope: "content",
    newChatLayout: { widthRatio: 0.68, offsetXRatio: 0.1, offsetYRatio: -0.05 },
    artLayers: studioRuntimeLayers,
  };
  const studioRuntimeBundle = await buildPayloadFromCompiled({
    ...studioRuntimeBase,
    settings: studioRuntimeSettings,
  });
  const injectStudioRuntime = new Function(
    "window", "document", "MutationObserver", "setInterval", "clearInterval", "setTimeout", "clearTimeout",
    studioRuntimeBundle.payload,
  );
  injectStudioRuntime(window, document, FakeMutationObserver, setInterval, clearInterval, setTimeout, clearTimeout);
  let studioBackdrop = document.getElementById("claude-aura-backdrop");
  let studioLayers = studioBackdrop.children
    .filter((child) => String(child.class ?? "").includes("claude-aura-theme-art-layer"));
  assert.equal(studioBackdrop.dataset.artScope, "content", "Content-canvas scope was not persisted to the renderer");
  assert.equal(studioLayers.length, STUDIO_MAX_LAYERS, "The renderer did not allocate all eight valid Studio layers");
  assert.deepEqual(studioLayers.map((item) => item.style.getPropertyValue("display")), ["", "", "none", "none", "none", "none", "none", ""],
    "Light/new-chat/normal gates exposed an incompatible Studio layer");
  assert.equal(document.documentElement.dataset.claudeAuraViewport, "normal");
  assert.equal(studioLayers[0].children[0].style.getPropertyValue("left"), "calc(0% + 10%)");
  assert.equal(studioLayers[0].children[0].style.getPropertyValue("top"), "calc(0% + 20%)");
  assert.equal(studioLayers[0].children[0].style.getPropertyValue("transform"), "translate(-25%, -30%) scale(1.2)");
  assert.equal(studioLayers[0].children[0].style.getPropertyValue("transform-origin"), "25% 30%");
  assert.equal(studioLayers[7].style.getPropertyValue("opacity"), "0.45");
  assert.equal(studioLayers[7].dataset.artMask, "soft-right");
  assert.equal(studioLayers[7].dataset.artMobile, "hide");
  assert.equal(promptRoot.style.getPropertyValue("--aura-prompt-width"), "666.4px",
    "Schema-v2 prompt placement did not use the persisted width ratio");

  window.innerWidth = 1600;
  window.innerHeight = 1000;
  mainRect = { left: 280, top: 0, right: 1600, bottom: 1000, width: 1320, height: 1000 };
  window.__CLAUDE_AURA_STATE__.ensure();
  assert.equal(document.documentElement.dataset.claudeAuraViewport, "wide");
  assert.deepEqual(studioLayers.map((item) => item.style.getPropertyValue("display")), ["", "none", "none", "none", "", "none", "none", "none"],
    "Light/new-chat/wide gates left a normal-only or context-incompatible layer visible");
  assert.equal(studioLayers[0].children[0].style.getPropertyValue("left"), "calc(100% + -5%)");
  assert.equal(studioLayers[0].children[0].style.getPropertyValue("top"), "calc(100% + -10%)");
  assert.equal(studioLayers[0].children[0].style.getPropertyValue("transform"), "translate(-75%, -80%) scale(0.8)");
  mediaDark = true;
  for (const listener of mediaListeners) listener({ matches: true });
  assert.deepEqual(studioLayers.map((item) => item.style.getPropertyValue("display")), ["", "none", "", "none", "none", "none", "none", "none"],
    "Dark/new-chat/wide mode switching exposed a ghosted light layer");

  window.innerWidth = 1200;
  window.innerHeight = 800;
  mainRect = { left: 220, top: 0, right: 1200, bottom: 800, width: 980, height: 800 };
  hasConversationMessage = true;
  window.__CLAUDE_AURA_STATE__.ensure();
  assert.equal(document.documentElement.dataset.claudeAuraContext, "conversation");
  assert.deepEqual(studioLayers.map((item) => item.style.getPropertyValue("display")), ["", "none", "none", "", "none", "", "none", "none"],
    "Dark/conversation/normal navigation did not atomically replace the new-chat scene");
  assert.equal(promptRoot["data-claude-aura-prompt"], undefined,
    "Prompt placement leaked from new-chat into a conversation");

  const sidebarBundle = await buildPayloadFromCompiled({
    ...studioRuntimeBase,
    settings: { ...studioRuntimeSettings, digest: "studio-v2-sidebar", backgroundScope: "sidebar" },
  });
  const injectSidebar = new Function(
    "window", "document", "MutationObserver", "setInterval", "clearInterval", "setTimeout", "clearTimeout",
    sidebarBundle.payload,
  );
  injectSidebar(window, document, FakeMutationObserver, setInterval, clearInterval, setTimeout, clearTimeout);
  studioBackdrop = document.getElementById("claude-aura-backdrop");
  studioLayers = studioBackdrop.children
    .filter((child) => String(child.class ?? "").includes("claude-aura-theme-art-layer"));
  assert.equal(studioBackdrop.dataset.artScope, "sidebar",
    "Sidebar scope was not persisted to the renderer");
  assert.equal(document.documentElement.style.getPropertyValue("--aura-main-start"), "220px",
    "Sidebar artwork did not retain the live renderer's measured sidebar boundary");
  assert(document.getElementById("claude-aura-style").textContent.includes('[data-art-scope="sidebar"]'),
    "The sidebar-scoped payload omitted its fail-closed clipping rule");
  assert.equal(studioLayers.length, STUDIO_MAX_LAYERS,
    "Sidebar reinjection duplicated or dropped Studio artwork layers");
  assert.equal(document.body.children.filter((child) => child.id === "claude-aura-backdrop").length, 1,
    "Sidebar reinjection left more than one owned backdrop");

  const fullWindowBundle = await buildPayloadFromCompiled({
    ...studioRuntimeBase,
    settings: { ...studioRuntimeSettings, digest: "studio-v2-full-window", backgroundScope: "full-window" },
  });
  const injectFullWindow = new Function(
    "window", "document", "MutationObserver", "setInterval", "clearInterval", "setTimeout", "clearTimeout",
    fullWindowBundle.payload,
  );
  injectFullWindow(window, document, FakeMutationObserver, setInterval, clearInterval, setTimeout, clearTimeout);
  studioBackdrop = document.getElementById("claude-aura-backdrop");
  studioLayers = studioBackdrop.children
    .filter((child) => String(child.class ?? "").includes("claude-aura-theme-art-layer"));
  assert.equal(studioBackdrop.dataset.artScope, "full-window", "Full-window scope was not persisted to the renderer");
  assert.equal(studioLayers.length, STUDIO_MAX_LAYERS,
    "Scope reinjection duplicated or dropped Studio artwork layers");
  assert.equal(document.body.children.filter((child) => child.id === "claude-aura-backdrop").length, 1,
    "Scope reinjection left more than one owned backdrop");
  assert.equal(intervals.size, 1, "Schema-v2 reinjection left a duplicate renderer timer");
  assert.equal(observers.size, 1, "Schema-v2 reinjection left a duplicate mutation observer");
  assert.equal((studioRuntimeBundle.payload.match(/data:image\/webp;base64/g) ?? []).length, 1,
    "Repeated layer artwork was embedded more than once in the payload");
  const studioArtworkUrls = [
    studioDataUrl,
    studioRuntimeBase.settings.brandWordmark?.lightDataUrl,
    studioRuntimeBase.settings.brandWordmark?.darkDataUrl,
  ].filter(Boolean);
  const studioChromeBytes = Buffer.byteLength(
    studioArtworkUrls.reduce((payload, dataUrl) => payload.replace(dataUrl, ""), studioRuntimeBundle.payload),
    "utf8",
  );
  assert(studioChromeBytes < 65_000,
    `Eight-layer Studio renderer chrome exceeded the 65 KB budget: ${studioChromeBytes} bytes`);

  mediaDark = false;
  hasConversationMessage = false;
  for (const listener of mediaListeners) listener({ matches: false });
  promptRoot.remove();
  composerEditors = [];
  main.querySelectorAll = () => [];
  main.querySelector = () => null;

  assert.equal(document.documentElement.dataset.claudeAuraEffectiveMode, "light",
    "System appearance did not return to light after the artwork-gating checks");

  const gatedCompiled = await compileTheme({
    config: { ...DEFAULT_CONFIG, theme: "anime-twilight" },
  });
  const gatedLayer = {
    dataUrl: "data:image/webp;base64,UklGRg==",
    position: "center",
    size: "cover",
    mobile: "keep",
    opacity: 0.5,
    mask: "none",
    role: "decoration",
    contextOverrides: null,
  };
  const gatedSettings = {
    ...gatedCompiled.settings,
    digest: "appearance-gate-system",
    artLayers: [
      { ...gatedLayer, appearance: "light" },
      { ...gatedLayer, appearance: "dark" },
      { ...gatedLayer, appearance: "dark", contextOverrides: { other: { hidden: true } } },
    ],
  };
  const gatedBundle = await buildPayloadFromCompiled({ ...gatedCompiled, settings: gatedSettings });
  const injectGated = new Function(
    "window", "document", "MutationObserver", "setInterval", "clearInterval", "setTimeout", "clearTimeout",
    gatedBundle.payload,
  );
  injectGated(window, document, FakeMutationObserver, setInterval, clearInterval, setTimeout, clearTimeout);
  let gatedLayers = document.getElementById("claude-aura-backdrop").children
    .filter((child) => String(child.class ?? "").includes("claude-aura-theme-art-layer"));
  assert.deepEqual(gatedLayers.map((layer) => layer.style.getPropertyValue("display")), ["", "none", "none"],
    "Light mode did not gate appearance-specific layers or preserve context hiding");
  mediaDark = true;
  for (const listener of mediaListeners) listener({ matches: true });
  assert.deepEqual(gatedLayers.map((layer) => layer.style.getPropertyValue("display")), ["none", "", "none"],
    "System appearance changes did not switch gated layers immediately");

  const forcedGatedBundle = await buildPayloadFromCompiled({
    ...gatedCompiled,
    settings: { ...gatedSettings, appearance: "dark", digest: "appearance-gate-forced-dark" },
  });
  const injectForcedGated = new Function(
    "window", "document", "MutationObserver", "setInterval", "clearInterval", "setTimeout", "clearTimeout",
    forcedGatedBundle.payload,
  );
  injectForcedGated(window, document, FakeMutationObserver, setInterval, clearInterval, setTimeout, clearTimeout);
  gatedLayers = document.getElementById("claude-aura-backdrop").children
    .filter((child) => String(child.class ?? "").includes("claude-aura-theme-art-layer"));
  assert.deepEqual(gatedLayers.map((layer) => layer.style.getPropertyValue("display")), ["none", "", "none"],
    "Forced Dark did not apply the same artwork appearance gate");
  assert.equal(mediaListeners.size, 0, "Forced artwork appearance retained the System media listener");
  mediaDark = false;

  const forcedDarkBundle = await buildPayload({
    config: { ...DEFAULT_CONFIG, theme: "study-library", appearance: "dark" },
  });
  const injectForcedDark = new Function(
    "window", "document", "MutationObserver", "setInterval", "clearInterval", "setTimeout", "clearTimeout",
    forcedDarkBundle.payload,
  );
  injectForcedDark(window, document, FakeMutationObserver, setInterval, clearInterval, setTimeout, clearTimeout);
  assert.equal(document.documentElement.dataset.claudeAuraAppearance, "dark");
  assert.equal(document.documentElement.dataset.claudeAuraEffectiveMode, "dark");
  assert.equal(mediaListeners.size, 0, "Forced appearance retained the System media listener");

  const framedBundle = await buildPayload({
    config: { ...DEFAULT_CONFIG, theme: "default", imagePosition: "12.5% 87.5%", imageZoom: 1.4 },
  });
  const injectFramed = new Function(
    "window",
    "document",
    "MutationObserver",
    "setInterval",
    "clearInterval",
    "setTimeout",
    "clearTimeout",
    framedBundle.payload,
  );
  injectFramed(window, document, FakeMutationObserver, setInterval, clearInterval, setTimeout, clearTimeout);
  assert.equal(document.documentElement.style.getPropertyValue("--aura-image-position"), "12.5% 87.5%");
  assert.equal(document.documentElement.style.getPropertyValue("--aura-image-scale"), "1.4");
  assert.equal(
    document.getElementById("claude-aura-backdrop").children
      .filter((child) => String(child.class ?? "").includes("claude-aura-theme-art-layer")).length,
    0,
    "Switching from layered artwork to a legacy theme left stale layers",
  );
  assert.equal(intervals.size, 1, "Framed background injection left a duplicate renderer timer");
  assert.equal(observers.size, 1, "Framed background injection left a duplicate mutation observer");

  const writesAfterSwitch = document.documentElement.style.setCalls;
  for (let iteration = 0; iteration < 10; iteration += 1) window.__CLAUDE_AURA_STATE__.ensure();
  assert.equal(document.documentElement.style.setCalls, writesAfterSwitch, "Clean ensures rewrote root image values");

  const experimentalCompiled = await compileTheme({
    config: { ...DEFAULT_CONFIG, theme: "cartoon-studio" },
  });
  const experimentalBundle = await buildPayloadFromCompiled(experimentalCompiled, {
    experimentalCode: {
      factory: createExperimentalCodeAdapter,
      descriptor: createExperimentalCodeDescriptor(experimentalCompiled.theme),
    },
  });
  assert.match(experimentalBundle.payload, /const \$w=window,\$d=document/,
    "Only the source experiment may compact its repeated browser-global references");
  assert(!experimentalBundle.payload.includes("__AURA_CODE_WINDOW__")
    && !experimentalBundle.payload.includes("__AURA_CODE_DOCUMENT__"),
  "Experimental alias placeholders must not survive payload compilation");
  const injectExperimental = new Function(
    "window",
    "document",
    "MutationObserver",
    "setInterval",
    "clearInterval",
    "setTimeout",
    "clearTimeout",
    experimentalBundle.payload,
  );
  const codeSheets = () => document.head.children.filter((child) =>
    child.tagName === "STYLE"
      && child.textContent.startsWith("@media(forced-colors:none)"));

  window.location = { href: "https://claude.ai/code" };
  injectExperimental(
    window,
    document,
    FakeMutationObserver,
    setInterval,
    clearInterval,
    setTimeout,
    clearTimeout,
  );
  assert.equal(sidebar["data-aura-code"], "v1n",
    "The full experimental renderer must mark one visible Code navigation surface");
  assert.equal(main["data-aura-code"], "v1c",
    "The full experimental renderer must mark one visible Code canvas");
  assert.equal(codeSheets().length, 1, "The Code route must commit exactly one owned sheet");
  const cartoonSheet = codeSheets()[0];
  assert.match(cartoonSheet.textContent,
    /box-shadow:inset 0 0 0 2px hsl\(25 28% 18%\/.42\)!important/,
    "Cartoon Studio must project its ink frame through the compiled payload");
  assert.equal(document.getElementById("claude-aura-style"), null,
    "Code must suppress the broad Chat stylesheet");
  assert.equal(document.getElementById("claude-aura-backdrop"), null,
    "Code must suppress Chat artwork");
  assert.equal(document.documentElement.classList.contains("claude-aura"), false,
    "Code must clear the broad Chat root class");

  const editorialCompiled = await compileTheme({
    config: { ...DEFAULT_CONFIG, theme: "japanese-film-editorial" },
  });
  const editorialBundle = await buildPayloadFromCompiled(editorialCompiled, {
    experimentalCode: {
      factory: createExperimentalCodeAdapter,
      descriptor: createExperimentalCodeDescriptor(editorialCompiled.theme),
    },
  });
  const injectEditorial = new Function(
    "window",
    "document",
    "MutationObserver",
    "setInterval",
    "clearInterval",
    "setTimeout",
    "clearTimeout",
    editorialBundle.payload,
  );
  const cartoonState = window.__CLAUDE_AURA_STATE__;
  injectEditorial(
    window,
    document,
    FakeMutationObserver,
    setInterval,
    clearInterval,
    setTimeout,
    clearTimeout,
  );
  assert.notEqual(window.__CLAUDE_AURA_STATE__, cartoonState,
    "A different experimental theme must replace the prior renderer lifecycle");
  assert.equal(cartoonSheet.isConnected, false,
    "Theme replacement must remove the prior exact Code sheet object");
  assert.equal(codeSheets().length, 1,
    "Theme replacement must retain exactly one Code sheet");
  const editorialSheet = codeSheets()[0];
  assert.match(editorialSheet.textContent,
    /box-shadow:inset -3px 0 0 hsl\(10 56% 36%\/.46\)!important/,
    "Theme replacement must publish the new editorial material cue");
  assert.doesNotMatch(editorialSheet.textContent,
    /inset 0 0 0 2px hsl\(25 28% 18%\/.42\)/,
    "Theme replacement must not retain the prior ink frame");
  assert.equal(sidebar["data-aura-code"], "v1n");
  assert.equal(main["data-aura-code"], "v1c");
  assert.equal(primaryAction["data-aura-code"], undefined,
    "Theme replacement must leave inner Code controls native");
  assert.equal(document.getElementById("claude-aura-style"), null);
  assert.equal(document.getElementById("claude-aura-backdrop"), null);

  injectExperimental(
    window,
    document,
    FakeMutationObserver,
    setInterval,
    clearInterval,
    setTimeout,
    clearTimeout,
  );
  assert.equal(editorialSheet.isConnected, false);
  assert.equal(codeSheets().length, 1);
  assert.match(codeSheets()[0].textContent,
    /box-shadow:inset 0 0 0 2px hsl\(25 28% 18%\/.42\)!important/,
    "A second replacement must restore the selected Cartoon Studio cue");

  const nativeSidebarRemoveAttribute = sidebar.removeAttribute.bind(sidebar);
  let routeCleanupBlocked = true;
  sidebar.removeAttribute = (name) => {
    if (routeCleanupBlocked && name === "data-aura-code") {
      throw new Error("simulated transient Code marker cleanup failure");
    }
    nativeSidebarRemoveAttribute(name);
  };
  window.location.href = "https://claude.ai/";
  window.__CLAUDE_AURA_STATE__.ensure();
  assert.equal(sidebar["data-aura-code"], "v1n",
    "A transient route cleanup failure must retain its retryable marker");
  assert.equal(main["data-aura-code"], undefined,
    "Successful parts of a failed Code cleanup may complete without starting Chat");
  assert.equal(codeSheets().length, 0,
    "A transient marker failure must still release Aura's identity-owned Code sheet");
  assert.equal(document.documentElement.classList.contains("claude-aura"), false,
    "Chat must stay native until Code cleanup fully succeeds");
  assert.equal(document.getElementById("claude-aura-style"), null,
    "Chat styling must not overlap a cleanup-pending Code transaction");
  assert.equal(document.getElementById("claude-aura-backdrop"), null,
    "Chat artwork must not overlap a cleanup-pending Code transaction");
  assert.equal(timeouts.size, 1,
    "A transient route cleanup failure must schedule exactly one bounded retry");
  routeCleanupBlocked = false;
  for (const [id, timer] of [...timeouts]) {
    timeouts.delete(id);
    timer.callback();
  }
  sidebar.removeAttribute = nativeSidebarRemoveAttribute;
  assert.equal(sidebar["data-aura-code"], undefined,
    "Returning to Chat must remove the Code navigation marker");
  assert.equal(main["data-aura-code"], undefined,
    "Returning to Chat must remove the Code canvas marker");
  assert.equal(codeSheets().length, 0, "Returning to Chat must remove the Code sheet");
  assert.equal(document.documentElement.classList.contains("claude-aura"), true,
    "Returning to Chat must restore the normal Aura root");
  assert(document.getElementById("claude-aura-style"),
    "Returning to Chat must restore the normal Aura stylesheet");
  assert(document.getElementById("claude-aura-backdrop"),
    "Returning to Chat must restore the normal Aura backdrop");

  assert.equal(window.__CLAUDE_AURA_STATE__.cleanup(), true,
    "Original look from Chat must complete renderer cleanup");
  assert.equal(document.documentElement.classList.contains("claude-aura"), false);
  assert.equal(document.getElementById("claude-aura-style"), null);
  assert.equal(document.getElementById("claude-aura-backdrop"), null);

  const codeEditor = new FakeElement("div");
  codeEditor.setAttribute("contenteditable", "true");
  main.appendChild(codeEditor);
  window.location.href = "https://claude.ai/code/session-fixture";
  injectExperimental(
    window,
    document,
    FakeMutationObserver,
    setInterval,
    clearInterval,
    setTimeout,
    clearTimeout,
  );
  assert.equal(sidebar["data-aura-code"], "v1n");
  assert.equal(main["data-aura-code"], "v1c");
  assert.equal(codeEditor["data-aura-code"], undefined,
    "The full experimental renderer must leave generic editable elements native");
  assert.equal(codeSheets().length, 1);

  const stateBeforeBlockedReplacement = window.__CLAUDE_AURA_STATE__;
  const nativeSessionSidebarRemoveAttribute = sidebar.removeAttribute.bind(sidebar);
  let replacementCleanupBlocked = true;
  let replacementCleanupAttempts = 0;
  sidebar.removeAttribute = (name) => {
    if (replacementCleanupBlocked && name === "data-aura-code") {
      replacementCleanupAttempts += 1;
      throw new Error("simulated persistent Code replacement cleanup failure");
    }
    nativeSessionSidebarRemoveAttribute(name);
  };
  injectExperimental(
    window,
    document,
    FakeMutationObserver,
    setInterval,
    clearInterval,
    setTimeout,
    clearTimeout,
  );
  assert.equal(replacementCleanupAttempts, 1,
    "A blocked replacement must delegate its first cleanup attempt to the live renderer");
  assert.equal(window.__CLAUDE_AURA_STATE__, stateBeforeBlockedReplacement,
    "A still-pending replacement must retain the live renderer that owns the retry path");
  assert.equal(sidebar["data-aura-code"], "v1n");
  assert.equal(main["data-aura-code"], undefined);
  assert.equal(codeSheets().length, 0);
  assert.equal(timeouts.size, 1,
    "The retained renderer must own exactly one bounded replacement cleanup retry");
  replacementCleanupBlocked = false;
  for (const [id, timer] of [...timeouts]) {
    timeouts.delete(id);
    timer.callback();
  }
  assert.equal(window.__CLAUDE_AURA_STATE__, undefined,
    "A successful retained cleanup retry must retire the prior renderer");
  sidebar.removeAttribute = nativeSessionSidebarRemoveAttribute;
  injectExperimental(
    window,
    document,
    FakeMutationObserver,
    setInterval,
    clearInterval,
    setTimeout,
    clearTimeout,
  );
  assert.notEqual(window.__CLAUDE_AURA_STATE__, stateBeforeBlockedReplacement,
    "A later explicit replacement may install after native restoration succeeds");
  assert.equal(sidebar["data-aura-code"], "v1n",
    "The later explicit replacement must restyle only after native restoration");
  assert.equal(main["data-aura-code"], "v1c");
  assert.equal(codeSheets().length, 1);

  const experimentalStateBeforeStable = window.__CLAUDE_AURA_STATE__;
  [...observers][0].callback([{ target: main, type: "childList" }]);
  assert.equal(timeouts.size, 1,
    "The experimental renderer fixture must have one queued structural recheck");
  injectFramed(
    window,
    document,
    FakeMutationObserver,
    setInterval,
    clearInterval,
    setTimeout,
    clearTimeout,
  );
  assert.notEqual(window.__CLAUDE_AURA_STATE__, experimentalStateBeforeStable,
    "A stable renderer must replace an experimental renderer only after owned cleanup");
  assert.equal(sidebar["data-aura-code"], undefined,
    "Experimental to stable replacement must restore the Code navigation marker");
  assert.equal(main["data-aura-code"], undefined,
    "Experimental to stable replacement must restore the Code canvas marker");
  assert.equal(codeSheets().length, 0,
    "Experimental to stable replacement must remove the identity-owned Code sheet");
  assert.equal(timeouts.size, 0,
    "Experimental to stable replacement must cancel the retired renderer's queued callback");
  assert.equal(window.__CLAUDE_AURA_STATE__.cleanup(), true,
    "Original look after a stable replacement must retire the stable renderer");
  assert.equal(window.__CLAUDE_AURA_STATE__, undefined);
  assert.equal(sidebar["data-aura-code"], undefined);
  assert.equal(main["data-aura-code"], undefined);
  assert.equal(codeSheets().length, 0);

  injectExperimental(
    window,
    document,
    FakeMutationObserver,
    setInterval,
    clearInterval,
    setTimeout,
    clearTimeout,
  );
  assert.equal(sidebar["data-aura-code"], "v1n");
  assert.equal(main["data-aura-code"], "v1c");
  assert.equal(codeSheets().length, 1);

  const replacementBody = new FakeElement("body");
  const replacementSidebar = replacementBody.appendChild(new FakeElement("aside"));
  const replacementMain = replacementBody.appendChild(new FakeElement("main"));
  document.body.remove();
  document.body = replacementBody;
  document.documentElement.appendChild(replacementBody);
  sidebarCandidates = [replacementSidebar];
  mainCandidates = [replacementMain];
  [...observers][0].callback([{ target: document.documentElement, type: "childList" }]);
  assert.equal(timeouts.size, 1,
    "Replacing the Code body must schedule one bounded structural recheck");
  for (const [id, timer] of [...timeouts]) {
    timeouts.delete(id);
    timer.callback();
  }
  assert.equal(sidebar["data-aura-code"], undefined);
  assert.equal(main["data-aura-code"], undefined);
  assert.equal(replacementSidebar["data-aura-code"], "v1n");
  assert.equal(replacementMain["data-aura-code"], "v1c");

  const codeDialog = new FakeElement("section");
  codeDialog.setAttribute("role", "alertdialog");
  replacementMain.appendChild(codeDialog);
  assert.equal(timeouts.size, 0);
  [...observers][0].callback([{ target: replacementMain, type: "childList" }]);
  assert.equal(timeouts.size, 1,
    "A Code mutation must schedule one bounded structural recheck");
  for (const [id, timer] of [...timeouts]) {
    timeouts.delete(id);
    timer.callback();
  }
  assert.equal(replacementSidebar["data-aura-code"], undefined,
    "A newly visible safety UI must automatically roll back the complete Code transaction");
  assert.equal(replacementMain["data-aura-code"], undefined);
  assert.equal(codeSheets().length, 0);
  codeDialog.remove();
  [...observers][0].callback([{ target: replacementMain, type: "childList" }]);
  assert.equal(timeouts.size, 1);
  for (const [id, timer] of [...timeouts]) {
    timeouts.delete(id);
    timer.callback();
  }
  assert.equal(replacementSidebar["data-aura-code"], "v1n",
    "A clean Code structure must be eligible for reapplication");
  assert.equal(replacementMain["data-aura-code"], "v1c");
  assert.equal(codeSheets().length, 1);
  const stateBeforeCleanupRetry = window.__CLAUDE_AURA_STATE__;
  const nativeReplacementRemoveAttribute = replacementSidebar.removeAttribute.bind(replacementSidebar);
  let originalCleanupBlocked = true;
  replacementSidebar.removeAttribute = (name) => {
    if (originalCleanupBlocked && name === "data-aura-code") {
      throw new Error("simulated transient Original-look cleanup failure");
    }
    nativeReplacementRemoveAttribute(name);
  };
  assert.equal(stateBeforeCleanupRetry.cleanup(), false,
    "Original look must report cleanup-pending instead of abandoning native restoration");
  assert.equal(window.__CLAUDE_AURA_STATE__, stateBeforeCleanupRetry,
    "Cleanup-pending must retain the renderer-owned retry path");
  assert.equal(window.__CLAUDE_AURA_DISABLED__, false,
    "Cleanup-pending must not disable the retained renderer");
  assert.equal(replacementSidebar["data-aura-code"], "v1n");
  assert.equal(replacementMain["data-aura-code"], undefined);
  assert.equal(timeouts.size, 1,
    "Original look must schedule exactly one bounded cleanup retry");
  originalCleanupBlocked = false;
  for (const [id, timer] of [...timeouts]) {
    timeouts.delete(id);
    timer.callback();
  }
  replacementSidebar.removeAttribute = nativeReplacementRemoveAttribute;
  assert.equal(window.__CLAUDE_AURA_STATE__, undefined,
    "A successful Original-look retry must retire the renderer state");
  assert.equal(sidebar["data-aura-code"], undefined,
    "Original look from Code must remove the Code navigation marker");
  assert.equal(main["data-aura-code"], undefined,
    "Original look from Code must remove the Code canvas marker");
  assert.equal(replacementSidebar["data-aura-code"], undefined);
  assert.equal(replacementMain["data-aura-code"], undefined);
  assert.equal(codeEditor["data-aura-code"], undefined,
    "Original look from Code must leave the active-session editor unmarked");
  assert.equal(codeSheets().length, 0, "Original look from Code must remove the Code sheet");
  codeEditor.remove();
  assert.equal(sidebar["data-claude-aura-sidebar"], undefined);
  assert.equal(primaryAction["data-aura-role"], undefined);
  assert.equal(main["data-claude-aura-main-canvas"], undefined);
  assert.equal(
    walk(document.documentElement).filter((element) => Object.hasOwn(element, "data-aura-role")).length,
    0,
    "Cleanup must remove every live semantic chrome role",
  );
  assert.equal(
    walk(document.documentElement).filter((element) => Object.hasOwn(element, "data-aura-bg")).length,
    0,
    "Cleanup must remove every paired label paint marker",
  );
  assert.equal(
    walk(document.documentElement).filter((element) => Object.hasOwn(element, "data-aura-f")).length,
    0,
    "Cleanup must remove every paired label foreground marker",
  );
  assert.equal(intervals.size, 0);
  assert.equal(timeouts.size, 0);
  assert.equal(observers.size, 0);
  assert.equal(document.getElementById("claude-aura-style"), null);
  assert.equal(document.getElementById("claude-aura-backdrop"), null);
  assert.equal(document.documentElement.style.getPropertyValue("--aura-image-scale"), "");
  assert.equal(document.documentElement.dataset.claudeAuraAppearance, undefined);
  assert.equal(document.documentElement.dataset.claudeAuraEffectiveMode, undefined);
  assert.equal(document.documentElement.dataset.claudeAuraContext, undefined);
  assert.equal(mediaListeners.size, 0);
  assert.equal(forcedColorListeners.size, 0);
  assert.equal([...windowListeners.values()].reduce((total, listeners) => total + listeners.size, 0), 0);
  assert.equal(navigationListeners.size, 0);
  assert.equal([...documentListeners.values()].reduce((total, listeners) => total + listeners.size, 0), 0);
  assert.equal(window.__CLAUDE_AURA_STATE__, undefined);
});

runIfMain(import.meta.url);
