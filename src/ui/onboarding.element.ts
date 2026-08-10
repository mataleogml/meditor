import { LitElement, html, css, nothing, type PropertyValues } from "lit";
import type { MediaAsset } from "../types";
import type { SectionCtx } from "../sections";
import type { SiteSettingsBootstrap, SiteSettingsRuntime } from "../settings";
import { resolveI18n, type RoutingMode } from "../i18n";
import "./image-picker-field.element";
import { overlayStyles, primitiveStyles } from "./styles";
import { icon, iconTriangleAlert } from "./icons";

/** Mirrors markdown-adapter.ts's SAFE_SLUG shape (not exported from there —
 *  small, self-contained duplication rather than a cross-file export just for
 *  this one regex). */
const SAFE_ROUTE = /^[a-z0-9][a-z0-9-]*$/;
const RESERVED_ROUTES = new Set(["api", "_next"]);
const STEP_ORDER = ["brand", "seo", "locales", "admin-route"] as const;

export type OnboardingStep = "brand" | "seo" | "locales" | "admin-route" | "done";

/** Pure, resumable derivation — the whole wizard's "current step" lives here,
 *  never in a separate WIP record. A reload just re-runs this against
 *  whatever is on disk. Note (ponytail ceiling): re-offers a step if its
 *  always-filled field is later left blank (no per-step completion flags);
 *  `bootstrap.onboarded` is what actually ends the loop for the last step. */
export function detectStep(rt: SiteSettingsRuntime, bs: SiteSettingsBootstrap): OnboardingStep {
  if (!rt.brand?.name) return "brand";
  if (!rt.seo?.description) return "seo";
  if (bs.locales.length === 0) return "locales"; // never empty post-default merge in practice
  if (!bs.onboarded) return "admin-route";
  return "done";
}

/**
 * First-run visual setup tool (spec §6 / addendum #2) — mounted instead of
 * the section region while `!bootstrap.onboarded`. Every step writes
 * IMMEDIATELY through `ctx.settings` (runtime: brand/seo, gated on the
 * "admin" auth action inside SettingsStore) or `ctx.settings.bootstrap`
 * (locales/admin-route/finish) — nothing is held in local-only state past a
 * single in-flight edit, so a refresh mid-wizard resumes at `detectStep`'s
 * verdict, never a stale wizard-local step.
 */
export class MeditorOnboarding extends LitElement {
  static properties = {
    ctx: { attribute: false },
    _rt: { state: true },
    _bs: { state: true },
    _step: { state: true },
    _busy: { state: true },
    _error: { state: true },
    _brandName: { state: true },
    _brandLogoUrl: { state: true },
    _seoTitleTemplate: { state: true },
    _seoDescription: { state: true },
    _seoOgUrl: { state: true },
    _localeCodes: { state: true },
    _defaultLocale: { state: true },
    _routing: { state: true },
    _adminRoute: { state: true },
  };

  declare ctx?: SectionCtx;
  declare _rt: SiteSettingsRuntime;
  declare _bs: SiteSettingsBootstrap;
  declare _step: OnboardingStep;
  declare _busy: boolean;
  declare _error: string;
  declare _brandName: string;
  declare _brandLogoUrl: string;
  declare _seoTitleTemplate: string;
  declare _seoDescription: string;
  declare _seoOgUrl: string;
  declare _localeCodes: string[];
  declare _defaultLocale: string;
  declare _routing: RoutingMode;
  declare _adminRoute: string;

  private _loaded = false;

  constructor() {
    super();
    this._rt = { brand: { name: "" }, seo: {} };
    this._bs = { adminRoute: "editor", locales: ["en"], defaultLocale: "en", routing: "prefix-except-default", onboarded: false };
    this._step = "brand";
    this._busy = false;
    this._error = "";
    this._brandName = "";
    this._brandLogoUrl = "";
    this._seoTitleTemplate = "";
    this._seoDescription = "";
    this._seoOgUrl = "";
    this._localeCodes = ["en"];
    this._defaultLocale = "en";
    this._routing = "prefix-except-default";
    this._adminRoute = "editor";
  }

