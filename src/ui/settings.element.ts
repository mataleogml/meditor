import { LitElement, css, html, nothing } from "lit";
import type { SectionCtx } from "../sections";
import type { SiteSettings, SiteSettingsBootstrap, SiteSettingsRuntime } from "../settings";
import type { MediaAsset, Slice, SliceSchema } from "../types";
import "./field-form.element";
import { createT } from "./i18n-strings";
import { icon, iconChevronDown, iconChevronUp, iconSettings, iconTriangleAlert } from "./icons";
import { overlayStyles, primitiveStyles } from "./styles";

/**
 * Lit port of the Settings section (spec §5) — maps the typed
 * `SiteSettingsRuntime` fields onto a flat `SliceSchema` and renders them
 * through `<meditor-field-form>` verbatim (no new form technology), with the
 * same optimistic-lock conflict banner as `<meditor-editor>`/`_publish`
 * (ported from editor.element.ts's `_publish`/`_overwrite`/`_reloadConflict`).
 * A separate collapsible "Advanced" panel edits the bootstrap tier
 * (adminRoute/locales/defaultLocale/routing) via
 * `ctx.settings.bootstrap.writeBootstrap` and shows the pending-redeploy
 * banner from spec §5's admin-route mechanism.
 *
 * Security (addendum #4): `createSettingsStore`'s `saveDraft`/`publish`
 * already gate on the distinct `"admin"` `AuthAction` before touching the
 * adapter (see settings.ts's `guardAdmin`) — a denial throws and surfaces
 * here as a status message, same as any other write failure. `writeBootstrap`
 * itself (`SettingsAdapter`) is a plain fs write with NO auth check baked in,
 * so the "admin" gate for Advanced/bootstrap writes has to live on the
 * *host's* side of the wire: `ctx.settings.bootstrap.writeBootstrap` must be
 * wired through a `"use server"` action that calls
 * `authorize({ action: "admin" })` first, exactly mirroring `guardAdmin()`.
 * This element only ever calls the property it's handed — it has no way to
 * enforce that boundary itself, it can only document the requirement.
 */
const RUNTIME_SCHEMA: SliceSchema = {
  "brand.name": { type: "text", label: "Site name" },
  "brand.logo": { type: "image", label: "Logo" },
  "seo.titleTemplate": { type: "text", label: "SEO title template" },
  "seo.description": { type: "textarea", label: "SEO description" },
  "seo.ogImage": { type: "image", label: "Social share image" },
  "theme.preset": { type: "select", options: ["shadcn", "fdn", "atlas", "neutral"], label: "Theme preset" },
};

const ADVANCED_SCHEMA: SliceSchema = {
  adminRoute: { type: "text", label: "Admin route" },
  locales: { type: "yaml", label: "Locales" },
  defaultLocale: { type: "text", label: "Default locale" },
  routing: { type: "select", options: ["prefix-except-default", "prefix-all"], label: "Routing mode" },
};

const RESERVED_ROUTES = new Set(["api", "_next"]);
const SAFE_ROUTE = /^[a-z0-9][a-z0-9-]*$/i;

// ponytail: the stock image field (`<meditor-image-picker>`) only round-trips
// a bare URL string — same convention as every other image-typed slice prop
// in this codebase (see field-form.element.ts's `isSrcAlt` comment). Full
// `MediaAsset` metadata (size/mime/createdAt) isn't available from the
// picker's `change` event, so it's stashed nowhere; only `.url` survives a
// round trip. Upgrade path: a settings-specific image field wired to
// `MediaAdapter.upload` directly, if size/mime ever need to be read back.
function assetUrl(a: MediaAsset | string | undefined): string {
  if (!a) return "";
  return typeof a === "string" ? a : a.url;
}
function toMediaAsset(url: string): MediaAsset {
  return { id: url, url, name: url, size: 0, mime: "", createdAt: "" };
}

function flattenRuntime(rt: SiteSettingsRuntime): Slice {
  return {
    slice: "Settings",
    "brand.name": rt.brand?.name ?? "",
    "brand.logo": assetUrl(rt.brand?.logo),
    "seo.titleTemplate": rt.seo?.titleTemplate ?? "",
    "seo.description": rt.seo?.description ?? "",
    "seo.ogImage": assetUrl(rt.seo?.ogImage),
    "theme.preset": rt.theme?.preset ?? "",
  };
}

