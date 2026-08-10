import { LitElement, css, html, nothing } from "lit";
import type { ResolvedSection, SectionCtx } from "../sections";
import { icon, iconChevronRight, iconHouse, iconMonitor, iconMoon, iconPencilLine, iconSmartphone, iconSun, iconTablet } from "./icons";
import { primitiveStyles } from "./styles";

export interface TopBarAction {
  label: string;
  onClick: () => void;
}

/**
 * `<meditor-top-bar>` — breadcrumb (Home / active section label + a static
 * "Draft" badge) on the left, chrome controls on the right: a read-only
 * device-size pill (decorative parity with `<meditor-device-preview>`'s own
 * presets — the real switcher lives inside the Pages canvas, this is just the
 * Figma chrome echo, not a second control surface), an Edit/Preview toggle,
 * the dark-mode toggle (state owned by `<meditor-shell>`, this element only
 * renders the button), and whatever the active section contributed via
 * `ctx.setTopBarAction`.
 */
export class MeditorTopBar extends LitElement {
  static properties = {
    ctx: { attribute: false },
    section: { attribute: false },
    dark: { type: Boolean },
    onToggleTheme: { attribute: false },
    action: { attribute: false },
    _previewMode: { state: true },
  };

  declare ctx?: SectionCtx;
  declare section?: ResolvedSection;
  declare dark: boolean;
  declare onToggleTheme?: () => void;
  declare action: TopBarAction | null;
  declare _previewMode: boolean;

  constructor() {
    super();
    this.dark = false;
    this.action = null;
    this._previewMode = false;
  }

  static styles = [
    primitiveStyles,
    css`
      :host {
        display: flex;
        flex-shrink: 0;
      }
      /* Sits inside the inset card, above the content region. */
      header {
        display: flex;
        width: 100%;
        height: 3.5rem;
        align-items: center;
        gap: 0.75rem;
        padding: 0 0.75rem;
      }
      /* Takes the slack, so a long page title truncates rather than squeezing
         the controls on the right. */
      .breadcrumb-list {
        min-width: 0;
        flex: 1 1 auto;
        flex-wrap: nowrap;
      }
      .home {
        display: inline-grid;
        place-items: center;
        width: 1.75rem;
        height: 1.75rem;
        flex-shrink: 0;
        border-radius: var(--_radius-md);
      }
      .home:hover {
        background: var(--scms-accent, var(--scms-muted));
      }
      .home svg {
        width: 1rem;
        height: 1rem;
      }
      .right {
        display: flex;
        margin-left: auto;
        flex-shrink: 0;
        align-items: center;
        gap: 0.5rem;
      }
      /* The device switcher is a ToggleGroup-shaped row inside a Tabs-style
         track — shadcn's own pattern for a segmented control. */
      .tabs-list {
        height: 2rem;
      }
      .tabs-trigger {
        padding: 0 0.5rem;
      }
      .edit-btn {
        white-space: nowrap;
      }
    `,
  ];

  private get homeHref(): string {
    return `/${this.ctx?.settingsSnapshot?.bootstrap?.adminRoute ?? "editor"}`;
  }

  // ponytail: the device pill is a read-only Figma-chrome echo of
  // device-preview's own desktop/tablet/mobile presets — decorative, not
  // wired to the canvas's actual device state (no shared state exists
  // between shell chrome and the nested pages-editor preview toolbar today).
  // Wire it up if a host ever needs the pill to reflect or drive the live
  // preview size.
  render() {
    return html`
      <header>
        <nav aria-label="Breadcrumb">
          <ol class="breadcrumb-list">
            <li class="breadcrumb-item">
              <a class="breadcrumb-link home" href=${this.homeHref} aria-label="Editor home">${icon(iconHouse)}</a>
            </li>
            ${this.section
              ? html`
                  <li class="breadcrumb-separator" role="presentation" aria-hidden="true">
                    ${icon(iconChevronRight)}
                  </li>
                  <li class="breadcrumb-item">
                    <span class="breadcrumb-page" aria-current="page">${this.section.label}</span>
                  </li>
                  <li class="breadcrumb-item"><span class="badge badge--secondary">Draft</span></li>
                `
              : nothing}
          </ol>
        </nav>

        <div class="right">
          <div class="tabs-list" role="tablist" aria-label="Preview size" aria-hidden="true">
            <span class="tabs-trigger" role="tab">${icon(iconSmartphone)}</span>
            <span class="tabs-trigger" role="tab">${icon(iconTablet)}</span>
            <span class="tabs-trigger" role="tab" data-state="active" aria-selected="true">${icon(iconMonitor)}</span>
          </div>
          <span class="separator" data-orientation="vertical" style="height:1.5rem"></span>
          <button
            type="button"
            class="btn btn--ghost btn--icon btn--sm"
            aria-label="Toggle theme"
            @click=${() => this.onToggleTheme?.()}
          >
            ${icon(this.dark ? iconSun : iconMoon)}
          </button>
          <button
            type="button"
            class="btn btn--outline btn--sm edit-btn"
            aria-label=${this._previewMode ? "Switch to edit" : "Switch to preview"}
            aria-pressed=${!this._previewMode}
            @click=${() => this._togglePreview()}
          >
            ${icon(iconPencilLine)} ${this._previewMode ? "Preview" : "Edit"}
          </button>
          ${this.action
            ? html`<button type="button" class="btn btn--default btn--sm" @click=${() => this.action?.onClick()}>${this.action.label}</button>`
            : nothing}
        </div>
      </header>
    `;
  }

  /** Local UI-only toggle — no shared "preview mode" state exists in
   *  `SectionCtx` yet (see class doc); dispatched as an event so a future
   *  consumer can react without a new ctx field being invented today. */
  private _togglePreview(): void {
    this._previewMode = !this._previewMode;
    this.dispatchEvent(new CustomEvent("previewtoggle", { detail: this._previewMode, bubbles: true, composed: true }));
  }
}

if (!customElements.get("meditor-top-bar")) {
  customElements.define("meditor-top-bar", MeditorTopBar);
}

declare global {
  interface HTMLElementTagNameMap {
    "meditor-top-bar": MeditorTopBar;
  }
}
