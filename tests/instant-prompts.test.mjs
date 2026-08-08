import { test, runIfMain } from "./support/harness.mjs";
import {
  DEFAULT_CONFIG,
  PROJECT_ROOT,
  assert,
  buildPayload,
  executeStudioRequest,
  fs,
  path,
  readThemeKit,
  writeConfig,
} from "./support/context.mjs";
import { createInstantPromptController } from "../scripts/theme-core/instant-prompts.mjs";
import { readStudioState } from "../scripts/theme-core/studio.mjs";
import {
  validateInstantPrompts,
  validateStudioThemeKitDocument,
} from "../scripts/theme-core/validation.mjs";

const CARD_ID = "prompt-0123456789abcdef0123456789abcdef";
const SECOND_CARD_ID = "prompt-fedcba9876543210fedcba9876543210";
const card = (id = CARD_ID) => ({
  id,
  labels: { en: "Plan the day", "zh-CN": "规划今天", "zh-HKTW": "規劃今天" },
  prompts: {
    en: "Help me choose the three most important tasks for today.",
    "zh-CN": "帮我选出今天最重要的三项任务。",
    "zh-HKTW": "幫我選出今天最重要的三項任務。",
  },
  icon: null,
});

test("instant prompt cards validate strict portable identities, locales, and bounds", () => {
  assert.deepEqual(validateInstantPrompts(undefined, "cards"), []);
  assert.deepEqual(validateInstantPrompts([card()], "cards")[0], card());
  assert.throws(
    () => validateInstantPrompts([card(), card()], "cards"),
    /unique/i,
    "duplicate card identities were accepted",
  );
  assert.throws(
    () => validateInstantPrompts(Array.from({ length: 13 }, (_, index) => card(
      `prompt-${index.toString(16).padStart(32, "0")}`,
    )), "cards"),
    /at most 12/i,
  );
  assert.throws(
    () => validateInstantPrompts([{ ...card(), extra: true }], "cards"),
    /shape|unsupported/i,
  );
  assert.throws(
    () => validateInstantPrompts([{ ...card(), labels: { en: "Plan" } }], "cards"),
    /same locales/i,
  );
  assert.throws(
    () => validateInstantPrompts([{ ...card(), labels: { "zh-CN": "规划" }, prompts: { "zh-CN": "开始" } }], "cards"),
    /English/i,
  );
  assert.throws(
    () => validateInstantPrompts([{ ...card(), icon: "../outside.webp" }], "cards"),
    /icon/i,
  );
  assert.throws(
    () => validateInstantPrompts([{ ...card(), prompts: { ...card().prompts, en: "x".repeat(1201) } }], "cards"),
    /prompt/i,
  );
});

test("Studio exposes the complete instant-prompt visual surface through the strict host bridge", async () => {
  const [html, editor, editorCss, baseCss, app, host] = await Promise.all([
    "studio/index.html",
    "studio/editor.js",
    "studio/editor.css",
    "assets/base.css",
    "studio/app.js",
    "windows/aura-ui.ps1",
  ].map((file) => fs.readFile(path.join(PROJECT_ROOT, file), "utf8")));

  assert.match(html, /data-editor-targets="widgets\.instant-prompts"/);
  for (const state of ["default", "hover", "focus", "pressed", "expanded"]) {
    assert.match(html, new RegExp(`name="instant-prompt-preview-state" value="${state}"`));
    if (state !== "default") assert.match(editorCss, new RegExp(`data-preview-state="${state}"`));
  }
  assert.match(html, /instantPromptNewChatOnly/);
  assert.match(html, /editor-instant-prompt-switch-preview/);
  assert.match(editor, /id: "widgets\.instant-prompts"[\s\S]*selectionBehavior: "stage-instant-prompt"/);
  assert.match(editor, /ticket\.type = "button"/,
    "canvas tickets must use native keyboard-operable buttons");
  assert.match(editor, /ticket\.disabled = stageContext !== "new-chat"/,
    "Conversation preview must retain but disable the selected ticket");
  assert.match(editor, /selectedInstantPromptId = selection\.id[\s\S]*setInspectorTarget\("widgets\.instant-prompts"/,
    "canvas and keyboard selection must route the stable ticket to its inspector");
  assert.match(baseCss, /data-claude-aura-instant-prompt-card]:hover/);
  assert.match(baseCss, /data-claude-aura-instant-prompt-card]:active/);
  assert.match(baseCss, /html\.claude-aura :focus-visible/,
    "the live ticket must inherit Aura's visible keyboard focus ring");
  assert.match(app, /"pick-instant-prompt-icon"/);
  assert.match(host, /'pick-instant-prompt-icon'\s*\{\s*'type';\s*'session';\s*'revision';\s*'id'/,
    "the host must accept only the strict icon-picker message shape");
});

