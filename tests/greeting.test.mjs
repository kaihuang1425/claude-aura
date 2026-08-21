// WO-21 greeting tests: portable style schema, host-owned preference resolution,
// and the renderer payload's conditional gating + byte-budget safety net.
import { test, runIfMain } from "./support/harness.mjs";
import {
  compactRendererIdentifiers,
  compressRendererCss,
  expandRendererCss,
  resolveGreetingCompactMark,
} from "../scripts/theme-core/compile.mjs";
import {
  DEFAULT_CONFIG,
  PROJECT_ROOT,
  assert,
  buildPayloadFromCompiled,
  compileTheme,
  fs,
  greetingPhraseDigest,
  path,
  renderGreetingCss,
  resolveGreetingRuntime,
  resolveGreetingPhrases,
  run,
  validateGreetingPreferences,
  validateNewChatGreetingStyle,
  writeConfig,
} from "./support/context.mjs";

const FRAME = Object.freeze({
  font: "editorial-serif", color: "primary", fontSize: 40, weight: 500, italic: false,
  letterSpacing: 0.01, lineHeight: 1.1, align: "center", maxWidthRatio: 0.7,
  xRatio: 0, yRatio: -0.1, decoration: "none", mark: { source: "native", scale: 1 },
});
const STYLE = Object.freeze({
  light: { standard: FRAME, wide: FRAME },
  dark: { standard: FRAME, wide: FRAME },
});
const withFrame = (patch) => ({ light: { standard: { ...FRAME, ...patch }, wide: FRAME }, dark: STYLE.dark });

test("newChatGreetingStyle validates its exact shape and numeric bounds", () => {
  assert.equal(validateNewChatGreetingStyle(null, "s"), null, "null is Claude-native");
  assert.equal(validateNewChatGreetingStyle(undefined, "s"), null, "undefined is Claude-native");
  const out = validateNewChatGreetingStyle(STYLE, "s");
  assert.equal(out.light.standard.font, "editorial-serif");
  assert.equal(out.dark.wide.weight, 500);
  assert.equal(out.light.standard.mark.source, "native");
  assert.equal(
    validateNewChatGreetingStyle(withFrame({ letterSpacing: 0.005 }), "s")
      .light.standard.letterSpacing,
    0.005,
    "greeting validation rounded an approved half-cent tracking step",
  );
  // out-of-range and unsupported values are rejected
  assert.throws(() => validateNewChatGreetingStyle(withFrame({ fontSize: 20 }), "s"), /fontSize/, "fontSize < 24");
  assert.throws(() => validateNewChatGreetingStyle(withFrame({ fontSize: 80 }), "s"), /fontSize/, "fontSize > 72");
  assert.throws(() => validateNewChatGreetingStyle(withFrame({ weight: 450 }), "s"), /weight/, "unlisted weight");
  assert.throws(() => validateNewChatGreetingStyle(withFrame({ letterSpacing: 0.2 }), "s"), /letterSpacing/, "tracking > 0.12");
  assert.throws(() => validateNewChatGreetingStyle(withFrame({ align: "justify" }), "s"), /align/, "bad align");
  assert.throws(() => validateNewChatGreetingStyle(withFrame({ extra: 1 }), "s"), /shape/, "unknown frame key");
  assert.throws(() => validateNewChatGreetingStyle({ ...STYLE, extra: 1 }, "s"), /shape/, "unknown top key");
  assert.throws(() => validateNewChatGreetingStyle({ light: STYLE.light }, "s"), /shape/, "missing dark appearance");
  assert.throws(() => validateNewChatGreetingStyle(withFrame({ mark: { source: "native" } }), "s"), /shape/, "mark missing scale");
  assert.throws(() => validateNewChatGreetingStyle(withFrame({ mark: { source: "bogus", scale: 1 } }), "s"), /source/, "bad mark source");
});

