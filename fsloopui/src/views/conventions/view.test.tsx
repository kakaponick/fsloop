// @vitest-environment jsdom
// Done-criteria 0, 4 and 6: «Соглашения» over u1's handler on the fixture run of 26 conventions — grouped by
// design-check launch with a link to its report, each convention split into its pattern, its solution, its example
// (running text, each place a copy button in place) and its rule — and its empty states: before decompose, and past it
// with no design check; a report or a run folder that cannot be read fails in its own place (f7: craft-14, craft-15,
// craft-16). f15: the example as written (craft-4), the hanging pattern column with an ordinal and an address
// (cand-11, cand-5), the one-line intro (cand-12), «не записано» for a missing part (cand-13), the copied place named
// in the toast (cand-14), the list's role (cand-16), search (cand-5).
import "../../ui/test-setup.ts";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterAll, describe, expect, test, vi } from "vitest";
import type { Convention } from "../../../shared/model.ts";
import { writePref } from "@/ui";
import { runPath } from "../../app/routes.ts";
import { fixtureApp, keyOf, loadedRun, renderOver, renderView } from "../reports/testing.tsx";
import { conventionPath, ConventionsView, copiedWhat, DESIGN_CHECK, emptyFor, INTRO, LABELS, NEVER_DESCRIPTION, NONE_WRITTEN, partsOf, placesOf, SEARCH } from "./index.tsx";

const N = 40;
const SMALL = 24;
const KEY = keyOf(N);
const fx = fixtureApp({ only: [N, SMALL] });
afterAll(() => fx.close());
const run = loadedRun(fx, N, KEY);
const items = () => [...document.querySelectorAll<HTMLElement>("[data-slot=convention-list] > li")];
const item = (n: number) => document.querySelector(`[data-slot=convention-list] > li[data-convention="${n}"]`) as HTMLElement;
const article = (n: number) => item(n).querySelector("article") as HTMLElement;
const bar = () => document.querySelector("[data-slot=status-bar]") as HTMLElement;
/** The value a convention's fact list gives a label: the `dd` after its `dt`. */
const fact = (li: HTMLElement, label: string) => [...li.querySelectorAll("dt")].find((dt) => dt.textContent === label)?.nextElementSibling as HTMLElement | undefined;
const PATH = runPath(KEY, { view: "conventions" });
const at = (convention: string) => `${PATH}&convention=${convention}`;
const words = (s: string) => s.split(/\s+/).filter(Boolean).length;
const base: Convention = { n: 1, text: "", pattern: "Owners of the shared parts", solution: "u1 `fsloopui/shared/`: every word", example: null, rule: "`ui` → Existing component first", launch: "p1-decompose-design-check", stage: "p1-decompose" };