class MockNode {
  constructor(tagName, owner) {
    this.tagName = tagName.toUpperCase();
    this.owner = owner;
    this.parentElement = null;
    this.children = [];
    this.attributes = new Map();
    this.listeners = new Map();
    this.textContent = "";
    this.value = "";
    this.selectionStart = 0;
    this.selectionEnd = 0;
  }

  get isConnected() { return this.tagName === "HTML" || Boolean(this.parentElement?.isConnected); }
  append(...nodes) { for (const node of nodes) this.appendChild(node); }
  appendChild(node) { node.remove(); node.parentElement = this; this.children.push(node); return node; }
  insertBefore(node, before) {
    node.remove();
    const index = this.children.indexOf(before);
    node.parentElement = this;
    if (index < 0) this.children.push(node); else this.children.splice(index, 0, node);
    return node;
  }
  remove() {
    if (!this.parentElement) return;
    this.parentElement.children = this.parentElement.children.filter((node) => node !== this);
    this.parentElement = null;
  }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  hasAttribute(name) { return this.attributes.has(name); }
  matches(selector) {
    if (selector === "[readonly],[disabled],[aria-disabled=true]") {
      return this.hasAttribute("readonly") || this.hasAttribute("disabled")
        || this.getAttribute("aria-disabled") === "true";
    }
    const attribute = /^\[([^=\]]+)(?:=([^\]]+))?\]$/.exec(selector);
    return attribute ? this.hasAttribute(attribute[1]) : false;
  }
  closest(selector) {
    for (let node = this; node; node = node.parentElement) {
      if (node.matches(selector)) return node;
    }
    return null;
  }
  addEventListener(type, listener) { this.listeners.set(type, listener); }
  removeEventListener(type, listener) {
    if (this.listeners.get(type) === listener) this.listeners.delete(type);
  }
  focus() { this.owner.activeElement = this; }
  setRangeText(text, start, end) {
    this.value = `${this.value.slice(0, start)}${text}${this.value.slice(end)}`;
    this.selectionStart = this.selectionEnd = start + text.length;
  }
  dispatchEvent(event) { this.lastEvent = event; return true; }
}

function instantPromptHarness() {
  const document = {
    activeElement: null,
    createElement(tag) { return new MockNode(tag, document); },
    execCommand() { throw new Error("contenteditable path was not expected"); },
  };
  const window = {
    Event: class { constructor(type, options) { this.type = type; Object.assign(this, options); } },
    InputEvent: class { constructor(type, options) { this.type = type; Object.assign(this, options); } },
  };
  const root = new MockNode("html", document);
  const group = new MockNode("div", document);
  const shell = new MockNode("div", document);
  const editor = new MockNode("textarea", document);
  root.appendChild(group);
  group.appendChild(shell);
  shell.appendChild(editor);
  return { document, window, group, shell, editor };
}

test("instant prompt runtime creates one owned block, inserts without sending, and cleans up", () => {
  const harness = instantPromptHarness();
  const controller = createInstantPromptController(harness.document, harness.window, {
    P: [[CARD_ID, "Plan the day", "Draft the plan", null]],
    u: [],
  });
  controller.sync("new-chat", harness);
  assert.equal(harness.group.children.length, 2);
  const block = harness.group.children[0];
  assert.equal(block.getAttribute("data-claude-aura-instant-prompts"), "true");
  const button = block.children[0];
  assert.equal(button.getAttribute("type"), "button");
  block.listeners.get("click")({ target: button });
  assert.equal(harness.editor.value, "Draft the plan");
  assert.equal(harness.editor.lastEvent.type, "input");
  assert.equal(harness.editor.lastEvent.inputType, "insertText");
  controller.sync("new-chat", harness);
  assert.equal(harness.group.children.filter((node) => (
    node.getAttribute("data-claude-aura-instant-prompts") === "true"
  )).length, 1, "the runtime duplicated its owned card block");
  controller.sync("conversation", harness);
  assert.deepEqual(harness.group.children, [harness.shell]);
  assert.equal(block.listeners.has("click"), false, "cleanup retained the delegated click listener");
});

