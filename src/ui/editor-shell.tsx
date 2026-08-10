"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Languages, Moon, Sun, TriangleAlert } from "lucide-react";
import type { PageActions } from "../actions";
import type { PageContent, PageInfo, Slice, SliceSchema } from "../types";
import { BlockList } from "./block-list";
import { DevicePreview } from "./device-preview";
import { FieldForm } from "./field-form";
import type { FieldFormMedia } from "./image-picker-field";
import { PagesNav } from "./pages-nav";
import { useT } from "./intl";
import { Button } from "./primitives/button";
import { Select } from "./primitives/select";
import { cn } from "./primitives/cn";

/**
 * Linear-style visual editor: dynamic left nav (pages + this page's block
 * outline), a device-switchable live-preview center, and a right property
 * panel. Edits autosave to the draft and refresh the preview; Publish promotes
 * it, Discard drops it. Blocks are also click-selectable on the canvas.
 *
 * All draft/publish/preview mutations target `locale` (default when a site is
 * single-locale — then the switcher/banner don't render and the shell is
 * unchanged). Switching to an untranslated locale seeds a draft translation.
 */
export function EditorShell({
  slug,
  pages,
  initialPage,
  initialVersion,
  sliceNames,
  defaults,
  fieldSchema,
  previewPath,
  actions,
  media,
  locale,
  locales = [locale ?? "en"],
  defaultLocale = locales[0],
  translatedLocales = locales,
  isFallback = false,
}: Readonly<{
  slug: string;
  pages: PageInfo[];
  initialPage: PageContent;
  /** Content version the editor loaded; sent on every write for optimistic
   *  locking (null when the page has no content yet). */
  initialVersion: string | null;
  sliceNames: string[];
  defaults: Record<string, Record<string, unknown>>;
  fieldSchema?: Record<string, SliceSchema>;
  previewPath: string;
  actions: PageActions;
  /** Wires FieldForm's "image" control to the media library. Omit to disable
   *  media management (image fields degrade to plain text inputs). */
  media?: FieldFormMedia;
  /** Active content locale (defaults to the default locale). */
  locale?: string;
  /** Full locale set (switcher source). Single entry → no switcher. */
  locales?: string[];
  defaultLocale?: string;
  /** Locales this page already has content in (published or draft). */
  translatedLocales?: string[];
  /** True when the loaded content is the default-locale fallback (untranslated). */
  isFallback?: boolean;
}>) {
  const t = useT();
  const activeLocale = locale ?? defaultLocale;
  const [page, setPage] = useState<PageContent>(initialPage);
  const [selected, setSelected] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string>("");
  // Version of the content this editor is based on, and whether a concurrent
  // write has been detected (someone else changed the page under us).
  const [version, setVersion] = useState<string | null>(initialVersion);
  const [conflict, setConflict] = useState(false);
  const [previewV, setPreviewV] = useState(0);
  const [switching, startSwitch] = useTransition();
  const [dark, setDark] = useState(
    () => typeof window !== "undefined" && localStorage.getItem("meditor-theme") === "dark"
  );
  const firstRender = useRef(true);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") localStorage.setItem("meditor-theme", dark ? "dark" : "light");
  }, [dark]);

  // Debounced autosave + preview refresh ~0.8s after edits settle.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    // Stop the autosave loop once a conflict is showing — don't keep retrying a
    // write we already know will lose until the author resolves it.
    if (!dirty || conflict) return;
    const tmr = setTimeout(async () => {
      const res = await actions.saveDraft(slug, page, version ?? undefined, activeLocale);
      if (res.ok) {
        setVersion(res.version);
        setDirty(false);
        setStatus(t("shell.draftSaved"));
        setPreviewV((v) => v + 1);
      } else {
        setConflict(true);
        setStatus("");
      }
    }, 800);
    return () => clearTimeout(tmr);
  }, [page, dirty, slug, actions, version, conflict, activeLocale, t]);

  // Messages from the preview iframe: block selection + inline text edits.
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      const d = e.data;
      if (!d || d.__scms !== true) return;
      if (d.type === "select" && typeof d.index === "number") {
        setSelected(d.index);
      }
      if (d.type === "edit" && typeof d.index === "number") {
        // Map the edited on-canvas text back to the slice's matching string
        // field (by comparing plain text, ignoring **markdown** markers).
        const before = String(d.before ?? "").trim();
        setPage((p) => {
          const slices = [...p.slices];
          const s = { ...slices[d.index] };
          const key = Object.keys(s).find(
            (k) => k !== "slice" && typeof s[k] === "string" && String(s[k]).replaceAll("**", "").trim() === before
          );
          if (!key) return p;
          s[key] = String(d.after ?? "");
          slices[d.index] = s;
          return { ...p, slices };
        });
        setSelected(d.index);
        setDirty(true);
        setStatus("");
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  // Sidebar selection -> scroll the matching block into view in the preview.
  useEffect(() => {
    iframeRef.current?.contentWindow?.postMessage(
      { __scms: true, type: "select", index: selected },
      window.location.origin
    );
  }, [selected, previewV]);

  const mutate = (slices: Slice[], nextSelected = selected) => {
    setPage((p) => ({ ...p, slices }));
    setSelected(Math.max(0, Math.min(nextSelected, slices.length - 1)));
    setDirty(true);
    setStatus("");
  };

  const reorder = (from: number, to: number) => {
    if (to < 0 || to >= page.slices.length) return;
    const next = [...page.slices];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    mutate(next, to);
  };
  const add = (name: string) =>
    mutate([...page.slices, { slice: name, ...(defaults[name] ?? {}) }], page.slices.length);
  const duplicate = (i: number) => {
    const next = [...page.slices];
    next.splice(i + 1, 0, { ...page.slices[i] });
    mutate(next, i + 1);
  };
  const remove = (i: number) => mutate(page.slices.filter((_, j) => j !== i), Math.max(0, i - 1));
  const updateSelected = (next: Slice) =>
    mutate(page.slices.map((s, j) => (j === selected ? next : s)));

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

  const publish = async () => {
    setBusy(true);
    setStatus(t("shell.publishing"));
    try {
      // Save at our version first; if that already conflicts, don't publish.
      const saved = await actions.saveDraft(slug, page, version ?? undefined, activeLocale);
      if (!saved.ok) {
        setConflict(true);
        setStatus("");
        return;
      }
      setVersion(saved.version);
      const pub = await actions.publish(slug, saved.version, activeLocale);
      if (!pub.ok) {
        setConflict(true);
        setStatus("");
        return;
      }
      window.location.reload();
    } catch (e) {
      setStatus(t("shell.publishFailed", { error: e instanceof Error ? e.message : String(e) }));
    } finally {
      setBusy(false);
    }
  };
  const discard = () => {
    if (!confirm(t("shell.confirmDiscard"))) return;
    run(t("shell.discardDraft"), () => actions.discardDraft(slug, activeLocale), true);
  };

  // Locale switch: mirror to ?locale= (so reload/preview share it). An
  // untranslated target first seeds a draft copied from the default locale.
  const switchLocale = (next: string) => {
    if (next === activeLocale) return;
    const go = () => {
      const url = new URL(window.location.href);
      url.searchParams.set("locale", next);
      window.location.href = url.toString();
    };
    if (translatedLocales.includes(next)) return go();
    startSwitch(async () => {
      await actions.createTranslation(slug, next);
      go();
    });
  };

  // Conflict resolution. Reload takes the other editor's version (losing local
  // unsaved edits); Overwrite blind-writes our version (baseVersion omitted).
  const reloadConflict = () => window.location.reload();
  const overwrite = async () => {
    setBusy(true);
    setStatus(t("shell.overwriting"));
    try {
      const res = await actions.saveDraft(slug, page, undefined, activeLocale);
      if (res.ok) {
        setVersion(res.version);
        setConflict(false);
        setDirty(false);
        setStatus(t("shell.draftSaved"));
        setPreviewV((v) => v + 1);
      }
    } finally {
      setBusy(false);
    }
  };

  const previewSrc = `${previewPath}/${slug}?locale=${activeLocale}&v=${previewV}`;

  return (
    <div className={cn("fixed inset-0 z-[100] flex bg-[var(--scms-bg)] text-[var(--scms-fg)]", dark && "dark")}>
      <PagesNav
        pages={pages}
        currentSlug={slug}
        locale={activeLocale}
        defaultLocale={defaultLocale}
        allLocales={locales}
        onCreate={actions.createPage}
        onDelete={actions.deletePage}
      >
        <BlockList
          slices={page.slices}
          selectedIndex={selected}
          sliceNames={sliceNames}
          onSelect={setSelected}
          onReorder={reorder}
          onAdd={add}
          onDuplicate={duplicate}
          onDelete={remove}
        />
      </PagesNav>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-[var(--scms-border)] px-4 py-2">
          <span className="font-mono text-sm font-semibold">/{slug}</span>
          <span className="text-xs text-[var(--scms-muted-fg)]">
            {dirty ? t("shell.unsaved") : status || t("shell.upToDate")}
          </span>
          <div className="ml-auto flex items-center gap-2">
            {locales.length > 1 && (
              <Select
                aria-label={t("shell.locale")}
                value={activeLocale}
                disabled={busy || switching}
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
            <Button
              variant="ghost"
              size="icon"
              aria-label={t("shell.toggleTheme")}
              onClick={() => setDark((v) => !v)}
            >
              {dark ? <Sun /> : <Moon />}
            </Button>
            <Button variant="ghost" size="sm" disabled={busy} onClick={discard}>
              {t("shell.discardDraft")}
            </Button>
            <Button size="sm" disabled={busy || conflict} onClick={publish}>
              {t("shell.publish")}
            </Button>
          </div>
        </header>

        {isFallback && locales.length > 1 && (
          <div
            role="status"
            className="flex flex-wrap items-center gap-2 border-b border-[var(--scms-border)] bg-[var(--scms-muted)] px-4 py-2 text-sm text-[var(--scms-fg)]"
          >
            <Languages className="size-4 shrink-0 text-[var(--scms-muted-fg)]" aria-hidden />
            <span className="min-w-0 flex-1">
              {t("shell.fallbackBanner", { defaultLocale, locale: activeLocale })}
            </span>
          </div>
        )}

        {conflict && (
          <div
            role="alert"
            className="flex flex-wrap items-center gap-3 border-b border-[var(--scms-border)] bg-[var(--scms-muted)] px-4 py-2 text-sm text-[var(--scms-fg)]"
          >
            <TriangleAlert className="size-4 shrink-0 text-[var(--scms-destructive)]" aria-hidden />
            <span className="min-w-0 flex-1">{t("shell.conflict")}</span>
            <div className="flex shrink-0 items-center gap-2">
              <Button variant="outline" size="sm" disabled={busy} onClick={reloadConflict}>
                {t("shell.reload")}
              </Button>
              <Button variant="destructive" size="sm" disabled={busy} onClick={overwrite}>
                {t("shell.overwrite")}
              </Button>
            </div>
          </div>
        )}

        <div className="flex min-h-0 flex-1">
          <DevicePreview src={previewSrc} reloadKey={previewV} iframeRef={iframeRef} />

          <aside className="w-80 shrink-0 overflow-y-auto border-l border-[var(--scms-border)]">
            <div className="border-b border-[var(--scms-border)] px-3 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--scms-muted-fg)]">
              {t("shell.properties")}
            </div>
            <div className="p-3">
              {page.slices[selected] ? (
                <FieldForm
                  key={selected}
                  slice={page.slices[selected]}
                  schema={fieldSchema?.[page.slices[selected].slice]}
                  onChange={updateSelected}
                  media={media}
                />
              ) : (
                <p className="text-sm text-[var(--scms-muted-fg)]">{t("shell.selectBlock")}</p>
              )}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
