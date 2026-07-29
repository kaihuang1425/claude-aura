import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import {
  contrastRatio,
  hexToHsl,
  hslRgb,
} from "./validation.mjs";

const TERMINAL_THEME_MANIFEST = ".claude-aura-terminal-themes.manifest";
const THEME_ID_PATTERN = /^[a-z][a-z0-9-]{1,39}$/;
const HEX_DIGEST_PATTERN = /^[a-f0-9]{64}$/;

const TERMINAL_TOKEN_MAPPINGS = [
  ["claude", "--aura-accent-primary", "--aura-background-primary", 3],
  ["text", "--aura-text-primary", "--aura-background-primary", 4.5],
  ["inverseText", "--aura-text-on-accent", "--aura-accent-primary", 4.5],
  ["inactive", "--aura-text-muted", "--aura-background-primary", 4.5],
  ["subtle", "--aura-text-muted", "--aura-background-primary", 4.5],
  ["promptBorder", "--aura-accent-primary", "--aura-background-primary", 3],
  ["bashBorder", "--aura-text-secondary", "--aura-background-primary", 3],
  ["ide", "--aura-accent-primary", "--aura-background-primary", 3],
  ["selectionBg", "--aura-background-secondary", "--aura-text-primary", 4.5],
  ["briefLabelYou", "--aura-text-secondary", "--aura-background-primary", 4.5],
  ["briefLabelClaude", "--aura-accent-primary", "--aura-background-primary", 4.5],
].map(([token, source, reference, minimumContrast]) => Object.freeze({
  token,
  source,
  reference,
  minimumContrast,
}));

export const TERMINAL_THEME_SCHEMA = Object.freeze({
  schemaSource: "https://code.claude.com/docs/en/terminal-config#create-a-custom-theme",
  documentKeys: Object.freeze(["name", "base", "overrides"]),
  bases: Object.freeze(["light", "dark"]),
  tokens: Object.freeze(TERMINAL_TOKEN_MAPPINGS),
});

function hslParts(value, label) {
  const match = String(value).trim().match(
    /^(\d{1,3}(?:\.\d+)?)\s+(\d{1,3}(?:\.\d+)?)%\s+(\d{1,3}(?:\.\d+)?)%$/,
  );
  if (!match) throw new Error(`${label} must contain HSL components`);
  return match.slice(1).map(Number);
}

function terminalHex(value, label) {
  hslParts(value, label);
  return `#${hslRgb(value).map((channel) => Math.round(channel * 255)
    .toString(16).padStart(2, "0")).join("")}`.toUpperCase();
}

function clampLightness(source, reference, minimumContrast, label) {
  const sourceHsl = hexToHsl(terminalHex(source, label), label);
  hslParts(reference, `${label} reference`);
  const referenceHsl = reference;
  if (contrastRatio(sourceHsl, referenceHsl) >= minimumContrast) {
    return terminalHex(sourceHsl, label);
  }

  const [hue, saturation, lightness] = hslParts(sourceHsl, label);
  const [, , referenceLightness] = hslParts(referenceHsl, `${label} reference`);
  const direction = referenceLightness >= 50 ? -1 : 1;
  const start = Math.round(lightness * 10);
  const limit = direction < 0 ? 0 : 1000;
  for (let step = start + direction; direction < 0 ? step >= limit : step <= limit; step += direction) {
    const candidate = `${hue} ${saturation}% ${step / 10}%`;
    const candidateHex = terminalHex(candidate, label);
    const roundedCandidate = hexToHsl(candidateHex, label);
    if (contrastRatio(roundedCandidate, referenceHsl) >= minimumContrast) {
      return candidateHex;
    }
  }
  return terminalHex(`${hue} ${saturation}% ${limit / 10}%`, label);
}

export function buildTerminalTheme(theme, mode) {
  if (!TERMINAL_THEME_SCHEMA.bases.includes(mode)) {
    throw new Error("Terminal theme mode must be light or dark");
  }
  if (!theme || typeof theme !== "object" || !THEME_ID_PATTERN.test(theme.name ?? "")) {
    throw new Error("Terminal theme requires a valid Aura theme");
  }
  const semantic = theme[mode]?.semantic;
  if (!semantic || typeof semantic !== "object" || Array.isArray(semantic)) {
    throw new Error(`theme.${mode}.semantic must be an object`);
  }
  const label = typeof theme.label === "string" && theme.label.trim()
    ? theme.label.trim()
    : theme.name.split("-").map((part) => `${part[0].toUpperCase()}${part.slice(1)}`).join(" ");
  const overrides = {};
  for (const mapping of TERMINAL_THEME_SCHEMA.tokens) {
    for (const required of [mapping.source, mapping.reference]) {
      if (typeof semantic[required] !== "string") {
        throw new Error(`theme.${mode}.semantic is missing ${required}`);
      }
    }
    overrides[mapping.token] = clampLightness(
      semantic[mapping.source],
      semantic[mapping.reference],
      mapping.minimumContrast,
      `${theme.name}.${mode}.${mapping.token}`,
    );
  }
  return {
    name: `Claude Aura — ${label} ${mode === "light" ? "Light" : "Dark"}`,
    base: mode,
    overrides,
  };
}

