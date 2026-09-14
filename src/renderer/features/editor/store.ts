/**
 * Editor state, framework-free.
 *
 * A plain observable: the view subscribes, the network layer calls `set`.
 * No reactivity library - the UI is small enough that explicit is better,
 * and this file has no DOM in it so it is trivially testable.
 */
export interface EditorState {
  /** The document as Markdown - the format of record, saved to disk. */
  readonly markdown: string;
  /** True while a save is in flight. */
  readonly saving: boolean;
  /** Set once the note has been loaded from the server. */
  readonly loaded: boolean;
}

export type EditorListener = (state: EditorState) => void;

export class EditorStore {
  #state: EditorState = { markdown: "", saving: false, loaded: false };
  readonly #listeners = new Set<EditorListener>();

  get state(): EditorState {
    return this.#state;
  }

  subscribe(listener: EditorListener): () => void {
    this.#listeners.add(listener);
    listener(this.#state);
    return () => this.#listeners.delete(listener);
  }

  set(patch: Partial<EditorState>): void {
    this.#state = { ...this.#state, ...patch };
    for (const listener of this.#listeners) listener(this.#state);
  }
}
