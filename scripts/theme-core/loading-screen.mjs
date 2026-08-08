import { upgradeStudioDocumentToResponsive } from "./responsive-layouts.mjs";

export const LOADING_SCREEN_CUE_IDS = Object.freeze([
  "orbit", "editorial-rule", "facet", "ink-frame",
  "horizon", "folio", "ribbon", "capsule",
]);
export const LOADING_SCREEN_INHERIT = Object.freeze({ mode: "inherit" });
export const LOADING_SCREEN_MARK_ASSET_PATTERN = /^loading\/mark-([a-f0-9]{64})\.png$/u;
export const LOADING_SCREEN_ARTWORK_ASSET_PATTERN = /^loading\/artwork-([a-f0-9]{64})\.webp$/u;

const HEX = /^#[0-9A-Fa-f]{6}$/u;
const layouts = new Set(["centered", "split"]);
const motifs = new Set(["inherit", "none", ...LOADING_SCREEN_CUE_IDS]);
const markSources = new Set(["theme", "custom", "none"]);
const progressStyles = new Set(["bar", "pulse"]);
const progressMotions = new Set(["calm", "still"]);
const artworkFits = new Set(["cover", "contain"]);

function plain(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}

function exact(value, keys, label) {
  if (!plain(value)) throw new Error(`${label} must be an object`);
  const expected = new Set(keys);
  if (Object.keys(value).some((key) => !expected.has(key)) || keys.some((key) => !Object.hasOwn(value, key))) {
    throw new Error(`${label} has an unsupported property or is missing a required property`);
  }
}

function enumeration(value, allowed, label) {
  if (typeof value !== "string" || !allowed.has(value)) {
    throw new Error(`${label} must use an approved value`);
  }
  return value;
}

function finite(value, minimum, maximum, label) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${label} must be a finite number`);
  }
  if (value < minimum || value > maximum) throw new Error(`${label} must be between ${minimum} and ${maximum}`);
  return value;
}

function integer(value, minimum, maximum, label) {
  finite(value, minimum, maximum, label);
  if (!Number.isInteger(value)) throw new Error(`${label} must be an integer`);
  return value;
}

function colour(value, label) {
  if (typeof value !== "string" || !HEX.test(value)) {
    throw new Error(`${label} must be one opaque six-digit hex colour`);
  }
  return value.toUpperCase();
}

function luminance(hex) {
  const channels = [1, 3, 5].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255)
    .map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
  return (0.2126 * channels[0]) + (0.7152 * channels[1]) + (0.0722 * channels[2]);
}

function ratio(left, right) {
  const values = [luminance(left), luminance(right)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

function validateArtwork(value, label) {
  if (value === null) return null;
  exact(value, ["asset", "opacity", "fit", "focalX", "focalY"], label);
  if (typeof value.asset !== "string" || !LOADING_SCREEN_ARTWORK_ASSET_PATTERN.test(value.asset)) {
    throw new Error(`${label}.asset must be a content-addressed WebP path`);
  }
  return {
    asset: value.asset,
    opacity: finite(value.opacity, 0, 0.65, `${label}.opacity`),
    fit: enumeration(value.fit, artworkFits, `${label}.fit`),
    focalX: integer(value.focalX, 0, 100, `${label}.focalX`),
    focalY: integer(value.focalY, 0, 100, `${label}.focalY`),
  };
}

function validateAppearance(value, label) {
  exact(value, ["background", "surface", "text", "accent", "accentText", "border", "artwork"], label);
  const result = {
    background: colour(value.background, `${label}.background`),
    surface: colour(value.surface, `${label}.surface`),
    text: colour(value.text, `${label}.text`),
    accent: colour(value.accent, `${label}.accent`),
    accentText: colour(value.accentText, `${label}.accentText`),
    border: colour(value.border, `${label}.border`),
    artwork: validateArtwork(value.artwork, `${label}.artwork`),
  };
  if (ratio(result.text, result.surface) < 4.5) {
    throw new Error(`${label}.text must reach 4.5:1 contrast against surface`);
  }
  if (ratio(result.accentText, result.accent) < 4.5) {
    throw new Error(`${label}.accentText must reach 4.5:1 contrast against accent`);
  }
  if (ratio(result.border, result.surface) < 3) {
    throw new Error(`${label}.border must reach 3:1 contrast against surface`);
  }
  return result;
}

export function validateLoadingScreen(value, label = "loadingScreen") {
  if (!plain(value) || typeof value.mode !== "string") throw new Error(`${label} must be a discriminated object`);
  if (value.mode === "inherit") {
    exact(value, ["mode"], label);
    return { mode: "inherit" };
  }
  if (value.mode !== "custom") throw new Error(`${label}.mode must be inherit or custom`);
  exact(value, ["mode", "layout", "motif", "mark", "progress", "light", "dark"], label);
  exact(value.mark, ["source", "asset", "size"], `${label}.mark`);
  const source = enumeration(value.mark.source, markSources, `${label}.mark.source`);
  if (source === "custom") {
    if (typeof value.mark.asset !== "string" || !LOADING_SCREEN_MARK_ASSET_PATTERN.test(value.mark.asset)) {
      throw new Error(`${label}.mark.asset must be a content-addressed PNG path`);
    }
  } else if (value.mark.asset !== null) {
    throw new Error(`${label}.mark.asset must be null unless source is custom`);
  }
  exact(value.progress, ["style", "motion"], `${label}.progress`);
  const result = {
    mode: "custom",
    layout: enumeration(value.layout, layouts, `${label}.layout`),
    motif: enumeration(value.motif, motifs, `${label}.motif`),
    mark: {
      source,
      asset: value.mark.asset,
      size: integer(value.mark.size, 48, 112, `${label}.mark.size`),
    },
    progress: {
      style: enumeration(value.progress.style, progressStyles, `${label}.progress.style`),
      motion: enumeration(value.progress.motion, progressMotions, `${label}.progress.motion`),
    },
    light: validateAppearance(value.light, `${label}.light`),
    dark: validateAppearance(value.dark, `${label}.dark`),
  };
  const artworkAssets = new Set([result.light.artwork?.asset, result.dark.artwork?.asset].filter(Boolean));
  if (artworkAssets.size > 2) throw new Error(`${label} may reference at most two loading artwork files`);
  return result;
}

export function loadingScreenAssetPaths(value) {
  const screen = validateLoadingScreen(value);
  if (screen.mode === "inherit") return [];
  return [...new Set([
    screen.mark.source === "custom" ? screen.mark.asset : null,
    screen.light.artwork?.asset,
    screen.dark.artwork?.asset,
  ].filter(Boolean))];
}

export function upgradeStudioDocumentToLoadingScreen(document, loadingScreen) {
  if (!plain(document) || !Number.isInteger(document.schemaVersion)
      || document.schemaVersion < 1 || document.schemaVersion > 6) {
    throw new Error("Studio document schemaVersion is invalid");
  }
  const base = document.schemaVersion < 5
    ? upgradeStudioDocumentToResponsive(document)
    : structuredClone(document);
  base.schemaVersion = 6;
  base.loadingScreen = validateLoadingScreen(loadingScreen);
  return base;
}
