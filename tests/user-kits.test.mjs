// user-kits tests. Extracted from the former monolithic tests/run-tests.mjs.
import { test, runIfMain } from "./support/harness.mjs";
import { deflateSync } from "node:zlib";
import {
  STUDIO_MAX_HISTORY,
  STUDIO_MAX_PATCH_CHANGES,
  STUDIO_METADATA_LOCALES,
  studioReframeCoverScale,
} from "../scripts/theme-core.mjs";
import { expandRendererCss } from "../scripts/theme-core/compile.mjs";
import {
  atomicWriteText,
  garbageCollectStudioLauncherMarks,
  loadStudioImportConverter,
  materializeStudioLauncherMark,
  materializeSourceArtwork,
  persistStudioInternal,
  renameStudioPath,
  studioFrameFromLegacy,
  studioPaths,
  studioWebpDimensions,
} from "../scripts/theme-core/studio.mjs";
import { STUDIO_FRAME_VIEWPORTS } from "../scripts/theme-core/constants.mjs";
import {
  validateLauncherPngBytes,
  validateStudioThemeKitDocument,
  validateUserThemeArtwork,
} from "../scripts/theme-core/validation.mjs";
import {
  AURA_VERSION,
  DEFAULT_CONFIG,
  PROJECT_ROOT,
  REQUIRED_SEMANTIC_TOKENS,
  STUDIO_FONT_DISPLAY_STACKS,
  STUDIO_FONT_UI_STACKS,
  STUDIO_MAX_LAYERS,
  STUDIO_PREVIEW_MASTERS,
  STUDIO_SHADOWS,
  STUDIO_THEME_SCHEMA_VERSION,
  studioStyleFromTheme,
  THEME_IDS,
  assert,
  buildAuraIcon,
  buildLauncherAssets,
  buildPayload,
  buildPayloadFromCompiled,
  compileTheme,
  contrast,
  crypto,
  deliverableFiles,
  executeStudioRequest,
  fs,
  hslToRgb,
  hydrateStudioDraft,
  listThemes,
  luminance,
  normalizeLocale,
  os,
  path,
  readPayloadSettings,
  readThemeKit,
  readThemeRegistry,
  resolveArtwork,
  run,
  spawnSync,
  validateTheme,
  writeConfig,
  zipEntryNames,
} from "./support/context.mjs";

const TEST_PNG_SIGNATURE = Buffer.from("89504e470d0a1a0a", "hex");
const TEST_PNG_CRC_TABLE = Uint32Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = (value >>> 1) ^ ((value & 1) ? 0xedb88320 : 0);
  }
  return value >>> 0;
});

function readInstalledCss(payload) {
  const payloadInvocation = payload.lastIndexOf("})(");
  assert(payloadInvocation >= 0, "Renderer payload lost its invocation");
  const encodedCss = /^"(?:\\[\s\S]|[^"\\])*"/.exec(payload.slice(payloadInvocation + 3))?.[0];
  assert(encodedCss, "Renderer payload lost its installed stylesheet");
  const settings = readPayloadSettings(payload);
  const css = JSON.parse(encodedCss);
  return settings.C === 1 ? expandRendererCss(css) : css;
}

function testPngCrc32(bytes) {
  let value = 0xffffffff;
  for (const byte of bytes) value = TEST_PNG_CRC_TABLE[(value ^ byte) & 0xff] ^ (value >>> 8);
  return (value ^ 0xffffffff) >>> 0;
}

function testPngChunk(type, data = Buffer.alloc(0)) {
  const typeBytes = Buffer.from(type, "ascii");
  const chunk = Buffer.alloc(12 + data.length);
  chunk.writeUInt32BE(data.length, 0);
  typeBytes.copy(chunk, 4);
  data.copy(chunk, 8);
  chunk.writeUInt32BE(testPngCrc32(Buffer.concat([typeBytes, data])), 8 + data.length);
  return chunk;
}

function testLauncherPng(ihdr, imageData, {
  beforeImageData = [],
  includeImageData = true,
  includeEnd = true,
} = {}) {
  return Buffer.concat([
    TEST_PNG_SIGNATURE,
    testPngChunk("IHDR", ihdr),
    ...beforeImageData,
    ...(includeImageData ? [testPngChunk("IDAT", imageData)] : []),
    ...(includeEnd ? [testPngChunk("IEND")] : []),
  ]);
}

async function assertStoredLauncherMarksRejectEscapingJunctions() {
  const temporary = await fs.mkdtemp(path.join(PROJECT_ROOT, "tests", ".tmp-launcher-junction-"));
  try {
    const paths = studioPaths(path.join(temporary, "editor"));
    const redirectedMarks = path.join(temporary, "redirected-launcher-marks");
    await Promise.all([
      fs.mkdir(paths.active, { recursive: true }),
      fs.mkdir(paths.artwork, { recursive: true }),
      fs.mkdir(redirectedMarks, { recursive: true }),
    ]);
    const bytes = await fs.readFile(path.join(
      PROJECT_ROOT, "assets", "theme-art", "japanese-idol", "launcher-mark.png",
    ));
    const digest = crypto.createHash("sha256").update(bytes).digest("hex");
    await fs.writeFile(path.join(redirectedMarks, `${digest}.png`), bytes);
    try {
      await fs.symlink(redirectedMarks, paths.launcherMarks, process.platform === "win32" ? "junction" : "dir");
    } catch (error) {
      if (["EPERM", "EACCES", "ENOSYS", "ENOTSUP", "UNKNOWN"].includes(error.code)) {
        console.log(`# launcher-mark junction regression skipped: ${error.code}`);
        return;
      }
      throw error;
    }
    await assert.rejects(
      materializeStudioLauncherMark(paths, digest),
      /regular directory|symbolic link|junction|escaped/i,
      "Studio followed an escaping launcher-mark junction and materialized its bytes",
    );
    await assert.rejects(
      garbageCollectStudioLauncherMarks(paths, {
        launcherMarkDigest: null,
        baselineLauncherMarkDigest: null,
        lastValidLauncherMarkDigest: null,
        launcherUndo: [],
        launcherRedo: [],
      }),
      /regular directory|symbolic link|junction|escaped/i,
      "Launcher-mark cleanup traversed an escaping junction",
    );
    const committed = {
      currentDocument: { id: "post-commit-cleanup-test" },
      launcherMarkDigest: null,
      baselineLauncherMarkDigest: null,
      lastValidLauncherMarkDigest: null,
      launcherUndo: [],
      launcherRedo: [],
    };
    await persistStudioInternal(paths, committed);
    assert.equal(JSON.parse(await fs.readFile(paths.state, "utf8")).currentDocument.id,
      "post-commit-cleanup-test",
      "A post-commit launcher cleanup failure made a durable editor revision look rejected");
    await assert.rejects(fs.access(path.join(paths.active, "launcher-mark.png")),
      "A rejected launcher-mark junction still wrote the active identity file");
  } finally {
    await fs.rm(temporary, { recursive: true, force: true });
  }
}

async function assertLauncherMarkHistoryAndGarbageCollection() {
  const temporary = await fs.mkdtemp(path.join(PROJECT_ROOT, "tests", ".tmp-launcher-gc-"));
  try {
    const paths = studioPaths(path.join(temporary, "editor"));
    await Promise.all([
      fs.mkdir(paths.artwork, { recursive: true }),
      fs.mkdir(paths.launcherMarks, { recursive: true }),
    ]);
    const digests = Array.from(
      { length: STUDIO_MAX_HISTORY + 6 },
      (_, index) => index.toString(16).padStart(64, "0"),
    );
    await Promise.all(digests.map((digest) => (
      fs.writeFile(path.join(paths.launcherMarks, `${digest}.png`), `mark-${digest}`)
    )));
    const nonDigestFile = path.join(paths.launcherMarks, "launcher-current.png");
    const exactDirectory = path.join(paths.launcherMarks, `${"f".repeat(64)}.png`);
    await Promise.all([
      fs.writeFile(nonDigestFile, "not digest-owned"),
      fs.mkdir(exactDirectory),
    ]);
    const outsideFile = path.join(temporary, "outside-mark.png");
    const linkedFile = path.join(paths.launcherMarks, `${"e".repeat(64)}.png`);
    await fs.writeFile(outsideFile, "outside");
    let linked = false;
    try {
      await fs.symlink(outsideFile, linkedFile, "file");
      linked = true;
    } catch (error) {
      if (!["EPERM", "EACCES", "ENOSYS", "ENOTSUP", "UNKNOWN"].includes(error.code)) throw error;
    }

    const internal = {
      currentDocument: { id: "launcher-gc-test" },
      launcherMarkDigest: digests.at(-1),
      baselineLauncherMarkDigest: digests.at(-2),
      lastValidLauncherMarkDigest: digests.at(-3),
      launcherUndo: digests.slice(3, 3 + STUDIO_MAX_HISTORY),
      launcherRedo: [digests[2]],
    };
    await persistStudioInternal(paths, internal);

    for (const digest of digests.slice(2)) {
      await fs.access(path.join(paths.launcherMarks, `${digest}.png`));
    }
    for (const digest of digests.slice(0, 2)) {
      await assert.rejects(fs.access(path.join(paths.launcherMarks, `${digest}.png`)),
        `Launcher-mark cleanup retained orphan ${digest}`);
    }
    await Promise.all([
      fs.access(nonDigestFile),
      fs.access(exactDirectory),
      fs.access(outsideFile),
    ]);
    if (linked) {
      assert.equal((await fs.lstat(linkedFile)).isSymbolicLink(), true,
        "Launcher-mark cleanup removed or replaced an exact-name symbolic link");
    }
  } finally {
    await fs.rm(temporary, { recursive: true, force: true });
  }
}

test("background cover framing follows an explicit scope without losing the user's crop", () => {
  const image = { width: 800, height: 1200 };
  const viewport = { width: 1180, height: 720 };
  const contentCover = studioFrameFromLegacy("center", "cover", image, viewport, "content").scale;
  const fullCover = studioFrameFromLegacy("center", "cover", image, viewport, "full-window").scale;
  assert.equal(studioReframeCoverScale(
    contentCover,
    image,
    viewport,
    "content",
    "full-window",
  ), fullCover, "Changing scope did not rebase a cover-cropped background");
  const zoomed = Math.round(contentCover * 1.2 * 10000) / 10000;
  const rebasedZoom = studioReframeCoverScale(zoomed, image, viewport, "content", "full-window");
  assert(Math.abs(
    (rebasedZoom - fullCover) / (3 - fullCover)
      - (zoomed - contentCover) / (3 - contentCover),
  ) < 0.0001, "Changing scope lost the user's available crop zoom");
  assert.equal(studioReframeCoverScale(
    rebasedZoom,
    image,
    viewport,
    "full-window",
    "content",
  ), zoomed, "Returning to the prior scope did not restore the prior crop");
  const nearLimit = 2.8;
  const rebasedNearLimit = studioReframeCoverScale(
    nearLimit,
    image,
    viewport,
    "content",
    "full-window",
  );
  assert(rebasedNearLimit < 3, "Reframing clipped a recoverable crop at the scale ceiling");
  assert.equal(studioReframeCoverScale(
    rebasedNearLimit,
    image,
    viewport,
    "full-window",
    "content",
  ), nearLimit, "A near-limit crop did not survive a scope round trip");
});

