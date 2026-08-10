# SEO / AIO (`meditor/seo`)

The **only** part of meditor that imports Next. It's a separate subpath on
purpose: a consumer wiring just the editor core (registry, store, adapter —
e.g. on a non-Next framework) never pulls in `next/server` or Next's
`Metadata` types. See [framework-agnostic.md](./framework-agnostic.md) if
that's you — this whole page assumes Next.

`SeoConfig` governs **public rendering**; `CmsConfig` governs the **editor**.
Deliberately separate objects, usually defined side by side
(`seo.config.ts` next to `cms.config.ts`), sharing the same `ContentStore`.

## `SeoConfig`

```ts
export type SeoConfig = {
  siteUrl: string;
  siteName: string;
  entityDescription: string;   // longer "what is this org" — JSON-LD/llms.txt, not SERP-length-constrained
  defaultTitle: string;
  defaultDescription: string;
  titleTemplate?: string;      // e.g. "%s | My Company"
  bareTitleSlugs?: readonly string[]; // slugs whose <title> skips titleTemplate
  defaultOgImage?: string;     // e.g. "/opengraph-image" or an absolute URL
  organization?: {
    logo?: string;
    alternateName?: string;
    parentOrganization?: string;
    sameAs?: string[];
  };
  aiCrawlers?: readonly string[]; // defaults to DEFAULT_AI_CRAWLERS
  sliceJsonLd?: Record<string, SliceJsonLd>; // per-slice structured data, keyed like `registry`
};
```

```ts
// seo.config.ts
import type { SeoConfig } from "meditor/seo";
import { seoRegistry } from "./slices/seo-registry";

export const seoConfig: SeoConfig = {
  siteUrl: "https://example.com",
  siteName: "Example",
  entityDescription: "Example is a company that does things.",
  defaultTitle: "Example | Doing things",
  defaultDescription: "Doing things, well.",
  titleTemplate: "%s | Example",
  defaultOgImage: "/opengraph-image",
  organization: { logo: "https://example.com/logo.png" },
  sliceJsonLd: seoRegistry,
};
```

## Root metadata + organization/website JSON-LD

```tsx
// app/layout.tsx
import { buildRootMetadata, JsonLd, organizationJsonLd, websiteJsonLd } from "meditor/seo";
import { seoConfig } from "@/seo.config";

export const metadata = buildRootMetadata(seoConfig); // spread + extend as needed

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <JsonLd data={organizationJsonLd(seoConfig)} />
        <JsonLd data={websiteJsonLd(seoConfig)} />
        {children}
      </body>
    </html>
  );
}
```

`JsonLd` escapes `<` in the serialized payload (so `</script>` can never
break out of the script context — standard "JSON in HTML" mitigation).

## Per-page metadata

```tsx
// app/[slug]/page.tsx
import { buildMetadata } from "meditor/seo";
import { cmsStore } from "@/cms.config";
import { seoConfig } from "@/seo.config";

export async function generateMetadata({ params }, parent: ResolvingMetadata) {
  const { slug } = await params;
  if (!cmsStore.listPages().some((p) => p.slug === slug)) return {};
  return buildMetadata(cmsStore.getPublished(slug), slug, seoConfig, parent);
}
```

Reads `PageSeoMeta` fields straight out of the page's existing frontmatter
`meta` (no new file format): `title`, `description`, `ogImage`, `canonical`,
`noindex`, `keywords`, `sitemap: { priority, changeFrequency }`. Pass an
`I18nConfig` + `locale` as the 5th/6th args to also emit hreflang
`alternates.languages` (+ `x-default`) — omitted or single-locale, the
output is byte-identical to the non-i18n build.

## Sitemap and robots

```ts
// app/sitemap.ts
import { buildSitemap } from "meditor/seo";
import { cmsStore } from "@/cms.config";
import { seoConfig } from "@/seo.config";

export default function sitemap() {
  return buildSitemap(cmsStore, seoConfig, { homeSlug: "home" });
}
```

