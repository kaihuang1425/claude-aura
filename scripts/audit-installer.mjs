#!/usr/bin/env node
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import { PROJECT_ROOT } from "./theme-core.mjs";

const RELEASE_ROOT = path.join(PROJECT_ROOT, "release");
const SETUP_ROOT = path.join(RELEASE_ROOT, "windows");
export const NATIVE_PAYLOAD_FORBIDDEN_FILES = Object.freeze([
  "Install Claude Aura.cmd",
  "Install Claude Aura.command",
  "Uninstall Claude Aura.cmd",
]);
export const CRITICAL_RUNTIME_FILES = Object.freeze([
  "scripts/delivery-gate.mjs",
  "scripts/theme-cli.mjs",
  "scripts/codex-session-index.mjs",
  "studio/app.js",
  "studio/index.html",
  "studio/theme-assistant.js",
  "studio/pets.css",
  "studio/pets.js",
  "studio/pets/moss.png",
  "studio/pets/nori.png",
  "studio/pets/pip.png",
  "studio/session-board.css",
  "studio/session-board.js",
  "studio/styles.css",
  "studio/taskboard.css",
  "studio/taskboard.js",
  "studio/work-hub.html",
  "studio/locales/en.js",
  "studio/locales/zh-CN.js",
  "studio/locales/zh-HKTW.js",
  "windows/aura-taskboard.ps1",
  "windows/aura-pets.ps1",
  "windows/aura-session-board-desktop.ps1",
  "windows/aura-session-dock.ps1",
  "windows/aura-taskctl.ps1",
  "windows/aura-ui.ps1",
  "windows/aura-web-tabs.ps1",
  "windows/locales/en.json",
  "windows/locales/zh-CN.json",
  "windows/locales/zh-HKTW.json",
]);

async function isFile(candidate) {
  try { return (await fs.stat(candidate)).isFile(); } catch { return false; }
}

async function sha256(candidate) {
  return crypto.createHash("sha256").update(await fs.readFile(candidate)).digest("hex");
}

async function walk(directory) {
  const output = [];
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const candidate = path.join(directory, entry.name);
    if (entry.isDirectory()) output.push(...await walk(candidate));
    else if (entry.isFile()) output.push(candidate);
  }
  return output;
}

function findEndOfCentralDirectory(bytes) {
  const minimumOffset = Math.max(0, bytes.length - 65_557);
  for (let offset = bytes.length - 22; offset >= minimumOffset; offset -= 1) {
    if (bytes.readUInt32LE(offset) === 0x06054b50) return offset;
  }
  throw new Error("Current installer payload is missing its ZIP directory.");
}

function zipEntryNames(bytes) {
  const endOffset = findEndOfCentralDirectory(bytes);
  const entryCount = bytes.readUInt16LE(endOffset + 10);
  let centralOffset = bytes.readUInt32LE(endOffset + 16);
  const names = [];
  for (let index = 0; index < entryCount; index += 1) {
    if (centralOffset + 46 > endOffset || bytes.readUInt32LE(centralOffset) !== 0x02014b50) {
      throw new Error("Current installer payload has an invalid ZIP directory entry.");
    }
    const nameLength = bytes.readUInt16LE(centralOffset + 28);
    const extraLength = bytes.readUInt16LE(centralOffset + 30);
    const commentLength = bytes.readUInt16LE(centralOffset + 32);
    names.push(bytes.subarray(centralOffset + 46, centralOffset + 46 + nameLength).toString("utf8"));
    centralOffset += 46 + nameLength + extraLength + commentLength;
  }
  return names;
}

function runReleaseBuild(outputDirectory) {
  const result = spawnSync(process.execPath, [
    "scripts/build-release.mjs",
    "--native-payload",
    "--output-directory",
    outputDirectory,
  ], {
    cwd: PROJECT_ROOT,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    windowsHide: true,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`Current payload build failed.\n${result.stdout}\n${result.stderr}`.trim());
  }
  return JSON.parse(result.stdout.trim());
}

export async function auditInstalledTree() {
  const localAppData = process.env.LOCALAPPDATA;
  if (!localAppData || !path.win32.isAbsolute(localAppData)) {
    throw new Error("LOCALAPPDATA is required to audit the installed app.");
  }
  const installedRoot = path.join(localAppData, "ClaudeAura", "app");
  for (const relative of NATIVE_PAYLOAD_FORBIDDEN_FILES) {
    if (await isFile(path.join(installedRoot, relative))) {
      throw new Error(`Installed Claude Aura contains a nested portable installer: ${relative}`);
    }
  }
  for (const relative of CRITICAL_RUNTIME_FILES) {
    const source = path.join(PROJECT_ROOT, ...relative.split("/"));
    const installed = path.join(installedRoot, ...relative.split("/"));
    if (!await isFile(installed) || await sha256(installed) !== await sha256(source)) {
      throw new Error(`Installed Claude Aura is stale or incomplete: ${relative}`);
    }
  }
  return { root: installedRoot, criticalFiles: CRITICAL_RUNTIME_FILES.length };
}

