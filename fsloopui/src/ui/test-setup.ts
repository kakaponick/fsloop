// The jsdom side of a component test: jest-dom matchers, cleanup between cases, and the browser APIs jsdom lacks
// that the library's primitives call (pointer capture, scrollIntoView, ResizeObserver, matchMedia).
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";
import { resetPrefsMemory } from "./storage.ts";

afterEach(() => {
  cleanup();
  resetPrefsMemory();
  try {
    window.localStorage.clear();
  } catch {
    // storage may be blocked in a case on purpose
  }
});

const proto = window.HTMLElement.prototype as unknown as Record<string, unknown>;
proto.hasPointerCapture ??= () => false;
proto.setPointerCapture ??= () => {};
proto.releasePointerCapture ??= () => {};
proto.scrollIntoView ??= () => {};

class NoopResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
const w = window as unknown as Record<string, unknown>;
w.ResizeObserver ??= NoopResizeObserver;
w.matchMedia ??= (query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: () => {},
  removeListener: () => {},
  addEventListener: () => {},
  removeEventListener: () => {},
  dispatchEvent: () => false,
});
