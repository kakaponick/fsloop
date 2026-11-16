// @vitest-environment jsdom
// Done-criteria 0, 1, 4 and 6: the task walk of surfaces/units.md → WALK on the 42-unit fixture run over 2 passes,
// the view's configuration at the production shape (0 / 14 / 42 units, a 964 px region), the empty states and the
// strict rules (no layout shift, no skeletons).
import "../../ui/test-setup.ts";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterAll, describe, expect, test, vi } from "vitest";
import { emptyStateText, glossaryLines, readPref } from "@/ui";
import { assertLayout, fitsRegion, FRAME, headerWidth, isSelectFilter, mergeWidths, runQuery, tableMinWidth, type FilterDef } from "@/table";
import { runKey as viewKey, type RunPrefs } from "../../table/view-state.ts";
import { runPath } from "../../app/routes.ts";
import { COLUMNS, STATE_GLOSSARY } from "./columns.tsx";
import { BAR_ORDER } from "./index.tsx";
import { closingIds, DEFAULT_SORT, emptyFor, filtersFor, PRESETS, SEARCH, stateDetail, statesOf, stripStates, unitRows, type UnitRow } from "./query.ts";
import { fixtureApp, keyOf, loadedRun, NOW, renderRun, renderUnits } from "./testing.tsx";
import { CANDIDATES_WIDEST, candidatesText, UNDECIDED_WIDEST, undecidedText, unitNotFound } from "./words.ts";

const N = 40; // the production maximum: 42 units over 2 passes
const INIT = 60; // an init run, closed with no units
const ONE = 24; // a live run of one pass, one unit at work
const KEY = keyOf(N);
// Three folders, not the shared 63: the server polls its root every 20 ms in this file's thread.
const fx = fixtureApp({ only: [N, INIT, ONE] });
afterAll(() => fx.close());
const run = loadedRun(fx, N);
const rows = unitRows(run);
const REGION = 1280 - 316 - 40; // the view's box at 1280 px: beside the 316 px sidebar, inside its 20 px gutters

/** A header's width at the platform face (Segoe UI, 12 px), by glyph class and rounded up: a wide letter 10.5 px, a
 * narrow one 4, another capital 8.5, the rest 7; then its sort control — a gap of 4 and the 14 px icon, or with a
 * glossary its 16 px button — and the cell's 16 px padding (table #10). The shared estimate (`headerWidth`, 6.6 px a
 * letter) passed «Юнит» at 64 px and «Проход» at 76 px, which p1-final-units.png shows clipped; this one fails both. */
function headerFits(label: string, { sortable, glossary }: { sortable: boolean; glossary: boolean }): number {
  let text = 0;
  for (const ch of label) text += /[ЮШЩЖМДФЫmwшщжмюы]/.test(ch) ? 10.5 : /[ijlrtfI.,:;!|]/.test(ch) ? 4 : /[A-ZА-ЯЁ]/.test(ch) ? 8.5 : 7;
  return Math.ceil(text + (sortable ? (glossary ? 20 : 18) : 0) + 16);
}
const fits = (c: (typeof COLUMNS)[number]) => headerFits(c.label, { sortable: Boolean(c.rank), glossary: Boolean(c.glossary) });

const bodyRows = () => [...document.querySelectorAll<HTMLTableRowElement>("tr[data-row-id]")];
const ids = () => bodyRows().map((r) => r.dataset.rowId as string);
const row = (id: string) => bodyRows().find((r) => r.dataset.rowId === id) as HTMLTableRowElement;
const cell = (id: string, col: string) => row(id).querySelector(`td[data-col=${col}]`) as HTMLElement;
const detail = (id: string) => document.querySelector(`tr[data-detail-for="${id}"]`) as HTMLElement;
const loaded = () => waitFor(() => expect(bodyRows()).toHaveLength(42), { timeout: 4000 });
const sortColumns = COLUMNS.flatMap((c) => (c.rank ? [{ id: c.id, rank: c.rank }] : []));

