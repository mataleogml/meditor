# Configuration

`CmsConfig` (from `meditor`, `src/types.ts`) is the one object that wires
meditor into your project. Nothing else in the package reads project state
directly — the store, actions, and editor UI all take this (or pieces of it)
as arguments.

```ts
export interface CmsConfig {
  registry: Record<string, ComponentType<unknown>>;
  defaults: Record<string, Record<string, unknown>>;
  fieldSchema?: Record<string, SliceSchema>;
  adapter: ContentAdapter;
  previewPath: string;
  auth?: AuthAdapter;
  /** @deprecated Use `auth`. */
  authorize?(): boolean | Promise<boolean>;
  i18n?: I18nConfig;
  onPublish?(slug: string, locale: string): void | Promise<void>;
  mediaAdapter?: MediaAdapter;
}
```

## `registry`

Slice name → React component. The editor only reads the **keys** (to build
the "add block" menu and validate the schema lookups); it never renders your
components itself — your own preview route does that (see
[getting-started.md](./getting-started.md) step 6). Component props are
untyped (`ComponentType<unknown>`) from meditor's point of view: whatever a
slice's frontmatter carries is passed through verbatim.

## `defaults`

Starter props inserted when an author adds a new block of that slice from
the editor's "+" menu:

```ts
export const defaults = {
  hero: { heading: "Welcome", body: "Say something great." },
};
```

Keep every entry renderable without crashing — this is literally what a
freshly-added block starts as.

## `fieldSchema`

Optional per-slice field hints — see [slices.md](./slices.md) for the full
`FieldDef`/`SliceSchema` shapes (dropdowns via `select`+`options`, `image`
fields, etc.). Props with no entry auto-detect their control from the
runtime value (`string` → text/textarea, `number` → number, `boolean` →
checkbox, object/array → YAML).

## `adapter`

A `ContentAdapter` — the only thing that knows how/where pages are stored.
Ships one implementation, `createMarkdownAdapter` (filesystem + YAML
frontmatter via `gray-matter`); see [architecture.md](./architecture.md) for
the interface and how to write your own (KV, git, a database, …).

```ts
adapter: createMarkdownAdapter({
  contentDir: path.join(process.cwd(), "content"),
  draftDir: path.join(process.cwd(), "content/.drafts"), // optional, defaults to <contentDir>/.drafts
  frontmatterKey: "slices",       // optional, default "slices"
  locales: ["en", "es"],          // optional, default [defaultLocale]
  defaultLocale: "en",            // optional, default "en"
  draftSubdir: ".drafts",         // optional, default ".drafts"
})
```

## `previewPath`

The route your preview page is mounted at, e.g. `"/editor/preview"`.
`EditorShell` iframes `${previewPath}/${slug}?locale=${locale}&v=${n}`.

## `auth` / `authorize`

Set `auth` to an `AuthAdapter` (preferred) — see [auth.md](./auth.md).
`authorize` is a legacy zero-arg boolean gate kept for back-compat; a config
needs exactly one of the two (`resolveAuth` throws at construction otherwise).

## `i18n`

Omit entirely for a single implicit locale (byte-identical to no i18n at
all). Set it to opt into multi-locale content, routing, and the editor's
locale switcher — see [i18n.md](./i18n.md).

```ts
i18n: {
  locales: ["en", "es"],
  defaultLocale: "en",
  routing: "prefix-except-default", // or "prefix-all"
  messages: { es: { "shell.publish": "Publicar" } }, // optional UI-string overrides
}
```

## `onPublish`

Fires after a draft is promoted to published (inside `ContentStore.publish`,
so it also runs when triggered through `makeActions`). Typical use:
`revalidatePath` for the newly-published locale's URL, or a commit to a
git-backed adapter.

```ts
onPublish: async (slug, locale) => {
  revalidatePath(localizedPath(i18n, `/${slug}`, locale));
},
```

## `mediaAdapter`

Optional. Omit to disable media management entirely — `image`-typed fields
still render, just as a plain text input with no "Browse library" button.
See [media.md](./media.md).

## Config vs. `SeoConfig`

`CmsConfig` governs the **editor** (what's editable, how, by whom).
`SeoConfig` (from `meditor/seo`) governs **public rendering** — metadata,
sitemap, robots, JSON-LD — and is a deliberately separate object; see
[seo.md](./seo.md). Most hosts define both, side by side
(`cms.config.ts` + `seo.config.ts`), sharing the same `ContentStore`.
