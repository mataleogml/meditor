import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createMeditorApi } from "./routes";
import { createMeditorClient } from "./client";
import { createMarkdownAdapter } from "../markdown-adapter";
import type { AuthAdapter } from "../auth-adapter";
import type { CmsConfig } from "../types";

let dir: string;
let allow: boolean;

const BASE = "/api/meditor";
const openAuth = (): AuthAdapter => ({
  getUser: async () => ({ id: "test" }),
  authorize: async () => allow,
});

function makeConfig(): CmsConfig {
  return {
    registry: {},
    defaults: {},
    adapter: createMarkdownAdapter({ contentDir: dir, draftDir: path.join(dir, ".drafts") }),
    previewPath: "/editor/preview",
    auth: openAuth(),
  };
}

let api: ReturnType<typeof createMeditorApi>;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "meditor-api-"));
  fs.writeFileSync(path.join(dir, "home.md"), "---\ntitle: Home\nslices: []\n---\n");
  allow = true;
  api = createMeditorApi(makeConfig(), { basePath: BASE });
});

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

const req = (method: string, url: string, init: RequestInit = {}) =>
  new Request(`https://example.test${BASE}${url}`, { method, ...init });

const jsonReq = (method: string, url: string, payload: unknown) =>
  req(method, url, { body: JSON.stringify(payload), headers: { "content-type": "application/json" } });

describe("meditor HTTP API", () => {
  it("lists and reads pages", async () => {
    const list = await api.handler(req("GET", "/pages"));
    expect(list.status).toBe(200);
    expect((await list.json()).pages.map((p: { slug: string }) => p.slug)).toContain("home");

    const one = await api.handler(req("GET", "/pages/home"));
    expect(one.status).toBe(200);
    const body = await one.json();
    expect(body.page.meta.title).toBe("Home");
  });

  it("404s an unknown page and an unknown resource", async () => {
    expect((await api.handler(req("GET", "/pages/nope"))).status).toBe(404);
    expect((await api.handler(req("GET", "/nonsense"))).status).toBe(404);
  });

  it("saves a draft then publishes it", async () => {
    const saved = await api.handler(
      jsonReq("PUT", "/pages/home/draft", { page: { meta: { title: "Home" }, slices: [], body: "changed" } })
    );
    expect(saved.status).toBe(200);
    const { version } = await saved.json();
    expect(fs.existsSync(path.join(dir, ".drafts", "home.md"))).toBe(true);

    const published = await api.handler(jsonReq("POST", "/pages/home/publish", { baseVersion: version }));
    expect(published.status).toBe(200);
    expect(fs.readFileSync(path.join(dir, "home.md"), "utf8")).toContain("changed");
  });

  // Optimistic locking is a normal outcome, not an error: the status has to be
  // distinguishable (409) while the body stays the SaveResult the UI branches on.
  it("returns 409 with the SaveResult body on a version conflict", async () => {
    const stale = await api.handler(
      jsonReq("PUT", "/pages/home/draft", {
        page: { meta: { title: "Home" }, slices: [], body: "x" },
        baseVersion: "definitely-not-current",
      })
    );
    expect(stale.status).toBe(409);
    expect(await stale.json()).toMatchObject({ ok: false, code: "conflict" });
  });

  it("creates and deletes a page", async () => {
    const created = await api.handler(jsonReq("POST", "/pages", { title: "About Us" }));
    expect(created.status).toBe(201);
    expect((await created.json()).slug).toBe("about-us");

    expect((await api.handler(req("DELETE", "/pages/about-us"))).status).toBe(200);
    expect(fs.existsSync(path.join(dir, "about-us.md"))).toBe(false);
  });

  it("rejects a create with no title, and an unsupported method", async () => {
    expect((await api.handler(jsonReq("POST", "/pages", {}))).status).toBe(400);
    expect((await api.handler(req("PATCH", "/pages"))).status).toBe(405);
  });

  it("maps a denied authorize() to 403 on both reads and writes", async () => {
    allow = false;
    expect((await api.handler(req("GET", "/pages"))).status).toBe(403);
    const write = await api.handler(
      jsonReq("PUT", "/pages/home/draft", { page: { meta: {}, slices: [], body: "" } })
    );
    expect(write.status).toBe(403);
  });

  // Server Actions gave origin checking for free; an HTTP endpoint has to do it
  // or a cookie-authenticated editor is CSRF-able.
  it("refuses a cross-origin write but allows a cross-origin read", async () => {
    const write = await api.handler(
      req("PUT", "/pages/home/draft", { headers: { origin: "https://evil.test" }, body: "{}" })
    );
    expect(write.status).toBe(403);
    expect((await write.json()).error).toMatch(/cross-origin/i);

    const read = await api.handler(req("GET", "/pages", { headers: { origin: "https://evil.test" } }));
    expect(read.status).toBe(200);
  });

  it("allows a same-origin write and an explicitly allowed foreign origin", async () => {
    const same = await api.handler(
      jsonReq("PUT", "/pages/home/draft", { page: { meta: {}, slices: [], body: "ok" } })
    );
    expect(same.status).toBe(200);

    const split = createMeditorApi(makeConfig(), { basePath: BASE, allowedOrigins: ["https://studio.test"] });
    const allowed = await split.handler(
      new Request(`https://example.test${BASE}/pages/home/draft`, {
        method: "PUT",
        headers: { origin: "https://studio.test", "content-type": "application/json" },
        body: JSON.stringify({ page: { meta: {}, slices: [], body: "ok" } }),
      })
    );
    expect(allowed.status).toBe(200);
  });

  it("404s media when no adapter is configured", async () => {
    expect((await api.handler(req("GET", "/media"))).status).toBe(500); // listMedia throws: not configured
  });
});

