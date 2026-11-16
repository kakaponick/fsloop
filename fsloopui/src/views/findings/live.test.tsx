// @vitest-environment jsdom
// Done-criterion 3 (rules/ui → Live data 2–3, Conventions 9): a live run over u1's handler — a changed finding
// updates in place with the edge mark; new findings wait in the strip; a row a live change or the user's own
// verdict takes out of the filter stays where it was, «вне фильтра».
import "../../ui/test-setup.ts";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterAll, describe, expect, test } from "vitest";
import { criticReport, lines } from "../../../fixtures/make.ts";
import { readRun } from "../../../server/run.ts";
import { openFindings } from "@/finding";
import { FINDINGS_TABLE } from "@/finding/facets.ts";
import { runKey as viewKey } from "@/table/view-state.ts";
import { writePref } from "@/ui";
import { runPath } from "../../app/routes.ts";
import { findingsApp, keyOf, renderFindings } from "./testing.tsx";
import { ALL_RATED } from "./verdict.tsx";

const N = 24; // a live run: two craft critics of the map, one unit at work
const KEY = keyOf(N);
const app = findingsApp([N]);
afterAll(() => app.close());
const path = runPath(KEY, { view: "findings" });
const total = readRun(app.fx.dirOf(N)).findings.length;

const bodyRows = () => [...document.querySelectorAll<HTMLTableRowElement>("tr[data-row-id]")];
const ids = () => bodyRows().map((r) => r.dataset.rowId as string);
const row = (id: string) => bodyRows().find((r) => r.dataset.rowId === id) as HTMLTableRowElement;
const strip = () => document.querySelector("[data-slot=held-strip]") as HTMLElement;
const STATE = (id: string) => row(id).querySelector("td[data-col=state]") as HTMLElement;

/** The run decides a finding, as fsloop writes a row of findings/p1-map.md. */
function decide(id: string, decision: string) {
  const file = join(app.fx.dirOf(N), "findings", "p1-map.md");
  app.fx.write(N, "findings/p1-map.md", `${readFileSync(file, "utf8").trimEnd()}\n| ${id} | ${decision} | — | — | below the bar, listed in the report |\n`);
}

