"use client";

import { useEffect, useState } from "react";
import type { PageActions } from "../actions";
import type { MediaAsset, PageInfo } from "../types";
import { MediaGrid } from "./media-grid";
import { PagesNav } from "./pages-nav";
import { useT } from "./intl";

/**
 * Standalone full-page media library (parallels `SiteEditor`'s shape): same
 * `PagesNav` left rail and fixed-full-screen-overlay shell as the page/site
 * editors, `currentSlug="media"` so nothing in the page list highlights.
 */
export function MediaLibrary({
  pages,
  media,
  uploadPath,
  actions,
}: Readonly<{
  pages: PageInfo[];
  media: { list: () => Promise<MediaAsset[]>; delete: (id: string) => Promise<void> };
  uploadPath: string;
  actions: PageActions; // for the shared PagesNav's create/delete-page controls
}>) {
  const t = useT();
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");

  useEffect(() => {
    media.list().then(setAssets);
    // Mount-only fetch — `media` is a stable Server Action reference for the
    // lifetime of this page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const upload = async (files: FileList) => {
    setBusy(true);
    setStatus(t("media.uploading"));
    let failedError = "";
    // Sequential — avoids the fs adapter's random-suffix writes racing each
    // other for no benefit.
    for (const file of Array.from(files)) {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch(uploadPath, { method: "POST", body });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        failedError = err?.error ?? res.statusText;
      }
    }
    setAssets(await media.list());
    setStatus(failedError ? t("media.uploadFailed", { error: failedError }) : "");
    setBusy(false);
  };

  const remove = async (id: string) => {
    setAssets((prev) => prev.filter((a) => a.id !== id)); // optimistic
    try {
      await media.delete(id);
    } catch {
      setAssets(await media.list()); // roll back on failure
    }
  };

  const filtered = assets.filter((a) => a.name.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="fixed inset-0 z-[100] flex bg-[var(--scms-bg)] text-[var(--scms-fg)]">
      <PagesNav pages={pages} currentSlug="media" onCreate={actions.createPage} onDelete={actions.deletePage} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-[var(--scms-border)] px-4 py-2">
          <span className="text-sm font-semibold">{t("media.title")}</span>
          <span className="text-xs text-[var(--scms-muted-fg)]">{status}</span>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <MediaGrid
            assets={filtered}
            mode="library"
            query={query}
            onQueryChange={setQuery}
            onDelete={remove}
            onUploadFiles={upload}
            busy={busy}
          />
        </div>
      </div>
    </div>
  );
}
