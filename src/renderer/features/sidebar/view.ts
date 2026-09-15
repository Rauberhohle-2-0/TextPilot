/**
 * The sidebar: every document, Finder-style.
 *
 * A left rail listing the user's documents - section header, one icon
 * row per document, the selected row highlighted like the Finder's
 * active item, and a new-document button under the section header. Rows
 * are rebuilt from the fetched list; there is no virtual DOM, just
 * `replaceChildren` and explicit state in the classes.
 */
import { createElement, icons } from "lucide";
import type { Component } from "../../core/component.ts";
import { h } from "../../core/dom.ts";
import type { DocumentMeta } from "../../../shared/documents.ts";
import { createDocument, listDocuments } from "./api.ts";

export interface SidebarOptions {
  /** Fired with the document id the user picked (or created). */
  onOpenDocument(id: string): void;
}

export function createSidebar({ onOpenDocument }: SidebarOptions): Component<HTMLElement> {
  let documents: DocumentMeta[] = [];
  /** The document currently shown in the editor, mirrored for selection. */
  let selectedId: string | null = null;

  const list = h("ul", { class: "sidebar-list", role: "list" });

  const newButton = h(
    "button",
    {
      type: "button",
      class: "sidebar-new-button",
      title: "New document",
      "aria-label": "New document",
    },
    createElement(icons.Plus),
    document.createTextNode("New Document"),
  );
  newButton.addEventListener("click", async () => {
    newButton.disabled = true;
    try {
      const created = await createDocument();
      documents = [created, ...documents];
      selectedId = created.id;
      renderList();
      onOpenDocument(created.id);
    } catch (error) {
      console.error("[sidebar]", error);
    } finally {
      newButton.disabled = false;
    }
  });

  const root = h(
    "nav",
    { class: "sidebar", "aria-label": "Documents" },
    // The band the traffic lights sit in: empty and draggable, so the
    // window moves from the sidebar exactly as it does from the title
    // bar over the editor.
    h("div", { class: "sidebar-drag-band", "data-vantail-drag": "", "aria-hidden": "true" }),
    h(
      "div",
      { class: "sidebar-section" },
      h("div", { class: "sidebar-header" }, h("span", { class: "sidebar-header-label" }, "Documents")),
      newButton,
      list,
    ),
  );

  function renderList(): void {
    const rows = documents.map((document) => {
      const row = h(
        "li",
        { class: "sidebar-item" },
        h(
          "button",
          {
            type: "button",
            class:
              "sidebar-row" + (document.id === selectedId ? " sidebar-row--selected" : ""),
            title: document.title,
            dataset: { documentId: document.id },
          },
          icon(),
          h("span", { class: "sidebar-row-title" }, document.title),
        ),
      );
      (row.querySelector("button") as HTMLButtonElement).addEventListener("click", () => {
        selectedId = document.id;
        renderList();
        onOpenDocument(document.id);
      });
      return row;
    });
    list.replaceChildren(...rows);
  }

  function icon(): Node {
    const node = createElement(icons.FileText);
    node.classList.add("sidebar-icon");
    return node;
  }

  /** The editor tells the sidebar which document is on screen. */
  function setSelected(id: string | null): void {
    selectedId = id;
    renderList();
  }

  void (async () => {
    try {
      documents = await listDocuments();
      renderList();
    } catch (error) {
      console.error("[sidebar]", error);
      // Leave the list empty; the header still tells the user where
      // they are, and a refresh will retry.
    }
  })();

  return {
    element: root,
    destroy() {
      // Nothing persistent yet: listeners live on the static nodes,
      // which die with the element.
    },
  };
}
