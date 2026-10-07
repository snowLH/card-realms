import { vi } from "vitest";

/**
 * JSDOM intentionally has no canvas implementation. Components still render
 * their image fallback in that environment, so a tiny context is enough to
 * exercise the surrounding interaction without noisy browser API errors.
 */
if (typeof HTMLCanvasElement !== "undefined") {
  Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
    configurable: true,
    value: vi.fn(() => ({
      clearRect: vi.fn(),
    })),
  });
}
