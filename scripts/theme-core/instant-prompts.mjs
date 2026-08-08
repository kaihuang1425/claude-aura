export function createInstantPromptController(document, window, settings = {}) {
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
      const [id, label, , iconIndex] = card;
      const button = document.createElement("button");
      button.setAttribute("type", "button");
      button.setAttribute(CARD_ATTRIBUTE, id);
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
    if (block.parentElement !== group || group.children?.[0] !== block) {
      group.insertBefore(block, shellChild);
    }
  };

  return { sync, clear };
}
