// WO-26 responsive layout contract: bounded tracks, sparse numeric frames,
// deterministic resolution, and metadata-only insertion.
import assert from "node:assert/strict";
import { test, runIfMain } from "./support/harness.mjs";
import {
  createResponsiveResolver,
  LEGACY_RESPONSIVE_LAYOUTS,
  insertResponsiveLayoutSet,
  resolveResponsiveFrame,
  upgradeStudioDocumentToResponsive,
  validateResponsiveFrames,
  validateResponsiveLayouts,
} from "../scripts/theme-core.mjs";
import {
  DEFAULT_CONFIG,
  executeStudioRequest,
  PROJECT_ROOT,
  fs,
  path,
  readPayloadSettings,
  writeConfig,
} from "./support/context.mjs";

const FRAME_FIELDS = Object.freeze({
  x: Object.freeze({ minimum: -1, maximum: 1, precision: 4 }),
  width: Object.freeze({ minimum: 0.4, maximum: 0.96, precision: 4 }),
});

const fluid = (sets = LEGACY_RESPONSIVE_LAYOUTS.sets) => ({
  mode: "fluid",
  axis: "width",
  sets,
  breakpoints: null,
});

test("responsive layout tracks validate exact bounded schema-v5 metadata", () => {
  assert.deepEqual(validateResponsiveLayouts(LEGACY_RESPONSIVE_LAYOUTS), LEGACY_RESPONSIVE_LAYOUTS);
  assert.throws(() => validateResponsiveLayouts({ ...LEGACY_RESPONSIVE_LAYOUTS, axis: "height" }), /axis must be width/);
  assert.throws(() => validateResponsiveLayouts({ ...LEGACY_RESPONSIVE_LAYOUTS, mode: "spring" }), /mode must be step or fluid/);
  assert.throws(() => validateResponsiveLayouts({ ...LEGACY_RESPONSIVE_LAYOUTS, extra: true }), /unsupported property/);
  assert.throws(() => validateResponsiveLayouts({
    ...LEGACY_RESPONSIVE_LAYOUTS,
    sets: [...LEGACY_RESPONSIVE_LAYOUTS.sets, { id: "laptop", label: "Laptop", width: 1180, height: 768 }],
  }), /strictly increasing unique widths/);
  assert.throws(() => validateResponsiveLayouts({
    ...LEGACY_RESPONSIVE_LAYOUTS,
    sets: [{ id: "tiny", label: "Tiny", width: 919, height: 620 }],
    breakpoints: [],
  }), /between 920 and 3840/);
  assert.throws(() => validateResponsiveLayouts({
    mode: "step", axis: "width", sets: LEGACY_RESPONSIVE_LAYOUTS.sets, breakpoints: [1180],
  }), /between adjacent layout widths/);
  assert.throws(() => validateResponsiveLayouts({
    mode: "step", axis: "width", sets: LEGACY_RESPONSIVE_LAYOUTS.sets, breakpoints: [1180.004],
  }), /between adjacent layout widths/,
  "A breakpoint that rounds onto the lower layout width was accepted");
  assert.throws(() => validateResponsiveLayouts({
    mode: "step", axis: "width", sets: LEGACY_RESPONSIVE_LAYOUTS.sets, breakpoints: [1559.996],
  }), /between adjacent layout widths/,
  "A breakpoint that rounds onto the upper layout width was accepted");
  assert.throws(() => validateResponsiveLayouts({
    mode: "fluid", axis: "width", sets: LEGACY_RESPONSIVE_LAYOUTS.sets, breakpoints: [1440],
  }), /breakpoints must be null/);
});

test("responsive frames reject stale ids, expressions, categorical values, and unsupported fields", () => {
  const layouts = validateResponsiveLayouts(fluid());
  assert.deepEqual(validateResponsiveFrames({
    standard: { x: -0.25 },
    wide: { x: 0.5, width: 0.8 },
  }, layouts, FRAME_FIELDS), {
    standard: { x: -0.25 },
    wide: { x: 0.5, width: 0.8 },
  });
  assert.throws(() => validateResponsiveFrames({ stale: { x: 0 } }, layouts, FRAME_FIELDS), /registered layout set/);
  assert.throws(() => validateResponsiveFrames({ standard: { x: "calc\(1\)" } }, layouts, FRAME_FIELDS), /finite number/);
  assert.throws(() => validateResponsiveFrames({ standard: { anchor: "center" } }, layouts, FRAME_FIELDS), /unsupported property/);
  assert.throws(() => validateResponsiveFrames({ standard: {} }, layouts, FRAME_FIELDS), /must not be empty/);
});

