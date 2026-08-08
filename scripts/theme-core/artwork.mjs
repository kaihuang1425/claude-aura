// Extracted from theme-core.mjs. Public API is re-exported by scripts/theme-core.mjs.
import fs from "node:fs/promises";
import path from "node:path";
import {
  ARTWORK_TYPES,
  BUILTIN_BRAND_WORDMARK_ASSETS,
  MAX_ARTWORK_BYTES,
  PROJECT_ROOT,
  STUDIO_FONT_DISPLAY_STACKS,
} from "./constants.mjs";
import {
  isPathWithin,
  isUnavailableFileError,
} from "./validation.mjs";
import {
  interfaceIdentityDigest,
  resolveInterfaceSurface,
} from "./surface-overrides.mjs";

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
  const identity = theme.interfaceSurfaces?.sidebarIdentity ?? null;
  const inheritedId = theme.source === "builtin" ? theme.name : theme.sourceRecipe;
  const registered = BUILTIN_BRAND_WORDMARK_ASSETS[inheritedId];
  const resolveBuiltin = (appearance) => resolveArtwork({
    artwork: { path: registered?.[appearance] },
    artworkRoot: PROJECT_ROOT,
    artworkAllowedRoot: path.join(PROJECT_ROOT, "assets", "theme-art", inheritedId ?? "default"),
  });
  let local = null;
  if (interfaceIdentityDigest(theme.interfaceSurfaces)) {
    local = await resolveArtwork({
      artwork: { path: "sidebar-identity.png" },
      artworkRoot: theme.artworkRoot,
      artworkAllowedRoot: theme.artworkAllowedRoot,
    });
  }
  const xml = (value) => String(value).replaceAll("&", "&amp;").replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;").replaceAll(">", "&gt;");
  const styledLabel = (resolved, appearance) => {
    const fontSize = resolved.fontSize ?? 22;
    const width = Math.round(Math.max(104, Math.min(184, fontSize * 5.2)));
    const height = Math.round(Math.max(36, Math.min(64, fontSize * 2.1)));
    const fallback = theme[appearance]?.semantic?.["--aura-sidebar-text-primary"] ?? "0 0% 12%";
    const color = resolved.color ?? `hsl(${fallback})`;
    const font = STUDIO_FONT_DISPLAY_STACKS[resolved.font ?? "system-sans"];
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><text x="0" y="50%" dominant-baseline="middle" fill="${xml(color)}" font-family="${xml(font)}" font-size="${fontSize}" font-weight="${resolved.weight ?? 600}" letter-spacing="${resolved.letterSpacing ?? 0}em">Claude</text></svg>`;
    return {
      dataUrl: `data:image/svg+xml;base64,${Buffer.from(svg, "utf8").toString("base64")}`,
      width,
      minWidth: Math.min(96, width),
    };
  };
  const resolved = {};
  for (const appearance of ["light", "dark"]) {
    const leaf = resolveInterfaceSurface(identity, { appearance });
    const mode = leaf.mode ?? (registered ? "inherited-builtin" : "native");
    if (mode === "native") resolved[appearance] = { dataUrl: null, mode, leaf };
    else if (mode === "local-mark") resolved[appearance] = {
      dataUrl: local?.dataUrl ?? null,
      mode,
      leaf,
      width: leaf.markSize ?? 44,
      minWidth: Math.min(36, leaf.markSize ?? 44),
    };
    else if (mode === "styled-label") resolved[appearance] = { ...styledLabel(leaf, appearance), mode, leaf };
    else {
      const artwork = registered ? await resolveBuiltin(appearance) : null;
      resolved[appearance] = {
        dataUrl: artwork?.dataUrl ?? null,
        artwork,
        mode,
        leaf,
        width: registered?.width ?? 160,
        minWidth: registered?.minWidth ?? 136,
      };
    }
  }
  if (!resolved.light.dataUrl && !resolved.dark.dataUrl) return null;
  const kindFor = (entry) => entry.mode === "local-mark" ? "local" : "wordmark";
  return {
    lightDataUrl: resolved.light.dataUrl,
    darkDataUrl: resolved.dark.dataUrl,
    minWidth: Math.max(resolved.light.minWidth ?? 0, resolved.dark.minWidth ?? 0),
    width: Math.max(resolved.light.width ?? 0, resolved.dark.width ?? 0),
    kind: resolved.light.mode === "local-mark" || resolved.dark.mode === "local-mark" ? "local" : "wordmark",
    lightMinWidth: resolved.light.minWidth ?? 0,
    lightWidth: resolved.light.width ?? 0,
    darkMinWidth: resolved.dark.minWidth ?? 0,
    darkWidth: resolved.dark.width ?? 0,
    lightKind: kindFor(resolved.light),
    darkKind: kindFor(resolved.dark),
    lightTreatment: resolved.light.leaf.markTreatment ?? "original",
    darkTreatment: resolved.dark.leaf.markTreatment ?? "original",
    light: resolved.light.artwork ?? null,
    dark: resolved.dark.artwork ?? null,
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
