// @vitest-environment jsdom
// Done-criteria 0, 1 and 6: the task walk of surfaces/reading.md → WALK «Отчёты» on the fixture run of 97 launches
// (and one running) over u1's handler — the rail, search and filters, the overview, the report's address with Back,
// the held strip, the fold — and the strict rules: every late part's box reserved, no skeleton.
import "../../ui/test-setup.ts";
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterAll, describe, expect, test } from "vitest";
import type { Launch } from "../../../shared/model.ts";
import { readPref } from "@/ui";
import { isSelectFilter, type FilterDef } from "@/table";
import { renderShell } from "../../app/testing.tsx";
import { runPath } from "../../app/routes.ts";
import { ReportsView, REPORT_NOT_FOUND_NEXT } from "./index.tsx";
import { commonKind, filtersFor, groupsOf, railItems, rankSurfaces } from "./model.ts";
import { OVERVIEW_EMPTY, OVERVIEW_LEAD } from "./overview.tsx";
import { OVERVIEW_ITEM } from "./rail.tsx";
import { fixtureApp, keyOf, loadedRun, NOW, renderOver, renderView } from "./testing.tsx";

const N = 40; // the production maximum: 97 launches, one more running
const SMALL = 24; // a live run of 4 launches
const INIT = 60; // an init run with no launch
const KEY = keyOf(N);
const fx = fixtureApp({ only: [N, SMALL, INIT] });
afterAll(() => fx.close());
const run = loadedRun(fx, N, KEY);

/** The rail's reports: its flat items but the first, «Обзор: оценки и токены». */
const railLinks = () => [...document.querySelectorAll<HTMLAnchorElement>("[data-slot=report-rail] [data-flat-item]:not([data-slot=rail-overview])")];
const loaded = () => waitFor(() => expect(railLinks()).toHaveLength(98), { timeout: 4000 });
const bar = () => document.querySelector("[data-slot=status-bar]") as HTMLElement;
const reportsPath = (extra: Record<string, string> = {}) => runPath(KEY, { view: "reports", ...extra });

describe("the rail's model at the production shape", () => {
  test("every launch of every kind in run order, then the running one; one heading per stage", () => {
    const items = railItems(run);
    expect(items).toHaveLength(98);
    expect(items.slice(0, 97).map((i) => i.id)).toEqual(run.launches.map((l) => l.id));
    expect(items[97]).toMatchObject({ id: "aa5b5ec85u30", description: "u30 implement", kind: "исполнитель", stage: "p2-assess" });
    const kinds = new Map<string, number>();
    for (const i of items) kinds.set(i.kind, (kinds.get(i.kind) ?? 0) + 1);
    expect(Object.fromEntries(kinds)).toEqual({ карта: 1, разведка: 1, критик: 53, исполнитель: 43 });
    const groups = groupsOf(items);
    expect(groups.map((g) => g.stage)).toEqual(["p1-map", "p1-spike", "p1-decompose", "p1-units", "p1-review", "p1-fix", "p1-verdict", "p1-assess", "p2-decompose", "p2-units", "p2-review", "p2-fix", "p2-verdict", "p2-assess"]);
    expect(groups[0].items).toHaveLength(21);
    expect(groups.reduce((n, g) => n + g.items.length, 0)).toBe(98);
  });

  test("«Агент» is a select of the kinds; «Линза» and «Раздел» grow with the run, so they are comboboxes", () => {
    const f = filtersFor(railItems(run), run);
    expect(f.agent.options.map((o) => o.label)).toEqual(["карта", "разведка", "критик", "исполнитель"]);
    expect(isSelectFilter(f.agent as FilterDef<unknown>)).toBe(true);
    expect(f.lens.options.map((o) => o.label)).toEqual(["craft", "design", "shape", "code", "runtime", "parity", "improve", "без линзы"]);
    expect(isSelectFilter(f.lens as FilterDef<unknown>)).toBe(false);
    expect(f.surface.options).toHaveLength(21);
    expect(isSelectFilter(f.surface as FilterDef<unknown>)).toBe(false);
  });

  test("craft-27: equal critical + major tie by the latest score, the lower first; a surface without scores after them", () => {
    const score = (stage: string, audit: number, critique: number) => ({ stage, launch: `${stage}-craft`, audit, auditMax: 20, critique, critiqueMax: 40 });
    const surface = (key: string, scores: ReturnType<typeof score>[]) => ({ key, label: key, scores, frames: [], findings: 1 });
    const ranked = rankSurfaces(
      [surface("a", [score("p1-map", 18, 36)]), surface("b", []), surface("c", [score("p1-map", 10, 20)]), surface("d", [score("p1-map", 19, 39), score("p2-assess", 9, 18)])],
      ["a", "b", "c", "d"].map((s) => ({ surface: s, severity: "major" as const })),
    );
    // d's latest pass scored 9/20 and 18/40 — below c's 10/20 and 20/40 — though its first pass scored best
    expect(ranked.map((s) => s.key)).toEqual(["d", "c", "a", "b"]);
  });

  test("the overview ranks surfaces by critical + major, then by key", () => {
    const ranked = rankSurfaces(
      [
        { key: "a", label: "a", scores: [], frames: [], findings: 0 },
        { key: "b", label: "b", scores: [], frames: [], findings: 0 },
        { key: "c", label: "c", scores: [], frames: [], findings: 0 },
      ],
      [
        { surface: "c", severity: "major" },
        { surface: "c", severity: "minor" },
        { surface: "b", severity: "critical" },
        { surface: "b", severity: "major" },
        { surface: "a", severity: "minor" },
      ],
    );
    expect(ranked.map((s) => [s.key, s.critical, s.major])).toEqual([
      ["b", 1, 1],
      ["c", 0, 1],
      ["a", 0, 0],
    ]);
  });
});

