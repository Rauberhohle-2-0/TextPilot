/**
 * Note storage.
 *
 * The default keeps one note in memory, which suits a dev run. The
 * interface is the point: a SQLite-backed implementation replaces
 * `createNoteStore` without the routes or the renderer ever noticing.
 */
export interface NoteRecord {
  readonly text: string;
  readonly updatedAt: string;
}

export interface NoteStore {
  load(): Promise<NoteRecord>;
  save(text: string): Promise<NoteRecord>;
}

export function createNoteStore(): NoteStore {
  let note: NoteRecord = { text: "", updatedAt: new Date(0).toISOString() };

  return {
    async load() {
      return note;
    },
    async save(text) {
      note = { text, updatedAt: new Date().toISOString() };
      return note;
    },
  };
}
