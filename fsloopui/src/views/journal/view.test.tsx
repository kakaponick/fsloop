// @vitest-environment jsdom
// Done-criteria 0, 3 and 6: «Журнал» over u1's handler on the fixture run of 143 entries — a reading list in `#`
// order, each entry an article with its address, «Решение» and «Почему» at the reading measure, «Ссылки» through
// the app's object link; search and «Этап», filtered to none; a link to an entry scrolls to it and marks it; new
// entries wait in the strip; every late part's box reserved.
import "../../ui/test-setup.ts";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterAll, describe, expect, test, vi } from "vitest";
import type { JournalEntry } from "../../../shared/model.ts";
import { writePref } from "@/ui";
import { runPath } from "../../app/routes.ts";
import { fixtureApp, keyOf, loadedRun, renderOver, renderView } from "../reports/testing.tsx";
import { entryHead, JournalView, LABELS, stageFilter } from "./index.tsx";
import { refObject } from "./ref-link.tsx";

const N = 40; // 143 entries
const SMALL = 24;
const KEY = keyOf(N);
const fx = fixtureApp({ only: [N, SMALL] });
afterAll(() => fx.close());
const run = loadedRun(fx, N, KEY);

const articles = () => [...document.querySelectorAll<HTMLElement>("article[data-entry]")];
const article = (n: number) => document.querySelector(`article[data-entry="${n}"]`) as HTMLElement;
const loaded = (count = 143) => waitFor(() => expect(articles()).toHaveLength(count), { timeout: 4000 });
const bar = () => document.querySelector("[data-slot=status-bar]") as HTMLElement;
const path = (extra: Record<string, string> = {}) => runPath(KEY, { view: "journal", ...extra });

describe("the journal as a reading list", () => {
  test("143 entries in `#` order: «#n · этап», the question as heading, «Решение», «Почему», «Ссылки»", async () => {
    renderView(fx, KEY, path(), JournalView);
    await loaded();
    expect(articles().map((a) => a.dataset.entry)).toEqual(Array.from({ length: 143 }, (_, k) => String(k + 1)));
    const e = article(5);
    expect(e).toHaveAttribute("id", "j5");
    expect(e.querySelector("p")).toHaveTextContent("#5 · проход 1 · карта");
    expect(within(e).getByRole("heading", { level: 3 })).toHaveTextContent("Question 5: which way?");
    expect(within(e).getByRole("region", { name: LABELS.decision })).toHaveTextContent("way 5");
    expect(within(e).getByRole("region", { name: LABELS.why })).toHaveTextContent("because 5 keeps the law");
    expect(entryHead({ n: "120", stage: "p2-review" })).toBe("#120 · проход 2 · ревью");
    expect(bar()).toHaveTextContent("143 решения");
  });

  test("refs: a finding, a unit, an entry link to their places; a missing id reads «не найден»; «—» shows nothing", async () => {
    renderView(fx, KEY, path(), JournalView);
    await loaded();
    const refs = (n: number) => within(article(n)).queryByRole("region", { name: LABELS.refs });
    expect(within(refs(5) as HTMLElement).getByRole("link", { name: "p1-review-critic-code#code-6" })).toHaveAttribute("href", runPath(KEY, { view: "findings", finding: "p1-review-critic-code#code-6" }));
    expect(within(refs(14) as HTMLElement).getByRole("link", { name: "u15" })).toHaveAttribute("href", runPath(KEY, { view: "units", unit: "u15" }));
    expect(within(refs(11) as HTMLElement).getByRole("link", { name: "j10" })).toHaveAttribute("href", runPath(KEY, { view: "journal", entry: "10" }));
    expect(refs(7)).toHaveTextContent("юнит u99 не найден");
    expect(refs(6)).toBeNull();
  });

  test("a launch and a judge open their report; a pass is plain text", () => {
    expect(refObject({ id: "p1-map-map", kind: "launch" })).toEqual({ kind: "report", id: "p1-map-map" });
    expect(refObject({ id: "p1-verdict-critic-code-verdict", kind: "judge" })).toEqual({ kind: "report", id: "p1-verdict-critic-code-verdict" });
    expect(refObject({ id: "j12", kind: "journal" })).toEqual({ kind: "entry", id: "12" });
    expect(refObject({ id: "p2", kind: "pass" })).toBeNull();
    const journal: JournalEntry[] = [
      { n: "1", stage: "p1-map", question: "Which report?", decision: "the map's", why: "it is the first", refs: [
        { id: "p1-map-map", kind: "launch", found: true },
        { id: "p1-verdict-critic-code-verdict", kind: "judge", found: true },
        { id: "p2", kind: "pass", found: true },
        { id: "p9-gone", kind: "launch", found: false },
      ] },
    ];
    renderOver(fx, { ...run, journal }, path(), JournalView);
    const refs = within(article(1)).getByRole("region", { name: LABELS.refs });
    expect(within(refs).getByRole("link", { name: "p1-map-map" })).toHaveAttribute("href", runPath(KEY, { view: "reports", report: "p1-map-map" }));
    expect(within(refs).getByRole("link", { name: "p1-verdict-critic-code-verdict" })).toHaveAttribute("href", runPath(KEY, { view: "reports", report: "p1-verdict-critic-code-verdict" }));
    expect(within(refs).getByText("p2").tagName).toBe("SPAN");
    expect(refs).toHaveTextContent("отчёт p9-gone не найден");
  });

  test("a 2 123-character entry keeps every character in a column capped at the reading measure", () => {
    const why = `${Array.from({ length: 40 }, (_, k) => `Reason ${k + 1}: the operator reads the decision at a 75-character line and keeps every fact of it.`).join(" ")}`.slice(0, 2122) + ".";
    expect(why).toHaveLength(2123);
    renderOver(fx, { ...run, journal: run.journal.map((e) => (e.n === "1" ? { ...e, why } : e)) }, path(), JournalView);
    const block = within(article(1)).getByRole("region", { name: LABELS.why });
    expect(block.querySelector("[data-slot=running-text]")?.textContent).toBe(why);
    expect(article(1).closest("ol")).toHaveClass("max-w-[calc(var(--container-measure)+2rem)]");
  });
});

