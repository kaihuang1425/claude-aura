export function createInstantPromptController(document, window, settings = {}, responsive = null) {
  const BLOCK_ATTRIBUTE = "data-claude-aura-instant-prompts";
  const CARD_ATTRIBUTE = "data-claude-aura-instant-prompt-card";
  const directChildWithin = (ancestor, descendant) => {
    let child = descendant;
    while (child?.parentElement && child.parentElement !== ancestor) child = child.parentElement;
    return child?.parentElement === ancestor ? child : null;
  };
  const insertText = (editor, prompt) => {
    if (!editor || editor.matches?.("[readonly],[disabled],[aria-disabled=true]")) return false;
    editor.focus?.({ preventScroll: true });
    if (typeof editor.setRangeText === "function" && typeof editor.value === "string") {
      const start = Number.isInteger(editor.selectionStart) ? editor.selectionStart : editor.value.length;
      const end = Number.isInteger(editor.selectionEnd) ? editor.selectionEnd : start;
      editor.setRangeText(prompt, start, end, "end");
      const EventType = window.InputEvent ?? window.Event;
      editor.dispatchEvent?.(new EventType("input", {
        bubbles: true,
        composed: true,
        inputType: "insertText",
        data: prompt,
      }));
      return true;
    }
    if (editor.isContentEditable || editor.getAttribute?.("contenteditable") === "true") {
      const selection = window.getSelection?.();
      if (selection && document.createRange) {
        const range = document.createRange();
        range.selectNodeContents(editor);
        range.collapse(false);
        selection.removeAllRanges();
        selection.addRange(range);
      }
      return document.execCommand?.("insertText", false, prompt) === true;
    }
    return false;
  };
  const cards = Array.isArray(settings.P) ? settings.P : [];
  const artworkUrls = Array.isArray(settings.u) ? settings.u : [];
  let block = null;
  let editor = null;
  const layoutValues = (layout) => {
    if (responsive?.["track"] && Array.isArray(layout) && layout.length === 2
        && Array.isArray(layout[1])) {
      const resolved = responsive["value"](
        layout[1],
        [0, 0, 1, 1, 0, 0],
        ["positionX", "positionY", "width", "scale", "offsetX", "offsetY"],
        { positionX: 2, positionY: 2, width: 2, scale: 2, offsetX: 2, offsetY: 2 },
      );
      return {
        responsive: true,
        opacity: layout[0],
        ...resolved["value"],
        source: resolved["source"],
      };
    }
    const frame = window.innerWidth >= 1440 ? "wide" : "normal";
    const offset = frame === "wide" ? 4 : 1;
    const values = Array.isArray(layout) && layout.length === 7
      ? layout : [1, 0, 0, 1, 0, 0, 1];
    return {
      responsive: false,
      frame,
      opacity: values[0],
      positionX: values[offset],
      positionY: values[offset + 1],
      width: 1,
      scale: values[offset + 2],
      offsetX: 0,
      offsetY: 0,
      source: "explicit",
    };
  };

  const applyLayout = (button, layout) => {
    const values = layoutValues(layout);
    button.setAttribute("data-claude-aura-widget-frame", values.responsive ? "responsive" : values.frame);
    if (values.responsive) {
      button.setAttribute("data-claude-aura-widget-responsive", values.source);
    } else button.removeAttribute?.("data-claude-aura-widget-responsive");
    button.style?.setProperty?.("--aura-widget-opacity", String(values.opacity));
    button.style?.setProperty?.("--aura-widget-x", values.responsive
      ? `calc(${values.positionX}vw + ${values.offsetX}px)`
      : `${values.positionX}vw`);
    button.style?.setProperty?.("--aura-widget-y", values.responsive
      ? `calc(${values.positionY}vh + ${values.offsetY}px)`
      : `${values.positionY}vh`);
    button.style?.setProperty?.("--aura-widget-width", String(values.width));
    button.style?.setProperty?.("--aura-widget-scale", String(values.scale));
  };

  const clear = () => {
    if (block) block.removeEventListener("click", onClick);
    block?.remove();
    block = null;
    editor = null;
  };

  const onClick = (event) => {
    const button = event.target?.closest?.(`[${CARD_ATTRIBUTE}]`);
    if (!button || !block || !button.closest?.(`[${BLOCK_ATTRIBUTE}]`)) return;
    const card = cards.find((entry) => entry?.[0] === button.getAttribute(CARD_ATTRIBUTE));
    if (!card || typeof card[2] !== "string") return;
    insertText(editor, card[2]);
  };

  const build = () => {
    const next = document.createElement("div");
    next.setAttribute(BLOCK_ATTRIBUTE, "true");
    next.setAttribute("role", "group");
    for (const card of cards) {
      if (!Array.isArray(card) || card.length < 4) continue;
      const [id, label, , iconIndex, layout] = card;
      const button = document.createElement("button");
      button.setAttribute("type", "button");
      button.setAttribute(CARD_ATTRIBUTE, id);
      applyLayout(button, layout);
      if (Number.isInteger(iconIndex) && typeof artworkUrls[iconIndex] === "string") {
        const icon = document.createElement("img");
        icon.setAttribute("src", artworkUrls[iconIndex]);
        icon.setAttribute("alt", "");
        icon.setAttribute("aria-hidden", "true");
        button.appendChild(icon);
      }
      const text = document.createElement("span");
      text.textContent = label;
      button.appendChild(text);
      next.appendChild(button);
    }
    next.addEventListener("click", onClick);
    return next;
  };

  const sync = (context, found) => {
    if (context !== "new-chat" || cards.length === 0 || !found?.shell || !found?.editor) {
      clear();
      return;
    }
    const group = found.prompt ?? found.group ?? found.shell.parentElement;
    const shellChild = group ? directChildWithin(group, found.shell) : null;
    if (!group || !shellChild) {
      clear();
      return;
    }
    editor = found.editor;
    if (!block) block = build();
    for (const button of block.children ?? []) {
      const card = cards.find((entry) => entry?.[0] === button.getAttribute?.(CARD_ATTRIBUTE));
      applyLayout(button, card?.[4]);
    }
    if (block.parentElement !== group || group.children?.[0] !== block) {
      group.insertBefore(block, shellChild);
    }
  };

  return { sync, clear };
}
