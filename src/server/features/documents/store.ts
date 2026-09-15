/**
 * Document storage: one JSON file per document under the data directory.
 *
 * Files are the point - a document is a file the user can back up, and
 * adding one is creating a file, not extending a schema. Writes go
 * through a sibling temp file and rename, the same atomic pattern the
 * single-note store uses. The interface is the seam: a SQLite-backed
 * implementation replaces this without the routes or UI noticing.
 */
import { mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { deriveTitle, type DocumentMeta, type DocumentRecord } from "../../../shared/documents.ts";
import type { Logger } from "../../../logging/logger.ts";

export interface DocumentStore {
  list(): Promise<DocumentMeta[]>;
  create(text?: string): Promise<DocumentRecord>;
  load(id: string): Promise<DocumentRecord>;
  save(id: string, text: string): Promise<DocumentRecord>;
}

export interface FileDocumentStoreOptions {
  /** Directory holding one JSON file per document; created if missing. */
  directory: string;
  /** Markdown persisted at first boot, when no documents exist yet. */
  seedText?: string;
  logger?: Logger;
}

export function createFileDocumentStore({
  directory,
  seedText,
  logger,
}: FileDocumentStoreOptions): DocumentStore {
  const log = logger?.child("documents");

  function existingIds(): string[] {
    try {
      return readdirSync(directory).filter((name) => name.endsWith(".json"));
    } catch {
      return [];
    }
  }

  function pathFor(id: string): string {
    // Only plain ids ever leave this module, but a route input must
    // never traverse out of the directory.
    if (!/^[a-z0-9-]+$/i.test(id)) throw new Error(`invalid document id: ${id}`);
    return join(directory, `${id}.json`);
  }

  function read(id: string): DocumentRecord | null {
    try {
      const raw = JSON.parse(readFileSync(pathFor(id), "utf8")) as Partial<DocumentRecord>;
      if (typeof raw.text !== "string" || typeof raw.updatedAt !== "string") {
        throw new Error("malformed document file");
      }
      return {
        id,
        text: raw.text,
        updatedAt: raw.updatedAt,
        title: deriveTitle(raw.text),
      };
    } catch {
      return null;
    }
  }

  function write(id: string, text: string): DocumentRecord {
    const record: DocumentRecord = {
      id,
      text,
      title: deriveTitle(text),
      updatedAt: new Date().toISOString(),
    };
    mkdirSync(directory, { recursive: true });
    // Write to a sibling then rename, so a crash mid-write cannot
    // corrupt the file the next launch reads.
    const path = pathFor(id);
    const temp = `${path}.tmp`;
    writeFileSync(temp, JSON.stringify(record, null, 2));
    renameSync(temp, path);
    return record;
  }

  return {
    async list() {
      const documents = existingIds()
        .map((name) => read(name.slice(0, -".json".length)))
        .filter((record): record is DocumentRecord => record !== null)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      log?.debug("documents listed", { count: documents.length });
      return documents.map(({ id, title, updatedAt }) => ({ id, title, updatedAt }));
    },

    async create(text = "") {
      mkdirSync(directory, { recursive: true });
      const id = crypto.randomUUID();
      const record = write(id, text);
      log?.info("document created", { id });
      return record;
    },

    async load(id) {
      const record = read(id);
      if (!record) throw new Error(`document not found: ${id}`);
      return record;
    },

    async save(id, text) {
      const record = write(id, text);
      log?.debug("document saved", { id, bytes: text.length });
      return record;
    },
  };
}

/** Remove the seed note.json when it has been migrated to a document. */
export function removeSeedNote(notePath: string): void {
  try {
    rmSync(notePath);
  } catch {
    // Absent or locked: nothing to migrate, nothing to clean.
  }
}
