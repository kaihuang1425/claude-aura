// Shared test context: node builtins, builders, theme-core API, and pure helpers.
// Re-exported so each *.test.mjs file imports a single, stable surface.
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { buildAuraIcon } from "../../scripts/build-aura-icon.mjs";
import { buildBrandWordmarks } from "../../scripts/build-brand-wordmarks.mjs";
import { buildLauncherAssets } from "../../scripts/build-launcher-assets.mjs";
import {
  AURA_VERSION,
  BUILTIN_BRAND_MARK_ASSETS,
  BUILTIN_BRAND_WORDMARK_ASSETS,
  buildPayload,
  buildPayloadFromCompiled,
  compileTheme,
  renderGreetingCss,
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
  greetingPhraseDigest,
  resolveGreetingPhrases,
  resolveGreetingRuntime,
  validateGreetingPreferences,
  validateGreetingShuffleState,
  validateNewChatGreetingStyle,
  STUDIO_FONT_DISPLAY_STACKS,
  STUDIO_FONT_UI_STACKS,
  STUDIO_MAX_LAYERS,
  STUDIO_SHADOWS,
  STUDIO_THEME_SCHEMA_VERSION,
  studioStyleFromTheme,
  validateTheme,
  writeConfig,
} from "../../scripts/theme-core.mjs";

export const THEME_IDS = [
  "default",
  "japanese-film-editorial",
  "korean-prestige",
  "cartoon-studio",
  "anime-twilight",
  "study-library",
  "japanese-idol",
  "korean-idol",
];
export const STUDIO_PREVIEW_MASTERS = {
  "japanese-film-editorial": { dimensions: [1709, 920], frame: { x: 77.76, y: 8.98, zoom: 3.651 }, sha256: "8d2574b05ab89b038ffd185a4f66206eda8d675213cdb98e19ce504d62d239d5" },
  "korean-prestige": { dimensions: [1708, 920], frame: { x: 82.34, y: 8.61, zoom: 3.274 }, sha256: "fa217fedd86b534f370cf501b21cc5c43f2c8923974b26b63c5caaed9fc05f19" },
  "cartoon-studio": { dimensions: [1709, 920], frame: { x: 92.79, y: 10.48, zoom: 3.651 }, sha256: "cd52848f712d61f77987fb5f88e7cddaf78fdf28638e9531c4b94b51df670e8a" },
  "anime-twilight": { dimensions: [1659, 948], frame: { x: 96.1, y: 8.25, zoom: 3.374 }, sha256: "e666c4f8c79bd51c0574300e29cc075ad69d7168fce373520aa3f9248cfd3bf1" },
  "study-library": { dimensions: [1174, 967], frame: { x: 50, y: 55, zoom: 1 }, sha256: "1f1ae98251f43cbd8f805ba9e8d17111de1e893146f0b59fc7987cbc5ca680df" },
  "japanese-idol": { dimensions: [1710, 920], frame: { x: 86.85, y: 9.49, zoom: 3.194 }, sha256: "b60af62d259ac547e59a78ffe53c30a1368da67289e945174539a25109e742ca" },
  "korean-idol": { dimensions: [1660, 947], frame: { x: 83.47, y: 11.82, zoom: 3.507 }, sha256: "63f1535ef09b74299a3523c987601e8f5b5a2836a8acd1866458e3e50dbc6b0d" },
};

export function hslToRgb(value) {
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

export function luminance(hsl) {
  return hslToRgb(hsl).map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4)
    .reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0);
}