describe("the task walk (surfaces/reading.md → WALK «Отчёты»)", () => {
  test("1: before the run is read, «Загрузка…» with a spinner holds the view's place", async () => {
    renderShell(fx.transport, { path: reportsPath() });
    expect(screen.getAllByRole("status").some((s) => s.textContent === "Загрузка…")).toBe(true);
    await loaded();
  });

  test("1: the rail is one flat list — one Tab stop, ↑/↓, Enter — with stage headings, kind words and states", async () => {
    const user = userEvent.setup({ delay: null });
    const view = renderView(fx, KEY, reportsPath(), ReportsView);
    await loaded();
    const rail = screen.getByRole("group", { name: "Отчёты прогона" });
    // with no report open the stop is the overview, the open item (craft-27)
    expect([...rail.querySelectorAll<HTMLElement>("[data-flat-item]")].filter((a) => a.tabIndex === 0)).toEqual([rail.querySelector("[data-slot=rail-overview]")]);
    const headings = [...rail.querySelectorAll<HTMLElement>("[data-slot=rail-heading]")];
    expect(headings.map((h) => h.textContent)).toEqual([
      "карта· проход 121",
      "разведка· проход 11",
      "декомпозиция· проход 17",
      "юниты в работе· проход 116",
      "ревью· проход 14",
      "исправление· проход 15",
      "проверка исправлений· проход 12",
      "приёмка· проход 14",
      "декомпозиция· проход 27",
      "юниты в работе· проход 216",
      "ревью· проход 23",
      "исправление· проход 25",
      "проверка исправлений· проход 22",
      "приёмка· проход 25",
    ]);
    for (const h of headings) expect(h.tabIndex).toBe(-1);
    // a craft critic: description, no kind word — its group's 20 critics share it (cand-2), findings by severity as
    // plain text
    const craft = railLinks().find((a) => a.dataset.flatItem === "p1-map-craft-accounts") as HTMLElement;
    expect(craft).toHaveTextContent("craft accounts");
    expect(craft.querySelector("[data-slot=rail-kind]")).toBeNull();
    expect(within(craft).getByText("3 critical · 6 major · 9 minor")).toBeInTheDocument();
    // the running launch: «работает · 12 мин», neutral, so no dot; an implementer: its result
    const running = railLinks().at(-1) as HTMLElement;
    expect(running).toHaveTextContent("u30 implement");
    expect(within(running).getByText("работает · 12 мин")).toBeInTheDocument();
    expect(running.querySelector("[data-slot=dot]")).toBeNull();
    const implement = railLinks().find((a) => a.dataset.flatItem === "p1-units-u1-implement") as HTMLElement;
    expect(within(implement).getByText("итог: done · 1 находка")).toBeInTheDocument();
    const verdict = railLinks().find((a) => a.dataset.flatItem === "p1-verdict-critic-code-verdict") as HTMLElement;
    expect(within(verdict).getByText("1 resolved · 1 partial · 0 unresolved")).toBeInTheDocument();

    // ↑/↓ move the one stop; Enter opens the report and pushes its address
    railLinks()[0].focus();
    await user.keyboard("{ArrowDown}{ArrowDown}");
    expect(railLinks()[2]).toHaveFocus();
    expect(railLinks().filter((a) => a.tabIndex === 0)).toEqual([railLinks()[2]]);
    await user.keyboard("{Enter}");
    await waitFor(() => expect(new URLSearchParams(view.probe.location?.search).get("report")).toBe(railLinks()[2].dataset.flatItem));
    expect(screen.getByRole("heading", { level: 2, name: "craft bots" })).toBeInTheDocument();
  });

  test("craft-34, cand-2: the kind word only on a row whose kind differs from its group's most common one; a dot only where a state asks for the operator", async () => {
    const view = renderView(fx, KEY, reportsPath(), ReportsView);
    await loaded();
    const link = (id: string) => railLinks().find((a) => a.dataset.flatItem === id) as HTMLElement;
    const kind = (id: string) => link(id).querySelector("[data-slot=rail-kind]");
    // «карта · проход 1» holds the map and 20 craft critics: only the map says its kind, the 20 critics keep it in
    // their title
    expect(kind("p1-map-map")).toHaveTextContent(/^карта$/);
    expect(kind("p1-map-craft-accounts")).toBeNull();
    expect(link("p1-map-craft-accounts").title).toMatch(/ — критик$/);
    // and the running implementer among «приёмка · проход 2»'s critics
    expect(railLinks().filter((a) => a.querySelector("[data-slot=rail-kind]")).map((a) => [a.dataset.flatItem, a.querySelector("[data-slot=rail-kind]")?.textContent])).toEqual([
      ["p1-map-map", "карта"],
      ["aa5b5ec85u30", "исполнитель"],
    ]);
    expect(commonKind(groupsOf(railItems(run))[0].items)).toBe("критик");
    // a tie keeps the kind that came first: two kinds, one row each, mark the second
    expect(commonKind([{ kind: "карта" }, { kind: "критик" }])).toBe("карта");
    // «ревью · проход 1» holds critics alone and «юниты в работе · проход 1» implementers alone: no kind word, the
    // item's title keeps it
    expect(kind("p1-review-critic-code")).toBeNull();
    expect(link("p1-review-critic-code").title).toMatch(/ — критик$/);
    expect(kind("p1-units-u1-implement")).toBeNull();
    // findings by severity, results and running launches are plain text: no dot ranks nothing on 98 rows
    expect(railLinks().filter((a) => a.querySelector("[data-slot=dot]"))).toEqual([]);
    view.unmount();

    // a launch whose report is missing waits on the operator: its row alone carries the amber dot
    const l: Launch = { ...(run.launches.find((x) => x.id === "p1-map-craft-bots") as Launch), reportMissing: true };
    renderOver(fx, { ...run, launches: run.launches.map((x) => (x.id === l.id ? l : x)) }, reportsPath(), ReportsView);
    expect(railLinks().filter((a) => a.querySelector("[data-slot=dot]")).map((a) => a.dataset.flatItem)).toEqual(["p1-map-craft-bots"]);
    expect(link("p1-map-craft-bots").querySelector("[data-slot=dot]")).toHaveAttribute("data-tone", "warning");
    expect(within(link("p1-map-craft-bots")).getByText("нет отчёта")).toBeInTheDocument();
  });

  test("2: search and the «Агент», «Линза», «Раздел» filters with counts, persisted as view state; filtered to none", async () => {
    const user = userEvent.setup({ delay: null });
    renderView(fx, KEY, reportsPath(), ReportsView);
    await loaded();
    expect([...document.querySelectorAll<HTMLElement>("[data-toolbar-item]")].map((el) => el.dataset.toolbarItem)).toEqual(["search", "filter-agent", "filter-lens", "filter-surface", "report-picker"]);
    expect(screen.getByRole("combobox", { name: "Агент" })).toHaveTextContent(/^Агент:все$/);
    expect(bar()).toHaveTextContent("98 запусков агента");

    await user.click(screen.getByRole("combobox", { name: "Раздел: все" }));
    await user.click(await screen.findByRole("option", { name: /^accounts/ }));
    await waitFor(() => expect(railLinks().map((a) => a.dataset.flatItem)).toEqual(["p1-map-craft-accounts"]));
    expect(bar()).toHaveTextContent("1 из 98 запусков агента");
    expect(readPref<{ filters: Record<string, string[]> }>(`table:reports:run:${KEY}`, { filters: {} }).filters.surface).toEqual(["accounts"]);
    await user.keyboard("{Escape}");

    const search = screen.getByRole("searchbox");
    expect(search).toHaveAttribute("placeholder", "Описание, id запуска, раздел");
    await user.click(search);
    await user.paste("ни-одного-такого");
    expect(await screen.findByText("Нет отчётов, подходящих под фильтры")).toBeInTheDocument();
    expect(screen.getByText("Фильтры: Раздел: accounts · Поиск: «ни-одного-такого»")).toBeInTheDocument();
    // craft-27: the way back to the overview stays above the empty rail
    expect(document.querySelector("[data-slot=report-rail] [data-slot=rail-overview]")).toHaveTextContent("Обзор: оценки и токены");
    await user.click(screen.getByRole("button", { name: "Сбросить фильтры" }));
    await loaded();

    // an id token matches any id: the u30 implementer's record and the running u30 agent
    await user.click(search);
    await user.paste("u30");
    await waitFor(() => expect(railLinks().map((a) => a.dataset.flatItem)).toEqual(["p2-units-u30-implement", "aa5b5ec85u30"]));
  });

  test("1: no report chosen — the overview: surfaces ranked by critical + major, each score a link to its stage's report", async () => {
    renderView(fx, KEY, reportsPath(), ReportsView);
    await loaded();
    const overview = document.querySelector("[data-slot=reports-overview]") as HTMLElement;
    expect(within(overview).getByRole("heading", { name: "Разделы интерфейса" })).toBeInTheDocument();
    const lines = [...overview.querySelectorAll<HTMLElement>("li[data-surface]")];
    expect(lines).toHaveLength(20);
    // every surface was judged once at the map: 3 critical and 6 major each, so the score orders them, the lowest
    // first (accounts 8/20 · 18/40, bots 9 · 19 …), equal scores by key (craft-27)
    expect(lines.map((l) => l.dataset.surface)).toEqual(["accounts", "bots", "campaigns", "chats", "dialogs", "seo", "journal", "settings", "leads", "shell", "notifications", "sign-in", "traffic", "overview", "proxies", "users", "roles", "warmup", "schedules", "workers"]);
    const accounts = lines[0];
    expect(accounts).toHaveTextContent("3 critical");
    expect(accounts).toHaveTextContent("6 major");
    expect(accounts).toHaveTextContent("аудит 8 из 20");
    expect(accounts).toHaveTextContent("критика 18 из 40");
    const links = within(accounts).getAllByRole("link");
    expect(links.map((a) => a.getAttribute("href"))).toEqual([reportsPath({ report: "p1-map-craft-accounts" }), reportsPath({ report: "p1-map-craft-accounts" })]);
  });

  test("craft-27, u6-shape cand-1: the wide rail opens on «Обзор: оценки и токены» — the overview's address, current while no report is open", async () => {
    const user = userEvent.setup({ delay: null });
    const view = renderView(fx, KEY, reportsPath({ report: "p1-map-craft-accounts" }), ReportsView);
    await loaded();
    const rail = screen.getByRole("group", { name: "Отчёты прогона" });
    const overview = rail.querySelectorAll<HTMLAnchorElement>("[data-flat-item]")[0];
    expect(overview).toHaveAttribute("data-slot", "rail-overview");
    // the overview holds the scores and the tokens: its name says both
    expect(overview).toHaveTextContent(/^Обзор: оценки и токены$/);
    expect(OVERVIEW_ITEM.split(/\s+/)).toHaveLength(4);
    expect(overview).toHaveAttribute("href", reportsPath());
    expect(overview).not.toHaveAttribute("aria-current");
    // its box is reserved like a report's: one line, a fixed height
    expect(overview).toHaveClass("h-9", "shrink-0");
    // one more stop of the same list: ↑ from the first report reaches it, Enter opens the overview
    railLinks()[0].focus();
    await user.keyboard("{ArrowUp}");
    expect(overview).toHaveFocus();
    await user.keyboard("{Enter}");
    await waitFor(() => expect(new URLSearchParams(view.probe.location?.search).get("report")).toBeNull());
    expect(document.querySelector("[data-slot=reports-overview]")).toBeInTheDocument();
    expect(overview).toHaveAttribute("aria-current", "page");
  });

  test("craft-27: the overview's lead and its empty line name no side — the list is on the left only in the wide view", () => {
    expect(OVERVIEW_LEAD).toBe(
      "Критики craft оценивали эти разделы; сначала идут те, где больше находок critical и major, а при равенстве — с более низкой оценкой. Оценки — аудит из 20 и критика из 40 по этапам прогона; каждое число открывает отчёт, который его поставил. Отчёт любого запуска выбирается в списке отчётов.",
    );
    expect(OVERVIEW_LEAD.split(/\s+/)).toHaveLength(48);
    expect(OVERVIEW_EMPTY).toBe("Критики craft не оценивали разделов интерфейса в этом прогоне — выберите отчёт в списке отчётов.");
    expect(OVERVIEW_EMPTY.split(/\s+/)).toHaveLength(15);
    for (const s of [OVERVIEW_LEAD, OVERVIEW_EMPTY, REPORT_NOT_FOUND_NEXT]) expect(s).not.toMatch(/слева|справа/);
  });

  test("3–6: opening a report pushes its address, the tab is `tab=`, Back returns to the same report, tab and scroll", async () => {
    const user = userEvent.setup({ delay: null });
    const view = renderView(fx, KEY, reportsPath(), ReportsView);
    await loaded();
    const link = (id: string) => railLinks().find((a) => a.dataset.flatItem === id) as HTMLElement;
    await user.click(link("p1-map-craft-accounts"));
    await waitFor(() => expect(view.probe.location?.search).toBe(`?view=reports&report=p1-map-craft-accounts`));
    expect(link("p1-map-craft-accounts")).toHaveAttribute("aria-current", "page");
    await user.click(screen.getByRole("tab", { name: /^Не проверено/ }));
    await waitFor(() => expect(new URLSearchParams(view.probe.location?.search).get("tab")).toBe("unverified"));
    const scroller = document.querySelector("[data-slot=report-reader-scroll]") as HTMLElement;
    scroller.scrollTop = 240;
    fireEvent.scroll(scroller);

    await user.click(link("p1-map-craft-bots"));
    await waitFor(() => expect(new URLSearchParams(view.probe.location?.search).get("report")).toBe("p1-map-craft-bots"));
    expect(scroller.scrollTop).toBe(0);
    expect(screen.getByRole("tab", { name: /^Находки/ })).toHaveAttribute("aria-selected", "true");

    act(() => void view.probe.navigate?.(-1));
    await waitFor(() => expect(new URLSearchParams(view.probe.location?.search).get("report")).toBe("p1-map-craft-accounts"));
    expect(new URLSearchParams(view.probe.location?.search).get("tab")).toBe("unverified");
    expect(screen.getByRole("tab", { name: /^Не проверено/ })).toHaveAttribute("aria-selected", "true");
    expect(scroller.scrollTop).toBe(240);
  });

  test("an unknown id in the URL reads «Отчёт <id> не найден», the overview under it", async () => {
    renderView(fx, KEY, reportsPath({ report: "p9-review-critic-none" }), ReportsView);
    await loaded();
    expect(document.querySelector("[data-slot=report-missing]")).toHaveTextContent("Отчёт p9-review-critic-none не найден: в этом прогоне нет такого запуска — выберите отчёт в списке");
    expect(document.querySelector("[data-slot=reports-overview]")).toBeInTheDocument();
  });

  test("a report the filters hide shows anyway, «вне фильтра»", async () => {
    const user = userEvent.setup({ delay: null });
    renderView(fx, KEY, reportsPath({ report: "p1-map-map" }), ReportsView);
    await loaded();
    await user.click(screen.getByRole("searchbox"));
    await user.paste("p1-map-craft-accounts");
    await waitFor(() => expect(railLinks().map((a) => a.dataset.flatItem)).toEqual(["p1-map-map", "p1-map-craft-accounts"]));
    expect(within(railLinks()[0]).getByText("вне фильтра")).toBeInTheDocument();
    expect(bar()).toHaveTextContent("1 из 98 запусков агента");
  });

  test("empty: a run with no launch yet names the stage that brings the first report; never, for an init run", async () => {
    renderView(fx, keyOf(INIT), runPath(keyOf(INIT), { view: "reports" }), ReportsView);
    expect(await screen.findByText("В этом прогоне не было отчётов")).toBeInTheDocument();
    const open = { ...loadedRun(fx, SMALL, keyOf(SMALL)), launches: [] as Launch[], running: [], surfaces: [] };
    renderOver(fx, open, runPath(keyOf(SMALL), { view: "reports" }), ReportsView);
    expect(screen.getByText("Отчётов ещё нет — они появятся на этапе «карта»")).toBeInTheDocument();
  });
});

