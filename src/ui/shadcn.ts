import { css } from "lit";

/**
 * shadcn/ui, ported to plain Shadow-DOM CSS.
 *
 * Every rule below is a direct translation of the class strings in shadcn's own
 * registry (`new-york-v4`, fetched from ui.shadcn.com/r) — same geometry, same
 * variants, same states, same elevation. Class names mirror shadcn's `data-slot`
 * names (`.card-header`, `.sidebar-menu-button`, …) so a reader can map any rule
 * back to the component it came from.
 *
 * Why a port instead of the real thing: shadcn ships React + Radix + Tailwind.
 * The editor is Web Components with no framework, so it can mount inside any
 * host (Next, Nuxt, Astro, plain HTML). The port keeps shadcn's design contract
 * while dropping its runtime.
 *
 * What is deliberately NOT ported: Radix's floating layers (Select/Dropdown/
 * Tooltip popovers), which need a positioning engine and focus management. Where
 * the editor needs one it uses the platform equivalent — a native `<select>`
 * styled as SelectTrigger, a native `<dialog>` styled as DialogContent — so
 * behaviour comes from the browser and only the look is ours.
 *
 * Values resolve through `--scms-*` (theme.css), which maps to the host's own
 * shadcn tokens. Each read has a fallback chain, so a host on an older/partial
 * token set degrades instead of collapsing to `initial`.
 */
