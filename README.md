# meditor

**A modular, markdown-based, AI-buildable site builder + visual editor for
React/TypeScript projects.**

Pages are markdown with a `slices:` frontmatter array — each slice a named
block (`hero`, `faq`, `cardGrid`, …) whose component you already own. meditor
turns that into a Linear-style WYSIWYG editor: drag-drop block ordering,
on-canvas click-to-select and double-click inline text edits, a device
preview, draft/publish with optimistic-lock conflict handling, a media
library, and i18n — on top of content that stays plain `.md` files in your
repo (or whatever `ContentAdapter` you point it at).

Because content is just markdown + a typed slice registry, both humans and
LLMs can write/edit pages directly — there's no proprietary block format to
reverse-engineer. SEO (metadata, sitemap, robots, JSON-LD) and AIO (a raw
`.md` mirror per page, an always-fresh `llms-full.txt`, AI-crawler allowlist)
ship as an optional, separate module.

> **[Screenshot placeholder]** — drop an editor screenshot/GIF here (the
> three-pane shell: page nav, live device preview, property panel).

**Status:** early, `0.1.0`. APIs may still shift before `1.0`. Used in
production by one reference site (see below); not yet battle-tested across a
wide range of hosts.

## Why

- **Markdown-native.** Every page is `<slug>.md`: YAML frontmatter (`meta` +
  a `slices` array) and an optional body. Readable in a diff, editable by
  hand, editable by an AI, editable through the visual editor — same file.
- **AI-buildable.** No custom block-editor JSON schema to teach a model.
  Slices are plain component props with an optional `FieldDef` schema; an
  agent that can write YAML can author a page.
- **Framework-agnostic core.** The editor UI, content store, adapters,
  config, auth, and i18n are pure React + TypeScript — nothing imports Next.
  Next is one *optional* subpath (`meditor/seo`) for `Metadata`/sitemap/robots
  helpers and a markdown-mirror route. Wire the same core into Vite+Hono,
  Remix, or anything else with a Node server for draft/publish. See
  [`docs/framework-agnostic.md`](./docs/framework-agnostic.md).
- **WYSIWYG, not a form.** The center pane is your real page, live, in an
  iframe. Click a block to select it in the property panel; double-click
  text to edit it in place; drag to reorder.
- **SEO + AIO + i18n baked in, not bolted on.** Per-page metadata, sitemap,
  robots (with an AI-crawler allowlist), JSON-LD, a `.md` mirror route, and
  locale-aware routing all read the same content the editor writes.
- **Bring your own everything.** Storage (`ContentAdapter`), media
  (`MediaAdapter`), auth (`AuthAdapter`) are all interfaces with one
  filesystem/local reference implementation each — swap in KV, S3, your SSO,
  without touching the editor or the store.

## Install

```bash
npm i meditor
# or
bun add meditor
# or
pnpm add meditor
```

Peer dependencies (`react`, `react-dom` ≥19) are required. `next`,
`next-auth`, and `@clerk/nextjs` are **optional** peers — install them only
if you use `meditor/seo`, `meditor/auth/next-auth`, or `meditor/auth/clerk`
respectively. The core (`meditor`, `meditor/editor`, `meditor/i18n`) has zero
Next dependency.

### Quickstart: scaffold a new project

```bash
npx meditor init
# or
bunx meditor init
```

Scaffolds a starter `cms.config.ts`, a `content/` directory, an `/editor`
route tree, and a couple of example slices in a fresh or existing Next app.
(The scaffolder is a separate, in-progress piece — the manual wiring below is
the same thing it generates, if you'd rather do it by hand or you're not on
Next.)

## 60-second quickstart (manual wiring)

```ts
// cms.config.ts
import path from "node:path";
import { createMarkdownAdapter, createStore, type CmsConfig } from "meditor";
import { localAuth } from "meditor/auth/local";
import { registry } from "./slices/registry";   // your slice name -> component map
import { defaults } from "./slices/defaults";   // starter props per slice

const contentDir = path.join(process.cwd(), "content");

export const cmsConfig: CmsConfig = {
  registry,
  defaults,
  adapter: createMarkdownAdapter({ contentDir }),
  previewPath: "/editor/preview",
  auth: localAuth(), // dev-only; fails closed in production until you swap it
};

export const cmsStore = createStore(cmsConfig.adapter);
```

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
```

```tsx
// app/editor/[slug]/page.tsx
import { EditorShell } from "meditor/editor";
import { cmsConfig, cmsStore } from "@/cms.config";
import * as actions from "../actions";

