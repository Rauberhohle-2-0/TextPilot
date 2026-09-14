/**
 * Markdown input rules: markdown syntax typed into the editing surface
 * becomes formatting as you type, the way Notion or Obsidian behave.
 *
 * Two families live here:
 *
 * - Block rules fire when a block's entire text matches (`## `, `- `,
 *   `1. `, `> `, ```): the trigger text is consumed and the block
 *   becomes the format. This is what "click H1 and see ## appear" in
 *   reverse looks like - the syntax writes the format.
 * - Inline rules fire on a closing delimiter typed right after a run
 *   of text opened with the matching opener (`**bold**`, `*italic*`,
 *   `` `code` ``, `~~strike~~`): the delimiters are stripped and the
 *   run is formatted.
 *
 * Everything runs through `document.execCommand`, the same primitive
 * the toolbar uses, so toolbar state, undo history and the autosave
 * cycle all behave identically whether a format was typed or clicked.
 */
import { FORMAT_ACTIONS, applyFormat } from "./formatting.ts";

/**
 * A block rule: when the typed character is a space and the block's
 * text so far matches `pattern`, the block becomes the format and the
 * trigger text is consumed. Patterns match text *before* the space:
 * the space itself is cancelled, not inserted.
 */
interface BlockRule {
  pattern: RegExp;
  /** The FORMAT_ACTIONS entry whose command/value applies the format. */
  action: string;
}

/** An inline rule: opener…closer typed around a text run formats the run. */
interface InlineRule {
  opener: string;
  closer: string;
 /** The element the formatted run becomes; all are in the allowlist. */
  tag: "b" | "i" | "code" | "s";
}