describe("rename", () => {
  it("moves both the published file and any draft to the new slug", async () => {
    await api.handler(
      jsonReq("PUT", "/pages/home/draft", { page: { meta: { title: "Home" }, slices: [], body: "wip" } })
    );
    expect(fs.existsSync(path.join(dir, ".drafts", "home.md"))).toBe(true);

    const res = await api.handler(jsonReq("POST", "/pages/home/rename", { newSlug: "homepage" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, slug: "homepage" });

    expect(fs.existsSync(path.join(dir, "home.md"))).toBe(false);
    expect(fs.existsSync(path.join(dir, ".drafts", "home.md"))).toBe(false);
    expect(fs.existsSync(path.join(dir, "homepage.md"))).toBe(true);
    expect(fs.readFileSync(path.join(dir, ".drafts", "homepage.md"), "utf8")).toContain("wip");
  });

  // "Refuse rather than clobber": landing on a slug that already has content
  // must not silently overwrite it.
  it("refuses (409) a rename onto an existing slug rather than clobbering it", async () => {
    await api.handler(jsonReq("POST", "/pages", { title: "About" })); // -> about.md
    const res = await api.handler(jsonReq("POST", "/pages/home/rename", { newSlug: "about" }));
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ ok: false, code: "conflict" });
    // both sides untouched
    expect(fs.existsSync(path.join(dir, "home.md"))).toBe(true);
    expect(fs.existsSync(path.join(dir, "about.md"))).toBe(true);
  });

  it("is locale-aware: moves the published file and draft for every locale the page occupies", async () => {
    const esDir = path.join(dir, "es");
    fs.mkdirSync(path.join(esDir, ".drafts"), { recursive: true });
    fs.writeFileSync(path.join(esDir, "home.md"), "---\ntitle: Casa\nslices: []\n---\n");
    fs.writeFileSync(path.join(esDir, ".drafts", "home.md"), "---\ntitle: Casa borrador\nslices: []\n---\n");

    const i18nApi = createMeditorApi(
      { ...makeConfig(), adapter: createMarkdownAdapter({ contentDir: dir, locales: ["en", "es"], defaultLocale: "en" }) },
      { basePath: BASE }
    );

    const res = await i18nApi.handler(jsonReq("POST", "/pages/home/rename", { newSlug: "homepage" }));
    expect(res.status).toBe(200);

    expect(fs.existsSync(path.join(dir, "home.md"))).toBe(false);
    expect(fs.existsSync(path.join(dir, "homepage.md"))).toBe(true);
    expect(fs.existsSync(path.join(esDir, "home.md"))).toBe(false);
    expect(fs.existsSync(path.join(esDir, "homepage.md"))).toBe(true);
    expect(fs.existsSync(path.join(esDir, ".drafts", "home.md"))).toBe(false);
    expect(fs.existsSync(path.join(esDir, ".drafts", "homepage.md"))).toBe(true);
  });

  it("gates rename behind authorize()", async () => {
    allow = false;
    const res = await api.handler(jsonReq("POST", "/pages/home/rename", { newSlug: "homepage" }));
    expect(res.status).toBe(403);
    expect(fs.existsSync(path.join(dir, "home.md"))).toBe(true); // untouched
  });
});

