#!/usr/bin/env node
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import { auditInstalledTree } from "./audit-installer.mjs";
import { PROJECT_ROOT } from "./theme-core.mjs";

export const DELIVERY_RECEIPT_PATH = path.join(PROJECT_ROOT, "dist", "delivery", "latest.json");
export const LIVE_EVIDENCE_ROOT = path.join(PROJECT_ROOT, "dist", "verify", "live-aura");
export const LIVE_ACCEPTANCE_PATH = path.join(LIVE_EVIDENCE_ROOT, "delivery-acceptance.json");
export const LIVE_ACCEPTANCE_CHECKS = Object.freeze([
  "realClaudeWebHost",
  "themeSurvivesCodeRoundTrip",
  "tabbedWindowInterface",
  "workHubUsesRealSessions",
  "petsLoadWithSettings",
  "settingsSurviveRestart",
  "originalLookRestores",
]);

const SETUP_ROOT = path.join(PROJECT_ROOT, "release", "windows");
const MIN_CAPTURE_BYTES = 10 * 1024;
const MAX_CAPTURE_BYTES = 30 * 1024 * 1024;
const DELIVERY_SCHEMA_VERSION = 1;

async function isFile(candidate) {
  try { return (await fs.stat(candidate)).isFile(); } catch { return false; }
}

async function sha256File(candidate) {
  return crypto.createHash("sha256").update(await fs.readFile(candidate)).digest("hex");
}

function safeRelativePath(relativePath) {
  const normalized = String(relativePath).replaceAll("\\", "/");
  if (!normalized || normalized.startsWith("/") || /^[a-z]:/iu.test(normalized)
      || normalized.includes("\0")
      || normalized.split("/").some((segment) => !segment || segment === "." || segment === "..")) {
    throw new Error(`Unsafe delivery path: ${relativePath}`);
  }
  return normalized;
}

