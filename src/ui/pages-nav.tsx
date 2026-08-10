"use client";

import { useState, useTransition, type ReactNode } from "react";
import { FileText, Image, Plus, Settings, Trash2 } from "lucide-react";
import type { PageInfo } from "../types";
import { useT } from "./intl";
import { Button } from "./primitives/button";
import { Input } from "./primitives/input";
import { cn } from "./primitives/cn";

/** Linear-style left navigation: the dynamic list of pages (plus New / delete)
 *  and a link to site settings. `children` (a block outline) renders below the
 *  page list when editing a page. Reused on the landing and inside the editor.
 *  Locale-aware: links preserve the active `?locale=` and, when a site has more
 *  than one locale, each row shows which locales the page exists in. */
export function PagesNav({
  pages,
  currentSlug,
  basePath = "/editor",
  locale,
  defaultLocale,
  allLocales = [],
  onCreate,
  onDelete,
  children,
}: Readonly<{
  pages: PageInfo[];
  currentSlug?: string;
  basePath?: string;
  /** Active content locale (links carry it as ?locale= when non-default). */
  locale?: string;
  defaultLocale?: string;
  /** Full locale set; more than one turns on the per-row translation dots. */
  allLocales?: string[];
  onCreate: (title: string) => Promise<string>;
  onDelete: (slug: string) => Promise<void>;
  children?: ReactNode;
}>) {
  const t = useT();
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [pending, startTransition] = useTransition();

  const multiLocale = allLocales.length > 1;
  const q = locale && defaultLocale && locale !== defaultLocale ? `?locale=${locale}` : "";
  const href = (slug: string) => `${basePath}/${slug}${q}`;

  const create = () => {
    const nm = title.trim();
    if (!nm) return;
    startTransition(async () => {
      const slug = await onCreate(nm);
      window.location.href = `${basePath}/${slug}`;
    });
  };
  const remove = (slug: string) => {
    if (!confirm(t("nav.confirmDelete", { slug }))) return;
    startTransition(async () => {
      await onDelete(slug);
      window.location.href = basePath;
    });
  };

  return (
    <nav className="flex h-full w-60 shrink-0 flex-col border-r border-[var(--scms-border)] bg-[var(--scms-bg)]">
      <div className="flex items-center gap-2 px-4 py-3 text-sm font-semibold text-[var(--scms-fg)]">
        <span className="grid size-5 place-items-center rounded bg-[var(--scms-primary)] text-[10px] font-bold text-[var(--scms-primary-fg)]">
          M
        </span>
        {t("nav.brand")}
      </div>

      <div className="flex items-center justify-between px-3 pb-1 pt-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-[var(--scms-muted-fg)]">{t("nav.pages")}</span>
        <Button variant="ghost" size="icon" aria-label={t("nav.newPage")} disabled={pending} onClick={() => setAdding((v) => !v)}>
          <Plus />
        </Button>
      </div>

      {adding && (
        <div className="flex gap-1 px-3 pb-2">
          <Input
            autoFocus
            placeholder={t("nav.pageName")}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") create();
              if (e.key === "Escape") setAdding(false);
            }}
            className="h-8"
          />
          <Button size="sm" disabled={pending || !title.trim()} onClick={create}>
            {t("nav.add")}
          </Button>
        </div>
      )}

      <ul
        className={cn(
          "space-y-0.5 overflow-y-auto px-2",
          children ? "max-h-[34vh] shrink-0" : "flex-1"
        )}
      >
        {pages.map((p) => {
          const active = p.slug === currentSlug;
          return (
            <li key={p.slug} className="group/row">
              <div
                className={cn(
                  "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm",
                  active ? "bg-[var(--scms-muted)] text-[var(--scms-fg)]" : "text-[var(--scms-muted-fg)] hover:bg-[var(--scms-muted)] hover:text-[var(--scms-fg)]"
                )}
              >
                <FileText className="size-4 shrink-0 opacity-70" />
                <a href={href(p.slug)} className="min-w-0 flex-1 truncate">
                  {p.title}
                </a>
                {multiLocale ? (
                  <span className="flex shrink-0 items-center gap-0.5" title={p.locales.join(", ")}>
                    {allLocales.map((l) => (
                      <span
                        key={l}
                        className={cn(
                          "size-1.5 rounded-full",
                          p.locales.includes(l) ? "bg-[var(--scms-primary)]" : "bg-[var(--scms-border)]"
                        )}
                      />
                    ))}
                  </span>
                ) : (
                  p.hasDraft && (
                    <span className="size-1.5 shrink-0 rounded-full bg-[var(--scms-primary)]" title="Has draft" />
                  )
                )}
                <button
                  type="button"
                  aria-label={t("nav.deletePage", { slug: p.slug })}
                  disabled={pending}
                  onClick={() => remove(p.slug)}
                  className="shrink-0 rounded p-0.5 text-[var(--scms-muted-fg)] opacity-0 transition-opacity hover:text-[var(--scms-destructive)] group-hover/row:opacity-100"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      {children && (
        <div className="flex min-h-0 flex-1 flex-col border-t border-[var(--scms-border)]">{children}</div>
      )}

      <div className="border-t border-[var(--scms-border)] p-2">
        <a
          href={`${basePath}/media${q}`}
          className={cn(
            "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm",
            currentSlug === "media"
              ? "bg-[var(--scms-muted)] text-[var(--scms-fg)]"
              : "text-[var(--scms-muted-fg)] hover:bg-[var(--scms-muted)] hover:text-[var(--scms-fg)]"
          )}
        >
          <Image className="size-4" /> {t("nav.mediaLibrary")}
        </a>
        <a
          href={`${basePath}/site${q}`}
          className={cn(
            "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm",
            currentSlug === "site"
              ? "bg-[var(--scms-muted)] text-[var(--scms-fg)]"
              : "text-[var(--scms-muted-fg)] hover:bg-[var(--scms-muted)] hover:text-[var(--scms-fg)]"
          )}
        >
          <Settings className="size-4" /> {t("nav.siteSettings")}
        </a>
      </div>
    </nav>
  );
}
