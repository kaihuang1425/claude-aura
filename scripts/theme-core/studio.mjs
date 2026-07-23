// Extracted from theme-core.mjs. Public API is re-exported by scripts/theme-core.mjs.
import crypto from "node:crypto";
import { constants as fsConstants } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import {
  FROZEN_BUILTIN_THEME_IDS,
  MAX_CHROME_PAYLOAD_BYTES,
  MAX_USER_ARTWORK_TOTAL_BYTES,
  MAX_USER_RASTER_ARTWORK_BYTES,
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
  STUDIO_RECIPE_CONTROL_OVERRIDES,
  STUDIO_SESSION_PATTERN,
  STUDIO_SHADOWS,
  STUDIO_SHARED_TOKENS,
  STUDIO_STATE_FILENAME,
  STUDIO_THEME_SCHEMA_VERSION,
  SUPPORTED_LOCALES,
  THEME_ID_PATTERN,
  THEME_KIT_FILENAME,
  WINDOWS_FILESYSTEM_RETRY_DELAYS_MS,
  WINDOWS_TRANSIENT_FILESYSTEM_CODES,
} from "./constants.mjs";
import {
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
  validateStudioThemeKitDocument,
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
} from "./compile.mjs";

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

async function effectiveStudioDocumentTheme(document) {
  return applyStudioSourceRecipe(document.theme, {
    source: "user",
    sourceRecipe: document.sourceRecipe,
    controlOverrides: document.controlOverrides,
  });
}

