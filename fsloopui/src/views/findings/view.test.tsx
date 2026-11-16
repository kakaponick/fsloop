// @vitest-environment jsdom
// Done-criteria 0, 2 and 5: the task walk of surfaces/findings.md → WALK 1–8 on the 723-finding fixture run, the
// view's configuration at the production shape, and the strict rules (no layout shift, no skeletons).
import "../../ui/test-setup.ts";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterAll, describe, expect, test } from "vitest";
import type { Finding } from "../../../shared/model.ts";
import { FINDING_STATUS, SEVERITY, VERDICT, type Verdict } from "../../../shared/states.ts";
import { readRun } from "../../../server/run.ts";
import { emptyStateText, glossaryLines, UiProvider } from "@/ui";
import { ANY_LABEL, assertLayout, CUSTOM_LABEL, fitsRegion, FRAME, headerWidth, isSelectFilter, mergeWidths, pack, PRESET_LABEL, runQuery, SELECT_WIDTH, type FilterDef, type PackItem } from "@/table";
import { FLEX_FLOOR, GAP, OVERFLOW_WIDTH } from "@/table/toolbar.tsx";
import { CAUSE, CONFIDENCE, countFindings, enumFact, FACT, FindingArticle, findingNotFound, openFindings, reportWord, SECTION, stateText, textSections } from "@/finding";
import { OBJECTED } from "@/finding/facets.ts";
import { textWidth as measure } from "../../app/layout-testing.ts";
import { renderShell } from "../../app/testing.tsx";
import { runPath } from "../../app/routes.ts";
import { COLUMNS } from "./columns.tsx";
import { emptyFor, nextCriticStep } from "./index.tsx";
import * as marks from "./marks.ts";
import { DEFAULT_SORT, filtersFor, PRESETS, reportOptions, SEARCH, severityRank } from "./query.ts";
import { findingsApp, keyOf, NOW, renderFindings } from "./testing.tsx";

const N = 40; // the production maximum: 723 findings
const INIT = 60; // an init run, closed with no findings
const KEY = keyOf(N);
const app = findingsApp([N, INIT]);
afterAll(() => app.close());
const run = { ...readRun(app.fx.dirOf(N)), key: KEY };

const bodyRows = () => [...document.querySelectorAll<HTMLTableRowElement>("tr[data-row-id]")];
const row = (id: string) => bodyRows().find((r) => r.dataset.rowId === id) as HTMLTableRowElement;
const detail = (id: string) => [...document.querySelectorAll<HTMLElement>("tr[data-detail-for]")].find((r) => r.dataset.detailFor === id) as HTMLElement;
const loaded = () => waitFor(() => expect(bodyRows()).toHaveLength(50), { timeout: 4000 });
/** The view's box: beside the 316 px sidebar, inside the view's 20 px gutters — at 1280 px and at the frames' 1440. */
const REGION = 1280 - 316 - 40;
const REGION_1440 = 1440 - 316 - 40;

/** A value's width at the body face (Segoe UI, 13 px), by glyph class and rounded up (app/layout-testing.ts).
 * p1-verdict-findings.png calibrates it: its 160 px «Отчёт» cut «code · проход 1 · приёмка» to
 * «code · проход 1 · прие…», which this measure puts past the cell's 144 px of text — it errs wide, never narrow. */
const textWidth = (text: string) => measure(text);
/** A cell's 8 px on each side; a state's 7 px dot and the 6 px before its word. */
const CELL_PAD = 16;
const DOT = 7 + 6;
const widthOf = (id: string) => COLUMNS.find((c) => c.id === id)?.width ?? 0;
const widest = (values: Iterable<string>) => Math.max(...[...values].map(textWidth));

