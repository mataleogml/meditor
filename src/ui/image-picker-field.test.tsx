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
  it("degrades to a plain text input with no Browse button when media is absent", () => {
    render(<ImagePickerField value="/img/existing.webp" onChange={() => {}} />);
    expect(screen.getByDisplayValue("/img/existing.webp")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /browse library/i })).not.toBeInTheDocument();
  });

  it("typing in the path input still works without a media library configured", async () => {
    const onChange = vi.fn();
    render(<ImagePickerField value="" onChange={onChange} />);
    await userEvent.type(screen.getByPlaceholderText("/img/…"), "x");
    expect(onChange).toHaveBeenCalledWith("x");
  });

  it("Browse library loads the list and selecting an asset commits its url", async () => {
    const onChange = vi.fn();
    const list = vi.fn().mockResolvedValue([asset]);
    const media = { list, delete: vi.fn(), uploadPath: "/editor/media/upload" };

    render(<ImagePickerField value="" onChange={onChange} media={media} />);
    await userEvent.click(screen.getByRole("button", { name: /browse library/i }));
    await waitFor(() => expect(list).toHaveBeenCalled());

    const pick = await screen.findByRole("button", { name: /photo\.webp/i });
    await userEvent.click(pick);

    expect(onChange).toHaveBeenCalledWith(asset.url);
  });

  it("Clear resets the value to empty", async () => {
    const onChange = vi.fn();
    render(<ImagePickerField value="/img/existing.webp" onChange={onChange} />);
    await userEvent.click(screen.getByRole("button", { name: /clear/i }));
    expect(onChange).toHaveBeenCalledWith("");
  });
});