test("fluid resolver agrees at endpoints, midpoints, bounds, and ignores height", () => {
  const layouts = validateResponsiveLayouts(fluid());
  const frames = validateResponsiveFrames({
    standard: { x: -0.25, width: 0.6 },
    wide: { x: 0.5, width: 0.8 },
  }, layouts, FRAME_FIELDS);
  const inherited = { x: 0, width: 0.7 };
  assert.deepEqual(resolveResponsiveFrame(layouts, frames, 500, inherited, FRAME_FIELDS).value, frames.standard);
  assert.deepEqual(resolveResponsiveFrame(layouts, frames, 1180, inherited, FRAME_FIELDS).value, frames.standard);
  assert.deepEqual(resolveResponsiveFrame(layouts, frames, 1370, inherited, FRAME_FIELDS).value, {
    x: 0.125,
    width: 0.7,
  });
  assert.deepEqual(resolveResponsiveFrame(layouts, frames, 1560, inherited, FRAME_FIELDS).value, frames.wide);
  assert.deepEqual(resolveResponsiveFrame(layouts, frames, 5000, inherited, FRAME_FIELDS).value, frames.wide);
  const heightOnly = validateResponsiveLayouts({
    ...layouts,
    sets: layouts.sets.map((set, index) => ({ ...set, height: set.height + (index + 1) * 100 })),
  });
  assert.deepEqual(
    resolveResponsiveFrame(heightOnly, frames, 1370, inherited, FRAME_FIELDS),
    resolveResponsiveFrame(layouts, frames, 1370, inherited, FRAME_FIELDS),
  );

  const sparseLayouts = validateResponsiveLayouts(fluid([
    { id: "standard", label: "Standard", width: 1180, height: 640 },
    { id: "laptop", label: "Laptop", width: 1366, height: 768 },
    { id: "wide", label: "Wide", width: 1560, height: 940 },
  ]));
  const sparse = validateResponsiveFrames({
    standard: { x: -0.2, width: 0.6 },
    wide: { x: 0.2, width: 0.8 },
  }, sparseLayouts, FRAME_FIELDS);
  assert.deepEqual(resolveResponsiveFrame(sparseLayouts, sparse, 1366, inherited, FRAME_FIELDS).value, {
    x: -0.0042,
    width: 0.6979,
  });
  const one = validateResponsiveFrames({ laptop: { x: 0.3 } }, sparseLayouts, FRAME_FIELDS);
  for (const width of [920, 1180, 1366, 1560, 3840]) {
    assert.deepEqual(resolveResponsiveFrame(sparseLayouts, one, width, inherited, FRAME_FIELDS).value, {
      x: 0.3,
      width: 0.7,
    });
  }

  const sets = [
    { id: "compact", label: "Compact", width: 920, height: 620 },
    { id: "standard", label: "Standard", width: 1180, height: 700 },
    { id: "laptop", label: "Laptop", width: 1440, height: 850 },
    { id: "desktop", label: "Desktop", width: 1720, height: 980 },
    { id: "large", label: "Large", width: 2200, height: 1240 },
    { id: "cinema", label: "Cinema", width: 3000, height: 1800 },
  ];
  const sixLayouts = validateResponsiveLayouts(fluid(sets));
  const sixFrames = validateResponsiveFrames(Object.fromEntries(sets.map((set, index) => [set.id, {
    x: index * 0.1,
    width: 0.46 + (index * 0.08),
  }])), sixLayouts, FRAME_FIELDS);
  const sixInherited = { x: -0.5, width: 0.5 };
  for (const [index, set] of sets.entries()) {
    assert.deepEqual(
      resolveResponsiveFrame(sixLayouts, sixFrames, set.width, sixInherited, FRAME_FIELDS).value,
      sixFrames[set.id],
      `Six-set resolver disagreed at ${set.id}`,
    );
    if (index === sets.length - 1) continue;
    const next = sets[index + 1];
    assert.deepEqual(
      resolveResponsiveFrame(sixLayouts, sixFrames, (set.width + next.width) / 2, sixInherited, FRAME_FIELDS).value,
      {
        x: Math.round(((sixFrames[set.id].x + sixFrames[next.id].x) / 2) * 10_000) / 10_000,
        width: Math.round(((sixFrames[set.id].width + sixFrames[next.id].width) / 2) * 10_000) / 10_000,
      },
      `Six-set resolver disagreed between ${set.id} and ${next.id}`,
    );
  }
});