describe("the view's configuration at the production shape", () => {
  test("craft-5: every header clears its width at the platform face — «Юнит» and «Проход» no longer clipped", () => {
    expect(headerFits("Юнит", { sortable: true, glossary: false })).toBe(66);
    expect(headerFits("Проход", { sortable: true, glossary: true })).toBe(80);
    // the widths of p1-final-units.png, where both read «Юн…» and «Прох…», fail the measure
    expect(headerFits("Юнит", { sortable: true, glossary: false })).toBeGreaterThan(64);
    expect(headerFits("Проход", { sortable: true, glossary: true })).toBeGreaterThan(76);
    expect(COLUMNS.map((c) => [c.id, c.width ?? null, c.width === undefined ? null : fits(c)])).toEqual([
      ["id", 72, 66],
      ["pass", 88, 80],
      ["state", 192, 101],
      ["title", null, null],
      ["sha", 96, 85],
      ["major", 80, 76],
      ["minor", 72, 69],
      ["launches", 88, 87],
    ]);
    for (const c of COLUMNS) if (c.width !== undefined) expect(fits(c), c.id).toBeLessThanOrEqual(c.width);
    // the 1440 px frame and the 1280 px view hold every column without a sideways scroll
    expect(tableMinWidth(COLUMNS, mergeWidths(COLUMNS, null)) + FRAME).toBe(922);
    expect(fitsRegion(COLUMNS, mergeWidths(COLUMNS, null), REGION)).toBe(true);
    expect(fitsRegion(COLUMNS, mergeWidths(COLUMNS, null), 1440 - 316 - 40)).toBe(true);
  });

  test("the columns of BLOCKS; glossaries are bounded", () => {
    expect(() => assertLayout(COLUMNS)).not.toThrow();
    expect(COLUMNS.map((c) => c.label)).toEqual(["Юнит", "Проход", "Состояние", "Что делает", "Коммит", "major+", "minor", "Запуски"]);
    expect(COLUMNS.filter((c) => c.width === undefined).map((c) => c.id)).toEqual(["title"]);
    expect(COLUMNS.filter((c) => c.numeric).map((c) => c.id)).toEqual(["pass", "major", "minor", "launches"]);
    for (const c of COLUMNS) if (c.width !== undefined) expect(headerWidth(c.label, { sortable: Boolean(c.rank) }), c.id).toBeLessThanOrEqual(c.width);
    for (const c of COLUMNS) if (c.glossary) expect(() => glossaryLines(c.glossary ?? []), c.id).not.toThrow();
    expect(glossaryLines(STATE_GLOSSARY)).toEqual([
      "черновик — Бриф юнита написан, юнит ещё не готов к работе.",
      "готов к работе — Бриф юнита принят, исполнитель ещё не запущен.",
      "проверяется — Прогон проверяет код юнита: типы, линт, тесты.",
      "отладка — Проверка юнита упала, прогон ищет причину.",
      "вливается — Код юнита коммитится в ветку прогона.",
      "заблокирован — Юнит остановлен: прогон ждёт решения или другого юнита.",
      "· 12 мин — сколько прошло с запуска исполнителя или с последней проверки",
    ]);
  });

  test("«Состояние» is a combobox; «Проход» a select only when the run has more than one pass", () => {
    const filters = filtersFor(run);
    expect(filters.map((f) => f.label)).toEqual(["Состояние", "Проход"]);
    expect(filters.map((f) => (isSelectFilter(f as FilterDef<unknown>) ? "select" : "combobox"))).toEqual(["combobox", "select"]);
    expect(filters[1].options.map((o) => o.label)).toEqual(["1", "2"]);
    expect(filtersFor(loadedRun(fx, ONE)).map((f) => f.label)).toEqual(["Состояние"]);
    const q = runQuery({ rows, rowId: (u) => u.id, columns: [], filters, search: SEARCH, state: { sort: null, filters: {}, search: "" } });
    expect(q.counts.state).toMatchObject({ "": 42, committed: 30, blocked: 1, ready: 5, drafted: 4, implement: 1, verify: 1 });
    expect(q.counts.pass).toMatchObject({ "": 42, "1": 21, "2": 21 });
  });

  test("the default order: the pass descending, ties in units.md's order (u before f)", () => {
    const sorted = runQuery({ rows, rowId: (u) => u.id, columns: sortColumns, filters: [], search: null, state: { sort: DEFAULT_SORT, filters: {}, search: "" } }).rows.map((u) => u.id);
    const expected = [...Array.from({ length: 16 }, (_, k) => `u${k + 17}`), ...Array.from({ length: 5 }, (_, k) => `f${k + 6}`), ...Array.from({ length: 16 }, (_, k) => `u${k + 1}`), ...Array.from({ length: 5 }, (_, k) => `f${k + 1}`)];
    expect(sorted).toEqual(expected);
  });

  test("search: ids and shas OR-matched, the title as free text — what the placeholder names, and nothing it does not", () => {
    const q = (search: string) => runQuery({ rows, rowId: (u) => u.id, columns: [], filters: [], search: SEARCH, state: { sort: null, filters: {}, search } }).rows.map((u) => u.id);
    expect(q("c0ffee05")).toEqual(["u5"]);
    expect(q("c0ffee05 f1f1f103")).toEqual(["u5", "f3"]);
    expect(q("fixes")).toEqual(Array.from({ length: 10 }, (_, k) => `f${k + 1}`));
    // a finding's id is searched in «Находки», where its row names its units; here it would match a row with no hit
    const closed = run.units.find((u) => u.id === "u1")?.closes[0] as string;
    expect(q(closed)).toEqual([]);
  });

  test("craft-6, craft-10: the placeholder names the fields searched by the columns' own words and fits the search at 1280 and 1440", () => {
    expect(SEARCH.placeholder).toBe("Юнит, коммит, что делает");
    // each field by its column's header (ux 1: one concept, one word — «Что делает», never «название»)
    expect(SEARCH.placeholder.split(", ")).toEqual(["Юнит", "коммит", "что делает"]);
    expect(SEARCH.placeholder.split(", ").map((w) => COLUMNS.find((c) => c.label.toLowerCase() === w.toLowerCase())?.id)).toEqual(["id", "sha", "title"]);
    // p1-verdict-units-1280.png: 21 characters («Юнит, коммит, находка») took 140 px of a 148 px text room, 6.7 px each. With
    // «Вид» in the toolbar the search's text room is about 168 px at 1440 (a 271 px field less its 103 px of icon,
    // «/», clear and history) and about 209 px at 1280 (both filters folded into «…»): 25 characters at most
    expect(SEARCH.placeholder.length).toBeLessThanOrEqual(25);
  });

  test("p1-review cand-1: «Вид» presets — Все · В работе · Не начаты · Заблокированы · Закоммичены — over the states, counted on the 42 units", () => {
    expect(PRESETS.map((p) => p.label)).toEqual(["Все", "В работе", "Не начаты", "Заблокированы", "Закоммичены"]);
    expect(Object.fromEntries(PRESETS.map((p) => [p.id, p.filters]))).toEqual({
      all: {},
      work: { state: ["implement", "verify", "debug", "land"] },
      unstarted: { state: ["drafted", "ready"] },
      blocked: { state: ["blocked"] },
      committed: { state: ["committed"] },
    });
    const q = runQuery({ rows, rowId: (u) => u.id, columns: [], filters: filtersFor(run), search: SEARCH, state: { sort: null, filters: {}, search: "" }, presets: PRESETS });
    // the fixture: 1 implement and 1 verify; 4 drafted and 5 ready; 1 blocked; 30 committed
    expect(Object.fromEntries(PRESETS.map((p) => [p.label, q.presetCounts[p.id]]))).toEqual({ Все: 42, "В работе": 2, "Не начаты": 9, Заблокированы: 1, Закоммичены: 30 });
    // every state but «не записано» falls in one named slice: the slices add up to the whole
    expect(PRESETS.slice(1).flatMap((p) => p.filters.state ?? []).sort()).toEqual(["blocked", "committed", "debug", "drafted", "implement", "land", "ready", "verify"]);
  });

  test("verdict cand-1: one set of findings per unit — the counts, the menu and «Закрывает N» read the findings that name the unit", () => {
    // u22's brief closes none, but the run's decision names it on a finding: its row counted it, its detail did not
    const u22 = run.units.find((u) => u.id === "u22") as (typeof run.units)[number];
    expect(u22.closes).toEqual([]);
    const naming = run.findings.filter((f) => f.units.includes("u22")).map((f) => f.id);
    expect(naming.length).toBeGreaterThan(0);
    expect(closingIds(run, u22)).toEqual(naming);
    const row22 = rows.find((u) => u.id === "u22") as UnitRow;
    expect(row22.majorUp + row22.minor).toBe(naming.length);
    // every unit: the brief's own ids first, then the decision's; an id the run does not hold stays, to read «не найдена»
    for (const u of run.units) {
      const ids = closingIds(run, u);
      expect(new Set(ids).size, u.id).toBe(ids.length);
      expect(ids.slice(0, u.closes.length), u.id).toEqual(u.closes);
      expect(ids.filter((id) => run.findings.some((f) => f.id === id)).sort(), u.id).toEqual(run.findings.filter((f) => f.units.includes(u.id)).map((f) => f.id).sort());
    }
    expect(closingIds({ findings: [] }, { id: "u1", closes: ["p1-review-critic-code#code-999"] })).toEqual(["p1-review-critic-code#code-999"]);
  });

  test("the state cell: «state · age · cause», the cause last; no age without the model's `since`", () => {
    const at = (id: string) => rows.find((u) => u.id === id) as UnitRow;
    expect(stateDetail(at("u23"), NOW)).toEqual(["waits for the user — the empty state's wording (j140)"]);
    expect(stateDetail(at("u24"), NOW)).toEqual(["ждёт u23"]);
    expect(stateDetail({ ...at("u30"), since: new Date(NOW - 12 * 60_000).toISOString() }, NOW)).toEqual(["12 мин"]);
    expect(stateDetail({ ...at("u1"), since: new Date(NOW - 12 * 60_000).toISOString() }, NOW)).toEqual([]);
    expect(stateDetail({ ...at("u27"), state: "unknown", stateText: "paused by hand" }, NOW)).toEqual(["paused by hand"]);
  });

  test("the empty states and a missing unit: words built by code, against literals", () => {
    expect(emptyFor({ closed: true, mode: "worktree" })).toEqual({ form: "never" });
    expect(emptyFor({ closed: false, mode: "init" })).toEqual({ form: "never" });
    expect(emptyFor({ closed: false, mode: "worktree" })).toEqual({ form: "not-yet", step: "decompose" });
    expect(emptyStateText({ form: "not-yet", step: "decompose", noun: ["юнит", "юнита", "юнитов"] }).title).toBe("Юнитов ещё нет — они появятся на этапе «декомпозиция»");
    expect(emptyStateText({ form: "never", noun: ["юнит", "юнита", "юнитов"] }).title).toBe("В этом прогоне не было юнитов");
    expect(unitNotFound("u99")).toBe("Юнит u99 не найден: в этом прогоне его нет — проверьте ссылку");
    expect(unitNotFound("u99").split(" ")).toHaveLength(12);
    expect(candidatesText(1)).toBe("1 находка-кандидат");
    expect(candidatesText(3)).toBe("3 находки-кандидата");
    expect(CANDIDATES_WIDEST).toBe("888 находок-кандидатов");
    expect(undecidedText(1)).toBe("1 находка без решения");
    expect(undecidedText(12)).toBe("12 находок без решения");
    expect(UNDECIDED_WIDEST).toBe("888 находок без решения");
    expect(UNDECIDED_WIDEST.split(" ")).toHaveLength(4);
  });
});

