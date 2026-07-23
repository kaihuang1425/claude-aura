#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  decodePng,
  encodePng,
  resizeRgba,
  writeGeneratedFile,
} from "./build-launcher-assets.mjs";
import {
  FROZEN_BUILTIN_THEME_IDS,
  PROJECT_ROOT,
} from "./theme-core/constants.mjs";
import { listThemes } from "./theme-core/registry.mjs";
import { hslRgb } from "./theme-core/validation.mjs";

const WIDTH = 344;
const HEIGHT = 124;
const CONTENT_WIDTH = 324;
const CONTENT_HEIGHT = 94;
const SOURCE_ROOT = path.join(
  PROJECT_ROOT,
  "assets",
  "studio-previews",
  "references",
  "in-page-brand-wordmarks-v1",
);
const OUTPUT_ROOT = path.join(PROJECT_ROOT, "assets", "theme-art");

const THEMES = Object.freeze([...FROZEN_BUILTIN_THEME_IDS]);
const SOURCE_SHA256 = Object.freeze({
  "default": "96ad41314066cd33d5def46ecc2197c5ab738ddd98a3b8e1ccdd714da866c481",
  "japanese-film-editorial": "f7f5765723242c25280d5fc3e319aaade80fec83240daa031b354215f7294c7f",
  "korean-prestige": "8e926b6e9f1acae0a4db5bdca038418e6aec84e964dafa380dd96dad45d197f3",
  "cartoon-studio": "e78bd1406f7b259bc3354c8cf96b443978a0e3d87dbf30dafbeb5e5085948dc6",
  "anime-twilight": "b3ac02ba861525159a057f0e1a684aa148e5df2714bdd986b60049e42661dde6",
  "study-library": "4d7c7fedae2e9cf5c91d64e06806746563d7d31bc0c9f5c2a93c9fd9e08e6fca",
  "japanese-idol": "1428e1c7665ed31fc37a489dfa4b90c23ba4769f57aa6631a5b20b0f53e4e147",
  "korean-idol": "f318ad08013dd500351997d4dfb57706c338ff4d58ce3448d050b4ccccb607ba",
});

const SOURCE_PROFILE = Object.freeze({
  "default": Object.freeze({ mode: "light", tone: "dark" }),
  "japanese-film-editorial": Object.freeze({ mode: "light", tone: "dark" }),
  "korean-prestige": Object.freeze({ mode: "dark", tone: "light" }),
  "cartoon-studio": Object.freeze({ mode: "light", tone: "dark" }),
  "anime-twilight": Object.freeze({ mode: "dark", tone: "light" }),
  "study-library": Object.freeze({ mode: "light", tone: "dark" }),
  "japanese-idol": Object.freeze({ mode: "light", tone: "dark" }),
  "korean-idol": Object.freeze({ mode: "light", tone: "dark" }),
});

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function clamp(value, minimum = 0, maximum = 255) {
  return Math.max(minimum, Math.min(maximum, value));
}

function luma(red, green, blue) {
  return (red * 0.2126) + (green * 0.7152) + (blue * 0.0722);
}

function blend(channel, target, amount) {
  return Math.round((channel * (1 - amount)) + (target * amount));
}

function adaptForDark(source, target) {
  const pixels = Buffer.alloc(source.length);
  for (let offset = 0; offset < source.length; offset += 4) {
    const alpha = source[offset + 3];
    if (alpha === 0) continue;
    const red = source[offset];
    const green = source[offset + 1];
    const blue = source[offset + 2];
    const brightness = luma(red, green, blue);
    const saturation = Math.max(red, green, blue) - Math.min(red, green, blue);
    let amount = 0;
    if (saturation < 38 && brightness >= 205) amount = 0.42;
    else if (saturation < 38 && brightness < 205) amount = 0.78;
    else if (brightness < 128) amount = saturation >= 38 ? 0.38 : 0.64;
    else if (brightness < 174) amount = 0.16;
    pixels[offset] = blend(red, target[0], amount);
    pixels[offset + 1] = blend(green, target[1], amount);
    pixels[offset + 2] = blend(blue, target[2], amount);
    pixels[offset + 3] = alpha;
  }
  return pixels;
}

function adaptForLight(source, target) {
  const pixels = Buffer.alloc(source.length);
  for (let offset = 0; offset < source.length; offset += 4) {
    const alpha = source[offset + 3];
    if (alpha === 0) continue;
    const red = source[offset];
    const green = source[offset + 1];
    const blue = source[offset + 2];
    const brightness = luma(red, green, blue);
    const saturation = Math.max(red, green, blue) - Math.min(red, green, blue);
    if (saturation < 42) {
      const amount = brightness > 180 ? 0.82 : 0.64;
      pixels[offset] = blend(red, target[0], amount);
      pixels[offset + 1] = blend(green, target[1], amount);
      pixels[offset + 2] = blend(blue, target[2], amount);
    } else if (brightness > 145) {
      const scale = 132 / brightness;
      pixels[offset] = Math.round(clamp(red * scale));
      pixels[offset + 1] = Math.round(clamp(green * scale));
      pixels[offset + 2] = Math.round(clamp(blue * scale));
    } else {
      pixels[offset] = red;
      pixels[offset + 1] = green;
      pixels[offset + 2] = blue;
    }
    pixels[offset + 3] = alpha;
  }
  return pixels;
}