  static styles = [
    primitiveStyles,
    overlayStyles,
    css`
      :host {
        align-items: center;
        justify-content: center;
        padding: 1.5rem;
      }
      .card {
        display: flex;
        flex-direction: column;
        width: 100%;
        max-width: 32rem;
        max-height: 100%;
        border: 1px solid var(--scms-border);
        border-radius: 0.75rem;
        background: var(--scms-bg);
        box-shadow: 0 1px 3px rgb(0 0 0 / 0.1);
      }
      header {
        padding: 1.5rem 1.5rem 0;
      }
      .eyebrow {
        margin: 0 0 0.25rem;
        font-size: 0.75rem;
        font-weight: 600;
        letter-spacing: 0.02em;
        color: var(--scms-muted-fg);
        text-transform: uppercase;
      }
      h1 {
        margin: 0 0 1rem;
        font-size: 1.125rem;
        font-weight: 600;
        color: var(--scms-fg);
      }
      .steps {
        display: flex;
        gap: 0.375rem;
        padding: 0 1.5rem;
      }
      .dot {
        height: 0.375rem;
        flex: 1 1 0%;
        border-radius: 9999px;
        background: var(--scms-muted);
      }
      .dot--done,
      .dot--current {
        background: var(--scms-primary);
      }
      .body {
        flex: 1 1 auto;
        min-height: 0;
        overflow-y: auto;
        padding: 1.25rem 1.5rem;
      }
      .stack {
        display: flex;
        flex-direction: column;
        gap: 0.875rem;
      }
      .hint {
        margin: -0.5rem 0 0;
        font-size: 0.75rem;
        color: var(--scms-muted-fg);
      }
      .notice {
        display: flex;
        gap: 0.5rem;
        border-radius: 0.5rem;
        background: var(--scms-muted);
        padding: 0.625rem 0.75rem;
        font-size: 0.75rem;
        color: var(--scms-fg);
      }
      .notice svg {
        flex-shrink: 0;
        width: 1rem;
        height: 1rem;
        color: var(--scms-muted-fg);
      }
      .radio-row {
        display: flex;
        align-items: flex-start;
        gap: 0.5rem;
        font-size: 0.8125rem;
        color: var(--scms-fg);
      }
      .radio-row input {
        margin-top: 0.1875rem;
        accent-color: var(--scms-primary);
      }
      fieldset {
        border: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
      }
      legend {
        padding: 0;
        margin-bottom: 0.375rem;
        font-size: 0.75rem;
        font-weight: 500;
        color: var(--scms-muted-fg);
      }
      .locale-row {
        display: flex;
        gap: 0.5rem;
        align-items: flex-end;
      }
      .locale-row .input {
        flex: 1 1 auto;
      }
      .done {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.75rem;
        padding: 1.5rem 0;
        text-align: center;
      }
      footer {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        border-top: 1px solid var(--scms-border);
        padding: 1rem 1.5rem;
      }
      .error {
        font-size: 0.75rem;
        color: var(--scms-destructive);
      }
      .spacer {
        flex: 1 1 auto;
      }
    `,
  ];

  protected willUpdate(changed: PropertyValues<this>): void {
    if (changed.has("ctx") && this.ctx && !this._loaded) {
      this._loaded = true;
      void this._refresh();
    }
  }

  private async _refresh(): Promise<void> {
    if (!this.ctx) return;
    this._rt = this.ctx.settings.get(this.ctx.locale);
    this._bs = this.ctx.settings.bootstrap.readBootstrap();
    this._step = detectStep(this._rt, this._bs);
    this._initDraftForStep();
  }

  private _initDraftForStep(): void {
    switch (this._step) {
      case "brand":
        this._brandName = this._rt.brand?.name ?? "";
        this._brandLogoUrl = this._rt.brand?.logo?.url ?? "";
        break;
      case "seo":
        this._seoTitleTemplate = this._rt.seo?.titleTemplate ?? "";
        this._seoDescription = this._rt.seo?.description ?? "";
        this._seoOgUrl = this._rt.seo?.ogImage?.url ?? "";
        break;
      case "locales": {
        const codes = this._bs.locales.length ? this._bs.locales : ["en"];
        this._localeCodes = codes;
        this._defaultLocale = codes.includes(this._bs.defaultLocale) ? this._bs.defaultLocale : (codes[0] ?? "en");
        this._routing = this._bs.routing;
        break;
      }
      case "admin-route":
        this._adminRoute = this._bs.adminRoute || "editor";
        break;
      case "done":
        break;
    }
  }

