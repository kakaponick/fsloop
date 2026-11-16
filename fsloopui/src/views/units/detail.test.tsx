// @vitest-environment jsdom
// Done-criterion 2: what a unit's row expands into, at the limits of surfaces/units.md → RANGES — a 287-character
// title, 28 closes, 6 launches, 31 checks — with every absent part in its place: «юнит u7 не найден», «находка <id>
// не найдена», «не записано», «Бриф units/u3/brief.md не прочитан: …». Strict 1: every list line is one fixed row.
import "../../ui/test-setup.ts";
import { appendFileSync, mkdirSync, readFileSync, utimesSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterAll, describe, expect, test } from "vitest";
import type { Unit, UnitCheck } from "../../../shared/model.ts";
import { glossaryLines, UiProvider } from "@/ui";
import { runId, writeRunningLaunch } from "../../../fixtures/make.ts";
import { applyStylesheet, usedBlockSize } from "../../app/layout-testing.ts";
import { runPath } from "../../app/routes.ts";
import { projectOf } from "../../app/testing.tsx";
import { ROW_TITLE_CHARS, UnitDetail, unitFacts, type UnitDetailProps } from "./detail.tsx";
import { checkGroups, checksOf, launchRows } from "./query.ts";
import { fixtureApp, keyOf, loadedRun, MIN, NOW, renderUnits } from "./testing.tsx";
import { attemptsText, CHECK_HEAD, checkOutcome, closesTitle, LAUNCH_HEAD, LAUNCH_STATE_GLOSSARY, LOG_LINE_GLOSSARY, LOG_WORD, logName } from "./words.ts";

const N = 40;
const fx = fixtureApp({ only: [N] });
afterAll(() => fx.close());
const base = loadedRun(fx, N);
const KEY = keyOf(N);

const TITLE = `${"Bring the units view to the law: every fact of run.json in the row and its detail, ".repeat(4)}`.slice(0, 286) + ".";
const MISSING = "p1-review-critic-code#code-999";
const recorded = base.launches.filter((l) => l.stage === "p1-units").slice(0, 5);
const closes = [...base.findings.slice(0, 27).map((f) => f.id), MISSING];
const unit: Unit = {
  ...(base.units.find((u) => u.id === "u24") as Unit),
  title: TITLE,
  kind: null,
  blockedBy: ["u23", "u77"],
  blockedWhy: null,
  closes,
  launches: recorded.map((l) => l.id),
  brief: "units/u3/brief.md",
  tree: null,
  sha: null,
  commits: [],
};
const runningStart = new Date(NOW - 12 * MIN).toISOString();
const run = {
  ...base,
  units: base.units.map((u) => (u.id === "u24" ? unit : u)),
  // the findings name u24 as the server would for this brief: exactly the ones it closes
  findings: base.findings.map((f) => ({ ...f, units: [...f.units.filter((id) => id !== "u24"), ...(closes.includes(f.id) ? ["u24"] : [])] })),
  running: [{ agentId: "a0c1", description: "u24 implement", agent: "fsloop-implement", name: "u24 · исполнитель", startedAt: runningStart, lastAt: runningStart }],
  errors: [...base.errors, { file: "units/u3/brief.md", cause: "файла нет" }],
};

/** 31 checks over two logs: three labels retried ten times in verify, the last tests run red; one land. */
const checks: UnitCheck[] = [
  ...Array.from({ length: 30 }, (_, k) => {
    const label = ["type-check", "lint", "tests"][k % 3];
    const last = k >= 27;
    return { file: "verify.log.lines", n: k + 1, label, exit: label === "tests" && last ? 1 : 0, line: label === "tests" && last ? "2 failed" : null, seconds: 14, endedAt: new Date(NOW - (40 - k) * MIN).toISOString() };
  }),
  { file: "land.log.lines", n: 1, label: "push", exit: 0, line: "main", seconds: 4, endedAt: new Date(NOW - 5 * MIN).toISOString() },
];

const mount = (u: Unit = unit, c: readonly UnitCheck[] | null = checks, r: UnitDetailProps["run"] = run) =>
  render(
    <UiProvider>
      <MemoryRouter>
        <UnitDetail run={r} unit={u} checks={c} now={NOW} />
      </MemoryRouter>
    </UiProvider>,
  );

const section = (title: string | RegExp) => screen.getByRole("heading", { name: title }).closest("section") as HTMLElement;