test("renderer identifier compaction never rewrites contract literals", () => {
  const compacted = compactRendererIdentifiers(
    'const mark=source;const literal="mark source";const template=`mark ${mark} ${settings.theme}`;',
  );
  assert(compacted.includes('"mark source"'), "a quoted contract literal was rewritten");
  assert(compacted.includes("`mark ${"), "template literal text was rewritten");
  assert(!compacted.includes("const mark="), "code identifiers were not compacted");
  assert(!compacted.includes("settings.theme"), "runtime setting access was not compacted");
  new Function(compacted);
  const stateCompacted = compactRendererIdentifiers(
    'let greetingMemory={};const state={"greetingMemory":greetingMemory};',
  );
  assert(stateCompacted.includes('"greetingMemory":'),
    "the persisted greeting-memory state key was rewritten");
  assert(!stateCompacted.includes(":greetingMemory"),
    "the private greeting-memory binding was not compacted");
  new Function(stateCompacted);
});

test("renderer CSS grammar round-trips exactly and escapes by declining unsafe input", () => {
  const rule = "html.claude-aura [data-claude-aura-greeting]{background-image:none!important;border-color:var(--aura-border)}";
  const css = Array.from({ length: 24 }, (_, index) => `${rule}/*${index}*/`).join("");
  const compressed = compressRendererCss(css);
  const repeated = compressRendererCss(css);
  assert.equal(compressed.compressed, true, "repeated CSS grammar was not compressed");
  assert.deepEqual(repeated, compressed, "CSS grammar compression must be deterministic");
  assert(Buffer.byteLength(compressed.css, "utf8") < Buffer.byteLength(css, "utf8"),
    "grammar compression increased the CSS payload");
  assert.equal(expandRendererCss(compressed.css, compressed.dictionary), css,
    "grammar-compressed CSS did not round-trip byte-for-byte");
  const unsafe = `${css}\u0100`;
  assert.deepEqual(compressRendererCss(unsafe), { css: unsafe, compressed: false },
    "a literal sentinel must disable compression rather than corrupt authored CSS");
  assert.throws(() => expandRendererCss(compressed.css, [null]), /array of strings/);
});

test("an unregistered compact greeting mark is invalid instead of a silent no-op", async () => {
  await assert.rejects(
    () => resolveGreetingCompactMark({
      name: "unregistered-theme",
      variant: "unregistered-theme",
      sourceRecipe: null,
      newChatGreetingStyle: withFrame({ mark: { source: "compact", scale: 1 } }),
    }),
    /without an approved registered asset/,
  );
});

test("greeting preferences validate bounds and reject unsupported data", () => {
  assert.deepEqual(validateGreetingPreferences(null), {
    enabled: true,
    source: "claude",
    displayName: "",
    globalPhrases: [],
    themeOverrides: {},
    shuffle: null,
  }, "null -> complete native default");
  assert.equal(validateGreetingPreferences({ source: "claude" }).enabled, true,
    "legacy preferences default enabled");
  const shuffle = {
    themeId: "default",
    phraseDigest: "a".repeat(64),
    order: [2, 0, 1],
    cursor: 1,
    lastIndex: 2,
  };
  assert.deepEqual(validateGreetingPreferences({ source: "claude", shuffle }).shuffle, shuffle,
    "bounded shuffle state passes through without phrase text");
  assert.throws(() => validateGreetingPreferences({ enabled: "yes" }), /enabled/);
  assert.throws(() => validateGreetingPreferences({ shuffle: { ...shuffle, extra: 1 } }), /shape/);
  assert.throws(() => validateGreetingPreferences({ shuffle: { ...shuffle, phraseDigest: "ABC" } }), /SHA-256/);
  assert.throws(() => validateGreetingPreferences({ shuffle: { ...shuffle, order: [0, 0] } }), /duplicate/);
  assert.throws(() => validateGreetingPreferences({ shuffle: { ...shuffle, cursor: 4 } }), /cursor/);
  assert.throws(() => validateGreetingPreferences({ source: "custom", globalPhrases: Array.from({ length: 13 }, (_, i) => `p${i}`) }), /12 phrases/);
  assert.throws(() => validateGreetingPreferences({ source: "custom", displayName: "x".repeat(41) }), /40/);
  assert.throws(() => validateGreetingPreferences({ source: "custom", globalPhrases: ["a".repeat(121)] }), /120/);
  assert.throws(() => validateGreetingPreferences({ source: "custom", globalPhrases: ["Hi {name} and {name}"] }), /\{name\}/);
  assert.throws(() => validateGreetingPreferences({ source: "custom", globalPhrases: ["Hi {person}"] }), /exact \{name\}/);
  assert.throws(() => validateGreetingPreferences({ source: "custom", globalPhrases: ["Hi {name"] }), /exact \{name\}/);
  assert.throws(() => validateGreetingPreferences({ source: "custom", globalPhrases: ["Hi name}"] }), /exact \{name\}/);
  assert.throws(() => validateGreetingPreferences({ source: "custom", globalPhrases: ["dup", "dup"] }), /duplicate/);
  assert.throws(() => validateGreetingPreferences({ source: "custom", extra: 1 }), /unsupported property/);
  assert.throws(() => validateGreetingPreferences({ source: "bogus" }), /source/);
  assert.throws(() => validateGreetingPreferences({ source: "custom", themeOverrides: { "BAD ID": { mode: "global", phrases: [] } } }), /invalid theme id/);
  assert.throws(() => validateGreetingPreferences({ source: "custom", themeOverrides: { default: { mode: "custom", phrases: [] } } }), /at least one phrase/);
  assert.throws(() => validateGreetingPreferences({ source: "custom", globalPhrases: ["ctrlchar"] }), /control characters/);
});

