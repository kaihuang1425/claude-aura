// Extracted from theme-core.mjs. Public API is re-exported by scripts/theme-core.mjs.
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import {
  AURA_VERSION,
  DEFAULT_CONFIG,
  PROJECT_ROOT,
} from "./constants.mjs";
import {
  cloneJson,
  enforcePayloadBudget,
  finiteNumber,
  isPlainObject,
  normalizeLocale,
  payloadBudget,
  validateStudioPreviewCrops,
} from "./validation.mjs";
import {
  readConfig,
  readRegisteredTheme,
  readThemeKit,
  resolveImage,
  resolveTheme,
} from "./registry.mjs";
import {
  resolveArtwork,
  resolveArtworkLayers,
  resolveBrandWordmark,
} from "./artwork.mjs";

export function renderMode(selector, mode) {
  const declarations = Object.entries(mode.tokens).map(([name, value]) => `  ${name}: ${value} !important;`);
  declarations.push(`  --aura-wallpaper-gradient: ${mode.wallpaper.gradient};`);
  declarations.push(`  --aura-surface-alpha: ${mode.wallpaper.surfaceAlpha};`);
  declarations.push(`  --aura-sidebar-alpha: ${mode.wallpaper.sidebarAlpha};`);
  declarations.push(`  --aura-default-image-opacity: ${mode.wallpaper.imageOpacity};`);
  declarations.push(`  --aura-art-opacity: ${mode.wallpaper.artOpacity};`);
  declarations.push(`  --aura-texture-opacity: ${mode.wallpaper.textureOpacity};`);
  return `${selector} {\n${declarations.join("\n")}\n}`;
}

export function renderThemePrimitives(theme) {
  return `:root {
  --aura-radius: ${theme.shape.card}px;
  --aura-control-radius: ${theme.shape.control}px;
  --aura-card-radius: ${theme.shape.card}px;
  --aura-composer-radius: ${theme.shape.composer}px;
  --aura-icon-radius: ${theme.shape.icon}px;
  --aura-border-width: ${theme.shape.borderWidth}px;
  --aura-blur: ${theme.blur}px;
  --aura-font-ui: ${theme.typography.ui};
  --aura-font-display: ${theme.typography.display};
  --aura-font-body: ${theme.typography.body};
  --aura-font-mono: ${theme.typography.mono};
  --aura-display-weight: ${theme.typography.displayWeight};
  --aura-display-spacing: ${theme.typography.letterSpacing};
  --aura-shadow-soft: ${theme.effects.shadowSoft};
  --aura-shadow-elevated: ${theme.effects.shadowElevated};
  --aura-hover-lift: ${theme.effects.hoverLift}px;
  --aura-transition-duration: ${theme.effects.transitionMs}ms;
}`;
}

export function renderStudioRecipeOverrides(theme) {
  if (theme.source !== "user" || theme.sourceRecipe === null
      || !Array.isArray(theme.controlOverrides)) return "";
  const overrides = new Set(theme.controlOverrides);
  const declarations = [];
  if (overrides.has("radius")) {
    declarations.push("  --aura-variant-control-radius: var(--aura-control-radius);");
  }
  if (overrides.has("shadow")) {
    declarations.push("  --aura-variant-card-shadow: var(--aura-shadow-soft);");
  }
  return declarations.length ? `:root {\n${declarations.join("\n")}\n}` : "";
}

