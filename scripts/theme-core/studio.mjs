// Extracted from theme-core.mjs. Public API is re-exported by scripts/theme-core.mjs.
import crypto from "node:crypto";
import { execFile } from "node:child_process";
import { constants as fsConstants } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import {
  FROZEN_BUILTIN_THEME_IDS,
  GREETING_ALIGNMENTS,
  GREETING_COLOR_ROLES,
  GREETING_DECORATIONS,
  GREETING_FONT_CATEGORIES,
  GREETING_FONT_WEIGHTS,
  GREETING_MARK_SOURCES,
  MAX_CHROME_PAYLOAD_BYTES,
  MAX_USER_ARTWORK_TOTAL_BYTES,
  MAX_USER_RASTER_ARTWORK_BYTES,
  PROJECT_ROOT,
  STUDIO_COLOR_TOKENS,
  STUDIO_FONT_DISPLAY_STACKS,
  STUDIO_FONT_UI_STACKS,
  STUDIO_FRAME_CONTENT_START,
  STUDIO_FRAME_VIEWPORTS,
  STUDIO_LAYER_ANCHORS,
  STUDIO_LAYER_APPEARANCES,
  STUDIO_LAYER_CONTEXTS,
  STUDIO_LAYER_MASKS,
  STUDIO_LAYER_MOBILE,
  STUDIO_LAYER_ROLES,
  STUDIO_LAYER_VIEWPORTS,
  STUDIO_MAX_HISTORY,
  STUDIO_MAX_LAYERS,
  STUDIO_MAX_PATCH_CHANGES,
  STUDIO_METADATA_LOCALES,
  STUDIO_RECIPE_CONTROL_OVERRIDES,
  STUDIO_SESSION_PATTERN,
  STUDIO_SHADOWS,
  STUDIO_SHARED_TOKENS,
  STUDIO_STATE_FILENAME,
  STUDIO_THEME_SCHEMA_VERSION,
  THEME_ID_PATTERN,
  THEME_KIT_FILENAME,
  WINDOWS_FILESYSTEM_RETRY_DELAYS_MS,
  WINDOWS_TRANSIENT_FILESYSTEM_CODES,
} from "./constants.mjs";
import {
  BUILTIN_STUDIO_LAYOUT_VALIDATION,
  cloneJson,
  contrastRatio,
  detectImageMime,
  hexToHsl,
  hslToHex,
  isPathWithin,
  isPlainObject,
  normalizeLocale,
  readJson,
  resolveUserThemesDirectory,
  strictEnum,
  strictInteger,
  strictNumber,
  studioRadiusPolicy,
  validateLauncherPngBytes,
  validateNewChatGreetingStyle,
  validateRegistryEntry,
  validateStudioThemeKitDocument,
  validateTheme,
} from "./validation.mjs";
import {
  applyStudioSourceRecipe,
  readConfig,
  readRegisteredTheme,
  readThemeKit,
  readThemeRegistry,
  writeConfig,
} from "./registry.mjs";
import {
  buildPayload,
  buildPayloadFromCompiled,
  compileTheme,
  hasRegisteredGreetingCompactMark,
} from "./compile.mjs";
import {
  resolveGreetingPhrases,
  validateGreetingPreferences,
} from "./greeting.mjs";

const execStudioFile = promisify(execFile);

export function studioUuid() {
  return crypto.randomUUID().toLowerCase();
}

export function studioHex() {
  return crypto.randomBytes(16).toString("hex");
}

export function studioPaths(editorRoot) {
  if (typeof editorRoot !== "string" || !editorRoot.trim()) throw new Error("editorRoot must be a non-empty path");
  const root = path.resolve(editorRoot);
  const active = path.join(root, "active");
  return {
    root,
    active,
    artwork: path.join(active, "artwork"),
    launcherMarks: path.join(active, "launcher-marks"),
    previewRoot: path.join(root, "preview"),
    previewActive: path.join(root, "preview", "active"),
    imports: path.join(root, "imports"),
    state: path.join(active, STUDIO_STATE_FILENAME),
    theme: path.join(active, THEME_KIT_FILENAME),
  };
}

function assertStudioLauncherMarkDigest(digest) {
  if (typeof digest !== "string" || !/^[a-f0-9]{64}$/.test(digest)) {
    throw new Error("Editor launcher mark digest is invalid");
  }
}

async function resolveStudioLauncherMarksDirectory(paths, { create = false } = {}) {
  const [rootStat, activeStat] = await Promise.all([
    pathKind(paths.root),
    pathKind(paths.active),
  ]);
  if (!rootStat?.isDirectory() || rootStat.isSymbolicLink()) {
    throw new Error("Editor data folder must be a regular directory");
  }
  if (!activeStat?.isDirectory() || activeStat.isSymbolicLink()) {
    throw new Error("Editor active folder must be a regular directory");
  }
  const [realRoot, realActive] = await Promise.all([
    fs.realpath(paths.root),
    fs.realpath(paths.active),
  ]);
  if (!isPathWithin(realRoot, realActive)) {
    throw new Error("Editor active folder escaped app-owned data");
  }

  let marksStat = await pathKind(paths.launcherMarks);
  if (!marksStat && create) {
    await fs.mkdir(paths.launcherMarks);
    marksStat = await fs.lstat(paths.launcherMarks);
  }
  if (!marksStat?.isDirectory() || marksStat.isSymbolicLink()) {
    throw new Error("Editor launcher mark storage must be a regular directory, not a symbolic link or junction");
  }
  const realMarks = await fs.realpath(paths.launcherMarks);
  if (!isPathWithin(realActive, realMarks)) {
    throw new Error("Editor launcher mark storage escaped the active theme");
  }
  return { realActive, realMarks };
}

function retainedStudioLauncherMarkDigests(internal) {
  const candidates = [
    internal?.launcherMarkDigest,
    internal?.baselineLauncherMarkDigest,
    internal?.lastValidLauncherMarkDigest,
    ...(Array.isArray(internal?.launcherUndo) ? internal.launcherUndo : []),
    ...(Array.isArray(internal?.launcherRedo) ? internal.launcherRedo : []),
    ...(Array.isArray(internal?.appliedLauncherUndo) ? internal.appliedLauncherUndo : []),
    ...(Array.isArray(internal?.appliedLauncherRedo) ? internal.appliedLauncherRedo : []),
  ];
  const retained = new Set();
  for (const digest of candidates) {
    if (digest === null || digest === undefined) continue;
    assertStudioLauncherMarkDigest(digest);
    retained.add(digest);
  }
  return retained;
}

export async function garbageCollectStudioLauncherMarks(paths, internal) {
  const marksStat = await pathKind(paths.launcherMarks);
  if (!marksStat) return;
  const retained = retainedStudioLauncherMarkDigests(internal);
  const { realMarks } = await resolveStudioLauncherMarksDirectory(paths);
  for (const entry of await fs.readdir(realMarks, { withFileTypes: true })) {
    const match = /^([a-f0-9]{64})\.png$/.exec(entry.name);
    if (!match || retained.has(match[1]) || !entry.isFile() || entry.isSymbolicLink()) continue;
    const candidate = path.join(realMarks, entry.name);
    const candidateStat = await pathKind(candidate);
    if (!candidateStat?.isFile() || candidateStat.isSymbolicLink()) continue;
    const realCandidate = await fs.realpath(candidate);
    if (!isPathWithin(realMarks, realCandidate) || path.dirname(realCandidate) !== realMarks) {
      throw new Error("Stored launcher mark cleanup escaped the launcher mark storage folder");
    }
    await fs.rm(candidate, { force: true });
  }
}

async function collectStudioLauncherMarksAfterCommit(paths, internal) {
  try {
    await garbageCollectStudioLauncherMarks(paths, internal);
  } catch {
    // The theme and editor state are already durable. Cleanup must never make
    // the host retain an old revision and reject every later action as stale.
  }
}

export async function resolveStoredStudioLauncherMark(paths, digest) {
  assertStudioLauncherMarkDigest(digest);
  const { realActive, realMarks } = await resolveStudioLauncherMarksDirectory(paths);
  const source = path.join(paths.launcherMarks, `${digest}.png`);
  const sourceStat = await pathKind(source);
  if (!sourceStat?.isFile() || sourceStat.isSymbolicLink()
      || sourceStat.size <= 0 || sourceStat.size >= MAX_USER_RASTER_ARTWORK_BYTES) {
    throw new Error("Stored launcher mark must be a regular PNG file smaller than 400 KB");
  }
  const realSource = await fs.realpath(source);
  if (!isPathWithin(realActive, realSource) || !isPathWithin(realMarks, realSource)) {
    throw new Error("Stored launcher mark escaped the launcher mark storage folder");
  }
  const resolvedStat = await fs.lstat(realSource);
  if (!resolvedStat.isFile() || resolvedStat.isSymbolicLink()
      || resolvedStat.size <= 0 || resolvedStat.size >= MAX_USER_RASTER_ARTWORK_BYTES) {
    throw new Error("Stored launcher mark must resolve to a regular PNG file smaller than 400 KB");
  }
  const bytes = await fs.readFile(realSource);
  if (bytes.length <= 0 || bytes.length >= MAX_USER_RASTER_ARTWORK_BYTES) {
    throw new Error("Stored launcher mark must be a regular PNG file smaller than 400 KB");
  }
  validateLauncherPngBytes(bytes, "Stored launcher mark");
  if (crypto.createHash("sha256").update(bytes).digest("hex") !== digest) {
    throw new Error("Stored launcher mark digest does not match its contents");
  }
  return { digest, path: realSource, bytes };
}

async function atomicWriteStudioBytes(target, bytes) {
  const temporary = `${target}.tmp-${process.pid}-${studioHex()}`;
  try {
    await fs.writeFile(temporary, bytes, { mode: 0o600, flag: "wx" });
    for (let attempt = 0; ; attempt += 1) {
      try {
        await fs.rename(temporary, target);
        break;
      } catch (error) {
        if (!WINDOWS_TRANSIENT_FILESYSTEM_CODES.includes(error.code)
            || attempt >= WINDOWS_FILESYSTEM_RETRY_DELAYS_MS.length) throw error;
        await new Promise((resolve) => setTimeout(resolve, WINDOWS_FILESYSTEM_RETRY_DELAYS_MS[attempt]));
      }
    }
  } catch (error) {
    await fs.rm(temporary, { force: true }).catch(() => {});
    throw error;
  }
}

export async function storeStudioLauncherMark(sourcePath, paths) {
  const source = path.resolve(sourcePath);
  if (!isPathWithin(paths.root, source)) {
    throw new Error("The launcher mark must remain inside the editor data folder");
  }
  const stat = await fs.lstat(source);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size <= 0 || stat.size >= MAX_USER_RASTER_ARTWORK_BYTES) {
    throw new Error("The launcher mark must be a regular PNG file smaller than 400 KB");
  }
  const [realRoot, realSource] = await Promise.all([fs.realpath(paths.root), fs.realpath(source)]);
  if (!isPathWithin(realRoot, realSource)) {
    throw new Error("The launcher mark must remain inside the editor data folder");
  }
  const bytes = await fs.readFile(realSource);
  validateLauncherPngBytes(bytes, "Studio launcher mark");
  const digest = crypto.createHash("sha256").update(bytes).digest("hex");
  await resolveStudioLauncherMarksDirectory(paths, { create: true });
  const target = path.join(paths.launcherMarks, `${digest}.png`);
  const existing = await pathKind(target);
  if (existing) {
    const stored = await resolveStoredStudioLauncherMark(paths, digest);
    if (!stored.bytes.equals(bytes)) throw new Error("Stored launcher mark digest does not match its contents");
  } else {
    await atomicWriteStudioBytes(target, bytes);
    await resolveStoredStudioLauncherMark(paths, digest);
  }
  return digest;
}

export async function materializeStudioLauncherMark(paths, digest) {
  if (digest === null) return;
  const stored = await resolveStoredStudioLauncherMark(paths, digest);
  const target = path.join(paths.active, "launcher-mark.png");
  const targetStat = await pathKind(target);
  if (targetStat && (!targetStat.isFile() || targetStat.isSymbolicLink())) {
    throw new Error("Editor launcher mark must be a regular file");
  }
  await atomicWriteStudioBytes(target, stored.bytes);
}

function studioDocumentUsesLocalLauncher(document) {
  return document?.theme?.launcher?.asset === "launcher-mark.png";
}

async function initializeStudioLauncherTracking(internal, paths) {
  let currentDigest = typeof internal.launcherMarkDigest === "string" ? internal.launcherMarkDigest : null;
  if (studioDocumentUsesLocalLauncher(internal.currentDocument) && currentDigest === null) {
    currentDigest = await storeStudioLauncherMark(path.join(paths.active, "launcher-mark.png"), paths);
  }
  internal.launcherMarkDigest = studioDocumentUsesLocalLauncher(internal.currentDocument) ? currentDigest : null;
  internal.baselineLauncherMarkDigest = studioDocumentUsesLocalLauncher(internal.baselineDocument)
    ? (typeof internal.baselineLauncherMarkDigest === "string" ? internal.baselineLauncherMarkDigest : currentDigest)
    : null;
  internal.lastValidLauncherMarkDigest = studioDocumentUsesLocalLauncher(internal.lastValidDocument)
    ? (typeof internal.lastValidLauncherMarkDigest === "string" ? internal.lastValidLauncherMarkDigest : currentDigest)
    : null;
  const infer = (document) => studioDocumentUsesLocalLauncher(document) ? currentDigest : null;
  internal.launcherUndo = Array.isArray(internal.launcherUndo) && internal.launcherUndo.length === internal.undo.length
    ? internal.launcherUndo
    : internal.undo.map(infer);
  internal.launcherRedo = Array.isArray(internal.launcherRedo) && internal.launcherRedo.length === internal.redo.length
    ? internal.launcherRedo
    : internal.redo.map(infer);
  const inferApplied = (document) => document && studioDocumentUsesLocalLauncher(document) ? currentDigest : null;
  internal.appliedLauncherUndo = Array.isArray(internal.appliedLauncherUndo)
      && internal.appliedLauncherUndo.length === internal.appliedUndo.length
    ? internal.appliedLauncherUndo
    : internal.appliedUndo.map(inferApplied);
  internal.appliedLauncherRedo = Array.isArray(internal.appliedLauncherRedo)
      && internal.appliedLauncherRedo.length === internal.appliedRedo.length
    ? internal.appliedLauncherRedo
    : internal.appliedRedo.map(inferApplied);
  const trackedDigests = [
    internal.launcherMarkDigest,
    internal.baselineLauncherMarkDigest,
    internal.lastValidLauncherMarkDigest,
    ...internal.launcherUndo,
    ...internal.launcherRedo,
    ...internal.appliedLauncherUndo,
    ...internal.appliedLauncherRedo,
  ];
  for (const digest of trackedDigests) {
    if (digest !== null && (typeof digest !== "string" || !/^[a-f0-9]{64}$/.test(digest))) {
      throw new Error("Editor launcher mark history is invalid");
    }
  }
  for (const digest of new Set(trackedDigests.filter((value) => value !== null))) {
    await resolveStoredStudioLauncherMark(paths, digest);
  }
  if (internal.launcherMarkDigest !== null) await materializeStudioLauncherMark(paths, internal.launcherMarkDigest);
}

export function studioFileOperations(overrides = null) {
  return {
    lstat: overrides?.lstat ?? fs.lstat,
    mkdir: overrides?.mkdir ?? fs.mkdir,
    rename: overrides?.rename ?? fs.rename,
    rm: overrides?.rm ?? fs.rm,
    writeFile: overrides?.writeFile ?? fs.writeFile,
    wait: overrides?.wait,
  };
}

export async function renameStudioPath(source, destination, { fileOperations = fs } = {}) {
  const files = studioFileOperations(fileOperations);
  const wait = typeof files.wait === "function"
    ? files.wait
    : (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
  for (let attempt = 0; ; attempt += 1) {
    try {
      await files.rename(source, destination);
      return;
    } catch (error) {
      if (!WINDOWS_TRANSIENT_FILESYSTEM_CODES.includes(error.code)
          || attempt >= WINDOWS_FILESYSTEM_RETRY_DELAYS_MS.length) throw error;
      await wait(WINDOWS_FILESYSTEM_RETRY_DELAYS_MS[attempt]);
    }
  }
}

export async function pathKind(candidate, fileOperations = fs) {
  try {
    return await (fileOperations.lstat ?? fs.lstat)(candidate);
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

function sameStudioPath(left, right) {
  const normalize = (value) => {
    const resolved = path.resolve(value);
    return process.platform === "win32" ? resolved.toLowerCase() : resolved;
  };
  return normalize(left) === normalize(right);
}

function studioSha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

// This capability is created only from the host-owned CLI switch. The browser
// request never carries a path, and every mutating request rechecks the private
// capability stored in its server context.
async function authorizeBuiltinAuthoringRootInternal(
  value,
  expectedProjectRoot,
  { fileOperations = fs, regenerateStudioThemes = null, generatedPath = null } = {},
) {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string" || !value.trim() || !path.isAbsolute(value)) {
    throw new Error("Built-in authoring requires an absolute source-checkout path");
  }
  const requestedRoot = path.resolve(value);
  const expectedRoot = path.resolve(expectedProjectRoot);
  if (!sameStudioPath(requestedRoot, expectedRoot)) {
    throw new Error("Built-in authoring is restricted to the canonical source checkout");
  }
  const rootStat = await pathKind(requestedRoot, fileOperations);
  if (!rootStat?.isDirectory() || rootStat.isSymbolicLink()) {
    throw new Error("Built-in authoring root must be a real directory");
  }
  const realRoot = await (fileOperations.realpath ?? fs.realpath)(requestedRoot);
  const realExpected = await (fileOperations.realpath ?? fs.realpath)(expectedRoot);
  if (!sameStudioPath(realRoot, realExpected)) {
    throw new Error("Built-in authoring root does not resolve to the canonical source checkout");
  }
  const gitPath = path.join(requestedRoot, ".git");
  const registryPath = path.join(requestedRoot, "themes", "registry.json");
  const [gitStat, registryStat] = await Promise.all([
    pathKind(gitPath, fileOperations),
    pathKind(registryPath, fileOperations),
  ]);
  if (!gitStat?.isDirectory() || gitStat.isSymbolicLink()) {
    throw new Error("Built-in authoring requires a real .git directory");
  }
  if (!registryStat?.isFile() || registryStat.isSymbolicLink()) {
    throw new Error("Built-in authoring requires a real themes/registry.json file");
  }
  const [realGit, realRegistry] = await Promise.all([
    (fileOperations.realpath ?? fs.realpath)(gitPath),
    (fileOperations.realpath ?? fs.realpath)(registryPath),
  ]);
  if (!isPathWithin(realRoot, realGit)
      || !isPathWithin(realRoot, realRegistry)
      || !sameStudioPath(realRegistry, path.join(realRoot, "themes", "registry.json"))) {
    throw new Error("Built-in authoring checkout paths are unsafe");
  }
  const resolvedGeneratedPath = path.resolve(
    generatedPath ?? path.join(realRoot, "studio", "generated-themes.js"),
  );
  if (!isPathWithin(realRoot, resolvedGeneratedPath)) {
    throw new Error("Built-in generated metadata path escaped the source checkout");
  }
  const authority = Object.freeze({
    root: realRoot,
    gitPath: realGit,
    registryPath: realRegistry,
    lockPath: path.join(realGit, "claude-aura-builtin-authoring.lock"),
    transactionPath: path.join(realGit, "claude-aura-builtin-authoring-transaction.json"),
    generatedPath: resolvedGeneratedPath,
    regenerateStudioThemes,
  });
  await recoverBuiltinAuthoringTransaction(authority);
  return authority;
}

export async function authorizeBuiltinAuthoringRoot(value) {
  return authorizeBuiltinAuthoringRootInternal(value, PROJECT_ROOT);
}

export async function resolveStudioUserThemesRoot(value, { create = false } = {}) {
  const requestedRoot = resolveUserThemesDirectory(value);
  if (!requestedRoot) throw new Error("userThemesDir is required for this Studio action");
  let rootStat = await pathKind(requestedRoot);
  if (!rootStat) {
    if (!create) throw new Error("The user themes folder is unavailable");
    await fs.mkdir(requestedRoot, { recursive: true });
    rootStat = await fs.lstat(requestedRoot);
  }
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) {
    throw new Error("The user themes folder must be a regular directory, not a symbolic link or junction");
  }
  const realRoot = await fs.realpath(requestedRoot);
  const realStat = await fs.lstat(realRoot);
  if (!realStat.isDirectory() || realStat.isSymbolicLink()) {
    throw new Error("The user themes folder must resolve to a regular directory");
  }
  return realRoot;
}

export async function assertStudioActivePaths(paths, { requireActive = false, requireState = false } = {}) {
  const rootStat = await pathKind(paths.root);
  if (!rootStat) {
    if (requireActive || requireState) throw new Error("Editor data folder is unavailable");
    return false;
  }
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) throw new Error("Editor data folder must be a regular directory");
  const activeStat = await pathKind(paths.active);
  if (!activeStat) {
    if (requireActive || requireState) throw new Error("Editor active folder is unavailable");
    return false;
  }
  if (!activeStat.isDirectory() || activeStat.isSymbolicLink()) throw new Error("Editor active folder must be a regular directory");
  const realRoot = await fs.realpath(paths.root);
  const realActive = await fs.realpath(paths.active);
  if (!isPathWithin(realRoot, realActive)) throw new Error("Editor active folder escaped app-owned data");
  const artworkStat = await pathKind(paths.artwork);
  if (artworkStat) {
    if (!artworkStat.isDirectory() || artworkStat.isSymbolicLink()) throw new Error("Editor artwork folder must be a regular directory");
    const realArtwork = await fs.realpath(paths.artwork);
    if (!isPathWithin(realActive, realArtwork)) throw new Error("Editor artwork folder escaped the active theme");
  } else if (requireActive) {
    throw new Error("Editor artwork folder is unavailable");
  }
  for (const [candidate, label, required] of [
    [paths.state, "state", requireState],
    [paths.theme, "theme", requireState],
  ]) {
    const stat = await pathKind(candidate);
    if (!stat) {
      if (required) throw new Error(`Editor ${label} file is unavailable`);
      continue;
    }
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`Editor ${label} file must be a regular file`);
    const realFile = await fs.realpath(candidate);
    if (!isPathWithin(realActive, realFile)) throw new Error(`Editor ${label} file escaped the active theme`);
  }
  return true;
}