  /** The picker only round-trips a bare URL string (image-picker-field's
   *  `change` event) — resolve it back to the full MediaAsset via the same
   *  `media.list()` the picker itself uses, so brand/seo store real metadata
   *  for anything actually uploaded/selected through it. ponytail: a
   *  hand-typed/external URL has no adapter-known metadata, so that case gets
   *  a minimal stub — upgrade path is the picker bubbling its full asset. */
  private async _assetFor(url: string): Promise<MediaAsset | undefined> {
    if (!url) return undefined;
    const list = (await this.ctx?.media?.list()) ?? [];
    const found = list.find((a) => a.url === url);
    if (found) return found;
    return { id: url, url, name: url.split("/").pop() || url, size: 0, mime: "", createdAt: new Date().toISOString() };
  }

  private async _commitRuntime(patch: Partial<SiteSettingsRuntime>): Promise<void> {
    if (!this.ctx || this._busy) return;
    this._busy = true;
    this._error = "";
    try {
      const next: SiteSettingsRuntime = { ...this._rt, ...patch };
      const saved = await this.ctx.settings.saveDraft(next, undefined, this.ctx.locale);
      if (!saved.ok) throw new Error("Settings changed elsewhere — reload and try again.");
      const published = await this.ctx.settings.publish(undefined, this.ctx.locale);
      if (!published.ok) throw new Error("Settings changed elsewhere — reload and try again.");
      await this._refresh();
    } catch (e) {
      this._error = e instanceof Error ? e.message : String(e);
    } finally {
      this._busy = false;
    }
  }

  private async _commitBootstrap(patch: Partial<SiteSettingsBootstrap>): Promise<void> {
    if (!this.ctx || this._busy) return;
    this._busy = true;
    this._error = "";
    try {
      this.ctx.settings.bootstrap.writeBootstrap(patch);
      await this._refresh();
    } catch (e) {
      this._error = e instanceof Error ? e.message : String(e);
    } finally {
      this._busy = false;
    }
  }

  private async _nextBrand(): Promise<void> {
    const name = this._brandName.trim();
    if (!name) {
      this._error = "Site name is required.";
      return;
    }
    const logo = this._brandLogoUrl.trim() ? await this._assetFor(this._brandLogoUrl.trim()) : undefined;
    await this._commitRuntime({ brand: { name, logo } });
  }

  private async _nextSeo(): Promise<void> {
    const description = this._seoDescription.trim();
    if (!description) {
      this._error = "A short description is required.";
      return;
    }
    const ogImage = this._seoOgUrl.trim() ? await this._assetFor(this._seoOgUrl.trim()) : undefined;
    await this._commitRuntime({
      seo: { titleTemplate: this._seoTitleTemplate.trim() || undefined, description, ogImage },
    });
  }

  private _setLocaleCount(n: number): void {
    const count = Math.max(1, Math.min(6, n));
    this._localeCodes = Array.from({ length: count }, (_, i) => this._localeCodes[i] ?? "");
    if (!this._localeCodes.includes(this._defaultLocale)) this._defaultLocale = this._localeCodes[0] ?? "";
  }

  private _setLocaleCode(i: number, code: string): void {
    const next = [...this._localeCodes];
    next[i] = code;
    this._localeCodes = next;
  }

  private async _nextLocales(): Promise<void> {
    const codes = this._localeCodes.map((c) => c.trim()).filter(Boolean);
    if (codes.length === 0) {
      this._error = "Enter at least one locale code.";
      return;
    }
    try {
      resolveI18n({ locales: codes, defaultLocale: this._defaultLocale, routing: this._routing });
    } catch (e) {
      this._error = e instanceof Error ? e.message : String(e);
      return;
    }
    await this._commitBootstrap({ locales: codes, defaultLocale: this._defaultLocale, routing: this._routing });
  }

