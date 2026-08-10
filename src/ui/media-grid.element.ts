import { LitElement, html, css } from "lit";
import type { MediaAsset } from "../types";
import { primitiveStyles } from "./styles";
import { icon, iconCopy, iconImageOff, iconSearch, iconTrash2, iconUpload } from "./icons";
import { humanSize } from "./slice-ops";

export type MediaGridMode = "library" | "picker";

/**
 * Lit port of `MediaGrid`+`Thumb` (see spec §1). Shared presentational grid
 * used both standalone (media library page) and inside the picker dialog.
 * `assets` is expected pre-filtered by the caller — this component only
 * displays `query`/dispatches `querychange`, it doesn't filter itself.
 *
 * Events (all `bubbles: true, composed: true`): `querychange` (detail:
 * string), `selectasset` (detail: MediaAsset, picker mode), `deleteasset`
 * (detail: string id, library mode), `uploadfiles` (detail: FileList, both).
 */
export class MeditorMediaGrid extends LitElement {
  static properties = {
    assets: { attribute: false },
    mode: { type: String },
    query: { type: String },
    busy: { type: Boolean },
  };

  declare assets: MediaAsset[];
  declare mode: MediaGridMode;
  declare query: string;
  declare busy: boolean;

  constructor() {
    super();
    this.assets = [];
    this.mode = "library";
    this.query = "";
    this.busy = false;
  }

  static styles = [
    primitiveStyles,
    css`
      :host {
        display: block;
      }
      .toolbar {
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }
      .search-wrap {
        position: relative;
        flex: 1 1 auto;
      }
      .search-wrap svg {
        position: absolute;
        left: 0.5rem;
        top: 50%;
        translate: 0 -50%;
        width: 1rem;
        height: 1rem;
        color: var(--scms-muted-fg);
        pointer-events: none;
      }
      .search-wrap .input {
        padding-left: 2rem;
      }
      .visually-hidden {
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
      .hidden-input {
        display: none;
      }
      .empty {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.5rem;
        padding: 2.5rem 0;
        font-size: 0.875rem;
        color: var(--scms-muted-fg);
      }
      .empty svg {
        width: 1.5rem;
        height: 1.5rem;
      }
      .grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 0.75rem;
        list-style: none;
        margin: 0.75rem 0 0;
        padding: 0;
      }
      @media (min-width: 640px) {
        .grid {
          grid-template-columns: repeat(4, 1fr);
        }
      }
      .card {
        overflow: hidden;
        border-radius: 0.375rem;
        border: 1px solid var(--scms-border);
      }
      .card-btn {
        display: block;
        width: 100%;
        overflow: hidden;
        border-radius: 0.375rem;
        border: 1px solid var(--scms-border);
        background: none;
        padding: 0;
        text-align: left;
        cursor: pointer;
      }
      .card-btn:hover {
        border-color: var(--scms-ring);
      }
      .thumb-img {
        aspect-ratio: 1 / 1;
        width: 100%;
        object-fit: cover;
        display: block;
      }
      .thumb-name {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        padding: 0.25rem 0.375rem;
        font-size: 0.75rem;
        color: var(--scms-fg);
      }
      .thumb-size {
        padding: 0 0.375rem 0.25rem;
        font-size: 0.625rem;
        color: var(--scms-muted-fg);
      }
      .card-actions {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.25rem;
        padding: 0.25rem 0.375rem;
      }
    `,
  ];

  private get _fileInput(): HTMLInputElement | null {
    return this.renderRoot.querySelector("#media-upload-input");
  }

  private _emitQuery(q: string) {
    this.dispatchEvent(new CustomEvent<string>("querychange", { detail: q, bubbles: true, composed: true }));
  }

  private _emitSelect(asset: MediaAsset) {
    this.dispatchEvent(new CustomEvent<MediaAsset>("selectasset", { detail: asset, bubbles: true, composed: true }));
  }

  private _emitDelete(id: string) {
    this.dispatchEvent(new CustomEvent<string>("deleteasset", { detail: id, bubbles: true, composed: true }));
  }

  private _emitUpload(files: FileList) {
    this.dispatchEvent(new CustomEvent<FileList>("uploadfiles", { detail: files, bubbles: true, composed: true }));
  }

  private _onDrop = (e: DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer?.files.length) this._emitUpload(e.dataTransfer.files);
  };

  private _onFileInput = (e: Event) => {
    const input = e.target as HTMLInputElement;
    if (input.files?.length) this._emitUpload(input.files);
    input.value = "";
  };

  render() {
    return html`
      <div @dragover=${(e: DragEvent) => e.preventDefault()} @drop=${this._onDrop}>
        <div class="toolbar">
          <div class="search-wrap">
            ${icon(iconSearch)}
            <input
              class="input"
              placeholder="Search media…"
              .value=${this.query}
              @input=${(e: Event) => this._emitQuery((e.target as HTMLInputElement).value)}
            />
          </div>
          <label class="visually-hidden" for="media-upload-input">Upload images</label>
          <input
            id="media-upload-input"
            type="file"
            multiple
            class="hidden-input"
            accept="image/png,image/jpeg,image/gif,image/webp,image/avif,image/svg+xml"
            @change=${this._onFileInput}
          />
          <button
            type="button"
            class="btn btn--outline btn--sm"
            ?disabled=${this.busy}
            @click=${() => this._fileInput?.click()}
          >
            ${icon(iconUpload)} Upload
          </button>
        </div>

        ${this.assets.length === 0
          ? html`<div class="empty">${icon(iconImageOff)}Drop images here, or use Upload.</div>`
          : html`
              <ul class="grid">
                ${this.assets.map((a) => html`<li>${this._renderCard(a)}</li>`)}
              </ul>
            `}
      </div>
    `;
  }

  private _renderCard(a: MediaAsset) {
    if (this.mode === "picker") {
      return html`
        <button type="button" class="card-btn" @click=${() => this._emitSelect(a)}>${this._thumb(a)}</button>
      `;
    }
    return html`
      <div class="card">
        ${this._thumb(a)}
        <div class="card-actions">
          <button
            type="button"
            class="btn btn--ghost btn--icon"
            aria-label="Copy ${a.name} URL"
            @click=${() => navigator.clipboard.writeText(a.url)}
          >
            ${icon(iconCopy)}
          </button>
          <button
            type="button"
            class="btn btn--ghost-destructive btn--icon btn--sm"
            aria-label="Delete ${a.name}"
            @click=${() => this._emitDelete(a.id)}
          >
            ${icon(iconTrash2)}
          </button>
        </div>
      </div>
    `;
  }

  private _thumb(a: MediaAsset) {
    return html`
      <img class="thumb-img" src=${a.url} alt=${a.name} loading="lazy" />
      <div class="thumb-name">${a.name}</div>
      <div class="thumb-size">${humanSize(a.size)}</div>
    `;
  }
}

if (!customElements.get("meditor-media-grid")) {
  customElements.define("meditor-media-grid", MeditorMediaGrid);
}

declare global {
  interface HTMLElementTagNameMap {
    "meditor-media-grid": MeditorMediaGrid;
  }
}
