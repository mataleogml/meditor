# Embedding the editor as a Web Component

`meditor/wc` wraps the React editor (`EditorShell` + `CmsIntlProvider`) in a
custom element, so a non-React host — Vue, Svelte, Astro, or plain HTML — can
mount the visual editor without touching React itself.

```ts
import { defineMeditorEditor } from "meditor/wc";
defineMeditorEditor(); // registers <meditor-editor> (idempotent)
```

Importing the module also auto-registers under the default tag `meditor-editor`
when `customElements` exists. Call `defineMeditorEditor()` explicitly anyway —
a bundler configured with `sideEffects:false` (this package is) may drop the
auto-registration, and the explicit call is the reliable path. Pass a tag to
register under a different name: `defineMeditorEditor("my-editor")`.

## Properties, not attributes

Almost every input the editor needs is an object or a function (pages,
`initialPage`, `actions`, `fieldSchema`, `messages`…), which HTML attributes
can't carry. So the element reads its inputs as **JS properties**. Set them on
the element instance; assigning any of them after the element is connected
re-renders (batched to one render per microtask).

| Property | Type | Required |
|---|---|---|
| `slug` | `string` | yes |
| `pages` | `PageInfo[]` | yes |
| `initialPage` | `PageContent` | yes |
| `initialVersion` | `string \| null` | yes (may be `null`) |
| `sliceNames` | `string[]` | yes |
| `defaults` | `Record<string, Record<string, unknown>>` | yes |
| `previewPath` | `string` | yes |
| `actions` | `PageActions` | yes |
| `fieldSchema` | `Record<string, SliceSchema>` | no |
| `media` | `FieldFormMedia` | no |
| `locale` / `locales` / `defaultLocale` / `translatedLocales` | i18n props | no |
| `isFallback` | `boolean` | no |
| `messages` | `Partial<Messages>` (UI-string overrides) | no |

Until all the **required** properties are set the element renders nothing, so
it's safe to create the element, set properties in any order, then connect it.
`MeditorEditorProps` is exported for typing the values.

```ts
import type { MeditorEditorElement } from "meditor/wc";

const el = document.createElement("meditor-editor") as MeditorEditorElement;
el.slug = "home";
el.pages = pages;
el.initialPage = page;
el.initialVersion = version;      // or null
el.sliceNames = Object.keys(registry);
el.defaults = defaults;
el.previewPath = "/editor/preview";
el.actions = actions;             // see below
document.body.append(el);
```

Vue (`<meditor-editor :slug="slug" :pages="pages" …>`), Svelte, Astro islands,
and Angular all bind to element **properties** the same way — they set the JS
properties the class exposes, not attributes. In frameworks that default to
attributes for unknown elements (some Vue/Angular setups), use the
property-binding form (`.prop`, `[prop]`, `:prop` per framework) for the object
values.

## The real integration contract for a non-React host

The Web Component only solves *rendering* the editor. The editor still drives
mutations and a live preview, and those are **server** concerns that meditor's
core (not React) handles. On a non-React host you wire three things yourself:

1. **Run the core on your Node server, behind HTTP endpoints.**
   `makeActions(config)` / `createStore(adapter)` are plain async functions that
   read and write the filesystem (via `createMarkdownAdapter` / node:fs). Run
   them in your host's server (Hono, Express, Nitro, SvelteKit endpoints,
   Astro API routes…) and expose one endpoint per `PageActions` method. This is
   identical to the Next reference host — Next just happens to wrap the same
   functions in Server Actions. See
   [framework-agnostic.md](./framework-agnostic.md) for the endpoint sketch.

2. **Pass `actions` as fetch-wrappers hitting those endpoints.** The element's
   `actions` property is a `PageActions` object; each method is a thin `fetch`
   to the matching endpoint:

   ```ts
   el.actions = {
     saveDraft: (slug, page, baseVersion, locale) =>
       fetch("/api/editor/save-draft", {
         method: "POST",
         body: JSON.stringify({ slug, page, baseVersion, locale }),
       }).then((r) => r.json()),
     // discardDraft, publish, createPage, createTranslation,
     // deletePage, deleteTranslation — one wrapper each
   };
   ```

3. **Point `previewPath` at your host's own preview route.** The editor shows a
   same-origin `<iframe>` at `${previewPath}/${slug}`. That route is **your**
   app rendering **your** slice components (React is not involved in the
   preview) with `data-scms-index` wrapper attributes, so the shared
   `postMessage` bridge (block select + inline edits) keeps working. The bridge
   protocol is framework-agnostic — see `PreviewBridge` and
   [framework-agnostic.md](./framework-agnostic.md#minimal-non-next-wiring-sketch).

So: your slices render in **your** framework in the preview iframe; the *editor
chrome* is meditor's React, mounted through this element; and the *core* runs on
your server. The element is the bridge between your host and meditor's React UI
— nothing more.

## React is an optional peer

`react` and `react-dom` are **optional** peer dependencies. Core/data-only
consumers (`meditor`, `meditor/i18n`, `meditor/auth/*`) install neither. The
editor paths — `meditor/editor` and `meditor/wc` — need them, and the element
uses **the consumer's installed React**. So a non-React host must still
`npm install react react-dom` for the editor route to work; the WC does not
bundle its own copy.

### Limitation: not a self-contained bundle (yet)

Because the element uses the consumer's React, this is **not** a drop-in
`<script>` you can load on a page with no build step. A fully self-contained
build — React inlined via a bundler, shipping one script that registers the
element with zero peer dependencies — is a sensible future addition but is
**not** done here. Today's contract is "custom element, consumer supplies
React", which fits app hosts (Vue/Svelte/Astro/Angular apps that already run a
bundler) cleanly and keeps React out of the core for everyone else.