  /** Last screen — folds spec steps 4 ("admin route", writes bootstrap) and 5
   *  ("Finish", `writeBootstrap({onboarded:true})`) into one write. Splitting
   *  them would leave `onboarded` false whenever the chosen route already
   *  equals the default "editor" — `detectStep` would then re-offer this same
   *  step forever, since it has no other way to tell "kept on purpose" apart
   *  from "never visited". */
  private async _finish(): Promise<void> {
    const route = this._adminRoute.trim().toLowerCase();
    if (!SAFE_ROUTE.test(route)) {
      this._error = "Admin route must be lowercase letters, numbers, and dashes, starting with a letter or number.";
      return;
    }
    // `listSlugs()` is a synchronous fs read, so it only resolves when the ctx
    // was assembled server-side. A browser-assembled ctx (the normal case in an
    // RSC host) has no adapter, and the collision check degrades to the reserved
    // words alone — picking an admin route that shadows an existing page slug
    // would then get through here. Upgrade path: carry the slug list as DATA on
    // the ctx so the check doesn't need server reach at all.
    const reserved = new Set([...RESERVED_ROUTES, ...(this.ctx?.config.adapter?.listSlugs() ?? [])]);
    if (reserved.has(route)) {
      this._error = `"${route}" is already in use — pick a different admin route.`;
      return;
    }
    await this._commitBootstrap({ adminRoute: route, onboarded: true });
  }

  render() {
    if (!this.ctx) return nothing;
    return html`
      <div class="card">
        <header>
          <p class="eyebrow">Set up meditor</p>
          <h1>${this._title()}</h1>
        </header>
        ${this._step === "done" ? nothing : this._renderSteps()}
        <div class="body scroll-area">${this._renderStep()}</div>
        ${this._step === "done" ? nothing : this._renderFooter()}
      </div>
    `;
  }

  private _title(): string {
    switch (this._step) {
      case "brand":
        return "Brand";
      case "seo":
        return "Search & sharing";
      case "locales":
        return "Languages";
      case "admin-route":
        return "Admin route";
      case "done":
        return "You're all set";
    }
  }

  private _renderSteps() {
    const idx = STEP_ORDER.indexOf(this._step as (typeof STEP_ORDER)[number]);
    return html`
      <div class="steps">
        ${STEP_ORDER.map((s, i) => html`<span class="dot ${i < idx ? "dot--done" : i === idx ? "dot--current" : ""}"></span>`)}
      </div>
    `;
  }

  private _renderFooter() {
    const label = this._step === "admin-route" ? "Finish setup" : "Next";
    const onClick =
      this._step === "brand"
        ? () => this._nextBrand()
        : this._step === "seo"
          ? () => this._nextSeo()
          : this._step === "locales"
            ? () => this._nextLocales()
            : () => this._finish();
    return html`
      <footer>
        ${this._error ? html`<span class="error">${this._error}</span>` : nothing}
        <span class="spacer"></span>
        <button type="button" class="btn btn--default btn--sm" ?disabled=${this._busy} @click=${onClick}>
          ${this._busy ? "Saving…" : label}
        </button>
      </footer>
    `;
  }

  private _renderStep() {
    switch (this._step) {
      case "brand":
        return this._renderBrand();
      case "seo":
        return this._renderSeo();
      case "locales":
        return this._renderLocales();
      case "admin-route":
        return this._renderAdminRoute();
      case "done":
        return this._renderDone();
    }
  }

  private _renderBrand() {
    return html`
      <div class="stack">
        <div>
          <label class="label">Site name</label>
          <input
            class="input"
            .value=${this._brandName}
            placeholder="My Site"
            @input=${(e: Event) => (this._brandName = (e.target as HTMLInputElement).value)}
          />
        </div>
        <div>
          <label class="label">Logo (optional)</label>
          <meditor-image-picker
            .value=${this._brandLogoUrl}
            .media=${this.ctx?.media}
            @change=${(e: CustomEvent<string>) => (this._brandLogoUrl = e.detail)}
          ></meditor-image-picker>
        </div>
      </div>
    `;
  }