```ts
// app/robots.ts
import { buildRobots } from "meditor/seo";
import { seoConfig } from "@/seo.config";

export default function robots() {
  return buildRobots(seoConfig);
}
```

`buildSitemap` skips any page with `noindex` frontmatter, treats `homeSlug`
as the site root (`/`, priority 1, weekly) and everything else as
`priority: 0.7` / `monthly` unless overridden per-page. Pass `{ i18n }` to
emit one entry per `(locale, slug)` with hreflang `alternates`. It only
knows about pages in the `ContentStore` — concat any other collection
(a separate hosted-resources list, say) yourself.

`buildRobots` allows everything by default plus an explicit AI-crawler
allowlist (`DEFAULT_AI_CRAWLERS`: GPTBot, ChatGPT-User, ClaudeBot,
Claude-Web, anthropic-ai, PerplexityBot, Google-Extended, CCBot) — override
via `SeoConfig.aiCrawlers`.

## Per-slice structured data

```ts
// slices/seo-registry.ts
import type { SliceJsonLd } from "meditor/seo";

export const seoRegistry: Record<string, SliceJsonLd> = {
  faq: (props) => {
    const items = props.items as { question: string; answer: string }[] | undefined;
    if (!items?.length) return null;
    return {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: items.map((i) => ({
        "@type": "Question",
        name: i.question,
        acceptedAnswer: { "@type": "Answer", text: i.answer },
      })),
    };
  },
};
```

```tsx
// app/[slug]/page.tsx
import { breadcrumbJsonLd, collectSliceJsonLd, JsonLd } from "meditor/seo";

<JsonLd data={breadcrumbJsonLd(seoConfig, [{ name: "Home", path: "" }, { name: title, path: `/${slug}` }])} />
{collectSliceJsonLd(page.slices, seoConfig.sliceJsonLd).map((data, i) => (
  <JsonLd key={i} data={data} />
))}
```

`collectSliceJsonLd` walks the page's slices, calls the registered
`SliceJsonLd` for each (skipping slices with no entry — most slices have
none), and swallows exceptions from any individual slice's function
(content-authored props are never trusted to not be malformed — one bad
prop degrades to "no schema for this slice," never breaks the page).

## AIO: the markdown mirror and `llms-full.txt`

Two ways an LLM/crawler can get the raw content of a page without parsing
your rendered HTML — both built on the same `renderSlicesAsMarkdown`
flattener (best-effort: pulls `heading`/`body`, plus common repeating shapes
like `columns`/`cards`/`items`/`quotes`/`stats`; pass a per-slice
`SliceMarkdownRegistry` override for anything that doesn't fit).

**Per-page `/<slug>.md`:**

```ts
// app/md/[slug]/route.ts
import { createMarkdownRouteHandler } from "meditor/seo";
import { cmsStore } from "@/cms.config";
export const { GET } = createMarkdownRouteHandler(cmsStore);
```

```ts
// proxy.ts (Next 16's renamed middleware.ts — works unchanged either way)
import { createMarkdownMirrorMiddleware, matchMarkdownMirrorSlug } from "meditor/seo";
const markdownMirror = createMarkdownMirrorMiddleware("/md");

export function proxy(request: NextRequest) {
  if (matchMarkdownMirrorSlug(request.nextUrl.pathname)) return markdownMirror(request);
  // ...your other proxy logic
}
export const config = { matcher: ["/:slug([a-z0-9-]+)\\.md", /* ... */] };
```

**Site-wide `llms-full.txt`** (the generated, always-fresh companion to a
hand-curated `public/llms.txt` — this does not replace a human-authored
summary file):

```ts
// app/llms-full.txt/route.ts
import { generateLlmsFullTxt } from "meditor/seo";
import { cmsStore } from "@/cms.config";
export function GET() {
  return new Response(generateLlmsFullTxt(cmsStore), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
```
