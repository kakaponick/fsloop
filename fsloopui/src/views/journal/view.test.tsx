// @vitest-environment jsdom
// Done-criteria 0, 3 and 6: «Журнал» over u1's handler on the fixture run of 143 entries — a reading list in `#`
// order, each entry an article with its address: the question as its heading, then «Решение», «Почему» and «Ссылки»
// in a hanging label column, each ref with the fact it resolves to; search and «Этап», filtered to none, the hits
// marked; a link to an entry scrolls to it, marks it and takes focus; new entries wait in the strip, a linked one is
// placed at once; the entries in view in the status bar; a journal that cannot be read fails in its place; every late
// part's box reserved (f7: craft-15, craft-16, craft-30, craft-31, craft-32).
import "../../ui/test-setup.ts";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterAll, describe, expect, test, vi } from "vitest";
import type { JournalEntry } from "../../../shared/model.ts";
import { writePref } from "@/ui";
import { runPath } from "../../app/routes.ts";
import { fixtureApp, keyOf, loadedRun, renderOver, renderView } from "../reports/testing.tsx";
import { entriesInView, entryHead, inViewText, JournalView, LABELS, stageFilter } from "./index.tsx";
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
/** The value an entry gives a label: the `dd` after its `dt`; undefined — the entry has no such row. */
const fact = (a: HTMLElement, label: string) => [...a.querySelectorAll("dt")].find((dt) => dt.textContent === label)?.nextElementSibling as HTMLElement | undefined;