function digest(contents) {
  return crypto.createHash("sha256").update(contents).digest("hex");
}

function documentBytes(document) {
  return `${JSON.stringify(document, null, 2)}\n`;
}

function normalizedPathIdentity(filePath) {
  const normalized = path.normalize(filePath);
  return process.platform === "win32" ? normalized.toLocaleLowerCase("en-US") : normalized;
}

function validatePairTarget(target, mode) {
  if (typeof target !== "string" || !target.trim()) {
    throw new Error(`Terminal ${mode} target path is required`);
  }
  if (!path.isAbsolute(target)) {
    throw new Error(`Terminal ${mode} target path must be absolute`);
  }
  const resolved = path.resolve(target);
  const basename = path.basename(resolved);
  if (path.extname(basename).toLocaleLowerCase("en-US") !== ".json") {
    throw new Error(`Terminal ${mode} target must be a JSON file`);
  }
  const opposite = mode === "light" ? "dark" : "light";
  if (new RegExp(`(?:^|[-_. ])${opposite}(?:[-_. ]|$)`, "i").test(basename.slice(0, -5))) {
    throw new Error(`Terminal ${mode} target path appears to name the ${opposite} theme`);
  }
  return resolved;
}

function resolvePairTargets(targets) {
  if (!targets || typeof targets !== "object" || Array.isArray(targets)
      || Object.keys(targets).sort().join(",") !== "darkPath,lightPath") {
    throw new Error("Terminal theme pair targets must contain only lightPath and darkPath");
  }
  const lightPath = validatePairTarget(targets.lightPath, "light");
  const darkPath = validatePairTarget(targets.darkPath, "dark");
  if (normalizedPathIdentity(lightPath) === normalizedPathIdentity(darkPath)) {
    throw new Error("Terminal Light and Dark target paths must be different");
  }
  return { lightPath, darkPath };
}

async function assertExistingDirectory(directory, operations, mode) {
  let status;
  try {
    status = await operations.stat(directory);
  } catch (error) {
    if (error.code === "ENOENT") {
      throw new Error(`Terminal ${mode} destination directory must already exist`);
    }
    throw error;
  }
  if (!status.isDirectory()) {
    throw new Error(`Terminal ${mode} destination directory must already exist`);
  }
}

async function assertTargetAbsent(filePath, operations, mode) {
  try {
    await operations.lstat(filePath);
  } catch (error) {
    if (error.code === "ENOENT") return;
    throw error;
  }
  throw new Error(`Refusing to overwrite existing Terminal ${mode} target`);
}

async function stageExclusiveDocument(document, operations) {
  let handle = null;
  try {
    handle = await operations.open(document.stagePath, "wx", 0o600);
    await handle.writeFile(document.contents, "utf8");
    await handle.sync();
    await handle.close();
    handle = null;
  } finally {
    if (handle) await handle.close().catch(() => {});
  }
}

async function pathsShareFile(left, right, operations) {
  try {
    const [leftStatus, rightStatus] = await Promise.all([
      operations.stat(left),
      operations.stat(right),
    ]);
    return leftStatus.dev === rightStatus.dev
      && leftStatus.ino !== 0
      && leftStatus.ino === rightStatus.ino;
  } catch {
    return false;
  }
}

/**
 * Export one user-chosen Light/Dark pair without creating directories,
 * overwriting files, writing an ownership manifest, or changing Claude state.
 * Both complete documents are staged before either destination is published.
 */
