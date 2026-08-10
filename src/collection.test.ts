import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createMarkdownAdapter } from "./markdown-adapter";
import { makeCollectionActions, buildCollectionActions } from "./collection";
import type { CmsConfig } from "./types";
import type { CollectionSection, Section } from "./sections";

let dir: string;
let pagesContentDir: string;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "meditor-collection-"));
  pagesContentDir = path.join(dir, "content");
  fs.mkdirSync(pagesContentDir, { recursive: true });
});

afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

function makeConfig(sections: Section[] = []): CmsConfig {
  return {
    registry: {},
    defaults: {},
    adapter: createMarkdownAdapter({ contentDir: pagesContentDir }),
    previewPath: "/editor/preview",
    auth: { authorize: async () => true },
    sections,
  };
}

const authorsSection: CollectionSection = {
  kind: "collection",
  id: "authors",
  label: "Authors",
  dir: path.join("__placeholder__"), // overwritten per-test with an absolute tmp path
  schema: { name: { type: "text" }, role: { type: "text" } },
};

describe("dir-overlap guard", () => {
  it("throws when the collection dir equals the Pages content dir", () => {
    const config = makeConfig();
    const section = { ...authorsSection, dir: pagesContentDir };
    expect(() => makeCollectionActions(config, section)).toThrow(/overlaps the Pages content dir/);
  });

  it("throws when the collection dir is nested inside the Pages content dir", () => {
    const config = makeConfig();
    const section = { ...authorsSection, dir: path.join(pagesContentDir, "authors") };
    expect(() => makeCollectionActions(config, section)).toThrow(/overlaps the Pages content dir/);
  });

  it("throws when the Pages content dir is nested inside the collection dir", () => {
    const config = makeConfig();
    const section = { ...authorsSection, dir: dir }; // parent of pagesContentDir
    expect(() => makeCollectionActions(config, section)).toThrow(/overlaps the Pages content dir/);
  });

  it("allows a sibling dir", () => {
    const config = makeConfig();
    const section = { ...authorsSection, dir: path.join(dir, "authors") };
    expect(() => makeCollectionActions(config, section)).not.toThrow();
  });
});

describe("makeCollectionActions round-trip", () => {
  it("creates, saves, publishes and lists a record without leaking into Pages listSlugs", async () => {
    const authorsDir = path.join(dir, "authors");
    const config = makeConfig();
    const section = { ...authorsSection, dir: authorsDir };
    const actions = makeCollectionActions(config, section);

    const slug = await actions.createPage("Gabriel Lam");
    expect(slug).toBe("gabriel-lam");

    const saveResult = await actions.saveDraft(slug, { meta: { name: "Gabriel Lam", role: "Editor" }, slices: [], body: "" });
    expect(saveResult.ok).toBe(true);
    await actions.publish(slug);

    const collectionAdapter = createMarkdownAdapter({ contentDir: authorsDir });
    expect(collectionAdapter.listSlugs()).toEqual(["gabriel-lam"]);
    expect(config.adapter.listSlugs()).toEqual([]); // Pages dir never sees the record
  });
});

describe("buildCollectionActions", () => {
  it("builds one PageActions per declared collection section, keyed by id", () => {
    const authorsDir = path.join(dir, "authors");
    const config = makeConfig([
      { kind: "pages", label: "Pages" },
      { ...authorsSection, dir: authorsDir },
    ]);
    const built = buildCollectionActions(config);
    expect(Object.keys(built)).toEqual(["authors"]);
  });
});
