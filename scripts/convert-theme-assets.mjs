#!/usr/bin/env node
// Derives optimized runtime WebP copies from the supplied per-theme source
// kits (directories under themes/) using a headless browser's canvas encoder.
// No npm dependencies; everything stays on 127.0.0.1.
//
//   node scripts/convert-theme-assets.mjs [theme-id]
//   node scripts/convert-theme-assets.mjs --card-previews [theme-id]
//
// Omitting theme-id converts every theme listed below. Direct-copy assets
// (already-optimized kit outputs) are listed under `copies`.
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const MODULE_PATH = fileURLToPath(import.meta.url);
const PROJECT_ROOT = path.resolve(path.dirname(MODULE_PATH), "..");

const EDGE_PATHS = [
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
];

// Kit locations are where the user supplied them; do not move kit files.
const THEMES = {
  "japanese-film-editorial": {
    sourceDir: path.join(PROJECT_ROOT, "themes", "japanese-film-editorial"),
    outputDir: path.join(PROJECT_ROOT, "assets", "theme-art", "japanese-film-editorial"),
    jobs: [
      {
        src: "asset-01-02/after/background-atmosphere-japanese-prestige-compressed.webp",
        out: "light-background.webp", width: 1600, height: 900, quality: 0.8,
      },
      {
        src: "provisional/selected/dark-background.png",
        out: "dark-background.webp", width: 1600, height: 900, quality: 0.8,
      },
      {
        src: "provisional/selected/hero-no-sun.png",
        out: "light-hero.webp", width: 720, height: 1018, cropLeft: 0, quality: 0.82,
      },
      {
        src: "provisional/selected/dark-hero.png",
        out: "dark-hero.webp", width: 720, height: 1018, cropLeft: 0, quality: 0.82,
      },
    ],
    copies: [],
    required: true,
  },
  "korean-prestige": {
    sourceDir: path.join(PROJECT_ROOT, "themes", "korean-prestige"),
    outputDir: path.join(PROJECT_ROOT, "assets", "theme-art", "korean-prestige"),
    jobs: [
      {
        src: "provisional/selected/light-background.png",
        out: "light-background.webp", width: 1600, height: 900, quality: 0.8,
      },
      {
        src: "provisional/selected/light-hero.png",
        out: "light-hero.webp", width: 720, cropLeft: 0, quality: 0.82,
      },
      {
        src: "provisional/selected/dark-hero.png",
        out: "dark-hero.webp", width: 720, cropLeft: 0, quality: 0.82,
      },
    ],
    copies: [
      {
        src: "korean-prestige-final-v1.0/assets/02-background/korean-prestige-background@2x.webp",
        out: "dark-background.webp",
      },
    ],
    required: true,
  },
  "anime-twilight": {
    sourceDir: path.join(PROJECT_ROOT, "themes", "anime-twilight"),
    outputDir: path.join(PROJECT_ROOT, "assets", "theme-art", "anime-twilight"),
    jobs: [
      { src: "provisional/selected/background.png", out: "background.webp", width: 1600, cropLeft: 0, quality: 0.78 },
    ],
    copies: [],
    required: true,
  },
  "cartoon-studio": {
    sourceDir: path.join(PROJECT_ROOT, "themes", "cartoon-studio"),
    outputDir: path.join(PROJECT_ROOT, "assets", "theme-art", "cartoon-studio"),
    jobs: [
      { src: "provisional/selected/background.png", out: "background.webp", width: 1600, cropLeft: 0, quality: 0.78 },
      {
        src: "provisional/selected/dark-background.png",
        out: "dark-background.webp", width: 1600, height: 900, quality: 0.8,
      },
      { src: "provisional/selected/hero.png", out: "hero.webp", width: 840, cropLeft: 0, quality: 0.82 },
    ],
    copies: [],
    required: true,
  },
  "study-library": {
    sourceDir: path.join(PROJECT_ROOT, "themes", "study-library"),
    outputDir: path.join(PROJECT_ROOT, "assets", "theme-art", "study-library"),
    jobs: [
      { src: "provisional/selected/background.png", out: "background.webp", width: 1600, cropLeft: 0, quality: 0.78 },
      {
        src: "provisional/selected/dark-background.png",
        out: "dark-background.webp", width: 1600, height: 900, quality: 0.8,
      },
      { src: "provisional/selected/corner-bottom.png", out: "corner-bottom.webp", width: 640, cropLeft: 0, quality: 0.82 },
    ],
    copies: [],
    required: true,
  },
  "japanese-idol": {
    sourceDir: path.join(PROJECT_ROOT, "themes", "japanese-idol"),
    outputDir: path.join(PROJECT_ROOT, "assets", "theme-art", "kawaii-idol"),
    jobs: [
      { src: "atmospheric-background.png", out: "background.webp", width: 1600, cropLeft: 0, quality: 0.78 },
      { src: "claude-kawaii-hero.png", out: "hero.webp", width: 1080, cropLeft: 0.28, quality: 0.8 },
      {
        src: "provisional/selected/dark-new-chat.png",
        out: "dark-new-chat.webp", width: 1600, height: 900, quality: 0.82,
      },
      {
        src: "provisional/selected/dark-conversation.png",
        out: "dark-conversation.webp", width: 1600, height: 900, quality: 0.82,
      },
    ],
    copies: [],
    required: true,
  },
  "korean-idol": {
    sourceDir: path.join(PROJECT_ROOT, "themes", "korean-idol"),
    outputDir: path.join(PROJECT_ROOT, "assets", "theme-art", "korean-idol"),
    jobs: [
      {
        src: "Kpop_Claude_Asset_02_Atmospheric_Background_Raster_v2/assets/kpop-atmosphere@1x.png",
        out: "light-scene.webp", width: 1672, cropLeft: 0, baseOpacity: 0.6, quality: 0.8,
        overlays: [{
          src: "Kpop_Claude_Asset_04_Hero_Constellation_Raster_v2/assets/kpop-hero-constellation@1x.png",
          width: 720, x: 952, y: 0, opacity: 0.85,
        }],
      },
      { src: "provisional/selected/dark-new-chat.png", out: "dark-new-chat.webp", width: 1672, cropLeft: 0, quality: 0.82 },
      { src: "provisional/selected/dark-conversation.png", out: "dark-conversation.webp", width: 1672, cropLeft: 0, quality: 0.82 },
    ],
    copies: [
      { src: "Kpop_Claude_Asset_03_Hero_Portrait_Raster_v2/assets/kpop-hero-portrait@1x.webp", out: "hero.webp" },
    ],
    required: true,
  },
};