describe("«Соглашения»", () => {
  test("26 conventions grouped by design-check launch, each heading a link to its report", async () => {
    renderView(fx, KEY, PATH, ConventionsView);
    await waitFor(() => expect(items()).toHaveLength(26), { timeout: 4000 });
    expect(screen.getByText(/одно решение на задачу/)).toHaveTextContent(INTRO.replace(/`/g, ""));
    const groups = [...document.querySelectorAll<HTMLElement>("section[data-launch]")];
    expect(groups.map((g) => g.dataset.launch)).toEqual(["p1-decompose-design-check", "p2-decompose-design-check"]);
    expect(within(groups[0]).getByRole("link", { name: `${DESIGN_CHECK}, проход 1` })).toHaveAttribute("href", runPath(KEY, { view: "reports", report: "p1-decompose-design-check" }));
    // craft-16: the group heading is the Title role — `text-base` is 14 px in this theme (styles/index.css)
    expect(within(groups[0]).getByRole("heading", { level: 2 })).toHaveClass("text-base", "font-semibold");
    expect(groups[0]).toHaveTextContent("26 соглашений");
    // the second check wrote none, and says so
    expect(groups[1]).toHaveTextContent("0 соглашений");
    expect(groups[1]).toHaveTextContent(NONE_WRITTEN);
    expect(bar()).toHaveTextContent("26 соглашений");
    expect(document.querySelector("[data-slot=conventions-scroll]")).toHaveClass("[scrollbar-gutter:stable]");
    expect(bar()).toHaveClass("h-8", "shrink-0");
  });

  test("craft-14: the pattern leads, the solution is the sentence, the example in mono, the rule in its row", async () => {
    renderView(fx, KEY, PATH, ConventionsView);
    await waitFor(() => expect(items()).toHaveLength(26), { timeout: 4000 });
    const first = items()[0];
    // the reading order: pattern, solution, then the example and the rule as labelled rows
    expect(first.querySelector("[data-slot=convention-pattern]")).toHaveTextContent(/^Pattern 1$/);
    expect(first.querySelector("[data-slot=convention-pattern]")).toHaveClass("font-semibold");
    expect(first.querySelector("[data-slot=convention-solution]")).toHaveTextContent(/^one solution for every brief$/);
    expect([...first.querySelectorAll("dt")].map((dt) => dt.textContent)).toEqual(["Пример", "Правило"]);
    const example = within(fact(first, LABELS.example) as HTMLElement).getByRole("button", { name: "Скопировать место src/web/shared/part-1.tsx:3" });
    expect(example).toHaveClass("font-mono", "min-h-5");
    expect(example).toHaveTextContent(/^src\/web\/shared\/part-1\.tsx:3$/);
    expect(fact(first, LABELS.rule)).toHaveTextContent(/^ux 1, impeccable critique: Consistency and Standards$/);
    expect(fact(first, LABELS.rule)?.querySelector("code")).toHaveTextContent("ux 1");
    // the hanging label column from 40 rem of the view, one column below it
    expect(first.querySelector("dl")).toHaveClass("grid-cols-1", "@min-[40rem]/view:grid-cols-[5.5rem_minmax(0,1fr)]");
    // no list marker: the one number is the ordinal (cand-11), never «1. 1 Pattern 1»
    expect(document.querySelector("[data-slot=convention-list]")).toHaveClass("list-none");
    expect(first.textContent?.startsWith("1Pattern 1")).toBe(true);
  });

  test("cand-14: a place is copied by a click, and the toast names it: «Скопировано: src/web/shared/part-2.tsx:4»", async () => {
    const user = userEvent.setup({ delay: null });
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    renderOver(fx, run, PATH, ConventionsView);
    await user.click(within(items()[1]).getByRole("button", { name: "Скопировать место src/web/shared/part-2.tsx:4" }));
    expect(writeText).toHaveBeenCalledWith("src/web/shared/part-2.tsx:4");
    expect(await screen.findByText("Скопировано: src/web/shared/part-2.tsx:4")).toBeInTheDocument();
  });

  test("cand-14: a place too long for a toast's title keeps its end — the file name: «…/reader-panel.tsx:120-145»", () => {
    expect(copiedWhat("src/web/shared/part-2.tsx:4")).toBe("src/web/shared/part-2.tsx:4");
    const long = "fsloopui/src/views/reports/components/sections/very-long-folder-name/reader-panel.tsx:120-145";
    expect(copiedWhat(long)).toBe("…/reader-panel.tsx:120-145");
    expect(`Скопировано: ${copiedWhat(long)}`.length).toBeLessThanOrEqual(60);
    expect(words(`Скопировано: ${copiedWhat(long)}`)).toBe(2);
    // a file name longer than the room keeps its last characters
    expect(copiedWhat(`a/${"x".repeat(60)}.tsx:1`)).toBe(`…${"x".repeat(40)}.tsx:1`);
  });

  test("craft-4: the example reads as written — the words between its places stay, each place a copy button in place, its whole path shown", () => {
    const real: Convention = { ...base, n: 1, example: "`host-entry.tsx:813-815`, `host-project-panels.tsx:232-244`, slot `readout-view.tsx:17`" };
    const named: Convention = { ...base, n: 2, example: "`a.tsx` (AppDialog)" };
    const long = "fsloopui/src/views/reports/components/sections/very-long-folder-name/reader-panel.tsx:120-145";
    const deep: Convention = { ...base, n: 3, example: `\`${long}\`` };
    renderOver(fx, { ...run, conventions: [real, named, deep] }, PATH, ConventionsView);
    const [a, b, c] = items();
    expect(fact(a, LABELS.example)).toHaveTextContent(/^host-entry\.tsx:813-815, host-project-panels\.tsx:232-244, slot readout-view\.tsx:17$/);
    expect(within(fact(a, LABELS.example) as HTMLElement).getAllByRole("button").map((x) => x.textContent)).toEqual(["host-entry.tsx:813-815", "host-project-panels.tsx:232-244", "readout-view.tsx:17"]);
    expect(fact(b, LABELS.example)).toHaveTextContent(/^a\.tsx \(AppDialog\)$/);
    expect(within(fact(b, LABELS.example) as HTMLElement).getByRole("button", { name: "Скопировать место a.tsx" })).toBeInTheDocument();
    // a long place wraps inside its button: never cut, the file name always on screen
    const button = within(fact(c, LABELS.example) as HTMLElement).getByRole("button");
    expect(button).toHaveTextContent(long);
    expect(button).toHaveClass("whitespace-normal", "h-auto");
    expect(button.querySelector(".truncate")).toBeNull();
  });

  test("craft-4: the places of an example — each `quoted` span, or a bare example that is one place; prose quotes none", () => {
    expect(placesOf("`.claude/rules/ui.md:34`, `.claude/rules/ui.md:36`")).toEqual([".claude/rules/ui.md:34", ".claude/rules/ui.md:36"]);
    expect(placesOf("units/u7/brief.md:20")).toEqual(["units/u7/brief.md:20"]);
    expect(placesOf("the run page header")).toEqual([]);
    expect(placesOf(null)).toEqual([]);
  });

  test("craft-14: a line with no split keeps its text whole; a real example names several places, each its own button", () => {
    const whole: Convention = { n: 1, text: "Stage words — one map in `shared/`", pattern: null, solution: null, example: null, rule: null, launch: "p1-decompose-design-check", stage: "p1-decompose" };
    expect(partsOf(whole)).toBeNull();
    const real: Convention = { ...base, n: 2, example: "`.claude/rules/ui.md:34`, `.claude/rules/ui.md:36`" };
    renderOver(fx, { ...run, conventions: [whole, real] }, PATH, ConventionsView);
    const [a, b] = items();
    expect(a.querySelector("[data-slot=convention-text]")).toHaveTextContent(/^Stage words — one map in shared\/$/);
    expect(a.querySelector("dl")).toBeNull();
    expect(within(fact(b, LABELS.example) as HTMLElement).getAllByRole("button").map((x) => x.textContent)).toEqual([".claude/rules/ui.md:34", ".claude/rules/ui.md:36"]);
    expect(fact(b, LABELS.rule)).toHaveTextContent("ui → Existing component first");
  });

  test("cand-13: a convention whose example or rule the design check left empty keeps the row, «не записано»", () => {
    const bare: Convention = { ...base, example: "", rule: " " };
    renderOver(fx, { ...run, conventions: [bare] }, PATH, ConventionsView);
    const [a] = items();
    expect([...a.querySelectorAll("dt")].map((dt) => dt.textContent)).toEqual(["Пример", "Правило"]);
    expect(fact(a, LABELS.example)).toHaveTextContent(/^не записано$/);
    expect(fact(a, LABELS.rule)).toHaveTextContent(/^не записано$/);
  });

  test("the median run: 11 conventions of one check", () => {
    renderOver(fx, { ...run, conventions: run.conventions.slice(0, 11) }, PATH, ConventionsView);
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

describe("f15: the list's shape, the address and search", () => {
  test("cand-12: the intro is one short caption line, not a paragraph at the measure", () => {
    renderOver(fx, run, PATH, ConventionsView);
    expect(INTRO).toBe("Соглашение — одно решение на задачу, которую юниты решали бы по-разному; в конце прогона соглашения попадают в `.claude/rules/ui.md`.");
    expect(words(INTRO)).toBe(18);
    const intro = document.querySelector("[data-slot=conventions-intro] > [data-slot=running-text]") as HTMLElement;
    expect(intro).toHaveTextContent(INTRO.replace(/`/g, ""));
    expect(intro).toHaveClass("text-xs", "text-muted-foreground");
    expect(intro).not.toHaveClass("max-w-measure");
  });

  test("cand-11: the pattern hangs in a left column from 56 rem of the view, after an ordinal in a fixed box; each item has an id", () => {
    renderOver(fx, run, PATH, ConventionsView);
    const third = article(3);
    expect(third).toHaveClass("grid", "@min-[56rem]/view:grid-cols-[17rem_minmax(0,1fr)]");
    // below 56 rem the solution and the rows sit under the pattern, past the ordinal's box
    expect(third.querySelector("[data-slot=convention-solution]")?.parentElement).toHaveClass("pl-[calc(3ch+0.5rem)]", "@min-[56rem]/view:pl-0");
    expect(item(3)).toHaveAttribute("id", "convention-3");
    const ordinal = within(third).getByRole("link", { name: "Ссылка на соглашение 3" });
    expect(ordinal).toHaveTextContent(/^3$/);
    // Strict 1: the ordinal's box is three digits wide, its numerals tabular, so «9» and «26» align
    expect(ordinal.parentElement).toHaveClass("w-[3ch]", "shrink-0", "tabular-nums");
    expect(new URLSearchParams(ordinal.getAttribute("href")?.split("?")[1]).get("convention")).toBe("3");
    expect(new URLSearchParams(ordinal.getAttribute("href")?.split("?")[1]).get("view")).toBe("conventions");
  });

  test("cand-16: the list keeps its list role under `list-none`", () => {
    renderOver(fx, run, PATH, ConventionsView);
    const list = document.querySelector("[data-slot=convention-list]") as HTMLElement;
    expect(list.tagName).toBe("OL");
    expect(list).toHaveAttribute("role", "list");
  });

  test("cand-5: `convention=` scrolls to the convention, marks it and focuses it; the ordinal's click puts the address in the URL", async () => {
    const user = userEvent.setup({ delay: null });
    const view = renderOver(fx, run, at("12"), ConventionsView);
    expect(article(12)).toHaveAttribute("data-target");
    expect(article(12)).toHaveClass("shadow-target");
    await waitFor(() => expect(document.activeElement).toBe(article(12)));
    // focused, it holds the list's one Tab stop (craft-3)
    expect(article(12)).toHaveAttribute("tabindex", "0");
    expect(article(3)).not.toHaveAttribute("data-target");
    await user.click(within(article(3)).getByRole("link", { name: "Ссылка на соглашение 3" }));
    expect(new URLSearchParams(view.probe.location?.search).get("convention")).toBe("3");
    expect(article(3)).toHaveAttribute("data-target");
    expect(conventionPath(KEY, 12)).toBe(runPath(KEY, { view: "conventions", convention: "12" }));
  });

  test("p2-verdict-critic-craft-verdict-3#craft-1: `convention=` moves the list's own scroller and nothing above it — never scrollIntoView, the search stays in view", async () => {
    const into = vi.spyOn(window.HTMLElement.prototype, "scrollIntoView");
    const box = () => document.querySelector("[data-slot=conventions-scroll]") as HTMLElement;
    // jsdom lays nothing out: the list's box stands 100 px down, each convention 90 px under the one before it
    const rects = vi.spyOn(window.HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
      const n = this.tagName === "ARTICLE" ? this.parentElement?.dataset.convention : undefined;
      const top = this.dataset.slot === "conventions-scroll" ? 100 : n ? 100 + Number(n) * 90 - box().scrollTop : 0;
      return { top, bottom: top + 90, left: 0, right: 0, width: 0, height: 90, x: 0, y: top, toJSON: () => ({}) } as DOMRect;
    });
    renderOver(fx, run, at("12"), ConventionsView);
    // #12 stands 8 px under the list's top: 12 × 90 − 8
    await waitFor(() => expect(box().scrollTop).toBe(1072));
    expect(document.activeElement).toBe(article(12));
    expect((document.querySelector("[data-slot=view-body]") as HTMLElement).scrollTop).toBe(0);
    expect(document.querySelector("[data-slot=conventions-view]")?.firstElementChild).toHaveAttribute("data-slot", "adaptive-toolbar");
    expect(into).not.toHaveBeenCalled();
    // the list is the containing block of everything in it (the journal's 48 px came from a list that was not)
    expect(box()).toHaveClass("relative", "overflow-y-auto");
    for (const el of box().querySelectorAll<HTMLElement>(".sr-only")) expect(box().contains(el.parentElement?.closest(".relative, .absolute, .fixed, .sticky") ?? null)).toBe(true);
    rects.mockRestore();
    into.mockRestore();
  });

  test("p2-verdict-critic-craft-verdict-3#craft-3: the conventions are one flat list — one Tab stop, ↑/↓ between them, a convention's own links and places take Tab only while focus is in it", async () => {
    const user = userEvent.setup({ delay: null });
    renderOver(fx, run, PATH, ConventionsView);
    const list = document.querySelector("[data-slot=conventions-scroll] [data-slot=flat-list]") as HTMLElement;
    const stops = () => [...list.querySelectorAll<HTMLElement>("article, article a[href], article button")].filter((el) => el.tabIndex >= 0);
    // 26 conventions, each an ordinal and a place: one stop, not 53
    expect(stops()).toEqual([article(1)]);
    article(1).focus();
    expect(stops()).toEqual([article(1), within(article(1)).getByRole("link"), within(article(1)).getByRole("button")]);
    await user.keyboard("{ArrowDown}");
    expect(document.activeElement).toBe(article(2));
    expect(stops()).toEqual([article(2), within(article(2)).getByRole("link"), within(article(2)).getByRole("button")]);
    await user.keyboard("{End}");
    expect(document.activeElement).toBe(article(26));
    // the focused convention wears the journal's ring
    expect(article(26)).toHaveClass("focus-visible:ring-3", "focus-visible:ring-ring/50", "focus-visible:ring-inset");
  });

  test("p2-verdict-critic-craft-verdict-3#craft-4: a convention's menu copies its address, as a decision's does", async () => {
    const user = userEvent.setup({ delay: null });
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    renderOver(fx, run, PATH, ConventionsView);
    const ordinal = within(article(3)).getByRole("link", { name: "Ссылка на соглашение 3" });
    expect(ordinal).toHaveAttribute("href", conventionPath(KEY, 3));
    fireEvent.contextMenu(article(3));
    const menu = await screen.findByRole("menu");
    expect(within(menu).getByText("3 · Pattern 3")).toBeInTheDocument();
    await user.click(within(menu).getByRole("menuitem", { name: "Скопировать адрес соглашения" }));
    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}${conventionPath(KEY, 3)}`);
  });

  test("p2-verdict-critic-craft-verdict-3#craft-5: an unknown convention says what the run holds, and «Закрыть» drops the address and lands on the list", async () => {
    const user = userEvent.setup({ delay: null });
    const view = renderOver(fx, run, at("99"), ConventionsView);
    const missing = document.querySelector("[data-slot=convention-missing]") as HTMLElement;
    expect(missing).toHaveTextContent(/^Соглашение 99 не найдено: в этом прогоне соглашения 1–26\.\s*Закрыть$/);
    expect(missing.querySelector("[data-slot=not-found]")).toHaveTextContent(/^Соглашение 99 не найдено$/);
    expect(items()).toHaveLength(26);
    await user.click(within(missing).getByRole("button", { name: "Закрыть" }));
    expect(document.querySelector("[data-slot=convention-missing]")).toBeNull();
    expect(new URLSearchParams(view.probe.location?.search).get("convention")).toBeNull();
    expect(new URLSearchParams(view.probe.location?.search).get("view")).toBe("conventions");
    expect(document.activeElement).toBe(article(1));
  });

  test("cand-5: search keeps the conventions it names and marks the hits; «1 из 26 соглашений»; a group with none left is hidden", () => {
    writePref(`table:conventions:run:${KEY}`, { filters: {}, search: "part-12" });
    renderOver(fx, run, PATH, ConventionsView);
    expect(items().map((li) => li.dataset.convention)).toEqual(["12"]);
    expect(item(12).querySelector("mark[data-slot=hit]")).toHaveTextContent("part-12");
    expect(bar()).toHaveTextContent("1 из 26 соглашений");
    expect([...document.querySelectorAll<HTMLElement>("section[data-launch]")].map((g) => g.dataset.launch)).toEqual(["p1-decompose-design-check"]);
  });

  test("cand-5: the search field names what it looks in; a convention a link opens shows past the search, «вне фильтра»", () => {
    writePref(`table:conventions:run:${KEY}`, { filters: {}, search: "part-12" });
    renderOver(fx, run, at("3"), ConventionsView);
    expect(document.querySelector("[data-slot=table-search] input")).toHaveAttribute("placeholder", SEARCH.placeholder);
    expect(SEARCH.placeholder).toBe("Задача, решение, пример, правило");
    expect(document.querySelector("[data-slot=adaptive-toolbar]")).toHaveClass("h-7", "shrink-0");
    expect(items().map((li) => li.dataset.convention)).toEqual(["3", "12"]);
    expect(within(article(3)).getByText("вне фильтра")).toBeInTheDocument();
  });

  test("cand-5: a search that keeps none: «Нет соглашений, подходящих под фильтры», and «Сбросить фильтры» brings them back", async () => {
    const user = userEvent.setup({ delay: null });
    writePref(`table:conventions:run:${KEY}`, { filters: {}, search: "nothing-like-it" });
    renderOver(fx, run, PATH, ConventionsView);
    expect(screen.getByText("Нет соглашений, подходящих под фильтры")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Сбросить фильтры" }));
    expect(items()).toHaveLength(26);
  });
});

describe("craft-15: a part that failed fails in its own place", () => {
  test("a design check whose report cannot be read: «Отчёт p1-decompose-design-check.md не прочитан: файла нет» in its group", () => {
    const launches = run.launches.map((l) => (l.id === "p1-decompose-design-check" ? { ...l, report: "reports/p1-decompose-design-check.md", reportMissing: true, sections: {} } : l));
    const errors = [...run.errors, { file: "reports/p1-decompose-design-check.md", cause: "файла нет" }];
    renderOver(fx, { ...run, launches, errors, conventions: run.conventions.filter((c) => c.launch !== "p1-decompose-design-check") }, PATH, ConventionsView);
    const group = document.querySelector<HTMLElement>("section[data-launch=p1-decompose-design-check]") as HTMLElement;
    expect(within(group).getByRole("alert")).toHaveTextContent("Отчёт p1-decompose-design-check.md не прочитан: файла нет");
    expect(group).not.toHaveTextContent(NONE_WRITTEN);
    expect(group).not.toHaveTextContent("0 соглашений");
  });

  test("a run folder that cannot be read with no run.json behind it: «Список соглашений не прочитан: …», never «не было»", () => {
    const small = loadedRun(fx, SMALL, keyOf(SMALL));
    const errors = [{ file: "папка прогона", cause: "EISDIR: illegal operation on a directory, read" }];
    renderOver(fx, { ...small, source: "live", launches: [], conventions: [], errors }, runPath(keyOf(SMALL), { view: "conventions" }), ConventionsView);
    expect(screen.getByRole("alert")).toHaveTextContent("Список соглашений не прочитан: EISDIR: illegal operation on a directory, read");
    expect(screen.queryByText("В этом прогоне не было проверки дизайна")).toBeNull();
  });
});
