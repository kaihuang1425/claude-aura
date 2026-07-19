#!/usr/bin/env node
// Generates the contract §12 visual QA board from the exact artwork files
// registered for a theme. The board is rendered by Edge so SVG and WebP inputs
// are decoded by the same browser engine that hosts Aura.
import crypto from "node:crypto";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import {
  buildPayload,
  DEFAULT_CONFIG,
  listThemes,
  PROJECT_ROOT,
  readThemeRegistry,
} from "./theme-core.mjs";

const TARGET_WIDTH = 1440;
const TARGET_HEIGHT = 900;
const BOARD_WIDTH = 2160;
const PAINT_SETTLE_MS = 1_200;
const EDGE_PATHS = [
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
];
const ARTWORK_ROOT = path.resolve(PROJECT_ROOT, "assets", "theme-art");
const FIXTURE_PATH = path.join(PROJECT_ROOT, "tests", "fixtures", "claude-dom.html");
const TRANSPARENT_PIXEL = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);
const MIME_TYPES = new Map([
  [".avif", "image/avif"],
  [".jpeg", "image/jpeg"],
  [".jpg", "image/jpeg"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".webp", "image/webp"],
]);
const PANEL_IDS = [
  "reference-crop",
  "production-render",
  "side-by-side",
  "overlay-comparison",
  "transparent-checker",
  "responsive-cover",
  "intended-surface",
  "white-surface",
  "dark-edge",
  "small-scale",
];
const REQUIRED_PANELS = [
  "reference-crop",
  "production-render",
  "side-by-side",
  "overlay-comparison",
  "transparent-checker-or-responsive-cover",
  "intended-surface",
  "white-surface",
  "dark-edge",
  "small-scale",
  "in-context-payload",
];

// These are the production converter's source-master mappings. References are
// optional at runtime (source kits are intentionally not shipped), but when a
// kit is present they make conversion fidelity visible beside the exact
// delivered file.
const REFERENCE_MAP = {
  "anime-twilight": {
    "background.webp": { path: "themes/anime-twilight/provisional/selected/background.png" },
  },
  "cartoon-studio": {
    "background.webp": { path: "themes/cartoon-studio/provisional/selected/background.png" },
    "hero.webp": { path: "themes/cartoon-studio/provisional/selected/hero.png" },
  },
  "japanese-idol": {
    "background.webp": { path: "themes/japanese-idol/atmospheric-background.png" },
    "hero.webp": {
      path: "themes/japanese-idol/claude-kawaii-hero.png",
      crop: { x: 0.28, y: 0, width: 0.72, height: 1, nativeWidth: 1536, nativeHeight: 1024 },
    },
    "sakura-top-right.webp": { path: "themes/japanese-idol/claude-top-right-sakura-cluster-preview.png" },
    "sakura-bottom-right.webp": { path: "themes/japanese-idol/bottom-right-sakura-cluster.png" },
  },
  "korean-idol": {
    "background.webp": {
      path: "themes/korean-prestige/Kpop_Claude_Asset_02_Atmospheric_Background_Raster_v2/assets/kpop-atmosphere@1x.png",
    },
    "hero.webp": {
      path: "themes/korean-prestige/Kpop_Claude_Asset_03_Hero_Portrait_Raster_v2/assets/kpop-hero-portrait@1x.webp",
    },
    "constellation.webp": {
      path: "themes/korean-prestige/Kpop_Claude_Asset_04_Hero_Constellation_Raster_v2/assets/kpop-hero-constellation@1x.webp",
    },
  },
};

const slash = (value) => value.replaceAll(path.sep, "/");
const sha256 = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");
const escapeHtml = (value) => String(value)
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;");

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}

async function assertSafeOutputPath(root, target) {
  const relative = path.relative(root, target);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`QA output must remain below ${root}: ${target}`);
  }
  let current = root;
  for (const part of relative.split(path.sep)) {
    current = path.join(current, part);
    let stat;
    try {
      stat = await fs.lstat(current);
    } catch (error) {
      if (error.code === "ENOENT") return;
      throw error;
    }
    if (stat.isSymbolicLink()) {
      throw new Error(`QA output cannot traverse a symlink or junction: ${current}`);
    }
  }
}

async function findEdge() {
  for (const candidate of EDGE_PATHS) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      // Try the next standard installation.
    }
  }
  throw new Error("Microsoft Edge is required for theme QA boards");
}

function launchEdge(edge, profile, screenshotPath, origin, height) {
  return spawn(edge, [
    "--headless=new",
    "--disable-gpu",
    "--hide-scrollbars",
    "--no-first-run",
    "--run-all-compositor-stages-before-draw",
    `--user-data-dir=${profile}`,
    `--window-size=${BOARD_WIDTH},${height}`,
    "--virtual-time-budget=20000",
    `--screenshot=${screenshotPath}`,
    `${origin}/`,
  ], { stdio: "ignore" });
}