export const shadcnStyles = css`
  :host {
    /* ---- token aliases + shadcn's derived radius scale ------------------- */
    --_radius: var(--scms-radius, 0.625rem);
    --_radius-sm: calc(var(--_radius) - 4px);
    --_radius-md: calc(var(--_radius) - 2px);
    --_radius-lg: var(--_radius);
    --_radius-xl: calc(var(--_radius) + 4px);

    --_bg: var(--scms-bg, oklch(1 0 0));
    --_fg: var(--scms-fg, oklch(0.145 0 0));
    --_card: var(--scms-card, var(--scms-bg, oklch(1 0 0)));
    --_card-fg: var(--scms-card-fg, var(--scms-fg, oklch(0.145 0 0)));
    --_popover: var(--scms-popover, var(--scms-bg, oklch(1 0 0)));
    --_popover-fg: var(--scms-popover-fg, var(--scms-fg, oklch(0.145 0 0)));
    --_primary: var(--scms-primary, oklch(0.205 0 0));
    --_primary-fg: var(--scms-primary-fg, oklch(0.985 0 0));
    --_secondary: var(--scms-secondary, var(--scms-muted, oklch(0.97 0 0)));
    --_secondary-fg: var(--scms-secondary-fg, var(--scms-fg, oklch(0.205 0 0)));
    --_muted: var(--scms-muted, oklch(0.97 0 0));
    --_muted-fg: var(--scms-muted-fg, oklch(0.556 0 0));
    --_accent: var(--scms-accent, var(--scms-muted, oklch(0.97 0 0)));
    --_accent-fg: var(--scms-accent-fg, var(--scms-fg, oklch(0.205 0 0)));
    --_destructive: var(--scms-destructive, oklch(0.577 0.245 27.325));
    --_border: var(--scms-border, oklch(0.922 0 0));
    --_input: var(--scms-input, var(--scms-border, oklch(0.922 0 0)));
    --_ring: var(--scms-ring, oklch(0.708 0 0));

    --_sidebar: var(--scms-sidebar, oklch(0.985 0 0));
    --_sidebar-fg: var(--scms-sidebar-fg, var(--scms-fg, oklch(0.145 0 0)));
    --_sidebar-accent: var(--scms-sidebar-accent, oklch(0.97 0 0));
    --_sidebar-accent-fg: var(--scms-sidebar-accent-fg, oklch(0.205 0 0));
    --_sidebar-border: var(--scms-sidebar-border, var(--scms-border, oklch(0.922 0 0)));

    /* Tailwind's shadow steps, verbatim. */
    --_shadow-xs: 0 1px 2px 0 rgb(0 0 0 / 0.05);
    --_shadow-sm: 0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1);
    --_shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
    --_shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);
  }

  /* ======================================================== Button ======== */
  .btn {
    display: inline-flex;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    height: 2.25rem;
    padding: 0.5rem 1rem;
    border: 1px solid transparent;
    border-radius: var(--_radius-md);
    background: transparent;
    font: inherit;
    font-size: 0.875rem;
    line-height: 1.25rem;
    font-weight: 500;
    white-space: nowrap;
    cursor: pointer;
    outline: none;
    transition: all 0.15s;
  }
  .btn:focus-visible {
    border-color: var(--_ring);
    box-shadow: 0 0 0 3px color-mix(in oklab, var(--_ring) 50%, transparent);
  }
  .btn:disabled {
    pointer-events: none;
    opacity: 0.5;
  }
  /* [&_svg:not([class*='size-'])]:size-4 — an icon may still opt out via a
     size- class of its own, which is why this isn't svg { width: 1rem }. */
  .btn svg:not([class*="size-"]) {
    width: 1rem;
    height: 1rem;
  }
  .btn svg {
    flex-shrink: 0;
    pointer-events: none;
  }

  .btn--default {
    background: var(--_primary);
    color: var(--_primary-fg);
  }
  .btn--default:hover {
    background: color-mix(in oklab, var(--_primary) 90%, transparent);
  }
  .btn--destructive {
    background: var(--_destructive);
    color: #fff;
  }
  .btn--destructive:hover {
    background: color-mix(in oklab, var(--_destructive) 90%, transparent);
  }
  .btn--destructive:focus-visible {
    box-shadow: 0 0 0 3px color-mix(in oklab, var(--_destructive) 20%, transparent);
  }
  /* outline is the only variant shadcn gives a shadow. */
  .btn--outline {
    border-color: var(--_border);
    background: var(--_bg);
    color: var(--_fg);
    box-shadow: var(--_shadow-xs);
  }
  .btn--outline:hover {
    background: var(--_accent);
    color: var(--_accent-fg);
  }
  :host(.dark) .btn--outline {
    border-color: var(--_input);
    background: color-mix(in oklab, var(--_input) 30%, transparent);
  }
  :host(.dark) .btn--outline:hover {
    background: color-mix(in oklab, var(--_input) 50%, transparent);
  }
  .btn--secondary {
    background: var(--_secondary);
    color: var(--_secondary-fg);
  }
  .btn--secondary:hover {
    background: color-mix(in oklab, var(--_secondary) 80%, transparent);
  }
  .btn--ghost {
    color: var(--_fg);
  }
  .btn--ghost:hover {
    background: var(--_accent);
    color: var(--_accent-fg);
  }
  :host(.dark) .btn--ghost:hover {
    background: color-mix(in oklab, var(--_accent) 50%, transparent);
  }
  .btn--link {
    color: var(--_primary);
    text-underline-offset: 4px;
  }
  .btn--link:hover {
    text-decoration: underline;
  }
  /* Not in shadcn: destructive INTENT on an icon-only affordance (delete a
     block, delete an asset), where a solid red slab would dominate the row. */
  .btn--ghost-destructive {
    color: var(--_destructive);
  }
  .btn--ghost-destructive:hover {
    background: color-mix(in oklab, var(--_destructive) 10%, transparent);
  }

  .btn--xs {
    height: 1.5rem;
    gap: 0.25rem;
    padding: 0 0.5rem;
    font-size: 0.75rem;
  }
  .btn--xs svg:not([class*="size-"]) {
    width: 0.75rem;
    height: 0.75rem;
  }
  .btn--sm {
    height: 2rem;
    gap: 0.375rem;
    padding: 0 0.75rem;
  }
  .btn--lg {
    height: 2.5rem;
    padding: 0 1.5rem;
  }
  .btn--icon {
    width: 2.25rem;
    height: 2.25rem;
    padding: 0;
  }
  .btn--icon.btn--sm {
    width: 2rem;
    height: 2rem;
  }
  .btn--icon.btn--xs {
    width: 1.5rem;
    height: 1.5rem;
  }

  /* ================================================ Input / Textarea ====== */
  .input,
  .textarea {
    display: flex;
    width: 100%;
    min-width: 0;
    border: 1px solid var(--_input);
    border-radius: var(--_radius-md);
    background: transparent;
    color: var(--_fg);
    font: inherit;
    font-size: 0.875rem;
    line-height: 1.25rem;
    box-shadow: var(--_shadow-xs);
    outline: none;
    transition:
      color 0.15s,
      box-shadow 0.15s,
      border-color 0.15s;
  }
  .input {
    height: 2.25rem;
    padding: 0.25rem 0.75rem;
  }
  .textarea {
    min-height: 4rem;
    padding: 0.5rem 0.75rem;
    /* shadcn v4's field-sizing-content: the box grows with its value. */
    field-sizing: content;
  }
  :host(.dark) .input,
  :host(.dark) .textarea {
    background: color-mix(in oklab, var(--_input) 30%, transparent);
  }
  .input::placeholder,
  .textarea::placeholder {
    color: var(--_muted-fg);
  }
  .input::selection,
  .textarea::selection {
    background: var(--_primary);
    color: var(--_primary-fg);
  }
  .input:focus-visible,
  .textarea:focus-visible {
    border-color: var(--_ring);
    box-shadow: 0 0 0 3px color-mix(in oklab, var(--_ring) 50%, transparent);
  }
  .input[aria-invalid="true"],
  .textarea[aria-invalid="true"] {
    border-color: var(--_destructive);
  }
  .input[aria-invalid="true"]:focus-visible,
  .textarea[aria-invalid="true"]:focus-visible {
    box-shadow: 0 0 0 3px color-mix(in oklab, var(--_destructive) 20%, transparent);
  }
  .input:disabled,
  .textarea:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }

  /* ========================================================= Label ======== */
  /* No margin of its own — shadcn spaces a field with the wrapper's grid
     gap-2, which .field below provides. */
  .label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
    line-height: 1;
    font-weight: 500;
    color: var(--_fg);
    user-select: none;
  }
  /* shadcn's form-field wrapper idiom (grid gap-2). */
  .field {
    display: grid;
    gap: 0.5rem;
  }

  /* ======================================================== Select ======== */
  /* SelectTrigger's look on a native <select>: the listbox stays the platform's
     own, so keyboard + mobile behaviour is the browser's, not ours.
     ponytail: the chevron is a data-URI, so it can't read --scms-muted-fg; it's
     the neutral mid-grey that token defaults to. Upgrade path: a wrapper with a
     masked chevron if a host ever themes far enough for it to look wrong. */
  .select {
    appearance: none;
    -webkit-appearance: none;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    width: 100%;
    height: 2.25rem;
    padding: 0.5rem 2rem 0.5rem 0.75rem;
    border: 1px solid var(--_input);
    border-radius: var(--_radius-md);
    background-color: transparent;
    color: var(--_fg);
    font: inherit;
    font-size: 0.875rem;
    line-height: 1.25rem;
    white-space: nowrap;
    box-shadow: var(--_shadow-xs);
    outline: none;
    transition:
      color 0.15s,
      box-shadow 0.15s,
      border-color 0.15s;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%23737373' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 0.625rem center;
    background-size: 1rem;
  }
  .select--sm {
    height: 2rem;
  }
  :host(.dark) .select {
    background-color: color-mix(in oklab, var(--_input) 30%, transparent);
  }
  .select:focus-visible {
    border-color: var(--_ring);
    box-shadow: 0 0 0 3px color-mix(in oklab, var(--_ring) 50%, transparent);
  }
  .select:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }

  /* ========================================================= Badge ======== */
  .badge {
    display: inline-flex;
    width: fit-content;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    gap: 0.25rem;
    overflow: hidden;
    padding: 0.125rem 0.5rem;
    border: 1px solid transparent;
    border-radius: 9999px;
    font-size: 0.75rem;
    line-height: 1rem;
    font-weight: 500;
    white-space: nowrap;
  }
  .badge svg {
    width: 0.75rem;
    height: 0.75rem;
    pointer-events: none;
  }
  .badge--default {
    background: var(--_primary);
    color: var(--_primary-fg);
  }
  .badge--secondary {
    background: var(--_secondary);
    color: var(--_secondary-fg);
  }
  .badge--destructive {
    background: var(--_destructive);
    color: #fff;
  }
  .badge--outline {
    border-color: var(--_border);
    color: var(--_fg);
  }

  /* ========================================================== Card ======== */
  .card {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    padding: 1.5rem 0;
    border: 1px solid var(--_border);
    border-radius: var(--_radius-xl);
    background: var(--_card);
    color: var(--_card-fg);
    box-shadow: var(--_shadow-sm);
  }
  /* The shell's panels fill their card edge to edge, so they opt out of the
     content padding/gap above while keeping the surface. */
  .card--flush {
    gap: 0;
    padding: 0;
    overflow: hidden;
  }
  .card-header {
    display: grid;
    align-items: start;
    gap: 0.5rem;
    padding: 0 1.5rem;
  }
  .card-title {
    font-weight: 600;
    line-height: 1;
  }
  .card-description {
    font-size: 0.875rem;
    color: var(--_muted-fg);
  }
  .card-content {
    padding: 0 1.5rem;
  }
  .card-footer {
    display: flex;
    align-items: center;
    padding: 0 1.5rem;
  }

  /* ===================================================== Separator ======== */
  .separator {
    flex-shrink: 0;
    border: none;
    margin: 0;
    background: var(--_border);
  }
  .separator[data-orientation="vertical"] {
    width: 1px;
    height: 100%;
  }
  .separator:not([data-orientation="vertical"]) {
    width: 100%;
    height: 1px;
  }

  /* ==================================================== ScrollArea ======== */
  /* Radix draws its own thumb; native thin scrollbars are the cross-platform
     equivalent and cost no JS. */
  .scroll-area {
    overflow: auto;
    scrollbar-color: var(--_border) transparent;
    scrollbar-width: thin;
  }
  .scroll-area::-webkit-scrollbar {
    width: 0.5rem;
    height: 0.5rem;
  }
  .scroll-area::-webkit-scrollbar-thumb {
    border-radius: 9999px;
    background: var(--_border);
  }
  .scroll-area::-webkit-scrollbar-thumb:hover {
    background: var(--_muted-fg);
  }

  /* ======================================================= Sidebar ======== */
  .sidebar {
    display: flex;
    height: 100%;
    width: var(--scms-sidebar-width, 16rem);
    flex-direction: column;
    background: var(--_sidebar);
    color: var(--_sidebar-fg);
  }
  .sidebar-header,
  .sidebar-footer {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 0.5rem;
  }
  .sidebar-content {
    display: flex;
    min-height: 0;
    flex: 1 1 auto;
    flex-direction: column;
    gap: 0.5rem;
    overflow: auto;
  }
  .sidebar-group {
    position: relative;
    display: flex;
    width: 100%;
    min-width: 0;
    flex-direction: column;
    padding: 0.5rem;
  }
  .sidebar-group-label {
    display: flex;
    height: 2rem;
    flex-shrink: 0;
    align-items: center;
    padding: 0 0.5rem;
    border-radius: var(--_radius-md);
    font-size: 0.75rem;
    font-weight: 500;
    color: color-mix(in oklab, var(--_sidebar-fg) 70%, transparent);
  }
  .sidebar-menu {
    display: flex;
    width: 100%;
    min-width: 0;
    flex-direction: column;
    gap: 0.25rem;
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .sidebar-menu-item {
    position: relative;
  }
  .sidebar-menu-button {
    display: flex;
    width: 100%;
    height: 2rem;
    align-items: center;
    gap: 0.5rem;
    overflow: hidden;
    padding: 0.5rem;
    border: none;
    border-radius: var(--_radius-md);
    background: transparent;
    color: inherit;
    font: inherit;
    font-size: 0.875rem;
    text-align: left;
    text-decoration: none;
    cursor: pointer;
    outline: none;
    transition:
      width 0.15s,
      height 0.15s,
      padding 0.15s;
  }
  .sidebar-menu-button:hover,
  .sidebar-menu-button:active {
    background: var(--_sidebar-accent);
    color: var(--_sidebar-accent-fg);
  }
  .sidebar-menu-button:focus-visible {
    box-shadow: 0 0 0 2px var(--scms-sidebar-ring, var(--_ring));
  }
  .sidebar-menu-button[data-active="true"] {
    background: var(--_sidebar-accent);
    color: var(--_sidebar-accent-fg);
    font-weight: 500;
  }
  .sidebar-menu-button > span:last-child {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .sidebar-menu-button > svg {
    width: 1rem;
    height: 1rem;
    flex-shrink: 0;
  }
  .sidebar-menu-button--lg {
    height: 3rem;
    font-size: 0.875rem;
  }
  .sidebar-menu-badge {
    display: flex;
    height: 1.25rem;
    min-width: 1.25rem;
    align-items: center;
    justify-content: center;
    padding: 0 0.25rem;
    border-radius: var(--_radius-md);
    font-size: 0.75rem;
    font-weight: 500;
    font-variant-numeric: tabular-nums;
    color: var(--_sidebar-fg);
    pointer-events: none;
    user-select: none;
  }
  /* SidebarMenuSub: the indented tree, hung off a left rule. */
  .sidebar-menu-sub {
    display: flex;
    min-width: 0;
    flex-direction: column;
    gap: 0.25rem;
    margin: 0 0.875rem;
    padding: 0.125rem 0.625rem;
    border-left: 1px solid var(--_sidebar-border);
    list-style: none;
    transform: translateX(1px);
  }
  .sidebar-menu-sub-button {
    display: flex;
    height: 1.75rem;
    min-width: 0;
    align-items: center;
    gap: 0.5rem;
    overflow: hidden;
    padding: 0 0.5rem;
    border-radius: var(--_radius-md);
    color: var(--_sidebar-fg);
    font-size: 0.875rem;
    text-decoration: none;
    outline: none;
    transform: translateX(-1px);
  }
  .sidebar-menu-sub-button:hover,
  .sidebar-menu-sub-button:active {
    background: var(--_sidebar-accent);
    color: var(--_sidebar-accent-fg);
  }
  .sidebar-menu-sub-button[data-active="true"] {
    background: var(--_sidebar-accent);
    color: var(--_sidebar-accent-fg);
    font-weight: 500;
  }
  .sidebar-menu-sub-button > span:last-child {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  /* SidebarInset (variant="inset"): the content sits on the sidebar-coloured
     frame as a raised, rounded surface — m-2 ml-0 rounded-xl shadow-sm. */
  .sidebar-inset {
    position: relative;
    display: flex;
    min-width: 0;
    flex: 1 1 auto;
    flex-direction: column;
    margin: 0.5rem 0.5rem 0.5rem 0;
    border-radius: var(--_radius-xl);
    background: var(--_bg);
    box-shadow: var(--_shadow-sm);
  }

  /* ==================================================== Breadcrumb ======== */
  .breadcrumb-list {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.625rem;
    list-style: none;
    margin: 0;
    padding: 0;
    font-size: 0.875rem;
    color: var(--_muted-fg);
    word-break: break-word;
  }
  .breadcrumb-item {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
  }
  .breadcrumb-link {
    color: inherit;
    text-decoration: none;
    transition: color 0.15s;
  }
  .breadcrumb-link:hover {
    color: var(--_fg);
  }
  .breadcrumb-page {
    min-width: 0;
    overflow: hidden;
    font-weight: 400;
    color: var(--_fg);
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .breadcrumb-separator svg {
    width: 0.875rem;
    height: 0.875rem;
  }

  /* ======================================================== Avatar ======== */
  .avatar {
    position: relative;
    display: flex;
    width: 2rem;
    height: 2rem;
    flex-shrink: 0;
    overflow: hidden;
    border-radius: 9999px;
    user-select: none;
  }
  .avatar img {
    width: 100%;
    height: 100%;
    aspect-ratio: 1 / 1;
    object-fit: cover;
  }
  .avatar-fallback {
    display: flex;
    width: 100%;
    height: 100%;
    align-items: center;
    justify-content: center;
    border-radius: 9999px;
    background: var(--_muted);
    color: var(--_muted-fg);
    font-size: 0.875rem;
  }

  /* ========================================================= Table ======== */
  .table-container {
    position: relative;
    width: 100%;
    overflow-x: auto;
  }
  .table {
    width: 100%;
    border-collapse: collapse;
    caption-side: bottom;
    font-size: 0.875rem;
  }
  .table thead tr {
    border-bottom: 1px solid var(--_border);
  }
  .table tbody tr {
    border-bottom: 1px solid var(--_border);
    transition: background-color 0.15s;
  }
  .table tbody tr:last-child {
    border-bottom: 0;
  }
  .table tbody tr:hover,
  .table tbody tr[data-state="selected"] {
    background: color-mix(in oklab, var(--_muted) 50%, transparent);
  }
  .table th {
    height: 2.5rem;
    padding: 0 0.5rem;
    text-align: left;
    vertical-align: middle;
    font-weight: 500;
    white-space: nowrap;
    color: var(--_fg);
  }
  .table td {
    padding: 0.5rem;
    vertical-align: middle;
  }

  /* ========================================================== Tabs ======== */
  .tabs-list {
    display: inline-flex;
    width: fit-content;
    height: 2.25rem;
    align-items: center;
    justify-content: center;
    padding: 3px;
    border-radius: var(--_radius-lg);
    background: var(--_muted);
    color: var(--_muted-fg);
  }
  .tabs-trigger {
    position: relative;
    display: inline-flex;
    height: calc(100% - 1px);
    flex: 1 1 auto;
    align-items: center;
    justify-content: center;
    gap: 0.375rem;
    padding: 0.25rem 0.5rem;
    border: 1px solid transparent;
    border-radius: var(--_radius-md);
    background: transparent;
    color: color-mix(in oklab, var(--_fg) 60%, transparent);
    font: inherit;
    font-size: 0.875rem;
    font-weight: 500;
    white-space: nowrap;
    cursor: pointer;
    outline: none;
    transition: all 0.15s;
  }
  .tabs-trigger:hover {
    color: var(--_fg);
  }
  .tabs-trigger:focus-visible {
    border-color: var(--_ring);
    box-shadow: 0 0 0 3px color-mix(in oklab, var(--_ring) 50%, transparent);
  }
  .tabs-trigger[data-state="active"] {
    background: var(--_bg);
    color: var(--_fg);
    box-shadow: var(--_shadow-sm);
  }
  .tabs-trigger svg {
    width: 1rem;
    height: 1rem;
    flex-shrink: 0;
    pointer-events: none;
  }

  /* ========================================================= Alert ======== */
  .alert {
    position: relative;
    display: grid;
    width: 100%;
    grid-template-columns: 0 1fr;
    align-items: start;
    row-gap: 0.125rem;
    padding: 0.75rem 1rem;
    border: 1px solid var(--_border);
    border-radius: var(--_radius-lg);
    background: var(--_card);
    color: var(--_card-fg);
    font-size: 0.875rem;
  }
  .alert:has(> svg) {
    grid-template-columns: 1rem 1fr;
    column-gap: 0.75rem;
  }
  .alert > svg {
    width: 1rem;
    height: 1rem;
    transform: translateY(2px);
    color: currentcolor;
  }
  .alert--destructive {
    color: var(--_destructive);
  }
  .alert--destructive .alert-description {
    color: color-mix(in oklab, var(--_destructive) 90%, transparent);
  }
  .alert-title {
    grid-column-start: 2;
    min-height: 1rem;
    font-weight: 500;
    letter-spacing: -0.01em;
  }
  .alert-description {
    display: grid;
    grid-column-start: 2;
    justify-items: start;
    gap: 0.25rem;
    font-size: 0.875rem;
    color: var(--_muted-fg);
  }

  /* ====================================================== Progress ======== */
  .progress {
    position: relative;
    width: 100%;
    height: 0.5rem;
    overflow: hidden;
    border-radius: 9999px;
    background: color-mix(in oklab, var(--_primary) 20%, transparent);
  }
  .progress-indicator {
    height: 100%;
    background: var(--_primary);
    transition: all 0.15s;
  }

  /* ======================================================== Switch ======== */
  .switch {
    display: inline-flex;
    width: 2rem;
    height: 1.15rem;
    flex-shrink: 0;
    align-items: center;
    padding: 0;
    border: 1px solid transparent;
    border-radius: 9999px;
    background: var(--_input);
    box-shadow: var(--_shadow-xs);
    cursor: pointer;
    outline: none;
    transition: all 0.15s;
  }
  .switch[aria-checked="true"],
  .switch:checked {
    background: var(--_primary);
  }
  .switch:focus-visible {
    border-color: var(--_ring);
    box-shadow: 0 0 0 3px color-mix(in oklab, var(--_ring) 50%, transparent);
  }
  .switch:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }
  .switch-thumb {
    display: block;
    width: 1rem;
    height: 1rem;
    border-radius: 9999px;
    background: var(--_bg);
    pointer-events: none;
    transition: transform 0.15s;
  }
  .switch[aria-checked="true"] .switch-thumb {
    transform: translateX(calc(100% - 2px));
  }

  /* ====================================================== Skeleton ======== */
  .skeleton {
    border-radius: var(--_radius-md);
    background: var(--_accent);
    animation: meditor-pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
  }
  @keyframes meditor-pulse {
    50% {
      opacity: 0.5;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .skeleton {
      animation: none;
    }
  }

  /* ======================================== Dialog (native <dialog>) ====== */
  /* DialogContent's look on the platform element, so focus trapping, Escape and
     the top layer are the browser's job rather than ours. */
  .dialog {
    display: grid;
    gap: 1rem;
    width: 100%;
    max-width: 32rem;
    padding: 1.5rem;
    border: 1px solid var(--_border);
    border-radius: var(--_radius-lg);
    background: var(--_bg);
    color: var(--_fg);
    box-shadow: var(--_shadow-lg);
    outline: none;
  }
  .dialog::backdrop {
    background: rgb(0 0 0 / 0.5);
  }
  .dialog-header {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .dialog-title {
    font-size: 1.125rem;
    line-height: 1;
    font-weight: 600;
  }
  .dialog-description {
    font-size: 0.875rem;
    color: var(--_muted-fg);
  }
  .dialog-footer {
    display: flex;
    flex-direction: column-reverse;
    gap: 0.5rem;
  }
  @media (min-width: 640px) {
    .dialog-footer {
      flex-direction: row;
      justify-content: flex-end;
    }
  }
`;

/**
 * Kept as the historical export name so every element that imports
 * `primitiveStyles` keeps working; it is now the full shadcn port above.
 */
export const primitiveStyles = shadcnStyles;

/**
 * The full-screen admin frame. shadcn's SidebarProvider with
 * `variant="inset"`: the wrapper takes the sidebar colour and the content
 * becomes a raised card on it (see `.sidebar-inset`).
 *
 * Dark values come from the host's own `.dark{--scms-*}` block (spec fact #3);
 * only `color-scheme` flips here.
 */
export const overlayStyles = css`
  :host {
    position: fixed;
    inset: 0;
    z-index: 100;
    display: flex;
    background: var(--scms-app-bg, var(--scms-sidebar, var(--scms-bg, oklch(1 0 0))));
    color: var(--scms-fg, oklch(0.145 0 0));
  }
  :host(.dark) {
    color-scheme: dark;
  }
`;