describe("a unit's detail at the production limits", () => {
  const dts = () => [...(document.querySelector("[data-slot=fact-list]") as HTMLElement).querySelectorAll("dt")];
  const value = (label: string) => dts().find((d) => d.textContent === label)?.nextElementSibling as HTMLElement;

  test("the fact list: the whole 287-character title the row cuts, the kind not recorded, each unit it waits for with its state, the failed brief — no «—» fact", () => {
    expect(TITLE).toHaveLength(287);
    mount();
    expect(dts().map((d) => d.textContent)).toEqual(["Ждёт юнитов", "Что делает", "Вид работы", "Бриф юнита"]);
    expect(value("Что делает").textContent).toBe(TITLE);
    expect(value("Вид работы")).toHaveTextContent("не записано");
    expect(within(value("Ждёт юнитов")).getByRole("link", { name: "u23" })).toHaveAttribute("href", runPath(KEY, { view: "units", unit: "u23" }));
    expect(value("Ждёт юнитов")).toHaveTextContent("u23заблокирован");
    expect(value("Ждёт юнитов")).toHaveTextContent("юнит u77 не найден");
    expect(value("Бриф юнита")).toHaveTextContent("Бриф units/u3/brief.md не прочитан: файла нет");
    expect(document.querySelector("[data-slot=fact-list]")).not.toHaveTextContent("—");
  });

  test("craft-12: only facts the row does not show and that hold for the unit's state", () => {
    expect(ROW_TITLE_CHARS).toBe(24);
    // committed, a short title, one commit, no tree: the row says it all but the kind and the brief
    const done: Unit = { ...unit, state: "committed", title: "part 22", kind: "backend", sha: "c0ffee16", commits: ["c0ffee16"], tree: null, blockedBy: ["u23"], blockedWhy: "stale" };
    expect(unitFacts(run, done).map((f) => f.label)).toEqual(["Вид работы", "Бриф юнита"]);
    // blocked, with its cause, its own working copy and commits past the row's one: each is a fact
    const stuck: Unit = { ...unit, state: "blocked", title: "part 7", blockedBy: [], blockedWhy: "tests stay red", tree: "C:/dev/wt/u24", sha: "c0ffee01", commits: ["c0ffee01", "c0ffee02"] };
    expect(unitFacts(run, stuck).map((f) => f.label)).toEqual(["Причина блокировки", "Вид работы", "Рабочая копия", "Коммиты", "Бриф юнита"]);
    // waiting on committed units only: it waits for no one
    const free: Unit = { ...unit, state: "ready", title: "part 3", blockedBy: run.units.filter((u) => u.state === "committed").slice(0, 2).map((u) => u.id) };
    expect(unitFacts(run, free).map((f) => f.label)).toEqual(["Вид работы", "Бриф юнита"]);
    // a title a 24-character floor can cut is given whole; one it cannot is not repeated
    expect(unitFacts(run, { ...free, title: "x".repeat(25) }).map((f) => f.label)[0]).toBe("Что делает");
    expect(unitFacts(run, { ...free, title: "x".repeat(24) }).map((f) => f.label)[0]).toBe("Вид работы");
  });

  test("craft-12: the findings it closes come first, then the facts, the launches, the checks; no scroll of its own", () => {
    mount();
    const article = document.querySelector("[data-slot=unit-detail]") as HTMLElement;
    expect([...article.children].map((c) => (c as HTMLElement).querySelector("h3")?.textContent ?? (c as HTMLElement).dataset.slot)).toEqual(["Закрывает 28 находок", "fact-list", "Запуски агентов", "Проверки юнита"]);
    expect(article.className).not.toMatch(/max-h|overflow/);
  });

  test("craft-33: each list opens on one muted header row — the launch's start and the check's end are named", () => {
    mount();
    const head = (title: string) => section(title).querySelector("[data-slot=list-head]") as HTMLElement;
    expect(within(section("Запуски агентов")).getByRole("table", { name: "Запуски агентов" })).toBeInTheDocument();
    expect(within(head("Запуски агентов")).getAllByRole("columnheader").map((h) => h.textContent)).toEqual(["Агент и задача", "Модель", "Начало", "Состояние", "Токены"]);
    expect(within(head("Проверки юнита")).getAllByRole("columnheader").map((h) => h.textContent)).toEqual(["Проверка", "Итог", "Попытки", "Конец", "Строка лога"]);
    expect(LAUNCH_HEAD.join(" ").split(" ")).toHaveLength(7);
    expect(CHECK_HEAD.join(" ").split(" ")).toHaveLength(6);
    for (const t of ["Запуски агентов", "Проверки юнита"]) {
      expect(head(t)).toHaveClass("h-7", "text-xs", "text-muted-foreground");
      // the header and the lines share one grid, so each label stands over its values
      const line = section(t).querySelector("[data-slot=unit-launch], [data-slot=unit-check]") as HTMLElement;
      expect([...head(t).classList].filter((c) => c.startsWith("grid-cols-"))).toEqual([...line.classList].filter((c) => c.startsWith("grid-cols-")));
    }
    expect(within(section("Проверки юнита")).getAllByRole("rowheader").map((h) => h.textContent)).toEqual(["лог verify", "лог land"]);
  });

  test("«Закрывает 28 находок»: u4's read-only rows, each linking to its address; the unknown id «не найдена»; no verdict", () => {
    mount();
    const closesSection = section("Закрывает 28 находок");
    const items = closesSection.querySelectorAll("li");
    expect(items).toHaveLength(28);
    for (const li of [...items].slice(0, 27)) expect(li.querySelector("[data-slot=finding-row]")).toHaveClass("h-8");
    const first = base.findings[0];
    expect(within(items[0]).getByRole("link", { name: first.local })).toHaveAttribute("href", runPath(KEY, { view: "findings", finding: first.id }));
    expect(items[27]).toHaveTextContent(`находка ${MISSING} не найдена`);
    expect(screen.queryByRole("radio")).toBeNull();
    expect(screen.queryByText("Оценить…")).toBeNull();
  });

  test("«Запуски агентов»: six lines — agent and description, model, start in МСК, state with its duration, tokens with the split in the title; the running one «работает · 12 мин»", () => {
    expect(launchRows(run, unit)).toHaveLength(6);
    mount();
    const lines = section("Запуски агентов").querySelectorAll<HTMLElement>("[data-slot=unit-launch]");
    expect(lines).toHaveLength(6);
    for (const l of lines) expect(l).toHaveClass("h-8");
    const first = recorded[0];
    expect(lines[0]).toHaveTextContent(`исполнитель ${first.description}`);
    expect(within(lines[0]).getByRole("link", { name: first.description as string })).toHaveAttribute("href", runPath(KEY, { view: "reports", report: first.id }));
    expect(lines[0]).toHaveTextContent("claude-opus-5-5");
    expect(lines[0]).toHaveTextContent(/\d\d\.\d\d \d\d:\d\d МСК/);
    expect(lines[0]).toHaveTextContent("завершён за 9 мин");
    const tokens = within(lines[0]).getAllByRole("cell")[4];
    // the fixture's spend: input 9xx, output 40 000, cache write 250 000, cache read 3 100 000 — about 3,39 million;
    // the compact number alone under «Токены» (improve-8 (5))
    expect(tokens.textContent).toBe("3,4 млн");
    expect(tokens).toHaveAttribute("title", expect.stringMatching(/^вход \d+ · выход 40\s000 · запись в кэш 250\s000 · чтение кэша 3\s100\s000$/));
    expect(lines[5]).toHaveTextContent("исполнитель u24 implement");
    expect(lines[5]).toHaveTextContent("работает · 12 мин");
    expect(lines[5]).toHaveTextContent("19:29 МСК");
    expect(lines[5]).toHaveTextContent("не записано");
  });

  test("«Проверки»: by log, each label once with its last outcome and «10 попыток»; a red exit stays neutral while the unit is not blocked", () => {
    expect(checks).toHaveLength(31);
    const groups = checkGroups(checks);
    expect(groups.map((g) => [g.log, g.lines.map((l) => `${l.label} ${l.outcome} ${attemptsText(l.attempts) ?? ""}`.trim())])).toEqual([
      ["verify", ["type-check прошла 10 попыток", "lint прошла 10 попыток", "tests упала · exit 1 10 попыток"]],
      ["land", ["push прошла 1 попытка"]],
    ]);
    mount();
    const lines = section("Проверки юнита").querySelectorAll<HTMLElement>("[data-slot=unit-check]");
    expect(lines).toHaveLength(4);
    for (const l of lines) expect(l).toHaveClass("h-8");
    expect(lines[2]).toHaveTextContent("tests");
    expect(lines[2]).toHaveTextContent("упала · exit 1");
    expect(lines[2]).toHaveTextContent("10 попыток");
    expect(lines[2]).toHaveTextContent("2 failed");
    expect(lines[2].querySelector("[data-tone]")).toHaveAttribute("data-tone", "neutral");
  });

  test("a blocked unit's red check takes the amber tone: the run waits on it (Conventions 2)", () => {
    mount({ ...unit, state: "blocked", blockedWhy: "tests stay red" });
    const lines = section("Проверки юнита").querySelectorAll<HTMLElement>("[data-slot=unit-check]");
    expect(lines[2].querySelector("[data-tone]")).toHaveAttribute("data-tone", "warning");
    expect(lines[0].querySelector("[data-tone]")).toHaveAttribute("data-tone", "neutral");
  });

  test("the absent parts: no checks in the model read «не записано»; no closes, no launches read their own words", () => {
    // a unit that closes nothing: no finding names it either
    mount({ ...unit, closes: [], launches: [], blockedBy: [] }, null, { ...run, findings: base.findings.map((f) => ({ ...f, units: f.units.filter((id) => id !== "u24") })), running: [], errors: base.errors });
    expect(screen.queryByRole("heading", { name: "Не закрывает ни одной находки" })).toBeNull();
    expect(screen.getByText("Не закрывает ни одной находки")).toBeInTheDocument();
    expect(section("Запуски агентов")).toHaveTextContent("—");
    expect(section("Проверки юнита")).toHaveTextContent("не записано");
    const facts = document.querySelector("[data-slot=fact-list]") as HTMLElement;
    expect(facts).toHaveTextContent("units/u3/brief.md");
  });

  test("verdict cand-10: a finding it closes expands in place into the shared article, as in «Отчёты»; the chevron controls a panel only while it exists", async () => {
    const user = userEvent.setup({ delay: null });
    mount();
    const items = section("Закрывает 28 находок").querySelectorAll("li");
    const first = base.findings[0];
    const toggle = within(items[0]).getByRole("button", { name: `Развернуть находку ${first.local}` });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(toggle).not.toHaveAttribute("aria-controls");
    await user.click(toggle);
    const open = within(items[0]).getByRole("button", { name: `Свернуть находку ${first.local}` });
    expect(open).toHaveAttribute("aria-expanded", "true");
    const panel = document.getElementById(open.getAttribute("aria-controls") as string) as HTMLElement;
    expect(items[0]).toContainElement(panel);
    expect(panel.querySelector("[data-slot=finding-article]")).toHaveAttribute("aria-label", `Находка ${first.id}`);
    expect(within(panel).getByRole("link", { name: "Открыть в находках" })).toHaveAttribute("href", runPath(KEY, { view: "findings", finding: first.id }));
    // the article opens under its own row: the next finding's row follows it
    expect(items[0].nextElementSibling).toBe(items[1]);
    // the verdict stays in «Находки» (Conventions 6)
    expect(screen.queryByRole("radio")).toBeNull();
    // the unknown id has nothing to expand
    expect(within(items[27]).queryByRole("button")).toBeNull();
    await user.click(open);
    expect(items[0].querySelector("[data-slot=finding-article]")).toBeNull();
  });

  test("verdict cand-1: «Закрывает N» counts the findings the run gave the unit, the same set as its row's counts — u22's brief names none", () => {
    const u22 = base.units.find((u) => u.id === "u22") as Unit;
    const naming = base.findings.filter((f) => f.units.includes("u22"));
    expect(u22.closes).toEqual([]);
    expect(naming).toHaveLength(1);
    mount(u22, null, base);
    expect(screen.queryByRole("heading", { name: "Не закрывает ни одной находки" })).toBeNull();
    const items = section("Закрывает 1 находку").querySelectorAll("li");
    expect(items).toHaveLength(1);
    expect(within(items[0]).getByRole("link", { name: naming[0].local })).toHaveAttribute("href", runPath(KEY, { view: "findings", finding: naming[0].id }));
  });

  test("verdict cand-12: a section's heading is the page's title type — 14 px, 600, ink — above its list's 12 px muted header row", () => {
    mount();
    for (const t of ["Закрывает 28 находок", "Запуски агентов", "Проверки юнита"]) {
      const h = screen.getByRole("heading", { name: t });
      expect(h).toHaveClass("text-sm", "font-semibold", "text-foreground");
      expect(h).not.toHaveClass("text-xs", "text-muted-foreground");
      // its line is reserved at 28 px, so the strip that may stand in it moves nothing
      expect(h.parentElement).toHaveClass("h-7");
    }
  });

  test("p2-assess-critic-improve#improve-8 (2)–(4), design-8: «лог land» heads its group; «Строка лога» is the line as written, in mono; an empty «Попытки», «Конец» or line is the shared «—»", () => {
    expect(LOG_WORD).toBe("лог");
    const more: UnitCheck[] = [...checks, { file: "debug.lines", n: 1, label: "repro", exit: 0, line: null, seconds: null, endedAt: null }];
    mount(unit, more);
    const heads = within(section("Проверки юнита")).getAllByRole("rowheader");
    expect(heads.map((h) => h.textContent)).toEqual(["лог verify", "лог land", "лог debug"]);
    expect(heads.map((h) => (h.textContent ?? "").split(" ").length)).toEqual([2, 2, 2]);
    for (const h of heads) expect(h.querySelector(".font-mono")?.textContent).toMatch(/^(verify|land|debug)$/);
    const lines = section("Проверки юнита").querySelectorAll<HTMLElement>("[data-slot=unit-check]");
    const cells = (i: number) => within(lines[i]).getAllByRole("cell");
    // «tests»: retried ten times, its line as fsloop wrote it — never rewritten into a duration
    expect(cells(2)[4].querySelector(".font-mono")).toHaveTextContent(/^2 failed$/);
    expect(cells(2)[4]).toHaveAttribute("title", "2 failed");
    // «push» ran once: «1 попытка», a value, never the «—» of none (craft-8); its line «main» as written
    expect(cells(3)[2]).toHaveTextContent(/^1 попытка$/);
    expect(cells(3)[4].querySelector(".font-mono")).toHaveTextContent(/^main$/);
    // «repro»: no end, no line recorded
    expect(cells(4)[3].querySelector("[data-slot=dash]")).not.toBeNull();
    expect(cells(4)[4].querySelector("[data-slot=dash]")).not.toBeNull();
    for (let i = 0; i < 5; i++) for (const c of cells(i)) expect(c.textContent).not.toBe("");
  });

  test("p2-assess-critic-improve#improve-8 (7): the launches' «Состояние» and the checks' «Строка лога» carry their glossaries, once, on the header", () => {
    mount();
    const head = (title: string, label: string) => within(section(title).querySelector("[data-slot=list-head]") as HTMLElement).getByRole("button", { name: label });
    expect(head("Запуски агентов", "Состояние")).toHaveAttribute("data-slot", "glossary-term");
    expect(head("Проверки юнита", "Строка лога")).toHaveAttribute("data-slot", "glossary-term");
    // no glossary on an item
    for (const l of document.querySelectorAll("[data-slot=unit-launch], [data-slot=unit-check]")) expect(l.querySelector("[data-slot=glossary-term]")).toBeNull();
    expect(glossaryLines(LAUNCH_STATE_GLOSSARY)).toEqual(["работает · 12 мин — агент ещё не вернул отчёт; время — с его запуска", "завершён за 9 мин — агент вернул отчёт; время — сколько он работал", "нет отчёта — запуск записан, но файла его отчёта нет"]);
    expect(glossaryLines(LOG_LINE_GLOSSARY)).toEqual(["Строка лога — что проверка вывела последней строкой, как записано в логе"]);
    expect(glossaryLines(LAUNCH_STATE_GLOSSARY).map((l) => l.split(" ").length)).toEqual([15, 13, 10]);
    expect(glossaryLines(LOG_LINE_GLOSSARY)[0].split(" ")).toHaveLength(12);
  });

  test("p3-decompose-design-check#design-19: «Ждёт юнитов» is a list that says so — `role=\"list\"` on its `list-none`", () => {
    mount();
    const ul = value("Ждёт юнитов").querySelector("ul") as HTMLElement;
    expect(ul).toHaveClass("list-none");
    expect(ul).toHaveAttribute("role", "list");
  });

  test("p2-assess-critic-improve#improve-1 (3): a row of «Закрывает» leaves out the unit the detail is about", () => {
    const u22 = base.units.find((u) => u.id === "u22") as Unit;
    const runFixed = { ...base, findings: base.findings.map((f) => (f.units.includes("u22") ? { ...f, effectiveStatus: "fixed" as const, unit: "u22" } : f)) };
    mount(u22, null, runFixed);
    const state = section("Закрывает 1 находку").querySelector("[data-slot=finding-row] > span:last-child") as HTMLElement;
    expect(state.textContent).toBe("исправлена");
    expect(state).toHaveAttribute("title", "исправлена");
  });

  test("p3-review-critic-craft-2#craft-7: a blocked unit's detail opens on why it is blocked — its outcome rows first among the facts, a zero «closes» one muted line, not a heading", async () => {
    // u23 of p3-final-units-u23.png: blocked, waiting for the user, closing nothing
    const u23 = base.units.find((u) => u.id === "u23") as Unit;
    expect(u23.state).toBe("blocked");
    mount(u23, null, base);
    expect(dts().map((d) => d.textContent)).toEqual(["Причина блокировки", "Вид работы", "Бриф юнита"]);
    // a unit that waits and is blocked: both outcome rows open the list, in that order
    const both: Unit = { ...u23, blockedBy: ["u24"], title: "part 23" };
    expect(unitFacts(base, both).map((f) => f.label).slice(0, 2)).toEqual(["Ждёт юнитов", "Причина блокировки"]);
    // «Не закрывает ни одной находки»: no heading, muted, regular weight, on the section's reserved 28 px line
    expect(screen.queryByRole("heading", { name: "Не закрывает ни одной находки" })).toBeNull();
    const zero = screen.getByText("Не закрывает ни одной находки");
    expect(zero.textContent?.split(" ")).toHaveLength(5);
    await applyStylesheet();
    expect(getComputedStyle(zero).color).toBe("rgb(109, 109, 105)");
    expect(getComputedStyle(zero).fontWeight).not.toBe("600");
    expect(usedBlockSize(zero.parentElement as HTMLElement)).toBe(28);
    // the sections that hold something keep their headings
    expect(screen.getByRole("heading", { name: "Запуски агентов" })).toBeInTheDocument();
  });

  test("p3-review-critic-craft-2#craft-8: a check that ran once reads «1 попытка» under «Попытки», never the «—» of none", () => {
    expect(attemptsText(1)).toBe("1 попытка");
    expect(attemptsText(1)?.split(" ")).toHaveLength(2);
    mount();
    const push = within(section("Проверки юнита").querySelectorAll<HTMLElement>("[data-slot=unit-check]")[3]).getAllByRole("cell");
    expect(push[0]).toHaveTextContent("push");
    expect(push[2]).toHaveTextContent(/^1 попытка$/);
    expect(push[2].querySelector("[data-slot=dash]")).toBeNull();
  });

  test("p3-review-critic-code#code-20: «Строка лога» is one word held once — the glossary's value is the header's own", () => {
    const words = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "words.ts"), "utf8").replace(/\r\n/g, "\n");
    expect(words.match(/Строка лога/g)).toHaveLength(1);
    expect(LOG_LINE_GLOSSARY.map((e) => e.value)).toEqual([CHECK_HEAD[4]]);
  });

  test("code-2: the checks are the model's own typed `Unit.checks`, absent while it carries none", () => {
    expect(checksOf({ checks })).toBe(checks);
    expect(checksOf({ checks: [] })).toEqual([]);
    expect(checksOf({})).toBeNull();
  });

  test("the words the detail builds, against literals", () => {
    expect(closesTitle(28)).toBe("Закрывает 28 находок");
    expect(closesTitle(1)).toBe("Закрывает 1 находку");
    expect(closesTitle(3)).toBe("Закрывает 3 находки");
    expect(closesTitle(0)).toBe("Не закрывает ни одной находки");
    expect(attemptsText(31)).toBe("31 попытка");
    expect(attemptsText(2)).toBe("2 попытки");
    expect(checkOutcome(0)).toBe("прошла");
    expect(checkOutcome(127)).toBe("упала · exit 127");
    expect(checkOutcome(null)).toBe("не записано");
    expect(logName("verify.log.lines")).toBe("verify");
    expect(logName("debug.lines")).toBe("debug");
  });
});

