import crypto from "node:crypto";
import { constants as fsConstants } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const AURA_VERSION = "0.3.0";
export const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const THEMES_DIR = path.join(PROJECT_ROOT, "themes");
export const THEME_REGISTRY_PATH = path.join(THEMES_DIR, "registry.json");
export const SUPPORTED_LOCALES = Object.freeze(["en", "zh-CN", "zh-TW"]);
export const DEFAULT_CONFIG = Object.freeze({
  enabled: true,
  theme: "default",
  image: null,
  imageOpacity: null,
  imagePosition: "center",
  reduceMotion: false,
});

const LEGACY_REQUIRED_TOKENS = [
  "--bg-000",
  "--bg-100",
  "--bg-200",
  "--text-000",
  "--text-200",
  "--text-400",
  "--accent-brand",
  "--border-200",
  "--claude-background-color",
  "--claude-foreground-color",
];
export const REQUIRED_SEMANTIC_TOKENS = Object.freeze([
  "--aura-background-primary",
  "--aura-background-secondary",
  "--aura-sidebar-background",
  "--aura-sidebar-text-primary",
  "--aura-sidebar-text-muted",
  "--aura-sidebar-selected",
  "--aura-sidebar-indicator",
  "--aura-panel-background",
  "--aura-elevated-surface",
  "--aura-overlay-background",
  "--aura-text-primary",
  "--aura-text-secondary",
  "--aura-text-muted",
  "--aura-text-disabled",
  "--aura-text-on-accent",
  "--aura-accent-primary",
  "--aura-accent-secondary",
  "--aura-border-subtle",
  "--aura-border-emphasis",
  "--aura-focus-ring",
  "--aura-composer-background",
  "--aura-card-background",
  "--aura-hover-surface",
  "--aura-selected-surface",
  "--aura-disabled-surface",
  "--aura-destructive",
  "--aura-success",
  "--aura-warning",
  "--aura-info",
]);
const REQUIRED_SEMANTIC_INPUTS = Object.freeze([
  "--aura-background-primary",
  "--aura-background-secondary",
  "--aura-sidebar-background",
  "--aura-panel-background",
  "--aura-elevated-surface",
  "--aura-text-primary",
  "--aura-text-secondary",
  "--aura-text-muted",
  "--aura-text-on-accent",
  "--aura-accent-primary",
  "--aura-accent-secondary",
  "--aura-border-emphasis",
  "--aura-composer-background",
  "--aura-card-background",
  "--aura-destructive",
  "--aura-success",
  "--aura-warning",
]);
const IMAGE_TYPES = new Map([
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".webp", "image/webp"],
  [".gif", "image/gif"],
  [".avif", "image/avif"],
]);
const ARTWORK_TYPES = new Map([
  [".svg", "image/svg+xml"],
  [".png", "image/png"],
  [".webp", "image/webp"],
  [".avif", "image/avif"],
]);
const MAX_IMAGE_BYTES = 16 * 1024 * 1024;
const MAX_ARTWORK_BYTES = 3 * 1024 * 1024;
const HEX_COLOR = /^#[0-9a-f]{6}$/i;
const AVIF_BRANDS = new Set(["avif", "avis"]);
const ANIMATED_AVIF_BRANDS = new Set(["avis"]);

function hasIsoBrand(bytes, expectedBrands) {
  if (bytes.length < 16 || bytes.subarray(4, 8).toString("ascii") !== "ftyp") return false;
  const declaredLength = bytes.readUInt32BE(0);
  const limit = Math.min(bytes.length, declaredLength >= 16 ? declaredLength : bytes.length);
  if (expectedBrands.has(bytes.subarray(8, 12).toString("ascii"))) return true;
  for (let offset = 16; offset + 4 <= limit; offset += 4) {
    if (expectedBrands.has(bytes.subarray(offset, offset + 4).toString("ascii"))) return true;
  }
  return false;
}

function detectImageMime(bytes) {
  if (/^GIF8[79]a$/.test(bytes.subarray(0, 6).toString("ascii"))) return "image/gif";
  if (bytes.length >= 8 && bytes.subarray(0, 8).toString("hex") === "89504e470d0a1a0a") return "image/png";
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 12
    && bytes.subarray(0, 4).toString("ascii") === "RIFF"
    && bytes.subarray(8, 12).toString("ascii") === "WEBP") return "image/webp";
  if (hasIsoBrand(bytes, AVIF_BRANDS)) return "image/avif";
  return null;
}