test("user theme kits append, apply, persist, warn on collisions, and uninstall by one folder", async () => {
  await assertStoredLauncherMarksRejectEscapingJunctions();
  await assertLauncherMarkHistoryAndGarbageCollection();
  const temporary = await fs.mkdtemp(path.join(PROJECT_ROOT, "tests", ".tmp-"));
  const cliPath = path.join(PROJECT_ROOT, "scripts", "theme-cli.mjs");
  const authoringRoot = path.join(temporary, "authoring");
  const userThemesDir = path.join(temporary, "user-themes");
  const themeId = "constructor";
  try {
    assert.deepEqual(STUDIO_METADATA_LOCALES, [
      "en", "hi", "es", "fr", "id", "ja", "ko", "pt-BR", "de", "it", "vi", "pl", "tr", "zh-CN", "zh-HKTW",
    ], "The portable Studio metadata locale allowlist drifted from the interface locale set");
    for (const [input, expected] of [
      ["en-GB", "en"], ["hi-IN", "hi"], ["es-MX", "es"], ["fr-CA", "fr"],
      ["id-ID", "id"], ["ja-JP", "ja"], ["ko-KR", "ko"], ["pt-PT", "pt-BR"],
      ["de-CH", "de"], ["it-IT", "it"], ["vi-VN", "vi"], ["pl-PL", "pl"],
      ["tr-TR", "tr"], ["zh-Hans-CN", "zh-CN"], ["zh-Hant-HK", "zh-HKTW"],
    ]) {
      assert.equal(normalizeLocale(input), expected, `${input} did not normalize to ${expected}`);
    }
    await fs.mkdir(authoringRoot, { recursive: true });
    run(process.execPath, [cliPath, "scaffold", themeId], { cwd: authoringRoot });
    const sourceKit = path.join(authoringRoot, "themes", themeId);
    const validated = JSON.parse(run(process.execPath, [cliPath, "validate", sourceKit], { cwd: authoringRoot }));
    assert.deepEqual({ pass: validated.pass, theme: validated.theme, source: validated.source },
      { pass: true, theme: themeId, source: "folder" });

    const conversionPaths = studioPaths(path.join(temporary, "converter-editor"));
    await fs.mkdir(conversionPaths.artwork, { recursive: true });
    const productionConverter = await loadStudioImportConverter();
    assert.equal(typeof productionConverter, "function",
      "The modular Studio core no longer resolves the host artwork converter");
    const pngSource = path.join(PROJECT_ROOT, "assets", "theme-art", "default", "launcher-mark.png");
    const conversionWebp = path.join(PROJECT_ROOT, "assets", "theme-art", "anime-twilight", "card-preview.webp");
    let conversionCalled = false;
    const convertedArtwork = await materializeSourceArtwork(pngSource, conversionPaths, async ({ source, target, outputRoot }) => {
      conversionCalled = true;
      assert.equal(source, pngSource);
      assert.equal(outputRoot, conversionPaths.root);
      assert.match(path.basename(target), /^layer-[a-f0-9]{32}\.webp$/);
      await fs.copyFile(conversionWebp, target);
    });
    assert.equal(conversionCalled, true, "Non-WebP source artwork bypassed the local conversion path");
    assert.match(convertedArtwork, /^artwork\/layer-[a-f0-9]{32}\.webp$/);
    assert.equal((await fs.readFile(path.join(conversionPaths.active, convertedArtwork))).subarray(0, 4).toString("ascii"), "RIFF");

    const atomicDraftPath = path.join(temporary, "atomic-draft.json");
    await fs.writeFile(atomicDraftPath, "old draft\n", "utf8");
    let transientDraftAttempts = 0;
    await atomicWriteText(atomicDraftPath, "new draft\n", {
      fileOperations: {
        rename: async (...args) => {
          transientDraftAttempts += 1;
          if (transientDraftAttempts === 1) {
            const error = new Error("injected transient draft lock");
            error.code = "EBUSY";
            throw error;
          }
          return fs.rename(...args);
        },
        wait: async () => {},
      },
    });
    assert.ok(
      transientDraftAttempts >= 2 && transientDraftAttempts <= 6,
      "Atomic draft publication escaped the bounded retry window",
    );
    assert.equal(await fs.readFile(atomicDraftPath, "utf8"), "new draft\n");
    await fs.writeFile(atomicDraftPath, "preserve draft\n", "utf8");
    let permanentDraftAttempts = 0;
    await assert.rejects(atomicWriteText(atomicDraftPath, "must not publish\n", {
      fileOperations: {
        rename: async () => {
          permanentDraftAttempts += 1;
          const error = new Error("injected permanent draft lock");
          error.code = "EACCES";
          throw error;
        },
        wait: async () => {},
      },
    }), /injected permanent draft lock/);
    assert.equal(permanentDraftAttempts, 6, "Atomic draft publication did not use the bounded retry count");
    assert.equal(await fs.readFile(atomicDraftPath, "utf8"), "preserve draft\n",
      "Failed draft publication removed or changed the live editor state");
    assert.deepEqual(
      (await fs.readdir(temporary)).filter((name) => name.startsWith("atomic-draft.json.tmp-")),
      [],
      "Failed draft publication left an unpublished temporary file",
    );

    const transientDirectorySource = path.join(temporary, "transient-directory-source");
    const transientDirectoryDestination = path.join(temporary, "transient-directory-destination");
    await fs.mkdir(transientDirectorySource);
    let transientDirectoryAttempts = 0;
    await renameStudioPath(transientDirectorySource, transientDirectoryDestination, {
      fileOperations: {
        rename: async (...args) => {
          transientDirectoryAttempts += 1;
          if (transientDirectoryAttempts === 1) {
            const error = new Error("injected transient editor-directory lock");
            error.code = "EPERM";
            throw error;
          }
          return fs.rename(...args);
        },
        wait: async () => {},
      },
    });
    assert.ok(
      transientDirectoryAttempts >= 2 && transientDirectoryAttempts <= 6,
      "Editor directory publication escaped the bounded retry window",
    );
    assert.equal((await fs.stat(transientDirectoryDestination)).isDirectory(), true);
    await assert.rejects(fs.stat(transientDirectorySource), { code: "ENOENT" });

    const lockedDirectorySource = path.join(temporary, "locked-directory-source");
    const lockedDirectoryDestination = path.join(temporary, "locked-directory-destination");
    await fs.mkdir(lockedDirectorySource);
    let lockedDirectoryAttempts = 0;
    await assert.rejects(renameStudioPath(lockedDirectorySource, lockedDirectoryDestination, {
      fileOperations: {
        rename: async () => {
          lockedDirectoryAttempts += 1;
          const error = new Error("injected permanent editor-directory lock");
          error.code = "EBUSY";
          throw error;
        },
        wait: async () => {},
      },
    }), /injected permanent editor-directory lock/);
    assert.equal(lockedDirectoryAttempts, 6, "Editor directory publication did not use the bounded retry count");
    assert.equal((await fs.stat(lockedDirectorySource)).isDirectory(), true);
    await assert.rejects(fs.stat(lockedDirectoryDestination), { code: "ENOENT" });

    const launcherBudgetRoot = path.join(temporary, "launcher-budget");
    await fs.mkdir(launcherBudgetRoot, { recursive: true });
    const webpBytes = await fs.readFile(conversionWebp);
    const launcherBytes = await fs.readFile(pngSource);
    const paddedWebp = Buffer.concat([webpBytes, Buffer.alloc(300_000 - webpBytes.length)]);
    const launcherPadding = testPngChunk(
      "ruSt",
      Buffer.alloc(150_000 - launcherBytes.length - 12),
    );
    const paddedLauncher = Buffer.concat([
      launcherBytes.subarray(0, launcherBytes.length - 12),
      launcherPadding,
      launcherBytes.subarray(launcherBytes.length - 12),
    ]);
    const budgetLayers = ["layer-a.webp", "layer-b.webp", "layer-c.webp"];
    await Promise.all([
      ...budgetLayers.map((name) => fs.writeFile(path.join(launcherBudgetRoot, name), paddedWebp)),
      fs.writeFile(path.join(launcherBudgetRoot, "launcher-mark.png"), paddedLauncher),
    ]);
    const embeddedLayerBytes = budgetLayers.reduce(
      (total) => total + Buffer.byteLength(`data:image/webp;base64,${paddedWebp.toString("base64")}`, "utf8"),
      0,
    );
    const embeddedLauncherBytes = Buffer.byteLength(
      `data:image/png;base64,${paddedLauncher.toString("base64")}`,
      "utf8",
    );
    assert.ok(embeddedLayerBytes < 1_400_000
      && embeddedLayerBytes + embeddedLauncherBytes >= 1_400_000,
    "Launcher budget regression fixture must distinguish source bytes from renderer-embedded bytes");
    await validateUserThemeArtwork(
      launcherBudgetRoot,
      { artworkLayers: budgetLayers.map((relativePath) => ({ path: relativePath })), studioPreview: null },
      { launcher: { asset: "launcher-mark.png" } },
      "launcher-budget",
    );

    await fs.mkdir(userThemesDir, { recursive: true });
    const installedFolder = path.join(userThemesDir, themeId);
    await fs.cp(sourceKit, installedFolder, { recursive: true, force: false, errorOnExist: true });

    const initialWarnings = [];
    const registry = await readThemeRegistry({
      userThemesDir,
      onWarning: (message) => initialWarnings.push(message),
    });
    assert.deepEqual(registry.themes.slice(0, THEME_IDS.length).map((theme) => theme.id), THEME_IDS,
      "User themes changed the frozen built-in order");
    assert.deepEqual(registry.themes.slice(THEME_IDS.length).map((theme) => theme.id), [themeId],
      "Validated user themes must append after built-ins");
    assert.equal(registry.themes.at(-1).source, "user");
    assert.deepEqual(initialWarnings, []);
    const localizedThemes = await listThemes({ locale: "zh-HKTW", userThemesDir });
    const installedTheme = localizedThemes.find((theme) => theme.name === themeId);
    assert(installedTheme, "The installed user theme did not appear in the runtime list");
    assert.equal(installedTheme.source, "user");
    assert.equal(installedTheme.label, `自訂主題（${themeId}）`);

    const configPath = path.join(temporary, "config.json");
    await writeConfig(configPath, { ...DEFAULT_CONFIG });
    const applied = JSON.parse(run(process.execPath, [
      cliPath, "set", "--config", configPath, "--theme", themeId,
      "--user-themes", userThemesDir,
    ]));
    assert.equal(applied.theme, themeId, "Studio-equivalent set did not apply the imported theme immediately");
    assert.equal(JSON.parse(await fs.readFile(configPath, "utf8")).theme, themeId);
    const appliedBundle = await buildPayload({ configPath, userThemesDir });
    assert.equal(appliedBundle.theme.name, themeId);
    assert.equal(appliedBundle.settings.theme, themeId);
    new Function(appliedBundle.payload);

    run(process.execPath, [cliPath, "init", "--config", configPath, "--user-themes", userThemesDir]);
    const restarted = JSON.parse(run(process.execPath, [
      cliPath, "show", "--config", configPath, "--json", "--user-themes", userThemesDir,
    ]));
    assert.equal(restarted.theme.name, themeId, "The imported theme did not survive restart initialization");

    const collisionFolder = path.join(userThemesDir, "default");
    await fs.cp(sourceKit, collisionFolder, { recursive: true, force: false, errorOnExist: true });
    const collisionWarnings = [];
    const collisionRegistry = await readThemeRegistry({
      userThemesDir,
      onWarning: (message) => collisionWarnings.push(message),
    });
    assert.equal(collisionRegistry.themes.filter((theme) => theme.id === "default").length, 1);
    assert.equal(collisionRegistry.themes.find((theme) => theme.id === "default").source, "builtin");
    assert(collisionWarnings.some((message) => /built-in theme or alias takes precedence/.test(message)),
      "A user/built-in id collision did not surface a warning");
    const cliList = spawnSync(process.execPath, [
      cliPath, "list", "--json", "--user-themes", userThemesDir,
    ], { cwd: PROJECT_ROOT, encoding: "utf8" });
    assert.equal(cliList.status, 0, cliList.stderr);
    assert.match(cliList.stderr, /Warning: User theme "default" was ignored/,
      "The CLI hid the built-in collision warning");
    const cliThemes = JSON.parse(cliList.stdout);
    assert.equal(cliThemes.filter((theme) => theme.name === "default").length, 1);
    const registryThemes = new Map(localizedThemes.map((theme) => [theme.name, theme]));
    for (const theme of cliThemes) {
      const registryTheme = registryThemes.get(theme.name);
      assert(registryTheme, `CLI listed an unknown theme ${theme.name}`);
      assert.deepEqual(theme.studioStyle, studioStyleFromTheme(registryTheme),
        `CLI theme ${theme.name} did not carry its exact validated Studio shell style`);
      // Studio draws its gallery cards from this list, and the host resolves a
      // duplicate's permanent identity profile through its recipe. Dropping any
      // of these leaves the Windows host holding a permanent null.
      assert.deepEqual(theme.studioPreview, registryTheme.studioPreview ?? null,
        `CLI theme ${theme.name} did not carry its card preview master`);
      assert.deepEqual(theme.studioPreviewFrame, registryTheme.studioPreviewFrame ?? null,
        `CLI theme ${theme.name} did not carry its card preview framing`);
      assert.deepEqual(theme.sourceRecipe, registryTheme.sourceRecipe ?? null,
        `CLI theme ${theme.name} did not carry its Studio source recipe`);
    }

    const invalidKit = path.join(temporary, "invalid-kit");
    await fs.cp(sourceKit, invalidKit, { recursive: true, force: false, errorOnExist: true });
    const invalidDocumentPath = path.join(invalidKit, "theme.json");
    const invalidDocument = JSON.parse(await fs.readFile(invalidDocumentPath, "utf8"));
    invalidDocument.theme.name = "Invalid Theme";
    await fs.writeFile(invalidDocumentPath, `${JSON.stringify(invalidDocument, null, 2)}\n`, "utf8");
    const beforeInvalid = (await fs.readdir(userThemesDir)).sort();
    const invalidResult = spawnSync(process.execPath, [cliPath, "validate", invalidKit], {
      cwd: PROJECT_ROOT,
      encoding: "utf8",
    });
    assert.notEqual(invalidResult.status, 0);
    assert.match(invalidResult.stderr, /theme\.json\.theme\.name must be lowercase kebab-case/,
      "Invalid kit rejection did not surface the validator's message");
    assert(!/\n\s+at\s/.test(invalidResult.stderr), "Kit validation leaked a stack instead of a usable message");
    assert.deepEqual((await fs.readdir(userThemesDir)).sort(), beforeInvalid,
      "Rejected validation copied files into the user themes directory");

    const invalidMutations = [
      ["custom-css", (document) => { document.theme.customCss = "body { display: none }"; }, /customCss must be empty/],
      ["variant", (document) => { document.theme.variant = "different-theme"; }, /variant must match id/],
      ["mobile", (document) => {
        document.artwork = null;
        document.artworkLayers = [{ path: "hero.png", mobile: "sideways" }];
      }, /mobile has an unsupported value/],
      ["mask", (document) => {
        document.artwork = null;
        document.artworkLayers = [{ path: "hero.png", mask: "unsafe" }];
      }, /mask has an unsupported value/],
      ["svg", (document) => {
        document.artwork = { path: "hero.svg" };
        document.artworkLayers = null;
      }, /not a supported theme-kit slot path/],
    ];
    for (const [name, mutate, expected] of invalidMutations) {
      const caseFolder = path.join(temporary, `invalid-${name}`);
      await fs.cp(sourceKit, caseFolder, { recursive: true, force: false, errorOnExist: true });
      const casePath = path.join(caseFolder, "theme.json");
      const caseDocument = JSON.parse(await fs.readFile(casePath, "utf8"));
      mutate(caseDocument);
      await fs.writeFile(casePath, `${JSON.stringify(caseDocument, null, 2)}\n`, "utf8");
      await assert.rejects(() => readThemeKit(caseFolder), expected,
        `Standalone kit mutation ${name} was silently accepted`);
    }

    const invalidInstalledFolder = path.join(userThemesDir, "broken-user");
    await fs.cp(invalidKit, invalidInstalledFolder, { recursive: true, force: false, errorOnExist: true });
    const invalidWarnings = [];
    const registryWithInvalid = await readThemeRegistry({
      userThemesDir,
      onWarning: (message) => invalidWarnings.push(message),
    });
    assert(!registryWithInvalid.themes.some((theme) => theme.id === "broken-user"));
    assert(invalidWarnings.some((message) => /User theme "broken-user" was ignored:/.test(message)),
      "An invalid installed kit was not ignored with a warning");

    // The Studio editor lifecycle is exercised through the same exported
    // request dispatcher used by the host CLI. This intentionally starts with
    // a schema-v1 user theme, creates a schema-v2 copy, mutates only validated
    // fields, imports host-owned WebPs, rolls back failed saves, restarts, and
    // finally deletes the temporary theme.
    const studioUserThemesDir = path.join(temporary, "studio-user-themes");
    const studioEditorRoot = path.join(temporary, "studio-editor");
    const studioImportsRoot = path.join(studioEditorRoot, "imports");
    const studioConfigPath = path.join(temporary, "studio-config.json");
    await fs.mkdir(studioUserThemesDir, { recursive: true });
    await fs.cp(sourceKit, path.join(studioUserThemesDir, themeId), { recursive: true });
    await writeConfig(studioConfigPath, { ...DEFAULT_CONFIG });
    const studioRequest = (request, options = {}) => executeStudioRequest({
      request,
      configPath: studioConfigPath,
      userThemesDir: studioUserThemesDir,
      editorRoot: studioEditorRoot,
      locale: "en",
      ...options,
    });
    const mutationRequest = (result, type, values = {}) => ({
      type,
      session: result.state.session,
      revision: result.state.revision,
      ...values,
    });
    let studioResult;

    // Every bundled theme must enter Studio without changing its effective
    // recipe. The editor document may retain inheritance metadata, but the
    // payload applied to Aura must remain field-for-field equivalent at the
    // validated theme boundary until a user changes a control.
    const builtInThemes = new Map(
      (await listThemes({ locale: "en" }))
        .filter((theme) => theme.source === "builtin")
        .map((theme) => [theme.name, theme]),
    );
    const representativeLegacyScales = new Map([
      ["assets/theme-art/japanese-film-editorial/light-background.webp", {
        normal: Math.max(1180 / 1600, 640 / 900),
        wide: Math.max(1560 / 1600, 940 / 900),
      }],
      ["assets/theme-art/japanese-film-editorial/light-hero.webp", {
        normal: Math.min(640 * 0.8, 700) / 1018,
        wide: Math.min(940 * 0.8, 700) / 1018,
      }],
      ["assets/theme-art/cartoon-studio/hero.webp", {
        normal: Math.min(1180 * 0.26, 420) / 835,
        wide: Math.min(1560 * 0.26, 420) / 835,
      }],
    ]);
    const legacyAnchor = (position = "center") => {
      const horizontal = /\bleft\b/.test(position) ? "left" : /\bright\b/.test(position) ? "right" : "";
      const vertical = /\btop\b/.test(position) ? "top" : /\bbottom\b/.test(position) ? "bottom" : "";
      return vertical && horizontal ? `${vertical}-${horizontal}` : vertical || horizontal || "center";
    };
    const naiveLegacyFrame = (position) => ({
      anchor: legacyAnchor(position),
      focalX: 50,
      focalY: 50,
      positionX: 0,
      positionY: 0,
      scale: 1,
    });
    const assertApprox = (actual, expected, label) => {
      assert(Math.abs(actual - expected) < 0.015,
        `${label} expected approximately ${expected.toFixed(4)}, received ${actual}`);
    };

    for (const builtInThemeId of THEME_IDS) {
      studioResult = await studioRequest({ type: "create-theme-copy", theme: builtInThemeId });
      assert.equal(
        studioResult.state.shared.prompt.native,
        builtInThemes.get(builtInThemeId)?.newChatLayout === null,
        `${builtInThemeId} reported the wrong native new-chat-layout state`,
      );
      const activeStudioDirectory = path.join(studioEditorRoot, "active");
      let activeStudioDocument = JSON.parse(await fs.readFile(
        path.join(activeStudioDirectory, "theme.json"), "utf8",
      ));
      if (builtInThemeId === "japanese-film-editorial") {
        const legacyStatePath = path.join(activeStudioDirectory, ".editor-state.json");
        const legacyState = JSON.parse(await fs.readFile(legacyStatePath, "utf8"));
        legacyState.version = 1;
        delete legacyState.appliedUndo;
        delete legacyState.appliedRedo;
        delete legacyState.appliedLauncherUndo;
        delete legacyState.appliedLauncherRedo;
        for (const property of ["baselineDocument", "currentDocument", "lastValidDocument"]) {
          legacyState[property].artworkLayers[0].frames = {
            normal: naiveLegacyFrame("center"),
            wide: naiveLegacyFrame("center"),
          };
        }
        await fs.writeFile(legacyStatePath, `${JSON.stringify(legacyState, null, 2)}\n`, "utf8");
        await fs.writeFile(
          path.join(activeStudioDirectory, "theme.json"),
          `${JSON.stringify(legacyState.currentDocument, null, 2)}\n`,
          "utf8",
        );
        studioResult = await studioRequest({
          type: "begin-theme-edit", theme: studioResult.state.id, reset: false,
        });
        activeStudioDocument = JSON.parse(await fs.readFile(
          path.join(activeStudioDirectory, "theme.json"), "utf8",
        ));
        assert.notDeepEqual(activeStudioDocument.artworkLayers[0].frames.normal, naiveLegacyFrame("center"),
          "An existing active draft retained its synthetic legacy-frame seed after migration");
        assert.equal(JSON.parse(await fs.readFile(legacyStatePath, "utf8")).version, 2,
          "The compatibility migration did not persist its upgraded editor-state version");
      }
      const copiedCompiled = await compileTheme({
        config: { ...DEFAULT_CONFIG, theme: activeStudioDocument.id },
        themeKitDirectory: activeStudioDirectory,
      });
      const sourceCompiled = await compileTheme({
        config: { ...DEFAULT_CONFIG, theme: builtInThemeId },
      });
      for (const primitive of ["typography", "shape", "effects", "light", "dark", "launcher", "blur"]) {
        assert.deepEqual(copiedCompiled.theme[primitive], sourceCompiled.theme[primitive],
          `${builtInThemeId} no-op Studio copy changed effective ${primitive}`);
      }
      assert.deepEqual(
        activeStudioDocument.newChatGreetingStyle,
        sourceCompiled.theme.newChatGreetingStyle,
        `${builtInThemeId} duplicate did not preserve its portable greeting recipe`,
      );
      assert.deepEqual(
        copiedCompiled.theme.newChatGreetingStyle,
        sourceCompiled.theme.newChatGreetingStyle,
        `${builtInThemeId} duplicate changed its effective portable greeting recipe`,
      );

      const sourceLayers = builtInThemes.get(builtInThemeId)?.artworkLayers ?? [];
      assert.equal(activeStudioDocument.artworkLayers.length, sourceLayers.length,
        `${builtInThemeId} Studio copy changed its artwork layer count`);
      for (let index = 0; index < sourceLayers.length; index += 1) {
        const sourceLayer = sourceLayers[index];
        const copiedLayer = activeStudioDocument.artworkLayers[index];
        assert(copiedLayer.legacy,
          `${builtInThemeId} layer ${index + 1} discarded its exact legacy recipe before an edit`);
        const naive = naiveLegacyFrame(sourceLayer.position);
        for (const preset of ["normal", "wide"]) {
          const frame = copiedLayer.frames[preset];
          assert.notDeepEqual(frame, naive,
            `${builtInThemeId} layer ${index + 1} received a naive ${preset} frame`);
          assert(Number.isFinite(frame.scale) && frame.scale > 0,
            `${builtInThemeId} layer ${index + 1} has an invalid ${preset} scale`);
          const expected = representativeLegacyScales.get(sourceLayer.path)?.[preset];
          if (expected !== undefined) {
            assertApprox(frame.scale, expected,
              `${builtInThemeId} layer ${index + 1} ${preset} scale`);
          }
        }
        assert.notDeepEqual(copiedLayer.frames.normal, copiedLayer.frames.wide,
          `${builtInThemeId} layer ${index + 1} reused one frame across Standard and Wide`);

        const wideBeforeNormalEdit = structuredClone(copiedLayer.frames.wide);
        const normalX = copiedLayer.frames.normal.positionX;
        studioResult = await studioRequest(mutationRequest(studioResult, "set-theme-layer", {
          index,
          preset: "normal",
          property: "positionX",
          value: normalX + 1,
        }));
        activeStudioDocument = JSON.parse(await fs.readFile(
          path.join(activeStudioDirectory, "theme.json"), "utf8",
        ));
        assert.equal(activeStudioDocument.artworkLayers[index].frames.normal.positionX, normalX + 1,
          `${builtInThemeId} layer ${index + 1} did not apply its normal-frame edit`);
        assert.deepEqual(activeStudioDocument.artworkLayers[index].frames.wide, wideBeforeNormalEdit,
          `${builtInThemeId} layer ${index + 1} normal edit changed its precomputed wide frame`);
      }
      if (builtInThemeId === "cartoon-studio") {
        studioResult = await studioRequest(mutationRequest(studioResult, "set-theme-token", {
          mode: "shared",
          token: "shadow",
          value: studioResult.state.shared.shadow === "none" ? "soft" : "none",
        }));
        const controlledCartoon = await compileTheme({
          config: { ...DEFAULT_CONFIG, theme: activeStudioDocument.id },
          themeKitDirectory: activeStudioDirectory,
        });
        assert(controlledCartoon.css.includes("--aura-variant-card-shadow: var(--aura-shadow-soft)"),
          "Cartoon Studio's fixed card recipe masked an explicit shadow edit");
      }
      if (builtInThemeId === "japanese-film-editorial") {
        assert(luminance(sourceCompiled.theme.light.semantic["--aura-sidebar-background"]) > 0.5,
          "The editor regression fixture no longer has a light sidebar");
        assert(luminance(sourceCompiled.theme.light.semantic["--aura-sidebar-text-primary"]) < 0.5,
          "The editor regression fixture no longer has dark labels on its light sidebar");
        const sidebarAlpha = studioResult.state.tokens.light.sidebarAlpha === 0.91 ? 0.9 : 0.91;
        studioResult = await studioRequest(mutationRequest(studioResult, "set-theme-token", {
          mode: "light", token: "sidebarAlpha", value: sidebarAlpha,
        }));
        assert.equal(studioResult.state.tokens.light.sidebarAlpha, sidebarAlpha,
          "A light-sidebar edit did not update the editable theme");
        const editedSidebar = await compileTheme({
          config: { ...DEFAULT_CONFIG, theme: activeStudioDocument.id },
          themeKitDirectory: activeStudioDirectory,
        });
        assert.match(editedSidebar.css,
          /html\.claude-aura \[data-aura-role="sidebar-row"\]\s*\{\s*color:\s*hsl\(var\(--aura-sidebar-text-primary\)\) !important/,
          "A light-sidebar editor draft did not apply its foreground through the discovered sidebar-row role");
        assert(!studioResult.payload.includes("[data-claude-aura-sidebar] svg"),
          "A light-label editor draft broadly restyled native SVG logos or unrelated icons");
      }
      studioResult = await studioRequest(mutationRequest(studioResult, "discard-theme-edit"));
      assert.equal(studioResult.state.active, false);
    }

    // The locale selected for Studio must not leak into the schema's legacy
    // metadata fields. Those fields remain the English canonical values while
    // labels/descriptions continue to carry all three independently authored
    // locale strings.
    for (const locale of ["zh-CN", "zh-HKTW"]) {
      for (const builtInThemeId of THEME_IDS) {
        studioResult = await studioRequest(
          { type: "create-theme-copy", theme: builtInThemeId },
          { locale },
        );
        const localizedDocument = JSON.parse(await fs.readFile(
          path.join(studioEditorRoot, "active", "theme.json"), "utf8",
        ));
        assert.equal(localizedDocument.theme.label, localizedDocument.labels.en,
          `${builtInThemeId} ${locale} duplication leaked its locale into legacy theme.label`);
        assert.equal(localizedDocument.theme.description, localizedDocument.descriptions.en,
          `${builtInThemeId} ${locale} duplication leaked its locale into legacy theme.description`);
        studioResult = await studioRequest(
          mutationRequest(studioResult, "discard-theme-edit"),
          { locale },
        );
        assert.equal(studioResult.state.active, false);
      }
    }

    await assert.rejects(studioRequest({ type: "begin-theme-edit", theme: "default", reset: false }),
      /Built-in themes must be duplicated/,
    "Studio allowed direct editing of a built-in theme");
    studioResult = await studioRequest({ type: "begin-theme-edit", theme: themeId, reset: false });
    assert.equal(studioResult.state.active, true);
    assert.equal(studioResult.state.source, "user");
    assert.equal(studioResult.state.isNew, false);
    assert.equal(studioResult.state.shared.backgroundScope, "full-window",
      "Opening a schema-v1 user theme changed its legacy background scope");
    assert.equal(studioResult.apply, "draft");
    assert.equal(studioResult.state.shared.prompt.native, true,
      "A schema-v1 theme without authored placement did not retain Claude's native new-chat layout");
    const nativePromptRevision = studioResult.state.revision;
    await assert.rejects(studioRequest(mutationRequest(studioResult, "set-theme-token", {
      mode: "shared", token: "promptX", value: 0.04,
    })), /native new-chat area must be adopted in one complete placement change/,
    "Studio allowed one synthetic fallback value to replace a native prompt layout");
    assert.equal(JSON.parse(await fs.readFile(
      path.join(studioEditorRoot, "active", ".editor-state.json"), "utf8",
    )).revision, nativePromptRevision,
    "A rejected partial native-prompt change advanced the editor revision");
    studioResult = await studioRequest(mutationRequest(studioResult, "apply-theme-patch", {
      changes: [
        { kind: "token", mode: "shared", token: "promptWidth", value: 0.71 },
        { kind: "token", mode: "shared", token: "promptX", value: 0.04 },
        { kind: "token", mode: "shared", token: "promptY", value: 0 },
      ],
    }));
    assert.deepEqual(studioResult.state.shared.prompt, {
      native: false, width: 0.71, x: 0.04, y: 0,
    }, "A complete measured prompt adoption did not become one authored layout");
    studioResult = await studioRequest(mutationRequest(studioResult, "undo-theme-edit"));
    assert.equal(studioResult.state.shared.prompt.native, true,
      "Undo did not restore Claude's native new-chat layout");
    studioResult = await studioRequest(mutationRequest(studioResult, "redo-theme-edit"));
    assert.deepEqual(studioResult.state.shared.prompt, {
      native: false, width: 0.71, x: 0.04, y: 0,
    }, "Redo did not restore the complete adopted prompt layout");
    studioResult = await studioRequest(mutationRequest(studioResult, "discard-theme-edit"));
    assert.equal(studioResult.state.active, false);
    assert.equal((await readThemeKit(path.join(studioUserThemesDir, themeId))).schemaVersion, 1,
      "Discarding an unmodified schema-v1 edit migrated the installed kit");

    for (const idolThemeId of ["japanese-idol", "korean-idol"]) {
      studioResult = await studioRequest({ type: "create-theme-copy", theme: idolThemeId });
      const activeStudioDirectory = path.join(studioEditorRoot, "active");
      const activeStudioDocument = JSON.parse(await fs.readFile(
        path.join(activeStudioDirectory, "theme.json"), "utf8",
      ));
      assert.equal(activeStudioDocument.theme.variant, idolThemeId,
        `${idolThemeId} duplication lost its frozen built-in visual recipe`);
      assert.equal(activeStudioDocument.sourceRecipe, idolThemeId,
        `${idolThemeId} duplication lost its trusted source recipe reference`);
      assert.deepEqual(activeStudioDocument.controlOverrides, [],
        `${idolThemeId} duplication marked untouched controls as overridden`);
      const legacyLayerIndex = activeStudioDocument.artworkLayers.findIndex(
        (layer) => layer.legacy && layer.role === "background",
      );
      assert(legacyLayerIndex >= 0, `${idolThemeId} duplication lost its legacy background framing`);
      const legacyLayer = activeStudioDocument.artworkLayers[legacyLayerIndex];
      const legacyImageDimensions = studioWebpDimensions(await fs.readFile(
        path.join(activeStudioDirectory, legacyLayer.path),
      ));
      const idolCompiled = await compileTheme({
        config: { ...DEFAULT_CONFIG, theme: activeStudioDocument.id },
        themeKitDirectory: activeStudioDirectory,
      });
      const sourceCompiled = await compileTheme({
        config: { ...DEFAULT_CONFIG, theme: idolThemeId },
      });
      for (const primitive of ["typography", "shape", "effects", "light", "dark"]) {
        assert.deepEqual(idolCompiled.theme[primitive], sourceCompiled.theme[primitive],
          `${idolThemeId} no-op duplication changed its ${primitive} recipe`);
      }
      assert.deepEqual(idolCompiled.settings.newChatLayout, sourceCompiled.settings.newChatLayout,
        `${idolThemeId} no-op duplication changed its new-chat layout`);
      assert(idolCompiled.css.includes(`[data-claude-aura-variant="${idolThemeId}"]`),
        `${idolThemeId} duplication lost its variant-scoped recipe selectors`);
      let idolRuntime = readPayloadSettings(studioResult.payload);
      const installedCss = readInstalledCss(studioResult.payload);
      assert(installedCss.includes(`[data-claude-aura-variant="${idolThemeId}"]`),
        `${idolThemeId} payload omitted its variant-scoped recipe selectors`);
      assert.equal(idolRuntime.artLayers[legacyLayerIndex].p, legacyLayer.legacy.position);
      assert.equal(idolRuntime.artLayers[legacyLayerIndex].s, legacyLayer.legacy.size);
      assert.equal(Object.hasOwn(idolRuntime.artLayers[legacyLayerIndex], "n"), false,
        "An untouched legacy layer emitted a Studio frame tuple");

      studioResult = await studioRequest(mutationRequest(studioResult, "set-theme-token", {
        mode: "shared", token: "backgroundScope", value: "content",
      }));
      const legacyFramesInContent = Object.fromEntries(
        Object.entries(STUDIO_FRAME_VIEWPORTS).map(([preset, viewport]) => [
          preset,
          studioFrameFromLegacy(
            legacyLayer.legacy.position,
            legacyLayer.legacy.size,
            legacyImageDimensions,
            viewport,
            "content",
          ),
        ]),
      );
      assert.deepEqual(studioResult.state.layers[legacyLayerIndex].frames, legacyFramesInContent,
        `${idolThemeId} did not immediately reframe its legacy background for Main area only`);
      idolRuntime = readPayloadSettings(studioResult.payload);
      assert.equal(idolRuntime.artLayers[legacyLayerIndex].p, legacyLayer.legacy.position);
      assert.equal(idolRuntime.artLayers[legacyLayerIndex].s, legacyLayer.legacy.size);
      assert.equal(Object.hasOwn(idolRuntime.artLayers[legacyLayerIndex], "n"), false,
        "A scope-only legacy reframe prematurely replaced its portable position and size");

      studioResult = await studioRequest(mutationRequest(studioResult, "set-theme-token", {
        mode: "shared", token: "radius", value: sourceCompiled.theme.shape.card === 31 ? 30 : 31,
      }));
      const controlledDocument = JSON.parse(await fs.readFile(
        path.join(activeStudioDirectory, "theme.json"), "utf8",
      ));
      assert.deepEqual(controlledDocument.controlOverrides, ["radius"],
        `${idolThemeId} did not record the explicitly changed radius control`);
      const controlledCompiled = await compileTheme({
        config: { ...DEFAULT_CONFIG, theme: controlledDocument.id },
        themeKitDirectory: activeStudioDirectory,
      });
      assert.notDeepEqual(controlledCompiled.theme.shape, sourceCompiled.theme.shape,
        `${idolThemeId} ignored an explicit radius change`);
      if (idolThemeId === "japanese-idol") {
        assert(controlledCompiled.css.includes("--aura-variant-control-radius: var(--aura-control-radius)"),
          "Japanese Idol's capsule recipe masked an explicit radius edit");
      }
      for (const primitive of ["typography", "effects", "light", "dark"]) {
        assert.deepEqual(controlledCompiled.theme[primitive], sourceCompiled.theme[primitive],
          `${idolThemeId} radius edit changed unrelated ${primitive} recipe values`);
      }
      if (idolThemeId === "japanese-idol") {
        for (const [name, mutate, expected] of [
          ["source-recipe", (document) => { document.sourceRecipe = "not-built-in"; }, /sourceRecipe has an unsupported value/],
          ["control-overrides", (document) => { document.controlOverrides = ["radius", "radius"]; }, /controlOverrides must be unique/],
        ]) {
          const invalidStudioKit = path.join(temporary, `invalid-studio-${name}`);
          await fs.cp(activeStudioDirectory, invalidStudioKit, { recursive: true, force: false, errorOnExist: true });
          const invalidStudioDocumentPath = path.join(invalidStudioKit, "theme.json");
          const invalidStudioDocument = JSON.parse(await fs.readFile(invalidStudioDocumentPath, "utf8"));
          mutate(invalidStudioDocument);
          await fs.writeFile(invalidStudioDocumentPath, `${JSON.stringify(invalidStudioDocument, null, 2)}\n`, "utf8");
          await assert.rejects(() => readThemeKit(invalidStudioKit), expected,
            `Studio v2 accepted invalid ${name} inheritance metadata`);
        }
      }

      studioResult = await studioRequest(mutationRequest(studioResult, "set-theme-layer", {
        index: legacyLayerIndex, preset: "normal", property: "focalX", value: 60,
      }));
      idolRuntime = readPayloadSettings(studioResult.payload);
      assert.equal(Object.hasOwn(idolRuntime.artLayers[legacyLayerIndex], "p"), false);
      assert.equal(Object.hasOwn(idolRuntime.artLayers[legacyLayerIndex], "s"), false);
      assert.equal(idolRuntime.artLayers[legacyLayerIndex].n[2], 60,
        "The first explicit framing edit did not replace legacy position/size with a frame tuple");
      assert.equal(
        idolRuntime.artLayers[legacyLayerIndex].n[4],
        Math.round(legacyFramesInContent.normal.scale * 100) / 100,
        "The first explicit framing edit discarded the scale from the selected background scope");
      studioResult = await studioRequest(mutationRequest(studioResult, "discard-theme-edit"));
      assert.equal(studioResult.state.active, false);
    }

    studioResult = await studioRequest({ type: "create-theme-copy", theme: "default" });
    const studioThemeId = studioResult.state.id;
    const studioDestination = path.join(studioUserThemesDir, studioThemeId);
    const studioSchemaSource = JSON.parse(await fs.readFile(
      path.join(studioEditorRoot, "active", "theme.json"), "utf8",
    ));
    const englishOnlyStudioDocument = structuredClone(studioSchemaSource);
    englishOnlyStudioDocument.labels = { en: studioSchemaSource.labels.en };
    englishOnlyStudioDocument.descriptions = { en: studioSchemaSource.descriptions.en };
    assert.deepEqual(
      Object.keys(validateStudioThemeKitDocument(
        englishOnlyStudioDocument,
        "English-only Studio theme",
      ).labels),
      ["en"],
      "Studio schema v4 did not accept English as its only selected metadata locale",
    );
    const everyLocaleStudioDocument = structuredClone(studioSchemaSource);
    everyLocaleStudioDocument.labels = Object.fromEntries(
      STUDIO_METADATA_LOCALES.map((locale) => [locale, `Theme ${locale}`]),
    );
    everyLocaleStudioDocument.descriptions = Object.fromEntries(
      STUDIO_METADATA_LOCALES.map((locale) => [locale, `Description ${locale}`]),
    );
    assert.deepEqual(
      Object.keys(validateStudioThemeKitDocument(
        everyLocaleStudioDocument,
        "All-locale Studio theme",
      ).labels),
      STUDIO_METADATA_LOCALES,
      "Studio schema v4 did not accept the complete fifteen-locale selection",
    );
    const mismatchedLocaleDocument = structuredClone(englishOnlyStudioDocument);
    mismatchedLocaleDocument.labels.ja = "Japanese label";
    assert.throws(
      () => validateStudioThemeKitDocument(mismatchedLocaleDocument, "Mismatched Studio theme"),
      /labels and descriptions must support the same locales/,
      "Studio schema v4 accepted mismatched localized metadata keysets",
    );
    const missingEnglishDocument = structuredClone(englishOnlyStudioDocument);
    missingEnglishDocument.labels = { ja: "Japanese label" };
    missingEnglishDocument.descriptions = { ja: "Japanese description" };
    assert.throws(
      () => validateStudioThemeKitDocument(missingEnglishDocument, "No-English Studio theme"),
      /must include English/,
      "Studio schema v4 accepted a theme without its English fallback",
    );
    const legacyStudioDocument = structuredClone(studioSchemaSource);
    legacyStudioDocument.schemaVersion = 3;
    const upgradedLegacyStudioDocument = validateStudioThemeKitDocument(
      legacyStudioDocument,
      "Legacy Studio theme",
    );
    assert.equal(upgradedLegacyStudioDocument.schemaVersion, STUDIO_THEME_SCHEMA_VERSION);
    assert.deepEqual(Object.keys(upgradedLegacyStudioDocument.labels), Object.keys(legacyStudioDocument.labels),
      "Studio schema v3 migration changed its localized metadata selection");
    assert.equal(studioThemeId, "default-copy");
    assert.deepEqual({
      active: studioResult.state.active,
      sourceId: studioResult.state.sourceId,
      source: studioResult.state.source,
      isNew: studioResult.state.isNew,
      revision: studioResult.state.revision,
      apply: studioResult.apply,
    }, {
      active: true,
      sourceId: "default",
      source: "builtin",
      isNew: true,
      revision: 0,
      apply: "draft",
    });
    assert.deepEqual(studioResult.state.shared.prompt, {
      native: false, width: 0.64, x: 0, y: 0,
    }, "Default did not seed its newly authored prompt layout");
    studioResult = await studioRequest(mutationRequest(studioResult, "apply-theme-patch", {
      changes: [
        { kind: "token", mode: "shared", token: "promptWidth", value: 0.71 },
        { kind: "token", mode: "shared", token: "promptX", value: 0.04 },
        { kind: "token", mode: "shared", token: "promptY", value: 0 },
      ],
    }));
    assert.deepEqual(studioResult.state.shared.prompt, {
      native: false, width: 0.71, x: 0.04, y: 0,
    }, "A complete measured prompt adoption did not become one authored layout");
    studioResult = await studioRequest(mutationRequest(studioResult, "undo-theme-edit"));
    assert.deepEqual(studioResult.state.shared.prompt, {
      native: false, width: 0.64, x: 0, y: 0,
    }, "Undo did not restore Default's authored prompt layout");
    studioResult = await studioRequest(mutationRequest(studioResult, "redo-theme-edit"));
    assert.deepEqual(studioResult.state.shared.prompt, {
      native: false, width: 0.71, x: 0.04, y: 0,
    }, "Redo did not restore the complete adopted prompt layout");
    assert.equal(studioResult.state.shared.backgroundScope, "full-window");
    assert.equal(await fs.stat(studioDestination).then(() => true, () => false), false,
      "A duplicate was installed before Save");
    assert.equal(JSON.parse(await fs.readFile(studioConfigPath, "utf8")).theme, "default",
      "A draft changed the persisted theme before Save");
    const collisionMarker = path.join(studioDestination, "keep.txt");
    const configBeforeLateCollision = await fs.readFile(studioConfigPath, "utf8");
    const editorStateBeforeLateCollision = await fs.readFile(
      path.join(studioEditorRoot, "active", ".editor-state.json"), "utf8");
    await fs.mkdir(studioDestination);
    await fs.writeFile(collisionMarker, "keep this unrelated folder", "utf8");
    await assert.rejects(
      studioRequest(mutationRequest(studioResult, "save-theme-edit")),
      /Theme destination already exists/,
      "Saving a new duplicate overwrote a destination created after id allocation",
    );
    assert.deepEqual(await fs.readdir(studioDestination), ["keep.txt"],
      "A rejected duplicate save changed the colliding folder");
    assert.equal(await fs.readFile(collisionMarker, "utf8"), "keep this unrelated folder");
    assert.equal(await fs.readFile(studioConfigPath, "utf8"), configBeforeLateCollision,
      "A rejected duplicate collision changed the active configuration");
    assert.equal(await fs.readFile(path.join(studioEditorRoot, "active", ".editor-state.json"), "utf8"),
      editorStateBeforeLateCollision, "A rejected duplicate collision changed the draft state");
    await fs.rm(studioDestination, { recursive: true, force: true });
    const redirectedStudioThemes = path.join(temporary, "redirected-studio-user-themes");
    const outsideStudioThemes = path.join(temporary, "outside-studio-user-themes");
    const outsideStudioMarker = path.join(outsideStudioThemes, "keep.txt");
    await fs.mkdir(outsideStudioThemes);
    await fs.writeFile(outsideStudioMarker, "keep", "utf8");
    await fs.symlink(outsideStudioThemes, redirectedStudioThemes, process.platform === "win32" ? "junction" : "dir");
    try {
      await assert.rejects(
        studioRequest(mutationRequest(studioResult, "save-theme-edit"), { userThemesDir: redirectedStudioThemes }),
        /user themes folder must be a regular directory/i,
        "Studio followed a redirected user-theme root while saving",
      );
      assert.equal(await fs.readFile(outsideStudioMarker, "utf8"), "keep",
        "A rejected Studio save changed data behind a redirected user-theme root");
      assert.equal(await fs.stat(path.join(outsideStudioThemes, studioThemeId)).then(() => true, () => false), false,
        "A rejected Studio save installed a theme behind a redirected user-theme root");
      await assert.rejects(
        studioRequest({ type: "delete-user-theme", theme: "outside-theme" }, { userThemesDir: redirectedStudioThemes }),
        /user themes folder must be a regular directory/i,
        "Studio followed a redirected user-theme root while deleting",
      );
      assert.equal(await fs.readFile(outsideStudioMarker, "utf8"), "keep",
        "A rejected Studio delete changed data behind a redirected user-theme root");
    } finally {
      await fs.rm(redirectedStudioThemes, { recursive: true, force: true });
    }
    assert(!JSON.stringify(studioResult.state).includes(temporary),
      "Public editor state exposed its app-data path");
    assert(!/(?:^|["\s])[A-Za-z]:[\\/]|file:/i.test(JSON.stringify(studioResult.state)),
      "Public editor state exposed a filesystem path or URL");
    new Function(studioResult.payload);

    studioResult = await studioRequest(mutationRequest(studioResult, "set-theme-token", {
      mode: "light", token: "canvas", value: "#F2F4F8",
    }));
    assert.equal(studioResult.state.tokens.light.canvas, "#F2F4F8");
    assert.equal(studioResult.state.studioStyle.light.canvas, "#F2F4F8",
      "A valid canvas edit did not update the Studio shell style");
    const editedSidebarAlpha = studioResult.state.tokens.light.sidebarAlpha === 0.91 ? 0.9 : 0.91;
    studioResult = await studioRequest(mutationRequest(studioResult, "set-theme-token", {
      mode: "light", token: "sidebarAlpha", value: editedSidebarAlpha,
    }));
    assert.equal(studioResult.state.tokens.light.sidebarAlpha, editedSidebarAlpha,
      "A valid sidebar edit did not update the editable theme");
    const editedSidebarCss = readInstalledCss(studioResult.payload);
    assert(editedSidebarCss.includes(
      'html.claude-aura [data-aura-role="sidebar-row"]{color:hsl(var(--aura-sidebar-text-primary)) !important',
    ), "A valid editor draft did not apply sidebar foreground through its discovered row role");
    assert(!editedSidebarCss.includes("[data-claude-aura-sidebar] svg"),
      "A valid editor draft broadly restyled native SVG logos or unrelated icons");
    const validDraftStudioStyle = structuredClone(studioResult.state.studioStyle);
    const restartedDraft = JSON.parse(run(process.execPath, [
      cliPath, "studio-state", "--config", studioConfigPath,
      "--user-themes", studioUserThemesDir, "--editor-root", studioEditorRoot, "--locale", "en",
    ]));
    assert.equal(restartedDraft.state.session, studioResult.state.session,
      "Restart hydration replaced the active draft session");
    assert.equal(restartedDraft.state.revision, studioResult.state.revision,
      "Restart hydration changed the active draft revision");
    assert.equal(restartedDraft.state.tokens.light.canvas, "#F2F4F8",
      "Restart hydration did not restore the current editable document");
    assert.equal(restartedDraft.state.tokens.light.sidebarAlpha, editedSidebarAlpha,
      "Restart hydration did not preserve the sidebar edit");
    assert.deepEqual(restartedDraft.state.studioStyle, validDraftStudioStyle,
      "Restart hydration did not restore the valid draft's Studio shell style");
    assert.equal(restartedDraft.payload, studioResult.payload,
      "Restart hydration did not reapply the exact last-valid draft payload");
    assert.equal(restartedDraft.apply, "draft");
    studioResult = restartedDraft;
    studioResult = await studioRequest(mutationRequest(studioResult, "set-theme-token", {
      mode: "mode-copy", token: "tokens", value: "light",
    }));
    assert.equal(studioResult.state.tokens.dark.canvas, "#F2F4F8",
      "Copy Light to Dark did not copy the validated mode tokens");
    assert.equal(studioResult.state.studioStyle.dark.canvas, "#F2F4F8",
      "Copy Light to Dark did not update Studio's Dark shell style");
    studioResult = await studioRequest(mutationRequest(studioResult, "set-theme-token", {
      mode: "shared", token: "backgroundScope", value: "content",
    }));
    assert.equal(studioResult.state.shared.backgroundScope, "content");
    const contentRevision = studioResult.state.revision;
    studioResult = await studioRequest(mutationRequest(studioResult, "undo-theme-edit"));
    assert.equal(studioResult.state.shared.backgroundScope, "full-window",
      "Undo did not restore the previous background scope");
    assert.equal(studioResult.state.canRedo, true);
    studioResult = await studioRequest(mutationRequest(studioResult, "redo-theme-edit"));
    assert.equal(studioResult.state.shared.backgroundScope, "content",
      "Redo did not restore the persisted background-scope edit");
    assert(studioResult.state.revision > contentRevision);
    studioResult = await studioRequest(mutationRequest(studioResult, "set-theme-token", {
      mode: "shared", token: "backgroundScope", value: "sidebar",
    }));
    assert.equal(studioResult.state.shared.backgroundScope, "sidebar",
      "The editor did not accept the panel-only background scope");
    studioResult = await studioRequest(mutationRequest(studioResult, "undo-theme-edit"));
    assert.equal(studioResult.state.shared.backgroundScope, "content",
      "Undo did not restore Main area only after a panel-only edit");
    studioResult = await studioRequest(mutationRequest(studioResult, "redo-theme-edit"));
    assert.equal(studioResult.state.shared.backgroundScope, "sidebar",
      "Redo did not restore the panel-only background scope");
    studioResult = await studioRequest(mutationRequest(studioResult, "set-theme-token", {
      mode: "shared", token: "backgroundScope", value: "content",
    }));

    for (const [token, value] of [["promptWidth", 0.64], ["promptX", 0.1], ["promptY", -0.08]]) {
      studioResult = await studioRequest(mutationRequest(studioResult, "set-theme-token", {
        mode: "shared", token, value,
      }));
    }
    assert.deepEqual(studioResult.state.shared.prompt, {
      native: false, width: 0.64, x: 0.1, y: -0.08,
    });
    studioResult = await studioRequest(mutationRequest(studioResult, "set-theme-token", {
      mode: "shared", token: "fontDisplay", value: "editorial-serif",
    }));
    assert.equal(studioResult.state.shared.fontDisplay, "editorial-serif");
    assert.equal(studioResult.state.studioStyle.shared.fontDisplay, "editorial-serif",
      "A valid typography edit did not update the Studio shell style");

    const launcherBeforePatch = structuredClone(studioResult.state.launcher);
    const launcherPatch = [
      ["launcherSurface", "#202124"],
      ["launcherSurfaceHover", "#303136"],
      ["launcherForeground", "#FFFFFF"],
      ["launcherAccent", "#8A5CF5"],
      ["launcherBorder", "#767980"],
      ["launcherRadius", 18],
      ["launcherBorderWidth", 2],
    ].map(([token, value]) => ({ kind: "token", mode: "shared", token, value }));
    const launcherRevision = studioResult.state.revision;
    const launcherHistory = JSON.parse(await fs.readFile(
      path.join(studioEditorRoot, "active", ".editor-state.json"), "utf8",
    )).undo.length;
    studioResult = await studioRequest(mutationRequest(studioResult, "apply-theme-patch", {
      changes: launcherPatch,
    }));
    const validLauncherStyle = {
      ...launcherBeforePatch,
      surface: "#202124", surfaceHover: "#303136", foreground: "#FFFFFF",
      accent: "#8A5CF5", border: "#767980", radius: 18, borderWidth: 2,
    };
    assert.equal(studioResult.state.revision, launcherRevision + 1,
      "One App identity gesture advanced more than one revision");
    assert.equal(JSON.parse(await fs.readFile(
      path.join(studioEditorRoot, "active", ".editor-state.json"), "utf8",
    )).undo.length, launcherHistory + 1,
    "One App identity gesture created more than one Undo item");
    assert.deepEqual(studioResult.state.launcher, validLauncherStyle);
    assert.deepEqual(studioResult.state.launcherStyle, validLauncherStyle,
      "A valid App identity edit did not become the applied launcher style");
    const validLauncherPayload = studioResult.payload;
    studioResult = await studioRequest(mutationRequest(studioResult, "undo-theme-edit"));
    assert.deepEqual(studioResult.state.launcher, launcherBeforePatch,
      "Undo did not restore the complete previous App identity");
    studioResult = await studioRequest(mutationRequest(studioResult, "redo-theme-edit"));
    assert.deepEqual(studioResult.state.launcher, validLauncherStyle,
      "Redo did not restore the complete App identity gesture");

    const invalidLauncher = await studioRequest(mutationRequest(studioResult, "set-theme-token", {
      mode: "shared", token: "launcherSurface", value: "#FFFFFF",
    }));
    assert.equal(invalidLauncher.state.feedback.valid, false);
    assert.equal(invalidLauncher.state.launcher.surface, "#FFFFFF",
      "The rejected App identity value did not remain editable");
    assert.deepEqual(invalidLauncher.state.launcherStyle, validLauncherStyle,
      "An invalid App identity value replaced the last-valid launcher style");
    assert(invalidLauncher.state.feedback.errors.some((error) =>
      error.code === "launcher-contrast" && error.field === "launcher.foreground"),
    "Invalid App identity contrast did not identify its actionable control");
    assert.equal(invalidLauncher.payload, null);
    const hydratedInvalidLauncher = await hydrateStudioDraft({
      configPath: studioConfigPath,
      userThemesDir: studioUserThemesDir,
      editorRoot: studioEditorRoot,
      locale: "en",
    });
    assert.equal(hydratedInvalidLauncher.state.launcher.surface, "#FFFFFF");
    assert.deepEqual(hydratedInvalidLauncher.state.launcherStyle, validLauncherStyle,
      "Restart hydration advanced the launcher past its last-valid style");
    assert.equal(hydratedInvalidLauncher.payload, validLauncherPayload,
      "Restart hydration did not keep the last-valid launcher payload active");
    const laterValidLauncher = await studioRequest(mutationRequest(invalidLauncher, "apply-theme-patch", {
      changes: [
        { kind: "token", mode: "shared", token: "launcherSurface", value: "#F8F8F8" },
        { kind: "token", mode: "shared", token: "launcherSurfaceHover", value: "#E8E8E8" },
        { kind: "token", mode: "shared", token: "launcherForeground", value: "#111111" },
      ],
    }));
    assert.equal(laterValidLauncher.state.feedback.valid, true);
    const laterValidLauncherPayload = laterValidLauncher.payload;
    studioResult = await studioRequest(mutationRequest(laterValidLauncher, "undo-theme-edit"));
    assert.equal(studioResult.state.feedback.valid, false,
      "Undo skipped the invalid editable history entry");
    assert.equal(studioResult.state.launcher.surface, "#FFFFFF");
    assert.deepEqual(studioResult.state.launcherStyle, validLauncherStyle,
      "Undo to an invalid edit kept the later valid style instead of its historical predecessor");
    assert.equal(studioResult.payload, validLauncherPayload,
      "Undo to an invalid edit did not reapply its historical last-valid payload");
    assert.equal(studioResult.apply, "draft");
    studioResult = await studioRequest(mutationRequest(studioResult, "redo-theme-edit"));
    assert.equal(studioResult.payload, laterValidLauncherPayload,
      "Redo did not restore the later valid payload after an invalid history entry");
    studioResult = await studioRequest(mutationRequest(studioResult, "undo-theme-edit"));
    assert.equal(studioResult.payload, validLauncherPayload);
    studioResult = await studioRequest(mutationRequest(studioResult, "undo-theme-edit"));
    assert.deepEqual(studioResult.state.launcher, validLauncherStyle);
    assert.deepEqual(studioResult.state.launcherStyle, validLauncherStyle);
    assert.equal(studioResult.payload, validLauncherPayload);

    // Reset is available before the first save and restores the source snapshot
    // in the same guarded edit session instead of trying to read an uninstalled copy.
    const firstSession = studioResult.state.session;
    const firstRevision = studioResult.state.revision;
    studioResult = await studioRequest({ type: "begin-theme-edit", theme: studioThemeId, reset: true });
    assert.equal(studioResult.state.session, firstSession);
    assert(studioResult.state.revision > firstRevision);
    assert.equal(studioResult.state.dirty, false);
    assert.equal(studioResult.state.shared.backgroundScope, "full-window");
    assert.notEqual(studioResult.state.tokens.light.canvas, "#F2F4F8");
    assert.notEqual(studioResult.state.studioStyle.light.canvas, "#F2F4F8",
      "Reset retained a shell color from the discarded draft");
    assert.equal(studioResult.state.layers.length, 0);

    // Reapply the intended saved state after reset.
    for (const [mode, token, value] of [
      ["light", "canvas", "#F2F4F8"],
      ["mode-copy", "tokens", "light"],
      ["shared", "backgroundScope", "content"],
      ["shared", "fontDisplay", "editorial-serif"],
    ]) {
      studioResult = await studioRequest(mutationRequest(studioResult, "set-theme-token", { mode, token, value }));
    }
    studioResult = await studioRequest(mutationRequest(studioResult, "apply-theme-patch", {
      changes: [
        { kind: "token", mode: "shared", token: "promptWidth", value: 0.64 },
        { kind: "token", mode: "shared", token: "promptX", value: 0.1 },
        { kind: "token", mode: "shared", token: "promptY", value: -0.08 },
      ],
    }));
    studioResult = await studioRequest(mutationRequest(studioResult, "apply-theme-patch", {
      changes: launcherPatch,
    }));
    assert.equal(studioResult.state.studioStyle.light.canvas, "#F2F4F8");
    assert.equal(studioResult.state.studioStyle.dark.canvas, "#F2F4F8");
    assert.equal(studioResult.state.studioStyle.shared.fontDisplay, "editorial-serif");
    assert.deepEqual(studioResult.state.launcher, validLauncherStyle);
    assert.deepEqual(studioResult.state.launcherStyle, validLauncherStyle);

    const validLauncherBytes = await fs.readFile(pngSource);
    const launcherHeader = Buffer.from(validLauncherBytes.subarray(16, 29));
    const launcherScanlines = Buffer.alloc(96 * ((96 * 4) + 1));
    const launcherImageData = deflateSync(launcherScanlines);
    const syntheticLauncher = testLauncherPng(launcherHeader, launcherImageData);
    assert.doesNotThrow(() => validateLauncherPngBytes(syntheticLauncher, "Synthetic launcher mark"),
      "The strict PNG validator rejected a valid 96×96 RGBA image");

    const grayscaleHeader = Buffer.from(launcherHeader);
    grayscaleHeader[8] = 8;
    grayscaleHeader[9] = 0;
    const transparentGrayscale = testLauncherPng(
      grayscaleHeader,
      deflateSync(Buffer.alloc(96 * (96 + 1))),
      { beforeImageData: [testPngChunk("tRNS", Buffer.from([0, 0]))] },
    );
    assert.doesNotThrow(
      () => validateLauncherPngBytes(transparentGrayscale, "Transparent grayscale launcher mark"),
      "The strict PNG validator rejected a supported grayscale tRNS image",
    );

    const truecolorHeader = Buffer.from(launcherHeader);
    truecolorHeader[8] = 8;
    truecolorHeader[9] = 2;
    const transparentTruecolor = testLauncherPng(
      truecolorHeader,
      deflateSync(Buffer.alloc(96 * ((96 * 3) + 1))),
      { beforeImageData: [testPngChunk("tRNS", Buffer.alloc(6))] },
    );
    assert.doesNotThrow(
      () => validateLauncherPngBytes(transparentTruecolor, "Transparent truecolor launcher mark"),
      "The strict PNG validator rejected a supported truecolor tRNS image",
    );

    const paletteHeader = Buffer.from(launcherHeader);
    paletteHeader[8] = 1;
    paletteHeader[9] = 3;
    const palette = testPngChunk("PLTE", Buffer.from([0, 0, 0, 255, 255, 255]));
    const paletteScanlines = Buffer.alloc(96 * ((96 / 8) + 1));
    const transparentPalette = testLauncherPng(
      paletteHeader,
      deflateSync(paletteScanlines),
      {
        beforeImageData: [
          palette,
          testPngChunk("tRNS", Buffer.from([0, 255])),
        ],
      },
    );
    assert.doesNotThrow(
      () => validateLauncherPngBytes(transparentPalette, "Transparent palette launcher mark"),
      "The strict PNG validator rejected a supported indexed-color tRNS image",
    );

    const grayscaleAlphaHeader = Buffer.from(launcherHeader);
    grayscaleAlphaHeader[8] = 8;
    grayscaleAlphaHeader[9] = 4;
    const transparentGrayscaleAlpha = testLauncherPng(
      grayscaleAlphaHeader,
      deflateSync(Buffer.alloc(96 * ((96 * 2) + 1))),
    );
    assert.doesNotThrow(
      () => validateLauncherPngBytes(
        transparentGrayscaleAlpha,
        "Transparent grayscale-alpha launcher mark",
      ),
      "The strict PNG validator rejected a supported grayscale-alpha image",
    );

    const opaqueRgbaScanlines = Buffer.from(launcherScanlines);
    for (let row = 0; row < 96; row += 1) {
      const rowStart = row * ((96 * 4) + 1);
      for (let pixel = 0; pixel < 96; pixel += 1) {
        opaqueRgbaScanlines[rowStart + 1 + (pixel * 4) + 3] = 255;
      }
    }
    const opaqueRgba = testLauncherPng(launcherHeader, deflateSync(opaqueRgbaScanlines));
    assert.throws(
      () => validateLauncherPngBytes(opaqueRgba, "Opaque RGBA launcher mark"),
      /transparent pixel/i,
      "Launcher validation accepted a fully opaque RGBA image",
    );

    const unusedTransparentPaletteEntry = testLauncherPng(
      paletteHeader,
      deflateSync(paletteScanlines),
      {
        beforeImageData: [
          palette,
          testPngChunk("tRNS", Buffer.from([255, 0])),
        ],
      },
    );
    assert.throws(
      () => validateLauncherPngBytes(
        unusedTransparentPaletteEntry,
        "Opaque indexed-color launcher mark",
      ),
      /transparent pixel/i,
      "Launcher validation accepted a palette whose transparent entry is never used",
    );

    for (const builtInTheme of THEME_IDS) {
      const builtInMark = await fs.readFile(path.join(
        PROJECT_ROOT, "assets", "theme-art", builtInTheme, "launcher-mark.png",
      ));
      assert.doesNotThrow(() => validateLauncherPngBytes(builtInMark, `${builtInTheme} launcher mark`),
        `${builtInTheme} no longer passes launcher-mark validation`);
    }

    const ihdrOnlyLauncher = Buffer.concat([
      TEST_PNG_SIGNATURE,
      testPngChunk("IHDR", launcherHeader),
    ]);
    assert.throws(() => validateLauncherPngBytes(ihdrOnlyLauncher, "IHDR-only launcher mark"), /IEND/i,
      "Launcher validation accepted an IHDR-only byte sequence as a PNG image");
    assert.throws(() => validateLauncherPngBytes(
      testLauncherPng(launcherHeader, Buffer.alloc(0)), "Empty-IDAT launcher mark",
    ), /image data/i, "Launcher validation accepted an empty IDAT stream");
    assert.throws(() => validateLauncherPngBytes(
      testLauncherPng(launcherHeader, launcherImageData, { includeImageData: false }),
      "Missing-IDAT launcher mark",
    ), /image data/i, "Launcher validation accepted a PNG without IDAT");

    const invalidCrcLauncher = Buffer.from(syntheticLauncher);
    invalidCrcLauncher[TEST_PNG_SIGNATURE.length + 25 + 8] ^= 0x01;
    assert.throws(() => validateLauncherPngBytes(invalidCrcLauncher, "Bad-CRC launcher mark"), /CRC/i,
      "Launcher validation ignored a corrupt chunk CRC");
    assert.throws(() => validateLauncherPngBytes(
      syntheticLauncher.subarray(0, syntheticLauncher.length - 1), "Truncated launcher mark",
    ), /truncated|IEND/i, "Launcher validation accepted a truncated final chunk");
    assert.throws(() => validateLauncherPngBytes(
      Buffer.concat([syntheticLauncher, Buffer.from([0])]), "Trailing-data launcher mark",
    ), /after.+IEND/i, "Launcher validation accepted bytes after the terminal IEND chunk");
    assert.throws(() => validateLauncherPngBytes(
      testLauncherPng(launcherHeader, Buffer.from([0x78, 0x9c, 0x00])), "Broken-zlib launcher mark",
    ), /compressed PNG image data/i, "Launcher validation accepted a corrupt zlib stream");
    assert.throws(() => validateLauncherPngBytes(
      testLauncherPng(launcherHeader, Buffer.concat([launcherImageData, Buffer.from([0])])),
      "Trailing-zlib launcher mark",
    ), /trailing compressed/i, "Launcher validation accepted data after the zlib end marker");
    assert.throws(() => validateLauncherPngBytes(
      testLauncherPng(launcherHeader, deflateSync(Buffer.alloc(500_000))), "Inflate-bomb launcher mark",
    ), /exceeds.+96.+96.+bounds/i, "Launcher validation allowed compressed data to inflate beyond its pixel bounds");
    assert.throws(() => validateLauncherPngBytes(
      testLauncherPng(launcherHeader, deflateSync(Buffer.alloc(launcherScanlines.length - 1))),
      "Short-scanline launcher mark",
    ), /scanline length/i, "Launcher validation accepted incomplete decoded scanlines");
    const invalidFilterScanlines = Buffer.from(launcherScanlines);
    invalidFilterScanlines[0] = 5;
    assert.throws(() => validateLauncherPngBytes(
      testLauncherPng(launcherHeader, deflateSync(invalidFilterScanlines)), "Bad-filter launcher mark",
    ), /row filter/i, "Launcher validation accepted an invalid PNG row filter");

    const launcherRevisionBeforeUnsafeAsset = studioResult.state.revision;
    await assert.rejects(studioRequest(mutationRequest(studioResult, "pick-theme-launcher-mark"), {
      assetPath: pngSource,
    }), /must remain inside the editor data folder/,
    "Studio accepted a page-supplied launcher path instead of a host-owned picker asset");
    assert.equal(JSON.parse(await fs.readFile(
      path.join(studioEditorRoot, "active", ".editor-state.json"), "utf8",
    )).revision, launcherRevisionBeforeUnsafeAsset,
    "A rejected launcher path changed the editor revision");

    await fs.mkdir(studioImportsRoot, { recursive: true });
    const ihdrOnlyLauncherPath = path.join(studioImportsRoot, "launcher-ihdr-only.png");
    await fs.writeFile(ihdrOnlyLauncherPath, ihdrOnlyLauncher);
    await assert.rejects(studioRequest(mutationRequest(studioResult, "pick-theme-launcher-mark"), {
      assetPath: ihdrOnlyLauncherPath,
    }), /IEND/i, "Studio accepted the proven IHDR-only launcher-mark exploit");

    const malformedLauncherPath = path.join(studioImportsRoot, "launcher-malformed.png");
    const malformedLauncherHeader = Buffer.from(launcherHeader);
    malformedLauncherHeader.writeUInt32BE(95, 0);
    const malformedLauncher = testLauncherPng(malformedLauncherHeader, launcherImageData);
    await fs.writeFile(malformedLauncherPath, malformedLauncher);
    await assert.rejects(studioRequest(mutationRequest(studioResult, "pick-theme-launcher-mark"), {
      assetPath: malformedLauncherPath,
    }), /exactly 96.+96 pixels/i,
    "Studio accepted a launcher mark with the wrong dimensions");

    const firstLauncherPath = path.join(studioImportsRoot, "launcher-first.png");
    const secondLauncherPath = path.join(studioImportsRoot, "launcher-second.png");
    await fs.copyFile(path.join(PROJECT_ROOT, "assets", "theme-art", "japanese-idol", "launcher-mark.png"), firstLauncherPath);
    await fs.copyFile(path.join(PROJECT_ROOT, "assets", "theme-art", "korean-idol", "launcher-mark.png"), secondLauncherPath);
    studioResult = await studioRequest(mutationRequest(studioResult, "pick-theme-launcher-mark"), {
      assetPath: firstLauncherPath,
    });
    const firstLauncherUrl = studioResult.state.launcherPreviewUrl;
    assert.equal(studioResult.state.launcher.asset, "launcher-mark.png");
    assert.match(firstLauncherUrl, /^https:\/\/aura\.editor\/active\/launcher-[a-f0-9]{64}\.png$/);
    assert.equal(studioResult.state.launcherStylePreviewUrl, firstLauncherUrl,
      "A valid mark replacement did not become the applied Aura/Studio identity");
    const firstLauncherInternal = JSON.parse(await fs.readFile(
      path.join(studioEditorRoot, "active", ".editor-state.json"), "utf8",
    ));
    assert.match(firstLauncherInternal.launcherMarkDigest, /^[a-f0-9]{64}$/);
    assert.equal(firstLauncherInternal.lastValidLauncherMarkDigest, firstLauncherInternal.launcherMarkDigest);
    const firstLauncherStoredPath = path.join(
      studioEditorRoot,
      "active",
      "launcher-marks",
      `${firstLauncherInternal.launcherMarkDigest}.png`,
    );
    const firstLauncherPreviewPath = path.join(
      studioEditorRoot,
      "preview",
      "active",
      `launcher-${firstLauncherInternal.launcherMarkDigest}.png`,
    );
    await fs.writeFile(firstLauncherPreviewPath, Buffer.from("tampered launcher preview"));
    const repairedLauncherPreview = await hydrateStudioDraft({
      configPath: studioConfigPath,
      userThemesDir: studioUserThemesDir,
      editorRoot: studioEditorRoot,
      locale: "en",
    });
    assert.equal(repairedLauncherPreview.state.launcherPreviewUrl, firstLauncherUrl,
      "Repairing a tampered launcher preview changed its digest-owned URL");
    assert.deepEqual(
      await fs.readFile(firstLauncherPreviewPath),
      await fs.readFile(firstLauncherPath),
      "Canonical Studio state trusted tampered launcher preview bytes instead of atomically repairing them",
    );
    studioResult = repairedLauncherPreview;

    studioResult = await studioRequest(mutationRequest(studioResult, "undo-theme-edit"));
    assert.equal(studioResult.state.launcher.asset, launcherBeforePatch.asset,
      "Undo did not restore the built-in launcher mark");
    studioResult = await studioRequest(mutationRequest(studioResult, "redo-theme-edit"));
    assert.equal(studioResult.state.launcherPreviewUrl, firstLauncherUrl,
      "Redo did not restore the first imported launcher mark");
    studioResult = await studioRequest(mutationRequest(studioResult, "pick-theme-launcher-mark"), {
      assetPath: secondLauncherPath,
    });
    const secondLauncherUrl = studioResult.state.launcherPreviewUrl;
    const secondLauncherDigest = /launcher-([a-f0-9]{64})\.png$/.exec(secondLauncherUrl)?.[1];
    assert.match(secondLauncherDigest, /^[a-f0-9]{64}$/);
    assert.notEqual(secondLauncherUrl, firstLauncherUrl,
      "A second launcher replacement reused stale mark bytes");
    studioResult = await studioRequest(mutationRequest(studioResult, "undo-theme-edit"));
    assert.equal(studioResult.state.launcherPreviewUrl, firstLauncherUrl,
      "Undo changed only launcher metadata instead of restoring the first mark bytes");
    studioResult = await studioRequest(mutationRequest(studioResult, "redo-theme-edit"));
    assert.equal(studioResult.state.launcherPreviewUrl, secondLauncherUrl,
      "Redo did not restore the second mark bytes");
    const hydratedLauncherMark = await hydrateStudioDraft({
      configPath: studioConfigPath,
      userThemesDir: studioUserThemesDir,
      editorRoot: studioEditorRoot,
      locale: "en",
    });
    assert.equal(hydratedLauncherMark.state.launcherPreviewUrl, secondLauncherUrl,
      "Restart hydration lost the active custom launcher mark");
    assert.equal(hydratedLauncherMark.state.launcherStylePreviewUrl, secondLauncherUrl,
      "Restart hydration lost the last-valid custom launcher mark");
    studioResult = hydratedLauncherMark;

    const sourceWebp = path.join(PROJECT_ROOT, "assets", "theme-art", "anime-twilight", "card-preview.webp");
    const sourceImageDimensions = studioWebpDimensions(await fs.readFile(sourceWebp));
    const revisionBeforeUnsafeAsset = studioResult.state.revision;
    await assert.rejects(studioRequest(mutationRequest(studioResult, "pick-theme-layer-image", {
      index: -1, role: "decoration", appearance: "light", context: "new-chat",
    }), { assetPath: sourceWebp }), /must remain inside the editor data folder/,
    "Studio accepted a page-external artwork path instead of a host-owned converted asset");
    assert.equal(JSON.parse(await fs.readFile(path.join(studioEditorRoot, "active", ".editor-state.json"), "utf8")).revision,
      revisionBeforeUnsafeAsset, "Rejected artwork changed the editor revision");

    await fs.mkdir(studioImportsRoot, { recursive: true });
    const layerRoles = ["background", "hero", "corner", "decoration", "hero", "background", "corner", "decoration"];
    for (let index = 0; index < STUDIO_MAX_LAYERS; index += 1) {
      const importPath = path.join(studioImportsRoot, `layer-${index.toString(16).padStart(32, "0")}.webp`);
      await fs.copyFile(sourceWebp, importPath);
      studioResult = await studioRequest(mutationRequest(studioResult, "pick-theme-layer-image", {
        index: -1,
        role: layerRoles[index],
        appearance: "dark",
        context: "conversation",
      }), { assetPath: importPath });
      assert.equal(studioResult.state.layers.length, index + 1);
      assert.match(studioResult.state.layers[index].previewUrl,
        /^https:\/\/aura\.editor\/active\/layer-[a-f0-9]{32}\.webp\?v=[a-f0-9]{64}$/);
      assert.match(studioResult.state.layers[index].id, /^layer-[a-f0-9]{32}$/,
        "Canonical Studio state omitted a layer's stable validated id");
      assert.equal(studioResult.state.layers[index].appearance, "dark",
        "New Studio artwork did not keep the appearance selected when it was added");
      assert.equal(studioResult.state.layers[index].context, "conversation",
        "New Studio artwork did not keep the page selected when it was added");
      assert(studioResult.state.layers[index].bytes > 0 && studioResult.state.layers[index].bytes < 400_000);
      if (layerRoles[index] === "background") {
        for (const [preset, viewport] of Object.entries(STUDIO_FRAME_VIEWPORTS)) {
          assert.deepEqual(
            studioResult.state.layers[index].frames[preset],
            studioFrameFromLegacy("center", "cover", sourceImageDimensions, viewport, "content"),
            `New background ${index + 1} was not cover-cropped to the selected ${preset} content canvas`,
          );
        }
      }
    }
    assert.equal(studioResult.state.feedback.budget.sourceArtworkBytes < 1_400_000, true);
    const backgroundFramesInContent = new Map([0, 5].map((index) => [
      index,
      structuredClone(studioResult.state.layers[index].frames),
    ]));
    const nonBackgroundFrames = structuredClone(studioResult.state.layers[1].frames);
    studioResult = await studioRequest(mutationRequest(studioResult, "set-theme-token", {
      mode: "shared", token: "backgroundScope", value: "full-window",
    }));
    for (const index of [0, 5]) {
      for (const [preset, viewport] of Object.entries(STUDIO_FRAME_VIEWPORTS)) {
        const before = backgroundFramesInContent.get(index)[preset];
        const after = studioResult.state.layers[index].frames[preset];
        assert.deepEqual(
          { ...after, scale: before.scale },
          before,
          `Changing scope unexpectedly changed the ${preset} crop controls for background ${index + 1}`,
        );
        assert.equal(
          after.scale,
          studioReframeCoverScale(
            before.scale,
            sourceImageDimensions,
            viewport,
            "content",
            "full-window",
          ),
          `Changing scope did not rebase background ${index + 1} to the ${preset} full-window canvas`,
        );
      }
    }
    assert.deepEqual(studioResult.state.layers[1].frames, nonBackgroundFrames,
      "Changing background scope altered a non-background artwork layer");
    studioResult = await studioRequest(mutationRequest(studioResult, "set-theme-token", {
      mode: "shared", token: "backgroundScope", value: "content",
    }));
    for (const index of [0, 5]) {
      assert.deepEqual(studioResult.state.layers[index].frames, backgroundFramesInContent.get(index),
        `Returning to Main area only did not restore background ${index + 1}'s crop`);
    }
    const atomicScopeRoleBaseline = structuredClone(studioResult.state);
    const explicitNormalScale = 1.37;
    const atomicScopeRoleChanges = [
      { kind: "token", mode: "shared", token: "backgroundScope", value: "full-window" },
      { kind: "layer", index: 0, preset: "shared", property: "role", value: "hero" },
      { kind: "layer", index: 1, preset: "shared", property: "role", value: "background" },
      { kind: "layer", index: 1, preset: "normal", property: "scale", value: explicitNormalScale },
    ];
    studioResult = await studioRequest(mutationRequest(studioResult, "apply-theme-patch", {
      changes: atomicScopeRoleChanges,
    }));
    assert.equal(studioResult.state.revision, atomicScopeRoleBaseline.revision + 1,
      "A scope-and-role batch did not remain one history mutation");
    assert.equal(studioResult.state.layers[0].role, "hero");
    assert.deepEqual(studioResult.state.layers[0].frames, atomicScopeRoleBaseline.layers[0].frames,
      "A background changed to a non-background role was reframed by a global scope edit");
    assert.equal(studioResult.state.layers[1].role, "background");
    assert.equal(studioResult.state.layers[1].frames.normal.scale, explicitNormalScale,
      "An explicit frame scale did not win over automatic scope reframing");
    assert.equal(
      studioResult.state.layers[1].frames.wide.scale,
      studioReframeCoverScale(
        atomicScopeRoleBaseline.layers[1].frames.wide.scale,
        sourceImageDimensions,
        STUDIO_FRAME_VIEWPORTS.wide,
        "content",
        "full-window",
      ),
      "A layer becoming a background did not preserve its wide crop across the same scope batch",
    );
    const scopeRoleResult = {
      scope: studioResult.state.shared.backgroundScope,
      layers: structuredClone(studioResult.state.layers.slice(0, 2)),
    };
    studioResult = await studioRequest(mutationRequest(studioResult, "undo-theme-edit"));
    assert.equal(studioResult.state.shared.backgroundScope, "content");
    assert.deepEqual(studioResult.state.layers.slice(0, 2), atomicScopeRoleBaseline.layers.slice(0, 2),
      "Undo did not restore the complete pre-batch scope and crops");
    studioResult = await studioRequest(mutationRequest(studioResult, "apply-theme-patch", {
      changes: [...atomicScopeRoleChanges].reverse(),
    }));
    assert.deepEqual({
      scope: studioResult.state.shared.backgroundScope,
      layers: studioResult.state.layers.slice(0, 2),
    }, scopeRoleResult, "Scope/role patch ordering changed the final crop");
    studioResult = await studioRequest(mutationRequest(studioResult, "undo-theme-edit"));
    const ninthImportPath = path.join(studioImportsRoot, `layer-${"f".repeat(32)}.webp`);
    await fs.copyFile(sourceWebp, ninthImportPath);
    const revisionAtLayerLimit = studioResult.state.revision;
    await assert.rejects(studioRequest(mutationRequest(studioResult, "pick-theme-layer-image", {
      index: -1, role: "hero", appearance: "light", context: "new-chat",
    }), { assetPath: ninthImportPath }), /at most 8 artwork layers/,
    "Studio accepted a ninth artwork layer");
    assert.equal(JSON.parse(await fs.readFile(path.join(studioEditorRoot, "active", ".editor-state.json"), "utf8")).revision,
      revisionAtLayerLimit, "The rejected ninth layer changed the saved draft state");

    const editorStatePath = path.join(studioEditorRoot, "active", ".editor-state.json");
    const editorThemePath = path.join(studioEditorRoot, "active", "theme.json");
    const revisionBeforeRejectedPatch = studioResult.state.revision;
    const stateBeforeRejectedPatch = await fs.readFile(editorStatePath, "utf8");
    const themeBeforeRejectedPatch = await fs.readFile(editorThemePath, "utf8");
    const validPatchToken = { kind: "token", mode: "shared", token: "blur", value: 23 };
    await assert.rejects(studioRequest(mutationRequest(studioResult, "apply-theme-patch", {
      changes: [],
    })), /must contain 1 to 16 changes/,
    "Studio accepted an empty theme patch");
    await assert.rejects(studioRequest(mutationRequest(studioResult, "apply-theme-patch", {
      changes: Array.from({ length: STUDIO_MAX_PATCH_CHANGES + 1 }, () => ({ ...validPatchToken })),
    })), /must contain 1 to 16 changes/,
    "Studio accepted more than 16 theme-patch changes");
    await assert.rejects(studioRequest(mutationRequest(studioResult, "apply-theme-patch", {
      changes: [{ ...validPatchToken, id: studioThemeId }],
    })), /change 0 must contain only/,
    "Studio accepted an id-bearing patch change");
    await assert.rejects(studioRequest(mutationRequest(studioResult, "apply-theme-patch", {
      changes: [{ kind: "metadata", field: "id", locale: "en", value: "renamed-theme" }],
    })), /metadata field is invalid/,
    "Studio allowed a metadata patch to rename the immutable theme id");
    await assert.rejects(studioRequest(mutationRequest(studioResult, "apply-theme-patch", {
      changes: [{ kind: "metadata", field: "__proto__", locale: "en", value: "Prototype value" }],
    })), /metadata field is invalid/,
    "Studio accepted an inherited object property as a metadata field");
    await assert.rejects(studioRequest(mutationRequest(studioResult, "apply-theme-patch", {
      changes: [{ kind: "metadata", field: "label", locale: "ru", value: "Unsupported locale" }],
    })), /metadata locale has an unsupported value/,
    "Studio accepted localized metadata outside the fifteen supported locales");
    await assert.rejects(studioRequest(mutationRequest(studioResult, "apply-theme-patch", {
      changes: [{ kind: "metadata", field: "label", locale: "fr", value: "Not enabled" }],
    })), /metadata locale is not enabled/,
    "Studio wrote metadata for a supported locale before the user enabled it");
    await assert.rejects(studioRequest(mutationRequest(studioResult, "apply-theme-patch", {
      changes: [{ kind: "metadata", field: "label", locale: "en", value: "x".repeat(81) }],
    })), /label must be at most 80 characters/,
    "Studio accepted an overlong localized label");
    await assert.rejects(studioRequest(mutationRequest(studioResult, "apply-theme-patch", {
      changes: [{ kind: "metadata", field: "label", locale: "en", value: "Bad\u0001label" }],
    })), /contain no control characters/,
    "Studio accepted a control character in localized metadata");
    await assert.rejects(studioRequest(mutationRequest(studioResult, "apply-theme-patch", {
      changes: [
        validPatchToken,
        { kind: "layer", index: 0, preset: "normal", property: "scale", value: 3.01 },
      ],
    })), /scale must be a number between 0.25 and 3/,
    "Studio accepted an out-of-range layer change inside a patch");
    assert.equal((await fs.readFile(editorStatePath, "utf8")), stateBeforeRejectedPatch,
      "A rejected multi-change patch partially persisted editor state");
    assert.equal((await fs.readFile(editorThemePath, "utf8")), themeBeforeRejectedPatch,
      "A rejected multi-change patch partially persisted the theme document");
    assert.equal(studioResult.state.revision, revisionBeforeRejectedPatch,
      "A rejected multi-change patch advanced the public revision");

    const metadataBeforePatch = JSON.parse(JSON.stringify(studioResult.state.metadata));
    assert.deepEqual(Object.keys(metadataBeforePatch.labels).sort(), ["en", "zh-CN", "zh-HKTW"],
      "Canonical Studio state omitted or added a label locale");
    assert.deepEqual(Object.keys(metadataBeforePatch.descriptions).sort(), ["en", "zh-CN", "zh-HKTW"],
      "Canonical Studio state omitted or added a description locale");
    const patchedMetadata = {
      labels: {
        en: "Studio Patch Theme",
        "zh-CN": "Studio Patch Theme zh-CN",
        "zh-HKTW": "Studio Patch Theme zh-HKTW",
      },
      descriptions: {
        en: "A theme updated in one transaction.",
        "zh-CN": "A theme updated in one transaction (zh-CN).",
        "zh-HKTW": "A theme updated in one transaction (zh-HKTW).",
      },
    };
    const layerBeforePatch = JSON.parse(JSON.stringify(studioResult.state.layers[0]));
    const blurBeforePatch = studioResult.state.shared.blur;
    const patchChanges = [
      validPatchToken,
      { kind: "layer", index: 0, preset: "shared", property: "opacity", value: 0.83 },
      ...Object.entries(patchedMetadata.labels).map(([locale, value]) => ({
        kind: "metadata", field: "label", locale, value,
      })),
      ...Object.entries(patchedMetadata.descriptions).map(([locale, value]) => ({
        kind: "metadata", field: "description", locale, value,
      })),
      { kind: "layer", index: 0, preset: "normal", property: "focalX", value: 67 },
      { kind: "layer", index: 0, preset: "normal", property: "focalY", value: 54 },
      { kind: "layer", index: 0, preset: "normal", property: "positionX", value: 3 },
      { kind: "layer", index: 0, preset: "normal", property: "positionY", value: -2 },
      { kind: "layer", index: 0, preset: "normal", property: "scale", value: 1.05 },
      { kind: "layer", index: 0, preset: "wide", property: "focalX", value: 61 },
      { kind: "layer", index: 0, preset: "wide", property: "focalY", value: 49 },
      { kind: "layer", index: 0, preset: "wide", property: "positionX", value: 4 },
    ];
    assert.equal(patchChanges.length, STUDIO_MAX_PATCH_CHANGES,
      "The boundary transaction no longer exercises the exact 16-change limit");
    const historyBeforePatch = JSON.parse(stateBeforeRejectedPatch).undo.length;
    const revisionBeforePatch = studioResult.state.revision;
    studioResult = await studioRequest(mutationRequest(studioResult, "apply-theme-patch", {
      changes: patchChanges,
    }));
    assert.equal(studioResult.state.revision, revisionBeforePatch + 1,
      "One theme patch advanced the revision more than once");
    assert.equal(studioResult.state.lastAction, "apply-theme-patch");
    assert.equal(studioResult.state.actionSucceeded, true);
    assert.equal(studioResult.state.shared.blur, 23);
    assert.equal(studioResult.state.studioStyle.shared.blur, 23,
      "An atomic style patch did not update the Studio shell material");
    assert.equal(studioResult.state.layers[0].opacity, 0.83);
    assert.equal(studioResult.state.layers[0].frames.normal.focalX, 67);
    assert.deepEqual(studioResult.state.metadata, patchedMetadata,
      "Canonical Studio state did not expose all exact localized metadata");
    const internalAfterPatch = JSON.parse(await fs.readFile(editorStatePath, "utf8"));
    assert.equal(internalAfterPatch.undo.length, historyBeforePatch + 1,
      "One theme patch created more than one history item");
    assert.equal(internalAfterPatch.currentDocument.id, studioThemeId,
      "A theme patch changed the immutable theme id");
    assert.equal(internalAfterPatch.currentDocument.theme.label, patchedMetadata.labels.en,
      "The English localized label did not update the legacy theme label");
    assert.equal(internalAfterPatch.currentDocument.theme.description, patchedMetadata.descriptions.en,
      "The English localized description did not update the legacy theme description");

    const patchResult = studioResult;
    studioResult = await studioRequest(mutationRequest(studioResult, "undo-theme-edit"));
    assert.deepEqual(studioResult.state.metadata, metadataBeforePatch,
      "One Undo did not restore every localized metadata change in the patch");
    assert.equal(studioResult.state.shared.blur, blurBeforePatch,
      "One Undo did not restore the token changed in the patch");
    assert.equal(studioResult.state.studioStyle.shared.blur, blurBeforePatch,
      "One Undo did not restore Studio's shell material");
    assert.deepEqual(studioResult.state.layers[0], layerBeforePatch,
      "One Undo did not restore every layer change in the patch");
    studioResult = await studioRequest(mutationRequest(studioResult, "redo-theme-edit"));
    assert.deepEqual(studioResult.state.metadata, patchedMetadata,
      "One Redo did not restore the atomic theme patch");
    assert.equal(studioResult.state.studioStyle.shared.blur, 23,
      "One Redo did not restore Studio's shell material");
    assert.equal(studioResult.payload, patchResult.payload,
      "Redo did not reproduce the patch's exact validated payload");

    const localeRevision = studioResult.state.revision;
    studioResult = await studioRequest(mutationRequest(studioResult, "apply-theme-patch", {
      changes: [{ kind: "metadata-locale", locale: "ja", enabled: true }],
    }));
    assert.equal(studioResult.state.revision, localeRevision + 1,
      "Enabling one theme locale did not create one revision");
    assert.equal(studioResult.state.actionSucceeded, false,
      "An enabled locale with empty generated fields was treated as saveable");
    assert.equal(studioResult.state.error, "invalid-metadata");
    assert.deepEqual(studioResult.state.feedback.errors, [{
      code: "invalid-metadata",
      field: "metadata.labels.ja",
    }], "An incomplete locale did not identify its first generated field");
    assert.equal(studioResult.state.metadata.labels.ja, "");
    assert.equal(studioResult.state.metadata.descriptions.ja, "");
    const incompleteLocaleState = JSON.parse(await fs.readFile(editorStatePath, "utf8"));
    assert.equal(incompleteLocaleState.currentDocument.labels.ja, "",
      "The generated locale fields were not persisted in the editable draft");
    assert.equal(Object.hasOwn(incompleteLocaleState.lastValidDocument.labels, "ja"), false,
      "An incomplete locale replaced Aura's last-valid theme");

    const hydratedLocaleDraft = await hydrateStudioDraft({
      configPath: studioConfigPath,
      userThemesDir: studioUserThemesDir,
      editorRoot: studioEditorRoot,
      locale: "ja",
    });
    assert.equal(hydratedLocaleDraft.state.metadata.labels.ja, "",
      "Restart hydration discarded an incomplete selected locale");
    assert.equal(typeof hydratedLocaleDraft.payload, "string",
      "Restart hydration did not keep the last-valid payload active");
    studioResult = hydratedLocaleDraft;

    studioResult = await studioRequest(mutationRequest(studioResult, "apply-theme-patch", {
      changes: [
        { kind: "metadata", field: "label", locale: "ja", value: "Japanese Studio Theme" },
        { kind: "metadata", field: "description", locale: "ja", value: "Japanese theme description." },
      ],
    }));
    assert.equal(studioResult.state.actionSucceeded, true,
      "Completing both generated locale fields did not validate the draft");
    assert.equal(studioResult.state.metadata.labels.ja, "Japanese Studio Theme");
    assert.equal(studioResult.state.metadata.descriptions.ja, "Japanese theme description.");
    studioResult = await hydrateStudioDraft({
      configPath: studioConfigPath,
      userThemesDir: studioUserThemesDir,
      editorRoot: studioEditorRoot,
      locale: "ja",
    });
    assert.equal(studioResult.state.metadata.labels.ja, "Japanese Studio Theme",
      "Restart hydration rejected an incomplete locale snapshot in Undo history");

    const runtimeLocaleThemesDir = path.join(temporary, "runtime-locale-themes");
    const runtimeLocaleThemeDir = path.join(runtimeLocaleThemesDir, studioThemeId);
    await fs.mkdir(runtimeLocaleThemesDir);
    await fs.cp(path.join(studioEditorRoot, "active"), runtimeLocaleThemeDir, { recursive: true });
    const japaneseRuntimeTheme = (await listThemes({
      locale: "ja",
      userThemesDir: runtimeLocaleThemesDir,
    })).find((theme) => theme.name === studioThemeId);
    const fallbackRuntimeTheme = (await listThemes({
      locale: "ko",
      userThemesDir: runtimeLocaleThemesDir,
    })).find((theme) => theme.name === studioThemeId);
    assert.equal(japaneseRuntimeTheme?.label, "Japanese Studio Theme",
      "Runtime selection did not use an enabled locale");
    assert.equal(fallbackRuntimeTheme?.label, patchedMetadata.labels.en,
      "Runtime selection did not fall back to English for an unsupported theme locale");

    studioResult = await studioRequest(mutationRequest(studioResult, "undo-theme-edit"));
    assert.equal(studioResult.state.actionSucceeded, false,
      "Undo did not restore the incomplete generated locale fields");
    assert.equal(studioResult.state.metadata.labels.ja, "");
    studioResult = await studioRequest(mutationRequest(studioResult, "redo-theme-edit"));
    assert.equal(studioResult.state.metadata.labels.ja, "Japanese Studio Theme",
      "Redo did not restore the completed locale fields");
    studioResult = await studioRequest(mutationRequest(studioResult, "apply-theme-patch", {
      changes: [{ kind: "metadata-locale", locale: "ja", enabled: false }],
    }));
    assert.equal(Object.hasOwn(studioResult.state.metadata.labels, "ja"), false,
      "Disabling a locale retained its label field");
    assert.equal(Object.hasOwn(studioResult.state.metadata.descriptions, "ja"), false,
      "Disabling a locale retained its description field");
    const revisionBeforeEnglishRemoval = studioResult.state.revision;
    await assert.rejects(studioRequest(mutationRequest(studioResult, "apply-theme-patch", {
      changes: [{ kind: "metadata-locale", locale: "en", enabled: false }],
    })), /English theme metadata cannot be removed/,
    "Studio allowed removal of the runtime fallback locale");
    assert.equal(JSON.parse(await fs.readFile(editorStatePath, "utf8")).revision,
      revisionBeforeEnglishRemoval, "A rejected English removal advanced the revision");
    studioResult = await studioRequest(mutationRequest(studioResult, "undo-theme-edit"));
    assert.equal(studioResult.state.metadata.labels.ja, "Japanese Studio Theme",
      "Undo did not restore a disabled locale and its completed fields");
    studioResult = await studioRequest(mutationRequest(studioResult, "redo-theme-edit"));
    assert.equal(Object.hasOwn(studioResult.state.metadata.labels, "ja"), false,
      "Redo did not remove the selected locale again");

    const staleRevisionRequest = mutationRequest(studioResult, "set-theme-layer", {
      index: 0, preset: "shared", property: "opacity", value: 0.7,
    });
    staleRevisionRequest.revision -= 1;
    await assert.rejects(studioRequest(staleRevisionRequest), /revision is stale/);
    const foreignSessionRequest = { ...staleRevisionRequest, revision: studioResult.state.revision,
      session: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" };
    await assert.rejects(studioRequest(foreignSessionRequest), /session is stale/);
    await assert.rejects(studioRequest({
      ...mutationRequest(studioResult, "set-theme-layer", {
        index: 0, preset: "shared", property: "opacity", value: 0.7,
      }),
      path: "C:\\private.webp",
    }), /(?:must contain only|unsupported property shape)/,
    "The core request dispatcher accepted an extra path property");

    for (const [preset, property, value] of [
      ["shared", "appearance", "light"],
      ["shared", "context", "new-chat"],
      ["shared", "viewport", "normal"],
      ["normal", "anchor", "top-right"],
      ["normal", "focalX", 72],
      ["normal", "focalY", 38],
      ["normal", "positionX", -12],
      ["normal", "positionY", 8],
      ["normal", "scale", 1.15],
      ["wide", "anchor", "bottom-right"],
      ["wide", "focalX", 80],
      ["wide", "focalY", 64],
      ["wide", "positionX", -20],
      ["wide", "positionY", 14],
      ["wide", "scale", 0.9],
    ]) {
      studioResult = await studioRequest(mutationRequest(studioResult, "set-theme-layer", {
        index: 0, preset, property, value,
      }));
    }
    assert.deepEqual({
      appearance: studioResult.state.layers[0].appearance,
      context: studioResult.state.layers[0].context,
      viewport: studioResult.state.layers[0].viewport,
      normal: studioResult.state.layers[0].frames.normal,
      wide: studioResult.state.layers[0].frames.wide,
    }, {
      appearance: "light",
      context: "new-chat",
      viewport: "normal",
      normal: { anchor: "top-right", focalX: 72, focalY: 38, positionX: -12, positionY: 8, scale: 1.15 },
      wide: { anchor: "bottom-right", focalX: 80, focalY: 64, positionX: -20, positionY: 14, scale: 0.9 },
    });
    const layerIdsBeforeMove = studioResult.state.layers.map((layer) => layer.id);
    studioResult = await studioRequest(mutationRequest(studioResult, "move-theme-layer", {
      index: 7, direction: "up",
    }));
    assert.deepEqual(studioResult.state.layers.slice(6).map((layer) => layer.role), ["decoration", "corner"]);
    assert.deepEqual(studioResult.state.layers.slice(6).map((layer) => layer.id),
      [layerIdsBeforeMove[7], layerIdsBeforeMove[6]],
      "Layer reorder changed stable ids instead of moving them with their layers");
    studioResult = await studioRequest(mutationRequest(studioResult, "remove-theme-layer", { index: 7 }));
    assert.equal(studioResult.state.layers.length, 7);
    studioResult = await studioRequest(mutationRequest(studioResult, "undo-theme-edit"));
    assert.equal(studioResult.state.layers.length, STUDIO_MAX_LAYERS,
      "Undo did not restore a removed artwork layer");
    assert.equal(studioResult.state.feedback.valid, true,
      "The valid lifecycle fixture became invalid before the last-valid-payload check");

    const lastValidPayload = studioResult.payload;
    const lastValidStudioStyle = structuredClone(studioResult.state.studioStyle);
    const lastValidLauncherStyle = structuredClone(studioResult.state.launcherStyle);
    const canvasColor = studioResult.state.tokens.light.canvas;
    const originalTextColor = studioResult.state.tokens.light.text;
    const invalidEdit = await studioRequest(mutationRequest(studioResult, "set-theme-token", {
      mode: "light", token: "text", value: canvasColor,
    }));
    assert.equal(invalidEdit.state.feedback.valid, false);
    assert.equal(invalidEdit.state.actionSucceeded, false);
    assert.equal(invalidEdit.state.tokens.light.text, canvasColor,
      "The invalid editable token was not preserved for correction");
    assert.deepEqual(invalidEdit.state.studioStyle, lastValidStudioStyle,
      "An invalid edit changed Studio away from Aura's last-valid applied style");
    assert.deepEqual(invalidEdit.state.launcherStyle, lastValidLauncherStyle,
      "An invalid theme edit changed the applied App identity");
    assert.notEqual(invalidEdit.state.studioStyle.light.text, invalidEdit.state.tokens.light.text,
      "Studio exposed the invalid current token instead of the last-valid applied token");
    assert.equal(invalidEdit.payload, null,
      "An invalid mutation replaced the live last-valid renderer payload");
    assert.equal(invalidEdit.apply, "none");
    assert(invalidEdit.state.feedback.errors.some((error) => error.code === "contrast"));
    const hydratedInvalidDraft = await hydrateStudioDraft({
      configPath: studioConfigPath,
      userThemesDir: studioUserThemesDir,
      editorRoot: studioEditorRoot,
      locale: "en",
    });
    assert.equal(hydratedInvalidDraft.state.session, invalidEdit.state.session);
    assert.equal(hydratedInvalidDraft.state.revision, invalidEdit.state.revision);
    assert.equal(hydratedInvalidDraft.state.feedback.valid, false,
      "Hydration hid the invalid current document instead of keeping it resumable");
    assert.deepEqual(hydratedInvalidDraft.state.studioStyle, lastValidStudioStyle,
      "Hydration changed Studio away from Aura's last-valid applied style");
    assert.deepEqual(hydratedInvalidDraft.state.launcherStyle, lastValidLauncherStyle,
      "Hydration changed the App identity away from the last-valid draft");
    assert.equal(hydratedInvalidDraft.payload, lastValidPayload,
      "Hydration did not keep the last valid renderer payload active");
    const hydratedMirror = JSON.parse(await fs.readFile(
      path.join(studioEditorRoot, "active", "theme.json"), "utf8",
    ));
    assert.equal(hydratedMirror.theme.light.semantic["--aura-text-primary"],
      hydratedMirror.theme.light.semantic["--aura-background-primary"],
    "Hydration replaced the invalid editable mirror with the last-valid document");
    studioResult = await studioRequest(mutationRequest(invalidEdit, "undo-theme-edit"));
    assert.equal(studioResult.state.feedback.valid, true);
    assert.deepEqual(studioResult.state.studioStyle, lastValidStudioStyle,
      "Undo did not restore the exact last-valid Studio shell style");
    assert.equal(studioResult.payload, lastValidPayload,
      "Undo after an invalid mutation did not restore the exact last-valid payload");
    const invalidThenCorrected = await studioRequest(mutationRequest(studioResult, "set-theme-token", {
      mode: "light", token: "text", value: canvasColor,
    }));
    studioResult = await studioRequest(mutationRequest(invalidThenCorrected, "set-theme-token", {
      mode: "light", token: "text", value: originalTextColor,
    }));
    assert.equal(studioResult.state.feedback.valid, true,
      "A corrective palette edit could not recover from an invalid contrast draft");
    assert.equal(studioResult.state.tokens.light.text, originalTextColor);
    assert.equal(studioResult.apply, "draft",
      "A corrected palette did not resume the live draft application");
    assert(studioResult.payload,
      "A corrected palette did not regenerate the renderer payload");

    const saveRequest = mutationRequest(studioResult, "save-theme-edit");
    await fs.access(firstLauncherStoredPath);
    await assert.rejects(studioRequest(saveRequest, {
      faultInjector: (stage) => { if (stage === "after-stage") throw new Error("injected after-stage failure"); },
    }), /injected after-stage failure/);
    assert.equal(await fs.stat(studioDestination).then(() => true, () => false), false,
      "A failed staged save installed a partial theme");
    assert.equal(JSON.parse(await fs.readFile(studioConfigPath, "utf8")).theme, "default",
      "A failed staged save changed the active theme");
    assert.equal(JSON.parse(await fs.readFile(path.join(studioEditorRoot, "active", ".editor-state.json"), "utf8")).revision,
      studioResult.state.revision, "A failed staged save lost or advanced the draft");
    await fs.access(firstLauncherStoredPath);
    assert.deepEqual((await fs.readdir(studioUserThemesDir)).filter((name) => name.startsWith(".save-")), [],
      "A failed staged save left an app-owned staging folder");

    studioResult = await studioRequest(saveRequest);
    assert.equal(studioResult.apply, "saved");
    assert.equal(studioResult.themesChanged, true);
    assert.equal(studioResult.configChanged, true);
    assert.equal(studioResult.state.isNew, false);
    assert.equal(studioResult.state.source, "user");
    assert.equal(studioResult.state.dirty, false);
    assert.deepEqual(studioResult.state.studioStyle, lastValidStudioStyle,
      "Saving changed the Studio shell style derived from the validated draft");
    assert.deepEqual(studioResult.state.launcherStyle, lastValidLauncherStyle,
      "Saving changed the validated App identity style");
    assert.deepEqual(
      (await fs.readdir(path.join(studioEditorRoot, "active", "launcher-marks")))
        .filter((name) => /^[a-f0-9]{64}\.png$/.test(name)),
      [`${secondLauncherDigest}.png`],
      "A successful save retained launcher-mark files that were reachable only through cleared history",
    );
    await assert.rejects(fs.access(firstLauncherStoredPath),
      "A successful save retained the previous launcher mark after clearing Undo history");
    assert.equal(JSON.parse(await fs.readFile(studioConfigPath, "utf8")).theme, studioThemeId);
    const installedStudioKit = await readThemeKit(studioDestination);
    assert.equal(installedStudioKit.schemaVersion, STUDIO_THEME_SCHEMA_VERSION);
    assert.equal(installedStudioKit.metadata.backgroundScope, "content");
    assert.equal(installedStudioKit.metadata.artworkLayers.length, STUDIO_MAX_LAYERS);
    assert.deepEqual(installedStudioKit.metadata.newChatLayout, {
      widthRatio: 0.64, offsetXRatio: 0.1, offsetYRatio: -0.08,
    });
    assert.equal(installedStudioKit.metadata.artworkLayers[0].appearance, "light");
    assert.equal(installedStudioKit.metadata.artworkLayers[0].context, "new-chat");
    assert.equal(installedStudioKit.metadata.artworkLayers[0].viewport, "normal");
    assert.deepEqual(installedStudioKit.metadata.labels, patchedMetadata.labels,
      "Saved localized labels did not persist in the installed theme kit");
    assert.deepEqual(installedStudioKit.metadata.descriptions, patchedMetadata.descriptions,
      "Saved localized descriptions did not persist in the installed theme kit");
    assert.equal(installedStudioKit.theme.label, patchedMetadata.labels.en,
      "Saved English label did not persist in legacy theme metadata");
    assert.equal(installedStudioKit.theme.description, patchedMetadata.descriptions.en,
      "Saved English description did not persist in legacy theme metadata");
    assert.deepEqual(installedStudioKit.theme.launcher, lastValidLauncherStyle,
      "Saved App identity material did not persist in the installed theme kit");
    const restartBundle = await buildPayload({ configPath: studioConfigPath, userThemesDir: studioUserThemesDir });
    assert.equal(restartBundle.theme.name, studioThemeId);
    assert.equal(restartBundle.settings.backgroundScope, "content");
    assert.equal(restartBundle.settings.artLayers.length, STUDIO_MAX_LAYERS);
    assert.deepEqual(restartBundle.settings.newChatLayout, {
      widthRatio: 0.64, offsetXRatio: 0.1, offsetYRatio: -0.08,
    });
    new Function(restartBundle.payload);
    const savedCliThemes = JSON.parse(run(process.execPath, [
      cliPath, "list", "--json", "--user-themes", studioUserThemesDir,
    ]));
    assert.deepEqual(savedCliThemes.find((theme) => theme.name === studioThemeId)?.studioStyle,
      lastValidStudioStyle,
      "CLI metadata did not preserve the saved user theme's Studio shell style");
    assert.deepEqual(savedCliThemes.find((theme) => theme.name === studioThemeId)?.launcher,
      lastValidLauncherStyle,
      "CLI metadata did not preserve the saved App identity style");

    // Close the saved session, reopen it as a user theme, and prove rollback
    // after every destructive save stage restores both folder and config.
    studioResult = await studioRequest(mutationRequest(studioResult, "discard-theme-edit"));
    assert.equal(studioResult.state.active, false);
    studioResult = await studioRequest({ type: "begin-theme-edit", theme: studioThemeId, reset: false });
    assert.deepEqual(studioResult.state.studioStyle, lastValidStudioStyle,
      "Reopening the saved user theme changed its Studio shell style");
    assert.deepEqual(studioResult.state.launcherStyle, lastValidLauncherStyle,
      "Reopening the saved user theme changed its App identity style");
    studioResult = await studioRequest(mutationRequest(studioResult, "set-theme-token", {
      mode: "shared", token: "backgroundScope", value: "full-window",
    }));
    const replacementSaveRequest = mutationRequest(studioResult, "save-theme-edit");
    for (const failureStage of ["after-backup", "after-install", "after-config"]) {
      await assert.rejects(studioRequest(replacementSaveRequest, {
        faultInjector: (stage) => { if (stage === failureStage) throw new Error(`injected ${failureStage} failure`); },
      }), new RegExp(`injected ${failureStage} failure`));
      assert.equal((await readThemeKit(studioDestination)).metadata.backgroundScope, "content",
        `${failureStage} rollback did not restore the previously installed theme`);
      assert.equal(JSON.parse(await fs.readFile(studioConfigPath, "utf8")).theme, studioThemeId,
        `${failureStage} rollback did not restore the previous configuration`);
      const transientFolders = (await fs.readdir(studioUserThemesDir))
        .filter((name) => /^\.(?:save|backup|failed|recovery)-/.test(name));
      assert.deepEqual(transientFolders, [], `${failureStage} rollback left a transient theme folder`);
      assert.equal(JSON.parse(await fs.readFile(path.join(studioEditorRoot, "active", ".editor-state.json"), "utf8")).revision,
        studioResult.state.revision, `${failureStage} rollback lost the editable draft`);
    }

    let transientConfigRecoveryAttempts = 0;
    await assert.rejects(studioRequest(replacementSaveRequest, {
      faultInjector: (stage) => { if (stage === "after-config") throw new Error("injected retryable recovery failure"); },
      recoveryFaultInjector: (stage, attempt) => {
        if (stage !== "rollback-config") return;
        transientConfigRecoveryAttempts += 1;
        if (attempt === 0) {
          const error = new Error("injected transient config lock");
          error.code = "EPERM";
          throw error;
        }
      },
      recoveryWait: async () => {},
    }), /injected retryable recovery failure/);
    assert.equal(transientConfigRecoveryAttempts, 2,
      "Studio rollback did not retry a transient config recovery lock");
    assert.equal((await readThemeKit(studioDestination)).metadata.backgroundScope, "content");
    assert.deepEqual(
      (await fs.readdir(studioUserThemesDir)).filter((name) => /^\.(?:save|backup|failed|recovery)-/.test(name)),
      [],
      "Successful retry left recovery artifacts behind",
    );

    const clearStudioRecoveryArtifacts = async () => {
      for (const root of [studioUserThemesDir, studioEditorRoot]) {
        for (const name of await fs.readdir(root)) {
          if (!/^\.(?:save|backup|failed|recovery)-/.test(name)) continue;
          await fs.rm(path.join(root, name), { recursive: true, force: true });
        }
      }
    };
    const captureIncompleteRollback = async (operation, label) => {
      let caught = null;
      try {
        await operation;
      } catch (error) {
        caught = error;
      }
      assert(caught instanceof AggregateError, `${label} did not surface an AggregateError`);
      assert.equal(caught.code, "STUDIO_ROLLBACK_INCOMPLETE");
      assert.match(caught.message, /rollback was incomplete/);
      assert(caught.errors.length >= 2, `${label} did not retain the forward and recovery errors`);
      return caught;
    };

    await captureIncompleteRollback(studioRequest(replacementSaveRequest, {
      faultInjector: (stage) => { if (stage === "after-install") throw new Error("injected theme rollback setup"); },
      recoveryFileOperations: {
        rename: async (source, target) => {
          if (path.resolve(source) === path.resolve(studioDestination)
              && path.basename(target).startsWith(`.failed-${studioThemeId}-`)) {
            const error = new Error("injected installed-theme recovery failure");
            error.code = "EIO";
            throw error;
          }
          return fs.rename(source, target);
        },
      },
      recoveryWait: async () => {},
    }), "Installed-theme rollback failure");
    assert.equal((await readThemeKit(studioDestination)).metadata.backgroundScope, "full-window",
      "A failed theme rollback concealed the newly installed folder");
    const themeRollbackArtifacts = (await fs.readdir(studioUserThemesDir))
      .filter((name) => /^\.(?:save|backup|failed|recovery)-/.test(name));
    const retainedBackup = themeRollbackArtifacts.find((name) => name.startsWith(`.backup-${studioThemeId}-`));
    assert(retainedBackup, "A failed theme rollback did not preserve the previous installed theme");
    assert.equal((await readThemeKit(path.join(studioUserThemesDir, retainedBackup))).metadata.backgroundScope, "content");
    await fs.rm(studioDestination, { recursive: true, force: false });
    await fs.rename(path.join(studioUserThemesDir, retainedBackup), studioDestination);
    await clearStudioRecoveryArtifacts();

    await writeConfig(studioConfigPath, { ...DEFAULT_CONFIG, theme: "default" });
    await captureIncompleteRollback(studioRequest(replacementSaveRequest, {
      faultInjector: (stage) => { if (stage === "after-config") throw new Error("injected config rollback setup"); },
      recoveryFaultInjector: (stage) => {
        if (stage === "rollback-config") {
          const error = new Error("injected config recovery failure");
          error.code = "EIO";
          throw error;
        }
      },
      recoveryWait: async () => {},
    }), "Config rollback failure");
    assert.equal(JSON.parse(await fs.readFile(studioConfigPath, "utf8")).theme, studioThemeId,
      "A failed config rollback was reported as though the previous config were restored");
    assert((await fs.readdir(studioUserThemesDir)).some((name) => name.startsWith(`.recovery-config-${studioThemeId}-`)),
      "A failed config rollback did not preserve the previous config bytes");
    assert.equal((await readThemeKit(studioDestination)).metadata.backgroundScope, "content",
      "Config rollback failure prevented independent theme restoration");
    await writeConfig(studioConfigPath, { ...DEFAULT_CONFIG, theme: studioThemeId });
    await clearStudioRecoveryArtifacts();

    await captureIncompleteRollback(studioRequest(replacementSaveRequest, {
      faultInjector: (stage) => { if (stage === "after-editor-state") throw new Error("injected editor rollback setup"); },
      recoveryFaultInjector: (stage) => {
        if (stage === "rollback-editor-state") {
          const error = new Error("injected editor-state recovery failure");
          error.code = "EIO";
          throw error;
        }
      },
      recoveryWait: async () => {},
    }), "Editor-state rollback failure");
    const persistedFailedEditorState = JSON.parse(await fs.readFile(
      path.join(studioEditorRoot, "active", ".editor-state.json"),
      "utf8",
    ));
    assert.equal(persistedFailedEditorState.revision, studioResult.state.revision + 1,
      "Editor-state rollback failure was silently presented as restored state");
    const retainedEditorRecovery = (await fs.readdir(studioEditorRoot))
      .find((name) => name.startsWith(`.recovery-editor-${studioThemeId}-`));
    assert(retainedEditorRecovery, "A failed editor rollback did not preserve the previous editor-state bytes");
    await fs.writeFile(
      path.join(studioEditorRoot, "active", ".editor-state.json"),
      await fs.readFile(path.join(studioEditorRoot, retainedEditorRecovery)),
    );
    await clearStudioRecoveryArtifacts();
    assert.equal(JSON.parse(await fs.readFile(
      path.join(studioEditorRoot, "active", ".editor-state.json"),
      "utf8",
    )).revision, studioResult.state.revision);
    assert.equal((await readThemeKit(studioDestination)).metadata.backgroundScope, "content");
    assert.equal(JSON.parse(await fs.readFile(studioConfigPath, "utf8")).theme, studioThemeId);

    studioResult = await studioRequest(mutationRequest(studioResult, "discard-theme-edit"));
    assert.equal((await readThemeKit(studioDestination)).metadata.backgroundScope, "content",
      "Discard after rollback changed the saved theme");
    assert.equal(JSON.parse(await fs.readFile(studioConfigPath, "utf8")).theme, studioThemeId);

    // Core refuses an active-theme deletion; the host's allowlisted workflow
    // applies Default first, then the same delete request removes one exact
    // user-theme folder. Built-ins remain immutable.
    await assert.rejects(studioRequest({ type: "delete-user-theme", theme: studioThemeId }),
      /Apply Default before deleting the current theme/,
    "The core deleted an active user theme before Default was persisted");
    await writeConfig(studioConfigPath, { ...JSON.parse(await fs.readFile(studioConfigPath, "utf8")), theme: "default" });
    const deleteResult = await studioRequest({ type: "delete-user-theme", theme: studioThemeId });
    assert.equal(deleteResult.themesChanged, true);
    assert.equal(deleteResult.apply, "none");
    assert.equal(await fs.stat(studioDestination).then(() => true, () => false), false);
    assert.equal((await listThemes({ userThemesDir: studioUserThemesDir })).some((theme) => theme.name === studioThemeId), false);
    const afterStudioDelete = await buildPayload({ configPath: studioConfigPath, userThemesDir: studioUserThemesDir });
    assert.equal(afterStudioDelete.theme.name, "default");
    new Function(afterStudioDelete.payload);

    await writeConfig(studioConfigPath, { ...DEFAULT_CONFIG, theme: themeId });
    await assert.rejects(studioRequest({ type: "delete-user-theme", theme: "default" }),
      /Built-in themes cannot be deleted/,
    "Studio deleted a built-in theme");
    assert.equal((await fs.stat(path.join(PROJECT_ROOT, "themes", "default.json"))).isFile(), true);

    await fs.rm(installedFolder, { recursive: true, force: false });
    const afterDelete = await compileTheme({ configPath, userThemesDir });
    assert.equal(afterDelete.theme.name, "default", "Deleting the installed folder did not restore the safe fallback");
    assert.equal(afterDelete.settings.fallbackFrom, themeId);
    run(process.execPath, [cliPath, "init", "--config", configPath, "--user-themes", userThemesDir]);
    assert.equal(JSON.parse(await fs.readFile(configPath, "utf8")).theme, "default",
      "Restart did not persist the fallback after uninstall");
    assert.equal((await listThemes({ userThemesDir })).some((theme) => theme.name === themeId), false);
    assert.equal((await fs.stat(collisionFolder)).isDirectory(), true,
      "One-folder uninstall removed a different user theme folder");
  } finally {
    await fs.rm(temporary, { recursive: true, force: true });
  }
});

test("WO-21 migrates every legacy Studio slot and keeps personal greetings out of theme files", async () => {
  const temporary = await fs.mkdtemp(path.join(PROJECT_ROOT, "tests", ".tmp-greeting-migration-"));
  const cliPath = path.join(PROJECT_ROOT, "scripts", "theme-cli.mjs");
  const authoringRoot = path.join(temporary, "authoring");
  const userThemesDir = path.join(temporary, "user-themes");
  const editorRoot = path.join(temporary, "editor");
  const configPath = path.join(temporary, "config.json");
  const legacyId = "legacy-greeting-migration";
  try {
    await Promise.all([
      fs.mkdir(authoringRoot, { recursive: true }),
      fs.mkdir(userThemesDir, { recursive: true }),
    ]);
    run(process.execPath, [cliPath, "scaffold", legacyId], { cwd: authoringRoot });
    const sourceKit = path.join(authoringRoot, "themes", legacyId);
    const installedKit = path.join(userThemesDir, legacyId);
    await fs.cp(sourceKit, installedKit, { recursive: true });
    await writeConfig(configPath, { ...DEFAULT_CONFIG });
    const request = (message) => executeStudioRequest({
      request: message,
      configPath,
      userThemesDir,
      editorRoot,
      locale: "en",
    });
    const action = (result, type, values = {}) => ({
      type,
      session: result.state.session,
      revision: result.state.revision,
      ...values,
    });

    const installedThemePath = path.join(installedKit, "theme.json");
    const installedV1Bytes = await fs.readFile(installedThemePath, "utf8");
    const installedV1 = JSON.parse(installedV1Bytes);
    assert.equal(installedV1.schemaVersion, 1);

    let result = await request({ type: "begin-theme-edit", theme: legacyId, reset: false });
    const activePaths = studioPaths(editorRoot);
    const openedDocument = JSON.parse(await fs.readFile(activePaths.theme, "utf8"));
    assert.equal(openedDocument.schemaVersion, STUDIO_THEME_SCHEMA_VERSION,
      "Opening an installed schema-v1 kit did not create a schema-v3 Studio document");
    assert.equal(openedDocument.newChatGreetingStyle, null,
      "Opening an installed schema-v1 kit invented portable greeting presentation");
    const openedInternal = JSON.parse(await fs.readFile(activePaths.state, "utf8"));
    for (const property of ["baselineDocument", "currentDocument", "lastValidDocument"]) {
      assert.equal(openedInternal[property].schemaVersion, STUDIO_THEME_SCHEMA_VERSION,
        `Opening schema v1 did not normalize ${property}`);
      assert.equal(openedInternal[property].newChatGreetingStyle, null,
        `Opening schema v1 did not initialize ${property}.newChatGreetingStyle`);
    }
    assert.equal(await fs.readFile(installedThemePath, "utf8"), installedV1Bytes,
      "Opening an installed schema-v1 kit rewrote the installed file");

    const schemaV1 = structuredClone(installedV1);
    const schemaV2 = structuredClone(openedDocument);
    schemaV2.schemaVersion = 2;
    delete schemaV2.newChatGreetingStyle;
    const legacyState = structuredClone(openedInternal);
    legacyState.version = 1;
    legacyState.baselineDocument = structuredClone(schemaV1);
    legacyState.currentDocument = structuredClone(schemaV2);
    legacyState.lastValidDocument = structuredClone(schemaV1);
    legacyState.undo = [structuredClone(schemaV1), structuredClone(schemaV2)];
    legacyState.redo = [structuredClone(schemaV2), structuredClone(schemaV1)];
    legacyState.appliedUndo = [structuredClone(schemaV2), structuredClone(schemaV1)];
    legacyState.appliedRedo = [structuredClone(schemaV1), structuredClone(schemaV2)];
    legacyState.launcherUndo = [null, null];
    legacyState.launcherRedo = [null, null];
    legacyState.appliedLauncherUndo = [null, null];
    legacyState.appliedLauncherRedo = [null, null];
    for (const property of [
      "greetingBaseline", "greetingCurrent", "greetingLastValid",
      "greetingUndo", "greetingRedo", "greetingAppliedUndo", "greetingAppliedRedo",
    ]) delete legacyState[property];
    await fs.writeFile(activePaths.state, `${JSON.stringify(legacyState, null, 2)}\n`, "utf8");
    await fs.writeFile(activePaths.theme, `${JSON.stringify(schemaV2, null, 2)}\n`, "utf8");

    result = await request({ type: "begin-theme-edit", theme: legacyId, reset: false });
    const migrated = JSON.parse(await fs.readFile(activePaths.state, "utf8"));
    assert.equal(migrated.version, 2, "Legacy Studio state did not persist its current envelope version");
    const migratedSlots = [
      ["baseline", migrated.baselineDocument],
      ["current", migrated.currentDocument],
      ["last valid", migrated.lastValidDocument],
      ...migrated.undo.map((document, index) => [`undo ${index}`, document]),
      ...migrated.redo.map((document, index) => [`redo ${index}`, document]),
      ...migrated.appliedUndo.map((document, index) => [`applied undo ${index}`, document]),
      ...migrated.appliedRedo.map((document, index) => [`applied redo ${index}`, document]),
    ];
    assert.equal(migratedSlots.length, 11, "The migration fixture stopped covering every history family");
    for (const [label, document] of migratedSlots) {
      assert.equal(document.schemaVersion, STUDIO_THEME_SCHEMA_VERSION,
        `Migration left ${label} on an older theme schema`);
      assert(Object.hasOwn(document, "newChatGreetingStyle"),
        `Migration omitted ${label}.newChatGreetingStyle`);
      assert.equal(document.newChatGreetingStyle, null,
        `Migration invented greeting presentation in ${label}`);
    }
    for (const [label, values, expectedLength] of [
      ["personal undo", migrated.greetingUndo, migrated.undo.length],
      ["personal redo", migrated.greetingRedo, migrated.redo.length],
      ["personal applied undo", migrated.greetingAppliedUndo, migrated.appliedUndo.length],
      ["personal applied redo", migrated.greetingAppliedRedo, migrated.appliedRedo.length],
    ]) {
      assert.equal(values.length, expectedLength, `${label} was not aligned during legacy migration`);
    }
    assert.equal(await fs.readFile(installedThemePath, "utf8"), installedV1Bytes,
      "Migrating active v1/v2 history rewrote the installed schema-v1 kit");
    result = await request(action(result, "discard-theme-edit"));
    assert.equal(result.state.active, false);

    const privacyThemeId = "default-copy";
    const displayName = "PRIVACY_DISPLAY_NAME_CANARY";
    const globalPhrase = "PRIVACY_GLOBAL_PHRASE_CANARY {name}";
    const overridePhrases = [
      "PRIVACY_THEME_PHRASE_CANARY {name}",
      "PRIVACY_THEME_SECOND_CANARY",
    ];
    const effectiveOverridePhrases = [
      `PRIVACY_THEME_PHRASE_CANARY ${displayName}`,
      overridePhrases[1],
    ];
    const phraseDigest = crypto.createHash("sha256")
      .update(JSON.stringify(effectiveOverridePhrases), "utf8")
      .digest("hex");
    const greetingPreferences = {
      enabled: true,
      source: "custom",
      displayName,
      globalPhrases: [globalPhrase],
      themeOverrides: {
        [privacyThemeId]: { mode: "custom", phrases: overridePhrases },
      },
      shuffle: {
        themeId: privacyThemeId,
        phraseDigest,
        order: [1, 0],
        cursor: 1,
        lastIndex: 1,
      },
    };
    await writeConfig(configPath, { ...DEFAULT_CONFIG, greetingPreferences });

    const assertPortableOnly = (document, label) => {
      const serialized = JSON.stringify(document);
      assert.equal(Object.hasOwn(document, "greetingPreferences"), false,
        `${label} contains the host-owned greeting envelope`);
      for (const canary of [
        displayName, globalPhrase, ...overridePhrases, ...effectiveOverridePhrases, phraseDigest,
      ]) {
        assert(!serialized.includes(canary), `${label} leaked personal greeting value ${canary}`);
      }
    };

    let privacyResult = await request({ type: "create-theme-copy", theme: "default" });
    assert.equal(privacyResult.state.id, privacyThemeId);
    const activePrivacyDocument = JSON.parse(await fs.readFile(studioPaths(editorRoot).theme, "utf8"));
    assertPortableOnly(activePrivacyDocument, "Duplicated theme.json");
    privacyResult = await request(action(privacyResult, "save-theme-edit"));
    assert.equal(privacyResult.state.actionSucceeded, true);
    const savedPrivacyPath = path.join(userThemesDir, privacyThemeId, "theme.json");
    const savedPrivacyDocument = JSON.parse(await fs.readFile(savedPrivacyPath, "utf8"));
    assertPortableOnly(savedPrivacyDocument, "Saved theme.json");
    const persistedConfig = JSON.parse(await fs.readFile(configPath, "utf8"));
    assert.deepEqual(persistedConfig.greetingPreferences, greetingPreferences,
      "Saving a theme changed or removed its host-owned greeting preferences");
    assert.equal(persistedConfig.theme, privacyThemeId);

    const poisonedV3 = { ...structuredClone(savedPrivacyDocument), greetingPreferences };
    assert.throws(
      () => validateStudioThemeKitDocument(poisonedV3, "poisoned schema-v3 theme"),
      /unsupported property|host-owned/,
      "Schema-v3 validation accepted host-owned greeting preferences",
    );
    const poisonedV1Directory = path.join(temporary, "poisoned-schema-v1");
    await fs.cp(sourceKit, poisonedV1Directory, { recursive: true });
    const poisonedV1Path = path.join(poisonedV1Directory, "theme.json");
    const poisonedV1 = JSON.parse(await fs.readFile(poisonedV1Path, "utf8"));
    poisonedV1.greetingPreferences = greetingPreferences;
    await fs.writeFile(poisonedV1Path, `${JSON.stringify(poisonedV1, null, 2)}\n`, "utf8");
    await assert.rejects(
      readThemeKit(poisonedV1Directory),
      /greetingPreferences is host-owned/,
      "Schema-v1 validation accepted host-owned greeting preferences",
    );
  } finally {
    await fs.rm(temporary, { recursive: true, force: true });
  }
});

runIfMain(import.meta.url);
