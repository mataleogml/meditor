# Auth

Pluggable, analogous to `ContentAdapter`: one interface, swap the
implementation without touching the store, actions, or editor UI.

## `AuthAdapter`

```ts
// from "meditor"
export type AuthAction =
  | "read" | "saveDraft" | "discardDraft" | "publish"
  | "createPage" | "deletePage" | "uploadMedia" | "deleteMedia";

export type AuthContext = { action: AuthAction; slug?: string };
export type AuthUser = { id: string; email?: string; name?: string; roles?: string[] };

export interface AuthAdapter {
  getUser?(ctx: AuthContext): Promise<AuthUser | null>; // optional
  authorize(ctx: AuthContext): Promise<boolean>;         // MUST fail closed
}
```

Adapters read the request themselves (`cookies()`/`headers()` via their own
auth lib) — no request object is threaded through, matching how next-auth
v5's `auth()` and Clerk's `auth()` work inside Server Actions/Components.

Set `CmsConfig.auth` to an adapter. `resolveAuth(config)` is the single
resolution point both the action guard (`makeActions`) and your layout gate
share, so they can never diverge — it throws at construction if a config has
neither `auth` nor the deprecated `authorize`.

```ts
import { resolveAuth } from "meditor";
const auth = resolveAuth(cmsConfig);
await auth.authorize({ action: "read" });
```

## Where the gate actually runs

Every `makeActions` handler calls `guard(action, slug)` before doing
anything — a Server Action is a public POST endpoint, so this can't live in
the UI alone. The media upload Route Handler
(`handleMediaUpload`) **re-checks independently**, because a sibling
`route.ts` doesn't participate in a parent `layout.tsx`'s gate the way pages
do. Your own `app/editor/layout.tsx` should call `resolveAuth(cmsConfig)
.authorize({ action: "read" })` too — that's the read-side UX gate (redirect
to `notFound()`/sign-in); the write-side security boundary is `makeActions`
regardless of what the layout does.

## `localAuth` — dev-only

```ts
import { localAuth } from "meditor/auth/local";
auth: localAuth({
  predicate: () => process.env.NODE_ENV === "development", // default
  allowInProduction: false,                                 // default
})
```

Refuses everything in production unless `allowInProduction: true` is set
explicitly — the editor writes files, so it must never be open by omission.
No peer dependency; safe as a placeholder from day one.

## `nextAuthAdapter`

```ts
import { nextAuthAdapter } from "meditor/auth/next-auth";
import { auth } from "@/auth"; // your NextAuth(config) instance

auth: nextAuthAdapter({
  auth,                                  // the host's auth() (reads the session cookie)
  allowedEmails: ["you@example.com"],    // case-insensitive
  allowedRoles: ["editor"],              // any-intersection with session.user.roles
})
```

**Default-open caveat**: with neither `allowedEmails` nor `allowedRoles`
set, *any signed-in user* is authorized. Set at least one in production. The
adapter never imports `next-auth` itself — `auth` is injected, since v5's
`auth()` is created per-app.

## `clerkAuthAdapter`

```ts
import { clerkAuthAdapter } from "meditor/auth/clerk";

auth: clerkAuthAdapter({
  allowedRoles: ["org:admin"],       // org role claim
  allowedUserIds: ["user_abc123"],
})
```

Unlike next-auth's injected `auth()`, Clerk's `auth()`/`currentUser()` are
global request-scoped helpers, so this adapter imports `@clerk/nextjs/server`
directly — install `@clerk/nextjs` (optional peer) to use it.

## Writing your own

Implement `authorize` (and optionally `getUser`) against whatever you use —
a database session, an API key header, IP allowlist, anything. The only
hard rule: **fail closed**. Every bundled adapter wraps its identity
resolution in try/catch-to-`false`/`null` rather than letting a thrown error
default to "allowed."

```ts
export function apiKeyAuth(validKeys: Set<string>): AuthAdapter {
  return {
    authorize: async () => {
      try {
        return validKeys.has((await headers()).get("x-api-key") ?? "");
      } catch {
        return false;
      }
    },
  };
}
```

## Migrating from `authorize`

The legacy zero-arg `CmsConfig.authorize(): boolean | Promise<boolean>` still
works, wrapped automatically via `legacyAuthAdapter`. It has no notion of
`action`/`slug` (every action gets the same yes/no), so switch to `auth`
once you need per-action or per-slug rules.