function removeGreenScreen(model) {
  const pixels = Buffer.alloc(model.pixels.length);
  for (let offset = 0; offset < model.pixels.length; offset += 4) {
    const red = model.pixels[offset];
    const green = model.pixels[offset + 1];
    const blue = model.pixels[offset + 2];
    const sourceAlpha = model.pixels[offset + 3] / 255;
    const greenDominance = green - Math.max(red, blue);
    let coverage = clamp((100 - greenDominance) / 60, 0, 1) * sourceAlpha;
    if (coverage < 0.018) coverage = 0;
    else if (coverage > 0.985) coverage = 1;
    if (coverage === 0) continue;
    pixels[offset] = Math.round(clamp(red / coverage));
    pixels[offset + 1] = Math.round(clamp((green - ((1 - coverage) * 255)) / coverage));
    pixels[offset + 2] = Math.round(clamp(blue / coverage));
    pixels[offset + 3] = Math.round(coverage * 255);
  }
  return { ...model, pixels };
}

function visibleBounds(model) {
  let left = model.width;
  let top = model.height;
  let right = -1;
  let bottom = -1;
  let visiblePixels = 0;
  for (let y = 0; y < model.height; y += 1) {
    for (let x = 0; x < model.width; x += 1) {
      if (model.pixels[((y * model.width + x) * 4) + 3] < 12) continue;
      visiblePixels += 1;
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x);
      bottom = Math.max(bottom, y);
    }
  }
  if (visiblePixels < 1_000) throw new Error("Wordmark source has too few visible pixels");
  return {
    left,
    top,
    right,
    bottom,
    width: right - left + 1,
    height: bottom - top + 1,
  };
}

function cropModel(model, bounds) {
  const margin = Math.max(3, Math.round(Math.max(bounds.width, bounds.height) * 0.008));
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

function normalizeSource(model) {
  const cropped = cropModel(model, visibleBounds(model));
  const scale = Math.min(CONTENT_WIDTH / cropped.width, CONTENT_HEIGHT / cropped.height);
  const width = Math.max(1, Math.round(cropped.width * scale));
  const height = Math.max(1, Math.round(cropped.height * scale));
  const resized = resizeRgba(cropped, width, height);
  const pixels = Buffer.alloc(WIDTH * HEIGHT * 4);
  const left = Math.floor((WIDTH - width) / 2);
  const top = Math.floor((HEIGHT - height) / 2);
  for (let y = 0; y < height; y += 1) {
    resized.copy(
      pixels,
      ((top + y) * WIDTH + left) * 4,
      y * width * 4,
      (y + 1) * width * 4,
    );
  }
  return { width: WIDTH, height: HEIGHT, pixels };
}

export async function prepareBrandWordmarkSource({
  sourcePath,
  outputPath,
  chromaKey = false,
}) {
  const sourceBytes = await fs.readFile(sourcePath);
  const decoded = decodePng(sourceBytes, `Wordmark source ${sourcePath}`);
  const normalized = normalizeSource(chromaKey ? removeGreenScreen(decoded) : decoded);
  const outputBytes = encodePng(normalized.width, normalized.height, normalized.pixels);
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await writeGeneratedFile(outputPath, outputBytes);
  return {
    sourcePath,
    outputPath,
    width: normalized.width,
    height: normalized.height,
    bytes: outputBytes.length,
    sha256: sha256(outputBytes),
  };
}

export async function buildBrandWordmarks({
  sourceRoot = SOURCE_ROOT,
  outputRoot = OUTPUT_ROOT,
} = {}) {
  const results = [];
  const themes = new Map((await listThemes()).map((theme) => [theme.name, theme]));
  for (const theme of THEMES) {
    const sourcePath = path.join(sourceRoot, `${theme}.png`);
    const sourceBytes = await fs.readFile(sourcePath);
    const sourceHash = sha256(sourceBytes);
    if (sourceHash !== SOURCE_SHA256[theme]) {
      throw new Error(`${theme} wordmark source digest changed: ${sourceHash}`);
    }
    const model = decodePng(sourceBytes, `${theme} wordmark source`);
    if (model.width !== WIDTH || model.height !== HEIGHT) {
      throw new Error(`${theme} wordmark source must be the approved ${WIDTH}x${HEIGHT} PNG`);
    }
    visibleBounds(model);

    const registeredTheme = themes.get(theme);
    if (!registeredTheme) throw new Error(`${theme} is missing from the built-in theme registry`);
    const sourceProfile = SOURCE_PROFILE[theme];
    const render = (appearance) => {
      const ink = hslRgb(registeredTheme[appearance].semantic["--aura-sidebar-text-primary"])
        .map((channel) => Math.round(channel * 255));
      const tone = luma(...ink) >= 128 ? "light" : "dark";
      if (sourceProfile.mode === appearance && sourceProfile.tone === tone) return sourceBytes;
      const pixels = tone === "light"
        ? adaptForDark(model.pixels, ink)
        : adaptForLight(model.pixels, ink);
      return encodePng(WIDTH, HEIGHT, pixels);
    };
    const lightBytes = render("light");
    const darkBytes = render("dark");
    if (lightBytes.equals(darkBytes)) throw new Error(`${theme} Light and Dark wordmarks must differ`);

    const outputDirectory = path.join(outputRoot, theme);
    const lightPath = path.join(outputDirectory, "brand-wordmark-light.png");
    const darkPath = path.join(outputDirectory, "brand-wordmark-dark.png");
    await fs.mkdir(outputDirectory, { recursive: true });
    await Promise.all([
      writeGeneratedFile(lightPath, lightBytes),
      writeGeneratedFile(darkPath, darkBytes),
    ]);
    results.push({
      theme,
      sourcePath,
      sourceSha256: sourceHash,
      width: model.width,
      height: model.height,
      light: { path: lightPath, bytes: lightBytes.length, sha256: sha256(lightBytes) },
      dark: { path: darkPath, bytes: darkBytes.length, sha256: sha256(darkBytes) },
    });
  }
  return results;
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : "";
if (invokedPath === import.meta.url) console.log(JSON.stringify(await buildBrandWordmarks(), null, 2));
