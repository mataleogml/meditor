import { LitElement, css, html, nothing, type PropertyValues } from "lit";
import type { Messages } from "../i18n";
import type { FieldDef, Slice, SliceSchema } from "../types";
import "./image-picker-field.element";
import type { FieldFormMedia } from "./image-picker-field.element";
import { controlFor } from "./slice-ops";
import { primitiveStyles } from "./styles";
import { fromYaml, toYaml } from "./yaml";

/**
 * Lit port of `FieldForm`+`YamlField`+`BlockHeader` (field-form.tsx) — the
 * generic property editor for a slice. Control choice (`controlFor`, ported
 * to `slice-ops.ts`), key ordering (existing-then-schema-declared), and every
 * branch (select/boolean/number/textarea/yaml/image/text) port verbatim.
 *
 * `messages` is accepted for interface parity with the other leaf elements
 * (a shell can wire `.messages` uniformly to every child) but currently
 * unused: field-form's strings are hard-coded English today, same as React —
 * the rewrite must not silently expand or shrink i18n coverage.
 *
 * Per-field YAML text/error buffers are plain (non-reactive) `Map`s keyed by
 * field name, not `static properties` — every `set()`/`unset()` swaps the
 * `slice` prop for a *new* object on every keystroke (that's how the shell's
 * one-way data flow works), so resetting buffers on every `slice` change
 * would wipe the very buffer the user is mid-edit in. Buffers persist for the
 * life of this element and are only reset:
 *  - when the whole-block YAML editor (re-)enters raw mode (`_raw` flips to
 *    true) — mirrors React's branch-swap remounting a fresh `YamlField` each
 *    time, so a stale invalid buffer from a previous raw session doesn't
 *    reappear;
 *  - when `slice.slice` (the block's registry name) itself changes — the
 *    only prop the form never writes to, so this is a safe proxy for "the
 *    shell loaded a genuinely different block into this element". This is
 *    the "belt-and-braces" backstop; the primary mechanism is the shell
 *    keying `<meditor-field-form>` on the selected index (Lit `keyed()`),
 *    which fully unmounts/remounts on selection change (React `key={selected}`
 *    parity) — see spec §1.
 */
export class MeditorFieldForm extends LitElement {
  static properties = {
    slice: { attribute: false },
    schema: { attribute: false },
    media: { attribute: false },
    messages: { attribute: false },
    _raw: { state: true },
  };

  declare slice: Slice;
  declare schema?: SliceSchema;
  declare media?: FieldFormMedia;
  declare messages?: Partial<Messages>;
  declare _raw: boolean;

  private readonly _yamlText = new Map<string, string>();
  private readonly _yamlError = new Map<string, string | null>();

  constructor() {
    super();
    this.slice = { slice: "" };
    this._raw = false;
  }

  static styles = [
    primitiveStyles,
    css`
      :host {
        display: block;
      }
      .stack {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
      }
      .row-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
      .badge {
        border-radius: 0.25rem;
        background: var(--scms-muted);
        padding: 0.125rem 0.5rem;
        font-family: ui-monospace, monospace;
        font-size: 0.75rem;
        color: var(--scms-fg);
      }
      .empty {
        font-size: 0.875rem;
        color: var(--scms-muted-fg);
      }
      .yaml-hint {
        color: var(--scms-muted-fg);
      }
      .yaml-error {
        display: block;
        margin-top: 0.25rem;
        font-size: 0.75rem;
        color: var(--scms-destructive);
      }
      .textarea--yaml {
        min-height: 6rem;
        font-family: ui-monospace, monospace;
        font-size: 0.75rem;
      }
      .checkbox-row {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-size: 0.875rem;
        color: var(--scms-fg);
      }
      .checkbox-row input {
        width: 1rem;
        height: 1rem;
        accent-color: var(--scms-primary);
      }
      .image-field {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
      }
    `,
  ];

  protected willUpdate(changed: PropertyValues<this>): void {
    if (changed.has("slice")) {
      const prev = changed.get("slice") as Slice | undefined;
      if (prev && prev.slice !== this.slice.slice) {
        this._yamlText.clear();
        this._yamlError.clear();
        this._raw = false;
      }
    }
    if (changed.has("_raw") && this._raw) {
      // Fresh mount of the whole-block editor — recompute from the current
      // value instead of replaying a stale buffer from a previous session.
      this._yamlText.delete("__whole");
      this._yamlError.delete("__whole");
    }
  }

  private _emitChange(next: Slice) {
    this.dispatchEvent(new CustomEvent<Slice>("change", { detail: next, bubbles: true, composed: true }));
  }

  private _set(key: string, v: unknown) {
    this._emitChange({ ...this.slice, [key]: v });
  }

  private _unset(key: string) {
    const next = { ...this.slice };
    delete next[key];
    this._emitChange(next as Slice);
  }

  private _toggleRaw() {
    this._raw = !this._raw;
  }

  render() {
    if (this._raw) {
      const { slice: name, ...rest } = this.slice;
      return html`
        <div class="stack">
          ${this._renderHeader(name)}
          ${this._renderYamlField(
            "__whole",
            "Entire block",
            rest,
            (v) => this._emitChange({ slice: name, ...(v && typeof v === "object" ? (v as object) : {}) })
          )}
        </div>
      `;
    }

    // Existing props first (source order), then any schema-declared props not
    // yet present — so authors can add optional enums like `align`/`tone`.
    const keys = [
      ...Object.keys(this.slice).filter((k) => k !== "slice"),
      ...Object.keys(this.schema ?? {}).filter((k) => !(k in this.slice)),
    ];

    return html`
      <div class="stack">
        ${this._renderHeader(this.slice.slice)}
        ${keys.length === 0 ? html`<p class="empty">No fields. Use “Edit as YAML” to add some.</p>` : nothing}
        ${keys.map((key) => this._renderField(key))}
      </div>
    `;
  }

