// Local, provider-neutral contract for AI-assisted theme drafts.
// Aura never calls a model from this module: it prepares a bounded prompt,
// validates the pasted response, and converts only approved fields into the
// existing Studio mutation protocol.
(() => {
  "use strict";

  const VERSION = 1;
  const MAX_BRIEF_LENGTH = 600;
  const MAX_RESPONSE_LENGTH = 12000;
  const COLOR_PATTERN = /^#[0-9A-F]{6}$/;
  const FONT_UI_IDS = Object.freeze(["system-sans", "humanist-sans", "rounded-sans"]);
  const FONT_DISPLAY_IDS = Object.freeze([...FONT_UI_IDS, "editorial-serif"]);
  const SHADOW_IDS = Object.freeze(["none", "soft", "elevated"]);
  const GREETING_FONT_IDS = FONT_DISPLAY_IDS;
  const GREETING_COLOR_IDS = Object.freeze(["primary", "accent"]);
  const GREETING_WEIGHT_IDS = Object.freeze([300, 400, 500, 600, 650, 700]);
  const GREETING_ALIGN_IDS = Object.freeze(["start", "center", "end"]);
  const GREETING_DECORATION_IDS = Object.freeze(["none", "underline", "hairline", "glow"]);
  const MODE_KEYS = Object.freeze(["canvas", "sidebar", "surface", "text", "accent", "border"]);
  const ROOT_KEYS = Object.freeze(["version", "title", "summary", "light", "dark", "style", "greeting"]);
  const STYLE_KEYS = Object.freeze(["fontUi", "fontDisplay", "radius", "blur", "shadow"]);
  const GREETING_KEYS = Object.freeze([
    "font", "color", "standardSize", "wideSize", "weight", "italic",
    "letterSpacing", "lineHeight", "align", "maxWidthRatio", "xRatio",
    "yRatio", "decoration",
  ]);

  const plainRecord = (value) => Boolean(value && typeof value === "object"
    && !Array.isArray(value) && (Object.getPrototypeOf(value) === null
      || Object.prototype.toString.call(value) === "[object Object]"));
  const exactKeys = (value, keys) => plainRecord(value)
    && Object.keys(value).length === keys.length
    && keys.every((key) => Object.hasOwn(value, key));
  const enumValue = (value, values) => values.includes(value);
  const finiteInRange = (value, minimum, maximum) => Number.isFinite(value)
    && value >= minimum && value <= maximum;
  const boundedText = (value, maximum) => {
    if (typeof value !== "string") return null;
    const text = value.normalize("NFC").trim();
    return text && [...text].length <= maximum
      && !/[\u0000-\u001F\u007F-\u009F]/u.test(text) ? text : null;
  };
  const normalizeColor = (value) => typeof value === "string"
    && /^#[0-9A-Fa-f]{6}$/.test(value) ? value.toUpperCase() : null;

  const rgb = (hex) => [1, 3, 5].map((start) => Number.parseInt(hex.slice(start, start + 2), 16));
  const luminance = (hex) => rgb(hex).map((channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  }).reduce((sum, value, index) => sum + (value * [0.2126, 0.7152, 0.0722][index]), 0);
  const contrast = (left, right) => {
    const values = [luminance(left), luminance(right)].sort((a, b) => b - a);
    return (values[0] + 0.05) / (values[1] + 0.05);
  };

  const cleanBrief = (value) => {
    if (typeof value !== "string") return "";
    return value.normalize("NFC")
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/gu, " ")
      .replace(/\s+/gu, " ")
      .trim()
      .slice(0, MAX_BRIEF_LENGTH);
  };

  const normalizeMode = (value, label, errors) => {
    if (!exactKeys(value, MODE_KEYS)) {
      errors.push(`${label}.shape`);
      return null;
    }
    const result = Object.create(null);
    for (const key of MODE_KEYS) {
      const color = normalizeColor(value[key]);
      if (!color) errors.push(`${label}.${key}`);
      else result[key] = color;
    }
    return Object.keys(result).length === MODE_KEYS.length ? result : null;
  };

  const normalizeStyle = (value, errors) => {
    if (!exactKeys(value, STYLE_KEYS)) {
      errors.push("style.shape");
      return null;
    }
    if (!enumValue(value.fontUi, FONT_UI_IDS)) errors.push("style.fontUi");
    if (!enumValue(value.fontDisplay, FONT_DISPLAY_IDS)) errors.push("style.fontDisplay");
    if (!Number.isInteger(value.radius) || !finiteInRange(value.radius, 0, 32)) errors.push("style.radius");
    if (!Number.isInteger(value.blur) || !finiteInRange(value.blur, 0, 40)) errors.push("style.blur");
    if (!enumValue(value.shadow, SHADOW_IDS)) errors.push("style.shadow");
    return errors.some((error) => error.startsWith("style.")) ? null : { ...value };
  };

  const normalizeGreeting = (value, errors) => {
    if (!exactKeys(value, GREETING_KEYS)) {
      errors.push("greeting.shape");
      return null;
    }
    if (!enumValue(value.font, GREETING_FONT_IDS)) errors.push("greeting.font");
    if (!enumValue(value.color, GREETING_COLOR_IDS)) errors.push("greeting.color");
    if (!Number.isInteger(value.standardSize) || !finiteInRange(value.standardSize, 24, 64)) errors.push("greeting.standardSize");
    if (!Number.isInteger(value.wideSize) || !finiteInRange(value.wideSize, value.standardSize, 72)) errors.push("greeting.wideSize");
    if (!enumValue(value.weight, GREETING_WEIGHT_IDS)) errors.push("greeting.weight");
    if (typeof value.italic !== "boolean") errors.push("greeting.italic");
    if (!finiteInRange(value.letterSpacing, -0.06, 0.12)) errors.push("greeting.letterSpacing");
    if (!finiteInRange(value.lineHeight, 0.9, 1.5)) errors.push("greeting.lineHeight");
    if (!enumValue(value.align, GREETING_ALIGN_IDS)) errors.push("greeting.align");
    if (!finiteInRange(value.maxWidthRatio, 0.35, 0.9)) errors.push("greeting.maxWidthRatio");
    if (!finiteInRange(value.xRatio, -0.45, 0.45)) errors.push("greeting.xRatio");
    if (!finiteInRange(value.yRatio, -0.4, 0.45)) errors.push("greeting.yRatio");
    if (!enumValue(value.decoration, GREETING_DECORATION_IDS)) errors.push("greeting.decoration");
    return errors.some((error) => error.startsWith("greeting.")) ? null : { ...value };
  };

  const contrastErrors = (draft) => {
    const errors = [];
    for (const mode of ["light", "dark"]) {
      const palette = draft[mode];
      if (contrast(palette.canvas, palette.text) < 4.5) errors.push(`${mode}.canvasTextContrast`);
      if (contrast(palette.surface, palette.text) < 4.5) errors.push(`${mode}.surfaceTextContrast`);
      if (contrast(palette.sidebar, palette.text) < 4.5) errors.push(`${mode}.sidebarTextContrast`);
      if (contrast(palette.canvas, palette.accent) < 3) errors.push(`${mode}.accentContrast`);
      if (contrast(palette.canvas, palette.border) < 1.35) errors.push(`${mode}.borderContrast`);
    }
    if (luminance(draft.light.canvas) <= luminance(draft.dark.canvas) + 0.18) {
      errors.push("appearance.separation");
    }
    return errors;
  };

  const normalizeDraft = (value) => {
    const errors = [];
    if (!exactKeys(value, ROOT_KEYS)) return { ok: false, errors: ["draft.shape"], draft: null };
    if (value.version !== VERSION) errors.push("draft.version");
    const title = boundedText(value.title, 80);
    const summary = boundedText(value.summary, 220);
    if (!title) errors.push("draft.title");
    if (!summary) errors.push("draft.summary");
    const light = normalizeMode(value.light, "light", errors);
    const dark = normalizeMode(value.dark, "dark", errors);
    const style = normalizeStyle(value.style, errors);
    const greeting = normalizeGreeting(value.greeting, errors);
    const draft = light && dark && style && greeting && title && summary
      ? { version: VERSION, title, summary, light, dark, style, greeting }
      : null;
    if (draft) errors.push(...contrastErrors(draft));
    return { ok: errors.length === 0, errors, draft: errors.length === 0 ? draft : null };
  };

  const parseDraft = (input) => {
    if (typeof input !== "string" || !input.trim() || input.length > MAX_RESPONSE_LENGTH) {
      return { ok: false, errors: ["draft.input"], draft: null };
    }
    let source = input.trim();
    const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/iu.exec(source);
    if (fenced) source = fenced[1].trim();
    let value;
    try { value = JSON.parse(source); }
    catch { return { ok: false, errors: ["draft.json"], draft: null }; }
    return normalizeDraft(value);
  };

  const jsonShape = `{
  "version": 1,
  "title": "2-80 characters",
  "summary": "one plain sentence, 1-220 characters",
  "light": { "canvas": "#RRGGBB", "sidebar": "#RRGGBB", "surface": "#RRGGBB", "text": "#RRGGBB", "accent": "#RRGGBB", "border": "#RRGGBB" },
  "dark": { "canvas": "#RRGGBB", "sidebar": "#RRGGBB", "surface": "#RRGGBB", "text": "#RRGGBB", "accent": "#RRGGBB", "border": "#RRGGBB" },
  "style": { "fontUi": "system-sans|humanist-sans|rounded-sans", "fontDisplay": "system-sans|humanist-sans|rounded-sans|editorial-serif", "radius": 0, "blur": 0, "shadow": "none|soft|elevated" },
  "greeting": { "font": "system-sans|humanist-sans|rounded-sans|editorial-serif", "color": "primary|accent", "standardSize": 38, "wideSize": 46, "weight": 600, "italic": false, "letterSpacing": -0.02, "lineHeight": 1.08, "align": "center|start|end", "maxWidthRatio": 0.62, "xRatio": 0, "yRatio": -0.03, "decoration": "none|underline|hairline|glow" }
}`;

  const buildPrompt = ({ brief, baseTheme = "Default" } = {}) => {
    const cleaned = cleanBrief(brief);
    if (!cleaned) return "";
    const base = boundedText(baseTheme, 80) ?? "Default";
    return [
      "Create one Claude Aura theme draft from the brief below.",
      "Return only one JSON object with the exact keys and value types shown. Do not use a code fence.",
      "Do not add CSS, image URLs, file paths, model commentary, account data, or extra keys.",
      "Use six-digit HEX colours. Keep body text contrast at least 4.5:1 against canvas, surface, and sidebar; keep accent contrast at least 3:1 against canvas.",
      "Make Light visibly lighter than Dark. Treat the greeting as the theme's typographic signature, not decoration layered over the composer.",
      `Base direction: ${base}`,
      `User brief: ${cleaned}`,
      "Exact response schema:",
      jsonShape,
    ].join("\n\n");
  };

  const normalizeFrames = (frames) => {
    if (!Array.isArray(frames) || !frames.length || frames.length > 6) {
      return [{ id: "standard", width: 1180 }, { id: "wide", width: 1560 }];
    }
    const result = frames.flatMap((frame) => plainRecord(frame)
      && typeof frame.id === "string" && /^[a-z][a-z0-9-]{0,31}$/.test(frame.id)
      && finiteInRange(frame.width, 920, 3840)
      ? [{ id: frame.id, width: frame.width }] : []);
    return result.length === frames.length ? result : [
      { id: "standard", width: 1180 }, { id: "wide", width: 1560 },
    ];
  };

  const toPatchChanges = (draft, { frames = null } = {}) => {
    const normalized = normalizeDraft(draft);
    if (!normalized.ok) return { ok: false, errors: normalized.errors, changes: [] };
    const value = normalized.draft;
    const changes = [
      { kind: "metadata", field: "label", locale: "en", value: value.title },
      { kind: "metadata", field: "description", locale: "en", value: value.summary },
    ];
    for (const mode of ["light", "dark"]) {
      for (const token of MODE_KEYS) {
        changes.push({ kind: "token", mode, token, value: value[mode][token] });
      }
    }
    for (const token of STYLE_KEYS) {
      changes.push({ kind: "token", mode: "shared", token, value: value.style[token] });
    }
    const layoutFrames = normalizeFrames(frames);
    const widths = layoutFrames.map(({ width }) => width);
    const minimum = Math.min(...widths);
    const maximum = Math.max(...widths);
    for (const appearance of ["light", "dark"]) {
      for (const frame of layoutFrames) {
        const ratio = maximum === minimum ? 0 : (frame.width - minimum) / (maximum - minimum);
        changes.push({
          kind: "greeting",
          operation: "set-frame",
          appearance,
          frame: frame.id,
          value: {
            font: value.greeting.font,
            color: value.greeting.color,
            fontSize: Math.round(value.greeting.standardSize
              + ((value.greeting.wideSize - value.greeting.standardSize) * ratio)),
            weight: value.greeting.weight,
            italic: value.greeting.italic,
            letterSpacing: value.greeting.letterSpacing,
            lineHeight: value.greeting.lineHeight,
            align: value.greeting.align,
            maxWidthRatio: Number(Math.max(0.35, value.greeting.maxWidthRatio - (0.06 * ratio)).toFixed(3)),
            xRatio: value.greeting.xRatio,
            yRatio: value.greeting.yRatio,
            decoration: value.greeting.decoration,
            markSource: "none",
            markScale: 1,
          },
        });
      }
    }
    return { ok: true, errors: [], changes };
  };

  window.CLAUDE_AURA_THEME_ASSISTANT = Object.freeze({
    version: VERSION,
    limits: Object.freeze({ brief: MAX_BRIEF_LENGTH, response: MAX_RESPONSE_LENGTH }),
    cleanBrief,
    buildPrompt,
    parseDraft,
    normalizeDraft,
    toPatchChanges,
    contrast,
  });
})();
