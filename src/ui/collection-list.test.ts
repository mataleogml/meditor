import { describe, expect, it } from "vitest";
import { resolveListColumns } from "./collection-list.element";

describe("resolveListColumns", () => {
  it("defaults primary to titleField and extra to the first 4 schema keys minus primary", () => {
    const schema = { name: {}, role: {}, photo: {}, bio: {}, notes: {} };
    expect(resolveListColumns(schema, "name")).toEqual({ primary: "name", extra: ["role", "photo", "bio"] });
  });

  it("falls back to a 'title' schema key, then the first key, when titleField is omitted", () => {
    expect(resolveListColumns({ title: {}, body: {} })).toEqual({ primary: "title", extra: ["body"] });
    expect(resolveListColumns({ name: {}, role: {} })).toEqual({ primary: "name", extra: ["role"] });
  });

  it("honors an explicit columns list and still excludes the primary from extra", () => {
    expect(resolveListColumns({ name: {}, role: {}, bio: {} }, "name", ["name", "bio"])).toEqual({
      primary: "name",
      extra: ["bio"],
    });
  });

  it("degrades to an undefined primary and empty extra for an empty schema", () => {
    expect(resolveListColumns({})).toEqual({ primary: undefined, extra: [] });
  });
});