export async function exportTerminalThemePair(theme, targets, options = {}) {
  const resolvedTargets = resolvePairTargets(targets);
  const operations = { ...fs, ...(options.fileOperations ?? {}) };
  const documents = TERMINAL_THEME_SCHEMA.bases.map((mode) => {
    const filePath = resolvedTargets[`${mode}Path`];
    const contents = documentBytes(buildTerminalTheme(theme, mode));
    return {
      mode,
      filePath,
      contents,
      digest: digest(contents),
      stagePath: path.join(
        path.dirname(filePath),
        `.${path.basename(filePath)}.${process.pid}.${crypto.randomBytes(6).toString("hex")}.tmp`,
      ),
    };
  });

  for (const document of documents) {
    await assertExistingDirectory(path.dirname(document.filePath), operations, document.mode);
  }
  for (const document of documents) {
    await assertTargetAbsent(document.filePath, operations, document.mode);
  }

  const published = [];
  try {
    for (const document of documents) {
      await stageExclusiveDocument(document, operations);
    }
    for (const document of documents) {
      try {
        // A hard-link promotion is same-volume, atomic, and exclusive on both
        // Windows and POSIX. Unlike rename, it cannot replace a raced target.
        await operations.link(document.stagePath, document.filePath);
        published.push(document);
      } catch (error) {
        // A test or abrupt wrapper can report failure after the link syscall.
        // Record only a target proven to be this staged inode; never delete a
        // pre-existing path merely because its bytes happen to match.
        if (await pathsShareFile(document.stagePath, document.filePath, operations)) {
          published.push(document);
        }
        throw error;
      }
    }
  } catch (error) {
    const cleanupErrors = [];
    for (const document of published.reverse()) {
      try {
        if (await pathsShareFile(document.stagePath, document.filePath, operations)) {
          await operations.rm(document.filePath, { force: true });
        }
      } catch (cleanupError) {
        cleanupErrors.push(cleanupError);
      }
    }
    if (cleanupErrors.length) {
      throw new AggregateError([error, ...cleanupErrors], "Terminal theme pair rollback failed");
    }
    throw error;
  } finally {
    await Promise.all(documents.map(
      (document) => operations.rm(document.stagePath, { force: true }).catch(() => {}),
    ));
  }

  return {
    files: documents.map((document) => ({
      mode: document.mode,
      path: document.filePath,
      sha256: document.digest,
    })),
  };
}

async function readManifest(directory, operations) {
  const manifestPath = path.join(directory, TERMINAL_THEME_MANIFEST);
  let text;
  try {
    text = await operations.readFile(manifestPath, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") return { manifestPath, files: {} };
    throw error;
  }
  let value;
  try {
    value = JSON.parse(text);
  } catch {
    throw new Error("Aura terminal-theme ownership manifest is invalid");
  }
  if (!value || typeof value !== "object" || Array.isArray(value)
      || value.schemaVersion !== 1
      || !value.files || typeof value.files !== "object" || Array.isArray(value.files)
      || Object.keys(value).sort().join(",") !== "files,schemaVersion"
      || Object.keys(value.files).length > 256) {
    throw new Error("Aura terminal-theme ownership manifest is invalid");
  }
  for (const [filename, fileDigest] of Object.entries(value.files)) {
    if (path.basename(filename) !== filename || !filename.endsWith(".json")
        || !HEX_DIGEST_PATTERN.test(fileDigest)) {
      throw new Error("Aura terminal-theme ownership manifest is invalid");
    }
  }
  return { manifestPath, files: { ...value.files } };
}

async function atomicWrite(filePath, contents, operations) {
  const temporary = path.join(
    path.dirname(filePath),
    `.${path.basename(filePath)}.${process.pid}.${crypto.randomBytes(6).toString("hex")}.tmp`,
  );
  let handle = null;
  try {
    handle = await operations.open(temporary, "wx", 0o600);
    await handle.writeFile(contents, "utf8");
    await handle.sync();
    await handle.close();
    handle = null;
    await operations.rename(temporary, filePath);
  } finally {
    if (handle) await handle.close().catch(() => {});
    await operations.rm(temporary, { force: true }).catch(() => {});
  }
}

export async function exportTerminalThemes(theme, outputDirectory, options = {}) {
  if (typeof outputDirectory !== "string" || !outputDirectory.trim()) {
    throw new Error("Terminal theme output directory is required");
  }
  const directory = path.resolve(outputDirectory);
  const operations = { ...fs, ...(options.fileOperations ?? {}) };
  await operations.mkdir(directory, { recursive: true });
  const manifest = await readManifest(directory, operations);
  const documents = TERMINAL_THEME_SCHEMA.bases.map((mode) => {
    const filename = `claude-aura-${theme.name}-${mode}.json`;
    const contents = documentBytes(buildTerminalTheme(theme, mode));
    return {
      filename,
      filePath: path.join(directory, filename),
      contents,
      digest: digest(contents),
    };
  });

  for (const document of documents) {
    let current;
    try {
      current = await operations.readFile(document.filePath, "utf8");
    } catch (error) {
      if (error.code === "ENOENT") continue;
      throw error;
    }
    if (manifest.files[document.filename] !== digest(current)) {
      throw new Error(`Refusing to overwrite a non-Aura-owned terminal theme: ${document.filename}`);
    }
  }

  for (const document of documents) {
    await atomicWrite(document.filePath, document.contents, operations);
    manifest.files[document.filename] = document.digest;
  }
  const sortedFiles = Object.fromEntries(
    Object.entries(manifest.files).sort(([left], [right]) => left.localeCompare(right)),
  );
  await atomicWrite(manifest.manifestPath, documentBytes({
    schemaVersion: 1,
    files: sortedFiles,
  }), operations);
  return {
    outputDirectory: directory,
    manifestPath: manifest.manifestPath,
    files: documents.map((document) => ({
      path: document.filePath,
      sha256: document.digest,
    })),
  };
}
