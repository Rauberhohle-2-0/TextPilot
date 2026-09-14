/**
 * Note storage.
 *
 * The default writes the one note to disk under the project's data
 * directory, so closing and reopening the app restores exactly the
 * document the user had open - never a fresh one. The interface is the
 * point: a SQLite-backed implementation replaces `createFileNoteStore`
 * without the routes or the renderer ever noticing.
 */
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { Logger } from "../../../logging/logger.ts";

export interface NoteRecord {
  readonly text: string;
  readonly updatedAt: string;
}

export interface NoteStore {
  load(): Promise<NoteRecord>;
  save(text: string): Promise<NoteRecord>;
}

export interface FileNoteStoreOptions {
  /** Where the note is persisted; missing parent directories are created. */
  path: string;
  logger?: Logger;
}

const EMPTY_NOTE: NoteRecord = { text: "", updatedAt: new Date(0).toISOString() };

export function createFileNoteStore({ path, logger }: FileNoteStoreOptions): NoteStore {
  const log = logger?.child("notes");

  function read(): NoteRecord {
    try {
      const raw = JSON.parse(readFileSync(path, "utf8")) as Partial<NoteRecord>;
      if (typeof raw.text !== "string" || typeof raw.updatedAt !== "string") {
        throw new Error("malformed note file");
      }
      return { text: raw.text, updatedAt: raw.updatedAt };
    } catch {
      // A missing or unreadable file is an empty document, not an error:
      // that is every first launch.
      return EMPTY_NOTE;
    }
  }

  return {
    async load() {
      const note = read();
      log?.debug("note loaded", { bytes: note.text.length });
      return note;
    },

    async save(text) {
      const note: NoteRecord = { text, updatedAt: new Date().toISOString() };
      mkdirSync(dirname(path), { recursive: true });
      // Write to a sibling then rename, so a crash mid-write cannot
      // corrupt the file that the next launch will read.
      const temp = `${path}.tmp`;
      writeFileSync(temp, JSON.stringify(note, null, 2));
      renameSync(temp, path);
      log?.debug("note saved", { bytes: note.text.length });
      return note;
    },
  };
}