export async function sourceFingerprint(projectRoot = PROJECT_ROOT) {
  const manifestPath = path.join(projectRoot, "docs", "FILE_MANIFEST.md");
  const manifest = await fs.readFile(manifestPath, "utf8");
  const listed = [...manifest.matchAll(/^- `([^`]+)`$/gmu)].map((match) => match[1]);
  const relativeFiles = [...new Set([...listed, "AGENTS.md"])].map(safeRelativePath).sort();
  if (relativeFiles.length !== listed.length + 1) {
    throw new Error("The deliverable manifest contains duplicate paths.");
  }
  const root = path.resolve(projectRoot);
  const rootPrefix = `${root}${path.sep}`;
  const digest = crypto.createHash("sha256");
  for (const relative of relativeFiles) {
    const absolute = path.resolve(root, ...relative.split("/"));
    if (!absolute.startsWith(rootPrefix)) throw new Error(`Delivery path escaped the repository: ${relative}`);
    const stat = await fs.lstat(absolute).catch(() => null);
    if (!stat?.isFile() || stat.isSymbolicLink()) {
      throw new Error(`Delivery source is missing or unsafe: ${relative}`);
    }
    digest.update(relative, "utf8");
    digest.update("\0", "utf8");
    digest.update(await fs.readFile(absolute));
    digest.update("\0", "utf8");
  }
  return { sha256: digest.digest("hex"), files: relativeFiles.length };
}

async function walkFiles(directory) {
  const output = [];
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const candidate = path.join(directory, entry.name);
    if (entry.isDirectory()) output.push(...await walkFiles(candidate));
    else if (entry.isFile()) output.push(candidate);
  }
  return output;
}

export async function inspectCanonicalInstaller(projectRoot = PROJECT_ROOT) {
  const releaseRoot = path.join(projectRoot, "release");
  const setupRoot = path.join(releaseRoot, "windows");
  const releaseFiles = await walkFiles(releaseRoot).catch(() => []);
  const executables = releaseFiles.filter((candidate) => /\.exe$/iu.test(candidate));
  const alternateInstallers = releaseFiles.filter((candidate) =>
    /\.zip$/iu.test(candidate) || /(?:^|[\\/])Install Claude Aura\.(?:cmd|command)$/iu.test(candidate));
  if (executables.length !== 1 || alternateInstallers.length !== 0) {
    throw new Error(
      `Expected one canonical Setup and no alternate installers; found ${executables.length} Setup executable(s) and ${alternateInstallers.length} alternate installer(s).`,
    );
  }
  const artifactPath = path.resolve(executables[0]);
  if (path.dirname(artifactPath) !== path.resolve(setupRoot)) {
    throw new Error("The canonical Setup executable is outside release/windows.");
  }
  const basename = path.basename(artifactPath, ".exe");
  const manifestPath = path.join(setupRoot, `${basename}.manifest.json`);
  const checksumPath = `${artifactPath}.sha256`;
  if (!await isFile(manifestPath) || !await isFile(checksumPath)) {
    throw new Error("The canonical Setup manifest or checksum is missing.");
  }
  const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
  const artifactSha256 = await sha256File(artifactPath);
  const artifactBytes = (await fs.stat(artifactPath)).size;
  if (manifest?.schemaVersion !== 2
      || manifest?.artifact?.file !== path.basename(artifactPath)
      || manifest?.artifact?.sha256 !== artifactSha256
      || manifest?.artifact?.bytes !== artifactBytes
      || manifest?.payload?.profile !== "native-setup"
      || !/^[0-9a-f]{64}$/u.test(manifest?.payload?.sha256 ?? "")) {
    throw new Error("The canonical Setup does not match its native-payload manifest.");
  }
  const checksum = await fs.readFile(checksumPath, "utf8");
  if (checksum !== `${artifactSha256}  ${path.basename(artifactPath)}\n`) {
    throw new Error("The canonical Setup does not match its SHA-256 sidecar.");
  }
  return {
    path: artifactPath,
    file: path.basename(artifactPath),
    sha256: artifactSha256,
    bytes: artifactBytes,
    payloadSha256: manifest.payload.sha256,
    payloadFiles: manifest.payload.files,
    buildType: manifest.buildType,
    releaseEligible: manifest.releaseEligible === true,
  };
}

function windowsPowerShellPath() {
  const windowsRoot = process.env.SystemRoot ?? process.env.WINDIR;
  if (!windowsRoot || !path.win32.isAbsolute(windowsRoot)) {
    throw new Error("SystemRoot must resolve to an absolute Windows directory.");
  }
  return path.win32.join(
    path.win32.resolve(windowsRoot),
    "System32",
    "WindowsPowerShell",
    "v1.0",
    "powershell.exe",
  );
}

export function installedAuraScript() {
  const localAppData = process.env.LOCALAPPDATA;
  if (!localAppData || !path.win32.isAbsolute(localAppData)) {
    throw new Error("LOCALAPPDATA must resolve to an absolute Windows directory.");
  }
  return path.win32.join(path.win32.resolve(localAppData), "ClaudeAura", "app", "windows", "aura-ui.ps1");
}

export function queryInstalledRuntime() {
  if (process.platform !== "win32") return { running: false, processes: [] };
  const powerShell = windowsPowerShellPath();
  const script = [
    "$ErrorActionPreference='Stop'",
    "$expected=[IO.Path]::GetFullPath($env:AURA_INSTALLED_SCRIPT)",
    "$rows=@(Get-CimInstance Win32_Process -Filter \"Name = 'powershell.exe'\" | Where-Object {",
    "  $_.ProcessId -ne $PID -and $_.CommandLine -and",
    "  $_.CommandLine.IndexOf($expected,[StringComparison]::OrdinalIgnoreCase) -ge 0",
    "} | ForEach-Object {",
    "  $native=Get-Process -Id $_.ProcessId -ErrorAction SilentlyContinue",
    "  if($native){[pscustomobject]@{pid=[int]$_.ProcessId;responding=[bool]$native.Responding;title=[string]$native.MainWindowTitle;handle=[int64]$native.MainWindowHandle}}",
    "})",
    "[pscustomobject]@{running=($rows.Count -gt 0);processes=$rows} | ConvertTo-Json -Compress -Depth 4",
  ].join("\n");
  const result = spawnSync(powerShell, ["-NoProfile", "-NonInteractive", "-Command", script], {
    cwd: PROJECT_ROOT,
    encoding: "utf8",
    windowsHide: true,
    env: { ...process.env, AURA_INSTALLED_SCRIPT: installedAuraScript() },
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`Installed Aura runtime query failed: ${(result.stderr || result.stdout).trim()}`);
  }
  const parsed = JSON.parse(result.stdout.trim());
  return {
    running: parsed.running === true,
    processes: Array.isArray(parsed.processes)
      ? parsed.processes
      : parsed.processes ? [parsed.processes] : [],
  };
}

function operationLockAvailable() {
  const script = [
    "$ErrorActionPreference='Stop'",
    "$sid=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value",
    "$mutex=[Threading.Mutex]::new($false,\"Local\\ClaudeAura.$sid.Operation\")",
    "$acquired=$false",
    "try {",
    "  try {$acquired=$mutex.WaitOne(0)} catch [Threading.AbandonedMutexException] {$acquired=$true}",
    "  if($acquired){'true'}else{'false'}",
    "} finally {",
    "  if($acquired){$mutex.ReleaseMutex()}",
    "  $mutex.Dispose()",
    "}",
  ].join("\n");
  const result = spawnSync(windowsPowerShellPath(), [
    "-NoProfile", "-NonInteractive", "-Command", script,
  ], { cwd: PROJECT_ROOT, encoding: "utf8", windowsHide: true });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`Aura operation-lock query failed: ${(result.stderr || result.stdout).trim()}`);
  }
  return result.stdout.trim() === "true";
}

async function waitForInstallIdle(timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (operationLockAvailable()) return;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error("The installer finished, but its Aura operation lock did not become idle within 30 seconds.");
}

async function readJson(candidate) {
  return JSON.parse(await fs.readFile(candidate, "utf8"));
}

async function readJsonResult(candidate) {
  try { return { value: await readJson(candidate), error: null }; }
  catch (error) { return { value: null, error: error instanceof Error ? error.message : String(error) }; }
}

function receiptMatches(receipt, source, installer) {
  return receipt?.schemaVersion === DELIVERY_SCHEMA_VERSION
    && receipt?.source?.sha256 === source.sha256
    && receipt?.source?.files === source.files
    && receipt?.installer?.file === installer.file
    && receipt?.installer?.sha256 === installer.sha256
    && receipt?.installer?.payloadSha256 === installer.payloadSha256
    && receipt?.checks?.repository === true
    && receipt?.checks?.themes === true
    && receipt?.checks?.installer === true
    && receipt?.checks?.installed === true;
}

async function assertNoSymlinkPath(candidate, root) {
  const relative = path.relative(root, candidate);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("Live capture must be a file below dist/verify/live-aura.");
  }
  let current = root;
  for (const segment of relative.split(path.sep)) {
    current = path.join(current, segment);
    const stat = await fs.lstat(current);
    if (stat.isSymbolicLink()) throw new Error("Live capture paths must not use symbolic links.");
  }
}

export async function inspectLiveCapture(captureValue, receipt) {
  const capturePath = path.resolve(
    path.isAbsolute(captureValue) ? captureValue : path.join(PROJECT_ROOT, captureValue),
  );
  const evidenceRoot = path.resolve(LIVE_EVIDENCE_ROOT);
  const relativeToEvidence = path.relative(evidenceRoot, capturePath);
  if (!relativeToEvidence || relativeToEvidence.startsWith("..") || path.isAbsolute(relativeToEvidence)) {
    throw new Error("Live capture must be a file below dist/verify/live-aura.");
  }
  if (!/\.(?:png|jpe?g)$/iu.test(capturePath)) {
    throw new Error("Live capture must be a PNG or JPEG image.");
  }
  await assertNoSymlinkPath(capturePath, evidenceRoot);
  const stat = await fs.stat(capturePath);
  if (!stat.isFile() || stat.size < MIN_CAPTURE_BYTES || stat.size > MAX_CAPTURE_BYTES) {
    throw new Error("Live capture size is outside the 10 KB to 30 MB evidence bound.");
  }
  const bytes = await fs.readFile(capturePath);
  const png = bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes.at(-2) === 0xff && bytes.at(-1) === 0xd9;
  if (!png && !jpeg) throw new Error("Live capture content does not match PNG or JPEG.");
  const verifiedAt = Date.parse(receipt?.verifiedAt ?? "");
  if (!Number.isFinite(verifiedAt) || stat.mtimeMs + 1000 < verifiedAt) {
    throw new Error("Live capture predates the current installed delivery receipt.");
  }
  return {
    path: path.relative(PROJECT_ROOT, capturePath).replaceAll("\\", "/"),
    sha256: crypto.createHash("sha256").update(bytes).digest("hex"),
    bytes: stat.size,
  };
}

export async function validateAcceptanceEvidence(acceptance, receipt, installer) {
  if (acceptance?.schemaVersion !== DELIVERY_SCHEMA_VERSION
      || acceptance?.approvedBy !== "user"
      || acceptance?.sourceSha256 !== receipt?.source?.sha256
      || acceptance?.setupSha256 !== installer?.sha256
      || acceptance?.payloadSha256 !== installer?.payloadSha256
      || !Number.isFinite(Date.parse(acceptance?.approvedAt ?? ""))
      || Date.parse(acceptance.approvedAt) < Date.parse(receipt?.verifiedAt ?? "")) {
    throw new Error("Live approval is missing or belongs to a different delivery.");
  }
  const keys = Object.keys(acceptance.checks ?? {}).sort();
  if (keys.join("\0") !== [...LIVE_ACCEPTANCE_CHECKS].sort().join("\0")
      || LIVE_ACCEPTANCE_CHECKS.some((name) => acceptance.checks[name] !== true)) {
    throw new Error("Live approval does not confirm the complete acceptance checklist.");
  }
  const capture = await inspectLiveCapture(acceptance.capture, receipt);
  if (capture.sha256 !== acceptance.captureSha256 || capture.bytes !== acceptance.captureBytes) {
    throw new Error("The approved live capture changed after approval.");
  }
  return capture;
}

export function evaluateDelivery(stages) {
  const names = ["source", "installer", "installed", "runtime", "liveReview"];
  const normalized = Object.fromEntries(names.map((name) => [name, {
    pass: stages?.[name]?.pass === true,
    detail: stages?.[name]?.detail ?? "No evidence.",
  }]));
  const preReviewReady = names.slice(0, 4).every((name) => normalized[name].pass);
  const done = preReviewReady && normalized.liveReview.pass;
  const overall = done ? "done" : preReviewReady ? "ready-for-live-review" : "blocked";
  const nextByStage = {
    source: "Run npm.cmd run delivery:refresh after a fresh desktop check and a normal Aura exit.",
    installer: "Run npm.cmd run delivery:refresh to rebuild and install the one canonical Setup.",
    installed: "Run npm.cmd run delivery:refresh to replace the installed app with the current Setup.",
    runtime: "Launch the installed Claude Aura Studio, then rerun npm.cmd run delivery:gate.",
    liveReview: "Capture the actual whole Aura window, verify all seven behaviors, then record explicit user approval.",
  };
  const firstFailure = names.find((name) => !normalized[name].pass);
  return {
    overall,
    stages: normalized,
    nextAction: firstFailure ? nextByStage[firstFailure] : "No delivery action remains.",
  };
}

export async function inspectDelivery() {
  const receiptResult = await readJsonResult(DELIVERY_RECEIPT_PATH);
  const receipt = receiptResult.value;
  let source = null;
  let sourceError = null;
  try { source = await sourceFingerprint(); } catch (error) { sourceError = error instanceof Error ? error.message : String(error); }
  let installer = null;
  let installerError = null;
  try { installer = await inspectCanonicalInstaller(); } catch (error) { installerError = error instanceof Error ? error.message : String(error); }
  let installed = null;
  let installedError = null;
  try { installed = await auditInstalledTree(); } catch (error) { installedError = error instanceof Error ? error.message : String(error); }
  let runtime = null;
  let runtimeError = null;
  try { runtime = queryInstalledRuntime(); } catch (error) { runtimeError = error instanceof Error ? error.message : String(error); }

  const receiptCurrent = source && installer && receiptMatches(receipt, source, installer);
  let acceptance = null;
  let acceptanceError = null;
  if (receiptCurrent) {
    const acceptanceResult = await readJsonResult(LIVE_ACCEPTANCE_PATH);
    acceptance = acceptanceResult.value;
    acceptanceError = acceptanceResult.error;
    if (acceptance) {
      try { await validateAcceptanceEvidence(acceptance, receipt, installer); acceptanceError = null; }
      catch (error) { acceptanceError = error instanceof Error ? error.message : String(error); }
    }
  }
  const responsive = runtime?.running === true
    && runtime.processes.length > 0
    && runtime.processes.every((item) => item.responding === true);
  return {
    ...evaluateDelivery({
      source: {
        pass: Boolean(receiptCurrent),
        detail: receiptCurrent
          ? `${source.files} manifest-owned source files match the delivery receipt.`
          : sourceError ?? receiptResult.error ?? "Source changed after the last delivery refresh.",
      },
      installer: {
        pass: Boolean(receiptCurrent),
        detail: receiptCurrent
          ? `${installer.file} matches its manifest, checksum, and delivery receipt.`
          : installerError ?? "The canonical Setup is missing, stale, or not tied to current source.",
      },
      installed: {
        pass: Boolean(installed),
        detail: installed
          ? `${installed.criticalFiles} critical files match the repository.`
          : installedError ?? "Installed payload evidence is unavailable.",
      },
      runtime: {
        pass: responsive,
        detail: responsive
          ? `Installed Aura host is running and responsive (PID ${runtime.processes.map((item) => item.pid).join(", ")}).`
          : runtimeError ?? "No responsive installed Aura host was found.",
      },
      liveReview: {
        pass: Boolean(acceptance && !acceptanceError),
        detail: acceptance && !acceptanceError
          ? `Explicit user approval is bound to ${acceptance.capture}.`
          : acceptanceError ?? "No explicit user-approved whole-window live review is bound to this delivery.",
      },
    }),
    receipt,
    source,
    installer,
    installed,
    runtime,
  };
}

function printDelivery(result) {
  console.log(`Claude Aura delivery: ${result.overall.toUpperCase().replaceAll("-", " ")}`);
  for (const [name, label] of [
    ["source", "Source"],
    ["installer", "Setup"],
    ["installed", "Installed"],
    ["runtime", "Runtime"],
    ["liveReview", "Live review"],
  ]) {
    const stage = result.stages[name];
    console.log(`${stage.pass ? "PASS" : "WAIT"} ${label}: ${stage.detail}`);
  }
  if (result.installer) {
    console.log(`Distribution: ${result.installer.releaseEligible ? "release eligible" : `${result.installer.buildType}; not release eligible`}`);
  }
  console.log(`Next: ${result.nextAction}`);
}

function runChecked(command, args, label, options = {}) {
  const result = spawnSync(command, args, {
    cwd: PROJECT_ROOT,
    stdio: "inherit",
    windowsHide: false,
    ...options,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${label} failed with exit code ${result.status}.`);
}

