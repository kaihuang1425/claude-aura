// WO-26 pure responsive-layout contract. This module has no DOM or filesystem
// dependency so Studio, the renderer factory, and overlay tests can share the
// exact same width resolver.

export const RESPONSIVE_LAYOUT_ID_PATTERN = /^[a-z][a-z0-9-]{0,31}$/u;
export const RESPONSIVE_LAYOUT_LIMITS = Object.freeze({
  minimumSets: 1,
  maximumSets: 6,
  minimumWidth: 920,
  maximumWidth: 3840,
  minimumHeight: 620,
  maximumHeight: 2400,
  maximumLabelLength: 40,
});

export const LEGACY_RESPONSIVE_LAYOUTS = Object.freeze({
  mode: "step",
  axis: "width",
  sets: Object.freeze([
    Object.freeze({ id: "standard", label: "Standard", width: 1180, height: 640 }),
    Object.freeze({ id: "wide", label: "Wide", width: 1560, height: 940 }),
  ]),
  breakpoints: Object.freeze([1440]),
});

export const RESPONSIVE_ARTWORK_FIELDS = Object.freeze({
  positionX: Object.freeze({ minimum: -100, maximum: 100, precision: 2 }),
  positionY: Object.freeze({ minimum: -100, maximum: 100, precision: 2 }),
  focalX: Object.freeze({ minimum: 0, maximum: 100, precision: 2 }),
  focalY: Object.freeze({ minimum: 0, maximum: 100, precision: 2 }),
  scale: Object.freeze({ minimum: 0.25, maximum: 3, precision: 2 }),
});

export const RESPONSIVE_GREETING_FIELDS = Object.freeze({
  fontSize: Object.freeze({ minimum: 24, maximum: 72, precision: 2 }),
  lineHeight: Object.freeze({ minimum: 0.9, maximum: 1.5, precision: 2 }),
  maxWidthRatio: Object.freeze({ minimum: 0.35, maximum: 0.9, precision: 2 }),
  xRatio: Object.freeze({ minimum: -0.45, maximum: 0.45, precision: 2 }),
  yRatio: Object.freeze({ minimum: -0.4, maximum: 0.45, precision: 2 }),
  markScale: Object.freeze({ minimum: 0.5, maximum: 1.5, precision: 2 }),
});

export const RESPONSIVE_PROMPT_FIELDS = Object.freeze({
  widthRatio: Object.freeze({ minimum: 0.4, maximum: 0.96, precision: 4 }),
  offsetXRatio: Object.freeze({ minimum: -0.35, maximum: 0.35, precision: 4 }),
  offsetYRatio: Object.freeze({ minimum: -0.3, maximum: 0.3, precision: 4 }),
});

export const RESPONSIVE_INSTANT_PROMPT_FIELDS = Object.freeze({
  positionX: Object.freeze({ minimum: -50, maximum: 50, precision: 2 }),
  positionY: Object.freeze({ minimum: -50, maximum: 50, precision: 2 }),
  widthRatio: Object.freeze({ minimum: 0.5, maximum: 1.5, precision: 2 }),
  scale: Object.freeze({ minimum: 0.5, maximum: 1.75, precision: 2 }),
  offsetX: Object.freeze({ minimum: -120, maximum: 120, precision: 2 }),
  offsetY: Object.freeze({ minimum: -120, maximum: 120, precision: 2 }),
});