describe("p2-assess-critic-improve#improve-8 (6): a committed unit's provenance folds behind one «Подробнее» (ux 9 → Provenance)", () => {
  const u22 = base.units.find((u) => u.id === "u22") as Unit;
  const order = () => [...(document.querySelector("[data-slot=unit-detail]") as HTMLElement).children].map((c) => ((c as HTMLElement).dataset.slot === "fold" ? "fold" : ((c as HTMLElement).querySelector("h3")?.textContent ?? (c as HTMLElement).dataset.slot)));

  test("committed: «Запуски агентов» and «Проверки юнита» behind one «Подробнее» after the facts; a click opens both under it and moves nothing above", async () => {
    expect(u22.state).toBe("committed");
    mount(u22, checks, base);
    expect(order()).toEqual(["Закрывает 1 находку", "fact-list", "fold"]);
    const triggers = screen.getAllByRole("button", { name: "Подробнее" });
    expect(triggers).toHaveLength(1);
    expect(screen.queryByRole("heading", { name: "Запуски агентов" })).toBeNull();
    const fold = document.querySelector("[data-slot=fold]") as HTMLElement;
    expect(fold).toHaveAttribute("aria-label", "Запуски агентов и проверки юнита");
    const line = triggers[0].parentElement as HTMLElement;
    await applyStylesheet();
    expect(usedBlockSize(line)).toBe(28);
    await userEvent.setup({ delay: null }).click(triggers[0]);
    // the trigger keeps its line, first in the fold; what opened follows it
    expect(fold.firstElementChild).toBe(line);
    expect(order()).toEqual(["Закрывает 1 находку", "fact-list", "fold"]);
    expect(fold).toContainElement(section("Запуски агентов"));
    expect(fold).toContainElement(section("Проверки юнита"));
    expect(triggers[0]).toHaveAttribute("aria-expanded", "true");
  });

  test("in work, not started or blocked: both stay open, no «Подробнее»", () => {
    for (const state of ["implement", "ready", "blocked"] as const) {
      const view = mount({ ...unit, state }, checks);
      expect(order(), state).toEqual(["Закрывает 28 находок", "fact-list", "Запуски агентов", "Проверки юнита"]);
      expect(screen.queryByRole("button", { name: "Подробнее" })).toBeNull();
      view.unmount();
    }
  });

  test("Strict 1: a unit committed while its detail is open keeps both open — the fold comes with the next open", () => {
    const tree = (u: Unit) => (
      <UiProvider>
        <MemoryRouter>
          <UnitDetail run={run} unit={u} checks={checks} now={NOW} />
        </MemoryRouter>
      </UiProvider>
    );
    const view = render(tree({ ...unit, state: "verify" }));
    view.rerender(tree({ ...unit, state: "committed", sha: "c0ffee24", commits: ["c0ffee24"] }));
    expect(order()).toEqual(["Закрывает 28 находок", "fact-list", "Запуски агентов", "Проверки юнита"]);
    view.unmount();
    render(tree({ ...unit, state: "committed", sha: "c0ffee24", commits: ["c0ffee24"] }));
    expect(order()).toEqual(["Закрывает 28 находок", "fact-list", "fold"]);
  });
});