function runNpm(script) {
  const commandProcessor = process.env.ComSpec;
  if (!commandProcessor || !path.win32.isAbsolute(commandProcessor)
      || path.win32.basename(commandProcessor).toLowerCase() !== "cmd.exe") {
    throw new Error("ComSpec must resolve to the absolute Windows command processor.");
  }
  runChecked(commandProcessor, ["/d", "/s", "/c", `npm.cmd run ${script}`], script);
}

async function replaceJson(destination, value) {
  const directory = path.dirname(destination);
  await fs.mkdir(directory, { recursive: true });
  const token = crypto.randomBytes(8).toString("hex");
  const temporary = path.join(directory, `.${path.basename(destination)}.incoming-${token}`);
  const backup = path.join(directory, `.${path.basename(destination)}.previous-${token}`);
  await fs.writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
  let movedPrevious = false;
  try {
    if (await isFile(destination)) {
      await fs.rename(destination, backup);
      movedPrevious = true;
    }
    await fs.rename(temporary, destination);
    if (movedPrevious) await fs.rm(backup, { force: true });
  } catch (error) {
    await fs.rm(temporary, { force: true }).catch(() => {});
    if (movedPrevious && !await isFile(destination)) await fs.rename(backup, destination).catch(() => {});
    throw error;
  }
}

