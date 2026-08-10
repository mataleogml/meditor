import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { ReactiveController, ReactiveControllerHost } from "lit";
import { AutosaveController, PreviewLinkController } from "./controllers";
import type { SaveResult } from "../actions";

/** Bare-bones host stub — no real LitElement, just the controller registry. */
function makeHost(): ReactiveControllerHost {
  const controllers: ReactiveController[] = [];
  return {
    addController: (c) => controllers.push(c),
    removeController: (c) => {
      const i = controllers.indexOf(c);
      if (i >= 0) controllers.splice(i, 1);
    },
    requestUpdate: () => {},
    updateComplete: Promise.resolve(true),
  };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("AutosaveController", () => {
  it("fires saveDraft ~800ms after schedule() and reports success", async () => {
    const saveDraft = vi.fn<() => Promise<SaveResult>>().mockResolvedValue({ ok: true, version: "v2" });
    const onSaved = vi.fn();
    const onConflict = vi.fn();
    const c = new AutosaveController(makeHost(), { getState: () => ({ conflict: false }), saveDraft, onSaved, onConflict });

    c.schedule();
    expect(saveDraft).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(799);
    expect(saveDraft).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(saveDraft).toHaveBeenCalledTimes(1);
    expect(onSaved).toHaveBeenCalledWith("v2");
    expect(onConflict).not.toHaveBeenCalled();
  });

  it("re-arming schedule() resets the debounce (no fire until settled)", async () => {
    const saveDraft = vi.fn<() => Promise<SaveResult>>().mockResolvedValue({ ok: true, version: "v2" });
    const c = new AutosaveController(makeHost(), {
      getState: () => ({ conflict: false }),
      saveDraft,
      onSaved: vi.fn(),
      onConflict: vi.fn(),
    });

    c.schedule();
    await vi.advanceTimersByTimeAsync(500);
    c.schedule(); // e.g. another keystroke — restarts the 800ms window
    await vi.advanceTimersByTimeAsync(500);
    expect(saveDraft).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(300);
    expect(saveDraft).toHaveBeenCalledTimes(1);
  });

  it("routes a conflict result to onConflict, not onSaved", async () => {
    const saveDraft = vi
      .fn<() => Promise<SaveResult>>()
      .mockResolvedValue({ ok: false, code: "conflict", currentVersion: "v9" });
    const onSaved = vi.fn();
    const onConflict = vi.fn();
    const c = new AutosaveController(makeHost(), { getState: () => ({ conflict: false }), saveDraft, onSaved, onConflict });

    c.schedule();
    await vi.advanceTimersByTimeAsync(800);
    expect(onConflict).toHaveBeenCalledTimes(1);
    expect(onSaved).not.toHaveBeenCalled();
  });

  it("skips scheduling entirely while a conflict is already showing", async () => {
    const saveDraft = vi.fn<() => Promise<SaveResult>>().mockResolvedValue({ ok: true, version: "v2" });
    const c = new AutosaveController(makeHost(), {
      getState: () => ({ conflict: true }),
      saveDraft,
      onSaved: vi.fn(),
      onConflict: vi.fn(),
    });

    c.schedule();
    await vi.advanceTimersByTimeAsync(5000);
    expect(saveDraft).not.toHaveBeenCalled();
  });

  it("cancel() prevents a pending fire", async () => {
    const saveDraft = vi.fn<() => Promise<SaveResult>>().mockResolvedValue({ ok: true, version: "v2" });
    const c = new AutosaveController(makeHost(), { getState: () => ({ conflict: false }), saveDraft, onSaved: vi.fn(), onConflict: vi.fn() });

    c.schedule();
    c.cancel();
    await vi.advanceTimersByTimeAsync(2000);
    expect(saveDraft).not.toHaveBeenCalled();
  });

  it("hostDisconnected cancels a pending fire", async () => {
    const saveDraft = vi.fn<() => Promise<SaveResult>>().mockResolvedValue({ ok: true, version: "v2" });
    const c = new AutosaveController(makeHost(), { getState: () => ({ conflict: false }), saveDraft, onSaved: vi.fn(), onConflict: vi.fn() });

    c.schedule();
    c.hostDisconnected();
    await vi.advanceTimersByTimeAsync(2000);
    expect(saveDraft).not.toHaveBeenCalled();
  });
});

describe("PreviewLinkController", () => {
  const post = (data: unknown, origin = window.location.origin) =>
    window.dispatchEvent(new MessageEvent("message", { data, origin }));

  it("forwards a select message to onSelect", () => {
    const onSelect = vi.fn();
    const onEdit = vi.fn();
    const c = new PreviewLinkController(makeHost(), { getIframe: () => null, onSelect, onEdit });
    c.hostConnected();

    post({ __scms: true, type: "select", index: 2 });
    expect(onSelect).toHaveBeenCalledWith(2);
    expect(onEdit).not.toHaveBeenCalled();
  });

  it("forwards an edit message to onEdit with raw before/after", () => {
    const onEdit = vi.fn();
    const c = new PreviewLinkController(makeHost(), { getIframe: () => null, onSelect: vi.fn(), onEdit });
    c.hostConnected();

    post({ __scms: true, type: "edit", index: 1, before: "**Hi**", after: "Hi there" });
    expect(onEdit).toHaveBeenCalledWith(1, "**Hi**", "Hi there");
  });

  it("defaults missing before/after to empty strings", () => {
    const onEdit = vi.fn();
    const c = new PreviewLinkController(makeHost(), { getIframe: () => null, onSelect: vi.fn(), onEdit });
    c.hostConnected();

    post({ __scms: true, type: "edit", index: 0 });
    expect(onEdit).toHaveBeenCalledWith(0, "", "");
  });

  it("ignores messages from a different origin", () => {
    const onSelect = vi.fn();
    const c = new PreviewLinkController(makeHost(), { getIframe: () => null, onSelect, onEdit: vi.fn() });
    c.hostConnected();

    post({ __scms: true, type: "select", index: 3 }, "https://evil.example");
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("ignores messages without the __scms marker", () => {
    const onSelect = vi.fn();
    const c = new PreviewLinkController(makeHost(), { getIframe: () => null, onSelect, onEdit: vi.fn() });
    c.hostConnected();

    post({ type: "select", index: 3 });
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("stops listening after hostDisconnected", () => {
    const onSelect = vi.fn();
    const c = new PreviewLinkController(makeHost(), { getIframe: () => null, onSelect, onEdit: vi.fn() });
    c.hostConnected();
    c.hostDisconnected();

    post({ __scms: true, type: "select", index: 1 });
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("postSelect() posts a select message to the iframe's contentWindow", () => {
    const postMessage = vi.fn();
    const iframe = { contentWindow: { postMessage } } as unknown as HTMLIFrameElement;
    const c = new PreviewLinkController(makeHost(), { getIframe: () => iframe, onSelect: vi.fn(), onEdit: vi.fn() });

    c.postSelect(4);
    expect(postMessage).toHaveBeenCalledWith({ __scms: true, type: "select", index: 4 }, window.location.origin);
  });

  it("postSelect() is a no-op when there's no iframe yet", () => {
    const c = new PreviewLinkController(makeHost(), { getIframe: () => null, onSelect: vi.fn(), onEdit: vi.fn() });
    expect(() => c.postSelect(0)).not.toThrow();
  });
});
