import { describe, expect, it } from "vitest";
import type { Slice } from "../types";
import {
  addSlice,
  clampSelected,
  controlFor,
  duplicate,
  humanSize,
  isMultiline,
  mapEditToField,
  remove,
  reorder,
  updateSelected,
} from "./slice-ops";

const slices = (...names: string[]): Slice[] => names.map((slice) => ({ slice }));

describe("clampSelected", () => {
  it("clamps into range", () => {
    expect(clampSelected(slices("a", "b"), 5)).toBe(1);
    expect(clampSelected(slices("a", "b"), -1)).toBe(0);
  });
  it("clamps to 0 for an empty array", () => {
    expect(clampSelected([], 3)).toBe(0);
  });
});

describe("reorder", () => {
  it("moves a slice and selects its new index", () => {
    const r = reorder(slices("a", "b", "c"), 0, 2);
    expect(r?.slices.map((s) => s.slice)).toEqual(["b", "c", "a"]);
    expect(r?.selected).toBe(2);
  });
  it("returns null when `to` is out of bounds", () => {
    const s = slices("a", "b");
    expect(reorder(s, 0, -1)).toBeNull();
    expect(reorder(s, 0, 2)).toBeNull();
  });
});

describe("addSlice", () => {
  it("appends with registered defaults and selects it", () => {
    const r = addSlice(slices("a"), "hero", { hero: { title: "Hi" } });
    expect(r.slices).toEqual([{ slice: "a" }, { slice: "hero", title: "Hi" }]);
    expect(r.selected).toBe(1);
  });
  it("defaults to no extra props when none registered", () => {
    const r = addSlice([], "hero", {});
    expect(r.slices).toEqual([{ slice: "hero" }]);
  });
});

describe("duplicate", () => {
  it("inserts a copy right after the source and selects it", () => {
    const r = duplicate(slices("a", "b"), 0);
    expect(r.slices.map((s) => s.slice)).toEqual(["a", "a", "b"]);
    expect(r.selected).toBe(1);
    // copy is a distinct object
    expect(r.slices[0]).not.toBe(r.slices[1]);
  });
});

describe("remove", () => {
  it("drops the slice and selects the one before it", () => {
    const r = remove(slices("a", "b", "c"), 1);
    expect(r.slices.map((s) => s.slice)).toEqual(["a", "c"]);
    expect(r.selected).toBe(0);
  });
  it("clamps to 0 when removing the first slice", () => {
    const r = remove(slices("a", "b"), 0);
    expect(r.slices.map((s) => s.slice)).toEqual(["b"]);
    expect(r.selected).toBe(0);
  });
});

describe("updateSelected", () => {
  it("replaces only the selected slice", () => {
    const r = updateSelected(slices("a", "b"), 1, { slice: "b", title: "new" });
    expect(r.slices).toEqual([{ slice: "a" }, { slice: "b", title: "new" }]);
    expect(r.selected).toBe(1);
  });
});

describe("mapEditToField", () => {
  it("matches the field ignoring ** markdown markers and whitespace", () => {
    const s: Slice[] = [{ slice: "hero", title: "**Hello world**" }];
    const next = mapEditToField(s, 0, "  Hello world  ", "Goodbye world");
    expect(next?.[0]).toEqual({ slice: "hero", title: "Goodbye world" });
  });
  it("returns null when no field matches", () => {
    const s: Slice[] = [{ slice: "hero", title: "Hello" }];
    expect(mapEditToField(s, 0, "nope", "x")).toBeNull();
  });
  it("does not mutate the input array or slice", () => {
    const s: Slice[] = [{ slice: "hero", title: "Hello" }];
    mapEditToField(s, 0, "Hello", "Bye");
    expect(s[0].title).toBe("Hello");
  });
  it("skips the `slice` key itself and non-string fields", () => {
    const s: Slice[] = [{ slice: "hero", count: 5 }];
    expect(mapEditToField(s, 0, "hero", "x")).toBeNull();
  });
});

describe("isMultiline", () => {
  it("flags strings over 60 chars", () => {
    expect(isMultiline("a".repeat(61))).toBe(true);
    expect(isMultiline("a".repeat(60))).toBe(false);
  });
  it("flags strings containing a newline regardless of length", () => {
    expect(isMultiline("a\nb")).toBe(true);
  });
});

describe("controlFor", () => {
  it("schema hint wins over the value's own type", () => {
    expect(controlFor({ type: "select" }, "anything")).toBe("select");
  });
  it("infers boolean/number/text/textarea/yaml from the value when no hint", () => {
    expect(controlFor(undefined, true)).toBe("boolean");
    expect(controlFor(undefined, 5)).toBe("number");
    expect(controlFor(undefined, "short")).toBe("text");
    expect(controlFor(undefined, "x".repeat(61))).toBe("textarea");
    expect(controlFor(undefined, null)).toBe("text");
    expect(controlFor(undefined, undefined)).toBe("text");
    expect(controlFor(undefined, { a: 1 })).toBe("yaml");
    expect(controlFor(undefined, [1, 2])).toBe("yaml");
  });
});

describe("humanSize", () => {
  it("formats bytes, KB, and MB", () => {
    expect(humanSize(512)).toBe("512 B");
    expect(humanSize(2048)).toBe("2 KB");
    expect(humanSize(1024 * 1024 * 1.5)).toBe("1.5 MB");
  });
});
