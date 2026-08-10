import { LitElement, css, html, nothing, type PropertyValues, type TemplateResult } from "lit";
import { keyed } from "lit/directives/keyed.js";
import type { PageActions } from "../actions";
import type { Messages } from "../i18n";
import type { PageContent, PageInfo, Slice, SliceSchema } from "../types";
import { AutosaveController, PreviewLinkController, readDarkTheme, writeDarkTheme } from "./controllers";
import "./block-list.element";
import "./device-preview.element";
import type { MeditorDevicePreview } from "./device-preview.element";
import "./field-form.element";
import "./pages-nav.element";
import { createT } from "./i18n-strings";
import { icon, iconLanguages, iconMoon, iconSun, iconTriangleAlert } from "./icons";
import type { FieldFormMedia } from "./image-picker-field.element";
import { addSlice, duplicate, mapEditToField, remove, reorder, updateSelected } from "./slice-ops";
import { overlayStyles, primitiveStyles } from "./styles";

/**
 * Lit port of `EditorShell` (editor-shell.tsx) — the primary `<meditor-editor>`
 * shell: dynamic left nav (pages + this page's block outline), a device-
 * switchable live-preview center, and a right property panel. Edits autosave
 * to the draft and refresh the preview; Publish promotes it, Discard drops it.
 * Blocks are also click-selectable on the canvas via the preview bridge.
 *
 * State that was `useState`/`useRef` in React is reactive state here; the two
 * tangled bridge/autosave `useEffect`s are the `AutosaveController` +
 * `PreviewLinkController` (see controllers.ts), and the pure slice-array logic
 * lives in slice-ops.ts. All draft/publish/preview mutations target the active
 * locale; switching to an untranslated locale seeds a draft translation.
 *
 * Inputs are set as JS **properties** (objects/functions), never attributes —
 * the WC contract. Until every required prop is present the element renders
 * nothing, so partial property-setting before the host has supplied everything
 * can't crash (ports wc.tsx's REQUIRED gate).
 */
export class MeditorEditor extends LitElement {
  static properties = {
    slug: { type: String },
    pages: { attribute: false },
    initialPage: { attribute: false },
    initialVersion: { attribute: false },
    sliceNames: { attribute: false },
    defaults: { attribute: false },
    fieldSchema: { attribute: false },
    previewPath: { type: String },
    actions: { attribute: false },
    hideNav: { type: Boolean },
    media: { attribute: false },
    locale: { type: String },
    locales: { attribute: false },
    defaultLocale: { type: String },
    translatedLocales: { attribute: false },
    isFallback: { type: Boolean },
    messages: { attribute: false },
    _page: { state: true },
    _selected: { state: true },
    _dirty: { state: true },
    _busy: { state: true },
    _status: { state: true },
    _version: { state: true },
    _conflict: { state: true },
    _previewV: { state: true },
    _switching: { state: true },
    _dark: { state: true },
  };

  declare slug: string;
  declare pages: PageInfo[];
  declare initialPage: PageContent;
  declare initialVersion: string | null;
  declare sliceNames: string[];
  declare defaults: Record<string, Record<string, unknown>>;
  declare fieldSchema?: Record<string, SliceSchema>;
  declare previewPath: string;
  declare actions: PageActions;
  /** Suppress this element's own `<meditor-pages-nav>` (left page tree) — set
   *  by a host shell that already renders its own left rail, so Pages doesn't
   *  double up. Default false: standalone consumers are byte-identical. */
  declare hideNav: boolean;
  declare media?: FieldFormMedia;
  declare locale?: string;
  declare locales?: string[];
  declare defaultLocale?: string;
  declare translatedLocales?: string[];
  declare isFallback: boolean;
  declare messages?: Partial<Messages>;
  declare _page: PageContent;
  declare _selected: number;
  declare _dirty: boolean;
  declare _busy: boolean;
  declare _status: string;
  declare _version: string | null;
  declare _conflict: boolean;
  declare _previewV: number;
  declare _switching: boolean;
  declare _dark: boolean;

  /** Guards one-time seeding of `_page`/`_version` from the initial* inputs
   *  (React `useState(initialX)` only reads the arg on mount). */
  private _seeded = false;

  private readonly _autosave = new AutosaveController(this, {
    getState: () => ({ conflict: this._conflict }),
    saveDraft: () => this.actions.saveDraft(this.slug, this._page, this._version ?? undefined, this.activeLocale),
    onSaved: (version) => {
      this._version = version;
      this._dirty = false;
      this._status = this.t("shell.draftSaved");
      this._previewV += 1;
    },
    onConflict: () => {
      this._conflict = true;
      this._status = "";
    },
  });