export function contrast(left, right) {
  const values = [luminance(left), luminance(right)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

export function run(command, args, options = {}) {
  const result = spawnSync(command, args, { cwd: PROJECT_ROOT, encoding: "utf8", ...options });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed (${result.status})\n${result.stdout}\n${result.stderr}`);
  }
  return result.stdout;
}

export function readPayloadSettings(payload) {
  const aliases = {
    v: "version", t: "theme", r: "variant", a: "appearance",
    i: "imageDataUrl", j: "imageAnimated", o: "imageOpacity",
    p: "imagePosition", z: "imageZoom", d: "artDataUrl",
    e: "artPosition", f: "artSize", l: "artMobile", y: "artLayers",
    h: "reduceMotion", x: "digest", A: "avatarDataUrl",
  };
  let end = payload.length - 1;
  while (end >= 0 && /\s/.test(payload[end])) end -= 1;
  if (payload[end] === ")") end -= 1;
  assert(payload[end] === "}", "Renderer payload is missing its compact settings argument");
  let depth = 0;
  let quoted = false;
  let offset = -1;
  for (let index = end; index >= 0; index -= 1) {
    const character = payload[index];
    if (character === '"') {
      let slashes = 0;
      for (let before = index - 1; before >= 0 && payload[before] === "\\"; before -= 1) {
        slashes += 1;
      }
      if (slashes % 2 === 0) quoted = !quoted;
      continue;
    }
    if (quoted) continue;
    if (character === "}") depth += 1;
    else if (character === "{") {
      depth -= 1;
      if (depth === 0) {
        offset = index;
        break;
      }
    }
  }
  assert(offset >= 0, "Renderer payload is missing its compact settings argument");
  const raw = JSON.parse(payload.slice(offset, end + 1));
  return Object.fromEntries(Object.entries(raw).map(([key, value]) => [
    aliases[key] ?? key,
    value,
  ]));
}

export function zipEntryNames(bytes) {
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

export const UI_LOCALES = [
  "en", "hi", "es", "fr", "id", "ja", "ko", "pt-BR", "de", "it", "vi", "pl", "tr", "zh-CN", "zh-HKTW",
];
export const STUDIO_LOCALES = [
  "en", "hi", "es", "fr", "id", "ja", "ko", "pt-BR", "de", "it", "vi", "pl", "tr", "zh-CN", "zh-HKTW",
];

// Window copy is one JSON file per language under windows/locales. Tests read
// the whole set so a missing or extra language file fails as loudly as a
// missing key used to.
export async function readHostCopy() {
  const entries = await Promise.all(UI_LOCALES.map(async (locale) => [
    locale,
    JSON.parse(await fs.readFile(path.join(PROJECT_ROOT, "windows", "locales", `${locale}.json`), "utf8")),
  ]));
  return Object.fromEntries(entries);
}

// Studio copy is one script per language under studio/locales. Each file
// registers itself on window.CLAUDE_AURA_STRINGS, so the tests replay it
// against a bare object instead of parsing the source text.
export async function readStudioCopy() {
  const registry = {};
  for (const locale of STUDIO_LOCALES) {
    const source = await fs.readFile(path.join(PROJECT_ROOT, "studio", "locales", `${locale}.js`), "utf8");
    Function("window", `"use strict";\n${source}`)(registry);
  }
  const strings = registry.CLAUDE_AURA_STRINGS ?? {};
  const section = (name) => Object.fromEntries(
    Object.entries(strings).map(([locale, copy]) => [locale, copy?.[name] ?? {}]),
  );
  return { locales: Object.keys(strings), shell: section("shell"), editor: section("editor") };
}

export async function deliverableFiles(directory = PROJECT_ROOT, relativeDirectory = "") {
  const files = [];
  const excludedRoots = new Set(["dist", "node_modules", "release"]);
  const excludedNames = new Set([".DS_Store", "Thumbs.db", "config.local.json", "state.json"]);
  const deliverableRootMarkdown = new Set([
    "CONTRIBUTING.md",
    "NOTICE.md",
    "README.md",
    "README.zh-CN.md",
    "README.zh-HKTW.md",
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
    "docs/WINDOWS_INSTALLER.md",
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

export {
  AURA_VERSION,
  BUILTIN_BRAND_MARK_ASSETS,
  BUILTIN_BRAND_WORDMARK_ASSETS,
  DEFAULT_CONFIG,
  PROJECT_ROOT,
  REQUIRED_SEMANTIC_TOKENS,
  STUDIO_FONT_DISPLAY_STACKS,
  STUDIO_FONT_UI_STACKS,
  STUDIO_MAX_LAYERS,
  STUDIO_SHADOWS,
  STUDIO_THEME_SCHEMA_VERSION,
  studioStyleFromTheme,
  assert,
  buildAuraIcon,
  buildBrandWordmarks,
  buildLauncherAssets,
  buildPayload,
  buildPayloadFromCompiled,
  compileTheme,
  renderGreetingCss,
  crypto,
  executeStudioRequest,
  fs,
  hydrateStudioDraft,
  listThemes,
  normalizeLocale,
  os,
  path,
  readThemeKit,
  readThemeRegistry,
  resolveArtwork,
  greetingPhraseDigest,
  resolveGreetingPhrases,
  resolveGreetingRuntime,
  validateGreetingPreferences,
  validateGreetingShuffleState,
  validateNewChatGreetingStyle,
  spawnSync,
  validateTheme,
  writeConfig,
};
