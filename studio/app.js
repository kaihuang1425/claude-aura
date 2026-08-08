// Aura Studio front-end. The Checkpoint B crop editor is a user-approved WO-05
// revision; later work orders keep using the marked host-bridge boundary.
(() => {
  "use strict";

  const STUDIO_PAGE_MESSAGE_TYPES = Object.freeze([
    "get-state", "set-theme", "set-appearance", "set-locale", "complete-studio-introduction",
    "set-image", "clear-image", "set-avatar", "clear-avatar", "set-avatar-framing",
    "set-personal-wordmark", "clear-personal-wordmark", "set-personal-wordmark-framing",
    "set-image-framing", "set-card-preview-crop", "set-enabled", "open-aura", "open-desktop",
    "import-theme", "export-terminal-themes", "create-theme-copy", "begin-theme-edit", "set-theme-token", "set-theme-layer",
    "apply-theme-patch", "pick-theme-layer-image", "pick-theme-launcher-mark", "pick-instant-prompt-icon", "remove-theme-layer", "move-theme-layer",
    "undo-theme-edit", "redo-theme-edit", "save-theme-edit", "discard-theme-edit", "delete-user-theme",
    "set-greeting-phrases", "reset-greeting",
    "set-aura-preview", "set-aura-topmost", "refresh-aura-mirror",
    "prompt-shelf-read", "prompt-shelf-create", "prompt-shelf-update",
    "prompt-shelf-move", "prompt-shelf-delete", "prompt-shelf-insert",
    "prompt-shelf-confirm-checked",
  ]);
  const studioPageMessageTypes = new Set(STUDIO_PAGE_MESSAGE_TYPES);

  // Interface copy lives one file per language in studio/locales/*.js, loaded
  // before this script. Each file registers its own entry on
  // window.CLAUDE_AURA_STRINGS; this page reads the "shell" half and
  // studio/editor.js reads the "editor" half.
  const STRINGS = Object.fromEntries(
    Object.entries(window.CLAUDE_AURA_STRINGS ?? {}).map(([tag, copy]) => [tag, copy?.shell ?? {}]),
  );

  const params = new URLSearchParams(window.location.search);
  const normalizeLocale = (value) => {
    if (typeof value !== "string") return "en";
    const tag = value.trim().replaceAll("_", "-");
    if (!tag) return "en";
    if (/^pt(?:-|$)/i.test(tag)) return "pt-BR";
    if (/^zh-(?:hktw|tw|hk|mo|hant)(?:-|$)/i.test(tag) || /^zh-hant(?:-|$)/i.test(tag)) return "zh-HKTW";
    if (/^zh-(?:cn|sg|hans)(?:-|$)/i.test(tag) || /^zh-hans(?:-|$)/i.test(tag)) return "zh-CN";
    if (/^en(?:-|$)/i.test(tag)) return "en";
    const base = tag.split("-", 1)[0].toLowerCase();
    return supportedLocales.has(base) ? base : "en";
  };
  const supportedLocales = new Set([
    "en", "hi", "es", "fr", "id", "ja", "ko", "pt-BR", "de", "it", "vi", "pl", "tr", "zh-CN", "zh-HKTW",
  ]);
  const ordinaryStudioViews = Object.freeze([
    "themes", "prompt-shelf", "background", "create", "settings",
  ]);
  const ordinaryStudioViewSet = new Set(ordinaryStudioViews);
  const rawLocale = params.get("locale") || navigator.language || "en";
  const requestedView = params.get("view");
  const requestedViewHash = ordinaryStudioViewSet.has(requestedView)
    ? `#${requestedView}`
    : "";
  const resolvedLocale = normalizeLocale(rawLocale);
  const locale = supportedLocales.has(resolvedLocale) ? resolvedLocale : "en";
  const t = (key) => STRINGS[locale]?.[key] ?? STRINGS.en?.[key] ?? key;
  document.documentElement.lang = locale === "zh-HKTW"
    ? "zh-Hant-TW"
    : locale === "zh-CN" ? "zh-Hans-CN" : locale;
  for (const node of document.querySelectorAll("[data-i18n]")) {
    node.textContent = t(node.dataset.i18n);
  }
  for (const node of document.querySelectorAll("[data-i18n-aria-label]")) {
    node.setAttribute("aria-label", t(node.dataset.i18nAriaLabel));
  }
  for (const node of document.querySelectorAll("[data-i18n-placeholder]")) {
    node.setAttribute("placeholder", t(node.dataset.i18nPlaceholder));
  }

  const themes = window.CLAUDE_AURA_THEMES ?? {};
  // This snapshot is the only authority for permanent Studio shell profiles.
  // Host-added themes and editor drafts keep their validated colour projection
  // but cannot select a bundled chrome recipe by choosing an ID.
  const bundledThemeIds = new Set(Object.keys(themes));
  const grid = document.getElementById("theme-grid");
  const studioRoot = document.querySelector(".studio");
  const builtInAuthoringBanner = document.getElementById("built-in-authoring-banner");
  const content = document.querySelector(".content");
  const statusBar = document.querySelector(".statusbar");
  const statusOut = document.getElementById("status");
  const appearanceMode = document.getElementById("appearance-mode");
  const appearanceInputs = [...appearanceMode.querySelectorAll("input[name='appearance']")];
  const toggleEnabled = document.getElementById("toggle-enabled");
  const languageSettings = document.getElementById("language-settings");
  const welcomeLanguage = document.getElementById("welcome-language");
  const localeInputs = [...document.querySelectorAll(
    'input[name="settings-locale"], input[name="welcome-locale"]')];
  const welcomeDialog = document.getElementById("welcome-dialog");
  const welcomeThemeMark = document.getElementById("welcome-theme-mark");
  const openWelcomeButton = document.getElementById("open-welcome");
  const welcomeClose = document.getElementById("welcome-close");
  const welcomeLater = document.getElementById("welcome-later");
  const welcomeTryTheme = document.getElementById("welcome-try-theme");
  const welcomeStatus = document.getElementById("welcome-status");
  const adjustThemePreview = document.getElementById("adjust-theme-preview");
  const adjustBackground = document.getElementById("adjust-background");
  const clearImage = document.getElementById("clear-image");
  const clearAvatar = document.getElementById("clear-avatar");
  const adjustAvatar = document.getElementById("adjust-avatar");
  const personalWordmarkControls = [...document.querySelectorAll("[data-personal-wordmark-panel]")]
    .map((panel) => ({
      panel,
      pick: panel.querySelector('[data-personal-wordmark-action="choose"]'),
      adjust: panel.querySelector('[data-personal-wordmark-action="adjust"]'),
      clear: panel.querySelector('[data-personal-wordmark-action="clear"]'),
      current: panel.querySelector("[data-personal-wordmark-current]"),
      state: panel.querySelector("[data-personal-wordmark-state]"),
      thumbnail: panel.querySelector("[data-personal-wordmark-thumbnail]"),
      image: panel.querySelector("[data-personal-wordmark-image]"),
    }))
    .filter((controls) => Object.values(controls).every(Boolean));
  const railThemeMark = document.getElementById("rail-theme-mark");
  const studioThemeIcon = document.getElementById("studio-theme-icon");
  const cropDialog = document.getElementById("crop-dialog");
  const cropTitle = document.getElementById("crop-title");
  const cropHelp = document.getElementById("crop-help");
  const cropError = document.getElementById("crop-error");
  const cropNotice = document.getElementById("crop-notice");
  const cropStage = document.getElementById("crop-stage");
  const cropImage = document.getElementById("crop-image");
  const cropSave = document.getElementById("crop-save");
  const cropReset = document.getElementById("crop-reset");
  const cropBackground = document.getElementById("crop-background");
  const cropBackgroundColor = document.getElementById("crop-background-color");
  const cropBackgroundChoices = [...document.querySelectorAll('input[name="crop-background-choice"]')];
  const cropCancelButtons = [...cropDialog.querySelectorAll('[value="cancel"]')];
  const wordmarkSurfacePreviews = document.getElementById("wordmark-surface-previews");
  const wordmarkSurfaceFrames = [...document.querySelectorAll(".wordmark-surface-frame")];
  const wordmarkSurfaceImages = [
    document.getElementById("wordmark-surface-light-image"),
    document.getElementById("wordmark-surface-dark-image"),
  ];
  const promptShelfSection = document.getElementById("prompt-shelf");
  const promptShelfSearch = document.getElementById("prompt-shelf-search");
  const promptShelfNew = document.getElementById("prompt-shelf-new");
  const promptShelfCount = document.getElementById("prompt-shelf-count");
  const promptShelfList = document.getElementById("prompt-shelf-list");
  const promptShelfEmpty = document.getElementById("prompt-shelf-empty");
  const promptShelfNoResults = document.getElementById("prompt-shelf-no-results");
  const promptShelfEditorTitle = document.getElementById("prompt-shelf-editor-title");
  const promptShelfCharacterCount = document.getElementById("prompt-shelf-character-count");
  const promptShelfText = document.getElementById("prompt-shelf-text");
  const promptShelfSave = document.getElementById("prompt-shelf-save");
  const promptShelfCancel = document.getElementById("prompt-shelf-cancel");
  const promptShelfMoveUp = document.getElementById("prompt-shelf-move-up");
  const promptShelfMoveDown = document.getElementById("prompt-shelf-move-down");
  const promptShelfDelete = document.getElementById("prompt-shelf-delete");
  const promptShelfInsert = document.getElementById("prompt-shelf-insert");
  const promptShelfInsertHelp = document.getElementById("prompt-shelf-insert-help");
  const promptShelfStatus = document.getElementById("prompt-shelf-status");
  const promptShelfRefresh = document.getElementById("prompt-shelf-refresh");
  const promptShelfRetryAction = document.getElementById("prompt-shelf-retry-action");
  const promptShelfConfirmChecked = document.getElementById("prompt-shelf-confirm-checked");
  const promptShelfItemTemplate = document.getElementById("prompt-shelf-item-template");
  const promptShelfDeleteDialog = document.getElementById("prompt-shelf-delete-dialog");
  const promptShelfDeleteConfirm = document.getElementById("prompt-shelf-delete-confirm");
  const promptShelfDeleteCancel = document.getElementById("prompt-shelf-delete-cancel");
  const ordinaryStudioPages = new Map(ordinaryStudioViews.map((view) => [
    view,
    document.querySelector(`[data-studio-page="${view}"]`),
  ]));
  const ordinaryStudioRailLinks = [...document.querySelectorAll("[data-studio-view]")]
    .filter((link) => ordinaryStudioViewSet.has(link.dataset.studioView));
  const cropInputs = {
    x: document.getElementById("crop-x"),
    y: document.getElementById("crop-y"),
    zoom: document.getElementById("crop-zoom"),
  };
  const cropOutputs = {
    x: document.getElementById("crop-x-output"),
    y: document.getElementById("crop-y-output"),
    zoom: document.getElementById("crop-zoom-output"),
  };
  const DEFAULT_CROP = Object.freeze({ x: 50, y: 50, zoom: 1 });
  const CARD_PREVIEW_MAX_ZOOM = 6;
  const state = {
    theme: "default",
    appearance: "system",
    locale,
    introductionPending: null,
    introductionRequested: false,
    enabled: true,
    connected: false,
    hasImage: false,
    hasAvatar: false,
    avatarPreviewUrl: null,
    avatarCrop: { ...DEFAULT_CROP },
    avatarBackground: "transparent",
    avatarHasAlpha: false,
    hasPersonalWordmark: false,
    personalWordmarkPreviewUrl: null,
    personalWordmarkCrop: { ...DEFAULT_CROP },
    personalWordmarkUnavailable: false,
    personalWordmarkSession: null,
    personalWordmarkRevision: 0,
    imagePreviewUrl: null,
    backgroundAspectRatio: 16 / 9,
    backgroundCropSupported: true,
    backgroundCrop: { ...DEFAULT_CROP },
    studioPreviewCrops: Object.create(null),
    effectiveIdentity: null,
    builtInAuthoring: false,
  };
  const STUDIO_FONT_STACKS = Object.freeze({
    "system-sans": 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    "humanist-sans": '"Segoe UI", "Hiragino Sans", "Yu Gothic UI", system-ui, sans-serif',
    "rounded-sans": '"Trebuchet MS", "Segoe UI", system-ui, sans-serif',
    "editorial-serif": 'ui-serif, Georgia, "Times New Roman", serif',
  });
  const STUDIO_SHADOWS = Object.freeze({
    none: "none",
    soft: "0 10px 30px rgb(0 0 0 / 0.14)",
    elevated: "0 20px 54px rgb(0 0 0 / 0.24)",
  });
  const studioColorScheme = window.matchMedia?.("(prefers-color-scheme: dark)") ?? null;
  const studioHexChannels = (value) => [1, 3, 5].map((offset) => Number.parseInt(value.slice(offset, offset + 2), 16));
  const studioHexFromChannels = (channels) => `#${channels.map((channel) => Math.round(channel)
    .toString(16).padStart(2, "0")).join("")}`.toUpperCase();
  const studioComposite = (foreground, background, alpha) => {
    const foregroundChannels = studioHexChannels(foreground);
    const backgroundChannels = studioHexChannels(background);
    return studioHexFromChannels(foregroundChannels.map((channel, index) => (
      (channel * alpha) + (backgroundChannels[index] * (1 - alpha)))));
  };
  const studioLinearChannel = (channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  const studioLuminance = (color) => {
    const [red, green, blue] = studioHexChannels(color).map(studioLinearChannel);
    return (0.2126 * red) + (0.7152 * green) + (0.0722 * blue);
  };
  const studioContrast = (left, right) => {
    const values = [studioLuminance(left), studioLuminance(right)];
    return (Math.max(...values) + 0.05) / (Math.min(...values) + 0.05);
  };
  const safeStudioComposite = (foreground, background, alpha, checks) => {
    const composite = studioComposite(foreground, background, alpha);
    return checks.every(([color, minimum]) => studioContrast(color, composite) >= minimum)
      ? composite
      : foreground;
  };
  const cardFrames = new Map();
  let cropContext = null;
  let cropDrag = null;
  let cropReturnFocus = null;
  let pendingCropSave = null;
  let pendingWordmarkAction = null;
  const clearPendingWordmarkAction = () => {
    window.clearTimeout(pendingWordmarkAction?.timer);
    pendingWordmarkAction = null;
  };
  const clearPendingCropSave = () => {
    window.clearTimeout(pendingCropSave?.timer);
    pendingCropSave = null;
  };
  let appearancePending = false;
  let localePending = null;
  let terminalThemeExportPending = false;
  let introductionOffered = false;
  let introductionIsAutomatic = false;
  let introductionCompletionDestination = null;
  let introductionCompletionWaiting = false;
  let introductionCompletionTimer = null;
  let introductionCompletionFocus = null;
  let welcomeReturnFocus = null;
  const resumeManualWelcome = (() => {
    try {
      const pending = sessionStorage.getItem("claude-aura:resume-welcome") === "true";
      sessionStorage.removeItem("claude-aura:resume-welcome");
      return pending;
    } catch {
      return false;
    }
  })();
  let manualWelcomeResumePending = resumeManualWelcome;
  let editorController = null;
  let activeStudioView = null;
  let activateStudioView = () => false;
  const studioViewScrollPositions = new Map();
  let editorStudioStyle = null;
  let editorStudioThemeId = null;
  let editorLauncherStyle = null;
  let editorLauncherMarkUrl = null;
  let requestedThemeMarkUrl = "";
  const promptShelfUuidPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
  const promptShelfIdPattern = /^[a-f0-9]{32}$/;
  const promptShelfBridgeVersion = 1;
  const promptShelf = {
    session: null,
    revision: 0,
    commandEpoch: 0,
    items: [],
    selectedId: null,
    baseline: "",
    loaded: false,
    persistenceAvailable: true,
    insertionAvailable: false,
    insertState: "idle",
    pending: null,
    pendingTimer: null,
    readRequests: new Set(),
    readTimer: null,
    readFailed: false,
    readRetrying: false,
    conflict: false,
    focusAfterRefresh: null,
    statusKey: "promptShelfStatusLoading",
    statusTone: "busy",
  };
  let renderPromptShelf = () => {};

  const effectiveStudioMode = () => (!state.enabled || state.appearance === "system")
    ? (studioColorScheme?.matches ? "dark" : "light")
    : state.appearance;
  const applyStudioStyle = () => {
    const activeEditorStyle = state.enabled ? editorStudioStyle : null;
    const themeId = activeEditorStyle
      ? editorStudioThemeId
      : (state.enabled ? state.theme : "default");
    const candidate = activeEditorStyle ?? themes[themeId]?.studioStyle ?? themes.default?.studioStyle;
    const normalized = window.CLAUDE_AURA_EDITOR?.normalizeStudioStyle?.(candidate);
    if (!normalized) return false;
    const mode = effectiveStudioMode();
    const colors = normalized[mode];
    const shared = normalized.shared;
    const surface = safeStudioComposite(colors.surface, colors.canvas, colors.surfaceAlpha, [
      [colors.textSecondary, 4.5], [colors.textMuted, 4.5], [colors.border, 3],
    ]);
    const rail = safeStudioComposite(colors.sidebar, colors.canvas, colors.sidebarAlpha, [
      [colors.sidebarText, 7], [colors.sidebarTextMuted, 4.5],
    ]);
    const controlRadius = Math.max(6, Math.min(16, Math.round(shared.radius * 0.65)));
    const root = document.documentElement;
    const properties = {
      "--bg": colors.canvas,
      "--surface": surface,
      "--raised": colors.raised,
      "--ink": colors.text,
      "--ink-secondary": colors.textSecondary,
      "--ink-muted": colors.textMuted,
      "--accent": colors.accent,
      "--accent-ink": colors.accentText,
      "--accent-soft": `color-mix(in srgb, ${colors.accent} 14%, ${colors.surface})`,
      "--border": colors.border,
      "--border-soft": `color-mix(in srgb, ${colors.border} 34%, transparent)`,
      "--ring": colors.focus,
      "--rail-bg": rail,
      "--rail-ink": colors.sidebarText,
      "--rail-ink-muted": colors.sidebarTextMuted,
      "--shadow": STUDIO_SHADOWS[shared.shadow],
      "--radius": `${shared.radius}px`,
      "--panel-radius": `${Math.max(8, shared.radius)}px`,
      "--control-radius": `${controlRadius}px`,
      "--studio-blur": `${shared.blur}px`,
      "--font-ui": STUDIO_FONT_STACKS[shared.fontUi],
      "--font-display": STUDIO_FONT_STACKS[shared.fontDisplay],
    };
    for (const [name, value] of Object.entries(properties)) root.style.setProperty(name, value);
    root.style.colorScheme = mode;
    root.dataset.studioTheme = themeId || "default";
    root.dataset.studioShell = !state.enabled
      ? "default"
      : activeEditorStyle
        ? "custom"
        : bundledThemeIds.has(themeId) ? themeId : "custom";
    root.dataset.studioMode = mode;
    return true;
  };

  railThemeMark.addEventListener("load", () => {
    railThemeMark.parentElement?.classList.add("has-theme-mark");
  });
  railThemeMark.addEventListener("error", () => {
    railThemeMark.parentElement?.classList.remove("has-theme-mark");
    const fallbackUrl = "https://aura.assets/default/launcher-mark.png";
    if (requestedThemeMarkUrl !== fallbackUrl && applyLauncherMaterial(themes.default?.launcher)) {
      requestedThemeMarkUrl = fallbackUrl;
      railThemeMark.src = fallbackUrl;
      if (studioThemeIcon) studioThemeIcon.href = fallbackUrl;
      return;
    }
    railThemeMark.removeAttribute("src");
    if (studioThemeIcon) studioThemeIcon.removeAttribute("href");
  });
  welcomeThemeMark.addEventListener("error", () => {
    const fallbackUrl = "https://aura.assets/default/launcher-mark.png";
    if (welcomeThemeMark.src !== fallbackUrl) {
      welcomeThemeMark.src = fallbackUrl;
      return;
    }
    welcomeThemeMark.removeAttribute("src");
  });

  const setStatus = (text, tone = "ok") => {
    statusOut.textContent = text;
    statusBar.dataset.tone = tone;
  };

  const localized = (map, fallback) => (map && (map[locale] ?? map.en)) || fallback || "";
  const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));
  const finite = (value) => typeof value === "number" && Number.isFinite(value);
  const normalizeAspectRatio = (value) => finite(value) && value >= 0.5 && value <= 4 ? value : 16 / 9;
  const normalizeCrop = (value, fallback = DEFAULT_CROP, maximumZoom = 2) => ({
    x: finite(value?.x) ? clamp(value.x, 0, 100) : fallback.x,
    y: finite(value?.y) ? clamp(value.y, 0, 100) : fallback.y,
    zoom: finite(value?.zoom) ? clamp(value.zoom, 1, maximumZoom) : fallback.zoom,
  });
  const studioPreviewUrl = (value, theme = null) => {
    if (typeof value !== "string") return null;
    const master = /^assets\/studio-previews\/masters\/([a-z0-9-]+)\.png$/.exec(value);
    if (master && (!theme || master[1] === theme.name)) return `https://aura.previews/${master[1]}.png`;
    if (/^assets\/theme-art\/[a-z0-9-]+\/card-preview\.webp$/.test(value)) {
      return `https://aura.assets/${value.slice("assets/theme-art/".length)}`;
    }
    if (value === "card-preview.webp" && theme?.source === "user" && hostThemeIdPattern.test(theme.name)) {
      return `https://aura.user-themes/${theme.name}/card-preview.webp`;
    }
    return null;
  };
  const launcherMarkUrl = (theme) => {
    const asset = theme?.launcher?.asset;
    const builtin = typeof asset === "string"
      ? /^assets\/theme-art\/([a-z0-9-]+)\/launcher-mark\.png$/.exec(asset)
      : null;
    if (builtin) return `https://aura.assets/${builtin[1]}/launcher-mark.png`;
    if (asset === "launcher-mark.png" && theme?.source === "user" && hostThemeIdPattern.test(theme.name)) {
      return `https://aura.user-themes/${theme.name}/launcher-mark.png`;
    }
    return "https://aura.assets/default/launcher-mark.png";
  };
  const LAUNCHER_MATERIAL_KEYS = Object.freeze([
    "surface", "surfaceHover", "foreground", "accent", "border", "radius", "borderWidth",
  ]);
  const hasExactKeys = (value, expected) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    const keys = Reflect.ownKeys(value);
    return keys.length === expected.length && expected.every((key) => keys.includes(key));
  };
  const normalizeLauncherMaterial = (value) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const colors = {};
    for (const key of ["surface", "surfaceHover", "foreground", "accent", "border"]) {
      if (typeof value[key] !== "string" || !/^#[0-9A-F]{6}$/.test(value[key])) return null;
      colors[key] = value[key];
    }
    if (typeof value.radius !== "number" || !Number.isFinite(value.radius)
        || value.radius < 8 || value.radius > 24
        || typeof value.borderWidth !== "number" || !Number.isFinite(value.borderWidth)
        || value.borderWidth < 1 || value.borderWidth > 3) return null;
    return { ...colors, radius: value.radius, borderWidth: value.borderWidth };
  };
  const normalizeEditorLauncherMarkUrl = (value) => {
    if (typeof value !== "string") return null;
    if (/^https:\/\/aura\.assets\/(?:default|japanese-film-editorial|korean-prestige|cartoon-studio|anime-twilight|study-library|japanese-idol|korean-idol)\/launcher-mark\.png$/.test(value)) return value;
    if (/^https:\/\/aura\.user-themes\/[a-z][a-z0-9-]{1,39}\/launcher-mark\.png$/.test(value)) return value;
    if (/^https:\/\/aura\.editor\/active\/launcher-[a-f0-9]{64}\.png$/.test(value)) return value;
    return null;
  };
  const normalizeEffectiveIdentity = (value) => {
    if (!hasExactKeys(value, ["launcher", "previewUrl"])
        || !hasExactKeys(value.launcher, LAUNCHER_MATERIAL_KEYS)) return null;
    const launcher = normalizeLauncherMaterial(value.launcher);
    const previewUrl = normalizeEditorLauncherMarkUrl(value.previewUrl);
    return launcher && previewUrl ? { launcher, previewUrl } : null;
  };
  const applyLauncherMaterial = (candidate) => {
    const normalized = normalizeLauncherMaterial(candidate)
      ?? normalizeLauncherMaterial(themes.default?.launcher);
    if (!normalized) return false;
    const root = document.documentElement;
    for (const [name, value] of Object.entries({
      "--launcher-surface": normalized.surface,
      "--launcher-surface-hover": normalized.surfaceHover,
      "--launcher-foreground": normalized.foreground,
      "--launcher-accent": normalized.accent,
      "--launcher-border": normalized.border,
      "--launcher-radius": `${normalized.radius}px`,
      "--launcher-border-width": `${normalized.borderWidth}px`,
    })) root.style.setProperty(name, value);
    return true;
  };
  const backgroundPreviewUrl = (value) => {
    if (typeof value !== "string") return null;
    try {
      const url = new URL(value);
      if (url.protocol !== "https:" || url.hostname !== "aura.background") return null;
      if (!/^\/preview-[a-f0-9]{64}(?:-[a-f0-9]{32})?\.(?:png|jpe?g|webp|gif|avif)$/.test(url.pathname)) return null;
      if (!/^\?v=[a-f0-9]{64}$/.test(url.search)) return null;
      return url.href;
    } catch { return null; }
  };
  const avatarPreviewUrl = (value) => {
    if (typeof value !== "string") return null;
    try {
      const url = new URL(value);
      if (url.protocol !== "https:" || url.hostname !== "aura.avatar") return null;
      if (!/^\/source\.(?:png|jpe?g|gif)$/.test(url.pathname)) return null;
      if (!/^\?v=(?:[a-f0-9]{64}|x)$/.test(url.search)) return null;
      return url.href;
    } catch { return null; }
  };
  const personalWordmarkPreviewUrl = (value) => {
    if (typeof value !== "string") return null;
    try {
      const url = new URL(value);
      if (url.protocol !== "https:" || url.hostname !== "aura.wordmark") return null;
      if (!/^\/(?:staging\/[a-f0-9]{32}|generations\/[a-f0-9]{64})\/source\.(?:png|jpe?g)$/.test(url.pathname)) {
        return null;
      }
      if (!/^\?v=[a-f0-9]{64}$/.test(url.search)) return null;
      return url.href;
    } catch { return null; }
  };
  // The avatar backdrop is either untouched alpha or one exact #RRGGBB fill.
  const normalizeAvatarBackground = (value) => (
    typeof value === "string" && /^#[0-9A-Fa-f]{6}$/.test(value) ? value.toUpperCase() : "transparent"
  );
  const PRESET_AVATAR_BACKGROUNDS = ["transparent", "#FFFFFF", "#1A1A1F"];
  // Mirror the chosen backdrop onto the crop stage so the framing preview shows
  // exactly what the host will bake behind the transparent areas.
  const syncAvatarBackdrop = () => {
    if (!cropBackground || cropContext?.kind !== "avatar") return;
    const chosen = cropContext.background;
    cropStage.dataset.backdrop = chosen === "transparent" ? "none" : "color";
    cropStage.style.setProperty("--crop-backdrop", chosen === "transparent" ? "transparent" : chosen);
    const preset = PRESET_AVATAR_BACKGROUNDS.includes(chosen);
    for (const input of cropBackgroundChoices) {
      input.checked = preset ? input.value === chosen : input.value === "custom";
    }
    if (!preset && cropBackgroundColor) cropBackgroundColor.value = chosen.toLowerCase();
    cropBackground.style.setProperty(
      "--crop-custom-color", preset ? (cropBackgroundColor?.value ?? "#4721a1") : chosen);
  };
  const defaultCropForTheme = (themeId) => normalizeCrop(
    themes[themeId]?.studioPreviewFrame, DEFAULT_CROP, CARD_PREVIEW_MAX_ZOOM);
  const cropForTheme = (themeId) => normalizeCrop(
    state.studioPreviewCrops[themeId], defaultCropForTheme(themeId), CARD_PREVIEW_MAX_ZOOM);
  const cropsEqual = (left, right) => left && right
    && Math.abs(left.x - right.x) < 0.011
    && Math.abs(left.y - right.y) < 0.011
    && Math.abs(left.zoom - right.zoom) < 0.011;

  const setCropError = (message = "") => {
    cropError.textContent = message;
    cropError.hidden = !message;
  };

  const setCropNotice = (message = "") => {
    cropNotice.textContent = message;
    cropNotice.hidden = !message;
  };

  const setCropBusy = (busy) => {
    cropSave.disabled = busy || !cropImage.complete || !cropImage.naturalWidth;
    cropReset.disabled = busy;
    for (const button of cropCancelButtons) button.disabled = busy;
    for (const input of Object.values(cropInputs)) input.disabled = busy;
    cropStage.classList.toggle("is-busy", busy);
  };

  const layoutCropImage = (frame, image, crop) => {
    const frameWidth = frame.clientWidth;
    const frameHeight = frame.clientHeight;
    if (!frameWidth || !frameHeight || !image.naturalWidth || !image.naturalHeight) {
      return { overflowX: 0, overflowY: 0 };
    }
    const layout = window.CLAUDE_AURA_CROP_MATH?.coverLayout?.({
      sourceWidth: image.naturalWidth,
      sourceHeight: image.naturalHeight,
      outputWidth: frameWidth,
      outputHeight: frameHeight,
      ...crop,
    });
    if (!layout) return { overflowX: 0, overflowY: 0 };
    image.style.width = `${layout.width}px`;
    image.style.height = `${layout.height}px`;
    image.style.left = `${layout.left}px`;
    image.style.top = `${layout.top}px`;
    return { overflowX: layout.overflowX, overflowY: layout.overflowY };
  };

  const layoutPersonalWordmarkPreview = (controls = null) => {
    for (const item of controls ? [controls] : personalWordmarkControls) {
      if (!item.image.complete || !item.image.naturalWidth) continue;
      layoutCropImage(
        item.thumbnail,
        item.image,
        state.personalWordmarkCrop,
      );
    }
  };

  const layoutWordmarkSurfacePreviews = () => {
    if (cropContext?.kind !== "wordmark") return;
    for (let index = 0; index < wordmarkSurfaceFrames.length; index += 1) {
      const image = wordmarkSurfaceImages[index];
      if (image?.complete && image.naturalWidth) {
        layoutCropImage(wordmarkSurfaceFrames[index], image, cropContext.draft);
      }
    }
  };

  const layoutCardCrop = (themeId) => {
    const item = cardFrames.get(themeId);
    if (item) layoutCropImage(item.frame, item.image, cropForTheme(themeId));
  };
  const cropResizeObserver = typeof ResizeObserver === "function"
    ? new ResizeObserver((entries) => {
      for (const entry of entries) {
        const themeId = entry.target.dataset.theme;
        if (themeId) layoutCardCrop(themeId);
        else if (entry.target === cropStage && cropContext) syncCropEditor();
        else {
          const controls = personalWordmarkControls.find(
            (item) => item.thumbnail === entry.target,
          );
          if (controls) layoutPersonalWordmarkPreview(controls);
        }
      }
    })
    : null;
  for (const controls of personalWordmarkControls) {
    cropResizeObserver?.observe(controls.thumbnail);
    controls.image.onload = () => layoutPersonalWordmarkPreview(controls);
    controls.image.onerror = () => controls.image.removeAttribute("src");
  }

  const syncPersonalWordmarkControls = () => {
    const hasPreview = Boolean(state.personalWordmarkPreviewUrl);
    const pending = Boolean(pendingWordmarkAction || pendingCropSave?.kind === "wordmark");
    const sessionReady = promptShelfUuidPattern.test(state.personalWordmarkSession ?? "")
      && Number.isSafeInteger(state.personalWordmarkRevision)
      && state.personalWordmarkRevision >= 0;
    for (const controls of personalWordmarkControls) {
      controls.current.hidden = !state.hasPersonalWordmark && !hasPreview;
      controls.state.textContent = state.personalWordmarkUnavailable
        ? t("wordmarkUnavailable")
        : state.hasPersonalWordmark && !hasPreview
          ? t("wordmarkSourceUnavailable")
          : t("wordmarkSaved");
      if (hasPreview) {
        if (controls.image.src !== state.personalWordmarkPreviewUrl) {
          controls.image.src = state.personalWordmarkPreviewUrl;
        } else {
          layoutPersonalWordmarkPreview(controls);
        }
      } else {
        controls.image.removeAttribute("src");
      }
      controls.pick.textContent = t(
        state.hasPersonalWordmark ? "replaceWordmark" : "chooseWordmark",
      );
      controls.pick.classList.toggle("primary-button", !state.hasPersonalWordmark);
      controls.pick.classList.toggle("ghost-button", state.hasPersonalWordmark);
      controls.pick.disabled = pending || !sessionReady;
      controls.adjust.hidden = !state.hasPersonalWordmark;
      controls.adjust.disabled = pending || !hasPreview || state.personalWordmarkUnavailable;
      controls.clear.hidden = !state.hasPersonalWordmark;
      controls.clear.disabled = pending || !sessionReady;
    }
    editorController?.refreshDeviceState?.();
  };

  const reflect = () => {
    applyStudioStyle();
    for (const input of appearanceInputs) {
      input.checked = input.value === state.appearance;
    }
    appearanceMode.disabled = appearancePending || !state.enabled;
    appearanceMode.setAttribute("aria-busy", String(appearancePending));
    const welcomeBusy = Boolean(localePending || introductionCompletionWaiting);
    for (const input of localeInputs) {
      input.checked = input.value === (localePending ?? state.locale);
      input.disabled = welcomeBusy;
    }
    languageSettings.setAttribute("aria-busy", String(Boolean(localePending)));
    welcomeLanguage.setAttribute("aria-busy", String(welcomeBusy));
    welcomeDialog.setAttribute("aria-busy", String(welcomeBusy));
    for (const button of [welcomeClose, welcomeLater, welcomeTryTheme]) {
      button.setAttribute("aria-disabled", String(welcomeBusy));
    }
    for (const input of grid.querySelectorAll("input[name='theme']")) {
      input.checked = input.value === state.theme;
    }
    toggleEnabled.setAttribute("aria-pressed", String(state.enabled));
    toggleEnabled.textContent = state.enabled ? t("originalLook") : t("applyTheme");
    const activeTheme = themes[state.theme];
    const identityTheme = state.enabled ? activeTheme : themes.default;
    const activeEditorLauncher = state.enabled ? editorLauncherStyle : null;
    const disconnectedLauncher = activeEditorLauncher ?? identityTheme?.launcher;
    const connectedIdentity = state.effectiveIdentity ?? {
      launcher: themes.default?.launcher,
      previewUrl: "https://aura.assets/default/launcher-mark.png",
    };
    applyLauncherMaterial(state.connected ? connectedIdentity.launcher : disconnectedLauncher);
    const disconnectedMarkUrl = activeEditorLauncher && editorLauncherMarkUrl
      ? editorLauncherMarkUrl
      : launcherMarkUrl(identityTheme);
    const themeMarkUrl = state.connected ? connectedIdentity.previewUrl : disconnectedMarkUrl;
    if (requestedThemeMarkUrl !== themeMarkUrl) {
      requestedThemeMarkUrl = themeMarkUrl;
      railThemeMark.parentElement?.classList.remove("has-theme-mark");
      railThemeMark.src = themeMarkUrl;
      welcomeThemeMark.src = themeMarkUrl;
      if (studioThemeIcon) studioThemeIcon.href = themeMarkUrl;
    }
    const activeThemeImage = activeTheme ? studioPreviewUrl(activeTheme.studioPreview, activeTheme) : null;
    adjustThemePreview.hidden = !activeThemeImage;
    if (activeThemeImage) {
      adjustThemePreview.setAttribute("aria-label", t("adjustPreviewFor")
        .replace("{0}", localized(activeTheme.labels, activeTheme.label)));
    }
    adjustBackground.hidden = !state.hasImage;
    adjustBackground.disabled = state.hasImage && !state.imagePreviewUrl;
    clearImage.disabled = !state.hasImage;
    if (clearAvatar) clearAvatar.disabled = !state.hasAvatar;
    if (adjustAvatar) {
      adjustAvatar.hidden = !state.hasAvatar;
      adjustAvatar.disabled = state.hasAvatar && !state.avatarPreviewUrl;
    }
    syncPersonalWordmarkControls();
    for (const themeId of cardFrames.keys()) layoutCardCrop(themeId);
    editorController?.refreshCardPreview?.();
    renderPromptShelf();
  };

  // ── HOST BRIDGE (WO-05 / WO-07 wire the other side in aura-ui.ps1) ──────
  const bridge = window.chrome?.webview ?? null;
  const appearanceModes = new Set(["system", "light", "dark"]);
  const hostThemeIdPattern = /^[a-z][a-z0-9-]{1,39}$/;
  const hostThemeColorPattern = /^#[0-9a-f]{6}$/i;
  const hostThemeKeys = new Set([
    "name", "label", "description", "labels", "descriptions", "swatches", "preview", "launcher", "studioPreview",
    "studioPreviewFrame", "studioStyle", "source", "sourceRecipe",
  ]);
  // Theme metadata can opt into any Studio interface locale. English remains
  // the required fallback when a theme has not supplied the active locale.
  const hostThemeLocales = new Set([
    "en", "hi", "es", "fr", "id", "ja", "ko", "pt-BR", "de", "it", "vi", "pl", "tr", "zh-CN", "zh-HKTW",
  ]);
  const hostThemePreviewKeys = new Set(["chrome", "background", "surface", "accent", "text"]);
  const hostThemeLauncherKeys = new Set([
    "asset", "surface", "surfaceHover", "foreground", "accent", "border", "radius", "borderWidth",
  ]);
  const hostThemeLauncherAssetPattern = /^(?:assets\/theme-art\/(?:default|japanese-film-editorial|korean-prestige|cartoon-studio|anime-twilight|study-library|japanese-idol|korean-idol)\/launcher-mark\.png|launcher-mark\.png)$/;

  const plainRecord = (value) => value && typeof value === "object" && !Array.isArray(value);
  const hostText = (value, maximum) => {
    if (typeof value !== "string") return null;
    const text = value.trim();
    return text && text.length <= maximum ? text : null;
  };
  const hostLocalizedText = (value, maximum) => {
    if (value === undefined) return undefined;
    if (!plainRecord(value)) return null;
    const result = Object.create(null);
    for (const [key, textValue] of Object.entries(value)) {
      if (!hostThemeLocales.has(key)) return null;
      const text = hostText(textValue, maximum);
      if (!text) return null;
      result[key] = text;
    }
    return result;
  };
  const normalizeHostTheme = (value) => {
    if (!plainRecord(value) || Object.keys(value).some((key) => !hostThemeKeys.has(key))) return null;
    const name = hostText(value.name, 40);
    const label = hostText(value.label, 120);
    const description = hostText(value.description, 500);
    if (!name || !hostThemeIdPattern.test(name) || !label || !description) return null;

    const labels = hostLocalizedText(value.labels, 120);
    const descriptions = hostLocalizedText(value.descriptions, 500);
    if (labels === null || descriptions === null) return null;
    if ((labels === undefined) !== (descriptions === undefined)) return null;
    if (labels !== undefined) {
      const labelLocales = Object.keys(labels);
      const descriptionLocales = Object.keys(descriptions);
      if (!Object.hasOwn(labels, "en")
          || labelLocales.length !== descriptionLocales.length
          || labelLocales.some((locale) => !Object.hasOwn(descriptions, locale))) return null;
    }

    let swatches;
    if (value.swatches !== undefined) {
      if (!Array.isArray(value.swatches) || value.swatches.length > 6
          || value.swatches.some((color) => typeof color !== "string" || !hostThemeColorPattern.test(color))) {
        return null;
      }
      swatches = value.swatches.slice();
    }

    let preview;
    if (value.preview !== undefined) {
      if (!plainRecord(value.preview)
          || Object.keys(value.preview).some((key) => !hostThemePreviewKeys.has(key))) return null;
      preview = Object.create(null);
      for (const [key, color] of Object.entries(value.preview)) {
        if (typeof color !== "string" || !hostThemeColorPattern.test(color)) return null;
        preview[key] = color;
      }
    }

    let studioPreview;
    if (value.studioPreview !== undefined) {
      if (value.studioPreview !== null && !studioPreviewUrl(value.studioPreview, value)) return null;
      studioPreview = value.studioPreview;
    }

    let studioPreviewFrame;
    if (value.studioPreviewFrame !== undefined && value.studioPreviewFrame !== null) {
      if (!plainRecord(value.studioPreviewFrame)
          || Object.keys(value.studioPreviewFrame).sort().join(",") !== "x,y,zoom"
          || !finite(value.studioPreviewFrame.x) || value.studioPreviewFrame.x < 0 || value.studioPreviewFrame.x > 100
          || !finite(value.studioPreviewFrame.y) || value.studioPreviewFrame.y < 0 || value.studioPreviewFrame.y > 100
          || !finite(value.studioPreviewFrame.zoom) || value.studioPreviewFrame.zoom < 1
          || value.studioPreviewFrame.zoom > CARD_PREVIEW_MAX_ZOOM) return null;
      studioPreviewFrame = { ...value.studioPreviewFrame };
    }

    let launcher;
    if (value.launcher !== undefined) {
      if (!plainRecord(value.launcher)
          || Object.keys(value.launcher).some((key) => !hostThemeLauncherKeys.has(key))
          || typeof value.launcher.asset !== "string"
          || !hostThemeLauncherAssetPattern.test(value.launcher.asset)) return null;
      launcher = Object.create(null);
      for (const key of ["surface", "surfaceHover", "foreground", "accent", "border"]) {
        if (typeof value.launcher[key] !== "string" || !hostThemeColorPattern.test(value.launcher[key])) return null;
        launcher[key] = value.launcher[key];
      }
      if (typeof value.launcher.radius !== "number" || value.launcher.radius < 8 || value.launcher.radius > 24
          || typeof value.launcher.borderWidth !== "number" || value.launcher.borderWidth < 1
          || value.launcher.borderWidth > 3) return null;
      launcher.asset = value.launcher.asset;
      launcher.radius = value.launcher.radius;
      launcher.borderWidth = value.launcher.borderWidth;
    }

    let studioStyle;
    if (value.studioStyle !== undefined) {
      studioStyle = window.CLAUDE_AURA_EDITOR?.normalizeStudioStyle?.(value.studioStyle);
      if (!studioStyle) return null;
    }

    let source;
    if (value.source !== undefined) {
      if (value.source !== null && value.source !== "builtin" && value.source !== "user") return null;
      source = value.source;
    }

    let sourceRecipe;
    if (value.sourceRecipe !== undefined) {
      if (value.sourceRecipe !== null
          && (typeof value.sourceRecipe !== "string" || !hostThemeIdPattern.test(value.sourceRecipe))) return null;
      sourceRecipe = value.sourceRecipe;
    }

    return {
      name,
      label,
      description,
      ...(labels === undefined ? {} : { labels }),
      ...(descriptions === undefined ? {} : { descriptions }),
      ...(swatches === undefined ? {} : { swatches }),
      ...(preview === undefined ? {} : { preview }),
      ...(launcher === undefined ? {} : { launcher }),
      ...(studioStyle === undefined ? {} : { studioStyle }),
      ...(studioPreview === undefined ? {} : { studioPreview }),
      ...(studioPreviewFrame === undefined ? {} : { studioPreviewFrame }),
      ...(source === undefined ? {} : { source }),
      ...(sourceRecipe === undefined ? {} : { sourceRecipe }),
    };
  };

  const themeCardInput = (themeId) => [...grid.querySelectorAll("input[name='theme']")]
    .find((input) => input.value === themeId) ?? null;
  const focusThemeCard = (themeId) => themeCardInput(themeId)?.focus();
  const themeSource = (theme) => bundledThemeIds.has(theme.name) ? "builtin" : (theme.source ?? "user");
  const syncThemeCardPresentation = (card, theme) => {
    const body = card.querySelector(".theme-card-body");
    const title = body?.querySelector("strong");
    const description = body?.querySelector("small");
    if (title) title.textContent = localized(theme.labels, theme.label);
    if (description) description.textContent = localized(theme.descriptions, theme.description);
    const swatches = body?.querySelector(".swatches");
    if (swatches) {
      swatches.replaceChildren(...(theme.swatches ?? []).slice(0, 4).map((color) => {
        const swatch = document.createElement("i");
        swatch.style.background = color;
        return swatch;
      }));
    }
    const preview = theme.preview ?? {};
    const mini = card.querySelector(".mini");
    if (mini) {
      mini.style.background = preview.background ?? "#eeeeee";
      const chrome = mini.querySelector(".mini-chrome");
      const surface = mini.querySelector(".mini-surface");
      if (chrome) chrome.style.background = preview.chrome ?? "#222222";
      if (surface) surface.style.background = preview.surface ?? "#ffffff";
      for (const mark of mini.querySelectorAll(".mini-chrome i, .mini-text")) {
        mark.style.background = preview.text ?? (mark.matches("i") ? "#ffffff" : "#333333");
      }
      const accent = mini.querySelector(".mini-accent");
      if (accent) accent.style.background = preview.accent ?? "#888888";
    }
    const frame = cardFrames.get(theme.name);
    const imageUrl = studioPreviewUrl(theme.studioPreview, theme);
    if (frame && imageUrl && frame.image.src !== imageUrl) frame.image.src = imageUrl;
  };
  const setTerminalThemeExportPending = (pending) => {
    terminalThemeExportPending = Boolean(pending);
    for (const button of grid.querySelectorAll("[data-terminal-theme-export]")) {
      button.disabled = terminalThemeExportPending;
    }
  };
  const syncThemeCardActions = (card, theme) => {
    card.querySelector(".theme-card-actions")?.remove();
    const actions = document.createElement("div");
    actions.className = "theme-card-actions";
    actions.setAttribute("role", "group");
    const themeLabel = localized(theme.labels, theme.label);
    actions.setAttribute("aria-label", `${t("quickActions")}: ${themeLabel}`);
    const source = themeSource(theme);
    const builtInLayoutAuthoring = source === "builtin"
      && state.builtInAuthoring
      && bundledThemeIds.has(theme.name);
    actions.classList.toggle("is-builtin-authoring", builtInLayoutAuthoring);
    const sourceBadge = document.createElement("span");
    sourceBadge.className = "theme-source-badge";
    sourceBadge.textContent = editorController?.translate(source === "builtin" ? "builtInTheme" : "customTheme")
      ?? (source === "builtin" ? "Built-in" : "Custom");
    actions.appendChild(sourceBadge);
    const action = document.createElement("button");
    action.type = "button";
    action.className = "ghost-button";
    if (source === "builtin") {
      if (builtInLayoutAuthoring) {
        const authorLayout = document.createElement("button");
        authorLayout.type = "button";
        authorLayout.className = "primary-button theme-builtin-layout-action";
        authorLayout.textContent = `${
          editorController?.translate("editTheme") ?? "Edit"
        } · ${
          editorController?.translate("builtInTheme") ?? "Built-in"
        } · ${
          editorController?.translate("branchInterfaceDetail") ?? "Surfaces & layout"
        }`;
        authorLayout.setAttribute("aria-label", `${authorLayout.textContent}: ${themeLabel}`);
        authorLayout.addEventListener("click", () => {
          setStatus(t("statusApplying"), "busy");
          send({ type: "begin-theme-edit", theme: theme.name, reset: false });
        });
        actions.appendChild(authorLayout);
      }
      action.textContent = editorController?.translate("duplicateToCustomize") ?? "Duplicate to customize";
      action.setAttribute("aria-label", `${action.textContent}: ${themeLabel}`);
      action.addEventListener("click", () => {
        setStatus(t("statusApplying"), "busy");
        send({ type: "create-theme-copy", theme: theme.name });
      });
      actions.appendChild(action);
    } else {
      action.textContent = editorController?.translate("editTheme") ?? "Edit";
      action.setAttribute("aria-label", `${action.textContent}: ${themeLabel}`);
      action.addEventListener("click", () => {
        setStatus(t("statusApplying"), "busy");
        send({ type: "begin-theme-edit", theme: theme.name, reset: false });
      });
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "ghost-button";
      remove.textContent = editorController?.translate("deleteTheme") ?? "Delete";
      remove.setAttribute("aria-label", `${remove.textContent}: ${themeLabel}`);
      remove.addEventListener("click", () => editorController?.requestDelete(
        theme.name, localized(theme.labels, theme.label), remove));
      actions.append(action, remove);
    }
    const exportTerminalThemes = document.createElement("button");
    exportTerminalThemes.type = "button";
    exportTerminalThemes.className = "ghost-button";
    exportTerminalThemes.dataset.terminalThemeExport = "";
    exportTerminalThemes.textContent = t("exportTerminalThemes");
    exportTerminalThemes.setAttribute("aria-label", `${exportTerminalThemes.textContent}: ${themeLabel}`);
    exportTerminalThemes.disabled = terminalThemeExportPending;
    exportTerminalThemes.addEventListener("click", () => {
      if (terminalThemeExportPending) return;
      setTerminalThemeExportPending(true);
      setStatus(t("terminalThemesExporting"), "busy");
      if (!send({ type: "export-terminal-themes", theme: theme.name })) {
        setTerminalThemeExportPending(false);
      }
    });
    actions.appendChild(exportTerminalThemes);
    card.appendChild(actions);
  };
  const removeHostThemeCard = (themeId) => {
    const item = cardFrames.get(themeId);
    if (item) cropResizeObserver?.unobserve(item.frame);
    cardFrames.delete(themeId);
    themeCardInput(themeId)?.closest(".theme-card")?.remove();
  };
  const createHostThemeCard = (theme) => {
    const card = document.createElement("div");
    card.className = "theme-card";
    const choice = document.createElement("div");
    choice.className = "theme-card-choice";
    const input = document.createElement("input");
    input.type = "radio";
    input.name = "theme";
    input.id = `theme-${theme.name}`;
    input.value = theme.name;
    const label = document.createElement("label");
    label.htmlFor = input.id;

    const imageUrl = studioPreviewUrl(theme.studioPreview, theme);
    if (imageUrl) {
      const frame = document.createElement("span");
      frame.className = "theme-card-preview-frame";
      frame.dataset.theme = theme.name;
      frame.setAttribute("aria-hidden", "true");
      const image = document.createElement("img");
      image.className = "theme-card-preview";
      image.src = imageUrl;
      image.alt = "";
      image.draggable = false;
      image.setAttribute("aria-hidden", "true");
      frame.appendChild(image);
      label.appendChild(frame);
      cardFrames.set(theme.name, { frame, image });
      image.addEventListener("load", () => layoutCardCrop(theme.name));
      cropResizeObserver?.observe(frame);
    } else {
      const preview = theme.preview ?? {};
      const mini = document.createElement("span");
      mini.className = "mini";
      mini.style.background = preview.background ?? "#eeeeee";
      mini.setAttribute("aria-hidden", "true");
      const chrome = document.createElement("span");
      chrome.className = "mini-chrome";
      chrome.style.background = preview.chrome ?? "#222222";
      for (let index = 0; index < 2; index += 1) {
        const mark = document.createElement("i");
        mark.style.background = preview.text ?? "#ffffff";
        chrome.appendChild(mark);
      }
      const surface = document.createElement("span");
      surface.className = "mini-surface";
      surface.style.background = preview.surface ?? "#ffffff";
      const textMark = document.createElement("span");
      textMark.className = "mini-text";
      textMark.style.background = preview.text ?? "#333333";
      const accentMark = document.createElement("span");
      accentMark.className = "mini-accent";
      accentMark.style.background = preview.accent ?? "#888888";
      surface.append(textMark, accentMark);
      mini.append(chrome, surface);
      label.appendChild(mini);
    }

    const body = document.createElement("span");
    body.className = "theme-card-body";
    const title = document.createElement("strong");
    title.textContent = localized(theme.labels, theme.label);
    const description = document.createElement("small");
    description.textContent = localized(theme.descriptions, theme.description);
    const swatches = document.createElement("span");
    swatches.className = "swatches";
    swatches.setAttribute("aria-hidden", "true");
    for (const color of (theme.swatches ?? []).slice(0, 4)) {
      const swatch = document.createElement("i");
      swatch.style.background = color;
      swatches.appendChild(swatch);
    }
    body.append(title, description, swatches);
    label.appendChild(body);
    const badge = document.createElement("span");
    badge.className = "selected-badge";
    badge.setAttribute("aria-hidden", "true");
    badge.textContent = t("selected");
    choice.append(input, label, badge);
    card.appendChild(choice);
    input.addEventListener("change", () => {
      state.theme = theme.name;
      state.enabled = true;
      setStatus(t("statusApplying"), "busy");
      if (!send({ type: "set-theme", theme: theme.name })) {
        setStatus(t("statusActive").replace("{0}", localized(theme.labels, theme.label)));
      }
      reflect();
    });
    syncThemeCardActions(card, theme);
    grid.appendChild(card);
    if (imageUrl) layoutCardCrop(theme.name);
    return card;
  };
  const syncHostThemes = (value) => {
    if (!Array.isArray(value) || value.length > 256) return false;
    const incoming = [];
    const incomingIds = new Set();
    for (const item of value) {
      const theme = normalizeHostTheme(item);
      if (!theme || incomingIds.has(theme.name)) return false;
      incoming.push(theme);
      incomingIds.add(theme.name);
    }

    for (const themeId of Object.keys(themes)) {
      if (!bundledThemeIds.has(themeId) && !incomingIds.has(themeId)) {
        removeHostThemeCard(themeId);
        delete themes[themeId];
      }
    }
    for (const incomingTheme of incoming) {
      const existing = Object.hasOwn(themes, incomingTheme.name) ? themes[incomingTheme.name] : null;
      if (existing) {
        const labels = incomingTheme.labels === undefined
          ? existing.labels
          : { ...incomingTheme.labels };
        const descriptions = incomingTheme.descriptions === undefined
          ? existing.descriptions
          : { ...incomingTheme.descriptions };
        const preview = { ...(existing.preview ?? {}), ...(incomingTheme.preview ?? {}) };
        const bundledPreview = bundledThemeIds.has(incomingTheme.name) && incomingTheme.studioPreview == null
          ? existing.studioPreview
          : incomingTheme.studioPreview;
        Object.assign(existing, incomingTheme, { labels, descriptions, preview });
        if (bundledPreview !== undefined) existing.studioPreview = bundledPreview;
        const card = themeCardInput(incomingTheme.name)?.closest(".theme-card");
        if (card) {
          syncThemeCardPresentation(card, existing);
          syncThemeCardActions(card, existing);
        }
      } else {
        themes[incomingTheme.name] = incomingTheme;
        createHostThemeCard(incomingTheme);
      }
    }
    return true;
  };
  const syncBuiltInAuthoringCards = () => {
    for (const input of grid.querySelectorAll("input[name='theme']")) {
      const theme = themes[input.value];
      const card = input.closest(".theme-card");
      if (theme && card) syncThemeCardActions(card, theme);
    }
  };
  const send = (message) => {
    if (!message || typeof message !== "object" || !studioPageMessageTypes.has(message.type)) return false;
    if ((message.type === "set-aura-preview" || message.type === "refresh-aura-mirror")
        && !editorController?.isActive?.()) return false;
    if (!bridge) { setStatus(t("statusDemo"), "busy"); return false; }
    bridge.postMessage(message);
    return true;
  };

  const promptShelfFormat = (key, ...values) => values.reduce(
    (copy, value, index) => copy.replaceAll(`{${index}}`, String(value)),
    t(key),
  );
  const promptShelfIntlLocale = () => {
    if (state.locale === "zh-HKTW") return "zh-Hant-TW";
    if (state.locale === "zh-CN") return "zh-Hans-CN";
    return state.locale || "en";
  };
  const promptShelfFormatNumber = (value) => (
    Number(value).toLocaleString(promptShelfIntlLocale())
  );
  const promptShelfFold = (value) => (
    String(value).toLocaleLowerCase(promptShelfIntlLocale())
  );
  const newPromptShelfRequestId = () => {
    const randomUuid = window.crypto?.randomUUID?.();
    if (typeof randomUuid === "string" && promptShelfUuidPattern.test(randomUuid.toLowerCase())) {
      return randomUuid.toLowerCase();
    }
    if (typeof window.crypto?.getRandomValues !== "function") return null;
    const bytes = new Uint8Array(16);
    window.crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  };
  const newPersonalWordmarkMessage = (type, fields = {}) => {
    const requestId = newPromptShelfRequestId();
    if (!requestId || !promptShelfUuidPattern.test(state.personalWordmarkSession ?? "")
        || !Number.isSafeInteger(state.personalWordmarkRevision)
        || state.personalWordmarkRevision < 0) return null;
    return {
      type,
      requestId,
      session: state.personalWordmarkSession,
      revision: state.personalWordmarkRevision,
      ...fields,
    };
  };
  const sendPersonalWordmarkAction = (type, fields = {}, opener = null) => {
    if (pendingWordmarkAction || pendingCropSave?.kind === "wordmark") return null;
    const message = newPersonalWordmarkMessage(type, fields);
    if (!message) {
      setStatus(t("statusDemo"), "error");
      return null;
    }
    const pending = {
      requestId: message.requestId,
      type,
      operation: fields.operation ?? null,
      opener,
    };
    pendingWordmarkAction = pending;
    if (!send(message)) {
      clearPendingWordmarkAction();
      setStatus(t("statusDemo"), "error");
      reflect();
      return null;
    }
    if (fields.operation !== "choose") {
      pending.timer = window.setTimeout(() => {
        if (pendingWordmarkAction !== pending) return;
        clearPendingWordmarkAction();
        setStatus(t("saveFailed"), "error");
        reflect();
      }, 10_000);
    }
    reflect();
    return message;
  };
  const promptShelfTextIsValid = (value) => (
    typeof value === "string"
    && value.trim().length > 0
    && value.length <= 8000
    && !/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(value)
  );
  const promptShelfHasExactKeys = (value, keys) => {
    const names = Object.keys(value);
    return names.length === keys.length && keys.every((key) => Object.hasOwn(value, key));
  };
  const selectedPromptShelfItem = () => (
    promptShelf.items.find((item) => item.id === promptShelf.selectedId) ?? null
  );
  const promptShelfIsDirty = () => promptShelfText.value !== promptShelf.baseline;
  const setPromptShelfStatus = (key, tone = "ok") => {
    promptShelf.statusKey = key;
    promptShelf.statusTone = tone;
    renderPromptShelf();
  };
  const announcePromptShelfStatus = (key, tone = "ok") => {
    promptShelf.statusKey = key;
    promptShelf.statusTone = tone;
    promptShelfStatus.textContent = t(key);
    promptShelfStatus.dataset.tone = tone;
  };
  const clearPromptShelfPending = () => {
    window.clearTimeout(promptShelf.pendingTimer);
    promptShelf.pendingTimer = null;
    promptShelf.pending = null;
  };
  const clearPromptShelfReads = () => {
    window.clearTimeout(promptShelf.readTimer);
    promptShelf.readTimer = null;
    promptShelf.readRequests.clear();
  };
  const promptShelfDisplay = (text) => {
    const lines = text.split(/\r?\n/);
    const firstNonEmpty = lines.findIndex((line) => line.trim());
    const title = firstNonEmpty >= 0
      ? lines[firstNonEmpty].trim().replace(/\s+/g, " ")
      : text.trim().replace(/\s+/g, " ");
    const preview = lines.slice(firstNonEmpty + 1).join(" ").trim().replace(/\s+/g, " ");
    return { title, preview };
  };

  renderPromptShelf = () => {
    const selected = selectedPromptShelfItem();
    const pending = Boolean(promptShelf.pending);
    const dirty = promptShelfIsDirty();
    const textValid = promptShelfTextIsValid(promptShelfText.value);
    const searching = Boolean(promptShelfSearch.value.trim());
    const insertionReady = Boolean(
      selected
      && state.enabled
      && promptShelf.insertionAvailable
      && promptShelf.insertState === "idle"
      && !dirty
      && !pending);

    promptShelfSection.setAttribute(
      "aria-busy",
      String(pending || promptShelf.readRequests.size > 0),
    );
    promptShelfText.readOnly = pending;
    promptShelfCount.textContent = promptShelfFormatNumber(promptShelf.items.length);
    promptShelfNew.disabled = !promptShelf.loaded || pending
      || !promptShelf.persistenceAvailable || promptShelf.items.length >= 50;
    promptShelfSave.disabled = !promptShelf.loaded || promptShelf.conflict || pending
      || !promptShelf.persistenceAvailable || !textValid || !dirty;
    promptShelfSave.textContent = selected ? t("promptShelfSaveChanges") : t("promptShelfSave");
    promptShelfCancel.disabled = !promptShelf.loaded || pending || (!dirty && !selected);
    promptShelfMoveUp.disabled = !promptShelf.loaded || pending || searching
      || !promptShelf.persistenceAvailable || !selected
      || promptShelf.items.indexOf(selected) <= 0;
    promptShelfMoveDown.disabled = !promptShelf.loaded || pending || searching
      || !promptShelf.persistenceAvailable || !selected
      || promptShelf.items.indexOf(selected) >= promptShelf.items.length - 1;
    promptShelfDelete.disabled = !promptShelf.loaded || pending
      || !promptShelf.persistenceAvailable || !selected;
    promptShelfInsert.disabled = !insertionReady;
    promptShelfRefresh.hidden = !promptShelf.readFailed && !promptShelf.readRetrying;
    const insertionPending = promptShelf.pending?.action === "insert";
    promptShelfRetryAction.hidden = !promptShelf.pending?.recoveryVisible || insertionPending;
    promptShelfRetryAction.setAttribute(
      "aria-disabled",
      String(Boolean(
        insertionPending
        || (promptShelf.pending?.recoveryVisible && !promptShelf.pending?.stalled),
      )),
    );
    promptShelfConfirmChecked.hidden = promptShelf.insertState !== "uncertain";
    promptShelfConfirmChecked.disabled = pending || promptShelf.insertState !== "uncertain";
    let insertHelpKey = "promptShelfInsertHelp";
    if (!state.enabled) insertHelpKey = "promptShelfInsertUnavailable";
    else if (!promptShelf.insertionAvailable) insertHelpKey = "promptShelfStatusInsertUnavailable";
    else if (promptShelf.insertState === "uncertain") {
      insertHelpKey = "promptShelfStatusInsertUncertain";
    } else if (promptShelf.insertState === "busy") {
      insertHelpKey = "promptShelfStatusInsertBusy";
    } else if (dirty) {
      insertHelpKey = "promptShelfStatusFinishEditing";
    }
    promptShelfInsertHelp.textContent = t(insertHelpKey);

    promptShelfEditorTitle.textContent = selected
      ? promptShelfFormat("promptShelfEditorSelectedTitle",
        promptShelf.items.indexOf(selected) + 1)
      : t("promptShelfEditorNewTitle");
    const characterCount = promptShelfFormatNumber(promptShelfText.value.length);
    const characterLimit = promptShelfFormatNumber(8000);
    promptShelfCharacterCount.textContent = `${characterCount} / ${characterLimit}`;
    promptShelfCharacterCount.setAttribute(
      "aria-label",
      promptShelfFormat("promptShelfCharacterCountLabel", characterCount, characterLimit),
    );
    promptShelfStatus.textContent = t(promptShelf.statusKey);
    promptShelfStatus.dataset.tone = promptShelf.statusTone;

    const query = promptShelfFold(promptShelfSearch.value.trim());
    const filtered = promptShelf.items.filter((item) => (
      !query || promptShelfFold(item.text).includes(query)
    ));
    promptShelfList.replaceChildren();
    for (const item of filtered) {
      const itemIndex = promptShelf.items.indexOf(item);
      const node = promptShelfItemTemplate.content.firstElementChild.cloneNode(true);
      const button = node.querySelector(".prompt-shelf-item-button");
      const display = promptShelfDisplay(item.text);
      node.classList.toggle("is-selected", item.id === promptShelf.selectedId);
      button.dataset.promptShelfId = item.id;
      button.setAttribute("aria-current", item.id === promptShelf.selectedId ? "true" : "false");
      node.querySelector(".prompt-shelf-item-order").textContent = String(itemIndex + 1).padStart(2, "0");
      node.querySelector(".prompt-shelf-item-title").textContent = display.title;
      const preview = node.querySelector(".prompt-shelf-item-preview");
      preview.textContent = display.preview;
      preview.hidden = !display.preview;
      promptShelfList.append(node);
    }
    promptShelfEmpty.hidden = promptShelf.items.length > 0;
    promptShelfNoResults.hidden = promptShelf.items.length === 0 || filtered.length > 0;
  };

  const requestPromptShelfState = () => {
    if (!bridge || promptShelf.readRequests.size > 0) return false;
    const requestId = newPromptShelfRequestId();
    if (!requestId) {
      setPromptShelfStatus("promptShelfStatusActionFailed", "error");
      return false;
    }
    promptShelf.readRequests.add(requestId);
    promptShelf.readFailed = false;
    promptShelf.statusKey = "promptShelfStatusLoading";
    promptShelf.statusTone = "busy";
    if (!send({ type: "prompt-shelf-read", version: promptShelfBridgeVersion, requestId })) {
      promptShelf.readRequests.delete(requestId);
      promptShelf.readFailed = true;
      setPromptShelfStatus("promptShelfStatusDisconnected", "error");
      return false;
    }
    promptShelf.readTimer = window.setTimeout(() => {
      if (!promptShelf.readRequests.delete(requestId)) return;
      promptShelf.readTimer = null;
      promptShelf.readFailed = true;
      setPromptShelfStatus("statusWelcomeRetry", "error");
    }, 5000);
    renderPromptShelf();
    return true;
  };

  const sendPromptShelfAction = (type, action, fields = {}) => {
    if (promptShelf.pending || !promptShelfUuidPattern.test(promptShelf.session ?? "")) return false;
    const requestId = newPromptShelfRequestId();
    if (!requestId) {
      setPromptShelfStatus("promptShelfStatusActionFailed", "error");
      return false;
    }
    const message = {
      type,
      version: promptShelfBridgeVersion,
      requestId,
      session: promptShelf.session,
      revision: promptShelf.revision,
      commandEpoch: promptShelf.commandEpoch,
      ...fields,
    };
    if (!send(message)) {
      setPromptShelfStatus("promptShelfStatusDisconnected", "error");
      return false;
    }
    promptShelf.pending = {
      requestId,
      type,
      action,
      message: Object.freeze({ ...message }),
      stalled: false,
      recoveryVisible: false,
    };
    setPromptShelfStatus(
      action === "insert" ? "promptShelfStatusInserting" : "promptShelfStatusSaving",
      "busy",
    );
    promptShelf.pendingTimer = window.setTimeout(() => {
      if (promptShelf.pending?.requestId !== requestId) return;
      promptShelf.pending.stalled = true;
      promptShelf.pending.recoveryVisible = action !== "insert";
      setPromptShelfStatus(
        action === "insert" ? "promptShelfStatusInsertDelayed" : "promptShelfStatusUnknown",
        action === "insert" ? "busy" : "error",
      );
    }, 10000);
    renderPromptShelf();
    return true;
  };

  const selectPromptShelfItem = (id, { focusEditor = false } = {}) => {
    const item = promptShelf.items.find((candidate) => candidate.id === id);
    if (!item || promptShelf.pending) return false;
    if (promptShelfIsDirty()) {
      if (promptShelf.selectedId === id) {
        if (focusEditor) promptShelfText.focus();
        return true;
      }
      announcePromptShelfStatus("promptShelfStatusFinishEditing", "error");
      return false;
    }
    promptShelf.selectedId = item.id;
    promptShelf.baseline = item.text;
    promptShelfText.value = item.text;
    promptShelf.conflict = false;
    setPromptShelfStatus("promptShelfStatusReady");
    if (focusEditor) promptShelfText.focus();
    return true;
  };

  const beginNewPromptShelfDraft = ({ focusEditor = true } = {}) => {
    if (promptShelf.pending) return false;
    if (promptShelfIsDirty()) {
      setPromptShelfStatus("promptShelfStatusFinishEditing", "error");
      return false;
    }
    promptShelf.selectedId = null;
    promptShelf.baseline = "";
    promptShelfText.value = "";
    promptShelf.conflict = false;
    setPromptShelfStatus("promptShelfStatusReady");
    if (focusEditor) promptShelfText.focus();
    return true;
  };

  const receivePromptShelfState = (data) => {
    if (!data || typeof data !== "object" || Array.isArray(data)
        || !promptShelfHasExactKeys(data, [
          "type", "version", "requestId", "session", "revision", "commandEpoch",
          "persistenceAvailable", "insertionAvailable", "insertState", "items",
        ])
        || data.version !== promptShelfBridgeVersion
        || !promptShelf.readRequests.has(data.requestId)
        || !promptShelfUuidPattern.test(data.session)
        || !Number.isSafeInteger(data.revision) || data.revision < 0
        || !Number.isSafeInteger(data.commandEpoch) || data.commandEpoch < 0
        || typeof data.persistenceAvailable !== "boolean"
        || typeof data.insertionAvailable !== "boolean"
        || !["idle", "busy", "uncertain"].includes(data.insertState)
        || !Array.isArray(data.items) || data.items.length > 50) return false;
    const ids = new Set();
    const items = [];
    for (const item of data.items) {
      if (!item || typeof item !== "object" || Array.isArray(item)
          || Object.keys(item).length !== 2
          || !promptShelfIdPattern.test(item.id)
          || ids.has(item.id)
          || !promptShelfTextIsValid(item.text)) return false;
      ids.add(item.id);
      items.push(Object.freeze({ id: item.id, text: item.text }));
    }

    clearPromptShelfReads();
    const priorDraft = promptShelfText.value;
    const wasDirty = promptShelfIsDirty();
    const priorSelectedId = promptShelf.selectedId;
    const priorRevision = promptShelf.revision;
    const hadLoaded = promptShelf.loaded;
    const incomingConflict = hadLoaded && wasDirty && data.revision !== priorRevision;
    promptShelf.session = data.session;
    promptShelf.revision = data.revision;
    promptShelf.commandEpoch = data.commandEpoch;
    promptShelf.items = items;
    promptShelf.loaded = true;
    promptShelf.readFailed = false;
    promptShelf.readRetrying = false;
    promptShelf.conflict = promptShelf.conflict || incomingConflict;
    promptShelf.persistenceAvailable = data.persistenceAvailable;
    promptShelf.insertionAvailable = data.insertionAvailable;
    promptShelf.insertState = data.insertState;

    const selected = items.find((item) => item.id === priorSelectedId) ?? null;
    if (selected) {
      promptShelf.selectedId = selected.id;
      promptShelf.baseline = selected.text;
      promptShelfText.value = wasDirty ? priorDraft : selected.text;
    } else if (wasDirty) {
      promptShelf.selectedId = null;
      promptShelf.baseline = "";
      promptShelfText.value = priorDraft;
    } else {
      promptShelf.selectedId = null;
      promptShelf.baseline = "";
      promptShelfText.value = "";
    }
    if (!data.persistenceAvailable) {
      promptShelf.statusKey = "promptShelfStatusStorageUnavailable";
      promptShelf.statusTone = "error";
    } else if (promptShelf.conflict) {
      promptShelf.statusKey = "promptShelfStatusStale";
      promptShelf.statusTone = "error";
    } else if (data.insertState === "uncertain") {
      promptShelf.statusKey = "promptShelfStatusInsertUncertain";
      promptShelf.statusTone = "error";
    } else if (data.insertState === "busy") {
      promptShelf.statusKey = "promptShelfStatusInsertBusy";
      promptShelf.statusTone = "busy";
    } else if (promptShelf.statusKey === "promptShelfStatusLoading") {
      promptShelf.statusKey = "promptShelfStatusReady";
      promptShelf.statusTone = "ok";
    } else if ([
      "promptShelfStatusInsertBusy",
      "promptShelfStatusInsertDelayed",
      "promptShelfStatusInsertUncertain",
    ].includes(promptShelf.statusKey) && !promptShelf.pending) {
      promptShelf.statusKey = "promptShelfStatusReady";
      promptShelf.statusTone = "ok";
    }
    renderPromptShelf();
    const focusTarget = promptShelf.focusAfterRefresh;
    promptShelf.focusAfterRefresh = null;
    if (focusTarget && window.location.hash === "#prompt-shelf") {
      requestAnimationFrame(() => {
        if (focusTarget.kind === "new") promptShelfNew.focus();
        else if (focusTarget.kind === "editor") promptShelfText.focus();
        else if (focusTarget.kind === "confirm" && !promptShelfConfirmChecked.hidden) {
          promptShelfConfirmChecked.focus();
        } else if (focusTarget.kind === "item" && promptShelfIdPattern.test(focusTarget.id ?? "")) {
          const itemTarget = promptShelfList.querySelector(
            `[data-prompt-shelf-id="${focusTarget.id}"]`,
          );
          if (itemTarget) itemTarget.focus();
          else if (promptShelfIsDirty() || promptShelfNew.disabled) promptShelfText.focus();
          else promptShelfNew.focus();
        }
      });
    }
    return true;
  };

  const receivePromptShelfResult = (data) => {
    if (!data || typeof data !== "object" || Array.isArray(data)
        || !promptShelfHasExactKeys(data, [
          "type", "version", "requestId", "session", "action",
          "ok", "code", "revision", "commandEpoch", "itemId",
        ])
        || data.version !== promptShelfBridgeVersion
        || !promptShelf.pending
        || data.requestId !== promptShelf.pending.requestId
        || data.session !== promptShelf.session
        || data.action !== promptShelf.pending.action
        || typeof data.ok !== "boolean"
        || typeof data.code !== "string"
        || !Number.isSafeInteger(data.revision) || data.revision < 0
        || !Number.isSafeInteger(data.commandEpoch) || data.commandEpoch < 0
        || typeof data.itemId !== "string"
        || (data.itemId && !promptShelfIdPattern.test(data.itemId))) return false;

    if (data.code === "delayed" && data.action === "insert") {
      promptShelf.insertState = "busy";
      setPromptShelfStatus("promptShelfStatusInsertDelayed", "busy");
      return true;
    }

    const action = promptShelf.pending.action;
    clearPromptShelfPending();
    promptShelf.revision = data.revision;
    promptShelf.commandEpoch = data.commandEpoch;
    if (data.ok) {
      if (action === "create" && data.itemId) promptShelf.selectedId = data.itemId;
      if (action === "create" || action === "update") {
        promptShelf.baseline = promptShelfText.value;
        promptShelf.conflict = false;
      }
      if (action === "delete" && data.itemId === promptShelf.selectedId) {
        promptShelf.selectedId = null;
        promptShelf.baseline = "";
        promptShelfText.value = "";
      }
      if (action === "confirm") promptShelf.insertState = "idle";
      const successKeys = {
        create: "promptShelfStatusCreated",
        update: "promptShelfStatusUpdated",
        move: "promptShelfStatusMoved",
        delete: "promptShelfStatusDeleted",
        insert: "promptShelfStatusInserted",
        confirm: "promptShelfStatusChecked",
      };
      setPromptShelfStatus(successKeys[action] ?? "promptShelfStatusReady");
    } else {
      const errorKeys = {
        stale: "promptShelfStatusStale",
        "request-conflict": "promptShelfStatusUnknown",
        "not-found": "promptShelfStatusNotFound",
        "invalid-text": "promptShelfStatusInvalidText",
        capacity: "promptShelfStatusFull",
        "storage-unavailable": "promptShelfStatusStorageUnavailable",
        "write-failed": "promptShelfStatusActionFailed",
        "runtime-unavailable": "promptShelfStatusInsertUnavailable",
        busy: "promptShelfStatusInsertBusy",
        "not-inserted": "promptShelfStatusInsertFailed",
        uncertain: "promptShelfStatusInsertUncertain",
      };
      if (data.code === "uncertain") promptShelf.insertState = "uncertain";
      if (data.code === "stale" && promptShelfIsDirty()) promptShelf.conflict = true;
      setPromptShelfStatus(errorKeys[data.code] ?? "promptShelfStatusActionFailed", "error");
    }
    promptShelf.focusAfterRefresh = action === "delete" && data.ok
      ? { kind: "new" }
      : action === "create" || action === "update"
        ? { kind: "editor" }
        : action === "insert" && data.code === "uncertain"
          ? { kind: "confirm" }
          : data.itemId
            ? { kind: "item", id: data.itemId }
            : { kind: "editor" };
    requestPromptShelfState();
    return true;
  };

  const getThemeCardPreview = (themeId) => {
    if (typeof themeId !== "string" || themeId.length > 40 || !hostThemeIdPattern.test(themeId)
        || !Object.hasOwn(themes, themeId)) return null;
    const theme = themes[themeId];
    const imageUrl = theme && theme.name === themeId
      ? studioPreviewUrl(theme.studioPreview, theme)
      : null;
    if (!imageUrl) return null;
    const localizedLabel = localized(theme.labels, theme.label);
    const label = hostText(localizedLabel, 120) ?? hostText(theme.label, 120) ?? themeId;
    const defaultCrop = Object.freeze({ ...defaultCropForTheme(themeId) });
    const crop = Object.freeze({ ...cropForTheme(themeId) });
    return Object.freeze({ themeId, imageUrl, crop, defaultCrop, label });
  };
  // This callback is handed to the editor before openCropEditor is initialized.
  // createController stores it and only invokes it in response to a later user action.
  const openThemeCardPreview = (themeId, opener) => {
    const preview = getThemeCardPreview(themeId);
    if (!preview || cropDialog.open) return false;
    openCropEditor({
      kind: "card",
      theme: preview.themeId,
      imageUrl: preview.imageUrl,
      crop: preview.crop,
      defaultCrop: preview.defaultCrop,
    }, opener);
    return true;
  };
  window.CLAUDE_AURA_STUDIO_MESSAGE_TYPES = STUDIO_PAGE_MESSAGE_TYPES;
  editorController = window.CLAUDE_AURA_EDITOR?.createController({
    locale,
    send,
    setStatus,
    translate: t,
    focusThemeCard,
    getThemeCardPreview,
    openThemeCardPreview,
    hasPersonalWordmark: () => state.hasPersonalWordmark,
    onOrdinaryViewRestore: (view) => activateStudioView(view, {
      updateHistory: false,
      focusPage: false,
      restoreScroll: false,
    }),
    onStudioStyleChange: (style, themeId, launcherStyle, launcherUrl) => {
      editorStudioStyle = style;
      editorStudioThemeId = style ? themeId : null;
      editorLauncherStyle = style ? normalizeLauncherMaterial(launcherStyle) : null;
      editorLauncherMarkUrl = style ? normalizeEditorLauncherMarkUrl(launcherUrl) : null;
      applyStudioStyle();
    },
  }) ?? null;

  const openWelcome = ({ automatic = false, opener = null } = {}) => {
    if (welcomeDialog.open || editorController?.isActive?.()) return false;
    introductionIsAutomatic = automatic;
    welcomeReturnFocus = opener ?? document.querySelector('.rail-item[href="#themes"]');
    welcomeStatus.textContent = "";
    welcomeStatus.removeAttribute("data-tone");
    welcomeDialog.showModal();
    requestAnimationFrame(() => {
      const selected = welcomeLanguage.querySelector(`input[value="${state.locale}"]`);
      (selected ?? welcomeDialog.querySelector("input, button"))?.focus();
    });
    return true;
  };

  const restoreIntroductionFocus = () => {
    const target = introductionCompletionFocus;
    introductionCompletionFocus = null;
    if (target?.isConnected) requestAnimationFrame(() => target.focus());
  };

  const requestWelcomeDestination = (destination) => {
    if (!introductionIsAutomatic || state.introductionPending !== true) {
      welcomeDialog.close(destination);
      return;
    }
    if (localePending || introductionCompletionWaiting) return;
    introductionCompletionDestination = destination;
    introductionCompletionWaiting = true;
    introductionCompletionFocus = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : welcomeLater;
    welcomeStatus.textContent = t("statusWelcomeBusy");
    welcomeStatus.removeAttribute("data-tone");
    setStatus(t("statusWelcomeBusy"), "busy");
    reflect();
    if (!send({ type: "complete-studio-introduction" })) {
      introductionCompletionWaiting = false;
      welcomeStatus.textContent = t("statusWelcomeRetry");
      welcomeStatus.dataset.tone = "error";
      reflect();
      restoreIntroductionFocus();
      return;
    }
    window.clearTimeout(introductionCompletionTimer);
    introductionCompletionTimer = window.setTimeout(() => {
      if (!introductionCompletionWaiting || !welcomeDialog.open) return;
      introductionCompletionWaiting = false;
      setStatus(t("statusWelcomeRetry"), "error");
      welcomeStatus.textContent = t("statusWelcomeRetry");
      welcomeStatus.dataset.tone = "error";
      reflect();
      send({ type: "get-state" });
      restoreIntroductionFocus();
    }, 4000);
  };

  const maybeOfferIntroduction = () => {
    if (!state.connected || state.introductionPending !== true || state.introductionRequested !== true
        || introductionOffered
        || editorController?.isActive?.()) return;
    introductionOffered = true;
    openWelcome({
      automatic: true,
      opener: document.querySelector('.rail-item[href="#themes"]'),
    });
  };

  welcomeDialog.addEventListener("close", () => {
    const destination = welcomeDialog.returnValue;
    introductionIsAutomatic = false;
    introductionCompletionDestination = null;
    introductionCompletionWaiting = false;
    window.clearTimeout(introductionCompletionTimer);
    introductionCompletionTimer = null;
    introductionCompletionFocus = null;
    const returnFocus = welcomeReturnFocus;
    welcomeReturnFocus = null;
    if (destination === "try-theme") {
      const themesLink = document.querySelector('.rail-item[href="#themes"]');
      themesLink?.click();
      requestAnimationFrame(() => themeCardInput(state.theme)?.focus());
    } else {
      returnFocus?.focus();
    }
  });
  welcomeDialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    requestWelcomeDestination("later");
  });
  openWelcomeButton.addEventListener("click", () => openWelcome({ opener: openWelcomeButton }));
  welcomeClose.addEventListener("click", () => requestWelcomeDestination("later"));
  welcomeLater.addEventListener("click", () => requestWelcomeDestination("later"));
  welcomeTryTheme.addEventListener("click", () => requestWelcomeDestination("try-theme"));

  if (bridge) {
    bridge.addEventListener("message", (event) => {
      const data = event.data ?? {};
      if (data.type === "prompt-shelf-state") {
        receivePromptShelfState(data);
        return;
      }
      if (data.type === "prompt-shelf-result") {
        receivePromptShelfResult(data);
        return;
      }
      if (data.type === "prompt-shelf-changed") {
        if (promptShelfHasExactKeys(data, [
          "type", "version", "session", "revision", "commandEpoch",
        ])
            && data.version === promptShelfBridgeVersion
            && data.session === promptShelf.session
            && Number.isSafeInteger(data.revision) && data.revision >= 0
            && Number.isSafeInteger(data.commandEpoch) && data.commandEpoch >= 0
            && !promptShelf.pending) {
          // A body-free invalidation supersedes any in-flight snapshot. Drop
          // its correlation and ask explicitly for one current replacement.
          clearPromptShelfReads();
          requestPromptShelfState();
        }
        return;
      }
      if (data.type === "aura-mirror") {
        if (editorController?.isActive?.()) editorController.receiveMirror?.(data);
        return;
      }
      if (data.type === "state") {
        state.connected = true;
        const promptShelfRuntimeChanged = typeof data.enabled === "boolean"
          && state.enabled !== data.enabled;
        const builtInAuthoringChanged = state.builtInAuthoring !== (data.builtInAuthoring === true);
        state.builtInAuthoring = data.builtInAuthoring === true;
        if (studioRoot) {
          studioRoot.dataset.builtInAuthoring = String(state.builtInAuthoring);
        }
        if (builtInAuthoringBanner) {
          builtInAuthoringBanner.hidden = !state.builtInAuthoring;
        }
        let appearanceAcknowledged = false;
        let introductionAcknowledged = false;
        if (typeof data.locale === "string" && supportedLocales.has(data.locale)) {
          state.locale = data.locale;
          localePending = null;
        }
        if (typeof data.introductionPending === "boolean") {
          state.introductionPending = data.introductionPending;
          introductionAcknowledged = Boolean(
            introductionCompletionDestination && data.introductionPending === false);
          if (introductionCompletionDestination && data.introductionPending === true
              && data.tone === "error") {
            introductionCompletionWaiting = false;
            window.clearTimeout(introductionCompletionTimer);
            introductionCompletionTimer = null;
            welcomeStatus.textContent = t("statusWelcomeRetry");
            welcomeStatus.dataset.tone = "error";
            restoreIntroductionFocus();
          }
        }
        if (typeof data.introductionRequested === "boolean") {
          state.introductionRequested = data.introductionRequested;
        }
        if (Object.hasOwn(data, "themes")) syncHostThemes(data.themes);
        if (builtInAuthoringChanged) syncBuiltInAuthoringCards();
        if (typeof data.appearance === "string" && appearanceModes.has(data.appearance)) {
          state.appearance = data.appearance;
          appearanceAcknowledged = appearancePending;
          appearancePending = false;
        }
        if (typeof data.theme === "string" && hostThemeIdPattern.test(data.theme)
            && Object.hasOwn(themes, data.theme)) state.theme = data.theme;
        if (typeof data.enabled === "boolean") state.enabled = data.enabled;
        if (typeof data.hasImage === "boolean") state.hasImage = data.hasImage;
        if (typeof data.hasAvatar === "boolean") state.hasAvatar = data.hasAvatar;
        state.avatarPreviewUrl = avatarPreviewUrl(data.avatarPreviewUrl);
        state.avatarCrop = normalizeCrop(data.avatarCrop);
        state.avatarBackground = normalizeAvatarBackground(data.avatarBackground);
        if (typeof data.avatarHasAlpha === "boolean") state.avatarHasAlpha = data.avatarHasAlpha;
        const priorWordmarkSession = state.personalWordmarkSession;
        if (typeof data.personalWordmarkSession === "string"
            && promptShelfUuidPattern.test(data.personalWordmarkSession)) {
          state.personalWordmarkSession = data.personalWordmarkSession;
        }
        if (Number.isSafeInteger(data.personalWordmarkRevision)
            && data.personalWordmarkRevision >= 0) {
          state.personalWordmarkRevision = data.personalWordmarkRevision;
        }
        if (typeof data.hasPersonalWordmark === "boolean") {
          state.hasPersonalWordmark = data.hasPersonalWordmark;
        }
        state.personalWordmarkPreviewUrl = personalWordmarkPreviewUrl(
          data.personalWordmarkPreviewUrl,
        );
        state.personalWordmarkCrop = normalizeCrop(data.personalWordmarkCrop);
        state.personalWordmarkUnavailable = data.personalWordmarkUnavailable === true;
        if (priorWordmarkSession && state.personalWordmarkSession !== priorWordmarkSession) {
          clearPendingWordmarkAction();
          if (pendingCropSave?.kind === "wordmark") {
            clearPendingCropSave();
            setCropBusy(false);
            setCropError(t("saveFailed"));
          }
        }
        state.effectiveIdentity = normalizeEffectiveIdentity(data.effectiveIdentity);
        state.imagePreviewUrl = backgroundPreviewUrl(data.imagePreviewUrl);
        state.backgroundAspectRatio = normalizeAspectRatio(data.backgroundAspectRatio);
        state.backgroundCrop = normalizeCrop(data.backgroundCrop);
        state.backgroundCropSupported = data.backgroundCrop?.supported !== false;
        const incomingCrops = Object.create(null);
        if (data.studioPreviewCrops && typeof data.studioPreviewCrops === "object" && !Array.isArray(data.studioPreviewCrops)) {
          for (const [themeId, crop] of Object.entries(data.studioPreviewCrops)) {
            if (Object.hasOwn(themes, themeId) && studioPreviewUrl(themes[themeId].studioPreview, themes[themeId])) {
              incomingCrops[themeId] = normalizeCrop(
                crop, defaultCropForTheme(themeId), CARD_PREVIEW_MAX_ZOOM);
            }
          }
        }
        state.studioPreviewCrops = incomingCrops;
        const terminalThemeExportAcknowledged = terminalThemeExportPending
          && data.action === "export-terminal-themes"
          && typeof data.actionSucceeded === "boolean";
        if (terminalThemeExportAcknowledged) {
          setTerminalThemeExportPending(false);
          if (data.actionSucceeded && data.tone !== "error") {
            setStatus(t("terminalThemesExported"));
          } else if (data.tone === "error") {
            setStatus(t("terminalThemesExportFailed"), "error");
          } else {
            setStatus(t("statusReady"));
          }
        } else if (typeof data.status === "string") setStatus(data.status, data.tone ?? "ok");
        else if (appearanceAcknowledged) setStatus(t("statusReady"));
        if (Object.hasOwn(data, "editor")) editorController?.receive(data.editor, state.appearance);
        if (cropContext?.kind === "background") {
          cropStage.style.setProperty("--crop-aspect-ratio", String(state.backgroundAspectRatio));
          syncCropEditor();
        }
        let openChosenWordmark = false;
        let chosenWordmarkOpener = null;
        if (pendingWordmarkAction
            && data.action === pendingWordmarkAction.type
            && data.requestId === pendingWordmarkAction.requestId
            && typeof data.actionSucceeded === "boolean") {
          const pending = pendingWordmarkAction;
          clearPendingWordmarkAction();
          chosenWordmarkOpener = pending.opener;
          openChosenWordmark = Boolean(
            data.actionSucceeded
            && data.tone !== "error"
            && pending.type === "set-personal-wordmark"
            && pending.operation === "choose"
            && state.personalWordmarkPreviewUrl,
          );
        }
        if (pendingCropSave
            && data.action === pendingCropSave.action
            && (pendingCropSave.kind !== "wordmark"
              || data.requestId === pendingCropSave.requestId)
            && typeof data.actionSucceeded === "boolean") {
          const pending = pendingCropSave;
          const persisted = pending.kind === "card"
            ? state.studioPreviewCrops[pending.theme]
            : pending.kind === "avatar"
              ? state.avatarCrop
              : pending.kind === "wordmark"
                ? state.personalWordmarkCrop
                : state.backgroundCrop;
          clearPendingCropSave();
          const backdropSettled = pending.kind !== "avatar"
            || state.avatarBackground === pending.background;
          if (data.actionSucceeded && data.tone !== "error"
              && cropsEqual(persisted, pending.crop) && backdropSettled) {
            reflect();
            cropDialog.close("saved");
            return;
          }
          setCropBusy(false);
          setCropError(t("saveFailed"));
        }
        reflect();
        if (openChosenWordmark && !cropDialog.open) {
          openPersonalWordmarkCrop(
            chosenWordmarkOpener ?? personalWordmarkControls[0]?.pick,
            { staged: true },
          );
        }
        if (promptShelfRuntimeChanged && promptShelf.loaded
            && !promptShelf.pending && promptShelf.readRequests.size === 0) {
          requestPromptShelfState();
        }
        // Picking an avatar opens the framing editor at once, so the crop is
        // positioned before it settles — mirroring the theme-card preview flow.
        if (data.action === "set-avatar" && data.actionSucceeded && data.tone !== "error"
            && state.hasAvatar && state.avatarPreviewUrl && !cropDialog.open) {
          openAvatarCrop(document.getElementById("pick-avatar"));
        }
        if (introductionAcknowledged && welcomeDialog.open) {
          const destination = introductionCompletionDestination;
          introductionCompletionDestination = null;
          introductionCompletionWaiting = false;
          window.clearTimeout(introductionCompletionTimer);
          introductionCompletionTimer = null;
          introductionCompletionFocus = null;
          reflect();
          welcomeDialog.close(destination);
        }
        if (manualWelcomeResumePending && !welcomeDialog.open && !editorController?.isActive?.()) {
          manualWelcomeResumePending = false;
          openWelcome({ opener: openWelcomeButton });
        }
        maybeOfferIntroduction();
      }
    });
  } else {
    setStatus(t("statusDemo"), "busy");
  }

  promptShelfSearch.addEventListener("input", renderPromptShelf);
  promptShelfText.addEventListener("input", renderPromptShelf);
  promptShelfNew.addEventListener("click", () => beginNewPromptShelfDraft());
  promptShelfList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-prompt-shelf-id]");
    if (button) selectPromptShelfItem(button.dataset.promptShelfId, { focusEditor: true });
  });
  promptShelfList.addEventListener("keydown", (event) => {
    if (!["ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) return;
    const buttons = [...promptShelfList.querySelectorAll("[data-prompt-shelf-id]")];
    if (!buttons.length) return;
    const current = buttons.indexOf(event.target.closest("[data-prompt-shelf-id]"));
    let next = current;
    if (event.key === "ArrowUp") next = Math.max(0, current - 1);
    if (event.key === "ArrowDown") next = Math.min(buttons.length - 1, current + 1);
    if (event.key === "Home") next = 0;
    if (event.key === "End") next = buttons.length - 1;
    const button = buttons[next];
    if (!button) return;
    event.preventDefault();
    const id = button.dataset.promptShelfId;
    if (selectPromptShelfItem(id)) {
      promptShelfList.querySelector(`[data-prompt-shelf-id="${id}"]`)?.focus();
    }
  });
  promptShelfSave.addEventListener("click", () => {
    const text = promptShelfText.value;
    if (!promptShelfTextIsValid(text)) {
      setPromptShelfStatus(
        text.trim() ? "promptShelfStatusInvalidText" : "promptShelfStatusBlank",
        "error",
      );
      return;
    }
    const selected = selectedPromptShelfItem();
    if (selected) {
      sendPromptShelfAction(
        "prompt-shelf-update",
        "update",
        { id: selected.id, text },
      );
    } else {
      sendPromptShelfAction("prompt-shelf-create", "create", { text });
    }
  });
  promptShelfCancel.addEventListener("click", () => {
    const selected = selectedPromptShelfItem();
    promptShelf.baseline = selected?.text ?? "";
    promptShelfText.value = selected?.text ?? "";
    promptShelf.conflict = false;
    setPromptShelfStatus("promptShelfStatusReady");
    promptShelfText.focus();
  });
  promptShelfMoveUp.addEventListener("click", () => {
    const selected = selectedPromptShelfItem();
    if (selected) {
      sendPromptShelfAction(
        "prompt-shelf-move",
        "move",
        { id: selected.id, direction: "up" },
      );
    }
  });
  promptShelfMoveDown.addEventListener("click", () => {
    const selected = selectedPromptShelfItem();
    if (selected) {
      sendPromptShelfAction(
        "prompt-shelf-move",
        "move",
        { id: selected.id, direction: "down" },
      );
    }
  });
  promptShelfDelete.addEventListener("click", () => {
    const selected = selectedPromptShelfItem();
    if (!selected || promptShelf.pending) return;
    promptShelfDeleteDialog.dataset.itemId = selected.id;
    promptShelfDeleteDialog.showModal();
    requestAnimationFrame(() => promptShelfDeleteCancel.focus());
  });
  promptShelfDeleteConfirm.addEventListener("click", () => {
    const id = promptShelfDeleteDialog.dataset.itemId;
    if (!promptShelfIdPattern.test(id ?? "")) return;
    promptShelfDeleteDialog.close("delete");
    sendPromptShelfAction("prompt-shelf-delete", "delete", { id });
  });
  promptShelfDeleteDialog.addEventListener("close", () => {
    delete promptShelfDeleteDialog.dataset.itemId;
    if (promptShelfDeleteDialog.returnValue !== "delete" && !promptShelfDelete.disabled) {
      promptShelfDelete.focus();
    }
  });
  promptShelfInsert.addEventListener("click", () => {
    const selected = selectedPromptShelfItem();
    if (selected) {
      sendPromptShelfAction("prompt-shelf-insert", "insert", { id: selected.id });
    }
  });
  promptShelfConfirmChecked.addEventListener("click", () => {
    sendPromptShelfAction("prompt-shelf-confirm-checked", "confirm");
  });
  promptShelfRefresh.addEventListener("click", () => {
    promptShelf.readRetrying = true;
    const selected = selectedPromptShelfItem();
    promptShelf.focusAfterRefresh = selected
      ? { kind: "item", id: selected.id }
      : { kind: "new" };
    requestPromptShelfState();
  });
  promptShelfRetryAction.addEventListener("click", () => {
    const pending = promptShelf.pending;
    if (!pending?.stalled || !pending.message || pending.action === "insert") return;
    if (!send(pending.message)) {
      setPromptShelfStatus("promptShelfStatusDisconnected", "error");
      return;
    }
    pending.stalled = false;
    pending.recoveryVisible = true;
    setPromptShelfStatus(
      pending.action === "insert" ? "promptShelfStatusInserting" : "promptShelfStatusSaving",
      "busy",
    );
    window.clearTimeout(promptShelf.pendingTimer);
    promptShelf.pendingTimer = window.setTimeout(() => {
      if (promptShelf.pending?.requestId !== pending.requestId) return;
      promptShelf.pending.stalled = true;
      promptShelf.pending.recoveryVisible = true;
      setPromptShelfStatus("promptShelfStatusUnknown", "error");
    }, 10000);
  });
  const ensurePromptShelfState = () => {
    if (bridge && !promptShelf.loaded && !promptShelf.pending
        && promptShelf.readRequests.size === 0) {
      requestPromptShelfState();
    }
  };
  promptShelfSection.addEventListener("focusin", ensurePromptShelfState);
  document.querySelector('.rail-item[href="#prompt-shelf"]')?.addEventListener("click", () => {
    if (promptShelf.loaded && !promptShelf.pending && promptShelf.readRequests.size === 0) {
      requestPromptShelfState();
    } else {
      ensurePromptShelfState();
    }
  });
  const promptShelfRequestedAtLaunch = requestedViewHash === "#prompt-shelf"
    || window.location.hash === "#prompt-shelf";
  if (!bridge) setPromptShelfStatus("promptShelfStatusDisconnected", "error");
  else if (promptShelfRequestedAtLaunch) requestPromptShelfState();

  const handleStudioColorSchemeChange = () => {
    if (!state.enabled || state.appearance === "system") applyStudioStyle();
  };
  if (studioColorScheme?.addEventListener) studioColorScheme.addEventListener("change", handleStudioColorSchemeChange);
  else studioColorScheme?.addListener?.(handleStudioColorSchemeChange);
  // ── END HOST BRIDGE ─────────────────────────────────────────────────────

  for (const input of appearanceInputs) {
    input.addEventListener("change", () => {
      if (!input.checked || appearancePending || !state.enabled || !appearanceModes.has(input.value)) return;
      const previousAppearance = state.appearance;
      state.appearance = input.value;
      appearancePending = true;
      setStatus(t("statusAppearanceBusy"), "busy");
      reflect();
      if (!send({ type: "set-appearance", appearance: input.value })) {
        state.appearance = previousAppearance;
        appearancePending = false;
        reflect();
      }
    });
  }

  for (const input of localeInputs) {
    input.addEventListener("change", () => {
      if (!input.checked || localePending || !supportedLocales.has(input.value)
          || input.value === state.locale) return;
      if (welcomeDialog.open && !introductionIsAutomatic) {
        try { sessionStorage.setItem("claude-aura:resume-welcome", "true"); } catch {}
      }
      localePending = input.value;
      setStatus(t("statusLanguageBusy"), "busy");
      reflect();
      if (!send({ type: "set-locale", locale: input.value })) {
        localePending = null;
        reflect();
      }
    });
  }

  // Bundled themes render through the same DOM builder as host-installed themes
  // (createHostThemeCard) so card structure, preview/crop wiring, and per-source
  // actions have one source of truth instead of a parallel innerHTML template.
  for (const theme of Object.values(themes)) createHostThemeCard(theme);

  toggleEnabled.addEventListener("click", () => {
    state.enabled = !state.enabled;
    send({ type: "set-enabled", enabled: state.enabled });
    setStatus(state.enabled ? t("statusApplying") : t("statusOriginal"), state.enabled ? "busy" : "ok");
    reflect();
  });
  document.getElementById("pick-image").addEventListener("click", () => send({ type: "set-image" }));
  clearImage.addEventListener("click", () => send({ type: "clear-image" }));
  document.getElementById("pick-avatar")?.addEventListener("click", () => send({ type: "set-avatar" }));
  clearAvatar?.addEventListener("click", () => send({ type: "clear-avatar" }));
  for (const controls of personalWordmarkControls) {
    controls.pick.addEventListener("click", () => {
      sendPersonalWordmarkAction(
        "set-personal-wordmark",
        { operation: "choose" },
        controls.pick,
      );
    });
    controls.clear.addEventListener("click", () => {
      sendPersonalWordmarkAction("clear-personal-wordmark", {}, controls.clear);
    });
  }
  document.getElementById("open-aura").addEventListener("click", () => send({ type: "open-aura" }));
  document.getElementById("open-desktop").addEventListener("click", () => send({ type: "open-desktop" }));
  document.getElementById("start-theme").addEventListener("click", () => {
    setStatus(t("statusApplying"), "busy");
    send({ type: "create-theme-copy", theme: "default" });
  });
  document.getElementById("import-theme").addEventListener("click", () => send({ type: "import-theme" }));

  const syncCropEditor = () => {
    if (!cropContext) return;
    cropInputs.x.value = String(Math.round(cropContext.draft.x));
    cropInputs.y.value = String(Math.round(cropContext.draft.y));
    cropInputs.zoom.value = String(Math.round(cropContext.draft.zoom * 100));
    cropOutputs.x.value = `${Math.round(cropContext.draft.x)}%`;
    cropOutputs.y.value = `${Math.round(cropContext.draft.y)}%`;
    cropOutputs.zoom.value = `${Math.round(cropContext.draft.zoom * 100)}%`;
    layoutCropImage(cropStage, cropImage, cropContext.draft);
    layoutWordmarkSurfacePreviews();
  };

  const updateCropDraft = (patch) => {
    if (!cropContext) return;
    cropContext.draft = normalizeCrop(
      { ...cropContext.draft, ...patch }, cropContext.draft, cropContext.maximumZoom);
    syncCropEditor();
  };

  const openCropEditor = ({
    kind, theme = null, imageUrl, crop, defaultCrop = DEFAULT_CROP, positionSupported = true,
    background = "transparent", staged = false,
  }, opener) => {
    if (!imageUrl) { setStatus(t("previewUnavailable"), "error"); return; }
    cropReturnFocus = opener;
    const maximumZoom = kind === "card" ? CARD_PREVIEW_MAX_ZOOM : 2;
    const resetCrop = normalizeCrop(defaultCrop, DEFAULT_CROP, maximumZoom);
    cropContext = {
      kind,
      theme,
      maximumZoom,
      resetCrop,
      draft: normalizeCrop(crop, resetCrop, maximumZoom),
      background: normalizeAvatarBackground(background),
      staged: staged === true,
    };
    // Offer the backdrop swatches only where they change something: an avatar
    // whose source actually has see-through pixels.
    if (cropBackground) cropBackground.hidden = !(kind === "avatar" && state.avatarHasAlpha);
    syncAvatarBackdrop();
    cropInputs.zoom.max = String(maximumZoom * 100);
    cropStage.dataset.kind = kind;
    const aspectRatio = kind === "card"
      ? 3 / 2
      : kind === "avatar"
        ? 1
        : kind === "wordmark" ? 344 / 124 : state.backgroundAspectRatio;
    cropStage.style.setProperty("--crop-aspect-ratio", String(aspectRatio));
    const titleKey = kind === "card"
      ? "cardCropTitle"
      : kind === "avatar"
        ? "avatarCropTitle"
        : kind === "wordmark" ? "wordmarkCropTitle" : "backgroundCropTitle";
    const helpKey = kind === "card"
      ? "cardCropHelp"
      : kind === "avatar"
        ? "avatarCropHelp"
        : kind === "wordmark" ? "wordmarkCropHelp" : "backgroundCropHelp";
    cropTitle.textContent = t(titleKey);
    cropHelp.textContent = t(helpKey);
    setCropError();
    setCropNotice(kind === "background" && !positionSupported ? t("advancedPositionHelp") : "");
    wordmarkSurfacePreviews.hidden = kind !== "wordmark";
    setCropBusy(false);
    cropSave.disabled = true;
    const finishCropImageLoad = () => {
      setCropBusy(false);
      syncCropEditor();
    };
    cropImage.onload = finishCropImageLoad;
    cropImage.onerror = () => {
      cropSave.disabled = true;
      setCropError(t("previewUnavailable"));
      setStatus(t("previewUnavailable"), "error");
    };
    for (const image of wordmarkSurfaceImages) {
      image.onload = () => layoutWordmarkSurfacePreviews();
      image.onerror = () => image.removeAttribute("src");
      if (kind === "wordmark") image.src = imageUrl;
      else image.removeAttribute("src");
    }
    cropImage.src = imageUrl;
    if (cropImage.complete && cropImage.naturalWidth) finishCropImageLoad();
    cropDialog.returnValue = "";
    cropDialog.showModal();
    cropResizeObserver?.observe(cropStage);
    requestAnimationFrame(() => { syncCropEditor(); cropInputs.x.focus(); });
  };

  adjustThemePreview.addEventListener("click", () => {
    if (!openThemeCardPreview(state.theme, adjustThemePreview)) {
      setStatus(t("previewUnavailable"), "error");
    }
  });
  adjustBackground.addEventListener("click", () => {
    openCropEditor({
      kind: "background",
      imageUrl: state.imagePreviewUrl,
      crop: state.backgroundCrop,
      positionSupported: state.backgroundCropSupported,
    }, adjustBackground);
  });
  const openAvatarCrop = (opener) => {
    openCropEditor({
      kind: "avatar",
      imageUrl: state.avatarPreviewUrl,
      crop: state.avatarCrop,
      background: state.avatarBackground,
    }, opener);
  };
  adjustAvatar?.addEventListener("click", () => openAvatarCrop(adjustAvatar));
  const openPersonalWordmarkCrop = (opener, { staged = false } = {}) => {
    openCropEditor({
      kind: "wordmark",
      imageUrl: state.personalWordmarkPreviewUrl,
      crop: state.personalWordmarkCrop,
      staged,
    }, opener);
  };
  for (const controls of personalWordmarkControls) {
    controls.adjust.addEventListener(
      "click",
      () => openPersonalWordmarkCrop(controls.adjust),
    );
  }

  for (const axis of ["x", "y"]) {
    cropInputs[axis].addEventListener("input", () => updateCropDraft({ [axis]: Number(cropInputs[axis].value) }));
  }
  cropInputs.zoom.addEventListener("input", () => updateCropDraft({ zoom: Number(cropInputs.zoom.value) / 100 }));
  cropReset.addEventListener("click", () => updateCropDraft(cropContext?.resetCrop ?? DEFAULT_CROP));

  const chooseAvatarBackground = (value) => {
    if (!cropContext) return;
    cropContext.background = normalizeAvatarBackground(value);
    syncAvatarBackdrop();
  };
  for (const input of cropBackgroundChoices) {
    input.addEventListener("change", () => {
      if (!input.checked) return;
      chooseAvatarBackground(input.value === "custom" ? cropBackgroundColor?.value : input.value);
    });
  }
  cropBackgroundColor?.addEventListener("input", () => {
    const custom = cropBackgroundChoices.find((input) => input.value === "custom");
    if (custom) custom.checked = true;
    chooseAvatarBackground(cropBackgroundColor.value);
  });

  cropStage.addEventListener("pointerdown", (event) => {
    if (!cropContext || pendingCropSave || (event.button !== 0 && event.pointerType !== "touch")) return;
    event.preventDefault();
    cropStage.setPointerCapture(event.pointerId);
    cropStage.classList.add("is-dragging");
    cropDrag = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      crop: { ...cropContext.draft },
      layout: layoutCropImage(cropStage, cropImage, cropContext.draft),
    };
  });
  cropStage.addEventListener("pointermove", (event) => {
    if (pendingCropSave || !cropDrag || event.pointerId !== cropDrag.pointerId) return;
    const patch = {};
    if (cropDrag.layout.overflowX > 0.5) {
      patch.x = cropDrag.crop.x - ((event.clientX - cropDrag.startX) / cropDrag.layout.overflowX * 100);
    }
    if (cropDrag.layout.overflowY > 0.5) {
      patch.y = cropDrag.crop.y - ((event.clientY - cropDrag.startY) / cropDrag.layout.overflowY * 100);
    }
    updateCropDraft(patch);
  });
  const endCropDrag = (event) => {
    if (!cropDrag || event.pointerId !== cropDrag.pointerId) return;
    if (cropStage.hasPointerCapture(event.pointerId)) cropStage.releasePointerCapture(event.pointerId);
    cropStage.classList.remove("is-dragging");
    cropDrag = null;
  };
  cropStage.addEventListener("pointerup", endCropDrag);
  cropStage.addEventListener("pointercancel", endCropDrag);
  cropSave.addEventListener("click", () => {
    if (!cropContext) return;
    const saved = normalizeCrop(cropContext.draft, cropContext.resetCrop, cropContext.maximumZoom);
    const message = cropContext.kind === "card"
      ? { type: "set-card-preview-crop", theme: cropContext.theme, ...saved }
      : cropContext.kind === "avatar"
        ? { type: "set-avatar-framing", ...saved, background: cropContext.background }
        : cropContext.kind === "wordmark"
          ? newPersonalWordmarkMessage("set-personal-wordmark-framing", saved)
          : { type: "set-image-framing", ...saved };
    if (!message) {
      setCropError(t("statusDemo"));
      return;
    }
    const pending = {
      action: message.type,
      kind: cropContext.kind,
      theme: cropContext.theme,
      crop: saved,
      background: cropContext.background,
      requestId: message.requestId ?? null,
    };
    pendingCropSave = pending;
    setCropError();
    setCropBusy(true);
    if (!send(message)) {
      clearPendingCropSave();
      setCropBusy(false);
      setCropError(t("statusDemo"));
      return;
    }
    if (pending.kind === "wordmark") {
      pending.timer = window.setTimeout(() => {
        if (pendingCropSave !== pending) return;
        clearPendingCropSave();
        setCropBusy(false);
        setCropError(t("saveFailed"));
      }, 10_000);
    }
  });
  cropDialog.addEventListener("close", () => {
    const abandonWordmarkDraft = cropContext?.kind === "wordmark"
      && cropContext.staged
      && cropDialog.returnValue !== "saved";
    cropResizeObserver?.unobserve(cropStage);
    cropStage.classList.remove("is-dragging");
    cropDrag = null;
    cropImage.onload = null;
    cropImage.onerror = null;
    cropImage.removeAttribute("src");
    for (const image of wordmarkSurfaceImages) {
      image.onload = null;
      image.onerror = null;
      image.removeAttribute("src");
    }
    wordmarkSurfacePreviews.hidden = true;
    setCropError();
    setCropNotice();
    if (cropBackground) cropBackground.hidden = true;
    delete cropStage.dataset.backdrop;
    cropStage.style.removeProperty("--crop-backdrop");
    clearPendingCropSave();
    cropContext = null;
    cropReturnFocus?.focus();
    cropReturnFocus = null;
    if (abandonWordmarkDraft) {
      sendPersonalWordmarkAction("set-personal-wordmark", { operation: "cancel" });
    }
  });
  cropDialog.addEventListener("cancel", (event) => {
    if (pendingCropSave) event.preventDefault();
  });

  const studioViewFromHash = (hash) => {
    const view = typeof hash === "string" && hash.startsWith("#") ? hash.slice(1) : "";
    return ordinaryStudioViewSet.has(view) ? view : "themes";
  };
  const reflectStudioViewNavigation = (view) => {
    for (const link of ordinaryStudioRailLinks) {
      const selected = link.dataset.studioView === view;
      link.classList.toggle("is-current", selected);
      if (selected) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    }
  };
  activateStudioView = (
    view,
    {
      updateHistory = false,
      focusPage = false,
      restoreScroll = true,
    } = {},
  ) => {
    const nextView = ordinaryStudioViewSet.has(view) ? view : "themes";
    const nextPage = ordinaryStudioPages.get(nextView);
    if (!nextPage || !content || editorController?.isActive?.()) return false;
    if (activeStudioView && activeStudioView !== nextView) {
      studioViewScrollPositions.set(activeStudioView, content.scrollTop);
    }
    for (const [pageView, page] of ordinaryStudioPages) {
      if (!page) continue;
      const selected = pageView === nextView;
      page.hidden = !selected;
      page.inert = !selected;
      page.classList.toggle("is-current-page", selected);
    }
    activeStudioView = nextView;
    studioRoot.dataset.studioView = nextView;
    reflectStudioViewNavigation(nextView);
    if (updateHistory) {
      try {
        const canonicalUrl = new URL(window.location.href);
        canonicalUrl.searchParams.delete("view");
        canonicalUrl.hash = nextView;
        history.replaceState(
          null,
          "",
          `${canonicalUrl.pathname}${canonicalUrl.search}${canonicalUrl.hash}`,
        );
      } catch {}
    }
    // A fragment can displace WebView's hidden root scroller. Keep the native
    // shell fixed and restore only the selected Studio page inside .content.
    window.scrollTo(0, 0);
    const scrollTop = restoreScroll && !focusPage
      ? studioViewScrollPositions.get(nextView) ?? 0
      : 0;
    content.scrollTo({ top: scrollTop, left: 0, behavior: "auto" });
    if (nextView === "prompt-shelf") ensurePromptShelfState();
    if (focusPage) {
      requestAnimationFrame(() => {
        const heading = nextPage.querySelector("h1[tabindex='-1'], h2[tabindex='-1']");
        if (!heading) return;
        try { heading.focus({ preventScroll: true }); } catch { heading.focus(); }
      });
    }
    return true;
  };
  const focusAdjacentStudioView = (event, link) => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return false;
    const previous = event.key === "ArrowUp";
    const next = event.key === "ArrowDown";
    const boundary = event.key === "Home" || event.key === "End";
    if (!previous && !next && !boundary) return false;
    const availableLinks = ordinaryStudioRailLinks.filter((candidate) => !candidate.hidden);
    const index = availableLinks.indexOf(link);
    if (index < 0 || !availableLinks.length) return false;
    event.preventDefault();
    const nextIndex = event.key === "Home" ? 0
      : event.key === "End" ? availableLinks.length - 1
        : (index + (previous ? -1 : 1) + availableLinks.length) % availableLinks.length;
    availableLinks[nextIndex].focus();
    return true;
  };
  for (const link of ordinaryStudioRailLinks) {
    link.addEventListener("click", (event) => {
      if (activateStudioView(link.dataset.studioView, {
        updateHistory: true,
        focusPage: true,
        restoreScroll: false,
      })) event.preventDefault();
    });
    link.addEventListener("keydown", (event) => {
      if (focusAdjacentStudioView(event, link)) return;
      if (event.key !== " " && event.key !== "Spacebar") return;
      event.preventDefault();
      link.click();
    });
  }
  window.addEventListener("hashchange", () => {
    if (editorController?.isActive?.() || window.location.hash === "#editor") return;
    const view = studioViewFromHash(window.location.hash);
    const validHash = window.location.hash === `#${view}`;
    activateStudioView(view, {
      updateHistory: Boolean(window.location.hash) && !validHash,
      focusPage: false,
      restoreScroll: true,
    });
  });
  const initialDestination = requestedViewHash || window.location.hash;
  const initialView = studioViewFromHash(initialDestination);
  activateStudioView(initialView, {
    updateHistory: Boolean(requestedViewHash)
      || (Boolean(window.location.hash) && window.location.hash !== `#${initialView}`),
    focusPage: false,
    restoreScroll: false,
  });

  setStatus(t("statusReady"));
  reflect();
})();
