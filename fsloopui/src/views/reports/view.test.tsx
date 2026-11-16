// @vitest-environment jsdom
// Done-criteria 0, 1 and 6: the task walk of surfaces/reading.md → WALK «Отчёты» on the fixture run of 97 launches
// (and one running) over u1's handler — the rail, search and filters, the overview, the report's address with Back,
// the held strip, the fold — and the strict rules: every late part's box reserved, no skeleton.
import "../../ui/test-setup.ts";
import { act, cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterAll, describe, expect, test, vi } from "vitest";
import type { Launch } from "../../../shared/model.ts";
import { glossaryLines, missingText, readPref } from "@/ui";
import { isSelectFilter, type FilterDef } from "@/table";
import { applyStylesheet, innerWidth, textWidth, usedBlockSize } from "../../app/layout-testing.ts";
import { renderShell } from "../../app/testing.tsx";
import { runPath } from "../../app/routes.ts";
import { ReportsView } from "./index.tsx";
import { commonKind, filtersFor, groupsOf, itemState, pickerLabel, railItems, rankSurfaces, sharedResultText, type RailItem } from "./model.ts";
import { OVERVIEW_EMPTY, OVERVIEW_LEAD } from "./overview.tsx";
import { OVERVIEW_ITEM } from "./rail.tsx";
import { SCORES_GLOSSARY } from "./scores.tsx";
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
    // improve-10 (3): an implementer whose result its group shares reads how long it took — «итог» only where it differs
    const implement = railLinks().find((a) => a.dataset.flatItem === "p1-units-u1-implement") as HTMLElement;
    expect(within(implement).getByText("завершён за 9 мин · 1 находка")).toBeInTheDocument();
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

  test("improve-10 (3): a heading's count names its noun in its title; «итог: done» only on a row whose result differs from its group's", async () => {
    // one implementer of «юниты в работе · проход 1» blocked: it says so, its 15 neighbours do not repeat «done»
    const own = run.launches.filter((l) => l.stage === "p1-units" && l.agent === "fsloop-implement");
    expect(own.length).toBeGreaterThan(2);
    const blocked = own[2];
    const over = { ...run, launches: run.launches.map((l) => (l.id === blocked.id ? { ...l, sections: { ...l.sections, RESULT: { value: "blocked", items: [] } } } : l)) };
    renderOver(fx, over, reportsPath(), ReportsView);
    const titles = [...document.querySelectorAll<HTMLElement>("[data-slot=rail-heading] [data-slot=rail-count]")].map((c) => c.title);
    expect(titles).toEqual(["21 отчёт", "1 отчёт", "7 отчётов", "16 отчётов", "4 отчёта", "5 отчётов", "2 отчёта", "4 отчёта", "7 отчётов", "16 отчётов", "3 отчёта", "5 отчётов", "2 отчёта", "5 отчётов"]);
    const state = (id: string) => (railLinks().find((a) => a.dataset.flatItem === id) as HTMLElement).querySelector("[data-slot=rail-state]")?.textContent;
    expect(state(blocked.id)).toMatch(/^итог: blocked/);
    expect(own.filter((l) => l.id !== blocked.id).map((l) => state(l.id)).filter((t) => t?.startsWith("итог:"))).toEqual([]);
    // the picker stands in for the rail with no group beside it: its options keep every result
    expect(pickerLabel(railItems(over).find((i) => i.id === own[0].id) as RailItem, itemState(railItems(over).find((i) => i.id === own[0].id) as RailItem, over.findings, NOW))).toMatch(/· итог: done/);
  });

  test("improve-10 (4), design-6: the rail's scroller pads its top by the sticky heading's height; a report revealed above it lands under the heading, 8 px clear", async () => {
    renderOver(fx, run, reportsPath(), ReportsView);
    const scroller = document.querySelector("[data-slot=rail-scroll]") as HTMLElement;
    const heading = document.querySelector("[data-slot=rail-heading]") as HTMLElement;
    await applyStylesheet();
    // ↑/↓ move focus through the browser, which keeps a focused item below the scroll padding
    expect(getComputedStyle(heading).height).toBe("28px");
    expect(getComputedStyle(scroller).scrollPaddingTop).toBe(getComputedStyle(heading).height);
    cleanup();
    // jsdom lays nothing out: the rail's box 100 px down, 400 px high, each item 44 px under the one before it
    const target = "p1-units-u10-implement";
    const rects = vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
      const box = document.querySelector("[data-slot=rail-scroll]") as HTMLElement | null;
      const items = [...document.querySelectorAll<HTMLElement>("[data-slot=report-rail] [data-flat-item]")];
      const at = items.indexOf(this);
      const scrolled = box?.scrollTop ?? 0;
      const top = this.dataset.slot === "rail-scroll" ? 100 : at >= 0 ? 100 + at * 44 - scrolled : 0;
      const height = this.dataset.slot === "rail-scroll" ? 400 : 44;
      return { top, bottom: top + height, left: 0, right: 0, width: 0, height, x: 0, y: top, toJSON: () => ({}) } as DOMRect;
    });
    try {
      const view = renderOver(fx, run, reportsPath(), ReportsView);
      const box = document.querySelector("[data-slot=rail-scroll]") as HTMLElement;
      const at = [...document.querySelectorAll<HTMLElement>("[data-slot=report-rail] [data-flat-item]")].findIndex((el) => el.dataset.flatItem === target);
      // the rail scrolled past the report — and a report 10 px under the scroller's top, under the heading
      for (const past of [at * 44 + 200, at * 44 - 10]) {
        act(() => void (box.scrollTop = past));
        act(() => void view.probe.navigate?.(reportsPath({ report: target })));
        const top = (railLinks().find((a) => a.dataset.flatItem === target) as HTMLElement).getBoundingClientRect().top;
        // its top 8 px below the 28 px heading's bottom
        expect(top - 100).toBe(28 + 8);
        act(() => void view.probe.navigate?.(reportsPath()));
      }
    } finally {
      rects.mockRestore();
    }
  });

  test("1: no report chosen — the overview: surfaces ranked by critical + major, each score a link to its stage's report", async () => {
    renderView(fx, KEY, reportsPath(), ReportsView);
    await loaded();
    const overview = document.querySelector("[data-slot=reports-overview]") as HTMLElement;
    // improve-12 (1): one name — the rail item's words head the place it opens
    expect(within(overview).getByRole("heading", { level: 2 })).toHaveTextContent(/^Обзор: оценки и токены$/);
    expect(within(overview).queryByRole("heading", { name: "Разделы интерфейса" })).toBeNull();
    // design-20: the lines are a list for a screen reader too
    expect(overview.querySelector("ol")).toHaveAttribute("role", "list");
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
    expect(OVERVIEW_EMPTY).toBe("Критики craft не оценивали разделов интерфейса в этом прогоне — выберите отчёт в списке отчётов.");
    expect(OVERVIEW_EMPTY.split(/\s+/)).toHaveLength(15);
    for (const s of [OVERVIEW_LEAD.join(""), OVERVIEW_EMPTY, missingText({ kind: "report", count: 98 }, "p9-review-critic-none")]) expect(s).not.toMatch(/слева|справа/);
  });

  test("improve-12 (2, 3), design-13, Strict 1: the lead is one line from first paint — «Оценки» its glossary term, the scores' one constant", async () => {
    const user = userEvent.setup({ delay: null });
    renderOver(fx, run, reportsPath(), ReportsView);
    const lead = document.querySelector("[data-slot=overview-lead]") as HTMLElement;
    const text = "Оценки разделов; первыми — где больше находок critical и major · Расход токенов";
    expect(lead).toHaveTextContent(new RegExp(`^${text}$`));
    expect(OVERVIEW_LEAD.join("")).toBe(text);
    expect(text.split(/\s+/)).toHaveLength(13);
    await applyStylesheet();
    // one line: its 20 px box, and the words at the body's 13 px within the 75-character measure (75 × 7.5 px)
    expect(usedBlockSize(lead)).toBe(20);
    expect(textWidth(text)).toBeLessThanOrEqual(75 * 7.5);
    // the term the lead names for the whole set carries its glossary, once — never a line of the list
    const term = within(lead).getByRole("button", { name: "Оценки" });
    expect(term).toHaveAttribute("data-slot", "glossary-term");
    expect(document.querySelectorAll("[data-slot=reports-overview] [data-slot=glossary-term]")).toHaveLength(1);
    await user.hover(term);
    expect(await screen.findByRole("tooltip")).toHaveTextContent(glossaryLines(SCORES_GLOSSARY).join(""));
  });

  test("improve-12 (4), design-18: «Расход токенов» in the lead brings the spend into view in the reader's own scroller — no hash, nothing above it moving", async () => {
    const user = userEvent.setup({ delay: null });
    const into = vi.spyOn(HTMLElement.prototype, "scrollIntoView");
    const box = () => document.querySelector("[data-slot=report-reader-scroll]") as HTMLElement;
    // jsdom lays nothing out: the reader's box 100 px down; the spend 1 500 px into it
    const rects = vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
      const top = this.dataset.slot === "report-reader-scroll" ? 100 : this.dataset.slot === "reports-spend" ? 1600 - box().scrollTop : 0;
      return { top, bottom: top + 20, left: 0, right: 0, width: 0, height: 20, x: 0, y: top, toJSON: () => ({}) } as DOMRect;
    });
    try {
      const view = renderOver(fx, run, reportsPath(), ReportsView);
      const jump = within(document.querySelector("[data-slot=overview-lead]") as HTMLElement).getByRole("button", { name: "Расход токенов" });
      await user.click(jump);
      // 8 px under the reader's top: 1 600 − 100 − 8
      expect(box().scrollTop).toBe(1492);
      expect((document.querySelector("[data-slot=view-body]") as HTMLElement).scrollTop).toBe(0);
      expect(into).not.toHaveBeenCalled();
      expect(view.probe.location?.hash).toBe("");
    } finally {
      rects.mockRestore();
      into.mockRestore();
    }
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

  test("p3-review-critic-craft-2#craft-11: an unknown id in the URL reads the one `MissingLine` — the run's report count, then «Закрыть», which drops the address and puts focus on the rail; the overview under it", async () => {
    const user = userEvent.setup({ delay: null });
    const view = renderView(fx, KEY, reportsPath({ report: "p9-review-critic-none", tab: "findings" }), ReportsView);
    await loaded();
    const line = document.querySelector("[data-slot=report-missing]") as HTMLElement;
    expect(line).toHaveAttribute("role", "status");
    // the rail's 98 reports: 97 recorded launches and the running one
    expect(line).toHaveTextContent(/^Отчёт p9-review-critic-none не найден: в этом прогоне 98 отчётов\.\s*Закрыть$/);
    expect(line.querySelector("[data-slot=missing-sentence]")).toHaveAttribute("title", "Отчёт p9-review-critic-none не найден: в этом прогоне 98 отчётов.");
    expect(document.querySelector("[data-slot=reports-overview]")).toBeInTheDocument();
    await user.click(within(line).getByRole("button", { name: "Закрыть" }));
    await waitFor(() => expect(view.probe.location?.search).toBe("?view=reports"));
    expect(document.querySelector("[data-slot=report-missing]")).toBeNull();
    expect(document.querySelector("[data-slot=report-rail] [data-slot=rail-overview]")).toHaveFocus();
  });

  test("p3-review-critic-craft-2#craft-9: the sticky stage heading pins at the rail scroller's very top — no padding above it, so no row shows over it", async () => {
    renderOver(fx, run, reportsPath(), ReportsView);
    const scroller = document.querySelector("[data-slot=rail-scroll]") as HTMLElement;
    const heading = document.querySelector("[data-slot=rail-heading]") as HTMLElement;
    await applyStylesheet();
    // a sticky box sticks to the scrollport less the scroller's padding: 4 px of padding showed 4 px of a row above it
    expect(getComputedStyle(scroller).paddingTop).toBe("0px");
    expect(getComputedStyle(heading).position).toBe("sticky");
    expect(getComputedStyle(heading).top).toBe("0px");
  });

  test("p3-review-critic-craft-2#craft-10: the result a group's implementers share is named once, on a reserved line under its heading", async () => {
    // Copy 4: the builder against literals, with their word counts
    expect(sharedResultText({ result: "done", n: 15 }, 16)).toBe("итог: done — у 15 из 16 отчётов");
    expect(sharedResultText({ result: "done", n: 15 }, 16).split(" ")).toHaveLength(8);
    // the noun genitive after «из», as the status bar writes it
    expect(sharedResultText({ result: "blocked", n: 2 }, 21)).toBe("итог: blocked — у 2 из 21 отчёта");
    expect(sharedResultText({ result: "blocked", n: 2 }, 2).split(" ")).toHaveLength(8);
    expect(sharedResultText(null, 3)).toBe("общего итога нет");
    expect(sharedResultText(null, 3).split(" ")).toHaveLength(3);
    // one implementer of «юниты в работе · проход 1» blocked: the line names the 15 «done» its row no longer repeats
    const own = run.launches.filter((l) => l.stage === "p1-units" && l.agent === "fsloop-implement");
    const blocked = own[2];
    const over = { ...run, launches: run.launches.map((l) => (l.id === blocked.id ? { ...l, sections: { ...l.sections, RESULT: { value: "blocked", items: [] } } } : l)) };
    renderOver(fx, over, reportsPath(), ReportsView);
    const group = (name: string) => screen.getByRole("region", { name }) as HTMLElement;
    const line = group("юниты в работе, проход 1").querySelector("[data-slot=rail-result]") as HTMLElement;
    expect(line).toHaveTextContent(/^итог: done — у 15 из 16 отчётов$/);
    expect(line).toHaveAttribute("title", "итог: done — у 15 из 16 отчётов");
    // right under the heading, before the first row
    expect(line.previousElementSibling).toHaveAttribute("data-slot", "rail-heading");
    // a group of critics alone has no result to share: no line
    expect(group("ревью, проход 1").querySelector("[data-slot=rail-result]")).toBeNull();
    // Strict 1: one line, its 20 px box fixed — and whole at the rail's 240 px (w-60)
    await applyStylesheet();
    expect(usedBlockSize(line)).toBe(20);
    expect(textWidth(line.textContent ?? "", { size: 12 })).toBeLessThanOrEqual(innerWidth(line, document.querySelector("[data-slot=report-rail]") as HTMLElement, 240));
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
    // p3-review-critic-craft-2#craft-12: the address takes the recorded launch's id, replaced — and the reader is the
    // one that opened on the running launch, its «Состояние» row kept (Strict 1)
    await waitFor(() => expect(new URLSearchParams(view.probe.location?.search).get("report")).toBe("p1-units-u2-implement"));
    expect([...document.querySelectorAll("[data-slot=report-reader] [data-slot=fact] dt")].map((dt) => dt.textContent)).toContain("Состояние");

    await user.click(within(strip).getByRole("button"));
    expect(ids()).toEqual([...small.launches.map((l) => l.id), "p1-units-u2-implement"]);
    expect(strip).toHaveTextContent("");
  });
});