export async function atomicWriteText(filePath, contents, { fileOperations = fs } = {}) {
  const files = studioFileOperations(fileOperations);
  await files.mkdir(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.tmp-${process.pid}-${studioHex()}`;
  await files.writeFile(temporary, contents, { encoding: "utf8", mode: 0o600, flag: "wx" });
  const wait = typeof files.wait === "function"
    ? files.wait
    : (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
  try {
    for (let attempt = 0; ; attempt += 1) {
      try {
        // Node's rename-over-existing operation is the only publication point:
        // readers see either the old complete file or the new complete file.
        await files.rename(temporary, filePath);
        return;
      } catch (error) {
        if (!WINDOWS_TRANSIENT_FILESYSTEM_CODES.includes(error.code)
            || attempt >= WINDOWS_FILESYSTEM_RETRY_DELAYS_MS.length) throw error;
        await wait(WINDOWS_FILESYSTEM_RETRY_DELAYS_MS[attempt]);
      }
    }
  } catch (error) {
    try {
      await files.rm(temporary, { force: true });
    } catch (cleanupError) {
      throw new AggregateError(
        [error, cleanupError],
        `Atomic write failed and its unpublished temporary file could not be removed: ${filePath}`,
      );
    }
    throw error;
  }
}

export async function atomicWriteJson(filePath, value) {
  await atomicWriteText(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

export function emptyStudioFeedback() {
  return {
    valid: true,
    contrast: { light: [], dark: [] },
    budget: {
      chromeBytes: 0,
      chromeLimit: MAX_CHROME_PAYLOAD_BYTES,
      embeddedArtworkBytes: 0,
      embeddedArtworkLimit: MAX_USER_ARTWORK_TOTAL_BYTES,
      sourceArtworkBytes: 0,
      sourceArtworkLimit: MAX_USER_ARTWORK_TOTAL_BYTES,
      layers: [],
      pass: true,
    },
    errors: [],
  };
}

export function studioFontId(stack, choices, fallback) {
  return Object.entries(choices).find(([, value]) => value === stack)?.[0] ?? fallback;
}

export function studioShadowId(effects) {
  return Object.entries(STUDIO_SHADOWS)
    .find(([, value]) => value.shadowSoft === effects.shadowSoft && value.shadowElevated === effects.shadowElevated)?.[0] ?? "soft";
}

async function readStudioArtworkDimensions(activeDirectory, layerPath, label) {
  const source = path.resolve(activeDirectory, layerPath);
  if (!isPathWithin(activeDirectory, source)) throw new Error("Editor artwork escaped the active theme folder");
  const stat = await fs.lstat(source);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error("Editor artwork must be a regular file");
  const [realActive, realSource] = await Promise.all([
    fs.realpath(activeDirectory),
    fs.realpath(source),
  ]);
  if (!isPathWithin(realActive, realSource)) {
    throw new Error("Editor artwork escaped the active theme folder");
  }
  return studioWebpDimensions(await fs.readFile(realSource), label);
}

export async function studioLayerBytes(document, activeDirectory) {
  const result = [];
  for (const layer of document.artworkLayers) {
    const filePath = path.resolve(activeDirectory, layer.path);
    if (!isPathWithin(activeDirectory, filePath)) throw new Error("Editor artwork escaped the active theme folder");
    const stat = await fs.lstat(filePath);
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error("Editor artwork must be a regular file");
    result.push(stat.size);
  }
  return result;
}

export async function ensureStudioPreviewDirectory(paths) {
  for (const candidate of [paths.root, paths.previewRoot, paths.previewActive]) {
    const existing = await pathKind(candidate);
    if (existing && (!existing.isDirectory() || existing.isSymbolicLink())) {
      throw new Error("Editor preview folders must be regular app-owned directories");
    }
    if (!existing) await fs.mkdir(candidate);
  }
  const [realRoot, realPreview] = await Promise.all([fs.realpath(paths.root), fs.realpath(paths.previewActive)]);
  if (!isPathWithin(realRoot, realPreview)) throw new Error("Editor preview folder escaped the app-owned data directory");
}

export function canonicalStudioTokens(document, mode) {
  const semantic = document.theme[mode].semantic;
  return {
    canvas: hslToHex(semantic[STUDIO_COLOR_TOKENS.canvas]),
    sidebar: hslToHex(semantic[STUDIO_COLOR_TOKENS.sidebar]),
    surface: hslToHex(semantic[STUDIO_COLOR_TOKENS.surface]),
    text: hslToHex(semantic[STUDIO_COLOR_TOKENS.text]),
    accent: hslToHex(semantic[STUDIO_COLOR_TOKENS.accent]),
    border: hslToHex(semantic[STUDIO_COLOR_TOKENS.border]),
    surfaceAlpha: document.theme[mode].wallpaper.surfaceAlpha,
    sidebarAlpha: document.theme[mode].wallpaper.sidebarAlpha,
  };
}

const STUDIO_STYLE_COLOR_TOKENS = Object.freeze({
  canvas: "--aura-background-primary",
  sidebar: "--aura-sidebar-background",
  surface: "--aura-panel-background",
  raised: "--aura-elevated-surface",
  text: "--aura-text-primary",
  textSecondary: "--aura-text-secondary",
  textMuted: "--aura-text-muted",
  sidebarText: "--aura-sidebar-text-primary",
  sidebarTextMuted: "--aura-sidebar-text-muted",
  accent: "--aura-accent-primary",
  accentText: "--aura-text-on-accent",
  border: "--aura-border-emphasis",
  focus: "--aura-focus-ring",
});

export function studioStyleFromTheme(theme) {
  const modeStyle = (mode) => {
    const semantic = theme[mode].semantic;
    return {
      ...Object.fromEntries(Object.entries(STUDIO_STYLE_COLOR_TOKENS)
        .map(([name, token]) => [name, hslToHex(semantic[token])])),
      surfaceAlpha: theme[mode].wallpaper.surfaceAlpha,
      sidebarAlpha: theme[mode].wallpaper.sidebarAlpha,
    };
  };
  return {
    light: modeStyle("light"),
    dark: modeStyle("dark"),
    shared: {
      fontUi: studioFontId(theme.typography.ui, STUDIO_FONT_UI_STACKS, "system-sans"),
      fontDisplay: studioFontId(theme.typography.display, STUDIO_FONT_DISPLAY_STACKS, "system-sans"),
      radius: theme.shape.card,
      blur: theme.blur,
      shadow: studioShadowId(theme.effects),
    },
  };
}

// WO-21 Studio greeting editing. The portable theme owns a full Light/Dark x
// Standard/Wide matrix. Studio projects every frame so changing the preview axes
// edits only the frame the user can currently see; `null` remains Claude-native.
export function defaultStudioGreetingStyle() {
  const frame = () => ({
    font: "editorial-serif",
    color: "primary",
    fontSize: 34,
    weight: 500,
    italic: false,
    letterSpacing: -0.01,
    lineHeight: 1.15,
    align: "center",
    maxWidthRatio: 0.72,
    xRatio: 0,
    yRatio: 0,
    decoration: "none",
    mark: { source: "native", scale: 1 },
  });
  return {
    light: { standard: frame(), wide: frame() },
    dark: { standard: frame(), wide: frame() },
  };
}

export function studioGreetingFrameState(frame) {
  return {
    font: frame.font,
    color: frame.color,
    fontSize: frame.fontSize,
    weight: frame.weight,
    italic: frame.italic,
    align: frame.align,
    letterSpacing: frame.letterSpacing,
    lineHeight: frame.lineHeight,
    maxWidthRatio: frame.maxWidthRatio,
    xRatio: frame.xRatio,
    yRatio: frame.yRatio,
    decoration: frame.decoration,
    markSource: frame.mark.source,
    markScale: frame.mark.scale,
  };
}

export function studioGreetingState(style, compactMarkAvailable = false) {
  const matrix = style ?? defaultStudioGreetingStyle();
  return {
    native: style === null,
    compactMarkAvailable: Boolean(compactMarkAvailable),
    frames: Object.fromEntries(["light", "dark"].map((appearance) => [
      appearance,
      Object.fromEntries(["standard", "wide"].map((frame) => [
        frame,
        studioGreetingFrameState(matrix[appearance][frame]),
      ])),
    ])),
  };
}

// Compact greeting marks are intentionally limited to frozen, registered recipe
// assets. A duplicated built-in retains its sourceRecipe and therefore retains
// the capability; a free-form custom theme never guesses an image's semantics.
export function studioGreetingCompactMarkAvailable(document) {
  return hasRegisteredGreetingCompactMark({
    sourceRecipe: document.sourceRecipe,
    variant: document.theme?.variant,
    name: document.id,
  });
}

const STUDIO_GREETING_NUMERIC_FIELDS = Object.freeze({
  fontSize: [24, 72],
  letterSpacing: [-0.06, 0.12],
  lineHeight: [0.9, 1.5],
  maxWidthRatio: [0.35, 0.9],
  xRatio: [-0.45, 0.45],
  yRatio: [-0.4, 0.45],
});
const STUDIO_GREETING_ENUM_FIELDS = Object.freeze({
  font: GREETING_FONT_CATEGORIES,
  color: GREETING_COLOR_ROLES,
  align: GREETING_ALIGNMENTS,
  decoration: GREETING_DECORATIONS,
});

const STUDIO_GREETING_FRAME_KEYS = Object.freeze([
  "font", "color", "fontSize", "weight", "italic", "align", "letterSpacing",
  "lineHeight", "maxWidthRatio", "xRatio", "yRatio", "decoration", "markSource", "markScale",
]);

export function validateStudioGreetingFrame(value, label = "greeting frame") {
  if (!isPlainObject(value)
      || Object.keys(value).length !== STUDIO_GREETING_FRAME_KEYS.length
      || STUDIO_GREETING_FRAME_KEYS.some((key) => !Object.hasOwn(value, key))) {
    throw new Error(`${label} has an invalid shape`);
  }
  const frame = {
    font: strictEnum(value.font, GREETING_FONT_CATEGORIES, `${label}.font`),
    color: strictEnum(value.color, GREETING_COLOR_ROLES, `${label}.color`),
    fontSize: strictNumber(value.fontSize, `${label}.fontSize`, 24, 72),
    weight: value.weight,
    italic: value.italic,
    align: strictEnum(value.align, GREETING_ALIGNMENTS, `${label}.align`),
    letterSpacing: strictNumber(value.letterSpacing, `${label}.letterSpacing`, -0.06, 0.12),
    lineHeight: strictNumber(value.lineHeight, `${label}.lineHeight`, 0.9, 1.5),
    maxWidthRatio: strictNumber(value.maxWidthRatio, `${label}.maxWidthRatio`, 0.35, 0.9),
    xRatio: strictNumber(value.xRatio, `${label}.xRatio`, -0.45, 0.45),
    yRatio: strictNumber(value.yRatio, `${label}.yRatio`, -0.4, 0.45),
    decoration: strictEnum(value.decoration, GREETING_DECORATIONS, `${label}.decoration`),
    mark: {
      source: strictEnum(value.markSource, GREETING_MARK_SOURCES, `${label}.markSource`),
      scale: strictNumber(value.markScale, `${label}.markScale`, 0.5, 1.5),
    },
  };
  if (!GREETING_FONT_WEIGHTS.has(frame.weight)) {
    throw new Error(`${label}.weight has an unsupported value`);
  }
  if (typeof frame.italic !== "boolean") throw new Error(`${label}.italic must be true or false`);
  return frame;
}

// One pointer/keyboard/control gesture replaces one complete bounded frame and
// therefore creates one coherent Undo entry. Reset is the only operation that
// may carry null and always restores the entire greeting surface to Claude.
export function mutateStudioGreetingDocument(document, change) {
  const operation = strictEnum(change.operation, new Set(["set-frame", "reset"]), "greeting operation");
  const appearance = strictEnum(change.appearance, new Set(["light", "dark"]), "greeting appearance");
  const frame = strictEnum(change.frame, new Set(["standard", "wide"]), "greeting frame");
  if (operation === "reset") {
    if (change.value !== null) throw new Error("Greeting reset value must be null");
    document.newChatGreetingStyle = null;
    return;
  }
  const style = document.newChatGreetingStyle ?? defaultStudioGreetingStyle();
  style[appearance][frame] = validateStudioGreetingFrame(
    change.value,
    `newChatGreetingStyle.${appearance}.${frame}`,
  );
  document.newChatGreetingStyle = validateNewChatGreetingStyle(style, "newChatGreetingStyle");
}

async function effectiveStudioDocumentTheme(document) {
  return applyStudioSourceRecipe(document.theme, {
    source: "user",
    sourceRecipe: document.sourceRecipe,
    controlOverrides: document.controlOverrides,
  });
}

// WO-21: the personal greeting envelope is host-owned config, never theme data.
// Studio keeps a private history aligned with the theme draft, but personal words
// never enter the portable theme document or a kit export.
export async function studioGreetingPreferences(configPath) {
  const fallback = validateGreetingPreferences(null);
  if (typeof configPath !== "string" || !configPath.trim()) return fallback;
  try {
    const config = await readConfig(configPath);
    return validateGreetingPreferences(config.greetingPreferences ?? null);
  } catch {
    // Invalid personal data must never block theme editing; the renderer fails open
    // to Claude's native greeting the same way.
    return fallback;
  }
}

// Runtime compilation intentionally fails open to Claude's native greeting when
// custom words cannot produce one complete bounded payload. Studio has a
// different responsibility: an actively selected custom candidate must remain
// invalid so Save cannot silently turn the user's wording back into native
// wording. Keep that distinction in one pure predicate for focused regression
// coverage as well as the transactional evaluator.
export function studioGreetingPreferenceError(preferences, themeId) {
  const value = validateGreetingPreferences(preferences);
  const override = value.themeOverrides[themeId] ?? null;
  const requestsCustom = value.enabled
    && value.source === "custom"
    && override?.mode !== "claude";
  return requestsCustom && resolveGreetingPhrases(value, themeId) === null
    ? { code: "invalid-greeting", field: "greetingPreferences" }
    : null;
}

function initializeStudioGreetingTracking(internal, preferences) {
  if (internal.greetingCurrent !== undefined) return false;
  const value = cloneJson(validateGreetingPreferences(preferences));
  internal.greetingBaseline = cloneJson(value);
  internal.greetingCurrent = cloneJson(value);
  internal.greetingLastValid = cloneJson(value);
  internal.greetingUndo = internal.undo.map(() => cloneJson(value));
  internal.greetingRedo = internal.redo.map(() => cloneJson(value));
  internal.greetingAppliedUndo = internal.appliedUndo.map(() => cloneJson(value));
  internal.greetingAppliedRedo = internal.appliedRedo.map(() => cloneJson(value));
  return true;
}

async function ensureStudioGreetingTracking(internal, configPath) {
  const preferences = await studioGreetingPreferences(configPath);
  const initialized = initializeStudioGreetingTracking(internal, preferences);
  for (const [name, history, length] of [
    ["undo", internal.greetingUndo, internal.undo.length],
    ["redo", internal.greetingRedo, internal.redo.length],
    ["applied undo", internal.greetingAppliedUndo, internal.appliedUndo.length],
    ["applied redo", internal.greetingAppliedRedo, internal.appliedRedo.length],
  ]) {
    if (!Array.isArray(history) || history.length !== length) {
      throw new Error(`Editor greeting ${name} history is invalid`);
    }
  }
  for (const [name, value] of [
    ["baseline", internal.greetingBaseline],
    ["current", internal.greetingCurrent],
    ["last valid", internal.greetingLastValid],
    ...internal.greetingUndo.map((value, index) => [`undo ${index}`, value]),
    ...internal.greetingRedo.map((value, index) => [`redo ${index}`, value]),
    ...internal.greetingAppliedUndo.map((value, index) => [`applied undo ${index}`, value]),
    ...internal.greetingAppliedRedo.map((value, index) => [`applied redo ${index}`, value]),
  ]) validateGreetingPreferences(value, `editor greeting ${name}`);
  return initialized;
}

export async function canonicalStudioState(internal, editorRoot, configPath = null) {
  if (!internal) return { active: false };
  const paths = studioPaths(editorRoot);
  await assertStudioActivePaths(paths, { requireActive: true, requireState: true });
  await initializeStudioLauncherTracking(internal, paths);
  await ensureStudioGreetingTracking(internal, configPath);
  const document = internal.currentDocument;
  const effectiveDocumentTheme = await effectiveStudioDocumentTheme(document);
  const effectiveLastValidTheme = await effectiveStudioDocumentTheme(internal.lastValidDocument);
  const bytes = await studioLayerBytes(document, paths.active);
  await ensureStudioPreviewDirectory(paths);
  const previews = [];
  for (let index = 0; index < document.artworkLayers.length; index += 1) {
    const source = path.resolve(paths.active, document.artworkLayers[index].path);
    const contents = await fs.readFile(source);
    const digest = crypto.createHash("sha256").update(contents).digest("hex");
    const filename = `layer-${digest.slice(0, 32)}.webp`;
    const target = path.join(paths.previewActive, filename);
    const existingPreview = await pathKind(target);
    if (existingPreview && (!existingPreview.isFile() || existingPreview.isSymbolicLink())) {
      throw new Error("Editor preview files must be regular app-owned files");
    }
    if (!existingPreview) await fs.copyFile(source, target, fsConstants.COPYFILE_EXCL);
    previews.push({ digest, filename });
  }
  const retained = new Set(previews.map((item) => item.filename));
  const launcherPreviewUrl = async (launcher, digest) => {
    const builtIn = /^assets\/theme-art\/(default|japanese-film-editorial|korean-prestige|cartoon-studio|anime-twilight|study-library|japanese-idol|korean-idol)\/launcher-mark\.png$/.exec(
      launcher?.asset ?? "",
    );
    if (builtIn) return `https://aura.assets/${builtIn[1]}/launcher-mark.png`;
    if (launcher?.asset !== "launcher-mark.png" || typeof digest !== "string" || !/^[a-f0-9]{64}$/.test(digest)) {
      throw new Error("Editor launcher preview identity is invalid");
    }
    const filename = `launcher-${digest}.png`;
    const stored = await resolveStoredStudioLauncherMark(paths, digest);
    const target = path.join(paths.previewActive, filename);
    const existingPreview = await pathKind(target);
    if (existingPreview && (!existingPreview.isFile() || existingPreview.isSymbolicLink())) {
      throw new Error("Editor launcher previews must be regular app-owned files");
    }
    let repairPreview = !existingPreview;
    if (existingPreview) {
      const [realPreviewRoot, realPreviewFile] = await Promise.all([
        fs.realpath(paths.previewActive),
        fs.realpath(target),
      ]);
      if (!isPathWithin(realPreviewRoot, realPreviewFile)) {
        throw new Error("Editor launcher preview escaped the app-owned preview folder");
      }
      if (existingPreview.size <= 0 || existingPreview.size >= MAX_USER_RASTER_ARTWORK_BYTES) {
        repairPreview = true;
      } else {
        try {
          const previewBytes = await fs.readFile(realPreviewFile);
          validateLauncherPngBytes(previewBytes, "Editor launcher preview");
          repairPreview = crypto.createHash("sha256").update(previewBytes).digest("hex") !== digest
            || !previewBytes.equals(stored.bytes);
        } catch {
          repairPreview = true;
        }
      }
    }
    if (repairPreview) await atomicWriteStudioBytes(target, stored.bytes);
    retained.add(filename);
    return `https://aura.editor/active/${filename}`;
  };
  const currentLauncherPreviewUrl = await launcherPreviewUrl(document.theme.launcher, internal.launcherMarkDigest);
  const appliedLauncherPreviewUrl = await launcherPreviewUrl(
    internal.lastValidDocument.theme.launcher,
    internal.lastValidLauncherMarkDigest,
  );
  for (const entry of await fs.readdir(paths.previewActive, { withFileTypes: true })) {
    if (entry.isFile() && /^layer-[a-f0-9]{32}\.webp$/.test(entry.name) && !retained.has(entry.name)) {
      await fs.rm(path.join(paths.previewActive, entry.name), { force: true });
    }
    if (entry.isFile() && /^launcher-[a-f0-9]{64}\.png$/.test(entry.name) && !retained.has(entry.name)) {
      await fs.rm(path.join(paths.previewActive, entry.name), { force: true });
    }
  }
  const layers = document.artworkLayers.map((layer, index) => {
    const preview = previews[index];
    return {
      id: layer.id,
      index,
      role: layer.role,
      appearance: layer.appearance,
      context: layer.context,
      viewport: layer.viewport,
      visible: layer.visible,
      opacity: layer.opacity,
      mask: layer.mask,
      mobile: layer.mobile,
      bytes: bytes[index],
      previewUrl: `https://aura.editor/active/${preview.filename}?v=${preview.digest}`,
      frames: cloneJson(layer.frames),
    };
  });
  const nativePrompt = document.newChatLayout === null;
  const layout = document.newChatLayout ?? { widthRatio: 0.76, offsetXRatio: 0, offsetYRatio: 0 };
  const currentLabel = document.labels[internal.locale]?.trim()
    || document.labels.en?.trim()
    || internal.lastValidDocument.labels[internal.locale]?.trim()
    || internal.lastValidDocument.labels.en;
  return {
    active: true,
    id: internal.id,
    sourceId: internal.sourceId,
    source: internal.source,
    isNew: internal.isNew,
    editKind: internal.editKind ?? null,
    session: internal.session,
    revision: internal.revision,
    dirty: JSON.stringify(internal.currentDocument) !== JSON.stringify(internal.baselineDocument)
      || internal.launcherMarkDigest !== internal.baselineLauncherMarkDigest
      || JSON.stringify(internal.greetingCurrent) !== JSON.stringify(internal.greetingBaseline),
    canUndo: internal.undo.length > 0,
    canRedo: internal.redo.length > 0,
    label: currentLabel,
    metadata: {
      labels: cloneJson(document.labels),
      descriptions: cloneJson(document.descriptions),
    },
    tokens: {
      light: canonicalStudioTokens(document, "light"),
      dark: canonicalStudioTokens(document, "dark"),
    },
    // Aura keeps rendering the last valid draft when the current document has
    // a contrast or budget error. Studio must show that same applied style,
    // including after its WebView is reopened mid-error.
    studioStyle: studioStyleFromTheme(effectiveLastValidTheme),
    launcher: cloneJson(document.theme.launcher),
    launcherStyle: cloneJson(internal.lastValidDocument.theme.launcher),
    launcherPreviewUrl: currentLauncherPreviewUrl,
    launcherStylePreviewUrl: appliedLauncherPreviewUrl,
    shared: {
      fontUi: studioFontId(effectiveDocumentTheme.typography.ui, STUDIO_FONT_UI_STACKS, "system-sans"),
      fontDisplay: studioFontId(effectiveDocumentTheme.typography.display, STUDIO_FONT_DISPLAY_STACKS, "system-sans"),
      radius: effectiveDocumentTheme.shape.card,
      blur: effectiveDocumentTheme.blur,
      shadow: studioShadowId(effectiveDocumentTheme.effects),
      backgroundScope: document.backgroundScope,
      prompt: {
        native: nativePrompt,
        width: layout.widthRatio,
        x: layout.offsetXRatio,
        y: layout.offsetYRatio,
      },
      greeting: studioGreetingState(
        document.newChatGreetingStyle,
        studioGreetingCompactMarkAvailable(document),
      ),
      inherited: Object.fromEntries(["fontUi", "fontDisplay", "radius", "shadow"]
        .map((token) => [
          token,
          document.sourceRecipe !== null && !document.controlOverrides.includes(token),
        ])),
    },
    greetingPreferences: cloneJson(internal.greetingCurrent),
    layers,
    feedback: cloneJson(internal.feedback ?? emptyStudioFeedback()),
  };
}

export function withStudioResult(state, action, succeeded, error = null) {
  return { ...state, lastAction: action, actionSucceeded: succeeded, error };
}

