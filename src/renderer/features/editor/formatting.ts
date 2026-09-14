/**
 * The formatting vocabulary: what the toolbar offers, expressed as
 * `document.execCommand` actions over the writable space.
 *
 * Shared by the toolbar (to build buttons) and the view (to reflect the
 * selection's state), so adding a format is one entry here plus a CSS
 * class - not edits in several files.
 */
export type FormatKind = "block" | "inline";

export interface FormatAction {
  readonly id: string;
  /** `document.execCommand` command this action runs. */
  readonly command: string;
  /** Argument for the command, e.g. the block tag. */
  readonly value?: string;
  readonly kind: FormatKind;
  /** lucide icon name (lowercase, hyphenated). */
  readonly icon: string;
  readonly title: string;
  /** Keyboard shortcut shown in the tooltip, e.g. "⌘B". */
  readonly shortcut?: string;
}

export const FORMAT_ACTIONS: FormatAction[] = [
  { id: "h1", command: "formatBlock", value: "h1", kind: "block", icon: "heading-1", title: "Heading 1" },
  { id: "h2", command: "formatBlock", value: "h2", kind: "block", icon: "heading-2", title: "Heading 2" },
  { id: "h3", command: "formatBlock", value: "h3", kind: "block", icon: "heading-3", title: "Heading 3" },
  { id: "paragraph", command: "formatBlock", value: "p", kind: "block", icon: "pilcrow", title: "Body text" },
  { id: "bold", command: "bold", kind: "inline", icon: "bold", title: "Bold", shortcut: "⌘B" },
  { id: "italic", command: "italic", kind: "inline", icon: "italic", title: "Italic", shortcut: "⌘I" },
  { id: "underline", command: "underline", kind: "inline", icon: "underline", title: "Underline", shortcut: "⌘U" },
  { id: "strikethrough", command: "strikeThrough", kind: "inline", icon: "strikethrough", title: "Strikethrough" },
  { id: "blockquote", command: "formatBlock", value: "blockquote", kind: "block", icon: "text-quote", title: "Quote" },
  { id: "code", command: "formatBlock", value: "pre", kind: "block", icon: "code", title: "Code block" },
  { id: "bullet", command: "insertUnorderedList", kind: "block", icon: "list", title: "Bullet list" },
  { id: "number", command: "insertOrderedList", kind: "block", icon: "list-ordered", title: "Numbered list" },
];

/** The commands whose active state is queried on selection change. */
export const STATE_COMMANDS = [
  "bold",
  "italic",
  "underline",
  "strikeThrough",
  "insertUnorderedList",
  "insertOrderedList",
] as const;

export function applyFormat(action: FormatAction): void {
  document.execCommand(action.command, false, action.value);
}

export function isFormatActive(action: FormatAction): boolean {
  return document.queryCommandState(action.command);
}

/** The tag of the block containing the selection, e.g. "h1" or "p". */
export function activeBlockTag(): string | undefined {
  const node = document.getSelection()?.anchorNode;
  const element = node?.nodeType === Node.ELEMENT_NODE
    ? (node as Element)
    : node?.parentElement;
  const block = element?.closest("h1,h2,h3,p,blockquote,pre,li");
  return block ? block.tagName.toLowerCase() : undefined;
}