function isAnimatedImage(bytes) {
  if (/^GIF8[79]a$/.test(bytes.subarray(0, 6).toString("ascii"))) return true;

  const pngSignature = "89504e470d0a1a0a";
  if (bytes.length >= 20 && bytes.subarray(0, 8).toString("hex") === pngSignature) {
    let offset = 8;
    while (offset + 12 <= bytes.length) {
      const length = bytes.readUInt32BE(offset);
      const type = bytes.subarray(offset + 4, offset + 8).toString("ascii");
      if (type === "acTL") return true;
      if (length > bytes.length - offset - 12 || type === "IEND") break;
      offset += 12 + length;
    }
  }

  if (bytes.length >= 20
    && bytes.subarray(0, 4).toString("ascii") === "RIFF"
    && bytes.subarray(8, 12).toString("ascii") === "WEBP") {
    let offset = 12;
    while (offset + 8 <= bytes.length) {
      const type = bytes.subarray(offset, offset + 4).toString("ascii");
      const length = bytes.readUInt32LE(offset + 4);
      if (type === "ANIM" || type === "ANMF") return true;
      if (length > bytes.length - offset - 8) break;
      offset += 8 + length + (length % 2);
    }
  }

  if (hasIsoBrand(bytes, ANIMATED_AVIF_BRANDS)) return true;

  return false;
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

async function readJson(filePath) {
  const source = await fs.readFile(filePath, "utf8");
  try {
    return JSON.parse(source);
  } catch (error) {
    const wrapped = new Error(`Invalid JSON in ${filePath}: ${error.message}`, { cause: error });
    wrapped.code = "AURA_INVALID_JSON";
    throw wrapped;
  }
}

function finiteNumber(value, label, minimum, maximum) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < minimum || number > maximum) {
    throw new Error(`${label} must be between ${minimum} and ${maximum}`);
  }
  return number;
}

function isUnavailableFileError(error) {
  return ["ENOENT", "EACCES", "EPERM"].includes(error?.code);
}

