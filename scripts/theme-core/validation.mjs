// Extracted from theme-core.mjs. Public API is re-exported by scripts/theme-core.mjs.
import fs from "node:fs/promises";
import path from "node:path";
import { inflateSync } from "node:zlib";
import {
  ANIMATED_AVIF_BRANDS,
  ARTWORK_TYPES,
  AVIF_BRANDS,
  BUILTIN_LAUNCHER_ASSET_PATTERN,
  DEFAULT_LAUNCHER_STYLE,
  FROZEN_BUILTIN_THEME_IDS,
  HEX_COLOR,
  LEGACY_REQUIRED_TOKENS,
  MAX_CHROME_PAYLOAD_BYTES,
  MAX_USER_ARTWORK_TOTAL_BYTES,
  MAX_USER_RASTER_ARTWORK_BYTES,
  REQUIRED_SEMANTIC_INPUTS,
  REQUIRED_SEMANTIC_TOKENS,
  STUDIO_ARTWORK_PATH_PATTERN,
  STUDIO_FONT_DISPLAY_STACKS,
  STUDIO_FONT_UI_STACKS,
  STUDIO_LAYER_ANCHORS,
  STUDIO_LAYER_APPEARANCES,
  STUDIO_LAYER_CONTEXTS,
  STUDIO_LAYER_ID_PATTERN,
  STUDIO_LAYER_MASKS,
  STUDIO_LAYER_MOBILE,
  STUDIO_LAYER_ROLES,
  STUDIO_LAYER_VIEWPORTS,
  STUDIO_MAX_LAYERS,
  STUDIO_RECIPE_CONTROL_OVERRIDES,
  STUDIO_SHADOWS,
  STUDIO_THEME_SCHEMA_VERSION,
  SUPPORTED_LOCALES,
  THEME_ID_PATTERN,
  USER_ARTWORK_PATH_PATTERN,
  USER_LAUNCHER_ASSET_PATTERN,
} from "./constants.mjs";

export function payloadBudget(payload, settings) {
  if (typeof payload !== "string") throw new Error("Renderer payload must be a string");
  if (!isPlainObject(settings)) throw new Error("Renderer settings must be an object");
  // Count payload occurrences rather than unique strings. Two settings may
  // intentionally reference the same approved asset (for example one lockup
  // shared by Light and Dark), but both serialized copies are still artwork
  // bytes and must not be misclassified as renderer chrome.
  const artworkUrls = [];
  if (typeof settings.artDataUrl === "string" && settings.artDataUrl) artworkUrls.push(settings.artDataUrl);
  if (settings.brandWordmark) {
    for (const key of ["lightDataUrl", "darkDataUrl"]) {
      if (typeof settings.brandWordmark[key] === "string" && settings.brandWordmark[key]) {
        artworkUrls.push(settings.brandWordmark[key]);
      }
    }
  }
  for (const layer of settings.artLayers ?? []) {
    if (typeof layer?.dataUrl === "string" && layer.dataUrl) artworkUrls.push(layer.dataUrl);
  }
  const payloadDataUrls = [...artworkUrls];
  if (typeof settings.imageDataUrl === "string" && settings.imageDataUrl) {
    payloadDataUrls.push(settings.imageDataUrl);
  }
  const embeddedArtworkBytes = artworkUrls
    .reduce((total, dataUrl) => total + Buffer.byteLength(dataUrl, "utf8"), 0);
  const embeddedDataBytes = payloadDataUrls
    .reduce((total, dataUrl) => total + Buffer.byteLength(dataUrl, "utf8"), 0);
  const payloadBytes = Buffer.byteLength(payload, "utf8");
  const chromeBytes = Math.max(0, payloadBytes - embeddedDataBytes);
  return {
    payloadBytes,
    chromeBytes,
    chromeLimit: MAX_CHROME_PAYLOAD_BYTES,
    embeddedArtworkBytes,
    embeddedArtworkLimit: MAX_USER_ARTWORK_TOTAL_BYTES,
    pass: chromeBytes < MAX_CHROME_PAYLOAD_BYTES
      && embeddedArtworkBytes < MAX_USER_ARTWORK_TOTAL_BYTES,
  };
}

