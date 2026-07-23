import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import {
  BUILTIN_BRAND_MARK_ASSETS,
  BUILTIN_BRAND_WORDMARK_ASSETS,
  buildPayload,
  DEFAULT_CONFIG,
  listThemes,
  PROJECT_ROOT,
  readThemeRegistry,
} from "./theme-core.mjs";

const ARTWORK_ROOT = path.resolve(PROJECT_ROOT, "assets", "theme-art");
const STUDIO_PREVIEW_ROOT = path.resolve(PROJECT_ROOT, "assets", "studio-previews", "masters");
const MIME_TYPES = new Map([
  [".avif", "image/avif"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".webp", "image/webp"],
]);
const MODES = ["light", "dark"];
const CHROME_PAYLOAD_LIMIT = 65_000;
const EMBEDDED_ARTWORK_LIMIT = 1_400_000;
const RASTER_LAYER_LIMIT = 400_000;
const STUDIO_PREVIEW_LIMIT = 3_000_000;
const BRAND_MARK_LIMIT = 100_000;
const LAUNCHER_ASSET_PATTERN = /^assets\/theme-art\/[a-z][a-z0-9-]{1,39}\/launcher-mark\.png$/;
const BRAND_MARK_ASSET_PATTERN = /^assets\/theme-art\/([a-z][a-z0-9-]{1,39})\/brand-mark\.svg$/;
const BRAND_WORDMARK_ASSET_PATTERN = /^assets\/theme-art\/([a-z][a-z0-9-]{1,39})\/brand-wordmark-(light|dark)\.png$/;
const KOREAN_IDOL_APPROVED_WORDMARK_SHA256 = "f318ad08013dd500351997d4dfb57706c338ff4d58ce3448d050b4ccccb607ba";
const LAUNCHER_ICON_SIZES = Object.freeze([16, 20, 24, 32, 40, 48, 64, 128, 256]);
const STUDIO_PREVIEW_PATTERN = /^assets\/studio-previews\/masters\/([a-z][a-z0-9-]{1,39})\.png$/;

function slash(value) {
  return value.replaceAll(path.sep, "/");
}

function isWithin(root, candidate) {
  return candidate === root || candidate.startsWith(`${root}${path.sep}`);
}

function uint24le(bytes, offset) {
  return bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16);
}

function parsePng(bytes, label) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (bytes.length < 33 || !bytes.subarray(0, 8).equals(signature) || bytes.toString("ascii", 12, 16) !== "IHDR") {
    throw new Error(`Invalid PNG artwork: ${label}`);
  }
  const colorType = bytes[25];
  let hasTransparencyChunk = false;
  for (let offset = 8; offset + 12 <= bytes.length;) {
    const length = bytes.readUInt32BE(offset);
    const end = offset + 12 + length;
    if (end > bytes.length) throw new Error(`Truncated PNG artwork: ${label}`);
    if (bytes.toString("ascii", offset + 4, offset + 8) === "tRNS") hasTransparencyChunk = true;
    offset = end;
  }
  return {
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
    alpha: [4, 6].includes(colorType) || hasTransparencyChunk,
  };
}

