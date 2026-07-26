// WO-21 host-owned greeting personalization. Personal phrases and the display
// name are validated, bounded, and resolved here — they never enter theme
// documents, folder exports, or WO-22 packages. The renderer receives only the
// compiled effective phrase list; per-visit shuffle selection happens in the page.
import crypto from "node:crypto";
import {
  GREETING_MAX_COMPILED_BYTES,
  GREETING_MAX_NAME_LENGTH,
  GREETING_MAX_PHRASES,
  GREETING_MAX_PHRASE_SCALARS,
  GREETING_MAX_THEME_OVERRIDES,
  GREETING_PREFERENCE_SOURCES,
  GREETING_THEME_OVERRIDE_MODES,
  THEME_ID_PATTERN,
} from "./constants.mjs";
import { isPlainObject, strictEnum } from "./validation.mjs";

// Reject C0 controls, DEL, and C1 controls (covers newlines, tabs, and bidi-unsafe
// control bytes) inside phrases and the display name.
const CONTROL_OR_NEWLINE = new RegExp("[\u0000-\u001F\u007F-\u009F]", "u");
const NAME_TOKEN = /\{name\}/u;
const NAME_TOKEN_GLOBAL = /\{name\}/gu;

export const DEFAULT_GREETING_PREFERENCES = Object.freeze({
  enabled: true,
  source: "claude",
  displayName: "",
  globalPhrases: Object.freeze([]),
  themeOverrides: Object.freeze({}),
  shuffle: null,
});

const SHUFFLE_DIGEST = /^[a-f0-9]{64}$/u;

export function validateGreetingShuffleState(value, label = "greeting shuffle") {
  if (value === null || value === undefined) return null;
  if (!isPlainObject(value)) throw new Error(`${label} must be an object or null`);
  const allowed = new Set(["themeId", "phraseDigest", "order", "cursor", "lastIndex"]);
  if (Object.keys(value).some((key) => !allowed.has(key))
      || allowed.size !== Object.keys(value).length) {
    throw new Error(`${label} has an unsupported shape`);
  }
  if (typeof value.themeId !== "string" || !THEME_ID_PATTERN.test(value.themeId)) {
    throw new Error(`${label}.themeId must be a valid theme id`);
  }
  if (typeof value.phraseDigest !== "string" || !SHUFFLE_DIGEST.test(value.phraseDigest)) {
    throw new Error(`${label}.phraseDigest must be a lowercase SHA-256 digest`);
  }
  if (!Array.isArray(value.order) || value.order.length > GREETING_MAX_PHRASES) {
    throw new Error(`${label}.order must contain at most ${GREETING_MAX_PHRASES} indices`);
  }
  const order = value.order.map((index, position) => {
    if (!Number.isInteger(index) || index < 0 || index >= GREETING_MAX_PHRASES) {
      throw new Error(`${label}.order[${position}] must be a bounded phrase index`);
    }
    return index;
  });
  if (new Set(order).size !== order.length) {
    throw new Error(`${label}.order must not contain duplicate indices`);
  }
  if (!Number.isInteger(value.cursor) || value.cursor < 0 || value.cursor > order.length) {
    throw new Error(`${label}.cursor must point inside the shuffle order`);
  }
  if (value.lastIndex !== null
      && (!Number.isInteger(value.lastIndex)
        || value.lastIndex < 0
        || value.lastIndex >= GREETING_MAX_PHRASES)) {
    throw new Error(`${label}.lastIndex must be null or a bounded phrase index`);
  }
  return {
    themeId: value.themeId,
    phraseDigest: value.phraseDigest,
    order,
    cursor: value.cursor,
    lastIndex: value.lastIndex,
  };
}

function normalizeGreetingText(value, label) {
  if (typeof value !== "string") throw new Error(`${label} must be a string`);
  const normalized = value.normalize("NFC").trim();
  if (CONTROL_OR_NEWLINE.test(normalized)) {
    throw new Error(`${label} must not contain control characters or newlines`);
  }
  return normalized;
}