describe("live: new launches wait in the rail's strip (Live data 1)", () => {
  test("a new launch waits; a running one that ended keeps its place, «завершён»; the strip places both", async () => {
    const user = userEvent.setup({ delay: null });
    const small = loadedRun(fx, SMALL, keyOf(SMALL));
    const withRunning = { ...small, running: [{ agentId: "a77", description: "u2 implement", agent: "fsloop-implement", name: "u2 · исполнитель", startedAt: new Date(NOW - 4 * 60_000).toISOString(), lastAt: null }] };
    const view = renderOver(fx, withRunning, runPath(keyOf(SMALL), { view: "reports", report: "a77" }), ReportsView);
    const ids = () => railLinks().map((a) => a.dataset.flatItem);
    expect(ids()).toEqual([...small.launches.map((l) => l.id), "a77"]);
    expect(within(railLinks()[4]).getByText("работает · 4 мин")).toBeInTheDocument();
    const strip = document.querySelector("[data-slot=held-strip]") as HTMLElement;
    expect(strip).toHaveClass("h-strip");
    expect(strip).toHaveTextContent("");

    // the launch ended (its record arrived under its own id) and a critic started: the rail does not move
    const ended: Launch = { ...small.launches[3], id: "p1-units-u2-implement", description: "u2 implement", unit: "u2" };
    view.again({ ...small, version: 2, launches: [...small.launches, ended], running: [] });
    expect(ids()).toEqual([...small.launches.map((l) => l.id), "a77"]);
    expect(within(railLinks()[4]).getByText("завершён")).toBeInTheDocument();
    expect(strip).toHaveTextContent("1 новый отчёт · 1 отчёт сместился · показать");
    // the reader follows the ended launch to its record
    expect(screen.getByRole("heading", { level: 2, name: "u2 implement" })).toBeInTheDocument();
    expect(document.querySelector("[data-slot=report-id]")).toHaveTextContent("p1-units-u2-implement");

    await user.click(within(strip).getByRole("button"));
    expect(ids()).toEqual([...small.launches.map((l) => l.id), "p1-units-u2-implement"]);
    expect(strip).toHaveTextContent("");
  });
});

