// config tests. Extracted from the former monolithic tests/run-tests.mjs.
import { test, runIfMain } from "./support/harness.mjs";
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
test("config writes are atomic, aliases migrate, and theme choice persists", async () => {
  const temporary = await fs.mkdtemp(path.join(PROJECT_ROOT, "tests", ".tmp-"));
  try {
    const configPath = path.join(temporary, "config.json");
    await writeConfig(configPath, { ...DEFAULT_CONFIG, theme: "midnight" });
    const initialLabel = (await listThemes({ locale: "zh-CN" }))[0].label;
    const initialPayload = run(process.execPath, ["scripts/theme-cli.mjs", "init", "--config", configPath,
      "--locale", "zh-CN", "--payload"]);
    const initialRuntimeSettings = readPayloadSettings(initialPayload);
    assert.equal(initialRuntimeSettings.theme, "default");
    assert(!Object.hasOwn(initialRuntimeSettings, "label"),
      "The renderer payload retained an unused localized diagnostic label");
    new Function(initialPayload);
    assert.equal(JSON.parse(await fs.readFile(configPath, "utf8")).theme, "default");
    const initialShow = JSON.parse(run(process.execPath, [
      "scripts/theme-cli.mjs", "show", "--config", configPath, "--locale", "zh-CN", "--json",
    ]));
    assert.equal(initialShow.theme.label, initialLabel,
      "Removing the runtime diagnostic label changed localized CLI metadata");
    run(process.execPath, ["scripts/theme-cli.mjs", "set", "--config", configPath, "--theme", "study-library"]);
    assert.equal(JSON.parse(await fs.readFile(configPath, "utf8")).theme, "study-library");
    run(process.execPath, ["scripts/theme-cli.mjs", "set", "--config", configPath, "--appearance", "dark"]);
    assert.equal(JSON.parse(await fs.readFile(configPath, "utf8")).appearance, "dark");
    const appearanceBytes = await fs.readFile(configPath, "utf8");
    assert.throws(() => run(process.execPath, ["scripts/theme-cli.mjs", "set", "--config", configPath,
      "--appearance", "Dark"]), /appearance must be system, light, or dark/);
    assert.equal(await fs.readFile(configPath, "utf8"), appearanceBytes,
      "A rejected appearance changed the persisted configuration");
    run(process.execPath, ["scripts/theme-cli.mjs", "set", "--config", configPath,
      "--image-position", "23.5% 76.25%", "--image-zoom", "1.35",
      "--studio-preview-theme", "japanese-idol", "--studio-preview-x", "18.5",
      "--studio-preview-y", "64", "--studio-preview-zoom", "1.2"]);
    let framedConfig = JSON.parse(await fs.readFile(configPath, "utf8"));
    assert.equal(framedConfig.imagePosition, "23.5% 76.25%");
    assert.equal(framedConfig.imageZoom, 1.35);
    assert.deepEqual(framedConfig.studioPreviewCrops["japanese-idol"], { x: 18.5, y: 64, zoom: 1.2 });
    run(process.execPath, ["scripts/theme-cli.mjs", "set", "--config", configPath,
      "--studio-preview-theme", "korean-idol", "--studio-preview-x", "82",
      "--studio-preview-y", "31.25", "--studio-preview-zoom", "3.5"]);
    framedConfig = JSON.parse(await fs.readFile(configPath, "utf8"));
    assert.deepEqual(framedConfig.studioPreviewCrops["japanese-idol"], { x: 18.5, y: 64, zoom: 1.2 },
      "Updating another card crop erased the first crop");
    assert.deepEqual(framedConfig.studioPreviewCrops["korean-idol"], { x: 82, y: 31.25, zoom: 3.5 });
    const framedBytes = await fs.readFile(configPath, "utf8");
    assert.throws(() => run(process.execPath, ["scripts/theme-cli.mjs", "set", "--config", configPath,
      "--studio-preview-theme", "japanese-idol", "--studio-preview-x", "101",
      "--studio-preview-y", "50", "--studio-preview-zoom", "1"]), /must be between 0 and 100/);
    assert.equal(await fs.readFile(configPath, "utf8"), framedBytes,
      "A rejected crop changed the persisted configuration");
    assert.throws(() => run(process.execPath, ["scripts/theme-cli.mjs", "set", "--config", configPath,
      "--studio-preview-theme", "japanese-idol", "--studio-preview-x", "50",
      "--studio-preview-y", "50", "--studio-preview-zoom", "6.01"]), /must be between 1 and 6/);
    assert.equal(await fs.readFile(configPath, "utf8"), framedBytes,
      "An oversized Studio preview zoom changed the persisted configuration");
    assert.throws(() => run(process.execPath, ["scripts/theme-cli.mjs", "set", "--config", configPath,
      "--image-zoom", "NaN"]), /imageZoom must be between 1 and 2/);
    assert.equal(await fs.readFile(configPath, "utf8"), framedBytes,
      "A rejected background zoom changed the persisted configuration");
    const show = JSON.parse(run(process.execPath, ["scripts/theme-cli.mjs", "show", "--config", configPath, "--json"]));
    assert.equal(show.theme.name, "study-library");
    const localizedLabel = (await listThemes({ locale: "zh-TW" })).find((theme) => theme.name === "korean-idol").label;
    const savedPayload = run(process.execPath, ["scripts/theme-cli.mjs", "set", "--config", configPath,
      "--theme", "korean-idol", "--locale", "zh-TW", "--payload"]);
    assert(!Object.hasOwn(readPayloadSettings(savedPayload), "label"));
    assert.equal(JSON.parse(await fs.readFile(configPath, "utf8")).theme, "korean-idol");
    new Function(savedPayload);
    const localizedShow = JSON.parse(run(process.execPath, [
      "scripts/theme-cli.mjs", "show", "--config", configPath, "--locale", "zh-TW", "--json",
    ]));
    assert.equal(localizedShow.theme.label, localizedLabel);

    await writeConfig(configPath, {
      ...DEFAULT_CONFIG,
      theme: "default",
      customTheme: path.join(PROJECT_ROOT, "themes", "midnight.json"),
    });
    run(process.execPath, ["scripts/theme-cli.mjs", "set", "--config", configPath, "--theme", "korean-prestige"]);
    const migrated = JSON.parse(await fs.readFile(configPath, "utf8"));
    assert.equal(migrated.theme, "korean-prestige");
    assert.equal("customTheme" in migrated, false);
    assert.equal(JSON.parse(run(process.execPath, ["scripts/theme-cli.mjs", "show", "--config", configPath, "--json"])).theme.name, "korean-prestige");

    await writeConfig(configPath, {
      ...DEFAULT_CONFIG,
      theme: "anime-twilight",
      customTheme: path.join(temporary, "missing-theme.json"),
    });
    const unavailableCustom = await compileTheme({ configPath });
    assert.equal(unavailableCustom.theme.name, "anime-twilight");
    assert.equal(unavailableCustom.settings.customThemeUnavailable, true);
    assert.equal(unavailableCustom.settings.fallbackFrom, "custom-theme");
    assert.equal("customTheme" in unavailableCustom.effectiveConfig, false);
    run(process.execPath, ["scripts/theme-cli.mjs", "init", "--config", configPath]);
    const repaired = JSON.parse(await fs.readFile(configPath, "utf8"));
    assert.equal(repaired.theme, "anime-twilight");
    assert.equal("customTheme" in repaired, false);

    const corruptPath = path.join(temporary, "corrupt-config.json");
    const corruptSource = '{"theme":"korean-idol"';
    await fs.writeFile(corruptPath, corruptSource, "utf8");
    const recoveredPayload = run(process.execPath, ["scripts/theme-cli.mjs", "init", "--config", corruptPath, "--payload"]);
    new Function(recoveredPayload);
    assert.equal(JSON.parse(await fs.readFile(corruptPath, "utf8")).theme, "default");
    const corruptBackups = (await fs.readdir(temporary)).filter((name) => name.startsWith("corrupt-config.json.corrupt-"));
    assert.equal(corruptBackups.length, 1, "Corrupt configuration was not preserved exactly once");
    assert.equal(await fs.readFile(path.join(temporary, corruptBackups[0]), "utf8"), corruptSource);

    const nonObjectPath = path.join(temporary, "non-object-config.json");
    await fs.writeFile(nonObjectPath, "[]\n", "utf8");
    run(process.execPath, ["scripts/theme-cli.mjs", "init", "--config", nonObjectPath]);
    assert.equal(JSON.parse(await fs.readFile(nonObjectPath, "utf8")).theme, "default");
    const nonObjectBackups = (await fs.readdir(temporary)).filter((name) => name.startsWith("non-object-config.json.corrupt-"));
    assert.equal(nonObjectBackups.length, 1, "Non-object configuration was not preserved exactly once");
    assert.equal(await fs.readFile(path.join(temporary, nonObjectBackups[0]), "utf8"), "[]\n");

    for (const transientCode of ["EACCES", "EBUSY", "EEXIST", "EPERM", "UNKNOWN"]) {
      const transientPath = path.join(temporary, `transient-${transientCode.toLowerCase()}.json`);
      await fs.writeFile(transientPath, `${JSON.stringify({ ...DEFAULT_CONFIG, theme: "study-library" }, null, 2)}\n`, "utf8");
      let transientAttempts = 0;
      await writeConfig(transientPath, { ...DEFAULT_CONFIG, theme: "korean-idol" }, {
        fileOperations: {
          rename: async (...args) => {
            transientAttempts += 1;
            if (transientAttempts === 1) {
              const error = new Error(`injected ${transientCode} config publication race`);
              error.code = transientCode;
              throw error;
            }
            return fs.rename(...args);
          },
          rm: (...args) => fs.rm(...args),
          wait: async () => {},
        },
      });
      assert.ok(
        transientAttempts >= 2 && transientAttempts <= 6,
        `${transientCode} config publication escaped the bounded retry window`,
      );
      assert.equal(JSON.parse(await fs.readFile(transientPath, "utf8")).theme, "korean-idol",
        `${transientCode} config publication did not eventually replace the live config`);
    }

    const failClosedPath = path.join(temporary, "fail-closed-config.json");
    const failClosedOriginal = `${JSON.stringify({ ...DEFAULT_CONFIG, theme: "study-library" }, null, 2)}\n`;
    await fs.writeFile(failClosedPath, failClosedOriginal, "utf8");
    let renameAttempts = 0;
    const lockedFileOperations = {
      rename: async () => {
        renameAttempts += 1;
        const error = new Error("injected locked config destination");
        error.code = "EPERM";
        throw error;
      },
      rm: (...args) => fs.rm(...args),
      wait: async () => {},
    };
    await assert.rejects(
      writeConfig(failClosedPath, { ...DEFAULT_CONFIG, theme: "korean-idol" }, {
        fileOperations: lockedFileOperations,
      }),
      /injected locked config destination/,
      "A permanently locked config destination did not fail closed",
    );
    assert.equal(renameAttempts, 6, "Config publication did not make the bounded retry count");
    assert.equal(await fs.readFile(failClosedPath, "utf8"), failClosedOriginal,
      "Failed config publication removed or changed the live config");
    assert.deepEqual(
      (await fs.readdir(temporary)).filter((name) => name.startsWith("fail-closed-config.json.tmp-")),
      [],
      "Failed config publication left a temporary file",
    );
  } finally {
    await fs.rm(temporary, { recursive: true, force: true });
  }
});

