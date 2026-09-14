import { describe, expect, test } from "bun:test";
import { EditorStore } from "../../src/renderer/features/editor/store.ts";

describe("editor store", () => {
  test("starts empty and unloaded", () => {
    const store = new EditorStore();
    expect(store.state).toEqual({ markdown: "", saving: false, loaded: false });
  });

  test("notifies subscribers of patches and on subscribe", () => {
    const store = new EditorStore();
    const seen: string[] = [];

    const unsubscribe = store.subscribe((state) => seen.push(state.markdown));
    store.set({ markdown: "# first" });
    store.set({ markdown: "## second" });
    unsubscribe();
    store.set({ markdown: "### third" });

    expect(seen).toEqual(["", "# first", "## second"]);
  });

  test("patches merge without losing unspecified fields", () => {
    const store = new EditorStore();
    store.set({ markdown: "kept" });
    store.set({ saving: true });
    expect(store.state).toEqual({ markdown: "kept", saving: true, loaded: false });
  });
});
