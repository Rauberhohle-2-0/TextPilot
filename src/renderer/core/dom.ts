/**
 * A typed element factory.
 *
 * The one place the UI touches `document.createElement`. Keeping it here
 * means markup stays declarative - a view reads like the tree it builds -
 * while every node is typed and event wiring is explicit, not stringly.
 *
 * `h(tag, props, ...children)` - props may include attributes, `dataset`,
 * and `on: <event>` handlers, so listeners are scoped to creation and can
 * never leak across re-renders. Children may also be components, whose
 * elements are appended directly.
 */
import type { Component } from "./component.ts";

export type Child =
  | Node
  | string
  | null
  | undefined
  | false
  | Component<HTMLElement>;

export interface ElementProps {
  id?: string;
  class?: string;
  type?: string;
  placeholder?: string;
  spellcheck?: boolean;
  contenteditable?: boolean;
  autofocus?: boolean;
  [attribute: string]: unknown;
}

export function h<Tag extends keyof HTMLElementTagNameMap>(
  tag: Tag,
  props: ElementProps = {},
  ...children: Child[]
): HTMLElementTagNameMap[Tag] {
  const element = document.createElement(tag);
  applyProps(element, props);
  for (const child of children) appendChild(element, child);
  return element;
}

function applyProps(element: HTMLElement, props: ElementProps): void {
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined || value === false) continue;
    if (key === "class") {
      element.className = String(value);
    } else if (key === "dataset") {
      for (const [name, data] of Object.entries(value as Record<string, string>)) {
        element.dataset[camel(name)] = data;
      }
    } else if (key.startsWith("on:")) {
      element.addEventListener(key.slice(3), value as EventListener);
    } else {
      element.setAttribute(key, String(value));
    }
  }
}

function appendChild(parent: HTMLElement, child: Child): void {
  if (child === null || child === undefined || child === false) return;
  if (typeof child === "object" && "element" in child) {
    parent.append(child.element);
    return;
  }
  parent.append(child instanceof Node ? child : document.createTextNode(child));
}

function camel(name: string): string {
  return name.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());
}
