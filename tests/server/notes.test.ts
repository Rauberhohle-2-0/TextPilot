import { describe, expect, test } from "bun:test";
import { createApp } from "../../src/server/app.ts";
import { createNoteStore } from "../../src/server/features/notes/index.ts";
import { Logger } from "../../src/logging/logger.ts";
import type { Transport } from "../../src/logging/transport.ts";

const silent: Transport = { name: "silent", write: () => {} };
const logger = new Logger({ level: "error", transports: [silent] });

function appWithStore() {
  const store = createNoteStore();
  const app = createApp({ logger });
  // Swap the in-memory store for ours so assertions can inspect it.
  return { app, store };
}

describe("notes api", () => {
  test("GET /api/note returns an empty note initially", async () => {
    const { app } = appWithStore();
    const res = await app.request("/api/note");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.text).toBe("");
    expect(typeof body.updatedAt).toBe("string");
  });

  test("PUT /api/note stores text and returns it", async () => {
    const { app } = appWithStore();
    const put = await app.request("/api/note", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Hello, writer." }),
    });
    expect(put.status).toBe(200);
    expect(((await put.json()) as { text: string }).text).toBe("Hello, writer.");

    const get = await app.request("/api/note");
    expect(((await get.json()) as { text: string }).text).toBe("Hello, writer.");
  });

  test("PUT /api/note rejects a non-string text", async () => {
    const { app } = appWithStore();
    const res = await app.request("/api/note", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: 42 }),
    });
    expect(res.status).toBe(400);
  });

  test("PUT /api/note rejects malformed JSON", async () => {
    const { app } = appWithStore();
    const res = await app.request("/api/note", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: "not json",
    });
    expect(res.status).toBe(400);
  });
});