test("step resolver preserves the legacy 1440 activation and inherits through an empty inserted set", () => {
  const legacy = validateResponsiveLayouts(LEGACY_RESPONSIVE_LAYOUTS);
  const frames = validateResponsiveFrames({
    standard: { x: -0.2 },
    wide: { x: 0.2 },
  }, legacy, FRAME_FIELDS);
  const inherited = { x: 0, width: 0.7 };
  assert.equal(resolveResponsiveFrame(legacy, frames, 1439, inherited, FRAME_FIELDS).value.x, -0.2);
  assert.equal(resolveResponsiveFrame(legacy, frames, 1440, inherited, FRAME_FIELDS).value.x, 0.2);

  const inserted = insertResponsiveLayoutSet(legacy, {
    id: "laptop", label: "Laptop", width: 1366, height: 768,
  });
  assert.deepEqual(inserted.sets.map(({ id }) => id), ["standard", "laptop", "wide"]);
  assert.equal(inserted.breakpoints[1], 1440);
  assert.equal(resolveResponsiveFrame(inserted, frames, 1400, inherited, FRAME_FIELDS).value.x, -0.2);
  assert.equal(resolveResponsiveFrame(inserted, frames, 1440, inherited, FRAME_FIELDS).value.x, 0.2);
});

test("responsive migration lifts categorical owners out of numeric frames without moving prompt defaults", () => {
  const greeting = (xRatio, fontSize) => ({
    font: "system-sans", color: "primary", fontSize, weight: 500, italic: false,
    letterSpacing: 0, lineHeight: 1.1, align: "center", maxWidthRatio: 0.7,
    xRatio, yRatio: 0, decoration: "none", mark: { source: "native", scale: 1 },
  });
  const frame = (anchor, positionX) => ({
    anchor, positionX, positionY: 0, focalX: 50, focalY: 50, scale: 1,
  });
  const legacy = {
    schemaVersion: 4,
    newChatLayout: { widthRatio: 0.72, offsetXRatio: 0.1, offsetYRatio: -0.05 },
    newChatGreetingStyle: {
      light: { standard: greeting(-0.1, 36), wide: greeting(0.1, 44) },
      dark: { standard: greeting(-0.05, 35), wide: greeting(0.05, 43) },
    },
    artworkLayers: [{ frames: { normal: frame("center", -5), wide: frame("center", 8) } }],
    instantPrompts: [{ layout: { opacity: 1, frames: {
      normal: { positionX: 0, positionY: 0, scale: 1 },
      wide: { positionX: 5, positionY: 2, scale: 1.1 },
    } } }],
  };
  const upgraded = upgradeStudioDocumentToResponsive(legacy);
  assert.equal(upgraded.schemaVersion, 5);
  assert.deepEqual(upgraded.responsiveLayouts, LEGACY_RESPONSIVE_LAYOUTS);
  assert.deepEqual(upgraded.newChatLayout, legacy.newChatLayout);
  assert.equal(upgraded.artworkLayers[0].anchor, "center");
  assert(!Object.hasOwn(upgraded.artworkLayers[0].frames.standard, "anchor"));
  assert.deepEqual(Object.keys(upgraded.newChatGreetingStyle.light), ["base", "frames"]);
  assert(!Object.hasOwn(upgraded.newChatGreetingStyle.light.frames.standard, "font"));
  assert.deepEqual(Object.keys(upgraded.instantPrompts[0].layout.frames), ["standard", "wide"]);
  assert.deepEqual(legacy.artworkLayers[0].frames.normal, frame("center", -5), "migration mutated its input");
  assert.throws(() => upgradeStudioDocumentToResponsive({
    ...legacy,
    artworkLayers: [{ frames: { normal: frame("left", 0), wide: frame("right", 0) } }],
  }), /incompatible categorical anchors/);
});