async function main() {
  const unknown = process.argv.slice(2).filter((argument) => argument !== "--installed");
  if (unknown.length > 0) throw new Error(`Unknown installer audit argument: ${unknown[0]}`);
  if (!await isFile(path.join(PROJECT_ROOT, "installer", "Build Installer.cmd"))) {
    throw new Error("The developer build launcher is missing.");
  }
  for (const legacyTemplate of [
    "Install Claude Aura.cmd",
    "Install Claude Aura.command",
    "Uninstall Claude Aura.cmd",
    "installer/release-root/Install Claude Aura.cmd",
    "installer/release-root/Install Claude Aura.command",
    "installer/release-root/Uninstall Claude Aura.cmd",
  ]) {
    if (await isFile(path.join(PROJECT_ROOT, ...legacyTemplate.split("/")))) {
      throw new Error(`Runnable installer template remains in the source tree: ${legacyTemplate}`);
    }
  }

  const releaseFiles = await walk(RELEASE_ROOT);
  const setupExecutables = releaseFiles.filter((candidate) => /\.exe$/iu.test(candidate));
  const alternateInstallers = releaseFiles.filter((candidate) =>
    /\.zip$/iu.test(candidate) || /(?:^|[\\/])Install Claude Aura\.(?:cmd|command)$/iu.test(candidate));
  if (setupExecutables.length !== 1 || alternateInstallers.length !== 0) {
    throw new Error(
      `Expected one Setup executable and no alternate installers; found ${setupExecutables.length} Setup executable(s) and ${alternateInstallers.length} alternate installer(s).`,
    );
  }
  const artifactPath = setupExecutables[0];
  if (path.dirname(path.resolve(artifactPath)) !== path.resolve(SETUP_ROOT)) {
    throw new Error("The canonical Setup executable is outside release/windows.");
  }
  const basename = path.basename(artifactPath, ".exe");
  const checksumPath = `${artifactPath}.sha256`;
  const manifestPath = path.join(SETUP_ROOT, `${basename}.manifest.json`);
  if (!await isFile(checksumPath) || !await isFile(manifestPath)) {
    throw new Error("The canonical Setup checksum or build manifest is missing.");
  }
  const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
  const artifactHash = await sha256(artifactPath);
  const artifactStat = await fs.stat(artifactPath);
  if (manifest?.artifact?.file !== path.basename(artifactPath)
      || manifest?.artifact?.sha256 !== artifactHash
      || manifest?.artifact?.bytes !== artifactStat.size) {
    throw new Error("The Setup executable does not match its build manifest.");
  }
  const expectedChecksum = `${artifactHash}  ${path.basename(artifactPath)}\n`;
  if (await fs.readFile(checksumPath, "utf8") !== expectedChecksum) {
    throw new Error("The Setup executable does not match its SHA-256 sidecar.");
  }

  const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "claude-aura-installer-audit-"));
  try {
    const current = runReleaseBuild(temporaryRoot);
    if (manifest?.payload?.profile !== "native-setup" || current.profile !== "native-setup"
        || manifest?.payload?.sha256 !== current.sha256
        || manifest?.payload?.files !== current.files
        || manifest?.payload?.bytes !== current.bytes
        || manifest?.payload?.unpackedBytes !== current.unpackedBytes) {
      throw new Error("The Setup executable embeds a stale payload; rebuild the installer.");
    }
    const names = new Set(zipEntryNames(await fs.readFile(current.outputPath)));
    for (const relative of NATIVE_PAYLOAD_FORBIDDEN_FILES) {
      if (names.has(`claude-aura/${relative}`)) {
        throw new Error(`The Setup payload includes a nested portable installer: ${relative}`);
      }
    }
    for (const relative of CRITICAL_RUNTIME_FILES) {
      if (!names.has(`claude-aura/${relative}`)) {
        throw new Error(`The Setup payload omits critical runtime file: ${relative}`);
      }
    }
  } finally {
    const resolved = path.resolve(temporaryRoot);
    const prefix = `${path.resolve(os.tmpdir())}${path.sep}claude-aura-installer-audit-`;
    if (!resolved.startsWith(prefix)) throw new Error(`Refusing to remove audit path: ${resolved}`);
    await fs.rm(resolved, { recursive: true, force: true });
  }

  const installed = process.argv.includes("--installed") ? await auditInstalledTree() : null;
  console.log(JSON.stringify({
    ok: true,
    installer: artifactPath,
    sha256: artifactHash,
    payloadSha256: manifest.payload.sha256,
    criticalFiles: CRITICAL_RUNTIME_FILES.length,
    installed,
  }, null, 2));
}

const isMain = process.argv[1]
  && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isMain) {
  try {
    await main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
