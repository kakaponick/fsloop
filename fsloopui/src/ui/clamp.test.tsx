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
    expect(screen.getByText("Короткая цель")).toHaveClass("line-clamp-2");
  });

  test("a clamp that hides text shows «развернуть» over its last line, outside the flow", () => {
    heights = { scroll: 900, client: 38 };
    render(<Clamp what="цель прогона">{goal}</Clamp>);
    const trigger = screen.getByRole("button", { name: "Развернуть цель прогона" });
    expect(trigger).toHaveTextContent("развернуть");
    expect(trigger.parentElement).toHaveClass("absolute", "bottom-0", "right-0");
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
  });
});
