import type { FieldDef, Slice } from "../types";

/**
 * Pure, framework-neutral slice-array operations extracted from
 * `EditorShell` (see editor-shell.tsx `mutate`/`reorder`/`add`/`duplicate`/
 * `remove`/`updateSelected`). No DOM, no Lit, no React — both the React shell
 * and the Lit rewrite route their slice edits through these.
 */

/** Result of a slice-array edit: the next array and the clamped selection. */
export type MutateResult = { slices: Slice[]; selected: number };

/** Clamp `selected` into `[0, slices.length - 1]` (0 for an empty array). */
export function clampSelected(slices: Slice[], selected: number): number {
  return Math.max(0, Math.min(selected, slices.length - 1));
}

/** The shared landing point every op below routes through: clamps selection. */
export function mutate(slices: Slice[], selected: number): MutateResult {
  return { slices, selected: clampSelected(slices, selected) };
}

/** Move the slice at `from` to index `to`. Returns `null` (no-op — caller
 *  leaves state untouched) when `to` is out of bounds. */
export function reorder(slices: Slice[], from: number, to: number): MutateResult | null {
  if (to < 0 || to >= slices.length) return null;
  const next = [...slices];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return mutate(next, to);
}

/** Append a new slice of `name`, seeded with its registered defaults. */
export function addSlice(
  slices: Slice[],
  name: string,
  defaults: Record<string, Record<string, unknown>>
): MutateResult {
  return mutate([...slices, { slice: name, ...(defaults[name] ?? {}) }], slices.length);
}

/** Duplicate the slice at `i`, inserting the copy right after it. */
export function duplicate(slices: Slice[], i: number): MutateResult {
  const next = [...slices];
  next.splice(i + 1, 0, { ...slices[i] });
  return mutate(next, i + 1);
}

/** Remove the slice at `i`, selecting the one before it (clamped). */
export function remove(slices: Slice[], i: number): MutateResult {
  return mutate(
    slices.filter((_, j) => j !== i),
    Math.max(0, i - 1)
  );
}

/** Replace the currently-selected slice with `next`. */
export function updateSelected(slices: Slice[], selected: number, next: Slice): MutateResult {
  return mutate(
    slices.map((s, j) => (j === selected ? next : s)),
    selected
  );
}

/**
 * Map an inline on-canvas text edit back to the slice field it came from, by
 * comparing plain text (ignoring `**markdown**` markers) — ported verbatim
 * from `editor-shell.tsx`'s preview-bridge `edit` message handler.
 *
 * Returns the slice array with the matching field updated, or `null` when no
 * field on that slice matches `before` (caller should leave state untouched).
 */
export function mapEditToField(
  slices: Slice[],
  index: number,
  before: string,
  after: string
): Slice[] | null {
  const trimmedBefore = before.trim();
  const s = { ...slices[index] };
  const key = Object.keys(s).find(
    (k) => k !== "slice" && typeof s[k] === "string" && String(s[k]).replaceAll("**", "").trim() === trimmedBefore
  );
  if (!key) return null;
  s[key] = after;
  const next = [...slices];
  next[index] = s;
  return next;
}

/** A string long enough (or multi-line) to warrant a `<textarea>` over a
 *  single-line input — ported verbatim from `field-form.tsx`. */
export function isMultiline(s: string): boolean {
  return s.length > 60 || s.includes("\n");
}

/** Which control renders a field: the schema hint wins, else infer from the
 *  value — ported verbatim from `field-form.tsx`'s `controlFor`. */
export function controlFor(def: FieldDef | undefined, value: unknown): NonNullable<FieldDef["type"]> {
  if (def?.type) return def.type;
  if (typeof value === "boolean") return "boolean";
  if (typeof value === "number") return "number";
  if (typeof value === "string") return isMultiline(value) ? "textarea" : "text";
  if (value === null || value === undefined) return "text";
  return "yaml"; // array | object
}

/** Human-readable byte count for media thumbnails — ported verbatim from
 *  `media-grid.tsx`. */
export function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(0)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}
