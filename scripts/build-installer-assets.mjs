#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import zlib from "node:zlib";
import { PROJECT_ROOT } from "./theme-core.mjs";

const LARGE_WIDTH = 480;
const LARGE_HEIGHT = 918;
const SMALL_SIZE = 128;
const SUPERSAMPLE = 2;
const DEFAULT_OUTPUT_DIRECTORY = path.join(PROJECT_ROOT, "installer", "assets");
const THEME_SPINE = Object.freeze([
  "#D66D4B",
  "#B64B32",
  "#5A91E6",
  "#EA6047",
  "#F0B875",
  "#AA884C",
  "#DA6F8D",
  "#79D7E4",
]);

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

function parseHex(value) {
  const match = /^#([0-9a-f]{6})$/i.exec(value);
  if (!match) throw new Error(`Installer artwork color must be a six-digit hex value: ${value}`);
  const packed = Number.parseInt(match[1], 16);
  return [(packed >>> 16) & 255, (packed >>> 8) & 255, packed & 255, 255];
}

function blend(left, right, amount) {
  return left.map((value, index) => Math.round(value + (right[index] - value) * amount));
}

function makeCanvas(width, height) {
  return {
    width,
    height,
    pixels: Buffer.alloc(width * height * 4),
  };
}

function setPixel(canvas, x, y, color) {
  if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) return;
  const offset = (y * canvas.width + x) * 4;
  const alpha = color[3] / 255;
  const inverse = 1 - alpha;
  canvas.pixels[offset] = Math.round(color[0] * alpha + canvas.pixels[offset] * inverse);
  canvas.pixels[offset + 1] = Math.round(color[1] * alpha + canvas.pixels[offset + 1] * inverse);
  canvas.pixels[offset + 2] = Math.round(color[2] * alpha + canvas.pixels[offset + 2] * inverse);
  canvas.pixels[offset + 3] = Math.round(255 * (alpha + canvas.pixels[offset + 3] / 255 * inverse));
}

function fillGradient(canvas, top, bottom) {
  for (let y = 0; y < canvas.height; y += 1) {
    const color = blend(top, bottom, y / Math.max(1, canvas.height - 1));
    for (let x = 0; x < canvas.width; x += 1) setPixel(canvas, x, y, color);
  }
}

function fillRect(canvas, x, y, width, height, color) {
  const left = Math.max(0, Math.floor(x));
  const top = Math.max(0, Math.floor(y));
  const right = Math.min(canvas.width, Math.ceil(x + width));
  const bottom = Math.min(canvas.height, Math.ceil(y + height));
  for (let pixelY = top; pixelY < bottom; pixelY += 1) {
    for (let pixelX = left; pixelX < right; pixelX += 1) setPixel(canvas, pixelX, pixelY, color);
  }
}

function fillRoundedRect(canvas, x, y, width, height, radius, color) {
  const left = Math.floor(x);
  const top = Math.floor(y);
  const right = Math.ceil(x + width);
  const bottom = Math.ceil(y + height);
  const boundedRadius = Math.max(0, Math.min(radius, width / 2, height / 2));
  for (let pixelY = top; pixelY < bottom; pixelY += 1) {
    for (let pixelX = left; pixelX < right; pixelX += 1) {
      const nearestX = Math.max(x + boundedRadius, Math.min(pixelX + 0.5, x + width - boundedRadius));
      const nearestY = Math.max(y + boundedRadius, Math.min(pixelY + 0.5, y + height - boundedRadius));
      if ((pixelX + 0.5 - nearestX) ** 2 + (pixelY + 0.5 - nearestY) ** 2 <= boundedRadius ** 2) {
        setPixel(canvas, pixelX, pixelY, color);
      }
    }
  }
}

function fillCircle(canvas, centerX, centerY, radius, color) {
  const left = Math.floor(centerX - radius);
  const right = Math.ceil(centerX + radius);
  const top = Math.floor(centerY - radius);
  const bottom = Math.ceil(centerY + radius);
  for (let y = top; y < bottom; y += 1) {
    for (let x = left; x < right; x += 1) {
      if ((x + 0.5 - centerX) ** 2 + (y + 0.5 - centerY) ** 2 <= radius ** 2) {
        setPixel(canvas, x, y, color);
      }
    }
  }
}

function drawRoundLine(canvas, x1, y1, x2, y2, width, color) {
  const radius = width / 2;
  const left = Math.floor(Math.min(x1, x2) - radius);
  const right = Math.ceil(Math.max(x1, x2) + radius);
  const top = Math.floor(Math.min(y1, y2) - radius);
  const bottom = Math.ceil(Math.max(y1, y2) + radius);
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lengthSquared = dx * dx + dy * dy;
  for (let y = top; y < bottom; y += 1) {
    for (let x = left; x < right; x += 1) {
      const amount = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1,
        ((x + 0.5 - x1) * dx + (y + 0.5 - y1) * dy) / lengthSquared));
      const nearestX = x1 + amount * dx;
      const nearestY = y1 + amount * dy;
      if ((x + 0.5 - nearestX) ** 2 + (y + 0.5 - nearestY) ** 2 <= radius ** 2) {
        setPixel(canvas, x, y, color);
      }
    }
  }
}

