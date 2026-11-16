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
import { ReportsView } from "./index.tsx";
import { filtersFor, groupsOf, railItems, rankSurfaces } from "./model.ts";
import { fixtureApp, keyOf, loadedRun, NOW, renderOver, renderView } from "./testing.tsx";

const N = 40; // the production maximum: 97 launches, one more running
const SMALL = 24; // a live run of 4 launches
const INIT = 60; // an init run with no launch
const KEY = keyOf(N);
const fx = fixtureApp({ only: [N, SMALL, INIT] });
afterAll(() => fx.close());
const run = loadedRun(fx, N, KEY);

const railLinks = () => [...document.querySelectorAll<HTMLAnchorElement>("[data-slot=report-rail] [data-flat-item]")];
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
    expect(railLinks().filter((a) => a.tabIndex === 0)).toHaveLength(1);
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
    // a craft critic: description, kind word, findings by severity in the worst one's tone
    const craft = railLinks().find((a) => a.dataset.flatItem === "p1-map-craft-accounts") as HTMLElement;
    expect(craft).toHaveTextContent("craft accounts");
    expect(craft).toHaveTextContent("критик");
    expect(within(craft).getByText("3 critical · 6 major · 9 minor")).toBeInTheDocument();
    expect(craft.querySelector("[data-slot=dot]")).toHaveAttribute("data-tone", "danger");
    // the running launch: a neutral «работает · 12 мин»; an implementer: its result
    const running = railLinks().at(-1) as HTMLElement;
    expect(running).toHaveTextContent("u30 implement");
    expect(within(running).getByText("работает · 12 мин")).toBeInTheDocument();
    expect(running.querySelector("[data-slot=dot]")).toHaveAttribute("data-tone", "neutral");
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

  test("2: search and the «Агент», «Линза», «Раздел» filters with counts, persisted as view state; filtered to none", async () => {
    const user = userEvent.setup({ delay: null });
    renderView(fx, KEY, reportsPath(), ReportsView);
    await loaded();
    expect([...document.querySelectorAll<HTMLElement>("[data-toolbar-item]")].map((el) => el.dataset.toolbarItem)).toEqual(["search", "filter-agent", "filter-lens", "filter-surface"]);
    expect(screen.getByRole("combobox", { name: "Агент" })).toHaveTextContent("Агент:все98");
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
    // every surface was judged once at the map: 3 critical and 6 major each, so the key orders them
    expect(lines.map((l) => l.dataset.surface)).toEqual([...run.surfaces.map((s) => s.key)].sort());
    const accounts = lines[0];
    expect(accounts).toHaveTextContent("3 critical");
    expect(accounts).toHaveTextContent("6 major");
    expect(accounts).toHaveTextContent("аудит 8 из 20");
    expect(accounts).toHaveTextContent("критика 18 из 40");
    const links = within(accounts).getAllByRole("link");
    expect(links.map((a) => a.getAttribute("href"))).toEqual([reportsPath({ report: "p1-map-craft-accounts" }), reportsPath({ report: "p1-map-craft-accounts" })]);
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
    const agent = document.querySelector("[data-toolbar-item=filter-agent]") as HTMLElement;
    expect(agent.style.minWidth).toMatch(/^calc\(/);
    for (const t of screen.getAllByRole("button", { name: /^Открыть кадр / })) expect(t).toHaveClass("h-thumb-h", "w-thumb-w");
    // the fold: the rail's region and the picker's line both exist, the container decides which shows
    expect(document.querySelector("[data-slot=report-rail]")).toHaveClass("hidden", "@min-[52rem]/reports:flex", "w-60");
    const picker = document.querySelector("[data-slot=report-picker]") as HTMLElement;
    expect(picker).toHaveClass("h-10", "@min-[52rem]/reports:hidden");
    expect(within(picker).getByRole("combobox", { name: "Отчёт: craft accounts · критик" })).toBeInTheDocument();
  });
});
