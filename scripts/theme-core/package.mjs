import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { inflateRawSync } from "node:zlib";
import { AURA_VERSION } from "./constants.mjs";
import { readThemeKit } from "./registry.mjs";

export const AURA_PACKAGE_FORMAT = "claude-aura-theme";
export const AURA_PACKAGE_MANIFEST_VERSION = 1;
export const AURA_PACKAGE_MANIFEST_PATH = "manifest.json";
export const AURA_PACKAGE_LIMITS = Object.freeze({
  archiveBytes: 2_000_000,
  totalBytes: 1_800_000,
  entryBytes: 400_000,
  manifestBytes: 64_000,
  files: 24,
  pathCharacters: 180,
});

const THEME_ID_PATTERN = /^[a-z][a-z0-9-]{1,39}$/u;
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const VERSION_PATTERN = /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/u;
const ROOT_SLOT_PATTERN = /^(?:background|hero|corner-top-right|corner-bottom|card-[1-3]|brand-mark)\.(?:png|webp|avif)$/u;
const STUDIO_LAYER_PATTERN = /^artwork\/layer-[a-f0-9]{32}\.webp$/u;
const LOADING_MARK_PATTERN = /^loading\/mark-[a-f0-9]{64}\.png$/u;
const LOADING_ARTWORK_PATTERN = /^loading\/artwork-[a-f0-9]{64}\.webp$/u;
const EXACT_KIT_PATHS = new Set([
  "theme.json",
  "card-preview.webp",
  "launcher-mark.png",
  "sidebar-identity.png",
]);
const ALLOWED_DIRECTORIES = new Set(["artwork", "loading"]);

const CRC_TABLE = Uint32Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = (value >>> 1) ^ ((value & 1) ? 0xedb88320 : 0);
  }
  return value >>> 0;
});

function plain(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}

function exact(value, keys, label) {
  if (!plain(value)) throw new Error(`${label} must be an object`);
  const expected = new Set(keys);
  if (Object.keys(value).some((key) => !expected.has(key))
      || keys.some((key) => !Object.hasOwn(value, key))) {
    throw new Error(`${label} has an unsupported property or is missing a required property`);
  }
}