describe("the strict rules (rules/ui → Strict)", () => {
  test("no layout shift: every late part's box is reserved — rail rows, strip, status bar, tab counts, toolbar selects, picker", async () => {
    renderView(fx, KEY, reportsPath({ report: "p1-map-craft-accounts" }), ReportsView);
    await loaded();
    for (const a of railLinks()) expect(a).toHaveClass("h-11");
    for (const h of document.querySelectorAll("[data-slot=rail-heading]")) expect(h).toHaveClass("h-7");
    expect(document.querySelector("[data-slot=report-rail] [data-slot=held-strip]")).toHaveClass("h-strip", "shrink-0");
    expect(document.querySelector("[data-slot=rail-scroll]")).toHaveClass("[scrollbar-gutter:stable]");
    expect(document.querySelector("[data-slot=report-reader-scroll]")).toHaveClass("[scrollbar-gutter:stable]");
    expect(bar()).toHaveClass("h-8", "shrink-0");
    for (const c of document.querySelectorAll("[data-slot=report-sections] [data-slot=tab-count]")) expect(c).toHaveClass("min-w-count", "tabular-nums");
    // a filter's trigger hugs the value the user picked — the change is the user's own click (ui → Widths; f9)
    for (const id of ["filter-agent", "filter-lens", "filter-surface"]) expect(document.querySelector(`[data-toolbar-item=${id}] [data-slot=toolbar-sizer]`)).toBeNull();
    // the report's sections: a sticky strip, each finding one 32 px row (craft-13)
    expect(document.querySelector("[data-slot=report-sections] [role=tablist]")).toHaveClass("sticky", "top-0", "group-data-horizontal/tabs:h-10");
    for (const r of document.querySelectorAll("[data-slot=report-findings] [data-slot=finding-row]")) expect(r).toHaveClass("h-8");
    // the ‹ › of the reader hold their place at both ends of the list
    expect(document.querySelector("[data-slot=report-neighbours]")?.children).toHaveLength(2);
    // the fold: the rail's region and the picker both exist, the container decides which shows (cand-4: the picker
    // is the toolbar's, no line of its own)
    expect(document.querySelector("[data-slot=report-rail]")).toHaveClass("hidden", "@min-[52rem]/reports:flex", "w-60");
    expect(document.querySelector("[data-slot=report-picker]")).toBeNull();
    const picker = within(document.querySelector("[data-toolbar-item=report-picker]") as HTMLElement).getByRole("combobox");
    expect(picker).toHaveClass("@min-[52rem]/reports:hidden");
  });
});

