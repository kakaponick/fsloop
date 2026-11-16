// The jsdom side of a component test: jest-dom matchers, cleanup between cases, and the browser APIs jsdom lacks
// that the library's primitives call (pointer capture, scrollIntoView, ResizeObserver, matchMedia).
import "@testing-library/jest-dom/vitest";
import { cleanup, configure } from "@testing-library/react";
import { afterEach } from "vitest";
import { resetPrefsMemory } from "./storage.ts";

// A `waitFor` / `findBy` bound catches a hang, not a stopwatch (`tests 4`): the walks over the 723-finding run render
// in well under a second alone, but the suite runs 34 files at once and a re-render can pass 1 s, the library's
// default. The files' own explicit waits use 4 s too; every one sits within half the test's 10 s limit
// (vite.config.ts), so a wait that fails reports its own assertion before the test times out (src/app/waits.test.ts).
configure({ asyncUtilTimeout: 4000 });

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