function isPathWithin(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative !== "" && relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function crc32(bytes) {
  let value = 0xffffffff;
  for (const byte of bytes) value = CRC_TABLE[(value ^ byte) & 0xff] ^ (value >>> 8);
  return (value ^ 0xffffffff) >>> 0;
}

function isAllowedKitPath(value) {
  return EXACT_KIT_PATHS.has(value)
    || ROOT_SLOT_PATTERN.test(value)
    || STUDIO_LAYER_PATTERN.test(value)
    || LOADING_MARK_PATTERN.test(value)
    || LOADING_ARTWORK_PATTERN.test(value);
}

function canonicalArchivePath(value, { kit = false } = {}) {
  if (typeof value !== "string" || value.length < 1 || value.length > AURA_PACKAGE_LIMITS.pathCharacters
      || value.includes("\\") || value.startsWith("/") || value.includes("\0")
      || value.normalize("NFC") !== value) {
    throw new Error(".aura file path must be a safe relative allowlisted path");
  }
  const segments = value.split("/");
  if (segments.some((segment) => !segment || segment === "." || segment === ".." || segment.includes(":"))) {
    throw new Error(".aura file path must be a safe relative allowlisted path");
  }
  if (kit && !isAllowedKitPath(value)) throw new Error(`.aura file path is outside the allowlist: ${value}`);
  return value;
}

export function validateAuraThemePackageManifest(value) {
  exact(value, ["format", "schemaVersion", "themeId", "createdWith", "files"], ".aura manifest");
  if (value.format !== AURA_PACKAGE_FORMAT) throw new Error("Unsupported .aura package format");
  if (value.schemaVersion !== AURA_PACKAGE_MANIFEST_VERSION) {
    throw new Error("Unsupported .aura manifest version");
  }
  if (typeof value.themeId !== "string" || !THEME_ID_PATTERN.test(value.themeId)) {
    throw new Error(".aura manifest themeId is invalid");
  }
  if (typeof value.createdWith !== "string" || !VERSION_PATTERN.test(value.createdWith)) {
    throw new Error(".aura manifest createdWith version is invalid");
  }
  if (!Array.isArray(value.files) || value.files.length < 1 || value.files.length > AURA_PACKAGE_LIMITS.files) {
    throw new Error(".aura manifest exceeds the file-count limit");
  }
  let total = 0;
  let previous = null;
  const seen = new Set();
  const files = value.files.map((entry, index) => {
    exact(entry, ["path", "size", "sha256"], `.aura manifest.files[${index}]`);
    const filePath = canonicalArchivePath(entry.path, { kit: true });
    const folded = filePath.toLowerCase();
    if (seen.has(folded)) throw new Error(`.aura manifest contains a duplicate path: ${filePath}`);
    if (previous !== null && previous.localeCompare(filePath, "en") >= 0) {
      throw new Error(".aura manifest files must be sorted by path");
    }
    seen.add(folded);
    previous = filePath;
    if (!Number.isSafeInteger(entry.size) || entry.size < 1 || entry.size > AURA_PACKAGE_LIMITS.entryBytes) {
      throw new Error(`.aura manifest entry exceeds the size limit: ${filePath}`);
    }
    if (typeof entry.sha256 !== "string" || !SHA256_PATTERN.test(entry.sha256)) {
      throw new Error(`.aura manifest checksum is invalid: ${filePath}`);
    }
    total += entry.size;
    return { path: filePath, size: entry.size, sha256: entry.sha256 };
  });
  if (!seen.has("theme.json")) throw new Error(".aura manifest must include theme.json");
  if (total > AURA_PACKAGE_LIMITS.totalBytes) throw new Error(".aura manifest exceeds the total size limit");
  return {
    format: value.format,
    schemaVersion: value.schemaVersion,
    themeId: value.themeId,
    createdWith: value.createdWith,
    files,
  };
}

async function collectKitFiles(kitDirectory) {
  const requestedRoot = path.resolve(kitDirectory);
  const rootStat = await fs.lstat(requestedRoot);
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) {
    throw new Error("Theme package source must be a regular theme-kit folder");
  }
  const realRoot = await fs.realpath(requestedRoot);
  const pending = [{ directory: realRoot, relative: "" }];
  const files = [];
  while (pending.length) {
    const current = pending.shift();
    for (const entry of await fs.readdir(current.directory, { withFileTypes: true })) {
      const relative = current.relative ? `${current.relative}/${entry.name}` : entry.name;
      const candidate = path.resolve(current.directory, entry.name);
      if (!isPathWithin(realRoot, candidate)) throw new Error("Theme package source escaped its kit folder");
      const stat = await fs.lstat(candidate);
      if (stat.isSymbolicLink()) throw new Error(`Theme package source cannot contain links: ${relative}`);
      if (stat.isDirectory()) {
        // Folder kits may retain source guidance such as CHECKLIST.md or a
        // contributor-only notes directory. Export reads only the runtime
        // allowlist and never traverses or packages those extra surfaces.
        if (!ALLOWED_DIRECTORIES.has(relative)) continue;
        pending.push({ directory: candidate, relative });
        continue;
      }
      if (!stat.isFile()) throw new Error(`Theme package source contains an unsupported entry: ${relative}`);
      if (!isAllowedKitPath(relative)) continue;
      canonicalArchivePath(relative, { kit: true });
      if (stat.size < 1 || stat.size > AURA_PACKAGE_LIMITS.entryBytes) {
        throw new Error(`Theme package source entry exceeds the size limit: ${relative}`);
      }
      const realFile = await fs.realpath(candidate);
      if (!isPathWithin(realRoot, realFile)) throw new Error("Theme package source escaped its kit folder");
      files.push({ path: relative, source: realFile, size: stat.size });
    }
  }
  files.sort((left, right) => left.path.localeCompare(right.path, "en"));
  if (files.length < 1 || files.length > AURA_PACKAGE_LIMITS.files) {
    throw new Error("Theme package source exceeds the file-count limit");
  }
  return { root: realRoot, files };
}

