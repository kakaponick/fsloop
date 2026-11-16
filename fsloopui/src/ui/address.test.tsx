// @vitest-environment jsdom
// f22: an object on a list that is not a table — a journal's decision, a run's convention — has one address form on
// every view (the design check: an object's address is a query key): the reveal that brings it into view moves the
// list's own scroller and nothing above it, its number links to its address, its menu copies the whole address,
// and an address the list does not hold reads one «не найдено» line that names what the run holds and closes.
import "./test-setup.ts";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { MissingLine, missingText, NotFound, notFoundText, numberRange } from "./absent.tsx";
import { AddressLink, AddressMenu, addressWhat } from "./address.tsx";
import { revealIn, SCROLLER, useReveal } from "./reveal.ts";
import { renderUi } from "./test-utils.tsx";

const words = (s: string) => s.split(/\s+/).filter(Boolean).length;

/** Every element's box from its `data-top`: jsdom lays nothing out, so the test says where each one stands. */
function placeBoxes() {
  return vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
    const top = Number(this.dataset.top ?? 0) - (this.dataset.in ? (document.querySelector(`[data-testid="${this.dataset.in}"]`) as HTMLElement).scrollTop : 0);
    const height = Number(this.dataset.height ?? 40);
    return { top, bottom: top + height, left: 0, right: 0, width: 0, height, x: 0, y: top, toJSON: () => ({}) } as DOMRect;
  });
}

afterEach(() => vi.restoreAllMocks());

describe("p2-verdict-critic-craft-verdict-3#craft-1: the shared reveal moves the list's own scroller and nothing above it", () => {
  test("revealIn: the object 8 px under its scroller's top, focused; scrollIntoView is never called, the page around it stays", () => {
    placeBoxes();
    const into = vi.spyOn(HTMLElement.prototype, "scrollIntoView");
    render(
      <section data-testid="page" className="overflow-y-auto">
        <div data-testid="toolbar">поиск</div>
        <div data-testid="scroller" data-top="100" className={SCROLLER}>
          <article data-top="160">#39</article>
          <article data-testid="target" data-top="700" tabIndex={-1}>
            #40
          </article>
        </div>
      </section>,
    );
    const page = screen.getByTestId("page");
    const scroller = screen.getByTestId("scroller");
    scroller.scrollTop = 40;
    revealIn(scroller, screen.getByTestId("target"));
    // 40 already scrolled + (700 − 100) between the two tops − the 8 px gap
    expect(scroller.scrollTop).toBe(632);
    expect(page.scrollTop).toBe(0);
    expect(into).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(screen.getByTestId("target"));
  });

  test("revealIn `nearest`: an object already in view stays; one below comes up just far enough, one above down — focus left alone; `gap` keeps a sticky strip's room", () => {
    placeBoxes();
    const into = vi.spyOn(HTMLElement.prototype, "scrollIntoView");
    render(
      <div data-testid="rail" data-top="100" data-height="400" className={SCROLLER}>
        <a href="#a" data-testid="shown" data-in="rail" data-top="200" data-height="32">
          a
        </a>
        <a href="#b" data-testid="below" data-in="rail" data-top="900" data-height="32">
          b
        </a>
        <h3 data-testid="heading" data-in="rail" data-top="1300">
          3. Parser gaps
        </h3>
      </div>,
    );
    const rail = screen.getByTestId("rail");
    revealIn(rail, screen.getByTestId("shown"), { nearest: true, focus: false });
    expect(rail.scrollTop).toBe(0);
    // its bottom (932) 8 px above the box's bottom (500)
    revealIn(rail, screen.getByTestId("below"), { nearest: true, focus: false });
    expect(rail.scrollTop).toBe(440);
    expect(document.activeElement).toBe(document.body);
    // back above the box's top: down to it, 8 px under
    revealIn(rail, screen.getByTestId("shown"), { nearest: true, focus: false });
    expect(rail.scrollTop).toBe(92);
    // a heading under a 40 px sticky strip: 48 px under the box's top
    revealIn(rail, screen.getByTestId("heading"), { gap: 48, focus: false });
    expect(rail.scrollTop).toBe(1152);
    expect(into).not.toHaveBeenCalled();
  });

  test("SCROLLER: a list's scroller is the containing block of everything in it — an sr-only text deep in the list never overflows the page's body", () => {
    // the cause of the 48 px displacement: f16 put «—» (Dash, its «нет значения» sr-only, `position: absolute`) into
    // the journal's entries; the list's scroller was not positioned, so the text's containing block was the view's
    // absolute box — the scroller neither clipped nor scrolled it, it hung below the view at its place in the list,
    // and `view-body` gained an overflow that `scrollIntoView` then scrolled by the toolbar's height
    expect(SCROLLER.split(" ")).toEqual(expect.arrayContaining(["relative", "min-h-0", "overflow-y-auto", "[scrollbar-gutter:stable]"]));
  });

  test("useReveal: an address reveals its object once; an address set by a click on the object itself leaves it where it is (Strict 1)", async () => {
    placeBoxes();
    const user = userEvent.setup();
    function List() {
      const [target, setTarget] = useState<string | null>(null);
      const { scroller, hold } = useReveal(target, (box, id) => box.querySelector<HTMLElement>(`[data-id="${id}"]`));
      return (
        <>
          <button type="button" onClick={() => setTarget("2")}>
            открыть 2
          </button>
          <div ref={scroller} data-testid="scroller" data-top="100" className={SCROLLER}>
            <article data-id="1" data-top="300" tabIndex={-1}>
              <button
                type="button"
                onClick={() => {
                  hold("1");
                  setTarget("1");
                }}
              >
                1
              </button>
            </article>
            <article data-id="2" data-top="900" tabIndex={-1}>
              2
            </article>
          </div>
        </>
      );
    }
    render(<List />);
    const scroller = screen.getByTestId("scroller");
    await user.click(screen.getByRole("button", { name: "открыть 2" }));
    expect(scroller.scrollTop).toBe(792);
    expect(document.activeElement).toBe(document.querySelector('[data-id="2"]'));
    scroller.scrollTop = 100;
    await user.click(screen.getByRole("button", { name: "1" }));
    expect(scroller.scrollTop).toBe(100);
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "1" }));
  });
});