export default async function EditorPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const initialPage = cmsStore.getDraft(slug) ?? cmsStore.getPublished(slug);
  return (
    <EditorShell
      slug={slug}
      pages={cmsStore.listPages()}
      initialPage={initialPage}
      initialVersion={cmsStore.currentVersion(slug)}
      sliceNames={Object.keys(cmsConfig.registry)}
      defaults={cmsConfig.defaults}
      previewPath={cmsConfig.previewPath}
      actions={actions}
    />
  );
}
```

That's the shell + store + one route. See
[`docs/getting-started.md`](./docs/getting-started.md) for the preview route,
site settings, and media library, and the [reference implementation](#reference-implementation)
below for a complete, production wiring.

## Features

- **Draft/publish with optimistic locking.** Every save/publish carries the
  content version it was based on; a conflicting concurrent edit surfaces a
  reload-or-overwrite banner instead of silently clobbering someone's work.
- **On-canvas editing.** Click-to-select and double-click-to-edit-text
  directly in the live preview iframe (`PreviewBridge` + `postMessage`), in
  sync with the property panel.
- **Device preview.** Desktop/tablet/mobile presets, free drag-resize, and an
  independent light/dark toggle for the preview itself.
- **Typed field schema.** Per-slice `FieldDef`s (`text`, `textarea`, `number`,
  `boolean`, `select` with `options`, `yaml`, `image`) drive real controls;
  anything undeclared auto-detects from the value. A whole-block "Edit as
  YAML" escape hatch always exists.
- **Media library.** Upload validates + re-encodes to WebP (via `sharp`),
  strips EXIF, caps dimensions, rejects SVGs with script content — before
  anything reaches your `MediaAdapter`.
- **i18n.** One `I18nConfig` on `CmsConfig` drives content locales, URL
  routing (`prefix-except-default` or `prefix-all`), default-locale fallback
  with a "showing untranslated content" banner, and a per-page locale
  switcher that seeds a draft translation on demand.
- **Pluggable auth.** `AuthAdapter` interface with `local` (dev-only,
  fails closed in prod), `next-auth`, and `clerk` reference adapters.
- **SEO/AIO module** (`meditor/seo`, optional, Next-only): root + per-page
  `Metadata`, sitemap/robots builders, an AI-crawler allowlist, per-slice
  JSON-LD, an `/<slug>.md` raw-markdown mirror, and an always-fresh
  `llms-full.txt` generator.
- **Theming via CSS variables**, falling back to shadcn tokens automatically
  (see below).

## Theming

The editor's shadcn-style primitives read exactly nine CSS variables, each
falling back through your site's shadcn tokens to a neutral default:

```css
--scms-bg: var(--background, #ffffff);
--scms-fg: var(--foreground, #18181b);
--scms-muted: var(--muted, #f4f4f5);
--scms-muted-fg: var(--muted-foreground, #71717a);
--scms-border: var(--border, #e4e4e7);
--scms-primary: var(--primary, #2563eb);
--scms-primary-fg: var(--primary-foreground, #ffffff);
--scms-ring: var(--ring, #3b82f6);
--scms-destructive: var(--destructive, #dc2626);
```

Import `meditor/theme.css` once. On a shadcn site, that's it — the editor
already matches your palette and flips with `.dark`. No design system at
all → the neutral defaults are usable as shipped. Your own design system →
override the nine `--scms-*` variables directly. Full contract, dark mode
notes, and branding recipes in [`docs/theming.md`](./docs/theming.md).

## Docs

- [Getting started](./docs/getting-started.md) — full wiring: preview route, site settings, media upload route
- [Configuration](./docs/configuration.md) — the `CmsConfig` reference
- [Slices](./docs/slices.md) — registry, defaults, `FieldDef`/`SliceSchema`
- [Theming](./docs/theming.md) — the `--scms-*` token contract, dark mode, branding
- [Editor](./docs/editor.md) — `EditorShell`, `SiteEditor`, `MediaLibrary`, draft/publish, device preview, inline edit
- [i18n](./docs/i18n.md) — locales, routing presets, content layout, the locale switcher
- [Auth](./docs/auth.md) — `AuthAdapter`, the local/next-auth/Clerk adapters
- [Media](./docs/media.md) — `MediaAdapter`, upload pipeline, image fields
- [SEO](./docs/seo.md) — the `meditor/seo` Next adapter, AIO (llms.txt / markdown mirror)
- [Architecture](./docs/architecture.md) — the adapter/store/config seam
- [Framework-agnostic usage](./docs/framework-agnostic.md) — using meditor without Next

## Reference implementation

**dandelion-site** (Dandelion Payments' marketing site) is meditor's first
consumer and wires the full stack — markdown adapter, filesystem media
adapter, local auth (swappable for SSO), i18n, and the SEO/AIO module — into
a real Next 16 site. Its `cms.config.ts`, `seo.config.ts`, `proxy.ts`, and
`app/editor/**` are the best "how do the pieces actually fit together"
reading, alongside these docs.

## Security

- **Auth is fail-closed by design.** `AuthAdapter.authorize()` gates every
  write (`makeActions`) *and* the upload route (`handleMediaUpload`)
  independently — a Route Handler doesn't inherit a parent layout's gate, so
  each re-checks. The bundled `localAuth()` refuses in production unless you
  explicitly opt in.
- **Slugs and locales are trust boundaries.** `createMarkdownAdapter` rejects
  any slug that doesn't match `^[a-z0-9][a-z0-9-]*$` and any locale not in
  its configured allowlist, before either reaches the filesystem — no path
  traversal via `../`.
- **Uploads are never trusted by extension or `Content-Type`.** `processUpload`
  sniffs actual bytes via `sharp`, caps input size (8MB) and output dimensions
  (2000px), strips EXIF, and rejects SVGs containing script-like content.
- **Version-checked writes.** `saveDraft`/`publish` take an optional
  `baseVersion`; a stale write returns a typed conflict instead of throwing
  (so it survives Next's production error redaction) and never silently
  overwrites a concurrent edit.
- Found a vulnerability? Open a private security advisory on GitHub rather
  than a public issue.

## License

MIT © Gabriel Lam