// Legacy selector thumbnails derived from preserved Studio preview masters.
// Aura Studio now loads the uncropped PNG masters directly and applies framing
// metadata at display time. This compatibility command never modifies a master.
const STUDIO_PREVIEW_MASTER_ROOT = path.join(PROJECT_ROOT, "assets", "studio-previews", "masters");
const CARD_PREVIEWS = {
  "japanese-film-editorial": {
    sourceDir: STUDIO_PREVIEW_MASTER_ROOT,
    src: "japanese-film-editorial.png",
    cropPixels: { x: 1000, y: 60, width: 448, height: 252 },
  },
  "korean-prestige": {
    sourceDir: STUDIO_PREVIEW_MASTER_ROOT,
    src: "korean-prestige.png",
    cropPixels: { x: 1020, y: 55, width: 500, height: 281 },
  },
  "cartoon-studio": {
    sourceDir: STUDIO_PREVIEW_MASTER_ROOT,
    src: "cartoon-studio.png",
    cropPixels: { x: 1200, y: 70, width: 448, height: 252 },
  },
  "anime-twilight": {
    sourceDir: STUDIO_PREVIEW_MASTER_ROOT,
    src: "anime-twilight.png",
    cropPixels: { x: 1150, y: 55, width: 500, height: 281 },
  },
  "study-library": {
    sourceDir: path.join(PROJECT_ROOT, "themes", "study-library"),
    src: "provisional/selected/background.png",
    overlays: [
      { src: "provisional/selected/corner-bottom.png", width: 360, x: 52, bottom: 0 },
    ],
  },
  "japanese-idol": {
    sourceDir: STUDIO_PREVIEW_MASTER_ROOT,
    src: "japanese-idol.png",
    cropPixels: { x: 1070, y: 60, width: 512, height: 288 },
  },
  "korean-idol": {
    sourceDir: STUDIO_PREVIEW_MASTER_ROOT,
    src: "korean-idol.png",
    cropPixels: { x: 1010, y: 80, width: 480, height: 270 },
  },
};

async function findEdge() {
  for (const candidate of EDGE_PATHS) {
    try { await fs.access(candidate); return candidate; } catch { /* next */ }
  }
  throw new Error("Microsoft Edge is required for asset conversion");
}

