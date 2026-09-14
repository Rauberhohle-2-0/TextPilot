/**
 * The writable space: the whole window is one editor.
 *
 * A contenteditable surface, not a textarea, so it can grow into rich
 * text later without changing the shell. State lives in `EditorStore`;
 * this file only renders it and forwards input. Saves are debounced -
 * one request per typing pause, not one per keystroke.
 */
import { createElement, icons } from "lucide";
import type { Component } from "../../core/component.ts";
import { h } from "../../core/dom.ts";
import { loadNote, saveNote } from "./api.ts";
import { EditorStore } from "./store.ts";

const SAVE_DEBOUNCE_MS = 600;

export interface EditorOptions {
  /** Called with human-readable status text whenever it changes. */
  onStatus?(status: string): void;
}

export function createEditor({ onStatus = () => {} }: EditorOptions = {}): Component<HTMLDivElement> {
  const store = new EditorStore();

  const surface = h("div", {
    id: "writable-space",
    class: EDITOR_CLASS,
    contenteditable: true,
    spellcheck: false,
    "data-placeholder": "Start writing…",
    "aria-label": "Writable space",
  });

  const statusIcon = h("span", { class: "status-icon", "aria-hidden": "true" });
  const statusText = h("span", { class: "status-text" }, "Loading…");
  const statusBar = h(
    "footer",
    { class: "status-bar" },
    h("span", { class: "status-group" }, statusIcon, statusText),
  );

  const root = h("div", { class: "editor h-full w-full" }, surface, statusBar);

  const unsubscribe = store.subscribe(({ text, saving, loaded }) => {
    if (loaded && surface.textContent !== text) surface.textContent = text;
    renderStatus(statusIcon, statusText, saving, loaded);
  });

  surface.addEventListener("input", () => {
    store.set({ text: surface.textContent ?? "" });
    scheduleSave();
  });

  // Block paste-in of formatted HTML: the writable space is plain text.
  surface.addEventListener("paste", (event) => {
    event.preventDefault();
    const text = event.clipboardData?.getData("text/plain") ?? "";
    document.execCommand("insertText", false, text);
  });

  // Debounced persistence.
  let timer: ReturnType<typeof setTimeout> | undefined;
  function scheduleSave(): void {
    clearTimeout(timer);
    timer = setTimeout(() => void persist(), SAVE_DEBOUNCE_MS);
  }

  async function persist(): Promise<void> {
    store.set({ saving: true });
    try {
      await saveNote(store.state.text);
      onStatus("Saved");
    } catch (error) {
      onStatus("Save failed - will retry on next change");
      report(error);
    } finally {
      store.set({ saving: false });
    }
  }

  function report(error: unknown): void {
    console.error("[editor]", error);
  }

  void (async () => {
    try {
      const note = await loadNote();
      store.set({ text: note.text, loaded: true });
      onStatus("Ready");
    } catch (error) {
      store.set({ loaded: true });
      onStatus("Could not load your notes");
      report(error);
    }
  })();

  return {
    element: root,
    destroy() {
      clearTimeout(timer);
      unsubscribe();
    },
  };
}

function renderStatus(
  iconHost: HTMLElement,
  textHost: HTMLElement,
  saving: boolean,
  loaded: boolean,
): void {
  iconHost.replaceChildren(iconFor(saving, loaded));
  textHost.textContent = !loaded
    ? "Loading…"
    : saving
      ? "Saving…"
      : "All changes saved";
}

function iconFor(saving: boolean, loaded: boolean): Node {
  // lucide ships icon nodes plus `createElement`; the PascalCase names in
  // `icons` are the canonical ones.
  const node = createElement(!loaded || saving ? icons.LoaderCircle : icons.Check);
  node.classList.add("status-svg");
  if (!loaded || saving) node.classList.add("status-svg--spin");
  return node;
}

const EDITOR_CLASS = [
  "writable-space",
  "w-full",
  "h-full",
  "outline-none",
  "resize-none",
  "px-10",
  "py-8",
  "text-xl",
  "leading-relaxed",
  "whitespace-pre-wrap",
  "caret-[#b8926a]",
].join(" ");