function parseIco(bytes, label) {
  if (bytes.length < 6 || bytes.readUInt16LE(0) !== 0 || bytes.readUInt16LE(2) !== 1) {
    throw new Error(`Invalid Windows icon: ${label}`);
  }
  const count = bytes.readUInt16LE(4);
  if (count !== LAUNCHER_ICON_SIZES.length || bytes.length < 6 + count * 16) {
    throw new Error(`Windows icon has an incomplete frame set: ${label}`);
  }
  const sizes = [];
  let expectedOffset = 6 + count * 16;
  for (let index = 0; index < count; index += 1) {
    const entry = 6 + index * 16;
    const width = bytes[entry] || 256;
    const height = bytes[entry + 1] || 256;
    const frameBytes = bytes.readUInt32LE(entry + 8);
    const frameOffset = bytes.readUInt32LE(entry + 12);
    if (width !== height || bytes[entry + 2] !== 0 || bytes[entry + 3] !== 0
        || bytes.readUInt16LE(entry + 4) !== 1 || bytes.readUInt16LE(entry + 6) !== 32
        || frameBytes === 0 || frameOffset !== expectedOffset || frameOffset + frameBytes > bytes.length) {
      throw new Error(`Windows icon contains an invalid frame: ${label}`);
    }
    const frame = bytes.subarray(frameOffset, frameOffset + frameBytes);
    if (width === 256) {
      const image = parsePng(frame, `${label}#256`);
      if (image.width !== 256 || image.height !== 256 || image.alpha !== true) {
        throw new Error(`Windows icon contains an invalid 256px PNG frame: ${label}`);
      }
    } else {
      const maskStride = Math.ceil(width / 32) * 4;
      const expectedFrameBytes = 40 + width * height * 4 + maskStride * height;
      if (frameBytes !== expectedFrameBytes || frame.readUInt32LE(0) !== 40
          || frame.readInt32LE(4) !== width || frame.readInt32LE(8) !== height * 2
          || frame.readUInt16LE(12) !== 1 || frame.readUInt16LE(14) !== 32
          || frame.readUInt32LE(16) !== 0) {
        throw new Error(`Windows icon contains an invalid ${width}px DIB frame: ${label}`);
      }
    }
    sizes.push(width);
    expectedOffset += frameBytes;
  }
  if (sizes.some((size, index) => size !== LAUNCHER_ICON_SIZES[index])) {
    throw new Error(`Windows icon frame sizes are invalid: ${label}`);
  }
  if (expectedOffset !== bytes.length) throw new Error(`Windows icon contains unindexed data: ${label}`);
  return { sizes };
}

function parseWebp(bytes, label) {
  if (bytes.length < 20 || bytes.toString("ascii", 0, 4) !== "RIFF" || bytes.toString("ascii", 8, 12) !== "WEBP") {
    throw new Error(`Invalid WebP artwork: ${label}`);
  }
  const declaredLength = bytes.readUInt32LE(4) + 8;
  if (declaredLength > bytes.length) throw new Error(`Truncated WebP artwork: ${label}`);
  let dimensions = null;
  let alpha = false;
  for (let offset = 12; offset + 8 <= declaredLength;) {
    const type = bytes.toString("ascii", offset, offset + 4);
    const length = bytes.readUInt32LE(offset + 4);
    const data = offset + 8;
    const end = data + length;
    if (end > declaredLength) throw new Error(`Truncated WebP chunk in ${label}`);
    if (type === "VP8X" && length >= 10) {
      alpha = (bytes[data] & 0x10) !== 0;
      dimensions = {
        width: uint24le(bytes, data + 4) + 1,
        height: uint24le(bytes, data + 7) + 1,
      };
    } else if (type === "VP8 " && length >= 10 && !dimensions) {
      if (bytes[data + 3] !== 0x9d || bytes[data + 4] !== 0x01 || bytes[data + 5] !== 0x2a) {
        throw new Error(`Invalid lossy WebP frame in ${label}`);
      }
      dimensions = {
        width: bytes.readUInt16LE(data + 6) & 0x3fff,
        height: bytes.readUInt16LE(data + 8) & 0x3fff,
      };
    } else if (type === "VP8L" && length >= 5 && !dimensions) {
      if (bytes[data] !== 0x2f) throw new Error(`Invalid lossless WebP frame in ${label}`);
      const packed = bytes.readUInt32LE(data + 1);
      dimensions = {
        width: (packed & 0x3fff) + 1,
        height: ((packed >>> 14) & 0x3fff) + 1,
      };
      alpha = true;
    } else if (type === "ALPH") {
      alpha = true;
    }
    offset = end + (length % 2);
  }
  if (!dimensions?.width || !dimensions?.height) throw new Error(`WebP dimensions are missing: ${label}`);
  return { ...dimensions, alpha };
}

