import { LitElement, html, css } from "lit";
import type { PageActions } from "../actions";
import type { Messages } from "../i18n";
import type { PageInfo, Slice } from "../types";
import "./field-form.element";
import "./pages-nav.element";
import type { FieldFormMedia } from "./image-picker-field.element";
import { defaultMessages } from "./messages";
import { overlayStyles, primitiveStyles } from "./styles";

/**
 * Site-wide settings editor (nav, CTA, footer — the non-page `site` document).
 * Ported from `site-editor.tsx` (`SiteEditor`) — see spec §1. Same overlay
 * chrome as the page editor, but no version/conflict logic (writes with
 * `baseVersion=undefined`, matching the React original).
 */
export class MeditorSiteEditor extends LitElement {
  static properties = {
    pages: { attribute: false },
    initialMeta: { attribute: false },
    actions: { attribute: false },
    media: { attribute: false },
    locale: { type: String },
    locales: { attribute: false },
    defaultLocale: { type: String },
    translatedLocales: { attribute: false },
    messages: { attribute: false },
    _meta: { state: true },
    _dirty: { state: true },
    _busy: { state: true },
    _status: { state: true },
  };

  static styles = [
    primitiveStyles,
    overlayStyles,
    css`
      :host {
        min-width: 0;
      }
      .col {
        display: flex;
        min-width: 0;
        flex: 1 1 0%;
        flex-direction: column;
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
      }
      .status {
        font-size: 0.75rem;
        color: var(--scms-muted-fg);
      }
      .actions {
        display: flex;
        margin-left: auto;
        align-items: center;
        gap: 0.5rem;
      }
      .select {
        width: auto;
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
      .blurb {
        margin-bottom: 1rem;
        font-size: 0.875rem;
        color: var(--scms-muted-fg);
      }
    `,
  ];

  declare pages: PageInfo[];
  declare initialMeta: Record<string, unknown>;
  declare actions: PageActions;
  declare media?: FieldFormMedia;
  declare locale?: string;
  declare locales?: string[];
  declare defaultLocale?: string;
  declare translatedLocales?: string[];
  declare messages?: Partial<Messages>;
  declare _meta: Record<string, unknown>;
  declare _dirty: boolean;
  declare _busy: boolean;
  declare _status: string;

  constructor() {
    super();
    this.pages = [];
    this.initialMeta = {};
    this._meta = {};
    this._dirty = false;
    this._busy = false;
    this._status = "";
  }

  connectedCallback(): void {
    super.connectedCallback();
    this._meta = this.initialMeta;
  }

  private t(key: string, vars?: Record<string, string | number>): string {
    let s = this.messages?.[key] ?? defaultMessages[key] ?? key;
    if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
    return s;
  }

  private get resolvedLocales(): string[] {
    return this.locales ?? [this.locale ?? "en"];
  }

  private get resolvedDefaultLocale(): string {
    return this.defaultLocale ?? this.resolvedLocales[0];
  }

  private get resolvedTranslatedLocales(): string[] {
    return this.translatedLocales ?? this.resolvedLocales;
  }

  private get activeLocale(): string {
    return this.locale ?? this.resolvedDefaultLocale;
  }

  private async run(label: string, fn: () => Promise<void>, reload = false): Promise<void> {
    this._busy = true;
    this._status = `${label}…`;
    try {
      await fn();
      if (reload) window.location.reload();
      else this._status = `${label} ✓`;
    } catch (e) {
      this._status = `${label} failed: ${e instanceof Error ? e.message : String(e)}`;
    } finally {
      this._busy = false;
    }
  }

  private save(): void {
    void this.run(this.t("shell.draftSaved"), async () => {
      await this.actions.saveDraft("site", { meta: this._meta, slices: [], body: "" }, undefined, this.activeLocale);
      this._dirty = false;
    });
  }

  private publish(): void {
    void this.run(
      this.t("shell.publish"),
      async () => {
        await this.actions.saveDraft("site", { meta: this._meta, slices: [], body: "" }, undefined, this.activeLocale);
        await this.actions.publish("site", undefined, this.activeLocale);
      },
      true
    );
  }

  private discard(): void {
    if (!confirm(this.t("site.confirmDiscard"))) return;
    void this.run(this.t("shell.discardDraft"), () => this.actions.discardDraft("site", this.activeLocale), true);
  }

  private switchLocale(next: string): void {
    if (next === this.activeLocale) return;
    const url = new URL(window.location.href);
    url.searchParams.set("locale", next);
    window.location.href = url.toString();
  }

  private onFieldChange(e: CustomEvent<Slice>): void {
    const { slice: _drop, ...rest } = e.detail;
    void _drop;
    this._meta = rest;
    this._dirty = true;
    this._status = "";
  }

  render() {
    const locales = this.resolvedLocales;
    const defaultLocale = this.resolvedDefaultLocale;
    const translatedLocales = this.resolvedTranslatedLocales;
    const asSlice: Slice = { slice: this.t("site.title"), ...this._meta };

    return html`
      <meditor-pages-nav
        .pages=${this.pages}
        .currentSlug=${"site"}
        .locale=${this.activeLocale}
        .defaultLocale=${defaultLocale}
        .allLocales=${locales}
        .messages=${this.messages}
        .onCreate=${this.actions.createPage}
        .onDelete=${this.actions.deletePage}
      ></meditor-pages-nav>
      <div class="col">
        <header>
          <span class="title">${this.t("site.title")}</span>
          <span class="status">${this._dirty ? this.t("shell.unsaved") : this._status || this.t("shell.upToDate")}</span>
          <div class="actions">
            ${locales.length > 1
              ? html`
                  <!-- \`.selected\` per option, not \`.value\` on the <select> —
                       see field-form.element.ts for why. -->
                  <select
                    class="select"
                    aria-label=${this.t("shell.locale")}
                    ?disabled=${this._busy}
                    @change=${(e: Event) => this.switchLocale((e.target as HTMLSelectElement).value)}
                  >
                    ${locales.map(
                      (l) => html`<option value=${l} .selected=${l === this.activeLocale}>
                        ${l}${translatedLocales.includes(l) ? "" : ` — ${this.t("shell.translate")}`}
                      </option>`
                    )}
                  </select>
                `
              : null}
            <button type="button" class="btn btn--ghost btn--sm" ?disabled=${this._busy} @click=${() => this.discard()}>
              ${this.t("shell.discardDraft")}
            </button>
            <button type="button" class="btn btn--secondary btn--sm" ?disabled=${this._busy || !this._dirty} @click=${() => this.save()}>
              ${this.t("shell.saveDraft")}
            </button>
            <button type="button" class="btn btn--default btn--sm" ?disabled=${this._busy} @click=${() => this.publish()}>
              ${this.t("shell.publish")}
            </button>
          </div>
        </header>
        <div class="body scroll-area">
          <div class="body-inner">
            <p class="blurb">${this.t("site.blurb")}</p>
            <meditor-field-form
              .slice=${asSlice}
              .media=${this.media}
              .messages=${this.messages}
              @change=${(e: Event) => this.onFieldChange(e as CustomEvent<Slice>)}
            ></meditor-field-form>
          </div>
        </div>
      </div>
    `;
  }
}

customElements.define("meditor-site-editor", MeditorSiteEditor);

declare global {
  interface HTMLElementTagNameMap {
    "meditor-site-editor": MeditorSiteEditor;
  }
}
