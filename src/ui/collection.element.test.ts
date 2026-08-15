import { describe, expect, it, vi } from "vitest";
import { MeditorCollection } from "./collection.element";
import type { CollectionSection, SectionCtx } from "../sections";
import type { CollectionRecordInfo } from "./collection-list.element";
import type { PageActions } from "../actions";

const section: CollectionSection = {
  kind: "collection",
  id: "authors",
  label: "Author",
  dir: "content/authors",
  schema: { name: { type: "text" } },
};

const ctx = {
  apiVersion: 1,
  config: {},
  actions: {},
  collections: {},
  settings: {},
  settingsSnapshot: { brand: { name: "Test" }, seo: {} },
  locale: "en",
  locales: ["en"],
  defaultLocale: "en",
  navigate: () => {},
  setTopBarAction: () => {},
  capabilities: new Set<string>(),
} as unknown as SectionCtx;

async function mount(records: CollectionRecordInfo[], actions: Partial<PageActions>) {
  const el = new MeditorCollection();
  el.section = section;
  el.actions = actions as PageActions;
  el.ctx = ctx;
  el.records = records;
  document.body.append(el);
  await el.updateComplete;
  return el;
}

describe("<meditor-collection> save preserves the record body", () => {
  // The regression: _save used to hardcode `body: ""`, so editing ANY
  // collection record through the UI erased that file's markdown body.
  it("saves the record's existing prose body instead of blanking it", async () => {
    const saveDraft = vi.fn(async () => ({ ok: true, version: "v1" }) as const);
    const publish = vi.fn(async () => ({ ok: true, version: "v1" }) as const);
    const record: CollectionRecordInfo = {
      slug: "gabriel-lam",
      meta: { name: "Gabriel Lam" },
      body: "Some hand-written biography prose.",
      hasDraft: false,
    };
    const el = await mount([record], { saveDraft, publish });

    // Open the record for edit, exactly like a click on its list row would.
    const list = el.shadowRoot!.querySelector("meditor-collection-list")!;
    (list as unknown as { onSelect: (slug: string) => void }).onSelect("gabriel-lam");
    await el.updateComplete;

    // Edit a meta field — dirties the form. The field-form only ever touches
    // meta, never body, so this must not affect what gets saved for it.
    const form = el.shadowRoot!.querySelector("meditor-field-form")!;
    form.dispatchEvent(new CustomEvent("change", { detail: { slice: "Author", name: "Gabriel Mataleo" } }));
    await el.updateComplete;

    const saveBtn = [...el.shadowRoot!.querySelectorAll("button")].find((b) => b.textContent?.trim() === "Save")!;
    saveBtn.click();
    await el.updateComplete;
    await vi.waitFor(() => expect(saveDraft).toHaveBeenCalled());

    expect(saveDraft).toHaveBeenCalledWith(
      "gabriel-lam",
      { meta: { name: "Gabriel Mataleo" }, slices: [], body: "Some hand-written biography prose." },
      undefined,
      "en"
    );
    expect(publish).toHaveBeenCalledWith("gabriel-lam", undefined, "en");
    el.remove();
  });

  // The other side of the asymmetry: a brand-new record legitimately has no
  // body yet, so create is correct to send "" — this pins that down so it
  // doesn't get "fixed" into matching _save by mistake.
  it("creates a new record with an empty body", async () => {
    const createPage = vi.fn(async () => "new-author");
    const saveDraft = vi.fn(async () => ({ ok: true, version: "v1" }) as const);
    const publish = vi.fn(async () => ({ ok: true, version: "v1" }) as const);
    const el = await mount([], { createPage, saveDraft, publish });

    (el as unknown as { _startCreate(): void })._startCreate();
    await el.updateComplete;
    (el as unknown as { _newTitle: string })._newTitle = "New Author";
    await (el as unknown as { _submitCreate(): Promise<void> })._submitCreate();

    expect(saveDraft).toHaveBeenCalledWith(
      "new-author",
      { meta: { name: "New Author" }, slices: [], body: "" },
      undefined,
      "en"
    );
    el.remove();
  });
});
