import crypto from "node:crypto";
import { existsSync } from "node:fs";
import { test, runIfMain } from "./support/harness.mjs";
import {
  LIVE_ACCEPTANCE_CHECKS,
  evaluateDelivery,
  inspectLiveCapture,
  sourceFingerprint,
  validateAcceptanceEvidence,
} from "../scripts/delivery-gate.mjs";
import {
  PROJECT_ROOT,
  assert,
  fs,
  path,
} from "./support/context.mjs";

const deliveryScriptPath = path.join(PROJECT_ROOT, "scripts", "delivery-gate.mjs");
const deliveryDocumentPath = path.join(PROJECT_ROOT, "docs", "DELIVERY_GUARDRAIL.md");
const hasLocalAgentContract = existsSync(path.join(PROJECT_ROOT, "AGENTS.md"));
const localContractTest = hasLocalAgentContract ? test : () => {};

const stages = (value) => Object.fromEntries([
  "source", "installer", "installed", "runtime", "liveReview",
].map((name) => [name, { pass: value, detail: `${name} evidence` }]));

test("delivery state cannot skip installed or user-approved live evidence", () => {
  const blocked = stages(true);
  blocked.installed.pass = false;
  assert.equal(evaluateDelivery(blocked).overall, "blocked");
  assert.match(evaluateDelivery(blocked).nextAction, /delivery:refresh/u);

  const review = stages(true);
  review.liveReview.pass = false;
  assert.equal(evaluateDelivery(review).overall, "ready-for-live-review");
  assert.match(evaluateDelivery(review).nextAction, /actual whole Aura window/u);

  assert.equal(evaluateDelivery(stages(true)).overall, "done");
});

localContractTest("delivery source receipt covers the manifest-owned tree and local agent contract", async () => {
  const fingerprint = await sourceFingerprint();
  assert.match(fingerprint.sha256, /^[0-9a-f]{64}$/u);
  assert(fingerprint.files > 200, "Delivery fingerprint unexpectedly covers too few files");
  const source = await fs.readFile(deliveryScriptPath, "utf8");
  assert.match(source, /FILE_MANIFEST\.md/);
  assert.match(source, /\[\.\.\.listed, "AGENTS\.md"\]/);
});

test("live approval is fixed, image-bound, current, and cannot escape its evidence root", async () => {
  assert.deepEqual(LIVE_ACCEPTANCE_CHECKS, [
    "realClaudeWebHost",
    "themeSurvivesCodeRoundTrip",
    "tabbedWindowInterface",
    "workHubUsesRealSessions",
    "petsLoadWithSettings",
    "settingsSurviveRestart",
    "originalLookRestores",
  ]);
  await assert.rejects(
    inspectLiveCapture("../outside.png", { verifiedAt: new Date(0).toISOString() }),
    /below dist\/verify\/live-aura/u,
  );

  const evidenceRoot = path.join(PROJECT_ROOT, "dist", "verify", "live-aura");
  const capturePath = path.join(evidenceRoot, `.delivery-gate-test-${process.pid}-${Date.now()}.png`);
  await fs.mkdir(evidenceRoot, { recursive: true });
  await fs.copyFile(
    path.join(PROJECT_ROOT, "assets", "studio-previews", "masters", "korean-prestige.png"),
    capturePath,
  );
  const currentTime = new Date();
  await fs.utimes(capturePath, currentTime, currentTime);
  try {
    const receipt = {
      source: { sha256: "a".repeat(64) },
      verifiedAt: new Date(Date.now() - 2000).toISOString(),
    };
    const installer = { sha256: "b".repeat(64), payloadSha256: "c".repeat(64) };
    const capture = await inspectLiveCapture(capturePath, receipt);
    const acceptance = {
      schemaVersion: 1,
      sourceSha256: receipt.source.sha256,
      setupSha256: installer.sha256,
      payloadSha256: installer.payloadSha256,
      capture: capture.path,
      captureSha256: capture.sha256,
      captureBytes: capture.bytes,
      approvedBy: "user",
      approvedAt: new Date().toISOString(),
      checks: Object.fromEntries(LIVE_ACCEPTANCE_CHECKS.map((name) => [name, true])),
    };
    assert.deepEqual(await validateAcceptanceEvidence(acceptance, receipt, installer), capture);
    const incomplete = structuredClone(acceptance);
    delete incomplete.checks.originalLookRestores;
    await assert.rejects(
      validateAcceptanceEvidence(incomplete, receipt, installer),
      /complete acceptance checklist/u,
    );
    assert.equal(capture.sha256,
      crypto.createHash("sha256").update(await fs.readFile(capturePath)).digest("hex"));
  } finally {
    await fs.rm(capturePath, { force: true });
  }
});