const BLOCK_RULES: BlockRule[] = [
  // Longest patterns first, so `##` is tested before `#`.
  { pattern: /^###$/, action: "h3" },
  { pattern: /^##$/, action: "h2" },
  { pattern: /^#$/, action: "h1" },
  { pattern: /^>$/, action: "blockquote" },
  { pattern: /^```$/, action: "code" },
  { pattern: /^[-*+]$/, action: "bullet" },
  { pattern: /^1\.$/, action: "number" },
];

const INLINE_RULES: InlineRule[] = [
  { opener: "**", closer: "**", tag: "b" },
  { opener: "__", closer: "__", tag: "b" },
  { opener: "*", closer: "*", tag: "i" },
  { opener: "_", closer: "_", tag: "i" },
  { opener: "`", closer: "`", tag: "code" },
  { opener: "~~", closer: "~~", tag: "s" },
];

export interface InputRulesOptions {
  /** The contenteditable the rules listen on. */
  target: HTMLElement;
  /** Fired after a rule changed the document; the view autosaves. */
  onChange(): void;
}

/**
 * Installs the rules on the surface. Returns a disposer - the editor's
 * destroy path unlistens, so a torn-down editor never formats again.
 */
export function installInputRules({ target, onChange }: InputRulesOptions): () => void {
  target.addEventListener("beforeinput", onBeforeInput);
  return () => target.removeEventListener("beforeinput", onBeforeInput);

  function onBeforeInput(event: InputEvent): void {
    if (event.inputType === "deleteContentBackward" && tryEscapeList()) {
      event.preventDefault();
      onChange();
      return;
    }
    if (event.inputType !== "insertText" || event.data === null) return;
    const char = event.data;
    // For multi-character closers (`**`, `~~`), the typed character is
    // only the final half - the rest is already in the text.
    if (char !== " " && !INLINE_RULES.some((rule) => rule.closer.endsWith(char))) return;

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || !selection.isCollapsed) return;

    if (char === " " ? tryBlockRule() : tryInlineRule(char)) {
      event.preventDefault();
      onChange();
    }
  }

  /**
   * Backspace at the start of a list item leaves the list instead of
   * merging into the previous one - otherwise the writer is stuck
   * cycling bullets while trying to end a list (the standard
   * Notion/Obsidian escape: backspace once = bullet gone, the item's
   * text becomes a paragraph with the caret where it was).
   */
  function tryEscapeList(): boolean {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || !selection.isCollapsed) return false;
    const item = listItemAtCaret();
    if (!item) return false;
    if (caretOffsetIn(item) !== 0) return false;
    const list = item.parentElement;
    if (!list) return false;

    // The item's inline text becomes the paragraph; nested lists under
    // the item survive as siblings after it rather than being flattened.
    const paragraph = document.createElement("p");
    const nested: Element[] = [];
    for (const child of Array.from(item.childNodes)) {
      if (child.nodeType === Node.ELEMENT_NODE && (child as Element).matches("ul,ol")) {
        nested.push(child as Element);
      } else {
        paragraph.append(child);
      }
    }

    if (list.children.length === 1) {
      list.replaceWith(paragraph, ...nested);
    } else if (list.firstElementChild === item) {
      list.before(paragraph, ...nested);
      item.remove();
    } else if (list.lastElementChild === item) {
      list.after(paragraph, ...nested);
      item.remove();
    } else {
      // Split: items before stay in the original list, items after
      // move to a new one, the paragraph sits between them.
      const tail = document.createElement(list.tagName);
      let inTail = false;
      for (const child of Array.from(list.children)) {
        if (child === item) { inTail = true; continue; }
        if (inTail) tail.append(child);
      }
      list.after(paragraph, ...nested, tail);
      item.remove();
    }
    placeCaret(paragraph, 0);
    return true;
  }

  /** The `li` containing the caret, if any. */
  function listItemAtCaret(): HTMLElement | undefined {
    const node = window.getSelection()?.anchorNode;
    const element = node?.nodeType === Node.ELEMENT_NODE
      ? (node as Element)
      : node?.parentElement;
    return element?.closest("li") ?? undefined;
  }

  /** `## ` / `- ` / `> ` / ``` at block start → format the block. */
  function tryBlockRule(): boolean {
    const block = blockAtCaret();
    if (!block) return false;
    const text = block.textContent ?? "";
    for (const rule of BLOCK_RULES) {
      const match = rule.pattern.exec(text);
      if (!match) continue;
      const action = FORMAT_ACTIONS.find((a) => a.id === rule.action);
      if (!action) return false;
      // Drop the trigger text, then apply the format to the now-empty
      // block. The selection is collapsed at the end, so the command
      // lands inside the block.
      block.textContent = "";
      placeCaret(block, 0);
      applyFormat(action);
      // Chromium leaves a stray empty paragraph after formatBlock on an
      // empty block (and after list commands too); remove it so the
      // writer does not inherit a phantom blank line.
      const formatted = blockAtCaret();
      const topLevel = formatted?.closest("ul,ol,blockquote,h1,h2,h3,pre,p") ?? formatted;
      const next = topLevel?.nextElementSibling;
      if (next?.tagName === "P" && next.textContent === "") next.remove();
      return true;
    }
    return false;
  }

  /**
   * `**text**` / `*text*` / `` `text` `` / `~~text~~` → format the run.
   * Several closers can end with the same character (`*` ends both
   * `**` and `*`); every candidate gets a chance, not just the first.
   */
  function tryInlineRule(closer: string): boolean {
    for (const rule of INLINE_RULES) {
      if (!rule.closer.endsWith(closer)) continue;
      if (applyInlineRule(rule)) return true;
    }
    return false;
  }

  /** One inline rule attempt: opener + body + partial closer → formatted. */
  function applyInlineRule(rule: InlineRule): boolean {
    const block = blockAtCaret();
    if (!block) return false;

    const text = block.textContent ?? "";
    const caret = caretOffsetIn(block);
    const body = text.slice(0, caret);
    const openerIndex = body.lastIndexOf(rule.opener);
    if (openerIndex === -1) return false;

    // For multi-character closers (`**`), the first half is already in
    // the text from the previous keystroke; the closer being typed now
    // completes it. The run between opener and that partial closer is
    // what gets formatted.
    const partialCloser = rule.closer.length - 1;
    const inner = body.slice(openerIndex + rule.opener.length, caret - partialCloser);
    if (inner.length === 0) return false;
    if (partialCloser > 0 && !body.endsWith(rule.closer.slice(0, partialCloser))) return false;

    // The opener must be at a boundary or preceded by whitespace, so
    // `a**b**` never rewrites the middle of a word.
    const before = openerIndex > 0 ? body[openerIndex - 1]! : " ";
    if (!/\s/.test(before)) return false;

    // Cancel the closer just typed and replace `opener + inner +
    // partial closer` with the formatted run.
    selectRange(block, openerIndex, caret);
    const formatted = document.createElement(rule.tag);
    formatted.textContent = inner;
    document.execCommand("insertHTML", false, formatted.outerHTML);
    return true;
  }

  /** The nearest block-level element containing the caret. */
  function blockAtCaret(): Element | undefined {
    const node = window.getSelection()?.anchorNode;
    const element = node?.nodeType === Node.ELEMENT_NODE
      ? (node as Element)
      : node?.parentElement;
    return element?.closest("p,h1,h2,h3,li,blockquote,pre,div") ?? undefined;
  }

  /** Caret offset as a character index within `block`'s text content. */
  function caretOffsetIn(block: Element): number {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return 0;
    const range = selection.getRangeAt(0);
    const probe = range.cloneRange();
    probe.selectNodeContents(block);
    probe.setEnd(range.endContainer, range.endOffset);
    return probe.toString().length;
  }

  function selectRange(block: Element, start: number, end: number): void {
    const range = document.createRange();
    setRangeToPoint(range, block, start);
    setRangeToPoint(range, block, end, true);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  }

  function setRangeToPoint(range: Range, block: Element, offset: number, toEnd = false): void {
    const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
    let remaining = offset;
    let node: Node | null = walker.nextNode();
    while (node) {
      const length = node.textContent?.length ?? 0;
      if (remaining <= length) {
        if (toEnd) range.setEnd(node, remaining);
        else range.setStart(node, remaining);
        return;
      }
      remaining -= length;
      node = walker.nextNode();
    }
    // Ran off the end: clamp to the block's boundary.
    if (toEnd) range.setEnd(block, block.childNodes.length);
    else range.setStart(block, block.childNodes.length);
  }

  function placeCaret(block: Element, offset: number): void {
    const selection = window.getSelection();
    if (!selection) return;
    const range = document.createRange();
    setRangeToPoint(range, block, offset);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
  }

}
