#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import zlib from "node:zlib";
import { PROJECT_ROOT } from "./theme-core.mjs";

const SIZE = 96;
const SUPERSAMPLE = 4;

const THEMES = Object.freeze({
  default: { ray: "#F4DFBB", alternate: "#F4DFBB", core: "#D66D4B", center: "#FFF5E2", rotation: 0, rayWidth: 5.5 },
  "japanese-film-editorial": { ray: "#252725", alternate: "#6F6252", core: "#B64B32", center: "#F2E8D5", rotation: 22.5, rayWidth: 5 },
  "korean-prestige": { ray: "#EDF3FA", alternate: "#AAB5C7", core: "#5A91E6", center: "#071426", rotation: 0, rayWidth: 4.5 },
  "cartoon-studio": { ray: "#302820", alternate: "#248C88", core: "#EA6047", center: "#FFF6E7", rotation: 0, rayWidth: 6.5 },
  "anime-twilight": { ray: "#9CE5EC", alternate: "#A98FE8", core: "#F0B875", center: "#111A49", rotation: 22.5, rayWidth: 4.5 },
  "study-library": { ray: "#1F523F", alternate: "#AA884C", core: "#74343B", center: "#F4EEDC", rotation: 0, rayWidth: 5 },
  "japanese-idol": { ray: "#C7B3E6", alternate: "#EF879A", core: "#DA6F8D", center: "#FFF5F1", rotation: 22.5, rayWidth: 5.5 },
  "korean-idol": { ray: "#79D7E4", alternate: "#C6B7F2", core: "#8F78DF", center: "#F7F6FF", rotation: 0, rayWidth: 5 },
});

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

function color(value) {
  const packed = Number.parseInt(value.slice(1), 16);
  return [(packed >>> 16) & 255, (packed >>> 8) & 255, packed & 255, 255];
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

function shapesFor(spec) {
  const center = SIZE / 2;
  const shapes = [];
  for (let index = 0; index < 8; index += 1) {
    const angle = ((-90 + spec.rotation + index * 45) * Math.PI) / 180;
    const inner = index % 2 === 0 ? 24 : 25;
    const outer = index % 2 === 0 ? 40 : 37;
    shapes.push({
      type: "line",
      x1: center + Math.cos(angle) * inner,
      y1: center + Math.sin(angle) * inner,
      x2: center + Math.cos(angle) * outer,
      y2: center + Math.sin(angle) * outer,
      width: spec.rayWidth,
      color: color(index % 2 === 0 ? spec.ray : spec.alternate),
    });
  }
  shapes.push({ type: "circle", x: center, y: center, radius: 14, color: color(spec.core) });
  shapes.push({ type: "circle", x: center, y: center, radius: 5.25, color: color(spec.center) });
  return shapes;
}

function covers(shape, x, y) {
  if (shape.type === "line") return insideLine(shape, x, y);
  return (x - shape.x) ** 2 + (y - shape.y) ** 2 <= shape.radius ** 2;
}

function rasterize(spec) {
  const shapes = shapesFor(spec);
  const pixels = Buffer.alloc(SIZE * SIZE * 4);
  const sampleCount = SUPERSAMPLE * SUPERSAMPLE;
  for (let pixelY = 0; pixelY < SIZE; pixelY += 1) {
    for (let pixelX = 0; pixelX < SIZE; pixelX += 1) {
      const channels = [0, 0, 0];
      let coveredSamples = 0;
      for (let sampleY = 0; sampleY < SUPERSAMPLE; sampleY += 1) {
        for (let sampleX = 0; sampleX < SUPERSAMPLE; sampleX += 1) {
          const x = pixelX + (sampleX + 0.5) / SUPERSAMPLE;
          const y = pixelY + (sampleY + 0.5) / SUPERSAMPLE;
          let sample = null;
          for (const shape of shapes) if (covers(shape, x, y)) sample = shape.color;
          if (sample) {
            coveredSamples += 1;
            for (let channel = 0; channel < 3; channel += 1) channels[channel] += sample[channel];
          }
        }
      }
      const offset = (pixelY * SIZE + pixelX) * 4;
      if (coveredSamples) {
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

function encodePng(pixels) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(SIZE, 0);
  header.writeUInt32BE(SIZE, 4);
  header[8] = 8;
  header[9] = 6;
  const rows = Buffer.alloc(SIZE * (SIZE * 4 + 1));
  for (let y = 0; y < SIZE; y += 1) {
    const rowOffset = y * (SIZE * 4 + 1);
    rows[rowOffset] = 0;
    pixels.copy(rows, rowOffset + 1, y * SIZE * 4, (y + 1) * SIZE * 4);
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk("IHDR", header),
    pngChunk("IDAT", zlib.deflateSync(rows, { level: 9 })),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

export async function buildLauncherAssets({
  outputRoot = path.join(PROJECT_ROOT, "assets", "theme-art"),
} = {}) {
  const results = [];
  for (const [theme, spec] of Object.entries(THEMES)) {
    const outputPath = path.join(outputRoot, theme, "launcher-mark.png");
    const bytes = encodePng(rasterize(spec));
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, bytes);
    results.push({
      theme,
      outputPath,
      width: SIZE,
      height: SIZE,
      bytes: bytes.length,
      sha256: crypto.createHash("sha256").update(bytes).digest("hex"),
    });
  }
  return results;
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : "";
if (invokedPath === import.meta.url) console.log(JSON.stringify(await buildLauncherAssets(), null, 2));
