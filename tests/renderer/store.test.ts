import { describe, expect, test } from "bun:test";
import { EditorStore } from "../../src/renderer/features/editor/store.ts";

describe("editor store", () => {
  test("starts empty and unloaded", () => {
    const store = new EditorStore();
    expect(store.state).toEqual({ html: "", saving: false, loaded: false });
  });

  test("notifies subscribers of patches and on subscribe", () => {
    const store = new EditorStore();
    const seen: string[] = [];

    const unsubscribe = store.subscribe((state) => seen.push(state.html));
    store.set({ html: "<p>first</p>" });
    store.set({ html: "<p>second</p>" });
    unsubscribe();
    store.set({ html: "<p>third</p>" });

    expect(seen).toEqual(["", "<p>first</p>", "<p>second</p>"]);
  });

  test("patches merge without losing unspecified fields", () => {
    const store = new EditorStore();
    store.set({ html: "<p>kept</p>" });
    store.set({ saving: true });
    expect(store.state).toEqual({ html: "<p>kept</p>", saving: true, loaded: false });
  });
});
