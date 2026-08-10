import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FieldForm } from "./field-form";
import type { Slice, SliceSchema } from "../types";

afterEach(cleanup);

describe("FieldForm — image control", () => {
  it("bare string image prop renders the picker bound to that string, no alt input", () => {
    const slice: Slice = { slice: "bigStat", image: "/img/photo.webp" };
    const schema: SliceSchema = { image: { type: "image" } };
    render(<FieldForm slice={slice} schema={schema} onChange={() => {}} />);
    expect(screen.getByDisplayValue("/img/photo.webp")).toBeInTheDocument();
    expect(screen.queryByPlaceholderText("Alt text")).not.toBeInTheDocument();
  });

  it("{src,alt} object image prop renders both the picker and an alt input", async () => {
    const onChange = vi.fn();
    const slice: Slice = { slice: "splitFeature", media: { src: "/img/a.webp", alt: "A description" } };
    const schema: SliceSchema = { media: { type: "image" } };
    render(<FieldForm slice={slice} schema={schema} onChange={onChange} />);

    expect(screen.getByDisplayValue("/img/a.webp")).toBeInTheDocument();
    const altInput = screen.getByPlaceholderText("Alt text");
    expect(altInput).toHaveValue("A description");

    await userEvent.type(altInput, "!");
    expect(onChange).toHaveBeenLastCalledWith({
      slice: "splitFeature",
      media: { src: "/img/a.webp", alt: "A description!" },
    });
  });

  it("editing the src input on a {src,alt} field preserves the existing alt", async () => {
    const onChange = vi.fn();
    const slice: Slice = { slice: "splitFeature", media: { src: "", alt: "Existing alt" } };
    const schema: SliceSchema = { media: { type: "image" } };
    render(<FieldForm slice={slice} schema={schema} onChange={onChange} />);

    await userEvent.type(screen.getByPlaceholderText("/img/…"), "x");
    expect(onChange).toHaveBeenLastCalledWith({
      slice: "splitFeature",
      media: { src: "x", alt: "Existing alt" },
    });
  });

  it("degrades to a plain input with no Browse button when no media library is configured", () => {
    const slice: Slice = { slice: "bigStat", image: "/img/photo.webp" };
    const schema: SliceSchema = { image: { type: "image" } };
    render(<FieldForm slice={slice} schema={schema} onChange={() => {}} />);
    expect(screen.queryByRole("button", { name: /browse library/i })).not.toBeInTheDocument();
  });

  it('"media" is a drop-in alias of "image" — same control, same behavior', () => {
    const onChange = vi.fn();
    const slice: Slice = { slice: "splitFeature", media: { src: "/img/a.webp", alt: "A" } };
    const schema: SliceSchema = { media: { type: "media" } };
    render(<FieldForm slice={slice} schema={schema} onChange={onChange} />);
    expect(screen.getByDisplayValue("/img/a.webp")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Alt text")).toHaveValue("A");
  });
});

describe("FieldForm — back-compat (existing schemas render unchanged)", () => {
  it("a field with no schema entry still auto-detects (short string -> text input)", () => {
    const slice: Slice = { slice: "hero", heading: "Hello" };
    render(<FieldForm slice={slice} onChange={() => {}} />);
    expect(screen.getByDisplayValue("Hello")).toBeInTheDocument();
  });

  it("a field with no schema entry still auto-detects (long string -> textarea)", () => {
    const long = "x".repeat(80);
    const slice: Slice = { slice: "hero", body: long };
    render(<FieldForm slice={slice} onChange={() => {}} />);
    expect(screen.getByDisplayValue(long).tagName).toBe("TEXTAREA");
  });
});

describe("FieldForm — richtext control", () => {
  it("renders as a textarea with a markdown hint, and commits edits", async () => {
    const onChange = vi.fn();
    const slice: Slice = { slice: "prose", body: "Hi" };
    const schema: SliceSchema = { body: { type: "richtext" } };
    render(<FieldForm slice={slice} schema={schema} onChange={onChange} />);
    expect(screen.getByText(/bold.*supported/i)).toBeInTheDocument();
    const box = screen.getByDisplayValue("Hi");
    expect(box.tagName).toBe("TEXTAREA");
    await userEvent.type(box, "!");
    expect(onChange).toHaveBeenLastCalledWith({ slice: "prose", body: "Hi!" });
  });
});

describe("FieldForm — link control", () => {
  it("renders label/href inputs and an external toggle, and commits edits to each", async () => {
    const onChange = vi.fn();
    const slice: Slice = { slice: "ctaBand", cta: { label: "Go", href: "/x", external: false } };
    const schema: SliceSchema = { cta: { type: "link" } };
    render(<FieldForm slice={slice} schema={schema} onChange={onChange} />);

    expect(screen.getByPlaceholderText("Link text")).toHaveValue("Go");
    expect(screen.getByPlaceholderText("https://…")).toHaveValue("/x");
    const toggle = screen.getByRole("checkbox", { name: /opens in a new tab/i });
    expect(toggle).not.toBeChecked();

    await userEvent.click(toggle);
    expect(onChange).toHaveBeenLastCalledWith({
      slice: "ctaBand",
      cta: { label: "Go", href: "/x", external: true },
    });
  });

  it("starts from an empty object when the field isn't set yet", async () => {
    const onChange = vi.fn();
    const slice: Slice = { slice: "ctaBand" };
    const schema: SliceSchema = { cta: { type: "link" } };
    render(<FieldForm slice={slice} schema={schema} onChange={onChange} />);
    // Single char — the input isn't re-rendered with each onChange (no state
    // update here), so a second keystroke would restart from the same `{}`.
    await userEvent.type(screen.getByPlaceholderText("Link text"), "H");
    expect(onChange).toHaveBeenLastCalledWith({ slice: "ctaBand", cta: { label: "H" } });
  });
});

describe("FieldForm — color control", () => {
  const schema: SliceSchema = { tone: { type: "color", options: ["base", "brand", "accent"] } };

  it("renders one swatch button per option, resolved through a --scms-swatch-<token> variable", () => {
    const slice: Slice = { slice: "featureColumns", tone: "brand" };
    render(<FieldForm slice={slice} schema={schema} onChange={() => {}} />);
    const swatch = screen.getByRole("button", { name: "brand" });
    expect(swatch).toHaveAttribute("aria-pressed", "true");
    expect(swatch).toHaveStyle({ backgroundColor: "var(--scms-swatch-brand, transparent)" });
    expect(screen.getByRole("button", { name: "base" })).toHaveAttribute("aria-pressed", "false");
  });

  it("clicking a swatch commits that token", async () => {
    const onChange = vi.fn();
    const slice: Slice = { slice: "featureColumns", tone: "base" };
    render(<FieldForm slice={slice} schema={schema} onChange={onChange} />);
    await userEvent.click(screen.getByRole("button", { name: "accent" }));
    expect(onChange).toHaveBeenCalledWith({ slice: "featureColumns", tone: "accent" });
  });
});

describe("FieldForm — icon control", () => {
  it("degrades to a plain text input with no Choose-icon button when no icon library is configured", () => {
    const slice: Slice = { slice: "cardGrid", icon: "/img/money.svg" };
    const schema: SliceSchema = { icon: { type: "icon" } };
    render(<FieldForm slice={slice} schema={schema} onChange={() => {}} />);
    expect(screen.getByDisplayValue("/img/money.svg")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /choose icon/i })).not.toBeInTheDocument();
  });

  it("Choose icon opens a searchable picker; selecting one commits its name", async () => {
    const onChange = vi.fn();
    const slice: Slice = { slice: "cardGrid", icon: "" };
    const schema: SliceSchema = { icon: { type: "icon" } };
    const icons = {
      list: () => [
        { name: "/img/money.svg", render: () => <span>$</span> },
        { name: "/img/wallet.svg", render: () => <span>W</span> },
      ],
    };
    render(<FieldForm slice={slice} schema={schema} onChange={onChange} icons={icons} />);

    await userEvent.click(screen.getByRole("button", { name: /choose icon/i }));
    await userEvent.type(screen.getByPlaceholderText("Search icons…"), "wallet");
    expect(screen.queryByRole("button", { name: "/img/money.svg" })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "/img/wallet.svg" }));
    expect(onChange).toHaveBeenCalledWith({ slice: "cardGrid", icon: "/img/wallet.svg" });
  });
});

