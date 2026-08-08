// Extracted from theme-core.mjs. Public API is re-exported by scripts/theme-core.mjs.
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import {
  AURA_VERSION,
  BUILTIN_GREETING_MARK_ASSETS,
  DEFAULT_CONFIG,
  INSTANT_PROMPT_RUNTIME_TEXT_MAX_BYTES,
  PROJECT_ROOT,
  STUDIO_FONT_DISPLAY_STACKS,
} from "./constants.mjs";
import {
  cloneJson,
  detectImageMime,
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
  resolveAvatar,
  resolveImage,
  resolvePersonalWordmark,
  resolveTheme,
} from "./registry.mjs";
import {
  resolveArtwork,
  resolveArtworkLayers,
  resolveBrandWordmark,
} from "./artwork.mjs";
import { resolveGreetingRuntime } from "./greeting.mjs";
import {
  codeContextFromUrl,
  createInertCodeAdapter,
} from "./code-adapter.mjs";
import { createInstantPromptController } from "./instant-prompts.mjs";
import {
  promptFrameOverrides,
  renderInterfaceSurfacesCss,
} from "./surface-overrides.mjs";
import { createResponsiveResolver } from "./responsive-layouts.mjs";

// Marks the strippable WO-21 greeting subsystem inside the renderer template, and the
// nested custom-phrases sub-block that native-greeting-only themes do not need.
const AVATAR_BLOCK_PATTERN = /\/\*__AURA_AVATAR_START__\*\/[\s\S]*?\/\*__AURA_AVATAR_END__\*\//;
// CSS for the personal avatar overlay. Appended to the compiled sheet only when
// an avatar is configured (kept out of base.css so avatar-free payloads pay
// nothing). The renderer sets each overlay's box geometry inline; these rules
// give it a containing block and reveal it only after the image decodes.
const AVATAR_OVERLAY_CSS = [
  'html.claude-aura [data-claude-aura-avatar-flow="true"]{position:relative!important}',
  "html.claude-aura [data-claude-aura-avatar]{position:absolute;object-fit:cover;pointer-events:none!important;z-index:2;display:block;visibility:hidden}",
  'html.claude-aura [data-claude-aura-avatar-host="ready"] [data-claude-aura-avatar]{visibility:visible}',
].join("\n");
const GREETING_BLOCK_PATTERN = /\/\*__AURA_GREETING_START__\*\/[\s\S]*?\/\*__AURA_GREETING_END__\*\//;
const GREETING_PHRASES_PATTERN = /\/\*__AURA_GREETING_PHRASES_START__\*\/[\s\S]*?\/\*__AURA_GREETING_PHRASES_END__\*\//;
const CODE_ADAPTER_ACTIVE_PATTERN = /\/\*__AURA_CODE_ACTIVE_START__\*\/[\s\S]*?\/\*__AURA_CODE_ACTIVE_END__\*\//g;
const PERSONAL_WORDMARK_PATTERN = /\/\*__AURA_PERSONAL_WORDMARK_START__\*\/[\s\S]*?\/\*__AURA_PERSONAL_WORDMARK_END__\*\//g;
const BUILTIN_WORDMARK_PATTERN = /\/\*__AURA_BUILTIN_WORDMARK_START__\*\/[\s\S]*?\/\*__AURA_BUILTIN_WORDMARK_END__\*\//g;
const WORDMARK_MARKER_PATTERN = /\/\*__AURA_(?:PERSONAL|BUILTIN)_WORDMARK_(?:START|END)__\*\//g;
const INSTANT_PROMPTS_BLOCK_PATTERN = /\/\*__AURA_INSTANT_PROMPTS_START__\*\/[\s\S]*?\/\*__AURA_INSTANT_PROMPTS_END__\*\//g;
const INSTANT_PROMPTS_CSS_PATTERN = /\/\*__AURA_INSTANT_PROMPTS_CSS_START__\*\/[\s\S]*?\/\*__AURA_INSTANT_PROMPTS_CSS_END__\*\//;
const RESPONSIVE_BLOCK_PATTERN = /\/\*__AURA_RESPONSIVE_START__\*\/[\s\S]*?\/\*__AURA_RESPONSIVE_END__\*\//g;

const WALLPAPER_VARIABLES = Object.freeze({
  gradient: "--aura-wallpaper-gradient",
  surfaceAlpha: "--aura-surface-alpha",
  sidebarAlpha: "--aura-sidebar-alpha",
  imageOpacity: "--aura-default-image-opacity",
  artOpacity: "--aura-art-opacity",
  textureOpacity: "--aura-texture-opacity",
});

export function renderMode(selector, mode, {
  omitTokens = new Set(),
  omitWallpaper = new Set(),
} = {}) {
  const declarations = Object.entries(mode.tokens)
    .filter(([name]) => !omitTokens.has(name))
    .map(([name, value]) =>
      `  ${name}: ${value}${name.startsWith("--aura-") ? "" : " !important"};`);
  for (const [property, variable] of Object.entries(WALLPAPER_VARIABLES)) {
    if (!omitWallpaper.has(property)) {
      declarations.push(`  ${variable}: ${mode.wallpaper[property]};`);
    }
  }
  return `${selector} {\n${declarations.join("\n")}\n}`;
}