async function cleanupEdge(child, profile) {
  try {
    child?.kill();
  } catch {
    // The Edge launcher may already have detached.
  }
  for (let attempt = 0; attempt < 10; attempt += 1) {
    try {
      await fs.rm(profile, { recursive: true, force: true });
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
}

async function waitForStableFile(filePath, timeoutMs, minimumBytes) {
  const deadline = Date.now() + timeoutMs;
  let previousSize = -1;
  while (Date.now() < deadline) {
    const stat = await fs.stat(filePath).catch(() => null);
    if (stat && stat.size >= minimumBytes && stat.size === previousSize) return true;
    previousSize = stat?.size ?? -1;
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  return false;
}

function assertArtworkPath(relativePath) {
  const absolutePath = path.resolve(PROJECT_ROOT, relativePath);
  if (absolutePath !== ARTWORK_ROOT && !absolutePath.startsWith(`${ARTWORK_ROOT}${path.sep}`)) {
    throw new Error(`Theme artwork must remain inside ${ARTWORK_ROOT}: ${relativePath}`);
  }
  const mime = MIME_TYPES.get(path.extname(absolutePath).toLowerCase());
  if (!mime) throw new Error(`Unsupported QA artwork type: ${relativePath}`);
  return { absolutePath, mime };
}

async function resolveAssets(entry) {
  const layered = Array.isArray(entry.artworkLayers) && entry.artworkLayers.length > 0;
  const registryAssets = layered ? entry.artworkLayers : (entry.artwork ? [entry.artwork] : []);
  const realArtworkRoot = await fs.realpath(ARTWORK_ROOT);
  const assets = [];
  for (let index = 0; index < registryAssets.length; index += 1) {
    const registry = registryAssets[index];
    const { absolutePath, mime } = assertArtworkPath(registry.path);
    const realArtworkPath = await fs.realpath(absolutePath).catch((error) => {
      if (error.code === "ENOENT") throw new Error(`Registered artwork is missing: ${registry.path}`);
      throw error;
    });
    if (realArtworkPath !== realArtworkRoot &&
        !realArtworkPath.startsWith(`${realArtworkRoot}${path.sep}`)) {
      throw new Error(`Registered artwork resolves outside ${realArtworkRoot}: ${registry.path}`);
    }
    let bytes;
    try {
      bytes = await fs.readFile(realArtworkPath);
    } catch (error) {
      if (error.code === "ENOENT") {
        throw new Error(`Registered artwork is missing: ${registry.path}`);
      }
      throw error;
    }
    const referenceConfig = REFERENCE_MAP[entry.id]?.[path.basename(registry.path)] ?? null;
    const referenceRelative = referenceConfig?.path ?? null;
    const referencePath = referenceRelative ? path.join(PROJECT_ROOT, ...referenceRelative.split("/")) : null;
    let reference = null;
    if (referencePath && await exists(referencePath)) {
      const referenceBytes = await fs.readFile(referencePath);
      const referenceMime = MIME_TYPES.get(path.extname(referencePath).toLowerCase());
      if (referenceMime) {
        reference = {
          path: referenceRelative,
          absolutePath: referencePath,
          bytes: referenceBytes,
          mime: referenceMime,
          crop: referenceConfig.crop ?? null,
        };
      }
    }
    assets.push({
      index,
      path: registry.path,
      absolutePath: realArtworkPath,
      bytes,
      mime,
      format: path.extname(absolutePath).slice(1).toLowerCase(),
      sha256: sha256(bytes),
      reference,
      registry: {
        position: registry.position,
        size: registry.size,
        mobile: registry.mobile,
        opacity: registry.opacity ?? 1,
        mask: registry.mask ?? "soft-right",
      },
    });
  }
  return { assets, layered };
}

function preloadMarkup(settings) {
  const sources = [
    settings.imageDataUrl,
    settings.artDataUrl,
    ...(Array.isArray(settings.artLayers) ? settings.artLayers.map((layer) => layer?.dataUrl) : []),
  ].filter((source) => typeof source === "string" && source.startsWith("data:image/"));
  return sources.map((source, index) =>
    `<img class="aura-qa-preload" data-aura-qa-preload="${index}" aria-hidden="true" alt="" `
      + `decoding="sync" loading="eager" fetchpriority="high" src="${escapeHtml(source)}">`
  ).join("");
}

function contextPage(fixture, bundle, origin) {
  const harness = `<style>`
    + `.aura-qa-preload{position:fixed;inset:0;width:100vw;height:100vh;object-fit:contain;`
    + `opacity:.001;pointer-events:none;z-index:2147483647}`
    + `.aura-qa-settle{position:fixed;width:1px;height:1px;opacity:.001;pointer-events:none}`
    + `</style>${preloadMarkup(bundle.settings)}`
    + `<script src="/payload.js"></script>`
    + `<img class="aura-qa-settle" aria-hidden="true" alt="" src="${origin}/settle.png">`;
  return fixture.replace("</body>", `${harness}</body>`);
}

function placedLayer(asset, extraClass = "") {
  const mask = asset.registry.mask === "none"
    ? ""
    : "-webkit-mask-image:radial-gradient(145% 122% at 100% 50%,#000 25%,transparent 80%);"
      + "mask-image:radial-gradient(145% 122% at 100% 50%,#000 25%,transparent 80%);";
  return `<div class="placed ${extraClass}" style="background-image:url('/asset/${asset.index}');`
    + `background-position:${escapeHtml(asset.registry.position)};`
    + `background-size:${escapeHtml(asset.registry.size)};`
    + `opacity:${asset.registry.opacity};${mask}"></div>`;
}

function referenceContent(asset, mode = "contain") {
  if (!asset.reference) {
    return `<div class="missing-reference">Source reference not present in this checkout</div>`;
  }
  if (asset.reference.crop) {
    const crop = asset.reference.crop;
    const x = Math.round(crop.x * crop.nativeWidth);
    const y = Math.round(crop.y * crop.nativeHeight);
    const width = Math.round(crop.width * crop.nativeWidth);
    const height = Math.round(crop.height * crop.nativeHeight);
    const preserve = mode === "cover" ? "xMidYMid slice" : "xMidYMid meet";
    return `<svg class="fit-${mode}" viewBox="${x} ${y} ${width} ${height}" `
      + `preserveAspectRatio="${preserve}" aria-hidden="true">`
      + `<image href="/reference/${asset.index}" width="${crop.nativeWidth}" `
      + `height="${crop.nativeHeight}" preserveAspectRatio="none"></image></svg>`;
  }
  return `<img class="fit-${mode}" src="/reference/${asset.index}" alt="">`;
}

function stage(content, surface = "") {
  return `<div class="stage-frame ${surface}"><div class="stage">${content}</div></div>`;
}

function responsiveCover(asset) {
  const background = `background-image:url('/asset/${asset.index}')`;
  return `<div class="cover-tests">`
    + `<div><span>1440 × 900</span><div class="cover-wide" style="${background}"></div></div>`
    + `<div><span>768 × 1024</span><div class="cover-tall" style="${background}"></div></div>`
    + `<div><span>390 × 844</span><div class="cover-mobile" style="${background}"></div></div>`
    + `</div>`;
}

function panel(id, title, content, note = "") {
  return `<article class="panel" data-panel="${id}"><header><h3>${escapeHtml(title)}</h3>`
    + `<span>${escapeHtml(note)}</span></header><div class="panel-body">${content}</div></article>`;
}

function assetSection(asset, theme) {
  const cover = asset.registry.size.trim().toLowerCase() === "cover";
  const referenceMode = cover ? "cover" : "contain";
  const sideBySide = `<div class="split"><div>${referenceContent(asset, referenceMode)}</div>`
    + `<div><img class="fit-${cover ? "cover" : "contain"}" src="/asset/${asset.index}" alt=""></div></div>`;
  const overlay = `<div class="overlay">${referenceContent(asset, referenceMode)}`
    + `<img class="fit-${cover ? "cover" : "contain"} production-overlay" src="/asset/${asset.index}" alt=""></div>`;
  const checkerOrCover = cover
    ? panel("responsive-cover", "Responsive cover crops", responsiveCover(asset), "opaque full-bleed evidence")
    : panel("transparent-checker", "Transparent checker", `<div class="checker">`
      + `<img class="fit-contain" src="/asset/${asset.index}" alt=""></div>`, "alpha edge evidence");
  const whiteDark = `<div class="split"><div class="white-test"><span>WHITE</span>`
    + `<img class="fit-contain" src="/asset/${asset.index}" alt=""></div>`
    + `<div class="dark-test" data-panel="dark-edge"><span>DARK EDGE</span><img class="fit-contain" `
    + `src="/asset/${asset.index}" alt=""></div></div>`;
  const small = cover
    ? `<div class="small-covers"><i style="background-image:url('/asset/${asset.index}')"></i>`
      + `<i style="background-image:url('/asset/${asset.index}')"></i>`
      + `<i style="background-image:url('/asset/${asset.index}')"></i></div>`
    : `<div class="small-test checker"><img src="/asset/${asset.index}" alt=""></div>`;
  const surface = theme.preview?.background ?? "#f5f0ea";
  const meta = [
    asset.path,
    `${asset.bytes.length.toLocaleString("en-US")} bytes · ${asset.format.toUpperCase()}`,
    `position ${asset.registry.position}`,
    `size ${asset.registry.size}`,
    `mobile ${asset.registry.mobile} · opacity ${asset.registry.opacity} · mask ${asset.registry.mask}`,
  ].join(" · ");
  return `<section class="asset-section" data-asset="${asset.index}">`
    + `<div class="asset-heading"><div><p>LAYER ${String(asset.index + 1).padStart(2, "0")}</p>`
    + `<h2>${escapeHtml(path.basename(asset.path))}</h2></div><code>${escapeHtml(meta)}</code></div>`
    + `<div class="panel-grid">`
    + panel("reference-crop", "Reference crop", referenceContent(asset, referenceMode),
      asset.reference?.path ?? "reference unavailable")
    + panel("production-render", "Production at intended size", stage(placedLayer(asset)),
      `${asset.registry.position} / ${asset.registry.size}`)
    + panel("side-by-side", "Side-by-side comparison", sideBySide, "reference / delivered")
    + panel("overlay-comparison", "Overlay comparison", overlay, "production at 50%")
    + checkerOrCover
    + panel("intended-surface", "Intended-surface composite",
      stage(placedLayer(asset), `intended-surface" style="--surface:${escapeHtml(surface)}`),
      `${TARGET_WIDTH} × ${TARGET_HEIGHT} target`)
    + panel("white-surface", "White / dark-edge tests", whiteDark, "two edge surfaces")
    + panel("small-scale", "Small-scale test", small, cover ? "responsive thumbnails" : "96 px evidence")
    + `</div></section>`;
}

function boardPage(theme, assets, bundle, height, origin, readyPath) {
  const assetMarkup = assets.map((asset) => assetSection(asset, theme)).join("");
  const probes = assets.map((asset) =>
    `<img class="decode-probe" data-kind="asset" data-index="${asset.index}" src="/asset/${asset.index}" alt="">`
      + (asset.reference
        ? `<img class="decode-probe" data-kind="reference" data-index="${asset.index}" `
          + `src="/reference/${asset.index}" alt="">`
        : "")
  ).join("");
  const empty = assets.length ? "" : `<section class="empty">This tokens-only theme has no registered artwork assets.</section>`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=${BOARD_WIDTH}">
<title>${escapeHtml(theme.label)} QA board</title>
<style>
  *{box-sizing:border-box}
  html,body{margin:0;width:${BOARD_WIDTH}px;min-height:${height}px;background:#111019;color:#f9f7ff}
  body{font-family:"Segoe UI",system-ui,sans-serif;padding:54px;background:
    radial-gradient(circle at 90% 0%,rgba(219,123,166,.18),transparent 27%),
    linear-gradient(145deg,#171421,#0e0e15 55%,#15111a)}
  .board-header{display:flex;justify-content:space-between;align-items:flex-end;min-height:170px;
    padding:42px 48px;border:1px solid #43394c;border-radius:28px;background:rgba(34,29,42,.88)}
  .eyebrow,.asset-heading p{margin:0 0 10px;color:#f1a5c0;font-size:18px;font-weight:800;letter-spacing:.18em}
  h1{margin:0;font-family:Georgia,serif;font-size:68px;font-weight:500;letter-spacing:-.035em}
  .board-header aside{text-align:right;color:#c8c0d1;font:20px/1.55 ui-monospace,Consolas,monospace}
  .asset-section{margin-top:34px;padding:30px;border:1px solid #403747;border-radius:28px;background:#18151f}
  .asset-heading{display:flex;justify-content:space-between;gap:30px;align-items:end;min-height:84px;padding:0 8px 24px}
  .asset-heading h2{margin:0;font-size:38px;letter-spacing:-.025em}
  .asset-heading code{max-width:70%;color:#bfb4c8;font:16px/1.55 ui-monospace,Consolas,monospace;text-align:right}
  .panel-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:24px}
  .panel{height:430px;overflow:hidden;border:1px solid #4a4051;border-radius:20px;background:#24202a}
  .panel header{height:50px;display:flex;justify-content:space-between;align-items:center;padding:0 18px;
    border-bottom:1px solid #443b4a;background:#2c2732}
  .panel h3{margin:0;font-size:18px}.panel header span{max-width:55%;overflow:hidden;text-overflow:ellipsis;
    white-space:nowrap;color:#bfb5c7;font:13px ui-monospace,Consolas,monospace}
  .panel-body{position:relative;height:378px;overflow:hidden;background:#d9d2dd}
  .panel-body>img,.panel-body>svg,.split img,.split svg,.overlay img,.overlay svg{
    display:block;width:100%;height:100%;object-position:center}
  .fit-contain{object-fit:contain}.fit-cover{object-fit:cover}
  .missing-reference{display:grid;place-items:center;width:100%;height:100%;padding:40px;color:#766d7c;
    text-align:center;background:repeating-linear-gradient(135deg,#e9e6eb 0 12px,#ded9e1 12px 24px)}
  .stage-frame{position:relative;width:100%;height:100%;overflow:hidden;background:#ede9ef}
  .stage{position:absolute;left:50%;top:50%;width:${TARGET_WIDTH}px;height:${TARGET_HEIGHT}px;
    transform:translate(-50%,-50%) scale(.42);transform-origin:center;background:transparent}
  .placed{position:absolute;inset:0;background-repeat:no-repeat;pointer-events:none}
  .split{display:grid;grid-template-columns:1fr 1fr;width:100%;height:100%}
  .split>div{position:relative;min-width:0;overflow:hidden;border-right:1px solid #706777}
  .split>div:last-child{border-right:0}
  .overlay{position:relative;width:100%;height:100%;background:#ded9e1}
  .overlay>img,.overlay>svg,.overlay>.missing-reference{position:absolute;inset:0}
  .overlay .production-overlay{opacity:.5}
  .checker{background-color:#fff;background-image:linear-gradient(45deg,#cfd0d4 25%,transparent 25%),
    linear-gradient(-45deg,#cfd0d4 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#cfd0d4 75%),
    linear-gradient(-45deg,transparent 75%,#cfd0d4 75%);background-size:32px 32px;
    background-position:0 0,0 16px,16px -16px,-16px 0}
  .checker img{width:100%;height:100%;object-fit:contain}
  .cover-tests{display:flex;align-items:center;justify-content:center;gap:20px;width:100%;height:100%;background:#d8d3dc}
  .cover-tests>div{display:flex;flex-direction:column;align-items:center;gap:7px;color:#4a4350;font:12px ui-monospace,monospace}
  .cover-tests div div,.small-covers i{background-position:center;background-size:cover;background-repeat:no-repeat;
    border:2px solid #fff;box-shadow:0 8px 22px #30273844}
  .cover-wide{width:300px;height:188px}.cover-tall{width:120px;height:160px}.cover-mobile{width:92px;height:198px}
  .intended-surface .stage{background:var(--surface)}
  .white-test{background:#fff}.dark-test{background:#14121a}
  .white-test span,.dark-test span{position:absolute;z-index:2;top:12px;left:12px;padding:5px 7px;
    border-radius:6px;background:#26212ccc;color:#fff;font:11px ui-monospace,monospace}
  .small-test{display:grid;place-items:center;width:100%;height:100%}.small-test img{width:96px;height:96px;object-fit:contain}
  .small-covers{display:flex;align-items:center;justify-content:center;gap:30px;width:100%;height:100%;background:#d8d3dc}
  .small-covers i:nth-child(1){width:160px;height:100px}.small-covers i:nth-child(2){width:96px;height:96px}
  .small-covers i:nth-child(3){width:60px;height:120px}
  .context-section{margin-top:34px;padding:34px;border:1px solid #54445a;border-radius:28px;background:#1b1721}
  .context-section header{display:flex;justify-content:space-between;align-items:end;margin-bottom:22px}
  .context-section h2{margin:0;font-size:38px}.context-section p{margin:0;color:#c4b9cb;font:16px ui-monospace,monospace}
  .context-shell{position:relative;height:855px;overflow:hidden;border:1px solid #615367;border-radius:18px;background:#fff}
  #payload-frame{position:absolute;left:50%;top:50%;width:${TARGET_WIDTH}px;height:${TARGET_HEIGHT}px;
    transform:translate(-50%,-50%) scale(.95);border:0;background:#fff}
  .decode-probe,.settle{position:fixed;width:1px;height:1px;opacity:.001;pointer-events:none}
  .empty{display:grid;place-items:center;height:280px;margin-top:34px;border:1px dashed #65556d;border-radius:28px;
    color:#cfc6d4;font-size:28px}
  .footer{padding:34px 10px;color:#8f8497;text-align:center;font:15px ui-monospace,monospace}
</style>
</head>
<body>
  <header class="board-header">
    <div><p class="eyebrow">CLAUDE AURA · CONTRACT §12</p><h1>${escapeHtml(theme.label)} QA Board</h1></div>
    <aside>${escapeHtml(theme.name)}<br>${assets.length} registered asset${assets.length === 1 ? "" : "s"}<br>${TARGET_WIDTH} × ${TARGET_HEIGHT} target</aside>
  </header>
  ${empty}${assetMarkup}
  <section class="context-section" data-panel="in-context-payload">
    <header><div><p class="eyebrow">CUMULATIVE COMPOSITION</p><h2>In-context payload harness</h2></div>
      <p>real renderer payload · deterministic fixture · light mode</p></header>
    <div class="context-shell"><iframe id="payload-frame" title="Payload harness" src="/context"></iframe></div>
  </section>
  <div class="footer">Generated from registry paths · SHA-256 and browser decode evidence recorded in status.json</div>
  <div aria-hidden="true">${probes}</div>
  <img class="settle" aria-hidden="true" alt="" src="${origin}/settle.png">
<script>
  const waitForImage = async (image) => {
    if (!image.complete) await new Promise((resolve, reject) => {
      image.addEventListener("load", resolve, { once: true });
      image.addEventListener("error", () => reject(new Error("decode failed: " + image.src)), { once: true });
    });
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    context.drawImage(image, 0, 0);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let hasAlpha = false;
    for (let offset = 3; offset < pixels.length; offset += 4) {
      if (pixels[offset] < 255) { hasAlpha = true; break; }
    }
    return { width: image.naturalWidth, height: image.naturalHeight, hasAlpha };
  };
  window.addEventListener("load", async () => {
    try {
      const assetReports = {};
      const referenceReports = {};
      for (const image of document.querySelectorAll(".decode-probe")) {
        const report = await waitForImage(image);
        const collection = image.dataset.kind === "asset" ? assetReports : referenceReports;
        collection[image.dataset.index] = report;
      }
      const frame = document.getElementById("payload-frame");
      const frameDocument = frame.contentDocument;
      for (const image of frameDocument.querySelectorAll(".aura-qa-preload")) await image.decode();
      await new Promise((resolve) => frame.contentWindow.requestAnimationFrame(
        () => frame.contentWindow.requestAnimationFrame(resolve)));
      const payload = {
        theme: frameDocument.documentElement.dataset.claudeAuraTheme || null,
        digest: frameDocument.documentElement.dataset.claudeAuraDigest || null,
        layerCount: frameDocument.querySelectorAll(
          "#claude-aura-backdrop .claude-aura-theme-art-layer").length,
        legacyCount: frameDocument.querySelectorAll(
          "#claude-aura-backdrop .claude-aura-theme-art:not(.claude-aura-theme-art-layer)").length,
      };
      const board = {
        panels: [...new Set([...document.querySelectorAll("[data-panel]")]
          .map((element) => element.dataset.panel))],
        assets: [...document.querySelectorAll(".asset-section")].map((section) => ({
          index: Number(section.dataset.asset),
          panels: [...new Set([...section.querySelectorAll("[data-panel]")]
            .map((element) => element.dataset.panel))],
        })),
      };
      const response = await fetch("${readyPath}", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assets: assetReports, references: referenceReports, payload, board }),
      });
      if (!response.ok) throw new Error("readiness callback failed");
      document.documentElement.dataset.qaReady = "true";
    } catch (error) {
      await fetch("${readyPath}", { method: "POST", body: JSON.stringify({ error: String(error) }) });
    }
  }, { once: true });
</script>
</body>
</html>`;
}

async function readRequestBody(request, limit = 1_000_000) {
  const chunks = [];
  let length = 0;
  for await (const chunk of request) {
    length += chunk.length;
    if (length > limit) throw new Error("QA readiness report is too large");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

async function renderBoard({ edge, theme, assets, bundle, outputDir, boardPath, height }) {
  const fixture = await fs.readFile(FIXTURE_PATH, "utf8");
  const readyPath = `/ready/${crypto.randomBytes(16).toString("hex")}`;
  let resolveReady;
  const readyPromise = new Promise((resolve) => { resolveReady = resolve; });
  let boardHtml = "";
  let contextHtml = "";
  const server = http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url, "http://127.0.0.1");
      if (request.method === "GET" && url.pathname === "/") {
        response.writeHead(200, {
          "Cache-Control": "no-store",
          "Content-Type": "text/html; charset=utf-8",
        }).end(boardHtml);
        return;
      }
      if (request.method === "GET" && url.pathname === "/context") {
        response.writeHead(200, {
          "Cache-Control": "no-store",
          "Content-Type": "text/html; charset=utf-8",
        }).end(contextHtml);
        return;
      }
      if (request.method === "GET" && url.pathname === "/payload.js") {
        response.writeHead(200, {
          "Cache-Control": "no-store",
          "Content-Type": "text/javascript; charset=utf-8",
        }).end(bundle.payload);
        return;
      }
      if (request.method === "GET" && url.pathname === "/settle.png") {
        setTimeout(() => {
          if (response.destroyed) return;
          response.writeHead(200, {
            "Cache-Control": "no-store",
            "Connection": "close",
            "Content-Type": "image/png",
          }).end(TRANSPARENT_PIXEL);
        }, PAINT_SETTLE_MS);
        return;
      }
      const assetMatch = request.method === "GET" && url.pathname.match(/^\/asset\/(\d+)$/);
      if (assetMatch) {
        const asset = assets[Number(assetMatch[1])];
        if (!asset) {
          response.writeHead(404).end();
          return;
        }
        response.writeHead(200, {
          "Cache-Control": "no-store",
          "Content-Type": asset.mime,
        }).end(asset.bytes);
        return;
      }
      const referenceMatch = request.method === "GET" && url.pathname.match(/^\/reference\/(\d+)$/);
      if (referenceMatch) {
        const reference = assets[Number(referenceMatch[1])]?.reference;
        if (!reference) {
          response.writeHead(404).end();
          return;
        }
        response.writeHead(200, {
          "Cache-Control": "no-store",
          "Content-Type": reference.mime,
        }).end(reference.bytes);
        return;
      }
      if (request.method === "POST" && url.pathname === readyPath) {
        const report = JSON.parse(await readRequestBody(request));
        response.writeHead(204).end();
        resolveReady(report);
        return;
      }
      response.writeHead(404).end();
    } catch (error) {
      response.writeHead(500).end();
      resolveReady({ error: error.message });
    }
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  boardHtml = boardPage(theme, assets, bundle, height, origin, readyPath);
  contextHtml = contextPage(fixture, bundle, origin);
  const profile = path.join(outputDir, `.edge-${process.pid}-${crypto.randomBytes(4).toString("hex")}`);
  let child;
  let readyTimer;
  try {
    await fs.rm(boardPath, { force: true });
    child = launchEdge(edge, profile, boardPath, origin, height);
    const timeoutReport = new Promise((resolve) => {
      readyTimer = setTimeout(() => resolve({ error: "QA browser readiness timed out" }), 60_000);
    });
    const [stable, report] = await Promise.all([
      waitForStableFile(boardPath, 60_000, 10_000),
      Promise.race([readyPromise, timeoutReport]),
    ]);
    if (!stable) throw new Error("QA board screenshot is missing or incomplete");
    if (report.error) throw new Error(report.error);
    return report;
  } catch (error) {
    await fs.rm(boardPath, { force: true });
    throw error;
  } finally {
    clearTimeout(readyTimer);
    await cleanupEdge(child, profile);
    await new Promise((resolve) => {
      server.close(resolve);
      server.closeAllConnections?.();
    });
  }
}

async function readExistingStatus(statusPath) {
  try {
    const parsed = JSON.parse(await fs.readFile(statusPath, "utf8"));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch (error) {
    if (error.code === "ENOENT") return {};
    if (error instanceof SyntaxError) {
      throw new Error(`Existing QA status is invalid JSON; repair it before regenerating: ${statusPath}`);
    }
    throw error;
  }
}

async function writeJsonAtomic(filePath, value) {
  const temporary = `${filePath}.tmp-${process.pid}-${crypto.randomBytes(4).toString("hex")}`;
  await fs.writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  try {
    await fs.rename(temporary, filePath);
  } catch (error) {
    if (["EEXIST", "EPERM"].includes(error.code)) {
      await fs.rm(filePath, { force: true });
      await fs.rename(temporary, filePath);
      return;
    }
    await fs.rm(temporary, { force: true });
    throw error;
  }
}

export async function generateQaBoard(themeId, { cwd = process.cwd() } = {}) {
  if (!/^[a-z][a-z0-9-]{1,39}$/.test(themeId ?? "")) {
    throw new Error("Theme id must be a lowercase kebab-case id");
  }
  const registry = await readThemeRegistry();
  const canonicalId = registry.legacyAliases[themeId] ?? themeId;
  const entry = registry.themes.find((candidate) => candidate.id === canonicalId);
  if (!entry) throw new Error(`Unknown theme: ${themeId}`);
  const theme = (await listThemes({ locale: "en" })).find((candidate) => candidate.name === canonicalId);
  const { assets, layered } = await resolveAssets(entry);
  const bundle = await buildPayload({
    config: { ...DEFAULT_CONFIG, theme: canonicalId },
    locale: "en",
  });
  if (layered) {
    if (bundle.settings.artDataUrl !== null ||
        !Array.isArray(bundle.settings.artLayers) ||
        bundle.settings.artLayers.length !== assets.length) {
      throw new Error(`Layered QA requires all ${assets.length} registered artworkLayers; legacy fallback is forbidden`);
    }
  } else if (assets.length === 1 && !bundle.settings.artDataUrl) {
    throw new Error(`Registered artwork is unavailable: ${assets[0].path}`);
  }

  const resolvedCwd = await fs.realpath(path.resolve(cwd));
  const kitDirectory = path.join(resolvedCwd, "themes", canonicalId);
  await assertSafeOutputPath(resolvedCwd, kitDirectory);
  const hasKit = await fs.stat(kitDirectory).then((stat) => stat.isDirectory()).catch((error) => {
    if (error.code === "ENOENT") return false;
    throw error;
  });
  const outputDir = hasKit
    ? path.join(kitDirectory, "qa")
    : path.join(resolvedCwd, "dist", "qa", canonicalId);
  const boardPath = path.join(outputDir, "qa-board.png");
  const statusPath = path.join(outputDir, "status.json");
  const height = Math.max(1_600, 500 + (assets.length * 1_540) + 1_020);
  await assertSafeOutputPath(resolvedCwd, outputDir);
  await fs.mkdir(outputDir, { recursive: true });
  const realOutputDir = await fs.realpath(outputDir);
  if (!realOutputDir.startsWith(`${resolvedCwd}${path.sep}`)) {
    throw new Error(`QA output resolves outside ${resolvedCwd}: ${outputDir}`);
  }

  const previous = await readExistingStatus(statusPath);
  const edge = await findEdge();
  const report = await renderBoard({
    edge,
    theme,
    assets,
    bundle,
    outputDir,
    boardPath,
    height,
  });
  if (report.payload.theme !== canonicalId) {
    throw new Error(`Payload harness rendered ${report.payload.theme ?? "no theme"} instead of ${canonicalId}`);
  }
  if (report.payload.digest !== bundle.digest) {
    throw new Error("Payload harness digest does not match the compiled theme");
  }
  if (report.payload.layerCount !== (layered ? assets.length : 0)) {
    throw new Error(`Payload harness placed ${report.payload.layerCount} of ${assets.length} registered layers`);
  }
  if (layered && report.payload.legacyCount !== 0) {
    throw new Error("Layered QA rendered the legacy artwork slot");
  }
  const expectedLegacyCount = !layered && assets.length === 1 ? 1 : 0;
  if (!layered && report.payload.legacyCount !== expectedLegacyCount) {
    throw new Error(`Payload harness placed ${report.payload.legacyCount} of ${expectedLegacyCount} legacy artwork slots`);
  }
  if (!report.board?.panels?.includes("in-context-payload")) {
    throw new Error("QA browser did not observe the in-context payload panel");
  }
  for (const asset of assets) {
    const decoded = report.assets[String(asset.index)];
    if (!decoded?.width || !decoded?.height) throw new Error(`Browser failed to decode ${asset.path}`);
    const observed = report.board?.assets?.find((candidate) => candidate.index === asset.index)?.panels ?? [];
    const expected = PANEL_IDS.filter((panelId) =>
      panelId !== (asset.registry.size.trim().toLowerCase() === "cover"
        ? "transparent-checker"
        : "responsive-cover"));
    const missing = expected.filter((panelId) => !observed.includes(panelId));
    if (missing.length) {
      throw new Error(`QA browser did not observe ${asset.path} panels: ${missing.join(", ")}`);
    }
  }

  const boardBytes = await fs.readFile(boardPath);
  const previousAssets = new Map(
    Array.isArray(previous.assets)
      ? previous.assets.filter((asset) => asset && typeof asset.path === "string")
        .map((asset) => [asset.path, asset])
      : [],
  );
  const approvalInvalidated = assets.some((asset) => {
    const old = previousAssets.get(asset.path);
    return Boolean(old && old.sha256 !== asset.sha256);
  });
  const status = {
    ...previous,
    schemaVersion: 1,
    theme: {
      id: canonicalId,
      label: theme.label,
    },
    state: approvalInvalidated ? "needs-review" : (previous.state ?? "needs-review"),
    approvalInvalidated,
    generatedAt: new Date().toISOString(),
    board: {
      path: slash(path.relative(resolvedCwd, boardPath)),
      width: BOARD_WIDTH,
      height,
      bytes: boardBytes.length,
      sha256: sha256(boardBytes),
    },
    payload: {
      mode: "light",
      viewport: { width: TARGET_WIDTH, height: TARGET_HEIGHT },
      digest: bundle.digest,
      renderedDigest: report.payload.digest,
      theme: report.payload.theme,
      layerCount: report.payload.layerCount,
      usesLegacyArtwork: report.payload.legacyCount > 0,
    },
    panels: {
      required: REQUIRED_PANELS,
      observed: report.board.panels,
    },
    assets: assets.map((asset) => {
      const decoded = report.assets[String(asset.index)];
      const referenceDecoded = report.references[String(asset.index)] ?? null;
      const old = previousAssets.get(asset.path) ?? {};
      const changed = Boolean(old.path && old.sha256 !== asset.sha256);
      const evidencePanels = report.board.assets
        .find((candidate) => candidate.index === asset.index).panels;
      return {
        layerIndex: asset.index,
        path: asset.path,
        bytes: asset.bytes.length,
        sha256: asset.sha256,
        format: asset.format,
        mime: asset.mime,
        dimensions: { width: decoded.width, height: decoded.height },
        hasAlpha: decoded.hasAlpha,
        reference: asset.reference ? {
          path: asset.reference.path,
          crop: asset.reference.crop,
          dimensions: referenceDecoded
            ? { width: referenceDecoded.width, height: referenceDecoded.height }
            : null,
        } : null,
        registry: { ...asset.registry },
        decode: "pass",
        panels: evidencePanels,
        reviewStatus: changed ? "pending" : (old.reviewStatus ?? "pending"),
        issues: changed
          ? [...new Set([
            ...(Array.isArray(old.issues) ? old.issues : []),
            "Production bytes changed since the previous QA board; review again.",
          ])]
          : (Array.isArray(old.issues) ? old.issues : []),
      };
    }),
  };
  await writeJsonAtomic(statusPath, status);
  return {
    themeId: canonicalId,
    outputDir: slash(path.relative(resolvedCwd, outputDir)),
    boardPath,
    statusPath,
    assetCount: assets.length,
    layerCount: report.payload.layerCount,
  };
}
