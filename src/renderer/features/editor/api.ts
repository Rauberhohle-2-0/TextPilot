/**
 * The editor's client for the notes API.
 *
 * The only file that knows the endpoints exist. The view and store stay
 * free of fetch, so the persistence layer can change without touching UI.
 */
export interface NotePayload {
  readonly text: string;
  readonly updatedAt: string;
}

export async function loadNote(): Promise<NotePayload> {
  const response = await fetch("/api/note");
  if (!response.ok) throw new Error(`load failed: ${response.status}`);
  return (await response.json()) as NotePayload;
}

export async function saveNote(text: string): Promise<NotePayload> {
  const response = await fetch("/api/note", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ text }),
  });
  if (!response.ok) throw new Error(`save failed: ${response.status}`);
  return (await response.json()) as NotePayload;
}