async function launchInstalledStudio() {
  const scriptPath = installedAuraScript();
  if (!await isFile(scriptPath)) throw new Error(`Installed Aura host is missing: ${scriptPath}`);
  const powerShell = windowsPowerShellPath();
  const bootstrap = [
    "$ErrorActionPreference='Stop'",
    "$hostExe=[IO.Path]::GetFullPath($env:AURA_POWERSHELL)",
    "$scriptPath=[IO.Path]::GetFullPath($env:AURA_INSTALLED_SCRIPT)",
    "$workingRoot=[IO.Path]::GetFullPath($env:AURA_INSTALLED_ROOT)",
    "$arguments=@('-NoProfile','-STA','-ExecutionPolicy','Bypass','-WindowStyle','Hidden','-File',('\"'+$scriptPath+'\"'),'-OpenStudio')",
    "$child=Start-Process -FilePath $hostExe -ArgumentList $arguments -WorkingDirectory $workingRoot -WindowStyle Hidden -PassThru",
    "[pscustomobject]@{pid=[int]$child.Id} | ConvertTo-Json -Compress",
  ].join("\n");
  const result = spawnSync(powerShell, ["-NoProfile", "-NonInteractive", "-Command", bootstrap], {
    cwd: path.dirname(path.dirname(scriptPath)),
    encoding: "utf8",
    windowsHide: true,
    env: {
      ...process.env,
      AURA_POWERSHELL: powerShell,
      AURA_INSTALLED_SCRIPT: scriptPath,
      AURA_INSTALLED_ROOT: path.dirname(path.dirname(scriptPath)),
    },
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`Installed Aura Studio launch failed: ${(result.stderr || result.stdout).trim()}`);
  }
  const launched = JSON.parse(result.stdout.trim());
  if (!Number.isInteger(launched?.pid) || launched.pid <= 0) {
    throw new Error("Windows did not return a valid installed Aura host process ID.");
  }
  return launched;
}

