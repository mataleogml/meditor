import type { ReactiveController, ReactiveControllerHost } from "lit";
import type { SaveResult } from "../actions";

/**
 * Debounced autosave, extracted from `EditorShell`'s
 * `useEffect([page, dirty, version, conflict, …])`. `schedule()` replaces
 * that effect firing on every relevant state change; the host arms it
 * explicitly from `mutate()` and the inline-edit message handler — the only
 * two places `dirty` flips to `true` — so there's no first-render fire and no
 * dependency-array footgun.
 */
export interface AutosaveControllerOptions {
  /** Read the live conflict flag at fire-time. A conflict already showing
   *  means don't keep retrying a write that's known to lose — same guard as
   *  the React effect's `if (!dirty || conflict) return`. */
  getState: () => { conflict: boolean };
  /** Perform the write (slug/page/version/locale are closed over by the
   *  caller — this controller only owns the debounce + result routing). */
  saveDraft: () => Promise<SaveResult>;
  onSaved: (version: string) => void;
  onConflict: () => void;
  /** ms, default 800 (matches the React shell). */
  delay?: number;
}

export class AutosaveController implements ReactiveController {
  private readonly opts: AutosaveControllerOptions;
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor(host: ReactiveControllerHost, opts: AutosaveControllerOptions) {
    this.opts = opts;
    host.addController(this);
  }

  hostDisconnected(): void {
    this.cancel();
  }

  cancel(): void {
    if (this.timer !== undefined) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }
  }

  /** (Re-)arm the debounce. No-ops if a conflict is already showing. */
  schedule(): void {
    this.cancel();
    if (this.opts.getState().conflict) return;
    this.timer = setTimeout(() => {
      this.timer = undefined;
      void this.fire();
    }, this.opts.delay ?? 800);
  }

  private async fire(): Promise<void> {
    const res = await this.opts.saveDraft();
    if (res.ok) this.opts.onSaved(res.version);
    else this.opts.onConflict();
  }
}

/**
 * Preview iframe bridge, extracted from `EditorShell`'s two bridge
 * `useEffect`s: the incoming `window` `message` listener (block select +
 * inline text edit, origin + `__scms` guarded) and the outgoing "selection
 * changed" post. Field-mapping (`mapEditToField`'s trim/`**`-strip) stays in
 * `slice-ops.ts` — this controller only forwards the raw before/after.
 */
export interface PreviewLinkControllerOptions {
  getIframe: () => HTMLIFrameElement | null | undefined;
  onSelect: (index: number) => void;
  onEdit: (index: number, before: string, after: string) => void;
}

export class PreviewLinkController implements ReactiveController {
  private readonly opts: PreviewLinkControllerOptions;
  private readonly onMessage: (e: MessageEvent) => void;

  constructor(host: ReactiveControllerHost, opts: PreviewLinkControllerOptions) {
    this.opts = opts;
    this.onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      const d = e.data;
      if (!d || d.__scms !== true) return;
      if (d.type === "select" && typeof d.index === "number") {
        this.opts.onSelect(d.index);
      }
      if (d.type === "edit" && typeof d.index === "number") {
        this.opts.onEdit(d.index, String(d.before ?? ""), String(d.after ?? ""));
      }
    };
    host.addController(this);
  }

  hostConnected(): void {
    window.addEventListener("message", this.onMessage);
  }

  hostDisconnected(): void {
    window.removeEventListener("message", this.onMessage);
  }

  /** OUT direction: tell the iframe which block is selected (also re-sent on
   *  every preview reload, per the React `[selected, previewV]` effect). */
  postSelect(index: number): void {
    this.opts.getIframe()?.contentWindow?.postMessage(
      { __scms: true, type: "select", index },
      window.location.origin
    );
  }
}

const THEME_KEY = "meditor-theme";

/**
 * Theme preference persistence, guarded.
 *
 * Touching `localStorage` is not a safe read: the property is absent in some
 * runtimes, and its getter THROWS (`SecurityError`) in a sandboxed iframe or
 * when a browser blocks site storage. `typeof window !== "undefined"` doesn't
 * cover either case. Both call sites run in an element constructor / `updated()`
 * hook, where a throw means the custom element never upgrades and the entire
 * editor renders blank — no theme preference is worth that trade.
 */
export function readDarkTheme(): boolean {
  try {
    return globalThis.localStorage?.getItem(THEME_KEY) === "dark";
  } catch {
    return false;
  }
}

export function writeDarkTheme(dark: boolean): void {
  try {
    globalThis.localStorage?.setItem(THEME_KEY, dark ? "dark" : "light");
  } catch {
    // Storage unavailable: the toggle still works for this session, it just
    // doesn't survive a reload.
  }
}