test("greeting precedence, {name}, fail-open, and the indivisible 2 KB ceiling resolve correctly", () => {
  const eq = (a, b, msg) => assert.deepEqual(a, b, msg);
  eq(resolveGreetingPhrases({ enabled: false, source: "custom", globalPhrases: ["hi"] }, "default"), null, "disabled");
  // 1: source claude -> native even with a list
  eq(resolveGreetingPhrases({ source: "claude", globalPhrases: ["hi"] }, "default"), null, "source claude");
  // 4: global list when no override
  eq(resolveGreetingPhrases({ source: "custom", globalPhrases: ["Hello", "Hey"] }, "default"), ["Hello", "Hey"], "global list");
  // 2: explicit per-theme claude override -> native
  eq(resolveGreetingPhrases({ source: "custom", globalPhrases: ["Hello"], themeOverrides: { default: { mode: "claude", phrases: [] } } }, "default"), null, "per-theme claude");
  // 3: per-theme custom list wins over global
  eq(resolveGreetingPhrases({ source: "custom", globalPhrases: ["G"], themeOverrides: { default: { mode: "custom", phrases: ["Local"] } } }, "default"), ["Local"], "per-theme custom");
  // override is scoped to its own theme id
  eq(resolveGreetingPhrases({ source: "custom", globalPhrases: ["G"], themeOverrides: { other: { mode: "custom", phrases: ["X"] } } }, "default"), ["G"], "override scoped");
  // {name} substitution and skip-when-empty
  eq(resolveGreetingPhrases({ source: "custom", displayName: "Ada", globalPhrases: ["Hi {name}"] }, "default"), ["Hi Ada"], "{name} substituted");
  eq(resolveGreetingPhrases({ source: "custom", displayName: "", globalPhrases: ["Hi {name}", "Hello"] }, "default"), ["Hello"], "phrase needing empty name skipped");
  eq(resolveGreetingPhrases({ source: "custom", displayName: "", globalPhrases: ["Hi {name}"] }, "default"), null, "no usable phrase -> native");
  // invalid custom data fails open to native (never throws)
  eq(resolveGreetingPhrases({ source: "custom", globalPhrases: ["ok", "ok"] }, "default"), null, "duplicate -> native");
  eq(resolveGreetingPhrases({ source: "bogus" }, "default"), null, "invalid source -> native");
  eq(resolveGreetingPhrases({ source: "custom", globalPhrases: [{}] }, "default"), null, "non-string -> native");
  // A list exceeding the 2 KB compiled ceiling fails open as one indivisible
  // candidate; it is never truncated to a different phrase list.
  const big = Array.from({ length: 12 }, (_, i) => String(i).padStart(2, "0") + "あ".repeat(118));
  assert.equal(resolveGreetingPhrases({ source: "custom", globalPhrases: big }, "default"), null,
    "over-ceiling list must fail open rather than lose its tail");
  const bounded = Array.from({ length: 12 }, (_, i) => `${i}`.padStart(2, "0") + "x".repeat(60));
  assert.deepEqual(
    resolveGreetingPhrases({ source: "custom", globalPhrases: bounded }, "default"),
    bounded,
    "a bounded list resolves in full",
  );
});

