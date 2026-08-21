import { runInNewContext } from "node:vm";
import { test, runIfMain } from "./support/harness.mjs";
import { PROJECT_ROOT, assert, fs, path } from "./support/context.mjs";

const validDraft = Object.freeze({
  version: 1,
  title: "Quiet Rose Study",
  summary: "A warm editorial workspace with a composed typographic greeting.",
  light: {
    canvas: "#FFFDF8",
    sidebar: "#F3E9DF",
    surface: "#FFFFFF",
    text: "#261C18",
    accent: "#8A1F46",
    border: "#9B8A82",
  },
  dark: {
    canvas: "#191216",
    sidebar: "#22181D",
    surface: "#2A1D24",
    text: "#FFF5F7",
    accent: "#FF7FAA",
    border: "#80606C",
  },
  style: {
    fontUi: "humanist-sans",
    fontDisplay: "editorial-serif",
    radius: 16,
    blur: 12,
    shadow: "soft",
  },
  greeting: {
    font: "editorial-serif",
    color: "accent",
    standardSize: 38,
    wideSize: 48,
    weight: 600,
    italic: false,
    letterSpacing: -0.02,
    lineHeight: 1.08,
    align: "center",
    maxWidthRatio: 0.62,
    xRatio: 0,
    yRatio: -0.04,
    decoration: "hairline",
  },
});

async function loadAssistant() {
  const source = await fs.readFile(path.join(PROJECT_ROOT, "studio", "theme-assistant.js"), "utf8");
  const sandbox = { window: {} };
  runInNewContext(source, sandbox, { filename: "studio/theme-assistant.js" });
  return sandbox.window.CLAUDE_AURA_THEME_ASSISTANT;
}

test("Theme assistant builds a bounded local prompt without invoking a provider", async () => {
  const assistant = await loadAssistant();
  assert(assistant, "Theme assistant API was not registered");
  const prompt = assistant.buildPrompt({
    brief: `  calm\u0007 rose paper   ${"x".repeat(900)}  `,
    baseTheme: "Default",
  });
  assert.match(prompt, /User brief: calm rose paper/u);
  assert.match(prompt, /Return only one JSON object/u);
  assert.match(prompt, /Do not add CSS, image URLs, file paths/u);
  assert(prompt.length < 5000, "The generated prompt must stay bounded");
  assert.equal(assistant.cleanBrief("  one\u0007 two  "), "one two");
  assert.equal(assistant.cleanBrief("x".repeat(800)).length, assistant.limits.brief);
});

test("Theme assistant accepts only the exact validated draft contract", async () => {
  const assistant = await loadAssistant();
  const accepted = assistant.parseDraft(`\`\`\`json\n${JSON.stringify(validDraft)}\n\`\`\``);
  assert.equal(accepted.ok, true, accepted.errors.join(", "));
  assert.equal(accepted.draft.title, validDraft.title);

  const extra = assistant.parseDraft(JSON.stringify({ ...validDraft, css: "body{}" }));
  assert.equal(extra.ok, false);
  assert.deepEqual([...extra.errors], ["draft.shape"]);

  const lowContrast = assistant.parseDraft(JSON.stringify({
    ...validDraft,
    light: { ...validDraft.light, text: "#FFFDF8" },
  }));
  assert.equal(lowContrast.ok, false);
  assert(lowContrast.errors.some((error) => error.includes("TextContrast")));

  const invalidEnum = assistant.parseDraft(JSON.stringify({
    ...validDraft,
    style: { ...validDraft.style, shadow: "dramatic" },
  }));
  assert.equal(invalidEnum.ok, false);
  assert(invalidEnum.errors.includes("style.shadow"));
  assert.equal(assistant.parseDraft("x".repeat(assistant.limits.response + 1)).ok, false);
});

test("Theme assistant converts a checked draft into Aura's existing patch protocol", async () => {
  const assistant = await loadAssistant();
  const parsed = assistant.parseDraft(JSON.stringify(validDraft));
  const result = assistant.toPatchChanges(parsed.draft, {
    frames: [{ id: "compact", width: 920 }, { id: "standard", width: 1180 }, { id: "wide", width: 1560 }],
  });
  assert.equal(result.ok, true, result.errors.join(", "));
  assert.equal(result.changes.length, 25);
  assert(result.changes.every((change) => ["metadata", "token", "greeting"].includes(change.kind)));
  assert(!JSON.stringify(result.changes).includes("http"));
  assert(!JSON.stringify(result.changes).includes("css"));
  const greeting = result.changes.filter((change) => change.kind === "greeting");
  assert.equal(greeting.length, 6);
  assert.deepEqual([...new Set(greeting.map(({ frame }) => frame))], ["compact", "standard", "wide"]);
  assert(greeting.every(({ value }) => value.markSource === "none" && value.markScale === 1));
  assert.equal(greeting.find(({ appearance, frame }) => appearance === "light" && frame === "compact").value.fontSize, 38);
  assert.equal(greeting.find(({ appearance, frame }) => appearance === "dark" && frame === "wide").value.fontSize, 48);
});

test("Studio exposes the assistant only through an explicit dialog workflow", async () => {
  const [html, app, editor] = await Promise.all([
    fs.readFile(path.join(PROJECT_ROOT, "studio", "index.html"), "utf8"),
    fs.readFile(path.join(PROJECT_ROOT, "studio", "app.js"), "utf8"),
    fs.readFile(path.join(PROJECT_ROOT, "studio", "editor.js"), "utf8"),
  ]);
  assert.match(html, /id="start-theme-assistant"/u);
  assert.match(html, /<dialog id="theme-assistant-dialog"/u);
  assert(html.indexOf('<script src="theme-assistant.js"></script>') < html.indexOf('<script src="editor.js"></script>'));
  assert.match(app, /claude-aura:open-theme-assistant/u);
  assert.match(editor, /themeAssistant\.parseDraft\(assistantResponse\.value\)/u);
  assert.match(editor, /themeAssistant\.toPatchChanges\(assistantDraft/u);
  assert.match(editor, /send\(\{ type: "open-aura" \}\)/u);
});

runIfMain(import.meta.url);
