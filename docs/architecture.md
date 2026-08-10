# Architecture

## The seam: adapter → store → actions → UI

Four layers, each only depending on the one below it:

```
ContentAdapter        (storage: fs+markdown, or your own KV/git/DB)
      ↓
ContentStore           (draft/publish semantics, locale fallback, versioning)
      ↓
makeActions(config)     (auth-gated Server Action handlers)
      ↓
EditorShell / SiteEditor / MediaLibrary   (React UI)
```

Nothing above the adapter knows *how* content is stored; nothing below the
store knows about drafts, locales, or versions. This is why an S3 media
adapter or a git-backed content adapter can drop in later without touching
the editor UI, and why the whole stack (minus `meditor/seo`) has zero Next
dependency — Next only shows up in the route glue a host writes around it.

### `ContentAdapter`

The only thing that knows where/how content is stored and serialized:

```ts
export interface ContentAdapter {
  readonly locales: string[];
  readonly defaultLocale: string;
  listSlugs(locale?: string): string[];
  listLocales(slug: string): string[];
  exists(slug: string, locale?: string): boolean;
  readRaw(slug: string, locale?: string): string;      // throws if absent
  writeRaw(slug: string, raw: string, locale?: string): void;
  deletePublished(slug: string, locale?: string): void;
  readDraftRaw(slug: string, locale?: string): string | null;
  writeDraftRaw(slug: string, raw: string, locale?: string): void;
  deleteDraft(slug: string, locale?: string): void;
  hasDraft(slug: string, locale?: string): boolean;
  parse(raw: string): PageContent;   // locale-agnostic: locale is a path segment, never inside the file
  serialize(page: PageContent): string;
}
```

`createMarkdownAdapter` is the shipped implementation: `gray-matter`
frontmatter + body, the default locale flat at `contentDir`, other locales
under `contentDir/<locale>/` (see [i18n.md](./i18n.md)). A KV or
git-committing adapter implements the same 13 methods against a different
backend — the store, actions, and UI need no changes.

### `ContentStore`

Adds draft/publish semantics, locale fallback, and version-checked writes
on top of a dumb per-locale adapter:

```ts
export interface ContentStore {
  listPages(locale?: string): PageInfo[];
  getPublished(slug: string, locale?: string): LocalizedPage; // with default-locale fallback
  getDraft(slug: string, locale?: string): PageContent | null;
  currentVersion(slug: string, locale?: string): string | null;
  saveDraft(slug: string, page: PageContent, baseVersion?: string, locale?: string): string;
  discardDraft(slug: string, locale?: string): void;
  publish(slug: string, baseVersion?: string, locale?: string): Promise<void>;
  createPage(slug: string, page: PageContent, locale?: string): void;
  createTranslation(slug: string, fromLocale: string, toLocale: string): void;
  deletePage(slug: string): void;
  deleteTranslation(slug: string, locale: string): void;
}
```

`createStore(adapter, { onPublish?, defaultLocale? })` builds one.

### Versioning and conflicts

```ts
export const versionOf = (raw: string): string; // sha256(raw), truncated — deterministic, no mtime flakiness
export class ConflictError extends Error {
  readonly code = "conflict";
  readonly slug: string;
  readonly currentVersion: string | null;
  readonly baseVersion: string;
}
```

`saveDraft`/`publish` accept an optional `baseVersion`. When given, the
store re-reads the current version right before writing and throws
`ConflictError` if it moved — classic optimistic locking, read-then-write
(there's a TOCTOU window; fine for a single-node filesystem CMS, and the
seam for an atomic adapter — a git blob SHA or a KV compare-and-swap — to
close it later is an optional `expectedVersion` hook on the adapter, not a
change to the store's shape).

`makeActions` never lets `ConflictError` escape as a thrown error — Next
redacts thrown messages to an opaque digest in production, so a client
couldn't read `e.message` to detect one. It's converted to a typed result
instead:

```ts
export type SaveResult =
  | { ok: true; version: string }
  | { ok: false; code: "conflict"; currentVersion: string | null };
```

`EditorShell` branches on `res.ok` to drive the reload/overwrite banner.

### `makeActions`

```ts
export function makeActions(config: CmsConfig): CmsActions;
```

Builds a `ContentStore` internally, resolves `auth` once via `resolveAuth`
(throwing early if misconfigured), and wraps every mutation with an
`await guard(action, slug)` auth check before touching the store — a Server
Action is a public POST endpoint, so the gate lives here, not only in the
UI. `CmsActions` is the full set (including `listMedia`/`deleteMedia`);
`PageActions` (`Omit<CmsActions, "listMedia" | "deleteMedia">`) is what the
three editor shells actually take as their `actions` prop.

## Three parallel adapter interfaces

`ContentAdapter`, `MediaAdapter`, and `AuthAdapter` are independently
pluggable, each following the same shape: an interface in the package, one
reference implementation (`createMarkdownAdapter` / `createFsMediaAdapter` /
`localAuth`), and a factory function rather than a class. None of the three
knows about the other two.

## Framework-agnostic core vs. Next-only surfaces

| Import | Imports Next? | Contains |
|---|---|---|
| `meditor` | No | Types, `ContentAdapter`/`MediaAdapter`/`AuthAdapter`, the markdown/fs adapters, store, actions, media upload handler |
| `meditor/i18n` | No | Locale/routing pure functions — no `node:fs` either, edge-safe |
| `meditor/editor` | No | The editor React UI (client components) |
| `meditor/auth/local` | No | Dev-only auth adapter |
| `meditor/seo` | **Yes** | `Metadata`/sitemap/robots builders, the `.md` mirror Route Handler |
| `meditor/auth/next-auth` | No (session injected) | next-auth adapter — never imports `next-auth` itself |
| `meditor/auth/clerk` | Optional peer `@clerk/nextjs` | Clerk adapter — imports `@clerk/nextjs/server` directly |

`next`, `next-auth`, and `@clerk/nextjs` are all **optional peer
dependencies** — installing `meditor` alone pulls in none of them. See
[framework-agnostic.md](./framework-agnostic.md) for wiring the core into a
non-Next host.

## Trust boundaries

Two path segments cross from untrusted input into filesystem calls, and both
are validated at the adapter, not at the caller:

- **Slug**: `createMarkdownAdapter` rejects anything not matching
  `^[a-z0-9][a-z0-9-]*$` before it becomes a path.
- **Locale**: validated against the adapter's `locales` allowlist — the
  allowlist *is* the traversal guard, not the slug regex (a locale segment
  has different valid characters than a slug).

`createFsMediaAdapter` does the same for media ids (`^[a-z0-9][a-z0-9._-]*$`,
plus an explicit `..` rejection). See [media.md](./media.md) for the upload
pipeline's separate (content-sniffing) trust boundary.
