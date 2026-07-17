#!/usr/bin/env node
// One-shot local converter: renders the supplied kawaii-idol PNGs to optimized
// WebP runtime copies using a headless browser's canvas encoder. No npm
// dependencies; everything stays on 127.0.0.1.
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { PROJECT_ROOT } from "./theme-core.mjs";

const SOURCE_DIR = path.join(PROJECT_ROOT, "themes", "japanese-idol");
const OUTPUT_DIR = path.join(PROJECT_ROOT, "assets", "theme-art", "kawaii-idol");
const EDGE_PATHS = [
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
];

const JOBS = [
  { src: "atmospheric-background.png", out: "background.webp", width: 1600, cropLeft: 0, quality: 0.78 },
  { src: "claude-kawaii-hero.png", out: "hero.webp", width: 1080, cropLeft: 0.28, quality: 0.8 },
  { src: "claude-top-right-sakura-cluster-preview.png", out: "sakura-top-right.webp", width: 582, cropLeft: 0, quality: 0.85 },
  { src: "bottom-right-sakura-cluster.png", out: "sakura-bottom-right.webp", width: 641, cropLeft: 0, quality: 0.85 },
];

const page = `<!doctype html><meta charset="utf-8"><script>
const jobs = ${JSON.stringify(JOBS)};
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

await fs.mkdir(OUTPUT_DIR, { recursive: true });
let finish;
const finished = new Promise((resolve) => { finish = resolve; });
const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, "http://127.0.0.1");
    if (request.method === "GET" && url.pathname === "/") {
      response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" }).end(page);
      return;
    }
    if (request.method === "GET" && url.pathname.startsWith("/src/")) {
      const name = decodeURIComponent(url.pathname.slice(5));
      if (!JOBS.some((job) => job.src === name)) { response.writeHead(403).end(); return; }
      response.writeHead(200, { "Content-Type": "image/png" }).end(await fs.readFile(path.join(SOURCE_DIR, name)));
      return;
    }
    if (request.method === "POST" && url.pathname.startsWith("/out/")) {
      const name = decodeURIComponent(url.pathname.slice(5));
      if (!JOBS.some((job) => job.out === name)) { response.writeHead(403).end(); return; }
      const chunks = [];
      for await (const chunk of request) chunks.push(chunk);
      await fs.writeFile(path.join(OUTPUT_DIR, name), Buffer.concat(chunks));
      console.log(`wrote ${name} (${Buffer.concat(chunks).length} bytes)`);
      response.writeHead(200).end();
      return;
    }
    if (request.method === "POST" && (url.pathname === "/done" || url.pathname === "/fail")) {
      if (url.pathname === "/fail") {
        const chunks = [];
        for await (const chunk of request) chunks.push(chunk);
        console.error(`converter page failed: ${Buffer.concat(chunks)}`);
        process.exitCode = 1;
      }
      response.writeHead(200).end();
      finish();
      return;
    }
    response.writeHead(404).end();
  } catch (error) {
    console.error(error.message);
    response.writeHead(500).end();
  }
});

await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const port = server.address().port;
let edge = null;
for (const candidate of EDGE_PATHS) {
  try { await fs.access(candidate); edge = candidate; break; } catch { /* try next */ }
}
if (!edge) throw new Error("Microsoft Edge was not found for headless conversion");
const child = spawn(edge, [
  "--headless=new", "--disable-gpu", "--no-first-run",
  `--user-data-dir=${path.join(OUTPUT_DIR, ".convert-profile")}`,
  `http://127.0.0.1:${port}/`,
], { stdio: "ignore" });
const timeout = setTimeout(() => { console.error("conversion timed out"); process.exitCode = 1; finish(); }, 60_000);
await finished;
clearTimeout(timeout);
const exited = new Promise((resolve) => child.once("exit", resolve));
child.kill();
await Promise.race([exited, new Promise((resolve) => setTimeout(resolve, 5000))]);
server.close();
await fs.rm(path.join(OUTPUT_DIR, ".convert-profile"), { recursive: true, force: true })
  .catch(() => console.warn("profile cleanup skipped; remove .convert-profile manually"));
console.log("done");
