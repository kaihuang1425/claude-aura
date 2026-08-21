// Claude Aura Studio pet selection and visibility controls.
(() => {
  "use strict";

  const PETS = Object.freeze([
    Object.freeze({ id: "nori", name: "Nori", accent: "#8178e8", art: "pets/nori.png" }),
    Object.freeze({ id: "pip", name: "Pip", accent: "#f0a11b", art: "pets/pip.png" }),
    Object.freeze({ id: "moss", name: "Moss", accent: "#6f9e5d", art: "pets/moss.png" }),
  ]);
  const PET_IDS = new Set(PETS.map((pet) => pet.id));
  const STATE_KEYS = Object.freeze([
    "type", "version", "contractId", "catalogVersion", "availability", "applyMode",
    "liveReceipt", "pets", "selection", "action", "actionSucceeded", "errorCode",
  ]);
  const isRecord = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
  const exactKeys = (value, keys) => isRecord(value)
    && Object.keys(value).length === keys.length
    && keys.every((key) => Object.hasOwn(value, key));
  const normalizeState = (value) => {
    if (!exactKeys(value, STATE_KEYS) || value.type !== "pet-plugin-state" || value.version !== 1
        || value.contractId !== "gemini-aura-pet-selection-v1" || value.catalogVersion !== 1
        || !["ready", "unavailable", "repair-required"].includes(value.availability)
        || value.applyMode !== "when-companion-running" || value.liveReceipt !== false
        || !Array.isArray(value.pets) || value.pets.length !== PETS.length
        || !exactKeys(value.selection, ["enabled", "selectedPetId", "revision"])
        || typeof value.selection.enabled !== "boolean"
        || !Number.isSafeInteger(value.selection.revision) || value.selection.revision < 0
        || !(value.selection.selectedPetId === null || PET_IDS.has(value.selection.selectedPetId))
        || (value.selection.enabled && value.selection.selectedPetId === null)
        || typeof value.action !== "string"
        || typeof value.actionSucceeded !== "boolean"
        || !(value.errorCode === null || [
          "companion-unavailable", "pet-not-selected", "operation-failed",
        ].includes(value.errorCode))) return null;
    const ids = new Set();
    for (const pet of value.pets) {
      if (!exactKeys(pet, ["id", "name"]) || !PET_IDS.has(pet.id) || ids.has(pet.id)
          || typeof pet.name !== "string" || pet.name !== PETS.find((item) => item.id === pet.id)?.name) {
        return null;
      }
      ids.add(pet.id);
    }
    return {
      availability: value.availability,
      enabled: value.selection.enabled,
      selectedPetId: value.selection.selectedPetId,
      revision: value.selection.revision,
      action: value.action,
      actionSucceeded: value.actionSucceeded,
      errorCode: value.errorCode,
    };
  };

  function createPets({ rootDocument, send, t }) {
    if (!rootDocument || typeof send !== "function" || typeof t !== "function") return null;
    const page = rootDocument.getElementById("pets");
    const catalog = rootDocument.getElementById("pet-catalog");
    const refresh = rootDocument.getElementById("pet-refresh");
    const settings = rootDocument.getElementById("pet-settings");
    const show = rootDocument.getElementById("pet-show");
    const hide = rootDocument.getElementById("pet-hide");
    const preview = rootDocument.getElementById("pet-selected-preview");
    const status = rootDocument.getElementById("pet-status");
    if (![page, catalog, refresh, settings, show, hide, preview, status].every(Boolean)) return null;

    let requested = false;
    let pending = false;
    let timer = null;
    let state = Object.freeze({ availability: "unavailable", enabled: false, selectedPetId: null });

    const setStatus = (copy, tone = "") => {
      status.textContent = copy;
      status.dataset.tone = tone;
    };
    const reflectPreview = () => {
      const selected = PETS.find((pet) => pet.id === state.selectedPetId) ?? null;
      if (!selected) {
        const words = rootDocument.createElement("span");
        const label = rootDocument.createElement("small");
        label.textContent = t("selected");
        const name = rootDocument.createElement("strong");
        name.textContent = t("backgroundNone");
        words.append(label, name);
        preview.replaceChildren(words);
        preview.dataset.empty = "true";
        return;
      }
      const image = rootDocument.createElement("img");
      image.src = selected.art;
      image.alt = "";
      const words = rootDocument.createElement("span");
      const label = rootDocument.createElement("small");
      label.textContent = t("selected");
      const name = rootDocument.createElement("strong");
      name.textContent = selected.name;
      words.append(label, name);
      preview.replaceChildren(image, words);
      preview.dataset.empty = "false";
    };
    const reflect = () => {
      const usable = state.availability === "ready" || state.availability === "repair-required";
      page.setAttribute("aria-busy", String(pending));
      refresh.disabled = pending;
      settings.disabled = pending || !usable;
      show.textContent = t("stageEyeShowShort");
      hide.textContent = t("stageEyeHideShort");
      // Show stays available while enabled so it can relaunch a companion that
      // was closed independently. Hide retains the selected pet for later.
      show.disabled = pending || !usable || !state.selectedPetId;
      hide.disabled = pending || !usable || !state.enabled;
      for (const button of catalog.querySelectorAll("button[data-pet-id]")) {
        const selected = button.dataset.petId === state.selectedPetId;
        button.disabled = pending || !usable || selected;
        button.setAttribute("aria-pressed", String(selected));
        button.classList.toggle("is-selected", selected);
      }
      reflectPreview();
    };
    const setPending = (value) => {
      pending = value;
      reflect();
    };
    const request = (message) => {
      if (pending) return false;
      setPending(true);
      setStatus("", "busy");
      if (!send(message)) {
        setPending(false);
        setStatus(t("saveFailed"), "error");
        return false;
      }
      rootDocument.defaultView?.clearTimeout(timer);
      timer = rootDocument.defaultView?.setTimeout(() => {
        setPending(false);
        setStatus(t("saveFailed"), "error");
      }, 6000);
      return true;
    };
    const read = () => request({ type: "pet-plugin-read" });

    for (const pet of PETS) {
      const row = rootDocument.createElement("button");
      row.type = "button";
      row.className = "pet-row";
      row.setAttribute("role", "listitem");
      row.setAttribute("aria-pressed", "false");
      row.dataset.petId = pet.id;
      row.style.setProperty("--pet-accent", pet.accent);
      const portrait = rootDocument.createElement("span");
      portrait.className = "pet-row-portrait";
      portrait.setAttribute("aria-hidden", "true");
      const image = rootDocument.createElement("img");
      image.src = pet.art;
      image.alt = "";
      portrait.append(image);
      const copy = rootDocument.createElement("span");
      copy.className = "pet-row-copy";
      const name = rootDocument.createElement("strong");
      name.textContent = pet.name;
      copy.append(name);
      const marker = rootDocument.createElement("span");
      marker.className = "pet-row-marker";
      marker.setAttribute("aria-hidden", "true");
      marker.textContent = "\u2713";
      row.addEventListener("click", () => request({ type: "pet-plugin-select", petId: pet.id }));
      row.append(portrait, copy, marker);
      catalog.append(row);
    }
    reflect();

    refresh.addEventListener("click", read);
    settings.addEventListener("click", () => request({ type: "pet-plugin-open-settings" }));
    show.addEventListener("click", () => request({ type: "pet-plugin-show" }));
    hide.addEventListener("click", () => request({ type: "pet-plugin-hide" }));

    return Object.freeze({
      ensure: () => {
        if (requested || pending) return false;
        requested = true;
        return read();
      },
      refresh: read,
      receive: (message) => {
        if (message?.type !== "pet-plugin-state") return false;
        const normalized = normalizeState(message);
        rootDocument.defaultView?.clearTimeout(timer);
        timer = null;
        setPending(false);
        if (!normalized) {
          setStatus(t("saveFailed"), "error");
          return true;
        }
        requested = true;
        state = Object.freeze(normalized);
        reflect();
        if (state.availability === "unavailable") setStatus(t("petSettingsUnavailable"), "error");
        else if (state.availability === "repair-required") setStatus(t("saveFailed"), "error");
        else if (!state.actionSucceeded) setStatus(
          state.errorCode === "pet-not-selected" ? t("statusReady")
            : state.errorCode === "companion-unavailable" ? t("petSettingsUnavailable") : t("saveFailed"),
          "error",
        );
        else if (["select", "show", "hide"].includes(state.action)) setStatus(t("taskboardSaved"));
        else setStatus(t("statusReady"));
        return true;
      },
    });
  }

  window.CLAUDE_AURA_PETS = Object.freeze({ create: createPets, normalizeState });
})();