describe("p2-verdict-critic-craft-verdict-3#craft-4: an object's own address, one form on both views", () => {
  test("its number links to its address and opens it in place; a right click on the item copies the whole address", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    const onOpen = vi.fn();
    const href = "/r/admin/a5b5ec85?view=journal&entry=40";
    renderUi(
      <AddressMenu kind="entry" href={href} header={{ text: "#40 · Question 40: which way?" }}>
        <article data-testid="item" tabIndex={-1}>
          <AddressLink kind="entry" id="40" href={href} onOpen={onOpen} /> · проход 1 · карта
        </article>
      </AddressMenu>,
    );
    const link = screen.getByRole("link", { name: "Ссылка на решение #40" });
    expect(link).toHaveTextContent(/^#40$/);
    expect(link).toHaveAttribute("href", href);
    expect(link).toHaveClass("tabular-nums");
    await user.click(link);
    expect(onOpen).toHaveBeenCalledOnce();
    fireEvent.contextMenu(screen.getByTestId("item"));
    const menu = await screen.findByRole("menu");
    expect(within(menu).getByText("#40 · Question 40: which way?")).toBeInTheDocument();
    await user.click(within(menu).getByRole("menuitem", { name: "Скопировать адрес решения" }));
    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}${href}`);
    expect(await screen.findByText("Скопировано: адрес решения")).toBeInTheDocument();
  });

  test("a convention's number is bare, its address copied as «адрес соглашения»; a click with a modifier keeps the browser's own meaning", () => {
    expect(addressWhat("entry")).toBe("адрес решения");
    expect(addressWhat("convention")).toBe("адрес соглашения");
    const onOpen = vi.fn();
    renderUi(<AddressLink kind="convention" id="12" href="/r/p/x?view=conventions&convention=12" onOpen={onOpen} />);
    const link = screen.getByRole("link", { name: "Ссылка на соглашение 12" });
    expect(link).toHaveTextContent(/^12$/);
    fireEvent.click(link, { ctrlKey: true });
    expect(onOpen).not.toHaveBeenCalled();
  });
});

describe("p2-verdict-critic-craft-verdict-2#craft-6: an entry's id is written one way — «#12»", () => {
  test("«не найдено» writes an entry's number with «#», as its head, its range and the glossary do; a convention's stays bare", () => {
    expect(notFoundText("entry", "12")).toBe("решение #12 не найдено");
    expect(notFoundText("convention", "99", { start: true })).toBe("Соглашение 99 не найдено");
    expect(numberRange("entry", "1", "143")).toBe("#1–#143");
    expect(numberRange("entry", "5", "5")).toBe("#5");
    expect(numberRange("convention", "1", "26")).toBe("1–26");
    const { container } = render(<NotFound kind="entry" id="999" start />);
    expect(container).toHaveTextContent(/^Решение #999 не найдено$/);
    expect(container.querySelector(".font-mono")).toHaveTextContent(/^#999$/);
  });
});

describe("p2-verdict-critic-craft-verdict-3#craft-5: one «не найдено» line for both views — what is missing, what the run holds, and a way out", () => {
  test("the line's words: the range the run holds, agreed; no range when the list is empty", () => {
    expect(missingText("entry", "999", ["1", "143"])).toBe("Решение #999 не найдено: в этом прогоне решения #1–#143.");
    expect(words(missingText("entry", "999", ["1", "143"]))).toBe(9);
    expect(missingText("convention", "99", ["1", "26"])).toBe("Соглашение 99 не найдено: в этом прогоне соглашения 1–26.");
    expect(words(missingText("convention", "99", ["1", "26"]))).toBe(9);
    expect(missingText("entry", "7", ["1", "1"])).toBe("Решение #7 не найдено: в этом прогоне решение #1.");
    expect(missingText("convention", "9", null)).toBe("Соглашение 9 не найдено.");
  });

  test("MissingLine: a polite status with the id in mono, then «Закрыть», which is the caller's way out", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderUi(<MissingLine kind="convention" id="99" range={["1", "26"]} onClose={onClose} slot="convention-missing" />);
    const line = document.querySelector("[data-slot=convention-missing]") as HTMLElement;
    expect(line).toHaveAttribute("role", "status");
    expect(line).toHaveTextContent(/^Соглашение 99 не найдено: в этом прогоне соглашения 1–26\.\s*Закрыть$/);
    expect(line.querySelector("[data-slot=not-found] .font-mono")).toHaveTextContent(/^99$/);
    await user.click(within(line).getByRole("button", { name: "Закрыть" }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