describe("an open detail under a live run (rules/ui → Strict 1: a live update changes values in place, never inserts)", () => {
  const tree = (u: Unit, c: readonly UnitCheck[] | null, r: typeof run) => (
    <UiProvider>
      <MemoryRouter>
        <UnitDetail run={r} unit={u} checks={c} now={NOW} />
      </MemoryRouter>
    </UiProvider>
  );
  const labels = () => [...(document.querySelector("[data-slot=fact-list]") as HTMLElement).querySelectorAll("dt")].map((d) => d.textContent);
  const value = (label: string) => [...(document.querySelector("[data-slot=fact-list]") as HTMLElement).querySelectorAll("dt")].find((d) => d.textContent === label)?.nextElementSibling as HTMLElement;
  const strip = (title: string) => section(title).querySelector("[data-slot=held-strip]") as HTMLElement;

  test("craft-5: a blocked unit committed while its detail is open keeps the fact rows it opened with — an emptied value reads «—» in place; the next open derives the set again", () => {
    const stuck: Unit = { ...unit, state: "blocked", title: "part 24", blockedBy: ["u23"], blockedWhy: "tests stay red", tree: "C:/dev/wt/u24", sha: "c0ffee01", commits: ["c0ffee01", "c0ffee02"] };
    const opened = ["Ждёт юнитов", "Причина блокировки", "Вид работы", "Рабочая копия", "Коммиты", "Бриф юнита"];
    const view = render(tree(stuck, checks, run));
    expect(labels()).toEqual(opened);
    const committed: Unit = { ...stuck, state: "committed", blockedWhy: null, tree: null, sha: "c0ffee03", commits: ["c0ffee03"] };
    view.rerender(tree(committed, checks, run));
    expect(labels()).toEqual(opened);
    for (const l of ["Ждёт юнитов", "Причина блокировки", "Рабочая копия"]) expect(value(l).querySelector("[data-slot=dash]"), l).toHaveTextContent(/^—нет значения$/);
    // a value that holds still reads itself: the one commit the row now shows
    expect(value("Коммиты")).toHaveTextContent("c0ffee03");
    view.unmount();
    render(tree(committed, checks, run));
    expect(labels()).toEqual(["Вид работы", "Бриф юнита"]);
  });

  test("verdict cand-4: a launch, a check and a finding that arrive live wait in their section's heading line — «1 новый запуск агента · показать» — and are placed on click", async () => {
    const user = userEvent.setup({ delay: null });
    const view = render(tree(unit, checks, run));
    const launches = () => section("Запуски агентов").querySelectorAll("[data-slot=unit-launch]");
    const checkLines = () => section("Проверки юнита").querySelectorAll("[data-slot=unit-check]");
    const closesItems = () => section(/^Закрывает/).querySelectorAll("li");
    for (const t of ["Закрывает 28 находок", "Запуски агентов", "Проверки юнита"]) expect(strip(t)).toBeEmptyDOMElement();
    expect([launches().length, checkLines().length, closesItems().length]).toEqual([6, 4, 28]);

    const verifyStart = new Date(NOW - 2 * MIN).toISOString();
    const next = {
      ...run,
      running: [...run.running, { agentId: "a0c2", description: "u24 verify", agent: "fsloop-implement", name: "u24 · проверка", startedAt: verifyStart, lastAt: verifyStart }],
    };
    const more: UnitCheck[] = [...checks, { file: "verify.log.lines", n: 32, label: "e2e", exit: 0, line: null, seconds: 20, endedAt: verifyStart }];
    const grown: Unit = { ...unit, closes: [...closes.slice(0, 27), base.findings[27].id, MISSING] };
    view.rerender(tree(grown, more, next));
    // nothing moved: each list keeps the lines it had, the news stands in the heading's reserved line
    expect([launches().length, checkLines().length, closesItems().length]).toEqual([6, 4, 28]);
    expect(strip("Запуски агентов")).toHaveTextContent("1 новый запуск агента · показать");
    expect(strip("Проверки юнита")).toHaveTextContent("1 новая проверка · показать");
    expect(strip("Закрывает 29 находок")).toHaveTextContent("1 новая находка · показать");
    // a value of a held line still changes in place: the running launch's age ticks, a retried check counts again
    await user.click(within(strip("Запуски агентов")).getByRole("button", { name: /показать/ }));
    expect(launches()).toHaveLength(7);
    expect(launches()[6]).toHaveTextContent("u24 verify");
    expect(strip("Запуски агентов")).toBeEmptyDOMElement();
    await user.click(within(strip("Проверки юнита")).getByRole("button", { name: /показать/ }));
    expect([...checkLines()].map((l) => l.querySelector("[role=cell]")?.textContent)).toEqual(["type-check", "lint", "tests", "e2e", "push"]);
    await user.click(within(strip("Закрывает 29 находок")).getByRole("button", { name: /показать/ }));
    expect(closesItems()).toHaveLength(29);
    expect(closesItems()[28]).toHaveTextContent(`находка ${MISSING} не найдена`);
  });
});

