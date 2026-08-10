# The editor

Everything in this doc is imported from the `meditor/editor` subpath (client
components — the core `meditor` entry stays server-safe). All of it is
"use client" React; a Next host mounts it from a Server Component page that
loads the initial data, same shape as any other RSC → client boundary.

```ts
import {
  EditorShell, SiteEditor, MediaLibrary, PagesNav, DevicePreview,
  BlockList, FieldForm, PreviewBridge, MediaGrid,
  ImagePickerField, CmsIntlProvider, useT,
} from "meditor/editor";
```

## `EditorShell`

The Linear-style three-pane page editor: left nav (pages + this page's
block outline), a device-switchable live preview in the center, a property
panel on the right.

```tsx
<EditorShell
  slug={slug}
  pages={cmsStore.listPages(locale)}
  initialPage={initialPage}         // PageContent: draft ?? published
  initialVersion={cmsStore.currentVersion(slug, locale)}
  sliceNames={Object.keys(cmsConfig.registry)}
  defaults={cmsConfig.defaults}
  fieldSchema={cmsConfig.fieldSchema}
  previewPath={cmsConfig.previewPath}
  actions={actions}                 // PageActions
  media={mediaProp}                 // FieldFormMedia | undefined
  locale={locale}
  locales={locales}                 // omit/default for single-locale sites
  defaultLocale={defaultLocale}
  translatedLocales={translatedLocales}
  isFallback={isFallback}
/>
```

- **Autosave**: edits debounce ~0.8s, then `saveDraft(slug, page, version, locale)`.
  A successful save updates the tracked `version`; a conflict shows the
  reload/overwrite banner (see below) and stops autosaving until resolved.
- **Publish**: saves once more at the current version, then calls
  `publish(slug, version, locale)` if that save didn't conflict, then does a
  full page reload.
- **Discard draft**: confirms, then `discardDraft` + reload.
- **Locale switcher**: only renders when `locales.length > 1`. Switching to
  an already-translated locale just navigates (`?locale=`); switching to an
  untranslated one calls `actions.createTranslation(slug, next)` first
  (seeds a draft copy of the default locale's content), then navigates.
- **Conflict banner**: shown when a `saveDraft`/`publish` call returns
  `{ ok: false, code: "conflict" }` (see [architecture.md](./architecture.md)
  for `SaveResult`). *Reload* discards local edits and reloads with the
  other writer's version; *Overwrite* force-saves (omits `baseVersion`),
  blind-writing over it.
- **On-canvas editing**: clicking a block in the preview selects it in the
  sidebar (and vice versa); double-clicking a text element makes it
  `contenteditable` and, on blur, maps the new text back onto the matching
  string prop of that slice (see `PreviewBridge` below for the mechanism).

## `SiteEditor`

Same shell shape and draft/publish flow as `EditorShell`, but for a single
site-wide document (nav/footer/global copy — anything that isn't a page).
Persisted as `site.md`'s frontmatter via the same `ContentAdapter`/`slug:
"site"` convention; `FieldForm` renders its `meta` fields exactly like a
slice's props.

```tsx
<SiteEditor
  pages={cmsStore.listPages(locale)}
  initialMeta={site.meta}
  actions={actions}
  media={mediaProp}
  locale={locale}
  locales={locales}
  defaultLocale={defaultLocale}
  translatedLocales={translatedLocales}
/>
```

## `MediaLibrary`

Standalone full-page browse/upload/delete view, sharing `PagesNav`'s left
rail (`currentSlug="media"` so no page row highlights).

```tsx
<MediaLibrary
  pages={cmsStore.listPages()}
  media={{ list: actions.listMedia, delete: actions.deleteMedia }}
  uploadPath="/editor/media/upload"
  actions={actions}
/>
```

Renders nothing useful if `CmsConfig.mediaAdapter` was never set — gate the
route yourself (`if (!cmsConfig.mediaAdapter) return <NotConfigured/>`), the
component doesn't check for you. See [media.md](./media.md) for the upload
Route Handler this depends on.

## `PagesNav`

The left rail shared by all three shells above: page list (with new/delete),
translation-status dots per row when `allLocales.length > 1`, links to
"Media library" and "Site settings". Reusable standalone for a custom
`/editor` landing page (an outline-less nav with no `children`):

```tsx
<PagesNav
  pages={cmsStore.listPages()}
  defaultLocale={defaultLocale}
  allLocales={locales}
  onCreate={actions.createPage}
  onDelete={actions.deletePage}
/>
```

## `DevicePreview`

The center pane: desktop/tablet/mobile width presets (`null`/820px/390px),
free drag-resize (down to 320px), and an independent light/dark toggle that
posts `{ __scms: true, type: "theme" }` into the iframe on every toggle and
on reload. `EditorShell` owns the `<iframe>` ref and wires it in; you won't
typically use this standalone.

## `FieldForm`

The property panel for one slice (or `SiteEditor`'s `meta`), driven by
`SliceSchema` — see [slices.md](./slices.md) for the field types and the
"Edit as YAML" escape hatch.

## `PreviewBridge`

Mount this once inside your **preview route** (not the editor route) — it's
what makes the preview clickable/editable:

```tsx
{page.slices.map((s, i) => (
  <div key={i} data-scms-index={i}><SliceZone slices={[s]} /></div>
))}
<PreviewBridge />
```

It listens for clicks on `[data-scms-index]` ancestors (posts a `select`
message to the parent editor window), double-clicks on leaf text nodes
inside them (makes them `contenteditable`, posts an `edit` message with
before/after text on blur), and incoming `theme`/`select`/`scrollTo`
messages from the editor. All `postMessage` traffic is same-origin-checked
on both ends (`e.origin !== window.location.origin` is rejected) and tagged
`{ __scms: true, ... }` so it can't be confused with unrelated `postMessage`
traffic on the page.

## `MediaGrid` / `ImagePickerField`

`MediaGrid` is the shared asset-grid UI (`mode: "library" | "picker"`,
search, upload dropzone) used by both `MediaLibrary` and
`ImagePickerField`'s in-dialog picker. `ImagePickerField` is what
`FieldForm` renders for an `image`-typed prop — see
[slices.md](./slices.md#the-image-field-type) and
[media.md](./media.md).

## `CmsIntlProvider` / `useT`

Editor-UI strings (button labels, banners, confirm dialogs — not your
content) are translatable independently of content locale. Mount the
provider once around the editor tree (e.g. in `app/editor/layout.tsx`);
`useT()` is what every editor component calls internally. See
[i18n.md](./i18n.md#editor-ui-strings).
