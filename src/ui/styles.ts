/**
 * The editor's design system lives in `shadcn.ts` — a direct port of shadcn/ui's
 * own component CSS (see that file's header for what is and isn't ported).
 *
 * This module stays as the import path every element already uses, and as the
 * place for anything that is NOT a shadcn component.
 */
export { shadcnStyles, primitiveStyles, overlayStyles } from "./shadcn";
