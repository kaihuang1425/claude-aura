#!/usr/bin/env node
// One-command verification: runs the test suite, compiles every theme's REAL
// renderer payload, renders it against tests/fixtures/claude-dom.html in
// headless Edge (light and dark), screenshots to dist/verify/, and diffs each
// render against an approved golden in docs/golden/<theme>/ when one exists.
// Exit code 0 only when every gate passes. No dependencies beyond Edge.
//
// Edge note: the launcher process may detach and exit before the browser
// finishes, so completion is detected by watching for output (screenshot
// file) or a loopback callback (diff), never by the process exit code.
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { PROJECT_ROOT, DEFAULT_CONFIG, buildPayload, listThemes } from "./theme-core.mjs";

const FIXTURE_PATH = path.join(PROJECT_ROOT, "tests", "fixtures", "claude-dom.html");
const OUTPUT_DIR = path.join(PROJECT_ROOT, "dist", "verify");
const GOLDEN_DIR = path.join(PROJECT_ROOT, "docs", "golden");
const WIDTH = 1440;
const HEIGHT = 900;
// Golden drift thresholds: mean absolute channel delta and share of pixels
// whose max channel delta exceeds 10/255.
const MEAN_DELTA_LIMIT = 3;
const CHANGED_SHARE_LIMIT = 0.02;
const EDGE_PATHS = [
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
];

