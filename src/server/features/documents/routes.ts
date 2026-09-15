/**
 * The `/api/documents` routes: list, create, load and save documents.
 *
 * Documents are Markdown - the format of record - stored verbatim; the
 * client renders sanitized HTML before showing anything. Titles are
 * derived from the text on the server, so the sidebar and the storage
 * can never disagree about a name.
 */
import { Hono } from "hono";
import type { Logger } from "../../../logging/logger.ts";
import type { DocumentStore } from "./store.ts";

export interface DocumentRoutesOptions {
  store: DocumentStore;
  logger?: Logger;
}

export function createDocumentRoutes({ store, logger }: DocumentRoutesOptions): Hono {
  const log = logger?.child("documents");
  const routes = new Hono();

  routes.get("/documents", async (c) => {
    const documents = await store.list();
    log?.debug("documents listed", { count: documents.length });
    return c.json({ documents }, 200);
  });

  routes.post("/documents", async (c) => {
    const body = (await c.req.json().catch(() => null)) as { text?: unknown } | null;
    if (body !== null && body.text !== undefined && typeof body.text !== "string") {
      return c.json({ error: "expected { text?: string }" }, 400);
    }
    const text = typeof body?.text === "string" ? body.text : "";
    if (text.length > MAX_DOCUMENT_BYTES) {
      return c.json({ error: "document too large" }, 413);
    }
    const document = await store.create(text);
    log?.info("document created", { id: document.id });
    return c.json(document, 201);
  });

  routes.get("/documents/:id", async (c) => {
    const id = c.req.param("id");
    if (!isId(id)) return c.json({ error: "invalid document id" }, 400);
    try {
      const document = await store.load(id);
      log?.debug("document loaded", { id, bytes: document.text.length });
      return c.json(document, 200);
    } catch {
      return c.json({ error: "document not found" }, 404);
    }
  });

  routes.put("/documents/:id", async (c) => {
    const id = c.req.param("id");
    if (!isId(id)) return c.json({ error: "invalid document id" }, 400);
    const body = (await c.req.json().catch(() => null)) as { text?: unknown } | null;
    if (!body || typeof body.text !== "string") {
      return c.json({ error: "expected { text: string }" }, 400);
    }
    if (body.text.length > MAX_DOCUMENT_BYTES) {
      return c.json({ error: "document too large" }, 413);
    }
    const document = await store.save(id, body.text);
    log?.info("document saved", { id, bytes: body.text.length });
    return c.json(document, 200);
  });

  return routes;
}

function isId(id: string): boolean {
  return /^[a-z0-9-]+$/i.test(id);
}

/** 2 MB of Markdown is far beyond any honest document. */
const MAX_DOCUMENT_BYTES = 2_000_000;