function pathIsWithin(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === "" || (!path.isAbsolute(relative) && relative !== ".." && !relative.startsWith(`..${path.sep}`));
}

function detectStudioImage(bytes) {
  if (bytes.length >= 8 && bytes.subarray(0, 8).toString("hex") === "89504e470d0a1a0a") return "image/png";
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 12 && bytes.subarray(0, 4).toString("ascii") === "RIFF"
      && bytes.subarray(8, 12).toString("ascii") === "WEBP") return "image/webp";
  if (bytes.length >= 16 && bytes.subarray(4, 8).toString("ascii") === "ftyp") {
    const brands = new Set([bytes.subarray(8, 12).toString("ascii")]);
    const declaredLength = bytes.readUInt32BE(0);
    const limit = Math.min(bytes.length, declaredLength >= 16 ? declaredLength : bytes.length);
    for (let offset = 16; offset + 4 <= limit; offset += 4) brands.add(bytes.subarray(offset, offset + 4).toString("ascii"));
    if (brands.has("avif") || brands.has("avis")) return "image/avif";
  }
  return null;
}

export async function convertStudioImport({ source, target, outputRoot }) {
  if (![source, target, outputRoot].every((value) => typeof value === "string" && value.trim())) {
    throw new Error("Studio import paths are required");
  }
  const resolvedSource = path.resolve(source);
  const resolvedTarget = path.resolve(target);
  const resolvedRoot = path.resolve(outputRoot);
  const [sourceStat, rootStat] = await Promise.all([fs.lstat(resolvedSource), fs.lstat(resolvedRoot)]);
  if (!sourceStat.isFile() || sourceStat.isSymbolicLink() || sourceStat.size <= 0 || sourceStat.size > 16 * 1024 * 1024) {
    throw new Error("Studio artwork must be a regular image file no larger than 16 MB");
  }
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) throw new Error("Studio output root must be a regular folder");
  if (!pathIsWithin(resolvedRoot, resolvedTarget)
      || path.extname(resolvedTarget).toLowerCase() !== ".webp"
      || !/^layer-[0-9a-f]{32}\.webp$/.test(path.basename(resolvedTarget))) {
    throw new Error("Studio artwork target is not allowed");
  }
  const targetParent = path.dirname(resolvedTarget);
  const parentStat = await fs.lstat(targetParent);
  if (!parentStat.isDirectory() || parentStat.isSymbolicLink()) throw new Error("Studio artwork folder must be a regular folder");
  const [realRoot, realParent] = await Promise.all([fs.realpath(resolvedRoot), fs.realpath(targetParent)]);
  if (!pathIsWithin(realRoot, realParent)) throw new Error("Studio artwork target must remain inside the editor root");

  const sourceBytes = await fs.readFile(resolvedSource);
  const detectedMime = detectStudioImage(sourceBytes);
  const expectedMime = new Map([
    [".png", "image/png"], [".jpg", "image/jpeg"], [".jpeg", "image/jpeg"],
    [".webp", "image/webp"], [".avif", "image/avif"],
  ]).get(path.extname(resolvedSource).toLowerCase());
  if (!expectedMime || detectedMime !== expectedMime) throw new Error("Studio artwork type does not match its file extension");
  const edge = await findEdge();

  const page = `<!doctype html><meta charset="utf-8"><script>
  const image = new Image();
  image.onload = async () => {
    try {
      const largest = Math.max(image.naturalWidth, image.naturalHeight);
      const initialScale = Math.min(1, 2400 / largest);
      const qualities = [0.84, 0.72, 0.6];
      let selected = null;
      let selectedWidth = 0;
      let selectedHeight = 0;
      for (let step = 0; step < 18 && !selected; step += 1) {
        const scale = initialScale * Math.pow(0.84, Math.floor(step / qualities.length));
        const width = Math.max(1, Math.round(image.naturalWidth * scale));
        const height = Math.max(1, Math.round(image.naturalHeight * scale));
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const context = canvas.getContext("2d", { alpha: true });
        context.imageSmoothingEnabled = true;
        context.imageSmoothingQuality = "high";
        context.drawImage(image, 0, 0, width, height);
        const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/webp", qualities[step % qualities.length]));
        if (blob && blob.size > 0 && blob.size < 400000) {
          selected = blob;
          selectedWidth = width;
          selectedHeight = height;
        }
      }
      if (!selected) throw new Error("The image could not be reduced below 400 KB");
      const response = await fetch("/out", {
        method: "POST",
        headers: { "X-Aura-Width": String(selectedWidth), "X-Aura-Height": String(selectedHeight) },
        body: selected,
      });
      if (!response.ok) throw new Error("The converted image was rejected");
    } catch (error) {
      await fetch("/fail", { method: "POST", body: String(error) });
    }
  };
  image.onerror = () => fetch("/fail", { method: "POST", body: "The image could not be decoded" });
  image.src = "/source";
  </script>`;

  let finish;
  const finished = new Promise((resolve) => { finish = resolve; });
  const server = http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url, "http://127.0.0.1");
      if (request.method === "GET" && url.pathname === "/") {
        response.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" }).end(page);
      } else if (request.method === "GET" && url.pathname === "/source") {
        response.writeHead(200, { "Content-Type": detectedMime, "Cache-Control": "no-store" }).end(sourceBytes);
      } else if (request.method === "POST" && url.pathname === "/out") {
        const chunks = [];
        let length = 0;
        for await (const chunk of request) {
          length += chunk.length;
          if (length >= 400_000) throw new Error("Converted Studio artwork exceeds 400 KB");
          chunks.push(chunk);
        }
        const bytes = Buffer.concat(chunks);
        if (detectStudioImage(bytes) !== "image/webp") throw new Error("Converted Studio artwork is not WebP");
        const width = Number(request.headers["x-aura-width"]);
        const height = Number(request.headers["x-aura-height"]);
        if (!Number.isInteger(width) || width < 1 || !Number.isInteger(height) || height < 1) {
          throw new Error("Converted Studio artwork dimensions are invalid");
        }
        response.writeHead(200).end();
        finish({ bytes, width, height });
      } else if (request.method === "POST" && url.pathname === "/fail") {
        const chunks = [];
        for await (const chunk of request) chunks.push(chunk);
        response.writeHead(200).end();
        finish({ error: Buffer.concat(chunks).toString("utf8").slice(0, 500) });
      } else {
        response.writeHead(404).end();
      }
    } catch (error) {
      response.writeHead(400).end();
      finish({ error: error.message });
    }
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const profile = await fs.mkdtemp(path.join(resolvedRoot, ".studio-import-"));
  const child = spawn(edge, [
    "--headless=new", "--disable-gpu", "--no-first-run", "--disable-extensions",
    `--user-data-dir=${profile}`, `http://127.0.0.1:${server.address().port}/`,
  ], { stdio: "ignore", windowsHide: true });
  const exited = new Promise((resolve) => child.once("exit", resolve));
  child.once("error", (error) => finish({ error: `Studio artwork converter could not start: ${error.message}` }));
  child.once("exit", (code) => finish({ error: `Studio artwork converter exited before completion (${code ?? "unknown"})` }));
  const timeout = setTimeout(() => finish({ error: "Studio artwork conversion timed out" }), 60_000);
  const result = await finished;
  clearTimeout(timeout);
  if (child.exitCode === null) child.kill();
  await Promise.race([exited, new Promise((resolve) => setTimeout(resolve, 5000))]);
  await new Promise((resolve) => server.close(resolve));
  await fs.rm(profile, { recursive: true, force: true });
  if (result.error) throw new Error(result.error);

  const temporary = `${resolvedTarget}.tmp-${process.pid}-${Date.now()}`;
  await fs.writeFile(temporary, result.bytes, { flag: "wx", mode: 0o600 });
  try {
    await fs.rename(temporary, resolvedTarget);
  } catch (error) {
    await fs.rm(temporary, { force: true });
    throw error;
  }
  return { path: resolvedTarget, bytes: result.bytes.length, width: result.width, height: result.height };
}

