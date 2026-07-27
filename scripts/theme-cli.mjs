#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { generateAssetAudit } from "./asset-audit.mjs";
import {
  buildPayloadFromCompiled,
  compileTheme,
  DEFAULT_CONFIG,
  executeStudioRequest,
  hydrateStudioDraft,
  listThemes,
  normalizeLocale,
  PROJECT_ROOT,
  readConfig,
  readThemeKit,
  readThemeRegistry,
  resolveGreetingRuntime,
  studioStyleFromTheme,
  validateGreetingPreferences,
  validateGreetingShuffleState,
  writeConfig,
} from "./theme-core.mjs";

const THEME_ID_PATTERN = /^[a-z][a-z0-9-]{1,39}$/;
const SLOT_SPECS = [
  ["background", "≥1600 px wide, opaque, low-detail center-left (text sits there)"],
  ["hero", "≥1000 px, transparent or soft-matte edges, subject inside the right 60%"],
  ["corner-top-right", "transparent, safe to clip at the viewport edge"],
  ["corner-bottom", "transparent, safe to clip at the viewport edge"],
  ["card-1", "square, transparent, subject in the bottom-right 40%"],
  ["card-2", "square, transparent, subject in the bottom-right 40%"],
  ["card-3", "square, transparent, subject in the bottom-right 40%"],
  ["brand-mark", "optional small, flat reserved slot; live starburst replacement is not wired yet"],
  ["launcher-mark", "optional 96×96 transparent PNG; restyles the floating Aura Studio launcher"],
];

function parse(argv) {
  const command = argv.shift() ?? "help";
  const options = {};
  const positionals = [];
  while (argv.length) {
    const arg = argv.shift();
    if (!arg.startsWith("--")) {
      positionals.push(arg);
      continue;
    }
    const key = arg.slice(2);
    if (["json", "clear-image", "clear-avatar", "payload"].includes(key)) options[key] = true;
    else {
      if (!argv.length) throw new Error(`Missing value for ${arg}`);
      options[key] = argv.shift();
    }
  }
  return { command, options, positionals };
}

async function pathExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}

function titleFromId(id) {
  return id.split("-").filter(Boolean).map((word) => `${word[0].toUpperCase()}${word.slice(1)}`).join(" ");
}

function scaffoldTemplate(defaultTheme, id) {
  const modeTemplate = (mode) => ({
    "$comment": `Edit ${mode}-mode semantic colors and wallpaper values below.`,
    semantic: { ...defaultTheme[mode].semantic },
    wallpaper: {
      "$comment": "Keep text surfaces readable over any optional slot artwork.",
      ...defaultTheme[mode].wallpaper,
    },
  });
  return {
    "$comment": "Starter theme copied from Default. Keep name and variant aligned; $comment fields are valid JSON and may be removed.",
    ...defaultTheme,
    name: id,
    variant: id,
    typography: {
      "$comment": "Choose local system font stacks only; remote font resources are not allowed.",
      ...defaultTheme.typography,
    },
    shape: {
      "$comment": "Control radii, card radii, composer radii, icon radii, and border width.",
      ...defaultTheme.shape,
    },
    effects: {
      "$comment": "Tune shadows, hover lift, and transition timing without adding remote resources.",
      ...defaultTheme.effects,
    },
    light: modeTemplate("light"),
    dark: modeTemplate("dark"),
  };
}

function checklist(id) {
  const rows = SLOT_SPECS.map(([slot, spec]) => `- [ ] \`${slot}.png\` — ${spec}`).join("\n");
  return `# ${id} asset slots

Drop optional PNG files into this folder using the exact filenames below.
Empty slots are skipped, so a tokens-only theme with no artwork is valid.

${rows}

Use only artwork you have the right to distribute. Keep interface text out of
the images; minimal decorative lettering inside the art is okay. Keep every
resource local and offline, and leave unused slots absent instead of creating
placeholder images. Decorative PNGs in this folder are source inputs, never
runtime backgrounds. To use \`launcher-mark.png\`, set \`theme.launcher.asset\`
to \`launcher-mark.png\` in both generated theme JSON files; otherwise Aura
inherits its safe Default launcher.

Before pasting the registry snippet, replace its labels and descriptions with
independently written en, zh-CN, and zh-HKTW theme copy.
`;
}

