import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MediaLibrary } from "./media-library";
import type { MediaAsset } from "../types";
import type { PageActions } from "../actions";

afterEach(cleanup);

const asset: MediaAsset = {
  id: "logo-abcd1234.webp",
  url: "/img/logo-abcd1234.webp",
  name: "logo.webp",
  size: 4096,
  mime: "image/webp",
  createdAt: "2026-01-01T00:00:00.000Z",
};

const noopActions = {
  saveDraft: vi.fn(),
  discardDraft: vi.fn(),
  publish: vi.fn(),
  createPage: vi.fn(),
  createTranslation: vi.fn(),
  deletePage: vi.fn(),
  deleteTranslation: vi.fn(),
} as unknown as PageActions;

describe("MediaLibrary", () => {
  it("loads the asset list on mount and renders it", async () => {
    const list = vi.fn().mockResolvedValue([asset]);
    render(
      <MediaLibrary
        pages={[]}
        media={{ list, delete: vi.fn() }}
        uploadPath="/editor/media/upload"
        actions={noopActions}
      />
    );
    expect(list).toHaveBeenCalledTimes(1);
    expect(await screen.findByAltText("logo.webp")).toBeInTheDocument();
  });

  it("deleting an asset optimistically removes it and calls media.delete", async () => {
    const list = vi.fn().mockResolvedValue([asset]);
    const del = vi.fn().mockResolvedValue(undefined);
    render(
      <MediaLibrary pages={[]} media={{ list, delete: del }} uploadPath="/editor/media/upload" actions={noopActions} />
    );
    await screen.findByAltText("logo.webp");
    await userEvent.click(screen.getByRole("button", { name: /delete logo\.webp/i }));
    await waitFor(() => expect(screen.queryByAltText("logo.webp")).not.toBeInTheDocument());
    expect(del).toHaveBeenCalledWith(asset.id);
  });
});