test("Studio persists localized instant prompts, icon ownership, ordering, restart, and payload safety", async () => {
  const temporary = await fs.mkdtemp(path.join(PROJECT_ROOT, "tests", ".tmp-instant-prompts-"));
  const editorRoot = path.join(temporary, "editor");
  const userThemesDir = path.join(temporary, "themes");
  const configPath = path.join(temporary, "config.json");
  const request = (message, options = {}) => executeStudioRequest({
    request: message,
    configPath,
    userThemesDir,
    editorRoot,
    locale: "zh-CN",
    ...options,
  });
  try {
    await fs.mkdir(userThemesDir, { recursive: true });
    await writeConfig(configPath, { ...DEFAULT_CONFIG });
    let result = await request({ type: "create-theme-copy", theme: "default" });
    const themeId = result.state.id;
    result = await request({
      type: "apply-theme-patch",
      session: result.state.session,
      revision: result.state.revision,
      changes: [
        { kind: "instant-prompt", operation: "add", id: CARD_ID, field: null, locale: null, value: card() },
        { kind: "instant-prompt", operation: "add", id: SECOND_CARD_ID, field: null, locale: null, value: card(SECOND_CARD_ID) },
      ],
    });
    assert.deepEqual(result.state.instantPrompts.map((entry) => entry.id), [CARD_ID, SECOND_CARD_ID]);
    result = await request({
      type: "apply-theme-patch",
      session: result.state.session,
      revision: result.state.revision,
      changes: [{
        kind: "instant-prompt", operation: "move", id: SECOND_CARD_ID,
        field: null, locale: null, value: "up",
      }],
    });
    assert.deepEqual(result.state.instantPrompts.map((entry) => entry.id), [SECOND_CARD_ID, CARD_ID]);

    const importRoot = path.join(editorRoot, "imports");
    await fs.mkdir(importRoot, { recursive: true });
    const iconPath = path.join(importRoot, "prompt.webp");
    await fs.writeFile(iconPath, Buffer.from("UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEAAUAmJaQAA3AA/v89WAAAAA==", "base64"));
    result = await request({
      type: "pick-instant-prompt-icon",
      session: result.state.session,
      revision: result.state.revision,
      id: CARD_ID,
    }, { assetPath: iconPath });
    const withIcon = result.state.instantPrompts.find((entry) => entry.id === CARD_ID);
    assert.match(withIcon.icon, /^artwork\/layer-[a-f0-9]{32}\.webp$/);
    assert.match(withIcon.iconPreviewUrl, /^https:\/\/aura\.editor\/active\/prompt-[a-f0-9]{32}\.webp\?v=[a-f0-9]{64}$/);

    const restarted = await readStudioState({ editorRoot, configPath });
    assert.deepEqual(restarted.instantPrompts.map((entry) => entry.id), [SECOND_CARD_ID, CARD_ID]);
    result = await request({
      type: "save-theme-edit",
      session: restarted.session,
      revision: restarted.revision,
    });
    const installed = await readThemeKit(path.join(userThemesDir, themeId));
    assert.equal(installed.metadata.instantPrompts.length, 2);
    assert.equal(installed.metadata.instantPrompts[1].prompts["zh-CN"], "帮我选出今天最重要的三项任务。");
    await writeConfig(configPath, { ...DEFAULT_CONFIG, theme: themeId, appearance: "light" });
    const bundle = await buildPayload({ configPath, userThemesDir, locale: "zh-CN" });
    assert.equal(bundle.settings.instantPrompts[1].label, "规划今天");
    assert(bundle.payload.includes("data-claude-aura-instant-prompts"));
    assert(!/requestSubmit|\.submit\s*\(/.test(bundle.payload), "instant prompts gained a send or submit path");
    assert.equal(bundle.payloadBudget.pass, true);
    new Function(bundle.payload);

    const savedDocument = JSON.parse(await fs.readFile(
      path.join(userThemesDir, themeId, "theme.json"), "utf8",
    ));
    const withoutCards = structuredClone(savedDocument);
    delete withoutCards.instantPrompts;
    assert.deepEqual(
      validateStudioThemeKitDocument(withoutCards, "legacy Studio theme").instantPrompts,
      [],
      "a pre-WO-19 Studio document did not migrate to an empty prompt list",
    );
  } finally {
    await fs.rm(temporary, { recursive: true, force: true });
  }
});

runIfMain(import.meta.url);
