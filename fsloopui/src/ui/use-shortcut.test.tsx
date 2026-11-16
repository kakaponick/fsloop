// @vitest-environment jsdom
import "./test-setup.ts";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { useShortcut } from "./use-shortcut.ts";

function Probe({ onKey, dialog = false }: { onKey: () => void; dialog?: boolean }) {
  useShortcut("Slash", onKey);
  return (
    <>
      <input aria-label="Поиск" />
      <input aria-label="Отметка" type="checkbox" />
      <button type="button">Кнопка</button>
      {dialog && <div role="dialog" data-state="open" />}
    </>
  );
}

describe("shortcut hook", () => {
  test("binds by the physical key, so «/» works in the Russian layout, where the key types «.»", () => {
    const onKey = vi.fn();
    render(<Probe onKey={onKey} />);
    fireEvent.keyDown(window, { code: "Slash", key: "." });
    expect(onKey).toHaveBeenCalledOnce();
    fireEvent.keyDown(window, { code: "Period", key: "/" });
    expect(onKey).toHaveBeenCalledOnce();
  });

  test("is off in a text field, not in a checkbox or a button", () => {
    const onKey = vi.fn();
    render(<Probe onKey={onKey} />);
    fireEvent.keyDown(screen.getByRole("textbox", { name: "Поиск" }), { code: "Slash", key: "/" });
    expect(onKey).not.toHaveBeenCalled();
    fireEvent.keyDown(screen.getByRole("checkbox", { name: "Отметка" }), { code: "Slash", key: "/" });
    fireEvent.keyDown(screen.getByRole("button", { name: "Кнопка" }), { code: "Slash", key: "/" });
    expect(onKey).toHaveBeenCalledTimes(2);
  });

  test("is off with a dialog open", () => {
    const onKey = vi.fn();
    render(<Probe onKey={onKey} dialog />);
    fireEvent.keyDown(window, { code: "Slash", key: "/" });
    expect(onKey).not.toHaveBeenCalled();
  });

  test("is off on a key repeat and with a modifier held", () => {
    const onKey = vi.fn();
    render(<Probe onKey={onKey} />);
    fireEvent.keyDown(window, { code: "Slash", key: "/", repeat: true });
    fireEvent.keyDown(window, { code: "Slash", key: "/", ctrlKey: true });
    fireEvent.keyDown(window, { code: "Slash", key: "/", metaKey: true });
    expect(onKey).not.toHaveBeenCalled();
  });
});