  private readonly _preview = new PreviewLinkController(this, {
    getIframe: () => this.deviceEl?.iframe ?? null,
    onSelect: (index) => {
      this._selected = index;
    },
    onEdit: (index, before, after) => {
      const slices = mapEditToField(this._page.slices, index, before, after);
      if (!slices) return;
      this._page = { ...this._page, slices };
      this._selected = index;
      this._dirty = true;
      this._status = "";
      this._autosave.schedule();
    },
  });

  constructor() {
    super();
    this.slug = "";
    this.pages = [];
    this.previewPath = "";
    this.hideNav = false;
    this.isFallback = false;
    this._page = { meta: {}, slices: [], body: "" };
    this._selected = 0;
    this._dirty = false;
    this._busy = false;
    this._status = "";
    this._version = null;
    this._conflict = false;
    this._previewV = 0;
    this._switching = false;
    this._dark = readDarkTheme();
  }

  static styles = [
    primitiveStyles,
    overlayStyles,
    css`
      .col {
        display: flex;
        min-width: 0;
        flex: 1 1 auto;
        flex-direction: column;
      }
      header {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        border-bottom: 1px solid var(--scms-border);
        padding: 0.5rem 1rem;
      }
      .slug {
        font-family: ui-monospace, monospace;
        font-size: 0.875rem;
        font-weight: 600;
      }
      .status {
        font-size: 0.75rem;
        color: var(--scms-muted-fg);
      }
      .header-actions {
        display: flex;
        margin-left: auto;
        align-items: center;
        gap: 0.5rem;
      }
      .locale-select {
        width: auto;
      }
      .banner {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 0.75rem;
        border-bottom: 1px solid var(--scms-border);
        background: var(--scms-muted);
        padding: 0.5rem 1rem;
        font-size: 0.875rem;
        color: var(--scms-fg);
      }
      .banner svg {
        width: 1rem;
        height: 1rem;
        flex-shrink: 0;
      }
      .banner .icon-muted {
        color: var(--scms-muted-fg);
      }
      .banner .icon-danger {
        color: var(--scms-destructive);
      }
      .banner-text {
        min-width: 0;
        flex: 1 1 auto;
      }
      .banner-actions {
        display: flex;
        flex-shrink: 0;
        align-items: center;
        gap: 0.5rem;
      }
      .main {
        display: flex;
        min-height: 0;
        flex: 1 1 auto;
      }
      aside {
        width: 20rem;
        flex-shrink: 0;
        overflow-y: auto;
        border-left: 1px solid var(--scms-border);
      }
      .props-header {
        border-bottom: 1px solid var(--scms-border);
        padding: 0.5rem 0.75rem;
        font-size: 0.75rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.025em;
        color: var(--scms-muted-fg);
      }
      .props-body {
        padding: 0.75rem;
      }
      .props-empty {
        font-size: 0.875rem;
        color: var(--scms-muted-fg);
      }
    `,
  ];

