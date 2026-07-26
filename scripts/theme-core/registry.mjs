// Extracted from theme-core.mjs. Public API is re-exported by scripts/theme-core.mjs.
import crypto from "node:crypto";
import { constants as fsConstants } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import {
  DEFAULT_CONFIG,
  FROZEN_BUILTIN_THEME_IDS,
  IMAGE_TYPES,
  MAX_AVATAR_BYTES,
  MAX_IMAGE_BYTES,
  PROJECT_ROOT,
  STUDIO_KIT_SCHEMA_VERSIONS,
  STUDIO_THEME_SCHEMA_VERSION,
  THEMES_DIR,
  THEME_ID_PATTERN,
  THEME_KIT_FILENAME,
  THEME_REGISTRY_PATH,
  WINDOWS_FILESYSTEM_RETRY_DELAYS_MS,
  WINDOWS_TRANSIENT_FILESYSTEM_CODES,
} from "./constants.mjs";
import {
  cloneJson,
  detectImageMime,
  isAnimatedImage,
  isPathWithin,
  isPlainObject,
  isUnavailableFileError,
  normalizeLocale,
  readJson,
  resolveUserThemesDirectory,
  validateRegistryEntry,
  validateStudioThemeKitDocument,
  validateTheme,
  validateUserThemeArtwork,
} from "./validation.mjs";

export async function readThemeKit(kitDirectory, { expectedId = null } = {}) {
  if (typeof kitDirectory !== "string" || !kitDirectory.trim()) throw new Error("Theme kit folder is required");
  const kitRoot = path.resolve(kitDirectory);
  let rootStat;
  try {
    rootStat = await fs.lstat(kitRoot);
  } catch (error) {
    if (error.code === "ENOENT") throw new Error(`Theme kit folder does not exist: ${kitRoot}`);
    throw error;
  }
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) throw new Error("Theme kit path must be a regular folder");
  const kitPath = path.join(kitRoot, THEME_KIT_FILENAME);
  let kitStat;
  try {
    kitStat = await fs.lstat(kitPath);
  } catch (error) {
    if (error.code === "ENOENT") throw new Error(`Theme kit is missing ${THEME_KIT_FILENAME}`);
    throw error;
  }
  if (!kitStat.isFile() || kitStat.isSymbolicLink()) throw new Error(`${THEME_KIT_FILENAME} must be a regular file`);
  const [realKitRoot, realKitPath] = await Promise.all([fs.realpath(kitRoot), fs.realpath(kitPath)]);
  if (!isPathWithin(realKitRoot, realKitPath)) throw new Error(`${THEME_KIT_FILENAME} must remain inside the theme kit`);
  const raw = await readJson(kitPath);
  const isStudioKit = STUDIO_KIT_SCHEMA_VERSIONS.has(raw?.schemaVersion);
  if (!isPlainObject(raw) || !(raw.schemaVersion === 1 || isStudioKit)) {
    throw new Error(`${THEME_KIT_FILENAME} must use schemaVersion 1 or ${[...STUDIO_KIT_SCHEMA_VERSIONS].join(" or ")}`);
  }
  // Studio-authored kits (v2/v3) validate and normalize up to the current schema;
  // legacy hand-authored kits (v1) load through the registry-entry path.
  const entry = isStudioKit
    ? validateStudioThemeKitDocument(raw, THEME_KIT_FILENAME)
    : validateRegistryEntry(raw, THEME_KIT_FILENAME, { source: "user" });
  if (expectedId !== null && entry.id !== expectedId) {
    throw new Error(`${THEME_KIT_FILENAME} id "${entry.id}" must match its installed folder "${expectedId}"`);
  }
  if (!isPlainObject(raw.theme)) throw new Error(`${THEME_KIT_FILENAME}.theme must be an object`);
  if (raw.schemaVersion === 1 && raw.theme.variant !== entry.id) {
    throw new Error(`${THEME_KIT_FILENAME}.theme.variant must match id "${entry.id}"`);
  }
  const theme = isStudioKit
    ? entry.theme
    : validateTheme(raw.theme, `${kitPath}.theme`);
  if (theme.name !== entry.id) throw new Error(`${THEME_KIT_FILENAME}.theme.name must match id "${entry.id}"`);
  if (theme.customCss.trim()) throw new Error(`${THEME_KIT_FILENAME}.theme.customCss must be empty in a standalone kit`);
  await validateUserThemeArtwork(kitRoot, entry, theme, THEME_KIT_FILENAME);
  const metadata = {
    id: entry.id,
    labels: { ...entry.labels },
    descriptions: { ...entry.descriptions },
    swatches: [...entry.swatches],
    preview: { ...entry.preview },
    studioPreview: entry.studioPreview,
    studioPreviewFrame: entry.studioPreviewFrame ? { ...entry.studioPreviewFrame } : null,
    newChatLayout: entry.newChatLayout ? { ...entry.newChatLayout } : null,
    newChatGreetingStyle: entry.newChatGreetingStyle ? cloneJson(entry.newChatGreetingStyle) : null,
    artwork: entry.artwork ? { ...entry.artwork } : null,
    artworkLayers: entry.artworkLayers ? entry.artworkLayers.map((layer) => ({ ...layer })) : null,
    backgroundScope: entry.backgroundScope ?? "full-window",
    sourceRecipe: entry.sourceRecipe ?? null,
    controlOverrides: [...(entry.controlOverrides ?? [])],
  };
  return {
    schemaVersion: raw.schemaVersion,
    id: entry.id,
    source: "user",
    sourceDirectory: kitRoot,
    kitPath,
    metadata,
    raw: cloneJson(raw),
    entry: {
      ...entry,
      source: "user",
      sourceDirectory: kitRoot,
      kitPath,
      kitTheme: theme,
      schemaVersion: raw.schemaVersion,
      backgroundScope: entry.backgroundScope ?? "full-window",
    },
    theme,
  };
}

