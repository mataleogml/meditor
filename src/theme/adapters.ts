/**
 * ThemeAdapter: white-labels the `--scms-*` shadow-DOM token contract onto a
 * host's own design tokens. Descriptor consumed by `meditor init` (spec §4) —
 * detect() sniffs the host's global CSS text, emitThemeMapping() serializes
 * the preset's :root{}/.dark{} block that gets printed/appended.
 */

export type ScmsVar = "bg" | "fg" | "muted" | "muted-fg" | "border" | "primary" | "primary-fg" | "ring" | "destructive";

export interface ThemeAdapter {
  /** Preset id. */
  readonly name: "shadcn" | "fdn" | "atlas" | "neutral";
  /** Heuristic over the host's concatenated global CSS text. */
  detect(css: string): boolean;
  /** --scms-* → host-token mapping. Values are CSS `var(--host-token, fallback)`
   *  refs (no color is copied), emitted as a :root{} block. */
  readonly light: Record<ScmsVar, string>;
  /** Extra rules the editor's independent `.dark` needs (often just color-scheme). */
  readonly dark: Record<ScmsVar, string> | { colorSchemeOnly: true };
}

const ORDER: ScmsVar[] = ["bg", "fg", "muted", "muted-fg", "border", "primary", "primary-fg", "ring", "destructive"];

const shadcn: ThemeAdapter = {
  name: "shadcn",
  detect: (css) => css.includes("shadcn/tailwind.css") || (css.includes("--background") && css.includes("--primary")),
  light: {
    bg: "var(--background,#ffffff)",
    fg: "var(--foreground,#18181b)",
    muted: "var(--muted,#f4f4f5)",
    "muted-fg": "var(--muted-foreground,#71717a)",
    border: "var(--border,#e4e4e7)",
    primary: "var(--primary,#2563eb)",
    "primary-fg": "var(--primary-foreground,#ffffff)",
    ring: "var(--ring,#3b82f6)",
    destructive: "var(--destructive,#dc2626)",
  },
  dark: {
    bg: "#09090b",
    fg: "#fafafa",
    muted: "#27272a",
    "muted-fg": "#a1a1aa",
    border: "#27272a",
    primary: "var(--primary,#3b82f6)",
    "primary-fg": "var(--primary-foreground,#ffffff)",
    ring: "var(--ring,#3b82f6)",
    destructive: "#ef4444",
  },
};

const fdn: ThemeAdapter = {
  name: "fdn",
  detect: (css) => css.includes("--ddl-") || (css.includes("--surface-base") && css.includes("light-dark(")),
  light: {
    bg: "var(--surface-base,#ffffff)",
    fg: "var(--content-base,#333333)",
    muted: "var(--surface-level-01,#fafafa)",
    "muted-fg": "var(--content-secondary,#626a81)",
    border: "var(--stroke-base,#e7e7e7)",
    primary: "var(--surface-brand,#001133)",
    "primary-fg": "var(--content-on-brand,#ffffff)",
    ring: "var(--ring,#ff6100)",
    destructive: "var(--content-error,#d64545)",
  },
  dark: { colorSchemeOnly: true },
};

const atlas: ThemeAdapter = {
  name: "atlas",
  detect: (css) => css.includes("--atlas-color-") || css.includes("--atlas-surface-base"),
  light: {
    bg: "var(--atlas-surface-base,#ffffff)",
    fg: "var(--atlas-content-base,#09090a)",
    muted: "var(--atlas-surface-level-01,#f6f7f9)",
    "muted-fg": "var(--atlas-content-secondary,#6c6d70)",
    border: "var(--atlas-stroke-base,#e2e4e7)",
    primary: "var(--atlas-surface-brand,#0533ff)",
    "primary-fg": "var(--atlas-content-on-brand,#f7faff)",
    ring: "var(--atlas-stroke-focus,#4f83ff)",
    destructive: "var(--atlas-surface-danger,#d60009)",
  },
  dark: { colorSchemeOnly: true },
};

const neutral: ThemeAdapter = {
  ...shadcn,
  name: "neutral",
  detect: () => true,
};

/** atlas → fdn → shadcn → neutral (most-specific heuristic first; neutral always matches). */
const PRESETS: ThemeAdapter[] = [atlas, fdn, shadcn, neutral];

/** First matching preset wins. Always resolves (`neutral` matches anything). */
export function detectTheme(css: string): ThemeAdapter {
  return PRESETS.find((p) => p.detect(css))!;
}

/** Serialize a preset to the `:root{}` + `.dark{}` CSS block. */
export function emitThemeMapping(a: ThemeAdapter): string {
  const root = ORDER.map((k) => `  --scms-${k}: ${a.light[k]};`).join("\n");
  const dark =
    "colorSchemeOnly" in a.dark
      ? "  color-scheme: dark;"
      : "  color-scheme: dark;\n" + ORDER.map((k) => `  --scms-${k}: ${(a.dark as Record<ScmsVar, string>)[k]};`).join("\n");
  return `:root {\n${root}\n}\n.dark {\n${dark}\n}`;
}