test("matching shuffle checkpoints compile and persist without phrase disclosure", async () => {
  const preferences = {
    enabled: true,
    source: "custom",
    displayName: "Ada",
    globalPhrases: ["Hello, {name}", "Welcome back"],
    themeOverrides: {},
    shuffle: null,
  };
  const phrases = ["Hello, Ada", "Welcome back"];
  const phraseDigest = greetingPhraseDigest(phrases);
  assert.equal(resolveGreetingRuntime(preferences, "default").phraseDigest, phraseDigest);
  const shuffle = {
    themeId: "default",
    phraseDigest,
    order: [1, 0],
    cursor: 1,
    lastIndex: 1,
  };
  const compiled = await compileTheme({
    config: {
      ...DEFAULT_CONFIG,
      theme: "default",
      greetingPreferences: { ...preferences, shuffle },
    },
  });
  assert.deepEqual(compiled.settings.greeting.shuffle, shuffle);
  const stale = await compileTheme({
    config: {
      ...DEFAULT_CONFIG,
      theme: "default",
      greetingPreferences: {
        ...preferences,
        shuffle: { ...shuffle, phraseDigest: "0".repeat(64) },
      },
    },
  });
  assert.equal(stale.settings.greeting.shuffle, null,
    "a checkpoint for different phrase text initialized the renderer");

  const temporary = await fs.mkdtemp(path.join(PROJECT_ROOT, "tests", ".tmp-greeting-"));
  const configPath = path.join(temporary, "config.json");
  const cliPath = path.join(PROJECT_ROOT, "scripts", "theme-cli.mjs");
  try {
    await writeConfig(configPath, {
      ...DEFAULT_CONFIG,
      theme: "default",
      greetingPreferences: preferences,
    });
    const encoded = Buffer.from(JSON.stringify(shuffle), "utf8").toString("base64url");
    const first = run(process.execPath, [
      cliPath, "greeting-checkpoint", "--config", configPath, "--state-base64", encoded,
    ]);
    assert.deepEqual(JSON.parse(first), { changed: true, shuffle });
    assert(!first.includes("Ada") && !first.includes("Welcome"),
      "checkpoint output disclosed a name or phrase");
    const persisted = JSON.parse(await fs.readFile(configPath, "utf8"));
    assert.deepEqual(persisted.greetingPreferences.shuffle, shuffle);
    const second = JSON.parse(run(process.execPath, [
      cliPath, "greeting-checkpoint", "--config", configPath, "--state-base64", encoded,
    ]));
    assert.equal(second.changed, false, "an unchanged checkpoint rewrote config");
  } finally {
    await fs.rm(temporary, { recursive: true, force: true });
  }
});

const BUILTIN_IDS = [
  "default", "japanese-film-editorial", "korean-prestige", "cartoon-studio",
  "anime-twilight", "study-library", "japanese-idol", "korean-idol",
];

// Built-in themes inherit Claude's own greeting styling: Aura swaps the wording
// and nothing else. The renderer takes that path whenever a theme carries no
// newChatGreetingStyle, copying the live computed type, colour, and alignment
// onto its replacement node so the greeting reads identically before and after
// the claim. Studio's "reset" greeting operation produces the same null state
// for user themes, so this is a first-class mode rather than an absence.
// This retires the WO-21 four-frame recipes that used to live here.

