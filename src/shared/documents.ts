/**
 * The document type, shared by the server (storage, API) and the
 * renderer (sidebar, editor).
 *
 * A document is Markdown - the format of record - plus the metadata the
 * sidebar needs to list it without loading its text.
 */
export interface DocumentMeta {
  readonly id: string;
  readonly title: string;
  readonly updatedAt: string;
}

export interface DocumentRecord extends DocumentMeta {
  readonly text: string;
}

/**
 * The display title of a document: its first non-empty line with
 * markdown markers stripped, shortened for the sidebar. Empty or
 * untitled documents get a stable fallback so a row always has a name.
 */
export function deriveTitle(markdown: string): string {
  const firstLine =
    markdown
      .split("\n")
      .map((line) => line.trim())
      .find((line) => line.length > 0) ?? "";
  const stripped = firstLine
    .replace(/^#{1,6}\s+/, "")
    .replace(/[*_`~>[\]()]/g, "")
    .trim();
  const title = stripped.length > 0 ? stripped : "Untitled";
  return title.length > 60 ? `${title.slice(0, 57).trimEnd()}…` : title;
}
