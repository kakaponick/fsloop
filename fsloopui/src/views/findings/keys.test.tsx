// @vitest-environment jsdom
// The reading pace of «Находки» (pass 2, f12): keys 1–4 set the verdict of the finding in focus and move on to the
// next one without a verdict (craft-review cand-4); «Свернуть все» closes every open detail from the toolbar's right
// cluster, its box held whether or not a row is open (u4-shape cand-1; rules/ui → Strict 1).
import "../../ui/test-setup.ts";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterAll, afterEach, describe, expect, test } from "vitest";
import { criticReport, lines } from "../../../fixtures/make.ts";
import { VERDICT } from "../../../shared/states.ts";
import { readRun } from "../../../server/run.ts";
import { applyStylesheet, usedBlockSize } from "../../app/layout-testing.ts";
import { runPath } from "../../app/routes.ts";
import { writePref } from "@/ui";
import { runKey as viewKey, tableKey } from "@/table/view-state.ts";
import { FINDINGS_TABLE } from "@/finding/facets.ts";
import { findingsApp, keyOf, MIN, NOW, renderFindings } from "./testing.tsx";
import { ALL_RATED, VERDICT_KEYS } from "./verdict.tsx";

// The live fixture run of verdict.test.tsx, in a root of its own: 18 findings, one page.
const N = 24;
const KEY = keyOf(N);
const app = findingsApp([N]);
app.fx.write(N, "reports/p1-map-craft-schedules.md", criticReport({ lens: "craft assess", findings: Array.from({ length: 14 }, (_, k) => lines.craft(k + 1, "schedules", null)) }), NOW - MIN);
const TOTAL = readRun(app.fx.dirOf(N)).findings.length;
afterAll(() => app.close());

const bodyRows = () => [...document.querySelectorAll<HTMLTableRowElement>("tr[data-row-id]")];
const ids = () => bodyRows().map((r) => r.dataset.rowId as string);
const row = (id: string) => bodyRows().find((r) => r.dataset.rowId === id) as HTMLTableRowElement;
const detail = (id: string) => [...document.querySelectorAll<HTMLElement>("tr[data-detail-for]")].find((r) => r.dataset.detailFor === id);
const openIds = () => [...document.querySelectorAll<HTMLElement>("tr[data-detail-for]")].map((r) => r.dataset.detailFor);
const loaded = () => waitFor(() => expect(bodyRows()).toHaveLength(TOTAL), { timeout: 4000 });
const verdictCell = (id: string) => row(id).querySelector("td[data-col=verdict]") as HTMLElement;
const sentFor = (id: string) => app.sent.filter((b) => b.findings.includes(id));

describe("cand-1 (u4-shape), p2 craft-4: «Свернуть все»", () => {
  // the button's box, its blocked state and its reason are the kit's, tested there (src/table/data-table.test.tsx);
  // the view's part is the wiring: its noun in the label, the place in the toolbar's right cluster, the collapse
  test("p3-review-critic-code#code-17: the toolbar's right cluster holds the kit's «Свернуть все находки»; it closes every open detail and drops `finding=`", async () => {
    const user = userEvent.setup({ delay: null });
    const view = renderFindings(app, KEY, runPath(KEY, { view: "findings" }));
    await loaded();
    const item = view.container.querySelector("[data-toolbar-item=facts]") as HTMLElement;
    const button = within(item).getByRole("button", { name: "Свернуть все находки" });
    const [a, b] = ["p1-map-craft-schedules#craft-6", "p1-map-craft-schedules#craft-12"];
    await user.click(row(a).querySelector("td[data-col=summary]") as HTMLElement);
    await user.click(row(b).querySelector("td[data-col=summary]") as HTMLElement);
    expect(openIds()).toEqual([a, b]);
    await waitFor(() => expect(new URLSearchParams(view.probe.location?.search).get("finding")).toBe(b));
    await user.click(button);
    expect(openIds()).toEqual([]);
    await waitFor(() => expect(new URLSearchParams(view.probe.location?.search).get("finding")).toBeNull());
    view.unmount();
  });
});

