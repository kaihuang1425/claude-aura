// WO-22 portable theme packages: one bounded archive contract layered over
// the existing schema-v1..v6 kit validator and atomic Windows installer.
import assert from "node:assert/strict";
import crypto from "node:crypto";
import {
  AURA_PACKAGE_LIMITS,
  createAuraThemePackage,
  extractAuraThemePackage,
  upgradeStudioDocumentToLoadingScreen,
  upgradeStudioDocumentToResponsive,
  validateAuraThemePackageManifest,
} from "../scripts/theme-core.mjs";
import { test, runIfMain } from "./support/harness.mjs";
import {
  DEFAULT_CONFIG,
  PROJECT_ROOT,
  executeStudioRequest,
  fs,
  path,
  readThemeKit,
  run,
  writeConfig,
} from "./support/context.mjs";

async function portableDocuments(temporary) {
  const configPath = path.join(temporary, "config.json");
  const userThemesDir = path.join(temporary, "user-themes");
  const editorRoot = path.join(temporary, "editor");
  await fs.mkdir(userThemesDir, { recursive: true });
  await writeConfig(configPath, DEFAULT_CONFIG);
  await executeStudioRequest({
    request: { type: "create-theme-copy", theme: "default" },
    configPath,
    userThemesDir,
    editorRoot,
    locale: "en",
  });
  const base = JSON.parse(await fs.readFile(path.join(editorRoot, "active", "theme.json"), "utf8"));
  const v1Id = "portable-v1";
  const v1 = {
    schemaVersion: 1,
    id: v1Id,
    labels: structuredClone(base.labels),
    descriptions: structuredClone(base.descriptions),
    swatches: structuredClone(base.swatches),
    preview: structuredClone(base.preview),
    artwork: null,
    theme: {
      ...structuredClone(base.theme),
      name: v1Id,
      variant: v1Id,
    },
  };
  const v4 = structuredClone(base);
  const v5 = upgradeStudioDocumentToResponsive(v4);
  const v6 = upgradeStudioDocumentToLoadingScreen(v5, { mode: "inherit" });
  return [
    v1,
    { ...structuredClone(v4), schemaVersion: 2 },
    { ...structuredClone(v4), schemaVersion: 3 },
    v4,
    v5,
    v6,
  ];
}

test(".aura round-trips validated schema-v1 through schema-v6 kits", async () => {
  const temporary = await fs.mkdtemp(path.join(PROJECT_ROOT, "tests", ".tmp-aura-package-"));
  try {
    const documents = await portableDocuments(temporary);
    for (const [index, document] of documents.entries()) {
      const version = index + 1;
      const kitDirectory = path.join(temporary, `kit-v${version}`);
      const packagePath = path.join(temporary, `${document.id}-v${version}.aura`);
      const extracted = path.join(temporary, `extracted-v${version}`);
      await fs.mkdir(kitDirectory);
      const documentBytes = `${JSON.stringify(document, null, 2)}\n`;
      await fs.writeFile(path.join(kitDirectory, "theme.json"), documentBytes, "utf8");

      const exported = await createAuraThemePackage({ kitDirectory, packagePath, createdWith: "0.3.0" });
      assert.equal(exported.manifest.themeId, document.id);
      assert.deepEqual(exported.manifest.files.map((entry) => entry.path), ["theme.json"]);
      assert.equal((await fs.readFile(packagePath)).subarray(0, 2).toString("ascii"), "PK");

      const imported = await extractAuraThemePackage({ packagePath, destinationDirectory: extracted });
      assert.equal(imported.manifest.themeId, document.id);
      assert.equal(await fs.readFile(path.join(extracted, "theme.json"), "utf8"), documentBytes);
      assert.equal((await readThemeKit(extracted)).schemaVersion, version);
    }
  } finally {
    await fs.rm(temporary, { recursive: true, force: true });
  }
});