// Last in the file: it writes into the fixture's run, which the cases above read as it was.
describe("improve-17 · a running launch in a unit's detail, live from the server", () => {
  test("its line stands while only its last write and the run's tokens move — the run is not read again — and a launch that starts still arrives", async () => {
    const id = runId(N);
    const projects = join(fx.root, ".claude-config", "projects", projectOf(N));
    const session = `5e55${id}-0000-4000-8000-000000000001`;
    const dated = (path: string, ms: number) => utimesSync(path, new Date(ms), new Date(ms));
    const reads = (path: string) => fx.requests.filter((p) => p === path || p.startsWith(`${path}?`)).length;
    // u30 ran once before: the running launch is its last «u30 implement» line, the one the record does not hold yet.
    const line = () => [...section("Запуски агентов").querySelectorAll("[data-slot=unit-launch]")].filter((l) => l.textContent?.includes("u30 implement")).at(-1) as HTMLElement;
    renderUnits(fx, KEY, runPath(KEY, { view: "units", unit: "u30" }));
    await waitFor(() => expect(line()).toHaveTextContent("работает"), { timeout: 4000 });
    const shown = line().textContent;
    const [runs, lists] = [reads("/api/run"), reads("/api/runs")];

    // A Verify streams into the unit's folder — the run is read again — while the launch writes and the orchestrator answers.
    const log = join(fx.dirOf(N), "units", "u30", "verify.log.9");
    mkdirSync(dirname(log), { recursive: true });
    writeFileSync(log, "ok\n");
    for (let p = log; p !== fx.dirOf(N); p = dirname(p)) dated(p, NOW - 20_000);
    appendFileSync(join(projects, `${session}.jsonl`), JSON.stringify({ type: "assistant", message: { id: "m-17", role: "assistant", content: [], usage: { input_tokens: 10, output_tokens: 20, cache_creation_input_tokens: 0, cache_read_input_tokens: 300 } } }) + "\n");
    dated(join(projects, `${session}.jsonl`), NOW - 10_000);
    appendFileSync(join(projects, session, "subagents", `agent-a${id}u30.jsonl`), '{"type":"progress"}\n');
    dated(join(projects, session, "subagents", `agent-a${id}u30.jsonl`), NOW - 5_000);
    await act(async () => {
      for (let k = 0; k < 3; k++) await fx.app.pulse();
    });
    // The card moved and was read; the run was not.
    await waitFor(() => expect(reads("/api/runs")).toBeGreaterThan(lists));
    expect(reads("/api/run")).toBe(runs);
    expect(line().textContent).toBe(shown);

    // A launch of the unit starts: the run is read again and the launch waits in the section's heading line.
    writeRunningLaunch(join(fx.root, ".claude-config", "projects"), projectOf(N), session, fx.dirOf(N), { agentId: `a${id}u30v`, description: "u30 verify", agent: "fsloop-implement", startedAt: NOW - 2 * MIN, lastAt: NOW - 2 * MIN });
    await act(async () => {
      for (let k = 0; k < 2; k++) await fx.app.pulse();
    });
    await waitFor(() => expect(section("Запуски агентов").querySelector("[data-slot=held-strip]")).toHaveTextContent("1 новый запуск агента · показать"), { timeout: 4000 });
    expect(reads("/api/run")).toBe(runs + 1);
  });
});
