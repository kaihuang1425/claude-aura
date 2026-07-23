// Aura Studio front-end. The Checkpoint B crop editor is a user-approved WO-05
// revision; later work orders keep using the marked host-bridge boundary.
(() => {
  "use strict";

  const STUDIO_PAGE_MESSAGE_TYPES = Object.freeze([
    "get-state", "set-theme", "set-appearance", "set-locale", "complete-studio-introduction",
    "set-image", "clear-image",
    "set-image-framing", "set-card-preview-crop", "set-enabled", "open-aura", "open-desktop",
    "import-theme", "create-theme-copy", "begin-theme-edit", "set-theme-token", "set-theme-layer",
    "apply-theme-patch", "pick-theme-layer-image", "pick-theme-launcher-mark", "remove-theme-layer", "move-theme-layer",
    "undo-theme-edit", "redo-theme-edit", "save-theme-edit", "discard-theme-edit", "delete-user-theme",
    "set-aura-preview", "set-aura-topmost", "refresh-aura-mirror",
  ]);
  const studioPageMessageTypes = new Set(STUDIO_PAGE_MESSAGE_TYPES);

  const STRINGS = {
    en: {
      railSubtitle: "Studio",
      navThemes: "Themes",
      navBackground: "Personal wallpaper",
      navCreate: "Create a theme",
      navSettings: "Settings",
      auraWindow: "Back to Claude Aura",
      desktopApp: "Desktop app",
      themesKicker: "Appearance",
      themesTitle: "Choose a look",
      themesLede: "Selection applies to Claude Aura and Studio immediately and is saved on this device.",
      themesLegend: "Available themes",
      themesHelp: "Use arrow keys to move between themes. Press Space or Enter to apply.",
      appearanceMode: "Appearance mode",
      appearanceSystem: "System",
      appearanceLight: "Light",
      appearanceDark: "Dark",
      appearanceHelp: "System follows Windows. Light and Dark apply to Claude Aura and Studio.",
      quickActions: "Quick actions",
      adjustPreview: "Adjust card preview",
      adjustPreviewFor: "Adjust the card preview for {0}",
      originalLook: "Original look",
      applyTheme: "Apply theme",
      backgroundKicker: "Your window",
      backgroundTitle: "Personal wallpaper",
      backgroundLede: "Add one private image behind every theme. Wallpaper is personal to this device and is separate from artwork saved inside a theme.",
      chooseImage: "Choose wallpaper…",
      adjustBackground: "Adjust wallpaper",
      clearImage: "Clear wallpaper",
      backgroundHelp: "PNG, JPEG, WebP, GIF, or AVIF up to 16 MB. A quiet, wide image works best as wallpaper.",
      cropKicker: "Framing",
      cardCropTitle: "Adjust card preview",
      backgroundCropTitle: "Adjust personal wallpaper",
      cardCropHelp: "Drag the preserved master image to choose what appears on the theme card. Aura saves only the frame, so you can reframe it later.",
      backgroundCropHelp: "Drag the image to choose what stays in your personal wallpaper. Save to apply the new framing on this device.",
      dragToReposition: "Drag to reposition",
      horizontalPosition: "Horizontal position",
      verticalPosition: "Vertical position",
      zoom: "Zoom",
      resetPosition: "Reset",
      cancel: "Cancel",
      saveChanges: "Save",
      createKicker: "Visual theme builder",
      createTitle: "Create a theme",
      createLede: "Start with Default in the visual editor, then choose colors, style, and artwork. No code or theme folder is required.",
      startTheme: "Customize Default",
      importTheme: "Install theme from folder…",
      createGuide: "How visual creation works",
      createStepName: "Give the theme a name in each language you use.",
      createStepStyle: "Choose the essential colors and overall style.",
      createStepArtwork: "Optionally add theme artwork, review the checks, and save.",
      createAdvancedHelp: "Already have a theme kit? Install its folder with the secondary action above.",
      createHelp: "Your custom themes stay in Aura's user data folder and never modify Claude or the desktop app.",
      settingsKicker: "Aura preferences",
      settingsTitle: "Settings",
      settingsLede: "Choose how Aura speaks to you. These settings are saved on this device.",
      languageTitle: "Interface language",
      languageHelp: "Changes Aura Studio, the Aura button menu, and Aura messages. Claude keeps its own language setting.",
      gettingStartedTitle: "Getting started",
      gettingStartedBody: "Open the welcome guide whenever you want a quick refresher.",
      openWelcome: "Open welcome guide",
      welcomeKicker: "Welcome",
      welcomeTitle: "Meet Claude Aura",
      welcomeBody: "Give Claude a look that feels like yours. Aura stays local and never changes Claude itself.",
      welcomeClose: "Close welcome guide",
      welcomeLanguageTitle: "Choose your language",
      welcomeLanguageHelp: "You can change this later in Settings.",
      welcomeThemeTitle: "Try a theme",
      welcomeThemeBody: "Pick any theme card to apply it to Claude Aura and Studio immediately.",
      welcomeControlTitle: "Keep control",
      welcomeControlBody: "Compare Light and Dark, or restore Claude's Original look at any time.",
      welcomeCreateTitle: "Make it yours",
      welcomeCreateBody: "Add a personal wallpaper or duplicate a theme when you're ready to customize.",
      welcomeLauncherNote: "Click the Aura button to open Studio, drag it to move it, or right-click for quick actions.",
      welcomeLater: "Skip",
      welcomeTryTheme: "Try a theme",
      statusWelcomeBusy: "Saving your welcome choice…",
      statusWelcomeRetry: "Aura hasn't confirmed that yet. Try again.",
      selected: "Selected",
      statusReady: "Ready.",
      statusApplying: "Applying theme…",
      statusAppearanceBusy: "Changing appearance…",
      statusLanguageBusy: "Changing language…",
      statusActive: "{0} is active.",
      statusOriginal: "Original look is active.",
      statusDemo: "Preview mode: no Claude window connected.",
      previewSaved: "Card preview updated.",
      backgroundSaved: "Wallpaper framing saved.",
      previewUnavailable: "The image preview could not load. Close this window and try again.",
      saveFailed: "The changes could not be saved. Try again.",
      advancedPositionHelp: "This background uses an advanced CSS position. Saving here will replace it with the visual crop shown below.",
    },
    "zh-CN": {
      railSubtitle: "工作室",
      navThemes: "主题",
      navBackground: "个人壁纸",
      navCreate: "创建主题",
      navSettings: "设置",
      auraWindow: "返回 Claude Aura",
      desktopApp: "桌面版",
      themesKicker: "外观",
      themesTitle: "选择外观",
      themesLede: "选择主题后会立即应用到 Claude Aura 和 Studio，并保存在本机。",
      themesLegend: "可用主题",
      themesHelp: "使用方向键在主题间移动，按空格键或回车键应用。",
      appearanceMode: "外观模式",
      appearanceSystem: "跟随系统",
      appearanceLight: "浅色",
      appearanceDark: "深色",
      appearanceHelp: "“跟随系统”会使用 Windows 的外观设置；选择“浅色”或“深色”后，Claude Aura 和 Studio 会同步切换。",
      quickActions: "快捷操作",
      adjustPreview: "调整卡片预览",
      adjustPreviewFor: "调整“{0}”的卡片预览",
      originalLook: "原始外观",
      applyTheme: "应用主题",
      backgroundKicker: "窗口背景",
      backgroundTitle: "个人壁纸",
      backgroundLede: "在所有主题后方显示一张本地图片。壁纸仅保存在本机，与主题内保存的美术素材相互独立。",
      chooseImage: "选择壁纸…",
      adjustBackground: "调整壁纸",
      clearImage: "清除壁纸",
      backgroundHelp: "支持不超过 16 MB 的 PNG、JPEG、WebP、GIF 或 AVIF 图片。建议使用简洁的宽幅图片作为壁纸。",
      cropKicker: "画面范围",
      cardCropTitle: "调整卡片预览",
      backgroundCropTitle: "调整个人壁纸",
      cardCropHelp: "拖动保留的原图，选择主题卡片中显示的区域。Aura 仅保存画面范围，之后仍可重新调整。",
      backgroundCropHelp: "拖动图片，选择个人壁纸中保留的区域。保存后会在本机应用新的画面范围。",
      dragToReposition: "拖动以调整位置",
      horizontalPosition: "水平位置",
      verticalPosition: "垂直位置",
      zoom: "缩放",
      resetPosition: "重置",
      cancel: "取消",
      saveChanges: "保存",
      createKicker: "可视化主题编辑器",
      createTitle: "创建主题",
      createLede: "以默认主题为起点，在可视化编辑器中选择颜色、样式和美术素材，无需编写代码或准备主题文件夹。",
      startTheme: "自定义默认主题",
      importTheme: "从文件夹安装主题…",
      createGuide: "可视化创建流程",
      createStepName: "填写各界面语言下显示的主题名称。",
      createStepStyle: "选择主要颜色和整体样式。",
      createStepArtwork: "按需添加主题美术素材，检查各项校验后保存。",
      createAdvancedHelp: "如已有主题工具包，可通过上方次要操作安装所在文件夹。",
      createHelp: "自定义主题保存在 Aura 用户数据文件夹中，不会修改 Claude 或桌面版应用。",
      settingsKicker: "Aura 首选项",
      settingsTitle: "设置",
      settingsLede: "选择 Aura 的界面语言。设置将保存在本机。",
      languageTitle: "界面语言",
      languageHelp: "此设置会更改 Aura Studio、Aura 按钮菜单和 Aura 提示信息。Claude 的语言设置不受影响。",
      gettingStartedTitle: "入门指南",
      gettingStartedBody: "可随时重新打开欢迎指南，查看选择主题和自定义外观的基本步骤。",
      openWelcome: "打开欢迎指南",
      welcomeKicker: "欢迎使用",
      welcomeTitle: "认识 Claude Aura",
      welcomeBody: "为 Claude 选择适合您的外观。Aura 仅在本机运行，不会修改 Claude。",
      welcomeClose: "关闭欢迎指南",
      welcomeLanguageTitle: "选择界面语言",
      welcomeLanguageHelp: "之后可在“设置”中更改。",
      welcomeThemeTitle: "试用主题",
      welcomeThemeBody: "选择任意主题卡片，即可立即应用到 Claude Aura 和 Studio。",
      welcomeControlTitle: "随时恢复",
      welcomeControlBody: "可比较浅色和深色效果，也可随时恢复 Claude 的原始外观。",
      welcomeCreateTitle: "创建专属外观",
      welcomeCreateBody: "可添加个人壁纸；需要进一步调整时，可复制主题并进行自定义。",
      welcomeLauncherNote: "点击 Aura 按钮可打开 Studio，拖动可移动按钮位置，右键可查看更多选项。",
      welcomeLater: "跳过",
      welcomeTryTheme: "试用主题",
      statusWelcomeBusy: "正在保存欢迎指南设置…",
      statusWelcomeRetry: "Aura 尚未确认保存结果，请重试。",
      selected: "已选",
      statusReady: "就绪。",
      statusApplying: "正在应用主题…",
      statusAppearanceBusy: "正在切换外观…",
      statusLanguageBusy: "正在更改界面语言…",
      statusActive: "当前使用{0}。",
      statusOriginal: "当前使用原始外观。",
      statusDemo: "预览模式：未连接 Claude 窗口。",
      previewSaved: "卡片预览已更新。",
      backgroundSaved: "壁纸画面范围已保存。",
      previewUnavailable: "无法加载图片预览，请关闭窗口后重试。",
      saveFailed: "无法保存更改，请重试。",
      advancedPositionHelp: "此背景使用高级 CSS 位置。保存后会改用下方显示的可视画面范围。",
    },
    "zh-TW": {
      railSubtitle: "工作室",
      navThemes: "主題",
      navBackground: "個人桌布",
      navCreate: "建立主題",
      navSettings: "設定",
      auraWindow: "回到 Claude Aura",
      desktopApp: "桌面版",
      themesKicker: "外觀",
      themesTitle: "選擇外觀",
      themesLede: "選取主題後會立即套用到 Claude Aura 和 Studio，並儲存在這台裝置上。",
      themesLegend: "可用的主題",
      themesHelp: "用方向鍵在主題間移動，按空白鍵或 Enter 套用。",
      appearanceMode: "外觀模式",
      appearanceSystem: "跟隨系統",
      appearanceLight: "淺色",
      appearanceDark: "深色",
      appearanceHelp: "「跟隨系統」會使用 Windows 的外觀設定；選擇「淺色」或「深色」後，Claude Aura 和 Studio 會一起切換。",
      quickActions: "快速操作",
      adjustPreview: "調整卡片預覽",
      adjustPreviewFor: "調整「{0}」的卡片預覽",
      originalLook: "原始外觀",
      applyTheme: "套用主題",
      backgroundKicker: "視窗背景",
      backgroundTitle: "個人桌布",
      backgroundLede: "在所有主題後方放一張本機圖片。桌布只會留在這台裝置上，和主題裡儲存的美術素材彼此獨立。",
      chooseImage: "選擇桌布…",
      adjustBackground: "調整桌布",
      clearImage: "清除桌布",
      backgroundHelp: "支援 16 MB 以內的 PNG、JPEG、WebP、GIF 或 AVIF 圖片。簡潔的寬幅圖片最適合當桌布。",
      cropKicker: "畫面範圍",
      cardCropTitle: "調整卡片預覽",
      backgroundCropTitle: "調整個人桌布",
      cardCropHelp: "拖曳保留的原始圖片，選擇主題卡片要顯示的範圍。Aura 只會儲存畫面範圍，之後仍可重新調整。",
      backgroundCropHelp: "拖曳圖片，選擇個人桌布要保留的範圍。儲存後會在這台裝置套用新的畫面範圍。",
      dragToReposition: "拖曳以調整位置",
      horizontalPosition: "水平位置",
      verticalPosition: "垂直位置",
      zoom: "縮放",
      resetPosition: "重設",
      cancel: "取消",
      saveChanges: "儲存",
      createKicker: "視覺化主題編輯器",
      createTitle: "建立主題",
      createLede: "從預設主題開始，在視覺化編輯器裡挑選顏色、樣式和美術素材，不用寫程式，也不用準備主題資料夾。",
      startTheme: "自訂預設主題",
      importTheme: "從資料夾安裝主題…",
      createGuide: "視覺化建立流程",
      createStepName: "填寫各介面語言要顯示的主題名稱。",
      createStepStyle: "挑選主要顏色和整體樣式。",
      createStepArtwork: "需要時加入主題美術素材，確認檢查結果後儲存。",
      createAdvancedHelp: "已經有主題工具包嗎？可用上方的次要操作安裝資料夾。",
      createHelp: "自訂主題會存放在 Aura 使用者資料夾，不會更動 Claude 或桌面版 App。",
      settingsKicker: "Aura 偏好設定",
      settingsTitle: "設定",
      settingsLede: "選擇 Aura 的介面語言。設定會儲存在這台裝置上。",
      languageTitle: "介面語言",
      languageHelp: "這項設定會變更 Aura Studio、Aura 按鈕選單和 Aura 提示。Claude 的語言設定不受影響。",
      gettingStartedTitle: "開始使用",
      gettingStartedBody: "隨時重新開啟歡迎導覽，快速查看選主題和自訂外觀的步驟。",
      openWelcome: "開啟歡迎導覽",
      welcomeKicker: "歡迎使用",
      welcomeTitle: "認識 Claude Aura",
      welcomeBody: "替 Claude 換上喜歡的外觀。Aura 只在本機運作，不會更動 Claude。",
      welcomeClose: "關閉歡迎導覽",
      welcomeLanguageTitle: "選擇介面語言",
      welcomeLanguageHelp: "之後可在「設定」裡變更。",
      welcomeThemeTitle: "試試主題",
      welcomeThemeBody: "選一張主題卡片，就會立即套用到 Claude Aura 和 Studio。",
      welcomeControlTitle: "隨時還原",
      welcomeControlBody: "可以比較淺色和深色效果，也能隨時還原 Claude 的原始外觀。",
      welcomeCreateTitle: "打造自己的外觀",
      welcomeCreateBody: "可以先加一張個人桌布；想再多調整時，就複製主題來自訂。",
      welcomeLauncherNote: "點一下 Aura 按鈕可開啟 Studio，拖曳可以移動，按右鍵還有更多選項。",
      welcomeLater: "略過",
      welcomeTryTheme: "試試主題",
      statusWelcomeBusy: "正在儲存歡迎導覽設定…",
      statusWelcomeRetry: "Aura 尚未確認儲存結果，請再試一次。",
      selected: "已選取",
      statusReady: "就緒。",
      statusApplying: "正在套用主題…",
      statusAppearanceBusy: "正在切換外觀…",
      statusLanguageBusy: "正在變更介面語言…",
      statusActive: "目前使用{0}。",
      statusOriginal: "目前使用原始外觀。",
      statusDemo: "預覽模式：尚未連接 Claude 視窗。",
      previewSaved: "卡片預覽已更新。",
      backgroundSaved: "桌布畫面範圍已儲存。",
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
  // This snapshot is the only authority for permanent Studio shell profiles.
  // Host-added themes and editor drafts keep their validated colour projection
  // but cannot select a bundled chrome recipe by choosing an ID.
  const bundledThemeIds = new Set(Object.keys(themes));
  const grid = document.getElementById("theme-grid");
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
    locale,
    introductionPending: null,
    introductionRequested: false,
    enabled: true,
    connected: false,
    hasImage: false,
    imagePreviewUrl: null,
    backgroundAspectRatio: 16 / 9,
    backgroundCropSupported: true,
    backgroundCrop: { ...DEFAULT_CROP },
    studioPreviewCrops: Object.create(null),
    effectiveIdentity: null,
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
    for (const themeId of cardFrames.keys()) layoutCardCrop(themeId);
  };

  // ── HOST BRIDGE (WO-05 / WO-07 wire the other side in aura-ui.ps1) ──────
  const bridge = window.chrome?.webview ?? null;
  const appearanceModes = new Set(["system", "light", "dark"]);
  const hostThemeIdPattern = /^[a-z][a-z0-9-]{1,39}$/;
  const hostThemeColorPattern = /^#[0-9a-f]{6}$/i;
  const hostThemeKeys = new Set([
    "name", "label", "description", "labels", "descriptions", "swatches", "preview", "launcher", "studioPreview",
    "studioPreviewFrame", "studioStyle", "source",
  ]);
  const hostThemeLocales = new Set(["en", "zh-CN", "zh-TW"]);
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
        let appearanceAcknowledged = false;
        let introductionAcknowledged = false;
        if (typeof data.locale === "string" && hostThemeLocales.has(data.locale)) {
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
        if (typeof data.appearance === "string" && appearanceModes.has(data.appearance)) {
          state.appearance = data.appearance;
          appearanceAcknowledged = appearancePending;
          appearancePending = false;
        }
        if (typeof data.theme === "string" && hostThemeIdPattern.test(data.theme)
            && Object.hasOwn(themes, data.theme)) state.theme = data.theme;
        if (typeof data.enabled === "boolean") state.enabled = data.enabled;
        if (typeof data.hasImage === "boolean") state.hasImage = data.hasImage;
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
      if (!input.checked || localePending || !hostThemeLocales.has(input.value)
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
  const initialRailLink = railLinks.find((link) => link.hash === window.location.hash && !link.hidden)
    ?? railLinks.find((link) => link.hash === "#themes");
  activateRailLink(initialRailLink, { smooth: false });

  setStatus(t("statusReady"));
  reflect();
})();
