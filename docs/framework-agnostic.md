# Using meditor without Next

Everything except `meditor/seo` is plain React + TypeScript. No `meditor`,
`meditor/i18n`, `meditor/editor`, or `meditor/auth/local` module imports
Next, and `next`/`next-auth`/`@clerk/nextjs` are all optional peer
dependencies — installing `meditor` pulls in none of them (see
[architecture.md](./architecture.md#framework-agnostic-core-vs-next-only-surfaces)
for the exact per-subpath breakdown).

What Next supplies in the reference host, and what you supply instead on
another framework:

| Concern | Next reference host | Your equivalent |
|---|---|---|
| Draft/publish mutations | `"use server"` Server Actions wrapping `makeActions()` | Any RPC/HTTP endpoint that calls the same `makeActions()` handlers — they're plain async functions |
| Media upload | A Route Handler calling `handleMediaUpload(config, request)` | Any route/handler that constructs a `Request` and calls the same function |
| Auth session | `next-auth`/Clerk adapters reading Next's `cookies()`/`headers()` | Your own `AuthAdapter` reading your framework's request context (see [auth.md](./auth.md#writing-your-own)) |
| Editor routes | `app/editor/[slug]/page.tsx` etc. | Your router mounting `EditorShell`/`SiteEditor`/`MediaLibrary` from `meditor/editor` at equivalent paths |
| Metadata/sitemap/robots/JSON-LD | `meditor/seo` | Your own — the core exposes `ContentStore.getPublished()`/`listPages()`, which is all `meditor/seo`'s builders read internally; nothing stops you from reading the same store and building your framework's metadata format directly |

## What actually needs a Node server

Both `createMarkdownAdapter` and `createFsMediaAdapter` use `node:fs` — a
filesystem-backed CMS needs a Node process for reads and (especially) the
draft/publish writes. That's true regardless of framework: Vite+Hono,
Remix, a plain Express app, or Next, all equally need a server for the
mutation side. Static-only hosting works for the **published** site (once
built), just not for the editor itself.

## Minimal non-Next wiring sketch

```ts
// cms.config.ts — identical to the Next case, zero Next imports
import { createMarkdownAdapter, createStore, type CmsConfig } from "meditor";
import { localAuth } from "meditor/auth/local";
import { registry, defaults } from "./slices";

export const cmsConfig: CmsConfig = {
  registry,
  defaults,
  adapter: createMarkdownAdapter({ contentDir: "./content" }),
  previewPath: "/editor/preview",
  auth: localAuth(),
};
export const cmsStore = createStore(cmsConfig.adapter);
```

```ts
// server.ts (Hono example) — makeActions handlers become plain RPC endpoints
import { Hono } from "hono";
import { makeActions } from "meditor";
import { cmsConfig } from "./cms.config";

const actions = makeActions(cmsConfig);
const app = new Hono();
app.post("/api/editor/save-draft", async (c) => {
  const { slug, page, baseVersion, locale } = await c.req.json();
  return c.json(await actions.saveDraft(slug, page, baseVersion, locale));
});
// ...publish, createPage, etc. — one route per CmsActions method
```

```tsx
// EditorRoute.tsx — meditor/editor components don't care which router rendered them
import { EditorShell } from "meditor/editor";

const actions = {
  saveDraft: (slug, page, baseVersion, locale) =>
    fetch("/api/editor/save-draft", { method: "POST", body: JSON.stringify({ slug, page, baseVersion, locale }) })
      .then((r) => r.json()),
  // ...discardDraft, publish, createPage, createTranslation, deletePage, deleteTranslation
};

export function EditorRoute({ slug, initialPage, initialVersion, pages }) {
  return (
    <EditorShell
      slug={slug}
      pages={pages}
      initialPage={initialPage}
      initialVersion={initialVersion}
      sliceNames={Object.keys(cmsConfig.registry)}
      defaults={cmsConfig.defaults}
      previewPath={cmsConfig.previewPath}
      actions={actions}
    />
  );
}
```

The shape doesn't change — `actions` just needs to satisfy `PageActions`
(the same seven methods `makeActions` returns minus media), wherever the
network call underneath actually goes. `PreviewBridge`'s `postMessage`
protocol is framework-agnostic too: it only needs a same-origin iframe
showing your rendered slices with `data-scms-index` wrapper attributes.

## Mounting the editor without writing React

The sketch above renders `EditorShell` as a React component in your router. If
your host isn't React (Vue, Svelte, Astro, vanilla), you can instead mount the
editor as a custom element — `<meditor-editor>` from `meditor/wc` — and set the
same inputs as JS properties. The server/actions/preview contract is unchanged;
only the mount mechanism differs. See [web-component.md](./web-component.md).

## What you lose without Next

Only `meditor/seo` (Next `Metadata`/sitemap/robots types + the `.md` mirror
Route Handler built on `next/server`). Everything else — draft/publish,
i18n routing decisions (`routeLocale` returns a plain discriminated union you
map onto your own router), media upload/validation, auth — has no Next
dependency to lose.