function unflattenRuntime(flat: Record<string, unknown>): SiteSettingsRuntime {
  const name = String(flat["brand.name"] ?? "");
  const logoUrl = String(flat["brand.logo"] ?? "");
  const titleTemplate = String(flat["seo.titleTemplate"] ?? "");
  const description = String(flat["seo.description"] ?? "");
  const ogImageUrl = String(flat["seo.ogImage"] ?? "");
  const preset = String(flat["theme.preset"] ?? "");
  return {
    brand: { name, ...(logoUrl ? { logo: toMediaAsset(logoUrl) } : {}) },
    seo: {
      ...(titleTemplate ? { titleTemplate } : {}),
      ...(description ? { description } : {}),
      ...(ogImageUrl ? { ogImage: toMediaAsset(ogImageUrl) } : {}),
    },
    ...(preset ? { theme: { preset: preset as NonNullable<SiteSettingsRuntime["theme"]>["preset"] } } : {}),
  };
}

function toBootstrapSlice(bs: SiteSettingsBootstrap): Slice {
  return { slice: "Advanced", adminRoute: bs.adminRoute, locales: bs.locales, defaultLocale: bs.defaultLocale, routing: bs.routing };
}

function fromBootstrapSlice(flat: Record<string, unknown>): Partial<SiteSettingsBootstrap> {
  const locales = Array.isArray(flat.locales) ? (flat.locales as unknown[]).map(String) : undefined;
  return {
    adminRoute: String(flat.adminRoute ?? "editor"),
    ...(locales ? { locales } : {}),
    defaultLocale: String(flat.defaultLocale ?? "en"),
    routing: flat.routing === "prefix-all" ? "prefix-all" : "prefix-except-default",
  };
}

/**
 * One-time seed overlay: whatever the host's snapshot carries wins, anything it
 * omits keeps the element's own default. Exported (not inlined in `willUpdate`)
 * so the degrade-on-partial-snapshot behavior is testable — reading
 * `snap.bootstrap.adminRoute` straight used to throw for a host that omitted
 * `bootstrap`, and a throw inside `willUpdate` blanks the whole section
 * silently (`_seeded` stays false, so `render()` returns `nothing`).
 */
export function seedFromSnapshot(
  defaults: Readonly<{ rt: SiteSettingsRuntime; bs: SiteSettingsBootstrap }>,
  snap?: Partial<SiteSettings>
): { rt: SiteSettingsRuntime; bs: SiteSettingsBootstrap } {
  return {
    rt: {
      brand: { ...defaults.rt.brand, ...snap?.brand },
      seo: { ...defaults.rt.seo, ...snap?.seo },
      ...(snap?.theme ? { theme: { ...snap.theme } } : {}),
    },
    bs: { ...defaults.bs, ...snap?.bootstrap },
  };
}

/** SAFE_SLUG-shaped route regex + reserved-word check, same rule the
 *  onboarding wizard's admin-route step uses (spec §6 step 4) — kept as a
 *  standalone one-liner here rather than importing that step's validator, to
 *  avoid coupling this file to the onboarding wave. */
function validateAdminRoute(route: string): string | null {
  if (!SAFE_ROUTE.test(route)) return "Admin route must start with a letter/digit and contain only letters, digits, or hyphens.";
  if (RESERVED_ROUTES.has(route.toLowerCase())) return `"${route}" is a reserved path and can't be used as the admin route.`;
  return null;
}

export class MeditorSettings extends LitElement {
  static properties = {
    ctx: { attribute: false },
    _rt: { state: true },
    _bs: { state: true },
    _dirty: { state: true },
    _busy: { state: true },
    _status: { state: true },
    _version: { state: true },
    _conflict: { state: true },
    _advancedOpen: { state: true },
    _bsDirty: { state: true },
    _bsBusy: { state: true },
    _bsStatus: { state: true },
  };

  declare ctx: SectionCtx;
  declare _rt: SiteSettingsRuntime;
  declare _bs: SiteSettingsBootstrap;
  declare _dirty: boolean;
  declare _busy: boolean;
  declare _status: string;
  declare _version: string | null;
  declare _conflict: boolean;
  declare _advancedOpen: boolean;
  declare _bsDirty: boolean;
  declare _bsBusy: boolean;
  declare _bsStatus: string;

  /** Guards one-time seeding from `ctx.settingsSnapshot` (same purpose as
   *  editor.element.ts's `_seeded` — `ctx` arrives as a property, not a
   *  constructor arg). No initial version is available from `ctx`, so the
   *  first save is a blind write (baseVersion undefined) and every save after
   *  that is a real optimistic-lock check — same behavior an editor gets for
   *  a page that doesn't have a draft yet. */
  private _seeded = false;
  private _initialAdminRoute = "";

