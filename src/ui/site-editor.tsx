"use client";

import { useState } from "react";
import type { PageActions } from "../actions";
import type { PageInfo, Slice } from "../types";
import { FieldForm } from "./field-form";
import type { FieldFormMedia } from "./image-picker-field";
import { PagesNav } from "./pages-nav";
import { useT } from "./intl";
import { Button } from "./primitives/button";
import { Select } from "./primitives/select";

/**
 * Site-wide settings editor (nav, CTA, footer — the non-page `site` document).
 * Same draft/publish flow and shell as the page editor, but edits the site
 * markdown's frontmatter instead of a slice list. Localized like any page: the
 * site document is per-locale content (`content/<locale>/site.md`).
 */
export function SiteEditor({
  pages,
  initialMeta,
  actions,
  media,
  locale,
  locales = [locale ?? "en"],
  defaultLocale = locales[0],
  translatedLocales = locales,
}: Readonly<{
  pages: PageInfo[];
  initialMeta: Record<string, unknown>;
  actions: PageActions;
  /** Wires FieldForm's "image" control to the media library. `site.md` has no
   *  top-level image prop today, but this costs nothing and any future
   *  site-level logo/favicon field benefits immediately. */
  media?: FieldFormMedia;
  locale?: string;
  locales?: string[];
  defaultLocale?: string;
  translatedLocales?: string[];
}>) {
  const t = useT();
  const activeLocale = locale ?? defaultLocale;
  const [meta, setMeta] = useState<Record<string, unknown>>(initialMeta);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");

  const page = { meta, slices: [], body: "" };

  const run = async (label: string, fn: () => Promise<void>, reload = false) => {
    setBusy(true);
    setStatus(`${label}…`);
    try {
      await fn();
      if (reload) window.location.reload();
      else setStatus(`${label} ✓`);
    } catch (e) {
      setStatus(`${label} failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  };

  const save = () =>
    run(t("shell.draftSaved"), async () => {
      await actions.saveDraft("site", page, undefined, activeLocale);
      setDirty(false);
    });
  const publish = () =>
    run(
      t("shell.publish"),
      async () => {
        await actions.saveDraft("site", page, undefined, activeLocale);
        await actions.publish("site", undefined, activeLocale);
      },
      true
    );
  const discard = () => {
    if (!confirm(t("site.confirmDiscard"))) return;
    run(t("shell.discardDraft"), () => actions.discardDraft("site", activeLocale), true);
  };

  const switchLocale = (next: string) => {
    if (next === activeLocale) return;
    const url = new URL(window.location.href);
    url.searchParams.set("locale", next);
    window.location.href = url.toString();
  };

  // FieldForm keys off a `slice` prop; use it as the panel title here.
  const asSlice: Slice = { slice: t("site.title"), ...meta };
  const onChange = (next: Slice) => {
    const { slice: _drop, ...rest } = next;
    void _drop;
    setMeta(rest);
    setDirty(true);
    setStatus("");
  };

  return (
    <div className="fixed inset-0 z-[100] flex bg-[var(--scms-bg)] text-[var(--scms-fg)]">
      <PagesNav
        pages={pages}
        currentSlug="site"
        locale={activeLocale}
        defaultLocale={defaultLocale}
        allLocales={locales}
        onCreate={actions.createPage}
        onDelete={actions.deletePage}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-[var(--scms-border)] px-4 py-2">
          <span className="text-sm font-semibold">{t("site.title")}</span>
          <span className="text-xs text-[var(--scms-muted-fg)]">
            {dirty ? t("shell.unsaved") : status || t("shell.upToDate")}
          </span>
          <div className="ml-auto flex items-center gap-2">
            {locales.length > 1 && (
              <Select
                aria-label={t("shell.locale")}
                value={activeLocale}
                disabled={busy}
                onChange={(e) => switchLocale(e.target.value)}
                className="w-auto"
              >
                {locales.map((l) => (
                  <option key={l} value={l}>
                    {l}
                    {translatedLocales.includes(l) ? "" : ` — ${t("shell.translate")}`}
                  </option>
                ))}
              </Select>
            )}
            <Button variant="ghost" size="sm" disabled={busy} onClick={discard}>
              {t("shell.discardDraft")}
            </Button>
            <Button variant="secondary" size="sm" disabled={busy || !dirty} onClick={save}>
              {t("shell.saveDraft")}
            </Button>
            <Button size="sm" disabled={busy} onClick={publish}>
              {t("shell.publish")}
            </Button>
          </div>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto max-w-2xl p-6">
            <p className="mb-4 text-sm text-[var(--scms-muted-fg)]">{t("site.blurb")}</p>
            <FieldForm slice={asSlice} onChange={onChange} media={media} />
          </div>
        </div>
      </div>
    </div>
  );
}
