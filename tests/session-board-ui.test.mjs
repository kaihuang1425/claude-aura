import vm from "node:vm";

import { test, runIfMain } from "./support/harness.mjs";
import {
  PROJECT_ROOT,
  assert,
  fs,
  path,
} from "./support/context.mjs";

const studioIndexPath = path.join(PROJECT_ROOT, "studio", "index.html");
const compactWorkHubPath = path.join(PROJECT_ROOT, "studio", "work-hub.html");
const sessionBoardAppPath = path.join(PROJECT_ROOT, "studio", "session-board.js");
const sessionBoardStylesPath = path.join(PROJECT_ROOT, "studio", "session-board.css");

const plain = (value) => JSON.parse(JSON.stringify(value));

async function readRequired(file, label) {
  try {
    return await fs.readFile(file, "utf8");
  } catch {
    assert.fail(`${label} is missing: ${file}`);
  }
}

function studioPage(html, id) {
  const startPattern = new RegExp(`<section\\b[^>]*\\bid="${id}"[^>]*data-studio-page="${id}"[^>]*>`, "u");
  const match = startPattern.exec(html);
  assert(match, `Studio is missing its ${id} page`);
  const start = match.index;
  const remaining = html.slice(start + match[0].length);
  const next = /<section\b[^>]*data-studio-page="[^"]+"/u.exec(remaining);
  return html.slice(start, next ? start + match[0].length + next.index : html.length);
}

async function loadSessionBoardApi(options = {}) {
  const source = await readRequired(sessionBoardAppPath, "Shared session-board renderer");
  const document = options.document ?? {
    addEventListener() {},
    querySelector() { return null; },
  };
  const windowObject = {
    document,
    addEventListener() {},
    ...(options.window ?? {}),
  };
  const context = {
    document,
    console,
    Date: options.Date ?? Date,
    setTimeout: options.setTimeout ?? setTimeout,
    clearTimeout: options.clearTimeout ?? clearTimeout,
    window: windowObject,
  };
  vm.runInNewContext(source, context, { filename: sessionBoardAppPath });
  const api = context.window.CLAUDE_AURA_SESSION_BOARD;
  assert(api && typeof api === "object", "session-board.js must expose its bounded test seam");
  return { api, source };
}

class SessionBoardElement {
  constructor(tagName, ownerDocument) {
    this.tagName = tagName.toUpperCase();
    this.ownerDocument = ownerDocument;
    this.parentElement = null;
    this.children = [];
    this.attributes = new Map();
    this.listeners = new Map();
    this.dataset = {};
    this.className = "";
    this.disabled = false;
    this.focused = false;
    this.scrollCalls = [];
    this._textContent = "";
  }
  get textContent() {
    return this.children.length
      ? this.children.map((child) => child.textContent).join("")
      : this._textContent;
  }
  set textContent(value) {
    this.children = [];
    this._textContent = String(value);
  }
  append(...nodes) {
    for (const node of nodes) {
      node.parentElement = this;
      this.children.push(node);
    }
  }
  replaceChildren(...nodes) {
    for (const child of this.children) child.parentElement = null;
    this.children = [];
    this._textContent = "";
    this.append(...nodes);
  }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  addEventListener(type, listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(listener);
  }
  dispatch(type, details = {}) {
    const event = {
      preventDefault() {},
      currentTarget: this,
      ...details,
    };
    for (const listener of this.listeners.get(type) ?? []) listener(event);
  }
  matches(selector) {
    const trimmed = selector.trim();
    if (trimmed.startsWith(".")) {
      return this.className.split(/\s+/u).includes(trimmed.slice(1));
    }
    const attribute = /^\[([^=\]]+)(?:="([^"]*)")?\]$/u.exec(trimmed);
    return Boolean(attribute
      && this.getAttribute(attribute[1]) !== null
      && (attribute[2] === undefined || this.getAttribute(attribute[1]) === attribute[2]));
  }
  querySelectorAll(selector) {
    return this.children.flatMap((child) => [
      ...(child.matches(selector) ? [child] : []),
      ...child.querySelectorAll(selector),
    ]);
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] ?? null; }
  focus() { this.focused = true; }
  scrollIntoView(options) { this.scrollCalls.push(options); }
}