test(".aura preserves only allowlisted kit assets with manifest checksums", async () => {
  const temporary = await fs.mkdtemp(path.join(PROJECT_ROOT, "tests", ".tmp-aura-assets-"));
  try {
    const [document] = await portableDocuments(temporary);
    const userThemesDir = path.join(temporary, "user-themes");
    const kitDirectory = path.join(userThemesDir, document.id);
    const packagePath = path.join(temporary, "asset-kit.aura");
    const extracted = path.join(temporary, "extracted");
    const cliExtracted = path.join(temporary, "cli-extracted");
    await fs.mkdir(kitDirectory, { recursive: true });
    const mark = await fs.readFile(path.join(
      PROJECT_ROOT, "assets", "theme-art", "default", "launcher-mark.png",
    ));
    document.theme.launcher.asset = "launcher-mark.png";
    await fs.writeFile(path.join(kitDirectory, "launcher-mark.png"), mark);
    await fs.writeFile(path.join(kitDirectory, "theme.json"), `${JSON.stringify(document, null, 2)}\n`, "utf8");
    await fs.writeFile(path.join(kitDirectory, "CHECKLIST.md"), "Source guidance only.\n", "utf8");

    const cliPath = path.join(PROJECT_ROOT, "scripts", "theme-cli.mjs");
    const exported = JSON.parse(run(process.execPath, [
      cliPath, "package-export", document.id, "--out", packagePath,
      "--user-themes", userThemesDir,
    ], { cwd: PROJECT_ROOT }));
    assert.equal(exported.pass, true);
    assert.deepEqual(exported.files, ["launcher-mark.png", "theme.json"]);

    const imported = await extractAuraThemePackage({ packagePath, destinationDirectory: extracted });
    const markEntry = imported.manifest.files.find((entry) => entry.path === "launcher-mark.png");
    assert.equal(markEntry.sha256, crypto.createHash("sha256").update(mark).digest("hex"));
    assert(!imported.manifest.files.some((entry) => /config|preference|state/i.test(entry.path)));

    assert.deepEqual(await fs.readFile(path.join(extracted, "launcher-mark.png")), mark);
    const cliImported = JSON.parse(run(process.execPath, [
      cliPath, "package-extract", packagePath, "--out", cliExtracted,
    ], { cwd: PROJECT_ROOT }));
    assert.equal(cliImported.theme, document.id);
    assert.deepEqual(await fs.readFile(path.join(cliExtracted, "launcher-mark.png")), mark);
  } finally {
    await fs.rm(temporary, { recursive: true, force: true });
  }
});

test(".aura rejects tampering, unsafe paths, unknown manifests, and oversized entries", async () => {
  const temporary = await fs.mkdtemp(path.join(PROJECT_ROOT, "tests", ".tmp-aura-reject-"));
  try {
    const [document] = await portableDocuments(temporary);
    const kitDirectory = path.join(temporary, "kit");
    const packagePath = path.join(temporary, "valid.aura");
    await fs.mkdir(kitDirectory);
    await fs.writeFile(path.join(kitDirectory, "theme.json"), `${JSON.stringify(document, null, 2)}\n`, "utf8");
    const { manifest } = await createAuraThemePackage({ kitDirectory, packagePath, createdWith: "0.3.0" });

    for (const [changed, pattern] of [
      [{ ...manifest, schemaVersion: 2 }, /manifest version/i],
      [{ ...manifest, files: [{ ...manifest.files[0], path: "../theme.json" }] }, /safe relative|allowlist/i],
      [{ ...manifest, files: [{ ...manifest.files[0], path: "notes.txt" }] }, /allowlist/i],
      [{ ...manifest, files: [{ ...manifest.files[0], size: AURA_PACKAGE_LIMITS.entryBytes + 1 }] }, /too large|size limit/i],
    ]) assert.throws(() => validateAuraThemePackageManifest(changed), pattern);

    const tampered = Buffer.from(await fs.readFile(packagePath));
    const needle = Buffer.from('"id": "portable-v1"', "utf8");
    const offset = tampered.indexOf(needle);
    assert(offset >= 0, "test package did not contain its stored theme document");
    tampered[offset + needle.length - 2] ^= 1;
    const tamperedPath = path.join(temporary, "tampered.aura");
    await fs.writeFile(tamperedPath, tampered);
    await assert.rejects(
      extractAuraThemePackage({
        packagePath: tamperedPath,
        destinationDirectory: path.join(temporary, "must-not-exist"),
      }),
      /checksum|CRC/i,
    );
    await assert.rejects(fs.access(path.join(temporary, "must-not-exist")));
  } finally {
    await fs.rm(temporary, { recursive: true, force: true });
  }
});

test("Studio exposes user-only export and host-owned staged package import", async () => {
  const [app, html, host] = await Promise.all([
    fs.readFile(path.join(PROJECT_ROOT, "studio", "app.js"), "utf8"),
    fs.readFile(path.join(PROJECT_ROOT, "studio", "index.html"), "utf8"),
    fs.readFile(path.join(PROJECT_ROOT, "windows", "aura-ui.ps1"), "utf8"),
  ]);
  assert.match(app, /type:\s*"export-theme-package",\s*theme:\s*theme\.name/);
  assert.match(app, /source\s*===\s*"user"[\s\S]{0,1800}?export-theme-package/);
  assert.match(html, /data-i18n="installThemePackage"/);
  assert.match(host, /System\.Windows\.Forms\.OpenFileDialog/);
  assert.match(host, /System\.Windows\.Forms\.SaveFileDialog/);
  assert.match(host, /'package-extract'/);
  assert.match(host, /'package-export'/);
  assert.match(host, /Copy-AuraUiThemeKit/);
  assert.match(host, /\^\\\.package-import-\[a-f0-9\]\{32\}\$/i);
});

runIfMain(import.meta.url);
