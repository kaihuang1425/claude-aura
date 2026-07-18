#!/usr/bin/env node
// Derives optimized runtime WebP copies from the supplied per-theme source
// kits (directories under themes/) using a headless browser's canvas encoder.
// No npm dependencies; everything stays on 127.0.0.1.
//
//   node scripts/convert-theme-assets.mjs [theme-id]
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

const requested = process.argv[2];
const selection = requested ? { [requested]: THEMES[requested] } : THEMES;
if (requested && !THEMES[requested]) {
  throw new Error(`Unknown theme "${requested}"; known: ${Object.keys(THEMES).join(", ")}`);
}

async function findEdge() {
  for (const candidate of EDGE_PATHS) {
    try { await fs.access(candidate); return candidate; } catch { /* next */ }
  }
  throw new Error("Microsoft Edge is required for asset conversion");
}

async function convertTheme(themeId, config) {
  const missing = [];
  for (const entry of [...config.jobs, ...config.copies]) {
    try { await fs.access(path.join(config.sourceDir, entry.src)); } catch { missing.push(entry.src); }
  }
  if (missing.length) {
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
  (async () => {
    for (const job of jobs) {
      const img = new Image();
      await new Promise((res, rej) => { img.onload = res; img.onerror = () => rej(new Error(job.src)); img.src = "/src/" + encodeURIComponent(job.src); });
      const sx = Math.round(img.naturalWidth * job.cropLeft);
      const sw = img.naturalWidth - sx;
      const scale = Math.min(1, job.width / sw);
      const w = Math.round(sw * scale), h = Math.round(img.naturalHeight * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext("2d");
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, sx, 0, sw, img.naturalHeight, 0, 0, w, h);
      const blob = await new Promise((res) => canvas.toBlob(res, "image/webp", job.quality));
      await fetch("/out/" + encodeURIComponent(job.out), { method: "POST", body: blob });
    }
    await fetch("/done", { method: "POST" });
  })().catch((error) => fetch("/fail", { method: "POST", body: String(error) }));
  </script>`;

  let finish;
  const finished = new Promise((resolve) => { finish = resolve; });
  const server = http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url, "http://127.0.0.1");
      if (request.method === "GET" && url.pathname === "/") {
        response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" }).end(page);
      } else if (request.method === "GET" && url.pathname.startsWith("/src/")) {
        const name = decodeURIComponent(url.pathname.slice(5));
        if (!config.jobs.some((job) => job.src === name)) { response.writeHead(403).end(); return; }
        response.writeHead(200, { "Content-Type": "image/png" }).end(await fs.readFile(path.join(config.sourceDir, name)));
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
console.log("done");