async function convertTheme(themeId, config) {
  const missing = [];
  const sourceNames = [
    ...config.jobs.flatMap((job) => [job.src, ...(job.overlays ?? []).map((overlay) => overlay.src)]),
    ...config.copies.map((copy) => copy.src),
  ];
  for (const sourceName of sourceNames) {
    try { await fs.access(path.join(config.sourceDir, sourceName)); } catch { missing.push(sourceName); }
  }
  if (missing.length) {
    if (config.required) {
      throw new Error(`${themeId}: required source files are missing:\n  ${missing.join("\n  ")}`);
    }
    console.warn(`${themeId}: skipping — kit files missing:\n  ${missing.join("\n  ")}`);
    return;
  }
  await fs.mkdir(config.outputDir, { recursive: true });

  for (const copy of config.copies) {
    await fs.copyFile(path.join(config.sourceDir, copy.src), path.join(config.outputDir, copy.out));
    const stat = await fs.stat(path.join(config.outputDir, copy.out));
    console.log(`${themeId}: copied ${copy.out} (${stat.size} bytes)`);
  }
  if (!config.jobs.length) return;

  const page = `<!doctype html><meta charset="utf-8"><script>
  const jobs = ${JSON.stringify(config.jobs)};
  const loadImage = (src) => new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(src));
    img.src = "/src/" + encodeURIComponent(src);
  });
  (async () => {
    for (const job of jobs) {
      const img = await loadImage(job.src);
      let sx = job.cropPixels ? job.cropPixels.x : Math.round(img.naturalWidth * (job.cropLeft || 0));
      let sy = job.cropPixels ? job.cropPixels.y : 0;
      let sw = job.cropPixels ? job.cropPixels.width : img.naturalWidth - sx;
      let sh = job.cropPixels ? job.cropPixels.height : img.naturalHeight;
      let w, h;
      if (job.height) {
        const targetRatio = job.width / job.height;
        if ((sw / sh) > targetRatio) {
          const croppedWidth = Math.round(sh * targetRatio);
          sx += Math.round((sw - croppedWidth) / 2);
          sw = croppedWidth;
        } else {
          const croppedHeight = Math.round(sw / targetRatio);
          sy += Math.round((sh - croppedHeight) / 2);
          sh = croppedHeight;
        }
        w = job.width;
        h = job.height;
      } else {
        const scale = Math.min(1, job.width / sw);
        w = Math.round(sw * scale);
        h = Math.round(sh * scale);
      }
      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext("2d");
      ctx.imageSmoothingQuality = "high";
      ctx.globalAlpha = job.baseOpacity ?? 1;
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, w, h);
      ctx.globalAlpha = 1;
      for (const overlay of job.overlays ?? []) {
        const overlayImage = await loadImage(overlay.src);
        const overlayWidth = overlay.width;
        const overlayHeight = Math.round(overlayImage.naturalHeight * overlayWidth / overlayImage.naturalWidth);
        const overlayX = overlay.x ?? 0;
        const overlayY = overlay.y ?? h - overlayHeight - (overlay.bottom ?? 0);
        ctx.globalAlpha = overlay.opacity ?? 1;
        ctx.drawImage(overlayImage, overlayX, overlayY, overlayWidth, overlayHeight);
        ctx.globalAlpha = 1;
      }
      const blob = await new Promise((res) => canvas.toBlob(res, "image/webp", job.quality));
      await fetch("/out/" + encodeURIComponent(job.out), { method: "POST", body: blob });
    }
    await fetch("/done", { method: "POST" });
  })().catch((error) => fetch("/fail", { method: "POST", body: String(error) }));
  </script>`;

  let finish;
  const finished = new Promise((resolve) => { finish = resolve; });
  const allowedSources = new Set(config.jobs.flatMap((job) => [
    job.src,
    ...(job.overlays ?? []).map((overlay) => overlay.src),
  ]));
  const server = http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url, "http://127.0.0.1");
      if (request.method === "GET" && url.pathname === "/") {
        response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" }).end(page);
      } else if (request.method === "GET" && url.pathname.startsWith("/src/")) {
        const name = decodeURIComponent(url.pathname.slice(5));
        if (!allowedSources.has(name)) { response.writeHead(403).end(); return; }
        const lowerName = name.toLowerCase();
        const isSvg = lowerName.endsWith(".svg");
        let sourceBytes = await fs.readFile(path.join(config.sourceDir, name));
        if (isSvg) {
          const sourceText = sourceBytes.toString("utf8");
          const viewBox = sourceText.match(/viewBox=["']0 0 ([\d.]+) ([\d.]+)["']/i);
          if (viewBox) {
            sourceBytes = Buffer.from(sourceText.replace(/<svg\b/, `<svg width="${viewBox[1]}" height="${viewBox[2]}"`), "utf8");
          }
        }
        const contentType = isSvg ? "image/svg+xml"
          : lowerName.endsWith(".webp") ? "image/webp"
          : lowerName.endsWith(".avif") ? "image/avif"
          : lowerName.endsWith(".jpg") || lowerName.endsWith(".jpeg") ? "image/jpeg"
          : "image/png";
        response.writeHead(200, { "Content-Type": contentType }).end(sourceBytes);
      } else if (request.method === "POST" && url.pathname.startsWith("/out/")) {
        const name = decodeURIComponent(url.pathname.slice(5));
        if (!config.jobs.some((job) => job.out === name)) { response.writeHead(403).end(); return; }
        const chunks = [];
        for await (const chunk of request) chunks.push(chunk);
        await fs.writeFile(path.join(config.outputDir, name), Buffer.concat(chunks));
        console.log(`${themeId}: wrote ${name} (${Buffer.concat(chunks).length} bytes)`);
        response.writeHead(200).end();
      } else if (request.method === "POST" && (url.pathname === "/done" || url.pathname === "/fail")) {
        if (url.pathname === "/fail") {
          const chunks = [];
          for await (const chunk of request) chunks.push(chunk);
          console.error(`${themeId}: converter page failed: ${Buffer.concat(chunks)}`);
          process.exitCode = 1;
        }
        response.writeHead(200).end();
        finish();
      } else {
        response.writeHead(404).end();
      }
    } catch (error) {
      console.error(error.message);
      response.writeHead(500).end();
    }
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const edge = await findEdge();
  const profile = path.join(config.outputDir, ".convert-profile");
  const child = spawn(edge, [
    "--headless=new", "--disable-gpu", "--no-first-run",
    `--user-data-dir=${profile}`, `http://127.0.0.1:${server.address().port}/`,
  ], { stdio: "ignore" });
  const timeout = setTimeout(() => { console.error(`${themeId}: conversion timed out`); process.exitCode = 1; finish(); }, 90_000);
  await finished;
  clearTimeout(timeout);
  const exited = new Promise((resolve) => child.once("exit", resolve));
  child.kill();
  await Promise.race([exited, new Promise((resolve) => setTimeout(resolve, 5000))]);
  server.close();
  await fs.rm(profile, { recursive: true, force: true })
    .catch(() => console.warn(`${themeId}: profile cleanup skipped; remove .convert-profile manually`));
}