describe("duplicate", () => {
  it("copies to a non-colliding slug derived from the source", async () => {
    await api.handler(jsonReq("POST", "/pages", { title: "About" })); // -> about.md
    const res = await api.handler(req("POST", "/pages/about/duplicate"));
    expect(res.status).toBe(201);
    const { slug } = await res.json();
    expect(slug).toBe("about-copy");
    expect(fs.existsSync(path.join(dir, "about-copy.md"))).toBe(true);
  });

  it("duplicating twice produces two distinct slugs", async () => {
    await api.handler(jsonReq("POST", "/pages", { title: "About" }));
    const first = await (await api.handler(req("POST", "/pages/about/duplicate"))).json();
    const second = await (await api.handler(req("POST", "/pages/about/duplicate"))).json();
    expect(first.slug).toBe("about-copy");
    expect(second.slug).toBe("about-copy-2");
    expect(first.slug).not.toBe(second.slug);
  });

  it("gates duplicate behind authorize()", async () => {
    await api.handler(jsonReq("POST", "/pages", { title: "About" }));
    allow = false;
    const res = await api.handler(req("POST", "/pages/about/duplicate"));
    expect(res.status).toBe(403);
  });
});

describe("createMeditorClient over the handler", () => {
  /** Wires the client straight to the handler — no network, but the full
   *  serialize → route → deserialize path, which is what would actually break. */
  const clientFor = (a: ReturnType<typeof createMeditorApi>) =>
    createMeditorClient({
      baseUrl: `https://example.test${BASE}`,
      fetch: ((input: RequestInfo | URL, init?: RequestInit) =>
        a.handler(new Request(input as string, init))) as typeof globalThis.fetch,
    });

  it("round-trips a draft save through the same object shape the UI uses", async () => {
    const client = clientFor(api);
    const pages = await client.listPages();
    expect(pages.map((p) => p.slug)).toContain("home");

    const result = await client.saveDraft("home", { meta: { title: "Home" }, slices: [], body: "via client" });
    expect(result.ok).toBe(true);

    const { page, hasDraft } = await client.getPage("home");
    expect(hasDraft).toBe(true);
    expect(page.body).toContain("via client");
  });

  it("surfaces a conflict as a SaveResult rather than throwing", async () => {
    const client = clientFor(api);
    const result = await client.saveDraft(
      "home",
      { meta: {}, slices: [], body: "x" },
      "stale-version"
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("conflict");
  });

  it("throws MeditorApiError with the status when the server refuses", async () => {
    allow = false;
    const client = clientFor(api);
    await expect(client.listPages()).rejects.toMatchObject({ name: "MeditorApiError", status: 403 });
  });

  it("creates a page and returns the normalized slug", async () => {
    const client = clientFor(api);
    expect(await client.createPage("Hello World")).toBe("hello-world");
  });
});
