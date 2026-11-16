// @vitest-environment jsdom
import "./test-setup.ts";
import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, test, vi } from "vitest";
import { applyStylesheet } from "../app/layout-testing.ts";
import { parseBlocks, RunningText } from "./running-text.tsx";
import { longText } from "./test-utils.tsx";

// A FINDINGS item as fsloop's critics write it (`agents/fsloop-critic.md`), with the shapes the renderer keeps.
const SAMPLE = [
  "`launchErrorCause` passes uncoded **lastError** through as is.",
  "Second line of the same paragraph.",
  "",
  "  - first bullet",
  "    continued under it",
  "  - second bullet with `code`",
  "",
  "1. step one",
  "2. step two",
  "",
  "| col | value |",
  "|---|---|",
  "| a \\| b | `x` |",
  "",
  "See p1-review-critic-craft#craft-4 and u3.",
].join("\n");

describe("running text: inline code and the search's hits", () => {
  test("cand-15: punctuation right after inline code keeps to it — no gap, no line break between them", () => {
    const { container } = render(<RunningText text={"Правило: `ux 1`, impeccable critique; см. `ui.md`. И `код` дальше."} />);
    const codes = [...container.querySelectorAll("code")];
    expect(codes.map((c) => c.textContent)).toEqual(["ux 1", "ui.md", "код"]);
    expect(codes[0]).toHaveClass("pl-1", "pr-0");
    expect(codes[1]).toHaveClass("pl-1", "pr-0");
    expect(codes[2]).toHaveClass("px-1");
    expect(codes[2]).not.toHaveClass("pr-0");
    expect(codes[0].parentElement).toHaveClass("whitespace-nowrap");
    expect(codes[0].parentElement).toHaveTextContent(/^ux 1,$/);
    expect(codes[1].parentElement).toHaveTextContent(/^ui\.md\.$/);
    expect(container.textContent).toBe("Правило: ux 1, impeccable critique; см. ui.md. И код дальше.");
  });

  test("verdict-5: the caller's hit painter marks the searched words wherever the text holds them — a paragraph, bold, a list item, code", () => {
    const paint = (s: string) => s.split(/(40)/).map((part, i) => (part === "40" ? <mark key={i} data-slot="hit">{part}</mark> : part));
    const { container } = render(<RunningText text={"Решили через 40 минут, **40**\n\n- пункт 40\n\n`id-40`"} highlight={paint} />);
    expect([...container.querySelectorAll("mark[data-slot=hit]")].map((m) => m.parentElement?.tagName)).toEqual(["P", "STRONG", "LI", "CODE"]);
    expect(container.textContent).toBe("Решили через 40 минут, 40пункт 40id-40");
    // without a painter the text has no marks
    const plain = render(<RunningText text="через 40 минут" />);
    expect(plain.container.querySelector("mark")).toBeNull();
  });

  test("gap 7 (f15): a code span goes through the caller's `renderCode` — its own node for a span it takes, the link or the plain code for one it leaves", () => {
    const resolve = (t: string) => (t === "u3" ? "/r/tga/a5?view=units&unit=u3" : null);
    const renderCode = (body: string, code: ReactNode) =>
      body.startsWith("src/") ? (
        <button type="button" data-slot="place">
          {code}
        </button>
      ) : null;
    const { container } = render(<RunningText text={"`src/a.tsx:12`, `u3` и `ux 1`; src/a.tsx:12 в тексте."} resolve={resolve} renderCode={renderCode} />);
    const place = container.querySelector("[data-slot=place]") as HTMLElement;
    expect(place.querySelector("code")).toHaveTextContent(/^src\/a\.tsx:12$/);
    // a span the caller leaves keeps the renderer's own form: a link where the resolver knows it, plain code otherwise
    expect(within(container).getByRole("link", { name: "u3" }).querySelector("code")).not.toBeNull();
    expect([...container.querySelectorAll("code")].map((c) => c.textContent)).toEqual(["src/a.tsx:12", "u3", "ux 1"]);
    // the seam takes code spans only: the same words in running text stay text
    expect(container.querySelectorAll("[data-slot=place]")).toHaveLength(1);
    expect(container.textContent).toBe("src/a.tsx:12, u3 и ux 1; src/a.tsx:12 в тексте.");
  });
});