describe("the view's configuration at the production shape", () => {
  test("craft-2, cand-2 (verdict), craft-10: «Отчёт» and «Состояние» clear the widest value of the maximum run, whole at 1280 and 1440", () => {
    expect(textWidth("code · проход 1 · прие…")).toBeGreaterThan(160 - CELL_PAD);
    // the values the frames show cut no longer meet their old widths
    expect(textWidth("code · проход 1 · приёмка") + CELL_PAD).toBeGreaterThan(160);
    expect(textWidth("исправляется · f10") + DOT + CELL_PAD).toBeGreaterThan(136);
    // «Отчёт»: the widest launch name of the 723-finding run, and the verdict's own example
    const names = new Set(run.findings.map(reportWord));
    expect(names).toContain("runtime · проход 1 · приёмка");
    expect(widest(names)).toBe(textWidth("runtime · проход 1 · приёмка"));
    expect(widest(names)).toBe(184);
    expect(widest(names) + CELL_PAD).toBeLessThanOrEqual(widthOf("report"));
    expect(textWidth("craft · проход 2 · приёмка") + CELL_PAD).toBeLessThanOrEqual(widthOf("report"));
    // «Состояние»: the widest state with its unit, after its dot
    const states = new Set(run.findings.map(stateText));
    expect(widest(states)).toBe(textWidth("исправляется · f10"));
    expect(widest(states) + DOT + CELL_PAD).toBeLessThanOrEqual(widthOf("state"));
    expect([widthOf("report"), widthOf("state")]).toEqual([200, 156]);
    // craft-10: the cell names a launch as the «Отчёт» filter does, the pass and stage that tell launches apart kept
    const labels = new Map(reportOptions(run).map((o) => [o.value, o.label]));
    for (const f of run.findings) if (f.launch) expect(reportWord(f), f.id).toBe(labels.get(f.launch));
    const visible = COLUMNS.filter((c) => !c.hidden);
    expect(fitsRegion(visible, mergeWidths(COLUMNS, null), REGION)).toBe(true);
    expect(fitsRegion(visible, mergeWidths(COLUMNS, null), REGION_1440)).toBe(true);
  });

  test("p2 craft-3: each fixed column at its widest ordinary value on the 723-finding run, the excess to «Находка» — 334 px of sentence at 1440", () => {
    // «ID»: the local id in mono at 12 px, 7.5 px a glyph — p2-verdict-shell.png holds «improve-12» in about 75 px
    const mono = (text: string) => Math.ceil(text.length * 7.5);
    expect(mono("improve-12")).toBe(75);
    const locals = new Set(run.findings.map((f) => f.local));
    expect(Math.max(...[...locals].map(mono))).toBe(mono("runtime-10"));
    expect(widthOf("id")).toBe(92);
    expect(mono("runtime-10") + CELL_PAD).toBeLessThanOrEqual(widthOf("id"));
    expect(headerWidth("ID")).toBeLessThanOrEqual(widthOf("id"));
    // «Серьёзность»: its widest value, «не записано» after its dot, under its header — the header is the wider
    expect(textWidth("не записано") + DOT + CELL_PAD).toBeLessThanOrEqual(widthOf("severity"));
    // the sentence's room at 1440 beside the 316 px sidebar: the region less the frame, the checkbox and the fixed columns
    const fixed = COLUMNS.filter((c) => !c.hidden && c.width !== undefined).reduce((s, c) => s + (c.width ?? 0), 0);
    expect(REGION_1440 - FRAME - SELECT_WIDTH - fixed).toBe(334);
    // the 112 px «ID» gave it 314
    expect(REGION_1440 - FRAME - SELECT_WIDTH - fixed - (112 - widthOf("id"))).toBe(314);
  });

  test("gap 6 (f12; table #10): «Оценка» clears its widest value, «не та серьёзность», by the same measure — the table still whole at 1280 and 1440", () => {
    // the 128 px it had cut it: 120 px of text in a cell's 112
    expect(textWidth("не та серьёзность")).toBe(120);
    expect(textWidth("не та серьёзность") + CELL_PAD).toBeGreaterThan(128);
    const verdicts = Object.values(VERDICT).map((v) => v.compact);
    expect(widest(verdicts)).toBe(textWidth("не та серьёзность"));
    expect(widest(verdicts) + CELL_PAD).toBeLessThanOrEqual(widthOf("verdict"));
    const visible = COLUMNS.filter((c) => !c.hidden);
    expect(fitsRegion(visible, mergeWidths(COLUMNS, null), REGION)).toBe(true);
    expect(fitsRegion(visible, mergeWidths(COLUMNS, null), REGION_1440)).toBe(true);
  });

  test("craft-26: at 1440 px «Оценка», the view's own write, stays in the toolbar; «Юнит», «Охват» and «Правка» fold", () => {
    // a filter's trigger hugs «Поле: все» in the select's chrome: its border, 10 px before, 8 after, 6 between, the chevron
    const trigger = (field: string, value: string) => 2 + 10 + 8 + 6 + 6 + 16 + textWidth(`${field}:`) + textWidth(value);
    const items: PackItem[] = [
      { id: "preset", kind: "sticky", width: Math.max(...[...PRESETS.map((p) => p.label), CUSTOM_LABEL].map((v) => trigger(PRESET_LABEL, v))) },
      { id: "search", kind: "pinned", width: FLEX_FLOOR },
      ...filtersFor(run).map((f): PackItem => ({ id: `filter-${f.id}`, kind: "ordinary", width: trigger(f.label, ANY_LABEL) })),
      { id: "facts", kind: "pinned", width: 28 },
      { id: "columns", kind: "pinned", width: 28 },
    ];
    expect(pack(items, REGION_1440, { gap: GAP, overflow: OVERFLOW_WIDTH })).toEqual(["filter-unit", "filter-cause", "filter-command"]);
  });

  test("cand-7: «С возражением» — the three verdicts that dispute a finding, one «Вид» and one «Оценка» option", () => {
    expect(PRESETS.map((p) => p.label)).toEqual(["Все", "Без оценки", "С возражением", "В исправление", "Кандидаты", "Закоммичены"]);
    // «Вид» stays a select: six presets and «Свой набор»
    expect(PRESETS.length + 1).toBeLessThanOrEqual(7);
    const verdict = filtersFor(run).find((f) => f.id === "verdict") as FilterDef<Finding>;
    expect(verdict.options.map((o) => o.label)).toEqual(["с возражением", "согласен", "не согласен", "не та серьёзность", "ложная находка", "без оценки"]);
    expect(isSelectFilter(verdict as FilterDef<unknown>)).toBe(true);
    // which verdicts it takes, in the «Оценка» header's glossary, last
    const lines = glossaryLines(COLUMNS.find((c) => c.id === "verdict")?.glossary ?? []);
    expect(lines.at(-1)).toBe("с возражением — оценка «не согласен», «не та серьёзность» или «ложная находка»");
    expect(lines.at(-1)?.split(" ")).toHaveLength(12);
    const rated = (id: string, v: Verdict | null): Finding => ({ ...run.findings[0], id, verdict: v ? { verdict: v, note: null, at: null } : null });
    const rows = [rated("a", "agree"), rated("b", "disagree"), rated("c", "wrong-severity"), rated("d", "false-positive"), rated("e", null)];
    const q = runQuery({ rows, rowId: (f) => f.id, columns: [], filters: filtersFor(run), search: SEARCH, state: { sort: null, filters: {}, search: "" }, presets: PRESETS });
    const objected = PRESETS.find((p) => p.label === "С возражением");
    expect(objected?.filters).toEqual({ verdict: [OBJECTED] });
    expect(q.presetCounts[objected?.id ?? ""]).toBe(3);
    expect(q.counts.verdict[OBJECTED]).toBe(3);
    expect(countFindings(rows, { verdict: [OBJECTED] })).toBe(3);
    const shown = runQuery({ rows, rowId: (f) => f.id, columns: [], filters: filtersFor(run), search: SEARCH, state: { sort: null, filters: { verdict: [OBJECTED] }, search: "" } });
    expect(shown.rows.map((f) => f.id)).toEqual(["b", "c", "d"]);
  });

  test("cand-2 (shape): a sort by «Отчёт» reads the run's reports in their order, each report's findings together, as the report lists them", () => {
    const columns = COLUMNS.flatMap((c) => (c.rank ? [{ id: c.id, rank: c.rank }] : []));
    const sorted = runQuery({ rows: run.findings, rowId: (f) => f.id, columns, filters: [], search: null, state: { sort: { id: "report", desc: false }, filters: {}, search: "" } }).rows;
    const index = new Map(run.findings.map((f, i) => [f.id, i]));
    const launchAt = new Map(run.launches.map((l, i) => [l.id, i]));
    const groups: { key: string; at: number[] }[] = [];
    for (const f of sorted) {
      const key = f.launch ?? f.source;
      if (groups.at(-1)?.key !== key) groups.push({ key, at: [] });
      groups.at(-1)?.at.push(index.get(f.id) ?? -1);
    }
    // each report once, together
    expect(new Set(groups.map((g) => g.key)).size).toBe(groups.length);
    // the critics' reports in the run's order of launches
    const launches = groups.map((g) => launchAt.get(g.key)).filter((i): i is number => i !== undefined);
    expect(launches.length).toBeGreaterThan(20);
    expect(launches).toEqual([...launches].sort((a, b) => a - b));
    // a report's findings in its own order
    for (const g of groups) expect(g.at, g.key).toEqual([...g.at].sort((a, b) => a - b));
  });

  test("cand-4 (shape): a row with frames counts them in its «Находка» cell, so they show before the row expands", () => {
    const summary = COLUMNS.find((c) => c.id === "summary");
    const ctx = { tokens: [], hl: (t: string | null | undefined) => t };
    const framed = run.findings.find((f) => f.frames.length === 2) as Finding;
    const bare = run.findings.find((f) => f.frames.length === 0) as Finding;
    const { container, unmount } = render(<UiProvider>{summary?.cell(framed, ctx)}</UiProvider>);
    const count = container.querySelector("[data-slot=frame-count]") as HTMLElement;
    expect(count).toHaveAttribute("title", "2 кадра");
    expect(count).toHaveTextContent(/^2 кадра2$/);
    expect(count).toHaveClass("shrink-0", "tabular-nums");
    // the sentence truncates against it; the count keeps its width (rules/ui → Tables 5)
    expect(container.querySelector("[data-slot=frame-count]")?.previousElementSibling).toHaveClass("min-w-0", "truncate");
    unmount();
    const plain = render(<UiProvider>{summary?.cell(bare, ctx)}</UiProvider>);
    expect(plain.container.querySelector("[data-slot=frame-count]")).toBeNull();
    expect(plain.container).toHaveTextContent(bare.summary);
  });

  test("cand-3: the view's mark hook is named for its rows, not after the shared hook it wraps", () => {
    expect(Object.keys(marks).sort()).toEqual(["changeSign", "useFindingMarks"]);
  });

  test("the columns fit the 924 px view at 1280 px; every header clears its width; four start hidden", () => {
    expect(() => assertLayout(COLUMNS)).not.toThrow();
    const visible = COLUMNS.filter((c) => !c.hidden);
    expect(visible.map((c) => c.label)).toEqual(["Серьёзность", "ID", "Находка", "Отчёт", "Состояние", "Оценка"]);
    expect(COLUMNS.filter((c) => c.hidden).map((c) => c.label)).toEqual(["Место", "Уверенность", "Охват", "Этап"]);
    expect(fitsRegion(visible, mergeWidths(COLUMNS, null), REGION)).toBe(true);
    expect(fitsRegion(visible, mergeWidths(COLUMNS, null), 1920 - 316)).toBe(true);
    for (const c of COLUMNS) if (c.width !== undefined) expect(headerWidth(c.label, { sortable: Boolean(c.rank) }), c.id).toBeLessThanOrEqual(c.width);
    for (const c of COLUMNS) if (c.glossary) expect(() => glossaryLines(c.glossary ?? []), c.id).not.toThrow();
  });

  test("craft-26: the filters in toolbar order — «Оценка» before «Отчёт», so it folds after it; «Состояние» and «Правка» comboboxes; counts over the model", () => {
    const filters = filtersFor(run);
    expect(filters.map((f) => f.label)).toEqual(["Серьёзность", "Состояние", "Оценка", "Отчёт", "Юнит", "Охват", "Правка"]);
    const kinds = filters.map((f) => (isSelectFilter(f as FilterDef<unknown>) ? "select" : "combobox"));
    expect(kinds).toEqual(["select", "combobox", "select", "combobox", "combobox", "select", "combobox"]);
    expect(filters[0].options.map((o) => o.label)).toEqual(["major и выше", "critical", "major", "minor", "не записано"]);
    const q = runQuery({ rows: run.findings, rowId: (f) => f.id, columns: [], filters, search: SEARCH, state: { sort: null, filters: {}, search: "" }, presets: PRESETS });
    expect(q.total).toBe(723);
    const by = (k: (f: Finding) => boolean) => run.findings.filter(k).length;
    expect(q.counts.severity["major+"]).toBe(by((f) => f.severity === "critical" || f.severity === "major"));
    expect(q.counts.severity.none).toBe(by((f) => !f.severity));
    expect(q.counts.state.candidate).toBe(by((f) => f.effectiveStatus === "candidate"));
    // every source of the run: critics, candidates, implementers' open lines, the run's own
    expect(new Set(run.findings.map((f) => f.source))).toEqual(new Set(["critic", "candidate", "open", "own"]));
    expect(Object.fromEntries(PRESETS.map((p) => [p.label, q.presetCounts[p.id]]))).toEqual({
      Все: 723,
      "Без оценки": by((f) => !f.verdict),
      "С возражением": by((f) => Boolean(f.verdict) && f.verdict?.verdict !== "agree"),
      "В исправление": by((f) => ["queued", "in-progress", "blocked", "unresolved", "repeated"].includes(f.effectiveStatus)),
      Кандидаты: by((f) => f.effectiveStatus === "candidate"),
      Закоммичены: by((f) => f.effectiveStatus === "fixed" || f.effectiveStatus === "closed"),
    });
    // a count elsewhere that links here counts what the view will show
    expect(countFindings(run.findings, { severity: ["critical"], state: ["fixed"] })).toBe(by((f) => f.severity === "critical" && f.effectiveStatus === "fixed"));
  });

  test("the default order: severity rank, then the state's rank, then the report order", () => {
    const sorted = runQuery({ rows: run.findings, rowId: (f) => f.id, columns: COLUMNS.flatMap((c) => (c.rank ? [{ id: c.id, rank: c.rank }] : [])), filters: [], search: null, state: { sort: DEFAULT_SORT, filters: {}, search: "" } }).rows;
    const index = new Map(run.findings.map((f, i) => [f.id, i]));
    for (let i = 1; i < sorted.length; i++) {
      const [a, b] = [sorted[i - 1], sorted[i]];
      const ka = [SEVERITY[a.severity ?? "none"].rank, FINDING_STATUS[a.effectiveStatus].rank, index.get(a.id) ?? 0];
      const kb = [SEVERITY[b.severity ?? "none"].rank, FINDING_STATUS[b.effectiveStatus].rank, index.get(b.id) ?? 0];
      expect(ka[0] < kb[0] || (ka[0] === kb[0] && (ka[1] < kb[1] || (ka[1] === kb[1] && ka[2] < kb[2]))), `${a.id} before ${b.id}`).toBe(true);
    }
    expect(sorted[0].severity).toBe("critical");
    expect(sorted.at(-1)?.severity).toBeNull();
    expect(severityRank({ severity: "critical", effectiveStatus: "blocked" })).toBeLessThan(severityRank({ severity: "major", effectiveStatus: "undecided" }));
  });

  test("the empty states: a closed or init run never had findings; an open one names the stage that brings them", () => {
    expect(emptyFor({ closed: true, mode: "worktree", now: null })).toEqual({ form: "never" });
    expect(emptyFor({ closed: false, mode: "init", now: null })).toEqual({ form: "never" });
    expect(nextCriticStep("p1-spike")).toBe("decompose");
    expect(nextCriticStep("p2-units")).toBe("review");
    expect(nextCriticStep(null)).toBe("map");
    const open = emptyFor({ closed: false, mode: "worktree", now: { stage: "p1-map", step: null, since: null, running: 1, redGate: null } });
    if (open.form !== "not-yet") throw new Error("not-yet expected");
    expect(emptyStateText({ ...open, noun: ["находка", "находки", "находок"] }).title).toBe("Критики ещё не писали отчётов — находки появятся на этапе «карта»");
    expect(emptyStateText({ form: "never", noun: ["находка", "находки", "находок"] }).title).toBe("В этом прогоне не было находок");
  });
});

