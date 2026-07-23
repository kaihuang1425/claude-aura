#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import zlib from "node:zlib";
import { PROJECT_ROOT } from "./theme-core.mjs";

const MARK_SIZE = 96;
const SAFE_AREA_RATIO = 72 / 96;
const ICON_SIZES = Object.freeze([16, 20, 24, 32, 40, 48, 64, 128, 256]);
const THEMES = Object.freeze([
  "default",
  "japanese-film-editorial",
  "korean-prestige",
  "cartoon-studio",
  "anime-twilight",
  "study-library",
  "japanese-idol",
  "korean-idol",
]);
const DEFAULT_SOURCE_ROOT = path.join(
  PROJECT_ROOT, "assets", "studio-previews", "references", "launcher-marks-v2");
const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const TRANSIENT_WRITE_ERRORS = new Set(["EACCES", "EBUSY", "EPERM", "UNKNOWN"]);

const CRC_TABLE = Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) value = (value >>> 1) ^ ((value & 1) ? 0xedb88320 : 0);
  return value >>> 0;
});

function crc32(bytes) {
  let value = 0xffffffff;
  for (const byte of bytes) value = CRC_TABLE[(value ^ byte) & 0xff] ^ (value >>> 8);
  return (value ^ 0xffffffff) >>> 0;
}

export async function writeGeneratedFile(filePath, bytes) {
  try {
    const current = await fs.readFile(filePath);
    if (current.equals(bytes)) return false;
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }

  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      await fs.writeFile(filePath, bytes);
      return true;
    } catch (error) {
      const retry = TRANSIENT_WRITE_ERRORS.has(error?.code) && attempt < 3;
      if (!retry) throw error;
      await new Promise((resolve) => setTimeout(resolve, 40 * (2 ** attempt)));
    }
  }
  return false;
}

function paeth(left, up, upperLeft) {
  const estimate = left + up - upperLeft;
  const leftDistance = Math.abs(estimate - left);
  const upDistance = Math.abs(estimate - up);
  const upperLeftDistance = Math.abs(estimate - upperLeft);
  if (leftDistance <= upDistance && leftDistance <= upperLeftDistance) return left;
  return upDistance <= upperLeftDistance ? up : upperLeft;
}

export function decodePng(bytes, label) {
  if (!bytes.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)) {
    throw new Error(`${label} is not a PNG image`);
  }
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  let interlace = 0;
  const imageData = [];
  for (let offset = PNG_SIGNATURE.length; offset + 12 <= bytes.length;) {
    const length = bytes.readUInt32BE(offset);
    const type = bytes.toString("ascii", offset + 4, offset + 8);
    const start = offset + 8;
    const end = start + length;
    if (end + 4 > bytes.length) throw new Error(`${label} contains a truncated ${type} chunk`);
    if (type === "IHDR") {
      width = bytes.readUInt32BE(start);
      height = bytes.readUInt32BE(start + 4);
      bitDepth = bytes[start + 8];
      colorType = bytes[start + 9];
      if (bytes[start + 10] !== 0 || bytes[start + 11] !== 0) {
        throw new Error(`${label} uses unsupported PNG compression or filtering`);
      }
      interlace = bytes[start + 12];
    } else if (type === "IDAT") {
      imageData.push(bytes.subarray(start, end));
    } else if (type === "IEND") {
      break;
    }
    offset = end + 4;
  }
  if (!width || !height || bitDepth !== 8 || ![2, 6].includes(colorType) || interlace !== 0 || imageData.length === 0) {
    throw new Error(`${label} must be a non-interlaced 8-bit RGB or RGBA PNG`);
  }
  const channels = colorType === 6 ? 4 : 3;
  const stride = width * channels;
  const inflated = zlib.inflateSync(Buffer.concat(imageData));
  if (inflated.length !== height * (stride + 1)) throw new Error(`${label} has an invalid scanline length`);
  const decoded = Buffer.alloc(width * height * channels);
  for (let y = 0; y < height; y += 1) {
    const sourceOffset = y * (stride + 1);
    const filter = inflated[sourceOffset];
    const targetOffset = y * stride;
    if (filter > 4) throw new Error(`${label} uses an unsupported PNG row filter`);
    for (let x = 0; x < stride; x += 1) {
      const raw = inflated[sourceOffset + 1 + x];
      const left = x >= channels ? decoded[targetOffset + x - channels] : 0;
      const up = y > 0 ? decoded[targetOffset + x - stride] : 0;
      const upperLeft = y > 0 && x >= channels ? decoded[targetOffset + x - stride - channels] : 0;
      let value = raw;
      if (filter === 1) value += left;
      else if (filter === 2) value += up;
      else if (filter === 3) value += Math.floor((left + up) / 2);
      else if (filter === 4) value += paeth(left, up, upperLeft);
      decoded[targetOffset + x] = value & 255;
    }
  }
  if (channels === 4) return { width, height, pixels: decoded };
  const pixels = Buffer.alloc(width * height * 4);
  for (let pixel = 0; pixel < width * height; pixel += 1) {
    pixels[pixel * 4] = decoded[pixel * 3];
    pixels[(pixel * 4) + 1] = decoded[(pixel * 3) + 1];
    pixels[(pixel * 4) + 2] = decoded[(pixel * 3) + 2];
    pixels[(pixel * 4) + 3] = 255;
  }
  return { width, height, pixels };
}

