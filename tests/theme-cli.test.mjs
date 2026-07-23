// theme-cli tests. Extracted from the former monolithic tests/run-tests.mjs.
import { test, runIfMain } from "./support/harness.mjs";
import {
  AURA_VERSION,
  BUILTIN_BRAND_WORDMARK_ASSETS,
  DEFAULT_CONFIG,
  PROJECT_ROOT,
  REQUIRED_SEMANTIC_TOKENS,
  STUDIO_FONT_DISPLAY_STACKS,
  STUDIO_FONT_UI_STACKS,
  STUDIO_MAX_LAYERS,
  STUDIO_PREVIEW_MASTERS,
  STUDIO_SHADOWS,
  STUDIO_THEME_SCHEMA_VERSION,
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
test("theme-cli scaffolds a complete starter kit and validates it", async () => {
  const temporary = await fs.mkdtemp(path.join(PROJECT_ROOT, "tests", ".tmp-"));
  const cliPath = path.join(PROJECT_ROOT, "scripts", "theme-cli.mjs");
  const themeId = "cedar-mist";
  try {
    const snippet = JSON.parse(run(process.execPath, [cliPath, "scaffold", themeId], { cwd: temporary }));
    assert.equal(snippet.id, themeId);
    assert.equal(snippet.labels.en, "Cedar Mist");
    assert.equal(snippet.labels["zh-CN"], `自定义主题（${themeId}）`);
    assert.equal(snippet.labels["zh-TW"], `自訂主題（${themeId}）`);
    assert.equal(snippet.artwork, null);
    assert.equal(snippet.swatches.length >= 3, true);

    const themePath = path.join(temporary, "themes", `${themeId}.json`);
    const kitPath = path.join(temporary, "themes", themeId, "theme.json");
    const checklistPath = path.join(temporary, "themes", themeId, "CHECKLIST.md");
    const themeBytes = await fs.readFile(themePath, "utf8");
    const kitBytes = await fs.readFile(kitPath, "utf8");
    const checklistBytes = await fs.readFile(checklistPath, "utf8");
    const theme = JSON.parse(themeBytes);
    const kitDocument = JSON.parse(kitBytes);
    assert.equal(theme.name, themeId);
    assert.equal(theme.variant, themeId);
    assert.match(theme.$comment, /Starter theme copied from Default/);
    for (const section of ["typography", "shape", "effects", "light", "dark"]) {
      assert.equal(typeof theme[section].$comment, "string", `${section} lacks scaffold guidance`);
    }
    assert.equal(validateTheme(theme, themePath).name, themeId);
    assert.equal(kitDocument.schemaVersion, 1);
    assert.equal(kitDocument.id, themeId);
    assert.equal(kitDocument.theme.name, themeId);
    assert.equal(kitDocument.theme.variant, themeId);
    assert.equal(kitDocument.theme.launcher.asset, "assets/theme-art/default/launcher-mark.png");
    assert.match(checklistBytes, /launcher-mark\.png[\s\S]*theme\.launcher\.asset/);
    assert.equal((await readThemeKit(path.dirname(kitPath))).id, themeId);
    const schemaV1Compiled = await compileTheme({
      config: { ...DEFAULT_CONFIG, theme: themeId },
      themeKitDirectory: path.dirname(kitPath),
    });
    assert.equal(schemaV1Compiled.settings.backgroundScope, "full-window",
      "Schema-v1 themes must preserve their pre-editor full-window artwork behavior");

    const customLauncherDirectory = path.join(temporary, "custom-launcher-valid");
    await fs.mkdir(customLauncherDirectory);
    const launcherBytes = await fs.readFile(path.join(PROJECT_ROOT, "assets", "theme-art", "default", "launcher-mark.png"));
    await fs.writeFile(path.join(customLauncherDirectory, "launcher-mark.png"), launcherBytes);
    await fs.writeFile(path.join(customLauncherDirectory, "theme.json"), `${JSON.stringify({
      ...kitDocument,
      id: "custom-launcher-valid",
      theme: {
        ...kitDocument.theme,
        name: "custom-launcher-valid",
        variant: "custom-launcher-valid",
        launcher: { ...kitDocument.theme.launcher, asset: "launcher-mark.png" },
      },
    }, null, 2)}\n`, "utf8");
    assert.equal((await readThemeKit(customLauncherDirectory)).theme.launcher.asset, "launcher-mark.png");

    const invalidLauncherDirectory = path.join(temporary, "custom-launcher-invalid");
    await fs.mkdir(invalidLauncherDirectory);
    const wrongSizeLauncher = Buffer.from(launcherBytes);
    wrongSizeLauncher.writeUInt32BE(95, 16);
    let ihdrCrc = 0xffffffff;
    for (const byte of wrongSizeLauncher.subarray(12, 29)) {
      ihdrCrc ^= byte;
      for (let bit = 0; bit < 8; bit += 1) {
        ihdrCrc = (ihdrCrc >>> 1) ^ ((ihdrCrc & 1) ? 0xedb88320 : 0);
      }
    }
    wrongSizeLauncher.writeUInt32BE((ihdrCrc ^ 0xffffffff) >>> 0, 29);
    await fs.writeFile(path.join(invalidLauncherDirectory, "launcher-mark.png"), wrongSizeLauncher);
    await fs.writeFile(path.join(invalidLauncherDirectory, "theme.json"), `${JSON.stringify({
      ...kitDocument,
      id: "custom-launcher-invalid",
      theme: {
        ...kitDocument.theme,
        name: "custom-launcher-invalid",
        variant: "custom-launcher-invalid",
        launcher: { ...kitDocument.theme.launcher, asset: "launcher-mark.png" },
      },
    }, null, 2)}\n`, "utf8");
    await assert.rejects(readThemeKit(invalidLauncherDirectory), /exactly 96×96 pixels/);

    const invalidMetadata = [
      ["layout-range", { newChatLayout: { widthRatio: 0.99, offsetXRatio: 0, offsetYRatio: 0 } }, /widthRatio must be between/],
      ["layout-shape", { newChatLayout: { widthRatio: 0.76, offsetXRatio: 0, offsetYRatio: 0, path: "C:\\private.png" } }, /must contain only/],
      ["layer-role", { artworkLayers: [{ path: "background.png", role: "widget" }] }, /role has an unsupported value/],
      ["layer-appearance", { artworkLayers: [{ path: "background.png", appearance: "system" }] }, /appearance must be light or dark/],
      ["legacy-appearance", { artwork: { path: "hero.svg", appearance: "dark" } }, /appearance is only supported in artworkLayers/],
      ["layer-context", { artworkLayers: [{ path: "background.png", contextOverrides: { newchat: { opacity: 0.5 } } }] }, /unsupported context/],
      ["layer-resource", { artworkLayers: [{ path: "background.png", contextOverrides: { conversation: { position: "url(https://example.com/x)" } } }] }, /may not load remote resources/],
      ["layer-hidden", { artworkLayers: [{ path: "background.png", contextOverrides: { conversation: { hidden: "yes" } } }] }, /hidden must be true or false/],
    ];
    for (const [folder, metadata, pattern] of invalidMetadata) {
      const invalidDirectory = path.join(temporary, folder);
      await fs.mkdir(invalidDirectory);
      await fs.writeFile(path.join(invalidDirectory, "theme.json"), `${JSON.stringify({ ...kitDocument, ...metadata }, null, 2)}\n`, "utf8");
      await assert.rejects(readThemeKit(invalidDirectory), pattern);
    }

    const appearanceDirectory = path.join(temporary, "layer-appearance-valid");
    await fs.mkdir(appearanceDirectory);
    await fs.copyFile(
      path.join(PROJECT_ROOT, "assets", "theme-art", "anime-twilight", "background.webp"),
      path.join(appearanceDirectory, "background.webp"),
    );
    await fs.writeFile(path.join(appearanceDirectory, "theme.json"), `${JSON.stringify({
      ...kitDocument,
      artworkLayers: [{ path: "background.webp", appearance: "dark" }],
    }, null, 2)}\n`, "utf8");
    const appearanceKit = await readThemeKit(appearanceDirectory);
    assert.equal(appearanceKit.metadata.artworkLayers[0].appearance, "dark");

    const oversizedEmbeddedDirectory = path.join(temporary, "oversized-embedded");
    await fs.mkdir(oversizedEmbeddedDirectory);
    const paddedArtworkSource = await fs.readFile(
      path.join(PROJECT_ROOT, "assets", "theme-art", "anime-twilight", "card-preview.webp"),
    );
    const oversizedLayerNames = ["background.webp", "hero.webp", "corner-top-right.webp", "card-1.webp"];
    for (const [index, filename] of oversizedLayerNames.entries()) {
      const targetBytes = 330_000;
      const padded = Buffer.concat([
        paddedArtworkSource,
        Buffer.alloc(targetBytes - paddedArtworkSource.length, index + 1),
      ]);
      await fs.writeFile(path.join(oversizedEmbeddedDirectory, filename), padded);
    }
    const oversizedEmbeddedDocument = structuredClone(kitDocument);
    oversizedEmbeddedDocument.id = "oversized-embedded";
    oversizedEmbeddedDocument.theme.name = oversizedEmbeddedDocument.id;
    oversizedEmbeddedDocument.theme.variant = oversizedEmbeddedDocument.id;
    oversizedEmbeddedDocument.artwork = null;
    oversizedEmbeddedDocument.artworkLayers = oversizedLayerNames.map((filename) => ({
      path: filename,
      role: "decoration",
    }));
    await fs.writeFile(
      path.join(oversizedEmbeddedDirectory, "theme.json"),
      `${JSON.stringify(oversizedEmbeddedDocument, null, 2)}\n`,
      "utf8",
    );
    const oversizedSourceTotal = oversizedLayerNames.length * 330_000;
    assert(oversizedSourceTotal < 1_400_000,
      "Oversized-payload fixture must remain below the unique source-art limit");
    const oversizedValidation = spawnSync(process.execPath, [
      cliPath, "validate", oversizedEmbeddedDirectory,
    ], { cwd: PROJECT_ROOT, encoding: "utf8" });
    assert.notEqual(oversizedValidation.status, 0,
      "theme-cli validate accepted artwork whose Base64 payload exceeds 1.4 MB");
    assert.match(oversizedValidation.stderr, /embedded artwork must total less than 1\.4 MB/,
      "Oversized embedded-art rejection did not identify the violated payload budget");
    const oversizedRuntimeRoot = path.join(temporary, "oversized-runtime-themes");
    await fs.mkdir(oversizedRuntimeRoot);
    await fs.cp(
      oversizedEmbeddedDirectory,
      path.join(oversizedRuntimeRoot, oversizedEmbeddedDocument.id),
      { recursive: true },
    );
    const oversizedWarnings = [];
    const oversizedRuntime = await buildPayload({
      config: { ...DEFAULT_CONFIG, theme: oversizedEmbeddedDocument.id },
      userThemesDir: oversizedRuntimeRoot,
      onWarning: (message) => oversizedWarnings.push(message),
    });
    assert.equal(oversizedRuntime.theme.name, "default",
      "Runtime selected a directly installed kit whose Base64 artwork exceeds the payload budget");
    assert.equal(oversizedRuntime.settings.fallbackFrom, oversizedEmbeddedDocument.id);
    assert(oversizedWarnings.some((message) => /embedded artwork must total less than 1\.4 MB/.test(message)),
      "Runtime fallback did not warn why the oversized installed kit was ignored");

    // Studio-authored schema-v2 kits add editor-only framing and applicability
    // without changing the schema-v1 contract used by hand-authored kits.
    const studioThemeId = "studio-eight";
    const studioDirectory = path.join(temporary, studioThemeId);
    const studioArtworkDirectory = path.join(studioDirectory, "artwork");
    await fs.mkdir(studioArtworkDirectory, { recursive: true });
    const studioLayers = [];
    const sourceArtwork = path.join(PROJECT_ROOT, "assets", "theme-art", "anime-twilight", "card-preview.webp");
    for (let index = 0; index < STUDIO_MAX_LAYERS; index += 1) {
      const suffix = index.toString(16).padStart(32, "0");
      const layerName = `layer-${suffix}`;
      await fs.copyFile(sourceArtwork, path.join(studioArtworkDirectory, `${layerName}.webp`));
      studioLayers.push({
        id: layerName,
        path: `artwork/${layerName}.webp`,
        role: ["background", "hero", "corner", "decoration"][index % 4],
        appearance: ["all", "light", "dark"][index % 3],
        context: ["all", "new-chat", "conversation"][index % 3],
        viewport: ["all", "normal", "wide"][index % 3],
        visible: index !== 7,
        opacity: 1 - (index * 0.05),
        mask: index % 2 ? "soft-right" : "none",
        mobile: ["keep", "reduce", "hide"][index % 3],
        frames: {
          normal: { anchor: "top-left", positionX: index, positionY: -index, focalX: 25, focalY: 40, scale: 1 },
          wide: { anchor: "bottom-right", positionX: -index, positionY: index, focalX: 75, focalY: 60, scale: 1.25 },
        },
      });
    }
    for (const layer of studioLayers.slice(1)) layer.path = studioLayers[0].path;
    const studioTheme = {
      ...structuredClone(kitDocument.theme),
      name: studioThemeId,
      variant: studioThemeId,
      radius: 18,
      typography: {
        ...structuredClone(kitDocument.theme.typography),
        ui: STUDIO_FONT_UI_STACKS["system-sans"],
        body: STUDIO_FONT_UI_STACKS["system-sans"],
        display: STUDIO_FONT_DISPLAY_STACKS["editorial-serif"],
      },
      shape: { control: 18, card: 18, composer: 18, icon: 18, borderWidth: 1 },
      effects: {
        ...structuredClone(kitDocument.theme.effects),
        ...STUDIO_SHADOWS.soft,
      },
    };
    const studioDocument = {
      schemaVersion: STUDIO_THEME_SCHEMA_VERSION,
      id: studioThemeId,
      labels: { en: "Studio Eight", "zh-CN": "工作室八层主题", "zh-TW": "工作室八層主題" },
      descriptions: {
        en: "A Studio-authored schema-v2 compatibility fixture.",
        "zh-CN": "用于验证工作室第二版架构兼容性的主题。",
        "zh-TW": "用來驗證工作室第二版架構相容性的主題。",
      },
      swatches: ["#102030", "#405060", "#708090"],
      preview: { chrome: "#102030", background: "#203040", surface: "#304050", accent: "#708090", text: "#F0F4F8" },
      studioPreview: null,
      newChatLayout: { widthRatio: 0.72, offsetXRatio: -0.08, offsetYRatio: 0.12 },
      backgroundScope: "full-window",
      artworkLayers: studioLayers,
      theme: studioTheme,
    };
    await fs.writeFile(path.join(studioDirectory, "theme.json"), `${JSON.stringify(studioDocument, null, 2)}\n`, "utf8");
    const studioKit = await readThemeKit(studioDirectory);
    assert.equal(studioKit.schemaVersion, STUDIO_THEME_SCHEMA_VERSION);
    assert.equal(studioKit.metadata.backgroundScope, "full-window");
    assert.equal(studioKit.metadata.artworkLayers.length, STUDIO_MAX_LAYERS);
    assert.equal(new Set(studioKit.metadata.artworkLayers.map((layer) => layer.path)).size, 1,
      "Schema-v2 validation expanded one shared artwork source into duplicate paths");
    assert.equal(studioKit.theme.typography.body, studioKit.theme.typography.ui);
    assert.equal(studioKit.theme.typography.ui, STUDIO_FONT_UI_STACKS["system-sans"]);
    assert.equal(studioKit.theme.typography.display, STUDIO_FONT_DISPLAY_STACKS["editorial-serif"]);
    assert.deepEqual({
      shadowSoft: studioKit.theme.effects.shadowSoft,
      shadowElevated: studioKit.theme.effects.shadowElevated,
    }, STUDIO_SHADOWS.soft);
    assert.deepEqual(studioKit.theme.shape,
      { control: 18, card: 18, composer: 18, icon: 18, borderWidth: 1 });
    assert.deepEqual(studioKit.metadata.artworkLayers[0].frames.wide,
      { anchor: "bottom-right", positionX: 0, positionY: 0, focalX: 75, focalY: 60, scale: 1.25 });
    const studioCompiled = await compileTheme({
      config: { ...DEFAULT_CONFIG, theme: studioThemeId },
      themeKitDirectory: studioDirectory,
    });
    assert.equal(studioCompiled.settings.backgroundScope, "full-window");
    assert.equal(studioCompiled.settings.artLayers.length, STUDIO_MAX_LAYERS);
    assert.deepEqual(studioCompiled.settings.newChatLayout, studioDocument.newChatLayout);
    assert.equal(studioCompiled.settings.artLayers[1].context, "new-chat");
    assert.equal(studioCompiled.settings.artLayers[2].viewport, "wide");
    assert.equal(studioCompiled.settings.artLayers[7].visible, false);
    assert.equal(new Set(studioCompiled.settings.artLayers.map((layer) => layer.dataUrl)).size, 1,
      "Two schema-v2 layers sharing one path did not share the compiled source");
    const studioPayload = await buildPayloadFromCompiled(studioCompiled);
    new Function(studioPayload.payload);
    const studioRuntimeSettings = readPayloadSettings(studioPayload.payload);
    assert.equal(studioRuntimeSettings.u.length, 1,
      "The renderer payload duplicated a schema-v2 source used by multiple layers");
    assert(studioRuntimeSettings.artLayers.every((layer) => layer.d === 0),
      "Shared schema-v2 layers did not use the same pooled renderer source");
    const embeddedStudioArtBytes = [...new Set(studioCompiled.settings.artLayers.map((layer) => layer.dataUrl))]
      .reduce((total, dataUrl) => total + Buffer.byteLength(dataUrl, "utf8"), 0);
    assert(Buffer.byteLength(studioPayload.payload, "utf8")
      - embeddedStudioArtBytes < 65_000,
    "An eight-layer schema-v2 kit exceeded the renderer chrome budget");

    const tooManyLayersDirectory = path.join(temporary, "studio-nine");
    await fs.cp(studioDirectory, tooManyLayersDirectory, { recursive: true });
    const tooManyLayers = structuredClone(studioDocument);
    tooManyLayers.id = "studio-nine";
    tooManyLayers.theme.name = "studio-nine";
    tooManyLayers.theme.variant = "studio-nine";
    tooManyLayers.artworkLayers.push({ ...structuredClone(studioLayers[0]), id: `layer-${"f".repeat(32)}` });
    await fs.writeFile(path.join(tooManyLayersDirectory, "theme.json"), `${JSON.stringify(tooManyLayers, null, 2)}\n`, "utf8");
    await assert.rejects(readThemeKit(tooManyLayersDirectory), /artworkLayers must contain 0 to 8 layers/);

    const unsafeStudioDirectory = path.join(temporary, "studio-unsafe");
    await fs.cp(studioDirectory, unsafeStudioDirectory, { recursive: true });
    const unsafeStudioDocument = structuredClone(studioDocument);
    unsafeStudioDocument.id = "studio-unsafe";
    unsafeStudioDocument.theme.name = "studio-unsafe";
    unsafeStudioDocument.theme.variant = "studio-unsafe";
    unsafeStudioDocument.theme.customCss = "body { display: none }";
    await fs.writeFile(path.join(unsafeStudioDirectory, "theme.json"), `${JSON.stringify(unsafeStudioDocument, null, 2)}\n`, "utf8");
    await assert.rejects(readThemeKit(unsafeStudioDirectory), /customCss must be empty/);
    assert.equal(kitDocument.schemaVersion, 1, "Schema-v2 validation mutated the existing schema-v1 document");
    assert.equal((await readThemeKit(path.dirname(kitPath))).schemaVersion, 1,
      "Schema-v1 kits stopped loading after schema-v2 validation");

    const slotSpecs = [
      ["background.png", "≥1600 px wide"],
      ["hero.png", "≥1000 px"],
      ["corner-top-right.png", "safe to clip at the viewport edge"],
      ["corner-bottom.png", "safe to clip at the viewport edge"],
      ["card-1.png", "bottom-right 40%"],
      ["card-2.png", "bottom-right 40%"],
      ["card-3.png", "bottom-right 40%"],
      ["brand-mark.png", "reserved slot"],
    ];
    for (const [slot, cue] of slotSpecs) {
      assert(checklistBytes.includes(`\`${slot}\``), `Checklist is missing ${slot}`);
      assert(checklistBytes.includes(cue), `Checklist is missing the ${slot} specification`);
    }
    assert.match(checklistBytes, /tokens-only theme with no artwork is valid/);

    const validation = JSON.parse(run(process.execPath, [cliPath, "validate", "--theme", themeId], { cwd: temporary }));
    assert.equal(validation.pass, true);
    assert.equal(validation.theme, themeId);
    const folderValidation = JSON.parse(run(process.execPath, [cliPath, "validate", path.dirname(kitPath)], { cwd: temporary }));
    assert.deepEqual({ pass: folderValidation.pass, theme: folderValidation.theme, source: folderValidation.source },
      { pass: true, theme: themeId, source: "folder" });
    assert.equal(folderValidation.sourceFolder, path.dirname(kitPath));
    assert.throws(() => run(process.execPath, [cliPath, "validate", "--theme", "not-installed"], { cwd: temporary }),
      /Theme not found: not-installed/);

    const edgeId = "a--b";
    const edgeSnippet = JSON.parse(run(process.execPath, [cliPath, "scaffold", edgeId], { cwd: temporary }));
    assert.equal(edgeSnippet.labels.en, "A B");
    assert.equal(JSON.parse(await fs.readFile(path.join(temporary, "themes", `${edgeId}.json`), "utf8")).name, edgeId);
    assert.equal(JSON.parse(run(process.execPath, [cliPath, "validate", "--theme", edgeId], { cwd: temporary })).theme, edgeId);

    assert.throws(() => run(process.execPath, [cliPath, "scaffold", themeId], { cwd: temporary }), /already exists/);
    assert.equal(await fs.readFile(themePath, "utf8"), themeBytes, "Repeated scaffold changed the theme template");
    assert.equal(await fs.readFile(kitPath, "utf8"), kitBytes, "Repeated scaffold changed the standalone theme kit");
    assert.equal(await fs.readFile(checklistPath, "utf8"), checklistBytes, "Repeated scaffold changed the slot checklist");

    const beforeInvalid = (await fs.readdir(path.join(temporary, "themes"))).sort();
    for (const invalidId of ["a", "Uppercase", "under_score", "../escape", "a".repeat(41)]) {
      assert.throws(() => run(process.execPath, [cliPath, "scaffold", invalidId], { cwd: temporary }),
        /Theme id must match/);
      assert.deepEqual((await fs.readdir(path.join(temporary, "themes"))).sort(), beforeInvalid,
        `Invalid id created output: ${invalidId}`);
    }
    assert.throws(() => run(process.execPath, [cliPath, "scaffold", "default"], { cwd: temporary }), /already exists/);
  } finally {
    await fs.rm(temporary, { recursive: true, force: true });
  }
});

test("theme-cli qa audits every registered layer without generating images", async () => {
  const temporary = await fs.mkdtemp(path.join(PROJECT_ROOT, "tests", ".tmp-"));
  const cliPath = path.join(PROJECT_ROOT, "scripts", "theme-cli.mjs");
  try {
    assert.match(run(process.execPath, [cliPath, "help"], { cwd: temporary }), /^\s*qa <id>\s*$/m);
    assert.throws(() => run(process.execPath, [cliPath, "qa", "not-installed"], { cwd: temporary }),
      /Unknown theme|Theme not found/);
    const summary = JSON.parse(run(process.execPath, [cliPath, "qa", "japanese-idol"], {
      cwd: temporary,
      timeout: 60_000,
    }));
    assert.equal(summary.themeId, "japanese-idol");
    assert.equal(summary.outputDir, "dist/qa/japanese-idol");
    assert.equal(summary.boardPath, null);
    assert.equal(summary.statusPath, "dist/qa/japanese-idol/status.json");

    const outputDirectory = path.join(temporary, "dist", "qa", "japanese-idol");
    const status = JSON.parse(await fs.readFile(path.join(outputDirectory, "status.json"), "utf8"));
    assert.deepEqual(await fs.readdir(outputDirectory), ["status.json"], "QA emitted an image or other fixture artifact");
    assert.equal(status.schemaVersion, 4);
    assert.equal(status.state, "asset-audit-pass");
    assert.equal(status.visualReview.requiredSurface, "actual Aura WebView2 on live claude.ai");
    assert.equal(status.visualReview.fixtureImages, "forbidden");

    const expectedPaths = [
      "assets/theme-art/kawaii-idol/background.webp",
      "assets/theme-art/kawaii-idol/hero.webp",
      "assets/theme-art/kawaii-idol/dark-new-chat.webp",
      "assets/theme-art/kawaii-idol/dark-conversation.webp",
    ];
    assert.equal(status.theme.id, "japanese-idol");
    assert.deepEqual(status.assets.map((asset) => asset.path), expectedPaths,
      "Asset audit did not preserve every registry artwork layer in order");
    for (const asset of status.assets) {
      assert(asset.bytes > 0, `${asset.path} is empty`);
      assert.match(asset.sha256, /^[a-f0-9]{64}$/, `${asset.path} is missing its content digest`);
      assert(asset.image.width > 0 && asset.image.height > 0, `${asset.path} is missing native dimensions`);
      assert.equal(typeof asset.image.fullBleedExpected, "boolean");
      assert.equal(typeof asset.image.alphaExpected, "boolean");
      assert.equal(asset.budget.pass, true, `${asset.path} exceeds its layer budget`);
    }
    assert.equal(status.launcherAsset.path, "assets/theme-art/japanese-idol/launcher-mark.png");
    assert(status.launcherAsset.bytes > 0, "Launcher mark is empty");
    assert.match(status.launcherAsset.sha256, /^[a-f0-9]{64}$/, "Launcher mark is missing its content digest");
    assert.deepEqual(
      [status.launcherAsset.image.width, status.launcherAsset.image.height, status.launcherAsset.image.alpha],
      [96, 96, true],
      "Launcher mark is not a transparent 96×96 PNG",
    );
    assert.equal(status.launcherAsset.budget.pass, true, "Launcher mark exceeds its asset budget");
    assert.equal(status.launcherAsset.icon.path, "assets/theme-art/japanese-idol/launcher-mark.ico");
    assert(status.launcherAsset.icon.bytes > 0, "Launcher ICO is empty");
    assert.match(status.launcherAsset.icon.sha256, /^[a-f0-9]{64}$/, "Launcher ICO is missing its content digest");
    assert.equal(status.launcherAsset.icon.format, "ico");
    assert.equal(status.launcherAsset.icon.mime, "image/x-icon");
    assert.deepEqual(status.launcherAsset.icon.sizes, [16, 20, 24, 32, 40, 48, 64, 128, 256],
      "Launcher ICO is missing required Windows density frames");
    assert.equal(status.launcherAsset.icon.budget.pass, true, "Launcher ICO exceeds its asset budget");
    assert.equal(status.brandMarkAsset.path, "assets/theme-art/japanese-idol/brand-mark.svg");
    assert.equal(status.brandMarkAsset.format, "svg");
    assert.equal(status.brandMarkAsset.mime, "image/svg+xml");
    assert.deepEqual(
      [status.brandMarkAsset.image.width, status.brandMarkAsset.image.height, status.brandMarkAsset.image.alpha],
      [128, 128, true],
      "Japanese Idol brand mark is not a transparent square SVG",
    );
    assert.match(status.brandMarkAsset.sha256, /^[a-f0-9]{64}$/, "Brand mark is missing its content digest");
    assert.equal(status.brandMarkAsset.usage, "in-page-brand-mark");
    assert.equal(status.brandMarkAsset.renderer, false,
      "Asset preparation must not claim that the in-page replacement is already wired");
    assert.equal(status.brandMarkAsset.nativeFallback, true);
    assert.equal(status.brandMarkAsset.budget.pass, true);
    assert.equal(status.studioPreviewAsset.path, "assets/studio-previews/masters/japanese-idol.png");
    assert.equal(status.studioPreviewAsset.sha256, STUDIO_PREVIEW_MASTERS["japanese-idol"].sha256);
    assert.deepEqual(
      [status.studioPreviewAsset.image.width, status.studioPreviewAsset.image.height],
      STUDIO_PREVIEW_MASTERS["japanese-idol"].dimensions,
    );
    assert.deepEqual(status.studioPreviewAsset.frame, STUDIO_PREVIEW_MASTERS["japanese-idol"].frame);
    assert.equal(status.studioPreviewAsset.usage, "studio-picker-only");
    assert.equal(status.studioPreviewAsset.renderer, false);
    assert.equal(status.studioPreviewAsset.budget.pass, true);
    assert.equal(status.budgets.pass, true);
    assert.equal(status.budgets.limits.chromePayloadBytesExclusive, 65_000);
    assert.equal(status.budgets.limits.embeddedArtworkBytesExclusive, 1_400_000);
    assert.equal(status.budgets.limits.rasterLayerBytesExclusive, 400_000);
    assert.equal(status.budgets.limits.vectorBrandMarkBytesExclusive, 100_000);
    assert.equal(status.budgets.limits.studioPreviewBytesExclusive, 3_000_000);
    assert.deepEqual(status.payloads.map((payload) => payload.mode), ["light", "dark"]);
    for (const payload of status.payloads) {
      assert.equal(payload.theme, "japanese-idol");
      assert.equal(payload.layerCount, expectedPaths.length,
        `${payload.mode} payload omitted registered artwork layers`);
      assert.equal(payload.usesLegacyArtwork, false,
        `${payload.mode} payload fell back to the legacy artwork slot`);
      assert.equal(payload.syntax, "pass");
      assert(payload.bytes > 0);
      assert(payload.embeddedArtworkBytes > 0);
      assert(payload.chromeBytes > 0 && payload.chromeBytes < 65_000);
      assert.equal(payload.budgetPass, true);
    }

    for (const themeId of THEME_IDS) {
      const summary = JSON.parse(run(process.execPath, [cliPath, "qa", themeId], {
        cwd: temporary,
        timeout: 60_000,
      }));
      assert.equal(summary.themeId, themeId);
      assert.equal(summary.outputDir, `dist/qa/${themeId}`);
      assert.equal(summary.boardPath, null);

      const themeOutputDirectory = path.join(temporary, "dist", "qa", themeId);
      const themeStatus = JSON.parse(await fs.readFile(path.join(themeOutputDirectory, "status.json"), "utf8"));
      assert.deepEqual(await fs.readdir(themeOutputDirectory), ["status.json"],
        `${themeId} QA emitted an image or other fixture artifact`);
      assert.equal(themeStatus.schemaVersion, 4);
      assert.equal(themeStatus.state, "asset-audit-pass");
      assert.equal(themeStatus.theme.id, themeId);
      const expectedAssetCount = themeStatus.assets.length
        + 2
        + (themeStatus.brandMarkAsset ? 1 : 0)
        + 2
        + (themeStatus.studioPreviewAsset ? 1 : 0);
      assert.equal(summary.assetCount, expectedAssetCount,
        `${themeId} audit did not count artwork, launcher files, wordmarks, and optional preview/brand mark`);
      assert.equal(summary.layerCount, themeStatus.assets.length);

      const registeredWordmark = BUILTIN_BRAND_WORDMARK_ASSETS[themeId];
      assert.deepEqual(
        {
          minWidth: themeStatus.brandWordmarkAssets.minWidth,
          width: themeStatus.brandWordmarkAssets.width,
        },
        { minWidth: registeredWordmark.minWidth, width: registeredWordmark.width },
        `${themeId} wordmark lost its approved desktop sizing`,
      );
      for (const appearance of ["light", "dark"]) {
        const wordmark = themeStatus.brandWordmarkAssets[appearance];
        assert.equal(wordmark.path, registeredWordmark[appearance]);
        assert.equal(wordmark.appearance, appearance);
        assert(wordmark.bytes > 0 && wordmark.bytes < 400_000,
          `${themeId} ${appearance} wordmark exceeds its raster budget`);
        assert.match(wordmark.sha256, /^[a-f0-9]{64}$/,
          `${themeId} ${appearance} wordmark is missing its content digest`);
        assert.equal(wordmark.format, "png");
        assert.equal(wordmark.mime, "image/png");
        assert.deepEqual(
          [
            wordmark.image.width,
            wordmark.image.height,
            wordmark.image.alpha,
            wordmark.image.alphaExpected,
            wordmark.image.fullBleedExpected,
          ],
          [344, 124, true, true, false],
          `${themeId} ${appearance} wordmark audit lost its transparent @2x image contract`,
        );
        assert.equal(wordmark.budget.limitBytesExclusive, 400_000);
        assert.equal(wordmark.budget.pass, true);
        assert.equal(wordmark.usage, "in-page-brand-wordmark");
        assert.equal(wordmark.renderer, true,
          `${themeId} ${appearance} audit did not record the renderer integration`);
        assert.equal(wordmark.nativeFallback, true,
          `${themeId} ${appearance} audit lost the safe native-logo fallback`);
      }
      assert.notEqual(
        themeStatus.brandWordmarkAssets.light.sha256,
        themeStatus.brandWordmarkAssets.dark.sha256,
        `${themeId} Light and Dark audit entries must identify distinct assets`,
      );
      assert.equal(themeStatus.budgets.pass, true);
      assert.deepEqual(themeStatus.payloads.map((payload) => payload.mode), ["light", "dark"]);
      for (const payload of themeStatus.payloads) {
        assert.equal(payload.theme, themeId);
        assert.equal(payload.layerCount, themeStatus.assets.length);
        assert.equal(payload.syntax, "pass");
        assert(payload.embeddedArtworkBytes > 0,
          `${payload.mode} ${themeId} payload did not account for embedded wordmarks`);
        assert(payload.chromeBytes > 0 && payload.chromeBytes < 65_000);
        assert.equal(payload.budgetPass, true);
      }
    }

    const auditSource = await fs.readFile(path.join(PROJECT_ROOT, "scripts", "asset-audit.mjs"), "utf8");
    for (const forbidden of ["claude-dom", "--screenshot", "qa-board", "in-context-payload"]){
      assert(!auditSource.includes(forbidden), `Asset audit retains forbidden fixture hook: ${forbidden}`);
    }
  } finally {
    await fs.rm(temporary, { recursive: true, force: true });
  }
});

runIfMain(import.meta.url);
