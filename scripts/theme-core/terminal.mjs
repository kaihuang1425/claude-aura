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
  ["inactive", "--aura-text-secondary", "--aura-background-primary", 4.5],
  ["subtle", "--aura-text-muted", "--aura-background-primary", 4.5],
  ["suggestion", "--aura-focus-ring", "--aura-background-primary", 3],
  ["permission", "--aura-focus-ring", "--aura-background-primary", 3],
  ["success", "--aura-success", "--aura-background-primary", 3],
  ["error", "--aura-destructive", "--aura-background-primary", 3],
  ["warning", "--aura-warning", "--aura-background-primary", 3],
  ["promptBorder", "--aura-composer-background", "--aura-background-primary", 3],
  ["userMessageBackground", "--aura-composer-background", "--aura-text-primary", 4.5],
  ["diffAdded", "--aura-success", "--aura-text-primary", 4.5],
  ["diffRemoved", "--aura-destructive", "--aura-text-primary", 4.5],
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