function sinc(value) {
  if (Math.abs(value) < 1e-8) return 1;
  const angle = Math.PI * value;
  return Math.sin(angle) / angle;
}

function lanczos(value, radius = 3) {
  const distance = Math.abs(value);
  return distance < radius ? sinc(value) * sinc(value / radius) : 0;
}

function contributions(sourceSize, targetSize) {
  const scale = sourceSize / targetSize;
  const support = 3 * Math.max(1, scale);
  return Array.from({ length: targetSize }, (_, target) => {
    const center = (target + 0.5) * scale - 0.5;
    const start = Math.max(0, Math.ceil(center - support));
    const end = Math.min(sourceSize - 1, Math.floor(center + support));
    const weights = [];
    let total = 0;
    for (let source = start; source <= end; source += 1) {
      const weight = lanczos((source - center) / Math.max(1, scale));
      if (weight === 0) continue;
      weights.push([source, weight]);
      total += weight;
    }
    if (Math.abs(total) < 1e-12) return [[Math.max(0, Math.min(sourceSize - 1, Math.round(center))), 1]];
    return weights.map(([source, weight]) => [source, weight / total]);
  });
}

export function resizeRgba(model, width, height) {
  const horizontalWeights = contributions(model.width, width);
  const verticalWeights = contributions(model.height, height);
  const horizontal = new Float64Array(width * model.height * 4);
  for (let y = 0; y < model.height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const target = (y * width + x) * 4;
      for (const [sourceX, weight] of horizontalWeights[x]) {
        const source = (y * model.width + sourceX) * 4;
        const alpha = model.pixels[source + 3] / 255;
        horizontal[target] += model.pixels[source] * alpha * weight;
        horizontal[target + 1] += model.pixels[source + 1] * alpha * weight;
        horizontal[target + 2] += model.pixels[source + 2] * alpha * weight;
        horizontal[target + 3] += alpha * weight;
      }
    }
  }
  const pixels = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const target = (y * width + x) * 4;
      let red = 0;
      let green = 0;
      let blue = 0;
      let alpha = 0;
      for (const [sourceY, weight] of verticalWeights[y]) {
        const source = (sourceY * width + x) * 4;
        red += horizontal[source] * weight;
        green += horizontal[source + 1] * weight;
        blue += horizontal[source + 2] * weight;
        alpha += horizontal[source + 3] * weight;
      }
      const boundedAlpha = Math.max(0, Math.min(1, alpha));
      pixels[target + 3] = Math.round(boundedAlpha * 255);
      if (boundedAlpha > 1 / 255) {
        pixels[target] = Math.round(Math.max(0, Math.min(255, red / boundedAlpha)));
        pixels[target + 1] = Math.round(Math.max(0, Math.min(255, green / boundedAlpha)));
        pixels[target + 2] = Math.round(Math.max(0, Math.min(255, blue / boundedAlpha)));
      }
    }
  }
  return pixels;
}