const RENDERER_IDENTIFIER_ALIASES = Object.freeze([
  ["settings", "_a"],
  ["visibleRect", "_b"],
  ["currentContext", "_c"],
  ["onContextSignal", "_d"],
  ["candidates", "_e"],
  ["mainRect", "_f"],
  ["controls", "_g"],
  ["classifyComposerControls", "_h"],
  ["clearPromptLayout", "_i"],
  ["interactiveElements", "_j"],
  ["applyArtworkContext", "_k"],
  ["syncSemanticLayout", "_l"],
  ["modalAncestor", "_m"],
  ["imageOpacityValue", "_n"],
  ["authoredTranslate", "_o"],
  ["forcedColors", "_p"],
  ["imageScaleValue", "_q"],
  ["commonToolbar", "_r"],
  ["imageCssValue", "_s"],
  ["artCssValue", "_t"],
  ["composerShellFor", "_u"],
  ["composerGroupFor", "_v"],
  ["discoverSidebarRoles", "_w"],
  ["discoverComposer", "_x"],
  ["discoverSidebar", "_y"],
  ["discoverMain", "_z"],
  ["onModeChange", "_A"],
  ["rootNeedsRepair", "_B"],
  ["scheduleEnsure", "_C"],
  ["observeTargets", "_D"],
  ["styleDirty", "_E"],
  ["rootDirty", "_F"],
  ["artBindings", "_G"],
  ["addLayerDiv", "_H"],
  ["frameImage", "_I"],
  ["contextKey", "_J"],
  ["backdropOwner", "_K"],
  ["observedHead", "_L"],
  ["observedBody", "_M"],
  ["observedStyle", "_N"],
  ["observedBackdrop", "_O"],
  ["PROMPT_MARKER", "_P"],
  ["SIDEBAR_MARKER", "_Q"],
  ["MAIN_MARKER", "_R"],
  ["MESSAGE_SELECTOR", "_S"],
  ["EDITOR_SELECTOR", "_T"],
  ["CONTROL_SELECTOR", "_U"],
  ["BACKDROP_ID", "_V"],
  ["STYLE_ID", "_W"],
  ["STATE_KEY", "_X"],
]);

export function compactRendererIdentifiers(source) {
  if (typeof source !== "string") throw new TypeError("Renderer template must be a string");
  return RENDERER_IDENTIFIER_ALIASES.reduce(
    (result, [identifier, alias]) => result.replace(
      new RegExp(`\\b${identifier}\\b`, "g"),
      alias,
    ),
    source,
  );
}

export function filterThemeVariantCss(source, themeId, variantId = themeId, includeBrandWordmark = true) {
  const filteredSource = includeBrandWordmark
    ? source
    : source.replace(
      /\/\* Shared in-page brand wordmark\. \*\/[\s\S]*?\/\* End shared in-page brand wordmark\. \*\//,
      "",
    );
  const mobileStart = filteredSource.indexOf("@media (max-width: 820px)");
  const motionStart = filteredSource.indexOf("@media (prefers-reduced-motion: no-preference)");
  const body = mobileStart < 0 ? filteredSource : filteredSource.slice(0, mobileStart);
  const mobile = mobileStart < 0 ? "" : filteredSource.slice(mobileStart, motionStart < 0 ? filteredSource.length : motionStart);
  const motion = motionStart < 0 || variantId !== "cartoon-studio" ? "" : filteredSource.slice(motionStart);
  const sectionPattern = /(?=\/\* (?:Japanese Film Editorial|Korean Prestige|Cartoon Studio|Anime Twilight|Study Library|Japanese Idol|Korean Idol):)/g;
  const sections = body.split(sectionPattern);
  const selector = `[data-claude-aura-theme="${variantId}"]`;
  const selected = `${[sections[0], ...sections.slice(1).filter((section) => section.includes(selector))].join("")}${mobile}${motion}`;
  return variantId === themeId
    ? selected
    : selected.replaceAll(selector, `[data-claude-aura-variant="${variantId}"]`);
}

