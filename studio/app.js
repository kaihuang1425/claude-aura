// Aura Studio front-end. The Checkpoint B crop editor is a user-approved WO-05
// revision; later work orders keep using the marked host-bridge boundary.
(() => {
  "use strict";

  const STUDIO_PAGE_MESSAGE_TYPES = Object.freeze([
    "get-state", "set-theme", "set-appearance", "set-locale", "complete-studio-introduction",
    "set-image", "clear-image", "set-avatar", "clear-avatar", "set-avatar-framing",
    "set-image-framing", "set-card-preview-crop", "set-enabled", "open-aura", "open-desktop",
    "import-theme", "create-theme-copy", "begin-theme-edit", "set-theme-token", "set-theme-layer",
    "apply-theme-patch", "pick-theme-layer-image", "pick-theme-launcher-mark", "remove-theme-layer", "move-theme-layer",
    "undo-theme-edit", "redo-theme-edit", "save-theme-edit", "discard-theme-edit", "delete-user-theme",
    "set-greeting-phrases", "reset-greeting",
    "set-aura-preview", "set-aura-topmost", "refresh-aura-mirror",
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
  const rawLocale = params.get("locale") || navigator.language || "en";
  const requestedView = params.get("view");
  const requestedViewHash = ["themes", "background", "create", "settings"].includes(requestedView)
    ? `#${requestedView}`
    : "";
  const resolvedLocale = normalizeLocale(rawLocale);
  const locale = supportedLocales.has(resolvedLocale) ? resolvedLocale : "en";
  const t = (key) => STRINGS[locale]?.[key] ?? STRINGS.en?.[key] ?? key;
  document.documentElement.lang = locale;
  for (const node of document.querySelectorAll("[data-i18n]")) {
    node.textContent = t(node.dataset.i18n);
  }
  for (const node of document.querySelectorAll("[data-i18n-aria-label]")) {
    node.setAttribute("aria-label", t(node.dataset.i18nAriaLabel));
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
  let appearancePending = false;
  let localePending = null;
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
  let editorStudioStyle = null;
  let editorStudioThemeId = null;
  let editorLauncherStyle = null;
  let editorLauncherMarkUrl = null;
  let requestedThemeMarkUrl = "";

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
    const scale = Math.max(frameWidth / image.naturalWidth, frameHeight / image.naturalHeight) * crop.zoom;
    const width = image.naturalWidth * scale;
    const height = image.naturalHeight * scale;
    const overflowX = Math.max(0, width - frameWidth);
    const overflowY = Math.max(0, height - frameHeight);
    image.style.width = `${width}px`;
    image.style.height = `${height}px`;
    image.style.left = `${-overflowX * crop.x / 100}px`;
    image.style.top = `${-overflowY * crop.y / 100}px`;
    return { overflowX, overflowY };
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
      }
    })
    : null;

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
    for (const themeId of cardFrames.keys()) layoutCardCrop(themeId);
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
  // Theme metadata remains localized only in the three frozen product locales.
  // Studio UI languages outside that set use the canonical host label/description.
  const hostThemeLocales = new Set(["en", "zh-CN", "zh-HKTW"]);
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
        const labels = { ...(existing.labels ?? {}), ...(incomingTheme.labels ?? {}) };
        const descriptions = { ...(existing.descriptions ?? {}), ...(incomingTheme.descriptions ?? {}) };
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
  window.CLAUDE_AURA_STUDIO_MESSAGE_TYPES = STUDIO_PAGE_MESSAGE_TYPES;
  editorController = window.CLAUDE_AURA_EDITOR?.createController({
    locale,
    send,
    setStatus,
    translate: t,
    focusThemeCard,
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
      if (data.type === "aura-mirror") {
        if (editorController?.isActive?.()) editorController.receiveMirror?.(data);
        return;
      }
      if (data.type === "state") {
        state.connected = true;
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
        if (typeof data.status === "string") setStatus(data.status, data.tone ?? "ok");
        else if (appearanceAcknowledged) setStatus(t("statusReady"));
        if (Object.hasOwn(data, "editor")) editorController?.receive(data.editor, state.appearance);
        if (cropContext?.kind === "background") {
          cropStage.style.setProperty("--crop-aspect-ratio", String(state.backgroundAspectRatio));
          syncCropEditor();
        }
        if (pendingCropSave && data.action === pendingCropSave.action && typeof data.actionSucceeded === "boolean") {
          const pending = pendingCropSave;
          const persisted = pending.kind === "card"
            ? state.studioPreviewCrops[pending.theme]
            : pending.kind === "avatar"
              ? state.avatarCrop
              : state.backgroundCrop;
          pendingCropSave = null;
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
  };

  const updateCropDraft = (patch) => {
    if (!cropContext) return;
    cropContext.draft = normalizeCrop(
      { ...cropContext.draft, ...patch }, cropContext.draft, cropContext.maximumZoom);
    syncCropEditor();
  };

  const openCropEditor = ({
    kind, theme = null, imageUrl, crop, defaultCrop = DEFAULT_CROP, positionSupported = true,
    background = "transparent",
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
    };
    // Offer the backdrop swatches only where they change something: an avatar
    // whose source actually has see-through pixels.
    if (cropBackground) cropBackground.hidden = !(kind === "avatar" && state.avatarHasAlpha);
    syncAvatarBackdrop();
    cropInputs.zoom.max = String(maximumZoom * 100);
    cropStage.dataset.kind = kind;
    const aspectRatio = kind === "card" ? 3 / 2 : kind === "avatar" ? 1 : state.backgroundAspectRatio;
    cropStage.style.setProperty("--crop-aspect-ratio", String(aspectRatio));
    const titleKey = kind === "card" ? "cardCropTitle" : kind === "avatar" ? "avatarCropTitle" : "backgroundCropTitle";
    const helpKey = kind === "card" ? "cardCropHelp" : kind === "avatar" ? "avatarCropHelp" : "backgroundCropHelp";
    cropTitle.textContent = t(titleKey);
    cropHelp.textContent = t(helpKey);
    setCropError();
    setCropNotice(kind === "background" && !positionSupported ? t("advancedPositionHelp") : "");
    setCropBusy(false);
    cropSave.disabled = true;
    cropImage.onload = () => { setCropBusy(false); syncCropEditor(); };
    cropImage.onerror = () => {
      cropSave.disabled = true;
      setCropError(t("previewUnavailable"));
      setStatus(t("previewUnavailable"), "error");
    };
    cropImage.src = imageUrl;
    cropDialog.showModal();
    cropResizeObserver?.observe(cropStage);
    requestAnimationFrame(() => { syncCropEditor(); cropInputs.x.focus(); });
  };

  adjustThemePreview.addEventListener("click", () => {
    const theme = themes[state.theme];
    const imageUrl = theme ? studioPreviewUrl(theme.studioPreview, theme) : null;
    openCropEditor({
      kind: "card",
      theme: state.theme,
      imageUrl,
      crop: cropForTheme(state.theme),
      defaultCrop: defaultCropForTheme(state.theme),
    }, adjustThemePreview);
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
        : { type: "set-image-framing", ...saved };
    if (!send(message)) {
      setCropError(t("statusDemo"));
      return;
    }
    pendingCropSave = {
      action: message.type,
      kind: cropContext.kind,
      theme: cropContext.theme,
      crop: saved,
      background: cropContext.background,
    };
    setCropError();
    setCropBusy(true);
  });
  cropDialog.addEventListener("close", () => {
    cropResizeObserver?.unobserve(cropStage);
    cropStage.classList.remove("is-dragging");
    cropDrag = null;
    cropImage.onload = null;
    cropImage.onerror = null;
    cropImage.removeAttribute("src");
    setCropError();
    setCropNotice();
    if (cropBackground) cropBackground.hidden = true;
    delete cropStage.dataset.backdrop;
    cropStage.style.removeProperty("--crop-backdrop");
    pendingCropSave = null;
    cropContext = null;
    cropReturnFocus?.focus();
    cropReturnFocus = null;
  });
  cropDialog.addEventListener("cancel", (event) => {
    if (pendingCropSave) event.preventDefault();
  });

  const railLinks = [...document.querySelectorAll(".rail-item")];
  const activateRailLink = (link, { updateHistory = false, smooth = true } = {}) => {
    const target = link?.hash ? document.querySelector(link.hash) : null;
    if (!link || !target || !content || link.hidden) return false;
    const contentBounds = content.getBoundingClientRect();
    const targetTop = content.scrollTop + target.getBoundingClientRect().top - contentBounds.top;
    if (updateHistory) {
      try { history.replaceState(null, "", link.hash); } catch {}
    }
    // Fragment navigation can move WebView's hidden root scroller as well as
    // this pane. Keep the native shell fixed and move only Studio content.
    window.scrollTo(0, 0);
    content.scrollTo({
      top: Math.max(0, targetTop),
      left: 0,
      behavior: smooth && !window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches
        ? "smooth"
        : "auto",
    });
    for (const other of railLinks) {
      other.classList.remove("is-current");
      other.removeAttribute("aria-current");
    }
    link.classList.add("is-current");
    link.setAttribute("aria-current", "page");
    return true;
  };
  for (const link of railLinks) {
    link.addEventListener("click", (event) => {
      if (activateRailLink(link, { updateHistory: true })) event.preventDefault();
    });
  }
  const initialDestination = requestedViewHash || window.location.hash;
  const initialRailLink = railLinks.find((link) => link.hash === initialDestination && !link.hidden)
    ?? railLinks.find((link) => link.hash === "#themes");
  activateRailLink(initialRailLink, { updateHistory: Boolean(requestedViewHash), smooth: false });

  setStatus(t("statusReady"));
  reflect();
})();
