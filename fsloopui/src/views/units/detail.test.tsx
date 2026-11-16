// @vitest-environment jsdom
// Done-criterion 2: what a unit's row expands into, at the limits of surfaces/units.md → RANGES — a 287-character
// title, 28 closes, 6 launches, 31 checks — with every absent part in its place: «юнит u7 не найден», «находка <id>
// не найдена», «не записано», «Бриф units/u3/brief.md не прочитан: …». Strict 1: every list line is one fixed row.
import "../../ui/test-setup.ts";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterAll, describe, expect, test } from "vitest";
import type { Unit } from "../../../shared/model.ts";
import { UiProvider } from "@/ui";
import { runPath } from "../../app/routes.ts";
import { UnitDetail } from "./detail.tsx";
import { checkGroups, launchRows, type UnitCheck } from "./query.ts";
import { fixtureApp, keyOf, loadedRun, MIN, NOW } from "./testing.tsx";
import { attemptsText, checkOutcome, closesTitle, logName } from "./words.ts";

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
};
const runningStart = new Date(NOW - 12 * MIN).toISOString();
const run = {
  ...base,
  units: base.units.map((u) => (u.id === "u24" ? unit : u)),
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

const mount = (u: Unit = unit, c: readonly UnitCheck[] | null = checks, r = run) =>
  render(
    <UiProvider>
      <MemoryRouter>
        <UnitDetail run={r} unit={u} checks={c} now={NOW} />
      </MemoryRouter>
    </UiProvider>,
  );

const section = (title: string | RegExp) => screen.getByRole("heading", { name: title }).closest("section") as HTMLElement;

describe("a unit's detail at the production limits", () => {
  test("the fact list: the whole 287-character title, the kind not recorded, each unit it waits for with its state, the failed brief", () => {
    expect(TITLE).toHaveLength(287);
    mount();
    const facts = document.querySelector("[data-slot=fact-list]") as HTMLElement;
    expect([...facts.querySelectorAll("dt")].map((d) => d.textContent)).toEqual(["Что делает", "Вид работы", "Ждёт юнитов", "Причина блокировки", "Рабочая копия", "Коммиты", "Бриф юнита"]);
    const value = (label: string) => [...facts.querySelectorAll("dt")].find((d) => d.textContent === label)?.nextElementSibling as HTMLElement;
    expect(value("Что делает").textContent).toBe(TITLE);
    expect(value("Вид работы")).toHaveTextContent("не записано");
    expect(within(value("Ждёт юнитов")).getByRole("link", { name: "u23" })).toHaveAttribute("href", runPath(KEY, { view: "units", unit: "u23" }));
    expect(value("Ждёт юнитов")).toHaveTextContent("u23заблокирован");
    expect(value("Ждёт юнитов")).toHaveTextContent("юнит u77 не найден");
    expect(value("Причина блокировки")).toHaveTextContent("—");
    expect(value("Рабочая копия")).toHaveTextContent("—");
    expect(value("Бриф юнита")).toHaveTextContent("Бриф units/u3/brief.md не прочитан: файла нет");
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
    expect(lines[0]).toHaveTextContent("завершён · 9 мин");
    const tokens = [...lines[0].querySelectorAll("span")].find((s) => s.textContent?.endsWith("токенов")) as HTMLElement;
    // the fixture's spend: input 9xx, output 40 000, cache write 250 000, cache read 3 100 000 — about 3,39 million
    expect(tokens.textContent).toBe("3,4 млн токенов");
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
      ["land", ["push прошла"]],
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
    mount({ ...unit, closes: [], launches: [], blockedBy: [] }, null, { ...run, running: [], errors: base.errors });
    expect(screen.getByRole("heading", { name: "Не закрывает ни одной находки" })).toBeInTheDocument();
    expect(section("Запуски агентов")).toHaveTextContent("—");
    expect(section("Проверки юнита")).toHaveTextContent("не записано");
    const facts = document.querySelector("[data-slot=fact-list]") as HTMLElement;
    expect(facts).toHaveTextContent("units/u3/brief.md");
  });

  test("the detail is a height-capped region that scrolls inside (Layout 6; Strict 1)", () => {
    mount();
    const article = document.querySelector("[data-slot=unit-detail]") as HTMLElement;
    expect(article).toHaveClass("max-h-112", "overflow-y-auto", "[scrollbar-gutter:stable]");
  });

  test("the words the detail builds, against literals", () => {
    expect(closesTitle(28)).toBe("Закрывает 28 находок");
    expect(closesTitle(1)).toBe("Закрывает 1 находку");
    expect(closesTitle(3)).toBe("Закрывает 3 находки");
    expect(closesTitle(0)).toBe("Не закрывает ни одной находки");
    expect(attemptsText(1)).toBeNull();
    expect(attemptsText(31)).toBe("31 попытка");
    expect(attemptsText(2)).toBe("2 попытки");
    expect(checkOutcome(0)).toBe("прошла");
    expect(checkOutcome(127)).toBe("упала · exit 127");
    expect(checkOutcome(null)).toBe("не записано");
    expect(logName("verify.log.lines")).toBe("verify");
    expect(logName("debug.lines")).toBe("debug");
  });
});
