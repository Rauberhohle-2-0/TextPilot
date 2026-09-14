/**
 * The editor's client for the notes API.
 *
 * The only file that knows the endpoints exist. The view and store stay
 * free of fetch, so the persistence layer can change without touching UI.
 * `text` carries the document as Markdown: the format of record is
 * markdown, so any markdown reader can consume saved notes.
 */
export interface NotePayload {
  /** Document Markdown (rendered and sanitized client-side on load). */
  readonly text: string;
  readonly updatedAt: string;
}

export async function loadNote(): Promise<NotePayload> {
  const response = await fetch("/api/note");
  if (!response.ok) throw new Error(`load failed: ${response.status}`);
  return (await response.json()) as NotePayload;
}

export async function saveNote(markdown: string): Promise<NotePayload> {
  const response = await fetch("/api/note", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ text: markdown }),
  });
  if (!response.ok) throw new Error(`save failed: ${response.status}`);
  return (await response.json()) as NotePayload;
}
