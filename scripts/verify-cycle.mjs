#!/usr/bin/env node
// Non-image verification for the production renderer. This command never
// opens a fixture, launches a browser, or writes visual artifacts. Visual
// review belongs exclusively to the real Aura WebView2 window on claude.ai.
import { spawnSync } from "node:child_process";
import path from "node:path";
import {
  PROJECT_ROOT,
  DEFAULT_CONFIG,
  buildPayload,
  listThemes,
} from "./theme-core.mjs";

const MODES = ["light", "dark"];
const results = [];

function record(gate, pass, detail = "") {
  results.push({ gate, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${gate}${detail ? `  ${detail}` : ""}`);
}

function runCheckSuite() {
  const syntaxTargets = [
    "scripts/injector.mjs",
    "scripts/theme-core.mjs",
    "scripts/webview-cli.mjs",
    "assets/renderer-inject.js",
  ];
  for (const file of syntaxTargets) {
    const check = spawnSync(process.execPath, ["--check", path.join(PROJECT_ROOT, file)], {
      cwd: PROJECT_ROOT,
      encoding: "utf8",
    });
    if (check.status !== 0) {
      process.stderr.write(check.stdout ?? "");
      process.stderr.write(check.stderr ?? "");
      return false;
    }
  }
  const suite = spawnSync(process.execPath, [path.join(PROJECT_ROOT, "tests", "run-tests.mjs")], {
    cwd: PROJECT_ROOT,
    encoding: "utf8",
    timeout: 300_000,
  });
  if (suite.status !== 0) {
    process.stderr.write(suite.stdout ?? "");
    process.stderr.write(suite.stderr ?? "");
    return false;
  }
  return true;
}

record("test-suite", runCheckSuite());

for (const theme of await listThemes({ locale: "en" })) {
  for (const mode of MODES) {
    const gate = `payload ${theme.name}-${mode}`;
    try {
      const bundle = await buildPayload({
        config: { ...DEFAULT_CONFIG, theme: theme.name, appearance: mode },
        locale: "en",
      });
      // Parse the exact renderer program that the real WebView receives.
      new Function(bundle.payload);
      const settingsValid = bundle.settings.theme === theme.name
        && bundle.settings.appearance === mode
        && bundle.settings.artUnavailable === false
        && typeof bundle.settings.digest === "string"
        && bundle.settings.digest.length === 64;
      record(gate, settingsValid, `${Buffer.byteLength(bundle.payload, "utf8")} payload bytes`);
    } catch (error) {
      record(gate, false, error instanceof Error ? error.message : String(error));
    }
  }
}

const failures = results.filter((entry) => !entry.pass);
console.log(`\n${results.length - failures.length}/${results.length} gates passed.`);
if (failures.length) {
  console.error("FAILED gates:", failures.map((entry) => entry.gate).join(", "));
  process.exitCode = 1;
} else {
  console.log("verify:cycle PASS — payload-only checks complete; visual approval requires actual Aura on live claude.ai.");
}