export function enforcePayloadBudget(payload, settings, label = "Renderer payload") {
  const budget = payloadBudget(payload, settings);
  const failures = [];
  if (budget.embeddedArtworkBytes >= budget.embeddedArtworkLimit) {
    failures.push(`${label} embedded artwork must total less than 1.4 MB`);
  }
  if (budget.chromeBytes >= budget.chromeLimit) {
    failures.push(`${label} excluding artwork must be smaller than 65 KB`);
  }
  if (failures.length > 0) {
    const error = new Error(failures.join("; "));
    error.code = "PAYLOAD_BUDGET_EXCEEDED";
    error.budget = budget;
    throw error;
  }
  return budget;
}

export function isPathWithin(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === "" || (!path.isAbsolute(relative) && relative !== ".." && !relative.startsWith(`..${path.sep}`));
}

export function resolveUserThemesDirectory(value) {
  if (value === undefined || value === null || value === false) return null;
  if (typeof value !== "string" || !value.trim()) throw new Error("userThemesDir must be a non-empty path");
  return path.resolve(value);
}

export function hasIsoBrand(bytes, expectedBrands) {
  if (bytes.length < 16 || bytes.subarray(4, 8).toString("ascii") !== "ftyp") return false;
  const declaredLength = bytes.readUInt32BE(0);
  const limit = Math.min(bytes.length, declaredLength >= 16 ? declaredLength : bytes.length);
  if (expectedBrands.has(bytes.subarray(8, 12).toString("ascii"))) return true;
  for (let offset = 16; offset + 4 <= limit; offset += 4) {
    if (expectedBrands.has(bytes.subarray(offset, offset + 4).toString("ascii"))) return true;
  }
  return false;
}

export function detectImageMime(bytes) {
  if (/^GIF8[79]a$/.test(bytes.subarray(0, 6).toString("ascii"))) return "image/gif";
  if (bytes.length >= 8 && bytes.subarray(0, 8).toString("hex") === "89504e470d0a1a0a") return "image/png";
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 12
    && bytes.subarray(0, 4).toString("ascii") === "RIFF"
    && bytes.subarray(8, 12).toString("ascii") === "WEBP") return "image/webp";
  if (hasIsoBrand(bytes, AVIF_BRANDS)) return "image/avif";
  return null;
}

const PNG_SIGNATURE = Buffer.from("89504e470d0a1a0a", "hex");
const PNG_CRC_TABLE = Uint32Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = (value >>> 1) ^ ((value & 1) ? 0xedb88320 : 0);
  }
  return value >>> 0;
});
const PNG_COLOR_CHANNELS = Object.freeze({ 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 });
const PNG_COLOR_BIT_DEPTHS = Object.freeze({
  0: new Set([1, 2, 4, 8, 16]),
  2: new Set([8, 16]),
  3: new Set([1, 2, 4, 8]),
  4: new Set([8, 16]),
  6: new Set([8, 16]),
});
const PNG_ADAM7_PASSES = Object.freeze([
  [0, 0, 8, 8],
  [4, 0, 8, 8],
  [0, 4, 4, 8],
  [2, 0, 4, 4],
  [0, 2, 2, 4],
  [1, 0, 2, 2],
  [0, 1, 1, 2],
]);

function pngCrc32(parts) {
  let value = 0xffffffff;
  for (const bytes of parts) {
    for (const byte of bytes) {
      value = PNG_CRC_TABLE[(value ^ byte) & 0xff] ^ (value >>> 8);
    }
  }
  return (value ^ 0xffffffff) >>> 0;
}

function pngPassExtent(total, start, step) {
  return total <= start ? 0 : Math.ceil((total - start) / step);
}

function launcherPngPasses(width, height, bitsPerPixel, interlace) {
  const definitions = interlace === 0 ? [[0, 0, 1, 1]] : PNG_ADAM7_PASSES;
  return definitions.map(([startX, startY, stepX, stepY]) => {
    const passWidth = pngPassExtent(width, startX, stepX);
    const passHeight = pngPassExtent(height, startY, stepY);
    return {
      width: passWidth,
      height: passHeight,
      rowBytes: Math.ceil((passWidth * bitsPerPixel) / 8),
    };
  }).filter((pass) => pass.width > 0 && pass.height > 0);
}