const results = [];
const record = (gate, pass, detail = "") => {
  results.push({ gate, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${gate}${detail ? `  ${detail}` : ""}`);
};

async function findEdge() {
  for (const candidate of EDGE_PATHS) {
    try { await fs.access(candidate); return candidate; } catch { /* next */ }
  }
  throw new Error("Microsoft Edge is required for verify:cycle renders");
}

function launchEdge(edge, extraArgs) {
  const profile = path.join(OUTPUT_DIR, `.edge-${process.pid}-${Math.random().toString(16).slice(2)}`);
  const child = spawn(edge, [
    "--headless=new", "--disable-gpu", "--hide-scrollbars", "--no-first-run",
    `--user-data-dir=${profile}`, ...extraArgs,
  ], { stdio: "ignore" });
  return { child, profile };
}

async function cleanupEdge(handle) {
  try { handle.child.kill(); } catch { /* already gone */ }
  for (let attempt = 0; attempt < 10; attempt += 1) {
    try {
      await fs.rm(handle.profile, { recursive: true, force: true });
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
}

async function waitForStableFile(filePath, timeoutMs, minimumBytes) {
  const deadline = Date.now() + timeoutMs;
  let lastSize = -1;
  while (Date.now() < deadline) {
    const stat = await fs.stat(filePath).catch(() => null);
    if (stat && stat.size >= minimumBytes && stat.size === lastSize) return true;
    lastSize = stat?.size ?? -1;
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  return false;
}

function fileUrl(filePath) {
  return `file:///${filePath.replaceAll("\\", "/")}`;
}

async function renderTheme(edge, theme, mode) {
  const bundle = await buildPayload({ config: { ...DEFAULT_CONFIG, theme: theme.name }, locale: "en" });
  const fixture = await fs.readFile(FIXTURE_PATH, "utf8");
  const darkSetup = mode === "dark"
    ? '<script>document.documentElement.classList.add("dark");document.documentElement.dataset.mode="dark";</script>'
    : "";
  const html = fixture.replace("</body>", `${darkSetup}<script>\n${bundle.payload}\n</script></body>`);
  const name = `${theme.name}-${mode}-${WIDTH}x${HEIGHT}`;
  const htmlPath = path.join(OUTPUT_DIR, `${name}.html`);
  const pngPath = path.join(OUTPUT_DIR, `${name}.png`);
  await fs.writeFile(htmlPath, html, "utf8");
  await fs.rm(pngPath, { force: true });
  const handle = launchEdge(edge, [
    `--window-size=${WIDTH},${HEIGHT}`, "--virtual-time-budget=8000",
    `--screenshot=${pngPath}`, fileUrl(htmlPath),
  ]);
  const ok = await waitForStableFile(pngPath, 30_000, 10_000);
  await cleanupEdge(handle);
  return { name, pngPath, ok };
}

// Serves the two PNGs plus a diff page to headless Edge; the page computes the
// pixel statistics same-origin and POSTs them back. Robust against the Edge
// launcher detaching, because completion is the HTTP callback.
async function diffAgainstGolden(edge, themeName, renderName, pngPath) {
  const goldenPath = path.join(GOLDEN_DIR, themeName, `${renderName}.png`);
  try { await fs.access(goldenPath); } catch { return null; }

  const page = `<!doctype html><meta charset="utf-8"><body><script>
  const finish = (payload) => fetch("/result", { method: "POST", body: JSON.stringify(payload) });
  const load = (src) => new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = () => rej(new Error("load failed: " + src));
    img.src = src;
  });
  Promise.all([load("/golden.png"), load("/current.png")])
    .then(([golden, current]) => {
      if (golden.naturalWidth !== current.naturalWidth || golden.naturalHeight !== current.naturalHeight) {
        return finish({ error: "dimension mismatch" });
      }
      const w = golden.naturalWidth, h = golden.naturalHeight;
      const read = (img) => {
        const c = document.createElement("canvas");
        c.width = w; c.height = h;
        const ctx = c.getContext("2d");
        ctx.drawImage(img, 0, 0);
        return ctx.getImageData(0, 0, w, h).data;
      };
      const a = read(golden), b = read(current);
      let sum = 0, changed = 0;
      for (let i = 0; i < a.length; i += 4) {
        const dr = Math.abs(a[i] - b[i]), dg = Math.abs(a[i + 1] - b[i + 1]), db = Math.abs(a[i + 2] - b[i + 2]);
        sum += dr + dg + db;
        if (Math.max(dr, dg, db) > 10) changed += 1;
      }
      const pixels = w * h;
      return finish({ meanDelta: sum / (pixels * 3), changedShare: changed / pixels });
    })
    .catch((error) => finish({ error: String(error) }));
  </script></body>`;

  let resolveResult;
  const resultPromise = new Promise((resolve) => { resolveResult = resolve; });
  const server = http.createServer(async (request, response) => {
    try {
      if (request.method === "GET" && request.url === "/") {
        response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" }).end(page);
      } else if (request.method === "GET" && request.url === "/golden.png") {
        response.writeHead(200, { "Content-Type": "image/png" }).end(await fs.readFile(goldenPath));
      } else if (request.method === "GET" && request.url === "/current.png") {
        response.writeHead(200, { "Content-Type": "image/png" }).end(await fs.readFile(pngPath));
      } else if (request.method === "POST" && request.url === "/result") {
        const chunks = [];
        for await (const chunk of request) chunks.push(chunk);
        response.writeHead(200).end();
        resolveResult(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } else {
        response.writeHead(404).end();
      }
    } catch (error) {
      response.writeHead(500).end();
      resolveResult({ error: error.message });
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  const handle = launchEdge(edge, ["--virtual-time-budget=15000", `http://127.0.0.1:${port}/`]);
  const timer = setTimeout(() => resolveResult({ error: "diff timed out" }), 40_000);
  const result = await resultPromise;
  clearTimeout(timer);
  server.close();
  await cleanupEdge(handle);
  return result;
}

// 1. Test suite (equivalent of npm run check).
const syntaxTargets = ["scripts/injector.mjs", "scripts/theme-core.mjs", "scripts/webview-cli.mjs", "assets/renderer-inject.js"];
let suiteOk = syntaxTargets.every((file) =>
  spawnSync(process.execPath, ["--check", path.join(PROJECT_ROOT, file)], { encoding: "utf8" }).status === 0);
if (suiteOk) {
  const suite = spawnSync(process.execPath, [path.join(PROJECT_ROOT, "tests", "run-tests.mjs")],
    { cwd: PROJECT_ROOT, encoding: "utf8", timeout: 300_000 });
  suiteOk = suite.status === 0;
  if (!suiteOk) console.error(suite.stdout, suite.stderr);
}
record("test-suite", suiteOk);

// 2. Payload renders + golden diffs for every theme, light and dark.
await fs.mkdir(OUTPUT_DIR, { recursive: true });
const edge = await findEdge();
for (const theme of await listThemes({ locale: "en" })) {
  for (const mode of ["light", "dark"]) {
    const render = await renderTheme(edge, theme, mode);
    record(`render ${render.name}`, render.ok, render.ok ? render.pngPath : "screenshot missing/empty");
    if (!render.ok) continue;
    const diff = await diffAgainstGolden(edge, theme.name, render.name, render.pngPath);
    if (diff === null) continue; // no golden approved yet
    if (diff.error) { record(`golden ${render.name}`, false, diff.error); continue; }
    const pass = diff.meanDelta <= MEAN_DELTA_LIMIT && diff.changedShare <= CHANGED_SHARE_LIMIT;
    record(`golden ${render.name}`, pass,
      `meanDelta=${diff.meanDelta.toFixed(2)} changed=${(diff.changedShare * 100).toFixed(2)}%`);
  }
}

const failures = results.filter((entry) => !entry.pass);
console.log(`\n${results.length - failures.length}/${results.length} gates passed.`);
if (failures.length) {
  console.error("FAILED gates:", failures.map((entry) => entry.gate).join(", "));
  process.exitCode = 1;
} else {
  console.log("verify:cycle PASS — inspect dist/verify/*.png before claiming visual results.");
}