export async function compileTheme({
  configPath,
  config: configOverride = null,
  locale = "en",
  userThemesDir = null,
  themeKitDirectory = null,
  onWarning = null,
} = {}) {
  const resolvedConfigPath = path.resolve(configPath ?? path.join(PROJECT_ROOT, "config.example.json"));
  const config = configOverride ? { ...DEFAULT_CONFIG, ...configOverride } : await readConfig(resolvedConfigPath);
  if (typeof config.enabled !== "boolean") throw new Error("enabled must be true or false");
  if (typeof config.reduceMotion !== "boolean") throw new Error("reduceMotion must be true or false");
  if (!["system", "light", "dark"].includes(config.appearance)) {
    throw new Error("appearance must be system, light, or dark");
  }
  if (typeof config.imagePosition !== "string" || !config.imagePosition.trim() ||
      config.imagePosition.length > 80 || /[;{}]/.test(config.imagePosition)) {
    throw new Error("imagePosition contains an unsupported value");
  }
  let themeResolution;
  if (themeKitDirectory !== null) {
    const kit = await readThemeKit(path.resolve(themeKitDirectory));
    const theme = await readRegisteredTheme(kit.entry, normalizeLocale(locale));
    themeResolution = {
      theme,
      filePath: kit.kitPath,
      requestedTheme: kit.id,
      fallbackFrom: null,
      customThemeUnavailable: false,
    };
  } else {
    themeResolution = await resolveTheme(
      config,
      resolvedConfigPath,
      normalizeLocale(locale),
      { userThemesDir, onWarning },
    );
  }
  const { theme, filePath: themePath, requestedTheme, fallbackFrom, customThemeUnavailable } = themeResolution;
  const [image, artwork, artworkLayers, brandWordmark, baseCss, allVariantCss] = await Promise.all([
    resolveImage(config, resolvedConfigPath),
    resolveArtwork(theme),
    resolveArtworkLayers(theme),
    resolveBrandWordmark(theme),
    fs.readFile(path.join(PROJECT_ROOT, "assets", "base.css"), "utf8"),
    fs.readFile(path.join(PROJECT_ROOT, "assets", "theme-variants.css"), "utf8"),
  ]);
  const variantCss = filterThemeVariantCss(allVariantCss, theme.name, theme.variant, Boolean(brandWordmark));
  const studioRecipeOverrides = renderStudioRecipeOverrides(theme);
  const imageOpacity = config.imageOpacity === null || config.imageOpacity === undefined
    ? null
    : finiteNumber(config.imageOpacity, "imageOpacity", 0, 0.55);
  if (typeof config.imageZoom !== "number") throw new Error("imageZoom must be a number");
  const imageZoom = finiteNumber(config.imageZoom, "imageZoom", 1, 2);
  const studioPreviewCrops = validateStudioPreviewCrops(config.studioPreviewCrops ?? {});
  const variableCss = [
    renderMode(':root:not([data-claude-aura-effective-mode="dark"])', theme.light),
    renderMode(':root[data-claude-aura-effective-mode="dark"]', theme.dark),
    renderThemePrimitives(theme),
  ].join("\n\n");
  const css = `${variableCss}\n\n${baseCss}\n\n${variantCss}${studioRecipeOverrides ? `\n${studioRecipeOverrides}\n` : ""}${theme.customCss ? `\n${theme.customCss}\n` : ""}`
    .replace(/^[ \t]+/gm, "");
  const settingsBase = {
    version: AURA_VERSION,
    theme: theme.name,
    variant: theme.variant,
    label: theme.label,
    requestedTheme,
    fallbackFrom,
    customThemeUnavailable,
    appearance: config.appearance,
    imageDataUrl: image?.dataUrl ?? null,
    imageAnimated: image?.animated ?? false,
    imageUnavailable: Boolean(config.image && !image),
    imageOpacity,
    imagePosition: config.imagePosition.trim(),
    imageZoom,
    artDataUrl: artwork?.dataUrl ?? null,
    artUnavailable: Boolean((theme.artwork && !artwork)
      || (Array.isArray(theme.artworkLayers) && theme.artworkLayers.length > 0 && !artworkLayers)),
    artPosition: artwork?.position ?? "right center",
    artSize: artwork?.size ?? "min(58vw, 860px) auto",
    artMobile: artwork?.mobile ?? "reduce",
    artLayers: artworkLayers
      ? artworkLayers.map((layer) => ({
        dataUrl: layer.dataUrl,
        position: layer.position ?? layer.legacy?.position,
        size: layer.size ?? layer.legacy?.size,
        mobile: layer.mobile,
        opacity: layer.opacity,
        mask: layer.mask,
        role: layer.role,
        ...(layer.appearance ? { appearance: layer.appearance } : {}),
        contextOverrides: layer.contextOverrides ?? layer.legacy?.contextOverrides ?? null,
        ...(layer.id ? {
          id: layer.id,
          context: layer.context,
          viewport: layer.viewport,
          visible: layer.visible,
          frames: cloneJson(layer.frames),
          legacy: Boolean(layer.legacy),
        } : {}),
      }))
      : null,
    brandWordmark: brandWordmark
      ? {
        lightDataUrl: brandWordmark.lightDataUrl,
        darkDataUrl: brandWordmark.darkDataUrl,
        minWidth: brandWordmark.minWidth,
        width: brandWordmark.width,
      }
      : null,
    backgroundScope: theme.backgroundScope ?? "full-window",
    newChatLayout: theme.newChatLayout ? { ...theme.newChatLayout } : null,
    reduceMotion: config.reduceMotion,
  };
  const digest = crypto.createHash("sha256")
    .update(css)
    .update("\0")
    .update(JSON.stringify(settingsBase))
    .digest("hex");
  const effectiveConfig = {
    ...config,
    theme: theme.name,
    appearance: config.appearance,
    imagePosition: config.imagePosition.trim(),
    imageZoom,
    studioPreviewCrops,
  };
  if (customThemeUnavailable) delete effectiveConfig.customTheme;
  return {
    config,
    effectiveConfig,
    configPath: resolvedConfigPath,
    theme,
    themePath,
    image,
    artwork,
    artworkLayers,
    brandWordmark,
    css,
    settings: { ...settingsBase, digest },
    digest,
  };
}

