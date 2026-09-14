/**
 * Composition root of the UI.
 *
 * Knows the features and mounts them. Anything cross-cutting - here the
 * shared status line - is wired here rather than hidden inside a feature,
 * so features stay independent and the shell stays boring.
 */
import type { Component } from "./core/index.ts";
import { createEditor } from "./features/editor/index.ts";
import "./styles/main.css";

function mount(component: Component, parent: HTMLElement): void {
  parent.append(component.element);
}

export function boot(root: HTMLElement = document.body): void {
  const features: Component[] = [];

  const editor = createEditor();
  features.push(editor);

  mount(editor, root);

  window.addEventListener("beforeunload", () => {
    for (const feature of features) feature.destroy?.();
  });
}
