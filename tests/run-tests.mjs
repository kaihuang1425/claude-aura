#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import {
  AURA_VERSION,
  buildPayload,
  compileTheme,
  DEFAULT_CONFIG,
  listThemes,
  normalizeLocale,
  PROJECT_ROOT,
  readThemeRegistry,
  REQUIRED_SEMANTIC_TOKENS,
  resolveArtwork,
  validateTheme,
  writeConfig,
} from "../scripts/theme-core.mjs";

const THEME_IDS = [
  "default",
  "japanese-film-editorial",
  "korean-prestige",
  "cartoon-studio",
  "anime-twilight",
  "study-library",
  "japanese-idol",
  "korean-idol",
];
const tests = [];
const test = (name, fn) => tests.push({ name, fn });

function hslToRgb(value) {
  const match = String(value).trim().match(/^([\d.]+)\s+([\d.]+)%\s+([\d.]+)%$/);
  assert(match, `Expected HSL components, received: ${value}`);
  const h = ((Number(match[1]) % 360) + 360) % 360;
  const s = Number(match[2]) / 100;
  const l = Number(match[3]) / 100;
  const c = (1 - Math.abs((2 * l) - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - (c / 2);
  const segment = Math.floor(h / 60);
  const values = [[c, x, 0], [x, c, 0], [0, c, x], [0, x, c], [x, 0, c], [c, 0, x]][segment];
  return values.map((channel) => channel + m);
}

function luminance(hsl) {
  return hslToRgb(hsl).map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4)
    .reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0);
}

