import path from "node:path";
import { createMarkdownAdapter } from "./markdown-adapter";
import { makeActions, type PageActions } from "./actions";
import type { CmsConfig } from "./types";
import { resolveSections, type CollectionSection } from "./sections";

/** True when `child` is inside (or equal to) `parent`. */
function isInside(child: string, parent: string): boolean {
  const rel = path.relative(parent, child);
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
}

export function makeCollectionActions(config: CmsConfig, section: CollectionSection): PageActions {
  const contentDir = path.resolve(process.cwd(), section.dir);
  const pagesRoot = config.adapter.root;
  if (isInside(contentDir, pagesRoot) || isInside(pagesRoot, contentDir))
    throw new Error(`meditor: collection dir "${section.dir}" overlaps the Pages content dir`);
  const adapter = createMarkdownAdapter({
    contentDir,
    locales: config.adapter.locales,
    defaultLocale: config.adapter.defaultLocale,
  });
  // ponytail: onPublish/onSaveDraft omitted — their (slug, locale[, version])
  // signature can't identify a collection for revalidation or review-queue
  // triage. Add a per-section hook if a host needs collection revalidation.
  return makeActions({ ...config, adapter, onPublish: undefined, onSaveDraft: undefined }) as PageActions;
}

export function buildCollectionActions(config: CmsConfig): Record<string, PageActions> {
  const out: Record<string, PageActions> = {};
  for (const s of resolveSections(config))
    if (s.kind === "collection") out[s.id] = makeCollectionActions(config, s.raw as CollectionSection);
  return out;
}
