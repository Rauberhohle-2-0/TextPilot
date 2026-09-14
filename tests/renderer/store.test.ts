import { describe, expect, test } from "bun:test";
import { EditorStore } from "../../src/renderer/features/editor/store.ts";

describe("editor store", () => {
  test("starts empty and unloaded", () => {
    const store = new EditorStore();
    expect(store.state).toEqual({ text: "", saving: false, loaded: false });
  });

  test("notifies subscribers of patches and on subscribe", () => {
    const store = new EditorStore();
    const seen: string[] = [];

    const unsubscribe = store.subscribe((state) => seen.push(state.text));
    store.set({ text: "first" });
    store.set({ text: "second" });
    unsubscribe();
    store.set({ text: "third" });

    expect(seen).toEqual(["", "first", "second"]);
  });

  test("patches merge without losing unspecified fields", () => {
    const store = new EditorStore();
    store.set({ text: "kept" });
    store.set({ saving: true });
    expect(store.state).toEqual({ text: "kept", saving: true, loaded: false });
  });
});
