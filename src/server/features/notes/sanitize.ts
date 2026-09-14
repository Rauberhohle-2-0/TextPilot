/**
 * Server-side sanitization of document HTML.
 *
 * The renderer sends HTML (a writer's formatting: headings, bold, lists,
 * links). Nothing reaches storage unsanitized - the browser can be
 * compromised, and a stored `<script>` would attack whoever loads the
 * document next. This module is the single allowlist both sides agree on;
 * the client uses the same tags only to decide which buttons are active.
 */
import sanitizeHtml from "sanitize-html";

/**
 * What a writer may format. Structural tags come with their usual
 * attributes; styles are not carried through, so formatting stays
 * semantic instead of decaying into inline style soup.
 */
export const ALLOWED_TAGS = [
  "p", "br", "hr",
  "h1", "h2", "h3",
  "b", "strong", "i", "em", "u", "s", "mark",
  "blockquote", "pre", "code",
  "ul", "ol", "li",
  "a",
] as const;

export const ALLOWED_ATTRIBUTES: Record<string, string[]> = {
  a: ["href", "title"],
};

const SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [...ALLOWED_TAGS],
  allowedAttributes: ALLOWED_ATTRIBUTES,
  // URLs are restricted to safe schemes; javascript: and data: are dropped.
  allowedSchemes: ["http", "https", "mailto"],
  allowedSchemesByTag: { a: ["http", "https", "mailto"] },
  // Relative links are fine; a note is a self-contained document.
  allowProtocolRelative: false,
};

export function sanitizeDocumentHtml(html: string): string {
  return sanitizeHtml(html, SANITIZE_OPTIONS);
}