describe("search, «Этап», and a link to an entry", () => {
  test("search narrows the list; filtered to none names the filters and offers «Сбросить фильтры»", async () => {
    const user = userEvent.setup({ delay: null });
    renderView(fx, KEY, path(), JournalView);
    await loaded();
    expect([...document.querySelectorAll<HTMLElement>("[data-toolbar-item]")].map((el) => el.dataset.toolbarItem)).toEqual(["search", "filter-stage"]);
    const search = screen.getByRole("searchbox");
    expect(search).toHaveAttribute("placeholder", "Вопрос, решение, ссылка");
    await user.click(search);
    await user.paste("#12");
    await loaded(11);
    expect(bar()).toHaveTextContent("11 из 143 решений");
    await user.clear(search);
    await user.paste("ни-одного-такого");
    expect(await screen.findByText("Нет решений, подходящих под фильтры")).toBeInTheDocument();
    expect(screen.getByText("Фильтры: Поиск: «ни-одного-такого»")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Сбросить фильтры" }));
    await loaded();
  });

  test("«Этап» keeps one stage, its count over the run; the filter is the view's state in the browser", async () => {
    expect(stageFilter(run.journal).options.map((o) => o.label)).toEqual(["проход 1 · карта", "проход 1 · ревью", "проход 2 · ревью"]);
    writePref(`table:journal:run:${KEY}`, { filters: { stage: ["p2-review"] }, search: "" });
    renderView(fx, KEY, path(), JournalView);
    await loaded(44);
    expect(screen.getByRole("combobox", { name: "Этап" })).toHaveTextContent(/^Этап:проход 2 · ревью$/);
    expect(bar()).toHaveTextContent("44 из 143 решений");
  });

  test("`entry=` scrolls to the entry and marks it; hidden by the filter it shows anyway, «вне фильтра»; unknown is named", async () => {
    const scroll = vi.spyOn(window.HTMLElement.prototype, "scrollIntoView");
    writePref(`table:journal:run:${KEY}`, { filters: { stage: ["p1-map"] }, search: "" });
    const view = renderView(fx, KEY, path({ entry: "120" }), JournalView);
    await loaded(60);
    expect(article(120)).toHaveAttribute("data-target");
    expect(article(120)).toHaveClass("shadow-target");
    expect(within(article(120)).getByText("вне фильтра")).toBeInTheDocument();
    await waitFor(() => expect(scroll.mock.contexts).toContain(article(120)));
    expect(new URLSearchParams(view.probe.location?.search).get("entry")).toBe("120");
    view.unmount();
    renderView(fx, KEY, path({ entry: "999" }), JournalView);
    await loaded(59);
    expect(document.querySelector("[data-slot=entry-missing]")).toHaveTextContent("Запись журнала 999 не найдена: в журнале этого прогона её нет — проверьте ссылку");
    scroll.mockRestore();
  });
});

describe("live and empty", () => {
  test("new entries wait in the strip «3 новых решения · показать»; the list does not move until it is clicked", async () => {
    const user = userEvent.setup({ delay: null });
    const view = renderOver(fx, run, path(), JournalView);
    const strip = document.querySelector("[data-slot=held-strip]") as HTMLElement;
    expect(strip).toHaveClass("h-strip", "shrink-0");
    expect(strip).toHaveTextContent("");
    const more = [144, 145, 146].map((n) => ({ n: String(n), stage: "p2-assess", question: `Question ${n}?`, decision: `way ${n}`, why: `because ${n}`, refs: [] }));
    view.again({ ...run, version: 2, journal: [...run.journal, ...more] });
    expect(articles()).toHaveLength(143);
    expect(strip).toHaveTextContent("3 новых решения · показать");
    await user.click(within(strip).getByRole("button"));
    expect(articles()).toHaveLength(146);
    expect(article(146)).toHaveAttribute("data-edge");
    expect(strip).toHaveTextContent("");
  });

  test("empty: not yet names the stage of the first decision; never, for a closed run", () => {
    const small = loadedRun(fx, SMALL, keyOf(SMALL));
    const a = renderOver(fx, { ...small, journal: [] }, runPath(keyOf(SMALL), { view: "journal" }), JournalView);
    expect(screen.getByText("Решений ещё нет — они появятся на этапе «карта»")).toBeInTheDocument();
    a.unmount();
    renderOver(fx, { ...small, closed: true, journal: [] }, runPath(keyOf(SMALL), { view: "journal" }), JournalView);
    expect(screen.getByText("В этом прогоне не было решений")).toBeInTheDocument();
  });

  test("no layout shift: the toolbar, the strip's line and the status bar hold their boxes; the list scrolls with a stable gutter", async () => {
    renderView(fx, KEY, path(), JournalView);
    await loaded();
    expect(document.querySelector("[data-slot=adaptive-toolbar]")).toHaveClass("h-7", "shrink-0");
    expect((document.querySelector("[data-toolbar-item=filter-stage]") as HTMLElement).style.minWidth).toMatch(/^calc\(/);
    expect(document.querySelector("[data-slot=journal-scroll]")).toHaveClass("[scrollbar-gutter:stable]");
    expect(bar()).toHaveClass("h-8", "shrink-0");
  });
});
