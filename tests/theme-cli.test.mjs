// theme-cli tests. Extracted from the former monolithic tests/run-tests.mjs.
import { test, runIfMain } from "./support/harness.mjs";
import { validateRegistryEntry, validateStudioLayer } from "../scripts/theme-core/validation.mjs";
import { createBuiltinAuthoringTestHarness } from "../scripts/theme-core/studio.mjs";
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

test("built-in registry layers accept exact Studio frames without weakening kit isolation", async () => {
  const registryDocument = JSON.parse(await fs.readFile(
    path.join(PROJECT_ROOT, "themes", "registry.json"),
    "utf8",
  ));
  const baseEntry = structuredClone(
    registryDocument.themes.find((entry) => entry.id === "anime-twilight"),
  );
  const framedLayer = {
    id: `layer-${"0".repeat(32)}`,
    path: "assets/theme-art/anime-twilight/background.webp",
    role: "corner",
    appearance: "dark",
    context: "other",
    viewport: "wide",
    visible: false,
    opacity: 0.73,
    mask: "soft-right",
    mobile: "hide",
    frames: {
      normal: {
        anchor: "top-left",
        positionX: -12.5,
        positionY: 8.25,
        focalX: 22.5,
        focalY: 61.75,
        scale: 0.8,
      },
      wide: {
        anchor: "bottom-right",
        positionX: 14.75,
        positionY: -6.5,
        focalX: 77.5,
        focalY: 42.25,
        scale: 1.35,
      },
    },
  };
  const legacyLayer = {
    path: "assets/theme-art/anime-twilight/background.webp",
    position: "center",
    size: "cover",
    mobile: "keep",
    opacity: 0.62,
    mask: "none",
    role: "background",
    appearance: "light",
    contextOverrides: { conversation: { hidden: true } },
  };
  const normalized = validateRegistryEntry({
    ...baseEntry,
    artwork: null,
    artworkLayers: [framedLayer, legacyLayer],
  }, "framed-builtin");
  assert.deepEqual(normalized.artworkLayers[0], framedLayer,
    "Built-in frame validation did not preserve the exact stable layer document");
  assert.deepEqual(normalized.artworkLayers[1], legacyLayer,
    "Adding framed layers changed the normalized legacy layer contract");
  assert.throws(() => validateStudioLayer({
    ...framedLayer,
    path: `artwork/layer-${"1".repeat(32)}.webp`,
  }, "ordinary-user-layer"), /context has an unsupported value/,
  "The internal built-in context capability broadened the ordinary Studio kit schema");

  const invalidFramedLayers = [
    [{ ...framedLayer, position: "center" }, /unsupported property shape/],
    [{ ...framedLayer, note: "layout draft" }, /unsupported property shape/],
    [{ ...framedLayer, id: "layer-not-hex" }, /32 lowercase hexadecimal/],
    [{
      ...framedLayer,
      frames: { normal: framedLayer.frames.normal },
    }, /frames.*unsupported property shape/],
    [{
      ...framedLayer,
      frames: {
        ...framedLayer.frames,
        wide: { ...framedLayer.frames.wide, scale: 3.01 },
      },
    }, /scale must be a number between 0\.25 and 3/],
  ];
  for (const [layer, expected] of invalidFramedLayers) {
    assert.throws(() => validateRegistryEntry({
      ...baseEntry,
      artwork: null,
      artworkLayers: [layer],
    }, "invalid-framed-builtin"), expected);
  }
  assert.throws(() => validateRegistryEntry({
    ...baseEntry,
    artwork: null,
    artworkLayers: [framedLayer, structuredClone(framedLayer)],
  }, "duplicate-framed-builtin"), /artworkLayers ids must be unique/);

  const userEntry = {
    ...baseEntry,
    file: undefined,
    studioPreview: null,
    studioPreviewFrame: null,
    artwork: null,
    artworkLayers: [{
      path: framedLayer.path,
      role: "background",
    }],
  };
  assert.throws(
    () => validateRegistryEntry(userEntry, "isolated-user-kit", { source: "user" }),
    /not a supported theme-kit slot path/,
    "A standalone user kit was allowed to resolve a project artwork path",
  );
  assert.throws(() => validateRegistryEntry({
    ...baseEntry,
    artwork: null,
    artworkLayers: [{ ...legacyLayer, extra: true }],
  }, "legacy-extra"), /unsupported property shape/);
});

