import "@testing-library/jest-dom/vitest";

// jsdom does not implement native modal APIs; browser tests cover focus and inertness.
HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); };