describe("cand-4: the narrow view's «Отчёт» picker", () => {
  test("cand-4: in the toolbar, its options naming each report's stage and state as the rail does", async () => {
    const user = userEvent.setup({ delay: null });
    renderView(fx, KEY, reportsPath({ report: "p1-map-craft-accounts" }), ReportsView);
    await loaded();
    const picker = screen.getByRole("combobox", { name: "Отчёт: craft accounts · карта, проход 1 · 3 critical · 6 major · 9 minor" });
    await user.click(picker);
    const options = (await screen.findAllByRole("option")).map((o) => o.textContent);
    expect(options).toHaveLength(98);
    expect(options).toContain("craft accounts · карта, проход 1 · 3 critical · 6 major · 9 minor");
    expect(options).toContain("u1 implement · юниты в работе, проход 1 · итог: done · 1 находка");
    expect(options).toContain("critic code verdict · проверка исправлений, проход 1 · 1 resolved · 1 partial · 0 unresolved");
    expect(options.at(-1)).toBe("u30 implement · приёмка, проход 2 · работает · 12 мин");
  });
});

describe("cand-8: the rail's focus", () => {
  test("cand-8: a focused item wears a 2 px ring in full muted ink — apart from the open item's 1 px ink mark", async () => {
    renderView(fx, KEY, reportsPath({ report: "p1-map-craft-accounts" }), ReportsView);
    await loaded();
    for (const a of [document.querySelector("[data-slot=rail-overview]") as HTMLElement, ...railLinks()]) {
      expect(a).toHaveClass("focus-visible:ring-2", "focus-visible:ring-ring", "focus-visible:ring-inset");
      expect(a.className).not.toMatch(/ring-ring\/50/);
    }
    expect(railLinks().find((a) => a.dataset.flatItem === "p1-map-craft-accounts")).toHaveClass("shadow-target");
  });
});

