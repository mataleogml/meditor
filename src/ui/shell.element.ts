import { LitElement, css, html, nothing, type PropertyValues } from "lit";
import type { CollectionSection, CustomSection, ResolvedSection, SectionCtx } from "../sections";
import type { PageContent, PageInfo, SliceSchema } from "../types";
import type { CollectionRecordInfo } from "./collection-list.element";
import type { TopBarAction } from "./top-bar.element";
import "./section-nav.element";
import "./top-bar.element";
import "./editor.element";
import "./page-list.element";
import "./media-library.element";
import "./settings.element";
import "./collection.element";
import { readDarkTheme, writeDarkTheme } from "./controllers";
import { overlayStyles, primitiveStyles } from "./styles";

/** Server-fetched data the Pages section needs beyond what `SectionCtx`
 *  already carries (actions/media/locale come from ctx — see spec §4's
 *  "Data props ... are server-fetched ... and set as properties too"). Mirrors
 *  `<meditor-editor>`'s own declared properties minus the ctx-supplied ones.
 *
 *  `slug`/`initialPage`/`initialVersion` are optional: WITH them the section
 *  edits that one page, WITHOUT them it renders the page picker
 *  (`<meditor-page-list>`) — the host's `/<adminRoute>/pages` landing view. Only
 *  `pages` is always needed, since both views list it. */
export interface PagesSectionProps {
  slug?: string;
  pages: PageInfo[];
  initialPage?: PageContent;
  initialVersion?: string | null;
  sliceNames: string[];
  defaults: Record<string, Record<string, unknown>>;
  fieldSchema?: Record<string, SliceSchema>;
  previewPath: string;
  translatedLocales?: string[];
  isFallback?: boolean;
}

/** Ditto for Media — `.media` comes from `ctx.config.mediaAdapter` (its
 *  list/upload/delete shape already satisfies `<meditor-media-library>`'s
 *  `MediaLibraryMedia`), `.pages`/onCreate/onDelete need actions/data. */
export interface MediaSectionProps {
  pages: PageInfo[];
  uploadPath: string;
}

/**
 * `<meditor-shell>` — the root SDUI element (spec §4). Renders the single
 * left rail (`<meditor-section-nav>`) + top bar (`<meditor-top-bar>`) and
 * hands the active section ONE mount region it fills entirely; every
 * built-in renderer owns its own internal canvas/panel split, so the shell
 * never imposes a second slot pair.
 *
 * Owns the `.dark` class + `localStorage["meditor-theme"]` toggle (kept in
 * sync with `<meditor-editor>`'s own key — both read/write the same string,
 * and the full-navigation section-switch model means there's no live state to
 * reconcile between them). Also owns the `ctx.setTopBarAction` plumbing: the
 * ctx handed to every child is a thin wrapper around the input `.ctx` whose
 * `setTopBarAction` writes to this element's own state instead of whatever
 * the host-supplied ctx did, so a top-bar contribution from a section nested
 * arbitrarily deep always reaches the actual `<meditor-top-bar>` this element
 * renders.
 */
export class MeditorShell extends LitElement {
  static properties = {
    sections: { attribute: false },
    activeId: { type: String },
    ctx: { attribute: false },
    pagesProps: { attribute: false },
    mediaProps: { attribute: false },
    collectionRecords: { attribute: false },
    _dark: { state: true },
    _topBarAction: { state: true },
  };

  declare sections: ResolvedSection[];
  declare activeId?: string;
  declare ctx?: SectionCtx;
  declare pagesProps?: PagesSectionProps;
  declare mediaProps?: MediaSectionProps;
  declare collectionRecords: Record<string, CollectionRecordInfo[]>;
  declare _dark: boolean;
  declare _topBarAction: TopBarAction | null;

  private _customCleanup?: () => void;
  private _wrappedFor?: SectionCtx;
  private _wrappedCtx?: SectionCtx;

  constructor() {
    super();
    this.sections = [];
    this.collectionRecords = {};
    this._topBarAction = null;
    this._dark = readDarkTheme();
  }