describe("the task walk over u1's handler (surfaces/units.md → WALK)", () => {
  test("1–3: «Загрузка…» in the table's frame first; then all 42 rows unpaged, the columns, the counts strip, the toolbar", async () => {
    const { container } = renderUnits(fx, KEY, runPath(KEY, { view: "units" }));
    const status = screen.getAllByRole("status").find((s) => s.textContent === "Загрузка…") as HTMLElement;
    expect(status).toHaveClass("size-full", "rounded-lg", "border");
    expect(container.querySelector(".animate-pulse, [data-slot=skeleton]")).toBeNull();
    await loaded();
    expect(screen.getAllByRole("columnheader").map((h) => h.textContent).filter(Boolean)).toEqual(["Юнит", "Проход", "Состояние", "Что делает", "Коммит", "major+", "minor", "Запуски"]);
    expect(ids().slice(0, 3)).toEqual(["u17", "u18", "u19"]);
    expect(ids().at(-1)).toBe("f5");
    expect(screen.queryByRole("navigation", { name: "Страницы" })).toBeNull();
    const bar = container.querySelector("[data-slot=status-bar]") as HTMLElement;
    expect(bar).toHaveClass("h-8");
    expect(within(bar).getByText("42 юнита")).toBeInTheDocument();
    const strip = bar.querySelector("[data-slot=counts-strip]") as HTMLElement;
    expect([...strip.querySelectorAll("[data-slot=state-count]")].map((s) => s.textContent)).toEqual(["заблокирован1", "проверяется1", "пишется1", "готов к работе5", "черновик4", "закоммичен30"]);
    expect(strip.querySelector("[data-slot=state-count] [data-tone]")).toHaveAttribute("data-tone", "warning");
    for (const n of strip.querySelectorAll("[data-slot=state-count] > span:last-child")) expect(n).toHaveClass("min-w-count", "tabular-nums");
    expect([...container.querySelectorAll<HTMLElement>("[data-toolbar-item]")].map((el) => el.dataset.toolbarItem)).toEqual(["preset", "search", "filter-state", "filter-pass", "facts", "columns"]);
    expect(screen.getByRole("searchbox")).toHaveAttribute("placeholder", "Юнит, коммит, что делает");

    // a row: id · pass · state · title · commit · counts
    expect(cell("u23", "state")).toHaveTextContent("заблокирован · waits for the user — the empty state's wording (j140)");
    expect(cell("u23", "state").querySelector("[data-tone]")).toHaveAttribute("data-tone", "warning");
    expect(cell("u31", "state").querySelector("[data-tone]")).toHaveAttribute("data-tone", "neutral");
    expect(cell("u24", "state")).toHaveTextContent("готов к работе · ждёт u23");
    expect(cell("u1", "sha")).toHaveTextContent("c0ffee01");
    expect(cell("u27", "sha")).toHaveTextContent("—");
    expect(cell("u17", "pass")).toHaveTextContent("2");
  });

  test("1: the toolbar facts link to «Находки» filtered so, each in a box reserved at its widest form", async () => {
    const user = userEvent.setup({ delay: null });
    const view = renderUnits(fx, KEY, runPath(KEY, { view: "units" }));
    await loaded();
    const facts = [...document.querySelectorAll<HTMLElement>("[data-slot=toolbar-fact]")];
    expect(facts.map((f) => f.querySelector("[data-slot=fact-reserve]")?.textContent)).toEqual(["888 находок-кандидатов", "888 находок без решения"]);
    for (const f of facts) expect(f.querySelector("[data-slot=fact-reserve]")).toHaveClass("invisible");
    const candidates = run.findings.filter((f) => f.effectiveStatus === "candidate").length;
    const undecided = run.findings.filter((f) => f.effectiveStatus === "undecided").length;
    expect(facts[0]).toHaveTextContent(new RegExp(`${candidates} наход\\S+-кандидат`));
    expect(facts[1]).toHaveTextContent(new RegExp(`${undecided} наход\\S* без решения`));
    expect(candidates).toBeGreaterThan(0);
    await user.click(within(facts[0]).getByRole("link"));
    expect(view.probe.location?.search).toBe("?view=findings");
    expect(readPref<RunPrefs | null>(viewKey("findings", KEY), null)?.filters).toEqual({ state: ["candidate"] });
  });

  test("1: a unit's major+ count opens «Находки» filtered by the unit and severity", async () => {
    const user = userEvent.setup({ delay: null });
    const view = renderUnits(fx, KEY, runPath(KEY, { view: "units" }));
    await loaded();
    const unit = rows.find((u) => u.majorUp > 0) as UnitRow;
    const link = within(cell(unit.id, "major")).getByRole("link");
    expect(link).toHaveTextContent(String(unit.majorUp));
    expect(run.findings.filter((f) => f.units.includes(unit.id) && (f.severity === "critical" || f.severity === "major"))).toHaveLength(unit.majorUp);
    await user.click(link);
    expect(view.probe.location?.search).toBe("?view=findings");
    expect(readPref<RunPrefs | null>(viewKey("findings", KEY), null)?.filters).toEqual({ unit: [unit.id], severity: ["major+"] });
    // the link is the cell's own click: the row did not expand
    expect(detail(unit.id)).toBeNull();
  });

  test("3: search narrows the rows; filtered to none names the search and offers «Сбросить фильтры»", async () => {
    const user = userEvent.setup({ delay: null });
    const { container } = renderUnits(fx, KEY, runPath(KEY, { view: "units" }));
    await loaded();
    const search = screen.getByRole("searchbox");
    await user.click(search);
    await user.paste("c0ffee05");
    await waitFor(() => expect(ids()).toEqual(["u5"]));
    expect(container.querySelector("[data-slot=status-bar]")).toHaveTextContent("1 из 42 юнитов");
    await user.clear(search);
    await user.paste("ни-одного-юнита");
    expect(await screen.findByText("Нет юнитов, подходящих под фильтры")).toBeInTheDocument();
    expect(screen.getByText("Фильтры: Поиск: «ни-одного-юнита»")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Сбросить фильтры" }));
    await loaded();
  });

  test("p1-review cand-1: «Вид» stands first in the toolbar; choosing «Заблокированы» sets the state filter and leaves the blocked unit", async () => {
    const user = userEvent.setup();
    renderUnits(fx, KEY, runPath(KEY, { view: "units" }));
    await loaded();
    const preset = screen.getByRole("combobox", { name: "Вид" });
    expect(preset).toHaveTextContent(/^Вид:Все$/);
    preset.focus();
    await user.keyboard("{Enter}");
    // each preset with its count over the units, in the open list only
    expect((await screen.findAllByRole("option")).map((o) => o.textContent)).toEqual(["Все42", "В работе2", "Не начаты9", "Заблокированы1", "Закоммичены30"]);
    await user.keyboard("{ArrowDown}{ArrowDown}{ArrowDown}{Enter}");
    await waitFor(() => expect(screen.getByRole("combobox", { name: "Вид" })).toHaveTextContent(/^Вид:Заблокированы$/));
    expect(ids()).toEqual(["u23"]);
    expect(readPref<RunPrefs | null>(viewKey("units", KEY), null)?.filters).toEqual({ state: ["blocked"] });
  });

  test("craft-3: the counts strip is the table kit's `StripCount` — each entry's word goes to its title and the screen reader in a narrow bar", async () => {
    const { container } = renderUnits(fx, KEY, runPath(KEY, { view: "units" }));
    await loaded();
    const entries = [...container.querySelectorAll<HTMLElement>("[data-slot=counts-strip] [data-slot=state-count]")];
    expect(entries.map((e) => e.getAttribute("title"))).toEqual(["заблокирован 1", "проверяется 1", "пишется 1", "готов к работе 5", "черновик 4", "закоммичен 30"]);
    for (const e of entries) {
      expect(e.querySelector("[data-slot=strip-label]")).toHaveClass("@max-5xl/bar:sr-only");
      expect(e.querySelector("[data-slot=strip-count]")).toHaveClass("min-w-count", "tabular-nums");
      expect(e).toHaveClass("shrink-0");
    }
  });

  test("4: rows expand in place, several at once; the URL names the last one, replaced", async () => {
    const user = userEvent.setup({ delay: null });
    const view = renderUnits(fx, KEY, runPath(KEY, { view: "units" }));
    await loaded();
    await user.click(cell("u23", "title"));
    await user.click(cell("u24", "title"));
    expect(detail("u23")).toBeTruthy();
    expect(detail("u24")).toBeTruthy();
    expect(row("u24")).toHaveAttribute("aria-expanded", "true");
    expect(new URLSearchParams(view.probe.location?.search).get("unit")).toBe("u24");
    // u24 waits for u23: its id links to u23's address, with u23's state
    const waits = within(detail("u24")).getByRole("link", { name: "u23" });
    expect(waits).toHaveAttribute("href", runPath(KEY, { view: "units", unit: "u23" }));
    expect(waits.closest("li")).toHaveTextContent("u23заблокирован");
    // a finding it closes links to its own address in «Находки»
    const u23 = run.units.find((u) => u.id === "u23");
    const first = run.findings.find((f) => f.id === u23?.closes[0]);
    if (first) expect(within(detail("u23")).getAllByRole("link", { name: first.local })[0]).toHaveAttribute("href", runPath(KEY, { view: "findings", finding: first.id }));
  });

  test("4: the row menu of ACTIONS — an item whose object the row lacks is not listed, none disabled; a selection copies its ids joined by newlines", async () => {
    const user = userEvent.setup({ delay: null });
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    renderUnits(fx, KEY, runPath(KEY, { view: "units" }));
    await loaded();
    const u1 = rows.find((u) => u.id === "u1") as UnitRow;
    expect([u1.sha !== null, u1.brief !== null, u1.tree]).toEqual([true, true, null]);
    fireEvent.contextMenu(row("u1"));
    let menu = await screen.findByRole("menu");
    expect(within(menu).getByText("u1 — part 1")).toBeInTheDocument();
    expect(within(menu).getAllByRole("menuitem").map((i) => i.textContent)).toEqual(["ОткрытьEnter", "Открыть находки юнита", "Скопировать id", "Скопировать коммит", "Скопировать путь брифа", "Действие по клику"]);
    expect(menu.querySelector("[data-disabled]")).toBeNull();
    await user.keyboard("{Escape}");

    // a unit with no commit and no findings: neither «Скопировать коммит» nor «Открыть находки юнита»
    const bare = rows.find((u) => !u.sha && !run.findings.some((f) => f.units.includes(u.id))) as UnitRow;
    expect(bare).toBeTruthy();
    fireEvent.contextMenu(row(bare.id));
    menu = await screen.findByRole("menu");
    const items = within(menu).getAllByRole("menuitem").map((i) => i.textContent);
    expect(items).not.toContain("Скопировать коммит");
    expect(items).not.toContain("Открыть находки юнита");
    expect(menu.querySelector("[data-disabled]")).toBeNull();
    await user.keyboard("{Escape}");

    await user.click(within(row("u17")).getByRole("checkbox"));
    await user.click(within(row("u18")).getByRole("checkbox"));
    fireEvent.contextMenu(row("u18"));
    menu = await screen.findByRole("menu");
    expect(within(menu).getByText("2 юнита")).toBeInTheDocument();
    expect(within(menu).getAllByRole("menuitem").map((i) => i.textContent)).toEqual(["Скопировать id", "Скопировать коммит", "Скопировать путь брифа", "Действие по клику"]);
    await user.click(within(menu).getByRole("menuitem", { name: "Скопировать id" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith("u17\nu18"));
  });

  test("5: a link to a unit opens and marks it; an id the run does not hold is named", async () => {
    renderUnits(fx, KEY, runPath(KEY, { view: "units", unit: "f3" }));
    await loaded();
    expect(row("f3")).toHaveAttribute("data-target");
    expect(row("f3")).toHaveAttribute("aria-expanded", "true");
    expect(detail("f3")).toBeTruthy();
  });

  test("5: «Юнит u99 не найден» stands above the table, the table shows", async () => {
    renderUnits(fx, KEY, runPath(KEY, { view: "units", unit: "u99" }));
    await loaded();
    expect(document.querySelector("[data-slot=unit-missing]")).toHaveTextContent(unitNotFound("u99"));
  });
});

describe("the empty states and the production shape (done-criteria 4, 6)", () => {
  test("a closed init run never had units", async () => {
    renderUnits(fx, keyOf(INIT), runPath(keyOf(INIT), { view: "units" }));
    expect(await screen.findByText("В этом прогоне не было юнитов")).toBeInTheDocument();
    expect(bodyRows()).toHaveLength(0);
  });

  test("an open run before decompose: the stage that brings units", () => {
    const one = loadedRun(fx, ONE);
    expect(one.closed).toBe(false);
    renderRun(fx, { ...one, units: [] }, runPath(one.key, { view: "units" }));
    expect(screen.getByText("Юнитов ещё нет — они появятся на этапе «декомпозиция»")).toBeInTheDocument();
  });

  test("14 units — the median run — in one pass: no «Проход» filter, every row, the strip", () => {
    const fourteen = { ...run, units: run.units.filter((u) => u.pass === 1).slice(0, 14) };
    const { container } = renderRun(fx, fourteen, runPath(KEY, { view: "units" }));
    expect(bodyRows()).toHaveLength(14);
    expect([...container.querySelectorAll<HTMLElement>("[data-toolbar-item]")].map((el) => el.dataset.toolbarItem)).toEqual(["preset", "search", "filter-state", "facts", "columns"]);
    expect(container.querySelector("[data-slot=status-bar]")).toHaveTextContent("14 юнитов");
  });

  test("units.md that cannot be read fails in the table's place: «Список юнитов не прочитан: …»", () => {
    renderRun(fx, { ...run, errors: [...run.errors, { file: "units.md", cause: "нет доступа" }] }, runPath(KEY, { view: "units" }));
    expect(screen.getByText("Список юнитов не прочитан: нет доступа")).toBeInTheDocument();
    expect(bodyRows()).toHaveLength(0);
  });

  test("craft-11: «N юнитов» leads the status bar and the strip follows it; a state a live change brings appends at the end, one it empties keeps its slot", () => {
    const view = renderRun(fx, run, runPath(KEY, { view: "units" }));
    const bar = () => document.querySelector("[data-slot=status-bar]") as HTMLElement;
    const strip = () => [...bar().querySelectorAll("[data-slot=state-count]")].map((s) => s.textContent);
    // the order is the view's, passed to the status bar as its prop (craft-3): the total, the strip, then the selection
    // and the age packed at the right end, so the strip's width moves neither
    expect(BAR_ORDER).toEqual({ start: ["shown", "paging"], end: ["selected", "age"] });
    expect([...bar().children].map((c) => (c as HTMLElement).dataset.slot)).toEqual(["shown", "counts-strip", "selected"]);
    expect(bar().querySelector("[data-slot=selected]")).toHaveClass("ml-auto");
    expect(within(bar()).getByText("42 юнита")).toHaveAttribute("data-slot", "shown");
    expect(strip()).toEqual(["заблокирован1", "проверяется1", "пишется1", "готов к работе5", "черновик4", "закоммичен30"]);

    // a live read: the blocked unit is committed, a ready one goes to «отладка» — a state the strip has not shown
    const next = { ...run, version: 2, units: run.units.map((u) => (u.id === "u23" ? { ...u, state: "committed" as const } : u.id === "u24" ? { ...u, state: "debug" as const } : u)) };
    view.rerun(next);
    expect(strip()).toEqual(["заблокирован0", "проверяется1", "пишется1", "готов к работе4", "черновик4", "закоммичен31", "отладка1"]);
    // an emptied state keeps its slot with a muted 0 and a neutral dot
    const blocked = bar().querySelector("[data-slot=state-count]") as HTMLElement;
    expect(blocked.querySelector("[data-tone]")).toHaveAttribute("data-tone", "neutral");
    for (const n of bar().querySelectorAll("[data-slot=state-count] > span:last-child")) expect(n).toHaveClass("min-w-count", "tabular-nums");
  });

  test("craft-11: the strip's entries, pure — the first read's states by rank, then each new one appended", () => {
    const seen = statesOf(run.units);
    expect(seen).toEqual(["blocked", "verify", "implement", "ready", "drafted", "committed"]);
    expect(stripStates(seen, run.units)).toBe(seen);
    expect(stripStates(seen, [{ state: "land" }, { state: "debug" }])).toEqual([...seen, "land", "debug"]);
    expect(stripStates(["committed"], [{ state: "blocked" }])).toEqual(["committed", "blocked"]);
  });

  test("the held strip's line is reserved before anything waits in it (Strict 1)", () => {
    renderRun(fx, run, runPath(KEY, { view: "units" }));
    const strip = document.querySelector("[data-slot=held-strip]") as HTMLElement;
    expect(strip).toBeInTheDocument();
    expect(strip).toBeEmptyDOMElement();
  });
});
