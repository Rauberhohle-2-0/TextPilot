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
import { insertMarkdown } from "./markdown-insert.ts";
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
  /** The markdown-source textarea; format buttons edit it in source mode. */
  source: HTMLTextAreaElement;
  /** Fired after a format changed the document; the view autosaves. */
  onChange(): void;
  /** Fired when the user toggles markdown-source mode. */
  onToggleSource(): void;
  /** True while the markdown source is on screen. */
  isSourceMode(): boolean;
}

export function createToolbar({
  target,
  source,
  onChange,
  onToggleSource,
  isSourceMode,
}: ToolbarOptions): Component<HTMLElement> & {
  setSourceMode(active: boolean): void;
} {
  const buttons = new Map<string, HTMLButtonElement>();

  // Group 1: block text formats (headings, body). Group 2: everything
  // else - quote, code block, inline emphasis and lists. The split is
  // by id, not by shape: a filter on "has a value" would catch the
  // blockquote/pre commands too and render them twice.
  const BLOCK_GROUP_IDS = new Set(["h1", "h2", "h3", "paragraph"]);
  const groups = [
    FORMAT_ACTIONS.filter((action) => BLOCK_GROUP_IDS.has(action.id)),
    FORMAT_ACTIONS.filter((action) => isListOrInline(action)),
  ];

  const element = h(
    "div",
    { class: "toolbar", role: "toolbar", "aria-label": "Formatting" },
    ...groups.flatMap((actions, index) => {
      const group = h(
        "div",
        { class: "toolbar-group", role: "group" },
        ...actions.map((action) => buildButton(action)),
      );
      return index < groups.length - 1
        ? [group, h("span", { class: "toolbar-separator" })]
        : [group];
    }),
    h("span", { class: "toolbar-separator" }),
    buildSourceToggle(),
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
      if (isSourceMode()) {
        // Source mode: edit the markdown text directly. The textarea
        // regains focus so typing continues where the edit happened.
        insertMarkdown(source, action);
        source.focus();
        onChange();
        return;
      }
      applyFormat(action);
      onChange();
      reflect();
    });
    buttons.set(action.id, button);
    return button;
  }

  function isListOrInline(action: FormatAction): boolean {
    // The list ids (`bullet`, `number`) do not share a suffix, so they
    // are named explicitly - a suffix check is how they once fell out
    // of the toolbar silently.
    return action.kind === "inline" ||
      action.id === "bullet" || action.id === "number" ||
      action.id === "blockquote" || action.id === "code";
  }

  function pascal(icon: string): string {
    return icon.split("-").map((part) => part[0]!.toUpperCase() + part.slice(1)).join("");
  }

  function buildSourceToggle(): HTMLButtonElement {
    const button = h("button", {
      type: "button",
      class: "toolbar-button",
      title: "Toggle markdown source (⌘/)",
      "aria-label": "Toggle markdown source",
      "aria-pressed": "false",
    });
    button.append(createElement(icons.FileCode));
    button.addEventListener("mousedown", (event) => {
      event.preventDefault();
      onToggleSource();
    });
    return button;
  }

  /**
   * Source mode keeps the format buttons enabled - they now edit the
   * markdown text directly. Only the reflect loop pauses (browser
   * format state is meaningless for raw markdown), and the toggle
   * lights up so the mode is visible at a glance.
   */
  function setSourceMode(active: boolean): void {
    const toggle = element.querySelector<HTMLButtonElement>("[aria-pressed]");
    if (toggle) {
      toggle.setAttribute("aria-pressed", String(active));
      toggle.classList.toggle("toolbar-button--active", active);
    }
    if (active) {
      for (const button of buttons.values()) {
        button.classList.remove("toolbar-button--active");
      }
    }
  }

  function reflect(): void {
    if (element.querySelector("[aria-pressed]")?.getAttribute("aria-pressed") === "true") return;
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
    setSourceMode,
    destroy() {
      document.removeEventListener("selectionchange", reflect);
    },
  };
}
