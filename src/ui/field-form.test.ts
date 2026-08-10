import { describe, expect, it } from "vitest";
import { MeditorFieldForm } from "./field-form.element";
import type { SliceSchema } from "../types";

/**
 * Mounts the real element (the only element-mounting test here so far) because
 * the bug it guards is invisible to a pure-function check: selectedness has to be
 * asserted against the live <select>. Binding `.value` on the <select> instead of
 * `.selected` on its options left every enum field sitting on the placeholder,
 * which then read back as empty and overwrote the stored value on the next save.
 */
const SCHEMA: SliceSchema = { align: { type: "select", options: ["left", "center", "right"] } };

async function mount(slice: Record<string, unknown>, schema: SliceSchema = SCHEMA) {
  const el = new MeditorFieldForm();
  el.slice = { slice: "Hero", ...slice };
  el.schema = schema;
  document.body.append(el);
  await el.updateComplete;
  return el;
}

describe("<meditor-field-form> select control", () => {
  it("preselects the option matching the current value", async () => {
    const el = await mount({ align: "center" });
    const select = el.shadowRoot!.querySelector("select")!;
    expect(select.value).toBe("center");
    expect(select.selectedIndex).toBe(2); // 0 is the "—" placeholder
    el.remove();
  });

  it("keeps an out-of-schema value instead of dropping to the placeholder", async () => {
    const el = await mount({ align: "justify" });
    const select = el.shadowRoot!.querySelector("select")!;
    expect(select.value).toBe("justify");
    expect([...select.options].at(-1)!.textContent).toContain("custom");
    el.remove();
  });

  it("sits on the placeholder only when the value really is unset", async () => {
    const el = await mount({});
    expect(el.shadowRoot!.querySelector("select")!.value).toBe("");
    el.remove();
  });
});
