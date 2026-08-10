# Getting started

This wires the full editor surface into a Next App Router project: config,
Server Actions, the page editor, the preview route, site settings, and the
media library. (For non-Next hosts, see
[framework-agnostic.md](./framework-agnostic.md) — the config/store/actions
layer below is identical either way; only the route glue differs.)

For a scaffolded starting point instead of wiring by hand, run
`npx meditor init` (or `bunx meditor init`).

## 1. Define your slices

A slice is `{ slice: "name", ...props }`. You already have React components
for these — meditor just needs a name → component map and starter props:

```ts
// slices/registry.ts
import type { ComponentType } from "react";
import { Hero } from "./hero";
import { Faq } from "./faq";

export const registry: Record<string, ComponentType<any>> = {
  hero: Hero,
  faq: Faq,
};
```

```ts
// slices/defaults.ts
export const defaults: Record<string, Record<string, unknown>> = {
  hero: { heading: "Welcome", body: "Say something great." },
  faq: { items: [{ question: "What is this?", answer: "..." }] },
};
```

See [slices.md](./slices.md) for the full `FieldDef`/`SliceSchema` reference
(dropdowns, image fields, etc.).

## 2. Wire `CmsConfig`

```ts
// cms.config.ts
import "server-only";
import path from "node:path";
import { createMarkdownAdapter, createFsMediaAdapter, createStore, type CmsConfig } from "meditor";
import { localAuth } from "meditor/auth/local";
import { registry } from "./slices/registry";
import { defaults } from "./slices/defaults";

const contentDir = path.join(process.cwd(), "content");

export const cmsConfig: CmsConfig = {
  registry,
  defaults,
  adapter: createMarkdownAdapter({ contentDir }),
  previewPath: "/editor/preview",
  // Dev-only: allows in development, fails closed in production. Swap for
  // nextAuthAdapter(...) or clerkAuthAdapter(...) before shipping — see auth.md.
  auth: localAuth(),
  mediaAdapter: createFsMediaAdapter({
    dir: path.join(process.cwd(), "public/img"),
    publicPath: "/img",
  }),
};

export const cmsStore = createStore(cmsConfig.adapter, { onPublish: cmsConfig.onPublish });
```

`content/` needs at least one `<slug>.md` to edit. A minimal one:

```md
---
title: Home
slices:
  - slice: hero
    heading: Welcome
    body: Say something great.
---
```

## 3. Server Actions

Every mutation goes through `makeActions`, which re-checks `auth` on every
call (a Server Action is a public POST endpoint):

```ts
// app/editor/actions.ts
"use server";
import { makeActions } from "meditor";
import { cmsConfig } from "@/cms.config";

const actions = makeActions(cmsConfig);

export const {
  saveDraft, discardDraft, publish, createPage,
  createTranslation, deletePage, deleteTranslation,
} = actions;
export const { listMedia, deleteMedia } = actions;
```

## 4. The auth gate

Route Handlers and pages under `/editor` don't get a security boundary for
free — a layout is the natural place to both gate reads and mount the
editor-UI string provider:

```tsx
// app/editor/layout.tsx
import { notFound } from "next/navigation";
import { resolveAuth } from "meditor";
import { CmsIntlProvider } from "meditor/editor";
import { cmsConfig } from "@/cms.config";

export const metadata = { robots: { index: false, follow: false } }; // never index the editor

export default async function EditorLayout({ children }: { children: React.ReactNode }) {
  if (!(await resolveAuth(cmsConfig).authorize({ action: "read" }))) notFound();
  return <CmsIntlProvider>{children}</CmsIntlProvider>;
}
```

## 5. The page editor route

```tsx
// app/editor/[slug]/page.tsx
import { notFound } from "next/navigation";
import { EditorShell } from "meditor/editor";
import { cmsConfig, cmsStore } from "@/cms.config";
import * as actions from "../actions";

export const dynamic = "force-dynamic"; // drafts change on disk; never cache

export default async function EditorPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!cmsConfig.adapter.exists(slug)) notFound();
  const initialPage = cmsStore.getDraft(slug) ?? cmsStore.getPublished(slug);
  return (
    <EditorShell
      slug={slug}
      pages={cmsStore.listPages()}
      initialPage={initialPage}
      initialVersion={cmsStore.currentVersion(slug)}
      sliceNames={Object.keys(cmsConfig.registry)}
      defaults={cmsConfig.defaults}
      fieldSchema={cmsConfig.fieldSchema}
      previewPath={cmsConfig.previewPath}
      actions={actions}
      media={
        cmsConfig.mediaAdapter
          ? { list: actions.listMedia, delete: actions.deleteMedia, uploadPath: "/editor/media/upload" }
          : undefined
      }
    />
  );
}
```

`app/editor/page.tsx` (the bare `/editor` landing) just needs `PagesNav`
without a `children` outline — see [editor.md](./editor.md).

## 6. The preview route

The editor iframes this — it's your real slice components, rendered from the
draft, each wrapped so the canvas can select/edit it:

```tsx
// app/editor/preview/[slug]/page.tsx
import { notFound } from "next/navigation";
import { PreviewBridge } from "meditor/editor";
import { cmsConfig, cmsStore } from "@/cms.config";
import { SliceZone } from "@/slices/slice-zone"; // your own slice-name -> element renderer

export const dynamic = "force-dynamic";

export default async function PreviewPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!cmsConfig.adapter.exists(slug)) notFound();
  const page = cmsStore.getDraft(slug) ?? cmsStore.getPublished(slug);
  return (
    <div>
      {page.slices.map((s, i) => (
        <div key={`${s.slice}-${i}`} data-scms-index={i}>
          <SliceZone slices={[s]} />
        </div>
      ))}
      <PreviewBridge />
    </div>
  );
}
```

`SliceZone` is not part of meditor — it's your own "look up `slice.slice` in
`registry` and render the component with the rest of the props" helper.

## 7. Site settings and the media library

`SiteEditor` edits a `site` document's frontmatter (nav/footer/global copy —
anything that isn't a page); `MediaLibrary` is the standalone `/editor/media`
browse-and-delete view. Both share the same `PageActions` shape as
`EditorShell`. See [editor.md](./editor.md) for both, and
[media.md](./media.md) for the upload Route Handler
(`app/editor/media/upload/route.ts`) they depend on.

## 8. Theme

```ts
// app/globals.css (or wherever your global CSS lives)
@import "meditor/theme.css";
```

That's the whole editor. Next: [configuration.md](./configuration.md) for
every `CmsConfig` field, or [seo.md](./seo.md) to wire the optional public
SEO/AIO surface.
