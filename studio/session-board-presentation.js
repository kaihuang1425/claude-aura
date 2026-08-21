(() => {
  "use strict";

  const SUPPORTED_LOCALES = Object.freeze([
    "en", "hi", "es", "fr", "id", "ja", "ko", "pt-BR", "de", "it", "vi", "pl", "tr",
    "zh-CN", "zh-HKTW",
  ]);
  const PRESENTATION_FIELDS = Object.freeze([
    "type", "version", "revision", "locale", "themeId", "appearance", "enabled",
  ]);
  const STUDIO_STYLE_COLOR_KEYS = Object.freeze([
    "canvas", "sidebar", "surface", "raised", "text", "textSecondary", "textMuted",
    "sidebarText", "sidebarTextMuted", "accent", "accentText", "border", "focus",
  ]);
  const STUDIO_STYLE_MODE_KEYS = Object.freeze([
    ...STUDIO_STYLE_COLOR_KEYS, "surfaceAlpha", "sidebarAlpha",
  ]);
  const FONT_UI_IDS = new Set(["system-sans", "humanist-sans", "rounded-sans"]);
  const FONT_DISPLAY_IDS = new Set([...FONT_UI_IDS, "editorial-serif"]);
  const SHADOW_IDS = new Set(["none", "soft", "elevated"]);
  const APPEARANCES = new Set(["system", "light", "dark"]);
  const COLOR_PATTERN = /^#[0-9A-F]{6}$/;
  const FONT_STACKS = Object.freeze({
    "system-sans": 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    "humanist-sans": '"Segoe UI", "Hiragino Sans", "Yu Gothic UI", system-ui, sans-serif',
    "rounded-sans": '"Trebuchet MS", "Segoe UI", system-ui, sans-serif',
    "editorial-serif": 'ui-serif, Georgia, "Times New Roman", serif',
  });
  const SHADOWS = Object.freeze({
    none: "none",
    soft: "0 10px 30px rgb(0 0 0 / 0.14)",
    elevated: "0 20px 54px rgb(0 0 0 / 0.24)",
  });

  const isRecord = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
  const hasExactFields = (value, fields) => {
    if (!isRecord(value)) return false;
    const keys = Object.keys(value);
    return keys.length === fields.length && fields.every((field) => Object.hasOwn(value, field));
  };
  const inRange = (value, minimum, maximum) => Number.isFinite(value)
    && value >= minimum && value <= maximum;

  const normalizeLocale = (value) => {
    if (typeof value !== "string") return "en";
    const tag = value.trim().replaceAll("_", "-");
    if (!tag) return "en";
    if (/^pt(?:-|$)/i.test(tag)) return "pt-BR";
    if (/^zh-(?:hktw|tw|hk|mo|hant)(?:-|$)/i.test(tag) || /^zh-hant(?:-|$)/i.test(tag)) {
      return "zh-HKTW";
    }
    if (/^zh-(?:cn|sg|hans)(?:-|$)/i.test(tag) || /^zh-hans(?:-|$)/i.test(tag)) return "zh-CN";
    if (/^en(?:-|$)/i.test(tag)) return "en";
    const base = tag.split("-", 1)[0].toLowerCase();
    return SUPPORTED_LOCALES.includes(base) ? base : "en";
  };

  const normalizeStudioStyle = (value) => {
    if (!hasExactFields(value, ["light", "dark", "shared"])
        || !hasExactFields(value.shared, ["fontUi", "fontDisplay", "radius", "blur", "shadow"])) return null;
    const modes = Object.create(null);
    for (const mode of ["light", "dark"]) {
      const source = value[mode];
      if (!hasExactFields(source, STUDIO_STYLE_MODE_KEYS)) return null;
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
    if (!FONT_UI_IDS.has(value.shared.fontUi)
        || !FONT_DISPLAY_IDS.has(value.shared.fontDisplay)
        || !inRange(value.shared.radius, 0, 32)
        || !inRange(value.shared.blur, 0, 40)
        || !SHADOW_IDS.has(value.shared.shadow)) return null;
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
  };

  const hexChannels = (value) => [1, 3, 5]
    .map((offset) => Number.parseInt(value.slice(offset, offset + 2), 16));
  const hexFromChannels = (channels) => `#${channels.map((channel) => Math.round(channel)
    .toString(16).padStart(2, "0")).join("")}`.toUpperCase();
  const composite = (foreground, background, alpha) => {
    const foregroundChannels = hexChannels(foreground);
    const backgroundChannels = hexChannels(background);
    return hexFromChannels(foregroundChannels.map((channel, index) => (
      (channel * alpha) + (backgroundChannels[index] * (1 - alpha)))));
  };
  const linearChannel = (channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  const luminance = (color) => {
    const [red, green, blue] = hexChannels(color).map(linearChannel);
    return (0.2126 * red) + (0.7152 * green) + (0.0722 * blue);
  };
  const contrast = (left, right) => {
    const values = [luminance(left), luminance(right)];
    return (Math.max(...values) + 0.05) / (Math.min(...values) + 0.05);
  };
  const safeComposite = (foreground, background, alpha, checks) => {
    const result = composite(foreground, background, alpha);
    return checks.every(([color, minimum]) => contrast(color, result) >= minimum)
      ? result
      : foreground;
  };

  const copyValue = (strings, locale, key) => {
    const localized = strings?.[locale]?.shell?.[key];
    if (typeof localized === "string" && localized.length > 0) return localized;
    const fallback = strings?.en?.shell?.[key];
    return typeof fallback === "string" && fallback.length > 0 ? fallback : "";
  };

  const applyStudioStyle = (document, themeId, style, mode, enabled) => {
    const colors = style[mode];
    const shared = style.shared;
    const surface = safeComposite(colors.surface, colors.canvas, colors.surfaceAlpha, [
      [colors.textSecondary, 4.5], [colors.textMuted, 4.5], [colors.border, 3],
    ]);
    const rail = safeComposite(colors.sidebar, colors.canvas, colors.sidebarAlpha, [
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
      "--shadow": SHADOWS[shared.shadow],
      "--radius": `${shared.radius}px`,
      "--panel-radius": `${Math.max(8, shared.radius)}px`,
      "--control-radius": `${controlRadius}px`,
      "--studio-blur": `${shared.blur}px`,
      "--font-ui": FONT_STACKS[shared.fontUi],
      "--font-display": FONT_STACKS[shared.fontDisplay],
    };
    for (const [name, value] of Object.entries(properties)) root.style.setProperty(name, value);
    root.style.colorScheme = mode;
    root.dataset.studioTheme = themeId;
    root.dataset.studioShell = enabled ? themeId : "default";
    root.dataset.studioMode = mode;
  };

  const createSessionBoardPresentation = ({ document, strings, themes, prefersDark } = {}) => {
    if (!document?.documentElement?.style || !isRecord(strings) || !isRecord(themes)) {
      throw new TypeError("Session board presentation dependencies are invalid.");
    }
    const knownThemeIds = new Set(Object.keys(themes));
    let locale = "en";
    let revision = -1;
    let current = null;
    const isDark = typeof prefersDark === "function" ? prefersDark : () => false;

    const t = (key) => typeof key === "string" ? copyValue(strings, locale, key) : "";
    const applyPresentationStyle = (value) => {
      const effectiveThemeId = value.enabled ? value.themeId : "default";
      const theme = themes[effectiveThemeId];
      const style = normalizeStudioStyle(theme?.studioStyle);
      if (!style) return false;
      const mode = !value.enabled || value.appearance === "system"
        ? (isDark() ? "dark" : "light")
        : value.appearance;
      applyStudioStyle(document, effectiveThemeId, style, mode, value.enabled);
      return true;
    };
    const receive = (value) => {
      if (!hasExactFields(value, PRESENTATION_FIELDS)
          || value.type !== "session-board-presentation"
          || value.version !== 1
          || !Number.isSafeInteger(value.revision) || value.revision < 0 || value.revision <= revision
          || !SUPPORTED_LOCALES.includes(value.locale)
          || typeof value.themeId !== "string" || value.themeId.length > 40
          || !knownThemeIds.has(value.themeId)
          || !APPEARANCES.has(value.appearance)
          || typeof value.enabled !== "boolean") return false;
      if (!applyPresentationStyle(value)) return false;
      locale = value.locale;
      document.documentElement.lang = locale === "zh-HKTW"
        ? "zh-Hant-TW"
        : locale === "zh-CN" ? "zh-Hans-CN" : locale;
      document.title = t("sessionBoardTitle");
      revision = value.revision;
      current = { ...value };
      return true;
    };
    const refreshSystemAppearance = () => {
      if (!current || (current.enabled && current.appearance !== "system")) return false;
      return applyPresentationStyle(current);
    };

    return Object.freeze({ receive, refreshSystemAppearance, t });
  };

  window.CLAUDE_AURA_SESSION_BOARD_PRESENTATION = Object.freeze({
    SUPPORTED_LOCALES,
    normalizeLocale,
    normalizeStudioStyle,
    createSessionBoardPresentation,
  });
})();