function registrySnippet(id, defaultEntry) {
  const title = titleFromId(id);
  return {
    id,
    labels: {
      en: title,
      "zh-CN": `自定义主题（${id}）`,
      "zh-HKTW": `自訂主題（${id}）`,
    },
    descriptions: {
      en: "A custom theme scaffolded from Claude Aura's default tokens.",
      "zh-CN": "基于 Claude Aura 默认变量创建的自定义主题。",
      "zh-HKTW": "以 Claude Aura 預設樣式變數建立的自訂主題。",
    },
    swatches: [...defaultEntry.swatches],
    preview: { ...defaultEntry.preview },
    artwork: null,
  };
}

function standaloneKit(theme, metadata) {
  return {
    "$comment": "Standalone Claude Aura theme kit. Keep id, theme.name, and theme.variant identical.",
    schemaVersion: 1,
    ...metadata,
    theme,
  };
}

async function scaffold(id) {
  if (!THEME_ID_PATTERN.test(id ?? "")) {
    throw new Error("Theme id must match ^[a-z][a-z0-9-]{1,39}$");
  }
  const registry = await readThemeRegistry();
  const reservedIds = new Set([
    ...registry.themes.map((theme) => theme.id),
    ...Object.keys(registry.legacyAliases),
  ]);
  if (reservedIds.has(id)) throw new Error(`Theme id already exists: ${id}`);

  const themesDirectory = path.join(process.cwd(), "themes");
  const themePath = path.join(themesDirectory, `${id}.json`);
  const kitDirectory = path.join(themesDirectory, id);
  if (await pathExists(themePath) || await pathExists(kitDirectory)) {
    throw new Error(`Theme id already exists: ${id}`);
  }

  const defaultTheme = JSON.parse(await fs.readFile(path.join(PROJECT_ROOT, "themes", "default.json"), "utf8"));
  const defaultEntry = registry.themes.find((theme) => theme.id === registry.defaultTheme);
  const themeBytes = `${JSON.stringify(scaffoldTemplate(defaultTheme, id), null, 2)}\n`;
  const checklistBytes = checklist(id);
  const snippet = registrySnippet(id, defaultEntry);
  const snippetBytes = `${JSON.stringify(snippet, null, 2)}\n`;
  const kitBytes = `${JSON.stringify(standaloneKit(scaffoldTemplate(defaultTheme, id), snippet), null, 2)}\n`;
  let themeCreated = false;
  let kitCreated = false;
  let standaloneKitCreated = false;
  let checklistCreated = false;
  try {
    await fs.mkdir(themesDirectory, { recursive: true });
    await fs.writeFile(themePath, themeBytes, { encoding: "utf8", flag: "wx" });
    themeCreated = true;
    await fs.mkdir(kitDirectory);
    kitCreated = true;
    await fs.writeFile(path.join(kitDirectory, "theme.json"), kitBytes, { encoding: "utf8", flag: "wx" });
    standaloneKitCreated = true;
    await fs.writeFile(path.join(kitDirectory, "CHECKLIST.md"), checklistBytes, { encoding: "utf8", flag: "wx" });
    checklistCreated = true;
  } catch (error) {
    if (checklistCreated) await fs.rm(path.join(kitDirectory, "CHECKLIST.md"), { force: true });
    if (standaloneKitCreated) await fs.rm(path.join(kitDirectory, "theme.json"), { force: true });
    if (kitCreated) await fs.rmdir(kitDirectory).catch(() => {});
    if (themeCreated) await fs.rm(themePath, { force: true });
    if (error.code === "EEXIST") throw new Error(`Theme id already exists: ${id}`);
    throw error;
  }
  process.stdout.write(snippetBytes);
}

function booleanValue(value, label) {
  if (value === "true") return true;
  if (value === "false") return false;
  throw new Error(`${label} must be true or false`);
}

