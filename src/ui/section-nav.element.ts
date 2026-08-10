import { LitElement, css, html, nothing } from "lit";
import { icon, iconChevronDown, iconFileText, iconGripVertical, iconImage, iconPlus, iconSettings, iconCopy } from "./icons";
import type { ResolvedSection, SectionCtx, SectionKind } from "../sections";
import type { PageInfo } from "../types";
import { primitiveStyles } from "./styles";

/** Kind-default row icon, used only when a section omits its own `icon`
 *  (see sections.ts's `SectionBase.icon` doc). Reuses existing icons.ts
 *  exports rather than hand-authoring new SVG path data — `collection`/
 *  `custom` don't have an obviously "correct" lucide glyph, so `iconCopy`/
 *  `iconGripVertical` are neutral placeholders a section can override. */
const KIND_ICON: Record<SectionKind, ReturnType<typeof icon>> = {
  pages: icon(iconFileText),
  media: icon(iconImage),
  settings: icon(iconSettings),
  collection: icon(iconCopy),
  custom: icon(iconGripVertical),
};

const GROUP_LABEL: Record<string, string> = { content: "Content", other: "Other" };

function titleCase(s: string): string {
  return s.length ? s[0].toUpperCase() + s.slice(1) : s;
}

/** Groups resolved sections "Content" then "Other" then any unknown groups,
 *  each in registration order (spec §4 / addendum #5's single left rail). */
function groupSections(sections: ResolvedSection[]): { label: string; items: ResolvedSection[] }[] {
  const buckets = new Map<string, ResolvedSection[]>();
  for (const s of sections) {
    const arr = buckets.get(s.group);
    if (arr) arr.push(s);
    else buckets.set(s.group, [s]);
  }
  const order = ["content", "other", ...[...buckets.keys()].filter((g) => g !== "content" && g !== "other")];
  return order.filter((g) => buckets.has(g)).map((g) => ({ label: GROUP_LABEL[g] ?? titleCase(g), items: buckets.get(g)! }));
}

/**
 * `<meditor-section-nav>` — the shell's single left rail (Figma; addendum #5
 * kills the old double-nav). Brand logo/name from `ctx.settingsSnapshot`, a
 * "+ New page" action (compensates for `<meditor-editor hideNav>` hiding its
 * own page-add control once nested in the shell), sections grouped
 * Content/Other, active-id highlight, and a static avatar footer.
 *
 * Section rows are plain `<a href>`s — full navigation per spec §4, not
 * `ctx.navigate()` (that's for programmatic jumps, e.g. after a create).
 */
export class MeditorSectionNav extends LitElement {
  static properties = {
    sections: { attribute: false },
    activeId: { type: String },
    ctx: { attribute: false },
    pages: { attribute: false },
    currentSlug: { type: String },
  };

  declare sections: ResolvedSection[];
  declare activeId?: string;
  declare ctx?: SectionCtx;
  /** Pages listed under the Pages row (Figma: the section expands into a page
   *  tree). Empty is fine — the row then just has no children. */
  declare pages: PageInfo[];
  declare currentSlug?: string;

  constructor() {
    super();
    this.sections = [];
    this.pages = [];
  }

  static styles = [
    primitiveStyles,
    css`
      :host {
        display: flex;
        flex-shrink: 0;
      }
      /* Brand block sits in shadcn's SidebarHeader; a logo is a wordmark far
         more often than a square glyph, so it gets a wide, height-bounded box. */
      .brand {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        min-width: 0;
        padding: 0.375rem 0.5rem;
        font-size: 1rem;
        font-weight: 600;
        letter-spacing: -0.01em;
        color: var(--scms-sidebar-fg, var(--scms-fg));
      }
      .brand img {
        max-width: 11rem;
        max-height: 1.75rem;
        width: auto;
        height: auto;
        object-fit: contain;
      }
      .brand-name {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .new-page-btn {
        width: 100%;
        justify-content: flex-start;
      }
      /* The page tree is capped and scrolls on its own: a site with dozens of
         pages would otherwise push the other sections (and the footer) out of
         the rail entirely. */
      .sidebar-menu-sub {
        max-height: 15rem;
        overflow-y: auto;
        scrollbar-color: var(--scms-border) transparent;
        scrollbar-width: thin;
      }
      .draft-dot {
        width: 0.375rem;
        height: 0.375rem;
        flex-shrink: 0;
        border-radius: 9999px;
        background: var(--scms-primary);
      }
      .chevron {
        margin-left: auto;
        flex-shrink: 0;
        opacity: 0.5;
      }
      .account {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.25rem;
        font-size: 0.875rem;
        color: var(--scms-muted-fg);
      }
    `,
  ];

