// Aura Studio front-end. Design and behavior here are complete; the WO-05 and
// WO-07 work orders only touch the sections marked HOST BRIDGE below.
(() => {
  "use strict";

  const STRINGS = {
    en: {
      railSubtitle: "Studio",
      navThemes: "Themes",
      navBackground: "Background",
      navCreate: "Create a theme",
      desktopApp: "Desktop app",
      themesKicker: "Appearance",
      themesTitle: "Choose a look",
      themesLede: "Selection applies to the Claude window immediately and is saved on this device.",
      themesLegend: "Available themes",
      themesHelp: "Use arrow keys to move between themes. Press Space or Enter to apply.",
      quickActions: "Quick actions",
      originalLook: "Original look",
      applyTheme: "Apply theme",
      backgroundKicker: "Personal touch",
      backgroundTitle: "Background image",
      backgroundLede: "A local image layered gently behind the interface. Decorative only — it never replaces Claude.",
      chooseImage: "Choose an image…",
      clearImage: "Clear image",
      backgroundHelp: "PNG, JPEG, WebP, GIF, or AVIF up to 16 MB. Quiet, wide images work best.",
      createKicker: "Make it yours",
      createTitle: "Create a theme",
      createLede: "Build a complete theme from a folder of tokens and artwork — three commands, no coding required.",
      importTheme: "Install theme from folder…",
      openGuide: "Open the guide",
      createHelp: "Installed themes live in your user data folder and never modify the app.",
      selected: "Selected",
      statusReady: "Ready.",
      statusApplying: "Applying theme…",
      statusActive: "{0} is active.",
      statusOriginal: "Original look is active.",
      statusDemo: "Preview mode: no Claude window connected.",
    },
    "zh-CN": {
      railSubtitle: "工作室",
      navThemes: "主题",
      navBackground: "背景",
      navCreate: "创建主题",
      desktopApp: "桌面版",
      themesKicker: "外观",
      themesTitle: "选择外观",
      themesLede: "选择主题后会立即应用到 Claude 窗口，并保存在本机。",
      themesLegend: "可用主题",
      themesHelp: "使用方向键在主题间移动，按空格键或回车键应用。",
      quickActions: "快捷操作",
      originalLook: "原始外观",
      applyTheme: "应用主题",
      backgroundKicker: "个性化",
      backgroundTitle: "背景图片",
      backgroundLede: "本地图片会轻柔地衬在界面后方，仅用于装饰，不会遮挡 Claude。",
      chooseImage: "选择图片…",
      clearImage: "清除图片",
      backgroundHelp: "支持不超过 16 MB 的 PNG、JPEG、WebP、GIF 或 AVIF 图片。建议使用安静的宽幅图片。",
      createKicker: "打造专属",
      createTitle: "创建主题",
      createLede: "通过一个包含配色与美术素材的文件夹构建完整主题，三条命令即可完成，无需编程。",
      importTheme: "从文件夹安装主题…",
      openGuide: "打开指南",
      createHelp: "安装的主题保存在用户数据文件夹中，不会修改应用本体。",
      selected: "已选",
      statusReady: "就绪。",
      statusApplying: "正在应用主题…",
      statusActive: "当前使用{0}。",
      statusOriginal: "当前使用原始外观。",
      statusDemo: "预览模式：未连接 Claude 窗口。",
    },
    "zh-TW": {
      railSubtitle: "工作室",
      navThemes: "主題",
      navBackground: "背景",
      navCreate: "建立主題",
      desktopApp: "桌面版",
      themesKicker: "外觀",
      themesTitle: "選擇外觀",
      themesLede: "選取主題後會立即套用到 Claude 視窗，並儲存在這台裝置上。",
      themesLegend: "可用的主題",
      themesHelp: "用方向鍵在主題間移動，按空白鍵或 Enter 套用。",
      quickActions: "快速操作",
      originalLook: "原始外觀",
      applyTheme: "套用主題",
      backgroundKicker: "個人風格",
      backgroundTitle: "背景圖片",
      backgroundLede: "本機圖片會輕輕襯在介面後方，只作裝飾，不會蓋住 Claude。",
      chooseImage: "選擇圖片…",
      clearImage: "清除圖片",
      backgroundHelp: "支援 16 MB 以內的 PNG、JPEG、WebP、GIF 或 AVIF 圖片。安靜的寬幅圖片效果最好。",
      createKicker: "打造自己的",
      createTitle: "建立主題",
      createLede: "用一個放著色票與美術素材的資料夾建立完整主題，三個指令就能完成，不用寫程式。",
      importTheme: "從資料夾安裝主題…",
      openGuide: "開啟指南",
      createHelp: "安裝的主題存放在使用者資料夾，不會更動應用程式本體。",
      selected: "已選取",
      statusReady: "就緒。",
      statusApplying: "正在套用主題…",
      statusActive: "目前使用{0}。",
      statusOriginal: "目前使用原始外觀。",
      statusDemo: "預覽模式：尚未連接 Claude 視窗。",
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

  const themes = window.CLAUDE_AURA_THEMES ?? {};
  const grid = document.getElementById("theme-grid");
  const statusBar = document.querySelector(".statusbar");
  const statusOut = document.getElementById("status");
  const toggleEnabled = document.getElementById("toggle-enabled");
  const state = { theme: "default", enabled: true, connected: false };

  const setStatus = (text, tone = "ok") => {
    statusOut.textContent = text;
    statusBar.dataset.tone = tone;
  };

  const localized = (map, fallback) => (map && (map[locale] ?? map.en)) || fallback || "";
  const studioPreviewUrl = (value) => {
    if (typeof value !== "string" || !/^assets\/theme-art\/[a-z0-9-]+\/card-preview\.webp$/.test(value)) return null;
    return `https://aura.assets/${value.slice("assets/theme-art/".length)}`;
  };

  // ── HOST BRIDGE (WO-05 / WO-07 wire the other side in aura-ui.ps1) ──────
  const bridge = window.chrome?.webview ?? null;
  const send = (message) => {
    if (!bridge) { setStatus(t("statusDemo"), "busy"); return false; }
    bridge.postMessage(message);
    return true;
  };
  if (bridge) {
    bridge.addEventListener("message", (event) => {
      const data = event.data ?? {};
      if (data.type === "state") {
        state.connected = true;
        if (typeof data.theme === "string") state.theme = data.theme;
        if (typeof data.enabled === "boolean") state.enabled = data.enabled;
        if (typeof data.status === "string") setStatus(data.status, data.tone ?? "ok");
        reflect();
      }
    });
    send({ type: "get-state" });
  } else {
    setStatus(t("statusDemo"), "busy");
  }
  // ── END HOST BRIDGE ─────────────────────────────────────────────────────

  const reflect = () => {
    for (const input of grid.querySelectorAll("input[name='theme']")) {
      input.checked = input.value === state.theme;
    }
    toggleEnabled.setAttribute("aria-pressed", String(state.enabled));
    toggleEnabled.textContent = state.enabled ? t("originalLook") : t("applyTheme");
  };

  for (const theme of Object.values(themes)) {
    const preview = theme.preview ?? {};
    const imageUrl = studioPreviewUrl(theme.studioPreview);
    const card = document.createElement("div");
    card.className = "theme-card";
    const inputId = `theme-${theme.name}`;
    const swatches = (theme.swatches ?? []).slice(0, 4)
      .map((color) => `<i style="background:${color}"></i>`).join("");
    const previewMarkup = imageUrl
      ? `<img class="theme-card-preview" src="${imageUrl}" alt="" aria-hidden="true" draggable="false">`
      : `<span class="mini" style="background:${preview.background ?? "#eee"}" aria-hidden="true">
          <span class="mini-chrome" style="background:${preview.chrome ?? "#222"}">
            <i style="background:${preview.text ?? "#fff"}"></i><i style="background:${preview.text ?? "#fff"}"></i>
          </span>
          <span class="mini-surface" style="background:${preview.surface ?? "#fff"}">
            <span class="mini-text" style="background:${preview.text ?? "#333"}"></span>
            <span class="mini-accent" style="background:${preview.accent ?? "#888"}"></span>
          </span>
        </span>`;
    card.innerHTML = `
      <input type="radio" name="theme" id="${inputId}" value="${theme.name}">
      <label for="${inputId}">
        ${previewMarkup}
        <span class="theme-card-body">
          <strong></strong>
          <small></small>
          <span class="swatches" aria-hidden="true">${swatches}</span>
        </span>
      </label>
      <span class="selected-badge" aria-hidden="true">${t("selected")}</span>`;
    card.querySelector("strong").textContent = localized(theme.labels, theme.label);
    card.querySelector("small").textContent = localized(theme.descriptions, theme.description);
    card.querySelector("input").addEventListener("change", () => {
      state.theme = theme.name;
      state.enabled = true;
      setStatus(t("statusApplying"), "busy");
      if (!send({ type: "set-theme", theme: theme.name })) {
        setStatus(t("statusActive").replace("{0}", localized(theme.labels, theme.label)));
      }
      reflect();
    });
    grid.appendChild(card);
  }

  toggleEnabled.addEventListener("click", () => {
    state.enabled = !state.enabled;
    send({ type: "set-enabled", enabled: state.enabled });
    setStatus(state.enabled ? t("statusApplying") : t("statusOriginal"), state.enabled ? "busy" : "ok");
    reflect();
  });
  document.getElementById("pick-image").addEventListener("click", () => send({ type: "set-image" }));
  document.getElementById("clear-image").addEventListener("click", () => send({ type: "clear-image" }));
  document.getElementById("open-desktop").addEventListener("click", () => send({ type: "open-desktop" }));
  document.getElementById("import-theme").addEventListener("click", () => send({ type: "import-theme" }));
  document.getElementById("open-guide").addEventListener("click", () => send({ type: "open-guide" }));

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