const UNSAFE_CSS_RESOURCE_PATTERN = /\\|@import\b|(?:url|(?:-webkit-)?image-set|src)\s*\(|(?:https?|ftp|file|blob):|\/\//i;

function assertNoRemoteCssResources(value, label) {
  if (UNSAFE_CSS_RESOURCE_PATTERN.test(value)) {
    throw new Error(`${label} may not load remote resources`);
  }
  return value;
}

function safeCssValue(value, label, maximum = 600) {
  if (typeof value !== "string" || !value.trim() || value.length > maximum || /[;{}\0]/.test(value)) {
    throw new Error(`${label} contains an unsupported CSS value`);
  }
  return assertNoRemoteCssResources(value.trim(), label);
}

function validateHslComponents(value, label) {
  const normalized = safeCssValue(value, label, 80);
  const match = normalized.match(/^(\d{1,3}(?:\.\d+)?)\s+(\d{1,3}(?:\.\d+)?)%\s+(\d{1,3}(?:\.\d+)?)%$/);
  if (!match || Number(match[1]) > 360 || Number(match[2]) > 100 || Number(match[3]) > 100) {
    throw new Error(`${label} must contain HSL components such as "220 20% 18%"`);
  }
  return normalized;
}

function validateLegacyTokenMap(tokens, label) {
  if (!isPlainObject(tokens)) throw new Error(`${label}.tokens must be an object`);
  for (const required of LEGACY_REQUIRED_TOKENS) {
    if (!(required in tokens)) throw new Error(`${label}.tokens is missing ${required}`);
  }
  const result = {};
  for (const [name, value] of Object.entries(tokens)) {
    if (!/^--[a-z0-9-]{2,80}$/.test(name)) throw new Error(`${label} has an invalid token name: ${name}`);
    result[name] = safeCssValue(value, `${label}.${name}`, 240);
  }
  return result;
}

function validateSemanticTokenMap(tokens, label) {
  if (!isPlainObject(tokens)) throw new Error(`${label}.semantic must be an object`);
  for (const required of REQUIRED_SEMANTIC_INPUTS) {
    if (!(required in tokens)) throw new Error(`${label}.semantic is missing ${required}`);
  }
  const result = {};
  for (const [name, value] of Object.entries(tokens)) {
    if (!/^--aura-[a-z0-9-]{2,80}$/.test(name)) {
      throw new Error(`${label}.semantic has an invalid token name: ${name}`);
    }
    result[name] = validateHslComponents(value, `${label}.semantic.${name}`);
  }
  const copy = (target, source, fallback = null) => {
    if (!(target in result)) result[target] = result[source] ?? fallback;
  };
  copy("--aura-overlay-background", "--aura-elevated-surface");
  copy("--aura-sidebar-text-primary", "--aura-text-primary");
  copy("--aura-sidebar-text-muted", "--aura-text-muted");
  copy("--aura-sidebar-indicator", "--aura-sidebar-text-primary");
  copy("--aura-text-disabled", "--aura-text-muted");
  copy("--aura-border-subtle", "--aura-border-emphasis");
  copy("--aura-focus-ring", "--aura-accent-primary");
  copy("--aura-hover-surface", "--aura-elevated-surface");
  copy("--aura-selected-surface", "--aura-background-secondary");
  copy("--aura-sidebar-selected", "--aura-selected-surface");
  copy("--aura-disabled-surface", "--aura-background-secondary");
  copy("--aura-info", "--aura-accent-secondary");
  for (const required of REQUIRED_SEMANTIC_TOKENS) {
    result[required] = validateHslComponents(result[required], `${label}.semantic.${required}`);
  }
  return result;
}

function expandLegacyTokens(input) {
  const tokens = { ...input };
  const copy = (target, source, fallback = null) => {
    if (!(target in tokens)) tokens[target] = tokens[source] ?? fallback;
  };
  copy("--bg-300", "--bg-200");
  copy("--bg-400", "--bg-100");
  copy("--bg-500", "--bg-100");
  copy("--text-100", "--text-000");
  copy("--text-300", "--text-200");
  copy("--text-500", "--text-400");
  for (const suffix of ["000", "100", "200"]) copy(`--accent-${suffix}`, "--accent-brand");
  copy("--accent-900", "--bg-200");
  for (const suffix of ["000", "100", "200"]) copy(`--accent-pro-${suffix}`, "--accent-brand");
  copy("--accent-pro-900", "--bg-200");
  for (const suffix of ["000", "100", "200"]) copy(`--brand-${suffix}`, "--accent-brand");
  copy("--brand-900", "--text-000");
  for (const suffix of ["100", "200", "300", "400"]) copy(`--border-${suffix}`, "--border-200");
  for (const suffix of ["100", "200", "300"]) copy(`--oncolor-${suffix}`, "--oncolor-100", "0 0% 100%");
  copy("--pictogram-100", "--text-000");
  copy("--pictogram-200", "--text-200");
  copy("--pictogram-300", "--text-400");
  copy("--pictogram-400", "--bg-300");
  copy("--claude-accent-clay", "--claude-foreground-color");
  copy("--claude-secondary-color", "--claude-foreground-color");
  copy("--claude-text-100", "--claude-foreground-color");
  copy("--claude-text-200", "--claude-secondary-color");
  copy("--claude-text-400", "--claude-secondary-color");
  copy("--claude-text-500", "--claude-secondary-color");
  copy("--claude-description-text", "--claude-secondary-color");
  copy("--claude-border", "--claude-accent-clay");
  copy("--claude-border-300", "--claude-border");
  copy("--claude-border-300-more", "--claude-border-300");
  tokens["--accent-main-000"] = "var(--accent-000)";
  tokens["--accent-main-100"] = "var(--accent-brand)";
  tokens["--accent-main-200"] = "var(--accent-200)";
  tokens["--accent-main-900"] = "var(--accent-900)";
  tokens["--accent-secondary-000"] = "var(--accent-pro-000)";
  tokens["--accent-secondary-100"] = "var(--accent-pro-100)";
  tokens["--accent-secondary-200"] = "var(--accent-pro-200)";
  tokens["--accent-secondary-900"] = "var(--accent-pro-900)";
  tokens["--always-black"] = "0 0% 0%";
  tokens["--always-white"] = "0 0% 100%";
  return tokens;
}

function legacyToSemantic(tokens) {
  return {
    "--aura-background-primary": tokens["--bg-100"],
    "--aura-background-secondary": tokens["--bg-200"],
    "--aura-sidebar-background": tokens["--bg-200"],
    "--aura-panel-background": tokens["--bg-100"],
    "--aura-elevated-surface": tokens["--bg-000"],
    "--aura-overlay-background": tokens["--bg-000"],
    "--aura-text-primary": tokens["--text-000"],
    "--aura-text-secondary": tokens["--text-200"],
    "--aura-text-muted": tokens["--text-400"],
    "--aura-text-disabled": tokens["--text-400"],
    "--aura-text-on-accent": tokens["--oncolor-100"] ?? "0 0% 100%",
    "--aura-accent-primary": tokens["--accent-brand"],
    "--aura-accent-secondary": tokens["--accent-pro-100"] ?? tokens["--accent-brand"],
    "--aura-border-subtle": tokens["--border-200"],
    "--aura-border-emphasis": tokens["--border-200"],
    "--aura-focus-ring": tokens["--accent-brand"],
    "--aura-composer-background": tokens["--bg-000"],
    "--aura-card-background": tokens["--bg-000"],
    "--aura-hover-surface": tokens["--bg-000"],
    "--aura-selected-surface": tokens["--bg-000"],
    "--aura-disabled-surface": tokens["--bg-200"],
    "--aura-destructive": tokens["--danger-100"] ?? "0 72% 48%",
    "--aura-success": tokens["--success-100"] ?? "145 58% 34%",
    "--aura-warning": tokens["--warning-100"] ?? "38 88% 42%",
    "--aura-info": tokens["--accent-pro-100"] ?? tokens["--accent-brand"],
  };
}

function semanticToLegacy(semantic) {
  return expandLegacyTokens({
    "--bg-000": semantic["--aura-elevated-surface"],
    "--bg-100": semantic["--aura-background-primary"],
    "--bg-200": semantic["--aura-background-secondary"],
    "--bg-300": semantic["--aura-sidebar-background"],
    "--bg-400": semantic["--aura-panel-background"],
    "--bg-500": semantic["--aura-disabled-surface"],
    "--text-000": semantic["--aura-text-primary"],
    "--text-200": semantic["--aura-text-secondary"],
    "--text-400": semantic["--aura-text-muted"],
    "--text-500": semantic["--aura-text-disabled"],
    "--accent-brand": semantic["--aura-accent-primary"],
    "--accent-pro-100": semantic["--aura-accent-secondary"],
    "--border-200": semantic["--aura-border-emphasis"],
    "--danger-100": semantic["--aura-destructive"],
    "--warning-100": semantic["--aura-warning"],
    "--success-100": semantic["--aura-success"],
    "--oncolor-100": semantic["--aura-text-on-accent"],
    "--claude-accent-clay": "hsl(var(--aura-accent-primary))",
    "--claude-background-color": "hsl(var(--aura-background-primary))",
    "--claude-foreground-color": "hsl(var(--aura-text-primary))",
    "--claude-secondary-color": "hsl(var(--aura-text-secondary))",
    "--claude-border": "hsl(var(--aura-border-subtle) / 0.22)",
    "--claude-border-300": "hsl(var(--aura-border-emphasis) / 0.38)",
    "--claude-border-300-more": "hsl(var(--aura-border-emphasis) / 0.62)",
  });
}

function validateWallpaper(value, label) {
  const wallpaper = isPlainObject(value) ? value : {};
  return {
    gradient: safeCssValue(
      wallpaper.gradient ?? "radial-gradient(circle at 20% 10%, rgb(140 120 255 / .18), transparent 38%)",
      `${label}.gradient`,
      1600,
    ),
    surfaceAlpha: finiteNumber(wallpaper.surfaceAlpha ?? 0.9, `${label}.surfaceAlpha`, 0.62, 1),
    sidebarAlpha: finiteNumber(wallpaper.sidebarAlpha ?? 0.9, `${label}.sidebarAlpha`, 0.62, 1),
    imageOpacity: finiteNumber(wallpaper.imageOpacity ?? 0.16, `${label}.imageOpacity`, 0, 0.55),
    artOpacity: finiteNumber(wallpaper.artOpacity ?? 0.18, `${label}.artOpacity`, 0, 0.46),
    textureOpacity: finiteNumber(wallpaper.textureOpacity ?? 0.36, `${label}.textureOpacity`, 0, 0.7),
  };
}

function validateTypography(value, label, legacyChatFont = null) {
  const typography = isPlainObject(value) ? value : {};
  const ui = safeCssValue(typography.ui ?? "Inter, ui-sans-serif, system-ui, sans-serif", `${label}.ui`, 240);
  return {
    ui,
    display: safeCssValue(typography.display ?? legacyChatFont ?? ui, `${label}.display`, 240),
    body: safeCssValue(typography.body ?? legacyChatFont ?? ui, `${label}.body`, 240),
    mono: safeCssValue(typography.mono ?? "ui-monospace, SFMono-Regular, Consolas, monospace", `${label}.mono`, 240),
    displayWeight: finiteNumber(typography.displayWeight ?? 600, `${label}.displayWeight`, 300, 800),
    letterSpacing: safeCssValue(typography.letterSpacing ?? "-0.01em", `${label}.letterSpacing`, 24),
  };
}

function validateShape(value, label, legacyRadius = 18) {
  const shape = isPlainObject(value) ? value : {};
  return {
    control: finiteNumber(shape.control ?? Math.min(legacyRadius, 14), `${label}.control`, 0, 24),
    card: finiteNumber(shape.card ?? legacyRadius, `${label}.card`, 0, 32),
    composer: finiteNumber(shape.composer ?? Math.min(legacyRadius + 2, 32), `${label}.composer`, 0, 36),
    icon: finiteNumber(shape.icon ?? Math.min(legacyRadius, 12), `${label}.icon`, 0, 24),
    borderWidth: finiteNumber(shape.borderWidth ?? 1, `${label}.borderWidth`, 0, 3),
  };
}

function validateEffects(value, label) {
  const effects = isPlainObject(value) ? value : {};
  return {
    shadowSoft: safeCssValue(effects.shadowSoft ?? "0 8px 28px rgb(0 0 0 / 0.08)", `${label}.shadowSoft`, 180),
    shadowElevated: safeCssValue(effects.shadowElevated ?? "0 20px 60px rgb(0 0 0 / 0.18)", `${label}.shadowElevated`, 180),
    hoverLift: finiteNumber(effects.hoverLift ?? 1, `${label}.hoverLift`, 0, 4),
    transitionMs: finiteNumber(effects.transitionMs ?? 160, `${label}.transitionMs`, 80, 400),
  };
}

export function validateTheme(theme, source = "theme") {
  if (!isPlainObject(theme)) throw new Error(`${source} must contain a JSON object`);
  if (typeof theme.name !== "string" || !/^[a-z][a-z0-9-]{1,39}$/.test(theme.name)) {
    throw new Error(`${source}.name must be lowercase kebab-case`);
  }
  const legacyLabel = typeof theme.label === "string" ? theme.label.trim() : theme.name;
  const legacyDescription = typeof theme.description === "string" ? theme.description.trim() : legacyLabel;
  if (!legacyLabel || legacyLabel.length > 80) throw new Error(`${source}.label must be at most 80 characters`);
  if (!legacyDescription || legacyDescription.length > 220) {
    throw new Error(`${source}.description must be at most 220 characters`);
  }
  const radius = finiteNumber(theme.radius ?? theme.shape?.card ?? 18, `${source}.radius`, 0, 32);
  const blur = finiteNumber(theme.blur ?? 18, `${source}.blur`, 0, 40);
  const chatFont = theme.chatFont ? safeCssValue(theme.chatFont, `${source}.chatFont`, 240) : null;
  const result = {
    name: theme.name,
    label: legacyLabel,
    description: legacyDescription,
    variant: typeof theme.variant === "string" && /^[a-z][a-z0-9-]{1,39}$/.test(theme.variant)
      ? theme.variant
      : theme.name,
    radius,
    blur,
    chatFont,
    typography: validateTypography(theme.typography, `${source}.typography`, chatFont),
    shape: validateShape(theme.shape, `${source}.shape`, radius),
    effects: validateEffects(theme.effects, `${source}.effects`),
    customCss: theme.customCss ?? "",
  };
  if (typeof result.customCss !== "string" || result.customCss.length > 30000) {
    throw new Error(`${source}.customCss must be a string no longer than 30,000 characters`);
  }
  assertNoRemoteCssResources(result.customCss, `${source}.customCss`);
  for (const mode of ["light", "dark"]) {
    if (!isPlainObject(theme[mode])) throw new Error(`${source}.${mode} must be an object`);
    let semantic;
    let legacy;
    if (theme[mode].semantic) {
      semantic = validateSemanticTokenMap(theme[mode].semantic, `${source}.${mode}`);
      legacy = semanticToLegacy(semantic);
      if (theme[mode].tokens) {
        const overrides = validateLegacyTokenMap({ ...legacy, ...theme[mode].tokens }, `${source}.${mode}`);
        legacy = expandLegacyTokens(overrides);
      }
    } else {
      legacy = expandLegacyTokens(validateLegacyTokenMap(theme[mode].tokens, `${source}.${mode}`));
      semantic = Object.fromEntries(
        Object.entries(legacyToSemantic(legacy)).map(([name, value]) => [name, validateHslComponents(value, `${source}.${mode}.${name}`)]),
      );
    }
    result[mode] = {
      semantic,
      tokens: { ...legacy, ...semantic },
      wallpaper: validateWallpaper(theme[mode].wallpaper, `${source}.${mode}.wallpaper`),
    };
  }
  return result;
}

export function normalizeLocale(value = "en") {
  const locale = String(value || "en").replaceAll("_", "-").toLowerCase();
  if (locale === "zh-cn" || locale === "zh-sg" || locale === "zh-hans" || locale.startsWith("zh-hans-")) return "zh-CN";
  if (locale === "zh-tw" || locale === "zh-hk" || locale === "zh-mo" || locale === "zh-hant" || locale.startsWith("zh-hant-")) return "zh-TW";
  return "en";
}

function validateLocalizedMap(value, label, maximum) {
  if (!isPlainObject(value)) throw new Error(`${label} must be an object`);
  const result = {};
  for (const locale of SUPPORTED_LOCALES) {
    const text = value[locale];
    if (typeof text !== "string" || !text.trim() || text.length > maximum) {
      throw new Error(`${label}.${locale} is required and must be at most ${maximum} characters`);
    }
    result[locale] = text.trim();
  }
  return result;
}

function validateRegistryEntry(entry, label) {
  if (!isPlainObject(entry)) throw new Error(`${label} must be an object`);
  if (typeof entry.id !== "string" || !/^[a-z][a-z0-9-]{1,39}$/.test(entry.id)) {
    throw new Error(`${label}.id must be lowercase kebab-case`);
  }
  const file = entry.file ?? `${entry.id}.json`;
  if (file !== `${entry.id}.json`) throw new Error(`${label}.file must be ${entry.id}.json`);
  const swatches = Array.isArray(entry.swatches) ? entry.swatches : [];
  if (swatches.length < 3 || swatches.length > 6 || swatches.some((value) => !HEX_COLOR.test(value))) {
    throw new Error(`${label}.swatches must contain 3 to 6 six-digit hex colours`);
  }
  const preview = isPlainObject(entry.preview) ? entry.preview : {};
  for (const key of ["chrome", "background", "surface", "accent", "text"]) {
    if (!HEX_COLOR.test(preview[key] ?? "")) throw new Error(`${label}.preview.${key} must be a six-digit hex colour`);
  }
  let artwork = null;
  if (entry.artwork !== null && entry.artwork !== undefined) {
    if (!isPlainObject(entry.artwork)) throw new Error(`${label}.artwork must be an object or null`);
    const artworkPath = String(entry.artwork.path ?? "");
    if (!/^assets\/theme-art\/[a-z0-9-]+\.(?:svg|png|webp|avif)$/.test(artworkPath)) {
      throw new Error(`${label}.artwork.path is not a supported project artwork path`);
    }
    artwork = {
      path: artworkPath,
      position: safeCssValue(entry.artwork.position ?? "right center", `${label}.artwork.position`, 80),
      size: safeCssValue(entry.artwork.size ?? "min(58vw, 860px) auto", `${label}.artwork.size`, 120),
      mobile: entry.artwork.mobile === "hide" ? "hide" : "reduce",
    };
  }
  return {
    id: entry.id,
    file,
    labels: validateLocalizedMap(entry.labels, `${label}.labels`, 80),
    descriptions: validateLocalizedMap(entry.descriptions, `${label}.descriptions`, 220),
    swatches: [...swatches],
    preview: Object.fromEntries(Object.entries(preview).map(([key, value]) => [key, value.toUpperCase()])),
    artwork,
  };
}

export async function readThemeRegistry() {
  const raw = await readJson(THEME_REGISTRY_PATH);
  if (!isPlainObject(raw) || raw.schemaVersion !== 1) throw new Error("themes/registry.json must use schemaVersion 1");
  if (!Array.isArray(raw.themes) || raw.themes.length === 0) throw new Error("themes/registry.json must list themes");
  const themes = raw.themes.map((entry, index) => validateRegistryEntry(entry, `registry.themes[${index}]`));
  const ids = themes.map((entry) => entry.id);
  if (new Set(ids).size !== ids.length) throw new Error("Theme registry IDs must be unique");
  if (!ids.includes(raw.defaultTheme)) throw new Error("Theme registry defaultTheme must reference a listed theme");
  const aliases = {};
  if (raw.legacyAliases !== undefined && !isPlainObject(raw.legacyAliases)) {
    throw new Error("Theme registry legacyAliases must be an object");
  }
  for (const [from, to] of Object.entries(raw.legacyAliases ?? {})) {
    if (!/^[a-z][a-z0-9-]{1,39}$/.test(from) || !ids.includes(to)) {
      throw new Error(`Invalid legacy theme alias: ${from} -> ${to}`);
    }
    aliases[from] = to;
  }
  return { schemaVersion: 1, defaultTheme: raw.defaultTheme, legacyAliases: aliases, themes };
}

async function readRegisteredTheme(entry, locale) {
  const filePath = path.join(THEMES_DIR, entry.file);
  const theme = validateTheme(await readJson(filePath), filePath);
  if (theme.name !== entry.id) throw new Error(`Theme file name must match its registered ID: ${entry.file}`);
  const normalizedLocale = normalizeLocale(locale);
  return {
    ...theme,
    label: entry.labels[normalizedLocale] ?? entry.labels.en,
    description: entry.descriptions[normalizedLocale] ?? entry.descriptions.en,
    labels: { ...entry.labels },
    descriptions: { ...entry.descriptions },
    swatches: [...entry.swatches],
    preview: { ...entry.preview },
    artwork: entry.artwork ? { ...entry.artwork } : null,
    filePath,
  };
}

export async function listThemes({ locale = "en" } = {}) {
  const registry = await readThemeRegistry();
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

async function preserveCorruptConfig(configPath) {
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

async function resolveTheme(config, configPath, locale) {
  let customThemeUnavailable = false;
  if (config.customTheme) {
    if (typeof config.customTheme !== "string" || !config.customTheme.trim()) {
      customThemeUnavailable = true;
    } else {
      const filePath = path.resolve(path.dirname(configPath), config.customTheme);
      try {
        const theme = validateTheme(await readJson(filePath), filePath);
        return {
          theme: { ...theme, labels: { en: theme.label }, descriptions: { en: theme.description }, swatches: [], preview: null, artwork: null },
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
  const registry = await readThemeRegistry();
  const requestedTheme = typeof config.theme === "string" && /^[a-z][a-z0-9-]{1,39}$/.test(config.theme)
    ? config.theme
    : registry.defaultTheme;
  const canonicalTheme = registry.legacyAliases[requestedTheme] ?? requestedTheme;
  const entry = registry.themes.find((item) => item.id === canonicalTheme)
    ?? registry.themes.find((item) => item.id === registry.defaultTheme);
  const fallbackFrom = customThemeUnavailable ? "custom-theme" : (entry.id === canonicalTheme ? null : requestedTheme);
  const theme = await readRegisteredTheme(entry, locale);
  return { theme, filePath: theme.filePath, requestedTheme, fallbackFrom, customThemeUnavailable };
}

async function resolveImage(config, configPath) {
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

export async function resolveArtwork(theme) {
  if (!theme.artwork) return null;
  const artworkRoot = path.resolve(PROJECT_ROOT, "assets", "theme-art");
  const artworkPath = path.resolve(PROJECT_ROOT, theme.artwork.path);
  if (artworkPath !== artworkRoot && !artworkPath.startsWith(`${artworkRoot}${path.sep}`)) {
    throw new Error(`Theme artwork must remain inside ${artworkRoot}`);
  }
  const extension = path.extname(artworkPath).toLowerCase();
  const mime = ARTWORK_TYPES.get(extension);
  if (!mime) throw new Error(`Unsupported theme artwork type: ${extension || "no extension"}`);
  let stat;
  try {
    stat = await fs.stat(artworkPath);
  } catch (error) {
    if (isUnavailableFileError(error)) return null;
    throw error;
  }
  if (!stat.isFile() || stat.size > MAX_ARTWORK_BYTES) return null;
  let bytes;
  try {
    bytes = await fs.readFile(artworkPath);
  } catch (error) {
    if (isUnavailableFileError(error)) return null;
    throw error;
  }
  if (bytes.length > MAX_ARTWORK_BYTES) return null;
  return {
    ...theme.artwork,
    path: artworkPath,
    dataUrl: `data:${mime};base64,${bytes.toString("base64")}`,
    bytes: bytes.length,
  };
}

function renderMode(selector, mode) {
  const declarations = Object.entries(mode.tokens).map(([name, value]) => `  ${name}: ${value} !important;`);
  declarations.push(`  --aura-wallpaper-gradient: ${mode.wallpaper.gradient};`);
  declarations.push(`  --aura-surface-alpha: ${mode.wallpaper.surfaceAlpha};`);
  declarations.push(`  --aura-sidebar-alpha: ${mode.wallpaper.sidebarAlpha};`);
  declarations.push(`  --aura-default-image-opacity: ${mode.wallpaper.imageOpacity};`);
  declarations.push(`  --aura-art-opacity: ${mode.wallpaper.artOpacity};`);
  declarations.push(`  --aura-texture-opacity: ${mode.wallpaper.textureOpacity};`);
  return `${selector} {\n${declarations.join("\n")}\n}`;
}

function renderThemePrimitives(theme) {
  return `:root {
  --aura-radius: ${theme.shape.card}px;
  --aura-control-radius: ${theme.shape.control}px;
  --aura-card-radius: ${theme.shape.card}px;
  --aura-composer-radius: ${theme.shape.composer}px;
  --aura-icon-radius: ${theme.shape.icon}px;
  --aura-border-width: ${theme.shape.borderWidth}px;
  --aura-blur: ${theme.blur}px;
  --aura-font-ui: ${theme.typography.ui};
  --aura-font-display: ${theme.typography.display};
  --aura-font-body: ${theme.typography.body};
  --aura-font-mono: ${theme.typography.mono};
  --aura-display-weight: ${theme.typography.displayWeight};
  --aura-display-spacing: ${theme.typography.letterSpacing};
  --aura-shadow-soft: ${theme.effects.shadowSoft};
  --aura-shadow-elevated: ${theme.effects.shadowElevated};
  --aura-hover-lift: ${theme.effects.hoverLift}px;
  --aura-transition-duration: ${theme.effects.transitionMs}ms;
}`;
}

export async function compileTheme({ configPath, config: configOverride = null, locale = "en" } = {}) {
  const resolvedConfigPath = path.resolve(configPath ?? path.join(PROJECT_ROOT, "config.example.json"));
  const config = configOverride ? { ...DEFAULT_CONFIG, ...configOverride } : await readConfig(resolvedConfigPath);
  if (typeof config.enabled !== "boolean") throw new Error("enabled must be true or false");
  if (typeof config.reduceMotion !== "boolean") throw new Error("reduceMotion must be true or false");
  if (typeof config.imagePosition !== "string" || !config.imagePosition.trim() ||
      config.imagePosition.length > 80 || /[;{}]/.test(config.imagePosition)) {
    throw new Error("imagePosition contains an unsupported value");
  }
  const { theme, filePath: themePath, requestedTheme, fallbackFrom, customThemeUnavailable } = await resolveTheme(
    config,
    resolvedConfigPath,
    normalizeLocale(locale),
  );
  const [image, artwork, baseCss, variantCss] = await Promise.all([
    resolveImage(config, resolvedConfigPath),
    resolveArtwork(theme),
    fs.readFile(path.join(PROJECT_ROOT, "assets", "base.css"), "utf8"),
    fs.readFile(path.join(PROJECT_ROOT, "assets", "theme-variants.css"), "utf8"),
  ]);
  const imageOpacity = config.imageOpacity === null || config.imageOpacity === undefined
    ? null
    : finiteNumber(config.imageOpacity, "imageOpacity", 0, 0.55);
  const variableCss = [
    renderMode(":root, [data-mode=\"light\"]", theme.light),
    renderMode(":root.darkTheme, :root.dark, .darkTheme, .dark, [data-mode=\"dark\"]", theme.dark),
    renderThemePrimitives(theme),
  ].join("\n\n");
  const css = `${variableCss}\n\n${baseCss}\n\n${variantCss}${theme.customCss ? `\n${theme.customCss}\n` : ""}`;
  const settingsBase = {
    version: AURA_VERSION,
    theme: theme.name,
    variant: theme.variant,
    label: theme.label,
    requestedTheme,
    fallbackFrom,
    customThemeUnavailable,
    imageDataUrl: image?.dataUrl ?? null,
    imageAnimated: image?.animated ?? false,
    imageUnavailable: Boolean(config.image && !image),
    imageOpacity,
    imagePosition: config.imagePosition.trim(),
    artDataUrl: artwork?.dataUrl ?? null,
    artUnavailable: Boolean(theme.artwork && !artwork),
    artPosition: artwork?.position ?? "right center",
    artSize: artwork?.size ?? "min(58vw, 860px) auto",
    artMobile: artwork?.mobile ?? "reduce",
    reduceMotion: config.reduceMotion,
  };
  const digest = crypto.createHash("sha256")
    .update(css)
    .update("\0")
    .update(JSON.stringify(settingsBase))
    .digest("hex");
  const effectiveConfig = { ...config, theme: theme.name };
  if (customThemeUnavailable) delete effectiveConfig.customTheme;
  return {
    config,
    effectiveConfig,
    configPath: resolvedConfigPath,
    theme,
    themePath,
    image,
    artwork,
    css,
    settings: { ...settingsBase, digest },
    digest,
  };
}

export async function buildPayloadFromCompiled(compiled) {
  if (!compiled || typeof compiled.css !== "string" || !isPlainObject(compiled.settings)) {
    throw new Error("A compiled theme is required to build a renderer payload");
  }
  const template = await fs.readFile(path.join(PROJECT_ROOT, "assets", "renderer-inject.js"), "utf8");
  const payload = template
    .replace("__AURA_CSS_JSON__", JSON.stringify(compiled.css))
    .replace("__AURA_SETTINGS_JSON__", JSON.stringify(compiled.settings));
  if (payload.includes("__AURA_CSS_JSON__") || payload.includes("__AURA_SETTINGS_JSON__")) {
    throw new Error("Renderer payload placeholders were not fully replaced");
  }
  return { ...compiled, payload };
}

export async function buildPayload(options = {}) {
  return buildPayloadFromCompiled(await compileTheme(options));
}

export async function writeConfig(configPath, config) {
  const resolved = path.resolve(configPath);
  await fs.mkdir(path.dirname(resolved), { recursive: true });
  await preserveCorruptConfig(resolved);
  const temporary = `${resolved}.tmp-${process.pid}-${crypto.randomBytes(5).toString("hex")}`;
  await fs.writeFile(temporary, `${JSON.stringify(config, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  try {
    await fs.rename(temporary, resolved);
  } catch (error) {
    if (!["EEXIST", "EPERM"].includes(error.code)) throw error;
    await fs.rm(resolved, { force: true });
    await fs.rename(temporary, resolved);
  }
  return resolved;
}
