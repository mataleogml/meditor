import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MediaGrid } from "./media-grid";
import type { MediaAsset } from "../types";

afterEach(cleanup);

const assets: MediaAsset[] = [
  { id: "a.webp", url: "/img/a.webp", name: "a.webp", size: 2048, mime: "image/webp", createdAt: "2026-01-01T00:00:00.000Z" },
  { id: "b.svg", url: "/img/b.svg", name: "b.svg", size: 512, mime: "image/svg+xml", createdAt: "2026-01-02T00:00:00.000Z" },
];

describe("MediaGrid", () => {
  it("shows an empty state with no assets", () => {
    render(
      <MediaGrid assets={[]} mode="library" query="" onQueryChange={() => {}} onUploadFiles={() => {}} />
    );
    expect(screen.getByText(/drop images here/i)).toBeInTheDocument();
  });

  it("library mode: renders each asset and Delete removes it", async () => {
    const onDelete = vi.fn();
    render(
      <MediaGrid assets={assets} mode="library" query="" onQueryChange={() => {}} onDelete={onDelete} onUploadFiles={() => {}} />
    );
    expect(screen.getByAltText("a.webp")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Delete a.webp" }));
    expect(onDelete).toHaveBeenCalledWith("a.webp");
  });

  it("picker mode: clicking a card calls onSelect with the asset", async () => {
    const onSelect = vi.fn();
    render(
      <MediaGrid assets={assets} mode="picker" query="" onQueryChange={() => {}} onSelect={onSelect} onUploadFiles={() => {}} />
    );
    await userEvent.click(screen.getByAltText("b.svg"));
    expect(onSelect).toHaveBeenCalledWith(assets[1]);
  });

  it("typing in search calls onQueryChange (filtering is the caller's job)", async () => {
    const onQueryChange = vi.fn();
    render(
      <MediaGrid assets={assets} mode="library" query="" onQueryChange={onQueryChange} onUploadFiles={() => {}} />
    );
    await userEvent.type(screen.getByPlaceholderText(/search media/i), "a");
    expect(onQueryChange).toHaveBeenCalledWith("a");
  });

  it("choosing a file via the hidden file input calls onUploadFiles", async () => {
    const onUploadFiles = vi.fn();
    render(
      <MediaGrid assets={[]} mode="library" query="" onQueryChange={() => {}} onUploadFiles={onUploadFiles} />
    );
    const file = new File(["bytes"], "new.png", { type: "image/png" });
    const input = screen.getByLabelText(/upload images/i) as HTMLInputElement;
    await userEvent.upload(input, file);
    expect(onUploadFiles).toHaveBeenCalledTimes(1);
    expect(onUploadFiles.mock.calls[0][0][0]).toBe(file);
  });
});
