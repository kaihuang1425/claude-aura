import {
  STUDIO_FONT_DISPLAY_STACKS,
  STUDIO_FONT_UI_STACKS,
  STUDIO_SHADOWS,
} from "./constants.mjs";

const HEX = /^#[0-9A-F]{6}$/u;
const DIGEST = /^[a-f0-9]{64}$/u;
const APPEARANCES = Object.freeze(["light", "dark"]);
const VIEWS = Object.freeze(["new-chat", "conversation"]);
const FRAMES = Object.freeze(["standard", "wide"]);

const field = (type, options = {}) => Object.freeze({ type, ...options });
const color = field("color");
const uiFont = field("enum", { values: Object.keys(STUDIO_FONT_UI_STACKS) });
const displayFont = field("enum", { values: Object.keys(STUDIO_FONT_DISPLAY_STACKS) });

const SIDEBAR_FIELDS = Object.freeze({
  surface: color,
  primaryText: color,
  secondaryText: color,
  selectedSurface: color,
  indicator: color,
  font: uiFont,
  primaryActionSurface: color,
  primaryActionForeground: color,
  rowHoverSurface: color,
  rowPressedSurface: color,
  selectedRowSurface: color,
  sectionLabel: color,
  sectionRule: color,
  footerSurface: color,
  rowRadius: field("number", { minimum: 0, maximum: 28 }),
  spacing: field("enum", { values: ["compact", "comfortable"] }),
});

const IDENTITY_FIELDS = Object.freeze({
  mode: field("enum", { values: ["native", "inherited-builtin", "styled-label", "local-mark"] }),
  font: displayFont,
  weight: field("enum", { values: [300, 400, 500, 600, 650, 700] }),
  fontSize: field("number", { minimum: 12, maximum: 32 }),
  letterSpacing: field("number", { minimum: -0.08, maximum: 0.2, precision: 3 }),
  color: color,
  markSize: field("number", { minimum: 24, maximum: 72 }),
  markTreatment: field("enum", { values: ["original", "foreground", "accent"] }),
  markDigest: field("digest"),
});

const PROMPT_MATERIAL_FIELDS = Object.freeze({
  surface: color,
  foreground: color,
  placeholder: color,
  border: color,
  focus: color,
  font: uiFont,
  radius: field("number", { minimum: 0, maximum: 40 }),
  borderWidth: field("number", { minimum: 0, maximum: 3 }),
  blurPx: field("number", { minimum: 0, maximum: 32 }),
  shadow: field("enum", { values: Object.keys(STUDIO_SHADOWS) }),
  editorInset: field("enum", { values: ["transparent", "compact", "comfortable"] }),
  toolbarSurface: color,
  controlForeground: color,
  controlResting: color,
  controlHover: color,
  controlPressed: color,
  controlSelected: color,
  controlDisabled: color,
});

const PROMPT_FRAME_FIELDS = Object.freeze({
  widthRatio: field("number", { minimum: 0.4, maximum: 0.96 }),
  offsetXRatio: field("number", { minimum: -0.35, maximum: 0.35 }),
  offsetYRatio: field("number", { minimum: -0.3, maximum: 0.3 }),
});

export const INTERFACE_SURFACE_SPECS = Object.freeze({
  sidebar: Object.freeze({
    base: SIDEBAR_FIELDS,
    appearance: SIDEBAR_FIELDS,
    view: null,
    frame: null,
  }),
  sidebarIdentity: Object.freeze({
    base: IDENTITY_FIELDS,
    appearance: IDENTITY_FIELDS,
    view: null,
    frame: null,
  }),
  promptBlock: Object.freeze({
    base: PROMPT_MATERIAL_FIELDS,
    appearance: PROMPT_MATERIAL_FIELDS,
    view: null,
    frame: PROMPT_FRAME_FIELDS,
  }),
});