function drawAuraMark(canvas, centerX, centerY, size, palette) {
  const scale = size / 64;
  const originX = centerX - size / 2;
  const originY = centerY - size / 2;
  const point = (value) => value * scale;
  fillRoundedRect(canvas, originX + point(2), originY + point(2), point(60), point(60), point(14), palette.surface);
  const rays = [
    [32, 9, 32, 20],
    [32, 44, 32, 55],
    [9, 32, 20, 32],
    [44, 32, 55, 32],
    [15.7, 15.7, 23.5, 23.5],
    [40.5, 40.5, 48.3, 48.3],
    [48.3, 15.7, 40.5, 23.5],
    [23.5, 40.5, 15.7, 48.3],
  ];
  for (const [x1, y1, x2, y2] of rays) {
    drawRoundLine(canvas, originX + point(x1), originY + point(y1),
      originX + point(x2), originY + point(y2), point(4), palette.foreground);
  }
  fillCircle(canvas, centerX, centerY, point(10), palette.accent);
  fillCircle(canvas, centerX, centerY, point(4), palette.center);
}

function downsample(source, width, height) {
  const target = makeCanvas(width, height);
  const samples = SUPERSAMPLE * SUPERSAMPLE;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const channels = [0, 0, 0, 0];
      for (let sampleY = 0; sampleY < SUPERSAMPLE; sampleY += 1) {
        for (let sampleX = 0; sampleX < SUPERSAMPLE; sampleX += 1) {
          const offset = (((y * SUPERSAMPLE + sampleY) * source.width)
            + x * SUPERSAMPLE + sampleX) * 4;
          for (let channel = 0; channel < 4; channel += 1) {
            channels[channel] += source.pixels[offset + channel];
          }
        }
      }
      const targetOffset = (y * width + x) * 4;
      for (let channel = 0; channel < 4; channel += 1) {
        target.pixels[targetOffset + channel] = Math.round(channels[channel] / samples);
      }
    }
  }
  return target;
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

function encodePng(canvas) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(canvas.width, 0);
  header.writeUInt32BE(canvas.height, 4);
  header[8] = 8;
  header[9] = 6;
  const rowBytes = canvas.width * 4 + 1;
  const rows = Buffer.alloc(canvas.height * rowBytes);
  for (let y = 0; y < canvas.height; y += 1) {
    const rowOffset = y * rowBytes;
    rows[rowOffset] = 0;
    canvas.pixels.copy(rows, rowOffset + 1, y * canvas.width * 4, (y + 1) * canvas.width * 4);
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk("IHDR", header),
    pngChunk("IDAT", zlib.deflateSync(rows, { level: 9 })),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

function renderLarge({ dark }) {
  const scale = SUPERSAMPLE;
  const canvas = makeCanvas(LARGE_WIDTH * scale, LARGE_HEIGHT * scale);
  const colors = dark ? {
    top: parseHex("#17141C"),
    bottom: parseHex("#201B28"),
    surface: parseHex("#2F2937"),
    foreground: parseHex("#F4DFBB"),
    accent: parseHex("#D66D4B"),
    center: parseHex("#FFF5E2"),
  } : {
    top: parseHex("#332C3C"),
    bottom: parseHex("#282230"),
    surface: parseHex("#211C28"),
    foreground: parseHex("#F4DFBB"),
    accent: parseHex("#D66D4B"),
    center: parseHex("#FFF5E2"),
  };
  fillGradient(canvas, colors.top, colors.bottom);
  drawAuraMark(canvas, 240 * scale, 266 * scale, 152 * scale, colors);

  const spineWidth = 12 * scale;
  const segmentHeight = canvas.height / THEME_SPINE.length;
  THEME_SPINE.forEach((value, index) => {
    fillRect(canvas, canvas.width - spineWidth, index * segmentHeight, spineWidth,
      Math.ceil(segmentHeight), parseHex(value));
  });
  return downsample(canvas, LARGE_WIDTH, LARGE_HEIGHT);
}

function renderSmall({ dark }) {
  const scale = SUPERSAMPLE;
  const canvas = makeCanvas(SMALL_SIZE * scale, SMALL_SIZE * scale);
  const palette = {
    surface: parseHex(dark ? "#27212F" : "#2F2937"),
    foreground: parseHex("#F4DFBB"),
    accent: parseHex("#D66D4B"),
    center: parseHex("#FFF5E2"),
  };
  drawAuraMark(canvas, 64 * scale, 64 * scale, 112 * scale, palette);
  return downsample(canvas, SMALL_SIZE, SMALL_SIZE);
}

async function writeArtwork(outputDirectory, name, canvas) {
  const bytes = encodePng(canvas);
  const outputPath = path.join(outputDirectory, name);
  await fs.writeFile(outputPath, bytes);
  return {
    outputPath,
    width: canvas.width,
    height: canvas.height,
    bytes: bytes.length,
    sha256: crypto.createHash("sha256").update(bytes).digest("hex"),
  };
}

export async function buildInstallerAssets({ outputDirectory = DEFAULT_OUTPUT_DIRECTORY } = {}) {
  await fs.mkdir(outputDirectory, { recursive: true });
  return {
    light: await writeArtwork(outputDirectory, "wizard-light.png", renderLarge({ dark: false })),
    dark: await writeArtwork(outputDirectory, "wizard-dark.png", renderLarge({ dark: true })),
    smallLight: await writeArtwork(outputDirectory, "wizard-small-light.png", renderSmall({ dark: false })),
    smallDark: await writeArtwork(outputDirectory, "wizard-small-dark.png", renderSmall({ dark: true })),
    themeSpine: [...THEME_SPINE],
  };
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : "";
if (invokedPath === import.meta.url) {
  console.log(JSON.stringify(await buildInstallerAssets(), null, 2));
}