  constructor() {
    super();
    this._rt = { brand: { name: "" }, seo: {} };
    this._bs = { adminRoute: "editor", locales: ["en"], defaultLocale: "en", routing: "prefix-except-default", onboarded: false };
    this._dirty = false;
    this._busy = false;
    this._status = "";
    this._version = null;
    this._conflict = false;
    this._advancedOpen = false;
    this._bsDirty = false;
    this._bsBusy = false;
    this._bsStatus = "";
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
      .title {
        display: flex;
        align-items: center;
        gap: 0.375rem;
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
      .banner-text code {
        font-family: ui-monospace, monospace;
        font-size: 0.8125rem;
      }
      .banner-actions {
        display: flex;
        flex-shrink: 0;
        align-items: center;
        gap: 0.5rem;
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
      .divider {
        margin: 1.5rem 0;
        border: none;
        border-top: 1px solid var(--scms-border);
      }
      .advanced-toggle {
        display: inline-flex;
        align-items: center;
        gap: 0.375rem;
        padding: 0;
      }
      .advanced-panel {
        display: flex;
        margin-top: 0.75rem;
        flex-direction: column;
        gap: 0.75rem;
      }
      .advanced-actions {
        display: flex;
        align-items: center;
        gap: 0.75rem;
      }
    `,
  ];

  private get t() {
    return createT(this.ctx?.messages);
  }

  /** All non-optional inputs present — until then, render nothing (wc.tsx's
   *  REQUIRED gate, same as editor.element.ts's `ready`). */
  private get ready(): boolean {
    return this.ctx !== undefined && this._seeded;
  }

  protected willUpdate(): void {
    // One-time seed from ctx.settingsSnapshot, the moment ctx is set (React
    // useState(initial) parity — see editor.element.ts's willUpdate).
    if (!this._seeded && this.ctx !== undefined) {
      const { rt, bs } = seedFromSnapshot({ rt: this._rt, bs: this._bs }, this.ctx.settingsSnapshot);
      this._rt = rt;
      this._bs = bs;
      this._initialAdminRoute = bs.adminRoute;
      this._seeded = true;
    }
  }

  private async _run(label: string, fn: () => Promise<void>): Promise<void> {
    this._busy = true;
    this._status = `${label}…`;
    try {
      await fn();
      if (this._status === `${label}…`) this._status = `${label} ✓`;
    } catch (e) {
      this._status = `${label} failed: ${e instanceof Error ? e.message : String(e)}`;
    } finally {
      this._busy = false;
    }
  }

  private _saveDraft(): void {
    void this._run(this.t("shell.saveDraft"), async () => {
      const res = await this.ctx.settings.saveDraft(this._rt, this._version ?? undefined, this.ctx.locale);
      if (!res.ok) {
        this._conflict = true;
        this._status = "";
        return;
      }
      this._version = res.version;
      this._dirty = false;
    });
  }

  private _publish(): void {
    void this._run(this.t("shell.publish"), async () => {
      // Save at our version first; if that already conflicts, don't publish
      // (mirrors editor.element.ts's `_publish`).
      const saved = await this.ctx.settings.saveDraft(this._rt, this._version ?? undefined, this.ctx.locale);
      if (!saved.ok) {
        this._conflict = true;
        this._status = "";
        return;
      }
      this._version = saved.version;
      const pub = await this.ctx.settings.publish(saved.version, this.ctx.locale);
      if (!pub.ok) {
        this._conflict = true;
        this._status = "";
        return;
      }
      this._dirty = false;
    });
  }

  private _reloadConflict(): void {
    window.location.reload();
  }

  private async _overwrite(): Promise<void> {
    this._busy = true;
    this._status = this.t("shell.overwriting");
    try {
      // Blind write (baseVersion omitted) — our version wins over theirs.
      const res = await this.ctx.settings.saveDraft(this._rt, undefined, this.ctx.locale);
      if (res.ok) {
        this._version = res.version;
        this._conflict = false;
        this._dirty = false;
        this._status = this.t("shell.draftSaved");
      }
    } finally {
      this._busy = false;
    }
  }

  private _switchLocale(next: string): void {
    if (next === this.ctx.locale) return;
    const url = new URL(window.location.href);
    url.searchParams.set("locale", next);
    window.location.href = url.toString();
  }

  private _onFieldChange(e: CustomEvent<Slice>): void {
    const { slice: _drop, ...flat } = e.detail;
    void _drop;
    this._rt = unflattenRuntime(flat);
    this._dirty = true;
    this._status = "";
  }

  private _onBsFieldChange(e: CustomEvent<Slice>): void {
    const { slice: _drop, ...flat } = e.detail;
    void _drop;
    this._bs = { ...this._bs, ...fromBootstrapSlice(flat) };
    this._bsDirty = true;
    this._bsStatus = "";
  }

  private async _saveAdvanced(): Promise<void> {
    const err = validateAdminRoute(this._bs.adminRoute);
    if (err) {
      this._bsStatus = err;
      return;
    }
    if (!this._bs.locales.includes(this._bs.defaultLocale)) {
      this._bsStatus = "Default locale must be one of the locales above.";
      return;
    }
    this._bsBusy = true;
    this._bsStatus = "Saving…";
    try {
      const { adminRoute, locales, defaultLocale, routing } = this._bs;
      // `await` here even though SettingsAdapter#writeBootstrap is typed
      // `void`: the host is expected to wire this through a "use server"
      // admin-gated action (see the class doc comment), which turns the call
      // into an async RPC in practice. Awaiting a non-promise is a no-op, so
      // this is correct either way.
      await this.ctx.settings.bootstrap.writeBootstrap({ adminRoute, locales, defaultLocale, routing });
      this._bsDirty = false;
      this._bsStatus = "Saved";
    } catch (e) {
      this._bsStatus = `Save failed: ${e instanceof Error ? e.message : String(e)}`;
    } finally {
      this._bsBusy = false;
    }
  }

  render() {
    if (!this.ready) return nothing;
    const t = this.t;
    const locales = this.ctx.locales;
    const runtimeSlice = flattenRuntime(this._rt);
    const advancedSlice = toBootstrapSlice(this._bs);
    const adminRouteChanged = this._bs.adminRoute !== this._initialAdminRoute;

    return html`
      <div class="col">
        <header>
          <span class="title">${icon(iconSettings)} Settings</span>
          <span class="status">${this._dirty ? t("shell.unsaved") : this._status || t("shell.upToDate")}</span>
          <div class="actions">
            ${locales.length > 1
              ? html`
                  <!-- \`.selected\` per option, not \`.value\` on the <select> —
                       see field-form.element.ts for why. -->
                  <select
                    class="select locale-select"
                    aria-label=${t("shell.locale")}
                    ?disabled=${this._busy}
                    @change=${(e: Event) => this._switchLocale((e.target as HTMLSelectElement).value)}
                  >
                    ${locales.map((l) => html`<option value=${l} .selected=${l === this.ctx.locale}>${l}</option>`)}
                  </select>
                `
              : nothing}
            <button type="button" class="btn btn--secondary btn--sm" ?disabled=${this._busy || !this._dirty} @click=${() => this._saveDraft()}>
              ${t("shell.saveDraft")}
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
        ${adminRouteChanged
          ? html`
              <div class="banner" role="status">
                <span class="icon-muted" aria-hidden="true">${icon(iconTriangleAlert)}</span>
                <span class="banner-text"
                  >Admin route change pending — run <code>npx meditor apply-settings</code> and redeploy.</span
                >
              </div>
            `
          : nothing}

        <div class="body scroll-area">
          <div class="body-inner">
            <p class="blurb">Brand, SEO and theme — saved as a draft, live once published.</p>
            <meditor-field-form
              .slice=${runtimeSlice}
              .schema=${RUNTIME_SCHEMA}
              .media=${this.ctx.media}
              .messages=${this.ctx.messages}
              @change=${(e: Event) => this._onFieldChange(e as CustomEvent<Slice>)}
            ></meditor-field-form>

            <hr class="divider" />

            <button
              type="button"
              class="btn btn--ghost btn--sm advanced-toggle"
              aria-expanded=${this._advancedOpen ? "true" : "false"}
              @click=${() => (this._advancedOpen = !this._advancedOpen)}
            >
              ${icon(this._advancedOpen ? iconChevronUp : iconChevronDown)} Advanced
            </button>

            ${this._advancedOpen
              ? html`
                  <div class="advanced-panel">
                    <p class="blurb">
                      Locale allowlist, routing mode and the admin route reparameterize what the next boot
                      trusts — saving here writes immediately, but a locale/routing/admin-route change needs
                      <code>npx meditor apply-settings</code> and a redeploy to take effect (see the banner above).
                    </p>
                    <meditor-field-form
                      .slice=${advancedSlice}
                      .schema=${ADVANCED_SCHEMA}
                      @change=${(e: Event) => this._onBsFieldChange(e as CustomEvent<Slice>)}
                    ></meditor-field-form>
                    <div class="advanced-actions">
                      <span class="status">${this._bsStatus}</span>
                      <button
                        type="button"
                        class="btn btn--default btn--sm"
                        ?disabled=${this._bsBusy || !this._bsDirty}
                        @click=${() => this._saveAdvanced()}
                      >
                        Save advanced settings
                      </button>
                    </div>
                  </div>
                `
              : nothing}
          </div>
        </div>
      </div>
    `;
  }
}

customElements.define("meditor-settings", MeditorSettings);

declare global {
  interface HTMLElementTagNameMap {
    "meditor-settings": MeditorSettings;
  }
}