export function validateGreetingPhrase(value, label) {
  const normalized = normalizeGreetingText(value, label);
  if (!normalized) throw new Error(`${label} must not be empty`);
  if ([...normalized].length > GREETING_MAX_PHRASE_SCALARS) {
    throw new Error(`${label} must be at most ${GREETING_MAX_PHRASE_SCALARS} characters`);
  }
  if ((normalized.match(NAME_TOKEN_GLOBAL) || []).length > 1) {
    throw new Error(`${label} may use {name} at most once`);
  }
  if (/[{}]/u.test(normalized.replace(NAME_TOKEN_GLOBAL, ""))) {
    throw new Error(`${label} may use only the exact {name} token`);
  }
  return normalized;
}

function validatePhraseList(value, label) {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array`);
  if (value.length > GREETING_MAX_PHRASES) {
    throw new Error(`${label} must contain at most ${GREETING_MAX_PHRASES} phrases`);
  }
  const phrases = value.map((phrase, index) => validateGreetingPhrase(phrase, `${label}[${index}]`));
  const seen = new Set();
  for (const phrase of phrases) {
    if (seen.has(phrase)) throw new Error(`${label} must not contain duplicate phrases`);
    seen.add(phrase);
  }
  return phrases;
}

// Exact-shape validation of the host-owned preference envelope. Throws on any
// out-of-bounds or unknown data; callers that must fail open (compile) catch it.
export function validateGreetingPreferences(value, label = "greetingPreferences") {
  if (value === null || value === undefined) {
    return {
      enabled: true,
      source: "claude",
      displayName: "",
      globalPhrases: [],
      themeOverrides: {},
      shuffle: null,
    };
  }
  if (!isPlainObject(value)) throw new Error(`${label} must be an object or null`);
  const allowed = new Set([
    "enabled", "source", "displayName", "globalPhrases", "themeOverrides", "shuffle",
  ]);
  if (Object.keys(value).some((key) => !allowed.has(key))) {
    throw new Error(`${label} has an unsupported property`);
  }
  const enabled = value.enabled ?? true;
  if (typeof enabled !== "boolean") throw new Error(`${label}.enabled must be a boolean`);
  const source = strictEnum(value.source ?? "claude", GREETING_PREFERENCE_SOURCES, `${label}.source`);
  const displayName = value.displayName === undefined || value.displayName === null
    ? ""
    : normalizeGreetingText(value.displayName, `${label}.displayName`);
  if ([...displayName].length > GREETING_MAX_NAME_LENGTH) {
    throw new Error(`${label}.displayName must be at most ${GREETING_MAX_NAME_LENGTH} characters`);
  }
  const globalPhrases = validatePhraseList(value.globalPhrases ?? [], `${label}.globalPhrases`);
  const rawOverrides = value.themeOverrides ?? {};
  if (!isPlainObject(rawOverrides)) throw new Error(`${label}.themeOverrides must be an object`);
  const overrideEntries = Object.entries(rawOverrides);
  if (overrideEntries.length > GREETING_MAX_THEME_OVERRIDES) {
    throw new Error(`${label}.themeOverrides has too many themes`);
  }
  const themeOverrides = {};
  for (const [themeId, override] of overrideEntries) {
    if (!THEME_ID_PATTERN.test(themeId)) {
      throw new Error(`${label}.themeOverrides has an invalid theme id: ${themeId}`);
    }
    if (!isPlainObject(override)) throw new Error(`${label}.themeOverrides.${themeId} must be an object`);
    const overrideAllowed = new Set(["mode", "phrases"]);
    if (Object.keys(override).some((key) => !overrideAllowed.has(key))) {
      throw new Error(`${label}.themeOverrides.${themeId} has an unsupported property`);
    }
    const mode = strictEnum(override.mode, GREETING_THEME_OVERRIDE_MODES, `${label}.themeOverrides.${themeId}.mode`);
    const phrases = validatePhraseList(override.phrases ?? [], `${label}.themeOverrides.${themeId}.phrases`);
    if (mode === "custom" && phrases.length === 0) {
      throw new Error(`${label}.themeOverrides.${themeId} custom mode requires at least one phrase`);
    }
    themeOverrides[themeId] = { mode, phrases };
  }
  const shuffle = validateGreetingShuffleState(value.shuffle ?? null, `${label}.shuffle`);
  return { enabled, source, displayName, globalPhrases, themeOverrides, shuffle };
}

export function greetingPhraseDigest(phrases) {
  if (!Array.isArray(phrases) || phrases.some((phrase) => typeof phrase !== "string")) {
    throw new Error("Greeting phrases must be an array of strings");
  }
  return crypto.createHash("sha256").update(JSON.stringify(phrases), "utf8").digest("hex");
}

function runtimeShuffleState(value, themeId, phraseDigest, phraseCount) {
  if (!value || value.themeId !== themeId || value.phraseDigest !== phraseDigest
      || value.order.length !== phraseCount || value.cursor < 0 || value.cursor > phraseCount) {
    return null;
  }
  const expected = Array.from({ length: phraseCount }, (_, index) => index);
  const sorted = [...value.order].sort((left, right) => left - right);
  if (sorted.some((index, position) => index !== expected[position])) return null;
  if (value.cursor > 0 && value.lastIndex !== value.order[value.cursor - 1]) return null;
  if (value.cursor === 0 && value.lastIndex !== null
      && (!Number.isInteger(value.lastIndex) || value.lastIndex < 0 || value.lastIndex >= phraseCount)) {
    return null;
  }
  return {
    themeId,
    phraseDigest,
    order: [...value.order],
    cursor: value.cursor,
    lastIndex: value.lastIndex,
  };
}

// Compile only the matching, index-only shuffle checkpoint. Phrase text remains
// in the already-resolved list and never travels through the host probe.
export function resolveGreetingRuntime(preferences, themeId) {
  const phrases = resolveGreetingPhrases(preferences, themeId);
  if (!phrases) return null;
  const phraseDigest = greetingPhraseDigest(phrases);
  let validated;
  try {
    validated = validateGreetingPreferences(preferences);
  } catch {
    return null;
  }
  return {
    phrases,
    phraseDigest,
    shuffle: runtimeShuffleState(
      validated.shuffle,
      themeId,
      phraseDigest,
      phrases.length,
    ),
  };
}

// Substitute {name}; skip phrases requiring a name when none is set.
function substituteName(phrases, displayName) {
  const result = [];
  for (const phrase of phrases) {
    if (NAME_TOKEN.test(phrase)) {
      if (!displayName) continue;
      result.push(phrase.replace(NAME_TOKEN_GLOBAL, displayName));
    } else {
      result.push(phrase);
    }
  }
  return result;
}

// WO-21 precedence. Returns the effective custom phrase list, or null (native).
// Accepts either raw or already-validated preferences; re-validates defensively
// so invalid custom data fails open to the native greeting rather than throwing.
export function resolveGreetingPhrases(preferences, themeId) {
  let prefs;
  try {
    prefs = validateGreetingPreferences(preferences);
  } catch {
    return null; // invalid custom data -> Claude native
  }
  if (!prefs.enabled || prefs.source !== "custom") return null; // disabled / Use Claude greeting
  const override = Object.hasOwn(prefs.themeOverrides, themeId) ? prefs.themeOverrides[themeId] : null;
  if (override && override.mode === "claude") return null; // explicit per-theme native
  let list = null;
  if (override && override.mode === "custom" && override.phrases.length) {
    list = override.phrases; // per-theme custom list
  } else if (prefs.globalPhrases.length) {
    list = prefs.globalPhrases; // absent or "global" override + global list
  }
  if (!list) return null;
  const substituted = substituteName(list, prefs.displayName);
  if (!substituted.length) return null;
  // The effective list is indivisible user intent. Exceeding the compiled-text
  // ceiling is an invalid candidate (native fail-open), never permission to
  // silently discard trailing phrases.
  if (Buffer.byteLength(JSON.stringify(substituted), "utf8")
      > GREETING_MAX_COMPILED_BYTES) return null;
  return substituted;
}
