// WO-28 loading-screen contract: one bounded schema, deliberate v6 upgrade,
// atomic Studio history, and a host-owned preview that never owns navigation.
import assert from "node:assert/strict";
import { test, runIfMain } from "./support/harness.mjs";
import {
  LOADING_SCREEN_CUE_IDS,
  LOADING_SCREEN_INHERIT,
  upgradeStudioDocumentToLoadingScreen,
  validateLoadingScreen,
} from "../scripts/theme-core.mjs";
import {
  DEFAULT_CONFIG,
  executeStudioRequest,
  PROJECT_ROOT,
  fs,
  path,
  writeConfig,
} from "./support/context.mjs";

const appearance = (overrides = {}) => ({
  background: "#F1F2F9",
  surface: "#FFFFFF",
  text: "#171A31",
  accent: "#4721A1",
  accentText: "#FFFFFF",
  border: "#21243B",
  artwork: null,
  ...overrides,
});

const CUSTOM_LOADING_SCREEN = Object.freeze({
  mode: "custom",
  layout: "centered",
  motif: "inherit",
  mark: Object.freeze({ source: "theme", asset: null, size: 72 }),
  progress: Object.freeze({ style: "bar", motion: "calm" }),
  light: Object.freeze(appearance()),
  dark: Object.freeze(appearance({
    background: "#1B1D2C",
    surface: "#282B3E",
    text: "#F7F8FC",
    accent: "#BA8BF4",
    accentText: "#0F101F",
    border: "#DCE1F0",
  })),
});

test("loading-screen schema-v6 accepts only the exact bounded union", () => {
  assert.deepEqual(validateLoadingScreen({ mode: "inherit" }), LOADING_SCREEN_INHERIT);
  assert.deepEqual(validateLoadingScreen(CUSTOM_LOADING_SCREEN), CUSTOM_LOADING_SCREEN);
  assert.deepEqual([...LOADING_SCREEN_CUE_IDS], [
    "orbit", "editorial-rule", "facet", "ink-frame", "horizon", "folio", "ribbon", "capsule",
  ]);

  assert.throws(() => validateLoadingScreen({ mode: "inherit", extra: true }), /unsupported property/);
  assert.throws(() => validateLoadingScreen({ ...CUSTOM_LOADING_SCREEN, layout: "free" }), /layout/);
  assert.throws(() => validateLoadingScreen({ ...CUSTOM_LOADING_SCREEN, motif: "url(x)" }), /motif/);
  assert.throws(() => validateLoadingScreen({
    ...CUSTOM_LOADING_SCREEN,
    mark: { source: "custom", asset: "..\\mark.png", size: 72 },
  }), /content-addressed PNG/);
  assert.throws(() => validateLoadingScreen({
    ...CUSTOM_LOADING_SCREEN,
    mark: { source: "theme", asset: "loading/mark-a.png", size: 72 },
  }), /asset must be null/);
  assert.throws(() => validateLoadingScreen({
    ...CUSTOM_LOADING_SCREEN,
    light: appearance({ background: "#FFFFFF80" }),
  }), /opaque six-digit hex/);
  assert.throws(() => validateLoadingScreen({
    ...CUSTOM_LOADING_SCREEN,
    light: appearance({ text: "#EEEEEE", surface: "#FFFFFF" }),
  }), /4.5:1 contrast/);
  assert.throws(() => validateLoadingScreen({
    ...CUSTOM_LOADING_SCREEN,
    dark: appearance({ artwork: {
      asset: "loading/artwork-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.webp",
      opacity: Number.NaN,
      fit: "cover",
      focalX: 50,
      focalY: 50,
    } }),
  }), /opacity must be a finite number/);
});

test("a deliberate loading-screen edit is the only schema-v6 upgrade", () => {
  const responsive = {
    schemaVersion: 5,
    id: "demo",
    responsiveLayouts: {
      mode: "step",
      axis: "width",
      sets: [
        { id: "standard", label: "Standard", width: 1180, height: 640 },
        { id: "wide", label: "Wide", width: 1560, height: 940 },
      ],
      breakpoints: [1440],
    },
  };
  const upgraded = upgradeStudioDocumentToLoadingScreen(responsive, CUSTOM_LOADING_SCREEN);
  assert.equal(upgraded.schemaVersion, 6);
  assert.deepEqual(upgraded.loadingScreen, CUSTOM_LOADING_SCREEN);
  assert(!Object.hasOwn(responsive, "loadingScreen"), "upgrade mutated its input");
  assert.deepEqual(
    upgradeStudioDocumentToLoadingScreen(upgraded, { mode: "inherit" }).loadingScreen,
    LOADING_SCREEN_INHERIT,
  );
});