  static styles = [
    primitiveStyles,
    overlayStyles,
    css`
      /* .sidebar-inset (from the shadcn port) supplies the frame: the wrapper
         is sidebar-coloured and the content is a raised, rounded surface on it. */
      .region {
        display: flex;
        min-height: 0;
        flex: 1 1 auto;
        border-top: 1px solid var(--scms-border);
        /* ponytail: the rail costs 15rem, and a section whose own panes have
           fixed minimums (the Pages editor wants ~1184px for block list +
           preview + properties) then overflows on a laptop-width viewport.
           overflow:hidden made that overflow UNREACHABLE — the properties panel
           was simply cut off — so scroll it instead. A scroll container still
           clips to the card's border-radius, so this is also what keeps the
           panels inside the rounded surface. Upgrade path: make those panes
           responsive (collapsible properties / narrower block list), at which
           point the scrollbar never appears. */
        overflow-x: auto;
        overflow-y: hidden;
        /* Bottom corners follow the inset card so a panel can't paint over its
           rounded edge. */
        border-bottom-left-radius: var(--_radius-xl);
        border-bottom-right-radius: var(--_radius-xl);
      }
      .region > * {
        min-width: 0;
        flex: 1 1 auto;
        /* Every section element also ships standalone, where overlayStyles
           makes its :host a full-screen overlay (position: fixed; inset: 0;
           z-index: 100). Nested here that escapes the region and paints over
           the rail and top bar. An outer-tree rule beats the inner :host rule,
           so neutralizing position here re-flows all of them at once (inset and
           z-index stop applying to a static box) — no per-element attribute
           plumbing, and standalone use is untouched. */
        position: static;
      }
      .custom-mount {
        display: flex;
        min-height: 0;
        min-width: 0;
        flex: 1 1 auto;
      }
    `,
  ];

  private get _active(): ResolvedSection | undefined {
    return this.sections.find((s) => s.id === this.activeId);
  }

  /** `/${adminRoute}` — same derivation as `<meditor-section-nav>`'s, so the
   *  page picker's links and the rail's can't drift apart. */
  private _basePath(ctx: SectionCtx): string {
    return `/${ctx.settingsSnapshot?.bootstrap?.adminRoute ?? "editor"}`;
  }

  /** Wraps the input ctx so `setTopBarAction` lands on this element's own
   *  state (see class doc); memoized on `this.ctx`'s identity so children
   *  don't see a new ctx object (and re-render) on every unrelated update. */
  private get _effectiveCtx(): SectionCtx | undefined {
    if (!this.ctx) return undefined;
    if (this._wrappedFor !== this.ctx) {
      this._wrappedFor = this.ctx;
      const ctx = this.ctx;
      this._wrappedCtx = {
        ...ctx,
        setTopBarAction: (action) => {
          this._topBarAction = action;
        },
      };
    }
    return this._wrappedCtx;
  }

  protected updated(changed: PropertyValues<this>): void {
    if (changed.has("_dark")) {
      // Toggle `.dark` on the host (light DOM) so the shared `.dark{--scms-*}`
      // rule applies through the shadow boundary; persist under the same key
      // `<meditor-editor>` reads/writes standalone.
      this.classList.toggle("dark", this._dark);
      writeDarkTheme(this._dark);
    }
    if (changed.has("activeId") || changed.has("sections") || changed.has("ctx")) this._syncCustomMount();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this._teardownCustom();
  }

  private _toggleTheme(): void {
    this._dark = !this._dark;
  }

  private _syncCustomMount(): void {
    this._teardownCustom();
    const active = this._active;
    const ctx = this._effectiveCtx;
    if (!active || active.kind !== "custom" || !ctx) return;
    const host = this.renderRoot.querySelector<HTMLElement>(".custom-mount");
    if (!host) return;
    const raw = active.raw as CustomSection;
    if (raw.host) {
      // Declared as host-rendered: its renderer lives in the embedding shell, so
      // this one has nothing to mount. Say so instead of leaving a blank pane.
      console.warn(
        `meditor: section "${active.label}" is host-rendered (host: true) and cannot be rendered by the Web Component shell.`
      );
      return;
    }
    if (raw.element) {
      const el = document.createElement(raw.element);
      (el as unknown as { ctx?: SectionCtx }).ctx = ctx;
      host.appendChild(el);
      this._customCleanup = () => el.remove();
    } else if (raw.mount) {
      const cleanup = raw.mount(host, ctx);
      this._customCleanup = () => {
        cleanup?.();
        host.replaceChildren();
      };
    }
  }

