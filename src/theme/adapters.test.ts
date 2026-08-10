import { describe, it, expect } from "vitest";
import { detectTheme, emitThemeMapping } from "./adapters";

describe("detectTheme", () => {
  it("detects atlas via --atlas-surface-base", () => {
    expect(detectTheme(":root{--atlas-surface-base:#fff}").name).toBe("atlas");
  });

  it("detects atlas via --atlas-color-", () => {
    expect(detectTheme(".x{--atlas-color-brand:#0533ff}").name).toBe("atlas");
  });

  it("detects fdn via --ddl-", () => {
    expect(detectTheme(":root{--ddl-surface-base:#fff}").name).toBe("fdn");
  });

  it("detects fdn via --surface-base + light-dark(", () => {
    expect(detectTheme(":root{--surface-base:light-dark(#fff,#000)}").name).toBe("fdn");
  });

  it("does not detect fdn from --surface-base alone (needs light-dark too)", () => {
    expect(detectTheme(":root{--surface-base:#fff}").name).toBe("neutral");
  });

  it("detects shadcn via shadcn/tailwind.css comment/import", () => {
    expect(detectTheme("/* shadcn/tailwind.css */").name).toBe("shadcn");
  });

  it("detects shadcn via --background + --primary", () => {
    expect(detectTheme(":root{--background:#fff;--primary:#2563eb}").name).toBe("shadcn");
  });

  it("falls back to neutral when nothing matches", () => {
    expect(detectTheme(".foo{color:red}").name).toBe("neutral");
  });

  it("prefers atlas over fdn/shadcn when multiple heuristics match", () => {
    const css = "--atlas-surface-base:#fff;--surface-base:light-dark(#fff,#000);--background:#fff;--primary:#000";
    expect(detectTheme(css).name).toBe("atlas");
  });

  it("prefers fdn over shadcn when both match", () => {
    const css = "--ddl-x:1;--background:#fff;--primary:#000";
    expect(detectTheme(css).name).toBe("fdn");
  });
});

describe("emitThemeMapping", () => {
  it("emits the shadcn block with hard-coded neutral dark values", () => {
    const block = emitThemeMapping(detectTheme(":root{--background:#fff;--primary:#2563eb}"));
    expect(block).toBe(`:root {
  --scms-bg: var(--background,#ffffff);
  --scms-fg: var(--foreground,#18181b);
  --scms-muted: var(--muted,#f4f4f5);
  --scms-muted-fg: var(--muted-foreground,#71717a);
  --scms-border: var(--border,#e4e4e7);
  --scms-primary: var(--primary,#2563eb);
  --scms-primary-fg: var(--primary-foreground,#ffffff);
  --scms-ring: var(--ring,#3b82f6);
  --scms-destructive: var(--destructive,#dc2626);
}
.dark {
  color-scheme: dark;
  --scms-bg: #09090b;
  --scms-fg: #fafafa;
  --scms-muted: #27272a;
  --scms-muted-fg: #a1a1aa;
  --scms-border: #27272a;
  --scms-primary: var(--primary,#3b82f6);
  --scms-primary-fg: var(--primary-foreground,#ffffff);
  --scms-ring: var(--ring,#3b82f6);
  --scms-destructive: #ef4444;
}`);
  });

  it("emits the fdn block with color-scheme-only dark (light-dark tokens self-flip)", () => {
    const block = emitThemeMapping(detectTheme(":root{--ddl-x:1}"));
    expect(block).toBe(`:root {
  --scms-bg: var(--surface-base,#ffffff);
  --scms-fg: var(--content-base,#333333);
  --scms-muted: var(--surface-level-01,#fafafa);
  --scms-muted-fg: var(--content-secondary,#626a81);
  --scms-border: var(--stroke-base,#e7e7e7);
  --scms-primary: var(--surface-brand,#001133);
  --scms-primary-fg: var(--content-on-brand,#ffffff);
  --scms-ring: var(--ring,#ff6100);
  --scms-destructive: var(--content-error,#d64545);
}
.dark {
  color-scheme: dark;
}`);
  });

  it("emits the atlas block with color-scheme-only dark (host's .dark redefines --atlas-*)", () => {
    const block = emitThemeMapping(detectTheme(":root{--atlas-surface-base:#fff}"));
    expect(block).toBe(`:root {
  --scms-bg: var(--atlas-surface-base,#ffffff);
  --scms-fg: var(--atlas-content-base,#09090a);
  --scms-muted: var(--atlas-surface-level-01,#f6f7f9);
  --scms-muted-fg: var(--atlas-content-secondary,#6c6d70);
  --scms-border: var(--atlas-stroke-base,#e2e4e7);
  --scms-primary: var(--atlas-surface-brand,#0533ff);
  --scms-primary-fg: var(--atlas-content-on-brand,#f7faff);
  --scms-ring: var(--atlas-stroke-focus,#4f83ff);
  --scms-destructive: var(--atlas-surface-danger,#d60009);
}
.dark {
  color-scheme: dark;
}`);
  });
});
