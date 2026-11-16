// @vitest-environment jsdom
import "./test-setup.ts";
import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { readPref, resetPrefsMemory, usePref, writePref } from "./storage.ts";

afterEach(() => {
  resetPrefsMemory();
  vi.restoreAllMocks();
});

function Probe({ k }: { k: string }) {
  const [open, setOpen] = usePref(k, false);
  return (
    <button type="button" onClick={() => setOpen(!open)}>
      {open ? "открыто" : "закрыто"}
    </button>
  );
}

describe("storage", () => {
  test("a stored value is on the first render, never the default first", () => {
    window.localStorage.setItem("fsloopui:fold", "true");
    const seen: boolean[] = [];
    function Spy() {
      const [v] = usePref("fold", false);
      seen.push(v);
      return null;
    }
    render(<Spy />);
    expect(seen[0]).toBe(true);
  });

  test("a write reaches every reader and survives a remount", () => {
    const first = render(<Probe k="more" />);
    act(() => screen.getByRole("button").click());
    expect(screen.getByRole("button")).toHaveTextContent("открыто");
    first.unmount();
    resetPrefsMemory();
    render(<Probe k="more" />);
    expect(screen.getByRole("button")).toHaveTextContent("открыто");
    expect(window.localStorage.getItem("fsloopui:more")).toBe("true");
  });

  test("blocked storage reads the fallback and keeps the session's value", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    expect(readPref("view", { sort: "severity" })).toEqual({ sort: "severity" });
    writePref("view", { sort: "id" });
    expect(readPref("view", { sort: "severity" })).toEqual({ sort: "id" });
  });

  test("a value that is not JSON reads as the fallback", () => {
    window.localStorage.setItem("fsloopui:broken", "{not json");
    expect(readPref("broken", 3)).toBe(3);
  });
});
