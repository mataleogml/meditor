import { LitElement, css, html } from "lit";
import type { Messages } from "../i18n";
import type { Slice } from "../types";
import { icon, iconChevronDown, iconChevronUp, iconCopy, iconGripVertical, iconTrash2 } from "./icons";
import { primitiveStyles } from "./styles";

/**
 * Lit port of `BlockList` (block-list.tsx) — reorderable slice list: native
 * drag-drop + keyboard-accessible up/down (the Move-up/Move-down buttons —
 * already keyboard-reachable, drag-drop is the pointer-only path), plus
 * add/duplicate/delete/select. Pure UI — all state changes go up as events,
 * mirroring the current "all state changes go up" contract (BlockList's own
 * doc comment).
 *
 * `messages` is accepted for interface parity with the other leaf elements
 * (a shell can wire `.messages` uniformly to every child) but currently
 * unused: block-list's strings are hard-coded English today, same as React —
 * the rewrite must not silently expand or shrink i18n coverage (spec §9).
 */
export class MeditorBlockList extends LitElement {
  static properties = {
    slices: { attribute: false },
    selectedIndex: { type: Number },
    sliceNames: { attribute: false },
    messages: { attribute: false },
    _dragIndex: { state: true },
  };

  declare slices: Slice[];
  declare selectedIndex: number;
  declare sliceNames: string[];
  declare messages?: Partial<Messages>;
  declare _dragIndex: number | null;

  constructor() {
    super();
    this.slices = [];
    this.selectedIndex = 0;
    this.sliceNames = [];
    this._dragIndex = null;
  }

  static styles = [
    primitiveStyles,
    css`
      :host {
        display: flex;
        flex: 1 1 auto;
        min-height: 0;
        flex-direction: column;
      }
      .header {
        display: flex;
        flex-shrink: 0;
        align-items: center;
        justify-content: space-between;
        gap: 0.5rem;
        border-bottom: 1px solid var(--scms-border);
        padding: 0.5rem 0.75rem;
      }
      .section-label {
        font-size: 0.75rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.025em;
        color: var(--scms-muted-fg);
      }
      .sr-only {
        position: absolute;
        width: 1px;
        height: 1px;
        padding: 0;
        margin: -1px;
        overflow: hidden;
        clip: rect(0, 0, 0, 0);
        white-space: nowrap;
        border: 0;
      }
      .select {
        width: 9rem;
      }
      ol {
        flex: 1 1 auto;
        overflow-y: auto;
        padding: 0.5rem;
        list-style: none;
        margin: 0;
      }
      .row {
        display: flex;
        align-items: center;
        gap: 0.125rem;
        margin-bottom: 0.25rem;
        border-radius: 0.375rem;
        border: 1px solid transparent;
        padding: 0.375rem;
        transition:
          background-color 0.15s,
          border-color 0.15s,
          opacity 0.15s;
      }
      .row:hover {
        background: var(--scms-muted);
      }
      .row.selected {
        border-color: var(--scms-ring);
        background: var(--scms-muted);
      }
      .row.dragging {
        opacity: 0.4;
      }
      .grip {
        flex-shrink: 0;
        cursor: grab;
        color: var(--scms-muted-fg);
      }
      .grip svg {
        width: 1rem;
        height: 1rem;
      }
      .select-btn {
        display: block;
        min-width: 0;
        flex: 1 1 auto;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        text-align: left;
        font: inherit;
        font-size: 0.875rem;
        color: var(--scms-fg);
        background: none;
        border: none;
        padding: 0;
        cursor: pointer;
      }
      .select-btn .name {
        font-weight: 500;
      }
      .select-btn .heading {
        margin-left: 0.25rem;
        color: var(--scms-muted-fg);
      }
      .empty {
        padding: 1rem 0.5rem;
        text-align: center;
        font-size: 0.875rem;
        color: var(--scms-muted-fg);
      }
    `,
  ];

  private onAddChange(e: Event) {
    const select = e.target as HTMLSelectElement;
    if (select.value) {
      this.dispatchEvent(new CustomEvent("add", { detail: select.value, bubbles: true, composed: true }));
    }
    select.value = "";
  }

  private select(i: number) {
    this.dispatchEvent(new CustomEvent("select", { detail: i, bubbles: true, composed: true }));
  }

  private reorder(from: number, to: number) {
    this.dispatchEvent(new CustomEvent("reorder", { detail: { from, to }, bubbles: true, composed: true }));
  }

  private duplicate(i: number) {
    this.dispatchEvent(new CustomEvent("duplicate", { detail: i, bubbles: true, composed: true }));
  }

  private _remove(i: number) {
    this.dispatchEvent(new CustomEvent("delete", { detail: i, bubbles: true, composed: true }));
  }

  private onDragStart(i: number) {
    this._dragIndex = i;
  }

  private onDragOver(e: DragEvent) {
    e.preventDefault();
  }

  private onDrop(i: number) {
    if (this._dragIndex !== null && this._dragIndex !== i) this.reorder(this._dragIndex, i);
    this._dragIndex = null;
  }

  private onDragEnd() {
    this._dragIndex = null;
  }

  render() {
    return html`
      <div class="header">
        <span class="section-label">Blocks</span>
        <label class="sr-only" for="block-list-add">Add block</label>
        <select id="block-list-add" class="select" .value=${""} @change=${this.onAddChange}>
          <option value="">+ Add block…</option>
          ${this.sliceNames.map((n) => html`<option value=${n}>${n}</option>`)}
        </select>
      </div>

      <ol>
        ${this.slices.map((s, i) => {
            const selected = i === this.selectedIndex;
            return html`
              <li
                class="row ${selected ? "selected" : ""} ${this._dragIndex === i ? "dragging" : ""}"
                draggable="true"
                @dragstart=${() => this.onDragStart(i)}
                @dragover=${this.onDragOver}
                @drop=${() => this.onDrop(i)}
                @dragend=${this.onDragEnd}
              >
                <span class="grip" aria-hidden="true">${icon(iconGripVertical)}</span>
                <button type="button" class="select-btn" @click=${() => this.select(i)}>
                  <span class="name">${s.slice}</span>
                  ${typeof s.heading === "string"
                    ? html`<span class="heading">— ${s.heading.replaceAll("**", "")}</span>`
                    : ""}
                </button>
                <button
                  type="button"
                  class="btn btn--ghost btn--icon"
                  ?disabled=${i === 0}
                  aria-label="Move up"
                  @click=${() => this.reorder(i, i - 1)}
                >
                  ${icon(iconChevronUp)}
                </button>
                <button
                  type="button"
                  class="btn btn--ghost btn--icon"
                  ?disabled=${i === this.slices.length - 1}
                  aria-label="Move down"
                  @click=${() => this.reorder(i, i + 1)}
                >
                  ${icon(iconChevronDown)}
                </button>
                <button type="button" class="btn btn--ghost btn--icon" aria-label="Duplicate" @click=${() => this.duplicate(i)}>
                  ${icon(iconCopy)}
                </button>
                <button
                  type="button"
                  class="btn btn--ghost-destructive btn--icon btn--sm"
                  aria-label="Delete"
                  @click=${() => this._remove(i)}
                >
                  ${icon(iconTrash2)}
                </button>
              </li>
            `;
        })}
        ${this.slices.length === 0 ? html`<li class="empty">No blocks yet — add one above.</li>` : ""}
      </ol>
    `;
  }
}

if (!customElements.get("meditor-block-list")) {
  customElements.define("meditor-block-list", MeditorBlockList);
}

declare global {
  interface HTMLElementTagNameMap {
    "meditor-block-list": MeditorBlockList;
  }
}