async function validateKitPayloads(kit) {
  const payloads = [];
  for (const appearance of ["light", "dark"]) {
    const compiled = await compileTheme({
      config: { ...DEFAULT_CONFIG, enabled: true, theme: kit.id, appearance },
      themeKitDirectory: kit.sourceDirectory,
    });
    const bundle = await buildPayloadFromCompiled(compiled);
    new Function(bundle.payload);
    payloads.push({
      appearance,
      embeddedArtworkBytes: bundle.payloadBudget.embeddedArtworkBytes,
      chromeBytes: bundle.payloadBudget.chromeBytes,
    });
  }
  return payloads;
}

function help() {
  console.log(`Claude Aura theme tool

Commands:
  list [--json] [--locale <tag>] [--user-themes <path>]
  scaffold <id>
  qa <id>
  init --config <path> [--locale <tag>] [--user-themes <path>] [--payload]
  show --config <path> [--json] [--locale <tag>] [--user-themes <path>]
  validate <kit-folder>
  validate [--config <path>] [--theme <name>] [--locale <tag>]
      [--user-themes <path>]
  studio --config <path> --user-themes <path> --editor-root <path>
      --locale <tag> --request-base64 <base64url-json> [--asset <absolute-host-owned-image-path>]
      [--builtin-authoring-root <absolute-source-checkout-path>]
  studio-state --config <path> --user-themes <path> --editor-root <path> --locale <tag>
      [--builtin-authoring-root <absolute-source-checkout-path>]
  greeting-checkpoint --config <path> --state-base64 <base64url-json>
  set --config <path> [--theme <name>] [--image <path>|--clear-image]
      [--avatar <path>|--clear-avatar]
      [--appearance system|light|dark]
      [--image-opacity <0..0.55>] [--image-position <css-position>] [--image-zoom <1..2>]
      [--studio-preview-theme <id> --studio-preview-x <0..100>
       --studio-preview-y <0..100> --studio-preview-zoom <1..6>]
      [--reduce-motion true|false] [--enabled true|false]
      [--user-themes <path>] [--payload]
`);
}