function contrast(left, right) {
  const values = [luminance(left), luminance(right)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { cwd: PROJECT_ROOT, encoding: "utf8", ...options });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed (${result.status})\n${result.stdout}\n${result.stderr}`);
  }
  return result.stdout;
}

function zipEntryNames(bytes) {
  const endSignature = Buffer.from([0x50, 0x4b, 0x05, 0x06]);
  const endOffset = bytes.lastIndexOf(endSignature);
  assert(endOffset >= 0, "Release archive is missing its end-of-central-directory record");
  const entryCount = bytes.readUInt16LE(endOffset + 10);
  let offset = bytes.readUInt32LE(endOffset + 16);
  const names = [];
  for (let index = 0; index < entryCount; index += 1) {
    assert.equal(bytes.readUInt32LE(offset), 0x02014b50, "Release archive has an invalid central-directory entry");
    const nameLength = bytes.readUInt16LE(offset + 28);
    const extraLength = bytes.readUInt16LE(offset + 30);
    const commentLength = bytes.readUInt16LE(offset + 32);
    names.push(bytes.subarray(offset + 46, offset + 46 + nameLength).toString("utf8"));
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return names;
}

async function deliverableFiles(directory = PROJECT_ROOT, relativeDirectory = "") {
  const files = [];
  const excludedRoots = new Set([".agents", ".codex", ".git", "dist", "node_modules", "release", "theme_demo_previews"]);
  const excludedNames = new Set([".DS_Store", "Thumbs.db", "config.local.json", "state.json"]);
  // Supplied per-theme source kits are DIRECTORIES under themes/ — preserved on
  // disk and gitignored like the reference composites. Only the derived runtime
  // copies under assets/theme-art/ ship.
  const excludedPaths = new Set(["themes/customize_new_theme_prompt.md"]);
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const relativePath = relativeDirectory ? `${relativeDirectory}/${entry.name}` : entry.name;
    if (!relativeDirectory && excludedRoots.has(entry.name)) continue;
    if (excludedPaths.has(relativePath)) continue;
    if (relativeDirectory === "themes" && entry.isDirectory()) continue;
    if (relativePath === "docs/preview.png" || excludedNames.has(entry.name) || entry.name.startsWith(".tmp-") ||
        entry.name.includes(".corrupt-") ||
        entry.name.endsWith(".log") || entry.name.endsWith(".zip") || entry.name.endsWith(".sha256")) continue;
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await deliverableFiles(absolutePath, relativePath));
    else if (entry.isFile()) files.push(relativePath.replaceAll("\\", "/"));
  }
  return files;
}

test("registry exposes exactly Default plus the seven requested themes", async () => {
  const registry = await readThemeRegistry();
  const themes = await listThemes();
  assert.equal(registry.defaultTheme, "default");
  assert.deepEqual(themes.map((theme) => theme.name), THEME_IDS);
  assert.equal(new Set(themes.map((theme) => theme.name)).size, 8);
  assert.deepEqual(registry.legacyAliases, {
    midnight: "default",
    ember: "japanese-film-editorial",
    forest: "study-library",
    sakura: "japanese-idol",
  });
});

test("every theme provides complete semantic roles and a distinct component profile", async () => {
  const themes = await listThemes();
  const profiles = [];
  for (const theme of themes) {
    assert.equal(theme.variant, theme.name);
    assert(theme.swatches.length >= 3);
    assert(theme.typography.ui);
    assert(theme.typography.display);
    assert(theme.typography.body);
    assert(theme.typography.mono);
    for (const mode of ["light", "dark"]) {
      for (const token of REQUIRED_SEMANTIC_TOKENS) {
        assert(token in theme[mode].semantic, `${theme.name}/${mode} is missing ${token}`);
        assert(token in theme[mode].tokens, `${theme.name}/${mode} did not emit ${token}`);
        assert.match(theme[mode].semantic[token], /^\d{1,3}(?:\.\d+)?\s+\d{1,3}(?:\.\d+)?%\s+\d{1,3}(?:\.\d+)?%$/, `${theme.name}/${mode} emitted an invalid ${token}`);
        assert.equal(theme[mode].tokens[token], theme[mode].semantic[token], `${theme.name}/${mode} did not preserve ${token}`);
      }
      assert(theme[mode].wallpaper.surfaceAlpha >= 0.35);
      assert(theme[mode].wallpaper.sidebarAlpha >= 0.62);
      assert(theme[mode].wallpaper.artOpacity <= 0.46);
    }
    profiles.push(JSON.stringify({ typography: theme.typography, shape: theme.shape, effects: theme.effects }));
  }
  assert.equal(new Set(profiles).size, THEME_IDS.length, "Every theme must have a distinct typography/shape/effects profile");
  const baseCss = await fs.readFile(path.join(PROJECT_ROOT, "assets", "base.css"), "utf8");
  const variants = await fs.readFile(path.join(PROJECT_ROOT, "assets", "theme-variants.css"), "utf8");
  assert.match(baseCss, /border-radius:\s*var\(--aura-icon-radius\)/);
  const interactiveSelector = 'html.claude-aura :is(button, [role="button"], a, [role="link"], [role="tab"], [role="menuitem"], [role="option"])';
  assert(baseCss.includes(`${interactiveSelector} {`), "Shared interactive typography rule is missing");
  const controlSelector = 'html.claude-aura :is(button, [role="button"], [role="link"], [role="tab"], [role="menuitem"], [role="option"])';
  const controlStart = baseCss.indexOf(`${controlSelector},`);
  assert(controlStart >= 0, "Shared semantic-control rule is missing");
  const controlBody = baseCss.slice(controlStart, baseCss.indexOf("}", controlStart));
  assert.match(controlBody, /border-radius:\s*var\(--aura-control-radius\)/);
  for (const state of [":not([disabled]):not([aria-disabled=\"true\"]):hover", ":not([disabled]):not([aria-disabled=\"true\"]):active", ":is([disabled], [aria-disabled=\"true\"])"]) {
    assert(baseCss.includes(`${controlSelector}${state},`), `Shared semantic controls lack ${state} styling`);
    assert(!baseCss.includes(`${interactiveSelector}${state}`), `Bare prose links must not receive ${state} control styling`);
  }
  assert.match(baseCss, /:is\(hr, \[role="separator"\]\)/);
  for (const status of ["info", "success", "warning", "loading"]) assert(baseCss.includes(`[data-status="${status}"]`), `${status} status styling is missing`);
  assert.match(baseCss, /\[role="progressbar"\]/);
  assert.match(baseCss, /\[data-settings-panel\]/);
  assert.match(baseCss, /\[data-testid\*="workspace"\]/);
  assert.match(baseCss, /\[data-testid\*="quick-action"\]/);
  for (const id of THEME_IDS.slice(1)) {
    const selector = `html.claude-aura[data-claude-aura-theme="${id}"] :is(button, [role="button"], a, [role="link"], [role="tab"], [role="menuitem"], [role="option"]) :is(svg, [data-icon]) {`;
    assert(variants.includes(selector), `${id} lacks a complete interactive-role icon treatment`);
  }
});

test("all theme text, focus colours, and accents clear contrast guardrails", async () => {
  const failures = [];
  for (const theme of await listThemes()) {
    for (const mode of ["light", "dark"]) {
      const tokens = theme[mode].semantic;
      const checks = [
        ["primary", "--aura-text-primary", "--aura-background-primary", 7],
        ["secondary", "--aura-text-secondary", "--aura-panel-background", 4.5],
        ["muted", "--aura-text-muted", "--aura-panel-background", 4.5],
        ["accent", "--aura-accent-primary", "--aura-background-primary", 3],
        ["on-accent", "--aura-text-on-accent", "--aura-accent-primary", 4.5],
        ["sidebar", "--aura-sidebar-text-primary", "--aura-sidebar-background", 7],
        ["focus", "--aura-focus-ring", "--aura-background-primary", 3],
        ["focus-panel", "--aura-focus-ring", "--aura-panel-background", 3],
        ["focus-card", "--aura-focus-ring", "--aura-card-background", 3],
        ["sidebar-indicator", "--aura-sidebar-indicator", "--aura-sidebar-background", 3],
        ["destructive-card", "--aura-destructive", "--aura-card-background", 4.5],
        ["destructive-elevated", "--aura-destructive", "--aura-elevated-surface", 4.5],
        ["success-card", "--aura-success", "--aura-card-background", 4.5],
        ["success-elevated", "--aura-success", "--aura-elevated-surface", 4.5],
        ["warning-card", "--aura-warning", "--aura-card-background", 4.5],
        ["warning-elevated", "--aura-warning", "--aura-elevated-surface", 4.5],
        ["info-card", "--aura-info", "--aura-card-background", 4.5],
        ["info-elevated", "--aura-info", "--aura-elevated-surface", 4.5],
      ];
      for (const [label, foreground, background, minimum] of checks) {
        const ratio = contrast(tokens[foreground], tokens[background]);
        if (ratio < minimum) failures.push(`${theme.name}/${mode}: ${label} contrast ${ratio.toFixed(2)} is below ${minimum}:1`);
      }
    }
  }
  assert.equal(failures.length, 0, failures.join("\n"));
});

test("theme metadata localizes independently for English, Simplified Chinese, and Traditional Chinese", async () => {
  const [english, simplified, traditional] = await Promise.all([
    listThemes({ locale: "en" }),
    listThemes({ locale: "zh-CN" }),
    listThemes({ locale: "zh-TW" }),
  ]);
  assert.deepEqual(english.map((theme) => theme.name), THEME_IDS);
  assert.deepEqual(simplified.map((theme) => theme.name), THEME_IDS);
  assert.deepEqual(traditional.map((theme) => theme.name), THEME_IDS);
  assert.equal(english[0].label, "Default");
  assert.equal(simplified[0].label, "默认");
  assert.equal(traditional[0].label, "預設");
  assert.equal(normalizeLocale("zh-SG"), "zh-CN");
  assert.equal(normalizeLocale("zh-MO"), "zh-TW");
  assert.equal(normalizeLocale("zh_Hans_SG"), "zh-CN");
  assert.equal(normalizeLocale("zh_Hant_TW"), "zh-TW");
  assert.notEqual(simplified[1].description, traditional[1].description);
  for (const theme of [...simplified, ...traditional]) {
    assert(theme.label.trim());
    assert(theme.description.trim());
  }
});

test("Default is the persistent baseline and invalid saved IDs fall back safely", async () => {
  assert.equal(DEFAULT_CONFIG.theme, "default");
  const baseline = await compileTheme({
    configPath: path.join(PROJECT_ROOT, "config.example.json"),
    config: { ...DEFAULT_CONFIG, theme: "midnight" },
  });
  assert.equal(baseline.theme.name, "default");
  const unknown = await compileTheme({
    configPath: path.join(PROJECT_ROOT, "config.example.json"),
    config: { ...DEFAULT_CONFIG, theme: "missing-theme" },
  });
  assert.equal(unknown.theme.name, "default");
  assert.equal(unknown.settings.fallbackFrom, "missing-theme");
  assert.equal(unknown.effectiveConfig.theme, "default");
});

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
  assert.equal(defaultBundle.settings.artDataUrl, null);
  assert.equal(defaultBundle.settings.artUnavailable, false);
  assert.match(defaultBundle.css, /--aura-background-primary/);
  assert.match(defaultBundle.css, /data-claude-aura-theme="cartoon-studio"/);
  assert.match(defaultBundle.payload, /dataset\.claudeAuraTheme/);
  assert.match(defaultBundle.payload, /claude-aura-theme-art/);
  assert(!defaultBundle.payload.includes("__AURA_CSS_JSON__"));
  assert(!defaultBundle.payload.includes("__AURA_SETTINGS_JSON__"));
  new Function(defaultBundle.payload);

  const themed = await compileTheme({
    configPath: path.join(PROJECT_ROOT, "config.example.json"),
    config: { ...DEFAULT_CONFIG, theme: "anime-twilight" },
  });
  assert.match(themed.settings.artDataUrl, /^data:image\/svg\+xml;base64,/);
  assert.equal(themed.artwork.path.endsWith("anime-twilight.svg"), true);
  assert.equal(themed.settings.artUnavailable, false);

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
        + (bundle.settings.artDataUrl ? Buffer.byteLength(bundle.settings.artDataUrl, "utf8") : 0);
      const payloadBytes = Buffer.byteLength(bundle.payload, "utf8");
      assert(payloadBytes - artBytes < 65_000,
        `${locale}/${theme.name} chrome payload exceeds the 65 KB switching budget`);
      assert(artBytes < 1_400_000,
        `${locale}/${theme.name} embedded artwork exceeds the 1.4 MB decorative budget`);
      const embeddedArtworkCount = bundle.payload.match(/data:image\/(?:svg\+xml|webp|png|avif);base64/g)?.length ?? 0;
      const expectedArtwork = theme.artworkLayers ? theme.artworkLayers.length : (theme.artwork ? 1 : 0);
      assert.equal(embeddedArtworkCount, expectedArtwork, `${locale}/${theme.name} did not embed exactly its active artwork`);
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
      this.textContent = "";
      this.innerHTML = "";
    }

    appendChild(child) {
      child.remove();
      this.children.push(child);
      child.parentNode = this;
      return child;
    }

    prepend(child) {
      child.remove();
      this.children.unshift(child);
      child.parentNode = this;
      return child;
    }

    remove() {
      if (!this.parentNode) return;
      this.parentNode.children = this.parentNode.children.filter((child) => child !== this);
      this.parentNode = null;
    }

    contains(candidate) {
      return candidate === this || this.children.some((child) => child.contains(candidate));
    }

    setAttribute(name, value) {
      this[name] = String(value);
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

  const window = {};
  for (const theme of await listThemes()) {
    const bundle = await buildPayload({ config: { ...DEFAULT_CONFIG, theme: theme.name } });
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
    assert.equal(intervals.size, 1, `${theme.name} left duplicate renderer timers`);
    assert.equal(observers.size, 1, `${theme.name} left duplicate mutation observers`);
  }

  const writesAfterSwitch = document.documentElement.style.setCalls;
  for (let iteration = 0; iteration < 10; iteration += 1) window.__CLAUDE_AURA_STATE__.ensure();
  assert.equal(document.documentElement.style.setCalls, writesAfterSwitch, "Clean ensures rewrote root image values");

  assert.equal(window.__CLAUDE_AURA_STATE__.cleanup(), true);
  assert.equal(intervals.size, 0);
  assert.equal(timeouts.size, 0);
  assert.equal(observers.size, 0);
  assert.equal(document.getElementById("claude-aura-style"), null);
  assert.equal(document.getElementById("claude-aura-backdrop"), null);
  assert.equal(window.__CLAUDE_AURA_STATE__, undefined);
});

test("bundled artwork is isolated, lightweight, pointer-safe, and free of embedded UI text", async () => {
  const themes = await listThemes();
  assert.equal(themes.filter((theme) => theme.artwork || theme.artworkLayers).length, 7);
  const validateSvgArtwork = async (themeName, artworkPath) => {
    const stat = await fs.stat(artworkPath);
    const source = await fs.readFile(artworkPath, "utf8");
    assert(stat.isFile() && stat.size > 0 && stat.size < 100_000, `${themeName} artwork size is unexpected`);
    assert.match(source, /<svg\b/);
    assert.match(source, /pointer-events="none"/);
    assert(!/<text\b/i.test(source), `${themeName} artwork contains embedded text`);
    assert(!/(?:https?:\/\/(?!www\.w3\.org\/2000\/svg)|data:|(?:xlink:)?href=)/i.test(source),
      `${themeName} artwork contains an external or embedded resource`);
  };
  const validateRasterArtwork = async (themeName, artworkPath) => {
    const stat = await fs.stat(artworkPath);
    assert(stat.isFile() && stat.size > 0 && stat.size < 400_000, `${themeName} raster artwork size is unexpected`);
    const bytes = await fs.readFile(artworkPath);
    assert(bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP",
      `${themeName} raster artwork must be WebP`);
  };
  for (const theme of themes.filter((item) => item.artwork)) {
    await validateSvgArtwork(theme.name, path.join(PROJECT_ROOT, theme.artwork.path));
  }
  for (const theme of themes.filter((item) => item.artworkLayers)) {
    for (const layer of theme.artworkLayers) {
      const artworkPath = path.join(PROJECT_ROOT, layer.path);
      if (layer.path.endsWith(".svg")) await validateSvgArtwork(theme.name, artworkPath);
      else await validateRasterArtwork(theme.name, artworkPath);
    }
  }
  const baseCss = await fs.readFile(path.join(PROJECT_ROOT, "assets", "base.css"), "utf8");
  assert.match(baseCss, /#claude-aura-backdrop \*/);
  assert.match(baseCss, /pointer-events: none !important/);
  assert.match(baseCss, /prefers-contrast: more/);
  assert.match(baseCss, /forced-colors: active/);
  assert.equal(await resolveArtwork({ artwork: { path: "assets/theme-art/not-present.svg" } }), null);
  await assert.rejects(resolveArtwork({ artwork: { path: "themes/default.json" } }), /inside/);
  assert.match(baseCss, /prefers-reduced-motion: reduce/);
});

test("config writes are atomic, aliases migrate, and theme choice persists", async () => {
  const temporary = await fs.mkdtemp(path.join(PROJECT_ROOT, "tests", ".tmp-"));
  try {
    const configPath = path.join(temporary, "config.json");
    await writeConfig(configPath, { ...DEFAULT_CONFIG, theme: "midnight" });
    const initialLabel = (await listThemes({ locale: "zh-CN" }))[0].label;
    const initialPayload = run(process.execPath, ["scripts/theme-cli.mjs", "init", "--config", configPath,
      "--locale", "zh-CN", "--payload"]);
    assert(initialPayload.includes(`"label":${JSON.stringify(initialLabel)}`));
    new Function(initialPayload);
    assert.equal(JSON.parse(await fs.readFile(configPath, "utf8")).theme, "default");
    run(process.execPath, ["scripts/theme-cli.mjs", "set", "--config", configPath, "--theme", "study-library"]);
    assert.equal(JSON.parse(await fs.readFile(configPath, "utf8")).theme, "study-library");
    const show = JSON.parse(run(process.execPath, ["scripts/theme-cli.mjs", "show", "--config", configPath, "--json"]));
    assert.equal(show.theme.name, "study-library");
    const localizedLabel = (await listThemes({ locale: "zh-TW" })).find((theme) => theme.name === "korean-idol").label;
    const savedPayload = run(process.execPath, ["scripts/theme-cli.mjs", "set", "--config", configPath,
      "--theme", "korean-idol", "--locale", "zh-TW", "--payload"]);
    assert(savedPayload.includes(`"label":${JSON.stringify(localizedLabel)}`));
    assert.equal(JSON.parse(await fs.readFile(configPath, "utf8")).theme, "korean-idol");
    new Function(savedPayload);

    await writeConfig(configPath, {
      ...DEFAULT_CONFIG,
      theme: "default",
      customTheme: path.join(PROJECT_ROOT, "themes", "midnight.json"),
    });
    run(process.execPath, ["scripts/theme-cli.mjs", "set", "--config", configPath, "--theme", "korean-prestige"]);
    const migrated = JSON.parse(await fs.readFile(configPath, "utf8"));
    assert.equal(migrated.theme, "korean-prestige");
    assert.equal("customTheme" in migrated, false);
    assert.equal(JSON.parse(run(process.execPath, ["scripts/theme-cli.mjs", "show", "--config", configPath, "--json"])).theme.name, "korean-prestige");

    await writeConfig(configPath, {
      ...DEFAULT_CONFIG,
      theme: "anime-twilight",
      customTheme: path.join(temporary, "missing-theme.json"),
    });
    const unavailableCustom = await compileTheme({ configPath });
    assert.equal(unavailableCustom.theme.name, "anime-twilight");
    assert.equal(unavailableCustom.settings.customThemeUnavailable, true);
    assert.equal(unavailableCustom.settings.fallbackFrom, "custom-theme");
    assert.equal("customTheme" in unavailableCustom.effectiveConfig, false);
    run(process.execPath, ["scripts/theme-cli.mjs", "init", "--config", configPath]);
    const repaired = JSON.parse(await fs.readFile(configPath, "utf8"));
    assert.equal(repaired.theme, "anime-twilight");
    assert.equal("customTheme" in repaired, false);

    const corruptPath = path.join(temporary, "corrupt-config.json");
    const corruptSource = '{"theme":"korean-idol"';
    await fs.writeFile(corruptPath, corruptSource, "utf8");
    const recoveredPayload = run(process.execPath, ["scripts/theme-cli.mjs", "init", "--config", corruptPath, "--payload"]);
    new Function(recoveredPayload);
    assert.equal(JSON.parse(await fs.readFile(corruptPath, "utf8")).theme, "default");
    const corruptBackups = (await fs.readdir(temporary)).filter((name) => name.startsWith("corrupt-config.json.corrupt-"));
    assert.equal(corruptBackups.length, 1, "Corrupt configuration was not preserved exactly once");
    assert.equal(await fs.readFile(path.join(temporary, corruptBackups[0]), "utf8"), corruptSource);

    const nonObjectPath = path.join(temporary, "non-object-config.json");
    await fs.writeFile(nonObjectPath, "[]\n", "utf8");
    run(process.execPath, ["scripts/theme-cli.mjs", "init", "--config", nonObjectPath]);
    assert.equal(JSON.parse(await fs.readFile(nonObjectPath, "utf8")).theme, "default");
    const nonObjectBackups = (await fs.readdir(temporary)).filter((name) => name.startsWith("non-object-config.json.corrupt-"));
    assert.equal(nonObjectBackups.length, 1, "Non-object configuration was not preserved exactly once");
    assert.equal(await fs.readFile(path.join(temporary, nonObjectBackups[0]), "utf8"), "[]\n");
  } finally {
    await fs.rm(temporary, { recursive: true, force: true });
  }
});

test("enabled state, local images, and remote CSS safety are validated", async () => {
  const themeCoreSource = await fs.readFile(path.join(PROJECT_ROOT, "scripts", "theme-core.mjs"), "utf8");
  assert.match(themeCoreSource, /if \(bytes\.length > MAX_IMAGE_BYTES\)/);
  assert.match(themeCoreSource, /if \(bytes\.length > MAX_ARTWORK_BYTES\)/);
  await assert.rejects(
    compileTheme({ configPath: path.join(PROJECT_ROOT, "config.example.json"), config: { ...DEFAULT_CONFIG, enabled: "yes" } }),
    /enabled must be true or false/,
  );
  const temporary = await fs.mkdtemp(path.join(PROJECT_ROOT, "tests", ".tmp-"));
  try {
    const configPath = path.join(temporary, "config.json");
    await writeConfig(configPath, { ...DEFAULT_CONFIG, image: path.join(temporary, "missing.png") });
    const missingImage = await compileTheme({ configPath });
    assert.equal(missingImage.settings.imageDataUrl, null);
    assert.equal(missingImage.settings.imageUnavailable, true);

    const imagePath = path.join(temporary, "pixel.png");
    const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64");
    await fs.writeFile(imagePath, png);
    await writeConfig(configPath, { ...DEFAULT_CONFIG, image: imagePath, imageOpacity: 0.22 });
    const bundle = await compileTheme({ configPath });
    assert.equal(bundle.image.bytes, png.length);
    assert(bundle.settings.imageDataUrl.startsWith("data:image/png;base64,"));
    assert.equal(bundle.settings.imageAnimated, false);
    assert.equal(bundle.settings.imageOpacity, 0.22);

    const gifPath = path.join(temporary, "motion.gif");
    await fs.writeFile(gifPath, Buffer.from("GIF89a", "ascii"));
    await writeConfig(configPath, { ...DEFAULT_CONFIG, image: gifPath, reduceMotion: true });
    const animated = await buildPayload({ configPath });
    assert.equal(animated.settings.imageAnimated, true);
    assert.match(animated.payload, /claude-aura-animated-image/);
    assert.match(animated.css, /prefers-reduced-motion[\s\S]*claude-aura-animated-image/);

    const renamedGifPath = path.join(temporary, "renamed.png");
    await fs.writeFile(renamedGifPath, Buffer.from("GIF87a", "ascii"));
    await writeConfig(configPath, { ...DEFAULT_CONFIG, image: renamedGifPath, reduceMotion: true });
    await assert.rejects(compileTheme({ configPath }), /extension does not match its content/);

    const animatedFixtures = [
      ["motion.png", Buffer.concat([
        Buffer.from("89504e470d0a1a0a", "hex"),
        Buffer.from("000000086163544c000000010000000000000000", "hex"),
      ])],
      ["motion.webp", Buffer.concat([
        Buffer.from("RIFF", "ascii"),
        Buffer.from([4, 0, 0, 0]),
        Buffer.from("WEBPANIM", "ascii"),
        Buffer.alloc(4),
      ])],
      ["motion.avif", Buffer.concat([
        Buffer.from("000000186674797061766973000000006176696661766973", "hex"),
      ])],
    ];
    for (const [name, bytes] of animatedFixtures) {
      const fixturePath = path.join(temporary, name);
      await fs.writeFile(fixturePath, bytes);
      await writeConfig(configPath, { ...DEFAULT_CONFIG, image: fixturePath, reduceMotion: true });
      assert.equal((await compileTheme({ configPath })).settings.imageAnimated, true, `${name} animation was not detected`);
    }

    const theme = (await listThemes())[0];
    assert.throws(() => validateTheme({ ...theme, customCss: '@import url("https://example.com/theme.css");' }), /remote resources/);
    assert.throws(() => validateTheme({ ...theme, customCss: "body{background-image:url(//example.com/track.png)}" }), /remote resources/);
    assert.throws(() => validateTheme({ ...theme, customCss: String.raw`body{background-image:u\72l(//example.com/track.png)}` }), /remote resources/);
    assert.throws(() => validateTheme({ ...theme, customCss: String.raw`body{background-image:u\rl(//example.com/track.png)}` }), /remote resources/);
    assert.throws(() => validateTheme({ ...theme, customCss: String.raw`@im\port "//example.com/theme.css";` }), /remote resources/);
    assert.throws(() => validateTheme({ ...theme, customCss: 'body{background-image:image-set("https://example.com/track.png" 1x)}' }), /remote resources/);
    assert.throws(() => validateTheme({
      ...theme,
      light: { ...theme.light, wallpaper: { ...theme.light.wallpaper, gradient: "url(https://example.com/track.png)" } },
    }), /remote resources/);
  } finally {
    await fs.rm(temporary, { recursive: true, force: true });
  }
});

test("legacy macOS CDP validation rejects unsafe endpoints", async () => {
  const output = run(process.execPath, ["scripts/injector.mjs", "--self-test", "--port", "9394"]);
  const result = JSON.parse(output);
  assert.equal(result.pass, true);
  const injector = await fs.readFile(path.join(PROJECT_ROOT, "scripts", "injector.mjs"), "utf8");
  for (const marker of ["claude-aura-animated-image", "--aura-theme-art", "claudeAuraTheme", "claudeAuraArtMobile", "claudeAuraDigest"]) {
    assert(injector.includes(marker), `Legacy cleanup does not cover ${marker}`);
  }
});

test("JavaScript and platform scripts parse", async () => {
  const jsFiles = [
    "assets/renderer-inject.js",
    "preview/app.js",
    "studio/app.js",
    "scripts/build-preview.mjs",
    "scripts/build-release.mjs",
    "scripts/injector.mjs",
    "scripts/preview-server.mjs",
    "scripts/state-cli.mjs",
    "scripts/theme-cli.mjs",
    "scripts/theme-core.mjs",
    "scripts/webview-cli.mjs",
  ];
  for (const file of jsFiles) run(process.execPath, ["--check", file]);

  if (process.platform === "win32") {
    const psFiles = (await fs.readdir(path.join(PROJECT_ROOT, "windows"))).filter((file) => file.endsWith(".ps1"));
    const command = [
      "$ErrorActionPreference='Stop'",
      "$failed=$false",
      ...psFiles.map((file) => `$tokens=$null;$errors=$null;[void][System.Management.Automation.Language.Parser]::ParseFile('${path.join(PROJECT_ROOT, "windows", file).replaceAll("'", "''")}',[ref]$tokens,[ref]$errors);if($errors.Count){$errors|ForEach-Object{Write-Error $_};$failed=$true}`),
      "if($failed){exit 1}",
    ].join(";");
    run("powershell.exe", ["-NoProfile", "-Command", command]);
  }
  const bash = process.platform === "win32" ? spawnSync("where.exe", ["bash.exe"], { encoding: "utf8" }) : null;
  const bashPath = process.platform === "win32" ? bash?.stdout?.split(/\r?\n/).find(Boolean) : "/bin/bash";
  if (bashPath) {
    const shellFiles = (await fs.readdir(path.join(PROJECT_ROOT, "macos"))).filter((file) => file.endsWith(".sh"));
    run(bashPath.trim(), ["-n", ...shellFiles.map((file) => path.join(PROJECT_ROOT, "macos", file))]);
  }
});

test("Windows uses WebView2, Aura Studio, tray controls, and an accessible rich theme gallery", async () => {
  const start = await fs.readFile(path.join(PROJECT_ROOT, "windows", "start.ps1"), "utf8");
  const ui = await fs.readFile(path.join(PROJECT_ROOT, "windows", "aura-ui.ps1"), "utf8");
  const install = await fs.readFile(path.join(PROJECT_ROOT, "windows", "install.ps1"), "utf8");
  const studioApp = await fs.readFile(path.join(PROJECT_ROOT, "studio", "app.js"), "utf8");
  const studioCss = await fs.readFile(path.join(PROJECT_ROOT, "studio", "styles.css"), "utf8");
  const studioHtml = await fs.readFile(path.join(PROJECT_ROOT, "studio", "index.html"), "utf8");
  const studioGenerated = await fs.readFile(path.join(PROJECT_ROOT, "studio", "generated-themes.js"), "utf8");
  const assetConverter = await fs.readFile(path.join(PROJECT_ROOT, "scripts", "convert-theme-assets.mjs"), "utf8");
  const uiCopy = JSON.parse(await fs.readFile(path.join(PROJECT_ROOT, "windows", "ui-copy.json"), "utf8"));
  for (const [name, source] of [["start", start], ["UI", ui], ["installer", install]]) {
    assert(!/remote-debugging-(?:port|pipe)/i.test(source), `${name} still launches a debugging endpoint`);
    assert(!/45\s+seconds/i.test(source), `${name} still contains the old startup wait`);
  }
  assert.match(start, /aura-ui\.ps1/);
  assert.match(ui, /CoreWebView2Environment/);
  assert.match(ui, /ExecuteScriptAsync/);
  assert.match(ui, /--locale/);
  assert.match(ui, /CurrentUICulture/);
  assert.match(ui, /AccessibleName/);
  assert.match(ui, /FlowLayoutPanel|TableLayoutPanel/);
  assert.match(ui, /swatches/i);
  assert.match(ui, /Get-AuraUiCopy/);
  assert.match(ui, /ui-copy\.json/);
  assert.match(ui, /\$script:StudioForm\.Text\s*=\s*"\$\(\$script:UiCopy\.studioTitle\)"/,
    "The Studio window title must come from localized UI copy");
  assert.match(ui,
    /SetVirtualHostNameToFolderMapping\(\s*['"]aura\.studio['"]\s*,[\s\S]{0,300}?CoreWebView2HostResourceAccessKind\]::Allow\s*\)/,
    "Studio must use the allowlisted aura.studio virtual host mapping");
  assert.match(ui,
    /SetVirtualHostNameToFolderMapping\(\s*['"]aura\.assets['"]\s*,\s*\$ThemeArtRoot\s*,[\s\S]{0,160}?CoreWebView2HostResourceAccessKind\]::Allow\s*\)/,
    "Studio selector artwork must use its own local virtual host mapping");
  assert.match(ui, /\.Navigate\(\s*['"]https:\/\/aura\.studio\/index\.html['"]\s*\)/,
    "Studio must navigate to its exact offline virtual-host URL");
  assert.match(ui, /\.add_WebMessageReceived\(\s*\{/);
  assert.match(ui, /PostWebMessageAsJson\s*\(/);

  const expectedStudioMessageTypes = [
    "get-state",
    "set-theme",
    "set-image",
    "clear-image",
    "set-enabled",
    "open-desktop",
    "import-theme",
  ];
  const studioMessageTypesMatch = ui.match(/\$script:StudioMessageTypes\s*=\s*@\(([\s\S]*?)\)/);
  assert(studioMessageTypesMatch, "The Studio host message allowlist is missing");
  const studioMessageTypes = [...studioMessageTypesMatch[1].matchAll(/['"]([^'"]+)['"]/g)]
    .map((match) => match[1]);
  assert.deepEqual(studioMessageTypes, expectedStudioMessageTypes,
    "Studio must expose exactly the seven WO-05 host actions");
  assert.match(ui,
    /(?:\$script:StudioMessageTypes\s+-cnotcontains\s+\$message\.type|\$message\.type\s+-cnotin\s+\$script:StudioMessageTypes)/i,
    "Studio message actions must be checked case-sensitively against the allowlist");
  assert.match(ui, /\$message\.type\s+-isnot\s+\[string\]/i,
    "Studio messages must carry a string action type");
  assert.match(ui, /\$message\.PSObject\.Properties/i,
    "Studio messages must validate their exact property shape");
  assert.match(ui, /-c(?:not)?match\s+['"]\^\[a-z\]\[a-z0-9-\]\{1,39\}\$['"]/,
    "Studio theme IDs must use the canonical case-sensitive kebab-case check");
  assert.match(ui, /\$message\.enabled\s+-isnot\s+\[bool\]/i,
    "Studio enabled-state messages must carry a real Boolean");
  assert.match(studioApp, /send\(\{\s*type:\s*"set-image"\s*\}\)/,
    "The Studio page must let the host choose image paths");
  assert.match(studioApp, /send\(\{\s*type:\s*"import-theme"\s*\}\)/,
    "The Studio page must let the host choose import paths");
  assert.match(studioHtml, /class="rail-item is-current"[^>]*aria-current="page"/,
    "Studio must expose the current navigation destination semantically");
  assert.match(studioApp, /removeAttribute\("aria-current"\)/);
  assert.match(studioApp, /setAttribute\("aria-current",\s*"page"\)/);
  assert.match(studioApp, /<img class="theme-card-preview"[^>]*alt=""[^>]*aria-hidden="true"/,
    "Studio selector previews must be decorative images");
  assert.match(assetConverter, /const cardSelection = cardsOnly\s*\?[\s\S]{0,280}:\s*\{\};/,
    "Ordinary runtime-asset conversion must not depend on gitignored Studio reference images");
  const selectorWithoutFlag = spawnSync(process.execPath, [
    path.join(PROJECT_ROOT, "scripts", "convert-theme-assets.mjs"),
    "japanese-film-editorial",
  ], { cwd: PROJECT_ROOT, encoding: "utf8" });
  assert.notEqual(selectorWithoutFlag.status, 0,
    "Selector-only theme IDs must not become silent no-ops in runtime-asset mode");
  assert.match(`${selectorWithoutFlag.stdout}\n${selectorWithoutFlag.stderr}`, /use --card-previews/);

  const cardBodyRule = studioCss.match(/\.theme-card-body\s*\{([^}]*)\}/)?.[1] ?? "";
  assert.match(cardBodyRule, /display:\s*block/,
    "Theme-card body padding must contain its block children");
  assert.match(cardBodyRule, /padding:\s*14px\s+16px\s+16px/,
    "Theme-card labels need a comfortable inset from the border");
  const currentRailRule = studioCss.match(/\.rail-item\.is-current\s*\{([^}]*)\}/)?.[1] ?? "";
  assert(!/box-shadow/.test(currentRailRule),
    "Current navigation must not stack an inset shadow under the focus ring");
  assert.match(studioCss, /\.rail-item:focus-visible\s*\{[^}]*outline-width:\s*2px[^}]*\}/);
  const checkedCardRule = studioCss.match(/\.theme-card input:checked \+ label\s*\{([^}]*)\}/)?.[1] ?? "";
  assert(!/0\s+0\s+0/.test(checkedCardRule),
    "Selected cards must not add a second ring-like box shadow");
  assert.match(studioCss, /\.theme-card-preview\s*\{[^}]*object-fit:\s*cover[^}]*\}/);

  const generatedMatch = studioGenerated.match(/window\.CLAUDE_AURA_THEMES\s*=\s*([\s\S]+);\s*$/);
  assert(generatedMatch, "Studio theme metadata could not be parsed");
  const studioThemes = JSON.parse(generatedMatch[1]);
  assert.deepEqual(Object.keys(studioThemes), THEME_IDS);
  let selectorPreviewCount = 0;
  for (const themeId of THEME_IDS) {
    const expectedPath = themeId === "default" ? null : `assets/theme-art/${themeId}/card-preview.webp`;
    assert.equal(studioThemes[themeId].studioPreview, expectedPath,
      `${themeId} Studio preview metadata is incorrect`);
    if (!expectedPath) continue;
    selectorPreviewCount += 1;
    const bytes = await fs.readFile(path.join(PROJECT_ROOT, expectedPath));
    assert(bytes.length > 0 && bytes.length < 400_000, `${themeId} Studio preview exceeds its raster budget`);
    assert.equal(bytes.toString("ascii", 0, 4), "RIFF");
    assert.equal(bytes.toString("ascii", 8, 12), "WEBP");
    assert.equal(bytes.toString("ascii", 12, 16), "VP8X");
    const readUInt24LE = (offset) => bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16);
    assert.deepEqual([readUInt24LE(24) + 1, readUInt24LE(27) + 1], [640, 360],
      `${themeId} Studio preview must be 640x360`);
  }
  assert.equal(selectorPreviewCount, 7);
  assert(!/theme_demo_previews|Claude app interface with K-pop|Elegant Japanese-inspired/i.test(studioGenerated),
    "Generated Studio metadata must never identify raw reference composites");
  assert(!/\$message\.(?:path|file|fileName)\b/i.test(ui),
    "The Studio host must never accept a page-supplied file path");
  assert.match(ui, /\[System\.Windows\.Forms\.OpenFileDialog\]::new\(\)/,
    "Image paths must come from a host-side OpenFileDialog");

  assert.match(ui, /\[System\.Windows\.Forms\.NotifyIcon\]::new\(\)/);
  assert.match(ui, /\[System\.Windows\.Forms\.ContextMenuStrip\]::new\(\)/);
  assert.match(ui, /\$script:TrayIcon\.add_(?:Mouse)?DoubleClick\(\s*\{[\s\S]{0,300}?Show-AuraUiStudio/,
    "Double-clicking the tray icon must open Studio");
  assert.match(ui, /\$script:TrayIcon\.Dispose\(\)/,
    "The tray icon must be disposed when Claude Aura closes");
  for (const copyKey of ["openStudio", "originalLook", "applyTheme", "openDesktopApp", "exitApp"]) {
    assert(ui.includes(`UiCopy.${copyKey}`), `Tray action ${copyKey} must use localized UI copy`);
  }
  // The Node helper emits UTF-8; decode it as UTF-8 so localized metadata does not
  // corrupt (and break JSON parsing) when the console falls back to an OEM code
  // page such as Big5 on a Traditional Chinese system.
  assert.match(ui, /StandardOutputEncoding\s*=\s*\[System\.Text\.UTF8Encoding\]::new\(\$false\)/);
  assert.match(ui, /StandardErrorEncoding\s*=\s*\[System\.Text\.UTF8Encoding\]::new\(\$false\)/);
  assert(!/Get-Content -LiteralPath \$ConfigPath -Raw \|/.test(ui),
    "Config reads must decode as UTF-8, not the default ANSI code page");
  // First-sign-in blank-screen fix: the opaque loading cover must be hidden on the
  // real navigation signal, never gated on the async theme-injection result. A
  // theme hiccup over a loaded claude.ai must not re-cover the page.
  assert(!/Apply-AuraUiTheme\s+-Cover\s+\$true/.test(ui),
    "Navigation must not gate the loading cover on themed-apply success");
  assert.match(ui, /\$script:PageReady\s*=\s*\$true[\s\S]{0,400}?Hide-AuraUiLoading/,
    "A loaded claude.ai document must mark the page ready and hide the cover");
  assert.match(ui, /elseif\s*\(\$script:PageReady\)/,
    "A theme-injection failure over a ready page must not show the opaque cover");
  assert.match(ui, /\$script:PendingApply/,
    "A skipped navigation-time apply must be retried, not dropped");
  assert.match(ui, /if\s*\(\$Action\s+-eq\s+['"]Restore['"]\)\s*\{[\s\S]{0,240}?\$script:PendingRestore\s*=\s*\$true[\s\S]{0,160}?\$script:PendingApply\s*=\s*\$false/,
    "A busy renderer must queue Restore and cancel a stale pending Apply");
  assert.match(ui, /if\s*\(\$script:PendingRestore\)\s*\{[\s\S]{0,500}?Start-AuraUiScript\s+-Source\s+\$cleanup\s+-Action\s+Restore/,
    "Queued Restore must run as soon as the active renderer task completes");
  assert(!ui.includes("'Customize themes'"), "Picker chrome must come from localized UI copy");
  assert(!ui.includes("'Applying your look...'"), "Loading status must come from localized UI copy");
  assert.match(ui, /themeFallbackDescription/);
  assert.deepEqual(Object.keys(uiCopy).sort(), ["en", "zh-CN", "zh-TW"]);
  const copyKeys = Object.keys(uiCopy.en).sort();
  for (const locale of ["zh-CN", "zh-TW"]) {
    assert.deepEqual(Object.keys(uiCopy[locale]).sort(), copyKeys, `${locale} UI copy is incomplete`);
    for (const key of copyKeys) assert(String(uiCopy[locale][key]).trim(), `${locale}.${key} is empty`);
  }
  assert.equal(uiCopy["zh-CN"].customizeThemes, "\u81ea\u5b9a\u4e49\u4e3b\u9898");
  assert.equal(uiCopy["zh-TW"].customizeThemes, "\u81ea\u8a02\u4e3b\u984c");
  assert.notEqual(uiCopy["zh-CN"].themeApplyDescription, uiCopy["zh-TW"].themeApplyDescription);
  const expectedStudioCopy = {
    en: {
      studioTitle: "Claude Aura Studio",
      openStudio: "Open Studio",
      openDesktopApp: "Open desktop app",
      exitApp: "Exit Claude Aura",
      studioImportPending: "Theme installation isn't available yet.",
    },
    "zh-CN": {
      studioTitle: "Claude Aura 工作室",
      openStudio: "打开工作室",
      openDesktopApp: "打开桌面版",
      exitApp: "退出 Claude Aura",
      studioImportPending: "主题安装功能暂不可用。",
    },
    "zh-TW": {
      studioTitle: "Claude Aura 工作室",
      openStudio: "開啟工作室",
      openDesktopApp: "開啟桌面版",
      exitApp: "結束 Claude Aura",
      studioImportPending: "目前還不能安裝主題。",
    },
  };
  for (const [locale, expected] of Object.entries(expectedStudioCopy)) {
    for (const [key, value] of Object.entries(expected)) {
      assert.equal(uiCopy[locale][key], value, `${locale}.${key} must use approved native UI copy`);
    }
  }
  assert.match(ui, /DwmSetWindowAttribute/);
  assert.match(ui, /Set-AuraUiTitleBarPalette/);
  assert.match(ui, /Set-AuraUiFormWithinWorkingArea/);
  assert.match(ui, /Screen\]::FromControl\(\$Form\)\.WorkingArea/);
  assert.match(install, /WindowStyle Hidden/);
  assert.match(install, /Claude Aura\.lnk/);
  assert(install.includes("'studio'"), "The Windows installer must copy Aura Studio");

  for (const architecture of ["x64", "x86", "arm64"]) {
    const loader = path.join(PROJECT_ROOT, "vendor", "webview2", "runtimes", architecture, "WebView2Loader.dll");
    assert((await fs.stat(loader)).isFile(), `Missing ${architecture} WebView2 loader`);
  }
  for (const file of ["Microsoft.Web.WebView2.Core.dll", "Microsoft.Web.WebView2.WinForms.dll", "LICENSE.txt", "NOTICE.txt"]) {
    assert((await fs.stat(path.join(PROJECT_ROOT, "vendor", "webview2", file))).isFile(), `Missing vendored WebView2 ${file}`);
  }
});

test("Windows window clamp fits a synthetic 1280x720 working area", async () => {
  const ui = await fs.readFile(path.join(PROJECT_ROOT, "windows", "aura-ui.ps1"), "utf8");
  const functionMatch = ui.match(/function Set-AuraUiFormWithinWorkingArea \{[\s\S]*?\r?\n\}/);
  assert(functionMatch, "The working-area clamp function could not be isolated");
  const functionSource = functionMatch[0];
  assert.match(functionSource, /\$maximumWidth\s*=\s*\[Math\]::Max\(1,\s*\$workingArea\.Width\s*-\s*\(\$Margin\s*\*\s*2\)\)/);
  assert.match(functionSource, /\$maximumHeight\s*=\s*\[Math\]::Max\(1,\s*\$workingArea\.Height\s*-\s*\(\$Margin\s*\*\s*2\)\)/);
  assert.match(functionSource, /\$width\s*=\s*\[Math\]::Min\(\$Form\.Width,\s*\$maximumWidth\)/);
  assert.match(functionSource, /\$height\s*=\s*\[Math\]::Min\(\$Form\.Height,\s*\$maximumHeight\)/);

  const clientSizeMatch = ui.match(/\$script:Form\.ClientSize\s*=\s*\[Drawing\.Size\]::new\((\d+),\s*(\d+)\)/);
  const minimumSizeMatch = ui.match(/\$script:Form\.MinimumSize\s*=\s*\[Drawing\.Size\]::new\((\d+),\s*(\d+)\)/);
  assert(clientSizeMatch, "The main window client size is missing");
  assert(minimumSizeMatch, "The main window minimum size is missing");

  const syntheticArea = { left: 0, top: 0, width: 1280, height: 720 };
  const margin = 12;
  const clamp = (width, height) => {
    const maximumWidth = Math.max(1, syntheticArea.width - (margin * 2));
    const maximumHeight = Math.max(1, syntheticArea.height - (margin * 2));
    const clampedWidth = Math.min(width, maximumWidth);
    const clampedHeight = Math.min(height, maximumHeight);
    return {
      width: clampedWidth,
      height: clampedHeight,
      left: syntheticArea.left + Math.max(margin, Math.floor((syntheticArea.width - clampedWidth) / 2)),
      top: syntheticArea.top + Math.max(margin, Math.floor((syntheticArea.height - clampedHeight) / 2)),
    };
  };
  const oversized = clamp(1600, 900);
  assert.deepEqual(oversized, { width: 1256, height: 696, left: 12, top: 12 });
  assert(oversized.left + oversized.width <= syntheticArea.width - margin);
  assert(oversized.top + oversized.height <= syntheticArea.height - margin);
  assert(Number(minimumSizeMatch[1]) <= oversized.width && Number(minimumSizeMatch[2]) <= oversized.height,
    "The minimum window size cannot fit the synthetic working area");

  if (process.platform === "win32") {
    const injectedFunction = functionSource
      .replace("function Set-AuraUiFormWithinWorkingArea", "function Test-AuraUiFormWithinWorkingArea")
      .replace(
        "param([AllowNull()][System.Windows.Forms.Form]$Form, [int]$Margin = 12)",
        "param([AllowNull()][System.Windows.Forms.Form]$Form, [int]$Margin = 12, [Drawing.Rectangle]$SyntheticWorkingArea)",
      )
      .replace(
        "$workingArea = [System.Windows.Forms.Screen]::FromControl($Form).WorkingArea",
        "$workingArea = $SyntheticWorkingArea",
      );
    assert.notEqual(injectedFunction, functionSource, "The clamp function could not accept a synthetic working area");
    assert.match(injectedFunction, /\$workingArea = \$SyntheticWorkingArea/);

    const defaultWidth = Number(clientSizeMatch[1]);
    const defaultHeight = Number(clientSizeMatch[2]);
    const minimumWidth = Number(minimumSizeMatch[1]);
    const minimumHeight = Number(minimumSizeMatch[2]);
    const powershell = [
      "$ErrorActionPreference='Stop'",
      "Add-Type -AssemblyName System.Windows.Forms",
      "Add-Type -AssemblyName System.Drawing",
      injectedFunction,
      "$area=[Drawing.Rectangle]::new(0,0,1280,720)",
      "$form=[System.Windows.Forms.Form]::new()",
      "try {",
      `  $form.MinimumSize=[Drawing.Size]::new(${minimumWidth},${minimumHeight})`,
      `  $form.ClientSize=[Drawing.Size]::new(${defaultWidth},${defaultHeight})`,
      "  Test-AuraUiFormWithinWorkingArea -Form $form -Margin 12 -SyntheticWorkingArea $area",
      "  if($form.Left -lt 12 -or $form.Top -lt 12 -or $form.Right -gt 1268 -or $form.Bottom -gt 708){throw \"Default window escaped the synthetic working area: $($form.Bounds)\"}",
      "  $form.Size=[Drawing.Size]::new(1600,900)",
      "  Test-AuraUiFormWithinWorkingArea -Form $form -Margin 12 -SyntheticWorkingArea $area",
      "  if($form.Bounds -ne [Drawing.Rectangle]::new(12,12,1256,696)){throw \"Oversized window clamped to unexpected bounds: $($form.Bounds)\"}",
      "} finally { $form.Dispose() }",
    ].join("\n");
    run("powershell.exe", ["-NoProfile", "-STA", "-EncodedCommand", Buffer.from(powershell, "utf16le").toString("base64")]);
  }
});

test("preview data and QA harness cover every theme and major interaction family", async () => {
  run(process.execPath, ["scripts/build-preview.mjs"]);
  const generated = await fs.readFile(path.join(PROJECT_ROOT, "preview", "generated-themes.js"), "utf8");
  const html = await fs.readFile(path.join(PROJECT_ROOT, "preview", "index.html"), "utf8");
  const css = await fs.readFile(path.join(PROJECT_ROOT, "preview", "styles.css"), "utf8");
  const script = await fs.readFile(path.join(PROJECT_ROOT, "preview", "app.js"), "utf8");
  const server = await fs.readFile(path.join(PROJECT_ROOT, "scripts", "preview-server.mjs"), "utf8");
  for (const id of THEME_IDS) assert(generated.includes(`\"${id}\"`), `Preview is missing ${id}`);
  assert.match(html, /aria-label/i);
  assert.match(html, /data-screen="home"|id="home-screen"/i);
  assert.match(html, /data-screen="code"|id="code-screen"/i);
  assert.match(html, /Cowork/);
  assert.match(html, /microphone|voice/i);
  assert.match(html, /data-empty-state/);
  assert.match(html, /role="tooltip"/);
  assert.match(html, /data-status="success"/);
  assert.match(html, /data-status="warning"/);
  assert.match(html, /data-status="loading"/);
  assert.match(html, /id="qa-state"/);
  assert.match(html, /data-preview-ready="false"/);
  assert.match(html, /data-preview-screen="home"/);
  assert.match(html, /data-preview-overlay="none"/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /:active/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /forced-colors/);
  assert.match(css, /data-preview-capture="true"/);
  assert.match(script, /localStorage/);
  assert.match(script, /new URLSearchParams\(window\.location\.search\)/);
  assert(script.includes('query.get("capture")'), "Preview URL state omits capture mode");
  for (const parameter of ["theme", "mode", "screen", "overlay"]) {
    assert(script.includes(`readQueryValue("${parameter}"`), `Preview URL state omits validated ${parameter}`);
  }
  assert.match(script, /previewReady/);
  assert.match(script, /document\.fonts\?\.ready/);
  assert.match(script, /\.decode\(\)/);
  assert.match(script, /requestAnimationFrame/);
  assert.match(script, /claude-aura-preview-ready/);
  assert.match(script, /__CLAUDE_AURA_PREVIEW__/);
  assert.match(script, /whenReady/);
  assert.match(script, /claudeAuraTheme/);
  assert.match(server, /requestedPath\.endsWith\("\/"\)/);
  assert.match(server, /publicRoots\.some/);
  assert.match(server, /isIP\(host\)/);
});

test("release and installers exclude unsafe composite references and binary patching", async () => {
  const manifest = await fs.readFile(path.join(PROJECT_ROOT, "docs", "FILE_MANIFEST.md"), "utf8");
  const listedFiles = [...manifest.matchAll(/^- `([^`]+)`$/gm)].map((match) => match[1]).sort();
  assert.deepEqual(listedFiles, (await deliverableFiles()).sort(), "Deliverable file manifest is incomplete or stale");
  const releaseBuilder = await fs.readFile(path.join(PROJECT_ROOT, "scripts", "build-release.mjs"), "utf8");
  assert.match(releaseBuilder, /RELEASE_ROOT_FILES/);
  assert.match(releaseBuilder, /RELEASE_DIRECTORIES/);
  assert.match(releaseBuilder, /\["studio",\s*new Set\(\["\.css",\s*"\.html",\s*"\.js"\]\)\]/,
    "The release allowlist must include Aura Studio");
  assert.match(releaseBuilder, /\.corrupt-/);
  for (const extension of [".avif", ".png", ".svg", ".webp"]) {
    assert(releaseBuilder.includes(`"${extension}"`), `Release allowlist omits supported artwork type ${extension}`);
  }
  assert.match(releaseBuilder, /docs\/preview\.png/);
  const privateName = `private-release-state-${process.pid}-${Date.now()}.json`;
  const privatePath = path.join(PROJECT_ROOT, privateName);
  try {
    await fs.writeFile(privatePath, '{"secret":"must-not-ship"}\n', "utf8");
    const release = JSON.parse(run(process.execPath, ["scripts/build-release.mjs"]));
    const names = zipEntryNames(await fs.readFile(release.outputPath));
    assert(names.includes("claude-aura/package.json"), "Release allowlist omitted package.json");
    for (const studioFile of ["app.js", "generated-themes.js", "index.html", "styles.css"]) {
      assert(names.includes(`claude-aura/studio/${studioFile}`), `Release omitted Studio ${studioFile}`);
    }
    for (const themeId of THEME_IDS.filter((id) => id !== "default")) {
      assert(names.includes(`claude-aura/assets/theme-art/${themeId}/card-preview.webp`),
        `Release omitted ${themeId} Studio selector preview`);
    }
    assert(!names.includes(`claude-aura/${privateName}`), "Release included an unlisted local file");
    assert(!names.some((name) => name.startsWith("claude-aura/.agents/") || name.startsWith("claude-aura/.codex/")),
      "Release included local agent metadata");
    assert(!names.some((name) => name.includes("theme_demo_previews") || name === "claude-aura/docs/preview.png"),
      "Release included an unsafe reference composite");
    assert(!names.some((name) => /^claude-aura\/themes\/[^/]+\//.test(name)),
      "Release included files from a per-theme source kit directory");
  } finally {
    await fs.rm(privatePath, { force: true });
  }
  const files = [
    ...(await fs.readdir(path.join(PROJECT_ROOT, "windows"))).map((file) => path.join(PROJECT_ROOT, "windows", file)),
    ...(await fs.readdir(path.join(PROJECT_ROOT, "macos"))).filter((file) => file.endsWith(".sh")).map((file) => path.join(PROJECT_ROOT, "macos", file)),
  ];
  for (const file of files) {
    const stat = await fs.stat(file);
    if (!stat.isFile()) continue;
    const source = await fs.readFile(file, "utf8");
    assert(!/\b(?:takeown|icacls)\b/i.test(source), `${file} contains a package-ownership command`);
    assert(!/app\.asar/i.test(source), `${file} references app.asar`);
  }
  const productionSources = [
    path.join(PROJECT_ROOT, "assets", "base.css"),
    path.join(PROJECT_ROOT, "assets", "theme-variants.css"),
    path.join(PROJECT_ROOT, "assets", "renderer-inject.js"),
    path.join(PROJECT_ROOT, "scripts", "theme-core.mjs"),
    path.join(PROJECT_ROOT, "themes", "registry.json"),
  ];
  for (const file of productionSources) {
    const source = await fs.readFile(file, "utf8");
    assert(!/theme_demo_previews|Claude app interface with K-pop|Elegant Japanese-inspired/i.test(source));
  }
  const installer = await fs.readFile(path.join(PROJECT_ROOT, "windows", "install.ps1"), "utf8");
  const uninstaller = await fs.readFile(path.join(PROJECT_ROOT, "windows", "uninstall.ps1"), "utf8");
  assert.match(installer, /Uninstall Claude Aura\.lnk/);
  assert.match(installer, /Uninstall Claude Aura\.cmd/);
  assert.match(uninstaller, /Assert-AuraOwnedPath -Path \$installRoot/);
  assert.match(uninstaller, /Assert-AuraOwnedPath -Path \$dataRoot/);
  assert.match(uninstaller, /Assert-AuraOwnedPath -Path \$webViewRoot/);
  assert.match(uninstaller, /SupportsShouldProcess\s*=\s*\$true/);
  assert.match(uninstaller, /\$PSCmdlet\.ShouldProcess/);
  assert.match(uninstaller, /if \(\$RemoveData -and \(Test-Path -LiteralPath \$dataRoot\)\)/);
  assert.match(uninstaller, /if \(\$RemoveData -and \(Test-Path -LiteralPath \$webViewRoot\)\)/);
  assert(!/AnthropicClaude|Programs\\Claude|app\.asar/i.test(uninstaller), "Uninstaller must not target Anthropic's installation");
});

let passed = 0;
for (const item of tests) {
  try {
    await item.fn();
    passed += 1;
    console.log(`ok ${passed} - ${item.name}`);
  } catch (error) {
    console.error(`not ok ${passed + 1} - ${item.name}`);
    console.error(error.stack || error.message);
    process.exitCode = 1;
    break;
  }
}
if (!process.exitCode) console.log(`1..${passed}`);