function renderThemeModes(theme) {
  const commonTokens = new Set(Object.keys(theme.light.tokens)
    .filter((name) => theme.light.tokens[name] === theme.dark.tokens[name]));
  const commonWallpaper = new Set(Object.keys(WALLPAPER_VARIABLES)
    .filter((name) => theme.light.wallpaper[name] === theme.dark.wallpaper[name]));
  const commonDeclarations = [
    ...[...commonTokens].map((name) =>
      `  ${name}: ${theme.light.tokens[name]} !important;`),
    ...[...commonWallpaper].map((name) =>
      `  ${WALLPAPER_VARIABLES[name]}: ${theme.light.wallpaper[name]};`),
  ];
  return [
    commonDeclarations.length ? `:root {\n${commonDeclarations.join("\n")}\n}` : "",
    renderMode(':root:not([data-claude-aura-effective-mode="dark"])', theme.light, {
      omitTokens: commonTokens,
      omitWallpaper: commonWallpaper,
    }),
    renderMode(':root[data-claude-aura-effective-mode="dark"]', theme.dark, {
      omitTokens: commonTokens,
      omitWallpaper: commonWallpaper,
    }),
  ].filter(Boolean).join("\n\n");
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

// WO-21: emit a theme's greeting presentation as CSS keyed on the Aura greeting node.
// The renderer only marks the node; styling rides the theme's own font/colour tokens
// so it costs far fewer payload bytes than shipping the style object + JS applier.
function greetingFrameDeclarations(frame) {
  const font = STUDIO_FONT_DISPLAY_STACKS[frame.font];
  const color = frame.color === "accent" ? "hsl(var(--aura-accent-primary))" : "hsl(var(--aura-text-primary))";
  const declarations = new Map([
    ["font-family", font],
    ["color", color],
    ["font-size", `${frame.fontSize}px`],
    ["font-weight", String(frame.weight)],
    ["font-style", frame.italic ? "italic" : "normal"],
    ["letter-spacing", `${frame.letterSpacing}em`],
    ["line-height", String(frame.lineHeight)],
    ["text-align", frame.align],
    ["--aura-greeting-max-ratio", String(frame.maxWidthRatio)],
    ["--aura-greeting-x", String(frame.xRatio)],
    ["--aura-greeting-y", String(frame.yRatio)],
    ["--aura-greeting-native-opacity", frame.mark.source === "native" ? "1" : "0"],
    ["--aura-greeting-compact-opacity", frame.mark.source === "compact" ? "1" : "0"],
    ["--aura-greeting-mark-scale", String(frame.mark.scale)],
    ["text-decoration", frame.decoration === "underline" ? "underline" : "none"],
    ["border-bottom", frame.decoration === "hairline" ? "1px solid currentColor" : "0"],
    ["text-shadow", frame.decoration === "glow"
      ? "0 0 18px hsl(var(--aura-accent-primary)/.35)"
      : "none"],
  ]);
  return declarations;
}

function greetingDeclarationDiff(frame, inherited = null) {
  const declarations = greetingFrameDeclarations(frame);
  return [...declarations]
    .filter(([property, value]) => !inherited || inherited.get(property) !== value)
    .map(([property, value]) => `${property}:${value}`)
    .join(";");
}

function responsiveGreetingBaseDeclarations(base) {
  const color = base.color === "accent" ? "hsl(var(--aura-accent-primary))" : "hsl(var(--aura-text-primary))";
  return new Map([
    ["font-family", STUDIO_FONT_DISPLAY_STACKS[base.font]],
    ["color", color],
    ["font-size", "var(--aura-responsive-greeting-font-size,34px)"],
    ["font-weight", String(base.weight)],
    ["font-style", base.italic ? "italic" : "normal"],
    ["letter-spacing", `${base.letterSpacing}em`],
    ["line-height", "var(--aura-responsive-greeting-line-height,1.15)"],
    ["text-align", base.align],
    ["--aura-greeting-max-ratio", "var(--aura-responsive-greeting-max-ratio,.72)"],
    ["--aura-greeting-x", "var(--aura-responsive-greeting-x,0)"],
    ["--aura-greeting-y", "var(--aura-responsive-greeting-y,0)"],
    ["--aura-greeting-native-opacity", base.markSource === "native" ? "1" : "0"],
    ["--aura-greeting-compact-opacity", base.markSource === "compact" ? "1" : "0"],
    ["--aura-greeting-mark-scale", "var(--aura-responsive-greeting-mark-scale,1)"],
    ["text-decoration", base.decoration === "underline" ? "underline" : "none"],
    ["border-bottom", base.decoration === "hairline" ? "1px solid currentColor" : "0"],
    ["text-shadow", base.decoration === "glow"
      ? "0 0 18px hsl(var(--aura-accent-primary)/.35)"
      : "none"],
  ]);
}

export function renderGreetingCss(style, responsiveLayouts = null) {
  if (!style) return "";
  const node = "[data-claude-aura-greeting]";
  const dark = ':root[data-claude-aura-effective-mode="dark"] ';
  if (responsiveLayouts) {
    const light = responsiveGreetingBaseDeclarations(style.light.base);
    const darkFrame = responsiveGreetingBaseDeclarations(style.dark.base);
    const rules = [
      `${node}{pointer-events:none;min-width:0;box-sizing:border-box;white-space:normal;overflow-wrap:anywhere;${[...light].map(([property, value]) => `${property}:${value}`).join(";")}}`,
    ];
    const darkDiff = [...darkFrame]
      .filter(([property, value]) => light.get(property) !== value)
      .map(([property, value]) => `${property}:${value}`).join(";");
    if (darkDiff) rules.push(`${dark}${node}{${darkDiff}}`);
    rules.push(
      `${node}[data-claude-aura-greeting="decoration"],${node}[data-claude-aura-greeting="native-mark"]{border:0;text-decoration:none;text-shadow:none}`,
      `${node} [data-claude-aura-greeting-mark="native"]{opacity:var(--aura-greeting-native-opacity);transform:scale(var(--aura-greeting-mark-scale));transform-origin:50% 50%}`,
      `${node} [data-claude-aura-greeting-mark="compact"]{opacity:var(--aura-greeting-compact-opacity);transform:scale(var(--aura-greeting-mark-scale));transform-origin:50% 50%}`,
      `@media(forced-colors:active){${node}{text-shadow:none;border-bottom:0}}`,
    );
    return rules.join("\n");
  }
  const wide = ':root[data-claude-aura-viewport="wide"] ';
  const both = ':root[data-claude-aura-effective-mode="dark"][data-claude-aura-viewport="wide"] ';
  const base = greetingFrameDeclarations(style.light.standard);
  const darkStandard = greetingFrameDeclarations(style.dark.standard);
  const lightWide = greetingFrameDeclarations(style.light.wide);
  const effectiveDarkWide = new Map(base);
  for (const [property, value] of darkStandard) {
    if (value !== base.get(property)) effectiveDarkWide.set(property, value);
  }
  for (const [property, value] of lightWide) {
    if (value !== base.get(property)) effectiveDarkWide.set(property, value);
  }
  const rules = [
    `${node}{pointer-events:none;min-width:0;box-sizing:border-box;white-space:normal;overflow-wrap:anywhere;${[...base].map(([property, value]) => `${property}:${value}`).join(";")}}`,
  ];
  const darkDiff = greetingDeclarationDiff(style.dark.standard, base);
  const wideDiff = greetingDeclarationDiff(style.light.wide, base);
  const bothDiff = greetingDeclarationDiff(style.dark.wide, effectiveDarkWide);
  if (darkDiff) rules.push(`${dark}${node}{${darkDiff}}`);
  if (wideDiff) rules.push(`${wide}${node}{${wideDiff}}`);
  if (bothDiff) rules.push(`${both}${node}{${bothDiff}}`);
  rules.push(
    `${node}[data-claude-aura-greeting="decoration"],${node}[data-claude-aura-greeting="native-mark"]{border:0;text-decoration:none;text-shadow:none}`,
    `${node} [data-claude-aura-greeting-mark="native"]{opacity:var(--aura-greeting-native-opacity);transform:scale(var(--aura-greeting-mark-scale));transform-origin:50% 50%}`,
    `${node} [data-claude-aura-greeting-mark="compact"]{opacity:var(--aura-greeting-compact-opacity);transform:scale(var(--aura-greeting-mark-scale));transform-origin:50% 50%}`,
    `@media(forced-colors:active){${node}{text-shadow:none;border-bottom:0}}`,
  );
  return rules.join("\n");
}

const RUNTIME_SETTING_ALIASES = Object.freeze([
  ["version", "v"],
  ["theme", "t"],
  ["variant", "r"],
  ["appearance", "a"],
  ["imageDataUrl", "i"],
  ["imageAnimated", "j"],
  ["imageOpacity", "o"],
  ["imagePosition", "p"],
  ["imageZoom", "z"],
  ["artDataUrl", "d"],
  ["artPosition", "e"],
  ["artSize", "f"],
  ["artMobile", "l"],
  ["artLayers", "y"],
  ["reduceMotion", "h"],
  ["digest", "x"],
  ["avatarDataUrl", "A"],
]);

const RENDERER_CSS_SENTINEL_START = 0x0100;
const RENDERER_CSS_DICTIONARY_LIMIT = 512;
const RENDERER_CSS_CACHE_LIMIT = 24;
const rendererCssCompressionCache = new Map();

function rememberRendererCssCompression(source, result) {
  if (rendererCssCompressionCache.size >= RENDERER_CSS_CACHE_LIMIT) {
    rendererCssCompressionCache.delete(rendererCssCompressionCache.keys().next().value);
  }
  const remembered = Object.freeze(result.compressed
    ? { ...result, dictionary: Object.freeze(result.dictionary) }
    : result);
  rendererCssCompressionCache.set(source, remembered);
  return remembered;
}

function rendererCssTokens(source) {
  const tokens = [];
  for (let index = 0; index < source.length;) {
    const character = source[index];
    if (character === '"' || character === "'") {
      let end = index + 1;
      while (end < source.length) {
        if (source[end] === "\\") {
          end += 2;
        } else if (source[end] === character) {
          end += 1;
          break;
        } else {
          end += 1;
        }
      }
      tokens.push(source.slice(index, end));
      index = end;
      continue;
    }
    const word = /^[A-Za-z0-9_#.%\-]+/.exec(source.slice(index));
    if (word) {
      tokens.push(word[0]);
      index += word[0].length;
      continue;
    }
    tokens.push(character);
    index += 1;
  }
  return tokens;
}

function rendererCssJsonContentBytes(value) {
  return Buffer.byteLength(JSON.stringify(value), "utf8") - 2;
}

export function compressRendererCss(source) {
  if (typeof source !== "string") throw new TypeError("Renderer CSS must be a string");
  const cached = rendererCssCompressionCache.get(source);
  if (cached) return cached;
  const sentinelEnd = RENDERER_CSS_SENTINEL_START + RENDERER_CSS_DICTIONARY_LIMIT;
  if (source.includes("\u0000") || [...source].some((character) => {
    const code = character.charCodeAt(0);
    return code >= RENDERER_CSS_SENTINEL_START && code < sentinelEnd;
  })) {
    return rememberRendererCssCompression(source, { css: source, compressed: false });
  }
  let tokens = rendererCssTokens(source);
  const dictionary = [];
  while (dictionary.length < RENDERER_CSS_DICTIONARY_LIMIT) {
    const pairs = new Map();
    for (let index = 0; index + 1 < tokens.length; index += 1) {
      const key = `${tokens[index]}\u0000${tokens[index + 1]}`;
      pairs.set(key, (pairs.get(key) ?? 0) + 1);
    }
    let best = null;
    for (const [key, rawCount] of pairs) {
      const separator = key.indexOf("\u0000");
      const left = key.slice(0, separator);
      const right = key.slice(separator + 1);
      const count = left === right ? Math.floor(rawCount / 2) : rawCount;
      if (count < 2) continue;
      const entry = left + right;
      const sentinel = String.fromCharCode(RENDERER_CSS_SENTINEL_START + dictionary.length);
      const gain = count * (
        rendererCssJsonContentBytes(entry) - rendererCssJsonContentBytes(sentinel)
      ) - Buffer.byteLength(JSON.stringify(entry), "utf8") - 1;
      if (gain > 0 && (!best || gain > best.gain || (gain === best.gain && key < best.key))) {
        best = { entry, gain, key, left, right, sentinel };
      }
    }
    if (!best) break;
    const next = [];
    for (let index = 0; index < tokens.length;) {
      if (index + 1 < tokens.length
          && tokens[index] === best.left
          && tokens[index + 1] === best.right) {
        next.push(best.sentinel);
        index += 2;
      } else {
        next.push(tokens[index]);
        index += 1;
      }
    }
    tokens = next;
    dictionary.push(best.entry);
  }
  const css = tokens.join("");
  const compressedBytes = Buffer.byteLength(JSON.stringify(css), "utf8")
    + Buffer.byteLength(JSON.stringify(dictionary), "utf8") + 5;
  if (dictionary.length === 0 || compressedBytes >= Buffer.byteLength(JSON.stringify(source), "utf8")) {
    return rememberRendererCssCompression(source, { css: source, compressed: false });
  }
  return rememberRendererCssCompression(source, { css, compressed: true, dictionary });
}

export function expandRendererCss(source, dictionary = []) {
  if (typeof source !== "string") throw new TypeError("Renderer CSS must be a string");
  if (!Array.isArray(dictionary) || dictionary.some((entry) => typeof entry !== "string")) {
    throw new TypeError("Renderer CSS dictionary must be an array of strings");
  }
  let css = source;
  for (let index = dictionary.length - 1; index >= 0; index -= 1) {
    css = css.replaceAll(String.fromCharCode(RENDERER_CSS_SENTINEL_START + index), dictionary[index]);
  }
  return css;
}

function greetingUsesCompactMark(style) {
  return Boolean(style && ["light", "dark"].some((appearance) => (
    style[appearance]?.base
      ? style[appearance].base.markSource === "compact"
      : ["standard", "wide"].some((viewport) =>
        style[appearance][viewport].mark.source === "compact")
  )));
}

export function hasRegisteredGreetingCompactMark(theme) {
  const recipeId = theme?.sourceRecipe || theme?.variant || theme?.name;
  return typeof recipeId === "string" && Object.hasOwn(BUILTIN_GREETING_MARK_ASSETS, recipeId);
}

export async function resolveGreetingCompactMark(theme) {
  if (!greetingUsesCompactMark(theme.newChatGreetingStyle)) return null;
  const recipeId = theme.sourceRecipe || theme.variant || theme.name;
  if (!hasRegisteredGreetingCompactMark(theme)) {
    throw new Error(
      `${theme.name} greeting requests a compact mark without an approved registered asset`,
    );
  }
  const relativePath = BUILTIN_GREETING_MARK_ASSETS[recipeId];
  const bytes = await fs.readFile(path.join(PROJECT_ROOT, relativePath));
  const extension = path.extname(relativePath).toLowerCase();
  const mime = extension === ".svg" ? "image/svg+xml" : detectImageMime(bytes);
  if (!["image/svg+xml", "image/png"].includes(mime)) {
    throw new Error(`${theme.name} greeting mark has an unsupported registered asset`);
  }
  return `data:${mime};base64,${bytes.toString("base64")}`;
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
  ["clearBrand", "_Y"],
  ["findBrand", "_Z"],
  ["brandAssetMode", "Y0"],
  ["syncBrand", "Y1"],
  ["applyPromptLayout", "Y2"],
  ["unique", "Y3"],
  ["viewport", "Y4"],
  ["screenWide", "Y5"],
  ["footerCandidates", "Y6"],
  ["channels", "Y7"],
  ["brightness", "Y8"],
  ["editorRect", "Y9"],
  ["shellRect", "Z0"],
  ["groupRect", "Z1"],
  ["desiredCenter", "Z2"],
  ["desiredLeft", "Z3"],
  ["desiredTop", "Z4"],
  ["rootIdentityChanged", "Z5"],
  ["needsEnsure", "Z6"],
  ["element", "Z7"],
  ["rect", "Z8"],
  ["node", "Z9"],
  ["record", "X0"],
  ["bounds", "X1"],
  ["previous", "X2"],
  ["interactive", "X3"],
  ["candidate", "X4"],
  ["computed", "X5"],
  ["explicit", "X6"],
  ["found", "X7"],
  ["layout", "X8"],
  ["dataUrl", "X9"],
  ["className", "W0"],
  ["records", "W1"],
  ["source", "W2"],
  ["loader", "W3"],
  ["token", "W4"],
  ["media", "W5"],
  ["html", "W6"],
  ["clearMarks", "W7"],
  ["stopMode", "W8"],
  ["stopContext", "W9"],
  ["root", "V0"],
  ["mark", "V1"],
  ["view", "V2"],
  ["greetingHeadingCandidate", "V3"],
  ["mimicGreetingHeading", "V4"],
  ["greetingHeadingLevel", "V5"],
  ["applyGreetingStyle", "V6"],
  ["pickGreetingPhrase", "V7"],
  ["greetingPhrases", "V8"],
  ["greetingPhrase", "V9"],
  ["greetingNative", "U0"],
  ["greetingLastPick", "U1"],
  ["clearGreeting", "U2"],
  ["syncGreeting", "U3"],
  ["greetingNode", "U4"],
  ["greetingBag", "U5"],
  ["GREETING_MARKER", "U6"],
  ["GREETING_HIDDEN", "U7"],
  ["GREETING_COPY_PROPS", "U8"],
  ["GREETING_FONTS", "U9"],
  ["rejectSelector", "T0"],
  ["promptGroup", "T1"],
  ["endVisit", "T2"],
  ["fallback", "T3"],
  ["editors", "T4"],
  ["depth", "T5"],
  ["rootElement", "T6"],
  ["override", "T7"],
  ["property", "T8"],
  ["anchors", "T9"],
  ["cssText", "S0"],
  ["phrase", "S1"],
  ["greetingStyled", "S2"],
  ["applyGreetingPhrases", "S3"],
  ["endGreetingVisit", "S4"],
  ["clearAvatarOverlay", "S5"],
  ["findAvatar", "S6"],
  ["syncAvatar", "S8"],
  ["clearAvatar", "S9"],
  ["acct", "R0"],
  ["radius", "R2"],
  ["lowest", "R3"],
  ["spot", "R4"],
  ["score", "R5"],
  ["best", "R6"],
  ["binding", "Q1"],
  ["refreshGreetingProbe", "Q2"],
  ["greetingDecoration", "Q3"],
  ["greetingStatus", "Q4"],
  ["greetingCandidateCount", "Q5"],
  ["initialNavigationKey", "Q6"],
  ["removeReplacement", "Q7"],
  ["applyGreetingGeometry", "Q8"],
  ["snapshotAttribute", "Q9"],
  ["advanceGreetingVisit", "P0"],
  ["greetingTextNode", "P1"],
  ["restoreAttribute", "P2"],
  ["elementChildren", "P3"],
  ["greetingFrameToken", "P4"],
  ["GREETING_MARK", "P5"],
  ["greetingFrame", "P6"],
  ["navigationKey", "P7"],
  ["nodeRect", "P8"],
  ["nativeRect", "P9"],
  ["currentNavigationKey", "O0"],
  ["restoreBinding", "O1"],
  ["markRect", "O2"],
  ["onNavigationSignal", "O3"],
  ["phraseFingerprint", "O4"],
  ["stopGreetingFrame", "O5"],
  ["greetingProbeState", "O6"],
  ["resolveGreetingBinding", "O7"],
  ["scheduleGreetingFrame", "O8"],
  ["syncNativeCompactMark", "O9"],
  ["greetingCandidateFor", "N0"],
  ["prepareReplacement", "N1"],
  ["isSemanticHeading", "N2"],
  ["pickGreetingIndex", "N3"],
  ["snapshotDisplay", "N4"],
  ["restoreDisplay", "N5"],
  ["greetingMarkFor", "N6"],
  ["greetingRoots", "N7"],
  ["createBinding", "N8"],
  ["visibleRect", "M0"],
  ["inside", "M1"],
  ["excluded", "M2"],
  ["bound", "M3"],
  ["unwatch", "M4"],
  ["watch", "M5"],
  ["geometry", "M6"],
  ["within", "M7"],
  ["anchored", "M8"],
  ["place", "M9"],
  ["decorate", "N9"],
  ["custom", "L0"],
  ["placed", "L1"],
  ["onPopState", "L2"],
  ["restore", "L3"],
  ["box", "L4"],
  ["greetingMemory", "L5"],
  ["prompt", "L6"],
  ["sidebar", "L7"],
  ["control", "L8"],
  ["layer", "A0"],
  ["backdrop", "A1"],
  ["native", "A2"],
  ["role", "A3"],
  ["hidden", "A4"],
  ["appearance", "A5"],
  ["host", "A6"],
  ["state", "A7"],
  ["side", "A8"],
  ["artLayers", "A9"],
  ["brand", "B0"],
  ["frame", "B1"],
  ["group", "B2"],
  ["image", "B3"],
  ["fail", "B4"],
  ["section", "B5"],
  ["primary", "B6"],
  ["footer", "B7"],
  ["mode", "B9"],
  ["codeContextFromUrl", "C0"],
  ["codeRouteContext", "C1"],
  ["codeNavigationKey", "C2"],
  ["clearAuraRoot", "C3"],
  ["enterCodeRoute", "C4"],
  ["codeContext", "C5"],
  ["codeRoute", "C6"],
  ["observedCodeRoute", "C7"],
  ["list", "C8"],
  ["anchorCode", "C9"],
  ["value", "D0"],
  ["space", "D1"],
  ["anchor", "D2"],
  ["tagLevel", "D3"],
  ["decoded", "D4"],
  ["rows", "D5"],
  ["row", "D6"],
  ["out", "D7"],
  ["put", "D8"],
  ["fit", "D9"],
  ["sel", "E0"],
  ["pass", "E1"],
  ["other", "E2"],
  ["listener", "E3"],
  ["pick", "E4"],
  ["avt", "E5"],
  ["sem", "E6"],
  ["getGreetingProbe", "E7"],
  ["greetingMatches", "E8"],
  ["observer", "E9"],
  ["scheduled", "F0"],
  ["ensure", "F1"],
  ["timer", "F2"],
  ["cleanup", "F3"],
  ["cssDictionary", "F4"],
  ["inset", "F5"],
  ["siblings", "F6"],
  ["brands", "F7"],
  ["boundary", "F8"],
  ["level", "F9"],
  ["elements", "G0"],
  ["offset", "G1"],
  ["roots", "G2"],
  ["parent", "G3"],
  ["greetingNavigationKey", "H0"],
  ["nextKey", "H1"],
  ["createExperimentalCodeAdapter", "H2"],
  ["codeEnvironment", "H3"],
  ["codeDescriptor", "H4"],
  ["codeGetContext", "H5"],
  ["codeGetNavigationKey", "H6"],
  ["codeGetComputedStyle", "H7"],
  ["codeMarkers", "H8"],
  ["codeSnapshots", "H9"],
  ["codeOutcome", "I0"],
  ["codeStatus", "I1"],
  ["codeReason", "I2"],
  ["codeSignature", "I3"],
  ["codeVisible", "I4"],
  ["codeMatches", "I5"],
  ["codeSelector", "I6"],
  ["codePresent", "I7"],
  ["codeRollback", "I8"],
  ["codeDefinitions", "I9"],
  ["codeRequired", "J0"],
  ["codeStyleKey", "J1"],
  ["codeSelected", "J2"],
  ["codeName", "J4"],
  ["codePrefix", "J5"],
  ["codeGetMode", "J6"],
  ["codePalette", "J7"],
  ["codeImportant", "J8"],
  ["codeText", "J9"],
  ["codeBackground", "K0"],
  ["codeBorder", "K1"],
  ["codeStyles", "K2"],
  ["codeIndex", "K3"],
  ["codeDocument", "K4"],
  ["codeMarker", "K5"],
  ["codeStyleId", "K6"],
  ["codeRect", "K7"],
  ["codeStyle", "K8"],
  ["codeValue", "K9"],
  ["codeContext", "O0"],
  ["codeList", "O1"],
  ["codeFound", "O2"],
  ["codeSet", "O3"],
  ["codeElement", "O4"],
  ["activate", "O5"],
  ["rollback", "O6"],
  ["codeSheet", "O7"],
  ["codeNative", "O8"],
  ["codeStyled", "O9"],
  ["codeScope", "P2"],
  ["codeReset", "P3"],
  ["codeClean", "P4"],
  ["codeMode", "P8"],
  ["codeAsides", "Q0"],
  ["codeMains", "Q1"],
  ["codeAside", "Q2"],
  ["codeMain", "Q3"],
  ["codePending", "Q4"],
  ["codeApplied", "Q5"],
  ["codeShadow", "Q6"],
  ["codeCleanupRetry", "R1"],
  ["codeAdapter", "R7"],
  ["replacementOnly", "R8"],
]);

export function compactRendererIdentifiers(source, extraAliases = []) {
  if (typeof source !== "string") throw new TypeError("Renderer template must be a string");
  const aliases = new Map([...RENDERER_IDENTIFIER_ALIASES, ...extraAliases]);
  const settingAliases = new Map(RUNTIME_SETTING_ALIASES);
  const identifierStart = /[A-Za-z_$]/;
  const identifierPart = /[A-Za-z0-9_$]/;
  const regexPrefix = /[({[,:;=!?&|+\-*%^~<>]/;

  const copyQuoted = (start, quote) => {
    let index = start + 1;
    let escaped = false;
    while (index < source.length) {
      const character = source[index];
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === quote) return index + 1;
      index += 1;
    }
    return source.length;
  };

  const copyRegex = (start) => {
    let index = start + 1;
    let escaped = false;
    let characterClass = false;
    while (index < source.length) {
      const character = source[index];
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === "[") characterClass = true;
      else if (character === "]") characterClass = false;
      else if (character === "/" && !characterClass) {
        index += 1;
        while (/[A-Za-z]/.test(source[index] || "")) index += 1;
        return index;
      }
      index += 1;
    }
    return source.length;
  };

  const scanCode = (start, stopAtTemplateBrace = false) => {
    let result = "";
    let index = start;
    let braceDepth = 0;
    let previousToken = "";
    while (index < source.length) {
      const character = source[index];
      if (stopAtTemplateBrace && character === "}") {
        if (braceDepth === 0) return { result, index };
        braceDepth -= 1;
        result += character;
        previousToken = character;
        index += 1;
        continue;
      }
      if (character === "{") {
        if (stopAtTemplateBrace) braceDepth += 1;
        result += character;
        previousToken = character;
        index += 1;
        continue;
      }
      if (character === '"' || character === "'") {
        const end = copyQuoted(index, character);
        result += source.slice(index, end);
        previousToken = "literal";
        index = end;
        continue;
      }
      if (character === "`") {
        const template = scanTemplate(index);
        result += template.result;
        previousToken = "literal";
        index = template.index;
        continue;
      }
      if (character === "/" && source[index + 1] === "*") {
        const end = source.indexOf("*/", index + 2);
        const next = end < 0 ? source.length : end + 2;
        result += source.slice(index, next);
        index = next;
        continue;
      }
      if (character === "/" && source[index + 1] === "/") {
        const end = source.indexOf("\n", index + 2);
        const next = end < 0 ? source.length : end;
        result += source.slice(index, next);
        index = next;
        continue;
      }
      if (character === "/" && (regexPrefix.test(previousToken.at(-1) || "")
          || /^(return|case|throw|yield|await)$/.test(previousToken))) {
        const end = copyRegex(index);
        result += source.slice(index, end);
        previousToken = "literal";
        index = end;
        continue;
      }
      if (identifierStart.test(character)) {
        let end = index + 1;
        while (identifierPart.test(source[end] || "")) end += 1;
        const identifier = source.slice(index, end);
        let replacement = aliases.get(identifier) || identifier;
        if (identifier === "settings") {
          const propertyMatch = source.slice(end).match(/^(\s*\.\s*)([A-Za-z_$][A-Za-z0-9_$]*)/);
          if (propertyMatch) {
            const property = settingAliases.get(propertyMatch[2]) || propertyMatch[2];
            replacement += `${propertyMatch[1]}${property}`;
            end += propertyMatch[0].length;
          }
        }
        result += replacement;
        previousToken = identifier;
        index = end;
        continue;
      }
      result += character;
      if (!/\s/.test(character)) previousToken = character;
      index += 1;
    }
    return { result, index };
  };

  const scanTemplate = (start) => {
    let result = "`";
    let index = start + 1;
    while (index < source.length) {
      const character = source[index];
      if (character === "\\") {
        result += source.slice(index, index + 2);
        index += 2;
        continue;
      }
      if (character === "`") return { result: `${result}\``, index: index + 1 };
      if (character === "$" && source[index + 1] === "{") {
        const expression = scanCode(index + 2, true);
        result += `\${${expression.result}}`;
        index = expression.index + 1;
        continue;
      }
      result += character;
      index += 1;
    }
    return { result, index };
  };

  return scanCode(0).result;
}

function compactRuntimeSettings(settings) {
  for (const [property, alias] of RUNTIME_SETTING_ALIASES) {
    if (!Object.hasOwn(settings, property)) continue;
    settings[alias] = settings[property];
    delete settings[property];
  }
}

function pruneRuntimeSettingDefaults(settings) {
  for (const [property, defaultValue] of [
    ["appearance", "system"],
    ["imageDataUrl", null],
    ["imageAnimated", false],
    ["imagePosition", "center"],
    ["imageZoom", 1],
    ["artDataUrl", null],
    ["artPosition", "right center"],
    ["artSize", "min(58vw, 860px) auto"],
    ["artMobile", "reduce"],
    ["artLayers", null],
    ["brandWordmark", null],
    ["newChatLayout", null],
    ["reduceMotion", false],
  ]) {
    if (settings[property] === defaultValue) delete settings[property];
  }
  if (settings.variant === settings.theme) delete settings.variant;
  if (settings.q === "f") delete settings.q;
}

// The renderer is authored for review, then shipped as one injected expression.
// Remove formatting whitespace without touching quoted/template content. A space
// is retained only where deleting it could merge identifiers or change ++/--.
function compactRendererSyntax(source) {
  let result = "";
  let index = 0;
  let quote = null;
  let escaped = false;
  const word = (character) => /[A-Za-z0-9_$]/.test(character || "");
  while (index < source.length) {
    const character = source[index];
    if (quote) {
      result += character;
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === quote) quote = null;
      index += 1;
      continue;
    }
    if (character === '"' || character === "'" || character === "`") {
      quote = character;
      result += character;
      index += 1;
      continue;
    }
    if (/\s/.test(character)) {
      let nextIndex = index + 1;
      while (nextIndex < source.length && /\s/.test(source[nextIndex])) nextIndex += 1;
      const previous = result.at(-1) || "";
      const next = source[nextIndex] || "";
      if ((word(previous) && word(next))
          || (previous === "+" && next === "+")
          || (previous === "-" && next === "-")
          || (word(previous) && next === "/")
          || (previous === "/" && (next === "/" || next === "*"))) result += " ";
      index = nextIndex;
      continue;
    }
    result += character;
    index += 1;
  }
  return result;
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

async function resolveInstantPrompts(theme, locale) {
  if (!Array.isArray(theme.instantPrompts) || theme.instantPrompts.length === 0) return [];
  const normalizedLocale = normalizeLocale(locale);
  const cards = await Promise.all(theme.instantPrompts.map(async (card) => {
    const icon = card.icon ? await resolveArtwork({
      artwork: { path: card.icon },
      artworkRoot: theme.artworkRoot,
      artworkAllowedRoot: theme.artworkAllowedRoot,
    }) : null;
    return {
      id: card.id,
      label: card.labels[normalizedLocale] ?? card.labels.en,
      prompt: card.prompts[normalizedLocale] ?? card.prompts.en,
      iconDataUrl: icon?.dataUrl ?? null,
      layout: card.layout,
    };
  }));
  const textBytes = Buffer.byteLength(JSON.stringify(
    cards.map(({ id, label, prompt }) => [id, label, prompt]),
  ), "utf8");
  if (textBytes > INSTANT_PROMPT_RUNTIME_TEXT_MAX_BYTES) {
    throw new Error(`Instant prompt runtime text must be at most ${INSTANT_PROMPT_RUNTIME_TEXT_MAX_BYTES} bytes`);
  }
  return cards;
}

export async function compileTheme({
  configPath,
  config: configOverride = null,
  locale = "en",
  userThemesDir = null,
  themeKitDirectory = null,
  builtinLayoutCapability = null,
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
    const kit = await readThemeKit(path.resolve(themeKitDirectory), { builtinLayoutCapability });
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
  const [
    image,
    avatar,
    personalWordmark,
    artwork,
    artworkLayers,
    brandWordmark,
    greetingCompactMark,
    instantPrompts,
    baseCss,
    allVariantCss,
  ] = await Promise.all([
    resolveImage(config, resolvedConfigPath),
    resolveAvatar(config, resolvedConfigPath),
    resolvePersonalWordmark(config, resolvedConfigPath),
    resolveArtwork(theme),
    resolveArtworkLayers(theme),
    resolveBrandWordmark(theme),
    resolveGreetingCompactMark(theme),
    resolveInstantPrompts(theme, locale),
    fs.readFile(path.join(PROJECT_ROOT, "assets", "base.css"), "utf8"),
    fs.readFile(path.join(PROJECT_ROOT, "assets", "theme-variants.css"), "utf8"),
  ]);
  const activePersonalWordmark = config.enabled ? personalWordmark : null;
  const variantCss = filterThemeVariantCss(
    allVariantCss,
    theme.name,
    theme.variant,
    Boolean(activePersonalWordmark || brandWordmark),
  );
  const studioRecipeOverrides = renderStudioRecipeOverrides(theme);
  const imageOpacity = config.imageOpacity === null || config.imageOpacity === undefined
    ? null
    : finiteNumber(config.imageOpacity, "imageOpacity", 0, 0.55);
  if (typeof config.imageZoom !== "number") throw new Error("imageZoom must be a number");
  const imageZoom = finiteNumber(config.imageZoom, "imageZoom", 1, 2);
  const studioPreviewCrops = validateStudioPreviewCrops(config.studioPreviewCrops ?? {});
  const variableCss = [
    renderThemeModes(theme),
    renderThemePrimitives(theme),
  ].join("\n\n");
  const greetingCss = renderGreetingCss(theme.newChatGreetingStyle, theme.responsiveLayouts);
  const interfaceCss = renderInterfaceSurfacesCss(theme.interfaceSurfaces);
  // Personal avatar overlay rules ride along only when an avatar is set, so the
  // common payload carries none of their bytes (the reserve ceiling is tight).
  const avatarCss = avatar ? AVATAR_OVERLAY_CSS : "";
  const activeBaseCss = instantPrompts.length
    ? baseCss
    : baseCss.replace(INSTANT_PROMPTS_CSS_PATTERN, "");
  const css = `${variableCss}\n\n${activeBaseCss}\n\n${variantCss}${studioRecipeOverrides ? `\n${studioRecipeOverrides}\n` : ""}${greetingCss ? `\n${greetingCss}\n` : ""}${interfaceCss ? `\n${interfaceCss}\n` : ""}${avatarCss ? `\n${avatarCss}\n` : ""}${theme.customCss ? `\n${theme.customCss}\n` : ""}`
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
        ...(layer.filters ? { filters: cloneJson(layer.filters) } : {}),
        role: layer.role,
        ...(layer.appearance ? { appearance: layer.appearance } : {}),
        contextOverrides: layer.contextOverrides ?? layer.legacy?.contextOverrides ?? null,
        ...(layer.id ? {
          id: layer.id,
          context: layer.context,
          viewport: layer.viewport,
          visible: layer.visible,
          ...(layer.anchor ? { anchor: layer.anchor } : {}),
          frames: cloneJson(layer.frames),
          legacy: Boolean(layer.legacy),
        } : {}),
      }))
      : null,
    brandWordmark: !activePersonalWordmark && brandWordmark
      ? {
        lightDataUrl: brandWordmark.lightDataUrl,
        darkDataUrl: brandWordmark.darkDataUrl,
        minWidth: brandWordmark.minWidth,
        width: brandWordmark.width,
        kind: brandWordmark.kind,
        lightMinWidth: brandWordmark.lightMinWidth,
        lightWidth: brandWordmark.lightWidth,
        darkMinWidth: brandWordmark.darkMinWidth,
        darkWidth: brandWordmark.darkWidth,
        lightKind: brandWordmark.lightKind,
        darkKind: brandWordmark.darkKind,
        lightTreatment: brandWordmark.lightTreatment,
        darkTreatment: brandWordmark.darkTreatment,
      }
      : null,
    backgroundScope: theme.backgroundScope ?? "full-window",
    responsiveLayouts: theme.responsiveLayouts ? cloneJson(theme.responsiveLayouts) : null,
    newChatLayout: theme.newChatLayout ? { ...theme.newChatLayout } : null,
    promptFrames: promptFrameOverrides(
      theme.interfaceSurfaces,
      theme.newChatLayout,
      theme.responsiveLayouts,
    ),
    instantPrompts,
    reduceMotion: config.reduceMotion,
  };
  // Personal avatar: per-user, never theme-owned. Attach the data URL only when a
  // valid avatar resolves so configs without one keep an identical digest/payload;
  // surface `avatarUnavailable` (a stripped diagnostic) when the chosen file went
  // missing so the Studio can warn without shipping anything to the renderer.
  if (avatar) settingsBase.avatarDataUrl = avatar.dataUrl;
  else if (config.avatar) settingsBase.avatarUnavailable = true;
  if (activePersonalWordmark) {
    settingsBase.personalWordmark = {
      dataUrl: activePersonalWordmark.dataUrl,
      minWidth: activePersonalWordmark.minWidth,
      width: activePersonalWordmark.width,
    };
  } else if (config.personalWordmark && !personalWordmark) {
    settingsBase.personalWordmarkUnavailable = true;
  }
  // WO-21 greeting: theme-owned presentation (validated) plus host-owned effective
  // phrases (fail open to native on invalid custom data). Only attach when there is
  // something greeting-related so existing null-greeting configs keep a stable digest.
  const newChatGreetingStyle = theme.newChatGreetingStyle ? cloneJson(theme.newChatGreetingStyle) : null;
  const greetingRuntime = resolveGreetingRuntime(config.greetingPreferences ?? null, theme.name);
  if (newChatGreetingStyle || greetingRuntime) {
    settingsBase.greeting = {
      style: newChatGreetingStyle,
      responsive: theme.responsiveLayouts && newChatGreetingStyle
        ? {
          light: cloneJson(newChatGreetingStyle.light.frames),
          dark: cloneJson(newChatGreetingStyle.dark.frames),
        }
        : null,
      phrases: greetingRuntime?.phrases ?? null,
      phraseDigest: greetingRuntime?.phraseDigest ?? null,
      shuffle: greetingRuntime?.shuffle ?? null,
      ...(greetingCompactMark ? { markDataUrl: greetingCompactMark } : {}),
    };
  }
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
    personalWordmark,
    artwork,
    artworkLayers,
    brandWordmark,
    greetingCompactMark,
    css,
    settings: { ...settingsBase, digest },
    digest,
  };
}

