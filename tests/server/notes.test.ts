import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApp } from "../../src/server/app.ts";
import { createFileNoteStore } from "../../src/server/features/notes/index.ts";
import { Logger } from "../../src/logging/logger.ts";
import type { Transport } from "../../src/logging/transport.ts";

const silent: Transport = { name: "silent", write: () => {} };
const logger = new Logger({ level: "error", transports: [silent] });

function tempDataFile(): string {
  return join(mkdtempSync(join(tmpdir(), "textpilot-notes-")), "note.json");
}

describe("notes api", () => {
  test("GET /api/note returns an empty note on first launch", async () => {
    const app = createApp({ logger });
    const res = await app.request("/api/note");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.text).toBe("");
    expect(typeof body.updatedAt).toBe("string");
  });

  test("PUT /api/note stores text and returns it", async () => {
    const app = createApp({ logger });
    const put = await app.request("/api/note", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Hello, writer." }),
    });
    expect(put.status).toBe(200);
    expect(((await put.json()) as { text: string }).text).toBe("Hello, writer.");
  });

  test("PUT /api/note rejects a non-string text", async () => {
    const app = createApp({ logger });
    const res = await app.request("/api/note", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: 42 }),
    });
    expect(res.status).toBe(400);
  });

  test("PUT /api/note rejects malformed JSON", async () => {
    const app = createApp({ logger });
    const res = await app.request("/api/note", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: "not json",
    });
    expect(res.status).toBe(400);
  });
});

describe("persistence across restarts", () => {
  test("a new store instance reads what the previous run saved", async () => {
    // Two runs over the same file: what closing and reopening the app is.
    const path = tempDataFile();

    const firstRun = createFileNoteStore({ path, logger });
    await firstRun.save("The last document the user had open.");

    const secondRun = createFileNoteStore({ path, logger });
    const note = await secondRun.load();

    expect(note.text).toBe("The last document the user had open.");
  });

  test("a corrupted note file is treated as empty, not a crash", async () => {
    const path = tempDataFile();
    writeFileSync(path, '{"text": "trunc');

    const store = createFileNoteStore({ path, logger });
    const note = await store.load();
    expect(note.text).toBe("");
  });

  test("saving writes atomically - no temp file left behind", async () => {
    const path = tempDataFile();
    const store = createFileNoteStore({ path, logger });
    await store.save("written");
    await store.save("written again");

    const note = await store.load();
    expect(note.text).toBe("written again");
    expect(rmSyncIfPresent(`${path}.tmp`)).toBe(false);
  });
});

/** True if the file existed (it is then deleted); false when absent. */
function rmSyncIfPresent(path: string): boolean {
  try {
    rmSync(path);
    return true;
  } catch {
    return false;
  }
}