function encodeStoredZip(entries) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  for (const entry of entries) {
    const name = Buffer.from(entry.path, "utf8");
    const bytes = Buffer.from(entry.bytes);
    const checksum = crc32(bytes);
    const local = Buffer.alloc(30 + name.length);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(0x0021, 12);
    local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(bytes.length, 18);
    local.writeUInt32LE(bytes.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    name.copy(local, 30);
    localParts.push(local, bytes);

    const central = Buffer.alloc(46 + name.length);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt16LE(0, 12);
    central.writeUInt16LE(0x0021, 14);
    central.writeUInt32LE(checksum, 16);
    central.writeUInt32LE(bytes.length, 20);
    central.writeUInt32LE(bytes.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    name.copy(central, 46);
    centralParts.push(central);
    offset += local.length + bytes.length;
  }
  const centralDirectory = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);
  return Buffer.concat([...localParts, centralDirectory, end]);
}

function decodeUtf8(bytes, label) {
  const value = bytes.toString("utf8");
  if (!Buffer.from(value, "utf8").equals(bytes)) throw new Error(`${label} is not valid UTF-8`);
  return value;
}

function decodeZip(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 22 || buffer.length > AURA_PACKAGE_LIMITS.archiveBytes) {
    throw new Error(".aura archive exceeds the archive size limit or is truncated");
  }
  const endOffset = buffer.length - 22;
  if (buffer.readUInt32LE(endOffset) !== 0x06054b50 || buffer.readUInt16LE(endOffset + 20) !== 0) {
    throw new Error(".aura archive has a malformed end record");
  }
  const disk = buffer.readUInt16LE(endOffset + 4);
  const centralDisk = buffer.readUInt16LE(endOffset + 6);
  const diskEntries = buffer.readUInt16LE(endOffset + 8);
  const entryCount = buffer.readUInt16LE(endOffset + 10);
  const centralSize = buffer.readUInt32LE(endOffset + 12);
  const centralOffset = buffer.readUInt32LE(endOffset + 16);
  if (disk !== 0 || centralDisk !== 0 || diskEntries !== entryCount
      || entryCount < 2 || entryCount > AURA_PACKAGE_LIMITS.files + 1
      || centralOffset + centralSize !== endOffset) {
    throw new Error(".aura archive has an unsupported multi-disk or central-directory layout");
  }

  const centralEntries = [];
  const seen = new Set();
  let cursor = centralOffset;
  for (let index = 0; index < entryCount; index += 1) {
    if (cursor + 46 > endOffset || buffer.readUInt32LE(cursor) !== 0x02014b50) {
      throw new Error(".aura archive central directory is malformed");
    }
    const versionMade = buffer.readUInt16LE(cursor + 4);
    const flags = buffer.readUInt16LE(cursor + 8);
    const method = buffer.readUInt16LE(cursor + 10);
    const checksum = buffer.readUInt32LE(cursor + 16);
    const compressedSize = buffer.readUInt32LE(cursor + 20);
    const size = buffer.readUInt32LE(cursor + 24);
    const nameLength = buffer.readUInt16LE(cursor + 28);
    const extraLength = buffer.readUInt16LE(cursor + 30);
    const commentLength = buffer.readUInt16LE(cursor + 32);
    const diskStart = buffer.readUInt16LE(cursor + 34);
    const externalAttributes = buffer.readUInt32LE(cursor + 38);
    const localOffset = buffer.readUInt32LE(cursor + 42);
    const next = cursor + 46 + nameLength + extraLength + commentLength;
    if (next > endOffset || diskStart !== 0 || ![0, 0x0800].includes(flags)
        || ![0, 8].includes(method) || compressedSize > AURA_PACKAGE_LIMITS.archiveBytes) {
      throw new Error(".aura archive entry uses an unsupported ZIP feature");
    }
    if ((versionMade >>> 8) === 3 && (((externalAttributes >>> 16) & 0o170000) === 0o120000)) {
      throw new Error(".aura archive cannot contain symbolic links");
    }
    const rawName = buffer.subarray(cursor + 46, cursor + 46 + nameLength);
    const decodedName = decodeUtf8(rawName, ".aura entry name");
    const name = canonicalArchivePath(decodedName, {
      kit: decodedName !== AURA_PACKAGE_MANIFEST_PATH,
    });
    const folded = name.toLowerCase();
    if (seen.has(folded)) throw new Error(`.aura archive contains a duplicate path: ${name}`);
    seen.add(folded);
    const maximum = name === AURA_PACKAGE_MANIFEST_PATH
      ? AURA_PACKAGE_LIMITS.manifestBytes
      : AURA_PACKAGE_LIMITS.entryBytes;
    if (size < 1 || size > maximum) throw new Error(`.aura archive entry exceeds the size limit: ${name}`);
    centralEntries.push({
      name, flags, method, checksum, compressedSize, size, localOffset,
    });
    cursor = next;
  }
  if (cursor !== endOffset) throw new Error(".aura archive central-directory size is inconsistent");

  const ranges = [];
  const entries = new Map();
  let total = 0;
  for (const entry of centralEntries) {
    const local = entry.localOffset;
    if (local + 30 > centralOffset || buffer.readUInt32LE(local) !== 0x04034b50) {
      throw new Error(".aura archive local header is malformed");
    }
    const localFlags = buffer.readUInt16LE(local + 6);
    const localMethod = buffer.readUInt16LE(local + 8);
    const localChecksum = buffer.readUInt32LE(local + 14);
    const localCompressedSize = buffer.readUInt32LE(local + 18);
    const localSize = buffer.readUInt32LE(local + 22);
    const nameLength = buffer.readUInt16LE(local + 26);
    const extraLength = buffer.readUInt16LE(local + 28);
    const dataOffset = local + 30 + nameLength + extraLength;
    const end = dataOffset + entry.compressedSize;
    if (end > centralOffset || localFlags !== entry.flags || localMethod !== entry.method
        || localChecksum !== entry.checksum || localCompressedSize !== entry.compressedSize
        || localSize !== entry.size) {
      throw new Error(".aura archive local and central headers do not match");
    }
    const localName = decodeUtf8(buffer.subarray(local + 30, local + 30 + nameLength), ".aura local entry name");
    if (localName !== entry.name) throw new Error(".aura archive entry names do not match");
    ranges.push([local, end]);
    const compressed = buffer.subarray(dataOffset, end);
    let bytes;
    try {
      bytes = entry.method === 0
        ? Buffer.from(compressed)
        : inflateRawSync(compressed, { maxOutputLength: entry.size + 1 });
    } catch {
      throw new Error(`.aura archive entry could not be decompressed: ${entry.name}`);
    }
    if (bytes.length !== entry.size || crc32(bytes) !== entry.checksum) {
      throw new Error(`.aura archive CRC checksum mismatch: ${entry.name}`);
    }
    total += bytes.length;
    entries.set(entry.name, bytes);
  }
  ranges.sort((left, right) => left[0] - right[0]);
  for (let index = 1; index < ranges.length; index += 1) {
    if (ranges[index][0] < ranges[index - 1][1]) throw new Error(".aura archive entries overlap");
  }
  if (total > AURA_PACKAGE_LIMITS.totalBytes + AURA_PACKAGE_LIMITS.manifestBytes) {
    throw new Error(".aura archive exceeds the total size limit");
  }
  return entries;
}