test("Studio ships the exact shared resolver factory before the editor controller", async () => {
  const expected = [
    "// Generated by scripts/build-responsive-resolver.mjs. Do not edit by hand.",
    `window.CLAUDE_AURA_RESPONSIVE_RESOLVER_FACTORY = ${createResponsiveResolver.toString()};`,
    "",
  ].join("\n");
  assert.equal(
    await fs.readFile(path.join(PROJECT_ROOT, "studio", "responsive-resolver.js"), "utf8"),
    expected,
  );
  const html = await fs.readFile(path.join(PROJECT_ROOT, "studio", "index.html"), "utf8");
  assert(
    html.indexOf('src="responsive-resolver.js"') < html.indexOf('src="editor.js"'),
    "Studio loaded the editor before its generated shared resolver",
  );
});

test("Studio responsive CRUD is explicit, sparse, persistent, and budget-safe", async () => {
  const temporary = await fs.mkdtemp(path.join(PROJECT_ROOT, "tests", ".tmp-responsive-layouts-"));
  const configPath = path.join(temporary, "config.json");
  const userThemesDir = path.join(temporary, "themes");
  const editorRoot = path.join(temporary, "editor");
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
  const activeDocument = async () => JSON.parse(await fs.readFile(
    path.join(editorRoot, "active", "theme.json"),
    "utf8",
  ));
  try {
    await fs.mkdir(userThemesDir, { recursive: true });
    await writeConfig(configPath, { ...DEFAULT_CONFIG });
    let result = await request({ type: "create-theme-copy", theme: "japanese-idol" });
    assert.equal((await activeDocument()).schemaVersion, 4);

    result = await request(action(result, "set-theme-token", {
      mode: "shared", token: "radius", value: 14,
    }));
    result = await request(action(result, "set-theme-token", {
      mode: "shared", token: "radius", value: 15,
    }));
    result = await request(action(result, "undo-theme-edit"));

    result = await request(action(result, "enable-responsive-layouts"));
    let document = await activeDocument();
    assert.equal(document.schemaVersion, 5);
    assert.deepEqual(document.responsiveLayouts, LEGACY_RESPONSIVE_LAYOUTS);
    assert.equal(result.state.feedback.valid, true);
    const upgradedInternal = JSON.parse(await fs.readFile(
      path.join(editorRoot, "active", ".editor-state.json"),
      "utf8",
    ));
    for (const [name, candidate] of [
      ["baseline", upgradedInternal.baselineDocument],
      ["current", upgradedInternal.currentDocument],
      ["last-valid", upgradedInternal.lastValidDocument],
      ...upgradedInternal.undo.map((value, index) => [`undo ${index}`, value]),
      ...upgradedInternal.redo.map((value, index) => [`redo ${index}`, value]),
      ...upgradedInternal.appliedUndo.map((value, index) => [`applied undo ${index}`, value]),
      ...upgradedInternal.appliedRedo.map((value, index) => [`applied redo ${index}`, value]),
    ]) {
      if (candidate !== null) assert.equal(candidate.schemaVersion, 5, `${name} retained an old schema`);
    }

    const cardId = "prompt-0123456789abcdef0123456789abcdef";
    result = await request(action(result, "apply-theme-patch", {
      changes: [
        {
          kind: "surface", target: "promptBlock", slot: "frame", axis: "standard",
          property: "widthRatio", value: 0.7,
        },
        {
          kind: "instant-prompt", operation: "add", id: cardId, field: null, locale: null,
          value: {
            id: cardId,
            labels: { en: "Plan" },
            prompts: { en: "Plan the next step." },
            icon: null,
            layout: { opacity: 1, frames: { standard: { widthRatio: 1.2 } } },
          },
        },
      ],
    }));

    result = await request(action(result, "mutate-responsive-layout", {
      operation: "add",
      id: "laptop",
      value: { id: "laptop", label: "Laptop", width: 1366, height: 768 },
    }));
    document = await activeDocument();
    assert.deepEqual(document.responsiveLayouts.sets.map(({ id }) => id), ["standard", "laptop", "wide"]);
    assert.equal(Object.hasOwn(document.artworkLayers[0].frames, "laptop"), false,
      "Adding metadata invented an artwork override");
    for (const appearance of ["light", "dark"]) {
      assert.equal(Object.hasOwn(document.newChatGreetingStyle[appearance].frames, "laptop"), false,
        "Adding metadata invented a greeting override");
    }
    result = await request(action(result, "mutate-responsive-layout", {
      operation: "delete", id: "laptop", value: null,
    }));

    result = await request(action(result, "set-theme-layer", {
      index: 0, preset: "standard", property: "positionX", value: 7,
    }));
    result = await request(action(result, "mutate-responsive-layout", {
      operation: "duplicate",
      id: "standard",
      value: { id: "laptop", label: "Laptop copy", width: 1366, height: 768 },
    }));
    document = await activeDocument();
    assert.deepEqual(document.artworkLayers[0].frames.laptop, document.artworkLayers[0].frames.standard,
      "Duplicating a set did not copy its sparse artwork frame");

    result = await request(action(result, "mutate-responsive-layout", {
      operation: "update",
      id: "laptop",
      value: { label: "Laptop", width: 1380, height: 800 },
    }));
    result = await request(action(result, "mutate-responsive-layout", {
      operation: "mode", id: null, value: "fluid",
    }));
    assert.equal(result.state.responsiveLayouts.breakpoints, null);
    result = await request(action(result, "mutate-responsive-layout", {
      operation: "mode", id: null, value: "step",
    }));
    result = await request(action(result, "mutate-responsive-layout", {
      operation: "breakpoint", id: "laptop", value: 1300,
    }));
    assert.equal(result.state.responsiveLayouts.breakpoints[0], 1300);

    result = await request(action(result, "mutate-responsive-layout", {
      operation: "delete", id: "laptop", value: null,
    }));
    document = await activeDocument();
    assert.equal(Object.hasOwn(document.artworkLayers[0].frames, "laptop"), false,
      "Deleting a set retained its artwork frame");
    const expectedTrackAfterCrud = {
      ...LEGACY_RESPONSIVE_LAYOUTS,
      breakpoints: [1470],
    };
    assert.deepEqual(document.responsiveLayouts, expectedTrackAfterCrud);
    assert.equal(result.state.feedback.valid, true);
    assert(result.state.feedback.budget.chromeBytes <= result.state.feedback.budget.chromeLimit);
    assert(result.state.feedback.budget.embeddedArtworkBytes <= result.state.feedback.budget.embeddedArtworkLimit);
    const settings = readPayloadSettings(result.payload);
    assert.deepEqual(settings.R, ["s", ["standard", "wide"], [1180, 1560], [1470]]);
    assert.deepEqual(settings.n, [[0.64, 0, 0], [[0.7, null, null], null]],
      "Sparse prompt geometry was expanded into synthetic responsive defaults");
    assert.deepEqual(settings.P[0][4], [1, [[null, null, 1.2, null, null, null], null]],
      "Sparse instant-prompt geometry was expanded into synthetic responsive defaults");
    assert.equal(settings.artLayers[0].n.length, 2,
      "Runtime artwork tuples disagreed with the saved responsive track");

    result = await request(action(result, "save-theme-edit"));
    const installed = JSON.parse(await fs.readFile(
      path.join(userThemesDir, result.state.id, "theme.json"),
      "utf8",
    ));
    assert.equal(installed.schemaVersion, 5);
    assert.deepEqual(installed.responsiveLayouts, expectedTrackAfterCrud);
    result = await request(action(result, "discard-theme-edit"));
    result = await request({ type: "begin-theme-edit", theme: installed.id, reset: false });
    assert.deepEqual(result.state.responsiveLayouts, expectedTrackAfterCrud);
  } finally {
    await fs.rm(temporary, { recursive: true, force: true });
  }
});

await runIfMain(import.meta.url);