export async function discoverUserThemeEntries(userThemesDir, builtInIds, aliases, warn) {
  if (!userThemesDir) return [];
  let directoryEntries;
  try {
    directoryEntries = await fs.readdir(userThemesDir, { withFileTypes: true });
  } catch (error) {
    if (error.code === "ENOENT") return [];
    warn(`User themes could not be read from ${userThemesDir}: ${error.message}`);
    return [];
  }
  const discovered = [];
  for (const directoryEntry of directoryEntries.sort((left, right) => left.name.localeCompare(right.name, "en"))) {
    if (!directoryEntry.isDirectory() || directoryEntry.isSymbolicLink()) continue;
    const folderId = directoryEntry.name;
    if (!THEME_ID_PATTERN.test(folderId)) {
      warn(`User theme folder "${folderId}" was ignored because its name is not a lowercase kebab-case id.`);
      continue;
    }
    if (builtInIds.has(folderId) || Object.hasOwn(aliases, folderId)) {
      warn(`User theme "${folderId}" was ignored because the built-in theme or alias takes precedence.`);
      continue;
    }
    try {
      const kit = await readThemeKit(path.join(userThemesDir, folderId), { expectedId: folderId });
      discovered.push(kit.entry);
    } catch (error) {
      warn(`User theme "${folderId}" was ignored: ${error.message}`);
    }
  }
  return discovered;
}

export async function readThemeRegistry({ userThemesDir = null, onWarning = null } = {}) {
  const raw = await readJson(THEME_REGISTRY_PATH);
  if (!isPlainObject(raw) || raw.schemaVersion !== 1) throw new Error("themes/registry.json must use schemaVersion 1");
  if (!Array.isArray(raw.themes) || raw.themes.length === 0) throw new Error("themes/registry.json must list themes");
  const themes = raw.themes.map((entry, index) => ({
    ...validateRegistryEntry(entry, `registry.themes[${index}]`),
    source: "builtin",
    sourceDirectory: THEMES_DIR,
    themePath: path.join(THEMES_DIR, entry.file ?? `${entry.id}.json`),
    artworkRoot: PROJECT_ROOT,
    artworkAllowedRoot: path.join(PROJECT_ROOT, "assets", "theme-art"),
  }));
  const ids = themes.map((entry) => entry.id);
  if (new Set(ids).size !== ids.length) throw new Error("Theme registry IDs must be unique");
  if (!ids.includes(raw.defaultTheme)) throw new Error("Theme registry defaultTheme must reference a listed theme");
  const aliases = {};
  if (raw.legacyAliases !== undefined && !isPlainObject(raw.legacyAliases)) {
    throw new Error("Theme registry legacyAliases must be an object");
  }
  for (const [from, to] of Object.entries(raw.legacyAliases ?? {})) {
    if (!THEME_ID_PATTERN.test(from) || !ids.includes(to)) {
      throw new Error(`Invalid legacy theme alias: ${from} -> ${to}`);
    }
    aliases[from] = to;
  }
  const warnings = [];
  const warn = (message) => {
    warnings.push(message);
    if (typeof onWarning === "function") onWarning(message);
  };
  const resolvedUserThemesDir = resolveUserThemesDirectory(userThemesDir);
  const userThemes = await discoverUserThemeEntries(resolvedUserThemesDir, new Set(ids), aliases, warn);
  return {
    schemaVersion: 1,
    defaultTheme: raw.defaultTheme,
    legacyAliases: aliases,
    themes: [...themes, ...userThemes],
    warnings,
    userThemesDir: resolvedUserThemesDir,
  };
}

