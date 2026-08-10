import { LitElement, html, css, nothing } from "lit";
import type { MediaAsset } from "../types";
import { primitiveStyles } from "./styles";
import "./media-grid.element";
import type { MediaGridMode } from "./media-grid.element";

/** What FieldForm needs to wire up the media picker — a thin view over the
 *  host's Server Actions + upload route. Absent → `<meditor-image-picker>`
 *  degrades to a plain text input with no "Browse library" button. */
export type FieldFormMedia = {
  list: () => Promise<MediaAsset[]>;
  delete: (id: string) => Promise<void>;
  uploadPath: string; // e.g. "/editor/media/upload"
};

/**
 * Lit port of `ImagePickerField` (see spec §1). A single image-valued field:
 * thumbnail, editable path input (keeps the "it's just a string" escape
 * hatch for external URLs), and — when `media` is configured — a "Browse
 * library" button opening a native `<dialog>` picker. Native `<dialog>` +
 * `.showModal()` gets focus trap/ESC/backdrop from the platform for free,
 * and works from inside Shadow DOM (spec fact #5).
 *
 * Fires `change` (detail: string url, bubbles/composed) on every commit.
 */
export class MeditorImagePicker extends LitElement {
  static properties = {
    value: { type: String },
    media: { attribute: false },
    _assets: { state: true },
    _query: { state: true },
    _busy: { state: true },
  };

  declare value: string;
  declare media?: FieldFormMedia;
  declare _assets: MediaAsset[];
  declare _query: string;
  declare _busy: boolean;

  constructor() {
    super();
    this.value = "";
    this._assets = [];
    this._query = "";
    this._busy = false;
  }

  static styles = [
    primitiveStyles,
    css`
      :host {
        display: block;
      }
      .wrap {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
      }
      .thumb {
        height: 5rem;
        width: auto;
        border-radius: 0.375rem;
        border: 1px solid var(--scms-border);
        object-fit: cover;
      }
      .row {
        display: flex;
        gap: 0.5rem;
      }
      .row .input {
        flex: 1 1 auto;
      }
      dialog {
        width: min(90vw, 720px);
        border-radius: 0.5rem;
        border: 1px solid var(--scms-border);
        background: var(--scms-bg);
        color: var(--scms-fg);
        padding: 1rem;
      }
      dialog::backdrop {
        background: rgb(0 0 0 / 0.5);
      }
      .dialog-footer {
        margin-top: 0.75rem;
        display: flex;
        justify-content: flex-end;
      }
    `,
  ];

  private get _dialog(): HTMLDialogElement | null {
    return this.renderRoot.querySelector("dialog");
  }

  private _emitChange(url: string) {
    this.value = url;
    this.dispatchEvent(new CustomEvent<string>("change", { detail: url, bubbles: true, composed: true }));
  }

  private async _openLibrary() {
    if (!this.media) return;
    this._assets = await this.media.list();
    this._dialog?.showModal();
  }

  private async _upload(files: FileList) {
    if (!this.media) return;
    this._busy = true;
    try {
      // Sequential — avoids the fs adapter's random-suffix writes racing each
      // other for no benefit (ported verbatim from image-picker-field.tsx).
      for (const file of Array.from(files)) {
        const body = new FormData();
        body.append("file", file);
        await fetch(this.media.uploadPath, { method: "POST", body });
      }
      this._assets = await this.media.list();
    } finally {
      this._busy = false;
    }
  }

  render() {
    const filtered = this._assets.filter((a) => a.name.toLowerCase().includes(this._query.toLowerCase()));
    const mode: MediaGridMode = "picker";
    return html`
      <div class="wrap">
        ${this.value ? html`<img class="thumb" src=${this.value} alt="" loading="lazy" />` : nothing}
        <div class="row">
          <input
            class="input"
            .value=${this.value}
            placeholder="/img/…"
            @input=${(e: Event) => this._emitChange((e.target as HTMLInputElement).value)}
          />
          ${this.media
            ? html`
                <button type="button" class="btn btn--outline btn--sm" @click=${() => this._openLibrary()}>
                  Browse library
                </button>
              `
            : nothing}
          ${this.value
            ? html`
                <button type="button" class="btn btn--ghost btn--sm" @click=${() => this._emitChange("")}>
                  Clear
                </button>
              `
            : nothing}
        </div>

        ${this.media
          ? html`
              <dialog>
                <meditor-media-grid
                  .assets=${filtered}
                  mode=${mode}
                  .query=${this._query}
                  .busy=${this._busy}
                  @querychange=${(e: CustomEvent<string>) => (this._query = e.detail)}
                  @selectasset=${(e: CustomEvent<MediaAsset>) => {
                    this._emitChange(e.detail.url);
                    this._dialog?.close();
                  }}
                  @uploadfiles=${(e: CustomEvent<FileList>) => this._upload(e.detail)}
                ></meditor-media-grid>
                <div class="dialog-footer">
                  <button type="button" class="btn btn--ghost btn--sm" @click=${() => this._dialog?.close()}>
                    Close
                  </button>
                </div>
              </dialog>
            `
          : nothing}
      </div>
    `;
  }
}

if (!customElements.get("meditor-image-picker")) {
  customElements.define("meditor-image-picker", MeditorImagePicker);
}

declare global {
  interface HTMLElementTagNameMap {
    "meditor-image-picker": MeditorImagePicker;
  }
}