export async function buildPayloadFromCompiled(compiled, { enforceBudget = true } = {}) {
  if (!compiled || typeof compiled.css !== "string" || !isPlainObject(compiled.settings)) {
    throw new Error("A compiled theme is required to build a renderer payload");
  }
  const template = compactRendererIdentifiers(
    await fs.readFile(path.join(PROJECT_ROOT, "assets", "renderer-inject.js"), "utf8"),
  )
    .replace(/^[ \t]+/gm, "")
    .replace(/\r?\n/g, "");
  const runtimeSettings = { ...compiled.settings };
  for (const diagnosticKey of [
    "label",
    "requestedTheme",
    "fallbackFrom",
    "customThemeUnavailable",
    "imageUnavailable",
    "artUnavailable",
  ]) delete runtimeSettings[diagnosticKey];
  runtimeSettings.q = runtimeSettings.backgroundScope === "full-window" ? "f" : "c";
  delete runtimeSettings.backgroundScope;
  if (runtimeSettings.brandWordmark) {
    const wordmark = runtimeSettings.brandWordmark;
    runtimeSettings.b = [
      wordmark.lightDataUrl,
      wordmark.darkDataUrl,
      wordmark.minWidth,
      wordmark.width,
    ];
    delete runtimeSettings.brandWordmark;
  }
  if (Array.isArray(runtimeSettings.artLayers)) {
    const contextKeys = { "new-chat": "n", conversation: "c", other: "o" };
    const anchorKeys = {
      "top-left": "tl", top: "t", "top-right": "tr", left: "l", center: "c", right: "r",
      "bottom-left": "bl", bottom: "b", "bottom-right": "br",
    };
    const urls = [];
    const urlIndexes = new Map();
    runtimeSettings.artLayers = runtimeSettings.artLayers.map((layer) => {
      let dataIndex = urlIndexes.get(layer.dataUrl);
      if (dataIndex === undefined) {
        dataIndex = urls.length;
        urls.push(layer.dataUrl);
        urlIndexes.set(layer.dataUrl, dataIndex);
      }
      const compact = { d: dataIndex };
      if (layer.position !== undefined) compact.p = layer.position;
      if (layer.size !== undefined) compact.s = layer.size;
      if (layer.mobile !== "reduce") compact.m = layer.mobile[0];
      if (layer.opacity !== null) compact.o = layer.opacity;
      if (layer.mask === "none") compact.k = "n";
      if (layer.role !== "decoration") compact.r = layer.role[0];
      if (layer.appearance && layer.appearance !== "all") compact.a = layer.appearance[0];
      if (layer.contextOverrides) {
        compact.c = {};
        for (const [context, override] of Object.entries(layer.contextOverrides)) {
          const value = {};
          if (override.position !== undefined) value.p = override.position;
          if (override.size !== undefined) value.s = override.size;
          if (override.opacity !== undefined) value.o = override.opacity;
          if (override.hidden !== undefined) value.h = override.hidden;
          compact.c[contextKeys[context]] = value;
        }
      }
      if (layer.id) {
        compact.i = layer.id;
        if (layer.context !== "all") compact.t = layer.context[0];
        if (layer.viewport !== "all") compact.v = layer.viewport[0];
        if (!layer.legacy) {
          if (layer.frames.normal.anchor !== "center") compact.h = anchorKeys[layer.frames.normal.anchor];
          if (layer.frames.wide.anchor !== layer.frames.normal.anchor) compact.z = anchorKeys[layer.frames.wide.anchor];
          compact.n = [
            layer.frames.normal.positionX,
            layer.frames.normal.positionY,
            layer.frames.normal.focalX,
            layer.frames.normal.focalY,
            layer.frames.normal.scale,
          ];
          const wide = [
            layer.frames.wide.positionX,
            layer.frames.wide.positionY,
            layer.frames.wide.focalX,
            layer.frames.wide.focalY,
            layer.frames.wide.scale,
          ];
          if (wide.some((value, index) => value !== compact.n[index])) compact.w = wide;
        }
        if (!layer.visible) compact.x = 0;
      }
      return compact;
    });
    runtimeSettings.u = urls;
  }
  if (runtimeSettings.newChatLayout) {
    const layout = runtimeSettings.newChatLayout;
    runtimeSettings.n = [layout.widthRatio, layout.offsetXRatio, layout.offsetYRatio];
    delete runtimeSettings.newChatLayout;
  }
  let compactCss = "";
  let quote = null;
  let escaped = false;
  let pendingSpace = false;
  const punctuation = "{};,>";
  const spaceSuppressingPrevious = "{}:;,>";
  const blockKinds = [];
  let blockBoundary = 0;
  for (let index = 0; index < compiled.css.length; index += 1) {
    const character = compiled.css[index];
    if (quote) {
      compactCss += character;
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === quote) quote = null;
      continue;
    }
    if (character === "/" && compiled.css[index + 1] === "*") {
      const commentEnd = compiled.css.indexOf("*/", index + 2);
      index = commentEnd < 0 ? compiled.css.length : commentEnd + 1;
      continue;
    }
    if (character === '"' || character === "'") {
      if (pendingSpace && compactCss && !spaceSuppressingPrevious.includes(compactCss.at(-1))) compactCss += " ";
      pendingSpace = false;
      quote = character;
      compactCss += character;
      continue;
    }
    if (/\s/.test(character)) {
      pendingSpace = true;
      continue;
    }
    if (character === ":") {
      if (blockKinds.at(-1) === "declarations") {
        if (compactCss.endsWith(" ")) compactCss = compactCss.slice(0, -1);
      } else if (pendingSpace && compactCss && !spaceSuppressingPrevious.includes(compactCss.at(-1))) {
        compactCss += " ";
      }
      compactCss += character;
      pendingSpace = false;
      continue;
    }
    if (punctuation.includes(character)) {
      if (compactCss.endsWith(" ")) compactCss = compactCss.slice(0, -1);
      if (character === "}" && compactCss.endsWith(";")) compactCss = compactCss.slice(0, -1);
      if (character === "{") {
        const header = compactCss.slice(blockBoundary).trim();
        blockKinds.push(/^@(media|supports|container|layer|document|scope|(?:-webkit-)?keyframes)\b/i.test(header)
          ? "container"
          : "declarations");
      }
      compactCss += character;
      if (character === "}") blockKinds.pop();
      if (character === "{" || character === "}") blockBoundary = compactCss.length;
      pendingSpace = false;
      continue;
    }
    if (pendingSpace && compactCss && !spaceSuppressingPrevious.includes(compactCss.at(-1))) compactCss += " ";
    pendingSpace = false;
    compactCss += character;
  }
  compactCss = compactCss.trim();
  const payload = template
    .replace("__AURA_CSS_JSON__", JSON.stringify(compactCss))
    .replace("__AURA_SETTINGS_JSON__", JSON.stringify(runtimeSettings));
  if (payload.includes("__AURA_CSS_JSON__") || payload.includes("__AURA_SETTINGS_JSON__")) {
    throw new Error("Renderer payload placeholders were not fully replaced");
  }
  const measuredBudget = enforceBudget
    ? enforcePayloadBudget(payload, compiled.settings, `${compiled.theme?.name ?? "Theme"} payload`)
    : payloadBudget(payload, compiled.settings);
  return { ...compiled, payload, payloadBudget: measuredBudget };
}

export async function buildPayload(options = {}) {
  return buildPayloadFromCompiled(await compileTheme(options));
}