function pngChunk(type, data) {
  const name = Buffer.from(type, "ascii");
  const result = Buffer.alloc(12 + data.length);
  result.writeUInt32BE(data.length, 0);
  name.copy(result, 4);
  data.copy(result, 8);
  result.writeUInt32BE(crc32(Buffer.concat([name, data])), 8 + data.length);
  return result;
}

export function encodePng(width, height, pixels) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  const stride = width * 4;
  const rows = Buffer.alloc(height * (stride + 1));
  for (let y = 0; y < height; y += 1) {
    const rowOffset = y * (stride + 1);
    rows[rowOffset] = 0;
    pixels.copy(rows, rowOffset + 1, y * stride, (y + 1) * stride);
  }
  return Buffer.concat([
    PNG_SIGNATURE,
    pngChunk("IHDR", header),
    pngChunk("IDAT", zlib.deflateSync(rows, { level: 9 })),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

function encodeDib(size, pixels) {
  const xorBytes = size * size * 4;
  const maskStride = Math.ceil(size / 32) * 4;
  const header = Buffer.alloc(40);
  header.writeUInt32LE(40, 0);
  header.writeInt32LE(size, 4);
  header.writeInt32LE(size * 2, 8);
  header.writeUInt16LE(1, 12);
  header.writeUInt16LE(32, 14);
  header.writeUInt32LE(xorBytes, 20);
  const xor = Buffer.alloc(xorBytes);
  const mask = Buffer.alloc(maskStride * size);
  for (let targetY = 0; targetY < size; targetY += 1) {
    const sourceY = size - targetY - 1;
    for (let x = 0; x < size; x += 1) {
      const source = (sourceY * size + x) * 4;
      const target = (targetY * size + x) * 4;
      xor[target] = pixels[source + 2];
      xor[target + 1] = pixels[source + 1];
      xor[target + 2] = pixels[source];
      xor[target + 3] = pixels[source + 3];
      if (pixels[source + 3] === 0) mask[targetY * maskStride + Math.floor(x / 8)] |= 0x80 >>> (x % 8);
    }
  }
  return Buffer.concat([header, xor, mask]);
}

function encodeIco(frames) {
  const directory = Buffer.alloc(6 + frames.length * 16);
  directory.writeUInt16LE(0, 0);
  directory.writeUInt16LE(1, 2);
  directory.writeUInt16LE(frames.length, 4);
  let offset = directory.length;
  frames.forEach((frame, index) => {
    const entry = 6 + index * 16;
    directory[entry] = frame.size === 256 ? 0 : frame.size;
    directory[entry + 1] = frame.size === 256 ? 0 : frame.size;
    directory[entry + 2] = 0;
    directory[entry + 3] = 0;
    directory.writeUInt16LE(1, entry + 4);
    directory.writeUInt16LE(32, entry + 6);
    directory.writeUInt32LE(frame.bytes.length, entry + 8);
    directory.writeUInt32LE(offset, entry + 12);
    offset += frame.bytes.length;
  });
  return Buffer.concat([directory, ...frames.map((frame) => frame.bytes)]);
}

function visibleBounds(model) {
  let left = model.width;
  let top = model.height;
  let right = -1;
  let bottom = -1;
  let visiblePixels = 0;
  for (let y = 0; y < model.height; y += 1) {
    for (let x = 0; x < model.width; x += 1) {
      if (model.pixels[(y * model.width + x) * 4 + 3] < 8) continue;
      visiblePixels += 1;
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x);
      bottom = Math.max(bottom, y);
    }
  }
  if (!visiblePixels) throw new Error("Launcher mark source has no visible pixels");
  return { left, top, right, bottom, width: right - left + 1, height: bottom - top + 1, visiblePixels };
}

function cropModel(model, bounds) {
  const margin = Math.max(2, Math.round(Math.max(bounds.width, bounds.height) * 0.008));
  const left = Math.max(0, bounds.left - margin);
  const top = Math.max(0, bounds.top - margin);
  const right = Math.min(model.width - 1, bounds.right + margin);
  const bottom = Math.min(model.height - 1, bounds.bottom + margin);
  const width = right - left + 1;
  const height = bottom - top + 1;
  const pixels = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    model.pixels.copy(
      pixels,
      y * width * 4,
      ((top + y) * model.width + left) * 4,
      ((top + y) * model.width + left + width) * 4,
    );
  }
  return { width, height, pixels };
}