describe("cand-4 (craft review): verdict keys", () => {
  test("1–4 rate the finding in focus at once and move to the next one without a verdict; an open detail moves with it", async () => {
    const user = userEvent.setup({ delay: null });
    const view = renderFindings(app, KEY, runPath(KEY, { view: "findings" }));
    await loaded();
    expect(VERDICT_KEYS).toEqual(["Digit1", "Digit2", "Digit3", "Digit4"]);
    const [a, b, c, d] = ids();

    // a collapsed row: «4» rates it, focus goes to the next row
    row(b).focus();
    await user.keyboard("4");
    expect(verdictCell(b)).toHaveTextContent("ложная находка");
    await waitFor(() => expect(sentFor(b)).toEqual([{ run: KEY, findings: [b], verdict: "false-positive", note: null }]));
    expect(document.activeElement).toBe(row(c));

    // the next one without a verdict: «2» on the first row skips the row rated just now
    row(a).focus();
    await user.keyboard("2");
    expect(verdictCell(a)).toHaveTextContent("не согласен");
    expect(document.activeElement).toBe(row(c));

    // an open row: rated by its key, it closes and the next one without a verdict opens in its place
    await user.click(row(c).querySelector("td[data-col=summary]") as HTMLElement);
    expect(openIds()).toEqual([c]);
    expect(document.activeElement).toBe(row(c));
    await user.keyboard("1");
    expect(verdictCell(c)).toHaveTextContent("согласен");
    expect(openIds()).toEqual([d]);
    expect(document.activeElement).toBe(row(d));
    await waitFor(() => expect(new URLSearchParams(view.probe.location?.search).get("finding")).toBe(d));

    // focus inside the detail rates its finding; in the note a digit is text
    const toggle = within(detail(d) as HTMLElement).getByRole("radio", { name: "не та серьёзность" });
    fireEvent.focus(toggle);
    expect(await screen.findByRole("tooltip")).toHaveTextContent(/^Оценить клавишей3$/);    const note = within(detail(d) as HTMLElement).getByLabelText("Заметка к оценке");
    await user.click(note);
    await user.keyboard("3");
    expect(note).toHaveValue("3");
    expect(sentFor(d)).toEqual([]);
    view.unmount();
  });
});

/** A row the user has not rated: its «Оценка» cell holds no verdict word. */
const unrated = (id: string) => !Object.values(VERDICT).some((v) => verdictCell(id).textContent?.includes(v.compact));
const pager = () => screen.getByRole("navigation", { name: "Страницы" });
const pageParam = (view: ReturnType<typeof renderFindings>) => new URLSearchParams(view.probe.location?.search).get("page");
/** The fixture's 18 findings five a page, in the table's default order — by severity (`lines.craft`'s `sevOf`), then
 * in the reports' order: the map's 14 of «schedules» this file writes, the 4 of «dialogs» the fixture holds. */
const PAGES = [
  ["p1-map-craft-schedules#craft-6", "p1-map-craft-schedules#craft-12", "p1-map-craft-schedules#craft-1", "p1-map-craft-schedules#craft-2", "p1-map-craft-schedules#craft-7"],
  ["p1-map-craft-schedules#craft-8", "p1-map-craft-schedules#craft-13", "p1-map-craft-schedules#craft-14", "p1-map-craft-dialogs#craft-1", "p1-map-craft-dialogs#craft-2"],
  ["p1-map-craft-dialogs#craft-3", "p1-map-craft-schedules#craft-3", "p1-map-craft-schedules#craft-4", "p1-map-craft-schedules#craft-5", "p1-map-craft-schedules#craft-9"],
  ["p1-map-craft-schedules#craft-10", "p1-map-craft-schedules#craft-11", "p1-map-craft-dialogs#cand-1"],
];