async function main() {
const { command, options, positionals } = parse(process.argv.slice(2));
if (!["qa", "scaffold", "validate"].includes(command) && positionals.length) throw new Error(`Unexpected argument: ${positionals[0]}`);
const userThemesDir = options["user-themes"] === undefined ? null : path.resolve(options["user-themes"]);
const emitWarning = (message) => process.stderr.write(`Warning: ${message}\n`);
const runtimeOptions = { userThemesDir, onWarning: emitWarning };
if (command === "help" || command === "--help") {
  help();
} else if (command === "studio") {
  const allowed = new Set([
    "config", "user-themes", "editor-root", "locale", "request-base64", "asset",
    "builtin-authoring-root",
  ]);
  const unsupported = Object.keys(options).find((key) => !allowed.has(key));
  if (unsupported) throw new Error(`Unsupported studio option: --${unsupported}`);
  for (const key of ["config", "user-themes", "editor-root", "locale", "request-base64"]) {
    if (typeof options[key] !== "string" || !options[key]) throw new Error(`--${key} is required`);
  }
  const encoded = options["request-base64"];
  if (encoded.length > 131_072 || !/^[A-Za-z0-9_-]+$/.test(encoded)) {
    throw new Error("--request-base64 must be unpadded base64url JSON");
  }
  const requestBytes = Buffer.from(encoded, "base64url");
  if (requestBytes.toString("base64url") !== encoded || requestBytes.length > 98_304) {
    throw new Error("--request-base64 is not canonical base64url JSON");
  }
  const requestText = requestBytes.toString("utf8");
  if (requestText.includes("\uFFFD")) throw new Error("--request-base64 must contain valid UTF-8 JSON");
  let request;
  try {
    request = JSON.parse(requestText);
  } catch (error) {
    throw new Error(`--request-base64 contains invalid JSON: ${error.message}`);
  }
  if (options.asset !== undefined && !path.isAbsolute(options.asset)) {
    throw new Error("--asset must be an absolute host-owned path");
  }
  if (options["builtin-authoring-root"] !== undefined
      && !path.isAbsolute(options["builtin-authoring-root"])) {
    throw new Error("--builtin-authoring-root must be an absolute path");
  }
  const result = await executeStudioRequest({
    request,
    configPath: path.resolve(options.config),
    userThemesDir: path.resolve(options["user-themes"]),
    editorRoot: path.resolve(options["editor-root"]),
    locale: options.locale,
    assetPath: options.asset ?? null,
    builtinAuthoringRoot: options["builtin-authoring-root"] ?? null,
  });
  process.stdout.write(JSON.stringify(result));
} else if (command === "studio-state") {
  const allowed = new Set([
    "config", "user-themes", "editor-root", "locale", "builtin-authoring-root",
  ]);
  const unsupported = Object.keys(options).find((key) => !allowed.has(key));
  if (unsupported) throw new Error(`Unsupported studio-state option: --${unsupported}`);
  for (const key of ["config", "user-themes", "editor-root", "locale"]) {
    if (typeof options[key] !== "string" || !options[key]) throw new Error(`--${key} is required`);
  }
  if (options["builtin-authoring-root"] !== undefined
      && !path.isAbsolute(options["builtin-authoring-root"])) {
    throw new Error("--builtin-authoring-root must be an absolute path");
  }
  const result = await hydrateStudioDraft({
    configPath: path.resolve(options.config),
    userThemesDir: path.resolve(options["user-themes"]),
    editorRoot: path.resolve(options["editor-root"]),
    locale: options.locale,
    builtinAuthoringRoot: options["builtin-authoring-root"] ?? null,
  });
  process.stdout.write(JSON.stringify(result));
} else if (command === "greeting-checkpoint") {
  const allowed = new Set(["config", "state-base64"]);
  const unsupported = Object.keys(options).find((key) => !allowed.has(key));
  if (unsupported) throw new Error(`Unsupported greeting-checkpoint option: --${unsupported}`);
  for (const key of allowed) {
    if (typeof options[key] !== "string" || !options[key]) throw new Error(`--${key} is required`);
  }
  const encoded = options["state-base64"];
  if (encoded.length > 2048 || !/^[A-Za-z0-9_-]+$/.test(encoded)) {
    throw new Error("--state-base64 must be bounded unpadded base64url JSON");
  }
  const bytes = Buffer.from(encoded, "base64url");
  if (bytes.toString("base64url") !== encoded || bytes.length > 1536) {
    throw new Error("--state-base64 is not canonical base64url JSON");
  }
  let state;
  try {
    state = JSON.parse(bytes.toString("utf8"));
  } catch (error) {
    throw new Error(`--state-base64 contains invalid JSON: ${error.message}`);
  }
  const shuffle = validateGreetingShuffleState(state, "greeting checkpoint");
  if (!shuffle) throw new Error("Greeting checkpoint cannot be null");
  const configPath = path.resolve(options.config);
  const config = await readConfig(configPath);
  const preferences = validateGreetingPreferences(config.greetingPreferences);
  const runtime = resolveGreetingRuntime(preferences, shuffle.themeId);
  if (!runtime || runtime.phraseDigest !== shuffle.phraseDigest
      || runtime.phrases.length !== shuffle.order.length) {
    throw new Error("Greeting checkpoint does not match the current effective phrase list");
  }
  const expectedOrder = Array.from({ length: runtime.phrases.length }, (_, index) => index);
  const sortedOrder = [...shuffle.order].sort((left, right) => left - right);
  if (sortedOrder.some((index, position) => index !== expectedOrder[position])
      || shuffle.cursor < 1
      || shuffle.lastIndex !== shuffle.order[shuffle.cursor - 1]) {
    throw new Error("Greeting checkpoint is not a completed bounded selection");
  }
  const normalized = validateGreetingPreferences({ ...preferences, shuffle });
  const changed = JSON.stringify(preferences.shuffle) !== JSON.stringify(shuffle);
  if (changed) {
    await writeConfig(configPath, { ...config, greetingPreferences: normalized });
  }
  process.stdout.write(JSON.stringify({ changed, shuffle }));
} else if (command === "scaffold") {
  if (positionals.length !== 1 || Object.keys(options).length) {
    throw new Error("Usage: theme-cli scaffold <id>");
  }
  await scaffold(positionals[0]);
} else if (command === "qa") {
  if (positionals.length !== 1 || Object.keys(options).length) {
    throw new Error("Usage: theme-cli qa <id>");
  }
  const result = await generateAssetAudit(positionals[0], { cwd: process.cwd() });
  const relativePath = (filePath) => path.relative(process.cwd(), filePath).replaceAll(path.sep, "/");
  console.log(JSON.stringify({
    ...result,
    outputDir: relativePath(result.outputDir),
    boardPath: null,
    statusPath: relativePath(result.statusPath),
  }, null, 2));
} else if (command === "list") {
  const locale = normalizeLocale(options.locale ?? "en");
  const themes = (await listThemes({ locale, ...runtimeOptions })).map(({
    name,
    label,
    description,
    labels,
    descriptions,
    swatches,
    preview,
    launcher,
    studioPreview,
    studioPreviewFrame,
    sourceRecipe,
    artwork,
    source,
    light,
    dark,
    typography,
    shape,
    effects,
    blur,
  }) => ({
    name,
    label,
    description,
    labels,
    descriptions,
    swatches,
    preview,
    launcher,
    studioStyle: studioStyleFromTheme({ light, dark, typography, shape, effects, blur }),
    // Studio renders user theme cards from this metadata, and the host resolves
    // a duplicate's permanent identity profile through its source recipe.
    studioPreview: studioPreview ?? null,
    studioPreviewFrame: studioPreviewFrame ? { ...studioPreviewFrame } : null,
    sourceRecipe: sourceRecipe ?? null,
    source,
    artwork: artwork ? {
      path: artwork.path,
      position: artwork.position,
      size: artwork.size,
      mobile: artwork.mobile,
    } : null,
  }));
  if (options.json) console.log(JSON.stringify(themes, null, 2));
  else for (const theme of themes) console.log(`${theme.name.padEnd(24)} ${theme.label} - ${theme.description}`);
} else if (command === "init") {
  if (!options.config) throw new Error("--config is required");
  const configPath = path.resolve(options.config);
  const existing = await readConfig(configPath);
  const compiled = await compileTheme({ configPath, config: existing, locale: options.locale ?? "en", ...runtimeOptions });
  const bundle = options.payload ? await buildPayloadFromCompiled(compiled) : null;
  await writeConfig(configPath, compiled.effectiveConfig);
  if (options.payload) process.stdout.write(bundle.payload);
  else console.log(configPath);
} else if (command === "show") {
  if (!options.config) throw new Error("--config is required");
  const compiled = await compileTheme({ configPath: options.config, locale: options.locale ?? "en", ...runtimeOptions });
  const result = {
    config: compiled.effectiveConfig,
    theme: { name: compiled.theme.name, label: compiled.theme.label, description: compiled.theme.description },
    image: compiled.image ? { path: compiled.image.path, bytes: compiled.image.bytes } : null,
    artwork: compiled.artwork ? { path: compiled.artwork.path, bytes: compiled.artwork.bytes } : null,
    fallbackFrom: compiled.settings.fallbackFrom,
    customThemeUnavailable: compiled.settings.customThemeUnavailable,
    digest: compiled.digest,
  };
  console.log(options.json ? JSON.stringify(result, null, 2) : `${result.theme.label} (${result.theme.name})\n${result.digest}`);
} else if (command === "validate") {
  if (positionals.length > 1) throw new Error("Usage: theme-cli validate <kit-folder>");
  if (positionals.length === 1) {
    if (options.theme || options.config) throw new Error("A kit folder cannot be combined with --theme or --config");
    const kit = await readThemeKit(path.resolve(positionals[0]));
    const payloads = await validateKitPayloads(kit);
    console.log(JSON.stringify({
      pass: true,
      theme: kit.id,
      source: "folder",
      sourceFolder: kit.sourceDirectory,
      metadata: kit.metadata,
      payloads,
    }));
    return;
  }
  const configPath = path.resolve(options.config ?? path.join(process.cwd(), "config.example.json"));
  let config;
  let expectedTheme = null;
  if (options.theme) {
    if (!THEME_ID_PATTERN.test(options.theme)) throw new Error("--theme must be a lowercase kebab-case id");
    const registry = await readThemeRegistry({ userThemesDir });
    expectedTheme = Object.hasOwn(registry.legacyAliases, options.theme)
      ? registry.legacyAliases[options.theme]
      : options.theme;
    const registered = registry.themes.some((theme) => theme.id === expectedTheme);
    const scaffoldPath = path.join(process.cwd(), "themes", `${options.theme}.json`);
    config = !registered && expectedTheme === options.theme && await pathExists(scaffoldPath)
      ? { ...DEFAULT_CONFIG, customTheme: scaffoldPath }
      : { ...DEFAULT_CONFIG, theme: options.theme };
  } else {
    config = await readConfig(configPath);
  }
  const compiled = await compileTheme({ configPath, config, locale: options.locale ?? "en", ...runtimeOptions });
  if (compiled.settings.customThemeUnavailable) throw new Error("The configured custom theme is unavailable or invalid");
  if (expectedTheme && compiled.theme.name !== expectedTheme) throw new Error(`Theme not found: ${options.theme}`);
  console.log(JSON.stringify({
    pass: true,
    theme: compiled.theme.name,
    fallbackFrom: compiled.settings.fallbackFrom,
    digest: compiled.digest,
    imageBytes: compiled.image?.bytes ?? 0,
    artworkBytes: compiled.artwork?.bytes ?? 0,
  }));
} else if (command === "set") {
  if (!options.config) throw new Error("--config is required");
  const configPath = path.resolve(options.config);
  const config = await readConfig(configPath);
  if (options.theme) {
    config.theme = options.theme;
    delete config.customTheme;
  }
  if (options.appearance !== undefined) {
    if (!["system", "light", "dark"].includes(options.appearance)) {
      throw new Error("--appearance must be system, light, or dark");
    }
    config.appearance = options.appearance;
  }
  if (options.image) config.image = path.resolve(options.image);
  if (options["clear-image"]) config.image = null;
  if (options.avatar) config.avatar = path.resolve(options.avatar);
  if (options["clear-avatar"]) config.avatar = null;
  if (options["image-opacity"] !== undefined) config.imageOpacity = Number(options["image-opacity"]);
  if (options["image-position"] !== undefined) config.imagePosition = options["image-position"];
  if (options["image-zoom"] !== undefined) config.imageZoom = Number(options["image-zoom"]);
  const studioPreviewKeys = ["studio-preview-theme", "studio-preview-x", "studio-preview-y", "studio-preview-zoom"];
  const suppliedStudioPreviewKeys = studioPreviewKeys.filter((key) => options[key] !== undefined);
  if (suppliedStudioPreviewKeys.length) {
    if (suppliedStudioPreviewKeys.length !== studioPreviewKeys.length) {
      throw new Error("Studio preview crop requires theme, x, y, and zoom");
    }
    const themeId = options["studio-preview-theme"];
    if (!/^[a-z][a-z0-9-]{1,39}$/.test(themeId)) throw new Error("Invalid Studio preview theme id");
    config.studioPreviewCrops = {
      ...(config.studioPreviewCrops && typeof config.studioPreviewCrops === "object" && !Array.isArray(config.studioPreviewCrops)
        ? config.studioPreviewCrops : {}),
      [themeId]: {
        x: Number(options["studio-preview-x"]),
        y: Number(options["studio-preview-y"]),
        zoom: Number(options["studio-preview-zoom"]),
      },
    };
  }
  if (options["reduce-motion"] !== undefined) config.reduceMotion = booleanValue(options["reduce-motion"], "--reduce-motion");
  if (options.enabled !== undefined) config.enabled = booleanValue(options.enabled, "--enabled");
  const compiled = await compileTheme({ configPath, config, locale: options.locale ?? "en", ...runtimeOptions });
  const bundle = options.payload ? await buildPayloadFromCompiled(compiled) : null;
  await writeConfig(configPath, compiled.effectiveConfig);
  if (options.payload) {
    process.stdout.write(bundle.payload);
  } else {
    console.log(JSON.stringify({ pass: true, theme: compiled.theme.name, digest: compiled.digest, configPath }));
  }
} else {
  throw new Error(`Unknown command: ${command}`);
}
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