  private _renderSeo() {
    return html`
      <div class="stack">
        <div>
          <label class="label">Title template</label>
          <input
            class="input"
            .value=${this._seoTitleTemplate}
            placeholder="%s | My Site"
            @input=${(e: Event) => (this._seoTitleTemplate = (e.target as HTMLInputElement).value)}
          />
          <p class="hint">%s is replaced with each page's own title.</p>
        </div>
        <div>
          <label class="label">Description</label>
          <textarea
            class="textarea"
            .value=${this._seoDescription}
            @input=${(e: Event) => (this._seoDescription = (e.target as HTMLTextAreaElement).value)}
          ></textarea>
        </div>
        <div>
          <label class="label">Social share image (optional)</label>
          <meditor-image-picker
            .value=${this._seoOgUrl}
            .media=${this.ctx?.media}
            @change=${(e: CustomEvent<string>) => (this._seoOgUrl = e.detail)}
          ></meditor-image-picker>
        </div>
      </div>
    `;
  }

  private _renderLocales() {
    return html`
      <div class="stack">
        <div class="notice">${icon(iconTriangleAlert)}<span>Changing languages needs a dev-server restart (or a redeploy in production) to take effect.</span></div>
        <div>
          <label class="label">Number of languages</label>
          <!-- \`.selected\` per option, not \`.value\` on the <select> — see
               field-form.element.ts for why. -->
          <select
            class="select"
            @change=${(e: Event) => this._setLocaleCount(Number((e.target as HTMLSelectElement).value))}
          >
            ${[1, 2, 3, 4, 5, 6].map(
              (n) => html`<option value=${n} .selected=${n === this._localeCodes.length}>${n}</option>`
            )}
          </select>
        </div>
        ${this._localeCodes.map(
          (code, i) => html`
            <div class="locale-row">
              <div class="input-wrap" style="flex:1 1 auto">
                <label class="label">Locale ${i + 1} code</label>
                <input class="input" placeholder="en" .value=${code} @input=${(e: Event) => this._setLocaleCode(i, (e.target as HTMLInputElement).value)} />
              </div>
            </div>
          `
        )}
        <div>
          <label class="label">Default locale</label>
          <select class="select" @change=${(e: Event) => (this._defaultLocale = (e.target as HTMLSelectElement).value)}>
            ${this._localeCodes
              .filter(Boolean)
              .map((c) => html`<option value=${c} .selected=${c === this._defaultLocale}>${c}</option>`)}
          </select>
        </div>
        <fieldset>
          <legend>URL routing</legend>
          <label class="radio-row">
            <input
              type="radio"
              name="onboarding-routing"
              ?checked=${this._routing === "prefix-except-default"}
              @change=${() => (this._routing = "prefix-except-default")}
            />
            <span>Default locale unprefixed (<code>/about</code>), others prefixed (<code>/es/about</code>)</span>
          </label>
          <label class="radio-row">
            <input
              type="radio"
              name="onboarding-routing"
              ?checked=${this._routing === "prefix-all"}
              @change=${() => (this._routing = "prefix-all")}
            />
            <span>Every locale prefixed (<code>/en/about</code>)</span>
          </label>
        </fieldset>
      </div>
    `;
  }

  private _renderAdminRoute() {
    return html`
      <div class="stack">
        <div>
          <label class="label">Admin route</label>
          <input class="input" .value=${this._adminRoute} placeholder="editor" @input=${(e: Event) => (this._adminRoute = (e.target as HTMLInputElement).value)} />
          <p class="hint">The editor will be reachable at /${this._adminRoute || "editor"}.</p>
        </div>
        <div class="notice">
          ${icon(iconTriangleAlert)}
          <span>Changing this needs <code>npx meditor apply-settings</code> and a redeploy before the new path is live. The editor stays reachable at /editor until then.</span>
        </div>
      </div>
    `;
  }

  private _renderDone() {
    return html`
      <div class="done">
        <p>Setup complete — you're ready to start editing.</p>
        <button type="button" class="btn btn--default btn--sm" @click=${() => this.ctx?.navigate("pages")}>Go to Pages</button>
      </div>
    `;
  }
}

if (!customElements.get("meditor-onboarding")) {
  customElements.define("meditor-onboarding", MeditorOnboarding);
}

declare global {
  interface HTMLElementTagNameMap {
    "meditor-onboarding": MeditorOnboarding;
  }
}