describe("the task walk over u1's handler (surfaces/findings.md → WALK)", () => {
  test("1: before the run is read, «Загрузка…» with a spinner holds the view's place", async () => {
    renderShell(app.fx.transport, { path: runPath(KEY) });
    expect(screen.getAllByRole("status").some((s) => s.textContent === "Загрузка…")).toBe(true);
    await waitFor(() => expect(bodyRows()).toHaveLength(50), { timeout: 4000 });
  });

  test("3, craft-26: every finding of every source, 15 pages of 50, the default sort, «Вид» with its count, the toolbar's order, search, filtered to none", async () => {
    const user = userEvent.setup({ delay: null });
    const { container } = renderFindings(app, KEY, runPath(KEY, { view: "findings" }));
    await loaded();
    const bar = container.querySelector("[data-slot=status-bar]") as HTMLElement;
    expect(bar).toHaveTextContent("723 находки");
    expect(within(bar).getByRole("navigation", { name: "Страницы" })).toHaveTextContent("стр. 1 из 15");
    expect(screen.getAllByRole("columnheader").map((h) => h.textContent).filter(Boolean)).toEqual(["Серьёзность", "ID", "Находка", "Отчёт", "Состояние", "Оценка"]);
    expect(screen.getByRole("combobox", { name: "Вид" })).toHaveTextContent(/^Вид:Все$/);
    expect([...container.querySelectorAll<HTMLElement>("[data-toolbar-item]")].map((el) => el.dataset.toolbarItem)).toEqual([
      "preset",
      "search",
      "filter-severity",
      "filter-state",
      "filter-verdict",
      "filter-report",
      "filter-unit",
      "filter-cause",
      "filter-command",
      "facts",
      "columns",
    ]);
    expect(within(bodyRows()[0]).getByText("critical")).toBeInTheDocument();
    // a row: severity · id · first sentence · report · state · verdict
    const first = run.findings.find((f) => f.id === bodyRows()[0].dataset.rowId) as Finding;
    expect(bodyRows()[0].querySelector("td[data-col=summary]")).toHaveTextContent(first.summary);
    expect(bodyRows()[0].querySelector("td[data-col=report]")).toHaveTextContent(first.launchName);

    const search = screen.getByRole("searchbox");
    expect(search).toHaveAttribute("placeholder", "Текст, файл, id, юнит");
    await user.click(search);
    await user.paste("p1-review-critic-parity");
    await waitFor(() => expect(bodyRows()).toHaveLength(10));
    expect(bar).toHaveTextContent("10 из 723 находок");
    await user.clear(search);
    await user.paste("ни-одной-такой-находки");
    expect(await screen.findByText("Нет находок, подходящих под фильтры")).toBeInTheDocument();
    expect(screen.getByText("Фильтры: Поиск: «ни-одной-такой-находки»")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Сбросить фильтры" }));
    await loaded();
  });

  test("4–6: rows expand in place, several at once; the detail's sections; the decision's units; frames; the row menu", async () => {
    const user = userEvent.setup({ delay: null });
    renderFindings(app, KEY, runPath(KEY, { view: "findings" }));
    await loaded();
    const [a, b] = [bodyRows()[0].dataset.rowId as string, bodyRows()[1].dataset.rowId as string];
    await user.click(row(a).querySelector("td[data-col=summary]") as HTMLElement);
    await user.click(row(b).querySelector("td[data-col=summary]") as HTMLElement);
    expect(detail(a)).toBeTruthy();
    expect(detail(b)).toBeTruthy();
    expect(row(a)).toHaveAttribute("aria-expanded", "true");
    const f = run.findings.find((x) => x.id === a) as Finding;
    const headings = within(detail(a))
      .getAllByRole("heading")
      .map((h) => h.textContent);
    expect(new Set(headings).size).toBe(headings.length);
    expect(headings).toContain(SECTION.decision);
    // craft-20: the verdict block has its own heading; the fact line leaves out the severity its row shows
    expect(headings).toContain(SECTION.verdict);
    const facts = detail(a).querySelector("[data-slot=finding-facts]") as HTMLElement;
    expect(facts.querySelector("[data-slot=status-dot]")).toBeNull();
    expect(facts).not.toHaveTextContent(new RegExp(`^${f.severity}`));
    for (const unit of f.units) expect(within(detail(a)).getByRole("link", { name: new RegExp(`^${unit}`) })).toHaveAttribute("href", runPath(KEY, { view: "units", unit }));

    // the row menu: one row, then a selection of two; an item whose object the rows lack is not listed
    fireEvent.contextMenu(row(a));
    let menu = await screen.findByRole("menu");
    const unit = f.unit ?? f.units[0];
    expect(within(menu).getAllByRole("menuitem").map((i) => i.textContent)).toEqual([
      "СвернутьEnter",
      "Оценить…",
      "Скопировать ссылку",
      "Скопировать id",
      ...(f.location ? ["Скопировать место"] : []),
      ...(f.launch ? ["Открыть отчёт"] : []),
      ...(unit ? [`Открыть юнит ${unit}`] : []),
      "Действие по клику",
    ]);
    await user.keyboard("{Escape}");
    await user.click(within(row(a)).getByRole("checkbox"));
    await user.click(within(row(b)).getByRole("checkbox"));
    fireEvent.contextMenu(row(b));
    menu = await screen.findByRole("menu");
    expect(within(menu).getByText("2 находки")).toBeInTheDocument();
    const fb = run.findings.find((x) => x.id === b) as Finding;
    expect(within(menu).getAllByRole("menuitem").map((i) => i.textContent)).toEqual(["Оценить…", "Скопировать id", ...(f.location || fb.location ? ["Скопировать место"] : []), "Действие по клику"]);
    await user.keyboard("{Escape}");
  });

  test("the row menu of a finding the run wrote itself: no report, so «Открыть отчёт» is not listed — nothing is shown disabled", async () => {
    const own = run.findings.find((f) => !f.launch && f.source === "own") as Finding;
    expect(own).toBeTruthy();
    renderFindings(app, KEY, runPath(KEY, { view: "findings", finding: own.id }));
    await waitFor(() => expect(row(own.id)).toBeTruthy(), { timeout: 4000 });
    fireEvent.contextMenu(row(own.id));
    const menu = await screen.findByRole("menu");
    const items = within(menu).getAllByRole("menuitem").map((i) => i.textContent);
    const unit = own.unit ?? own.units[0];
    expect(items).toEqual(["СвернутьEnter", "Оценить…", "Скопировать ссылку", "Скопировать id", ...(own.location ? ["Скопировать место"] : []), ...(unit ? [`Открыть юнит ${unit}`] : []), "Действие по клику"]);
    expect(items).not.toContain("Открыть отчёт");
    expect(within(menu).queryAllByRole("menuitem").filter((i) => i.getAttribute("aria-disabled") === "true")).toHaveLength(0);
  });

  test("5: a finding's frames open in the viewer, named by the file; Escape returns to the thumbnail", async () => {
    const user = userEvent.setup({ delay: null });
    const framed = run.findings.find((f) => f.frames.length === 2) as Finding;
    renderFindings(app, KEY, runPath(KEY, { view: "findings", finding: framed.id }));
    await waitFor(() => expect(detail(framed.id)).toBeTruthy(), { timeout: 4000 });
    const thumbs = within(detail(framed.id)).getAllByRole("button", { name: /^Открыть кадр / });
    expect(thumbs).toHaveLength(2);
    expect(thumbs[0]).toHaveClass("h-thumb-h", "w-thumb-w");
    await user.click(thumbs[0]);
    const viewer = await screen.findByRole("dialog", { name: framed.frames[0] });
    expect(viewer).toHaveTextContent(/1 из 2 кадр/);
    await user.keyboard("{Escape}");
    await waitFor(() => expect(thumbs[0]).toHaveFocus());
  });

  test("8: a link opens the finding's page, expands, marks it; filtered out it shows «вне фильтра»; an unknown id is named", async () => {
    const all = runQuery({ rows: run.findings, rowId: (f) => f.id, columns: COLUMNS.flatMap((c) => (c.rank ? [{ id: c.id, rank: c.rank }] : [])), filters: [], search: null, state: { sort: DEFAULT_SORT, filters: {}, search: "" } }).rows;
    const far = all[8 * 50 + 3];
    const view = renderFindings(app, KEY, runPath(KEY, { view: "findings", finding: far.id }));
    await loaded();
    await waitFor(() => expect(row(far.id)).toBeTruthy());
    expect(row(far.id)).toHaveAttribute("data-target");
    expect(row(far.id)).toHaveAttribute("aria-expanded", "true");
    expect(detail(far.id)).toBeTruthy();
    expect(screen.getByRole("navigation", { name: "Страницы" })).toHaveTextContent("стр. 9 из 15");
    await waitFor(() => expect(new URLSearchParams(view.probe.location?.search).get("page")).toBe("9"));
    expect(new URLSearchParams(view.probe.location?.search).get("finding")).toBe(far.id);
    view.unmount();

    // the critical slice, written as a count elsewhere would; a minor finding linked into it
    openFindings(KEY, { severity: ["critical"] });
    const minor = run.findings.find((f) => f.severity === "minor") as Finding;
    renderFindings(app, KEY, runPath(KEY, { view: "findings", finding: minor.id }));
    await waitFor(() => expect(row(minor.id)).toBeTruthy(), { timeout: 4000 });
    expect(within(row(minor.id)).getByText("вне фильтра")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Вид" })).toHaveTextContent("Вид:Свой набор");
  });

  test("8: an id the run does not hold reads «Находка <id> не найдена»", async () => {
    const id = "p1-review-critic-code#code-999";
    renderFindings(app, KEY, runPath(KEY, { view: "findings", finding: id }));
    await loaded();
    expect(document.querySelector("[data-slot=finding-missing]")).toHaveTextContent(findingNotFound(id));
    expect(findingNotFound(id)).toBe("Находка p1-review-critic-code#code-999 не найдена: в этом прогоне её нет — проверьте ссылку");
    expect(findingNotFound(id).split(" ")).toHaveLength(12);
  });

  test("2: a run with no findings that is over says so, with no table", async () => {
    renderFindings(app, keyOf(INIT), runPath(keyOf(INIT), { view: "findings" }));
    expect(await screen.findByText("В этом прогоне не было находок")).toBeInTheDocument();
    expect(bodyRows()).toHaveLength(0);
  });
});

describe("the finding article (BLOCKS → FindingDetail) at the production shape", () => {
  const base = run.findings.find((f) => f.rule && f.fix && f.question && f.observation && f.location && f.severity) as Finding;
  const open = run.findings.find((f) => f.source === "open") as Finding;
  const article = (f: Finding) =>
    render(
      <UiProvider>
        <MemoryRouter>
          <FindingArticle run={run} finding={f} now={NOW} />
        </MemoryRouter>
      </UiProvider>,
    );

  test("a split text: four sections in reading order, the fix with its command; never a section twice", () => {
    expect(textSections(base).map((s) => s.title)).toEqual([SECTION.observation, SECTION.fix, SECTION.question, SECTION.rule]);
    expect(textSections(base)[1].text).toBe(`\`/impeccable ${base.fixCommand}\` — ${base.fix}`);
    article(base);
    const headings = screen.getAllByRole("heading").map((h) => h.textContent);
    expect(headings).toEqual([SECTION.observation, SECTION.fix, SECTION.question, SECTION.rule, SECTION.decision, ...(base.verdict ? [SECTION.verdict] : []), ...(base.frames.length ? [SECTION.frames] : [])]);
    expect(screen.getByText(base.location as string)).toBeInTheDocument();
  });

  test("craft-20: the critic's enums read in Russian with the raw value in the title; standalone, the severity stays; a saved verdict under «Ваша оценка»", () => {
    expect(enumFact(CONFIDENCE, FACT.confidence, "med")).toEqual({ text: "критик скорее уверен", title: "уверенность критика: med — критик скорее уверен в находке" });
    expect(enumFact(CAUSE, FACT.cause, "component")).toEqual({ text: "правка в общем компоненте", title: "охват правки: component — правка в общем компоненте: меняются все его экраны" });
    expect(enumFact(CAUSE, FACT.cause, "elsewhere")).toEqual({ text: "охват правки elsewhere", title: "охват правки: elsewhere" });
    expect(Object.keys(CONFIDENCE)).toEqual(["high", "med", "low"]);
    expect(Object.keys(CAUSE)).toEqual(["local", "component", "token", "conceptual"]);
    const f = { ...base, confidence: "med", cause: "component", verdict: { verdict: "agree" as const, note: null, at: new Date(NOW).toISOString() } };
    article(f);
    const facts = document.querySelector("[data-slot=finding-facts]") as HTMLElement;
    expect(within(facts).getByText("критик скорее уверен")).toHaveAttribute("title", "уверенность критика: med — критик скорее уверен в находке");
    expect(within(facts).getByText("правка в общем компоненте")).toHaveAttribute("title", "охват правки: component — правка в общем компоненте: меняются все его экраны");
    expect(facts).not.toHaveTextContent(/\bmed\b|\bcomponent\b/);
    expect(within(facts).getByText(base.severity as string)).toBeInTheDocument();
    const verdict = screen.getByRole("heading", { name: SECTION.verdict }).parentElement as HTMLElement;
    expect(verdict).toHaveTextContent(/^Ваша оценкасогласен · 19:41 МСК$/);
  });

  test("craft-20: as a row's detail the fact line leaves out the severity the row shows", () => {
    render(
      <UiProvider>
        <MemoryRouter>
          <FindingArticle run={run} finding={base} now={NOW} inRow />
        </MemoryRouter>
      </UiProvider>,
    );
    const facts = document.querySelector("[data-slot=finding-facts]") as HTMLElement;
    expect(within(facts).queryByText(base.severity as string)).toBeNull();
    expect(facts.firstElementChild).not.toHaveTextContent(/^·/);
  });

  test("an unsplit line: one «Текст находки»; no severity or place reads «не записано»", () => {
    expect(textSections(open)).toEqual([{ title: SECTION.whole, text: open.observation }]);
    article(open);
    expect(screen.getAllByRole("heading").map((h) => h.textContent)).toEqual([SECTION.whole, SECTION.decision]);
    const facts = document.querySelector("[data-slot=finding-facts]") as HTMLElement;
    expect(within(facts).getAllByText("не записано")).toHaveLength(2);
  });

  test("a loose line shows its raw text alone", () => {
    const raw = "craft-9 major — the toolbar wraps on the units page when the filters hold values";
    expect(textSections({ ...base, rule: null, fix: null, fixCommand: null, question: null, observation: null, raw })).toEqual([{ title: SECTION.whole, text: raw }]);
  });

  test("a text of 1 920 characters keeps every character at the reading measure; 8 frames in reserved boxes", () => {
    const long = `${Array.from({ length: 30 }, (_, i) => `Sentence ${i + 1} of the observation, as the critic wrote it, about src/web/file-${i}.tsx and its state.`).join(" ").slice(0, 1919)}.`;
    expect(long).toHaveLength(1920);
    const frames = Array.from({ length: 8 }, (_, i) => `p1-final-findings-${i + 1}.png`);
    article({ ...base, observation: long, frames });
    const text = document.querySelector("[data-slot=finding-text]") as HTMLElement;
    const observation = text.querySelector("[data-slot=running-text]") as HTMLElement;
    expect(observation.textContent).toBe(long);
    expect(observation).toHaveClass("max-w-measure");
    const thumbs = screen.getAllByRole("button", { name: /^Открыть кадр / });
    expect(thumbs).toHaveLength(8);
    for (const t of thumbs) expect(t).toHaveClass("h-thumb-h", "w-thumb-w");
    expect(screen.getByRole("heading", { name: SECTION.frames })).toBeInTheDocument();
  });
});
