import { PencilLine } from "lucide-react";
import type { PageInfo } from "../types";

/** Page picker. Presentational (no client state) so it renders on the server. */
export function PageList({
  pages,
  basePath = "/editor",
}: Readonly<{ pages: PageInfo[]; basePath?: string }>) {
  return (
    <div className="mx-auto max-w-3xl p-8">
      <h1 className="mb-1 text-2xl font-semibold text-[var(--scms-fg)]">Pages</h1>
      <p className="mb-6 text-sm text-[var(--scms-muted-fg)]">Choose a page to edit its blocks.</p>
      <ul className="divide-y divide-[var(--scms-border)] overflow-hidden rounded-lg border border-[var(--scms-border)]">
        {pages.map((p) => (
          <li key={p.slug}>
            <a
              href={`${basePath}/${p.slug}`}
              className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-[var(--scms-muted)]"
            >
              <span className="font-medium text-[var(--scms-fg)]">{p.title}</span>
              <span className="font-mono text-xs text-[var(--scms-muted-fg)]">/{p.slug}</span>
              {p.hasDraft && (
                <span className="ml-auto inline-flex items-center gap-1 rounded-full border border-[var(--scms-border)] px-2 py-0.5 text-xs font-medium text-[var(--scms-muted-fg)]">
                  <PencilLine className="size-3" /> draft
                </span>
              )}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
