((cssText, settings) => {
  "use strict";
  if (window.top !== window) return;
  const hostname = location.hostname.toLowerCase();
  if (location.protocol !== "https:"
      || (hostname !== "claude.ai" && !hostname.endsWith(".claude.ai"))) return;
  // RemoveScriptToExecuteOnDocumentCreated can fail during a WebView2 update.
  // If two Aura generations then execute in the same new document, retire the
  // older listener before this generation takes ownership of the passive shell.
  try {
    window.__CLAUDE_AURA_PREPAINT__?.cleanup?.();
  } catch {
    // A page-defined collision must never block navigation or the full renderer.
  }

  if (Array.isArray(settings.C)) {
    for (let index = settings.C.length - 1; index >= 0; index -= 1) {
      cssText = cssText.replaceAll(String.fromCharCode(0x0100 + index), settings.C[index]);
    }
    delete settings.C;
  }

  const STYLE_ID = "claude-aura-style";
  const BACKDROP_ID = "claude-aura-backdrop";
  const PREPAINT_KEY = "__CLAUDE_AURA_PREPAINT__";
  const appearance = settings.a || "system";
  const darkMedia = appearance === "system"
    ? window.matchMedia?.("(prefers-color-scheme: dark)")
    : null;
  const mode = () => appearance === "system"
    ? (darkMedia?.matches ? "dark" : "light")
    : appearance;
  const context = /^\/chat(?:\/|$)/.test(location.pathname)
    ? "conversation"
    : (/^\/(?:new(?:\/|$))?$/.test(location.pathname) ? "new-chat" : "other");
  const viewport = () => {
    const screenWide = window.screen?.availWidth > 0 && window.screen?.availHeight > 0
      && window.innerWidth >= window.screen.availWidth - 32
      && window.innerHeight >= window.screen.availHeight - 96;
    return document.fullscreenElement || screenWide || window.innerWidth >= 1440 ? "w" : "n";
  };
  const imageCssValue = settings.i ? `url(${JSON.stringify(settings.i)})` : "none";
  const imageOpacityValue = settings.o === null || settings.o === undefined
    ? "var(--aura-default-image-opacity)"
    : String(settings.o);
  const artCssValue = settings.d ? `url(${JSON.stringify(settings.d)})` : "none";
  const owner = `${settings.v}:${settings.x}:prepaint`;
  let disposed = false;

  const applyRoot = () => {
    if (disposed || !document.documentElement) return;
    const root = document.documentElement;
    root.classList.add("claude-aura");
    root.classList.toggle("claude-aura-reduce-motion", Boolean(settings.h));
    root.classList.toggle("claude-aura-animated-image", Boolean(settings.j));
    root.dataset.claudeAuraTheme = settings.t;
    root.dataset.claudeAuraVariant = settings.r || settings.t;
    root.dataset.claudeAuraArtMobile = settings.l || "reduce";
    root.dataset.claudeAuraAppearance = appearance;
    root.dataset.claudeAuraEffectiveMode = mode();
    root.dataset.claudeAuraContext = context;
    root.dataset.claudeAuraDigest = settings.x;
    root.dataset.claudeAuraViewport = viewport() === "w" ? "wide" : "normal";
    root.style.setProperty("--aura-image", imageCssValue);
    root.style.setProperty("--aura-image-opacity", imageOpacityValue);
    root.style.setProperty("--aura-image-position", settings.p || "center");
    root.style.setProperty("--aura-image-scale", String(settings.z || 1));
    root.style.setProperty("--aura-theme-art", artCssValue);
    root.style.setProperty("--aura-art-position", settings.e || "right center");
    root.style.setProperty("--aura-art-size", settings.f || "min(58vw, 860px) auto");

    let style = document.getElementById(STYLE_ID);
    if (style && String(style.tagName || style.nodeName || "").toLowerCase() !== "style") {
      style.remove();
      style = null;
    }
    if (!style) {
      style = document.createElement("style");
      style.id = STYLE_ID;
    }
    const styleHost = document.head || root;
    if (style.parentNode !== styleHost) styleHost.appendChild(style);
    if (style.textContent !== cssText) style.textContent = cssText;
    style.dataset.digest = settings.x;
    style.dataset.version = settings.v;
    style.dataset.claudeAuraPrepaint = "true";
  };

  const applyArtworkContext = (bindings) => {
    const view = viewport();
    const contextKey = context === "new-chat" ? "n" : context === "conversation" ? "c" : "o";
    const anchors = {
      tl: [0, 0], t: [50, 0], tr: [100, 0],
      l: [0, 50], c: [50, 50], r: [100, 50],
      bl: [0, 100], b: [50, 100], br: [100, 100],
    };
    for (const { element, image, layer } of bindings) {
      const override = layer.c?.[contextKey] ?? null;
      const hidden = layer.x === 0 || override?.h === true
        || (layer.a && layer.a !== mode()[0])
        || (layer.t && layer.t !== contextKey)
        || (layer.v && layer.v !== view);
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
      }
      if (hidden) element.style.setProperty("display", "none");
      if (Array.isArray(layer.f) && layer.f.length === 5) {
        element.style.setProperty("filter", `hue-rotate(${layer.f[0]}deg) saturate(${layer.f[1]}) brightness(${layer.f[2]}) contrast(${layer.f[3]}) blur(${layer.f[4]}px)`);
      }
    }
  };

  const mountBackdrop = () => {
    if (disposed || !document.body) return;
    let backdrop = document.getElementById(BACKDROP_ID);
    if (backdrop && backdrop.dataset.claudeAuraOwned !== owner) {
      backdrop.remove();
      backdrop = null;
    }
    if (backdrop) return;

    backdrop = document.createElement("div");
    backdrop.id = BACKDROP_ID;
    backdrop.dataset.claudeAuraOwned = owner;
    backdrop.dataset.claudeAuraPrepaint = "true";
    backdrop.dataset.artScope = settings.q === "s"
      ? "sidebar"
      : settings.q === "c" ? "content" : "full-window";
    backdrop.setAttribute("aria-hidden", "true");
    const addLayer = (className) => {
      const element = document.createElement("div");
      element.className = className;
      backdrop.appendChild(element);
      return element;
    };
    addLayer("claude-aura-gradient");
    addLayer("claude-aura-image");

    const artLayers = Array.isArray(settings.y)
      ? settings.y.filter((layer) =>
        layer && (typeof layer.d === "string" || Number.isInteger(layer.d))).slice(0, 8)
      : [];
    const bindings = [];
    if (artLayers.length) {
      for (const layer of artLayers) {
        const element = addLayer("claude-aura-theme-art claude-aura-theme-art-layer");
        element.dataset.artMask = layer.k === "n" ? "none" : "soft-right";
        element.dataset.artMobile = layer.m === "h" ? "hide" : layer.m === "k" ? "keep" : "reduce";
        element.dataset.artRole = layer.r === "b"
          ? "background"
          : layer.r === "h" ? "hero" : layer.r === "c" ? "corner" : "decoration";
        const dataUrl = Number.isInteger(layer.d) ? settings.u?.[layer.d] : layer.d;
        if (typeof dataUrl !== "string") continue;
        let image = null;
        if (Array.isArray(layer.n)) {
          element.dataset.artFramed = "true";
          image = document.createElement("img");
          image.alt = "";
          image.decoding = "sync";
          image.draggable = false;
          image.setAttribute("aria-hidden", "true");
          image.src = dataUrl;
          element.appendChild(image);
        } else {
          element.style.setProperty("background-image", `url(${JSON.stringify(dataUrl)})`);
        }
        bindings.push({ element, image, layer });
      }
    } else {
      addLayer("claude-aura-theme-art");
    }
    addLayer("claude-aura-grain");
    addLayer("claude-aura-vignette");
    applyArtworkContext(bindings);
    document.body.prepend(backdrop);
  };

  const stage = () => {
    applyRoot();
    mountBackdrop();
  };
  const handoff = () => {
    if (disposed) return false;
    disposed = true;
    document.removeEventListener("readystatechange", stage);
    document.removeEventListener("DOMContentLoaded", stage);
    delete window[PREPAINT_KEY];
    return true;
  };
  const cleanup = () => {
    if (window.__CLAUDE_AURA_STATE__) {
      delete window[PREPAINT_KEY];
      return false;
    }
    handoff();
    const style = document.getElementById(STYLE_ID);
    if (style?.dataset.claudeAuraPrepaint === "true") style.remove();
    const backdrop = document.getElementById(BACKDROP_ID);
    if (backdrop?.dataset.claudeAuraPrepaint === "true") backdrop.remove();
    const root = document.documentElement;
    root?.classList.remove("claude-aura", "claude-aura-reduce-motion", "claude-aura-animated-image");
    for (const property of [
      "--aura-image", "--aura-image-opacity", "--aura-image-position", "--aura-image-scale",
      "--aura-theme-art", "--aura-art-position", "--aura-art-size",
    ]) root?.style.removeProperty(property);
    if (root?.dataset) {
      for (const key of [
        "claudeAuraTheme", "claudeAuraVariant", "claudeAuraArtMobile", "claudeAuraAppearance",
        "claudeAuraEffectiveMode", "claudeAuraContext", "claudeAuraDigest", "claudeAuraViewport",
      ]) delete root.dataset[key];
    }
    delete window[PREPAINT_KEY];
    return true;
  };

  window[PREPAINT_KEY] = Object.freeze({
    version: 1,
    digest: settings.x,
    handoff,
    cleanup,
  });
  document.addEventListener("readystatechange", stage);
  document.addEventListener("DOMContentLoaded", stage, { once: true });
  stage();
})(__AURA_CSS_JSON__, __AURA_SETTINGS_JSON__)