export function studioContrastFeedback(theme) {
  const checks = [
    ["canvas-text", "--aura-text-primary", "--aura-background-primary", 7],
    ["surface-text", "--aura-text-secondary", "--aura-panel-background", 4.5],
    ["muted-text", "--aura-text-muted", "--aura-panel-background", 4.5],
    ["accent-outline", "--aura-accent-primary", "--aura-background-primary", 3],
    ["accent-text", "--aura-text-on-accent", "--aura-accent-primary", 4.5],
    ["sidebar-text", "--aura-sidebar-text-primary", "--aura-sidebar-background", 7],
    ["focus", "--aura-focus-ring", "--aura-background-primary", 3],
  ];
  const result = { light: [], dark: [] };
  for (const mode of ["light", "dark"]) {
    const tokens = theme[mode].semantic;
    result[mode] = checks.map(([id, foreground, background, minimum]) => {
      const ratio = Math.round(contrastRatio(tokens[foreground], tokens[background]) * 100) / 100;
      return { id, ratio, minimum, pass: ratio >= minimum };
    });
  }
  return result;
}

export async function persistStudioInternal(paths, internal, { collectLauncherMarks = true } = {}) {
  await assertStudioActivePaths(paths, { requireActive: true });
  await atomicWriteJson(paths.theme, internal.currentDocument);
  await atomicWriteJson(paths.state, internal);
  await assertStudioActivePaths(paths, { requireActive: true, requireState: true });
  if (collectLauncherMarks) await collectStudioLauncherMarksAfterCommit(paths, internal);
}

async function upgradeStudioLegacyFrames(document, paths) {
  let changed = false;
  const dimensions = new Map();
  for (const layer of document.artworkLayers) {
    if (!layer.legacy) continue;
    let image = dimensions.get(layer.path);
    if (!image) {
      image = await readStudioArtworkDimensions(
        paths.active,
        layer.path,
        `Editor artwork ${layer.path}`,
      );
      dimensions.set(layer.path, image);
    }
    const frames = Object.fromEntries(Object.entries(STUDIO_FRAME_VIEWPORTS).map(([preset, viewport]) => [
      preset,
      studioFrameFromLegacy(
        layer.legacy.position,
        layer.legacy.size,
        image,
        viewport,
        document.backgroundScope,
      ),
    ]));
    if (JSON.stringify(layer.frames) !== JSON.stringify(frames)) {
      layer.frames = frames;
      changed = true;
    }
  }
  return changed;
}

async function upgradeStudioSchemaV1Document(raw, label, paths) {
  const entry = validateRegistryEntry(raw, label, { source: "user" });
  if (!isPlainObject(raw.theme)) throw new Error(`${label}.theme must be an object`);
  if (raw.theme.variant !== entry.id) {
    throw new Error(`${label}.theme.variant must match id "${entry.id}"`);
  }
  const validatedTheme = validateTheme(raw.theme, `${label}.theme`, {
    // Current and history entries may intentionally contain an invalid-but-editable
    // launcher draft. The last-valid snapshots still govern what Aura applies.
    enforceLauncherContrast: false,
  });
  if (validatedTheme.name !== entry.id) {
    throw new Error(`${label}.theme.name must match id "${entry.id}"`);
  }
  if (validatedTheme.customCss.trim()) {
    throw new Error(`${label}.theme.customCss must be empty in a standalone kit`);
  }
  const theme = {
    ...validatedTheme,
    label: entry.labels.en,
    description: entry.descriptions.en,
    labels: cloneJson(entry.labels),
    descriptions: cloneJson(entry.descriptions),
    swatches: cloneJson(entry.swatches),
    preview: cloneJson(entry.preview),
    studioPreview: entry.studioPreview,
    studioPreviewFrame: entry.studioPreviewFrame ? cloneJson(entry.studioPreviewFrame) : null,
    newChatLayout: entry.newChatLayout ? cloneJson(entry.newChatLayout) : null,
    // Schema v1 predates portable greeting presentation. Personal greeting data
    // is never accepted here and therefore cannot migrate into a theme document.
    newChatGreetingStyle: null,
    artwork: entry.artwork ? cloneJson(entry.artwork) : null,
    artworkLayers: entry.artworkLayers ? cloneJson(entry.artworkLayers) : null,
    schemaVersion: 1,
    backgroundScope: "full-window",
    sourceRecipe: null,
    controlOverrides: [],
    source: "user",
    sourceDirectory: paths.active,
    artworkRoot: paths.active,
    artworkAllowedRoot: paths.active,
  };
  return studioDocumentFromResolvedSource({
    entry: { ...entry, source: "user" },
    theme,
    targetId: entry.id,
    paths,
    copyLabels: false,
    reuseActiveFiles: true,
  });
}

async function validateAndUpgradeStudioDocuments(internal, paths) {
  if (!Array.isArray(internal.undo) || !Array.isArray(internal.redo)
      || internal.undo.length > STUDIO_MAX_HISTORY || internal.redo.length > STUDIO_MAX_HISTORY) {
    throw new Error("Editor history is invalid");
  }
  let changed = internal.version !== 2;
  const initializeAppliedHistory = (property, length) => {
    if (internal[property] === undefined) {
      internal[property] = Array.from({ length }, () => null);
      changed = true;
      return;
    }
    if (!Array.isArray(internal[property]) || internal[property].length !== length) {
      throw new Error("Editor applied-theme history is invalid");
    }
  };
  initializeAppliedHistory("appliedUndo", internal.undo.length);
  initializeAppliedHistory("appliedRedo", internal.redo.length);
  const documents = [
    ["baseline", internal.baselineDocument],
    ["current", internal.currentDocument],
    ["last valid", internal.lastValidDocument],
    ...internal.undo.map((document, index) => [`undo ${index}`, document]),
    ...internal.redo.map((document, index) => [`redo ${index}`, document]),
    ...internal.appliedUndo.map((document, index) => [`applied undo ${index}`, document])
      .filter(([, document]) => document !== null),
    ...internal.appliedRedo.map((document, index) => [`applied redo ${index}`, document])
      .filter(([, document]) => document !== null),
  ];
  const builtinLayoutCapability = internal.editKind === "builtin-layout"
    ? BUILTIN_STUDIO_LAYOUT_VALIDATION
    : null;
  for (const [name, document] of documents) {
    if (document?.schemaVersion === 1) {
      const upgraded = await upgradeStudioSchemaV1Document(document, `editor ${name} theme`, paths);
      for (const key of Object.keys(document)) delete document[key];
      Object.assign(document, upgraded);
      changed = true;
    }
    const allowIncompleteMetadata = name === "current"
      || name.startsWith("undo ")
      || name.startsWith("redo ");
    validateStudioThemeKitDocument(document, `editor ${name} theme`, {
      // Invalid-but-editable drafts are persisted deliberately so Studio can
      // keep the last-valid payload active while the user repairs them.
      enforceLauncherContrast: false,
      builtinLayoutCapability,
      allowIncompleteMetadata,
    });
    if (document.id !== internal.id) throw new Error(`Editor ${name} theme id does not match the session`);
    changed = await upgradeStudioLegacyFrames(document, paths) || changed;
    // WO-21: normalize pre-greeting (v2) documents up to the current schema. The
    // greeting surface starts Claude-native (null); personal phrases stay
    // host-owned and never enter the theme document.
    if (!Object.hasOwn(document, "newChatGreetingStyle")) {
      document.newChatGreetingStyle = null;
      changed = true;
    }
    if (document.schemaVersion !== STUDIO_THEME_SCHEMA_VERSION) {
      document.schemaVersion = STUDIO_THEME_SCHEMA_VERSION;
      changed = true;
    }
    validateStudioThemeKitDocument(document, `editor ${name} theme`, {
      enforceLauncherContrast: false,
      builtinLayoutCapability,
      allowIncompleteMetadata,
    });
  }
  internal.version = 2;
  return changed;
}