export async function buildPayloadFromCompiled(compiled, {
  enforceBudget = true,
  experimentalCode = null,
} = {}) {
  if (!compiled || typeof compiled.css !== "string" || !isPlainObject(compiled.settings)) {
    throw new Error("A compiled theme is required to build a renderer payload");
  }
  if (experimentalCode !== null
      && (typeof experimentalCode?.factory !== "function"
        || !isPlainObject(experimentalCode?.descriptor))) {
    throw new Error("Experimental Code payload input is invalid");
  }
  let rendererSource = await fs.readFile(
    path.join(PROJECT_ROOT, "assets", "renderer-inject.js"),
    "utf8",
  );
  if (!Array.isArray(compiled.settings.instantPrompts) || compiled.settings.instantPrompts.length === 0) {
    rendererSource = rendererSource.replace(INSTANT_PROMPTS_BLOCK_PATTERN, "");
  }
  if (!compiled.settings.responsiveLayouts) {
    rendererSource = rendererSource.replace(RESPONSIVE_BLOCK_PATTERN, "");
  }
  // Gates 3 and 4 remain open. Keep production payloads inert even if the
  // dormant registry is edited; activation requires a separate reviewed change.
  const codeAdapterFactory = createInertCodeAdapter;
  if (experimentalCode === null) {
    rendererSource = rendererSource.replace(CODE_ADAPTER_ACTIVE_PATTERN, "");
  }
  rendererSource = rendererSource.replace(
    compiled.settings.personalWordmark ? BUILTIN_WORDMARK_PATTERN : PERSONAL_WORDMARK_PATTERN,
    "",
  ).replace(WORDMARK_MARKER_PATTERN, "");
  rendererSource = rendererSource
    .replace(
      "__AURA_CODE_ADAPTER_FACTORY__",
      `(${(experimentalCode?.factory ?? codeAdapterFactory).toString()})`,
    )
    .replace("__AURA_CODE_CONTEXT_FACTORY__", `(${codeContextFromUrl.toString()})`)
    .replace("__AURA_INSTANT_PROMPTS_FACTORY__", `(${createInstantPromptController.toString()})`)
    .replace("__AURA_RESPONSIVE_FACTORY__", `(${createResponsiveResolver.toString()})`)
    .replace(
      "__AURA_CODE_SIGNATURES__",
      JSON.stringify(experimentalCode?.descriptor ?? null),
    );
  const experimentalAliases = experimentalCode === null
    ? []
    : [["window", "$w"], ["document", "$d"]];
  let template = compactRendererSyntax(compactRendererIdentifiers(
    rendererSource,
    experimentalAliases,
  ));
  if (!template.includes("__AURA_RENDERER_WINDOW__")) {
    throw new Error("Renderer is missing its prepaint handoff window");
  }
  template = template.replace("__AURA_RENDERER_WINDOW__", "window");
  if (experimentalCode !== null) {
    for (const [placeholder, identifier] of [
      ["__AURA_CODE_WINDOW__", "window"],
      ["__AURA_CODE_DOCUMENT__", "document"],
    ]) {
      if (!template.includes(placeholder)) {
        throw new Error(`Experimental Code renderer is missing ${placeholder}`);
      }
      template = template.replace(placeholder, identifier);
    }
  }
  const runtimeSettings = { ...compiled.settings };
  for (const diagnosticKey of [
    "label",
    "requestedTheme",
    "fallbackFrom",
    "customThemeUnavailable",
    "imageUnavailable",
    "artUnavailable",
    "avatarUnavailable",
    "personalWordmarkUnavailable",
  ]) delete runtimeSettings[diagnosticKey];
  runtimeSettings.q = runtimeSettings.backgroundScope === "sidebar"
    ? "s"
    : runtimeSettings.backgroundScope === "content" ? "c" : "f";
  delete runtimeSettings.backgroundScope;
  const responsiveSetIds = runtimeSettings.responsiveLayouts?.sets?.map(({ id }) => id) ?? null;
  if (responsiveSetIds) {
    runtimeSettings.R = [
      runtimeSettings.responsiveLayouts.mode === "fluid" ? "f" : "s",
      responsiveSetIds,
      runtimeSettings.responsiveLayouts.sets.map(({ width }) => width),
      runtimeSettings.responsiveLayouts.breakpoints ?? [],
    ];
  }
  delete runtimeSettings.responsiveLayouts;
  // WO-21: ship the compiled greeting as compact `g` — `p` = effective phrase list
  // (host-owned custom wording), `s` = 1 flags theme-owned styling (delivered as CSS).
  // Only present when there is something to render, so a native theme is unchanged.
  if (runtimeSettings.greeting) {
    const compact = {};
    if (Array.isArray(runtimeSettings.greeting.phrases) && runtimeSettings.greeting.phrases.length) {
      compact.p = runtimeSettings.greeting.phrases;
      compact.d = runtimeSettings.greeting.phraseDigest;
      if (runtimeSettings.greeting.shuffle) {
        compact.h = [
          runtimeSettings.greeting.shuffle.order,
          runtimeSettings.greeting.shuffle.cursor,
          runtimeSettings.greeting.shuffle.lastIndex,
        ];
      }
    }
    if (runtimeSettings.greeting.style) compact.s = 1;
    if (responsiveSetIds && runtimeSettings.greeting.responsive) {
      const greetingFields = ["fontSize", "lineHeight", "maxWidthRatio", "xRatio", "yRatio", "markScale"];
      compact.r = ["light", "dark"].map((appearance) => responsiveSetIds.map((id) => {
        const frame = runtimeSettings.greeting.responsive[appearance]?.[id];
        return frame ? greetingFields.map((field) => frame[field]) : null;
      }));
    }
    if (typeof runtimeSettings.greeting.markDataUrl === "string"
        && runtimeSettings.greeting.markDataUrl) {
      compact.m = runtimeSettings.greeting.markDataUrl;
    }
    delete runtimeSettings.greeting;
    if (compact.p || compact.s) runtimeSettings.g = compact;
  }
  // Strip the personal-avatar overlay when no avatar is set, so payloads for the
  // common case carry none of its code.
  if (!runtimeSettings.avatarDataUrl) template = template.replace(AVATAR_BLOCK_PATTERN, "");
  // Strip the greeting subsystem when inactive, and its custom-phrases sub-block when a
  // theme only styles the native greeting — so the default recipe payload stays lean.
  if (!runtimeSettings.g) template = template.replace(GREETING_BLOCK_PATTERN, "");
  else if (!runtimeSettings.g.p) template = template.replace(GREETING_PHRASES_PATTERN, "");
  if (!Array.isArray(runtimeSettings.instantPrompts) || runtimeSettings.instantPrompts.length === 0) {
    template = template.replace(INSTANT_PROMPTS_BLOCK_PATTERN, "");
  }
  if (runtimeSettings.brandWordmark) {
    const wordmark = runtimeSettings.brandWordmark;
    const kinds = [wordmark.lightKind ?? wordmark.kind, wordmark.darkKind ?? wordmark.kind]
      .map((kind) => kind === "local" ? "m" : "w");
    const treatments = [wordmark.lightTreatment, wordmark.darkTreatment]
      .map((treatment) => treatment === "foreground" ? "f" : treatment === "accent" ? "a" : "o");
    runtimeSettings.b = [
      wordmark.lightDataUrl,
      wordmark.darkDataUrl,
      [wordmark.lightMinWidth ?? wordmark.minWidth, wordmark.lightWidth ?? wordmark.width],
      [wordmark.darkMinWidth ?? wordmark.minWidth, wordmark.darkWidth ?? wordmark.width],
    ];
    if (kinds.includes("m") || treatments.some((treatment) => treatment !== "o")) {
      runtimeSettings.b.push(kinds, treatments);
    }
    delete runtimeSettings.brandWordmark;
  }
  if (runtimeSettings.personalWordmark) {
    const wordmark = runtimeSettings.personalWordmark;
    runtimeSettings.W = [
      wordmark.dataUrl,
      wordmark.minWidth,
      wordmark.width,
    ];
    delete runtimeSettings.personalWordmark;
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
      if (layer.filters) compact.f = [
        layer.filters.hueDeg ?? 0,
        layer.filters.saturation ?? 1,
        layer.filters.brightness ?? 1,
        layer.filters.contrast ?? 1,
        layer.filters.blurPx ?? 0,
      ];
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
        if (responsiveSetIds && layer.frames) {
          if (layer.anchor !== "center") compact.h = anchorKeys[layer.anchor];
          compact.n = responsiveSetIds.map((id) => {
            const frame = layer.frames[id];
            return frame ? [
              frame.positionX,
              frame.positionY,
              frame.focalX,
              frame.focalY,
              frame.scale,
            ] : null;
          });
        } else if (!layer.legacy) {
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
  if (Array.isArray(runtimeSettings.instantPrompts) && runtimeSettings.instantPrompts.length) {
    const urls = Array.isArray(runtimeSettings.u) ? runtimeSettings.u : [];
    const urlIndexes = new Map(urls.map((url, index) => [url, index]));
    runtimeSettings.P = runtimeSettings.instantPrompts.map((card) => {
      let iconIndex = null;
      if (typeof card.iconDataUrl === "string" && card.iconDataUrl) {
        iconIndex = urlIndexes.get(card.iconDataUrl);
        if (iconIndex === undefined) {
          iconIndex = urls.length;
          urls.push(card.iconDataUrl);
          urlIndexes.set(card.iconDataUrl, iconIndex);
        }
      }
      const normal = card.layout?.frames?.normal;
      const wide = card.layout?.frames?.wide;
      const layout = responsiveSetIds ? [
        card.layout?.opacity ?? 1,
        responsiveSetIds.map((id) => {
          const frame = card.layout?.frames?.[id];
          return frame ? [
            frame.positionX,
            frame.positionY,
            frame.widthRatio,
            frame.scale,
            frame.offsetX,
            frame.offsetY,
          ] : null;
        }),
      ] : normal && wide ? [
        card.layout.opacity,
        normal.positionX, normal.positionY, normal.scale,
        wide.positionX, wide.positionY, wide.scale,
      ] : [1, 0, 0, 1, 0, 0, 1];
      const compact = [card.id, card.label, card.prompt, iconIndex];
      if (responsiveSetIds || layout.some((value, index) => value !== [1, 0, 0, 1, 0, 0, 1][index])) {
        compact.push(layout);
      }
      return compact;
    });
    if (urls.length) runtimeSettings.u = urls;
  }
  delete runtimeSettings.instantPrompts;
  if (responsiveSetIds) {
    const base = runtimeSettings.newChatLayout
      ? [
        runtimeSettings.newChatLayout.widthRatio,
        runtimeSettings.newChatLayout.offsetXRatio,
        runtimeSettings.newChatLayout.offsetYRatio,
      ]
      : null;
    const frameMap = runtimeSettings.promptFrames ?? {};
    const frames = responsiveSetIds.map((id) => frameMap[id]
      ? [frameMap[id].widthRatio, frameMap[id].offsetXRatio, frameMap[id].offsetYRatio]
      : null);
    if (base || frames.some(Boolean)) runtimeSettings.n = [base, frames];
    delete runtimeSettings.promptFrames;
    delete runtimeSettings.newChatLayout;
  } else if (runtimeSettings.promptFrames) {
    const frames = runtimeSettings.promptFrames;
    runtimeSettings.n = [frames.standard, frames.wide].map((layout) => [
      layout.widthRatio, layout.offsetXRatio, layout.offsetYRatio,
    ]);
    delete runtimeSettings.promptFrames;
    delete runtimeSettings.newChatLayout;
  } else if (runtimeSettings.newChatLayout) {
    const layout = runtimeSettings.newChatLayout;
    runtimeSettings.n = [layout.widthRatio, layout.offsetXRatio, layout.offsetYRatio];
    delete runtimeSettings.newChatLayout;
  }
  delete runtimeSettings.promptFrames;
  pruneRuntimeSettingDefaults(runtimeSettings);
  compactRuntimeSettings(runtimeSettings);
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
  const compressedCss = compressRendererCss(compactCss);
  compactCss = compressedCss.css;
  if (compressedCss.compressed) runtimeSettings.C = compressedCss.dictionary;
  // Conditional markers and explanatory comments have done their build-time
  // job. Do not carry them into every injected payload.
  template = template.replace(/\/\*[\s\S]*?\*\//g, "");
  const buildPayloadString = () => template
    .replace("__AURA_CSS_JSON__", JSON.stringify(compactCss))
    .replace("__AURA_SETTINGS_JSON__", JSON.stringify(runtimeSettings));
  const payload = buildPayloadString();
  // Validated phrases, presentation, and personal embeds are indivisible user
  // intent. Reclaim chrome elsewhere or fail rather than silently changing the
  // requested result while reporting a successful apply.
  if (payload.includes("__AURA_CSS_JSON__") || payload.includes("__AURA_SETTINGS_JSON__")
      || payload.includes("__AURA_CODE_") || payload.includes("__AURA_INSTANT_PROMPTS_")) {
    throw new Error("Renderer payload placeholders were not fully replaced");
  }
  const measuredBudget = enforceBudget
    ? enforcePayloadBudget(payload, runtimeSettings, `${compiled.theme?.name ?? "Theme"} payload`)
    : payloadBudget(payload, runtimeSettings);
  return { ...compiled, payload, payloadBudget: measuredBudget };
}

export async function buildPayload(options = {}) {
  return buildPayloadFromCompiled(await compileTheme(options));
}