test("Studio applies, undoes, resets, saves, and reopens loading-screen v6 atomically", async () => {
  const temporary = await fs.mkdtemp(path.join(PROJECT_ROOT, "tests", ".tmp-loading-screen-"));
  const configPath = path.join(temporary, "config.json");
  const userThemesDir = path.join(temporary, "themes");
  const editorRoot = path.join(temporary, "editor");
  const request = (message, options = {}) => executeStudioRequest({
    request: message,
    configPath,
    userThemesDir,
    editorRoot,
    locale: "en",
    ...options,
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
    assert.deepEqual(result.state.loadingScreen, LOADING_SCREEN_INHERIT);

    result = await request(action(result, "set-loading-screen", {
      loadingScreen: CUSTOM_LOADING_SCREEN,
    }));
    let document = await activeDocument();
    assert.equal(document.schemaVersion, 6);
    assert(document.responsiveLayouts, "v6 did not carry schema-v5 responsive metadata");
    assert.deepEqual(document.loadingScreen, CUSTOM_LOADING_SCREEN);
    assert.deepEqual(result.state.loadingScreen, CUSTOM_LOADING_SCREEN);
    assert.equal(result.state.canUndo, true);

    result = await request(action(result, "undo-theme-edit"));
    assert.equal((await activeDocument()).schemaVersion, 4);
    assert.deepEqual(result.state.loadingScreen, LOADING_SCREEN_INHERIT);
    result = await request(action(result, "redo-theme-edit"));
    assert.equal((await activeDocument()).schemaVersion, 6);

    result = await request(action(result, "set-loading-screen", {
      loadingScreen: LOADING_SCREEN_INHERIT,
    }));
    document = await activeDocument();
    assert.equal(document.schemaVersion, 6);
    assert.deepEqual(document.loadingScreen, LOADING_SCREEN_INHERIT);

    result = await request(action(result, "save-theme-edit"));
    assert.equal(result.state.dirty, false);
    const installed = JSON.parse(await fs.readFile(
      path.join(userThemesDir, result.state.id, "theme.json"),
      "utf8",
    ));
    assert.equal(installed.schemaVersion, 6);
    assert.deepEqual(installed.loadingScreen, LOADING_SCREEN_INHERIT);

    result = await request({ type: "begin-theme-edit", theme: result.state.id, reset: false });
    assert.deepEqual(result.state.loadingScreen, LOADING_SCREEN_INHERIT);
  } finally {
    await fs.rm(temporary, { recursive: true, force: true });
  }
});

test("Studio and the Windows host expose a schematic-only loading preview lifecycle", async () => {
  const [html, editor, app, host] = await Promise.all([
    fs.readFile(path.join(PROJECT_ROOT, "studio", "index.html"), "utf8"),
    fs.readFile(path.join(PROJECT_ROOT, "studio", "editor.js"), "utf8"),
    fs.readFile(path.join(PROJECT_ROOT, "studio", "app.js"), "utf8"),
    fs.readFile(path.join(PROJECT_ROOT, "windows", "aura-ui.ps1"), "utf8"),
  ]);
  assert.match(html, /data-editor-targets="widgets\.loading-screen"/);
  assert.match(html, /loading-screen-schematic/);
  assert.match(editor, /id: "widgets\.loading-screen"[\s\S]{0,220}?captureGeometry: "local-preview"/);
  assert.match(editor, /type: "preview-theme-loading-screen"/);
  for (const action of [
    "set-loading-screen", "pick-loading-screen-mark", "pick-loading-screen-artwork",
    "preview-theme-loading-screen",
  ]) assert(app.includes(`"${action}"`), `Studio shell is missing ${action}`);

  assert.match(host, /function Show-AuraUiLoadingScreenPreview/);
  assert.match(host, /function Stop-AuraUiLoadingScreenPreview/);
  assert.match(host, /Interval\s*=\s*8000/);
  assert.match(host, /CloseLoadingPreviewButton/);
  const preview = host.match(/function Show-AuraUiLoadingScreenPreview[\s\S]*?\n}/)?.[0] ?? "";
  assert(!/PageReady\s*=|ActiveNavigationId\s*=|ReadyNavigationId\s*=/.test(preview),
    "Loading preview mutates navigation lifecycle state");
});

runIfMain(import.meta.url);