async function waitForRuntime(timeoutMs = 20_000) {
  const deadline = Date.now() + timeoutMs;
  let last = { running: false, processes: [] };
  while (Date.now() < deadline) {
    last = queryInstalledRuntime();
    if (last.running && last.processes.length
        && last.processes.every((item) => item.responding === true)) return last;
    await new Promise((resolve) => setTimeout(resolve, 800));
  }
  return last;
}

async function refreshDelivery() {
  if (process.platform !== "win32") throw new Error("Delivery refresh is supported only on Windows.");
  const before = queryInstalledRuntime();
  if (before.running) {
    throw new Error(
      "Claude Aura is running. Inspect the fresh desktop with Computer Use, exit Aura through its window or tray, then rerun delivery:refresh. The guardrail never force-closes it.",
    );
  }
  console.log("[1/5] Repository checks");
  runNpm("check");
  console.log("[2/5] Theme cycle");
  runNpm("verify:cycle");
  console.log("[3/5] Canonical Setup build and audit");
  runNpm("installer:dev");
  const installer = await inspectCanonicalInstaller();
  console.log("[4/5] Install the exact audited Setup");
  runChecked(installer.path, ["/VERYSILENT", "/SUPPRESSMSGBOXES", "/NORESTART"], "Canonical Setup installation");
  runChecked(process.execPath, ["scripts/audit-installer.mjs", "--installed"], "Installed payload audit");
  const source = await sourceFingerprint();
  const receipt = {
    schemaVersion: DELIVERY_SCHEMA_VERSION,
    source,
    installer: {
      file: installer.file,
      sha256: installer.sha256,
      payloadSha256: installer.payloadSha256,
      buildType: installer.buildType,
      releaseEligible: installer.releaseEligible,
    },
    checks: { repository: true, themes: true, installer: true, installed: true },
    verifiedAt: new Date().toISOString(),
  };
  await replaceJson(DELIVERY_RECEIPT_PATH, receipt);
  await waitForInstallIdle();
  console.log("[5/5] Launch installed Aura Studio for live review");
  await launchInstalledStudio();
  const runtime = await waitForRuntime();
  if (!runtime.running || !runtime.processes.length
      || runtime.processes.some((item) => item.responding !== true)) {
    throw new Error("The current Setup installed, but its Aura host did not become responsive.");
  }
  const result = await inspectDelivery();
  printDelivery(result);
  if (result.overall !== "ready-for-live-review" && result.overall !== "done") {
    throw new Error("Delivery refresh completed, but the delivery gate is not ready for live review.");
  }
}