  private get t() {
    return createT(this.messages);
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

  private get previewSrc(): string {
    return `${this.previewPath}/${this.slug}?locale=${this.activeLocale}&v=${this._previewV}`;
  }

  private get deviceEl(): MeditorDevicePreview | null {
    return this.renderRoot.querySelector("meditor-device-preview");
  }

  /** All non-optional props present — until then, render nothing (wc.tsx's
   *  REQUIRED gate). `initialVersion` may legitimately be `null`, so this is a
   *  `!== undefined` check, not a truthiness one. */
  private get ready(): boolean {
    return (
      this.slug !== undefined &&
      this.pages !== undefined &&
      this.initialPage !== undefined &&
      this.initialVersion !== undefined &&
      this.sliceNames !== undefined &&
      this.defaults !== undefined &&
      this.previewPath !== undefined &&
      this.actions !== undefined &&
      this._seeded
    );
  }

  protected willUpdate(): void {
    // One-time seed from the initial* inputs, the moment they're both set
    // (React `useState(initialPage)` / `useState(initialVersion)` on mount).
    if (!this._seeded && this.initialPage !== undefined && this.initialVersion !== undefined) {
      this._page = this.initialPage;
      this._version = this.initialVersion;
      this._seeded = true;
    }
  }

  protected updated(changed: PropertyValues<this>): void {
    if (changed.has("_dark")) {
      // Toggle `.dark` on the host (light DOM) so the global `.dark{--scms-*}`
      // rule matches and its vars flow into this shadow tree (spec fact #3);
      // persist the choice.
      this.classList.toggle("dark", this._dark);
      writeDarkTheme(this._dark);
    }
    // OUT bridge: tell the iframe which block is selected — on selection change
    // and on every preview reload (React's `[selected, previewV]` effect).
    if (changed.has("_selected") || changed.has("_previewV")) {
      this._preview.postSelect(this._selected);
    }
  }

  // --- slice-array edits (route through slice-ops → dirty + arm autosave) ---

  private _mutate(res: { slices: Slice[]; selected: number }): void {
    this._page = { ...this._page, slices: res.slices };
    this._selected = res.selected;
    this._dirty = true;
    this._status = "";
    this._autosave.schedule();
  }

  private _reorder(from: number, to: number): void {
    const res = reorder(this._page.slices, from, to);
    if (res) this._mutate(res);
  }

  private _add(name: string): void {
    this._mutate(addSlice(this._page.slices, name, this.defaults));
  }

  private _duplicate(i: number): void {
    this._mutate(duplicate(this._page.slices, i));
  }

  private _remove(i: number): void {
    this._mutate(remove(this._page.slices, i));
  }

  private _updateSelected(next: Slice): void {
    this._mutate(updateSelected(this._page.slices, this._selected, next));
  }

  // --- chrome actions -------------------------------------------------------

  private async _run(label: string, fn: () => Promise<void>, reload = false): Promise<void> {
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

  private async _publish(): Promise<void> {
    this._busy = true;
    this._status = this.t("shell.publishing");
    try {
      // Save at our version first; if that already conflicts, don't publish.
      const saved = await this.actions.saveDraft(this.slug, this._page, this._version ?? undefined, this.activeLocale);
      if (!saved.ok) {
        this._conflict = true;
        this._status = "";
        return;
      }
      this._version = saved.version;
      const pub = await this.actions.publish(this.slug, saved.version, this.activeLocale);
      if (!pub.ok) {
        this._conflict = true;
        this._status = "";
        return;
      }
      window.location.reload();
    } catch (e) {
      this._status = this.t("shell.publishFailed", { error: e instanceof Error ? e.message : String(e) });
    } finally {
      this._busy = false;
    }
  }

  private _discard(): void {
    if (!confirm(this.t("shell.confirmDiscard"))) return;
    void this._run(this.t("shell.discardDraft"), () => this.actions.discardDraft(this.slug, this.activeLocale), true);
  }

  private _switchLocale(next: string): void {
    if (next === this.activeLocale) return;
    const go = () => {
      const url = new URL(window.location.href);
      url.searchParams.set("locale", next);
      window.location.href = url.toString();
    };
    if (this.resolvedTranslatedLocales.includes(next)) return go();
    // Untranslated target: seed a draft translation first, then navigate.
    this._switching = true;
    void this.actions.createTranslation(this.slug, next).then(go);
  }

  private _reloadConflict(): void {
    window.location.reload();
  }

  private async _overwrite(): Promise<void> {
    this._busy = true;
    this._status = this.t("shell.overwriting");
    try {
      // Blind write (baseVersion omitted) — our version wins over theirs.
      const res = await this.actions.saveDraft(this.slug, this._page, undefined, this.activeLocale);
      if (res.ok) {
        this._version = res.version;
        this._conflict = false;
        this._dirty = false;
        this._status = this.t("shell.draftSaved");
        this._previewV += 1;
      }
    } finally {
      this._busy = false;
    }
  }

  render(): typeof nothing | TemplateResult {
    if (!this.ready) return nothing;
    const t = this.t;
    const locales = this.resolvedLocales;
    const defaultLocale = this.resolvedDefaultLocale;
    const translatedLocales = this.resolvedTranslatedLocales;
    const activeLocale = this.activeLocale;
    const selectedSlice = this._page.slices[this._selected];

    const blockList = html`
      <meditor-block-list
        .slices=${this._page.slices}
        .selectedIndex=${this._selected}
        .sliceNames=${this.sliceNames}
        .messages=${this.messages}
        @select=${(e: CustomEvent<number>) => (this._selected = e.detail)}
        @reorder=${(e: CustomEvent<{ from: number; to: number }>) => this._reorder(e.detail.from, e.detail.to)}
        @add=${(e: CustomEvent<string>) => this._add(e.detail)}
        @duplicate=${(e: CustomEvent<number>) => this._duplicate(e.detail)}
        @delete=${(e: CustomEvent<number>) => this._remove(e.detail)}
      ></meditor-block-list>
    `;

    return html`
      ${this.hideNav
        ? blockList
        : html`
            <meditor-pages-nav
              .pages=${this.pages}
              .currentSlug=${this.slug}
              .locale=${activeLocale}
              .defaultLocale=${defaultLocale}
              .allLocales=${locales}
              .messages=${this.messages}
              .onCreate=${this.actions.createPage}
              .onDelete=${this.actions.deletePage}
            >
              ${blockList}
            </meditor-pages-nav>
          `}

      <div class="col">
        <header>
          <span class="slug">/${this.slug}</span>
          <span class="status">${this._dirty ? t("shell.unsaved") : this._status || t("shell.upToDate")}</span>
          <div class="header-actions">
            ${locales.length > 1
              ? html`
                  <!-- \`.selected\` per option, not \`.value\` on the <select>:
                       Lit commits element properties before child parts, so a
                       \`.value\` binding lands before the <option>s exist and the
                       browser keeps index 0 (see field-form.element.ts). -->
                  <select
                    class="select locale-select"
                    aria-label=${t("shell.locale")}
                    ?disabled=${this._busy || this._switching}
                    @change=${(e: Event) => this._switchLocale((e.target as HTMLSelectElement).value)}
                  >
                    ${locales.map(
                      (l) =>
                        html`<option value=${l} .selected=${l === activeLocale}>
                          ${l}${translatedLocales.includes(l) ? "" : ` — ${t("shell.translate")}`}
                        </option>`
                    )}
                  </select>
                `
              : nothing}
            <button
              type="button"
              class="btn btn--ghost btn--icon"
              aria-label=${t("shell.toggleTheme")}
              @click=${() => (this._dark = !this._dark)}
            >
              ${this._dark ? icon(iconSun) : icon(iconMoon)}
            </button>
            <button type="button" class="btn btn--ghost btn--sm" ?disabled=${this._busy} @click=${() => this._discard()}>
              ${t("shell.discardDraft")}
            </button>
            <button
              type="button"
              class="btn btn--default btn--sm"
              ?disabled=${this._busy || this._conflict}
              @click=${() => this._publish()}
            >
              ${t("shell.publish")}
            </button>
          </div>
        </header>

        ${this.isFallback && locales.length > 1
          ? html`
              <div class="banner" role="status">
                <span class="icon-muted" aria-hidden="true">${icon(iconLanguages)}</span>
                <span class="banner-text">${t("shell.fallbackBanner", { defaultLocale, locale: activeLocale })}</span>
              </div>
            `
          : nothing}

        ${this._conflict
          ? html`
              <div class="banner" role="alert">
                <span class="icon-danger" aria-hidden="true">${icon(iconTriangleAlert)}</span>
                <span class="banner-text">${t("shell.conflict")}</span>
                <div class="banner-actions">
                  <button
                    type="button"
                    class="btn btn--outline btn--sm"
                    ?disabled=${this._busy}
                    @click=${() => this._reloadConflict()}
                  >
                    ${t("shell.reload")}
                  </button>
                  <button
                    type="button"
                    class="btn btn--destructive btn--sm"
                    ?disabled=${this._busy}
                    @click=${() => this._overwrite()}
                  >
                    ${t("shell.overwrite")}
                  </button>
                </div>
              </div>
            `
          : nothing}

        <div class="main">
          <meditor-device-preview .src=${this.previewSrc} .reloadKey=${this._previewV}></meditor-device-preview>

          <aside>
            <div class="props-header">${t("shell.properties")}</div>
            <div class="props-body">
              ${selectedSlice
                ? keyed(
                    this._selected,
                    html`
                      <meditor-field-form
                        .slice=${selectedSlice}
                        .schema=${this.fieldSchema?.[selectedSlice.slice]}
                        .media=${this.media}
                        .messages=${this.messages}
                        @change=${(e: CustomEvent<Slice>) => this._updateSelected(e.detail)}
                      ></meditor-field-form>
                    `
                  )
                : html`<p class="props-empty">${t("shell.selectBlock")}</p>`}
            </div>
          </aside>
        </div>
      </div>
    `;
  }
}

if (typeof customElements !== "undefined" && !customElements.get("meditor-editor")) {
  customElements.define("meditor-editor", MeditorEditor);
}

/**
 * Register `<meditor-editor>`. Idempotent + browser-safe (no-op under SSR),
 * porting `wc.tsx`'s `defineMeditorEditor` semantics. A custom `tag` registers
 * a subclass (a constructor can only bind to one tag). The default tag is also
 * auto-registered on import (above), so `defineMeditorEditor()` is a no-op.
 */
export function defineMeditorEditor(tag = "meditor-editor"): void {
  if (typeof customElements === "undefined") return;
  if (customElements.get(tag)) return;
  customElements.define(tag, tag === "meditor-editor" ? MeditorEditor : class extends MeditorEditor {});
}

// Note: `HTMLElementTagNameMap["meditor-editor"]` is intentionally NOT declared
// here — the React `./wc` entry (wc.tsx) still declares it as its own element
// type during the additive transition, and two differing global declarations
// for the same key don't merge. Dropped when the React WC is removed at parity.