export async function loadStudioInternal(editorRoot) {
  const paths = studioPaths(editorRoot);
  const activeExists = await assertStudioActivePaths(paths);
  if (!activeExists) return null;
  try {
    const internal = await readJson(paths.state);
    if (!isPlainObject(internal) || ![1, 2].includes(internal.version) || !STUDIO_SESSION_PATTERN.test(internal.session ?? "")) {
      throw new Error("Editor state is invalid");
    }
    internal.locale = normalizeLocale(internal.locale);
    internal.editKind = internal.editKind ?? null;
    if (![null, "builtin-layout"].includes(internal.editKind)) {
      throw new Error("Editor edit kind is invalid");
    }
    if (internal.editKind === "builtin-layout"
        && (internal.source !== "builtin"
          || internal.isNew !== false
          || !FROZEN_BUILTIN_THEME_IDS.has(internal.id)
          || typeof internal.registrySha256 !== "string"
          || !/^[a-f0-9]{64}$/.test(internal.registrySha256)
          || !isPlainObject(internal.sourceSnapshot))) {
      throw new Error("Built-in layout editor state is invalid");
    }
    if (internal.editKind === "builtin-layout") {
      internal.sourceSnapshot = validateBuiltinSourceSnapshot(internal.sourceSnapshot);
    }
    internal.undo = Array.isArray(internal.undo) ? internal.undo : [];
    internal.redo = Array.isArray(internal.redo) ? internal.redo : [];
    const migrated = await validateAndUpgradeStudioDocuments(internal, paths);
    await initializeStudioLauncherTracking(internal, paths);
    if (migrated) {
      await atomicWriteJson(paths.theme, internal.currentDocument);
      await atomicWriteJson(paths.state, internal);
    }
    return internal;
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

export function assertStudioRevision(internal, request) {
  if (!internal) throw new Error("No theme edit is active");
  if (request.session !== internal.session) throw new Error("The theme edit session is stale");
  if (!Number.isSafeInteger(request.revision) || request.revision !== internal.revision) {
    throw new Error("The theme edit revision is stale");
  }
}

function splitStudioCssValue(value, separator = "space") {
  const result = [];
  let depth = 0;
  let current = "";
  const flush = () => {
    const item = current.trim();
    if (item) result.push(item);
    current = "";
  };
  for (const character of String(value ?? "")) {
    if (character === "(") depth += 1;
    else if (character === ")") depth = Math.max(0, depth - 1);
    const boundary = depth === 0 && (separator === "comma" ? character === "," : /\s/u.test(character));
    if (boundary) flush();
    else current += character;
  }
  flush();
  return result;
}

function studioLegacyLength(value, axisLength, viewport) {
  const source = String(value ?? "").trim().toLowerCase();
  if (!source || source === "auto") return null;
  const unit = /^(-?\d+(?:\.\d+)?)(px|%|vw|vh)$/u.exec(source);
  if (unit) {
    const number = Number(unit[1]);
    if (!Number.isFinite(number) || number < 0) return null;
    if (unit[2] === "px") return number;
    if (unit[2] === "%") return axisLength * number / 100;
    if (unit[2] === "vw") return viewport.width * number / 100;
    return viewport.height * number / 100;
  }
  const expression = /^(min|max|clamp)\((.*)\)$/u.exec(source);
  if (!expression) return null;
  const values = splitStudioCssValue(expression[2], "comma")
    .map((part) => studioLegacyLength(part, axisLength, viewport));
  if (values.some((part) => part === null)) return null;
  if (expression[1] === "min" && values.length >= 1) return Math.min(...values);
  if (expression[1] === "max" && values.length >= 1) return Math.max(...values);
  if (expression[1] === "clamp" && values.length === 3) {
    return Math.min(values[2], Math.max(values[0], values[1]));
  }
  return null;
}

function studioLegacyScale(size, image, viewport, backgroundScope) {
  if (!image || !viewport || image.width <= 0 || image.height <= 0
      || viewport.width <= 0 || viewport.height <= 0) return 1;
  const container = {
    width: backgroundScope === "sidebar"
      ? Math.min(STUDIO_FRAME_CONTENT_START, viewport.width)
      : backgroundScope === "content"
        ? Math.max(1, viewport.width - STUDIO_FRAME_CONTENT_START)
        : viewport.width,
    height: viewport.height,
  };
  const normalized = String(size ?? "").trim().toLowerCase();
  let scale = 1;
  if (normalized === "cover") {
    scale = Math.max(container.width / image.width, container.height / image.height);
  } else if (normalized === "contain") {
    scale = Math.min(container.width / image.width, container.height / image.height);
  } else {
    const parts = splitStudioCssValue(normalized);
    if (parts.length >= 1 && parts.length <= 2) {
      const width = studioLegacyLength(parts[0], container.width, viewport);
      const height = studioLegacyLength(parts[1] ?? "auto", container.height, viewport);
      if (width !== null && height === null) scale = width / image.width;
      else if (width === null && height !== null) scale = height / image.height;
      else if (width !== null && height !== null) {
        const widthScale = width / image.width;
        const heightScale = height / image.height;
        // Native frames scale uniformly. Preserve exact proportional sizes;
        // for an old stretched layer, use the smaller safe fit rather than
        // overflowing or producing a non-finite frame.
        scale = Math.abs(widthScale - heightScale) < 0.005
          ? (widthScale + heightScale) / 2
          : Math.min(widthScale, heightScale);
      }
    }
  }
  if (!Number.isFinite(scale) || scale <= 0) return 1;
  // Keep enough precision that an accurately converted legacy frame does not
  // collapse back to the synthetic 1.0 default at common near-native sizes.
  // The editor may display a rounded percentage, but the stored seed should
  // remain visually continuous with the legacy CSS on the first edit.
  return Math.round(Math.min(3, Math.max(0.25, scale)) * 10000) / 10000;
}

export function studioReframeCoverScale(
  scale,
  image,
  viewport,
  fromScope,
  toScope,
) {
  strictNumber(scale, "background frame scale", 0.25, 3);
  const current = scale;
  if (fromScope === toScope) return current;
  const fromCover = studioLegacyScale("cover", image, viewport, fromScope);
  const toCover = studioLegacyScale("cover", image, viewport, toScope);
  if (!Number.isFinite(fromCover) || fromCover <= 0
      || !Number.isFinite(toCover) || toCover <= 0) return current;
  const minimum = 0.25;
  const maximum = 3;
  const rebased = current <= fromCover
    ? fromCover === minimum
      ? toCover
      : minimum + ((current - minimum) * (toCover - minimum) / (fromCover - minimum))
    : fromCover === maximum
      ? toCover
      : toCover + ((current - fromCover) * (maximum - toCover) / (maximum - fromCover));
  return Math.round(Math.min(maximum, Math.max(minimum, rebased)) * 10000) / 10000;
}

export function studioFrameFromLegacy(
  position = "center",
  size = null,
  image = null,
  viewport = null,
  backgroundScope = "full-window",
) {
  const normalized = String(position ?? "center").toLowerCase();
  const horizontal = /\bleft\b/u.test(normalized) ? "left" : /\bright\b/u.test(normalized) ? "right" : "center";
  const vertical = /\btop\b/u.test(normalized) ? "top" : /\bbottom\b/u.test(normalized) ? "bottom" : "center";
  const anchor = vertical !== "center" && horizontal !== "center"
    ? `${vertical}-${horizontal}`
    : vertical !== "center" ? vertical : horizontal;
  return {
    anchor,
    focalX: horizontal === "left" ? 0 : horizontal === "right" ? 100 : 50,
    focalY: vertical === "top" ? 0 : vertical === "bottom" ? 100 : 50,
    positionX: 0,
    positionY: 0,
    scale: studioLegacyScale(size, image, viewport, backgroundScope),
  };
}

export function studioWebpDimensions(bytes, label = "Studio artwork") {
  if (!Buffer.isBuffer(bytes) || bytes.length < 30
      || bytes.subarray(0, 4).toString("ascii") !== "RIFF"
      || bytes.subarray(8, 12).toString("ascii") !== "WEBP") {
    throw new Error(`${label} is not a valid WebP image`);
  }
  const declaredLength = bytes.readUInt32LE(4) + 8;
  if (declaredLength > bytes.length || declaredLength < 30) throw new Error(`${label} is truncated`);
  let offset = 12;
  while (offset + 8 <= declaredLength) {
    const type = bytes.subarray(offset, offset + 4).toString("ascii");
    const length = bytes.readUInt32LE(offset + 4);
    const data = offset + 8;
    const end = data + length;
    if (end > declaredLength) throw new Error(`${label} contains a truncated WebP chunk`);
    let width = 0;
    let height = 0;
    if (type === "VP8X" && length >= 10) {
      width = 1 + bytes[data + 4] + (bytes[data + 5] << 8) + (bytes[data + 6] << 16);
      height = 1 + bytes[data + 7] + (bytes[data + 8] << 8) + (bytes[data + 9] << 16);
    } else if (type === "VP8 " && length >= 10) {
      if (bytes[data + 3] !== 0x9d || bytes[data + 4] !== 0x01 || bytes[data + 5] !== 0x2a) {
        throw new Error(`${label} has an invalid lossy WebP frame`);
      }
      width = bytes.readUInt16LE(data + 6) & 0x3fff;
      height = bytes.readUInt16LE(data + 8) & 0x3fff;
    } else if (type === "VP8L" && length >= 5) {
      if (bytes[data] !== 0x2f) throw new Error(`${label} has an invalid lossless WebP frame`);
      width = 1 + bytes[data + 1] + ((bytes[data + 2] & 0x3f) << 8);
      height = 1 + (bytes[data + 2] >> 6) + (bytes[data + 3] << 2) + ((bytes[data + 4] & 0x0f) << 10);
    }
    if (width || height) {
      if (!Number.isInteger(width) || !Number.isInteger(height)
          || width < 1 || height < 1 || width > 32768 || height > 32768) {
        throw new Error(`${label} dimensions are invalid`);
      }
      return { width, height };
    }
    offset = end + (length % 2);
  }
  throw new Error(`${label} dimensions are missing`);
}

export function studioContextFromLegacy(overrides) {
  if (!overrides) return "all";
  if (overrides.conversation?.hidden && overrides.other?.hidden && !overrides["new-chat"]?.hidden) return "new-chat";
  if (overrides["new-chat"]?.hidden && overrides.other?.hidden && !overrides.conversation?.hidden) return "conversation";
  return "all";
}

export function serializeStudioTheme(theme, id) {
  const mode = (name) => ({
    semantic: cloneJson(theme[name].semantic),
    wallpaper: cloneJson(theme[name].wallpaper),
  });
  const uiId = studioFontId(theme.typography.ui, STUDIO_FONT_UI_STACKS,
    /Trebuchet|rounded/i.test(theme.typography.ui) ? "rounded-sans" : "humanist-sans");
  const displayFallback = /(?:^|[,\s"])(?:ui-serif|serif|Georgia|Mincho|Garamond|Palatino|Antiqua)(?:$|[,\s"])/i
    .test(theme.typography.display)
    ? "editorial-serif"
    : /Trebuchet|rounded/i.test(theme.typography.display) ? "rounded-sans" : "humanist-sans";
  const displayId = studioFontId(theme.typography.display, STUDIO_FONT_DISPLAY_STACKS, displayFallback);
  const shadowId = studioShadowId(theme.effects);
  const radius = theme.shape.card;
  return {
    name: id,
    label: theme.label,
    description: theme.description,
    variant: FROZEN_BUILTIN_THEME_IDS.has(theme.variant) ? theme.variant : id,
    radius,
    blur: theme.blur,
    typography: {
      ...cloneJson(theme.typography),
      ui: STUDIO_FONT_UI_STACKS[uiId],
      body: STUDIO_FONT_UI_STACKS[uiId],
      display: STUDIO_FONT_DISPLAY_STACKS[displayId],
    },
    shape: studioRadiusPolicy(radius, theme.shape.borderWidth),
    effects: { ...cloneJson(theme.effects), ...STUDIO_SHADOWS[shadowId] },
    launcher: cloneJson(theme.launcher),
    customCss: "",
    light: mode("light"),
    dark: mode("dark"),
  };
}

export async function copyWebpIntoEditor(sourcePath, paths) {
  const source = path.resolve(sourcePath);
  const stat = await fs.lstat(source);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error("Theme artwork must be a regular file");
  if (stat.size <= 0 || stat.size >= MAX_USER_RASTER_ARTWORK_BYTES) {
    throw new Error("Theme artwork must be smaller than 400 KB");
  }
  const bytes = await fs.readFile(source);
  if (detectImageMime(bytes) !== "image/webp") {
    throw new Error("Studio can edit only converted WebP artwork; re-import this layer in Studio");
  }
  await fs.mkdir(paths.artwork, { recursive: true });
  const filename = `layer-${studioHex()}.webp`;
  const target = path.join(paths.artwork, filename);
  await fs.copyFile(source, target, fsConstants.COPYFILE_EXCL);
  return `artwork/${filename}`;
}

export async function loadStudioImportConverter() {
  const module = await import("../convert-theme-assets.mjs");
  if (typeof module.convertStudioImport !== "function") {
    throw new Error("Studio artwork converter is unavailable");
  }
  return module.convertStudioImport;
}

export async function materializeSourceArtwork(sourcePath, paths, convertStudioAsset = null) {
  const source = path.resolve(sourcePath);
  const bytes = await fs.readFile(source);
  if (detectImageMime(bytes) === "image/webp") return copyWebpIntoEditor(source, paths);
  const rootStat = await fs.lstat(paths.root);
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) throw new Error("Editor data folder must be a regular directory");
  const importStat = await pathKind(paths.imports);
  if (importStat && (!importStat.isDirectory() || importStat.isSymbolicLink())) {
    throw new Error("Editor import folder must be a regular directory");
  }
  if (!importStat) await fs.mkdir(paths.imports);
  const [realRoot, realImports] = await Promise.all([fs.realpath(paths.root), fs.realpath(paths.imports)]);
  if (!isPathWithin(realRoot, realImports)) throw new Error("Editor import folder escaped app-owned data");
  const converted = path.join(paths.imports, `layer-${studioHex()}.webp`);
  try {
    const convertStudioImport = convertStudioAsset ?? await loadStudioImportConverter();
    await convertStudioImport({ source, target: converted, outputRoot: paths.root });
    return await copyWebpIntoEditor(converted, paths);
  } finally {
    await fs.rm(converted, { force: true }).catch(() => {});
  }
}

export function appendCopyLabel(labels) {
  return Object.fromEntries(Object.entries(labels).map(([locale, label]) => {
    const suffix = locale === "en" ? " Copy"
      : ["zh-CN", "zh-HKTW"].includes(locale) ? "副本"
        : "";
    return [locale, `${label}${suffix}`.slice(0, 80)];
  }));
}

export function copyIdBase(sourceId) {
  const suffix = "-copy";
  return `${sourceId.slice(0, 40 - suffix.length).replace(/-+$/u, "")}${suffix}`;
}

export async function uniqueStudioThemeId(sourceId, userThemesDir) {
  const registry = await readThemeRegistry({ userThemesDir });
  const reserved = new Set([...registry.themes.map((entry) => entry.id), ...Object.keys(registry.legacyAliases)]);
  const base = copyIdBase(sourceId);
  if (!reserved.has(base)) return base;
  for (let suffix = 2; suffix < 10_000; suffix += 1) {
    const ending = `-${suffix}`;
    const candidate = `${base.slice(0, 40 - ending.length).replace(/-+$/u, "")}${ending}`;
    if (!reserved.has(candidate)) return candidate;
  }
  throw new Error("No available theme-copy id could be allocated");
}

export async function sourceThemeForStudio(themeId, userThemesDir, locale) {
  if (typeof themeId !== "string" || !THEME_ID_PATTERN.test(themeId)) throw new Error("Theme id is invalid");
  const registry = await readThemeRegistry({ userThemesDir });
  const entry = registry.themes.find((candidate) => candidate.id === themeId);
  if (!entry) throw new Error(`Theme not found: ${themeId}`);
  return { registry, entry, theme: await readRegisteredTheme(entry, locale) };
}

function validateBuiltinAuthoringRegistry(raw, label = "themes/registry.json") {
  if (!isPlainObject(raw) || raw.schemaVersion !== 1) {
    throw new Error(`${label} must use schemaVersion 1`);
  }
  if (!Array.isArray(raw.themes) || raw.themes.length === 0) {
    throw new Error(`${label} must list themes`);
  }
  const themes = raw.themes.map((entry, index) =>
    validateRegistryEntry(entry, `${label}.themes[${index}]`, { source: "builtin" }));
  const ids = themes.map((entry) => entry.id);
  if (new Set(ids).size !== ids.length) throw new Error(`${label} theme IDs must be unique`);
  if (!ids.includes(raw.defaultTheme)) throw new Error(`${label} defaultTheme is invalid`);
  if (raw.legacyAliases !== undefined && !isPlainObject(raw.legacyAliases)) {
    throw new Error(`${label} legacyAliases must be an object`);
  }
  for (const [from, to] of Object.entries(raw.legacyAliases ?? {})) {
    if (!THEME_ID_PATTERN.test(from) || !ids.includes(to)) {
      throw new Error(`${label} contains an invalid legacy alias: ${from} -> ${to}`);
    }
  }
  return { raw, themes };
}

async function readBuiltinAuthoringRegistry(authority) {
  if (!authority?.registryPath) throw new Error("Built-in layout authoring is not authorized");
  const bytes = await fs.readFile(authority.registryPath);
  let raw;
  try {
    raw = JSON.parse(bytes.toString("utf8"));
  } catch (error) {
    throw new Error(`themes/registry.json contains invalid JSON: ${error.message}`);
  }
  const validated = validateBuiltinAuthoringRegistry(raw);
  return { ...validated, bytes, sha256: studioSha256(bytes) };
}

async function readStudioFileDigest(filePath) {
  try {
    return studioSha256(await fs.readFile(filePath));
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

async function atomicWriteBuiltinSourceText(authority, target, contents) {
  if (![authority.registryPath, authority.generatedPath]
    .some((candidate) => sameStudioPath(candidate, target))) {
    throw new Error("Built-in source publication target is not authorized");
  }
  const gitStat = await fs.lstat(authority.gitPath);
  const realGit = await fs.realpath(authority.gitPath);
  if (!gitStat.isDirectory() || gitStat.isSymbolicLink()
      || !sameStudioPath(realGit, authority.gitPath)) {
    throw new Error("Built-in source publication requires the authorized real .git directory");
  }
  const temporary = path.join(
    authority.gitPath,
    `.claude-aura-source-${process.pid}-${studioHex()}.tmp`,
  );
  try {
    await fs.writeFile(temporary, contents, {
      encoding: "utf8",
      mode: 0o600,
      flag: "wx",
    });
    await renameStudioPath(temporary, target);
  } catch (error) {
    try {
      await fs.rm(temporary, { force: true });
    } catch (cleanupError) {
      throw new AggregateError(
        [error, cleanupError],
        "Built-in source publication failed and its .git temporary file could not be removed",
      );
    }
    throw error;
  }
}

function validateBuiltinLockOwner(owner) {
  if (!isPlainObject(owner)
      || Object.keys(owner).sort().join(",") !== "createdAt,pid,schemaVersion,token"
      || owner.schemaVersion !== 1
      || !Number.isInteger(owner.pid)
      || owner.pid <= 0
      || typeof owner.token !== "string"
      || !new RegExp(`^${owner.pid}-[a-f0-9]{32}$`).test(owner.token)
      || typeof owner.createdAt !== "string"
      || !Number.isFinite(Date.parse(owner.createdAt))) {
    throw new Error("Built-in authoring is locked by an invalid owner record");
  }
  return owner;
}

async function readBuiltinLockOwner(lockPath) {
  let owner;
  try {
    owner = JSON.parse(await fs.readFile(lockPath, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") throw error;
    throw new Error("Built-in authoring is locked by an unreadable owner record", {
      cause: error,
    });
  }
  return validateBuiltinLockOwner(owner);
}

async function acquireBuiltinAuthoringLock(authority, { allowDeadOwnerRecovery = true } = {}) {
  const token = `${process.pid}-${studioHex()}`;
  const owner = {
    schemaVersion: 1,
    pid: process.pid,
    token,
    createdAt: new Date().toISOString(),
  };
  const candidatePath = `${authority.lockPath}.candidate-${token}`;
  let candidateHandle = null;
  let published = false;
  try {
    candidateHandle = await fs.open(candidatePath, "wx", 0o600);
    await candidateHandle.writeFile(`${JSON.stringify(owner)}\n`, "utf8");
    await candidateHandle.sync();
    await candidateHandle.close();
    candidateHandle = null;
    try {
      // A hard link is a true create-if-absent publication point: unlike
      // rename, it cannot replace another process's live lock.
      await fs.link(candidatePath, authority.lockPath);
      published = true;
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
    }
  } finally {
    await candidateHandle?.close().catch(() => {});
    await fs.rm(candidatePath, { force: true }).catch(() => {});
  }
  if (!published) {
    const stat = await pathKind(authority.lockPath);
    if (!stat) {
      return acquireBuiltinAuthoringLock(authority, { allowDeadOwnerRecovery });
    }
    if (!stat.isFile() || stat.isSymbolicLink()) {
      throw new Error("Built-in authoring lock path is unsafe");
    }
    let existingOwner;
    try {
      existingOwner = await readBuiltinLockOwner(authority.lockPath);
    } catch (error) {
      if (error.code === "ENOENT") {
        return acquireBuiltinAuthoringLock(authority, { allowDeadOwnerRecovery });
      }
      throw error;
    }
    let ownerAlive = true;
    try {
      process.kill(existingOwner.pid, 0);
    } catch (probeError) {
      ownerAlive = !["ESRCH", "EINVAL"].includes(probeError.code);
    }
    if (!allowDeadOwnerRecovery || ownerAlive) {
      throw new Error("Another built-in layout save is already in progress");
    }
    const stalePath = `${authority.lockPath}.stale-${studioHex()}`;
    let quarantined = false;
    try {
      await fs.rename(authority.lockPath, stalePath);
      quarantined = true;
    } catch (recoveryError) {
      if (recoveryError.code === "ENOENT") {
        return acquireBuiltinAuthoringLock(authority, { allowDeadOwnerRecovery });
      }
      throw recoveryError;
    }
    try {
      const quarantinedOwner = await readBuiltinLockOwner(stalePath);
      if (quarantinedOwner.pid !== existingOwner.pid
          || quarantinedOwner.token !== existingOwner.token) {
        throw new Error("Built-in authoring lock ownership changed during dead-owner recovery");
      }
      await fs.rm(stalePath);
    } catch (recoveryError) {
      if (quarantined) {
        try {
          await fs.link(stalePath, authority.lockPath);
        } catch (restoreError) {
          if (restoreError.code !== "EEXIST") {
            throw new AggregateError(
              [recoveryError, restoreError],
              "Built-in authoring lock recovery could not preserve the changed owner",
            );
          }
        }
      }
      throw recoveryError;
    }
    return acquireBuiltinAuthoringLock(authority, { allowDeadOwnerRecovery: false });
  }
  return {
    token,
    async release() {
      try {
        const current = await readBuiltinLockOwner(authority.lockPath);
        if (current.token !== token || current.pid !== process.pid) {
          throw new Error("Built-in authoring lock ownership changed before release");
        }
      } catch (error) {
        if (error.code === "ENOENT") return;
        throw error;
      }
      await fs.rm(authority.lockPath);
    },
  };
}

async function readBuiltinTransactionMarker(authority) {
  const stat = await pathKind(authority.transactionPath);
  if (!stat) return null;
  if (!stat.isFile() || stat.isSymbolicLink()) {
    throw new Error("Built-in authoring transaction marker is unsafe");
  }
  const realMarker = await fs.realpath(authority.transactionPath);
  if (!isPathWithin(authority.gitPath, realMarker)) {
    throw new Error("Built-in authoring transaction marker escaped .git");
  }
  const raw = await readJson(realMarker);
  if (!isPlainObject(raw)
      || Object.keys(raw).sort().join(",")
        !== "createdAt,intendedRegistrySha256,registryBeforeSha256,schemaVersion,transactionId"
      || raw.schemaVersion !== 1
      || typeof raw.transactionId !== "string"
      || !/^[a-f0-9]{32}$/.test(raw.transactionId)
      || typeof raw.createdAt !== "string"
      || !/^[a-f0-9]{64}$/.test(raw.registryBeforeSha256)
      || !/^[a-f0-9]{64}$/.test(raw.intendedRegistrySha256)) {
    throw new Error("Built-in authoring transaction marker is invalid");
  }
  return raw;
}

async function clearBuiltinTransactionMarker(authority, transactionId) {
  const marker = await readBuiltinTransactionMarker(authority);
  if (!marker) return;
  if (marker.transactionId !== transactionId) {
    throw new Error("Built-in authoring transaction ownership changed");
  }
  await fs.rm(authority.transactionPath);
}

async function regenerateBuiltinStudioThemesForAuthority(authority) {
  const regenerate = authority.regenerateStudioThemes
    ?? (sameStudioPath(authority.root, PROJECT_ROOT) ? regenerateBuiltinStudioThemes : null);
  if (typeof regenerate !== "function") {
    throw new Error("Built-in Studio metadata recovery is unavailable");
  }
  return regenerate(authority);
}

async function recoverBuiltinAuthoringTransaction(authority) {
  if (!(await pathKind(authority.transactionPath))) return;
  const lock = await acquireBuiltinAuthoringLock(authority);
  try {
    const marker = await readBuiltinTransactionMarker(authority);
    if (!marker) return;
    await readBuiltinAuthoringRegistry(authority);
    await regenerateBuiltinStudioThemesForAuthority(authority);
    await clearBuiltinTransactionMarker(authority, marker.transactionId);
  } finally {
    await lock.release();
  }
}

const BUILTIN_ARTWORK_SOURCE_PATTERN =
  /^assets\/theme-art\/(?:[a-z0-9-]+\/)?[a-z0-9-]+\.(?:svg|png|webp|avif)$/;

function validateBuiltinSourceSnapshot(value) {
  if (!isPlainObject(value)
      || Object.keys(value).sort().join(",") !== "artwork,themeSha256"
      || typeof value.themeSha256 !== "string"
      || !/^[a-f0-9]{64}$/.test(value.themeSha256)
      || !Array.isArray(value.artwork)) {
    throw new Error("Built-in source snapshot is invalid");
  }
  let previousPath = null;
  for (const item of value.artwork) {
    if (!isPlainObject(item)
        || Object.keys(item).sort().join(",") !== "path,sha256"
        || typeof item.path !== "string"
        || !BUILTIN_ARTWORK_SOURCE_PATTERN.test(item.path)
        || typeof item.sha256 !== "string"
        || !/^[a-f0-9]{64}$/.test(item.sha256)
        || (previousPath !== null && item.path <= previousPath)) {
      throw new Error("Built-in artwork source snapshot is invalid");
    }
    previousPath = item.path;
  }
  return cloneJson(value);
}

async function readBuiltinContainedSource(authority, relativePath, allowedRoot, label) {
  const lexicalRoot = path.resolve(allowedRoot);
  const candidate = path.resolve(authority.root, relativePath);
  if (!isPathWithin(lexicalRoot, candidate)) {
    throw new Error(`${label} escaped its authorized source root`);
  }
  const [rootStat, candidateStat] = await Promise.all([
    fs.lstat(lexicalRoot),
    fs.lstat(candidate),
  ]);
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) {
    throw new Error(`${label} source root must be a real directory`);
  }
  if (!candidateStat.isFile() || candidateStat.isSymbolicLink()) {
    throw new Error(`${label} must be a real file`);
  }
  const [realRoot, realCandidate] = await Promise.all([
    fs.realpath(lexicalRoot),
    fs.realpath(candidate),
  ]);
  if (!isPathWithin(authority.root, realRoot)
      || !isPathWithin(realRoot, realCandidate)) {
    throw new Error(`${label} escaped its authorized source root`);
  }
  return fs.readFile(realCandidate);
}

async function readBuiltinSourceSnapshot(authority, rawEntry, { includeThemeBytes = false } = {}) {
  const themeRelativePath = `themes/${rawEntry.id}.json`;
  const themeBytes = await readBuiltinContainedSource(
    authority,
    themeRelativePath,
    path.join(authority.root, "themes"),
    "Built-in theme source",
  );
  const layers = rawEntry.artworkLayers ?? (rawEntry.artwork ? [rawEntry.artwork] : []);
  const paths = [...new Set(layers.map((layer) => layer.path))].sort();
  const artwork = await Promise.all(paths.map(async (artworkPath) => {
    if (!BUILTIN_ARTWORK_SOURCE_PATTERN.test(artworkPath)) {
      throw new Error("Built-in artwork path is invalid");
    }
    const bytes = await readBuiltinContainedSource(
      authority,
      artworkPath,
      path.join(authority.root, "assets", "theme-art"),
      `Built-in artwork ${artworkPath}`,
    );
    return { path: artworkPath, sha256: studioSha256(bytes) };
  }));
  const snapshot = validateBuiltinSourceSnapshot({
    themeSha256: studioSha256(themeBytes),
    artwork,
  });
  return includeThemeBytes ? { snapshot, themeBytes } : snapshot;
}

async function sourceThemeForBuiltinAuthoring(themeId, authority, locale) {
  if (typeof themeId !== "string" || !THEME_ID_PATTERN.test(themeId)
      || !FROZEN_BUILTIN_THEME_IDS.has(themeId)) {
    throw new Error("Built-in theme id is invalid");
  }
  const registry = await readBuiltinAuthoringRegistry(authority);
  const index = registry.raw.themes.findIndex((entry) => entry.id === themeId);
  if (index < 0) throw new Error(`Theme not found: ${themeId}`);
  const entry = registry.themes[index];
  const themesRoot = path.join(authority.root, "themes");
  const { snapshot: sourceSnapshot, themeBytes } = await readBuiltinSourceSnapshot(
    authority,
    registry.raw.themes[index],
    { includeThemeBytes: true },
  );
  let rawTheme;
  try {
    rawTheme = JSON.parse(themeBytes.toString("utf8"));
  } catch (error) {
    throw new Error(`Built-in theme source contains invalid JSON: ${error.message}`);
  }
  const themePath = path.join(themesRoot, `${entry.id}.json`);
  const baseTheme = validateTheme(rawTheme, themePath);
  if (baseTheme.name !== entry.id || baseTheme.variant !== entry.id) {
    throw new Error(`Built-in theme source does not match its frozen ID: ${entry.id}`);
  }
  const normalizedLocale = normalizeLocale(locale);
  const theme = {
    ...baseTheme,
    label: entry.labels[normalizedLocale] ?? entry.labels.en,
    description: entry.descriptions[normalizedLocale] ?? entry.descriptions.en,
    labels: cloneJson(entry.labels),
    descriptions: cloneJson(entry.descriptions),
    swatches: cloneJson(entry.swatches),
    preview: cloneJson(entry.preview),
    studioPreview: entry.studioPreview,
    studioPreviewFrame: entry.studioPreviewFrame ? cloneJson(entry.studioPreviewFrame) : null,
    newChatLayout: entry.newChatLayout ? cloneJson(entry.newChatLayout) : null,
    newChatGreetingStyle: entry.newChatGreetingStyle ? cloneJson(entry.newChatGreetingStyle) : null,
    artwork: entry.artwork ? cloneJson(entry.artwork) : null,
    artworkLayers: entry.artworkLayers ? cloneJson(entry.artworkLayers) : null,
    schemaVersion: 1,
    backgroundScope: "full-window",
    sourceRecipe: null,
    controlOverrides: [],
    source: "builtin",
    sourceDirectory: themesRoot,
    artworkRoot: authority.root,
    artworkAllowedRoot: path.join(authority.root, "assets", "theme-art"),
  };
  return {
    registry,
    index,
    rawEntry: cloneJson(registry.raw.themes[index]),
    entry,
    theme,
    sourceSnapshot,
  };
}

export function stableBuiltinStudioLayerId(themeId, index, artworkPath) {
  const digest = studioSha256(Buffer.from(`${themeId}\0${index}\0${artworkPath}`, "utf8"));
  return `layer-${digest.slice(0, 32)}`;
}

async function studioDocumentFromResolvedSource({
  entry,
  theme,
  targetId,
  paths,
  copyLabels,
  reuseActiveFiles = false,
  stableLayerIds = false,
  builtinLayoutCapability = null,
}) {
  const labels = copyLabels ? appendCopyLabel(theme.labels) : cloneJson(theme.labels);
  const document = {
    schemaVersion: STUDIO_THEME_SCHEMA_VERSION,
    id: targetId,
    labels,
    descriptions: cloneJson(theme.descriptions),
    swatches: cloneJson(theme.swatches),
    preview: cloneJson(theme.preview),
    studioPreview: null,
    newChatLayout: theme.newChatLayout ? cloneJson(theme.newChatLayout) : null,
    newChatGreetingStyle: theme.newChatGreetingStyle ? cloneJson(theme.newChatGreetingStyle) : null,
    backgroundScope: theme.backgroundScope ?? "full-window",
    artworkLayers: [],
    sourceRecipe: entry.source === "builtin" ? entry.id : (theme.sourceRecipe ?? null),
    controlOverrides: entry.source === "builtin" ? [] : cloneJson(theme.controlOverrides ?? []),
    theme: serializeStudioTheme(theme, targetId),
  };
  document.theme.label = labels.en;
  document.theme.description = document.descriptions.en;
  if (entry.source === "user" && theme.launcher.asset === "launcher-mark.png") {
    const sourceMark = path.resolve(theme.sourceDirectory, theme.launcher.asset);
    const targetMark = path.resolve(paths.active, theme.launcher.asset);
    if (!isPathWithin(theme.sourceDirectory, sourceMark) || !isPathWithin(paths.active, targetMark)) {
      throw new Error("Theme launcher mark escaped its owned folder");
    }
    if (!(reuseActiveFiles && sourceMark === targetMark)) {
      await fs.copyFile(sourceMark, targetMark, fsConstants.COPYFILE_EXCL);
    }
  }
  const sourceLayers = theme.artworkLayers ?? (theme.artwork ? [{ ...theme.artwork, role: "background" }] : []);
  let realArtworkAllowedRoot = null;
  if (sourceLayers.length) {
    const artworkAllowedRoot = path.resolve(theme.artworkAllowedRoot);
    const allowedStat = await fs.lstat(artworkAllowedRoot);
    if (!allowedStat.isDirectory() || allowedStat.isSymbolicLink()) {
      throw new Error("Theme artwork source root must be a real directory");
    }
    realArtworkAllowedRoot = await fs.realpath(artworkAllowedRoot);
  }
  const copiedArtwork = new Map();
  for (let sourceIndex = 0; sourceIndex < sourceLayers.length; sourceIndex += 1) {
    const sourceLayer = sourceLayers[sourceIndex];
    const sourcePath = path.resolve(theme.artworkRoot, sourceLayer.path);
    const sourceKey = await fs.realpath(sourcePath);
    if (!isPathWithin(realArtworkAllowedRoot, sourceKey)) {
      throw new Error("Theme artwork escaped its authorized source root");
    }
    let copied = copiedArtwork.get(sourceKey);
    if (!copied) {
      const artworkPath = await materializeSourceArtwork(sourcePath, paths);
      const editorArtworkPath = path.resolve(paths.active, artworkPath);
      const image = studioWebpDimensions(await fs.readFile(editorArtworkPath), `Editor artwork ${sourceLayer.path}`);
      copied = { artworkPath, image };
      copiedArtwork.set(sourceKey, copied);
    }
    // A layer carrying legacy CSS still renders through that exact recipe.
    // Recompute its dormant frame seeds whenever an existing saved theme is
    // opened so drafts created by older Studio builds do not retain the old
    // synthetic 1x frame and jump on their first framing edit.
    const frames = sourceLayer.frames && !sourceLayer.legacy ? cloneJson(sourceLayer.frames) : Object.fromEntries(
      Object.entries(STUDIO_FRAME_VIEWPORTS).map(([preset, viewport]) => [
        preset,
        studioFrameFromLegacy(
          sourceLayer.legacy?.position ?? sourceLayer.position,
          sourceLayer.legacy?.size ?? sourceLayer.size,
          copied.image,
          viewport,
          document.backgroundScope,
        ),
      ]),
    );
    document.artworkLayers.push({
      id: stableLayerIds
        ? (sourceLayer.id ?? stableBuiltinStudioLayerId(entry.id, sourceIndex, sourceLayer.path))
        : (sourceLayer.id ?? `layer-${studioHex()}`),
      path: copied.artworkPath,
      role: STUDIO_LAYER_ROLES.has(sourceLayer.role) ? sourceLayer.role : "decoration",
      appearance: sourceLayer.appearance ?? "all",
      context: sourceLayer.context ?? studioContextFromLegacy(sourceLayer.contextOverrides),
      viewport: sourceLayer.viewport ?? "all",
      visible: sourceLayer.visible ?? true,
      opacity: sourceLayer.opacity ?? 1,
      mask: sourceLayer.mask ?? "soft-right",
      mobile: sourceLayer.mobile ?? "reduce",
      frames,
      ...(sourceLayer.legacy ? { legacy: cloneJson(sourceLayer.legacy) } : sourceLayer.frames ? {} : {
        legacy: {
          position: sourceLayer.position ?? "center",
          size: sourceLayer.size ?? "cover",
          contextOverrides: sourceLayer.contextOverrides ? cloneJson(sourceLayer.contextOverrides) : null,
        },
      }),
    });
  }
  validateStudioThemeKitDocument(document, "editor theme", { builtinLayoutCapability });
  return document;
}

export async function studioDocumentFromSource({ sourceId, targetId, userThemesDir, locale, paths, copyLabels }) {
  const { entry, theme } = await sourceThemeForStudio(sourceId, userThemesDir, locale);
  const document = await studioDocumentFromResolvedSource({
    entry,
    theme,
    targetId,
    paths,
    copyLabels,
  });
  return { document, source: entry.source };
}

export async function compileStudioDocument(
  document,
  context,
  {
    appearance = "system",
    greetingPreferences = context.greetingPreferences ?? null,
    builtinLayoutCapability = null,
  } = {},
) {
  const paths = studioPaths(context.editorRoot);
  await atomicWriteJson(paths.theme, document);
  const persisted = await readConfig(context.configPath);
  const config = {
    ...persisted,
    enabled: true,
    theme: document.id,
    appearance,
    ...(greetingPreferences === null ? {} : {
      greetingPreferences: validateGreetingPreferences(greetingPreferences),
    }),
  };
  delete config.customTheme;
  const compiled = await compileTheme({
    configPath: context.configPath,
    config,
    locale: context.locale,
    userThemesDir: context.userThemesDir,
    themeKitDirectory: paths.active,
    builtinLayoutCapability,
  });
  const bundle = await buildPayloadFromCompiled(compiled, { enforceBudget: false });
  new Function(bundle.payload);
  return bundle;
}

export async function studioFeedback(document, context, bundle) {
  const contrast = studioContrastFeedback(bundle.theme);
  const { chromeBytes, embeddedArtworkBytes } = bundle.payloadBudget;
  const paths = studioPaths(context.editorRoot);
  const layerBytes = await studioLayerBytes(document, paths.active);
  const uniquePaths = new Map();
  document.artworkLayers.forEach((layer, index) => uniquePaths.set(layer.path, layerBytes[index]));
  let launcherBytes = 0;
  if (document.theme.launcher.asset === "launcher-mark.png") {
    const launcherPath = path.resolve(paths.active, document.theme.launcher.asset);
    if (!isPathWithin(paths.active, launcherPath)) throw new Error("Editor launcher mark escaped the active theme folder");
    const launcherStat = await fs.lstat(launcherPath);
    if (!launcherStat.isFile() || launcherStat.isSymbolicLink()) throw new Error("Editor launcher mark must be a regular file");
    launcherBytes = launcherStat.size;
  }
  const sourceArtworkBytes = [...uniquePaths.values()].reduce((total, value) => total + value, launcherBytes);
  const layers = layerBytes.map((bytes, id) => ({ id, bytes, limit: MAX_USER_RASTER_ARTWORK_BYTES, pass: bytes < MAX_USER_RASTER_ARTWORK_BYTES }));
  const budget = {
    chromeBytes,
    chromeLimit: MAX_CHROME_PAYLOAD_BYTES,
    embeddedArtworkBytes,
    embeddedArtworkLimit: MAX_USER_ARTWORK_TOTAL_BYTES,
    sourceArtworkBytes,
    sourceArtworkLimit: MAX_USER_ARTWORK_TOTAL_BYTES,
    layers,
    pass: chromeBytes < MAX_CHROME_PAYLOAD_BYTES
      && embeddedArtworkBytes < MAX_USER_ARTWORK_TOTAL_BYTES
      && sourceArtworkBytes < MAX_USER_ARTWORK_TOTAL_BYTES
      && layers.every((layer) => layer.pass),
  };
  const errors = [];
  for (const mode of ["light", "dark"]) {
    for (const check of contrast[mode]) {
      if (!check.pass) errors.push({ code: "contrast", field: `${mode}.${check.id}` });
    }
  }
  if (chromeBytes >= MAX_CHROME_PAYLOAD_BYTES) errors.push({ code: "chrome-budget", field: "budget.chromeBytes" });
  if (embeddedArtworkBytes >= MAX_USER_ARTWORK_TOTAL_BYTES) errors.push({ code: "embedded-artwork-budget", field: "budget.embeddedArtworkBytes" });
  if (sourceArtworkBytes >= MAX_USER_ARTWORK_TOTAL_BYTES) errors.push({ code: "source-artwork-budget", field: "budget.sourceArtworkBytes" });
  for (const layer of layers.filter((item) => !item.pass)) errors.push({ code: "layer-budget", field: `layers[${layer.id}]` });
  return { valid: errors.length === 0, contrast, budget, errors };
}

export async function evaluateStudioDocument(
  document,
  context,
  {
    greetingPreferences = context.greetingPreferences ?? null,
    builtinLayoutCapability = null,
  } = {},
) {
  try {
    validateStudioThemeKitDocument(document, "editor theme", { builtinLayoutCapability });
    if (greetingPreferences !== null) {
      const greetingError = studioGreetingPreferenceError(greetingPreferences, document.id);
      if (greetingError) {
        return {
          bundle: null,
          feedback: {
            ...emptyStudioFeedback(),
            valid: false,
            errors: [greetingError],
          },
          error: "invalid-greeting",
        };
      }
    }
    const bundle = await compileStudioDocument(document, context, {
      appearance: "system",
      greetingPreferences,
      builtinLayoutCapability,
    });
    const feedback = await studioFeedback(document, context, bundle);
    return { bundle, feedback, error: feedback.valid ? null : "contrast-or-budget" };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const launcherField = /editor theme\.theme\.launcher\.(surfaceHover|surface|foreground|accent|border|radius|borderWidth)\b/.exec(message)?.[1];
    const metadataMatch = /editor theme\.(labels|descriptions)(?:\.([A-Za-z-]+))?/u.exec(message);
    const metadataField = metadataMatch
      ? metadataMatch[2]
        ? `metadata.${metadataMatch[1]}.${metadataMatch[2]}`
        : "metadata"
      : null;
    return {
      bundle: null,
      feedback: {
        ...emptyStudioFeedback(),
        valid: false,
        errors: [{
          code: metadataField
            ? "invalid-metadata"
            : launcherField
            ? (message.includes("must reach 4.5:1 contrast") ? "launcher-contrast" : "invalid-launcher")
            : "invalid-theme",
          field: metadataField ?? (launcherField ? `launcher.${launcherField}` : "theme"),
        }],
      },
      error: metadataField ? "invalid-metadata" : launcherField ? "invalid-launcher" : "invalid-theme",
    };
  }
}

export async function replaceActiveStudio(paths, build) {
  await fs.mkdir(paths.root, { recursive: true });
  await assertStudioActivePaths(paths);
  const backup = path.join(paths.root, `.active-backup-${studioHex()}`);
  const hadActive = Boolean(await pathKind(paths.active));
  if (hadActive) await renameStudioPath(paths.active, backup);
  try {
    await fs.mkdir(paths.artwork, { recursive: true });
    const result = await build();
    if (hadActive) await fs.rm(backup, { recursive: true, force: true });
    return result;
  } catch (error) {
    await fs.rm(paths.active, { recursive: true, force: true }).catch(() => {});
    if (hadActive) await renameStudioPath(backup, paths.active).catch(() => {});
    throw error;
  }
}

export async function beginStudioDocument(document, metadata, context) {
  const paths = studioPaths(context.editorRoot);
  const launcherMarkDigest = studioDocumentUsesLocalLauncher(document)
    ? await storeStudioLauncherMark(path.join(paths.active, "launcher-mark.png"), paths)
    : null;
  const internal = {
    version: 2,
    locale: normalizeLocale(context.locale),
    session: studioUuid(),
    revision: 0,
    id: document.id,
    sourceId: metadata.sourceId,
    source: metadata.source,
    isNew: metadata.isNew,
    editKind: metadata.editKind ?? null,
    ...(metadata.registrySha256 ? { registrySha256: metadata.registrySha256 } : {}),
    ...(metadata.sourceSnapshot ? { sourceSnapshot: cloneJson(metadata.sourceSnapshot) } : {}),
    baselineDocument: cloneJson(document),
    currentDocument: cloneJson(document),
    lastValidDocument: cloneJson(document),
    launcherMarkDigest,
    baselineLauncherMarkDigest: launcherMarkDigest,
    lastValidLauncherMarkDigest: launcherMarkDigest,
    undo: [],
    redo: [],
    appliedUndo: [],
    appliedRedo: [],
    launcherUndo: [],
    launcherRedo: [],
    appliedLauncherUndo: [],
    appliedLauncherRedo: [],
    feedback: emptyStudioFeedback(),
  };
  initializeStudioGreetingTracking(internal, await studioGreetingPreferences(context.configPath));
  const evaluated = await evaluateStudioDocument(document, context, {
    greetingPreferences: internal.greetingCurrent,
    builtinLayoutCapability: internal.editKind === "builtin-layout"
      ? BUILTIN_STUDIO_LAYOUT_VALIDATION
      : null,
  });
  internal.feedback = evaluated.feedback;
  if (!evaluated.feedback.valid) throw new Error(evaluated.error ?? "The source theme is not valid for Studio");
  await persistStudioInternal(paths, internal);
  return {
    state: await canonicalStudioState(internal, context.editorRoot, context.configPath),
    payload: evaluated.bundle.payload,
    themesChanged: false,
    configChanged: false,
    apply: "draft",
  };
}

export async function createThemeCopy(context) {
  const locale = normalizeLocale(context.locale);
  const targetId = await uniqueStudioThemeId(context.theme, context.userThemesDir);
  const paths = studioPaths(context.editorRoot);
  return replaceActiveStudio(paths, async () => {
    const created = await studioDocumentFromSource({
      sourceId: context.theme,
      targetId,
      userThemesDir: context.userThemesDir,
      locale,
      paths,
      copyLabels: true,
    });
    return beginStudioDocument(created.document, {
      sourceId: context.theme,
      source: created.source,
      isNew: true,
    }, { ...context, locale });
  });
}

function requireBuiltinAuthoring(context) {
  if (!context.builtinAuthoring?.root || !context.builtinAuthoring?.registryPath) {
    throw new Error("Built-in layout authoring is not authorized");
  }
  return context.builtinAuthoring;
}

async function peekStudioEditKind(editorRoot) {
  const paths = studioPaths(editorRoot);
  if (!(await assertStudioActivePaths(paths))) return null;
  try {
    const raw = await readJson(paths.state);
    return raw?.editKind ?? null;
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

function assertBuiltinLayoutDocumentChange(baseline, candidate) {
  const immutable = (document) => {
    const value = cloneJson(document);
    delete value.newChatLayout;
    delete value.newChatGreetingStyle;
    value.artworkLayers = value.artworkLayers.map((layer) => {
      const result = cloneJson(layer);
      delete result.frames;
      delete result.legacy;
      return result;
    });
    return value;
  };
  if (JSON.stringify(immutable(baseline)) !== JSON.stringify(immutable(candidate))) {
    throw new Error("Built-in authoring may change layout fields only");
  }
  for (let index = 0; index < baseline.artworkLayers.length; index += 1) {
    const before = baseline.artworkLayers[index];
    const after = candidate.artworkLayers[index];
    if (before.legacy === undefined && after.legacy !== undefined) {
      throw new Error("Built-in artwork cannot return to legacy framing");
    }
    if (after.legacy !== undefined) {
      if (JSON.stringify(after.legacy) !== JSON.stringify(before.legacy)
          || JSON.stringify(after.frames) !== JSON.stringify(before.frames)) {
        throw new Error("A legacy built-in layer must be adopted before its frame can change");
      }
    }
  }
  validateStudioThemeKitDocument(candidate, "built-in layout draft", {
    enforceLauncherContrast: false,
    builtinLayoutCapability: BUILTIN_STUDIO_LAYOUT_VALIDATION,
  });
}

function assertBuiltinLayoutSession(context, internal) {
  if (internal?.editKind !== "builtin-layout") return;
  requireBuiltinAuthoring(context);
  if (internal.source !== "builtin" || internal.isNew !== false || internal.sourceId !== internal.id) {
    throw new Error("Built-in layout editor identity is invalid");
  }
  if (internal.launcherMarkDigest !== internal.baselineLauncherMarkDigest
      || internal.lastValidLauncherMarkDigest !== internal.baselineLauncherMarkDigest
      || JSON.stringify(internal.greetingCurrent) !== JSON.stringify(internal.greetingBaseline)
      || JSON.stringify(internal.greetingLastValid) !== JSON.stringify(internal.greetingBaseline)) {
    throw new Error("Built-in layout authoring cannot change host-owned or launcher data");
  }
  assertBuiltinLayoutDocumentChange(internal.baselineDocument, internal.currentDocument);
  assertBuiltinLayoutDocumentChange(internal.baselineDocument, internal.lastValidDocument);
}

async function guardBuiltinStudioRequest(context, request) {
  if (await peekStudioEditKind(context.editorRoot) !== "builtin-layout") return;
  requireBuiltinAuthoring(context);
  const simpleActions = new Set([
    "begin-theme-edit", "undo-theme-edit", "redo-theme-edit", "save-theme-edit",
    "discard-theme-edit", "reset-greeting",
  ]);
  if (simpleActions.has(request.type)) return;
  if (request.type === "set-theme-token") {
    throw new Error("Built-in prompt placement must be changed as one complete layout");
  }
  if (request.type === "set-theme-layer") {
    if (!["normal", "wide"].includes(request.preset)) {
      throw new Error("Built-in authoring may change layer frames only");
    }
    return;
  }
  if (request.type === "apply-theme-patch") {
    const promptChanges = Array.isArray(request.changes)
      ? request.changes.filter((change) => change?.kind === "token")
      : [];
    const promptTokens = new Set(promptChanges.map((change) => change.token));
    const incompletePrompt = promptChanges.length > 0
      && (promptChanges.length !== 3
        || promptTokens.size !== 3
        || !["promptWidth", "promptX", "promptY"].every((token) => promptTokens.has(token)));
    if (!Array.isArray(request.changes) || incompletePrompt || request.changes.some((change) => {
      if (change?.kind === "token") {
        return change.mode !== "shared" || !["promptWidth", "promptX", "promptY"].includes(change.token);
      }
      if (change?.kind === "layer") return !["normal", "wide"].includes(change.preset);
      return change?.kind !== "greeting";
    })) {
      throw new Error("Built-in authoring patch contains a non-layout change");
    }
    return;
  }
  throw new Error("This action is unavailable during built-in layout authoring");
}

export async function beginThemeEdit(context) {
  const locale = normalizeLocale(context.locale);
  if (await peekStudioEditKind(context.editorRoot) === "builtin-layout") {
    requireBuiltinAuthoring(context);
  }
  const existing = await loadStudioInternal(context.editorRoot);
  const greetingTrackingInitialized = existing
    ? await ensureStudioGreetingTracking(existing, context.configPath)
    : false;
  if (existing) assertBuiltinLayoutSession(context, existing);
  if (existing && existing.id === context.theme && context.reset === true) {
    existing.currentDocument = cloneJson(existing.baselineDocument);
    existing.lastValidDocument = cloneJson(existing.baselineDocument);
    existing.launcherMarkDigest = existing.baselineLauncherMarkDigest;
    existing.lastValidLauncherMarkDigest = existing.baselineLauncherMarkDigest;
    existing.undo = [];
    existing.redo = [];
    existing.appliedUndo = [];
    existing.appliedRedo = [];
    existing.launcherUndo = [];
    existing.launcherRedo = [];
    existing.appliedLauncherUndo = [];
    existing.appliedLauncherRedo = [];
    existing.greetingCurrent = cloneJson(existing.greetingBaseline);
    existing.greetingLastValid = cloneJson(existing.greetingBaseline);
    existing.greetingUndo = [];
    existing.greetingRedo = [];
    existing.greetingAppliedUndo = [];
    existing.greetingAppliedRedo = [];
    existing.revision += 1;
    if (existing.launcherMarkDigest !== null) {
      await materializeStudioLauncherMark(studioPaths(context.editorRoot), existing.launcherMarkDigest);
    }
    const evaluated = await evaluateStudioDocument(existing.currentDocument, { ...context, locale }, {
      greetingPreferences: existing.greetingCurrent,
      builtinLayoutCapability: existing.editKind === "builtin-layout"
        ? BUILTIN_STUDIO_LAYOUT_VALIDATION
        : null,
    });
    if (!evaluated.feedback.valid) throw new Error("The editor baseline is no longer valid");
    existing.feedback = evaluated.feedback;
    await persistStudioInternal(studioPaths(context.editorRoot), existing);
    return {
      state: withStudioResult(await canonicalStudioState(existing, context.editorRoot, context.configPath), "begin-theme-edit", true, null),
      payload: evaluated.bundle.payload,
      themesChanged: false,
      configChanged: false,
      apply: "draft",
    };
  }
  if (existing && existing.id === context.theme) {
    const existingPaths = studioPaths(context.editorRoot);
    let bundle;
    try {
      if (existing.lastValidLauncherMarkDigest !== null) {
        await materializeStudioLauncherMark(existingPaths, existing.lastValidLauncherMarkDigest);
      }
      bundle = await compileStudioDocument(existing.lastValidDocument, { ...context, locale }, {
        appearance: "system",
        greetingPreferences: existing.greetingLastValid,
        builtinLayoutCapability: existing.editKind === "builtin-layout"
          ? BUILTIN_STUDIO_LAYOUT_VALIDATION
          : null,
      });
    } finally {
      if (existing.launcherMarkDigest !== null) {
        await materializeStudioLauncherMark(existingPaths, existing.launcherMarkDigest);
      }
      await atomicWriteJson(existingPaths.theme, existing.currentDocument);
    }
    if (greetingTrackingInitialized) await persistStudioInternal(existingPaths, existing);
    return {
      state: await canonicalStudioState(existing, context.editorRoot, context.configPath),
      payload: bundle.payload,
      themesChanged: false,
      configChanged: false,
      apply: "draft",
    };
  }
  const source = await sourceThemeForStudio(context.theme, context.userThemesDir, locale);
  if (source.entry.source !== "user") {
    if (!context.builtinAuthoring) {
      throw new Error("Built-in themes must be duplicated before editing");
    }
    const authority = requireBuiltinAuthoring(context);
    const builtin = await sourceThemeForBuiltinAuthoring(context.theme, authority, locale);
    const paths = studioPaths(context.editorRoot);
    return replaceActiveStudio(paths, async () => {
      const document = await studioDocumentFromResolvedSource({
        entry: { ...builtin.entry, source: "builtin" },
        theme: builtin.theme,
        targetId: context.theme,
        paths,
        copyLabels: false,
        stableLayerIds: true,
        builtinLayoutCapability: BUILTIN_STUDIO_LAYOUT_VALIDATION,
      });
      // The full built-in recipe is already materialized in this private draft.
      // Layout authoring must not read a second recipe from a different root.
      document.sourceRecipe = null;
      document.controlOverrides = [];
      validateStudioThemeKitDocument(document, "built-in layout draft", {
        builtinLayoutCapability: BUILTIN_STUDIO_LAYOUT_VALIDATION,
      });
      return beginStudioDocument(document, {
        sourceId: context.theme,
        source: "builtin",
        isNew: false,
        editKind: "builtin-layout",
        registrySha256: builtin.registry.sha256,
        sourceSnapshot: builtin.sourceSnapshot,
      }, { ...context, locale });
    });
  }
  const paths = studioPaths(context.editorRoot);
  return replaceActiveStudio(paths, async () => {
    const created = await studioDocumentFromSource({
      sourceId: context.theme,
      targetId: context.theme,
      userThemesDir: context.userThemesDir,
      locale,
      paths,
      copyLabels: false,
    });
    return beginStudioDocument(created.document, {
      sourceId: context.theme,
      source: "user",
      isNew: false,
    }, { ...context, locale });
  });
}

export async function mutateStudio(context, action, mutate) {
  const internal = await loadStudioInternal(context.editorRoot);
  assertStudioRevision(internal, context);
  await ensureStudioGreetingTracking(internal, context.configPath);
  assertBuiltinLayoutSession(context, internal);
  const before = cloneJson(internal.currentDocument);
  const beforeGreeting = cloneJson(internal.greetingCurrent);
  const beforeLauncherMarkDigest = internal.launcherMarkDigest;
  const candidate = cloneJson(internal.currentDocument);
  const mutation = await mutate(candidate, internal);
  const candidateGreeting = mutation?.greetingPreferences === undefined
    ? beforeGreeting
    : validateGreetingPreferences(mutation.greetingPreferences, "editor greeting candidate");
  if (internal.editKind === "builtin-layout") {
    assertBuiltinLayoutDocumentChange(internal.baselineDocument, candidate);
    if (JSON.stringify(candidateGreeting) !== JSON.stringify(internal.greetingBaseline)
        || (mutation?.launcherMarkDigest ?? beforeLauncherMarkDigest) !== internal.baselineLauncherMarkDigest) {
      throw new Error("Built-in layout authoring cannot change host-owned or launcher data");
    }
  }
  internal.undo = [...internal.undo, before].slice(-STUDIO_MAX_HISTORY);
  internal.appliedUndo = [...internal.appliedUndo, cloneJson(internal.lastValidDocument)].slice(-STUDIO_MAX_HISTORY);
  internal.launcherUndo = [...internal.launcherUndo, beforeLauncherMarkDigest].slice(-STUDIO_MAX_HISTORY);
  internal.appliedLauncherUndo = [
    ...internal.appliedLauncherUndo,
    internal.lastValidLauncherMarkDigest,
  ].slice(-STUDIO_MAX_HISTORY);
  internal.greetingUndo = [...internal.greetingUndo, beforeGreeting].slice(-STUDIO_MAX_HISTORY);
  internal.greetingAppliedUndo = [
    ...internal.greetingAppliedUndo,
    cloneJson(internal.greetingLastValid),
  ].slice(-STUDIO_MAX_HISTORY);
  internal.redo = [];
  internal.appliedRedo = [];
  internal.launcherRedo = [];
  internal.appliedLauncherRedo = [];
  internal.greetingRedo = [];
  internal.greetingAppliedRedo = [];
  internal.currentDocument = candidate;
  internal.greetingCurrent = cloneJson(candidateGreeting);
  internal.launcherMarkDigest = mutation?.launcherMarkDigest ?? beforeLauncherMarkDigest;
  internal.revision += 1;
  if (studioDocumentUsesLocalLauncher(candidate)) {
    if (internal.launcherMarkDigest === null) throw new Error("Editor launcher mark content is missing");
    await materializeStudioLauncherMark(studioPaths(context.editorRoot), internal.launcherMarkDigest);
  }
  const evaluated = await evaluateStudioDocument(candidate, context, {
    greetingPreferences: candidateGreeting,
    builtinLayoutCapability: internal.editKind === "builtin-layout"
      ? BUILTIN_STUDIO_LAYOUT_VALIDATION
      : null,
  });
  internal.feedback = evaluated.feedback;
  if (evaluated.feedback.valid) {
    internal.lastValidDocument = cloneJson(candidate);
    internal.lastValidLauncherMarkDigest = internal.launcherMarkDigest;
    internal.greetingLastValid = cloneJson(candidateGreeting);
  }
  await persistStudioInternal(studioPaths(context.editorRoot), internal);
  const state = withStudioResult(
    await canonicalStudioState(internal, context.editorRoot, context.configPath),
    action,
    evaluated.feedback.valid,
    evaluated.error,
  );
  return {
    state,
    payload: evaluated.feedback.valid ? evaluated.bundle.payload : null,
    themesChanged: false,
    configChanged: false,
    apply: evaluated.feedback.valid ? "draft" : "none",
  };
}

export function updateStudioPreview(document, token, hex) {
  const key = {
    canvas: "background",
    sidebar: "chrome",
    surface: "surface",
    text: "text",
    accent: "accent",
  }[token];
  if (key) document.preview[key] = hex.toUpperCase();
}

export function mutateStudioTokenDocument(document, change) {
  const mode = change.mode;
  const token = change.token;
  if (!["light", "dark", "shared", "mode-copy"].includes(mode)) throw new Error("Theme token mode is invalid");
  if (mode === "mode-copy") {
    if (token !== "tokens" || !["light", "dark"].includes(change.value)) throw new Error("Mode copy is invalid");
    const source = change.value;
    const target = source === "light" ? "dark" : "light";
    document.theme[target].semantic = cloneJson(document.theme[source].semantic);
    document.theme[target].wallpaper.surfaceAlpha = document.theme[source].wallpaper.surfaceAlpha;
    document.theme[target].wallpaper.sidebarAlpha = document.theme[source].wallpaper.sidebarAlpha;
    return;
  }
  if (mode === "light" || mode === "dark") {
    if (Object.hasOwn(STUDIO_COLOR_TOKENS, token)) {
      document.theme[mode].semantic[STUDIO_COLOR_TOKENS[token]] = hexToHsl(change.value, `${mode}.${token}`);
      updateStudioPreview(document, token, change.value);
      return;
    }
    if (token === "surfaceAlpha") {
      document.theme[mode].wallpaper.surfaceAlpha = strictNumber(change.value, `${mode}.${token}`, 0.35, 1);
      return;
    }
    if (token === "sidebarAlpha") {
      document.theme[mode].wallpaper.sidebarAlpha = strictNumber(change.value, `${mode}.${token}`, 0.62, 1);
      return;
    }
    throw new Error("Theme token is invalid");
  }
  if (!STUDIO_SHARED_TOKENS.has(token)) throw new Error("Shared theme token is invalid");
  if (token === "fontUi") {
    document.theme.typography.ui = STUDIO_FONT_UI_STACKS[strictEnum(change.value, new Set(Object.keys(STUDIO_FONT_UI_STACKS)), "fontUi")];
    document.theme.typography.body = document.theme.typography.ui;
  } else if (token === "fontDisplay") {
    document.theme.typography.display = STUDIO_FONT_DISPLAY_STACKS[strictEnum(change.value, new Set(Object.keys(STUDIO_FONT_DISPLAY_STACKS)), "fontDisplay")];
  } else if (token === "radius") {
    const radius = strictNumber(change.value, "radius", 0, 32);
    document.theme.radius = radius;
    document.theme.shape = studioRadiusPolicy(radius, document.theme.shape.borderWidth);
  } else if (token === "blur") {
    document.theme.blur = strictNumber(change.value, "blur", 0, 40);
  } else if (token === "shadow") {
    const id = strictEnum(change.value, new Set(Object.keys(STUDIO_SHADOWS)), "shadow");
    Object.assign(document.theme.effects, STUDIO_SHADOWS[id]);
  } else if (token === "backgroundScope") {
    document.backgroundScope = strictEnum(
      change.value,
      new Set(["sidebar", "content", "full-window"]),
      "backgroundScope",
    );
  } else if (token.startsWith("launcher")) {
    const property = {
      launcherSurface: "surface",
      launcherSurfaceHover: "surfaceHover",
      launcherForeground: "foreground",
      launcherAccent: "accent",
      launcherBorder: "border",
      launcherRadius: "radius",
      launcherBorderWidth: "borderWidth",
    }[token];
    if (!property) throw new Error("Launcher token is invalid");
    if (["radius", "borderWidth"].includes(property)) {
      const minimum = property === "radius" ? 8 : 1;
      const maximum = property === "radius" ? 24 : 3;
      document.theme.launcher[property] = strictNumber(change.value, token, minimum, maximum);
    } else {
      if (typeof change.value !== "string" || !/^#[0-9A-Fa-f]{6}$/.test(change.value)) {
        throw new Error(`${token} must be a six-digit hex color`);
      }
      document.theme.launcher[property] = change.value.toUpperCase();
    }
  } else {
    const layout = document.newChatLayout ?? { widthRatio: 0.76, offsetXRatio: 0, offsetYRatio: 0 };
    if (token === "promptWidth") layout.widthRatio = strictNumber(change.value, token, 0.4, 0.96);
    else if (token === "promptX") layout.offsetXRatio = strictNumber(change.value, token, -0.35, 0.35);
    else if (token === "promptY") layout.offsetYRatio = strictNumber(change.value, token, -0.3, 0.3);
    document.newChatLayout = layout;
  }
  if (document.sourceRecipe !== null && STUDIO_RECIPE_CONTROL_OVERRIDES.has(token)
      && !document.controlOverrides.includes(token)) {
    document.controlOverrides.push(token);
  }
}

export async function setThemeToken(context) {
  if (!["light", "dark", "shared", "mode-copy"].includes(context.mode)) throw new Error("Theme token mode is invalid");
  return mutateStudio(context, "set-theme-token", async (document) => {
    if (document.newChatLayout === null && context.mode === "shared"
        && ["promptWidth", "promptX", "promptY"].includes(context.token)) {
      throw new Error("The native new-chat area must be adopted in one complete placement change");
    }
    const previousScope = document.backgroundScope;
    mutateStudioTokenDocument(document, context);
    await reframeStudioBackgroundLayers(
      document,
      context,
      previousScope,
      document.backgroundScope,
    );
  });
}

export function mutateStudioLayerDocument(document, change) {
    const index = strictInteger(change.index, "layer index", 0, document.artworkLayers.length - 1);
    const layer = document.artworkLayers[index];
    if (change.preset === "shared") {
      const property = change.property;
      if (!["role", "appearance", "context", "viewport", "visible", "opacity", "mask", "mobile"].includes(property)) {
        throw new Error("Shared layer property is invalid");
      }
      if (property === "role") layer.role = strictEnum(change.value, STUDIO_LAYER_ROLES, "layer role");
      else if (property === "appearance") layer.appearance = strictEnum(change.value, STUDIO_LAYER_APPEARANCES, "layer appearance");
      else if (property === "context") {
        layer.context = strictEnum(change.value, STUDIO_LAYER_CONTEXTS, "layer context");
        if (layer.legacy) layer.legacy.contextOverrides = null;
      }
      else if (property === "viewport") layer.viewport = strictEnum(change.value, STUDIO_LAYER_VIEWPORTS, "layer viewport");
      else if (property === "visible") {
        if (typeof change.value !== "boolean") throw new Error("Layer visibility must be true or false");
        layer.visible = change.value;
      } else if (property === "opacity") layer.opacity = strictNumber(change.value, "layer opacity", 0, 1);
      else if (property === "mask") layer.mask = strictEnum(change.value, STUDIO_LAYER_MASKS, "layer mask");
      else layer.mobile = strictEnum(change.value, STUDIO_LAYER_MOBILE, "layer mobile behavior");
      return;
    }
    if (!["normal", "wide"].includes(change.preset)) throw new Error("Layer framing preset is invalid");
    const frame = layer.frames[change.preset];
    if (change.property === "anchor") frame.anchor = strictEnum(change.value, STUDIO_LAYER_ANCHORS, "layer anchor");
    else if (["focalX", "focalY"].includes(change.property)) frame[change.property] = strictNumber(change.value, change.property, 0, 100);
    else if (["positionX", "positionY"].includes(change.property)) frame[change.property] = strictNumber(change.value, change.property, -100, 100);
    else if (change.property === "scale") frame.scale = strictNumber(change.value, "scale", 0.25, 3);
    else throw new Error("Layer framing property is invalid");
    delete layer.legacy;
}

export async function setThemeLayer(context) {
  return mutateStudio(context, "set-theme-layer", (document) => mutateStudioLayerDocument(document, context));
}

export function mutateStudioMetadataDocument(document, change) {
  const settingsByField = {
    label: { key: "labels", legacy: "label", maximum: 80 },
    description: { key: "descriptions", legacy: "description", maximum: 220 },
  };
  if (!Object.hasOwn(settingsByField, change.field)) throw new Error("Theme metadata field is invalid");
  const settings = settingsByField[change.field];
  const locale = strictEnum(change.locale, new Set(STUDIO_METADATA_LOCALES), "theme metadata locale");
  if (!Object.hasOwn(document.labels, locale) || !Object.hasOwn(document.descriptions, locale)) {
    throw new Error("Theme metadata locale is not enabled");
  }
  if (typeof change.value !== "string") throw new Error(`Theme ${change.field} must be a string`);
  const value = change.value.trim();
  if (value.length > settings.maximum || /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/u.test(value)) {
    throw new Error(`Theme ${change.field} must be at most ${settings.maximum} characters and contain no control characters`);
  }
  document[settings.key][locale] = value;
  if (locale === "en" && value) document.theme[settings.legacy] = value;
}

export function mutateStudioMetadataLocaleDocument(document, change) {
  const locale = strictEnum(change.locale, new Set(STUDIO_METADATA_LOCALES), "theme metadata locale");
  if (typeof change.enabled !== "boolean") throw new Error("Theme metadata locale enabled must be true or false");
  if (locale === "en" && !change.enabled) throw new Error("English theme metadata cannot be removed");
  if (change.enabled) {
    if (!Object.hasOwn(document.labels, locale)) document.labels[locale] = "";
    if (!Object.hasOwn(document.descriptions, locale)) document.descriptions[locale] = "";
    return;
  }
  delete document.labels[locale];
  delete document.descriptions[locale];
}

export function assertStudioPatchChanges(changes) {
  if (!Array.isArray(changes) || changes.length < 1 || changes.length > STUDIO_MAX_PATCH_CHANGES) {
    throw new Error(`Theme patch must contain 1 to ${STUDIO_MAX_PATCH_CHANGES} changes`);
  }
  const shapes = {
    token: ["kind", "mode", "token", "value"],
    layer: ["kind", "index", "preset", "property", "value"],
    metadata: ["kind", "field", "locale", "value"],
    "metadata-locale": ["kind", "locale", "enabled"],
    greeting: ["kind", "operation", "appearance", "frame", "value"],
  };
  changes.forEach((change, index) => {
    if (!isPlainObject(change) || typeof change.kind !== "string" || !Object.hasOwn(shapes, change.kind)) {
      throw new Error(`Theme patch change ${index} has an unsupported kind`);
    }
    const expected = shapes[change.kind].sort();
    const actual = Object.keys(change).sort();
    if (actual.length !== expected.length || actual.some((key, keyIndex) => key !== expected[keyIndex])) {
      throw new Error(`Theme patch change ${index} must contain only ${expected.join(", ")}`);
    }
  });
}

async function reframeStudioBackgroundLayers(
  document,
  context,
  previousScope,
  nextScope,
  {
    explicitScales = new Set(),
    roleOverrides = new Map(),
  } = {},
) {
  if (nextScope === previousScope) return;
  const activeRoot = studioPaths(context.editorRoot).active;
  for (let index = 0; index < document.artworkLayers.length; index += 1) {
    const layer = document.artworkLayers[index];
    const finalRole = roleOverrides.get(index) ?? layer.role;
    if (finalRole !== "background") continue;
    const image = await readStudioArtworkDimensions(
      activeRoot,
      layer.path,
      `Studio artwork layer ${index + 1}`,
    );
    for (const [preset, viewport] of Object.entries(STUDIO_FRAME_VIEWPORTS)) {
      if (explicitScales.has(`${index}:${preset}`)) continue;
      if (layer.legacy) {
        layer.frames[preset] = studioFrameFromLegacy(
          layer.legacy.position,
          layer.legacy.size,
          image,
          viewport,
          nextScope,
        );
      } else {
        layer.frames[preset].scale = studioReframeCoverScale(
          layer.frames[preset].scale,
          image,
          viewport,
          previousScope,
          nextScope,
        );
      }
    }
  }
}

export async function applyThemePatch(context) {
  assertStudioPatchChanges(context.changes);
  return mutateStudio(context, "apply-theme-patch", async (document) => {
    if (document.newChatLayout === null) {
      const promptChanges = context.changes.filter((change) => change.kind === "token"
        && change.mode === "shared" && ["promptWidth", "promptX", "promptY"].includes(change.token));
      if (promptChanges.length) {
        const tokens = new Set(promptChanges.map((change) => change.token));
        if (promptChanges.length !== 3 || tokens.size !== 3) {
          throw new Error("The native new-chat area must be adopted with width and both offsets together");
        }
      }
    }
    const scopeChanges = context.changes.filter((change) => change.kind === "token"
      && change.mode === "shared" && change.token === "backgroundScope");
    if (scopeChanges.length > 1) {
      throw new Error("A theme patch may change backgroundScope only once");
    }
    const previousScope = document.backgroundScope;
    const nextScope = scopeChanges.length
      ? strictEnum(
        scopeChanges[0].value,
        new Set(["sidebar", "content", "full-window"]),
        "backgroundScope",
      )
      : previousScope;
    if (nextScope !== previousScope) {
      const explicitScales = new Set(context.changes.flatMap((change) => (
        change.kind === "layer" && ["normal", "wide"].includes(change.preset)
          && change.property === "scale"
          ? [`${change.index}:${change.preset}`]
          : []
      )));
      const roleOverrides = new Map();
      for (const change of context.changes) {
        if (change.kind !== "layer" || change.preset !== "shared" || change.property !== "role") continue;
        const index = strictInteger(
          change.index,
          "layer index",
          0,
          document.artworkLayers.length - 1,
        );
        roleOverrides.set(
          index,
          strictEnum(change.value, STUDIO_LAYER_ROLES, "layer role"),
        );
      }
      await reframeStudioBackgroundLayers(
        document,
        context,
        previousScope,
        nextScope,
        { explicitScales, roleOverrides },
      );
    }
    for (const change of context.changes) {
      if (change.kind === "token") mutateStudioTokenDocument(document, change);
      else if (change.kind === "layer") mutateStudioLayerDocument(document, change);
      else if (change.kind === "greeting") mutateStudioGreetingDocument(document, change);
      else if (change.kind === "metadata") mutateStudioMetadataDocument(document, change);
      else mutateStudioMetadataLocaleDocument(document, change);
    }
  });
}

export async function validateStudioHostAsset(assetPath, editorRoot) {
  if (typeof assetPath !== "string" || !assetPath.trim()) throw new Error("A converted WebP asset is required");
  const paths = studioPaths(editorRoot);
  const candidate = path.resolve(assetPath);
  if (!isPathWithin(paths.root, candidate)) throw new Error("The converted asset must remain inside the editor data folder");
  const stat = await fs.lstat(candidate);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size <= 0 || stat.size >= MAX_USER_RASTER_ARTWORK_BYTES) {
    throw new Error("The converted asset must be a regular WebP file smaller than 400 KB");
  }
  const [realRoot, realCandidate] = await Promise.all([fs.realpath(paths.root), fs.realpath(candidate)]);
  if (!isPathWithin(realRoot, realCandidate)) throw new Error("The converted asset must remain inside the editor data folder");
  const bytes = await fs.readFile(candidate);
  if (detectImageMime(bytes) !== "image/webp") throw new Error("The converted asset must contain WebP image data");
  return candidate;
}

export async function attachThemeLayerImage(context) {
  const internal = await loadStudioInternal(context.editorRoot);
  assertStudioRevision(internal, context);
  const index = strictInteger(context.index, "layer index", -1, Math.max(-1, internal.currentDocument.artworkLayers.length - 1));
  const role = strictEnum(context.role, STUDIO_LAYER_ROLES, "layer role");
  const appearance = strictEnum(context.appearance, STUDIO_LAYER_APPEARANCES, "layer appearance");
  const pageContext = strictEnum(context.context, STUDIO_LAYER_CONTEXTS, "layer context");
  if (index === -1 && internal.currentDocument.artworkLayers.length >= STUDIO_MAX_LAYERS) {
    throw new Error(`A theme may contain at most ${STUDIO_MAX_LAYERS} artwork layers`);
  }
  const source = await validateStudioHostAsset(context.assetPath, context.editorRoot);
  const image = studioWebpDimensions(
    await fs.readFile(source),
    "Studio artwork import",
  );
  const ownedPath = await copyWebpIntoEditor(source, studioPaths(context.editorRoot));
  return mutateStudio(context, "pick-theme-layer-image", (document) => {
    const frames = Object.fromEntries(Object.entries(STUDIO_FRAME_VIEWPORTS).map(
      ([preset, viewport]) => [
        preset,
        role === "background"
          ? studioFrameFromLegacy("center", "cover", image, viewport, document.backgroundScope)
          : { anchor: "center", focalX: 50, focalY: 50, positionX: 0, positionY: 0, scale: 1 },
      ],
    ));
    if (index === -1) {
      document.artworkLayers.push({
        id: `layer-${studioHex()}`,
        path: ownedPath,
        role,
        appearance,
        context: pageContext,
        viewport: "all",
        visible: true,
        opacity: 1,
        mask: "none",
        mobile: "reduce",
        frames,
      });
    } else {
      document.artworkLayers[index].path = ownedPath;
      document.artworkLayers[index].role = role;
      if (role === "background") document.artworkLayers[index].frames = frames;
      delete document.artworkLayers[index].legacy;
    }
  });
}

export async function attachThemeLauncherMark(context) {
  const internal = await loadStudioInternal(context.editorRoot);
  assertStudioRevision(internal, context);
  const paths = studioPaths(context.editorRoot);
  const digest = await storeStudioLauncherMark(context.assetPath, paths);
  try {
    return await mutateStudio(context, "pick-theme-launcher-mark", (document) => {
      document.theme.launcher.asset = "launcher-mark.png";
      return { launcherMarkDigest: digest };
    });
  } catch (error) {
    try {
      const persisted = await loadStudioInternal(context.editorRoot);
      if (persisted) await garbageCollectStudioLauncherMarks(paths, persisted);
    } catch (cleanupError) {
      throw new AggregateError(
        [error, cleanupError],
        "The launcher mark update failed and its unreferenced stored file could not be cleaned up",
      );
    }
    throw error;
  }
}

export async function removeThemeLayer(context) {
  return mutateStudio(context, "remove-theme-layer", (document) => {
    const index = strictInteger(context.index, "layer index", 0, document.artworkLayers.length - 1);
    document.artworkLayers.splice(index, 1);
  });
}

export async function moveThemeLayer(context) {
  if (!["up", "down"].includes(context.direction)) throw new Error("Layer direction must be up or down");
  return mutateStudio(context, "move-theme-layer", (document) => {
    const index = strictInteger(context.index, "layer index", 0, document.artworkLayers.length - 1);
    const target = context.direction === "up" ? index - 1 : index + 1;
    if (target < 0 || target >= document.artworkLayers.length) throw new Error("The layer cannot move farther in that direction");
    [document.artworkLayers[index], document.artworkLayers[target]] = [document.artworkLayers[target], document.artworkLayers[index]];
  });
}

export async function travelStudioHistory(context, action, direction) {
  const internal = await loadStudioInternal(context.editorRoot);
  assertStudioRevision(internal, context);
  await ensureStudioGreetingTracking(internal, context.configPath);
  assertBuiltinLayoutSession(context, internal);
  const source = direction === "undo" ? internal.undo : internal.redo;
  const appliedSource = direction === "undo" ? internal.appliedUndo : internal.appliedRedo;
  const launcherSource = direction === "undo" ? internal.launcherUndo : internal.launcherRedo;
  const appliedLauncherSource = direction === "undo"
    ? internal.appliedLauncherUndo : internal.appliedLauncherRedo;
  const greetingSource = direction === "undo" ? internal.greetingUndo : internal.greetingRedo;
  const appliedGreetingSource = direction === "undo"
    ? internal.greetingAppliedUndo : internal.greetingAppliedRedo;
  if (!source.length) throw new Error(`There is nothing to ${direction}`);
  const destination = direction === "undo" ? internal.redo : internal.undo;
  const appliedDestination = direction === "undo" ? internal.appliedRedo : internal.appliedUndo;
  const launcherDestination = direction === "undo" ? internal.launcherRedo : internal.launcherUndo;
  const appliedLauncherDestination = direction === "undo"
    ? internal.appliedLauncherRedo : internal.appliedLauncherUndo;
  const greetingDestination = direction === "undo" ? internal.greetingRedo : internal.greetingUndo;
  const appliedGreetingDestination = direction === "undo"
    ? internal.greetingAppliedRedo : internal.greetingAppliedUndo;
  destination.push(cloneJson(internal.currentDocument));
  appliedDestination.push(cloneJson(internal.lastValidDocument));
  launcherDestination.push(internal.launcherMarkDigest);
  appliedLauncherDestination.push(internal.lastValidLauncherMarkDigest);
  greetingDestination.push(cloneJson(internal.greetingCurrent));
  appliedGreetingDestination.push(cloneJson(internal.greetingLastValid));
  for (const history of [
    destination, appliedDestination, launcherDestination, appliedLauncherDestination,
    greetingDestination, appliedGreetingDestination,
  ]) {
    if (history.length > STUDIO_MAX_HISTORY) history.splice(0, history.length - STUDIO_MAX_HISTORY);
  }
  internal.currentDocument = source.pop();
  const historicalAppliedDocument = appliedSource.pop();
  internal.launcherMarkDigest = launcherSource.pop() ?? null;
  const historicalAppliedLauncher = appliedLauncherSource.pop() ?? null;
  internal.greetingCurrent = greetingSource.pop();
  const historicalAppliedGreeting = appliedGreetingSource.pop();
  const restoredHistoricalAppliedState = historicalAppliedDocument !== null;
  if (restoredHistoricalAppliedState) {
    internal.lastValidDocument = historicalAppliedDocument;
    internal.lastValidLauncherMarkDigest = historicalAppliedLauncher;
    internal.greetingLastValid = historicalAppliedGreeting;
  }
  if (internal.editKind === "builtin-layout") {
    assertBuiltinLayoutDocumentChange(internal.baselineDocument, internal.currentDocument);
    assertBuiltinLayoutDocumentChange(internal.baselineDocument, internal.lastValidDocument);
    if (JSON.stringify(internal.greetingCurrent) !== JSON.stringify(internal.greetingBaseline)
        || JSON.stringify(internal.greetingLastValid) !== JSON.stringify(internal.greetingBaseline)
        || internal.launcherMarkDigest !== internal.baselineLauncherMarkDigest
        || internal.lastValidLauncherMarkDigest !== internal.baselineLauncherMarkDigest) {
      throw new Error("Built-in layout history contains a forbidden change");
    }
  }
  internal.revision += 1;
  const paths = studioPaths(context.editorRoot);
  if (studioDocumentUsesLocalLauncher(internal.currentDocument)) {
    if (internal.launcherMarkDigest === null) throw new Error("Editor launcher mark history is missing");
    await materializeStudioLauncherMark(paths, internal.launcherMarkDigest);
  }
  const evaluated = await evaluateStudioDocument(internal.currentDocument, context, {
    greetingPreferences: internal.greetingCurrent,
    builtinLayoutCapability: internal.editKind === "builtin-layout"
      ? BUILTIN_STUDIO_LAYOUT_VALIDATION
      : null,
  });
  internal.feedback = evaluated.feedback;
  let fallbackBundle = null;
  if (evaluated.feedback.valid) {
    internal.lastValidDocument = cloneJson(internal.currentDocument);
    internal.lastValidLauncherMarkDigest = internal.launcherMarkDigest;
    internal.greetingLastValid = cloneJson(internal.greetingCurrent);
  } else if (restoredHistoricalAppliedState) {
    // Undo/Redo can revisit an invalid editable document. Its historically
    // preceding valid payload may differ from the payload currently in Aura,
    // so compile and reapply that snapshot while keeping the invalid controls.
    try {
      if (studioDocumentUsesLocalLauncher(internal.lastValidDocument)) {
        if (internal.lastValidLauncherMarkDigest === null) {
          throw new Error("Editor applied launcher mark history is missing");
        }
        await materializeStudioLauncherMark(paths, internal.lastValidLauncherMarkDigest);
      }
      fallbackBundle = await compileStudioDocument(internal.lastValidDocument, context, {
        appearance: "system",
        greetingPreferences: internal.greetingLastValid,
        builtinLayoutCapability: internal.editKind === "builtin-layout"
          ? BUILTIN_STUDIO_LAYOUT_VALIDATION
          : null,
      });
    } finally {
      if (studioDocumentUsesLocalLauncher(internal.currentDocument)) {
        await materializeStudioLauncherMark(paths, internal.launcherMarkDigest);
      }
      await atomicWriteJson(paths.theme, internal.currentDocument);
    }
  }
  await persistStudioInternal(paths, internal);
  const payload = evaluated.feedback.valid ? evaluated.bundle.payload : fallbackBundle?.payload ?? null;
  return {
    state: withStudioResult(
      await canonicalStudioState(internal, context.editorRoot, context.configPath),
      action,
      evaluated.feedback.valid,
      evaluated.error,
    ),
    payload,
    themesChanged: false,
    configChanged: false,
    apply: payload ? "draft" : "none",
  };
}

export async function undoThemeEdit(context) {
  return travelStudioHistory(context, "undo-theme-edit", "undo");
}

export async function redoThemeEdit(context) {
  return travelStudioHistory(context, "redo-theme-edit", "redo");
}

export async function callStudioFault(context, stage) {
  if (typeof context.faultInjector === "function") await context.faultInjector(stage);
}

export async function runStudioRecoveryOperation(context, stage, operation) {
  const wait = typeof context.recoveryWait === "function"
    ? context.recoveryWait
    : (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
  for (let attempt = 0; ; attempt += 1) {
    try {
      if (typeof context.recoveryFaultInjector === "function") {
        await context.recoveryFaultInjector(stage, attempt);
      }
      await operation();
      return;
    } catch (error) {
      if (!WINDOWS_TRANSIENT_FILESYSTEM_CODES.includes(error.code)
          || attempt >= WINDOWS_FILESYSTEM_RETRY_DELAYS_MS.length) throw error;
      await wait(WINDOWS_FILESYSTEM_RETRY_DELAYS_MS[attempt]);
    }
  }
}

export async function collectStudioRecoveryFailure(context, recoveryErrors, stage, operation) {
  try {
    await runStudioRecoveryOperation(context, stage, operation);
    return true;
  } catch (error) {
    const stagedError = new Error(`${stage}: ${error.message}`, { cause: error });
    stagedError.code = error.code;
    stagedError.recoveryStage = stage;
    recoveryErrors.push(stagedError);
    return false;
  }
}

export async function stageStudioTheme(document, activeDirectory, stageDirectory) {
  await fs.mkdir(path.join(stageDirectory, "artwork"), { recursive: true });
  await fs.writeFile(path.join(stageDirectory, THEME_KIT_FILENAME), `${JSON.stringify(document, null, 2)}\n`, {
    encoding: "utf8",
    flag: "wx",
  });
  const copied = new Set();
  for (const layer of document.artworkLayers) {
    if (copied.has(layer.path)) continue;
    const source = path.resolve(activeDirectory, layer.path);
    const target = path.resolve(stageDirectory, layer.path);
    if (!isPathWithin(activeDirectory, source) || !isPathWithin(stageDirectory, target)) {
      throw new Error("Theme artwork escaped its owned folder");
    }
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.copyFile(source, target, fsConstants.COPYFILE_EXCL);
    copied.add(layer.path);
  }
  if (document.theme.launcher.asset === "launcher-mark.png") {
    const source = path.resolve(activeDirectory, document.theme.launcher.asset);
    const target = path.resolve(stageDirectory, document.theme.launcher.asset);
    if (!isPathWithin(activeDirectory, source) || !isPathWithin(stageDirectory, target)) {
      throw new Error("Theme launcher mark escaped its owned folder");
    }
    await fs.copyFile(source, target, fsConstants.COPYFILE_EXCL);
  }
}

export async function validateStudioStage(document, stageDirectory, context) {
  await readThemeKit(stageDirectory, {
    expectedId: document.id,
    builtinLayoutCapability: context.builtinLayoutCapability ?? null,
  });
  for (const appearance of ["light", "dark"]) {
    const persisted = await readConfig(context.configPath);
    const compiled = await compileTheme({
      configPath: context.configPath,
      config: {
        ...persisted,
        enabled: true,
        theme: document.id,
        appearance,
        ...(context.greetingPreferences === undefined ? {} : {
          greetingPreferences: validateGreetingPreferences(context.greetingPreferences),
        }),
      },
      locale: context.locale,
      userThemesDir: context.userThemesDir,
      themeKitDirectory: stageDirectory,
      builtinLayoutCapability: context.builtinLayoutCapability ?? null,
    });
    const bundle = await buildPayloadFromCompiled(compiled);
    new Function(bundle.payload);
  }
}

export function reconcileStudioGreetingShuffle(draft, persistedValue) {
  const current = validateGreetingPreferences(draft, "editor greeting draft");
  const persisted = validateGreetingPreferences(persistedValue ?? null, "persisted greeting preferences");
  const editable = (value) => ({
    enabled: value.enabled,
    source: value.source,
    displayName: value.displayName,
    globalPhrases: value.globalPhrases,
    themeOverrides: value.themeOverrides,
  });
  if (JSON.stringify(editable(current)) === JSON.stringify(editable(persisted))) {
    current.shuffle = cloneJson(persisted.shuffle);
  }
  return current;
}

function registryThemeObjectSpan(text, themeIndex) {
  const property = text.indexOf("\"themes\"");
  if (property < 0) throw new Error("themes/registry.json is missing themes");
  const arrayStart = text.indexOf("[", property + 8);
  if (arrayStart < 0) throw new Error("themes/registry.json themes must be an array");
  let index = -1;
  let cursor = arrayStart + 1;
  while (cursor < text.length) {
    while (/[\s,]/u.test(text[cursor] ?? "")) cursor += 1;
    if (text[cursor] === "]") break;
    if (text[cursor] !== "{") throw new Error("themes/registry.json contains a non-object theme");
    index += 1;
    const start = cursor;
    let depth = 0;
    let quoted = false;
    let escaped = false;
    for (; cursor < text.length; cursor += 1) {
      const character = text[cursor];
      if (quoted) {
        if (escaped) escaped = false;
        else if (character === "\\") escaped = true;
        else if (character === "\"") quoted = false;
        continue;
      }
      if (character === "\"") quoted = true;
      else if (character === "{") depth += 1;
      else if (character === "}") {
        depth -= 1;
        if (depth === 0) {
          const end = cursor + 1;
          if (index === themeIndex) return { start, end };
          cursor = end;
          break;
        }
      }
    }
  }
  throw new Error("Built-in theme registry entry could not be located");
}

function replaceRegistryThemeEntry(text, themeIndex, entry) {
  const { start, end } = registryThemeObjectSpan(text, themeIndex);
  const lineStart = text.lastIndexOf("\n", start - 1) + 1;
  const indent = text.slice(lineStart, start);
  const newline = text.includes("\r\n") ? "\r\n" : "\n";
  const replacement = JSON.stringify(entry, null, 2)
    .split("\n")
    .map((line, index) => (index === 0 ? line : `${indent}${line}`))
    .join(newline);
  return `${text.slice(0, start)}${replacement}${text.slice(end)}`;
}

function builtinRegistryLayerFromDraft(
  themeId,
  index,
  original,
  draft,
  { singularArtwork = false } = {},
) {
  const expectedId = original.id ?? stableBuiltinStudioLayerId(themeId, index, original.path);
  if (draft.id !== expectedId) throw new Error("Built-in artwork layer identity is invalid");
  const immutable = singularArtwork
    ? {
      role: "background",
      appearance: "all",
      context: "all",
      viewport: "all",
      visible: true,
      opacity: 1,
      mask: "soft-right",
      mobile: original.mobile === "hide" ? "hide" : "reduce",
    }
    : {
      role: STUDIO_LAYER_ROLES.has(original.role) ? original.role : "decoration",
      appearance: original.appearance ?? "all",
      context: original.context ?? studioContextFromLegacy(original.contextOverrides),
      viewport: original.viewport ?? "all",
      visible: original.visible ?? true,
      opacity: original.opacity ?? 1,
      mask: original.mask ?? "soft-right",
      mobile: original.mobile ?? "reduce",
    };
  if (Object.entries(immutable).some(([key, value]) => draft[key] !== value)) {
    throw new Error("Built-in artwork immutable attributes changed");
  }
  return {
    id: expectedId,
    path: original.path,
    ...immutable,
    frames: cloneJson(draft.frames),
  };
}

function builtinRegistryEntryFromDraft(rawEntry, draft) {
  const next = cloneJson(rawEntry);
  next.newChatLayout = draft.newChatLayout === null ? null : cloneJson(draft.newChatLayout);
  next.newChatGreetingStyle = draft.newChatGreetingStyle === null
    ? null
    : cloneJson(draft.newChatGreetingStyle);
  const originalLayers = rawEntry.artworkLayers
    ?? (rawEntry.artwork ? [rawEntry.artwork] : []);
  const singularArtwork = !rawEntry.artworkLayers && Boolean(rawEntry.artwork);
  if (originalLayers.length !== draft.artworkLayers.length) {
    throw new Error("Built-in artwork layer count changed");
  }
  if (originalLayers.length) {
    const serialized = originalLayers.map((original, index) => {
      const layer = draft.artworkLayers[index];
      return layer.legacy === undefined
        ? builtinRegistryLayerFromDraft(draft.id, index, original, layer, {
          singularArtwork,
        })
        : cloneJson(original);
    });
    if (rawEntry.artworkLayers) next.artworkLayers = serialized;
    else if (serialized.some((layer) => Object.hasOwn(layer, "frames"))) {
      next.artwork = null;
      next.artworkLayers = serialized;
    }
  }
  return next;
}

async function validateInstalledBuiltinPayloads(context, internal) {
  const config = await readConfig(context.configPath);
  for (const appearance of ["light", "dark"]) {
    const compiled = await compileTheme({
      configPath: context.configPath,
      config: {
        ...config,
        enabled: true,
        theme: internal.id,
        appearance,
        greetingPreferences: internal.greetingCurrent,
      },
      locale: context.locale,
      userThemesDir: context.userThemesDir,
    });
    const bundle = await buildPayloadFromCompiled(compiled);
    new Function(bundle.payload);
  }
}

async function regenerateBuiltinStudioThemes(authority) {
  const scriptPath = path.join(authority.root, "scripts", "build-studio-themes.mjs");
  const outputPath = path.join(authority.root, "studio", "generated-themes.js");
  for (const [candidate, label] of [
    [scriptPath, "Studio metadata builder"],
    [outputPath, "Studio generated metadata"],
  ]) {
    const stat = await pathKind(candidate);
    if (!stat?.isFile() || stat.isSymbolicLink()) {
      throw new Error(`${label} must be a real source-checkout file`);
    }
    const realCandidate = await fs.realpath(candidate);
    if (!isPathWithin(authority.root, realCandidate)) {
      throw new Error(`${label} escaped the source checkout`);
    }
  }
  await execStudioFile(process.execPath, [scriptPath], {
    cwd: authority.root,
    windowsHide: true,
    encoding: "utf8",
    maxBuffer: 1024 * 1024,
  });
  const generated = await fs.readFile(outputPath, "utf8");
  if (!/^\/\/ Generated by scripts\/build-studio-themes\.mjs\.\r?\nwindow\.CLAUDE_AURA_THEMES = /u.test(generated)) {
    throw new Error("Studio generated metadata was not regenerated correctly");
  }
  return { outputPath, sha256: studioSha256(Buffer.from(generated, "utf8")) };
}

async function restoreStudioFileIfOwned(
  authority,
  target,
  previousContents,
  ownedSha256,
  label,
) {
  const currentSha256 = await readStudioFileDigest(target);
  if (currentSha256 !== ownedSha256) {
    const error = new Error(`rollback ${label}: a later external edit was preserved`);
    error.code = "STUDIO_CONCURRENT_CHANGE";
    throw error;
  }
  if (previousContents === null) await fs.rm(target, { force: true });
  else await atomicWriteBuiltinSourceText(authority, target, previousContents);
}

async function saveBuiltinLayoutEdit(context, internal) {
  const authority = requireBuiltinAuthoring(context);
  assertBuiltinLayoutSession(context, internal);
  const paths = studioPaths(context.editorRoot);
  const evaluated = await evaluateStudioDocument(internal.currentDocument, context, {
    greetingPreferences: internal.greetingCurrent,
    builtinLayoutCapability: BUILTIN_STUDIO_LAYOUT_VALIDATION,
  });
  if (!evaluated.feedback.valid) {
    internal.feedback = evaluated.feedback;
    await persistStudioInternal(paths, internal);
    return {
      state: withStudioResult(
        await canonicalStudioState(internal, context.editorRoot, context.configPath),
        "save-theme-edit",
        false,
        evaluated.error ?? "contrast-or-budget",
      ),
      payload: null,
      themesChanged: false,
      configChanged: false,
      apply: "none",
    };
  }
  // Validate both production appearances from the exact private draft before
  // publishing any source file.
  await validateStudioStage(internal.currentDocument, paths.active, {
    ...context,
    greetingPreferences: internal.greetingCurrent,
    builtinLayoutCapability: BUILTIN_STUDIO_LAYOUT_VALIDATION,
  });
  const lock = await acquireBuiltinAuthoringLock(authority);
  const generatedPath = authority.generatedPath;
  let transaction = null;
  let previousRegistryText = null;
  let previousStateText = null;
  let previousThemeText = null;
  let previousGeneratedText = null;
  let nextRegistrySha256 = null;
  let generatedPublishedSha256 = null;
  let publicationStarted = false;
  try {
    const registry = await readBuiltinAuthoringRegistry(authority);
    if (registry.sha256 !== internal.registrySha256) {
      throw new Error("Built-in theme registry changed since this edit began; the draft was preserved");
    }
    const themeIndex = registry.raw.themes.findIndex((entry) => entry.id === internal.id);
    if (themeIndex < 0 || !FROZEN_BUILTIN_THEME_IDS.has(internal.id)) {
      throw new Error("Built-in theme is no longer registered");
    }
    const sourceSnapshot = await readBuiltinSourceSnapshot(
      authority,
      registry.raw.themes[themeIndex],
    );
    if (JSON.stringify(sourceSnapshot) !== JSON.stringify(internal.sourceSnapshot)) {
      throw new Error("Built-in theme source or artwork changed since this edit began; the draft was preserved");
    }
    const nextEntry = builtinRegistryEntryFromDraft(
      registry.raw.themes[themeIndex],
      internal.currentDocument,
    );
    const nextRaw = cloneJson(registry.raw);
    nextRaw.themes[themeIndex] = cloneJson(nextEntry);
    validateBuiltinAuthoringRegistry(nextRaw);
    previousRegistryText = registry.bytes.toString("utf8");
    const nextRegistryText = replaceRegistryThemeEntry(previousRegistryText, themeIndex, nextEntry);
    const parsedNext = JSON.parse(nextRegistryText);
    validateBuiltinAuthoringRegistry(parsedNext);
    if (JSON.stringify(parsedNext) !== JSON.stringify(nextRaw)) {
      throw new Error("Built-in registry patch changed data outside the selected theme");
    }
    nextRegistrySha256 = studioSha256(Buffer.from(nextRegistryText, "utf8"));
    [previousStateText, previousThemeText, previousGeneratedText] = await Promise.all([
      fs.readFile(paths.state, "utf8"),
      fs.readFile(paths.theme, "utf8"),
      generatedPath
        ? fs.readFile(generatedPath, "utf8").then((value) => value, (error) => {
          if (error.code === "ENOENT") return null;
          throw error;
        })
        : null,
    ]);
    transaction = {
      schemaVersion: 1,
      transactionId: studioHex(),
      registryBeforeSha256: registry.sha256,
      intendedRegistrySha256: nextRegistrySha256,
      createdAt: new Date().toISOString(),
    };
    if (await pathKind(authority.transactionPath)) {
      throw new Error("A built-in authoring recovery transaction is still pending");
    }
    await atomicWriteText(
      authority.transactionPath,
      `${JSON.stringify(transaction, null, 2)}\n`,
    );
    await callStudioFault(context, "before-builtin-registry");
    const prePublicationRegistry = await readBuiltinAuthoringRegistry(authority);
    if (prePublicationRegistry.sha256 !== registry.sha256) {
      throw new Error("Built-in theme registry changed before publication; the draft was preserved");
    }
    const prePublicationSource = await readBuiltinSourceSnapshot(
      authority,
      prePublicationRegistry.raw.themes[themeIndex],
    );
    if (JSON.stringify(prePublicationSource) !== JSON.stringify(internal.sourceSnapshot)) {
      throw new Error("Built-in theme source or artwork changed before publication; the draft was preserved");
    }
    await atomicWriteBuiltinSourceText(authority, authority.registryPath, nextRegistryText);
    publicationStarted = true;
    await callStudioFault(context, "after-builtin-registry");
    const published = await readBuiltinAuthoringRegistry(authority);
    if (JSON.stringify(published.raw) !== JSON.stringify(nextRaw)) {
      throw new Error("Published built-in registry did not match the validated transaction");
    }
    // The production checkout can now be compiled through the real registry.
    // Tests using an injected checkout already compiled the identical Studio
    // document above and intentionally do not redirect global runtime paths.
    if (sameStudioPath(authority.root, PROJECT_ROOT)) {
      await validateInstalledBuiltinPayloads(context, internal);
    }
    const generatedResult = await regenerateBuiltinStudioThemesForAuthority(authority);
    if (!generatedResult?.outputPath
        || !sameStudioPath(generatedResult.outputPath, generatedPath)
        || typeof generatedResult.sha256 !== "string"
        || !/^[a-f0-9]{64}$/.test(generatedResult.sha256)) {
      throw new Error("Built-in Studio metadata regeneration did not report the expected output");
    }
    generatedPublishedSha256 = generatedResult.sha256;
    await callStudioFault(context, "after-builtin-studio-metadata");
    const savedInternal = cloneJson(internal);
    savedInternal.source = "builtin";
    savedInternal.sourceId = savedInternal.id;
    savedInternal.isNew = false;
    savedInternal.editKind = "builtin-layout";
    savedInternal.baselineDocument = cloneJson(savedInternal.currentDocument);
    savedInternal.lastValidDocument = cloneJson(savedInternal.currentDocument);
    savedInternal.baselineLauncherMarkDigest = savedInternal.launcherMarkDigest;
    savedInternal.lastValidLauncherMarkDigest = savedInternal.launcherMarkDigest;
    savedInternal.greetingBaseline = cloneJson(savedInternal.greetingCurrent);
    savedInternal.greetingLastValid = cloneJson(savedInternal.greetingCurrent);
    for (const property of [
      "undo", "redo", "appliedUndo", "appliedRedo", "launcherUndo", "launcherRedo",
      "appliedLauncherUndo", "appliedLauncherRedo", "greetingUndo", "greetingRedo",
      "greetingAppliedUndo", "greetingAppliedRedo",
    ]) savedInternal[property] = [];
    savedInternal.feedback = evaluated.feedback;
    savedInternal.revision += 1;
    const [finalRegistry, finalSourceSnapshot, finalGeneratedSha256] = await Promise.all([
      readBuiltinAuthoringRegistry(authority),
      readBuiltinSourceSnapshot(authority, nextRaw.themes[themeIndex]),
      readStudioFileDigest(generatedPath),
    ]);
    if (finalRegistry.sha256 !== nextRegistrySha256
        || JSON.stringify(finalRegistry.raw) !== JSON.stringify(nextRaw)) {
      throw new Error("Built-in theme registry changed after publication");
    }
    if (JSON.stringify(finalSourceSnapshot) !== JSON.stringify(internal.sourceSnapshot)) {
      throw new Error("Built-in theme source or artwork changed during publication");
    }
    if (finalGeneratedSha256 !== generatedPublishedSha256) {
      throw new Error("Built-in Studio generated metadata changed after publication");
    }
    savedInternal.registrySha256 = finalRegistry.sha256;
    savedInternal.sourceSnapshot = finalSourceSnapshot;
    await persistStudioInternal(paths, savedInternal, { collectLauncherMarks: false });
    await callStudioFault(context, "after-builtin-editor-state");
    await collectStudioLauncherMarksAfterCommit(paths, savedInternal);
    await clearBuiltinTransactionMarker(authority, transaction.transactionId);
    return {
      state: withStudioResult(
        await canonicalStudioState(savedInternal, context.editorRoot, context.configPath),
        "save-theme-edit",
        true,
        null,
      ),
      payload: evaluated.bundle.payload,
      themesChanged: true,
      configChanged: false,
      apply: "saved",
    };
  } catch (error) {
    const recoveryErrors = [];
    if (transaction && !publicationStarted) {
      const currentRegistrySha256 = await readStudioFileDigest(authority.registryPath);
      if (currentRegistrySha256 !== transaction.registryBeforeSha256) {
        const concurrentError = new Error(
          "rollback registry: a concurrent pre-publication edit was preserved",
        );
        concurrentError.code = "STUDIO_CONCURRENT_CHANGE";
        recoveryErrors.push(concurrentError);
      }
    }
    if (publicationStarted) {
      let registryRestored = false;
      try {
        await restoreStudioFileIfOwned(
          authority,
          authority.registryPath,
          previousRegistryText,
          nextRegistrySha256,
          "registry",
        );
        registryRestored = true;
      } catch (recoveryError) {
        recoveryErrors.push(recoveryError);
      }
      if (registryRestored && generatedPath && generatedPublishedSha256) {
        try {
          await restoreStudioFileIfOwned(
            authority,
            generatedPath,
            previousGeneratedText,
            generatedPublishedSha256,
            "Studio generated metadata",
          );
        } catch (recoveryError) {
          recoveryErrors.push(recoveryError);
        }
      }
      for (const [label, target, contents] of [
        ["editor state", paths.state, previousStateText],
        ["editor theme", paths.theme, previousThemeText],
      ]) {
        try {
          await atomicWriteText(target, contents);
        } catch (recoveryError) {
          recoveryErrors.push(new Error(`rollback ${label}: ${recoveryError.message}`, {
            cause: recoveryError,
          }));
        }
      }
    }
    if (transaction && recoveryErrors.length === 0) {
      try {
        await clearBuiltinTransactionMarker(authority, transaction.transactionId);
      } catch (recoveryError) {
        recoveryErrors.push(recoveryError);
      }
    }
    if (recoveryErrors.length) {
      const aggregate = new AggregateError(
        [error, ...recoveryErrors],
        "Built-in layout save failed and rollback was incomplete",
      );
      aggregate.code = "STUDIO_ROLLBACK_INCOMPLETE";
      aggregate.cause = error;
      aggregate.recoveryArtifacts = [
        authority.registryPath,
        authority.transactionPath,
        ...(generatedPath ? [generatedPath] : []),
        paths.state,
        paths.theme,
      ];
      throw aggregate;
    }
    throw error;
  } finally {
    await lock.release();
  }
}

export async function saveThemeEdit(context) {
  const internal = await loadStudioInternal(context.editorRoot);
  assertStudioRevision(internal, context);
  await ensureStudioGreetingTracking(internal, context.configPath);
  if (internal.editKind === "builtin-layout") {
    return saveBuiltinLayoutEdit(context, internal);
  }
  const evaluated = await evaluateStudioDocument(internal.currentDocument, context, {
    greetingPreferences: internal.greetingCurrent,
  });
  if (!evaluated.feedback.valid) {
    internal.feedback = evaluated.feedback;
    await persistStudioInternal(studioPaths(context.editorRoot), internal);
    return {
      state: withStudioResult(
        await canonicalStudioState(internal, context.editorRoot, context.configPath),
        "save-theme-edit",
        false,
        evaluated.error ?? "contrast-or-budget",
      ),
      payload: null,
      themesChanged: false,
      configChanged: false,
      apply: "none",
    };
  }
  const userRoot = await resolveStudioUserThemesRoot(context.userThemesDir, { create: true });
  const paths = studioPaths(context.editorRoot);
  const stageDirectory = path.join(userRoot, `.save-${internal.id}-${studioHex()}`);
  const destination = path.join(userRoot, internal.id);
  const backup = path.join(userRoot, `.backup-${internal.id}-${studioHex()}`);
  const failed = path.join(userRoot, `.failed-${internal.id}-${studioHex()}`);
  const configRecovery = path.join(userRoot, `.recovery-config-${internal.id}-${studioHex()}.txt`);
  const editorRecovery = path.join(paths.root, `.recovery-editor-${internal.id}-${studioHex()}.json`);
  if (!isPathWithin(userRoot, destination) || path.dirname(destination) !== userRoot) throw new Error("Theme destination is unsafe");
  const registry = await readThemeRegistry({ userThemesDir: userRoot });
  if (registry.themes.some((entry) => entry.source === "builtin" && entry.id === internal.id)
      || Object.hasOwn(registry.legacyAliases, internal.id)) {
    throw new Error("A built-in theme or alias cannot be replaced");
  }
  const previousConfigRaw = await fs.readFile(context.configPath, "utf8").then((value) => value, (error) => {
    if (error.code === "ENOENT") return null;
    throw error;
  });
  const previousConfig = await readConfig(context.configPath);
  const previousEditorStateRaw = await fs.readFile(paths.state, "utf8");
  const savedGreetingPreferences = reconcileStudioGreetingShuffle(
    internal.greetingCurrent,
    previousConfig.greetingPreferences,
  );
  const nextConfig = {
    ...previousConfig,
    enabled: true,
    theme: internal.id,
    greetingPreferences: savedGreetingPreferences,
  };
  delete nextConfig.customTheme;
  let movedExisting = false;
  let installed = false;
  let configWritten = false;
  let editorStateAttempted = false;
  let completedResult = null;
  let completedInternal = null;
  try {
    await stageStudioTheme(internal.currentDocument, paths.active, stageDirectory);
    await validateStudioStage(internal.currentDocument, stageDirectory, {
      ...context,
      greetingPreferences: internal.greetingCurrent,
    });
    await callStudioFault(context, "after-stage");
    const destinationStat = await pathKind(destination);
    if (destinationStat) {
      if (internal.isNew) {
        throw new Error(`Theme destination already exists: ${internal.id}`);
      }
      if (!destinationStat.isDirectory() || destinationStat.isSymbolicLink()) throw new Error("Installed theme destination is not a regular folder");
      const realDestination = await fs.realpath(destination);
      if (!isPathWithin(userRoot, realDestination) || path.dirname(realDestination) !== userRoot) {
        throw new Error("Installed theme destination escaped the user themes folder");
      }
      await renameStudioPath(destination, backup);
      movedExisting = true;
    }
    await callStudioFault(context, "after-backup");
    await renameStudioPath(stageDirectory, destination);
    installed = true;
    await callStudioFault(context, "after-install");
    await writeConfig(context.configPath, nextConfig);
    configWritten = true;
    await callStudioFault(context, "after-config");
    const compiled = await compileTheme({
      configPath: context.configPath,
      config: nextConfig,
      locale: context.locale,
      userThemesDir: userRoot,
      themeKitDirectory: destination,
    });
    const saved = await buildPayloadFromCompiled(compiled);
    new Function(saved.payload);
    const savedInternal = cloneJson(internal);
    savedInternal.greetingCurrent = cloneJson(savedGreetingPreferences);
    savedInternal.source = "user";
    savedInternal.sourceId = savedInternal.id;
    savedInternal.isNew = false;
    savedInternal.baselineDocument = cloneJson(savedInternal.currentDocument);
    savedInternal.lastValidDocument = cloneJson(savedInternal.currentDocument);
    savedInternal.baselineLauncherMarkDigest = savedInternal.launcherMarkDigest;
    savedInternal.lastValidLauncherMarkDigest = savedInternal.launcherMarkDigest;
    savedInternal.greetingBaseline = cloneJson(savedInternal.greetingCurrent);
    savedInternal.greetingLastValid = cloneJson(savedInternal.greetingCurrent);
    savedInternal.undo = [];
    savedInternal.redo = [];
    savedInternal.appliedUndo = [];
    savedInternal.appliedRedo = [];
    savedInternal.launcherUndo = [];
    savedInternal.launcherRedo = [];
    savedInternal.appliedLauncherUndo = [];
    savedInternal.appliedLauncherRedo = [];
    savedInternal.greetingUndo = [];
    savedInternal.greetingRedo = [];
    savedInternal.greetingAppliedUndo = [];
    savedInternal.greetingAppliedRedo = [];
    savedInternal.feedback = evaluated.feedback;
    savedInternal.revision += 1;
    const savedState = withStudioResult(
      await canonicalStudioState(savedInternal, context.editorRoot, context.configPath),
      "save-theme-edit",
      true,
      null,
    );
    editorStateAttempted = true;
    await persistStudioInternal(paths, savedInternal, { collectLauncherMarks: false });
    await callStudioFault(context, "after-editor-state");
    if (movedExisting) await fs.rm(backup, { recursive: true, force: true });
    completedResult = {
      state: savedState,
      payload: saved.payload,
      themesChanged: true,
      configChanged: JSON.stringify(previousConfig) !== JSON.stringify(nextConfig),
      apply: "saved",
    };
    completedInternal = savedInternal;
  } catch (error) {
    const recoveryErrors = [];
    const recoveryFiles = studioFileOperations(context.recoveryFileOperations);
    if (editorStateAttempted) {
      await collectStudioRecoveryFailure(context, recoveryErrors, "prepare-editor-recovery", () => recoveryFiles.writeFile(
        editorRecovery,
        previousEditorStateRaw,
        { encoding: "utf8", mode: 0o600, flag: "wx" },
      ));
    }
    if (configWritten) {
      await collectStudioRecoveryFailure(context, recoveryErrors, "prepare-config-recovery", () => recoveryFiles.writeFile(
        configRecovery,
        previousConfigRaw ?? "CLAUDE_AURA_CONFIG_WAS_ABSENT\n",
        { encoding: "utf8", mode: 0o600, flag: "wx" },
      ));
    }
    if (editorStateAttempted) {
      await collectStudioRecoveryFailure(context, recoveryErrors, "rollback-editor-state", () => atomicWriteText(
        paths.state,
        previousEditorStateRaw,
        { fileOperations: recoveryFiles },
      ));
    }
    if (configWritten) {
      await collectStudioRecoveryFailure(context, recoveryErrors, "rollback-config", () => (
        previousConfigRaw === null
          ? recoveryFiles.rm(context.configPath, { force: true })
          : atomicWriteText(context.configPath, previousConfigRaw, { fileOperations: recoveryFiles })
      ));
    }
    let installedQuarantined = !installed;
    if (installed) {
      installedQuarantined = await collectStudioRecoveryFailure(
        context,
        recoveryErrors,
        "rollback-installed-theme",
        () => recoveryFiles.rename(destination, failed),
      );
    }
    if (movedExisting && installedQuarantined) {
      await collectStudioRecoveryFailure(
        context,
        recoveryErrors,
        "rollback-previous-theme",
        () => recoveryFiles.rename(backup, destination),
      );
    }
    if (recoveryErrors.length === 0) {
      for (const [stage, artifact] of [
        ["cleanup-save-stage", stageDirectory],
        ["cleanup-editor-recovery", editorRecovery],
        ["cleanup-config-recovery", configRecovery],
        ["cleanup-failed-theme", failed],
      ]) {
        const cleaned = await collectStudioRecoveryFailure(
          context,
          recoveryErrors,
          stage,
          () => recoveryFiles.rm(artifact, { recursive: true, force: true }),
        );
        if (!cleaned) break;
      }
    }
    if (recoveryErrors.length > 0) {
      const recoveryArtifacts = [stageDirectory, backup, failed, configRecovery, editorRecovery];
      const aggregate = new AggregateError(
        [error, ...recoveryErrors],
        `Theme save failed and rollback was incomplete; recovery artifacts were retained under ${userRoot} and ${paths.root}`,
      );
      aggregate.code = "STUDIO_ROLLBACK_INCOMPLETE";
      aggregate.cause = error;
      aggregate.recoveryArtifacts = recoveryArtifacts;
      throw aggregate;
    }
    throw error;
  }
  await collectStudioLauncherMarksAfterCommit(paths, completedInternal);
  return completedResult;
}

export async function clearStudioActive(editorRoot) {
  const paths = studioPaths(editorRoot);
  if (!(await pathKind(paths.active))) return;
  const discarded = path.join(paths.root, `.discarded-${studioHex()}`);
  await renameStudioPath(paths.active, discarded);
  await fs.rm(discarded, { recursive: true, force: true });
  if (await pathKind(paths.previewActive)) {
    await fs.rm(paths.previewActive, { recursive: true, force: true });
  }
}

export async function discardThemeEdit(context) {
  const internal = await loadStudioInternal(context.editorRoot);
  assertStudioRevision(internal, context);
  assertBuiltinLayoutSession(context, internal);
  const persisted = await buildPayload({
    configPath: context.configPath,
    locale: context.locale,
    userThemesDir: context.userThemesDir,
  });
  new Function(persisted.payload);
  await clearStudioActive(context.editorRoot);
  return {
    state: withStudioResult({ active: false }, "discard-theme-edit", true, null),
    payload: persisted.payload,
    themesChanged: false,
    configChanged: false,
    apply: "persisted",
  };
}

export async function deleteUserTheme(context) {
  if (typeof context.theme !== "string" || !THEME_ID_PATTERN.test(context.theme)) throw new Error("Theme id is invalid");
  const config = await readConfig(context.configPath);
  if (config.theme === context.theme) throw new Error("Apply Default before deleting the current theme");
  const active = await loadStudioInternal(context.editorRoot);
  if (active?.id === context.theme) throw new Error("Discard the active edit before deleting this theme");
  const userRoot = await resolveStudioUserThemesRoot(context.userThemesDir);
  const registry = await readThemeRegistry({ userThemesDir: userRoot });
  const entry = registry.themes.find((candidate) => candidate.id === context.theme);
  if (!entry) throw new Error(`Theme not found: ${context.theme}`);
  if (entry.source !== "user") throw new Error("Built-in themes cannot be deleted");
  const requestedDestination = path.resolve(entry.sourceDirectory);
  const destinationStat = await fs.lstat(requestedDestination);
  if (!destinationStat.isDirectory() || destinationStat.isSymbolicLink()) {
    throw new Error("Theme deletion target must be a regular directory");
  }
  const destination = await fs.realpath(requestedDestination);
  if (!userRoot || path.dirname(destination) !== userRoot || !isPathWithin(userRoot, destination)) {
    throw new Error("Theme deletion target is unsafe");
  }
  const tombstone = path.join(userRoot, `.delete-${context.theme}-${studioHex()}`);
  await renameStudioPath(destination, tombstone);
  // WO-21: atomically prune the deleted theme's host-owned greeting override so no
  // orphaned personal phrases linger for a reusable theme id.
  let configChanged = false;
  try {
    const overrides = config.greetingPreferences?.themeOverrides;
    const hasOverride = isPlainObject(overrides) && Object.hasOwn(overrides, context.theme);
    const hasShuffle = config.greetingPreferences?.shuffle?.themeId === context.theme;
    if (hasOverride || hasShuffle) {
      const nextConfig = cloneJson(config);
      if (hasOverride) delete nextConfig.greetingPreferences.themeOverrides[context.theme];
      if (hasShuffle) nextConfig.greetingPreferences.shuffle = null;
      await callStudioFault(context, "before-delete-greeting-config");
      await writeConfig(context.configPath, nextConfig);
      configChanged = true;
    }
  } catch (error) {
    try {
      await runStudioRecoveryOperation(context, "rollback-deleted-theme", () => renameStudioPath(
        tombstone,
        destination,
        { fileOperations: studioFileOperations(context.recoveryFileOperations) },
      ));
    } catch (rollbackError) {
      const stagedRollbackError = new Error(
        `rollback-deleted-theme: ${rollbackError.message}`,
        { cause: rollbackError },
      );
      stagedRollbackError.code = rollbackError.code;
      stagedRollbackError.recoveryStage = "rollback-deleted-theme";
      const aggregate = new AggregateError(
        [error, stagedRollbackError],
        `Theme delete failed and rollback was incomplete; the deleted theme remains recoverable at ${tombstone}`,
      );
      aggregate.code = "STUDIO_ROLLBACK_INCOMPLETE";
      aggregate.cause = error;
      aggregate.recoveryArtifacts = [tombstone];
      aggregate.recoveryDestination = destination;
      throw aggregate;
    }
    throw error;
  }
  await fs.rm(tombstone, { recursive: true, force: true }).catch(() => {});
  const state = active ? await canonicalStudioState(active, context.editorRoot, context.configPath) : { active: false };
  return {
    state: withStudioResult(state, "delete-user-theme", true, null),
    payload: null,
    themesChanged: true,
    configChanged,
    apply: "none",
  };
}

// WO-21 personal phrase editing. The personal envelope remains outside the theme
// document, but it travels in an aligned private history until Save atomically commits
// both drafts. Cancel therefore needs no compensating config write.
export async function setGreetingPhrases(context) {
  return mutateStudio(context, "set-greeting-phrases", (document, internal) => {
    if (typeof context.enabled !== "boolean") {
      throw new Error("greeting enabled must be true or false");
    }
    const overrides = cloneJson(internal.greetingCurrent.themeOverrides ?? {});
    const mode = strictEnum(
      context.overrideMode,
      new Set(["global", "claude", "custom"]),
      "greeting theme override mode",
    );
    overrides[document.id] = {
      mode,
      phrases: mode === "custom" ? context.overridePhrases : [],
    };
    return {
      greetingPreferences: {
        ...cloneJson(internal.greetingCurrent),
        enabled: context.enabled,
        source: context.source,
        displayName: context.displayName,
        globalPhrases: context.globalPhrases,
        themeOverrides: overrides,
        shuffle: null,
      },
    };
  });
}

// One-click recovery to Claude must reset both ownership dimensions together:
// portable presentation and host-owned wording. Stored lists and per-theme
// choices remain available if the user later chooses custom wording again.
export async function resetGreeting(context) {
  return mutateStudio(context, "reset-greeting", (document, internal) => {
    document.newChatGreetingStyle = null;
    if (internal.editKind === "builtin-layout") return;
    return {
      greetingPreferences: {
        ...cloneJson(internal.greetingCurrent),
        source: "claude",
        shuffle: null,
      },
    };
  });
}

export async function readStudioState({ editorRoot, configPath = null } = {}) {
  const internal = await loadStudioInternal(editorRoot);
  return canonicalStudioState(internal, editorRoot, configPath);
}

async function hydrateStudioDraftInternal({
  configPath,
  userThemesDir,
  editorRoot,
  locale = "en",
  builtinAuthoringRoot = null,
} = {}, {
  expectedProjectRoot = PROJECT_ROOT,
  regenerateStudioThemes = null,
  generatedPath = null,
} = {}) {
  if (typeof configPath !== "string" || !configPath.trim()) throw new Error("configPath must be a non-empty path");
  if (typeof userThemesDir !== "string" || !userThemesDir.trim()) throw new Error("userThemesDir must be a non-empty path");
  const paths = studioPaths(editorRoot);
  const builtinAuthoring = await authorizeBuiltinAuthoringRootInternal(
    builtinAuthoringRoot,
    expectedProjectRoot,
    { regenerateStudioThemes, generatedPath },
  );
  if (await peekStudioEditKind(paths.root) === "builtin-layout" && builtinAuthoring === null) {
    return {
      state: { active: false },
      payload: null,
      themesChanged: false,
      configChanged: false,
      apply: "none",
    };
  }
  const internal = await loadStudioInternal(paths.root);
  if (!internal) {
    return {
      state: { active: false },
      payload: null,
      themesChanged: false,
      configChanged: false,
      apply: "none",
    };
  }
  const context = {
    configPath: path.resolve(configPath),
    userThemesDir: path.resolve(userThemesDir),
    editorRoot: paths.root,
    locale: normalizeLocale(locale),
    builtinAuthoring,
  };
  await ensureStudioGreetingTracking(internal, context.configPath);
  assertBuiltinLayoutSession(context, internal);
  let bundle;
  try {
    if (internal.lastValidLauncherMarkDigest !== null) {
      await materializeStudioLauncherMark(paths, internal.lastValidLauncherMarkDigest);
    }
    bundle = await compileStudioDocument(internal.lastValidDocument, context, {
      appearance: "system",
      greetingPreferences: internal.greetingLastValid,
      builtinLayoutCapability: internal.editKind === "builtin-layout"
        ? BUILTIN_STUDIO_LAYOUT_VALIDATION
        : null,
    });
  } finally {
    if (internal.launcherMarkDigest !== null) {
      await materializeStudioLauncherMark(paths, internal.launcherMarkDigest);
    }
    await atomicWriteJson(paths.theme, internal.currentDocument);
  }
  return {
    state: await canonicalStudioState(internal, paths.root, context.configPath),
    payload: bundle.payload,
    themesChanged: false,
    configChanged: false,
    apply: "draft",
  };
}

export async function hydrateStudioDraft(options = {}) {
  return hydrateStudioDraftInternal(options);
}

export function assertStudioRequest(request, keys) {
  const expected = ["type", ...keys].sort();
  const actual = isPlainObject(request) ? Object.keys(request).sort() : [];
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    throw new Error(`Studio request ${request?.type ?? "unknown"} must contain only ${expected.join(", ")}`);
  }
}

async function executeStudioRequestInternal({
  request,
  configPath,
  userThemesDir,
  editorRoot,
  locale = "en",
  assetPath = null,
  builtinAuthoringRoot = null,
  faultInjector = null,
  recoveryFaultInjector = null,
  recoveryFileOperations = null,
  recoveryWait = null,
} = {}, {
  expectedProjectRoot = PROJECT_ROOT,
  regenerateStudioThemes = null,
  generatedPath = null,
} = {}) {
  if (!isPlainObject(request) || typeof request.type !== "string") throw new Error("Studio request must be an object with a type");
  if (typeof configPath !== "string" || !configPath.trim()) throw new Error("configPath must be a non-empty path");
  if (typeof userThemesDir !== "string" || !userThemesDir.trim()) throw new Error("userThemesDir must be a non-empty path");
  studioPaths(editorRoot);
  const builtinAuthoring = await authorizeBuiltinAuthoringRootInternal(
    builtinAuthoringRoot,
    expectedProjectRoot,
    { regenerateStudioThemes, generatedPath },
  );
  const context = {
    configPath: path.resolve(configPath),
    userThemesDir: path.resolve(userThemesDir),
    editorRoot: path.resolve(editorRoot),
    locale: normalizeLocale(locale),
    builtinAuthoring,
    faultInjector,
    recoveryFaultInjector,
    recoveryFileOperations,
    recoveryWait,
  };
  await guardBuiltinStudioRequest(context, request);
  const assetRequestTypes = new Set(["pick-theme-layer-image", "pick-theme-launcher-mark"]);
  if (assetPath !== null && !assetRequestTypes.has(request.type)) {
    throw new Error("An asset is allowed only for an editor image picker action");
  }
  let result;
  if (request.type === "create-theme-copy") {
    assertStudioRequest(request, ["theme"]);
    result = await createThemeCopy({ ...context, theme: request.theme });
  } else if (request.type === "begin-theme-edit") {
    assertStudioRequest(request, ["theme", "reset"]);
    if (typeof request.reset !== "boolean") throw new Error("reset must be true or false");
    result = await beginThemeEdit({ ...context, theme: request.theme, reset: request.reset });
  } else if (request.type === "set-theme-token") {
    assertStudioRequest(request, ["session", "revision", "mode", "token", "value"]);
    result = await setThemeToken({ ...context, ...request });
  } else if (request.type === "set-theme-layer") {
    assertStudioRequest(request, ["session", "revision", "index", "preset", "property", "value"]);
    result = await setThemeLayer({ ...context, ...request });
  } else if (request.type === "apply-theme-patch") {
    assertStudioRequest(request, ["session", "revision", "changes"]);
    result = await applyThemePatch({ ...context, ...request });
  } else if (request.type === "pick-theme-layer-image") {
    assertStudioRequest(request, ["session", "revision", "index", "role", "appearance", "context"]);
    if (typeof assetPath !== "string" || !assetPath.trim()) throw new Error("--asset is required for pick-theme-layer-image");
    result = await attachThemeLayerImage({ ...context, ...request, assetPath });
  } else if (request.type === "pick-theme-launcher-mark") {
    assertStudioRequest(request, ["session", "revision"]);
    if (typeof assetPath !== "string" || !assetPath.trim()) throw new Error("--asset is required for pick-theme-launcher-mark");
    result = await attachThemeLauncherMark({ ...context, ...request, assetPath });
  } else if (request.type === "remove-theme-layer") {
    assertStudioRequest(request, ["session", "revision", "index"]);
    if (assetPath !== null) throw new Error("An asset is allowed only for an editor image picker action");
    result = await removeThemeLayer({ ...context, ...request });
  } else if (request.type === "move-theme-layer") {
    assertStudioRequest(request, ["session", "revision", "index", "direction"]);
    result = await moveThemeLayer({ ...context, ...request });
  } else if (request.type === "undo-theme-edit") {
    assertStudioRequest(request, ["session", "revision"]);
    result = await undoThemeEdit({ ...context, ...request });
  } else if (request.type === "redo-theme-edit") {
    assertStudioRequest(request, ["session", "revision"]);
    result = await redoThemeEdit({ ...context, ...request });
  } else if (request.type === "save-theme-edit") {
    assertStudioRequest(request, ["session", "revision"]);
    result = await saveThemeEdit({ ...context, ...request });
  } else if (request.type === "discard-theme-edit") {
    assertStudioRequest(request, ["session", "revision"]);
    result = await discardThemeEdit({ ...context, ...request });
  } else if (request.type === "delete-user-theme") {
    assertStudioRequest(request, ["theme"]);
    result = await deleteUserTheme({ ...context, theme: request.theme });
  } else if (request.type === "set-greeting-phrases") {
    assertStudioRequest(request, [
      "session", "revision", "enabled", "source", "displayName",
      "globalPhrases", "overrideMode", "overridePhrases",
    ]);
    result = await setGreetingPhrases({ ...context, ...request });
  } else if (request.type === "reset-greeting") {
    assertStudioRequest(request, ["session", "revision"]);
    result = await resetGreeting({ ...context, ...request });
  } else {
    throw new Error(`Unsupported Studio request type: ${request.type}`);
  }
  if (result.state.lastAction === undefined) {
    result.state = withStudioResult(result.state, request.type, true, null);
  }
  return result;
}

export async function executeStudioRequest(options = {}) {
  return executeStudioRequestInternal(options);
}

// Tests need an isolated source checkout without weakening the public
// execute/hydrate authorization contract. This direct-module helper is not
// re-exported by scripts/theme-core.mjs.
export function createBuiltinAuthoringTestHarness(
  expectedProjectRoot,
  {
    regenerateStudioThemes = async () => null,
    generatedPath = null,
  } = {},
) {
  if (typeof expectedProjectRoot !== "string"
      || !expectedProjectRoot.trim()
      || !path.isAbsolute(expectedProjectRoot)) {
    throw new Error("Built-in authoring test root must be an absolute path");
  }
  const options = {
    expectedProjectRoot: path.resolve(expectedProjectRoot),
    regenerateStudioThemes,
    generatedPath,
  };
  return Object.freeze({
    execute: (requestOptions) => executeStudioRequestInternal(requestOptions, options),
    hydrate: (hydrateOptions) => hydrateStudioDraftInternal(hydrateOptions, options),
  });
}