test("all built-in composers use an intentional centered composition", async () => {
  const registry = JSON.parse(await fs.readFile(
    path.join(PROJECT_ROOT, "themes", "registry.json"),
    "utf8",
  ));
  for (const theme of registry.themes) {
    assert.deepEqual(
      [
        theme.newChatLayout.widthRatio,
        theme.newChatLayout.offsetXRatio,
        theme.newChatLayout.offsetYRatio,
      ],
      [0.64, 0, 0],
      `${theme.id} composer drifted from its centered composition`,
    );
  }
});

test("all built-ins inherit the native greeting and still compile in budget", async () => {
  const registry = JSON.parse(await fs.readFile(
    path.join(PROJECT_ROOT, "themes", "registry.json"),
    "utf8",
  ));
  const registryThemes = new Map(registry.themes.map((theme) => [theme.id, theme]));
  for (const theme of BUILTIN_IDS) {
    assert.equal(registryThemes.get(theme)?.newChatGreetingStyle, undefined,
      `${theme} must inherit Claude's greeting styling, not restyle it`);
    for (const compiledAppearance of ["light", "dark"]) {
      const compiled = await compileTheme({
        config: { ...DEFAULT_CONFIG, theme, appearance: compiledAppearance },
      });
      assert.equal(compiled.settings.greeting, undefined,
        `${theme} ${compiledAppearance} compiled a greeting block in native mode`);
      const bundle = await buildPayloadFromCompiled(compiled);
      new Function(bundle.payload);
      assert(bundle.payloadBudget.chromeBytes < 65_000,
        `${theme} ${compiledAppearance} exceeds 65 KB (${bundle.payloadBudget.chromeBytes})`);
      assert(bundle.payloadBudget.embeddedArtworkBytes < 1_400_000,
        `${theme} ${compiledAppearance} exceeds the embedded artwork budget`);
      assert.equal(bundle.payloadBudget.pass, true,
        `${theme} ${compiledAppearance} payload budget did not pass`);
    }
  }
});

test("the payload preserves every valid phrase under the unchanged budget", async () => {
  const displayName = "A".repeat(40);
  const worst = Array.from(
    { length: 12 },
    (_, i) => String(i).padStart(2, "0") + "x".repeat(112) + "{name}",
  );
  const effective = worst.map((phrase) => phrase.replace("{name}", displayName));
  for (const theme of BUILTIN_IDS) {
    const bundle = await buildPayloadFromCompiled(await compileTheme({
      config: {
        ...DEFAULT_CONFIG,
        theme,
        greetingPreferences: {
          enabled: true,
          source: "custom",
          globalPhrases: worst,
          displayName,
          themeOverrides: {},
          shuffle: null,
        },
      },
    }));
    assert(bundle.payloadBudget.chromeBytes < 65000, `${theme} worst-case stays under 65 KB`);
    assert(effective.every((phrase) => bundle.payload.includes(phrase)),
      `${theme} silently truncated or removed a valid phrase`);
    assert(bundle.payload.includes("data-claude-aura-greeting"),
      `${theme} silently removed the greeting subsystem`);
    new Function(bundle.payload);
  }
});

test("budget enforcement never sheds a valid personal avatar", async () => {
  const base = await compileTheme({
    config: { ...DEFAULT_CONFIG, theme: "default", appearance: "light" },
  });
  const oversized = {
    ...base,
    css: `${base.css}\n.unreachable{--padding:${"x".repeat(20000)}}`,
    settings: {
      ...base.settings,
      avatarDataUrl: `data:image/png;base64,${"A".repeat(12000)}`,
    },
  };
  const measured = await buildPayloadFromCompiled(oversized, { enforceBudget: false });
  assert(measured.payload.includes(oversized.settings.avatarDataUrl),
    "the compiler silently removed a valid personal avatar");
  assert(measured.payloadBudget.chromeBytes >= 65000,
    "avatar data was incorrectly counted as chrome");
  await assert.rejects(() => buildPayloadFromCompiled(oversized), /smaller than 65 KB/,
    "an over-budget avatar payload falsely reported success");
});

