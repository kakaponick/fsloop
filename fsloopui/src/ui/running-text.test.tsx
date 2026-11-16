// @vitest-environment jsdom
import "./test-setup.ts";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, test } from "vitest";
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
