# CLAUDE.md — contributor guide for meditor

meditor is a modular, markdown-based, AI-buildable site builder + visual
editor for React/TypeScript. Framework-agnostic core (pure React + TS);
`meditor/seo` is the one Next-only subpath. Full user docs: `README.md` +
`docs/**`. This file is for anyone (human or AI) changing the package
itself.

## The seam — read this before touching anything

```
ContentAdapter  →  ContentStore  →  makeActions(config)  →  editor UI
(storage)          (draft/publish,     (auth-gated Server       (React,
                    locale fallback,    Action handlers)         meditor/editor)
                    versioning)
```

Each layer only depends on the one below it. `MediaAdapter` and
`AuthAdapter` are two more independently-pluggable interfaces following the
same shape (interface + one reference `create*`/factory implementation).
Full writeup: `docs/architecture.md`. **Before adding a feature, work out
which layer it belongs to** — most new features are a new method on an
existing interface, not a new abstraction.

## Where things live

```
src/
  types.ts            CmsConfig, ContentAdapter, FieldDef, SliceSchema, MediaAdapter — the core types
  store.ts            ContentStore: draft/publish, locale fallback, version-checked writes
  actions.ts          makeActions() — auth-gated Server Action handlers (CmsActions/PageActions)
  markdown-adapter.ts  createMarkdownAdapter — the shipped ContentAdapter (fs + gray-matter)
  media.ts             processUpload/handleMediaUpload — upload validation + web-optimization
  fs-media-adapter.ts   createFsMediaAdapter — the shipped MediaAdapter
  auth-adapter.ts       AuthAdapter interface, resolveAuth, legacyAuthAdapter
  auth/                 local.ts, next-auth.ts, clerk.ts — AuthAdapter implementations
  i18n.ts               Pure locale/routing logic — NO node imports (edge-safe)
  localize.ts           mergeLocalized (fallback merge), localeSubdir (on-disk layout)
  version.ts            versionOf (content hash), ConflictError
  editor.ts             Barrel for the "./editor" subpath -> re-exports ui/index.ts
  ui/                   Editor React components (EditorShell, SiteEditor, MediaLibrary,
                         PagesNav, DevicePreview, FieldForm, PreviewBridge, MediaGrid,
                         ImagePickerField, CmsIntlProvider/useT, primitives/*)
  seo/                  The Next-only "./seo" subpath: metadata, sitemap, robots,
                         JSON-LD, markdown-render/route (AIO), llms-txt
  theme.css             The --scms-* token contract
```

Docs mirror this: `docs/architecture.md` (the seam), `docs/configuration.md`
(`CmsConfig`), `docs/slices.md`, `docs/theming.md`, `docs/editor.md`,
`docs/i18n.md`, `docs/auth.md`, `docs/media.md`, `docs/seo.md`,
`docs/framework-agnostic.md`.

## Conventions

- **Conventional Commits**, enforced by commitlint via the Husky
  `commit-msg` hook (`.husky/commit-msg` → `@commitlint/config-conventional`).
  Non-conforming messages are rejected at commit time, not in CI.
- **`/docs` reminder hook.** `.husky/pre-commit` warns (does not yet block)
  when a commit stages `src/**` changes without any `docs/**` change. It's
  deliberately warn-only per its own comment ("no docs existed yet"); now
  that `docs/` exists, treat the warning as real — update the relevant page
  in the same commit, don't wait for it to become blocking.
- **Tests are colocated**: `foo.ts` → `foo.test.ts` (or `.test.tsx`) next to
  it, run via `npm test` (Vitest, jsdom environment, see
  `vitest.config.ts`/`vitest.setup.ts`). `server-only` is aliased to its
  no-op branch for tests since Vitest has no Next build step to apply the
  `react-server` export condition. No separate `__tests__` tree, no test
  framework beyond Vitest + Testing Library.