test("every greeting style control reaches the compiled CSS", () => {
  // Regression guard for a whole bug class: a control can be validated, stored, and
  // shown in Studio while the CSS emitter silently ignores it, so the user edits
  // something that never changes. Each control must be observable in the output.
  const css = renderGreetingCss(withFrame({
    font: "rounded-sans", color: "accent", fontSize: 61, weight: 700, italic: true,
    letterSpacing: 0.05, lineHeight: 1.4, align: "end", maxWidthRatio: 0.5,
    xRatio: 0.2, yRatio: -0.3, decoration: "underline",
  }));
  assert.match(css, /white-space:normal;overflow-wrap:anywhere/,
    "long Latin and CJK greeting text must wrap inside its bounded measure");
  for (const [control, expected] of [
    ["font", "\"Trebuchet MS\", \"Segoe UI\", system-ui, sans-serif"],
    ["color", "hsl(var(--aura-accent-primary))"],
    ["fontSize", "font-size:61px"],
    ["weight", "font-weight:700"],
    ["italic", "font-style:italic"],
    ["letterSpacing", "letter-spacing:0.05em"],
    ["lineHeight", "line-height:1.4"],
    ["align", "text-align:end"],
    ["maxWidthRatio", "--aura-greeting-max-ratio:0.5"],
    ["xRatio", "--aura-greeting-x:0.2"],
    ["yRatio", "--aura-greeting-y:-0.3"],
    ["decoration", "text-decoration:underline"],
  ]) {
    assert(css.includes(expected), `greeting ${control} never reaches the compiled CSS`);
  }
  // Native and registered compact decorations remain independently selectable.
  const hidden = renderGreetingCss(withFrame({ mark: { source: "none", scale: 1 } }));
  assert.match(hidden, /--aura-greeting-native-opacity:0/);
  assert.match(hidden, /--aura-greeting-compact-opacity:0/);
  const scaled = renderGreetingCss(withFrame({ mark: { source: "native", scale: 1.5 } }));
  assert.match(scaled, /--aura-greeting-mark-scale:1\.5/, "mark size must reach the compiled CSS");
  const compact = renderGreetingCss(withFrame({ mark: { source: "compact", scale: 1 } }));
  assert.match(compact, /--aura-greeting-compact-opacity:1/,
    "compact source must select the registered compact decoration");
  const glow = renderGreetingCss(withFrame({ decoration: "glow" }));
  assert.match(glow, /text-shadow:0 0 18px/);
  assert.match(glow,
    /\[data-claude-aura-greeting="native-mark"\]\{border:0;text-decoration:none;text-shadow:none\}/,
    "mark-only wrapper inherited the heading decoration");
  assert.match(glow, /@media\(forced-colors:active\).*text-shadow:none/,
    "forced colors must suppress the decorative glow");
});

test("the first greeting claim fades in instead of snapping", async () => {
  const css = renderGreetingCss(withFrame({}));
  // Discovery is geometric and needs laid-out rects, and prepaint may not
  // inspect Claude's DOM before response verification, so the swap from
  // Claude's greeting to Aura's can only be softened, never removed.
  assert.match(css, /@keyframes aura-gin\{from\{opacity:0\}\}/u,
    "The greeting CSS must define the reveal keyframe");
  assert.doesNotMatch(css, /prefers-reduced-motion/u,
    "base.css already forces animation-duration under both reduce-motion paths; "
    + "a second rule only spends payload bytes the chrome budget cannot spare");

  const renderer = await fs.readFile(
    path.join(PROJECT_ROOT, "assets", "renderer-inject.js"), "utf8");
  assert.match(renderer,
    /removeProperty\("visibility"\);\s*\n\s*rn\.style\.setProperty\("animation", "aura-gin /u,
    "The fade must be armed on the same reveal that unhides the replacement node");
});

runIfMain(import.meta.url);