function plain(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function exactKeys(value, keys, label) {
  if (!plain(value)) throw new Error(`${label} must be an object`);
  const actual = Object.keys(value);
  if (actual.length !== keys.length || actual.some((key) => !keys.includes(key))) {
    throw new Error(`${label} has an unsupported property`);
  }
}

function finite(value, label) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${label} must be a finite number`);
  }
  return value;
}

function rounded(value, precision = 4) {
  const scale = 10 ** precision;
  return Math.round((value + Number.EPSILON) * scale) / scale;
}

function validateSet(value, label) {
  exactKeys(value, ["id", "label", "width", "height"], label);
  if (typeof value.id !== "string" || !RESPONSIVE_LAYOUT_ID_PATTERN.test(value.id)) {
    throw new Error(`${label}.id must be a bounded lowercase identifier`);
  }
  if (typeof value.label !== "string"
      || !value.label.trim()
      || value.label.trim().length > RESPONSIVE_LAYOUT_LIMITS.maximumLabelLength
      || /[\u0000-\u001F\u007F]/u.test(value.label)) {
    throw new Error(`${label}.label must be non-empty local text of at most 40 characters`);
  }
  const width = finite(value.width, `${label}.width`);
  const height = finite(value.height, `${label}.height`);
  if (!Number.isInteger(width)
      || width < RESPONSIVE_LAYOUT_LIMITS.minimumWidth
      || width > RESPONSIVE_LAYOUT_LIMITS.maximumWidth) {
    throw new Error(`${label}.width must be an integer between 920 and 3840`);
  }
  if (!Number.isInteger(height)
      || height < RESPONSIVE_LAYOUT_LIMITS.minimumHeight
      || height > RESPONSIVE_LAYOUT_LIMITS.maximumHeight) {
    throw new Error(`${label}.height must be an integer between 620 and 2400`);
  }
  return { id: value.id, label: value.label.trim(), width, height };
}

export function validateResponsiveLayouts(value, label = "responsiveLayouts") {
  exactKeys(value, ["mode", "axis", "sets", "breakpoints"], label);
  if (!["step", "fluid"].includes(value.mode)) {
    throw new Error(`${label}.mode must be step or fluid`);
  }
  if (value.axis !== "width") throw new Error(`${label}.axis must be width`);
  if (!Array.isArray(value.sets)
      || value.sets.length < RESPONSIVE_LAYOUT_LIMITS.minimumSets
      || value.sets.length > RESPONSIVE_LAYOUT_LIMITS.maximumSets) {
    throw new Error(`${label}.sets must contain one to six layout sets`);
  }
  const sets = value.sets.map((set, index) => validateSet(set, `${label}.sets[${index}]`));
  if (new Set(sets.map(({ id }) => id)).size !== sets.length) {
    throw new Error(`${label}.sets ids must be unique`);
  }
  if (sets.some((set, index) => index > 0 && set.width <= sets[index - 1].width)) {
    throw new Error(`${label}.sets must use strictly increasing unique widths`);
  }
  if (value.mode === "fluid") {
    if (value.breakpoints !== null) throw new Error(`${label}.breakpoints must be null in fluid mode`);
    return { mode: "fluid", axis: "width", sets, breakpoints: null };
  }
  if (!Array.isArray(value.breakpoints) || value.breakpoints.length !== sets.length - 1) {
    throw new Error(`${label}.breakpoints must contain exactly one activation width per adjacent pair`);
  }
  let previousBreakpoint = -Infinity;
  const breakpoints = value.breakpoints.map((breakpoint, index) => {
    const normalized = rounded(finite(breakpoint, `${label}.breakpoints[${index}]`), 2);
    if (normalized <= sets[index].width || normalized >= sets[index + 1].width) {
      throw new Error(`${label}.breakpoints[${index}] must be between adjacent layout widths`);
    }
    if (normalized <= previousBreakpoint) {
      throw new Error(`${label}.breakpoints must be strictly increasing`);
    }
    previousBreakpoint = normalized;
    return normalized;
  });
  return { mode: "step", axis: "width", sets, breakpoints };
}

export function validateResponsiveFrames(
  value,
  responsiveLayouts,
  fieldRules,
  label = "responsive frames",
) {
  if (!plain(value)) throw new Error(`${label} must be an object`);
  if (!plain(fieldRules) || Object.keys(fieldRules).length === 0) {
    throw new Error("Responsive frame field rules must be a non-empty object");
  }
  const layouts = validateResponsiveLayouts(responsiveLayouts);
  const registered = new Set(layouts.sets.map(({ id }) => id));
  const result = {};
  for (const [setId, frame] of Object.entries(value)) {
    if (!registered.has(setId)) throw new Error(`${label}.${setId} must use a registered layout set id`);
    if (!plain(frame)) throw new Error(`${label}.${setId} must be an object`);
    const fields = Object.keys(frame);
    if (fields.length === 0) throw new Error(`${label}.${setId} must not be empty`);
    if (fields.some((field) => !Object.hasOwn(fieldRules, field))) {
      throw new Error(`${label}.${setId} has an unsupported property`);
    }
    result[setId] = {};
    for (const field of fields) {
      const rule = fieldRules[field];
      const number = finite(frame[field], `${label}.${setId}.${field}`);
      if (number < rule.minimum || number > rule.maximum) {
        throw new Error(`${label}.${setId}.${field} must be between ${rule.minimum} and ${rule.maximum}`);
      }
      result[setId][field] = rounded(number, rule.precision ?? 4);
    }
  }
  return result;
}

function normalizeInherited(value, fieldRules) {
  if (!plain(value)) throw new Error("Responsive inherited value must be an object");
  const result = {};
  for (const [field, rule] of Object.entries(fieldRules)) {
    const number = finite(value[field], `responsive inherited.${field}`);
    if (number < rule.minimum || number > rule.maximum) {
      throw new Error(`responsive inherited.${field} must be between ${rule.minimum} and ${rule.maximum}`);
    }
    result[field] = rounded(number, rule.precision ?? 4);
  }
  return result;
}

export function createResponsiveResolver() {
  const round = (value, precision = 4) => {
    const scale = 10 ** precision;
    return Math.round((value + Number.EPSILON) * scale) / scale;
  };
  const merge = (base, frame) => ({ ...base, ...(frame ?? {}) });
  return (track, frames, viewportWidth, inherited, precisions = {}) => {
    const widths = track["widths"];
    const explicit = frames.flatMap((frame, index) => frame && Object.keys(frame).length
      ? [{ index, width: widths[index], frame }]
      : []);
    if (!explicit.length) {
      return { "value": { ...inherited }, "source": "inherited", "lowerIndex": null, "upperIndex": null, "t": 0 };
    }
    if (track["mode"] === "step") {
      let activeIndex = 0;
      while (activeIndex < track["breakpoints"].length && viewportWidth >= track["breakpoints"][activeIndex]) {
        activeIndex += 1;
      }
      const point = explicit.findLast((entry) => entry.index <= activeIndex) ?? null;
      return point
        ? { "value": merge(inherited, point.frame), "source": "explicit", "lowerIndex": point.index, "upperIndex": point.index, "t": 0 }
        : { "value": { ...inherited }, "source": "inherited", "lowerIndex": null, "upperIndex": null, "t": 0 };
    }
    if (explicit.length === 1 || viewportWidth <= explicit[0].width) {
      const point = explicit[0];
      return { "value": merge(inherited, point.frame), "source": "explicit", "lowerIndex": point.index, "upperIndex": point.index, "t": 0 };
    }
    const last = explicit[explicit.length - 1];
    if (viewportWidth >= last.width) {
      return { "value": merge(inherited, last.frame), "source": "explicit", "lowerIndex": last.index, "upperIndex": last.index, "t": 0 };
    }
    const upperOffset = explicit.findIndex((entry) => entry.width >= viewportWidth);
    const lower = explicit[upperOffset - 1];
    const upper = explicit[upperOffset];
    if (viewportWidth === upper.width) {
      return { "value": merge(inherited, upper.frame), "source": "explicit", "lowerIndex": upper.index, "upperIndex": upper.index, "t": 0 };
    }
    const t = Math.max(0, Math.min(1,
      (viewportWidth - lower.width) / (upper.width - lower.width)));
    const low = merge(inherited, lower.frame);
    const high = merge(inherited, upper.frame);
    const value = Object.fromEntries(Object.keys(inherited).map((field) => [
      field,
      round(low[field] + ((high[field] - low[field]) * t), precisions[field] ?? 4),
    ]));
    return {
      "value": value,
      "source": "interpolated",
      "lowerIndex": lower.index,
      "upperIndex": upper.index,
      "t": round(t, 4),
    };
  };
}

export function resolveResponsiveFrame(
  responsiveLayouts,
  frames,
  viewportWidth,
  inheritedValue,
  fieldRules,
) {
  const layouts = validateResponsiveLayouts(responsiveLayouts);
  const width = finite(viewportWidth, "viewport width");
  const inherited = normalizeInherited(inheritedValue, fieldRules);
  const normalizedFrames = validateResponsiveFrames(frames ?? {}, layouts, fieldRules);
  const ids = layouts.sets.map(({ id }) => id);
  const result = createResponsiveResolver()(
    {
      mode: layouts.mode,
      widths: layouts.sets.map(({ width: setWidth }) => setWidth),
      breakpoints: layouts.breakpoints ?? [],
    },
    ids.map((id) => normalizedFrames[id] ?? null),
    width,
    inherited,
    Object.fromEntries(Object.entries(fieldRules).map(([field, rule]) => [field, rule.precision ?? 4])),
  );
  return {
    value: result.value,
    source: result.source,
    lowerId: result.lowerIndex === null ? null : ids[result.lowerIndex],
    upperId: result.upperIndex === null ? null : ids[result.upperIndex],
    t: result.t,
  };
}

export function insertResponsiveLayoutSet(responsiveLayouts, set) {
  const current = validateResponsiveLayouts(responsiveLayouts);
  if (current.sets.length >= RESPONSIVE_LAYOUT_LIMITS.maximumSets) {
    throw new Error("A responsive track may contain at most six layout sets");
  }
  const candidate = validateSet(set, "responsive layout set");
  if (current.sets.some(({ id }) => id === candidate.id)) {
    throw new Error("Responsive layout set ids must be unique");
  }
  if (current.sets.some(({ width }) => width === candidate.width)) {
    throw new Error("Responsive layout set widths must be unique");
  }
  const sets = [...current.sets, candidate].sort((a, b) => a.width - b.width);
  if (current.mode === "fluid") {
    return validateResponsiveLayouts({ mode: "fluid", axis: "width", sets, breakpoints: null });
  }
  const oldActivationByUpperId = new Map(
    current.breakpoints.map((breakpoint, index) => [current.sets[index + 1].id, breakpoint]),
  );
  const breakpoints = sets.slice(1).map((upper, index) => {
    const lower = sets[index];
    const retained = oldActivationByUpperId.get(upper.id);
    if (retained !== undefined && retained > lower.width && retained < upper.width) return retained;
    return rounded(lower.width + ((upper.width - lower.width) / 2), 2);
  });
  return validateResponsiveLayouts({ mode: "step", axis: "width", sets, breakpoints });
}

function sameJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function legacyGreetingBase(frame) {
  return {
    font: frame.font,
    color: frame.color,
    weight: frame.weight,
    italic: frame.italic,
    letterSpacing: frame.letterSpacing,
    align: frame.align,
    decoration: frame.decoration,
    markSource: frame.mark.source,
  };
}

function legacyGreetingFrame(frame) {
  return {
    fontSize: frame.fontSize,
    lineHeight: frame.lineHeight,
    maxWidthRatio: frame.maxWidthRatio,
    xRatio: frame.xRatio,
    yRatio: frame.yRatio,
    markScale: frame.mark.scale,
  };
}

export function upgradeStudioDocumentToResponsive(document) {
  if (!plain(document)) throw new Error("Studio theme document must be an object");
  if (document.schemaVersion === 5) return structuredClone(document);
  if (![2, 3, 4].includes(document.schemaVersion)) {
    throw new Error("Only schema-v2 through v4 Studio themes can enable responsive layouts");
  }
  const upgraded = structuredClone(document);
  upgraded.schemaVersion = 5;
  upgraded.responsiveLayouts = structuredClone(LEGACY_RESPONSIVE_LAYOUTS);
  for (const [index, layer] of (upgraded.artworkLayers ?? []).entries()) {
    if (!plain(layer.frames) || !plain(layer.frames.normal) || !plain(layer.frames.wide)) {
      throw new Error(`Artwork layer ${index + 1} does not have compatible Standard and Wide frames`);
    }
    if (layer.frames.normal.anchor !== layer.frames.wide.anchor) {
      throw new Error(`Artwork layer ${index + 1} uses incompatible categorical anchors`);
    }
    layer.anchor = layer.frames.normal.anchor;
    layer.frames = {
      standard: Object.fromEntries(Object.keys(RESPONSIVE_ARTWORK_FIELDS)
        .map((field) => [field, layer.frames.normal[field]])),
      wide: Object.fromEntries(Object.keys(RESPONSIVE_ARTWORK_FIELDS)
        .map((field) => [field, layer.frames.wide[field]])),
    };
    delete layer.legacy;
  }
  if (upgraded.newChatGreetingStyle) {
    const greeting = {};
    for (const appearance of ["light", "dark"]) {
      const standard = upgraded.newChatGreetingStyle[appearance]?.standard;
      const wide = upgraded.newChatGreetingStyle[appearance]?.wide;
      if (!plain(standard) || !plain(wide)) {
        throw new Error(`Greeting ${appearance} does not have compatible Standard and Wide frames`);
      }
      const base = legacyGreetingBase(standard);
      if (!sameJson(base, legacyGreetingBase(wide))) {
        throw new Error(`Greeting ${appearance} uses incompatible categorical presentation`);
      }
      greeting[appearance] = {
        base,
        frames: {
          standard: legacyGreetingFrame(standard),
          wide: legacyGreetingFrame(wide),
        },
      };
    }
    upgraded.newChatGreetingStyle = greeting;
  }
  for (const card of upgraded.instantPrompts ?? []) {
    const normal = card.layout?.frames?.normal;
    const wide = card.layout?.frames?.wide;
    if (!normal || !wide) continue;
    card.layout.frames = {
      standard: { ...normal },
      wide: { ...wide },
    };
  }
  return upgraded;
}
