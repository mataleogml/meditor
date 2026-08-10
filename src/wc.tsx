"use client";

// Framework-agnostic entry: wraps the React editor in a custom element so any
// host (Vue, Svelte, Astro, vanilla) can mount `<meditor-editor>` without
// knowing React. Uses the consumer's installed React/react-dom (optional
// peers) — no bundler, no extra runtime dependency. See docs/web-component.md
// for the non-React integration contract (actions as fetch-wrappers, etc.).

import type { ComponentProps } from "react";
import { createRoot, type Root } from "react-dom/client";
import { EditorShell } from "./ui/editor-shell";
import { CmsIntlProvider } from "./ui/intl";

type ShellProps = ComponentProps<typeof EditorShell>;

// EditorShell's props are `Readonly<…>`; strip that so the element's properties
// are assignable (`el.slug = …`).
type Writable<T> = { -readonly [K in keyof T]: T[K] };

/** Every JS property exposed on `<meditor-editor>`. These mirror `EditorShell`'s
 *  props (all of them, not just the required ones) plus `messages`, which is
 *  handed to the surrounding `CmsIntlProvider`. They are set as JS **properties**
 *  (not HTML attributes) because most are objects/functions; assigning any after
 *  the element is connected re-renders. */
export type MeditorEditorProps = Writable<ShellProps> & {
  /** Host UI-string overrides, deep-merged onto the English defaults. */
  messages?: ComponentProps<typeof CmsIntlProvider>["messages"];
};

// The properties, in registration order. `satisfies` proves every entry is a
// real key so the list can't drift from MeditorEditorProps.
const PROP_KEYS = [
  "slug",
  "pages",
  "initialPage",
  "initialVersion",
  "sliceNames",
  "defaults",
  "fieldSchema",
  "previewPath",
  "actions",
  "media",
  "locale",
  "locales",
  "defaultLocale",
  "translatedLocales",
  "isFallback",
  "messages",
] as const satisfies readonly (keyof MeditorEditorProps)[];

// EditorShell's non-optional props. Until all are present we render nothing,
// so partial property-setting (before the host has supplied everything) can't
// crash the shell.
const REQUIRED = [
  "slug",
  "pages",
  "initialPage",
  "initialVersion",
  "sliceNames",
  "defaults",
  "previewPath",
  "actions",
] as const satisfies readonly (keyof ShellProps)[];

// Merges with the `interface MeditorEditorElement` below so the reactive
// prototype properties are typed on the element — deliberate, hence the disable.
// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export class MeditorEditorElement extends HTMLElement {
  // Internal state. Underscore-prefixed (not `#private`) so the prototype
  // property loop below can reach it without ES2020 downleveling quirks.
  _props: Partial<MeditorEditorProps> = {};
  _root: Root | null = null;
  _scheduled = false;

  connectedCallback(): void {
    if (!this._root) this._root = createRoot(this);
    this._render();
  }

  disconnectedCallback(): void {
    this._root?.unmount();
    this._root = null;
    this._scheduled = false;
  }

  // Batch multiple synchronous property sets into one render.
  _schedule(): void {
    if (!this._root || this._scheduled) return;
    this._scheduled = true;
    queueMicrotask(() => {
      this._scheduled = false;
      this._render();
    });
  }

  _render(): void {
    if (!this._root) return;
    const { messages, ...shell } = this._props;
    const ready = REQUIRED.every((k) => shell[k] !== undefined);
    this._root.render(
      ready ? (
        <CmsIntlProvider messages={messages}>
          <EditorShell {...(shell as ShellProps)} />
        </CmsIntlProvider>
      ) : null
    );
  }
}

// Reactive JS properties on the prototype. Storing in `_props` (not the element
// itself) keeps the accessor from shadowing its own backing value.
for (const key of PROP_KEYS) {
  Object.defineProperty(MeditorEditorElement.prototype, key, {
    get(this: MeditorEditorElement) {
      return this._props[key];
    },
    set(this: MeditorEditorElement, value: unknown) {
      (this._props as Record<string, unknown>)[key] = value;
      this._schedule();
    },
    enumerable: true,
    configurable: true,
  });
}

// The prototype loop adds the props dynamically; declare them for TypeScript so
// `el.slug = …` is fully typed on the element.
// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging, @typescript-eslint/no-empty-object-type
export interface MeditorEditorElement extends MeditorEditorProps {}

/** Register the custom element. Idempotent (guards `customElements.get`); safe
 *  to call from every consumer. No-op where `customElements` is absent (SSR). */
export function defineMeditorEditor(tag = "meditor-editor"): void {
  if (typeof customElements === "undefined") return;
  if (!customElements.get(tag)) customElements.define(tag, MeditorEditorElement);
}

// Auto-register under the default tag when running in a browser. (A bundler
// with `sideEffects:false` may drop this — call defineMeditorEditor() yourself
// to be certain; see docs/web-component.md.)
defineMeditorEditor();

declare global {
  interface HTMLElementTagNameMap {
    "meditor-editor": MeditorEditorElement;
  }
}
