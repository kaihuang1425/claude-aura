// WO-18 Aura Studio visual theme editor. Host access stays in app.js.
(() => {
  "use strict";

  // Editor copy lives one file per language in studio/locales/*.js, loaded
  // before this script. Those files also carry the Studio page copy that
  // studio/app.js reads; only the "editor" half belongs here.
  const STRINGS = Object.fromEntries(
    Object.entries(window.CLAUDE_AURA_STRINGS ?? {}).map(([tag, copy]) => [tag, copy?.editor ?? {}]),
  );

  const ID_PATTERN = /^[a-z][a-z0-9-]{1,39}$/;
  const LAYER_ID_PATTERN = /^layer-[a-f0-9]{32}$/;
  const SESSION_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
  const COLOR_PATTERN = /^#[0-9A-F]{6}$/;
  const LAUNCHER_ASSET_PATTERN = /^(?:assets\/theme-art\/(?:default|japanese-film-editorial|korean-prestige|cartoon-studio|anime-twilight|study-library|japanese-idol|korean-idol)\/launcher-mark\.png|launcher-mark\.png)$/;
  const PREVIEW_PATH_PATTERN = /^\/active\/(?:[a-z0-9][a-z0-9-]{0,63}\/)*[a-z0-9][a-z0-9-]{0,80}\.webp$/;
  const ACTIONS = new Set([
    "create-theme-copy", "begin-theme-edit", "set-theme-token", "set-theme-layer", "apply-theme-patch",
    "pick-theme-layer-image", "pick-theme-launcher-mark", "remove-theme-layer", "move-theme-layer", "undo-theme-edit",
    "redo-theme-edit", "save-theme-edit", "discard-theme-edit", "delete-user-theme",
    "set-greeting-phrases", "reset-greeting",
  ]);
  const MODE_TOKEN_KEYS = Object.freeze([
    "canvas", "sidebar", "surface", "text", "accent", "border", "surfaceAlpha", "sidebarAlpha",
  ]);
  const STUDIO_STYLE_COLOR_KEYS = Object.freeze([
    "canvas", "sidebar", "surface", "raised", "text", "textSecondary", "textMuted",
    "sidebarText", "sidebarTextMuted", "accent", "accentText", "border", "focus",
  ]);
  const STUDIO_STYLE_MODE_KEYS = Object.freeze([
    ...STUDIO_STYLE_COLOR_KEYS, "surfaceAlpha", "sidebarAlpha",
  ]);
  const COLOR_TOKEN_KEYS = new Set(MODE_TOKEN_KEYS.slice(0, 6));
  const FONT_UI_IDS = Object.freeze(["system-sans", "humanist-sans", "rounded-sans"]);
  const FONT_DISPLAY_IDS = Object.freeze([...FONT_UI_IDS, "editorial-serif"]);
  const SHADOW_IDS = Object.freeze(["none", "soft", "elevated"]);
  // WO-21 greeting style projection. Every Light/Dark x Standard/Wide frame is
  // explicit so a control always edits the same frame the stage is showing.
  const GREETING_FONT_IDS = Object.freeze(["system-sans", "humanist-sans", "rounded-sans", "editorial-serif"]);
  const GREETING_COLOR_IDS = Object.freeze(["primary", "accent"]);
  const GREETING_ALIGN_IDS = Object.freeze(["start", "center", "end"]);
  const GREETING_DECORATION_IDS = Object.freeze(["none", "underline", "hairline", "glow"]);
  const GREETING_MARK_IDS = Object.freeze(["none", "native", "compact"]);
  const GREETING_WEIGHT_IDS = Object.freeze([300, 400, 500, 600, 650, 700]);
  const GREETING_ENUM_FIELDS = Object.freeze({
    font: GREETING_FONT_IDS,
    color: GREETING_COLOR_IDS,
    align: GREETING_ALIGN_IDS,
    decoration: GREETING_DECORATION_IDS,
    markSource: GREETING_MARK_IDS,
  });
  const GREETING_NUMERIC_FIELDS = Object.freeze({
    fontSize: [24, 72],
    letterSpacing: [-0.06, 0.12],
    lineHeight: [0.9, 1.5],
    maxWidthRatio: [0.35, 0.9],
    xRatio: [-0.45, 0.45],
    yRatio: [-0.4, 0.45],
    markScale: [0.5, 1.5],
  });
  const GREETING_FRAME_KEYS = Object.freeze([
    "font", "color", "fontSize", "weight", "italic", "align", "letterSpacing",
    "lineHeight", "maxWidthRatio", "xRatio", "yRatio", "decoration", "markSource", "markScale",
  ]);
  const GREETING_STATE_KEYS = Object.freeze(["native", "compactMarkAvailable", "frames"]);
  const GREETING_MAX_COMPILED_BYTES = 2048;
  const THEME_ORIGINAL = "theme-original";
  const ROLE_IDS = Object.freeze(["background", "hero", "corner", "decoration"]);
  const APPEARANCE_IDS = Object.freeze(["all", "light", "dark"]);
  const CONTEXT_IDS = Object.freeze(["all", "new-chat", "conversation"]);
  const VIEWPORT_IDS = Object.freeze(["all", "normal", "wide"]);
  const MASK_IDS = Object.freeze(["none", "soft-right"]);
  const MOBILE_IDS = Object.freeze(["keep", "reduce", "hide"]);
  const ANCHOR_IDS = Object.freeze([
    "top-left", "top", "top-right", "left", "center", "right", "bottom-left", "bottom", "bottom-right",
  ]);
  const ANCHOR_OPTIONS = Object.freeze([
    ["top-left", "anchorTopLeft"], ["top", "anchorTop"], ["top-right", "anchorTopRight"],
    ["left", "anchorLeft"], ["center", "anchorCenter"], ["right", "anchorRight"],
    ["bottom-left", "anchorBottomLeft"], ["bottom", "anchorBottom"], ["bottom-right", "anchorBottomRight"],
  ]);
  const CONTRAST_IDS = new Set([
    "canvas-text", "surface-text", "muted-text", "accent-outline", "accent-text", "sidebar-text", "focus",
  ]);
  const CONTRAST_LABEL_KEYS = Object.freeze({
    "canvas-text": "contrastCanvasText",
    "surface-text": "contrastSurfaceText",
    "muted-text": "contrastMutedText",
    "accent-outline": "contrastAccentOutline",
    "accent-text": "contrastAccentText",
    "sidebar-text": "contrastSidebarText",
    focus: "contrastFocus",
  });
  const TOKEN_GROUPS = Object.freeze([
    { label: "groupCanvas", fields: [["canvas", "canvasColor"]] },
    { label: "groupSidebar", fields: [["sidebar", "sidebarColor"], ["sidebarAlpha", "sidebarAlpha"]] },
    { label: "groupSurface", fields: [["surface", "surfaceColor"], ["surfaceAlpha", "surfaceAlpha"]] },
    { label: "groupText", fields: [["text", "textColor"]] },
    { label: "groupAccent", fields: [["accent", "accentColor"]] },
    { label: "groupBorder", fields: [["border", "borderColor"]] },
  ]);
  const FONT_UI_OPTIONS = Object.freeze([
    ["system-sans", "fontSystemSans"], ["humanist-sans", "fontHumanistSans"], ["rounded-sans", "fontRoundedSans"],
  ]);
  const FONT_DISPLAY_OPTIONS = Object.freeze([
    ...FONT_UI_OPTIONS, ["editorial-serif", "fontEditorialSerif"],
  ]);
  const SHADOW_OPTIONS = Object.freeze([
    ["none", "shadowNone"], ["soft", "shadowSoft"], ["elevated", "shadowElevated"],
  ]);
  const SLOT_OPTIONS = Object.freeze([
    ["background", "slotBackground"], ["hero", "slotHero"],
    ["corner-top-right", "slotCornerTopRight"], ["corner-bottom", "slotCornerBottom"],
    ["card-1", "slotCard1"], ["card-2", "slotCard2"], ["card-3", "slotCard3"],
    ["brand-mark", "slotBrandMark"], ["launcher-mark", "slotLauncherMark"],
  ]);
  const GREETING_FONT_OPTIONS = Object.freeze([
    ["system-sans", "fontSystemSans"], ["humanist-sans", "fontHumanistSans"],
    ["rounded-sans", "fontRoundedSans"], ["editorial-serif", "fontEditorialSerif"],
  ]);
  const GREETING_COLOR_OPTIONS = Object.freeze([
    ["primary", "greetingColorPrimary"], ["accent", "greetingColorAccent"],
  ]);
  const GREETING_WEIGHT_OPTIONS = Object.freeze([
    ["300", "greetingWeightLight"], ["400", "greetingWeightRegular"], ["500", "greetingWeightMedium"],
    ["600", "greetingWeightSemibold"], ["650", "greetingWeightStrong"], ["700", "greetingWeightBold"],
  ]);
  const GREETING_ALIGN_OPTIONS = Object.freeze([
    ["start", "greetingAlignStart"], ["center", "greetingAlignCenter"], ["end", "greetingAlignEnd"],
  ]);
  const GREETING_DECORATION_OPTIONS = Object.freeze([
    ["none", "greetingDecorationNone"], ["underline", "greetingDecorationUnderline"],
    ["hairline", "greetingDecorationHairline"], ["glow", "greetingDecorationGlow"],
  ]);
  const GREETING_MARK_OPTIONS = Object.freeze([
    ["none", "greetingMarkNone"], ["native", "greetingMarkNative"], ["compact", "greetingMarkCompact"],
  ]);
  // Mirrors STUDIO_FONT_DISPLAY_STACKS so the in-panel sample uses the same families
  // the compiled greeting CSS resolves through --aura-font-display.
  const GREETING_FONT_STACKS = Object.freeze({
    "system-sans": "system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif",
    "humanist-sans": "\"Segoe UI\", \"Hiragino Sans\", \"Yu Gothic UI\", system-ui, sans-serif",
    "rounded-sans": "\"Trebuchet MS\", \"Segoe UI\", system-ui, sans-serif",
    "editorial-serif": "ui-serif, Georgia, \"Times New Roman\", serif",
  });

  // Stage geometry mirrors assets/renderer-inject.js: the live renderer marks
  // its effective normal/wide viewport, anchors are container percentage
  // points, and framed images keep their natural pixel size inside a uniformly
  // scaled logical canvas. The logical sizes equal the host's set-aura-preview
  // client sizes so the stage and the real Aura window show the same geometry.
  const STAGE_SIZES = Object.freeze({ normal: [1180, 640], wide: [1560, 940] });
  const STAGE_SIDEBAR_WIDTH = 280;
  const STAGE_PROMPT_HEIGHT = 140;
  const ANCHOR_POINTS = Object.freeze({
    "top-left": [0, 0], top: [50, 0], "top-right": [100, 0],
    left: [0, 50], center: [50, 50], right: [100, 50],
    "bottom-left": [0, 100], bottom: [50, 100], "bottom-right": [100, 100],
  });
  const STAGE_FONT_STACKS = Object.freeze({
    "system-sans": 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    "humanist-sans": '"Segoe UI", "Hiragino Sans", "Yu Gothic UI", system-ui, sans-serif',
    "rounded-sans": '"Trebuchet MS", "Segoe UI", system-ui, sans-serif',
    "editorial-serif": 'ui-serif, Georgia, "Times New Roman", serif',
  });
  const STAGE_SHADOWS = Object.freeze({
    none: "none",
    soft: "0 18px 42px rgb(20 18 12 / 0.16)",
    elevated: "0 30px 72px rgb(20 18 12 / 0.28)",
  });
  const STAGE_LAYER_PATHS = Object.freeze(["positionX", "positionY", "scale"]);
  const STAGE_PROMPT_TOKENS = Object.freeze({ width: "promptWidth", x: "promptX", y: "promptY" });
  const STAGE_PROMPT_PATHS = Object.freeze([
    "shared.prompt.x", "shared.prompt.y", "shared.prompt.width",
  ]);
  const CONTRAST_TOKEN_MAP = Object.freeze({
    canvas: ["canvas-text"],
    surface: ["surface-text", "muted-text"],
    text: ["canvas-text", "surface-text", "sidebar-text"],
    accent: ["accent-outline", "accent-text", "focus"],
    sidebar: ["sidebar-text"],
    border: [],
  });

  // Shared by the stage and the state matrix so every scene uses one geometry.
  const promptRect = (logicalWidth, logicalHeight, widthRatio, xRatio, yRatio) => {
    const mainLeft = STAGE_SIDEBAR_WIDTH;
    const mainWidth = logicalWidth - STAGE_SIDEBAR_WIDTH;
    const width = Math.min(mainWidth - 32, Math.max(280, mainWidth * widthRatio));
    const center = mainLeft + (mainWidth / 2) + (mainWidth * xRatio);
    const left = Math.min(logicalWidth - 16 - width, Math.max(mainLeft + 16, center - (width / 2)));
    const top = Math.min(logicalHeight - 16 - STAGE_PROMPT_HEIGHT,
      Math.max(16, (logicalHeight * 0.56) + (logicalHeight * yRatio)));
    return { left, top, width, height: STAGE_PROMPT_HEIGHT };
  };

  // Renderer prompt offsets use the visible portion of Claude's main canvas,
  // after clipping it to the viewport. Keep the same bounds in Studio so a
  // ratio maps to the same live pixels even when the canvas starts offscreen
  // or is shorter than the WebView.
  const clampedMirrorMainMetrics = (main, logicalWidth, logicalHeight) => {
    if (!main || !Number.isFinite(logicalWidth) || !Number.isFinite(logicalHeight)
        || !["left", "top", "width", "height"].every((key) => Number.isFinite(main[key]))) return null;
    const left = Math.max(0, main.left);
    const top = Math.max(0, main.top);
    const right = Math.min(logicalWidth, main.left + main.width);
    const bottom = Math.min(logicalHeight, main.top + main.height);
    const width = right - left;
    const height = bottom - top;
    return width > 100 && height > 100 ? { left, top, width, height } : null;
  };

  const plainRecord = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
  const finite = (value) => typeof value === "number" && Number.isFinite(value);
  const inRange = (value, minimum, maximum) => finite(value) && value >= minimum && value <= maximum;
  const integer = (value, minimum, maximum) => Number.isInteger(value) && value >= minimum && value <= maximum;
  const exactShape = (value, required, optional = []) => {
    if (!plainRecord(value)) return false;
    const allowed = new Set([...required, ...optional]);
    const keys = Object.keys(value);
    return required.every((key) => Object.hasOwn(value, key)) && keys.every((key) => allowed.has(key));
  };
  const enumValue = (value, values) => typeof value === "string" && values.includes(value);
  const safeText = (value, maximum, { empty = false } = {}) => {
    if (typeof value !== "string" || value.length > maximum) return null;
    const text = value.trim();
    return text || (empty ? "" : null);
  };
  const format = (template, ...values) => values.reduce(
    (result, value, index) => result.replaceAll(`{${index}}`, String(value)), template);
  const formatBytes = (value) => value >= 1_000_000
    ? `${(value / 1_000_000).toFixed(2)} MB`
    : `${Math.max(0, Math.round(value / 1000))} KB`;

  const CAPABILITY_BRANCHES = Object.freeze(["interface", "background", "widgets"]);
  const CAPABILITY_VIEWS = Object.freeze(["new-chat", "conversation"]);
  const CAPABILITY_AXES = Object.freeze(["appearance", "view", "frame"]);
  const CAPABILITY_CAPTURE_GEOMETRY = Object.freeze([
    "none", "full-canvas", "new-chat-area", "artwork-layer", "local-preview",
  ]);
  const CAPABILITY_SELECTION_BEHAVIOR = Object.freeze([
    "picker", "stage-prompt", "stage-greeting", "stage-layer",
  ]);
  const CAPABILITY_TARGETS = Object.freeze({
    "interface.theme": Object.freeze({ branch: "interface", labelKey: "targetInterfaceTheme" }),
    "interface.new-chat-area": Object.freeze({ branch: "interface", labelKey: "targetNewChatArea" }),
    "interface.greeting": Object.freeze({ branch: "interface", labelKey: "targetGreeting" }),
    "background.canvas": Object.freeze({ branch: "background", labelKey: "targetBackgroundCanvas" }),
    "background.layer": Object.freeze({ branch: "background", labelKey: "targetBackgroundLayer" }),
    "widgets.app-identity": Object.freeze({ branch: "widgets", labelKey: "targetAppIdentity" }),
  });

  function normalizeCapabilityRegistry(value) {
    if (!Array.isArray(value) || value.length !== Object.keys(CAPABILITY_TARGETS).length) return null;
    const normalized = [];
    const ids = new Set();
    for (const entry of value) {
      if (!exactShape(entry, [
        "id", "branch", "views", "axes", "captureGeometry", "selectionBehavior",
      ]) || !Object.hasOwn(CAPABILITY_TARGETS, entry.id)
          || CAPABILITY_TARGETS[entry.id].branch !== entry.branch
          || !CAPABILITY_BRANCHES.includes(entry.branch)
          || !Array.isArray(entry.views) || !entry.views.length
          || !Array.isArray(entry.axes)
          || !CAPABILITY_CAPTURE_GEOMETRY.includes(entry.captureGeometry)
          || !CAPABILITY_SELECTION_BEHAVIOR.includes(entry.selectionBehavior)
          || ids.has(entry.id)) return null;
      if (entry.views.some((view) => !CAPABILITY_VIEWS.includes(view))
          || new Set(entry.views).size !== entry.views.length
          || entry.axes.some((axis) => !CAPABILITY_AXES.includes(axis))
          || new Set(entry.axes).size !== entry.axes.length) return null;
      ids.add(entry.id);
      normalized.push(Object.freeze({
        id: entry.id,
        branch: entry.branch,
        views: Object.freeze([...entry.views]),
        axes: Object.freeze([...entry.axes]),
        captureGeometry: entry.captureGeometry,
        selectionBehavior: entry.selectionBehavior,
      }));
    }
    if (Object.keys(CAPABILITY_TARGETS).some((id) => !ids.has(id))) return null;
    return Object.freeze(normalized);
  }

  const EDITOR_CAPABILITY_REGISTRY = normalizeCapabilityRegistry([
    {
      id: "interface.theme",
      branch: "interface",
      views: ["new-chat", "conversation"],
      axes: ["appearance"],
      captureGeometry: "none",
      selectionBehavior: "picker",
    },
    {
      id: "interface.new-chat-area",
      branch: "interface",
      views: ["new-chat"],
      axes: [],
      captureGeometry: "new-chat-area",
      selectionBehavior: "stage-prompt",
    },
    {
      id: "interface.greeting",
      branch: "interface",
      views: ["new-chat"],
      axes: ["appearance", "frame"],
      captureGeometry: "new-chat-area",
      selectionBehavior: "stage-greeting",
    },
    {
      id: "background.canvas",
      branch: "background",
      views: ["new-chat", "conversation"],
      axes: ["appearance", "view"],
      captureGeometry: "full-canvas",
      selectionBehavior: "picker",
    },
    {
      id: "background.layer",
      branch: "background",
      views: ["new-chat", "conversation"],
      axes: ["appearance", "view", "frame"],
      captureGeometry: "artwork-layer",
      selectionBehavior: "stage-layer",
    },
    {
      id: "widgets.app-identity",
      branch: "widgets",
      views: ["new-chat", "conversation"],
      axes: [],
      captureGeometry: "local-preview",
      selectionBehavior: "picker",
    },
  ]);
  if (!EDITOR_CAPABILITY_REGISTRY) throw new Error("Invalid Aura editor capability registry");
  const CAPABILITY_BY_ID = new Map(EDITOR_CAPABILITY_REGISTRY.map((entry) => [entry.id, entry]));

  function normalizePreviewUrl(value) {
    if (value === null) return null;
    if (typeof value !== "string" || value.length > 320) return undefined;
    try {
      const url = new URL(value);
      if (url.origin !== "https://aura.editor" || url.username || url.password
          || !PREVIEW_PATH_PATTERN.test(url.pathname)) return undefined;
      if (!/^\?v=[a-f0-9]{32,64}$/.test(url.search) || url.hash) return undefined;
      return url.href;
    } catch { return undefined; }
  }

  function normalizeModeTokens(value) {
    if (!exactShape(value, MODE_TOKEN_KEYS)) return null;
    const result = Object.create(null);
    for (const key of MODE_TOKEN_KEYS) {
      if (COLOR_TOKEN_KEYS.has(key)) {
        if (typeof value[key] !== "string" || !COLOR_PATTERN.test(value[key])) return null;
        result[key] = value[key];
      } else {
        const minimum = key === "surfaceAlpha" ? 0.35 : 0.62;
        if (!inRange(value[key], minimum, 1)) return null;
        result[key] = value[key];
      }
    }
    return result;
  }

  function normalizeGreeting(value) {
    if (!exactShape(value, GREETING_STATE_KEYS)
        || typeof value.native !== "boolean"
        || typeof value.compactMarkAvailable !== "boolean"
        || !exactShape(value.frames, ["light", "dark"])) return null;
    const frames = {};
    for (const appearance of ["light", "dark"]) {
      if (!exactShape(value.frames[appearance], ["standard", "wide"])) return null;
      frames[appearance] = {};
      for (const frame of ["standard", "wide"]) {
        const candidate = value.frames[appearance][frame];
        if (!exactShape(candidate, GREETING_FRAME_KEYS)
            || typeof candidate.italic !== "boolean"
            || !GREETING_WEIGHT_IDS.includes(candidate.weight)) return null;
        for (const [field, ids] of Object.entries(GREETING_ENUM_FIELDS)) {
          if (!enumValue(candidate[field], ids)) return null;
        }
        for (const [field, [minimum, maximum]] of Object.entries(GREETING_NUMERIC_FIELDS)) {
          if (!inRange(candidate[field], minimum, maximum)) return null;
        }
        if (!value.compactMarkAvailable && candidate.markSource === "compact") return null;
        frames[appearance][frame] = { ...candidate };
      }
    }
    return {
      native: value.native,
      compactMarkAvailable: value.compactMarkAvailable,
      frames,
    };
  }

  // WO-21 personal greeting envelope. Host-owned config, not theme data: it carries no
  // session or revision and is validated independently of the theme document.
  function normalizeGreetingPreferences(value) {
    if (!exactShape(value, [
      "enabled", "source", "displayName", "globalPhrases", "themeOverrides", "shuffle",
    ])
        || typeof value.enabled !== "boolean"
        || !enumValue(value.source, ["claude", "custom"])
        || !Array.isArray(value.globalPhrases) || value.globalPhrases.length > 12
        || !plainRecord(value.themeOverrides) || Object.keys(value.themeOverrides).length > 64) return null;
    if (typeof value.displayName !== "string") return null;
    const displayName = value.displayName.normalize("NFC").trim();
    if ([...displayName].length > 40
        || /[\u0000-\u001F\u007F-\u009F]/u.test(displayName)) return null;
    const normalizePhrases = (value) => {
      if (!Array.isArray(value) || value.length > 12) return null;
      const phrases = [];
      for (const phrase of value) {
        if (typeof phrase !== "string") return null;
        const text = phrase.normalize("NFC").trim();
        if (!text || [...text].length > 120
            || /[\u0000-\u001F\u007F-\u009F]/u.test(text)
            || (text.match(/\{name\}/gu) ?? []).length > 1
            || /[{}]/u.test(text.replace(/\{name\}/gu, ""))) return null;
        if (phrases.includes(text)) return null;
        phrases.push(text);
      }
      return phrases;
    };
    const globalPhrases = normalizePhrases(value.globalPhrases);
    if (!globalPhrases) return null;
    const themeOverrides = {};
    for (const [themeId, override] of Object.entries(value.themeOverrides)) {
      if (!ID_PATTERN.test(themeId)
          || !exactShape(override, ["mode", "phrases"])
          || !enumValue(override.mode, ["global", "claude", "custom"])) return null;
      const phrases = normalizePhrases(override.phrases);
      if (!phrases || (override.mode === "custom" && !phrases.length)) return null;
      themeOverrides[themeId] = { mode: override.mode, phrases };
    }
    let shuffle = null;
    if (value.shuffle !== null) {
      if (!exactShape(value.shuffle, ["themeId", "phraseDigest", "order", "cursor", "lastIndex"])
          || !ID_PATTERN.test(value.shuffle.themeId)
          || !/^[a-f0-9]{64}$/.test(value.shuffle.phraseDigest)
          || !Array.isArray(value.shuffle.order) || value.shuffle.order.length > 12
          || new Set(value.shuffle.order).size !== value.shuffle.order.length
          || value.shuffle.order.some((index) => !integer(index, 0, 11))
          || !integer(value.shuffle.cursor, 0, value.shuffle.order.length)
          || (value.shuffle.lastIndex !== null && !integer(value.shuffle.lastIndex, 0, 11))) return null;
      shuffle = {
        themeId: value.shuffle.themeId,
        phraseDigest: value.shuffle.phraseDigest,
        order: [...value.shuffle.order],
        cursor: value.shuffle.cursor,
        lastIndex: value.shuffle.lastIndex,
      };
    }
    return {
      enabled: value.enabled,
      source: value.source,
      displayName,
      globalPhrases,
      themeOverrides,
      shuffle,
    };
  }

  // Blank lines are the only input that may be ignored. Rejecting the complete
  // textarea avoids silently saving a shortened or otherwise different list.
  function parseGreetingPhrases(text) {
    const phrases = [];
    for (const line of String(text ?? "").split(/\r?\n/u)) {
      const phrase = line.normalize("NFC").trim();
      if (!phrase) continue;
      if (phrases.length === 12 || phrases.includes(phrase)
          || /[\u0000-\u001F\u007F-\u009F]/u.test(phrase)
          || [...phrase].length > 120
          || (phrase.match(/\{name\}/gu) ?? []).length > 1
          || /[{}]/u.test(phrase.replace(/\{name\}/gu, ""))) return null;
      phrases.push(phrase);
    }
    return phrases;
  }

  function normalizeShared(value) {
    const keys = ["fontUi", "fontDisplay", "radius", "blur", "shadow", "backgroundScope", "prompt", "greeting", "inherited"];
    const inheritedKeys = ["fontUi", "fontDisplay", "radius", "shadow"];
    if (!exactShape(value, keys) || !exactShape(value.prompt, ["native", "width", "x", "y"])
        || !exactShape(value.inherited, inheritedKeys)
        || inheritedKeys.some((key) => typeof value.inherited[key] !== "boolean")) return null;
    const greeting = normalizeGreeting(value.greeting);
    if (!greeting || !enumValue(value.fontUi, FONT_UI_IDS) || !enumValue(value.fontDisplay, FONT_DISPLAY_IDS)
        || !inRange(value.radius, 0, 32) || !inRange(value.blur, 0, 40)
        || !enumValue(value.shadow, SHADOW_IDS) || !enumValue(value.backgroundScope, ["content", "full-window"])
        || !inRange(value.prompt.width, 0.4, 0.96) || !inRange(value.prompt.x, -0.35, 0.35)
        || typeof value.prompt.native !== "boolean"
        || !inRange(value.prompt.y, -0.3, 0.3)) return null;
    return {
      fontUi: value.fontUi,
      fontDisplay: value.fontDisplay,
      radius: value.radius,
      blur: value.blur,
      shadow: value.shadow,
      backgroundScope: value.backgroundScope,
      prompt: {
        native: value.prompt.native,
        width: value.prompt.width,
        x: value.prompt.x,
        y: value.prompt.y,
      },
      greeting,
      inherited: {
        fontUi: value.inherited.fontUi,
        fontDisplay: value.inherited.fontDisplay,
        radius: value.inherited.radius,
        shadow: value.inherited.shadow,
      },
    };
  }

  function normalizeStudioStyle(value) {
    if (!exactShape(value, ["light", "dark", "shared"])
        || !exactShape(value.shared, ["fontUi", "fontDisplay", "radius", "blur", "shadow"])) return null;
    const modes = Object.create(null);
    for (const mode of ["light", "dark"]) {
      const source = value[mode];
      if (!exactShape(source, STUDIO_STYLE_MODE_KEYS)) return null;
      const normalized = Object.create(null);
      for (const key of STUDIO_STYLE_COLOR_KEYS) {
        if (typeof source[key] !== "string" || !COLOR_PATTERN.test(source[key])) return null;
        normalized[key] = source[key];
      }
      if (!inRange(source.surfaceAlpha, 0, 1) || !inRange(source.sidebarAlpha, 0, 1)) return null;
      normalized.surfaceAlpha = source.surfaceAlpha;
      normalized.sidebarAlpha = source.sidebarAlpha;
      modes[mode] = normalized;
    }
    if (!enumValue(value.shared.fontUi, FONT_UI_IDS)
        || !enumValue(value.shared.fontDisplay, FONT_DISPLAY_IDS)
        || !inRange(value.shared.radius, 0, 32) || !inRange(value.shared.blur, 0, 40)
        || !enumValue(value.shared.shadow, SHADOW_IDS)) return null;
    return {
      light: modes.light,
      dark: modes.dark,
      shared: {
        fontUi: value.shared.fontUi,
        fontDisplay: value.shared.fontDisplay,
        radius: value.shared.radius,
        blur: value.shared.blur,
        shadow: value.shared.shadow,
      },
    };
  }

  function normalizeLauncher(value) {
    const keys = [
      "asset", "surface", "surfaceHover", "foreground", "accent", "border", "radius", "borderWidth",
    ];
    if (!exactShape(value, keys) || typeof value.asset !== "string"
        || !LAUNCHER_ASSET_PATTERN.test(value.asset) || !inRange(value.radius, 8, 24)
        || !inRange(value.borderWidth, 1, 3)) return null;
    for (const key of ["surface", "surfaceHover", "foreground", "accent", "border"]) {
      if (typeof value[key] !== "string" || !COLOR_PATTERN.test(value[key])) return null;
    }
    return { ...value };
  }

  function normalizeLauncherPreviewUrl(value) {
    if (typeof value !== "string") return null;
    if (/^https:\/\/aura\.assets\/(?:default|japanese-film-editorial|korean-prestige|cartoon-studio|anime-twilight|study-library|japanese-idol|korean-idol)\/launcher-mark\.png$/.test(value)) return value;
    if (/^https:\/\/aura\.editor\/active\/launcher-[a-f0-9]{64}\.png$/.test(value)) return value;
    return null;
  }

  function normalizeFrame(value) {
    const keys = ["anchor", "focalX", "focalY", "positionX", "positionY", "scale"];
    if (!exactShape(value, keys) || !enumValue(value.anchor, ANCHOR_IDS)
        || !inRange(value.focalX, 0, 100) || !inRange(value.focalY, 0, 100)
        || !inRange(value.positionX, -100, 100) || !inRange(value.positionY, -100, 100)
        || !inRange(value.scale, 0.25, 3)) return null;
    return { ...value };
  }

  function normalizeLayer(value, expectedIndex) {
    const keys = [
      "id", "index", "role", "appearance", "context", "viewport", "visible", "opacity", "mask", "mobile",
      "bytes", "previewUrl", "frames",
    ];
    if (!exactShape(value, keys) || !LAYER_ID_PATTERN.test(value.id)
        || value.index !== expectedIndex || !integer(value.index, 0, 7)
        || !enumValue(value.role, ROLE_IDS) || !enumValue(value.appearance, APPEARANCE_IDS)
        || !enumValue(value.context, CONTEXT_IDS) || !enumValue(value.viewport, VIEWPORT_IDS)
        || typeof value.visible !== "boolean" || !inRange(value.opacity, 0, 1)
        || !enumValue(value.mask, MASK_IDS) || !enumValue(value.mobile, MOBILE_IDS)
        || !integer(value.bytes, 0, 400_000) || !exactShape(value.frames, ["normal", "wide"])) return null;
    const previewUrl = normalizePreviewUrl(value.previewUrl);
    const normal = normalizeFrame(value.frames.normal);
    const wide = normalizeFrame(value.frames.wide);
    if (previewUrl === undefined || !normal || !wide) return null;
    return { ...value, previewUrl, frames: { normal, wide } };
  }

  function normalizeMetadata(value) {
    const locales = ["en", "zh-CN", "zh-HKTW"];
    if (!exactShape(value, ["labels", "descriptions"])
        || !exactShape(value.labels, locales) || !exactShape(value.descriptions, locales)) return null;
    const labels = Object.create(null);
    const descriptions = Object.create(null);
    for (const locale of locales) {
      labels[locale] = safeText(value.labels[locale], 80);
      descriptions[locale] = safeText(value.descriptions[locale], 220);
      if (!labels[locale] || !descriptions[locale]) return null;
    }
    return { labels, descriptions };
  }

  function normalizeContrast(value) {
    if (!exactShape(value, ["light", "dark"])) return null;
    const result = {};
    for (const mode of ["light", "dark"]) {
      if (!Array.isArray(value[mode]) || value[mode].length > 16) return null;
      result[mode] = [];
      for (const item of value[mode]) {
        if (!exactShape(item, ["id", "ratio", "minimum", "pass"])
            || !CONTRAST_IDS.has(item.id) || !inRange(item.ratio, 0, 21)
            || !inRange(item.minimum, 1, 21) || typeof item.pass !== "boolean") return null;
        result[mode].push({ ...item });
      }
    }
    return result;
  }

  function normalizeBudget(value) {
    const scalarKeys = [
      "chromeBytes", "chromeLimit", "embeddedArtworkBytes", "embeddedArtworkLimit",
      "sourceArtworkBytes", "sourceArtworkLimit", "pass",
    ];
    if (!exactShape(value, [...scalarKeys, "layers"]) || typeof value.pass !== "boolean"
        || !Array.isArray(value.layers) || value.layers.length > 8) return null;
    for (const key of scalarKeys.slice(0, -1)) {
      if (!integer(value[key], 0, 10_000_000)) return null;
    }
    const layers = [];
    for (const layer of value.layers) {
      if (!exactShape(layer, ["id", "bytes", "limit", "pass"])
          || !integer(layer.id, 0, 7) || !integer(layer.bytes, 0, 10_000_000)
          || !integer(layer.limit, 1, 10_000_000) || typeof layer.pass !== "boolean") return null;
      layers.push({ ...layer });
    }
    return { ...value, layers };
  }

  function normalizeFeedback(value) {
    if (!exactShape(value, ["valid", "contrast", "budget", "errors"])
        || typeof value.valid !== "boolean" || !Array.isArray(value.errors) || value.errors.length > 64) return null;
    const contrast = normalizeContrast(value.contrast);
    const budget = normalizeBudget(value.budget);
    if (!contrast || !budget) return null;
    const errors = [];
    for (const error of value.errors) {
      if (!exactShape(error, ["code", "field"])) return null;
      const code = safeText(error.code, 80);
      const field = safeText(error.field, 160);
      if (!code || !/^[a-z0-9-]+$/.test(code) || !field || !/^[a-zA-Z0-9_.\-[\]]+$/.test(field)) return null;
      errors.push({ code, field });
    }
    return { valid: value.valid, contrast, budget, errors };
  }

  function normalizeEditorState(value) {
    if (value === null) return null;
    if (!plainRecord(value) || typeof value.active !== "boolean") return undefined;
    const optional = ["lastAction", "actionSucceeded", "error"];
    if (!value.active) {
      if (!exactShape(value, ["active"], optional)) return undefined;
      if (value.lastAction !== undefined && !ACTIONS.has(value.lastAction)) return undefined;
      if (value.actionSucceeded !== undefined && typeof value.actionSucceeded !== "boolean") return undefined;
      if (value.error !== undefined && value.error !== null && !safeText(value.error, 500)) return undefined;
      return { ...value };
    }
    const required = [
      "active", "id", "sourceId", "source", "isNew", "session", "revision", "dirty", "canUndo", "canRedo",
      "label", "metadata", "tokens", "studioStyle", "launcher", "launcherStyle", "launcherPreviewUrl",
      "launcherStylePreviewUrl", "shared", "greetingPreferences", "layers", "feedback",
    ];
    if (!exactShape(value, required, optional) || !ID_PATTERN.test(value.id)
        || !ID_PATTERN.test(value.sourceId) || !enumValue(value.source, ["user", "builtin"])
        || typeof value.isNew !== "boolean" || typeof value.session !== "string" || !SESSION_PATTERN.test(value.session)
        || !integer(value.revision, 0, Number.MAX_SAFE_INTEGER) || typeof value.dirty !== "boolean"
        || typeof value.canUndo !== "boolean" || typeof value.canRedo !== "boolean") return undefined;
    const label = safeText(value.label, 80);
    if (!label || !exactShape(value.tokens, ["light", "dark"])) return undefined;
    const metadata = normalizeMetadata(value.metadata);
    const light = normalizeModeTokens(value.tokens.light);
    const dark = normalizeModeTokens(value.tokens.dark);
    const studioStyle = normalizeStudioStyle(value.studioStyle);
    const launcher = normalizeLauncher(value.launcher);
    const launcherStyle = normalizeLauncher(value.launcherStyle);
    const launcherPreviewUrl = normalizeLauncherPreviewUrl(value.launcherPreviewUrl);
    const launcherStylePreviewUrl = normalizeLauncherPreviewUrl(value.launcherStylePreviewUrl);
    const shared = normalizeShared(value.shared);
    const greetingPreferences = normalizeGreetingPreferences(value.greetingPreferences);
    if (!metadata || !light || !dark || !studioStyle || !launcher || !launcherStyle
        || !launcherPreviewUrl || !launcherStylePreviewUrl || !shared || !greetingPreferences
        || !Array.isArray(value.layers) || value.layers.length > 8) return undefined;
    const layers = value.layers.map(normalizeLayer);
    const feedback = normalizeFeedback(value.feedback);
    if (layers.some((layer) => !layer) || new Set(layers.map((layer) => layer.id)).size !== layers.length
        || !feedback) return undefined;
    if (value.lastAction !== undefined && !ACTIONS.has(value.lastAction)) return undefined;
    if (value.actionSucceeded !== undefined && typeof value.actionSucceeded !== "boolean") return undefined;
    if (value.error !== undefined && value.error !== null && !safeText(value.error, 500)) return undefined;
    return {
      ...value,
      label,
      metadata,
      tokens: { light, dark },
      studioStyle,
      launcher,
      launcherStyle,
      launcherPreviewUrl,
      launcherStylePreviewUrl,
      shared,
      greetingPreferences,
      layers,
      feedback,
    };
  }

  const hasUnsavedEditorWork = (work) => Boolean(
    work.dirty
    || work.deferred
    || work.coalesced
    || work.debounce
    || work.inFlight
    || work.stageKeys
    || work.stageKeyDebounce
  );

  const inspectorRevealDelta = (rect, visibleTop, visibleBottom) => {
    if (rect.top < visibleTop) return rect.top - visibleTop;
    if (rect.bottom > visibleBottom) return rect.bottom - visibleBottom;
    return 0;
  };

  function createController({ locale, send, setStatus, translate, focusThemeCard, onStudioStyleChange }) {
    const normalizedLocale = Object.hasOwn(STRINGS, locale) ? locale : "en";
    const tr = (key) => STRINGS[normalizedLocale]?.[key] ?? translate?.(key) ?? STRINGS.en?.[key] ?? key;
    const editor = document.getElementById("editor");
    const navEditor = document.getElementById("nav-editor");
    const ordinarySections = ["themes", "background", "create", "settings"].map((id) => document.getElementById(id));
    const ordinaryLinks = [...document.querySelectorAll(".rail-item")].filter((link) => link !== navEditor);
    const studioShell = document.querySelector(".studio");
    const content = document.querySelector(".content");
    const stageColumn = editor.querySelector(".editor-stagecol");
    const editorControls = editor.querySelector(".editor-controls");
    const title = document.getElementById("editor-title");
    const summary = document.getElementById("editor-summary");
    const dirtyPill = document.getElementById("editor-dirty");
    const validPill = document.getElementById("editor-valid");
    const live = document.getElementById("editor-live");
    const errorSummary = document.getElementById("editor-error-summary");
    const livePausedNote = document.getElementById("editor-live-paused");
    const tokenGroups = document.getElementById("editor-token-groups");
    const layerList = document.getElementById("editor-layer-list");
    const feedbackRoot = document.getElementById("editor-feedback");
    const quickFeedback = document.getElementById("editor-quick-feedback");
    const inspectorHead = editor.querySelector(".editor-inspector-head");
    const promptContextSection = editor.querySelector(".editor-prompt-context");
    const promptContextUnavailable = editor.querySelector(".editor-prompt-unavailable");
    const confirmDialog = document.getElementById("editor-confirm-dialog");
    const confirmTitle = document.getElementById("editor-confirm-title");
    const confirmBody = document.getElementById("editor-confirm-body");
    const confirmAction = document.getElementById("editor-confirm-action");
    const modeInputs = [...document.querySelectorAll('input[name="editor-mode"]')];
    const scopeInputs = [...document.querySelectorAll('input[name="background-scope"]')];
    const sharedInputs = [...document.querySelectorAll("[data-editor-shared]")];
    const radiusInput = document.getElementById("editor-radius");
    const inheritedRadiusNote = document.getElementById("editor-radius-inherited");
    const nativePromptNote = document.getElementById("editor-prompt-native");
    const launcherInputs = [...document.querySelectorAll("[data-editor-launcher]")];
    const launcherTextInputs = [...document.querySelectorAll("[data-editor-launcher-text]")];
    const launcherPreview = document.getElementById("editor-launcher-preview");
    const launcherMark = document.getElementById("editor-launcher-mark");
    const replaceLauncherMarkButton = document.getElementById("editor-launcher-replace");
    const promptInputs = [...document.querySelectorAll("[data-editor-prompt]")];
    const promptExactInputs = [...document.querySelectorAll("[data-editor-prompt-exact]")];
    const greetingInputs = [...document.querySelectorAll("[data-editor-greeting]")];
    const greetingExactLabelKeys = Object.freeze({
      fontSize: "greetingSize",
      letterSpacing: "greetingTracking",
      lineHeight: "greetingLineHeight",
      maxWidthRatio: "greetingMaxWidth",
      xRatio: "greetingOffsetX",
      yRatio: "greetingOffsetY",
      markScale: "greetingMarkScale",
    });
    const greetingExactInputs = greetingInputs
      .filter((input) => input.type === "range")
      .map((range) => {
        const exact = document.createElement("input");
        exact.type = "number";
        exact.className = "greeting-exact-value advanced-only";
        exact.min = range.min;
        exact.max = range.max;
        exact.step = range.step;
        exact.inputMode = "decimal";
        exact.dataset.editorGreetingExact = range.dataset.editorGreeting;
        exact.dataset.editorFocus = `${range.dataset.editorFocus}-exact`;
        exact.setAttribute("aria-label",
          `${tr(greetingExactLabelKeys[range.dataset.editorGreeting])} / ${tr("exactValue")}`);
        range.insertAdjacentElement("afterend", exact);
        return exact;
      });
    const greetingEnableInput = document.getElementById("editor-greeting-enabled");
    const greetingResetButton = document.getElementById("editor-greeting-reset");
    const greetingNativeNote = document.getElementById("editor-greeting-native");
    const greetingCollisionWarning = document.getElementById("editor-greeting-collision-warning");
    const greetingSample = document.getElementById("editor-greeting-sample");
    const greetingPersonalEnableInput = document.getElementById("editor-greeting-personal-enabled");
    const greetingSourceInputs = [...document.querySelectorAll('input[name="greeting-source"]')];
    const greetingNameInput = document.getElementById("editor-greeting-name");
    const greetingPhrasesInput = document.getElementById("editor-greeting-phrases");
    const greetingOverrideInput = document.getElementById("editor-greeting-override");
    const greetingOverridePhrasesInput = document.getElementById("editor-greeting-override-phrases");
    const greetingOverridePhrasesField = document.getElementById("editor-greeting-override-phrases-field");
    const greetingPhrasesStatus = document.getElementById("editor-greeting-phrases-status");
    const greetingMarkInput = document.getElementById("editor-greeting-mark");
    const greetingContextSection = editor.querySelector(".editor-greeting-context");
    const greetingContextUnavailable = editor.querySelector(".editor-greeting-unavailable");
    const greetingSwitchPreviewButton = document.getElementById("editor-greeting-switch-preview");
    const saveButton = document.getElementById("editor-save");
    const cancelButton = document.getElementById("editor-cancel");
    const undoButton = document.getElementById("editor-undo");
    const redoButton = document.getElementById("editor-redo");
    const resetButton = document.getElementById("editor-reset");
    const addLayerButton = document.getElementById("editor-add-layer");
    const addLayerRoleSelect = document.getElementById("editor-add-layer-role");
    const backButton = document.getElementById("editor-back");
    const topmostButton = document.getElementById("stage-real-topmost");
    const metadataInputs = [...document.querySelectorAll("[data-editor-metadata]")];
    const branchTabs = [...document.querySelectorAll("[data-editor-branch-target]")];
    const branchHelp = document.getElementById("editor-branch-help");
    const targetPicker = document.getElementById("editor-target-picker");
    const contextEditing = document.getElementById("editor-context-editing");
    const contextApplies = document.getElementById("editor-context-applies");
    const contextSource = document.getElementById("editor-context-source");
    const contextFrame = document.getElementById("editor-context-frame");
    const contextFrameRow = document.getElementById("editor-context-frame-row");
    const documentDetailsPanel = document.getElementById("editor-document-details");
    const documentDetailsToggle = document.getElementById("editor-document-details-toggle");
    const switchSupportedPreviewButton = document.getElementById("editor-switch-supported-preview");
    const stageRoot = document.getElementById("editor-stage");
    for (const input of metadataInputs) {
      if (input.dataset.editorMetadata === "label" && input.dataset.editorLocale !== normalizedLocale) {
        input.closest(".editor-field")?.classList.add("advanced-only");
      }
    }
    let state = null;
    let greetingPreferenceDraft = null;
    let greetingPreferenceDraftDirty = false;
    let greetingPreferenceInputDirty = false;
    let greetingPreferenceInputInvalid = false;
    let selectedMode = "light";
    let selectedLayerId = null;
    let renderedLayerSignature = null;
    let inspectorBranch = "interface";
    let inspectorTarget = "interface.theme";
    let inspectorField = null;
    const targetByBranch = {
      interface: "interface.theme",
      background: "background.canvas",
      widgets: "widgets.app-identity",
    };
    let stageViewport = "normal";
    let stageContext = "new-chat";
    let stageSelection = null;
    let stagePreviewSize = [...STAGE_SIZES.normal];
    let previewSizeIntent = null;
    let pendingAction = null;
    let pendingWatchdog = null;
    let returnTheme = "default";
    let confirmCallback = null;
    let confirmReturnFocus = null;
    let firstOpen = true;
    let entryAppearance = null;
    let appearanceTouched = false;
    let topmostEnabled = false;
    const stageOverrides = new Map();
    const coalescedChanges = new Map();
    const deferredChanges = new Map();
    let changeFlushTimer = null;
    let inFlightChanges = [];
    let inFlightRevision = null;
    let inFlightSession = null;
    let actionAfterPatch = null;
    const hasUnsavedEdits = () => hasUnsavedEditorWork({
      dirty: state?.dirty || greetingPreferenceDraftDirty || greetingPreferenceInputDirty,
      deferred: deferredChanges.size,
      coalesced: coalescedChanges.size,
      debounce: changeFlushTimer,
      inFlight: inFlightChanges.length,
      stageKeys: stageKeyPaths.size,
      stageKeyDebounce: stageKeyTimer,
    });
    const reflectDirtyState = () => {
      if (!state) return;
      const locallyDirty = hasUnsavedEdits();
      dirtyPill.textContent = locallyDirty ? tr("unsavedState") : tr("savedState");
      dirtyPill.dataset.state = locallyDirty ? "dirty" : "saved";
      refreshInspectorContext();
    };

    const announce = (message, tone = "ok") => {
      live.textContent = message;
      setStatus?.(message, tone);
    };

    const applyTranslations = () => {
      for (const node of document.querySelectorAll("[data-editor-i18n]")) {
        node.textContent = tr(node.dataset.editorI18n);
      }
      for (const node of document.querySelectorAll("[data-editor-i18n-aria-label]")) {
        node.setAttribute("aria-label", tr(node.dataset.editorI18nAriaLabel));
      }
    };

    const fillSelect = (select, values) => {
      select.replaceChildren(...values.map(([value, key]) => {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = tr(key);
        return option;
      }));
    };

    const setInheritedSelectPresentation = (select, inherited, value) => {
      let option = select.querySelector("option[data-editor-inherited-option]");
      if (!inherited) {
        option?.remove();
        delete select.dataset.inherited;
        select.value = String(value);
        return;
      }
      if (!option) {
        option = document.createElement("option");
        option.value = THEME_ORIGINAL;
        option.disabled = true;
        option.dataset.editorInheritedOption = "true";
        select.prepend(option);
      }
      option.textContent = tr("themeOriginal");
      option.selected = true;
      select.dataset.inherited = "true";
    };

    const setInheritedRadiusPresentation = (inherited) => {
      radiusInput.dataset.inherited = String(inherited);
      inheritedRadiusNote.hidden = !inherited;
    };

    // A structural/replacing host action (layer reorder, image pick, save,
    // undo, reset) that must settle before further interaction. Value patches
    // (apply-theme-patch) never change layer structure, so they sync in the
    // background without locking the editor.
    const isBlockingAction = () => Boolean(pendingAction) && pendingAction !== "apply-theme-patch";
    // A host reply can be lost: a stale session, a dropped bridge message, or a state
    // whose lastAction never matches what we sent. Without a watchdog `pendingAction`
    // stays set forever and flushThemeChanges then queues every later edit without ever
    // sending it — the editor looks alive while silently discarding work.
    const PENDING_WATCHDOG_MS = 12000;
    const WATCHDOG_EXEMPT_ACTIONS = new Set(["pick-theme-layer-image", "pick-theme-launcher-mark"]);
    const clearPendingWatchdog = () => {
      if (!pendingWatchdog) return;
      clearTimeout(pendingWatchdog);
      pendingWatchdog = null;
    };
    const setPending = (action = null) => {
      pendingAction = action;
      clearPendingWatchdog();
      if (action && !WATCHDOG_EXEMPT_ACTIONS.has(action)) {
        pendingWatchdog = setTimeout(() => {
          pendingWatchdog = null;
          if (!pendingAction) return;
          requeueInFlightChanges();
          setPending(null);
          announce(tr("editorActionTimedOut"), "error");
          flushThemeChanges();
        }, PENDING_WATCHDOG_MS);
      }
      const blocking = Boolean(action) && action !== "apply-theme-patch";
      editor.setAttribute("aria-busy", String(blocking));
      // Only structural actions disable every control; per-control busy gating
      // in reflectButtonStates handles background patches without a full freeze.
      for (const button of editor.querySelectorAll("button")) button.disabled = blocking;
      reflectButtonStates();
    };

    const post = (message) => {
      if (message.type !== "apply-theme-patch" && (stageKeyPaths.size || stageKeyTimer)) {
        if (actionAfterPatch) return false;
        actionAfterPatch = { ...message };
        flushStageKeyChanges();
        if (!pendingAction && (coalescedChanges.size || changeFlushTimer)) flushThemeChanges();
        if (pendingAction || coalescedChanges.size || changeFlushTimer) {
          announce(tr("editorBusy"), "busy");
          return true;
        }
        actionAfterPatch = null;
      }
      if (message.type !== "apply-theme-patch" && (coalescedChanges.size || changeFlushTimer)) {
        if (actionAfterPatch) return false;
        actionAfterPatch = { ...message };
        flushThemeChanges();
        announce(tr("editorBusy"), "busy");
        return true;
      }
      if (pendingAction || !send(message)) return false;
      setPending(message.type);
      announce(tr("editorBusy"), "busy");
      return true;
    };

    const mutationBase = () => state ? { session: state.session, revision: state.revision } : null;
    const greetingFrameId = () => stageViewport === "wide" ? "wide" : "standard";
    const activeGreetingFrame = () => state?.shared?.greeting?.frames?.[selectedMode]?.[greetingFrameId()] ?? null;
    const themeChangeKey = (change) => change.kind === "token"
      ? `token:${change.mode}:${change.token}`
      : change.kind === "layer"
        ? `layer:${change.layerId}:${change.preset}:${change.property}`
        : change.kind === "greeting"
          ? `greeting:${change.operation}:${change.appearance}:${change.frame}`
          : `metadata:${change.field}:${change.locale}`;
    const clearInFlightChanges = () => {
      inFlightChanges = [];
      inFlightRevision = null;
      inFlightSession = null;
    };
    const flushThemeChanges = () => {
      if (changeFlushTimer) {
        clearTimeout(changeFlushTimer);
        changeFlushTimer = null;
      }
      if (pendingAction || !coalescedChanges.size) return;
      const batch = [...coalescedChanges.entries()].slice(0, 16);
      const base = mutationBase();
      if (!base) {
        coalescedChanges.clear();
        return;
      }
      for (const [key] of batch) coalescedChanges.delete(key);
      inFlightChanges = batch.map(([, change]) => change);
      const wireChanges = inFlightChanges.map((change) => {
        if (change.kind !== "layer") return change;
        const index = layerIndexForId(change.layerId);
        if (index < 0) return null;
        return {
          kind: "layer", index, preset: change.preset,
          property: change.property, value: change.value,
        };
      }).filter(Boolean);
      if (!wireChanges.length) {
        clearInFlightChanges();
        reflectButtonStates();
        return;
      }
      inFlightRevision = base.revision;
      inFlightSession = base.session;
      if (!post({ type: "apply-theme-patch", ...base, changes: wireChanges })) {
        for (const [, change] of batch) coalescedChanges.set(themeChangeKey(change), change);
        clearInFlightChanges();
      }
      reflectButtonStates();
    };
    const queueThemeChanges = (changes, { immediate = false } = {}) => {
      for (const [key, change] of deferredChanges) {
        if (!coalescedChanges.has(key)) coalescedChanges.set(key, change);
      }
      deferredChanges.clear();
      for (const change of changes) coalescedChanges.set(themeChangeKey(change), change);
      if (changeFlushTimer) clearTimeout(changeFlushTimer);
      if (immediate && !pendingAction) flushThemeChanges();
      else changeFlushTimer = setTimeout(flushThemeChanges, 60);
      reflectButtonStates();
    };
    const queueThemeChange = (change, options) => queueThemeChanges([change], options);
    const queueTokenChange = (mode, token, value) => {
      queueThemeChange({ kind: "token", mode, token, value });
    };
    const greetingFrameFromControls = (changedField = null, changedValue = null) => {
      const frame = { ...activeGreetingFrame() };
      if (!frame.font) return null;
      for (const input of greetingInputs) {
        const field = input.dataset.editorGreeting;
        frame[field] = field === changedField ? changedValue
          : input.type === "checkbox" ? input.checked
            : input.type === "range" ? input.valueAsNumber
              : field === "weight" ? Number(input.value)
                : input.value;
      }
      return frame;
    };
    const queueGreetingFrame = (frame, { immediate = false } = {}) => {
      if (!frame) return;
      queueThemeChange({
        kind: "greeting",
        operation: "set-frame",
        appearance: selectedMode,
        frame: greetingFrameId(),
        value: frame,
      }, { immediate });
    };
    const queueLayerChange = (index, preset, property, value) => {
      const layerId = state?.layers?.[index]?.id;
      if (layerId) queueThemeChange({ kind: "layer", layerId, preset, property, value });
    };
    const requeueInFlightChanges = () => {
      for (const change of inFlightChanges) {
        const key = themeChangeKey(change);
        if (!coalescedChanges.has(key)) coalescedChanges.set(key, change);
      }
      clearInFlightChanges();
    };
    const deferInFlightChanges = () => {
      for (const change of inFlightChanges) {
        const key = themeChangeKey(change);
        if (!coalescedChanges.has(key) && !deferredChanges.has(key)) deferredChanges.set(key, change);
      }
      clearInFlightChanges();
    };
    const selectedArtworkRole = () => ROLE_IDS.includes(addLayerRoleSelect?.value)
      ? addLayerRoleSelect.value : "decoration";
    const launcherToken = (property) => `launcher${property[0].toUpperCase()}${property.slice(1)}`;
    const setCurrentNavigation = (active) => {
      navEditor.hidden = !active;
      for (const link of ordinaryLinks) {
        link.hidden = active;
        link.classList.toggle("is-current", !active && link.hash === "#themes");
        if (active) link.removeAttribute("aria-current");
      }
      navEditor.classList.toggle("is-current", active);
      if (active) navEditor.setAttribute("aria-current", "page");
      else navEditor.removeAttribute("aria-current");
    };

    const targetLabel = (target) => tr(CAPABILITY_TARGETS[target]?.labelKey ?? "targetPicker");
    const editingTargetLabel = (target) => {
      if (target !== "background.layer") return targetLabel(target);
      const selectedLayer = state?.layers?.find((layer) => layer.id === selectedLayerId);
      return selectedLayer
        ? format(tr("layerNumber"), selectedLayer.index + 1)
        : targetLabel(target);
    };
    const branchHelpKey = (branch) => ({
      interface: "branchInterfaceHelp",
      background: "branchBackgroundHelp",
      widgets: "branchWidgetsHelp",
    })[branch] ?? "branchInterfaceHelp";
    const stageSelectionTarget = (selection) => selection?.kind === "prompt"
      ? "interface.new-chat-area"
      : selection?.kind === "greeting" ? "interface.greeting"
      : selection?.kind === "layer" ? "background.layer" : null;
    const stageSelectionAllowed = (selection) => {
      if (!selection) return true;
      const capability = CAPABILITY_BY_ID.get(stageSelectionTarget(selection));
      return Boolean(capability && capability.branch === inspectorBranch);
    };
    const setStageNodeInteractive = (node, interactive) => {
      if (!node) return;
      node.tabIndex = interactive ? 0 : -1;
      node.toggleAttribute("inert", !interactive);
      if (interactive) node.removeAttribute("aria-hidden");
      else node.setAttribute("aria-hidden", "true");
    };
    const syncStageSelectionMode = () => {
      if (branchHelp) branchHelp.textContent = tr(branchHelpKey(inspectorBranch));
      for (const tab of branchTabs) {
        tab.title = tr(branchHelpKey(tab.dataset.editorBranchTarget));
      }
      if (!stageRoot) return;
      stageRoot.dataset.selectionBranch = inspectorBranch;
      const prompt = stageRoot.querySelector(".stage-prompt");
      setStageNodeInteractive(prompt, inspectorBranch === "interface" && stageContext === "new-chat");
      const greeting = stageRoot.querySelector(".stage-greeting");
      setStageNodeInteractive(greeting, inspectorBranch === "interface" && stageContext === "new-chat");
      for (const item of stageRoot.querySelectorAll(".stage-layer .stage-item")) {
        setStageNodeInteractive(item, inspectorBranch === "background");
      }
      const palette = stageRoot.querySelector(".stage-layers-panel");
      if (palette) palette.hidden = inspectorBranch !== "background";
      if (!stageSelectionAllowed(stageSelection)
          || (stageSelection && stageSelectionTarget(stageSelection) !== inspectorTarget)) {
        stageSelection = null;
      }
      if (!stageSelection) {
        for (const chip of stageRoot.querySelectorAll(".stage-chip")) chip.dataset.active = "false";
        for (const node of stageRoot.querySelectorAll(
          ".stage-hud-ring, .stage-edge, .stage-corner, .stage-opacity",
        )) node.hidden = true;
      }
    };
    const syncTargetPicker = () => {
      const entries = EDITOR_CAPABILITY_REGISTRY.filter((entry) => entry.branch === inspectorBranch);
      targetPicker.replaceChildren(...entries.map((entry) => {
        const option = document.createElement("option");
        option.value = entry.id;
        option.textContent = editingTargetLabel(entry.id);
        return option;
      }));
      targetPicker.value = inspectorTarget;
      const onlyTarget = entries.length === 1;
      targetPicker.hidden = onlyTarget;
      targetPicker.disabled = onlyTarget;
      contextEditing.hidden = !onlyTarget;
      contextEditing.textContent = targetLabel(inspectorTarget);
    };
    const inspectorTargetForField = (field) => {
      if (typeof field !== "string") return null;
      if (field.startsWith("tokens.")
          || /^shared\.(fontUi|fontDisplay|radius|blur|shadow)$/.test(field)) {
        return "interface.theme";
      }
      if (field === "shared.prompt" || field.startsWith("shared.prompt.")) {
        return "interface.new-chat-area";
      }
      if (field === "shared.greeting" || field.startsWith("shared.greeting.")) {
        return "interface.greeting";
      }
      if (field === "shared.backgroundScope") return "background.canvas";
      if (field === "layers" || field.startsWith("layers[")) return "background.layer";
      if (field === "launcher" || field.startsWith("launcher.")) return "widgets.app-identity";
      return null;
    };
    const defaultInspectorField = (target) => {
      if (target === "interface.theme") return `tokens.${selectedMode}.canvas`;
      if (target === "interface.new-chat-area") return "shared.prompt";
      if (target === "interface.greeting") return "shared.greeting";
      if (target === "background.canvas") return "shared.backgroundScope";
      if (target === "background.layer") {
        const index = state?.layers?.findIndex((layer) => layer.id === selectedLayerId) ?? -1;
        return index >= 0 ? `layers[${index}]` : "layers";
      }
      return "launcher";
    };
    const normalizeInspectorField = (field) => {
      const token = /^tokens\.(?:light|dark)\.(.+)$/.exec(field ?? "");
      if (token) return `tokens.${selectedMode}.${token[1]}`;
      const greeting = /^shared\.greeting\.frames\.(?:light|dark)\.(?:standard|wide)\.(.+)$/.exec(field ?? "");
      if (greeting) return `shared.greeting.frames.${selectedMode}.${greetingFrameId()}.${greeting[1]}`;
      const layer = /^layers\[\d+](.*)$/.exec(field ?? "");
      if (layer) {
        const index = state?.layers?.findIndex((item) => item.id === selectedLayerId) ?? -1;
        if (index >= 0) return `layers[${index}]${layer[1]}`;
      }
      return field;
    };
    const hasStageOverridePrefix = (prefix) => [...stageOverrides.keys()]
      .some((path) => path === prefix || path.startsWith(`${prefix}.`));
    const fieldUsesThemeOriginal = (field) => {
      if (!state) return true;
      if (field === "shared.prompt" || field.startsWith("shared.prompt.")) {
        return state.shared.prompt.native && !hasStageOverridePrefix("shared.prompt");
      }
      if (field === "shared.greeting" || field.startsWith("shared.greeting.")) {
        return state.shared.greeting.native;
      }
      const inherited = /^shared\.(fontUi|fontDisplay|radius|shadow)$/.exec(field);
      if (inherited) {
        return Boolean(state.shared.inherited[inherited[1]]) && !stageOverrides.has(field);
      }
      return false;
    };
    const layerScopeLabel = (layer) => {
      if (!layer) return tr("allPagesScope");
      const scopeValue = (property) => (
        stageOverrides.get(`layers[${layer.index}].${property}`) ?? layer[property]
      );
      const appearanceValue = scopeValue("appearance");
      const contextValue = scopeValue("context");
      const viewportValue = scopeValue("viewport");
      const appearance = appearanceValue === "all" ? tr("allModesScope")
        : tr(appearanceValue === "dark" ? "appearanceDark" : "appearanceLight");
      const page = contextValue === "all" ? tr("allPagesScope")
        : tr(contextValue === "conversation" ? "contextConversation" : "contextNewChat");
      const frame = viewportValue === "all"
        ? `${tr("frameStandard")} + ${tr("frameWide")}`
        : tr(viewportValue === "wide" ? "frameWide" : "frameStandard");
      return `${appearance} · ${page} · ${frame}`;
    };
    const refreshInspectorContext = () => {
      const capability = CAPABILITY_BY_ID.get(inspectorTarget);
      if (!capability) return;
      inspectorField = normalizeInspectorField(
        inspectorTargetForField(inspectorField) === inspectorTarget
          ? inspectorField : defaultInspectorField(inspectorTarget),
      );
      const selectedLayer = state?.layers?.find((layer) => layer.id === selectedLayerId) ?? null;
      const selectedOption = targetPicker.querySelector(
        `option[value="${CSS.escape(inspectorTarget)}"]`,
      );
      if (selectedOption) selectedOption.textContent = editingTargetLabel(inspectorTarget);
      if (!contextEditing.hidden) {
        contextEditing.textContent = editingTargetLabel(inspectorTarget);
      }
      const tokenMode = /^tokens\.(light|dark)\./.exec(inspectorField)?.[1] ?? null;
      contextApplies.textContent = inspectorTarget === "background.layer"
        ? layerScopeLabel(selectedLayer)
        : inspectorTarget === "interface.new-chat-area"
          ? `${tr("allModesScope")} · ${tr("contextNewChat")} · ${tr("frameStandard")} + ${tr("frameWide")}`
          : inspectorTarget === "interface.greeting"
            ? `${tr(selectedMode === "dark" ? "appearanceDark" : "appearanceLight")} / ${tr("contextNewChat")} / ${tr(greetingFrameId() === "wide" ? "frameWide" : "frameStandard")}`
            : tokenMode
            ? `${tr(tokenMode === "dark" ? "appearanceDark" : "appearanceLight")} · ${tr("allPagesScope")}`
            : `${tr("allModesScope")} · ${tr("allPagesScope")}`;
      contextSource.textContent = fieldUsesThemeOriginal(inspectorField)
        ? tr("themeOriginalSource") : tr("customizedSource");
      const fieldFrame = /^layers\[\d+]\.frames\.(normal|wide)\./.exec(inspectorField)?.[1]
        ?? /^shared\.greeting\.frames\.(?:light|dark)\.(standard|wide)\./.exec(inspectorField)?.[1]
        ?? null;
      contextFrameRow.hidden = !fieldFrame;
      const editFrameLabel = tr(fieldFrame === "wide" ? "frameWide" : "frameStandard");
      const previewFrameLabel = tr(stageViewport === "wide" ? "frameWide" : "frameStandard");
      const preset = Object.values(STAGE_SIZES).some(
        ([width, height]) => width === stagePreviewSize[0] && height === stagePreviewSize[1],
      );
      contextFrame.textContent = preset
        ? editFrameLabel
        : `${editFrameLabel} · ${format(tr("customFrameUses"), previewFrameLabel)}`;
      const available = capability.views.includes(stageContext);
      editor.dataset.targetAvailable = String(available);
    };
    const revealWithinInspector = (target) => {
      if (!target || !editorControls || !inspectorHead) return;
      const controlsRect = editorControls.getBoundingClientRect();
      const visibleTop = Math.max(
        controlsRect.top, inspectorHead.getBoundingClientRect().bottom,
      ) + 12;
      const visibleBottom = controlsRect.bottom - 12;
      const delta = inspectorRevealDelta(target.getBoundingClientRect(), visibleTop, visibleBottom);
      if (delta) editorControls.scrollTop += delta;
    };
    const setDocumentDetailsOpen = (
      open, { reveal = false, returnFocus = false, focusPanel = false } = {},
    ) => {
      if (!documentDetailsPanel || !documentDetailsToggle) return;
      documentDetailsPanel.hidden = !open;
      documentDetailsToggle.setAttribute("aria-expanded", String(open));
      if (returnFocus) documentDetailsToggle.focus();
      if (open && (reveal || focusPanel)) requestAnimationFrame(() => {
        const firstLocalizedName = documentDetailsPanel.querySelector(
          `[data-editor-metadata="label"][data-editor-locale="${CSS.escape(normalizedLocale)}"]`,
        );
        const destination = focusPanel
          ? firstLocalizedName ?? documentDetailsPanel
          : documentDetailsPanel.querySelector("h3") ?? documentDetailsPanel;
        if (focusPanel) destination.focus({ preventScroll: true });
        if (reveal) revealWithinInspector(destination);
      });
    };
    const setInspectorTarget = (target, { focusBranch = false, reveal = false } = {}) => {
      const capability = CAPABILITY_BY_ID.get(target);
      if (!capability) return false;
      if (inspectorTargetForField(inspectorField) !== target) {
        inspectorField = defaultInspectorField(target);
      }
      inspectorTarget = target;
      inspectorBranch = capability.branch;
      targetByBranch[inspectorBranch] = target;
      editor.dataset.inspectorBranch = inspectorBranch;
      editor.dataset.inspectorTarget = inspectorTarget;
      launcherPreview?.setAttribute(
        "aria-pressed", String(inspectorTarget === "widgets.app-identity"),
      );
      for (const tab of branchTabs) {
        const selected = tab.dataset.editorBranchTarget === inspectorBranch;
        tab.setAttribute("aria-pressed", String(selected));
        tab.tabIndex = selected ? 0 : -1;
        if (selected && focusBranch) tab.focus();
      }
      syncTargetPicker();
      refreshInspectorContext();
      syncStageSelectionMode();
      if (reveal) requestAnimationFrame(() => {
        const firstSection = editor.querySelector(
          `[data-editor-targets~="${CSS.escape(target)}"]:not([hidden])`,
        );
        if (!firstSection) return;
        const heading = firstSection.querySelector(":scope > h2, :scope > h3") ?? firstSection;
        revealWithinInspector(heading);
      });
      return true;
    };
    setInspectorTarget(inspectorTarget);
    const reflectStageSelectionForTarget = (target) => {
      if (target === "interface.new-chat-area") {
        stageSelection = { kind: "prompt" };
      } else if (target === "interface.greeting") {
        stageSelection = { kind: "greeting" };
      } else if (target === "background.layer" && selectedLayerId) {
        stageSelection = { kind: "layer", id: selectedLayerId };
      } else {
        stageSelection = null;
      }
      syncStageHud();
    };
    branchTabs.forEach((tab) => tab.addEventListener("click", () => {
      const branch = tab.dataset.editorBranchTarget;
      const target = targetByBranch[branch];
      if (!target) return;
      setInspectorTarget(target, { reveal: true });
      reflectStageSelectionForTarget(target);
      renderStage();
    }));
    branchTabs.forEach((tab, index) => tab.addEventListener("keydown", (event) => {
      const previous = event.key === "ArrowLeft" || event.key === "ArrowUp";
      const next = event.key === "ArrowRight" || event.key === "ArrowDown";
      const boundary = event.key === "Home" || event.key === "End";
      if (!previous && !next && !boundary) return;
      event.preventDefault();
      const nextIndex = event.key === "Home" ? 0
        : event.key === "End" ? branchTabs.length - 1
          : (index + (previous ? -1 : 1) + branchTabs.length) % branchTabs.length;
      branchTabs[nextIndex].focus();
      branchTabs[nextIndex].click();
    }));
    targetPicker.addEventListener("change", () => {
      const target = targetPicker.value;
      if (!CAPABILITY_BY_ID.has(target)) {
        syncTargetPicker();
        return;
      }
      if (target === "background.layer" && !selectedLayerId) {
        selectedLayerId = state?.layers?.[0]?.id ?? null;
      }
      setInspectorTarget(target, { reveal: true });
      reflectStageSelectionForTarget(target);
      renderStage();
    });
    launcherPreview?.addEventListener("click", () => {
      if (inspectorBranch !== "widgets") return;
      stageSelection = null;
      inspectorField = "launcher";
      setInspectorTarget("widgets.app-identity", { reveal: true });
      syncStageHud();
      announce(format(tr("stageSelectedAnnounce"), targetLabel("widgets.app-identity")));
    });
    const trackInspectorField = (event) => {
      const control = event.target.closest?.("[data-editor-field]");
      if (!control || !editorControls?.contains(control)) return;
      const field = control.dataset.editorField;
      if (inspectorTargetForField(field) !== inspectorTarget) return;
      inspectorField = field;
      refreshInspectorContext();
    };
    editorControls?.addEventListener("focusin", trackInspectorField);
    editorControls?.addEventListener("input", trackInspectorField);
    editorControls?.addEventListener("change", trackInspectorField);
    documentDetailsToggle?.addEventListener("click", () => {
      setDocumentDetailsOpen(documentDetailsPanel.hidden, { reveal: true, focusPanel: true });
    });
    documentDetailsPanel?.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setDocumentDetailsOpen(false, { returnFocus: true });
    });

    const resetStudioViewport = (hash) => {
      try {
        if (window.location.hash !== hash) history.replaceState(null, "", hash);
      } catch {}
      // A rail fragment may have moved WebView's root scrolling element even
      // though the visible document owns a nested scroller.
      window.scrollTo(0, 0);
      content.scrollTop = 0;
    };

    const showEditor = () => {
      for (const section of ordinarySections) section.hidden = true;
      editor.hidden = false;
      if (studioShell) studioShell.dataset.editorActive = "true";
      setCurrentNavigation(true);
      if (firstOpen) {
        resetStudioViewport("#editor");
        if (stageColumn) stageColumn.scrollTop = 0;
        if (editorControls) editorControls.scrollTop = 0;
        requestAnimationFrame(() => {
          resetStudioViewport("#editor");
          title.focus();
          applyStageLayout();
        });
        firstOpen = false;
      }
    };

    const hideEditor = (action = "") => {
      editor.hidden = true;
      studioShell?.removeAttribute("data-editor-active");
      for (const section of ordinarySections) section.hidden = false;
      setCurrentNavigation(false);
      resetStudioViewport("#themes");
      firstOpen = true;
      dropStageWork();
      stageSelection = null;
      selectedLayerId = null;
      renderedLayerSignature = null;
      stageHiddenLayers.clear();
      stageLayersUserToggled = false;
      setStageLayersCollapsed(true);
      targetByBranch.interface = "interface.theme";
      targetByBranch.background = "background.canvas";
      targetByBranch.widgets = "widgets.app-identity";
      setInspectorTarget("interface.theme");
      setDocumentDetailsOpen(false);
      stageMirror = null;
      stageLiveMirror = null;
      stageMirrorCache.clear();
      stageMirrorCacheBasis = null;
      stageContextTouched = false;
      previewSizeEditing = false;
      previewSizeIntent = null;
      previewExpectedRequest = null;
      stageContext = "new-chat";
      stageBackdropImg.removeAttribute("src");
      stageBackdropImg.hidden = true;
      if (mirrorCaption) mirrorCaption.textContent = tr("mirrorEmpty");
      if (backdropToggleInput) {
        backdropToggleInput.checked = true;
        backdropToggleInput.disabled = true;
      }
      if (topmostEnabled) {
        send({ type: "set-aura-topmost", enabled: false });
        topmostEnabled = false;
        topmostButton?.setAttribute("aria-pressed", "false");
      }
      if (appearanceTouched && entryAppearance) {
        send({ type: "set-appearance", appearance: entryAppearance });
      }
      appearanceTouched = false;
      const focusId = action === "delete-user-theme" ? "default" : returnTheme;
      requestAnimationFrame(() => focusThemeCard?.(focusId));
    };

    function showConfirm({ titleText, bodyText, actionText, destructive = false, opener, callback }) {
      confirmTitle.textContent = titleText;
      confirmBody.textContent = bodyText;
      confirmAction.textContent = actionText;
      confirmAction.dataset.destructive = String(destructive);
      confirmCallback = callback;
      confirmReturnFocus = opener;
      confirmDialog.showModal();
      requestAnimationFrame(() => confirmAction.focus());
    }

    confirmAction.addEventListener("click", () => {
      const callback = confirmCallback;
      confirmCallback = null;
      confirmDialog.close("confirmed");
      callback?.();
    });
    confirmDialog.addEventListener("close", () => {
      if (confirmDialog.returnValue !== "confirmed") confirmReturnFocus?.focus();
      confirmCallback = null;
      confirmReturnFocus = null;
    });

    // ── Live framing stage ─────────────────────────────────────────────
    // A schematic canvas (labelled "not a Claude preview") that renders the
    // draft's real tokens and artwork with the renderer's framing math and
    // lets users drag or arrow-key items. Local echo is instant; commits go
    // through the same validated bridge actions, queued one at a time.
    const stagePanel = stageRoot?.closest(".stage-panel");
    const editorHeader = editor.querySelector(".editor-header");
    const stageViewportInputs = [...document.querySelectorAll('input[name="stage-viewport"]')];
    const stageContextInputs = [...document.querySelectorAll('input[name="stage-context"]')];
    const stageZonesInput = document.getElementById("stage-zones");
    let stageDrag = null;
    let stageKeyTimer = null;
    const stageKeyPaths = new Set();
    let stageMirror = null;
    let stageLiveMirror = null;
    const stageMirrorCache = new Map();
    let stageMirrorCacheBasis = null;
    let stageContextTouched = false;
    let previewResizeTimer = null;
    let previewSizeEditing = false;
    let previewRequestSerial = 0;
    let previewExpectedRequest = null;
    // Drag pointermove is coalesced into one animation frame so a 120 Hz
    // pointer stream produces at most one layout pass per displayed frame.
    let stageDragFrame = 0;
    let stageDragEvent = null;
    const stageLayerNodes = new Map();
    // Memoized lookups of the range inputs mirrored during a drag; nodes are
    // re-resolved automatically once a layer-card rebuild disconnects them.
    const stageInputCache = new Map();
    const layerIndexForId = (id) => state?.layers.findIndex((layer) => layer.id === id) ?? -1;
    const layerForId = (id) => state?.layers.find((layer) => layer.id === id) ?? null;
    const clampNumber = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));
    const backdropToggleInput = document.getElementById("stage-backdrop");
    const openAuraButton = document.getElementById("stage-open-aura");
    // With a live capture as backdrop, the stage adopts the real window's
    // exact dimensions so drags map 1:1 onto the real pixels. When the user
    // edits a page context the real window is not showing, that view falls
    // back to the schematic so the toggle always produces a visible change.
    const hasUsableMirrorGeometry = (mirror) => {
      const geometry = mirror?.geometry;
      return Boolean(["new-chat", "conversation"].includes(geometry?.context)
        && ["light", "dark"].includes(geometry?.mode)
        && ["normal", "wide"].includes(geometry?.viewport)
        && clampedMirrorMainMetrics(geometry?.main, mirror?.width, mirror?.height));
    };
    const stageBackdropOn = () => {
      const geometry = stageMirror?.geometry;
      return Boolean(backdropToggleInput?.checked
        && stageMirror?.revision === state?.revision
        && stageMirror?.width === stagePreviewSize[0]
        && stageMirror?.height === stagePreviewSize[1]
        && geometry?.context === stageContext
        && geometry.mode === selectedMode
        && geometry.viewport === stageViewport
        && hasUsableMirrorGeometry(stageMirror));
    };
    const stageLogicalSize = () => stageBackdropOn()
      ? [stageMirror.width, stageMirror.height]
      : stagePreviewSize;
    const stageMainMetrics = (logicalWidth, logicalHeight) => {
      const geometryMain = stageBackdropOn() ? stageMirror?.geometry?.main : null;
      const measured = clampedMirrorMainMetrics(geometryMain, logicalWidth, logicalHeight);
      if (measured) return measured;
      return { left: STAGE_SIDEBAR_WIDTH, width: logicalWidth - STAGE_SIDEBAR_WIDTH, height: logicalHeight };
    };

    // Path strings are drawn from a small fixed vocabulary, so parsing each into
    // segments once and reusing them spares a regex + split on every read — and
    // a single layout pass reads dozens of paths.
    const pathSegments = new Map();
    const segmentsFor = (path) => {
      let segments = pathSegments.get(path);
      if (!segments) {
        segments = path.replace(/\[(\d+)]/g, ".$1").split(".");
        pathSegments.set(path, segments);
      }
      return segments;
    };
    const statePath = (path) => {
      let node = state;
      for (const part of segmentsFor(path)) {
        if (node == null) return undefined;
        node = node[part];
      }
      return node;
    };
    const roundPromptRatio = (value) => Math.round(value * 10000) / 10000;
    const measuredNativePrompt = () => {
      const fallback = state?.shared?.prompt ?? { width: 0.76, x: 0, y: 0 };
      if (!fallback.native) return { width: fallback.width, x: fallback.x, y: fallback.y };
      const mirror = stageMirror;
      const geometry = mirror?.geometry;
      const main = geometry?.main;
      const prompt = geometry?.prompt;
      const matches = mirror?.revision === state?.revision
        && mirror?.width === stagePreviewSize[0]
        && mirror?.height === stagePreviewSize[1]
        && geometry?.context === "new-chat"
        && geometry?.mode === selectedMode;
      if (!matches || !main || !prompt || prompt.width <= 40) {
        return { width: fallback.width, x: fallback.x, y: fallback.y };
      }
      const mainMetrics = clampedMirrorMainMetrics(main, mirror.width, mirror.height);
      if (!mainMetrics) {
        return { width: fallback.width, x: fallback.x, y: fallback.y };
      }
      return {
        width: roundPromptRatio(clampNumber(prompt.width / mainMetrics.width, 0.4, 0.96)),
        x: roundPromptRatio(clampNumber(
          ((prompt.left + (prompt.width / 2)) - (mainMetrics.left + (mainMetrics.width / 2))) / mainMetrics.width,
          -0.35,
          0.35,
        )),
        // Renderer offsets are relative to Claude's native vertical position.
        y: 0,
      };
    };
    const promptStateValue = (key) => state?.shared?.prompt?.native
      ? measuredNativePrompt()[key]
      : statePath(`shared.prompt.${key}`);
    const stageValue = (path) => {
      if (stageOverrides.has(path)) return stageOverrides.get(path);
      const prompt = /^shared\.prompt\.(width|x|y)$/.exec(path);
      return prompt ? promptStateValue(prompt[1]) : statePath(path);
    };
    const setStageOverride = (path, value) => { if (path) stageOverrides.set(path, value); };
    const seedNativePromptOverrides = () => {
      if (!state?.shared?.prompt?.native) return;
      const seed = measuredNativePrompt();
      for (const key of ["width", "x", "y"]) {
        const path = `shared.prompt.${key}`;
        if (!stageOverrides.has(path)) setStageOverride(path, seed[key]);
      }
    };
    const dropStageWork = () => {
      coalescedChanges.clear();
      deferredChanges.clear();
      clearInFlightChanges();
      if (changeFlushTimer) { clearTimeout(changeFlushTimer); changeFlushTimer = null; }
      stageOverrides.clear();
      stageDrag = null;
      stageDragEvent = null;
      if (stageDragFrame) { cancelAnimationFrame(stageDragFrame); stageDragFrame = 0; }
      if (stageKeyTimer) { clearTimeout(stageKeyTimer); stageKeyTimer = null; }
      stageKeyPaths.clear();
      actionAfterPatch = null;
      if (previewResizeTimer) { clearTimeout(previewResizeTimer); previewResizeTimer = null; }
    };

    const queueStageMutations = (messages) => {
      const changes = messages.map((message) => message.type === "set-theme-layer"
        ? {
          kind: "layer", layerId: state?.layers?.[message.index]?.id, preset: message.preset,
          property: message.property, value: message.value,
        }
        : {
          kind: "token", mode: message.mode, token: message.token, value: message.value,
        }).filter((change) => change.kind !== "layer" || change.layerId);
      queueThemeChanges(changes, { immediate: true });
    };

    const messageForStagePath = (path, value) => {
      const layer = /^layers\[(\d+)]\.frames\.(normal|wide)\.(positionX|positionY|scale)$/.exec(path);
      if (layer) {
        const rounded = layer[3] === "scale"
          ? Math.round(value * 10000) / 10000
          : Math.round(value * 100) / 100;
        return { type: "set-theme-layer", index: Number(layer[1]), preset: layer[2], property: layer[3], value: rounded };
      }
      const prompt = /^shared\.prompt\.(width|x|y)$/.exec(path);
      if (prompt) {
        return {
          type: "set-theme-token",
          mode: "shared",
          token: STAGE_PROMPT_TOKENS[prompt[1]],
          value: roundPromptRatio(value),
        };
      }
      return null;
    };
    const greetingStagePrefix = () => `shared.greeting.frames.${selectedMode}.${greetingFrameId()}.`;
    const greetingStagePaths = () => ["xRatio", "yRatio", "maxWidthRatio", "fontSize"]
      .map((field) => `${greetingStagePrefix()}${field}`);
    const stageItemPaths = (selection) => {
      if (!selection) return [];
      if (selection.kind === "prompt") return [...STAGE_PROMPT_PATHS];
      if (selection.kind === "greeting") return greetingStagePaths();
      const index = layerIndexForId(selection.id);
      return index < 0 ? [] : STAGE_LAYER_PATHS.map((property) => `layers[${index}].frames.${stageViewport}.${property}`);
    };
    const commitStagePaths = (paths) => {
      if (paths.some((path) => path.startsWith(greetingStagePrefix()))) {
        const frame = { ...activeGreetingFrame() };
        let changed = false;
        for (const path of greetingStagePaths()) {
          if (!stageOverrides.has(path)) continue;
          const field = path.slice(greetingStagePrefix().length);
          const value = stageOverrides.get(path);
          if (Math.abs(Number(frame[field]) - Number(value)) < 0.00005) {
            stageOverrides.delete(path);
            continue;
          }
          frame[field] = value;
          changed = true;
        }
        if (changed) queueGreetingFrame(frame, { immediate: true });
        return;
      }
      const messages = [];
      const adoptsNativePrompt = Boolean(state?.shared?.prompt?.native
        && STAGE_PROMPT_PATHS.some((path) => paths.includes(path) && stageOverrides.has(path)
          && Math.abs(Number(stageOverrides.get(path)) - Number(promptStateValue(path.split(".").at(-1)))) >= 0.00005));
      for (const path of paths) {
        if (!stageOverrides.has(path)) continue;
        const value = stageOverrides.get(path);
        const promptKey = /^shared\.prompt\.(width|x|y)$/.exec(path)?.[1];
        const saved = promptKey ? promptStateValue(promptKey) : statePath(path);
        if (!(adoptsNativePrompt && promptKey)
            && typeof value === "number" && typeof saved === "number"
            && Math.abs(value - saved) < 0.00005) {
          stageOverrides.delete(path);
          continue;
        }
        const message = messageForStagePath(path, value);
        if (message) messages.push(message);
      }
      if (messages.length) queueStageMutations(messages);
    };
    const flushStageKeyChanges = () => {
      if (stageKeyTimer) clearTimeout(stageKeyTimer);
      stageKeyTimer = null;
      const paths = [...stageKeyPaths];
      stageKeyPaths.clear();
      if (paths.length) commitStagePaths(paths);
      reflectButtonStates();
    };

    const stageFrame = document.createElement("div");
    stageFrame.className = "stage-frame";
    const stageCanvas = document.createElement("div");
    stageCanvas.className = "stage-canvas";
    const stageBackdropImg = document.createElement("img");
    stageBackdropImg.className = "stage-backdrop";
    stageBackdropImg.alt = "";
    stageBackdropImg.setAttribute("aria-hidden", "true");
    stageBackdropImg.setAttribute("draggable", "false");
    stageBackdropImg.hidden = true;
    const stageArt = document.createElement("div");
    stageArt.className = "stage-art";
    const stageSidebarEl = document.createElement("div");
    stageSidebarEl.className = "stage-sidebar";
    const stageContentHost = document.createElement("div");
    stageContentHost.className = "stage-content-host";
    const stageZonesHost = document.createElement("div");
    stageZonesHost.className = "stage-zones";
    stageZonesHost.setAttribute("aria-hidden", "true");
    const stageZone = (className, key) => {
      const node = document.createElement("span");
      node.className = `stage-zone ${className}`;
      node.dataset.editorI18n = key;
      node.textContent = tr(key);
      return node;
    };
    stageZonesHost.append(
      stageZone("stage-zone-sidebar", "sidebarZone"),
      stageZone("stage-zone-text", "textSafeZone"),
      stageZone("stage-zone-edge", "edgeCropZone"),
      stageZone("stage-zone-composer", "composerReserve"),
    );
    const stageHud = document.createElement("div");
    stageHud.className = "stage-hud";
    const stageRing = document.createElement("div");
    stageRing.className = "stage-hud-ring";
    // The ring is a pointer-only move surface for the current selection. It
    // sits above overlapping artwork, so an interior drag keeps the layer the
    // user chose in the palette instead of retargeting the topmost image.
    // Focusable edge handles remain the equivalent keyboard controls.
    stageRing.dataset.stageHandle = "move";
    stageRing.setAttribute("aria-hidden", "true");
    stageRing.hidden = true;
    stageHud.appendChild(stageRing);
    // Selection chrome: edge bars move the item, corner handles resize it,
    // and an opacity slider rides the selection border.
    const stageEdges = ["n", "e", "s", "w"].map((side) => {
      const node = document.createElement("div");
      node.className = "stage-edge";
      node.dataset.stageHandle = "move";
      node.dataset.side = side;
      node.setAttribute("role", "slider");
      node.tabIndex = 0;
      node.hidden = true;
      stageHud.appendChild(node);
      return node;
    });
    const stageCorners = ["nw", "ne", "sw", "se"].map((corner) => {
      const node = document.createElement("div");
      node.className = "stage-corner";
      node.dataset.stageHandle = "scale";
      node.dataset.corner = corner;
      node.setAttribute("role", "slider");
      node.tabIndex = 0;
      node.hidden = true;
      stageHud.appendChild(node);
      return node;
    });
    const stageOpacityWrap = document.createElement("div");
    stageOpacityWrap.className = "stage-opacity";
    stageOpacityWrap.hidden = true;
    const stageOpacityInput = document.createElement("input");
    stageOpacityInput.type = "range";
    stageOpacityInput.min = "0";
    stageOpacityInput.max = "100";
    stageOpacityInput.step = "1";
    stageOpacityWrap.appendChild(stageOpacityInput);
    stageHud.appendChild(stageOpacityWrap);
    stageOpacityInput.addEventListener("input", () => {
      if (isBlockingAction() || stageSelection?.kind !== "layer") return;
      const index = layerIndexForId(stageSelection.id);
      if (index < 0) return;
      setStageOverride(`layers[${index}].opacity`, stageOpacityInput.valueAsNumber / 100);
      applyStageLayout();
    });
    stageOpacityInput.addEventListener("change", () => {
      if (isBlockingAction() || stageSelection?.kind !== "layer") return;
      const index = layerIndexForId(stageSelection.id);
      if (index < 0) return;
      queueStageMutations([{
        type: "set-theme-layer",
        index,
        preset: "shared",
        property: "opacity",
        value: stageOpacityInput.valueAsNumber / 100,
      }]);
    });
    // The collapsed canvas palette is a fast selector only. Its visibility
    // buttons are session-local; persistent image settings stay in the
    // inspector so the canvas does not duplicate commands.
    const stageLayersPanel = document.createElement("div");
    stageLayersPanel.className = "stage-layers-panel";
    stageLayersPanel.setAttribute("role", "group");
    stageLayersPanel.dataset.editorI18nAriaLabel = "stageLayersPanel";
    stageLayersPanel.setAttribute("aria-label", "Layers");
    stageLayersPanel.dataset.collapsed = "true";
    const stageLayersHead = document.createElement("button");
    stageLayersHead.type = "button";
    stageLayersHead.className = "stage-layers-head";
    stageLayersHead.setAttribute("aria-expanded", "false");
    const stageLayersList = document.createElement("div");
    stageLayersList.className = "stage-layers-list";
    stageLayersPanel.append(stageLayersHead, stageLayersList);
    let stageLayersUserToggled = false;
    const setStageLayersCollapsed = (collapsed) => {
      stageLayersPanel.dataset.collapsed = String(collapsed);
      stageLayersHead.setAttribute("aria-expanded", String(!collapsed));
    };
    stageLayersHead.addEventListener("click", () => {
      const collapsed = stageLayersPanel.dataset.collapsed === "true";
      stageLayersUserToggled = true;
      setStageLayersCollapsed(!collapsed);
    });
    const stageHiddenLayers = new Set();
    const stageEmptyNote = document.createElement("p");
    stageEmptyNote.className = "stage-empty";
    stageEmptyNote.hidden = true;
    const stagePromptEl = document.createElement("div");
    stagePromptEl.className = "stage-prompt";
    stagePromptEl.dataset.stageItem = "prompt";
    stagePromptEl.dataset.editorFocus = "stage-prompt";
    stagePromptEl.setAttribute("role", "button");
    stagePromptEl.setAttribute("aria-label", tr("stagePromptAria"));
    stagePromptEl.setAttribute("aria-pressed", "false");
    stagePromptEl.tabIndex = 0;
    const stagePromptSample = document.createElement("span");
    stagePromptSample.className = "stage-prompt-sample";
    stagePromptSample.setAttribute("aria-hidden", "true");
    stagePromptSample.textContent = "Aa";
    const stagePromptChip = document.createElement("span");
    stagePromptChip.className = "stage-prompt-chip";
    stagePromptChip.dataset.editorI18n = "stagePromptTag";
    stagePromptChip.textContent = tr("stagePromptTag");
    stagePromptEl.append(stagePromptSample, stagePromptChip);
    // WO-21: Greeting is its own Interface-stage target above the prompt. Its
    // overlay owns editing gestures; the normal Aura greeting remains
    // pointer-inert.
    const stageGreetingEl = document.createElement("div");
    stageGreetingEl.className = "stage-greeting";
    stageGreetingEl.dataset.stageItem = "greeting";
    stageGreetingEl.dataset.editorFocus = "stage-greeting";
    stageGreetingEl.setAttribute("role", "button");
    stageGreetingEl.setAttribute("aria-label", tr("targetGreeting"));
    stageGreetingEl.setAttribute("aria-pressed", "false");
    stageGreetingEl.tabIndex = 0;
    const stageGreetingMark = document.createElement("span");
    stageGreetingMark.className = "stage-greeting-mark";
    stageGreetingMark.textContent = "✳";
    stageGreetingMark.setAttribute("aria-hidden", "true");
    const stageGreetingText = document.createElement("span");
    stageGreetingText.className = "stage-greeting-text";
    // Claude's native starburst trails the greeting. Keep the schematic in
    // that order; a live capture supplies the exact native artwork.
    stageGreetingEl.append(stageGreetingText, stageGreetingMark);
    const stageStripA = document.createElement("div");
    stageStripA.className = "stage-strip";
    const stageStripB = document.createElement("div");
    stageStripB.className = "stage-strip stage-strip-alt";
    const stageComposerEl = document.createElement("div");
    stageComposerEl.className = "stage-composer";
    stageCanvas.append(stageBackdropImg, stageArt, stageSidebarEl, stageContentHost, stageZonesHost);
    stageFrame.append(stageCanvas, stageHud, stageEmptyNote, stageLayersPanel);
    stageRoot.appendChild(stageFrame);
    const stageContextHint = document.createElement("p");
    stageContextHint.className = "help stage-context-hint";
    stageContextHint.textContent = format(tr("stageContextMismatch"), tr("stageNewChat"));
    stageContextHint.hidden = true;
    stageRoot.appendChild(stageContextHint);
    stageRoot.dataset.zones = "false";

    const stageLayerGate = (layer) => {
      const read = (property) => stageValue(`layers[${layer.index}].${property}`);
      const appearance = read("appearance");
      const context = read("context");
      const viewport = read("viewport");
      return read("visible") !== false
        && (appearance === "all" || appearance === selectedMode)
        && (context === "all" || context === stageContext)
        && (viewport === "all" || viewport === stageViewport);
    };
    const stageContextLabel = (context = stageContext) => tr(
      context === "conversation" ? "stageConversation" : "stageNewChat",
    );

    const syncStageToolbar = () => {
      for (const input of stageViewportInputs) input.checked = input.value === stageViewport;
      for (const input of stageContextInputs) input.checked = input.value === stageContext;
      if (stageZonesInput) stageRoot.dataset.zones = String(stageZonesInput.checked);
      const newChat = stageContext === "new-chat";
      if (promptContextSection) {
        promptContextSection.hidden = !newChat;
        promptContextSection.inert = !newChat;
      }
      if (promptContextUnavailable) promptContextUnavailable.hidden = newChat;
      if (greetingContextSection) {
        greetingContextSection.hidden = !newChat;
        greetingContextSection.inert = !newChat;
      }
      if (greetingContextUnavailable) greetingContextUnavailable.hidden = newChat;
      refreshInspectorContext();
      syncStageSelectionMode();
    };

    const renderStageLayersPanel = () => {
      if (!state) return;
      stageLayersHead.textContent = `${tr("stageLayersPanel")} · ${state.layers.length}`;
      stageLayersList.replaceChildren();
      for (const layer of state.layers) {
        const gated = !stageLayerGate(layer);
        const chip = document.createElement("div");
        chip.className = "stage-chip";
        chip.dataset.layerId = layer.id;
        chip.dataset.active = String(stageSelection?.kind === "layer" && stageSelection.id === layer.id);
        chip.dataset.stageHidden = String(stageHiddenLayers.has(layer.id));
        chip.dataset.gated = String(gated);
        const select = document.createElement("button");
        select.type = "button";
        select.className = "stage-chip-select";
        select.dataset.editorFocus = `stage-chip-${layer.id}`;
        select.setAttribute("aria-label", format(tr("stageSelectLayer"), layer.index + 1));
        select.disabled = gated;
        const thumb = document.createElement("span");
        thumb.className = "stage-chip-thumb";
        thumb.setAttribute("aria-hidden", "true");
        if (layer.previewUrl) {
          const image = document.createElement("img");
          image.src = layer.previewUrl;
          image.alt = "";
          image.setAttribute("draggable", "false");
          thumb.appendChild(image);
        } else thumb.textContent = String(layer.index + 1);
        const text = document.createElement("span");
        text.className = "stage-chip-label";
        const currentRole = String(stageValue(`layers[${layer.index}].role`) ?? layer.role);
        text.textContent = `${layer.index + 1} · ${tr(`role${currentRole[0].toUpperCase()}${currentRole.slice(1)}`)}`;
        select.append(thumb, text);
        select.addEventListener("click", () => {
          stageHiddenLayers.delete(layer.id);
          selectStageItem({ kind: "layer", id: layer.id }, { reveal: true });
          renderStage();
        });
        const eye = document.createElement("button");
        eye.type = "button";
        eye.className = "stage-eye";
        eye.dataset.editorFocus = `stage-eye-${layer.id}`;
        eye.setAttribute("aria-pressed", String(!stageHiddenLayers.has(layer.id)));
        eye.setAttribute("aria-label", format(tr("stageEyeToggle"), layer.index + 1, tr(`role${currentRole[0].toUpperCase()}${currentRole.slice(1)}`)));
        eye.textContent = tr(stageHiddenLayers.has(layer.id) ? "stageEyeShowShort" : "stageEyeHideShort");
        eye.disabled = gated;
        eye.addEventListener("click", () => {
          if (stageHiddenLayers.has(layer.id)) stageHiddenLayers.delete(layer.id);
          else {
            stageHiddenLayers.add(layer.id);
            if (stageSelection?.kind === "layer" && stageSelection.id === layer.id) stageSelection = null;
          }
          renderStage();
        });
        chip.append(select, eye);
        stageLayersList.appendChild(chip);
      }
    };

    const ensureStageStructure = () => {
      if (!state) return;
      const focused = document.activeElement?.dataset?.editorFocus ?? null;
      for (const id of [...stageHiddenLayers]) {
        if (!layerForId(id)) stageHiddenLayers.delete(id);
      }
      const seen = new Set();
      let previous = null;
      for (const layer of state.layers) {
        if (stageHiddenLayers.has(layer.id) || !stageLayerGate(layer)) continue;
        seen.add(layer.id);
        let entry = stageLayerNodes.get(layer.id);
        if (entry && entry.previewUrl !== layer.previewUrl) {
          entry.wrap.remove();
          stageLayerNodes.delete(layer.id);
          entry = null;
        }
        if (!entry) {
          const wrap = document.createElement("div");
          wrap.className = "stage-layer";
          let item;
          if (layer.previewUrl) {
            item = document.createElement("img");
            item.src = layer.previewUrl;
            item.alt = "";
            item.setAttribute("draggable", "false");
          } else {
            item = document.createElement("div");
            item.className = "stage-layer-fallback";
            item.textContent = tr("noImagePreview");
          }
          item.classList.add("stage-item");
          item.dataset.stageItem = layer.id;
          item.dataset.editorFocus = `stage-layer-${layer.id}`;
          item.setAttribute("role", "button");
          item.setAttribute("aria-pressed", "false");
          item.tabIndex = 0;
          wrap.appendChild(item);
          entry = { wrap, item, previewUrl: layer.previewUrl };
          stageLayerNodes.set(layer.id, entry);
        }
        const currentRole = String(stageValue(`layers[${layer.index}].role`) ?? layer.role);
        const roleLabel = tr(`role${currentRole[0].toUpperCase()}${currentRole.slice(1)}`);
        entry.item.setAttribute("aria-label", format(tr("stageLayerAria"), layer.index + 1, roleLabel));
        if (previous) previous.after(entry.wrap);
        else stageArt.prepend(entry.wrap);
        previous = entry.wrap;
      }
      for (const [id, entry] of [...stageLayerNodes]) {
        if (!seen.has(id)) {
          entry.wrap.remove();
          stageLayerNodes.delete(id);
        }
      }
      stageContentHost.replaceChildren(...(stageContext === "new-chat"
        ? [stageGreetingEl, stagePromptEl]
        : [stageStripA, stageStripB, stageComposerEl]));
      stageEmptyNote.textContent = tr("stageEmpty");
      stageEmptyNote.hidden = inspectorBranch !== "background" || seen.size > 0;
      if (stageSelection?.kind === "layer" && !seen.has(stageSelection.id)) stageSelection = null;
      renderStageLayersPanel();
      syncStageSelectionMode();
      if (focused && !document.activeElement?.dataset?.editorFocus) {
        stageRoot.querySelector(`[data-editor-focus="${focused}"]`)?.focus();
      }
      syncStageToolbar();
    };

    const syncStageHud = () => {
      if (!stageSelectionAllowed(stageSelection)) stageSelection = null;
      stagePromptEl.setAttribute("aria-pressed", String(stageSelection?.kind === "prompt"));
      stageGreetingEl.setAttribute("aria-pressed", String(stageSelection?.kind === "greeting"));
      for (const [id, entry] of stageLayerNodes) {
        entry.item.setAttribute("aria-pressed",
          String(stageSelection?.kind === "layer" && stageSelection.id === id));
      }
      let target = null;
      if (stageSelection?.kind === "layer") target = stageLayerNodes.get(stageSelection.id)?.item ?? null;
      else if (stageSelection?.kind === "prompt" && stageContext === "new-chat") target = stagePromptEl;
      else if (stageSelection?.kind === "greeting" && stageContext === "new-chat") target = stageGreetingEl;
      const chrome = [...stageEdges, ...stageCorners];
      if (!target || !state) {
        stageRing.hidden = true;
        stageOpacityWrap.hidden = true;
        for (const node of chrome) node.hidden = true;
        return;
      }
      const frameRect = stageFrame.getBoundingClientRect();
      const rect = target.getBoundingClientRect();
      const left = rect.left - frameRect.left;
      const top = rect.top - frameRect.top;
      const clampX = (value, size) => clampNumber(value, 2, Math.max(2, frameRect.width - size - 2));
      const clampY = (value, size) => clampNumber(value, 2, Math.max(2, frameRect.height - size - 2));
      stageRing.hidden = false;
      stageRing.style.left = `${left}px`;
      stageRing.style.top = `${top}px`;
      stageRing.style.width = `${rect.width}px`;
      stageRing.style.height = `${rect.height}px`;
      const prompt = stageSelection.kind === "prompt";
      const greeting = stageSelection.kind === "greeting";
      const setRect = (node, x, y, width, height) => {
        node.hidden = false;
        node.style.left = `${x}px`;
        node.style.top = `${y}px`;
        node.style.width = `${width}px`;
        node.style.height = `${height}px`;
      };
      const barLength = Math.max(12, rect.width - 24);
      const sideLength = Math.max(12, rect.height - 24);
      setRect(stageEdges[0], clampX(left + 12, barLength), clampY(top - 4, 8), barLength, 8);
      setRect(stageEdges[1], clampX(left + rect.width - 4, 8), clampY(top + 12, sideLength), 8, sideLength);
      setRect(stageEdges[2], clampX(left + 12, barLength), clampY(top + rect.height - 4, 8), barLength, 8);
      setRect(stageEdges[3], clampX(left - 4, 8), clampY(top + 12, sideLength), 8, sideLength);
      const selectionIndex = stageSelection.kind === "layer" ? layerIndexForId(stageSelection.id) : -1;
      const framePrefix = selectionIndex >= 0 ? `layers[${selectionIndex}].frames.${stageViewport}.` : "";
      const positionX = Number(prompt
        ? stageValue("shared.prompt.x") * 100
        : greeting ? stageValue(`${greetingStagePrefix()}xRatio`) * 100
          : stageValue(`${framePrefix}positionX`)) || 0;
      const positionY = Number(prompt
        ? stageValue("shared.prompt.y") * 100
        : greeting ? stageValue(`${greetingStagePrefix()}yRatio`) * 100
          : stageValue(`${framePrefix}positionY`)) || 0;
      for (const node of stageEdges) {
        const horizontal = node.dataset.side === "e" || node.dataset.side === "w";
        const value = horizontal ? positionX : positionY;
        const limit = prompt ? (horizontal ? 35 : 30)
          : greeting ? (horizontal ? 45 : 40) : 100;
        node.setAttribute("aria-label", tr("stageMoveHandle"));
        node.setAttribute("aria-orientation", horizontal ? "horizontal" : "vertical");
        node.setAttribute("aria-valuemin", String(-limit));
        node.setAttribute("aria-valuemax", String(limit));
        node.setAttribute("aria-valuenow", String(Math.round(value * 100) / 100));
        node.setAttribute("aria-valuetext", `${Math.round(value * 100) / 100}%`);
      }
      const cornerTarget = 24;
      const cornerOffset = cornerTarget / 2;
      const cornerPoints = {
        nw: [left - cornerOffset, top - cornerOffset], ne: [left + rect.width - cornerOffset, top - cornerOffset],
        sw: [left - cornerOffset, top + rect.height - cornerOffset], se: [left + rect.width - cornerOffset, top + rect.height - cornerOffset],
      };
      for (const node of stageCorners) {
        const point = cornerPoints[node.dataset.corner];
        const value = prompt
          ? (Number(stageValue("shared.prompt.width")) || 0.4) * 100
          : greeting ? Number(stageValue(`${greetingStagePrefix()}fontSize`)) || 24
            : (Number(stageValue(`${framePrefix}scale`)) || 1) * 100;
        node.hidden = false;
        node.style.left = `${clampX(point[0], cornerTarget)}px`;
        node.style.top = `${clampY(point[1], cornerTarget)}px`;
        node.setAttribute("aria-label", tr(prompt ? "stageWidthHandle" : "stageScaleHandle"));
        node.setAttribute("aria-valuemin", prompt ? "40" : greeting ? "24" : "25");
        node.setAttribute("aria-valuemax", prompt ? "96" : greeting ? "72" : "300");
        node.setAttribute("aria-valuenow", String(Math.round(value * 100) / 100));
        node.setAttribute("aria-valuetext", `${Math.round(value * 100) / 100}%`);
      }
      if (prompt || greeting) {
        stageOpacityWrap.hidden = true;
      } else {
        const index = layerIndexForId(stageSelection.id);
        const opacity = Number(index < 0 ? 1 : stageValue(`layers[${index}].opacity`));
        stageOpacityInput.value = String(Math.round((Number.isFinite(opacity) ? opacity : 1) * 100));
        stageOpacityInput.setAttribute("aria-label", tr("layerOpacity"));
        stageOpacityWrap.hidden = false;
        let wrapTop = top + rect.height + 10;
        if (wrapTop + 34 > frameRect.height) wrapTop = top + rect.height - 42;
        stageOpacityWrap.style.left = `${clampX(left + 6, 110)}px`;
        stageOpacityWrap.style.top = `${clampY(wrapTop, 30)}px`;
      }
    };

    const applyStageLayout = () => {
      if (!state) return;
      const captureActive = stageBackdropOn();
      const [logicalWidth, logicalHeight] = stageLogicalSize();
      const stageHostWidth = stageRoot.clientWidth;
      const currentFrameHeight = stageFrame.offsetHeight;
      const panelChromeHeight = Math.max(110,
        (stagePanel?.offsetHeight ?? (currentFrameHeight + 110)) - currentFrameHeight);
      const paneHeight = stageColumn?.clientHeight ?? 0;
      const viewportHeight = content?.clientHeight || window.innerHeight || logicalHeight;
      const entryOffset = (editorHeader?.offsetHeight ?? 0) + 22;
      const availableFrameHeight = Math.max(120, paneHeight > 0
        ? paneHeight - panelChromeHeight - 16
        : viewportHeight - entryOffset - panelChromeHeight - 16);
      const scale = stageHostWidth > 0
        ? Math.min(1, stageHostWidth / logicalWidth, availableFrameHeight / logicalHeight)
        : 0;
      const frameWidth = scale ? Math.round(logicalWidth * scale) : 0;
      const frameHeight = scale ? Math.round(logicalHeight * scale) : 0;
      stageFrame.style.width = frameWidth ? `${frameWidth}px` : "";
      stageFrame.style.height = frameHeight ? `${frameHeight}px` : "";
      if (frameWidth) {
        const compactLayers = frameWidth < 720 || frameHeight < 360;
        if (compactLayers || !stageLayersUserToggled) setStageLayersCollapsed(true);
      }
      stageFrame.dataset.backdrop = captureActive ? "capture" : "schematic";
      stageFrame.dataset.captureState = captureActive
        ? (stageMirror === stageLiveMirror ? "live" : "cached")
        : "schematic";
      const missingSelectedCapture = Boolean(backdropToggleInput?.checked && !captureActive);
      stageContextHint.hidden = !missingSelectedCapture;
      if (missingSelectedCapture) {
        stageContextHint.textContent = format(tr("stageContextMismatch"), stageContextLabel());
      }
      if (openAuraButton) {
        const labelKey = missingSelectedCapture ? "stageOpenContext" : "openAuraWindow";
        openAuraButton.dataset.editorI18n = labelKey;
        openAuraButton.textContent = tr(labelKey);
      }
      stageBackdropImg.hidden = !captureActive;
      if (captureActive && stageBackdropImg.src !== stageMirror.image) stageBackdropImg.src = stageMirror.image;
      stageCanvas.style.width = `${logicalWidth}px`;
      stageCanvas.style.height = `${logicalHeight}px`;
      stageCanvas.style.transform = `scale(${scale || 1})`;
      const tokenValue = (key) => stageValue(`tokens.${selectedMode}.${key}`);
      // Over a live capture, an uncommitted colour edit stays invisible until the
      // host re-renders and pushes a fresh capture. While one is pending, dim the
      // capture and let the schematic fills preview the change immediately; it
      // clears itself the moment the override commits and the recapture lands.
      const colorPreview = captureActive && [...stageOverrides.keys()].some((path) =>
        (path.startsWith(`tokens.${selectedMode}.`)
          || path === "shared.radius" || path === "shared.blur" || path === "shared.shadow")
          && String(stageOverrides.get(path)) !== String(statePath(path)));
      stageFrame.dataset.colorPreview = colorPreview ? "true" : "";
      stageSidebarEl.hidden = captureActive && !colorPreview;
      const scope = stageValue("shared.backgroundScope");
      const radius = Number(stageValue("shared.radius")) || 0;
      const blur = Number(stageValue("shared.blur")) || 0;
      const shadow = STAGE_SHADOWS[stageValue("shared.shadow")] ?? "none";
      stageCanvas.style.background = tokenValue("canvas") ?? "#808080";
      const mainMetrics = stageMainMetrics(logicalWidth, logicalHeight);
      stageArt.style.left = scope === "content" ? `${mainMetrics.left}px` : "0";
      const sidebarColor = tokenValue("sidebar") ?? "#808080";
      const sidebarAlpha = Number(tokenValue("sidebarAlpha")) || 1;
      stageSidebarEl.style.width = `${mainMetrics.left}px`;
      stageSidebarEl.style.background = scope === "full-window"
        ? `color-mix(in srgb, ${sidebarColor} ${Math.round(sidebarAlpha * 100)}%, transparent)`
        : sidebarColor;
      stageSidebarEl.style.backdropFilter = scope === "full-window" && blur ? `blur(${Math.min(blur, 32)}px)` : "";
      stageSidebarEl.style.borderRight = `1px solid ${tokenValue("border") ?? "transparent"}`;
      for (const [id, entry] of stageLayerNodes) {
        const index = layerIndexForId(id);
        if (index < 0) continue;
        const framePath = (property) => `layers[${index}].frames.${stageViewport}.${property}`;
        const frameNumber = (property) => Number(stageValue(framePath(property)));
        const anchor = ANCHOR_POINTS[stageValue(framePath("anchor"))] ?? ANCHOR_POINTS.center;
        const opacity = Number(stageValue(`layers[${index}].opacity`));
        entry.wrap.style.opacity = Number.isFinite(opacity) ? String(opacity) : "";
        entry.wrap.dataset.mask = String(stageValue(`layers[${index}].mask`) ?? "none");
        const focalX = frameNumber("focalX") || 0;
        const focalY = frameNumber("focalY") || 0;
        entry.item.style.left = `calc(${anchor[0]}% + ${frameNumber("positionX") || 0}%)`;
        entry.item.style.top = `calc(${anchor[1]}% + ${frameNumber("positionY") || 0}%)`;
        entry.item.style.transform = `translate(${-focalX}%, ${-focalY}%) scale(${frameNumber("scale") || 1})`;
        entry.item.style.transformOrigin = `${focalX}% ${focalY}%`;
      }
      const surface = `color-mix(in srgb, ${tokenValue("surface") ?? "#ffffff"} ${Math.round((Number(tokenValue("surfaceAlpha")) || 1) * 100)}%, transparent)`;
      const mainLeft = STAGE_SIDEBAR_WIDTH;
      const mainWidth = logicalWidth - STAGE_SIDEBAR_WIDTH;
      const applySurface = (node) => {
        node.style.background = surface;
        node.style.border = `1px solid ${tokenValue("border") ?? "transparent"}`;
        node.style.borderRadius = `${radius}px`;
        node.style.boxShadow = shadow;
        node.style.backdropFilter = blur ? `blur(${Math.min(blur, 32)}px)` : "";
      };
      if (stageContext === "new-chat") {
        const realPrompt = captureActive ? stageMirror?.geometry?.prompt : null;
        let rect;
        if (realPrompt && realPrompt.width > 40) {
          // The capture already shows the prompt at the saved draft values, so
          // the outline sits on the real rect and only uncommitted deltas move it.
          const deltaX = ((Number(stageValue("shared.prompt.x")) || 0) - (Number(promptStateValue("x")) || 0)) * mainMetrics.width;
          const deltaY = ((Number(stageValue("shared.prompt.y")) || 0) - (Number(promptStateValue("y")) || 0)) * mainMetrics.height;
          const deltaW = ((Number(stageValue("shared.prompt.width")) || 0) - (Number(promptStateValue("width")) || 0)) * mainMetrics.width;
          rect = {
            left: realPrompt.left + deltaX - (deltaW / 2),
            top: realPrompt.top + deltaY,
            width: Math.max(120, realPrompt.width + deltaW),
            height: realPrompt.height,
          };
        } else {
          rect = promptRect(logicalWidth, logicalHeight,
            Number(stageValue("shared.prompt.width")) || 0.7,
            Number(stageValue("shared.prompt.x")) || 0,
            Number(stageValue("shared.prompt.y")) || 0);
        }
        applySurface(stagePromptEl);
        stagePromptEl.style.left = `${rect.left}px`;
        stagePromptEl.style.top = `${rect.top}px`;
        stagePromptEl.style.width = `${rect.width}px`;
        stagePromptEl.style.height = `${rect.height}px`;
        stagePromptEl.style.color = tokenValue("text") ?? "#000000";
        stagePromptSample.style.fontFamily = STAGE_FONT_STACKS[stageValue("shared.fontDisplay")]
          ?? STAGE_FONT_STACKS["system-sans"];
        stagePromptChip.style.color = tokenValue("accent") ?? "currentColor";
        const greeting = activeGreetingFrame();
        const liveGreeting = captureActive && stageMirror?.geometry?.greeting?.status === "found"
          ? stageMirror.geometry.greeting.rect : null;
        if (greeting && (!captureActive || liveGreeting)) {
          const boxWidth = mainMetrics.width * Number(stageValue(`${greetingStagePrefix()}maxWidthRatio`));
          const centre = mainMetrics.left + (mainMetrics.width / 2)
            + (mainMetrics.width * Number(stageValue(`${greetingStagePrefix()}xRatio`)));
          const gap = Math.max(24, greeting.fontSize * 0.9);
          stageGreetingEl.hidden = false;
          stageGreetingEl.dataset.liveTarget = liveGreeting ? "true" : "";
          if (liveGreeting) {
            const deltaX = (Number(stageValue(`${greetingStagePrefix()}xRatio`)) - greeting.xRatio)
              * mainMetrics.width;
            const deltaY = (Number(stageValue(`${greetingStagePrefix()}yRatio`)) - greeting.yRatio)
              * mainMetrics.height;
            const deltaWidth = (Number(stageValue(`${greetingStagePrefix()}maxWidthRatio`))
              - greeting.maxWidthRatio) * mainMetrics.width;
            const fontRatio = Number(stageValue(`${greetingStagePrefix()}fontSize`)) / greeting.fontSize;
            stageGreetingEl.style.left = `${liveGreeting.left + deltaX - (deltaWidth / 2)}px`;
            stageGreetingEl.style.top = `${liveGreeting.top + deltaY}px`;
            stageGreetingEl.style.width = `${Math.max(48, liveGreeting.width + deltaWidth)}px`;
            stageGreetingEl.style.height = `${Math.max(24, liveGreeting.height * fontRatio)}px`;
          } else {
            stageGreetingEl.style.left = `${centre - (boxWidth / 2)}px`;
            stageGreetingEl.style.width = `${boxWidth}px`;
            stageGreetingEl.style.height = "";
            stageGreetingEl.style.top = `${rect.top - gap - (Number(stageValue(`${greetingStagePrefix()}fontSize`)) * greeting.lineHeight)
              + (mainMetrics.height * Number(stageValue(`${greetingStagePrefix()}yRatio`)))}px`;
          }
          stageGreetingEl.style.justifyContent = greeting.align === "start" ? "flex-start"
            : greeting.align === "end" ? "flex-end" : "center";
          stageGreetingEl.style.color = greeting.color === "accent"
            ? (tokenValue("accent") ?? "currentColor")
            : (tokenValue("text") ?? "#000000");
          stageGreetingText.textContent = greetingSampleText();
          const textStyle = stageGreetingText.style;
          textStyle.fontFamily = GREETING_FONT_STACKS[greeting.font] ?? GREETING_FONT_STACKS["system-sans"];
          textStyle.fontSize = `${Number(stageValue(`${greetingStagePrefix()}fontSize`))}px`;
          textStyle.fontWeight = String(greeting.weight);
          textStyle.fontStyle = greeting.italic ? "italic" : "normal";
          textStyle.letterSpacing = `${greeting.letterSpacing}em`;
          textStyle.lineHeight = String(greeting.lineHeight);
          textStyle.textAlign = greeting.align;
          textStyle.textDecoration = greeting.decoration === "underline" ? "underline" : "none";
          textStyle.borderBottom = greeting.decoration === "hairline" ? "1px solid currentColor" : "none";
          textStyle.textShadow = greeting.decoration === "glow"
            ? "0 0 18px color-mix(in srgb, var(--accent) 35%, transparent)"
            : "none";
          stageGreetingMark.hidden = greeting.markSource === "none";
          stageGreetingMark.style.fontSize = `${greeting.fontSize * greeting.markScale
            * (greeting.markSource === "compact" ? 0.6 : 0.85)}px`;
        } else {
          stageGreetingEl.hidden = true;
          stageGreetingEl.dataset.liveTarget = "";
        }
      } else {
        const strips = [[stageStripA, 0.16, 0.13, 0.16, 0.56], [stageStripB, 0.34, 0.17, 0.24, 0.56]];
        for (const [node, topRatio, heightRatio, leftRatio, widthRatio] of strips) {
          applySurface(node);
          node.style.left = `${mainLeft + (mainWidth * leftRatio)}px`;
          node.style.top = `${logicalHeight * topRatio}px`;
          node.style.width = `${mainWidth * widthRatio}px`;
          node.style.height = `${logicalHeight * heightRatio}px`;
        }
        applySurface(stageComposerEl);
        stageComposerEl.style.left = `${mainLeft + (mainWidth * 0.14)}px`;
        stageComposerEl.style.width = `${mainWidth * 0.72}px`;
        stageComposerEl.style.height = "110px";
        stageComposerEl.style.top = `${logicalHeight - 134}px`;
      }
      const zones = stageZonesHost.children;
      const setZoneRect = (node, left, top, width, height) => {
        node.style.left = `${left}px`;
        node.style.top = `${top}px`;
        node.style.width = `${width}px`;
        node.style.height = `${height}px`;
      };
      setZoneRect(zones[0], 0, 0, STAGE_SIDEBAR_WIDTH, logicalHeight);
      setZoneRect(zones[1], mainLeft + (mainWidth * 0.1), logicalHeight * 0.14, mainWidth * 0.62, logicalHeight * 0.5);
      setZoneRect(zones[2], logicalWidth - (mainWidth * 0.18) - 8, logicalHeight * 0.08, mainWidth * 0.18, logicalHeight * 0.6);
      setZoneRect(zones[3], mainLeft + (mainWidth * 0.14), logicalHeight * 0.74, mainWidth * 0.72, logicalHeight * 0.2);
      syncStageHud();
    };

    const renderStage = () => {
      if (!state || stageDrag) return;
      if (!coalescedChanges.size && !deferredChanges.size && !pendingAction
          && !stageKeyTimer && !stageKeyPaths.size) stageOverrides.clear();
      ensureStageStructure();
      applyStageLayout();
      renderStageMatrix();
      updateLayerGateBadges();
    };

    const syncSelectedLayerCards = () => {
      for (const card of layerList.querySelectorAll(".layer-card")) {
        const selected = card.dataset.layerId === selectedLayerId;
        card.dataset.selected = String(selected);
        card.open = selected;
      }
    };

    const selectStageItem = (selection, { reveal = false } = {}) => {
      if (!stageSelectionAllowed(selection)) return false;
      stageSelection = selection;
      for (const chip of stageLayersPanel.querySelectorAll(".stage-chip")) {
        chip.dataset.active = String(
          selection?.kind === "layer" && chip.dataset.layerId === selection.id,
        );
      }
      if (selection?.kind === "layer") {
        const layer = layerForId(selection.id);
        if (!layer) return;
        selectedLayerId = selection.id;
        const card = layerList.querySelector(`[data-layer-id="${CSS.escape(selection.id)}"]`);
        if (reveal) {
          if (card) card.open = true;
        }
        syncSelectedLayerCards();
        inspectorField = `layers[${layer.index}].frames.${stageViewport}.positionX`;
        setInspectorTarget("background.layer");
        if (reveal && card) requestAnimationFrame(() => {
          revealWithinInspector(card.querySelector("summary") ?? card);
        });
        announce(format(tr("stageSelectedAnnounce"), format(tr("layerNumber"), layer.index + 1)));
      } else if (selection?.kind === "prompt") {
        inspectorField = "shared.prompt";
        setInspectorTarget("interface.new-chat-area", { reveal });
        announce(format(tr("stageSelectedAnnounce"), tr("stagePromptTag")));
      } else if (selection?.kind === "greeting") {
        inspectorField = `${greetingStagePrefix()}xRatio`;
        setInspectorTarget("interface.greeting", { reveal });
        announce(format(tr("stageSelectedAnnounce"), tr("targetGreeting")));
      }
      syncStageHud();
      return true;
    };

    const stageSelectionFromNode = (node) => {
      const selection = node.dataset.stageItem === "prompt"
        ? { kind: "prompt" }
        : node.dataset.stageItem === "greeting"
          ? { kind: "greeting" }
        : { kind: "layer", id: node.dataset.stageItem };
      return stageSelectionAllowed(selection) ? selection : null;
    };
    const selectStageBranchSurface = () => {
      if (inspectorBranch === "widgets") {
        announce(tr("branchWidgetsHelp"));
        return false;
      }
      const target = inspectorBranch === "interface" ? "interface.theme"
        : "background.canvas";
      stageSelection = null;
      inspectorField = defaultInspectorField(target);
      setInspectorTarget(target, { reveal: true });
      syncStageHud();
      renderStage();
      announce(format(tr("stageSelectedAnnounce"), targetLabel(target)));
      return true;
    };

    const stageInputFor = (path) => {
      const cached = stageInputCache.get(path);
      if (cached && cached.isConnected) return cached;
      const input = editor.querySelector(`input[data-editor-field="${CSS.escape(path)}"]`);
      if (input) stageInputCache.set(path, input);
      else stageInputCache.delete(path);
      return input;
    };

    const reflectStageInputs = (paths) => {
      for (const path of paths) {
        if (!stageOverrides.has(path)) continue;
        const value = stageOverrides.get(path);
        const input = stageInputFor(path);
        if (!input || input.type !== "range") continue;
        const prompt = path.startsWith("shared.prompt.");
        const greeting = /^shared\.greeting\.frames\.(?:light|dark)\.(?:standard|wide)\.(.+)$/.exec(path)?.[1] ?? null;
        input.value = String(prompt ? Math.round(value * 100) : value);
        const exact = input.parentElement?.querySelector(
          ".layer-exact-value, .prompt-exact-value, .greeting-exact-value",
        );
        if (exact) exact.value = String(prompt ? Math.round(value * 100) : value);
        const output = prompt
          ? document.getElementById(`${input.id}-output`)
          : input.parentElement?.querySelector("output");
        if (output) {
          output.value = greeting ? greetingOutputText(greeting, value)
            : prompt || path.endsWith("scale")
            ? `${Math.round(value * 100)}%`
            : `${Math.round(value)}%`;
        }
      }
    };

    stageRoot.addEventListener("pointerdown", (event) => {
      if (!state || isBlockingAction() || (event.button !== 0 && event.pointerType !== "touch")) return;
      if (event.target.closest?.(".stage-layers-panel, .stage-opacity")) return;
      const handle = event.target.closest?.("[data-stage-handle]");
      const itemNode = event.target.closest?.("[data-stage-item]");
      const directSelection = itemNode ? stageSelectionFromNode(itemNode) : null;
      if (!handle && !directSelection) {
        if (selectStageBranchSurface()) event.preventDefault();
        return;
      }
      event.preventDefault();
      let selection = stageSelection;
      if (directSelection) {
        selection = directSelection;
        selectStageItem(selection, { reveal: true });
        itemNode.focus?.();
      }
      if (!selection || !stageSelectionAllowed(selection)) return;
      const [logicalWidth, logicalHeight] = stageLogicalSize();
      const mainMetrics = stageMainMetrics(logicalWidth, logicalHeight);
      const scale = stageFrame.clientWidth > 0 ? stageFrame.clientWidth / logicalWidth : 1;
      if (selection.kind === "layer") stageLayerNodes.get(selection.id)?.wrap.classList.add("is-active");
      const start = {};
      for (const path of stageItemPaths(selection)) start[path] = Number(stageValue(path)) || 0;
      const targetRect = (selection.kind === "layer"
        ? stageLayerNodes.get(selection.id)?.item
        : selection.kind === "greeting" ? stageGreetingEl : stagePromptEl)?.getBoundingClientRect();
      const handleKind = handle?.dataset.stageHandle;
      if (selection.kind === "layer") {
        const index = layerIndexForId(selection.id);
        if (index >= 0) {
          inspectorField = `layers[${index}].frames.${stageViewport}.${handleKind === "scale" ? "scale" : "positionX"}`;
        }
      } else if (selection.kind === "prompt") {
        inspectorField = "shared.prompt";
      } else {
        inspectorField = `${greetingStagePrefix()}xRatio`;
      }
      refreshInspectorContext();
      const corner = handle?.dataset.corner ?? "se";
      stageDrag = {
        pointerId: event.pointerId,
        kind: handleKind === "scale"
          ? (selection.kind === "prompt" ? "prompt-width"
            : selection.kind === "greeting" ? "greeting-size" : "scale")
          : selection.kind === "prompt" ? "prompt-move"
            : selection.kind === "greeting" ? "greeting-move" : "layer-move",
        signX: corner.includes("w") ? -1 : 1,
        signY: corner.includes("n") ? -1 : 1,
        selection,
        startX: event.clientX,
        startY: event.clientY,
        scale,
        logicalHeight,
        artWidth: stageValue("shared.backgroundScope") === "content"
          ? logicalWidth - mainMetrics.left
          : logicalWidth,
        mainWidth: mainMetrics.width,
        mainHeight: mainMetrics.height,
        start,
        rectSize: Math.max(60, (targetRect?.width ?? 0) + (targetRect?.height ?? 0)),
      };
      try { stageRoot.setPointerCapture(event.pointerId); } catch { /* synthetic pointers have no capture */ }
      stageRoot.classList.add("is-dragging");
    });

    // Turn a pointer sample into overrides. Pure state math, no layout reads —
    // the paint is deferred to the animation frame so bursts of moves collapse.
    const computeStageDragOverrides = (drag, event) => {
      const dx = (event.clientX - drag.startX) / drag.scale;
      const dy = (event.clientY - drag.startY) / drag.scale;
      if (drag.kind === "layer-move") {
        const index = layerIndexForId(drag.selection.id);
        if (index < 0) return;
        const prefix = `layers[${index}].frames.${stageViewport}.`;
        let nextX = clampNumber(drag.start[`${prefix}positionX`] + (dx / drag.artWidth * 100), -100, 100);
        let nextY = clampNumber(drag.start[`${prefix}positionY`] + (dy / drag.logicalHeight * 100), -100, 100);
        if (!event.altKey) {
          // Snap to the anchor point (the layer's aligned default); Alt bypasses.
          if (Math.abs(nextX) < 2.5) nextX = 0;
          if (Math.abs(nextY) < 2.5) nextY = 0;
        }
        setStageOverride(`${prefix}positionX`, nextX);
        setStageOverride(`${prefix}positionY`, nextY);
      } else if (drag.kind === "scale") {
        const index = layerIndexForId(drag.selection.id);
        if (index < 0) return;
        const prefix = `layers[${index}].frames.${stageViewport}.`;
        const factor = 1 + (((drag.signX * (event.clientX - drag.startX)) + (drag.signY * (event.clientY - drag.startY))) / drag.rectSize);
        setStageOverride(`${prefix}scale`, clampNumber(drag.start[`${prefix}scale`] * factor, 0.25, 3));
      } else if (drag.kind === "prompt-move") {
        seedNativePromptOverrides();
        let nextX = clampNumber(drag.start["shared.prompt.x"] + (dx / drag.mainWidth), -0.35, 0.35);
        let nextY = clampNumber(drag.start["shared.prompt.y"] + (dy / drag.mainHeight), -0.3, 0.3);
        if (!event.altKey) {
          // Snap the prompt block back to its centered default; Alt bypasses.
          if (Math.abs(nextX) < 0.02) nextX = 0;
          if (Math.abs(nextY) < 0.02) nextY = 0;
        }
        stageRoot.dataset.snap = `${nextX === 0 ? "x" : ""}${nextY === 0 ? "y" : ""}`;
        setStageOverride("shared.prompt.x", nextX);
        setStageOverride("shared.prompt.y", nextY);
      } else if (drag.kind === "prompt-width") {
        seedNativePromptOverrides();
        setStageOverride("shared.prompt.width",
          clampNumber(drag.start["shared.prompt.width"] + (drag.signX * dx * 2 / drag.mainWidth), 0.4, 0.96));
      } else if (drag.kind === "greeting-move") {
        const prefix = greetingStagePrefix();
        let nextX = clampNumber(drag.start[`${prefix}xRatio`] + (dx / drag.mainWidth), -0.45, 0.45);
        let nextY = clampNumber(drag.start[`${prefix}yRatio`] + (dy / drag.mainHeight), -0.4, 0.45);
        if (!event.altKey) {
          if (Math.abs(nextX) < 0.02) nextX = 0;
          if (Math.abs(nextY) < 0.02) nextY = 0;
        }
        stageRoot.dataset.snap = `${nextX === 0 ? "x" : ""}${nextY === 0 ? "y" : ""}`;
        setStageOverride(`${prefix}xRatio`, nextX);
        setStageOverride(`${prefix}yRatio`, nextY);
      } else if (drag.kind === "greeting-size") {
        const prefix = greetingStagePrefix();
        const delta = ((drag.signX * dx) + (drag.signY * dy)) / 16;
        setStageOverride(`${prefix}fontSize`,
          clampNumber(drag.start[`${prefix}fontSize`] + delta, 24, 72));
      }
    };

    const runStageDragFrame = () => {
      stageDragFrame = 0;
      const event = stageDragEvent;
      stageDragEvent = null;
      if (!stageDrag || !event) return;
      computeStageDragOverrides(stageDrag, event);
      applyStageLayout();
      reflectStageInputs(stageItemPaths(stageDrag.selection));
      refreshInspectorContext();
    };

    stageRoot.addEventListener("pointermove", (event) => {
      if (!stageDrag || event.pointerId !== stageDrag.pointerId) return;
      stageDragEvent = event;
      if (!stageDragFrame) stageDragFrame = requestAnimationFrame(runStageDragFrame);
    });

    const endStageDrag = (event) => {
      if (!stageDrag || event.pointerId !== stageDrag.pointerId) return;
      // Apply the final buffered sample before committing so the last sliver of
      // movement is not dropped with the cancelled frame.
      if (stageDragFrame) { cancelAnimationFrame(stageDragFrame); stageDragFrame = 0; }
      if (stageDragEvent) { computeStageDragOverrides(stageDrag, stageDragEvent); stageDragEvent = null; }
      try {
        if (stageRoot.hasPointerCapture?.(event.pointerId)) stageRoot.releasePointerCapture(event.pointerId);
      } catch { /* synthetic pointers have no capture */ }
      stageRoot.classList.remove("is-dragging");
      delete stageRoot.dataset.snap;
      for (const active of stageArt.querySelectorAll(".is-active")) active.classList.remove("is-active");
      const drag = stageDrag;
      stageDrag = null;
      commitStagePaths(stageItemPaths(drag.selection));
      renderStage();
      refreshInspectorContext();
    };
    stageRoot.addEventListener("pointerup", endStageDrag);
    stageRoot.addEventListener("pointercancel", endStageDrag);

    stageRoot.addEventListener("keydown", (event) => {
      if (!state || isBlockingAction()) return;
      const handle = event.target.closest?.("[data-stage-handle]");
      const itemNode = event.target.closest?.("[data-stage-item]");
      if (!handle && !itemNode) return;
      const selection = itemNode ? stageSelectionFromNode(itemNode) : stageSelection;
      if (!selection || !stageSelectionAllowed(selection)) return;
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        selectStageItem(selection, { reveal: true });
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        const paths = stageItemPaths(selection);
        for (const path of paths) {
          stageOverrides.delete(path);
          stageKeyPaths.delete(path);
        }
        if (!stageKeyPaths.size && stageKeyTimer) {
          clearTimeout(stageKeyTimer);
          stageKeyTimer = null;
        }
        applyStageLayout();
        reflectStageInputs(paths);
        reflectButtonStates();
        return;
      }
      const step = event.shiftKey ? 5 : 1;
      const handleKind = handle?.dataset.stageHandle;
      const scaleDirection = event.key === "ArrowRight" || event.key === "ArrowUp" ? 1
        : event.key === "ArrowLeft" || event.key === "ArrowDown" ? -1 : 0;
      let changed = false;
      const adjust = (path, delta, minimum, maximum) => {
        setStageOverride(path, clampNumber((Number(stageValue(path)) || 0) + delta, minimum, maximum));
        changed = true;
      };
      if (selection.kind === "layer") {
        const index = layerIndexForId(selection.id);
        if (index < 0) return;
        const prefix = `layers[${index}].frames.${stageViewport}.`;
        if (handleKind === "scale" && scaleDirection) {
          adjust(`${prefix}scale`, scaleDirection * (event.shiftKey ? 0.2 : 0.05), 0.25, 3);
        } else if (handleKind === "move") {
          const horizontal = handle.dataset.side === "e" || handle.dataset.side === "w";
          if (horizontal && event.key === "ArrowLeft") adjust(`${prefix}positionX`, -step, -100, 100);
          else if (horizontal && event.key === "ArrowRight") adjust(`${prefix}positionX`, step, -100, 100);
          else if (!horizontal && event.key === "ArrowUp") adjust(`${prefix}positionY`, -step, -100, 100);
          else if (!horizontal && event.key === "ArrowDown") adjust(`${prefix}positionY`, step, -100, 100);
        } else if (event.key === "ArrowLeft") adjust(`${prefix}positionX`, -step, -100, 100);
        else if (event.key === "ArrowRight") adjust(`${prefix}positionX`, step, -100, 100);
        else if (event.key === "ArrowUp") adjust(`${prefix}positionY`, -step, -100, 100);
        else if (event.key === "ArrowDown") adjust(`${prefix}positionY`, step, -100, 100);
        else if (event.key === "+" || event.key === "=") adjust(`${prefix}scale`, event.shiftKey ? 0.2 : 0.05, 0.25, 3);
        else if (event.key === "-" || event.key === "_") adjust(`${prefix}scale`, event.shiftKey ? -0.2 : -0.05, 0.25, 3);
      } else if (selection.kind === "greeting") {
        const prefix = greetingStagePrefix();
        const ratioStep = step / 100;
        if (handleKind === "scale" && scaleDirection) {
          adjust(`${prefix}fontSize`, scaleDirection * step, 24, 72);
        } else if (handleKind === "move") {
          const horizontal = handle.dataset.side === "e" || handle.dataset.side === "w";
          if (horizontal && event.key === "ArrowLeft") adjust(`${prefix}xRatio`, -ratioStep, -0.45, 0.45);
          else if (horizontal && event.key === "ArrowRight") adjust(`${prefix}xRatio`, ratioStep, -0.45, 0.45);
          else if (!horizontal && event.key === "ArrowUp") adjust(`${prefix}yRatio`, -ratioStep, -0.4, 0.45);
          else if (!horizontal && event.key === "ArrowDown") adjust(`${prefix}yRatio`, ratioStep, -0.4, 0.45);
        } else if (event.key === "ArrowLeft") adjust(`${prefix}xRatio`, -ratioStep, -0.45, 0.45);
        else if (event.key === "ArrowRight") adjust(`${prefix}xRatio`, ratioStep, -0.45, 0.45);
        else if (event.key === "ArrowUp") adjust(`${prefix}yRatio`, -ratioStep, -0.4, 0.45);
        else if (event.key === "ArrowDown") adjust(`${prefix}yRatio`, ratioStep, -0.4, 0.45);
        else if (event.key === "+" || event.key === "=") adjust(`${prefix}fontSize`, step, 24, 72);
        else if (event.key === "-" || event.key === "_") adjust(`${prefix}fontSize`, -step, 24, 72);
        else if (event.key === "[") adjust(`${prefix}maxWidthRatio`, -0.02, 0.35, 0.9);
        else if (event.key === "]") adjust(`${prefix}maxWidthRatio`, 0.02, 0.35, 0.9);
      } else {
        seedNativePromptOverrides();
        const ratioStep = step / 100;
        if (handleKind === "scale" && scaleDirection) {
          adjust("shared.prompt.width", scaleDirection * ratioStep, 0.4, 0.96);
        } else if (handleKind === "move") {
          const horizontal = handle.dataset.side === "e" || handle.dataset.side === "w";
          if (horizontal && event.key === "ArrowLeft") adjust("shared.prompt.x", -ratioStep, -0.35, 0.35);
          else if (horizontal && event.key === "ArrowRight") adjust("shared.prompt.x", ratioStep, -0.35, 0.35);
          else if (!horizontal && event.key === "ArrowUp") adjust("shared.prompt.y", -ratioStep, -0.3, 0.3);
          else if (!horizontal && event.key === "ArrowDown") adjust("shared.prompt.y", ratioStep, -0.3, 0.3);
        } else if (event.key === "ArrowLeft") adjust("shared.prompt.x", -ratioStep, -0.35, 0.35);
        else if (event.key === "ArrowRight") adjust("shared.prompt.x", ratioStep, -0.35, 0.35);
        else if (event.key === "ArrowUp") adjust("shared.prompt.y", -ratioStep, -0.3, 0.3);
        else if (event.key === "ArrowDown") adjust("shared.prompt.y", ratioStep, -0.3, 0.3);
        else if (event.key === "[") adjust("shared.prompt.width", -0.02, 0.4, 0.96);
        else if (event.key === "]") adjust("shared.prompt.width", 0.02, 0.4, 0.96);
      }
      if (!changed) return;
      event.preventDefault();
      stageSelection = selection;
      if (selection.kind === "layer") {
        const index = layerIndexForId(selection.id);
        if (index >= 0) {
          inspectorField = `layers[${index}].frames.${stageViewport}.${handleKind === "scale" ? "scale" : "positionX"}`;
        }
      } else if (selection.kind === "prompt") {
        inspectorField = "shared.prompt";
      } else {
        inspectorField = `${greetingStagePrefix()}xRatio`;
      }
      applyStageLayout();
      reflectStageInputs(stageItemPaths(selection));
      if (stageKeyTimer) clearTimeout(stageKeyTimer);
      const paths = stageItemPaths(selection);
      for (const path of paths) stageKeyPaths.add(path);
      stageKeyTimer = setTimeout(flushStageKeyChanges, 220);
      reflectButtonStates();
      refreshInspectorContext();
    });

    const previewWidthInput = document.getElementById("stage-real-width");
    const previewHeightInput = document.getElementById("stage-real-height");
    const setPreviewInputValues = (width, height) => {
      if (previewWidthInput) previewWidthInput.value = String(width);
      if (previewHeightInput) previewHeightInput.value = String(height);
    };
    const reflectStageViewport = () => {
      for (const input of stageViewportInputs) input.checked = input.value === stageViewport;
    };
    const readPreviewInputSize = ({ clamp = false } = {}) => {
      let width = Math.round(Number(previewWidthInput?.value));
      let height = Math.round(Number(previewHeightInput?.value));
      if (clamp) {
        width = Math.round(clampNumber(width || 1180, 920, 3840));
        height = Math.round(clampNumber(height || 640, 620, 2400));
      }
      return integer(width, 920, 3840) && integer(height, 620, 2400) ? [width, height] : null;
    };
    const updatePreviewDraft = (dimensions) => {
      if (!dimensions) return false;
      previewSizeIntent = [...dimensions];
      stagePreviewSize = dimensions;
      stageViewport = dimensions[0] >= 1440 ? "wide" : "normal";
      reflectStageViewport();
      refreshInspectorContext();
      selectStageMirror();
      renderStage();
      return true;
    };
    const commitPreviewSize = ({ clamp = false, notify = false } = {}) => {
      if (previewResizeTimer) { clearTimeout(previewResizeTimer); previewResizeTimer = null; }
      const dimensions = readPreviewInputSize({ clamp });
      if (!dimensions) return false;
      setPreviewInputValues(...dimensions);
      updatePreviewDraft(dimensions);
      if (!sendPreviewSize(`${dimensions[0]}x${dimensions[1]}`, dimensions)) return false;
      if (notify) announce(tr("stageRealShown"));
      return true;
    };
    const schedulePreviewSize = () => {
      if (previewResizeTimer) {
        clearTimeout(previewResizeTimer);
        previewResizeTimer = null;
      }
      const dimensions = readPreviewInputSize();
      if (!dimensions) {
        previewSizeIntent = null;
        previewExpectedRequest = null;
        return;
      }
      updatePreviewDraft(dimensions);
      previewResizeTimer = setTimeout(() => {
        previewResizeTimer = null;
        commitPreviewSize();
      }, 160);
    };
    const sendPreviewSize = (size, dimensions = null) => {
      const request = previewRequestSerial + 1;
      previewRequestSerial = request;
      previewExpectedRequest = request;
      previewSizeEditing = true;
      previewSizeIntent = dimensions ? [...dimensions] : null;
      if (send({ type: "set-aura-preview", size, request })) return true;
      previewExpectedRequest = null;
      return false;
    };

    stageViewportInputs.forEach((input) => input.addEventListener("change", () => {
      if (!input.checked) return;
      stageViewport = input.value;
      stagePreviewSize = [...STAGE_SIZES[stageViewport]];
      setPreviewInputValues(...stagePreviewSize);
      // Viewport controls resize Aura without foregrounding it; the next
      // private capture becomes the stage backdrop while Studio stays usable.
      sendPreviewSize(input.value === "wide" ? "wide" : "launch", stagePreviewSize);
      refreshInspectorContext();
      selectStageMirror();
      reflectGreeting();
      renderStage();
    }));
    stageContextInputs.forEach((input) => input.addEventListener("change", () => {
      if (!input.checked) return;
      stageContextTouched = true;
      stageContext = input.value;
      selectStageMirror();
      renderStage();
      announce(format(tr("stageContextSelected"), stageContextLabel()));
    }));
    const switchToNewChatPreview = () => {
      stageContextTouched = true;
      stageContext = "new-chat";
      for (const input of stageContextInputs) input.checked = input.value === stageContext;
      selectStageMirror();
      renderStage();
      announce(format(tr("stageContextSelected"), stageContextLabel()));
    };
    switchSupportedPreviewButton?.addEventListener("click", switchToNewChatPreview);
    greetingSwitchPreviewButton?.addEventListener("click", switchToNewChatPreview);
    stageZonesInput?.addEventListener("change", () => {
      stageRoot.dataset.zones = String(stageZonesInput.checked);
    });
    backdropToggleInput?.addEventListener("change", () => {
      if (backdropToggleInput.checked && hasUsableMirrorGeometry(stageLiveMirror)) {
        stageViewport = stageLiveMirror.geometry.viewport;
        reflectStageViewport();
        refreshInspectorContext();
      }
      selectStageMirror();
      renderStage();
    });
    const levelInputs = [...document.querySelectorAll('input[name="editor-level"]')];
    levelInputs.forEach((input) => input.addEventListener("change", () => {
      if (!input.checked) return;
      editor.dataset.level = input.value;
      if (input.value === "simple") {
        for (const details of tokenGroups.querySelectorAll(".quick-essential")) details.open = true;
      }
      setInspectorTarget(inspectorTarget);
      renderStage();
    }));
    for (const [id, size] of [["stage-real-full", "full"]]) {
      document.getElementById(id)?.addEventListener("click", () => {
        if (!sendPreviewSize(size)) return;
        stageViewport = "wide";
        reflectStageViewport();
        refreshInspectorContext();
        renderStage();
        announce(tr("stageRealShown"));
      });
    }
    // Real-window mirror: scaled captures of the actual Aura WebView pushed
    // by the host. True proportions at any window size, never written to disk.
    const mirrorCaption = document.getElementById("stage-mirror-caption");
    const MIRROR_PREFIX = "data:image/jpeg;base64,";
    const MIRROR_MAX_RAW_BYTES = 8_000_000;
    const MIRROR_MAX_BASE64_LENGTH = Math.ceil(MIRROR_MAX_RAW_BYTES / 3) * 4;
    const normalizeMirrorRect = (value) => {
      if (value === null || value === undefined) return null;
      if (!exactShape(value, ["left", "top", "width", "height"])) return undefined;
      for (const key of ["left", "top", "width", "height"]) {
        if (!inRange(value[key], -10000, 10000)) return undefined;
      }
      return { ...value };
    };
    const normalizeMirror = (value) => {
      if (!exactShape(value, ["type", "image", "width", "height", "revision", "request"], ["geometry"])
          || value.type !== "aura-mirror" || !integer(value.revision, 0, Number.MAX_SAFE_INTEGER)
          || !integer(value.request, 0, 2_147_483_647)) return null;
      if (typeof value.image !== "string" || !value.image.startsWith(MIRROR_PREFIX)
          || value.image.length > MIRROR_PREFIX.length + MIRROR_MAX_BASE64_LENGTH) return null;
      const encoded = value.image.slice(MIRROR_PREFIX.length);
      if (encoded.length > MIRROR_MAX_BASE64_LENGTH || encoded.length % 4 !== 0
          || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) return null;
      const padding = encoded.endsWith("==") ? 2 : encoded.endsWith("=") ? 1 : 0;
      if ((encoded.length / 4 * 3) - padding > MIRROR_MAX_RAW_BYTES) return null;
      if (!integer(value.width, 200, 6000) || !integer(value.height, 200, 6000)) return null;
      let geometry = null;
      if (value.geometry !== undefined && value.geometry !== null) {
        if (!exactShape(value.geometry, ["context", "mode", "viewport", "main", "prompt", "greeting"])
            || !enumValue(value.geometry.context, ["new-chat", "conversation", "other"])
            || !enumValue(value.geometry.mode, ["light", "dark"])
            || !enumValue(value.geometry.viewport, ["normal", "wide"])) return null;
        const main = normalizeMirrorRect(value.geometry.main);
        const prompt = normalizeMirrorRect(value.geometry.prompt);
        const rawGreeting = value.geometry.greeting;
        if (!exactShape(rawGreeting, ["status", "source", "rect"])
            || !enumValue(rawGreeting.status, ["found", "missing", "ambiguous", "inactive"])
            || !enumValue(rawGreeting.source, ["native", "custom", "none"])) return null;
        const greetingRect = normalizeMirrorRect(rawGreeting.rect);
        if (main === undefined || prompt === undefined || greetingRect === undefined
            || (rawGreeting.status === "found") !== Boolean(greetingRect)) return null;
        geometry = {
          context: value.geometry.context, mode: value.geometry.mode,
          viewport: value.geometry.viewport, main, prompt,
          greeting: {
            status: rawGreeting.status,
            source: rawGreeting.source,
            rect: greetingRect,
          },
        };
      }
      return {
        image: value.image, width: value.width, height: value.height,
        revision: value.revision, request: value.request, geometry,
      };
    };
    const mirrorBasis = (revision, mode, viewport, width, height) => (
      `${revision}|${mode}|${viewport}|${width}x${height}`
    );
    const rememberStageMirror = (mirror) => {
      const { geometry } = mirror;
      if (mirror.revision !== state?.revision || !hasUsableMirrorGeometry(mirror)) return;
      const basis = mirrorBasis(
        mirror.revision, geometry.mode, geometry.viewport, mirror.width, mirror.height,
      );
      if (stageMirrorCacheBasis !== basis) {
        stageMirrorCache.clear();
        stageMirrorCacheBasis = basis;
      }
      // One exact-size, exact-appearance capture per page context. The cache
      // is bounded to two in-memory JPEGs and is cleared when editing closes.
      stageMirrorCache.set(geometry.context, mirror);
    };
    const updateMirrorCaption = () => {
      if (!mirrorCaption) return;
      if (!stageMirror) {
        mirrorCaption.textContent = stageLiveMirror
          ? format(tr("mirrorUnavailable"), stageContextLabel())
          : tr("mirrorEmpty");
        return;
      }
      const key = stageMirror === stageLiveMirror ? "mirrorCaption" : "mirrorCaptionCached";
      mirrorCaption.textContent = format(
        tr(key), stageMirror.width, stageMirror.height, stageContextLabel(stageMirror.geometry?.context),
      );
    };
    const selectStageMirror = () => {
      if (!hasUsableMirrorGeometry(stageLiveMirror)) {
        stageMirror = null;
        updateMirrorCaption();
        return;
      }
      const basis = mirrorBasis(
        state?.revision ?? -1, selectedMode, stageViewport, stagePreviewSize[0], stagePreviewSize[1],
      );
      stageMirror = basis === stageMirrorCacheBasis
        ? stageMirrorCache.get(stageContext) ?? null
        : null;
      updateMirrorCaption();
    };
    const receiveMirror = (raw) => {
      const mirror = normalizeMirror(raw);
      if (!mirror || mirror.revision !== state?.revision) return false;
      if (previewExpectedRequest !== null && mirror.request !== previewExpectedRequest) return false;
      if (previewSizeEditing) {
        if (previewExpectedRequest === null && !previewSizeIntent) return false;
        if (previewSizeIntent
            && (mirror.width !== previewSizeIntent[0] || mirror.height !== previewSizeIntent[1])) return false;
        previewSizeEditing = false;
        previewSizeIntent = null;
        previewExpectedRequest = null;
      }
      const previousContext = stageLiveMirror?.geometry?.context;
      const previousMode = stageLiveMirror?.geometry?.mode;
      const first = !stageLiveMirror;
      stageLiveMirror = mirror;
      rememberStageMirror(mirror);
      stagePreviewSize = [mirror.width, mirror.height];
      setPreviewInputValues(mirror.width, mirror.height);
      if (backdropToggleInput?.checked) {
        // The framing set being edited follows the real window's dimensions,
        // while an explicit page selection stays pinned. Captures from both
        // contexts remain switchable without repeatedly foregrounding Aura.
        if (!hasUsableMirrorGeometry(mirror)) {
          stageMirror = null;
          updateMirrorCaption();
          renderStage();
          return true;
        }
        stageViewport = mirror.geometry.viewport;
        reflectStageViewport();
        reflectGreeting();
        const realContext = mirror.geometry?.context;
        if ((realContext === "new-chat" || realContext === "conversation")
            && !stageContextTouched && (first || realContext !== previousContext)) {
          stageContext = realContext;
        }
        const realMode = mirror.geometry?.mode;
        if (realMode && !appearanceTouched && realMode !== selectedMode
            && (first || realMode !== previousMode)) {
          selectedMode = realMode;
          for (const input of modeInputs) input.checked = input.value === selectedMode;
          reflectTokens();
          reflectGreeting();
        }
        selectStageMirror();
        if (first && stageMirror) announce(tr("stageBackdropReady"));
        renderStage();
        if (stageDrag && stageBackdropOn()) {
          stageBackdropImg.src = mirror.image;
          stageBackdropImg.hidden = false;
        }
      }
      return true;
    };
    document.getElementById("stage-mirror-refresh")?.addEventListener("click", () => {
      if (mirrorCaption) mirrorCaption.textContent = tr("mirrorEmpty");
      send({ type: "refresh-aura-mirror" });
    });
    document.getElementById("stage-open-aura")?.addEventListener("click", () => {
      send({ type: "open-aura" });
    });
    topmostButton?.addEventListener("click", () => {
      if (!send({ type: "set-aura-topmost", enabled: !topmostEnabled })) return;
      topmostEnabled = !topmostEnabled;
      topmostButton.setAttribute("aria-pressed", String(topmostEnabled));
      announce(tr(topmostEnabled ? "topmostOn" : "topmostOff"));
    });
    for (const input of [previewWidthInput, previewHeightInput]) {
      input?.addEventListener("input", () => {
        previewSizeEditing = true;
        schedulePreviewSize();
      });
      input?.addEventListener("change", () => commitPreviewSize({ clamp: true }));
    }
    // State matrix: light/dark × new-chat/conversation at a glance. The four
    // cells and their layer images are built once and reconciled on every
    // render so a redraw never re-decodes artwork or rebinds click handlers.
    const matrixHost = document.getElementById("stage-matrix");
    const matrixCells = [];

    const buildMatrixCells = () => {
      matrixHost.replaceChildren();
      matrixCells.length = 0;
      for (const mode of ["light", "dark"]) {
        for (const context of ["new-chat", "conversation"]) {
          const cell = document.createElement("button");
          cell.type = "button";
          cell.className = "stage-matrix-cell";
          const frame = document.createElement("span");
          frame.className = "stage-matrix-frame";
          const canvas = document.createElement("span");
          canvas.className = "stage-matrix-canvas";
          const art = document.createElement("span");
          art.className = "stage-art";
          const sidebar = document.createElement("span");
          sidebar.className = "stage-matrix-sidebar";
          const block = document.createElement("span");
          block.className = "stage-matrix-block";
          canvas.append(art, sidebar, block);
          frame.appendChild(canvas);
          const caption = document.createElement("small");
          cell.append(frame, caption);
          cell.addEventListener("click", () => {
            if (selectedMode !== mode) {
              appearanceTouched = true;
              send({ type: "set-appearance", appearance: mode });
            }
            selectedMode = mode;
            stageContextTouched = true;
            stageContext = context;
            for (const input of modeInputs) input.checked = input.value === selectedMode;
            selectStageMirror();
            reflectTokens();
            renderStage();
          });
          matrixHost.appendChild(cell);
          matrixCells.push({ mode, context, cell, frame, canvas, art, sidebar, block, caption, layers: new Map() });
        }
      }
    };

    const reconcileMatrixLayers = (entry) => {
      const seen = new Set();
      let previous = null;
      for (const layer of state.layers) {
        if (layer.visible === false || !layer.previewUrl) continue;
        if (layer.appearance !== "all" && layer.appearance !== entry.mode) continue;
        if (layer.context !== "all" && layer.context !== entry.context) continue;
        if (layer.viewport !== "all" && layer.viewport !== stageViewport) continue;
        seen.add(layer.index);
        let node = entry.layers.get(layer.index);
        if (node && node.previewUrl !== layer.previewUrl) {
          node.holder.remove();
          entry.layers.delete(layer.index);
          node = null;
        }
        if (!node) {
          const holder = document.createElement("span");
          holder.className = "stage-layer";
          const image = document.createElement("img");
          image.src = layer.previewUrl;
          image.alt = "";
          image.setAttribute("draggable", "false");
          holder.appendChild(image);
          node = { holder, image, previewUrl: layer.previewUrl };
          entry.layers.set(layer.index, node);
        }
        node.holder.dataset.mask = layer.mask;
        node.holder.style.opacity = String(layer.opacity);
        const frameValues = layer.frames[stageViewport];
        const anchor = ANCHOR_POINTS[frameValues.anchor] ?? ANCHOR_POINTS.center;
        node.image.style.left = `calc(${anchor[0]}% + ${frameValues.positionX}%)`;
        node.image.style.top = `calc(${anchor[1]}% + ${frameValues.positionY}%)`;
        node.image.style.transform = `translate(${-frameValues.focalX}%, ${-frameValues.focalY}%) scale(${frameValues.scale})`;
        node.image.style.transformOrigin = `${frameValues.focalX}% ${frameValues.focalY}%`;
        if (previous) previous.after(node.holder);
        else entry.art.prepend(node.holder);
        previous = node.holder;
      }
      for (const [index, node] of [...entry.layers]) {
        if (!seen.has(index)) {
          node.holder.remove();
          entry.layers.delete(index);
        }
      }
    };

    const renderStageMatrix = () => {
      if (!matrixHost) return;
      if (!state) {
        if (matrixCells.length) {
          matrixHost.replaceChildren();
          matrixCells.length = 0;
        }
        return;
      }
      if (!matrixCells.length) buildMatrixCells();
      const [logicalWidth, logicalHeight] = STAGE_SIZES[stageViewport];
      const hostWidth = matrixHost.clientWidth;
      const cellWidth = hostWidth > 40 ? Math.max(60, (hostWidth - 30) / 4) : 132;
      const cellScale = cellWidth / logicalWidth;
      const frameHeight = `${Math.round(logicalHeight * cellScale)}px`;
      const scope = state.shared.backgroundScope;
      const artLeft = scope === "content" ? `${STAGE_SIDEBAR_WIDTH}px` : "0";
      const mainWidth = logicalWidth - STAGE_SIDEBAR_WIDTH;
      for (const entry of matrixCells) {
        const { mode, context, cell } = entry;
        const tokens = state.tokens[mode];
        cell.dataset.active = String(mode === selectedMode && context === stageContext);
        const modeLabel = tr(mode === "light" ? "lightMode" : "darkMode");
        const contextLabel = tr(context === "new-chat" ? "stageNewChat" : "stageConversation");
        cell.setAttribute("aria-label", `${modeLabel} · ${contextLabel}`);
        entry.caption.textContent = `${modeLabel} · ${contextLabel}`;
        entry.frame.style.width = `${cellWidth}px`;
        entry.frame.style.height = frameHeight;
        entry.canvas.style.width = `${logicalWidth}px`;
        entry.canvas.style.height = `${logicalHeight}px`;
        entry.canvas.style.transform = `scale(${cellScale})`;
        entry.canvas.style.background = tokens.canvas;
        entry.art.style.left = artLeft;
        reconcileMatrixLayers(entry);
        entry.sidebar.style.width = `${STAGE_SIDEBAR_WIDTH}px`;
        entry.sidebar.style.background = scope === "full-window"
          ? `color-mix(in srgb, ${tokens.sidebar} ${Math.round(tokens.sidebarAlpha * 100)}%, transparent)`
          : tokens.sidebar;
        const block = entry.block;
        block.style.background = `color-mix(in srgb, ${tokens.surface} ${Math.round(tokens.surfaceAlpha * 100)}%, transparent)`;
        block.style.border = `1px solid ${tokens.border}`;
        block.style.borderRadius = `${state.shared.radius}px`;
        if (context === "new-chat") {
          const rect = promptRect(logicalWidth, logicalHeight,
            state.shared.prompt.width, state.shared.prompt.x, state.shared.prompt.y);
          block.style.left = `${rect.left}px`;
          block.style.top = `${rect.top}px`;
          block.style.width = `${rect.width}px`;
          block.style.height = `${rect.height}px`;
        } else {
          block.style.left = `${STAGE_SIDEBAR_WIDTH + (mainWidth * 0.14)}px`;
          block.style.top = `${logicalHeight - 134}px`;
          block.style.width = `${mainWidth * 0.72}px`;
          block.style.height = "110px";
        }
      }
    };

    // Layer cards flag artwork that the current stage view hides.
    const updateLayerGateBadges = () => {
      if (!state) return;
      for (const layer of state.layers) {
        const gated = !stageLayerGate(layer);
        const card = layerList.querySelector(`[data-layer-id="${CSS.escape(layer.id)}"]`);
        const badge = layerList.querySelector(`[data-layer-badge="${layer.index}"]`);
        if (card) {
          card.dataset.gated = String(gated);
          for (const control of card.querySelectorAll(".layer-preset, [data-layer-state-edit]")) {
            control.disabled = gated;
            if (control.classList.contains("layer-preset")) control.dataset.gated = String(gated);
          }
        }
        if (!badge) continue;
        const reasons = [];
        if (layer.appearance !== "all" && layer.appearance !== selectedMode) {
          reasons.push(tr(layer.appearance === "light" ? "appearanceLight" : "appearanceDark"));
        }
        if (layer.context !== "all" && layer.context !== stageContext) {
          reasons.push(tr(layer.context === "new-chat" ? "contextNewChat" : "contextConversation"));
        }
        if (layer.viewport !== "all" && layer.viewport !== stageViewport) {
          reasons.push(tr(layer.viewport === "normal" ? "viewportNormal" : "viewportWide"));
        }
        badge.hidden = !reasons.length;
        if (reasons.length) badge.textContent = format(tr("hiddenInStageView"), reasons.join(" · "));
      }
    };

    const copyLayerFraming = (index, source, target) => {
      const frame = state?.layers?.[index]?.frames?.[source];
      if (!frame) return;
      queueStageMutations(["anchor", "focalX", "focalY", "positionX", "positionY", "scale"].map((property) => (
        { type: "set-theme-layer", index, preset: target, property, value: frame[property] }
      )));
      announce(format(tr("framingCopied"), tr(target === "wide" ? "stageWide" : "stageNormal")));
    };
    if (typeof ResizeObserver === "function") {
      const stageLayoutObserver = new ResizeObserver(() => applyStageLayout());
      stageLayoutObserver.observe(stageRoot);
      if (stageColumn) stageLayoutObserver.observe(stageColumn);
    } else {
      window.addEventListener("resize", applyStageLayout, { passive: true });
    }
    // ── End live framing stage ─────────────────────────────────────────

    const buildTokenControls = () => {
      for (const group of TOKEN_GROUPS) {
        const details = document.createElement("details");
        const quickEssential = ["groupCanvas", "groupSurface", "groupText", "groupAccent"].includes(group.label);
        details.className = `token-group${quickEssential ? " quick-essential" : " advanced-only"}`;
        if (["groupCanvas", "groupSurface", "groupText", "groupAccent"].includes(group.label)) details.open = true;
        const groupSummary = document.createElement("summary");
        groupSummary.textContent = tr(group.label);
        const fields = document.createElement("div");
        fields.className = "token-group-fields";
        for (const [token, labelKey] of group.fields) {
          if (COLOR_TOKEN_KEYS.has(token)) {
            const row = document.createElement("label");
            row.className = "color-field";
            const label = document.createElement("span");
            label.textContent = tr(labelKey);
            const chip = document.createElement("span");
            chip.className = "contrast-chip";
            chip.dataset.contrastChip = token;
            chip.hidden = true;
            label.appendChild(chip);
            const picker = document.createElement("input");
            picker.type = "color";
            picker.dataset.editorToken = token;
            picker.dataset.editorFocus = `token-${token}-picker`;
            picker.setAttribute("aria-label", tr(labelKey));
            const text = document.createElement("input");
            text.type = "text";
            text.maxLength = 7;
            text.inputMode = "text";
            text.spellcheck = false;
            text.dataset.editorTokenText = token;
            text.dataset.editorFocus = `token-${token}-text`;
            text.setAttribute("aria-label", `${tr(labelKey)} HEX`);
            picker.addEventListener("input", () => {
              text.value = picker.value.toUpperCase();
              text.removeAttribute("aria-invalid");
              setStageOverride(picker.dataset.editorField, picker.value.toUpperCase());
              applyStageLayout();
            });
            picker.addEventListener("change", () => queueTokenChange(selectedMode, token, picker.value.toUpperCase()));
            text.addEventListener("change", () => {
              const value = text.value.trim().toUpperCase();
              if (!COLOR_PATTERN.test(value)) {
                text.setAttribute("aria-invalid", "true");
                announce(tr("editorActionFailed"), "error");
                return;
              }
              text.removeAttribute("aria-invalid");
              picker.value = value;
              setStageOverride(text.dataset.editorField, value);
              applyStageLayout();
              queueTokenChange(selectedMode, token, value);
            });
            row.append(label, picker, text);
            fields.appendChild(row);
          } else {
            const row = document.createElement("label");
            row.className = "alpha-field";
            const label = document.createElement("span");
            label.textContent = tr(labelKey);
            const range = document.createElement("input");
            range.type = "range";
            range.min = token === "surfaceAlpha" ? "35" : "62";
            range.max = "100";
            range.step = "1";
            range.dataset.editorToken = token;
            range.dataset.editorFocus = `token-${token}`;
            const output = document.createElement("output");
            output.htmlFor = range.id;
            range.addEventListener("input", () => {
              output.value = `${range.value}%`;
              setStageOverride(range.dataset.editorField, Number(range.value) / 100);
              applyStageLayout();
            });
            range.addEventListener("change", () => queueTokenChange(selectedMode, token, Number(range.value) / 100));
            row.append(label, range, output);
            fields.appendChild(row);
          }
        }
        details.append(groupSummary, fields);
        tokenGroups.appendChild(details);
      }
    };

    const reflectTokens = () => {
      if (!state) return;
      const mode = state.tokens[selectedMode];
      for (const input of tokenGroups.querySelectorAll("[data-editor-token]")) {
        const token = input.dataset.editorToken;
        input.dataset.editorField = `tokens.${selectedMode}.${token}`;
        const value = stageValue(input.dataset.editorField) ?? mode[token];
        if (input.type === "color") {
          input.value = value;
          const text = tokenGroups.querySelector(`[data-editor-token-text="${token}"]`);
          if (text) {
            text.value = value;
            text.dataset.editorField = `tokens.${selectedMode}.${token}`;
          }
        } else {
          input.value = String(Math.round(value * 100));
          input.nextElementSibling.value = `${Math.round(value * 100)}%`;
        }
      }
      const checks = state.feedback.contrast[selectedMode] ?? [];
      for (const chip of tokenGroups.querySelectorAll("[data-contrast-chip]")) {
        const related = checks.filter((check) => (CONTRAST_TOKEN_MAP[chip.dataset.contrastChip] ?? []).includes(check.id));
        if (!related.length) {
          chip.hidden = true;
          continue;
        }
        const pass = related.every((check) => check.pass);
        const worst = related.reduce((left, right) => (left.ratio / left.minimum) <= (right.ratio / right.minimum) ? left : right);
        chip.textContent = `${worst.ratio.toFixed(1)}:1`;
        chip.dataset.pass = String(pass);
        chip.setAttribute("aria-label",
          `${tr(CONTRAST_LABEL_KEYS[worst.id])} ${worst.ratio.toFixed(2)} / ${worst.minimum.toFixed(2)} · ${tr(pass ? "checkPass" : "checkFail")}`);
        chip.title = tr(pass ? "checkPass" : "checkFail");
        chip.hidden = false;
      }
    };

    const reflectShared = () => {
      if (!state) return;
      const values = state.shared;
      for (const input of sharedInputs) {
        const key = input.dataset.editorShared;
        const path = `shared.${key}`;
        const value = stageValue(path) ?? values[key];
        if (input.tagName === "SELECT" && ["fontUi", "fontDisplay", "shadow"].includes(key)) {
          setInheritedSelectPresentation(input, values.inherited[key] && !stageOverrides.has(path), value);
        } else {
          input.value = String(value);
        }
      }
      const radius = Number(stageValue("shared.radius") ?? values.radius);
      const blur = Number(stageValue("shared.blur") ?? values.blur);
      const backgroundScope = stageValue("shared.backgroundScope") ?? values.backgroundScope;
      setInheritedRadiusPresentation(values.inherited.radius && !stageOverrides.has("shared.radius"));
      document.getElementById("editor-radius-output").value = `${Math.round(radius)} px`;
      document.getElementById("editor-blur-output").value = `${Math.round(blur)} px`;
      for (const input of scopeInputs) input.checked = input.value === backgroundScope;
      document.getElementById("background-scope-help").textContent = tr(
        backgroundScope === "full-window" ? "fullScopeHelp" : "contentScopeHelp");
      document.querySelector(".asset-guide-frame").dataset.scope = backgroundScope;
      for (const input of promptInputs) {
        const key = input.dataset.editorPrompt;
        const value = Number(stageValue(`shared.prompt.${key}`) ?? values.prompt[key]);
        input.value = String(Math.round(value * 100));
        const exact = document.getElementById(`${input.id}-exact`);
        if (exact) exact.value = input.value;
        const output = document.getElementById(`${input.id}-output`);
        if (output) output.value = `${Math.round(value * 100)}%`;
      }
      if (nativePromptNote) {
        nativePromptNote.hidden = !values.prompt.native
          || STAGE_PROMPT_PATHS.some((path) => stageOverrides.has(path));
      }
    };

    const greetingOutputText = (field, value) => {
      if (field === "fontSize") return `${Math.round(value)} px`;
      if (field === "lineHeight") return value.toFixed(2);
      if (field === "letterSpacing") return `${value.toFixed(3)} em`;
      if (field === "markScale") return `${Math.round(value * 100)}%`;
      return `${Math.round(value * 100)}%`;
    };

    const greetingDraft = () => greetingPreferenceDraft ?? state?.greetingPreferences ?? null;
    const greetingThemeOverride = (personal = greetingDraft()) => (
      personal?.themeOverrides?.[state?.id] ?? { mode: "global", phrases: [] }
    );
    const greetingSampleText = () => {
      const personal = greetingDraft();
      if (!personal?.enabled || personal.source !== "custom") return tr("greetingPreviewSample");
      const override = greetingThemeOverride(personal);
      if (override.mode === "claude") return tr("greetingPreviewSample");
      const phrases = override.mode === "custom" ? override.phrases : personal.globalPhrases;
      const usable = phrases.filter(
        (phrase) => personal.displayName || !/\{name\}/u.test(phrase),
      );
      if (!usable.length) return tr("greetingPreviewSample");
      return usable[0].replace(/\{name\}/gu, personal.displayName);
    };

    const reflectGreetingPreview = (greeting, native = state?.shared?.greeting?.native) => {
      if (!greetingSample) return;
      greetingSample.textContent = greetingSampleText();
      const style = greetingSample.style;
      style.fontFamily = GREETING_FONT_STACKS[greeting.font] ?? GREETING_FONT_STACKS["system-sans"];
      style.fontSize = `${greeting.fontSize}px`;
      style.fontWeight = String(greeting.weight);
      style.fontStyle = greeting.italic ? "italic" : "normal";
      style.letterSpacing = `${greeting.letterSpacing}em`;
      style.lineHeight = String(greeting.lineHeight);
      style.textAlign = greeting.align;
      style.maxWidth = `${Math.round(greeting.maxWidthRatio * 100)}%`;
      style.color = greeting.color === "accent" ? "var(--accent)" : "var(--ink)";
      style.textDecoration = greeting.decoration === "underline" ? "underline" : "none";
      style.borderBottom = greeting.decoration === "hairline" ? "1px solid currentColor" : "none";
      style.textShadow = greeting.decoration === "glow"
        ? "0 0 18px color-mix(in srgb, var(--accent) 35%, transparent)"
        : "none";
      style.marginInline = greeting.align === "center" ? "auto"
        : greeting.align === "end" ? "auto 0" : "0 auto";
      style.opacity = native ? "0.45" : "1";
      // The HTML carries fallback text for no-script diagnostics. Do not paint
      // it until every greeting declaration above has landed in the same turn.
      greetingSample.dataset.greetingPreviewReady = "true";
    };

    const reflectGreeting = () => {
      if (!state) return;
      const greetingState = state.shared.greeting;
      const greeting = activeGreetingFrame();
      if (!greeting) return;
      if (greetingEnableInput) greetingEnableInput.checked = !greetingState.native;
      if (greetingNativeNote) greetingNativeNote.hidden = !greetingState.native;
      if (greetingCollisionWarning) {
        greetingCollisionWarning.hidden = greetingState.native
          || (!state.isNew && state.source !== "user")
          || state.layers.length === 0;
      }
      const compactOption = greetingMarkInput?.querySelector('option[value="compact"]');
      if (compactOption) {
        compactOption.disabled = !greetingState.compactMarkAvailable;
        compactOption.hidden = !greetingState.compactMarkAvailable;
      }
      reflectGreetingPreview(greeting, greetingState.native);
      const personal = greetingDraft();
      if (!personal) return;
      if (greetingPersonalEnableInput) greetingPersonalEnableInput.checked = personal.enabled;
      const personalSource = personal.source;
      for (const input of greetingSourceInputs) input.checked = input.value === personalSource;
      for (const input of greetingSourceInputs) input.disabled = !personal.enabled;
      const custom = personal.enabled && personalSource === "custom";
      const override = greetingThemeOverride(personal);
      if (greetingNameInput && !greetingPreferenceInputDirty
          && document.activeElement !== greetingNameInput) {
        greetingNameInput.value = personal.displayName;
      }
      if (greetingPhrasesInput && !greetingPreferenceInputDirty
          && document.activeElement !== greetingPhrasesInput) {
        greetingPhrasesInput.value = personal.globalPhrases.join("\n");
      }
      if (greetingOverrideInput) greetingOverrideInput.value = override.mode;
      if (greetingOverridePhrasesInput && !greetingPreferenceInputDirty
          && document.activeElement !== greetingOverridePhrasesInput) {
        greetingOverridePhrasesInput.value = override.phrases.join("\n");
      }
      if (greetingNameInput) greetingNameInput.disabled = !custom;
      if (greetingPhrasesInput) greetingPhrasesInput.disabled = !custom;
      if (greetingOverrideInput) greetingOverrideInput.disabled = !custom;
      if (greetingOverridePhrasesField) greetingOverridePhrasesField.hidden = override.mode !== "custom";
      if (greetingOverridePhrasesInput) {
        greetingOverridePhrasesInput.disabled = !custom || override.mode !== "custom";
      }
      for (const input of greetingInputs) {
        const field = input.dataset.editorGreeting;
        input.dataset.editorField = `${greetingStagePrefix()}${field}`;
        input.disabled = greetingState.native;
        if (input.type === "checkbox") {
          input.checked = Boolean(greeting[field]);
        } else if (input.type === "range") {
          input.value = String(greeting[field]);
          const exact = greetingExactInputs.find((candidate) =>
            candidate.dataset.editorGreetingExact === field);
          if (exact && document.activeElement !== exact) {
            exact.value = input.value;
            exact.dataset.editorField = input.dataset.editorField;
          }
          const output = document.getElementById(`${input.id}-output`);
          if (output) output.value = greetingOutputText(field, greeting[field]);
        } else {
          input.value = String(greeting[field]);
        }
      }
      for (const exact of greetingExactInputs) exact.disabled = greetingState.native;
    };

    const reflectLauncher = () => {
      if (!state) return;
      for (const input of launcherInputs) {
        const key = input.dataset.editorLauncher;
        const value = stageValue(`launcher.${key}`) ?? state.launcher[key];
        input.dataset.editorField = `launcher.${key}`;
        input.value = String(value);
        if (input.type === "color") {
          const text = launcherTextInputs.find((candidate) => candidate.dataset.editorLauncherText === key);
          if (text) {
            text.value = String(value);
            text.dataset.editorField = `launcher.${key}`;
          }
        }
      }
      const radius = Number(stageValue("launcher.radius") ?? state.launcher.radius);
      const borderWidth = Number(stageValue("launcher.borderWidth") ?? state.launcher.borderWidth);
      document.getElementById("editor-launcher-radius-output").value = `${Math.round(radius)} px`;
      document.getElementById("editor-launcher-border-width-output").value = `${Math.round(borderWidth)} px`;
      if (launcherPreview) {
        const read = (key) => stageValue(`launcher.${key}`) ?? state.launcher[key];
        launcherPreview.style.background = read("surface");
        launcherPreview.style.color = read("foreground");
        launcherPreview.style.borderColor = read("border");
        launcherPreview.style.borderWidth = `${borderWidth}px`;
        launcherPreview.style.borderRadius = `${radius}px`;
        launcherPreview.style.setProperty("--editor-launcher-hover", read("surfaceHover"));
        launcherPreview.style.setProperty("--editor-launcher-accent", read("accent"));
      }
      if (launcherMark) {
        const source = state.launcherPreviewUrl;
        if (launcherMark.src !== source) launcherMark.src = source;
      }
    };

    const reflectMetadata = () => {
      if (!state) return;
      for (const input of metadataInputs) {
        const collection = input.dataset.editorMetadata === "label" ? "labels" : "descriptions";
        const path = `metadata.${collection}.${input.dataset.editorLocale}`;
        input.value = String(stageValue(path) ?? "");
      }
    };

    const option = (value, label) => {
      const node = document.createElement("option");
      node.value = value;
      node.textContent = label;
      return node;
    };

    const layerSelect = ({ layer, preset = "shared", property, labelKey, values, quick = false }) => {
      const field = document.createElement("label");
      field.className = `layer-field${quick ? "" : " advanced-only"}`;
      const label = document.createElement("span");
      label.textContent = tr(labelKey);
      const select = document.createElement("select");
      select.dataset.editorFocus = `layer-${layer.id}-${preset}-${property}`;
      select.dataset.editorField = preset === "shared"
        ? `layers[${layer.index}].${property}`
        : `layers[${layer.index}].frames.${preset}.${property}`;
      for (const [value, key] of values) select.appendChild(option(value, tr(key)));
      select.value = String(stageValue(select.dataset.editorField)
        ?? (preset === "shared" ? layer[property] : layer.frames[preset][property]));
      select.addEventListener("change", () => {
        setStageOverride(select.dataset.editorField, select.value);
        queueLayerChange(layer.index, preset, property, select.value);
        renderStage();
      });
      field.append(label, select);
      return field;
    };

    const layerRange = ({ layer, preset = "shared", property, labelKey, min, max, step, value, display }) => {
      const field = document.createElement("label");
      field.className = "layer-field advanced-only";
      const label = document.createElement("span");
      label.textContent = tr(labelKey);
      const output = document.createElement("output");
      const range = document.createElement("input");
      range.type = "range";
      range.min = String(min);
      range.max = String(max);
      range.step = String(step);
      range.value = String(stageValue(preset === "shared"
        ? `layers[${layer.index}].${property}`
        : `layers[${layer.index}].frames.${preset}.${property}`) ?? value);
      range.dataset.editorFocus = `layer-${layer.id}-${preset}-${property}`;
      range.dataset.editorField = preset === "shared"
        ? `layers[${layer.index}].${property}`
        : `layers[${layer.index}].frames.${preset}.${property}`;
      const exact = document.createElement("input");
      exact.type = "number";
      exact.className = "layer-exact-value";
      exact.min = String(min);
      exact.max = String(max);
      exact.step = String(step);
      exact.value = range.value;
      exact.inputMode = "decimal";
      exact.dataset.editorFocus = `layer-${layer.id}-${preset}-${property}-number`;
      exact.dataset.editorField = range.dataset.editorField;
      exact.setAttribute("aria-label", `${tr(labelKey)} · ${tr("exactValue")}`);
      const pair = document.createElement("span");
      pair.className = "layer-range-pair";
      const formatValue = () => display(range.valueAsNumber);
      output.value = formatValue();
      range.addEventListener("input", () => {
        exact.value = range.value;
        output.value = formatValue();
        setStageOverride(range.dataset.editorField, range.valueAsNumber);
        applyStageLayout();
      });
      range.addEventListener("change", () => queueLayerChange(layer.index, preset, property, range.valueAsNumber));
      exact.addEventListener("input", () => {
        if (!Number.isFinite(exact.valueAsNumber)) return;
        const next = clampNumber(exact.valueAsNumber, min, max);
        range.value = String(next);
        output.value = display(next);
        setStageOverride(range.dataset.editorField, next);
        applyStageLayout();
      });
      exact.addEventListener("change", () => {
        if (!Number.isFinite(exact.valueAsNumber)) {
          exact.value = range.value;
          return;
        }
        const next = clampNumber(exact.valueAsNumber, min, max);
        exact.value = String(next);
        range.value = String(next);
        queueLayerChange(layer.index, preset, property, next);
      });
      label.append(" ", output);
      pair.append(range, exact);
      field.append(label, pair);
      return field;
    };

    const renderFrame = (layer, preset, disabled = false) => {
      const frame = layer.frames[preset];
      const fieldset = document.createElement("fieldset");
      fieldset.className = "layer-preset advanced-only";
      fieldset.disabled = disabled;
      fieldset.dataset.gated = String(disabled);
      const legend = document.createElement("legend");
      legend.textContent = tr(preset === "normal" ? "normalPreset" : "widePreset");
      const grid = document.createElement("div");
      grid.className = "layer-grid";
      grid.append(
        layerSelect({
          layer, preset, property: "anchor", labelKey: "anchor",
          values: ANCHOR_OPTIONS,
        }),
        layerRange({ layer, preset, property: "focalX", labelKey: "focalX", min: 0, max: 100, step: 1, value: frame.focalX, display: (v) => `${Math.round(v)}%` }),
        layerRange({ layer, preset, property: "focalY", labelKey: "focalY", min: 0, max: 100, step: 1, value: frame.focalY, display: (v) => `${Math.round(v)}%` }),
        layerRange({ layer, preset, property: "positionX", labelKey: "positionX", min: -100, max: 100, step: 1, value: frame.positionX, display: (v) => `${Math.round(v)}%` }),
        layerRange({ layer, preset, property: "positionY", labelKey: "positionY", min: -100, max: 100, step: 1, value: frame.positionY, display: (v) => `${Math.round(v)}%` }),
        layerRange({ layer, preset, property: "scale", labelKey: "scale", min: 0.25, max: 3, step: 0.05, value: frame.scale, display: (v) => `${Math.round(v * 100)}%` }),
      );
      fieldset.append(legend, grid);
      return fieldset;
    };

    // Everything a card renders, so an unrelated edit (e.g. a colour tweak that
    // still triggers a full reflect) can leave the layer DOM — and its open,
    // scroll, and focus state — untouched instead of tearing it down and
    // reloading every thumbnail.
    const LAYER_SIGNATURE_SHARED = ["role", "appearance", "context", "viewport", "mask", "mobile", "opacity", "visible"];
    const LAYER_SIGNATURE_FRAME = ["anchor", "focalX", "focalY", "positionX", "positionY", "scale"];
    const layerRenderSignature = () => {
      const parts = [selectedLayerId, state.layers.length];
      for (const layer of state.layers) {
        const i = layer.index;
        parts.push(layer.id, i, layer.previewUrl ?? "", layer.bytes ?? "", stageLayerGate(layer) ? 1 : 0);
        for (const property of LAYER_SIGNATURE_SHARED) {
          parts.push(stageValue(`layers[${i}].${property}`) ?? layer[property]);
        }
        for (const preset of ["normal", "wide"]) {
          for (const property of LAYER_SIGNATURE_FRAME) {
            parts.push(stageValue(`layers[${i}].frames.${preset}.${property}`) ?? layer.frames[preset][property]);
          }
        }
      }
      return parts.join("");
    };

    const renderLayers = (focusKey = null) => {
      if (!state.layers.length) {
        selectedLayerId = null;
        if (renderedLayerSignature === "empty" && layerList.querySelector(".editor-layer-empty")) return;
        renderedLayerSignature = "empty";
        layerList.replaceChildren();
        const empty = document.createElement("p");
        empty.className = "editor-layer-empty";
        empty.textContent = tr("noLayers");
        layerList.appendChild(empty);
        refreshInspectorContext();
        return;
      }
      if (!layerForId(selectedLayerId)) selectedLayerId = state.layers[0].id;
      const signature = layerRenderSignature();
      if (signature === renderedLayerSignature && layerList.querySelector(".layer-card")) {
        refreshInspectorContext();
        return;
      }
      renderedLayerSignature = signature;
      layerList.replaceChildren();
      for (const layer of state.layers) {
        const gated = !stageLayerGate(layer);
        const card = document.createElement("details");
        card.className = "layer-card";
        card.dataset.editorLayer = String(layer.index);
        card.dataset.layerId = layer.id;
        card.dataset.selected = String(layer.id === selectedLayerId);
        card.open = layer.id === selectedLayerId;
        const cardSummary = document.createElement("summary");
        cardSummary.dataset.editorFocus = `layer-${layer.id}-summary`;
        cardSummary.addEventListener("click", () => {
          selectedLayerId = layer.id;
          selectStageItem({ kind: "layer", id: layer.id }, { reveal: false });
          requestAnimationFrame(() => {
            card.open = true;
            for (const sibling of layerList.querySelectorAll(".layer-card")) {
              const selected = sibling === card;
              sibling.dataset.selected = String(selected);
              if (!selected) sibling.open = false;
            }
          });
        });
        const preview = document.createElement("span");
        preview.className = "layer-preview";
        if (layer.previewUrl) {
          const image = document.createElement("img");
          image.src = layer.previewUrl;
          image.alt = "";
          image.setAttribute("aria-hidden", "true");
          preview.appendChild(image);
        } else preview.textContent = tr("noImagePreview");
        const summaryText = document.createElement("span");
        summaryText.className = "layer-summary-text";
        const strong = document.createElement("strong");
        const small = document.createElement("small");
        const role = String(stageValue(`layers[${layer.index}].role`) ?? layer.role);
        const appearance = String(stageValue(`layers[${layer.index}].appearance`) ?? layer.appearance);
        const context = String(stageValue(`layers[${layer.index}].context`) ?? layer.context);
        const roleLabel = tr(`role${role[0].toUpperCase()}${role.slice(1)}`);
        strong.textContent = format(tr("layerName"), roleLabel, layer.index + 1);
        const appearanceLabel = tr(`appearance${appearance === "all" ? "All" : appearance[0].toUpperCase() + appearance.slice(1)}`);
        const contextKey = context === "all" ? "contextAll" : context === "new-chat" ? "contextNewChat" : "contextConversation";
        small.textContent = format(tr("layerSummary"), roleLabel, appearanceLabel, tr(contextKey));
        const gateBadge = document.createElement("span");
        gateBadge.className = "layer-gate-badge";
        gateBadge.dataset.layerBadge = String(layer.index);
        gateBadge.hidden = true;
        summaryText.append(strong, small, gateBadge);
        const order = document.createElement("span");
        order.className = "layer-order";
        order.textContent = `${layer.index + 1}/${state.layers.length}`;
        cardSummary.append(preview, summaryText, order);

        const body = document.createElement("div");
        body.className = "layer-body";
        const inspectorTitle = document.createElement("h3");
        inspectorTitle.className = "layer-inspector-title";
        inspectorTitle.textContent = tr("layerInspectorTitle");
        const actions = document.createElement("div");
        actions.className = "layer-actions";
        const replace = document.createElement("button");
        replace.type = "button";
        replace.className = "ghost-button";
        replace.textContent = tr("replaceImage");
        replace.dataset.editorFocus = `layer-${layer.id}-replace`;
        replace.dataset.layerStructure = "";
        replace.addEventListener("click", () => {
          const base = mutationBase();
          const role = String(stageValue(`layers[${layer.index}].role`) ?? layer.role);
          const appearance = String(stageValue(`layers[${layer.index}].appearance`) ?? layer.appearance);
          const context = String(stageValue(`layers[${layer.index}].context`) ?? layer.context);
          if (base) post({
            type: "pick-theme-layer-image", ...base, index: layer.index, role, appearance, context,
          });
        });
        const up = document.createElement("button");
        up.type = "button";
        up.className = "ghost-button";
        up.textContent = tr("moveUp");
        up.disabled = layer.index === 0;
        up.dataset.layerBoundary = String(layer.index === 0);
        up.dataset.editorFocus = `layer-${layer.id}-move-up`;
        up.dataset.layerStructure = "";
        up.addEventListener("click", () => {
          const base = mutationBase();
          if (base) post({ type: "move-theme-layer", ...base, index: layer.index, direction: "up" });
        });
        const down = document.createElement("button");
        down.type = "button";
        down.className = "ghost-button";
        down.textContent = tr("moveDown");
        down.disabled = layer.index === state.layers.length - 1;
        down.dataset.layerBoundary = String(layer.index === state.layers.length - 1);
        down.dataset.editorFocus = `layer-${layer.id}-move-down`;
        down.dataset.layerStructure = "";
        down.addEventListener("click", () => {
          const base = mutationBase();
          if (base) post({ type: "move-theme-layer", ...base, index: layer.index, direction: "down" });
        });
        const remove = document.createElement("button");
        remove.type = "button";
        remove.className = "ghost-button danger-button";
        remove.textContent = tr("removeLayer");
        remove.dataset.editorFocus = `layer-${layer.id}-remove`;
        remove.dataset.layerStructure = "";
        remove.addEventListener("click", () => {
          const base = mutationBase();
          if (base) post({ type: "remove-theme-layer", ...base, index: layer.index });
        });
        const copyWide = document.createElement("button");
        copyWide.type = "button";
        copyWide.className = "ghost-button advanced-only";
        copyWide.textContent = tr("copyFramingToWide");
        copyWide.disabled = gated;
        copyWide.dataset.layerStateEdit = "";
        copyWide.dataset.editorFocus = `layer-${layer.id}-copy-wide`;
        copyWide.addEventListener("click", () => copyLayerFraming(layer.index, "normal", "wide"));
        const copyNormal = document.createElement("button");
        copyNormal.type = "button";
        copyNormal.className = "ghost-button advanced-only";
        copyNormal.textContent = tr("copyFramingToNormal");
        copyNormal.disabled = gated;
        copyNormal.dataset.layerStateEdit = "";
        copyNormal.dataset.editorFocus = `layer-${layer.id}-copy-normal`;
        copyNormal.addEventListener("click", () => copyLayerFraming(layer.index, "wide", "normal"));
        actions.append(replace, up, down, copyWide, copyNormal, remove);

        const sharedGrid = document.createElement("div");
        sharedGrid.className = "layer-grid";
        sharedGrid.append(
          layerSelect({ layer, property: "role", labelKey: "layerRole", quick: true, values: ROLE_IDS.map((value) => [value, `role${value[0].toUpperCase()}${value.slice(1)}`]) }),
          layerSelect({ layer, property: "appearance", labelKey: "appearanceUse", values: [["all", "appearanceAll"], ["light", "appearanceLight"], ["dark", "appearanceDark"]] }),
          layerSelect({ layer, property: "context", labelKey: "contextUse", values: [["all", "contextAll"], ["new-chat", "contextNewChat"], ["conversation", "contextConversation"]] }),
          layerSelect({ layer, property: "viewport", labelKey: "viewportUse", values: [["all", "viewportAll"], ["normal", "viewportNormal"], ["wide", "viewportWide"]] }),
          layerRange({ layer, property: "opacity", labelKey: "layerOpacity", min: 0, max: 1, step: 0.01, value: layer.opacity, display: (v) => `${Math.round(v * 100)}%` }),
          layerSelect({ layer, property: "mask", labelKey: "layerMask", values: [["none", "maskNone"], ["soft-right", "maskSoftRight"]] }),
          layerSelect({ layer, property: "mobile", labelKey: "mobileBehavior", values: [["keep", "mobileKeep"], ["reduce", "mobileReduce"], ["hide", "mobileHide"]] }),
        );
        const visible = document.createElement("label");
        visible.className = "layer-field layer-checkbox";
        const visibleInput = document.createElement("input");
        visibleInput.type = "checkbox";
        visibleInput.checked = Boolean(stageValue(`layers[${layer.index}].visible`) ?? layer.visible);
        visibleInput.dataset.editorFocus = `layer-${layer.id}-shared-visible`;
        visibleInput.dataset.editorField = `layers[${layer.index}].visible`;
        visibleInput.addEventListener("change", () => {
          setStageOverride(`layers[${layer.index}].visible`, visibleInput.checked);
          queueLayerChange(layer.index, "shared", "visible", visibleInput.checked);
          renderStage();
        });
        visible.append(visibleInput, document.createTextNode(tr("layerVisible")));
        sharedGrid.appendChild(visible);

        const placementScope = document.createElement("p");
        placementScope.className = "help layer-placement-scope";
        const appearanceScope = appearance === "all" ? tr("appearanceBoth") : appearanceLabel;
        const contextScope = context === "all" ? tr("contextBoth") : tr(contextKey);
        const scopeLabel = `${appearanceScope} · ${contextScope}`;
        placementScope.textContent = format(tr(
          appearance === "all" || context === "all" ? "layerPlacementShared" : "layerPlacementSpecific",
        ), scopeLabel);

        const meta = document.createElement("p");
        meta.className = "layer-meta advanced-only";
        meta.textContent = format(tr("imageBytes"), formatBytes(layer.bytes));
        body.append(inspectorTitle, sharedGrid, placementScope, actions,
          renderFrame(layer, "normal", gated), renderFrame(layer, "wide", gated), meta);
        card.append(cardSummary, body);
        layerList.appendChild(card);
      }
      refreshInspectorContext();
      if (focusKey) requestAnimationFrame(() => layerList.querySelector(`[data-editor-focus="${focusKey}"]`)?.focus());
    };

    const revealAdvancedForError = (field) => {
      const direct = field === "greetingPreferences"
        ? greetingPhrasesInput
        : editor.querySelector(`[data-editor-field="${CSS.escape(field)}"]`);
      if (field.startsWith("budget.") || direct?.closest(".advanced-only")) {
        editor.dataset.level = "advanced";
        for (const input of document.querySelectorAll('input[name="editor-level"]')) {
          input.checked = input.value === "advanced";
        }
      }
      const target = field === "greetingPreferences" ? "interface.greeting"
        : field.startsWith("launcher.") ? "widgets.app-identity"
        : field.startsWith("layers[") || field.startsWith("budget.layer") ? "background.layer"
          : field === "shared.backgroundScope" ? "background.canvas"
            : field.startsWith("shared.prompt.") ? "interface.new-chat-area"
              : "interface.theme";
      setInspectorTarget(target);
      if (field.startsWith("metadata.") || field.startsWith("labels.")
          || field.startsWith("descriptions.")) setDocumentDetailsOpen(true);
      return direct;
    };

    const focusBelowInspector = (target) => {
      if (!target) return;
      target.focus({ preventScroll: true });
      revealWithinInspector(target);
    };

    const focusError = (field) => {
      const direct = revealAdvancedForError(field);
      if (direct) {
        direct.closest("details")?.setAttribute("open", "");
        focusBelowInspector(direct);
        return;
      }
      const contrast = /^(light|dark)\.(.+)$/.exec(field);
      if (contrast) {
        selectedMode = contrast[1];
        for (const input of modeInputs) input.checked = input.value === selectedMode;
        reflectTokens();
        const token = contrast[2].includes("sidebar") ? "sidebar"
          : contrast[2].includes("surface") ? "surface"
            : contrast[2].includes("accent") || contrast[2] === "focus" ? "accent" : "text";
        const target = tokenGroups.querySelector(`[data-editor-token="${token}"]`);
        if (target?.closest(".advanced-only")) {
          editor.dataset.level = "advanced";
          for (const input of document.querySelectorAll('input[name="editor-level"]')) {
            input.checked = input.value === "advanced";
          }
        }
        setInspectorTarget("interface.theme");
        renderStage();
        target?.closest("details")?.setAttribute("open", "");
        focusBelowInspector(target);
        return;
      }
      const layer = /^layers\[(layer-[a-f0-9]{32}|\d+)]$/.exec(field);
      if (layer) {
        setInspectorTarget("background.layer");
        const card = layer[1].startsWith("layer-")
          ? layerList.querySelector(`[data-layer-id="${CSS.escape(layer[1])}"]`)
          : layerList.querySelector(`[data-editor-layer="${layer[1]}"]`);
        if (card) {
          selectedLayerId = card.dataset.layerId;
          syncSelectedLayerCards();
          card.open = true;
          focusBelowInspector(card.querySelector("summary"));
          return;
        }
      }
      focusBelowInspector(field.startsWith("budget.") ? feedbackRoot : title);
    };

    const validationMessageFor = (error) => {
      if (!error) return tr("validationGenericFix");
      if (error.code === "invalid-greeting" || error.field === "greetingPreferences") {
        return tr("greetingPhrasesEmpty");
      }
      if (error.field.startsWith("launcher.")) return tr("validationIdentityFix");
      if (error.code.includes("contrast") || /^(light|dark)\./.test(error.field)) return tr("validationColorFix");
      if (error.code.includes("budget") || error.field.startsWith("budget.")) return tr("validationBudgetFix");
      if (error.field.startsWith("layers[")) return tr("validationArtworkFix");
      if (error.field.startsWith("metadata.") || error.field.startsWith("labels.")
          || error.field.startsWith("descriptions.")) return tr("validationMetadataFix");
      return tr("validationGenericFix");
    };

    const renderFeedback = () => {
      feedbackRoot.replaceChildren();
      quickFeedback.replaceChildren();
      errorSummary.replaceChildren();
      errorSummary.hidden = true;
      // An invalid draft keeps Aura on the last valid payload, so every later edit —
      // colour, greeting, artwork — stops reaching the running app until it is fixed.
      // Say that plainly; a failed check in a list does not explain a frozen preview.
      if (livePausedNote) {
        const blocking = [];
        for (const mode of ["light", "dark"]) {
          for (const check of state.feedback.contrast[mode] ?? []) {
            if (!check.pass) {
              blocking.push(`${tr(mode === "light" ? "lightMode" : "darkMode")} ${tr(CONTRAST_LABEL_KEYS[check.id])}`);
            }
          }
        }
        const budget = state.feedback.budget;
        if (budget.chromeBytes >= budget.chromeLimit) blocking.push(tr("budgetChrome"));
        if (budget.embeddedArtworkBytes >= budget.embeddedArtworkLimit) blocking.push(tr("budgetArtwork"));
        if (budget.sourceArtworkBytes >= budget.sourceArtworkLimit) blocking.push(tr("budgetSourceArtwork"));
        livePausedNote.hidden = state.feedback.valid;
        livePausedNote.textContent = state.feedback.valid
          ? ""
          : format(tr("livePausedNotice"), blocking.slice(0, 3).join(" · ") || tr("feedbackInvalid"));
      }
      const list = document.createElement("ul");
      list.className = "editor-feedback-list";
      const addItem = (label, value, pass) => {
        const item = document.createElement("li");
        item.className = "editor-feedback-item";
        item.dataset.pass = String(pass);
        const strong = document.createElement("strong");
        strong.textContent = label;
        const result = document.createElement("span");
        result.textContent = value;
        item.append(strong, result);
        list.appendChild(item);
      };
      addItem(state.feedback.valid ? tr("feedbackValid") : tr("feedbackInvalid"),
        state.feedback.valid ? tr("checkPass") : tr("checkFail"), state.feedback.valid);
      for (const mode of ["light", "dark"]) {
        for (const check of state.feedback.contrast[mode]) {
          addItem(format(tr("contrastCheck"), `${tr(mode === "light" ? "lightMode" : "darkMode")} ${tr(CONTRAST_LABEL_KEYS[check.id])}`),
            `${check.ratio.toFixed(2)} / ${check.minimum.toFixed(2)}`, check.pass);
        }
      }
      const budget = state.feedback.budget;
      addItem(tr("budgetChrome"), format(tr("budgetValue"), formatBytes(budget.chromeBytes), formatBytes(budget.chromeLimit)), budget.chromeBytes < budget.chromeLimit);
      addItem(tr("budgetArtwork"), format(tr("budgetValue"), formatBytes(budget.embeddedArtworkBytes), formatBytes(budget.embeddedArtworkLimit)), budget.embeddedArtworkBytes < budget.embeddedArtworkLimit);
      addItem(tr("budgetSourceArtwork"), format(tr("budgetValue"), formatBytes(budget.sourceArtworkBytes), formatBytes(budget.sourceArtworkLimit)), budget.sourceArtworkBytes < budget.sourceArtworkLimit);
      for (const layer of budget.layers) {
        addItem(`${tr("budgetLayer")} ${layer.id + 1}`, format(tr("budgetValue"), formatBytes(layer.bytes), formatBytes(layer.limit)), layer.pass);
      }
      feedbackRoot.appendChild(list);
      const quickText = document.createElement("span");
      quickText.textContent = state.feedback.valid
        ? tr("quickFeedbackValid")
        : `${format(tr("quickFeedbackInvalid"), validationMessageFor(state.feedback.errors[0]))} ${tr("studioLastValid")}`;
      quickFeedback.dataset.pass = String(state.feedback.valid);
      quickFeedback.appendChild(quickText);
      if (state.feedback.errors.length) {
        const first = state.feedback.errors[0];
        const quickJump = document.createElement("button");
        quickJump.type = "button";
        quickJump.textContent = tr("firstIssue");
        quickJump.addEventListener("click", () => focusError(first.field));
        quickFeedback.appendChild(quickJump);
        const message = document.createElement("span");
        message.textContent = validationMessageFor(first);
        const jump = document.createElement("button");
        jump.type = "button";
        jump.textContent = tr("firstIssue");
        jump.addEventListener("click", () => focusError(first.field));
        errorSummary.append(message, jump);
        errorSummary.hidden = false;
      }
    };

    const reflectButtonStates = () => {
      if (!state) return;
      reflectDirtyState();
      const busy = Boolean(pendingAction || coalescedChanges.size || changeFlushTimer
        || stageKeyTimer || stageKeyPaths.size);
      const blocked = deferredChanges.size > 0;
      const localGreetingWork = greetingPreferenceDraftDirty || greetingPreferenceInputDirty;
      undoButton.disabled = busy || blocked || (!state.canUndo && !localGreetingWork);
      redoButton.disabled = busy || blocked || localGreetingWork || !state.canRedo;
      resetButton.disabled = busy || blocked || (!state.dirty && !localGreetingWork);
      saveButton.disabled = busy
        || (state.feedback.valid && (blocked
          || (!state.dirty && !localGreetingWork && !state.isNew)));
      // Leaving must always be possible while edits are still settling; only a
      // blocking structural action (which briefly replaces state) holds it.
      cancelButton.disabled = isBlockingAction();
      backButton.disabled = isBlockingAction();
      addLayerButton.disabled = busy || blocked || state.layers.length >= 8;
      stageOpacityInput.disabled = isBlockingAction() || blocked;
      if (replaceLauncherMarkButton) replaceLauncherMarkButton.disabled = busy || blocked;
      if (greetingResetButton) greetingResetButton.disabled = busy || blocked;
      addLayerButton.dataset.layerStructure = "";
      for (const button of editor.querySelectorAll("[data-layer-structure]")) {
        button.disabled = busy || blocked || (button === addLayerButton && state.layers.length >= 8)
          || button.dataset.layerBoundary === "true";
      }
    };

    const reflect = (focusKey = null) => {
      if (!state) return;
      title.textContent = format(tr("editorTitleFor"), state.label);
      summary.textContent = tr("editorSummary");
      reflectDirtyState();
      validPill.textContent = state.feedback.valid ? tr("validState") : tr("invalidState");
      validPill.dataset.state = state.feedback.valid ? "valid" : "invalid";
      for (const input of modeInputs) input.checked = input.value === selectedMode;
      reflectTokens();
      reflectShared();
      reflectGreeting();
      reflectLauncher();
      reflectMetadata();
      renderLayers(focusKey);
      renderFeedback();
      reflectButtonStates();
      renderStage();
    };

    const settlePendingAction = (normalized) => {
      const { error: actionError } = normalized;
      if (!pendingAction || normalized.lastAction !== pendingAction) return "waiting";
      const succeeded = normalized.actionSucceeded !== false;
      if (pendingAction !== "apply-theme-patch") {
        const settledAction = pendingAction;
        setPending(null);
        if (actionError === "picker-cancelled") {
          announce(tr("editorReady"));
          return "settled";
        }
        if (!succeeded) dropStageWork();
        const successMessage = settledAction === "pick-theme-launcher-mark"
          ? tr("launcherMarkImported") : tr("editorReady");
        const failureMessage = settledAction === "pick-theme-launcher-mark"
          ? tr(actionError === "identity-apply-failed" ? "launcherMarkApplyFailed" : "launcherMarkFailed")
          : tr("editorActionFailed");
        announce(succeeded ? successMessage : failureMessage, succeeded ? "ok" : "error");
        if (succeeded && actionAfterPatch) {
          const followup = actionAfterPatch;
          actionAfterPatch = null;
          const base = mutationBase();
          const rebased = base && (Object.hasOwn(followup, "session") || Object.hasOwn(followup, "revision"))
            ? { ...followup, ...base }
            : followup;
          post(rebased);
        }
        return "settled";
      }
      if (!inFlightSession || inFlightRevision === null
          || normalized.session !== inFlightSession) {
        dropStageWork();
        setPending(null);
        announce(tr("editorActionFailed"), "error");
        return "stopped";
      }
      if (succeeded) {
        // `lastAction` remains in every subsequent host state. Only the exact
        // one-revision advance can acknowledge this patch rather than repeat
        // a previous patch result.
        if (normalized.revision !== inFlightRevision + 1) return "waiting";
        clearInFlightChanges();
        setPending(null);
        announce(tr("editorReady"));
        if (actionAfterPatch) {
          const followup = actionAfterPatch;
          actionAfterPatch = null;
          const base = mutationBase();
          const rebased = base && (Object.hasOwn(followup, "session") || Object.hasOwn(followup, "revision"))
            ? { ...followup, ...base }
            : followup;
          if (!post(rebased)) announce(tr("editorActionFailed"), "error");
        }
        return "settled";
      }
      if (actionError === "request-rejected") {
        if (normalized.revision > inFlightRevision) {
          // The host moved forward before this request arrived. Rebase once
          // against its confirmed revision; newer local values still win.
          requeueInFlightChanges();
          setPending(null);
          announce(tr("editorActionFailed"), "error");
          return "retry";
        }
        // A same-revision rejection may be permanent. Keep the local values
        // visible, stop automatic traffic, and retry only after a fresh edit.
        deferInFlightChanges();
        actionAfterPatch = null;
        setPending(null);
        announce(tr("editorActionFailed"), "error");
        return "blocked";
      }
      if (normalized.revision !== inFlightRevision + 1) return "waiting";
      // Contrast/budget failures are persisted edits, not transport failures.
      clearInFlightChanges();
      actionAfterPatch = null;
      setPending(null);
      announce(tr("editorActionFailed"), "error");
      return "settled";
    };

    const receive = (rawState, appearance = "system") => {
      const normalized = normalizeEditorState(rawState);
      if (normalized === undefined) {
        announce(tr("editorStateRejected"), "error");
        return false;
      }
      if (normalized === null || !normalized.active) {
        const wasEditing = Boolean(state) || Boolean(pendingAction);
        const action = normalized?.lastAction ?? pendingAction ?? "";
        const succeeded = normalized?.actionSucceeded !== false;
        setPending(null);
        dropStageWork();
        if (!succeeded) {
          announce(tr("editorActionFailed"), "error");
          return true;
        }
        state = null;
        greetingPreferenceDraft = null;
        greetingPreferenceDraftDirty = false;
        greetingPreferenceInputDirty = false;
        greetingPreferenceInputInvalid = false;
        onStudioStyleChange?.(null, null, null, null);
        if (wasEditing || action) hideEditor(action);
        return true;
      }
      const focusKey = document.activeElement?.dataset?.editorFocus ?? null;
      const entering = !state;
      if (entering) {
        const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)")?.matches === true;
        selectedMode = appearance === "dark" || (appearance === "system" && prefersDark) ? "dark" : "light";
        entryAppearance = appearance;
        appearanceTouched = false;
        stageContextTouched = false;
        stageMirror = null;
        stageLiveMirror = null;
        stageMirrorCache.clear();
        stageMirrorCacheBasis = null;
        previewSizeEditing = false;
        previewSizeIntent = null;
        previewExpectedRequest = null;
      }
      returnTheme = normalized.isNew ? normalized.sourceId : normalized.id;
      const greetingAcknowledged = ["set-greeting-phrases", "reset-greeting"].includes(pendingAction)
        && normalized.lastAction === pendingAction;
      if (entering
          || (!greetingPreferenceDraftDirty && !greetingPreferenceInputDirty)
          || greetingAcknowledged) {
        greetingPreferenceDraft = structuredClone(normalized.greetingPreferences);
        greetingPreferenceDraftDirty = false;
        greetingPreferenceInputDirty = false;
        greetingPreferenceInputInvalid = false;
        greetingNameInput?.removeAttribute("aria-invalid");
        greetingPhrasesInput?.removeAttribute("aria-invalid");
        greetingOverridePhrasesInput?.removeAttribute("aria-invalid");
        if (greetingPhrasesStatus) greetingPhrasesStatus.hidden = true;
      }
      state = normalized;
      selectStageMirror();
      onStudioStyleChange?.(
        normalized.studioStyle,
        normalized.id,
        normalized.launcherStyle,
        normalized.launcherStylePreviewUrl,
      );
      const settlement = settlePendingAction(normalized);
      if (settlement === "waiting" && !pendingAction) setPending(null);
      showEditor();
      reflect(entering ? null : focusKey);
      if (entering) announce(tr("editorReady"));
      if (settlement !== "blocked" && settlement !== "stopped") flushThemeChanges();
      return true;
    };

    modeInputs.forEach((input) => input.addEventListener("change", () => {
      if (!input.checked) return;
      if (selectedMode !== input.value) {
        appearanceTouched = true;
        send({ type: "set-appearance", appearance: input.value });
      }
      selectedMode = input.value;
      selectStageMirror();
      reflectTokens();
      reflectGreeting();
      refreshInspectorContext();
      renderStage();
    }));
    document.getElementById("copy-light-dark").addEventListener("click", () => {
      inspectorField = "tokens.dark.canvas";
      refreshInspectorContext();
      queueTokenChange("mode-copy", "tokens", "light");
    });
    document.getElementById("copy-dark-light").addEventListener("click", () => {
      inspectorField = "tokens.light.canvas";
      refreshInspectorContext();
      queueTokenChange("mode-copy", "tokens", "dark");
    });

    metadataInputs.forEach((input) => input.addEventListener("change", () => {
      const data = input.dataset;
      const value = input.value.trim();
      if (!value) {
        input.setAttribute("aria-invalid", "true");
        announce(tr("editorActionFailed"), "error");
        return;
      }
      input.removeAttribute("aria-invalid");
      input.value = value;
      const collection = data.editorMetadata === "label" ? "labels" : "descriptions";
      setStageOverride(`metadata.${collection}.${data.editorLocale}`, value);
      const field = data.editorMetadata;
      queueThemeChange({
        kind: "metadata",
        field,
        locale: data.editorLocale,
        value,
      });
    }));

    sharedInputs.forEach((input) => {
      const key = input.dataset.editorShared;
      const unitOutput = key === "radius" ? document.getElementById("editor-radius-output")
        : key === "blur" ? document.getElementById("editor-blur-output") : null;
      input.addEventListener("input", () => {
        if (unitOutput) unitOutput.value = `${input.value} px`;
        if (input.type === "range") {
          if (key === "radius") setInheritedRadiusPresentation(false);
          setStageOverride(input.dataset.editorField, input.valueAsNumber);
          applyStageLayout();
        }
      });
      input.addEventListener("change", () => {
        if (input.value === THEME_ORIGINAL) return;
        const value = input.type === "range" ? input.valueAsNumber : input.value;
        setStageOverride(input.dataset.editorField, value);
        applyStageLayout();
        queueTokenChange("shared", key, value);
      });
    });
    const launcherLabelKeys = Object.freeze({
      surface: "launcherSurface",
      surfaceHover: "launcherSurfaceHover",
      foreground: "launcherForeground",
      accent: "launcherAccent",
      border: "launcherBorder",
      radius: "launcherRadius",
      borderWidth: "launcherBorderWidth",
    });
    for (const input of launcherInputs) {
      const key = input.dataset.editorLauncher;
      input.setAttribute("aria-label", tr(launcherLabelKeys[key]));
      if (input.type === "color") {
        const text = launcherTextInputs.find((candidate) => candidate.dataset.editorLauncherText === key);
        if (text) text.setAttribute("aria-label", `${tr(launcherLabelKeys[key])} HEX`);
        input.addEventListener("input", () => {
          const value = input.value.toUpperCase();
          if (text) {
            text.value = value;
            text.removeAttribute("aria-invalid");
          }
          setStageOverride(`launcher.${key}`, value);
          reflectLauncher();
        });
        input.addEventListener("change", () => queueTokenChange("shared", launcherToken(key), input.value.toUpperCase()));
        text?.addEventListener("change", () => {
          const value = text.value.trim().toUpperCase();
          if (!COLOR_PATTERN.test(value)) {
            text.setAttribute("aria-invalid", "true");
            announce(tr("editorActionFailed"), "error");
            return;
          }
          text.removeAttribute("aria-invalid");
          input.value = value;
          setStageOverride(`launcher.${key}`, value);
          reflectLauncher();
          queueTokenChange("shared", launcherToken(key), value);
        });
      } else {
        input.addEventListener("input", () => {
          setStageOverride(`launcher.${key}`, input.valueAsNumber);
          reflectLauncher();
        });
        input.addEventListener("change", () => queueTokenChange("shared", launcherToken(key), input.valueAsNumber));
      }
    }
    replaceLauncherMarkButton?.addEventListener("click", () => {
      const base = editorMessageBase();
      if (base) post({ type: "pick-theme-launcher-mark", ...base });
    });
    scopeInputs.forEach((input) => input.addEventListener("change", () => {
      if (!input.checked) return;
      setStageOverride("shared.backgroundScope", input.value);
      applyStageLayout();
      queueTokenChange("shared", "backgroundScope", input.value);
    }));
    promptInputs.forEach((input) => {
      input.addEventListener("input", () => {
        if (stageContext !== "new-chat") return;
        seedNativePromptOverrides();
        document.getElementById(`${input.id}-output`).value = `${input.value}%`;
        const exact = document.getElementById(`${input.id}-exact`);
        if (exact) exact.value = input.value;
        setStageOverride(input.dataset.editorField, input.valueAsNumber / 100);
        applyStageLayout();
      });
      input.addEventListener("change", () => {
        if (stageContext !== "new-chat") return;
        commitStagePaths(STAGE_PROMPT_PATHS);
      });
    });
    promptExactInputs.forEach((exact) => {
      const key = exact.dataset.editorPromptExact;
      const range = promptInputs.find((input) => input.dataset.editorPrompt === key);
      if (!range) return;
      const labelKey = key === "width" ? "promptWidth" : key === "x" ? "horizontalOffset" : "verticalOffset";
      exact.setAttribute("aria-label", `${tr(labelKey)} · ${tr("exactValue")}`);
      const updateFromExact = () => {
        if (stageContext !== "new-chat") return null;
        if (!Number.isFinite(exact.valueAsNumber)) return null;
        seedNativePromptOverrides();
        const next = clampNumber(exact.valueAsNumber, Number(exact.min), Number(exact.max));
        exact.value = String(next);
        range.value = String(next);
        document.getElementById(`${range.id}-output`).value = `${next}%`;
        setStageOverride(range.dataset.editorField, next / 100);
        applyStageLayout();
        return next;
      };
      exact.addEventListener("input", updateFromExact);
      exact.addEventListener("change", () => {
        const next = updateFromExact();
        if (next === null) {
          exact.value = range.value;
          return;
        }
        commitStagePaths(STAGE_PROMPT_PATHS);
      });
    });
    greetingEnableInput?.addEventListener("change", () => {
      if (greetingEnableInput.checked) queueGreetingFrame(greetingFrameFromControls(), { immediate: true });
      else {
        queueThemeChange({
          kind: "greeting",
          operation: "reset",
          appearance: selectedMode,
          frame: greetingFrameId(),
          value: null,
        }, { immediate: true });
      }
    });
    greetingResetButton?.addEventListener("click", () => {
      const base = mutationBase();
      if (base) post({ type: "reset-greeting", ...base });
    });
    const showGreetingInputError = () => {
      if (!greetingPhrasesStatus) return;
      greetingPhrasesStatus.textContent = tr("greetingPhrasesEmpty");
      greetingPhrasesStatus.hidden = false;
    };
    const updateGreetingPreferenceDraft = () => {
      if (!state) return null;
      const current = structuredClone(greetingDraft() ?? state.greetingPreferences);
      const enabled = greetingPersonalEnableInput?.checked ?? current.enabled;
      const source = greetingSourceInputs.find((input) => input.checked)?.value ?? current.source;
      const overrideMode = greetingOverrideInput?.value ?? greetingThemeOverride(current).mode;
      if (typeof enabled !== "boolean"
          || !["claude", "custom"].includes(source)
          || !["global", "claude", "custom"].includes(overrideMode)) {
        greetingPreferenceInputDirty = true;
        greetingPreferenceInputInvalid = true;
        showGreetingInputError();
        return null;
      }
      // Disabled personalization and Claude wording do not consume the custom
      // fields. Preserve the last valid stored lists so switching away is an
      // explicit recovery path for invalid in-progress text.
      if (!enabled || source === "claude") {
        current.enabled = enabled;
        current.source = source;
        current.shuffle = null;
        greetingPreferenceDraft = current;
        greetingPreferenceDraftDirty = JSON.stringify(current) !== JSON.stringify(state.greetingPreferences);
        greetingPreferenceInputDirty = greetingPreferenceDraftDirty;
        greetingPreferenceInputInvalid = false;
        greetingNameInput?.removeAttribute("aria-invalid");
        greetingPhrasesInput?.removeAttribute("aria-invalid");
        greetingOverridePhrasesInput?.removeAttribute("aria-invalid");
        if (greetingPhrasesStatus) greetingPhrasesStatus.hidden = true;
        return current;
      }
      const displayName = (greetingNameInput?.value ?? "").normalize("NFC").trim();
      const globalPhrases = parseGreetingPhrases(greetingPhrasesInput?.value);
      const overridePhrases = overrideMode === "custom"
        ? parseGreetingPhrases(greetingOverridePhrasesInput?.value)
        : [];
      const invalidName = [...displayName].length > 40
        || /[\u0000-\u001F\u007F-\u009F]/u.test(displayName);
      const invalidGlobal = globalPhrases === null;
      const invalidOverride = overridePhrases === null;
      greetingNameInput?.toggleAttribute("aria-invalid", invalidName);
      greetingPhrasesInput?.toggleAttribute("aria-invalid", invalidGlobal);
      greetingOverridePhrasesInput?.toggleAttribute("aria-invalid", invalidOverride);
      if (invalidName || invalidGlobal || invalidOverride) {
        greetingPreferenceInputDirty = true;
        greetingPreferenceInputInvalid = true;
        showGreetingInputError();
        return null;
      }
      current.enabled = enabled;
      current.source = source;
      current.displayName = displayName;
      current.globalPhrases = globalPhrases;
      current.themeOverrides[state.id] = {
        mode: overrideMode,
        phrases: overrideMode === "custom" ? overridePhrases : [],
      };
      current.shuffle = null;
      greetingPreferenceDraft = current;
      greetingPreferenceDraftDirty = JSON.stringify(current) !== JSON.stringify(state.greetingPreferences);
      greetingPreferenceInputDirty = greetingPreferenceDraftDirty;
      greetingPreferenceInputInvalid = false;
      if (greetingPhrasesStatus) greetingPhrasesStatus.hidden = true;
      return current;
    };
    const greetingPreferenceDraftValid = (personal) => {
      if (!personal) return false;
      if (!personal.enabled || personal.source === "claude") return true;
      const override = greetingThemeOverride(personal);
      if (override.mode === "claude") return true;
      const phrases = override.mode === "custom" ? override.phrases : personal.globalPhrases;
      const usable = phrases.flatMap((phrase) => {
        if (!personal.displayName && /\{name\}/u.test(phrase)) return [];
        return [phrase.replace(/\{name\}/gu, personal.displayName)];
      });
      return usable.length > 0
        && new TextEncoder().encode(JSON.stringify(usable)).length <= GREETING_MAX_COMPILED_BYTES;
    };
    const postGreetingPreferences = (personal, base = mutationBase()) => {
      if (!base || !personal) return false;
      const override = greetingThemeOverride(personal);
      return post({
        type: "set-greeting-phrases",
        ...base,
        enabled: personal.enabled,
        source: personal.source,
        displayName: personal.displayName,
        globalPhrases: personal.globalPhrases,
        overrideMode: override.mode,
        overridePhrases: override.phrases,
      });
    };
    const submitGreetingPhrases = () => {
      const base = mutationBase();
      if (!base || !state) return;
      const personal = updateGreetingPreferenceDraft();
      if (greetingPreferenceInputInvalid || !greetingPreferenceDraftValid(personal)) {
        showGreetingInputError();
        reflectButtonStates();
        return;
      }
      if (greetingPhrasesStatus) greetingPhrasesStatus.hidden = true;
      if (!greetingPreferenceDraftDirty) {
        reflectButtonStates();
        return;
      }
      postGreetingPreferences(personal, base);
    };
    greetingPersonalEnableInput?.addEventListener("change", () => {
      updateGreetingPreferenceDraft();
      reflectGreeting();
      reflectButtonStates();
    });
    for (const input of greetingSourceInputs) {
      input.addEventListener("change", () => {
        if (!input.checked) return;
        updateGreetingPreferenceDraft();
        reflectGreeting();
        reflectButtonStates();
      });
    }
    const previewGreetingWords = () => {
      const personal = updateGreetingPreferenceDraft();
      if (greetingPreferenceInputInvalid || !greetingPreferenceDraftValid(personal)) {
        showGreetingInputError();
      }
      reflectGreetingPreview(activeGreetingFrame(), state?.shared?.greeting?.native);
      reflectButtonStates();
    };
    greetingNameInput?.addEventListener("input", previewGreetingWords);
    greetingPhrasesInput?.addEventListener("input", previewGreetingWords);
    greetingOverridePhrasesInput?.addEventListener("input", previewGreetingWords);
    const submitGreetingOnFocusExit = (event) => {
      // A blur caused by the Save button must not post first and disable that
      // button before its click. Save flushes this same draft and chains the
      // theme transaction after the host acknowledges it.
      if (event.relatedTarget === saveButton) return;
      submitGreetingPhrases();
    };
    greetingNameInput?.addEventListener("focusout", submitGreetingOnFocusExit);
    greetingPhrasesInput?.addEventListener("focusout", submitGreetingOnFocusExit);
    greetingOverrideInput?.addEventListener("change", () => {
      updateGreetingPreferenceDraft();
      reflectGreeting();
      reflectButtonStates();
    });
    greetingPersonalEnableInput?.addEventListener("focusout", submitGreetingOnFocusExit);
    for (const input of greetingSourceInputs) {
      input.addEventListener("focusout", submitGreetingOnFocusExit);
    }
    greetingOverrideInput?.addEventListener("focusout", submitGreetingOnFocusExit);
    greetingOverridePhrasesInput?.addEventListener("focusout", submitGreetingOnFocusExit);
    // Reads the panel's own controls so the sample tracks a drag continuously, rather
    // than only after the host acknowledges the patch.
    const previewFromControls = () => {
      if (!state) return;
      reflectGreetingPreview(
        greetingFrameFromControls(),
        !greetingEnableInput?.checked,
      );
    };
    greetingInputs.forEach((input) => {
      const field = input.dataset.editorGreeting;
      const output = input.type === "range" ? document.getElementById(`${input.id}-output`) : null;
      input.addEventListener("input", () => {
        if (output) output.value = greetingOutputText(field, input.valueAsNumber);
        const exact = greetingExactInputs.find((candidate) =>
          candidate.dataset.editorGreetingExact === field);
        if (exact) exact.value = input.value;
        previewFromControls();
      });
      input.addEventListener("change", () => {
        const value = input.type === "checkbox" ? input.checked
          : input.type === "range" ? input.valueAsNumber
            : field === "weight" ? Number(input.value)
              : input.value;
        if (field === "markSource" && value === "compact"
            && !state?.shared?.greeting?.compactMarkAvailable) {
          reflectGreeting();
          announce(tr("editorActionFailed"), "error");
          return;
        }
        queueGreetingFrame(greetingFrameFromControls(field, value));
      });
    });
    greetingExactInputs.forEach((exact) => {
      const field = exact.dataset.editorGreetingExact;
      const range = greetingInputs.find((candidate) =>
        candidate.dataset.editorGreeting === field && candidate.type === "range");
      if (!range) return;
      const update = () => {
        if (!Number.isFinite(exact.valueAsNumber)) return null;
        const value = Math.min(Number(exact.max), Math.max(Number(exact.min), exact.valueAsNumber));
        exact.value = String(value);
        range.value = String(value);
        const output = document.getElementById(`${range.id}-output`);
        if (output) output.value = greetingOutputText(field, value);
        previewFromControls();
        return value;
      };
      exact.addEventListener("input", update);
      exact.addEventListener("change", () => {
        const value = update();
        if (value === null) {
          exact.value = range.value;
          return;
        }
        queueGreetingFrame(greetingFrameFromControls(field, value));
      });
    });

    const performUndo = () => {
      if (undoButton.disabled) return;
      if ((greetingPreferenceDraftDirty || greetingPreferenceInputDirty) && state) {
        greetingPreferenceDraft = structuredClone(state.greetingPreferences);
        greetingPreferenceDraftDirty = false;
        greetingPreferenceInputDirty = false;
        greetingPreferenceInputInvalid = false;
        greetingNameInput?.removeAttribute("aria-invalid");
        greetingPhrasesInput?.removeAttribute("aria-invalid");
        greetingOverridePhrasesInput?.removeAttribute("aria-invalid");
        if (greetingPhrasesStatus) greetingPhrasesStatus.hidden = true;
        reflectGreeting();
        reflectButtonStates();
        return;
      }
      const base = mutationBase();
      if (base) post({ type: "undo-theme-edit", ...base });
    };
    const performRedo = () => {
      if (redoButton.disabled) return;
      const base = mutationBase();
      if (base) post({ type: "redo-theme-edit", ...base });
    };
    const performSave = () => {
      if (saveButton.disabled) return;
      const personal = greetingPreferenceInputDirty
        ? updateGreetingPreferenceDraft()
        : greetingDraft();
      if (!state?.feedback.valid
          || greetingPreferenceInputInvalid
          || !greetingPreferenceDraftValid(personal)) {
        if (greetingPreferenceInputInvalid || !greetingPreferenceDraftValid(personal)) {
          showGreetingInputError();
        }
        errorSummary.hidden = false;
        focusBelowInspector(errorSummary);
        announce(tr("saveBlocked"), "error");
        return;
      }
      const base = mutationBase();
      if (!base) return;
      if (greetingPreferenceDraftDirty) {
        actionAfterPatch = { type: "save-theme-edit", ...base };
        postGreetingPreferences(personal, base);
        return;
      }
      post({ type: "save-theme-edit", ...base });
    };
    undoButton.addEventListener("click", performUndo);
    redoButton.addEventListener("click", performRedo);
    resetButton.addEventListener("click", () => showConfirm({
      titleText: tr("confirmResetTitle"), bodyText: tr("confirmResetBody"), actionText: tr("confirmResetAction"),
      opener: resetButton, callback: () => state && post({ type: "begin-theme-edit", theme: state.id, reset: true }),
    }));
    saveButton.addEventListener("click", performSave);

    // Editor-wide shortcuts: Ctrl/Cmd+Z undo, Ctrl/Cmd+Y or Ctrl/Cmd+Shift+Z
    // redo, Ctrl/Cmd+S save. Skipped while a dialog is open, and undo/redo
    // yields to the browser's native text history when a text field is focused.
    document.addEventListener("keydown", (event) => {
      if (!state || editor.hidden) return;
      if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
      if (document.querySelector("dialog[open]")) return;
      const key = event.key.toLowerCase();
      if (key === "s") {
        event.preventDefault();
        performSave();
        return;
      }
      const target = event.target;
      const editingText = target instanceof HTMLElement
        && (target.isContentEditable
          || target.matches("textarea, input:not([type=color]):not([type=range]):not([type=radio]):not([type=checkbox]):not([type=button])"));
      if (editingText) return;
      if (key === "z" && !event.shiftKey) {
        event.preventDefault();
        performUndo();
      } else if (key === "y" || (key === "z" && event.shiftKey)) {
        event.preventDefault();
        performRedo();
      }
    });
    const discard = () => {
      const base = mutationBase();
      if (!base) return;
      // Cancel/Back stay live while a value patch is syncing; if that patch is
      // still in flight, post() defers the discard, so schedule it to run the
      // moment the patch settles rather than dropping it silently.
      if (!post({ type: "discard-theme-edit", ...base }) && pendingAction) {
        actionAfterPatch = { type: "discard-theme-edit", ...base };
      }
    };
    const requestExit = (opener) => {
      if (!hasUnsavedEdits()) { discard(); return; }
      showConfirm({
        titleText: tr("confirmDiscardTitle"), bodyText: tr("confirmDiscardBody"), actionText: tr("confirmDiscardAction"),
        opener, callback: discard,
      });
    };
    cancelButton.addEventListener("click", () => requestExit(cancelButton));
    backButton.addEventListener("click", () => requestExit(backButton));
    addLayerButton.addEventListener("click", () => {
      if (!state || state.layers.length >= 8) { announce(tr("layerLimit"), "error"); return; }
      const base = mutationBase();
      if (base) post({
        type: "pick-theme-layer-image",
        ...base,
        index: -1,
        role: selectedArtworkRole(),
        appearance: selectedMode,
        context: stageContext,
      });
    });

    const promptSlot = document.getElementById("prompt-builder-slot");
    const promptSubject = document.getElementById("prompt-builder-subject");
    const promptStyle = document.getElementById("prompt-builder-style");
    const promptOutput = document.getElementById("prompt-builder-output");
    const cleanPromptText = (value) => String(value || "")
      .replace(/(?:https?|file):\/\/\S+/gi, " ")
      .replace(/[A-Za-z]:\\\S*/g, " ")
      .replaceAll("\\", " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 120);
    const promptRule = (slot) => slot === "background" ? tr("promptRuleBackground")
      : slot === "hero" ? tr("promptRuleHero")
        : slot.startsWith("corner-") ? tr("promptRuleCorner")
          : slot.startsWith("card-") ? tr("promptRuleCard")
            : slot === "launcher-mark" ? tr("promptRuleLauncher") : tr("promptRuleBrand");
    const buildPrompt = () => {
      const slotOption = SLOT_OPTIONS.find(([value]) => value === promptSlot.value) ?? SLOT_OPTIONS[0];
      const subject = cleanPromptText(promptSubject.value) || tr("promptFallbackSubject");
      const style = cleanPromptText(promptStyle.value) || tr("promptFallbackStyle");
      const template = slotOption[0] === "launcher-mark" ? "launcherPromptTemplate" : "promptTemplate";
      promptOutput.value = format(tr(template), tr(slotOption[1]), subject, style, promptRule(slotOption[0]));
      announce(tr("promptBuilt"));
    };
    document.getElementById("prompt-builder-build").addEventListener("click", buildPrompt);
    document.getElementById("prompt-builder-copy").addEventListener("click", async () => {
      if (!promptOutput.value) buildPrompt();
      try {
        await navigator.clipboard.writeText(promptOutput.value);
        announce(tr("copiedPrompt"));
      } catch {
        promptOutput.focus();
        promptOutput.select();
        announce(tr("copyPromptFailed"), "error");
      }
    });

    const requestDelete = (theme, label, opener) => {
      if (!ID_PATTERN.test(theme)) return false;
      showConfirm({
        titleText: format(tr("confirmDeleteTitle"), label), bodyText: tr("confirmDeleteBody"),
        actionText: tr("confirmDeleteAction"), destructive: true, opener,
        callback: () => {
          returnTheme = "default";
          setStatus?.(tr("editorBusy"), "busy");
          send({ type: "delete-user-theme", theme });
        },
      });
      return true;
    };

    applyTranslations();
    fillSelect(document.getElementById("editor-font-ui"), FONT_UI_OPTIONS);
    fillSelect(document.getElementById("editor-font-display"), FONT_DISPLAY_OPTIONS);
    fillSelect(document.getElementById("editor-shadow"), SHADOW_OPTIONS);
    fillSelect(document.getElementById("editor-greeting-font"), GREETING_FONT_OPTIONS);
    fillSelect(document.getElementById("editor-greeting-color"), GREETING_COLOR_OPTIONS);
    fillSelect(document.getElementById("editor-greeting-weight"), GREETING_WEIGHT_OPTIONS);
    fillSelect(document.getElementById("editor-greeting-align"), GREETING_ALIGN_OPTIONS);
    fillSelect(document.getElementById("editor-greeting-decoration"), GREETING_DECORATION_OPTIONS);
    fillSelect(document.getElementById("editor-greeting-mark"), GREETING_MARK_OPTIONS);
    fillSelect(promptSlot, SLOT_OPTIONS);
    buildTokenControls();
    buildPrompt();
    editor.hidden = true;
    navEditor.hidden = true;

    return Object.freeze({
      receive,
      receiveMirror,
      requestDelete,
      translate: tr,
      isActive: () => Boolean(state),
      normalizeEditorState,
      normalizeStudioStyle,
      capabilityRegistry: EDITOR_CAPABILITY_REGISTRY,
    });
  }

  window.CLAUDE_AURA_EDITOR = Object.freeze({
    createController,
    normalizeEditorState,
    normalizeStudioStyle,
    normalizeCapabilityRegistry,
    capabilityRegistry: EDITOR_CAPABILITY_REGISTRY,
  });
})();