  private _renderHeader(name: string) {
    return html`
      <div class="row-head">
        <span class="badge">${name}</span>
        <button type="button" class="btn btn--ghost btn--sm" @click=${() => this._toggleRaw()}>
          ${this._raw ? "Edit fields" : "Edit as YAML"}
        </button>
      </div>
    `;
  }

  private _renderField(key: string) {
    const def: FieldDef | undefined = this.schema?.[key];
    const value = this.slice[key];
    const label = def?.label ?? key;
    const control = controlFor(def, value);

    if (control === "select") {
      const current = typeof value === "string" ? value : "";
      const options = def?.options ?? [];
      return html`
        <div>
          <label class="label">${label}</label>
          <!-- Selectedness lives on the options, NOT as \`.value\` on the
               <select>: Lit commits an element's property bindings before its
               child parts, so \`.value=\${current}\` ran while the <option>s
               didn't exist yet and the browser silently kept index 0. Every enum
               field read back as unset, and editing any other field then saved
               that empty value over the real one. -->
          <select
            class="select"
            @change=${(e: Event) => {
              const v = (e.target as HTMLSelectElement).value;
              if (v === "") this._unset(key);
              else this._set(key, v);
            }}
          >
            <option value="" .selected=${!current}>—</option>
            ${options.map((o) => html`<option value=${o} .selected=${o === current}>${o}</option>`)}
            ${current && !options.includes(current)
              ? html`<option value=${current} .selected=${true}>${current} (custom)</option>`
              : nothing}
          </select>
        </div>
      `;
    }
    if (control === "boolean") {
      return html`
        <label class="checkbox-row">
          <input
            type="checkbox"
            .checked=${value === true}
            @change=${(e: Event) => this._set(key, (e.target as HTMLInputElement).checked)}
          />
          ${label}
        </label>
      `;
    }
    if (control === "number") {
      return html`
        <div>
          <label class="label">${label}</label>
          <input
            class="input"
            type="number"
            .value=${typeof value === "number" ? String(value) : ""}
            @input=${(e: Event) => {
              const raw = (e.target as HTMLInputElement).value;
              this._set(key, raw === "" ? 0 : Number(raw));
            }}
          />
        </div>
      `;
    }
    if (control === "textarea") {
      return html`
        <div>
          <label class="label">${label}</label>
          <textarea
            class="textarea"
            .value=${typeof value === "string" ? value : ""}
            @input=${(e: Event) => this._set(key, (e.target as HTMLTextAreaElement).value)}
          ></textarea>
        </div>
      `;
    }
    if (control === "yaml") {
      return this._renderYamlField(key, label, value, (v) => this._set(key, v));
    }
    if (control === "image") {
      // Every image prop actually present in this codebase is either a bare
      // string or a `{src, alt}` object (see field-schema.ts) — never a bare
      // top-level array (ported verbatim from field-form.tsx's comment).
      const isSrcAlt = value !== null && typeof value === "object" && !Array.isArray(value) && "src" in (value as object);
      if (isSrcAlt) {
        const obj = value as { src?: unknown; alt?: unknown };
        return html`
          <div class="image-field">
            <label class="label">${label}</label>
            <meditor-image-picker
              .value=${typeof obj.src === "string" ? obj.src : ""}
              .media=${this.media}
              @change=${(e: CustomEvent<string>) => this._set(key, { ...obj, src: e.detail })}
            ></meditor-image-picker>
            <input
              class="input"
              placeholder="Alt text"
              .value=${typeof obj.alt === "string" ? obj.alt : ""}
              @input=${(e: Event) => this._set(key, { ...obj, alt: (e.target as HTMLInputElement).value })}
            />
          </div>
        `;
      }
      return html`
        <div>
          <label class="label">${label}</label>
          <meditor-image-picker
            .value=${typeof value === "string" ? value : ""}
            .media=${this.media}
            @change=${(e: CustomEvent<string>) => this._set(key, e.detail)}
          ></meditor-image-picker>
        </div>
      `;
    }
    // "text"
    return html`
      <div>
        <label class="label">${label}</label>
        <input
          class="input"
          .value=${typeof value === "string" ? value : ""}
          @input=${(e: Event) => this._set(key, (e.target as HTMLInputElement).value)}
        />
      </div>
    `;
  }

  private _renderYamlField(key: string, label: string, value: unknown, onCommit: (v: unknown) => void) {
    if (!this._yamlText.has(key)) this._yamlText.set(key, toYaml(value));
    const text = this._yamlText.get(key) ?? "";
    const error = this._yamlError.get(key) ?? null;
    return html`
      <div>
        <label class="label">${label} <span class="yaml-hint">(YAML)</span></label>
        <textarea
          class="textarea textarea--yaml"
          spellcheck="false"
          .value=${text}
          @input=${(e: Event) => {
            const t = (e.target as HTMLTextAreaElement).value;
            this._yamlText.set(key, t);
            const r = fromYaml(t);
            if (r.ok) {
              this._yamlError.set(key, null);
              onCommit(r.value);
            } else {
              this._yamlError.set(key, r.error);
            }
            this.requestUpdate();
          }}
        ></textarea>
        ${error ? html`<span class="yaml-error">${error}</span>` : nothing}
      </div>
    `;
  }
}

if (!customElements.get("meditor-field-form")) {
  customElements.define("meditor-field-form", MeditorFieldForm);
}

declare global {
  interface HTMLElementTagNameMap {
    "meditor-field-form": MeditorFieldForm;
  }
}