describe("p3-review-critic-craft-2#craft-12: a running agent's address after its launch was recorded", () => {
  test("the page opened later on the agent's id reads the launch whose record names that agent, and the URL takes the launch's id", async () => {
    const small = loadedRun(fx, SMALL, keyOf(SMALL));
    // the record of the launch that ran as agent a77: nothing in memory knew it was running
    const recorded: Launch = { ...small.launches[3], id: "p1-units-u2-implement", description: "u2 implement", unit: "u2", agentId: "a77" };
    const view = renderOver(fx, { ...small, launches: [...small.launches, recorded], running: [] }, runPath(keyOf(SMALL), { view: "reports", report: "a77" }), ReportsView);
    expect(document.querySelector("[data-slot=report-missing]")).toBeNull();
    expect(screen.getByRole("heading", { level: 2, name: "u2 implement" })).toBeInTheDocument();
    expect(document.querySelector("[data-slot=report-id]")).toHaveTextContent("p1-units-u2-implement");
    await waitFor(() => expect(new URLSearchParams(view.probe.location?.search).get("report")).toBe("p1-units-u2-implement"));
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
    // p2-verdict-critic-craft-verdict#craft-4: the trigger names the report alone — its stage and state are the
    // reader's, right under it (ux 2); the options keep them
    const picker = screen.getByRole("combobox", { name: "Отчёт: craft accounts" });
    expect(picker).toHaveTextContent(/^Отчёт:craft accounts$/);
    await user.click(picker);
    const options = (await screen.findAllByRole("option")).map((o) => o.textContent);
    expect(options).toHaveLength(98);
    expect(options).toContain("craft accounts · карта, проход 1 · 3 critical · 6 major · 9 minor");
    expect(options).toContain("u1 implement · юниты в работе, проход 1 · итог: done · 1 находка");
    expect(options).toContain("critic code verdict · проверка исправлений, проход 1 · 1 resolved · 1 partial · 0 unresolved");
    expect(options.at(-1)).toBe("u30 implement · приёмка, проход 2 · работает · 12 мин");
  });

  test("p2-verdict-critic-craft-verdict#craft-5: with no report open the trigger reads once, plainly — «Отчёт: обзор», one colon", async () => {
    renderView(fx, KEY, reportsPath(), ReportsView);
    await loaded();
    const picker = within(document.querySelector("[data-toolbar-item=report-picker]") as HTMLElement).getByRole("combobox");
    expect(picker).toHaveAccessibleName("Отчёт: обзор");
    expect(picker).toHaveTextContent(/^Отчёт:обзор$/);
    expect(picker.textContent?.split(":")).toHaveLength(2);
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
    // a part of the overview, under its one heading (improve-12 (1))
    expect(within(section).getByRole("heading", { level: 3 })).toHaveTextContent(/^Расход токенов$/);
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

  test("p2-verdict-critic-craft-verdict-3#craft-1 («Отчёты»): a report opened low in the rail moves the rail's own scroller and nothing above it; both scrollers hold everything in them", () => {
    const first = renderOver(fx, run, reportsPath(), ReportsView);
    const last = railLinks().at(-1)?.dataset.flatItem as string;
    first.unmount();
    const into = vi.spyOn(HTMLElement.prototype, "scrollIntoView");
    const box = () => document.querySelector("[data-slot=rail-scroll]") as HTMLElement;
    // jsdom lays nothing out: the rail's box stands 100 px down, 400 px high, each item 32 px under the one before it
    const rects = vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
      const items = [...document.querySelectorAll<HTMLElement>("[data-slot=report-rail] [data-flat-item]")];
      const at = items.indexOf(this);
      const top = this.dataset.slot === "rail-scroll" ? 100 : at >= 0 ? 100 + at * 32 - box().scrollTop : 0;
      const height = this.dataset.slot === "rail-scroll" ? 400 : 32;
      return { top, bottom: top + height, left: 0, right: 0, width: 0, height, x: 0, y: top, toJSON: () => ({}) } as DOMRect;
    });
    try {
      renderOver(fx, run, reportsPath({ report: last }), ReportsView);
      const at = [...document.querySelectorAll<HTMLElement>("[data-slot=report-rail] [data-flat-item]")].findIndex((el) => el.dataset.flatItem === last);
      expect(at).toBeGreaterThan(20);
      // its bottom 8 px above the rail's bottom: (100 + at × 32 + 32) − 500 + 8
      expect(box().scrollTop).toBe(at * 32 - 360);
      expect((document.querySelector("[data-slot=view-body]") as HTMLElement).scrollTop).toBe(0);
      expect(into).not.toHaveBeenCalled();
      // the cause of the journal's 48 px: a scroller that is not the containing block of an sr-only deep in it
      for (const slot of ["rail-scroll", "report-reader-scroll"]) {
        const scroller = document.querySelector(`[data-slot=${slot}]`) as HTMLElement;
        expect(scroller).toHaveClass("relative", "overflow-y-auto");
        for (const el of scroller.querySelectorAll<HTMLElement>(".sr-only")) expect(scroller.contains(el.parentElement?.closest(".relative, .absolute, .fixed, .sticky") ?? null)).toBe(true);
      }
    } finally {
      rects.mockRestore();
      into.mockRestore();
    }
  });

  test("u6-shape cand-1: a run whose launches recorded no tokens says so, never a zero", () => {
    renderOver(fx, { ...run, tokens: { stage: [], kind: [] } }, reportsPath(), ReportsView);
    expect(document.querySelector("[data-slot=reports-spend] [data-slot=spend-none]")).toHaveTextContent(/^не записано: в записях запусков прогона нет токенов$/);
  });
});