describe("FieldForm — slot control", () => {
  const schema: SliceSchema = {
    columns: {
      type: "slot",
      itemLabel: "title",
      of: { title: { type: "text" }, body: { type: "textarea" } },
    },
  };

  it("shows the itemLabel field's value as the row heading, falling back to Item N", () => {
    const slice: Slice = {
      slice: "featureColumns",
      columns: [{ title: "First", body: "a" }, { body: "b" }],
    };
    render(<FieldForm slice={slice} schema={schema} onChange={() => {}} />);
    expect(screen.getByText("First")).toBeInTheDocument();
    expect(screen.getByText("Item 2")).toBeInTheDocument();
  });

  it("round-trips add -> edit -> reorder -> remove", async () => {
    let slice: Slice = { slice: "featureColumns", columns: [{ title: "A", body: "1" }] };
    const onChange = vi.fn((next: Slice) => {
      slice = next;
      rerender(<FieldForm slice={slice} schema={schema} onChange={onChange} />);
    });
    const { rerender } = render(<FieldForm slice={slice} schema={schema} onChange={onChange} />);

    // add
    await userEvent.click(screen.getByRole("button", { name: /add item/i }));
    expect(slice.columns).toEqual([{ title: "A", body: "1" }, {}]);

    // edit the new (second) row's title — DOM order is [row1.title, row1.body,
    // row2.title, row2.body], no htmlFor association to query by label text
    // (matches this file's existing Label+Input convention throughout).
    const textboxes = screen.getAllByRole("textbox");
    await userEvent.type(textboxes[2], "B");
    expect(slice.columns).toEqual([{ title: "A", body: "1" }, { title: "B" }]);

    // reorder: move row 2 ("B") up above row 1 ("A")
    await userEvent.click(screen.getByRole("button", { name: /move b up/i }));
    expect(slice.columns).toEqual([{ title: "B" }, { title: "A", body: "1" }]);

    // remove the now-first row ("B") — empty of body, still has a title, so
    // it counts as "has content" and must be confirmed.
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    await userEvent.click(screen.getByRole("button", { name: /remove b/i }));
    expect(confirmSpy).toHaveBeenCalled();
    expect(slice.columns).toEqual([{ title: "A", body: "1" }]);
    confirmSpy.mockRestore();
  });

  it("cancelling the confirm dialog keeps the row", async () => {
    let slice: Slice = { slice: "featureColumns", columns: [{ title: "A", body: "1" }] };
    const onChange = vi.fn((next: Slice) => {
      slice = next;
      rerender(<FieldForm slice={slice} schema={schema} onChange={onChange} />);
    });
    const { rerender } = render(<FieldForm slice={slice} schema={schema} onChange={onChange} />);

    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    await userEvent.click(screen.getByRole("button", { name: /remove a/i }));
    expect(confirmSpy).toHaveBeenCalled();
    expect(slice.columns).toEqual([{ title: "A", body: "1" }]);
    confirmSpy.mockRestore();
  });

  it("removing an empty row needs no confirmation", async () => {
    let slice: Slice = { slice: "featureColumns", columns: [{}] };
    const onChange = vi.fn((next: Slice) => {
      slice = next;
      rerender(<FieldForm slice={slice} schema={schema} onChange={onChange} />);
    });
    const { rerender } = render(<FieldForm slice={slice} schema={schema} onChange={onChange} />);

    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    await userEvent.click(screen.getByRole("button", { name: /remove item 1/i }));
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(slice.columns).toEqual([]);
    confirmSpy.mockRestore();
  });

  it("recurses: an item field typed \"icon\" renders IconPickerField inline", () => {
    const nestedSchema: SliceSchema = {
      columns: { type: "slot", of: { icon: { type: "icon" } } },
    };
    const slice: Slice = { slice: "featureColumns", columns: [{ icon: "/img/money.svg" }] };
    render(<FieldForm slice={slice} schema={nestedSchema} onChange={() => {}} />);
    expect(screen.getByDisplayValue("/img/money.svg")).toBeInTheDocument();
  });
});
