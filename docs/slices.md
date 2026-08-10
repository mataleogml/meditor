# Slices

A **slice** is one content block: `{ slice: "hero", ...props }`. A page's
frontmatter carries an array of them (key configurable via
`MarkdownAdapterOptions.frontmatterKey`, default `"slices"`):

```md
---
title: Home
slices:
  - slice: hero
    heading: Welcome
    body: Say something great.
  - slice: faq
    items:
      - question: What is this?
        answer: A markdown-based site builder.
---
```

meditor never renders slices itself — it only manages the data. Rendering
(mapping `slice.slice` → a component, in both the real page route and your
preview route) is your own `SliceZone`-style helper, using the same
`registry` you gave `CmsConfig`.

## Registry and defaults

```ts
// types.ts
export type Slice = { slice: string } & Record<string, unknown>;
```

```ts
// slices/registry.ts — slice name -> component, editor reads only the keys
export const registry: Record<string, ComponentType<any>> = {
  hero: Hero,
  faq: Faq,
  cardGrid: CardGrid,
};

// slices/defaults.ts — starter props inserted by the editor's "+" menu
export const defaults: Record<string, Record<string, unknown>> = {
  hero: { heading: "Welcome", body: "Say something great." },
  faq: { items: [{ question: "...", answer: "..." }] },
  cardGrid: { heading: "...", cards: [{ title: "...", body: "..." }] },
};
```

Both are keyed by the same slice name. `registry`'s keys populate the "add
block" menu in `BlockList`; `defaults[name]` is spread onto `{ slice: name }`
when that block is added (`EditorShell`'s `add()`).

## Field schema

`FieldDef` (per prop) and `SliceSchema` (per slice, keyed by prop name):

```ts
export type FieldDef = {
  type?: "text" | "textarea" | "number" | "boolean" | "select" | "yaml" | "image";
  options?: string[]; // for "select"
  label?: string;     // display label, defaults to the prop key
};
export type SliceSchema = Record<string, FieldDef>;
```

Without an entry, `FieldForm` infers the control from the runtime value:
`string` → `text` (or `textarea` if it's long/multiline), `number` →
`number`, `boolean` → checkbox, `null`/`undefined` → `text`,
array/object → `yaml`. Declare a `FieldDef` to override that, most commonly
for enum dropdowns:

```ts
// slices/field-schema.ts
export const fieldSchema: Record<string, SliceSchema> = {
  hero: {
    align: { type: "select", options: ["left", "center"] },
    emphasis: { type: "select", options: ["orange", "amber", "navy"] },
  },
  splitFeature: {
    media: { type: "image" }, // { src, alt } object -> media-library picker
  },
};
```

Pass it as `CmsConfig.fieldSchema`. A schema-declared prop that isn't set on
a given block yet is still listed (so authors can discover and add optional
enums like `align`); an existing value not covered by `options` renders as
`"<value> (custom)"` rather than silently dropping it.

### The `image` field type

Renders `ImagePickerField`: a thumbnail, an editable path input (so a plain
external URL always works), and — when `CmsConfig.mediaAdapter` is
configured — a "Browse library" button. Two shapes are handled:

- a bare string prop (`logo: "/img/foo.webp"`)
- a `{ src, alt }` object prop (`media: { src: "...", alt: "..." }`) — the
  alt text gets its own input alongside the picker

Arrays of `{src, alt}` objects (e.g. `logoWall.logos`, `testimonials[].logo`)
aren't a first-class field type yet and fall through to the YAML editor —
see [editor.md](./editor.md#fieldform) for the escape hatch.

## The YAML escape hatch

Every `FieldForm` has an "Edit as YAML" toggle per slice (the whole block
minus `slice`) for anything the typed controls can't express — arrays of
objects, deeply nested props, one-off shapes. It round-trips through
`js-yaml`; invalid YAML shows an inline error and doesn't commit until fixed.
Any array/object-valued prop *without* a declared `FieldDef` also gets its
own scoped YAML field automatically (not just the whole-block escape hatch).

## Adding a new slice

1. Write the React component as normal.
2. Add `slice-name: Component` to `registry`.
3. Add a renderable starter to `defaults`.
4. Optionally add `SliceSchema` entries to `fieldSchema` for any enum/image
   props.
5. If the slice needs structured data or an AIO markdown rendering, see
   [seo.md](./seo.md) (`sliceJsonLd`, `SliceMarkdownRegistry`) — both
   optional, keyed the same way.

No change to meditor itself is needed — the registry/defaults/schema all
live in your project.