export async function applyStudioSourceRecipe(theme, entry) {
  const result = cloneJson(theme);
  const sourceRecipe = entry.source === "user" ? (entry.sourceRecipe ?? null) : null;
  if (sourceRecipe === null) return result;
  if (!FROZEN_BUILTIN_THEME_IDS.has(sourceRecipe)) throw new Error("Studio source recipe is invalid");
  const sourcePath = path.join(PROJECT_ROOT, "themes", `${sourceRecipe}.json`);
  const sourceTheme = validateTheme(await readJson(sourcePath), sourcePath);
  if (sourceTheme.name !== sourceRecipe || sourceTheme.variant !== sourceRecipe) {
    throw new Error(`Studio source recipe does not match its frozen ID: ${sourceRecipe}`);
  }
  const overrides = new Set(entry.controlOverrides ?? []);
  if (!overrides.has("fontUi")) {
    result.typography.ui = sourceTheme.typography.ui;
    result.typography.body = sourceTheme.typography.body;
  }
  if (!overrides.has("fontDisplay")) result.typography.display = sourceTheme.typography.display;
  if (!overrides.has("radius")) {
    result.radius = sourceTheme.radius;
    result.shape = cloneJson(sourceTheme.shape);
  }
  if (!overrides.has("shadow")) {
    result.effects.shadowSoft = sourceTheme.effects.shadowSoft;
    result.effects.shadowElevated = sourceTheme.effects.shadowElevated;
  }
  return result;
}

export async function readRegisteredTheme(entry, locale) {
  const filePath = entry.source === "user" ? entry.kitPath : entry.themePath;
  const baseTheme = entry.source === "user"
    ? entry.kitTheme
    : validateTheme(await readJson(filePath), filePath);
  const theme = await applyStudioSourceRecipe(baseTheme, entry);
  if (theme.name !== entry.id) throw new Error(`Theme file name must match its registered ID: ${entry.file ?? THEME_KIT_FILENAME}`);
  const normalizedLocale = normalizeLocale(locale);
  return {
    ...theme,
    label: entry.labels[normalizedLocale] ?? entry.labels.en,
    description: entry.descriptions[normalizedLocale] ?? entry.descriptions.en,
    labels: { ...entry.labels },
    descriptions: { ...entry.descriptions },
    swatches: [...entry.swatches],
    preview: { ...entry.preview },
    studioPreview: entry.studioPreview,
    studioPreviewFrame: entry.studioPreviewFrame ? { ...entry.studioPreviewFrame } : null,
    newChatLayout: entry.newChatLayout ? { ...entry.newChatLayout } : null,
    newChatGreetingStyle: entry.newChatGreetingStyle ? cloneJson(entry.newChatGreetingStyle) : null,
    artwork: entry.artwork ? { ...entry.artwork } : null,
    artworkLayers: entry.artworkLayers ? entry.artworkLayers.map((layer) => cloneJson(layer)) : null,
    schemaVersion: entry.schemaVersion ?? 1,
    backgroundScope: entry.backgroundScope ?? "full-window",
    sourceRecipe: entry.sourceRecipe ?? null,
    controlOverrides: [...(entry.controlOverrides ?? [])],
    filePath,
    source: entry.source,
    sourceDirectory: entry.sourceDirectory,
    artworkRoot: entry.source === "user" ? entry.sourceDirectory : entry.artworkRoot,
    artworkAllowedRoot: entry.source === "user" ? entry.sourceDirectory : entry.artworkAllowedRoot,
  };
}