function parseAcceptanceArguments(argv) {
  let capture = null;
  let userApprovedAll = false;
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--capture") {
      capture = argv[index + 1] ?? null;
      index += 1;
      if (!capture) throw new Error("--capture requires an image path.");
    } else if (argument === "--user-approved-all") {
      userApprovedAll = true;
    } else {
      throw new Error(`Unknown acceptance argument: ${argument}`);
    }
  }
  if (!capture || !userApprovedAll) {
    throw new Error("Acceptance requires --capture <path> and --user-approved-all after explicit user approval.");
  }
  return { capture, userApprovedAll };
}

async function recordAcceptance(argv) {
  const options = parseAcceptanceArguments(argv);
  const delivery = await inspectDelivery();
  const prereviewNames = ["source", "installer", "installed", "runtime"];
  if (prereviewNames.some((name) => !delivery.stages[name].pass)) {
    throw new Error(`Live approval cannot be recorded yet. ${delivery.nextAction}`);
  }
  const capture = await inspectLiveCapture(options.capture, delivery.receipt);
  await replaceJson(LIVE_ACCEPTANCE_PATH, {
    schemaVersion: DELIVERY_SCHEMA_VERSION,
    sourceSha256: delivery.receipt.source.sha256,
    setupSha256: delivery.installer.sha256,
    payloadSha256: delivery.installer.payloadSha256,
    capture: capture.path,
    captureSha256: capture.sha256,
    captureBytes: capture.bytes,
    approvedBy: "user",
    approvedAt: new Date().toISOString(),
    checks: Object.fromEntries(LIVE_ACCEPTANCE_CHECKS.map((name) => [name, true])),
  });
  const result = await inspectDelivery();
  printDelivery(result);
  if (result.overall !== "done") throw new Error("The recorded approval did not satisfy the delivery gate.");
}

function usage() {
  return [
    "Usage:",
    "  node scripts/delivery-gate.mjs status",
    "  node scripts/delivery-gate.mjs refresh",
    "  node scripts/delivery-gate.mjs gate",
    "  node scripts/delivery-gate.mjs accept --capture <path> --user-approved-all",
  ].join("\n");
}

async function main(argv) {
  const [command = "status", ...rest] = argv;
  if (command === "status" && rest.length === 0) {
    printDelivery(await inspectDelivery());
    return;
  }
  if (command === "gate" && rest.length === 0) {
    const result = await inspectDelivery();
    printDelivery(result);
    if (result.overall !== "done") process.exitCode = 1;
    return;
  }
  if (command === "refresh" && rest.length === 0) {
    await refreshDelivery();
    return;
  }
  if (command === "accept") {
    await recordAcceptance(rest);
    return;
  }
  throw new Error(usage());
}

const isMain = process.argv[1]
  && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isMain) {
  try { await main(process.argv.slice(2)); }
  catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
