import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ImagePickerField } from "./image-picker-field";
import type { MediaAsset } from "../types";

afterEach(cleanup);

const asset: MediaAsset = {
  id: "photo-abcd1234.webp",
  url: "/img/photo-abcd1234.webp",
  name: "photo.webp",
  size: 1024,
  mime: "image/webp",
  createdAt: "2026-01-01T00:00:00.000Z",
};

describe("ImagePickerField", () => {
  it("with a value set, shows an image preview and a Remove button — even with no media library", () => {
    render(<ImagePickerField value="/img/existing.webp" onChange={() => {}} />);
    expect(screen.getByRole("presentation")).toHaveAttribute("src", "/img/existing.webp");
    expect(screen.getByRole("button", { name: "Remove" })).toBeInTheDocument();
    // no media library configured: no way to open a library, so no Replace
    expect(screen.queryByRole("button", { name: /replace/i })).not.toBeInTheDocument();
  });

  it("typing in the path input still works without a media library configured", async () => {
    const onChange = vi.fn();
    render(<ImagePickerField value="" onChange={onChange} />);
    await userEvent.type(screen.getByPlaceholderText("/img/…"), "x");
    expect(onChange).toHaveBeenCalledWith("x");
  });

  it("Add image loads the list and selecting an asset commits its url", async () => {
    const onChange = vi.fn();
    const list = vi.fn().mockResolvedValue([asset]);
    const media = { list, delete: vi.fn(), uploadPath: "/editor/media/upload" };

    render(<ImagePickerField value="" onChange={onChange} media={media} />);
    await userEvent.click(screen.getByRole("button", { name: /add image/i }));
    await waitFor(() => expect(list).toHaveBeenCalled());

    const pick = await screen.findByRole("button", { name: /photo\.webp/i });
    await userEvent.click(pick);

    expect(onChange).toHaveBeenCalledWith(asset.url);
  });

  it("Remove resets the value to empty", async () => {
    const onChange = vi.fn();
    render(<ImagePickerField value="/img/existing.webp" onChange={onChange} />);
    await userEvent.click(screen.getByRole("button", { name: "Remove" }));
    expect(onChange).toHaveBeenCalledWith("");
  });
});
