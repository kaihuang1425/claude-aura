#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import zlib from "node:zlib";
import { AURA_VERSION, PROJECT_ROOT } from "./theme-core.mjs";
import { buildAuraIcon } from "./build-aura-icon.mjs";
import { buildBrandWordmarks } from "./build-brand-wordmarks.mjs";
import { buildLauncherAssets } from "./build-launcher-assets.mjs";

const RELEASE_ROOT_FILES = new Set([
  "CONTRIBUTING.md",
  "Install Claude Aura.cmd",
  "Install Claude Aura.command",
  "LICENSE",
  "NOTICE.md",
  "README.md",
  "SECURITY.md",
  "THIRD_PARTY_NOTICES.md",
  "Uninstall Claude Aura.cmd",
  "config.example.json",
  "package.json",
]);
const RELEASE_DOCUMENT_FILES = new Set([
  "docs/ACCEPTANCE_AUDIT.md",
  "docs/FILE_MANIFEST.md",
  "docs/IMPLEMENTATION_REPORT.md",
  "docs/SCREENSHOT_PLAN.md",
  "docs/THEME_KIT_SPEC.md",
  "docs/THEMING.md",
  "docs/TROUBLESHOOTING.md",
  "docs/recipes/RECIPES.md",
]);
const RELEASE_DIRECTORIES = new Map([
  ["assets", new Set([".avif", ".css", ".ico", ".js", ".md", ".png", ".svg", ".webp"])],
  ["docs", new Set([".md"])],
  ["macos", new Set([".command", ".sh"])],
  ["readmes", new Set([".md"])],
  ["scripts", new Set([".mjs"])],
  ["studio", new Set([".css", ".html", ".js"])],
  ["tests", new Set([".mjs"])],
  ["themes", new Set([".json"])],
  ["vendor", new Set([".dll", ".txt"])],
  ["windows", new Set([".json", ".ps1"])],
]);
const RETIRED_RELEASE_FILES = new Set([
  "scripts/qa-board.mjs",
  "tests/fixtures/claude-dom.html",
]);
const RETIRED_RELEASE_DIRECTORIES = new Set([
  "docs/golden",
  "docs/theme-screenshots",
  "tests/fixtures",
]);
const SOURCE_ONLY_RELEASE_DIRECTORIES = new Set([
  "assets/studio-previews/references",
]);
const REQUIRED_THEME_DESCRIPTOR_FILES = new Set([
  "registry.json",
  "default.json",
  "japanese-film-editorial.json",
  "korean-prestige.json",
  "cartoon-studio.json",
  "anime-twilight.json",
  "study-library.json",
  "japanese-idol.json",
  "korean-idol.json",
  "midnight.json",
  "ember.json",
  "forest.json",
  "sakura.json",
].map((name) => `themes/${name}`));
const REQUIRED_APP_SURFACE_FILES = new Set([
  "assets/base.css",
  "assets/brand/aura-mark.svg",
  "assets/brand/claude-aura.ico",
  "assets/renderer-inject.js",
  "assets/renderer-prepaint.js",
  "assets/theme-variants.css",
  "macos/common.sh",
  "macos/install.sh",
  "macos/launchers/Claude Aura - Restore.command",
  "macos/launchers/Claude Aura - Switch Theme.command",
  "macos/launchers/Claude Aura.command",
  "macos/restore.sh",
  "macos/start.sh",
  "macos/switch-theme.sh",
  "macos/verify.sh",
  "scripts/convert-theme-assets.mjs",
  "scripts/injector.mjs",
  "scripts/state-cli.mjs",
  "scripts/theme-cli.mjs",
  "scripts/theme-core.mjs",
  "scripts/theme-core/artwork.mjs",
  "scripts/theme-core/compile.mjs",
  "scripts/theme-core/constants.mjs",
  "scripts/theme-core/greeting.mjs",
  "scripts/theme-core/registry.mjs",
  "scripts/theme-core/studio.mjs",
  "scripts/theme-core/validation.mjs",
  "scripts/webview-cli.mjs",
  "studio/app.js",
  "studio/editor.css",
  "studio/editor.js",
  "studio/generated-themes.js",
  "studio/index.html",
  "studio/locales/en.js",
  "studio/locales/zh-CN.js",
  "studio/locales/zh-HKTW.js",
  "studio/styles.css",
  "tests/run-tests.mjs",
  "vendor/webview2/LICENSE.txt",
  "vendor/webview2/Microsoft.Web.WebView2.Core.dll",
  "vendor/webview2/Microsoft.Web.WebView2.WinForms.dll",
  "vendor/webview2/NOTICE.txt",
  "vendor/webview2/runtimes/arm64/WebView2Loader.dll",
  "vendor/webview2/runtimes/x64/WebView2Loader.dll",
  "vendor/webview2/runtimes/x86/WebView2Loader.dll",
  "vendor/webview2/WebView2Loader.dll",
  "windows/aura-ui.ps1",
  "windows/common.ps1",
  "windows/install.ps1",
  "windows/locales/en.json",
  "windows/locales/zh-CN.json",
  "windows/locales/zh-HKTW.json",
  "windows/restore.ps1",
  "windows/start.ps1",
  "windows/switch-theme.ps1",
  "windows/uninstall.ps1",
  "windows/verify.ps1",
]);
const REQUIRED_RELEASE_FILES = new Set([
  ...RELEASE_ROOT_FILES,
  ...RELEASE_DOCUMENT_FILES,
  ...REQUIRED_THEME_DESCRIPTOR_FILES,
  ...REQUIRED_APP_SURFACE_FILES,
  "scripts/asset-audit.mjs",
  "scripts/build-brand-wordmarks.mjs",
  "scripts/build-launcher-assets.mjs",
  ...[
    "default", "japanese-film-editorial", "korean-prestige", "cartoon-studio",
    "anime-twilight", "study-library", "japanese-idol", "korean-idol",
  ].map((theme) => `assets/theme-art/${theme}/launcher-mark.png`),
  ...[
    "default", "japanese-film-editorial", "korean-prestige", "cartoon-studio",
    "anime-twilight", "study-library", "japanese-idol", "korean-idol",
  ].map((theme) => `assets/theme-art/${theme}/launcher-mark.ico`),
  ...[
    "japanese-film-editorial", "korean-prestige", "japanese-idol",
  ].map((theme) => `assets/theme-art/${theme}/brand-mark.svg`),
  ...[
    "default", "japanese-film-editorial", "korean-prestige", "cartoon-studio",
    "anime-twilight", "study-library", "japanese-idol", "korean-idol",
  ].flatMap((theme) => [
    `assets/theme-art/${theme}/brand-wordmark-light.png`,
    `assets/theme-art/${theme}/brand-wordmark-dark.png`,
  ]),
  ...[
    "japanese-film-editorial", "korean-prestige", "cartoon-studio",
    "anime-twilight", "study-library", "japanese-idol", "korean-idol",
  ].map((theme) => `assets/studio-previews/masters/${theme}.png`),
]);
const LOCAL_STATE_NAMES = new Set(["config.json", "config.local.json", "state.json"]);
const CRC_TABLE = Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) value = (value >>> 1) ^ ((value & 1) ? 0xedb88320 : 0);
  return value >>> 0;
});

