// @vitest-environment jsdom
// Done-criteria 0, 2 and 6: the report reader on the 97-launch fixture run — identity with the path copied on click,
// the fact list in `ux 9` order, the frames, the section tabs fixed per agent kind with their counts, the finding
// article, ids as links, «Файл отчёта», and the states of the WALK: running, missing file, partly parsed, no
// sections — at the production shape (a 59.8 kB report, 16 frames then «ещё N», scores across five stages).
import "../../ui/test-setup.ts";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterAll, describe, expect, test, vi } from "vitest";
import type { Launch, Surface } from "../../../shared/model.ts";
import { runPath } from "../../app/routes.ts";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ReportsView } from "./index.tsx";
import { reportPath } from "./reader.tsx";
import { reportTabs, unparsedText } from "./sections.ts";
import { fixtureApp, handlerReport, keyOf, loadedRun, renderOver, type FetchReport } from "./testing.tsx";

const N = 40;
const KEY = keyOf(N);
const fx = fixtureApp({ only: [N] });
afterAll(() => fx.close());
const run = loadedRun(fx, N, KEY);
const launch = (id: string) => run.launches.find((l) => l.id === id) as Launch;
/** The frames the fixture took of «accounts»: the craft critic's «Кадры» count. */
const accountsFrames = run.surfaces.find((s) => s.key === "accounts")?.frames.length ?? 0;

const open = (report: string, extra: Record<string, string> = {}, over = run) => renderOver(fx, over, runPath(KEY, { view: "reports", report, ...extra }), ReportsView);
const reader = () => document.querySelector("[data-slot=report-reader]") as HTMLElement;
const tabNames = () => within(reader()).getAllByRole("tab").map((t) => t.textContent);
/** «Файл отчёта» once its text has arrived. */
const loadedFile = async () => {
  await waitFor(() => expect(reader().querySelector("[data-slot=report-file]")).toBeTruthy());
  return reader().querySelector("[data-slot=report-file]") as HTMLElement;
};
const factRows = () => [...reader().querySelectorAll<HTMLElement>("[data-slot=fact]")].map((r) => [r.querySelector("dt")?.textContent, r.querySelector("dd")?.textContent]);

