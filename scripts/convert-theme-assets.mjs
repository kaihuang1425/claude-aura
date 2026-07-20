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
import { PROJECT_ROOT } from "./theme-core.mjs";

const EDGE_PATHS = [
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
];

// Kit locations are where the user supplied them; do not move kit files.
// NOTE: the kit directory themes/korean-prestige currently holds the
// KOREAN-IDOL asset packages (its approved concept is the lavender K-pop
// board); korean-prestige's own art is still awaited.
const THEMES = {
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
      { src: "claude-top-right-sakura-cluster-preview.png", out: "sakura-top-right.webp", width: 582, cropLeft: 0, quality: 0.85 },
      { src: "bottom-right-sakura-cluster.png", out: "sakura-bottom-right.webp", width: 641, cropLeft: 0, quality: 0.85 },
    ],
    copies: [],
  },
  "korean-idol": {
    sourceDir: path.join(PROJECT_ROOT, "themes", "korean-prestige"),
    outputDir: path.join(PROJECT_ROOT, "assets", "theme-art", "korean-idol"),
    jobs: [
      // The kit's lossless @1x atmosphere exceeds the 400 KB layer budget;
      // a lossy encode of the PNG master is visually identical at CSS size.
      {
        src: "Kpop_Claude_Asset_02_Atmospheric_Background_Raster_v2/assets/kpop-atmosphere@1x.png",
        out: "background.webp", width: 1672, cropLeft: 0, quality: 0.8,
      },
    ],
    copies: [
      { src: "Kpop_Claude_Asset_03_Hero_Portrait_Raster_v2/assets/kpop-hero-portrait@1x.webp", out: "hero.webp" },
      { src: "Kpop_Claude_Asset_04_Hero_Constellation_Raster_v2/assets/kpop-hero-constellation@1x.webp", out: "constellation.webp" },
    ],
  },
};

// Small, selector-only thumbnails derived from the supplied visual references
// or the theme's current isolated artwork. The opaque source screenshots remain
// gitignored and are never shipped or used as renderer backgrounds; only these
// compressed derivatives under assets/theme-art/<id>/ reach Aura Studio.
const CARD_PREVIEWS = {
  "japanese-film-editorial": {
    sourceDir: path.join(PROJECT_ROOT, "theme_demo_previews"),
    src: "Elegant Japanese-inspired app interface.png",
    cropPixels: { x: 1000, y: 60, width: 448, height: 252 },
  },
  "korean-prestige": {
    sourceDir: path.join(PROJECT_ROOT, "theme_demo_previews"),
    src: "Sleek dark mode app dashboard.png",
    cropPixels: { x: 1020, y: 55, width: 500, height: 281 },
  },
  "cartoon-studio": {
    sourceDir: path.join(PROJECT_ROOT, "theme_demo_previews"),
    src: "Claude's friendly productivity dashboard.png",
    cropPixels: { x: 1200, y: 70, width: 448, height: 252 },
  },
  "anime-twilight": {
    sourceDir: path.join(PROJECT_ROOT, "theme_demo_previews"),
    src: "c1cad58a-97a8-4dd1-8270-14a52658fa4f.png",
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
    sourceDir: path.join(PROJECT_ROOT, "theme_demo_previews"),
    src: "Kawaii idol-themed app interface.png",
    cropPixels: { x: 1070, y: 60, width: 512, height: 288 },
  },
  "korean-idol": {
    sourceDir: path.join(PROJECT_ROOT, "theme_demo_previews"),
    src: "Claude app interface with K-pop theme.png",
    cropPixels: { x: 1010, y: 80, width: 480, height: 270 },
  },
};

const args = process.argv.slice(2);
const cardsOnly = args[0] === "--card-previews";
const requested = cardsOnly ? args[1] : args[0];
const knownThemeIds = Object.keys(cardsOnly ? CARD_PREVIEWS : THEMES);
if (requested && !knownThemeIds.includes(requested)) {
  const hint = !cardsOnly && Object.hasOwn(CARD_PREVIEWS, requested)
    ? "; use --card-previews for Studio selector assets"
    : "";
  throw new Error(`Unknown theme "${requested}"; known: ${knownThemeIds.join(", ")}${hint}`);
}
const selection = cardsOnly ? {} : requested
  ? (THEMES[requested] ? { [requested]: THEMES[requested] } : {})
  : THEMES;
const cardSelection = cardsOnly
  ? requested
    ? (CARD_PREVIEWS[requested] ? { [requested]: CARD_PREVIEWS[requested] } : {})
    : CARD_PREVIEWS
  : {};

async function findEdge() {
  for (const candidate of EDGE_PATHS) {
    try { await fs.access(candidate); return candidate; } catch { /* next */ }
  }
  throw new Error("Microsoft Edge is required for asset conversion");
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
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, w, h);
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