export async function canonicalStudioState(internal, editorRoot) {
  if (!internal) return { active: false };
  const paths = studioPaths(editorRoot);
  await assertStudioActivePaths(paths, { requireActive: true, requireState: true });
  await initializeStudioLauncherTracking(internal, paths);
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
  return {
    active: true,
    id: internal.id,
    sourceId: internal.sourceId,
    source: internal.source,
    isNew: internal.isNew,
    session: internal.session,
    revision: internal.revision,
    dirty: JSON.stringify(internal.currentDocument) !== JSON.stringify(internal.baselineDocument)
      || internal.launcherMarkDigest !== internal.baselineLauncherMarkDigest,
    canUndo: internal.undo.length > 0,
    canRedo: internal.redo.length > 0,
    label: document.labels[internal.locale] ?? document.labels.en,
    metadata: {
      labels: Object.fromEntries(SUPPORTED_LOCALES.map((locale) => [locale, document.labels[locale]])),
      descriptions: Object.fromEntries(SUPPORTED_LOCALES.map((locale) => [locale, document.descriptions[locale]])),
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
      inherited: Object.fromEntries(["fontUi", "fontDisplay", "radius", "shadow"]
        .map((token) => [
          token,
          document.sourceRecipe !== null && !document.controlOverrides.includes(token),
        ])),
    },
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
      const source = path.resolve(paths.active, layer.path);
      if (!isPathWithin(paths.active, source)) throw new Error("Editor artwork escaped the active theme folder");
      const stat = await fs.lstat(source);
      if (!stat.isFile() || stat.isSymbolicLink()) throw new Error("Editor artwork must be a regular file");
      image = studioWebpDimensions(await fs.readFile(source), `Editor artwork ${layer.path}`);
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
  for (const [name, document] of documents) {
    validateStudioThemeKitDocument(document, `editor ${name} theme`, {
      // Invalid-but-editable drafts are persisted deliberately so Studio can
      // keep the last-valid payload active while the user repairs them.
      enforceLauncherContrast: false,
    });
    if (document.id !== internal.id) throw new Error(`Editor ${name} theme id does not match the session`);
    changed = await upgradeStudioLegacyFrames(document, paths) || changed;
    validateStudioThemeKitDocument(document, `editor ${name} theme`, {
      enforceLauncherContrast: false,
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
    width: backgroundScope === "content"
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
  return {
    en: `${labels.en} Copy`.slice(0, 80),
    "zh-CN": `${labels["zh-CN"]}副本`.slice(0, 80),
    "zh-TW": `${labels["zh-TW"]}副本`.slice(0, 80),
  };
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

export async function studioDocumentFromSource({ sourceId, targetId, userThemesDir, locale, paths, copyLabels }) {
  const { entry, theme } = await sourceThemeForStudio(sourceId, userThemesDir, locale);
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
    backgroundScope: theme.backgroundScope ?? "full-window",
    artworkLayers: [],
    sourceRecipe: entry.source === "builtin" ? sourceId : (theme.sourceRecipe ?? null),
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
    await fs.copyFile(sourceMark, targetMark, fsConstants.COPYFILE_EXCL);
  }
  const sourceLayers = theme.artworkLayers ?? (theme.artwork ? [{ ...theme.artwork, role: "background" }] : []);
  const copiedArtwork = new Map();
  for (const sourceLayer of sourceLayers) {
    const sourcePath = path.resolve(theme.artworkRoot, sourceLayer.path);
    const sourceKey = await fs.realpath(sourcePath);
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
      id: sourceLayer.id ?? `layer-${studioHex()}`,
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
  validateStudioThemeKitDocument(document, "editor theme");
  return { document, source: entry.source };
}

export async function compileStudioDocument(document, context, { appearance = "system" } = {}) {
  const paths = studioPaths(context.editorRoot);
  await atomicWriteJson(paths.theme, document);
  const persisted = await readConfig(context.configPath);
  const config = {
    ...persisted,
    enabled: true,
    theme: document.id,
    appearance,
  };
  delete config.customTheme;
  const compiled = await compileTheme({
    configPath: context.configPath,
    config,
    locale: context.locale,
    userThemesDir: context.userThemesDir,
    themeKitDirectory: paths.active,
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

export async function evaluateStudioDocument(document, context) {
  try {
    validateStudioThemeKitDocument(document, "editor theme");
    const bundle = await compileStudioDocument(document, context, { appearance: "system" });
    const feedback = await studioFeedback(document, context, bundle);
    return { bundle, feedback, error: feedback.valid ? null : "contrast-or-budget" };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const launcherField = /editor theme\.theme\.launcher\.(surfaceHover|surface|foreground|accent|border|radius|borderWidth)\b/.exec(message)?.[1];
    return {
      bundle: null,
      feedback: {
        ...emptyStudioFeedback(),
        valid: false,
        errors: [{
          code: launcherField
            ? (message.includes("must reach 4.5:1 contrast") ? "launcher-contrast" : "invalid-launcher")
            : "invalid-theme",
          field: launcherField ? `launcher.${launcherField}` : "theme",
        }],
      },
      error: launcherField ? "invalid-launcher" : "invalid-theme",
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
  const evaluated = await evaluateStudioDocument(document, context);
  internal.feedback = evaluated.feedback;
  if (!evaluated.feedback.valid) throw new Error(evaluated.error ?? "The source theme is not valid for Studio");
  await persistStudioInternal(paths, internal);
  return {
    state: await canonicalStudioState(internal, context.editorRoot),
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

export async function beginThemeEdit(context) {
  const locale = normalizeLocale(context.locale);
  const existing = await loadStudioInternal(context.editorRoot);
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
    existing.revision += 1;
    if (existing.launcherMarkDigest !== null) {
      await materializeStudioLauncherMark(studioPaths(context.editorRoot), existing.launcherMarkDigest);
    }
    const evaluated = await evaluateStudioDocument(existing.currentDocument, { ...context, locale });
    if (!evaluated.feedback.valid) throw new Error("The editor baseline is no longer valid");
    existing.feedback = evaluated.feedback;
    await persistStudioInternal(studioPaths(context.editorRoot), existing);
    return {
      state: withStudioResult(await canonicalStudioState(existing, context.editorRoot), "begin-theme-edit", true, null),
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
      bundle = await compileStudioDocument(existing.lastValidDocument, { ...context, locale }, { appearance: "system" });
    } finally {
      if (existing.launcherMarkDigest !== null) {
        await materializeStudioLauncherMark(existingPaths, existing.launcherMarkDigest);
      }
      await atomicWriteJson(existingPaths.theme, existing.currentDocument);
    }
    return {
      state: await canonicalStudioState(existing, context.editorRoot),
      payload: bundle.payload,
      themesChanged: false,
      configChanged: false,
      apply: "draft",
    };
  }
  const source = await sourceThemeForStudio(context.theme, context.userThemesDir, locale);
  if (source.entry.source !== "user") throw new Error("Built-in themes must be duplicated before editing");
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
  const before = cloneJson(internal.currentDocument);
  const beforeLauncherMarkDigest = internal.launcherMarkDigest;
  const candidate = cloneJson(internal.currentDocument);
  const mutation = await mutate(candidate, internal);
  internal.undo = [...internal.undo, before].slice(-STUDIO_MAX_HISTORY);
  internal.appliedUndo = [...internal.appliedUndo, cloneJson(internal.lastValidDocument)].slice(-STUDIO_MAX_HISTORY);
  internal.launcherUndo = [...internal.launcherUndo, beforeLauncherMarkDigest].slice(-STUDIO_MAX_HISTORY);
  internal.appliedLauncherUndo = [
    ...internal.appliedLauncherUndo,
    internal.lastValidLauncherMarkDigest,
  ].slice(-STUDIO_MAX_HISTORY);
  internal.redo = [];
  internal.appliedRedo = [];
  internal.launcherRedo = [];
  internal.appliedLauncherRedo = [];
  internal.currentDocument = candidate;
  internal.launcherMarkDigest = mutation?.launcherMarkDigest ?? beforeLauncherMarkDigest;
  internal.revision += 1;
  if (studioDocumentUsesLocalLauncher(candidate)) {
    if (internal.launcherMarkDigest === null) throw new Error("Editor launcher mark content is missing");
    await materializeStudioLauncherMark(studioPaths(context.editorRoot), internal.launcherMarkDigest);
  }
  const evaluated = await evaluateStudioDocument(candidate, context);
  internal.feedback = evaluated.feedback;
  if (evaluated.feedback.valid) {
    internal.lastValidDocument = cloneJson(candidate);
    internal.lastValidLauncherMarkDigest = internal.launcherMarkDigest;
  }
  await persistStudioInternal(studioPaths(context.editorRoot), internal);
  const state = withStudioResult(
    await canonicalStudioState(internal, context.editorRoot),
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
    document.backgroundScope = strictEnum(change.value, new Set(["content", "full-window"]), "backgroundScope");
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
  return mutateStudio(context, "set-theme-token", (document) => {
    if (document.newChatLayout === null && context.mode === "shared"
        && ["promptWidth", "promptX", "promptY"].includes(context.token)) {
      throw new Error("The native new-chat area must be adopted in one complete placement change");
    }
    mutateStudioTokenDocument(document, context);
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
  const locale = strictEnum(change.locale, new Set(SUPPORTED_LOCALES), "theme metadata locale");
  if (typeof change.value !== "string") throw new Error(`Theme ${change.field} must be a string`);
  const value = change.value.trim();
  if (!value || value.length > settings.maximum || /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/u.test(value)) {
    throw new Error(`Theme ${change.field} is required and must be at most ${settings.maximum} characters`);
  }
  document[settings.key][locale] = value;
  if (locale === "en") document.theme[settings.legacy] = value;
}

export function assertStudioPatchChanges(changes) {
  if (!Array.isArray(changes) || changes.length < 1 || changes.length > STUDIO_MAX_PATCH_CHANGES) {
    throw new Error(`Theme patch must contain 1 to ${STUDIO_MAX_PATCH_CHANGES} changes`);
  }
  const shapes = {
    token: ["kind", "mode", "token", "value"],
    layer: ["kind", "index", "preset", "property", "value"],
    metadata: ["kind", "field", "locale", "value"],
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

export async function applyThemePatch(context) {
  assertStudioPatchChanges(context.changes);
  return mutateStudio(context, "apply-theme-patch", (document) => {
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
    for (const change of context.changes) {
      if (change.kind === "token") mutateStudioTokenDocument(document, change);
      else if (change.kind === "layer") mutateStudioLayerDocument(document, change);
      else mutateStudioMetadataDocument(document, change);
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
  const ownedPath = await copyWebpIntoEditor(source, studioPaths(context.editorRoot));
  return mutateStudio(context, "pick-theme-layer-image", (document) => {
    if (index === -1) {
      const frame = { anchor: "center", focalX: 50, focalY: 50, positionX: 0, positionY: 0, scale: 1 };
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
        frames: { normal: cloneJson(frame), wide: cloneJson(frame) },
      });
    } else {
      document.artworkLayers[index].path = ownedPath;
      document.artworkLayers[index].role = role;
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
  const source = direction === "undo" ? internal.undo : internal.redo;
  const appliedSource = direction === "undo" ? internal.appliedUndo : internal.appliedRedo;
  const launcherSource = direction === "undo" ? internal.launcherUndo : internal.launcherRedo;
  const appliedLauncherSource = direction === "undo"
    ? internal.appliedLauncherUndo : internal.appliedLauncherRedo;
  if (!source.length) throw new Error(`There is nothing to ${direction}`);
  const destination = direction === "undo" ? internal.redo : internal.undo;
  const appliedDestination = direction === "undo" ? internal.appliedRedo : internal.appliedUndo;
  const launcherDestination = direction === "undo" ? internal.launcherRedo : internal.launcherUndo;
  const appliedLauncherDestination = direction === "undo"
    ? internal.appliedLauncherRedo : internal.appliedLauncherUndo;
  destination.push(cloneJson(internal.currentDocument));
  appliedDestination.push(cloneJson(internal.lastValidDocument));
  launcherDestination.push(internal.launcherMarkDigest);
  appliedLauncherDestination.push(internal.lastValidLauncherMarkDigest);
  for (const history of [
    destination, appliedDestination, launcherDestination, appliedLauncherDestination,
  ]) {
    if (history.length > STUDIO_MAX_HISTORY) history.splice(0, history.length - STUDIO_MAX_HISTORY);
  }
  internal.currentDocument = source.pop();
  const historicalAppliedDocument = appliedSource.pop();
  internal.launcherMarkDigest = launcherSource.pop() ?? null;
  const historicalAppliedLauncher = appliedLauncherSource.pop() ?? null;
  const restoredHistoricalAppliedState = historicalAppliedDocument !== null;
  if (restoredHistoricalAppliedState) {
    internal.lastValidDocument = historicalAppliedDocument;
    internal.lastValidLauncherMarkDigest = historicalAppliedLauncher;
  }
  internal.revision += 1;
  const paths = studioPaths(context.editorRoot);
  if (studioDocumentUsesLocalLauncher(internal.currentDocument)) {
    if (internal.launcherMarkDigest === null) throw new Error("Editor launcher mark history is missing");
    await materializeStudioLauncherMark(paths, internal.launcherMarkDigest);
  }
  const evaluated = await evaluateStudioDocument(internal.currentDocument, context);
  internal.feedback = evaluated.feedback;
  let fallbackBundle = null;
  if (evaluated.feedback.valid) {
    internal.lastValidDocument = cloneJson(internal.currentDocument);
    internal.lastValidLauncherMarkDigest = internal.launcherMarkDigest;
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
      fallbackBundle = await compileStudioDocument(internal.lastValidDocument, context, { appearance: "system" });
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
      await canonicalStudioState(internal, context.editorRoot),
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
  await readThemeKit(stageDirectory, { expectedId: document.id });
  for (const appearance of ["light", "dark"]) {
    const persisted = await readConfig(context.configPath);
    const compiled = await compileTheme({
      configPath: context.configPath,
      config: { ...persisted, enabled: true, theme: document.id, appearance },
      locale: context.locale,
      userThemesDir: context.userThemesDir,
      themeKitDirectory: stageDirectory,
    });
    const bundle = await buildPayloadFromCompiled(compiled);
    new Function(bundle.payload);
  }
}

export async function saveThemeEdit(context) {
  const internal = await loadStudioInternal(context.editorRoot);
  assertStudioRevision(internal, context);
  const evaluated = await evaluateStudioDocument(internal.currentDocument, context);
  if (!evaluated.feedback.valid) {
    internal.feedback = evaluated.feedback;
    await persistStudioInternal(studioPaths(context.editorRoot), internal);
    return {
      state: withStudioResult(await canonicalStudioState(internal, context.editorRoot), "save-theme-edit", false, "contrast-or-budget"),
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
  const nextConfig = { ...previousConfig, enabled: true, theme: internal.id };
  delete nextConfig.customTheme;
  let movedExisting = false;
  let installed = false;
  let configWritten = false;
  let editorStateAttempted = false;
  let completedResult = null;
  let completedInternal = null;
  try {
    await stageStudioTheme(internal.currentDocument, paths.active, stageDirectory);
    await validateStudioStage(internal.currentDocument, stageDirectory, context);
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
    savedInternal.source = "user";
    savedInternal.sourceId = savedInternal.id;
    savedInternal.isNew = false;
    savedInternal.baselineDocument = cloneJson(savedInternal.currentDocument);
    savedInternal.lastValidDocument = cloneJson(savedInternal.currentDocument);
    savedInternal.baselineLauncherMarkDigest = savedInternal.launcherMarkDigest;
    savedInternal.lastValidLauncherMarkDigest = savedInternal.launcherMarkDigest;
    savedInternal.undo = [];
    savedInternal.redo = [];
    savedInternal.appliedUndo = [];
    savedInternal.appliedRedo = [];
    savedInternal.launcherUndo = [];
    savedInternal.launcherRedo = [];
    savedInternal.appliedLauncherUndo = [];
    savedInternal.appliedLauncherRedo = [];
    savedInternal.feedback = evaluated.feedback;
    savedInternal.revision += 1;
    const savedState = withStudioResult(
      await canonicalStudioState(savedInternal, context.editorRoot),
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
  await fs.rm(tombstone, { recursive: true, force: true }).catch(() => {});
  const state = active ? await canonicalStudioState(active, context.editorRoot) : { active: false };
  return {
    state: withStudioResult(state, "delete-user-theme", true, null),
    payload: null,
    themesChanged: true,
    configChanged: false,
    apply: "none",
  };
}

export async function readStudioState({ editorRoot } = {}) {
  const internal = await loadStudioInternal(editorRoot);
  return canonicalStudioState(internal, editorRoot);
}

export async function hydrateStudioDraft({
  configPath,
  userThemesDir,
  editorRoot,
  locale = "en",
} = {}) {
  if (typeof configPath !== "string" || !configPath.trim()) throw new Error("configPath must be a non-empty path");
  if (typeof userThemesDir !== "string" || !userThemesDir.trim()) throw new Error("userThemesDir must be a non-empty path");
  const paths = studioPaths(editorRoot);
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
  };
  let bundle;
  try {
    if (internal.lastValidLauncherMarkDigest !== null) {
      await materializeStudioLauncherMark(paths, internal.lastValidLauncherMarkDigest);
    }
    bundle = await compileStudioDocument(internal.lastValidDocument, context, { appearance: "system" });
  } finally {
    if (internal.launcherMarkDigest !== null) {
      await materializeStudioLauncherMark(paths, internal.launcherMarkDigest);
    }
    await atomicWriteJson(paths.theme, internal.currentDocument);
  }
  return {
    state: await canonicalStudioState(internal, paths.root),
    payload: bundle.payload,
    themesChanged: false,
    configChanged: false,
    apply: "draft",
  };
}

export function assertStudioRequest(request, keys) {
  const expected = ["type", ...keys].sort();
  const actual = isPlainObject(request) ? Object.keys(request).sort() : [];
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    throw new Error(`Studio request ${request?.type ?? "unknown"} must contain only ${expected.join(", ")}`);
  }
}

export async function executeStudioRequest({
  request,
  configPath,
  userThemesDir,
  editorRoot,
  locale = "en",
  assetPath = null,
  faultInjector = null,
  recoveryFaultInjector = null,
  recoveryFileOperations = null,
  recoveryWait = null,
} = {}) {
  if (!isPlainObject(request) || typeof request.type !== "string") throw new Error("Studio request must be an object with a type");
  if (typeof configPath !== "string" || !configPath.trim()) throw new Error("configPath must be a non-empty path");
  if (typeof userThemesDir !== "string" || !userThemesDir.trim()) throw new Error("userThemesDir must be a non-empty path");
  studioPaths(editorRoot);
  const context = {
    configPath: path.resolve(configPath),
    userThemesDir: path.resolve(userThemesDir),
    editorRoot: path.resolve(editorRoot),
    locale: normalizeLocale(locale),
    faultInjector,
    recoveryFaultInjector,
    recoveryFileOperations,
    recoveryWait,
  };
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
  } else {
    throw new Error(`Unsupported Studio request type: ${request.type}`);
  }
  if (result.state.lastAction === undefined) {
    result.state = withStudioResult(result.state, request.type, true, null);
  }
  return result;
}