  private _teardownCustom(): void {
    this._customCleanup?.();
    this._customCleanup = undefined;
  }

  private _renderActive(s: ResolvedSection, ctx: SectionCtx) {
    switch (s.kind) {
      case "pages": {
        const p = this.pagesProps;
        if (!p) return nothing;
        // No page chosen → the picker, not a blank canvas. `<meditor-editor>`
        // needs a concrete page and the shell has no list view of its own, so
        // `/<adminRoute>/pages` (and bare `/<adminRoute>`) would otherwise paint
        // an empty region.
        if (!p.slug || !p.initialPage) {
          return html`<meditor-page-list .pages=${p.pages} .basePath=${this._basePath(ctx)}></meditor-page-list>`;
        }
        // hideNav=true: shell already renders the single left rail, so the
        // Pages section suppresses `<meditor-editor>`'s own `<meditor-pages-
        // nav>` (addendum #5). Standalone `<meditor-editor>` (no hideNav) is
        // untouched.
        return html`<meditor-editor
          hideNav
          .slug=${p.slug}
          .pages=${p.pages}
          .initialPage=${p.initialPage}
          .initialVersion=${p.initialVersion ?? null}
          .sliceNames=${p.sliceNames}
          .defaults=${p.defaults}
          .fieldSchema=${p.fieldSchema}
          .previewPath=${p.previewPath}
          .actions=${ctx.actions}
          .media=${ctx.media}
          .locale=${ctx.locale}
          .locales=${ctx.locales}
          .defaultLocale=${ctx.defaultLocale}
          .translatedLocales=${p.translatedLocales}
          .isFallback=${p.isFallback ?? false}
          .messages=${ctx.messages}
        ></meditor-editor>`;
      }
      case "media": {
        const m = this.mediaProps;
        if (!m || !ctx.config.mediaAdapter) return nothing;
        // hideNav for the same reason as Pages above: this element ships its own
        // `<meditor-pages-nav>` for standalone use, which would otherwise paint a
        // second 241px rail at x:0, right over the shell's section rail.
        return html`<meditor-media-library
          hideNav
          .pages=${m.pages}
          .media=${ctx.config.mediaAdapter}
          .uploadPath=${m.uploadPath}
          .onCreate=${(title: string) => ctx.actions.createPage(title, ctx.locale)}
          .onDelete=${(slug: string) => ctx.actions.deletePage(slug)}
          .messages=${ctx.messages}
        ></meditor-media-library>`;
      }
      case "settings":
        return html`<meditor-settings .ctx=${ctx}></meditor-settings>`;
      case "collection":
        return html`<meditor-collection
          .section=${s.raw as CollectionSection}
          .actions=${ctx.collections[s.id]}
          .ctx=${ctx}
          .records=${this.collectionRecords[s.id] ?? []}
        ></meditor-collection>`;
      case "custom":
        // Imperative mount target — filled by `_syncCustomMount` after render
        // (see class doc / spec §4's `_mountCustom`).
        return html`<div class="custom-mount"></div>`;
    }
  }

  render() {
    if (!this.ctx) return nothing;
    const ctx = this._effectiveCtx!;
    const active = this._active;
    return html`
      <meditor-section-nav
        .sections=${this.sections}
        .activeId=${this.activeId}
        .ctx=${ctx}
        .pages=${this.pagesProps?.pages ?? []}
        .currentSlug=${this.pagesProps?.slug}
      ></meditor-section-nav>
      <div class="sidebar-inset">
        <meditor-top-bar
          .ctx=${ctx}
          .section=${active}
          .dark=${this._dark}
          .onToggleTheme=${() => this._toggleTheme()}
          .action=${this._topBarAction}
        ></meditor-top-bar>
        <div class="region">${active ? this._renderActive(active, ctx) : nothing}</div>
      </div>
    `;
  }
}

if (!customElements.get("meditor-shell")) {
  customElements.define("meditor-shell", MeditorShell);
}

declare global {
  interface HTMLElementTagNameMap {
    "meditor-shell": MeditorShell;
  }
}
