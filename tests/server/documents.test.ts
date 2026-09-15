import { describe, expect, test } from "bun:test";
import { mkdtempSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createDocumentRoutes,
  createFileDocumentStore,
} from "../../src/server/features/documents/index.ts";
import { deriveTitle } from "../../src/shared/documents.ts";
import { Logger } from "../../src/logging/logger.ts";
import type { Transport } from "../../src/logging/transport.ts";

const silent: Transport = { name: "silent", write: () => {} };
const logger = new Logger({ level: "error", transports: [silent] });

function tempRoutes() {
  const directory = mkdtempSync(join(tmpdir(), "textpilot-docs-"));
  const routes = createDocumentRoutes({
    store: createFileDocumentStore({ directory, logger }),
    logger,
  });
  return { routes, directory };
}

describe("documents api", () => {
  test("GET /api/documents starts empty on first launch", async () => {
    const { routes } = tempRoutes();
    const res = await routes.request("/documents");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ documents: [] });
  });

  test("POST /api/documents creates a document and lists it", async () => {
    const { routes } = tempRoutes();
    const post = await routes.request("/documents", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "# Shopping List\n\n- apples" }),
    });
    expect(post.status).toBe(201);
    const created = (await post.json()) as { id: string; title: string };
    expect(created.id).toBeTruthy();
    expect(created.title).toBe("Shopping List");

    const list = await routes.request("/documents");
    const body = (await list.json()) as { documents: { id: string }[] };
    expect(body.documents).toHaveLength(1);
    expect(body.documents[0]!.id).toBe(created.id);
  });

  test("POST /api/documents without a body creates an untitled document", async () => {
    const { routes } = tempRoutes();
    const post = await routes.request("/documents", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(post.status).toBe(201);
    const created = (await post.json()) as { title: string };
    expect(created.title).toBe("Untitled");
  });

  test("PUT /api/documents/:id saves and the title follows the text", async () => {
    const { routes } = tempRoutes();
    const created = (await (
      await routes.request("/documents", { method: "POST" })
    ).json()) as { id: string };

    const markdown = "# Renamed by editing\n\nBody.";
    const put = await routes.request(`/documents/${created.id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: markdown }),
    });
    expect(put.status).toBe(200);
    expect(((await put.json()) as { text: string }).text).toBe(markdown);

    const get = await routes.request(`/documents/${created.id}`);
    const body = (await get.json()) as { title: string; text: string };
    expect(body.title).toBe("Renamed by editing");
    expect(body.text).toBe(markdown);
  });

  test("GET /api/documents/:id 404s for a missing document", async () => {
    const { routes } = tempRoutes();
    const res = await routes.request("/documents/nope");
    expect(res.status).toBe(404);
  });

  test("path traversal in :id is rejected, not served", async () => {
    const { routes } = tempRoutes();
    const res = await routes.request("/documents/..%2F..%2Fnote");
    expect(res.status).toBe(400);
  });

  test("PUT rejects a non-string text and oversized documents", async () => {
    const { routes } = tempRoutes();
    const bad = await routes.request("/documents/some-id", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: 42 }),
    });
    expect(bad.status).toBe(400);

    const big = await routes.request("/documents/some-id", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "x".repeat(2_100_000) }),
    });
    expect(big.status).toBe(413);
  });

  test("documents persist as files that a new store instance reads", async () => {
    const directory = mkdtempSync(join(tmpdir(), "textpilot-docs-"));
    const first = createFileDocumentStore({ directory, logger });
    const created = await first.create("# Persisted\n");

    const second = createFileDocumentStore({ directory, logger });
    const loaded = await second.load(created.id);
    expect(loaded.text).toBe("# Persisted\n");
    expect(readdirSync(directory).filter((name) => name.endsWith(".json"))).toHaveLength(1);
  });
});

describe("deriveTitle", () => {
  test("uses the first non-empty line, markdown stripped", () => {
    expect(deriveTitle("# Heading first")).toBe("Heading first");
    expect(deriveTitle("\n\n**bold** line")).toBe("bold line");
    expect(deriveTitle("plain text")).toBe("plain text");
  });

  test("falls back to Untitled for empty documents", () => {
    expect(deriveTitle("")).toBe("Untitled");
    expect(deriveTitle("\n  \n")).toBe("Untitled");
  });

  test("shortens very long first lines", () => {
    const title = deriveTitle("x".repeat(200));
    expect(title.length).toBeLessThanOrEqual(60);
    expect(title.endsWith("…")).toBe(true);
  });
});
