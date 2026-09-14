/**
 * The `/api/note` routes: load and save the one writable space.
 *
 * The document is Markdown - the format of record, readable by any
 * markdown tool. It is stored as text, verbatim: the client renders it
 * into sanitized HTML before showing anything, so a hostile payload in
 * a saved note never reaches a DOM.
 */
import { Hono } from "hono";
import type { Logger } from "../../../logging/logger.ts";
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
    const note = await store.save(body.text);
    log?.info("note saved", { bytes: note.text.length });
    return c.json(note, 200);
  });

  return routes;
}

/** 2 MB of Markdown is far beyond any honest document. */
const MAX_DOCUMENT_BYTES = 2_000_000;