function launcherPngSample(row, bitDepth, sampleIndex) {
  const bitOffset = sampleIndex * bitDepth;
  if (bitDepth === 16) return row.readUInt16BE(bitOffset / 8);
  const shift = 8 - bitDepth - (bitOffset % 8);
  return (row[Math.floor(bitOffset / 8)] >>> shift) & ((2 ** bitDepth) - 1);
}

function launcherPngPixelIsTransparent(row, pixel, bitDepth, colorType, transparencyData) {
  const channels = PNG_COLOR_CHANNELS[colorType];
  if ([4, 6].includes(colorType)) {
    const alpha = launcherPngSample(row, bitDepth, (pixel * channels) + channels - 1);
    return alpha < (2 ** bitDepth) - 1;
  }
  if (!transparencyData) return false;
  if (colorType === 0) {
    return launcherPngSample(row, bitDepth, pixel) === transparencyData.readUInt16BE(0);
  }
  if (colorType === 2) {
    for (let channel = 0; channel < channels; channel += 1) {
      if (launcherPngSample(row, bitDepth, (pixel * channels) + channel)
          !== transparencyData.readUInt16BE(channel * 2)) return false;
    }
    return true;
  }
  if (colorType === 3) {
    const paletteIndex = launcherPngSample(row, bitDepth, pixel);
    return paletteIndex < transparencyData.length && transparencyData[paletteIndex] < 255;
  }
  return false;
}

function unfilterLauncherPng(
  inflated,
  passes,
  bitsPerPixel,
  bitDepth,
  colorType,
  paletteEntries,
  transparencyData,
  label,
) {
  const filterBytesPerPixel = Math.max(1, Math.ceil(bitsPerPixel / 8));
  let sourceOffset = 0;
  let hasTransparentPixel = false;
  for (const pass of passes) {
    let previous = null;
    for (let row = 0; row < pass.height; row += 1) {
      const filter = inflated[sourceOffset];
      sourceOffset += 1;
      if (filter > 4) throw new Error(`${label} contains an invalid PNG row filter`);
      const current = Buffer.allocUnsafe(pass.rowBytes);
      for (let column = 0; column < pass.rowBytes; column += 1) {
        const raw = inflated[sourceOffset + column];
        const left = column >= filterBytesPerPixel ? current[column - filterBytesPerPixel] : 0;
        const up = previous?.[column] ?? 0;
        const upperLeft = column >= filterBytesPerPixel
          ? (previous?.[column - filterBytesPerPixel] ?? 0)
          : 0;
        let predictor = 0;
        if (filter === 1) predictor = left;
        else if (filter === 2) predictor = up;
        else if (filter === 3) predictor = Math.floor((left + up) / 2);
        else if (filter === 4) {
          const estimate = left + up - upperLeft;
          const leftDistance = Math.abs(estimate - left);
          const upDistance = Math.abs(estimate - up);
          const upperLeftDistance = Math.abs(estimate - upperLeft);
          predictor = leftDistance <= upDistance && leftDistance <= upperLeftDistance
            ? left
            : (upDistance <= upperLeftDistance ? up : upperLeft);
        }
        current[column] = (raw + predictor) & 0xff;
      }
      sourceOffset += pass.rowBytes;

      if (colorType === 3) {
        for (let pixel = 0; pixel < pass.width; pixel += 1) {
          const paletteIndex = launcherPngSample(current, bitDepth, pixel);
          if (paletteIndex >= paletteEntries) {
            throw new Error(`${label} contains a PNG palette index outside its palette`);
          }
        }
      }
      if (!hasTransparentPixel) {
        for (let pixel = 0; pixel < pass.width; pixel += 1) {
          if (launcherPngPixelIsTransparent(
            current,
            pixel,
            bitDepth,
            colorType,
            transparencyData,
          )) {
            hasTransparentPixel = true;
            break;
          }
        }
      }
      previous = current;
    }
  }
  if (sourceOffset !== inflated.length) throw new Error(`${label} has an invalid PNG scanline length`);
  return hasTransparentPixel;
}

