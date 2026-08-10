import { describe, expect, it } from "vitest";
import { MeditorShell } from "./shell.element";
import type { ResolvedSection, SectionCtx } from "../sections";
import type { PageInfo } from "../types";

/**
 * Which Pages view the shell picks. Mounted rather than unit-tested because the
 * branch IS the render output: with no chosen page the section used to return
 * `nothing`, i.e. `/<adminRoute>/pages` painted an empty region next to a
 * perfectly fine nav — the same silent-blank failure mode as a thrown seed.
 */
const PAGES: PageInfo[] = [
  { slug: "home", title: "Home", hasDraft: false, locales: ["en"] },
  { slug: "about", title: "About", hasDraft: true, locales: ["en"] },
];

const SECTIONS: ResolvedSection[] = [
  { raw: { kind: "pages", label: "Pages" }, id: "pages", label: "Pages", kind: "pages", group: "content" },
];

// Only the fields the Pages branch and the nav actually read; the rest of the
// ctx surface isn't exercised by these two assertions.
const ctx = (adminRoute = "editor") =>
  ({
    apiVersion: 1,
    config: {},
    actions: {},
    collections: {},
    settings: {},
    settingsSnapshot: { brand: { name: "Test" }, seo: {}, bootstrap: { adminRoute } },
    locale: "en",
    locales: ["en"],
    defaultLocale: "en",
    navigate: () => {},
    setTopBarAction: () => {},
    capabilities: new Set<string>(),
  }) as unknown as SectionCtx;

async function mount(pagesProps: Record<string, unknown>, adminRoute?: string) {
  const el = new MeditorShell();
  el.sections = SECTIONS;
  el.activeId = "pages";
  el.ctx = ctx(adminRoute);
  el.pagesProps = pagesProps as unknown as MeditorShell["pagesProps"];
  document.body.append(el);
  await el.updateComplete;
  return el;
}

const BASE = { pages: PAGES, sliceNames: ["hero"], defaults: {}, previewPath: "/editor/preview" };

describe("<meditor-shell> Pages section view", () => {
  it("renders the page picker when no page is chosen", async () => {
    const el = await mount(BASE);
    const region = el.shadowRoot!.querySelector(".region")!;
    expect(region.firstElementChild?.tagName.toLowerCase()).toBe("meditor-page-list");
    expect(region.querySelector("meditor-editor")).toBeNull();
    el.remove();
  });

  it("derives the picker's link base from the live admin route", async () => {
    const el = await mount(BASE, "studio");
    const list = el.shadowRoot!.querySelector("meditor-page-list")!;
    expect((list as unknown as { basePath: string }).basePath).toBe("/studio");
    el.remove();
  });

  it("renders the editor once a page is chosen", async () => {
    const el = await mount({ ...BASE, slug: "about", initialPage: { meta: {}, slices: [], body: "" } });
    const region = el.shadowRoot!.querySelector(".region")!;
    expect(region.firstElementChild?.tagName.toLowerCase()).toBe("meditor-editor");
    el.remove();
  });

  // The widened props let a host pass a page with no version; `<meditor-editor>`
  // gates its own render on `initialVersion !== undefined`, so an omitted one
  // has to arrive as null or the canvas silently stays empty.
  it("normalizes an omitted initialVersion to null for the editor", async () => {
    const el = await mount({ ...BASE, slug: "about", initialPage: { meta: {}, slices: [], body: "" } });
    const editor = el.shadowRoot!.querySelector("meditor-editor")!;
    expect((editor as unknown as { initialVersion: string | null }).initialVersion).toBeNull();
    el.remove();
  });
});
