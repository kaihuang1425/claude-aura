#!/usr/bin/env node
import path from "node:path";
import { buildPayloadFromCompiled, compileTheme, DEFAULT_CONFIG, listThemes, normalizeLocale, readConfig, writeConfig } from "./theme-core.mjs";

function parse(argv) {
  const command = argv.shift() ?? "help";
  const options = {};
  while (argv.length) {
    const arg = argv.shift();
    if (!arg.startsWith("--")) throw new Error(`Unexpected argument: ${arg}`);
    const key = arg.slice(2);
    if (["json", "clear-image", "payload"].includes(key)) options[key] = true;
    else {
      if (!argv.length) throw new Error(`Missing value for ${arg}`);
      options[key] = argv.shift();
    }
  }
  return { command, options };
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

const { command, options } = parse(process.argv.slice(2));
if (command === "help" || command === "--help") {
  help();
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
  const config = options.theme ? { ...DEFAULT_CONFIG, theme: options.theme } : await readConfig(configPath);
  const compiled = await compileTheme({ configPath, config, locale: options.locale ?? "en" });
  if (compiled.settings.customThemeUnavailable) throw new Error("The configured custom theme is unavailable or invalid");
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
