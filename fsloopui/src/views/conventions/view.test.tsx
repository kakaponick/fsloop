// @vitest-environment jsdom
// Done-criteria 0, 4 and 6: «Соглашения» over u1's handler on the fixture run of 26 conventions — grouped by
// design-check launch with a link to its report, each convention split into its pattern, its solution, its example
// (mono, copied by a click) and its rule — and its empty states: before decompose, and past it with no design check;
// a report or a run folder that cannot be read fails in its own place (f7: craft-14, craft-15, craft-16).
import "../../ui/test-setup.ts";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterAll, describe, expect, test, vi } from "vitest";
import type { Convention } from "../../../shared/model.ts";
import { runPath } from "../../app/routes.ts";
import { fixtureApp, keyOf, loadedRun, renderOver, renderView } from "../reports/testing.tsx";
import { ConventionsView, DESIGN_CHECK, emptyFor, examplesOf, INTRO, LABELS, NEVER_DESCRIPTION, NONE_WRITTEN, partsOf } from "./index.tsx";

const N = 40;
const SMALL = 24;
const KEY = keyOf(N);
const fx = fixtureApp({ only: [N, SMALL] });
afterAll(() => fx.close());
const run = loadedRun(fx, N, KEY);
const items = () => [...document.querySelectorAll<HTMLElement>("[data-slot=convention-list] > li")];
const bar = () => document.querySelector("[data-slot=status-bar]") as HTMLElement;
/** The value a convention's fact list gives a label: the `dd` after its `dt`. */
const fact = (li: HTMLElement, label: string) => [...li.querySelectorAll("dt")].find((dt) => dt.textContent === label)?.nextElementSibling as HTMLElement | undefined;
const PATH = runPath(KEY, { view: "conventions" });

