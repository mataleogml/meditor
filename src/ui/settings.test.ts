import { describe, expect, it } from "vitest";
import { seedFromSnapshot } from "./settings.element";
import type { SiteSettingsBootstrap, SiteSettingsRuntime } from "../settings";

const RT: SiteSettingsRuntime = { brand: { name: "" }, seo: {} };
const BS: SiteSettingsBootstrap = {
  adminRoute: "editor",
  locales: ["en"],
  defaultLocale: "en",
  routing: "prefix-except-default",
  onboarded: false,
};

describe("seedFromSnapshot", () => {
  it("takes every field the snapshot provides", () => {
    const { rt, bs } = seedFromSnapshot(
      { rt: RT, bs: BS },
      {
        brand: { name: "Dandelion" },
        seo: { description: "Cross-border payments" },
        theme: { preset: "fdn" },
        bootstrap: { ...BS, adminRoute: "admin", locales: ["en", "es"], onboarded: true },
      }
    );
    expect(rt).toEqual({
      brand: { name: "Dandelion" },
      seo: { description: "Cross-border payments" },
      theme: { preset: "fdn" },
    });
    expect(bs.adminRoute).toBe("admin");
    expect(bs.locales).toEqual(["en", "es"]);
  });

  // The regression: a host (or a smoke harness) whose snapshot omits `bootstrap`
  // must still get a usable form. This used to throw inside willUpdate, which
  // left `_seeded` false and painted the section blank with no visible cause.
  it("degrades to defaults when bootstrap — or the whole snapshot — is missing", () => {
    const partial = seedFromSnapshot({ rt: RT, bs: BS }, { brand: { name: "Dandelion" }, seo: {} });
    expect(partial.bs).toEqual(BS);
    expect(partial.rt.brand.name).toBe("Dandelion");

    expect(seedFromSnapshot({ rt: RT, bs: BS }, undefined)).toEqual({ rt: RT, bs: BS });
  });

  it("does not invent a theme key when the snapshot has none", () => {
    expect(seedFromSnapshot({ rt: RT, bs: BS }, { brand: { name: "x" }, seo: {} }).rt).not.toHaveProperty("theme");
  });
});