export function validateLauncherPngBytes(bytes, label) {
  if (!Buffer.isBuffer(bytes) || bytes.length < 8 || !bytes.subarray(0, 8).equals(PNG_SIGNATURE)) {
    throw new Error(`${label} must contain valid PNG image data`);
  }

  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = -1;
  let interlace = -1;
  let paletteEntries = 0;
  let transparencyLength = null;
  let transparencyData = null;
  let sawHeader = false;
  let sawPalette = false;
  let sawImageData = false;
  let endedImageData = false;
  let sawEnd = false;
  let imageDataBytes = 0;
  const imageData = [];

  for (let offset = PNG_SIGNATURE.length; offset < bytes.length;) {
    if (bytes.length - offset < 12) throw new Error(`${label} contains truncated PNG data`);
    const length = bytes.readUInt32BE(offset);
    if (length > 0x7fffffff || length > bytes.length - offset - 12) {
      throw new Error(`${label} contains truncated PNG data`);
    }
    const typeBytes = bytes.subarray(offset + 4, offset + 8);
    const type = typeBytes.toString("ascii");
    if (!/^[A-Za-z]{4}$/.test(type) || (typeBytes[2] & 0x20) !== 0) {
      throw new Error(`${label} contains an invalid PNG chunk type`);
    }
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    const storedCrc = bytes.readUInt32BE(dataEnd);
    if (pngCrc32([typeBytes, bytes.subarray(dataStart, dataEnd)]) !== storedCrc) {
      throw new Error(`${label} contains a PNG chunk with an invalid CRC`);
    }

    if (!sawHeader && type !== "IHDR") throw new Error(`${label} must begin with a PNG IHDR chunk`);
    if (sawImageData && type !== "IDAT" && type !== "IEND") endedImageData = true;

    if (type === "IHDR") {
      if (sawHeader || offset !== PNG_SIGNATURE.length || length !== 13) {
        throw new Error(`${label} contains an invalid PNG IHDR chunk`);
      }
      sawHeader = true;
      width = bytes.readUInt32BE(dataStart);
      height = bytes.readUInt32BE(dataStart + 4);
      bitDepth = bytes[dataStart + 8];
      colorType = bytes[dataStart + 9];
      const compression = bytes[dataStart + 10];
      const filter = bytes[dataStart + 11];
      interlace = bytes[dataStart + 12];
      if (!PNG_COLOR_BIT_DEPTHS[colorType]?.has(bitDepth)
          || compression !== 0 || filter !== 0 || ![0, 1].includes(interlace)) {
        throw new Error(`${label} contains unsupported PNG image settings`);
      }
    } else if (type === "PLTE") {
      if (sawPalette || sawImageData || length === 0 || length > 768 || length % 3 !== 0
          || [0, 4].includes(colorType)) {
        throw new Error(`${label} contains an invalid PNG palette`);
      }
      sawPalette = true;
      paletteEntries = length / 3;
      if (colorType === 3 && paletteEntries > (1 << bitDepth)) {
        throw new Error(`${label} contains too many PNG palette entries`);
      }
    } else if (type === "tRNS") {
      if (transparencyLength !== null || sawImageData || [4, 6].includes(colorType)
          || (colorType === 0 && length !== 2)
          || (colorType === 2 && length !== 6)
          || (colorType === 3 && (!sawPalette || length === 0 || length > paletteEntries))) {
        throw new Error(`${label} contains invalid PNG transparency data`);
      }
      transparencyLength = length;
      transparencyData = bytes.subarray(dataStart, dataEnd);
    } else if (type === "IDAT") {
      if (endedImageData || (colorType === 3 && !sawPalette)) {
        throw new Error(`${label} contains invalid PNG image-data ordering`);
      }
      sawImageData = true;
      imageDataBytes += length;
      imageData.push(bytes.subarray(dataStart, dataEnd));
    } else if (type === "IEND") {
      if (length !== 0 || !sawImageData || imageDataBytes === 0) {
        throw new Error(`${label} must contain PNG image data before its IEND chunk`);
      }
      const nextOffset = dataEnd + 4;
      if (nextOffset !== bytes.length) throw new Error(`${label} contains data after its PNG IEND chunk`);
      sawEnd = true;
      offset = nextOffset;
      break;
    } else if (type === "acTL" || type === "fcTL" || type === "fdAT") {
      throw new Error(`${label} must be a static PNG`);
    } else if ((typeBytes[0] & 0x20) === 0) {
      throw new Error(`${label} contains an unsupported critical PNG chunk`);
    }

    if (length > bytes.length - offset - 12) throw new Error(`${label} contains truncated PNG data`);
    offset += length + 12;
  }

  if (!sawHeader || !sawEnd) throw new Error(`${label} must end with a PNG IEND chunk`);
  if (width !== 96 || height !== 96) throw new Error(`${label} must be exactly 96×96 pixels`);
  if (colorType === 3 && !sawPalette) throw new Error(`${label} contains no PNG palette`);
  if (![4, 6].includes(colorType) && transparencyLength === null) {
    throw new Error(`${label} must retain a transparent alpha channel`);
  }

  const bitsPerPixel = PNG_COLOR_CHANNELS[colorType] * bitDepth;
  const passes = launcherPngPasses(width, height, bitsPerPixel, interlace);
  const expectedLength = passes.reduce(
    (total, pass) => total + (pass.height * (pass.rowBytes + 1)), 0,
  );
  let inflatedResult;
  try {
    inflatedResult = inflateSync(Buffer.concat(imageData, imageDataBytes), {
      info: true,
      maxOutputLength: expectedLength,
    });
  } catch (error) {
    if (error?.code === "ERR_BUFFER_TOO_LARGE") {
      throw new Error(`${label} decompressed image data exceeds its 96×96 bounds`, { cause: error });
    }
    throw new Error(`${label} must contain valid compressed PNG image data`, { cause: error });
  }
  const inflated = inflatedResult.buffer;
  if (inflatedResult.engine.bytesWritten !== imageDataBytes) {
    throw new Error(`${label} contains trailing compressed PNG image data`);
  }
  if (inflated.length !== expectedLength) throw new Error(`${label} has an invalid PNG scanline length`);
  const hasTransparentPixel = unfilterLauncherPng(
    inflated,
    passes,
    bitsPerPixel,
    bitDepth,
    colorType,
    paletteEntries,
    transparencyData,
    label,
  );
  if (!hasTransparentPixel) throw new Error(`${label} must contain at least one transparent pixel`);
}