function crc32(bytes) {
  let value = 0xffffffff;
  for (const byte of bytes) value = CRC_TABLE[(value ^ byte) & 0xff] ^ (value >>> 8);
  return (value ^ 0xffffffff) >>> 0;
}

function pathSegments(relativePath) {
  return relativePath.replaceAll("\\", "/").split("/").filter(Boolean);
}

function isLocalOrTemporary(segments) {
  const name = segments.at(-1) ?? "";
  return segments.some((segment) => segment.startsWith("."))
    || name.startsWith(".tmp-")
    || name.endsWith(".log")
    || name.includes(".corrupt-")
    || LOCAL_STATE_NAMES.has(name.toLowerCase())
    || /(?:^|\.)local(?:\.|$)/i.test(name);
}

function isRetiredReleasePath(relativePath) {
  const normalized = relativePath.replaceAll("\\", "/");
  if (RETIRED_RELEASE_FILES.has(normalized)) return true;
  return [...RETIRED_RELEASE_DIRECTORIES].some((directory) => normalized === directory || normalized.startsWith(`${directory}/`));
}

function isSourceOnlyReleasePath(relativePath) {
  const normalized = relativePath.replaceAll("\\", "/");
  return [...SOURCE_ONLY_RELEASE_DIRECTORIES]
    .some((directory) => normalized === directory || normalized.startsWith(`${directory}/`));
}