  /** `/${adminRoute}` — reads the same bootstrap field the top bar's
   *  breadcrumb home link uses (settingsSnapshot is already required for the
   *  brand logo, so no extra prop is needed to derive this). */
  private get basePath(): string {
    return `/${this.ctx?.settingsSnapshot?.bootstrap?.adminRoute ?? "editor"}`;
  }

  private async _newPage(): Promise<void> {
    const ctx = this.ctx;
    if (!ctx) return;
    const name = window.prompt("New page name")?.trim();
    if (!name) return;
    const slug = await ctx.actions.createPage(name, ctx.locale);
    window.location.href = `${this.basePath}/${slug}`;
  }

  /** One SidebarMenuItem. The Pages row additionally renders a SidebarMenuSub
   *  holding the page tree. */
  private _renderRow(s: ResolvedSection) {
    const active = s.id === this.activeId;
    const showTree = s.kind === "pages" && this.pages.length > 0;
    return html`
      <li class="sidebar-menu-item">
        <a class="sidebar-menu-button" data-active=${active ? "true" : "false"} href="${this.basePath}/${s.id}">
          ${s.icon ?? KIND_ICON[s.kind]}
          <span>${s.label}</span>
          ${showTree ? html`<span class="chevron">${icon(iconChevronDown)}</span>` : nothing}
        </a>
        ${showTree
          ? html`
              <ul class="sidebar-menu-sub">
                ${this.pages.map(
                  (p) => html`
                    <li class="sidebar-menu-sub-item">
                      <a
                        class="sidebar-menu-sub-button"
                        data-active=${p.slug === this.currentSlug ? "true" : "false"}
                        href="${this.basePath}/${p.slug}"
                        aria-current=${p.slug === this.currentSlug ? "page" : nothing}
                      >
                        ${p.hasDraft ? html`<span class="draft-dot" title="Unpublished changes"></span>` : nothing}
                        <span>${p.title || p.slug}</span>
                      </a>
                    </li>
                  `
                )}
              </ul>
            `
          : nothing}
      </li>
    `;
  }

  render() {
    if (!this.ctx) return nothing;
    const snapshot = this.ctx.settingsSnapshot;
    const logo = snapshot?.brand?.logo?.url;
    const brandName = snapshot?.brand?.name || "meditor";
    const hasPages = this.sections.some((s) => s.kind === "pages");
    return html`
      <nav class="sidebar">
        <div class="sidebar-header">
          <div class="brand">
            ${logo
              ? html`<img src=${logo} alt=${brandName} />`
              : html`
                  <span class="avatar">
                    <span class="avatar-fallback">${brandName[0]?.toUpperCase() ?? "M"}</span>
                  </span>
                  <span class="brand-name">${brandName}</span>
                `}
          </div>
          ${hasPages
            ? html`
                <button type="button" class="btn btn--outline btn--sm new-page-btn" @click=${() => this._newPage()}>
                  ${icon(iconPlus)} New page
                </button>
              `
            : nothing}
        </div>

        <div class="sidebar-content">
          ${groupSections(this.sections).map(
            (group) => html`
              <div class="sidebar-group">
                <div class="sidebar-group-label">${group.label}</div>
                <ul class="sidebar-menu">
                  ${group.items.map((s) => this._renderRow(s))}
                </ul>
              </div>
            `
          )}
        </div>

        <!-- ponytail: SectionCtx carries no authenticated-user identity today,
             so the footer is a static placeholder (brand initial, "Account"
             label) rather than a real avatar/name. Upgrade path: thread a
             ctx.user field through sections.ts if/when host auth exposes one. -->
        <div class="sidebar-footer">
          <div class="account">
            <span class="avatar">
              <span class="avatar-fallback">${brandName[0]?.toUpperCase() ?? "U"}</span>
            </span>
            <span>Account</span>
          </div>
        </div>
      </nav>
    `;
  }
}

if (!customElements.get("meditor-section-nav")) {
  customElements.define("meditor-section-nav", MeditorSectionNav);
}

declare global {
  interface HTMLElementTagNameMap {
    "meditor-section-nav": MeditorSectionNav;
  }
}
