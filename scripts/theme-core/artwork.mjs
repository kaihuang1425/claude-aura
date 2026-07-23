// Extracted from theme-core.mjs. Public API is re-exported by scripts/theme-core.mjs.
import fs from "node:fs/promises";
import path from "node:path";
import {
  ARTWORK_TYPES,
  BUILTIN_BRAND_WORDMARK_ASSETS,
  MAX_ARTWORK_BYTES,
  PROJECT_ROOT,
} from "./constants.mjs";
import {
  isPathWithin,
  isUnavailableFileError,
} from "./validation.mjs";

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

export async function resolveBrandWordmark(theme) {
  const registered = BUILTIN_BRAND_WORDMARK_ASSETS[theme.name];
  if (!registered || theme.source !== "builtin") return null;
  const resolve = (appearance) => resolveArtwork({
    artwork: { path: registered[appearance] },
    artworkRoot: PROJECT_ROOT,
    artworkAllowedRoot: path.join(PROJECT_ROOT, "assets", "theme-art", theme.name),
  });
  const [light, dark] = await Promise.all([resolve("light"), resolve("dark")]);
  if (!light || !dark) return null;
  return {
    lightDataUrl: light.dataUrl,
    darkDataUrl: dark.dataUrl,
    minWidth: registered.minWidth,
    width: registered.width,
    light,
    dark,
  };
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
