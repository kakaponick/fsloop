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
import { COLLAPSE_BLOCKED } from "./index.tsx";
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
  test("always shown in its 28 px box; blocked with its reason while no row is open — focusable, inert; closes every detail once one is", async () => {
    const user = userEvent.setup({ delay: null });
    const view = renderFindings(app, KEY, runPath(KEY, { view: "findings" }));
    await loaded();
    const item = view.container.querySelector("[data-toolbar-item=facts]") as HTMLElement;
    const button = item.querySelector("button") as HTMLButtonElement;
    // the kit's one label (u9), never a copy in the finding's words (u14)
    expect(button).toHaveAttribute("aria-label", "Свернуть все находки");
    // nothing open: the button is in view, never `invisible` (ui → Blocked action), and says why it cannot run
    expect(button).toHaveClass("size-7");
    expect(button).not.toHaveClass("invisible");
    expect(button).toHaveAttribute("aria-disabled", "true");
    expect(button).not.toHaveAttribute("disabled");
    expect(button).not.toHaveAttribute("tabindex", "-1");
    expect(COLLAPSE_BLOCKED).toBe("Нет открытых строк — откройте строку");
    expect(COLLAPSE_BLOCKED.split(" ")).toHaveLength(6);
    fireEvent.focus(button);
    expect(await screen.findByRole("tooltip")).toHaveTextContent(new RegExp(`^${COLLAPSE_BLOCKED}$`));
    fireEvent.blur(button);
    const [a, b] = ids();
    await user.click(button);
    expect(openIds()).toEqual([]);
    await user.click(row(a).querySelector("td[data-col=summary]") as HTMLElement);
    await user.click(row(b).querySelector("td[data-col=summary]") as HTMLElement);
    expect(openIds()).toEqual([a, b]);
    // the same box, now an action: a click never moves what was clicked (Strict 1)
    expect(button).toHaveClass("size-7");
    expect(button).not.toHaveAttribute("aria-disabled");
    await user.click(button);
    expect(openIds()).toEqual([]);
    await waitFor(() => expect(new URLSearchParams(view.probe.location?.search).get("finding")).toBeNull());
    expect(button).toHaveAttribute("aria-disabled", "true");
    expect(button).not.toHaveClass("invisible");
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

describe("p2-assess-critic-improve#improve-14: rating keeps its pace", () => {
  afterEach(() => {
    writePref(tableKey(FINDINGS_TABLE), null);
    writePref(viewKey(FINDINGS_TABLE, KEY), null);
  });

  test("on a page's last unrated row a key 1–4 turns the page and focuses the next page's first unrated row; an open detail moves with it", async () => {
    const user = userEvent.setup({ delay: null });
    // five rows a page: the run's 18 findings over four pages
    writePref(tableKey(FINDINGS_TABLE), { pageSize: 5 });
    const view = renderFindings(app, KEY, runPath(KEY, { view: "findings" }));
    await waitFor(() => expect(bodyRows()).toHaveLength(5), { timeout: 4000 });
    expect(pager()).toHaveTextContent(/^стр\. 1 из 4$/);
    const one = ids();
    const last = one[4];
    expect(unrated(last)).toBe(true);

    // the last row of page 1: «2» rates it, the page turns, focus is on page 2's first row without a verdict
    row(last).focus();
    await user.keyboard("2");
    await waitFor(() => expect(pager()).toHaveTextContent(/^стр\. 2 из/));
    expect(pageParam(view)).toBe("2");
    const two = ids();
    expect(two).not.toContain(last);
    const firstUnrated = two.find(unrated) as string;
    await waitFor(() => expect(document.activeElement).toBe(row(firstUnrated)));
    await waitFor(() => expect(sentFor(last)).toEqual([{ run: KEY, findings: [last], verdict: "disagree", note: null }]));

    // page 2's last row, open: rated by its key, page 3 opens with its first unrated row open in its place
    const end = two[4];
    await user.click(row(end).querySelector("td[data-col=summary]") as HTMLElement);
    expect(openIds()).toEqual([end]);
    await user.keyboard("1");
    await waitFor(() => expect(pager()).toHaveTextContent(/^стр\. 3 из/));
    const three = ids();
    const next = three.find(unrated) as string;
    await waitFor(() => expect(openIds()).toEqual([next]));
    expect(document.activeElement).toBe(row(next));
    await waitFor(() => expect(new URLSearchParams(view.probe.location?.search).get("finding")).toBe(next));
    expect(pageParam(view)).toBe("3");
    // the keys write the verdict alone (j40): one body per rating, nothing beside it
    await waitFor(() => expect(sentFor(end)).toEqual([{ run: KEY, findings: [end], verdict: "agree", note: null }]));
    view.unmount();
  });

  test("with none left in the filter the rated finding's verdict line says «В этом списке всё оценено», on its reserved line", async () => {
    const user = userEvent.setup({ delay: null });
    expect(ALL_RATED).toBe("В этом списке всё оценено");
    expect(ALL_RATED.split(" ")).toHaveLength(5);
    const view = renderFindings(app, KEY, runPath(KEY, { view: "findings" }));
    await loaded();
    // two unrated findings whose ids no other id contains: a search for both keeps exactly them (table #12)
    const all = ids();
    const [x, y] = all.filter((id) => unrated(id) && all.filter((o) => o.includes(id)).length === 1);
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
    await waitFor(() => expect(line).toHaveTextContent(/^В этом списке всё оценено$/));
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
});