describe("live updates of «Находки»", () => {
  test("a changed finding updates in place with the edge mark; the order holds; the strip's line was there before", async () => {
    renderFindings(app, KEY, path);
    await waitFor(() => expect(bodyRows()).toHaveLength(total), { timeout: 4000 });
    expect(strip()).toBeInTheDocument();
    expect(strip()).toBeEmptyDOMElement();
    const id = "p1-map-craft-dialogs#craft-3";
    expect(STATE(id)).toHaveTextContent("без решения");
    expect(row(id)).not.toHaveAttribute("data-edge");
    const order = ids();
    decide(id, "candidate");
    await waitFor(() => expect(STATE(id)).toHaveTextContent("кандидат"), { timeout: 4000 });
    expect(row(id)).toHaveAttribute("data-edge");
    expect(row(id)).toHaveClass("shadow-edge");
    expect(ids()).toEqual(order);
  });

  test("new findings wait in the strip, «12 новых находок · показать», and are placed on click", async () => {
    const user = userEvent.setup({ delay: null });
    renderFindings(app, KEY, path);
    await waitFor(() => expect(bodyRows()).toHaveLength(total), { timeout: 4000 });
    const order = ids();
    const report = criticReport({ lens: "craft assess", audit: "«schedules» audit 10/20 · critique 29/40", findings: Array.from({ length: 14 }, (_, k) => lines.craft(k + 1, "schedules", k === 0 ? "p1-baseline-schedules-" : null)), candidates: [lines.candidate(1, "schedules")], order: ["schedules: /impeccable clarify, then polish"] });
    app.fx.write(N, "reports/p1-map-craft-schedules.md", report);
    await waitFor(() => expect(strip()).toHaveTextContent("12 новых находок · показать"), { timeout: 4000 });
    expect(ids()).toEqual(order);
    await user.click(within(strip()).getByRole("button", { name: /показать/ }));
    expect(bodyRows()).toHaveLength(total + 12);
    expect(strip()).toBeEmptyDOMElement();
  });

  test("a row a live change takes out of the filter stays, «вне фильтра», and the strip says «убрать»", async () => {
    openFindings(KEY, { state: ["undecided"] });
    renderFindings(app, KEY, path);
    const id = "p1-map-craft-schedules#craft-1";
    await waitFor(() => expect(row(id)).toBeTruthy(), { timeout: 4000 });
    const order = ids();
    decide(id, "candidate");
    await waitFor(() => expect(STATE(id)).toHaveTextContent("кандидат"), { timeout: 4000 });
    expect(ids()).toEqual(order);
    expect(within(row(id)).getByText("вне фильтра")).toBeInTheDocument();
    expect(strip()).toHaveTextContent("1 находка вне фильтра · убрать");
  });

  test("the user's own verdict shows at once; a row it takes out of «Без оценки» stays, «вне фильтра»", async () => {
    const user = userEvent.setup({ delay: null });
    openFindings(KEY, { verdict: ["none"] });
    renderFindings(app, KEY, path);
    await waitFor(() => expect(bodyRows().length).toBeGreaterThan(2), { timeout: 4000 });
    expect(screen.getByRole("combobox", { name: "Вид" })).toHaveTextContent(/^Вид:Без оценки/);
    const order = ids();
    const id = order[1];
    await user.click(row(id).querySelector("td[data-col=summary]") as HTMLElement);
    await user.click(screen.getByRole("radio", { name: "согласен" }));
    expect(row(id).querySelector("td[data-col=verdict]")).toHaveTextContent("согласен");
    expect(ids()).toEqual(order);
    expect(within(row(id)).getByText("вне фильтра")).toBeInTheDocument();
    await waitFor(() => expect(app.human(N).some((l) => l.finding === id && l.verdict === "agree")).toBe(true));
    expect(ids()).toEqual(order);
  });

  test("p3-review-critic-code#code-1: «none left» counts the findings the table shows — a new one held behind «N новых · показать» is not left; key 1 on the last one shown stops with «В этом списке всё оценено»", async () => {
    const user = userEvent.setup({ delay: null });
    writePref(viewKey(FINDINGS_TABLE, KEY), { filters: {}, search: "" });
    renderFindings(app, KEY, path);
    await waitFor(() => expect(bodyRows().length).toBeGreaterThan(2), { timeout: 4000 });
    // one finding without a verdict whose id no other id holds, and a search that keeps it and the next report's
    const rated = new Set(app.human(N).map((l) => l.finding));
    const all = ids();
    const x = all.find((id) => !rated.has(id) && all.filter((o) => o.includes(id)).length === 1) as string;
    writePref(viewKey(FINDINGS_TABLE, KEY), { filters: {}, search: `${x} zebra` });
    await waitFor(() => expect(ids()).toEqual([x]));
    // a critic's report grows by two findings on «zebra», which the search keeps: they wait in the strip, unshown
    const schedules = Array.from({ length: 14 }, (_, k) => lines.craft(k + 1, "schedules", k === 0 ? "p1-baseline-schedules-" : null));
    const grown = criticReport({ lens: "craft assess", audit: "«schedules» audit 10/20 · critique 29/40", findings: [...schedules, lines.craft(15, "zebra", null), lines.craft(16, "zebra", null)], candidates: [lines.candidate(1, "schedules")], order: ["schedules: /impeccable clarify, then polish"] });
    app.fx.write(N, "reports/p1-map-craft-schedules.md", grown);
    await waitFor(() => expect(strip()).toHaveTextContent(/новы.* находк.* · показать/), { timeout: 4000 });
    expect(ids()).toEqual([x]);
    row(x).focus();
    await user.keyboard("1");
    await waitFor(() => expect(document.querySelector(`tr[data-detail-for="${x}"] [data-slot=verdict-line]`)).toHaveTextContent(new RegExp(`^${ALL_RATED}$`)));
    expect(ids()).toEqual([x]);
  });
});