function shouldEnterDirectory(relativePath) {
  const segments = pathSegments(relativePath);
  if (segments.length === 0 || isLocalOrTemporary(segments) || isRetiredReleasePath(relativePath)
    || isSourceOnlyReleasePath(relativePath)
    || !RELEASE_DIRECTORIES.has(segments[0])) return false;
  if (segments[0] === "docs" && segments.length > 1) {
    const prefix = `${relativePath.replaceAll("\\", "/")}/`;
    return [...RELEASE_DOCUMENT_FILES].some((file) => file.startsWith(prefix));
  }
  // Directories under themes/ are supplied source kits (masters, specs, QA).
  // They are never distributed; only top-level theme JSON files ship.
  if (segments[0] === "themes" && segments.length > 1) return false;
  return true;
}

function shouldIncludeFile(relativePath) {
  const normalized = relativePath.replaceAll("\\", "/");
  const segments = pathSegments(normalized);
  if (segments.length === 0 || isLocalOrTemporary(segments) || isRetiredReleasePath(normalized)
      || isSourceOnlyReleasePath(normalized)) return false;
  if (segments.length === 1) return RELEASE_ROOT_FILES.has(segments[0]);

  const root = segments[0];
  if (root === "docs") return RELEASE_DOCUMENT_FILES.has(normalized);
  const extension = path.extname(segments.at(-1)).toLowerCase();
  return RELEASE_DIRECTORIES.get(root)?.has(extension) ?? false;
}

async function collect(directory, prefix = "claude-aura", relativeDirectory = "") {
  const files = [];
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const source = path.join(directory, entry.name);
    const relativePath = relativeDirectory ? `${relativeDirectory}/${entry.name}` : entry.name;
    const archivePath = `${prefix}/${entry.name}`.replaceAll("\\", "/");
    if (entry.isDirectory() && shouldEnterDirectory(relativePath)) {
      files.push(...await collect(source, archivePath, relativePath));
    } else if (entry.isFile() && shouldIncludeFile(relativePath)) {
      files.push({ source, archivePath });
    }
  }
  return files;
}

function makeZip(entries) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  for (const entry of entries) {
    const name = Buffer.from(entry.archivePath, "utf8");
    const compressed = zlib.deflateRawSync(entry.bytes, { level: 9 });
    const crc = crc32(entry.bytes);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(8, 8);
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(33, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(entry.bytes.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    localParts.push(local, name, compressed);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(0x0314, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt16LE(0, 12);
    central.writeUInt16LE(33, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(entry.bytes.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    const executable = /\.(?:command|sh|mjs)$/.test(entry.archivePath);
    const unixMode = executable ? 0o100755 : 0o100644;
    central.writeUInt32LE((unixMode << 16) >>> 0, 38);
    central.writeUInt32LE(offset, 42);
    centralParts.push(central, name);
    offset += local.length + name.length + compressed.length;
  }
  const centralBytes = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralBytes.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);
  return Buffer.concat([...localParts, centralBytes, end]);
}

await buildAuraIcon();
await buildLauncherAssets();
await buildBrandWordmarks();
const outputDirectory = path.join(PROJECT_ROOT, "release");
await fs.mkdir(outputDirectory, { recursive: true });
const files = (await collect(PROJECT_ROOT)).sort((a, b) => a.archivePath.localeCompare(b.archivePath));
const releaseRelativePaths = new Set(files.map(({ archivePath }) => archivePath.replace(/^claude-aura\//, "")));
for (const requiredPath of REQUIRED_RELEASE_FILES) {
  if (!releaseRelativePaths.has(requiredPath)) throw new Error(`Required release file is missing: ${requiredPath}`);
}
const entries = await Promise.all(files.map(async (file) => ({ ...file, bytes: await fs.readFile(file.source) })));
const zip = makeZip(entries);
const name = `claude-aura-v${AURA_VERSION}.zip`;
const outputPath = path.join(outputDirectory, name);
await fs.writeFile(outputPath, zip);
const digest = crypto.createHash("sha256").update(zip).digest("hex");
await fs.writeFile(`${outputPath}.sha256`, `${digest}  ${name}\n`, "utf8");
console.log(JSON.stringify({ outputPath, files: entries.length, bytes: zip.length, sha256: digest }, null, 2));