describe("p3-review-critic-craft#craft-6: keys 1–4 with focus in the view on no finding", () => {
  test("rate the table's current row — its Tab stop — and go on from it as from the row: from the toolbar, from the status bar", async () => {
    const user = userEvent.setup({ delay: null });
    const view = renderFindings(app, KEY, runPath(KEY, { view: "findings" }));
    await loaded();
    const [x, y, z] = ["p1-map-craft-schedules#craft-14", "p1-map-craft-dialogs#craft-1", "p1-map-craft-dialogs#craft-2"];
    expect([x, y, z].every(unrated)).toBe(true);
    // the row the user was on is the table's Tab stop
    row(x).focus();
    await waitFor(() => expect(row(x)).toHaveAttribute("tabindex", "0"));

    // on the toolbar's «Свернуть все находки»: «1» rates that row, and focus goes on to the next one without a verdict
    view.getByRole("button", { name: "Свернуть все находки" }).focus();
    await user.keyboard("1");
    expect(verdictCell(x)).toHaveTextContent("согласен");
    expect(document.activeElement).toBe(row(y));
    await waitFor(() => expect(sentFor(x)).toEqual([{ run: KEY, findings: [x], verdict: "agree", note: null }]));

    // on the status bar's pager: «4» rates the row focus went to, and goes on
    within(pager()).getAllByRole("button")[0].focus();
    await user.keyboard("4");
    expect(verdictCell(y)).toHaveTextContent("ложная находка");
    expect(document.activeElement).toBe(row(z));
    await waitFor(() => expect(sentFor(y)).toEqual([{ run: KEY, findings: [y], verdict: "false-positive", note: null }]));
    view.unmount();
  });
});