describe("running text", () => {
  test("paragraphs keep their line breaks; inline code and bold are marked", () => {
    const { container } = render(<RunningText text={SAMPLE} />);
    const first = container.querySelector("p")!;
    expect(first.querySelectorAll("br")).toHaveLength(1);
    expect(first.querySelector("code")).toHaveTextContent("launchErrorCause");
    expect(first.querySelector("strong")).toHaveTextContent("lastError");
    expect(first).toHaveTextContent("passes uncoded lastError through as is.Second line of the same paragraph.");
  });

  test("bullet and numbered lists are lists; a continuation line stays in its item, on its own line", () => {
    const { container } = render(<RunningText text={SAMPLE} />);
    const ul = container.querySelector("ul")!;
    const items = within(ul).getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent("first bulletcontinued under it");
    expect(items[0].querySelectorAll("br")).toHaveLength(1);
    expect(items[1].querySelector("code")).toHaveTextContent("code");
    const ol = container.querySelector("ol")!;
    expect(within(ol).getAllByRole("listitem").map((li) => li.textContent)).toEqual(["step one", "step two"]);
  });

  test("a markdown table sits in its own sideways-scrolling region", () => {
    render(<RunningText text={SAMPLE} />);
    const region = screen.getByRole("region", { name: "Таблица" });
    expect(region).toHaveClass("overflow-x-auto", "max-w-full");
    expect(region).toHaveAttribute("tabindex", "0");
    expect(within(region).getAllByRole("columnheader").map((th) => th.textContent)).toEqual(["col", "value"]);
    expect(within(region).getAllByRole("cell")[0]).toHaveTextContent("a | b");
  });

  test("ids become links only through the resolver", () => {
    const resolve = (token: string) =>
      token === "u3" ? "?view=units&unit=u3" : token === "p1-review-critic-craft#craft-4" ? "?view=findings&finding=p1-review-critic-craft%23craft-4" : null;
    const { rerender } = render(<RunningText text={SAMPLE} resolve={resolve} />);
    expect(screen.getByRole("link", { name: "u3" })).toHaveAttribute("href", "?view=units&unit=u3");
    expect(screen.getByRole("link", { name: "p1-review-critic-craft#craft-4" })).toBeInTheDocument();
    expect(screen.getAllByRole("link")).toHaveLength(2);
    rerender(<RunningText text={SAMPLE} />);
    expect(screen.queryAllByRole("link")).toHaveLength(0);
  });

  test("raw HTML in the text is shown as text", () => {
    const { container } = render(<RunningText text={'<script>alert(1)</script> <img src=x onerror="alert(2)"> <b>bold</b>'} />);
    expect(container.querySelector("script, img, b")).toBeNull();
    expect(container).toHaveTextContent('<script>alert(1)</script> <img src=x onerror="alert(2)"> <b>bold</b>');
  });

  test("headings and fenced code keep their form; the code scrolls sideways", () => {
    const blocks = parseBlocks("## RESULT\ndone\n```\nnpm test\n```\n### Notes");
    expect(blocks.map((b) => b.kind)).toEqual(["h", "p", "code", "h"]);
    const { container } = render(<RunningText text={"## RESULT\n```\nnpm test\n```"} />);
    expect(container.querySelector("h3")).toHaveTextContent("RESULT");
    expect(container.querySelector("pre")).toHaveClass("overflow-x-auto");
  });

  test("a finding of 1 920 characters and a goal of 8 617 characters over 50 lines render whole at the reading measure", () => {
    const finding = longText(1920);
    const goal = longText(8617, 50, "цель");
    const { container } = render(
      <>
        <RunningText text={finding} />
        <RunningText text={goal} />
      </>,
    );
    const [a, b] = container.querySelectorAll('[data-slot="running-text"]');
    expect(finding).toHaveLength(1920);
    expect(a.textContent).toBe(finding.trim());
    expect(a).toHaveClass("max-w-measure", "break-words");
    expect(b.querySelectorAll("br")).toHaveLength(49);
    expect(goal).toHaveLength(8617);
    expect(b.textContent).toBe(goal.split("\n").map((line) => line.trim()).join(""));
  });

  test("an empty or absent text renders nothing", () => {
    const { container } = render(<RunningText text={null} />);
    expect(container.querySelector('[data-slot="running-text"]')?.childElementCount).toBe(0);
  });
});

describe("p3-review-critic-craft-2#craft-14: a table wider than its box marks the edge it runs past", () => {
  const TABLE = ["| finding | prototype | kept as |", "|---|---|---|", "| gap 1 | the run card's settings | `RunCard.settings`, read from run.json |"].join("\n");

  test("an inset hairline at the box's right edge while the table runs past it (scrollWidth > clientWidth), hidden at the scroll's end; drawn over the box, it takes no room", async () => {
    let content = 900;
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockImplementation(function (this: HTMLElement) {
      return this.getAttribute("role") === "region" ? 600 : 0;
    });
    vi.spyOn(HTMLElement.prototype, "scrollWidth", "get").mockImplementation(function (this: HTMLElement) {
      return this.getAttribute("role") === "region" ? content : 0;
    });
    const { container, rerender } = render(<RunningText text={TABLE} />);
    const region = screen.getByRole("region", { name: "Таблица" });
    const cue = () => container.querySelector("[data-slot=overflow-cue]") as HTMLElement;
    await applyStylesheet();
    const s = getComputedStyle(cue());
    expect(s.visibility).toBe("visible");
    expect([s.position, s.top, s.right, s.bottom, s.left, s.pointerEvents]).toEqual(["absolute", "0px", "0px", "0px", "0px", "none"]);
    // one inset hairline at the right edge, in the muted ink (light #6d6d69, DESIGN.md → Colors) — the theme's shadow
    expect(s.boxShadow.replace(/rgba\(0, 0, 0, 0\) 0px 0px, /g, "")).toBe("rgb(109, 109, 105) -1px 0px inset");
    expect(cue()).toHaveAttribute("aria-hidden", "true");
    expect(getComputedStyle(cue().parentElement as HTMLElement).position).toBe("relative");
    expect(cue().parentElement).toContainElement(region);
    // scrolled to the end: nothing runs past the right edge any more
    region.scrollLeft = 300;
    fireEvent.scroll(region);
    await applyStylesheet();
    expect(getComputedStyle(cue()).visibility).toBe("hidden");
    region.scrollLeft = 0;
    fireEvent.scroll(region);
    await applyStylesheet();
    expect(getComputedStyle(cue()).visibility).toBe("visible");
    // a table that fits its box: no cue
    content = 600;
    rerender(<RunningText text={`${TABLE}\n`} />);
    await applyStylesheet();
    expect(getComputedStyle(cue()).visibility).toBe("hidden");
    vi.restoreAllMocks();
  });
});
