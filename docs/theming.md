# Theming

The editor's own chrome (shell, nav, forms, dialogs — not your site's
slices, which render as-is in the preview) is styled with a small,
fixed set of CSS variables, defined in `meditor/theme.css`:

```css
:root {
  --scms-bg: var(--background, #ffffff);
  --scms-fg: var(--foreground, #18181b);
  --scms-muted: var(--muted, #f4f4f5);
  --scms-muted-fg: var(--muted-foreground, #71717a);
  --scms-border: var(--border, #e4e4e7);
  --scms-primary: var(--primary, #2563eb);
  --scms-primary-fg: var(--primary-foreground, #ffffff);
  --scms-ring: var(--ring, #3b82f6);
  --scms-destructive: var(--destructive, #dc2626);
}

.dark {
  color-scheme: dark;
  --scms-bg: #09090b;
  --scms-fg: #fafafa;
  --scms-muted: #27272a;
  --scms-muted-fg: #a1a1aa;
  --scms-border: #27272a;
  --scms-primary: var(--primary, #3b82f6);
  --scms-primary-fg: var(--primary-foreground, #ffffff);
  --scms-ring: var(--ring, #3b82f6);
  --scms-destructive: #ef4444;
}
```

Import it once, anywhere global CSS is loaded:

```css
@import "meditor/theme.css";
```

## Three ways this resolves

1. **You already run shadcn/ui.** Every `--scms-*` variable falls back to
   the matching standard shadcn token (`--background`, `--foreground`,
   `--muted`, `--border`, `--primary`, `--ring`, `--destructive`, …) via
   CSS `var(--x, fallback)`. Nothing to configure — the editor already
   matches your brand.
2. **A different design system.** Override the nine `--scms-*` variables
   directly (in `:root` and `.dark`, after importing `theme.css` so your
   rules win):
   ```css
   :root {
     --scms-primary: var(--brand-600);
     --scms-primary-fg: var(--brand-on-600);
   }
   ```
3. **No design tokens at all.** The hard-coded neutral defaults
   (`#2563eb` primary, zinc neutrals) keep the editor perfectly usable
   out of the box.

## Dark mode

`.dark` is scoped to the editor's own root element (`EditorShell` toggles a
`dark` class on its outermost `<div>`, independent of your site's own theme
class) — so the editor can run in dark mode while previewing a light-themed
site, or vice versa. State persists to `localStorage` under
`meditor-theme`. The **device preview** frame has its own, separate
light/dark toggle (`DevicePreview`) that `postMessage`s a `{ type: "theme" }`
event into the iframe — `PreviewBridge` picks it up and toggles `.dark` on
the previewed document, independent of the editor chrome's own theme.

## What this does *not* theme

Your slices render in the preview iframe using your site's actual CSS —
meditor has no opinion on it. The nine `--scms-*` variables only affect the
editor's own UI (nav, forms, buttons, dialogs, the block outline).