async function runCli(args) {
  const studioImport = args[0] === "--studio-import";
  const studioImportOptions = studioImport ? (() => {
    if (args.length !== 6 || args[2] !== "--target" || args[4] !== "--output-root") {
      throw new Error("Usage: convert-theme-assets --studio-import <source> --target <target.webp> --output-root <folder>");
    }
    return { source: args[1], target: args[3], outputRoot: args[5] };
  })() : null;
  const cardsOnly = !studioImport && args[0] === "--card-previews";
  const requested = studioImport ? null : cardsOnly ? args[1] : args[0];
  const knownThemeIds = Object.keys(cardsOnly ? CARD_PREVIEWS : THEMES);
  if (requested && !knownThemeIds.includes(requested)) {
    const hint = !cardsOnly && Object.hasOwn(CARD_PREVIEWS, requested)
      ? "; use --card-previews for Studio selector assets"
      : "";
    throw new Error(`Unknown theme "${requested}"; known: ${knownThemeIds.join(", ")}${hint}`);
  }
  const selection = studioImport || cardsOnly ? {} : requested
    ? (THEMES[requested] ? { [requested]: THEMES[requested] } : {})
    : THEMES;
  const cardSelection = cardsOnly
    ? requested
      ? (CARD_PREVIEWS[requested] ? { [requested]: CARD_PREVIEWS[requested] } : {})
      : CARD_PREVIEWS
    : {};

  if (studioImport) {
    console.log(JSON.stringify(await convertStudioImport(studioImportOptions)));
    return;
  }
  for (const [themeId, config] of Object.entries(selection)) {
    await convertTheme(themeId, config);
  }
  for (const [themeId, source] of Object.entries(cardSelection)) {
    await convertTheme(`${themeId} card preview`, {
      sourceDir: source.sourceDir,
      outputDir: path.join(PROJECT_ROOT, "assets", "theme-art", themeId),
      jobs: [{
        src: source.src,
        out: "card-preview.webp",
        width: 640,
        height: 360,
        cropPixels: source.cropPixels,
        overlays: source.overlays,
        quality: 0.82,
      }],
      copies: [],
      required: true,
    });
  }
  console.log("done");
}

if (process.argv[1] && path.resolve(process.argv[1]) === MODULE_PATH) {
  await runCli(process.argv.slice(2));
}
