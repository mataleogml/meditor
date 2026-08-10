import { LitElement, css, html, type PropertyValues } from "lit";
import type { Messages } from "../i18n";
import type { PageInfo } from "../types";
import { createT } from "./i18n-strings";
import { icon, iconFileText, iconImage, iconPlus, iconSettings, iconTrash2 } from "./icons";
import { primitiveStyles } from "./styles";

/**
 * Lit port of `PagesNav` (pages-nav.tsx) — the left navigation: page list
 * (+new/delete), locale dots, footer links. A block outline (`<meditor-block-
 * list>`) is passed as light-DOM slotted content, exactly like React's
 * `children`.
 *
 * `onCreate`/`onDelete` are kept as function properties (not attributes) —
 * PagesNav is also used standalone on the editor landing route (no shell
 * above it, see `templates/init.ts`), so it must own the async create/delete
 * call + the resulting `location.href` navigation itself, not just emit an
 * event a parent shell would have to complete. `create`/`deletepage`
 * `CustomEvent`s are dispatched too (composed+bubbles) for any shell that
 * wants to observe them — navigation does not depend on a listener.
 */
export class MeditorPagesNav extends LitElement {
  static properties = {
    pages: { attribute: false },
    currentSlug: { type: String },
    basePath: { type: String },
    locale: { type: String },
    defaultLocale: { type: String },
    allLocales: { attribute: false },
    messages: { attribute: false },
    onCreate: { attribute: false },
    onDelete: { attribute: false },
    _adding: { state: true },
    _title: { state: true },
    _pending: { state: true },
    _hasSlotted: { state: true },
  };

  declare pages: PageInfo[];
  declare currentSlug?: string;
  declare basePath: string;
  declare locale?: string;
  declare defaultLocale?: string;
  declare allLocales: string[];
  declare messages?: Partial<Messages>;
  declare onCreate?: (title: string) => Promise<string>;
  declare onDelete?: (slug: string) => Promise<void>;
  declare _adding: boolean;
  declare _title: string;
  declare _pending: boolean;
  declare _hasSlotted: boolean;

  constructor() {
    super();
    this.pages = [];
    this.basePath = "/editor";
    this.allLocales = [];
    this._adding = false;
    this._title = "";
    this._pending = false;
    this._hasSlotted = false;
  }

  static styles = [
    primitiveStyles,
    css`
      :host {
        display: contents;
      }
      nav {
        display: flex;
        height: 100%;
        width: 15rem;
        flex-shrink: 0;
        flex-direction: column;
        border-right: 1px solid var(--scms-border);
        background: var(--scms-bg);
      }
      .brand {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.75rem 1rem;
        font-size: 0.875rem;
        font-weight: 600;
        color: var(--scms-fg);
      }
      .brand-badge {
        display: grid;
        place-items: center;
        width: 1.25rem;
        height: 1.25rem;
        border-radius: 0.25rem;
        background: var(--scms-primary);
        color: var(--scms-primary-fg);
        font-size: 0.625rem;
        font-weight: 700;
      }
      .pages-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0.5rem 0.75rem 0.25rem;
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
      .add-row {
        display: flex;
        gap: 0.25rem;
        padding: 0 0.75rem 0.5rem;
      }
      .add-row .input {
        height: 2rem;
      }
      ul {
        display: flex;
        flex-direction: column;
        gap: 0.125rem;
        overflow-y: auto;
        padding: 0 0.5rem;
        list-style: none;
        margin: 0;
      }
      ul.with-outline {
        max-height: 34vh;
        flex-shrink: 0;
      }
      ul.no-outline {
        flex: 1 1 auto;
      }
      .row {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        border-radius: 0.375rem;
        padding: 0.375rem 0.5rem;
        font-size: 0.875rem;
        color: var(--scms-muted-fg);
      }
      .row:hover,
      .row.active {
        background: var(--scms-muted);
        color: var(--scms-fg);
      }
      .row-icon {
        flex-shrink: 0;
        opacity: 0.7;
      }
      .row-icon svg {
        width: 1rem;
        height: 1rem;
      }
      .row a {
        min-width: 0;
        flex: 1 1 auto;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        color: inherit;
        text-decoration: none;
      }
      .locale-dots {
        display: flex;
        flex-shrink: 0;
        align-items: center;
        gap: 0.125rem;
      }
      .dot {
        width: 0.375rem;
        height: 0.375rem;
        border-radius: 9999px;
        background: var(--scms-border);
      }
      .dot.filled {
        background: var(--scms-primary);
      }
      .delete-btn {
        flex-shrink: 0;
        border: none;
        background: none;
        border-radius: 0.25rem;
        padding: 0.125rem;
        color: var(--scms-muted-fg);
        opacity: 0;
        transition: opacity 0.15s;
        cursor: pointer;
      }
      .delete-btn svg {
        width: 0.875rem;
        height: 0.875rem;
      }
      .row:hover .delete-btn {
        opacity: 1;
      }
      .delete-btn:hover {
        color: var(--scms-destructive);
      }
      .delete-btn:disabled {
        pointer-events: none;
        opacity: 0.5;
      }
      .outline-wrap {
        display: flex;
        min-height: 0;
        flex: 1 1 auto;
        flex-direction: column;
        border-top: 1px solid var(--scms-border);
      }
      .outline-wrap.empty {
        display: none;
      }
      ::slotted(*) {
        min-height: 0;
        flex: 1 1 auto;
      }
      footer {
        border-top: 1px solid var(--scms-border);
        padding: 0.5rem;
      }
      .footer-link {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        border-radius: 0.375rem;
        padding: 0.375rem 0.5rem;
        font-size: 0.875rem;
        color: var(--scms-muted-fg);
        text-decoration: none;
      }
      .footer-link:hover,
      .footer-link.active {
        background: var(--scms-muted);
        color: var(--scms-fg);
      }
      .footer-link svg {
        width: 1rem;
        height: 1rem;
      }
    `,
  ];