export async function listThemes({ locale = "en", userThemesDir = null, onWarning = null } = {}) {
  const registry = await readThemeRegistry({ userThemesDir, onWarning });
  const themes = [];
  for (const entry of registry.themes) themes.push(await readRegisteredTheme(entry, locale));
  return themes;
}

export async function readConfig(configPath) {
  try {
    const value = await readJson(configPath);
    if (!isPlainObject(value)) {
      const error = new Error("Config root must be an object");
      error.code = "AURA_INVALID_CONFIG_ROOT";
      throw error;
    }
    return { ...DEFAULT_CONFIG, ...value };
  } catch (error) {
    if (error.code === "ENOENT") return { ...DEFAULT_CONFIG };
    if (["AURA_INVALID_JSON", "AURA_INVALID_CONFIG_ROOT"].includes(error.code)) return { ...DEFAULT_CONFIG };
    throw error;
  }
}

export async function preserveCorruptConfig(configPath) {
  let raw;
  try {
    raw = await fs.readFile(configPath, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }

  let corrupt = false;
  try {
    corrupt = !isPlainObject(JSON.parse(raw));
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error;
    corrupt = true;
  }
  if (!corrupt) return null;

  const stamp = new Date().toISOString().replace(/\D/g, "").slice(0, 14);
  const suffix = crypto.randomBytes(5).toString("hex");
  const backupPath = `${configPath}.corrupt-${stamp}-${suffix}.json`;
  await fs.copyFile(configPath, backupPath, fsConstants.COPYFILE_EXCL);
  return backupPath;
}

export async function resolveTheme(config, configPath, locale, { userThemesDir = null, onWarning = null } = {}) {
  let customThemeUnavailable = false;
  if (config.customTheme) {
    if (typeof config.customTheme !== "string" || !config.customTheme.trim()) {
      customThemeUnavailable = true;
    } else {
      const filePath = path.resolve(path.dirname(configPath), config.customTheme);
      try {
        const theme = validateTheme(await readJson(filePath), filePath);
        return {
          theme: {
            ...theme,
            labels: { en: theme.label },
            descriptions: { en: theme.description },
            swatches: [],
            preview: null,
            studioPreview: null,
            studioPreviewFrame: null,
            newChatLayout: null,
            newChatGreetingStyle: null,
            artwork: null,
            artworkLayers: null,
            source: "custom",
            sourceDirectory: path.dirname(filePath),
          },
          filePath,
          requestedTheme: theme.name,
          fallbackFrom: null,
          customThemeUnavailable: false,
        };
      } catch {
        customThemeUnavailable = true;
      }
    }
  }
  const registry = await readThemeRegistry({ userThemesDir, onWarning });
  const requestedTheme = typeof config.theme === "string" && THEME_ID_PATTERN.test(config.theme)
    ? config.theme
    : registry.defaultTheme;
  const canonicalTheme = Object.hasOwn(registry.legacyAliases, requestedTheme)
    ? registry.legacyAliases[requestedTheme]
    : requestedTheme;
  const entry = registry.themes.find((item) => item.id === canonicalTheme)
    ?? registry.themes.find((item) => item.id === registry.defaultTheme);
  const fallbackFrom = customThemeUnavailable ? "custom-theme" : (entry.id === canonicalTheme ? null : requestedTheme);
  const theme = await readRegisteredTheme(entry, locale);
  return { theme, filePath: theme.filePath, requestedTheme, fallbackFrom, customThemeUnavailable };
}

export async function resolveImage(config, configPath) {
  if (config.image === null || config.image === undefined || config.image === "") return null;
  if (typeof config.image !== "string") throw new Error("image must be a file path or null");
  const imagePath = path.resolve(path.dirname(configPath), config.image);
  const extension = path.extname(imagePath).toLowerCase();
  const mime = IMAGE_TYPES.get(extension);
  if (!mime) throw new Error(`Unsupported image type: ${extension || "no extension"}`);
  let stat;
  try {
    stat = await fs.stat(imagePath);
  } catch (error) {
    if (isUnavailableFileError(error)) return null;
    throw error;
  }
  if (!stat.isFile()) return null;
  if (stat.size > MAX_IMAGE_BYTES) throw new Error(`Image exceeds 16 MB: ${imagePath}`);
  let bytes;
  try {
    bytes = await fs.readFile(imagePath);
  } catch (error) {
    if (isUnavailableFileError(error)) return null;
    throw error;
  }
  if (bytes.length > MAX_IMAGE_BYTES) throw new Error(`Image exceeds 16 MB: ${imagePath}`);
  const detectedMime = detectImageMime(bytes);
  if (!detectedMime) throw new Error(`Image content is not a supported PNG, JPEG, WebP, GIF, or AVIF file: ${imagePath}`);
  if (detectedMime !== mime) throw new Error(`Image extension does not match its content: ${imagePath}`);
  const animated = isAnimatedImage(bytes);
  return { path: imagePath, mime, animated, dataUrl: `data:${mime};base64,${bytes.toString("base64")}`, bytes: bytes.length };
}

// Personal account avatar (config.avatar). Mirrors resolveImage — reads the
// user's chosen file, validates type by extension AND content, and returns a
// data URL — but with the smaller avatar byte cap. A missing/removed file fails
// open to null (the native Claude avatar) rather than throwing.
export async function resolveAvatar(config, configPath) {
  if (config.avatar === null || config.avatar === undefined || config.avatar === "") return null;
  if (typeof config.avatar !== "string") throw new Error("avatar must be a file path or null");
  const avatarPath = path.resolve(path.dirname(configPath), config.avatar);
  const extension = path.extname(avatarPath).toLowerCase();
  const mime = IMAGE_TYPES.get(extension);
  if (!mime) throw new Error(`Unsupported avatar type: ${extension || "no extension"}`);
  let stat;
  try {
    stat = await fs.stat(avatarPath);
  } catch (error) {
    if (isUnavailableFileError(error)) return null;
    throw error;
  }
  if (!stat.isFile()) return null;
  if (stat.size > MAX_AVATAR_BYTES) throw new Error(`Avatar exceeds 2 MB: ${avatarPath}`);
  let bytes;
  try {
    bytes = await fs.readFile(avatarPath);
  } catch (error) {
    if (isUnavailableFileError(error)) return null;
    throw error;
  }
  if (bytes.length > MAX_AVATAR_BYTES) throw new Error(`Avatar exceeds 2 MB: ${avatarPath}`);
  const detectedMime = detectImageMime(bytes);
  if (!detectedMime) throw new Error(`Avatar content is not a supported PNG, JPEG, WebP, GIF, or AVIF file: ${avatarPath}`);
  if (detectedMime !== mime) throw new Error(`Avatar extension does not match its content: ${avatarPath}`);
  return { path: avatarPath, mime, dataUrl: `data:${mime};base64,${bytes.toString("base64")}`, bytes: bytes.length };
}

async function publishConfigFile(resolved, temporary, fileOperations) {
  const wait = typeof fileOperations.wait === "function"
    ? fileOperations.wait
    : (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
  try {
    for (let attempt = 0; ; attempt += 1) {
      try {
        await fileOperations.rename(temporary, resolved);
        return;
      } catch (error) {
        if (!WINDOWS_TRANSIENT_FILESYSTEM_CODES.includes(error.code)
            || attempt >= WINDOWS_FILESYSTEM_RETRY_DELAYS_MS.length) throw error;
        await wait(WINDOWS_FILESYSTEM_RETRY_DELAYS_MS[attempt]);
      }
    }
  } finally {
    try {
      await fileOperations.rm(temporary, { force: true });
    } catch {
      // Preserve the primary publication or recovery error.
    }
  }
}

export async function writeConfig(configPath, config, { fileOperations = fs } = {}) {
  const resolved = path.resolve(configPath);
  await fs.mkdir(path.dirname(resolved), { recursive: true });
  await preserveCorruptConfig(resolved);
  const temporary = `${resolved}.tmp-${process.pid}-${crypto.randomBytes(5).toString("hex")}`;
  await fs.writeFile(temporary, `${JSON.stringify(config, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  await publishConfigFile(resolved, temporary, fileOperations);
  return resolved;
}