describe("a critic's report", () => {
  test("identity: the description as title, the launch id, the report's path copied on click", async () => {
    const user = userEvent.setup({ delay: null });
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    open("p1-map-craft-accounts");
    expect(within(reader()).getByRole("heading", { level: 2 })).toHaveTextContent("craft accounts");
    expect(reader()).toHaveTextContent("отчёт критика");
    expect(reader().querySelector("[data-slot=report-id]")).toHaveTextContent("p1-map-craft-accounts");
    const path = reader().querySelector("[data-slot=report-path]") as HTMLElement;
    expect(path).toHaveTextContent("reports/p1-map-craft-accounts.md");
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    await user.click(path);
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(reportPath(run.dir, "reports/p1-map-craft-accounts.md")));
    expect(reportPath("C:\\runs\\a5", "reports/x.md")).toBe("C:\\runs\\a5\\reports\\x.md");
    expect(reportPath("/home/op/runs/a5/", "reports/x.md")).toBe("/home/op/runs/a5/reports/x.md");
  });

  test("craft-13: the reader opens on its outcome — the outcome rows, one muted line agent · model · duration · tokens, the rest behind «Подробнее»", async () => {
    const user = userEvent.setup({ delay: null });
    open("p1-map-craft-accounts");
    expect(factRows()).toEqual([
      ["Состояние", "завершён"],
      ["Находки", "18 находок3 critical6 major9 minor"],
      ["Оценки раздела", "accountsаудит 8 из 20·критика 18 из 40"],
    ]);
    const meta = reader().querySelector("[data-slot=report-meta]") as HTMLElement;
    // «отчёт критика» on the line above names the agent, so this line starts at the model
    expect(meta).toHaveTextContent(/^claude-opus-5-5 · 9 мин · 3,4 млн токенов$/);
    expect(meta.previousElementSibling).toHaveTextContent(/^отчёт критика/);
    expect(meta).toHaveClass("text-muted-foreground");
    // the line sits in the identity, above the fact list
    expect(meta.compareDocumentPosition(reader().querySelector("[data-slot=fact-list]") as Node) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // 18 findings of the critic, 20 in «Находки» with its two ideas: the count stays plain (Conventions 7)
    expect(reader().querySelector("[data-slot=report-severity] [data-slot=count]")).toHaveTextContent("18 находок");
    // the current report's score is marked, not a link
    expect(reader().querySelector("[data-slot=score-audit] [aria-current]")).toHaveTextContent("8");
    await user.click(screen.getByRole("button", { name: "Подробнее" }));
    expect(factRows().slice(3, 7)).toEqual([
      ["Агент", "критикfsloop-critic"],
      ["Линза критика", "craft assess"],
      ["Этап", "проход 1 · карта"],
      ["Начало", "14.11 20:01 МСК"],
    ]);
    // what the line holds is not repeated as a row
    expect(factRows().map((r) => r[0])).not.toContain("Модель");
  });

  test("craft-13: a launch the record leaves without model, duration or tokens: the line skips them, «Подробнее» says «не записано»", async () => {
    const user = userEvent.setup({ delay: null });
    const bare: Launch = { ...launch("p1-map-craft-accounts"), model: null, seconds: null, spend: null };
    open(bare.id, {}, { ...run, launches: run.launches.map((l) => (l.id === bare.id ? bare : l)) });
    // nothing left to say on the line: no empty line holds a place
    expect(reader().querySelector("[data-slot=report-meta]")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Подробнее" }));
    const rows = new Map(factRows().map(([k, v]) => [k, v]));
    expect(rows.get("Модель")).toBe("не записано");
    expect(rows.get("Длительность")).toBe("не записано");
    expect(rows.get("Токены")).toBe("не записано");
  });

  test("craft-13: the section tabs stay in view while the report scrolls — sticky on the page's ground, the frames a tab of their own", () => {
    open("p1-map-craft-accounts");
    // the strip is the shared tabs' list: its root pins it to the reader's top on the page's ground
    const tabs = reader().querySelector("[data-slot=report-sections] > [data-slot=tabs]") as HTMLElement;
    expect(within(tabs).getByRole("tablist", { name: "Разделы отчёта" }).parentElement).toBe(tabs);
    expect(tabs).toHaveClass("[&>[role=tablist]]:sticky", "[&>[role=tablist]]:top-0", "[&>[role=tablist]]:z-10", "[&>[role=tablist]]:bg-background");
    // the frames no longer stand between the facts and the tabs
    expect(reader().querySelector("[data-slot=frame-strip]")).toBeNull();
    expect(accountsFrames).toBeGreaterThan(0);
    expect(tabNames()).toContain(`Кадры${accountsFrames}`);
  });

  test("craft-13: «Кадры» with none says why", () => {
    open("p1-review-critic-code", { tab: "frames" });
    expect(within(reader()).getByRole("tabpanel")).toHaveTextContent(/^Кадров нет: отчёт не оценивал раздел интерфейса, а его находки не ссылаются на кадры\.$/);
  });

  test("craft-13: «Находки» lists FindingRows that expand in place, several at once", async () => {
    const user = userEvent.setup({ delay: null });
    open("p1-map-craft-accounts");
    const list = reader().querySelector("[data-slot=report-findings]") as HTMLElement;
    const rows = list.querySelectorAll<HTMLElement>("[data-slot=finding-row]");
    expect(rows).toHaveLength(18);
    expect(list.querySelectorAll("[data-slot=finding-article]")).toHaveLength(0);
    // each row's box is one fixed line, so the list never jumps as it renders
    for (const r of rows) expect(r).toHaveClass("h-8");
    const items = [...list.querySelectorAll<HTMLElement>(":scope > li")];
    const first = items[0];
    const toggle = within(first).getByRole("button", { name: `Развернуть находку ${first.dataset.finding?.split("#")[1]}` });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    const detail = document.getElementById(toggle.getAttribute("aria-controls") as string) as HTMLElement;
    expect(first).toContainElement(detail);
    expect(within(detail).getByRole("link", { name: "Открыть в находках" })).toHaveAttribute("href", runPath(KEY, { view: "findings", finding: first.dataset.finding as string }));
    expect(detail.querySelectorAll("[data-slot=finding-article]")).toHaveLength(1);
    // a click on the row's sentence opens the next one too; the first stays open
    await user.click(items[1].querySelector("[data-slot=finding-row] > span:nth-child(3)") as HTMLElement);
    expect(list.querySelectorAll("[data-slot=finding-article]")).toHaveLength(2);
    await user.click(toggle);
    expect(list.querySelectorAll("[data-slot=finding-article]")).toHaveLength(1);
  });

  test("«Подробнее»: tokens by kind, the first request, child launches with their tokens, the agent id, the transcript", async () => {
    const user = userEvent.setup({ delay: null });
    const view = open("p1-map-map");
    await user.click(screen.getByRole("button", { name: "Подробнее" }));
    expect(factRows().slice(-8)).toEqual([
      ["Вход", "900 токенов"],
      // a number from five digits groups its thousands with a no-break space
      ["Выход", "40 000 токенов"],
      ["Запись в кэш", "250 000 токенов"],
      ["Чтение кэша", "3 100 000 токенов"],
      ["Первый запрос", "38 000 токенов"],
      ["Дочерние запуски", "3 запуска агента · 1,7 млн токенов"],
      ["Id агента", "a5e0000"],
      ["Транскрипт", "не записано: запись запуска не называет файл"],
    ]);
    view.unmount();
    // a row written before those columns: absent, never a guessed zero
    const old: Launch = { ...launch("p1-map-map") };
    delete old.boot;
    delete old.children;
    delete old.agentId;
    open(old.id, {}, { ...run, launches: run.launches.map((l) => (l.id === old.id ? old : l)) });
    expect(factRows().slice(-4, -1)).toEqual([
      ["Первый запрос", "не записано: в записи запуска нет этой колонки"],
      ["Дочерние запуски", "не записано: в записи запуска нет этой колонки"],
      ["Id агента", "не записано: запись запуска его не называет"],
    ]);
  });

  test("a report whose findings are all of «Находки»'s slice links its count there", () => {
    open("p1-review-critic-code");
    const link = reader().querySelector("[data-slot=report-severity] [data-slot=count-link]") as HTMLElement;
    expect(link).toHaveTextContent("30 находок");
  });

  test("the tabs: fixed for a critic, counts, a muted «0» whose body says the critic wrote nothing; «Файл отчёта» last", async () => {
    const user = userEvent.setup({ delay: null });
    const view = open("p1-review-critic-code");
    // a code critic judges no surface and its findings cite no frame: «Кадры» stays, a muted «0», so the strip matches
    expect(tabNames()).toEqual(["Находки30", "Не проверено0", "Идеи вне прогона0", "Порядок правок0", "Допущения0", "Кадры0", "Файл отчёта"]);
    // two critics of other lenses keep the same strip, plus the sections their lens writes
    view.unmount();
    open("p1-map-craft-accounts");
    expect(tabNames()).toEqual(["Находки18", "Не проверено1", "Идеи вне прогона2", "Порядок правок1", "Допущения1", `Кадры${accountsFrames}`, "Файл отчёта"]);
    const zero = reportTabs(launch("p1-review-critic-code"), 30)[1];
    expect(zero).toMatchObject({ label: "Не проверено", count: 0 });
    await user.click(screen.getByRole("tab", { name: /^Не проверено/ }));
    await user.click(screen.getByRole("tab", { name: /^Порядок правок/ }));
    expect(within(reader()).getByRole("tabpanel")).toHaveTextContent("accounts: /impeccable clarify, harden, polish");
  });

  test("a zero tab reads «Критик ничего сюда не записал.»", () => {
    open("p1-review-critic-code", { tab: "unverified" });
    const tab = screen.getByRole("tab", { name: /^Не проверено/ });
    expect(tab.querySelector("[data-slot=tab-count]")).toHaveClass("text-muted-foreground");
    expect(within(reader()).getByRole("tabpanel")).toHaveTextContent("Критик ничего сюда не записал.");
  });

  test("«Находки»: a severity filter over the report's rows", async () => {
    const user = userEvent.setup({ delay: null });
    open("p1-map-craft-accounts");
    const list = reader().querySelector("[data-slot=report-findings]") as HTMLElement;
    await user.click(screen.getByRole("radio", { name: /^critical/ }));
    expect(list.querySelectorAll("[data-slot=finding-row]")).toHaveLength(3);
  });

  test("a design check: its conventions as a tab, with a link to «Соглашения»", async () => {
    open("p1-decompose-design-check", { tab: "conventions" });
    expect(tabNames()).toEqual(["Находки10", "Не проверено0", "Идеи вне прогона0", "Порядок правок0", "Допущения0", "Соглашения26", "Кадры0", "Файл отчёта"]);
    const panel = within(reader()).getByRole("tabpanel");
    expect(panel.querySelectorAll("[data-slot=section-items] > li")).toHaveLength(26);
    expect(within(panel).getByRole("link", { name: "Все соглашения прогона" })).toHaveAttribute("href", runPath(KEY, { view: "conventions" }));
  });

  test("a verdict critic: resolved / partial / unresolved as its outcome; ids in its text are links", () => {
    open("p1-verdict-critic-code-verdict", { tab: "verdict" });
    expect(factRows()[1]).toEqual(["Вердикты", "1 resolved · 1 partial · 0 unresolved"]);
    const panel = within(reader()).getByRole("tabpanel");
    expect(within(panel).getByRole("link", { name: "p1-review-critic-code#code-1" })).toHaveAttribute("href", runPath(KEY, { view: "findings", finding: "p1-review-critic-code#code-1" }));
  });
});

describe("other kinds", () => {
  test("an implementer: its RESULT … VERIFY tabs, the result as its outcome, the unit a link", async () => {
    const user = userEvent.setup({ delay: null });
    open("p1-units-u1-implement");
    // no frames: an implementer's strip has no «Кадры»
    expect(tabNames()).toEqual(["Итог1", "Файлы1", "Тесты2", "Заметки0", "Находки1", "Паритет0", "Проверка кода1", "Файл отчёта"]);
    expect(factRows()).toEqual([
      ["Состояние", "завершён"],
      ["Итог", "done"],
      ["Находки", "1 находка1 без серьёзности"],
    ]);
    // «отчёт запуска» does not name the agent: the line does
    expect(reader().querySelector("[data-slot=report-meta]")).toHaveTextContent(/^исполнитель · claude-opus-5-5 · /);
    await user.click(screen.getByRole("button", { name: "Подробнее" }));
    expect(reader().querySelector("[data-slot=fact] a[href*='unit=u1']")).toHaveTextContent("u1");
    expect(reader()).toHaveTextContent("отчёт запуска");
  });

  test("the map: no sections, only «Файл отчёта» — its free text with its eight tables, each scrolling sideways in its own box", async () => {
    open("p1-map-map");
    expect(tabNames()).toEqual(["Файл отчёта"]);
    const file = await loadedFile();
    expect(within(file).getByRole("heading", { name: "Map of the project" })).toBeInTheDocument();
    const tables = within(file).getAllByRole("region", { name: "Таблица" });
    expect(tables).toHaveLength(8);
    for (const t of tables) expect(t).toHaveClass("overflow-x-auto", "max-w-full", "border", "[scrollbar-gutter:stable]");
    expect(file.querySelector("[data-slot=running-text]")).toHaveClass("max-w-measure");
  });

  test("research: its own section as written, then the file", () => {
    open("p1-spike-spike-telegram");
    expect(tabNames()).toEqual(["SPIKE1", "Файл отчёта"]);
    expect(factRows()[0]).toEqual(["Состояние", "завершён"]);
  });
});

describe("«Файл отчёта»", () => {
  test("the file as written, read when the tab opens: «Загрузка…» in a reserved region first, then every line", async () => {
    const written = readFileSync(join(fx.dirOf(N), "reports", "p1-map-craft-accounts.md"), "utf8");
    let release: () => void = () => {};
    const gate = new Promise<void>((r) => (release = r));
    const asked: string[] = [];
    const fetchReport: FetchReport = async (runKey, file) => {
      asked.push(`${runKey} ${file}`);
      await gate;
      return handlerReport(fx)(runKey, file);
    };
    renderOver(fx, run, runPath(KEY, { view: "reports", report: "p1-map-craft-accounts", tab: "file" }), ReportsView, { fetchReport });
    const loading = reader().querySelector("[data-slot=report-file-loading]") as HTMLElement;
    expect(loading).toHaveClass("h-48");
    expect(within(loading).getByRole("status")).toHaveTextContent("Загрузка…");
    expect(asked).toEqual([`${KEY} p1-map-craft-accounts.md`]);
    release();
    const file = await loadedFile();
    expect(reader().querySelector("[data-slot=report-file-loading]")).toBeNull();
    // every line as written: the lens, a finding line, an idea, the order
    for (const line of ["LENS: craft assess", "UNVERIFIED:", "A shortcut for the accounts list would save a step (2).", "accounts: /impeccable clarify, harden, polish"]) expect(written).toContain(line);
    expect(file).toHaveTextContent("LENS: craft assess");
    expect(file).toHaveTextContent(/craft-18 \[craft\] critical/);
    expect(file).toHaveTextContent("A shortcut for the accounts list would save a step (2).");
    expect(file).toHaveTextContent("accounts: /impeccable clarify, harden, polish");
  });

  test("a file that cannot be read: «Отчёт <file> не прочитан: <причина>» in its place", async () => {
    const fetchReport: FetchReport = async () => new Response(JSON.stringify({ error: "Отчёт p1-map-craft-accounts.md не прочитан", cause: "EISDIR: illegal operation on a directory, read" }), { status: 500 });
    renderOver(fx, run, runPath(KEY, { view: "reports", report: "p1-map-craft-accounts", tab: "file" }), ReportsView, { fetchReport });
    await waitFor(() => expect(reader().querySelector("[data-slot=part-failed]")).toHaveTextContent("Отчёт p1-map-craft-accounts.md не прочитан: EISDIR: illegal operation on a directory, read"));
  });

  test("a 59.8 kB file with markdown tables renders whole", async () => {
    const rows = Array.from({ length: 520 },(_, k) => `| ${k + 1} | function ${k + 1} of the prototype, kept as is | template.html:${k * 11} | read by fsl.mjs, shown in «Находки» |`);
    const text = ["# Map", "", "| # | what | where | note |", "|---|---|---|---|", ...rows, "", "The last line of the map."].join("\n");
    expect(new TextEncoder().encode(text).length).toBeGreaterThan(59_000);
    renderOver(fx, run, runPath(KEY, { view: "reports", report: "p1-map-map" }), ReportsView, { fetchReport: async () => new Response(text) });
    const file = await loadedFile();
    expect(within(file).getByRole("region", { name: "Таблица" }).querySelectorAll("tbody tr")).toHaveLength(520);
    expect(file).toHaveTextContent("The last line of the map.");
  });
});

describe("the states of the WALK", () => {
  test("a running launch: its facts and «Отчёт появится, когда запуск закончит»", () => {
    open("aa5b5ec85u30");
    expect(within(reader()).getByRole("heading", { level: 2 })).toHaveTextContent("u30 implement");
    expect(factRows()).toEqual([
      ["Состояние", "работает · 12 мин"],
      ["Агент", "исполнительfsloop-implement"],
      ["Этап", "проход 2 · приёмка"],
      ["Начало", "19:29 МСК"],
      ["Последняя запись в транскрипт", "1 мин назад"],
    ]);
    expect(reader().querySelector("[data-slot=report-running]")).toHaveTextContent("Отчёт появится, когда запуск закончит");
    expect(within(reader()).queryAllByRole("tab")).toHaveLength(0);
  });

  test("a missing or unreadable file: «Отчёт <file> не прочитан: <причина>» in the sections' place", () => {
    const l: Launch = { ...launch("p1-map-craft-accounts"), reportMissing: true };
    const over = { ...run, launches: run.launches.map((x) => (x.id === l.id ? l : x)), errors: [{ file: "reports/p1-map-craft-accounts.md", cause: "файла нет" }] };
    open(l.id, {}, over);
    expect(reader().querySelector("[data-slot=part-failed]")).toHaveTextContent("Отчёт p1-map-craft-accounts.md не прочитан: файла нет");
    expect(within(reader()).queryAllByRole("tab")).toHaveLength(0);
    expect(factRows()[0]).toEqual(["Состояние", "нет отчёта"]);
  });

  test("a partly parsed report: one line naming the unread lines, which «Файл отчёта» holds", async () => {
    const user = userEvent.setup({ delay: null });
    const unparsed = [3, 9, 14].map((line) => ({ id: `p1-map-craft-accounts#u${line}`, section: "FINDINGS", line, text: `garbled line ${line}` }));
    const l: Launch = { ...launch("p1-map-craft-accounts"), unparsed };
    open(l.id, {}, { ...run, launches: run.launches.map((x) => (x.id === l.id ? l : x)) });
    expect(reader().querySelector("[data-slot=report-unparsed]")).toHaveTextContent("3 строки не разобраны — они на вкладке «Файл отчёта»");
    expect(unparsedText(1)).toBe("1 строка не разобрана — она на вкладке «Файл отчёта»");
    expect(unparsedText(12)).toBe("12 строк не разобраны — они на вкладке «Файл отчёта»");
    await user.click(screen.getByRole("tab", { name: /^Файл отчёта/ }));
    // the tab holds the file as written, so the lines the parser skipped are there
    await waitFor(() => expect(reader().querySelector("[data-slot=report-file]")).toHaveTextContent("LENS: craft assess"));
  });
});

describe("the production shape", () => {
  test("a 59.8 kB report reads in full; 20 frames show 16 and «ещё 4 кадра»; scores over five stages link four", () => {
    const items = Array.from({ length: 240 },(_, k) => `Assumption ${k + 1}: ${"the operator reads the report at a 75-character measure and keeps every fact; ".repeat(3)}`.slice(0, 259));
    const l: Launch = { ...launch("p1-map-craft-accounts"), sections: { ...launch("p1-map-craft-accounts").sections, ASSUMPTIONS: { value: "", items } } };
    const frames = Array.from({ length: 20 }, (_, k) => `p1-baseline-accounts-${k + 1}.png`);
    const stages = ["p1-map", "p1-assess", "p2-review", "p2-assess", "p3-assess"];
    const scores = stages.map((stage, k) => ({ stage, launch: k === 0 ? l.id : `${stage}-craft-accounts`, audit: 8 + k, auditMax: 20, critique: 18 + k, critiqueMax: 40 }));
    const extra = stages.slice(1).map((stage) => ({ ...l, id: `${stage}-craft-accounts`, stage }));
    const surfaces: Surface[] = run.surfaces.map((s) => (s.key === "accounts" ? { ...s, frames, scores } : s));
    expect(new TextEncoder().encode(items.join("\n")).length).toBeGreaterThan(59_000);
    const over = { ...run, launches: [...run.launches.map((x) => (x.id === l.id ? l : x)), ...extra], surfaces };
    const view = open(l.id, { tab: "assumptions" }, over);
    const panel = within(reader()).getByRole("tabpanel");
    expect(panel.querySelectorAll("[data-slot=section-items] > li")).toHaveLength(240);
    expect(panel).toHaveTextContent(items[239].trim());
    expect(panel.querySelector("[data-slot=running-text]")?.closest("div.max-w-measure")).toBeTruthy();
    view.unmount();
    // the frames are a tab of their own (craft-13): «Кадры 20»
    open(l.id, { tab: "frames" }, over);
    expect(screen.getByRole("tab", { name: /^Кадры/ })).toHaveTextContent("Кадры20");
    const strip = within(reader()).getByRole("tabpanel").querySelector("[data-slot=frame-strip]") as HTMLElement;
    expect(within(strip).getAllByRole("button", { name: /^Открыть кадр / })).toHaveLength(16);
    for (const t of within(strip).getAllByRole("button", { name: /^Открыть кадр / })) expect(t).toHaveClass("h-thumb-h", "w-thumb-w");
    expect(within(strip).getByRole("button", { name: "ещё 4 кадра" })).toBeInTheDocument();
    const audit = reader().querySelector("[data-slot=score-audit]") as HTMLElement;
    expect(audit).toHaveTextContent("аудит 8 → 9 → 10 → 11 → 12 из 20");
    expect(within(audit).getAllByRole("link")).toHaveLength(4);
    expect(within(audit).getAllByRole("link")[0]).toHaveAttribute("href", runPath(KEY, { view: "reports", report: "p1-assess-craft-accounts" }));
  });
});