describe("the journal as a reading list", () => {
  test("143 entries in `#` order: «#n · этап», the question as heading, «Решение», «Почему», «Ссылки»", async () => {
    renderView(fx, KEY, path(), JournalView);
    await loaded();
    expect(articles().map((a) => a.dataset.entry)).toEqual(Array.from({ length: 143 }, (_, k) => String(k + 1)));
    const e = article(5);
    expect(e).toHaveAttribute("id", "j5");
    expect(e.querySelector("p")).toHaveTextContent("#5 · проход 1 · карта");
    expect(within(e).getByRole("heading", { level: 3 })).toHaveTextContent("Question 5: which way?");
    expect(fact(e, LABELS.decision)).toHaveTextContent("way 5");
    expect(fact(e, LABELS.why)).toHaveTextContent("because 5 keeps the law");
    expect(entryHead({ n: "120", stage: "p2-review" })).toBe("#120 · проход 2 · ревью");
    expect(bar()).toHaveTextContent("143 решения");
  });

  test("craft-16: the question at Title 14 px, the decision leads in ink, the labels in a hanging column from 40 rem", async () => {
    renderView(fx, KEY, path(), JournalView);
    await loaded();
    const e = article(40);
    // `text-base` is the Title role, 14 px, in this theme (styles/index.css: --text-base 0.875rem; DESIGN.md → Typography)
    expect(within(e).getByRole("heading", { level: 3 })).toHaveClass("text-base", "font-semibold");
    expect([...e.querySelectorAll("dt")].map((dt) => dt.textContent)).toEqual(["Решение", "Почему", "Ссылки"]);
    expect(fact(e, LABELS.decision)?.firstElementChild).toHaveClass("font-medium", "text-foreground");
    expect(e.querySelector("dl")).toHaveClass("grid-cols-1", "@min-[40rem]/view:grid-cols-[5.5rem_minmax(0,1fr)]");
    // an entry without refs has no «Ссылки» row at all
    expect(fact(article(6), LABELS.refs)).toBeUndefined();
  });

  test("craft-16: the status bar names the entries in view, «на экране #40–#42», in a box reserved before it is known", async () => {
    const boxes = [
      { n: "39", top: -200, bottom: -5 },
      { n: "40", top: -5, bottom: 130 },
      { n: "41", top: 130, bottom: 270 },
      { n: "42", top: 270, bottom: 395 },
      { n: "43", top: 395, bottom: 530 },
    ];
    expect(entriesInView({ top: 0, bottom: 400 }, boxes)).toEqual(["40", "42"]); // 5 px of #43 is not an entry in view
    expect(entriesInView({ top: 0, bottom: 400 }, [])).toBeNull();
    expect(inViewText(["40", "42"])).toBe("на экране #40–#42");
    expect(inViewText(["7", "7"])).toBe("на экране #7");
    expect(inViewText(null)).toBe("");
    renderView(fx, KEY, path(), JournalView);
    await loaded();
    const slot = bar().querySelector("[data-slot=in-view]");
    expect(slot).toHaveClass("inline-block", "min-w-[21ch]");
    // the widest form at the production shape (143 entries) is 19 characters: 21ch holds it at a Cyrillic letter's width
    expect(inViewText(["142", "143"])).toHaveLength(19);
  });

  test("craft-30: each ref with the fact it rests on — a finding's severity and sentence, a unit's state and title, an entry's question", async () => {
    renderView(fx, KEY, path(), JournalView);
    await loaded();
    const refs = (n: number) => fact(article(n), LABELS.refs) as HTMLElement;
    expect(within(refs(5)).getByRole("link", { name: "p1-review-critic-code#code-6" })).toHaveAttribute("href", runPath(KEY, { view: "findings", finding: "p1-review-critic-code#code-6" }));
    expect(refs(5)).toHaveTextContent(/critical · the reader is written twice, once per caller \(6\)/);
    expect(refs(5).querySelector("[data-slot=dot]")).toHaveAttribute("data-tone", "danger");
    expect(within(refs(14)).getByRole("link", { name: "u15" })).toHaveAttribute("href", runPath(KEY, { view: "units", unit: "u15" }));
    expect(refs(14)).toHaveTextContent("u15закоммичен · part 15");
    expect(within(refs(11)).getByRole("link", { name: "j10" })).toHaveAttribute("href", runPath(KEY, { view: "journal", entry: "10" }));
    expect(refs(11)).toHaveTextContent("j10Question 10: which way?");
    expect(refs(7)).toHaveTextContent("юнит u99 не найден");
    expect(fact(article(6), LABELS.refs)).toBeUndefined();
  });

  test("a launch and a judge open their report, named by its kind and launch; a pass is plain text", () => {
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
    const refs = fact(article(1), LABELS.refs) as HTMLElement;
    expect(within(refs).getByRole("link", { name: "p1-map-map" })).toHaveAttribute("href", runPath(KEY, { view: "reports", report: "p1-map-map" }));
    expect(within(refs).getByRole("link", { name: "p1-map-map" }).closest("li")).toHaveTextContent("p1-map-mapотчёт запуска · карта");
    expect(within(refs).getByRole("link", { name: "p1-verdict-critic-code-verdict" })).toHaveAttribute("href", runPath(KEY, { view: "reports", report: "p1-verdict-critic-code-verdict" }));
    expect(within(refs).getByRole("link", { name: "p1-verdict-critic-code-verdict" }).closest("li")).toHaveTextContent(/отчёт критика · code · verdict/);
    expect(within(refs).getByText("p2").tagName).toBe("SPAN");
    expect(refs).toHaveTextContent("отчёт p9-gone не найден");
  });

  test("a 2 123-character entry keeps every character in a column capped at the reading measure", () => {
    const why = `${Array.from({ length: 40 }, (_, k) => `Reason ${k + 1}: the operator reads the decision at a 75-character line and keeps every fact of it.`).join(" ")}`.slice(0, 2122) + ".";
    expect(why).toHaveLength(2123);
    renderOver(fx, { ...run, journal: run.journal.map((e) => (e.n === "1" ? { ...e, why } : e)) }, path(), JournalView);
    expect(fact(article(1), LABELS.why)?.querySelector("[data-slot=running-text]")?.textContent).toBe(why);
    // the text column keeps the measure beside the 5.5 rem label column and its 1 rem gap, plus the entry's padding
    expect(article(1).closest("ol")).toHaveClass("max-w-[calc(var(--container-measure)+8.5rem)]");
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

  test("verdict-5: the search's hits wear the kit's one mark in all the searched text — the head, the question, «Решение», «Почему»", async () => {
    const user = userEvent.setup({ delay: null });
    renderView(fx, KEY, path(), JournalView);
    await loaded();
    await user.click(screen.getByRole("searchbox"));
    await user.paste("40");
    await loaded(2); // #40 and #140
    const marks = [...article(40).querySelectorAll("mark[data-slot=hit]")];
    // «#40 · …», the question, «way 40», «because 40 …»: one painter, the table's `Highlight`
    expect(marks.map((m) => m.textContent)).toEqual(["40", "40", "40", "40"]);
    expect(marks[0].closest("p")?.textContent).toMatch(/^#40 · /);
    expect(within(article(40)).getByRole("heading", { level: 3 }).querySelector("mark[data-slot=hit]")).toHaveTextContent("40");
    // no second painter: no CSS highlight rule on the list
    expect(article(40).closest("ol")?.className).not.toMatch(/highlight/);
  });

  test("verdict-6: a word only the labels hold is never painted — «ре» marks the stage «ревью», not «Решение»", async () => {
    const user = userEvent.setup({ delay: null });
    renderView(fx, KEY, path(), JournalView);
    await loaded();
    await user.click(screen.getByRole("searchbox"));
    await user.paste("ре");
    await waitFor(() => expect(articles().length).toBeLessThan(143), { timeout: 4000 });
    const first = articles()[0];
    expect(first.querySelector("p mark[data-slot=hit]")).toHaveTextContent("ре");
    for (const a of articles()) expect(a.querySelector("dt mark")).toBeNull();
  });

  test("«Этап» keeps one stage, its count over the run; the filter is the view's state in the browser", async () => {
    expect(stageFilter(run.journal).options.map((o) => o.label)).toEqual(["проход 1 · карта", "проход 1 · ревью", "проход 2 · ревью"]);
    writePref(`table:journal:run:${KEY}`, { filters: { stage: ["p2-review"] }, search: "" });
    renderView(fx, KEY, path(), JournalView);
    await loaded(44);
    expect(screen.getByRole("combobox", { name: "Этап" })).toHaveTextContent(/^Этап:проход 2 · ревью$/);
    expect(bar()).toHaveTextContent("44 из 143 решений");
  });

  test("`entry=` scrolls to the entry, marks it and focuses it (craft-32); hidden by the filter it shows anyway, «вне фильтра»; unknown is named", async () => {
    const scroll = vi.spyOn(window.HTMLElement.prototype, "scrollIntoView");
    writePref(`table:journal:run:${KEY}`, { filters: { stage: ["p1-map"] }, search: "" });
    const view = renderView(fx, KEY, path({ entry: "120" }), JournalView);
    await loaded(60);
    expect(article(120)).toHaveAttribute("data-target");
    expect(article(120)).toHaveClass("shadow-target");
    expect(within(article(120)).getByText("вне фильтра")).toBeInTheDocument();
    await waitFor(() => expect(scroll.mock.contexts).toContain(article(120)));
    expect(article(120)).toHaveAttribute("tabindex", "-1");
    expect(document.activeElement).toBe(article(120));
    expect(new URLSearchParams(view.probe.location?.search).get("entry")).toBe("120");
    view.unmount();
    renderView(fx, KEY, path({ entry: "999" }), JournalView);
    await loaded(59);
    expect(document.querySelector("[data-slot=entry-missing]")).toHaveTextContent("Запись журнала 999 не найдена: в журнале этого прогона её нет — проверьте ссылку");
    scroll.mockRestore();
  });

  test("craft-32: no entry adds a landmark — the labels are a description list, not labelled sections", async () => {
    renderView(fx, KEY, path(), JournalView);
    await loaded();
    const list = document.querySelector("[data-slot=journal-scroll]") as HTMLElement;
    expect(list.querySelectorAll("section")).toHaveLength(0);
    expect(within(list).queryAllByRole("region")).toHaveLength(0);
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

  test("craft-31: a link to an entry still held in the strip places that entry at once, marked; the others keep waiting", () => {
    const view = renderOver(fx, run, path({ entry: "146" }), JournalView);
    expect(document.querySelector("[data-slot=entry-missing]")).toHaveTextContent("Запись журнала 146 не найдена");
    const more = [144, 145, 146].map((n) => ({ n: String(n), stage: "p2-assess", question: `Question ${n}?`, decision: `way ${n}`, why: `because ${n}`, refs: [] }));
    view.again({ ...run, version: 2, journal: [...run.journal, ...more] });
    expect(articles()).toHaveLength(144);
    expect(article(146)).toHaveAttribute("data-target");
    expect(document.querySelector("[data-slot=entry-missing]")).toBeNull();
    expect(document.querySelector("[data-slot=held-strip]")).toHaveTextContent("2 новых решения · показать");
  });

  test("empty: not yet names the stage of the first decision; never, for a closed run", () => {
    const small = loadedRun(fx, SMALL, keyOf(SMALL));
    const a = renderOver(fx, { ...small, journal: [] }, runPath(keyOf(SMALL), { view: "journal" }), JournalView);
    expect(screen.getByText("Решений ещё нет — они появятся на этапе «карта»")).toBeInTheDocument();
    a.unmount();
    renderOver(fx, { ...small, closed: true, journal: [] }, runPath(keyOf(SMALL), { view: "journal" }), JournalView);
    expect(screen.getByText("В этом прогоне не было решений")).toBeInTheDocument();
  });

  test("craft-15: a journal that cannot be read fails in the list's place — «Журнал решений не прочитан: …», never empty", () => {
    const small = loadedRun(fx, SMALL, keyOf(SMALL));
    const folder = [{ file: "папка прогона", cause: "EISDIR: illegal operation on a directory, read" }];
    const a = renderOver(fx, { ...small, source: "live", journal: [], errors: folder }, runPath(keyOf(SMALL), { view: "journal" }), JournalView);
    expect(screen.getByRole("alert")).toHaveTextContent("Журнал решений не прочитан: EISDIR: illegal operation on a directory, read");
    expect(screen.queryByText("Решений ещё нет — они появятся на этапе «карта»")).toBeNull();
    a.unmount();
    // the run folder failed, but run.json stood behind it: the recorded journal shows
    const b = renderOver(fx, { ...run, source: "record", errors: folder }, path(), JournalView);
    expect(screen.queryByRole("alert")).toBeNull();
    expect(articles()).toHaveLength(143);
    b.unmount();
    renderOver(fx, { ...run, errors: [{ file: "journal.md", cause: "нет доступа" }] }, path(), JournalView);
    expect(screen.getByRole("alert")).toHaveTextContent("Журнал решений не прочитан: нет доступа");
    expect(articles()).toHaveLength(0);
  });

  test("no layout shift: the toolbar, the strip's line and the status bar hold their boxes; the list scrolls with a stable gutter", async () => {
    renderView(fx, KEY, path(), JournalView);
    await loaded();
    expect(document.querySelector("[data-slot=adaptive-toolbar]")).toHaveClass("h-7", "shrink-0");
    expect(document.querySelector("[data-toolbar-item=filter-stage] [data-slot=toolbar-sizer]")).not.toBeNull();
    expect(document.querySelector("[data-slot=journal-scroll]")).toHaveClass("[scrollbar-gutter:stable]");
    expect(bar()).toHaveClass("h-8", "shrink-0");
  });
});
