import { LitElement, css, html, type PropertyValues } from "lit";
import type { PageActions } from "../actions";
import type { CollectionSection, SectionCtx } from "../sections";
import type { Slice } from "../types";
import "./field-form.element";
import "./collection-list.element";
import { resolveListColumns, type CollectionRecordInfo } from "./collection-list.element";
import { primitiveStyles } from "./styles";

type Mode = "list" | "create" | "edit";

/**
 * `<meditor-collection>` — composes `<meditor-collection-list>` with a
 * create/edit form built from `<meditor-field-form>` verbatim (byte-identical
 * `.slice`/`.schema`/`.media`/`@change` wiring to `site-editor.element.ts`
 * lines 243-248 — see spec §3). CRUD routes entirely through the section's
 * own `PageActions` (`buildCollectionActions`, wave 0): list is server-fed via
 * `.records` (there is no client "read" action — same reload-driven data flow
 * pages-nav/site-editor already use), create = `createPage(title)`, save =
 * `saveDraft`+`publish` in one step (no author-facing two-step draft UX for a
 * data record — spec §3), delete = `deletePage`.
 *
 * `.records` is NOT one of the three spec-named properties (`.section`/
 * `.actions`/`.ctx`) but is required to render anything: `PageActions` has no
 * list/read method (only mutations — see actions.ts), so the row data must
 * come in as a property exactly like `<meditor-page-list>`'s `.pages`, fed by
 * whatever server-fetches it (a demo harness today; the Wave-3 shell's
 * catch-all route later — spec §4 "Data props … are server-fetched … and set
 * as properties too").
 */
export class MeditorCollection extends LitElement {
  static properties = {
    section: { attribute: false },
    actions: { attribute: false },
    ctx: { attribute: false },
    records: { attribute: false },
    _mode: { state: true },
    _selectedSlug: { state: true },
    _meta: { state: true },
    _newTitle: { state: true },
    _dirty: { state: true },
    _busy: { state: true },
    _status: { state: true },
  };

  declare section: CollectionSection;
  declare actions: PageActions;
  declare ctx: SectionCtx;
  declare records: CollectionRecordInfo[];
  declare _mode: Mode;
  declare _selectedSlug?: string;
  declare _meta: Record<string, unknown>;
  declare _newTitle: string;
  declare _dirty: boolean;
  declare _busy: boolean;
  declare _status: string;

  constructor() {
    super();
    this.records = [];
    this._mode = "list";
    this._meta = {};
    this._newTitle = "";
    this._dirty = false;
    this._busy = false;
    this._status = "";
  }

