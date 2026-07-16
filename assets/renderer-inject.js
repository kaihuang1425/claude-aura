((cssText, settings) => {
  const STATE_KEY = "__CLAUDE_AURA_STATE__";
  const STYLE_ID = "claude-aura-style";
  const BACKDROP_ID = "claude-aura-backdrop";
  const root = document.documentElement;
  const imageCssValue = settings.imageDataUrl ? `url(${JSON.stringify(settings.imageDataUrl)})` : "none";
  const imageOpacityValue = settings.imageOpacity === null
    ? "var(--aura-default-image-opacity)"
    : String(settings.imageOpacity);
  const artCssValue = settings.artDataUrl ? `url(${JSON.stringify(settings.artDataUrl)})` : "none";
  let observeTargets = () => {};
  let styleDirty = true;
  let rootDirty = true;

  const previous = window[STATE_KEY];
  previous?.observer?.disconnect();
  if (previous?.timer) clearInterval(previous.timer);
  if (previous?.scheduled) clearTimeout(previous.scheduled);

  const ensure = () => {
    if (!document.documentElement || window.__CLAUDE_AURA_DISABLED__) return;
    const html = document.documentElement;
    const rootIdentityChanged = html.dataset.claudeAuraDigest !== settings.digest
      || html.dataset.claudeAuraTheme !== settings.theme
      || html.dataset.claudeAuraVariant !== (settings.variant || settings.theme)
      || html.dataset.claudeAuraArtMobile !== (settings.artMobile || "reduce")
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
      html.dataset.claudeAuraDigest = settings.digest;
      html.style.setProperty("--aura-image", imageCssValue);
      html.style.setProperty("--aura-image-opacity", imageOpacityValue);
      html.style.setProperty("--aura-image-position", settings.imagePosition || "center");
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
    if (backdrop && backdrop.dataset.claudeAuraOwned !== settings.version) {
      backdrop.remove();
      backdrop = null;
    }
    if (!backdrop) {
      backdrop = document.createElement("div");
      backdrop.id = BACKDROP_ID;
      backdrop.dataset.claudeAuraOwned = settings.version;
      backdrop.setAttribute("aria-hidden", "true");
      backdrop.innerHTML = [
        '<div class="claude-aura-gradient"></div>',
        '<div class="claude-aura-image"></div>',
        '<div class="claude-aura-theme-art"></div>',
        '<div class="claude-aura-grain"></div>',
        '<div class="claude-aura-vignette"></div>',
      ].join("");
      document.body.prepend(backdrop);
    }
    observeTargets();
  };

  const cleanup = () => {
    window.__CLAUDE_AURA_DISABLED__ = true;
    const state = window[STATE_KEY];
    state?.observer?.disconnect();
    if (state?.timer) clearInterval(state.timer);
    if (state?.scheduled) clearTimeout(state.scheduled);
    document.getElementById(STYLE_ID)?.remove();
    document.getElementById(BACKDROP_ID)?.remove();
    const html = document.documentElement;
    html?.classList.remove("claude-aura", "claude-aura-reduce-motion", "claude-aura-animated-image");
    html?.style.removeProperty("--aura-image");
    html?.style.removeProperty("--aura-image-opacity");
    html?.style.removeProperty("--aura-image-position");
    html?.style.removeProperty("--aura-theme-art");
    html?.style.removeProperty("--aura-art-position");
    html?.style.removeProperty("--aura-art-size");
    if (html?.dataset) {
      delete html.dataset.claudeAuraTheme;
      delete html.dataset.claudeAuraVariant;
      delete html.dataset.claudeAuraArtMobile;
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
  let observedHead = null;
  let observedBody = null;
  let observedStyle = null;
  let observedBackdrop = null;
  const rootNeedsRepair = () => root.dataset.claudeAuraDigest !== settings.digest
    || root.dataset.claudeAuraTheme !== settings.theme
    || root.dataset.claudeAuraVariant !== (settings.variant || settings.theme)
    || root.dataset.claudeAuraArtMobile !== (settings.artMobile || "reduce")
    || !root.classList.contains("claude-aura")
    || root.classList.contains("claude-aura-reduce-motion") !== Boolean(settings.reduceMotion)
    || root.classList.contains("claude-aura-animated-image") !== Boolean(settings.imageAnimated)
    || root.style.getPropertyValue("--aura-image") !== imageCssValue
    || root.style.getPropertyValue("--aura-image-opacity") !== imageOpacityValue
    || root.style.getPropertyValue("--aura-image-position") !== (settings.imagePosition || "center")
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
      if (record.target === document.body) return backdrop !== observedBackdrop;
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
      attributeFilter: ["class", "style", "data-claude-aura-theme", "data-claude-aura-variant", "data-claude-aura-art-mobile", "data-claude-aura-digest"],
    });
    if (head) observer.observe(head, { childList: true });
    if (body) observer.observe(body, { childList: true });
    if (style) observer.observe(style, { childList: true, characterData: true, subtree: true });
    observedHead = head;
    observedBody = body;
    observedStyle = style;
    observedBackdrop = backdrop;
  };
  const timer = setInterval(ensure, 4000);
  window[STATE_KEY] = {
    cleanup,
    ensure,
    observer,
    timer,
    scheduled,
    version: settings.version,
    theme: settings.theme,
    digest: settings.digest,
  };
  ensure();
  return { installed: true, version: settings.version, theme: settings.theme, digest: settings.digest };
})(__AURA_CSS_JSON__, __AURA_SETTINGS_JSON__)
