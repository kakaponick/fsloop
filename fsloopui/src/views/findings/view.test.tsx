// @vitest-environment jsdom
// Done-criteria 0, 2 and 5: the task walk of surfaces/findings.md → WALK 1–8 on the 723-finding fixture run, the
// view's configuration at the production shape, and the strict rules (no layout shift, no skeletons).
import "../../ui/test-setup.ts";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterAll, describe, expect, test } from "vitest";
import type { Finding } from "../../../shared/model.ts";
import { FINDING_STATUS, SEVERITY } from "../../../shared/states.ts";
import { readRun } from "../../../server/run.ts";
import { emptyStateText, glossaryLines, UiProvider } from "@/ui";
import { assertLayout, fitsRegion, headerWidth, isSelectFilter, mergeWidths, runQuery, type FilterDef } from "@/table";
import { CAUSE, CONFIDENCE, countFindings, enumFact, FACT, FindingArticle, findingNotFound, openFindings, SECTION, textSections } from "@/finding";
import { renderShell } from "../../app/testing.tsx";
import { runPath } from "../../app/routes.ts";
import { COLUMNS } from "./columns.tsx";
import { emptyFor, nextCriticStep } from "./index.tsx";
import { DEFAULT_SORT, filtersFor, PRESETS, SEARCH, severityRank } from "./query.ts";
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
const REGION = 964; // 1280 px beside the 316 px sidebar

describe("the view's configuration at the production shape", () => {
  test("the columns fit the 964 px region; every header clears its width; four start hidden", () => {
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
