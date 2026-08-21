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
  const INSTANT_PROMPT_ID_PATTERN = /^prompt-[a-f0-9]{32}$/;
  const INSTANT_PROMPT_ICON_PATTERN = /^artwork\/layer-[a-f0-9]{32}\.webp$/;
  const RESPONSIVE_LAYOUT_ID_PATTERN = /^[a-z][a-z0-9-]{0,31}$/;
  const SESSION_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
  const OVERLAY_TOKEN_IDS = Object.freeze(["canvas", "sidebar", "surface", "text", "accent", "border"]);
  const OVERLAY_TARGET_IDS = Object.freeze([
    "interface.theme", "interface.sidebar", "interface.sidebar-identity", "interface.prompt-block", "interface.greeting",
    "background.layer", "widgets.instant-prompts",
  ]);
  const OVERLAY_INTERFACE_ITEMS = Object.freeze([
    "interface.sidebar", "interface.sidebar-identity", "interface.composer", "interface.card", "interface.dialog",
    "interface.canvas", "interface.greeting",
  ]);
  const COLOR_PATTERN = /^#[0-9A-F]{6}$/;
  const LAUNCHER_ASSET_PATTERN = /^(?:assets\/theme-art\/(?:default|japanese-film-editorial|korean-prestige|cartoon-studio|anime-twilight|study-library|japanese-idol|korean-idol)\/launcher-mark\.png|launcher-mark\.png)$/;
  const PREVIEW_PATH_PATTERN = /^\/active\/(?:[a-z0-9][a-z0-9-]{0,63}\/)*[a-z0-9][a-z0-9-]{0,80}\.webp$/;
  const LOADING_MARK_ASSET_PATTERN = /^loading\/mark-[a-f0-9]{64}\.png$/;
  const LOADING_ARTWORK_ASSET_PATTERN = /^loading\/artwork-[a-f0-9]{64}\.webp$/;
  const ACTIONS = new Set([
    "create-theme-copy", "begin-theme-edit", "set-theme-token", "set-theme-layer",
    "enable-responsive-layouts", "mutate-responsive-layout",
    "set-loading-screen", "pick-loading-screen-mark", "pick-loading-screen-artwork", "preview-theme-loading-screen",
    "apply-theme-patch",
    "pick-theme-layer-image", "pick-theme-launcher-mark", "pick-sidebar-identity-mark", "pick-instant-prompt-icon", "remove-theme-layer",
    "move-theme-layer", "undo-theme-edit",
    "redo-theme-edit", "save-theme-edit", "discard-theme-edit", "delete-user-theme",
    "set-greeting-phrases", "reset-greeting",
  ]);
  const THEME_METADATA_LOCALES = Object.freeze([
    Object.freeze({ id: "en", name: "English" }),
    Object.freeze({ id: "hi", name: "हिन्दी" }),
    Object.freeze({ id: "es", name: "Español" }),
    Object.freeze({ id: "fr", name: "Français" }),
    Object.freeze({ id: "id", name: "Bahasa Indonesia" }),
    Object.freeze({ id: "ja", name: "日本語" }),
    Object.freeze({ id: "ko", name: "한국어" }),
    Object.freeze({ id: "pt-BR", name: "Português (Brasil)" }),
    Object.freeze({ id: "de", name: "Deutsch" }),
    Object.freeze({ id: "it", name: "Italiano" }),
    Object.freeze({ id: "vi", name: "Tiếng Việt" }),
    Object.freeze({ id: "pl", name: "Polski" }),
    Object.freeze({ id: "tr", name: "Türkçe" }),
    Object.freeze({ id: "zh-CN", name: "简体中文" }),
    Object.freeze({ id: "zh-HKTW", name: "繁體中文" }),
  ]);
  const THEME_METADATA_LOCALE_IDS = new Set(THEME_METADATA_LOCALES.map(({ id }) => id));
  const MAX_INSTANT_PROMPTS = 12;
  const INSTANT_PROMPT_POSITION_MIN = -50;
  const INSTANT_PROMPT_POSITION_MAX = 50;
  const INSTANT_PROMPT_SCALE_MIN = 0.5;
  const INSTANT_PROMPT_SCALE_MAX = 1.75;
  const defaultInstantPromptLayout = () => ({
    opacity: 1,
    frames: {
      normal: { positionX: 0, positionY: 0, scale: 1 },
      wide: { positionX: 0, positionY: 0, scale: 1 },
    },
  });
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
  const BACKGROUND_SCOPE_IDS = Object.freeze(["sidebar", "content", "full-window"]);
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
  const RESPONSIVE_CLIENT_FIELDS = Object.freeze({
    artwork: Object.freeze(["positionX", "positionY", "focalX", "focalY", "scale"]),
    greeting: Object.freeze(["fontSize", "lineHeight", "maxWidthRatio", "xRatio", "yRatio", "markScale"]),
    prompt: Object.freeze(["widthRatio", "offsetXRatio", "offsetYRatio"]),
    widget: Object.freeze(["positionX", "positionY", "widthRatio", "scale", "offsetX", "offsetY"]),
  });
  const RESPONSIVE_CLIENT_DEFAULTS = Object.freeze({
    artwork: Object.freeze({ positionX: 0, positionY: 0, focalX: 50, focalY: 50, scale: 1 }),
    greeting: Object.freeze({ fontSize: 34, lineHeight: 1.15, maxWidthRatio: 0.72, xRatio: 0, yRatio: 0, markScale: 1 }),
    prompt: Object.freeze({ widthRatio: 0.76, offsetXRatio: 0, offsetYRatio: 0 }),
    widget: Object.freeze({ positionX: 0, positionY: 0, widthRatio: 1, scale: 1, offsetX: 0, offsetY: 0 }),
  });
  const RESPONSIVE_CLIENT_PRECISIONS = Object.freeze({
    artwork: Object.freeze({ positionX: 2, positionY: 2, focalX: 2, focalY: 2, scale: 2 }),
    greeting: Object.freeze({ fontSize: 2, lineHeight: 2, maxWidthRatio: 2, xRatio: 2, yRatio: 2, markScale: 2 }),
    prompt: Object.freeze({ widthRatio: 4, offsetXRatio: 4, offsetYRatio: 4 }),
    widget: Object.freeze({ positionX: 2, positionY: 2, widthRatio: 2, scale: 2, offsetX: 2, offsetY: 2 }),
  });
  const RESPONSIVE_RESOLVER = typeof window.CLAUDE_AURA_RESPONSIVE_RESOLVER_FACTORY === "function"
    ? window.CLAUDE_AURA_RESPONSIVE_RESOLVER_FACTORY()
    : null;

  function resolveResponsiveClientFrame(layouts, frames, viewportWidth, inherited, family) {
    if (!layouts || typeof RESPONSIVE_RESOLVER !== "function"
        || !Object.hasOwn(RESPONSIVE_CLIENT_FIELDS, family)) return null;
    const ids = layouts.sets.map(({ id }) => id);
    const result = RESPONSIVE_RESOLVER(
      {
        mode: layouts.mode,
        widths: layouts.sets.map(({ width }) => width),
        breakpoints: layouts.breakpoints ?? [],
      },
      ids.map((id) => frames?.[id] ?? null),
      viewportWidth,
      { ...RESPONSIVE_CLIENT_DEFAULTS[family], ...(inherited ?? {}) },
      RESPONSIVE_CLIENT_PRECISIONS[family],
    );
    return {
      value: result.value,
      source: result.source,
      lowerId: result.lowerIndex === null ? null : ids[result.lowerIndex],
      upperId: result.upperIndex === null ? null : ids[result.upperIndex],
      t: result.t,
    };
  }
  const CONTRAST_TOKEN_MAP = Object.freeze({
    canvas: ["canvas-text"],
    surface: ["surface-text", "muted-text"],
    text: ["canvas-text", "surface-text", "sidebar-text"],
    accent: ["accent-outline", "accent-text", "focus"],
    sidebar: ["sidebar-text"],
    border: [],
  });
  const CONTRAST_FOCUS_TOKENS = Object.freeze({
    "canvas-text": ["canvas", "text"],
    "surface-text": ["surface", "text"],
    "muted-text": ["surface", "text"],
    "accent-outline": ["accent", "canvas"],
    "accent-text": ["accent"],
    "sidebar-text": ["sidebar", "text"],
    focus: ["accent", "canvas"],
  });
  const BUILTIN_LAYOUT_TARGETS = new Set([
    "interface.prompt-block", "interface.greeting", "background.layer",
  ]);
  const BUILTIN_LAYOUT_LAYER_PROPERTIES = new Set([
    "anchor", "focalX", "focalY", "positionX", "positionY", "scale",
  ]);
  const BUILTIN_LAYOUT_PROMPT_TOKENS = new Set(Object.values(STAGE_PROMPT_TOKENS));
  const BUILTIN_LAYOUT_MESSAGES = new Set([
    "begin-theme-edit", "apply-theme-patch", "undo-theme-edit", "redo-theme-edit",
    "save-theme-edit", "discard-theme-edit",
  ]);
  const builtInLayoutChangeAllowed = (change) => {
    if (!plainRecord(change)) return false;
    if (change.kind === "token") {
      return change.mode === "shared" && BUILTIN_LAYOUT_PROMPT_TOKENS.has(change.token);
    }
    if (change.kind === "greeting") {
      return ["set-frame", "reset"].includes(change.operation);
    }
    if (change.kind === "layer") {
      return ["normal", "wide"].includes(change.preset)
        && BUILTIN_LAYOUT_LAYER_PROPERTIES.has(change.property);
    }
    return false;
  };

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
  const truncateText = (value, maximum) => {
    const text = String(value);
    if (text.length <= maximum) return text;
    const truncated = text.slice(0, maximum);
    return /[\uD800-\uDBFF]$/u.test(truncated) ? truncated.slice(0, -1) : truncated;
  };
  const format = (template, ...values) => values.reduce(
    (result, value, index) => result.replaceAll(`{${index}}`, String(value)), template);
  const formatBytes = (value) => value >= 1_000_000
    ? `${(value / 1_000_000).toFixed(2)} MB`
    : `${Math.max(0, Math.round(value / 1000))} KB`;

  function normalizeOverlayState(value) {
    if (!exactShape(value, [
      "type", "version", "active", "pending", "session", "revision", "error",
    ]) || value.type !== "aura-editor-overlay-state" || value.version !== 1
        || typeof value.active !== "boolean" || typeof value.pending !== "boolean"
        || !(value.session === null || (typeof value.session === "string" && SESSION_PATTERN.test(value.session)))
        || !integer(value.revision, -1, 2147483647)
        || !(value.error === null || ["unavailable", "injection-failed"].includes(value.error))
        || (value.active && (value.session === null || value.revision < 0))) return null;
    return {
      active: value.active,
      pending: value.pending,
      session: value.session,
      revision: value.revision,
      failure: value.error,
    };
  }

  function normalizeOverlaySelection(value) {
    if (!exactShape(value, [
      "status", "kind", "targetId", "itemId", "tokenIds", "rect", "viewport", "geometry",
    ]) || !enumValue(value.status, ["found", "missing", "ambiguous"])
        || !enumValue(value.kind, ["interface", "background", "widget"])
        || !OVERLAY_TARGET_IDS.includes(value.targetId)
        || !Array.isArray(value.tokenIds) || value.tokenIds.length > 6
        || new Set(value.tokenIds).size !== value.tokenIds.length
        || value.tokenIds.some((token) => !OVERLAY_TOKEN_IDS.includes(token))
        || !exactShape(value.viewport, ["width", "height", "frame"])
        || !integer(value.viewport.width, 1, 10000)
        || !integer(value.viewport.height, 1, 10000)
        || typeof value.viewport.frame !== "string"
        || !RESPONSIVE_LAYOUT_ID_PATTERN.test(value.viewport.frame)) return null;
    const typedTarget = value.kind === "interface"
      ? ["interface.theme", "interface.sidebar", "interface.sidebar-identity", "interface.prompt-block", "interface.greeting"].includes(value.targetId)
      : value.kind === "background"
        ? value.targetId === "background.layer"
        : value.targetId === "widgets.instant-prompts";
    if (!typedTarget) return null;
    if (value.status !== "found") {
      return value.itemId === null && value.rect === null && value.geometry === null
        ? {
          status: value.status,
          kind: value.kind,
          targetId: value.targetId,
          itemId: null,
          tokenIds: [...value.tokenIds],
          rect: null,
          viewport: { ...value.viewport },
          geometry: null,
        }
        : null;
    }
    if (!exactShape(value.rect, ["left", "top", "width", "height"])
        || !inRange(value.rect.left, -10000, 10000)
        || !inRange(value.rect.top, -10000, 10000)
        || !inRange(value.rect.width, 0.01, 10000)
        || !inRange(value.rect.height, 0.01, 10000)) return null;
    if (value.kind === "interface") {
      const greeting = value.targetId === "interface.greeting";
      if (!["interface.theme", "interface.sidebar", "interface.sidebar-identity", "interface.prompt-block", "interface.greeting"].includes(value.targetId)
          || !OVERLAY_INTERFACE_ITEMS.includes(value.itemId)
          || (value.targetId === "interface.sidebar" && value.itemId !== "interface.sidebar")
          || (value.targetId === "interface.sidebar-identity" && value.itemId !== "interface.sidebar-identity")
          || (value.targetId === "interface.prompt-block" && value.itemId !== "interface.composer")
          || (value.targetId === "interface.theme"
            && !["interface.card", "interface.dialog", "interface.canvas"].includes(value.itemId))
          || (greeting && value.itemId !== "interface.greeting")
          || (!greeting && value.itemId === "interface.greeting")) return null;
      if (greeting) {
        if (!exactShape(value.geometry, [
          "appearance", "frame", "fontSize", "lineHeight", "maxWidthRatio",
          "xRatio", "yRatio", "markScale",
        ])
            || !enumValue(value.geometry.appearance, ["light", "dark"])
            || typeof value.geometry.frame !== "string"
            || !RESPONSIVE_LAYOUT_ID_PATTERN.test(value.geometry.frame)
            || !inRange(value.geometry.fontSize, 24, 72)
            || !inRange(value.geometry.lineHeight, 0.9, 1.5)
            || !inRange(value.geometry.maxWidthRatio, 0.35, 0.9)
            || !inRange(value.geometry.xRatio, -0.45, 0.45)
            || !inRange(value.geometry.yRatio, -0.4, 0.45)
            || !inRange(value.geometry.markScale, 0.5, 1.5)) return null;
      } else if (value.geometry !== null) return null;
    } else {
      const background = value.kind === "background";
      if ((background && (value.targetId !== "background.layer" || !LAYER_ID_PATTERN.test(value.itemId)))
          || (!background && (value.targetId !== "widgets.instant-prompts"
            || !INSTANT_PROMPT_ID_PATTERN.test(value.itemId)))
          || !exactShape(value.geometry, ["opacity", "frame", "positionX", "positionY", "scale"])
          || !inRange(value.geometry.opacity, 0, 1)
          || typeof value.geometry.frame !== "string"
          || !RESPONSIVE_LAYOUT_ID_PATTERN.test(value.geometry.frame)
          || !inRange(value.geometry.positionX, background ? -100 : -50, background ? 100 : 50)
          || !inRange(value.geometry.positionY, background ? -100 : -50, background ? 100 : 50)
          || !inRange(value.geometry.scale, background ? 0.25 : 0.5, background ? 3 : 1.75)) return null;
    }
    return {
      status: value.status,
      kind: value.kind,
      targetId: value.targetId,
      itemId: value.itemId,
      tokenIds: [...value.tokenIds],
      rect: { ...value.rect },
      viewport: { ...value.viewport },
      geometry: value.geometry ? { ...value.geometry } : null,
    };
  }

  function normalizeOverlayMessage(value) {
    if (!exactShape(value, ["type", "version", "session", "revision", "event", "selection"])
        || value.type !== "aura-editor-overlay" || value.version !== 1
        || typeof value.session !== "string" || !SESSION_PATTERN.test(value.session)
        || !integer(value.revision, 0, 2147483647)
        || !enumValue(value.event, ["selection", "preview", "commit"])) return null;
    const selection = normalizeOverlaySelection(value.selection);
    if (!selection || (["preview", "commit"].includes(value.event)
        && (selection.status !== "found"
          || (!["background", "widget"].includes(selection.kind)
            && selection.targetId !== "interface.greeting")))) return null;
    return {
      session: value.session,
      revision: value.revision,
      event: value.event,
      selection,
    };
  }

  const CAPABILITY_BRANCHES = Object.freeze(["interface", "background", "widgets"]);
  const REGISTERED_VIEW_IDS = Object.freeze(["new-chat", "conversation", "code"]);
  const CAPABILITY_VIEWS = Object.freeze(["new-chat", "conversation"]);
  const CAPABILITY_AXES = Object.freeze(["appearance", "view", "frame"]);
  const CAPABILITY_CAPTURE_GEOMETRY = Object.freeze([
    "none", "full-canvas", "new-chat-area", "artwork-layer", "local-preview",
  ]);
  const CAPABILITY_SELECTION_BEHAVIOR = Object.freeze([
    "picker", "stage-prompt", "stage-greeting", "stage-layer", "stage-instant-prompt",
  ]);
  const CAPABILITY_TARGETS = Object.freeze({
    "interface.theme": Object.freeze({ branch: "interface", surfaceId: "overall", labelKey: "targetOverallInterface" }),
    "interface.sidebar": Object.freeze({ branch: "interface", surfaceId: "sidebar", labelKey: "targetSidebar" }),
    "interface.sidebar-identity": Object.freeze({ branch: "interface", surfaceId: "sidebar-identity", labelKey: "targetSidebarIdentity" }),
    "interface.prompt-block": Object.freeze({ branch: "interface", surfaceId: "prompt-block", labelKey: "targetPromptBlock" }),
    "interface.greeting": Object.freeze({ branch: "interface", surfaceId: "greeting", labelKey: "targetGreeting" }),
    "background.layer": Object.freeze({ branch: "background", surfaceId: "background-layer", labelKey: "targetBackgroundLayer" }),
    "widgets.app-identity": Object.freeze({ branch: "widgets", surfaceId: "aura-launcher", labelKey: "targetAppIdentity" }),
    "widgets.loading-screen": Object.freeze({ branch: "widgets", surfaceId: "loading-screen", labelKey: "loadingScreenTitle" }),
    "widgets.instant-prompts": Object.freeze({ branch: "widgets", surfaceId: "quick-prompts", labelKey: "instantPromptsTitle" }),
  });

  function normalizeCapabilityRegistry(value) {
    if (!Array.isArray(value) || value.length !== Object.keys(CAPABILITY_TARGETS).length) return null;
    const normalized = [];
    const ids = new Set();
    for (const entry of value) {
      if (!exactShape(entry, [
        "id", "surfaceId", "branch", "views", "axes", "captureGeometry", "selectionBehavior",
      ]) || !Object.hasOwn(CAPABILITY_TARGETS, entry.id)
          || CAPABILITY_TARGETS[entry.id].branch !== entry.branch
          || CAPABILITY_TARGETS[entry.id].surfaceId !== entry.surfaceId
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
        surfaceId: entry.surfaceId,
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
      surfaceId: "overall",
      branch: "interface",
      views: ["new-chat", "conversation"],
      axes: ["appearance"],
      captureGeometry: "none",
      selectionBehavior: "picker",
    },
    {
      id: "interface.sidebar",
      surfaceId: "sidebar",
      branch: "interface",
      views: ["new-chat", "conversation"],
      axes: ["appearance"],
      captureGeometry: "full-canvas",
      selectionBehavior: "picker",
    },
    {
      id: "interface.sidebar-identity",
      surfaceId: "sidebar-identity",
      branch: "interface",
      views: ["new-chat", "conversation"],
      axes: ["appearance"],
      captureGeometry: "local-preview",
      selectionBehavior: "picker",
    },
    {
      id: "interface.prompt-block",
      surfaceId: "prompt-block",
      branch: "interface",
      views: ["new-chat", "conversation"],
      axes: ["appearance", "frame"],
      captureGeometry: "new-chat-area",
      selectionBehavior: "stage-prompt",
    },
    {
      id: "interface.greeting",
      surfaceId: "greeting",
      branch: "interface",
      views: ["new-chat"],
      axes: ["appearance", "frame"],
      captureGeometry: "new-chat-area",
      selectionBehavior: "stage-greeting",
    },
    {
      id: "background.layer",
      surfaceId: "background-layer",
      branch: "background",
      views: ["new-chat", "conversation"],
      axes: ["appearance", "view", "frame"],
      captureGeometry: "artwork-layer",
      selectionBehavior: "stage-layer",
    },
    {
      id: "widgets.app-identity",
      surfaceId: "aura-launcher",
      branch: "widgets",
      views: ["new-chat", "conversation"],
      axes: [],
      captureGeometry: "local-preview",
      selectionBehavior: "picker",
    },
    {
      id: "widgets.instant-prompts",
      surfaceId: "quick-prompts",
      branch: "widgets",
      views: ["new-chat"],
      axes: ["appearance", "view"],
      captureGeometry: "new-chat-area",
      selectionBehavior: "stage-instant-prompt",
    },
    {
      id: "widgets.loading-screen",
      surfaceId: "loading-screen",
      branch: "widgets",
      views: ["new-chat", "conversation"],
      axes: ["appearance"],
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

  function normalizeLoadingScreen(value) {
    if (!plainRecord(value) || typeof value.mode !== "string") return null;
    if (value.mode === "inherit") return exactShape(value, ["mode"]) ? { mode: "inherit" } : null;
    if (value.mode !== "custom"
        || !exactShape(value, ["mode", "layout", "motif", "mark", "progress", "light", "dark"])
        || !enumValue(value.layout, ["centered", "split"])
        || !enumValue(value.motif, [
          "inherit", "none", "orbit", "editorial-rule", "facet", "ink-frame",
          "horizon", "folio", "ribbon", "capsule",
        ])
        || !exactShape(value.mark, ["source", "asset", "size"])
        || !enumValue(value.mark.source, ["theme", "custom", "none"])
        || !integer(value.mark.size, 48, 112)
        || !exactShape(value.progress, ["style", "motion"])
        || !enumValue(value.progress.style, ["bar", "pulse"])
        || !enumValue(value.progress.motion, ["calm", "still"])) return null;
    if (value.mark.source === "custom") {
      if (typeof value.mark.asset !== "string" || !LOADING_MARK_ASSET_PATTERN.test(value.mark.asset)) return null;
    } else if (value.mark.asset !== null) return null;
    const normalizeAppearance = (appearance) => {
      if (!exactShape(appearance, [
        "background", "surface", "text", "accent", "accentText", "border", "artwork",
      ])) return null;
      for (const key of ["background", "surface", "text", "accent", "accentText", "border"]) {
        if (typeof appearance[key] !== "string" || !COLOR_PATTERN.test(appearance[key])) return null;
      }
      let artwork = null;
      if (appearance.artwork !== null) {
        if (!exactShape(appearance.artwork, ["asset", "opacity", "fit", "focalX", "focalY"])
            || typeof appearance.artwork.asset !== "string"
            || !LOADING_ARTWORK_ASSET_PATTERN.test(appearance.artwork.asset)
            || !inRange(appearance.artwork.opacity, 0, 0.65)
            || !enumValue(appearance.artwork.fit, ["cover", "contain"])
            || !integer(appearance.artwork.focalX, 0, 100)
            || !integer(appearance.artwork.focalY, 0, 100)) return null;
        artwork = { ...appearance.artwork };
      }
      return { ...appearance, artwork };
    };
    const light = normalizeAppearance(value.light);
    const dark = normalizeAppearance(value.dark);
    return light && dark ? {
      mode: "custom",
      layout: value.layout,
      motif: value.motif,
      mark: { ...value.mark },
      progress: { ...value.progress },
      light,
      dark,
    } : null;
  }

  function normalizeLoadingAssetPreviews(value) {
    if (!exactShape(value, ["mark", "lightArtwork", "darkArtwork"])) return null;
    const result = {};
    for (const [key, kind, extension] of [
      ["mark", "mark", "png"],
      ["lightArtwork", "artwork", "webp"],
      ["darkArtwork", "artwork", "webp"],
    ]) {
      const candidate = value[key];
      if (candidate === null) {
        result[key] = null;
        continue;
      }
      if (typeof candidate !== "string" || candidate.length > 320) return null;
      try {
        const url = new URL(candidate);
        const match = new RegExp(`^/active/loading-${kind}-([a-f0-9]{64})\\.${extension}$`).exec(url.pathname);
        if (url.origin !== "https://aura.editor" || url.username || url.password
            || !match || url.search !== `?v=${match[1]}` || url.hash) return null;
        result[key] = url.href;
      } catch { return null; }
    }
    return result;
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

  function normalizeResponsiveLayouts(value) {
    if (value === null) return null;
    if (!exactShape(value, ["mode", "axis", "sets", "breakpoints"])
        || !enumValue(value.mode, ["step", "fluid"]) || value.axis !== "width"
        || !Array.isArray(value.sets) || value.sets.length < 1 || value.sets.length > 6) return undefined;
    const sets = [];
    for (let index = 0; index < value.sets.length; index += 1) {
      const set = value.sets[index];
      if (!exactShape(set, ["id", "label", "width", "height"])
          || !RESPONSIVE_LAYOUT_ID_PATTERN.test(set.id)
          || !safeText(set.label, 40)
          || !integer(set.width, 920, 3840) || !integer(set.height, 620, 2400)
          || (index && set.width <= value.sets[index - 1].width)) return undefined;
      sets.push({ ...set, label: set.label.trim() });
    }
    if (new Set(sets.map(({ id }) => id)).size !== sets.length) return undefined;
    if (value.mode === "fluid") {
      return value.breakpoints === null
        ? { mode: "fluid", axis: "width", sets, breakpoints: null }
        : undefined;
    }
    if (!Array.isArray(value.breakpoints) || value.breakpoints.length !== sets.length - 1) return undefined;
    for (let index = 0; index < value.breakpoints.length; index += 1) {
      if (!inRange(value.breakpoints[index], sets[index].width, sets[index + 1].width)
          || value.breakpoints[index] === sets[index].width
          || value.breakpoints[index] === sets[index + 1].width
          || (index && value.breakpoints[index] <= value.breakpoints[index - 1])) return undefined;
    }
    return { mode: "step", axis: "width", sets, breakpoints: [...value.breakpoints] };
  }

  function normalizeGreeting(value, responsiveLayouts = null) {
    const stateKeys = responsiveLayouts
      ? [...GREETING_STATE_KEYS, "responsive", "explicitFrames"]
      : GREETING_STATE_KEYS;
    if (!exactShape(value, stateKeys)
        || typeof value.native !== "boolean"
        || typeof value.compactMarkAvailable !== "boolean"
        || (responsiveLayouts && value.responsive !== true)
        || !exactShape(value.frames, ["light", "dark"])) return null;
    const frames = {};
    const frameIds = responsiveLayouts
      ? responsiveLayouts.sets.map(({ id }) => id)
      : ["standard", "wide"];
    const explicitFrames = responsiveLayouts ? {} : null;
    if (responsiveLayouts && !exactShape(value.explicitFrames, ["light", "dark"])) return null;
    for (const appearance of ["light", "dark"]) {
      if (!exactShape(value.frames[appearance], frameIds)) return null;
      frames[appearance] = {};
      for (const frame of frameIds) {
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
      if (responsiveLayouts) {
        if (!plainRecord(value.explicitFrames[appearance])
            || Object.keys(value.explicitFrames[appearance]).some((id) => !frameIds.includes(id))) return null;
        explicitFrames[appearance] = {};
        for (const [id, leaf] of Object.entries(value.explicitFrames[appearance])) {
          if (!plainRecord(leaf) || Object.keys(leaf).length === 0
              || Object.keys(leaf).some((field) => !RESPONSIVE_CLIENT_FIELDS.greeting.includes(field))) return null;
          for (const [field, frameValue] of Object.entries(leaf)) {
            const bounds = GREETING_NUMERIC_FIELDS[field];
            if (!bounds || !inRange(frameValue, bounds[0], bounds[1])) return null;
          }
          explicitFrames[appearance][id] = { ...leaf };
        }
      }
    }
    return {
      native: value.native,
      compactMarkAvailable: value.compactMarkAvailable,
      ...(responsiveLayouts ? { responsive: true, explicitFrames } : {}),
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

  const GREETING_SOURCE_CHOICES = new Set(["claude", "custom", "disabled"]);

  const greetingSourceChoice = (personal) => {
    if (!personal?.enabled) return "disabled";
    return personal.source === "custom" ? "custom" : "claude";
  };

  const greetingPreferencesForSourceChoice = (personal, choice) => {
    if (!personal || !GREETING_SOURCE_CHOICES.has(choice)) return null;
    return {
      ...personal,
      enabled: choice !== "disabled",
      source: choice === "disabled" ? "custom" : choice,
      shuffle: null,
    };
  };

  const greetingThemeOverrideFor = (personal, themeId) => {
    const overrides = personal?.themeOverrides;
    return overrides && Object.hasOwn(overrides, themeId)
      ? overrides[themeId]
      : { mode: "global", phrases: [] };
  };

  const greetingMutationResult = (request, response) => {
    if (!request || !response
        || response.lastAction !== request.type
        || response.session !== request.session
        || !Number.isSafeInteger(request.revision)) return "waiting";
    if (response.actionSucceeded !== false) {
      return response.revision === request.revision + 1 ? "succeeded" : "waiting";
    }
    if (response.revision === request.revision
        || response.revision === request.revision + 1) return "failed";
    return "waiting";
  };

  const sameMutationRequest = (left, right) => Boolean(left && right
    && left.type === right.type
    && left.session === right.session
    && left.revision === right.revision);

  const greetingResyncCaughtUp = (request, response, localGreeting) => {
    if (!request || !response) return false;
    if (greetingMutationResult(request, response) === "succeeded") return true;
    // A full editor Reset must never be inferred from coincidentally equal
    // greeting data: it also replaces theme and metadata state.
    if (request.type === "begin-theme-edit" && request.reset === true) return false;
    if (request.type === "reset-greeting"
        && response.revision > request.revision
        && response.shared?.greeting?.native
        && response.greetingPreferences?.enabled
        && response.greetingPreferences?.source === "claude") return true;
    return Boolean(localGreeting
      && JSON.stringify(localGreeting) === JSON.stringify(response.greetingPreferences));
  };

  const patchResyncDecision = (request, response, retryAvailable) => {
    if (!request || !response || response.session !== request.session
        || !Number.isSafeInteger(request.revision)
        || response.revision < request.revision) return "waiting";
    const result = greetingMutationResult(request, response);
    if (result === "succeeded") return "succeeded";
    if (result === "failed") {
      return response.revision === request.revision + 1
        ? "failed-persisted"
        : "failed-not-applied";
    }
    if (response.revision === request.revision) {
      return retryAvailable ? "retry" : "defer";
    }
    return "uncertain";
  };

  function normalizeShared(value, responsiveLayouts = null) {
    const keys = ["fontUi", "fontDisplay", "radius", "blur", "shadow", "backgroundScope", "prompt", "greeting", "inherited"];
    const inheritedKeys = ["fontUi", "fontDisplay", "radius", "shadow"];
    if (!exactShape(value, keys) || !exactShape(value.prompt, ["native", "width", "x", "y"])
        || !exactShape(value.inherited, inheritedKeys)
        || inheritedKeys.some((key) => typeof value.inherited[key] !== "boolean")) return null;
    const greeting = normalizeGreeting(value.greeting, responsiveLayouts);
    if (!greeting || !enumValue(value.fontUi, FONT_UI_IDS) || !enumValue(value.fontDisplay, FONT_DISPLAY_IDS)
        || !inRange(value.radius, 0, 32) || !inRange(value.blur, 0, 40)
        || !enumValue(value.shadow, SHADOW_IDS) || !enumValue(value.backgroundScope, BACKGROUND_SCOPE_IDS)
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

  function normalizeIdentityPreviewUrl(value) {
    if (value === null) return null;
    if (typeof value !== "string") return undefined;
    return /^https:\/\/aura\.editor\/active\/identity-[a-f0-9]{64}\.png$/.test(value)
      ? value
      : undefined;
  }

  const INTERFACE_SURFACE_CLIENT_SPECS = Object.freeze({
    sidebar: Object.freeze({
      base: Object.freeze({
        surface: ["color"], primaryText: ["color"], secondaryText: ["color"], selectedSurface: ["color"],
        indicator: ["color"], font: ["enum", FONT_UI_IDS], primaryActionSurface: ["color"],
        primaryActionForeground: ["color"], rowHoverSurface: ["color"], rowPressedSurface: ["color"],
        selectedRowSurface: ["color"], sectionLabel: ["color"], sectionRule: ["color"], footerSurface: ["color"],
        rowRadius: ["number", 0, 28], spacing: ["enum", ["compact", "comfortable"]],
      }),
      appearance: true,
    }),
    sidebarIdentity: Object.freeze({
      base: Object.freeze({
        mode: ["enum", ["native", "inherited-builtin", "styled-label", "local-mark"]],
        font: ["enum", FONT_DISPLAY_IDS], weight: ["enum", GREETING_WEIGHT_IDS],
        fontSize: ["number", 12, 32], letterSpacing: ["number", -0.08, 0.2], color: ["color"],
        markSize: ["number", 24, 72], markTreatment: ["enum", ["original", "foreground", "accent"]],
        markDigest: ["digest"],
      }),
      appearance: true,
    }),
    promptBlock: Object.freeze({
      base: Object.freeze({
        surface: ["color"], foreground: ["color"], placeholder: ["color"], border: ["color"], focus: ["color"],
        font: ["enum", FONT_UI_IDS], radius: ["number", 0, 40], borderWidth: ["number", 0, 3],
        blurPx: ["number", 0, 32], shadow: ["enum", SHADOW_IDS],
        editorInset: ["enum", ["transparent", "compact", "comfortable"]], toolbarSurface: ["color"],
        controlForeground: ["color"], controlResting: ["color"], controlHover: ["color"],
        controlPressed: ["color"], controlSelected: ["color"], controlDisabled: ["color"],
      }),
      appearance: true,
      frame: Object.freeze({
        widthRatio: ["number", 0.4, 0.96], offsetXRatio: ["number", -0.35, 0.35],
        offsetYRatio: ["number", -0.3, 0.3],
      }),
    }),
  });
  const SURFACE_CONTROL_DEFS = Object.freeze({
    sidebar: Object.freeze([
      ["surface", "sidebarSurface", "color"],
      ["primaryText", "sidebarPrimaryLabel", "color"],
      ["secondaryText", "sidebarSecondaryLabel", "color", true],
      ["selectedSurface", "sidebarSelectedSurface", "color", true],
      ["indicator", "sidebarSelectionIndicator", "color", true],
      ["font", "interfaceFont", "select", false, [
        ["system-sans", "fontSystemSans"], ["humanist-sans", "fontHumanistSans"], ["rounded-sans", "fontRoundedSans"],
      ]],
      ["primaryActionSurface", "sidebarPrimaryActionSurface", "color", true],
      ["primaryActionForeground", "sidebarPrimaryActionText", "color", true],
      ["rowHoverSurface", "sidebarRowHover", "color", true],
      ["rowPressedSurface", "sidebarRowPressed", "color", true],
      ["selectedRowSurface", "sidebarSelectedRow", "color", true],
      ["sectionLabel", "sidebarSectionLabel", "color", true],
      ["sectionRule", "sidebarSectionRule", "color", true],
      ["footerSurface", "sidebarFooterSurface", "color", true],
      ["rowRadius", "sidebarRowRadius", "number", false, [0, 28, 1]],
      ["spacing", "sidebarSpacing", "select", false, [["compact", "spacingCompact"], ["comfortable", "spacingComfortable"]]],
    ]),
    sidebarIdentity: Object.freeze([
      ["mode", "identityMode", "select", false, [
        ["native", "identityNative"], ["inherited-builtin", "identityInheritedBuiltIn"],
        ["styled-label", "identityStyledLabel"], ["local-mark", "identityLocalMark"],
      ]],
      ["font", "identityFont", "select", false, [
        ["system-sans", "fontSystemSans"], ["humanist-sans", "fontHumanistSans"],
        ["rounded-sans", "fontRoundedSans"], ["editorial-serif", "fontEditorialSerif"],
      ]],
      ["weight", "identityWeight", "select", true, [300, 400, 500, 600, 650, 700].map((value) => [value, String(value)])],
      ["fontSize", "identitySize", "number", false, [12, 32, 1]],
      ["letterSpacing", "identityTracking", "number", true, [-0.08, 0.2, 0.005]],
      ["color", "identityColor", "color"],
      ["markSize", "identityMarkSize", "number", false, [24, 72, 1]],
      ["markTreatment", "identityMarkTreatment", "select", true, [
        ["original", "treatmentOriginal"], ["foreground", "treatmentForeground"], ["accent", "treatmentAccent"],
      ]],
    ]),
    promptBlock: Object.freeze([
      ["surface", "promptSurface", "color"],
      ["foreground", "promptForeground", "color"],
      ["placeholder", "promptPlaceholder", "color", true],
      ["border", "promptBorder", "color"],
      ["focus", "promptFocus", "color", true],
      ["font", "interfaceFont", "select", false, [
        ["system-sans", "fontSystemSans"], ["humanist-sans", "fontHumanistSans"], ["rounded-sans", "fontRoundedSans"],
      ]],
      ["radius", "cornerRadius", "number", false, [0, 40, 1]],
      ["borderWidth", "promptBorderWidth", "number", true, [0, 3, 0.5]],
      ["blurPx", "surfaceBlur", "number", true, [0, 32, 1]],
      ["shadow", "softShadow", "select", false, [["none", "shadowNone"], ["soft", "shadowSoft"], ["elevated", "shadowElevated"]]],
      ["editorInset", "promptEditorInset", "select", true, [
        ["transparent", "insetTransparent"], ["compact", "spacingCompact"], ["comfortable", "spacingComfortable"],
      ]],
      ["toolbarSurface", "promptToolbarSurface", "color", true],
      ["controlForeground", "promptControlForeground", "color", true],
      ["controlResting", "promptControlResting", "color", true],
      ["controlHover", "promptControlHover", "color", true],
      ["controlPressed", "promptControlPressed", "color", true],
      ["controlSelected", "promptControlSelected", "color", true],
      ["controlDisabled", "promptControlDisabled", "color", true],
    ]),
  });

  const normalizeInterfaceLeaf = (value, fields) => {
    if (!plainRecord(value) || Object.keys(value).length === 0
        || Object.keys(value).some((key) => !Object.hasOwn(fields, key))) return null;
    const result = Object.create(null);
    for (const [key, fieldValue] of Object.entries(value)) {
      const [kind, constraint, maximum] = fields[key];
      if (kind === "color") {
        if (typeof fieldValue !== "string" || !COLOR_PATTERN.test(fieldValue)) return null;
      } else if (kind === "digest") {
        if (typeof fieldValue !== "string" || !/^[a-f0-9]{64}$/.test(fieldValue)) return null;
      } else if (kind === "enum") {
        if (!constraint.includes(fieldValue)) return null;
      } else if (!inRange(fieldValue, constraint, maximum)) return null;
      result[key] = fieldValue;
    }
    return result;
  };

  function normalizeInterfaceSurfaces(value, responsiveLayouts = null) {
    if (value === null) return null;
    if (!plainRecord(value) || Object.keys(value).length === 0
        || Object.keys(value).some((key) => !Object.hasOwn(INTERFACE_SURFACE_CLIENT_SPECS, key))) return undefined;
    const result = Object.create(null);
    for (const [surfaceId, wrapper] of Object.entries(value)) {
      const spec = INTERFACE_SURFACE_CLIENT_SPECS[surfaceId];
      if (!plainRecord(wrapper) || Object.keys(wrapper).length === 0
          || Object.keys(wrapper).some((slot) => !["base", "appearance", "frame"].includes(slot))) return undefined;
      const normalized = Object.create(null);
      if (Object.hasOwn(wrapper, "base")) {
        normalized.base = normalizeInterfaceLeaf(wrapper.base, spec.base);
        if (!normalized.base) return undefined;
      }
      if (Object.hasOwn(wrapper, "appearance")) {
        if (!spec.appearance || !plainRecord(wrapper.appearance) || Object.keys(wrapper.appearance).length === 0
            || Object.keys(wrapper.appearance).some((axis) => !["light", "dark"].includes(axis))) return undefined;
        normalized.appearance = Object.create(null);
        for (const [axis, leaf] of Object.entries(wrapper.appearance)) {
          normalized.appearance[axis] = normalizeInterfaceLeaf(leaf, spec.base);
          if (!normalized.appearance[axis]) return undefined;
        }
      }
      if (Object.hasOwn(wrapper, "frame")) {
        const frameIds = responsiveLayouts
          ? responsiveLayouts.sets.map(({ id }) => id)
          : ["standard", "wide"];
        if (!spec.frame || !plainRecord(wrapper.frame) || Object.keys(wrapper.frame).length === 0
            || Object.keys(wrapper.frame).some((axis) => !frameIds.includes(axis))) return undefined;
        normalized.frame = Object.create(null);
        for (const [axis, leaf] of Object.entries(wrapper.frame)) {
          normalized.frame[axis] = normalizeInterfaceLeaf(leaf, spec.frame);
          if (!normalized.frame[axis]) return undefined;
        }
      }
      result[surfaceId] = normalized;
    }
    return result;
  }

  function normalizeLayerFilters(value) {
    if (value === null) return null;
    const ranges = Object.freeze({
      hueDeg: [-180, 180], saturation: [0, 2], brightness: [0.5, 1.5],
      contrast: [0.5, 1.5], blurPx: [0, 24],
    });
    if (!plainRecord(value) || Object.keys(value).length === 0
        || Object.keys(value).some((key) => !Object.hasOwn(ranges, key))) return undefined;
    const result = Object.create(null);
    for (const [key, filterValue] of Object.entries(value)) {
      if (!inRange(filterValue, ...ranges[key])) return undefined;
      result[key] = filterValue;
    }
    return result;
  }

  function normalizeFrame(value) {
    const keys = ["anchor", "focalX", "focalY", "positionX", "positionY", "scale"];
    if (!exactShape(value, keys) || !enumValue(value.anchor, ANCHOR_IDS)
        || !inRange(value.focalX, 0, 100) || !inRange(value.focalY, 0, 100)
        || !inRange(value.positionX, -100, 100) || !inRange(value.positionY, -100, 100)
        || !inRange(value.scale, 0.25, 3)) return null;
    return { ...value };
  }

  function normalizeLayer(value, expectedIndex, responsiveLayouts = null) {
    const keys = [
      "id", "index", "role", "appearance", "context", "viewport", "visible", "opacity", "mask", "mobile",
      ...(responsiveLayouts ? ["anchor"] : []), "filters", "bytes", "previewUrl", "frames",
    ];
    if (!exactShape(value, keys) || !LAYER_ID_PATTERN.test(value.id)
        || value.index !== expectedIndex || !integer(value.index, 0, 7)
        || !enumValue(value.role, ROLE_IDS) || !enumValue(value.appearance, APPEARANCE_IDS)
        || !enumValue(value.context, CONTEXT_IDS) || !enumValue(value.viewport, VIEWPORT_IDS)
        || typeof value.visible !== "boolean" || !inRange(value.opacity, 0, 1)
        || !enumValue(value.mask, MASK_IDS) || !enumValue(value.mobile, MOBILE_IDS)
        || (responsiveLayouts && !enumValue(value.anchor, ANCHOR_IDS))
        || !integer(value.bytes, 0, 400_000) || !plainRecord(value.frames)) return null;
    const filters = normalizeLayerFilters(value.filters);
    const previewUrl = normalizePreviewUrl(value.previewUrl);
    if (responsiveLayouts) {
      const frameIds = responsiveLayouts.sets.map(({ id }) => id);
      if (Object.keys(value.frames).some((id) => !frameIds.includes(id))) return null;
      const frames = Object.create(null);
      const ranges = {
        focalX: [0, 100], focalY: [0, 100], positionX: [-100, 100], positionY: [-100, 100], scale: [0.25, 3],
      };
      for (const [id, frame] of Object.entries(value.frames)) {
        if (!plainRecord(frame) || Object.keys(frame).length === 0
            || Object.keys(frame).some((field) => !Object.hasOwn(ranges, field))) return null;
        if (Object.entries(frame).some(([field, frameValue]) => !inRange(frameValue, ...ranges[field]))) return null;
        frames[id] = { ...frame };
      }
      if (filters === undefined || previewUrl === undefined) return null;
      return { ...value, filters, previewUrl, frames };
    }
    if (!exactShape(value.frames, ["normal", "wide"])) return null;
    const normal = normalizeFrame(value.frames.normal);
    const wide = normalizeFrame(value.frames.wide);
    if (filters === undefined || previewUrl === undefined || !normal || !wide) return null;
    return { ...value, filters, previewUrl, frames: { normal, wide } };
  }

  function normalizeMetadata(value) {
    if (!exactShape(value, ["labels", "descriptions"])
        || !plainRecord(value.labels) || !plainRecord(value.descriptions)) return null;
    const locales = Object.keys(value.labels);
    const descriptionLocales = Object.keys(value.descriptions);
    if (!locales.length || locales.length > THEME_METADATA_LOCALES.length
        || !locales.includes("en") || descriptionLocales.length !== locales.length
        || locales.some((locale) => !THEME_METADATA_LOCALE_IDS.has(locale)
          || !Object.hasOwn(value.descriptions, locale))) return null;
    const labels = Object.create(null);
    const descriptions = Object.create(null);
    for (const locale of locales) {
      labels[locale] = safeText(value.labels[locale], 80, { empty: true });
      descriptions[locale] = safeText(value.descriptions[locale], 220, { empty: true });
      if (labels[locale] === null || descriptions[locale] === null
          || /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/u.test(value.labels[locale])
          || /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/u.test(value.descriptions[locale])) return null;
    }
    return { labels, descriptions };
  }

  function normalizeInstantPrompt(value, responsiveLayouts = null) {
    if (!exactShape(value, ["id", "labels", "prompts", "icon", "iconPreviewUrl", "layout"])
        || !INSTANT_PROMPT_ID_PATTERN.test(value.id)
        || !plainRecord(value.labels) || !plainRecord(value.prompts)) return null;
    const locales = Object.keys(value.labels);
    const promptLocales = Object.keys(value.prompts);
    if (!locales.length || locales.length > THEME_METADATA_LOCALES.length
        || !locales.includes("en") || promptLocales.length !== locales.length
        || locales.some((locale) => !THEME_METADATA_LOCALE_IDS.has(locale)
          || !Object.hasOwn(value.prompts, locale))) return null;
    const labels = Object.create(null);
    const prompts = Object.create(null);
    for (const locale of locales) {
      labels[locale] = safeText(value.labels[locale], 48);
      prompts[locale] = safeText(value.prompts[locale], 1200);
      if (!labels[locale] || !prompts[locale]
          || /[\u0000-\u001F\u007F]/u.test(value.labels[locale])
          || /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/u.test(value.prompts[locale])) return null;
    }
    if (value.icon !== null
        && (typeof value.icon !== "string" || !INSTANT_PROMPT_ICON_PATTERN.test(value.icon))) return null;
    const iconPreviewUrl = normalizePreviewUrl(value.iconPreviewUrl);
    if (iconPreviewUrl === undefined || (value.icon === null) !== (iconPreviewUrl === null)) return null;
    if (!exactShape(value.layout, ["opacity", "frames"])
        || !inRange(value.layout.opacity, 0, 1)
        || !plainRecord(value.layout.frames)) return null;
    if (responsiveLayouts) {
      const ids = responsiveLayouts.sets.map(({ id }) => id);
      const ranges = {
        positionX: [INSTANT_PROMPT_POSITION_MIN, INSTANT_PROMPT_POSITION_MAX],
        positionY: [INSTANT_PROMPT_POSITION_MIN, INSTANT_PROMPT_POSITION_MAX],
        widthRatio: [0.5, 1.5], scale: [INSTANT_PROMPT_SCALE_MIN, INSTANT_PROMPT_SCALE_MAX],
        offsetX: [-120, 120], offsetY: [-120, 120],
      };
      if (Object.keys(value.layout.frames).some((id) => !ids.includes(id))) return null;
      const frames = Object.create(null);
      for (const [id, frame] of Object.entries(value.layout.frames)) {
        if (!plainRecord(frame) || Object.keys(frame).length === 0
            || Object.keys(frame).some((field) => !Object.hasOwn(ranges, field))
            || Object.entries(frame).some(([field, frameValue]) => !inRange(frameValue, ...ranges[field]))) return null;
        frames[id] = { ...frame };
      }
      return {
        id: value.id, labels, prompts, icon: value.icon, iconPreviewUrl,
        layout: { opacity: value.layout.opacity, frames },
      };
    }
    if (!exactShape(value.layout.frames, ["normal", "wide"])) return null;
    const normalizeLayoutFrame = (frame) => exactShape(frame, ["positionX", "positionY", "scale"])
      && inRange(frame.positionX, INSTANT_PROMPT_POSITION_MIN, INSTANT_PROMPT_POSITION_MAX)
      && inRange(frame.positionY, INSTANT_PROMPT_POSITION_MIN, INSTANT_PROMPT_POSITION_MAX)
      && inRange(frame.scale, INSTANT_PROMPT_SCALE_MIN, INSTANT_PROMPT_SCALE_MAX)
      ? { positionX: frame.positionX, positionY: frame.positionY, scale: frame.scale }
      : null;
    const normal = normalizeLayoutFrame(value.layout.frames.normal);
    const wide = normalizeLayoutFrame(value.layout.frames.wide);
    if (!normal || !wide) return null;
    return {
      id: value.id,
      labels,
      prompts,
      icon: value.icon,
      iconPreviewUrl,
      layout: { opacity: value.layout.opacity, frames: { normal, wide } },
    };
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
      "launcherStylePreviewUrl", "interfaceSurfaces", "interfaceStyle", "identityPreviewUrl",
      "identityStylePreviewUrl", "responsiveLayouts", "loadingScreen", "loadingScreenStyle",
      "loadingScreenAssets", "loadingScreenStyleAssets", "shared", "greetingPreferences", "instantPrompts", "layers", "feedback",
    ];
    const activeOptional = [...optional, "editKind"];
    if (!exactShape(value, required, activeOptional) || !ID_PATTERN.test(value.id)
        || !ID_PATTERN.test(value.sourceId) || !enumValue(value.source, ["user", "builtin"])
        || typeof value.isNew !== "boolean" || typeof value.session !== "string" || !SESSION_PATTERN.test(value.session)
        || !integer(value.revision, 0, Number.MAX_SAFE_INTEGER) || typeof value.dirty !== "boolean"
        || typeof value.canUndo !== "boolean" || typeof value.canRedo !== "boolean") return undefined;
    const editKind = value.editKind ?? null;
    if (editKind !== null && editKind !== "builtin-layout") return undefined;
    if (editKind === "builtin-layout"
        && (value.source !== "builtin" || value.isNew || value.id !== value.sourceId)) return undefined;
    if (editKind === null && value.source === "builtin" && !value.isNew) return undefined;
    const label = safeText(value.label, 80);
    if (!label || !exactShape(value.tokens, ["light", "dark"])) return undefined;
    const responsiveLayouts = normalizeResponsiveLayouts(value.responsiveLayouts);
    if (responsiveLayouts === undefined) return undefined;
    const loadingScreen = normalizeLoadingScreen(value.loadingScreen);
    const loadingScreenStyle = normalizeLoadingScreen(value.loadingScreenStyle);
    const loadingScreenAssets = normalizeLoadingAssetPreviews(value.loadingScreenAssets);
    const loadingScreenStyleAssets = normalizeLoadingAssetPreviews(value.loadingScreenStyleAssets);
    const metadata = normalizeMetadata(value.metadata);
    const light = normalizeModeTokens(value.tokens.light);
    const dark = normalizeModeTokens(value.tokens.dark);
    const studioStyle = normalizeStudioStyle(value.studioStyle);
    const launcher = normalizeLauncher(value.launcher);
    const launcherStyle = normalizeLauncher(value.launcherStyle);
    const launcherPreviewUrl = normalizeLauncherPreviewUrl(value.launcherPreviewUrl);
    const launcherStylePreviewUrl = normalizeLauncherPreviewUrl(value.launcherStylePreviewUrl);
    const interfaceSurfaces = normalizeInterfaceSurfaces(value.interfaceSurfaces, responsiveLayouts);
    const interfaceStyle = normalizeInterfaceSurfaces(value.interfaceStyle, responsiveLayouts);
    const identityPreviewUrl = normalizeIdentityPreviewUrl(value.identityPreviewUrl);
    const identityStylePreviewUrl = normalizeIdentityPreviewUrl(value.identityStylePreviewUrl);
    const shared = normalizeShared(value.shared, responsiveLayouts);
    const greetingPreferences = normalizeGreetingPreferences(value.greetingPreferences);
    if (!Array.isArray(value.instantPrompts) || value.instantPrompts.length > MAX_INSTANT_PROMPTS) return undefined;
    const instantPrompts = value.instantPrompts.map((prompt) => normalizeInstantPrompt(prompt, responsiveLayouts));
    if (!metadata || !light || !dark || !studioStyle || !launcher || !launcherStyle
        || !launcherPreviewUrl || !launcherStylePreviewUrl
        || interfaceSurfaces === undefined || interfaceStyle === undefined
        || identityPreviewUrl === undefined || identityStylePreviewUrl === undefined
        || !loadingScreen || !loadingScreenStyle || !loadingScreenAssets || !loadingScreenStyleAssets
        || !shared || !greetingPreferences
        || instantPrompts.some((prompt) => !prompt)
        || new Set(instantPrompts.map((prompt) => prompt.id)).size !== instantPrompts.length
        || !Array.isArray(value.layers) || value.layers.length > 8) return undefined;
    const layers = value.layers.map((layer, index) => normalizeLayer(layer, index, responsiveLayouts));
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
      interfaceSurfaces,
      interfaceStyle,
      identityPreviewUrl,
      identityStylePreviewUrl,
      responsiveLayouts,
      loadingScreen,
      loadingScreenStyle,
      loadingScreenAssets,
      loadingScreenStyleAssets,
      shared,
      greetingPreferences,
      instantPrompts,
      layers,
      feedback,
      editKind,
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

  const reconcileDuplicateTokenValue = ({
    key,
    value,
    inFlight,
    confirmedValue,
    queued,
    deferred,
  }) => {
    const duplicate = inFlight
      ? Object.is(inFlight.value, value)
      : Object.is(confirmedValue, value);
    if (!duplicate) return false;
    queued.delete(key);
    deferred?.delete(key);
    return true;
  };

  const backgroundScopeUiActive = (page, builtInLayout) => (
    page === "background" && !builtInLayout
  );

  const inspectorRevealDelta = (rect, visibleTop, visibleBottom) => {
    if (rect.top < visibleTop) return rect.top - visibleTop;
    if (rect.bottom > visibleBottom) return rect.bottom - visibleBottom;
    return 0;
  };

  function createController({
    locale,
    send,
    setStatus,
    translate,
    focusThemeCard,
    getThemeCardPreview,
    openThemeCardPreview,
    hasPersonalWordmark,
    onOrdinaryViewRestore,
    onStudioStyleChange,
  }) {
    const normalizedLocale = Object.hasOwn(STRINGS, locale) ? locale : "en";
    const tr = (key) => STRINGS[normalizedLocale]?.[key] ?? translate?.(key) ?? STRINGS.en?.[key] ?? key;
    const editor = document.getElementById("editor");
    const navEditor = document.getElementById("nav-editor");
  const ordinarySections = ["themes", "pets", "prompt-shelf", "background", "create", "settings"]
      .map((id) => document.getElementById(id));
    const ordinaryLinks = [...document.querySelectorAll(".rail-item")].filter((link) => link !== navEditor);
    const studioShell = document.querySelector(".studio");
    const content = document.querySelector(".content");
    const stageColumn = editor.querySelector(".editor-stagecol");
    const editorControls = editor.querySelector(".editor-controls");
    const title = document.getElementById("editor-title");
    const summary = document.getElementById("editor-summary");
    const builtInAuthoringPill = document.getElementById("editor-built-in-authoring");
    const dirtyPill = document.getElementById("editor-dirty");
    const validPill = document.getElementById("editor-valid");
    const live = document.getElementById("editor-live");
    const errorSummary = document.getElementById("editor-error-summary");
    const tokenGroups = document.getElementById("editor-token-groups");
    const layerList = document.getElementById("editor-layer-list");
    const feedbackRoot = document.getElementById("editor-feedback");
    const quickFeedback = document.getElementById("editor-quick-feedback");
    const inspectorBody = editor.querySelector(".editor-inspector-body");
    const promptContextSection = editor.querySelector(".editor-prompt-context");
    const promptContextUnavailable = editor.querySelector(".editor-prompt-unavailable");
    const confirmDialog = document.getElementById("editor-confirm-dialog");
    const confirmTitle = document.getElementById("editor-confirm-title");
    const confirmBody = document.getElementById("editor-confirm-body");
    const confirmAction = document.getElementById("editor-confirm-action");
    const modeInputs = [...document.querySelectorAll("[data-editor-mode]")];
    const scopeInputs = [...document.querySelectorAll('input[name="background-scope"]')];
    const sharedInputs = [...document.querySelectorAll("[data-editor-shared]")];
    const radiusInput = document.getElementById("editor-radius");
    const inheritedRadiusNote = document.getElementById("editor-radius-inherited");
    const nativePromptNote = document.getElementById("editor-prompt-native");
    const promptResetInheritedButton = document.getElementById("editor-prompt-reset-inherited");
    const launcherInputs = [...document.querySelectorAll("[data-editor-launcher]")];
    const launcherTextInputs = [...document.querySelectorAll("[data-editor-launcher-text]")];
    const launcherPreview = document.getElementById("editor-launcher-preview");
    const launcherMark = document.getElementById("editor-launcher-mark");
    const replaceLauncherMarkButton = document.getElementById("editor-launcher-replace");
    const loadingModeInputs = [...document.querySelectorAll('input[name="loading-screen-mode"]')];
    const loadingSource = document.getElementById("loading-screen-source");
    const loadingCustomControls = document.getElementById("loading-screen-custom-controls");
    const loadingSchematic = document.getElementById("loading-screen-schematic");
    const loadingArtworkPreview = document.getElementById("loading-screen-artwork-preview");
    const loadingMotifPreview = document.getElementById("loading-screen-motif-preview");
    const loadingMarkPreview = document.getElementById("loading-screen-mark-preview");
    const loadingMarkPreviewImage = loadingMarkPreview?.querySelector("img");
    const loadingMarkPreviewFallback = loadingMarkPreview?.querySelector("span");
    const loadingProgressPreview = document.getElementById("loading-screen-progress-preview");
    const loadingLayoutInput = document.getElementById("loading-screen-layout");
    const loadingMotifInput = document.getElementById("loading-screen-motif");
    const loadingMarkSourceInput = document.getElementById("loading-screen-mark-source");
    const loadingMarkSizeInput = document.getElementById("loading-screen-mark-size");
    const loadingMarkSizeOutput = document.getElementById("loading-screen-mark-size-output");
    const loadingProgressStyleInput = document.getElementById("loading-screen-progress-style");
    const loadingProgressMotionInput = document.getElementById("loading-screen-progress-motion");
    const loadingReviewButton = document.getElementById("loading-screen-review");
    const loadingMarkPickButton = document.getElementById("loading-screen-mark-pick");
    const loadingArtworkPickButton = document.getElementById("loading-screen-artwork-pick");
    const loadingArtworkRemoveButton = document.getElementById("loading-screen-artwork-remove");
    const loadingArtworkOpacityInput = document.getElementById("loading-screen-artwork-opacity");
    const loadingArtworkOpacityOutput = document.getElementById("loading-screen-artwork-opacity-output");
    const loadingArtworkFitInput = document.getElementById("loading-screen-artwork-fit");
    const loadingArtworkFocalXInput = document.getElementById("loading-screen-artwork-focal-x");
    const loadingArtworkFocalXOutput = document.getElementById("loading-screen-artwork-focal-x-output");
    const loadingArtworkFocalYInput = document.getElementById("loading-screen-artwork-focal-y");
    const loadingArtworkFocalYOutput = document.getElementById("loading-screen-artwork-focal-y-output");
    const loadingArtworkControls = editor.querySelector(".loading-screen-artwork-controls");
    const loadingColorFields = [];
    const surfaceControlHosts = Object.freeze({
      sidebar: document.getElementById("editor-sidebar-surface-controls"),
      sidebarIdentity: document.getElementById("editor-sidebar-identity-controls"),
      promptBlock: document.getElementById("editor-prompt-surface-controls"),
    });
    const sidebarIdentityPreview = document.querySelector(".editor-sidebar-identity-preview");
    const sidebarIdentityImage = document.getElementById("editor-sidebar-identity-image");
    const sidebarIdentityLabel = document.getElementById("editor-sidebar-identity-label");
    const replaceSidebarIdentityButton = document.getElementById("editor-sidebar-identity-replace");
    const instantPromptList = document.getElementById("editor-instant-prompt-list");
    const instantPromptEmpty = document.getElementById("editor-instant-prompt-empty");
    const addInstantPromptButton = document.getElementById("editor-instant-prompt-add");
    const instantPromptContext = document.getElementById("editor-instant-prompt-context");
    const instantPromptSwitchPreviewButton = document.getElementById("editor-instant-prompt-switch-preview");
    const instantPromptPreviewInputs = [...document.querySelectorAll('input[name="instant-prompt-preview-state"]')];
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
    const greetingSourceInputs = [...document.querySelectorAll('input[name="greeting-source"]')];
    const greetingNameInput = document.getElementById("editor-greeting-name");
    const greetingPhrasesInput = document.getElementById("editor-greeting-phrases");
    const greetingOverrideInput = document.getElementById("editor-greeting-override");
    const greetingOverridePhrasesInput = document.getElementById("editor-greeting-override-phrases");
    const greetingOverridePhrasesField = document.getElementById("editor-greeting-override-phrases-field");
    const greetingPhrasesStatus = document.getElementById("editor-greeting-phrases-status");
    const greetingPersonalSection = editor.querySelector(".editor-greeting-personal");
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
    const metadataLocalesHost = document.getElementById("editor-metadata-locales");
    const metadataLocaleOptions = document.getElementById("editor-language-options");
    const metadataLanguageSelection = document.getElementById("editor-language-selection");
    const metadataInputs = () => [...editor.querySelectorAll("[data-editor-metadata]")];
    const metadataLocaleCheckboxes = () => [...editor.querySelectorAll("[data-editor-metadata-locale]")];
    const workflowTabs = [...document.querySelectorAll("[data-editor-page-target]")];
    const branchTabs = [...document.querySelectorAll("[data-editor-branch-target]")];
    const branchHelp = document.getElementById("editor-branch-help");
    const selectionBar = editor.querySelector(".editor-selection-bar");
    const targetPicker = document.getElementById("editor-target-picker");
    const contextEditing = document.getElementById("editor-context-editing");
    const contextApplies = document.getElementById("editor-context-applies");
    const contextSource = document.getElementById("editor-context-source");
    const contextFrame = document.getElementById("editor-context-frame");
    const contextFrameRow = document.getElementById("editor-context-frame-row");
    const documentDetailsPanel = document.getElementById("editor-document-details");
    const cardPreviewPanel = document.getElementById("editor-card-preview-panel");
    const cardPreviewFrame = document.getElementById("editor-card-preview-frame");
    const cardPreviewImage = document.getElementById("editor-card-preview-image");
    const adjustCardPreviewButton = document.getElementById("editor-adjust-card-preview");
    const reviewPanel = editor.querySelector('[data-editor-workflow-page="review"]');
    const switchSupportedPreviewButton = document.getElementById("editor-switch-supported-preview");
    const stageRoot = document.getElementById("editor-stage");
    const responsiveLayoutPanel = document.getElementById("responsive-layout-panel");
    const responsiveLayoutEnable = document.getElementById("responsive-layout-enable");
    const responsiveLayoutTrack = document.getElementById("responsive-layout-track");
    const responsiveLayoutAdd = document.getElementById("responsive-layout-add");
    const responsiveLayoutStatus = document.getElementById("responsive-layout-status");
    const responsivePreviewing = document.getElementById("responsive-previewing");
    const responsiveEditing = document.getElementById("responsive-editing");
    const responsiveBetween = document.getElementById("responsive-between");
    const responsiveSource = document.getElementById("responsive-source");
    const responsiveLayoutAdvanced = document.getElementById("responsive-layout-advanced");
    const responsiveLayoutName = document.getElementById("responsive-layout-name");
    const responsiveLayoutWidth = document.getElementById("responsive-layout-width");
    const responsiveLayoutHeight = document.getElementById("responsive-layout-height");
    const responsiveLayoutMode = document.getElementById("responsive-layout-mode");
    const responsiveLayoutDuplicate = document.getElementById("responsive-layout-duplicate");
    const responsiveLayoutDelete = document.getElementById("responsive-layout-delete");
    const responsiveTargetReset = document.getElementById("responsive-target-reset");
    const windowEditorPanel = document.querySelector(".window-editor-panel");
    const windowEditButton = document.getElementById("stage-window-edit");
    const windowEditStopButton = document.getElementById("stage-window-edit-stop");
    const windowEditorStatus = document.getElementById("window-editor-status");
    const windowEditorInspector = document.getElementById("window-editor-inspector");
    const windowEditorTarget = document.getElementById("window-editor-target");
    const windowEditorTokens = document.getElementById("window-editor-tokens");
    let state = null;
    let overlayState = null;
    let overlaySelection = null;
    let overlayStartTimer = null;
    let cardPreviewState = null;
    const isBuiltInLayoutEdit = () => state?.editKind === "builtin-layout";
    const targetAllowedInCurrentEdit = (target) => (
      !isBuiltInLayoutEdit() || BUILTIN_LAYOUT_TARGETS.has(target)
    );
    let greetingPreferenceDraft = null;
    let greetingPreferenceDraftDirty = false;
    let greetingPreferenceInputDirty = false;
    let greetingPreferenceInputInvalid = false;
    let greetingPreferenceErrorTarget = null;
    let greetingStyleIntent = null;
    let greetingStyleLocked = false;
    let greetingStageTimer = null;
    let greetingStageRequested = false;
    let greetingResyncPending = null;
    let greetingResyncTimer = null;
    let patchResyncPending = null;
    let patchResyncTimer = null;
    let greetingTimeoutRetries = 0;
    let greetingActionFollowup = null;
    let activeGreetingControlScope = null;
    let greetingMirrorAxesDeferred = false;
    let metadataInputDirty = false;
    let metadataInputInvalid = false;
    let renderedMetadataLocaleSignature = "";
    let selectedMode = "light";
    const syncModeInputs = () => {
      for (const input of modeInputs) input.checked = input.value === selectedMode;
    };
    let selectedLayerId = null;
    let selectedInstantPromptId = null;
    let renderedInstantPromptSignature = null;
    let instantPromptPreviewState = "default";
    let renderedLayerSignature = null;
    let inspectorPage = "interface";
    let inspectorBranch = "interface";
    let inspectorTarget = "interface.theme";
    let inspectorField = null;
    const targetByBranch = {
      interface: "interface.theme",
      background: "background.layer",
      widgets: "widgets.app-identity",
    };
    let stageViewport = "normal";
    let editingLayoutId = null;
    let pendingResponsiveSelectionId = null;
    let stageContext = "new-chat";
    let stageSelection = null;
    let stagePreviewSize = [...STAGE_SIZES.normal];
    let previewSizeIntent = null;
    let pendingAction = null;
    let pendingRequest = null;
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
    const uncertainChanges = new Map();
    let changeFlushTimer = null;
    let inFlightChanges = [];
    let inFlightRevision = null;
    let inFlightSession = null;
    let changeSendRetryCount = 0;
    let patchResponseRetryCount = 0;
    let actionAfterPatch = null;
    const overlayTransportBusy = () => Boolean(
      pendingAction || greetingResyncPending || patchResyncPending
      || coalescedChanges.size || changeFlushTimer || inFlightChanges.length
      || stageKeyTimer || stageKeyPaths.size,
    );
    const hasUnsavedEdits = () => hasUnsavedEditorWork({
      dirty: state?.dirty || greetingPreferenceDraftDirty || greetingPreferenceInputDirty
        || metadataInputDirty,
      deferred: deferredChanges.size + uncertainChanges.size,
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

    const loadingColorDefinitions = Object.freeze([
      ["background", "loadingScreenBackground"],
      ["surface", "loadingScreenSurface"],
      ["text", "loadingScreenText"],
      ["accent", "loadingScreenAccent"],
      ["accentText", "loadingScreenAccentText"],
      ["border", "loadingScreenBorder"],
    ]);
    for (const appearance of ["light", "dark"]) {
      const host = editor.querySelector(`[data-loading-appearance="${appearance}"] .loading-screen-colors`);
      if (!host) continue;
      for (const [property, labelKey] of loadingColorDefinitions) {
        const label = document.createElement("label");
        label.className = "color-field";
        const text = document.createElement("span");
        text.textContent = tr(labelKey);
        const picker = document.createElement("input");
        picker.type = "color";
        picker.dataset.loadingColor = property;
        picker.dataset.loadingAppearance = appearance;
        picker.dataset.editorField = `loadingScreen.${appearance}.${property}`;
        const exact = document.createElement("input");
        exact.type = "text";
        exact.maxLength = 7;
        exact.inputMode = "text";
        exact.spellcheck = false;
        exact.dataset.loadingColorText = property;
        exact.dataset.loadingAppearance = appearance;
        exact.dataset.editorField = `loadingScreen.${appearance}.${property}`;
        exact.setAttribute("aria-label", `${tr(labelKey)} HEX`);
        label.append(text, picker, exact);
        host.append(label);
        loadingColorFields.push({ appearance, property, picker, exact, label });
      }
    }

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
    const isBlockingAction = () => Boolean(patchResyncPending)
      || (Boolean(pendingAction) && pendingAction !== "apply-theme-patch");
    // A host reply can be lost: a stale session, a dropped bridge message, or a state
    // whose lastAction never matches what we sent. Without a watchdog `pendingAction`
    // stays set forever and flushThemeChanges then queues every later edit without ever
    // sending it — the editor looks alive while silently discarding work.
    const PENDING_WATCHDOG_MS = 12000;
    const WATCHDOG_EXEMPT_ACTIONS = new Set([
      "pick-theme-layer-image", "pick-theme-launcher-mark", "pick-sidebar-identity-mark", "pick-instant-prompt-icon",
      "pick-loading-screen-mark", "pick-loading-screen-artwork",
    ]);
    const clearPendingWatchdog = () => {
      if (!pendingWatchdog) return;
      clearTimeout(pendingWatchdog);
      pendingWatchdog = null;
    };
    const setPending = (action = null, request = null) => {
      pendingAction = action;
      pendingRequest = action && request ? { ...request } : null;
      clearPendingWatchdog();
      if (action && !WATCHDOG_EXEMPT_ACTIONS.has(action)) {
        pendingWatchdog = setTimeout(() => {
          pendingWatchdog = null;
          if (!pendingAction) return;
          const timedOutAction = pendingAction;
          const timedOutRequest = pendingRequest;
          const fullReset = timedOutAction === "begin-theme-edit"
            && timedOutRequest?.reset === true;
          if ((["set-greeting-phrases", "reset-greeting"].includes(timedOutAction)
                || fullReset)
              && timedOutRequest) {
            const timeoutMessage = tr(fullReset
              ? "editorActionTimedOut"
              : "greetingActionTimedOut");
            const retry = timedOutAction === "set-greeting-phrases"
              && greetingTimeoutRetries < 1;
            if (retry) greetingTimeoutRetries += 1;
            greetingActionFollowup = null;
            greetingResyncPending = { request: timedOutRequest, retry, fullReset };
            greetingStageRequested = retry;
            setPending(null);
            editor.setAttribute("aria-busy", "true");
            if (!send({ type: "get-state" })) {
              greetingResyncPending = null;
              greetingStageRequested = false;
              editor.setAttribute("aria-busy", "false");
              reflectButtonStates();
            } else {
              if (greetingResyncTimer) clearTimeout(greetingResyncTimer);
              greetingResyncTimer = setTimeout(() => {
                greetingResyncTimer = null;
                if (!greetingResyncPending) return;
                greetingResyncPending = null;
                greetingStageRequested = false;
                editor.setAttribute("aria-busy", "false");
                reflectButtonStates();
                announce(timeoutMessage, "error");
              }, PENDING_WATCHDOG_MS);
            }
            announce(timeoutMessage, "error");
            return;
          }
          if (timedOutAction === "apply-theme-patch") {
            patchResponseRetryCount += 1;
            patchResyncPending = {
              request: timedOutRequest,
              retry: patchResponseRetryCount <= 1,
            };
            setPending(null);
            editor.setAttribute("aria-busy", "true");
            if (!send({ type: "get-state" })) {
              parkUncertainPatch();
            } else {
              if (patchResyncTimer) clearTimeout(patchResyncTimer);
              patchResyncTimer = setTimeout(() => {
                patchResyncTimer = null;
                if (!patchResyncPending) return;
                parkUncertainPatch();
                announce(tr("editorActionTimedOut"), "error");
              }, PENDING_WATCHDOG_MS);
            }
            announce(tr("editorActionTimedOut"), "error");
            return;
          }
          requeueInFlightChanges();
          if (timedOutAction !== "apply-theme-patch") actionAfterPatch = null;
          setPending(null);
          announce(tr("editorActionTimedOut"), "error");
          flushThemeChanges();
        }, PENDING_WATCHDOG_MS);
      }
      const blocking = Boolean(patchResyncPending)
        || (Boolean(action) && action !== "apply-theme-patch");
      editor.setAttribute("aria-busy", String(blocking));
      // Only structural actions disable every control; per-control busy gating
      // in reflectButtonStates handles background patches without a full freeze.
      for (const button of editor.querySelectorAll("button")) button.disabled = blocking;
      reflectButtonStates();
    };

    const post = (message, { pendingBase = null } = {}) => {
      if (isBuiltInLayoutEdit()) {
        const allowed = BUILTIN_LAYOUT_MESSAGES.has(message.type)
          && (message.type !== "apply-theme-patch"
            || (Array.isArray(message.changes)
              && message.changes.length > 0
              && message.changes.every(builtInLayoutChangeAllowed)));
        if (!allowed) {
          announce(tr("editorActionFailed"), "error");
          return false;
        }
      }
      if (message.type !== "apply-theme-patch" && (stageKeyPaths.size || stageKeyTimer)) {
        if (actionAfterPatch) return false;
        actionAfterPatch = { ...message };
        flushStageKeyChanges();
        if (!pendingAction && (coalescedChanges.size || changeFlushTimer)) flushThemeChanges();
        if (pendingAction || patchResyncPending || coalescedChanges.size || changeFlushTimer) {
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
      if (pendingAction || patchResyncPending || !send(message)) return false;
      setPending(message.type, pendingBase ? { ...message, ...pendingBase } : message);
      announce(tr("editorBusy"), "busy");
      return true;
    };

    const mutationBase = () => state ? { session: state.session, revision: state.revision } : null;
    const loadingCueByTheme = Object.freeze({
      default: "orbit",
      "japanese-film-editorial": "editorial-rule",
      "korean-prestige": "facet",
      "cartoon-studio": "ink-frame",
      "anime-twilight": "horizon",
      "study-library": "folio",
      "japanese-idol": "ribbon",
      "korean-idol": "capsule",
    });
    const cloneLoading = (value) => JSON.parse(JSON.stringify(value));
    const defaultLoadingScreen = () => {
      const mode = (appearance) => {
        const style = state.studioStyle[appearance];
        return {
          background: style.canvas,
          surface: style.raised,
          text: style.text,
          accent: style.accent,
          accentText: style.accentText,
          // Using the readable foreground here gives a validation-safe first
          // custom draft even when the theme's decorative border is subtle.
          border: style.text,
          artwork: null,
        };
      };
      return {
        mode: "custom",
        layout: "centered",
        motif: "inherit",
        mark: { source: "theme", asset: null, size: 72 },
        progress: { style: "bar", motion: "calm" },
        light: mode("light"),
        dark: mode("dark"),
      };
    };
    const loadingScreenDraft = () => state.loadingScreen.mode === "custom"
      ? cloneLoading(state.loadingScreen)
      : defaultLoadingScreen();
    const postLoadingScreen = (next) => {
      const base = mutationBase();
      return Boolean(base && post({ type: "set-loading-screen", ...base, loadingScreen: next }));
    };
    const requestLoadingMark = () => {
      const base = mutationBase();
      if (base) post({ type: "pick-loading-screen-mark", ...base });
    };
    const requestLoadingArtwork = () => {
      const base = mutationBase();
      if (base) post({ type: "pick-loading-screen-artwork", ...base, appearance: selectedMode });
    };
    const reflectLoadingScreen = () => {
      if (!state || !loadingSchematic) return;
      const inherited = state.loadingScreen.mode === "inherit";
      const screen = inherited ? defaultLoadingScreen() : state.loadingScreen;
      const appearance = screen[selectedMode];
      const cue = screen.motif === "inherit"
        ? loadingCueByTheme[state.sourceId] ?? "orbit"
        : screen.motif;
      for (const input of loadingModeInputs) input.checked = input.value === state.loadingScreen.mode;
      loadingCustomControls.hidden = inherited;
      loadingSource.textContent = state.sourceId;
      loadingLayoutInput.value = screen.layout;
      loadingMotifInput.value = screen.motif;
      loadingMarkSourceInput.value = screen.mark.source;
      loadingMarkSizeInput.value = String(screen.mark.size);
      loadingMarkSizeOutput.value = `${screen.mark.size}px`;
      loadingProgressStyleInput.value = screen.progress.style;
      loadingProgressMotionInput.value = screen.progress.motion;
      loadingSchematic.dataset.layout = screen.layout;
      loadingSchematic.style.setProperty("--loading-background", appearance.background);
      loadingSchematic.style.setProperty("--loading-surface", appearance.surface);
      loadingSchematic.style.setProperty("--loading-text", appearance.text);
      loadingSchematic.style.setProperty("--loading-accent", appearance.accent);
      loadingSchematic.style.setProperty("--loading-border", appearance.border);
      loadingSchematic.style.setProperty("--loading-mark-size", `${Math.round(screen.mark.size * 0.72)}px`);
      loadingMotifPreview.dataset.motif = cue;
      loadingProgressPreview.dataset.style = screen.progress.style;
      loadingProgressPreview.dataset.motion = screen.progress.motion;
      const markUrl = screen.mark.source === "custom"
        ? state.loadingScreenAssets.mark
        : screen.mark.source === "theme" ? state.launcherPreviewUrl : null;
      loadingMarkPreview.dataset.source = screen.mark.source;
      if (markUrl) {
        loadingMarkPreviewImage.src = markUrl;
        loadingMarkPreviewImage.hidden = false;
        loadingMarkPreviewFallback.hidden = true;
      } else {
        loadingMarkPreviewImage.removeAttribute("src");
        loadingMarkPreviewImage.hidden = true;
        loadingMarkPreviewFallback.hidden = screen.mark.source === "none";
      }
      const artworkUrl = selectedMode === "dark"
        ? state.loadingScreenAssets.darkArtwork
        : state.loadingScreenAssets.lightArtwork;
      if (!inherited && appearance.artwork && artworkUrl) {
        loadingArtworkPreview.src = artworkUrl;
        loadingArtworkPreview.hidden = false;
        loadingSchematic.style.setProperty("--loading-artwork-opacity", String(appearance.artwork.opacity));
        loadingSchematic.style.setProperty("--loading-artwork-fit", appearance.artwork.fit);
        loadingSchematic.style.setProperty(
          "--loading-artwork-position",
          `${appearance.artwork.focalX}% ${appearance.artwork.focalY}%`,
        );
      } else {
        loadingArtworkPreview.removeAttribute("src");
        loadingArtworkPreview.hidden = true;
        loadingSchematic.style.setProperty("--loading-artwork-opacity", "0");
      }
      for (const field of loadingColorFields) {
        const value = screen[field.appearance][field.property];
        field.picker.value = value;
        field.exact.value = value;
        const card = field.label.closest("[data-loading-appearance]");
        card?.classList.toggle("advanced-only", field.appearance !== selectedMode);
      }
      const artwork = screen[selectedMode].artwork;
      loadingArtworkOpacityInput.value = String(artwork?.opacity ?? 0.35);
      loadingArtworkOpacityOutput.value = `${Math.round((artwork?.opacity ?? 0.35) * 100)}%`;
      loadingArtworkFitInput.value = artwork?.fit ?? "cover";
      loadingArtworkFocalXInput.value = String(artwork?.focalX ?? 50);
      loadingArtworkFocalXOutput.value = `${artwork?.focalX ?? 50}%`;
      loadingArtworkFocalYInput.value = String(artwork?.focalY ?? 50);
      loadingArtworkFocalYOutput.value = `${artwork?.focalY ?? 50}%`;
      loadingArtworkControls.hidden = !artwork;
      loadingArtworkRemoveButton.hidden = !artwork;
      loadingMarkPickButton.hidden = screen.mark.source !== "custom";
    };
    const requestLauncherMark = () => {
      const base = mutationBase();
      if (base) post({ type: "pick-theme-launcher-mark", ...base });
    };
    const requestSidebarIdentityMark = () => {
      const base = mutationBase();
      if (base) post({ type: "pick-sidebar-identity-mark", ...base });
    };
    const responsiveActive = () => Boolean(state?.responsiveLayouts);
    const responsiveSet = (id = editingLayoutId) => state?.responsiveLayouts?.sets
      .find((set) => set.id === id) ?? null;
    const responsiveEditExact = () => {
      const set = responsiveSet();
      return Boolean(set && set.width === stagePreviewSize[0] && set.height === stagePreviewSize[1]);
    };
    const stageFrameId = (viewport = stageViewport) => responsiveActive()
      ? editingLayoutId
      : viewport;
    const frameDisplayLabel = (id = stageFrameId()) => responsiveActive()
      ? responsiveSet(id)?.label ?? id ?? ""
      : tr(id === "wide" ? "frameWide" : "frameStandard");
    const greetingFrameId = (viewport = stageViewport) => responsiveActive()
      ? editingLayoutId
      : viewport === "wide" ? "wide" : "standard";
    const greetingFramePrefix = (
      appearance = selectedMode,
      frame = greetingFrameId(),
    ) => `shared.greeting.frames.${appearance}.${frame}.`;
    const greetingScopeFromFieldPath = (fieldPath) => {
      const match = /^shared\.greeting\.frames\.(light|dark)\.([a-z][a-z0-9-]{0,31})\./.exec(
        String(fieldPath ?? ""),
      );
      return match
        ? { appearance: match[1], frameId: match[2] }
        : { appearance: selectedMode, frameId: greetingFrameId() };
    };
    const activeGreetingFrame = (
      appearance = selectedMode,
      frame = greetingFrameId(),
    ) => {
      const confirmedFrames = state?.shared?.greeting?.frames?.[appearance];
      const confirmed = responsiveActive()
        ? confirmedFrames?.[frame] ?? confirmedFrames?.[state.responsiveLayouts.sets[0].id] ?? null
        : confirmedFrames?.[frame] ?? null;
      if (!confirmed) return null;
      const numeric = responsiveActive()
        ? resolveResponsiveClientFrame(
          state.responsiveLayouts,
          state.shared.greeting.explicitFrames?.[appearance] ?? {},
          stagePreviewSize[0],
          RESPONSIVE_CLIENT_DEFAULTS.greeting,
          "greeting",
        )?.value ?? RESPONSIVE_CLIENT_DEFAULTS.greeting
        : confirmed;
      const draft = { ...confirmed, ...numeric };
      const prefix = greetingFramePrefix(appearance, frame);
      for (const field of GREETING_FRAME_KEYS) {
        const path = `${prefix}${field}`;
        if (stageOverrides.has(path)) draft[field] = stageOverrides.get(path);
      }
      return draft;
    };
    const activeArtworkFrame = (layer) => responsiveActive()
      ? {
        anchor: layer.anchor,
        ...(resolveResponsiveClientFrame(
          state.responsiveLayouts,
          layer.frames,
          stagePreviewSize[0],
          RESPONSIVE_CLIENT_DEFAULTS.artwork,
          "artwork",
        )?.value ?? RESPONSIVE_CLIENT_DEFAULTS.artwork),
      }
      : layer.frames[stageViewport];
    const activeInstantPromptFrame = (prompt) => responsiveActive()
      ? resolveResponsiveClientFrame(
        state.responsiveLayouts,
        prompt.layout.frames,
        stagePreviewSize[0],
        RESPONSIVE_CLIENT_DEFAULTS.widget,
        "widget",
      )?.value ?? RESPONSIVE_CLIENT_DEFAULTS.widget
      : prompt.layout.frames[stageViewport];
    const themeChangeKey = (change) => change.kind === "token"
      ? `token:${change.mode}:${change.token}`
      : change.kind === "layer"
        ? `layer:${change.layerId}:${change.preset}:${change.property}`
        : change.kind === "instant-prompt"
          ? `instant-prompt:${change.id}:${change.operation}:${change.field ?? ""}:${change.locale ?? ""}`
        : change.kind === "greeting"
          ? change.operation === "reset"
            ? "greeting:reset"
            : `greeting:set-frame:${change.appearance}:${change.frame}`
          : change.kind === "surface"
            ? `surface:${change.target}:${change.slot}:${change.axis ?? "shared"}:${change.property}`
          : change.kind === "metadata-locale"
            ? `metadata-locale:${change.locale}`
            : `metadata:${change.field}:${change.locale}`;
    const greetingChangeReflected = (change, snapshot) => {
      if (change?.kind !== "greeting" || !snapshot?.shared?.greeting) return false;
      if (change.operation === "reset") return snapshot.shared.greeting.native === true;
      if (change.operation !== "set-frame" || snapshot.shared.greeting.native) return false;
      const confirmed = snapshot.shared.greeting.frames?.[change.appearance]?.[change.frame];
      return Boolean(confirmed && JSON.stringify(confirmed) === JSON.stringify(change.value));
    };
    const reconcileUncertainChanges = (snapshot) => {
      let greetingSettled = false;
      for (const [key, change] of uncertainChanges) {
        if (!greetingChangeReflected(change, snapshot)) continue;
        uncertainChanges.delete(key);
        greetingSettled = true;
      }
      if (greetingSettled
          && ![...uncertainChanges.values()].some((change) => change.kind === "greeting")) {
        greetingStyleIntent = null;
        greetingStyleLocked = false;
      }
    };
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
      if (pendingAction || patchResyncPending || uncertainChanges.size
          || !coalescedChanges.size) return;
      const batch = [...coalescedChanges.entries()].slice(0, 16);
      const base = mutationBase();
      if (!base) {
        coalescedChanges.clear();
        return;
      }
      for (const [key] of batch) coalescedChanges.delete(key);
      inFlightChanges = batch.map(([, change]) => change);
      if (greetingStyleIntent !== null
          && inFlightChanges.some((change) => change.kind === "greeting")) {
        greetingStyleLocked = true;
      }
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
        const greetingSendFailed = inFlightChanges.some((change) => change.kind === "greeting");
        clearInFlightChanges();
        changeSendRetryCount += 1;
        if (changeSendRetryCount < 2) {
          changeFlushTimer = setTimeout(flushThemeChanges, 250);
          announce(tr("editorBusy"), "busy");
        } else {
          for (const [key, change] of coalescedChanges) deferredChanges.set(key, change);
          coalescedChanges.clear();
          changeSendRetryCount = 0;
          actionAfterPatch = null;
          if (greetingSendFailed || greetingStyleIntent !== null) greetingStyleLocked = false;
          announce(tr("editorActionFailed"), "error");
        }
      } else {
        changeSendRetryCount = 0;
      }
      reflectButtonStates();
    };
    const queueThemeChanges = (changes, { immediate = false } = {}) => {
      if (!pendingAction) patchResponseRetryCount = 0;
      const permittedChanges = isBuiltInLayoutEdit()
        ? changes.filter(builtInLayoutChangeAllowed)
        : changes;
      if (!permittedChanges.length) {
        if (changes.length) announce(tr("editorActionFailed"), "error");
        return;
      }
      for (const [, change] of deferredChanges) {
        const key = themeChangeKey(change);
        if (!coalescedChanges.has(key)) coalescedChanges.set(key, change);
      }
      deferredChanges.clear();
      for (const change of permittedChanges) {
        const key = themeChangeKey(change);
        if (change.kind === "greeting" && change.operation === "reset") {
          for (const queuedKey of [...coalescedChanges.keys()]) {
            if (queuedKey.startsWith("greeting:")) coalescedChanges.delete(queuedKey);
          }
          for (const uncertainKey of [...uncertainChanges.keys()]) {
            if (uncertainKey.startsWith("greeting:")) uncertainChanges.delete(uncertainKey);
          }
        } else if (change.kind === "greeting") {
          uncertainChanges.delete("greeting:reset");
          uncertainChanges.delete(key);
        } else {
          uncertainChanges.delete(key);
        }
        // Reinsert a replaced value so ordering remains the ordering of the
        // user's latest gestures. This matters when a global greeting reset
        // and later frame edits share one delayed transaction.
        coalescedChanges.delete(key);
        coalescedChanges.set(key, change);
      }
      if (changeFlushTimer) clearTimeout(changeFlushTimer);
      if (immediate && !pendingAction) flushThemeChanges();
      else changeFlushTimer = setTimeout(flushThemeChanges, 60);
      reflectButtonStates();
    };
    const queueThemeChange = (change, options) => queueThemeChanges([change], options);
    const confirmedTokenValue = (change) => {
      if (change.mode === "light" || change.mode === "dark") {
        return state?.tokens?.[change.mode]?.[change.token];
      }
      if (change.mode !== "shared") return undefined;
      if (state?.shared?.inherited?.[change.token]) return undefined;
      if (change.token.startsWith("launcher")) {
        const suffix = change.token.slice("launcher".length);
        const property = `${suffix[0]?.toLowerCase() ?? ""}${suffix.slice(1)}`;
        return state?.launcher?.[property];
      }
      return state?.shared?.[change.token];
    };
    const duplicatesConfirmedTokenChange = (change) => {
      const key = themeChangeKey(change);
      const inFlight = inFlightChanges.find((candidate) => themeChangeKey(candidate) === key);
      const hadQueued = coalescedChanges.has(key) || deferredChanges.has(key);
      const duplicate = reconcileDuplicateTokenValue({
        key,
        value: change.value,
        inFlight,
        confirmedValue: confirmedTokenValue(change),
        queued: coalescedChanges,
        deferred: deferredChanges,
      });
      if (!duplicate) return false;
      if (hadQueued && !coalescedChanges.size && changeFlushTimer) {
        clearTimeout(changeFlushTimer);
        changeFlushTimer = null;
      }
      if (hadQueued) {
        reflectButtonStates();
        reflectDirtyState();
      }
      return true;
    };
    const queueTokenChange = (mode, token, value) => {
      const change = { kind: "token", mode, token, value };
      if (!duplicatesConfirmedTokenChange(change)) queueThemeChange(change);
    };
    const greetingInputValue = (input, field) => input.type === "checkbox" ? input.checked
      : input.type === "range" ? input.valueAsNumber
        : field === "weight" ? Number(input.value)
          : input.value;
    const greetingFrameFromControls = (
      changedField = null,
      changedValue = null,
      appearance = selectedMode,
      frameId = greetingFrameId(),
    ) => {
      const frame = { ...activeGreetingFrame(appearance, frameId) };
      if (!frame.font) return null;
      if (changedField) frame[changedField] = changedValue;
      return frame;
    };
    const queueGreetingFrame = (
      frame,
      {
        immediate = false,
        appearance = selectedMode,
        frameId = greetingFrameId(),
      } = {},
    ) => {
      if (!frame) return;
      queueThemeChange({
        kind: "greeting",
        operation: "set-frame",
        appearance,
        frame: frameId,
        value: frame,
      }, { immediate });
    };
    const queueLayerChange = (index, preset, property, value) => {
      const layerId = state?.layers?.[index]?.id;
      if (layerId) queueThemeChange({ kind: "layer", layerId, preset, property, value });
    };
    const promptFrameProperties = new Set(["widthRatio", "offsetXRatio", "offsetYRatio"]);
    const surfaceScope = (target, property) => promptFrameProperties.has(property)
      ? { slot: "frame", axis: greetingFrameId() }
      : { slot: "appearance", axis: selectedMode };
    const surfaceFieldPath = (target, property, scope = surfaceScope(target, property)) => (
      `interfaceSurfaces.${target}.${scope.slot}.${scope.axis ?? "base"}.${property}`
    );
    const surfaceLeaf = (target, scope) => scope.slot === "base"
      ? state?.interfaceSurfaces?.[target]?.base
      : state?.interfaceSurfaces?.[target]?.[scope.slot]?.[scope.axis];
    const surfaceExplicit = (target, property, scope = surfaceScope(target, property)) => {
      const path = surfaceFieldPath(target, property, scope);
      if (stageOverrides.has(path)) return stageOverrides.get(path) !== null;
      return Object.hasOwn(surfaceLeaf(target, scope) ?? {}, property);
    };
    const surfaceFallback = (target, property) => {
      const mode = state?.tokens?.[selectedMode] ?? {};
      const values = {
        sidebar: {
          surface: mode.sidebar, primaryText: mode.text, secondaryText: mode.text,
          selectedSurface: mode.surface, indicator: mode.accent, font: state?.shared?.fontUi,
          primaryActionSurface: mode.accent, primaryActionForeground: mode.canvas,
          rowHoverSurface: mode.surface, rowPressedSurface: mode.border, selectedRowSurface: mode.surface,
          sectionLabel: mode.text, sectionRule: mode.border, footerSurface: mode.sidebar,
          rowRadius: state?.shared?.radius ?? 12, spacing: "comfortable",
        },
        sidebarIdentity: {
          mode: state?.sourceId && state.sourceId !== state.id ? "inherited-builtin" : "native",
          font: state?.shared?.fontDisplay ?? "system-sans", weight: 600, fontSize: 20,
          letterSpacing: 0, color: mode.text, markSize: 36, markTreatment: "original",
        },
        promptBlock: {
          surface: mode.surface, foreground: mode.text, placeholder: mode.text, border: mode.border,
          focus: mode.accent, font: state?.shared?.fontUi ?? "system-sans",
          radius: state?.shared?.radius ?? 16, borderWidth: 1, blurPx: state?.shared?.blur ?? 0,
          shadow: state?.shared?.shadow ?? "soft", editorInset: "transparent",
          toolbarSurface: mode.surface, controlForeground: mode.text, controlResting: mode.surface,
          controlHover: mode.border, controlPressed: mode.accent, controlSelected: mode.accent,
          controlDisabled: mode.border,
          widthRatio: state?.shared?.prompt?.width ?? 0.76,
          offsetXRatio: state?.shared?.prompt?.x ?? 0,
          offsetYRatio: state?.shared?.prompt?.y ?? 0,
        },
      };
      return values[target]?.[property];
    };
    const surfaceValue = (target, property) => {
      const wrapper = state?.interfaceSurfaces?.[target] ?? {};
      let value = wrapper.base?.[property];
      const apply = (scope) => {
        const path = surfaceFieldPath(target, property, scope);
        if (stageOverrides.has(path)) {
          const staged = stageOverrides.get(path);
          if (staged !== null) value = staged;
          return;
        }
        const leaf = surfaceLeaf(target, scope);
        if (Object.hasOwn(leaf ?? {}, property)) value = leaf[property];
      };
      apply({ slot: "appearance", axis: selectedMode });
      if (promptFrameProperties.has(property)) apply({ slot: "frame", axis: greetingFrameId() });
      return value ?? surfaceFallback(target, property);
    };
    const stageSurfaceValue = (target, property, value) => {
      const scope = surfaceScope(target, property);
      const path = surfaceFieldPath(target, property, scope);
      setStageOverride(path, value);
      inspectorField = path;
      refreshInspectorContext();
      reflectSurfaceControls();
      renderStage();
    };
    const queueSurfaceChange = (target, property, value) => {
      const scope = surfaceScope(target, property);
      stageSurfaceValue(target, property, value);
      queueThemeChange({
        kind: "surface", target, slot: scope.slot, axis: scope.axis ?? null, property, value,
      }, { immediate: true });
    };
    const surfaceControlNodes = new Map();
    const createSurfaceControls = () => {
      for (const [target, definitions] of Object.entries(SURFACE_CONTROL_DEFS)) {
        const host = surfaceControlHosts[target];
        if (!host) continue;
        const controls = definitions.map(([property, labelKey, kind, advanced = false, options = null]) => {
          const root = document.createElement("div");
          root.className = `surface-control${advanced ? " advanced-only" : ""}`;
          root.dataset.surfaceTarget = target;
          root.dataset.surfaceProperty = property;
          const head = document.createElement("div");
          head.className = "surface-control-head";
          const label = document.createElement("label");
          label.textContent = tr(labelKey);
          const controlId = `editor-surface-${target.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}-${property}`;
          label.htmlFor = controlId;
          head.append(label);
          let input;
          let textInput = null;
          if (kind === "color") {
            const pair = document.createElement("div");
            pair.className = "surface-color-inputs";
            input = document.createElement("input");
            input.type = "color";
            input.id = controlId;
            textInput = document.createElement("input");
            textInput.type = "text";
            textInput.maxLength = 7;
            textInput.spellcheck = false;
            textInput.inputMode = "text";
            textInput.setAttribute("aria-label", `${tr(labelKey)} HEX`);
            pair.append(input, textInput);
            root.append(head, pair);
          } else if (kind === "number") {
            input = document.createElement("input");
            input.type = "number";
            input.id = controlId;
            input.min = String(options[0]);
            input.max = String(options[1]);
            input.step = String(options[2]);
            input.inputMode = "decimal";
            root.append(head, input);
          } else {
            input = document.createElement("select");
            input.id = controlId;
            for (const [value, optionLabelKey] of options) {
              const option = document.createElement("option");
              option.value = String(value);
              option.textContent = /^\d+$/.test(optionLabelKey) ? optionLabelKey : tr(optionLabelKey);
              input.append(option);
            }
            root.append(head, input);
          }
          input.dataset.editorSurface = `${target}.${property}`;
          input.dataset.editorFocus = `surface-${target}-${property}`;
          const provenance = document.createElement("div");
          provenance.className = "surface-control-provenance";
          const source = document.createElement("span");
          const reset = document.createElement("button");
          reset.type = "button";
          reset.className = "surface-control-reset";
          reset.textContent = tr("resetToInherited");
          provenance.append(source, reset);
          root.append(provenance);
          const numericOption = kind === "select" && options.some(([value]) => typeof value === "number");
          const read = (control = input) => kind === "number" || numericOption
            ? control.valueAsNumber ?? Number(control.value)
            : String(control.value);
          const preview = (control = input) => {
            let value = read(control);
            if (kind === "color") value = String(control.value).toUpperCase();
            if ((kind === "number" && !inRange(value, Number(input.min), Number(input.max)))
                || (kind === "color" && !COLOR_PATTERN.test(value))) return false;
            stageSurfaceValue(target, property, value);
            return true;
          };
          input.addEventListener("input", () => {
            if (textInput) textInput.value = input.value.toUpperCase();
            preview();
          });
          input.addEventListener("change", () => {
            if (!preview()) { reflectSurfaceControls(); return; }
            queueSurfaceChange(target, property, kind === "color" ? input.value.toUpperCase() : read());
          });
          textInput?.addEventListener("change", () => {
            const value = textInput.value.trim().toUpperCase();
            const valid = COLOR_PATTERN.test(value);
            textInput.toggleAttribute("aria-invalid", !valid);
            if (!valid) return;
            input.value = value;
            queueSurfaceChange(target, property, value);
          });
          root.addEventListener("focusin", () => {
            inspectorField = surfaceFieldPath(target, property);
            refreshInspectorContext();
          });
          reset.addEventListener("click", () => queueSurfaceChange(target, property, null));
          surfaceControlNodes.set(`${target}.${property}`, { root, input, textInput, source, reset, kind, options });
          return root;
        });
        host.replaceChildren(...controls);
      }
    };
    const reflectSurfaceControls = () => {
      if (!state) return;
      for (const [key, nodes] of surfaceControlNodes) {
        const [target, property] = key.split(".");
        const value = surfaceValue(target, property);
        const explicit = surfaceExplicit(target, property);
        nodes.root.dataset.source = explicit ? "override" : "inherited";
        nodes.source.textContent = tr(explicit ? "customizedSource" : "themeOriginalSource");
        nodes.reset.disabled = !explicit || Boolean(pendingAction);
        nodes.input.dataset.editorField = surfaceFieldPath(target, property);
        if (nodes.kind === "color") {
          nodes.input.value = value;
          nodes.textInput.value = value;
          nodes.textInput.removeAttribute("aria-invalid");
          nodes.textInput.dataset.editorField = surfaceFieldPath(target, property);
        } else {
          nodes.input.value = String(value);
        }
        if (target === "sidebarIdentity" && property === "mode") {
          const inherited = nodes.input.querySelector('option[value="inherited-builtin"]');
          const local = nodes.input.querySelector('option[value="local-mark"]');
          if (inherited) inherited.disabled = state.sourceId === state.id;
          if (local) local.disabled = !state.identityPreviewUrl
            && !state.interfaceSurfaces?.sidebarIdentity?.base?.markDigest
            && !state.interfaceSurfaces?.sidebarIdentity?.appearance?.[selectedMode]?.markDigest;
        }
      }
      const identityMode = surfaceValue("sidebarIdentity", "mode");
      const identityFont = surfaceValue("sidebarIdentity", "font");
      const identityTreatment = surfaceValue("sidebarIdentity", "markTreatment");
      const identityColor = surfaceValue("sidebarIdentity", "color");
      const localMark = identityMode === "local-mark" && Boolean(state.identityPreviewUrl);
      if (sidebarIdentityImage) {
        sidebarIdentityImage.hidden = !localMark;
        if (localMark && sidebarIdentityImage.src !== state.identityPreviewUrl) {
          sidebarIdentityImage.src = state.identityPreviewUrl;
        }
        sidebarIdentityImage.style.width = `${surfaceValue("sidebarIdentity", "markSize")}px`;
        sidebarIdentityImage.style.height = `${surfaceValue("sidebarIdentity", "markSize")}px`;
        sidebarIdentityImage.style.filter = identityTreatment === "original" ? "none" : "grayscale(1)";
        sidebarIdentityImage.style.opacity = identityTreatment === "original" ? "1" : ".86";
      }
      if (sidebarIdentityLabel) {
        sidebarIdentityLabel.hidden = localMark;
        sidebarIdentityLabel.style.fontFamily = ({
          "system-sans": "system-ui, sans-serif", "humanist-sans": "Segoe UI, sans-serif",
          "rounded-sans": "ui-rounded, Segoe UI, sans-serif", "editorial-serif": "Georgia, serif",
        })[identityFont];
        sidebarIdentityLabel.style.fontWeight = String(surfaceValue("sidebarIdentity", "weight"));
        sidebarIdentityLabel.style.fontSize = `${surfaceValue("sidebarIdentity", "fontSize")}px`;
        sidebarIdentityLabel.style.letterSpacing = `${surfaceValue("sidebarIdentity", "letterSpacing")}em`;
        sidebarIdentityLabel.style.color = identityColor;
      }
      if (sidebarIdentityPreview) sidebarIdentityPreview.dataset.mode = identityMode;
    };
    createSurfaceControls();
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
    const clearPatchResyncTracking = () => {
      patchResyncPending = null;
      if (patchResyncTimer) {
        clearTimeout(patchResyncTimer);
        patchResyncTimer = null;
      }
    };
    const parkUncertainPatch = ({ knownNotApplied = false } = {}) => {
      const hadGreetingPatch = inFlightChanges.some((change) => change.kind === "greeting");
      clearPatchResyncTracking();
      if (knownNotApplied) {
        deferInFlightChanges();
      } else {
        for (const change of inFlightChanges) {
          const key = themeChangeKey(change);
          if (!uncertainChanges.has(key)) uncertainChanges.set(key, change);
        }
        clearInFlightChanges();
      }
      for (const [key, change] of coalescedChanges) {
        if (!deferredChanges.has(key)) deferredChanges.set(key, change);
      }
      coalescedChanges.clear();
      actionAfterPatch = null;
      patchResponseRetryCount = 0;
      if (hadGreetingPatch || greetingStyleIntent !== null) greetingStyleLocked = false;
      editor.setAttribute("aria-busy", "false");
      setPending(null);
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
      if (target === "widgets.instant-prompts") {
        const selected = state?.instantPrompts?.find((prompt) => prompt.id === selectedInstantPromptId);
        return selected?.labels?.[normalizedLocale] ?? selected?.labels?.en ?? targetLabel(target);
      }
      if (target !== "background.layer") return targetLabel(target);
      const selectedLayer = state?.layers?.find((layer) => layer.id === selectedLayerId);
      return selectedLayer
        ? format(tr("layerNumber"), selectedLayer.index + 1)
        : targetLabel(target);
    };
    const branchHelpKey = (branch) => ({
      interface: "branchInterfaceHelp",
      background: "branchBackgroundHelp",
      widgets: "appIdentityHelp",
    })[branch] ?? "branchInterfaceHelp";
    const stageSelectionTarget = (selection) => selection?.kind === "prompt"
      ? "interface.prompt-block"
      : selection?.kind === "greeting" ? "interface.greeting"
      : selection?.kind === "layer" ? "background.layer"
      : selection?.kind === "instant-prompt" ? "widgets.instant-prompts" : null;
    const stageSelectionAllowed = (selection) => {
      if (!selection) return true;
      const capability = CAPABILITY_BY_ID.get(stageSelectionTarget(selection));
      if (!capability || !targetAllowedInCurrentEdit(capability.id)) return false;
      return !CAPABILITY_BRANCHES.includes(inspectorPage)
        || capability.branch === inspectorPage;
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
      const neutralPage = !CAPABILITY_BRANCHES.includes(inspectorPage);
      const prompt = stageRoot.querySelector(".stage-prompt");
      setStageNodeInteractive(
        prompt,
        (neutralPage || inspectorPage === "interface") && stageContext === "new-chat",
      );
      const greeting = stageRoot.querySelector(".stage-greeting");
      setStageNodeInteractive(
        greeting,
        (neutralPage || inspectorPage === "interface") && stageContext === "new-chat",
      );
      for (const item of stageRoot.querySelectorAll(".stage-layer .stage-item")) {
        setStageNodeInteractive(item, neutralPage || inspectorPage === "background");
      }
      for (const item of stageRoot.querySelectorAll(".stage-instant-prompt-ticket")) {
        setStageNodeInteractive(
          item,
          (neutralPage || inspectorPage === "widgets") && stageContext === "new-chat",
        );
      }
      const palette = stageRoot.querySelector(".stage-layers-panel");
      if (palette) palette.hidden = inspectorPage !== "background";
      const scopeActive = backgroundScopeUiActive(inspectorPage, isBuiltInLayoutEdit());
      for (const node of stageRoot.querySelectorAll(
        ".stage-scope-zones, .stage-background-selection",
      )) {
        node.hidden = !scopeActive;
      }
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
      const entries = EDITOR_CAPABILITY_REGISTRY.filter((entry) => (
        entry.branch === inspectorBranch && targetAllowedInCurrentEdit(entry.id)
      ));
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
      if (field === "personalWordmark") return "interface.sidebar-identity";
      if (field === "interfaceSurfaces.sidebar" || field.startsWith("interfaceSurfaces.sidebar.")) {
        return "interface.sidebar";
      }
      if (field === "interfaceSurfaces.sidebarIdentity" || field.startsWith("interfaceSurfaces.sidebarIdentity.")) {
        return "interface.sidebar-identity";
      }
      if (field === "interfaceSurfaces.promptBlock" || field.startsWith("interfaceSurfaces.promptBlock.")) {
        return "interface.prompt-block";
      }
      if (field === "shared.prompt" || field.startsWith("shared.prompt.")) {
        return "interface.prompt-block";
      }
      if (field === "shared.greeting" || field.startsWith("shared.greeting.")) {
        return "interface.greeting";
      }
      if (field === "shared.backgroundScope") return "background.layer";
      if (field === "layers" || field.startsWith("layers[")) return "background.layer";
      if (field === "launcher" || field.startsWith("launcher.")) return "widgets.app-identity";
      if (field === "loadingScreen" || field.startsWith("loadingScreen.")) return "widgets.loading-screen";
      if (field === "instantPrompts" || field.startsWith("instantPrompts[")) return "widgets.instant-prompts";
      return null;
    };
    const defaultInspectorField = (target) => {
      if (target === "interface.theme") return `tokens.${selectedMode}.canvas`;
      if (target === "interface.sidebar") return "interfaceSurfaces.sidebar";
      if (target === "interface.sidebar-identity") return "interfaceSurfaces.sidebarIdentity";
      if (target === "interface.prompt-block") return "interfaceSurfaces.promptBlock";
      if (target === "interface.greeting") return "shared.greeting";
      if (target === "background.layer") {
        const index = state?.layers?.findIndex((layer) => layer.id === selectedLayerId) ?? -1;
        return index >= 0 ? `layers[${index}]` : "layers";
      }
      if (target === "widgets.instant-prompts") {
        const index = state?.instantPrompts?.findIndex((prompt) => prompt.id === selectedInstantPromptId) ?? -1;
        return index >= 0 ? `instantPrompts[${index}]` : "instantPrompts";
      }
      if (target === "widgets.loading-screen") return `loadingScreen.${selectedMode}`;
      return "launcher";
    };
    const normalizeInspectorField = (field) => {
      const token = /^tokens\.(?:light|dark)\.(.+)$/.exec(field ?? "");
      if (token) return `tokens.${selectedMode}.${token[1]}`;
      const greeting = /^shared\.greeting\.frames\.(?:light|dark)\.[a-z][a-z0-9-]{0,31}\.(.+)$/.exec(field ?? "");
      if (greeting) return `shared.greeting.frames.${selectedMode}.${greetingFrameId()}.${greeting[1]}`;
      const layer = /^layers\[\d+](.*)$/.exec(field ?? "");
      if (layer) {
        const index = state?.layers?.findIndex((item) => item.id === selectedLayerId) ?? -1;
        if (index >= 0) return `layers[${index}]${layer[1]}`;
      }
      const instantPrompt = /^instantPrompts\[\d+](.*)$/.exec(field ?? "");
      if (instantPrompt) {
        const index = state?.instantPrompts?.findIndex((item) => item.id === selectedInstantPromptId) ?? -1;
        if (index >= 0) return `instantPrompts[${index}]${instantPrompt[1]}`;
      }
      return field;
    };
    const hasStageOverridePrefix = (prefix) => [...stageOverrides.keys()]
      .some((path) => path === prefix || path.startsWith(`${prefix}.`));
    const fieldUsesThemeOriginal = (field) => {
      if (!state) return true;
      if (field === "shared.prompt" || field.startsWith("shared.prompt.")) {
        const frame = state.interfaceSurfaces?.promptBlock?.frame?.[greetingFrameId()] ?? {};
        return state.shared.prompt.native && Object.keys(frame).length === 0
          && !hasStageOverridePrefix("shared.prompt");
      }
      if (field.startsWith("interfaceSurfaces.")) {
        const match = /^interfaceSurfaces\.(sidebar|sidebarIdentity|promptBlock)\.(base|appearance|frame)\.(?:([^.]*)\.)?([^.]*)$/.exec(field);
        if (!match) return true;
        const [, target, slot, axis, property] = match;
        return !surfaceExplicit(target, property, {
          slot,
          axis: slot === "base" ? null : axis,
        });
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
        : inspectorTarget === "widgets.instant-prompts"
          ? `${tr("allModesScope")} · ${tr("contextNewChat")} · ${responsiveActive() ? frameDisplayLabel() : `${tr("frameStandard")} + ${tr("frameWide")}`}`
        : inspectorTarget === "widgets.loading-screen"
          ? `${tr(selectedMode === "dark" ? "appearanceDark" : "appearanceLight")} · ${tr("loadingScreenHostSurface")}`
        : inspectorTarget === "interface.sidebar"
          ? `${tr(selectedMode === "dark" ? "appearanceDark" : "appearanceLight")} · ${tr("allPagesScope")}`
        : inspectorTarget === "interface.sidebar-identity"
          ? `${tr(selectedMode === "dark" ? "appearanceDark" : "appearanceLight")} · ${tr("allPagesScope")}`
        : inspectorTarget === "interface.prompt-block"
          ? inspectorField === "shared.prompt" || inspectorField.startsWith("shared.prompt.")
            ? `${tr("allModesScope")} · ${tr("contextNewChat")} · ${frameDisplayLabel(greetingFrameId())}`
            : `${tr(selectedMode === "dark" ? "appearanceDark" : "appearanceLight")} · ${tr("allPagesScope")}`
          : inspectorTarget === "interface.greeting"
            ? `${tr(selectedMode === "dark" ? "appearanceDark" : "appearanceLight")} / ${tr("contextNewChat")} / ${frameDisplayLabel(greetingFrameId())}`
            : tokenMode
            ? `${tr(tokenMode === "dark" ? "appearanceDark" : "appearanceLight")} · ${tr("allPagesScope")}`
            : `${tr("allModesScope")} · ${tr("allPagesScope")}`;
      contextSource.textContent = inspectorTarget === "interface.sidebar-identity" && inspectorField === "personalWordmark"
        ? tr(hasPersonalWordmark?.() ? "wordmarkSaved" : "themeOriginalSource")
        : inspectorTarget === "widgets.loading-screen"
          ? tr(state.loadingScreen.mode === "inherit" ? "themeOriginalSource" : "customizedSource")
        : fieldUsesThemeOriginal(inspectorField)
          ? tr("themeOriginalSource") : tr("customizedSource");
      const fieldFrame = /^layers\[\d+]\.frames\.([a-z][a-z0-9-]{0,31})\./.exec(inspectorField)?.[1]
        ?? /^shared\.greeting\.frames\.(?:light|dark)\.([a-z][a-z0-9-]{0,31})\./.exec(inspectorField)?.[1]
        ?? ((inspectorField === "shared.prompt" || inspectorField.startsWith("shared.prompt."))
          ? greetingFrameId() : null)
        ?? null;
      contextFrameRow.hidden = !fieldFrame;
      const editFrameLabel = frameDisplayLabel(fieldFrame);
      const previewFrameLabel = responsiveActive()
        ? `${stagePreviewSize[0]}×${stagePreviewSize[1]}`
        : tr(stageViewport === "wide" ? "frameWide" : "frameStandard");
      const preset = responsiveActive()
        ? responsiveEditExact()
        : Object.values(STAGE_SIZES).some(
          ([width, height]) => width === stagePreviewSize[0] && height === stagePreviewSize[1],
        );
      contextFrame.textContent = preset
        ? editFrameLabel
        : `${editFrameLabel} · ${format(tr("customFrameUses"), previewFrameLabel)}`;
      const available = capability.views.includes(stageContext);
      editor.dataset.targetAvailable = String(available);
    };
    const revealWithinInspector = (target) => {
      if (!target || !inspectorBody) return;
      const bodyRect = inspectorBody.getBoundingClientRect();
      const visibleTop = bodyRect.top + 12;
      const visibleBottom = bodyRect.bottom - 12;
      const delta = inspectorRevealDelta(target.getBoundingClientRect(), visibleTop, visibleBottom);
      if (delta) inspectorBody.scrollTop += delta;
    };
    const inspectorSectionTarget = (section) => {
      const targets = String(section?.dataset.editorTargets ?? "")
        .split(/\s+/)
        .filter((target) => CAPABILITY_BY_ID.get(target)?.branch === inspectorBranch);
      return targets.length === 1 ? targets[0] : null;
    };
    const workflowPageAvailable = (page) => {
      if (!["details", ...CAPABILITY_BRANCHES, "review"].includes(page)) return false;
      if (!isBuiltInLayoutEdit()) return true;
      return page === "interface" || page === "review"
        || (page === "background" && Boolean(state?.layers?.length));
    };
    const syncInspectorPagePresentation = ({ focusPage = false } = {}) => {
      if (!workflowPageAvailable(inspectorPage)) inspectorPage = "interface";
      editor.dataset.inspectorPage = inspectorPage;
      const capabilityPage = CAPABILITY_BRANCHES.includes(inspectorPage);
      for (const tab of workflowTabs) {
        const page = tab.dataset.editorPageTarget;
        const available = workflowPageAvailable(page);
        const selected = available && page === inspectorPage;
        tab.hidden = !available;
        tab.disabled = !available;
        tab.setAttribute("aria-pressed", String(selected));
        tab.tabIndex = selected ? 0 : -1;
        if (selected && focusPage) tab.focus();
      }
      if (documentDetailsPanel) {
        const selected = inspectorPage === "details";
        documentDetailsPanel.hidden = !selected;
        documentDetailsPanel.inert = !selected;
      }
      if (reviewPanel) {
        const selected = inspectorPage === "review";
        reviewPanel.hidden = !selected;
        reviewPanel.inert = !selected;
      }
      if (selectionBar) {
        selectionBar.hidden = !capabilityPage;
        selectionBar.inert = !capabilityPage;
      }
    };
    const setInspectorTarget = (
      target,
      {
        focusBranch = false,
        reveal = false,
        resetScroll = true,
        routePage = true,
      } = {},
    ) => {
      const capability = CAPABILITY_BY_ID.get(target);
      if (!capability || !targetAllowedInCurrentEdit(target)) return false;
      const previousTarget = inspectorTarget;
      const previousPage = inspectorPage;
      if (inspectorTargetForField(inspectorField) !== target) {
        inspectorField = defaultInspectorField(target);
      }
      inspectorTarget = target;
      inspectorBranch = capability.branch;
      targetByBranch[inspectorBranch] = target;
      if (routePage) {
        inspectorPage = capability.branch;
      }
      editor.dataset.inspectorBranch = inspectorBranch;
      editor.dataset.inspectorTarget = inspectorTarget;
      if (launcherPreview) {
        launcherPreview.dataset.selected = String(inspectorTarget === "widgets.app-identity");
      }
      syncInspectorPagePresentation({ focusPage: focusBranch });
      syncTargetPicker();
      refreshInspectorContext();
      syncStageSelectionMode();
      if (resetScroll && inspectorBody
          && (previousTarget !== inspectorTarget || previousPage !== inspectorPage)) {
        inspectorBody.scrollTop = 0;
      }
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
    const setInspectorPage = (
      page,
      { focusPage = false, resetScroll = true, reveal = false } = {},
    ) => {
      if (!workflowPageAvailable(page)) return false;
      const previousPage = inspectorPage;
      if (CAPABILITY_BRANCHES.includes(page)) {
        let target = targetByBranch[page];
        if (!targetAllowedInCurrentEdit(target)) {
          target = EDITOR_CAPABILITY_REGISTRY.find(
            (entry) => entry.branch === page && targetAllowedInCurrentEdit(entry.id),
          )?.id ?? null;
        }
        if (!target || !setInspectorTarget(target, {
          focusBranch: focusPage,
          reveal,
          resetScroll,
          routePage: true,
        })) return false;
      } else {
        inspectorPage = page;
        syncInspectorPagePresentation({ focusPage });
        syncStageSelectionMode();
        if (resetScroll && inspectorBody && previousPage !== inspectorPage) {
          inspectorBody.scrollTop = 0;
        }
      }
      return true;
    };
    const syncBuiltInLayoutPresentation = ({ entering = false } = {}) => {
      const builtInLayout = isBuiltInLayoutEdit();
      editor.classList.toggle("is-builtin-layout-authoring", builtInLayout);
      if (builtInLayout) {
        editor.dataset.editKind = "builtin-layout";
        editor.dataset.layoutLayers = String(Boolean(state?.layers?.length));
      } else {
        delete editor.dataset.editKind;
        delete editor.dataset.layoutLayers;
      }
      if (studioShell) {
        if (builtInLayout) studioShell.dataset.editorKind = "builtin-layout";
        else delete studioShell.dataset.editorKind;
      }
      if (builtInAuthoringPill) builtInAuthoringPill.hidden = !builtInLayout;
      saveButton.setAttribute(
        "aria-describedby",
        builtInLayout
          ? "editor-built-in-authoring editor-quick-feedback editor-error-summary"
          : "editor-quick-feedback editor-error-summary",
      );
      saveButton.textContent = builtInLayout
        ? `${tr("saveTheme")} · ${tr("builtInTheme")}`
        : tr("saveTheme");
      if (greetingPersonalSection) {
        greetingPersonalSection.hidden = builtInLayout;
        greetingPersonalSection.inert = builtInLayout;
      }
      const levelControl = editor.querySelector(".editor-level");
      if (levelControl) {
        levelControl.hidden = builtInLayout;
        levelControl.inert = builtInLayout;
      }
      for (const section of editor.querySelectorAll(
        '[data-editor-targets~="interface.theme"],'
        + '[data-editor-targets~="background.layer"],'
        + '[data-editor-targets~="widgets.app-identity"],'
        + '[data-editor-targets~="widgets.loading-screen"],'
        + '[data-editor-targets~="widgets.instant-prompts"],'
        + ".editor-guide-section, .editor-add-artwork, .layer-shared-controls",
      )) {
        section.inert = builtInLayout;
      }
      if (!builtInLayout) {
        if (entering) setInspectorPage("details", { resetScroll: true });
        else syncInspectorPagePresentation();
        syncTargetPicker();
        return;
      }
      editor.dataset.level = "advanced";
      for (const input of document.querySelectorAll('input[name="editor-level"]')) {
        input.checked = input.value === "advanced";
      }
      if (entering || !BUILTIN_LAYOUT_TARGETS.has(targetByBranch.interface)) {
        targetByBranch.interface = "interface.prompt-block";
      }
      targetByBranch.background = "background.layer";
      if (entering || !targetAllowedInCurrentEdit(inspectorTarget)
          || (inspectorTarget === "background.layer" && !state?.layers?.length)) {
        inspectorField = "shared.prompt";
        setInspectorTarget("interface.prompt-block");
        stageSelection = { kind: "prompt" };
      } else {
        syncTargetPicker();
      }
      if (!workflowPageAvailable(inspectorPage)) {
        setInspectorPage("interface", { resetScroll: entering });
      } else {
        syncInspectorPagePresentation();
      }
      stageOpacityWrap.hidden = true;
    };
    setInspectorTarget(inspectorTarget);
    const reflectStageSelectionForTarget = (target) => {
      if (target === "interface.prompt-block") {
        stageSelection = { kind: "prompt" };
      } else if (target === "interface.greeting") {
        stageSelection = { kind: "greeting" };
      } else if (target === "background.layer" && selectedLayerId) {
        stageSelection = { kind: "layer", id: selectedLayerId };
      } else if (target === "widgets.instant-prompts" && selectedInstantPromptId) {
        stageSelection = { kind: "instant-prompt", id: selectedInstantPromptId };
      } else {
        stageSelection = null;
      }
      syncStageHud();
    };
    workflowTabs.forEach((tab) => tab.addEventListener("click", () => {
      const page = tab.dataset.editorPageTarget;
      if (!setInspectorPage(page, { resetScroll: true })) return;
      if (CAPABILITY_BRANCHES.includes(page)) {
        const target = targetByBranch[page];
        reflectStageSelectionForTarget(target);
        renderStage();
      }
    }));
    workflowTabs.forEach((tab) => tab.addEventListener("keydown", (event) => {
      const previous = event.key === "ArrowLeft" || event.key === "ArrowUp";
      const next = event.key === "ArrowRight" || event.key === "ArrowDown";
      const boundary = event.key === "Home" || event.key === "End";
      if (!previous && !next && !boundary) return;
      event.preventDefault();
      const availableTabs = workflowTabs.filter(
        (candidate) => !candidate.hidden && !candidate.disabled,
      );
      const index = availableTabs.indexOf(tab);
      if (index < 0 || !availableTabs.length) return;
      const nextIndex = event.key === "Home" ? 0
        : event.key === "End" ? availableTabs.length - 1
          : (index + (previous ? -1 : 1) + availableTabs.length) % availableTabs.length;
      availableTabs[nextIndex].focus();
      availableTabs[nextIndex].click();
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
      requestLauncherMark();
    });
    const trackInspectorField = (event) => {
      const control = event.target.closest?.("[data-editor-field]");
      const section = event.target.closest?.(".editor-section[data-editor-branch][data-editor-targets]");
      if ((!control && !section) || !editorControls?.contains(event.target)) return;
      const field = control?.dataset.editorField ?? null;
      const target = (field ? inspectorTargetForField(field) : null)
        ?? inspectorSectionTarget(section);
      if (!target || CAPABILITY_BY_ID.get(target)?.branch !== inspectorBranch) return;
      if (field) inspectorField = field;
      if (target !== inspectorTarget) {
        setInspectorTarget(target);
        reflectStageSelectionForTarget(target);
        renderStage();
      }
      refreshInspectorContext();
    };
    editorControls?.addEventListener("focusin", trackInspectorField);
    editorControls?.addEventListener("input", trackInspectorField);
    editorControls?.addEventListener("change", trackInspectorField);
    editorControls?.addEventListener("click", trackInspectorField);
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
        if (inspectorBody) inspectorBody.scrollTop = 0;
        requestAnimationFrame(() => {
          resetStudioViewport("#editor");
          title.focus();
          applyStageLayout();
        });
        firstOpen = false;
      }
    };

    const hideEditor = (action = "") => {
      resetOverlayUi();
      editor.hidden = true;
      studioShell?.removeAttribute("data-editor-active");
      syncBuiltInLayoutPresentation();
      setCurrentNavigation(false);
      resetStudioViewport("#themes");
      const ordinaryViewRestored = onOrdinaryViewRestore?.("themes") === true;
      if (!ordinaryViewRestored) {
        for (const section of ordinarySections) {
          const selected = section.id === "themes";
          section.hidden = !selected;
          section.inert = !selected;
        }
      }
      firstOpen = true;
      dropStageWork();
      stageSelection = null;
      selectedLayerId = null;
      selectedInstantPromptId = null;
      editingLayoutId = null;
      pendingResponsiveSelectionId = null;
      renderedResponsiveSignature = null;
      renderedLayerSignature = null;
      renderedInstantPromptSignature = null;
      stageHiddenLayers.clear();
      stageLayersUserToggled = false;
      setStageLayersCollapsed(true);
      targetByBranch.interface = "interface.theme";
      targetByBranch.background = "background.layer";
      targetByBranch.widgets = "widgets.app-identity";
      setInspectorTarget("interface.theme");
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
    const backgroundScopeRect = (scope, logicalWidth, logicalHeight, mainMetrics) => {
      if (scope === "sidebar") {
        return { left: 0, top: 0, width: mainMetrics.left, height: logicalHeight };
      }
      if (scope === "content") {
        return {
          left: mainMetrics.left,
          top: 0,
          width: mainMetrics.width,
          height: logicalHeight,
        };
      }
      return { left: 0, top: 0, width: logicalWidth, height: logicalHeight };
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
    const promptFrameProperty = Object.freeze({
      width: "widthRatio", x: "offsetXRatio", y: "offsetYRatio",
    });
    const promptStateValue = (key) => {
      const property = promptFrameProperty[key];
      const inherited = state?.shared?.prompt?.native
        ? measuredNativePrompt()[key]
        : statePath(`shared.prompt.${key}`);
      if (responsiveActive()) {
        const base = {
          widthRatio: key === "width" ? inherited : (state.shared.prompt.native ? measuredNativePrompt().width : state.shared.prompt.width),
          offsetXRatio: key === "x" ? inherited : (state.shared.prompt.native ? measuredNativePrompt().x : state.shared.prompt.x),
          offsetYRatio: key === "y" ? inherited : (state.shared.prompt.native ? measuredNativePrompt().y : state.shared.prompt.y),
        };
        return resolveResponsiveClientFrame(
          state.responsiveLayouts,
          state.interfaceSurfaces?.promptBlock?.frame ?? {},
          stagePreviewSize[0],
          base,
          "prompt",
        )?.value?.[property] ?? inherited;
      }
      const saved = state?.interfaceSurfaces?.promptBlock?.frame?.[greetingFrameId()]?.[property];
      return saved !== undefined ? saved : inherited;
    };
    const stageValue = (path) => {
      if (stageOverrides.has(path)) return stageOverrides.get(path);
      if (responsiveActive()) {
        const layerFrame = /^layers\[(\d+)]\.frames\.[a-z][a-z0-9-]{0,31}\.(anchor|focalX|focalY|positionX|positionY|scale)$/.exec(path);
        if (layerFrame) {
          const layer = state.layers[Number(layerFrame[1])];
          return layer ? activeArtworkFrame(layer)?.[layerFrame[2]] : undefined;
        }
        const greetingFrame = /^shared\.greeting\.frames\.(light|dark)\.[a-z][a-z0-9-]{0,31}\.([a-zA-Z]+)$/.exec(path);
        if (greetingFrame) return activeGreetingFrame(greetingFrame[1])?.[greetingFrame[2]];
        const widgetFrame = /^instantPrompts\[(\d+)]\.layout\.frames\.[a-z][a-z0-9-]{0,31}\.([a-zA-Z]+)$/.exec(path);
        if (widgetFrame) {
          const prompt = state.instantPrompts[Number(widgetFrame[1])];
          return prompt ? activeInstantPromptFrame(prompt)?.[widgetFrame[2]] : undefined;
        }
      }
      const prompt = /^shared\.prompt\.(width|x|y)$/.exec(path);
      return prompt ? promptStateValue(prompt[1]) : statePath(path);
    };
    const setStageOverride = (path, value) => { if (path) stageOverrides.set(path, value); };
    const seedNativePromptOverrides = () => {
      for (const key of ["width", "x", "y"]) {
        const path = `shared.prompt.${key}`;
        if (!stageOverrides.has(path)) setStageOverride(path, promptStateValue(key));
      }
    };
    const dropStageWork = () => {
      coalescedChanges.clear();
      deferredChanges.clear();
      uncertainChanges.clear();
      clearInFlightChanges();
      if (changeFlushTimer) { clearTimeout(changeFlushTimer); changeFlushTimer = null; }
      stageOverrides.clear();
      stageDrag = null;
      stageDragEvent = null;
      if (stageDragFrame) { cancelAnimationFrame(stageDragFrame); stageDragFrame = 0; }
      if (stageKeyTimer) { clearTimeout(stageKeyTimer); stageKeyTimer = null; }
      stageKeyPaths.clear();
      actionAfterPatch = null;
      greetingActionFollowup = null;
      greetingResyncPending = null;
      if (greetingResyncTimer) { clearTimeout(greetingResyncTimer); greetingResyncTimer = null; }
      patchResyncPending = null;
      if (patchResyncTimer) { clearTimeout(patchResyncTimer); patchResyncTimer = null; }
      greetingStageRequested = false;
      if (greetingStageTimer) { clearTimeout(greetingStageTimer); greetingStageTimer = null; }
      greetingTimeoutRetries = 0;
      greetingStyleIntent = null;
      greetingStyleLocked = false;
      changeSendRetryCount = 0;
      patchResponseRetryCount = 0;
      activeGreetingControlScope = null;
      greetingMirrorAxesDeferred = false;
      if (previewResizeTimer) { clearTimeout(previewResizeTimer); previewResizeTimer = null; }
    };

    const queueStageMutations = (messages) => {
      const changes = messages.map((message) => message.type === "set-theme-layer"
        ? {
          kind: "layer", layerId: state?.layers?.[message.index]?.id, preset: message.preset,
          property: message.property, value: message.value,
        }
        : message.type === "set-theme-surface"
          ? {
            kind: "surface", target: message.target, slot: message.slot, axis: message.axis,
            property: message.property, value: message.value,
          }
          : {
            kind: "token", mode: message.mode, token: message.token, value: message.value,
          }).filter((change) => change.kind !== "layer" || change.layerId);
      queueThemeChanges(changes, { immediate: true });
    };

    const messageForStagePath = (path, value) => {
      const layer = /^layers\[(\d+)]\.frames\.([a-z][a-z0-9-]{0,31})\.(positionX|positionY|scale)$/.exec(path);
      if (layer) {
        const rounded = layer[3] === "scale"
          ? Math.round(value * 10000) / 10000
          : Math.round(value * 100) / 100;
        return { type: "set-theme-layer", index: Number(layer[1]), preset: layer[2], property: layer[3], value: rounded };
      }
      const prompt = /^shared\.prompt\.(width|x|y)$/.exec(path);
      if (prompt) {
        if (isBuiltInLayoutEdit()) {
          return {
            type: "set-theme-token", mode: "shared", token: STAGE_PROMPT_TOKENS[prompt[1]],
            value: roundPromptRatio(value),
          };
        }
        return {
          type: "set-theme-surface",
          target: "promptBlock",
          slot: "frame",
          axis: greetingFrameId(),
          property: promptFrameProperty[prompt[1]],
          value: roundPromptRatio(value),
        };
      }
      return null;
    };
    const greetingStagePrefix = (
      appearance = selectedMode,
      frame = greetingFrameId(),
    ) => greetingFramePrefix(appearance, frame);
    const greetingStagePaths = (
      appearance = selectedMode,
      frame = greetingFrameId(),
    ) => ["xRatio", "yRatio", "maxWidthRatio", "fontSize"]
      .map((field) => `${greetingStagePrefix(appearance, frame)}${field}`);
    const stageItemPaths = (
      selection,
      {
        appearance = selectedMode,
        frame = greetingFrameId(),
        viewport = stageViewport,
      } = {},
    ) => {
      if (!selection) return [];
      if (selection.kind === "prompt") return [...STAGE_PROMPT_PATHS];
      if (selection.kind === "greeting") return greetingStagePaths(appearance, frame);
      if (selection.kind === "instant-prompt") {
        const index = state?.instantPrompts?.findIndex((prompt) => prompt.id === selection.id) ?? -1;
        if (index < 0) return [];
        const prefix = `instantPrompts[${index}].layout.frames.${responsiveActive() ? editingLayoutId : viewport}.`;
        return [
          `instantPrompts[${index}].layout.opacity`,
          `${prefix}positionX`,
          `${prefix}positionY`,
          `${prefix}scale`,
        ];
      }
      const index = layerIndexForId(selection.id);
      const frameId = responsiveActive() ? editingLayoutId : viewport;
      return index < 0 || !frameId ? []
        : STAGE_LAYER_PATHS.map((property) => `layers[${index}].frames.${frameId}.${property}`);
    };
    const commitStagePaths = (paths) => {
      const widgetPath = /^instantPrompts\[(\d+)]\.layout\.(?:opacity|frames\.([a-z][a-z0-9-]{0,31})\.(?:positionX|positionY|scale))$/;
      const widgetIndexes = new Set(paths.map((path) => widgetPath.exec(path)?.[1]).filter(Boolean));
      if (widgetIndexes.size) {
        for (const rawIndex of widgetIndexes) {
          const index = Number(rawIndex);
          const prompt = state?.instantPrompts?.[index];
          if (!prompt) continue;
          const layout = JSON.parse(JSON.stringify(prompt.layout));
          let changed = false;
          for (const path of paths) {
            const match = widgetPath.exec(path);
            if (!match || Number(match[1]) !== index || !stageOverrides.has(path)) continue;
            const value = stageOverrides.get(path);
            const saved = statePath(path);
            if (typeof saved === "number" && Math.abs(saved - value) < 0.00005) {
              stageOverrides.delete(path);
              continue;
            }
            if (path.endsWith(".opacity")) layout.opacity = value;
            else {
              const property = path.split(".").at(-1);
              layout.frames[match[2]] ??= {};
              layout.frames[match[2]][property] = value;
            }
            changed = true;
          }
          if (changed) {
            queueThemeChange({
              kind: "instant-prompt",
              operation: "update",
              id: prompt.id,
              field: "layout",
              locale: null,
              value: layout,
            }, { immediate: true });
          }
        }
        return;
      }
      const greetingScopes = new Map();
      for (const path of paths) {
        const match = /^shared\.greeting\.frames\.(light|dark)\.([a-z][a-z0-9-]{0,31})\.(xRatio|yRatio|maxWidthRatio|fontSize)$/.exec(path);
        if (!match) continue;
        const key = `${match[1]}:${match[2]}`;
        if (!greetingScopes.has(key)) {
          greetingScopes.set(key, { appearance: match[1], frameId: match[2], paths: [] });
        }
        greetingScopes.get(key).paths.push(path);
      }
      if (greetingScopes.size) {
        for (const { appearance, frameId, paths: scopedPaths } of greetingScopes.values()) {
          const confirmed = state?.shared?.greeting?.frames?.[appearance]?.[frameId];
          const frame = activeGreetingFrame(appearance, frameId);
          if (!confirmed || !frame) continue;
          let changed = false;
          const prefix = greetingStagePrefix(appearance, frameId);
          for (const path of scopedPaths) {
            if (!stageOverrides.has(path)) continue;
            const field = path.slice(prefix.length);
            const value = stageOverrides.get(path);
            if (Math.abs(Number(confirmed[field]) - Number(value)) < 0.00005) {
              stageOverrides.delete(path);
              continue;
            }
            changed = true;
          }
          if (changed) {
            queueGreetingFrame(frame, {
              immediate: true,
              appearance,
              frameId,
            });
          }
        }
        return;
      }
      const messages = [];
      const adoptsNativePrompt = Boolean(state?.shared?.prompt?.native
        && STAGE_PROMPT_PATHS.some((path) => paths.includes(path) && stageOverrides.has(path)
          && Math.abs(Number(stageOverrides.get(path)) - Number(promptStateValue(path.split(".").at(-1)))) >= 0.00005));
      const completesBuiltInPrompt = Boolean(isBuiltInLayoutEdit()
        && STAGE_PROMPT_PATHS.some((path) => paths.includes(path) && stageOverrides.has(path)
          && Math.abs(Number(stageOverrides.get(path)) - Number(promptStateValue(path.split(".").at(-1)))) >= 0.00005));
      if (completesBuiltInPrompt) {
        for (const path of STAGE_PROMPT_PATHS) {
          const key = path.split(".").at(-1);
          const value = stageOverrides.has(path) ? stageOverrides.get(path) : promptStateValue(key);
          messages.push(messageForStagePath(path, value));
          stageOverrides.delete(path);
        }
      }
      for (const path of paths) {
        if (!stageOverrides.has(path)) continue;
        const value = stageOverrides.get(path);
        const promptKey = /^shared\.prompt\.(width|x|y)$/.exec(path)?.[1];
        if (completesBuiltInPrompt && promptKey) continue;
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
    const stageBackgroundSelection = document.createElement("div");
    stageBackgroundSelection.className = "stage-background-selection";
    stageBackgroundSelection.setAttribute("aria-hidden", "true");
    stageBackgroundSelection.hidden = true;
    const stageScopeZones = document.createElement("div");
    stageScopeZones.className = "stage-scope-zones";
    stageScopeZones.setAttribute("aria-hidden", "true");
    const stageScopeZone = (scope, key) => {
      const node = document.createElement("span");
      node.className = "stage-scope-zone";
      node.dataset.stageScopeZone = scope;
      node.dataset.editorI18n = key;
      node.textContent = tr(key);
      return node;
    };
    const stageSidebarScopeZone = stageScopeZone("sidebar", "groupSidebar");
    const stageContentScopeZone = stageScopeZone("content", "contentCanvas");
    stageScopeZones.append(stageSidebarScopeZone, stageContentScopeZone);
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
      if (isBuiltInLayoutEdit() || isBlockingAction()
          || !["layer", "instant-prompt"].includes(stageSelection?.kind)) return;
      const index = stageSelection.kind === "layer"
        ? layerIndexForId(stageSelection.id)
        : state.instantPrompts.findIndex((prompt) => prompt.id === stageSelection.id);
      if (index < 0) return;
      const path = stageSelection.kind === "layer"
        ? `layers[${index}].opacity`
        : `instantPrompts[${index}].layout.opacity`;
      setStageOverride(path, stageOpacityInput.valueAsNumber / 100);
      applyStageLayout();
    });
    stageOpacityInput.addEventListener("change", () => {
      if (isBuiltInLayoutEdit() || isBlockingAction()
          || !["layer", "instant-prompt"].includes(stageSelection?.kind)) return;
      if (stageSelection.kind === "instant-prompt") {
        const index = state.instantPrompts.findIndex((prompt) => prompt.id === stageSelection.id);
        if (index >= 0) commitStagePaths([`instantPrompts[${index}].layout.opacity`]);
        return;
      }
      const index = layerIndexForId(stageSelection.id);
      if (index >= 0) queueStageMutations([{
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
    const stageInstantPromptRail = document.createElement("div");
    stageInstantPromptRail.className = "stage-instant-prompt-rail";
    stageInstantPromptRail.setAttribute("role", "group");
    stageInstantPromptRail.setAttribute("aria-label", tr("instantPromptsTitle"));
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
    const stageGreetingAnchor = document.createElement("span");
    stageGreetingAnchor.className = "stage-greeting-anchor";
    // Claude's native starburst trails the greeting. Keep the schematic in
    // that order without letting the mark change the greeting's placement.
    // A live capture supplies the exact native artwork.
    stageGreetingAnchor.append(stageGreetingText, stageGreetingMark);
    stageGreetingEl.append(stageGreetingAnchor);
    const stageStripA = document.createElement("div");
    stageStripA.className = "stage-strip";
    const stageStripB = document.createElement("div");
    stageStripB.className = "stage-strip stage-strip-alt";
    const stageComposerEl = document.createElement("div");
    stageComposerEl.className = "stage-composer";
    stageCanvas.append(
      stageBackdropImg, stageArt, stageSidebarEl, stageContentHost, stageZonesHost,
      stageScopeZones, stageBackgroundSelection,
    );
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
        eye.hidden = isBuiltInLayoutEdit();
        eye.disabled = gated || isBuiltInLayoutEdit();
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
      const promptCards = stageContext === "new-chat"
        ? state.instantPrompts
        : state.instantPrompts.filter((prompt) => prompt.id === selectedInstantPromptId);
      const [widgetViewportWidth, widgetViewportHeight] = stageLogicalSize();
      stageInstantPromptRail.replaceChildren(...promptCards.map((prompt) => {
        const promptIndex = state.instantPrompts.findIndex((entry) => entry.id === prompt.id);
        const layoutPrefix = `instantPrompts[${promptIndex}].layout.frames.${stageFrameId()}.`;
        const positionX = Number(stageValue(`${layoutPrefix}positionX`)) || 0;
        const positionY = Number(stageValue(`${layoutPrefix}positionY`)) || 0;
        const widgetScale = Number(stageValue(`${layoutPrefix}scale`)) || 1;
        const widgetWidth = Number(stageValue(`${layoutPrefix}widthRatio`)) || 1;
        const widgetOffsetX = Number(stageValue(`${layoutPrefix}offsetX`)) || 0;
        const widgetOffsetY = Number(stageValue(`${layoutPrefix}offsetY`)) || 0;
        const widgetOpacity = Number(stageValue(`instantPrompts[${promptIndex}].layout.opacity`));
        const ticket = document.createElement("button");
        ticket.type = "button";
        ticket.className = "stage-instant-prompt-ticket";
        ticket.dataset.stageItem = "instant-prompt";
        ticket.dataset.instantPromptId = prompt.id;
        ticket.dataset.editorFocus = `stage-instant-prompt-${prompt.id}`;
        ticket.dataset.selected = String(prompt.id === selectedInstantPromptId);
        ticket.dataset.previewState = prompt.id === selectedInstantPromptId
          ? instantPromptPreviewState : "default";
        ticket.setAttribute("aria-pressed", String(prompt.id === selectedInstantPromptId));
        ticket.disabled = stageContext !== "new-chat";
        ticket.style.setProperty("--stage-widget-x", `${(widgetViewportWidth * positionX / 100) + widgetOffsetX}px`);
        ticket.style.setProperty("--stage-widget-y", `${(widgetViewportHeight * positionY / 100) + widgetOffsetY}px`);
        ticket.style.setProperty("--stage-widget-scale", String(widgetScale));
        ticket.style.setProperty("--stage-widget-width", String(widgetWidth));
        ticket.style.opacity = String(Number.isFinite(widgetOpacity) ? widgetOpacity : 1);
        if (prompt.iconPreviewUrl) {
          const icon = document.createElement("img");
          icon.src = prompt.iconPreviewUrl;
          icon.alt = "";
          icon.setAttribute("aria-hidden", "true");
          ticket.appendChild(icon);
        } else {
          const seal = document.createElement("i");
          seal.textContent = "A";
          seal.setAttribute("aria-hidden", "true");
          ticket.appendChild(seal);
        }
        const copy = document.createElement("span");
        copy.textContent = prompt.labels[normalizedLocale] ?? prompt.labels.en;
        copy.dataset.prompt = prompt.prompts[normalizedLocale] ?? prompt.prompts.en;
        ticket.appendChild(copy);
        return ticket;
      }));
      stageInstantPromptRail.dataset.context = stageContext;
      if (stageContext === "conversation" && promptCards.length) {
        const context = document.createElement("span");
        context.className = "stage-instant-prompt-context";
        context.textContent = tr("instantPromptNewChatOnly");
        stageInstantPromptRail.appendChild(context);
      }
      stageInstantPromptRail.hidden = promptCards.length === 0;
      stageContentHost.replaceChildren(...(stageContext === "new-chat"
        ? [stageGreetingEl, stageInstantPromptRail, stagePromptEl]
        : [stageStripA, stageStripB, stageInstantPromptRail, stageComposerEl]));
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
      for (const ticket of stageInstantPromptRail.querySelectorAll(".stage-instant-prompt-ticket")) {
        ticket.setAttribute("aria-pressed", String(
          stageSelection?.kind === "instant-prompt" && ticket.dataset.instantPromptId === stageSelection.id,
        ));
      }
      for (const [id, entry] of stageLayerNodes) {
        entry.item.setAttribute("aria-pressed",
          String(stageSelection?.kind === "layer" && stageSelection.id === id));
      }
      let target = null;
      if (stageSelection?.kind === "layer") target = stageLayerNodes.get(stageSelection.id)?.item ?? null;
      else if (stageSelection?.kind === "prompt" && stageContext === "new-chat") target = stagePromptEl;
      else if (stageSelection?.kind === "greeting" && stageContext === "new-chat") target = stageGreetingEl;
      else if (stageSelection?.kind === "instant-prompt" && stageContext === "new-chat") {
        target = stageInstantPromptRail.querySelector(
          `[data-instant-prompt-id="${CSS.escape(stageSelection.id)}"]`,
        );
      }
      const chrome = [...stageEdges, ...stageCorners];
      if (!target || !state) {
        stageRing.hidden = true;
        stageOpacityWrap.hidden = true;
        for (const node of chrome) node.hidden = true;
        return;
      }
      if (responsiveActive() && !responsiveEditExact()) {
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
      const framePrefix = selectionIndex >= 0 ? `layers[${selectionIndex}].frames.${stageFrameId()}.` : "";
      const widgetIndex = stageSelection.kind === "instant-prompt"
        ? state.instantPrompts.findIndex((promptCard) => promptCard.id === stageSelection.id) : -1;
      const widgetPrefix = widgetIndex >= 0
        ? `instantPrompts[${widgetIndex}].layout.frames.${stageFrameId()}.` : "";
      const positionX = Number(prompt
        ? stageValue("shared.prompt.x") * 100
        : greeting ? stageValue(`${greetingStagePrefix()}xRatio`) * 100
          : widgetIndex >= 0 ? stageValue(`${widgetPrefix}positionX`)
            : stageValue(`${framePrefix}positionX`)) || 0;
      const positionY = Number(prompt
        ? stageValue("shared.prompt.y") * 100
        : greeting ? stageValue(`${greetingStagePrefix()}yRatio`) * 100
          : widgetIndex >= 0 ? stageValue(`${widgetPrefix}positionY`)
            : stageValue(`${framePrefix}positionY`)) || 0;
      for (const node of stageEdges) {
        const horizontal = node.dataset.side === "e" || node.dataset.side === "w";
        const value = horizontal ? positionX : positionY;
        const limit = prompt ? (horizontal ? 35 : 30)
          : greeting ? (horizontal ? 45 : 40)
            : widgetIndex >= 0 ? INSTANT_PROMPT_POSITION_MAX : 100;
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
            : (Number(stageValue(`${widgetIndex >= 0 ? widgetPrefix : framePrefix}scale`)) || 1) * 100;
        node.hidden = false;
        node.style.left = `${clampX(point[0], cornerTarget)}px`;
        node.style.top = `${clampY(point[1], cornerTarget)}px`;
        node.setAttribute("aria-label", tr(prompt ? "stageWidthHandle" : "stageScaleHandle"));
        node.setAttribute("aria-valuemin", prompt ? "40" : greeting ? "24" : widgetIndex >= 0 ? "50" : "25");
        node.setAttribute("aria-valuemax", prompt ? "96" : greeting ? "72" : widgetIndex >= 0 ? "175" : "300");
        node.setAttribute("aria-valuenow", String(Math.round(value * 100) / 100));
        node.setAttribute("aria-valuetext", `${Math.round(value * 100) / 100}%`);
      }
      if (prompt || greeting || isBuiltInLayoutEdit()) {
        stageOpacityWrap.hidden = true;
      } else {
        const index = layerIndexForId(stageSelection.id);
        const opacity = Number(widgetIndex >= 0
          ? stageValue(`instantPrompts[${widgetIndex}].layout.opacity`)
          : index < 0 ? 1 : stageValue(`layers[${index}].opacity`));
        stageOpacityInput.value = String(Math.round((Number.isFinite(opacity) ? opacity : 1) * 100));
        stageOpacityInput.setAttribute("aria-label", tr(widgetIndex >= 0 ? "overlayOpacity" : "layerOpacity"));
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
      // Aura's capture must remain last-valid, but the editor canvas must keep
      // showing the current draft while a colour check is failing. Otherwise
      // every intermediate two-colour adjustment appears to snap back and the
      // user cannot see the value that remains editable in the controls.
      const invalidColorDraft = !state.feedback.valid && state.feedback.errors.some((error) =>
        error.code.includes("contrast") && error.field.startsWith(`${selectedMode}.`));
      const colorPreview = captureActive && (invalidColorDraft
        || [...stageOverrides.keys()].some((path) =>
          (path.startsWith(`tokens.${selectedMode}.`)
            || path.startsWith("interfaceSurfaces.")
            || path === "shared.radius" || path === "shared.blur" || path === "shared.shadow")
            && String(stageOverrides.get(path)) !== String(statePath(path))));
      stageFrame.dataset.colorPreview = colorPreview ? "true" : "";
      stageSidebarEl.hidden = captureActive && !colorPreview;
      const scope = stageValue("shared.backgroundScope");
      const radius = Number(stageValue("shared.radius")) || 0;
      const blur = Number(stageValue("shared.blur")) || 0;
      const shadow = STAGE_SHADOWS[stageValue("shared.shadow")] ?? "none";
      stageCanvas.style.background = tokenValue("canvas") ?? "#808080";
      const mainMetrics = stageMainMetrics(logicalWidth, logicalHeight);
      const scopeRect = backgroundScopeRect(scope, logicalWidth, logicalHeight, mainMetrics);
      stageArt.style.left = `${scopeRect.left}px`;
      stageArt.style.right = `${Math.max(0, logicalWidth - scopeRect.left - scopeRect.width)}px`;
      const backgroundSelected = backgroundScopeUiActive(inspectorPage, isBuiltInLayoutEdit());
      stageBackgroundSelection.hidden = !backgroundSelected;
      if (backgroundSelected) {
        stageBackgroundSelection.dataset.scope = scope;
        stageBackgroundSelection.style.left = `${scopeRect.left}px`;
        stageBackgroundSelection.style.top = `${scopeRect.top}px`;
        stageBackgroundSelection.style.width = `${scopeRect.width}px`;
        stageBackgroundSelection.style.height = `${scopeRect.height}px`;
      }
      stageScopeZones.hidden = !backgroundSelected;
      stageSidebarScopeZone.style.left = "0";
      stageSidebarScopeZone.style.top = "0";
      stageSidebarScopeZone.style.width = `${mainMetrics.left}px`;
      stageSidebarScopeZone.style.height = `${logicalHeight}px`;
      stageContentScopeZone.style.left = `${mainMetrics.left}px`;
      stageContentScopeZone.style.top = "0";
      stageContentScopeZone.style.width = `${mainMetrics.width}px`;
      stageContentScopeZone.style.height = `${logicalHeight}px`;
      const sidebarColor = surfaceValue("sidebar", "surface") ?? tokenValue("sidebar") ?? "#808080";
      const sidebarAlpha = Number(tokenValue("sidebarAlpha")) || 1;
      stageSidebarEl.style.width = `${mainMetrics.left}px`;
      stageSidebarEl.style.background = scope !== "content"
        ? `color-mix(in srgb, ${sidebarColor} ${Math.round(sidebarAlpha * 100)}%, transparent)`
        : sidebarColor;
      stageSidebarEl.style.backdropFilter = scope !== "content" && blur ? `blur(${Math.min(blur, 32)}px)` : "";
      stageSidebarEl.style.color = surfaceValue("sidebar", "primaryText") ?? tokenValue("text") ?? "#000000";
      stageSidebarEl.style.fontFamily = STAGE_FONT_STACKS[surfaceValue("sidebar", "font")]
        ?? STAGE_FONT_STACKS["system-sans"];
      stageSidebarEl.style.borderRight = `1px solid ${surfaceValue("sidebar", "indicator") ?? tokenValue("border") ?? "transparent"}`;
      for (const [id, entry] of stageLayerNodes) {
        const index = layerIndexForId(id);
        if (index < 0) continue;
        const framePath = (property) => `layers[${index}].frames.${stageFrameId()}.${property}`;
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
        const filterValue = (property, neutral) => (
          stageValue(`layers[${index}].filters.${property}`) ?? layer.filters?.[property] ?? neutral
        );
        entry.item.style.filter = [
          `hue-rotate(${filterValue("hueDeg", 0)}deg)`,
          `saturate(${filterValue("saturation", 1)})`,
          `brightness(${filterValue("brightness", 1)})`,
          `contrast(${filterValue("contrast", 1)})`,
          `blur(${filterValue("blurPx", 0)}px)`,
        ].join(" ");
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
      const applyPromptSurface = (node) => {
        const promptBlur = Number(surfaceValue("promptBlock", "blurPx")) || 0;
        const promptShadow = STAGE_SHADOWS[surfaceValue("promptBlock", "shadow")] ?? "none";
        node.style.background = surfaceValue("promptBlock", "surface") ?? surface;
        node.style.color = surfaceValue("promptBlock", "foreground") ?? tokenValue("text") ?? "#000000";
        node.style.border = `${surfaceValue("promptBlock", "borderWidth") ?? 1}px solid ${surfaceValue("promptBlock", "border") ?? tokenValue("border") ?? "transparent"}`;
        node.style.borderRadius = `${surfaceValue("promptBlock", "radius") ?? radius}px`;
        node.style.boxShadow = promptShadow;
        node.style.backdropFilter = promptBlur ? `blur(${Math.min(promptBlur, 32)}px)` : "";
        node.style.fontFamily = STAGE_FONT_STACKS[surfaceValue("promptBlock", "font")]
          ?? STAGE_FONT_STACKS["system-sans"];
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
        applyPromptSurface(stagePromptEl);
        stagePromptEl.style.left = `${rect.left}px`;
        stagePromptEl.style.top = `${rect.top}px`;
        stagePromptEl.style.width = `${rect.width}px`;
        stagePromptEl.style.height = `${rect.height}px`;
        if (!stageInstantPromptRail.hidden) {
          stageInstantPromptRail.style.left = `${rect.left}px`;
          stageInstantPromptRail.style.top = `${Math.max(8, rect.top - 44)}px`;
          stageInstantPromptRail.style.width = `${rect.width}px`;
          stageInstantPromptRail.style.height = "38px";
          for (const ticket of stageInstantPromptRail.querySelectorAll(".stage-instant-prompt-ticket")) {
            const index = state.instantPrompts.findIndex(
              (prompt) => prompt.id === ticket.dataset.instantPromptId,
            );
            if (index < 0) continue;
            const prefix = `instantPrompts[${index}].layout.frames.${stageFrameId()}.`;
            const x = Number(stageValue(`${prefix}positionX`)) || 0;
            const y = Number(stageValue(`${prefix}positionY`)) || 0;
            const widgetScale = Number(stageValue(`${prefix}scale`)) || 1;
            const widgetWidth = Number(stageValue(`${prefix}widthRatio`)) || 1;
            const widgetOffsetX = Number(stageValue(`${prefix}offsetX`)) || 0;
            const widgetOffsetY = Number(stageValue(`${prefix}offsetY`)) || 0;
            const opacity = Number(stageValue(`instantPrompts[${index}].layout.opacity`));
            ticket.style.setProperty("--stage-widget-x", `${(logicalWidth * x / 100) + widgetOffsetX}px`);
            ticket.style.setProperty("--stage-widget-y", `${(logicalHeight * y / 100) + widgetOffsetY}px`);
            ticket.style.setProperty("--stage-widget-scale", String(widgetScale));
            ticket.style.setProperty("--stage-widget-width", String(widgetWidth));
            ticket.style.opacity = String(Number.isFinite(opacity) ? opacity : 1);
          }
        }
        stagePromptSample.style.fontFamily = STAGE_FONT_STACKS[stageValue("shared.fontDisplay")]
          ?? STAGE_FONT_STACKS["system-sans"];
        stagePromptChip.style.color = tokenValue("accent") ?? "currentColor";
        const greeting = activeGreetingFrame();
        const confirmedGreeting = state?.shared?.greeting?.frames?.[selectedMode]?.[greetingFrameId()];
        const liveGreeting = captureActive && stageMirror?.geometry?.greeting?.status === "found"
          ? stageMirror.geometry.greeting.rect : null;
        if (greeting) {
          const boxWidth = mainMetrics.width * Number(stageValue(`${greetingStagePrefix()}maxWidthRatio`));
          const centre = mainMetrics.left + (mainMetrics.width / 2)
            + (mainMetrics.width * Number(stageValue(`${greetingStagePrefix()}xRatio`)));
          const gap = Math.max(24, greeting.fontSize * 0.9)
            + (stageInstantPromptRail.hidden ? 0 : 42);
          stageGreetingEl.hidden = false;
          stageGreetingEl.dataset.liveTarget = liveGreeting ? "true" : "";
          if (liveGreeting && confirmedGreeting) {
            const deltaX = (Number(stageValue(`${greetingStagePrefix()}xRatio`)) - confirmedGreeting.xRatio)
              * mainMetrics.width;
            const deltaY = (Number(stageValue(`${greetingStagePrefix()}yRatio`)) - confirmedGreeting.yRatio)
              * mainMetrics.height;
            const deltaWidth = (Number(stageValue(`${greetingStagePrefix()}maxWidthRatio`))
              - confirmedGreeting.maxWidthRatio) * mainMetrics.width;
            const fontRatio = Number(stageValue(`${greetingStagePrefix()}fontSize`))
              / confirmedGreeting.fontSize;
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
          stageGreetingMark.style.fontSize = `${Number(stageValue(`${greetingStagePrefix()}fontSize`))
            * greeting.markScale
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
        applyPromptSurface(stageComposerEl);
        stageComposerEl.style.left = `${mainLeft + (mainWidth * 0.14)}px`;
        stageComposerEl.style.width = `${mainWidth * 0.72}px`;
        stageComposerEl.style.height = "110px";
        stageComposerEl.style.top = `${logicalHeight - 134}px`;
        if (!stageInstantPromptRail.hidden) {
          stageInstantPromptRail.style.left = `${mainLeft + (mainWidth * 0.14)}px`;
          stageInstantPromptRail.style.top = `${logicalHeight - 178}px`;
          stageInstantPromptRail.style.width = `${mainWidth * 0.72}px`;
          stageInstantPromptRail.style.height = "36px";
        }
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

    const clearSettledStageOverrides = () => {
      if (!stageDrag && !coalescedChanges.size && !deferredChanges.size
          && !uncertainChanges.size && !pendingAction
          && !inFlightChanges.length && !stageKeyTimer && !stageKeyPaths.size) stageOverrides.clear();
    };

    const renderStage = () => {
      if (!state || stageDrag) return;
      clearSettledStageOverrides();
      renderResponsiveLayouts();
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
        inspectorField = `layers[${layer.index}].frames.${stageFrameId()}.positionX`;
        setInspectorTarget("background.layer");
        if (reveal && card) requestAnimationFrame(() => {
          revealWithinInspector(card.querySelector("summary") ?? card);
        });
        announce(format(tr("stageSelectedAnnounce"), format(tr("layerNumber"), layer.index + 1)));
      } else if (selection?.kind === "prompt") {
        inspectorField = "shared.prompt";
        setInspectorTarget("interface.prompt-block", { reveal });
        announce(format(tr("stageSelectedAnnounce"), tr("stagePromptTag")));
      } else if (selection?.kind === "greeting") {
        inspectorField = `${greetingStagePrefix()}xRatio`;
        setInspectorTarget("interface.greeting", { reveal });
        announce(format(tr("stageSelectedAnnounce"), tr("targetGreeting")));
      } else if (selection?.kind === "instant-prompt") {
        const index = state?.instantPrompts?.findIndex((prompt) => prompt.id === selection.id) ?? -1;
        if (index < 0) return false;
        selectedInstantPromptId = selection.id;
        inspectorField = `instantPrompts[${index}]`;
        setInspectorTarget("widgets.instant-prompts", { reveal });
        renderInstantPromptEditor();
        announce(format(
          tr("stageSelectedAnnounce"),
          state.instantPrompts[index].labels[normalizedLocale] ?? state.instantPrompts[index].labels.en,
        ));
      }
      syncStageHud();
      return true;
    };

    const clearOverlayStartTimer = () => {
      if (!overlayStartTimer) return;
      clearTimeout(overlayStartTimer);
      overlayStartTimer = null;
    };
    let overlayStatusKey = "overlayIdle";
    const overlayCopy = () => ({
      title: tr("overlayTitle"),
      pick: tr("overlayPick"),
      done: tr("overlayDone"),
      move: tr("overlayMove"),
      scale: tr("overlayScale"),
      opacity: tr("overlayOpacity"),
      keyboard: tr("overlayKeyboard"),
      selected: tr("overlaySelected"),
      missing: tr("overlayMissing"),
      ambiguous: tr("overlayAmbiguous"),
    });
    const overlayTokenSummary = (selection) => selection.tokenIds.map((token) => {
      const value = state?.tokens?.[selectedMode]?.[token];
      return typeof value === "string" ? `${token} ${value}` : token;
    }).join(" · ");
    const reflectOverlayPresentation = () => {
      if (!windowEditorPanel) return;
      const active = overlayState?.active === true;
      const pending = overlayState?.pending === true;
      const error = Boolean(overlayState?.failure) || overlayStatusKey === "overlayUnavailable";
      windowEditorPanel.dataset.state = error ? "error" : active ? "active" : pending ? "pending" : "idle";
      windowEditButton.hidden = active || pending;
      windowEditStopButton.hidden = !active && !pending;
      windowEditButton.disabled = !state || overlayTransportBusy()
        || (responsiveActive() && !responsiveEditExact());
      windowEditStopButton.disabled = !state;
      windowEditorStatus.textContent = tr(overlayStatusKey);
      const resolved = overlaySelection?.status === "found";
      windowEditorInspector.hidden = !resolved;
      if (!resolved) {
        windowEditorTarget.textContent = "";
        windowEditorTokens.textContent = tr("overlayNoTokens");
        return;
      }
      windowEditorTarget.textContent = `${overlaySelection.targetId} · ${overlaySelection.itemId}`;
      windowEditorTokens.textContent = overlayTokenSummary(overlaySelection) || tr("overlayNoTokens");
    };
    const resetOverlayUi = ({ unavailable = false } = {}) => {
      clearOverlayStartTimer();
      overlayState = null;
      overlaySelection = null;
      overlayStatusKey = unavailable ? "overlayUnavailable" : "overlayIdle";
      reflectOverlayPresentation();
    };
    const stopWindowEdit = () => {
      const base = mutationBase();
      if (!base || !send({ type: "stop-window-edit", ...base })) {
        resetOverlayUi({ unavailable: true });
        return false;
      }
      resetOverlayUi();
      return true;
    };
    const startWindowEdit = () => {
      const base = mutationBase();
      if (!base || overlayTransportBusy() || overlayState?.active || overlayState?.pending
          || (responsiveActive() && !responsiveEditExact())) return false;
      if (!send({ type: "start-window-edit", ...base, copy: overlayCopy() })) {
        resetOverlayUi({ unavailable: true });
        return false;
      }
      overlayState = { active: false, pending: true, session: base.session, revision: base.revision, failure: null };
      overlaySelection = null;
      overlayStatusKey = "overlayStarting";
      reflectOverlayPresentation();
      clearOverlayStartTimer();
      overlayStartTimer = setTimeout(() => {
        overlayStartTimer = null;
        if (overlayState?.pending && !overlayState.active) resetOverlayUi({ unavailable: true });
      }, 12000);
      return true;
    };
    windowEditButton?.addEventListener("click", startWindowEdit);
    windowEditStopButton?.addEventListener("click", stopWindowEdit);

    const routeOverlaySelection = (selection) => {
      if (selection.status !== "found") return;
      if (selection.targetId === "interface.greeting") {
        selectedMode = selection.geometry.appearance;
        if (responsiveActive()) editingLayoutId = selection.geometry.frame;
        else stageViewport = selection.geometry.frame === "wide" ? "wide" : "normal";
        syncModeInputs();
        reflectStageViewport();
        reflectTokens();
        reflectGreeting();
        selectStageItem({ kind: "greeting" }, { reveal: true });
        return;
      }
      if (selection.kind === "background") {
        selectStageItem({ kind: "layer", id: selection.itemId }, { reveal: true });
        return;
      }
      if (selection.kind === "widget") {
        selectStageItem({ kind: "instant-prompt", id: selection.itemId }, { reveal: true });
        return;
      }
      if (!setInspectorTarget(selection.targetId, { reveal: true })) return;
      const token = selection.tokenIds.find((id) => COLOR_TOKEN_KEYS.has(id));
      if (!token) return;
      inspectorField = `tokens.${selectedMode}.${token}`;
      const control = tokenGroups.querySelector(`[data-editor-token="${CSS.escape(token)}"]`);
      const group = control?.closest("details");
      if (group) group.open = true;
      refreshInspectorContext();
      if (control) requestAnimationFrame(() => revealWithinInspector(control));
    };
    const applyOverlayGeometry = (selection, persist) => {
      const geometry = selection.geometry;
      if (!geometry || !state) return false;
      const greeting = selection.targetId === "interface.greeting";
      const responsiveSetForFrame = responsiveActive()
        ? state.responsiveLayouts.sets.find(({ id }) => id === geometry.frame)
        : null;
      if (responsiveActive() && !responsiveSetForFrame) return false;
      const frame = responsiveSetForFrame
        ? geometry.frame
        : greeting ? (geometry.frame === "wide" ? "wide" : "normal") : geometry.frame;
      if (responsiveSetForFrame) {
        editingLayoutId = geometry.frame;
        stagePreviewSize = [responsiveSetForFrame.width, responsiveSetForFrame.height];
      } else {
        stageViewport = frame;
        stagePreviewSize = [selection.viewport.width, selection.viewport.height];
      }
      reflectStageViewport();
      setPreviewInputValues(...stagePreviewSize);
      if (greeting) {
        selectedMode = geometry.appearance;
        syncModeInputs();
        const frameId = geometry.frame;
        const current = activeGreetingFrame(geometry.appearance, frameId);
        if (!current) return false;
        const next = {
          ...current,
          fontSize: geometry.fontSize,
          lineHeight: geometry.lineHeight,
          maxWidthRatio: geometry.maxWidthRatio,
          xRatio: geometry.xRatio,
          yRatio: geometry.yRatio,
          markScale: geometry.markScale,
        };
        const prefix = greetingFramePrefix(geometry.appearance, frameId);
        const paths = [
          "fontSize", "lineHeight", "maxWidthRatio", "xRatio", "yRatio", "markScale",
        ].map((field) => `${prefix}${field}`);
        for (const field of [
          "fontSize", "lineHeight", "maxWidthRatio", "xRatio", "yRatio", "markScale",
        ]) setStageOverride(`${prefix}${field}`, next[field]);
        if (persist) queueGreetingFrame(next, {
          immediate: true,
          appearance: geometry.appearance,
          frameId,
        });
        inspectorField = `${prefix}xRatio`;
        reflectGreeting();
        reflectStageInputs(paths);
      } else if (selection.kind === "background") {
        const index = state.layers.findIndex((layer) => layer.id === selection.itemId);
        if (index < 0) return false;
        const paths = {
          opacity: `layers[${index}].opacity`,
          positionX: `layers[${index}].frames.${frame}.positionX`,
          positionY: `layers[${index}].frames.${frame}.positionY`,
          scale: `layers[${index}].frames.${frame}.scale`,
        };
        for (const [field, path] of Object.entries(paths)) setStageOverride(path, geometry[field]);
        if (persist) {
          const changes = [
            ...(!isBuiltInLayoutEdit() ? [{
              kind: "layer", layerId: selection.itemId, preset: "shared",
              property: "opacity", value: geometry.opacity,
            }] : []),
            ...["positionX", "positionY", "scale"].map((property) => ({
              kind: "layer", layerId: selection.itemId, preset: frame,
              property, value: geometry[property],
            })),
          ];
          queueThemeChanges(changes, { immediate: true });
        }
        reflectStageInputs(Object.values(paths));
      } else if (selection.kind === "widget") {
        if (isBuiltInLayoutEdit()) return false;
        const index = state.instantPrompts.findIndex((prompt) => prompt.id === selection.itemId);
        if (index < 0) return false;
        const prefix = `instantPrompts[${index}].layout.frames.${frame}.`;
        const paths = {
          opacity: `instantPrompts[${index}].layout.opacity`,
          positionX: `${prefix}positionX`,
          positionY: `${prefix}positionY`,
          scale: `${prefix}scale`,
        };
        for (const [field, path] of Object.entries(paths)) setStageOverride(path, geometry[field]);
        if (persist) {
          const layout = structuredClone(state.instantPrompts[index].layout);
          layout.opacity = geometry.opacity;
          layout.frames[frame] = {
            ...(layout.frames[frame] ?? {}),
            positionX: geometry.positionX,
            positionY: geometry.positionY,
            scale: geometry.scale,
          };
          queueThemeChange({
            kind: "instant-prompt", operation: "update", id: selection.itemId,
            field: "layout", locale: null, value: layout,
          }, { immediate: true });
        }
        reflectStageInputs(Object.values(paths));
      }
      applyStageLayout();
      syncStageHud();
      refreshInspectorContext();
      return true;
    };
    const receiveOverlayState = (rawState) => {
      const normalized = normalizeOverlayState(rawState);
      if (!normalized) return false;
      if (normalized.session !== null && normalized.session !== state?.session) return false;
      overlayState = normalized;
      clearOverlayStartTimer();
      if (normalized.failure) {
        overlaySelection = null;
        overlayStatusKey = "overlayUnavailable";
      } else if (normalized.active) {
        overlayStatusKey = "overlayActive";
      } else if (normalized.pending) {
        overlaySelection = null;
        overlayStatusKey = "overlayStarting";
      } else {
        overlaySelection = null;
        overlayStatusKey = "overlayIdle";
      }
      reflectOverlayPresentation();
      return true;
    };
    const receiveOverlay = (rawMessage) => {
      const normalized = normalizeOverlayMessage(rawMessage);
      if (!normalized || normalized.session !== state?.session
          || normalized.revision !== state?.revision) return false;
      const priorSelection = overlaySelection;
      overlaySelection = normalized.selection;
      overlayStatusKey = normalized.selection.status === "found"
        ? "overlaySelected"
        : normalized.selection.status === "ambiguous" ? "overlayAmbiguous" : "overlayMissing";
      if (normalized.event === "selection"
          || priorSelection?.kind !== normalized.selection.kind
          || priorSelection?.itemId !== normalized.selection.itemId) {
        routeOverlaySelection(normalized.selection);
      }
      if (["preview", "commit"].includes(normalized.event)) {
        applyOverlayGeometry(normalized.selection, normalized.event === "commit");
      }
      reflectOverlayPresentation();
      return true;
    };

    const stageSelectionFromNode = (node) => {
      const selection = node.dataset.stageItem === "prompt"
        ? { kind: "prompt" }
        : node.dataset.stageItem === "greeting"
          ? { kind: "greeting" }
        : node.dataset.stageItem === "instant-prompt"
          ? { kind: "instant-prompt", id: node.dataset.instantPromptId }
        : { kind: "layer", id: node.dataset.stageItem };
      return stageSelectionAllowed(selection) ? selection : null;
    };
    const backgroundScopeLabelKey = (scope) => scope === "sidebar"
      ? "groupSidebar"
      : scope === "content" ? "contentCanvas" : "fullWindow";
    const syncBackgroundScopeControls = (scope) => {
      for (const input of scopeInputs) input.checked = input.value === scope;
      const help = document.getElementById("background-scope-help");
      if (help) {
        help.textContent = tr(scope === "sidebar"
          ? "sidebarZone"
          : scope === "content" ? "contentScopeHelp" : "fullScopeHelp");
      }
      const guide = document.querySelector(".asset-guide-frame");
      if (guide) guide.dataset.scope = scope;
    };
    const setBackgroundScope = (scope) => {
      if (!BACKGROUND_SCOPE_IDS.includes(scope)
          || !backgroundScopeUiActive(inspectorPage, isBuiltInLayoutEdit())
          || !state || isBlockingAction()) return false;
      const changed = stageValue("shared.backgroundScope") !== scope;
      inspectorField = "shared.backgroundScope";
      setStageOverride("shared.backgroundScope", scope);
      syncBackgroundScopeControls(scope);
      applyStageLayout();
      if (changed) queueTokenChange("shared", "backgroundScope", scope);
      announce(`${tr("backgroundScope")}: ${tr(backgroundScopeLabelKey(scope))}`);
      return true;
    };
    const selectStageBranchSurface = () => {
      if (inspectorBranch === "widgets") {
        announce(tr("appIdentityHelp"));
        return false;
      }
      const target = isBuiltInLayoutEdit()
        ? (inspectorBranch === "interface" ? "interface.prompt-block" : "background.layer")
        : (inspectorBranch === "interface" ? "interface.theme" : "background.layer");
      if (!targetAllowedInCurrentEdit(target)
          || (target === "background.layer" && !state?.layers?.length)) return false;
      if (target === "background.layer" && !selectedLayerId) {
        selectedLayerId = state?.layers?.[0]?.id ?? null;
      }
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
      if (cached && cached.isConnected && cached.dataset.editorField === path) return cached;
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
        const greeting = /^shared\.greeting\.frames\.(?:light|dark)\.[a-z][a-z0-9-]{0,31}\.(.+)$/.exec(path)?.[1] ?? null;
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
      if (responsiveActive() && !responsiveEditExact()) {
        announce(tr("responsivePreviewOnly"));
        return;
      }
      const [logicalWidth, logicalHeight] = stageLogicalSize();
      const mainMetrics = stageMainMetrics(logicalWidth, logicalHeight);
      const scopeRect = backgroundScopeRect(
        stageValue("shared.backgroundScope"),
        logicalWidth,
        logicalHeight,
        mainMetrics,
      );
      if (selection.kind === "layer" && scopeRect.width <= 0) return;
      const scale = stageFrame.clientWidth > 0 ? stageFrame.clientWidth / logicalWidth : 1;
      if (selection.kind === "layer") stageLayerNodes.get(selection.id)?.wrap.classList.add("is-active");
      const gestureAppearance = selectedMode;
      const gestureFrame = greetingFrameId();
      const gestureViewport = stageFrameId();
      const gesturePaths = stageItemPaths(selection, {
        appearance: gestureAppearance,
        frame: gestureFrame,
        viewport: gestureViewport,
      });
      const start = {};
      for (const path of gesturePaths) start[path] = Number(stageValue(path)) || 0;
      const targetRect = (selection.kind === "layer"
        ? stageLayerNodes.get(selection.id)?.item
        : selection.kind === "greeting" ? stageGreetingEl
          : selection.kind === "instant-prompt"
            ? stageInstantPromptRail.querySelector(
              `[data-instant-prompt-id="${CSS.escape(selection.id)}"]`,
            )
            : stagePromptEl)?.getBoundingClientRect();
      const handleKind = handle?.dataset.stageHandle;
      if (selection.kind === "layer") {
        const index = layerIndexForId(selection.id);
        if (index >= 0) {
          inspectorField = `layers[${index}].frames.${stageFrameId()}.${handleKind === "scale" ? "scale" : "positionX"}`;
        }
      } else if (selection.kind === "prompt") {
        inspectorField = "shared.prompt";
      } else if (selection.kind === "instant-prompt") {
        const index = state.instantPrompts.findIndex((prompt) => prompt.id === selection.id);
        inspectorField = `instantPrompts[${index}].layout.frames.${stageFrameId()}.${handleKind === "scale" ? "scale" : "positionX"}`;
      } else {
        inspectorField = `${greetingStagePrefix()}xRatio`;
      }
      refreshInspectorContext();
      const corner = handle?.dataset.corner ?? "se";
      stageDrag = {
        pointerId: event.pointerId,
        kind: handleKind === "scale"
          ? (selection.kind === "prompt" ? "prompt-width"
            : selection.kind === "greeting" ? "greeting-size"
              : selection.kind === "instant-prompt" ? "widget-scale" : "scale")
          : selection.kind === "prompt" ? "prompt-move"
            : selection.kind === "greeting" ? "greeting-move"
              : selection.kind === "instant-prompt" ? "widget-move" : "layer-move",
        signX: corner.includes("w") ? -1 : 1,
        signY: corner.includes("n") ? -1 : 1,
        selection,
        startX: event.clientX,
        startY: event.clientY,
        scale,
        logicalHeight,
        artWidth: scopeRect.width,
        mainWidth: mainMetrics.width,
        mainHeight: mainMetrics.height,
        start,
        paths: gesturePaths,
        appearance: gestureAppearance,
        frame: gestureFrame,
        viewport: gestureViewport,
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
        const prefix = `layers[${index}].frames.${drag.viewport}.`;
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
        const prefix = `layers[${index}].frames.${drag.viewport}.`;
        const factor = 1 + (((drag.signX * (event.clientX - drag.startX)) + (drag.signY * (event.clientY - drag.startY))) / drag.rectSize);
        setStageOverride(`${prefix}scale`, clampNumber(drag.start[`${prefix}scale`] * factor, 0.25, 3));
      } else if (drag.kind === "widget-move") {
        const index = state.instantPrompts.findIndex((prompt) => prompt.id === drag.selection.id);
        if (index < 0) return;
        const prefix = `instantPrompts[${index}].layout.frames.${drag.viewport}.`;
        let nextX = clampNumber(
          drag.start[`${prefix}positionX`] + (dx / drag.mainWidth * 100),
          INSTANT_PROMPT_POSITION_MIN,
          INSTANT_PROMPT_POSITION_MAX,
        );
        let nextY = clampNumber(
          drag.start[`${prefix}positionY`] + (dy / drag.mainHeight * 100),
          INSTANT_PROMPT_POSITION_MIN,
          INSTANT_PROMPT_POSITION_MAX,
        );
        if (!event.altKey) {
          if (Math.abs(nextX) < 2.5) nextX = 0;
          if (Math.abs(nextY) < 2.5) nextY = 0;
        }
        setStageOverride(`${prefix}positionX`, nextX);
        setStageOverride(`${prefix}positionY`, nextY);
      } else if (drag.kind === "widget-scale") {
        const index = state.instantPrompts.findIndex((prompt) => prompt.id === drag.selection.id);
        if (index < 0) return;
        const prefix = `instantPrompts[${index}].layout.frames.${drag.viewport}.`;
        const factor = 1 + (((drag.signX * (event.clientX - drag.startX))
          + (drag.signY * (event.clientY - drag.startY))) / drag.rectSize);
        setStageOverride(
          `${prefix}scale`,
          clampNumber(
            drag.start[`${prefix}scale`] * factor,
            INSTANT_PROMPT_SCALE_MIN,
            INSTANT_PROMPT_SCALE_MAX,
          ),
        );
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
        const prefix = greetingStagePrefix(drag.appearance, drag.frame);
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
        const prefix = greetingStagePrefix(drag.appearance, drag.frame);
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
      syncStageHud();
      reflectStageInputs(stageDrag.paths);
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
      commitStagePaths(drag.paths);
      applyDeferredGreetingMirrorAxes({ render: false });
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
      if (responsiveActive() && !responsiveEditExact()) {
        if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) {
          event.preventDefault();
          announce(tr("responsivePreviewOnly"));
        }
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
      if (selection.kind === "instant-prompt") {
        const index = state.instantPrompts.findIndex((prompt) => prompt.id === selection.id);
        if (index < 0) return;
        const prefix = `instantPrompts[${index}].layout.frames.${stageFrameId()}.`;
        if (handleKind === "scale" && scaleDirection) {
          adjust(
            `${prefix}scale`,
            scaleDirection * (event.shiftKey ? 0.1 : 0.05),
            INSTANT_PROMPT_SCALE_MIN,
            INSTANT_PROMPT_SCALE_MAX,
          );
        } else if (handleKind === "move") {
          const horizontal = handle.dataset.side === "e" || handle.dataset.side === "w";
          if (horizontal && event.key === "ArrowLeft") adjust(`${prefix}positionX`, -step, INSTANT_PROMPT_POSITION_MIN, INSTANT_PROMPT_POSITION_MAX);
          else if (horizontal && event.key === "ArrowRight") adjust(`${prefix}positionX`, step, INSTANT_PROMPT_POSITION_MIN, INSTANT_PROMPT_POSITION_MAX);
          else if (!horizontal && event.key === "ArrowUp") adjust(`${prefix}positionY`, -step, INSTANT_PROMPT_POSITION_MIN, INSTANT_PROMPT_POSITION_MAX);
          else if (!horizontal && event.key === "ArrowDown") adjust(`${prefix}positionY`, step, INSTANT_PROMPT_POSITION_MIN, INSTANT_PROMPT_POSITION_MAX);
        } else if (event.key === "ArrowLeft") adjust(`${prefix}positionX`, -step, INSTANT_PROMPT_POSITION_MIN, INSTANT_PROMPT_POSITION_MAX);
        else if (event.key === "ArrowRight") adjust(`${prefix}positionX`, step, INSTANT_PROMPT_POSITION_MIN, INSTANT_PROMPT_POSITION_MAX);
        else if (event.key === "ArrowUp") adjust(`${prefix}positionY`, -step, INSTANT_PROMPT_POSITION_MIN, INSTANT_PROMPT_POSITION_MAX);
        else if (event.key === "ArrowDown") adjust(`${prefix}positionY`, step, INSTANT_PROMPT_POSITION_MIN, INSTANT_PROMPT_POSITION_MAX);
        else if (event.key === "+" || event.key === "=") adjust(`${prefix}scale`, event.shiftKey ? 0.1 : 0.05, INSTANT_PROMPT_SCALE_MIN, INSTANT_PROMPT_SCALE_MAX);
        else if (event.key === "-" || event.key === "_") adjust(`${prefix}scale`, event.shiftKey ? -0.1 : -0.05, INSTANT_PROMPT_SCALE_MIN, INSTANT_PROMPT_SCALE_MAX);
      } else if (selection.kind === "layer") {
        const index = layerIndexForId(selection.id);
        if (index < 0) return;
        const prefix = `layers[${index}].frames.${stageFrameId()}.`;
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
          inspectorField = `layers[${index}].frames.${stageFrameId()}.${handleKind === "scale" ? "scale" : "positionX"}`;
        }
      } else if (selection.kind === "prompt") {
        inspectorField = "shared.prompt";
      } else if (selection.kind === "instant-prompt") {
        const index = state.instantPrompts.findIndex((prompt) => prompt.id === selection.id);
        inspectorField = `instantPrompts[${index}].layout.frames.${stageFrameId()}.${handleKind === "scale" ? "scale" : "positionX"}`;
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

    const stageViewportChoice = stageViewportInputs[0]?.closest("fieldset") ?? null;
    let renderedResponsiveSignature = null;
    const responsiveFrameMapForSelection = () => {
      if (!responsiveActive()) return null;
      if (stageSelection?.kind === "layer" || inspectorTarget === "background.layer") {
        const layer = layerForId(stageSelection?.kind === "layer" ? stageSelection.id : selectedLayerId);
        return layer ? { frames: layer.frames, inherited: RESPONSIVE_CLIENT_DEFAULTS.artwork, family: "artwork" } : null;
      }
      if (stageSelection?.kind === "greeting" || inspectorTarget === "interface.greeting") {
        return {
          frames: state.shared.greeting.explicitFrames?.[selectedMode] ?? {},
          inherited: RESPONSIVE_CLIENT_DEFAULTS.greeting,
          family: "greeting",
        };
      }
      if (stageSelection?.kind === "instant-prompt" || inspectorTarget === "widgets.instant-prompts") {
        const id = stageSelection?.kind === "instant-prompt" ? stageSelection.id : selectedInstantPromptId;
        const prompt = state.instantPrompts.find((item) => item.id === id);
        return prompt ? { frames: prompt.layout.frames, inherited: RESPONSIVE_CLIENT_DEFAULTS.widget, family: "widget", prompt } : null;
      }
      if (stageSelection?.kind === "prompt" || inspectorTarget === "interface.prompt-block") {
        return {
          frames: state.interfaceSurfaces?.promptBlock?.frame ?? {},
          inherited: {
            widthRatio: state.shared.prompt.width,
            offsetXRatio: state.shared.prompt.x,
            offsetYRatio: state.shared.prompt.y,
          },
          family: "prompt",
        };
      }
      return null;
    };
    const responsiveSelectionResolution = () => {
      const target = responsiveFrameMapForSelection();
      return target
        ? resolveResponsiveClientFrame(
          state.responsiveLayouts,
          target.frames,
          stagePreviewSize[0],
          target.inherited,
          target.family,
        )
        : null;
    };
    const selectResponsiveLayout = (id, { resizeAura = true } = {}) => {
      const set = responsiveSet(id);
      if (!set) return false;
      editingLayoutId = set.id;
      stagePreviewSize = [set.width, set.height];
      stageViewport = set.width >= 1440 ? "wide" : "normal";
      setPreviewInputValues(set.width, set.height);
      renderedResponsiveSignature = null;
      renderedLayerSignature = null;
      renderedInstantPromptSignature = null;
      reflectStageViewport();
      selectStageMirror();
      if (resizeAura) sendPreviewSize(`${set.width}x${set.height}`, stagePreviewSize);
      refreshInspectorContext();
      reflectShared();
      reflectSurfaceControls();
      reflectGreeting();
      renderLayers();
      renderInstantPromptEditor();
      renderStage();
      return true;
    };
    const syncResponsiveSelection = ({ entering = false } = {}) => {
      if (!responsiveActive()) {
        editingLayoutId = null;
        pendingResponsiveSelectionId = null;
        renderedResponsiveSignature = null;
        return;
      }
      const sets = state.responsiveLayouts.sets;
      const pending = pendingResponsiveSelectionId
        ? sets.find(({ id }) => id === pendingResponsiveSelectionId)
        : null;
      const retained = sets.find(({ id }) => id === editingLayoutId);
      const exact = sets.find(({ width, height }) => (
        width === stagePreviewSize[0] && height === stagePreviewSize[1]
      ));
      const next = pending ?? retained ?? (entering ? exact : null)
        ?? sets.find(({ id }) => id === "standard") ?? sets[0];
      editingLayoutId = next.id;
      if (pending) pendingResponsiveSelectionId = null;
      renderedResponsiveSignature = null;
    };
    const nextResponsiveLayoutId = () => {
      const used = new Set(state?.responsiveLayouts?.sets.map(({ id }) => id) ?? []);
      for (let number = 1; number <= 99; number += 1) {
        const id = `layout-${number}`;
        if (!used.has(id)) return id;
      }
      return null;
    };
    const postResponsiveMutation = (operation, id, value, selectId = null) => {
      const base = mutationBase();
      if (!base) return false;
      if (selectId) pendingResponsiveSelectionId = selectId;
      if (post({ type: "mutate-responsive-layout", ...base, operation, id, value })) return true;
      if (selectId) pendingResponsiveSelectionId = null;
      return false;
    };
    const responsiveTargetHasExplicitFrame = () => {
      const target = responsiveFrameMapForSelection();
      return Boolean(target && editingLayoutId && Object.keys(target.frames?.[editingLayoutId] ?? {}).length);
    };
    const resetResponsiveTarget = () => {
      if (!responsiveActive() || !responsiveEditExact() || !responsiveTargetHasExplicitFrame()) return false;
      const frame = editingLayoutId;
      if (stageSelection?.kind === "layer" || inspectorTarget === "background.layer") {
        const layer = layerForId(stageSelection?.kind === "layer" ? stageSelection.id : selectedLayerId);
        if (!layer) return false;
        queueThemeChanges(RESPONSIVE_CLIENT_FIELDS.artwork.map((property) => ({
          kind: "layer", layerId: layer.id, preset: frame, property, value: null,
        })), { immediate: true });
      } else if (stageSelection?.kind === "greeting" || inspectorTarget === "interface.greeting") {
        queueThemeChange({
          kind: "greeting", operation: "reset-frame", appearance: selectedMode,
          frame, value: null,
        }, { immediate: true });
      } else if (stageSelection?.kind === "instant-prompt" || inspectorTarget === "widgets.instant-prompts") {
        const target = responsiveFrameMapForSelection();
        if (!target?.prompt) return false;
        const layout = structuredClone(target.prompt.layout);
        delete layout.frames[frame];
        queueThemeChange({
          kind: "instant-prompt", operation: "update", id: target.prompt.id,
          field: "layout", locale: null, value: layout,
        }, { immediate: true });
      } else if (stageSelection?.kind === "prompt" || inspectorTarget === "interface.prompt-block") {
        queueThemeChanges(RESPONSIVE_CLIENT_FIELDS.prompt.map((property) => ({
          kind: "surface", target: "promptBlock", slot: "frame", axis: frame,
          property, value: null,
        })), { immediate: true });
      } else return false;
      announce(tr("responsiveTargetResetDone"));
      return true;
    };
    const renderResponsiveLayouts = () => {
      if (!responsiveLayoutPanel) return;
      const active = responsiveActive();
      const builtIn = isBuiltInLayoutEdit();
      responsiveLayoutPanel.hidden = builtIn;
      if (stageViewportChoice) {
        stageViewportChoice.hidden = active;
        stageViewportChoice.inert = active;
      }
      if (builtIn) return;
      responsiveLayoutEnable.hidden = active;
      responsiveLayoutEnable.disabled = active || isBlockingAction();
      responsiveLayoutTrack.hidden = !active;
      responsiveLayoutStatus.hidden = !active;
      responsiveLayoutAdvanced.hidden = !active;
      if (!active) {
        responsiveLayoutTrack.replaceChildren();
        responsiveLayoutAdd.hidden = true;
        return;
      }
      const layouts = state.responsiveLayouts;
      const selected = responsiveSet() ?? layouts.sets[0];
      const exactAny = layouts.sets.find(({ width, height }) => (
        width === stagePreviewSize[0] && height === stagePreviewSize[1]
      ));
      const signature = JSON.stringify([layouts, editingLayoutId, Boolean(pendingAction)]);
      if (signature !== renderedResponsiveSignature) {
        renderedResponsiveSignature = signature;
        const nodes = [];
        layouts.sets.forEach((set, index) => {
          if (layouts.mode === "step" && index > 0) {
            const breakpoint = document.createElement("label");
            breakpoint.className = "responsive-layout-breakpoint advanced-only";
            const copy = document.createElement("span");
            copy.textContent = format(tr("layoutBreakpointBefore"), set.label);
            const input = document.createElement("input");
            input.type = "number";
            input.min = String(layouts.sets[index - 1].width + 1);
            input.max = String(set.width - 1);
            input.step = "1";
            input.value = String(layouts.breakpoints[index - 1]);
            input.disabled = Boolean(pendingAction);
            input.addEventListener("change", () => {
              const value = Math.round(input.valueAsNumber);
              if (!integer(value, Number(input.min), Number(input.max))) {
                input.value = String(layouts.breakpoints[index - 1]);
                return;
              }
              postResponsiveMutation("breakpoint", set.id, value);
            });
            breakpoint.append(copy, input);
            nodes.push(breakpoint);
          }
          const button = document.createElement("button");
          button.type = "button";
          button.className = "responsive-layout-set";
          button.dataset.layoutId = set.id;
          button.setAttribute("aria-pressed", String(set.id === editingLayoutId));
          button.disabled = Boolean(pendingAction);
          const label = document.createElement("strong");
          label.textContent = set.label;
          const dimensions = document.createElement("span");
          dimensions.textContent = `${set.width}×${set.height}`;
          button.append(label, dimensions);
          button.addEventListener("click", () => selectResponsiveLayout(set.id));
          nodes.push(button);
        });
        responsiveLayoutTrack.replaceChildren(...nodes);
      }
      responsiveLayoutAdd.hidden = Boolean(exactAny) || layouts.sets.length >= 6;
      responsiveLayoutAdd.disabled = Boolean(pendingAction);
      responsivePreviewing.textContent = exactAny
        ? `${exactAny.label} · ${stagePreviewSize[0]}×${stagePreviewSize[1]}`
        : `${stagePreviewSize[0]}×${stagePreviewSize[1]}`;
      responsiveEditing.textContent = `${selected.label} · ${selected.width}×${selected.height}`;
      const resolution = responsiveSelectionResolution();
      const lower = layouts.sets.find(({ id }) => id === resolution?.lowerId);
      const upper = layouts.sets.find(({ id }) => id === resolution?.upperId);
      responsiveBetween.textContent = resolution?.source === "interpolated" && lower && upper
        ? format(tr("betweenLayouts"), lower.label, upper.label, Math.round(resolution.t * 100))
        : tr("betweenNone");
      responsiveSource.textContent = tr(resolution?.source === "explicit"
        ? "sourceExplicit"
        : resolution?.source === "interpolated" ? "sourceInterpolated" : "sourceInherited");
      responsiveLayoutName.value = selected.label;
      responsiveLayoutWidth.value = String(selected.width);
      responsiveLayoutHeight.value = String(selected.height);
      responsiveLayoutMode.value = layouts.mode;
      for (const input of [responsiveLayoutName, responsiveLayoutWidth, responsiveLayoutHeight, responsiveLayoutMode]) {
        input.disabled = Boolean(pendingAction);
      }
      responsiveLayoutDuplicate.disabled = Boolean(pendingAction) || layouts.sets.length >= 6;
      responsiveLayoutDelete.disabled = Boolean(pendingAction) || layouts.sets.length <= 1;
      responsiveTargetReset.disabled = Boolean(pendingAction)
        || !responsiveEditExact() || !responsiveTargetHasExplicitFrame();
      responsiveLayoutPanel.dataset.previewOnly = String(!responsiveEditExact());
    };

    responsiveLayoutEnable?.addEventListener("click", () => {
      const base = mutationBase();
      if (!base) return;
      pendingResponsiveSelectionId = "standard";
      if (!post({ type: "enable-responsive-layouts", ...base })) pendingResponsiveSelectionId = null;
    });
    responsiveLayoutAdd?.addEventListener("click", () => {
      if (!responsiveActive() || state.responsiveLayouts.sets.length >= 6) return;
      const id = nextResponsiveLayoutId();
      if (!id) return;
      postResponsiveMutation("add", id, {
        id,
        label: format(tr("layoutDefaultName"), state.responsiveLayouts.sets.length + 1),
        width: stagePreviewSize[0],
        height: stagePreviewSize[1],
      }, id);
    });
    const postResponsiveSetUpdate = () => {
      const selected = responsiveSet();
      if (!selected) return;
      const label = responsiveLayoutName.value.trim();
      const width = Math.round(responsiveLayoutWidth.valueAsNumber);
      const height = Math.round(responsiveLayoutHeight.valueAsNumber);
      if (!label || label.length > 40 || !integer(width, 920, 3840) || !integer(height, 620, 2400)) {
        renderResponsiveLayouts();
        announce(tr("responsiveLayoutInvalid"), "error");
        return;
      }
      postResponsiveMutation("update", selected.id, { label, width, height });
    };
    responsiveLayoutName?.addEventListener("change", postResponsiveSetUpdate);
    responsiveLayoutWidth?.addEventListener("change", postResponsiveSetUpdate);
    responsiveLayoutHeight?.addEventListener("change", postResponsiveSetUpdate);
    responsiveLayoutMode?.addEventListener("change", () => {
      if (responsiveActive()) postResponsiveMutation("mode", null, responsiveLayoutMode.value);
    });
    responsiveLayoutDuplicate?.addEventListener("click", () => {
      const selected = responsiveSet();
      const id = nextResponsiveLayoutId();
      if (!selected || !id || state.responsiveLayouts.sets.length >= 6) return;
      const used = new Set(state.responsiveLayouts.sets.map(({ width }) => width));
      let width = selected.width + 20;
      while (width <= 3840 && used.has(width)) width += 1;
      if (width > 3840) {
        width = selected.width - 20;
        while (width >= 920 && used.has(width)) width -= 1;
      }
      if (width < 920 || width > 3840) return;
      postResponsiveMutation("duplicate", selected.id, {
        id,
        label: truncateText(format(tr("layoutCopyName"), selected.label), 40),
        width,
        height: selected.height,
      }, id);
    });
    responsiveLayoutDelete?.addEventListener("click", () => {
      const selected = responsiveSet();
      if (!selected || state.responsiveLayouts.sets.length <= 1) return;
      const fallback = state.responsiveLayouts.sets.find(({ id }) => id !== selected.id);
      showConfirm({
        titleText: tr("deleteLayout"),
        bodyText: format(tr("deleteLayoutConfirm"), selected.label),
        actionText: tr("deleteLayout"),
        destructive: true,
        opener: responsiveLayoutDelete,
        callback: () => postResponsiveMutation("delete", selected.id, null, fallback?.id ?? null),
      });
    });
    responsiveTargetReset?.addEventListener("click", resetResponsiveTarget);

    stageViewportInputs.forEach((input) => input.addEventListener("change", () => {
      if (!input.checked) return;
      if (responsiveActive()) return;
      stageViewport = input.value;
      stagePreviewSize = [...STAGE_SIZES[stageViewport]];
      setPreviewInputValues(...stagePreviewSize);
      // Viewport controls resize Aura without foregrounding it; the next
      // private capture becomes the stage backdrop while Studio stays usable.
      sendPreviewSize(input.value === "wide" ? "wide" : "launch", stagePreviewSize);
      refreshInspectorContext();
      selectStageMirror();
      reflectShared();
      reflectSurfaceControls();
      reflectGreeting();
      renderStage();
    }));
    stageContextInputs.forEach((input) => input.addEventListener("change", () => {
      if (!input.checked) return;
      stageContextTouched = true;
      stageContext = input.value;
      renderedInstantPromptSignature = null;
      selectStageMirror();
      renderInstantPromptEditor();
      refreshInspectorContext();
      renderStage();
      announce(format(tr("stageContextSelected"), stageContextLabel()));
    }));
    const switchToNewChatPreview = () => {
      stageContextTouched = true;
      stageContext = "new-chat";
      renderedInstantPromptSignature = null;
      for (const input of stageContextInputs) input.checked = input.value === stageContext;
      selectStageMirror();
      renderInstantPromptEditor();
      refreshInspectorContext();
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
      setInspectorTarget(inspectorTarget, { routePage: false, resetScroll: false });
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
    const normalizeMirrorSizing = (value, width, height) => {
      if (!exactShape(value, [
        "requestedWidth", "requestedHeight", "actualWidth", "actualHeight",
        "nativeWidth", "nativeHeight", "dpr", "settled",
      ])) return null;
      const requested = value.requestedWidth === null && value.requestedHeight === null
        ? null
        : [value.requestedWidth, value.requestedHeight];
      if (requested && (!integer(requested[0], 200, 6000) || !integer(requested[1], 200, 6000))) return null;
      if ((value.requestedWidth === null) !== (value.requestedHeight === null)
          || !integer(value.actualWidth, 200, 6000) || !integer(value.actualHeight, 200, 6000)
          || value.actualWidth !== width || value.actualHeight !== height
          || !integer(value.nativeWidth, 1, 30000) || !integer(value.nativeHeight, 1, 30000)
          || !inRange(value.dpr, 0.25, 8) || typeof value.settled !== "boolean") return null;
      return {
        requestedWidth: value.requestedWidth,
        requestedHeight: value.requestedHeight,
        actualWidth: value.actualWidth,
        actualHeight: value.actualHeight,
        nativeWidth: value.nativeWidth,
        nativeHeight: value.nativeHeight,
        dpr: value.dpr,
        settled: value.settled,
      };
    };
    const normalizeMirror = (value) => {
      if (!exactShape(value, ["type", "image", "width", "height", "revision", "request", "sizing"], ["geometry"])
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
      const sizing = normalizeMirrorSizing(value.sizing, value.width, value.height);
      if (!sizing) return null;
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
        revision: value.revision, request: value.request, sizing, geometry,
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
    const followLiveMirrorAxes = (
      mirror,
      {
        force = false,
        first = false,
        previousContext = null,
        previousMode = null,
      } = {},
    ) => {
      if (!hasUsableMirrorGeometry(mirror)) return;
      stageViewport = mirror.geometry.viewport;
      reflectStageViewport();
      const realContext = mirror.geometry.context;
      if ((realContext === "new-chat" || realContext === "conversation")
          && !stageContextTouched
          && (force || first || realContext !== previousContext)) {
        stageContext = realContext;
      }
      const realMode = mirror.geometry.mode;
      if (realMode && !appearanceTouched && realMode !== selectedMode
          && (force || first || realMode !== previousMode)) {
        selectedMode = realMode;
        syncModeInputs();
        reflectTokens();
      }
      reflectGreeting();
    };
    const applyDeferredGreetingMirrorAxes = ({ render = true } = {}) => {
      if (!greetingMirrorAxesDeferred || !hasUsableMirrorGeometry(stageLiveMirror)) return;
      greetingMirrorAxesDeferred = false;
      followLiveMirrorAxes(stageLiveMirror, { force: true });
      selectStageMirror();
      if (render) renderStage();
    };
    const receiveMirror = (raw) => {
      const mirror = normalizeMirror(raw);
      if (!mirror || mirror.revision !== state?.revision) return false;
      if (previewExpectedRequest !== null && mirror.request !== previewExpectedRequest) return false;
      if (previewSizeEditing) {
        if (previewExpectedRequest === null && !previewSizeIntent) return false;
        if (previewSizeIntent && (
          mirror.sizing.requestedWidth !== previewSizeIntent[0]
          || mirror.sizing.requestedHeight !== previewSizeIntent[1]
        )) return false;
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
        const greetingGestureActive = Boolean(activeGreetingControlScope)
          || stageDrag?.selection?.kind === "greeting";
        if (greetingGestureActive) greetingMirrorAxesDeferred = true;
        else followLiveMirrorAxes(mirror, { first, previousContext, previousMode });
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
            syncModeInputs();
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
        const frameValues = activeArtworkFrame(layer);
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
      const [logicalWidth, logicalHeight] = stagePreviewSize;
      const hostWidth = matrixHost.clientWidth;
      const cellWidth = hostWidth > 40 ? Math.max(60, (hostWidth - 30) / 4) : 132;
      const cellScale = cellWidth / logicalWidth;
      const frameHeight = `${Math.round(logicalHeight * cellScale)}px`;
      const scope = state.shared.backgroundScope;
      const mainWidth = logicalWidth - STAGE_SIDEBAR_WIDTH;
      const scopeRect = backgroundScopeRect(scope, logicalWidth, logicalHeight, {
        left: STAGE_SIDEBAR_WIDTH,
        width: mainWidth,
        height: logicalHeight,
      });
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
        entry.art.style.left = `${scopeRect.left}px`;
        entry.art.style.right = `${Math.max(0, logicalWidth - scopeRect.left - scopeRect.width)}px`;
        reconcileMatrixLayers(entry);
        entry.sidebar.style.width = `${STAGE_SIDEBAR_WIDTH}px`;
        entry.sidebar.style.background = scope !== "content"
          ? `color-mix(in srgb, ${tokens.sidebar} ${Math.round(tokens.sidebarAlpha * 100)}%, transparent)`
          : tokens.sidebar;
        const block = entry.block;
        block.style.background = `color-mix(in srgb, ${tokens.surface} ${Math.round(tokens.surfaceAlpha * 100)}%, transparent)`;
        block.style.border = `1px solid ${tokens.border}`;
        block.style.borderRadius = `${state.shared.radius}px`;
        if (context === "new-chat") {
          const rect = promptRect(logicalWidth, logicalHeight,
            promptStateValue("width"), promptStateValue("x"), promptStateValue("y"));
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
              queueTokenChange(selectedMode, token, picker.value.toUpperCase());
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
              queueTokenChange(selectedMode, token, Number(range.value) / 100);
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
      syncBackgroundScopeControls(backgroundScope);
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
        const frameOverride = state.interfaceSurfaces?.promptBlock?.frame?.[greetingFrameId()] ?? null;
        nativePromptNote.hidden = !values.prompt.native || Boolean(frameOverride)
          || STAGE_PROMPT_PATHS.some((path) => stageOverrides.has(path));
      }
      if (promptResetInheritedButton) {
        const frame = state.interfaceSurfaces?.promptBlock?.frame?.[greetingFrameId()] ?? {};
        promptResetInheritedButton.disabled = !Object.keys(frame).some((property) => promptFrameProperties.has(property))
          || Boolean(pendingAction) || (responsiveActive() && !responsiveEditExact());
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
    const clearGreetingInputState = (personal = state?.greetingPreferences ?? null) => {
      greetingPreferenceDraft = personal ? structuredClone(personal) : null;
      greetingPreferenceDraftDirty = false;
      greetingPreferenceInputDirty = false;
      greetingPreferenceInputInvalid = false;
      greetingPreferenceErrorTarget = null;
      greetingStageRequested = false;
      if (greetingStageTimer) {
        clearTimeout(greetingStageTimer);
        greetingStageTimer = null;
      }
      greetingNameInput?.removeAttribute("aria-invalid");
      greetingPhrasesInput?.removeAttribute("aria-invalid");
      greetingOverrideInput?.removeAttribute("aria-invalid");
      greetingOverridePhrasesInput?.removeAttribute("aria-invalid");
      if (greetingPhrasesStatus) greetingPhrasesStatus.hidden = true;
    };
    const greetingThemeOverride = (personal = greetingDraft()) => (
      greetingThemeOverrideFor(personal, state?.id)
    );
    const greetingHasLocalFrameDraft = () => [...stageOverrides.keys()].some(
      (path) => path.startsWith("shared.greeting.frames."),
    );
    const greetingUsesNativeLayout = () => greetingStyleIntent === null
      ? Boolean(state?.shared?.greeting?.native && !greetingHasLocalFrameDraft())
      : !greetingStyleIntent;
    const syncGreetingWordControls = (personal = greetingDraft()) => {
      if (!personal) return;
      const custom = personal.enabled && personal.source === "custom";
      const locked = isBuiltInLayoutEdit() || Boolean(pendingAction)
        || Boolean(greetingResyncPending) || Boolean(patchResyncPending)
        || Boolean(changeFlushTimer)
        || coalescedChanges.size > 0 || deferredChanges.size > 0
        || uncertainChanges.size > 0 || inFlightChanges.length > 0;
      for (const input of greetingSourceInputs) input.disabled = locked;
      if (greetingNameInput) greetingNameInput.disabled = locked || !custom;
      if (greetingPhrasesInput) greetingPhrasesInput.disabled = locked || !custom;
      if (greetingOverrideInput) greetingOverrideInput.disabled = locked || !custom;
      if (greetingOverridePhrasesInput) {
        greetingOverridePhrasesInput.disabled = locked || !custom
          || greetingThemeOverride(personal).mode !== "custom";
      }
    };
    const syncGreetingFrameControls = () => {
      const locked = isBuiltInLayoutEdit() || isBlockingAction() || greetingStyleLocked
        || (responsiveActive() && !responsiveEditExact());
      const native = greetingUsesNativeLayout();
      if (greetingEnableInput) greetingEnableInput.disabled = locked;
      for (const input of greetingInputs) input.disabled = locked || native;
      for (const exact of greetingExactInputs) exact.disabled = locked || native;
    };
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
      const greetingNative = greetingUsesNativeLayout();
      if (greetingEnableInput) greetingEnableInput.checked = !greetingNative;
      if (greetingNativeNote) greetingNativeNote.hidden = !greetingNative;
      if (greetingCollisionWarning) {
        greetingCollisionWarning.hidden = greetingNative
          || (!state.isNew && state.source !== "user")
          || state.layers.length === 0;
      }
      const compactOption = greetingMarkInput?.querySelector('option[value="compact"]');
      if (compactOption) {
        compactOption.disabled = !greetingState.compactMarkAvailable;
        compactOption.hidden = !greetingState.compactMarkAvailable;
      }
      reflectGreetingPreview(greeting, greetingNative);
      const personal = greetingDraft();
      if (!personal) return;
      const personalSource = greetingSourceChoice(personal);
      for (const input of greetingSourceInputs) input.checked = input.value === personalSource;
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
      if (greetingOverridePhrasesField) greetingOverridePhrasesField.hidden = override.mode !== "custom";
      syncGreetingWordControls(personal);
      for (const input of greetingInputs) {
        const field = input.dataset.editorGreeting;
        input.dataset.editorField = `${greetingStagePrefix()}${field}`;
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
      syncGreetingFrameControls();
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

    const metadataLocaleEnabled = (locale) => {
      const override = `metadata.locale.${locale}`;
      if (stageOverrides.has(override)) return Boolean(stageOverrides.get(override));
      return Boolean(state?.metadata?.labels && Object.hasOwn(state.metadata.labels, locale));
    };
    const selectedMetadataLocales = () => THEME_METADATA_LOCALES
      .filter(({ id }) => metadataLocaleEnabled(id));
    const clearMetadataOverrides = () => {
      for (const key of [...stageOverrides.keys()]) {
        if (key.startsWith("metadata.")) stageOverrides.delete(key);
      }
      renderedMetadataLocaleSignature = "";
    };
    const metadataControlId = (kind, locale) =>
      `editor-${kind}-${locale.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-")}`;
    const reconcileMetadataOverrides = () => {
      if (!state) return;
      for (const { id: locale } of THEME_METADATA_LOCALES) {
        const enabledPath = `metadata.locale.${locale}`;
        if (stageOverrides.has(enabledPath)
            && stageOverrides.get(enabledPath) === Object.hasOwn(state.metadata.labels, locale)) {
          stageOverrides.delete(enabledPath);
        }
        for (const collection of ["labels", "descriptions"]) {
          const path = `metadata.${collection}.${locale}`;
          if (stageOverrides.has(path)
              && Object.hasOwn(state.metadata[collection], locale)
              && String(stageOverrides.get(path)) === String(state.metadata[collection][locale])) {
            stageOverrides.delete(path);
          }
        }
      }
    };
    const renderMetadataLocales = ({ focusLocale = null } = {}) => {
      if (!state) return;
      reconcileMetadataOverrides();
      const selected = selectedMetadataLocales();
      const signature = selected.map(({ id }) => id).join("|");
      for (const checkbox of metadataLocaleCheckboxes()) {
        checkbox.checked = selected.some(({ id }) => id === checkbox.value);
        checkbox.disabled = checkbox.value === "en" || isBuiltInLayoutEdit() || isBlockingAction();
      }
      if (metadataLanguageSelection) {
        metadataLanguageSelection.textContent = selected
          .map(({ id, name }) => `${name} · ${id}`).join(", ");
      }
      if (!metadataLocalesHost || signature === renderedMetadataLocaleSignature) return;
      renderedMetadataLocaleSignature = signature;
      const cards = selected.map(({ id: locale, name }) => {
        const card = document.createElement("section");
        card.className = "editor-locale-card";
        card.dataset.editorMetadataCard = locale;

        const heading = document.createElement("div");
        heading.className = "editor-locale-card-head";
        const identity = document.createElement("div");
        identity.className = "editor-locale-identity";
        const title = document.createElement("strong");
        title.textContent = name;
        title.lang = locale;
        const code = document.createElement("code");
        code.textContent = locale;
        identity.append(title, code);
        heading.appendChild(identity);
        if (locale === "en") {
          const required = document.createElement("span");
          required.className = "editor-locale-required";
          required.textContent = tr("themeLanguageRequired");
          heading.appendChild(required);
        }

        const fields = document.createElement("div");
        fields.className = "editor-locale-card-fields";
        const nameId = metadataControlId("label", locale);
        const nameField = document.createElement("label");
        nameField.className = "editor-field";
        nameField.htmlFor = nameId;
        const nameLabel = document.createElement("span");
        nameLabel.className = "editor-metadata-label";
        nameLabel.textContent = tr("themeFieldName");
        const nameInput = document.createElement("input");
        nameInput.id = nameId;
        nameInput.type = "text";
        nameInput.maxLength = 80;
        nameInput.autocomplete = "off";
        nameInput.required = true;
        nameInput.lang = locale;
        nameInput.dataset.editorMetadata = "label";
        nameInput.dataset.editorLocale = locale;
        nameInput.dataset.editorField = `metadata.labels.${locale}`;
        nameInput.value = String(stageValue(`metadata.labels.${locale}`) ?? "");
        if (!nameInput.value.trim()) nameInput.setAttribute("aria-invalid", "true");
        nameField.append(nameLabel, nameInput);

        const descriptionId = metadataControlId("description", locale);
        const descriptionField = document.createElement("label");
        descriptionField.className = "editor-field";
        descriptionField.htmlFor = descriptionId;
        const descriptionLabel = document.createElement("span");
        descriptionLabel.className = "editor-metadata-label";
        descriptionLabel.textContent = tr("themeFieldDescription");
        const descriptionInput = document.createElement("textarea");
        descriptionInput.id = descriptionId;
        descriptionInput.rows = 3;
        descriptionInput.maxLength = 220;
        descriptionInput.required = true;
        descriptionInput.lang = locale;
        descriptionInput.dataset.editorMetadata = "description";
        descriptionInput.dataset.editorLocale = locale;
        descriptionInput.dataset.editorField = `metadata.descriptions.${locale}`;
        descriptionInput.value = String(stageValue(`metadata.descriptions.${locale}`) ?? "");
        if (!descriptionInput.value.trim()) descriptionInput.setAttribute("aria-invalid", "true");
        descriptionField.append(descriptionLabel, descriptionInput);

        fields.append(nameField, descriptionField);
        card.append(heading, fields);
        return card;
      });
      metadataLocalesHost.replaceChildren(...cards);
      metadataInputInvalid = metadataInputs().some((input) => !input.value.trim());
      if (focusLocale) {
        requestAnimationFrame(() => metadataLocalesHost
          .querySelector(`[data-editor-metadata-card="${CSS.escape(focusLocale)}"] input`)?.focus());
      }
    };
    const reflectMetadata = () => {
      if (!state) return;
      renderMetadataLocales();
      for (const input of metadataInputs()) {
        if (metadataInputInvalid && input.getAttribute("aria-invalid") === "true"
            && document.activeElement === input) continue;
        const collection = input.dataset.editorMetadata === "label" ? "labels" : "descriptions";
        const path = `metadata.${collection}.${input.dataset.editorLocale}`;
        const value = String(stageValue(path) ?? "");
        if (input.value !== value) input.value = value;
        input.toggleAttribute("aria-invalid", !value.trim());
      }
      metadataInputInvalid = metadataInputs().some((input) => !input.value.trim());
    };

    const normalizeCardPreviewCrop = (value) => (
      exactShape(value, ["x", "y", "zoom"])
        && inRange(value.x, 0, 100)
        && inRange(value.y, 0, 100)
        && inRange(value.zoom, 1, 6)
        ? Object.freeze({ x: value.x, y: value.y, zoom: value.zoom })
        : null
    );

    const normalizeCardPreview = (value, expectedThemeId) => {
      if (!exactShape(value, ["themeId", "imageUrl", "crop", "defaultCrop", "label"])
          || value.themeId !== expectedThemeId
          || !ID_PATTERN.test(value.themeId)) return null;
      const allowedUrls = new Set([
        `https://aura.previews/${value.themeId}.png`,
        `https://aura.assets/${value.themeId}/card-preview.webp`,
        `https://aura.user-themes/${value.themeId}/card-preview.webp`,
      ]);
      if (typeof value.imageUrl !== "string" || !allowedUrls.has(value.imageUrl)) return null;
      const crop = normalizeCardPreviewCrop(value.crop);
      const defaultCrop = normalizeCardPreviewCrop(value.defaultCrop);
      const label = safeText(value.label, 120);
      if (!crop || !defaultCrop || !label) return null;
      return Object.freeze({
        themeId: value.themeId,
        imageUrl: value.imageUrl,
        crop,
        defaultCrop,
        label,
      });
    };

    const layoutCardPreview = () => {
      if (!cardPreviewState || !cardPreviewFrame || !cardPreviewImage) return;
      const frameWidth = cardPreviewFrame.clientWidth;
      const frameHeight = cardPreviewFrame.clientHeight;
      if (!frameWidth || !frameHeight || !cardPreviewImage.naturalWidth
          || !cardPreviewImage.naturalHeight) return;
      const scale = Math.max(
        frameWidth / cardPreviewImage.naturalWidth,
        frameHeight / cardPreviewImage.naturalHeight,
      ) * cardPreviewState.crop.zoom;
      const width = cardPreviewImage.naturalWidth * scale;
      const height = cardPreviewImage.naturalHeight * scale;
      const overflowX = Math.max(0, width - frameWidth);
      const overflowY = Math.max(0, height - frameHeight);
      cardPreviewImage.style.width = `${width}px`;
      cardPreviewImage.style.height = `${height}px`;
      cardPreviewImage.style.left = `${-overflowX * cardPreviewState.crop.x / 100}px`;
      cardPreviewImage.style.top = `${-overflowY * cardPreviewState.crop.y / 100}px`;
    };

    const reflectCardPreview = () => {
      if (!cardPreviewPanel || !cardPreviewImage || !adjustCardPreviewButton) return;
      let preview = null;
      if (state && !isBuiltInLayoutEdit() && typeof getThemeCardPreview === "function") {
        try {
          preview = normalizeCardPreview(getThemeCardPreview(state.id), state.id);
        } catch {
          preview = null;
        }
      }
      cardPreviewState = preview;
      cardPreviewPanel.hidden = !preview;
      cardPreviewPanel.inert = !preview;
      if (!preview) {
        cardPreviewImage.removeAttribute("src");
        cardPreviewImage.style.removeProperty("width");
        cardPreviewImage.style.removeProperty("height");
        cardPreviewImage.style.removeProperty("left");
        cardPreviewImage.style.removeProperty("top");
        adjustCardPreviewButton.removeAttribute("aria-label");
        return;
      }
      adjustCardPreviewButton.setAttribute("aria-label", format(tr("adjustPreviewFor"), preview.label));
      if (cardPreviewImage.src !== preview.imageUrl) cardPreviewImage.src = preview.imageUrl;
      requestAnimationFrame(layoutCardPreview);
    };

    cardPreviewImage?.addEventListener("load", layoutCardPreview);
    const cardPreviewResizeObserver = typeof ResizeObserver === "function" && cardPreviewFrame
      ? new ResizeObserver(layoutCardPreview)
      : null;
    cardPreviewResizeObserver?.observe(cardPreviewFrame);
    adjustCardPreviewButton?.addEventListener("click", () => {
      if (!state || !cardPreviewState || typeof openThemeCardPreview !== "function") {
        announce(tr("previewUnavailable"), "error");
        return;
      }
      try {
        if (!openThemeCardPreview(state.id, adjustCardPreviewButton)) {
          announce(tr("previewUnavailable"), "error");
        }
      } catch {
        announce(tr("previewUnavailable"), "error");
      }
    });

    const option = (value, label) => {
      const node = document.createElement("option");
      node.value = value;
      node.textContent = label;
      return node;
    };

    const instantPromptLocaleName = (localeId) => (
      THEME_METADATA_LOCALES.find(({ id }) => id === localeId)?.name ?? localeId
    );
    const instantPromptChange = (prompt, operation, {
      field = null,
      locale: promptLocale = null,
      value = null,
      immediate = true,
    } = {}) => queueThemeChange({
      kind: "instant-prompt",
      operation,
      id: prompt.id,
      field,
      locale: promptLocale,
      value,
    }, { immediate });
    const instantPromptSeed = () => {
      const seed = {
        en: ["New prompt", "What would you like Claude to help with?"],
        "zh-CN": ["快捷提示", "请描述你希望 Claude 协助的内容。"],
        "zh-HKTW": ["快速提示", "請描述你希望 Claude 協助的內容。"],
      };
      const locales = Object.keys(state?.metadata?.labels ?? { en: "" });
      const labels = {};
      const prompts = {};
      for (const promptLocale of locales) {
        const values = seed[promptLocale] ?? seed.en;
        labels[promptLocale] = values[0];
        prompts[promptLocale] = values[1];
      }
      if (!Object.hasOwn(labels, "en")) {
        labels.en = seed.en[0];
        prompts.en = seed.en[1];
      }
      return {
        id: `prompt-${window.crypto.randomUUID().replaceAll("-", "").toLowerCase()}`,
        labels,
        prompts,
        icon: null,
        layout: responsiveActive()
          ? { opacity: 1, frames: {} }
          : defaultInstantPromptLayout(),
      };
    };
    const requestInstantPromptIcon = (id) => {
      const base = mutationBase();
      if (base) post({ type: "pick-instant-prompt-icon", ...base, id });
    };
    const renderInstantPromptEditor = () => {
      if (!instantPromptList || !state) return;
      if (!state.instantPrompts.some((prompt) => prompt.id === selectedInstantPromptId)) {
        selectedInstantPromptId = state.instantPrompts[0]?.id ?? null;
      }
      const conversation = stageContext !== "new-chat";
      const signature = JSON.stringify([
        state.instantPrompts,
        selectedInstantPromptId,
        normalizedLocale,
        conversation,
        isBuiltInLayoutEdit(),
        state.responsiveLayouts,
        editingLayoutId,
        stagePreviewSize,
      ]);
      if (signature === renderedInstantPromptSignature) return;
      renderedInstantPromptSignature = signature;
      const focused = document.activeElement?.dataset?.editorFocus ?? null;
      instantPromptList.replaceChildren();
      state.instantPrompts.forEach((prompt, index) => {
        const selected = prompt.id === selectedInstantPromptId;
        const card = document.createElement("details");
        card.className = "instant-prompt-card";
        card.dataset.instantPromptId = prompt.id;
        card.dataset.selected = String(selected);
        card.open = selected;
        const summary = document.createElement("summary");
        summary.dataset.editorFocus = `instant-prompt-${prompt.id}`;
        summary.dataset.editorField = `instantPrompts[${index}]`;
        const icon = document.createElement("span");
        icon.className = "instant-prompt-card-icon";
        if (prompt.iconPreviewUrl) {
          const image = document.createElement("img");
          image.src = prompt.iconPreviewUrl;
          image.alt = "";
          image.setAttribute("aria-hidden", "true");
          icon.appendChild(image);
        } else {
          icon.textContent = "A";
          icon.setAttribute("aria-hidden", "true");
        }
        const copy = document.createElement("span");
        copy.className = "instant-prompt-card-copy";
        const title = document.createElement("strong");
        title.textContent = prompt.labels[normalizedLocale] ?? prompt.labels.en;
        const description = document.createElement("small");
        description.textContent = prompt.prompts[normalizedLocale] ?? prompt.prompts.en;
        copy.append(title, description);
        const order = document.createElement("span");
        order.className = "layer-order";
        order.textContent = `${index + 1} / ${state.instantPrompts.length}`;
        summary.append(icon, copy, order);
        summary.addEventListener("click", () => {
          selectedInstantPromptId = prompt.id;
          inspectorField = `instantPrompts[${index}]`;
          stageSelection = { kind: "instant-prompt", id: prompt.id };
          renderedInstantPromptSignature = null;
          setInspectorTarget("widgets.instant-prompts");
          requestAnimationFrame(() => {
            renderInstantPromptEditor();
            renderStage();
            syncStageHud();
          });
        });
        const body = document.createElement("div");
        body.className = "instant-prompt-card-body";
        for (const promptLocale of Object.keys(prompt.labels)) {
          const localeGroup = document.createElement("section");
          localeGroup.className = "instant-prompt-locale";
          const localeTitle = document.createElement("strong");
          localeTitle.textContent = instantPromptLocaleName(promptLocale);
          const labelField = document.createElement("label");
          labelField.className = "editor-field";
          const labelText = document.createElement("span");
          labelText.textContent = tr("instantPromptLabel");
          const labelInput = document.createElement("input");
          labelInput.type = "text";
          labelInput.maxLength = 48;
          labelInput.value = prompt.labels[promptLocale];
          labelInput.disabled = conversation;
          labelInput.dataset.editorFocus = `instant-prompt-${prompt.id}-${promptLocale}-label`;
          labelInput.dataset.editorField = `instantPrompts[${index}].labels.${promptLocale}`;
          labelInput.addEventListener("input", () => {
            if (promptLocale === normalizedLocale || (normalizedLocale !== "en" && !prompt.labels[normalizedLocale])) {
              title.textContent = labelInput.value || prompt.labels.en;
            }
          });
          labelInput.addEventListener("change", () => {
            const value = labelInput.value.trim();
            if (!value) {
              labelInput.value = prompt.labels[promptLocale];
              announce(tr("instantPromptValueRequired"), "error");
              return;
            }
            instantPromptChange(prompt, "update", { field: "label", locale: promptLocale, value });
          });
          labelField.append(labelText, labelInput);
          const promptField = document.createElement("label");
          promptField.className = "editor-field";
          const promptText = document.createElement("span");
          promptText.textContent = tr("instantPromptText");
          const promptInput = document.createElement("textarea");
          promptInput.rows = 4;
          promptInput.maxLength = 1200;
          promptInput.value = prompt.prompts[promptLocale];
          promptInput.disabled = conversation;
          promptInput.dataset.editorFocus = `instant-prompt-${prompt.id}-${promptLocale}-prompt`;
          promptInput.dataset.editorField = `instantPrompts[${index}].prompts.${promptLocale}`;
          promptInput.addEventListener("input", () => {
            if (promptLocale === normalizedLocale || (normalizedLocale !== "en" && !prompt.prompts[normalizedLocale])) {
              description.textContent = promptInput.value || prompt.prompts.en;
              const ticketCopy = stageInstantPromptRail.querySelector(
                `[data-instant-prompt-id="${CSS.escape(prompt.id)}"] > span`,
              );
              if (ticketCopy) ticketCopy.dataset.prompt = promptInput.value || prompt.prompts.en;
            }
          });
          promptInput.addEventListener("change", () => {
            const value = promptInput.value.trim();
            if (!value) {
              promptInput.value = prompt.prompts[promptLocale];
              announce(tr("instantPromptValueRequired"), "error");
              return;
            }
            instantPromptChange(prompt, "update", { field: "prompt", locale: promptLocale, value });
          });
          promptField.append(promptText, promptInput);
          localeGroup.append(localeTitle, labelField, promptField);
          body.appendChild(localeGroup);
        }
        if (responsiveActive()) {
          const frame = activeInstantPromptFrame(prompt);
          const fieldset = document.createElement("fieldset");
          fieldset.className = "instant-prompt-layout-fields advanced-only";
          fieldset.disabled = conversation || !responsiveEditExact();
          const legend = document.createElement("legend");
          legend.textContent = format(tr("instantPromptLayoutFor"), frameDisplayLabel());
          fieldset.appendChild(legend);
          const definitions = [
            ["positionX", "positionX", -50, 50, 1],
            ["positionY", "positionY", -50, 50, 1],
            ["widthRatio", "instantPromptWidth", 0.5, 1.5, 0.05],
            ["scale", "scale", 0.5, 1.75, 0.05],
            ["offsetX", "instantPromptOffsetX", -120, 120, 1],
            ["offsetY", "instantPromptOffsetY", -120, 120, 1],
          ];
          for (const [property, labelKey, minimum, maximum, step] of definitions) {
            const field = document.createElement("label");
            field.className = "editor-field";
            const label = document.createElement("span");
            label.textContent = tr(labelKey);
            const input = document.createElement("input");
            input.type = "number";
            input.min = String(minimum);
            input.max = String(maximum);
            input.step = String(step);
            input.value = String(frame[property]);
            input.dataset.editorField = `instantPrompts[${index}].layout.frames.${editingLayoutId}.${property}`;
            input.addEventListener("change", () => {
              const value = input.valueAsNumber;
              if (!inRange(value, minimum, maximum)) {
                input.value = String(frame[property]);
                return;
              }
              const layout = structuredClone(prompt.layout);
              layout.frames[editingLayoutId] ??= {};
              layout.frames[editingLayoutId][property] = value;
              instantPromptChange(prompt, "update", { field: "layout", value: layout });
            });
            field.append(label, input);
            fieldset.appendChild(field);
          }
          body.appendChild(fieldset);
        }
        const actions = document.createElement("div");
        actions.className = "instant-prompt-card-actions";
        const actionButton = (key, handler, disabled = false) => {
          const button = document.createElement("button");
          button.type = "button";
          button.className = "ghost-button";
          button.textContent = tr(key);
          button.disabled = disabled || conversation;
          button.addEventListener("click", handler);
          return button;
        };
        actions.append(
          actionButton("instantPromptChooseIcon", () => requestInstantPromptIcon(prompt.id)),
          actionButton("instantPromptRemoveIcon", () => instantPromptChange(prompt, "clear-icon"), !prompt.icon),
          actionButton("instantPromptMoveUp", () => instantPromptChange(prompt, "move", { value: "up" }), index === 0),
          actionButton("instantPromptMoveDown", () => instantPromptChange(prompt, "move", { value: "down" }), index === state.instantPrompts.length - 1),
          actionButton("instantPromptRemove", () => {
            const next = state.instantPrompts[index + 1] ?? state.instantPrompts[index - 1] ?? null;
            selectedInstantPromptId = next?.id ?? null;
            instantPromptChange(prompt, "remove");
          }),
        );
        body.appendChild(actions);
        card.append(summary, body);
        instantPromptList.appendChild(card);
      });
      instantPromptEmpty.hidden = state.instantPrompts.length > 0;
      addInstantPromptButton.disabled = conversation
        || isBuiltInLayoutEdit() || state.instantPrompts.length >= MAX_INSTANT_PROMPTS;
      instantPromptContext.hidden = !conversation;
      instantPromptContext.inert = !conversation;
      for (const input of instantPromptPreviewInputs) input.disabled = conversation || !selectedInstantPromptId;
      if (focused) instantPromptList.querySelector(`[data-editor-focus="${CSS.escape(focused)}"]`)?.focus();
    };

    addInstantPromptButton?.addEventListener("click", () => {
      if (!state || stageContext !== "new-chat" || state.instantPrompts.length >= MAX_INSTANT_PROMPTS) return;
      const prompt = instantPromptSeed();
      selectedInstantPromptId = prompt.id;
      renderedInstantPromptSignature = null;
      instantPromptChange(prompt, "add", { value: prompt });
    });
    instantPromptSwitchPreviewButton?.addEventListener("click", () => {
      switchToNewChatPreview();
    });
    for (const input of instantPromptPreviewInputs) {
      input.addEventListener("change", () => {
        if (!input.checked) return;
        instantPromptPreviewState = input.value;
        renderStage();
      });
    }

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
        ?? (preset === "shared" ? layer[property] : activeArtworkFrame(layer)?.[property]));
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
      const fieldPath = preset === "shared"
        ? `layers[${layer.index}].${property}`
        : preset === "filters"
          ? `layers[${layer.index}].filters.${property}`
          : `layers[${layer.index}].frames.${preset}.${property}`;
      range.value = String(stageValue(fieldPath) ?? value);
      range.dataset.editorFocus = `layer-${layer.id}-${preset}-${property}`;
      range.dataset.editorField = fieldPath;
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
      const frame = responsiveActive() ? activeArtworkFrame(layer) : layer.frames[preset];
      const fieldset = document.createElement("fieldset");
      fieldset.className = "layer-preset advanced-only";
      const locked = disabled || (responsiveActive() && !responsiveEditExact());
      fieldset.disabled = locked;
      fieldset.dataset.gated = String(locked);
      const legend = document.createElement("legend");
      legend.textContent = responsiveActive()
        ? responsiveSet(preset)?.label ?? preset
        : tr(preset === "normal" ? "normalPreset" : "widePreset");
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
        const presets = responsiveActive()
          ? [editingLayoutId]
          : ["normal", "wide"];
        for (const preset of presets.filter(Boolean)) {
          for (const property of LAYER_SIGNATURE_FRAME) {
            parts.push(stageValue(`layers[${i}].frames.${preset}.${property}`) ?? activeArtworkFrame(layer)?.[property]);
          }
        }
        for (const [property, neutral] of Object.entries({
          hueDeg: 0, saturation: 1, brightness: 1, contrast: 1, blurPx: 0,
        })) {
          parts.push(stageValue(`layers[${i}].filters.${property}`) ?? layer.filters?.[property] ?? neutral);
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
        copyWide.hidden = responsiveActive();
        copyWide.dataset.editorFocus = `layer-${layer.id}-copy-wide`;
        copyWide.addEventListener("click", () => copyLayerFraming(layer.index, "normal", "wide"));
        const copyNormal = document.createElement("button");
        copyNormal.type = "button";
        copyNormal.className = "ghost-button advanced-only";
        copyNormal.textContent = tr("copyFramingToNormal");
        copyNormal.disabled = gated;
        copyNormal.dataset.layerStateEdit = "";
        copyNormal.hidden = responsiveActive();
        copyNormal.dataset.editorFocus = `layer-${layer.id}-copy-normal`;
        copyNormal.addEventListener("click", () => copyLayerFraming(layer.index, "wide", "normal"));
        actions.append(replace, up, down, copyWide, copyNormal, remove);

        const sharedGrid = document.createElement("div");
        sharedGrid.className = "layer-grid layer-shared-controls";
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

        const filterGrid = document.createElement("div");
        filterGrid.className = "layer-grid layer-filter-controls advanced-only";
        const filterTitle = document.createElement("h4");
        filterTitle.className = "layer-inspector-title";
        filterTitle.textContent = tr("backgroundFilters");
        const filterHelp = document.createElement("p");
        filterHelp.className = "help";
        filterHelp.textContent = tr("backgroundFiltersHelp");
        const filters = layer.filters ?? {};
        filterGrid.append(
          filterTitle,
          filterHelp,
          layerRange({ layer, preset: "filters", property: "hueDeg", labelKey: "filterHue", min: -180, max: 180, step: 1, value: filters.hueDeg ?? 0, display: (v) => `${Math.round(v)}°` }),
          layerRange({ layer, preset: "filters", property: "saturation", labelKey: "filterSaturation", min: 0, max: 2, step: 0.05, value: filters.saturation ?? 1, display: (v) => `${Math.round(v * 100)}%` }),
          layerRange({ layer, preset: "filters", property: "brightness", labelKey: "filterBrightness", min: 0.5, max: 1.5, step: 0.05, value: filters.brightness ?? 1, display: (v) => `${Math.round(v * 100)}%` }),
          layerRange({ layer, preset: "filters", property: "contrast", labelKey: "filterContrast", min: 0.5, max: 1.5, step: 0.05, value: filters.contrast ?? 1, display: (v) => `${Math.round(v * 100)}%` }),
          layerRange({ layer, preset: "filters", property: "blurPx", labelKey: "filterBlur", min: 0, max: 24, step: 1, value: filters.blurPx ?? 0, display: (v) => `${Math.round(v)} px` }),
        );
        const resetFilters = document.createElement("button");
        resetFilters.type = "button";
        resetFilters.className = "ghost-button";
        resetFilters.textContent = tr("resetFilters");
        resetFilters.disabled = !layer.filters;
        resetFilters.addEventListener("click", () => queueThemeChanges(
          ["hueDeg", "saturation", "brightness", "contrast", "blurPx"].map((property) => ({
            kind: "layer", layerId: layer.id, preset: "filters", property, value: null,
          })),
          { immediate: true },
        ));
        filterGrid.append(resetFilters);

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
        const frameEditors = responsiveActive()
          ? [renderFrame(layer, editingLayoutId, gated)]
          : [renderFrame(layer, "normal", gated), renderFrame(layer, "wide", gated)];
        body.append(inspectorTitle, sharedGrid, filterGrid, placementScope, actions,
          ...frameEditors, meta);
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
      const metadataField = field.startsWith("metadata.")
        || field.startsWith("labels.")
        || field.startsWith("descriptions.");
      if (metadataField) {
        setInspectorPage("details", { resetScroll: true });
        return direct ?? documentDetailsPanel?.querySelector(
          `[data-editor-metadata="label"][data-editor-locale="${CSS.escape(normalizedLocale)}"]`,
        );
      }
      if (field.startsWith("budget.") && !field.startsWith("budget.layer")) {
        setInspectorPage("review", { resetScroll: true });
        return feedbackRoot;
      }
      if (direct?.closest(".advanced-only")) {
        editor.dataset.level = "advanced";
        for (const input of document.querySelectorAll('input[name="editor-level"]')) {
          input.checked = input.value === "advanced";
        }
      }
      const target = field === "greetingPreferences" ? "interface.greeting"
        : field.startsWith("launcher.") ? "widgets.app-identity"
        : field.startsWith("layers[") || field.startsWith("budget.layer") ? "background.layer"
          : field === "shared.backgroundScope" ? "background.layer"
            : field.startsWith("shared.prompt.") ? "interface.prompt-block"
              : "interface.theme";
      setInspectorTarget(target);
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
        syncModeInputs();
        reflectTokens();
        const candidates = CONTRAST_FOCUS_TOKENS[contrast[2]] ?? ["text"];
        const activeToken = new RegExp(`^tokens\\.${selectedMode}\\.([a-zA-Z]+)$`)
          .exec(inspectorField ?? "")?.[1] ?? null;
        const token = candidates.includes(activeToken) ? activeToken : candidates[0];
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
      quickFeedback.hidden = false;
      errorSummary.replaceChildren();
      errorSummary.hidden = true;
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
      const livePausedSummary = tr("livePausedNotice").replace(/\s*[:\uFF1A]\s*\{0\}\s*$/u, "");
      quickText.textContent = state.feedback.valid
        ? tr("quickFeedbackValid")
        : livePausedSummary;
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
      }
    };

    const reflectButtonStates = () => {
      if (!state) return;
      reflectDirtyState();
      const busy = Boolean(pendingAction || greetingResyncPending || patchResyncPending
        || coalescedChanges.size || changeFlushTimer || stageKeyTimer || stageKeyPaths.size);
      const blocked = deferredChanges.size > 0 || uncertainChanges.size > 0;
      const builtInLayout = isBuiltInLayoutEdit();
      const responsiveGeometryLocked = responsiveActive() && !responsiveEditExact();
      const localGreetingWork = !builtInLayout
        && (greetingPreferenceDraftDirty || greetingPreferenceInputDirty);
      const localMetadataWork = !builtInLayout && metadataInputDirty;
      const localEditorWork = localGreetingWork || localMetadataWork;
      for (const checkbox of metadataLocaleCheckboxes()) {
        checkbox.disabled = checkbox.value === "en" || builtInLayout || isBlockingAction();
      }
      undoButton.disabled = busy || blocked || (!state.canUndo && !localEditorWork);
      redoButton.disabled = busy || blocked || localEditorWork || !state.canRedo;
      resetButton.disabled = busy || blocked || (!state.dirty && !localEditorWork);
      saveButton.disabled = busy
        || (state.feedback.valid && (blocked
          || (!state.dirty && !localEditorWork && !state.isNew)));
      // Leaving must always be possible while edits are still settling; only a
      // blocking structural action (which briefly replaces state) holds it.
      cancelButton.disabled = isBlockingAction();
      backButton.disabled = isBlockingAction();
      addLayerButton.disabled = builtInLayout || busy || blocked || state.layers.length >= 8;
      if (addInstantPromptButton) {
        addInstantPromptButton.disabled = builtInLayout || busy || blocked
          || stageContext !== "new-chat" || state.instantPrompts.length >= MAX_INSTANT_PROMPTS;
      }
      stageOpacityInput.disabled = builtInLayout || isBlockingAction() || blocked;
      if (replaceLauncherMarkButton) {
        replaceLauncherMarkButton.disabled = builtInLayout || busy || blocked;
      }
      if (replaceSidebarIdentityButton) {
        replaceSidebarIdentityButton.disabled = builtInLayout || busy || blocked;
      }
      for (const control of [
        ...loadingModeInputs, loadingLayoutInput, loadingMotifInput, loadingMarkSourceInput,
        loadingMarkSizeInput, loadingProgressStyleInput, loadingProgressMotionInput,
        loadingReviewButton, loadingMarkPickButton, loadingArtworkPickButton,
        loadingArtworkRemoveButton, loadingArtworkOpacityInput, loadingArtworkFitInput,
        loadingArtworkFocalXInput, loadingArtworkFocalYInput,
        ...loadingColorFields.flatMap(({ picker, exact }) => [picker, exact]),
      ]) {
        if (control) control.disabled = builtInLayout || busy || blocked;
      }
      for (const { input, textInput, reset } of surfaceControlNodes.values()) {
        input.disabled = builtInLayout || busy || blocked;
        if (textInput) textInput.disabled = builtInLayout || busy || blocked;
        if (builtInLayout || busy || blocked) reset.disabled = true;
      }
      if (greetingResetButton) greetingResetButton.disabled = builtInLayout || busy || blocked;
      syncGreetingWordControls();
      syncGreetingFrameControls();
      for (const input of [...promptInputs, ...promptExactInputs]) {
        input.disabled = isBlockingAction() || blocked || responsiveGeometryLocked;
      }
      addLayerButton.dataset.layerStructure = "";
      for (const button of editor.querySelectorAll("[data-layer-structure]")) {
        button.disabled = builtInLayout || busy || blocked
          || (button === addLayerButton && state.layers.length >= 8)
          || button.dataset.layerBoundary === "true";
      }
      reflectOverlayPresentation();
    };

    const reflect = (focusKey = null) => {
      if (!state) return;
      title.textContent = format(tr("editorTitleFor"), state.label);
      summary.textContent = tr("editorSummary");
      reflectDirtyState();
      validPill.textContent = state.feedback.valid ? tr("validState") : tr("feedbackInvalid");
      validPill.dataset.state = state.feedback.valid ? "valid" : "invalid";
      syncModeInputs();
      reflectTokens();
      reflectSurfaceControls();
      reflectShared();
      reflectGreeting();
      reflectLauncher();
      reflectLoadingScreen();
      reflectMetadata();
      reflectCardPreview();
      renderInstantPromptEditor();
      renderLayers(focusKey);
      renderResponsiveLayouts();
      syncBuiltInLayoutPresentation();
      renderFeedback();
      reflectButtonStates();
      renderStage();
    };

    const settlePendingAction = (normalized) => {
      const { error: actionError } = normalized;
      if (!pendingAction || normalized.lastAction !== pendingAction) return "waiting";
      const settledRequest = pendingRequest;
      const greetingMutation = ["set-greeting-phrases", "reset-greeting"].includes(pendingAction);
      const historyMutation = ["undo-theme-edit", "redo-theme-edit"].includes(pendingAction);
      const revisionBoundReset = pendingAction === "begin-theme-edit"
        && settledRequest?.reset === true
        && typeof settledRequest.session === "string"
        && Number.isSafeInteger(settledRequest.revision);
      const revisionBoundResult = greetingMutation || historyMutation || revisionBoundReset
        ? greetingMutationResult(settledRequest, normalized)
        : null;
      if ((greetingMutation || historyMutation || revisionBoundReset)
          && revisionBoundResult === "waiting") return "waiting";
      const succeeded = greetingMutation || historyMutation || revisionBoundReset
        ? revisionBoundResult === "succeeded"
        : normalized.actionSucceeded !== false;
      if (pendingAction !== "apply-theme-patch") {
        const settledAction = pendingAction;
        const followup = succeeded
          && sameMutationRequest(greetingActionFollowup?.prerequisite, settledRequest)
          ? greetingActionFollowup.message
          : null;
        actionAfterPatch = null;
        setPending(null);
        if (actionError === "picker-cancelled") {
          announce(tr("editorReady"));
          return "settled";
        }
        if (!succeeded && !greetingMutation) dropStageWork();
        if (greetingMutation) {
          greetingActionFollowup = null;
          greetingTimeoutRetries = 0;
        }
        const successMessage = settledAction === "pick-theme-launcher-mark"
          ? tr("launcherMarkImported")
          : settledAction === "pick-sidebar-identity-mark"
            ? tr("sidebarIdentityMarkImported")
          : settledAction === "pick-instant-prompt-icon"
            ? tr("instantPromptIconImported") : tr("editorReady");
        const failureMessage = settledAction === "pick-theme-launcher-mark"
          ? tr(actionError === "identity-apply-failed" ? "launcherMarkApplyFailed" : "launcherMarkFailed")
          : settledAction === "pick-sidebar-identity-mark"
            ? tr("sidebarIdentityMarkFailed")
          : settledAction === "pick-instant-prompt-icon"
            ? tr("instantPromptIconFailed") : tr("editorActionFailed");
        announce(succeeded ? successMessage : failureMessage, succeeded ? "ok" : "error");
        if (followup) {
          const base = mutationBase();
          const rebased = base && (Object.hasOwn(followup, "session") || Object.hasOwn(followup, "revision"))
            ? { ...followup, ...base }
            : followup;
          if (!post(rebased)) announce(tr("editorActionFailed"), "error");
        }
        return "settled";
      }
      if (!inFlightSession || inFlightRevision === null
          || normalized.session !== inFlightSession) {
        if (inFlightChanges.some((change) => change.kind === "greeting")) greetingStyleIntent = null;
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
        patchResponseRetryCount = 0;
        if (inFlightChanges.some((change) => change.kind === "greeting")) {
          greetingStyleIntent = null;
          greetingStyleLocked = false;
        }
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
        patchResponseRetryCount = 0;
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
        const greetingPatchRejected = inFlightChanges.some((change) => change.kind === "greeting");
        deferInFlightChanges();
        const queuedGreetingPatch = [...coalescedChanges.values()].some(
          (change) => change.kind === "greeting",
        );
        for (const [key, change] of coalescedChanges) {
          if (!deferredChanges.has(key)) deferredChanges.set(key, change);
        }
        coalescedChanges.clear();
        if (greetingPatchRejected || queuedGreetingPatch || greetingStyleIntent !== null) {
          greetingStyleLocked = false;
        }
        actionAfterPatch = null;
        setPending(null);
        announce(tr("editorActionFailed"), "error");
        return "blocked";
      }
      if (normalized.revision !== inFlightRevision + 1) return "waiting";
      // Contrast/budget failures are persisted edits, not transport failures.
      patchResponseRetryCount = 0;
      if (inFlightChanges.some((change) => change.kind === "greeting")) {
        greetingStyleIntent = null;
        greetingStyleLocked = false;
      }
      clearInFlightChanges();
      actionAfterPatch = null;
      setPending(null);
      announce(tr("editorActionFailed"), "error");
      return "settled";
    };

    const receive = (rawState, appearance = "system") => {
      const normalized = normalizeEditorState(rawState);
      if (normalized === undefined) {
        if (patchResyncPending) parkUncertainPatch();
        if (greetingResyncPending) {
          greetingResyncPending = null;
          if (greetingResyncTimer) {
            clearTimeout(greetingResyncTimer);
            greetingResyncTimer = null;
          }
          greetingStageRequested = false;
          editor.setAttribute("aria-busy", "false");
          reflectButtonStates();
        }
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
        clearGreetingInputState(null);
        metadataInputDirty = false;
        metadataInputInvalid = false;
        for (const input of metadataInputs()) input.removeAttribute("aria-invalid");
        onStudioStyleChange?.(null, null, null, null);
        if (wasEditing || action) hideEditor(action);
        return true;
      }
      const focusKey = document.activeElement?.dataset?.editorFocus ?? null;
      const entering = !state;
      if (entering) {
        resetOverlayUi();
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
      let retryGreetingAfterRefresh = false;
      let patchFollowupAfterRefresh = null;
      if (patchResyncPending) {
        const resync = patchResyncPending;
        if (normalized.session === resync.request.session
            && normalized.revision >= resync.request.revision) {
          const decision = patchResyncDecision(
            resync.request,
            normalized,
            resync.retry,
          );
          if (decision === "succeeded") {
            const hadGreetingPatch = inFlightChanges.some(
              (change) => change.kind === "greeting",
            );
            clearPatchResyncTracking();
            patchResponseRetryCount = 0;
            if (hadGreetingPatch) {
              greetingStyleIntent = null;
              greetingStyleLocked = false;
            }
            clearInFlightChanges();
            patchFollowupAfterRefresh = actionAfterPatch;
            actionAfterPatch = null;
            announce(tr("editorReady"));
          } else if (decision === "failed-persisted") {
            const hadGreetingPatch = inFlightChanges.some(
              (change) => change.kind === "greeting",
            );
            clearPatchResyncTracking();
            patchResponseRetryCount = 0;
            if (hadGreetingPatch) {
              greetingStyleIntent = null;
              greetingStyleLocked = false;
            }
            clearInFlightChanges();
            actionAfterPatch = null;
            announce(tr("editorActionFailed"), "error");
          } else if (decision === "failed-not-applied") {
            parkUncertainPatch({ knownNotApplied: true });
            announce(tr("editorActionFailed"), "error");
          } else if (decision === "retry") {
            clearPatchResyncTracking();
            requeueInFlightChanges();
          } else if (decision === "defer") {
            parkUncertainPatch({ knownNotApplied: true });
            announce(tr("editorActionTimedOut"), "error");
          } else {
            // The host advanced without an exact acknowledgement. Do not
            // replay an ambiguous patch and create a duplicate Undo entry.
            parkUncertainPatch();
            announce(tr("editorActionTimedOut"), "error");
          }
        } else if (normalized.session !== resync.request.session) {
          clearPatchResyncTracking();
          dropStageWork();
          clearGreetingInputState(normalized.greetingPreferences);
          clearMetadataOverrides();
          metadataInputDirty = false;
          metadataInputInvalid = false;
          for (const input of metadataInputs()) input.removeAttribute("aria-invalid");
        }
      }
      if (greetingResyncPending) {
        const resync = greetingResyncPending;
        if (normalized.session === resync.request.session
            && normalized.revision >= resync.request.revision) {
          greetingResyncPending = null;
          if (greetingResyncTimer) {
            clearTimeout(greetingResyncTimer);
            greetingResyncTimer = null;
          }
          greetingActionFollowup = null;
          const localGreeting = greetingDraft();
          const hostCaughtUp = greetingResyncCaughtUp(
            resync.request,
            normalized,
            localGreeting,
          );
          if (hostCaughtUp) {
            clearGreetingInputState(normalized.greetingPreferences);
            if (resync.fullReset) {
              clearMetadataOverrides();
              metadataInputDirty = false;
              metadataInputInvalid = false;
              for (const input of metadataInputs()) input.removeAttribute("aria-invalid");
            }
            greetingTimeoutRetries = 0;
          } else if (resync.retry) {
            greetingStageRequested = true;
            retryGreetingAfterRefresh = true;
          }
        } else if (normalized.session !== resync.request.session) {
          greetingResyncPending = null;
          if (greetingResyncTimer) {
            clearTimeout(greetingResyncTimer);
            greetingResyncTimer = null;
          }
          greetingActionFollowup = null;
          greetingTimeoutRetries = 0;
          clearGreetingInputState(normalized.greetingPreferences);
          if (resync.fullReset) {
            clearMetadataOverrides();
            metadataInputDirty = false;
            metadataInputInvalid = false;
            for (const input of metadataInputs()) input.removeAttribute("aria-invalid");
          }
        }
      }
      const greetingAcknowledged = ["set-greeting-phrases", "reset-greeting"].includes(pendingAction)
        && greetingMutationResult(pendingRequest, normalized) === "succeeded";
      const priorLayerIds = new Set(state?.layers?.map((layer) => layer.id) ?? []);
      const pickedLayerId = pendingAction === "pick-theme-layer-image"
        && normalized.lastAction === pendingAction
        && normalized.actionSucceeded !== false
        ? normalized.layers.find((layer) => !priorLayerIds.has(layer.id))?.id ?? null
        : null;
      const fullResetAcknowledged = pendingAction === "begin-theme-edit"
        && pendingRequest?.reset === true
        && greetingMutationResult(pendingRequest, normalized) === "succeeded";
      const metadataHistoryAcknowledged = ["undo-theme-edit", "redo-theme-edit"].includes(pendingAction)
        && greetingMutationResult(pendingRequest, normalized) === "succeeded";
      if (entering
          || (!greetingPreferenceDraftDirty && !greetingPreferenceInputDirty)
          || greetingAcknowledged || fullResetAcknowledged || metadataHistoryAcknowledged) {
        clearGreetingInputState(normalized.greetingPreferences);
      }
      if (entering || fullResetAcknowledged || metadataHistoryAcknowledged) {
        clearMetadataOverrides();
        metadataInputDirty = false;
        metadataInputInvalid = false;
        for (const input of metadataInputs()) input.removeAttribute("aria-invalid");
      }
      state = normalized;
      syncResponsiveSelection({ entering });
      reconcileUncertainChanges(normalized);
      if (pickedLayerId) selectedLayerId = pickedLayerId;
      syncBuiltInLayoutPresentation({ entering });
      selectStageMirror();
      onStudioStyleChange?.(
        normalized.studioStyle,
        normalized.id,
        normalized.launcherStyle,
        normalized.launcherStylePreviewUrl,
      );
      const settlement = settlePendingAction(normalized);
      if (settlement === "waiting" && !pendingAction
          && !greetingResyncPending && !patchResyncPending) setPending(null);
      clearSettledStageOverrides();
      showEditor();
      reflect(entering ? null : focusKey);
      if (entering) announce(tr("editorReady"));
      if (patchFollowupAfterRefresh) {
        const base = mutationBase();
        const rebased = base
          && (Object.hasOwn(patchFollowupAfterRefresh, "session")
            || Object.hasOwn(patchFollowupAfterRefresh, "revision"))
          ? { ...patchFollowupAfterRefresh, ...base }
          : patchFollowupAfterRefresh;
        if (!post(rebased)) announce(tr("editorActionFailed"), "error");
      }
      if (settlement !== "blocked" && settlement !== "stopped") flushThemeChanges();
      if ((retryGreetingAfterRefresh || greetingStageRequested) && !greetingStageTimer) {
        greetingStageTimer = setTimeout(() => {
          greetingStageTimer = null;
          if (greetingTextInputs.includes(document.activeElement)) return;
          stageGreetingPreferenceDraft({ retry: retryGreetingAfterRefresh });
        }, 0);
      }
      return true;
    };

    modeInputs.forEach((input) => input.addEventListener("change", () => {
      if (!input.checked) return;
      if (selectedMode !== input.value) {
        appearanceTouched = true;
        send({ type: "set-appearance", appearance: input.value });
      }
      selectedMode = input.value;
      syncModeInputs();
      selectStageMirror();
      reflectTokens();
      reflectSurfaceControls();
      reflectGreeting();
      reflectLoadingScreen();
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

    const syncMetadataInputState = () => {
      metadataInputInvalid = metadataInputs().some((input) => !input.value.trim());
      // Metadata changes use the same persisted draft/history transaction as
      // every other theme value. Queue/in-flight state already represents
      // local work; this flag is validation only, not a second draft model.
      metadataInputDirty = false;
      reflectDirtyState();
      reflectButtonStates();
    };
    metadataLocalesHost?.addEventListener("input", (event) => {
      const input = event.target.closest?.("[data-editor-metadata]");
      if (!input || !metadataLocalesHost.contains(input)) return;
      const data = input.dataset;
      const value = input.value.trim();
      input.toggleAttribute("aria-invalid", !value);
      const collection = data.editorMetadata === "label" ? "labels" : "descriptions";
      const path = `metadata.${collection}.${data.editorLocale}`;
      if (String(stageValue(path) ?? "") !== value) {
        setStageOverride(path, value);
        queueThemeChange({
          kind: "metadata",
          field: data.editorMetadata,
          locale: data.editorLocale,
          value,
        });
      }
      syncMetadataInputState();
    });
    metadataLocalesHost?.addEventListener("change", (event) => {
      const input = event.target.closest?.("[data-editor-metadata]");
      if (!input || !metadataLocalesHost.contains(input)) return;
      input.value = input.value.trim();
    });
    metadataLocaleOptions?.addEventListener("change", (event) => {
      const checkbox = event.target.closest?.("[data-editor-metadata-locale]");
      if (!checkbox || !metadataLocaleOptions.contains(checkbox)
          || !THEME_METADATA_LOCALE_IDS.has(checkbox.value)) return;
      const locale = checkbox.value;
      if (locale === "en" && !checkbox.checked) {
        checkbox.checked = true;
        return;
      }
      const enabled = checkbox.checked;
      const restoring = [];
      setStageOverride(`metadata.locale.${locale}`, enabled);
      if (enabled) {
        const label = Object.hasOwn(state?.metadata?.labels ?? {}, locale)
          ? state.metadata.labels[locale] : "";
        const description = Object.hasOwn(state?.metadata?.descriptions ?? {}, locale)
          ? state.metadata.descriptions[locale] : "";
        setStageOverride(`metadata.labels.${locale}`, label);
        setStageOverride(`metadata.descriptions.${locale}`, description);
        if (label || description) {
          restoring.push(
            { kind: "metadata", field: "label", locale, value: label },
            { kind: "metadata", field: "description", locale, value: description },
          );
        }
      } else {
        stageOverrides.delete(`metadata.labels.${locale}`);
        stageOverrides.delete(`metadata.descriptions.${locale}`);
        for (const field of ["label", "description"]) {
          const key = `metadata:${field}:${locale}`;
          coalescedChanges.delete(key);
          deferredChanges.delete(key);
          uncertainChanges.delete(key);
        }
      }
      renderedMetadataLocaleSignature = "";
      renderMetadataLocales({ focusLocale: enabled ? locale : null });
      syncMetadataInputState();
      queueThemeChanges([
        { kind: "metadata-locale", locale, enabled },
        ...restoring,
      ], { immediate: true });
    });

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
          queueTokenChange("shared", key, input.valueAsNumber);
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
    replaceLauncherMarkButton?.addEventListener("click", requestLauncherMark);
    replaceSidebarIdentityButton?.addEventListener("click", requestSidebarIdentityMark);
    const updateLoadingScreen = (mutate) => {
      if (!state || isBlockingAction()) return false;
      const next = loadingScreenDraft();
      mutate(next);
      return postLoadingScreen(next);
    };
    loadingModeInputs.forEach((input) => input.addEventListener("change", () => {
      if (!input.checked) return;
      postLoadingScreen(input.value === "inherit" ? { mode: "inherit" } : defaultLoadingScreen());
    }));
    loadingLayoutInput?.addEventListener("change", () => updateLoadingScreen((next) => {
      next.layout = loadingLayoutInput.value;
    }));
    loadingMotifInput?.addEventListener("change", () => updateLoadingScreen((next) => {
      next.motif = loadingMotifInput.value;
    }));
    loadingMarkSourceInput?.addEventListener("change", () => {
      if (loadingMarkSourceInput.value === "custom") {
        requestLoadingMark();
        return;
      }
      updateLoadingScreen((next) => {
        next.mark.source = loadingMarkSourceInput.value;
        next.mark.asset = null;
      });
    });
    loadingMarkSizeInput?.addEventListener("input", () => {
      loadingMarkSizeOutput.value = `${loadingMarkSizeInput.value}px`;
    });
    loadingMarkSizeInput?.addEventListener("change", () => updateLoadingScreen((next) => {
      next.mark.size = loadingMarkSizeInput.valueAsNumber;
    }));
    loadingProgressStyleInput?.addEventListener("change", () => updateLoadingScreen((next) => {
      next.progress.style = loadingProgressStyleInput.value;
    }));
    loadingProgressMotionInput?.addEventListener("change", () => updateLoadingScreen((next) => {
      next.progress.motion = loadingProgressMotionInput.value;
    }));
    for (const field of loadingColorFields) {
      field.picker.addEventListener("input", () => {
        field.exact.value = field.picker.value.toUpperCase();
      });
      field.picker.addEventListener("change", () => updateLoadingScreen((next) => {
        next[field.appearance][field.property] = field.picker.value.toUpperCase();
      }));
      field.exact.addEventListener("change", () => {
        const value = field.exact.value.trim().toUpperCase();
        if (!COLOR_PATTERN.test(value)) {
          field.exact.setAttribute("aria-invalid", "true");
          announce(tr("validationColorFix"), "error");
          return;
        }
        field.exact.removeAttribute("aria-invalid");
        field.picker.value = value;
        updateLoadingScreen((next) => { next[field.appearance][field.property] = value; });
      });
    }
    loadingMarkPickButton?.addEventListener("click", requestLoadingMark);
    loadingArtworkPickButton?.addEventListener("click", requestLoadingArtwork);
    loadingArtworkRemoveButton?.addEventListener("click", () => updateLoadingScreen((next) => {
      next[selectedMode].artwork = null;
    }));
    loadingArtworkOpacityInput?.addEventListener("input", () => {
      loadingArtworkOpacityOutput.value = `${Math.round(loadingArtworkOpacityInput.valueAsNumber * 100)}%`;
    });
    loadingArtworkOpacityInput?.addEventListener("change", () => updateLoadingScreen((next) => {
      if (next[selectedMode].artwork) next[selectedMode].artwork.opacity = loadingArtworkOpacityInput.valueAsNumber;
    }));
    loadingArtworkFitInput?.addEventListener("change", () => updateLoadingScreen((next) => {
      if (next[selectedMode].artwork) next[selectedMode].artwork.fit = loadingArtworkFitInput.value;
    }));
    for (const [input, output, property] of [
      [loadingArtworkFocalXInput, loadingArtworkFocalXOutput, "focalX"],
      [loadingArtworkFocalYInput, loadingArtworkFocalYOutput, "focalY"],
    ]) {
      input?.addEventListener("input", () => { output.value = `${input.value}%`; });
      input?.addEventListener("change", () => updateLoadingScreen((next) => {
        if (next[selectedMode].artwork) next[selectedMode].artwork[property] = input.valueAsNumber;
      }));
    }
    loadingReviewButton?.addEventListener("click", () => {
      const base = mutationBase();
      if (base) post({ type: "preview-theme-loading-screen", ...base });
    });
    scopeInputs.forEach((input) => input.addEventListener("change", () => {
      if (!input.checked) return;
      setBackgroundScope(input.value);
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
    promptResetInheritedButton?.addEventListener("click", () => {
      const axis = greetingFrameId();
      const mapping = Object.entries(promptFrameProperty);
      for (const [key, property] of mapping) {
        setStageOverride(`interfaceSurfaces.promptBlock.frame.${axis}.${property}`, null);
        setStageOverride(`shared.prompt.${key}`, state.shared.prompt[key]);
      }
      inspectorField = "shared.prompt";
      queueThemeChanges(mapping.map(([, property]) => ({
        kind: "surface", target: "promptBlock", slot: "frame", axis, property, value: null,
      })), { immediate: true });
      reflectShared();
      refreshInspectorContext();
      renderStage();
    });
    const clearGreetingFrameOverrides = () => {
      for (const path of [...stageOverrides.keys()]) {
        if (path.startsWith("shared.greeting.frames.")) stageOverrides.delete(path);
      }
    };
    greetingEnableInput?.addEventListener("change", () => {
      if (isBlockingAction() || greetingStyleLocked) return;
      greetingStyleIntent = greetingEnableInput.checked;
      greetingStyleLocked = true;
      if (greetingEnableInput.checked) {
        const frame = greetingFrameFromControls();
        if (!frame) {
          greetingStyleIntent = null;
          greetingStyleLocked = false;
          reflectGreeting();
          reflectButtonStates();
          return;
        }
        queueGreetingFrame(frame, { immediate: true });
      } else {
        clearGreetingFrameOverrides();
        queueThemeChange({
          kind: "greeting",
          operation: "reset",
          appearance: selectedMode,
          frame: greetingFrameId(),
          value: null,
        }, { immediate: true });
      }
      reflectGreeting();
      reflectButtonStates();
    });
    const showGreetingInputError = (target = greetingPreferenceErrorTarget ?? greetingPhrasesInput) => {
      greetingPreferenceErrorTarget = target;
      target?.setAttribute?.("aria-invalid", "true");
      if (!greetingPhrasesStatus) return;
      greetingPhrasesStatus.textContent = tr(
        target === greetingNameInput ? "greetingNameInvalid" : "greetingPhrasesEmpty",
      );
      greetingPhrasesStatus.hidden = false;
    };
    const clearGreetingInputError = () => {
      greetingPreferenceErrorTarget = null;
      greetingNameInput?.removeAttribute("aria-invalid");
      greetingPhrasesInput?.removeAttribute("aria-invalid");
      greetingOverrideInput?.removeAttribute("aria-invalid");
      greetingOverridePhrasesInput?.removeAttribute("aria-invalid");
      if (greetingPhrasesStatus) greetingPhrasesStatus.hidden = true;
    };
    const updateGreetingPreferenceDraft = () => {
      if (!state) return null;
      const current = structuredClone(greetingDraft() ?? state.greetingPreferences);
      const sourceChoice = greetingSourceInputs.find((input) => input.checked)?.value
        ?? greetingSourceChoice(current);
      const selected = greetingPreferencesForSourceChoice(current, sourceChoice);
      const overrideMode = greetingOverrideInput?.value ?? greetingThemeOverride(current).mode;
      if (!selected || !["global", "claude", "custom"].includes(overrideMode)) {
        greetingPreferenceInputDirty = true;
        greetingPreferenceInputInvalid = true;
        showGreetingInputError(greetingPhrasesInput);
        return null;
      }
      const { enabled, source } = selected;
      // Disabled personalization and Claude wording do not consume the custom
      // fields. Preserve the last valid stored lists so switching away is an
      // explicit recovery path for invalid in-progress text.
      if (!enabled || source === "claude") {
        greetingPreferenceDraft = selected;
        greetingPreferenceDraftDirty = JSON.stringify(selected) !== JSON.stringify(state.greetingPreferences);
        greetingPreferenceInputDirty = greetingPreferenceDraftDirty;
        greetingPreferenceInputInvalid = false;
        clearGreetingInputError();
        return selected;
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
        showGreetingInputError(invalidName
          ? greetingNameInput
          : invalidOverride ? greetingOverridePhrasesInput : greetingPhrasesInput);
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
      clearGreetingInputError();
      return current;
    };
    const greetingPreferenceDraftErrorTarget = (personal) => {
      if (!personal) return greetingPhrasesInput;
      if (!personal.enabled || personal.source === "claude") return null;
      const override = greetingThemeOverride(personal);
      if (override.mode === "claude") return null;
      const phrases = override.mode === "custom" ? override.phrases : personal.globalPhrases;
      const usable = phrases.flatMap((phrase) => {
        if (!personal.displayName && /\{name\}/u.test(phrase)) return [];
        return [phrase.replace(/\{name\}/gu, personal.displayName)];
      });
      if (!usable.length) {
        return !personal.displayName && phrases.some((phrase) => /\{name\}/u.test(phrase))
          ? greetingNameInput
          : override.mode === "custom" ? greetingOverridePhrasesInput : greetingPhrasesInput;
      }
      return new TextEncoder().encode(JSON.stringify(usable)).length > GREETING_MAX_COMPILED_BYTES
        ? override.mode === "custom" ? greetingOverridePhrasesInput : greetingPhrasesInput
        : null;
    };
    const greetingPreferenceDraftValid = (personal) => !greetingPreferenceDraftErrorTarget(personal);
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
    const stageGreetingPreferenceDraft = ({ followup = null, retry = false } = {}) => {
      if (!state || isBuiltInLayoutEdit()) return false;
      if (pendingAction || greetingResyncPending || patchResyncPending
          || deferredChanges.size || uncertainChanges.size || coalescedChanges.size
          || changeFlushTimer || inFlightChanges.length || stageKeyTimer || stageKeyPaths.size) {
        greetingStageRequested = true;
        return false;
      }
      const personal = greetingPreferenceInputDirty
        ? updateGreetingPreferenceDraft()
        : greetingDraft();
      const errorTarget = greetingPreferenceInputInvalid
        ? greetingPreferenceErrorTarget
        : greetingPreferenceDraftErrorTarget(personal);
      if (!personal || errorTarget) {
        greetingPreferenceInputInvalid = true;
        showGreetingInputError(errorTarget);
        return false;
      }
      greetingPreferenceInputInvalid = false;
      if (!greetingPreferenceDraftDirty) {
        greetingStageRequested = false;
        if (!followup) return true;
        const base = mutationBase();
        return Boolean(base && post({ ...followup, ...base }));
      }
      const base = mutationBase();
      if (!base) return false;
      greetingActionFollowup = null;
      const posted = postGreetingPreferences(personal, base);
      if (!posted || pendingAction !== "set-greeting-phrases" || !pendingRequest) {
        greetingStageRequested = !followup && !retry;
        if (greetingStageRequested && !greetingStageTimer) {
          greetingStageTimer = setTimeout(() => {
            greetingStageTimer = null;
            stageGreetingPreferenceDraft({ retry: true });
          }, 250);
        }
        if (retry) announce(tr("editorActionFailed"), "error");
        return false;
      }
      greetingStageRequested = false;
      if (!retry) greetingTimeoutRetries = 0;
      if (followup) {
        greetingActionFollowup = {
          prerequisite: {
            type: pendingRequest.type,
            session: pendingRequest.session,
            revision: pendingRequest.revision,
          },
          message: { ...followup },
        };
      }
      return true;
    };
    for (const input of greetingSourceInputs) {
      input.addEventListener("change", () => {
        if (!input.checked) return;
        updateGreetingPreferenceDraft();
        reflectGreeting();
        reflectButtonStates();
        stageGreetingPreferenceDraft();
      });
    }
    const previewGreetingWords = () => {
      const personal = updateGreetingPreferenceDraft();
      const errorTarget = greetingPreferenceInputInvalid
        ? greetingPreferenceErrorTarget
        : greetingPreferenceDraftErrorTarget(personal);
      if (errorTarget) {
        showGreetingInputError(errorTarget);
      }
      reflectGreetingPreview(activeGreetingFrame(), !greetingEnableInput?.checked);
      reflectButtonStates();
    };
    greetingNameInput?.addEventListener("input", previewGreetingWords);
    greetingPhrasesInput?.addEventListener("input", previewGreetingWords);
    greetingOverridePhrasesInput?.addEventListener("input", previewGreetingWords);
    const greetingTextInputs = [
      greetingNameInput,
      greetingPhrasesInput,
      greetingOverridePhrasesInput,
    ].filter(Boolean);
    const greetingStageExemptTargets = new Set([
      saveButton,
      cancelButton,
      undoButton,
      redoButton,
      resetButton,
      backButton,
      greetingResetButton,
      greetingOverrideInput,
      ...greetingSourceInputs,
    ].filter(Boolean));
    const scheduleGreetingDraftStage = (event) => {
      if (event?.relatedTarget && greetingStageExemptTargets.has(event.relatedTarget)) return;
      greetingStageRequested = true;
      if (greetingStageTimer) clearTimeout(greetingStageTimer);
      greetingStageTimer = setTimeout(() => {
        greetingStageTimer = null;
        if (greetingTextInputs.includes(document.activeElement)) return;
        stageGreetingPreferenceDraft();
      }, 0);
    };
    for (const input of greetingTextInputs) input.addEventListener("focusout", scheduleGreetingDraftStage);
    greetingOverrideInput?.addEventListener("change", () => {
      updateGreetingPreferenceDraft();
      reflectGreeting();
      reflectButtonStates();
      stageGreetingPreferenceDraft();
    });
    greetingResetButton?.addEventListener("click", () => {
      if (greetingStageTimer) {
        clearTimeout(greetingStageTimer);
        greetingStageTimer = null;
      }
      const base = mutationBase();
      if (!base) return;
      clearGreetingFrameOverrides();
      const personal = greetingPreferenceInputDirty
        ? updateGreetingPreferenceDraft()
        : greetingDraft();
      if (personal && !greetingPreferenceInputInvalid
          && greetingPreferenceDraftValid(personal)
          && greetingPreferenceDraftDirty) {
        if (!stageGreetingPreferenceDraft({
          followup: { type: "reset-greeting", ...base },
        })) announce(tr("editorActionFailed"), "error");
        return;
      }
      if (!post({ type: "reset-greeting", ...base })) announce(tr("editorActionFailed"), "error");
    });
    // The panel and stage read one scoped local draft, so a host reflection or
    // responsive-axis change cannot repaint part of an active gesture.
    const previewFromControls = (
      { appearance = selectedMode, frameId = greetingFrameId() } = {},
    ) => {
      if (!state) return;
      reflectGreetingPreview(
        greetingFrameFromControls(null, null, appearance, frameId),
        !greetingEnableInput?.checked,
      );
    };
    greetingInputs.forEach((input) => {
      const field = input.dataset.editorGreeting;
      const output = input.type === "range" ? document.getElementById(`${input.id}-output`) : null;
      let gestureScope = null;
      input.addEventListener("input", () => {
        if (isBlockingAction()) return;
        gestureScope ??= greetingScopeFromFieldPath(input.dataset.editorField);
        activeGreetingControlScope ??= gestureScope;
        const value = greetingInputValue(input, field);
        setStageOverride(`${greetingStagePrefix(gestureScope.appearance, gestureScope.frameId)}${field}`, value);
        if (output) output.value = greetingOutputText(field, input.valueAsNumber);
        const exact = greetingExactInputs.find((candidate) =>
          candidate.dataset.editorGreetingExact === field);
        if (exact) exact.value = input.value;
        previewFromControls(gestureScope);
        applyStageLayout();
      });
      input.addEventListener("change", () => {
        if (isBlockingAction()) return;
        gestureScope ??= greetingScopeFromFieldPath(input.dataset.editorField);
        const { appearance, frameId } = gestureScope;
        gestureScope = null;
        const value = greetingInputValue(input, field);
        const path = `${greetingStagePrefix(appearance, frameId)}${field}`;
        setStageOverride(path, value);
        if (field === "markSource" && value === "compact"
            && !state?.shared?.greeting?.compactMarkAvailable) {
          stageOverrides.delete(path);
          reflectGreeting();
          announce(tr("editorActionFailed"), "error");
          activeGreetingControlScope = null;
          applyDeferredGreetingMirrorAxes();
          return;
        }
        queueGreetingFrame(
          greetingFrameFromControls(field, value, appearance, frameId),
          { appearance, frameId },
        );
        activeGreetingControlScope = null;
        applyDeferredGreetingMirrorAxes();
      });
    });
    greetingExactInputs.forEach((exact) => {
      const field = exact.dataset.editorGreetingExact;
      const range = greetingInputs.find((candidate) =>
        candidate.dataset.editorGreeting === field && candidate.type === "range");
      if (!range) return;
      let gestureScope = null;
      const update = () => {
        if (isBlockingAction()) return null;
        if (!Number.isFinite(exact.valueAsNumber)) return null;
        gestureScope ??= greetingScopeFromFieldPath(exact.dataset.editorField);
        activeGreetingControlScope ??= gestureScope;
        const value = Math.min(Number(exact.max), Math.max(Number(exact.min), exact.valueAsNumber));
        exact.value = String(value);
        range.value = String(value);
        setStageOverride(`${greetingStagePrefix(gestureScope.appearance, gestureScope.frameId)}${field}`, value);
        const output = document.getElementById(`${range.id}-output`);
        if (output) output.value = greetingOutputText(field, value);
        previewFromControls(gestureScope);
        applyStageLayout();
        return value;
      };
      exact.addEventListener("input", update);
      exact.addEventListener("change", () => {
        const value = update();
        if (value === null) {
          gestureScope = null;
          activeGreetingControlScope = null;
          applyDeferredGreetingMirrorAxes();
          exact.value = range.value;
          return;
        }
        gestureScope ??= greetingScopeFromFieldPath(exact.dataset.editorField);
        const { appearance, frameId } = gestureScope;
        gestureScope = null;
        queueGreetingFrame(
          greetingFrameFromControls(field, value, appearance, frameId),
          { appearance, frameId },
        );
        activeGreetingControlScope = null;
        applyDeferredGreetingMirrorAxes();
      });
    });

    const performUndo = () => {
      if (undoButton.disabled) return;
      if (!isBuiltInLayoutEdit()
          && (greetingPreferenceDraftDirty || greetingPreferenceInputDirty) && state) {
        clearGreetingInputState(state.greetingPreferences);
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
      const builtInLayout = isBuiltInLayoutEdit();
      if (!builtInLayout && metadataInputInvalid) {
        const firstInvalidMetadata = metadataInputs().find((input) => !input.value.trim());
        setInspectorPage("details", { resetScroll: true });
        if (firstInvalidMetadata) {
          firstInvalidMetadata.setAttribute("aria-invalid", "true");
          requestAnimationFrame(() => focusBelowInspector(firstInvalidMetadata));
        }
        announce(tr("validationMetadataFix"), "error");
        return;
      }
      const localGreetingError = !builtInLayout
        ? greetingPreferenceInputInvalid
          ? greetingPreferenceErrorTarget ?? greetingPhrasesInput
          : greetingPreferenceDraftErrorTarget(personal)
        : null;
      if (localGreetingError) {
        showGreetingInputError(localGreetingError);
        setInspectorPage("interface", { resetScroll: true });
        setInspectorTarget("interface.greeting");
        requestAnimationFrame(() => focusBelowInspector(localGreetingError ?? greetingPhrasesStatus));
        announce(tr("saveBlocked"), "error");
        return;
      }
      if (!state?.feedback.valid) {
        setInspectorPage("review", { resetScroll: true });
        quickFeedback.hidden = true;
        errorSummary.hidden = false;
        focusBelowInspector(errorSummary);
        announce(tr("saveBlocked"), "error");
        return;
      }
      const base = mutationBase();
      if (!base) return;
      if (!builtInLayout && greetingPreferenceDraftDirty) {
        if (!stageGreetingPreferenceDraft({
          followup: { type: "save-theme-edit", ...base },
        })) announce(tr("editorActionFailed"), "error");
        return;
      }
      post({ type: "save-theme-edit", ...base });
    };
    undoButton.addEventListener("click", performUndo);
    redoButton.addEventListener("click", performRedo);
    resetButton.addEventListener("click", () => showConfirm({
      titleText: tr("confirmResetTitle"), bodyText: tr("confirmResetBody"), actionText: tr("confirmResetAction"),
      opener: resetButton,
      callback: () => {
        const base = mutationBase();
        if (state && base) {
          if (!post(
            { type: "begin-theme-edit", theme: state.id, reset: true },
            { pendingBase: base },
          )) announce(tr("editorActionFailed"), "error");
        }
      },
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
      if (overlayState?.active || overlayState?.pending) stopWindowEdit();
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
      if (isBuiltInLayoutEdit() || !ID_PATTERN.test(theme)) return false;
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
      receiveOverlay,
      receiveOverlayState,
      requestDelete,
      refreshCardPreview: () => {
        if (state) reflectCardPreview();
      },
      refreshDeviceState: () => {
        if (state) refreshInspectorContext();
      },
      translate: tr,
      isActive: () => Boolean(state),
      normalizeEditorState,
      normalizeStudioStyle,
      normalizeLoadingScreen,
      normalizeInterfaceSurfaces,
      capabilityRegistry: EDITOR_CAPABILITY_REGISTRY,
      registeredViews: REGISTERED_VIEW_IDS,
    });
  }

  window.CLAUDE_AURA_EDITOR = Object.freeze({
    createController,
    normalizeEditorState,
    normalizeStudioStyle,
    normalizeLoadingScreen,
    normalizeInterfaceSurfaces,
    normalizeOverlayMessage,
    normalizeOverlaySelection,
    normalizeOverlayState,
    normalizeCapabilityRegistry,
    reconcileDuplicateTokenValue,
    backgroundScopeUiActive,
    greetingSourceChoice,
    greetingPreferencesForSourceChoice,
    greetingThemeOverrideFor,
    greetingMutationResult,
    sameMutationRequest,
    greetingResyncCaughtUp,
    patchResyncDecision,
    capabilityRegistry: EDITOR_CAPABILITY_REGISTRY,
    registeredViews: REGISTERED_VIEW_IDS,
  });
})();
