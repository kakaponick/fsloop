// @vitest-environment jsdom
// u12 (p2-assess-critic-improve#improve-9 (1)): the in-view strip is one shared part — «Журнал» and «Соглашения» both
// name the items their list shows in the status bar, «на экране #40–#42» and «на экране 12–17», each in its list's own
// number form, in a box reserved at the widest form the list can take (Strict 1).
import "./test-setup.ts";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { useRef } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { applyStylesheet } from "../app/layout-testing.ts";
import { InView, inViewText, itemsInView, useInView } from "./in-view.tsx";
import { SCROLLER } from "./reveal.ts";

afterEach(() => vi.restoreAllMocks());

describe("improve-9 (1): the in-view strip, one part for both lists", () => {
  test("the first and the last item a line of which shows — 20 px, or the whole of a shorter box", () => {
    const boxes = [
      { n: "39", top: -200, bottom: -5 },
      { n: "40", top: -5, bottom: 130 },
      { n: "41", top: 130, bottom: 270 },
      { n: "42", top: 270, bottom: 395 },
      { n: "43", top: 395, bottom: 530 },
    ];
    // 5 px of #43 is not an item in view
    expect(itemsInView({ top: 0, bottom: 400 }, boxes)).toEqual(["40", "42"]);
    // a sticky heading's 32 px over the band's top: #40 shows 98 px under it, still in view
    expect(itemsInView({ top: 32, bottom: 400 }, boxes)).toEqual(["40", "42"]);
    expect(itemsInView({ top: 0, bottom: 400 }, [])).toBeNull();
  });

  test("the words, in each list's own number form: «на экране #40–#42», «на экране 12–17», one item alone, nothing", () => {
    expect(inViewText("entry", ["40", "42"])).toBe("на экране #40–#42");
    expect(inViewText("entry", ["7", "7"])).toBe("на экране #7");
    expect(inViewText("convention", ["12", "17"])).toBe("на экране 12–17");
    expect(inViewText("convention", ["26", "26"])).toBe("на экране 26");
    expect(inViewText("entry", null)).toBe("");
    expect(inViewText("convention", ["12", "17"]).split(/\s+/)).toHaveLength(3);
  });

  test("Strict 1: its box is reserved at the widest form the list can take — empty before anything is measured", async () => {
    const { rerender } = render(<InView kind="entry" range={null} last="143" />);
    const box = document.querySelector("[data-slot=in-view]") as HTMLElement;
    await applyStylesheet();
    // a box of its own beside the bar's text, never collapsing to its words
    expect(getComputedStyle(box).display).toBe("inline-block");
    // «на экране #143–#143», 19 characters, with 2 ch of room: a Cyrillic letter is wider than a digit's «ch»
    expect(box.style.minWidth).toBe("21ch");
    expect(box).toHaveTextContent(/^$/);
    rerender(<InView kind="entry" range={["142", "143"]} last="143" />);
    expect(box).toHaveTextContent(/^на экране #142–#143$/);
    expect(box.style.minWidth).toBe("21ch");
    rerender(<InView kind="convention" range={["12", "17"]} last="26" />);
    // «на экране 26–26», 15 characters
    expect(box.style.minWidth).toBe("17ch");
  });

  test("useInView: the items `data-<kind>` marks in the scroller, measured before paint and on every scroll", async () => {
    // jsdom lays nothing out: the scroller stands 0–400, item n at n × 100 − 100 under its top, 100 px high
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
      const scroller = document.querySelector("[data-testid=scroller]") as HTMLElement;
      const n = this.dataset.convention;
      const top = this === scroller ? 0 : n ? Number(n) * 100 - 100 - scroller.scrollTop : 0;
      const height = this === scroller ? 400 : 100;
      return { top, bottom: top + height, left: 0, right: 0, width: 0, height, x: 0, y: top, toJSON: () => ({}) } as DOMRect;
    });
    function List() {
      const scroller = useRef<HTMLDivElement>(null);
      const range = useInView(scroller, "convention", "v1", { top: 32 });
      return (
        <>
          <div ref={scroller} data-testid="scroller" className={SCROLLER}>
            {Array.from({ length: 26 }, (_, i) => (
              <div key={i} data-convention={String(i + 1)}>
                {i + 1}
              </div>
            ))}
          </div>
          <InView kind="convention" range={range} last="26" />
        </>
      );
    }
    render(<List />);
    // the band under a 32 px heading: 1 is 68 px of it, 4 is 100 px from 300 to 400
    expect(document.querySelector("[data-slot=in-view]")).toHaveTextContent(/^на экране 1–4$/);
    const scroller = screen.getByTestId("scroller");
    scroller.scrollTop = 1110;
    await act(async () => {
      fireEvent.scroll(scroller);
      await new Promise((done) => requestAnimationFrame(() => done(null)));
    });
    // 12 stands at −10 to 90: 58 px of it shows under the heading's 32; 15 at 290–390; 16 shows 10 px, not a line
    expect(document.querySelector("[data-slot=in-view]")).toHaveTextContent(/^на экране 12–15$/);
  });
});
