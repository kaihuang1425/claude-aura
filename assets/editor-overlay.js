((config) => {
  "use strict";

  const ROOT_ID = "claude-aura-editor-overlay";
  const ROOT_MARKER = "data-claude-aura-editor-overlay";
  const STATE_KEY = "__CLAUDE_AURA_EDITOR_OVERLAY__";
  const LAYER_ID = /^layer-[a-f0-9]{32}$/;
  const WIDGET_ID = /^prompt-[a-f0-9]{32}$/;
  const LAYOUT_ID = /^[a-z][a-z0-9-]{0,31}$/;
  const SESSION_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
  const NONCE = /^[a-f0-9]{32}$/;
  const TOKEN_IDS = new Set([
    "canvas", "sidebar", "surface", "text", "accent", "border",
  ]);
  const GREETING_TARGET = "interface.greeting";
  const TARGETS = new Set([
    "interface.theme", "interface.sidebar", "interface.sidebar-identity", "interface.prompt-block", GREETING_TARGET, "background.layer",
    "widgets.instant-prompts",
  ]);
  const COPY_KEYS = [
    "title", "pick", "done", "move", "scale", "opacity", "keyboard",
    "selected", "missing", "ambiguous",
  ];
  const exact = (value, keys) => value && typeof value === "object" && !Array.isArray(value)
    && Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));
  const finite = (value, minimum, maximum) => typeof value === "number"
    && Number.isFinite(value) && value >= minimum && value <= maximum;
  const validFrame = (value, positionMinimum, positionMaximum, scaleMinimum, scaleMaximum) => (
    exact(value, ["positionX", "positionY", "scale"])
    && finite(value.positionX, positionMinimum, positionMaximum)
    && finite(value.positionY, positionMinimum, positionMaximum)
    && finite(value.scale, scaleMinimum, scaleMaximum)
  );
  const validItem = (
    value, pattern, positionMinimum, positionMaximum, scaleMinimum, scaleMaximum,
  ) => exact(value, ["id", "opacity", "frames"])
    && typeof value.id === "string" && pattern.test(value.id)
    && finite(value.opacity, 0, 1)
    && exact(value.frames, ["normal", "wide"])
    && validFrame(value.frames.normal, positionMinimum, positionMaximum, scaleMinimum, scaleMaximum)
    && validFrame(value.frames.wide, positionMinimum, positionMaximum, scaleMinimum, scaleMaximum);
  const validResponsiveTuple = (value, bounds) => value === null || (
    Array.isArray(value) && value.length === bounds.length
    && value.every((entry, index) => entry === null
      || finite(entry, bounds[index][0], bounds[index][1]))
  );
  const validResponsiveTrack = (value) => exact(value, ["mode", "ids", "widths", "breakpoints"])
    && ["step", "fluid"].includes(value.mode)
    && Array.isArray(value.ids) && value.ids.length >= 1 && value.ids.length <= 6
    && value.ids.every((id) => typeof id === "string" && LAYOUT_ID.test(id))
    && new Set(value.ids).size === value.ids.length
    && Array.isArray(value.widths) && value.widths.length === value.ids.length
    && value.widths.every((width, index) => Number.isInteger(width)
      && width >= 920 && width <= 3840
      && (index === 0 || width > value.widths[index - 1]))
    && (value.mode === "fluid"
      ? value.breakpoints === null
      : Array.isArray(value.breakpoints) && value.breakpoints.length === value.ids.length - 1
        && value.breakpoints.every((point, index) => finite(
          point, value.widths[index] + Number.EPSILON, value.widths[index + 1] - Number.EPSILON,
        )));
  const validResponsiveItem = (value, pattern, track, bounds) => (
    exact(value, ["id", "opacity", "frames"])
    && typeof value.id === "string" && pattern.test(value.id)
    && finite(value.opacity, 0, 1)
    && Array.isArray(value.frames) && value.frames.length === track.ids.length
    && value.frames.every((frameValue) => validResponsiveTuple(frameValue, bounds))
  );
  const validGreetingFrame = (value) => exact(value, [
    "fontSize", "lineHeight", "maxWidthRatio", "xRatio", "yRatio", "markScale",
  ])
    && finite(value.fontSize, 24, 72)
    && finite(value.lineHeight, 0.9, 1.5)
    && finite(value.maxWidthRatio, 0.35, 0.9)
    && finite(value.xRatio, -0.45, 0.45)
    && finite(value.yRatio, -0.4, 0.45)
    && finite(value.markScale, 0.5, 1.5);
  const validGreeting = (value) => exact(value, ["light", "dark"])
    && ["light", "dark"].every((appearance) => (
      exact(value[appearance], ["standard", "wide"])
      && validGreetingFrame(value[appearance].standard)
      && validGreetingFrame(value[appearance].wide)
    ));
  const validResponsiveGreeting = (value, track) => exact(value, ["light", "dark"])
    && ["light", "dark"].every((appearance) => (
      Array.isArray(value[appearance]) && value[appearance].length === track.ids.length
      && value[appearance].every((frameValue) => validResponsiveTuple(frameValue, [
        [24, 72], [0.9, 1.5], [0.35, 0.9], [-0.45, 0.45], [-0.4, 0.45], [0.5, 1.5],
      ]))
    ));
  const validCopy = (value) => exact(value, COPY_KEYS)
    && COPY_KEYS.every((key) => typeof value[key] === "string"
      && value[key].trim() && value[key].length <= 160
      && !/[\u0000-\u001F\u007F]/u.test(value[key]));
  const validConfig = exact(config, [
    "version", "session", "revision", "nonce", "copy", "responsive", "greeting", "layers", "widgets",
  ]) && config.version === 1 && SESSION_ID.test(config.session)
    && Number.isSafeInteger(config.revision) && config.revision >= 0
    && NONCE.test(config.nonce) && validCopy(config.copy)
    && (config.responsive === null || validResponsiveTrack(config.responsive))
    && (config.responsive === null
      ? validGreeting(config.greeting)
      : validResponsiveGreeting(config.greeting, config.responsive))
    && Array.isArray(config.layers) && config.layers.length <= 8
    && config.layers.every((item) => config.responsive === null
      ? validItem(item, LAYER_ID, -100, 100, 0.25, 3)
      : validResponsiveItem(item, LAYER_ID, config.responsive, [
        [-100, 100], [-100, 100], [0, 100], [0, 100], [0.25, 3],
      ]))
    && new Set(config.layers.map((item) => item.id)).size === config.layers.length
    && Array.isArray(config.widgets) && config.widgets.length <= 12
    && config.widgets.every((item) => config.responsive === null
      ? validItem(item, WIDGET_ID, -50, 50, 0.5, 1.75)
      : validResponsiveItem(item, WIDGET_ID, config.responsive, [
        [-50, 50], [-50, 50], [0.5, 1.5], [0.5, 1.75], [-120, 120], [-120, 120],
      ]))
    && new Set(config.widgets.map((item) => item.id)).size === config.widgets.length;
  if (!validConfig || !document?.documentElement || !document.body) return false;

  const previousRoot = document.getElementById(ROOT_ID);
  const previousState = window[STATE_KEY];
  if (previousRoot) {
    if (previousRoot.getAttribute?.(ROOT_MARKER) !== "true"
        || previousState?.root !== previousRoot || typeof previousState.stop !== "function") return false;
    previousState.stop("replace", false);
    if (document.getElementById(ROOT_ID)) return false;
  }

  const copy = config.copy;
  const layerById = new Map(config.layers.map((item) => [item.id, item]));
  const widgetById = new Map(config.widgets.map((item) => [item.id, item]));
  const responsive = window.__CLAUDE_AURA_STATE__?.responsiveLayoutResolver ?? null;
  const sameResponsiveTrack = config.responsive === null
    ? responsive === null
    : responsive && responsive.track?.mode === config.responsive.mode
      && JSON.stringify(responsive.track.ids) === JSON.stringify(config.responsive.ids)
      && JSON.stringify(responsive.track.widths) === JSON.stringify(config.responsive.widths)
      && JSON.stringify(responsive.track.breakpoints) === JSON.stringify(config.responsive.breakpoints ?? []);
  if (!sameResponsiveTrack) return false;
  const layout = () => responsive?.layoutId?.() ?? null;
  const frame = () => {
    const activeLayout = layout();
    if (activeLayout) return activeLayout;
    const active = document.documentElement.getAttribute?.("data-claude-aura-viewport");
    return active === "wide" || (active !== "normal" && window.innerWidth >= 1440)
      ? "wide" : "normal";
  };
  const greetingFrame = () => layout() ?? (frame() === "wide" ? "wide" : "standard");
  const greetingAppearance = () => document.documentElement
    .getAttribute?.("data-claude-aura-effective-mode") === "dark" ? "dark" : "light";
  const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));
  const rounded = (value, precision = 100) => Math.round(value * precision) / precision;
  const rectValue = (node) => {
    const rect = node?.getBoundingClientRect?.();
    if (!rect || rect.width <= 0 || rect.height <= 0) return null;
    return {
      left: rounded(rect.left), top: rounded(rect.top),
      width: rounded(rect.width), height: rounded(rect.height),
    };
  };
  const inRect = (rect, x, y) => rect && x >= rect.left && x <= rect.left + rect.width
    && y >= rect.top && y <= rect.top + rect.height;
  const closest = (node, selector) => {
    try { return node?.closest?.(selector) ?? null; } catch { return null; }
  };
  const artworkOwner = (id) => {
    const owner = document.getElementById?.(id) ?? null;
    const classes = owner?.getAttribute?.("class")?.split(/\s+/u) ?? [];
    return owner?.parentElement?.id === "claude-aura-backdrop"
      && classes.includes("claude-aura-theme-art-layer") ? owner : null;
  };
  const promptWidget = (id) => {
    if (!WIDGET_ID.test(id ?? "") || !widgetById.has(id)) return null;
    let node = null;
    try {
      node = document.querySelector?.(`[data-claude-aura-instant-prompt-card="${id}"]`) ?? null;
    } catch { return null; }
    return closest(node, '[data-claude-aura-instant-prompts="true"]') ? node : null;
  };
  const greetingOwner = (node) => {
    const selector = '[data-claude-aura-greeting="new-chat"],[data-claude-aura-greeting="native"]';
    const candidate = closest(node, selector);
    if (!candidate) return null;
    const owners = Array.from(document.querySelectorAll?.(selector) ?? [])
      .filter((owner) => rectValue(owner));
    if (owners.length !== 1 || owners[0] !== candidate) {
      return { status: "ambiguous", node: null };
    }
    return { status: "found", node: candidate };
  };
  const itemGeometry = (item) => {
    const activeFrame = frame();
    if (config.responsive !== null) {
      const widget = WIDGET_ID.test(item.id);
      const fields = widget
        ? ["positionX", "positionY", "widthRatio", "scale", "offsetX", "offsetY"]
        : ["positionX", "positionY", "focalX", "focalY", "scale"];
      const inherited = widget ? [0, 0, 1, 1, 0, 0] : [0, 0, 50, 50, 1];
      const resolved = responsive.value(item.frames, inherited, fields, Object.fromEntries(
        fields.map((field) => [field, 2]),
      )).value;
      return {
        opacity: item.opacity,
        frame: activeFrame,
        positionX: resolved.positionX,
        positionY: resolved.positionY,
        scale: resolved.scale,
      };
    }
    const authored = item.frames[activeFrame];
    return {
      opacity: item.opacity,
      frame: activeFrame,
      positionX: authored.positionX,
      positionY: authored.positionY,
      scale: authored.scale,
    };
  };
  const greetingGeometry = () => {
    const appearance = greetingAppearance();
    const activeFrame = greetingFrame();
    if (config.responsive !== null) {
      const resolved = responsive.value(
        config.greeting[appearance],
        [34, 1.15, 0.72, 0, 0, 1],
        ["fontSize", "lineHeight", "maxWidthRatio", "xRatio", "yRatio", "markScale"],
        { fontSize: 2, lineHeight: 2, maxWidthRatio: 2, xRatio: 2, yRatio: 2, markScale: 2 },
      ).value;
      return { appearance, frame: activeFrame, ...resolved };
    }
    return {
      appearance,
      frame: activeFrame,
      ...config.greeting[appearance][activeFrame],
    };
  };

  let sequence = 0;
  let stopped = false;
  let picking = false;
  let selected = null;
  let selectedNode = null;
  let selectedBase = null;
  let selectedProxyRect = null;
  let drag = null;
  let previewFrame = 0;
  let pendingPreview = null;

  const post = (event, payload) => {
    if (stopped || !window.chrome?.webview?.postMessage) return false;
    sequence += 1;
    window.chrome.webview.postMessage({
      type: "aura-editor-overlay",
      version: 1,
      session: config.session,
      revision: config.revision,
      nonce: config.nonce,
      sequence,
      event,
      payload,
    });
    return true;
  };

  const root = document.createElement("div");
  root.id = ROOT_ID;
  root.setAttribute(ROOT_MARKER, "true");
  root.setAttribute("aria-label", copy.title);
  const shadow = root.attachShadow({ mode: "closed" });
  const style = document.createElement("style");
  style.textContent = `
    :host{all:initial;position:fixed;inset:0;z-index:2147483647;pointer-events:none;color-scheme:light dark}
    *{box-sizing:border-box}
    .bar{position:fixed;inset-block-start:14px;inset-inline-start:50%;translate:-50% 0;display:flex;align-items:center;gap:8px;max-inline-size:min(760px,calc(100vw - 28px));padding:8px 10px;border:1px solid CanvasText;border-radius:12px;background:Canvas;color:CanvasText;box-shadow:0 10px 32px rgb(0 0 0/.28);font:600 13px/1.3 system-ui,sans-serif;pointer-events:auto}
    .title{font-weight:750;white-space:nowrap}.status{min-inline-size:80px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:500;opacity:.78}
    button,input{font:inherit}button{min-block-size:32px;padding:5px 10px;border:1px solid ButtonBorder;border-radius:8px;background:ButtonFace;color:ButtonText;cursor:pointer}button:focus-visible,input:focus-visible{outline:3px solid Highlight;outline-offset:2px}
    .done{margin-inline-start:auto}.ring{position:fixed;border:2px solid Highlight;border-radius:8px;box-shadow:0 0 0 2px Canvas,0 6px 24px rgb(0 0 0/.24);pointer-events:none}.ring[hidden]{display:none}
    .handle{position:absolute;inline-size:30px;block-size:30px;padding:0;border-radius:50%;display:grid;place-items:center;pointer-events:auto;touch-action:none}.move{inset-block-start:-16px;inset-inline-start:50%;translate:-50% 0}.scale{inset-inline-end:-16px;inset-block-end:-16px;cursor:nwse-resize}.handle::before{content:'';inline-size:9px;block-size:9px;border:2px solid currentColor;border-radius:2px}
    .geometry{position:absolute;inset-block-start:calc(100% + 10px);inset-inline-start:0;display:flex;align-items:center;gap:7px;min-inline-size:220px;padding:7px 9px;border:1px solid CanvasText;border-radius:9px;background:Canvas;color:CanvasText;box-shadow:0 8px 24px rgb(0 0 0/.24);font:600 12px/1.2 system-ui,sans-serif;pointer-events:auto}.geometry label{display:flex;align-items:center;gap:6px}.geometry input{inline-size:92px}.tokens{display:flex;gap:5px;overflow:hidden}.token{padding:2px 5px;border:1px solid currentColor;border-radius:999px;font:600 10px/1 system-ui,sans-serif;white-space:nowrap}
    .pick-cover{position:fixed;inset:0;background:transparent;cursor:crosshair;pointer-events:auto}.pick-cover[hidden]{display:none}
    @media(forced-colors:active){.bar,.ring,.geometry{box-shadow:none}}
    @media(prefers-reduced-motion:no-preference){.ring{transition:left 70ms linear,top 70ms linear,width 70ms linear,height 70ms linear}}
  `;
  const bar = document.createElement("div");
  bar.className = "bar";
  bar.setAttribute("role", "toolbar");
  bar.setAttribute("aria-label", copy.title);
  const title = document.createElement("strong");
  title.className = "title";
  title.textContent = copy.title;
  const pickButton = document.createElement("button");
  pickButton.type = "button";
  pickButton.textContent = copy.pick;
  const status = document.createElement("span");
  status.className = "status";
  status.setAttribute("role", "status");
  status.textContent = copy.keyboard;
  const tokenList = document.createElement("span");
  tokenList.className = "tokens";
  const doneButton = document.createElement("button");
  doneButton.type = "button";
  doneButton.className = "done";
  doneButton.textContent = copy.done;
  bar.append(title, pickButton, status, tokenList, doneButton);
  const pickCover = document.createElement("div");
  pickCover.className = "pick-cover";
  pickCover.hidden = true;
  pickCover.setAttribute("aria-hidden", "true");
  const ring = document.createElement("div");
  ring.className = "ring";
  ring.hidden = true;
  const moveHandle = document.createElement("button");
  moveHandle.type = "button";
  moveHandle.className = "handle move";
  moveHandle.setAttribute("aria-label", copy.move);
  const scaleHandle = document.createElement("button");
  scaleHandle.type = "button";
  scaleHandle.className = "handle scale";
  scaleHandle.setAttribute("aria-label", copy.scale);
  const geometryBar = document.createElement("div");
  geometryBar.className = "geometry";
  const opacityLabel = document.createElement("label");
  opacityLabel.textContent = copy.opacity;
  const opacityInput = document.createElement("input");
  opacityInput.type = "range";
  opacityInput.min = "0";
  opacityInput.max = "100";
  opacityInput.step = "1";
  opacityInput.setAttribute("aria-label", copy.opacity);
  opacityLabel.appendChild(opacityInput);
  geometryBar.appendChild(opacityLabel);
  ring.append(moveHandle, scaleHandle, geometryBar);
  shadow.append(style, pickCover, ring, bar);
  document.documentElement.appendChild(root);

  const publicSelection = (selection) => ({
    status: selection.status,
    kind: selection.kind,
    targetId: selection.targetId,
    itemId: selection.itemId,
    tokenIds: [...selection.tokenIds],
    rect: selection.rect ? { ...selection.rect } : null,
    viewport: {
      width: window.innerWidth,
      height: window.innerHeight,
      frame: frame(),
    },
    geometry: selection.geometry ? { ...selection.geometry } : null,
  });

  const selectionFor = (statusValue, kind, targetId, itemId, tokenIds, node = null, geometry = null) => ({
    status: statusValue,
    kind,
    targetId,
    itemId,
    tokenIds: tokenIds.filter((token) => TOKEN_IDS.has(token)),
    rect: statusValue === "found" ? rectValue(node) : null,
    geometry,
  });
  const interfaceSelection = (itemId, node, tokenIds, targetId = "interface.theme") => (
    selectionFor("found", "interface", targetId, itemId, tokenIds, node, null)
  );

  const probeAt = (x, y, node) => {
    const widgetCandidate = closest(node, "[data-claude-aura-instant-prompt-card]");
    const widget = widgetCandidate && promptWidget(
      widgetCandidate.getAttribute?.("data-claude-aura-instant-prompt-card"),
    ) === widgetCandidate ? widgetCandidate : null;
    const widgetId = widget?.getAttribute?.("data-claude-aura-instant-prompt-card");
    if (widget && WIDGET_ID.test(widgetId ?? "") && widgetById.has(widgetId)) {
      return {
        selection: selectionFor(
          "found", "widget", "widgets.instant-prompts", widgetId,
          ["surface", "text", "border", "accent"], widget, itemGeometry(widgetById.get(widgetId)),
        ),
        node: widget,
      };
    }
    const greeting = greetingOwner(node);
    if (greeting) {
      return greeting.status === "found" ? {
        selection: selectionFor(
          "found", "interface", GREETING_TARGET, "interface.greeting",
          ["text", "accent"], greeting.node, greetingGeometry(),
        ),
        node: greeting.node,
      } : {
        selection: selectionFor(
          "ambiguous", "interface", GREETING_TARGET, null, [], null, null,
        ),
        node: null,
      };
    }
    const dialog = closest(node, "dialog,[role=dialog]");
    if (dialog) return {
      selection: interfaceSelection("interface.dialog", dialog, ["surface", "text", "border", "accent"]),
      node: dialog,
    };
    const composer = closest(node, '[data-aura-role="composer-shell"],[data-claude-aura-prompt]');
    if (composer) return {
      selection: interfaceSelection("interface.composer", composer, ["surface", "text", "border", "accent"], "interface.prompt-block"),
      node: composer,
    };
    const card = closest(node, '[data-aura-role="sidebar-row"]');
    if (card) return {
      selection: interfaceSelection("interface.sidebar", card, ["sidebar", "text", "border", "accent"], "interface.sidebar"),
      node: card,
    };
    const identity = closest(node, "[data-claude-aura-brand-image]");
    if (identity) return {
      selection: interfaceSelection("interface.sidebar-identity", identity, ["text", "accent"], "interface.sidebar-identity"),
      node: identity,
    };
    const sidebar = closest(node, "[data-claude-aura-sidebar]");
    if (sidebar) return {
      selection: interfaceSelection("interface.sidebar", sidebar, ["sidebar", "text", "border", "accent"], "interface.sidebar"),
      node: sidebar,
    };
    const art = [];
    for (const [id, item] of layerById) {
      const owner = artworkOwner(id);
      const visual = owner?.querySelector?.("img") ?? owner;
      const rect = rectValue(visual);
      if (visual && inRect(rect, x, y)) art.push({ id, item, owner, visual });
    }
    if (art.length > 1) {
      return {
        selection: selectionFor("ambiguous", "background", "background.layer", null, [], null, null),
        node: null,
      };
    }
    if (art.length === 1) {
      return {
        selection: selectionFor(
          "found", "background", "background.layer", art[0].id, [],
          art[0].visual, itemGeometry(art[0].item),
        ),
        node: art[0].owner,
        ringNode: art[0].visual,
      };
    }
    const canvas = closest(node, "[data-claude-aura-main-canvas]");
    if (canvas) return {
      selection: interfaceSelection("interface.canvas", canvas, ["canvas", "text"]),
      node: canvas,
    };
    return {
      selection: selectionFor("missing", "interface", "interface.theme", null, [], null, null),
      node: null,
    };
  };

  const restoreSelectedStyle = () => {
    if (!selectedNode || !selectedBase) return;
    if (selected?.kind === "widget") {
      for (const [name, value] of Object.entries(selectedBase.properties)) {
        if (value) selectedNode.style.setProperty(name, value);
        else selectedNode.style.removeProperty(name);
      }
      selectedNode.style.opacity = selectedBase.opacity;
    } else if (selected?.kind === "background") {
      selectedNode.style.translate = selectedBase.translate;
      selectedNode.style.scale = selectedBase.scale;
      selectedNode.style.opacity = selectedBase.opacity;
    }
    selectedBase = null;
    selectedProxyRect = null;
  };
  const captureSelectedStyle = () => {
    if (!selectedNode || !selected?.geometry) return null;
    if (selected.kind === "widget") return {
      opacity: selectedNode.style.opacity,
      properties: Object.fromEntries([
        "--aura-widget-x", "--aura-widget-y", "--aura-widget-scale",
      ].map((name) => [name, selectedNode.style.getPropertyValue(name)])),
      geometry: { ...selected.geometry },
    };
    if (selected.kind === "background") return {
      translate: selectedNode.style.translate,
      scale: selectedNode.style.scale,
      opacity: selectedNode.style.opacity,
      geometry: { ...selected.geometry },
    };
    if (selected.targetId === GREETING_TARGET) return {
      geometry: { ...selected.geometry },
      rect: rectValue(selectedNode),
    };
    return null;
  };
  const resolveSelectedNode = () => {
    if (!selected || selected.status !== "found") return null;
    if (selected.kind === "widget") {
      return promptWidget(selected.itemId);
    }
    if (selected.kind === "background") {
      return artworkOwner(selected.itemId);
    }
    if (selected.targetId === GREETING_TARGET) {
      return document.querySelector?.(
        '[data-claude-aura-greeting="new-chat"],[data-claude-aura-greeting="native"]',
      ) ?? null;
    }
    const selectors = {
      "interface.dialog": "dialog,[role=dialog]",
      "interface.composer": '[data-aura-role="composer-shell"],[data-claude-aura-prompt]',
      "interface.card": '[data-aura-role="sidebar-row"]',
      "interface.sidebar": "[data-claude-aura-sidebar]",
      "interface.canvas": "[data-claude-aura-main-canvas]",
    };
    return document.querySelector?.(selectors[selected.itemId]) ?? null;
  };
  const ringTarget = () => selected?.kind === "background"
    ? selectedNode?.querySelector?.("img") ?? selectedNode : selectedNode;
  const updateRing = () => {
    if (stopped) return;
    if (!selected || selected.status !== "found") {
      ring.hidden = true;
      return;
    }
    if (!selectedNode?.isConnected) selectedNode = resolveSelectedNode();
    const rect = selectedProxyRect ?? rectValue(ringTarget());
    if (!rect) {
      ring.hidden = true;
      return;
    }
    selected.rect = rect;
    ring.hidden = false;
    ring.style.left = `${rect.left}px`;
    ring.style.top = `${rect.top}px`;
    ring.style.width = `${rect.width}px`;
    ring.style.height = `${rect.height}px`;
    const editable = Boolean(selected.geometry && (
      ["background", "widget"].includes(selected.kind) || selected.targetId === GREETING_TARGET
    ));
    const opacityEditable = editable && selected.targetId !== GREETING_TARGET;
    moveHandle.hidden = !editable;
    scaleHandle.hidden = !editable;
    geometryBar.hidden = !opacityEditable;
    if (opacityEditable) opacityInput.value = String(Math.round(selected.geometry.opacity * 100));
  };
  const renderTokens = () => {
    tokenList.replaceChildren(...(selected?.tokenIds ?? []).map((tokenId) => {
      const chip = document.createElement("span");
      chip.className = "token";
      chip.textContent = tokenId;
      return chip;
    }));
  };
  const setSelection = (result) => {
    restoreSelectedStyle();
    selected = result.selection;
    selectedNode = result.node;
    selectedProxyRect = null;
    if (result.ringNode) selected.rect = rectValue(result.ringNode);
    selectedBase = captureSelectedStyle();
    status.textContent = copy[selected.status === "found" ? "selected" : selected.status];
    renderTokens();
    updateRing();
    post("selection", publicSelection(selected));
  };

  const applyGeometry = (geometry) => {
    if (!selectedNode || !selectedBase || !geometry) return;
    if (selected.kind === "widget") {
      selectedNode.style.setProperty("--aura-widget-x", `${geometry.positionX}vw`);
      selectedNode.style.setProperty("--aura-widget-y", `${geometry.positionY}vh`);
      selectedNode.style.setProperty("--aura-widget-scale", String(geometry.scale));
      selectedNode.style.opacity = String(geometry.opacity);
    } else if (selected.kind === "background") {
      const base = selectedBase.geometry;
      selectedNode.style.translate = `${geometry.positionX - base.positionX}vw ${geometry.positionY - base.positionY}vh`;
      selectedNode.style.scale = String(geometry.scale / base.scale);
      selectedNode.style.opacity = String(geometry.opacity);
    } else if (selected.targetId === GREETING_TARGET && selectedBase.rect) {
      const base = selectedBase.geometry;
      const canvas = rectValue(document.querySelector?.("[data-claude-aura-main-canvas]"))
        ?? { width: window.innerWidth, height: window.innerHeight };
      const fontScale = geometry.fontSize / base.fontSize;
      const widthScale = geometry.maxWidthRatio / base.maxWidthRatio;
      const lineScale = Math.sqrt(geometry.lineHeight / base.lineHeight);
      const width = clamp(
        selectedBase.rect.width * Math.max(fontScale, widthScale),
        12, Math.max(12, canvas.width),
      );
      const height = clamp(
        selectedBase.rect.height * fontScale * lineScale,
        8, Math.max(8, canvas.height),
      );
      selectedProxyRect = {
        left: selectedBase.rect.left + ((geometry.xRatio - base.xRatio) * canvas.width)
          - ((width - selectedBase.rect.width) / 2),
        top: selectedBase.rect.top + ((geometry.yRatio - base.yRatio) * canvas.height)
          - ((height - selectedBase.rect.height) / 2),
        width,
        height,
      };
    }
    selected.geometry = geometry;
    updateRing();
  };
  const flushPreview = () => {
    previewFrame = 0;
    if (!pendingPreview || !selected) return;
    const geometry = pendingPreview;
    pendingPreview = null;
    post("preview", publicSelection({ ...selected, geometry }));
  };
  const previewGeometry = (geometry) => {
    applyGeometry(geometry);
    pendingPreview = geometry;
    if (!previewFrame) previewFrame = requestAnimationFrame(flushPreview);
  };
  const commitGeometry = (geometry) => {
    if (previewFrame) cancelAnimationFrame(previewFrame);
    previewFrame = 0;
    pendingPreview = null;
    applyGeometry(geometry);
    post("commit", publicSelection({ ...selected, geometry }));
  };

  const beginPick = () => {
    picking = true;
    pickCover.hidden = false;
    status.textContent = copy.pick;
  };
  const endPick = () => {
    picking = false;
    pickCover.hidden = true;
  };
  const onPick = (event) => {
    if (!picking || stopped) return;
    event.preventDefault();
    event.stopPropagation();
    endPick();
    pickCover.style.pointerEvents = "none";
    const node = document.elementFromPoint?.(event.clientX, event.clientY);
    pickCover.style.pointerEvents = "auto";
    setSelection(probeAt(event.clientX, event.clientY, node));
  };

  const geometryFromDrag = (event) => {
    if (!drag) return null;
    const next = { ...drag.start };
    const greeting = selected?.targetId === GREETING_TARGET;
    const background = selected?.kind === "background";
    const positionMinimum = background ? -100 : -50;
    const positionMaximum = background ? 100 : 50;
    const scaleMinimum = background ? 0.25 : 0.5;
    const scaleMaximum = background ? 3 : 1.75;
    const canvas = greeting
      ? rectValue(document.querySelector?.("[data-claude-aura-main-canvas]"))
        ?? { width: window.innerWidth, height: window.innerHeight }
      : null;
    if (drag.kind === "move") {
      if (greeting) {
        next.xRatio = clamp(
          drag.start.xRatio + ((event.clientX - drag.x) / Math.max(1, canvas.width)),
          -0.45, 0.45,
        );
        next.yRatio = clamp(
          drag.start.yRatio + ((event.clientY - drag.y) / Math.max(1, canvas.height)),
          -0.4, 0.45,
        );
      } else {
        next.positionX = clamp(
          drag.start.positionX + ((event.clientX - drag.x) / Math.max(1, window.innerWidth) * 100),
          positionMinimum, positionMaximum,
        );
        next.positionY = clamp(
          drag.start.positionY + ((event.clientY - drag.y) / Math.max(1, window.innerHeight) * 100),
          positionMinimum, positionMaximum,
        );
      }
    } else {
      const delta = ((event.clientX - drag.x) + (event.clientY - drag.y))
        / Math.max(80, drag.rectSize);
      const factor = Math.max(0.5, Math.min(2, 1 + delta));
      if (greeting) {
        next.fontSize = clamp(drag.start.fontSize * factor, 24, 72);
        next.lineHeight = clamp(drag.start.lineHeight * Math.sqrt(factor), 0.9, 1.5);
        next.maxWidthRatio = clamp(drag.start.maxWidthRatio * factor, 0.35, 0.9);
        next.markScale = clamp(drag.start.markScale * factor, 0.5, 1.5);
      } else {
        next.scale = clamp(drag.start.scale * factor, scaleMinimum, scaleMaximum);
      }
    }
    if (greeting) {
      next.xRatio = rounded(next.xRatio, 100);
      next.yRatio = rounded(next.yRatio, 100);
      next.fontSize = rounded(next.fontSize, 100);
      next.lineHeight = rounded(next.lineHeight, 100);
      next.maxWidthRatio = rounded(next.maxWidthRatio, 100);
      next.markScale = rounded(next.markScale, 100);
    } else {
      next.positionX = rounded(next.positionX);
      next.positionY = rounded(next.positionY);
      next.scale = rounded(next.scale, 1000);
    }
    return next;
  };
  const beginDrag = (kind, event) => {
    if (!selected?.geometry || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const rect = rectValue(ringTarget());
    drag = {
      kind,
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      rectSize: (rect?.width ?? 80) + (rect?.height ?? 40),
      start: { ...selected.geometry },
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };
  const onDragMove = (event) => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    previewGeometry(geometryFromDrag(event));
  };
  const endDrag = (event) => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    const geometry = geometryFromDrag(event);
    drag = null;
    commitGeometry(geometry);
  };
  const onHandleKey = (event) => {
    if (!selected?.geometry || !event.key.startsWith("Arrow")) return;
    const geometry = { ...selected.geometry };
    const greeting = selected.targetId === GREETING_TARGET;
    const background = selected.kind === "background";
    const positionMinimum = background ? -100 : -50;
    const positionMaximum = background ? 100 : 50;
    const scaleMinimum = background ? 0.25 : 0.5;
    const scaleMaximum = background ? 3 : 1.75;
    const direction = ["ArrowRight", "ArrowUp"].includes(event.key) ? 1 : -1;
    if (greeting && event.altKey) {
      const factor = direction > 0 ? 1.05 : 0.95;
      geometry.fontSize = clamp(geometry.fontSize * factor, 24, 72);
      geometry.lineHeight = clamp(geometry.lineHeight * Math.sqrt(factor), 0.9, 1.5);
      geometry.maxWidthRatio = clamp(geometry.maxWidthRatio * factor, 0.35, 0.9);
      geometry.markScale = clamp(geometry.markScale * factor, 0.5, 1.5);
    } else if (greeting && (event.ctrlKey || event.metaKey)) {
      geometry.maxWidthRatio = clamp(geometry.maxWidthRatio + (direction * 0.01), 0.35, 0.9);
    } else if (!greeting && event.altKey) geometry.scale = clamp(
      geometry.scale + (direction * 0.05), scaleMinimum, scaleMaximum,
    );
    else if (!greeting && (event.ctrlKey || event.metaKey)) {
      geometry.opacity = clamp(geometry.opacity + (direction * 0.05), 0, 1);
    } else {
      const pixels = event.shiftKey ? 10 : 1;
      if (greeting && ["ArrowLeft", "ArrowRight"].includes(event.key)) {
        geometry.xRatio = clamp(
          geometry.xRatio + (direction * (event.shiftKey ? 0.05 : 0.01)),
          -0.45, 0.45,
        );
      } else if (greeting) {
        geometry.yRatio = clamp(
          geometry.yRatio + (-direction * (event.shiftKey ? 0.05 : 0.01)),
          -0.4, 0.45,
        );
      } else if (["ArrowLeft", "ArrowRight"].includes(event.key)) {
        geometry.positionX = clamp(
          geometry.positionX + (direction * pixels / Math.max(1, window.innerWidth) * 100),
          positionMinimum, positionMaximum,
        );
      } else {
        geometry.positionY = clamp(
          geometry.positionY + (-direction * pixels / Math.max(1, window.innerHeight) * 100),
          positionMinimum, positionMaximum,
        );
      }
    }
    event.preventDefault();
    if (greeting) {
      geometry.xRatio = rounded(geometry.xRatio, 100);
      geometry.yRatio = rounded(geometry.yRatio, 100);
      geometry.fontSize = rounded(geometry.fontSize, 100);
      geometry.lineHeight = rounded(geometry.lineHeight, 100);
      geometry.maxWidthRatio = rounded(geometry.maxWidthRatio, 100);
      geometry.markScale = rounded(geometry.markScale, 100);
    } else {
      geometry.positionX = rounded(geometry.positionX);
      geometry.positionY = rounded(geometry.positionY);
      geometry.scale = rounded(geometry.scale, 1000);
      geometry.opacity = rounded(geometry.opacity, 1000);
    }
    commitGeometry(geometry);
  };

  const stop = (reason = "done", notify = true) => {
    if (stopped) return;
    if (notify) post("stop", { reason });
    stopped = true;
    restoreSelectedStyle();
    if (previewFrame) cancelAnimationFrame(previewFrame);
    observer?.disconnect?.();
    window.removeEventListener("resize", updateRing);
    window.removeEventListener("scroll", updateRing, true);
    window.removeEventListener("keydown", onWindowKey, true);
    pickCover.removeEventListener("pointerdown", onPick);
    root.remove();
    if (window[STATE_KEY]?.root === root) delete window[STATE_KEY];
  };
  const onWindowKey = (event) => {
    if (event.key !== "Escape" || stopped) return;
    event.preventDefault();
    event.stopPropagation();
    stop("escape");
  };
  const observer = typeof MutationObserver === "function"
    ? new MutationObserver(() => requestAnimationFrame(updateRing)) : null;
  observer?.observe(document.body, { childList: true, subtree: true });
  window.addEventListener("resize", updateRing);
  window.addEventListener("scroll", updateRing, true);
  window.addEventListener("keydown", onWindowKey, true);
  pickCover.addEventListener("pointerdown", onPick);
  pickButton.addEventListener("click", beginPick);
  doneButton.addEventListener("click", () => stop("done"));
  moveHandle.addEventListener("pointerdown", (event) => beginDrag("move", event));
  scaleHandle.addEventListener("pointerdown", (event) => beginDrag("scale", event));
  for (const handle of [moveHandle, scaleHandle]) {
    handle.addEventListener("pointermove", onDragMove);
    handle.addEventListener("pointerup", endDrag);
    handle.addEventListener("pointercancel", endDrag);
    handle.addEventListener("keydown", onHandleKey);
  }
  opacityInput.addEventListener("input", () => {
    if (!selected?.geometry || !Object.hasOwn(selected.geometry, "opacity")) return;
    previewGeometry({ ...selected.geometry, opacity: opacityInput.valueAsNumber / 100 });
  });
  opacityInput.addEventListener("change", () => {
    if (!selected?.geometry || !Object.hasOwn(selected.geometry, "opacity")) return;
    commitGeometry({ ...selected.geometry, opacity: opacityInput.valueAsNumber / 100 });
  });

  window[STATE_KEY] = Object.freeze({ root, stop });
  post("ready", {
    viewport: { width: window.innerWidth, height: window.innerHeight, frame: frame() },
  });
  pickButton.focus();
  return true;
})(__AURA_EDITOR_OVERLAY_CONFIG__);
