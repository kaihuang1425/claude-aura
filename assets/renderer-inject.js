((cssText, settings) => {
  const STATE_KEY = "__CLAUDE_AURA_STATE__";
  const STYLE_ID = "claude-aura-style";
  const BACKDROP_ID = "claude-aura-backdrop";
  const root = document.documentElement;
  const imageCssValue = settings.imageDataUrl ? `url(${JSON.stringify(settings.imageDataUrl)})` : "none";
  const imageOpacityValue = settings.imageOpacity === null
    ? "var(--aura-default-image-opacity)"
    : String(settings.imageOpacity);
  const imageScaleValue = String(settings.imageZoom || 1);
  const artCssValue = settings.artDataUrl ? `url(${JSON.stringify(settings.artDataUrl)})` : "none";
  const appearance = settings.appearance || "system";
  const media = appearance === "system" ? window.matchMedia?.("(prefers-color-scheme: dark)") : null;
  const mode = () => appearance === "system" ? (media?.matches ? "dark" : "light") : appearance;
  const viewport = () => {
    const screenWide = window.screen?.availWidth > 0 && window.screen?.availHeight > 0
      && window.innerWidth >= window.screen.availWidth - 32
      && window.innerHeight >= window.screen.availHeight - 96;
    return document.fullscreenElement || screenWide || window.innerWidth >= 1440 ? "w" : "n";
  };
  const SIDEBAR_MARKER = "data-claude-aura-sidebar";
  const MAIN_MARKER = "data-claude-aura-main-canvas";
  const PROMPT_MARKER = "data-claude-aura-prompt";
  const BH = "data-claude-aura-brand-host";
  const BF = "data-claude-aura-brand-flow";
  const BN = "data-claude-aura-brand-native";
  const BI = "data-claude-aura-brand-image";
  const MESSAGE_SELECTOR = [
    '[data-testid="user-message"]',
    '[data-testid="assistant-message"]',
    '[data-user-message-bubble]',
    '[data-assistant-message]',
    '[data-message-author-role="user"]',
    '[data-message-author-role="assistant"]',
    '.font-claude-response-body',
  ].join(",");
  const EDITOR_SELECTOR = [
    'textarea:not([readonly])',
    '.ProseMirror[contenteditable="true"]',
    '[role="textbox"][contenteditable="true"]',
  ].join(",");
  const CONTROL_SELECTOR = 'button,[role="button"],select';
  let observeTargets = () => {};
  let styleDirty = true;
  let rootDirty = true;
  let currentContext = "other";
  let artBindings = [];
  let bb = null;
  let bt = 0;

  const visibleRect = (element) => {
    if (!element?.isConnected) return null;
    const rect = element.getBoundingClientRect?.();
    if (!rect || rect.width <= 0 || rect.height <= 0) return null;
    const computed = window.getComputedStyle?.(element) ?? { display: "", visibility: "", translate: "none" };
    return computed.display === "none" || computed.visibility === "hidden" ? null : rect;
  };

  const clearMarkedElements = () => {
    for (const element of document.querySelectorAll?.(`[${SIDEBAR_MARKER}],[${MAIN_MARKER}],[${PROMPT_MARKER}]`) ?? []) {
      element.removeAttribute(SIDEBAR_MARKER);
      element.removeAttribute(MAIN_MARKER);
      element.removeAttribute(PROMPT_MARKER);
      element.style.removeProperty("--aura-prompt-width");
      element.style.removeProperty("--aura-prompt-x");
      element.style.removeProperty("--aura-prompt-y");
    }
  };

  const discoverSidebar = () => {
    const candidates = [...(document.querySelectorAll?.(
      '.dframe-sidebar,aside,[role="navigation"],nav,[data-testid*="sidebar" i]',
    ) ?? [])].map((element) => ({ element, rect: visibleRect(element) }))
      .filter(({ rect }) => rect
        && rect.left <= Math.max(32, window.innerWidth * 0.04)
        && rect.right > 0
        && rect.width >= 40 && rect.width <= Math.min(440, window.innerWidth * 0.46)
        && rect.height >= window.innerHeight * 0.5)
      .sort((left, right) => (right.rect.width * right.rect.height) - (left.rect.width * left.rect.height));
    return candidates[0]?.element ?? null;
  };

  const clearBrand = () => {
    bt += 1;
    if (bb?.image) {
      bb.image.onload = null;
      bb.image.onerror = null;
      bb.image.remove();
    }
    bb?.host?.removeAttribute(BH);
    bb?.host?.removeAttribute(BF);
    for (const element of bb?.native ?? []) element.removeAttribute(BN);
    for (const image of document.querySelectorAll?.(`[${BI}]`) ?? []) image.remove();
    for (const host of document.querySelectorAll?.(`[${BH}]`) ?? []) host.removeAttribute(BH);
    for (const host of document.querySelectorAll?.(`[${BF}]`) ?? []) host.removeAttribute(BF);
    for (const native of document.querySelectorAll?.(`[${BN}]`) ?? []) native.removeAttribute(BN);
    bb = null;
  };

  const findBrand = (sidebar) => {
    if (!Array.isArray(settings.b) || settings.b.length < 2) return null;
    const side = visibleRect(sidebar);
    if (!side || side.width < 208) return null;
    const sel = [
      ".claude-logo",
      '[data-cds="ClaudeLogo"]',
      '[data-testid="claude-logo"]',
      '[data-testid="claude-starburst"]',
      '[data-testid*="claude"][data-testid*="logo"]',
      '[class*="claude"][class*="logo"]',
      '[aria-label="Claude" i]',
    ].join(",");
    const found = new Set(sidebar.querySelectorAll?.(sel) ?? []);
    for (const element of sidebar.querySelectorAll?.("a[href],span") ?? []) {
      if (element.textContent?.trim() === "Claude") found.add(element);
    }
    const inside = (r) => r && r.top >= side.top - 2 && r.top <= side.top + 96
      && r.left >= side.left - 2 && r.right <= side.right + 2;
    const brands = new Set();
    for (const c of found) {
      const b = c.closest?.("a[href]") ?? c;
      if (inside(visibleRect(b))) brands.add(b);
    }
    if (brands.size !== 1) return null;
    const brand = [...brands][0];
    const br = visibleRect(brand);
    const min = Number(settings.b[2]) || 136;
    const width = Number(settings.b[3]) || 160;
    let host = null;
    let hr = null;
    for (let p = brand.parentElement, d = 0; p && p !== sidebar && d < 4; p = p.parentElement, d += 1) {
      const r = visibleRect(p);
      if (inside(r) && r.width >= width && r.height >= 32 && r.height <= 96) {
        host = p;
        hr = r;
        break;
      }
    }
    if (!host) return null;
    const controls = [...(host.querySelectorAll?.(CONTROL_SELECTOR) ?? [])]
      .filter((control) => !brand.contains(control))
      .map(visibleRect)
      .filter((r) => r && r.left > br.left);
    const space = Math.min(hr.right, ...controls.map((r) => r.left)) - br.left - 8;
    if (space < min) return null;
    return {
      host,
      native: [brand],
      offset: br.left - hr.left,
      width: Math.min(width, space),
    };
  };

  const syncBrand = (sidebar) => {
    if (!Array.isArray(settings.b) || settings.b.length < 2) {
      if (bb) clearBrand();
      return;
    }
    const t = findBrand(sidebar);
    const am = mode();
    if (!t) {
      if (bb) clearBrand();
      return;
    }
    if (bb?.host === t.host && bb.native?.[0] === t.native[0]
        && bb.mode === am
        && bb.offset === t.offset && bb.width === t.width
        && bb.image?.isConnected) return;
    clearBrand();
    const im = document.createElement("img");
    const token = ++bt;
    im.alt = "";
    im.draggable = false;
    im.decoding = "async";
    im.setAttribute("aria-hidden", "true");
    im.setAttribute(BI, `${settings.version}:${settings.digest}`);
    im.style.setProperty("inset-inline-start", `${t.offset}px`);
    im.style.setProperty("width", `${t.width}px`);
    bb = { ...t, image: im, mode: am, token, ready: false };
    const fail = () => {
      if (bb?.token === token) clearBrand();
    };
    im.onerror = fail;
    im.onload = () => {
      const decoded = typeof im.decode === "function" ? im.decode() : Promise.resolve();
      Promise.resolve(decoded).then(() => {
        if (bb?.token !== token || !im.isConnected || !t.host.isConnected
            || !im.naturalWidth || mode() !== am
            || findBrand(sidebar)?.native?.[0] !== t.native[0]) return fail();
        if ((window.getComputedStyle?.(t.host)?.position || "static") === "static") {
          t.host.setAttribute(BF, "true");
        }
        t.host.setAttribute(BH, "ready");
        for (const element of t.native) element.setAttribute(BN, "true");
        bb.ready = true;
      }, fail);
    };
    t.host.appendChild(im);
    im.src = settings.b[am === "dark" ? 1 : 0];
  };

  const discoverComposer = () => {
    const roots = new Map();
    const canvases = [...(document.querySelectorAll?.('main,[role="main"]') ?? [])]
      .filter((element) => visibleRect(element));
    for (const canvas of canvases) {
      for (const editor of canvas.querySelectorAll(EDITOR_SELECTOR)) {
        let candidate = editor;
        let prompt = null;
        let promptRect = null;
        for (let depth = 0; candidate && candidate !== canvas && depth < 12; depth += 1, candidate = candidate.parentElement) {
          const rect = visibleRect(candidate);
          if (!rect || rect.width < 280 || rect.height < 72 || rect.height > 300) continue;
          if (candidate.querySelectorAll(CONTROL_SELECTOR).length < 2) continue;
          prompt = candidate;
          promptRect = rect;
        }
        if (prompt) roots.set(prompt, { prompt, main: canvas, rect: promptRect });
      }
    }
    if (roots.size !== 1) return { context: "other", main: canvases.length === 1 ? canvases[0] : null, prompt: null };
    const found = [...roots.values()][0];
    const mainRect = visibleRect(found.main);
    const promptRect = visibleRect(found.prompt);
    if (!mainRect || !promptRect) return { context: "other", main: found.main, prompt: null };
    if (found.main.querySelector(MESSAGE_SELECTOR)) return { ...found, context: "conversation" };
    const bottomGap = mainRect.bottom - promptRect.bottom;
    const threshold = Math.max(56, mainRect.height * 0.08);
    return { ...found, context: bottomGap >= threshold ? "new-chat" : "other" };
  };

  const clearPromptLayout = () => {
    for (const prompt of document.querySelectorAll?.(`[${PROMPT_MARKER}]`) ?? []) {
      prompt.removeAttribute(PROMPT_MARKER);
      prompt.style.removeProperty("--aura-prompt-width");
      prompt.style.removeProperty("--aura-prompt-x");
      prompt.style.removeProperty("--aura-prompt-y");
    }
  };

  const applyPromptLayout = (prompt, main) => {
    clearPromptLayout();
    if (!prompt || !main) return;
    /* Mark native prompts for mirror geometry without authoring layout. */
    prompt.setAttribute(PROMPT_MARKER, "new-chat");
    const layout = settings.n;
    if (!layout) return;
    const mainRect = visibleRect(main);
    if (!mainRect) return;
    const bounds = {
      left: Math.max(0, mainRect.left),
      top: Math.max(0, mainRect.top),
      right: Math.min(window.innerWidth, mainRect.right),
      bottom: Math.min(window.innerHeight, mainRect.bottom),
    };
    bounds.width = bounds.right - bounds.left;
    bounds.height = bounds.bottom - bounds.top;
    if (bounds.width < 480 || bounds.height < 400) return;
    const authoredTranslate = window.getComputedStyle?.(prompt)?.translate ?? "none";
    if (authoredTranslate && !["none", "0px", "0px 0px"].includes(authoredTranslate)) return;
    const inset = 16;
    const width = Math.min(bounds.width - (inset * 2), Math.max(280, bounds.width * layout[0]));
    prompt.style.setProperty("--aura-prompt-width", `${Math.round(width * 100) / 100}px`);
    prompt.style.setProperty("--aura-prompt-x", "0px");
    prompt.style.setProperty("--aura-prompt-y", "0px");
    const rect = visibleRect(prompt);
    if (!rect) return clearPromptLayout();
    const desiredCenter = bounds.left + (bounds.width / 2) + (bounds.width * layout[1]);
    const desiredLeft = Math.min(bounds.right - inset - rect.width, Math.max(bounds.left + inset, desiredCenter - (rect.width / 2)));
    const desiredTop = Math.min(bounds.bottom - inset - rect.height, Math.max(bounds.top + inset, rect.top + (bounds.height * layout[2])));
    prompt.style.setProperty("--aura-prompt-x", `${Math.round((desiredLeft - rect.left) * 100) / 100}px`);
    prompt.style.setProperty("--aura-prompt-y", `${Math.round((desiredTop - rect.top) * 100) / 100}px`);
  };

  const applyArtworkContext = (context) => {
    const view = viewport();
    root.dataset.claudeAuraViewport = view === "w" ? "wide" : "normal";
    const anchors = { tl: [0, 0], t: [50, 0], tr: [100, 0], l: [0, 50], c: [50, 50], r: [100, 50], bl: [0, 100], b: [50, 100], br: [100, 100] };
    for (const { element, image, layer } of artBindings) {
      if (!element.isConnected) continue;
      const contextKey = context === "new-chat" ? "n" : context === "conversation" ? "c" : "o";
      const override = layer.c?.[contextKey] ?? null;
      const hidden = layer.x === 0 || override?.h === true
        || layer.a && layer.a !== mode()[0]
        || layer.t && layer.t !== contextKey
        || layer.v && layer.v !== view;
      element.dataset.artContext = context;
      element.dataset.artViewport = view === "w" ? "wide" : "normal";
      if (image && Array.isArray(layer.n)) {
        const frame = view === "w" && Array.isArray(layer.w) ? layer.w : layer.n;
        const anchorCode = view === "w" ? (layer.z || layer.h || "c") : (layer.h || "c");
        const anchor = anchors[anchorCode] || anchors.c;
        image.style.setProperty("left", `calc(${anchor[0]}% + ${frame[0]}%)`);
        image.style.setProperty("top", `calc(${anchor[1]}% + ${frame[1]}%)`);
        image.style.setProperty("transform", `translate(${-frame[2]}%, ${-frame[3]}%) scale(${frame[4]})`);
        image.style.setProperty("transform-origin", `${frame[2]}% ${frame[3]}%`);
      } else {
        element.style.setProperty("background-position", override?.p ?? layer.p ?? "right center");
        element.style.setProperty("background-size", override?.s ?? layer.s ?? "min(58vw, 860px) auto");
      }
      const opacity = override?.o ?? layer.o;
      if (typeof opacity === "number") {
        element.style.setProperty("--aura-layer-opacity", String(opacity));
        element.style.setProperty("opacity", String(opacity));
      } else {
        element.style.removeProperty("--aura-layer-opacity");
        element.style.removeProperty("opacity");
      }
      if (hidden) element.style.setProperty("display", "none");
      else element.style.removeProperty("display");
    }
  };

  const syncSemanticLayout = () => {
    const found = discoverComposer();
    currentContext = found.context;
    root.dataset.claudeAuraContext = currentContext;
    for (const marked of document.querySelectorAll?.(`[${SIDEBAR_MARKER}]`) ?? []) marked.removeAttribute(SIDEBAR_MARKER);
    const sidebar = discoverSidebar();
    sidebar?.setAttribute(SIDEBAR_MARKER, "true");
    syncBrand(sidebar);
    for (const marked of document.querySelectorAll?.(`[${MAIN_MARKER}]`) ?? []) marked.removeAttribute(MAIN_MARKER);
    found.main?.setAttribute(MAIN_MARKER, "true");
    if (found.main) {
      const value = `${Math.round(found.main.getBoundingClientRect().left)}px`;
      if (root.style.getPropertyValue("--aura-main-start") !== value) root.style.setProperty("--aura-main-start", value);
    } else root.style.removeProperty("--aura-main-start");
    if (currentContext === "new-chat") applyPromptLayout(found.prompt, found.main);
    else clearPromptLayout();
    applyArtworkContext(currentContext);
  };

  const previous = window[STATE_KEY];
  previous?.observer?.disconnect();
  previous?.stopModeListener?.();
  previous?.stopContextListeners?.();
  previous?.clearBrandWordmark?.();
  previous?.clearMarkedElements?.();
  if (previous?.timer) clearInterval(previous.timer);
  if (previous?.scheduled) clearTimeout(previous.scheduled);
  document.getElementById(BACKDROP_ID)?.remove();

  const onModeChange = () => {
    if (document.documentElement) document.documentElement.dataset.claudeAuraEffectiveMode = mode();
    applyArtworkContext(currentContext);
    syncBrand(discoverSidebar());
  };
  media?.addEventListener?.("change", onModeChange);
  const stopModeListener = () => media?.removeEventListener?.("change", onModeChange);

  const ensure = () => {
    if (!document.documentElement || window.__CLAUDE_AURA_DISABLED__) return;
    const html = document.documentElement;
    const rootIdentityChanged = html.dataset.claudeAuraDigest !== settings.digest
      || html.dataset.claudeAuraTheme !== settings.theme
      || html.dataset.claudeAuraVariant !== (settings.variant || settings.theme)
      || html.dataset.claudeAuraArtMobile !== (settings.artMobile || "reduce")
      || html.dataset.claudeAuraAppearance !== appearance
      || html.dataset.claudeAuraEffectiveMode !== mode()
      || html.dataset.claudeAuraContext !== currentContext
      || !html.classList.contains("claude-aura")
      || html.classList.contains("claude-aura-reduce-motion") !== Boolean(settings.reduceMotion)
      || html.classList.contains("claude-aura-animated-image") !== Boolean(settings.imageAnimated);
    if (rootIdentityChanged) rootDirty = true;
    if (rootDirty) {
      html.classList.add("claude-aura");
      html.classList.toggle("claude-aura-reduce-motion", Boolean(settings.reduceMotion));
      html.classList.toggle("claude-aura-animated-image", Boolean(settings.imageAnimated));
      html.dataset.claudeAuraTheme = settings.theme;
      html.dataset.claudeAuraVariant = settings.variant || settings.theme;
      html.dataset.claudeAuraArtMobile = settings.artMobile || "reduce";
      html.dataset.claudeAuraAppearance = appearance;
      html.dataset.claudeAuraEffectiveMode = mode();
      html.dataset.claudeAuraContext = currentContext;
      html.dataset.claudeAuraDigest = settings.digest;
      html.style.setProperty("--aura-image", imageCssValue);
      html.style.setProperty("--aura-image-opacity", imageOpacityValue);
      html.style.setProperty("--aura-image-position", settings.imagePosition || "center");
      html.style.setProperty("--aura-image-scale", imageScaleValue);
      html.style.setProperty("--aura-theme-art", artCssValue);
      html.style.setProperty("--aura-art-position", settings.artPosition || "right center");
      html.style.setProperty("--aura-art-size", settings.artSize || "min(58vw, 860px) auto");
      rootDirty = false;
    }

    let style = document.getElementById(STYLE_ID);
    if (style && String(style.tagName || style.nodeName || "style").toLowerCase() !== "style") {
      style.remove();
      style = null;
      styleDirty = true;
    }
    if (!style) {
      style = document.createElement("style");
      style.id = STYLE_ID;
      (document.head || html).appendChild(style);
    }
    if (style.dataset.digest !== settings.digest || styleDirty) {
      if (style.textContent !== cssText) style.textContent = cssText;
      style.dataset.digest = settings.digest;
      style.dataset.version = settings.version;
      styleDirty = false;
    }

    if (!document.body) return;
    let backdrop = document.getElementById(BACKDROP_ID);
    const backdropOwner = `${settings.version}:${settings.digest}`;
    if (backdrop && backdrop.dataset.claudeAuraOwned !== backdropOwner) {
      backdrop.remove();
      backdrop = null;
    }
    if (!backdrop) {
      backdrop = document.createElement("div");
      backdrop.id = BACKDROP_ID;
      backdrop.dataset.claudeAuraOwned = backdropOwner;
      backdrop.setAttribute("aria-hidden", "true");
      const addLayerDiv = (className) => {
        const element = document.createElement("div");
        element.setAttribute("class", className);
        backdrop.appendChild(element);
        return element;
      };
      addLayerDiv("claude-aura-gradient");
      addLayerDiv("claude-aura-image");
      const artLayers = Array.isArray(settings.artLayers)
        ? settings.artLayers.filter((layer) => layer && (typeof layer.d === "string" || Number.isInteger(layer.d))).slice(0, 8)
        : [];
      if (artLayers.length) {
        artBindings = [];
        for (const layer of artLayers) {
          const element = addLayerDiv("claude-aura-theme-art claude-aura-theme-art-layer");
          element.dataset.artMask = layer.k === "n" ? "none" : "soft-right";
          element.dataset.artMobile = layer.m === "h" ? "hide" : layer.m === "k" ? "keep" : "reduce";
          element.dataset.artRole = layer.r === "b" ? "background" : layer.r === "h" ? "hero" : layer.r === "c" ? "corner" : "decoration";
          const dataUrl = Number.isInteger(layer.d) ? settings.u?.[layer.d] : layer.d;
          if (typeof dataUrl !== "string") continue;
          let frameImage = null;
          if (Array.isArray(layer.n)) {
            element.dataset.artFramed = "true";
            frameImage = document.createElement("img");
            frameImage.alt = "";
            frameImage.setAttribute("aria-hidden", "true");
            frameImage.src = dataUrl;
            element.appendChild(frameImage);
          } else {
            element.style.setProperty("background-image", `url(${JSON.stringify(dataUrl)})`);
            element.style.setProperty("background-position", layer.p || "right center");
            element.style.setProperty("background-size", layer.s || "min(58vw, 860px) auto");
          }
          if (typeof layer.o === "number") {
            element.style.setProperty("--aura-layer-opacity", String(layer.o));
            element.style.setProperty("opacity", String(layer.o));
          }
          artBindings.push({ element, image: frameImage, layer });
        }
      } else {
        artBindings = [];
        addLayerDiv("claude-aura-theme-art");
      }
      addLayerDiv("claude-aura-grain");
      addLayerDiv("claude-aura-vignette");
      backdrop.dataset.artScope = settings.q === "c" ? "content" : "full-window";
      document.body.prepend(backdrop);
    }
    syncSemanticLayout();
    observeTargets();
  };

  const cleanup = () => {
    window.__CLAUDE_AURA_DISABLED__ = true;
    const state = window[STATE_KEY];
    state?.observer?.disconnect();
    if (state?.timer) clearInterval(state.timer);
    if (state?.scheduled) clearTimeout(state.scheduled);
    stopModeListener();
    stopContextListeners();
    clearBrand();
    clearMarkedElements();
    document.getElementById(STYLE_ID)?.remove();
    document.getElementById(BACKDROP_ID)?.remove();
    const html = document.documentElement;
    html?.classList.remove("claude-aura", "claude-aura-reduce-motion", "claude-aura-animated-image");
    html?.style.removeProperty("--aura-image");
    html?.style.removeProperty("--aura-image-opacity");
    html?.style.removeProperty("--aura-image-position");
    html?.style.removeProperty("--aura-image-scale");
    html?.style.removeProperty("--aura-theme-art");
    html?.style.removeProperty("--aura-art-position");
    html?.style.removeProperty("--aura-art-size");
    html?.style.removeProperty("--aura-main-start");
    if (html?.dataset) {
      delete html.dataset.claudeAuraTheme;
      delete html.dataset.claudeAuraVariant;
      delete html.dataset.claudeAuraArtMobile;
      delete html.dataset.claudeAuraAppearance;
      delete html.dataset.claudeAuraEffectiveMode;
      delete html.dataset.claudeAuraContext;
      delete html.dataset.claudeAuraViewport;
      delete html.dataset.claudeAuraDigest;
    }
    delete window[STATE_KEY];
    return true;
  };

  window.__CLAUDE_AURA_DISABLED__ = false;
  let scheduled = null;
  const scheduleEnsure = () => {
    if (scheduled) clearTimeout(scheduled);
    scheduled = setTimeout(() => {
      scheduled = null;
      const state = window[STATE_KEY];
      if (state) state.scheduled = null;
      ensure();
    }, 160);
    const state = window[STATE_KEY];
    if (state) state.scheduled = scheduled;
  };
  const onContextSignal = () => scheduleEnsure();
  window.addEventListener("popstate", onContextSignal);
  window.addEventListener("resize", onContextSignal, { passive: true });
  document.addEventListener?.("fullscreenchange", onContextSignal);
  window.navigation?.addEventListener?.("currententrychange", onContextSignal);
  const stopContextListeners = () => {
    window.removeEventListener("popstate", onContextSignal);
    window.removeEventListener("resize", onContextSignal);
    document.removeEventListener?.("fullscreenchange", onContextSignal);
    window.navigation?.removeEventListener?.("currententrychange", onContextSignal);
  };
  let observedHead = null;
  let observedBody = null;
  let observedStyle = null;
  let observedBackdrop = null;
  const rootNeedsRepair = () => root.dataset.claudeAuraDigest !== settings.digest
    || root.dataset.claudeAuraTheme !== settings.theme
    || root.dataset.claudeAuraVariant !== (settings.variant || settings.theme)
    || root.dataset.claudeAuraArtMobile !== (settings.artMobile || "reduce")
    || root.dataset.claudeAuraAppearance !== appearance
    || root.dataset.claudeAuraEffectiveMode !== mode()
    || root.dataset.claudeAuraContext !== currentContext
    || !root.classList.contains("claude-aura")
    || root.classList.contains("claude-aura-reduce-motion") !== Boolean(settings.reduceMotion)
    || root.classList.contains("claude-aura-animated-image") !== Boolean(settings.imageAnimated)
    || root.style.getPropertyValue("--aura-image") !== imageCssValue
    || root.style.getPropertyValue("--aura-image-opacity") !== imageOpacityValue
    || root.style.getPropertyValue("--aura-image-position") !== (settings.imagePosition || "center")
    || root.style.getPropertyValue("--aura-image-scale") !== imageScaleValue
    || root.style.getPropertyValue("--aura-theme-art") !== artCssValue
    || root.style.getPropertyValue("--aura-art-position") !== (settings.artPosition || "right center")
    || root.style.getPropertyValue("--aura-art-size") !== (settings.artSize || "min(58vw, 860px) auto");
  const observer = new MutationObserver((records) => {
    const style = document.getElementById(STYLE_ID);
    const backdrop = document.getElementById(BACKDROP_ID);
    const needsEnsure = records.some((record) => {
      if (record.target === document.documentElement) {
        if (record.type === "childList") return true;
        if (rootNeedsRepair()) {
          rootDirty = true;
          return true;
        }
        return false;
      }
      if (record.target === document.head && style !== observedStyle) {
        styleDirty = true;
        return true;
      }
      if (record.target === document.body || document.body?.contains?.(record.target)) {
        if (backdrop !== observedBackdrop) return true;
        if (record.type === "childList") return true;
      }
      if (style && (record.target === style || style.contains(record.target)) && style.textContent !== cssText) {
        styleDirty = true;
        return true;
      }
      return false;
    });
    if (needsEnsure) scheduleEnsure();
  });
  observeTargets = () => {
    const head = document.head;
    const body = document.body;
    const style = document.getElementById(STYLE_ID);
    const backdrop = document.getElementById(BACKDROP_ID);
    if (head === observedHead && body === observedBody && style === observedStyle && backdrop === observedBackdrop) return;
    observer.disconnect();
    observer.observe(document.documentElement, {
      childList: true,
      attributes: true,
      attributeFilter: ["class", "style", "data-claude-aura-theme", "data-claude-aura-variant", "data-claude-aura-art-mobile", "data-claude-aura-appearance", "data-claude-aura-effective-mode", "data-claude-aura-context", "data-claude-aura-digest"],
    });
    if (head) observer.observe(head, { childList: true });
    if (body) observer.observe(body, { childList: true, subtree: true });
    if (style) observer.observe(style, { childList: true, characterData: true, subtree: true });
    observedHead = head;
    observedBody = body;
    observedStyle = style;
    observedBackdrop = backdrop;
  };
  const timer = setInterval(ensure, 1500);
  window[STATE_KEY] = {
    cleanup,
    ensure,
    observer,
    timer,
    scheduled,
    stopModeListener,
    stopContextListeners,
    clearBrandWordmark: clearBrand,
    clearMarkedElements,
    version: settings.version,
    theme: settings.theme,
    digest: settings.digest,
  };
  ensure();
  return { installed: true, version: settings.version, theme: settings.theme, digest: settings.digest };
})(__AURA_CSS_JSON__, __AURA_SETTINGS_JSON__)
