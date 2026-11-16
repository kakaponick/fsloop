// @vitest-environment jsdom
// p3-review-critic-code#code-3: a key that focuses a field shows as that field's in-field cap (the design check of
// pass 3: a key's cap) — one part, `FieldCap`, for the table's search («/») and the journal's jump field («G»).
import "./test-setup.ts";
import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRef, useState } from "react";
import { describe, expect, test } from "vitest";
import { applyStylesheet } from "../app/layout-testing.ts";
import { FieldCap } from "./field-cap.tsx";
import { UiProvider } from "./provider.tsx";

function Field({ enabled = true }: { enabled?: boolean }) {
  const ref = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState("");
  return (
    <div>
      <input ref={ref} aria-label="Перейти к #: номер решения" value={value} onChange={(e) => setValue(e.target.value)} />
      <FieldCap field={ref} code="KeyG" filled={Boolean(value)} enabled={enabled} />
    </div>
  );
}

const cap = () => document.querySelector("[data-slot=field-cap]") as HTMLElement | null;
const shown = async () => {
  await applyStylesheet();
  const el = cap() as HTMLElement;
  return { visibility: getComputedStyle(el).visibility, display: getComputedStyle(el).display, hidden: el.getAttribute("aria-hidden") };
};

describe("p3-review-critic-code#code-3: one in-field key cap", () => {
  test("its physical key focuses the field in any layout; the cap is hidden and unread while the field is focused or filled — its box kept — and back once the field is empty and left", async () => {
    const user = userEvent.setup();
    render(<Field />);
    const field = screen.getByRole("textbox");
    expect(cap()).toHaveTextContent(/^G$/);
    expect(cap()?.querySelector("kbd")).not.toBeNull();
    expect(await shown()).toEqual({ visibility: "visible", display: "inline", hidden: null });
    // the Russian layout's «п» is the same physical key
    fireEvent.keyDown(document.body, { code: "KeyG", key: "п" });
    expect(field).toHaveFocus();
    expect(await shown()).toEqual({ visibility: "hidden", display: "inline", hidden: "true" });
    await user.keyboard("40");
    act(() => field.blur());
    // filled: still aside
    expect(await shown()).toEqual({ visibility: "hidden", display: "inline", hidden: "true" });
    await user.clear(field);
    act(() => field.blur());
    expect(await shown()).toEqual({ visibility: "visible", display: "inline", hidden: null });
  });

  test("a key that does not focus this field draws no cap and binds nothing", () => {
    render(<Field enabled={false} />);
    expect(cap()).toBeNull();
    fireEvent.keyDown(document.body, { code: "KeyG", key: "g" });
    expect(screen.getByRole("textbox")).not.toHaveFocus();
  });

  test("both hosts draw it: the table's search with «/»", async () => {
    const { SearchBox } = await import("../table/search.tsx");
    render(<SearchBox value="" onChange={() => {}} placeholder="Текст, id, юнит" history={[]} onCommit={() => {}} />, { wrapper: UiProvider });
    expect(cap()).toHaveTextContent(/^\/$/);
    fireEvent.keyDown(document.body, { code: "Slash", key: "." });
    expect(screen.getByRole("searchbox")).toHaveFocus();
    expect(cap()).toHaveAttribute("aria-hidden", "true");
  });
});