function validateArchiveEntries(entries) {
  const manifestBytes = entries.get(AURA_PACKAGE_MANIFEST_PATH);
  if (!manifestBytes) throw new Error(".aura archive is missing manifest.json");
  let raw;
  try {
    raw = JSON.parse(decodeUtf8(manifestBytes, ".aura manifest"));
  } catch (error) {
    if (/valid UTF-8/.test(error.message)) throw error;
    throw new Error(".aura manifest is not valid JSON");
  }
  const manifest = validateAuraThemePackageManifest(raw);
  if (entries.size !== manifest.files.length + 1) throw new Error(".aura manifest does not list every archive entry");
  for (const file of manifest.files) {
    const bytes = entries.get(file.path);
    if (!bytes) throw new Error(`.aura manifest entry is missing: ${file.path}`);
    if (bytes.length !== file.size || sha256(bytes) !== file.sha256) {
      throw new Error(`.aura manifest checksum mismatch: ${file.path}`);
    }
  }
  return manifest;
}

export async function createAuraThemePackage({
  kitDirectory,
  packagePath,
  createdWith = AURA_VERSION,
}) {
  if (typeof packagePath !== "string" || path.extname(packagePath).toLowerCase() !== ".aura") {
    throw new Error("Theme package output must use the .aura extension");
  }
  const { files } = await collectKitFiles(kitDirectory);
  const kit = await readThemeKit(path.resolve(kitDirectory));
  const materialized = [];
  let total = 0;
  for (const file of files) {
    const bytes = await fs.readFile(file.source);
    if (bytes.length !== file.size) throw new Error(`Theme package source changed while reading: ${file.path}`);
    total += bytes.length;
    materialized.push({ path: file.path, bytes });
  }
  if (total > AURA_PACKAGE_LIMITS.totalBytes) throw new Error("Theme package source exceeds the total size limit");
  const manifest = validateAuraThemePackageManifest({
    format: AURA_PACKAGE_FORMAT,
    schemaVersion: AURA_PACKAGE_MANIFEST_VERSION,
    themeId: kit.id,
    createdWith,
    files: materialized.map((file) => ({
      path: file.path,
      size: file.bytes.length,
      sha256: sha256(file.bytes),
    })),
  });
  const manifestBytes = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  if (manifestBytes.length > AURA_PACKAGE_LIMITS.manifestBytes) throw new Error(".aura manifest exceeds its size limit");
  const archive = encodeStoredZip([
    { path: AURA_PACKAGE_MANIFEST_PATH, bytes: manifestBytes },
    ...materialized,
  ]);
  if (archive.length > AURA_PACKAGE_LIMITS.archiveBytes) throw new Error("Theme package exceeds the archive size limit");

  const output = path.resolve(packagePath);
  const parent = path.dirname(output);
  const parentStat = await fs.lstat(parent);
  if (!parentStat.isDirectory() || parentStat.isSymbolicLink()) {
    throw new Error("Theme package output folder must be a regular directory");
  }
  await fs.access(output).then(
    () => { throw new Error("Theme package output already exists"); },
    (error) => { if (error.code !== "ENOENT") throw error; },
  );
  const temporary = path.join(parent, `.${path.basename(output)}-${crypto.randomBytes(16).toString("hex")}.tmp`);
  try {
    await fs.writeFile(temporary, archive, { flag: "wx" });
    await fs.rename(temporary, output);
  } finally {
    await fs.rm(temporary, { force: true }).catch(() => {});
  }
  return { packagePath: output, manifest, bytes: archive.length };
}