export function isAnimatedImage(bytes) {
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

export function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export async function readJson(filePath) {
  const source = await fs.readFile(filePath, "utf8");
  try {
    return JSON.parse(source);
  } catch (error) {
    const wrapped = new Error(`Invalid JSON in ${filePath}: ${error.message}`, { cause: error });
    wrapped.code = "AURA_INVALID_JSON";
    throw wrapped;
  }
}

export function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

export function assertExactKeys(value, expected, label) {
  if (!isPlainObject(value)) throw new Error(`${label} must be an object`);
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index])) {
    throw new Error(`${label} has an unsupported property shape`);
  }
}

export function strictNumber(value, label, minimum, maximum) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < minimum || value > maximum) {
    throw new Error(`${label} must be a number between ${minimum} and ${maximum}`);
  }
  return Math.round(value * 100) / 100;
}

export function strictInteger(value, label, minimum, maximum) {
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${label} must be an integer between ${minimum} and ${maximum}`);
  }
  return value;
}

export function strictEnum(value, allowed, label) {
  if (typeof value !== "string" || !allowed.has(value)) {
    throw new Error(`${label} has an unsupported value`);
  }
  return value;
}

export function hslToHex(value) {
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

export function hexToHsl(value, label) {
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

export function finiteNumber(value, label, minimum, maximum) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < minimum || number > maximum) {
    throw new Error(`${label} must be between ${minimum} and ${maximum}`);
  }
  return number;
}

export function validateStudioPreviewCrops(value) {
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

export function isUnavailableFileError(error) {
  return ["ENOENT", "EACCES", "EPERM"].includes(error?.code);
}

export const UNSAFE_CSS_RESOURCE_PATTERN = /\\|@import\b|(?:url|(?:-webkit-)?image-set|src)\s*\(|(?:https?|ftp|file|blob):|\/\//i;

export function assertNoRemoteCssResources(value, label) {
  if (UNSAFE_CSS_RESOURCE_PATTERN.test(value)) {
    throw new Error(`${label} may not load remote resources`);
  }
  return value;
}

export function safeCssValue(value, label, maximum = 600) {
  if (typeof value !== "string" || !value.trim() || value.length > maximum || /[;{}\0]/.test(value)) {
    throw new Error(`${label} contains an unsupported CSS value`);
  }
  return assertNoRemoteCssResources(value.trim(), label);
}

export function validateHslComponents(value, label) {
  const normalized = safeCssValue(value, label, 80);
  const match = normalized.match(/^(\d{1,3}(?:\.\d+)?)\s+(\d{1,3}(?:\.\d+)?)%\s+(\d{1,3}(?:\.\d+)?)%$/);
  if (!match || Number(match[1]) > 360 || Number(match[2]) > 100 || Number(match[3]) > 100) {
    throw new Error(`${label} must contain HSL components such as "220 20% 18%"`);
  }
  return normalized;
}

export function validateLegacyTokenMap(tokens, label) {
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

export function validateSemanticTokenMap(tokens, label) {
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

export function expandLegacyTokens(input) {
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

export function legacyToSemantic(tokens) {
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

export function semanticToLegacy(semantic) {
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

export function validateWallpaper(value, label) {
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

export function validateTypography(value, label, legacyChatFont = null) {
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

export function validateShape(value, label, legacyRadius = 18) {
  const shape = isPlainObject(value) ? value : {};
  return {
    control: finiteNumber(shape.control ?? Math.min(legacyRadius, 14), `${label}.control`, 0, 24),
    card: finiteNumber(shape.card ?? legacyRadius, `${label}.card`, 0, 32),
    composer: finiteNumber(shape.composer ?? Math.min(legacyRadius + 2, 32), `${label}.composer`, 0, 36),
    icon: finiteNumber(shape.icon ?? Math.min(legacyRadius, 12), `${label}.icon`, 0, 24),
    borderWidth: finiteNumber(shape.borderWidth ?? 1, `${label}.borderWidth`, 0, 3),
  };
}

export function validateEffects(value, label) {
  const effects = isPlainObject(value) ? value : {};
  return {
    shadowSoft: safeCssValue(effects.shadowSoft ?? "0 8px 28px rgb(0 0 0 / 0.08)", `${label}.shadowSoft`, 180),
    shadowElevated: safeCssValue(effects.shadowElevated ?? "0 20px 60px rgb(0 0 0 / 0.18)", `${label}.shadowElevated`, 180),
    hoverLift: finiteNumber(effects.hoverLift ?? 1, `${label}.hoverLift`, 0, 4),
    transitionMs: finiteNumber(effects.transitionMs ?? 160, `${label}.transitionMs`, 80, 400),
  };
}

export function validateLauncher(value, label, { enforceContrast = true } = {}) {
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
  if (enforceContrast) {
    const foregroundHsl = hexToHsl(colors.foreground, `${label}.foreground`);
    for (const surfaceKey of ["surface", "surfaceHover"]) {
      const ratio = contrastRatio(foregroundHsl, hexToHsl(colors[surfaceKey], `${label}.${surfaceKey}`));
      if (ratio < 4.5) throw new Error(`${label}.foreground must reach 4.5:1 contrast against ${surfaceKey}`);
    }
  }
  return {
    asset: rawAsset,
    ...colors,
    radius: finiteNumber(value.radius ?? DEFAULT_LAUNCHER_STYLE.radius, `${label}.radius`, 8, 24),
    borderWidth: finiteNumber(value.borderWidth ?? DEFAULT_LAUNCHER_STYLE.borderWidth, `${label}.borderWidth`, 1, 3),
  };
}

export function validateTheme(theme, source = "theme", { enforceLauncherContrast = true } = {}) {
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
    launcher: validateLauncher(theme.launcher, `${source}.launcher`, {
      enforceContrast: enforceLauncherContrast,
    }),
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

export function validateLocalizedMap(value, label, maximum) {
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

export function validateNewChatLayout(value, label) {
  if (value === null || value === undefined) return null;
  assertExactKeys(value, ["widthRatio", "offsetXRatio", "offsetYRatio"], label);
  return {
    widthRatio: strictNumber(value.widthRatio, `${label}.widthRatio`, 0.4, 0.96),
    offsetXRatio: strictNumber(value.offsetXRatio, `${label}.offsetXRatio`, -0.35, 0.35),
    offsetYRatio: strictNumber(value.offsetYRatio, `${label}.offsetYRatio`, -0.3, 0.3),
  };
}

export function validateStudioFrame(value, label) {
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

export function validateStudioLegacyLayer(value, label) {
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

export function validateStudioLayer(value, label) {
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

export function studioRadiusPolicy(radius, borderWidth = 1) {
  return {
    control: Math.min(radius, 24),
    card: radius,
    composer: Math.min(radius, 36),
    icon: Math.min(radius, 24),
    borderWidth,
  };
}

export function validateStudioThemeControls(theme, label) {
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

export function validateStudioThemeKitDocument(raw, source, { enforceLauncherContrast = true } = {}) {
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
  const theme = validateTheme(raw.theme, `${source}.theme`, { enforceLauncherContrast });
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

export function validateRegistryEntry(entry, label, { source = "builtin" } = {}) {
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

export async function validateUserArtworkFile(kitRoot, relativePath, label) {
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
  return {
    sourceBytes: bytes.length,
    embeddedBytes: Buffer.byteLength(`data:${expectedMime};base64,${bytes.toString("base64")}`, "utf8"),
  };
}

export async function validateUserLauncherFile(kitRoot, relativePath, label) {
  const sizes = await validateUserArtworkFile(kitRoot, relativePath, label);
  const candidate = path.resolve(kitRoot, relativePath);
  const bytes = await fs.readFile(candidate);
  validateLauncherPngBytes(bytes, label);
  return sizes;
}

export async function validateUserThemeArtwork(kitRoot, entry, theme, label) {
  const artworkItems = entry.artworkLayers ?? (entry.artwork ? [entry.artwork] : []);
  let sourceTotal = 0;
  let embeddedTotal = 0;
  const validatedPaths = new Set();
  for (let index = 0; index < artworkItems.length; index += 1) {
    const itemLabel = entry.artworkLayers ? `${label}.artworkLayers[${index}].path` : `${label}.artwork.path`;
    const relativePath = artworkItems[index].path;
    if (!validatedPaths.has(relativePath)) {
      const sizes = await validateUserArtworkFile(kitRoot, relativePath, itemLabel);
      sourceTotal += sizes.sourceBytes;
      embeddedTotal += sizes.embeddedBytes;
      validatedPaths.add(relativePath);
    }
  }
  if (embeddedTotal >= MAX_USER_ARTWORK_TOTAL_BYTES) {
    throw new Error(`${label} embedded artwork must total less than 1.4 MB`);
  }
  if (entry.studioPreview) {
    await validateUserArtworkFile(kitRoot, entry.studioPreview, `${label}.studioPreview`);
  }
  if (theme.launcher.asset === "launcher-mark.png") {
    const launcherSizes = await validateUserLauncherFile(
      kitRoot, theme.launcher.asset, `${label}.theme.launcher.asset`);
    sourceTotal += launcherSizes.sourceBytes;
  }
  if (sourceTotal >= MAX_USER_ARTWORK_TOTAL_BYTES) {
    throw new Error(`${label} source artwork must total less than 1.4 MB`);
  }
}

export function hslRgb(value) {
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

export function contrastRatio(left, right) {
  const luminance = (value) => {
    const channels = hslRgb(value).map((channel) => channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
    return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
  };
  const values = [luminance(left), luminance(right)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}