function fitMark(model, size) {
  const bounds = visibleBounds(model);
  if (bounds.left === 0 || bounds.top === 0 || bounds.right === model.width - 1 || bounds.bottom === model.height - 1) {
    throw new Error("Launcher mark source touches its canvas edge");
  }
  const cropped = cropModel(model, bounds);
  const maximum = Math.max(1, Math.floor(size * SAFE_AREA_RATIO));
  const scale = Math.min(maximum / cropped.width, maximum / cropped.height);
  const width = Math.max(1, Math.round(cropped.width * scale));
  const height = Math.max(1, Math.round(cropped.height * scale));
  const resized = resizeRgba(cropped, width, height);
  const pixels = Buffer.alloc(size * size * 4);
  const left = Math.floor((size - width) / 2);
  const top = Math.floor((size - height) / 2);
  for (let y = 0; y < height; y += 1) {
    resized.copy(pixels, ((top + y) * size + left) * 4, y * width * 4, (y + 1) * width * 4);
  }
  return pixels;
}

export async function buildLauncherAssets({
  outputRoot = path.join(PROJECT_ROOT, "assets", "theme-art"),
  sourceRoot = DEFAULT_SOURCE_ROOT,
} = {}) {
  const results = [];
  for (const theme of THEMES) {
    const sourcePath = path.join(sourceRoot, `${theme}.png`);
    const sourceBytes = await fs.readFile(sourcePath);
    const model = decodePng(sourceBytes, `Launcher mark source for ${theme}`);
    if (model.width < 512 || model.height < 512) {
      throw new Error(`Launcher mark source for ${theme} must be at least 512px per side`);
    }
    const bounds = visibleBounds(model);
    if (bounds.left === 0 || bounds.top === 0 || bounds.right === model.width - 1 || bounds.bottom === model.height - 1) {
      throw new Error(`Launcher mark source for ${theme} touches its canvas edge`);
    }
    const outputDirectory = path.join(outputRoot, theme);
    const outputPath = path.join(outputDirectory, "launcher-mark.png");
    const iconOutputPath = path.join(outputDirectory, "launcher-mark.ico");
    const markPixels = fitMark(model, MARK_SIZE);
    const silhouette = Buffer.alloc(markPixels.length / 4);
    for (let pixel = 0; pixel < silhouette.length; pixel += 1) silhouette[pixel] = markPixels[pixel * 4 + 3];
    const bytes = encodePng(MARK_SIZE, MARK_SIZE, markPixels);
    const iconFrames = ICON_SIZES.map((size) => {
      const pixels = fitMark(model, size);
      return { size, bytes: size === 256 ? encodePng(size, size, pixels) : encodeDib(size, pixels) };
    });
    const iconBytes = encodeIco(iconFrames);
    await fs.mkdir(outputDirectory, { recursive: true });
    await Promise.all([
      writeGeneratedFile(outputPath, bytes),
      writeGeneratedFile(iconOutputPath, iconBytes),
    ]);
    results.push({
      theme,
      sourcePath,
      sourceWidth: model.width,
      sourceHeight: model.height,
      visibleBounds: bounds,
      outputPath,
      width: MARK_SIZE,
      height: MARK_SIZE,
      bytes: bytes.length,
      sha256: crypto.createHash("sha256").update(bytes).digest("hex"),
      silhouetteSha256: crypto.createHash("sha256").update(silhouette).digest("hex"),
      iconOutputPath,
      iconSizes: [...ICON_SIZES],
      iconBytes: iconBytes.length,
      iconSha256: crypto.createHash("sha256").update(iconBytes).digest("hex"),
    });
  }
  return results;
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : "";
if (invokedPath === import.meta.url) console.log(JSON.stringify(await buildLauncherAssets(), null, 2));
