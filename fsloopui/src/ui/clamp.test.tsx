// @vitest-environment jsdom
import "./test-setup.ts";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "vitest";
import { Clamp } from "./clamp.tsx";
import { longText } from "./test-utils.tsx";

// jsdom lays nothing out: the box's heights are set per case, and the observer reports on observe as a browser does.
let heights = { scroll: 40, client: 40 };
const original = window.ResizeObserver;
beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, "scrollHeight", { configurable: true, get: () => heights.scroll });
  Object.defineProperty(HTMLElement.prototype, "clientHeight", { configurable: true, get: () => heights.client });
  window.ResizeObserver = class {
    private cb: ResizeObserverCallback;
    constructor(cb: ResizeObserverCallback) {
      this.cb = cb;
    }
    observe() {
      this.cb([], this as unknown as ResizeObserver);
    }
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});
afterAll(() => {
  window.ResizeObserver = original;
});
beforeEach(() => {
  heights = { scroll: 40, client: 40 };
});

const goal = longText(8617, 50, "цель");

describe("clamp", () => {
  test("text the clamp does not cut is plain text: no trigger", () => {
    render(<Clamp what="цель прогона">Короткая цель</Clamp>);
    expect(screen.queryByRole("button")).toBeNull();
    // cut at two lines' height; nothing laid over the text
    expect(screen.getByText("Короткая цель")).toHaveClass("max-h-[2lh]", "overflow-hidden");
    expect(document.querySelector("[data-slot=clamp-end]")).toBeNull();
  });

  test("a clamp that hides text ends on a word boundary: «… развернуть» takes its width at the end of the last line", () => {
    heights = { scroll: 900, client: 38 };
    render(<Clamp what="цель прогона">{goal}</Clamp>);
    const trigger = screen.getByRole("button", { name: "Развернуть цель прогона" });
    expect(trigger).toHaveTextContent("развернуть");
    const end = trigger.closest("[data-slot=clamp-end]") as HTMLElement;
    const box = end.parentElement as HTMLElement;
    // a float beside the text, never laid over it: the last line's words wrap around it, whole
    expect(end).toHaveTextContent("… развернуть");
    expect(end).toHaveClass("float-right", "clear-both");
    expect(end).not.toHaveClass("absolute");
    // the spacer pushes it down to the last visible line: one line shorter than the box, which is two lines tall
    const spacer = box.firstElementChild as HTMLElement;
    expect(spacer).toHaveAttribute("data-slot", "clamp-spacer");
    expect(spacer).toHaveClass("float-right", "h-[1lh]");
    expect(spacer.nextElementSibling).toBe(end);
    expect(box).toHaveClass("max-h-[2lh]", "overflow-hidden");
    expect(box).toHaveTextContent(goal.slice(0, 120));
  });

  test("a clamp of four lines is cut at four", () => {
    heights = { scroll: 900, client: 76 };
    render(
      <Clamp what="наблюдение" lines={4}>
        {goal}
      </Clamp>,
    );
    const box = screen.getByRole("button", { name: "Развернуть наблюдение" }).closest("[data-slot=clamp-end]")?.parentElement as HTMLElement;
    expect(box).toHaveClass("max-h-[4lh]");
    expect(box.firstElementChild).toHaveClass("h-[3lh]");
  });

  test("expanded, the text scrolls inside a capped region; collapsing returns focus to the trigger", async () => {
    heights = { scroll: 900, client: 38 };
    const user = userEvent.setup();
    render(<Clamp what="цель прогона">{goal}</Clamp>);
    await user.click(screen.getByRole("button", { name: "Развернуть цель прогона" }));
    const region = screen.getByRole("region", { name: "цель прогона" });
    expect(region).toHaveClass("max-h-text-cap", "overflow-y-auto");
    expect(region).toHaveTextContent(goal.slice(0, 120));
    const collapse = screen.getByRole("button", { name: "Свернуть цель прогона" });
    expect(collapse).toHaveFocus();
    await user.keyboard("{Enter}");
    await act(async () => {});
    expect(screen.getByRole("button", { name: "Развернуть цель прогона" })).toHaveFocus();
  });

  test("a card's clamp never offers the trigger: the full text is on the page it opens", () => {
    heights = { scroll: 900, client: 38 };
    render(
      <Clamp what="цель прогона" expandable={false}>
        {goal}
      </Clamp>,
    );
    expect(screen.queryByRole("button")).toBeNull();
    // a card's clamp cuts with the library's ellipsis: there is no trigger to make room for
    expect(screen.getByText(goal.slice(0, 40), { exact: false })).toHaveClass("line-clamp-2");
  });
});
