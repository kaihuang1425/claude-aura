// Claude Aura taskboard projection shared by Studio and the owned Desktop panel.
// Task text stays inside the local WebView/host bridge and never enters logs.
(() => {
  "use strict";

  const STATUS_IDS = Object.freeze(["todo", "in-progress", "needs-input", "review", "blocked", "done"]);
  const BOARD_STATUS_IDS = Object.freeze(["todo", "in-progress", "needs-input", "review", "blocked", "done"]);
  const ATTENTION_STATUS_IDS = Object.freeze(["needs-input", "review", "blocked"]);
  const PRIORITY_IDS = Object.freeze(["urgent", "high", "normal", "low", "none"]);
  const VIEW_IDS = Object.freeze(["dashboard", "board", "list", "timeline"]);
  const ACTIVITY_IDS = Object.freeze([
    "created", "updated", "status-changed", "session-state-changed",
    "commented", "accepted", "deleted", "opened",
  ]);
  const SESSION_STATES = Object.freeze(["unlinked", "linked", "active", "terminated"]);
  const SESSION_EVIDENCE = Object.freeze(["local", "provider-observed", "user-reported"]);
  const DESTINATION_TYPES = Object.freeze([
    "work-hub", "attention", "recent", "action-queue", "projects", "project", "task", "studio-page",
  ]);
  const FIND_WORK_DESTINATIONS = Object.freeze([
    "work-hub", "attention", "recent", "action-queue", "projects",
  ]);
  const uuidPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
  const localTargetPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-[458][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
  const sessionIdPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
  const draftIdPattern = /^[a-f0-9]{32}$/;
  const draftFingerprintPattern = /^[a-f0-9]{64}$/;
  const QUEUE_STATUS_IDS = Object.freeze([
    "queued", "awaiting_dispatch", "awaiting_user_action", "dispatched", "accepted",
    "active", "sent", "completed", "failed", "cancelled", "uncertain",
  ]);
  const QUEUE_RECEIPT_STAGES = Object.freeze([
    "local_enqueued", "transport_written", "draft_inserted", "provider_accepted",
    "run_started", "user_reported_sent", "user_cancelled", "completed",
  ]);

  const isRecord = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
  const boundedString = (value, maximum, allowEmpty = true) => (
    typeof value === "string"
      && value.length <= maximum
      && (allowEmpty || value.trim().length > 0)
      && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value)
  );
  const exactKeys = (value, keys) => (
    isRecord(value)
      && Object.keys(value).length === keys.length
      && keys.every((key) => Object.hasOwn(value, key))
  );
  const normalizeQueue = (value) => {
    if (!Array.isArray(value) || value.length > 200) return null;
    const commandIds = new Set();
    const activeDraftIds = new Set();
    const activePositions = new Set();
    const sequences = new Set();
    const terminalStatuses = new Set(["sent", "completed", "failed", "cancelled"]);
    const normalized = value.map((item) => {
      if (!exactKeys(item, [
        "commandId", "draftId", "draftFingerprint", "taskId", "localTargetId", "adapterKind",
        "adapterEpoch", "sequence", "causationCommandId", "status", "position",
        "priority", "receiptStage", "receiptCertainty", "drainMode",
        "statusApplicationMode", "statusEvidenceClass", "createdAt", "updatedAt",
      ])
          || !uuidPattern.test(item.commandId) || commandIds.has(item.commandId)
          || !draftIdPattern.test(item.draftId)
          || !draftFingerprintPattern.test(item.draftFingerprint)
          || !uuidPattern.test(item.taskId) || !localTargetPattern.test(item.localTargetId)
          || typeof item.adapterKind !== "string"
          || !/^[a-z][a-z0-9._-]{0,63}$/u.test(item.adapterKind)
          || !Number.isSafeInteger(item.adapterEpoch) || item.adapterEpoch < 0
          || !Number.isSafeInteger(item.sequence) || item.sequence < 0
          || !(item.causationCommandId === null || uuidPattern.test(item.causationCommandId))
          || !QUEUE_STATUS_IDS.includes(item.status)
          || !Number.isSafeInteger(item.position) || item.position < 0 || item.position > 10000
          || !Number.isSafeInteger(item.priority) || item.priority < -100 || item.priority > 100
          || !QUEUE_RECEIPT_STAGES.includes(item.receiptStage)
          || !["certain", "uncertain"].includes(item.receiptCertainty)
          || !["retained", "automatic", "user_mediated"].includes(item.drainMode)
          || !["automatic", "user_mediated"].includes(item.statusApplicationMode)
          || !["local", "transport", "provider_event", "user_reported"]
            .includes(item.statusEvidenceClass)
          || !Number.isSafeInteger(item.createdAt) || item.createdAt < 0
          || !Number.isSafeInteger(item.updatedAt) || item.updatedAt < item.createdAt) return null;
      if (item.receiptCertainty === "uncertain"
          && (item.status !== "uncertain" || item.drainMode !== "retained")) return null;
      if (item.drainMode === "automatic" && item.statusEvidenceClass !== "provider_event") return null;
      if (item.statusApplicationMode === "automatic"
          && ["accepted", "active", "completed", "failed"].includes(item.status)
          && item.statusEvidenceClass !== "provider_event") return null;
      const sequenceKey = `${item.localTargetId}|${item.adapterEpoch}|${item.sequence}`;
      if (sequences.has(sequenceKey)) return null;
      sequences.add(sequenceKey);
      commandIds.add(item.commandId);
      if (!terminalStatuses.has(item.status)) {
        const positionKey = `${item.localTargetId}|${item.position}`;
        if (activeDraftIds.has(item.draftId) || activePositions.has(positionKey)) return null;
        activeDraftIds.add(item.draftId);
        activePositions.add(positionKey);
      }
      return { ...item };
    });
    return normalized.some((item) => item === null) ? null : normalized;
  };
  const normalizeQueueReceipts = (value, commandIds) => {
    if (!Array.isArray(value) || value.length > 2000) return null;
    const ids = new Set();
    const normalized = value.map((item) => {
      if (!exactKeys(item, [
        "id", "commandId", "stage", "certainty", "drainMode",
        "statusApplicationMode", "evidenceClass", "at",
      ])
          || !uuidPattern.test(item.id) || ids.has(item.id)
          || !uuidPattern.test(item.commandId) || !commandIds.has(item.commandId)
          || !QUEUE_RECEIPT_STAGES.includes(item.stage)
          || !["certain", "uncertain"].includes(item.certainty)
          || !["retained", "automatic", "user_mediated"].includes(item.drainMode)
          || !["automatic", "user_mediated"].includes(item.statusApplicationMode)
          || !["local", "transport", "provider_event", "user_reported"]
            .includes(item.evidenceClass)
          || !Number.isSafeInteger(item.at) || item.at < 0) return null;
      if (item.drainMode === "automatic" && item.evidenceClass !== "provider_event") return null;
      ids.add(item.id);
      return { ...item };
    });
    return normalized.some((item) => item === null) ? null : normalized;
  };
  const replace = (copy, values) => values.reduce(
    (result, value, index) => result.replaceAll(`{${index}}`, String(value)),
    copy,
  );
  const normalizeLocalSessions = (value) => {
    if (!exactKeys(value, ["schemaVersion", "available", "sessions"])
        || value.schemaVersion !== 1 || typeof value.available !== "boolean"
        || !Array.isArray(value.sessions) || value.sessions.length > 20) return null;
    const ids = new Set();
    const sessions = value.sessions.map((item) => {
      if (!exactKeys(item, ["id", "title", "updatedAt", "workspace", "branch", "pinned"])
          || !sessionIdPattern.test(item.id) || ids.has(item.id)
          || !boundedString(item.title, 160, false)
          || !Number.isSafeInteger(item.updatedAt) || item.updatedAt < 0
          || !boundedString(item.workspace, 120)
          || !boundedString(item.branch, 160)
          || typeof item.pinned !== "boolean") return null;
      ids.add(item.id);
      return { ...item };
    });
    if (sessions.some((item) => item === null)) return null;
    return { schemaVersion: 1, available: value.available, sessions };
  };
  const TIMELINE_DAY_MS = 86400000;
  const timelineDateValue = (value) => {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/u.test(value)) return null;
    const [year, month, day] = value.split("-").map(Number);
    const timestamp = Date.UTC(year, month - 1, day);
    const date = new Date(timestamp);
    return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1
      && date.getUTCDate() === day ? timestamp : null;
  };
  const timelineDateKey = (value) => new Date(value).toISOString().slice(0, 10);
  const buildTimelineScale = (tasks) => {
    const candidates = Array.isArray(tasks) ? tasks.flatMap((task) => {
      const start = timelineDateValue(task?.startDate || task?.dueDate);
      const finalDate = timelineDateValue(task?.dueDate || task?.startDate);
      if (start === null || finalDate === null) return [];
      const endExclusive = Math.max(start, finalDate) + TIMELINE_DAY_MS;
      return [{ task, start, endExclusive }];
    }) : [];
    if (!candidates.length) return Object.freeze({ ranges: [], tickDates: [] });

    const minimum = Math.min(...candidates.map((item) => item.start));
    const maximum = Math.max(...candidates.map((item) => item.endExclusive));
    const span = Math.max(TIMELINE_DAY_MS, maximum - minimum);
    const boundaryCount = Math.round(span / TIMELINE_DAY_MS) + 1;
    const tickCount = Math.min(7, Math.max(2, boundaryCount));
    const tickDates = Array.from({ length: tickCount }, (_, index) => {
      const dayOffset = Math.round((span / TIMELINE_DAY_MS) * (index / (tickCount - 1)));
      return timelineDateKey(minimum + dayOffset * TIMELINE_DAY_MS);
    });
    const ranges = candidates.map((item) => {
      const left = ((item.start - minimum) / span) * 100;
      const naturalWidth = ((item.endExclusive - item.start) / span) * 100;
      return Object.freeze({
        task: item.task,
        start: item.start,
        endExclusive: item.endExclusive,
        left,
        width: Math.min(100 - left, Math.max(2, naturalWidth)),
      });
    });
    return Object.freeze({ minimum, maximum, span, ranges, tickDates: Object.freeze(tickDates) });
  };
  const destinationScrollTarget = (scrollLeft, clientWidth, itemLeft, itemWidth) => {
    if (itemLeft < scrollLeft) return Math.max(0, itemLeft);
    const itemRight = itemLeft + itemWidth;
    if (itemRight > scrollLeft + clientWidth) return Math.max(0, itemRight - clientWidth);
    return scrollLeft;
  };
  const buildSideRouteCounts = (documentValue) => {
    const tasks = Array.isArray(documentValue?.tasks) ? documentValue.tasks : [];
    const taskIds = new Set(tasks.map((task) => task?.id));
    const recentIds = new Set();
    const activity = Array.isArray(documentValue?.activity) ? documentValue.activity : [];
    const queue = Array.isArray(documentValue?.queue) ? documentValue.queue : [];
    for (let index = activity.length - 1; index >= 0; index -= 1) {
      const item = activity[index];
      if (item?.kind === "opened" && taskIds.has(item.taskId)) recentIds.add(item.taskId);
    }
    return Object.freeze({
      attention: tasks.filter((task) => ATTENTION_STATUS_IDS.includes(task?.status)).length,
      recent: recentIds.size,
      "action-queue": queue.filter(
        (item) => !["sent", "completed", "failed", "cancelled"].includes(item?.status),
      ).length,
    });
  };
  const taskDestinationPrimaryAction = (task) => (
    task?.status === "done" ? "edit" : "next-message"
  );
  const sessionPresentation = (task = {}) => {
    if (!boundedString(task.providerThreadId, 160, false)
        || !SESSION_STATES.includes(task.sessionState)
        || task.sessionState === "unlinked"
        || !SESSION_EVIDENCE.includes(task.sessionEvidence)) return null;
    const labelKey = task.sessionState === "active" ? "taskboardSessionActive"
      : task.sessionState === "terminated" && task.sessionTerminationReason === "usage-limit"
        ? "taskboardSessionTerminatedUsageLimit" : "taskboardSessionLinked";
    const evidenceKey = task.sessionEvidence === "provider-observed"
      ? "taskboardSessionEvidenceProviderObserved"
      : task.sessionEvidence === "user-reported"
        ? "taskboardSessionEvidenceUserReported" : "taskboardSessionEvidenceLocal";
    return Object.freeze({ state: task.sessionState, labelKey, evidenceKey });
  };
  const queueRowPresentation = (value = {}) => {
    if (value.status === "awaiting_user_action") {
      return Object.freeze({ kind: "sent-next", reason: null });
    }
    if (!["queued", "uncertain"].includes(value.status)) {
      return Object.freeze({ kind: "none", reason: null });
    }
    if (!value.promptAvailable) {
      return Object.freeze({ kind: "blocked", reason: "taskboardQueuePromptMissing" });
    }
    if (!value.fingerprintMatches) {
      return Object.freeze({ kind: "blocked", reason: "taskboardQueuePromptChanged" });
    }
    if (!value.isHead) {
      return Object.freeze({ kind: "blocked", reason: "taskboardQueueWaitingTurn" });
    }
    if (!value.insertionAvailable) {
      return Object.freeze({ kind: "blocked", reason: "taskboardQueueTargetUnavailable" });
    }
    if (!value.targetMatches) {
      return Object.freeze({ kind: "blocked", reason: "taskboardQueueTargetChanged" });
    }
    return Object.freeze({ kind: "place", reason: null });
  };

  function createTaskboard({
    rootDocument,
    send,
    t,
    locale,
    desktopSurface = false,
    openStudioView = null,
    getSavedPrompts = () => [],
    savedPromptsLoaded = () => true,
    ensureSavedPrompts = () => false,
    createSavedPrompt = () => false,
    getCurrentTarget = () => ({ id: null, insertionAvailable: false }),
    insertSavedPrompt = () => false,
  }) {
    if (!rootDocument || typeof send !== "function" || typeof t !== "function") return null;
    const byId = (id) => rootDocument.getElementById(id);
    const section = byId("tasks");
    if (!section) return null;

    const elements = Object.freeze({
      section,
      refresh: byId("taskboard-refresh"),
      create: byId("taskboard-new"),
      closeDesktop: byId("taskboard-close-desktop"),
      projectName: byId("taskboard-project-name"),
      projectSave: byId("taskboard-project-save"),
      status: byId("taskboard-status"),
      localNav: byId("taskboard-local-nav"),
      destinations: byId("taskboard-destinations"),
      destinationTabs: byId("taskboard-destination-tabs"),
      destinationOverflow: byId("taskboard-destination-overflow"),
      destinationOverflowCount: byId("taskboard-destination-overflow-count"),
      destinationOverflowSearch: byId("taskboard-destination-overflow-search"),
      destinationOverflowList: byId("taskboard-destination-overflow-list"),
      destination: byId("taskboard-destination"),
      destinationBody: byId("taskboard-destination-body"),
      projectSettings: byId("taskboard-project-settings"),
      runway: byId("taskboard-runway"),
      controls: byId("taskboard-controls"),
      filters: byId("taskboard-filters"),
      completion: byId("taskboard-completion"),
      runwaySummary: byId("taskboard-runway-summary"),
      runwayCounts: byId("taskboard-runway-counts"),
      search: byId("taskboard-search"),
      statusFilter: byId("taskboard-status-filter"),
      priorityFilter: byId("taskboard-priority-filter"),
      loading: byId("taskboard-loading"),
      error: byId("taskboard-error"),
      workspace: byId("taskboard-workspace"),
      dashboard: byId("taskboard-dashboard"),
      board: byId("taskboard-board"),
      list: byId("taskboard-list"),
      timeline: byId("taskboard-timeline"),
      dialog: byId("taskboard-task-dialog"),
      form: byId("taskboard-task-form"),
      dialogTitle: byId("taskboard-dialog-title"),
      taskTitle: byId("taskboard-task-title"),
      taskDescription: byId("taskboard-task-description"),
      taskStatus: byId("taskboard-task-status"),
      taskPriority: byId("taskboard-task-priority"),
      taskAssignee: byId("taskboard-task-assignee"),
      taskLabels: byId("taskboard-task-labels"),
      taskStartDate: byId("taskboard-task-start-date"),
      taskDueDate: byId("taskboard-task-due-date"),
      nextMessage: byId("taskboard-next-message"),
      nextMessageDraft: byId("taskboard-next-message-draft"),
      savedPrompt: byId("taskboard-saved-prompt"),
      addToQueue: byId("taskboard-add-to-queue"),
      queueTarget: byId("taskboard-queue-target"),
      managePrompts: byId("taskboard-manage-prompts"),
      taskBranch: byId("taskboard-task-branch"),
      taskWorktree: byId("taskboard-task-worktree"),
      taskThread: byId("taskboard-task-thread"),
      taskSessionState: byId("taskboard-session-state"),
      taskMarkUsageLimit: byId("taskboard-mark-usage-limit"),
      taskRelations: byId("taskboard-task-relations"),
      comments: byId("taskboard-comments"),
      commentList: byId("taskboard-comment-list"),
      commentText: byId("taskboard-comment-text"),
      commentSave: byId("taskboard-comment-save"),
      dialogStatus: byId("taskboard-dialog-status"),
      taskDelete: byId("taskboard-task-delete"),
      taskAccept: byId("taskboard-task-accept"),
      taskSave: byId("taskboard-task-save"),
    });

    if (Object.values(elements).some((element) => !element)) return null;

    const runwayBars = new Map(STATUS_IDS.map((status) => [
      status,
      section.querySelector(`[data-taskboard-runway="${status}"]`),
    ]));
    const viewTabs = [...section.querySelectorAll("[data-taskboard-view]")];
    const sideRoutes = [...rootDocument.querySelectorAll("[data-taskboard-destination]")];
    const localRoutes = [...section.querySelectorAll("[data-taskboard-local-route]")];
    const viewPanels = new Map(VIEW_IDS.map((view) => [
      view,
      section.querySelector(`[data-taskboard-panel="${view}"]`),
    ]));
    const statusKey = Object.freeze({
      todo: "taskStatusTodo",
      "in-progress": "taskStatusInProgress",
      "needs-input": "taskStatusNeedsInput",
      review: "taskStatusReview",
      blocked: "taskStatusBlocked",
      done: "taskStatusDone",
    });
    const priorityKey = Object.freeze({
      urgent: "taskPriorityUrgent",
      high: "taskPriorityHigh",
      normal: "taskPriorityNormal",
      low: "taskPriorityLow",
      none: "taskPriorityNone",
    });
    const activityKey = Object.freeze({
      created: "taskActivityCreated",
      updated: "taskActivityUpdated",
      "status-changed": "taskActivityStatusChanged",
      "session-state-changed": "taskActivitySessionStateChanged",
      commented: "taskActivityCommented",
      accepted: "taskActivityAccepted",
      deleted: "taskActivityDeleted",
      opened: "taskActivityOpened",
    });
    const intlLocale = locale === "zh-HKTW" ? "zh-Hant-TW"
      : locale === "zh-CN" ? "zh-Hans-CN" : locale || "en";
    const dateFormatter = new Intl.DateTimeFormat(intlLocale, {
      year: "numeric", month: "short", day: "numeric",
    });
    const timelineDateFormatter = new Intl.DateTimeFormat(intlLocale, {
      month: "short", day: "numeric",
    });
    const timeFormatter = new Intl.DateTimeFormat(intlLocale, {
      month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
    });

    let documentState = null;
    let session = "";
    let revision = -1;
    let commandEpoch = 0;
    let requested = false;
    let pending = null;
    let draftCreatePending = false;
    let activeView = "dashboard";
    let editingTaskId = null;
    let draggedTaskId = null;
    let draggedDestinationTabId = null;
    let queuedDestination = null;
    let destinationRevealPending = false;
    let destinationStripResizeObserver = null;
    let localSessionsState = Object.freeze({ schemaVersion: 1, available: false, sessions: [] });

    if (desktopSurface) {
      rootDocument.documentElement.dataset.taskboardSurface = "desktop";
      elements.closeDesktop.hidden = false;
    }

    const element = (tag, className = "", text = "") => {
      const node = rootDocument.createElement(tag);
      if (className) node.className = className;
      if (text !== "") node.textContent = text;
      return node;
    };
    const button = (className, text, taskId = "") => {
      const node = element("button", className, text);
      node.type = "button";
      if (taskId) node.dataset.taskId = taskId;
      return node;
    };
    const safeDate = (value) => {
      if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
      const date = new Date(`${value}T12:00:00`);
      return Number.isNaN(date.getTime()) ? null : date;
    };
    const formatDate = (value) => {
      const date = safeDate(value);
      return date ? dateFormatter.format(date) : t("taskboardNoDate");
    };
    const formatTime = (value) => {
      if (!Number.isSafeInteger(value) || value < 0) return "";
      return timeFormatter.format(new Date(value));
    };
    const taskKey = (task) => `${documentState?.project?.keyPrefix || "AURA"}-${task.number}`;
    const taskById = (id) => documentState?.tasks.find((task) => task.id === id) ?? null;
    const taskForDestination = (destinationId) => (
      typeof destinationId === "string" && destinationId.startsWith("task:")
        ? taskById(destinationId.slice(5)) : null
    );
    const activeDestinationTab = () => documentState?.navigation.tabs.find(
      (tab) => tab.id === documentState.navigation.activeTabId,
    ) ?? null;
    const destinationTitle = (tab) => {
      if (tab.destinationType === "work-hub") return t("navWorkHub");
      if (tab.destinationType === "attention") return t("taskboardAttentionTitle");
      if (tab.destinationType === "recent") return t("navRecent");
      if (tab.destinationType === "action-queue") return t("navActionQueue");
      if (tab.destinationType === "projects") return t("navProjects");
      if (tab.destinationType === "project"
          && tab.destinationId === `project:${documentState.project.id}`) return documentState.project.name;
      return taskForDestination(tab.destinationId)?.title ?? tab.safeTitle;
    };
    const destinationAvailable = (tab) => {
      if (["work-hub", "attention", "recent", "action-queue", "projects"]
        .includes(tab.destinationType)) return true;
      if (tab.destinationType === "project") {
        return tab.destinationId === `project:${documentState.project.id}`;
      }
      if (tab.destinationType === "task") return taskForDestination(tab.destinationId) !== null;
      return tab.destinationType === "studio-page"
        && typeof openStudioView === "function"
        && /^studio:(tasks|themes|pets|background|create|settings)$/u.test(tab.destinationId);
    };
    const openStudioDestination = (tab) => (
      destinationAvailable(tab) && tab.destinationType === "studio-page"
        ? openStudioView(tab.destinationId.slice(7)) : false
    );
    const destinationVisibleTitle = (tab) => {
      const title = destinationTitle(tab);
      const matchingTabs = documentState.navigation.tabs.filter(
        (candidate) => candidate.destinationId === tab.destinationId,
      );
      const duplicateIndex = matchingTabs.findIndex((candidate) => candidate.id === tab.id);
      return matchingTabs.length > 1 ? `${title} · ${duplicateIndex + 1}` : title;
    };
    const statusLabel = (status) => t(statusKey[status] ?? "taskStatusTodo");
    const priorityLabel = (priority) => t(priorityKey[priority] ?? "taskPriorityNone");
    const sessionCopy = (task) => {
      const presentation = sessionPresentation(task);
      if (!presentation) return null;
      return Object.freeze({
        ...presentation,
        label: t(presentation.labelKey),
        evidence: t(presentation.evidenceKey),
      });
    };
    const revealActiveDestinationTab = () => {
      destinationRevealPending = false;
      const strip = elements.destinationTabs.parentElement;
      const active = elements.destinationTabs.querySelector('[aria-selected="true"]')
        ?.closest(".taskboard-destination-tab");
      if (!strip || !active || strip.clientWidth <= 0) return;
      const target = destinationScrollTarget(
        strip.scrollLeft,
        strip.clientWidth,
        active.offsetLeft,
        active.offsetWidth,
      );
      if (Math.abs(target - strip.scrollLeft) > 0.5) strip.scrollLeft = target;
    };
    const scheduleActiveDestinationReveal = () => {
      if (destinationRevealPending) return;
      destinationRevealPending = true;
      const requestFrame = rootDocument.defaultView?.requestAnimationFrame;
      if (typeof requestFrame === "function") requestFrame.call(rootDocument.defaultView, revealActiveDestinationTab);
      else revealActiveDestinationTab();
    };
    rootDocument.defaultView?.addEventListener?.("resize", scheduleActiveDestinationReveal);
    const ResizeObserverType = rootDocument.defaultView?.ResizeObserver;
    if (typeof ResizeObserverType === "function") {
      destinationStripResizeObserver = new ResizeObserverType(scheduleActiveDestinationReveal);
      destinationStripResizeObserver.observe(elements.destinationTabs.parentElement);
    }

    const setStatus = (text, tone = "") => {
      elements.status.textContent = text;
      elements.status.dataset.tone = tone;
    };
    const setDialogStatus = (text, tone = "") => {
      elements.dialogStatus.textContent = text;
      elements.dialogStatus.dataset.tone = tone;
    };
    const setBusy = (busy) => {
      section.setAttribute("aria-busy", String(busy));
      for (const control of [
        elements.refresh, elements.create, elements.projectSave,
        elements.taskSave, elements.taskDelete, elements.taskAccept,
        elements.commentSave, elements.addToQueue,
      ]) control.disabled = busy;
      for (const control of [
        ...elements.destinationTabs.querySelectorAll("button"),
        ...elements.destinationOverflowList.querySelectorAll("button"),
        ...elements.destination.querySelectorAll("button"),
      ]) control.disabled = busy;
      elements.destinationOverflowSearch.disabled = busy;
      for (const tab of elements.destinationTabs.querySelectorAll(".taskboard-destination-tab")) {
        tab.draggable = !busy;
      }
    };
    const showLoadFailure = () => {
      documentState = null;
      elements.loading.hidden = true;
      elements.destinations.hidden = true;
      elements.controls.hidden = true;
      elements.runway.hidden = true;
      elements.destination.hidden = true;
      elements.workspace.hidden = true;
      elements.error.hidden = false;
    };

    const newRequestId = () => {
      const value = globalThis.crypto?.randomUUID?.().toLowerCase();
      return typeof value === "string" && uuidPattern.test(value) ? value : null;
    };

    const normalizeTask = (task) => {
      if (!exactKeys(task, [
        "id", "number", "version", "title", "description", "status", "priority",
        "labels", "assignee", "startDate", "dueDate", "relationIds", "comments",
        "branch", "worktree", "providerThreadId", "sessionState",
        "sessionTerminationReason", "sessionEvidence", "sessionUpdatedAt",
        "createdAt", "updatedAt", "acceptedAt",
      ])) return null;
      const hasLinkedSession = boundedString(task.providerThreadId, 160, false);
      if (!uuidPattern.test(task.id)
          || !Number.isSafeInteger(task.number) || task.number < 1
          || !Number.isSafeInteger(task.version) || task.version < 1
          || !boundedString(task.title, 160, false)
          || !boundedString(task.description, 4000)
          || !STATUS_IDS.includes(task.status)
          || !PRIORITY_IDS.includes(task.priority)
          || !Array.isArray(task.labels) || task.labels.length > 8
          || task.labels.some((label) => !boundedString(label, 32, false))
          || !boundedString(task.assignee, 80)
          || !(task.startDate === null || safeDate(task.startDate))
          || !(task.dueDate === null || safeDate(task.dueDate))
          || !Array.isArray(task.relationIds) || task.relationIds.length > 16
          || task.relationIds.some((id) => typeof id !== "string" || !uuidPattern.test(id))
          || !Array.isArray(task.comments) || task.comments.length > 100
          || !boundedString(task.branch, 160)
          || !boundedString(task.worktree, 520)
          || !boundedString(task.providerThreadId, 160)
          || !SESSION_STATES.includes(task.sessionState)
          || (hasLinkedSession && task.sessionState === "unlinked")
          || (!hasLinkedSession && (task.sessionState !== "unlinked"
            || task.sessionTerminationReason !== null
            || task.sessionEvidence !== null || task.sessionUpdatedAt !== null))
          || (task.sessionState === "terminated"
            ? task.sessionTerminationReason !== "usage-limit"
            : task.sessionTerminationReason !== null)
          || (hasLinkedSession && (!SESSION_EVIDENCE.includes(task.sessionEvidence)
            || !Number.isSafeInteger(task.sessionUpdatedAt)
            || task.sessionUpdatedAt < task.createdAt))
          || !Number.isSafeInteger(task.createdAt) || task.createdAt < 0
          || !Number.isSafeInteger(task.updatedAt) || task.updatedAt < task.createdAt
          || !(task.acceptedAt === null
            || (Number.isSafeInteger(task.acceptedAt) && task.acceptedAt >= task.createdAt))) return null;
      const comments = task.comments.map((comment) => {
        if (!exactKeys(comment, ["id", "body", "createdAt"])
            || !uuidPattern.test(comment.id)
            || !boundedString(comment.body, 2000, false)
            || !Number.isSafeInteger(comment.createdAt) || comment.createdAt < task.createdAt) return null;
        return { ...comment };
      });
      if (comments.some((comment) => comment === null)) return null;
      return { ...task, labels: [...task.labels], relationIds: [...task.relationIds], comments };
    };

    const destinationIdMatches = (id, type) => {
      if (typeof id !== "string") return false;
      if (type === "work-hub") return id === "work-hub";
      if (["attention", "recent", "action-queue", "projects"].includes(type)) return id === type;
      if (type === "project" || type === "task") {
        const prefix = type === "project" ? "project:" : "task:";
        return id.startsWith(prefix) && uuidPattern.test(id.slice(prefix.length));
      }
      return type === "studio-page"
        && /^studio:(tasks|themes|pets|background|create|settings)$/u.test(id);
    };

    const normalizeNavigation = (navigation) => {
      if (!exactKeys(navigation, ["tabs", "activeTabId"])
          || !Array.isArray(navigation.tabs)
          || navigation.tabs.length > 20) return null;
      const ids = new Set();
      const tabs = navigation.tabs.map((tab) => {
        if (!exactKeys(tab, ["id", "destinationId", "destinationType", "safeTitle"])
            || !uuidPattern.test(tab.id) || ids.has(tab.id)
            || !DESTINATION_TYPES.includes(tab.destinationType)
            || !destinationIdMatches(tab.destinationId, tab.destinationType)
            || !boundedString(tab.safeTitle, 160, false)) return null;
        ids.add(tab.id);
        return { ...tab };
      });
      if (tabs.some((tab) => tab === null)) return null;
      if (navigation.activeTabId !== null
          && (typeof navigation.activeTabId !== "string"
            || !ids.has(navigation.activeTabId))) return null;
      return { tabs, activeTabId: navigation.activeTabId };
    };

    const normalizeDocument = (value) => {
      if (!exactKeys(value, [
        "schemaVersion", "revision", "nextTaskNumber", "project", "tasks", "activity", "navigation", "queue", "receipts",
      ]) || value.schemaVersion !== 6
          || !Number.isSafeInteger(value.revision) || value.revision < 0
          || !Number.isSafeInteger(value.nextTaskNumber) || value.nextTaskNumber < 1
          || !exactKeys(value.project, ["id", "name", "keyPrefix", "createdAt", "updatedAt"])
          || !uuidPattern.test(value.project.id)
          || !boundedString(value.project.name, 80, false)
          || typeof value.project.keyPrefix !== "string"
          || !/^[A-Z][A-Z0-9]{1,7}$/.test(value.project.keyPrefix)
          || !Number.isSafeInteger(value.project.createdAt) || value.project.createdAt < 0
          || !Number.isSafeInteger(value.project.updatedAt)
          || value.project.updatedAt < value.project.createdAt
          || !Array.isArray(value.tasks) || value.tasks.length > 1000
          || !Array.isArray(value.activity) || value.activity.length > 2000) return null;
      const tasks = value.tasks.map(normalizeTask);
      if (tasks.some((task) => task === null)) return null;
      const ids = new Set(tasks.map((task) => task.id));
      const numbers = new Set(tasks.map((task) => task.number));
      if (ids.size !== tasks.length || numbers.size !== tasks.length) return null;
      const activity = value.activity.map((item) => {
        const transitionValues = item?.kind === "session-state-changed" ? SESSION_STATES : STATUS_IDS;
        if (!exactKeys(item, ["id", "taskId", "kind", "at", "from", "to", "evidence"])
            || !uuidPattern.test(item.id)
            || !(item.taskId === null || uuidPattern.test(item.taskId))
            || !ACTIVITY_IDS.includes(item.kind)
            || !Number.isSafeInteger(item.at) || item.at < 0
            || !(item.from === null || transitionValues.includes(item.from))
            || !(item.to === null || transitionValues.includes(item.to))
            || !["local", "provider-observed", "user-reported", "user-accepted"].includes(item.evidence)) return null;
        return { ...item };
      });
      if (activity.some((item) => item === null)) return null;
      const navigation = normalizeNavigation(value.navigation);
      if (!navigation) return null;
      const queue = normalizeQueue(value.queue);
      if (!queue) return null;
      const receipts = normalizeQueueReceipts(
        value.receipts, new Set(queue.map((item) => item.commandId)),
      );
      if (!receipts) return null;
      return {
        ...value,
        project: { ...value.project },
        tasks,
        activity,
        navigation,
        queue,
        receipts,
      };
    };

    const filteredTasks = () => {
      if (!documentState) return [];
      const query = elements.search.value.trim().toLocaleLowerCase(intlLocale);
      const status = elements.statusFilter.value;
      const priority = elements.priorityFilter.value;
      return documentState.tasks.filter((task) => {
        if (status !== "all" && task.status !== status) return false;
        if (priority !== "all" && task.priority !== priority) return false;
        if (!query) return true;
        return [
          taskKey(task), task.title, task.description, task.assignee,
          task.branch, task.worktree, task.providerThreadId, ...task.labels,
        ].some((value) => String(value).toLocaleLowerCase(intlLocale).includes(query));
      });
    };

    const emptyState = (titleKey, bodyKey, withAction = false) => {
      const empty = element("div", "taskboard-empty");
      empty.append(element("strong", "", t(titleKey)), element("p", "", t(bodyKey)));
      if (withAction) {
        const action = button("primary-button", t("taskboardNew"));
        action.addEventListener("click", () => editTask(null));
        empty.append(action);
      }
      return empty;
    };

    const countsByStatus = () => Object.fromEntries(STATUS_IDS.map((status) => [
      status,
      documentState.tasks.filter((task) => task.status === status).length,
    ]));

    const attentionTasks = () => {
      const rank = { blocked: 0, "needs-input": 1, review: 2 };
      return documentState.tasks
        .filter((task) => ATTENTION_STATUS_IDS.includes(task.status))
        .sort((left, right) => rank[left.status] - rank[right.status]
          || right.updatedAt - left.updatedAt);
    };

    const recentTaskEntries = () => {
      const entries = [];
      const seen = new Set();
      for (let index = documentState.activity.length - 1; index >= 0; index -= 1) {
        const item = documentState.activity[index];
        if (item.kind !== "opened" || seen.has(item.taskId)) continue;
        const task = taskById(item.taskId);
        if (!task) continue;
        seen.add(task.id);
        entries.push({ task, openedAt: item.at });
      }
      return entries;
    };

    const activeQueueItems = () => documentState.queue
      .filter((item) => !["sent", "completed", "failed", "cancelled"].includes(item.status))
      .sort((left, right) => left.position - right.position
        || right.priority - left.priority || left.createdAt - right.createdAt);

    const savedPrompts = () => {
      let values = [];
      try { values = getSavedPrompts(); } catch { return []; }
      if (!Array.isArray(values)) return [];
      return values.filter((item) => item && typeof item === "object"
        && draftIdPattern.test(item.id) && boundedString(item.text, 8000, false)
        && (item.fingerprint === null || draftFingerprintPattern.test(item.fingerprint)));
    };

    const currentTarget = () => {
      let value = null;
      try { value = getCurrentTarget(); } catch { return { id: null, insertionAvailable: false }; }
      return {
        id: localTargetPattern.test(value?.id ?? "") ? value.id : null,
        insertionAvailable: value?.insertionAvailable === true,
      };
    };

    const promptLabel = (prompt, fallback) => {
      if (!prompt) return fallback;
      const firstLine = prompt.text.split(/\r?\n/u).map((line) => line.trim()).find(Boolean) ?? "";
      return firstLine.length > 72 ? `${firstLine.slice(0, 69)}...` : firstLine || fallback;
    };

    const queueStatusLabel = (item) => {
      if (item.status === "awaiting_user_action") return t("taskboardQueueAwaitingUser");
      if (item.status === "uncertain") return t("taskboardQueueUncertain");
      return t("taskboardQueueQueued");
    };

    const renderQueueRows = (items) => {
      try {
        if (savedPromptsLoaded() !== true) ensureSavedPrompts();
      } catch {}
      const list = element("ol", "taskboard-queue-list");
      const prompts = savedPrompts();
      const target = currentTarget();
      const headByTarget = new Map();
      for (const item of items) {
        if (!headByTarget.has(item.localTargetId)) headByTarget.set(item.localTargetId, item.commandId);
      }
      let displayIndex = 0;
      for (const item of items) {
        displayIndex += 1;
        const prompt = prompts.find((candidate) => candidate.id === item.draftId) ?? null;
        const task = taskById(item.taskId);
        const row = element("li", "taskboard-queue-row");
        row.dataset.queueStatus = item.status;
        const order = element("span", "taskboard-queue-order", String(displayIndex).padStart(2, "0"));
        order.setAttribute("aria-hidden", "true");
        const copy = element("span", "taskboard-queue-copy");
        copy.append(
          element("strong", "", promptLabel(prompt, t("taskboardQueuePromptMissing"))),
          element("small", "", task ? `${taskKey(task)} - ${task.title}` : t("taskboardRemovedTask")),
          element("span", "taskboard-queue-state", queueStatusLabel(item)),
        );
        const actions = element("span", "taskboard-queue-actions");
        const targetMatches = target.id === item.localTargetId;
        const isHead = headByTarget.get(item.localTargetId) === item.commandId;
        const fingerprintMatches = prompt?.fingerprint === item.draftFingerprint;
        const presentation = queueRowPresentation({
          status: item.status,
          promptAvailable: prompt !== null,
          fingerprintMatches,
          insertionAvailable: target.insertionAvailable,
          targetMatches,
          isHead,
        });
        if (presentation.kind === "place") {
          const place = button("primary-button", t("taskboardPlaceInComposer"));
          place.addEventListener("click", () => {
            if (!insertSavedPrompt(item.draftId, item.commandId, item.draftFingerprint)) {
              setStatus(t("taskboardSaveFailed"), "error");
            }
          });
          actions.append(place);
        }
        if (["queued", "uncertain"].includes(item.status)) {
          const remove = button("ghost-button", t("taskboardQueueRemove"));
          remove.addEventListener("click", () => {
            mutate("queue-resolve", { commandId: item.commandId, outcome: "cancelled" });
          });
          actions.append(remove);
        } else if (presentation.kind === "sent-next") {
          const sent = button("primary-button", t("taskboardQueueSentNext"));
          sent.addEventListener("click", () => {
            mutate("queue-resolve", { commandId: item.commandId, outcome: "sent" });
          });
          actions.append(sent);
        }
        const helpKey = presentation.reason ?? (item.status === "awaiting_user_action"
          ? "taskboardQueueInsertedHelp"
          : item.status === "uncertain" ? "taskboardQueueUncertainHelp" : null);
        if (helpKey) actions.append(element("small", "taskboard-queue-help", t(helpKey)));
        row.append(order, copy, actions);
        list.append(row);
      }
      return list;
    };

    const renderActionQueue = () => {
      const items = activeQueueItems();
      const body = element("article", "taskboard-collection-destination taskboard-action-queue");
      const head = element("header", "taskboard-task-destination-head");
      const heading = element("div");
      heading.append(
        element("p", "kicker", t("navActionQueue")),
        element("h2", "", t("taskboardActionQueueTitle")),
        element("p", "help", replace(t("taskboardQueueCount"), [items.length])),
      );
      head.append(heading);
      body.append(head);
      if (!items.length) body.append(element("p", "taskboard-collection-empty", t("taskboardActionQueueEmpty")));
      else body.append(renderQueueRows(items));
      elements.destinationBody.append(body);
    };

    const renderRunway = () => {
      const counts = countsByStatus();
      const total = documentState.tasks.length;
      const completion = total ? Math.round((counts.done / total) * 100) : 0;
      elements.completion.textContent = `${completion}%`;
      elements.completion.setAttribute("aria-label", replace(t("taskboardCompletionLabel"), [completion]));
      const summaryKey = counts.blocked ? "taskboardRunwayBlocked"
        : counts["needs-input"] ? "taskboardRunwayNeedsInput"
          : counts.review ? "taskboardRunwayReview"
          : counts["in-progress"] ? "taskboardRunwayActive"
            : total ? "taskboardRunwayClear" : "taskboardRunwayEmpty";
      const summaryCount = counts.blocked || counts["needs-input"]
        || counts.review || counts["in-progress"] || total;
      elements.runwaySummary.textContent = replace(t(summaryKey), [summaryCount]);
      for (const status of STATUS_IDS) {
        const bar = runwayBars.get(status);
        if (bar) bar.style.width = total ? `${(counts[status] / total) * 100}%` : "0%";
      }
      elements.runwayCounts.replaceChildren();
      for (const status of STATUS_IDS) {
        const count = button("taskboard-runway-count");
        count.dataset.status = status;
        count.append(element("span", "", statusLabel(status)), element("strong", "", String(counts[status])));
        count.addEventListener("click", () => {
          elements.statusFilter.value = status;
          setActiveView(status === "done" ? "list" : "board");
          render();
        });
        elements.runwayCounts.append(count);
      }
    };

    const taskMeta = (task) => {
      const values = [];
      if (task.assignee) values.push(task.assignee);
      if (task.dueDate) values.push(replace(t("taskboardDueShort"), [formatDate(task.dueDate)]));
      if (task.comments.length) values.push(replace(t("taskboardCommentCount"), [task.comments.length]));
      return values.join(" · ") || t("taskboardLocalOnly");
    };

    const createTaskCard = (task) => {
      const card = button("taskboard-card", "", task.id);
      card.draggable = task.status !== "done";
      card.setAttribute("aria-grabbed", "false");
      const top = element("span", "taskboard-card-top");
      top.append(
        element("span", "taskboard-card-key", taskKey(task)),
        element("span", "taskboard-card-priority", priorityLabel(task.priority)),
      );
      top.lastElementChild.dataset.priority = task.priority;
      card.append(top, element("span", "taskboard-card-title", task.title));
      if (task.labels.length) {
        const labels = element("span", "taskboard-card-labels");
        for (const label of task.labels.slice(0, 3)) labels.append(element("span", "", label));
        card.append(labels);
      }
      const foot = element("span", "taskboard-card-foot");
      const evidence = element("span", "taskboard-evidence", task.status === "done"
        ? t("taskboardAcceptedEvidence") : t("taskboardLocalEvidence"));
      evidence.dataset.evidence = task.status === "done" ? "accepted" : "local";
      foot.append(evidence);
      const linkedSession = sessionCopy(task);
      if (linkedSession) {
        const badge = element("span", "taskboard-session-badge", linkedSession.label);
        badge.dataset.sessionState = linkedSession.state;
        foot.append(badge);
      }
      foot.append(element("span", "", taskMeta(task)));
      card.append(foot);
      card.addEventListener("click", () => openTask(task.id));
      card.addEventListener("dragstart", (event) => {
        draggedTaskId = task.id;
        card.setAttribute("aria-grabbed", "true");
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", task.id);
      });
      card.addEventListener("dragend", () => {
        draggedTaskId = null;
        card.setAttribute("aria-grabbed", "false");
      });
      return card;
    };

    const renderLocalSessions = () => {
      const panel = element("article", "taskboard-panel taskboard-sessions-panel");
      const sessions = localSessionsState.sessions.slice(0, 12);
      const head = element("div", "taskboard-panel-head");
      head.append(
        element("h2", "", `Codex \u00B7 ${t("navRecent")}`),
        element("span", "", String(sessions.length)),
      );
      panel.append(head);
      if (!sessions.length) {
        panel.append(element("p", "help", t("taskboardRecentEmpty")));
        return panel;
      }
      const list = element("ol", "taskboard-panel-list taskboard-session-list");
      for (const sessionItem of sessions) {
        const linkedTask = documentState.tasks.find(
          (task) => task.providerThreadId === sessionItem.id,
        ) ?? null;
        const item = element("li");
        const metadata = [
          sessionItem.id.slice(0, 8),
          sessionItem.workspace,
          sessionItem.branch,
          formatTime(sessionItem.updatedAt),
        ].filter(Boolean).join(" \u00B7 ");
        if (linkedTask) {
          const open = button("", sessionItem.title, linkedTask.id);
          open.dataset.sessionLinked = "true";
          open.append(element("small", "", `${taskKey(linkedTask)} \u00B7 ${metadata}`));
          open.addEventListener("click", () => openTask(linkedTask.id));
          item.append(open);
        } else {
          const row = element("div", "taskboard-session-readonly");
          row.append(
            element("span", "taskboard-session-title", sessionItem.title),
            element("small", "", metadata),
          );
          item.append(row);
        }
        list.append(item);
      }
      panel.append(list);
      return panel;
    };

    const renderDashboard = (tasks) => {
      elements.dashboard.replaceChildren();
      if (!documentState.tasks.length) {
        const grid = element("div", "taskboard-dashboard-grid");
        grid.append(renderLocalSessions());
        elements.dashboard.append(grid, emptyState("taskboardEmptyTitle", "taskboardEmptyBody", true));
        return;
      }
      const counts = countsByStatus();
      const grid = element("div", "taskboard-dashboard-grid");

      const queuedItems = activeQueueItems().slice(0, 6);
      const queue = element("article", "taskboard-panel taskboard-queue-panel");
      const queueHead = element("div", "taskboard-panel-head");
      queueHead.append(
        element("h2", "", t("taskboardActionQueueTitle")),
        element("span", "", replace(t("taskboardQueueCount"), [activeQueueItems().length])),
      );
      queue.append(queueHead);
      if (!queuedItems.length) queue.append(element("p", "help", t("taskboardActionQueueEmpty")));
      else queue.append(renderQueueRows(queuedItems));
      grid.append(queue);

      grid.append(renderLocalSessions());

      const attentionTasksForHub = attentionTasks().slice(0, 6);
      const attention = element("article", "taskboard-panel is-wide");
      const attentionHead = element("div", "taskboard-panel-head");
      attentionHead.append(element("h2", "", t("taskboardAttentionTitle")), element("span", "", String(attentionTasksForHub.length)));
      attention.append(attentionHead);
      if (!attentionTasksForHub.length) attention.append(element("p", "help", t("taskboardAttentionEmpty")));
      else {
        const list = element("ol", "taskboard-panel-list");
        for (const task of attentionTasksForHub) {
          const item = element("li");
          const open = button("", task.title, task.id);
          open.dataset.status = task.status;
          open.append(element("small", "", `${taskKey(task)} · ${statusLabel(task.status)}`));
          open.addEventListener("click", () => openTask(task.id));
          item.append(open);
          list.append(item);
        }
        attention.append(list);
      }
      grid.append(attention);

      const recentTasks = recentTaskEntries().slice(0, 6);
      const recent = element("article", "taskboard-panel is-narrow");
      const recentHead = element("div", "taskboard-panel-head");
      recentHead.append(element("h2", "", t("taskboardRecentTitle")), element("span", "", String(recentTasks.length)));
      recent.append(recentHead);
      if (!recentTasks.length) recent.append(element("p", "help", t("taskboardRecentEmpty")));
      else {
        const list = element("ol", "taskboard-panel-list");
        for (const { task, openedAt } of recentTasks) {
          const item = element("li");
          const open = button("", task.title, task.id);
          open.dataset.status = task.status;
          open.append(element("small", "", `${taskKey(task)} · ${formatTime(openedAt)}`));
          open.addEventListener("click", () => openTask(task.id));
          item.append(open);
          list.append(item);
        }
        recent.append(list);
      }
      grid.append(recent);

      for (const [labelKey, value] of [
        ["taskboardMetricOpen", documentState.tasks.length - counts.done],
        ["taskboardMetricActive", counts["in-progress"]],
        ["taskboardMetricReview", counts.review],
        ["taskboardMetricBlocked", counts.blocked],
      ]) {
        const metric = element("article", "taskboard-metric");
        metric.append(element("span", "", t(labelKey)), element("strong", "", String(value)));
        grid.append(metric);
      }

      const priority = element("article", "taskboard-panel is-narrow");
      const priorityHead = element("div", "taskboard-panel-head");
      priorityHead.append(element("h2", "", t("taskboardPriorityTitle")), element("span", "", String(tasks.length)));
      priority.append(priorityHead);
      const priorityBars = element("div", "taskboard-priority-bars");
      const maximumPriority = Math.max(1, ...PRIORITY_IDS.map((id) => tasks.filter((task) => task.priority === id).length));
      for (const id of PRIORITY_IDS) {
        const count = tasks.filter((task) => task.priority === id).length;
        const row = element("div", "taskboard-priority-row");
        row.dataset.priority = id;
        const track = element("span", "taskboard-priority-track");
        const fill = element("i");
        fill.style.width = `${(count / maximumPriority) * 100}%`;
        track.append(fill);
        row.append(element("span", "", priorityLabel(id)), track, element("span", "", String(count)));
        priorityBars.append(row);
      }
      priority.append(priorityBars);
      grid.append(priority);

      const running = element("article", "taskboard-panel");
      const runningTasks = documentState.tasks.filter((task) => task.status === "in-progress").slice(0, 6);
      const runningHead = element("div", "taskboard-panel-head");
      runningHead.append(element("h2", "", t("taskboardRunningTitle")), element("span", "", String(runningTasks.length)));
      running.append(runningHead);
      if (!runningTasks.length) running.append(element("p", "help", t("taskboardRunningEmpty")));
      else {
        const list = element("ol", "taskboard-panel-list");
        for (const task of runningTasks) {
          const item = element("li");
          const open = button("", task.title, task.id);
          open.dataset.status = task.status;
          open.append(element("small", "", `${taskKey(task)} · ${taskMeta(task)}`));
          open.addEventListener("click", () => openTask(task.id));
          item.append(open);
          list.append(item);
        }
        running.append(list);
      }
      grid.append(running);

      const contribution = element("article", "taskboard-panel");
      const contributionHead = element("div", "taskboard-panel-head");
      contributionHead.append(element("h2", "", t("taskboardContributionTitle")), element("span", "", t("taskboardLast14Days")));
      contribution.append(contributionHead);
      const heatmap = element("div", "taskboard-contribution");
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      start.setDate(start.getDate() - 13);
      for (let index = 0; index < 14; index += 1) {
        const dayStart = start.getTime() + index * 86400000;
        const count = documentState.activity.filter((item) => item.at >= dayStart && item.at < dayStart + 86400000).length;
        const cell = element("span");
        cell.dataset.level = String(Math.min(4, count));
        cell.title = replace(t("taskboardContributionDay"), [dateFormatter.format(new Date(dayStart)), count]);
        heatmap.append(cell);
      }
      contribution.append(heatmap);
      grid.append(contribution);

      const activity = element("article", "taskboard-panel is-wide");
      const activityHead = element("div", "taskboard-panel-head");
      activityHead.append(element("h2", "", t("taskboardActivityTitle")), element("span", "", t("taskboardLocalHistory")));
      activity.append(activityHead);
      const activityList = element("ol", "taskboard-activity-list");
      for (const item of [...documentState.activity]
        .filter((entry) => entry.kind !== "opened")
        .sort((left, right) => right.at - left.at)
        .slice(0, 8)) {
        const row = element("li");
        row.dataset.evidence = item.evidence;
        const task = taskById(item.taskId);
        const copy = replace(t(activityKey[item.kind]), [task ? taskKey(task) : t("taskboardRemovedTask")]);
        row.append(element("span", "", copy), element("small", "", formatTime(item.at)));
        activityList.append(row);
      }
      if (!activityList.childElementCount) activity.append(element("p", "help", t("taskboardActivityEmpty")));
      else activity.append(activityList);
      grid.append(activity);

      const labels = element("article", "taskboard-panel is-narrow");
      const labelCounts = new Map();
      for (const task of documentState.tasks) for (const label of task.labels) labelCounts.set(label, (labelCounts.get(label) ?? 0) + 1);
      const labelsHead = element("div", "taskboard-panel-head");
      labelsHead.append(element("h2", "", t("taskboardLabelsTitle")), element("span", "", String(labelCounts.size)));
      labels.append(labelsHead);
      if (!labelCounts.size) labels.append(element("p", "help", t("taskboardLabelsEmpty")));
      else {
        const list = element("ul", "taskboard-label-list");
        for (const [label, count] of [...labelCounts].sort((left, right) => right[1] - left[1]).slice(0, 10)) {
          const item = element("li");
          item.append(element("span", "", label), element("strong", "", String(count)));
          list.append(item);
        }
        labels.append(list);
      }
      grid.append(labels);
      elements.dashboard.append(grid);
    };

    const renderBoard = (tasks) => {
      elements.board.replaceChildren();
      if (!tasks.length) {
        elements.board.append(emptyState("taskboardFilteredEmptyTitle", "taskboardFilteredEmptyBody"));
        return;
      }
      const grid = element("div", "taskboard-board-grid");
      for (const status of BOARD_STATUS_IDS) {
        const lane = element("section", "taskboard-lane");
        lane.dataset.status = status;
        const laneTasks = tasks.filter((task) => task.status === status)
          .sort((left, right) => PRIORITY_IDS.indexOf(left.priority) - PRIORITY_IDS.indexOf(right.priority)
            || left.createdAt - right.createdAt);
        const head = element("header", "taskboard-lane-head");
        head.append(element("h2", "", statusLabel(status)), element("output", "", String(laneTasks.length)));
        const list = element("div", "taskboard-card-list");
        list.dataset.status = status;
        for (const task of laneTasks) list.append(createTaskCard(task));
        if (status !== "done") {
          list.addEventListener("dragover", (event) => {
            event.preventDefault();
            event.dataTransfer.dropEffect = "move";
            list.classList.add("is-drop-target");
          });
          list.addEventListener("dragleave", () => list.classList.remove("is-drop-target"));
          list.addEventListener("drop", (event) => {
            event.preventDefault();
            list.classList.remove("is-drop-target");
            const id = event.dataTransfer.getData("text/plain") || draggedTaskId;
            const task = taskById(id);
            if (task && task.status !== status) {
              mutate("update-task", { id: task.id, taskVersion: task.version, patch: { status } }, { announce: true });
            }
          });
        }
        lane.append(head, list);
        grid.append(lane);
      }
      elements.board.append(grid);
    };

    const renderList = (tasks) => {
      elements.list.replaceChildren();
      if (!tasks.length) {
        elements.list.append(emptyState("taskboardFilteredEmptyTitle", "taskboardFilteredEmptyBody"));
        return;
      }
      const wrap = element("div", "taskboard-table-wrap");
      const table = element("table", "taskboard-table");
      const head = element("thead");
      const headRow = element("tr");
      for (const key of [
        "taskboardColumnTask", "taskboardColumnStatus", "taskboardColumnPriority",
        "taskboardColumnAssignee", "taskboardColumnDue", "taskboardColumnEvidence",
      ]) headRow.append(element("th", "", t(key)));
      head.append(headRow);
      const body = element("tbody");
      for (const task of tasks) {
        const row = element("tr");
        row.tabIndex = 0;
        row.dataset.taskId = task.id;
        const taskCell = element("td");
        taskCell.append(element("strong", "", task.title), element("div", "taskboard-card-key", taskKey(task)));
        row.append(
          taskCell,
          element("td", "", statusLabel(task.status)),
          element("td", "", priorityLabel(task.priority)),
          element("td", "", task.assignee || "—"),
          element("td", "", formatDate(task.dueDate)),
          element("td", "", task.status === "done" ? t("taskboardAcceptedEvidence") : t("taskboardLocalEvidence")),
        );
        row.addEventListener("click", () => openTask(task.id));
        row.addEventListener("keydown", (event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            openTask(task.id);
          }
        });
        body.append(row);
      }
      table.append(head, body);
      wrap.append(table);
      elements.list.append(wrap);
    };

    const renderTimeline = (tasks) => {
      elements.timeline.replaceChildren();
      const scale = buildTimelineScale(tasks);
      if (!scale.ranges.length) {
        elements.timeline.append(emptyState("taskboardTimelineEmptyTitle", "taskboardTimelineEmptyBody"));
        return;
      }
      const grid = element("div", "taskboard-timeline-grid");
      grid.style.setProperty(
        "--taskboard-timeline-step",
        `${100 / Math.max(1, scale.tickDates.length - 1)}%`,
      );
      const corner = element("div", "taskboard-timeline-corner", t("taskboardColumnTask"));
      const axis = element("div", "taskboard-timeline-axis");
      scale.tickDates.forEach((dateValue, index) => {
        const tick = element("time", "", timelineDateFormatter.format(safeDate(dateValue)));
        tick.dateTime = dateValue;
        tick.style.left = `${(index / Math.max(1, scale.tickDates.length - 1)) * 100}%`;
        if (index === 0) tick.dataset.edge = "start";
        if (index === scale.tickDates.length - 1) tick.dataset.edge = "end";
        axis.append(tick);
      });
      grid.append(corner, axis);
      for (const range of [...scale.ranges].sort((left, right) => left.start - right.start)) {
        const { task } = range;
        const label = element("div", "taskboard-timeline-label");
        const open = button("", task.title, task.id);
        open.addEventListener("click", () => openTask(task.id));
        label.append(open, element("small", "", taskKey(task)));
        const track = element("div", "taskboard-timeline-track");
        const bar = element("div", "taskboard-timeline-bar", task.title);
        bar.style.left = `${range.left}%`;
        bar.style.width = `${range.width}%`;
        bar.title = `${formatDate(task.startDate || task.dueDate)} – ${formatDate(task.dueDate || task.startDate)}`;
        track.append(bar);
        grid.append(label, track);
      }
      elements.timeline.append(grid);
    };

    const renderDestinationTabs = () => {
      elements.destinationTabs.replaceChildren();
      elements.destinations.hidden = false;

      const pinnedTab = element("div", "taskboard-destination-tab is-pinned");
      pinnedTab.dataset.destinationType = "work-hub";
      pinnedTab.dataset.pinned = "true";
      pinnedTab.draggable = false;
      const pinnedSelect = button("taskboard-destination-select", t("navWorkHub"));
      pinnedSelect.id = "taskboard-tab-work-hub";
      pinnedSelect.setAttribute("data-pinned-work-hub", "");
      pinnedSelect.setAttribute("role", "tab");
      pinnedSelect.setAttribute("aria-selected", String(documentState.navigation.activeTabId === null));
      pinnedSelect.tabIndex = documentState.navigation.activeTabId === null ? 0 : -1;
      pinnedSelect.addEventListener("click", () => openDestination("work-hub"));
      pinnedSelect.addEventListener("keydown", (event) => {
        if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
        event.preventDefault();
        const tabs = [...elements.destinationTabs.querySelectorAll('[role="tab"]')];
        const index = tabs.indexOf(pinnedSelect);
        const next = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1
          : (index + (event.key === "ArrowLeft" ? -1 : 1) + tabs.length) % tabs.length;
        tabs[next].focus();
      });
      pinnedTab.append(pinnedSelect);
      elements.destinationTabs.append(pinnedTab);

      for (const tab of documentState.navigation.tabs) {
        const visibleTitle = destinationVisibleTitle(tab);
        const item = element("div", "taskboard-destination-tab");
        item.dataset.destinationType = tab.destinationType;
        item.dataset.unavailable = String(!destinationAvailable(tab));
        item.draggable = true;
        item.addEventListener("dragstart", (event) => {
          draggedDestinationTabId = tab.id;
          item.setAttribute("aria-grabbed", "true");
          event.dataTransfer.effectAllowed = "move";
          event.dataTransfer.setData("text/plain", tab.id);
        });
        item.addEventListener("dragover", (event) => {
          event.preventDefault();
          event.dataTransfer.dropEffect = "move";
        });
        item.addEventListener("drop", (event) => {
          event.preventDefault();
          const draggedId = event.dataTransfer.getData("text/plain") || draggedDestinationTabId;
          const index = documentState.navigation.tabs.findIndex((candidate) => candidate.id === tab.id);
          if (uuidPattern.test(draggedId) && draggedId !== tab.id && index >= 0) {
            mutate("reorder-tab", { tabId: draggedId, index });
          }
        });
        item.addEventListener("dragend", () => {
          draggedDestinationTabId = null;
          item.setAttribute("aria-grabbed", "false");
        });
        const select = button("taskboard-destination-select", visibleTitle);
        select.id = `taskboard-tab-${tab.id}`;
        select.dataset.tabId = tab.id;
        select.setAttribute("role", "tab");
        select.setAttribute("aria-keyshortcuts", "Control+Shift+ArrowLeft Control+Shift+ArrowRight");
        select.setAttribute("aria-selected", String(tab.id === documentState.navigation.activeTabId));
        select.tabIndex = tab.id === documentState.navigation.activeTabId ? 0 : -1;
        select.addEventListener("click", () => mutate("activate-tab", { tabId: tab.id }));
        select.addEventListener("keydown", (event) => {
          if (event.ctrlKey && event.shiftKey && ["ArrowLeft", "ArrowRight"].includes(event.key)) {
            event.preventDefault();
            const index = documentState.navigation.tabs.findIndex((candidate) => candidate.id === tab.id);
            const target = Math.max(0, Math.min(
              documentState.navigation.tabs.length - 1,
              index + (event.key === "ArrowLeft" ? -1 : 1),
            ));
            if (target !== index) mutate("reorder-tab", { tabId: tab.id, index: target });
            return;
          }
          if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
          event.preventDefault();
          const tabs = [...elements.destinationTabs.querySelectorAll('[role="tab"]')];
          const index = tabs.indexOf(select);
          const next = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1
            : (index + (event.key === "ArrowLeft" ? -1 : 1) + tabs.length) % tabs.length;
          tabs[next].focus();
        });
        item.append(select);
        const close = button("taskboard-destination-close", "×");
        close.setAttribute("aria-label", t("taskboardCloseTab"));
        close.title = t("taskboardCloseTab");
        close.addEventListener("click", () => mutate("close-tab", { tabId: tab.id }));
        item.append(close);
        elements.destinationTabs.append(item);
      }
      renderDestinationOverflow();
      scheduleActiveDestinationReveal();
    };

    const renderDestinationOverflow = () => {
      const query = elements.destinationOverflowSearch.value.trim().toLocaleLowerCase(intlLocale);
      const destinations = [{
        id: "",
        destinationId: "work-hub",
        destinationType: "work-hub",
        safeTitle: t("navWorkHub"),
        pinned: true,
      }, ...documentState.navigation.tabs];
      elements.destinationOverflowCount.textContent = String(destinations.length);
      elements.destinationOverflowList.replaceChildren();
      const matches = destinations.filter(
        (tab) => destinationVisibleTitle(tab).toLocaleLowerCase(intlLocale).includes(query),
      );
      for (const tab of matches) {
        const open = button("taskboard-destination-overflow-item", destinationVisibleTitle(tab));
        open.dataset.unavailable = String(!destinationAvailable(tab));
        if (!tab.pinned) open.dataset.tabId = tab.id;
        open.setAttribute("aria-current", String(tab.pinned
          ? documentState.navigation.activeTabId === null
          : tab.id === documentState.navigation.activeTabId));
        open.addEventListener("click", () => {
          elements.destinationOverflow.open = false;
          if (tab.pinned) openDestination("work-hub");
          else mutate("activate-tab", { tabId: tab.id });
        });
        elements.destinationOverflowList.append(open);
      }
      if (!matches.length) {
        elements.destinationOverflowList.append(
          element("p", "taskboard-destination-overflow-empty", t("taskboardOverflowEmpty")),
        );
      }
    };

    const renderUnavailableDestination = (tab) => {
      const body = element("article", "taskboard-unavailable");
      body.append(
        element("p", "kicker", t("taskboardUnavailableKicker")),
        element("h2", "", tab.safeTitle),
        element("p", "help", t(tab.destinationType === "task"
          ? "taskboardDeletedBody" : "taskboardUnavailableBody")),
      );
      const actions = element("div", "taskboard-destination-actions");
      const hub = button("primary-button", t("taskboardGoToWorkHub"));
      hub.addEventListener("click", () => mutate("open-destination", {
        destinationId: "work-hub", newTab: false,
      }));
      const close = button("ghost-button", t("taskboardCloseTab"));
      close.addEventListener("click", () => mutate("close-tab", { tabId: tab.id }));
      actions.append(hub, close);
      body.append(actions);
      elements.destinationBody.append(body);
    };

    const renderTaskCollectionDestination = ({ titleKey, emptyKey, tasks, recent = false }) => {
      const body = element("article", "taskboard-collection-destination");
      const head = element("header", "taskboard-task-destination-head");
      const heading = element("div");
      heading.append(
        element("p", "kicker", t("taskboardKicker")),
        element("h2", "", t(titleKey)),
        element("p", "help", replace(t("taskboardDestinationCount"), [tasks.length])),
      );
      head.append(heading);
      body.append(head);
      if (!tasks.length) {
        body.append(element("p", "taskboard-collection-empty", t(emptyKey)));
      } else {
        const list = element("ol", "taskboard-collection-list");
        for (const entry of tasks) {
          const task = recent ? entry.task : entry;
          const item = element("li");
          const open = button("taskboard-collection-open", task.title, task.id);
          open.dataset.status = task.status;
          open.append(element("small", "", recent
            ? `${taskKey(task)} · ${formatTime(entry.openedAt)}`
            : `${taskKey(task)} · ${statusLabel(task.status)}`));
          open.addEventListener("click", () => openTask(task.id));
          item.append(open);
          list.append(item);
        }
        body.append(list);
      }
      elements.destinationBody.append(body);
    };

    const renderAttentionDestination = () => renderTaskCollectionDestination({
      titleKey: "taskboardAttentionTitle",
      emptyKey: "taskboardAttentionEmpty",
      tasks: attentionTasks(),
    });

    const renderRecentDestination = () => renderTaskCollectionDestination({
      titleKey: "taskboardRecentTitle",
      emptyKey: "taskboardRecentEmpty",
      tasks: recentTaskEntries(),
      recent: true,
    });

    const renderProjectsDestination = () => {
      const body = element("article", "taskboard-projects-destination");
      body.append(
        element("p", "kicker", t("taskboardKicker")),
        element("h2", "", t("navProjects")),
        element("p", "help", t("taskboardProjectsHelp")),
      );
      const project = button("taskboard-project-card", documentState.project.name);
      project.append(
        element("small", "", replace(t("taskboardProjectTaskCount"), [documentState.tasks.length])),
      );
      project.addEventListener("click", () => mutate("open-destination", {
        destinationId: `project:${documentState.project.id}`, newTab: false,
      }));
      body.append(project);
      elements.destinationBody.append(body);
    };

    const renderActiveDestination = () => {
      const tab = activeDestinationTab();
      const hubActive = !tab || tab.destinationType === "work-hub"
        || (tab.destinationType === "project" && destinationAvailable(tab));
      elements.runway.hidden = !hubActive || documentState.tasks.length === 0 || activeView !== "dashboard";
      elements.controls.hidden = !hubActive;
      elements.filters.hidden = documentState.tasks.length === 0;
      elements.workspace.hidden = !hubActive;
      elements.destination.hidden = hubActive;
      elements.destinationBody.replaceChildren();
      elements.projectSettings.hidden = tab?.destinationType !== "projects";
      const currentSideRoute = !tab ? "work-hub"
        : FIND_WORK_DESTINATIONS.includes(tab.destinationType) ? tab.destinationType : "";
      for (const route of sideRoutes) {
        route.classList.toggle("is-current", route.dataset.taskboardDestination === currentSideRoute);
        if (route.dataset.taskboardDestination === currentSideRoute) route.setAttribute("aria-current", "page");
        else route.removeAttribute("aria-current");
      }
      if (hubActive) return true;
      if (!tab) return false;
      if (tab.destinationType === "attention") {
        renderAttentionDestination();
        return false;
      }
      if (tab.destinationType === "recent") {
        renderRecentDestination();
        return false;
      }
      if (tab.destinationType === "action-queue") {
        renderActionQueue();
        return false;
      }
      if (tab.destinationType === "projects") {
        renderProjectsDestination();
        return false;
      }
      if (tab.destinationType === "studio-page" && destinationAvailable(tab)) {
        const body = element("article", "taskboard-studio-destination");
        body.append(
          element("p", "kicker", t("taskboardDestinations")),
          element("h2", "", destinationTitle(tab)),
        );
        const open = button("primary-button", destinationTitle(tab));
        open.addEventListener("click", () => openStudioDestination(tab));
        body.append(open);
        elements.destinationBody.append(body);
        return false;
      }
      const task = tab.destinationType === "task" ? taskForDestination(tab.destinationId) : null;
      if (!task) {
        renderUnavailableDestination(tab);
        return false;
      }
      const body = element("article", "taskboard-task-destination");
      const head = element("header", "taskboard-task-destination-head");
      const heading = element("div");
      heading.append(
        element("p", "kicker", t("taskboardTaskKicker")),
        element("h2", "", task.title),
        element("p", "taskboard-card-key", `${taskKey(task)} · ${statusLabel(task.status)}`),
      );
      const actions = element("div", "taskboard-destination-actions");
      const primaryAction = taskDestinationPrimaryAction(task);
      const primary = button(
        "primary-button",
        primaryAction === "next-message"
          ? t("taskboardNextMessage")
          : replace(t("taskboardTaskEditTitle"), [taskKey(task)]),
      );
      primary.addEventListener("click", () => {
        editTask(task.id);
        if (primaryAction === "next-message") {
          globalThis.requestAnimationFrame(() => elements.nextMessageDraft.focus());
        }
      });
      const edit = button("ghost-button", replace(t("taskboardTaskEditTitle"), [taskKey(task)]));
      edit.addEventListener("click", () => editTask(task.id));
      const duplicate = button("ghost-button", t("taskboardOpenInNewTab"));
      duplicate.addEventListener("click", () => openTask(task.id, true));
      const close = button("ghost-button", t("taskboardCloseTab"));
      close.addEventListener("click", () => mutate("close-tab", { tabId: tab.id }));
      actions.append(primary);
      if (primaryAction === "next-message") actions.append(edit);
      actions.append(duplicate, close);
      head.append(heading, actions);
      body.append(head);
      if (task.description) body.append(element("p", "taskboard-task-destination-description", task.description));
      const linkedSession = sessionCopy(task);
      if (linkedSession) {
        const summary = element("div", "taskboard-session-summary");
        summary.dataset.sessionState = linkedSession.state;
        summary.append(
          element("strong", "", linkedSession.label),
          element("span", "", linkedSession.evidence),
        );
        body.append(summary);
      }
      const facts = element("dl", "taskboard-task-destination-facts");
      for (const [label, value] of [
        [t("taskboardColumnStatus"), statusLabel(task.status)],
        [t("taskboardColumnPriority"), priorityLabel(task.priority)],
        [t("taskboardColumnAssignee"), task.assignee || "—"],
        [t("taskboardColumnDue"), formatDate(task.dueDate)],
        [t("taskboardColumnEvidence"), task.status === "done" ? t("taskboardAcceptedEvidence") : t("taskboardLocalEvidence")],
      ]) {
        facts.append(element("dt", "", label), element("dd", "", value));
      }
      body.append(facts);
      elements.destinationBody.append(body);
      return false;
    };

    const render = () => {
      if (!documentState) return;
      elements.loading.hidden = true;
      elements.error.hidden = true;
      elements.projectName.value = documentState.project.name;
      const sideRouteCounts = buildSideRouteCounts(documentState);
      for (const route of sideRoutes) {
        const destinationId = route.dataset.taskboardDestination;
        if (!["attention", "recent", "action-queue"].includes(destinationId)) continue;
        const count = sideRouteCounts[destinationId];
        const output = route.querySelector(`[data-taskboard-route-count="${destinationId}"]`);
        if (!output) continue;
        output.textContent = String(count);
        output.hidden = false;
        const labelKey = destinationId === "attention" ? "navNeedsAttention"
          : destinationId === "recent" ? "navRecent" : "navActionQueue";
        route.setAttribute(
          "aria-label",
          `${t(labelKey)}, ${replace(t("taskboardDestinationCount"), [count])}`,
        );
      }
      renderDestinationTabs();
      renderRunway();
      const tasks = filteredTasks();
      renderDashboard(tasks);
      renderBoard(tasks);
      renderList(tasks);
      renderTimeline(tasks);
      renderActiveDestination();
      if (editingTaskId && elements.dialog.open) {
        const task = taskById(editingTaskId);
        renderComments(task);
        renderNextMessage(task);
        renderTaskSession(task);
      }
    };

    const setActiveView = (view) => {
      if (!VIEW_IDS.includes(view)) return;
      activeView = view;
      for (const tab of viewTabs) {
        const active = tab.dataset.taskboardView === view;
        tab.setAttribute("aria-selected", String(active));
        tab.tabIndex = active ? 0 : -1;
      }
      for (const [id, panel] of viewPanels) {
        panel.hidden = id !== view;
        panel.classList.toggle("is-current", id === view);
      }
    };

    const renderComments = (task) => {
      elements.commentList.replaceChildren();
      elements.comments.hidden = !task;
      if (!task) return;
      for (const comment of task.comments) {
        const item = element("li");
        item.append(element("span", "", comment.body), element("time", "", formatTime(comment.createdAt)));
        elements.commentList.append(item);
      }
      if (!task.comments.length) elements.commentList.append(element("li", "", t("taskboardCommentsEmpty")));
    };

    const renderTaskSession = (task) => {
      const presentation = task ? sessionCopy(task) : null;
      elements.taskSessionState.hidden = !presentation;
      elements.taskMarkUsageLimit.hidden = !presentation;
      elements.taskMarkUsageLimit.textContent = presentation?.state === "terminated"
        ? t("taskboardResetSessionState") : t("taskboardMarkUsageLimit");
      elements.taskSessionState.textContent = presentation
        ? `${presentation.label} \u00B7 ${presentation.evidence}` : "";
      if (presentation) elements.taskSessionState.dataset.sessionState = presentation.state;
      else delete elements.taskSessionState.dataset.sessionState;
    };

    const renderNextMessage = (task) => {
      elements.nextMessage.hidden = !task || task.status === "done";
      if (elements.nextMessage.hidden) return;
      let loaded = true;
      try { loaded = savedPromptsLoaded() === true; } catch { loaded = false; }
      if (!loaded) ensureSavedPrompts();
      const prompts = savedPrompts();
      const selectedId = elements.savedPrompt.value;
      elements.savedPrompt.replaceChildren();
      const placeholder = element(
        "option",
        "",
        loaded && !prompts.length ? t("taskboardNoSavedPrompts") : t("taskboardChooseSavedPrompt"),
      );
      placeholder.value = "";
      elements.savedPrompt.append(placeholder);
      const activeDrafts = new Set(activeQueueItems().map((item) => item.draftId));
      for (const prompt of prompts) {
        const option = element("option", "", promptLabel(prompt, t("taskboardSavedPrompt")));
        option.value = prompt.id;
        option.disabled = activeDrafts.has(prompt.id);
        elements.savedPrompt.append(option);
      }
      if ([...elements.savedPrompt.options].some((option) => option.value === selectedId && !option.disabled)) {
        elements.savedPrompt.value = selectedId;
      }
      const target = currentTarget();
      const selectedPrompt = prompts.find((prompt) => prompt.id === elements.savedPrompt.value) ?? null;
      const draftText = elements.nextMessageDraft.value;
      const textValid = boundedString(draftText, 8000, false);
      const selectedUnchanged = selectedPrompt?.text === draftText
        && draftFingerprintPattern.test(selectedPrompt.fingerprint ?? "");
      elements.queueTarget.textContent = target.id && target.insertionAvailable
        ? t("taskboardQueueTargetCurrent") : t("taskboardQueueTargetUnavailable");
      elements.addToQueue.disabled = pending !== null || draftCreatePending
        || !target.id || !target.insertionAvailable
        || !textValid || (selectedUnchanged && activeDrafts.has(selectedPrompt.id));
      elements.managePrompts.hidden = typeof openStudioView !== "function";
    };

    const relationValue = (task) => task.relationIds.map((id) => {
      const relation = taskById(id);
      return relation ? taskKey(relation) : id;
    }).join(", ");

    const openTask = (id, newTab = false) => {
      const task = taskById(id);
      if (!task) return false;
      return mutate("open-task", { id: task.id, newTab });
    };

    const editTask = (id) => {
      const task = id ? taskById(id) : null;
      editingTaskId = task?.id ?? null;
      elements.dialogTitle.textContent = task
        ? replace(t("taskboardTaskEditTitle"), [taskKey(task)])
        : t("taskboardTaskNewTitle");
      elements.taskTitle.value = task?.title ?? "";
      elements.taskDescription.value = task?.description ?? "";
      elements.taskStatus.value = task?.status === "done" ? "review" : task?.status ?? "todo";
      elements.taskPriority.value = task?.priority ?? "normal";
      elements.taskAssignee.value = task?.assignee ?? "";
      elements.taskLabels.value = task?.labels.join(", ") ?? "";
      elements.taskStartDate.value = task?.startDate ?? "";
      elements.taskDueDate.value = task?.dueDate ?? "";
      elements.nextMessageDraft.value = "";
      elements.savedPrompt.value = "";
      elements.taskBranch.value = task?.branch ?? "";
      elements.taskWorktree.value = task?.worktree ?? "";
      elements.taskThread.value = task?.providerThreadId ?? "";
      elements.taskRelations.value = task ? relationValue(task) : "";
      elements.taskDelete.hidden = !task;
      elements.taskAccept.hidden = task?.status !== "review";
      elements.taskSave.hidden = task?.status === "done";
      elements.commentText.value = "";
      renderComments(task);
      renderNextMessage(task);
      renderTaskSession(task);
      setDialogStatus("");
      if (typeof elements.dialog.showModal === "function") elements.dialog.showModal();
      else elements.dialog.setAttribute("open", "");
      elements.taskTitle.focus();
    };

    const parseLabels = (value) => [...new Set(value.split(",")
      .map((label) => label.trim())
      .filter(Boolean))].slice(0, 8);
    const parseRelations = (value, currentId) => [...new Set(value.split(",")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => documentState.tasks.find((task) => task.id === part || taskKey(task).toLocaleUpperCase() === part.toLocaleUpperCase())?.id ?? part)
      .filter((id) => id !== currentId && uuidPattern.test(id)))].slice(0, 16);

    const taskFields = () => ({
      title: elements.taskTitle.value.trim(),
      description: elements.taskDescription.value.trim(),
      status: elements.taskStatus.value,
      priority: elements.taskPriority.value,
      labels: parseLabels(elements.taskLabels.value),
      assignee: elements.taskAssignee.value.trim(),
      startDate: elements.taskStartDate.value || null,
      dueDate: elements.taskDueDate.value || null,
      relationIds: parseRelations(elements.taskRelations.value, editingTaskId),
      branch: elements.taskBranch.value.trim(),
      worktree: elements.taskWorktree.value.trim(),
      providerThreadId: elements.taskThread.value.trim(),
    });

    const read = (force = false) => {
      if (requested && !force) return;
      const requestId = newRequestId();
      if (!requestId) {
        showLoadFailure();
        return;
      }
      requested = true;
      pending = { requestId, operation: "read", closeDialog: false };
      setBusy(true);
      setStatus(t("taskboardLoading"));
      if (!send({ type: "taskboard-read", version: 1, requestId })) {
        pending = null;
        setBusy(false);
        showLoadFailure();
      }
    };

    const mutate = (operation, payload, options = {}) => {
      if (!documentState || !uuidPattern.test(session) || revision < 0 || pending) return false;
      const requestId = newRequestId();
      if (!requestId) return false;
      commandEpoch += 1;
      pending = {
        requestId,
        operation,
        closeDialog: options.closeDialog === true,
        announce: options.announce === true,
        followupDestination: FIND_WORK_DESTINATIONS.includes(options.followupDestination)
          ? options.followupDestination : null,
      };
      setBusy(true);
      setStatus(t("taskboardSaving"));
      setDialogStatus(t("taskboardSaving"));
      const sent = send({
        type: "taskboard-mutate",
        version: 1,
        requestId,
        session,
        revision,
        commandEpoch,
        operation,
        payload,
      });
      if (!sent) {
        pending = null;
        setBusy(false);
        setStatus(t("taskboardSaveFailed"), "error");
        setDialogStatus(t("taskboardSaveFailed"), "error");
      }
      return sent;
    };

    const openDestination = (destinationId, newTab = false) => {
      if (!FIND_WORK_DESTINATIONS.includes(destinationId) || typeof newTab !== "boolean") return false;
      if (!documentState) {
        queuedDestination = { destinationId, newTab };
        read(false);
        return true;
      }
      return mutate("open-destination", { destinationId, newTab });
    };

    const resultMessage = (message) => {
      if (!pending || message.requestId !== pending.requestId) return;
      const priorPending = pending;
      pending = null;
      setBusy(false);
      if (message.ok === false && message.code === "state-unavailable") {
        requested = false;
        showLoadFailure();
        setStatus(t("taskboardLoadFailed"), "error");
        setDialogStatus(t("taskboardSaveFailed"), "error");
        return;
      }
      const normalized = normalizeDocument(message.document);
      if (!normalized || typeof message.session !== "string" || !uuidPattern.test(message.session)
          || !Number.isSafeInteger(message.revision) || message.revision !== normalized.revision
          || !Number.isSafeInteger(message.commandEpoch) || message.commandEpoch < 0) {
        showLoadFailure();
        setStatus(t("taskboardLoadFailed"), "error");
        return;
      }
      session = message.session;
      revision = message.revision;
      commandEpoch = Math.max(commandEpoch, message.commandEpoch);
      documentState = normalized;
      localSessionsState = normalizeLocalSessions(message.localSessions)
        ?? Object.freeze({ schemaVersion: 1, available: false, sessions: [] });
      requested = true;
      if (message.ok === false) {
        const key = message.code === "revision-conflict" || message.code === "task-version-conflict"
          ? "taskboardConflict" : message.code === "tab-limit"
            ? "taskboardTabLimit" : "taskboardSaveFailed";
        setStatus(t(key), "error");
        setDialogStatus(t(key), "error");
      } else {
        setStatus(t(priorPending.operation === "read" ? "taskboardReady" : "taskboardSaved"));
        setDialogStatus(t("taskboardSaved"));
        if (priorPending.closeDialog && elements.dialog.open) elements.dialog.close();
      }
      render();
      if (message.ok !== false && priorPending.operation === "read" && queuedDestination) {
        const destination = queuedDestination;
        queuedDestination = null;
        openDestination(destination.destinationId, destination.newTab);
        return;
      }
      if (message.ok !== false && priorPending.followupDestination) {
        openDestination(priorPending.followupDestination);
        return;
      }
      if (message.ok !== false && ["open-task", "open-destination", "activate-tab", "close-tab", "reorder-tab"]
        .includes(priorPending.operation)) {
        const activeControl = documentState.navigation.activeTabId === null
          ? elements.destinationTabs.querySelector("[data-pinned-work-hub]")
          : elements.destinationTabs.querySelector(
            `[data-tab-id="${documentState.navigation.activeTabId}"]`,
          );
        activeControl?.focus();
      }
      if (message.ok !== false && ["open-destination", "activate-tab"].includes(priorPending.operation)) {
        const tab = activeDestinationTab();
        if (tab?.destinationType === "studio-page") openStudioDestination(tab);
      }
    };

    const receive = (message) => {
      if (!isRecord(message) || message.version !== 1) return false;
      if (message.type === "taskboard-state" || message.type === "taskboard-result") {
        resultMessage(message);
        return true;
      }
      if (message.type === "taskboard-changed"
          && typeof message.session === "string" && uuidPattern.test(message.session)
          && Number.isSafeInteger(message.revision) && message.revision >= 0
          && !pending && message.revision !== revision) {
        requested = false;
        read(true);
        return true;
      }
      return false;
    };

    for (const tab of viewTabs) {
      tab.addEventListener("click", () => {
        setActiveView(tab.dataset.taskboardView);
        render();
      });
      tab.addEventListener("keydown", (event) => {
        if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
        event.preventDefault();
        const index = viewTabs.indexOf(tab);
        const nextIndex = event.key === "Home" ? 0 : event.key === "End" ? viewTabs.length - 1
          : (index + (event.key === "ArrowLeft" ? -1 : 1) + viewTabs.length) % viewTabs.length;
        viewTabs[nextIndex].focus();
        viewTabs[nextIndex].click();
      });
    }
    for (const route of localRoutes) {
      route.addEventListener("click", () => openDestination(route.dataset.taskboardDestination));
    }
    elements.refresh.addEventListener("click", () => {
      requested = false;
      read(true);
    });
    elements.create.addEventListener("click", () => editTask(null));
    elements.closeDesktop.addEventListener("click", () => send({ type: "taskboard-close" }));
    elements.projectSave.addEventListener("click", () => {
      const name = elements.projectName.value.trim();
      if (!name) {
        setStatus(t("taskboardProjectNameRequired"), "error");
        elements.projectName.focus();
        return;
      }
      mutate("update-project", { name }, { announce: true });
    });
    for (const control of [elements.search, elements.statusFilter, elements.priorityFilter]) {
      control.addEventListener(control === elements.search ? "input" : "change", render);
    }
    elements.destinationOverflowSearch.addEventListener("input", renderDestinationOverflow);
    elements.destinationOverflow.addEventListener("toggle", () => {
      if (elements.destinationOverflow.open) elements.destinationOverflowSearch.focus();
    });
    elements.taskSave.addEventListener("click", () => {
      if (!elements.form.reportValidity()) return;
      const fields = taskFields();
      if (editingTaskId) {
        const task = taskById(editingTaskId);
        if (task) mutate("update-task", {
          id: task.id,
          taskVersion: task.version,
          patch: fields,
        }, { closeDialog: true });
      } else {
        mutate("create-task", fields, { closeDialog: true });
      }
    });
    elements.taskAccept.addEventListener("click", () => {
      const task = taskById(editingTaskId);
      if (task) mutate("accept-task", { id: task.id, taskVersion: task.version }, { closeDialog: true });
    });
    elements.taskMarkUsageLimit.addEventListener("click", () => {
      const task = taskById(editingTaskId);
      const presentation = task ? sessionPresentation(task) : null;
      if (!task || !presentation) return;
      if (presentation.state === "terminated") {
        if (!globalThis.confirm(t("taskboardResetSessionStateConfirm"))) return;
        mutate("reset-session-state", {
          id: task.id,
          taskVersion: task.version,
          providerThreadId: task.providerThreadId,
        });
        return;
      }
      if (!globalThis.confirm(t("taskboardMarkUsageLimitConfirm"))) return;
      mutate("report-session-termination", {
        id: task.id,
        taskVersion: task.version,
        providerThreadId: task.providerThreadId,
        reason: "usage-limit",
      });
    });
    elements.taskDelete.addEventListener("click", () => {
      const task = taskById(editingTaskId);
      if (!task || !globalThis.confirm(t("taskboardDeleteConfirm"))) return;
      mutate("delete-task", { id: task.id, taskVersion: task.version }, { closeDialog: true });
    });
    elements.commentSave.addEventListener("click", () => {
      const task = taskById(editingTaskId);
      const body = elements.commentText.value.trim();
      if (!task || !body) return;
      mutate("add-comment", { id: task.id, taskVersion: task.version, body });
      elements.commentText.value = "";
    });
    elements.savedPrompt.addEventListener("change", () => {
      const selected = savedPrompts().find(
        (prompt) => prompt.id === elements.savedPrompt.value,
      );
      if (selected) elements.nextMessageDraft.value = selected.text;
      renderNextMessage(taskById(editingTaskId));
    });
    elements.nextMessageDraft.addEventListener("input", () => {
      renderNextMessage(taskById(editingTaskId));
    });
    elements.addToQueue.addEventListener("click", () => {
      const task = taskById(editingTaskId);
      const target = currentTarget();
      const draftId = elements.savedPrompt.value;
      const text = elements.nextMessageDraft.value;
      const prompt = savedPrompts().find((item) => item.id === draftId) ?? null;
      const selectedUnchanged = prompt?.text === text
        && draftFingerprintPattern.test(prompt.fingerprint ?? "");
      if (!task || task.status === "done" || !target.id || !target.insertionAvailable
          || !boundedString(text, 8000, false)) return;
      const priority = { urgent: 100, high: 60, normal: 40, low: 20, none: 0 }[task.priority] ?? 0;
      if (!selectedUnchanged) {
        const started = createSavedPrompt(text, {
          taskId: task.id,
          taskVersion: task.version,
          localTargetId: target.id,
          priority,
        });
        if (started) {
          draftCreatePending = true;
          renderNextMessage(task);
        } else {
          setDialogStatus(t("taskboardSaveFailed"), "error");
        }
        return;
      }
      mutate("queue-draft", {
        taskId: task.id,
        taskVersion: task.version,
        draftId,
        draftFingerprint: prompt.fingerprint,
        localTargetId: target.id,
        priority,
      }, { closeDialog: true, followupDestination: "action-queue" });
    });
    elements.managePrompts.addEventListener("click", () => {
      if (typeof openStudioView !== "function") return;
      if (elements.dialog.open) elements.dialog.close();
      openStudioView("prompt-shelf");
    });
    elements.dialog.addEventListener("close", () => {
      editingTaskId = null;
      setDialogStatus("");
    });
    rootDocument.addEventListener("keydown", (event) => {
      if (section.hidden || elements.dialog.open || event.altKey || event.metaKey || !event.ctrlKey
          || !documentState) return;
      const tabs = documentState.navigation.tabs;
      const tabCount = tabs.length + 1;
      const activeIndex = documentState.navigation.activeTabId === null ? 0
        : tabs.findIndex((tab) => tab.id === documentState.navigation.activeTabId) + 1;
      const activateAt = (index) => index === 0
        ? openDestination("work-hub")
        : mutate("activate-tab", { tabId: tabs[index - 1].id });
      if (event.key === "Tab") {
        if (tabCount < 2) return;
        event.preventDefault();
        const direction = event.shiftKey ? -1 : 1;
        const nextIndex = (activeIndex + direction + tabCount) % tabCount;
        activateAt(nextIndex);
        return;
      }
      if (!event.shiftKey && event.key.toLowerCase() === "w" && activeIndex > 0) {
        event.preventDefault();
        mutate("close-tab", { tabId: tabs[activeIndex - 1].id });
        return;
      }
      if (!event.shiftKey && /^[1-9]$/u.test(event.key)) {
        const requestedIndex = Number(event.key) - 1;
        const nextIndex = event.key === "9" ? tabCount - 1 : requestedIndex;
        if (nextIndex >= 0 && nextIndex < tabCount) {
          event.preventDefault();
          activateAt(nextIndex);
        }
      }
    });

    setActiveView(activeView);
    return Object.freeze({
      ensure: () => read(false),
      receive,
      refresh: () => render(),
      isLoaded: () => documentState !== null,
      openDestination,
      queueCreatedDraft: (itemId, metadata = {}) => {
        const prompt = savedPrompts().find((item) => item.id === itemId) ?? null;
        if (!documentState || !uuidPattern.test(metadata.taskId ?? "")
            || !Number.isSafeInteger(metadata.taskVersion) || metadata.taskVersion < 1
            || !localTargetPattern.test(metadata.localTargetId ?? "")
            || !Number.isSafeInteger(metadata.priority)
            || metadata.priority < -100 || metadata.priority > 100
            || !prompt || !draftFingerprintPattern.test(prompt.fingerprint ?? "")) return false;
        draftCreatePending = false;
        return mutate("queue-draft", {
          taskId: metadata.taskId,
          taskVersion: metadata.taskVersion,
          draftId: prompt.id,
          draftFingerprint: prompt.fingerprint,
          localTargetId: metadata.localTargetId,
          priority: metadata.priority,
        }, { closeDialog: true, followupDestination: "action-queue" });
      },
      cancelDraftCreation: () => {
        draftCreatePending = false;
        setDialogStatus(t("taskboardSaveFailed"), "error");
        if (editingTaskId && elements.dialog.open) renderNextMessage(taskById(editingTaskId));
      },
    });
  }

  window.CLAUDE_AURA_TASKBOARD = Object.freeze({
    create: createTaskboard,
    buildTimelineScale,
    buildSideRouteCounts,
    destinationScrollTarget,
    normalizeLocalSessions,
    normalizeQueue,
    queueRowPresentation,
    sessionPresentation,
    taskDestinationPrimaryAction,
  });
})();