localContractTest("one refresh path checks, builds, installs, audits, receipts, and launches without force-close logic", async () => {
  const [source, packageJson, agents, document, auditor, releaseBuilder] = await Promise.all([
    fs.readFile(deliveryScriptPath, "utf8"),
    fs.readFile(path.join(PROJECT_ROOT, "package.json"), "utf8").then(JSON.parse),
    fs.readFile(path.join(PROJECT_ROOT, "AGENTS.md"), "utf8"),
    fs.readFile(deliveryDocumentPath, "utf8"),
    fs.readFile(path.join(PROJECT_ROOT, "scripts", "audit-installer.mjs"), "utf8"),
    fs.readFile(path.join(PROJECT_ROOT, "scripts", "build-release.mjs"), "utf8"),
  ]);
  assert.equal(packageJson.scripts["delivery:status"], "node scripts/delivery-gate.mjs status");
  assert.equal(packageJson.scripts["delivery:refresh"], "node scripts/delivery-gate.mjs refresh");
  assert.equal(packageJson.scripts["delivery:gate"], "node scripts/delivery-gate.mjs gate");
  assert(packageJson.scripts.check.includes("node --check scripts/delivery-gate.mjs"));

  const refresh = source.slice(
    source.indexOf("async function refreshDelivery()"),
    source.indexOf("function parseAcceptanceArguments"),
  );
  const orderedMarkers = [
    "queryInstalledRuntime()",
    'runNpm("check")',
    'runNpm("verify:cycle")',
    'runNpm("installer:dev")',
    'runChecked(installer.path',
    '["scripts/audit-installer.mjs", "--installed"]',
    "await sourceFingerprint()",
    "await replaceJson(DELIVERY_RECEIPT_PATH",
    "await waitForInstallIdle()",
    "await launchInstalledStudio()",
  ];
  let previous = -1;
  for (const marker of orderedMarkers) {
    const current = refresh.indexOf(marker);
    assert(current > previous, `Delivery refresh order is missing or moved: ${marker}`);
    previous = current;
  }
  assert.doesNotMatch(source, /Stop-Process|taskkill|TerminateProcess|\.Kill\s*\(/iu);
  assert.doesNotMatch(source, /\bspawn\(/u,
    "The blocked detached Node host-launch path must not return");
  assert.match(source, /\$arguments=@\([^\n]+?'-OpenStudio'\)[\s\S]{0,500}?Start-Process -FilePath \$hostExe/u,
    "Delivery refresh must launch Studio through the proven Windows process boundary");
  assert.match(source, /The guardrail never force-closes it/u);
  assert.match(auditor, /"scripts\/delivery-gate\.mjs"/u);
  assert.match(releaseBuilder, /"scripts\/delivery-gate\.mjs"/u);
  assert.match(agents, /do not say[\s\S]{0,100}?delivery:gate[\s\S]{0,40}?DONE/u);
  assert.match(agents, /Never run `delivery-gate\.mjs accept` unless the user explicitly confirms/u);
  for (const phrase of [
    "real `claude.ai`",
    "entering Code",
    "multi-tab web interface",
    "actual local Codex sessions",
    "Pip, Nori, and Moss",
    "survive a normal restart",
    "Original look",
  ]) assert(document.includes(phrase), `Finished-product contract omits: ${phrase}`);
});

runIfMain(import.meta.url);
