#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const INSTALLER_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(INSTALLER_DIRECTORY, "..");

function parseArguments(argv) {
  const options = {
    mode: null,
    open: true,
    pause: true,
    help: false,
  };
  for (const argument of argv) {
    if (argument === "--signed"
        || argument === "--unsigned" || argument === "--unsigned-dev") {
      const nextMode = argument === "--signed"
        ? "signed"
        : argument === "--unsigned"
          ? "unsigned-release"
          : "unsigned-development";
      if (options.mode && options.mode !== nextMode) {
        throw new Error(
          "Choose only one output mode: --signed, --unsigned, or --unsigned-dev.",
        );
      }
      options.mode = nextMode;
    }
    else if (argument === "--no-open") options.open = false;
    else if (argument === "--no-pause") options.pause = false;
    else if (argument === "--help") {
      options.help = true;
      options.pause = false;
    } else {
      throw new Error(`Unknown option: ${argument}\nRun "Build Installer.cmd --help" for usage.`);
    }
  }
  options.mode ??= "unsigned-development";
  return options;
}

function printHelp() {
  console.log(`Build the current Claude Aura release for Windows.

Double-click:
  Builds the one local-development Setup executable.

Options:
  --signed         Build the signed public Setup executable. Signing is required.
  --unsigned       Build the clearly marked unsigned public Setup executable.
  --unsigned-dev   Build the local-development Setup executable (default).
  --no-open        Do not open File Explorer after a successful build.
  --no-pause       Return immediately instead of waiting for Enter.
  --help           Show this help.`);
}

function runNpm(script) {
  const commandProcessor = process.env.ComSpec;
  if (!commandProcessor || !path.win32.isAbsolute(commandProcessor)
      || path.win32.basename(commandProcessor).toLowerCase() !== "cmd.exe") {
    throw new Error("ComSpec must resolve to the absolute Windows command processor.");
  }
  const result = spawnSync(commandProcessor, ["/d", "/s", "/c", `npm.cmd run ${script}`], {
    cwd: PROJECT_ROOT,
    stdio: "inherit",
    windowsHide: false,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${script} failed with exit code ${result.status}.`);
  }
}

async function pauseIfRequested(pause) {
  if (!pause || !process.stdin.isTTY) return;
  process.stdout.write("\nPress Enter to close...");
  process.stdin.resume();
  await new Promise((resolve) => process.stdin.once("data", resolve));
}

async function main(options) {
  if (options.help) {
    printHelp();
    return;
  }
  if (process.platform !== "win32") {
    throw new Error("The Claude Aura Windows installer can only be built on Windows.");
  }
  const nodeMajor = Number.parseInt(process.versions.node.split(".")[0], 10);
  if (!Number.isInteger(nodeMajor) || nodeMajor < 22) {
    throw new Error(`Node.js 22 or newer is required. Current version: ${process.versions.node}`);
  }

  const buildScript = options.mode === "signed"
    ? "installer"
    : options.mode === "unsigned-release"
      ? "installer:unsigned"
      : "installer:dev";
  const buildLabel = options.mode === "signed"
    ? "signed Setup"
    : options.mode === "unsigned-release"
      ? "unsigned public Setup"
      : "unsigned development Setup";
  console.log(`\nClaude Aura release build\nMode: ${buildLabel}`);

  console.log("\n[1/3] Checking the repository...");
  runNpm("check");

  console.log("\n[2/3] Verifying every built-in theme...");
  runNpm("verify:cycle");

  console.log("\n[3/3] Building the release artifact...");
  runNpm(buildScript);

  const packageJson = JSON.parse(
    await fs.readFile(path.join(PROJECT_ROOT, "package.json"), "utf8"),
  );
  if (typeof packageJson.version !== "string"
      || !/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/u.test(packageJson.version)) {
    throw new Error("package.json does not contain a valid installer version.");
  }
  const basename = options.mode === "signed"
    ? `Claude-Aura-Setup-v${packageJson.version}.exe`
    : options.mode === "unsigned-release"
      ? `Claude-Aura-Setup-v${packageJson.version}-UNSIGNED.exe`
      : `Claude-Aura-Setup-v${packageJson.version}-UNSIGNED-DEV.exe`;
  const outputDirectory = "windows";
  const outputPath = path.join(PROJECT_ROOT, "release", outputDirectory, basename);
  const output = await fs.stat(outputPath).catch(() => null);
  if (!output?.isFile()) {
    throw new Error(`The build completed, but the expected installer is missing:\n${outputPath}`);
  }

  console.log(`\nRelease artifact ready:\n${outputPath}`);
  console.log("\nThe matching SHA-256 file and build manifest are in the same folder.");
  if (options.mode === "unsigned-release") {
    console.log("Windows cannot verify this unsigned publisher.");
    console.log("Publish it only with its checksum.");
  }
  if (options.open) {
    const explorer = spawnSync("explorer.exe", [`/select,${outputPath}`], {
      cwd: PROJECT_ROOT,
      stdio: "ignore",
      windowsHide: true,
    });
    if (explorer.error) {
      console.warn(`Could not open File Explorer: ${explorer.error.message}`);
    }
  }
}

let options;
try {
  options = parseArguments(process.argv.slice(2));
  await main(options);
} catch (error) {
  console.error(`\nInstaller build stopped:\n${error instanceof Error ? error.message : error}`);
  process.exitCode = 1;
} finally {
  await pauseIfRequested(options?.pause ?? true);
}