describe("p2-assess-critic-improve#improve-14: rating keeps its pace", () => {
  afterEach(() => {
    writePref(tableKey(FINDINGS_TABLE), null);
    writePref(viewKey(FINDINGS_TABLE, KEY), null);
  });

  test("on a page's last unrated row a key 1–4 turns the page and focuses the next page's first unrated row; an open detail moves with it", async () => {
    const user = userEvent.setup({ delay: null });
    // five rows a page: the run's 18 findings over four pages, in the table's default order (PAGES)
    writePref(tableKey(FINDINGS_TABLE), { pageSize: 5 });
    const view = renderFindings(app, KEY, runPath(KEY, { view: "findings" }));
    await waitFor(() => expect(bodyRows()).toHaveLength(5), { timeout: 4000 });
    expect(pager()).toHaveTextContent(/^стр\. 1 из 4$/);
    expect(ids()).toEqual(PAGES[0]);
    const last = "p1-map-craft-schedules#craft-7";
    expect(unrated(last)).toBe(true);

    // the last row of page 1: «2» rates it, the page turns, focus is on page 2's first row without a verdict
    row(last).focus();
    await user.keyboard("2");
    await waitFor(() => expect(pager()).toHaveTextContent(/^стр\. 2 из/));
    expect(pageParam(view)).toBe("2");
    expect(ids()).toEqual(PAGES[1]);
    const firstUnrated = "p1-map-craft-schedules#craft-8";
    await waitFor(() => expect(document.activeElement).toBe(row(firstUnrated)));
    await waitFor(() => expect(sentFor(last)).toEqual([{ run: KEY, findings: [last], verdict: "disagree", note: null }]));

    // page 2's last row, open: rated by its key, page 3 opens with its first unrated row open in its place
    const end = "p1-map-craft-dialogs#craft-2";
    await user.click(row(end).querySelector("td[data-col=summary]") as HTMLElement);
    expect(openIds()).toEqual([end]);
    await user.keyboard("1");
    await waitFor(() => expect(pager()).toHaveTextContent(/^стр\. 3 из/));
    expect(ids()).toEqual(PAGES[2]);
    const next = "p1-map-craft-dialogs#craft-3";
    await waitFor(() => expect(openIds()).toEqual([next]));
    expect(document.activeElement).toBe(row(next));
    await waitFor(() => expect(new URLSearchParams(view.probe.location?.search).get("finding")).toBe(next));
    expect(pageParam(view)).toBe("3");
    // the keys write the verdict alone (j40): one body per rating, nothing beside it
    await waitFor(() => expect(sentFor(end)).toEqual([{ run: KEY, findings: [end], verdict: "agree", note: null }]));
    view.unmount();
  });

  test("p3-review-critic-craft#craft-4: with none left in the filter the rated finding's verdict line keeps its value and time and adds « · в этом списке всё оценено», on its reserved line", async () => {
    const user = userEvent.setup({ delay: null });
    expect(ALL_RATED).toBe("в этом списке всё оценено");
    expect(ALL_RATED.split(" ")).toHaveLength(5);
    const view = renderFindings(app, KEY, runPath(KEY, { view: "findings" }));
    await loaded();
    // two unrated findings whose ids no other id contains: a search for both keeps exactly them (table #12)
    const [x, y] = ["p1-map-craft-schedules#craft-2", "p1-map-craft-schedules#craft-8"];
    expect([x, y].every(unrated)).toBe(true);
    writePref(viewKey(FINDINGS_TABLE, KEY), { filters: {}, search: `${x} ${y}` });
    await waitFor(() => expect(ids()).toEqual([x, y]));

    // the first moves on to the second
    row(x).focus();
    await user.keyboard("1");
    expect(document.activeElement).toBe(row(y));
    expect(openIds()).toEqual([]);

    // the second is the last one without a verdict in the filter: its detail opens and its line says so
    const sent = sentFor(y).length;
    await user.keyboard("3");
    await waitFor(() => expect(openIds()).toEqual([y]));
    const line = (detail(y) as HTMLElement).querySelector("[data-slot=verdict-line]") as HTMLElement;
    // the saved value and its time stay first: a cut of the truncating line takes only the list's words
    await waitFor(() => expect(line).toHaveTextContent(/^не та серьёзность · 19:41 МСК · в этом списке всё оценено$/));
    expect(line).toHaveAttribute("title", "не та серьёзность · 19:41 МСК · в этом списке всё оценено");
    expect(document.activeElement).toBe(row(y));
    // the line it takes is the one the saved verdict has: no shift (Strict 1)
    await applyStylesheet();
    expect(usedBlockSize(line)).toBe(20);
    await waitFor(() => expect(sentFor(y).slice(sent)).toEqual([{ run: KEY, findings: [y], verdict: "wrong-severity", note: null }]));

    // a choice in the detail saves again, and the line reads the saved verdict once more
    await user.click(within(detail(y) as HTMLElement).getByRole("radio", { name: "согласен" }));
    await waitFor(() => expect(line).toHaveTextContent(/^согласен · /));
    view.unmount();
  });

  test("p3-review-critic-code#code-27: past the last page the walk goes on from the first, skips a page with none left, and stops on the page it started on", async () => {
    const user = userEvent.setup({ delay: null });
    // seven findings no other case rates, over two pages of five (a search for their ids keeps exactly them)
    const one = ["p1-map-craft-schedules#craft-13", "p1-map-craft-dialogs#craft-3", "p1-map-craft-schedules#craft-3", "p1-map-craft-schedules#craft-4", "p1-map-craft-schedules#craft-5"];
    const two = ["p1-map-craft-schedules#craft-9", "p1-map-craft-schedules#craft-10"];
    writePref(tableKey(FINDINGS_TABLE), { pageSize: 5 });
    writePref(viewKey(FINDINGS_TABLE, KEY), { filters: {}, search: [...one, ...two].join(" ") });
    const view = renderFindings(app, KEY, runPath(KEY, { view: "findings" }));
    await waitFor(() => expect(ids()).toEqual(one), { timeout: 4000 });
    expect(pager()).toHaveTextContent(/^стр\. 1 из 2$/);
    expect(one.every(unrated)).toBe(true);

    // «1» five times from page 1's first row rates the page; the fifth turns to page 2's first row
    row(one[0]).focus();
    await user.keyboard("11111");
    await waitFor(() => expect(document.activeElement).toBe(row(two[0])));
    expect(pageParam(view)).toBe("2");

    // page 2's last row: «4» rates it; past the last page the walk goes on from page 1, finds none there, and stops on
    // page 2, where it started, on the row before the rated one
    row(two[1]).focus();
    await user.keyboard("4");
    await waitFor(() => expect(document.activeElement).toBe(row(two[0])));
    expect(pager()).toHaveTextContent(/^стр\. 2 из 2$/);
    expect(pageParam(view)).toBe("2");
    expect(verdictCell(two[1])).toHaveTextContent("ложная находка");
    await waitFor(() => expect(sentFor(two[1])).toEqual([{ run: KEY, findings: [two[1]], verdict: "false-positive", note: null }]));
    view.unmount();
  });
});
