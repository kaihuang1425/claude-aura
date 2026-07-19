(() => {
  "use strict";

  const themeMap = window.CLAUDE_AURA_THEMES ?? {};
  const themes = Object.values(themeMap).filter((theme) => theme && typeof theme.name === "string");
  const root = document.documentElement;
  const query = new URLSearchParams(window.location.search);
  const captureValue = query.get("capture");
  if (captureValue !== null && captureValue !== "0" && captureValue !== "1") {
    throw new Error(`Invalid preview capture value: ${captureValue}`);
  }
  const captureMode = captureValue === "1";
  root.dataset.previewCapture = String(captureMode);

  const elements = {
    gallery: document.getElementById("theme-gallery"),
    modeButton: document.getElementById("mode-toggle"),
    modeIcon: document.getElementById("mode-icon"),
    modeLabel: document.getElementById("mode-label"),
    qaState: document.getElementById("qa-state"),
    activeThemeChip: document.getElementById("active-theme-chip"),
    themeArt: document.getElementById("theme-art"),
    themeArtLayers: document.getElementById("theme-art-layers"),
    tabButtons: [...document.querySelectorAll('[role="tab"][data-view]')],
    views: [...document.querySelectorAll(".workspace-view")],
    viewKicker: document.getElementById("view-kicker"),
    viewTitle: document.getElementById("view-title"),
    menuButton: document.getElementById("sample-menu-button"),
    menu: document.getElementById("sample-menu"),
    openDialogButton: document.getElementById("open-dialog-button"),
    resetButton: document.getElementById("reset-preview-button"),
    dialog: document.getElementById("sample-dialog"),
    dialogDescription: document.getElementById("dialog-description"),
    newTaskButton: document.getElementById("new-task-button"),
    composerForm: document.getElementById("composer-form"),
    composerInput: document.getElementById("composer-input"),
    composerStatus: document.getElementById("composer-status"),
    sendButton: document.getElementById("send-button"),
    micButton: document.getElementById("mic-button"),
    voiceButton: document.getElementById("voice-button"),
    modelSelect: document.getElementById("model-select"),
    workModes: [...document.querySelectorAll('input[name="work-mode"]')],
    quickCards: [...document.querySelectorAll(".quick-card")],
  };

  const storageKeys = {
    theme: "claudeAuraTheme",
    mode: "claudeAuraMode",
  };
  const supportedModes = new Set(["light", "dark"]);
  const supportedScreens = new Set(["home", "code"]);
  const supportedOverlays = new Set(["none", "menu", "dialog"]);
  const safeArtworkPath = /^assets\/theme-art\/(?:[a-z0-9-]+\/)?[a-z0-9-]+\.(?:svg|png|webp|avif)$/;
  const appliedVariables = new Set();
  let activeTheme = themes.find((theme) => theme.name === "default")?.name ?? themes[0]?.name ?? "default";
  let activeMode = "light";
  let submitTimer = null;
  let previewGeneration = 0;
  let resizeTimer = null;
  let activeLayerLoads = [];

  function readStored(key) {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  function writeStored(key, value) {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // The preview remains functional when a file origin blocks storage.
    }
  }

  function removeStored(key) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // No-op when storage is unavailable.
    }
  }

  function getTheme(name) {
    return themeMap[name] ?? themes.find((theme) => theme.name === name) ?? null;
  }

  function readQueryValue(name, validator) {
    const value = query.get(name);
    if (value === null) return null;
    if (!validator(value)) throw new Error(`Invalid preview ${name} value: ${value}`);
    return value;
  }

  function createThemeOption(theme, index) {
    const option = document.createElement("div");
    option.className = "theme-option";

    const input = document.createElement("input");
    input.className = "theme-radio";
    input.type = "radio";
    input.name = "preview-theme";
    input.id = `preview-theme-${theme.name}`;
    input.value = theme.name;
    input.checked = theme.name === activeTheme;

    const card = document.createElement("label");
    card.className = "theme-card";
    card.htmlFor = input.id;
    card.title = theme.description;
    card.style.setProperty("--picker-chrome", theme.preview?.chrome ?? "#171623");
    card.style.setProperty("--picker-background", theme.preview?.background ?? "#F3F3FA");
    card.style.setProperty("--picker-surface", theme.preview?.surface ?? "#FFFFFF");
    card.style.setProperty("--picker-accent", theme.preview?.accent ?? "#5D54C7");

    const name = document.createElement("strong");
    name.textContent = theme.label;
    const description = document.createElement("small");
    description.textContent = theme.description;
    const swatches = document.createElement("span");
    swatches.className = "theme-swatches";
    swatches.setAttribute("aria-hidden", "true");
    for (const colour of (theme.swatches ?? []).slice(0, 4)) {
      const swatch = document.createElement("i");
      swatch.style.backgroundColor = colour;
      swatches.appendChild(swatch);
    }

    card.append(name, description, swatches);
    option.append(input, card);
    input.addEventListener("change", () => {
      if (!input.checked) return;
      activeTheme = input.value;
      applyTheme({ persist: true });
    });

    if (index === 0 && themes.length === 0) input.disabled = true;
    return option;
  }

  function buildGallery() {
    elements.gallery.replaceChildren();
    if (themes.length === 0) {
      const message = document.createElement("p");
      message.textContent = "Theme data is unavailable. Run the preview build and reload this page.";
      elements.gallery.appendChild(message);
      return;
    }
    themes.forEach((theme, index) => elements.gallery.appendChild(createThemeOption(theme, index)));
  }

  function clearAppliedVariables() {
    for (const name of appliedVariables) root.style.removeProperty(name);
    appliedVariables.clear();
  }

  function setVariable(name, value) {
    if (typeof value !== "string" && typeof value !== "number") return;
    root.style.setProperty(name, String(value));
    appliedVariables.add(name);
  }

  async function waitForArtwork() {
    const layerLoads = [...activeLayerLoads];
    if (layerLoads.length) {
      const results = await Promise.all(layerLoads.map((entry) => entry.promise));
      if (results.some((loaded) => !loaded)) throw new Error("A layered artwork asset failed to decode");
      return;
    }
    const expectedSource = elements.themeArt.dataset.source;
    if (!expectedSource) return;
    if (!elements.themeArt.complete) {
      await new Promise((resolve) => {
        let timeout = null;
        const finish = () => {
          elements.themeArt.removeEventListener("load", finish);
          elements.themeArt.removeEventListener("error", finish);
          if (timeout !== null) window.clearTimeout(timeout);
          resolve();
        };
        elements.themeArt.addEventListener("load", finish, { once: true });
        elements.themeArt.addEventListener("error", finish, { once: true });
        timeout = window.setTimeout(finish, 3000);
      });
    }
    if (elements.themeArt.dataset.source !== expectedSource || typeof elements.themeArt.decode !== "function") return;
    try {
      await elements.themeArt.decode();
    } catch {
      // Failed decorative artwork is hidden by the existing error handler.
    }
  }

  function getPreviewState() {
    const theme = getTheme(activeTheme);
    return {
      theme: activeTheme,
      label: theme?.label ?? activeTheme,
      mode: activeMode,
      screen: root.dataset.previewScreen ?? "home",
      overlay: root.dataset.previewOverlay ?? "none",
      width: window.innerWidth,
      height: window.innerHeight,
      dpr: Number(window.devicePixelRatio) || 1,
    };
  }

  function updateQaState(state) {
    const mode = state.mode[0].toUpperCase() + state.mode.slice(1);
    const screen = state.screen[0].toUpperCase() + state.screen.slice(1);
    const overlay = state.overlay === "none"
      ? "No overlay"
      : `${state.overlay[0].toUpperCase()}${state.overlay.slice(1)}`;
    elements.qaState.textContent = `Ready · ${state.label} · ${mode} · ${screen} · ${overlay} · ${state.width}×${state.height} CSS px · DPR ${state.dpr}`;
  }

  async function markPreviewReady(generation) {
    const fontPromise = document.fonts?.ready?.catch?.(() => undefined) ?? Promise.resolve();
    await Promise.all([fontPromise, waitForArtwork()]);
    await new Promise((resolve) => window.requestAnimationFrame(() => window.requestAnimationFrame(resolve)));
    if (generation !== previewGeneration) return;
    const state = getPreviewState();
    updateQaState(state);
    root.dataset.previewReady = "true";
    window.dispatchEvent(new CustomEvent("claude-aura-preview-ready", {
      detail: state,
    }));
  }

  function schedulePreviewReady() {
    const generation = ++previewGeneration;
    root.dataset.previewReady = "false";
    delete root.dataset.previewError;
    elements.qaState.textContent = "Preparing preview…";
    void markPreviewReady(generation).catch(() => {
      if (generation !== previewGeneration) return;
      root.dataset.previewReady = "false";
      root.dataset.previewError = "artwork";
      elements.qaState.textContent = "Preview unavailable · artwork failed to decode";
    });
  }

  function whenPreviewReady() {
    if (root.dataset.previewReady === "true") return Promise.resolve(getPreviewState());
    return new Promise((resolve) => {
      window.addEventListener("claude-aura-preview-ready", (event) => resolve(event.detail), { once: true });
    });
  }

  function applyThemePrimitives(theme, variant) {
    clearAppliedVariables();

    const tokenMap = variant.tokens ?? {
      ...(variant.compat ?? variant.compatibility ?? {}),
      ...(variant.semantic ?? {}),
    };
    for (const [name, value] of Object.entries(tokenMap)) {
      if (name.startsWith("--")) setVariable(name, value);
    }

    setVariable("--aura-font-ui", theme.typography.ui);
    setVariable("--aura-font-display", theme.typography.display);
    setVariable("--aura-font-body", theme.typography.body);
    setVariable("--aura-font-mono", theme.typography.mono);
    setVariable("--aura-display-weight", theme.typography.displayWeight);
    setVariable("--aura-display-spacing", theme.typography.letterSpacing);
    setVariable("--aura-control-radius", `${theme.shape.control}px`);
    setVariable("--aura-card-radius", `${theme.shape.card}px`);
    setVariable("--aura-composer-radius", `${theme.shape.composer}px`);
    setVariable("--aura-icon-radius", `${theme.shape.icon}px`);
    setVariable("--aura-border-width", `${theme.shape.borderWidth}px`);
    setVariable("--aura-blur", `${theme.blur}px`);
    setVariable("--aura-shadow-soft", theme.effects.shadowSoft);
    setVariable("--aura-shadow-elevated", theme.effects.shadowElevated);
    setVariable("--aura-hover-lift", `${theme.effects.hoverLift}px`);
    setVariable("--aura-transition-duration", `${theme.effects.transitionMs}ms`);
    setVariable("--aura-wallpaper-gradient", variant.wallpaper.gradient);
    setVariable("--aura-surface-alpha", variant.wallpaper.surfaceAlpha);
    setVariable("--aura-sidebar-alpha", variant.wallpaper.sidebarAlpha);
    setVariable("--aura-art-opacity", variant.wallpaper.artOpacity);
    setVariable("--aura-texture-opacity", variant.wallpaper.textureOpacity);
  }

  function hideArtwork() {
    activeLayerLoads = [];
    elements.themeArtLayers.replaceChildren();
    elements.themeArt.hidden = true;
    elements.themeArt.removeAttribute("src");
    delete elements.themeArt.dataset.source;
    elements.themeArt.dataset.fit = "contain";
    elements.themeArt.dataset.mobile = "reduce";
    setVariable("--aura-art-position", "right center");
  }

  function hideLegacyArtwork() {
    elements.themeArt.hidden = true;
    elements.themeArt.removeAttribute("src");
    delete elements.themeArt.dataset.source;
    elements.themeArt.dataset.fit = "contain";
    elements.themeArt.dataset.mobile = "reduce";
    setVariable("--aura-art-position", "right center");
  }

  function preloadArtworkLayer(element, source) {
    const image = new Image();
    const promise = new Promise((resolve) => {
      let finished = false;
      let timeout = null;
      const finish = async (loaded) => {
        if (finished) return;
        finished = true;
        image.removeEventListener("load", onLoad);
        image.removeEventListener("error", onError);
        if (timeout !== null) window.clearTimeout(timeout);
        let decoded = loaded;
        if (decoded && typeof image.decode === "function") {
          try {
            await image.decode();
          } catch {
            decoded = false;
          }
        }
        if (element.dataset.source === source) element.hidden = !decoded;
        resolve(decoded);
      };
      const onLoad = () => { void finish(true); };
      const onError = () => { void finish(false); };
      image.addEventListener("load", onLoad, { once: true });
      image.addEventListener("error", onError, { once: true });
      timeout = window.setTimeout(() => { void finish(image.complete && image.naturalWidth > 0); }, 3000);
      image.src = source;
      if (image.complete) queueMicrotask(() => { void finish(image.naturalWidth > 0); });
    });
    return { source, image, promise };
  }

  function applyArtworkLayers(layers) {
    hideLegacyArtwork();
    elements.themeArtLayers.replaceChildren();
    activeLayerLoads = [];
    for (const layer of layers) {
      if (!layer || !safeArtworkPath.test(layer.path)) continue;
      const source = `../${layer.path}`;
      const element = document.createElement("div");
      element.className = "theme-art-layer";
      element.hidden = true;
      element.dataset.source = source;
      element.dataset.artMask = layer.mask === "none" ? "none" : "soft-right";
      element.dataset.artMobile = layer.mobile === "hide" || layer.mobile === "keep" ? layer.mobile : "reduce";
      element.style.setProperty("background-image", `url(${JSON.stringify(source)})`);
      element.style.setProperty("background-position", layer.position || "right center");
      element.style.setProperty("background-size", layer.size || "min(58vw, 860px) auto");
      if (typeof layer.opacity === "number") {
        element.style.setProperty("--preview-art-opacity", String(layer.opacity));
      }
      elements.themeArtLayers.appendChild(element);
      activeLayerLoads.push(preloadArtworkLayer(element, source));
    }
  }

  function applyArtwork(theme) {
    if (Array.isArray(theme.artworkLayers) && theme.artworkLayers.length) {
      applyArtworkLayers(theme.artworkLayers);
      return;
    }

    activeLayerLoads = [];
    elements.themeArtLayers.replaceChildren();
    const artwork = theme.artwork;
    if (!artwork || !safeArtworkPath.test(artwork.path)) {
      hideArtwork();
      return;
    }

    const relativePath = `../${artwork.path}`;
    const alreadyLoaded = elements.themeArt.getAttribute("src") === relativePath
      && elements.themeArt.complete
      && elements.themeArt.naturalWidth > 0;
    elements.themeArt.hidden = !alreadyLoaded;
    elements.themeArt.dataset.source = relativePath;
    elements.themeArt.dataset.fit = artwork.size === "cover" ? "cover" : "contain";
    elements.themeArt.dataset.mobile = artwork.mobile === "hide" ? "hide" : "reduce";
    setVariable("--aura-art-position", artwork.position || "right center");
    if (!alreadyLoaded) elements.themeArt.src = relativePath;
  }

  function updateThemeControls(theme) {
    for (const input of elements.gallery.querySelectorAll('input[name="preview-theme"]')) {
      input.checked = input.value === theme.name;
    }
    elements.activeThemeChip.textContent = theme.label;
    elements.dialogDescription.textContent = `${theme.label}: ${theme.description} Review the elevated surface, focus treatment, and action hierarchy.`;
  }

  function updateModeControl() {
    const isDark = activeMode === "dark";
    elements.modeButton.setAttribute("aria-pressed", String(isDark));
    elements.modeButton.setAttribute("aria-label", `Switch to ${isDark ? "light" : "dark"} mode`);
    elements.modeLabel.textContent = isDark ? "Light mode" : "Dark mode";
    elements.modeIcon.textContent = isDark ? "☀" : "◐";
  }

  function applyTheme({ persist = false } = {}) {
    const theme = getTheme(activeTheme) ?? themes[0];
    if (!theme) return;
    const variant = theme[activeMode] ?? theme.light;
    if (!variant) return;

    activeTheme = theme.name;
    root.setAttribute("data-claude-aura-theme", theme.name);
    root.setAttribute("data-mode", activeMode);
    root.style.colorScheme = activeMode;
    applyThemePrimitives(theme, variant);
    applyArtwork(theme);
    updateThemeControls(theme);
    updateModeControl();
    document.title = `${theme.label} — Claude Aura offline preview`;

    if (persist) {
      writeStored(storageKeys.theme, activeTheme);
      writeStored(storageKeys.mode, activeMode);
    }
    schedulePreviewReady();
  }

  function selectView(viewName, { focus = false } = {}) {
    const targetTab = elements.tabButtons.find((button) => button.dataset.view === viewName);
    if (!targetTab) return;
    for (const button of elements.tabButtons) {
      const selected = button === targetTab;
      button.setAttribute("aria-selected", String(selected));
      button.tabIndex = selected ? 0 : -1;
    }
    for (const view of elements.views) view.hidden = view.id !== `${viewName}-view`;
    elements.viewTitle.textContent = viewName === "code" ? "Code" : "Home";
    elements.viewKicker.textContent = viewName === "code" ? "Developer tools" : "Workspace";
    root.dataset.previewScreen = viewName;
    if (focus) targetTab.focus();
    schedulePreviewReady();
  }

  function setMenuOpen(open, { focusFirst = false } = {}) {
    elements.menu.hidden = !open;
    elements.menuButton.setAttribute("aria-expanded", String(open));
    root.dataset.previewOverlay = open ? "menu" : (elements.dialog.open ? "dialog" : "none");
    if (open && focusFirst) elements.menu.querySelector('[role="menuitem"]')?.focus();
    schedulePreviewReady();
  }

  function showDialog() {
    setMenuOpen(false);
    if (typeof elements.dialog.showModal === "function") elements.dialog.showModal();
    else elements.dialog.setAttribute("open", "");
    root.dataset.previewOverlay = "dialog";
    schedulePreviewReady();
  }

  function setPressed(button, pressed, status) {
    button.setAttribute("aria-pressed", String(pressed));
    elements.composerStatus.textContent = status;
  }

  const storedTheme = readStored(storageKeys.theme);
  const storedMode = readStored(storageKeys.mode);
  const requestedTheme = readQueryValue("theme", (value) => Boolean(getTheme(value)));
  const requestedMode = readQueryValue("mode", (value) => supportedModes.has(value));
  const requestedScreen = readQueryValue("screen", (value) => supportedScreens.has(value));
  const requestedOverlay = readQueryValue("overlay", (value) => supportedOverlays.has(value));
  if (captureMode && [requestedTheme, requestedMode, requestedScreen, requestedOverlay].some((value) => value === null)) {
    throw new Error("Capture URLs require explicit theme, mode, screen, and overlay values");
  }
  if (requestedTheme) activeTheme = requestedTheme;
  else if (storedTheme && getTheme(storedTheme)) activeTheme = storedTheme;
  if (requestedMode) activeMode = requestedMode;
  else if (supportedModes.has(storedMode)) activeMode = storedMode;
  const initialScreen = requestedScreen ?? "home";
  const initialOverlay = requestedOverlay ?? "none";

  elements.themeArt.addEventListener("load", () => {
    if (elements.themeArt.getAttribute("src") === elements.themeArt.dataset.source) {
      elements.themeArt.hidden = false;
      schedulePreviewReady();
    }
  });
  elements.themeArt.addEventListener("error", () => {
    const source = elements.themeArt.getAttribute("src");
    if (!source || source !== elements.themeArt.dataset.source || activeLayerLoads.length) return;
    hideLegacyArtwork();
    schedulePreviewReady();
  });

  buildGallery();
  applyTheme();
  selectView(initialScreen);

  elements.modeButton.addEventListener("click", () => {
    activeMode = activeMode === "light" ? "dark" : "light";
    applyTheme({ persist: true });
  });

  elements.tabButtons.forEach((button, index) => {
    button.addEventListener("click", () => selectView(button.dataset.view));
    button.addEventListener("keydown", (event) => {
      let nextIndex = null;
      if (event.key === "ArrowRight") nextIndex = (index + 1) % elements.tabButtons.length;
      if (event.key === "ArrowLeft") nextIndex = (index - 1 + elements.tabButtons.length) % elements.tabButtons.length;
      if (event.key === "Home") nextIndex = 0;
      if (event.key === "End") nextIndex = elements.tabButtons.length - 1;
      if (nextIndex === null) return;
      event.preventDefault();
      selectView(elements.tabButtons[nextIndex].dataset.view, { focus: true });
    });
  });

  elements.menuButton.addEventListener("click", () => {
    const opening = elements.menu.hidden;
    setMenuOpen(opening, { focusFirst: opening });
  });

  elements.menu.addEventListener("keydown", (event) => {
    const items = [...elements.menu.querySelectorAll('[role="menuitem"]')];
    const index = items.indexOf(document.activeElement);
    if (event.key === "Escape") {
      event.preventDefault();
      setMenuOpen(false);
      elements.menuButton.focus();
    } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const delta = event.key === "ArrowDown" ? 1 : -1;
      items[(index + delta + items.length) % items.length]?.focus();
    }
  });

  document.addEventListener("pointerdown", (event) => {
    if (!elements.menu.hidden && !elements.menu.contains(event.target) && event.target !== elements.menuButton) {
      setMenuOpen(false);
    }
  });

  document.addEventListener("focusin", (event) => {
    if (!elements.menu.hidden && !elements.menu.contains(event.target) && event.target !== elements.menuButton) {
      setMenuOpen(false);
    }
  });

  elements.openDialogButton.addEventListener("click", () => {
    showDialog();
  });

  elements.dialog.addEventListener("close", () => {
    root.dataset.previewOverlay = "none";
    schedulePreviewReady();
    elements.menuButton.focus();
  });

  if (initialOverlay === "menu") setMenuOpen(true);
  else if (initialOverlay === "dialog") showDialog();
  else setMenuOpen(false);

  elements.resetButton.addEventListener("click", () => {
    removeStored(storageKeys.theme);
    removeStored(storageKeys.mode);
    activeTheme = getTheme("default") ? "default" : themes[0]?.name;
    activeMode = "light";
    setMenuOpen(false);
    applyTheme();
    elements.menuButton.focus();
  });

  elements.newTaskButton.addEventListener("click", () => {
    elements.composerInput.value = "";
    elements.composerStatus.textContent = "New illustrative task";
    elements.composerInput.focus();
  });

  elements.quickCards.forEach((card) => {
    card.addEventListener("click", () => {
      const label = card.querySelector("strong")?.textContent ?? "this task";
      elements.composerInput.value = `Help me ${label.toLowerCase()}.`;
      elements.composerStatus.textContent = "Prompt added";
      elements.composerInput.focus();
    });
  });

  elements.workModes.forEach((input) => {
    input.addEventListener("change", () => {
      if (!input.checked) return;
      const isCowork = input.value === "cowork";
      elements.composerInput.placeholder = isCowork ? "Describe a task to work through together…" : "Ask about this interface…";
      elements.composerStatus.textContent = isCowork ? "Cowork example selected" : "Chat example selected";
    });
  });

  elements.micButton.addEventListener("click", () => {
    const pressed = elements.micButton.getAttribute("aria-pressed") !== "true";
    setPressed(elements.micButton, pressed, pressed ? "Microphone example active" : "Microphone example stopped");
  });

  elements.voiceButton.addEventListener("click", () => {
    const pressed = elements.voiceButton.getAttribute("aria-pressed") !== "true";
    setPressed(elements.voiceButton, pressed, pressed ? "Voice mode example active" : "Voice mode example stopped");
  });

  elements.modelSelect.addEventListener("change", () => {
    elements.composerStatus.textContent = `${elements.modelSelect.value} selected`;
  });

  elements.composerForm.addEventListener("submit", (event) => {
    event.preventDefault();
    if (submitTimer) window.clearTimeout(submitTimer);
    elements.sendButton.disabled = true;
    elements.composerStatus.textContent = "Sending illustrative prompt…";
    submitTimer = window.setTimeout(() => {
      elements.sendButton.disabled = false;
      elements.composerStatus.textContent = "Example complete — nothing was sent";
      submitTimer = null;
    }, 900);
  });

  window.addEventListener("resize", () => {
    previewGeneration += 1;
    root.dataset.previewReady = "false";
    elements.qaState.textContent = "Preparing preview…";
    if (resizeTimer !== null) window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      resizeTimer = null;
      schedulePreviewReady();
    }, 80);
  });

  window.__CLAUDE_AURA_PREVIEW__ = Object.freeze({
    getState: () => ({ ...getPreviewState() }),
    whenReady: whenPreviewReady,
  });
})();