function createSessionBoardDom(language = "en") {
  const document = {
    documentElement: {
      lang: language,
      getAttribute(name) { return name === "lang" ? language : null; },
    },
  };
  document.createElement = (tagName) => new SessionBoardElement(tagName, document);
  document.querySelector = () => null;
  const root = document.createElement("div");
  return { document, root };
}

function sessionId(index) {
  const head = index.toString(16).padStart(8, "0");
  const tail = index.toString(16).padStart(12, "0");
  return `${head}-0000-4000-8000-${tail}`;
}

const specialTitles = [
  "简体中文会话",
  "繁體中文工作階段",
  "日本語セッション",
  "한국어 세션",
  "𠀀 補助平面文字",
  "👩🏽‍💻 ZWJ emoji",
  "Cafe\u0301 combining",
  "§ ⌘ ∞ niche symbols",
];

function sessionFixture(count = 100) {
  const responseStates = ["unknown", "working", "completed", "failed"];
  const sessions = Array.from({ length: count }, (_, offset) => {
    const index = offset + 1;
    const responseState = responseStates[offset % responseStates.length];
    return {
      id: sessionId(index),
      title: specialTitles[offset] ?? `Session ${index}`,
      kind: offset % 2 === 0 ? "chat" : "code",
      state: offset === 0 ? "active" : offset < 3 ? "open" : "past",
      firstSeenAt: 1000 + index,
      lastOpenedAt: 2000 + index,
      response: {
        state: responseState,
        evidence: responseState === "unknown" ? "none" : "network",
        changedAt: responseState === "unknown" ? null : 3000 + index,
      },
    };
  });
  return {
    schemaVersion: 1,
    kind: "session-board-state",
    revision: 7,
    changedAt: 9000,
    sessions: sessions.reverse(),
  };
}

