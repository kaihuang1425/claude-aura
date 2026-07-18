#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import zlib from "node:zlib";
import { AURA_VERSION, PROJECT_ROOT } from "./theme-core.mjs";

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
const RELEASE_DIRECTORIES = new Map([
  ["assets", new Set([".avif", ".css", ".js", ".md", ".png", ".svg", ".webp"])],
  ["docs", new Set([".md"])],
  ["macos", new Set([".command", ".sh"])],
  ["preview", new Set([".css", ".html", ".js"])],
  ["scripts", new Set([".mjs"])],
  ["studio", new Set([".css", ".html", ".js"])],
  ["tests", new Set([".mjs"])],
  ["themes", new Set([".json"])],
  ["vendor", new Set([".dll", ".txt"])],
  ["windows", new Set([".json", ".ps1"])],
]);
const SCREENSHOT_EXTENSIONS = new Set([".avif", ".jpeg", ".jpg", ".png", ".webp"]);
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

function shouldEnterDirectory(relativePath) {
  const segments = pathSegments(relativePath);
  if (segments.length === 0 || isLocalOrTemporary(segments) || !RELEASE_DIRECTORIES.has(segments[0])) return false;
  // Directories under themes/ are supplied source kits (masters, specs, QA).
  // They are never distributed; only top-level theme JSON files ship.
  if (segments[0] === "themes" && segments.length > 1) return false;
  return true;
}

function shouldIncludeFile(relativePath) {
  const normalized = relativePath.replaceAll("\\", "/");
  const segments = pathSegments(normalized);
  if (segments.length === 0 || isLocalOrTemporary(segments) || normalized === "docs/preview.png") return false;
  if (segments.length === 1) return RELEASE_ROOT_FILES.has(segments[0]);

  const root = segments[0];
  const extension = path.extname(segments.at(-1)).toLowerCase();
  if (root === "docs" && segments[1] === "theme-screenshots" && SCREENSHOT_EXTENSIONS.has(extension)) return true;
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

const outputDirectory = path.join(PROJECT_ROOT, "release");
await fs.mkdir(outputDirectory, { recursive: true });
const files = (await collect(PROJECT_ROOT)).sort((a, b) => a.archivePath.localeCompare(b.archivePath));
const entries = await Promise.all(files.map(async (file) => ({ ...file, bytes: await fs.readFile(file.source) })));
const zip = makeZip(entries);
const name = `claude-aura-v${AURA_VERSION}.zip`;
const outputPath = path.join(outputDirectory, name);
await fs.writeFile(outputPath, zip);
const digest = crypto.createHash("sha256").update(zip).digest("hex");
await fs.writeFile(`${outputPath}.sha256`, `${digest}  ${name}\n`, "utf8");
console.log(JSON.stringify({ outputPath, files: entries.length, bytes: zip.length, sha256: digest }, null, 2));
