((cssText, settings) => {
  __AURA_RENDERER_WINDOW__.__CLAUDE_AURA_PREPAINT__?.handoff?.();
  /*__AURA_CODE_ACTIVE_START__*/
  const $w = __AURA_CODE_WINDOW__, $d = __AURA_CODE_DOCUMENT__;
  /*__AURA_CODE_ACTIVE_END__*/
  if (Array.isArray(settings.C)) {
    for (let index = settings.C.length - 1; index >= 0; index -= 1) {
      cssText = cssText.replaceAll(String.fromCharCode(0x0100 + index), settings.C[index]);
    }
    delete settings.C;
  }
  const STATE_KEY = "__CLAUDE_AURA_STATE__", STYLE_ID = "claude-aura-style",
    BACKDROP_ID = "claude-aura-backdrop", root = document.documentElement;
  const imageCssValue = settings.imageDataUrl ? `url(${JSON.stringify(settings.imageDataUrl)})` : "none",
    imageOpacityValue = settings.imageOpacity === null
    ? "var(--aura-default-image-opacity)"
    : String(settings.imageOpacity), imageScaleValue = String(settings.imageZoom || 1);
  const artCssValue = settings.artDataUrl ? `url(${JSON.stringify(settings.artDataUrl)})` : "none",
    appearance = settings.appearance || "system",
    media = appearance === "system" ? window.matchMedia?.("(prefers-color-scheme: dark)") : null,
    forcedColors = window.matchMedia?.("(forced-colors: active)") ?? null,
    mode = () => appearance === "system" ? (media?.matches ? "dark" : "light") : appearance;
  const viewport = () => {
    const screenWide = window.screen?.availWidth > 0 && window.screen?.availHeight > 0
      && window.innerWidth >= window.screen.availWidth - 32
      && window.innerHeight >= window.screen.availHeight - 96;
    return document.fullscreenElement || screenWide || window.innerWidth >= 1440 ? "w" : "n";
  };
  let responsiveTrack = null, responsiveValue = null, responsiveLayoutId = null;
  /*__AURA_RESPONSIVE_START__*/
  if (Array.isArray(settings.R) && settings.R.length === 4) {
    const responsiveResolver = __AURA_RESPONSIVE_FACTORY__();
    responsiveTrack = {
      "mode": settings.R[0] === "f" ? "fluid" : "step",
      "ids": settings.R[1],
      "widths": settings.R[2],
      "breakpoints": settings.R[3],
    };
    responsiveValue = (frames, inherited, fields, precisions = {}) => {
      const asObject = (tuple) => tuple
        ? Object.fromEntries(fields.flatMap((field, index) => (
          typeof tuple[index] === "number" && Number.isFinite(tuple[index])
            ? [[field, tuple[index]]]
            : []
        )))
        : null;
      return responsiveResolver(
        responsiveTrack,
        frames.map(asObject),
        window.innerWidth,
        asObject(inherited),
        precisions,
      );
    };
    responsiveLayoutId = () => {
      let index = 0;
      if (responsiveTrack["mode"] === "step") {
        while (index < responsiveTrack["breakpoints"].length
            && window.innerWidth >= responsiveTrack["breakpoints"][index]) index += 1;
      } else {
        let distance = Infinity;
        responsiveTrack["widths"].forEach((width, candidate) => {
          const next = Math.abs(window.innerWidth - width);
          if (next < distance) index = candidate, distance = next;
        });
      }
      return responsiveTrack["ids"][index];
    };
  }
  /*__AURA_RESPONSIVE_END__*/
  const codeContextFromUrl = __AURA_CODE_CONTEXT_FACTORY__;
  const codeRouteContext = () => codeContextFromUrl(window.location);
  const codeAdapter = __AURA_CODE_ADAPTER_FACTORY__(
    /*__AURA_CODE_ACTIVE_START__*/
    [document, window.getComputedStyle?.bind(window), mode],
    __AURA_CODE_SIGNATURES__
    /*__AURA_CODE_ACTIVE_END__*/
  );
  const SIDEBAR_MARKER = "data-claude-aura-sidebar";
  const MAIN_MARKER = "data-claude-aura-main-canvas";
  const PROMPT_MARKER = "data-claude-aura-prompt";
  const RM = "data-aura-role", FM = "data-aura-f", PM = "data-aura-bg";
  const R = Object.freeze([
    "sidebar-primary", "sidebar-row", "sidebar-section", "sidebar-list", "sidebar-footer",
    "composer-shell", "composer-editor", "composer-toolbar",
    "control-icon", "control-pill", "control-toggle",
  ]);
  const BH = "data-claude-aura-brand-host", BF = "data-claude-aura-brand-flow",
    BN = "data-claude-aura-brand-native", BI = "data-claude-aura-brand-image",
    BL = "data-claude-aura-brand-loader";
  const MESSAGE_SELECTOR = [
    '[data-testid="user-message"]',
    '[data-testid="assistant-message"]',
    '[data-user-message-bubble]',
    '[data-assistant-message]',
    '[data-message-author-role="user"]',
    '[data-message-author-role="assistant"]',
    '.font-claude-response-body',
  ].join(","), EDITOR_SELECTOR = [
    'textarea:not([readonly])',
    '.ProseMirror[contenteditable="true"]',
    '[role="textbox"][contenteditable="true"]',
  ].join(","), CONTROL_SELECTOR = 'button,[role="button"],[role="switch"],[role="combobox"],select';
  let observeTargets = () => {}, styleDirty = true, rootDirty = true, currentContext = "other";
  /*__AURA_CODE_ACTIVE_START__*/
  let codeCleanupRetry = 0;
  /*__AURA_CODE_ACTIVE_END__*/
  let artBindings = [];
  let bb = null;
  let bt = 0;
  let av = null;
  let avt = 0;
  let syncAvatar, clearAvatar;
  let syncGreeting, clearGreeting, advanceGreetingVisit, greetingMemory, greetingMatches = -1;
  /*__AURA_INSTANT_PROMPTS_START__*/
  let syncInstantPrompts, clearInstantPrompts;
  const instantPromptController = __AURA_INSTANT_PROMPTS_FACTORY__(document, window, settings, {
    "track": responsiveTrack,
    "value": responsiveValue,
  });
  syncInstantPrompts = instantPromptController.sync;
  clearInstantPrompts = instantPromptController.clear;
  /*__AURA_INSTANT_PROMPTS_END__*/
  let getGreetingProbe = () => ({
    version: 1,
    digest: settings.digest,
    context: currentContext,
    status: "inactive",
    candidateCount: -1,
    source: "inactive",
    nativeConnected: false,
    replacementConnected: false,
    replacementVisible: false,
    nativeHidden: false,
    visitEpoch: 0,
    shuffle: null,
    rect: null,
  });

  const visibleRect = (element) => {
    if (!element?.isConnected) return null;
    const rect = element.getBoundingClientRect?.();
    if (!rect || rect.width <= 0 || rect.height <= 0) return null;
    const computed = window.getComputedStyle?.(element) ?? { display: "", visibility: "", translate: "none" };
    return computed.display === "none" || computed.visibility === "hidden" ? null : rect;
  };

  const clearMarks = () => {
    for (const element of document.querySelectorAll?.(
      `[${SIDEBAR_MARKER}],[${MAIN_MARKER}],[${PROMPT_MARKER}],[${RM}],[${FM}],[${PM}]`,
    ) ?? []) {
      element.removeAttribute(SIDEBAR_MARKER);
      element.removeAttribute(MAIN_MARKER);
      element.removeAttribute(PROMPT_MARKER);
      element.removeAttribute(RM);
      element.removeAttribute(FM);
      element.removeAttribute(PM);
      element.style.removeProperty("--aura-prompt-width");
      element.style.removeProperty("--aura-prompt-x");
      element.style.removeProperty("--aura-prompt-y");
    }
  };

  const unique = (elements, inner = false) => {
    const candidates = [...new Set(elements)].filter((element) => visibleRect(element));
    const matches = candidates.filter(
      (element) => !candidates.some((other) => other !== element
        && (inner ? element.contains?.(other) : other.contains?.(element))),
    );
    return matches.length === 1 ? matches[0] : null;
  };

  const mr = (e, r) => {
    if (!e?.isConnected || !R.includes(r)) return;
    e.setAttribute(RM, r);
    if (![R[0], R[1], R[4], R[8], R[9], R[10]].includes(r)) return;
    const a = [];
    const v = visibleRect(e);
    const f = (n) => {
      const t = String(n.tagName || n.nodeName || "").toUpperCase();
      if (n.getAttribute?.("aria-hidden") === "true"
          || ["SVG", "TITLE", "CODE", "SAMP"].includes(t)
          || ["status", "alert"].includes(n.getAttribute?.("role"))
          || n.hasAttribute?.("aria-live")) return;
      const q = visibleRect(n);
      const s = window.getComputedStyle?.(n);
      const b = s?.backgroundColor;
      const p = (s?.backgroundImage && s.backgroundImage !== "none")
        || (b && b !== "transparent"
          && !/(?:,\s*0(?:\.0+)?|\/\s*0(?:\.0+)?)\)$/.test(b));
      if (a.length && n !== e && p && q && v
          && q.width < v.width * 0.9 && q.height < v.height * 0.9) return;
      let o = false;
      const g = () => {
        if (o) return;
        if (q?.width > 3 && q.height > 7 && (n.children?.length || !p)) {
          a.push(n);
          o = true;
        }
      };
      const children = n.childNodes ?? n.children ?? [];
      for (const c of children) {
        if (c.nodeType === 3) {
          if (c.textContent?.trim()) g();
        } else f(c);
      }
      if (!children.length && n.textContent?.trim()) g();
    };
    f(e);
    const l = a[0];
    if (!l) return;
    for (let i = 0; i < a.length; i += 1) a[i].setAttribute(FM, i ? "s" : "p");
    for (let n = l; n && n !== e; n = n.parentElement) n.setAttribute(PM, "");
  };

  const discoverSidebar = () => {
    const candidates = [...(document.querySelectorAll?.(
      'aside,[role="navigation"],nav,[data-testid="sidebar"]',
    ) ?? [])].filter((element) => {
      const rect = visibleRect(element);
      return rect
        && rect.left <= Math.max(32, window.innerWidth * 0.04)
        && rect.right > 0
        && rect.width >= 40 && rect.width <= Math.min(440, window.innerWidth * 0.46)
        && rect.height >= window.innerHeight * 0.5;
    });
    const sidebar = unique(candidates);
    const rect = visibleRect(sidebar);
    return rect && rect.width >= 208 ? sidebar : null;
  };

  const modalAncestor = (element, boundary) => {
    for (let node = element?.parentElement; node && node !== boundary; node = node.parentElement) {
      const tag = String(node.tagName || node.nodeName || "").toLowerCase();
      const role = node.getAttribute?.("role");
      if (tag === "dialog" || ["dialog", "menu", "listbox", "tooltip"].includes(role)) return node;
    }
    return null;
  };

  const interactiveElements = (rootElement) => {
    const candidates = [...(rootElement?.querySelectorAll?.(
      `${CONTROL_SELECTOR},a[href],[role="link"],[role="menuitem"]`,
    ) ?? [])].filter((element) => visibleRect(element) && !modalAncestor(element, rootElement));
    return candidates.filter(
      (element) => !candidates.some((other) => other !== element && other.contains?.(element)),
    );
  };

  const discoverSidebarRoles = (sidebar) => {
    const side = visibleRect(sidebar);
    if (!side) return;
    const interactive = interactiveElements(sidebar);
    const primary = unique(
      [...(sidebar.querySelectorAll?.(
        '[data-testid="new-chat"],[data-testid="new-chat-button"],a[href="/new"],a[href^="/new?"],a[href$="/new"]',
      ) ?? [])].filter((element) => {
        const control = interactive.find((candidate) => candidate === element || candidate.contains?.(element));
        const rect = visibleRect(control);
        return rect && rect.top <= side.top + Math.min(240, side.height * 0.3)
          && rect.width >= Math.min(132, side.width * 0.5);
      }).map((element) => interactive.find(
        (candidate) => candidate === element || candidate.contains?.(element),
      )).filter(Boolean),
    );
    mr(primary, R[0]);

    const footerCandidates = interactive.filter((element) => {
      const rect = visibleRect(element);
      if (!rect || rect.top < side.bottom - Math.max(180, side.height * 0.24)) return false;
      const role = element.getAttribute?.("role");
      return element.matches?.(
        '[data-testid="account-menu"],[data-testid="profile-menu"],[aria-haspopup="menu"]',
      ) || role === "menuitem";
    });
    const footer = unique(footerCandidates);
    mr(footer, R[4]);

    const rows = interactive.filter((element) => {
      if (element === primary || element === footer) return false;
      const rect = visibleRect(element);
      if (!rect || rect.height < 24 || rect.height > 84 || rect.width < Math.min(112, side.width * 0.42)) return false;
      return element.matches?.('a[href],[role="link"],[role="menuitem"]')
        || Boolean(element.closest?.('[role="list"],ul,ol,[role="navigation"],nav'));
    });
    for (const row of rows) mr(row, R[1]);

    for (const list of sidebar.querySelectorAll?.('[role="list"],ul,ol') ?? []) {
      const rect = visibleRect(list);
      if (rect && rows.some((row) => list.contains?.(row))) mr(list, R[3]);
    }
    for (const section of sidebar.querySelectorAll?.('[role="group"],section') ?? []) {
      const rect = visibleRect(section);
      if (rect && rows.some((row) => section.contains?.(row))) mr(section, R[2]);
    }
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
    /*__AURA_PERSONAL_WORDMARK_START__*/
    var min = Number(settings.W[1]) || 136;
    var width = Number(settings.W[2]) || 160;
    /*__AURA_PERSONAL_WORDMARK_END__*/
    /*__AURA_BUILTIN_WORDMARK_START__*/
    var am = brandAssetMode(brand);
    var limits = settings.b[am === "dark" ? 3 : 2] || [];
    var min = Number(limits[0]) || 136;
    var width = Number(limits[1]) || 160;
    /*__AURA_BUILTIN_WORDMARK_END__*/
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
      /*__AURA_BUILTIN_WORDMARK_START__*/
      mode: am,
      /*__AURA_BUILTIN_WORDMARK_END__*/
    };
  };

  /*__AURA_BUILTIN_WORDMARK_START__*/
  const brandAssetMode = (target) => {
    const channels = window.getComputedStyle?.(target)?.color
      ?.match(/\d+(?:\.\d+)?/g);
    if (!channels || channels.length < 3) return mode();
    const brightness = Number(channels[0]) * 299
      + Number(channels[1]) * 587
      + Number(channels[2]) * 114;
    return brightness >= 160000 ? "dark" : "light";
  };
  /*__AURA_BUILTIN_WORDMARK_END__*/

  const syncBrand = (sidebar) => {
    /*__AURA_PERSONAL_WORDMARK_START__*/
    if (!settings.W?.[0]) {
      if (bb) clearBrand();
      return;
    }
    /*__AURA_PERSONAL_WORDMARK_END__*/
    /*__AURA_BUILTIN_WORDMARK_START__*/
    if (!settings.b?.[0] && !settings.b?.[1]) {
      if (bb) clearBrand();
      return;
    }
    /*__AURA_BUILTIN_WORDMARK_END__*/
    const t = findBrand(sidebar);
    if (!t) {
      if (bb) clearBrand();
      return;
    }
    /*__AURA_PERSONAL_WORDMARK_START__*/
    var am = "personal";
    /*__AURA_PERSONAL_WORDMARK_END__*/
    /*__AURA_BUILTIN_WORDMARK_START__*/
    var am = t.mode || brandAssetMode(t.native[0]);
    /*__AURA_BUILTIN_WORDMARK_END__*/
    /*__AURA_BUILTIN_WORDMARK_START__*/
    const currentBrandSource = settings.b[am === "dark" ? 1 : 0];
    if (!currentBrandSource) {
      if (bb) clearBrand();
      return;
    }
    /*__AURA_BUILTIN_WORDMARK_END__*/
    if (bb?.host === t.host && bb.native?.[0] === t.native[0]
        && bb.mode === am
        && bb.offset === t.offset && bb.width === t.width
        && bb.image?.isConnected) return;
    clearBrand();
    const mark = document.createElement("span");
    const im = document.createElement("img");
    const token = ++bt;
    /*__AURA_PERSONAL_WORDMARK_START__*/
    var source = settings.W[0];
    /*__AURA_PERSONAL_WORDMARK_END__*/
    /*__AURA_BUILTIN_WORDMARK_START__*/
    var source = settings.b[am === "dark" ? 1 : 0];
    /*__AURA_BUILTIN_WORDMARK_END__*/
    mark.setAttribute("aria-hidden", "true");
    mark.setAttribute(BI, `${settings.version}:${settings.digest}`);
    mark.style.setProperty("inset-inline-start", `${t.offset}px`);
    mark.style.setProperty("width", `${t.width}px`);
    /*__AURA_BUILTIN_WORDMARK_START__*/
    const appearanceIndex = am === "dark" ? 1 : 0;
    if (settings.b[4]?.[appearanceIndex] === "m") mark.style.setProperty("aspect-ratio", "1");
    const treatment = settings.b[5]?.[appearanceIndex] || "o";
    if (treatment !== "o") {
      const mask = `url(${JSON.stringify(source)})`;
      mark.style.setProperty("background-color", treatment === "a"
        ? "hsl(var(--aura-accent-primary))" : "currentColor");
      for (const prefix of ["mask", "-webkit-mask"]) {
        mark.style.setProperty(`${prefix}-image`, mask);
        mark.style.setProperty(`${prefix}-repeat`, "no-repeat");
        mark.style.setProperty(`${prefix}-position`, "center");
        mark.style.setProperty(`${prefix}-size`, "contain");
      }
      im.style.setProperty("opacity", "0");
    }
    /*__AURA_BUILTIN_WORDMARK_END__*/
    im.alt = "";
    im.draggable = false;
    im.decoding = "async";
    im.setAttribute("aria-hidden", "true");
    im.setAttribute(BL, "");
    bb = { ...t, image: mark, loader: im, mode: am, token, ready: false };
    const fail = () => {
      if (bb?.token === token) clearBrand();
    };
    im.onerror = fail;
    im.onload = () => {
      const decoded = typeof im.decode === "function" ? im.decode() : Promise.resolve();
      Promise.resolve(decoded).then(() => {
        if (bb?.token !== token || !mark.isConnected || !im.isConnected || !t.host.isConnected
            || !im.naturalWidth
            /*__AURA_BUILTIN_WORDMARK_START__*/
            || brandAssetMode(t.native[0]) !== am
            /*__AURA_BUILTIN_WORDMARK_END__*/
            || findBrand(sidebar)?.native?.[0] !== t.native[0]) return fail();
        if ((window.getComputedStyle?.(t.host)?.position || "static") === "static") {
          t.host.setAttribute(BF, "true");
        }
        t.host.setAttribute(BH, "ready");
        for (const element of t.native) element.setAttribute(BN, "true");
        bb.ready = true;
      }, fail);
    };
    mark.appendChild(im);
    t.host.appendChild(mark);
    im.src = source;
  };

  /*__AURA_AVATAR_START__*/
  /* Personal avatar overlay: an absolutely-positioned image over the Claude
     account picture in the sidebar footer; compiled out when no avatar is set. */
  if (typeof settings.avatarDataUrl === "string" && settings.avatarDataUrl) {
    const AVH = "data-claude-aura-avatar-host", AVF = "data-claude-aura-avatar-flow", AV = "data-claude-aura-avatar";
    const findAvatar = (sidebar) => {
      const side = visibleRect(sidebar);
      if (!side) return null;
      let acct = null, lowest = 0;
      for (const candidate of sidebar.querySelectorAll?.(
        '[data-testid="account-menu"],[data-testid="profile-menu"],[aria-haspopup="menu"]',
      ) ?? []) {
        const rect = visibleRect(candidate);
        if (rect && rect.top >= side.bottom - Math.max(180, side.height * 0.24) && rect.top >= lowest) {
          lowest = rect.top; acct = candidate;
        }
      }
      const bounds = acct && visibleRect(acct);
      if (!bounds) return null;
      let best = null;
      for (const element of [acct, ...(acct.querySelectorAll?.("img,span,div") ?? [])]) {
        const rect = visibleRect(element);
        if (!rect) continue;
        const size = Math.min(rect.width, rect.height);
        if (size < 16 || size > 56 || Math.abs(rect.width - rect.height) > Math.max(4, size * 0.34)
          || rect.left > bounds.left + Math.max(56, bounds.width * 0.5)
          || rect.top < bounds.top - 2 || rect.bottom > bounds.bottom + 2) continue;
        const score = (element.tagName === "IMG" ? 0 : 1e6) + Math.round(rect.left);
        if (!best || score < best.score) best = { element, rect, score };
      }
      if (!best) return null;
      const radius = window.getComputedStyle?.(best.element)?.borderRadius;
      return { acct, bounds, rect: best.rect, radius: radius && radius !== "0px" ? radius : "50%" };
    };
    clearAvatar = () => {
      avt += 1;
      for (const node of document.querySelectorAll?.(`[${AV}]`) ?? []) node.remove();
      for (const node of document.querySelectorAll?.(`[${AVH}],[${AVF}]`) ?? []) {
        node.removeAttribute(AVH); node.removeAttribute(AVF);
      }
      av = null;
    };
    syncAvatar = (sidebar) => {
      const spot = findAvatar(sidebar);
      if (!spot) { if (av) clearAvatar(); return; }
      if (av?.acct === spot.acct && av.image?.isConnected) return;
      clearAvatar();
      const image = document.createElement("img");
      const token = ++avt;
      image.alt = "";
      image.draggable = false;
      image.setAttribute("aria-hidden", "true");
      image.setAttribute(AV, "1");
      const put = (name, value) => image.style.setProperty(name, value);
      put("left", `${Math.round(spot.rect.left - spot.bounds.left)}px`);
      put("top", `${Math.round(spot.rect.top - spot.bounds.top)}px`);
      put("width", `${Math.round(spot.rect.width)}px`);
      put("height", `${Math.round(spot.rect.height)}px`);
      put("border-radius", spot.radius);
      av = { acct: spot.acct, image, token };
      image.onerror = () => { if (av?.token === token) clearAvatar(); };
      image.onload = () => {
        if (av?.token !== token || !image.isConnected) return;
        if ((window.getComputedStyle?.(spot.acct)?.position || "static") === "static") {
          spot.acct.setAttribute(AVF, "true");
        }
        spot.acct.setAttribute(AVH, "ready");
      };
      spot.acct.appendChild(image);
      image.src = settings.avatarDataUrl;
    };
  }
  /*__AURA_AVATAR_END__*/

  const discoverMain = () => {
    const candidates = [...(document.querySelectorAll?.('main,[role="main"]') ?? [])]
      .filter((element) => {
        const rect = visibleRect(element);
        return rect && rect.width >= 480 && rect.height >= 400
          && rect.right >= window.innerWidth - 32
          && rect.bottom > Math.min(window.innerHeight, 480);
      });
    return unique(candidates);
  };

  const composerShellFor = (editor, main) => {
    const editorRect = visibleRect(editor);
    if (!editorRect) return null;
    let fallback = null;
    for (let node = editor.parentElement, depth = 0;
      node && node !== main && depth < 12;
      node = node.parentElement, depth += 1) {
      const rect = visibleRect(node);
      if (!rect || rect.width < Math.max(280, editorRect.width * 0.75)
          || rect.height < Math.min(editorRect.height + 18, 222)
          || rect.height > 560) continue;
      fallback ??= node;
      const controls = [...(node.querySelectorAll?.(CONTROL_SELECTOR) ?? [])]
        .filter((control) => visibleRect(control) && !modalAncestor(control, node));
      if (controls.length) return node;
    }
    return fallback;
  };

  const composerGroupFor = (shell, main) => {
    const shellRect = visibleRect(shell);
    const mainRect = visibleRect(main);
    if (!shellRect || !mainRect) return null;
    let group = null;
    for (let node = shell.parentElement, depth = 0;
      node && node !== main && depth < 8;
      node = node.parentElement, depth += 1) {
      const rect = visibleRect(node);
      if (!rect) continue;
      if (rect.width < shellRect.width * 0.9
          || rect.height > Math.min(560, shellRect.height + 260)
          || node.querySelector?.(MESSAGE_SELECTOR)) continue;
      const editors = [...(node.querySelectorAll?.(EDITOR_SELECTOR) ?? [])]
        .filter((element) => visibleRect(element));
      if (editors.length === 1) group = node;
    }
    return group;
  };

  const commonToolbar = (controls, editor, shell) => {
    const explicit = unique(
      [...(shell.querySelectorAll?.('[role="toolbar"]') ?? [])].filter((element) => visibleRect(element)),
    );
    if (explicit) return explicit;
    if (controls.length < 2) return null;
    for (let node = controls[0].parentElement, depth = 0;
      node && node !== shell && depth < 6;
      node = node.parentElement, depth += 1) {
      const rect = visibleRect(node);
      if (rect && rect.height <= 96 && !node.contains?.(editor)
          && controls.every((control) => node.contains?.(control))) return node;
    }
    return null;
  };

  const classifyComposerControls = (shell, editor) => {
    const controls = interactiveElements(shell).filter(
      (control) => !editor.contains?.(control) && !control.contains?.(editor),
    );
    for (const control of controls) {
      const rect = visibleRect(control);
      if (!rect) continue;
      const role = control.getAttribute?.("role");
      const toggle = role === "switch" || control.hasAttribute?.("aria-checked")
        || control.hasAttribute?.("aria-pressed")
        || control.matches?.('[data-state="checked"],[data-state="unchecked"]');
      if (toggle) mr(control, R[10]);
      else if (String(control.tagName || control.nodeName || "").toLowerCase() === "select"
          || rect.width > rect.height * 1.55) mr(control, R[9]);
      else mr(control, R[8]);
    }
    return controls;
  };

  const discoverComposer = () => {
    const main = discoverMain();
    if (!main) return { context: "other", main: null };
    const editors = [...(main.querySelectorAll?.(EDITOR_SELECTOR) ?? [])]
      .filter((editor) => visibleRect(editor) && !modalAncestor(editor, main));
    const editor = unique(editors, true);
    if (!editor) return { context: "other", main };
    const shell = composerShellFor(editor, main);
    if (!shell) return { context: "other", main };
    if (main.querySelector?.(MESSAGE_SELECTOR)) {
      const controls = classifyComposerControls(shell, editor);
      return {
        context: "conversation",
        main,
        prompt: null,
        shell,
        editor,
        controls,
        toolbar: commonToolbar(controls, editor, shell),
      };
    }
    const group = composerGroupFor(shell, main) ?? shell.parentElement;
    const mainRect = visibleRect(main);
    const groupRect = visibleRect(group);
    if (!mainRect || !groupRect || group === main) return { context: "other", main };
    const context = mainRect.bottom - groupRect.bottom >= Math.max(56, mainRect.height * 0.08)
      || ((groupRect.bottom > mainRect.bottom
          || (currentContext === "new-chat" && window.location?.pathname === "/new"))
        && groupRect.top >= mainRect.top + Math.min(180, mainRect.height * 0.35)
        && groupRect.left >= mainRect.left - 2
        && groupRect.right <= mainRect.right + 2)
      ? "new-chat" : "other";
    if (context === "other") return { context, main };
    const controls = classifyComposerControls(shell, editor);
    return {
      context,
      main: group.parentNode,
      prompt: context === "new-chat" ? group : null,
      shell,
      editor,
      controls,
      toolbar: commonToolbar(controls, editor, shell),
    };
  };

  const lr = (e) => {
    const r = e?.getBoundingClientRect ? visibleRect(e) : e;
    const w = window.innerWidth, h = window.innerHeight;
    if (!r || ![r.left, r.top, r.width, r.height, w, h].every(Number.isFinite)
        || r.width <= 0 || r.height <= 0 || r.left >= w || r.top >= h
        || r.left + r.width <= 0 || r.top + r.height <= 0) return null;
    const l = Math.max(0, r.left), t = Math.max(0, r.top);
    return {
      left: l, top: t,
      width: Math.min(w, r.left + r.width) - l,
      height: Math.min(h, r.top + r.height) - t,
    };
  };
  const lp = () => {
    if (codeRouteContext()) return null;
    const f = discoverComposer(), a = f.controls ?? [], c = a.length <= 12 ? a.map(lr) : null;
    const g = getGreetingProbe(), r = lr(g["rect"]);
    let s = ["native", "custom"].includes(g["status"]) && r ? "found"
      : g["status"] === "ambiguous" ? "ambiguous"
        : ["native", "custom", "missing", "pending", "verifying", "unmeasurable"].includes(g["status"])
          ? "missing" : "inactive";
    const d = Number(window.devicePixelRatio);
    return {
      "version": 1, "digest": settings.digest, "context": f.context, "mode": mode(),
      "frame": viewport() === "w" ? "wide" : "normal",
      "viewport": {
        "width": Number.isFinite(window.innerWidth) && window.innerWidth > 0 ? window.innerWidth : 0,
        "height": Number.isFinite(window.innerHeight) && window.innerHeight > 0 ? window.innerHeight : 0,
        "dpr": Number.isFinite(d) && d > 0 ? d : 1,
      },
      "main": lr(f.main), "prompt": lr(f.prompt), "composer": lr(f.shell), "toolbar": lr(f.toolbar),
      "controls": f.shell && c?.every(Boolean) ? c : null,
      "greeting": {
        "status": s, "source": ["native", "custom"].includes(g["source"]) ? g["source"] : "none",
        "rect": s === "found" ? r : null,
      },
    };
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
    const responsive = responsiveTrack && Array.isArray(settings.n?.[1]);
    let layout = responsive
      ? null
      : Array.isArray(settings.n?.[0])
        ? settings.n[viewport() === "w" ? 1 : 0]
        : settings.n;
    prompt.setAttribute(PROMPT_MARKER, "native");
    if (!responsive && !layout) return;
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
    if (responsive) {
      const nativeRect = visibleRect(prompt);
      if (!nativeRect) return;
      const inherited = Array.isArray(settings.n[0])
        ? settings.n[0]
        : [
          Math.min(0.96, Math.max(0.4, nativeRect.width / bounds.width)),
          Math.min(0.35, Math.max(-0.35,
            ((nativeRect.left + (nativeRect.width / 2)) - (bounds.left + (bounds.width / 2))) / bounds.width)),
          0,
        ];
      const resolved = responsiveValue(
        settings.n[1],
        inherited,
        ["width", "x", "y"],
        { width: 4, x: 4, y: 4 },
      );
      layout = [
        resolved["value"]["width"],
        resolved["value"]["x"],
        resolved["value"]["y"],
      ];
    }
    if (!layout) return;
    const authoredTranslate = window.getComputedStyle?.(prompt)?.translate ?? "none";
    if (authoredTranslate && !["none", "0px", "0px 0px"].includes(authoredTranslate)) return;
    const inset = 16;
    const width = Math.min(bounds.width - (inset * 2), Math.max(280, bounds.width * layout[0]));
    prompt.setAttribute(PROMPT_MARKER, "authored");
    prompt.style.setProperty("--aura-prompt-width", `${Math.round(width * 100) / 100}px`);
    prompt.style.setProperty("--aura-prompt-x", "0px");
    prompt.style.setProperty("--aura-prompt-y", "0px");
    const rect = visibleRect(prompt);
    if (!rect) return clearPromptLayout(), prompt.setAttribute(PROMPT_MARKER, "native");
    const desiredCenter = bounds.left + (bounds.width / 2) + (bounds.width * layout[1]);
    const desiredLeft = Math.min(bounds.right - inset - rect.width, Math.max(bounds.left + inset, desiredCenter - (rect.width / 2)));
    const desiredTop = Math.min(bounds.bottom - inset - rect.height, Math.max(bounds.top + inset, rect.top + (bounds.height * layout[2])));
    prompt.style.setProperty("--aura-prompt-x", `${Math.round((desiredLeft - rect.left) * 100) / 100}px`);
    prompt.style.setProperty("--aura-prompt-y", `${Math.round((desiredTop - rect.top) * 100) / 100}px`);
  };

  const applyArtworkContext = (context) => {
    const view = viewport();
    root.dataset.claudeAuraViewport = view === "w" ? "wide" : "normal";
    if (responsiveLayoutId) root.dataset.claudeAuraLayout = responsiveLayoutId();
    else delete root.dataset.claudeAuraLayout;
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
        let frame, anchorCode;
        if (responsiveTrack) {
          const resolved = responsiveValue(
            layer.n,
            [0, 0, 50, 50, 1],
            ["positionX", "positionY", "focalX", "focalY", "scale"],
            { positionX: 2, positionY: 2, focalX: 2, focalY: 2, scale: 2 },
          );
          frame = [
            resolved["value"].positionX,
            resolved["value"].positionY,
            resolved["value"].focalX,
            resolved["value"].focalY,
            resolved["value"].scale,
          ];
          anchorCode = layer.h || "c";
          element.dataset.artLayoutSource = resolved["source"];
        } else {
          frame = view === "w" && Array.isArray(layer.w) ? layer.w : layer.n;
          anchorCode = view === "w" ? (layer.z || layer.h || "c") : (layer.h || "c");
          delete element.dataset.artLayoutSource;
        }
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

  /*__AURA_GREETING_START__*/
  if (settings.g && typeof settings.g === "object") {
    const g = settings.g, G = "data-claude-aura-greeting", H = `${G}-native`;
    const T = `${G}-text`, K = `${G}-mark`, U = "unmeasurable", ps = Array.isArray(g.p) ? g.p : [];
    const pd = typeof g.d === "string" ? g.d : "", sh = g.h, old = window[STATE_KEY]?.["greetingMemory"];
    const io = Array.isArray(sh?.[0]) && sh.length === 3 ? sh[0] : [];
    const ic = sh?.[1], il = sh?.[2];
    const iv = io.length === ps.length && new Set(io).size === ps.length
      && io.every((x) => Number.isInteger(x) && x >= 0 && x < ps.length)
      && Number.isInteger(ic) && ic >= 0 && ic <= io.length
      && (il === null || (Number.isInteger(il) && il >= 0 && il < ps.length))
      && (ic === 0 || il === io[ic - 1]);
    greetingMemory = old?.f === pd && old?.t === settings.theme ? old : {
      t: settings.theme, f: pd, s: -1, o: iv ? [...io] : [], c: iv ? ic : 0,
      l: iv && il !== null ? il : -1, e: 1, v: false,
    };
    let bd, rn, tn, dn, ro, ft = 0, st = "missing", cc = 0, mf = false, rt = [];
    const responsiveGreetingGeometry = (...nodes) => {
      if (!responsiveTrack || !Array.isArray(g.r)) return;
      const frames = g.r[mode() === "dark" ? 1 : 0];
      if (!Array.isArray(frames)) return;
      const resolved = responsiveValue(
        frames,
        [34, 1.15, 0.72, 0, 0, 1],
        ["fontSize", "lineHeight", "maxWidth", "x", "y", "markScale"],
        { fontSize: 2, lineHeight: 2, maxWidth: 2, x: 2, y: 2, markScale: 2 },
      );
      for (const node of new Set(nodes.filter((candidate) => candidate?.isConnected))) {
        node.style.setProperty("--aura-responsive-greeting-font-size", `${resolved["value"].fontSize}px`);
        node.style.setProperty("--aura-responsive-greeting-line-height", String(resolved["value"].lineHeight));
        node.style.setProperty("--aura-responsive-greeting-max-ratio", String(resolved["value"].maxWidth));
        node.style.setProperty("--aura-responsive-greeting-x", String(resolved["value"].x));
        node.style.setProperty("--aura-responsive-greeting-y", String(resolved["value"].y));
        node.style.setProperty("--aura-responsive-greeting-mark-scale", String(resolved["value"].markScale));
        node.dataset.claudeAuraGreetingLayoutSource = resolved["source"];
      }
    };
    const src = ps.length ? "custom" : "native", rr = (r) => r && ({
      left: Math.round(r.left), top: Math.round(r.top), width: Math.round(r.width), height: Math.round(r.height),
    });
    const ur = (...rs) => {
      const a = rs.filter(Boolean);
      if (!a.length) return null;
      const left = Math.min(...a.map((r) => r.left)), top = Math.min(...a.map((r) => r.top));
      const right = Math.max(...a.map((r) => r.right)), bottom = Math.max(...a.map((r) => r.bottom));
      return { left, top, right, bottom, width: right - left, height: bottom - top };
    };
    const vo = (e) => {
      const r = visibleRect(e), c = r && window.getComputedStyle?.(e);
      const o = Number.parseFloat(c?.opacity ?? c?.getPropertyValue?.("opacity") ?? "");
      return r && (!Number.isFinite(o) || o > 0.01) ? r : null;
    };
    const vt = () => ps.length ? visibleRect(rn) : visibleRect(bd?.u);
    const vm = () => ur(
      ...(bd?.ks ?? []).map(vo),
      vo(dn?.querySelector?.(`[${K}="compact"]`)),
    );
    const vg = () => ur(vt(), vm());
    getGreetingProbe = () => {
      const x = vt(), n = bd?.n?.isConnected && (visibleRect(bd.n) || bd.r);
      return {
        version: 1, digest: settings.digest, context: currentContext, status: st,
        candidateCount: cc, "source": src, nativeConnected: Boolean(bd?.n?.isConnected),
        replacementConnected: Boolean(rn?.isConnected), replacementVisible: Boolean(visibleRect(rn)),
        nativeHidden: bd?.u?.getAttribute?.(H) === "true",
        visitEpoch: greetingMemory.e,
        shuffle: ps.length && pd && greetingMemory.o.length ? {
          themeId: settings.theme, phraseDigest: pd, order: [...greetingMemory.o],
          cursor: greetingMemory.c, lastIndex: greetingMemory.l < 0 ? null : greetingMemory.l,
        } : null,
        "rect": rr(x || n),
      };
    };
    const at = (n, a) => [n, a, n.hasAttribute?.(a), n.getAttribute?.(a)];
    const af = (f) => { const x = ++ft; window.requestAnimationFrame(() => x === ft && f()); };
    const q = `${EDITOR_SELECTOR},${CONTROL_SELECTOR},${MESSAGE_SELECTOR}`;
    const excluded = (n, own = bd?.n) => !n?.isConnected || n === rn || n.hasAttribute?.(T)
      || (n.hasAttribute?.(G) && n !== own) || n.matches?.(q) || n.querySelector?.(q)
      || n.parentElement?.closest?.(q)
      || n.closest?.('[role="dialog"],[role="navigation"],nav,form');
    const bound = (c, ma) => Boolean(c?.n?.isConnected && c.t?.isConnected
      && ma.contains?.(c.n) && c.n.contains?.(c.t) && !excluded(c.t, c.n));
    const find = (ma, sh, gr) => {
      const mr = visibleRect(ma), sr = visibleRect(sh), roots = [];
      let pass = false;
      for (let n = sh, d = 0; n?.parentElement && d < 8; n = n.parentElement, d += 1) {
        const p = n.parentElement, a = [...p.children], i = a.indexOf(n);
        if (i) roots.push(...a.slice(Math.max(0, i - 8), i));
        if (pass) break;
        pass = p === gr;
      }
      const out = bound(bd, ma) ? [bd] : [], sel = 'h1,h2,h3,h4,h5,h6,[role="heading"],span,p';
      for (const n of [...new Set(roots)].slice(-16)
        .flatMap((x) => [...(x.matches?.(sel) ? [x] : []), ...(x.querySelectorAll?.(sel) ?? [])]).slice(0, 64)) {
        if (excluded(n)) continue;
        const nr = visibleRect(n), tag = String(n.tagName || n.nodeName || "");
        const sem = /^H[1-6]$/i.test(tag) || n.getAttribute?.("role") === "heading";
        const fs = Number.parseFloat(window.getComputedStyle?.(n)?.fontSize ?? "");
        if (!nr || nr.top < mr.top - 2 || nr.bottom > sr.top + 2 || nr.height > 160
            || (!sem && (n.children.length || fs < 24 || nr.width < 48 || nr.height < 20 || nr.height > 96))) continue;
        const mark = (c) => {
          const r = c !== n && !c?.contains?.(n) && !excluded(c, n) && visibleRect(c);
          const s = r && Math.min(r.width, r.height);
          return r && s >= 10 && s <= 64 && Math.abs(r.width - r.height) < 16;
        };
        let w = n;
        if (sem) {
          const p = n.parentElement, a = [...(p?.children ?? [])], i = a.indexOf(n);
          const k = [a[i - 1], a[i + 1]].find(mark);
          const r = visibleRect(p);
          if (k && r && r.height <= 128 && r.width <= nr.width + 112
              && Math.abs(r.left + r.right - nr.left - nr.right) <= 64 && !p.querySelector?.(q)) w = p;
        } else for (let p = n.parentElement, d = 0; p && p !== gr && p !== ma && d++ < 2; p = p.parentElement) {
          const r = visibleRect(p);
          if (!r || r.height > 128 || r.width > nr.width + 112
              || Math.abs(r.left + r.right - nr.left - nr.right) > 64 || p.querySelector?.(q)) break;
          w = p;
        }
        const r = visibleRect(w), ov = r && Math.max(0, Math.min(r.right, sr.right) - Math.max(r.left, sr.left));
        if (!r || ov < Math.min(r.width, sr.width) * 0.55) continue;
        const ks = [];
        let ko;
        for (const x of [...new Set([...w.children, ...(w.querySelectorAll?.("*") ?? [])])]) {
          if (!mark(x) || ks.some((k) => k.contains?.(x))) continue;
          if (ks.length > 3) { ko = 1; break; }
          ks.push(x);
        }
        if (ko) continue;
        const ka = ks.find((x) => {
          const a = visibleRect(x);
          return a && (a.right <= nr.left + 2 || a.left >= nr.right - 2);
        });
        const z = (sem ? 60 : Math.min(36, (fs - 18) * 3))
          + Math.max(0, 42 - ((sr.top - r.bottom) + Math.abs(r.left + r.right - sr.left - sr.right) / 2) / 8)
          + (ks.length ? 3 : 0);
        const c = { n: w, t: n, ks, ka, r, z }, i = out.findIndex((x) => x.n === w);
        if (i < 0) out.push(c);
        else if (z > out[i].z) out[i] = c;
      }
      const a = out.sort((x, y) => y.z - x.z);
      if (!a.length) return ["missing", 0];
      if (a[0].z < 56 || (a[1] && a[0].z - a[1].z < Math.max(10, a[0].z * 0.1))) {
        return ["ambiguous", a.length];
      }
      return ["found", a.length, a[0]];
    };
    const bind = (c) => {
      const u = c.t?.isConnected && c.t !== c.n ? c.t : c.n;
      const tr = visibleRect(u) || c.r, ms = c.ks.map((k) => {
        const r = visibleRect(k);
        if (!r || !tr) return null;
        const s = Math.abs(r.right - tr.left) <= Math.abs(r.left - tr.right) ? -1 : 1;
        return [
          k, r.width, r.height, s,
          Math.max(0, Math.min(64, s < 0 ? tr.left - r.right : r.left - tr.right)),
          ((r.top + r.bottom) - (tr.top + tr.bottom)) / 2, r.left, r.top,
        ];
      }).filter(Boolean);
      return {
        ...c, p: c.n.parentElement, u, ms,
        am: ms.find((m) => m[0] === c.ka) || ms[0],
        a: [at(c.n, G), at(u, H), at(u, "aria-hidden"), ...c.ks.map((k) => at(k, K))],
        y: [...new Set([c.n, u, ...c.ks])].map((n) => [n, n.style["css" + "Text"]]),
      };
    };
    const restore = () => {
      for (const [n, p, e, v] of bd?.a ?? []) if (n?.isConnected) {
        e ? n.setAttribute(p, v ?? "") : n.removeAttribute(p);
      }
      for (const [n, s] of bd?.y ?? []) if (n?.isConnected) n.style["css" + "Text"] = s;
    };
    const unwatch = () => { ro?.disconnect(); rt = []; };
    const watch = (...nodes) => {
      const next = [...new Set(nodes.filter((n) => n?.isConnected))];
      if (next.length === rt.length && next.every((n, i) => n === rt[i])) return;
      unwatch();
      if (!next.length || typeof window.ResizeObserver !== "function") return;
      ro ??= new window.ResizeObserver(() => { if (bd) scheduleEnsure(); });
      for (const n of next) ro.observe(n);
      rt = next;
    };
    const remove = () => { ft += 1; rn?.remove(); dn?.remove(); rn = tn = dn = null; };
    const end = () => {
      if (greetingMemory.v) greetingMemory.v = false, greetingMemory.s = -1, greetingMemory.e += 1;
    };
    advanceGreetingVisit = () => {
      greetingMemory.v = false; greetingMemory.s = -1; greetingMemory.e += 1;
    };
    clearGreeting = (e = false) => { unwatch(); restore(); remove(); bd = null; if (e) end(); };
    const geometry = (n, ma) => {
      responsiveGreetingGeometry(n, bd?.n, rn);
      const c = window.getComputedStyle?.(n), r = visibleRect(ma);
      if (!c || !r) return;
      const v = (p) => Number.parseFloat(c.getPropertyValue?.(`--aura-greeting-${p}`));
      const x = v("x"), y = v("y"), w = v("max-ratio");
      if (Number.isFinite(w)) n.style.setProperty("max-width", `${Math.round(Math.max(160, Math.min(r.width, w * r.width)))}px`);
      n.style.removeProperty("translate");
      const d = [x * r.width || 0, y * r.height || 0];
      if (d[0] || d[1]) n.style.setProperty("translate", `${d[0]}px ${d[1]}px`);
      return d;
    };
    const box = (n, l, t, w, h) => {
      n.style["css" + "Text"] += `;position:fixed!important;left:${Math.round(l)}px!important;`
        + `top:${Math.round(t)}px!important;width:${Math.round(w)}px!important;`
        + `height:${Math.round(h)}px!important;margin:0!important;pointer-events:none!important`;
    };
    const anchored = (m, r, n = m[0], w = m[1], h = m[2]) => {
      const [, , , s, g, y] = m;
      box(n, s < 0 ? r.left - g - w : r.right + g,
        ((r.top + r.bottom - h) / 2) + y, w, h);
    };
    const place = (n) => {
      const r = visibleRect(n);
      if (!r) return null;
      for (const m of bd?.ms ?? []) anchored(m, r);
      return r;
    };
    const im = (parent) => {
      const x = document.createElement("img");
      x.setAttribute(K, "compact"); x.setAttribute("aria-hidden", "true");
      x.alt = ""; x.draggable = false;
      x.style.setProperty("display", "block"); x.style.setProperty("width", "100%");
      x.style.setProperty("height", "100%");
      x.onerror = () => {
        if (x.isConnected && dn?.contains?.(x)) {
          mf = true; fail(U);
        }
      };
      x.src = g.m; parent.appendChild(x); return x;
    };
    const decorate = (n) => {
      const placed = place(n);
      if (!placed) return 0;
      if (!g.m) return 1;
      const m = bd.am;
      if (!m) return 0;
      if (!dn?.isConnected) {
        dn = document.createElement("span");
        dn.setAttribute(G, "decoration"); dn.setAttribute("aria-hidden", "true");
        im(dn);
        bd.p.insertBefore(dn, bd.n);
      }
      const s = Math.round(Math.max(16, Math.min(48, Math.min(m[1], m[2]))));
      anchored(m, placed, dn, s, s);
      return 1;
    };
    const fit=(n,ma,sh) => {
      const d=g.s?geometry(n,ma):[0,0];
      if (!d || !decorate(n)) return 0;
      const r=vg(),m=visibleRect(ma),s=visibleRect(sh);
      if (!r || !m || !s) return 0;
      const x=Math.max(m.left-r.left-2,Math.min(m.right-r.right+2,0));
      const y=Math.max(m.top-r.top-2,Math.min(Math.min(m.bottom,s.top)-r.bottom+2,0));
      if (x || y) {
        n.style.setProperty("translate", `${d[0] + x}px ${d[1] + y}px`);
        decorate(n);
      }
      const q = vg();
      return q && q.left >= m.left - 2 && q.right <= m.right + 2
        && q.top >= m.top - 2 && q.bottom <= Math.min(m.bottom, s.top) + 2;
    };
    let custom = () => 0;
    /*__AURA_GREETING_PHRASES_START__*/
    const pick = () => {
      if (greetingMemory.s >= 0 && greetingMemory.s < ps.length) return greetingMemory.s;
      if (greetingMemory.c >= greetingMemory.o.length || greetingMemory.o.length !== ps.length) {
        greetingMemory.o = ps.map((_, i) => i);
        for (let i = greetingMemory.o.length - 1; i; i -= 1) {
          const j = Math.floor(Math.random() * (i + 1));
          [greetingMemory.o[i], greetingMemory.o[j]] = [greetingMemory.o[j], greetingMemory.o[i]];
        }
        if (greetingMemory.o.length > 1 && greetingMemory.o[0] === greetingMemory.l) {
          [greetingMemory.o[0], greetingMemory.o[1]] = [greetingMemory.o[1], greetingMemory.o[0]];
        }
        greetingMemory.c = 0;
      }
      greetingMemory.s = greetingMemory.o[greetingMemory.c++];
      greetingMemory.l = greetingMemory.s;
      return greetingMemory.s;
    };
    custom = (ma, sh, instant = false) => {
      const i = pick();
      if (i < 0 || !bd?.n?.isConnected) return 0;
      if (/^(pending|verifying|custom)$/.test(st) && rn?.isConnected) {
        if (tn && tn.textContent !== ps[i]) tn.textContent = ps[i];
        if (st === "custom") {
          if (!fit(rn, ma, sh)) { fail(U); return 0; }
        }
        return 1;
      }
      remove();
      rn = document.createElement("div");
      rn.setAttribute(G, "new-chat"); rn.setAttribute("role", "heading");
      const level = Number.parseInt(bd.t?.getAttribute?.("aria-level") ?? "", 10);
      const tagLevel = /^H([1-6])$/i.exec(String(bd.t?.tagName || ""))?.[1];
      rn.setAttribute("aria-level", String(level >= 1 && level <= 6 ? level : tagLevel || 1));
      rn.setAttribute("aria-hidden", "true");
      rn.style.setProperty("position", "absolute"); rn.style.setProperty("visibility", "hidden");
      rn.style.setProperty("pointer-events", "none");
      rn.style.setProperty("min-width", "0"); rn.style.setProperty("max-width", "100%");
      rn.style.setProperty("box-sizing", "border-box");
      rn.style.setProperty("white-space", "normal"); rn.style.setProperty("overflow-wrap", "anywhere");
      tn = document.createElement("span"); tn.setAttribute(T, ""); tn.textContent = ps[i]; rn.appendChild(tn);
      const host = bd.u === bd.n ? bd.p : bd.n, siblings = [...host.children];
      host.insertBefore(rn, bd.u === bd.n ? bd.n : siblings[siblings.indexOf(bd.u) + 1] || null);
      if (g.s) {
        geometry(rn, ma);
      } else {
        const c = window.getComputedStyle?.(bd.u);
        for (const p of [
          "font-family", "font-size", "font-weight", "font-style",
          "letter-spacing", "line-height", "color", "text-align",
        ]) {
          const v = c?.getPropertyValue?.(p); if (v) rn.style.setProperty(p, v);
        }
      }
      const activate = (verify) => {
        const r = rn?.getBoundingClientRect?.(), m = visibleRect(ma);
        if (!r || !m || r.width <= 0 || r.height <= 0 || r.width > m.width) {
          fail(U); return 0;
        }
        bd.n.setAttribute(G, "native-mark");
        for (const k of bd.ks) k.setAttribute(K, "native");
        bd.u.setAttribute(H, "true"); bd.u.setAttribute("aria-hidden", "true");
        bd.u.style.setProperty("display", "none");
        rn.removeAttribute("aria-hidden"); rn.style.removeProperty("position"); rn.style.removeProperty("visibility");
        if (!fit(rn, ma, sh)) { fail(U); return 0; }
        st = verify ? "verifying" : "custom";
        return 1;
      };
      if (instant) return activate(false);
      st = "pending";
      af(() => {
        if (!activate(true)) return;
        af(() => {
          if (!fit(rn, ma, sh)) fail(U);
          else st = "custom";
        });
      });
      return 1;
    };
    /*__AURA_GREETING_PHRASES_END__*/
    const fail = (x, e = false, n = 0) => {
      clearGreeting(e); st = x; cc = n; greetingMatches = n;
    };
    syncGreeting = (ctx, ma, sh, gr) => {
      if (forcedColors?.matches) return fail("forced-colors");
      if (mf) return fail(U);
      if (ctx !== "new-chat") return fail(ctx === "conversation" ? ctx : "other", ctx === "conversation");
      if (!ma || !sh || !gr) return fail("missing");
      const sameVisit = greetingMemory.v;
      greetingMemory.v = true;
      const x = find(ma, sh, gr);
      if (x[0] !== "found") return fail(x[0], false, x[1]);
      if (!bd || bd.n !== x[2].n) {
        clearGreeting(); bd = bind(x[2]);
        for (const [n, w, h, , , , l, t] of bd.ms) box(n, l, t, w, h);
      }
      cc = greetingMatches = x[1];
      if (ps.length) {
        if (!custom(ma, sh, sameVisit && st === "custom")) st = U;
        else watch(ma, sh, bd?.n, bd?.u, rn, ...bd.ks);
        return;
      }
      remove();
      if (!g.s) { unwatch(); return (st = "inactive"); }
      bd.n.setAttribute(G, "native");
      for (const k of bd.ks) k.setAttribute(K, "native");
      if (!fit(bd.u, ma, sh)) return fail(U);
      st = "native"; watch(ma, sh, bd.n, bd.u, ...bd.ks);
    };
  }
  /*__AURA_GREETING_END__*/

  const syncSemanticLayout = () => {
    clearMarks();
    if (forcedColors?.matches) {
      currentContext = "other";
      root.dataset.claudeAuraContext = currentContext;
      root.style.removeProperty("--aura-main-start");
      clearBrand();
      clearAvatar?.();
      /*__AURA_INSTANT_PROMPTS_START__*/
      clearInstantPrompts?.();
      /*__AURA_INSTANT_PROMPTS_END__*/
      if (syncGreeting) syncGreeting("other", null, null, null);
      else clearGreeting?.(false);
      applyArtworkContext(currentContext);
      return;
    }
    const sidebar = discoverSidebar();
    if (sidebar) {
      sidebar.setAttribute(SIDEBAR_MARKER, "expanded");
      discoverSidebarRoles(sidebar);
    }
    syncBrand(sidebar);
    syncAvatar?.(sidebar);
    const found = discoverComposer();
    currentContext = found.context;
    root.dataset.claudeAuraContext = currentContext;
    found.main?.setAttribute(MAIN_MARKER, "true");
    mr(found.shell, R[5]);
    mr(found.editor, R[6]);
    mr(found.toolbar, R[7]);
    if (found.main) {
      const value = `${Math.round(found.main.getBoundingClientRect().left)}px`;
      if (root.style.getPropertyValue("--aura-main-start") !== value) root.style.setProperty("--aura-main-start", value);
    } else root.style.removeProperty("--aura-main-start");
    if (currentContext === "new-chat") applyPromptLayout(found.prompt, found.main);
    else clearPromptLayout();
    syncGreeting?.(currentContext, found.main, found.shell, found.prompt);
    /*__AURA_INSTANT_PROMPTS_START__*/
    syncInstantPrompts?.(currentContext, found);
    /*__AURA_INSTANT_PROMPTS_END__*/
    applyArtworkContext(currentContext);
  };

  const previous = window[STATE_KEY];
  if (previous?.["cleanup"]?.(true) === false) return false;
  previous?.["observer"]?.disconnect();
  previous?.stopModeListener?.();
  previous?.stopContextListeners?.();
  previous?.clearBrandWordmark?.();
  previous?.clearAvatarOverlay?.();
  /*__AURA_INSTANT_PROMPTS_START__*/
  previous?.clearInstantPrompts?.();
  /*__AURA_INSTANT_PROMPTS_END__*/
  previous?.cg?.(false);
  previous?.clearMarkedElements?.();
  if (previous?.["timer"]) clearInterval(previous["timer"]);
  if (previous?.["scheduled"]) clearTimeout(previous["scheduled"]);
  document.getElementById(BACKDROP_ID)?.remove();

  const onModeChange = () => {
    if (document.documentElement && !codeRouteContext()) {
      document.documentElement.dataset.claudeAuraEffectiveMode = mode();
    }
    ensure();
  };
  media?.addEventListener?.("change", onModeChange);
  forcedColors?.addEventListener?.("change", onModeChange);
  const stopMode = () => {
    media?.removeEventListener?.("change", onModeChange);
    forcedColors?.removeEventListener?.("change", onModeChange);
  };
  const rd = () => ({
    "claudeAuraVariant": settings.variant || settings.theme,
    "claudeAuraArtMobile": settings.artMobile || "reduce",
    "claudeAuraAppearance": appearance,
    "claudeAuraEffectiveMode": mode(),
    "claudeAuraContext": currentContext,
    "claudeAuraDigest": settings.digest,
  });
  const rs = () => ({
    "--aura-image": imageCssValue,
    "--aura-image-opacity": imageOpacityValue,
    "--aura-image-position": settings.imagePosition || "center",
    "--aura-image-scale": imageScaleValue,
    "--aura-theme-art": artCssValue,
    "--aura-art-position": settings.artPosition || "right center",
    "--aura-art-size": settings.artSize || "min(58vw, 860px) auto",
  });
  const clearAuraRoot = () => {
    const html = document.documentElement;
    html?.classList.remove("claude-aura", "claude-aura-reduce-motion", "claude-aura-animated-image");
    for (const property of [
      "image", "image-opacity", "image-position", "image-scale",
      "theme-art", "art-position", "art-size", "main-start",
    ]) html?.style.removeProperty(`--aura-${property}`);
    if (html?.dataset) {
      for (const property of [
        "Theme", "Variant", "ArtMobile", "Appearance", "EffectiveMode", "Context", "Viewport", "Layout", "Digest",
      ]) delete html.dataset[`claudeAura${property}`];
    }
  };
  const enterCodeRoute = (context) => {
    currentContext = context;
    clearBrand();
    clearAvatar?.();
    /*__AURA_INSTANT_PROMPTS_START__*/
    clearInstantPrompts?.();
    /*__AURA_INSTANT_PROMPTS_END__*/
    clearGreeting?.(true);
    clearMarks();
    clearPromptLayout();
    artBindings = [];
    document.getElementById(STYLE_ID)?.remove();
    document.getElementById(BACKDROP_ID)?.remove();
    clearAuraRoot();
    rootDirty = styleDirty = true;
    codeAdapter.activate(context);
    observeTargets();
  };

  const ensure = () => {
    if (!document.documentElement || window.__CLAUDE_AURA_DISABLED__) return;
    const codeContext = codeRouteContext();
    /*__AURA_CODE_ACTIVE_START__*/
    if (codeCleanupRetry > 2 || (!codeContext && codeCleanupRetry === 2)) return;
    /*__AURA_CODE_ACTIVE_END__*/
    if (codeContext) {
      /*__AURA_CODE_ACTIVE_START__*/
      codeCleanupRetry = 0;
      /*__AURA_CODE_ACTIVE_END__*/
      if (currentContext !== codeContext) enterCodeRoute(codeContext);
      /*__AURA_CODE_ACTIVE_START__*/
      else {
        codeAdapter.activate(codeContext);
        observeTargets();
      }
      /*__AURA_CODE_ACTIVE_END__*/
      return;
    }
    if (currentContext === "code-list" || currentContext === "code-session") {
      /*__AURA_CODE_ACTIVE_START__*/
      if (!
      /*__AURA_CODE_ACTIVE_END__*/
      codeAdapter.rollback()
      /*__AURA_CODE_ACTIVE_START__*/
      ) {
        if (codeCleanupRetry < 2 && !codeCleanupRetry++) scheduleEnsure();
        return;
      }
      codeCleanupRetry = 0;
      /*__AURA_CODE_ACTIVE_END__*/
      ;
      currentContext = "other";
      rootDirty = styleDirty = true;
    }
    const html = document.documentElement;
    if (rootNeedsRepair()) rootDirty = true;
    if (rootDirty) {
      html.classList.add("claude-aura");
      html.classList.toggle("claude-aura-reduce-motion", Boolean(settings.reduceMotion));
      html.classList.toggle("claude-aura-animated-image", Boolean(settings.imageAnimated));
      html.dataset.claudeAuraTheme = settings.theme;
      for (const [k, v] of Object.entries(rd())) html.dataset[k] = v;
      for (const [k, v] of Object.entries(rs())) html.style.setProperty(k, v);
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
          if (/^layer-[a-f0-9]{32}$/.test(layer.i)) element.id = layer.i;
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
          if (Array.isArray(layer.f) && layer.f.length === 5) {
            element.style.setProperty("filter", `hue-rotate(${layer.f[0]}deg) saturate(${layer.f[1]}) brightness(${layer.f[2]}) contrast(${layer.f[3]}) blur(${layer.f[4]}px)`);
          }
          artBindings.push({ element, image: frameImage, layer });
        }
      } else {
        artBindings = [];
        addLayerDiv("claude-aura-theme-art");
      }
      addLayerDiv("claude-aura-grain");
      addLayerDiv("claude-aura-vignette");
      backdrop.dataset.artScope = settings.q === "s"
        ? "sidebar"
        : settings.q === "c" ? "content" : "full-window";
      document.body.prepend(backdrop);
    }
    syncSemanticLayout();
    observeTargets();
  };

  let scheduled = null, responsiveAnimationFrame = 0;
  const cleanup = (replacementOnly = false) => {
    /*__AURA_CODE_ACTIVE_START__*/
    if (!
    /*__AURA_CODE_ACTIVE_END__*/
    codeAdapter.rollback()
    /*__AURA_CODE_ACTIVE_START__*/
    ) {
      if (codeCleanupRetry === 3) codeCleanupRetry = 4;
      else if (codeCleanupRetry !== 4) {
        codeCleanupRetry = 3;
        scheduleEnsure();
      }
      return false;
    }
    codeCleanupRetry = 0;
    /*__AURA_CODE_ACTIVE_END__*/
    ;
    if (scheduled) clearTimeout(scheduled);
    scheduled = null;
    if (responsiveAnimationFrame) window.cancelAnimationFrame?.(responsiveAnimationFrame);
    responsiveAnimationFrame = 0;
    /*__AURA_INSTANT_PROMPTS_START__*/
    clearInstantPrompts?.();
    /*__AURA_INSTANT_PROMPTS_END__*/
    if (replacementOnly) return true;
    window.__CLAUDE_AURA_DISABLED__ = true;
    observer.disconnect();
    stopMode();
    stopContext();
    clearBrand();
    clearAvatar?.();
    clearGreeting?.(true);
    clearMarks();
    document.getElementById(STYLE_ID)?.remove();
    document.getElementById(BACKDROP_ID)?.remove();
    clearAuraRoot();
    delete window[STATE_KEY];
    return true;
  };

  window.__CLAUDE_AURA_DISABLED__ = false;
  const scheduleEnsure = () => {
    /*__AURA_CODE_ACTIVE_START__*/
    if (codeCleanupRetry === 2 || codeCleanupRetry === 4) return;
    if (scheduled && codeRouteContext()) return;
    /*__AURA_CODE_ACTIVE_END__*/
    if (scheduled) clearTimeout(scheduled);
    scheduled = setTimeout(() => {
      scheduled = null;
      /*__AURA_CODE_ACTIVE_START__*/
      if (codeCleanupRetry === 3) cleanup();
      else
      /*__AURA_CODE_ACTIVE_END__*/
        ensure();
    }, 160);
  };
  const onContextSignal = () => scheduleEnsure(),
    onPromptInput=e=>e.target?.closest?.(`[${PROMPT_MARKER}="authored"]`)&&scheduleEnsure();
  const onResize = () => {
    if (!responsiveTrack) return scheduleEnsure();
    if (responsiveAnimationFrame) return;
    responsiveAnimationFrame = window.requestAnimationFrame(() => {
      responsiveAnimationFrame = 0;
      ensure();
    });
  };
  const onPopState = () => {
    if (!window.navigation) advanceGreetingVisit?.();
    scheduleEnsure();
  };
  let greetingNavigationKey = window.navigation?.currentEntry?.key;
  const onNavigationSignal = () => {
    const nextKey = window.navigation?.currentEntry?.key;
    if (nextKey !== greetingNavigationKey) {
      greetingNavigationKey = nextKey;
      advanceGreetingVisit?.();
    }
    scheduleEnsure();
  };
  let t=0;
  const onVis=()=>{clearInterval(t);t=document["hidden"]?0:setInterval(ensure,15e3);if(t&&window[STATE_KEY])ensure()};
  window.addEventListener("popstate", onPopState);
  window.addEventListener("resize", onResize, { passive: true });
  document.addEventListener?.("input", onPromptInput, true);
  document.addEventListener?.("fullscreenchange", onContextSignal);
  document.addEventListener?.("visibilitychange", onVis);
  window.navigation?.addEventListener?.("currententrychange", onNavigationSignal);
  const stopContext = () => {
    clearInterval(t);
    window.removeEventListener("popstate", onPopState);
    window.removeEventListener("resize", onResize);
    document.removeEventListener?.("input", onPromptInput, true);
    document.removeEventListener?.("fullscreenchange", onContextSignal);
    document.removeEventListener?.("visibilitychange", onVis);
    window.navigation?.removeEventListener?.("currententrychange", onNavigationSignal);
  };
  let observedHead = null;
  let observedBody = null;
  let observedStyle = null;
  let observedBackdrop = null;
  let observedCodeRoute = false;
  const rootNeedsRepair = () => !root.classList.contains("claude-aura")
    || root.dataset.claudeAuraTheme !== settings.theme
    || root.classList.contains("claude-aura-reduce-motion") !== Boolean(settings.reduceMotion)
    || root.classList.contains("claude-aura-animated-image") !== Boolean(settings.imageAnimated)
    || Object.entries(rd()).some(([k, v]) => root.dataset[k] !== v)
    || Object.entries(rs()).some(([k, v]) => root.style.getPropertyValue(k) !== v);
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
        if (
          /*__AURA_CODE_ACTIVE_START__*/
          observedCodeRoute ||
          /*__AURA_CODE_ACTIVE_END__*/
          record.type === "childList"
        ) return true;
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
    const codeRoute = Boolean(codeRouteContext());
    if (head === observedHead && body === observedBody && style === observedStyle
        && backdrop === observedBackdrop && codeRoute === observedCodeRoute) return;
    observer.disconnect();
    if (codeRoute) {
      /*__AURA_CODE_ACTIVE_START__*/
      observer.observe(document.documentElement, { childList: true });
      if (body) observer.observe(body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["role", "aria-hidden", "hidden", "open", "class", "style"],
      });
      /*__AURA_CODE_ACTIVE_END__*/
      observedHead = head;
      observedBody = body;
      observedStyle = style;
      observedBackdrop = backdrop;
      observedCodeRoute = true;
      return;
    }
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
    observedCodeRoute = false;
  };
  onVis();
  window[STATE_KEY] = {
    "cleanup": cleanup,
    "ensure": ensure,
    "observer": observer,
    stopModeListener: stopMode,
    stopContextListeners: stopContext,
    "getLayoutProbe": lp,
    "responsiveLayoutResolver": responsiveTrack ? {
      "track": responsiveTrack,
      "value": responsiveValue,
      "layoutId": responsiveLayoutId,
    } : null,
    "discoverComposer": discoverComposer,
    clearBrandWordmark: clearBrand,
    clearAvatarOverlay: clearAvatar,
    /*__AURA_INSTANT_PROMPTS_START__*/
    clearInstantPrompts,
    /*__AURA_INSTANT_PROMPTS_END__*/
    cg: (endVisit = true) => clearGreeting?.(endVisit),
    "greetingMemory": greetingMemory,
    "getGreetingProbe": getGreetingProbe,
    clearMarkedElements: clearMarks,
    version: settings.version,
    theme: settings.theme,
    digest: settings.digest,
  };
  ensure();
  return {
    installed: true,
    version: settings.version,
    theme: settings.theme,
    digest: settings.digest,
    gm: greetingMatches,
  };
})(__AURA_CSS_JSON__, __AURA_SETTINGS_JSON__)
