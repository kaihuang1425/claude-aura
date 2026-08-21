// Aggregate runner: each domain suite already owns its isolated harness entry
// point. Run independent suites in bounded child processes so slow PowerShell
// and payload checks overlap without interleaving shared in-process state.
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = fileURLToPath(new URL("..", import.meta.url));
const suiteFiles = [
  "themes.test.mjs",
  "payload.test.mjs",
  "artwork.test.mjs",
  "theme-cli.test.mjs",
  "terminal-theme.test.mjs",
  "user-kits.test.mjs",
  "config.test.mjs",
  "avatar.test.mjs",
  "wordmark.test.mjs",
  "greeting.test.mjs",
  "greeting-runtime.test.mjs",
  "surface-overrides.test.mjs",
  "responsive-layouts.test.mjs",
  "loading-screen.test.mjs",
  "instant-prompts.test.mjs",
  "editor-overlay.test.mjs",
  "prepaint.test.mjs",
  "aura-rescue.test.mjs",
  "draft-handoff.test.mjs",
  "code-adapter.test.mjs",
  "pets.test.mjs",
  "pet-runtime-contract.test.mjs",
  "prompt-shelf.test.mjs",
  "taskboard.test.mjs",
  "session-board-ui.test.mjs",
  "session-board-host.test.mjs",
  "session-board-presentation.test.mjs",
  "desktop-session-board.test.mjs",
  "web-tabs.test.mjs",
  "session-dock.test.mjs",
  "delivery-gate.test.mjs",
  "installer.test.mjs",
  "desktop-guidance.test.mjs",
  "locales.test.mjs",
  "studio-editor.test.mjs",
  "platform.test.mjs",
];

const sourceOnlyAuraCodeDiagnosticInputs = [
  new URL("./aura-code-popup-diagnostic.test.mjs", import.meta.url),
  new URL("../windows/aura-code-popup-diagnostic.ps1", import.meta.url),
];
if (sourceOnlyAuraCodeDiagnosticInputs.every((url) => existsSync(fileURLToPath(url)))) {
  suiteFiles.push("aura-code-popup-diagnostic.test.mjs");
}

const sourceOnlyDesktopTestInputs = [
  new URL("./desktop-cdp.test.mjs", import.meta.url),
  new URL("../scripts/desktop-cdp/session.mjs", import.meta.url),
  new URL("../scripts/desktop-main-inspector.mjs", import.meta.url),
  new URL("../scripts/desktop-profile.mjs", import.meta.url),
  new URL("../windows/build-desktop-capture-filter.ps1", import.meta.url),
  new URL("../windows/desktop-aura-session.ps1", import.meta.url),
  new URL("../windows/desktop-overlay-proof.ps1", import.meta.url),
  new URL("../windows/desktop-presentation.ps1", import.meta.url),
  new URL("../windows/desktop-taskboard-panel.ps1", import.meta.url),
  new URL("../windows/native/desktop-capture-filter.cpp", import.meta.url),
];
if (sourceOnlyDesktopTestInputs.every((url) => existsSync(fileURLToPath(url)))) {
  suiteFiles.push("desktop-cdp.test.mjs");
}

const runnerArguments = process.argv.slice(2);
const focused = runnerArguments[0] === "--focus";
if (runnerArguments.length && !focused) {
  console.error("Usage: node tests/run-tests.mjs [--focus <suite> ...]");
  process.exit(2);
}
if (focused && runnerArguments.length === 1) {
  console.error("test:focus requires at least one suite name");
  process.exit(2);
}
const requestedSuites = focused
  ? runnerArguments.slice(1).map((name) => name.endsWith(".test.mjs") ? name : `${name}.test.mjs`)
  : suiteFiles;
const unknownSuites = requestedSuites.filter((file) => !suiteFiles.includes(file));
if (unknownSuites.length) {
  console.error(`Unknown test suite: ${unknownSuites.join(", ")}`);
  console.error(`Available suites: ${suiteFiles.map((file) => file.replace(/\.test\.mjs$/u, "")).join(", ")}`);
  process.exit(2);
}
const selectedSuiteFiles = [...new Set(requestedSuites)];

// Installer tests exercise the same process/operation lock as live Aura hosts,
// while platform tests rebuild shared derived assets and a release archive.
// Run both only after window-host suites and other temp-rooted work have ended.
const EXCLUSIVE_SUITES = new Set(["installer.test.mjs", "platform.test.mjs"]);
const requestedJobs = Number.parseInt(process.env.AURA_TEST_JOBS ?? "4", 10);
const MAX_PARALLEL_SUITES = Number.isInteger(requestedJobs)
  ? Math.min(8, Math.max(1, requestedJobs))
  : 4;
const verbose = process.env.AURA_TEST_VERBOSE === "1";

function runSuite(file) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [fileURLToPath(new URL(file, import.meta.url))], {
      cwd: PROJECT_ROOT,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", (error) => resolve({ file, code: -1, stdout, stderr: `${stderr}${error.stack ?? error}` }));
    child.on("close", (code) => {
      const match = /(?:^|\n)PASS (\d+) tests\s*(?:\n|$)/u.exec(stdout);
      resolve({
        file,
        code: code ?? -1,
        count: match ? Number.parseInt(match[1], 10) : 0,
        stdout,
        stderr,
      });
    });
  });
}

async function runSuites(files, jobs) {
  const results = new Array(files.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(jobs, files.length) }, async () => {
    while (next < files.length) {
      const index = next;
      next += 1;
      results[index] = await runSuite(files[index]);
    }
  }));
  return results;
}

const parallel = selectedSuiteFiles.filter((file) => !EXCLUSIVE_SUITES.has(file));
const exclusive = selectedSuiteFiles.filter((file) => EXCLUSIVE_SUITES.has(file));
const results = [
  ...await runSuites(parallel, MAX_PARALLEL_SUITES),
  ...await runSuites(exclusive, 1),
];
const failures = [];
let testCount = 0;
for (const result of results) {
  const passed = result.code === 0 && result.count > 0;
  if (passed) testCount += result.count;
  else failures.push(result);
  if (verbose || !passed) {
    process.stdout.write(`${verbose ? `\n# ${result.file}\n` : ""}${result.stdout}`);
    process.stderr.write(result.stderr);
  }
}

if (failures.length) {
  console.error(`FAIL ${failures.length} of ${results.length} suites`);
  process.exitCode = 1;
} else {
  console.log(`PASS ${testCount} tests across ${results.length} suites`);
}
