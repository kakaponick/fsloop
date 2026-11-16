// @vitest-environment jsdom
// p2-assess-critic-improve#improve-1 (1): one finding, read the same in every host — the article's fact line gives
// every fact its label («этап проход 1 · карта» beside «отчёт» and «место»), and each «·» ends the fact before it, so
// a wrapped line never opens with «·» — in «Находки» at 900 px and 1440 px, under a unit, in a report.
import "../ui/test-setup.ts";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterAll, describe, expect, test } from "vitest";
import type { Finding } from "../../shared/model.ts";
import { readRun } from "../../server/run.ts";
import { applyStylesheet, contentWidth } from "../app/layout-testing.ts";
import { fixtureApp, keyOf, NOW } from "../app/testing.tsx";
import { UiProvider } from "../ui/provider.tsx";
import { FindingArticle } from "./article.tsx";
import { FACT } from "./words.ts";

const N = 40;
const fx = fixtureApp({ only: [N] });
afterAll(() => fx.close());
const run = { ...readRun(fx.dirOf(N)), key: keyOf(N) };
const critic = run.findings.find((f) => f.launch && f.source !== "own") as Finding;
/** The widest real fact line: both enums, a report whose name carries no stage, a stage with its pass, a place
 * (p2-final-findings-narrow.png's craft-1). */
const finding: Finding = { ...critic, launchName: "craft · accounts", confidence: "med", cause: "component", stage: "p1-map", location: "src/web/accounts/page.tsx:17" };

const show = (f: Finding = finding, report?: string) =>
  render(
    <MemoryRouter>
      <UiProvider>
        <FindingArticle run={run} finding={f} now={NOW} inRow report={report} />
      </UiProvider>
    </MemoryRouter>,
  );

const facts = (container: HTMLElement) => [...(container.querySelector("[data-slot=finding-facts]") as HTMLElement).children] as HTMLElement[];
/** A fact's own words, without the «·» that ends it. */
const own = (el: HTMLElement) => [...el.childNodes].filter((n) => !(n instanceof HTMLElement && n.dataset.slot === "fact-sep")).map((n) => n.textContent).join("");
const words = (s: string) => s.split(" ").length;

