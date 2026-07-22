// Aura Studio front-end. The Checkpoint B crop editor is a user-approved WO-05
// revision; later work orders keep using the marked host-bridge boundary.
(() => {
  "use strict";

  const STRINGS = {
    en: {
      railSubtitle: "Studio",
      navThemes: "Themes",
      navBackground: "Background",
      navCreate: "Create a theme",
      auraWindow: "Back to Claude Aura",
      desktopApp: "Desktop app",
      themesKicker: "Appearance",
      themesTitle: "Choose a look",
      themesLede: "Selection applies to the Claude window immediately and is saved on this device.",
      themesLegend: "Available themes",
      themesHelp: "Use arrow keys to move between themes. Press Space or Enter to apply.",
      appearanceMode: "Appearance mode",
      appearanceSystem: "System",
      appearanceLight: "Light",
      appearanceDark: "Dark",
      appearanceHelp: "System follows Windows. Light and Dark apply only to Claude Aura.",
      quickActions: "Quick actions",
      adjustPreview: "Adjust card preview",
      adjustPreviewFor: "Adjust the card preview for {0}",
      originalLook: "Original look",
      applyTheme: "Apply theme",
      backgroundKicker: "Personal touch",
      backgroundTitle: "Background image",
      backgroundLede: "A local image layered gently behind the interface. Decorative only — it never replaces Claude.",
      chooseImage: "Choose an image…",
      adjustBackground: "Adjust framing",
      clearImage: "Clear image",
      backgroundHelp: "PNG, JPEG, WebP, GIF, or AVIF up to 16 MB. Quiet, wide images work best.",
      cropKicker: "Framing",
      cardCropTitle: "Adjust card preview",
      backgroundCropTitle: "Adjust background",
      cardCropHelp: "Drag the preserved master image to choose what appears on the theme card. Aura saves only the frame, so you can reframe it later.",
      backgroundCropHelp: "Drag the image to choose what stays in the Claude background. Save to apply the new framing.",
      dragToReposition: "Drag to reposition",
      horizontalPosition: "Horizontal position",
      verticalPosition: "Vertical position",
      zoom: "Zoom",
      resetPosition: "Reset",
      cancel: "Cancel",
      saveChanges: "Save",
      createKicker: "Make it yours",
      createTitle: "Create a theme",
      createLede: "Build a complete theme from a folder of tokens and artwork — three commands, no coding required.",
      importTheme: "Install theme from folder…",
      openGuide: "Open the guide",
      createHelp: "Installed themes live in your user data folder and never modify the app.",
      selected: "Selected",
      statusReady: "Ready.",
      statusApplying: "Applying theme…",
      statusAppearanceBusy: "Changing appearance…",
      statusActive: "{0} is active.",
      statusOriginal: "Original look is active.",
      statusDemo: "Preview mode: no Claude window connected.",
      previewSaved: "Card preview updated.",
      backgroundSaved: "Background framing saved.",
      previewUnavailable: "The image preview could not load. Close this window and try again.",
      saveFailed: "The changes could not be saved. Try again.",
      advancedPositionHelp: "This background uses an advanced CSS position. Saving here will replace it with the visual crop shown below.",
    },
    "zh-CN": {
      railSubtitle: "工作室",
      navThemes: "主题",
      navBackground: "背景",
      navCreate: "创建主题",
      auraWindow: "返回 Claude Aura",
      desktopApp: "桌面版",
      themesKicker: "外观",
      themesTitle: "选择外观",
      themesLede: "选择主题后会立即应用到 Claude 窗口，并保存在本机。",
      themesLegend: "可用主题",
      themesHelp: "使用方向键在主题间移动，按空格键或回车键应用。",
      appearanceMode: "外观模式",
      appearanceSystem: "跟随系统",
      appearanceLight: "浅色",
      appearanceDark: "深色",
      appearanceHelp: "“跟随系统”会使用 Windows 的外观设置；选择“浅色”或“深色”后，仅更改 Claude Aura。",
      quickActions: "快捷操作",
      adjustPreview: "调整卡片预览",
      adjustPreviewFor: "调整“{0}”的卡片预览",
      originalLook: "原始外观",
      applyTheme: "应用主题",
      backgroundKicker: "个性化",
      backgroundTitle: "背景图片",
      backgroundLede: "本地图片会轻柔地衬在界面后方，仅用于装饰，不会遮挡 Claude。",
      chooseImage: "选择图片…",
      adjustBackground: "调整画面范围",
      clearImage: "清除图片",
      backgroundHelp: "支持不超过 16 MB 的 PNG、JPEG、WebP、GIF 或 AVIF 图片。建议使用安静的宽幅图片。",
      cropKicker: "画面范围",
      cardCropTitle: "调整卡片预览",
      backgroundCropTitle: "调整背景",
      cardCropHelp: "拖动保留的原图，选择主题卡片中显示的区域。Aura 仅保存画面范围，之后仍可重新调整。",
      backgroundCropHelp: "拖动图片，选择 Claude 背景中保留的区域。保存后会应用新的画面范围。",
      dragToReposition: "拖动以调整位置",
      horizontalPosition: "水平位置",
      verticalPosition: "垂直位置",
      zoom: "缩放",
      resetPosition: "重置",
      cancel: "取消",
      saveChanges: "保存",
      createKicker: "打造专属",
      createTitle: "创建主题",
      createLede: "通过一个包含配色与美术素材的文件夹构建完整主题，三条命令即可完成，无需编程。",
      importTheme: "从文件夹安装主题…",
      openGuide: "打开指南",
      createHelp: "安装的主题保存在用户数据文件夹中，不会修改应用本体。",
      selected: "已选",
      statusReady: "就绪。",
      statusApplying: "正在应用主题…",
      statusAppearanceBusy: "正在切换外观…",
      statusActive: "当前使用{0}。",
      statusOriginal: "当前使用原始外观。",
      statusDemo: "预览模式：未连接 Claude 窗口。",
      previewSaved: "卡片预览已更新。",
      backgroundSaved: "背景画面范围已保存。",
      previewUnavailable: "无法加载图片预览，请关闭窗口后重试。",
      saveFailed: "无法保存更改，请重试。",
      advancedPositionHelp: "此背景使用高级 CSS 位置。保存后会改用下方显示的可视画面范围。",
    },
    "zh-TW": {
      railSubtitle: "工作室",
      navThemes: "主題",
      navBackground: "背景",
      navCreate: "建立主題",
      auraWindow: "回到 Claude Aura",
      desktopApp: "桌面版",
      themesKicker: "外觀",
      themesTitle: "選擇外觀",
      themesLede: "選取主題後會立即套用到 Claude 視窗，並儲存在這台裝置上。",
      themesLegend: "可用的主題",
      themesHelp: "用方向鍵在主題間移動，按空白鍵或 Enter 套用。",
      appearanceMode: "外觀模式",
      appearanceSystem: "跟隨系統",
      appearanceLight: "淺色",
      appearanceDark: "深色",
      appearanceHelp: "「跟隨系統」會使用 Windows 的外觀設定；選擇「淺色」或「深色」只會改變 Claude Aura。",
      quickActions: "快速操作",
      adjustPreview: "調整卡片預覽",
      adjustPreviewFor: "調整「{0}」的卡片預覽",
      originalLook: "原始外觀",
      applyTheme: "套用主題",
      backgroundKicker: "個人風格",
      backgroundTitle: "背景圖片",
      backgroundLede: "本機圖片會輕輕襯在介面後方，只作裝飾，不會蓋住 Claude。",
      chooseImage: "選擇圖片…",
      adjustBackground: "調整畫面範圍",
      clearImage: "清除圖片",
      backgroundHelp: "支援 16 MB 以內的 PNG、JPEG、WebP、GIF 或 AVIF 圖片。安靜的寬幅圖片效果最好。",
      cropKicker: "畫面範圍",
      cardCropTitle: "調整卡片預覽",
      backgroundCropTitle: "調整背景",
      cardCropHelp: "拖曳保留的原始圖片，選擇主題卡片要顯示的範圍。Aura 只會儲存畫面範圍，之後仍可重新調整。",
      backgroundCropHelp: "拖曳圖片，選擇 Claude 背景要保留的範圍。儲存後會套用新的畫面範圍。",
      dragToReposition: "拖曳以調整位置",
      horizontalPosition: "水平位置",
      verticalPosition: "垂直位置",
      zoom: "縮放",
      resetPosition: "重設",
      cancel: "取消",
      saveChanges: "儲存",
      createKicker: "打造自己的",
      createTitle: "建立主題",
      createLede: "用一個放著色票與美術素材的資料夾建立完整主題，三個指令就能完成，不用寫程式。",
      importTheme: "從資料夾安裝主題…",
      openGuide: "開啟指南",
      createHelp: "安裝的主題存放在使用者資料夾，不會更動應用程式本體。",
      selected: "已選取",
      statusReady: "就緒。",
      statusApplying: "正在套用主題…",
      statusAppearanceBusy: "正在切換外觀…",
      statusActive: "目前使用{0}。",
      statusOriginal: "目前使用原始外觀。",
      statusDemo: "預覽模式：尚未連接 Claude 視窗。",
      previewSaved: "卡片預覽已更新。",
      backgroundSaved: "背景畫面範圍已儲存。",
      previewUnavailable: "無法載入圖片預覽，請關閉視窗後再試一次。",
      saveFailed: "無法儲存變更，請再試一次。",
      advancedPositionHelp: "此背景使用進階 CSS 位置。儲存後會改用下方顯示的視覺畫面範圍。",
    },
  };

  const params = new URLSearchParams(window.location.search);
  const rawLocale = params.get("locale") || navigator.language || "en";
  const locale = /^zh[-_](?:tw|hk|mo|hant)/i.test(rawLocale) ? "zh-TW"
    : /^zh/i.test(rawLocale) ? "zh-CN" : "en";
  const t = (key) => STRINGS[locale][key] ?? STRINGS.en[key] ?? key;
  document.documentElement.lang = locale;
  for (const node of document.querySelectorAll("[data-i18n]")) {
    node.textContent = t(node.dataset.i18n);
  }
  for (const node of document.querySelectorAll("[data-i18n-aria-label]")) {
    node.setAttribute("aria-label", t(node.dataset.i18nAriaLabel));
  }

  const themes = window.CLAUDE_AURA_THEMES ?? {};
  const grid = document.getElementById("theme-grid");
  const statusBar = document.querySelector(".statusbar");
  const statusOut = document.getElementById("status");
  const appearanceMode = document.getElementById("appearance-mode");
  const appearanceInputs = [...appearanceMode.querySelectorAll("input[name='appearance']")];
  const toggleEnabled = document.getElementById("toggle-enabled");
  const adjustThemePreview = document.getElementById("adjust-theme-preview");
  const adjustBackground = document.getElementById("adjust-background");
  const clearImage = document.getElementById("clear-image");
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
    enabled: true,
    connected: false,
    hasImage: false,
    imagePreviewUrl: null,
    backgroundAspectRatio: 16 / 9,
    backgroundCropSupported: true,
    backgroundCrop: { ...DEFAULT_CROP },
    studioPreviewCrops: Object.create(null),
  };
  const cardFrames = new Map();
  let cropContext = null;
  let cropDrag = null;
  let cropReturnFocus = null;
  let pendingCropSave = null;
  let appearancePending = false;
  let editorController = null;
  let requestedThemeMarkUrl = "";

  railThemeMark.addEventListener("load", () => {
    railThemeMark.parentElement?.classList.add("has-theme-mark");
  });
  railThemeMark.addEventListener("error", () => {
    railThemeMark.parentElement?.classList.remove("has-theme-mark");
    const fallback = "https://aura.assets/default/launcher-mark.png";
    if (requestedThemeMarkUrl !== fallback) {
      requestedThemeMarkUrl = fallback;
      railThemeMark.src = fallback;
      if (studioThemeIcon) studioThemeIcon.href = fallback;
    }
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
    for (const input of appearanceInputs) {
      input.checked = input.value === state.appearance;
    }
    appearanceMode.disabled = appearancePending;
    appearanceMode.setAttribute("aria-busy", String(appearancePending));
    for (const input of grid.querySelectorAll("input[name='theme']")) {
      input.checked = input.value === state.theme;
    }
    toggleEnabled.setAttribute("aria-pressed", String(state.enabled));
    toggleEnabled.textContent = state.enabled ? t("originalLook") : t("applyTheme");
    const activeTheme = themes[state.theme];
    const identityTheme = state.enabled ? activeTheme : themes.default;
    const themeMarkUrl = launcherMarkUrl(identityTheme);
    if (requestedThemeMarkUrl !== themeMarkUrl) {
      requestedThemeMarkUrl = themeMarkUrl;
      railThemeMark.parentElement?.classList.remove("has-theme-mark");
      railThemeMark.src = themeMarkUrl;
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
    for (const themeId of cardFrames.keys()) layoutCardCrop(themeId);
  };

  // ── HOST BRIDGE (WO-05 / WO-07 wire the other side in aura-ui.ps1) ──────
  const bridge = window.chrome?.webview ?? null;
  const bundledThemeIds = new Set(Object.keys(themes));
  const appearanceModes = new Set(["system", "light", "dark"]);
  const hostThemeIdPattern = /^[a-z][a-z0-9-]{1,39}$/;
  const hostThemeColorPattern = /^#[0-9a-f]{6}$/i;
  const hostThemeKeys = new Set([
    "name", "label", "description", "labels", "descriptions", "swatches", "preview", "launcher", "studioPreview",
    "studioPreviewFrame", "source",
  ]);
  const hostThemeLocales = new Set(["en", "zh-CN", "zh-TW"]);
  const hostThemePreviewKeys = new Set(["chrome", "background", "surface", "accent", "text"]);
  const hostThemeLauncherKeys = new Set([
    "asset", "surface", "surfaceHover", "foreground", "accent", "border", "radius", "borderWidth",
  ]);
  const hostThemeLauncherAssetPattern = /^(?:assets\/theme-art\/[a-z0-9-]+\/launcher-mark\.png|launcher-mark\.png)$/;

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
    if (value.studioPreviewFrame !== undefined) {
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

    let source;
    if (value.source !== undefined) {
      if (value.source !== null && value.source !== "builtin" && value.source !== "user") return null;
      source = value.source;
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
      ...(studioPreview === undefined ? {} : { studioPreview }),
      ...(studioPreviewFrame === undefined ? {} : { studioPreviewFrame }),
      ...(source === undefined ? {} : { source }),
    };
  };

  const themeCardInput = (themeId) => [...grid.querySelectorAll("input[name='theme']")]
    .find((input) => input.value === themeId) ?? null;
  const focusThemeCard = (themeId) => themeCardInput(themeId)?.focus();
  const themeSource = (theme) => bundledThemeIds.has(theme.name) ? "builtin" : (theme.source ?? "user");
  const syncThemeCardActions = (card, theme) => {
    card.querySelector(".theme-card-actions")?.remove();
    const actions = document.createElement("div");
    actions.className = "theme-card-actions";
    const source = themeSource(theme);
    const sourceBadge = document.createElement("span");
    sourceBadge.className = "theme-source-badge";
    sourceBadge.textContent = editorController?.translate(source === "builtin" ? "builtInTheme" : "customTheme")
      ?? (source === "builtin" ? "Built-in" : "Custom");
    actions.appendChild(sourceBadge);
    const action = document.createElement("button");
    action.type = "button";
    action.className = "ghost-button";
    if (source === "builtin") {
      action.textContent = editorController?.translate("duplicateToCustomize") ?? "Duplicate to customize";
      action.addEventListener("click", () => {
        setStatus(t("statusApplying"), "busy");
        send({ type: "create-theme-copy", theme: theme.name });
      });
      actions.appendChild(action);
    } else {
      action.textContent = editorController?.translate("editTheme") ?? "Edit";
      action.addEventListener("click", () => {
        setStatus(t("statusApplying"), "busy");
        send({ type: "begin-theme-edit", theme: theme.name, reset: false });
      });
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "ghost-button";
      remove.textContent = editorController?.translate("deleteTheme") ?? "Delete";
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
        if (card) syncThemeCardActions(card, existing);
      } else {
        themes[incomingTheme.name] = incomingTheme;
        createHostThemeCard(incomingTheme);
      }
    }
    return true;
  };
  const send = (message) => {
    if (!bridge) { setStatus(t("statusDemo"), "busy"); return false; }
    bridge.postMessage(message);
    return true;
  };
  editorController = window.CLAUDE_AURA_EDITOR?.createController({
    locale,
    send,
    setStatus,
    translate: t,
    focusThemeCard,
  }) ?? null;
  if (bridge) {
    bridge.addEventListener("message", (event) => {
      const data = event.data ?? {};
      if (data.type === "aura-mirror") {
        editorController?.receiveMirror?.(data);
        return;
      }
      if (data.type === "state") {
        state.connected = true;
        let appearanceAcknowledged = false;
        if (Object.hasOwn(data, "themes")) syncHostThemes(data.themes);
        if (typeof data.appearance === "string" && appearanceModes.has(data.appearance)) {
          state.appearance = data.appearance;
          appearanceAcknowledged = appearancePending;
          appearancePending = false;
        }
        if (typeof data.theme === "string" && hostThemeIdPattern.test(data.theme)
            && Object.hasOwn(themes, data.theme)) state.theme = data.theme;
        if (typeof data.enabled === "boolean") state.enabled = data.enabled;
        if (typeof data.hasImage === "boolean") state.hasImage = data.hasImage;
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
            : state.backgroundCrop;
          pendingCropSave = null;
          if (data.actionSucceeded && data.tone !== "error" && cropsEqual(persisted, pending.crop)) {
            reflect();
            cropDialog.close("saved");
            return;
          }
          setCropBusy(false);
          setCropError(t("saveFailed"));
        }
        reflect();
      }
    });
    send({ type: "get-state" });
  } else {
    setStatus(t("statusDemo"), "busy");
  }
  // ── END HOST BRIDGE ─────────────────────────────────────────────────────

  for (const input of appearanceInputs) {
    input.addEventListener("change", () => {
      if (!input.checked || appearancePending || !appearanceModes.has(input.value)) return;
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
  document.getElementById("open-aura").addEventListener("click", () => send({ type: "open-aura" }));
  document.getElementById("open-desktop").addEventListener("click", () => send({ type: "open-desktop" }));
  document.getElementById("import-theme").addEventListener("click", () => send({ type: "import-theme" }));
  document.getElementById("open-guide").addEventListener("click", () => send({ type: "open-guide" }));

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
    };
    cropInputs.zoom.max = String(maximumZoom * 100);
    cropStage.dataset.kind = kind;
    cropStage.style.setProperty("--crop-aspect-ratio", String(
      kind === "card" ? 3 / 2 : state.backgroundAspectRatio));
    cropTitle.textContent = t(kind === "card" ? "cardCropTitle" : "backgroundCropTitle");
    cropHelp.textContent = t(kind === "card" ? "cardCropHelp" : "backgroundCropHelp");
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

  for (const axis of ["x", "y"]) {
    cropInputs[axis].addEventListener("input", () => updateCropDraft({ [axis]: Number(cropInputs[axis].value) }));
  }
  cropInputs.zoom.addEventListener("input", () => updateCropDraft({ zoom: Number(cropInputs.zoom.value) / 100 }));
  cropReset.addEventListener("click", () => updateCropDraft(cropContext?.resetCrop ?? DEFAULT_CROP));

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
      : { type: "set-image-framing", ...saved };
    if (!send(message)) {
      setCropError(t("statusDemo"));
      return;
    }
    pendingCropSave = { action: message.type, kind: cropContext.kind, theme: cropContext.theme, crop: saved };
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
    pendingCropSave = null;
    cropContext = null;
    cropReturnFocus?.focus();
    cropReturnFocus = null;
  });
  cropDialog.addEventListener("cancel", (event) => {
    if (pendingCropSave) event.preventDefault();
  });

  for (const link of document.querySelectorAll(".rail-item")) {
    link.addEventListener("click", () => {
      for (const other of document.querySelectorAll(".rail-item")) {
        other.classList.remove("is-current");
        other.removeAttribute("aria-current");
      }
      link.classList.add("is-current");
      link.setAttribute("aria-current", "page");
    });
  }

  setStatus(t("statusReady"));
  reflect();
})();
