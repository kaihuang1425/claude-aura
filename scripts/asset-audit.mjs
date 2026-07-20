import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import {
  buildPayload,
  DEFAULT_CONFIG,
  listThemes,
  PROJECT_ROOT,
  readThemeRegistry,
} from "./theme-core.mjs";

const ARTWORK_ROOT = path.resolve(PROJECT_ROOT, "assets", "theme-art");
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
      + (bundle.settings.artDataUrl ? Buffer.byteLength(bundle.settings.artDataUrl, "utf8") : 0);
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
  const rawArtworkBytes = assets.reduce((total, asset) => total + asset.bytes, 0);
  const status = {
    schemaVersion: 2,
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
      },
      rawArtworkBytes,
      pass: payloads.every((payload) => payload.budgetPass) && assets.every((asset) => asset.budget.pass),
    },
    payloads,
    assets,
  };
  await writeJsonAtomic(statusPath, status);
  return {
    themeId: canonicalId,
    outputDir: slash(path.relative(resolvedCwd, outputDir)),
    boardPath: null,
    statusPath,
    assetCount: assets.length,
    layerCount: layered ? assets.length : 0,
    modes: [...MODES],
  };
}