function parseSvg(bytes, label) {
  const source = bytes.toString("utf8");
  if (!/<svg\b/i.test(source)) throw new Error(`Invalid SVG artwork: ${label}`);
  const viewBox = source.match(/\bviewBox=["']\s*[-\d.]+\s+[-\d.]+\s+([\d.]+)\s+([\d.]+)\s*["']/i);
  const width = source.match(/<svg\b[^>]*\bwidth=["']([\d.]+)(?:px)?["']/i);
  const height = source.match(/<svg\b[^>]*\bheight=["']([\d.]+)(?:px)?["']/i);
  const parsedWidth = Number(viewBox?.[1] ?? width?.[1]);
  const parsedHeight = Number(viewBox?.[2] ?? height?.[1]);
  if (!Number.isFinite(parsedWidth) || !Number.isFinite(parsedHeight) || parsedWidth <= 0 || parsedHeight <= 0) {
    throw new Error(`SVG dimensions are missing: ${label}`);
  }
  return { width: parsedWidth, height: parsedHeight, alpha: true };
}

function parseAvif(bytes, label) {
  if (bytes.length < 24 || bytes.toString("ascii", 4, 8) !== "ftyp") {
    throw new Error(`Invalid AVIF artwork: ${label}`);
  }
  const ispe = bytes.indexOf(Buffer.from("ispe"));
  if (ispe < 0 || ispe + 16 > bytes.length) throw new Error(`AVIF dimensions are missing: ${label}`);
  const width = bytes.readUInt32BE(ispe + 8);
  const height = bytes.readUInt32BE(ispe + 12);
  if (!width || !height) throw new Error(`Invalid AVIF dimensions: ${label}`);
  return { width, height, alpha: null };
}

function inspectArtwork(bytes, format, label) {
  if (format === "png") return parsePng(bytes, label);
  if (format === "webp") return parseWebp(bytes, label);
  if (format === "svg") return parseSvg(bytes, label);
  if (format === "avif") return parseAvif(bytes, label);
  throw new Error(`Unsupported artwork format: ${format}`);
}

async function resolveAssets(entry) {
  const layered = Array.isArray(entry.artworkLayers) && entry.artworkLayers.length > 0;
  const registered = layered ? entry.artworkLayers : (entry.artwork ? [entry.artwork] : []);
  const realRoot = await fs.realpath(ARTWORK_ROOT);
  const assets = [];
  for (let index = 0; index < registered.length; index += 1) {
    const registry = registered[index];
    const candidate = path.resolve(PROJECT_ROOT, registry.path);
    if (!isWithin(ARTWORK_ROOT, candidate)) {
      throw new Error(`Theme artwork must remain inside ${ARTWORK_ROOT}: ${registry.path}`);
    }
    const mime = MIME_TYPES.get(path.extname(candidate).toLowerCase());
    if (!mime) throw new Error(`Unsupported theme artwork type: ${registry.path}`);
    const realPath = await fs.realpath(candidate).catch((error) => {
      if (error.code === "ENOENT") throw new Error(`Registered artwork is missing: ${registry.path}`);
      throw error;
    });
    if (!isWithin(realRoot, realPath)) {
      throw new Error(`Registered artwork resolves outside ${realRoot}: ${registry.path}`);
    }
    const bytes = await fs.readFile(realPath);
    if (!bytes.length) throw new Error(`Registered artwork is empty: ${registry.path}`);
    const format = path.extname(candidate).slice(1).toLowerCase();
    const image = inspectArtwork(bytes, format, registry.path);
    const alphaExpected = ["hero", "decoration"].includes(registry.role ?? "decoration");
    const fullBleedExpected = (registry.role ?? "decoration") === "background";
    if (alphaExpected && image.alpha !== true) {
      throw new Error(`Transparent ${registry.role ?? "decoration"} artwork lost its alpha channel: ${registry.path}`);
    }
    const raster = format !== "svg";
    const layerBudgetPass = !raster || bytes.length < RASTER_LAYER_LIMIT;
    if (!layerBudgetPass) {
      throw new Error(`Raster artwork exceeds the ${RASTER_LAYER_LIMIT} byte layer budget: ${registry.path}`);
    }
    assets.push({
      layerIndex: index,
      path: registry.path,
      bytes: bytes.length,
      sha256: crypto.createHash("sha256").update(bytes).digest("hex"),
      format,
      mime,
      image: {
        width: image.width,
        height: image.height,
        alpha: image.alpha,
        alphaExpected,
        fullBleedExpected,
      },
      budget: {
        limitBytesExclusive: raster ? RASTER_LAYER_LIMIT : null,
        pass: layerBudgetPass,
      },
      registry: {
        position: registry.position,
        size: registry.size,
        mobile: registry.mobile,
        opacity: registry.opacity ?? 1,
        mask: registry.mask ?? "soft-right",
        role: registry.role ?? "decoration",
        appearance: registry.appearance ?? null,
        contextOverrides: registry.contextOverrides ?? null,
      },
    });
  }
  return { assets, layered };
}

async function resolveBrandMarkAsset(theme) {
  const registryPath = BUILTIN_BRAND_MARK_ASSETS[theme.name] ?? null;
  if (!registryPath) return null;
  const match = BRAND_MARK_ASSET_PATTERN.exec(registryPath);
  if (!match || match[1] !== theme.name) {
    throw new Error(`Brand mark must be scoped to its theme id: ${theme.name}`);
  }
  const candidate = path.resolve(PROJECT_ROOT, registryPath);
  if (!isWithin(ARTWORK_ROOT, candidate)) {
    throw new Error(`Brand mark must remain inside ${ARTWORK_ROOT}: ${registryPath}`);
  }
  const [realRoot, realPath] = await Promise.all([
    fs.realpath(ARTWORK_ROOT),
    fs.realpath(candidate).catch((error) => {
      if (error.code === "ENOENT") throw new Error(`Registered brand mark is missing: ${registryPath}`);
      throw error;
    }),
  ]);
  if (!isWithin(realRoot, realPath)) {
    throw new Error(`Registered brand mark resolves outside ${realRoot}: ${registryPath}`);
  }
  const bytes = await fs.readFile(realPath);
  if (!bytes.length) throw new Error(`Registered brand mark is empty: ${registryPath}`);
  const source = bytes.toString("utf8");
  const image = inspectArtwork(bytes, "svg", registryPath);
  if (image.width !== image.height || image.width < 16 || image.width > 256) {
    throw new Error(`Brand mark must use a square 16–256 unit viewBox: ${registryPath}`);
  }
  if (!/<svg\b[^>]*\baria-hidden=["']true["'][^>]*\bfocusable=["']false["'][^>]*\bpointer-events=["']none["']/i.test(source)) {
    throw new Error(`Brand mark must be aria-hidden, non-focusable, and pointer-inert: ${registryPath}`);
  }
  if (/<(?:script|style|foreignObject|image|use|text|title|desc)\b/i.test(source)
      || /\b(?:xlink:)?href\s*=/i.test(source)
      || /\bcurrentColor\b/i.test(source)
      || /\bon[a-z]+\s*=/i.test(source)
      || /(?:data:|https?:\/\/(?!www\.w3\.org\/2000\/svg))/i.test(source)) {
    throw new Error(`Brand mark contains dynamic, textual, or external content: ${registryPath}`);
  }
  const budgetPass = bytes.length < BRAND_MARK_LIMIT;
  if (!budgetPass) throw new Error(`Brand mark exceeds ${BRAND_MARK_LIMIT} bytes: ${registryPath}`);
  return {
    path: registryPath,
    bytes: bytes.length,
    sha256: crypto.createHash("sha256").update(bytes).digest("hex"),
    format: "svg",
    mime: "image/svg+xml",
    image: {
      width: image.width,
      height: image.height,
      alpha: true,
      alphaExpected: true,
      fullBleedExpected: false,
    },
    budget: {
      limitBytesExclusive: BRAND_MARK_LIMIT,
      pass: budgetPass,
    },
    usage: "in-page-brand-mark",
    renderer: false,
    nativeFallback: true,
  };
}

async function resolveBrandWordmarkAssets(theme) {
  const registry = BUILTIN_BRAND_WORDMARK_ASSETS[theme.name] ?? null;
  if (!registry) return null;
  const resolved = {};
  for (const appearance of MODES) {
    const registryPath = registry[appearance];
    const match = BRAND_WORDMARK_ASSET_PATTERN.exec(registryPath ?? "");
    if (!match || match[1] !== theme.name || match[2] !== appearance) {
      throw new Error(`Brand wordmark must be scoped to ${theme.name}/${appearance}`);
    }
    const candidate = path.resolve(PROJECT_ROOT, registryPath);
    if (!isWithin(ARTWORK_ROOT, candidate)) {
      throw new Error(`Brand wordmark must remain inside ${ARTWORK_ROOT}: ${registryPath}`);
    }
    const [realRoot, realPath] = await Promise.all([
      fs.realpath(ARTWORK_ROOT),
      fs.realpath(candidate).catch((error) => {
        if (error.code === "ENOENT") throw new Error(`Registered brand wordmark is missing: ${registryPath}`);
        throw error;
      }),
    ]);
    if (!isWithin(realRoot, realPath)) {
      throw new Error(`Registered brand wordmark resolves outside ${realRoot}: ${registryPath}`);
    }
    const bytes = await fs.readFile(realPath);
    const image = inspectArtwork(bytes, "png", registryPath);
    if (image.width !== 344 || image.height !== 124 || image.alpha !== true) {
      throw new Error(`Brand wordmark must be a transparent 344x124 PNG: ${registryPath}`);
    }
    const budgetPass = bytes.length < RASTER_LAYER_LIMIT;
    if (!budgetPass) throw new Error(`Brand wordmark exceeds ${RASTER_LAYER_LIMIT} bytes: ${registryPath}`);
    resolved[appearance] = {
      path: registryPath,
      appearance,
      bytes: bytes.length,
      sha256: crypto.createHash("sha256").update(bytes).digest("hex"),
      format: "png",
      mime: "image/png",
      image: {
        width: image.width,
        height: image.height,
        alpha: image.alpha,
        alphaExpected: true,
        fullBleedExpected: false,
      },
      budget: {
        limitBytesExclusive: RASTER_LAYER_LIMIT,
        pass: budgetPass,
      },
      usage: "in-page-brand-wordmark",
      renderer: true,
      nativeFallback: true,
    };
  }
  const approvedSharedKoreanIdol = theme.name === "korean-idol"
    && resolved.light.sha256 === KOREAN_IDOL_APPROVED_WORDMARK_SHA256
    && resolved.dark.sha256 === KOREAN_IDOL_APPROVED_WORDMARK_SHA256;
  if (resolved.light.sha256 === resolved.dark.sha256 && !approvedSharedKoreanIdol) {
    throw new Error(`Brand wordmark light and dark assets must be distinct: ${theme.name}`);
  }
  return {
    minWidth: registry.minWidth,
    width: registry.width,
    light: resolved.light,
    dark: resolved.dark,
  };
}

async function resolveLauncherAsset(theme) {
  const registry = theme.launcher;
  if (!registry || !LAUNCHER_ASSET_PATTERN.test(registry.asset ?? "")) {
    throw new Error(`Theme launcher must reference an isolated built-in launcher mark: ${theme.name}`);
  }
  const candidate = path.resolve(PROJECT_ROOT, registry.asset);
  if (!isWithin(ARTWORK_ROOT, candidate)) {
    throw new Error(`Theme launcher must remain inside ${ARTWORK_ROOT}: ${registry.asset}`);
  }
  const [realRoot, realPath] = await Promise.all([
    fs.realpath(ARTWORK_ROOT),
    fs.realpath(candidate).catch((error) => {
      if (error.code === "ENOENT") throw new Error(`Registered launcher mark is missing: ${registry.asset}`);
      throw error;
    }),
  ]);
  if (!isWithin(realRoot, realPath)) {
    throw new Error(`Registered launcher mark resolves outside ${realRoot}: ${registry.asset}`);
  }
  const bytes = await fs.readFile(realPath);
  if (!bytes.length) throw new Error(`Registered launcher mark is empty: ${registry.asset}`);
  const image = inspectArtwork(bytes, "png", registry.asset);
  if (image.width !== 96 || image.height !== 96 || image.alpha !== true) {
    throw new Error(`Launcher mark must be a transparent 96×96 PNG: ${registry.asset}`);
  }
  const budgetPass = bytes.length < RASTER_LAYER_LIMIT;
  if (!budgetPass) {
    throw new Error(`Launcher mark exceeds the ${RASTER_LAYER_LIMIT} byte asset budget: ${registry.asset}`);
  }
  const iconRegistryPath = registry.asset.replace(/\.png$/, ".ico");
  const iconCandidate = path.resolve(PROJECT_ROOT, iconRegistryPath);
  if (!isWithin(ARTWORK_ROOT, iconCandidate)) {
    throw new Error(`Theme launcher icon must remain inside ${ARTWORK_ROOT}: ${iconRegistryPath}`);
  }
  const iconRealPath = await fs.realpath(iconCandidate).catch((error) => {
    if (error.code === "ENOENT") throw new Error(`Registered launcher icon is missing: ${iconRegistryPath}`);
    throw error;
  });
  if (!isWithin(realRoot, iconRealPath)) {
    throw new Error(`Registered launcher icon resolves outside ${realRoot}: ${iconRegistryPath}`);
  }
  const iconBytes = await fs.readFile(iconRealPath);
  const icon = parseIco(iconBytes, iconRegistryPath);
  const iconBudgetPass = iconBytes.length < RASTER_LAYER_LIMIT;
  if (!iconBudgetPass) {
    throw new Error(`Launcher icon exceeds the ${RASTER_LAYER_LIMIT} byte asset budget: ${iconRegistryPath}`);
  }
  return {
    path: registry.asset,
    bytes: bytes.length,
    sha256: crypto.createHash("sha256").update(bytes).digest("hex"),
    format: "png",
    mime: "image/png",
    image: {
      width: image.width,
      height: image.height,
      alpha: image.alpha,
      alphaExpected: true,
      fullBleedExpected: false,
    },
    budget: {
      limitBytesExclusive: RASTER_LAYER_LIMIT,
      pass: budgetPass,
    },
    icon: {
      path: iconRegistryPath,
      bytes: iconBytes.length,
      sha256: crypto.createHash("sha256").update(iconBytes).digest("hex"),
      format: "ico",
      mime: "image/x-icon",
      sizes: icon.sizes,
      budget: {
        limitBytesExclusive: RASTER_LAYER_LIMIT,
        pass: iconBudgetPass,
      },
    },
    registry: {
      surface: registry.surface,
      surfaceHover: registry.surfaceHover,
      foreground: registry.foreground,
      accent: registry.accent,
      border: registry.border,
      radius: registry.radius,
      borderWidth: registry.borderWidth,
    },
  };
}

async function resolveStudioPreviewAsset(theme) {
  if (!theme.studioPreview) return null;
  const match = STUDIO_PREVIEW_PATTERN.exec(theme.studioPreview);
  if (!match || match[1] !== theme.name) {
    throw new Error(`Studio preview master must be scoped to its theme id: ${theme.name}`);
  }
  const candidate = path.resolve(PROJECT_ROOT, theme.studioPreview);
  if (!isWithin(STUDIO_PREVIEW_ROOT, candidate)) {
    throw new Error(`Studio preview master must remain inside ${STUDIO_PREVIEW_ROOT}: ${theme.studioPreview}`);
  }
  const [realRoot, realPath] = await Promise.all([
    fs.realpath(STUDIO_PREVIEW_ROOT),
    fs.realpath(candidate).catch((error) => {
      if (error.code === "ENOENT") throw new Error(`Studio preview master is missing: ${theme.studioPreview}`);
      throw error;
    }),
  ]);
  if (!isWithin(realRoot, realPath)) {
    throw new Error(`Studio preview master resolves outside ${realRoot}: ${theme.studioPreview}`);
  }
  const bytes = await fs.readFile(realPath);
  const image = inspectArtwork(bytes, "png", theme.studioPreview);
  if (image.width < 256 || image.height < 256) {
    throw new Error(`Studio preview master is too small: ${theme.studioPreview}`);
  }
  const budgetPass = bytes.length > 0 && bytes.length < STUDIO_PREVIEW_LIMIT;
  if (!budgetPass) throw new Error(`Studio preview master exceeds ${STUDIO_PREVIEW_LIMIT} bytes: ${theme.studioPreview}`);
  return {
    path: theme.studioPreview,
    bytes: bytes.length,
    sha256: crypto.createHash("sha256").update(bytes).digest("hex"),
    format: "png",
    mime: "image/png",
    image,
    frame: theme.studioPreviewFrame ? { ...theme.studioPreviewFrame } : null,
    usage: "studio-picker-only",
    renderer: false,
    budget: { limitBytesExclusive: STUDIO_PREVIEW_LIMIT, pass: budgetPass },
  };
}

async function writeJsonAtomic(filePath, value) {
  const temporary = `${filePath}.tmp-${process.pid}-${crypto.randomBytes(4).toString("hex")}`;
  await fs.writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  try {
    await fs.rename(temporary, filePath);
  } catch (error) {
    if (!["EEXIST", "EPERM"].includes(error.code)) {
      await fs.rm(temporary, { force: true });
      throw error;
    }
    await fs.rm(filePath, { force: true });
    await fs.rename(temporary, filePath);
  }
}

export async function generateAssetAudit(themeId, { cwd = process.cwd() } = {}) {
  if (!/^[a-z][a-z0-9-]{1,39}$/.test(themeId ?? "")) {
    throw new Error("Theme id must be a lowercase kebab-case id");
  }
  const registry = await readThemeRegistry();
  const canonicalId = registry.legacyAliases[themeId] ?? themeId;
  const entry = registry.themes.find((candidate) => candidate.id === canonicalId);
  if (!entry) throw new Error(`Unknown theme: ${themeId}`);
  const theme = (await listThemes({ locale: "en" })).find((candidate) => candidate.name === canonicalId);
  const { assets, layered } = await resolveAssets(entry);
  const brandMarkAsset = await resolveBrandMarkAsset(theme);
  const brandWordmarkAssets = await resolveBrandWordmarkAssets(theme);
  const launcherAsset = await resolveLauncherAsset(theme);
  const studioPreviewAsset = await resolveStudioPreviewAsset(theme);

  const payloads = [];
  for (const mode of MODES) {
    const bundle = await buildPayload({
      config: { ...DEFAULT_CONFIG, theme: canonicalId, appearance: mode },
      locale: "en",
    });
    new Function(bundle.payload);
    const layerCount = Array.isArray(bundle.settings.artLayers) ? bundle.settings.artLayers.length : 0;
    const usesLegacyArtwork = typeof bundle.settings.artDataUrl === "string";
    if (layered && (layerCount !== assets.length || usesLegacyArtwork)) {
      throw new Error(`${mode} payload did not compile all ${assets.length} registered artwork layers`);
    }
    if (!layered && assets.length === 1 && (!usesLegacyArtwork || layerCount !== 0)) {
      throw new Error(`${mode} payload did not compile the registered artwork`);
    }
    const embeddedArtworkBytes = (bundle.settings.artLayers ?? [])
      .reduce((total, layer) => total + Buffer.byteLength(layer.dataUrl, "utf8"), 0)
      + (bundle.settings.artDataUrl ? Buffer.byteLength(bundle.settings.artDataUrl, "utf8") : 0)
      + (bundle.settings.brandWordmark
        ? Buffer.byteLength(bundle.settings.brandWordmark.lightDataUrl, "utf8")
          + Buffer.byteLength(bundle.settings.brandWordmark.darkDataUrl, "utf8")
        : 0);
    const payloadBytes = Buffer.byteLength(bundle.payload, "utf8");
    const chromeBytes = payloadBytes - embeddedArtworkBytes;
    const budgetPass = chromeBytes < CHROME_PAYLOAD_LIMIT && embeddedArtworkBytes < EMBEDDED_ARTWORK_LIMIT;
    if (!budgetPass) throw new Error(`${mode} payload exceeds the theme byte budget`);
    payloads.push({
      mode,
      theme: bundle.settings.theme,
      digest: bundle.digest,
      bytes: payloadBytes,
      embeddedArtworkBytes,
      chromeBytes,
      budgetPass,
      layerCount,
      usesLegacyArtwork,
      syntax: "pass",
    });
  }

  const resolvedCwd = await fs.realpath(path.resolve(cwd));
  const kitDirectory = path.join(resolvedCwd, "themes", canonicalId);
  const hasKit = await fs.stat(kitDirectory).then((stat) => stat.isDirectory()).catch((error) => {
    if (error.code === "ENOENT") return false;
    throw error;
  });
  const outputDir = hasKit
    ? path.join(kitDirectory, "qa")
    : path.join(resolvedCwd, "dist", "qa", canonicalId);
  if (!isWithin(resolvedCwd, outputDir)) throw new Error(`QA output resolves outside ${resolvedCwd}`);
  await fs.mkdir(outputDir, { recursive: true });
  const realOutputDir = await fs.realpath(outputDir);
  if (!isWithin(resolvedCwd, realOutputDir)) throw new Error(`QA output resolves outside ${resolvedCwd}`);

  const statusPath = path.join(outputDir, "status.json");
  const rawArtworkBytes = assets.reduce(
    (total, asset) => total + asset.bytes,
    launcherAsset.bytes + launcherAsset.icon.bytes + (brandMarkAsset?.bytes ?? 0)
      + (brandWordmarkAssets?.light.bytes ?? 0) + (brandWordmarkAssets?.dark.bytes ?? 0),
  );
  const status = {
    schemaVersion: 4,
    theme: { id: canonicalId, label: theme.label },
    state: "asset-audit-pass",
    generatedAt: new Date().toISOString(),
    visualReview: {
      requiredSurface: "actual Aura WebView2 on live claude.ai",
      fixtureImages: "forbidden",
    },
    budgets: {
      limits: {
        chromePayloadBytesExclusive: CHROME_PAYLOAD_LIMIT,
        embeddedArtworkBytesExclusive: EMBEDDED_ARTWORK_LIMIT,
        rasterLayerBytesExclusive: RASTER_LAYER_LIMIT,
        vectorBrandMarkBytesExclusive: BRAND_MARK_LIMIT,
        studioPreviewBytesExclusive: STUDIO_PREVIEW_LIMIT,
      },
      rawArtworkBytes,
      pass: payloads.every((payload) => payload.budgetPass)
        && assets.every((asset) => asset.budget.pass)
        && launcherAsset.budget.pass
        && launcherAsset.icon.budget.pass
        && (brandMarkAsset?.budget.pass ?? true)
        && (brandWordmarkAssets?.light.budget.pass ?? true)
        && (brandWordmarkAssets?.dark.budget.pass ?? true)
        && (studioPreviewAsset?.budget.pass ?? true),
    },
    payloads,
    assets,
    brandMarkAsset,
    brandWordmarkAssets,
    launcherAsset,
    studioPreviewAsset,
  };
  await writeJsonAtomic(statusPath, status);
  return {
    themeId: canonicalId,
    outputDir: slash(path.relative(resolvedCwd, outputDir)),
    boardPath: null,
    statusPath,
    assetCount: assets.length + 2 + (brandMarkAsset ? 1 : 0)
      + (brandWordmarkAssets ? 2 : 0) + (studioPreviewAsset ? 1 : 0),
    layerCount: layered ? assets.length : 0,
    modes: [...MODES],
  };
}
