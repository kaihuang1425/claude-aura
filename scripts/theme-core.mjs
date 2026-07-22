import crypto from "node:crypto";
import { constants as fsConstants } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const AURA_VERSION = "0.3.0";
export const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const THEMES_DIR = path.join(PROJECT_ROOT, "themes");
export const THEME_REGISTRY_PATH = path.join(THEMES_DIR, "registry.json");
export const THEME_KIT_FILENAME = "theme.json";
export const SUPPORTED_LOCALES = Object.freeze(["en", "zh-CN", "zh-TW"]);
export const STUDIO_THEME_SCHEMA_VERSION = 2;
export const STUDIO_MAX_LAYERS = 8;
export const STUDIO_MAX_HISTORY = 50;
export const STUDIO_FONT_UI_STACKS = Object.freeze({
  "system-sans": "system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif",
  "humanist-sans": "\"Segoe UI\", \"Hiragino Sans\", \"Yu Gothic UI\", system-ui, sans-serif",
  "rounded-sans": "\"Trebuchet MS\", \"Segoe UI\", system-ui, sans-serif",
});
export const STUDIO_FONT_DISPLAY_STACKS = Object.freeze({
  ...STUDIO_FONT_UI_STACKS,
  "editorial-serif": "ui-serif, Georgia, \"Times New Roman\", serif",
});
export const STUDIO_SHADOWS = Object.freeze({
  none: Object.freeze({ shadowSoft: "none", shadowElevated: "none" }),
  soft: Object.freeze({
    shadowSoft: "0 8px 28px rgb(0 0 0 / 0.08)",
    shadowElevated: "0 20px 60px rgb(0 0 0 / 0.18)",
  }),
  elevated: Object.freeze({
    shadowSoft: "0 12px 36px rgb(0 0 0 / 0.12)",
    shadowElevated: "0 28px 76px rgb(0 0 0 / 0.24)",
  }),
});
export const DEFAULT_CONFIG = Object.freeze({
  enabled: true,
  theme: "default",
  appearance: "system",
  image: null,
  imageOpacity: null,
  imagePosition: "center",
  imageZoom: 1,
  studioPreviewCrops: {},
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
const MAX_USER_RASTER_ARTWORK_BYTES = 400_000;
const MAX_USER_ARTWORK_TOTAL_BYTES = 1_400_000;
const MAX_CHROME_PAYLOAD_BYTES = 65_000;
const HEX_COLOR = /^#[0-9a-f]{6}$/i;
const THEME_ID_PATTERN = /^[a-z][a-z0-9-]{1,39}$/;
const FROZEN_BUILTIN_THEME_IDS = new Set([
  "default", "japanese-film-editorial", "korean-prestige", "cartoon-studio",
  "anime-twilight", "study-library", "japanese-idol", "korean-idol",
]);
const DEFAULT_LAUNCHER_STYLE = Object.freeze({
  asset: "assets/theme-art/default/launcher-mark.png",
  surface: "#2F2937",
  surfaceHover: "#3B3346",
  foreground: "#F4DFBB",
  accent: "#D66D4B",
  border: "#655C70",
  radius: 16,
  borderWidth: 1,
});
const BUILTIN_LAUNCHER_ASSET_PATTERN = /^assets\/theme-art\/([a-z][a-z0-9-]{1,39})\/launcher-mark\.png$/;
const USER_LAUNCHER_ASSET_PATTERN = /^launcher-mark\.png$/;
const USER_ARTWORK_PATH_PATTERN = /^(?:background|hero|corner-top-right|corner-bottom|card-[1-3]|brand-mark)\.(?:png|webp|avif)$/;
const STUDIO_ARTWORK_PATH_PATTERN = /^artwork\/layer-[a-f0-9]{32}\.webp$/;
const STUDIO_LAYER_ID_PATTERN = /^layer-[a-f0-9]{32}$/;
const STUDIO_SESSION_PATTERN = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const STUDIO_COLOR_TOKENS = Object.freeze({
  canvas: "--aura-background-primary",
  sidebar: "--aura-sidebar-background",
  surface: "--aura-panel-background",
  text: "--aura-text-primary",
  accent: "--aura-accent-primary",
  border: "--aura-border-emphasis",
});
const STUDIO_SHARED_TOKENS = new Set([
  "fontUi", "fontDisplay", "radius", "blur", "shadow", "backgroundScope",
  "promptWidth", "promptX", "promptY",
]);
const STUDIO_RECIPE_CONTROL_OVERRIDES = new Set(["fontUi", "fontDisplay", "radius", "shadow"]);
const STUDIO_LAYER_ROLES = new Set(["background", "hero", "corner", "decoration"]);
const STUDIO_LAYER_APPEARANCES = new Set(["all", "light", "dark"]);
const STUDIO_LAYER_CONTEXTS = new Set(["all", "new-chat", "conversation"]);
const STUDIO_LAYER_VIEWPORTS = new Set(["all", "normal", "wide"]);
const STUDIO_LAYER_MASKS = new Set(["none", "soft-right"]);
const STUDIO_LAYER_MOBILE = new Set(["keep", "reduce", "hide"]);
const STUDIO_LAYER_ANCHORS = new Set([
  "top-left", "top", "top-right", "left", "center", "right", "bottom-left", "bottom", "bottom-right",
]);
const STUDIO_LAYER_SLOTS = new Set([
  "background", "hero", "corner-top-right", "corner-bottom", "card-1", "card-2", "card-3", "brand-mark",
]);
const STUDIO_STATE_FILENAME = ".editor-state.json";
const AVIF_BRANDS = new Set(["avif", "avis"]);
const ANIMATED_AVIF_BRANDS = new Set(["avis"]);

function isPathWithin(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === "" || (!path.isAbsolute(relative) && relative !== ".." && !relative.startsWith(`..${path.sep}`));
}

function resolveUserThemesDirectory(value) {
  if (value === undefined || value === null || value === false) return null;
  if (typeof value !== "string" || !value.trim()) throw new Error("userThemesDir must be a non-empty path");
  return path.resolve(value);
}

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

function validateLauncherPngBytes(bytes, label) {
  if (bytes.length < 33
      || bytes.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a"
      || bytes.subarray(12, 16).toString("ascii") !== "IHDR") {
    throw new Error(`${label} must contain valid PNG image data`);
  }
  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  const colorType = bytes[25];
  let hasTransparencyChunk = false;
  for (let offset = 8; offset + 12 <= bytes.length;) {
    const length = bytes.readUInt32BE(offset);
    if (length > bytes.length - offset - 12) throw new Error(`${label} contains truncated PNG data`);
    const type = bytes.subarray(offset + 4, offset + 8).toString("ascii");
    if (type === "tRNS") hasTransparencyChunk = true;
    offset += length + 12;
  }
  if (width !== 96 || height !== 96) throw new Error(`${label} must be exactly 96×96 pixels`);
  if (![4, 6].includes(colorType) && !hasTransparencyChunk) {
    throw new Error(`${label} must retain a transparent alpha channel`);
  }
  if (isAnimatedImage(bytes)) throw new Error(`${label} must be a static PNG`);
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

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function assertExactKeys(value, expected, label) {
  if (!isPlainObject(value)) throw new Error(`${label} must be an object`);
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index])) {
    throw new Error(`${label} has an unsupported property shape`);
  }
}

function strictNumber(value, label, minimum, maximum) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < minimum || value > maximum) {
    throw new Error(`${label} must be a number between ${minimum} and ${maximum}`);
  }
  return Math.round(value * 100) / 100;
}

function strictInteger(value, label, minimum, maximum) {
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${label} must be an integer between ${minimum} and ${maximum}`);
  }
  return value;
}

function strictEnum(value, allowed, label) {
  if (typeof value !== "string" || !allowed.has(value)) {
    throw new Error(`${label} has an unsupported value`);
  }
  return value;
}

function hslToHex(value) {
  const match = String(value).trim().match(/^(\d{1,3}(?:\.\d+)?)\s+(\d{1,3}(?:\.\d+)?)%\s+(\d{1,3}(?:\.\d+)?)%$/);
  if (!match) return "#000000";
  const hue = ((Number(match[1]) % 360) + 360) % 360;
  const saturation = Number(match[2]) / 100;
  const lightness = Number(match[3]) / 100;
  const chroma = (1 - Math.abs((2 * lightness) - 1)) * saturation;
  const second = chroma * (1 - Math.abs(((hue / 60) % 2) - 1));
  const offset = lightness - (chroma / 2);
  const channels = hue < 60 ? [chroma, second, 0]
    : hue < 120 ? [second, chroma, 0]
      : hue < 180 ? [0, chroma, second]
        : hue < 240 ? [0, second, chroma]
          : hue < 300 ? [second, 0, chroma]
            : [chroma, 0, second];
  return `#${channels.map((channel) => Math.round((channel + offset) * 255).toString(16).padStart(2, "0")).join("")}`.toUpperCase();
}

function hexToHsl(value, label) {
  if (typeof value !== "string" || !HEX_COLOR.test(value)) throw new Error(`${label} must be a six-digit hex colour`);
  const channels = [1, 3, 5].map((offset) => Number.parseInt(value.slice(offset, offset + 2), 16) / 255);
  const maximum = Math.max(...channels);
  const minimum = Math.min(...channels);
  const delta = maximum - minimum;
  const lightness = (maximum + minimum) / 2;
  let hue = 0;
  if (delta) {
    if (maximum === channels[0]) hue = 60 * (((channels[1] - channels[2]) / delta) % 6);
    else if (maximum === channels[1]) hue = 60 * (((channels[2] - channels[0]) / delta) + 2);
    else hue = 60 * (((channels[0] - channels[1]) / delta) + 4);
  }
  if (hue < 0) hue += 360;
  const saturation = delta ? delta / (1 - Math.abs((2 * lightness) - 1)) : 0;
  const rounded = (number) => Math.round(number * 10) / 10;
  return `${rounded(hue)} ${rounded(saturation * 100)}% ${rounded(lightness * 100)}%`;
}

function finiteNumber(value, label, minimum, maximum) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < minimum || number > maximum) {
    throw new Error(`${label} must be between ${minimum} and ${maximum}`);
  }
  return number;
}

