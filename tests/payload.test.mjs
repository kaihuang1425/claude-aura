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
test("compiled payload uses one stable root attribute and active-theme-only artwork", async () => {
  const rendererSource = await fs.readFile(path.join(PROJECT_ROOT, "assets", "renderer-inject.js"), "utf8");
  assert.match(rendererSource, /const imageCssValue =/);
  assert.match(rendererSource, /const artCssValue =/);
  assert.match(rendererSource, /attributeFilter:/);
  assert(!/observe\(document\.documentElement,\s*\{\s*childList:\s*true,\s*subtree:\s*true/.test(rendererSource),
    "Renderer must not observe the entire Claude SPA subtree");
  const defaultBundle = await buildPayload({ configPath: path.join(PROJECT_ROOT, "config.example.json") });
  assert.equal(defaultBundle.settings.version, AURA_VERSION);
  assert.equal(defaultBundle.settings.theme, "default");
  assert.equal(defaultBundle.settings.appearance, "system");
  assert.equal(defaultBundle.settings.artDataUrl, null);
  assert.equal(defaultBundle.settings.artUnavailable, false);
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
  assert(defaultBundle.payload.includes("html.claude-aura [data-claude-aura-sidebar] svg{color:inherit !important}"),
    "Compiled themes must keep sidebar icons on the same semantic foreground as their labels");
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
    widthRatio: 0.76,
    offsetXRatio: -0.07,
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
    "Korean Idol Light and Dark must compile distinct wordmark assets",
  );
  assert.equal(koreanIdolBundle.settings.brandWordmark.minWidth, 136);
  assert.equal(koreanIdolBundle.settings.brandWordmark.width, 160);
  assert.match(koreanIdolBundle.css,
    /\[data-claude-aura-brand-image\][^{]*\{[^}]*visibility:\s*hidden/s,
    "Pending wordmarks must remain invisible until decode succeeds");
  assert.match(koreanIdolBundle.css,
    /\[data-claude-aura-brand-host="ready"\]\s*>\s*\[data-claude-aura-brand-image\][^{]*\{[^}]*visibility:\s*visible/s,
    "Only a decoded ready-state wordmark may become visible");

  for (const locale of ["en", "zh-CN", "zh-TW"]) {
    for (const theme of await listThemes({ locale })) {
      const bundle = await buildPayload({
        config: { ...DEFAULT_CONFIG, theme: theme.name },
        locale,
      });
      // Budgets: the chrome (CSS + code + metadata) stays under 65 KB so theme
      // switching remains instant; embedded decorative artwork has its own cap.
      const artBytes = (bundle.settings.artLayers ?? [])
        .reduce((total, layer) => total + Buffer.byteLength(layer.dataUrl, "utf8"), 0)
        + (bundle.settings.artDataUrl ? Buffer.byteLength(bundle.settings.artDataUrl, "utf8") : 0)
        + (bundle.settings.brandWordmark
          ? Buffer.byteLength(bundle.settings.brandWordmark.lightDataUrl, "utf8")
            + Buffer.byteLength(bundle.settings.brandWordmark.darkDataUrl, "utf8")
          : 0);
      const payloadBytes = Buffer.byteLength(bundle.payload, "utf8");
      assert(payloadBytes - artBytes < 65_000,
        `${locale}/${theme.name} chrome payload exceeds the 65 KB switching budget`);
      assert(artBytes < 1_400_000,
        `${locale}/${theme.name} embedded artwork exceeds the 1.4 MB decorative budget`);
      const embeddedArtworkCount = bundle.payload.match(/data:image\/(?:svg\+xml|webp|png|avif);base64/g)?.length ?? 0;
      const expectedArtwork = (theme.artworkLayers ? theme.artworkLayers.length : (theme.artwork ? 1 : 0)) + 2;
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
  const mediaListeners = new Set();
  const mediaQuery = {
    get matches() { return mediaDark; },
    addEventListener(type, listener) { if (type === "change") mediaListeners.add(listener); },
    removeEventListener(type, listener) { if (type === "change") mediaListeners.delete(listener); },
  };
  const windowListeners = new Map();
  const window = {
    innerWidth: 1440,
    innerHeight: 900,
    matchMedia: () => mediaQuery,
    getComputedStyle: (element) => ({
      display: element.style.getPropertyValue("display") || "block",
      visibility: "visible",
      translate: "none",
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
    136,
    160,
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
  const failedLightImage = brandImages()[0];
  assert.equal(failedLightImage.parentElement, first.row,
    "The overlay must use the wide header row instead of stretching the small native brand link");
  assert.equal(failedLightImage.src, bundle.settings.brandWordmark.lightDataUrl);
  assert.equal(failedLightImage.alt, "");
  assert.equal(failedLightImage["aria-hidden"], "true");
  assert.equal(failedLightImage.draggable, false);
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
  const lightImage = brandImages()[0];
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
  assert.equal(lightImage.isConnected, false,
    "Changing available header width must retire the stale wordmark geometry");
  const resizedLightImage = brandImages()[0];
  assert.equal(resizedLightImage.style.getPropertyValue("width"), "144px",
    "The replacement wordmark did not track the newly available header width");
  resizedLightImage.naturalWidth = 344;
  resizedLightImage.onload();
  resizedLightImage.resolveDecode();
  await Promise.resolve();
  await Promise.resolve();

  mediaDark = true;
  for (const listener of mediaListeners) listener({ matches: true });
  assert.equal(first.row["data-claude-aura-brand-host"], undefined,
    "Changing appearance must reveal the native logo while the replacement changes");
  assert.equal(first.host["data-claude-aura-brand-native"], undefined);
  assert.equal(lightImage.isConnected, false);
  assert.equal(brandImages().length, 1);
  const darkImage = brandImages()[0];
  assert.equal(darkImage.src, bundle.settings.brandWordmark.darkDataUrl);
  darkImage.naturalWidth = 344;
  darkImage.onload();
  darkImage.resolveDecode();
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(first.row["data-claude-aura-brand-host"], "ready");
  assert(first.search.isConnected && first.toggle.isConnected,
    "Dark replacement must preserve the same header controls");

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
});

test("renderer switching keeps one lifecycle and clean ensures avoid root rewrites", async () => {
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

    setAttribute(name, value) {
      this[name] = String(value);
    }

    removeAttribute(name) {
      delete this[name];
    }

    querySelector() {
      return null;
    }

    querySelectorAll() {
      return [];
    }
  }

  const document = {
    documentElement: new FakeElement("html"),
    head: new FakeElement("head"),
    body: new FakeElement("body"),
    createElement: (tagName) => new FakeElement(tagName),
  };
  document.documentElement.appendChild(document.head);
  document.documentElement.appendChild(document.body);
  const sidebar = new FakeElement("nav");
  sidebar.getBoundingClientRect = () => ({ left: 0, top: 0, right: 48, bottom: 900, width: 48, height: 900 });
  document.body.appendChild(sidebar);
  const main = new FakeElement("main");
  let mainRect = { left: 250, top: 0, right: 1440, bottom: 900, width: 1190, height: 900 };
  main.getBoundingClientRect = () => ({ ...mainRect });
  document.body.appendChild(main);
  document.querySelector = (selector) => selector === "main" ? main : null;
  const walk = (element) => [element, ...element.children.flatMap(walk)];
  document.querySelectorAll = (selector) => {
    if (selector === 'main,[role="main"]') return [main];
    if (selector.includes(".dframe-sidebar") || selector.includes("aside")) return [sidebar];
    const markers = [...selector.matchAll(/\[([^\]=]+)(?:=[^\]]+)?\]/g)].map((match) => match[1]);
    if (markers.some((name) => name.startsWith("data-claude-aura-"))) {
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
  const intervals = new Set();
  const timeouts = new Set();
  const observers = new Set();
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
  const mediaListeners = new Set();
  const mediaQuery = {
    get matches() { return mediaDark; },
    addEventListener(type, listener) { if (type === "change") mediaListeners.add(listener); },
    removeEventListener(type, listener) { if (type === "change") mediaListeners.delete(listener); },
  };
  const windowListeners = new Map();
  const navigationListeners = new Set();
  const window = {
    innerWidth: 1440,
    innerHeight: 900,
    matchMedia: () => mediaQuery,
    getComputedStyle: (element) => ({
      display: element.style.getPropertyValue("display") || "block",
      visibility: "visible",
      translate: "none",
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
  for (const theme of await listThemes()) {
    const bundle = await buildPayload({ config: { ...DEFAULT_CONFIG, theme: theme.name } });
    if (theme.name === "korean-idol") koreanPayload = bundle.payload;
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
    assert.equal(sidebar["data-claude-aura-sidebar"], "true",
      `${theme.name} did not mark the valid collapsed navigation rail`);
    assert.equal(mediaListeners.size, 1, `${theme.name} left duplicate appearance listeners`);
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
  const firstControl = new FakeElement("button");
  const secondControl = new FakeElement("button");
  composer.appendChild(editor);
  composer.appendChild(firstControl);
  composer.appendChild(secondControl);
  const promptRoot = new FakeElement("div");
  promptRoot.appendChild(composer);
  main.appendChild(promptRoot);
  let composerEditors = [editor];
  let hasConversationMessage = false;
  let composerBaseTop = 300;
  editor.getBoundingClientRect = () => ({ left: 430, top: composerBaseTop + 12, right: 930, bottom: composerBaseTop + 52, width: 500, height: 40 });
  composer.getBoundingClientRect = () => ({ left: 430, top: composerBaseTop, right: 1030, bottom: composerBaseTop + 100, width: 600, height: 100 });
  promptRoot.getBoundingClientRect = () => {
    const width = Number.parseFloat(promptRoot.style.getPropertyValue("--aura-prompt-width")) || 600;
    const x = Number.parseFloat(promptRoot.style.getPropertyValue("--aura-prompt-x")) || 0;
    const y = Number.parseFloat(promptRoot.style.getPropertyValue("--aura-prompt-y")) || 0;
    const left = mainRect.left + (mainRect.width / 2) - (width / 2) + x;
    return { left, top: composerBaseTop + y, right: left + width, bottom: composerBaseTop + y + 120, width, height: 120 };
  };
  composer.querySelectorAll = (selector) => selector === 'button,[role="button"],select'
    ? [firstControl, secondControl]
    : [];
  promptRoot.querySelectorAll = (selector) => selector === 'button,[role="button"],select'
    ? [firstControl, secondControl]
    : [];
  main.querySelectorAll = (selector) => selector.includes("textarea:not([readonly])") ? composerEditors : [];
  main.querySelector = () => hasConversationMessage ? new FakeElement("article") : null;

  const nativeLayoutBundle = await buildPayload({
    config: { ...DEFAULT_CONFIG, theme: "japanese-film-editorial" },
  });
  assert.equal(nativeLayoutBundle.settings.newChatLayout, null);
  const injectNativeLayout = new Function(
    "window", "document", "MutationObserver", "setInterval", "clearInterval", "setTimeout", "clearTimeout",
    nativeLayoutBundle.payload,
  );
  injectNativeLayout(window, document, FakeMutationObserver, setInterval, clearInterval, setTimeout, clearTimeout);
  assert.equal(document.documentElement.dataset.claudeAuraContext, "new-chat");
  assert.equal(promptRoot["data-claude-aura-prompt"], "new-chat",
    "A native new-chat composer must remain measurable before Studio authors a layout");
  assert.equal(promptRoot.style.getPropertyValue("--aura-prompt-width"), "",
    "Measuring a native new-chat composer must not author its width");
  assert.equal(promptRoot.style.getPropertyValue("--aura-prompt-x"), "",
    "Measuring a native new-chat composer must not author its horizontal position");
  assert.equal(promptRoot.style.getPropertyValue("--aura-prompt-y"), "",
    "Measuring a native new-chat composer must not author its vertical position");

  reinjectKorean(window, document, FakeMutationObserver, setInterval, clearInterval, setTimeout, clearTimeout);
  window.__CLAUDE_AURA_STATE__.ensure();
  assert.equal(document.documentElement.dataset.claudeAuraContext, "new-chat");
  assert.equal(promptRoot["data-claude-aura-prompt"], "new-chat");
  assert.equal(composer["data-claude-aura-prompt"], undefined,
    "Prompt placement must move the complete composer shell, not its inner field row");
  assert.equal(promptRoot.style.getPropertyValue("--aura-prompt-width"), "904.4px");
  const placed = promptRoot.getBoundingClientRect();
  assert(placed.left >= 266 && placed.right <= 1424, "Korean Idol prompt escaped the measured main canvas");
  assert.equal(composer.style.getPropertyValue("position"), "");
  assert.equal(composer.style.getPropertyValue("transform"), "");
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
  secondComposer.querySelectorAll = (selector) => selector === 'button,[role="button"],select' ? secondComposer.children.slice(1) : [];
  main.appendChild(secondComposer);
  composerEditors = [editor, secondEditor];
  window.__CLAUDE_AURA_STATE__.ensure();
  assert.equal(document.documentElement.dataset.claudeAuraContext, "other");
  assert.equal(promptRoot["data-claude-aura-prompt"], undefined);
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

  assert.equal(window.__CLAUDE_AURA_STATE__.cleanup(), true);
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
  assert.equal([...windowListeners.values()].reduce((total, listeners) => total + listeners.size, 0), 0);
  assert.equal(navigationListeners.size, 0);
  assert.equal(window.__CLAUDE_AURA_STATE__, undefined);
});

runIfMain(import.meta.url);