function plain(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function exactSubset(value, allowed, label) {
  if (!plain(value)) throw new Error(`${label} must be an object`);
  const keys = Object.keys(value);
  if (keys.some((key) => !allowed.includes(key))) throw new Error(`${label} has an unsupported property`);
  if (keys.length === 0) throw new Error(`${label} must not be empty`);
  return keys;
}

function normalizeField(value, rule, label) {
  if (rule.type === "color") {
    const normalized = String(value ?? "").toUpperCase();
    if (!HEX.test(normalized)) throw new Error(`${label} must be a six-digit hex colour`);
    return normalized;
  }
  if (rule.type === "digest") {
    if (typeof value !== "string" || !DIGEST.test(value)) {
      throw new Error(`${label} must be a lowercase SHA-256 digest`);
    }
    return value;
  }
  if (rule.type === "enum") {
    if (!rule.values.includes(value)) throw new Error(`${label} has an unsupported value`);
    return value;
  }
  if (typeof value !== "number" || !Number.isFinite(value)
      || value < rule.minimum || value > rule.maximum) {
    throw new Error(`${label} must be between ${rule.minimum} and ${rule.maximum}`);
  }
  const scale = 10 ** (rule.precision ?? 2);
  return Math.round(value * scale) / scale;
}

function normalizeLeaf(value, fields, label) {
  const keys = exactSubset(value, Object.keys(fields), label);
  return Object.fromEntries(keys.map((key) => [key, normalizeField(value[key], fields[key], `${label}.${key}`)]));
}

function normalizeAxis(value, keys, fields, label) {
  const present = exactSubset(value, keys, label);
  return Object.fromEntries(present.map((key) => [key, normalizeLeaf(value[key], fields, `${label}.${key}`)]));
}

function normalizeWrapper(value, spec, label) {
  const slots = exactSubset(value, ["base", "appearance", "view", "frame"], label);
  const result = {};
  for (const slot of slots) {
    if (!spec[slot]) throw new Error(`${label}.${slot} is not supported by this surface`);
    if (slot === "base") result.base = normalizeLeaf(value.base, spec.base, `${label}.base`);
    else if (slot === "appearance") {
      result.appearance = normalizeAxis(value.appearance, APPEARANCES, spec.appearance, `${label}.appearance`);
    } else if (slot === "view") {
      result.view = normalizeAxis(value.view, VIEWS, spec.view, `${label}.view`);
    } else {
      result.frame = normalizeAxis(value.frame, FRAMES, spec.frame, `${label}.frame`);
    }
  }
  return result;
}

export function resolveInterfaceSurface(wrapper, {
  appearance = "light",
  view = "new-chat",
  frame = "standard",
} = {}) {
  if (!wrapper) return {};
  return {
    ...(wrapper.base ?? {}),
    ...(wrapper.appearance?.[appearance] ?? {}),
    ...(wrapper.view?.[view] ?? {}),
    ...(wrapper.frame?.[frame] ?? {}),
  };
}

export function validateInterfaceSurfaces(value, label = "interfaceSurfaces", { sourceRecipe = null } = {}) {
  if (value === null || value === undefined) return null;
  const keys = exactSubset(value, Object.keys(INTERFACE_SURFACE_SPECS), label);
  const result = Object.fromEntries(keys.map((key) => [
    key,
    normalizeWrapper(value[key], INTERFACE_SURFACE_SPECS[key], `${label}.${key}`),
  ]));
  const identity = result.sidebarIdentity;
  if (identity) {
    const resolved = APPEARANCES.flatMap((appearance) => FRAMES.map((frame) =>
      resolveInterfaceSurface(identity, { appearance, view: "new-chat", frame })));
    const digests = new Set(resolved.flatMap((entry) => entry.markDigest ? [entry.markDigest] : []));
    if (digests.size > 1) throw new Error(`${label}.sidebarIdentity may reference only one local mark digest`);
    if (resolved.some((entry) => entry.mode === "local-mark" && !entry.markDigest)) {
      throw new Error(`${label}.sidebarIdentity local-mark mode requires markDigest`);
    }
    if (resolved.some((entry) => entry.mode === "inherited-builtin") && !sourceRecipe) {
      throw new Error(`${label}.sidebarIdentity inherited-builtin mode requires sourceRecipe`);
    }
  }
  return result;
}

export function interfaceIdentityDigest(interfaceSurfaces) {
  const identity = interfaceSurfaces?.sidebarIdentity;
  if (!identity) return null;
  for (const appearance of APPEARANCES) {
    const resolved = resolveInterfaceSurface(identity, { appearance });
    if (resolved.mode === "local-mark" && resolved.markDigest) return resolved.markDigest;
  }
  return null;
}

function declarations(values) {
  return Object.entries(values).filter(([, value]) => value !== undefined && value !== null)
    .map(([property, value]) => `${property}:${value}!important`).join(";");
}

function rule(selector, values) {
  const body = declarations(values);
  return body ? `${selector}{${body}}` : "";
}

function modeRoot(appearance) {
  return `html.claude-aura[data-claude-aura-effective-mode="${appearance}"]`;
}

export function renderInterfaceSurfacesCss(interfaceSurfaces) {
  if (!interfaceSurfaces) return "";
  const css = [];
  for (const appearance of APPEARANCES) {
    const root = modeRoot(appearance);
    const sidebar = resolveInterfaceSurface(interfaceSurfaces.sidebar, { appearance });
    const side = `${root} [data-claude-aura-sidebar]`;
    css.push(rule(side, {
      "background-color": sidebar.surface,
      "font-family": sidebar.font ? STUDIO_FONT_UI_STACKS[sidebar.font] : null,
      "--aura-wo25-row-radius": sidebar.rowRadius === undefined ? null : `${sidebar.rowRadius}px`,
      "--aura-wo25-row-block": sidebar.spacing === "compact" ? "4px" : sidebar.spacing === "comfortable" ? "8px" : null,
      "--aura-wo25-row-inline": sidebar.spacing === "compact" ? "6px" : sidebar.spacing === "comfortable" ? "10px" : null,
    }));
    css.push(rule(`${side} [data-aura-f="p"]`, { color: sidebar.primaryText }));
    css.push(rule(`${side} [data-aura-f="s"]`, { color: sidebar.secondaryText }));
    css.push(rule(`${side} [data-aura-role="sidebar-primary"]`, {
      "background-color": sidebar.primaryActionSurface,
      color: sidebar.primaryActionForeground,
      "border-radius": sidebar.rowRadius === undefined ? null : `${sidebar.rowRadius}px`,
      padding: sidebar.spacing ? "var(--aura-wo25-row-block) var(--aura-wo25-row-inline)" : null,
    }));
    const row = `${side} [data-aura-role="sidebar-row"]`;
    css.push(rule(row, {
      "border-radius": sidebar.rowRadius === undefined ? null : `${sidebar.rowRadius}px`,
      padding: sidebar.spacing ? "var(--aura-wo25-row-block) var(--aura-wo25-row-inline)" : null,
    }));
    css.push(rule(`${row}:hover`, { "background-color": sidebar.rowHoverSurface }));
    css.push(rule(`${row}:active`, { "background-color": sidebar.rowPressedSurface }));
    css.push(rule(`${row}:is([aria-current],[data-state="active"],[aria-selected="true"])`, {
      "background-color": sidebar.selectedRowSurface ?? sidebar.selectedSurface,
      "border-inline-start-color": sidebar.indicator,
    }));
    css.push(rule(`${side} [data-aura-role="sidebar-section"]`, {
      color: sidebar.sectionLabel,
      "border-color": sidebar.sectionRule,
    }));
    css.push(rule(`${side} [data-aura-role="sidebar-footer"]`, { "background-color": sidebar.footerSurface }));

    const identity = resolveInterfaceSurface(interfaceSurfaces.sidebarIdentity, { appearance });
    css.push(rule(`${root} [data-claude-aura-brand-image]`, {
      color: identity.color,
      "font-family": identity.font ? STUDIO_FONT_DISPLAY_STACKS[identity.font] : null,
      "font-size": identity.fontSize === undefined ? null : `${identity.fontSize}px`,
      "font-weight": identity.weight,
      "letter-spacing": identity.letterSpacing === undefined ? null : `${identity.letterSpacing}em`,
    }));

    const prompt = resolveInterfaceSurface(interfaceSurfaces.promptBlock, { appearance });
    const shell = `${root} [data-aura-role="composer-shell"]`;
    css.push(rule(shell, {
      "background-color": prompt.surface,
      color: prompt.foreground,
      "border-color": prompt.border,
      "border-width": prompt.borderWidth === undefined ? null : `${prompt.borderWidth}px`,
      "border-radius": prompt.radius === undefined ? null : `${prompt.radius}px`,
      "backdrop-filter": prompt.blurPx === undefined ? null : `blur(${prompt.blurPx}px)`,
      "box-shadow": prompt.shadow ? STUDIO_SHADOWS[prompt.shadow].shadowElevated : null,
      "font-family": prompt.font ? STUDIO_FONT_UI_STACKS[prompt.font] : null,
    }));
    css.push(rule(`${shell}:focus-within`, { "border-color": prompt.focus }));
    css.push(rule(`${shell} [data-aura-role="composer-editor"]`, {
      color: prompt.foreground,
      "background-color": prompt.editorInset === "transparent" ? "transparent"
        : prompt.editorInset === "compact" ? "rgb(255 255 255 / .04)"
          : prompt.editorInset === "comfortable" ? "rgb(255 255 255 / .08)" : null,
      padding: prompt.editorInset === "compact" ? "4px 6px"
        : prompt.editorInset === "comfortable" ? "8px 10px" : null,
    }));
    css.push(rule(`${shell} [data-aura-role="composer-editor"]::placeholder`, { color: prompt.placeholder }));
    css.push(rule(`${shell} [data-aura-role="composer-toolbar"]`, { "background-color": prompt.toolbarSurface }));
    const control = `${shell} :is([data-aura-role="control-icon"],[data-aura-role="control-pill"],[data-aura-role="control-toggle"])`;
    css.push(rule(control, { color: prompt.controlForeground, "background-color": prompt.controlResting }));
    css.push(rule(`${control}:hover`, { "background-color": prompt.controlHover }));
    css.push(rule(`${control}:active`, { "background-color": prompt.controlPressed }));
    css.push(rule(`${control}:is([aria-pressed="true"],[aria-checked="true"],[data-state="on"])`, {
      "background-color": prompt.controlSelected,
    }));
    css.push(rule(`${control}:is(:disabled,[aria-disabled="true"])`, { "background-color": prompt.controlDisabled }));
  }
  return css.filter(Boolean).join("\n");
}

export function promptFrameOverrides(interfaceSurfaces, fallback) {
  const wrapper = interfaceSurfaces?.promptBlock;
  if (!wrapper?.frame) return null;
  const base = fallback ?? { widthRatio: 0.64, offsetXRatio: 0, offsetYRatio: 0 };
  const frames = {};
  for (const frame of FRAMES) {
    const resolved = resolveInterfaceSurface(wrapper, { appearance: "light", view: "new-chat", frame });
    frames[frame] = {
      widthRatio: resolved.widthRatio ?? base.widthRatio,
      offsetXRatio: resolved.offsetXRatio ?? base.offsetXRatio,
      offsetYRatio: resolved.offsetYRatio ?? base.offsetYRatio,
    };
  }
  return frames;
}

export function validateLayerFilters(value, label = "filters") {
  if (value === null || value === undefined) return null;
  const ranges = {
    hueDeg: [-180, 180, 0],
    saturation: [0, 2, 1],
    brightness: [0.5, 1.5, 1],
    contrast: [0.5, 1.5, 1],
    blurPx: [0, 24, 0],
  };
  const keys = exactSubset(value, Object.keys(ranges), label);
  const result = {};
  for (const key of keys) {
    const [minimum, maximum, neutral] = ranges[key];
    const normalized = normalizeField(value[key], field("number", { minimum, maximum }), `${label}.${key}`);
    if (normalized !== neutral) result[key] = normalized;
  }
  return Object.keys(result).length ? result : null;
}

export function layerFilterCss(filters) {
  if (!filters) return "";
  return [
    `hue-rotate(${filters.hueDeg ?? 0}deg)`,
    `saturate(${filters.saturation ?? 1})`,
    `brightness(${filters.brightness ?? 1})`,
    `contrast(${filters.contrast ?? 1})`,
    `blur(${filters.blurPx ?? 0}px)`,
  ].join(" ");
}
