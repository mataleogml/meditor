import { describe, it, expect, afterEach } from "vitest";
import { act } from "@testing-library/react";
import { defineMeditorEditor, type MeditorEditorElement } from "./wc";
import type { PageActions } from "./actions";

// Manual mount (append the element ourselves) needs React's act env flag, which
// @testing-library/react's render() would otherwise set for us.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// EditorShell reads bare `localStorage` for its theme; jsdom under an opaque
// origin doesn't expose the global, so provide a tiny in-memory stand-in.
if (typeof globalThis.localStorage === "undefined") {
  const mem = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (k: string) => mem.get(k) ?? null,
      setItem: (k: string, v: string) => void mem.set(k, String(v)),
      removeItem: (k: string) => void mem.delete(k),
      clear: () => mem.clear(),
    },
  });
}

// Importing "./wc" already auto-registers; this exercises the exported
// registrar and proves it's idempotent (no "already defined" throw).
defineMeditorEditor();

const actions: PageActions = {
  saveDraft: async () => ({ ok: true, version: "1" }),
  discardDraft: async () => {},
  publish: async () => ({ ok: true, version: "1" }),
  createPage: async () => "new",
  createTranslation: async () => {},
  deletePage: async () => {},
  deleteTranslation: async () => {},
};

function makeEl(slug = "home"): MeditorEditorElement {
  const el = document.createElement("meditor-editor") as MeditorEditorElement;
  el.slug = slug;
  el.pages = [];
  el.initialPage = { meta: { title: "Home" }, slices: [], body: "" };
  el.initialVersion = null;
  el.sliceNames = ["hero"];
  el.defaults = { hero: { title: "Hi" } };
  el.previewPath = "/editor/preview";
  el.actions = actions;
  return el;
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("<meditor-editor>", () => {
  it("mounts the editor shell on connect and unmounts on removal", async () => {
    const el = makeEl();
    await act(async () => {
      document.body.appendChild(el);
    });
    expect(el.querySelector("header")).toBeTruthy();
    expect(el.textContent).toContain("/home");

    await act(async () => {
      el.remove();
    });
    expect(el.childNodes.length).toBe(0);
  });

  it("re-renders when a property changes after connect", async () => {
    const el = makeEl();
    await act(async () => {
      document.body.appendChild(el);
    });
    expect(el.textContent).toContain("/home");

    await act(async () => {
      el.slug = "about";
      await Promise.resolve(); // flush the batched microtask render
    });
    expect(el.textContent).toContain("/about");
  });
});