test("enabled state, local images, and remote CSS safety are validated", async () => {
  const themeCoreDirectory = path.join(PROJECT_ROOT, "scripts", "theme-core");
  const themeCoreFiles = [
    path.join(PROJECT_ROOT, "scripts", "theme-core.mjs"),
    ...(await fs.readdir(themeCoreDirectory))
      .filter((file) => file.endsWith(".mjs"))
      .sort()
      .map((file) => path.join(themeCoreDirectory, file)),
  ];
  const themeCoreSource = (await Promise.all(themeCoreFiles.map((file) => fs.readFile(file, "utf8")))).join("\n");
  assert.match(themeCoreSource, /if \(bytes\.length > MAX_IMAGE_BYTES\)/);
  assert.match(themeCoreSource, /if \(bytes\.length > MAX_ARTWORK_BYTES\)/);
  await assert.rejects(
    compileTheme({ configPath: path.join(PROJECT_ROOT, "config.example.json"), config: { ...DEFAULT_CONFIG, enabled: "yes" } }),
    /enabled must be true or false/,
  );
  await assert.rejects(
    compileTheme({ config: { ...DEFAULT_CONFIG, imageZoom: 2.01 } }),
    /imageZoom must be between 1 and 2/,
  );
  await assert.rejects(
    compileTheme({ config: { ...DEFAULT_CONFIG, imageZoom: "1.2" } }),
    /imageZoom must be a number/,
  );
  await assert.rejects(
    compileTheme({ config: {
      ...DEFAULT_CONFIG,
      studioPreviewCrops: { "japanese-idol": { x: null, y: 50, zoom: 1 } },
    } }),
    /values must be numbers/,
  );
  await assert.rejects(
    compileTheme({ config: {
      ...DEFAULT_CONFIG,
      studioPreviewCrops: { "japanese-idol": { x: 50, y: 50, zoom: 1, path: "C:\\private.png" } },
    } }),
    /must contain only x, y, and zoom/,
  );
  const temporary = await fs.mkdtemp(path.join(PROJECT_ROOT, "tests", ".tmp-"));
  try {
    const configPath = path.join(temporary, "config.json");
    await writeConfig(configPath, { ...DEFAULT_CONFIG, image: path.join(temporary, "missing.png") });
    const missingImage = await compileTheme({ configPath });
    assert.equal(missingImage.settings.imageDataUrl, null);
    assert.equal(missingImage.settings.imageUnavailable, true);

    const imagePath = path.join(temporary, "pixel.png");
    const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64");
    await fs.writeFile(imagePath, png);
    await writeConfig(configPath, {
      ...DEFAULT_CONFIG,
      image: imagePath,
      imageOpacity: 0.22,
      imagePosition: "12.5% 87.5%",
      imageZoom: 1.4,
    });
    const bundle = await compileTheme({ configPath });
    assert.equal(bundle.image.bytes, png.length);
    assert(bundle.settings.imageDataUrl.startsWith("data:image/png;base64,"));
    assert.equal(bundle.settings.imageAnimated, false);
    assert.equal(bundle.settings.imageOpacity, 0.22);
    assert.equal(bundle.settings.imagePosition, "12.5% 87.5%");
    assert.equal(bundle.settings.imageZoom, 1.4);

    const gifPath = path.join(temporary, "motion.gif");
    await fs.writeFile(gifPath, Buffer.from("GIF89a", "ascii"));
    await writeConfig(configPath, { ...DEFAULT_CONFIG, image: gifPath, reduceMotion: true });
    const animated = await buildPayload({ configPath });
    assert.equal(animated.settings.imageAnimated, true);
    assert.match(animated.payload, /claude-aura-animated-image/);
    assert.match(animated.css, /prefers-reduced-motion[\s\S]*claude-aura-animated-image/);

    const renamedGifPath = path.join(temporary, "renamed.png");
    await fs.writeFile(renamedGifPath, Buffer.from("GIF87a", "ascii"));
    await writeConfig(configPath, { ...DEFAULT_CONFIG, image: renamedGifPath, reduceMotion: true });
    await assert.rejects(compileTheme({ configPath }), /extension does not match its content/);

    const animatedFixtures = [
      ["motion.png", Buffer.concat([
        Buffer.from("89504e470d0a1a0a", "hex"),
        Buffer.from("000000086163544c000000010000000000000000", "hex"),
      ])],
      ["motion.webp", Buffer.concat([
        Buffer.from("RIFF", "ascii"),
        Buffer.from([4, 0, 0, 0]),
        Buffer.from("WEBPANIM", "ascii"),
        Buffer.alloc(4),
      ])],
      ["motion.avif", Buffer.concat([
        Buffer.from("000000186674797061766973000000006176696661766973", "hex"),
      ])],
    ];
    for (const [name, bytes] of animatedFixtures) {
      const fixturePath = path.join(temporary, name);
      await fs.writeFile(fixturePath, bytes);
      await writeConfig(configPath, { ...DEFAULT_CONFIG, image: fixturePath, reduceMotion: true });
      assert.equal((await compileTheme({ configPath })).settings.imageAnimated, true, `${name} animation was not detected`);
    }

    const theme = (await listThemes())[0];
    assert.throws(() => validateTheme({ ...theme, customCss: '@import url("https://example.com/theme.css");' }), /remote resources/);
    assert.throws(() => validateTheme({ ...theme, customCss: "body{background-image:url(//example.com/track.png)}" }), /remote resources/);
    assert.throws(() => validateTheme({ ...theme, customCss: String.raw`body{background-image:u\72l(//example.com/track.png)}` }), /remote resources/);
    assert.throws(() => validateTheme({ ...theme, customCss: String.raw`body{background-image:u\rl(//example.com/track.png)}` }), /remote resources/);
    assert.throws(() => validateTheme({ ...theme, customCss: String.raw`@im\port "//example.com/theme.css";` }), /remote resources/);
    assert.throws(() => validateTheme({ ...theme, customCss: 'body{background-image:image-set("https://example.com/track.png" 1x)}' }), /remote resources/);
    assert.throws(() => validateTheme({
      ...theme,
      light: { ...theme.light, wallpaper: { ...theme.light.wallpaper, gradient: "url(https://example.com/track.png)" } },
    }), /remote resources/);
  } finally {
    await fs.rm(temporary, { recursive: true, force: true });
  }
});

runIfMain(import.meta.url);
