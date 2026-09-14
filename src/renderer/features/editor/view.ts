/**
 * The writable space: the whole window is one rich-text document.
 *
 * A contenteditable surface over `EditorStore`. The document is HTML -
 * headings, emphasis, lists survive save and load - and the toolbar
 * writes formats straight into it via `execCommand`. Saves are debounced:
 * one request per typing pause, not one per keystroke.
 */
import { createElement, icons } from "lucide";
import type { Component } from "../../core/component.ts";
import { h } from "../../core/dom.ts";
import { loadNote, saveNote } from "./api.ts";
import { createToolbar } from "./toolbar.ts";
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
    "aria-label": "Document",
  });

  const toolbar = createToolbar({
    target: surface,
    onChange: () => {
      store.set({ html: surface.innerHTML });
      scheduleSave();
    },
  });

  const statusIcon = h("span", { class: "status-icon", "aria-hidden": "true" });
  const statusText = h("span", { class: "status-text" }, "Loading…");
  const statusBar = h(
    "footer",
    { class: "status-bar" },
    h("span", { class: "status-group" }, statusIcon, statusText),
  );

  const root = h(
    "div",
    { class: "editor flex flex-col h-full w-full" },
    toolbar,
    surface,
    statusBar,
  );

  const unsubscribe = store.subscribe(({ html, saving, loaded }) => {
    // Only overwrite the DOM when the change came from the network, not
    // from typing - rewriting innerHTML mid-keystroke would drop the
    // caret.
    if (loaded && surface.innerHTML !== html) surface.innerHTML = html;
    renderStatus(statusIcon, statusText, saving, loaded);
  });

  surface.addEventListener("input", () => {
    store.set({ html: surface.innerHTML });
    scheduleSave();
  });

  let timer: ReturnType<typeof setTimeout> | undefined;
  function scheduleSave(): void {
    clearTimeout(timer);
    timer = setTimeout(() => void persist(), SAVE_DEBOUNCE_MS);
  }

  async function persist(): Promise<void> {
    store.set({ saving: true });
    try {
      await saveNote(store.state.html);
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
      store.set({ html: note.text, loaded: true });
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
      toolbar.destroy?.();
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
  const node = createElement(!loaded || saving ? icons.LoaderCircle : icons.Check);
  node.classList.add("status-svg");
  if (!loaded || saving) node.classList.add("status-svg--spin");
  return node;
}

const EDITOR_CLASS = [
  "writable-space",
  "flex-1",
  "min-h-0",
  "overflow-y-auto",
  "outline-none",
  "px-10",
  "py-8",
  "whitespace-pre-wrap",
  "caret-[#b8926a]",
].join(" ");
