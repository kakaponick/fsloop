// @vitest-environment jsdom
// Done-criteria 0, 4 and 6: «Соглашения» over u1's handler on the fixture run of 26 conventions — grouped by
// design-check launch with a link to its report, each as written through the running-text renderer — and its
// empty states: before decompose, and past it with no design check.
import "../../ui/test-setup.ts";
import { screen, waitFor, within } from "@testing-library/react";
import { afterAll, describe, expect, test } from "vitest";
import { runPath } from "../../app/routes.ts";
import { fixtureApp, keyOf, loadedRun, renderOver, renderView } from "../reports/testing.tsx";
import { ConventionsView, DESIGN_CHECK, emptyFor, INTRO, leadText, NEVER_DESCRIPTION, NONE_WRITTEN } from "./index.tsx";

const N = 40;
const SMALL = 24;
const KEY = keyOf(N);
const fx = fixtureApp({ only: [N, SMALL] });
afterAll(() => fx.close());
const run = loadedRun(fx, N, KEY);
const items = () => [...document.querySelectorAll<HTMLElement>("[data-slot=convention-list] > li")];
const bar = () => document.querySelector("[data-slot=status-bar]") as HTMLElement;

describe("«Соглашения»", () => {
  test("26 conventions grouped by design-check launch, each heading a link to its report, each convention as written", async () => {
    renderView(fx, KEY, runPath(KEY, { view: "conventions" }), ConventionsView);
    await waitFor(() => expect(items()).toHaveLength(26), { timeout: 4000 });
    expect(screen.getByText(/одно решение на задачу/)).toHaveTextContent(INTRO.replace(/`/g, ""));
    const groups = [...document.querySelectorAll<HTMLElement>("section[data-launch]")];
    expect(groups.map((g) => g.dataset.launch)).toEqual(["p1-decompose-design-check", "p2-decompose-design-check"]);
    expect(within(groups[0]).getByRole("link", { name: `${DESIGN_CHECK}, проход 1` })).toHaveAttribute("href", runPath(KEY, { view: "reports", report: "p1-decompose-design-check" }));
    expect(groups[0]).toHaveTextContent("26 соглашений");
    expect(items().map((li) => li.textContent)).toEqual(run.conventions.map((c) => c.text.replace(/`/g, "")));
    // the pattern leads, in bold; the rest as written, code in mono
    expect(items()[0].querySelector("strong")).toHaveTextContent("Pattern 1");
    expect(items()[0].querySelector("code")).toHaveTextContent("ux 1");
    expect(leadText({ text: "a — b", pattern: null })).toBe("a — b");
    // the second check wrote none, and says so
    expect(groups[1]).toHaveTextContent("0 соглашений");
    expect(groups[1]).toHaveTextContent(NONE_WRITTEN);
    expect(bar()).toHaveTextContent("26 соглашений");
    expect(document.querySelector("[data-slot=conventions-scroll]")).toHaveClass("[scrollbar-gutter:stable]");
    expect(bar()).toHaveClass("h-8", "shrink-0");
  });

  test("the median run: 11 conventions of one check", () => {
    renderOver(fx, { ...run, conventions: run.conventions.slice(0, 11) }, runPath(KEY, { view: "conventions" }), ConventionsView);
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
