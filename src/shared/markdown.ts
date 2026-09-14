/**
 * The Markdown pipeline: the document format on disk and the bridge to
 * the editing surface.
 *
 * The renderer edits rich text (HTML) but the document of record is
 * Markdown, so any markdown reader can consume these notes. Saving
 * converts HTML→Markdown (`documentToMarkdown`); loading converts
 * Markdown→HTML (`markdownToDocumentHtml`) and sanitizes the result,
 * so nothing rendered comes from outside the allowlist.
 *
 * Round-tripping is deliberately lossy in the direction the writer
 * cannot see: `<u>` and `<mark>` have no markdown equivalent, so a
 * saved note that had them reads back as plain runs of text. The user's
 * words, structure and emphasis all survive.
 */
import TurndownService from "turndown";
import MarkdownIt from "markdown-it";
import { sanitizeDocumentHtml } from "./html.ts";

const turndown = new TurndownService({
  headingStyle: "atx", // # headings, the markdown the toolbar implies
  codeBlockStyle: "fenced", // ``` blocks, not four-space indentation
  bulletListMarker: "-",
  emDelimiter: "*",
  strongDelimiter: "**",
  hr: "---",
});

// A visible line break (<br>) saves as a single newline - not GFM's
// two trailing spaces, which read as accidental whitespace and vanish
// in editors that trim lines. The `br` constructor option does not
// accept this, hence the rule.
turndown.addRule("br", {
  filter: "br",
  replacement: () => "\n",
});

// `u` and `mark` have no markdown equivalent; keep them as inline HTML
// so a document carrying them loses nothing on a save/load cycle.
turndown.keep(["u", "mark"]);

// Strikethrough is not in turndown's default vocabulary; `~~` is the
// GFM syntax every markdown reader understands.
turndown.addRule("strikethrough", {
  filter: ["s", "del"],
  replacement: (content) => `~~${content}~~`,
});

// `breaks` renders a single newline as a visible line break (<br>),
// matching what the writer sees in the source editor: one Enter = one
// new line on screen. Without it, two typed lines silently merge into
// one paragraph the moment the rich view re-renders - the classic
// markdown surprise, and here it reads as a round-trip bug.
const markdownIt = new MarkdownIt({ html: false, linkify: false, breaks: true });

/** Editing-surface HTML → the Markdown stored on disk. */
export function documentToMarkdown(html: string): string {
  return turndown.turndown(html).trim();
}

/** Stored Markdown → sanitized editing-surface HTML. */
export function markdownToDocumentHtml(markdown: string): string {
  const raw = markdownIt.render(markdown);
  return sanitizeDocumentHtml(raw).trim();
}

/**
 * True when a stored document looks like legacy editor HTML rather
 * than Markdown. First-launch notes and markdown documents both hit
 * the fast path; only genuine legacy saves migrate.
 */
export function looksLikeLegacyHtml(text: string): boolean {
  return /^\s*</.test(text) && /<\/(p|h1|h2|h3|div|ul|ol|blockquote|pre)>/i.test(text);
}
