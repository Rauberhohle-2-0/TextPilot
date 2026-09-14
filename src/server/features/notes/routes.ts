/**
 * The `/api/note` routes: load and save the one writable space.
 *
 * The document is HTML - a writer's formatting travels with the text.
 * Saves are sanitized server-side before storage; loads return the
 * already-sanitized form, so the client never renders anything that did
 * not pass the allowlist.
 */
import { Hono } from "hono";
import type { Logger } from "../../../logging/logger.ts";
import { sanitizeDocumentHtml } from "./sanitize.ts";
import type { NoteStore } from "./store.ts";

export interface NoteRoutesOptions {
  store: NoteStore;
  logger?: Logger;
}

export function createNoteRoutes({ store, logger }: NoteRoutesOptions): Hono {
  const log = logger?.child("notes");
  const routes = new Hono();

  routes.get("/note", async (c) => {
    const note = await store.load();
    log?.debug("note loaded", { bytes: note.text.length });
    return c.json(note, 200);
  });

  routes.put("/note", async (c) => {
    const body = (await c.req.json().catch(() => null)) as { text?: unknown } | null;
    if (!body || typeof body.text !== "string") {
      return c.json({ error: "expected { text: string }" }, 400);
    }
    if (body.text.length > MAX_DOCUMENT_BYTES) {
      return c.json({ error: "document too large" }, 413);
    }
    const html = sanitizeDocumentHtml(body.text);
    const note = await store.save(html);
    log?.info("note saved", { bytes: note.text.length });
    return c.json(note, 200);
  });

  return routes;
}

/** 2 MB of HTML is far beyond any honest document. */
const MAX_DOCUMENT_BYTES = 2_000_000;
