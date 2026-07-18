#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import {
  buildPayloadFromCompiled,
  compileTheme,
  DEFAULT_CONFIG,
  listThemes,
  normalizeLocale,
  PROJECT_ROOT,
  readConfig,
  readThemeRegistry,
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
  ["brand-mark", "optional, small, flat; restyles the starburst identity"],
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
    if (["json", "clear-image", "payload"].includes(key)) options[key] = true;
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
placeholder images. PNGs in this folder are source inputs, never runtime
backgrounds.

Before pasting the registry snippet, replace its labels and descriptions with
independently written en, zh-CN, and zh-TW theme copy.
`;
}

function registrySnippet(id, defaultEntry) {
  const title = titleFromId(id);
  return {
    id,
    labels: {
      en: title,
      "zh-CN": `自定义主题（${id}）`,
      "zh-TW": `自訂主題（${id}）`,
    },
    descriptions: {
      en: "A custom theme scaffolded from Claude Aura's default tokens.",
      "zh-CN": "基于 Claude Aura 默认变量创建的自定义主题。",
      "zh-TW": "以 Claude Aura 預設樣式變數建立的自訂主題。",
    },
    swatches: [...defaultEntry.swatches],
    preview: { ...defaultEntry.preview },
    artwork: null,
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
  const snippetBytes = `${JSON.stringify(registrySnippet(id, defaultEntry), null, 2)}\n`;
  let themeCreated = false;
  let kitCreated = false;
  let checklistCreated = false;
  try {
    await fs.mkdir(themesDirectory, { recursive: true });
    await fs.writeFile(themePath, themeBytes, { encoding: "utf8", flag: "wx" });
    themeCreated = true;
    await fs.mkdir(kitDirectory);
    kitCreated = true;
    await fs.writeFile(path.join(kitDirectory, "CHECKLIST.md"), checklistBytes, { encoding: "utf8", flag: "wx" });
    checklistCreated = true;
  } catch (error) {
    if (checklistCreated) await fs.rm(path.join(kitDirectory, "CHECKLIST.md"), { force: true });
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

function help() {
  console.log(`Claude Aura theme tool

Commands:
  list [--json] [--locale en|zh-CN|zh-TW]
  scaffold <id>
  init --config <path> [--locale en|zh-CN|zh-TW] [--payload]
  show --config <path> [--json] [--locale en|zh-CN|zh-TW]
  validate [--config <path>] [--theme <name>] [--locale en|zh-CN|zh-TW]
  set --config <path> [--theme <name>] [--image <path>|--clear-image]
      [--image-opacity <0..0.55>] [--image-position <css-position>] [--image-zoom <1..2>]
      [--studio-preview-theme <id> --studio-preview-x <0..100>
       --studio-preview-y <0..100> --studio-preview-zoom <1..2>]
      [--reduce-motion true|false] [--enabled true|false] [--payload]
`);
}

const { command, options, positionals } = parse(process.argv.slice(2));
if (command !== "scaffold" && positionals.length) throw new Error(`Unexpected argument: ${positionals[0]}`);
if (command === "help" || command === "--help") {
  help();
} else if (command === "scaffold") {
  if (positionals.length !== 1 || Object.keys(options).length) {
    throw new Error("Usage: theme-cli scaffold <id>");
  }
  await scaffold(positionals[0]);
} else if (command === "list") {
  const locale = normalizeLocale(options.locale ?? "en");
  const themes = (await listThemes({ locale })).map(({
    name,
    label,
    description,
    labels,
    descriptions,
    swatches,
    preview,
    artwork,
  }) => ({
    name,
    label,
    description,
    labels,
    descriptions,
    swatches,
    preview,
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
  const compiled = await compileTheme({ configPath, config: existing, locale: options.locale ?? "en" });
  const bundle = options.payload ? await buildPayloadFromCompiled(compiled) : null;
  await writeConfig(configPath, compiled.effectiveConfig);
  if (options.payload) process.stdout.write(bundle.payload);
  else console.log(configPath);
} else if (command === "show") {
  if (!options.config) throw new Error("--config is required");
  const compiled = await compileTheme({ configPath: options.config, locale: options.locale ?? "en" });
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
  const configPath = path.resolve(options.config ?? path.join(process.cwd(), "config.example.json"));
  let config;
  let expectedTheme = null;
  if (options.theme) {
    if (!THEME_ID_PATTERN.test(options.theme)) throw new Error("--theme must be a lowercase kebab-case id");
    const registry = await readThemeRegistry();
    expectedTheme = registry.legacyAliases[options.theme] ?? options.theme;
    const registered = registry.themes.some((theme) => theme.id === expectedTheme);
    const scaffoldPath = path.join(process.cwd(), "themes", `${options.theme}.json`);
    config = !registered && expectedTheme === options.theme && await pathExists(scaffoldPath)
      ? { ...DEFAULT_CONFIG, customTheme: scaffoldPath }
      : { ...DEFAULT_CONFIG, theme: options.theme };
  } else {
    config = await readConfig(configPath);
  }
  const compiled = await compileTheme({ configPath, config, locale: options.locale ?? "en" });
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
  if (options.image) config.image = path.resolve(options.image);
  if (options["clear-image"]) config.image = null;
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
  const compiled = await compileTheme({ configPath, config, locale: options.locale ?? "en" });
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
