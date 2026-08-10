// testing-library matchers (`.toBeInTheDocument`, `.toHaveValue`, …) and the
// vitest `expect` augmentation they carry.
import "@testing-library/jest-dom/vitest";

// jsdom deliberately doesn't implement <dialog>'s imperative methods (out of
// scope for jsdom, per its own tracker) — stub them so components using the
// native element (meditor's ImagePickerField) are testable without a real
// browser. Toggles the `open` attribute to match real browser behavior.
if (globalThis.HTMLDialogElement && !HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    this.removeAttribute("open");
  };
}
