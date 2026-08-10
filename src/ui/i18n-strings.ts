import type { Messages } from "../i18n";
import { defaultMessages } from "./messages";

/**
 * Vanilla (non-React) counterpart to `useT` (intl.tsx): same key→host-override
 * → English-default→literal-key fallback + `{var}` interpolation, without a
 * context provider. Each Lit element calls `createT(this.messages)` itself
 * (no shared provider — `messages` is drilled as a plain property, per spec §1).
 */
export function createT(messages?: Partial<Messages>) {
  const merged = { ...defaultMessages, ...messages } as Messages;
  return (key: string, vars?: Record<string, string | number>): string => {
    let s = merged[key] ?? defaultMessages[key] ?? key;
    if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
    return s;
  };
}