describe("u6-shape cand-1: tokens by stage and by agent kind in the overview", () => {
  const spend = (input: number, output: number, cacheWrite: number, cacheRead: number) => ({ input, output, cacheWrite, cacheRead });
  const tokens = {
    stage: [
      { key: "p1-map", launches: 21, spend: spend(900, 40_000, 250_000, 3_100_000) },
      { key: "p1-review", launches: 4, spend: spend(0, 0, 0, 1_700_000) },
    ],
    kind: [
      { key: "карта", launches: 1, spend: spend(900, 40_000, 250_000, 3_100_000) },
      { key: "критик", launches: 24, spend: spend(0, 0, 0, 1_700_000) },
    ],
  };

  test("u6-shape cand-1: «Расход токенов» — each stage and each kind with its launches and its tokens, the split in the title", () => {
    renderOver(fx, { ...run, tokens }, reportsPath(), ReportsView);
    const section = document.querySelector("[data-slot=reports-spend]") as HTMLElement;
    expect(within(section).getByRole("heading", { level: 2 })).toHaveTextContent(/^Расход токенов$/);
    const rows = (name: string) => [...within(section).getByRole("region", { name }).querySelectorAll<HTMLElement>("[data-slot=fact]")].map((r) => [r.querySelector("dt")?.textContent, r.querySelector("dd")?.textContent]);
    expect(rows("По этапам")).toEqual([
      ["проход 1 · карта", "21 запуск агента · 3,4 млн токенов"],
      ["проход 1 · ревью", "4 запуска агента · 1,7 млн токенов"],
    ]);
    expect(rows("По агентам")).toEqual([
      ["карта", "1 запуск агента · 3,4 млн токенов"],
      ["критик", "24 запуска агента · 1,7 млн токенов"],
    ]);
    const first = section.querySelector("[data-slot=fact] dd span") as HTMLElement;
    expect(first).toHaveAttribute("title", "вход 900 · выход 40 000 · запись в кэш 250 000 · чтение кэша 3 100 000");
    // it follows the surfaces, which the overview leads with
    const surfaces = document.querySelector("[data-slot=reports-overview]") as HTMLElement;
    expect(surfaces.compareDocumentPosition(section) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  test("u6-shape cand-1: a run whose launches recorded no tokens says so, never a zero", () => {
    renderOver(fx, { ...run, tokens: { stage: [], kind: [] } }, reportsPath(), ReportsView);
    expect(document.querySelector("[data-slot=reports-spend] [data-slot=spend-none]")).toHaveTextContent(/^не записано: в записях запусков прогона нет токенов$/);
  });
});
