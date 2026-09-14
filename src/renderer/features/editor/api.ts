/**
 * The editor's client for the notes API.
 *
 * The only file that knows the endpoints exist. The view and store stay
 * free of fetch, so the persistence layer can change without touching UI.
 * `text` carries document HTML: formatting is part of the document.
 */
export interface NotePayload {
  /** Document HTML (sanitized server-side on save). */
  readonly text: string;
  readonly updatedAt: string;
}

export async function loadNote(): Promise<NotePayload> {
  const response = await fetch("/api/note");
  if (!response.ok) throw new Error(`load failed: ${response.status}`);
  return (await response.json()) as NotePayload;
}

export async function saveNote(html: string): Promise<NotePayload> {
  const response = await fetch("/api/note", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ text: html }),
  });
  if (!response.ok) throw new Error(`save failed: ${response.status}`);
  return (await response.json()) as NotePayload;
}
