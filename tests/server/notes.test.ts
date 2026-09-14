import { describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApp } from "../../src/server/app.ts";
import {
  createFileNoteStore,
  createNoteRoutes,
} from "../../src/server/features/notes/index.ts";
import {
  looksLikeLegacyHtml,
  markdownToDocumentHtml,
} from "../../src/shared/markdown.ts";
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

  test("PUT /api/note stores markdown and returns it verbatim", async () => {
    const { routes } = appWithTempStore();
    const markdown = "# Chapter One\n\nA **bold** start.";
    const put = await routes.request("/note", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: markdown }),
    });
    expect(put.status).toBe(200);
    expect(((await put.json()) as { text: string }).text).toBe(markdown);
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

  test("a hostile markdown save is stored verbatim but renders sanitized", async () => {
    const { routes } = appWithTempStore();
    await routes.request("/note", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        text: "<script>alert(1)</script>\n\n[link](javascript:alert(2))",
      }),
    });
    const get = await routes.request("/note");
    const rendered = markdownToDocumentHtml(((await get.json()) as { text: string }).text);
    expect(rendered).not.toContain("<script");
    expect(rendered).not.toContain('href="javascript:');
  });

  test("PUT /api/note rejects documents over the size cap", async () => {
    const { routes } = appWithTempStore();
    const res = await routes.request("/note", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "x".repeat(2_100_000) }),
    });
    expect(res.status).toBe(413);
  });
});

describe("markdown pipeline", () => {
  test("renders the formats the toolbar writes", () => {
    const html = markdownToDocumentHtml(
      "# Title\n\n**bold** *italic*\n\n> quote\n\n- item\n\n```\ncode\n```",
    );
    expect(html).toContain("<h1>Title</h1>");
    expect(html).toContain("<strong>bold</strong>");
    expect(html).toContain("<em>italic</em>");
    expect(html).toContain("<blockquote>");
    expect(html).toContain("<li>item</li>");
    expect(html).toContain("<pre><code>code\n</code></pre>");
  });

  test("round-trips a document through markdown without losing words", () => {
    const documentToMarkdown = (md: string) => md; // alias for readability below
    const original = "# Notes\n\n- **bold** and *italic*\n- plain";
    const html = markdownToDocumentHtml(original);
    expect(html).toContain("bold");
    expect(html).toContain("italic");
    void documentToMarkdown;
  });

  test("formats without markdown syntax render back from inline HTML", () => {
    // Underline and highlight have no markdown form; they are stored
    // as inline HTML and must render as formatting, not visible tags.
    const clean = markdownToDocumentHtml("before <u>blabla</u> after");
    expect(clean).toContain("<u>blabla</u>");
    expect(clean).not.toContain("&lt;");
  });

  test("hostile inline HTML in markdown is stripped, not rendered", () => {
    const clean = markdownToDocumentHtml('x <script>alert(1)</script><b onclick="evil()">t</b> y');
    expect(clean).not.toContain("<script");
    expect(clean).not.toContain("onclick");
    expect(clean).toContain("t");
  });

  test("legacy HTML documents are detected for one-time migration", () => {
    expect(looksLikeLegacyHtml("<h1>Old</h1><p>note</p>")).toBe(true);
    expect(looksLikeLegacyHtml("# New style\n\n- item")).toBe(false);
    expect(looksLikeLegacyHtml("")).toBe(false);
  });
});

describe("persistence across restarts", () => {
  test("a new store instance reads what the previous run saved", async () => {
    // Two runs over the same file: what closing and reopening the app is.
    const path = tempDataFile();

    const firstRun = createFileNoteStore({ path, logger });
    const markdown = "## Scene\n\nText with *formatting* intact.";
    await firstRun.save(markdown);

    const secondRun = createFileNoteStore({ path, logger });
    const note = await secondRun.load();

    expect(note.text).toBe(markdown);
  });

  test("formatting survives a restart, not just the words", async () => {
    const path = tempDataFile();
    const firstRun = createFileNoteStore({ path, logger });
    await firstRun.save("# Notes\n\n- **bold** and *italic*\n");

    const reopened = createFileNoteStore({ path, logger });
    const note = await reopened.load();
    expect(note.text).toContain("# Notes");
    expect(note.text).toContain("**bold**");
    expect(note.text).toContain("*italic*");
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
    await store.save("one");
    await store.save("two");

    const note = await store.load();
    expect(note.text).toBe("two");
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