test("Studio and compact Work Hub share one session-only renderer", async () => {
  const [index, compact] = await Promise.all([
    fs.readFile(studioIndexPath, "utf8"),
    fs.readFile(compactWorkHubPath, "utf8").catch(() => ""),
  ]);
  assert(compact, "Compact Work Hub document is missing at studio/work-hub.html");

  const tasks = studioPage(index, "tasks");
  for (const [name, html] of [["Studio document", index], ["compact Work Hub", compact]]) {
    assert.match(html, /session-board\.css\?v=\d+/u, `${name} must load session-board.css`);
    assert.match(html, /session-board\.js\?v=\d+/u, `${name} must load session-board.js`);
    assert.doesNotMatch(html, /taskboard\.(?:js|css)|data-taskboard-|id="taskboard-/iu);
  }
  for (const [name, html] of [["Studio tasks page", tasks], ["compact Work Hub", compact]]) {
    assert.match(html, /data-session-board-root(?:\s|=|>)/u, `${name} must expose the shared root`);
    assert.doesNotMatch(html,
      /New task|Needs Attention|Recent tasks?|Projects|data-(?:dashboard|board|list|timeline)|task[-_ ]editor/iu);
    assert.doesNotMatch(html,
      /(?:task|project|todo)-(?:title|description|status|priority|assignee|labels|date|branch|worktree|thread|relation|comment)/iu);
  }
  assert.match(tasks, /data-session-board-mode="studio"/u);
  assert.match(compact, /data-session-board-mode="compact"/u);
});

test("session-board state is body-free, Unicode-safe, bounded, and deterministically laned", async () => {
  const { api } = await loadSessionBoardApi();
  assert.equal(typeof api.normalizeSessionBoardState, "function");
  assert.equal(typeof api.buildSessionLanes, "function");

  const fixture = sessionFixture();
  const normalized = api.normalizeSessionBoardState(fixture);
  assert(normalized, "A valid 100-session projection must normalize");
  const output = plain(normalized);
  assert.deepEqual(Object.keys(output), ["schemaVersion", "kind", "revision", "changedAt", "sessions"]);
  assert.equal(output.schemaVersion, 1);
  assert.equal(output.kind, "session-board-state");
  assert.equal(output.sessions.length, 100);
  assert.deepEqual(Object.keys(output.sessions[0]), [
    "id", "title", "kind", "state", "firstSeenAt", "lastOpenedAt", "response",
  ]);
  assert.deepEqual(Object.keys(output.sessions[0].response), ["state", "evidence", "changedAt"]);
  assert(!JSON.stringify(output).match(/https?:|prompt|responseBody|providerBody|messageBody/iu));

  for (let index = 0; index < specialTitles.length; index += 1) {
    const session = output.sessions.find((item) => item.id === sessionId(index + 1));
    assert.equal(session.title, specialTitles[index]);
  }

  const rank = { active: 0, open: 1, past: 2 };
  const expectedIds = fixture.sessions.toSorted((left, right) =>
    rank[left.state] - rank[right.state]
      || right.lastOpenedAt - left.lastOpenedAt
      || left.id.localeCompare(right.id)).map((session) => session.id);
  assert.deepEqual(output.sessions.map((session) => session.id), expectedIds);

  const lanes = plain(api.buildSessionLanes(normalized));
  assert.deepEqual(lanes.map((lane) => ({ state: lane.state, count: lane.count })), [
    { state: "active", count: 1 },
    { state: "open", count: 2 },
    { state: "past", count: 97 },
  ]);
  assert.equal(lanes.flatMap((lane) => lane.sessions).length, 100,
    "Lane construction must retain the full bounded history");

  const withExtraRoot = structuredClone(fixture);
  withExtraRoot.tasks = [];
  const withExtraSession = structuredClone(fixture);
  withExtraSession.sessions[0].taskId = sessionId(200);
  const withExtraResponse = structuredClone(fixture);
  withExtraResponse.sessions[0].response.detail = "private";
  const withUrl = structuredClone(fixture);
  withUrl.sessions[0].url = "https://claude.ai/chat/private";
  const withPrompt = structuredClone(fixture);
  withPrompt.sessions[0].prompt = "private";
  const withResponseBody = structuredClone(fixture);
  withResponseBody.sessions[0].response.body = "private";
  const malformedUnicode = structuredClone(fixture);
  malformedUnicode.sessions[0].title = "broken\uD800title";
  const emptyTitle = structuredClone(fixture);
  emptyTitle.sessions[0].title = "   ";
  const controlTitle = structuredClone(fixture);
  controlTitle.sessions[0].title = "hidden\u0001control";
  const oversizedTitle = structuredClone(fixture);
  oversizedTitle.sessions[0].title = "𠀀".repeat(161);
  const duplicateId = structuredClone(fixture);
  duplicateId.sessions[1].id = duplicateId.sessions[0].id;
  const invalidId = structuredClone(fixture);
  invalidId.sessions[0].id = "not-an-opaque-id";
  const invalidKind = structuredClone(fixture);
  invalidKind.sessions[0].kind = "studio";
  const invalidState = structuredClone(fixture);
  invalidState.sessions[0].state = "completed";
  const unsafeRootRevision = structuredClone(fixture);
  unsafeRootRevision.revision = Number.MAX_SAFE_INTEGER + 1;
  const unsafeRootChangedAt = structuredClone(fixture);
  unsafeRootChangedAt.changedAt = 1.5;
  const unsafeFirstSeenAt = structuredClone(fixture);
  unsafeFirstSeenAt.sessions[0].firstSeenAt = -1;
  const unsafeLastOpenedAt = structuredClone(fixture);
  unsafeLastOpenedAt.sessions[0].lastOpenedAt = Number.MAX_SAFE_INTEGER + 1;
  const reversedTimestamps = structuredClone(fixture);
  reversedTimestamps.sessions[0].lastOpenedAt = reversedTimestamps.sessions[0].firstSeenAt - 1;
  const unknownEvidence = structuredClone(fixture);
  const unknownEvidenceResponse = unknownEvidence.sessions.find(
    (session) => session.response.state === "unknown").response;
  unknownEvidenceResponse.evidence = "network";
  const unknownTimestamp = structuredClone(fixture);
  const unknownTimestampResponse = unknownTimestamp.sessions.find(
    (session) => session.response.state === "unknown").response;
  unknownTimestampResponse.changedAt = 4000;
  const unsafeResponseTimestamp = structuredClone(fixture);
  unsafeResponseTimestamp.sessions.find(
    (session) => session.response.state === "working").response.changedAt = Number.MAX_SAFE_INTEGER + 1;
  const invalidResponseState = structuredClone(fixture);
  invalidResponseState.sessions[0].response.state = "idle";
  const invalidResponseEvidence = structuredClone(fixture);
  invalidResponseEvidence.sessions[0].response.evidence = "provider-content";
  const responseMismatches = [];
  for (const state of ["working", "completed", "failed"]) {
    const wrongEvidence = structuredClone(fixture);
    wrongEvidence.sessions.find((session) => session.response.state === state).response.evidence = "none";
    responseMismatches.push(wrongEvidence);
    const missingTimestamp = structuredClone(fixture);
    missingTimestamp.sessions.find((session) => session.response.state === state).response.changedAt = null;
    responseMismatches.push(missingTimestamp);
  }
  const tooMany = sessionFixture(101);
  const wrongSchema = structuredClone(fixture);
  wrongSchema.schemaVersion = 2;
  const wrongRootKind = structuredClone(fixture);
  wrongRootKind.kind = "taskboard-state";
  for (const invalid of [
    withExtraRoot, withExtraSession, withExtraResponse,
    withUrl, withPrompt, withResponseBody,
    malformedUnicode, emptyTitle, controlTitle, oversizedTitle,
    duplicateId, invalidId, invalidKind, invalidState,
    unsafeRootRevision, unsafeRootChangedAt,
    unsafeFirstSeenAt, unsafeLastOpenedAt, reversedTimestamps,
    unknownEvidence, unknownTimestamp, unsafeResponseTimestamp,
    invalidResponseState, invalidResponseEvidence,
    ...responseMismatches,
    tooMany, wrongSchema, wrongRootKind,
  ]) assert.equal(api.normalizeSessionBoardState(invalid), null);
});

test("session-board exposes translated status semantics, safe messages, and full-list navigation", async () => {
  const { api, source } = await loadSessionBoardApi();
  for (const name of [
    "createSessionBoard", "buildSessionBoardRenderModel",
    "getSessionBoardCopy", "getResponsePresentation",
    "createSessionBoardMessage", "getSessionNavigationIndex",
  ]) assert.equal(typeof api[name], "function", `Missing ${name}`);

  const translatedKeys = [];
  const t = (key) => {
    translatedKeys.push(key);
    return `translated:${key}`;
  };
  const copy = plain(api.getSessionBoardCopy(t));
  const copyKeys = {
    kicker: "sessionBoardKicker",
    title: "sessionBoardTitle",
    lede: "sessionBoardLede",
    refresh: "sessionBoardRefresh",
    loading: "sessionBoardLoading",
    ready: "sessionBoardReady",
    error: "sessionBoardError",
    active: "sessionBoardLaneActive",
    open: "sessionBoardLaneOpen",
    past: "sessionBoardLanePast",
    emptyActive: "sessionBoardEmptyActive",
    emptyOpen: "sessionBoardEmptyOpen",
    emptyPast: "sessionBoardEmptyPast",
    working: "sessionBoardResponseWorking",
    completed: "sessionBoardResponseCompleted",
    failed: "sessionBoardResponseFailed",
    unknown: "sessionBoardResponseUnknown",
    openSession: "sessionBoardOpenSession",
    reopen: "sessionBoardReopen",
    lastOpened: "sessionBoardLastOpened",
    kindChat: "sessionBoardKindChat",
    kindCode: "sessionBoardKindCode",
    scopeNote: "sessionBoardScopeObservedStateNotGoalCompletion",
  };
  assert.deepEqual(Object.keys(copy), Object.keys(copyKeys));
  assert.deepEqual(copy, Object.fromEntries(
    Object.entries(copyKeys).map(([name, key]) => [name, `translated:${key}`])));
  assert.deepEqual(translatedKeys, Object.values(copyKeys));

  const expectedResponses = {
    working: { icon: "spinner", tone: "working", animated: true },
    completed: { icon: "check", tone: "completed", animated: false },
    failed: { icon: "alert", tone: "failed", animated: false },
    unknown: { icon: "neutral", tone: "unknown", animated: false },
  };
  for (const [state, expected] of Object.entries(expectedResponses)) {
    const presentation = plain(api.getResponsePresentation(state, t));
    assert.deepEqual(presentation, {
      state,
      ...expected,
      label: `translated:${copyKeys[state]}`,
    });
  }

  const renderModel = plain(api.buildSessionBoardRenderModel(
    api.normalizeSessionBoardState(sessionFixture()),
    (key) => `translated:${key}`,
  ));
  assert.equal(renderModel.lanes.flatMap((lane) => lane.sessions).length, 100);
  assert.equal(renderModel.copy.scopeNote,
    "translated:sessionBoardScopeObservedStateNotGoalCompletion");
  assert.equal(renderModel.lanes.flatMap((lane) => lane.sessions)
    .find((session) => session.id === sessionId(5)).title, specialTitles[4]);
  assert.doesNotMatch(JSON.stringify(renderModel),
    /https?:|url|prompt|responseBody|providerBody|messageBody|taskId|projectId|todo/iu,
    "The render seam must remain body-free and navigation-opaque");

  const requestId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const id = sessionId(1);
  assert.deepEqual(plain(api.createSessionBoardMessage("read", { requestId })), {
    type: "session-board-read", version: 1, requestId,
  });
  assert.deepEqual(plain(api.createSessionBoardMessage("open", { requestId, sessionId: id })), {
    type: "session-board-open", version: 1, requestId, sessionId: id,
  });
  assert.equal(api.createSessionBoardMessage("refresh", { requestId }), null);
  assert.equal(api.createSessionBoardMessage("open", { requestId, sessionId: "bad" }), null);
  assert.equal(api.createSessionBoardMessage("task", { requestId, sessionId: id }), null);

  assert.equal(api.getSessionNavigationIndex("ArrowDown", 98, 100, 8), 99);
  assert.equal(api.getSessionNavigationIndex("ArrowDown", 99, 100, 8), 99);
  assert.equal(api.getSessionNavigationIndex("ArrowUp", 0, 100, 8), 0);
  assert.equal(api.getSessionNavigationIndex("Home", 55, 100, 8), 0);
  assert.equal(api.getSessionNavigationIndex("End", 2, 100, 8), 99);
  assert.equal(api.getSessionNavigationIndex("PageDown", 90, 100, 8), 98);
  assert.equal(api.getSessionNavigationIndex("PageUp", 6, 100, 8), 0);

  assert.match(source, /doc\.createElement/u);
  assert.match(source, /\.textContent\s*=/u);
  assert.doesNotMatch(source, /\.innerHTML\s*=/u, "Session titles must never enter innerHTML");
  assert.match(source, /aria-label/u);
  assert.match(source, /scrollIntoView/u);
  assert.match(source, /ArrowDown[\s\S]*ArrowUp[\s\S]*Home[\s\S]*End/u);
  assert.match(source, /host\.querySelectorAll\("\.session-board-card"\)/u,
    "Keyboard navigation must span all three lanes");
  assert.doesNotMatch(source, /list\.querySelectorAll\("\.session-board-card"\)/u);
  assert.doesNotMatch(source, /taskboard-(?:read|mutate)|prompt-shelf-(?:read|insert|create)/u);
  assert.doesNotMatch(source,
    /(?:textContent|aria-label[^\n]{0,40})\s*[=:,]\s*["'](?:Work Hub|Refresh|Active|Open|Past|Working|Completed|Failed|Unknown|Open session)["']/u,
    "Visible renderer copy must come from the supplied translator");
});

test("session-board controller keeps full-list keyboard and card semantics across lanes", async () => {
  const localeCalls = [];
  const timers = new Map();
  let timerId = 0;
  const requestIds = [
    "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  ];
  class RecordingDate {
    constructor(value) { this.value = value; }
    getTime() { return this.value <= 8_640_000_000_000_000 ? this.value : Number.NaN; }
    toLocaleString(locale) {
      localeCalls.push(locale);
      return `formatted:${locale}:${this.value}`;
    }
    toISOString() { return `fallback:${this.value}`; }
  }
  const { document, root } = createSessionBoardDom("ja-JP");
  const { api } = await loadSessionBoardApi({
    document,
    Date: RecordingDate,
    setTimeout: (callback, delay) => {
      const id = ++timerId;
      timers.set(id, { callback, delay });
      return id;
    },
    clearTimeout: (id) => { timers.delete(id); },
    window: { crypto: { randomUUID: () => requestIds.shift() ?? null } },
  });
  const messages = [];
  const controller = api.createSessionBoard({
    root,
    rootDocument: document,
    send: (message) => { messages.push(plain(message)); return true; },
    t: (key) => `translated:${key}`,
  });
  assert(controller);
  assert.equal(controller.ensure(), true);
  assert.equal(controller.receive({
    type: "session-board-state",
    version: 1,
    requestId: messages.at(-1).requestId,
    state: sessionFixture(4),
  }), true);

  const cards = root.querySelectorAll(".session-board-card");
  assert.equal(cards.length, 4);
  cards[0].dispatch("keydown", { key: "ArrowDown" });
  assert.equal(cards[1].focused, true, "ArrowDown must cross from Active into Open");
  assert.equal(cards[1].scrollCalls.length, 1);

  const listItems = root.querySelectorAll('[role="listitem"]');
  assert.equal(listItems.length, 4);
  for (let index = 0; index < listItems.length; index += 1) {
    assert.equal(listItems[index].tagName, "DIV");
    assert.equal(listItems[index].children[0], cards[index]);
    assert.equal(cards[index].tagName, "BUTTON");
    assert.equal(cards[index].getAttribute("role"), null,
      "Native button semantics must not be replaced with listitem");
  }
  assert(localeCalls.length > 0);
  assert(localeCalls.every((locale) => locale === "ja-JP"));

  const invalidDate = sessionFixture(1);
  invalidDate.sessions[0].lastOpenedAt = Number.MAX_SAFE_INTEGER;
  assert.equal(controller.refresh(), true);
  assert.equal(controller.receive({
    type: "session-board-state",
    version: 1,
    requestId: messages.at(-1).requestId,
    state: invalidDate,
  }), true);
  assert.equal(root.querySelectorAll(".session-board-card-opened").length, 0,
    "An out-of-Date-range safe integer must not render Invalid Date");
  controller.destroy();
  assert.equal(timers.size, 0);
});

test("session-board read timeout reports an error and restores Refresh", async () => {
  let timerId = 0;
  const timers = new Map();
  const setTimeoutFake = (callback, delay) => {
    const id = ++timerId;
    timers.set(id, { callback, delay });
    return id;
  };
  const clearTimeoutFake = (id) => { timers.delete(id); };
  const runOnlyTimer = () => {
    assert.equal(timers.size, 1);
    const [id, timer] = timers.entries().next().value;
    timers.delete(id);
    timer.callback();
    return timer.delay;
  };
  const { document, root } = createSessionBoardDom();
  const requestIds = [
    "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
  ];
  const { api } = await loadSessionBoardApi({
    document,
    setTimeout: setTimeoutFake,
    clearTimeout: clearTimeoutFake,
    window: {
      crypto: { randomUUID: () => requestIds.shift() ?? null },
    },
  });
  const messages = [];
  const controller = api.createSessionBoard({
    root,
    rootDocument: document,
    send: (message) => { messages.push(plain(message)); return true; },
    t: (key) => `translated:${key}`,
  });
  assert(controller);

  assert.equal(controller.ensure(), true);
  assert.equal(messages.at(-1).type, "session-board-read");
  assert.equal(root.querySelector(".session-board-refresh").disabled, true);
  const timeoutDelay = runOnlyTimer();
  assert(timeoutDelay > 0 && timeoutDelay <= 30_000, "Read timeout must be bounded");
  assert.equal(root.querySelector(".session-board-status").dataset.status, "error");
  assert.equal(root.querySelector(".session-board-status").textContent,
    "translated:sessionBoardError");
  assert.equal(root.querySelector(".session-board-refresh").disabled, false);

  assert.equal(controller.refresh(), true);
  assert.equal(timers.size, 1);
  const invalidRequestId = messages.at(-1).requestId;
  assert.equal(controller.receive({ kind: "session-board-state" }), false,
    "Raw uncorrelated state must never satisfy a host read");
  assert.equal(controller.receive({
    type: "session-board-state",
    version: 1,
    requestId: invalidRequestId,
    state: { kind: "session-board-state" },
  }), true);
  assert.equal(timers.size, 0, "An invalid board response must clear its timeout");
  assert.equal(root.querySelector(".session-board-status").dataset.status, "error");
  assert.equal(root.querySelector(".session-board-refresh").disabled, false);

  assert.equal(controller.refresh(), true);
  assert.equal(controller.receive({
    type: "session-board-state",
    version: 1,
    requestId: messages.at(-1).requestId,
    state: sessionFixture(1),
  }), true);
  assert.equal(timers.size, 0, "A valid board response must clear its timeout");
  assert.equal(root.querySelector(".session-board-status").dataset.status, "ready");

  assert.equal(controller.refresh(), true);
  assert.equal(timers.size, 1);
  controller.destroy();
  assert.equal(timers.size, 0, "Destroy must clear a pending timeout");
  assert.equal(root.children.length, 0);
});

test("session-board correlates native state and open receipts and ignores stale responses", async () => {
  const requestIds = [
    "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
  ];
  const sessionIdValue = sessionId(1);
  const stateEnvelope = (requestId, state = sessionFixture(1)) => ({
    type: "session-board-state",
    version: 1,
    requestId,
    state,
  });
  const openEnvelope = (requestId, ok, outcome) => ({
    type: "session-board-open-result",
    version: 1,
    requestId,
    sessionId: sessionIdValue,
    ok,
    outcome,
  });
  const errorEnvelope = (requestId) => ({
    type: "session-board-error",
    version: 1,
    requestId,
    action: "read",
    code: "unavailable",
  });
  let timerId = 0;
  const timers = new Map();
  const { document, root } = createSessionBoardDom();
  const { api } = await loadSessionBoardApi({
    document,
    setTimeout: (callback, delay) => {
      const id = ++timerId;
      timers.set(id, { callback, delay });
      return id;
    },
    clearTimeout: (id) => { timers.delete(id); },
    window: {
      crypto: { randomUUID: () => requestIds.shift() ?? null },
    },
  });
  assert.equal(typeof api.normalizeSessionBoardHostResponse, "function");
  assert.deepEqual(plain(api.normalizeSessionBoardHostResponse(stateEnvelope(
    "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"))), stateEnvelope(
    "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"));
  assert.deepEqual(plain(api.normalizeSessionBoardHostResponse(openEnvelope(
    "cccccccc-cccc-4ccc-8ccc-cccccccccccc", false, "unavailable"))), openEnvelope(
    "cccccccc-cccc-4ccc-8ccc-cccccccccccc", false, "unavailable"));
  assert.deepEqual(plain(api.normalizeSessionBoardHostResponse(errorEnvelope(
    "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee"))), errorEnvelope(
    "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee"));

  const withExtra = structuredClone(stateEnvelope("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"));
  withExtra.extra = true;
  const unsafeState = structuredClone(stateEnvelope("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"));
  unsafeState.state.sessions[0].url = "https://claude.ai/chat/private";
  for (const invalid of [
    withExtra,
    unsafeState,
    { ...errorEnvelope("eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee"), action: "task" },
    openEnvelope("cccccccc-cccc-4ccc-8ccc-cccccccccccc", true, "unavailable"),
    { ...openEnvelope("cccccccc-cccc-4ccc-8ccc-cccccccccccc", false, "not-found"), sessionId: "bad" },
    { ...stateEnvelope("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"), version: 2 },
    stateEnvelope("not-a-request-id"),
    { type: "state", version: 1, requestId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" },
  ]) assert.equal(api.normalizeSessionBoardHostResponse(invalid), null);

  const messages = [];
  const controller = api.createSessionBoard({
    root,
    rootDocument: document,
    send: (message) => { messages.push(plain(message)); return true; },
    t: (key) => `translated:${key}`,
  });
  assert(controller);
  assert.equal(controller.ensure(), true);
  assert.equal(messages.at(-1).requestId, "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
  assert.equal(controller.receive(stateEnvelope("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb")), false,
    "An unsolicited state response must be ignored");
  assert.equal(controller.receive(stateEnvelope("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa")), true);
  assert.equal(root.querySelector(".session-board-status").dataset.status, "ready");

  assert.equal(controller.refresh(), true);
  assert.equal(messages.at(-1).requestId, "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb");
  assert.equal(controller.receive(stateEnvelope("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa")), false,
    "A stale read response must be ignored");
  assert.equal(controller.receive(stateEnvelope("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb")), true);

  root.querySelector(".session-board-card").dispatch("click");
  assert.deepEqual(messages.at(-1), {
    type: "session-board-open",
    version: 1,
    requestId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    sessionId: sessionIdValue,
  });
  assert.equal(controller.receive(openEnvelope(
    "dddddddd-dddd-4ddd-8ddd-dddddddddddd", false, "unavailable")), false);
  assert.equal(controller.receive(openEnvelope(
    "cccccccc-cccc-4ccc-8ccc-cccccccccccc", false, "unavailable")), true);
  assert.equal(root.querySelector(".session-board-status").dataset.status, "error");
  root.querySelector(".session-board-card").dispatch("click");
  assert.equal(messages.at(-1).requestId, "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    "A failed open must leave the card retryable");
  assert.equal(controller.receive(openEnvelope(
    "dddddddd-dddd-4ddd-8ddd-dddddddddddd", true, "opened")), true);
  assert.equal(root.querySelector(".session-board-status").dataset.status, "ready");

  assert.equal(controller.refresh(), true);
  assert.equal(controller.receive(errorEnvelope("eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee")), true);
  assert.equal(root.querySelector(".session-board-status").dataset.status, "error");
  assert.equal(root.querySelector(".session-board-refresh").disabled, false);
  controller.destroy();
  assert.equal(timers.size, 0);
});

test("session-board CSS keeps every lane scrollable, responsive, and accessible", async () => {
  const styles = await readRequired(sessionBoardStylesPath, "Shared session-board stylesheet");
  assert.match(styles, /\[data-session-board-root\]/u);
  assert.match(styles, /\.session-board-lanes\s*\{[^}]*display:\s*grid[^}]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/su);
  assert.match(styles, /\.session-board-lane-list\s*\{[^}]*max-height:\s*(?:clamp|min)\([^;}]+[^}]*overflow-y:\s*auto/su);
  assert.match(styles, /\.session-board-lane-list\s*\{[^}]*overscroll-behavior:\s*contain/su);
  assert.match(styles,
    /\.session-board-card-item\s*\+\s*\.session-board-card-item\s*\{[^}]*margin-top:\s*9px/su,
    "Listitem wrappers must preserve the card stack gap");
  assert.match(styles, /@media\s*\(max-width:\s*\d+px\)[\s\S]*?\.session-board-lanes\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/u);

  assert.match(styles, /\[data-response-state="working"\][^{]*\{[^}]*animation:/su);
  assert.match(styles, /\[data-response-state="completed"\][^{]*\{[^}]*color:\s*var\(--session-board-success\)/su);
  assert.match(styles, /\[data-response-state="failed"\]/u);
  assert.match(styles, /\[data-response-state="unknown"\]/u);
  assert.match(styles, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?animation(?:-duration)?:\s*(?:none|0\.01ms)/u);
  assert.match(styles, /@media\s*\(forced-colors:\s*active\)[\s\S]*?(?:CanvasText|Highlight|ButtonText)/u);
});

runIfMain(import.meta.url);