  static styles = [
    primitiveStyles,
    css`
      :host {
        display: flex;
        min-height: 0;
        height: 100%;
        flex-direction: column;
      }
      .list-wrap {
        flex: 1 1 auto;
        min-height: 0;
        overflow-y: auto;
      }
      header {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        border-bottom: 1px solid var(--scms-border);
        padding: 0.5rem 1rem;
      }
      .title {
        font-size: 0.875rem;
        font-weight: 600;
        color: var(--scms-fg);
      }
      .status {
        font-size: 0.75rem;
        color: var(--scms-muted-fg);
      }
      .row-actions {
        display: flex;
        margin-left: auto;
        align-items: center;
        gap: 0.5rem;
      }
      .body {
        flex: 1 1 0%;
        min-height: 0;
        overflow-y: auto;
      }
      .body-inner {
        margin: 0 auto;
        max-width: 42rem;
        padding: 1.5rem;
      }
      .create-row {
        display: flex;
        gap: 0.5rem;
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

  connectedCallback(): void {
    super.connectedCallback();
    this._syncTopBar();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.ctx?.setTopBarAction(null);
  }

  protected updated(changed: PropertyValues<this>): void {
    if (changed.has("_mode") || changed.has("section")) this._syncTopBar();
  }

  /** Contribute "+ New <Label>" to the shell's top bar (spec §1/§4) only while
   *  the list is showing — a section only reaches the top bar this way, it
   *  never renders its own chrome header for that action. */
  private _syncTopBar(): void {
    if (!this.ctx) return;
    if (this._mode === "list") this.ctx.setTopBarAction({ label: `New ${this.section.label}`, onClick: () => this._startCreate() });
    else this.ctx.setTopBarAction(null);
  }

  private get locale(): string | undefined {
    return this.ctx?.locale;
  }

  private _startCreate(): void {
    this._mode = "create";
    this._newTitle = "";
    this._status = "";
  }

  private _cancelCreate(): void {
    this._mode = "list";
  }

  private async _submitCreate(): Promise<void> {
    const value = this._newTitle.trim();
    if (!value) return;
    this._busy = true;
    this._status = "Creating…";
    try {
      const slug = await this.actions.createPage(value, this.locale);
      // createPage always seeds `meta.title`; correct it to the collection's
      // actual primary field (may not be "title", e.g. an Authors collection
      // keyed on "name") with a follow-up write — see class doc.
      const { primary } = resolveListColumns(this.section.schema, this.section.titleField);
      if (primary) {
        await this.actions.saveDraft(slug, { meta: { [primary]: value }, slices: [], body: "" }, undefined, this.locale);
        await this.actions.publish(slug, undefined, this.locale);
      }
      window.location.reload();
    } catch (e) {
      this._busy = false;
      this._status = `Create failed: ${e instanceof Error ? e.message : String(e)}`;
    }
  }

  private _openEdit(slug: string): void {
    const record = this.records.find((r) => r.slug === slug);
    if (!record) return;
    this._mode = "edit";
    this._selectedSlug = slug;
    this._meta = record.meta;
    this._dirty = false;
    this._status = "";
  }

  private _back(): void {
    if (this._dirty && !confirm("Discard unsaved changes?")) return;
    this._mode = "list";
    this._selectedSlug = undefined;
    this._status = "";
  }

  private _onFieldChange(e: CustomEvent<Slice>): void {
    const { slice: _drop, ...rest } = e.detail;
    void _drop;
    this._meta = rest;
    this._dirty = true;
    this._status = "";
  }

  private async _save(): Promise<void> {
    const slug = this._selectedSlug;
    if (!slug) return;
    this._busy = true;
    this._status = "Saving…";
    try {
      await this.actions.saveDraft(slug, { meta: this._meta, slices: [], body: "" }, undefined, this.locale);
      await this.actions.publish(slug, undefined, this.locale);
      window.location.reload();
    } catch (e) {
      this._busy = false;
      this._status = `Save failed: ${e instanceof Error ? e.message : String(e)}`;
    }
  }

  private async _delete(slug: string): Promise<void> {
    await this.actions.deletePage(slug);
    window.location.reload();
  }

  render() {
    if (this._mode === "create") return this._renderCreate();
    if (this._mode === "edit") return this._renderEdit();
    return html`
      <div class="list-wrap">
        <meditor-collection-list
          .records=${this.records}
          .schema=${this.section.schema}
          .titleField=${this.section.titleField}
          .columns=${this.section.columns}
          .onSelect=${(slug: string) => this._openEdit(slug)}
          .onDelete=${(slug: string) => this._delete(slug)}
        ></meditor-collection-list>
      </div>
    `;
  }

  private _renderCreate() {
    const { primary } = resolveListColumns(this.section.schema, this.section.titleField);
    return html`
      <header>
        <span class="title">New ${this.section.label}</span>
        <span class="status">${this._status}</span>
        <div class="row-actions">
          <button type="button" class="btn btn--ghost btn--sm" ?disabled=${this._busy} @click=${() => this._cancelCreate()}>Cancel</button>
        </div>
      </header>
      <div class="body">
        <div class="body-inner">
          <label class="sr-only" for="collection-new-title">${primary ?? "Title"}</label>
          <div class="create-row">
            <input
              id="collection-new-title"
              class="input"
              placeholder=${primary ?? "Title"}
              .value=${this._newTitle}
              ?disabled=${this._busy}
              @input=${(e: Event) => (this._newTitle = (e.target as HTMLInputElement).value)}
              @keydown=${(e: KeyboardEvent) => e.key === "Enter" && this._submitCreate()}
            />
            <button
              type="button"
              class="btn btn--default btn--sm"
              ?disabled=${this._busy || !this._newTitle.trim()}
              @click=${() => this._submitCreate()}
            >
              Create
            </button>
          </div>
        </div>
      </div>
    `;
  }

  private _renderEdit() {
    const asSlice: Slice = { slice: this.section.label, ...this._meta };
    return html`
      <header>
        <span class="title">${this.section.label}</span>
        <span class="status">${this._dirty ? "Unsaved changes" : this._status || "Up to date"}</span>
        <div class="row-actions">
          <button type="button" class="btn btn--ghost btn--sm" ?disabled=${this._busy} @click=${() => this._back()}>Back</button>
          <button type="button" class="btn btn--default btn--sm" ?disabled=${this._busy || !this._dirty} @click=${() => this._save()}>
            Save
          </button>
        </div>
      </header>
      <div class="body scroll-area">
        <div class="body-inner">
          <meditor-field-form
            .slice=${asSlice}
            .schema=${this.section.schema}
            .media=${this.ctx.media}
            .messages=${this.ctx.messages}
            @change=${(e: Event) => this._onFieldChange(e as CustomEvent<Slice>)}
          ></meditor-field-form>
        </div>
      </div>
    `;
  }
}

if (!customElements.get("meditor-collection")) {
  customElements.define("meditor-collection", MeditorCollection);
}

declare global {
  interface HTMLElementTagNameMap {
    "meditor-collection": MeditorCollection;
  }
}
