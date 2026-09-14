/**
 * The formatting toolbar.
 *
 * Built from `FORMAT_ACTIONS`, one button each, grouped into block and
 * inline formats. On every selection change inside the document it asks
 * the browser which formats are active and lights the buttons up - the
 * toolbar reads state rather than tracking it, so it cannot drift.
 *
 * Buttons are `mousedown` + `preventDefault`: clicking must not steal the
 * selection from the document, or the format would apply to nothing.
 */
import { createElement, icons } from "lucide";
import type { Component } from "../../core/component.ts";
import { h } from "../../core/dom.ts";
import {
  FORMAT_ACTIONS,
  STATE_COMMANDS,
  activeBlockTag,
  applyFormat,
  isFormatActive,
} from "./formatting.ts";
import type { FormatAction } from "./formatting.ts";

export interface ToolbarOptions {
  /** The contenteditable the formats apply to. */
  target: HTMLElement;
  /** Fired after a format changed the document; the view autosaves. */
  onChange(): void;
}

export function createToolbar({ target, onChange }: ToolbarOptions): Component<HTMLElement> {
  const buttons = new Map<string, HTMLButtonElement>();

  const groups = [
    FORMAT_ACTIONS.filter((action) => action.value !== undefined || action.id === "paragraph"),
    FORMAT_ACTIONS.filter((action) => isListOrInline(action)),
  ];

  const element = h(
    "div",
    { class: "toolbar", role: "toolbar", "aria-label": "Formatting" },
    ...groups.map((actions, index) => {
      const group = h(
        "div",
        { class: "toolbar-group", role: "group" },
        ...actions.map((action) => buildButton(action)),
      );
      return index < groups.length - 1
        ? [group, h("span", { class: "toolbar-separator" })] as unknown as Node
        : group;
    }),
  );

  function buildButton(action: FormatAction): HTMLButtonElement {
    const button = h("button", {
      type: "button",
      class: "toolbar-button",
      title: action.shortcut ? `${action.title} (${action.shortcut})` : action.title,
      "aria-label": action.title,
      "data-format": action.id,
    });
    button.append(createElement(icons[pascal(action.icon) as keyof typeof icons]));
    // mousedown, not click: a click would move focus and drop the
    // selection before the command runs.
    button.addEventListener("mousedown", (event) => {
      event.preventDefault();
      applyFormat(action);
      onChange();
      reflect();
    });
    buttons.set(action.id, button);
    return button;
  }

  function isListOrInline(action: FormatAction): boolean {
    return action.kind === "inline" || action.id.endsWith("list") ||
      action.id === "blockquote" || action.id === "code";
  }

  function pascal(icon: string): string {
    return icon.split("-").map((part) => part[0]!.toUpperCase() + part.slice(1)).join("");
  }

  function reflect(): void {
    for (const action of FORMAT_ACTIONS) {
      const button = buttons.get(action.id);
      if (!button) continue;
      const active = action.value
        ? activeBlockTag() === action.value
        : STATE_COMMANDS.includes(action.command as (typeof STATE_COMMANDS)[number]) &&
          isFormatActive(action);
      button.classList.toggle("toolbar-button--active", active);
    }
  }

  document.addEventListener("selectionchange", reflect);

  return {
    element,
    destroy() {
      document.removeEventListener("selectionchange", reflect);
    },
  };
}
