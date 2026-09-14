import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApp } from "../../src/server/app.ts";
import {
  createFileNoteStore,
  createNoteRoutes,
} from "../../src/server/features/notes/index.ts";
import { sanitizeDocumentHtml } from "../../src/server/features/notes/sanitize.ts";
import { Logger } from "../../src/logging/logger.ts";
import type { Transport } from "../../src/logging/transport.ts";

const silent: Transport = { name: "silent", write: () => {} };
const logger = new Logger({ level: "error", transports: [silent] });

function tempDataFile(): string {
  return join(mkdtempSync(join(tmpdir(), "textpilot-notes-")), "note.json");
}

describe("notes api", () => {
  /** The app under test, pointed at a throwaway data file. */
  function appWithTempStore() {
    const app = createApp({ logger });
    const routes = createNoteRoutes({
      store: createFileNoteStore({ path: tempDataFile(), logger }),
      logger,
    });
    return { app, routes };
  }

  test("GET /api/note returns an empty note on first launch", async () => {
    const { routes } = appWithTempStore();
    const res = await routes.request("/note");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.text).toBe("");
  });

  test("PUT /api/note stores HTML and returns it", async () => {
    const { routes } = appWithTempStore();
    const html = '<h1>Chapter One</h1><p>A <b>bold</b> start.</p>';
    const put = await routes.request("/note", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: html }),
    });
    expect(put.status).toBe(200);
    expect(((await put.json()) as { text: string }).text).toBe(html);
  });

  test("PUT /api/note rejects a non-string text", async () => {
    const { routes } = appWithTempStore();
    const res = await routes.request("/note", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: 42 }),
    });
    expect(res.status).toBe(400);
  });

  test("PUT /api/note rejects malformed JSON", async () => {
    const { routes } = appWithTempStore();
    const res = await routes.request("/note", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: "not json",
    });
    expect(res.status).toBe(400);
  });

  test("PUT /api/note sanitizes what it stores", async () => {
    const { routes } = appWithTempStore();
    await routes.request("/note", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        text: '<p>keep</p><script>alert(1)</script><p onclick="x()">hit</p>',
      }),
    });
    const get = await routes.request("/note");
    const stored = ((await get.json()) as { text: string }).text;
    expect(stored).not.toContain("<script>");
    expect(stored).not.toContain("onclick");
    expect(stored).toContain("<p>keep</p>");
  });

  test("PUT /api/note rejects documents over the size cap", async () => {
    const { routes } = appWithTempStore();
    const res = await routes.request("/note", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "<p>" + "x".repeat(2_100_000) + "</p>" }),
    });
    expect(res.status).toBe(413);
  });
});

describe("document sanitizer", () => {
  test("allows the writer's formatting tags", () => {
    const html =
      "<h1>Title</h1><p><strong>bold</strong> <em>italic</em> <u>underline</u></p>" +
      "<blockquote><p>quote</p></blockquote><ul><li>item</li></ul>";
    expect(sanitizeDocumentHtml(html)).toBe(html);
  });

  test("strips scripts, event handlers and style attributes", () => {
    const dirty =
      '<p style="color:red" onmouseover="x()">a</p><script>bad()</script>' +
      '<iframe src="https://evil.example"></iframe>';
    const clean = sanitizeDocumentHtml(dirty);
    expect(clean).toBe("<p>a</p>");
  });

  test("drops javascript: URLs but keeps https links", () => {
    const clean = sanitizeDocumentHtml(
      '<a href="javascript:alert(1)">bad</a><a href="https://ok.example">good</a>',
    );
    expect(clean).not.toContain("javascript:");
    expect(clean).toContain('href="https://ok.example"');
  });
});

describe("persistence across restarts", () => {
  test("a new store instance reads what the previous run saved", async () => {
    // Two runs over the same file: what closing and reopening the app is.
    const path = tempDataFile();

    const firstRun = createFileNoteStore({ path, logger });
    const html = "<h2>Scene</h2><p>Text with <i>formatting</i> intact.</p>";
    await firstRun.save(html);

    const secondRun = createFileNoteStore({ path, logger });
    const note = await secondRun.load();

    expect(note.text).toBe(html);
  });

  test("formatting survives a restart, not just the words", async () => {
    const path = tempDataFile();
    const firstRun = createFileNoteStore({ path, logger });
    await firstRun.save(
      "<h1>Notes</h1><ul><li><b>bold</b> and <em>italic</em></li></ul>",
    );

    const reopened = createFileNoteStore({ path, logger });
    const note = await reopened.load();
    expect(note.text).toContain("<h1>Notes</h1>");
    expect(note.text).toContain("<b>bold</b>");
    expect(note.text).toContain("<em>italic</em>");
  });

  test("a corrupted note file is treated as empty, not a crash", async () => {
    const path = tempDataFile();
    writeFileSync(path, '{"text": "trunc');

    const store = createFileNoteStore({ path, logger });
    const note = await store.load();
    expect(note.text).toBe("");
  });

  test("saving is atomic - no temp file left behind", async () => {
    const path = tempDataFile();
    const store = createFileNoteStore({ path, logger });
    await store.save("<p>one</p>");
    await store.save("<p>two</p>");

    const note = await store.load();
    expect(note.text).toBe("<p>two</p>");
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