export async function extractAuraThemePackage({ packagePath, destinationDirectory }) {
  if (typeof packagePath !== "string" || path.extname(packagePath).toLowerCase() !== ".aura") {
    throw new Error("Theme package input must use the .aura extension");
  }
  const source = path.resolve(packagePath);
  const sourceStat = await fs.lstat(source);
  if (!sourceStat.isFile() || sourceStat.isSymbolicLink() || sourceStat.size > AURA_PACKAGE_LIMITS.archiveBytes) {
    throw new Error("Theme package input must be a regular bounded .aura file");
  }
  const entries = decodeZip(await fs.readFile(source));
  const manifest = validateArchiveEntries(entries);
  const destination = path.resolve(destinationDirectory);
  await fs.access(destination).then(
    () => { throw new Error("Theme package staging destination already exists"); },
    (error) => { if (error.code !== "ENOENT") throw error; },
  );
  let created = false;
  try {
    await fs.mkdir(destination);
    created = true;
    for (const file of manifest.files) {
      const target = path.resolve(destination, ...file.path.split("/"));
      if (!isPathWithin(destination, target)) throw new Error("Theme archive extraction escaped staging");
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, entries.get(file.path), { flag: "wx" });
    }
    const kit = await readThemeKit(destination, { expectedId: manifest.themeId });
    if (kit.id !== manifest.themeId) throw new Error("Theme package id does not match its validated kit");
    return {
      packagePath: source,
      destinationDirectory: destination,
      manifest,
      theme: kit.id,
    };
  } catch (error) {
    if (created) await fs.rm(destination, { recursive: true, force: true }).catch(() => {});
    throw error;
  }
}