  private get t() {
    return createT(this.messages);
  }

  private get multiLocale() {
    return this.allLocales.length > 1;
  }

  private get q() {
    return this.locale && this.defaultLocale && this.locale !== this.defaultLocale ? `?locale=${this.locale}` : "";
  }

  private href(slug: string) {
    return `${this.basePath}/${slug}${this.q}`;
  }

  private onSlotChange(e: Event) {
    const slot = e.target as HTMLSlotElement;
    this._hasSlotted = slot.assignedNodes({ flatten: true }).length > 0;
  }

  private toggleAdding() {
    this._adding = !this._adding;
  }

  private onTitleInput(e: Event) {
    this._title = (e.target as HTMLInputElement).value;
  }

  private onTitleKeydown(e: KeyboardEvent) {
    if (e.key === "Enter") this.create();
    if (e.key === "Escape") this._adding = false;
  }

  private async create() {
    const nm = this._title.trim();
    if (!nm || !this.onCreate) return;
    this._pending = true;
    const slug = await this.onCreate(nm);
    this.dispatchEvent(new CustomEvent("create", { detail: nm, bubbles: true, composed: true }));
    window.location.href = `${this.basePath}/${slug}`;
  }

  private async _remove(slug: string) {
    if (!confirm(this.t("nav.confirmDelete", { slug })) || !this.onDelete) return;
    this._pending = true;
    await this.onDelete(slug);
    this.dispatchEvent(new CustomEvent("deletepage", { detail: slug, bubbles: true, composed: true }));
    window.location.href = this.basePath;
  }

  protected updated(changed: PropertyValues): void {
    // Autofocus the add-row input the moment it appears (React `autoFocus`).
    if (changed.has("_adding") && this._adding) {
      this.renderRoot.querySelector<HTMLInputElement>(".add-row input")?.focus();
    }
  }

  render() {
    const t = this.t;
    return html`
      <nav>
        <div class="brand">
          <span class="brand-badge">M</span>
          ${t("nav.brand")}
        </div>

        <div class="pages-row">
          <span class="section-label">${t("nav.pages")}</span>
          <button
            type="button"
            class="btn btn--ghost btn--icon"
            aria-label=${t("nav.newPage")}
            ?disabled=${this._pending}
            @click=${this.toggleAdding}
          >
            ${icon(iconPlus)}
          </button>
        </div>

        ${this._adding
          ? html`
              <div class="add-row">
                <label class="sr-only" for="pages-nav-add-title">${t("nav.pageName")}</label>
                <input
                  id="pages-nav-add-title"
                  class="input"
                  placeholder=${t("nav.pageName")}
                  .value=${this._title}
                  @input=${this.onTitleInput}
                  @keydown=${this.onTitleKeydown}
                />
                <button
                  type="button"
                  class="btn btn--default btn--sm"
                  ?disabled=${this._pending || !this._title.trim()}
                  @click=${this.create}
                >
                  ${t("nav.add")}
                </button>
              </div>
            `
          : ""}

        <ul class=${this._hasSlotted ? "with-outline" : "no-outline"}>
          ${this.pages.map((p) => {
            const active = p.slug === this.currentSlug;
            return html`
              <li>
                <div class="row ${active ? "active" : ""}">
                  <span class="row-icon">${icon(iconFileText)}</span>
                  <a href=${this.href(p.slug)}>${p.title}</a>
                  ${this.multiLocale
                    ? html`
                        <span class="locale-dots" title=${p.locales.join(", ")}>
                          ${this.allLocales.map(
                            (l) => html`<span class="dot ${p.locales.includes(l) ? "filled" : ""}"></span>`
                          )}
                        </span>
                      `
                    : p.hasDraft
                      ? html`<span class="dot filled" title="Has draft"></span>`
                      : ""}
                  <button
                    type="button"
                    class="delete-btn"
                    aria-label=${t("nav.deletePage", { slug: p.slug })}
                    ?disabled=${this._pending}
                    @click=${() => this._remove(p.slug)}
                  >
                    ${icon(iconTrash2)}
                  </button>
                </div>
              </li>
            `;
          })}
        </ul>

        <div class="outline-wrap ${this._hasSlotted ? "" : "empty"}">
          <slot @slotchange=${this.onSlotChange}></slot>
        </div>

        <footer>
          <a class="footer-link ${this.currentSlug === "media" ? "active" : ""}" href="${this.basePath}/media${this.q}">
            ${icon(iconImage)} ${t("nav.mediaLibrary")}
          </a>
          <a class="footer-link ${this.currentSlug === "site" ? "active" : ""}" href="${this.basePath}/site${this.q}">
            ${icon(iconSettings)} ${t("nav.siteSettings")}
          </a>
        </footer>
      </nav>
    `;
  }
}

if (!customElements.get("meditor-pages-nav")) {
  customElements.define("meditor-pages-nav", MeditorPagesNav);
}

declare global {
  interface HTMLElementTagNameMap {
    "meditor-pages-nav": MeditorPagesNav;
  }
}
