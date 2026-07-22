#!/usr/bin/env node
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { buildAuraIcon } from "../scripts/build-aura-icon.mjs";
import { buildLauncherAssets } from "../scripts/build-launcher-assets.mjs";
import {
  AURA_VERSION,
  buildPayload,
  buildPayloadFromCompiled,
  compileTheme,
  DEFAULT_CONFIG,
  executeStudioRequest,
  hydrateStudioDraft,
  listThemes,
  normalizeLocale,
  PROJECT_ROOT,
  readThemeKit,
  readThemeRegistry,
  REQUIRED_SEMANTIC_TOKENS,
  resolveArtwork,
  STUDIO_FONT_DISPLAY_STACKS,
  STUDIO_FONT_UI_STACKS,
  STUDIO_MAX_LAYERS,
  STUDIO_SHADOWS,
  STUDIO_THEME_SCHEMA_VERSION,
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
const STUDIO_PREVIEW_MASTERS = {
  "japanese-film-editorial": { dimensions: [1709, 920], frame: { x: 77.76, y: 8.98, zoom: 3.651 }, sha256: "8d2574b05ab89b038ffd185a4f66206eda8d675213cdb98e19ce504d62d239d5" },
  "korean-prestige": { dimensions: [1708, 920], frame: { x: 82.34, y: 8.61, zoom: 3.274 }, sha256: "fa217fedd86b534f370cf501b21cc5c43f2c8923974b26b63c5caaed9fc05f19" },
  "cartoon-studio": { dimensions: [1709, 920], frame: { x: 92.79, y: 10.48, zoom: 3.651 }, sha256: "cd52848f712d61f77987fb5f88e7cddaf78fdf28638e9531c4b94b51df670e8a" },
  "anime-twilight": { dimensions: [1659, 948], frame: { x: 96.1, y: 8.25, zoom: 3.374 }, sha256: "e666c4f8c79bd51c0574300e29cc075ad69d7168fce373520aa3f9248cfd3bf1" },
  "study-library": { dimensions: [1174, 967], frame: { x: 50, y: 55, zoom: 1 }, sha256: "1f1ae98251f43cbd8f805ba9e8d17111de1e893146f0b59fc7987cbc5ca680df" },
  "japanese-idol": { dimensions: [1710, 920], frame: { x: 86.85, y: 9.49, zoom: 3.194 }, sha256: "b60af62d259ac547e59a78ffe53c30a1368da67289e945174539a25109e742ca" },
  "korean-idol": { dimensions: [1660, 947], frame: { x: 83.47, y: 11.82, zoom: 3.507 }, sha256: "63f1535ef09b74299a3523c987601e8f5b5a2836a8acd1866458e3e50dbc6b0d" },
};
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

function readPayloadSettings(payload) {
  const marker = '{"version":';
  const offset = payload.lastIndexOf(marker);
  assert(offset >= 0, "Renderer payload is missing its compact settings argument");
  return JSON.parse(payload.slice(offset, -1));
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
  const excludedRoots = new Set(["dist", "node_modules", "release"]);
  const excludedNames = new Set([".DS_Store", "Thumbs.db", "config.local.json", "state.json"]);
  const deliverableRootMarkdown = new Set([
    "CONTRIBUTING.md",
    "NOTICE.md",
    "README.md",
    "SECURITY.md",
    "THIRD_PARTY_NOTICES.md",
  ]);
  const deliverableDocumentation = new Set([
    "docs/ACCEPTANCE_AUDIT.md",
    "docs/FILE_MANIFEST.md",
    "docs/IMPLEMENTATION_REPORT.md",
    "docs/SCREENSHOT_PLAN.md",
    "docs/THEME_KIT_SPEC.md",
    "docs/THEMING.md",
    "docs/TROUBLESHOOTING.md",
    "docs/recipes/RECIPES.md",
  ]);
  // Supplied per-theme source kits are DIRECTORIES under themes/ — preserved on
  // disk and gitignored. Only the derived runtime
  // copies under assets/theme-art/ ship.
  const excludedPaths = new Set(["themes/customize_new_theme_prompt.md"]);
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const relativePath = relativeDirectory ? `${relativeDirectory}/${entry.name}` : entry.name;
    if (!relativeDirectory && excludedRoots.has(entry.name)) continue;
    if (!relativeDirectory && entry.isDirectory() && entry.name.startsWith(".") && entry.name !== ".github") continue;
    if (!relativeDirectory && entry.isFile() && entry.name.toLowerCase().endsWith(".md")
        && !deliverableRootMarkdown.has(entry.name)) continue;
    if (entry.isDirectory() && relativePath.startsWith("docs/")
        && ![...deliverableDocumentation].some((file) => file.startsWith(`${relativePath}/`))) continue;
    if (entry.isFile() && relativeDirectory.startsWith("docs")
        && !deliverableDocumentation.has(relativePath)) continue;
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
  for (const theme of themes) {
    assert.deepEqual(Object.keys(theme.launcher).sort(), [
      "accent", "asset", "border", "borderWidth", "foreground", "radius", "surface", "surfaceHover",
    ]);
    assert.equal(theme.launcher.asset, `assets/theme-art/${theme.name}/launcher-mark.png`);
    for (const key of ["surface", "surfaceHover", "foreground", "accent", "border"]) {
      assert.match(theme.launcher[key], /^#[0-9A-F]{6}$/, `${theme.name} launcher ${key} is invalid`);
    }
    assert(theme.launcher.radius >= 8 && theme.launcher.radius <= 24);
    assert(theme.launcher.borderWidth >= 1 && theme.launcher.borderWidth <= 3);
    const mark = await fs.readFile(path.join(PROJECT_ROOT, theme.launcher.asset));
    assert(mark.length > 0 && mark.length < 400_000, `${theme.name} launcher mark exceeds its raster budget`);
    assert.deepEqual([...mark.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
    assert.equal(mark.readUInt32BE(16), 96, `${theme.name} launcher mark width must be 96px`);
    assert.equal(mark.readUInt32BE(20), 96, `${theme.name} launcher mark height must be 96px`);
    assert.equal(mark[25], 6, `${theme.name} launcher mark must retain RGBA transparency`);
  }
  assert.deepEqual(themes.find((theme) => theme.name === "cartoon-studio")?.artworkLayers, [
    {
      path: "assets/theme-art/cartoon-studio/background.webp",
      position: "center",
      size: "cover",
      mobile: "keep",
      opacity: 0.5,
      mask: "none",
      role: "background",
      appearance: "light",
      contextOverrides: null,
    },
    {
      path: "assets/theme-art/cartoon-studio/dark-background.webp",
      position: "center",
      size: "cover",
      mobile: "keep",
      opacity: 0.5,
      mask: "none",
      role: "background",
      appearance: "dark",
      contextOverrides: null,
    },
    {
      path: "assets/theme-art/cartoon-studio/hero.webp",
      position: "right bottom",
      size: "min(26vw, 420px) auto",
      mobile: "reduce",
      opacity: 0.95,
      mask: "none",
      role: "hero",
      appearance: null,
      contextOverrides: {
        conversation: { hidden: true },
        other: { hidden: true },
      },
    },
  ]);
  assert.deepEqual(themes.find((theme) => theme.name === "anime-twilight")?.artworkLayers, [
    {
      path: "assets/theme-art/anime-twilight/background.webp",
      position: "center",
      size: "cover",
      mobile: "keep",
      opacity: 0.62,
      mask: "none",
      role: "background",
      appearance: null,
      contextOverrides: null,
    },
  ]);
  assert.deepEqual(themes.find((theme) => theme.name === "study-library")?.artworkLayers, [
    {
      path: "assets/theme-art/study-library/background.webp",
      position: "center",
      size: "cover",
      mobile: "keep",
      opacity: 0.4,
      mask: "none",
      role: "background",
      appearance: "light",
      contextOverrides: null,
    },
    {
      path: "assets/theme-art/study-library/dark-background.webp",
      position: "center",
      size: "cover",
      mobile: "keep",
      opacity: 0.4,
      mask: "none",
      role: "background",
      appearance: "dark",
      contextOverrides: null,
    },
    {
      path: "assets/theme-art/study-library/corner-bottom.webp",
      position: "left bottom",
      size: "min(20vw, 320px) auto",
      mobile: "hide",
      opacity: 0.6,
      mask: "none",
      role: "decoration",
      appearance: null,
      contextOverrides: null,
    },
  ]);
  const japaneseIdol = themes.find((theme) => theme.name === "japanese-idol");
  assert.equal(japaneseIdol.light.wallpaper.surfaceAlpha, 0.72);
  assert.equal(japaneseIdol.dark.wallpaper.surfaceAlpha, 0.76);
  assert.deepEqual(japaneseIdol.artworkLayers, [
    {
      path: "assets/theme-art/kawaii-idol/background.webp",
      position: "center",
      size: "cover",
      mobile: "keep",
      opacity: 0.5,
      mask: "none",
      role: "background",
      appearance: "light",
      contextOverrides: null,
    },
    {
      path: "assets/theme-art/kawaii-idol/hero.webp",
      position: "right top",
      size: "auto min(74%, 660px)",
      mobile: "reduce",
      opacity: 0.92,
      mask: "soft-right",
      role: "hero",
      appearance: "light",
      contextOverrides: { conversation: { hidden: true }, other: { hidden: true } },
    },
    {
      path: "assets/theme-art/kawaii-idol/dark-new-chat.webp",
      position: "right top",
      size: "cover",
      mobile: "keep",
      opacity: 0.82,
      mask: "none",
      role: "background",
      appearance: "dark",
      contextOverrides: { conversation: { hidden: true }, other: { hidden: true } },
    },
    {
      path: "assets/theme-art/kawaii-idol/dark-conversation.webp",
      position: "right top",
      size: "cover",
      mobile: "keep",
      opacity: 0.82,
      mask: "none",
      role: "background",
      appearance: "dark",
      contextOverrides: { "new-chat": { hidden: true }, other: { hidden: true } },
    },
  ]);
  const koreanIdol = themes.find((theme) => theme.name === "korean-idol");
  assert.deepEqual(koreanIdol.newChatLayout, {
    widthRatio: 0.76,
    offsetXRatio: -0.07,
    offsetYRatio: 0,
  });
  assert.deepEqual(koreanIdol.artworkLayers, [
    {
      path: "assets/theme-art/korean-idol/light-scene.webp",
      position: "center",
      size: "cover",
      mobile: "keep",
      opacity: 1,
      mask: "none",
      role: "background",
      appearance: "light",
      contextOverrides: null,
    },
    {
      path: "assets/theme-art/korean-idol/hero.webp",
      position: "right top",
      size: "min(38vw, 620px) auto",
      mobile: "reduce",
      opacity: 0.96,
      mask: "soft-right",
      role: "hero",
      appearance: "light",
      contextOverrides: {
        conversation: { hidden: true },
        other: { hidden: true },
      },
    },
    {
      path: "assets/theme-art/korean-idol/dark-new-chat.webp",
      position: "right top",
      size: "cover",
      mobile: "keep",
      opacity: 0.78,
      mask: "none",
      role: "background",
      appearance: "dark",
      contextOverrides: { conversation: { hidden: true }, other: { hidden: true } },
    },
    {
      path: "assets/theme-art/korean-idol/dark-conversation.webp",
      position: "right top",
      size: "cover",
      mobile: "keep",
      opacity: 0.78,
      mask: "none",
      role: "background",
      appearance: "dark",
      contextOverrides: { "new-chat": { hidden: true }, other: { hidden: true } },
    },
  ]);
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
  const legacyDefault = JSON.parse(await fs.readFile(path.join(PROJECT_ROOT, "themes", "default.json"), "utf8"));
  delete legacyDefault.launcher;
  assert.deepEqual(validateTheme(legacyDefault).launcher, {
    asset: "assets/theme-art/default/launcher-mark.png",
    surface: "#2F2937",
    surfaceHover: "#3B3346",
    foreground: "#F4DFBB",
    accent: "#D66D4B",
    border: "#655C70",
    radius: 16,
    borderWidth: 1,
  }, "A theme without launcher metadata must receive the safe Aura default");
  assert.throws(() => validateTheme({
    ...legacyDefault,
    launcher: { asset: "https://example.com/launcher.png" },
  }), /launcher.*asset/, "Launcher assets must remain local and allowlisted");
  assert.throws(() => validateTheme({
    ...legacyDefault,
    launcher: { surface: "#FFFFFF", surfaceHover: "#FFFFFF", foreground: "#FFFFFF" },
  }), /4\.5:1 contrast/, "Launcher text must remain readable at rest and on hover");
  assert.equal(new Set(profiles).size, THEME_IDS.length, "Every theme must have a distinct typography/shape/effects profile");
  const baseCss = await fs.readFile(path.join(PROJECT_ROOT, "assets", "base.css"), "utf8");
  const variants = await fs.readFile(path.join(PROJECT_ROOT, "assets", "theme-variants.css"), "utf8");
  const interactiveSelector = 'html.claude-aura :is(button, [role="button"], [role="link"], [role="tab"], [role="menuitem"], [role="option"])';
  const broadLinkSelector = 'html.claude-aura :is(button, [role="button"], a, [role="link"], [role="tab"], [role="menuitem"], [role="option"])';
  assert(baseCss.includes(`${interactiveSelector} {`), "Shared interactive typography rule is missing");
  const controlSelector = 'html.claude-aura :is(button, [role="button"], [role="link"], [role="tab"], [role="menuitem"], [role="option"])';
  const controlStart = baseCss.indexOf(`${controlSelector},`);
  assert(controlStart >= 0, "Shared semantic-control rule is missing");
  const controlBody = baseCss.slice(controlStart, baseCss.indexOf("}", controlStart));
  assert.match(controlBody, /border-radius:\s*var\(--aura-control-radius\)/);
  for (const state of [":not([disabled]):not([aria-disabled=\"true\"]):hover", ":not([disabled]):not([aria-disabled=\"true\"]):active", ":is([disabled], [aria-disabled=\"true\"])"]) {
    assert(baseCss.includes(`${controlSelector}${state}`), `Shared semantic controls lack ${state} styling`);
    assert(!baseCss.includes(`${broadLinkSelector}${state}`), `Bare prose links must not receive ${state} control styling`);
  }
  assert.match(baseCss, /:is\(hr, \[role="separator"\]\)/);
  for (const status of ["info", "success", "warning", "loading"]) assert(baseCss.includes(`[data-status="${status}"]`), `${status} status styling is missing`);
  assert.match(baseCss, /\[role="progressbar"\]/);
  assert.match(baseCss, /\[data-settings-panel\]/);
  assert.match(baseCss, /\[data-testid\*="workspace"\]/);
  assert.match(baseCss, /\[data-testid\*="quick-action"\]/);
  assert(!/:is\([^{}]*(?:button|\[role="button"\])[^{}]*\)\s+:is\(svg, \[data-icon\]\)\s*\{[^}]*\b(?:background|box-shadow|border-radius|transform)\s*:/s.test(`${baseCss}\n${variants}`),
    "Aura must not draw boxes, shadows, or transforms around Claude's nested icons");
  assert(baseCss.includes("[data-claude-aura-sidebar]"), "Live sidebar styling must use the semantic Aura marker");
  assert(!baseCss.includes(".dframe-sidebar"), "Live sidebar styling must not depend on Claude's unstable class name");
  assert(!variants.includes(".dframe-sidebar"), "Theme variants must use the semantic sidebar marker");
  const hoverStart = baseCss.indexOf(`${controlSelector}:not([disabled]):not([aria-disabled="true"]):hover`);
  const hoverBody = baseCss.slice(hoverStart, baseCss.indexOf("}", hoverStart));
  assert(hoverStart >= 0 && /background:\s*hsl\(var\(--aura-hover-surface\)/.test(hoverBody));
  assert.match(hoverBody, /color:\s*hsl\(var\(--aura-text-primary\)\)/);
  assert(!/border-color:[^;]*--aura-accent-primary/.test(hoverBody));
  assert.match(hoverBody, /transform:\s*none/);
  const selectedStart = baseCss.indexOf('html.claude-aura :is(button, a[href], [role="button"]');
  assert(selectedStart >= 0, "Selected states must be scoped to interactive elements");
  assert(!/html\.claude-aura\s+:is\(\[aria-current/.test(baseCss), "Bare state wrappers must not receive selected styling");
  const focusStart = baseCss.indexOf("html.claude-aura :focus-visible");
  assert(focusStart > selectedStart,
    "Visible focus styling must follow hover/selected/active styling");
  const focusBody = baseCss.slice(focusStart, baseCss.indexOf("}", focusStart));
  assert.match(focusBody, /outline:\s*1px solid hsl\(var\(--aura-focus-ring\) \/ 0\.72\)/,
    "Focus styling must use the softened one-pixel ring");
  assert.match(focusBody, /box-shadow:\s*0 0 0 4px hsl\(var\(--aura-focus-ring\) \/ 0\.14\)/,
    "Focus styling must retain a low-alpha halo");
  for (const id of THEME_IDS) {
    assert(variants.includes(`data-claude-aura-theme="${id}"] { --aura-state-shadow:`),
      `${id} lacks its restrained state shadow`);
  }
  const exactArtworkSelector = 'html.claude-aura:is([data-claude-aura-theme="cartoon-studio"], [data-claude-aura-theme="anime-twilight"], [data-claude-aura-theme="study-library"]) #claude-aura-backdrop .claude-aura-theme-art-layer';
  assert(variants.includes(`${exactArtworkSelector} {\n  animation: none;\n}`),
    "Recipe-defined layered themes must preserve their exact per-layer opacity");
  const studyCornerSelector = 'html.claude-aura[data-claude-aura-theme="study-library"] #claude-aura-backdrop [data-art-role="decoration"]';
  assert(variants.includes(`${studyCornerSelector} {\n  left: var(--aura-main-start, 0px);\n}`),
    "Study Library corner must anchor to the content edge instead of beneath the sidebar");
  assert(!variants.includes('.claude-aura-theme-art-layer + .claude-aura-theme-art-layer'),
    "Study Library must not offset an appearance-specific full-bleed background as if it were the corner vignette");
  assert(!variants.includes('[data-claude-aura-effective-mode="dark"] #claude-aura-backdrop [data-art-role="hero"]'),
    "Korean Idol dark mode must use dedicated scenes instead of dimming the light portrait");
  const koreanSidebarSelector = 'html.claude-aura[data-claude-aura-theme="korean-idol"] [data-claude-aura-sidebar]';
  const koreanSidebarStart = variants.indexOf(`${koreanSidebarSelector} {`);
  assert(koreanSidebarStart >= 0, "Korean Idol must expose its full-window art beneath one sidebar overlay");
  const koreanSidebarBody = variants.slice(koreanSidebarStart, variants.indexOf("}", koreanSidebarStart));
  assert.match(koreanSidebarBody, /--cds-page-bg:\s*transparent\s*!important/);
  assert.match(koreanSidebarBody, /background-color:\s*hsl\(var\(--aura-sidebar-background\) \/ var\(--aura-sidebar-alpha\)\)\s*!important/);
  const converter = await fs.readFile(path.join(PROJECT_ROOT, "scripts", "convert-theme-assets.mjs"), "utf8");
  assert(!converter.includes('src: "study-library.svg"'),
    "Study Library selector media must not derive from its retired procedural stand-in");
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
        ["hover", "--aura-text-primary", "--aura-hover-surface", 4.5],
        ["selected", "--aura-text-primary", "--aura-selected-surface", 4.5],
        ["sidebar-selected", "--aura-sidebar-text-primary", "--aura-sidebar-selected", 4.5],
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
  assert.equal(DEFAULT_CONFIG.appearance, "system");
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
  assert.equal(defaultBundle.settings.appearance, "system");
  assert.equal(defaultBundle.settings.artDataUrl, null);
  assert.equal(defaultBundle.settings.artUnavailable, false);
  assert.match(defaultBundle.css, /--aura-background-primary/);
  assert.match(defaultBundle.css, /data-claude-aura-theme="cartoon-studio"/);
  assert.match(defaultBundle.css, /data-claude-aura-effective-mode="light"/);
  assert.match(defaultBundle.css, /data-claude-aura-effective-mode="dark"/);
  assert.match(defaultBundle.payload, /dataset\.claudeAuraTheme/);
  assert.match(defaultBundle.payload, /dataset\.claudeAuraEffectiveMode/);
  assert.match(defaultBundle.payload, /dataset\.claudeAuraContext/);
  assert.match(defaultBundle.payload, /data-claude-aura-prompt/);
  assert.match(defaultBundle.payload, /data-claude-aura-sidebar/);
  assert.match(defaultBundle.payload, /textarea:not\(\[readonly\]\)/);
  assert(!/placeholder|location\.pathname|New chat|Write a message/.test(rendererSource),
    "Context discovery must not depend on localized wording, placeholders, or URL routes");
  assert(!/dataset\.(?:mode|theme)\s*=/.test(rendererSource),
    "Aura appearance must not mutate Claude-owned mode or theme attributes");
  assert.match(defaultBundle.payload, /claude-aura-theme-art/);
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
  assert(Buffer.byteLength(studioRuntimeBundle.payload.replace(studioDataUrl, ""), "utf8") < 65_000,
    "Eight-layer Studio renderer chrome exceeded the 65 KB budget");

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
    return bytes;
  };
  const assertWebpAlpha = (themeName, artworkPath, bytes) => {
    const vp8xOffset = bytes.indexOf(Buffer.from("VP8X"));
    assert(vp8xOffset >= 0 && (bytes[vp8xOffset + 8] & 0x10) !== 0,
      `${themeName} ${path.basename(artworkPath)} must retain real alpha instead of a baked matte`);
  };
  for (const theme of themes.filter((item) => item.artwork)) {
    await validateSvgArtwork(theme.name, path.join(PROJECT_ROOT, theme.artwork.path));
  }
  for (const theme of themes.filter((item) => item.artworkLayers)) {
    for (const layer of theme.artworkLayers) {
      const artworkPath = path.join(PROJECT_ROOT, layer.path);
      if (layer.path.endsWith(".svg")) await validateSvgArtwork(theme.name, artworkPath);
      else {
        const bytes = await validateRasterArtwork(theme.name, artworkPath);
        if (["hero", "decoration"].includes(layer.role)) assertWebpAlpha(theme.name, artworkPath, bytes);
      }
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
  const verifier = await fs.readFile(path.join(PROJECT_ROOT, "scripts", "verify-cycle.mjs"), "utf8");
  assert.match(verifier, /const MODES = \["light", "dark"\]/);
  assert.match(verifier, /for \(const mode of MODES\)/);
  assert.match(verifier, /new Function\(bundle\.payload\)/);
  assert.match(verifier, /actual Aura on live claude\.ai/);
  for (const forbidden of ["claude-dom", "--screenshot", "docs/golden", "dist/verify", "aura-verify-preload"]){
    assert(!verifier.includes(forbidden), `verify:cycle retains forbidden image-fixture hook: ${forbidden}`);
  }
  await assert.rejects(fs.access(path.join(PROJECT_ROOT, "docs", "golden")),
    (error) => error?.code === "ENOENT", "Fixture golden directory still exists");
  await assert.rejects(fs.access(path.join(PROJECT_ROOT, "tests", "fixtures", "claude-dom.html")),
    (error) => error?.code === "ENOENT", "Claude DOM image fixture still exists");
  for (const retiredPath of [
    "preview",
    "docs/theme-screenshots",
    "scripts/qa-board.mjs",
  ]) {
    await assert.rejects(fs.access(path.join(PROJECT_ROOT, ...retiredPath.split("/"))),
      (error) => error?.code === "ENOENT", `Retired fixture surface still exists: ${retiredPath}`);
  }

  const artifactFiles = [];
  const scanArtifacts = async (directory, relativeDirectory = "") => {
    let entries;
    try {
      entries = await fs.readdir(directory, { withFileTypes: true });
    } catch (error) {
      if (error.code === "ENOENT") return;
      throw error;
    }
    for (const entry of entries) {
      const relativePath = relativeDirectory ? `${relativeDirectory}/${entry.name}` : entry.name;
      const absolutePath = path.join(directory, entry.name);
      if (entry.isDirectory()) await scanArtifacts(absolutePath, relativePath);
      else if (entry.isFile()) artifactFiles.push(relativePath.replaceAll("\\", "/"));
    }
  };
  await scanArtifacts(path.join(PROJECT_ROOT, "dist", "verify"), "dist/verify");
  await scanArtifacts(path.join(PROJECT_ROOT, "themes"), "themes");
  const retiredFixturePatterns = [
    /^dist\/verify\/[^/]+-(?:light|dark)-1440x900\.(?:html|png)$/,
    /\/qa\/qa-board\.png$/,
    /\/provisional\/candidates\/.*candidate-[123]-(?:light|dark)-1440x900\.png$/,
    /\/qa\/selected-(?:light|dark)-1440x900\.png$/,
    /\/references\/checkpoint-a-(?:light|dark)-1440x900\.png$/,
  ];
  assert.deepEqual(artifactFiles.filter((file) => retiredFixturePatterns.some((pattern) => pattern.test(file))), [],
    "A retired fixture image or render harness artifact was recreated");

  const [queuePlan, workOrders, blockedPlan] = await Promise.all([
    fs.readFile(path.join(PROJECT_ROOT, "docs", "plans", "QUEUE.md"), "utf8"),
    fs.readFile(path.join(PROJECT_ROOT, "docs", "plans", "WORK_ORDERS.md"), "utf8"),
    fs.readFile(path.join(PROJECT_ROOT, "docs", "plans", "BLOCKED.md"), "utf8"),
  ]);
  assert.match(queuePlan, /remove and never\s+regenerate the reconstructed offline preview, fake\/fixture UI images/i);
  assert.match(workOrders, /Permanent evidence policy[\s\S]*Do not regenerate it\./);
  assert(!blockedPlan.includes("later queued capture sweep may use the existing Node spawn-based screenshot launcher"),
    "A blocked item still schedules a retired offline screenshot retry");
});

test("theme-cli scaffolds a complete starter kit and validates it", async () => {
  const temporary = await fs.mkdtemp(path.join(PROJECT_ROOT, "tests", ".tmp-"));
  const cliPath = path.join(PROJECT_ROOT, "scripts", "theme-cli.mjs");
  const themeId = "cedar-mist";
  try {
    const snippet = JSON.parse(run(process.execPath, [cliPath, "scaffold", themeId], { cwd: temporary }));
    assert.equal(snippet.id, themeId);
    assert.equal(snippet.labels.en, "Cedar Mist");
    assert.equal(snippet.labels["zh-CN"], `自定义主题（${themeId}）`);
    assert.equal(snippet.labels["zh-TW"], `自訂主題（${themeId}）`);
    assert.equal(snippet.artwork, null);
    assert.equal(snippet.swatches.length >= 3, true);

    const themePath = path.join(temporary, "themes", `${themeId}.json`);
    const kitPath = path.join(temporary, "themes", themeId, "theme.json");
    const checklistPath = path.join(temporary, "themes", themeId, "CHECKLIST.md");
    const themeBytes = await fs.readFile(themePath, "utf8");
    const kitBytes = await fs.readFile(kitPath, "utf8");
    const checklistBytes = await fs.readFile(checklistPath, "utf8");
    const theme = JSON.parse(themeBytes);
    const kitDocument = JSON.parse(kitBytes);
    assert.equal(theme.name, themeId);
    assert.equal(theme.variant, themeId);
    assert.match(theme.$comment, /Starter theme copied from Default/);
    for (const section of ["typography", "shape", "effects", "light", "dark"]) {
      assert.equal(typeof theme[section].$comment, "string", `${section} lacks scaffold guidance`);
    }
    assert.equal(validateTheme(theme, themePath).name, themeId);
    assert.equal(kitDocument.schemaVersion, 1);
    assert.equal(kitDocument.id, themeId);
    assert.equal(kitDocument.theme.name, themeId);
    assert.equal(kitDocument.theme.variant, themeId);
    assert.equal(kitDocument.theme.launcher.asset, "assets/theme-art/default/launcher-mark.png");
    assert.match(checklistBytes, /launcher-mark\.png[\s\S]*theme\.launcher\.asset/);
    assert.equal((await readThemeKit(path.dirname(kitPath))).id, themeId);
    const schemaV1Compiled = await compileTheme({
      config: { ...DEFAULT_CONFIG, theme: themeId },
      themeKitDirectory: path.dirname(kitPath),
    });
    assert.equal(schemaV1Compiled.settings.backgroundScope, "full-window",
      "Schema-v1 themes must preserve their pre-editor full-window artwork behavior");

    const customLauncherDirectory = path.join(temporary, "custom-launcher-valid");
    await fs.mkdir(customLauncherDirectory);
    const launcherBytes = await fs.readFile(path.join(PROJECT_ROOT, "assets", "theme-art", "default", "launcher-mark.png"));
    await fs.writeFile(path.join(customLauncherDirectory, "launcher-mark.png"), launcherBytes);
    await fs.writeFile(path.join(customLauncherDirectory, "theme.json"), `${JSON.stringify({
      ...kitDocument,
      id: "custom-launcher-valid",
      theme: {
        ...kitDocument.theme,
        name: "custom-launcher-valid",
        variant: "custom-launcher-valid",
        launcher: { ...kitDocument.theme.launcher, asset: "launcher-mark.png" },
      },
    }, null, 2)}\n`, "utf8");
    assert.equal((await readThemeKit(customLauncherDirectory)).theme.launcher.asset, "launcher-mark.png");

    const invalidLauncherDirectory = path.join(temporary, "custom-launcher-invalid");
    await fs.mkdir(invalidLauncherDirectory);
    const wrongSizeLauncher = Buffer.from(launcherBytes);
    wrongSizeLauncher.writeUInt32BE(95, 16);
    await fs.writeFile(path.join(invalidLauncherDirectory, "launcher-mark.png"), wrongSizeLauncher);
    await fs.writeFile(path.join(invalidLauncherDirectory, "theme.json"), `${JSON.stringify({
      ...kitDocument,
      id: "custom-launcher-invalid",
      theme: {
        ...kitDocument.theme,
        name: "custom-launcher-invalid",
        variant: "custom-launcher-invalid",
        launcher: { ...kitDocument.theme.launcher, asset: "launcher-mark.png" },
      },
    }, null, 2)}\n`, "utf8");
    await assert.rejects(readThemeKit(invalidLauncherDirectory), /exactly 96×96 pixels/);

    const invalidMetadata = [
      ["layout-range", { newChatLayout: { widthRatio: 0.99, offsetXRatio: 0, offsetYRatio: 0 } }, /widthRatio must be between/],
      ["layout-shape", { newChatLayout: { widthRatio: 0.76, offsetXRatio: 0, offsetYRatio: 0, path: "C:\\private.png" } }, /must contain only/],
      ["layer-role", { artworkLayers: [{ path: "background.png", role: "widget" }] }, /role has an unsupported value/],
      ["layer-appearance", { artworkLayers: [{ path: "background.png", appearance: "system" }] }, /appearance must be light or dark/],
      ["legacy-appearance", { artwork: { path: "hero.svg", appearance: "dark" } }, /appearance is only supported in artworkLayers/],
      ["layer-context", { artworkLayers: [{ path: "background.png", contextOverrides: { newchat: { opacity: 0.5 } } }] }, /unsupported context/],
      ["layer-resource", { artworkLayers: [{ path: "background.png", contextOverrides: { conversation: { position: "url(https://example.com/x)" } } }] }, /may not load remote resources/],
      ["layer-hidden", { artworkLayers: [{ path: "background.png", contextOverrides: { conversation: { hidden: "yes" } } }] }, /hidden must be true or false/],
    ];
    for (const [folder, metadata, pattern] of invalidMetadata) {
      const invalidDirectory = path.join(temporary, folder);
      await fs.mkdir(invalidDirectory);
      await fs.writeFile(path.join(invalidDirectory, "theme.json"), `${JSON.stringify({ ...kitDocument, ...metadata }, null, 2)}\n`, "utf8");
      await assert.rejects(readThemeKit(invalidDirectory), pattern);
    }

    const appearanceDirectory = path.join(temporary, "layer-appearance-valid");
    await fs.mkdir(appearanceDirectory);
    await fs.copyFile(
      path.join(PROJECT_ROOT, "assets", "theme-art", "anime-twilight", "background.webp"),
      path.join(appearanceDirectory, "background.webp"),
    );
    await fs.writeFile(path.join(appearanceDirectory, "theme.json"), `${JSON.stringify({
      ...kitDocument,
      artworkLayers: [{ path: "background.webp", appearance: "dark" }],
    }, null, 2)}\n`, "utf8");
    const appearanceKit = await readThemeKit(appearanceDirectory);
    assert.equal(appearanceKit.metadata.artworkLayers[0].appearance, "dark");

    // Studio-authored schema-v2 kits add editor-only framing and applicability
    // without changing the schema-v1 contract used by hand-authored kits.
    const studioThemeId = "studio-eight";
    const studioDirectory = path.join(temporary, studioThemeId);
    const studioArtworkDirectory = path.join(studioDirectory, "artwork");
    await fs.mkdir(studioArtworkDirectory, { recursive: true });
    const studioLayers = [];
    const sourceArtwork = path.join(PROJECT_ROOT, "assets", "theme-art", "anime-twilight", "card-preview.webp");
    for (let index = 0; index < STUDIO_MAX_LAYERS; index += 1) {
      const suffix = index.toString(16).padStart(32, "0");
      const layerName = `layer-${suffix}`;
      await fs.copyFile(sourceArtwork, path.join(studioArtworkDirectory, `${layerName}.webp`));
      studioLayers.push({
        id: layerName,
        path: `artwork/${layerName}.webp`,
        role: ["background", "hero", "corner", "decoration"][index % 4],
        appearance: ["all", "light", "dark"][index % 3],
        context: ["all", "new-chat", "conversation"][index % 3],
        viewport: ["all", "normal", "wide"][index % 3],
        visible: index !== 7,
        opacity: 1 - (index * 0.05),
        mask: index % 2 ? "soft-right" : "none",
        mobile: ["keep", "reduce", "hide"][index % 3],
        frames: {
          normal: { anchor: "top-left", positionX: index, positionY: -index, focalX: 25, focalY: 40, scale: 1 },
          wide: { anchor: "bottom-right", positionX: -index, positionY: index, focalX: 75, focalY: 60, scale: 1.25 },
        },
      });
    }
    for (const layer of studioLayers.slice(1)) layer.path = studioLayers[0].path;
    const studioTheme = {
      ...structuredClone(kitDocument.theme),
      name: studioThemeId,
      variant: studioThemeId,
      radius: 18,
      typography: {
        ...structuredClone(kitDocument.theme.typography),
        ui: STUDIO_FONT_UI_STACKS["system-sans"],
        body: STUDIO_FONT_UI_STACKS["system-sans"],
        display: STUDIO_FONT_DISPLAY_STACKS["editorial-serif"],
      },
      shape: { control: 18, card: 18, composer: 18, icon: 18, borderWidth: 1 },
      effects: {
        ...structuredClone(kitDocument.theme.effects),
        ...STUDIO_SHADOWS.soft,
      },
    };
    const studioDocument = {
      schemaVersion: STUDIO_THEME_SCHEMA_VERSION,
      id: studioThemeId,
      labels: { en: "Studio Eight", "zh-CN": "工作室八层主题", "zh-TW": "工作室八層主題" },
      descriptions: {
        en: "A Studio-authored schema-v2 compatibility fixture.",
        "zh-CN": "用于验证工作室第二版架构兼容性的主题。",
        "zh-TW": "用來驗證工作室第二版架構相容性的主題。",
      },
      swatches: ["#102030", "#405060", "#708090"],
      preview: { chrome: "#102030", background: "#203040", surface: "#304050", accent: "#708090", text: "#F0F4F8" },
      studioPreview: null,
      newChatLayout: { widthRatio: 0.72, offsetXRatio: -0.08, offsetYRatio: 0.12 },
      backgroundScope: "full-window",
      artworkLayers: studioLayers,
      theme: studioTheme,
    };
    await fs.writeFile(path.join(studioDirectory, "theme.json"), `${JSON.stringify(studioDocument, null, 2)}\n`, "utf8");
    const studioKit = await readThemeKit(studioDirectory);
    assert.equal(studioKit.schemaVersion, STUDIO_THEME_SCHEMA_VERSION);
    assert.equal(studioKit.metadata.backgroundScope, "full-window");
    assert.equal(studioKit.metadata.artworkLayers.length, STUDIO_MAX_LAYERS);
    assert.equal(new Set(studioKit.metadata.artworkLayers.map((layer) => layer.path)).size, 1,
      "Schema-v2 validation expanded one shared artwork source into duplicate paths");
    assert.equal(studioKit.theme.typography.body, studioKit.theme.typography.ui);
    assert.equal(studioKit.theme.typography.ui, STUDIO_FONT_UI_STACKS["system-sans"]);
    assert.equal(studioKit.theme.typography.display, STUDIO_FONT_DISPLAY_STACKS["editorial-serif"]);
    assert.deepEqual({
      shadowSoft: studioKit.theme.effects.shadowSoft,
      shadowElevated: studioKit.theme.effects.shadowElevated,
    }, STUDIO_SHADOWS.soft);
    assert.deepEqual(studioKit.theme.shape,
      { control: 18, card: 18, composer: 18, icon: 18, borderWidth: 1 });
    assert.deepEqual(studioKit.metadata.artworkLayers[0].frames.wide,
      { anchor: "bottom-right", positionX: 0, positionY: 0, focalX: 75, focalY: 60, scale: 1.25 });
    const studioCompiled = await compileTheme({
      config: { ...DEFAULT_CONFIG, theme: studioThemeId },
      themeKitDirectory: studioDirectory,
    });
    assert.equal(studioCompiled.settings.backgroundScope, "full-window");
    assert.equal(studioCompiled.settings.artLayers.length, STUDIO_MAX_LAYERS);
    assert.deepEqual(studioCompiled.settings.newChatLayout, studioDocument.newChatLayout);
    assert.equal(studioCompiled.settings.artLayers[1].context, "new-chat");
    assert.equal(studioCompiled.settings.artLayers[2].viewport, "wide");
    assert.equal(studioCompiled.settings.artLayers[7].visible, false);
    assert.equal(new Set(studioCompiled.settings.artLayers.map((layer) => layer.dataUrl)).size, 1,
      "Two schema-v2 layers sharing one path did not share the compiled source");
    const studioPayload = await buildPayloadFromCompiled(studioCompiled);
    new Function(studioPayload.payload);
    const studioRuntimeSettings = readPayloadSettings(studioPayload.payload);
    assert.equal(studioRuntimeSettings.u.length, 1,
      "The renderer payload duplicated a schema-v2 source used by multiple layers");
    assert(studioRuntimeSettings.artLayers.every((layer) => layer.d === 0),
      "Shared schema-v2 layers did not use the same pooled renderer source");
    const embeddedStudioArtBytes = [...new Set(studioCompiled.settings.artLayers.map((layer) => layer.dataUrl))]
      .reduce((total, dataUrl) => total + Buffer.byteLength(dataUrl, "utf8"), 0);
    assert(Buffer.byteLength(studioPayload.payload, "utf8")
      - embeddedStudioArtBytes < 65_000,
    "An eight-layer schema-v2 kit exceeded the renderer chrome budget");

    const tooManyLayersDirectory = path.join(temporary, "studio-nine");
    await fs.cp(studioDirectory, tooManyLayersDirectory, { recursive: true });
    const tooManyLayers = structuredClone(studioDocument);
    tooManyLayers.id = "studio-nine";
    tooManyLayers.theme.name = "studio-nine";
    tooManyLayers.theme.variant = "studio-nine";
    tooManyLayers.artworkLayers.push({ ...structuredClone(studioLayers[0]), id: `layer-${"f".repeat(32)}` });
    await fs.writeFile(path.join(tooManyLayersDirectory, "theme.json"), `${JSON.stringify(tooManyLayers, null, 2)}\n`, "utf8");
    await assert.rejects(readThemeKit(tooManyLayersDirectory), /artworkLayers must contain 0 to 8 layers/);

    const unsafeStudioDirectory = path.join(temporary, "studio-unsafe");
    await fs.cp(studioDirectory, unsafeStudioDirectory, { recursive: true });
    const unsafeStudioDocument = structuredClone(studioDocument);
    unsafeStudioDocument.id = "studio-unsafe";
    unsafeStudioDocument.theme.name = "studio-unsafe";
    unsafeStudioDocument.theme.variant = "studio-unsafe";
    unsafeStudioDocument.theme.customCss = "body { display: none }";
    await fs.writeFile(path.join(unsafeStudioDirectory, "theme.json"), `${JSON.stringify(unsafeStudioDocument, null, 2)}\n`, "utf8");
    await assert.rejects(readThemeKit(unsafeStudioDirectory), /customCss must be empty/);
    assert.equal(kitDocument.schemaVersion, 1, "Schema-v2 validation mutated the existing schema-v1 document");
    assert.equal((await readThemeKit(path.dirname(kitPath))).schemaVersion, 1,
      "Schema-v1 kits stopped loading after schema-v2 validation");

    const slotSpecs = [
      ["background.png", "≥1600 px wide"],
      ["hero.png", "≥1000 px"],
      ["corner-top-right.png", "safe to clip at the viewport edge"],
      ["corner-bottom.png", "safe to clip at the viewport edge"],
      ["card-1.png", "bottom-right 40%"],
      ["card-2.png", "bottom-right 40%"],
      ["card-3.png", "bottom-right 40%"],
      ["brand-mark.png", "restyles the starburst identity"],
    ];
    for (const [slot, cue] of slotSpecs) {
      assert(checklistBytes.includes(`\`${slot}\``), `Checklist is missing ${slot}`);
      assert(checklistBytes.includes(cue), `Checklist is missing the ${slot} specification`);
    }
    assert.match(checklistBytes, /tokens-only theme with no artwork is valid/);

    const validation = JSON.parse(run(process.execPath, [cliPath, "validate", "--theme", themeId], { cwd: temporary }));
    assert.equal(validation.pass, true);
    assert.equal(validation.theme, themeId);
    const folderValidation = JSON.parse(run(process.execPath, [cliPath, "validate", path.dirname(kitPath)], { cwd: temporary }));
    assert.deepEqual({ pass: folderValidation.pass, theme: folderValidation.theme, source: folderValidation.source },
      { pass: true, theme: themeId, source: "folder" });
    assert.equal(folderValidation.sourceFolder, path.dirname(kitPath));
    assert.throws(() => run(process.execPath, [cliPath, "validate", "--theme", "not-installed"], { cwd: temporary }),
      /Theme not found: not-installed/);

    const edgeId = "a--b";
    const edgeSnippet = JSON.parse(run(process.execPath, [cliPath, "scaffold", edgeId], { cwd: temporary }));
    assert.equal(edgeSnippet.labels.en, "A B");
    assert.equal(JSON.parse(await fs.readFile(path.join(temporary, "themes", `${edgeId}.json`), "utf8")).name, edgeId);
    assert.equal(JSON.parse(run(process.execPath, [cliPath, "validate", "--theme", edgeId], { cwd: temporary })).theme, edgeId);

    assert.throws(() => run(process.execPath, [cliPath, "scaffold", themeId], { cwd: temporary }), /already exists/);
    assert.equal(await fs.readFile(themePath, "utf8"), themeBytes, "Repeated scaffold changed the theme template");
    assert.equal(await fs.readFile(kitPath, "utf8"), kitBytes, "Repeated scaffold changed the standalone theme kit");
    assert.equal(await fs.readFile(checklistPath, "utf8"), checklistBytes, "Repeated scaffold changed the slot checklist");

    const beforeInvalid = (await fs.readdir(path.join(temporary, "themes"))).sort();
    for (const invalidId of ["a", "Uppercase", "under_score", "../escape", "a".repeat(41)]) {
      assert.throws(() => run(process.execPath, [cliPath, "scaffold", invalidId], { cwd: temporary }),
        /Theme id must match/);
      assert.deepEqual((await fs.readdir(path.join(temporary, "themes"))).sort(), beforeInvalid,
        `Invalid id created output: ${invalidId}`);
    }
    assert.throws(() => run(process.execPath, [cliPath, "scaffold", "default"], { cwd: temporary }), /already exists/);
  } finally {
    await fs.rm(temporary, { recursive: true, force: true });
  }
});

test("user theme kits append, apply, persist, warn on collisions, and uninstall by one folder", async () => {
  const temporary = await fs.mkdtemp(path.join(PROJECT_ROOT, "tests", ".tmp-"));
  const cliPath = path.join(PROJECT_ROOT, "scripts", "theme-cli.mjs");
  const authoringRoot = path.join(temporary, "authoring");
  const userThemesDir = path.join(temporary, "user-themes");
  const themeId = "constructor";
  try {
    await fs.mkdir(authoringRoot, { recursive: true });
    run(process.execPath, [cliPath, "scaffold", themeId], { cwd: authoringRoot });
    const sourceKit = path.join(authoringRoot, "themes", themeId);
    const validated = JSON.parse(run(process.execPath, [cliPath, "validate", sourceKit], { cwd: authoringRoot }));
    assert.deepEqual({ pass: validated.pass, theme: validated.theme, source: validated.source },
      { pass: true, theme: themeId, source: "folder" });

    await fs.mkdir(userThemesDir, { recursive: true });
    const installedFolder = path.join(userThemesDir, themeId);
    await fs.cp(sourceKit, installedFolder, { recursive: true, force: false, errorOnExist: true });

    const initialWarnings = [];
    const registry = await readThemeRegistry({
      userThemesDir,
      onWarning: (message) => initialWarnings.push(message),
    });
    assert.deepEqual(registry.themes.slice(0, THEME_IDS.length).map((theme) => theme.id), THEME_IDS,
      "User themes changed the frozen built-in order");
    assert.deepEqual(registry.themes.slice(THEME_IDS.length).map((theme) => theme.id), [themeId],
      "Validated user themes must append after built-ins");
    assert.equal(registry.themes.at(-1).source, "user");
    assert.deepEqual(initialWarnings, []);
    const localizedThemes = await listThemes({ locale: "zh-TW", userThemesDir });
    const installedTheme = localizedThemes.find((theme) => theme.name === themeId);
    assert(installedTheme, "The installed user theme did not appear in the runtime list");
    assert.equal(installedTheme.source, "user");
    assert.equal(installedTheme.label, `自訂主題（${themeId}）`);

    const configPath = path.join(temporary, "config.json");
    await writeConfig(configPath, { ...DEFAULT_CONFIG });
    const applied = JSON.parse(run(process.execPath, [
      cliPath, "set", "--config", configPath, "--theme", themeId,
      "--user-themes", userThemesDir,
    ]));
    assert.equal(applied.theme, themeId, "Studio-equivalent set did not apply the imported theme immediately");
    assert.equal(JSON.parse(await fs.readFile(configPath, "utf8")).theme, themeId);
    const appliedBundle = await buildPayload({ configPath, userThemesDir });
    assert.equal(appliedBundle.theme.name, themeId);
    assert.equal(appliedBundle.settings.theme, themeId);
    new Function(appliedBundle.payload);

    run(process.execPath, [cliPath, "init", "--config", configPath, "--user-themes", userThemesDir]);
    const restarted = JSON.parse(run(process.execPath, [
      cliPath, "show", "--config", configPath, "--json", "--user-themes", userThemesDir,
    ]));
    assert.equal(restarted.theme.name, themeId, "The imported theme did not survive restart initialization");

    const collisionFolder = path.join(userThemesDir, "default");
    await fs.cp(sourceKit, collisionFolder, { recursive: true, force: false, errorOnExist: true });
    const collisionWarnings = [];
    const collisionRegistry = await readThemeRegistry({
      userThemesDir,
      onWarning: (message) => collisionWarnings.push(message),
    });
    assert.equal(collisionRegistry.themes.filter((theme) => theme.id === "default").length, 1);
    assert.equal(collisionRegistry.themes.find((theme) => theme.id === "default").source, "builtin");
    assert(collisionWarnings.some((message) => /built-in theme or alias takes precedence/.test(message)),
      "A user/built-in id collision did not surface a warning");
    const cliList = spawnSync(process.execPath, [
      cliPath, "list", "--json", "--user-themes", userThemesDir,
    ], { cwd: PROJECT_ROOT, encoding: "utf8" });
    assert.equal(cliList.status, 0, cliList.stderr);
    assert.match(cliList.stderr, /Warning: User theme "default" was ignored/,
      "The CLI hid the built-in collision warning");
    assert.equal(JSON.parse(cliList.stdout).filter((theme) => theme.name === "default").length, 1);

    const invalidKit = path.join(temporary, "invalid-kit");
    await fs.cp(sourceKit, invalidKit, { recursive: true, force: false, errorOnExist: true });
    const invalidDocumentPath = path.join(invalidKit, "theme.json");
    const invalidDocument = JSON.parse(await fs.readFile(invalidDocumentPath, "utf8"));
    invalidDocument.theme.name = "Invalid Theme";
    await fs.writeFile(invalidDocumentPath, `${JSON.stringify(invalidDocument, null, 2)}\n`, "utf8");
    const beforeInvalid = (await fs.readdir(userThemesDir)).sort();
    const invalidResult = spawnSync(process.execPath, [cliPath, "validate", invalidKit], {
      cwd: PROJECT_ROOT,
      encoding: "utf8",
    });
    assert.notEqual(invalidResult.status, 0);
    assert.match(invalidResult.stderr, /theme\.json\.theme\.name must be lowercase kebab-case/,
      "Invalid kit rejection did not surface the validator's message");
    assert(!/\n\s+at\s/.test(invalidResult.stderr), "Kit validation leaked a stack instead of a usable message");
    assert.deepEqual((await fs.readdir(userThemesDir)).sort(), beforeInvalid,
      "Rejected validation copied files into the user themes directory");

    const invalidMutations = [
      ["custom-css", (document) => { document.theme.customCss = "body { display: none }"; }, /customCss must be empty/],
      ["variant", (document) => { document.theme.variant = "different-theme"; }, /variant must match id/],
      ["mobile", (document) => {
        document.artwork = null;
        document.artworkLayers = [{ path: "hero.png", mobile: "sideways" }];
      }, /mobile has an unsupported value/],
      ["mask", (document) => {
        document.artwork = null;
        document.artworkLayers = [{ path: "hero.png", mask: "unsafe" }];
      }, /mask has an unsupported value/],
      ["svg", (document) => {
        document.artwork = { path: "hero.svg" };
        document.artworkLayers = null;
      }, /not a supported theme-kit slot path/],
    ];
    for (const [name, mutate, expected] of invalidMutations) {
      const caseFolder = path.join(temporary, `invalid-${name}`);
      await fs.cp(sourceKit, caseFolder, { recursive: true, force: false, errorOnExist: true });
      const casePath = path.join(caseFolder, "theme.json");
      const caseDocument = JSON.parse(await fs.readFile(casePath, "utf8"));
      mutate(caseDocument);
      await fs.writeFile(casePath, `${JSON.stringify(caseDocument, null, 2)}\n`, "utf8");
      await assert.rejects(() => readThemeKit(caseFolder), expected,
        `Standalone kit mutation ${name} was silently accepted`);
    }

    const invalidInstalledFolder = path.join(userThemesDir, "broken-user");
    await fs.cp(invalidKit, invalidInstalledFolder, { recursive: true, force: false, errorOnExist: true });
    const invalidWarnings = [];
    const registryWithInvalid = await readThemeRegistry({
      userThemesDir,
      onWarning: (message) => invalidWarnings.push(message),
    });
    assert(!registryWithInvalid.themes.some((theme) => theme.id === "broken-user"));
    assert(invalidWarnings.some((message) => /User theme "broken-user" was ignored:/.test(message)),
      "An invalid installed kit was not ignored with a warning");

    // The Studio editor lifecycle is exercised through the same exported
    // request dispatcher used by the host CLI. This intentionally starts with
    // a schema-v1 user theme, creates a schema-v2 copy, mutates only validated
    // fields, imports host-owned WebPs, rolls back failed saves, restarts, and
    // finally deletes the temporary theme.
    const studioUserThemesDir = path.join(temporary, "studio-user-themes");
    const studioEditorRoot = path.join(temporary, "studio-editor");
    const studioImportsRoot = path.join(studioEditorRoot, "imports");
    const studioConfigPath = path.join(temporary, "studio-config.json");
    await fs.mkdir(studioUserThemesDir, { recursive: true });
    await fs.cp(sourceKit, path.join(studioUserThemesDir, themeId), { recursive: true });
    await writeConfig(studioConfigPath, { ...DEFAULT_CONFIG });
    const studioRequest = (request, options = {}) => executeStudioRequest({
      request,
      configPath: studioConfigPath,
      userThemesDir: studioUserThemesDir,
      editorRoot: studioEditorRoot,
      locale: "en",
      ...options,
    });
    const mutationRequest = (result, type, values = {}) => ({
      type,
      session: result.state.session,
      revision: result.state.revision,
      ...values,
    });

    await assert.rejects(studioRequest({ type: "begin-theme-edit", theme: "default", reset: false }),
      /Built-in themes must be duplicated/,
    "Studio allowed direct editing of a built-in theme");
    let studioResult = await studioRequest({ type: "begin-theme-edit", theme: themeId, reset: false });
    assert.equal(studioResult.state.active, true);
    assert.equal(studioResult.state.source, "user");
    assert.equal(studioResult.state.isNew, false);
    assert.equal(studioResult.state.shared.backgroundScope, "full-window",
      "Opening a schema-v1 user theme changed its legacy background scope");
    assert.equal(studioResult.apply, "draft");
    studioResult = await studioRequest(mutationRequest(studioResult, "discard-theme-edit"));
    assert.equal(studioResult.state.active, false);
    assert.equal((await readThemeKit(path.join(studioUserThemesDir, themeId))).schemaVersion, 1,
      "Discarding an unmodified schema-v1 edit migrated the installed kit");

    for (const idolThemeId of ["japanese-idol", "korean-idol"]) {
      studioResult = await studioRequest({ type: "create-theme-copy", theme: idolThemeId });
      const activeStudioDirectory = path.join(studioEditorRoot, "active");
      const activeStudioDocument = JSON.parse(await fs.readFile(
        path.join(activeStudioDirectory, "theme.json"), "utf8",
      ));
      assert.equal(activeStudioDocument.theme.variant, idolThemeId,
        `${idolThemeId} duplication lost its frozen built-in visual recipe`);
      assert.equal(activeStudioDocument.sourceRecipe, idolThemeId,
        `${idolThemeId} duplication lost its trusted source recipe reference`);
      assert.deepEqual(activeStudioDocument.controlOverrides, [],
        `${idolThemeId} duplication marked untouched controls as overridden`);
      const legacyLayerIndex = activeStudioDocument.artworkLayers.findIndex((layer) => layer.legacy);
      assert(legacyLayerIndex >= 0, `${idolThemeId} duplication lost its legacy layer framing`);
      const legacyLayer = activeStudioDocument.artworkLayers[legacyLayerIndex];
      const idolCompiled = await compileTheme({
        config: { ...DEFAULT_CONFIG, theme: activeStudioDocument.id },
        themeKitDirectory: activeStudioDirectory,
      });
      const sourceCompiled = await compileTheme({
        config: { ...DEFAULT_CONFIG, theme: idolThemeId },
      });
      for (const primitive of ["typography", "shape", "effects", "light", "dark"]) {
        assert.deepEqual(idolCompiled.theme[primitive], sourceCompiled.theme[primitive],
          `${idolThemeId} no-op duplication changed its ${primitive} recipe`);
      }
      assert.deepEqual(idolCompiled.settings.newChatLayout, sourceCompiled.settings.newChatLayout,
        `${idolThemeId} no-op duplication changed its new-chat layout`);
      assert(idolCompiled.css.includes(`[data-claude-aura-variant="${idolThemeId}"]`),
        `${idolThemeId} duplication lost its variant-scoped recipe selectors`);
      assert(studioResult.payload.includes(`data-claude-aura-variant=\\"${idolThemeId}\\"`),
        `${idolThemeId} payload omitted its variant-scoped recipe selectors`);
      let idolRuntime = readPayloadSettings(studioResult.payload);
      assert.equal(idolRuntime.artLayers[legacyLayerIndex].p, legacyLayer.legacy.position);
      assert.equal(idolRuntime.artLayers[legacyLayerIndex].s, legacyLayer.legacy.size);
      assert.equal(Object.hasOwn(idolRuntime.artLayers[legacyLayerIndex], "n"), false,
        "An untouched legacy layer emitted a Studio frame tuple");

      studioResult = await studioRequest(mutationRequest(studioResult, "set-theme-token", {
        mode: "shared", token: "radius", value: sourceCompiled.theme.shape.card === 31 ? 30 : 31,
      }));
      const controlledDocument = JSON.parse(await fs.readFile(
        path.join(activeStudioDirectory, "theme.json"), "utf8",
      ));
      assert.deepEqual(controlledDocument.controlOverrides, ["radius"],
        `${idolThemeId} did not record the explicitly changed radius control`);
      const controlledCompiled = await compileTheme({
        config: { ...DEFAULT_CONFIG, theme: controlledDocument.id },
        themeKitDirectory: activeStudioDirectory,
      });
      assert.notDeepEqual(controlledCompiled.theme.shape, sourceCompiled.theme.shape,
        `${idolThemeId} ignored an explicit radius change`);
      for (const primitive of ["typography", "effects", "light", "dark"]) {
        assert.deepEqual(controlledCompiled.theme[primitive], sourceCompiled.theme[primitive],
          `${idolThemeId} radius edit changed unrelated ${primitive} recipe values`);
      }
      if (idolThemeId === "japanese-idol") {
        for (const [name, mutate, expected] of [
          ["source-recipe", (document) => { document.sourceRecipe = "not-built-in"; }, /sourceRecipe has an unsupported value/],
          ["control-overrides", (document) => { document.controlOverrides = ["radius", "radius"]; }, /controlOverrides must be unique/],
        ]) {
          const invalidStudioKit = path.join(temporary, `invalid-studio-${name}`);
          await fs.cp(activeStudioDirectory, invalidStudioKit, { recursive: true, force: false, errorOnExist: true });
          const invalidStudioDocumentPath = path.join(invalidStudioKit, "theme.json");
          const invalidStudioDocument = JSON.parse(await fs.readFile(invalidStudioDocumentPath, "utf8"));
          mutate(invalidStudioDocument);
          await fs.writeFile(invalidStudioDocumentPath, `${JSON.stringify(invalidStudioDocument, null, 2)}\n`, "utf8");
          await assert.rejects(() => readThemeKit(invalidStudioKit), expected,
            `Studio v2 accepted invalid ${name} inheritance metadata`);
        }
      }

      studioResult = await studioRequest(mutationRequest(studioResult, "set-theme-layer", {
        index: legacyLayerIndex, preset: "normal", property: "focalX", value: 60,
      }));
      idolRuntime = readPayloadSettings(studioResult.payload);
      assert.equal(Object.hasOwn(idolRuntime.artLayers[legacyLayerIndex], "p"), false);
      assert.equal(Object.hasOwn(idolRuntime.artLayers[legacyLayerIndex], "s"), false);
      assert.equal(idolRuntime.artLayers[legacyLayerIndex].n[2], 60,
        "The first explicit framing edit did not replace legacy position/size with a frame tuple");
      studioResult = await studioRequest(mutationRequest(studioResult, "discard-theme-edit"));
      assert.equal(studioResult.state.active, false);
    }

    studioResult = await studioRequest({ type: "create-theme-copy", theme: "default" });
    const studioThemeId = studioResult.state.id;
    const studioDestination = path.join(studioUserThemesDir, studioThemeId);
    assert.equal(studioThemeId, "default-copy");
    assert.deepEqual({
      active: studioResult.state.active,
      sourceId: studioResult.state.sourceId,
      source: studioResult.state.source,
      isNew: studioResult.state.isNew,
      revision: studioResult.state.revision,
      apply: studioResult.apply,
    }, {
      active: true,
      sourceId: "default",
      source: "builtin",
      isNew: true,
      revision: 0,
      apply: "draft",
    });
    assert.equal(studioResult.state.shared.backgroundScope, "full-window");
    assert.equal(await fs.stat(studioDestination).then(() => true, () => false), false,
      "A duplicate was installed before Save");
    assert.equal(JSON.parse(await fs.readFile(studioConfigPath, "utf8")).theme, "default",
      "A draft changed the persisted theme before Save");
    const redirectedStudioThemes = path.join(temporary, "redirected-studio-user-themes");
    const outsideStudioThemes = path.join(temporary, "outside-studio-user-themes");
    const outsideStudioMarker = path.join(outsideStudioThemes, "keep.txt");
    await fs.mkdir(outsideStudioThemes);
    await fs.writeFile(outsideStudioMarker, "keep", "utf8");
    await fs.symlink(outsideStudioThemes, redirectedStudioThemes, process.platform === "win32" ? "junction" : "dir");
    try {
      await assert.rejects(
        studioRequest(mutationRequest(studioResult, "save-theme-edit"), { userThemesDir: redirectedStudioThemes }),
        /user themes folder must be a regular directory/i,
        "Studio followed a redirected user-theme root while saving",
      );
      assert.equal(await fs.readFile(outsideStudioMarker, "utf8"), "keep",
        "A rejected Studio save changed data behind a redirected user-theme root");
      assert.equal(await fs.stat(path.join(outsideStudioThemes, studioThemeId)).then(() => true, () => false), false,
        "A rejected Studio save installed a theme behind a redirected user-theme root");
      await assert.rejects(
        studioRequest({ type: "delete-user-theme", theme: "outside-theme" }, { userThemesDir: redirectedStudioThemes }),
        /user themes folder must be a regular directory/i,
        "Studio followed a redirected user-theme root while deleting",
      );
      assert.equal(await fs.readFile(outsideStudioMarker, "utf8"), "keep",
        "A rejected Studio delete changed data behind a redirected user-theme root");
    } finally {
      await fs.rm(redirectedStudioThemes, { recursive: true, force: true });
    }
    assert(!JSON.stringify(studioResult.state).includes(temporary),
      "Public editor state exposed its app-data path");
    assert(!/(?:[A-Za-z]:[\\/]|file:)/i.test(JSON.stringify(studioResult.state)),
      "Public editor state exposed a filesystem path or URL");
    new Function(studioResult.payload);

    studioResult = await studioRequest(mutationRequest(studioResult, "set-theme-token", {
      mode: "light", token: "canvas", value: "#F2F4F8",
    }));
    assert.equal(studioResult.state.tokens.light.canvas, "#F2F4F8");
    const restartedDraft = JSON.parse(run(process.execPath, [
      cliPath, "studio-state", "--config", studioConfigPath,
      "--user-themes", studioUserThemesDir, "--editor-root", studioEditorRoot, "--locale", "en",
    ]));
    assert.equal(restartedDraft.state.session, studioResult.state.session,
      "Restart hydration replaced the active draft session");
    assert.equal(restartedDraft.state.revision, studioResult.state.revision,
      "Restart hydration changed the active draft revision");
    assert.equal(restartedDraft.state.tokens.light.canvas, "#F2F4F8",
      "Restart hydration did not restore the current editable document");
    assert.equal(restartedDraft.payload, studioResult.payload,
      "Restart hydration did not reapply the exact last-valid draft payload");
    assert.equal(restartedDraft.apply, "draft");
    studioResult = restartedDraft;
    studioResult = await studioRequest(mutationRequest(studioResult, "set-theme-token", {
      mode: "mode-copy", token: "tokens", value: "light",
    }));
    assert.equal(studioResult.state.tokens.dark.canvas, "#F2F4F8",
      "Copy Light to Dark did not copy the validated mode tokens");
    studioResult = await studioRequest(mutationRequest(studioResult, "set-theme-token", {
      mode: "shared", token: "backgroundScope", value: "content",
    }));
    assert.equal(studioResult.state.shared.backgroundScope, "content");
    const contentRevision = studioResult.state.revision;
    studioResult = await studioRequest(mutationRequest(studioResult, "undo-theme-edit"));
    assert.equal(studioResult.state.shared.backgroundScope, "full-window",
      "Undo did not restore the previous background scope");
    assert.equal(studioResult.state.canRedo, true);
    studioResult = await studioRequest(mutationRequest(studioResult, "redo-theme-edit"));
    assert.equal(studioResult.state.shared.backgroundScope, "content",
      "Redo did not restore the persisted background-scope edit");
    assert(studioResult.state.revision > contentRevision);

    for (const [token, value] of [["promptWidth", 0.64], ["promptX", 0.1], ["promptY", -0.08]]) {
      studioResult = await studioRequest(mutationRequest(studioResult, "set-theme-token", {
        mode: "shared", token, value,
      }));
    }
    assert.deepEqual(studioResult.state.shared.prompt, { width: 0.64, x: 0.1, y: -0.08 });
    studioResult = await studioRequest(mutationRequest(studioResult, "set-theme-token", {
      mode: "shared", token: "fontDisplay", value: "editorial-serif",
    }));
    assert.equal(studioResult.state.shared.fontDisplay, "editorial-serif");

    // Reset is available before the first save and restores the source snapshot
    // in the same guarded edit session instead of trying to read an uninstalled copy.
    const firstSession = studioResult.state.session;
    const firstRevision = studioResult.state.revision;
    studioResult = await studioRequest({ type: "begin-theme-edit", theme: studioThemeId, reset: true });
    assert.equal(studioResult.state.session, firstSession);
    assert(studioResult.state.revision > firstRevision);
    assert.equal(studioResult.state.dirty, false);
    assert.equal(studioResult.state.shared.backgroundScope, "full-window");
    assert.notEqual(studioResult.state.tokens.light.canvas, "#F2F4F8");
    assert.equal(studioResult.state.layers.length, 0);

    // Reapply the intended saved state after reset.
    for (const [mode, token, value] of [
      ["light", "canvas", "#F2F4F8"],
      ["mode-copy", "tokens", "light"],
      ["shared", "backgroundScope", "content"],
      ["shared", "promptWidth", 0.64],
      ["shared", "promptX", 0.1],
      ["shared", "promptY", -0.08],
      ["shared", "fontDisplay", "editorial-serif"],
    ]) {
      studioResult = await studioRequest(mutationRequest(studioResult, "set-theme-token", { mode, token, value }));
    }

    const sourceWebp = path.join(PROJECT_ROOT, "assets", "theme-art", "anime-twilight", "card-preview.webp");
    const revisionBeforeUnsafeAsset = studioResult.state.revision;
    await assert.rejects(studioRequest(mutationRequest(studioResult, "pick-theme-layer-image", {
      index: -1, role: "decoration",
    }), { assetPath: sourceWebp }), /must remain inside the editor data folder/,
    "Studio accepted a page-external artwork path instead of a host-owned converted asset");
    assert.equal(JSON.parse(await fs.readFile(path.join(studioEditorRoot, "active", ".editor-state.json"), "utf8")).revision,
      revisionBeforeUnsafeAsset, "Rejected artwork changed the editor revision");

    await fs.mkdir(studioImportsRoot, { recursive: true });
    const layerRoles = ["background", "hero", "corner", "decoration", "hero", "background", "corner", "decoration"];
    for (let index = 0; index < STUDIO_MAX_LAYERS; index += 1) {
      const importPath = path.join(studioImportsRoot, `layer-${index.toString(16).padStart(32, "0")}.webp`);
      await fs.copyFile(sourceWebp, importPath);
      studioResult = await studioRequest(mutationRequest(studioResult, "pick-theme-layer-image", {
        index: -1,
        role: layerRoles[index],
      }), { assetPath: importPath });
      assert.equal(studioResult.state.layers.length, index + 1);
      assert.match(studioResult.state.layers[index].previewUrl,
        /^https:\/\/aura\.editor\/active\/layer-[a-f0-9]{32}\.webp\?v=[a-f0-9]{64}$/);
      assert(studioResult.state.layers[index].bytes > 0 && studioResult.state.layers[index].bytes < 400_000);
    }
    assert.equal(studioResult.state.feedback.budget.sourceArtworkBytes < 1_400_000, true);
    const ninthImportPath = path.join(studioImportsRoot, `layer-${"f".repeat(32)}.webp`);
    await fs.copyFile(sourceWebp, ninthImportPath);
    const revisionAtLayerLimit = studioResult.state.revision;
    await assert.rejects(studioRequest(mutationRequest(studioResult, "pick-theme-layer-image", {
      index: -1, role: "hero",
    }), { assetPath: ninthImportPath }), /at most 8 artwork layers/,
    "Studio accepted a ninth artwork layer");
    assert.equal(JSON.parse(await fs.readFile(path.join(studioEditorRoot, "active", ".editor-state.json"), "utf8")).revision,
      revisionAtLayerLimit, "The rejected ninth layer changed the saved draft state");

    const staleRevisionRequest = mutationRequest(studioResult, "set-theme-layer", {
      index: 0, preset: "shared", property: "opacity", value: 0.7,
    });
    staleRevisionRequest.revision -= 1;
    await assert.rejects(studioRequest(staleRevisionRequest), /revision is stale/);
    const foreignSessionRequest = { ...staleRevisionRequest, revision: studioResult.state.revision,
      session: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" };
    await assert.rejects(studioRequest(foreignSessionRequest), /session is stale/);
    await assert.rejects(studioRequest({
      ...mutationRequest(studioResult, "set-theme-layer", {
        index: 0, preset: "shared", property: "opacity", value: 0.7,
      }),
      path: "C:\\private.webp",
    }), /(?:must contain only|unsupported property shape)/,
    "The core request dispatcher accepted an extra path property");

    for (const [preset, property, value] of [
      ["shared", "appearance", "light"],
      ["shared", "context", "new-chat"],
      ["shared", "viewport", "normal"],
      ["normal", "anchor", "top-right"],
      ["normal", "focalX", 72],
      ["normal", "focalY", 38],
      ["normal", "positionX", -12],
      ["normal", "positionY", 8],
      ["normal", "scale", 1.15],
      ["wide", "anchor", "bottom-right"],
      ["wide", "focalX", 80],
      ["wide", "focalY", 64],
      ["wide", "positionX", -20],
      ["wide", "positionY", 14],
      ["wide", "scale", 0.9],
    ]) {
      studioResult = await studioRequest(mutationRequest(studioResult, "set-theme-layer", {
        index: 0, preset, property, value,
      }));
    }
    assert.deepEqual({
      appearance: studioResult.state.layers[0].appearance,
      context: studioResult.state.layers[0].context,
      viewport: studioResult.state.layers[0].viewport,
      normal: studioResult.state.layers[0].frames.normal,
      wide: studioResult.state.layers[0].frames.wide,
    }, {
      appearance: "light",
      context: "new-chat",
      viewport: "normal",
      normal: { anchor: "top-right", focalX: 72, focalY: 38, positionX: -12, positionY: 8, scale: 1.15 },
      wide: { anchor: "bottom-right", focalX: 80, focalY: 64, positionX: -20, positionY: 14, scale: 0.9 },
    });
    studioResult = await studioRequest(mutationRequest(studioResult, "move-theme-layer", {
      index: 7, direction: "up",
    }));
    assert.deepEqual(studioResult.state.layers.slice(6).map((layer) => layer.role), ["decoration", "corner"]);
    studioResult = await studioRequest(mutationRequest(studioResult, "remove-theme-layer", { index: 7 }));
    assert.equal(studioResult.state.layers.length, 7);
    studioResult = await studioRequest(mutationRequest(studioResult, "undo-theme-edit"));
    assert.equal(studioResult.state.layers.length, STUDIO_MAX_LAYERS,
      "Undo did not restore a removed artwork layer");
    assert.equal(studioResult.state.feedback.valid, true,
      "The valid lifecycle fixture became invalid before the last-valid-payload check");

    const lastValidPayload = studioResult.payload;
    const canvasColor = studioResult.state.tokens.light.canvas;
    const invalidEdit = await studioRequest(mutationRequest(studioResult, "set-theme-token", {
      mode: "light", token: "text", value: canvasColor,
    }));
    assert.equal(invalidEdit.state.feedback.valid, false);
    assert.equal(invalidEdit.state.actionSucceeded, false);
    assert.equal(invalidEdit.payload, null,
      "An invalid mutation replaced the live last-valid renderer payload");
    assert.equal(invalidEdit.apply, "none");
    assert(invalidEdit.state.feedback.errors.some((error) => error.code === "contrast"));
    const hydratedInvalidDraft = await hydrateStudioDraft({
      configPath: studioConfigPath,
      userThemesDir: studioUserThemesDir,
      editorRoot: studioEditorRoot,
      locale: "en",
    });
    assert.equal(hydratedInvalidDraft.state.session, invalidEdit.state.session);
    assert.equal(hydratedInvalidDraft.state.revision, invalidEdit.state.revision);
    assert.equal(hydratedInvalidDraft.state.feedback.valid, false,
      "Hydration hid the invalid current document instead of keeping it resumable");
    assert.equal(hydratedInvalidDraft.payload, lastValidPayload,
      "Hydration did not keep the last valid renderer payload active");
    const hydratedMirror = JSON.parse(await fs.readFile(
      path.join(studioEditorRoot, "active", "theme.json"), "utf8",
    ));
    assert.equal(hydratedMirror.theme.light.semantic["--aura-text-primary"],
      hydratedMirror.theme.light.semantic["--aura-background-primary"],
    "Hydration replaced the invalid editable mirror with the last-valid document");
    studioResult = await studioRequest(mutationRequest(invalidEdit, "undo-theme-edit"));
    assert.equal(studioResult.state.feedback.valid, true);
    assert.equal(studioResult.payload, lastValidPayload,
      "Undo after an invalid mutation did not restore the exact last-valid payload");

    const saveRequest = mutationRequest(studioResult, "save-theme-edit");
    await assert.rejects(studioRequest(saveRequest, {
      faultInjector: (stage) => { if (stage === "after-stage") throw new Error("injected after-stage failure"); },
    }), /injected after-stage failure/);
    assert.equal(await fs.stat(studioDestination).then(() => true, () => false), false,
      "A failed staged save installed a partial theme");
    assert.equal(JSON.parse(await fs.readFile(studioConfigPath, "utf8")).theme, "default",
      "A failed staged save changed the active theme");
    assert.equal(JSON.parse(await fs.readFile(path.join(studioEditorRoot, "active", ".editor-state.json"), "utf8")).revision,
      studioResult.state.revision, "A failed staged save lost or advanced the draft");
    assert.deepEqual((await fs.readdir(studioUserThemesDir)).filter((name) => name.startsWith(".save-")), [],
      "A failed staged save left an app-owned staging folder");

    studioResult = await studioRequest(saveRequest);
    assert.equal(studioResult.apply, "saved");
    assert.equal(studioResult.themesChanged, true);
    assert.equal(studioResult.configChanged, true);
    assert.equal(studioResult.state.isNew, false);
    assert.equal(studioResult.state.source, "user");
    assert.equal(studioResult.state.dirty, false);
    assert.equal(JSON.parse(await fs.readFile(studioConfigPath, "utf8")).theme, studioThemeId);
    const installedStudioKit = await readThemeKit(studioDestination);
    assert.equal(installedStudioKit.schemaVersion, STUDIO_THEME_SCHEMA_VERSION);
    assert.equal(installedStudioKit.metadata.backgroundScope, "content");
    assert.equal(installedStudioKit.metadata.artworkLayers.length, STUDIO_MAX_LAYERS);
    assert.deepEqual(installedStudioKit.metadata.newChatLayout, {
      widthRatio: 0.64, offsetXRatio: 0.1, offsetYRatio: -0.08,
    });
    assert.equal(installedStudioKit.metadata.artworkLayers[0].appearance, "light");
    assert.equal(installedStudioKit.metadata.artworkLayers[0].context, "new-chat");
    assert.equal(installedStudioKit.metadata.artworkLayers[0].viewport, "normal");
    const restartBundle = await buildPayload({ configPath: studioConfigPath, userThemesDir: studioUserThemesDir });
    assert.equal(restartBundle.theme.name, studioThemeId);
    assert.equal(restartBundle.settings.backgroundScope, "content");
    assert.equal(restartBundle.settings.artLayers.length, STUDIO_MAX_LAYERS);
    assert.deepEqual(restartBundle.settings.newChatLayout, {
      widthRatio: 0.64, offsetXRatio: 0.1, offsetYRatio: -0.08,
    });
    new Function(restartBundle.payload);

    // Close the saved session, reopen it as a user theme, and prove rollback
    // after every destructive save stage restores both folder and config.
    studioResult = await studioRequest(mutationRequest(studioResult, "discard-theme-edit"));
    assert.equal(studioResult.state.active, false);
    studioResult = await studioRequest({ type: "begin-theme-edit", theme: studioThemeId, reset: false });
    studioResult = await studioRequest(mutationRequest(studioResult, "set-theme-token", {
      mode: "shared", token: "backgroundScope", value: "full-window",
    }));
    const replacementSaveRequest = mutationRequest(studioResult, "save-theme-edit");
    for (const failureStage of ["after-backup", "after-install", "after-config"]) {
      await assert.rejects(studioRequest(replacementSaveRequest, {
        faultInjector: (stage) => { if (stage === failureStage) throw new Error(`injected ${failureStage} failure`); },
      }), new RegExp(`injected ${failureStage} failure`));
      assert.equal((await readThemeKit(studioDestination)).metadata.backgroundScope, "content",
        `${failureStage} rollback did not restore the previously installed theme`);
      assert.equal(JSON.parse(await fs.readFile(studioConfigPath, "utf8")).theme, studioThemeId,
        `${failureStage} rollback did not restore the previous configuration`);
      const transientFolders = (await fs.readdir(studioUserThemesDir))
        .filter((name) => /^\.(?:save|backup|failed)-/.test(name));
      assert.deepEqual(transientFolders, [], `${failureStage} rollback left a transient theme folder`);
      assert.equal(JSON.parse(await fs.readFile(path.join(studioEditorRoot, "active", ".editor-state.json"), "utf8")).revision,
        studioResult.state.revision, `${failureStage} rollback lost the editable draft`);
    }

    studioResult = await studioRequest(mutationRequest(studioResult, "discard-theme-edit"));
    assert.equal((await readThemeKit(studioDestination)).metadata.backgroundScope, "content",
      "Discard after rollback changed the saved theme");
    assert.equal(JSON.parse(await fs.readFile(studioConfigPath, "utf8")).theme, studioThemeId);

    // Core refuses an active-theme deletion; the host's allowlisted workflow
    // applies Default first, then the same delete request removes one exact
    // user-theme folder. Built-ins remain immutable.
    await assert.rejects(studioRequest({ type: "delete-user-theme", theme: studioThemeId }),
      /Apply Default before deleting the current theme/,
    "The core deleted an active user theme before Default was persisted");
    await writeConfig(studioConfigPath, { ...JSON.parse(await fs.readFile(studioConfigPath, "utf8")), theme: "default" });
    const deleteResult = await studioRequest({ type: "delete-user-theme", theme: studioThemeId });
    assert.equal(deleteResult.themesChanged, true);
    assert.equal(deleteResult.apply, "none");
    assert.equal(await fs.stat(studioDestination).then(() => true, () => false), false);
    assert.equal((await listThemes({ userThemesDir: studioUserThemesDir })).some((theme) => theme.name === studioThemeId), false);
    const afterStudioDelete = await buildPayload({ configPath: studioConfigPath, userThemesDir: studioUserThemesDir });
    assert.equal(afterStudioDelete.theme.name, "default");
    new Function(afterStudioDelete.payload);

    await writeConfig(studioConfigPath, { ...DEFAULT_CONFIG, theme: themeId });
    await assert.rejects(studioRequest({ type: "delete-user-theme", theme: "default" }),
      /Built-in themes cannot be deleted/,
    "Studio deleted a built-in theme");
    assert.equal((await fs.stat(path.join(PROJECT_ROOT, "themes", "default.json"))).isFile(), true);

    await fs.rm(installedFolder, { recursive: true, force: false });
    const afterDelete = await compileTheme({ configPath, userThemesDir });
    assert.equal(afterDelete.theme.name, "default", "Deleting the installed folder did not restore the safe fallback");
    assert.equal(afterDelete.settings.fallbackFrom, themeId);
    run(process.execPath, [cliPath, "init", "--config", configPath, "--user-themes", userThemesDir]);
    assert.equal(JSON.parse(await fs.readFile(configPath, "utf8")).theme, "default",
      "Restart did not persist the fallback after uninstall");
    assert.equal((await listThemes({ userThemesDir })).some((theme) => theme.name === themeId), false);
    assert.equal((await fs.stat(collisionFolder)).isDirectory(), true,
      "One-folder uninstall removed a different user theme folder");
  } finally {
    await fs.rm(temporary, { recursive: true, force: true });
  }
});

test("theme-cli qa audits every registered layer without generating images", async () => {
  const temporary = await fs.mkdtemp(path.join(PROJECT_ROOT, "tests", ".tmp-"));
  const cliPath = path.join(PROJECT_ROOT, "scripts", "theme-cli.mjs");
  try {
    assert.match(run(process.execPath, [cliPath, "help"], { cwd: temporary }), /^\s*qa <id>\s*$/m);
    assert.throws(() => run(process.execPath, [cliPath, "qa", "not-installed"], { cwd: temporary }),
      /Unknown theme|Theme not found/);
    const summary = JSON.parse(run(process.execPath, [cliPath, "qa", "japanese-idol"], {
      cwd: temporary,
      timeout: 60_000,
    }));
    assert.equal(summary.themeId, "japanese-idol");
    assert.equal(summary.outputDir, "dist/qa/japanese-idol");
    assert.equal(summary.boardPath, null);
    assert.equal(summary.statusPath, "dist/qa/japanese-idol/status.json");

    const outputDirectory = path.join(temporary, "dist", "qa", "japanese-idol");
    const status = JSON.parse(await fs.readFile(path.join(outputDirectory, "status.json"), "utf8"));
    assert.deepEqual(await fs.readdir(outputDirectory), ["status.json"], "QA emitted an image or other fixture artifact");
    assert.equal(status.schemaVersion, 2);
    assert.equal(status.state, "asset-audit-pass");
    assert.equal(status.visualReview.requiredSurface, "actual Aura WebView2 on live claude.ai");
    assert.equal(status.visualReview.fixtureImages, "forbidden");

    const expectedPaths = [
      "assets/theme-art/kawaii-idol/background.webp",
      "assets/theme-art/kawaii-idol/hero.webp",
      "assets/theme-art/kawaii-idol/dark-new-chat.webp",
      "assets/theme-art/kawaii-idol/dark-conversation.webp",
    ];
    assert.equal(status.theme.id, "japanese-idol");
    assert.deepEqual(status.assets.map((asset) => asset.path), expectedPaths,
      "Asset audit did not preserve every registry artwork layer in order");
    for (const asset of status.assets) {
      assert(asset.bytes > 0, `${asset.path} is empty`);
      assert.match(asset.sha256, /^[a-f0-9]{64}$/, `${asset.path} is missing its content digest`);
      assert(asset.image.width > 0 && asset.image.height > 0, `${asset.path} is missing native dimensions`);
      assert.equal(typeof asset.image.fullBleedExpected, "boolean");
      assert.equal(typeof asset.image.alphaExpected, "boolean");
      assert.equal(asset.budget.pass, true, `${asset.path} exceeds its layer budget`);
    }
    assert.equal(status.launcherAsset.path, "assets/theme-art/japanese-idol/launcher-mark.png");
    assert(status.launcherAsset.bytes > 0, "Launcher mark is empty");
    assert.match(status.launcherAsset.sha256, /^[a-f0-9]{64}$/, "Launcher mark is missing its content digest");
    assert.deepEqual(
      [status.launcherAsset.image.width, status.launcherAsset.image.height, status.launcherAsset.image.alpha],
      [96, 96, true],
      "Launcher mark is not a transparent 96×96 PNG",
    );
    assert.equal(status.launcherAsset.budget.pass, true, "Launcher mark exceeds its asset budget");
    assert.equal(status.studioPreviewAsset.path, "assets/studio-previews/masters/japanese-idol.png");
    assert.equal(status.studioPreviewAsset.sha256, STUDIO_PREVIEW_MASTERS["japanese-idol"].sha256);
    assert.deepEqual(
      [status.studioPreviewAsset.image.width, status.studioPreviewAsset.image.height],
      STUDIO_PREVIEW_MASTERS["japanese-idol"].dimensions,
    );
    assert.deepEqual(status.studioPreviewAsset.frame, STUDIO_PREVIEW_MASTERS["japanese-idol"].frame);
    assert.equal(status.studioPreviewAsset.usage, "studio-picker-only");
    assert.equal(status.studioPreviewAsset.renderer, false);
    assert.equal(status.studioPreviewAsset.budget.pass, true);
    assert.equal(status.budgets.pass, true);
    assert.equal(status.budgets.limits.chromePayloadBytesExclusive, 65_000);
    assert.equal(status.budgets.limits.embeddedArtworkBytesExclusive, 1_400_000);
    assert.equal(status.budgets.limits.rasterLayerBytesExclusive, 400_000);
    assert.equal(status.budgets.limits.studioPreviewBytesExclusive, 3_000_000);
    assert.deepEqual(status.payloads.map((payload) => payload.mode), ["light", "dark"]);
    for (const payload of status.payloads) {
      assert.equal(payload.theme, "japanese-idol");
      assert.equal(payload.layerCount, expectedPaths.length,
        `${payload.mode} payload omitted registered artwork layers`);
      assert.equal(payload.usesLegacyArtwork, false,
        `${payload.mode} payload fell back to the legacy artwork slot`);
      assert.equal(payload.syntax, "pass");
      assert(payload.bytes > 0);
      assert(payload.embeddedArtworkBytes > 0);
      assert(payload.chromeBytes > 0 && payload.chromeBytes < 65_000);
      assert.equal(payload.budgetPass, true);
    }
    const auditSource = await fs.readFile(path.join(PROJECT_ROOT, "scripts", "asset-audit.mjs"), "utf8");
    for (const forbidden of ["claude-dom", "--screenshot", "qa-board", "in-context-payload"]){
      assert(!auditSource.includes(forbidden), `Asset audit retains forbidden fixture hook: ${forbidden}`);
    }
  } finally {
    await fs.rm(temporary, { recursive: true, force: true });
  }
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
    run(process.execPath, ["scripts/theme-cli.mjs", "set", "--config", configPath, "--appearance", "dark"]);
    assert.equal(JSON.parse(await fs.readFile(configPath, "utf8")).appearance, "dark");
    const appearanceBytes = await fs.readFile(configPath, "utf8");
    assert.throws(() => run(process.execPath, ["scripts/theme-cli.mjs", "set", "--config", configPath,
      "--appearance", "Dark"]), /appearance must be system, light, or dark/);
    assert.equal(await fs.readFile(configPath, "utf8"), appearanceBytes,
      "A rejected appearance changed the persisted configuration");
    run(process.execPath, ["scripts/theme-cli.mjs", "set", "--config", configPath,
      "--image-position", "23.5% 76.25%", "--image-zoom", "1.35",
      "--studio-preview-theme", "japanese-idol", "--studio-preview-x", "18.5",
      "--studio-preview-y", "64", "--studio-preview-zoom", "1.2"]);
    let framedConfig = JSON.parse(await fs.readFile(configPath, "utf8"));
    assert.equal(framedConfig.imagePosition, "23.5% 76.25%");
    assert.equal(framedConfig.imageZoom, 1.35);
    assert.deepEqual(framedConfig.studioPreviewCrops["japanese-idol"], { x: 18.5, y: 64, zoom: 1.2 });
    run(process.execPath, ["scripts/theme-cli.mjs", "set", "--config", configPath,
      "--studio-preview-theme", "korean-idol", "--studio-preview-x", "82",
      "--studio-preview-y", "31.25", "--studio-preview-zoom", "3.5"]);
    framedConfig = JSON.parse(await fs.readFile(configPath, "utf8"));
    assert.deepEqual(framedConfig.studioPreviewCrops["japanese-idol"], { x: 18.5, y: 64, zoom: 1.2 },
      "Updating another card crop erased the first crop");
    assert.deepEqual(framedConfig.studioPreviewCrops["korean-idol"], { x: 82, y: 31.25, zoom: 3.5 });
    const framedBytes = await fs.readFile(configPath, "utf8");
    assert.throws(() => run(process.execPath, ["scripts/theme-cli.mjs", "set", "--config", configPath,
      "--studio-preview-theme", "japanese-idol", "--studio-preview-x", "101",
      "--studio-preview-y", "50", "--studio-preview-zoom", "1"]), /must be between 0 and 100/);
    assert.equal(await fs.readFile(configPath, "utf8"), framedBytes,
      "A rejected crop changed the persisted configuration");
    assert.throws(() => run(process.execPath, ["scripts/theme-cli.mjs", "set", "--config", configPath,
      "--studio-preview-theme", "japanese-idol", "--studio-preview-x", "50",
      "--studio-preview-y", "50", "--studio-preview-zoom", "6.01"]), /must be between 1 and 6/);
    assert.equal(await fs.readFile(configPath, "utf8"), framedBytes,
      "An oversized Studio preview zoom changed the persisted configuration");
    assert.throws(() => run(process.execPath, ["scripts/theme-cli.mjs", "set", "--config", configPath,
      "--image-zoom", "NaN"]), /imageZoom must be between 1 and 2/);
    assert.equal(await fs.readFile(configPath, "utf8"), framedBytes,
      "A rejected background zoom changed the persisted configuration");
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
  await assert.rejects(
    compileTheme({ config: { ...DEFAULT_CONFIG, imageZoom: 2.01 } }),
    /imageZoom must be between 1 and 2/,
  );
  await assert.rejects(
    compileTheme({ config: { ...DEFAULT_CONFIG, imageZoom: "1.2" } }),
    /imageZoom must be a number/,
  );
  await assert.rejects(
    compileTheme({ config: {
      ...DEFAULT_CONFIG,
      studioPreviewCrops: { "japanese-idol": { x: null, y: 50, zoom: 1 } },
    } }),
    /values must be numbers/,
  );
  await assert.rejects(
    compileTheme({ config: {
      ...DEFAULT_CONFIG,
      studioPreviewCrops: { "japanese-idol": { x: 50, y: 50, zoom: 1, path: "C:\\private.png" } },
    } }),
    /must contain only x, y, and zoom/,
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
    await writeConfig(configPath, {
      ...DEFAULT_CONFIG,
      image: imagePath,
      imageOpacity: 0.22,
      imagePosition: "12.5% 87.5%",
      imageZoom: 1.4,
    });
    const bundle = await compileTheme({ configPath });
    assert.equal(bundle.image.bytes, png.length);
    assert(bundle.settings.imageDataUrl.startsWith("data:image/png;base64,"));
    assert.equal(bundle.settings.imageAnimated, false);
    assert.equal(bundle.settings.imageOpacity, 0.22);
    assert.equal(bundle.settings.imagePosition, "12.5% 87.5%");
    assert.equal(bundle.settings.imageZoom, 1.4);

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
    "studio/app.js",
    "studio/editor.js",
    "scripts/build-aura-icon.mjs",
    "scripts/build-launcher-assets.mjs",
    "scripts/build-studio-themes.mjs",
    "scripts/build-release.mjs",
    "scripts/injector.mjs",
    "scripts/asset-audit.mjs",
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

test("Aura identity assets are deterministic and the icon contains every required Windows frame", async () => {
  const expectedSizes = [16, 20, 24, 32, 40, 48, 64, 128, 256];
  const sourcePath = path.join(PROJECT_ROOT, "assets", "brand", "aura-mark.svg");
  const committedPath = path.join(PROJECT_ROOT, "assets", "brand", "claude-aura.ico");
  const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "claude-aura-icon-"));
  try {
    const firstPath = path.join(temporaryRoot, "first.ico");
    const secondPath = path.join(temporaryRoot, "second.ico");
    const first = await buildAuraIcon({ sourcePath, outputPath: firstPath });
    const second = await buildAuraIcon({ sourcePath, outputPath: secondPath });
    assert.deepEqual(first.sizes, expectedSizes);
    assert.deepEqual(second.sizes, expectedSizes);
    assert.equal(first.sha256, second.sha256, "Repeated icon builds must have the same digest");

    const [firstBytes, secondBytes, committedBytes] = await Promise.all([
      fs.readFile(firstPath),
      fs.readFile(secondPath),
      fs.readFile(committedPath),
    ]);
    assert.deepEqual(firstBytes, secondBytes, "Repeated icon builds must be byte-for-byte identical");
    assert.deepEqual(committedBytes, firstBytes, "The committed ICO must be derived from the canonical SVG");
    assert.equal(first.bytes, firstBytes.length);
    assert.equal(firstBytes.readUInt16LE(0), 0, "ICO reserved field must be zero");
    assert.equal(firstBytes.readUInt16LE(2), 1, "ICO must identify itself as an icon");
    assert.equal(firstBytes.readUInt16LE(4), expectedSizes.length, "ICO frame count is incomplete");

    let expectedOffset = 6 + expectedSizes.length * 16;
    const actualSizes = [];
    for (let index = 0; index < expectedSizes.length; index += 1) {
      const entry = 6 + index * 16;
      const size = firstBytes[entry] || 256;
      const height = firstBytes[entry + 1] || 256;
      const byteLength = firstBytes.readUInt32LE(entry + 8);
      const imageOffset = firstBytes.readUInt32LE(entry + 12);
      actualSizes.push(size);
      assert.equal(height, size, `ICO frame ${size}px must be square`);
      assert.equal(firstBytes[entry + 2], 0, `ICO frame ${size}px must not use a palette`);
      assert.equal(firstBytes[entry + 3], 0, `ICO frame ${size}px reserved byte must be zero`);
      assert.equal(firstBytes.readUInt16LE(entry + 4), 1, `ICO frame ${size}px must have one plane`);
      assert.equal(firstBytes.readUInt16LE(entry + 6), 32, `ICO frame ${size}px must be 32-bit`);
      assert(byteLength > 0, `ICO frame ${size}px is empty`);
      assert.equal(imageOffset, expectedOffset, `ICO frame ${size}px has an unexpected offset`);
      assert(imageOffset + byteLength <= firstBytes.length, `ICO frame ${size}px exceeds the file boundary`);
      if (size === 256) {
        assert.deepEqual([...firstBytes.subarray(imageOffset, imageOffset + 8)], [137, 80, 78, 71, 13, 10, 26, 10],
          "The 256px ICO frame must use its lossless PNG representation");
      } else {
        assert.equal(firstBytes.readUInt32LE(imageOffset), 40, `ICO frame ${size}px needs a BITMAPINFOHEADER`);
        assert.equal(firstBytes.readInt32LE(imageOffset + 4), size, `ICO frame ${size}px DIB width is incorrect`);
        assert.equal(firstBytes.readInt32LE(imageOffset + 8), size * 2, `ICO frame ${size}px DIB height must include its mask`);
        assert.equal(firstBytes.readUInt16LE(imageOffset + 12), 1, `ICO frame ${size}px DIB must have one plane`);
        assert.equal(firstBytes.readUInt16LE(imageOffset + 14), 32, `ICO frame ${size}px DIB must be 32-bit`);
      }
      expectedOffset += byteLength;
    }
    assert.deepEqual(actualSizes, expectedSizes);
    assert.equal(expectedOffset, firstBytes.length, "ICO contains unindexed trailing data");

    const firstLauncherRoot = path.join(temporaryRoot, "launcher-first");
    const secondLauncherRoot = path.join(temporaryRoot, "launcher-second");
    const [firstLaunchers, secondLaunchers] = await Promise.all([
      buildLauncherAssets({ outputRoot: firstLauncherRoot }),
      buildLauncherAssets({ outputRoot: secondLauncherRoot }),
    ]);
    assert.deepEqual(firstLaunchers.map(({ theme, width, height, bytes, sha256 }) => ({ theme, width, height, bytes, sha256 })),
      secondLaunchers.map(({ theme, width, height, bytes, sha256 }) => ({ theme, width, height, bytes, sha256 })),
    "Repeated launcher builds must report identical results");
    assert.deepEqual(firstLaunchers.map((result) => result.theme), THEME_IDS);
    for (const result of firstLaunchers) {
      const [firstMark, secondMark, committedMark] = await Promise.all([
        fs.readFile(path.join(firstLauncherRoot, result.theme, "launcher-mark.png")),
        fs.readFile(path.join(secondLauncherRoot, result.theme, "launcher-mark.png")),
        fs.readFile(path.join(PROJECT_ROOT, "assets", "theme-art", result.theme, "launcher-mark.png")),
      ]);
      assert.deepEqual(firstMark, secondMark, `${result.theme} launcher builds must be byte-for-byte identical`);
      assert.deepEqual(committedMark, firstMark, `${result.theme} committed launcher mark is stale`);
    }
  } finally {
    await fs.rm(temporaryRoot, { recursive: true, force: true });
  }
});

test("Windows uses a content-only WebView2 window with Aura Studio and tray controls", async () => {
  const start = await fs.readFile(path.join(PROJECT_ROOT, "windows", "start.ps1"), "utf8");
  const ui = await fs.readFile(path.join(PROJECT_ROOT, "windows", "aura-ui.ps1"), "utf8");
  const install = await fs.readFile(path.join(PROJECT_ROOT, "windows", "install.ps1"), "utf8");
  const uninstall = await fs.readFile(path.join(PROJECT_ROOT, "windows", "uninstall.ps1"), "utf8");
  const studioApp = await fs.readFile(path.join(PROJECT_ROOT, "studio", "app.js"), "utf8");
  const studioEditor = await fs.readFile(path.join(PROJECT_ROOT, "studio", "editor.js"), "utf8");
  const studioEditorCss = await fs.readFile(path.join(PROJECT_ROOT, "studio", "editor.css"), "utf8");
  const studioCss = await fs.readFile(path.join(PROJECT_ROOT, "studio", "styles.css"), "utf8");
  const studioHtml = await fs.readFile(path.join(PROJECT_ROOT, "studio", "index.html"), "utf8");
  const studioGenerated = await fs.readFile(path.join(PROJECT_ROOT, "studio", "generated-themes.js"), "utf8");
  const baseCss = await fs.readFile(path.join(PROJECT_ROOT, "assets", "base.css"), "utf8");
  assert.match(start, /\$auraArguments\s*=\s*@\{\s*Mode\s*=\s*['"]Open['"]\s*\}/,
    "The launch wrapper must use named hashtable splatting for Aura host parameters");
  assert.match(start, /aura-ui\.ps1['"]\)\s+@auraArguments/,
    "The launch wrapper must not pass parameter-name strings positionally");
  assert(!start.includes("@arguments"), "The launch wrapper must not array-splat named parameters");
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
  for (const removedMainWindowMarker of [
    "ThemeGalleryForm",
    "ThemeOptionButtons",
    "New-AuraToolbarButton",
    "$script:Toolbar",
    "Set-AuraUiTitleBarPalette",
    "Get-AuraUiThemePalette",
    "DwmSetWindowAttribute",
  ]) {
    assert(!ui.includes(removedMainWindowMarker),
      `The removed main-window gallery/palette plumbing still contains ${removedMainWindowMarker}`);
  }
  const mainFormControlAdds = [...ui.matchAll(/\$script:Form\.Controls\.Add\s*\(\s*(\$[\w:]+)\s*\)/g)]
    .map((match) => match[1]);
  assert.match(ui, /\$content\s*=\s*\[System\.Windows\.Forms\.Panel\]::new\(\)/,
    "The main form's sole child must be a content panel");
  assert.deepEqual(mainFormControlAdds, ["$content"],
    "The main form must still receive only the Claude content panel");
  assert(!/\$script:Form\.Controls\.AddRange\s*\(/.test(ui),
    "The main form must not receive controls through an unverified AddRange call");
  const contentControlAdds = [...ui.matchAll(/\$content\.Controls\.Add\s*\(\s*(\$script:[A-Za-z0-9]+)\s*\)/g)]
    .map((match) => match[1]);
  assert.deepEqual(contentControlAdds, ["$script:WebView", "$script:LoadingPanel"],
    "The Claude content panel must contain only the Claude WebView and loading panel");
  assert(!/\$content\.Controls\.AddRange\s*\(/.test(ui),
    "The content panel must not receive controls through an unverified AddRange call");
  // The Aura launcher is a separate owned overlay window, not chrome inside the
  // Claude content. It floats over the WebView (top-level windows escape the
  // windowed-WebView2 airspace limit), reserves no layout space, never reflows
  // the page, and keeps the main window content-only while still giving Studio a
  // discoverable in-window entry alongside the tray and keyboard accelerators.
  assert.match(ui, /\$script:Launcher\s*=\s*\[System\.Windows\.Forms\.Form\]::new\(\)/,
    "The Aura launcher must be its own top-level overlay window, not chrome inside the Claude content");
  assert.match(ui, /\$script:Launcher\.FormBorderStyle\s*=\s*\[System\.Windows\.Forms\.FormBorderStyle\]::None/,
    "The launcher must be a borderless floating control");
  assert.match(ui, /\$script:Launcher\.Show\(\s*\$script:Form\s*\)/,
    "The launcher must be shown as an owned window so it tracks the main window's minimize/restore and z-order");
  assert.match(ui, /\$script:LauncherButton\.add_MouseMove/,
    "The launcher must be draggable");
  assert.match(ui, /\$wasClickArmed\s*\)\s*\{\s*Show-AuraUiStudio/,
    "A left click that was not a drag must open Aura Studio");
  assert.match(ui, /Test-AuraUiLauncherGrip[\s\S]{0,900}?LauncherDragArmed/,
    "The themed launcher must reserve a visible grip for dragging instead of overloading the Studio action");
  assert.match(ui, /LauncherSafeGap\s*=\s*16/,
    "The floating launcher must retain a safe inset from the Aura window edges");
  assert.match(ui, /Update-AuraUiLauncherStyle/,
    "Theme changes must reapply the launcher material and mark");
  assert.match(ui, /Save-AuraUiLauncherPosition/,
    "Dragging the launcher must persist its position");
  assert.match(ui, /add_AcceleratorKeyPressed/,
    "A keyboard accelerator must provide a second route to Studio");
  assert.match(ui, /SetCurrentProcessExplicitAppUserModelID\(\s*'ClaudeAura'\s*\)/,
    "The process must claim a stable taskbar identity rather than the generic PowerShell host");
  assert.match(ui, /function Register-AuraUiJumpList[\s\S]{0,900}?System\.Windows\.Shell\.JumpList/,
    "The taskbar Jump List must use the managed WPF JumpList, never hand-written COM interop");
  assert.match(ui, /function Register-AuraUiJumpList[\s\S]{0,900}?-OpenStudio/,
    "The Jump List task must open Studio through the single-instance signal");
  assert.match(ui,
    /\$script:LoadingPanel\.Controls\.AddRange\s*\(\s*@\([\s\S]{0,240}?\$script:RetryButton[\s\S]{0,120}?\)\s*\)/,
    "The retry control must remain inside the loading panel");
  assert.match(ui, /\$script:RetryButton\.add_Click\(\s*\{/,
    "The loading-panel retry control must remain wired");
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
  assert.match(ui,
    /SetVirtualHostNameToFolderMapping\(\s*['"]aura\.background['"]\s*,\s*\$StudioBackgroundRoot\s*,[\s\S]{0,160}?CoreWebView2HostResourceAccessKind\]::Allow\s*\)/,
    "Studio background previews must come from the isolated app-data folder");
  assert.match(ui,
    /SetVirtualHostNameToFolderMapping\(\s*['"]aura\.editor['"]\s*,\s*\$StudioEditorPreviewRoot\s*,[\s\S]{0,160}?CoreWebView2HostResourceAccessKind\]::Allow\s*\)/,
    "Editor previews must come only from the app-owned preview folder");
  assert.match(ui, /function Assert-AuraUiStudioEditorRoots[\s\S]{0,2300}?ReparsePoint/,
    "Editor storage must reject symbolic links and junctions before any draft write");
  assert.match(ui,
    /function Invoke-AuraUiStudioEditorCore[\s\S]{0,400}?Assert-AuraUiStudioEditorRoots -Create[\s\S]{0,160}?Assert-AuraUiThemeInstallRoot -Create/,
    "Every Studio editor request must reject a redirected installed-theme root before invoking Node");
  assert.match(ui,
    /function Get-AuraUiStudioEditorCoreState[\s\S]{0,500}?['"]studio-state['"][\s\S]{0,220}?ConvertFrom-AuraUiStudioEditorResponse/,
    "Studio restart hydration must use the same validated core response boundary as editor actions");
  assert.match(ui,
    /['"]get-state['"]\s*\{[\s\S]{0,160}?Sync-AuraUiStudioEditorDraft[\s\S]{0,120}?Send-AuraUiStudioState/,
    "Studio get-state must hydrate a persisted draft before posting canonical editor state");
  const startupDraftHydrationIndex = ui.lastIndexOf("[void](Sync-AuraUiStudioEditorDraft)");
  const startupWinFormsIndex = ui.indexOf("Add-Type -AssemblyName System.Windows.Forms", startupDraftHydrationIndex);
  assert(startupDraftHydrationIndex >= 0 && startupWinFormsIndex > startupDraftHydrationIndex,
    "Aura startup must restore the draft payload before creating its WebView");
  const beginThemeEditFunction = ui.match(/function Invoke-AuraUiBeginThemeEdit\s*\{([\s\S]*?)\n\}/)?.[1] ?? "";
  assert.match(beginThemeEditFunction,
    /if \(\$active\)[\s\S]*?\$Request\.reset[\s\S]*?\$activeId[\s\S]*?else\s*\{[\s\S]*?Get-AuraUiStudioKnownTheme[^\n]*-UserOnly/,
    "Resetting an active unsaved duplicate must not require the copy to be installed first");
  assert.match(ui, /\$StudioEditorRoot\s*=\s*Join-Path\s+\$DataRoot\s+['"]theme-drafts['"]/,
    "Editor drafts must stay below Claude Aura app data");
  assert.match(ui, /Assert-AuraUiStudioEditorPublicValue[\s\S]{0,1200}?cannot expose a filesystem path/,
    "Editor state must redact filesystem paths before posting to the page");
  assert(ui.includes("$text -cnotmatch '^https://aura\\.editor/active/layer-[a-f0-9]{32}\\.webp\\?v=[a-f0-9]{64}$'"),
    "Editor state must allow only opaque, digest-versioned preview URLs");
  assert.match(ui, /\.Navigate\(\s*['"]https:\/\/aura\.studio\/index\.html['"]\s*\)/,
    "Studio must navigate to its exact offline virtual-host URL");
  const studioCoreIndex = ui.indexOf("$studioCore = $script:StudioWebView.CoreWebView2");
  const studioAppearanceIndex = ui.indexOf("Set-AuraUiPreferredColorScheme", studioCoreIndex);
  const studioNavigateIndex = ui.indexOf("$studioCore.Navigate('https://aura.studio/index.html')", studioCoreIndex);
  assert(studioCoreIndex >= 0 && studioAppearanceIndex > studioCoreIndex && studioAppearanceIndex < studioNavigateIndex,
    "Studio must apply the WebView2 color preference before its first navigation");
  const mainCoreIndex = ui.indexOf("$core = $script:WebView.CoreWebView2");
  const mainAppearanceIndex = ui.indexOf("Set-AuraUiPreferredColorScheme", mainCoreIndex);
  const mainNavigateIndex = ui.indexOf("$core.Navigate('https://claude.ai/')", mainCoreIndex);
  assert(mainCoreIndex >= 0 && mainAppearanceIndex > mainCoreIndex && mainAppearanceIndex < mainNavigateIndex,
    "Aura must apply the WebView2 color preference before claude.ai navigation");
  assert.match(ui, /\.add_WebMessageReceived\(\s*\{/);
  assert.match(ui, /PostWebMessageAsJson\s*\(/);
  assert.match(ui, /\[switch\]\$OpenStudio/,
    "The Aura host must expose the Studio-only launch switch");
  assert.match(ui,
    /\$script:StudioOpenSignal\s*=\s*\[System\.Threading\.EventWaitHandle\]::new\([\s\S]{0,180}?\[System\.Threading\.EventResetMode\]::AutoReset[\s\S]{0,180}?"Local\\ClaudeAura\.\$sid\.OpenStudio"/,
    "Studio launch signaling must be a per-user AutoReset event");
  const existingInstanceIndex = ui.indexOf("if (-not $createdNew)");
  const existingStudioBranchIndex = ui.indexOf("if ($OpenStudio)", existingInstanceIndex);
  const existingSignalIndex = ui.indexOf("[void]$script:StudioOpenSignal.Set()", existingStudioBranchIndex);
  const existingReturnIndex = ui.indexOf("return", existingSignalIndex);
  assert(existingInstanceIndex >= 0 && existingStudioBranchIndex > existingInstanceIndex
      && existingSignalIndex > existingStudioBranchIndex && existingReturnIndex > existingSignalIndex,
    "-OpenStudio must signal the already-running Aura instance before the second process returns");
  assert.match(ui,
    /if \(\$OpenStudio\) \{ \[void\]\$script:StudioOpenSignal\.Set\(\) \}/,
    "A first Aura instance launched with -OpenStudio must queue Studio opening");
  assert.match(ui,
    /\$script:StudioOpenSignal\.WaitOne\(0\)[\s\S]{0,100}?Show-AuraUiStudio/,
    "The UI loop must consume the Studio-open signal without blocking");
  assert.match(ui,
    /function Show-AuraUiStudio[\s\S]{0,500}?\.Activate\(\)[\s\S]{0,120}?\.BringToFront\(\)/,
    "A signaled Studio window must be restored and foregrounded");
  assert.match(ui, /\$script:StudioOpenSignal\.Dispose\(\)/,
    "The named Studio signal must be disposed during shutdown");

  const expectedStudioMessageTypes = [
    "get-state",
    "set-theme",
    "set-appearance",
    "set-image",
    "clear-image",
    "set-image-framing",
    "set-card-preview-crop",
    "set-enabled",
    "open-aura",
    "open-desktop",
    "import-theme",
    "create-theme-copy",
    "begin-theme-edit",
    "set-theme-token",
    "set-theme-layer",
    "pick-theme-layer-image",
    "remove-theme-layer",
    "move-theme-layer",
    "undo-theme-edit",
    "redo-theme-edit",
    "save-theme-edit",
    "discard-theme-edit",
    "delete-user-theme",
    "set-aura-preview",
    "set-aura-topmost",
    "refresh-aura-mirror",
  ];
  const studioMessageTypesMatch = ui.match(/\$script:StudioMessageTypes\s*=\s*@\(([\s\S]*?)\)/);
  assert(studioMessageTypesMatch, "The Studio host message allowlist is missing");
  const studioMessageTypes = [...studioMessageTypesMatch[1].matchAll(/['"]([^'"]+)['"]/g)]
    .map((match) => match[1]);
  assert.deepEqual(studioMessageTypes, expectedStudioMessageTypes,
    "Studio must expose only the user-approved host actions");
  const expectedPropertiesMatch = ui.match(/\$expectedProperties\s*=\s*@\(switch -CaseSensitive \(\$type\) \{([\s\S]*?)\}\)/);
  assert(expectedPropertiesMatch, "Studio exact message-shape switch is missing");
  assert.match(expectedPropertiesMatch[1], /default\s*\{\s*['"]type['"];\s*break\s*\}/,
    "Type-only Studio actions must reject every extra property");
  assert(!expectedPropertiesMatch[1].includes("'open-aura'"),
    "open-aura must use the exact type-only message shape");
  const expectedEditorMessageShapes = {
    "create-theme-copy": ["type", "theme"],
    "begin-theme-edit": ["type", "theme", "reset"],
    "set-theme-token": ["type", "session", "revision", "mode", "token", "value"],
    "set-theme-layer": ["type", "session", "revision", "index", "preset", "property", "value"],
    "pick-theme-layer-image": ["type", "session", "revision", "index", "role"],
    "remove-theme-layer": ["type", "session", "revision", "index"],
    "move-theme-layer": ["type", "session", "revision", "index", "direction"],
    "undo-theme-edit": ["type", "session", "revision"],
    "redo-theme-edit": ["type", "session", "revision"],
    "save-theme-edit": ["type", "session", "revision"],
    "discard-theme-edit": ["type", "session", "revision"],
    "delete-user-theme": ["type", "theme"],
  };
  for (const [action, expectedShape] of Object.entries(expectedEditorMessageShapes)) {
    const escapedAction = action.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const shapeMatch = expectedPropertiesMatch[1].match(new RegExp(`'${escapedAction}'\\s*\\{([^}]*)\\}`));
    assert(shapeMatch, `Studio exact message-shape switch is missing ${action}`);
    assert.deepEqual([...shapeMatch[1].matchAll(/['"]([^'"]+)['"]/g)].map((match) => match[1]), expectedShape,
      `${action} accepts missing, reordered, or extra page properties`);
  }
  assert.match(ui, /'open-aura'\s*\{\s*Show-AuraUiMain;\s*break\s*\}/,
    "The open-aura host action must only foreground the Aura window");
  const previewShape = expectedPropertiesMatch[1].match(/'set-aura-preview'\s*\{([^}]*)\}/);
  assert(previewShape, "Studio exact message-shape switch is missing set-aura-preview");
  assert.deepEqual([...previewShape[1].matchAll(/['"]([^'"]+)['"]/g)].map((match) => match[1]), ["type", "size"],
    "set-aura-preview accepts missing, reordered, or extra page properties");
  assert.match(ui, /\$message\.size\s+-isnot\s+\[string\]/,
    "Aura preview size messages must carry a string");
  assert.match(ui, /function Set-AuraUiPreviewSize[\s\S]{0,600}?-cnotin\s+@\('launch',\s*'wide',\s*'full'\)/,
    "Aura preview sizes must be strictly allowlisted");
  assert.match(ui, /function Set-AuraUiPreviewSize[\s\S]{0,240}?\^\(\\d\{3,4\}\)x\(\\d\{3,4\}\)\$/,
    "Custom preview dimensions must be pattern-checked before use");
  assert.match(ui, /\$customWidth -lt 920 -or \$customWidth -gt 3840 -or \$customHeight -lt 620 -or \$customHeight -gt 2400/,
    "Custom preview dimensions must be bounded");
  assert.match(ui, /function Set-AuraUiPreviewSize[\s\S]{0,1400}?Maximized/,
    "The preview action must drive the real, resizable Aura window");
  assert.match(studioEditor, /type:\s*"set-aura-preview",\s*size/,
    "Studio must request real-window preview sizes through the validated bridge");
  const topmostShape = expectedPropertiesMatch[1].match(/'set-aura-topmost'\s*\{([^}]*)\}/);
  assert(topmostShape, "Studio exact message-shape switch is missing set-aura-topmost");
  assert.deepEqual([...topmostShape[1].matchAll(/['"]([^'"]+)['"]/g)].map((match) => match[1]), ["type", "enabled"],
    "set-aura-topmost accepts missing, reordered, or extra page properties");
  assert(!expectedPropertiesMatch[1].includes("'refresh-aura-mirror'"),
    "refresh-aura-mirror must use the exact type-only message shape");
  assert.match(ui, /CapturePreviewAsync\(\s*\[Microsoft\.Web\.WebView2\.Core\.CoreWebView2CapturePreviewImageFormat\]::Jpeg/,
    "The Studio mirror must capture the actual Aura WebView through CapturePreviewAsync");
  assert.match(ui, /\$script:MirrorStream = \[IO\.MemoryStream\]::new\(\)/,
    "Mirror captures must stay in memory, never on disk");
  assert.match(ui, /function Update-AuraUiMirror[\s\S]{0,240}?IsCompleted/,
    "The mirror pump must poll capture tasks without blocking the UI thread");
  assert.match(ui, /data-claude-aura-main-canvas[\s\S]{0,240}?data-claude-aura-prompt/,
    "The mirror probe must read the renderer's marked live layout");
  assert.match(ui, /\$script:MirrorProbeTask = \$script:WebView\.CoreWebView2\.ExecuteScriptAsync\(\$probe\)/,
    "Mirror geometry must come from a non-blocking layout probe of the live page");
  assert.match(studioEditor, /type:\s*"set-appearance",\s*appearance/,
    "Editor light\/dark switching must drive the real window's appearance");
  assert.match(studioApp, /data\.type === "aura-mirror"[\s\S]{0,120}?receiveMirror/,
    "The Studio bridge listener must route mirror frames to the editor controller");
  assert.match(studioEditor, /data:image\/jpeg;base64,/,
    "The editor must accept only in-memory JPEG data URLs as mirror frames");
  assert.match(studioHtml, /id="stage-mirror"/,
    "The editor must expose the real-window mirror panel");
  assert.match(studioHtml, /id="stage-matrix"/,
    "The editor must expose the light\/dark and context state matrix");
  assert.match(studioHtml, /id="stage-backdrop"/,
    "The stage must offer the live-capture backdrop toggle");
  assert.match(studioEditorCss, /data-backdrop="capture"/,
    "Capture mode must restyle the stage so the real window shows through");
  assert.match(studioEditor, /stage-layers-panel/,
    "The stage must expose its layer selection panel");
  assert.equal((studioHtml.match(/type="radio" name="editor-level"/g) ?? []).length, 2,
    "The editor must offer native Simple and All-controls mode radios");
  assert.match(studioEditorCss, /\.editor-view\[data-level="simple"\] \.editor-controls/,
    "Simple mode must hide the detailed control column");
  assert.match(studioEditor, /stageHiddenLayers/,
    "Stage eye toggles must stay session-local instead of editing the draft");
  assert.match(studioEditor, /dataset\.stageHandle = "move"/,
    "Selection chrome must include keyboard-focusable move handles");
  assert.match(studioEditor, /dataset\.stageHandle = "scale"/,
    "Selection chrome must include keyboard-focusable resize handles");
  assert.match(ui,
    /function Show-AuraUiMain[\s\S]{0,420}?\.Activate\(\)[\s\S]{0,120}?\.BringToFront\(\)/,
    "The open-aura action must restore and foreground the main Aura window");
  assert.match(ui,
    /(?:\$script:StudioMessageTypes\s+-cnotcontains\s+\$message\.type|\$message\.type\s+-cnotin\s+\$script:StudioMessageTypes)/i,
    "Studio message actions must be checked case-sensitively against the allowlist");
  assert.match(ui, /\$message\.type\s+-isnot\s+\[string\]/i,
    "Studio messages must carry a string action type");
  assert.match(ui, /\$message\.PSObject\.Properties/i,
    "Studio messages must validate their exact property shape");
  assert.match(ui, /\$Json\.Length\s+-gt\s+4096/,
    "Studio must bound bridge message size before parsing JSON");
  assert.match(ui, /\$sourceUri\.Scheme\s+-cne\s+['"]https['"][\s\S]{0,120}?\$sourceUri\.Host\s+-cne\s+['"]aura\.studio['"]/,
    "Studio bridge messages must come from the exact offline HTTPS host");
  assert.match(ui, /\^\[a-f0-9\]\{8\}-\[a-f0-9\]\{4\}-4\[a-f0-9\]\{3\}-\[89ab\]\[a-f0-9\]\{3\}-\[a-f0-9\]\{12\}\$/,
    "Studio edit sessions must be canonical lowercase UUIDv4 values");
  assert.match(ui, /rejected an editor message from a different session/);
  assert.match(ui, /rejected a stale editor revision/);
  assert.match(ui, /ConvertTo-AuraUiStudioInteger\s+-Value\s+\$Message\.revision\s+-Minimum\s+0\s+-Maximum\s+2147483647/,
    "Studio revisions must be bounded integers, not coercible arbitrary values");
  assert.match(ui, /\$Message\.index\s+-Minimum\s+-1\s+-Maximum\s+7/,
    "Artwork attachment must use only add or one of eight layer indexes");
  assert.match(ui, /\$Message\.value\s+-Minimum\s+0\.25\s+-Maximum\s+3\s+-Label\s+['"]Theme layer scale['"]/,
    "Studio must reject out-of-range layer scaling at the host boundary");
  assert(!/\$message\.(?:path|file|fileName)\b/i.test(ui),
    "Editor bridge messages must never accept a page-supplied filesystem path");
  assert.match(ui, /-c(?:not)?match\s+['"]\^\[a-z\]\[a-z0-9-\]\{1,39\}\$['"]/,
    "Studio theme IDs must use the canonical case-sensitive kebab-case check");
  assert.match(ui, /\$message\.enabled\s+-isnot\s+\[bool\]/i,
    "Studio enabled-state messages must carry a real Boolean");
  assert.match(ui, /\$message\.appearance\s+-isnot\s+\[string\]/i,
    "Studio appearance messages must carry a string");
  assert.match(ui, /\$Appearance\s+-cnotin\s+@\(\s*['"]system['"]\s*,\s*['"]light['"]\s*,\s*['"]dark['"]\s*\)/,
    "Studio appearance values must be checked case-sensitively against the exact enum");
  assert.match(ui, /CoreWebView2PreferredColorScheme\]::Auto/);
  assert.match(ui, /CoreWebView2PreferredColorScheme\]::Light/);
  assert.match(ui, /CoreWebView2PreferredColorScheme\]::Dark/);
  assert.match(ui,
    /function Set-AuraUiPreferredColorScheme[\s\S]*?\[bool\]\$Enabled\s*=\s*\(Get-AuraUiEnabled\)[\s\S]*?if \(-not \$Enabled\)[\s\S]*?CoreWebView2PreferredColorScheme\]::Auto/,
    "Original look must restore WebView2 to the system color scheme");
  assert.match(ui, /Profile\.PreferredColorScheme\s*=\s*\$scheme/,
    "The host must apply appearance through the supported WebView2 profile API");
  assert.match(ui,
    /function Invoke-AuraUiSetEnabled[\s\S]*?Set-AuraUiConfig[^\n]*\n\s*Set-AuraUiPreferredColorScheme\s+-Enabled\s+\$Enabled[\s\S]*?if \(\$Enabled\)/,
    "Original look must reset the profile preference before renderer cleanup");
  assert.match(ui,
    /function Set-AuraUiConfig[\s\S]*?Set-AuraUiPayloadState[^\n]*\n\s*if \(\$script:WebReady -or \$script:StudioReady\) \{ Set-AuraUiPreferredColorScheme \}/,
    "Every live config mutation that can enable a theme must refresh the WebView2 preference");
  assert.match(ui, /appearance\s*=\s*\(Get-AuraUiAppearance\)/,
    "Studio state must report the persisted appearance");
  assert.match(studioHtml, /<fieldset[^>]+id="appearance-mode"[^>]+aria-describedby="appearance-help"/,
    "Studio appearance must use a labelled native fieldset");
  assert.equal((studioHtml.match(/type="radio" name="appearance"/g) ?? []).length, 3,
    "Studio must expose exactly System, Light, and Dark radio choices");
  assert.match(studioApp, /type:\s*"set-appearance",\s*appearance:\s*input\.value/,
    "Studio must send the selected appearance through the strict bridge");
  for (const copy of ["Appearance mode", "外观模式", "外觀模式", "跟随系统", "跟隨系統"]) {
    assert(studioApp.includes(copy), `Studio appearance copy is missing ${copy}`);
  }
  assert.match(studioCss, /\.appearance-option:has\(input:checked\)/,
    "The selected appearance must have a visible state");
  assert.match(ui, /ConvertTo-AuraUiStudioNumber[\s\S]*?\[double\]::IsNaN[\s\S]*?\[double\]::IsInfinity/,
    "Studio crop values must reject non-finite numbers");
  assert.match(ui, /\[Globalization\.CultureInfo\]::InvariantCulture/,
    "Studio crop values must serialize with a CSS-safe invariant decimal separator");
  assert.match(ui, /backgroundAspectRatio\s*=\s*Get-AuraUiBackgroundAspectRatio/,
    "Studio must receive the current Claude WebView aspect ratio for WYSIWYG background framing");
  assert.match(ui, /\[IO\.FileShare\]::Read\)[\s\S]*?ComputeHash\(\$sourceStream\)[\s\S]*?Clear-AuraUiStudioBackgroundPreview[\s\S]*?\$sourceStream\.CopyTo\(\$targetStream\)/,
    "Studio preview copies must hash and hold the source open while clearing owned cache files");
  assert.match(ui, /\$StudioBackgroundMaxBytes\s*=\s*16\s*\*\s*1024\s*\*\s*1024[\s\S]*?\$sourceStream\.Length[\s\S]*?-gt\s+\$StudioBackgroundMaxBytes/,
    "Studio preview copies must recheck the open source against the 16 MB limit");
  assert.match(ui, /\.aura-cache/,
    "Studio preview cleanup must be limited to marker-owned cache files");
  assert.match(baseCss, /\.claude-aura-image\s*\{[^}]*inset:\s*0[^}]*transform:\s*scale\(var\(--aura-image-scale,\s*1\)\)/s,
    "The live image layer must use the same exact frame and zoom model as Studio");
  const contentScopeArtRule = baseCss.match(/#claude-aura-backdrop\[data-art-scope="content"\]\s+\.claude-aura-theme-art\s*\{([^}]*)\}/)?.[1] ?? "";
  assert.match(contentScopeArtRule, /left:\s*var\(--aura-main-start,\s*0\)/,
    "Content-canvas artwork must begin after the marked live sidebar");
  assert.match(contentScopeArtRule, /overflow:\s*hidden/,
    "Content-canvas framed artwork must clip before it can spill under the sidebar");
  assert(!/#claude-aura-backdrop\[data-art-scope="full-window"\]\s+\.claude-aura-theme-art\s*\{[^}]*overflow:\s*hidden/s.test(baseCss),
    "Full-window artwork must remain free to continue behind the translucent sidebar");
  assert.match(studioApp, /send\(\{\s*type:\s*"set-image"\s*\}\)/,
    "The Studio page must let the host choose image paths");
  for (const action of ["set-theme", "set-appearance", "set-image", "clear-image", "set-enabled", "open-aura", "open-desktop"]) {
    assert(new RegExp(`type:\\s*"${action}"`).test(studioApp),
      `Studio must retain the ${action} capability removed from the main toolbar`);
  }
  assert.match(studioApp, /\{\s*type:\s*"set-image-framing"\s*,\s*\.\.\.saved\s*\}/,
    "The Studio page must persist background framing without supplying a path");
  assert.match(studioApp, /\{\s*type:\s*"set-card-preview-crop"\s*,\s*theme:/,
    "The Studio page must persist per-theme card framing");
  assert.match(studioApp, /send\(\{\s*type:\s*"import-theme"\s*\}\)/,
    "The Studio page must let the host choose import paths");
  assert.match(studioHtml,
    /<button\s+type="button"\s+id="open-aura"\s+class="ghost-button"\s+data-i18n="auraWindow">Back to Claude Aura<\/button>/,
    "Studio must expose an accessible, localized route back to its Aura window");
  assert.match(studioApp,
    /document\.getElementById\("open-aura"\)\.addEventListener\("click",\s*\(\)\s*=>\s*send\(\{\s*type:\s*"open-aura"\s*\}\)\)/,
    "Studio must send a type-only open-aura bridge message");
  for (const copy of ["Back to Claude Aura", "返回 Claude Aura", "回到 Claude Aura"]) {
    assert(studioApp.includes(`auraWindow: "${copy}"`), `Studio back-navigation copy is missing ${copy}`);
  }
  const documentFrameRule = studioCss.match(/html,\s*\nbody\s*\{([^}]*)\}/)?.[1] ?? "";
  assert.match(documentFrameRule, /width:\s*100%/);
  assert.match(documentFrameRule, /height:\s*100%/);
  assert.match(documentFrameRule, /overflow:\s*hidden/,
    "The Studio document must not create a blank outer scrollbar");
  const studioShellRule = studioCss.match(/\.studio\s*\{([^}]*)\}/)?.[1] ?? "";
  assert.match(studioShellRule, /min-width:\s*0/);
  assert.match(studioShellRule, /min-height:\s*0/);
  assert.match(studioShellRule, /overflow:\s*hidden/,
    "The Studio shell must contain scrolling inside its intended region");
  const studioContentRule = studioCss.match(/\.content\s*\{([^}]*)\}/)?.[1] ?? "";
  assert.match(studioContentRule, /min-width:\s*0/);
  assert.match(studioContentRule, /min-height:\s*0/);
  assert.match(studioContentRule, /overflow:\s*auto/,
    "Studio content must remain usable at its supported minimum size");
  const studioRailRule = studioCss.match(/\.rail\s*\{([^}]*)\}/)?.[1] ?? "";
  assert(!/overflow(?:-x|-y)?:\s*(?:auto|scroll)/.test(studioRailRule),
    "The Studio rail must not become a competing page scroller");
  assert.match(studioCss, /\.rail-foot\s*\{[^}]*display:\s*grid[^}]*gap:\s*8px[^}]*\}/,
    "The Aura and official Desktop actions must remain separately usable in the rail");
  assert.match(ui, /\$script:StudioForm\.MinimumSize\s*=\s*\[Drawing\.Size\]::new\(760,\s*560\)/,
    "Studio must retain its tested minimum window size");
  assert.match(studioApp, /syncHostThemes\(data\.themes\)/,
    "Studio must refresh its theme cards from validated host metadata after import");
  assert.match(studioApp, /source !== "builtin"[\s\S]{0,80}?source !== "user"/,
    "Studio must reject unknown host theme sources");
  assert.match(studioApp, /Object\.hasOwn\(themes,\s*incomingTheme\.name\)\s*\?\s*themes\[incomingTheme\.name\]\s*:\s*null/,
    "Studio must treat valid ids such as constructor as own theme keys, not inherited object properties");
  assert.match(studioHtml, /class="rail-item is-current"[^>]*aria-current="page"/,
    "Studio must expose the current navigation destination semantically");
  assert.match(studioApp, /removeAttribute\("aria-current"\)/);
  assert.match(studioApp, /setAttribute\("aria-current",\s*"page"\)/);
  assert.match(studioApp, /image\.className = "theme-card-preview";[\s\S]{0,160}?image\.alt = "";[\s\S]{0,160}?image\.setAttribute\("aria-hidden", "true"\)/,
    "Studio selector previews must be decorative images");
  assert.match(studioHtml, /<dialog id="crop-dialog"[\s\S]*?id="crop-stage"[\s\S]*?id="crop-zoom"/,
    "Studio must provide one reusable, labelled framing dialog with zoom");
  assert.match(studioApp, /setPointerCapture\(event\.pointerId\)/,
    "Studio framing must keep pointer drags captured outside the crop stage");
  assert.match(studioHtml, /id="crop-x"[^>]*type="range"[\s\S]*id="crop-y"[^>]*type="range"[\s\S]*id="crop-zoom"[^>]*type="range"/,
    "Studio framing must expose native keyboard-operable controls for every crop dimension");
  assert(!/id="crop-stage"[^>]*tabindex/.test(studioHtml),
    "The pointer-only crop canvas must not masquerade as a keyboard control");
  assert.match(studioHtml, /id="crop-error"[^>]*role="status"[^>]*aria-live="polite"/,
    "Crop failures must be announced inside the modal dialog");
  assert.match(studioApp, /pendingCropSave[\s\S]*cropsEqual\(persisted,\s*pending\.crop\)/,
    "Studio must wait for host-confirmed persisted crop state before closing the dialog");
  assert.match(studioApp, /addEventListener\("pointerdown"[\s\S]{0,240}?pendingCropSave/,
    "Studio must freeze pointer dragging while a framing save acknowledgement is pending");
  assert.match(studioApp, /data\.action\s*===\s*pendingCropSave\.action[\s\S]*data\.actionSucceeded/,
    "Studio must ignore unrelated host state while a framing save is pending");
  assert.match(studioApp, /cropCancelButtons[\s\S]*button\.disabled\s*=\s*busy[\s\S]*addEventListener\("cancel"[\s\S]*pendingCropSave[\s\S]*preventDefault/,
    "Studio must prevent closing and reopening a crop editor while its save acknowledgement is pending");
  assert.match(studioHtml, /id="crop-notice"[^>]*role="status"/,
    "Studio must disclose when an advanced CSS position will be normalized by the visual editor");
  assert.match(studioCss, /\.crop-stage\s*\{[^}]*touch-action:\s*none[^}]*\}/,
    "Touch gesture suppression must be scoped to the crop stage");
  assert.match(assetConverter, /const cardSelection = cardsOnly\s*\?[\s\S]{0,280}:\s*\{\};/,
    "Ordinary runtime-asset conversion must not depend on gitignored Studio reference images");
  assert.match(assetConverter, /args\[0\]\s*===\s*['"]--studio-import['"]/,
    "Artwork conversion must use a dedicated host-only mode");
  assert.match(assetConverter, /args\.length\s*!==\s*6[\s\S]{0,180}?--target[\s\S]{0,180}?--output-root/,
    "Studio conversion must reject unrecognized or missing command arguments");
  assert.match(assetConverter, /sourceStat\.isSymbolicLink\(\)[\s\S]{0,180}?16\s*\*\s*1024\s*\*\s*1024/,
    "Studio conversion must reject symbolic-link and oversized source files");
  assert.match(assetConverter, /!rootStat\.isDirectory\(\)\s*\|\|\s*rootStat\.isSymbolicLink\(\)/,
    "Studio conversion must reject a redirected output root");
  assert.match(assetConverter, /!parentStat\.isDirectory\(\)\s*\|\|\s*parentStat\.isSymbolicLink\(\)/,
    "Studio conversion must reject a redirected output folder");
  assert.match(assetConverter, /pathIsWithin\(resolvedRoot,\s*resolvedTarget\)[\s\S]{0,180}?\^layer-\[0-9a-f\]\{32\}\\\.webp\$/,
    "Studio conversion targets must be opaque WebP names below the editor root");
  assert.match(assetConverter, /for\s*\(let step = 0; step < 18 && !selected; step \+= 1\)/,
    "Studio conversion must make a bounded series of resize/quality attempts");
  assert.match(assetConverter, /Math\.pow\(0\.84,\s*Math\.floor\(step\s*\/\s*qualities\.length\)\)/);
  assert.match(assetConverter, /blob\.size\s*>\s*0\s*&&\s*blob\.size\s*<\s*400000/,
    "Studio conversion must keep resizing until the raster fits its layer budget");
  assert.match(assetConverter, /detectStudioImage\(bytes\)\s*!==\s*['"]image\/webp['"]/,
    "Studio conversion must verify WebP content before writing");
  assert.match(assetConverter, /!Number\.isInteger\(width\)[\s\S]{0,180}?!Number\.isInteger\(height\)[\s\S]{0,180}?dimensions are invalid/,
    "Studio conversion must verify positive integer dimensions before writing");
  assert.match(assetConverter, /await fs\.writeFile\(temporary,[\s\S]{0,180}?await fs\.rename\(temporary,\s*resolvedTarget\)/,
    "Studio conversion must publish through an atomic temporary-file rename");
  const unknownRuntimeTheme = spawnSync(process.execPath, [
    path.join(PROJECT_ROOT, "scripts", "convert-theme-assets.mjs"),
    "not-installed",
  ], { cwd: PROJECT_ROOT, encoding: "utf8" });
  assert.notEqual(unknownRuntimeTheme.status, 0,
    "Unknown runtime theme IDs must not become silent no-ops");
  assert.match(`${unknownRuntimeTheme.stdout}\n${unknownRuntimeTheme.stderr}`, /Unknown theme/);

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
  assert.match(studioCss, /\.theme-card-preview-frame\s*\{[^}]*aspect-ratio:\s*3\s*\/\s*2[^}]*\}/,
    "Card framing needs a real crop window instead of the source image's identical 16:9 ratio");
  assert.match(studioApp, /const CARD_PREVIEW_MAX_ZOOM\s*=\s*6/,
    "Full Studio preview masters need enough zoom to reach the former tight crops");
  assert.match(studioApp, /defaultCropForTheme[\s\S]{0,320}?studioPreviewFrame/,
    "Studio cards must apply registry framing metadata without rewriting their masters");
  assert.match(studioApp, /aura\.previews[\s\S]{0,180}?\.png/,
    "Studio cards must load preserved preview masters from their isolated virtual host");
  assert.match(ui, /SetVirtualHostNameToFolderMapping\(\s*['"]aura\.previews['"][\s\S]{0,120}?\$StudioPreviewRoot/,
    "The host must expose only the categorized preview-master directory");
  assert.match(ui, /SetVirtualHostNameToFolderMapping\(\s*['"]aura\.user-themes['"][\s\S]{0,120}?\$UserThemesRoot/,
    "Studio must be able to display a validated user theme's app mark");
  assert.match(studioHtml, /id="rail-theme-mark"/,
    "Aura Studio must show the active theme identity in its own rail");
  assert.match(studioApp, /launcherMarkUrl\(identityTheme\)/,
    "Switching the active theme must update Studio's app identity");

  const editorScriptIndex = studioHtml.indexOf('<script src="editor.js"></script>');
  const appScriptIndex = studioHtml.indexOf('<script src="app.js"></script>');
  assert(editorScriptIndex >= 0 && appScriptIndex > editorScriptIndex,
    "The isolated editor module must load before the Studio bridge glue");
  assert.equal((studioApp.match(/bridge\.addEventListener\("message"/g) ?? []).length, 1,
    "Studio must retain one host bridge listener for gallery and editor state");
  assert.match(studioApp, /editorController\s*=\s*window\.CLAUDE_AURA_EDITOR\?\.createController/,
    "Studio must initialize the isolated editor controller through its public API");
  assert.match(studioApp, /editorController\?\.receive\(data\.editor,\s*state\.appearance\)/,
    "The sole Studio bridge listener must pass validated editor state to the editor controller");
  assert.match(studioApp, /source === "builtin"[\s\S]{0,260}?type:\s*"create-theme-copy"/,
    "Built-in theme cards must expose duplicate-to-customize instead of direct editing");
  assert.match(studioApp, /type:\s*"begin-theme-edit",\s*theme:\s*theme\.name,\s*reset:\s*false/,
    "User theme cards must begin an explicit edit session");
  assert.match(studioEditor, /send\(\{\s*type:\s*"delete-user-theme",\s*theme\s*\}\)/,
    "User theme deletion must send only the validated theme id");
  assert.match(studioEditor, /\["launcher-mark",\s*"slotLauncherMark"\]/,
    "The local customization prompt builder must offer the app and launcher mark slot");
  assert.match(studioEditor, /launcherPromptTemplate[\s\S]{0,420}?96×96[\s\S]{0,260}?72×72/,
    "The launcher prompt must name the exact output size and compact safe area");
  assert.match(studioEditor, /promptRuleLauncher[\s\S]{0,280}?(?:title bar|标题栏|標題列)/,
    "The launcher prompt must explain that one theme mark serves the complete app identity");
  assert(!/(?:fetch\s*\(|XMLHttpRequest|WebSocket|EventSource|chrome\s*\.\s*webview|postMessage\s*\()/i.test(studioEditor),
    "The editor module must not own network or host-bridge access");
  assert(!/(?:dragstart|dragend|ondrop|dataTransfer)/i.test(studioEditor),
    "The editor must not use HTML5 drag-and-drop; stage drags are pointer events with keyboard alternatives");
  assert.match(studioEditor, /direction:\s*"up"/,
    "Layer ordering must keep its keyboard-operable move-up button");
  assert.match(studioEditor, /direction:\s*"down"/,
    "Layer ordering must keep its keyboard-operable move-down button");
  assert.match(studioEditor, /"ArrowLeft"[\s\S]{0,900}?"ArrowRight"[\s\S]{0,900}?"ArrowUp"[\s\S]{0,900}?"ArrowDown"/,
    "Every stage pointer drag must keep an arrow-key alternative");
  assert.match(studioEditor, /tabIndex = 0/,
    "Stage items must be keyboard focusable");
  assert.match(studioEditor, /pumpMutationQueue/,
    "Stage commits must flow through the queued validated bridge actions");
  assert.match(studioEditor, /type:\s*"set-theme-layer"[\s\S]{0,200}?preset/,
    "Stage layer drags must commit through the validated set-theme-layer action");
  assert.match(studioHtml, /id="editor-stage"[^>]*role="group"/,
    "The live framing stage must be a labelled group, not a reconstructed Claude page");
  assert.equal((studioHtml.match(/type="radio" name="stage-viewport"/g) ?? []).length, 2,
    "The stage must expose native normal and wide framing toggles");
  assert.equal((studioHtml.match(/type="radio" name="stage-context"/g) ?? []).length, 2,
    "The stage must expose native new-chat and conversation context toggles");
  assert.match(studioEditor, /window\.CLAUDE_AURA_EDITOR\s*=\s*Object\.freeze\(\{\s*createController,\s*normalizeEditorState\s*\}\)/,
    "The editor module must expose only its controller and state validator");

  const editorActionMatch = studioEditor.match(/const ACTIONS\s*=\s*new Set\(\[([\s\S]*?)\]\);/);
  assert(editorActionMatch, "The editor action allowlist is missing");
  assert.deepEqual([...editorActionMatch[1].matchAll(/["']([^"']+)["']/g)].map((match) => match[1]),
    Object.keys(expectedEditorMessageShapes),
  "The editor page and Windows host must share the exact twelve-action editor allowlist");

  const editorStringsMatch = studioEditor.match(/const STRINGS\s*=\s*(\{[\s\S]*?\n  \});\n\n  const ID_PATTERN/);
  assert(editorStringsMatch, "Editor locale dictionaries could not be isolated");
  const editorStrings = new Function(`return (${editorStringsMatch[1]});`)();
  assert.deepEqual(Object.keys(editorStrings).sort(), ["en", "zh-CN", "zh-TW"]);
  const editorCopyKeys = Object.keys(editorStrings.en).sort();
  assert(editorCopyKeys.length >= 180, "The editor locale surface is unexpectedly incomplete");
  for (const locale of ["zh-CN", "zh-TW"]) {
    assert.deepEqual(Object.keys(editorStrings[locale]).sort(), editorCopyKeys,
      `${locale} editor copy does not cover the same UI states as English`);
    for (const key of editorCopyKeys) assert(String(editorStrings[locale][key]).trim(), `${locale}.${key} is empty`);
  }
  assert.equal(editorStrings["zh-CN"].interfaceFont, "界面字体");
  assert.equal(editorStrings["zh-CN"].addLayer, "添加图层");
  assert.equal(editorStrings["zh-CN"].saveTheme, "保存主题");
  assert.equal(editorStrings["zh-CN"].fullWindow, "整个窗口");
  assert.equal(editorStrings["zh-TW"].interfaceFont, "介面字體");
  assert.equal(editorStrings["zh-TW"].addLayer, "新增圖層");
  assert.equal(editorStrings["zh-TW"].saveTheme, "儲存主題");
  assert.equal(editorStrings["zh-TW"].fullWindow, "整個視窗");
  assert.notEqual(editorStrings["zh-CN"].guideOnlyNotice, editorStrings["zh-TW"].guideOnlyNotice,
    "Simplified and Traditional Chinese editor guidance must remain independently authored");

  assert.match(studioHtml, /id="nav-editor"[^>]+href="#editor"[^>]+hidden/,
    "The editor navigation destination must appear only during an active edit session");
  assert.equal((studioHtml.match(/type="radio" name="editor-mode"/g) ?? []).length, 2,
    "The editor must use native Light and Dark radio controls");
  assert.equal((studioHtml.match(/type="radio" name="background-scope"/g) ?? []).length, 2,
    "The editor must use native Content canvas and Full window radio controls");
  for (const control of [
    "editor-font-ui", "editor-font-display", "editor-radius", "editor-blur", "editor-shadow",
    "editor-prompt-width", "editor-prompt-x", "editor-prompt-y", "editor-undo", "editor-redo",
    "editor-reset", "editor-add-layer", "editor-cancel", "editor-save",
  ]) assert(studioHtml.includes(`id="${control}"`), `Editor is missing the native ${control} control`);
  assert.match(studioHtml, /id="editor-live"[^>]+role="status"[^>]+aria-live="polite"/,
    "Editor mutations must be announced through a polite live region");
  assert.match(studioHtml, /id="editor-error-summary"[^>]+role="status"[^>]+aria-live="polite"[^>]+tabindex="-1"/,
    "Editor validation errors must be focusable and announced");
  assert.match(studioEditor, /errorSummary\.focus\?\.\(\)/,
    "A blocked save must move focus to its validation summary");
  assert.match(studioEditor, /data-editor-focus[\s\S]{0,240}?\.focus\(\)/,
    "Rerendered editor controls must restore logical keyboard focus");
  assert.match(studioEditor, /postToken\("mode-copy",\s*"tokens",\s*"light"\)/);
  assert.match(studioEditor, /postToken\("mode-copy",\s*"tokens",\s*"dark"\)/,
    "Light and Dark token-copy conveniences must use validated bridge enums");
  assert.match(studioEditor, /postToken\("shared",\s*"backgroundScope",\s*input\.value\)/,
    "Background scope must persist through the validated shared-token route");
  assert.match(studioEditor, /input\.valueAsNumber\s*\/\s*100/,
    "Prompt placement ranges must normalize to the schema ratios");
  assert.match(studioEditor, /state\.layers\.length\s*>=\s*8/,
    "The editor must disable or reject a ninth artwork layer");
  assert.match(studioEditor, /saveButton\.disabled\s*=\s*busy\s*\|\|\s*\(!state\.dirty\s*&&\s*!state\.isNew\)\s*\|\|\s*!state\.feedback\.valid/,
    "A fresh valid duplicate must remain saveable even before its first token edit");
  assert(!/normalized\??\.error/.test(studioEditor),
    "Editor failure announcements must use localized copy instead of exposing raw core error codes");
  assert.match(studioEditor, /returnTheme\s*=\s*normalized\.isNew\s*\?\s*normalized\.sourceId\s*:\s*normalized\.id/,
    "An unsaved duplicate must remember its source theme for focus restoration");
  assert.match(studioEditor, /const focusId\s*=\s*action\s*===\s*"delete-user-theme"\s*\?\s*"default"\s*:\s*returnTheme[\s\S]{0,120}?focusThemeCard\?\.\(focusId\)/,
    "Closing an unsaved duplicate must return keyboard focus to its source card");
  assert.match(studioEditor, /replace\(\/\(\?:https\?\|file\):\\\/\\\/\\S\+\/gi/,
    "The local prompt builder must remove URL-like input");
  assert.match(studioEditor, /replace\(\/\[A-Za-z\]:\\\\\\S\*\/g/,
    "The local prompt builder must remove Windows path-like input");

  const guideMatch = studioHtml.match(/<figure class="asset-guide"[\s\S]*?<\/figure>/);
  assert(guideMatch, "The editor asset guide is missing");
  assert(!/<(?:button|input|select|textarea|a)\b/i.test(guideMatch[0]),
    "The abstract asset guide must not simulate an interactive Claude interface");
  assert.match(studioHtml, /Guide only — this is not a Claude preview/,
    "The asset guide must explicitly distinguish itself from live Aura evidence");
  assert.match(studioHtml, /Nothing is sent to a model or network service/,
    "The local prompt builder must disclose its offline behavior");
  assert.match(studioEditorCss, /@media\s*\(prefers-reduced-motion:\s*reduce\)/,
    "The editor must honor reduced-motion preferences");
  assert.match(studioEditorCss, /@media\s*\(forced-colors:\s*active\)/,
    "The editor must remain operable in forced-colors mode");

  const editorWindow = {};
  new Function("window", studioEditor)(editorWindow);
  const validEditorState = {
    active: true,
    id: "studio-copy",
    sourceId: "default",
    source: "builtin",
    isNew: true,
    session: "12345678-1234-4abc-8def-1234567890ab",
    revision: 0,
    dirty: false,
    canUndo: false,
    canRedo: false,
    label: "Studio Copy",
    tokens: {
      light: { canvas: "#F8F8F8", sidebar: "#EFEFEF", surface: "#FFFFFF", text: "#202020", accent: "#805AD5", border: "#777777", surfaceAlpha: 0.9, sidebarAlpha: 0.8 },
      dark: { canvas: "#181818", sidebar: "#202020", surface: "#282828", text: "#F0F0F0", accent: "#B794F4", border: "#999999", surfaceAlpha: 0.85, sidebarAlpha: 0.75 },
    },
    shared: {
      fontUi: "system-sans", fontDisplay: "editorial-serif", radius: 12, blur: 16,
      shadow: "soft", backgroundScope: "content", prompt: { width: 0.7, x: 0, y: 0 },
    },
    layers: [{
      index: 0, role: "hero", appearance: "all", context: "new-chat", viewport: "normal",
      visible: true, opacity: 0.9, mask: "soft-right", mobile: "reduce", bytes: 399_999,
      previewUrl: "https://aura.editor/active/layer-00000000000000000000000000000000.webp?v=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
      frames: {
        normal: { anchor: "right", focalX: 70, focalY: 50, positionX: 0, positionY: 0, scale: 1 },
        wide: { anchor: "bottom-right", focalX: 75, focalY: 55, positionX: -5, positionY: 5, scale: 1.1 },
      },
    }],
    feedback: {
      valid: true,
      contrast: { light: [], dark: [] },
      budget: {
        chromeBytes: 60_000, chromeLimit: 65_000, embeddedArtworkBytes: 399_999,
        embeddedArtworkLimit: 1_400_000, sourceArtworkBytes: 399_999, sourceArtworkLimit: 1_400_000,
        pass: true, layers: [{ id: 0, bytes: 399_999, limit: 400_000, pass: true }],
      },
      errors: [],
    },
  };
  assert(editorWindow.CLAUDE_AURA_EDITOR.normalizeEditorState(structuredClone(validEditorState)),
    "The Studio page rejected a valid host editor state");
  const pathState = structuredClone(validEditorState);
  pathState.layers[0].previewUrl = "file:///C:/private/theme.webp";
  assert.equal(editorWindow.CLAUDE_AURA_EDITOR.normalizeEditorState(pathState), undefined,
    "The Studio page accepted a filesystem URL in editor state");
  const remoteState = structuredClone(validEditorState);
  remoteState.layers[0].previewUrl = "https://example.com/layer.webp?v=0123456789abcdef0123456789abcdef";
  assert.equal(editorWindow.CLAUDE_AURA_EDITOR.normalizeEditorState(remoteState), undefined,
    "The Studio page accepted a remote artwork preview origin");
  const extraState = { ...structuredClone(validEditorState), draftPath: "C:\\private\\draft" };
  assert.equal(editorWindow.CLAUDE_AURA_EDITOR.normalizeEditorState(extraState), undefined,
    "The Studio page accepted an unexpected or path-bearing state property");
  const ninthLayerState = structuredClone(validEditorState);
  ninthLayerState.layers = Array.from({ length: 9 }, (_, index) => ({
    ...structuredClone(validEditorState.layers[0]), index,
  }));
  assert.equal(editorWindow.CLAUDE_AURA_EDITOR.normalizeEditorState(ninthLayerState), undefined,
    "The Studio page accepted a ninth artwork layer");
  const staleShapeState = structuredClone(validEditorState);
  staleShapeState.revision = "0";
  assert.equal(editorWindow.CLAUDE_AURA_EDITOR.normalizeEditorState(staleShapeState), undefined,
    "The Studio page accepted a nonnumeric edit revision");

  const generatedMatch = studioGenerated.match(/window\.CLAUDE_AURA_THEMES\s*=\s*([\s\S]+);\s*$/);
  assert(generatedMatch, "Studio theme metadata could not be parsed");
  const studioThemes = JSON.parse(generatedMatch[1]);
  assert.deepEqual(Object.keys(studioThemes), THEME_IDS);
  let selectorPreviewCount = 0;
  for (const themeId of THEME_IDS) {
    const expectedPath = themeId === "default" ? null : `assets/studio-previews/masters/${themeId}.png`;
    assert.equal(studioThemes[themeId].source, "builtin",
      `${themeId} Studio metadata must mark immutable bundled themes explicitly`);
    assert.equal(studioThemes[themeId].studioPreview, expectedPath,
      `${themeId} Studio preview metadata is incorrect`);
    if (!expectedPath) {
      assert.equal(studioThemes[themeId].studioPreviewFrame, null);
      continue;
    }
    selectorPreviewCount += 1;
    const bytes = await fs.readFile(path.join(PROJECT_ROOT, expectedPath));
    assert(bytes.length > 0 && bytes.length < 3_000_000, `${themeId} Studio master exceeds its product-media budget`);
    assert.deepEqual([...bytes.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
    assert.deepEqual([bytes.readUInt32BE(16), bytes.readUInt32BE(20)],
      STUDIO_PREVIEW_MASTERS[themeId].dimensions, `${themeId} Studio master dimensions changed`);
    assert.equal(crypto.createHash("sha256").update(bytes).digest("hex"),
      STUDIO_PREVIEW_MASTERS[themeId].sha256, `${themeId} Studio master was rewritten or cropped`);
    assert.deepEqual(studioThemes[themeId].studioPreviewFrame, STUDIO_PREVIEW_MASTERS[themeId].frame,
      `${themeId} Studio starting frame does not match the approved legacy composition`);
  }
  assert.equal(selectorPreviewCount, 7);
  await assert.rejects(fs.access(path.join(PROJECT_ROOT, "theme_demo_previews")),
    "Theme demo previews must live under the categorized assets tree");
  const alternateReference = await fs.readFile(path.join(
    PROJECT_ROOT, "assets", "studio-previews", "references", "cartoon-ocean-alternate.png"));
  assert.equal(crypto.createHash("sha256").update(alternateReference).digest("hex"),
    "bbc7c3271ab67abcf21ffb177723d5f4d85cb13456d528f29b4904969a75e7a7",
    "The unassigned ocean reference must remain preserved byte-for-byte");
  assert(!/theme_demo_previews|Claude app interface with K-pop|Elegant Japanese-inspired/i.test(studioGenerated),
    "Generated Studio metadata must use categorized, theme-scoped master paths");
  assert(!/\$message\.(?:path|file|fileName)\b/i.test(ui),
    "The Studio host must never accept a page-supplied file path");
  assert.match(ui, /\$UserThemesRoot\s*=\s*Join-Path\s+\$DataRoot\s+['"]themes['"]/,
    "Installed themes must live under the user data themes folder");
  assert.match(ui, /\[System\.Windows\.Forms\.FolderBrowserDialog\]::new\(\)/,
    "Theme kit paths must come from a host-owned folder picker");
  assert.match(ui, /Invoke-AuraUiNode[\s\S]{0,400}?['"]validate['"][\s\S]{0,240}?\$dialog\.SelectedPath/,
    "The host must validate the selected kit folder through the Node helper before copying it");
  assert.match(ui, /Assert-AuraUiThemeKitTree[\s\S]{0,1400}?ReparsePoint/,
    "Theme installation must reject junctions and symbolic links");
  assert.match(ui, /function Assert-AuraUiThemeInstallRoot[\s\S]{0,2400}?ReparsePoint/,
    "Theme installation must reject a redirected app-data destination root");
  const stagingIndex = ui.indexOf("'.install-{0}-{1}' -f $Id");
  const atomicMoveIndex = ui.indexOf("[IO.Directory]::Move($staging, $destination)", stagingIndex);
  assert(stagingIndex >= 0 && atomicMoveIndex > stagingIndex,
    "Theme installation must copy to a private staging folder before an atomic directory move");
  assert.match(ui, /\$expectedTarget\s*=\s*\[IO\.Path\]::GetFullPath\(\(Join-Path \$userRoot \$Id\)\)/,
    "Theme rollback must only remove the exact user-root/id destination");
  assert.match(ui, /Update-AuraUiThemes[\s\S]{0,500}?Invoke-AuraUiSelectTheme\s+-Theme\s+\$importedId/,
    "A validated imported theme must refresh the registry and apply immediately");
  const configSnapshotIndex = ui.indexOf("$previousConfigJson = [IO.File]::ReadAllText");
  const configRestoreIndex = ui.indexOf("Restore-AuraUiConfigSnapshot -Json $previousConfigJson", configSnapshotIndex);
  assert(configSnapshotIndex >= 0 && configRestoreIndex > configSnapshotIndex,
    "A failed post-copy import must restore the complete pre-import configuration");
  assert(!/SetVirtualHostNameToFolderMapping\([\s\S]{0,120}?\$imageValue/i.test(ui),
    "Studio must never map the selected image's source directory");
  assert.match(ui, /\[System\.Windows\.Forms\.OpenFileDialog\]::new\(\)/,
    "Image paths must come from a host-side OpenFileDialog");

  assert.match(ui, /\[System\.Windows\.Forms\.NotifyIcon\]::new\(\)/);
  assert.match(ui, /\[System\.Windows\.Forms\.ContextMenuStrip\]::new\(\)/);
  assert.match(ui, /\$script:TrayOpenStudioItem\.add_Click\(\s*\{\s*Show-AuraUiStudio\s*\}\)/,
    "The tray must retain access to Studio after the main toolbar is removed");
  assert.match(ui,
    /\$script:TrayAppearanceItem\.add_Click\(\s*\{[\s\S]{0,300}?Invoke-AuraUiSetEnabled/,
    "The tray must retain the Original look toggle after the main toolbar is removed");
  assert.match(ui,
    /\$script:TrayOpenDesktopItem\.add_Click\(\s*\{[\s\S]{0,300}?Invoke-AuraUiOpenDesktopApp/,
    "The tray must retain the desktop-app action after the main toolbar is removed");
  assert.match(ui, /\$script:TrayIcon\.add_(?:Mouse)?DoubleClick\(\s*\{[\s\S]{0,300}?Show-AuraUiStudio/,
    "Double-clicking the tray icon must open Studio");
  assert.match(ui, /\$script:TrayIcon\.Dispose\(\)/,
    "The tray icon must be disposed when Claude Aura closes");
  assert.match(ui, /\$AuraIconPath\s*=\s*Join-Path\s+\$Root\s+['"]assets\\brand\\claude-aura\.ico['"]/,
    "Aura forms and notification area must load the owned application icon");
  const iconFactoryStart = ui.indexOf("function New-AuraUiIcon");
  const iconFactoryEnd = ui.indexOf("\nfunction ", iconFactoryStart + 1);
  const iconFactory = ui.slice(iconFactoryStart, iconFactoryEnd);
  assert.match(iconFactory, /\[IO\.File\]::Open\(\$AuraIconPath/);
  assert.match(iconFactory, /\[Drawing\.Icon\]::new\(\$stream,\s*\$Size,\s*\$Size\)/);
  assert.match(iconFactory, /return \[Drawing\.Icon\]\$source\.Clone\(\)/,
    "Each consumer must own its cloned icon instance");
  assert.match(iconFactory, /\$source\.Dispose\(\)[\s\S]*?\$stream\.Dispose\(\)/,
    "Temporary icon resources must be disposed");
  assert(!/Get-AuraClaudeInstall|ExtractAssociatedIcon|\.Executable/.test(iconFactory),
    "Aura must not borrow the official Claude executable icon");
  assert.match(ui, /\$script:MainIcon\s*=\s*New-AuraUiIcon -Size 64/);
  assert.match(ui, /\$script:StudioIcon\s*=\s*New-AuraUiIcon -Size 64/);
  assert.match(ui, /\$script:NotificationIcon\s*=\s*New-AuraUiIcon -Size 32/);
  assert.match(ui, /\$script:Form\.Icon\s*=\s*\$script:MainIcon/);
  assert.match(ui, /\$script:StudioForm\.Icon\s*=\s*\$script:StudioIcon/);
  assert.match(ui, /\$script:TrayIcon\.Icon\s*=\s*\$script:NotificationIcon/);
  assert.match(ui, /function New-AuraUiThemeIcon[\s\S]{0,1800}?\.GetHicon\(\)[\s\S]{0,500}?DestroyIcon/,
    "Theme marks must be converted to owned Windows icons without leaking native handles");
  assert.match(ui, /function Update-AuraUiThemeIcons[\s\S]{0,2200}?\$script:Form\.Icon\s*=\s*\$script:MainIcon[\s\S]{0,500}?\$script:StudioForm\.Icon\s*=\s*\$script:StudioIcon[\s\S]{0,500}?\$script:TrayIcon\.Icon\s*=\s*\$script:NotificationIcon/,
    "The active theme mark must update the main window, Studio window, and notification area together");
  assert.match(ui, /Update-AuraUiThemeIcons\s+-AssetPath\s+\$assetPath/,
    "Theme selection must reapply the app-wide identity from the validated launcher asset");
  assert.match(ui,
    /foreach \(\$ownedIcon in @\(\$script:MainIcon, \$script:StudioIcon, \$script:NotificationIcon\)\)[\s\S]{0,220}?\$ownedIcon\.Dispose\(\)/,
    "Every owned form and notification icon must be disposed");
  assert(!/ExtractAssociatedIcon/.test(ui), "Aura must never extract an icon from the official Claude app");

  const shortcutDefinitionsMatch = install.match(/\$shortcutDefinitions\s*=\s*@\(([\s\S]*?)\n\s*\)\s*\n\s*foreach \(\$folder/);
  assert(shortcutDefinitionsMatch, "Installer shortcut definitions are missing");
  const shortcutNames = [...shortcutDefinitionsMatch[1].matchAll(/Name\s*=\s*['"]([^'"]+\.lnk)['"]/g)]
    .map((match) => match[1]);
  assert.deepEqual(shortcutNames, ["Claude Aura.lnk", "Claude Aura Studio.lnk"],
    "Installer must create separate normal Aura and Studio shortcuts");
  assert.match(shortcutDefinitionsMatch[1],
    /Name\s*=\s*['"]Claude Aura Studio\.lnk['"][\s\S]{0,160}?Arguments\s*=\s*"\$baseArguments -OpenStudio"/,
    "The Studio shortcut must use the dedicated -OpenStudio route");
  assert.match(install, /foreach \(\$folder in @\(\$desktop, \$menuRoot\)\)/,
    "Normal Aura and Studio shortcuts must be installed on Desktop and Start menu");
  assert.match(install, /\$shortcut\.IconLocation\s*=\s*"\$iconPath,0"/,
    "Aura-owned shortcuts must use the Aura icon");
  assert(!/ExtractAssociatedIcon|IconLocation\s*=\s*[^\r\n]*(?:Claude\.exe|\$claude)/i.test(install),
    "Installer shortcuts must not borrow the official Claude executable icon");
  const uninstallShortcutBlock = uninstall.match(/foreach \(\$shortcut in @\(([\s\S]*?)\)\) \{/);
  assert(uninstallShortcutBlock, "Uninstaller shortcut allowlist is missing");
  const uninstalledShortcutNames = [...uninstallShortcutBlock[1].matchAll(/['"]([^'"]+\.lnk)['"]/g)]
    .map((match) => match[1]);
  assert.deepEqual(uninstalledShortcutNames, [
    "Claude Aura.lnk",
    "Claude Aura Studio.lnk",
    "Claude Aura.lnk",
    "Claude Aura Studio.lnk",
    "Uninstall Claude Aura.lnk",
  ], "Uninstaller must remove exactly the owned Aura shortcuts");
  assert.match(uninstall, /Remove-Item -LiteralPath \$shortcut -Force/,
    "Uninstaller shortcut removal must stay literal and scoped");
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
      chooseThemeFolder: "Choose a Claude Aura theme kit folder.",
      installingTheme: "Validating and installing theme...",
      themeInstalled: "{0} was installed and applied.",
      themeInstallFailed: "Theme could not be installed: {0}",
      themeAlreadyInstalled: "A theme named {0} is already installed.",
    },
    "zh-CN": {
      studioTitle: "Claude Aura 工作室",
      openStudio: "打开工作室",
      openDesktopApp: "打开桌面版",
      exitApp: "退出 Claude Aura",
      studioImportPending: "主题安装功能暂不可用。",
      chooseThemeFolder: "请选择 Claude Aura 主题包文件夹。",
      installingTheme: "正在校验并安装主题…",
      themeInstalled: "{0}已安装并应用。",
      themeInstallFailed: "主题安装失败：{0}",
      themeAlreadyInstalled: "名为{0}的主题已安装。",
    },
    "zh-TW": {
      studioTitle: "Claude Aura 工作室",
      openStudio: "開啟工作室",
      openDesktopApp: "開啟桌面版",
      exitApp: "結束 Claude Aura",
      studioImportPending: "目前還不能安裝主題。",
      chooseThemeFolder: "選擇 Claude Aura 主題套件資料夾。",
      installingTheme: "正在檢查並安裝主題…",
      themeInstalled: "已安裝並套用{0}。",
      themeInstallFailed: "無法安裝主題：{0}",
      themeAlreadyInstalled: "已安裝名為{0}的主題。",
    },
  };
  for (const [locale, expected] of Object.entries(expectedStudioCopy)) {
    for (const [key, value] of Object.entries(expected)) {
      assert.equal(uiCopy[locale][key], value, `${locale}.${key} must use approved native UI copy`);
    }
  }
  assert.match(ui, /Set-AuraUiFormWithinWorkingArea/);
  assert.match(ui, /Screen\]::FromControl\(\$Form\)\.WorkingArea/);
  assert.match(install, /WindowStyle Hidden/);
  assert.match(install, /Claude Aura\.lnk/);
  assert(install.includes("'studio'"), "The Windows installer must copy Aura Studio");

  if (process.platform === "win32") {
    const importCopyTestRoot = path.join(PROJECT_ROOT, "dist", `test-theme-import-${process.pid}-${Date.now()}`);
    const psPath = (value) => value.replaceAll("'", "''");
    const importCopyRegression = [
      "$ErrorActionPreference='Stop'",
      `$uiPath='${psPath(path.join(PROJECT_ROOT, "windows", "aura-ui.ps1"))}'`,
      `$testRoot='${psPath(importCopyTestRoot)}'`,
      "$tokens=$null;$errors=$null",
      "$ast=[System.Management.Automation.Language.Parser]::ParseFile($uiPath,[ref]$tokens,[ref]$errors)",
      "if($errors.Count){throw 'Could not parse Aura UI for theme import regression'}",
      "foreach($name in @('Assert-AuraUiThemeKitTree','Assert-AuraUiThemeInstallRoot','Copy-AuraUiThemeKit','Remove-AuraUiInstalledTheme','Restore-AuraUiConfigSnapshot')){",
      "  $definition=$ast.Find({param($node)$node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -ceq $name},$true)",
      "  if($null -eq $definition){throw \"Missing theme import function $name\"}",
      "  Invoke-Expression $definition.Extent.Text",
      "}",
      "function Invoke-AuraUiNode { param([string[]]$CommandArguments); return 'restored-payload' }",
      "function Set-AuraUiPayloadState { param([string]$Payload); $script:RestoredPayload=$Payload }",
      "function Update-AuraUiTrayAppearance { $script:TrayRestored=$true }",
      "function Apply-AuraUiTheme { $script:ThemeRestored=$true }",
      "$script:UiCopy=[pscustomobject]@{themeAlreadyInstalled='A theme named {0} is already installed.'}",
      "$script:Locale='en'",
      "$sourceRoot=Join-Path $testRoot 'source-kit'",
      "$outsideRoot=Join-Path $testRoot 'outside'",
      "$originalLocalAppData=$env:LOCALAPPDATA",
      "$env:LOCALAPPDATA=Join-Path $testRoot 'local-app-data'",
      "$DataRoot=Join-Path $env:LOCALAPPDATA 'ClaudeAura\\data'",
      "$UserThemesRoot=Join-Path $DataRoot 'themes'",
      "$ConfigPath=Join-Path $DataRoot 'config.json'",
      "$ThemeCli='theme-cli.mjs'",
      "$userRootJunction=$false",
      "try {",
      "  [IO.Directory]::CreateDirectory((Join-Path $sourceRoot 'notes'))|Out-Null",
      "  [IO.Directory]::CreateDirectory($outsideRoot)|Out-Null",
      "  [IO.File]::WriteAllText((Join-Path $sourceRoot 'theme.json'),'{}')",
      "  [IO.File]::WriteAllText((Join-Path $sourceRoot 'notes\\CHECKLIST.md'),'copy proof')",
      "  $destination=Copy-AuraUiThemeKit -Source $sourceRoot -Id 'demo-theme'",
      "  if($destination -cne (Join-Path $UserThemesRoot 'demo-theme')){throw 'Theme copy returned the wrong destination'}",
      "  if([IO.File]::ReadAllText((Join-Path $destination 'notes\\CHECKLIST.md')) -cne 'copy proof'){throw 'Theme copy lost nested kit files'}",
      "  $duplicateRejected=$false",
      "  try { Copy-AuraUiThemeKit -Source $sourceRoot -Id 'demo-theme'|Out-Null } catch { $duplicateRejected=$_.Exception.Message -like '*demo-theme*' }",
      "  if(-not $duplicateRejected){throw 'Theme copy accepted an existing destination'}",
      "  Remove-AuraUiInstalledTheme -Path $destination -Id 'demo-theme'",
      "  if(Test-Path -LiteralPath $destination){throw 'Theme uninstall left its destination folder behind'}",
      "  $outsideMarker=Join-Path $outsideRoot 'keep.txt'",
      "  [IO.File]::WriteAllText($outsideMarker,'keep')",
      "  $outsideRejected=$false",
      "  try { Remove-AuraUiInstalledTheme -Path $outsideRoot -Id 'outside' } catch { $outsideRejected=$true }",
      "  if(-not $outsideRejected -or -not (Test-Path -LiteralPath $outsideMarker -PathType Leaf)){throw 'Theme rollback escaped the exact user-theme destination'}",
      "  $nestedFake=Join-Path $UserThemesRoot 'other\\demo-theme'",
      "  [IO.Directory]::CreateDirectory($nestedFake)|Out-Null",
      "  $nestedMarker=Join-Path $nestedFake 'keep.txt'",
      "  [IO.File]::WriteAllText($nestedMarker,'keep')",
      "  $nestedRemovalRejected=$false",
      "  try { Remove-AuraUiInstalledTheme -Path $nestedFake -Id 'demo-theme' } catch { $nestedRemovalRejected=$true }",
      "  if(-not $nestedRemovalRejected -or -not (Test-Path -LiteralPath $nestedMarker -PathType Leaf)){throw 'Theme rollback accepted a nested lookalike destination'}",
      "  [IO.Directory]::Delete((Join-Path $UserThemesRoot 'other'),$true)",
      "  [IO.Directory]::Delete($UserThemesRoot)",
      "  $redirectTarget=Join-Path $outsideRoot 'redirect-target'",
      "  [IO.Directory]::CreateDirectory($redirectTarget)|Out-Null",
      "  New-Item -ItemType Junction -Path $UserThemesRoot -Target $redirectTarget|Out-Null",
      "  $userRootJunction=$true",
      "  $junctionRejected=$false",
      "  try { Copy-AuraUiThemeKit -Source $sourceRoot -Id 'redirected-theme'|Out-Null } catch { $junctionRejected=$_.Exception.Message -like '*symbolic links or junctions*' }",
      "  if(-not $junctionRejected -or (Test-Path -LiteralPath (Join-Path $redirectTarget 'redirected-theme'))){throw 'Theme copy followed a redirected install root'}",
      "  [IO.Directory]::Delete($UserThemesRoot)",
      "  $userRootJunction=$false",
      "  [IO.Directory]::CreateDirectory($UserThemesRoot)|Out-Null",
      "  [IO.File]::WriteAllText((Join-Path $DataRoot 'theme.json'),'{}')",
      "  $nestedRejected=$false",
      "  try { Copy-AuraUiThemeKit -Source $DataRoot -Id 'nested-theme'|Out-Null } catch { $nestedRejected=$_.Exception.Message -like '*outside the installed user themes folder*' }",
      "  if(-not $nestedRejected -or (Test-Path -LiteralPath (Join-Path $UserThemesRoot 'nested-theme'))){throw 'Theme copy allowed its staging root inside the selected source'}",
      "  $insideSource=Join-Path $UserThemesRoot 'inside-source'",
      "  [IO.Directory]::CreateDirectory($insideSource)|Out-Null",
      "  [IO.File]::WriteAllText((Join-Path $insideSource 'theme.json'),'{}')",
      "  $insideRejected=$false",
      "  try { Copy-AuraUiThemeKit -Source $insideSource -Id 'inside-theme'|Out-Null } catch { $insideRejected=$_.Exception.Message -like '*outside the installed user themes folder*' }",
      "  if(-not $insideRejected){throw 'Theme copy accepted a source inside the install root'}",
      "  $snapshot='{\"theme\":\"default\",\"enabled\":false,\"customTheme\":\"legacy.json\"}'",
      "  [IO.File]::WriteAllText($ConfigPath,'{\"theme\":\"constructor\",\"enabled\":true}')",
      "  Restore-AuraUiConfigSnapshot -Json $snapshot",
      "  $restored=[IO.File]::ReadAllText($ConfigPath)|ConvertFrom-Json",
      "  if($restored.theme -cne 'default' -or $restored.enabled -ne $false -or $restored.customTheme -cne 'legacy.json'){throw 'Theme import rollback did not restore the complete config'}",
      "  if($script:RestoredPayload -cne 'restored-payload' -or -not $script:TrayRestored -or -not $script:ThemeRestored){throw 'Theme import rollback did not rebuild runtime state'}",
      "} finally {",
      "  if($userRootJunction -and (Test-Path -LiteralPath $UserThemesRoot)){[IO.Directory]::Delete($UserThemesRoot)}",
      "  $env:LOCALAPPDATA=$originalLocalAppData",
      "  if(Test-Path -LiteralPath $testRoot){[IO.Directory]::Delete($testRoot,$true)}",
      "}",
    ].join("\n");
    try {
      run("powershell.exe", ["-NoProfile", "-EncodedCommand", Buffer.from(importCopyRegression, "utf16le").toString("base64")]);
    } finally {
      await fs.rm(importCopyTestRoot, { recursive: true, force: true });
    }

    const cacheTestRoot = path.join(PROJECT_ROOT, "dist", `test-studio-cache-${process.pid}-${Date.now()}`);
    const cacheRegression = [
      "$ErrorActionPreference='Stop'",
      `$uiPath='${psPath(path.join(PROJECT_ROOT, "windows", "aura-ui.ps1"))}'`,
      `$testRoot='${psPath(cacheTestRoot)}'`,
      "$tokens=$null;$errors=$null",
      "$ast=[System.Management.Automation.Language.Parser]::ParseFile($uiPath,[ref]$tokens,[ref]$errors)",
      "if($errors.Count){throw 'Could not parse Aura UI for cache regression'}",
      "foreach($name in @('ConvertTo-AuraUiStudioNumber','Get-AuraUiStudioBackgroundCrop','Get-AuraUiStudioBackgroundSourcePath','Clear-AuraUiStudioBackgroundPreview','Sync-AuraUiStudioBackgroundPreview')){",
      "  $definition=$ast.Find({param($node)$node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -ceq $name},$true)",
      "  if($null -eq $definition){throw \"Missing cache function $name\"}",
      "  Invoke-Expression $definition.Extent.Text",
      "}",
      "function Get-AuraUiPropertyValue { param($InputObject,[string[]]$Names); foreach($name in $Names){$property=$InputObject.PSObject.Properties[$name];if($null -ne $property){return $property.Value}};return $null }",
      "function Write-AuraUiLog { param([string]$Message) }",
      "$aliasRoot=$null",
      "try {",
      "  [IO.Directory]::CreateDirectory($testRoot)|Out-Null",
      "  $StudioBackgroundRoot=Join-Path $testRoot 'cache'",
      "  $StudioBackgroundMaxBytes=16*1024*1024",
      "  [IO.Directory]::CreateDirectory($StudioBackgroundRoot)|Out-Null",
      "  $ConfigPath=Join-Path $testRoot 'config.json'",
      "  $sourcePath=Join-Path $testRoot 'source.png'",
      "  [IO.File]::WriteAllText($sourcePath,'AAAA')",
      "  $fixedStamp=[DateTime]::UtcNow.AddMinutes(-10)",
      "  [IO.File]::SetLastWriteTimeUtc($sourcePath,$fixedStamp)",
      "  $script:Config=[pscustomobject]@{image=$sourcePath}",
      "  $script:StudioBackgroundFingerprint=$null;$script:StudioBackgroundPreviewUrl=$null;$script:StudioBackgroundPreviewPath=$null",
      "  $firstUrl=Sync-AuraUiStudioBackgroundPreview",
      "  if(-not $firstUrl -or [IO.File]::ReadAllText($script:StudioBackgroundPreviewPath) -cne 'AAAA'){throw 'Initial preview copy failed'}",
      "  [IO.File]::WriteAllText($sourcePath,'BBBB')",
      "  [IO.File]::SetLastWriteTimeUtc($sourcePath,$fixedStamp)",
      "  $secondUrl=Sync-AuraUiStudioBackgroundPreview",
      "  if($secondUrl -ceq $firstUrl){throw 'Equal-size equal-timestamp replacement reused its cache URL'}",
      "  if([IO.File]::ReadAllText($script:StudioBackgroundPreviewPath) -cne 'BBBB'){throw 'Replacement preview kept stale bytes'}",
      "  $ownedPreview=$script:StudioBackgroundPreviewPath",
      "  $aliasRoot=Join-Path $testRoot 'cache-alias'",
      "  New-Item -ItemType Junction -Path $aliasRoot -Target $StudioBackgroundRoot|Out-Null",
      "  $aliasSource=Join-Path $aliasRoot ([IO.Path]::GetFileName($ownedPreview))",
      "  $script:Config=[pscustomobject]@{image=$aliasSource}",
      "  $aliasUrl=Sync-AuraUiStudioBackgroundPreview",
      "  if(-not $aliasUrl){throw 'Junction-aliased source could not be copied'}",
      "  if(-not (Test-Path -LiteralPath $aliasSource -PathType Leaf)){throw 'Cache cleanup deleted a junction-aliased source'}",
      "  if(-not (Test-Path -LiteralPath $script:StudioBackgroundPreviewPath -PathType Leaf)){throw 'Junction-safe preview copy is missing'}",
      "  if([IO.File]::ReadAllText($script:StudioBackgroundPreviewPath) -cne 'BBBB'){throw 'Junction-safe preview copied the wrong bytes'}",
      "  $oversizePath=Join-Path $testRoot 'oversize.png'",
      "  $oversizeStream=[IO.File]::Open($oversizePath,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None)",
      "  try{$oversizeStream.SetLength($StudioBackgroundMaxBytes+1)}finally{$oversizeStream.Dispose()}",
      "  $script:Config=[pscustomobject]@{image=$oversizePath}",
      "  if(Sync-AuraUiStudioBackgroundPreview){throw 'Oversized replacement received a Studio preview URL'}",
      "  if($script:StudioBackgroundPreviewPath){throw 'Oversized replacement remained in the Studio preview cache'}",
      "  $positionCases=[ordered]@{'top'='50,0';'left'='0,50';'top left'='0,0';'bottom right'='100,100';'center right'='100,50';'25%'='25,50'}",
      "  foreach($position in $positionCases.Keys){",
      "    $script:Config=[pscustomobject]@{imagePosition=$position;imageZoom=1}",
      "    $crop=Get-AuraUiStudioBackgroundCrop",
      "    $actual=\"$($crop.x),$($crop.y)\"",
      "    if(-not $crop.supported -or $actual -cne $positionCases[$position]){throw \"Position '$position' became $actual supported=$($crop.supported)\"}",
      "  }",
      "  $script:Config=[pscustomobject]@{imagePosition='right 20px bottom 10px';imageZoom=1}",
      "  if((Get-AuraUiStudioBackgroundCrop).supported){throw 'Advanced CSS position was presented as a centered numeric crop'}",
      "} finally {",
      "  if($aliasRoot -and (Test-Path -LiteralPath $aliasRoot)){[IO.Directory]::Delete($aliasRoot)}",
      "}",
    ].join("\n");
    try {
      run("powershell.exe", ["-NoProfile", "-EncodedCommand", Buffer.from(cacheRegression, "utf16le").toString("base64")]);
    } finally {
      await fs.rm(cacheTestRoot, { recursive: true, force: true });
    }

    const editorRootsTestRoot = path.join(PROJECT_ROOT, "dist", `test-studio-editor-roots-${process.pid}-${Date.now()}`);
    const editorBridgeRegression = [
      "$ErrorActionPreference='Stop'",
      `$uiPath='${psPath(path.join(PROJECT_ROOT, "windows", "aura-ui.ps1"))}'`,
      `$testRoot='${psPath(editorRootsTestRoot)}'`,
      "$tokens=$null;$errors=$null",
      "$ast=[System.Management.Automation.Language.Parser]::ParseFile($uiPath,[ref]$tokens,[ref]$errors)",
      "if($errors.Count){throw 'Could not parse Aura UI for editor bridge regression'}",
      "foreach($name in @('Get-AuraUiPropertyValue','ConvertTo-AuraUiStudioNumber','ConvertTo-AuraUiStudioInteger','Assert-AuraUiStudioEditorRoots','Assert-AuraUiStudioEditorMessage','Get-AuraUiStudioMessage','Assert-AuraUiStudioEditorSession')){",
      "  $definition=$ast.Find({param($node)$node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -ceq $name},$true)",
      "  if($null -eq $definition){throw \"Missing Studio editor bridge function $name\"}",
      "  Invoke-Expression $definition.Extent.Text",
      "}",
      "function Assert-Rejected { param([scriptblock]$Operation,[string]$Label);$rejected=$false;try{&$Operation|Out-Null}catch{$rejected=$true};if(-not $rejected){throw \"Studio accepted $Label\"} }",
      "$script:StudioMessageTypes=@('get-state','set-theme','set-appearance','set-image','clear-image','set-image-framing','set-card-preview-crop','set-enabled','open-aura','open-desktop','import-theme','create-theme-copy','begin-theme-edit','set-theme-token','set-theme-layer','pick-theme-layer-image','remove-theme-layer','move-theme-layer','undo-theme-edit','redo-theme-edit','save-theme-edit','discard-theme-edit','delete-user-theme')",
      "$session='12345678-1234-4abc-8def-1234567890ab'",
      "$source='https://aura.studio/index.html'",
      "$valid=@(",
      "  [ordered]@{type='create-theme-copy';theme='default'},",
      "  [ordered]@{type='begin-theme-edit';theme='user-theme';reset=$false},",
      "  [ordered]@{type='set-theme-token';session=$session;revision=0;mode='light';token='canvas';value='#123ABC'},",
      "  [ordered]@{type='set-theme-token';session=$session;revision=0;mode='shared';token='backgroundScope';value='full-window'},",
      "  [ordered]@{type='set-theme-layer';session=$session;revision=0;index=7;preset='wide';property='scale';value=3},",
      "  [ordered]@{type='pick-theme-layer-image';session=$session;revision=0;index=-1;role='hero'},",
      "  [ordered]@{type='move-theme-layer';session=$session;revision=0;index=7;direction='up'},",
      "  [ordered]@{type='undo-theme-edit';session=$session;revision=0},",
      "  [ordered]@{type='save-theme-edit';session=$session;revision=0},",
      "  [ordered]@{type='delete-user-theme';theme='user-theme'}",
      ")",
      "foreach($message in $valid){$parsed=Get-AuraUiStudioMessage -Json ($message|ConvertTo-Json -Compress) -Source $source;if($parsed.type -cne $message.type){throw 'Valid editor message changed type'}}",
      "Assert-Rejected { Get-AuraUiStudioMessage -Json '{\"type\":4}' -Source $source } 'a non-string action type'",
      "Assert-Rejected { Get-AuraUiStudioMessage -Json '{\"type\":\"Set-Theme-Token\"}' -Source $source } 'a case-changed action'",
      "Assert-Rejected { Get-AuraUiStudioMessage -Json '{\"type\":\"get-state\"}' -Source 'https://evil.invalid/' } 'a message from another origin'",
      "$extra=[ordered]@{type='set-theme-token';session=$session;revision=0;mode='light';token='canvas';value='#123456';path='C:\\private.png'}",
      "Assert-Rejected { Get-AuraUiStudioMessage -Json ($extra|ConvertTo-Json -Compress) -Source $source } 'an extra path property'",
      "$badSession=[ordered]@{type='undo-theme-edit';session=$session.ToUpperInvariant();revision=0}",
      "Assert-Rejected { Get-AuraUiStudioMessage -Json ($badSession|ConvertTo-Json -Compress) -Source $source } 'a noncanonical session'",
      "$stringRevision=[ordered]@{type='undo-theme-edit';session=$session;revision='0'}",
      "Assert-Rejected { Get-AuraUiStudioMessage -Json ($stringRevision|ConvertTo-Json -Compress) -Source $source } 'a string revision'",
      "$fractionRevision=[ordered]@{type='undo-theme-edit';session=$session;revision=0.5}",
      "Assert-Rejected { Get-AuraUiStudioMessage -Json ($fractionRevision|ConvertTo-Json -Compress) -Source $source } 'a fractional revision'",
      "$staleState=[pscustomobject]@{active=$true;session=$session;revision=4}",
      "$script:StudioEditorState=$staleState",
      "Assert-Rejected { Assert-AuraUiStudioEditorSession -Request ([pscustomobject]@{session='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';revision=4}) } 'another active session'",
      "Assert-Rejected { Assert-AuraUiStudioEditorSession -Request ([pscustomobject]@{session=$session;revision=3}) } 'a stale active revision'",
      "$badIndex=[ordered]@{type='set-theme-layer';session=$session;revision=4;index=8;preset='shared';property='role';value='hero'}",
      "Assert-Rejected { Get-AuraUiStudioMessage -Json ($badIndex|ConvertTo-Json -Compress) -Source $source } 'a ninth layer index'",
      "$badScale=[ordered]@{type='set-theme-layer';session=$session;revision=4;index=0;preset='normal';property='scale';value=3.01}",
      "Assert-Rejected { Get-AuraUiStudioMessage -Json ($badScale|ConvertTo-Json -Compress) -Source $source } 'an out-of-range scale'",
      "$badBoolean=[ordered]@{type='set-theme-layer';session=$session;revision=4;index=0;preset='shared';property='visible';value='true'}",
      "Assert-Rejected { Get-AuraUiStudioMessage -Json ($badBoolean|ConvertTo-Json -Compress) -Source $source } 'a string visibility flag'",
      "$badScope=[ordered]@{type='set-theme-token';session=$session;revision=4;mode='shared';token='backgroundScope';value='sidebar'}",
      "Assert-Rejected { Get-AuraUiStudioMessage -Json ($badScope|ConvertTo-Json -Compress) -Source $source } 'an unknown background scope'",
      "$originalLocalAppData=$env:LOCALAPPDATA",
      "try{",
      "  $env:LOCALAPPDATA=Join-Path $testRoot 'local-app-data'",
      "  $DataRoot=Join-Path (Join-Path $env:LOCALAPPDATA 'ClaudeAura') 'data'",
      "  $StudioEditorRoot=Join-Path $DataRoot 'theme-drafts'",
      "  $StudioEditorPreviewRoot=Join-Path $StudioEditorRoot 'preview'",
      "  $StudioEditorImportRoot=Join-Path $StudioEditorRoot 'imports'",
      "  [void](Assert-AuraUiStudioEditorRoots -Create)",
      "  $outside=Join-Path $testRoot 'outside';[IO.Directory]::CreateDirectory($outside)|Out-Null",
      "  [IO.Directory]::Delete($StudioEditorPreviewRoot)",
      "  New-Item -ItemType Junction -Path $StudioEditorPreviewRoot -Target $outside|Out-Null",
      "  Assert-Rejected { Assert-AuraUiStudioEditorRoots } 'a reparse-point editor preview root'",
      "}finally{",
      "  $env:LOCALAPPDATA=$originalLocalAppData",
      "  if(Test-Path -LiteralPath $StudioEditorPreviewRoot){[IO.Directory]::Delete($StudioEditorPreviewRoot)}",
      "  if(Test-Path -LiteralPath $testRoot){[IO.Directory]::Delete($testRoot,$true)}",
      "}",
    ].join("\n");
    try {
      run("powershell.exe", ["-NoProfile", "-EncodedCommand", Buffer.from(editorBridgeRegression, "utf16le").toString("base64")]);
    } finally {
      await fs.rm(editorRootsTestRoot, { recursive: true, force: true });
    }
  }

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

test("Studio-generated metadata preserves every theme descriptor", async () => {
  const builderSource = await fs.readFile(path.join(PROJECT_ROOT, "scripts", "build-studio-themes.mjs"), "utf8");
  assert.match(builderSource, /RETRIABLE_WINDOWS_WRITE_CODES[\s\S]+\["EACCES", "EBUSY", "EPERM", "UNKNOWN"\]/,
    "Studio metadata generation must tolerate known transient Windows write locks");
  assert.match(builderSource, /MAX_WRITE_ATTEMPTS\s*=\s*6/,
    "Studio metadata generation must keep its Windows lock retry bounded");
  run(process.execPath, ["scripts/build-studio-themes.mjs"]);
  const generated = await fs.readFile(path.join(PROJECT_ROOT, "studio", "generated-themes.js"), "utf8");
  for (const id of THEME_IDS) assert(generated.includes(`\"${id}\"`), `Studio metadata is missing ${id}`);
  const generatedMatch = generated.match(/window\.CLAUDE_AURA_THEMES\s*=\s*([\s\S]+);\s*$/);
  assert(generatedMatch, "Studio theme metadata could not be parsed");
  const studioThemes = JSON.parse(generatedMatch[1]);
  for (const theme of await listThemes()) {
    const expectedArtwork = theme.artwork
      ? (({ path: artworkPath, position, size, mobile }) => ({ path: artworkPath, position, size, mobile }))(theme.artwork)
      : null;
    const expectedLayers = theme.artworkLayers?.length
      ? theme.artworkLayers.map(({ path: artworkPath, position, size, mobile, opacity, mask, role, appearance, contextOverrides }) => ({
        path: artworkPath,
        position,
        size,
        mobile,
        opacity,
        mask,
        role,
        appearance,
        contextOverrides,
      }))
      : null;
    const expectedMode = (mode) => ({
      semantic: { ...mode.semantic },
      compat: Object.fromEntries(Object.entries(mode.tokens).filter(([name]) => !name.startsWith("--aura-"))),
      tokens: { ...mode.tokens },
      wallpaper: { ...mode.wallpaper },
    });
    assert.deepEqual(studioThemes[theme.name], {
      name: theme.name,
      source: theme.source,
      variant: theme.variant,
      label: theme.label,
      description: theme.description,
      labels: { ...theme.labels },
      descriptions: { ...theme.descriptions },
      swatches: [...theme.swatches],
      preview: { ...theme.preview },
      studioPreview: theme.studioPreview,
      studioPreviewFrame: theme.studioPreviewFrame ? { ...theme.studioPreviewFrame } : null,
      launcher: { ...theme.launcher },
      newChatLayout: theme.newChatLayout ? { ...theme.newChatLayout } : null,
      artwork: expectedArtwork,
      artworkLayers: expectedLayers,
      radius: theme.radius,
      blur: theme.blur,
      typography: { ...theme.typography },
      shape: { ...theme.shape },
      effects: { ...theme.effects },
      light: expectedMode(theme.light),
      dark: expectedMode(theme.dark),
    }, `${theme.name} Studio metadata differs from the validated registry theme`);
  }
  const packageJson = JSON.parse(await fs.readFile(path.join(PROJECT_ROOT, "package.json"), "utf8"));
  assert.equal(packageJson.scripts["studio:build"], "node scripts/build-studio-themes.mjs");
  assert.equal(packageJson.scripts["preview:build"], undefined);
  assert.equal(packageJson.scripts["preview:serve"], undefined);
});

test("release and installers exclude unsafe composite references and binary patching", async () => {
  const manifest = await fs.readFile(path.join(PROJECT_ROOT, "docs", "FILE_MANIFEST.md"), "utf8");
  const listedFiles = [...manifest.matchAll(/^- `([^`]+)`$/gm)].map((match) => match[1]).sort();
  assert.deepEqual(listedFiles, (await deliverableFiles()).sort(), "Deliverable file manifest is incomplete or stale");
  const releaseBuilder = await fs.readFile(path.join(PROJECT_ROOT, "scripts", "build-release.mjs"), "utf8");
  assert.match(releaseBuilder, /RELEASE_ROOT_FILES/);
  assert.match(releaseBuilder, /RELEASE_DIRECTORIES/);
  assert.match(releaseBuilder, /RELEASE_DOCUMENT_FILES/);
  assert.match(releaseBuilder, /RETIRED_RELEASE_FILES/);
  assert.match(releaseBuilder, /RETIRED_RELEASE_DIRECTORIES/);
  assert.match(releaseBuilder, /SOURCE_ONLY_RELEASE_DIRECTORIES/);
  assert.match(releaseBuilder, /REQUIRED_RELEASE_FILES/);
  assert.match(releaseBuilder, /\["studio",\s*new Set\(\["\.css",\s*"\.html",\s*"\.js"\]\)\]/,
    "The release allowlist must include Aura Studio");
  assert.match(releaseBuilder, /\.corrupt-/);
  for (const extension of [".avif", ".ico", ".png", ".svg", ".webp"]) {
    assert(releaseBuilder.includes(`"${extension}"`), `Release allowlist omits supported artwork type ${extension}`);
  }
  assert.match(releaseBuilder, /import \{ buildAuraIcon \} from "\.\/build-aura-icon\.mjs";/,
    "Release builds must use the deterministic Aura icon builder");
  assert.match(releaseBuilder, /import \{ buildLauncherAssets \} from "\.\/build-launcher-assets\.mjs";/,
    "Release builds must use the deterministic launcher-mark builder");
  const releaseIconBuildIndex = releaseBuilder.indexOf("await buildAuraIcon()");
  const releaseLauncherBuildIndex = releaseBuilder.indexOf("await buildLauncherAssets()");
  const releaseCollectIndex = releaseBuilder.indexOf("await collect(PROJECT_ROOT)");
  assert(releaseIconBuildIndex >= 0 && releaseLauncherBuildIndex > releaseIconBuildIndex
      && releaseCollectIndex > releaseLauncherBuildIndex,
  "Release builds must refresh derived identity assets before collecting files");
  const windowsInstall = await fs.readFile(path.join(PROJECT_ROOT, "windows", "install.ps1"), "utf8");
  const macInstall = await fs.readFile(path.join(PROJECT_ROOT, "macos", "install.sh"), "utf8");
  const windowsCopyList = windowsInstall.match(/foreach \(\$directory in @\(([^)]*)\)/)?.[1] ?? "";
  const macCopyList = macInstall.match(/for directory in ([^;]+); do/)?.[1] ?? "";
  assert(!/['"](?:preview|themes)['"]/.test(windowsCopyList),
    "Windows install copy list retained an offline or source-kit directory");
  assert(!/\b(?:preview|themes)\b/.test(macCopyList),
    "macOS install copy list retained an offline or source-kit directory");
  for (const themeName of ["registry.json", "japanese-idol.json", "korean-idol.json", "sakura.json"]) {
    assert(windowsInstall.includes(`'${themeName}'`) && macInstall.includes(themeName),
      `Installers do not explicitly copy top-level descriptor ${themeName}`);
  }
  for (const documentationName of [
    "ACCEPTANCE_AUDIT.md",
    "FILE_MANIFEST.md",
    "IMPLEMENTATION_REPORT.md",
    "SCREENSHOT_PLAN.md",
    "THEME_KIT_SPEC.md",
    "THEMING.md",
    "TROUBLESHOOTING.md",
  ]) {
    assert(windowsInstall.includes(`'${documentationName}'`) && macInstall.includes(documentationName),
      `Installers do not explicitly copy public documentation ${documentationName}`);
  }
  assert(!windowsInstall.includes("docs\\*.md") && !macInstall.includes('docs/*.md'),
    "Installers must not copy every workspace document");
  assert(windowsInstall.includes("Get-ChildItem -LiteralPath $installedDocs -Force"),
    "Windows installer does not prune non-public documentation");
  assert(macInstall.includes('for installed_documentation in "$INSTALL_ROOT"/docs/*'),
    "macOS installer does not prune non-public documentation");
  assert(windowsInstall.includes("assets\\studio-previews\\references")
      && macInstall.includes("assets/studio-previews/references"),
  "Installers must keep alternate Studio references in the source tree only");
  assert(windowsInstall.includes("Get-ChildItem -LiteralPath $installedThemes -Force"),
    "Windows installer does not prune stale theme-kit directories");
  assert(macInstall.includes('for theme_entry in "$INSTALL_ROOT"/themes/*'),
    "macOS installer does not prune stale theme-kit directories");
  for (const obsoleteName of [
    "build-preview.mjs",
    "preview-server.mjs",
    "card-analyze.svg",
    "theme-screenshots",
  ]) {
    assert(windowsInstall.includes(obsoleteName) && macInstall.includes(obsoleteName),
      `Installers do not remove stale ${obsoleteName}`);
  }
  for (const [windowsPath, macPath] of [
    ["scripts\\qa-board.mjs", "scripts/qa-board.mjs"],
    ["docs\\golden", "docs/golden"],
    ["tests\\fixtures", "tests/fixtures"],
    ["dist\\qa", "dist/qa"],
  ]) {
    assert(windowsInstall.includes(windowsPath) && macInstall.includes(macPath),
      `Installers do not remove stale fixture surface ${macPath}`);
  }
  for (const preservedName of ["live-aura", "live-content-audit", "wo17-icon", "-live-content"]) {
    assert(windowsInstall.includes(preservedName) && macInstall.includes(preservedName),
      `Installer fixture cleanup does not preserve live evidence marker ${preservedName}`);
  }
  for (const obsoleteName of ["background.webp", "constellation.webp"]) {
    assert(windowsInstall.includes(`assets\\theme-art\\korean-idol\\${obsoleteName}`)
      && macInstall.includes(`assets/theme-art/korean-idol/${obsoleteName}`),
    `Installers do not remove stale Korean Idol ${obsoleteName}`);
  }
  assert(windowsInstall.includes("Test-Path -LiteralPath (Join-Path $SourceRoot '.git')")
    && windowsInstall.includes("validate --theme $themeId"),
  "Windows release installs must use shipped-content validation instead of repository-only tests");
  assert(macInstall.includes('[ -e "$ROOT/.git" ]')
    && macInstall.includes('validate --theme "$theme_id"'),
  "macOS release installs must use shipped-content validation instead of repository-only tests");
  assert(windowsInstall.includes("StartsWith($installRootFull + '\\',"),
    "Windows stale-surface cleanup must remain below the verified install root");
  assert.match(macInstall, /"\$INSTALL_ROOT"\/\*\)/,
    "macOS stale-surface cleanup must remain below the verified install root");
  const privateName = `private-release-state-${process.pid}-${Date.now()}.json`;
  const privatePath = path.join(PROJECT_ROOT, privateName);
  try {
    await fs.writeFile(privatePath, '{"secret":"must-not-ship"}\n', "utf8");
    const release = JSON.parse(run(process.execPath, ["scripts/build-release.mjs"]));
    const names = zipEntryNames(await fs.readFile(release.outputPath));
    assert(names.includes("claude-aura/package.json"), "Release allowlist omitted package.json");
    assert.deepEqual(names.filter((name) => name.startsWith("claude-aura/docs/")).sort(), [
      "claude-aura/docs/ACCEPTANCE_AUDIT.md",
      "claude-aura/docs/FILE_MANIFEST.md",
      "claude-aura/docs/IMPLEMENTATION_REPORT.md",
      "claude-aura/docs/SCREENSHOT_PLAN.md",
      "claude-aura/docs/THEME_KIT_SPEC.md",
      "claude-aura/docs/THEMING.md",
      "claude-aura/docs/TROUBLESHOOTING.md",
      "claude-aura/docs/recipes/RECIPES.md",
    ].sort(), "Release documentation differs from the public allowlist");
    for (const identityFile of [
      "assets/brand/aura-mark.svg",
      "assets/brand/claude-aura.ico",
      "scripts/build-aura-icon.mjs",
      "scripts/build-launcher-assets.mjs",
    ]) {
      assert(names.includes(`claude-aura/${identityFile}`), `Release omitted Aura identity file ${identityFile}`);
    }
    for (const themeId of THEME_IDS) {
      assert(names.includes(`claude-aura/assets/theme-art/${themeId}/launcher-mark.png`),
        `Release omitted ${themeId} launcher mark`);
    }
    for (const themeId of THEME_IDS.filter((id) => id !== "default")) {
      assert(names.includes(`claude-aura/assets/studio-previews/masters/${themeId}.png`),
        `Release omitted ${themeId} uncropped Studio preview master`);
    }
    assert(!names.some((name) => name.startsWith("claude-aura/assets/studio-previews/references/")),
      "Release included source-only alternate preview references");
    assert(names.includes("claude-aura/scripts/asset-audit.mjs"),
      "Release omitted the non-image asset audit");
    for (const studioFile of ["app.js", "editor.css", "editor.js", "generated-themes.js", "index.html", "styles.css"]) {
      assert(names.includes(`claude-aura/studio/${studioFile}`), `Release omitted Studio ${studioFile}`);
    }
    assert(!names.some((name) => name.startsWith("claude-aura/preview/")),
      "Release included the removed offline preview surface");
    assert(!names.some((name) => /^claude-aura\/docs\/.*\.(?:avif|jpe?g|png|webp)$/i.test(name)),
      "Release included obsolete documentation screenshots");
    assert(!names.includes("claude-aura/scripts/qa-board.mjs"),
      "Release included the retired fixture-board generator");
    assert(!names.some((name) => name.startsWith("claude-aura/docs/golden/")
      || name.startsWith("claude-aura/docs/theme-screenshots/")
      || name.startsWith("claude-aura/tests/fixtures/")),
    "Release included a retired fixture or screenshot surface");
    for (const themeId of THEME_IDS.filter((id) => id !== "default")) {
      assert(names.includes(`claude-aura/assets/theme-art/${themeId}/card-preview.webp`),
        `Release omitted ${themeId} legacy selector fallback`);
    }
    assert(!names.includes(`claude-aura/${privateName}`), "Release included an unlisted local file");
    assert(!names.some((name) => name.split("/").slice(1).some((segment) => segment.startsWith("."))),
      "Release included hidden workspace metadata");
    assert(!names.some((name) => name.includes("theme_demo_previews")),
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
