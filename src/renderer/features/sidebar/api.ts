/**
 * The sidebar's client for the documents API.
 *
 * Like the editor's `api.ts`, the only file that knows the endpoints
 * exist; the view stays free of fetch.
 */
import type { DocumentMeta, DocumentRecord } from "../../../shared/documents.ts";

export interface DocumentListPayload {
  readonly documents: DocumentMeta[];
}

export async function listDocuments(): Promise<DocumentMeta[]> {
  const response = await fetch("/api/documents");
  if (!response.ok) throw new Error(`list failed: ${response.status}`);
  const body = (await response.json()) as DocumentListPayload;
  return body.documents;
}

export async function createDocument(text = ""): Promise<DocumentRecord> {
  const response = await fetch("/api/documents", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ text }),
  });
  if (!response.ok) throw new Error(`create failed: ${response.status}`);
  return (await response.json()) as DocumentRecord;
}

export async function loadDocument(id: string): Promise<DocumentRecord> {
  const response = await fetch(`/api/documents/${encodeURIComponent(id)}`);
  if (!response.ok) throw new Error(`load failed: ${response.status}`);
  return (await response.json()) as DocumentRecord;
}
