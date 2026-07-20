#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import zlib from "node:zlib";
import { PROJECT_ROOT } from "./theme-core.mjs";

const ICON_SIZES = Object.freeze([16, 20, 24, 32, 40, 48, 64, 128, 256]);
const SUPERSAMPLE = 4;
const DEFAULT_SOURCE = path.join(PROJECT_ROOT, "assets", "brand", "aura-mark.svg");
const DEFAULT_OUTPUT = path.join(PROJECT_ROOT, "assets", "brand", "claude-aura.ico");

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

function attributes(source) {
  const result = Object.create(null);
  for (const match of source.matchAll(/([\w:-]+)="([^"]*)"/g)) result[match[1]] = match[2];
  return result;
}

function finiteNumber(value, label) {
  const number = Number(value);
  if (!Number.isFinite(number)) throw new Error(`Aura icon ${label} must be a finite number.`);
  return number;
}

function color(value, label) {
  const match = /^#([0-9a-f]{6})$/i.exec(value ?? "");
  if (!match) throw new Error(`Aura icon ${label} must be a six-digit hex color.`);
  const packed = Number.parseInt(match[1], 16);
  return [(packed >>> 16) & 255, (packed >>> 8) & 255, packed & 255, 255];
}

function parseSvg(source) {
  const root = /<svg\b([^>]*)>/i.exec(source);
  if (!root) throw new Error("Aura icon SVG root is missing.");
  const viewBox = attributes(root[1]).viewBox?.trim().split(/\s+/).map(Number);
  if (!viewBox || viewBox.length !== 4 || viewBox.some((value) => !Number.isFinite(value))
      || viewBox[2] <= 0 || viewBox[3] <= 0) {
    throw new Error("Aura icon SVG needs a finite positive viewBox.");
  }

  const shapes = [];
  for (const match of source.matchAll(/<(rect|line|circle)\b([^>]*)\/?\s*>/gi)) {
    const type = match[1].toLowerCase();
    const value = attributes(match[2]);
    if (type === "rect") {
      shapes.push({
        type,
        x: finiteNumber(value.x, "rect x"),
        y: finiteNumber(value.y, "rect y"),
        width: finiteNumber(value.width, "rect width"),
        height: finiteNumber(value.height, "rect height"),
        radius: finiteNumber(value.rx ?? 0, "rect radius"),
        color: color(value.fill, "rect fill"),
      });
    } else if (type === "circle") {
      shapes.push({
        type,
        x: finiteNumber(value.cx, "circle cx"),
        y: finiteNumber(value.cy, "circle cy"),
        radius: finiteNumber(value.r, "circle radius"),
        color: color(value.fill, "circle fill"),
      });
    } else {
      if (value["stroke-linecap"] !== "round") throw new Error("Aura icon lines must use round caps.");
      shapes.push({
        type,
        x1: finiteNumber(value.x1, "line x1"),
        y1: finiteNumber(value.y1, "line y1"),
        x2: finiteNumber(value.x2, "line x2"),
        y2: finiteNumber(value.y2, "line y2"),
        width: finiteNumber(value["stroke-width"], "line width"),
        color: color(value.stroke, "line stroke"),
      });
    }
  }
  if (shapes.length === 0) throw new Error("Aura icon SVG has no supported shapes.");
  return { viewBox, shapes };
}

function insideRoundedRect(shape, x, y) {
  if (x < shape.x || y < shape.y || x > shape.x + shape.width || y > shape.y + shape.height) return false;
  const radius = Math.max(0, Math.min(shape.radius, shape.width / 2, shape.height / 2));
  const nearX = Math.max(shape.x + radius, Math.min(x, shape.x + shape.width - radius));
  const nearY = Math.max(shape.y + radius, Math.min(y, shape.y + shape.height - radius));
  return (x - nearX) ** 2 + (y - nearY) ** 2 <= radius ** 2;
}

function insideLine(shape, x, y) {
  const dx = shape.x2 - shape.x1;
  const dy = shape.y2 - shape.y1;
  const lengthSquared = dx * dx + dy * dy;
  const amount = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1,
    ((x - shape.x1) * dx + (y - shape.y1) * dy) / lengthSquared));
  const nearestX = shape.x1 + amount * dx;
  const nearestY = shape.y1 + amount * dy;
  return (x - nearestX) ** 2 + (y - nearestY) ** 2 <= (shape.width / 2) ** 2;
}

function covers(shape, x, y) {
  if (shape.type === "rect") return insideRoundedRect(shape, x, y);
  if (shape.type === "line") return insideLine(shape, x, y);
  return (x - shape.x) ** 2 + (y - shape.y) ** 2 <= shape.radius ** 2;
}

function rasterize(model, size) {
  const [viewX, viewY, viewWidth, viewHeight] = model.viewBox;
  const pixels = Buffer.alloc(size * size * 4);
  const sampleCount = SUPERSAMPLE * SUPERSAMPLE;
  for (let pixelY = 0; pixelY < size; pixelY += 1) {
    for (let pixelX = 0; pixelX < size; pixelX += 1) {
      const channels = [0, 0, 0];
      let coveredSamples = 0;
      for (let sampleY = 0; sampleY < SUPERSAMPLE; sampleY += 1) {
        for (let sampleX = 0; sampleX < SUPERSAMPLE; sampleX += 1) {
          const x = viewX + (pixelX + (sampleX + 0.5) / SUPERSAMPLE) / size * viewWidth;
          const y = viewY + (pixelY + (sampleY + 0.5) / SUPERSAMPLE) / size * viewHeight;
          let sample = [0, 0, 0, 0];
          for (const shape of model.shapes) if (covers(shape, x, y)) sample = shape.color;
          if (sample[3] > 0) {
            coveredSamples += 1;
            for (let channel = 0; channel < 3; channel += 1) channels[channel] += sample[channel];
          }
        }
      }
      const offset = (pixelY * size + pixelX) * 4;
      if (coveredSamples > 0) {
        for (let channel = 0; channel < 3; channel += 1) {
          pixels[offset + channel] = Math.round(channels[channel] / coveredSamples);
        }
        pixels[offset + 3] = Math.round(255 * coveredSamples / sampleCount);
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

function encodePng(size, pixels) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8;
  header[9] = 6;
  const rows = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y += 1) {
    const rowOffset = y * (size * 4 + 1);
    rows[rowOffset] = 0;
    pixels.copy(rows, rowOffset + 1, y * size * 4, (y + 1) * size * 4);
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
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
  header.writeUInt32LE(0, 16);
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

export async function buildAuraIcon({ sourcePath = DEFAULT_SOURCE, outputPath = DEFAULT_OUTPUT } = {}) {
  const source = await fs.readFile(sourcePath, "utf8");
  const model = parseSvg(source);
  const frames = ICON_SIZES.map((size) => {
    const pixels = rasterize(model, size);
    return { size, bytes: size === 256 ? encodePng(size, pixels) : encodeDib(size, pixels) };
  });
  const bytes = encodeIco(frames);
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, bytes);
  return {
    outputPath,
    sizes: [...ICON_SIZES],
    bytes: bytes.length,
    sha256: crypto.createHash("sha256").update(bytes).digest("hex"),
  };
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : "";
if (invokedPath === import.meta.url) {
  console.log(JSON.stringify(await buildAuraIcon(), null, 2));
}