- **Lint**: `npm run lint` (ESLint flat config, typescript-eslint recommended
  + `react-hooks` + `@next/next/no-img-element` — the latter because the
  editor intentionally renders content-authored `<img>`, not `next/image`).
  `lint-staged` runs `eslint --fix` on staged `.ts`/`.tsx` pre-commit.
- **Typecheck**: `npm run typecheck` (`tsc --noEmit`); the actual build uses
  `tsconfig.build.json` (`npm run build`, declarations + copies `theme.css`
  into `dist/`).
- **`--scms-*` CSS variables** are the entire theming contract (9 variables,
  `src/theme.css`) — editor components read only these, never a hardcoded
  color. Adding editor UI needs a new visual token → add it to this set (with
  a shadcn-token fallback and a neutral default), don't invent a
  component-local CSS variable or inline color.
- **Adapter pattern, not inheritance.** `ContentAdapter`/`MediaAdapter`/
  `AuthAdapter` are plain interfaces built by factory functions
  (`create*Adapter(opts)` / `localAuth(opts)`), not classes. Match that shape
  for a new adapter — don't introduce a base class or DI container for a
  package with three swappable interfaces.
- **Trust boundaries are the adapter's job.** Slug/locale/media-id validation
  (regex allowlist + traversal guard) happens inside `createMarkdownAdapter`/
  `createFsMediaAdapter`, not in callers. A new adapter for a different
  backend must validate its own equivalent boundary (e.g. a KV key, a git
  ref) — don't assume the store or actions layer already checked it.
- **Fail closed.** Every `AuthAdapter.authorize()` implementation wraps
  identity resolution in try/catch → `false`, never lets a thrown error
  default to "allowed." Follow this in any new adapter.
- **`ponytail:` comments** mark deliberate, scoped shortcuts with a named
  upgrade path (e.g. the TOCTOU window in `store.ts`'s version check, the SVG
  sanitization blocklist in `media.ts`). Read the ones near code you're
  touching before "fixing" them — they're intentional, with a stated ceiling.

## Adding a new slice (consumer-side)

Slices are **not** part of this package — `registry`/`defaults`/
`fieldSchema` all live in the consuming project. If you're helping a
consumer add one: write the component, add it to their `registry`, give it a
renderable entry in `defaults`, optionally add `FieldDef`s to `fieldSchema`
for enum/image props. See `docs/slices.md`. No change to meditor's `src/` is
needed for this.

## Adding a new adapter (contributor-side)

This *is* a change to `src/`. Implement the relevant interface
(`ContentAdapter` in `types.ts`, `MediaAdapter` in `types.ts`, or
`AuthAdapter` in `auth-adapter.ts`) as a `create*`/factory function, mirroring
the existing reference implementation's shape and trust-boundary handling:

1. New file at the same level as the reference impl (e.g.
   `src/kv-content-adapter.ts`, or `src/auth/your-provider.ts` for auth).
2. Validate every untrusted input the interface hands you (slug, locale,
   media id) the same way the fs-based reference does — don't rely on
   upstream callers to have checked.
3. Export it from `src/index.ts` (core adapters) or add an `exports` entry in
   `package.json` (a new namespaced subpath like `meditor/auth/foo`, matching
   the `./auth/local`/`./auth/next-auth`/`./auth/clerk` pattern) — decide
   based on whether it needs an optional peer dependency (subpath, so
   installing meditor doesn't force the peer) or not (core export).
4. Add a colocated `*.test.ts`.
5. Add/extend the matching `docs/*.md` page and this file if the convention
   list above needs a new entry.

## Known rough edges

A handful of thrown error messages still say `"slice-cms: ..."` (the
package's pre-rename name) — `src/actions.ts`, `src/store.ts`, and a comment
in `src/seo/markdown-render.ts`. Harmless (messages are for developers, not
parsed), but fix the string to `"meditor: ..."` if you're touching that
line anyway; not worth a dedicated pass on its own.