describe("p2-assess-critic-improve#improve-1 (1): the fact line", () => {
  test("every fact with its label: the critic's two enums read as phrases that name it, then «отчёт», «этап», «место»", () => {
    const { container } = show();
    const texts = facts(container).map(own);
    expect(texts).toEqual(["критик скорее уверен", "правка в общем компоненте", "отчёт «craft · accounts»", "этап проход 1 · карта", "место src/web/accounts/page.tsx:17"]);
    expect(texts.map(words)).toEqual([3, 4, 4, 5, 2]);
    expect(FACT.stage).toBe("этап");
  });

  describe("p3-review-critic-craft-2#craft-1: where each fact ends — the report's name set off in quotes, each fact once", () => {
    test("the report's name in «», its link inside them: its own «·» never reads as the line's", () => {
      const { container } = show();
      const report = facts(container)[2];
      const link = report.querySelector("a") as HTMLElement;
      expect(link).toHaveTextContent(/^craft · accounts$/);
      expect(link.previousSibling?.textContent).toMatch(/«$/);
      expect(link.nextSibling?.textContent).toBe("»");
    });

    test("a name that carries the pass leaves the stage its word: «отчёт «design · check · проход 2» · этап декомпозиция» (units)", () => {
      const { container } = show({ ...finding, launchName: "design · check · проход 2", stage: "p2-decompose" });
      const texts = facts(container).map(own);
      expect(texts.slice(2)).toEqual(["отчёт «design · check · проход 2»", "этап декомпозиция", "место src/web/accounts/page.tsx:17"]);
      expect(texts.slice(2).map(words)).toEqual([7, 2, 2]);
      // «проход 2» once on the line
      expect(texts.join(" ").match(/проход 2/g)).toHaveLength(1);
    });

    test("a name that carries the whole stage leaves «этап» out: «отчёт «craft · проход 1 · ревью»»", () => {
      const { container } = show({ ...finding, launchName: "craft · проход 1 · ревью", stage: "p1-review" });
      expect(facts(container).map(own).slice(2)).toEqual(["отчёт «craft · проход 1 · ревью»", "место src/web/accounts/page.tsx:17"]);
    });

    test("inside the report it names, «отчёт» is left out — a link to the page the user is on carries nothing (reports)", () => {
      const host = { ...finding, launchName: "craft · проход 1 · ревью", stage: "p1-review" };
      const { container } = show(host, host.launch as string);
      const texts = facts(container).map(own);
      expect(texts).toEqual(["критик скорее уверен", "правка в общем компоненте", "место src/web/accounts/page.tsx:17"]);
      expect(texts.map(words)).toEqual([3, 4, 2]);
      expect((container.querySelector("[data-slot=finding-facts]") as HTMLElement).querySelector("a")).toBeNull();
      // another report's finding inside that reader keeps its report
      const { container: other } = show(finding, "p9-review-critic-code");
      expect(facts(other).map(own)[2]).toBe("отчёт «craft · accounts»");
    });
  });

  test("a stage the record lacks keeps its label: «этап не записано»", () => {
    const { container } = show({ ...finding, stage: "" });
    expect(facts(container).map(own)[3]).toBe("этап не записано");
  });

  test("each «·» ends the fact before it, inside that fact's unbreakable box; the last fact has none", () => {
    const { container } = show();
    const all = facts(container);
    for (const el of all.slice(0, -1)) {
      expect(el.lastElementChild).toHaveAttribute("data-slot", "fact-sep");
      expect(el.lastElementChild).toHaveAttribute("aria-hidden", "true");
      expect(el.firstElementChild).not.toHaveAttribute("data-slot", "fact-sep");
    }
    expect(all.at(-1)?.querySelector("[data-slot=fact-sep]")).toBeNull();
  });

  test("no wrapped line opens with «·» — at 900 px and 1440 px and every host width between, by the product's stylesheet", async () => {
    const { container } = show();
    await applyStylesheet();
    const line = container.querySelector("[data-slot=finding-facts]") as HTMLElement;
    const s = getComputedStyle(line);
    expect(s.flexWrap).toBe("wrap");
    const gap = Number.parseFloat(s.columnGap);
    const items = facts(container);
    // a fact never breaks inside: a flex row that does not wrap
    for (const el of items) expect(getComputedStyle(el).flexWrap).toBe("nowrap");
    const widths = items.map((el) => contentWidth(el));
    /** The lines a wrapping flex row makes of its items in `width` px (Flexbox §9.3: an item goes to the next line when
     * it does not fit beside the ones before it). */
    const lines = (width: number) => {
      const out: number[][] = [[]];
      let used = 0;
      widths.forEach((w, i) => {
        const cur = out[out.length - 1];
        if (cur.length && used + gap + w > width) {
          out.push([i]);
          used = w;
        } else {
          cur.push(i);
          used += (cur.length > 1 ? gap : 0) + w;
        }
      });
      return out;
    };
    // the fact line's width in its hosts: «Находки» at 900 px (p2-final-findings-narrow.png wraps before «место»), at
    // 1440 px beside the sidebar, a report's reader and a unit's detail between them
    const HOSTS = { findings900: 830, unit1440: 960, findings1440: 1050 };
    expect(lines(HOSTS.findings900).length).toBeGreaterThan(1);
    for (let width = 280; width <= 1440; width += 4)
      for (const l of lines(width)) expect(items[l[0]].textContent?.startsWith("·"), `${width} px`).toBe(false);
    for (const width of Object.values(HOSTS)) for (const l of lines(width).slice(1)) expect(own(items[l[0]]).length).toBeGreaterThan(0);
  });

  test("p3-decompose-design-check#design-19: the decision's units are a list that says so — `role=\"list\"` on its `list-none`", () => {
    const withUnit = run.findings.find((f) => f.units.length > 0) as Finding;
    const { container } = show(withUnit);
    const ul = container.querySelector("[data-slot=finding-article] ul") as HTMLElement;
    expect(ul).toHaveClass("list-none");
    expect(ul).toHaveAttribute("role", "list");
  });
});