test("built-in source publication keeps crash remnants inside .git", async () => {
  const studioCore = await fs.readFile(
    path.join(PROJECT_ROOT, "scripts", "theme-core", "studio.mjs"),
    "utf8",
  );
  const builder = await fs.readFile(
    path.join(PROJECT_ROOT, "scripts", "build-studio-themes.mjs"),
    "utf8",
  );
  const sourcePublisher = studioCore.slice(
    studioCore.indexOf("async function atomicWriteBuiltinSourceText"),
    studioCore.indexOf("function validateBuiltinLockOwner"),
  );
  const generatedPublisher = builder.slice(
    builder.indexOf("async function sourcePublicationTempRoot"),
    builder.indexOf("function studioMode"),
  );
  assert.match(sourcePublisher,
    /path\.join\(\s*authority\.gitPath,\s*`\.claude-aura-source-/,
    "Registry publication did not stage below the authorized .git directory");
  assert.match(sourcePublisher, /renameStudioPath\(temporary, target\)/,
    "Registry publication lost its single atomic rename point");
  assert(!sourcePublisher.includes("`${target}.tmp"),
    "Registry publication can still orphan a temporary beside a deliverable");
  assert.match(generatedPublisher,
    /path\.join\(PROJECT_ROOT,\s*["']\.git["']\)[\s\S]*?path\.join\(\s*temporaryRoot,\s*`\.claude-aura-generated-/,
    "Generated Studio metadata did not stage below the real .git directory");
  assert(!generatedPublisher.includes("`${filePath}.tmp"),
    "Generated Studio metadata can still orphan a temporary beside a deliverable");
  assert.match(studioCore,
    /atomicWriteBuiltinSourceText\(authority, authority\.registryPath, nextRegistryText\)/,
    "Forward registry publication bypassed the .git-contained writer");
  assert.match(studioCore,
    /restoreStudioFileIfOwned\(\s*authority,\s*authority\.registryPath,[\s\S]*?restoreStudioFileIfOwned\(\s*authority,\s*generatedPath,/,
    "Registry or generated-metadata rollback bypassed the .git-contained writer");
});

test("guarded built-in layout authoring saves only source layout fields", async () => {
  const temporary = await fs.mkdtemp(path.join(PROJECT_ROOT, "tests", ".tmp-builtin-author-"));
  const sourceRoot = path.join(temporary, "source");
  const editorRoot = path.join(temporary, "editor");
  const userThemesDir = path.join(temporary, "user-themes");
  const configPath = path.join(temporary, "config.json");
  const themeId = "anime-twilight";
  try {
    await Promise.all([
      fs.mkdir(path.join(sourceRoot, ".git"), { recursive: true }),
      fs.mkdir(path.join(sourceRoot, "themes"), { recursive: true }),
      fs.mkdir(path.join(sourceRoot, "assets", "theme-art"), { recursive: true }),
      fs.mkdir(path.join(sourceRoot, "studio"), { recursive: true }),
      fs.mkdir(userThemesDir, { recursive: true }),
    ]);
    await Promise.all([
      fs.copyFile(
        path.join(PROJECT_ROOT, "themes", "registry.json"),
        path.join(sourceRoot, "themes", "registry.json"),
      ),
      fs.copyFile(
        path.join(PROJECT_ROOT, "themes", `${themeId}.json`),
        path.join(sourceRoot, "themes", `${themeId}.json`),
      ),
      fs.cp(
        path.join(PROJECT_ROOT, "assets", "theme-art", themeId),
        path.join(sourceRoot, "assets", "theme-art", themeId),
        { recursive: true },
      ),
    ]);
    await writeConfig(configPath, { ...DEFAULT_CONFIG });
    const generatedPath = path.join(sourceRoot, "studio", "generated-themes.js");
    await fs.writeFile(generatedPath, "test-generated:initial\n", "utf8");
    const configBefore = await fs.readFile(configPath, "utf8");
    const registryPath = path.join(sourceRoot, "themes", "registry.json");
    const registryBefore = await fs.readFile(registryPath, "utf8");
    const registryDocumentBefore = JSON.parse(registryBefore);
    const request = (message, options = {}) => executeStudioRequest({
      request: message,
      configPath,
      userThemesDir,
      editorRoot,
      locale: "en",
      ...options,
    });
    let regenerationCount = 0;
    const regenerateStudioThemes = async (authority) => {
      regenerationCount += 1;
      const registryBytes = await fs.readFile(authority.registryPath);
      const output = `test-generated:${crypto.createHash("sha256").update(registryBytes).digest("hex")}\n`;
      const temporaryOutput = path.join(
        authority.gitPath,
        `.test-generated-${crypto.randomBytes(4).toString("hex")}.tmp`,
      );
      await fs.writeFile(temporaryOutput, output, "utf8");
      await fs.rename(temporaryOutput, generatedPath);
      return {
        outputPath: generatedPath,
        sha256: crypto.createHash("sha256").update(output).digest("hex"),
      };
    };
    const authoringHarness = createBuiltinAuthoringTestHarness(
      sourceRoot,
      { regenerateStudioThemes, generatedPath },
    );
    const authorized = (message, options = {}) => authoringHarness.execute({
      request: message,
      configPath,
      userThemesDir,
      editorRoot,
      locale: "en",
      builtinAuthoringRoot: sourceRoot,
      ...options,
    });

    await assert.rejects(
      () => request({ type: "begin-theme-edit", theme: themeId, reset: false }),
      /Built-in themes must be duplicated|not authorized/,
      "Ordinary Studio unexpectedly opened a frozen built-in directly",
    );
    await assert.rejects(
      () => request(
        { type: "begin-theme-edit", theme: themeId, reset: false },
        {
          builtinAuthoringRoot: sourceRoot,
          __testBuiltinAuthoringExpectedRoot: sourceRoot,
        },
      ),
      /canonical source checkout/,
      "A non-canonical source root gained built-in authoring authority",
    );
    let result = await authorized({
      type: "begin-theme-edit",
      theme: themeId,
      reset: false,
    });
    assert.equal(result.state.editKind, "builtin-layout");
    assert.equal(result.state.source, "builtin");
    assert.equal(result.state.id, themeId);
    assert(!Object.hasOwn(result.state, "registrySha256"));
    assert(!JSON.stringify(result.state).includes(sourceRoot),
      "Public Studio state disclosed the authoring source path");
    const statePath = path.join(editorRoot, "active", ".editor-state.json");
    const themePath = path.join(editorRoot, "active", "theme.json");
    const privateState = JSON.parse(await fs.readFile(statePath, "utf8"));
    const privateTheme = JSON.parse(await fs.readFile(themePath, "utf8"));
    assert.match(privateState.registrySha256, /^[a-f0-9]{64}$/);
    assert.equal(privateState.editKind, "builtin-layout");
    assert.match(privateTheme.artworkLayers[0].id, /^layer-[a-f0-9]{32}$/);
    await assert.rejects(() => authorized({
      type: "begin-theme-edit",
      theme: themeId,
      reset: false,
      builtinAuthoringRoot: sourceRoot,
    }), /must contain only reset, theme, type/,
    "A page request was allowed to supply the authoring path");

    const stateBeforeUnauthorizedHydration = await fs.readFile(statePath, "utf8");
    const paused = await hydrateStudioDraft({
      configPath,
      userThemesDir,
      editorRoot,
      locale: "en",
    });
    assert.deepEqual(paused, {
      state: { active: false },
      payload: null,
      themesChanged: false,
      configChanged: false,
      apply: "none",
    });
    assert.equal(await fs.readFile(statePath, "utf8"), stateBeforeUnauthorizedHydration,
      "Unauthorized hydration modified the preserved built-in draft");

    const forbiddenState = await fs.readFile(statePath, "utf8");
    await assert.rejects(() => authorized({
      type: "set-theme-token",
      session: result.state.session,
      revision: result.state.revision,
      mode: "light",
      token: "canvas",
      value: "#112233",
    }), /complete layout/);
    await assert.rejects(() => authorized({
      type: "apply-theme-patch",
      session: result.state.session,
      revision: result.state.revision,
      changes: [{
        kind: "metadata",
        field: "label",
        locale: "en",
        value: "Forged built-in label",
      }],
    }), /non-layout change/);
    assert.equal(await fs.readFile(statePath, "utf8"), forbiddenState,
      "A forbidden built-in mutation changed private editor state");

    const greetingFrame = {
      ...result.state.shared.greeting.frames.light.standard,
      xRatio: -0.02,
    };
    result = await authorized({
      type: "apply-theme-patch",
      session: result.state.session,
      revision: result.state.revision,
      changes: [
        { kind: "token", mode: "shared", token: "promptWidth", value: 0.69 },
        { kind: "token", mode: "shared", token: "promptX", value: 0.02 },
        { kind: "token", mode: "shared", token: "promptY", value: -0.01 },
        {
          kind: "greeting",
          operation: "set-frame",
          appearance: "light",
          frame: "standard",
          value: greetingFrame,
        },
        {
          kind: "layer",
          index: 0,
          preset: "wide",
          property: "positionX",
          value: 3.5,
        },
      ],
    });
    assert.equal(result.state.actionSucceeded, true);
    assert.equal(result.state.shared.prompt.width, 0.69);
    const editedTheme = JSON.parse(await fs.readFile(themePath, "utf8"));
    assert.equal(editedTheme.artworkLayers[0].legacy, undefined,
      "First frame edit did not adopt the legacy built-in layer");
    assert.equal(editedTheme.artworkLayers[0].frames.wide.positionX, 3.5);
    assert.equal(editedTheme.newChatGreetingStyle.light.standard.xRatio, greetingFrame.xRatio);

    const stateBeforeConflict = await fs.readFile(statePath, "utf8");
    const lockPath = path.join(
      sourceRoot,
      ".git",
      "claude-aura-builtin-authoring.lock",
    );
    const orphanedLockCandidate = `${lockPath}.candidate-${process.pid}-${"f".repeat(32)}`;
    await fs.writeFile(orphanedLockCandidate, "{", "utf8");
    await assert.rejects(() => authorized({
      type: "save-theme-edit",
      session: result.state.session,
      revision: result.state.revision,
    }, {
      faultInjector: async (stage) => {
        if (stage === "before-builtin-registry") {
          throw new Error("forced failure after crash-safe lock publication");
        }
      },
    }), /forced failure after crash-safe lock publication/,
    "An orphaned unpublished lock candidate permanently blocked authoring");
    assert.equal(await fs.readFile(orphanedLockCandidate, "utf8"), "{",
      "Lock acquisition treated another process's unpublished candidate as a live owner");
    await fs.rm(orphanedLockCandidate);

    const liveOwnerText = `${JSON.stringify({
      schemaVersion: 1,
      pid: process.pid,
      token: `${process.pid}-${"e".repeat(32)}`,
      createdAt: new Date().toISOString(),
    })}\n`;
    await fs.writeFile(lockPath, liveOwnerText, { encoding: "utf8", flag: "wx" });
    await assert.rejects(() => authorized({
      type: "save-theme-edit",
      session: result.state.session,
      revision: result.state.revision,
    }), /Another built-in layout save is already in progress/,
    "A valid live lock owner was not respected");
    assert.equal(await fs.readFile(lockPath, "utf8"), liveOwnerText,
      "Lock contention deleted or rewrote a valid live owner");
    await fs.rm(lockPath);
    assert.equal(await fs.readFile(statePath, "utf8"), stateBeforeConflict,
      "Lock crash/contender checks changed the private draft");

    const markerPath = path.join(
      sourceRoot,
      ".git",
      "claude-aura-builtin-authoring-transaction.json",
    );
    const registryBeforeSha256 = crypto.createHash("sha256").update(registryBefore).digest("hex");
    await fs.writeFile(markerPath, `${JSON.stringify({
      schemaVersion: 1,
      transactionId: crypto.randomBytes(16).toString("hex"),
      registryBeforeSha256,
      intendedRegistrySha256: registryBeforeSha256,
      createdAt: new Date().toISOString(),
    }, null, 2)}\n`, "utf8");
    await fs.writeFile(generatedPath, "test-generated:interrupted\n", "utf8");
    const recoveryCountBefore = regenerationCount;
    const recoveredHydration = await authoringHarness.hydrate({
      configPath,
      userThemesDir,
      editorRoot,
      locale: "en",
      builtinAuthoringRoot: sourceRoot,
    });
    assert.equal(recoveredHydration.state.editKind, "builtin-layout");
    assert.equal(regenerationCount, recoveryCountBefore + 1,
      "Authorization did not rebuild generated metadata for an interrupted transaction");
    assert.equal(await fs.readFile(markerPath, "utf8").then(() => true, (error) => {
      if (error.code === "ENOENT") return false;
      throw error;
    }), false, "Interrupted transaction marker was not cleared after recovery");
    assert.match(await fs.readFile(generatedPath, "utf8"), new RegExp(registryBeforeSha256),
      "Interrupted transaction recovery did not rebuild from the current registry");

    const sourceThemePath = path.join(sourceRoot, "themes", `${themeId}.json`);
    const sourceThemeBefore = await fs.readFile(sourceThemePath, "utf8");
    await fs.writeFile(sourceThemePath, `${sourceThemeBefore}\n`, "utf8");
    await assert.rejects(() => authorized({
      type: "save-theme-edit",
      session: result.state.session,
      revision: result.state.revision,
    }), /source or artwork changed.*draft was preserved/i);
    await fs.writeFile(sourceThemePath, sourceThemeBefore, "utf8");
    assert.equal(await fs.readFile(statePath, "utf8"), stateBeforeConflict,
      "Theme-source conflict changed the private draft");

    const sourceArtworkPath = path.join(
      sourceRoot,
      registryDocumentBefore.themes.find((entry) => entry.id === themeId).artworkLayers[0].path,
    );
    const sourceArtworkBefore = await fs.readFile(sourceArtworkPath);
    await fs.writeFile(sourceArtworkPath, Buffer.concat([sourceArtworkBefore, Buffer.from([0])]));
    await assert.rejects(() => authorized({
      type: "save-theme-edit",
      session: result.state.session,
      revision: result.state.revision,
    }), /source or artwork changed.*draft was preserved/i);
    await fs.writeFile(sourceArtworkPath, sourceArtworkBefore);
    assert.equal(await fs.readFile(statePath, "utf8"), stateBeforeConflict,
      "Artwork-source conflict changed the private draft");

    await fs.writeFile(registryPath, `${registryBefore}\n`, "utf8");
    await assert.rejects(() => authorized({
      type: "save-theme-edit",
      session: result.state.session,
      revision: result.state.revision,
    }), /registry changed.*draft was preserved/i);
    assert.equal(await fs.readFile(statePath, "utf8"), stateBeforeConflict,
      "Registry conflict discarded or rewrote the active draft");
    await fs.writeFile(registryPath, registryBefore, "utf8");

    const externalRegistryText = `${registryBefore}\n`;
    await assert.rejects(() => authorized({
      type: "save-theme-edit",
      session: result.state.session,
      revision: result.state.revision,
    }, {
      faultInjector: async (stage) => {
        if (stage === "before-builtin-registry") {
          await fs.writeFile(registryPath, externalRegistryText, "utf8");
        }
      },
    }), (error) => error?.code === "STUDIO_ROLLBACK_INCOMPLETE"
      && /concurrent pre-publication edit was preserved/.test(
        error.errors?.map((item) => item.message).join("\n") ?? "",
      ));
    assert.equal(await fs.readFile(registryPath, "utf8"), externalRegistryText,
      "The pre-publication conflict was overwritten");
    await fs.writeFile(registryPath, registryBefore, "utf8");
    await authoringHarness.hydrate({
      configPath,
      userThemesDir,
      editorRoot,
      locale: "en",
      builtinAuthoringRoot: sourceRoot,
    });

    await assert.rejects(() => authorized({
      type: "save-theme-edit",
      session: result.state.session,
      revision: result.state.revision,
    }, {
      faultInjector: async (stage) => {
        if (stage === "after-builtin-registry") throw new Error("forced built-in publication failure");
      },
    }), /forced built-in publication failure/);
    assert.equal(await fs.readFile(registryPath, "utf8"), registryBefore,
      "Failed built-in publication did not roll the registry back byte-for-byte");
    assert.equal(await fs.readFile(statePath, "utf8"), stateBeforeConflict,
      "Failed built-in publication did not preserve the private draft");

    await assert.rejects(() => authorized({
      type: "save-theme-edit",
      session: result.state.session,
      revision: result.state.revision,
    }, {
      faultInjector: async (stage) => {
        if (stage === "after-builtin-registry") {
          await fs.writeFile(registryPath, externalRegistryText, "utf8");
          throw new Error("forced conflict after built-in publication");
        }
      },
    }), (error) => error?.code === "STUDIO_ROLLBACK_INCOMPLETE"
      && /later external edit was preserved/.test(
        error.errors?.map((item) => item.message).join("\n") ?? "",
      ));
    assert.equal(await fs.readFile(registryPath, "utf8"), externalRegistryText,
      "Conditional rollback clobbered a later registry edit");
    await fs.writeFile(registryPath, registryBefore, "utf8");
    await authoringHarness.hydrate({
      configPath,
      userThemesDir,
      editorRoot,
      locale: "en",
      builtinAuthoringRoot: sourceRoot,
    });

    await assert.rejects(() => authorized({
      type: "save-theme-edit",
      session: result.state.session,
      revision: result.state.revision,
    }, {
      faultInjector: async (stage) => {
        if (stage === "after-builtin-studio-metadata") {
          await fs.writeFile(registryPath, externalRegistryText, "utf8");
        }
      },
    }), (error) => error?.code === "STUDIO_ROLLBACK_INCOMPLETE"
      && /registry changed after publication/.test(
        error.errors?.map((item) => item.message).join("\n") ?? "",
      )
      && /later external edit was preserved/.test(
        error.errors?.map((item) => item.message).join("\n") ?? "",
      ));
    assert.equal(await fs.readFile(registryPath, "utf8"), externalRegistryText,
      "The final success check clobbered a post-metadata registry edit");
    await fs.writeFile(registryPath, registryBefore, "utf8");
    await authoringHarness.hydrate({
      configPath,
      userThemesDir,
      editorRoot,
      locale: "en",
      builtinAuthoringRoot: sourceRoot,
    });

    const externalGeneratedText = "test-generated:later-external-edit\n";
    await assert.rejects(() => authorized({
      type: "save-theme-edit",
      session: result.state.session,
      revision: result.state.revision,
    }, {
      faultInjector: async (stage) => {
        if (stage === "after-builtin-studio-metadata") {
          await fs.writeFile(generatedPath, externalGeneratedText, "utf8");
        }
      },
    }), (error) => error?.code === "STUDIO_ROLLBACK_INCOMPLETE"
      && /generated metadata changed after publication/.test(
        error.errors?.map((item) => item.message).join("\n") ?? "",
      )
      && /later external edit was preserved/.test(
        error.errors?.map((item) => item.message).join("\n") ?? "",
      ));
    assert.equal(await fs.readFile(registryPath, "utf8"), registryBefore,
      "Generated-metadata conflict did not roll the owned registry back");
    assert.equal(await fs.readFile(generatedPath, "utf8"), externalGeneratedText,
      "Conditional rollback clobbered a later generated-metadata edit");
    await authoringHarness.hydrate({
      configPath,
      userThemesDir,
      editorRoot,
      locale: "en",
      builtinAuthoringRoot: sourceRoot,
    });

    result = await authorized({
      type: "save-theme-edit",
      session: result.state.session,
      revision: result.state.revision,
    });
    assert.equal(result.state.editKind, "builtin-layout");
    assert.equal(result.state.dirty, false);
    assert.equal(result.themesChanged, true);
    assert.equal(result.configChanged, false);
    assert.equal(result.apply, "saved");
    new Function(result.payload);
    assert.equal(await fs.readFile(configPath, "utf8"), configBefore,
      "Built-in layout save changed the user config");
    assert.deepEqual(await fs.readdir(userThemesDir), [],
      "Built-in layout save wrote a user theme");
    for (const deliverableDirectory of ["themes", "studio"]) {
      const names = await fs.readdir(path.join(sourceRoot, deliverableDirectory));
      assert(!names.some((name) => /\.tmp-|^\.claude-aura-/u.test(name)),
        `Built-in publication left a crash-sensitive temporary in ${deliverableDirectory}`);
    }

    const registryAfter = JSON.parse(await fs.readFile(registryPath, "utf8"));
    assert.deepEqual(registryAfter.legacyAliases, registryDocumentBefore.legacyAliases);
    assert.deepEqual(
      registryAfter.themes.map((entry) => entry.id),
      registryDocumentBefore.themes.map((entry) => entry.id),
      "Built-in layout save changed registry theme order or identity",
    );
    for (let index = 0; index < registryAfter.themes.length; index += 1) {
      if (registryAfter.themes[index].id === themeId) continue;
      assert.deepEqual(registryAfter.themes[index], registryDocumentBefore.themes[index],
        `Built-in layout save changed unrelated registry theme ${registryAfter.themes[index].id}`);
    }
    const savedEntry = registryAfter.themes.find((entry) => entry.id === themeId);
    const originalEntry = registryDocumentBefore.themes.find((entry) => entry.id === themeId);
    assert.deepEqual(savedEntry.newChatLayout, {
      widthRatio: 0.69,
      offsetXRatio: 0.02,
      offsetYRatio: -0.01,
    });
    assert.equal(savedEntry.newChatGreetingStyle.light.standard.xRatio, greetingFrame.xRatio);
    assert.equal(savedEntry.artworkLayers[0].path, originalEntry.artworkLayers[0].path);
    assert.match(savedEntry.artworkLayers[0].id, /^layer-[a-f0-9]{32}$/);
    assert.deepEqual(Object.keys(savedEntry.artworkLayers[0]), [
      "id", "path", "role", "appearance", "context", "viewport", "visible",
      "opacity", "mask", "mobile", "frames",
    ]);
    const authorizedHydration = await authoringHarness.hydrate({
      configPath,
      userThemesDir,
      editorRoot,
      locale: "en",
      builtinAuthoringRoot: sourceRoot,
    });
    assert.equal(authorizedHydration.state.editKind, "builtin-layout");
    assert.equal(authorizedHydration.apply, "draft");

    await authorized({
      type: "discard-theme-edit",
      session: result.state.session,
      revision: result.state.revision,
    });
    const preservedFramedId = `layer-${"a".repeat(32)}`;
    const framedRegistry = JSON.parse(await fs.readFile(registryPath, "utf8"));
    const framedEntry = framedRegistry.themes.find((entry) => entry.id === themeId);
    framedEntry.artworkLayers[0].id = preservedFramedId;
    framedEntry.artworkLayers[0].context = "other";
    await fs.writeFile(registryPath, `${JSON.stringify(framedRegistry, null, 2)}\n`, "utf8");
    result = await authorized({
      type: "begin-theme-edit",
      theme: themeId,
      reset: false,
    });
    assert.equal(result.state.layers[0].id, preservedFramedId);
    assert.equal(result.state.layers[0].context, "other");
    result = await authorized({
      type: "save-theme-edit",
      session: result.state.session,
      revision: result.state.revision,
    });
    const preservedRegistry = JSON.parse(await fs.readFile(registryPath, "utf8"));
    const preservedLayer = preservedRegistry.themes
      .find((entry) => entry.id === themeId).artworkLayers[0];
    assert.equal(preservedLayer.id, preservedFramedId,
      "Saving rewrote an existing stable framed layer id");
    assert.equal(preservedLayer.context, "other",
      "Saving changed the built-in-only other-page context");

    await authorized({
      type: "discard-theme-edit",
      session: result.state.session,
      revision: result.state.revision,
    });
    const singularRegistry = JSON.parse(await fs.readFile(registryPath, "utf8"));
    const singularEntry = singularRegistry.themes.find((entry) => entry.id === themeId);
    singularEntry.artwork = {
      path: originalEntry.artworkLayers[0].path,
      position: originalEntry.artworkLayers[0].position,
      size: originalEntry.artworkLayers[0].size,
      mobile: originalEntry.artworkLayers[0].mobile,
    };
    singularEntry.artworkLayers = null;
    await fs.writeFile(registryPath, `${JSON.stringify(singularRegistry, null, 2)}\n`, "utf8");
    result = await authorized({
      type: "begin-theme-edit",
      theme: themeId,
      reset: false,
    });
    assert.equal(result.state.layers[0].role, "background");
    result = await authorized({
      type: "set-theme-layer",
      session: result.state.session,
      revision: result.state.revision,
      index: 0,
      preset: "normal",
      property: "positionX",
      value: 1.25,
    });
    result = await authorized({
      type: "save-theme-edit",
      session: result.state.session,
      revision: result.state.revision,
    });
    const singularSaved = JSON.parse(await fs.readFile(registryPath, "utf8")).themes
      .find((entry) => entry.id === themeId);
    assert.equal(singularSaved.artwork, null);
    assert.equal(singularSaved.artworkLayers[0].role, "background",
      "Singular built-in artwork adoption used the layered decoration default");
  } finally {
    await fs.rm(temporary, { recursive: true, force: true });
  }
});

test("built-in authoring rejects artwork that escapes through an intermediate link", async () => {
  const temporary = await fs.mkdtemp(path.join(PROJECT_ROOT, "tests", ".tmp-builtin-link-"));
  const sourceRoot = path.join(temporary, "source");
  const outsideRoot = path.join(temporary, "outside-art");
  const editorRoot = path.join(temporary, "editor");
  const userThemesDir = path.join(temporary, "user-themes");
  const configPath = path.join(temporary, "config.json");
  const themeId = "anime-twilight";
  try {
    await Promise.all([
      fs.mkdir(path.join(sourceRoot, ".git"), { recursive: true }),
      fs.mkdir(path.join(sourceRoot, "themes"), { recursive: true }),
      fs.mkdir(path.join(sourceRoot, "assets", "theme-art"), { recursive: true }),
      fs.mkdir(outsideRoot, { recursive: true }),
      fs.mkdir(userThemesDir, { recursive: true }),
    ]);
    await Promise.all([
      fs.copyFile(
        path.join(PROJECT_ROOT, "themes", "registry.json"),
        path.join(sourceRoot, "themes", "registry.json"),
      ),
      fs.copyFile(
        path.join(PROJECT_ROOT, "themes", `${themeId}.json`),
        path.join(sourceRoot, "themes", `${themeId}.json`),
      ),
      fs.copyFile(
        path.join(PROJECT_ROOT, "assets", "theme-art", themeId, "background.webp"),
        path.join(outsideRoot, "background.webp"),
      ),
    ]);
    await fs.symlink(
      outsideRoot,
      path.join(sourceRoot, "assets", "theme-art", themeId),
      process.platform === "win32" ? "junction" : "dir",
    );
    await writeConfig(configPath, { ...DEFAULT_CONFIG });
    const harness = createBuiltinAuthoringTestHarness(sourceRoot);
    await assert.rejects(() => harness.execute({
      request: { type: "begin-theme-edit", theme: themeId, reset: false },
      configPath,
      userThemesDir,
      editorRoot,
      locale: "en",
      builtinAuthoringRoot: sourceRoot,
    }), /escaped its authorized source root/,
    "An intermediate artwork junction escaped the authorized source checkout");
  } finally {
    await fs.rm(temporary, { recursive: true, force: true });
  }
});

test("theme-cli scaffolds a complete starter kit and validates it", async () => {
  const temporary = await fs.mkdtemp(path.join(PROJECT_ROOT, "tests", ".tmp-"));
  const cliPath = path.join(PROJECT_ROOT, "scripts", "theme-cli.mjs");
  const themeId = "cedar-mist";
  try {
    const snippet = JSON.parse(run(process.execPath, [cliPath, "scaffold", themeId], { cwd: temporary }));
    assert.equal(snippet.id, themeId);
    assert.equal(snippet.labels.en, "Cedar Mist");
    assert.equal(snippet.labels["zh-CN"], `自定义主题（${themeId}）`);
    assert.equal(snippet.labels["zh-HKTW"], `自訂主題（${themeId}）`);
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
      labels: { en: "Studio Eight", "zh-CN": "工作室八层主题", "zh-HKTW": "工作室八層主題" },
      descriptions: {
        en: "A Studio-authored schema-v2 compatibility fixture.",
        "zh-CN": "用于验证工作室第二版架构兼容性的主题。",
        "zh-HKTW": "用來驗證工作室第二版架構相容性的主題。",
      },
      swatches: ["#102030", "#405060", "#708090"],
      preview: { chrome: "#102030", background: "#203040", surface: "#304050", accent: "#708090", text: "#F0F4F8" },
      studioPreview: null,
      newChatLayout: { widthRatio: 0.72, offsetXRatio: -0.08, offsetYRatio: 0.12 },
      backgroundScope: "sidebar",
      artworkLayers: studioLayers,
      theme: studioTheme,
    };
    await fs.writeFile(path.join(studioDirectory, "theme.json"), `${JSON.stringify(studioDocument, null, 2)}\n`, "utf8");
    const studioKit = await readThemeKit(studioDirectory);
    assert.equal(studioKit.schemaVersion, STUDIO_THEME_SCHEMA_VERSION);
    assert.equal(studioKit.metadata.backgroundScope, "sidebar");
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
    assert.equal(studioCompiled.settings.backgroundScope, "sidebar");
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
      if (themeId === "korean-idol") {
        assert.equal(
          themeStatus.brandWordmarkAssets.light.sha256,
          "f318ad08013dd500351997d4dfb57706c338ff4d58ce3448d050b4ccccb607ba",
          "Korean Idol Light must keep the approved full-color demo lockup",
        );
        assert.notEqual(
          themeStatus.brandWordmarkAssets.dark.sha256,
          themeStatus.brandWordmarkAssets.light.sha256,
          "Korean Idol Dark must use its clean appearance-specific derivative",
        );
      } else {
        assert.notEqual(
          themeStatus.brandWordmarkAssets.light.sha256,
          themeStatus.brandWordmarkAssets.dark.sha256,
          `${themeId} Light and Dark audit entries must identify distinct assets`,
        );
      }
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