describe("«Соглашения»", () => {
  test("26 conventions grouped by design-check launch, each heading a link to its report", async () => {
    renderView(fx, KEY, PATH, ConventionsView);
    await waitFor(() => expect(items()).toHaveLength(26), { timeout: 4000 });
    expect(screen.getByText(/одно решение на задачу/)).toHaveTextContent(INTRO.replace(/`/g, ""));
    const groups = [...document.querySelectorAll<HTMLElement>("section[data-launch]")];
    expect(groups.map((g) => g.dataset.launch)).toEqual(["p1-decompose-design-check", "p2-decompose-design-check"]);
    expect(within(groups[0]).getByRole("link", { name: `${DESIGN_CHECK}, проход 1` })).toHaveAttribute("href", runPath(KEY, { view: "reports", report: "p1-decompose-design-check" }));
    // craft-16: the group heading is the Title role — `text-base` is 14 px in this theme (styles/index.css)
    expect(within(groups[0]).getByRole("heading", { level: 2 })).toHaveClass("text-base", "font-semibold");
    expect(groups[0]).toHaveTextContent("26 соглашений");
    // the second check wrote none, and says so
    expect(groups[1]).toHaveTextContent("0 соглашений");
    expect(groups[1]).toHaveTextContent(NONE_WRITTEN);
    expect(bar()).toHaveTextContent("26 соглашений");
    expect(document.querySelector("[data-slot=conventions-scroll]")).toHaveClass("[scrollbar-gutter:stable]");
    expect(bar()).toHaveClass("h-8", "shrink-0");
  });

  test("craft-14: the pattern leads, the solution is the sentence, the example in mono, the rule in its row; no second number", async () => {
    renderView(fx, KEY, PATH, ConventionsView);
    await waitFor(() => expect(items()).toHaveLength(26), { timeout: 4000 });
    const first = items()[0];
    // the reading order: pattern, solution, then the example and the rule as labelled rows
    expect(first.querySelector("[data-slot=convention-pattern]")).toHaveTextContent(/^Pattern 1$/);
    expect(first.querySelector("[data-slot=convention-pattern]")).toHaveClass("font-semibold");
    expect(first.querySelector("[data-slot=convention-solution]")).toHaveTextContent(/^one solution for every brief$/);
    expect([...first.querySelectorAll("dt")].map((dt) => dt.textContent)).toEqual(["Пример", "Правило"]);
    const example = within(fact(first, LABELS.example) as HTMLElement).getByRole("button", { name: "Скопировать пример src/web/shared/part-1.tsx:3" });
    expect(example).toHaveClass("font-mono", "h-5");
    expect(example).toHaveTextContent(/^src\/web\/shared\/part-1\.tsx:3$/);
    expect(fact(first, LABELS.rule)).toHaveTextContent(/^ux 1, impeccable critique: Consistency and Standards$/);
    expect(fact(first, LABELS.rule)?.querySelector("code")).toHaveTextContent("ux 1");
    // the hanging label column from 40 rem of the view, one column below it
    expect(first.querySelector("dl")).toHaveClass("grid-cols-1", "@min-[40rem]/view:grid-cols-[5.5rem_minmax(0,1fr)]");
    // the list carries no visible number: «1. Pattern 1» was the number twice
    expect(document.querySelector("[data-slot=convention-list]")).toHaveClass("list-none");
    expect(first.textContent?.startsWith("Pattern 1")).toBe(true);
  });

  test("craft-14: the example is copied by a click, «Скопировано: пример»", async () => {
    const user = userEvent.setup({ delay: null });
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    renderOver(fx, run, PATH, ConventionsView);
    await user.click(within(items()[1]).getByRole("button", { name: "Скопировать пример src/web/shared/part-2.tsx:4" }));
    expect(writeText).toHaveBeenCalledWith("src/web/shared/part-2.tsx:4");
    expect(await screen.findByText("Скопировано: пример")).toBeInTheDocument();
  });

  test("craft-14: a real example names several places, each its own button; a line with no split keeps its text whole", () => {
    expect(examplesOf("`.claude/rules/ui.md:34`, `.claude/rules/ui.md:36`")).toEqual([".claude/rules/ui.md:34", ".claude/rules/ui.md:36"]);
    expect(examplesOf("units/u7/brief.md:20")).toEqual(["units/u7/brief.md:20"]);
    expect(examplesOf(null)).toEqual([]);
    const whole: Convention = { n: 1, text: "Stage words — one map in `shared/`", pattern: null, solution: null, example: null, rule: null, launch: "p1-decompose-design-check", stage: "p1-decompose" };
    expect(partsOf(whole)).toBeNull();
    const real: Convention = { ...whole, n: 2, text: "", pattern: "Owners of the shared parts", solution: "u1 `fsloopui/shared/`: every word", example: "`.claude/rules/ui.md:34`, `.claude/rules/ui.md:36`", rule: "`ui` → Existing component first" };
    renderOver(fx, { ...run, conventions: [whole, real] }, PATH, ConventionsView);
    const [a, b] = items();
    expect(a).toHaveTextContent(/^Stage words — one map in shared\/$/);
    expect(a.querySelector("dl")).toBeNull();
    expect(within(b).getAllByRole("button").map((x) => x.textContent)).toEqual([".claude/rules/ui.md:34", ".claude/rules/ui.md:36"]);
    expect(fact(b, LABELS.rule)).toHaveTextContent("ui → Existing component first");
  });

  test("the median run: 11 conventions of one check", () => {
    renderOver(fx, { ...run, conventions: run.conventions.slice(0, 11) }, PATH, ConventionsView);
    expect(items()).toHaveLength(11);
    expect(bar()).toHaveTextContent("11 соглашений");
  });

  test("before decompose: «Соглашений ещё нет — они появятся на этапе «декомпозиция»»", () => {
    const small = loadedRun(fx, SMALL, keyOf(SMALL));
    const now = { stage: "p1-map", step: null, since: null, running: 0, redGate: null };
    expect(emptyFor({ closed: false, mode: "worktree", now })).toBe("not-yet");
    renderOver(fx, { ...small, now, conventions: [] }, runPath(keyOf(SMALL), { view: "conventions" }), ConventionsView);
    expect(screen.getByText("Соглашений ещё нет — они появятся на этапе «декомпозиция»")).toBeInTheDocument();
  });

  test("past decompose with no design check: «В этом прогоне не было проверки дизайна», and when it runs", () => {
    const small = loadedRun(fx, SMALL, keyOf(SMALL));
    expect(emptyFor({ closed: true, mode: "worktree", now: null })).toBe("never");
    expect(emptyFor({ closed: false, mode: "init", now: null })).toBe("never");
    renderOver(fx, { ...small, conventions: [] }, runPath(keyOf(SMALL), { view: "conventions" }), ConventionsView);
    expect(small.now?.stage).toBe("p1-review");
    expect(screen.getByText("В этом прогоне не было проверки дизайна")).toBeInTheDocument();
    expect(screen.getByText(NEVER_DESCRIPTION)).toBeInTheDocument();
    expect(NEVER_DESCRIPTION).toBe("Проверку дизайна прогон запускает на этапе «декомпозиция», когда интерфейс в этом проходе делают два юнита или больше.");
  });
});

describe("craft-15: a part that failed fails in its own place", () => {
  test("a design check whose report cannot be read: «Отчёт p1-decompose-design-check.md не прочитан: файла нет» in its group", () => {
    const launches = run.launches.map((l) => (l.id === "p1-decompose-design-check" ? { ...l, report: "reports/p1-decompose-design-check.md", reportMissing: true, sections: {} } : l));
    const errors = [...run.errors, { file: "reports/p1-decompose-design-check.md", cause: "файла нет" }];
    renderOver(fx, { ...run, launches, errors, conventions: run.conventions.filter((c) => c.launch !== "p1-decompose-design-check") }, PATH, ConventionsView);
    const group = document.querySelector<HTMLElement>("section[data-launch=p1-decompose-design-check]") as HTMLElement;
    expect(within(group).getByRole("alert")).toHaveTextContent("Отчёт p1-decompose-design-check.md не прочитан: файла нет");
    expect(group).not.toHaveTextContent(NONE_WRITTEN);
    expect(group).not.toHaveTextContent("0 соглашений");
  });

  test("a run folder that cannot be read with no run.json behind it: «Список соглашений не прочитан: …», never «не было»", () => {
    const small = loadedRun(fx, SMALL, keyOf(SMALL));
    const errors = [{ file: "папка прогона", cause: "EISDIR: illegal operation on a directory, read" }];
    renderOver(fx, { ...small, source: "live", launches: [], conventions: [], errors }, runPath(keyOf(SMALL), { view: "conventions" }), ConventionsView);
    expect(screen.getByRole("alert")).toHaveTextContent("Список соглашений не прочитан: EISDIR: illegal operation on a directory, read");
    expect(screen.queryByText("В этом прогоне не было проверки дизайна")).toBeNull();
  });
});
