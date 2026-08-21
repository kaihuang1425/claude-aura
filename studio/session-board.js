(() => {
  "use strict";

  const MAX_SESSIONS = 100;
  const MAX_TITLE_SCALARS = 160;
  const READ_TIMEOUT_MS = 15_000;
  const UUID_PATTERN = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
  const ROOT_FIELDS = ["schemaVersion", "kind", "revision", "changedAt", "sessions"];
  const SESSION_FIELDS = [
    "id", "title", "kind", "state", "firstSeenAt", "lastOpenedAt", "response",
  ];
  const RESPONSE_FIELDS = ["state", "evidence", "changedAt"];
  const STATE_ENVELOPE_FIELDS = ["type", "version", "requestId", "state"];
  const ERROR_ENVELOPE_FIELDS = ["type", "version", "requestId", "action", "code"];
  const OPEN_ENVELOPE_FIELDS = ["type", "version", "requestId", "sessionId", "ok", "outcome"];
  const SESSION_KINDS = new Set(["chat", "code"]);
  const SESSION_STATES = new Set(["active", "open", "past"]);
  const RESPONSE_STATES = new Set(["unknown", "working", "completed", "failed"]);
  const OPEN_OUTCOMES = new Set(["opened", "unavailable", "not-found", "uncertain"]);
  const STATE_RANK = Object.freeze({ active: 0, open: 1, past: 2 });
  const COPY_KEYS = Object.freeze({
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
    activeNone: "sessionBoardActiveNone",
    activeOne: "sessionBoardActiveOne",
    activeOther: "sessionBoardActiveOther",
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
  });

  const isRecord = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
  const hasExactFields = (value, fields) => {
    if (!isRecord(value)) return false;
    const keys = Object.keys(value);
    return keys.length === fields.length && fields.every((field) => Object.hasOwn(value, field));
  };
  const isSafeTimestamp = (value) => Number.isSafeInteger(value) && value >= 0;
  const isWellFormed = (value) => {
    if (typeof value !== "string") return false;
    if (typeof value.isWellFormed === "function") return value.isWellFormed();
    for (let index = 0; index < value.length; index += 1) {
      const code = value.charCodeAt(index);
      if (code >= 0xD800 && code <= 0xDBFF) {
        const next = value.charCodeAt(index + 1);
        if (!(next >= 0xDC00 && next <= 0xDFFF)) return false;
        index += 1;
      } else if (code >= 0xDC00 && code <= 0xDFFF) {
        return false;
      }
    }
    return true;
  };
  const isTitle = (value) => typeof value === "string"
    && value.trim().length > 0
    && isWellFormed(value)
    && Array.from(value).length <= MAX_TITLE_SCALARS
    && !/[\u0000-\u001F\u007F-\u009F]/u.test(value);

  const normalizeResponse = (value) => {
    if (!hasExactFields(value, RESPONSE_FIELDS) || !RESPONSE_STATES.has(value.state)) return null;
    if (value.state === "unknown") {
      if (value.evidence !== "none" || value.changedAt !== null) return null;
    } else if (value.evidence !== "network" || !isSafeTimestamp(value.changedAt)) {
      return null;
    }
    return {
      state: value.state,
      evidence: value.evidence,
      changedAt: value.changedAt,
    };
  };

  const compareSessions = (left, right) => {
    const stateDifference = STATE_RANK[left.state] - STATE_RANK[right.state];
    if (stateDifference !== 0) return stateDifference;
    const timeDifference = right.lastOpenedAt - left.lastOpenedAt;
    if (timeDifference !== 0) return timeDifference;
    return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
  };

  const normalizeSessionBoardState = (value) => {
    if (!hasExactFields(value, ROOT_FIELDS)
        || value.schemaVersion !== 1
        || value.kind !== "session-board-state"
        || !isSafeTimestamp(value.revision)
        || !isSafeTimestamp(value.changedAt)
        || !Array.isArray(value.sessions)
        || value.sessions.length > MAX_SESSIONS) return null;
    const ids = new Set();
    const sessions = [];
    for (const candidate of value.sessions) {
      if (!hasExactFields(candidate, SESSION_FIELDS)
          || typeof candidate.id !== "string"
          || !UUID_PATTERN.test(candidate.id)
          || ids.has(candidate.id)
          || !isTitle(candidate.title)
          || !SESSION_KINDS.has(candidate.kind)
          || !SESSION_STATES.has(candidate.state)
          || !isSafeTimestamp(candidate.firstSeenAt)
          || !isSafeTimestamp(candidate.lastOpenedAt)
          || candidate.lastOpenedAt < candidate.firstSeenAt) return null;
      const response = normalizeResponse(candidate.response);
      if (!response) return null;
      ids.add(candidate.id);
      sessions.push({
        id: candidate.id,
        title: candidate.title,
        kind: candidate.kind,
        state: candidate.state,
        firstSeenAt: candidate.firstSeenAt,
        lastOpenedAt: candidate.lastOpenedAt,
        response,
      });
    }
    sessions.sort(compareSessions);
    return {
      schemaVersion: 1,
      kind: "session-board-state",
      revision: value.revision,
      changedAt: value.changedAt,
      sessions,
    };
  };

  const buildSessionLanes = (value) => {
    const normalized = normalizeSessionBoardState(value);
    if (!normalized) return null;
    return ["active", "open", "past"].map((state) => {
      const sessions = normalized.sessions.filter((session) => session.state === state);
      return { state, count: sessions.length, sessions };
    });
  };

  const getSessionBoardCopy = (translate) => {
    const t = typeof translate === "function" ? translate : (key) => key;
    return Object.fromEntries(Object.entries(COPY_KEYS).map(([name, key]) => [name, t(key)]));
  };

  // The Work Hub indicator names what its light means. A bare total read as an
  // active count even when most of it was past work, so label the active lane
  // explicitly and let the light follow that same number.
  const formatActiveSessionCount = (count, copy) => {
    if (!Number.isInteger(count) || count <= 0) return copy.activeNone;
    const template = count === 1 ? copy.activeOne : copy.activeOther;
    return template.replace("{0}", String(count));
  };

  const getResponsePresentation = (candidate, translate) => {
    const state = RESPONSE_STATES.has(candidate) ? candidate : "unknown";
    const t = typeof translate === "function" ? translate : (key) => key;
    const presentation = {
      working: { icon: "spinner", tone: "working", animated: true },
      completed: { icon: "check", tone: "completed", animated: false },
      failed: { icon: "alert", tone: "failed", animated: false },
      unknown: { icon: "neutral", tone: "unknown", animated: false },
    }[state];
    return {
      state,
      ...presentation,
      label: t(COPY_KEYS[state]),
    };
  };

  const createSessionBoardMessage = (action, fields = {}) => {
    if (!UUID_PATTERN.test(fields.requestId ?? "")) return null;
    if (action === "read") {
      return { type: "session-board-read", version: 1, requestId: fields.requestId };
    }
    if (action === "open" && UUID_PATTERN.test(fields.sessionId ?? "")) {
      return {
        type: "session-board-open",
        version: 1,
        requestId: fields.requestId,
        sessionId: fields.sessionId,
      };
    }
    return null;
  };

  const normalizeSessionBoardHostResponse = (value) => {
    if (!isRecord(value) || !Number.isInteger(value.version) || value.version !== 1
        || typeof value.requestId !== "string" || !UUID_PATTERN.test(value.requestId)) return null;
    if (value.type === "session-board-state") {
      if (!hasExactFields(value, STATE_ENVELOPE_FIELDS)) return null;
      const state = normalizeSessionBoardState(value.state);
      if (!state) return null;
      return {
        type: "session-board-state",
        version: 1,
        requestId: value.requestId,
        state,
      };
    }
    if (value.type === "session-board-error") {
      if (!hasExactFields(value, ERROR_ENVELOPE_FIELDS)
          || !["read", "open"].includes(value.action)
          || value.code !== "unavailable") return null;
      return {
        type: "session-board-error",
        version: 1,
        requestId: value.requestId,
        action: value.action,
        code: "unavailable",
      };
    }
    if (value.type === "session-board-open-result") {
      if (!hasExactFields(value, OPEN_ENVELOPE_FIELDS)
          || typeof value.sessionId !== "string" || !UUID_PATTERN.test(value.sessionId)
          || typeof value.ok !== "boolean" || !OPEN_OUTCOMES.has(value.outcome)
          || value.ok !== (value.outcome === "opened")) return null;
      return {
        type: "session-board-open-result",
        version: 1,
        requestId: value.requestId,
        sessionId: value.sessionId,
        ok: value.ok,
        outcome: value.outcome,
      };
    }
    return null;
  };

  const getSessionNavigationIndex = (key, current, count, pageSize = 8) => {
    if (!Number.isInteger(current) || !Number.isInteger(count) || count <= 0) return -1;
    const index = Math.max(0, Math.min(count - 1, current));
    const page = Number.isInteger(pageSize) && pageSize > 0 ? pageSize : 8;
    if (key === "ArrowDown") return Math.min(count - 1, index + 1);
    if (key === "ArrowUp") return Math.max(0, index - 1);
    if (key === "Home") return 0;
    if (key === "End") return count - 1;
    if (key === "PageDown") return Math.min(count - 1, index + page);
    if (key === "PageUp") return Math.max(0, index - page);
    return index;
  };

  const buildSessionBoardRenderModel = (value, translate) => {
    const normalized = normalizeSessionBoardState(value);
    if (!normalized) return null;
    const copy = getSessionBoardCopy(translate);
    const lanes = buildSessionLanes(normalized).map((lane) => ({
      state: lane.state,
      count: lane.count,
      label: copy[lane.state],
      emptyLabel: copy[`empty${lane.state[0].toUpperCase()}${lane.state.slice(1)}`],
      sessions: lane.sessions.map((session) => ({
        id: session.id,
        title: session.title,
        kind: session.kind,
        kindLabel: copy[session.kind === "chat" ? "kindChat" : "kindCode"],
        state: session.state,
        firstSeenAt: session.firstSeenAt,
        lastOpenedAt: session.lastOpenedAt,
        response: { ...session.response },
        responsePresentation: getResponsePresentation(session.response.state, translate),
      })),
    }));
    return {
      schemaVersion: 1,
      revision: normalized.revision,
      changedAt: normalized.changedAt,
      copy,
      lanes,
    };
  };

  const newRequestId = () => {
    const candidate = window.crypto?.randomUUID?.();
    const value = typeof candidate === "string" ? candidate.toLowerCase() : "";
    return UUID_PATTERN.test(value) ? value : null;
  };

  const createSessionBoard = ({ root, rootDocument, send, t } = {}) => {
    const host = root ?? rootDocument?.querySelector?.("[data-session-board-root]") ?? null;
    if (!host || typeof send !== "function" || typeof t !== "function") return null;
    const doc = rootDocument ?? host.ownerDocument ?? document;
    const configuredLanguage = doc.documentElement?.getAttribute?.("lang")
      ?? doc.documentElement?.lang;
    const language = typeof configuredLanguage === "string" && configuredLanguage.trim()
      ? configuredLanguage.trim()
      : undefined;
    const navigationKeys = ["ArrowDown", "ArrowUp", "Home", "End", "PageDown", "PageUp"];
    let loaded = false;
    let pending = false;
    let pendingReadRequestId = null;
    let pendingOpen = null;
    let destroyed = false;
    let readTimer = null;
    let openTimer = null;
    let currentState = normalizeSessionBoardState({
      schemaVersion: 1,
      kind: "session-board-state",
      revision: 0,
      changedAt: 0,
      sessions: [],
    });

    const make = (tag, className) => {
      const element = doc.createElement(tag);
      if (className) element.className = className;
      return element;
    };
    const formatTime = (value) => {
      const date = new Date(value);
      if (!Number.isFinite(date.getTime())) return null;
      try { return date.toLocaleString(language); } catch { return date.toISOString(); }
    };
    const clearReadTimer = () => {
      if (readTimer === null) return;
      clearTimeout(readTimer);
      readTimer = null;
    };
    const startReadTimer = () => {
      clearReadTimer();
      readTimer = setTimeout(() => {
        readTimer = null;
        if (destroyed || !pending) return;
        pending = false;
        pendingReadRequestId = null;
        render("error");
      }, READ_TIMEOUT_MS);
    };
    const clearOpenTimer = () => {
      if (openTimer === null) return;
      clearTimeout(openTimer);
      openTimer = null;
    };
    const startOpenTimer = () => {
      clearOpenTimer();
      openTimer = setTimeout(() => {
        openTimer = null;
        if (destroyed || pendingOpen === null) return;
        pendingOpen = null;
        render("error");
      }, READ_TIMEOUT_MS);
    };
    const sendMessage = (action, fields = {}) => {
      const requestId = newRequestId();
      if (!requestId) return false;
      const message = createSessionBoardMessage(action, { requestId, ...fields });
      return message && send(message) ? message : null;
    };
    const render = (statusName = loaded ? "ready" : "loading") => {
      if (destroyed) return false;
      const model = buildSessionBoardRenderModel(currentState, t);
      if (!model) return false;
      host.replaceChildren();
      host.setAttribute("aria-busy", String(statusName === "loading"));

      const header = make("header", "session-board-header");
      const headingCopy = make("div", "session-board-heading-copy");
      const kicker = make("p", "session-board-kicker");
      kicker.textContent = "CLAUDE AURA";
      const title = make("h1", "session-board-title");
      title.tabIndex = -1;
      title.textContent = model.copy.title;
      const lede = make("p", "session-board-lede");
      lede.textContent = model.copy.lede;
      headingCopy.append(kicker, title, lede);
      const actions = make("div", "session-board-actions");
      const refresh = make("button", "session-board-refresh");
      refresh.type = "button";
      refresh.disabled = pending || pendingOpen !== null;
      refresh.textContent = model.copy.refresh;
      refresh.addEventListener("click", () => requestRead(true));
      const info = make("button", "session-board-info");
      info.type = "button";
      info.textContent = "i";
      info.setAttribute("aria-label", model.copy.scopeNote);
      info.setAttribute("aria-expanded", "false");
      info.setAttribute("aria-controls", "session-board-disclosure");
      info.title = model.copy.scopeNote;
      const disclosure = make("aside", "session-board-disclosure");
      disclosure.id = "session-board-disclosure";
      disclosure.hidden = true;
      disclosure.setAttribute("role", "note");
      const disclosureScope = make("p", "session-board-disclosure-scope");
      disclosureScope.textContent = model.copy.scopeNote;
      disclosure.append(disclosureScope);
      info.addEventListener("click", () => {
        const expanded = info.getAttribute("aria-expanded") !== "true";
        info.setAttribute("aria-expanded", String(expanded));
        disclosure.hidden = !expanded;
      });
      const status = make("span", "session-board-status");
      status.setAttribute("role", statusName === "error" ? "alert" : "status");
      status.setAttribute("aria-live", "polite");
      status.dataset.status = statusName;
      const statusCopy = model.copy[statusName] ?? model.copy.ready;
      const activeCount = model.lanes.find((lane) => lane.state === "active")?.count ?? 0;
      status.dataset.activeSessions = String(activeCount);
      status.textContent = statusName === "ready"
        ? formatActiveSessionCount(activeCount, model.copy)
        : statusCopy;
      status.title = statusCopy;
      actions.append(refresh, info, disclosure);
      header.append(headingCopy, actions);

      const summary = make("div", "session-board-summary");
      summary.append(status);
      const laneGrid = make("div", "session-board-lanes");
      for (const lane of model.lanes) {
        const laneElement = make("section", "session-board-lane");
        laneElement.dataset.sessionLane = lane.state;
        const laneHeader = make("header", "session-board-lane-header");
        const laneTitle = make("h2", "session-board-lane-title");
        laneTitle.textContent = lane.label;
        const count = make("output", "session-board-lane-count");
        count.textContent = String(lane.count);
        count.setAttribute("aria-label", `${lane.label}: ${lane.count}`);
        laneHeader.append(laneTitle, count);
        const list = make("div", "session-board-lane-list");
        list.dataset.sessionLaneList = lane.state;
        list.dataset.empty = String(lane.sessions.length === 0);
        list.setAttribute("role", "list");
        if (!lane.sessions.length) {
          const empty = make("p", "session-board-empty");
          empty.textContent = lane.emptyLabel;
          list.append(empty);
        }
        for (const session of lane.sessions) {
          const item = make("div", "session-board-card-item");
          item.setAttribute("role", "listitem");
          const card = make("button", "session-board-card");
          card.type = "button";
          card.disabled = pendingOpen !== null;
          card.dataset.sessionId = session.id;
          card.setAttribute("aria-label", `${model.copy.reopen}: ${session.title}`);
          const copyColumn = make("span", "session-board-card-copy");
          const cardTitle = make("strong", "session-board-card-title");
          cardTitle.textContent = session.title;
          const metadata = make("span", "session-board-card-meta");
          const kind = make("span", "session-board-card-kind");
          kind.textContent = session.kindLabel;
          metadata.append(kind);
          const openedAt = formatTime(session.lastOpenedAt);
          if (openedAt !== null) {
            const opened = make("span", "session-board-card-opened");
            opened.textContent = `${model.copy.lastOpened}: ${openedAt}`;
            metadata.append(opened);
          }
          copyColumn.append(cardTitle, metadata);
          const response = make("span", "session-board-response-icon");
          response.dataset.responseState = session.responsePresentation.state;
          response.dataset.responseIcon = session.responsePresentation.icon;
          response.setAttribute("aria-label", session.responsePresentation.label);
          response.setAttribute("title", session.responsePresentation.label);
          response.textContent = session.responsePresentation.icon === "check" ? "✓"
            : session.responsePresentation.icon === "alert" ? "!"
              : session.responsePresentation.icon === "neutral" ? "•" : "";
          const openIcon = make("span", "session-board-open-icon");
          openIcon.textContent = "↗";
          openIcon.setAttribute("aria-hidden", "true");
          card.append(copyColumn, response, openIcon);
          card.addEventListener("click", () => requestOpen(session.id));
          card.addEventListener("keydown", (event) => {
            if (!navigationKeys.includes(event.key)) return;
            const cards = [...host.querySelectorAll(".session-board-card")];
            const index = cards.indexOf(card);
            const nextIndex = getSessionNavigationIndex(event.key, index, cards.length, 8);
            if (nextIndex < 0 || nextIndex === index) return;
            event.preventDefault();
            cards[nextIndex].focus();
            cards[nextIndex].scrollIntoView({ block: "nearest", inline: "nearest" });
          });
          item.append(card);
          list.append(item);
        }
        laneElement.append(laneHeader, list);
        laneGrid.append(laneElement);
      }
      host.append(header, summary, laneGrid);
      return true;
    };

    function requestRead(force = false) {
      if (destroyed || pending || (loaded && !force)) return false;
      pending = true;
      render("loading");
      const message = sendMessage("read");
      if (!message) {
        pending = false;
        pendingReadRequestId = null;
        clearReadTimer();
        render("error");
      } else if (pending) {
        pendingReadRequestId = message.requestId;
        startReadTimer();
      }
      return Boolean(message);
    }

    function requestOpen(sessionId) {
      if (destroyed || pending || pendingOpen !== null || !UUID_PATTERN.test(sessionId)) return false;
      const message = sendMessage("open", { sessionId });
      if (!message) {
        render("error");
        return false;
      }
      pendingOpen = { requestId: message.requestId, sessionId };
      render("loading");
      startOpenTimer();
      return true;
    }

    const receive = (value) => {
      const envelope = normalizeSessionBoardHostResponse(value);
      if (!envelope) {
        if (isRecord(value) && value.version === 1 && typeof value.requestId === "string"
            && value.type === "session-board-state" && pending
            && value.requestId === pendingReadRequestId) {
          pending = false;
          pendingReadRequestId = null;
          clearReadTimer();
          render("error");
          return true;
        }
        return false;
      }
      if (envelope.type === "session-board-state") {
        if (!pending || envelope.requestId !== pendingReadRequestId) return false;
        pending = false;
        pendingReadRequestId = null;
        clearReadTimer();
        currentState = envelope.state;
        loaded = true;
        render("ready");
        return true;
      }
      if (envelope.type === "session-board-error") {
        if (envelope.action === "read") {
          if (!pending || envelope.requestId !== pendingReadRequestId) return false;
          pending = false;
          pendingReadRequestId = null;
          clearReadTimer();
          render("error");
          return true;
        }
        if (pendingOpen === null || envelope.requestId !== pendingOpen.requestId) return false;
        pendingOpen = null;
        clearOpenTimer();
        render("error");
        return true;
      }
      if (pendingOpen === null || envelope.requestId !== pendingOpen.requestId
          || envelope.sessionId !== pendingOpen.sessionId) return false;
      pendingOpen = null;
      clearOpenTimer();
      render(envelope.ok ? "ready" : "error");
      return true;
    };

    render("loading");
    return {
      ensure: () => requestRead(false),
      refresh: () => requestRead(true),
      receive,
      render: () => render(pending || pendingOpen !== null ? "loading" : loaded ? "ready" : "loading"),
      destroy: () => {
        destroyed = true;
        pending = false;
        pendingReadRequestId = null;
        pendingOpen = null;
        clearReadTimer();
        clearOpenTimer();
        host.replaceChildren();
      },
    };
  };

  window.CLAUDE_AURA_SESSION_BOARD = Object.freeze({
    normalizeSessionBoardState,
    buildSessionLanes,
    getSessionBoardCopy,
    formatActiveSessionCount,
    getResponsePresentation,
    createSessionBoardMessage,
    normalizeSessionBoardHostResponse,
    getSessionNavigationIndex,
    buildSessionBoardRenderModel,
    createSessionBoard,
  });
})();
