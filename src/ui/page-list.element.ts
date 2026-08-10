import { LitElement, css, html, nothing } from "lit";
import type { PageInfo } from "../types";
import { icon, iconPencilLine } from "./icons";
import { primitiveStyles } from "./styles";

/**
 * Lit port of `PageList` (page-list.tsx) — the editor landing-route page
 * picker. Presentational (no state, no events): a titled list of pages, each a
 * link to its editor route with a `/slug` mono label and a "draft" pill when
 * the page has unpublished changes.
 */
export class MeditorPageList extends LitElement {
  static properties = {
    pages: { attribute: false },
    basePath: { type: String },
  };

  declare pages: PageInfo[];
  declare basePath: string;

  constructor() {
    super();
    this.pages = [];
    this.basePath = "/editor";
  }

  static styles = [
    primitiveStyles,
    css`
      :host {
        display: block;
      }
      .wrap {
        margin: 0 auto;
        max-width: 48rem;
        padding: 2rem;
      }
      h1 {
        margin: 0 0 0.25rem;
        font-size: 1.5rem;
        font-weight: 600;
        color: var(--scms-fg);
      }
      .blurb {
        margin: 0 0 1.5rem;
        font-size: 0.875rem;
        color: var(--scms-muted-fg);
      }
      ul {
        list-style: none;
        margin: 0;
        padding: 0;
        overflow: hidden;
        border-radius: 0.5rem;
        border: 1px solid var(--scms-border);
      }
      li + li {
        border-top: 1px solid var(--scms-border);
      }
      a {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        padding: 0.75rem 1rem;
        text-decoration: none;
        transition: background-color 0.15s;
      }
      a:hover {
        background: var(--scms-muted);
      }
      .title {
        font-weight: 500;
        color: var(--scms-fg);
      }
      .slug {
        font-family: ui-monospace, monospace;
        font-size: 0.75rem;
        color: var(--scms-muted-fg);
      }
      .pill {
        display: inline-flex;
        align-items: center;
        gap: 0.25rem;
        margin-left: auto;
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
    `,
  ];

  render() {
    return html`
      <div class="wrap">
        <h1>Pages</h1>
        <p class="blurb">Choose a page to edit its blocks.</p>
        <ul>
          ${this.pages.map(
            (p) => html`
              <li>
                <a href="${this.basePath}/${p.slug}">
                  <span class="title">${p.title}</span>
                  <span class="slug">/${p.slug}</span>
                  ${p.hasDraft ? html`<span class="pill">${icon(iconPencilLine)} draft</span>` : nothing}
                </a>
              </li>
            `
          )}
        </ul>
      </div>
    `;
  }
}

if (typeof customElements !== "undefined" && !customElements.get("meditor-page-list")) {
  customElements.define("meditor-page-list", MeditorPageList);
}

declare global {
  interface HTMLElementTagNameMap {
    "meditor-page-list": MeditorPageList;
  }
}