function validateStudioPreviewCrops(value) {
  if (!isPlainObject(value)) throw new Error("studioPreviewCrops must be an object");
  const entries = Object.entries(value);
  if (entries.length > 64) throw new Error("studioPreviewCrops contains too many themes");
  const result = {};
  for (const [themeId, crop] of entries) {
    if (!/^[a-z][a-z0-9-]{1,39}$/.test(themeId)) {
      throw new Error(`studioPreviewCrops contains an invalid theme id: ${themeId}`);
    }
    if (!isPlainObject(crop)) throw new Error(`studioPreviewCrops.${themeId} must be an object`);
    const keys = Object.keys(crop).sort();
    if (keys.join(",") !== "x,y,zoom") {
      throw new Error(`studioPreviewCrops.${themeId} must contain only x, y, and zoom`);
    }
    if (typeof crop.x !== "number" || typeof crop.y !== "number" || typeof crop.zoom !== "number") {
      throw new Error(`studioPreviewCrops.${themeId} values must be numbers`);
    }
    result[themeId] = {
      x: finiteNumber(crop.x, `studioPreviewCrops.${themeId}.x`, 0, 100),
      y: finiteNumber(crop.y, `studioPreviewCrops.${themeId}.y`, 0, 100),
      zoom: finiteNumber(crop.zoom, `studioPreviewCrops.${themeId}.zoom`, 1, 6),
    };
  }
  return result;
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
    "--claude-border-300": "hsl(var(--aura-border-emphasis) / var(--aura-input-border-alpha, 0.24))",
    "--claude-border-300-more": "hsl(var(--aura-border-emphasis) / calc(var(--aura-input-border-alpha, 0.24) + 0.1))",
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
    // Art-led themes may run a light content veil (floor 0.35); cards and the
    // composer keep their own opaque surfaces, and prefers-contrast forces 1.
    surfaceAlpha: finiteNumber(wallpaper.surfaceAlpha ?? 0.9, `${label}.surfaceAlpha`, 0.35, 1),
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

function validateLauncher(value, label) {
  if (value === null || value === undefined) return { ...DEFAULT_LAUNCHER_STYLE };
  if (!isPlainObject(value)) throw new Error(`${label} must be an object or null`);
  const allowed = new Set([
    "asset", "surface", "surfaceHover", "foreground", "accent", "border", "radius", "borderWidth",
  ]);
  if (Object.keys(value).some((key) => !allowed.has(key))) throw new Error(`${label} has an unsupported property`);
  const rawAsset = value.asset ?? DEFAULT_LAUNCHER_STYLE.asset;
  const builtinMatch = typeof rawAsset === "string" ? BUILTIN_LAUNCHER_ASSET_PATTERN.exec(rawAsset) : null;
  if (typeof rawAsset !== "string" ||
      (!USER_LAUNCHER_ASSET_PATTERN.test(rawAsset) &&
       (!builtinMatch || !FROZEN_BUILTIN_THEME_IDS.has(builtinMatch[1])))) {
    throw new Error(`${label}.asset must be launcher-mark.png or a built-in launcher mark`);
  }
  const colors = {};
  for (const key of ["surface", "surfaceHover", "foreground", "accent", "border"]) {
    const candidate = value[key] ?? DEFAULT_LAUNCHER_STYLE[key];
    if (!HEX_COLOR.test(candidate)) throw new Error(`${label}.${key} must be a six-digit hex colour`);
    colors[key] = candidate.toUpperCase();
  }
  const foregroundHsl = hexToHsl(colors.foreground, `${label}.foreground`);
  for (const surfaceKey of ["surface", "surfaceHover"]) {
    const ratio = contrastRatio(foregroundHsl, hexToHsl(colors[surfaceKey], `${label}.${surfaceKey}`));
    if (ratio < 4.5) throw new Error(`${label}.foreground must reach 4.5:1 contrast against ${surfaceKey}`);
  }
  return {
    asset: rawAsset,
    ...colors,
    radius: finiteNumber(value.radius ?? DEFAULT_LAUNCHER_STYLE.radius, `${label}.radius`, 8, 24),
    borderWidth: finiteNumber(value.borderWidth ?? DEFAULT_LAUNCHER_STYLE.borderWidth, `${label}.borderWidth`, 1, 3),
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
    launcher: validateLauncher(theme.launcher, `${source}.launcher`),
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

function validateNewChatLayout(value, label) {
  if (value === null || value === undefined) return null;
  assertExactKeys(value, ["widthRatio", "offsetXRatio", "offsetYRatio"], label);
  return {
    widthRatio: strictNumber(value.widthRatio, `${label}.widthRatio`, 0.4, 0.96),
    offsetXRatio: strictNumber(value.offsetXRatio, `${label}.offsetXRatio`, -0.35, 0.35),
    offsetYRatio: strictNumber(value.offsetYRatio, `${label}.offsetYRatio`, -0.3, 0.3),
  };
}

function validateStudioFrame(value, label) {
  assertExactKeys(value, ["anchor", "positionX", "positionY", "focalX", "focalY", "scale"], label);
  return {
    anchor: strictEnum(value.anchor, STUDIO_LAYER_ANCHORS, `${label}.anchor`),
    positionX: strictNumber(value.positionX, `${label}.positionX`, -100, 100),
    positionY: strictNumber(value.positionY, `${label}.positionY`, -100, 100),
    focalX: strictNumber(value.focalX, `${label}.focalX`, 0, 100),
    focalY: strictNumber(value.focalY, `${label}.focalY`, 0, 100),
    scale: strictNumber(value.scale, `${label}.scale`, 0.25, 3),
  };
}

function validateStudioLegacyLayer(value, label) {
  if (value === null || value === undefined) return null;
  if (!isPlainObject(value)) throw new Error(`${label} must be an object`);
  const allowed = new Set(["position", "size", "contextOverrides"]);
  if (Object.keys(value).some((key) => !allowed.has(key))) throw new Error(`${label} has an unsupported property`);
  const contextOverrides = value.contextOverrides === null || value.contextOverrides === undefined
    ? null
    : cloneJson(value.contextOverrides);
  if (contextOverrides !== null) {
    if (!isPlainObject(contextOverrides)) throw new Error(`${label}.contextOverrides must be an object`);
    for (const [context, override] of Object.entries(contextOverrides)) {
      if (!["new-chat", "conversation", "other"].includes(context) || !isPlainObject(override)) {
        throw new Error(`${label}.contextOverrides has an unsupported value`);
      }
      const allowedOverride = new Set(["position", "size", "opacity", "hidden"]);
      if (Object.keys(override).some((key) => !allowedOverride.has(key))) {
        throw new Error(`${label}.contextOverrides.${context} has an unsupported property`);
      }
      if (override.position !== undefined) override.position = safeCssValue(override.position, `${label}.contextOverrides.${context}.position`, 80);
      if (override.size !== undefined) override.size = safeCssValue(override.size, `${label}.contextOverrides.${context}.size`, 120);
      if (override.opacity !== undefined) override.opacity = strictNumber(override.opacity, `${label}.contextOverrides.${context}.opacity`, 0, 1);
      if (override.hidden !== undefined && typeof override.hidden !== "boolean") {
        throw new Error(`${label}.contextOverrides.${context}.hidden must be true or false`);
      }
    }
  }
  return {
    position: safeCssValue(value.position ?? "center", `${label}.position`, 80),
    size: safeCssValue(value.size ?? "cover", `${label}.size`, 120),
    contextOverrides,
  };
}

function validateStudioLayer(value, label) {
  if (!isPlainObject(value)) throw new Error(`${label} must be an object`);
  const allowed = new Set([
    "id", "path", "role", "appearance", "context", "viewport", "visible", "opacity",
    "mask", "mobile", "frames", "legacy",
  ]);
  if (Object.keys(value).some((key) => !allowed.has(key))) throw new Error(`${label} has an unsupported property`);
  if (typeof value.id !== "string" || !STUDIO_LAYER_ID_PATTERN.test(value.id)) {
    throw new Error(`${label}.id must be layer- followed by 32 lowercase hexadecimal characters`);
  }
  if (typeof value.path !== "string" || !STUDIO_ARTWORK_PATH_PATTERN.test(value.path)) {
    throw new Error(`${label}.path must be artwork/layer-<32 lowercase hex>.webp`);
  }
  if (!isPlainObject(value.frames)) throw new Error(`${label}.frames must be an object`);
  assertExactKeys(value.frames, ["normal", "wide"], `${label}.frames`);
  if (typeof value.visible !== "boolean") throw new Error(`${label}.visible must be true or false`);
  return {
    id: value.id,
    path: value.path,
    role: strictEnum(value.role, STUDIO_LAYER_ROLES, `${label}.role`),
    appearance: strictEnum(value.appearance, STUDIO_LAYER_APPEARANCES, `${label}.appearance`),
    context: strictEnum(value.context, STUDIO_LAYER_CONTEXTS, `${label}.context`),
    viewport: strictEnum(value.viewport, STUDIO_LAYER_VIEWPORTS, `${label}.viewport`),
    visible: value.visible,
    opacity: strictNumber(value.opacity, `${label}.opacity`, 0, 1),
    mask: strictEnum(value.mask, STUDIO_LAYER_MASKS, `${label}.mask`),
    mobile: strictEnum(value.mobile, STUDIO_LAYER_MOBILE, `${label}.mobile`),
    frames: {
      normal: validateStudioFrame(value.frames.normal, `${label}.frames.normal`),
      wide: validateStudioFrame(value.frames.wide, `${label}.frames.wide`),
    },
    ...(value.legacy === undefined ? {} : { legacy: validateStudioLegacyLayer(value.legacy, `${label}.legacy`) }),
  };
}

function studioRadiusPolicy(radius, borderWidth = 1) {
  return {
    control: Math.min(radius, 24),
    card: radius,
    composer: Math.min(radius, 36),
    icon: Math.min(radius, 24),
    borderWidth,
  };
}

function validateStudioThemeControls(theme, label) {
  const uiStacks = new Set(Object.values(STUDIO_FONT_UI_STACKS));
  const displayStacks = new Set(Object.values(STUDIO_FONT_DISPLAY_STACKS));
  if (!uiStacks.has(theme.typography.ui)) throw new Error(`${label}.typography.ui must use an approved Studio font`);
  if (!displayStacks.has(theme.typography.display)) throw new Error(`${label}.typography.display must use an approved Studio font`);
  if (theme.typography.body !== theme.typography.ui) throw new Error(`${label}.typography.body must match typography.ui`);
  if (!Object.values(STUDIO_SHADOWS).some((preset) => preset.shadowSoft === theme.effects.shadowSoft
      && preset.shadowElevated === theme.effects.shadowElevated)) {
    throw new Error(`${label}.effects shadows must use an approved Studio preset`);
  }
  const expectedShape = studioRadiusPolicy(theme.shape.card, theme.shape.borderWidth);
  if (theme.radius !== theme.shape.card
      || ["control", "card", "composer", "icon", "borderWidth"].some((key) => theme.shape[key] !== expectedShape[key])) {
    throw new Error(`${label}.shape must match the Studio radius policy`);
  }
}

function validateStudioThemeKitDocument(raw, source) {
  if (!isPlainObject(raw)) throw new Error(`${source} must contain a JSON object`);
  const allowed = new Set([
    "$comment", "schemaVersion", "id", "labels", "descriptions", "swatches", "preview",
    "studioPreview", "newChatLayout", "backgroundScope", "artworkLayers", "sourceRecipe",
    "controlOverrides", "theme",
  ]);
  if (Object.keys(raw).some((key) => !allowed.has(key))) throw new Error(`${source} has an unsupported property`);
  if (raw.schemaVersion !== STUDIO_THEME_SCHEMA_VERSION) {
    throw new Error(`${source} must use schemaVersion ${STUDIO_THEME_SCHEMA_VERSION}`);
  }
  if (typeof raw.id !== "string" || !THEME_ID_PATTERN.test(raw.id)) {
    throw new Error(`${source}.id must be lowercase kebab-case`);
  }
  const swatches = Array.isArray(raw.swatches) ? raw.swatches : [];
  if (swatches.length < 3 || swatches.length > 6 || swatches.some((value) => !HEX_COLOR.test(value))) {
    throw new Error(`${source}.swatches must contain 3 to 6 six-digit hex colours`);
  }
  if (!isPlainObject(raw.preview)) throw new Error(`${source}.preview must be an object`);
  const preview = {};
  for (const key of ["chrome", "background", "surface", "accent", "text"]) {
    if (!HEX_COLOR.test(raw.preview[key] ?? "")) throw new Error(`${source}.preview.${key} must be a six-digit hex colour`);
    preview[key] = raw.preview[key].toUpperCase();
  }
  if (Object.keys(raw.preview).some((key) => !Object.hasOwn(preview, key))) {
    throw new Error(`${source}.preview has an unsupported property`);
  }
  if (raw.studioPreview !== null && raw.studioPreview !== undefined) {
    throw new Error(`${source}.studioPreview is not supported for Studio-authored themes`);
  }
  if (!Array.isArray(raw.artworkLayers) || raw.artworkLayers.length > STUDIO_MAX_LAYERS) {
    throw new Error(`${source}.artworkLayers must contain 0 to ${STUDIO_MAX_LAYERS} layers`);
  }
  const artworkLayers = raw.artworkLayers.map((layer, index) => validateStudioLayer(layer, `${source}.artworkLayers[${index}]`));
  if (new Set(artworkLayers.map((layer) => layer.id)).size !== artworkLayers.length) {
    throw new Error(`${source}.artworkLayers ids must be unique`);
  }
  if (!isPlainObject(raw.theme)) throw new Error(`${source}.theme must be an object`);
  if (raw.theme.customCss !== undefined && String(raw.theme.customCss).trim()) {
    throw new Error(`${source}.theme.customCss must be empty`);
  }
  const theme = validateTheme(raw.theme, `${source}.theme`);
  if (theme.name !== raw.id || (theme.variant !== raw.id && !FROZEN_BUILTIN_THEME_IDS.has(theme.variant))) {
    throw new Error(`${source}.theme name must match id and variant must match id or a built-in visual recipe`);
  }
  const sourceRecipe = raw.sourceRecipe === null || raw.sourceRecipe === undefined
    ? null
    : strictEnum(raw.sourceRecipe, FROZEN_BUILTIN_THEME_IDS, `${source}.sourceRecipe`);
  if (!Array.isArray(raw.controlOverrides ?? [])) {
    throw new Error(`${source}.controlOverrides must be an array`);
  }
  const controlOverrides = (raw.controlOverrides ?? []).map((value, index) =>
    strictEnum(value, STUDIO_RECIPE_CONTROL_OVERRIDES, `${source}.controlOverrides[${index}]`));
  if (new Set(controlOverrides).size !== controlOverrides.length) {
    throw new Error(`${source}.controlOverrides must be unique`);
  }
  if (sourceRecipe === null && controlOverrides.length) {
    throw new Error(`${source}.controlOverrides require a sourceRecipe`);
  }
  if (sourceRecipe !== null && theme.variant !== sourceRecipe) {
    throw new Error(`${source}.theme.variant must match sourceRecipe`);
  }
  validateStudioThemeControls(theme, `${source}.theme`);
  return {
    schemaVersion: STUDIO_THEME_SCHEMA_VERSION,
    id: raw.id,
    labels: validateLocalizedMap(raw.labels, `${source}.labels`, 80),
    descriptions: validateLocalizedMap(raw.descriptions, `${source}.descriptions`, 220),
    swatches: swatches.map((value) => value.toUpperCase()),
    preview,
    studioPreview: null,
    studioPreviewFrame: null,
    newChatLayout: validateNewChatLayout(raw.newChatLayout, `${source}.newChatLayout`),
    backgroundScope: strictEnum(raw.backgroundScope, new Set(["content", "full-window"]), `${source}.backgroundScope`),
    artwork: null,
    artworkLayers,
    sourceRecipe,
    controlOverrides,
    theme,
  };
}

function validateRegistryEntry(entry, label, { source = "builtin" } = {}) {
  if (!isPlainObject(entry)) throw new Error(`${label} must be an object`);
  if (typeof entry.id !== "string" || !THEME_ID_PATTERN.test(entry.id)) {
    throw new Error(`${label}.id must be lowercase kebab-case`);
  }
  const file = source === "builtin" ? (entry.file ?? `${entry.id}.json`) : null;
  if (source === "builtin" && file !== `${entry.id}.json`) throw new Error(`${label}.file must be ${entry.id}.json`);
  if (source === "user" && entry.file !== undefined) throw new Error(`${label}.file is not allowed in a standalone kit`);
  const swatches = Array.isArray(entry.swatches) ? entry.swatches : [];
  if (swatches.length < 3 || swatches.length > 6 || swatches.some((value) => !HEX_COLOR.test(value))) {
    throw new Error(`${label}.swatches must contain 3 to 6 six-digit hex colours`);
  }
  const preview = isPlainObject(entry.preview) ? entry.preview : {};
  for (const key of ["chrome", "background", "surface", "accent", "text"]) {
    if (!HEX_COLOR.test(preview[key] ?? "")) throw new Error(`${label}.preview.${key} must be a six-digit hex colour`);
  }
  let studioPreview = null;
  if (entry.studioPreview !== null && entry.studioPreview !== undefined) {
    const expectedStudioPreview = source === "builtin"
      ? `assets/studio-previews/masters/${entry.id}.png`
      : "card-preview.webp";
    if (entry.studioPreview !== expectedStudioPreview) {
      throw new Error(`${label}.studioPreview must be ${expectedStudioPreview}`);
    }
    studioPreview = entry.studioPreview;
  }
  let studioPreviewFrame = null;
  if (entry.studioPreviewFrame !== null && entry.studioPreviewFrame !== undefined) {
    if (!studioPreview) throw new Error(`${label}.studioPreviewFrame requires studioPreview`);
    if (!isPlainObject(entry.studioPreviewFrame)) throw new Error(`${label}.studioPreviewFrame must be an object or null`);
    const keys = Object.keys(entry.studioPreviewFrame).sort();
    if (keys.join(",") !== "x,y,zoom") {
      throw new Error(`${label}.studioPreviewFrame must contain only x, y, and zoom`);
    }
    studioPreviewFrame = {
      x: finiteNumber(entry.studioPreviewFrame.x, `${label}.studioPreviewFrame.x`, 0, 100),
      y: finiteNumber(entry.studioPreviewFrame.y, `${label}.studioPreviewFrame.y`, 0, 100),
      zoom: finiteNumber(entry.studioPreviewFrame.zoom, `${label}.studioPreviewFrame.zoom`, 1, 6),
    };
  }
  const validateNewChatLayout = (value, layoutLabel) => {
    if (value === null || value === undefined) return null;
    if (!isPlainObject(value)) throw new Error(`${layoutLabel} must be an object or null`);
    const keys = Object.keys(value).sort();
    if (keys.join(",") !== "offsetXRatio,offsetYRatio,widthRatio") {
      throw new Error(`${layoutLabel} must contain only widthRatio, offsetXRatio, and offsetYRatio`);
    }
    for (const key of keys) {
      if (typeof value[key] !== "number") throw new Error(`${layoutLabel}.${key} must be a number`);
    }
    return {
      widthRatio: finiteNumber(value.widthRatio, `${layoutLabel}.widthRatio`, 0.4, 0.96),
      offsetXRatio: finiteNumber(value.offsetXRatio, `${layoutLabel}.offsetXRatio`, -0.35, 0.35),
      offsetYRatio: finiteNumber(value.offsetYRatio, `${layoutLabel}.offsetYRatio`, -0.3, 0.3),
    };
  };
  const newChatLayout = validateNewChatLayout(entry.newChatLayout, `${label}.newChatLayout`);
  const ARTWORK_PATH_PATTERN = /^assets\/theme-art\/(?:[a-z0-9-]+\/)?[a-z0-9-]+\.(?:svg|png|webp|avif)$/;
  const validateArtworkLayer = (layer, layerLabel, { allowKeep = true } = {}) => {
    if (!isPlainObject(layer)) throw new Error(`${layerLabel} must be an object`);
    const artworkPath = String(layer.path ?? "");
    const validArtworkPath = source === "builtin"
      ? ARTWORK_PATH_PATTERN.test(artworkPath)
      : USER_ARTWORK_PATH_PATTERN.test(artworkPath);
    if (!validArtworkPath) {
      const detail = source === "builtin" ? "project artwork path" : "theme-kit slot path";
      throw new Error(`${layerLabel}.path is not a supported ${detail}`);
    }
    if (source === "user" && layer.mobile !== undefined
        && !["hide", "reduce", ...(allowKeep ? ["keep"] : [])].includes(layer.mobile)) {
      throw new Error(`${layerLabel}.mobile has an unsupported value`);
    }
    if (source === "user" && layer.mask !== undefined && !["none", "soft-right"].includes(layer.mask)) {
      throw new Error(`${layerLabel}.mask has an unsupported value`);
    }
    const role = layer.role ?? "decoration";
    if (!["background", "decoration", "hero"].includes(role)) {
      throw new Error(`${layerLabel}.role has an unsupported value`);
    }
    const appearance = layer.appearance ?? null;
    if (appearance !== null && !["light", "dark"].includes(appearance)) {
      throw new Error(`${layerLabel}.appearance must be light or dark`);
    }
    let contextOverrides = null;
    if (layer.contextOverrides !== null && layer.contextOverrides !== undefined) {
      if (!isPlainObject(layer.contextOverrides)) throw new Error(`${layerLabel}.contextOverrides must be an object`);
      contextOverrides = {};
      for (const [context, override] of Object.entries(layer.contextOverrides)) {
        if (!["new-chat", "conversation", "other"].includes(context)) {
          throw new Error(`${layerLabel}.contextOverrides has an unsupported context: ${context}`);
        }
        if (!isPlainObject(override)) throw new Error(`${layerLabel}.contextOverrides.${context} must be an object`);
        const allowedKeys = new Set(["position", "size", "opacity", "hidden"]);
        if (Object.keys(override).some((key) => !allowedKeys.has(key))) {
          throw new Error(`${layerLabel}.contextOverrides.${context} has an unsupported property`);
        }
        if (Object.keys(override).length === 0) {
          throw new Error(`${layerLabel}.contextOverrides.${context} must not be empty`);
        }
        const normalized = {};
        if (override.position !== undefined) {
          normalized.position = safeCssValue(override.position, `${layerLabel}.contextOverrides.${context}.position`, 80);
        }
        if (override.size !== undefined) {
          normalized.size = safeCssValue(override.size, `${layerLabel}.contextOverrides.${context}.size`, 120);
        }
        if (override.opacity !== undefined) {
          if (typeof override.opacity !== "number") {
            throw new Error(`${layerLabel}.contextOverrides.${context}.opacity must be a number`);
          }
          normalized.opacity = finiteNumber(override.opacity, `${layerLabel}.contextOverrides.${context}.opacity`, 0, 1);
        }
        if (override.hidden !== undefined) {
          if (typeof override.hidden !== "boolean") {
            throw new Error(`${layerLabel}.contextOverrides.${context}.hidden must be true or false`);
          }
          normalized.hidden = override.hidden;
        }
        contextOverrides[context] = normalized;
      }
    }
    return {
      path: artworkPath,
      position: safeCssValue(layer.position ?? "right center", `${layerLabel}.position`, 80),
      size: safeCssValue(layer.size ?? "min(58vw, 860px) auto", `${layerLabel}.size`, 120),
      mobile: ["hide", "keep"].includes(layer.mobile) ? layer.mobile : "reduce",
      opacity: layer.opacity === undefined ? null : finiteNumber(layer.opacity, `${layerLabel}.opacity`, 0, 1),
      mask: layer.mask === "none" ? "none" : "soft-right",
      role,
      appearance,
      contextOverrides,
    };
  };
  let artwork = null;
  let artworkLayers = null;
  if (entry.artworkLayers !== null && entry.artworkLayers !== undefined) {
    if (!Array.isArray(entry.artworkLayers) || entry.artworkLayers.length < 1 || entry.artworkLayers.length > STUDIO_MAX_LAYERS) {
      throw new Error(`${label}.artworkLayers must contain 1 to ${STUDIO_MAX_LAYERS} layers`);
    }
    artworkLayers = entry.artworkLayers.map((layer, index) => validateArtworkLayer(layer, `${label}.artworkLayers[${index}]`));
  } else if (entry.artwork !== null && entry.artwork !== undefined) {
    if (!isPlainObject(entry.artwork)) throw new Error(`${label}.artwork must be an object or null`);
    if (entry.artwork.appearance !== undefined) {
      throw new Error(`${label}.artwork.appearance is only supported in artworkLayers`);
    }
    if (source === "user" && (entry.artwork.opacity !== undefined || entry.artwork.mask !== undefined)) {
      throw new Error(`${label}.artwork.opacity and mask are only supported in artworkLayers`);
    }
    const validated = validateArtworkLayer(entry.artwork, `${label}.artwork`, { allowKeep: false });
    artwork = { path: validated.path, position: validated.position, size: validated.size, mobile: validated.mobile === "keep" ? "reduce" : validated.mobile };
  }
  return {
    id: entry.id,
    file,
    labels: validateLocalizedMap(entry.labels, `${label}.labels`, 80),
    descriptions: validateLocalizedMap(entry.descriptions, `${label}.descriptions`, 220),
    swatches: [...swatches],
    preview: Object.fromEntries(Object.entries(preview).map(([key, value]) => [key, value.toUpperCase()])),
    studioPreview,
    studioPreviewFrame,
    newChatLayout,
    artwork,
    artworkLayers,
  };
}

async function validateUserArtworkFile(kitRoot, relativePath, label) {
  const candidate = path.resolve(kitRoot, relativePath);
  if (!isPathWithin(kitRoot, candidate)) throw new Error(`${label} must remain inside the theme kit`);
  let stat;
  try {
    stat = await fs.lstat(candidate);
  } catch (error) {
    if (error.code === "ENOENT") throw new Error(`${label} is missing: ${relativePath}`);
    throw error;
  }
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`${label} must be a regular file`);
  const [realRoot, realCandidate] = await Promise.all([fs.realpath(kitRoot), fs.realpath(candidate)]);
  if (!isPathWithin(realRoot, realCandidate)) throw new Error(`${label} must remain inside the theme kit`);
  const extension = path.extname(relativePath).toLowerCase();
  const expectedMime = ARTWORK_TYPES.get(extension);
  if (!expectedMime) throw new Error(`${label} has an unsupported file type`);
  const maximum = MAX_USER_RASTER_ARTWORK_BYTES;
  if (stat.size <= 0 || stat.size >= maximum) {
    throw new Error(`${label} must be smaller than ${Math.round(maximum / 1000)} KB`);
  }
  const bytes = await fs.readFile(candidate);
  if (bytes.length <= 0 || bytes.length >= maximum) {
    throw new Error(`${label} must be smaller than ${Math.round(maximum / 1000)} KB`);
  }
  const detectedMime = detectImageMime(bytes);
  if (detectedMime !== expectedMime) throw new Error(`${label} extension does not match its content`);
  return bytes.length;
}

async function validateUserLauncherFile(kitRoot, relativePath, label) {
  const size = await validateUserArtworkFile(kitRoot, relativePath, label);
  const candidate = path.resolve(kitRoot, relativePath);
  const bytes = await fs.readFile(candidate);
  validateLauncherPngBytes(bytes, label);
  return size;
}

async function validateUserThemeArtwork(kitRoot, entry, theme, label) {
  const artworkItems = entry.artworkLayers ?? (entry.artwork ? [entry.artwork] : []);
  let total = 0;
  const validatedPaths = new Set();
  for (let index = 0; index < artworkItems.length; index += 1) {
    const itemLabel = entry.artworkLayers ? `${label}.artworkLayers[${index}].path` : `${label}.artwork.path`;
    const relativePath = artworkItems[index].path;
    if (!validatedPaths.has(relativePath)) {
      total += await validateUserArtworkFile(kitRoot, relativePath, itemLabel);
      validatedPaths.add(relativePath);
    }
  }
  if (total >= MAX_USER_ARTWORK_TOTAL_BYTES) {
    throw new Error(`${label} embedded artwork must total less than 1.4 MB`);
  }
  if (entry.studioPreview) {
    await validateUserArtworkFile(kitRoot, entry.studioPreview, `${label}.studioPreview`);
  }
  if (theme.launcher.asset === "launcher-mark.png") {
    total += await validateUserLauncherFile(kitRoot, theme.launcher.asset, `${label}.theme.launcher.asset`);
  }
  if (total >= MAX_USER_ARTWORK_TOTAL_BYTES) {
    throw new Error(`${label} embedded artwork must total less than 1.4 MB`);
  }
}

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
  if (!isPlainObject(raw) || ![1, STUDIO_THEME_SCHEMA_VERSION].includes(raw.schemaVersion)) {
    throw new Error(`${THEME_KIT_FILENAME} must use schemaVersion 1 or ${STUDIO_THEME_SCHEMA_VERSION}`);
  }
  const entry = raw.schemaVersion === STUDIO_THEME_SCHEMA_VERSION
    ? validateStudioThemeKitDocument(raw, THEME_KIT_FILENAME)
    : validateRegistryEntry(raw, THEME_KIT_FILENAME, { source: "user" });
  if (expectedId !== null && entry.id !== expectedId) {
    throw new Error(`${THEME_KIT_FILENAME} id "${entry.id}" must match its installed folder "${expectedId}"`);
  }
  if (!isPlainObject(raw.theme)) throw new Error(`${THEME_KIT_FILENAME}.theme must be an object`);
  if (raw.schemaVersion === 1 && raw.theme.variant !== entry.id) {
    throw new Error(`${THEME_KIT_FILENAME}.theme.variant must match id "${entry.id}"`);
  }
  const theme = raw.schemaVersion === STUDIO_THEME_SCHEMA_VERSION
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

async function discoverUserThemeEntries(userThemesDir, builtInIds, aliases, warn) {
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

async function applyStudioSourceRecipe(theme, entry) {
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

async function readRegisteredTheme(entry, locale) {
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

async function resolveTheme(config, configPath, locale, { userThemesDir = null, onWarning = null } = {}) {
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

export async function resolveArtworkLayers(theme) {
  if (!Array.isArray(theme.artworkLayers) || theme.artworkLayers.length === 0) return null;
  const layers = [];
  for (const layer of theme.artworkLayers) {
    const resolved = await resolveArtwork({
      artwork: layer,
      artworkRoot: theme.artworkRoot,
      artworkAllowedRoot: theme.artworkAllowedRoot,
    });
    if (resolved) layers.push(resolved);
  }
  return layers.length ? layers : null;
}

export async function resolveArtwork(theme) {
  if (!theme.artwork) return null;
  const pathRoot = path.resolve(theme.artworkRoot ?? PROJECT_ROOT);
  const allowedRoot = path.resolve(theme.artworkAllowedRoot ?? path.join(PROJECT_ROOT, "assets", "theme-art"));
  const artworkPath = path.resolve(pathRoot, theme.artwork.path);
  if (!isPathWithin(allowedRoot, artworkPath)) {
    throw new Error(`Theme artwork must remain inside ${allowedRoot}`);
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
  try {
    const [realAllowedRoot, realArtworkPath] = await Promise.all([fs.realpath(allowedRoot), fs.realpath(artworkPath)]);
    if (!isPathWithin(realAllowedRoot, realArtworkPath)) {
      throw new Error(`Theme artwork must remain inside ${allowedRoot}`);
    }
  } catch (error) {
    if (isUnavailableFileError(error)) return null;
    throw error;
  }
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

function filterThemeVariantCss(source, themeId, variantId = themeId) {
  const mobileStart = source.indexOf("@media (max-width: 820px)");
  const motionStart = source.indexOf("@media (prefers-reduced-motion: no-preference)");
  const body = mobileStart < 0 ? source : source.slice(0, mobileStart);
  const mobile = mobileStart < 0 ? "" : source.slice(mobileStart, motionStart < 0 ? source.length : motionStart);
  const motion = motionStart < 0 || variantId !== "cartoon-studio" ? "" : source.slice(motionStart);
  const sectionPattern = /(?=\/\* (?:Japanese Film Editorial|Korean Prestige|Cartoon Studio|Anime Twilight|Study Library|Japanese Idol|Korean Idol):)/g;
  const sections = body.split(sectionPattern);
  const selector = `[data-claude-aura-theme="${variantId}"]`;
  const selected = `${[sections[0], ...sections.slice(1).filter((section) => section.includes(selector))].join("")}${mobile}${motion}`;
  return variantId === themeId
    ? selected
    : selected.replaceAll(selector, `[data-claude-aura-variant="${variantId}"]`);
}

export async function compileTheme({
  configPath,
  config: configOverride = null,
  locale = "en",
  userThemesDir = null,
  themeKitDirectory = null,
  onWarning = null,
} = {}) {
  const resolvedConfigPath = path.resolve(configPath ?? path.join(PROJECT_ROOT, "config.example.json"));
  const config = configOverride ? { ...DEFAULT_CONFIG, ...configOverride } : await readConfig(resolvedConfigPath);
  if (typeof config.enabled !== "boolean") throw new Error("enabled must be true or false");
  if (typeof config.reduceMotion !== "boolean") throw new Error("reduceMotion must be true or false");
  if (!["system", "light", "dark"].includes(config.appearance)) {
    throw new Error("appearance must be system, light, or dark");
  }
  if (typeof config.imagePosition !== "string" || !config.imagePosition.trim() ||
      config.imagePosition.length > 80 || /[;{}]/.test(config.imagePosition)) {
    throw new Error("imagePosition contains an unsupported value");
  }
  let themeResolution;
  if (themeKitDirectory !== null) {
    const kit = await readThemeKit(path.resolve(themeKitDirectory));
    const theme = await readRegisteredTheme(kit.entry, normalizeLocale(locale));
    themeResolution = {
      theme,
      filePath: kit.kitPath,
      requestedTheme: kit.id,
      fallbackFrom: null,
      customThemeUnavailable: false,
    };
  } else {
    themeResolution = await resolveTheme(
      config,
      resolvedConfigPath,
      normalizeLocale(locale),
      { userThemesDir, onWarning },
    );
  }
  const { theme, filePath: themePath, requestedTheme, fallbackFrom, customThemeUnavailable } = themeResolution;
  const [image, artwork, artworkLayers, baseCss, allVariantCss] = await Promise.all([
    resolveImage(config, resolvedConfigPath),
    resolveArtwork(theme),
    resolveArtworkLayers(theme),
    fs.readFile(path.join(PROJECT_ROOT, "assets", "base.css"), "utf8"),
    fs.readFile(path.join(PROJECT_ROOT, "assets", "theme-variants.css"), "utf8"),
  ]);
  const variantCss = filterThemeVariantCss(allVariantCss, theme.name, theme.variant);
  const imageOpacity = config.imageOpacity === null || config.imageOpacity === undefined
    ? null
    : finiteNumber(config.imageOpacity, "imageOpacity", 0, 0.55);
  if (typeof config.imageZoom !== "number") throw new Error("imageZoom must be a number");
  const imageZoom = finiteNumber(config.imageZoom, "imageZoom", 1, 2);
  const studioPreviewCrops = validateStudioPreviewCrops(config.studioPreviewCrops ?? {});
  const variableCss = [
    renderMode(":root, :root:not([data-claude-aura-effective-mode=\"dark\"]):is(.lightTheme,.light,[data-mode=\"light\"]), :root:not([data-claude-aura-effective-mode=\"dark\"]) :is(.lightTheme,.light,[data-mode=\"light\"]), :root[data-claude-aura-appearance][data-claude-aura-effective-mode=\"light\"]", theme.light),
    renderMode(":root:not([data-claude-aura-effective-mode=\"light\"]):is(.darkTheme,.dark,[data-mode=\"dark\"]), :root:not([data-claude-aura-effective-mode=\"light\"]) :is(.darkTheme,.dark,[data-mode=\"dark\"]), :root[data-claude-aura-appearance][data-claude-aura-effective-mode=\"dark\"]", theme.dark),
    renderThemePrimitives(theme),
  ].join("\n\n");
  const css = `${variableCss}\n\n${baseCss}\n\n${variantCss}${theme.customCss ? `\n${theme.customCss}\n` : ""}`
    .replace(/^[ \t]+/gm, "");
  const settingsBase = {
    version: AURA_VERSION,
    theme: theme.name,
    variant: theme.variant,
    label: theme.label,
    requestedTheme,
    fallbackFrom,
    customThemeUnavailable,
    appearance: config.appearance,
    imageDataUrl: image?.dataUrl ?? null,
    imageAnimated: image?.animated ?? false,
    imageUnavailable: Boolean(config.image && !image),
    imageOpacity,
    imagePosition: config.imagePosition.trim(),
    imageZoom,
    artDataUrl: artwork?.dataUrl ?? null,
    artUnavailable: Boolean((theme.artwork && !artwork)
      || (Array.isArray(theme.artworkLayers) && theme.artworkLayers.length > 0 && !artworkLayers)),
    artPosition: artwork?.position ?? "right center",
    artSize: artwork?.size ?? "min(58vw, 860px) auto",
    artMobile: artwork?.mobile ?? "reduce",
    artLayers: artworkLayers
      ? artworkLayers.map((layer) => ({
        dataUrl: layer.dataUrl,
        position: layer.position ?? layer.legacy?.position,
        size: layer.size ?? layer.legacy?.size,
        mobile: layer.mobile,
        opacity: layer.opacity,
        mask: layer.mask,
        role: layer.role,
        ...(layer.appearance ? { appearance: layer.appearance } : {}),
        contextOverrides: layer.contextOverrides ?? layer.legacy?.contextOverrides ?? null,
        ...(layer.id ? {
          id: layer.id,
          context: layer.context,
          viewport: layer.viewport,
          visible: layer.visible,
          frames: cloneJson(layer.frames),
          legacy: Boolean(layer.legacy),
        } : {}),
      }))
      : null,
    backgroundScope: theme.backgroundScope ?? "full-window",
    newChatLayout: theme.newChatLayout ? { ...theme.newChatLayout } : null,
    reduceMotion: config.reduceMotion,
  };
  const digest = crypto.createHash("sha256")
    .update(css)
    .update("\0")
    .update(JSON.stringify(settingsBase))
    .digest("hex");
  const effectiveConfig = {
    ...config,
    theme: theme.name,
    appearance: config.appearance,
    imagePosition: config.imagePosition.trim(),
    imageZoom,
    studioPreviewCrops,
  };
  if (customThemeUnavailable) delete effectiveConfig.customTheme;
  return {
    config,
    effectiveConfig,
    configPath: resolvedConfigPath,
    theme,
    themePath,
    image,
    artwork,
    artworkLayers,
    css,
    settings: { ...settingsBase, digest },
    digest,
  };
}

export async function buildPayloadFromCompiled(compiled) {
  if (!compiled || typeof compiled.css !== "string" || !isPlainObject(compiled.settings)) {
    throw new Error("A compiled theme is required to build a renderer payload");
  }
  const template = (await fs.readFile(path.join(PROJECT_ROOT, "assets", "renderer-inject.js"), "utf8"))
    .replace(/^[ \t]+/gm, "")
    .replace(/\r?\n/g, "");
  const runtimeSettings = { ...compiled.settings };
  for (const diagnosticKey of [
    "requestedTheme",
    "fallbackFrom",
    "customThemeUnavailable",
    "imageUnavailable",
    "artUnavailable",
  ]) delete runtimeSettings[diagnosticKey];
  runtimeSettings.q = runtimeSettings.backgroundScope === "full-window" ? "f" : "c";
  delete runtimeSettings.backgroundScope;
  if (Array.isArray(runtimeSettings.artLayers)) {
    const contextKeys = { "new-chat": "n", conversation: "c", other: "o" };
    const anchorKeys = {
      "top-left": "tl", top: "t", "top-right": "tr", left: "l", center: "c", right: "r",
      "bottom-left": "bl", bottom: "b", "bottom-right": "br",
    };
    const urls = [];
    const urlIndexes = new Map();
    runtimeSettings.artLayers = runtimeSettings.artLayers.map((layer) => {
      let dataIndex = urlIndexes.get(layer.dataUrl);
      if (dataIndex === undefined) {
        dataIndex = urls.length;
        urls.push(layer.dataUrl);
        urlIndexes.set(layer.dataUrl, dataIndex);
      }
      const compact = { d: dataIndex };
      if (layer.position !== undefined) compact.p = layer.position;
      if (layer.size !== undefined) compact.s = layer.size;
      if (layer.mobile !== "reduce") compact.m = layer.mobile[0];
      if (layer.opacity !== null) compact.o = layer.opacity;
      if (layer.mask === "none") compact.k = "n";
      if (layer.role !== "decoration") compact.r = layer.role[0];
      if (layer.appearance && layer.appearance !== "all") compact.a = layer.appearance[0];
      if (layer.contextOverrides) {
        compact.c = {};
        for (const [context, override] of Object.entries(layer.contextOverrides)) {
          const value = {};
          if (override.position !== undefined) value.p = override.position;
          if (override.size !== undefined) value.s = override.size;
          if (override.opacity !== undefined) value.o = override.opacity;
          if (override.hidden !== undefined) value.h = override.hidden;
          compact.c[contextKeys[context]] = value;
        }
      }
      if (layer.id) {
        compact.i = layer.id;
        if (layer.context !== "all") compact.t = layer.context[0];
        if (layer.viewport !== "all") compact.v = layer.viewport[0];
        if (!layer.legacy) {
          if (layer.frames.normal.anchor !== "center") compact.h = anchorKeys[layer.frames.normal.anchor];
          if (layer.frames.wide.anchor !== layer.frames.normal.anchor) compact.z = anchorKeys[layer.frames.wide.anchor];
          compact.n = [
            layer.frames.normal.positionX,
            layer.frames.normal.positionY,
            layer.frames.normal.focalX,
            layer.frames.normal.focalY,
            layer.frames.normal.scale,
          ];
          const wide = [
            layer.frames.wide.positionX,
            layer.frames.wide.positionY,
            layer.frames.wide.focalX,
            layer.frames.wide.focalY,
            layer.frames.wide.scale,
          ];
          if (wide.some((value, index) => value !== compact.n[index])) compact.w = wide;
        }
        if (!layer.visible) compact.x = 0;
      }
      return compact;
    });
    runtimeSettings.u = urls;
  }
  if (runtimeSettings.newChatLayout) {
    const layout = runtimeSettings.newChatLayout;
    runtimeSettings.n = [layout.widthRatio, layout.offsetXRatio, layout.offsetYRatio];
    delete runtimeSettings.newChatLayout;
  }
  let compactCss = "";
  let quote = null;
  let escaped = false;
  let pendingSpace = false;
  const punctuation = "{};,>";
  const spaceSuppressingPrevious = "{}:;,>";
  const blockKinds = [];
  let blockBoundary = 0;
  for (let index = 0; index < compiled.css.length; index += 1) {
    const character = compiled.css[index];
    if (quote) {
      compactCss += character;
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === quote) quote = null;
      continue;
    }
    if (character === "/" && compiled.css[index + 1] === "*") {
      const commentEnd = compiled.css.indexOf("*/", index + 2);
      index = commentEnd < 0 ? compiled.css.length : commentEnd + 1;
      continue;
    }
    if (character === '"' || character === "'") {
      if (pendingSpace && compactCss && !spaceSuppressingPrevious.includes(compactCss.at(-1))) compactCss += " ";
      pendingSpace = false;
      quote = character;
      compactCss += character;
      continue;
    }
    if (/\s/.test(character)) {
      pendingSpace = true;
      continue;
    }
    if (character === ":") {
      if (blockKinds.at(-1) === "declarations") {
        if (compactCss.endsWith(" ")) compactCss = compactCss.slice(0, -1);
      } else if (pendingSpace && compactCss && !spaceSuppressingPrevious.includes(compactCss.at(-1))) {
        compactCss += " ";
      }
      compactCss += character;
      pendingSpace = false;
      continue;
    }
    if (punctuation.includes(character)) {
      if (compactCss.endsWith(" ")) compactCss = compactCss.slice(0, -1);
      if (character === "}" && compactCss.endsWith(";")) compactCss = compactCss.slice(0, -1);
      if (character === "{") {
        const header = compactCss.slice(blockBoundary).trim();
        blockKinds.push(/^@(media|supports|container|layer|document|scope|(?:-webkit-)?keyframes)\b/i.test(header)
          ? "container"
          : "declarations");
      }
      compactCss += character;
      if (character === "}") blockKinds.pop();
      if (character === "{" || character === "}") blockBoundary = compactCss.length;
      pendingSpace = false;
      continue;
    }
    if (pendingSpace && compactCss && !spaceSuppressingPrevious.includes(compactCss.at(-1))) compactCss += " ";
    pendingSpace = false;
    compactCss += character;
  }
  compactCss = compactCss.trim();
  const payload = template
    .replace("__AURA_CSS_JSON__", JSON.stringify(compactCss))
    .replace("__AURA_SETTINGS_JSON__", JSON.stringify(runtimeSettings));
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

function studioUuid() {
  return crypto.randomUUID().toLowerCase();
}

function studioHex() {
  return crypto.randomBytes(16).toString("hex");
}

function studioPaths(editorRoot) {
  if (typeof editorRoot !== "string" || !editorRoot.trim()) throw new Error("editorRoot must be a non-empty path");
  const root = path.resolve(editorRoot);
  const active = path.join(root, "active");
  return {
    root,
    active,
    artwork: path.join(active, "artwork"),
    previewRoot: path.join(root, "preview"),
    previewActive: path.join(root, "preview", "active"),
    imports: path.join(root, "imports"),
    state: path.join(active, STUDIO_STATE_FILENAME),
    theme: path.join(active, THEME_KIT_FILENAME),
  };
}

async function pathKind(candidate) {
  try {
    return await fs.lstat(candidate);
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

async function resolveStudioUserThemesRoot(value, { create = false } = {}) {
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

async function assertStudioActivePaths(paths, { requireActive = false, requireState = false } = {}) {
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

async function atomicWriteText(filePath, contents) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.tmp-${process.pid}-${studioHex()}`;
  const backup = `${filePath}.old-${process.pid}-${studioHex()}`;
  await fs.writeFile(temporary, contents, { encoding: "utf8", mode: 0o600, flag: "wx" });
  let movedOld = false;
  try {
    if (await pathKind(filePath)) {
      await fs.rename(filePath, backup);
      movedOld = true;
    }
    await fs.rename(temporary, filePath);
    if (movedOld) await fs.rm(backup, { force: true });
  } catch (error) {
    await fs.rm(temporary, { force: true }).catch(() => {});
    if (movedOld && !(await pathKind(filePath))) await fs.rename(backup, filePath).catch(() => {});
    throw error;
  }
}

async function atomicWriteJson(filePath, value) {
  await atomicWriteText(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function emptyStudioFeedback() {
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

function studioFontId(stack, choices, fallback) {
  return Object.entries(choices).find(([, value]) => value === stack)?.[0] ?? fallback;
}

function studioShadowId(effects) {
  return Object.entries(STUDIO_SHADOWS)
    .find(([, value]) => value.shadowSoft === effects.shadowSoft && value.shadowElevated === effects.shadowElevated)?.[0] ?? "soft";
}

async function studioLayerBytes(document, activeDirectory) {
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

async function ensureStudioPreviewDirectory(paths) {
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

function canonicalStudioTokens(document, mode) {
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

async function canonicalStudioState(internal, editorRoot) {
  if (!internal) return { active: false };
  const paths = studioPaths(editorRoot);
  await assertStudioActivePaths(paths, { requireActive: true, requireState: true });
  const document = internal.currentDocument;
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
  for (const entry of await fs.readdir(paths.previewActive, { withFileTypes: true })) {
    if (entry.isFile() && /^layer-[a-f0-9]{32}\.webp$/.test(entry.name) && !retained.has(entry.name)) {
      await fs.rm(path.join(paths.previewActive, entry.name), { force: true });
    }
  }
  const layers = document.artworkLayers.map((layer, index) => {
    const preview = previews[index];
    return {
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
  const layout = document.newChatLayout ?? { widthRatio: 0.76, offsetXRatio: 0, offsetYRatio: 0 };
  return {
    active: true,
    id: internal.id,
    sourceId: internal.sourceId,
    source: internal.source,
    isNew: internal.isNew,
    session: internal.session,
    revision: internal.revision,
    dirty: JSON.stringify(internal.currentDocument) !== JSON.stringify(internal.baselineDocument),
    canUndo: internal.undo.length > 0,
    canRedo: internal.redo.length > 0,
    label: document.labels[internal.locale] ?? document.labels.en,
    tokens: {
      light: canonicalStudioTokens(document, "light"),
      dark: canonicalStudioTokens(document, "dark"),
    },
    shared: {
      fontUi: studioFontId(document.theme.typography.ui, STUDIO_FONT_UI_STACKS, "system-sans"),
      fontDisplay: studioFontId(document.theme.typography.display, STUDIO_FONT_DISPLAY_STACKS, "system-sans"),
      radius: document.theme.shape.card,
      blur: document.theme.blur,
      shadow: studioShadowId(document.theme.effects),
      backgroundScope: document.backgroundScope,
      prompt: { width: layout.widthRatio, x: layout.offsetXRatio, y: layout.offsetYRatio },
    },
    layers,
    feedback: cloneJson(internal.feedback ?? emptyStudioFeedback()),
  };
}

function withStudioResult(state, action, succeeded, error = null) {
  return { ...state, lastAction: action, actionSucceeded: succeeded, error };
}

function hslRgb(value) {
  const match = String(value).match(/^(\d{1,3}(?:\.\d+)?)\s+(\d{1,3}(?:\.\d+)?)%\s+(\d{1,3}(?:\.\d+)?)%$/);
  if (!match) return [0, 0, 0];
  const hue = ((Number(match[1]) % 360) + 360) % 360;
  const saturation = Number(match[2]) / 100;
  const lightness = Number(match[3]) / 100;
  const chroma = (1 - Math.abs((2 * lightness) - 1)) * saturation;
  const second = chroma * (1 - Math.abs(((hue / 60) % 2) - 1));
  const offset = lightness - chroma / 2;
  const channels = hue < 60 ? [chroma, second, 0]
    : hue < 120 ? [second, chroma, 0]
      : hue < 180 ? [0, chroma, second]
        : hue < 240 ? [0, second, chroma]
          : hue < 300 ? [second, 0, chroma]
            : [chroma, 0, second];
  return channels.map((channel) => channel + offset);
}

function contrastRatio(left, right) {
  const luminance = (value) => {
    const channels = hslRgb(value).map((channel) => channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
    return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
  };
  const values = [luminance(left), luminance(right)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

function studioContrastFeedback(theme) {
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

async function persistStudioInternal(paths, internal) {
  await assertStudioActivePaths(paths, { requireActive: true });
  await atomicWriteJson(paths.theme, internal.currentDocument);
  await atomicWriteJson(paths.state, internal);
  await assertStudioActivePaths(paths, { requireActive: true, requireState: true });
}

async function loadStudioInternal(editorRoot) {
  const paths = studioPaths(editorRoot);
  const activeExists = await assertStudioActivePaths(paths);
  if (!activeExists) return null;
  try {
    const internal = await readJson(paths.state);
    if (!isPlainObject(internal) || internal.version !== 1 || !STUDIO_SESSION_PATTERN.test(internal.session ?? "")) {
      throw new Error("Editor state is invalid");
    }
    internal.locale = normalizeLocale(internal.locale);
    internal.undo = Array.isArray(internal.undo) ? internal.undo : [];
    internal.redo = Array.isArray(internal.redo) ? internal.redo : [];
    return internal;
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

function assertStudioRevision(internal, request) {
  if (!internal) throw new Error("No theme edit is active");
  if (request.session !== internal.session) throw new Error("The theme edit session is stale");
  if (!Number.isSafeInteger(request.revision) || request.revision !== internal.revision) {
    throw new Error("The theme edit revision is stale");
  }
}

function studioFrameFromLegacy(position = "center") {
  const horizontal = /\bleft\b/.test(position) ? "left" : /\bright\b/.test(position) ? "right" : "";
  const vertical = /\btop\b/.test(position) ? "top" : /\bbottom\b/.test(position) ? "bottom" : "";
  const anchor = vertical && horizontal ? `${vertical}-${horizontal}` : vertical || horizontal || "center";
  return { anchor, focalX: 50, focalY: 50, positionX: 0, positionY: 0, scale: 1 };
}

function studioContextFromLegacy(overrides) {
  if (!overrides) return "all";
  if (overrides.conversation?.hidden && overrides.other?.hidden && !overrides["new-chat"]?.hidden) return "new-chat";
  if (overrides["new-chat"]?.hidden && overrides.other?.hidden && !overrides.conversation?.hidden) return "conversation";
  return "all";
}

function serializeStudioTheme(theme, id) {
  const mode = (name) => ({
    semantic: cloneJson(theme[name].semantic),
    wallpaper: cloneJson(theme[name].wallpaper),
  });
  const uiId = studioFontId(theme.typography.ui, STUDIO_FONT_UI_STACKS,
    /Trebuchet|rounded/i.test(theme.typography.ui) ? "rounded-sans" : "humanist-sans");
  const displayFallback = /serif|Georgia|Mincho|Garamond|Palatino|Antiqua/i.test(theme.typography.display)
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

async function copyWebpIntoEditor(sourcePath, paths) {
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

async function materializeSourceArtwork(sourcePath, paths) {
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
    const { convertStudioImport } = await import("./convert-theme-assets.mjs");
    await convertStudioImport({ source, target: converted, outputRoot: paths.root });
    return await copyWebpIntoEditor(converted, paths);
  } finally {
    await fs.rm(converted, { force: true }).catch(() => {});
  }
}

function appendCopyLabel(labels) {
  return {
    en: `${labels.en} Copy`.slice(0, 80),
    "zh-CN": `${labels["zh-CN"]}副本`.slice(0, 80),
    "zh-TW": `${labels["zh-TW"]}副本`.slice(0, 80),
  };
}

function copyIdBase(sourceId) {
  const suffix = "-copy";
  return `${sourceId.slice(0, 40 - suffix.length).replace(/-+$/u, "")}${suffix}`;
}

async function uniqueStudioThemeId(sourceId, userThemesDir) {
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

async function sourceThemeForStudio(themeId, userThemesDir, locale) {
  if (typeof themeId !== "string" || !THEME_ID_PATTERN.test(themeId)) throw new Error("Theme id is invalid");
  const registry = await readThemeRegistry({ userThemesDir });
  const entry = registry.themes.find((candidate) => candidate.id === themeId);
  if (!entry) throw new Error(`Theme not found: ${themeId}`);
  return { registry, entry, theme: await readRegisteredTheme(entry, locale) };
}

async function studioDocumentFromSource({ sourceId, targetId, userThemesDir, locale, paths, copyLabels }) {
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
    let artworkPath = copiedArtwork.get(sourceKey);
    if (!artworkPath) {
      artworkPath = await materializeSourceArtwork(sourcePath, paths);
      copiedArtwork.set(sourceKey, artworkPath);
    }
    const frame = sourceLayer.frames ? null : studioFrameFromLegacy(sourceLayer.position);
    document.artworkLayers.push({
      id: sourceLayer.id ?? `layer-${studioHex()}`,
      path: artworkPath,
      role: STUDIO_LAYER_ROLES.has(sourceLayer.role) ? sourceLayer.role : "decoration",
      appearance: sourceLayer.appearance ?? "all",
      context: sourceLayer.context ?? studioContextFromLegacy(sourceLayer.contextOverrides),
      viewport: sourceLayer.viewport ?? "all",
      visible: sourceLayer.visible ?? true,
      opacity: sourceLayer.opacity ?? 1,
      mask: sourceLayer.mask ?? "soft-right",
      mobile: sourceLayer.mobile ?? "reduce",
      frames: sourceLayer.frames
        ? cloneJson(sourceLayer.frames)
        : { normal: cloneJson(frame), wide: cloneJson(frame) },
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

async function compileStudioDocument(document, context, { appearance = "system" } = {}) {
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
  const bundle = await buildPayloadFromCompiled(compiled);
  new Function(bundle.payload);
  return bundle;
}

async function studioFeedback(document, context, bundle) {
  const contrast = studioContrastFeedback(bundle.theme);
  const uniqueUrls = new Set((bundle.settings.artLayers ?? []).map((layer) => layer.dataUrl));
  if (bundle.settings.artDataUrl) uniqueUrls.add(bundle.settings.artDataUrl);
  const embeddedArtworkBytes = [...uniqueUrls].reduce((total, value) => total + Buffer.byteLength(value, "utf8"), 0);
  const payloadBytes = Buffer.byteLength(bundle.payload, "utf8");
  const chromeBytes = Math.max(0, payloadBytes - embeddedArtworkBytes);
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

async function evaluateStudioDocument(document, context) {
  try {
    validateStudioThemeKitDocument(document, "editor theme");
    const bundle = await compileStudioDocument(document, context, { appearance: "system" });
    const feedback = await studioFeedback(document, context, bundle);
    return { bundle, feedback, error: feedback.valid ? null : "contrast-or-budget" };
  } catch (error) {
    return {
      bundle: null,
      feedback: {
        ...emptyStudioFeedback(),
        valid: false,
        errors: [{ code: "invalid-theme", field: "theme" }],
      },
      error: "invalid-theme",
    };
  }
}

async function replaceActiveStudio(paths, build) {
  await fs.mkdir(paths.root, { recursive: true });
  await assertStudioActivePaths(paths);
  const backup = path.join(paths.root, `.active-backup-${studioHex()}`);
  const hadActive = Boolean(await pathKind(paths.active));
  if (hadActive) await fs.rename(paths.active, backup);
  try {
    await fs.mkdir(paths.artwork, { recursive: true });
    const result = await build();
    if (hadActive) await fs.rm(backup, { recursive: true, force: true });
    return result;
  } catch (error) {
    await fs.rm(paths.active, { recursive: true, force: true }).catch(() => {});
    if (hadActive) await fs.rename(backup, paths.active).catch(() => {});
    throw error;
  }
}

async function beginStudioDocument(document, metadata, context) {
  const paths = studioPaths(context.editorRoot);
  const internal = {
    version: 1,
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
    undo: [],
    redo: [],
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
    existing.undo = [];
    existing.redo = [];
    existing.revision += 1;
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
    const bundle = await compileStudioDocument(existing.lastValidDocument, { ...context, locale }, { appearance: "system" });
    await atomicWriteJson(studioPaths(context.editorRoot).theme, existing.currentDocument);
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

async function mutateStudio(context, action, mutate) {
  const internal = await loadStudioInternal(context.editorRoot);
  assertStudioRevision(internal, context);
  const before = cloneJson(internal.currentDocument);
  const candidate = cloneJson(internal.currentDocument);
  await mutate(candidate, internal);
  internal.undo = [...internal.undo, before].slice(-STUDIO_MAX_HISTORY);
  internal.redo = [];
  internal.currentDocument = candidate;
  internal.revision += 1;
  const evaluated = await evaluateStudioDocument(candidate, context);
  internal.feedback = evaluated.feedback;
  if (evaluated.feedback.valid) internal.lastValidDocument = cloneJson(candidate);
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

function updateStudioPreview(document, token, hex) {
  const key = {
    canvas: "background",
    sidebar: "chrome",
    surface: "surface",
    text: "text",
    accent: "accent",
  }[token];
  if (key) document.preview[key] = hex.toUpperCase();
}

export async function setThemeToken(context) {
  const mode = context.mode;
  const token = context.token;
  if (!["light", "dark", "shared", "mode-copy"].includes(mode)) throw new Error("Theme token mode is invalid");
  return mutateStudio(context, "set-theme-token", (document) => {
    if (mode === "mode-copy") {
      if (token !== "tokens" || !["light", "dark"].includes(context.value)) throw new Error("Mode copy is invalid");
      const source = context.value;
      const target = source === "light" ? "dark" : "light";
      document.theme[target].semantic = cloneJson(document.theme[source].semantic);
      document.theme[target].wallpaper.surfaceAlpha = document.theme[source].wallpaper.surfaceAlpha;
      document.theme[target].wallpaper.sidebarAlpha = document.theme[source].wallpaper.sidebarAlpha;
      return;
    }
    if (mode === "light" || mode === "dark") {
      if (Object.hasOwn(STUDIO_COLOR_TOKENS, token)) {
        document.theme[mode].semantic[STUDIO_COLOR_TOKENS[token]] = hexToHsl(context.value, `${mode}.${token}`);
        updateStudioPreview(document, token, context.value);
        return;
      }
      if (token === "surfaceAlpha") {
        document.theme[mode].wallpaper.surfaceAlpha = strictNumber(context.value, `${mode}.${token}`, 0.35, 1);
        return;
      }
      if (token === "sidebarAlpha") {
        document.theme[mode].wallpaper.sidebarAlpha = strictNumber(context.value, `${mode}.${token}`, 0.62, 1);
        return;
      }
      throw new Error("Theme token is invalid");
    }
    if (!STUDIO_SHARED_TOKENS.has(token)) throw new Error("Shared theme token is invalid");
    if (token === "fontUi") {
      document.theme.typography.ui = STUDIO_FONT_UI_STACKS[strictEnum(context.value, new Set(Object.keys(STUDIO_FONT_UI_STACKS)), "fontUi")];
      document.theme.typography.body = document.theme.typography.ui;
    } else if (token === "fontDisplay") {
      document.theme.typography.display = STUDIO_FONT_DISPLAY_STACKS[strictEnum(context.value, new Set(Object.keys(STUDIO_FONT_DISPLAY_STACKS)), "fontDisplay")];
    } else if (token === "radius") {
      const radius = strictNumber(context.value, "radius", 0, 32);
      document.theme.radius = radius;
      document.theme.shape = studioRadiusPolicy(radius, document.theme.shape.borderWidth);
    } else if (token === "blur") {
      document.theme.blur = strictNumber(context.value, "blur", 0, 40);
    } else if (token === "shadow") {
      const id = strictEnum(context.value, new Set(Object.keys(STUDIO_SHADOWS)), "shadow");
      Object.assign(document.theme.effects, STUDIO_SHADOWS[id]);
    } else if (token === "backgroundScope") {
      document.backgroundScope = strictEnum(context.value, new Set(["content", "full-window"]), "backgroundScope");
    } else {
      const layout = document.newChatLayout ?? { widthRatio: 0.76, offsetXRatio: 0, offsetYRatio: 0 };
      if (token === "promptWidth") layout.widthRatio = strictNumber(context.value, token, 0.4, 0.96);
      else if (token === "promptX") layout.offsetXRatio = strictNumber(context.value, token, -0.35, 0.35);
      else if (token === "promptY") layout.offsetYRatio = strictNumber(context.value, token, -0.3, 0.3);
      document.newChatLayout = layout;
    }
    if (document.sourceRecipe !== null && STUDIO_RECIPE_CONTROL_OVERRIDES.has(token)
        && !document.controlOverrides.includes(token)) {
      document.controlOverrides.push(token);
    }
  });
}

export async function setThemeLayer(context) {
  return mutateStudio(context, "set-theme-layer", (document) => {
    const index = strictInteger(context.index, "layer index", 0, document.artworkLayers.length - 1);
    const layer = document.artworkLayers[index];
    if (context.preset === "shared") {
      const property = context.property;
      if (!["role", "appearance", "context", "viewport", "visible", "opacity", "mask", "mobile"].includes(property)) {
        throw new Error("Shared layer property is invalid");
      }
      if (property === "role") layer.role = strictEnum(context.value, STUDIO_LAYER_ROLES, "layer role");
      else if (property === "appearance") layer.appearance = strictEnum(context.value, STUDIO_LAYER_APPEARANCES, "layer appearance");
      else if (property === "context") {
        layer.context = strictEnum(context.value, STUDIO_LAYER_CONTEXTS, "layer context");
        if (layer.legacy) layer.legacy.contextOverrides = null;
      }
      else if (property === "viewport") layer.viewport = strictEnum(context.value, STUDIO_LAYER_VIEWPORTS, "layer viewport");
      else if (property === "visible") {
        if (typeof context.value !== "boolean") throw new Error("Layer visibility must be true or false");
        layer.visible = context.value;
      } else if (property === "opacity") layer.opacity = strictNumber(context.value, "layer opacity", 0, 1);
      else if (property === "mask") layer.mask = strictEnum(context.value, STUDIO_LAYER_MASKS, "layer mask");
      else layer.mobile = strictEnum(context.value, STUDIO_LAYER_MOBILE, "layer mobile behavior");
      return;
    }
    if (!["normal", "wide"].includes(context.preset)) throw new Error("Layer framing preset is invalid");
    const frame = layer.frames[context.preset];
    if (context.property === "anchor") frame.anchor = strictEnum(context.value, STUDIO_LAYER_ANCHORS, "layer anchor");
    else if (["focalX", "focalY"].includes(context.property)) frame[context.property] = strictNumber(context.value, context.property, 0, 100);
    else if (["positionX", "positionY"].includes(context.property)) frame[context.property] = strictNumber(context.value, context.property, -100, 100);
    else if (context.property === "scale") frame.scale = strictNumber(context.value, "scale", 0.25, 3);
    else throw new Error("Layer framing property is invalid");
    delete layer.legacy;
  });
}

async function validateStudioHostAsset(assetPath, editorRoot) {
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
        appearance: "all",
        context: "all",
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

async function travelStudioHistory(context, action, direction) {
  const internal = await loadStudioInternal(context.editorRoot);
  assertStudioRevision(internal, context);
  const source = direction === "undo" ? internal.undo : internal.redo;
  if (!source.length) throw new Error(`There is nothing to ${direction}`);
  const destination = direction === "undo" ? internal.redo : internal.undo;
  destination.push(cloneJson(internal.currentDocument));
  if (destination.length > STUDIO_MAX_HISTORY) destination.splice(0, destination.length - STUDIO_MAX_HISTORY);
  internal.currentDocument = source.pop();
  internal.revision += 1;
  const evaluated = await evaluateStudioDocument(internal.currentDocument, context);
  internal.feedback = evaluated.feedback;
  if (evaluated.feedback.valid) internal.lastValidDocument = cloneJson(internal.currentDocument);
  await persistStudioInternal(studioPaths(context.editorRoot), internal);
  return {
    state: withStudioResult(
      await canonicalStudioState(internal, context.editorRoot),
      action,
      evaluated.feedback.valid,
      evaluated.error,
    ),
    payload: evaluated.feedback.valid ? evaluated.bundle.payload : null,
    themesChanged: false,
    configChanged: false,
    apply: evaluated.feedback.valid ? "draft" : "none",
  };
}

export async function undoThemeEdit(context) {
  return travelStudioHistory(context, "undo-theme-edit", "undo");
}

export async function redoThemeEdit(context) {
  return travelStudioHistory(context, "redo-theme-edit", "redo");
}

async function callStudioFault(context, stage) {
  if (typeof context.faultInjector === "function") await context.faultInjector(stage);
}

async function stageStudioTheme(document, activeDirectory, stageDirectory) {
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

async function validateStudioStage(document, stageDirectory, context) {
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
    const uniqueUrls = new Set((bundle.settings.artLayers ?? []).map((layer) => layer.dataUrl));
    const artBytes = [...uniqueUrls].reduce((total, value) => total + Buffer.byteLength(value, "utf8"), 0);
    const chromeBytes = Buffer.byteLength(bundle.payload, "utf8") - artBytes;
    if (artBytes >= MAX_USER_ARTWORK_TOTAL_BYTES || chromeBytes >= MAX_CHROME_PAYLOAD_BYTES) {
      throw new Error(`${appearance} payload exceeds the theme byte budget`);
    }
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
  try {
    await stageStudioTheme(internal.currentDocument, paths.active, stageDirectory);
    await validateStudioStage(internal.currentDocument, stageDirectory, context);
    await callStudioFault(context, "after-stage");
    const destinationStat = await pathKind(destination);
    if (destinationStat) {
      if (!destinationStat.isDirectory() || destinationStat.isSymbolicLink()) throw new Error("Installed theme destination is not a regular folder");
      const realDestination = await fs.realpath(destination);
      if (!isPathWithin(userRoot, realDestination) || path.dirname(realDestination) !== userRoot) {
        throw new Error("Installed theme destination escaped the user themes folder");
      }
      await fs.rename(destination, backup);
      movedExisting = true;
    }
    await callStudioFault(context, "after-backup");
    await fs.rename(stageDirectory, destination);
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
    savedInternal.undo = [];
    savedInternal.redo = [];
    savedInternal.feedback = evaluated.feedback;
    savedInternal.revision += 1;
    const savedState = withStudioResult(
      await canonicalStudioState(savedInternal, context.editorRoot),
      "save-theme-edit",
      true,
      null,
    );
    editorStateAttempted = true;
    await persistStudioInternal(paths, savedInternal);
    if (movedExisting) await fs.rm(backup, { recursive: true, force: true }).catch(() => {});
    return {
      state: savedState,
      payload: saved.payload,
      themesChanged: true,
      configChanged: JSON.stringify(previousConfig) !== JSON.stringify(nextConfig),
      apply: "saved",
    };
  } catch (error) {
    if (editorStateAttempted) await atomicWriteText(paths.state, previousEditorStateRaw).catch(() => {});
    if (configWritten) {
      if (previousConfigRaw === null) await fs.rm(context.configPath, { force: true }).catch(() => {});
      else await atomicWriteText(context.configPath, previousConfigRaw).catch(() => {});
    }
    if (installed) {
      const failed = path.join(userRoot, `.failed-${internal.id}-${studioHex()}`);
      await fs.rename(destination, failed).catch(() => {});
      await fs.rm(failed, { recursive: true, force: true }).catch(() => {});
    }
    if (movedExisting) await fs.rename(backup, destination).catch(() => {});
    await fs.rm(stageDirectory, { recursive: true, force: true }).catch(() => {});
    throw error;
  }
}

async function clearStudioActive(editorRoot) {
  const paths = studioPaths(editorRoot);
  if (!(await pathKind(paths.active))) return;
  const discarded = path.join(paths.root, `.discarded-${studioHex()}`);
  await fs.rename(paths.active, discarded);
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
  await fs.rename(destination, tombstone);
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
    bundle = await compileStudioDocument(internal.lastValidDocument, context, { appearance: "system" });
  } finally {
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

function assertStudioRequest(request, keys) {
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
  };
  if (assetPath !== null && request.type !== "pick-theme-layer-image") {
    throw new Error("An asset is allowed only for pick-theme-layer-image");
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
  } else if (request.type === "pick-theme-layer-image") {
    assertStudioRequest(request, ["session", "revision", "index", "role"]);
    if (typeof assetPath !== "string" || !assetPath.trim()) throw new Error("--asset is required for pick-theme-layer-image");
    result = await attachThemeLayerImage({ ...context, ...request, assetPath });
  } else if (request.type === "remove-theme-layer") {
    assertStudioRequest(request, ["session", "revision", "index"]);
    if (assetPath !== null) throw new Error("An asset is allowed only for pick-theme-layer-image");
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
