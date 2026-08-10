import { LitElement, css, html, nothing } from "lit";
import type { Messages } from "../i18n";
import type { MediaAsset, PageInfo } from "../types";
import { createT } from "./i18n-strings";
import "./media-grid.element";
import "./pages-nav.element";
import { overlayStyles, primitiveStyles } from "./styles";

export type MediaLibraryMedia = {
  list: () => Promise<MediaAsset[]>;
  delete: (id: string) => Promise<void>;
};

/**
 * Lit port of `MediaLibrary` (media-library.tsx) — standalone full-page media
 * library, parallel to `<meditor-site-editor>`'s shape: same `<meditor-pages-
 * nav>` left rail + fixed-full-screen-overlay shell as the page/site editors,
 * `currentSlug="media"` so nothing in the page list highlights.
 *
 * `onCreate`/`onDelete` are wired straight to `<meditor-pages-nav>` as
 * function properties (its own create/delete + `location.href` navigation —
 * see pages-nav.element.ts), exactly like React's
 * `onCreate={actions.createPage} onDelete={actions.deletePage}`.
 */
export class MeditorMediaLibrary extends LitElement {
  static properties = {
    pages: { attribute: false },
    media: { attribute: false },
    hideNav: { type: Boolean },
    uploadPath: { type: String },
    onCreate: { attribute: false },
    onDelete: { attribute: false },
    messages: { attribute: false },
    _assets: { state: true },
    _query: { state: true },
    _busy: { state: true },
    _status: { state: true },
  };

  declare pages: PageInfo[];
  declare media: MediaLibraryMedia;
  /** Suppress this element's own `<meditor-pages-nav>`, same contract as
   *  `<meditor-editor hideNav>`: a host shell that already paints a left rail
   *  would otherwise stack a second one at the same x. Default false, so
   *  standalone consumers are byte-identical. */
  declare hideNav: boolean;
  declare uploadPath: string;
  declare onCreate?: (title: string) => Promise<string>;
  declare onDelete?: (slug: string) => Promise<void>;
  declare messages?: Partial<Messages>;
  declare _assets: MediaAsset[];
  declare _query: string;
  declare _busy: boolean;
  declare _status: string;

  constructor() {
    super();
    this.pages = [];
    this.hideNav = false;
    this.uploadPath = "";
    this._assets = [];
    this._query = "";
    this._busy = false;
    this._status = "";
  }

  static styles = [
    primitiveStyles,
    overlayStyles,
    css`
      .main {
        display: flex;
        min-width: 0;
        flex: 1 1 auto;
        flex-direction: column;
      }
      header {
        display: flex;
        flex-shrink: 0;
        align-items: center;
        gap: 0.75rem;
        border-bottom: 1px solid var(--scms-border);
        padding: 0.5rem 1rem;
      }
      .title {
        font-size: 0.875rem;
        font-weight: 600;
      }
      .status {
        font-size: 0.75rem;
        color: var(--scms-muted-fg);
      }
      .body {
        min-height: 0;
        flex: 1 1 auto;
        overflow-y: auto;
        padding: 1rem;
      }
    `,
  ];

  connectedCallback(): void {
    super.connectedCallback();
    // Mount-only fetch — `media` is a stable Server Action reference for the
    // lifetime of this element (ported from media-library.tsx's mount effect).
    void this.media?.list().then((assets) => (this._assets = assets));
  }

  private async _upload(files: FileList) {
    const t = createT(this.messages);
    this._busy = true;
    this._status = t("media.uploading");
    let failedError = "";
    // Sequential — avoids the fs adapter's random-suffix writes racing each
    // other for no benefit.
    for (const file of Array.from(files)) {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch(this.uploadPath, { method: "POST", body });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        failedError = err?.error ?? res.statusText;
      }
    }
    this._assets = await this.media.list();
    this._status = failedError ? t("media.uploadFailed", { error: failedError }) : "";
    this._busy = false;
  }

  private async _remove(id: string) {
    this._assets = this._assets.filter((a) => a.id !== id); // optimistic
    try {
      await this.media.delete(id);
    } catch {
      this._assets = await this.media.list(); // roll back on failure
    }
  }

  render() {
    const t = createT(this.messages);
    const filtered = this._assets.filter((a) => a.name.toLowerCase().includes(this._query.toLowerCase()));
    return html`
      ${this.hideNav
        ? nothing
        : html`
            <meditor-pages-nav
              .pages=${this.pages}
              currentSlug="media"
              .onCreate=${this.onCreate}
              .onDelete=${this.onDelete}
              .messages=${this.messages}
            ></meditor-pages-nav>
          `}
      <div class="main">
        <header>
          <span class="title">${t("media.title")}</span>
          <span class="status">${this._status}</span>
        </header>
        <div class="body">
          <meditor-media-grid
            .assets=${filtered}
            mode="library"
            .query=${this._query}
            .busy=${this._busy}
            @querychange=${(e: CustomEvent<string>) => (this._query = e.detail)}
            @deleteasset=${(e: CustomEvent<string>) => this._remove(e.detail)}
            @uploadfiles=${(e: CustomEvent<FileList>) => this._upload(e.detail)}
          ></meditor-media-grid>
        </div>
      </div>
    `;
  }
}

if (!customElements.get("meditor-media-library")) {
  customElements.define("meditor-media-library", MeditorMediaLibrary);
}

declare global {
  interface HTMLElementTagNameMap {
    "meditor-media-library": MeditorMediaLibrary;
  }
}
