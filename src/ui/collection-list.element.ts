import { LitElement, css, html, nothing } from "lit";
import type { SliceSchema } from "../types";
import { icon, iconPencilLine, iconTrash2 } from "./icons";
import { primitiveStyles } from "./styles";

// Canonical definition moved to ../types (server-safe code, e.g. collection.ts's
// listCollectionRecords, needs it and must not pull in this module's `lit`
// import + `customElements.define` side effect). Re-exported here so existing
// importers of this file are unaffected.
export type { CollectionRecordInfo } from "../types";
import type { CollectionRecordInfo } from "../types";

/** "titleField" -> "Title Field"; "photo_url" -> "Photo Url". */
function titleCase(key: string): string {
  return key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/^./, (c) => c.toUpperCase())
    .trim();
}

/**
 * Resolve the list's primary (clickable, always-rendered) column and the
 * extra data columns — pure so it's testable without mounting the element.
 * Spec §3 defaults: primary = `titleField`, else "title" if present in the
 * schema, else the first schema key; extra columns = the explicit `columns`
 * list, else the first 4 schema keys (primary excluded from "extra" — it
 * gets its own always-present column so a record stays clickable even for an
 * empty/unusual schema).
 */
export function resolveListColumns(
  schema: SliceSchema,
  titleField?: string,
  columns?: string[]
): { primary: string | undefined; extra: string[] } {
  const keys = Object.keys(schema);
  const primary = titleField ?? (keys.includes("title") ? "title" : keys[0]);
  const base = columns?.length ? columns : keys.slice(0, 4);
  return { primary, extra: base.filter((k) => k !== primary) };
}

function cellText(meta: Record<string, unknown>, key: string): string {
  const v = meta[key];
  if (v === null || v === undefined) return "";
  if (typeof v === "object") return "src" in (v as object) ? String((v as { src?: unknown }).src ?? "") : JSON.stringify(v);
  return String(v);
}

/**
 * Lit structural copy of `page-list.element.ts`, generalized to a collection
 * record's arbitrary schema instead of a fixed page title (see spec §3) —
 * deliberately NOT a shared abstraction with page-list. Presentational: rows
 * in, `onSelect`/`onDelete` callbacks out.
 */
export class MeditorCollectionList extends LitElement {
  static properties = {
    records: { attribute: false },
    schema: { attribute: false },
    titleField: { type: String },
    columns: { attribute: false },
    onSelect: { attribute: false },
    onDelete: { attribute: false },
    _pending: { state: true },
  };

  declare records: CollectionRecordInfo[];
  declare schema: SliceSchema;
  declare titleField?: string;
  declare columns?: string[];
  declare onSelect?: (slug: string) => void;
  declare onDelete?: (slug: string) => Promise<void>;
  declare _pending: boolean;

  constructor() {
    super();
    this.records = [];
    this.schema = {};
    this._pending = false;
  }

  static styles = [
    primitiveStyles,
    css`
      :host {
        display: block;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        font-size: 0.875rem;
      }
      thead th {
        padding: 0.5rem 0.75rem;
        text-align: left;
        font-size: 0.75rem;
        font-weight: 600;
        color: var(--scms-muted-fg);
        border-bottom: 1px solid var(--scms-border);
      }
      tbody td {
        padding: 0.5rem 0.75rem;
        border-bottom: 1px solid var(--scms-border);
        color: var(--scms-fg);
        vertical-align: middle;
      }
      tbody tr:hover {
        background: var(--scms-muted);
      }
      .primary-cell {
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }
      .link {
        border: none;
        background: none;
        padding: 0;
        margin: 0;
        font: inherit;
        font-weight: 500;
        color: var(--scms-fg);
        cursor: pointer;
        text-align: left;
      }
      .link:hover {
        text-decoration: underline;
      }
      .pill {
        display: inline-flex;
        flex-shrink: 0;
        align-items: center;
        gap: 0.25rem;
        border-radius: 9999px;
        border: 1px solid var(--scms-border);
        padding: 0.125rem 0.5rem;
        font-size: 0.75rem;
        font-weight: 500;
        color: var(--scms-muted-fg);
      }
      .pill svg {
        width: 0.75rem;
        height: 0.75rem;
      }
      .actions-col {
        width: 2.5rem;
      }
      .delete-btn {
        border: none;
        background: none;
        border-radius: 0.25rem;
        padding: 0.25rem;
        color: var(--scms-muted-fg);
        cursor: pointer;
      }
      .delete-btn:hover {
        background: var(--scms-muted);
        color: var(--scms-destructive);
      }
      .delete-btn:disabled {
        pointer-events: none;
        opacity: 0.5;
      }
      .delete-btn svg {
        width: 0.875rem;
        height: 0.875rem;
      }
      .empty {
        padding: 2rem;
        text-align: center;
        font-size: 0.875rem;
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
    `,
  ];

  private async _remove(slug: string) {
    if (!this.onDelete || !confirm(`Delete "${slug}"? This cannot be undone.`)) return;
    this._pending = true;
    try {
      await this.onDelete(slug);
    } finally {
      this._pending = false;
    }
  }

  render() {
    if (this.records.length === 0) return html`<div class="empty">No records yet.</div>`;
    const { primary, extra } = resolveListColumns(this.schema, this.titleField, this.columns);

    return html`
      <table>
        <thead>
          <tr>
            <th>${primary ? titleCase(primary) : "Record"}</th>
            ${extra.map((c) => html`<th>${titleCase(c)}</th>`)}
            <th class="actions-col"><span class="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          ${this.records.map(
            (r) => html`
              <tr>
                <td>
                  <div class="primary-cell">
                    <button type="button" class="link" @click=${() => this.onSelect?.(r.slug)}>
                      ${primary ? cellText(r.meta, primary) || r.slug : r.slug}
                    </button>
                    ${r.hasDraft ? html`<span class="pill">${icon(iconPencilLine)} draft</span>` : nothing}
                    ${r.locale ? html`<span class="pill">${r.locale}</span>` : nothing}
                  </div>
                </td>
                ${extra.map((c) => html`<td>${cellText(r.meta, c)}</td>`)}
                <td class="actions-col">
                  <button
                    type="button"
                    class="delete-btn"
                    aria-label="Delete ${r.slug}"
                    ?disabled=${this._pending}
                    @click=${() => this._remove(r.slug)}
                  >
                    ${icon(iconTrash2)}
                  </button>
                </td>
              </tr>
            `
          )}
        </tbody>
      </table>
    `;
  }
}

if (!customElements.get("meditor-collection-list")) {
  customElements.define("meditor-collection-list", MeditorCollectionList);
}

declare global {
  interface HTMLElementTagNameMap {
    "meditor-collection-list": MeditorCollectionList;
  }
}
