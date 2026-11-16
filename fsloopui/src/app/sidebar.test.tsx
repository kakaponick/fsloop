// @vitest-environment jsdom
import "../ui/test-setup.ts";
import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";
import { glossaryLines, writePref } from "../ui/index.ts";
import {
  activityLine,
  cardLabel,
  closedLine,
  foldTitle,
  launchesLine,
  LIVENESS_WIDEST,
  livenessShown,
  miniDetail,
  miniTitle,
  runMatches,
  runningCount,
  RUNS_GLOSSARY,
  SEARCH_PLACEHOLDER,
  settingsLine,
  sidebarHead,
  stageCompact,
  stageLine,
  unitsLine,
  waitCauses,
  waitingCount,
  WAITS_GLOSSARY,
  waitsLine,
} from "./words.ts";
import { nextWaiting } from "./held.ts";
import { fixtureApp, json, keyOf, MIN, NOW, renderShell, type FixtureApp } from "./testing.tsx";
import { applyStylesheet, contentWidth, flexRow, innerWidth, leftEdge, textWidth, usedBlockSize } from "./layout-testing.ts";

const iso = (ms: number) => new Date(ms).toISOString();
const words = (s: string) => s.split(" ").length;

describe("the card's words, built once", () => {
  test("the running count agrees its verb", () => {
    expect(runningCount(3)).toBe("3 прогона идут");
    expect(runningCount(1)).toBe("1 прогон идёт");
    expect(runningCount(21)).toBe("21 прогон идёт");
    expect(runningCount(0)).toBe("Сейчас ни один прогон не идёт — новый появится здесь сам");
  });

  test("craft-22 · a silent run is not counted as going", () => {
    const mixed = runningCount(2, 1);
    expect(mixed).toBe("2 прогона идут · 1 молчит");
    expect(words(mixed)).toBe(6);
    expect(runningCount(1, 3)).toBe("1 прогон идёт · 3 молчат");
    expect(runningCount(0, 2)).toBe("2 прогона молчат");
    expect(runningCount(0, 1)).toBe("1 прогон молчит");
  });

  test("improve-6 · the head: how many go, then how many wait on you; alone, the waiting part names its runs", () => {
    const head = sidebarHead(3, 0, 2);
    expect(head).toBe("3 прогона идут · 2 ждут вас");
    expect(words(head)).toBe(7);
    const widest = sidebarHead(2, 1, 1);
    expect(widest).toBe("2 прогона идут · 1 молчит · 1 ждёт вас");
    expect(words(widest)).toBe(10);
    expect(sidebarHead(0, 0, 1)).toBe("1 прогон ждёт вас");
    expect(sidebarHead(3, 0, 0)).toBe("3 прогона идут");
    expect(sidebarHead(0, 0, 0)).toBe("");
    expect(waitingCount(21)).toBe("21 ждёт вас");
    expect(waitingCount(5, { alone: true })).toBe("5 прогонов ждут вас");
  });

  test("improve-6 · the head's waiting part opens the next waiting run after the current one, in the sidebar's order; none when the current run is the only one", () => {
    const order = ["a", "b", "c", "d", "e"];
    const waiting = new Set(["b", "d"]);
    expect(nextWaiting(order, waiting, "a")).toBe("b");
    expect(nextWaiting(order, waiting, "b")).toBe("d");
    expect(nextWaiting(order, waiting, "d")).toBe("b");
    expect(nextWaiting(order, waiting, "e")).toBe("b");
    expect(nextWaiting(order, waiting, null)).toBe("b");
    expect(nextWaiting(order, new Set(["b"]), "b")).toBeNull();
    expect(nextWaiting(order, new Set(), "a")).toBeNull();
  });

  test("the settings: mode, passes, units at once, models, the mirror", () => {
    expect(settingsLine({ mode: "worktree", N: 2, K: 3, models: ["claude-opus-5-5", "claude-sonnet-5-5"], mirror: true })).toBe("worktree · до 2 проходов · до 3 юнитов сразу · claude-opus-5-5 · claude-sonnet-5-5 · зеркало .spike");
    expect(settingsLine({ mode: "inline", N: null, K: 1, models: [], mirror: false })).toBe("inline · до 1 юнита сразу");
  });

  test("the stage: its word, the pass of N, since when in МСК, the step last; craft-17 · the card's compact form", () => {
    const facts = { recorded: true, closed: false, stage: "p2-assess", stageLabel: "проход 2 · приёмка", N: 3, step: "u23 ждёт решения", since: "2026-11-15T18:41:00Z" };
    const s = stageLine(facts, NOW);
    expect(s).toBe("приёмка · проход 2 из 3 · с 15.11 21:41 МСК · u23 ждёт решения");
    expect(words(s)).toBe(15);
    const c = stageCompact(facts, NOW);
    expect(c).toBe("приёмка · проход 2 из 3 · на этапе 22 ч · u23 ждёт решения");
    expect(words(c)).toBe(15);
    expect(stageCompact({ ...facts, step: null, since: iso(NOW - 3 * MIN) }, NOW)).toBe("приёмка · проход 2 из 3 · на этапе 3 мин");
    expect(stageLine({ recorded: true, closed: false, stage: "p1-review", stageLabel: "проход 1 · ревью", N: null, step: null, since: "2026-11-16T12:38:00Z" }, NOW)).toBe("ревью · проход 1 · с 15:38 МСК");
    expect(stageLine({ recorded: true, closed: true, stage: null, stageLabel: "прогон закрыт", N: 2, step: null, since: null }, NOW)).toBe("прогон закрыт");
  });

  test("the units: committed of all, in work; the noun after «из» in the genitive", () => {
    const u = unitsLine({ committed: 2, implement: 2, verify: 1, ready: 15 }, 20);
    expect(u).toBe("2 из 20 юнитов закоммичено · 3 в работе");
    expect(words(u)).toBe(9);
    expect(unitsLine({ committed: 30, implement: 1, verify: 1, blocked: 1, ready: 5, drafted: 4 }, 42)).toBe("30 из 42 юнитов закоммичено · 2 в работе");
    expect(unitsLine({ committed: 1 }, 1)).toBe("1 из 1 юнита закоммичен");
    expect(unitsLine({ implement: 1 }, 21)).toBe("0 из 21 юнита закоммичено · 1 в работе");
    expect(unitsLine({}, 0)).toBe("юнитов ещё нет");
  });

  test("the activity: how long it goes, every agent launch; craft-17 · the card's compact form; improve-11 (1) · no commit count — the units line says what is committed, so «0 коммитов» never stands beside committed units", () => {
    // 33 recorded and 1 running: the model's launchCount.
    const facts = { closed: false, startedAt: iso(NOW - 125 * MIN), launchCount: 34 };
    const a = activityLine(facts, NOW);
    expect(a).toBe("идёт 2 ч 05 мин · 34 запуска агента");
    expect(words(a)).toBe(9);
    const c = activityLine(facts, NOW, { compact: true });
    expect(c).toBe("идёт 2 ч · 34 запуска");
    expect(words(c)).toBe(6);
    expect(activityLine({ closed: true, startedAt: iso(NOW - 125 * MIN), launchCount: 1 }, NOW)).toBe("1 запуск агента");
    expect(launchesLine(98, 1)).toBe("98 запусков агента · 1 работает");
  });

  test("craft-3 · what waits, one cause to a row; craft-4 · liveness while the connection is lost", () => {
    const gate = { at: "2026-11-16T16:21:00Z", problems: ["p2-assess-critic-code#code-2 has no decision row", "p2-assess-critic-craft#craft-1 has no decision row"] };
    expect(waitCauses({ redGate: gate, blocked: [{ id: "u23", why: "waits for the user" }, { id: "u7", why: null }] })).toEqual([
      { kind: "gate", term: "красный гейт", text: "p2-assess-critic-code#code-2 has no decision row\np2-assess-critic-craft#craft-1 has no decision row" },
      { kind: "blocked", term: "заблокирован", text: "u23 — waits for the user" },
      { kind: "blocked", term: "заблокирован", text: "u7" },
    ]);
    expect(waitCauses({ redGate: null, blocked: [] })).toEqual([]);
    expect(glossaryLines(WAITS_GLOSSARY)).toEqual(["красный гейт — проверка этапа нашла нарушения, и прогон не идёт дальше", "заблокирован — Юнит остановлен: прогон ждёт решения или другого юнита."]);
    const card = { lastWriteAt: iso(NOW - 2 * MIN), closed: false };
    expect(livenessShown(card, NOW, false)).toMatchObject({ state: "working", label: "работает", tone: "neutral", lost: false });
    expect(livenessShown({ ...card, lastWriteAt: iso(NOW - 40 * MIN) }, NOW, true)).toMatchObject({ state: "silent", label: "нет связи", tone: "neutral", lost: true });
    expect(livenessShown({ ...card, closed: true }, NOW, true)).toMatchObject({ label: "закрыт", lost: false });
    expect(LIVENESS_WIDEST).toBe("молчит · 59 мин");
    expect(cardLabel({ project: "admin", id: "a5b5ec85" }, "работает", true)).toBe("admin · a5b5ec85 · работает · новое");
  });

  test("what waits on the operator: the red gate and a blocked unit in one line", () => {
    const gate = { at: "2026-11-16T16:21:00Z", problems: ["p2-assess-critic-code#code-2 has no decision row"] };
    const both = waitsLine({ redGate: gate, blocked: [{ id: "u23", why: "waits for the user — the empty state's wording (j140)" }] });
    expect(both).toEqual({ tone: "warning", text: "красный гейт: p2-assess-critic-code#code-2 has no decision row · заблокирован u23 — waits for the user — the empty state's wording (j140)" });
    expect(waitsLine({ redGate: { at: gate.at, problems: ["a", "b", "c"] }, blocked: [] }).text).toBe("красный гейт: a и ещё 2");
    expect(waitsLine({ redGate: null, blocked: [{ id: "u7", why: null }, { id: "u9", why: "x" }] }).text).toBe("2 юнита заблокированы: u7, u9");
    expect(waitsLine({ redGate: null, blocked: [] })).toEqual({ tone: "neutral", text: "ничего — прогон идёт сам" });
  });

  test("craft-4 · a mini row's detail: what waits first, «нет связи» while lost, no clock time — an age already says when; the time in its title, «новое» too; a fold's title", () => {
    const calm = { redGate: null, blocked: [] };
    expect(foldTitle("Закрытые", 53)).toBe("Закрытые · 53");
    const closed = { ...calm, project: "shop", id: "1a2b3c4d", goal: "Run 0: bring the «a» and «b» pages to the law. Keep every fact.", recorded: true, closed: true, outcome: { pushed: true, goalMet: true, held: [] }, updatedAt: "2026-11-15T20:40:00Z", lastWriteAt: null };
    // p2-verdict craft-2 · a closed run's first line is its goal's outcome alone; the push moves to the second line.
    expect(miniDetail(closed, NOW)).toEqual({ tone: "success", fact: "цель достигнута", text: "цель достигнута" });
    expect(miniDetail({ ...closed, outcome: { pushed: false, goalMet: false, held: [] } }, NOW)).toEqual({ tone: "neutral", fact: "цель не достигнута", text: "цель не достигнута" });
    expect(miniDetail({ ...closed, outcome: { pushed: false, goalMet: null, held: [] } }, NOW)).toEqual({ tone: "neutral", fact: "коммиты не отправлены", text: "коммиты не отправлены" });
    expect(miniDetail({ ...closed, outcome: null }, NOW)).toEqual({ tone: "neutral", fact: "не записано", text: "не записано" });
    const silent = { ...calm, project: "shop", id: "37d5a31e", goal: null, recorded: true, closed: false, outcome: null, updatedAt: null, lastWriteAt: "2026-11-16T09:41:00Z" };
    expect(miniDetail(silent, NOW)).toEqual({ tone: "warning", fact: "молчит · 7 ч", text: "молчит · 7 ч" });
    expect(miniDetail(silent, NOW, { lost: true })).toEqual({ tone: "neutral", fact: "нет связи", text: "нет связи" });
    // p2-verdict craft-2 · «state · age · cause», the cause last, so a narrow row cuts only it (rules/ui → Conventions 1);
    // p2-verdict-critic-craft-verdict-4#craft-1 · the liveness keeps its own tone, the wait carries the amber of its own.
    const waits = miniDetail({ ...silent, lastWriteAt: iso(NOW - MIN), redGate: { at: "2026-11-16T16:21:00Z", problems: ["x"] }, blocked: [{ id: "u23", why: "y" }] }, NOW);
    expect(waits).toEqual({ tone: "neutral", fact: "работает", waits: "красный гейт · заблокирован u23", text: "работает · красный гейт · заблокирован u23" });
    expect(words(waits.text)).toBe(7);
    expect(miniDetail({ ...silent, redGate: { at: "2026-11-16T16:21:00Z", problems: ["x"] } }, NOW)).toEqual({ tone: "warning", fact: "молчит · 7 ч", waits: "красный гейт", text: "молчит · 7 ч · красный гейт" });
    expect(miniDetail({ ...calm, recorded: false, closed: null, outcome: null, updatedAt: null, lastWriteAt: "2026-11-13T16:41:00Z" }, NOW)).toEqual({ tone: "neutral", fact: "не записано", text: "не записано: в папке нет run.json" });
    // The title keeps the whole: the time the face drops, and «новое», which has no column of its own.
    const title = miniTitle(silent, "молчит · 7 ч", NOW, true);
    expect(title).toBe("shop · 37d5a31e · молчит · 7 ч · последняя запись 12:41 МСК · новое");
    expect(words(title)).toBe(15);
    expect(miniTitle(closed, "цель достигнута · коммиты отправлены", NOW, false)).toBe("shop · 1a2b3c4d · цель достигнута · коммиты отправлены · закрыт 15.11 23:40 МСК");
    // p1-review cand-3 · a closed run's row tells itself apart by its date and its goal's first words, on its second
    // line; p2-verdict craft-2 · unpushed commits open it (a pushed run's push is in the title), the moment compact
    // (rules/ui → Conventions 10), the goal last; p2-verdict-critic-craft-verdict-4#craft-2 · no «закрыт», which the
    // fold «Закрытые» already says.
    const line = closedLine({ ...closed, outcome: { pushed: false, goalMet: false, held: [] } }, NOW);
    expect(line).toBe("коммиты не отправлены · 20 ч назад · Run 0: bring the «a» and «b» pages to the law. Keep every fact.");
    expect(words(line)).toBe(22);
    expect(closedLine(closed, NOW)).toBe("20 ч назад · Run 0: bring the «a» and «b» pages to the law. Keep every fact.");
    expect(closedLine({ ...closed, outcome: { pushed: false, goalMet: false, held: [] }, goal: null }, NOW)).toBe("коммиты не отправлены · 20 ч назад");
    // A run whose goal was never judged reads its push on the first line: the second does not repeat it.
    expect(closedLine({ ...closed, outcome: { pushed: true, goalMet: null, held: [] } }, NOW)).toBe("20 ч назад · Run 0: bring the «a» and «b» pages to the law. Keep every fact.");
    expect(closedLine({ ...closed, outcome: null, goal: null }, NOW)).toBe("20 ч назад");
  });

  test("p1-review cand-3 · the sidebar's search: every word in the project, the id or the goal", () => {
    const card = { project: "admin", id: "a5b5ec85", goal: "Bring every section to the law" };
    expect(SEARCH_PLACEHOLDER).toBe("Проект, id, цель");
    expect(runMatches(card, "")).toBe(true);
    expect(runMatches(card, "  ")).toBe(true);
    expect(runMatches(card, "ADMIN")).toBe(true);
    expect(runMatches(card, "a5b5")).toBe(true);
    expect(runMatches(card, "admin section")).toBe(true);
    expect(runMatches(card, "admin shop")).toBe(false);
    expect(runMatches({ ...card, goal: null }, "section")).toBe(false);
  });
});

describe("the sidebar over the fixture root of 63", () => {
  let fx: FixtureApp;
  beforeAll(() => {
    fx = fixtureApp();
  });
  afterAll(() => fx.close());
  afterEach(() => fx.answer(null));

  const sidebar = () => screen.getByRole("complementary", { name: "Прогоны" });
  const cards = () => [...sidebar().querySelectorAll<HTMLAnchorElement>("[data-slot=run-card]")];
  const ready = async () => within(sidebar()).findByText("3 прогона идут");
  /** Every run under `project`; every open run held by a red gate and two blocked units; every closed run at its widest
   * outcome: goal not met, commits not pushed. `goals` gets each run's goal by its row's address. */
  const answerWidest = (project: string, goals = new Map<string, string | null>()) =>
    fx.answer((path) =>
      path === "/api/runs"
        ? fx.app.handle(new Request(`http://127.0.0.1${path}`)).then(async (res) => {
            const body = (await res.json()) as { list: Record<string, unknown>[] };
            body.list = body.list.map((c) => {
              goals.set(`/r/${String(c.key)}`, (c.goal as string | null) ?? null);
              return {
                ...c,
                project,
                ...(c.closed === false ? { redGate: { at: "2026-11-16T16:21:00Z", problems: ["p2-assess-critic-code#code-2 has no decision row"] }, blocked: [{ id: "u23", why: null }, { id: "u7", why: null }] } : {}),
                ...(c.closed === true ? { outcome: { pushed: false, goalMet: false, held: [] } } : {}),
              };
            });
            return json(200, body);
          })
        : null,
    );

  test("first load: «Загрузка…» with a spinner in the list's region, already at its size", async () => {
    let release!: () => void;
    const held = new Promise<void>((done) => (release = done));
    fx.answer((path) => (path === "/api/runs" ? held.then(() => fx.app.handle(new Request(`http://127.0.0.1${path}`))) : null));
    renderShell(fx.transport, { path: `/r/${keyOf(0)}` });
    const list = sidebar().querySelector("[data-slot=sidebar-list]") as HTMLElement;
    expect(list).toHaveClass("flex-1", "min-h-0");
    expect(within(list).getByRole("status")).toHaveTextContent("Загрузка…");
    // The search's line is there before the list: the list lands under it, nothing moves.
    expect(within(sidebar()).getByRole("searchbox")).toBeInTheDocument();
    fx.answer(null);
    await act(async () => release());
    await ready();
  });

  test("the head: the product, «Прогоны» and how many go; the running group as full cards, newest start first", async () => {
    renderShell(fx.transport, { path: `/r/${keyOf(0)}` });
    await ready();
    expect(within(sidebar()).getByText("fsloopUI")).toBeInTheDocument();
    expect(within(sidebar()).getByText("Прогоны")).toBeInTheDocument();
    expect(cards().map((c) => c.getAttribute("href"))).toEqual(["/r/fsloop/077e72d5", "/r/bots/42d34077", "/r/admin/a5b5ec85"]);
  });

  test("craft-21 · «Прогоны» explains the words the cards show: the liveness, «новое», what waits; improve-6 (5) · «новое» names the mini row's edge bar too", async () => {
    renderShell(fx.transport, { path: `/r/${keyOf(0)}` });
    await ready();
    const term = within(sidebar()).getByRole("button", { name: "Прогоны" });
    expect(term).toHaveAttribute("data-slot", "glossary-term");
    expect(term.closest("[data-slot=sidebar-list]")).toBeNull();
    expect(glossaryLines(RUNS_GLOSSARY)).toEqual([
      "работает — Прогон или его агенты писали файлы меньше 5 минут назад.",
      "тихо — Прогон не писал файлы 5–30 минут: агент думает или ждёт долгую команду.",
      "молчит — Нет записей больше 30 минут: прогон мог встать — проверьте его сессию.",
      // improve-6 (5) · «новое» is also the bar at a mini row's left edge: the glossary names both.
      "новое, полоса у левого края — Прогон изменился с тех пор, как вы его открывали",
      // improve-6 (1) · the head's waiting part, closed by the cold read: what «ждёт вас» means
      "ждёт вас — Прогону нужно ваше решение: красный гейт или заблокированный юнит",
      "красный гейт — проверка этапа нашла нарушения, и прогон не идёт дальше",
      "заблокирован — Юнит остановлен: прогон ждёт решения или другого юнита.",
    ]);
  });

  test("improve-6 (1), design-16 · the head reads «3 прогона идут · 2 ждут вас» on its reserved line; «2 ждут вас» links in CountLink's look to the next waiting run after the current one — admin, then the silent trigger run", async () => {
    const user = userEvent.setup();
    const { probe } = renderShell(fx.transport, { path: `/r/${keyOf(0)}` });
    await ready();
    const head = sidebar().querySelector("[data-slot=running-count]") as HTMLElement;
    expect(head.textContent).toBe("3 прогона идут · 2 ждут вас");
    const link = within(head).getByRole("link", { name: "2 ждут вас" });
    expect(link).toHaveAttribute("data-slot", "count-link");
    expect(link.querySelector("[data-slot=dot]")).toHaveAttribute("data-tone", "warning");
    expect(link).toHaveAttribute("href", "/r/admin/a5b5ec85");
    await user.click(link);
    expect(probe.location?.pathname).toBe("/r/admin/a5b5ec85");
    // The silent run that waits too (fixtures/make.ts, «silent-waits»): from admin, the next one.
    expect(keyOf(50)).toBe("trigger/08989893");
    expect(within(head).getByRole("link", { name: "2 ждут вас" })).toHaveAttribute("href", `/r/${keyOf(50)}`);
    // Strict 1: the line is one reserved line from the first paint; the waiting part keeps its words, the count before
    // it gives way.
    await applyStylesheet();
    // one line of the head's 12 px type at its 1.4 line height
    expect(usedBlockSize(head.parentElement as HTMLElement)).toBe(16.8);
    expect(getComputedStyle(head).flexWrap).toBe("nowrap");
    expect(getComputedStyle(within(head).getByRole("link")).flexShrink).toBe("0");
    expect(getComputedStyle(within(head).getByText("3 прогона идут")).textOverflow).toBe("ellipsis");
  });

  test("design-16 · when the only waiting run is the one open, the waiting part is plain text: no link to the page the user is on", async () => {
    fx.answer((path) =>
      path === "/api/runs"
        ? fx.app.handle(new Request(`http://127.0.0.1${path}`)).then(async (res) => {
            const body = (await res.json()) as { list: Record<string, unknown>[] };
            body.list = body.list.map((c) => (c.key === keyOf(50) ? { ...c, redGate: null, blocked: [] } : c));
            return json(200, body);
          })
        : null,
    );
    renderShell(fx.transport, { path: "/r/admin/a5b5ec85" });
    await ready();
    const head = sidebar().querySelector("[data-slot=running-count]") as HTMLElement;
    expect(head.textContent).toBe("3 прогона идут · 1 ждёт вас");
    expect(within(head).queryByRole("link")).toBeNull();
  });

  test("improve-6 (2) · at 1440 a long-silent run's mini row takes a second reserved line, its goal's first words in muted small type, so two runs of one project tell apart; in the narrow band it stays one 32 px line", async () => {
    const silentRows = () => [...sidebar().querySelectorAll<HTMLElement>("[data-slot=sidebar-fold][data-group=silent] [data-slot=mini-row]")];
    const first = renderShell(fx.transport, { path: `/r/${keyOf(0)}` });
    await ready();
    const rows = silentRows();
    expect(rows).toHaveLength(4);
    await applyStylesheet();
    const goals = rows.map((row) => {
      const goal = row.querySelector("[data-slot=mini-goal]") as HTMLElement;
      expect(goal, row.title).not.toBeNull();
      expect(usedBlockSize(row), row.title).toBe(48);
      expect(getComputedStyle(goal).fontSize).toBe("12px");
      expect(getComputedStyle(goal).textOverflow).toBe("ellipsis");
      // the goal is the muted second part: never part of the row's name
      expect(row.getAttribute("aria-label")).not.toContain(goal.textContent);
      return goal.textContent ?? "";
    });
    for (const goal of goals) expect(goal).toMatch(/^(Run \d+: |Set up )/);
    expect(new Set(goals).size).toBe(rows.length);
    first.unmount();
    renderShell(fx.transport, { path: `/r/${keyOf(0)}`, wide: false });
    await ready();
    await applyStylesheet();
    expect(silentRows()).toHaveLength(4);
    for (const row of silentRows()) {
      expect(row.querySelector("[data-slot=mini-goal]")).toBeNull();
      expect(usedBlockSize(row)).toBe(32);
    }
  });

  test("improve-6 (2) · at the 316 px sidebar a long-silent row keeps at least its goal's first word whole on its second line", async () => {
    const goals = new Map<string, string | null>();
    answerWidest("db.ren.net", goals);
    renderShell(fx.transport, { path: `/r/${keyOf(0)}` });
    await ready();
    await applyStylesheet();
    const rows = [...sidebar().querySelectorAll<HTMLElement>("[data-slot=sidebar-fold][data-group=silent] [data-slot=mini-row]")];
    expect(rows).toHaveLength(4);
    for (const row of rows) {
      const second = row.querySelector("[data-slot=mini-goal]") as HTMLElement;
      const goal = goals.get(row.getAttribute("href") ?? "");
      expect(goal, `${row.title}: no goal`).toBeTruthy();
      expect(second.textContent).toBe(goal);
      const first = (goal as string).trim().split(/\s+/)[0];
      const size = Number.parseFloat(getComputedStyle(second).fontSize);
      expect(textWidth(first, { size }), `${row.title}: the goal's first word «${first}» is cut`).toBeLessThanOrEqual(innerWidth(second, sidebar(), 316));
    }
  });

  test("improve-6 (3) · the current mini row wears the full card's 1 px ink border — the Item's reserved border turning ink, so nothing moves", async () => {
    const user = userEvent.setup();
    const first = renderShell(fx.transport, { path: "/r/admin/a5b5ec85" });
    await ready();
    await applyStylesheet();
    const card = cards()[2];
    expect(card).toHaveAttribute("aria-current", "page");
    const ink = getComputedStyle(card).borderTopColor;
    expect(getComputedStyle(cards()[0]).borderTopColor).not.toBe(ink);
    first.unmount();
    renderShell(fx.transport, { path: `/r/${keyOf(0)}` });
    await ready();
    await user.click(within(sidebar()).getByRole("button", { name: "Закрытые · 53" }));
    await applyStylesheet();
    const rows = [...sidebar().querySelectorAll<HTMLElement>("[data-slot=mini-row]")];
    const current = rows.find((r) => r.getAttribute("aria-current") === "page") as HTMLElement;
    expect(current).toHaveAttribute("href", `/r/${keyOf(0)}`);
    expect(getComputedStyle(current).borderTopColor).toBe(ink);
    for (const row of [current, rows[0]]) expect(getComputedStyle(row).borderTopWidth).toBe("1px");
    expect(getComputedStyle(rows[0]).borderTopColor).not.toBe(ink);
  });

  test("improve-6 (4) · the search's left edge lines up with the cards', and the head's top padding is the run header's", async () => {
    renderShell(fx.transport, { path: "/r/admin/a5b5ec85" });
    await ready();
    await screen.findByRole("heading", { level: 1 });
    await applyStylesheet();
    const search = sidebar().querySelector("[data-slot=table-search]") as HTMLElement;
    expect(leftEdge(search, sidebar())).toBe(leftEdge(cards()[0], sidebar()));
    const head = sidebar().querySelector("[data-slot=sidebar-head]") as HTMLElement;
    const header = document.querySelector("[data-slot=run-header]") as HTMLElement;
    expect(getComputedStyle(head).paddingTop).toBe(getComputedStyle(header).paddingTop);
  });

  test("craft-35 · a card is named «project · id · liveness», the rest its description; the page's h1 is the first heading", async () => {
    renderShell(fx.transport, { path: `/r/${keyOf(0)}` });
    await ready();
    const card = cards()[2];
    expect(card).toHaveAccessibleName("admin · a5b5ec85 · работает");
    expect(card).toHaveAccessibleDescription(/^красный гейт · заблокирован u23Настройки.*Состояние/);
    expect(within(sidebar()).queryByRole("heading")).toBeNull();
    await screen.findByRole("heading", { level: 1 });
    expect(screen.getAllByRole("heading")[0]).toHaveProperty("tagName", "H1");
  });

  test("a card: project · id · liveness, what waits or the goal in two reserved lines, «Настройки», «Состояние» (craft-3, craft-17, craft-18; cand-5 · what waits in a few words; craft-11 · « ·» with the part before it)", async () => {
    renderShell(fx.transport, { path: `/r/${keyOf(0)}` });
    await ready();
    const card = cards()[2];
    const slot = (name: string, of: HTMLElement = card) => of.querySelector(`[data-slot=${name}]`) as HTMLElement;
    expect(slot("card-project")).toHaveTextContent("admin");
    expect(slot("card-id")).toHaveTextContent("a5b5ec85");
    // craft-18 · the liveness sits in a box as wide as its widest form; «новое» has its slot whether shown or not.
    const liveness = slot("card-liveness");
    expect(slot("status-dot", liveness)).toHaveTextContent("работает");
    // The sizers draw their words as generated content: they size the box and are no text a reader meets.
    expect([...liveness.querySelectorAll("[data-slot=liveness-sizer]")].map((s) => [s.getAttribute("data-text"), s.textContent, s.classList.contains("invisible")])).toEqual([
      ["молчит · 59 мин", "", true],
      ["папки больше нет", "", true],
    ]);
    expect(within(liveness).getAllByText(/./)).toHaveLength(1);
    expect(liveness).toHaveClass("grid", "shrink-0");
    for (const c of cards()) expect(slot("new-mark", c)).toHaveClass("invisible");
    // craft-3 · what waits sits under the head in two reserved lines, the goal's place; a calm card shows its goal there.
    // cand-5 · it names every cause in a few words, so none is cut; the whole of each is in the title and on the page.
    const waits = slot("card-waits");
    expect(waits).toHaveClass("h-[2lh]");
    expect(waits.querySelector(".line-clamp-2")).toHaveTextContent(/^красный гейт · заблокирован u23$/);
    expect(waits).toHaveAttribute("title", "красный гейт: p2-assess-critic-code#code-2 has no decision row · заблокирован u23 — waits for the user — the empty state's wording (j140)");
    expect(waits.querySelector("[data-slot=dot]")).toHaveAttribute("data-tone", "warning");
    expect(slot("card-goal")).toBeNull();
    expect(waits.compareDocumentPosition(slot("card-settings")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const calm = slot("card-goal", cards()[0]);
    expect(calm).toHaveClass("h-[2lh]");
    expect(calm.querySelector(".line-clamp-2")?.textContent?.startsWith("Run 24: ")).toBe(true);
    expect(slot("card-waits", cards()[0])).toBeNull();
    // craft-17 · ordinary values in compact forms, the whole in the title; an identifier never breaks inside.
    expect(within(card).getByText("Настройки")).toBeInTheDocument();
    expect(slot("card-settings")).toHaveTextContent("worktree · до 2 проходов · до 3 юнитов сразу · claude-opus-5-5");
    // craft-11 · each « ·» stays with the part before it, inside its unbreakable span: no line opens on a separator.
    const parts = [...slot("card-settings").querySelectorAll("[data-slot=setting]")];
    expect(parts.map((p) => p.textContent)).toEqual(["worktree ·", "до 2 проходов ·", "до 3 юнитов сразу ·", "claude-opus-5-5"]);
    for (const part of parts) expect(part).toHaveClass("whitespace-nowrap");
    expect(within(card).getByText("Состояние")).toBeInTheDocument();
    expect(slot("card-stage")).toHaveTextContent("приёмка · проход 2 из 2 · на этапе 22 ч");
    expect(slot("card-stage")).toHaveAttribute("title", "приёмка · проход 2 из 2 · с 15.11 21:41 МСК");
    expect(slot("card-units")).toHaveTextContent("30 из 42 юнитов закоммичено · 2 в работе");
    expect(slot("card-activity")).toHaveTextContent("идёт 2 д · 98 запусков");
    expect(slot("card-activity")).toHaveAttribute("title", "идёт 2 д · 98 запусков агента");
  });

  test("craft-1 · below the shell's breakpoint the band lists every run as a mini row; cand-10 · its list holds four whole rows, every row and fold 32 px", async () => {
    renderShell(fx.transport, { path: `/r/${keyOf(0)}`, wide: false });
    await ready();
    expect(sidebar()).not.toHaveClass("max-h-60");
    expect(cards()).toHaveLength(0);
    const rows = [...sidebar().querySelectorAll<HTMLAnchorElement>("[data-slot=mini-row]")];
    expect(rows.slice(0, 3).map((r) => r.getAttribute("href"))).toEqual(["/r/fsloop/077e72d5", "/r/bots/42d34077", "/r/admin/a5b5ec85"]);
    for (const r of rows.slice(0, 3)) expect(r).toHaveClass("h-8");
    for (const fold of sidebar().querySelectorAll("[data-slot=sidebar-fold]")) {
      expect(fold.className).not.toMatch(/\bp[ty]?-/);
      expect(fold.querySelector("button")).toHaveClass("h-8", "border-t");
    }
  });

  test("p2-verdict craft-1, p1-verdict cand-10 · below the breakpoint the band's list is 128 px — four whole 32 px rows — by its computed flex, from the first paint; every stop of its scroll shows whole rows, the closed runs' rows included", async () => {
    const user = userEvent.setup();
    let release!: () => void;
    const held = new Promise<void>((done) => (release = done));
    fx.answer((path) => (path === "/api/runs" ? held.then(() => fx.app.handle(new Request(`http://127.0.0.1${path}`))) : null));
    renderShell(fx.transport, { path: `/r/${keyOf(0)}`, wide: false });
    const list = () => sidebar().querySelector("[data-slot=sidebar-list]") as HTMLElement;
    await applyStylesheet();
    // The band is a column whose height its content decides (the shell's `auto` row): the list's own flex sizes it.
    expect(getComputedStyle(sidebar()).height).toBe("auto");
    // First paint, «Загрузка…» in the region: already the list's height, so the list lands without moving the page.
    expect(within(list()).getByRole("status")).toHaveTextContent("Загрузка…");
    expect(usedBlockSize(list())).toBe(128);
    fx.answer(null);
    await act(async () => release());
    await ready();
    await user.click(within(sidebar()).getByRole("button", { name: "Закрытые · 53" }));
    await user.click(within(sidebar()).getByRole("button", { name: "Без записи о прогоне · 3" }));
    await applyStylesheet();
    expect(usedBlockSize(list())).toBe(128);
    // Every row of the list — the running, the long-silent, the 53 closed, the unrecorded, and each fold's header.
    const rows = [...list().querySelectorAll<HTMLElement>("[data-slot=mini-row], [data-slot=sidebar-fold] > button")];
    expect(rows).toHaveLength(3 + 4 + 53 + 3 + 3);
    expect(rows.some((r) => r.matches(`[href="/r/${keyOf(0)}"]`))).toBe(true);
    const box = getComputedStyle(list());
    expect(box.scrollSnapType).toBe("y mandatory");
    expect(getComputedStyle(list().querySelector("[data-slot=flat-list], [role=group]") as HTMLElement).rowGap).toMatch(/^(0px|normal)$/);
    for (const r of rows) expect(getComputedStyle(r).scrollSnapAlign).toBe("start");
    // The rows' edges, top to bottom; the scroll stops on each row's top, the last stop where the scroll ends.
    const heights = rows.map((r) => usedBlockSize(r));
    const top = Number.parseFloat(box.paddingTop) || 0;
    const edges = heights.reduce<number[]>((acc, h) => [...acc, acc[acc.length - 1] + (h as number)], [top]);
    const end = edges[edges.length - 1] + (Number.parseFloat(box.paddingBottom) || 0);
    const stops = new Set(edges.slice(0, -1).map((t) => Math.min(t, end - 128)));
    for (const stop of stops) {
      expect(edges, `a stop at ${stop} px cuts the row above it`).toContain(stop);
      expect(stop + 128 === end || edges.includes(stop + 128), `a stop at ${stop} px cuts the row at the box's end`).toBe(true);
    }
  });

  test("craft-4 · a mini row: no «новое» column and no clock time after the age — both in its name and title; the project cuts first", async () => {
    // fsloop's run changed since the operator last had it open: it reads «новое».
    writePref("runs:seen", { [keyOf(24)]: "2000-01-01T00:00:00.000Z" });
    renderShell(fx.transport, { path: `/r/${keyOf(0)}`, wide: false });
    await ready();
    const rows = [...sidebar().querySelectorAll<HTMLAnchorElement>("[data-slot=mini-row]")];
    // p2-verdict craft-2 · the liveness first, what waits after it: a narrow row cuts the cause, never the state.
    expect(rows[2]).toHaveTextContent(/^admina5b5ec85работает · красный гейт · заблокирован u23$/);
    expect(rows[2]).toHaveAccessibleName("admin · a5b5ec85 · работает · красный гейт · заблокирован u23");
    expect(rows[2]).toHaveAttribute("title", "admin · a5b5ec85 · работает · красный гейт · заблокирован u23 · последняя запись 19:40 МСК");
    expect(sidebar().querySelector("[data-slot=mini-row] [data-slot=new-mark]")).toBeNull();
    expect(rows[2].querySelector("[data-slot=mini-project]")).toHaveClass("truncate");
    // «новое» is the inset edge mark, which moves nothing, and the row's name.
    expect(rows[0]).toHaveAttribute("data-new");
    expect(rows[0]).toHaveClass("shadow-edge");
    expect(rows[0]).toHaveAccessibleName(/^fsloop · 077e72d5 · .+ · новое$/);
    expect(rows[1]).not.toHaveAttribute("data-new");
  });

  test("p2-verdict craft-2 · at the 316 px sidebar a mini row keeps its project's whole word — the widest project of this machine's runs — beside the widest closed state and the widest waiting state; the state keeps its words, a narrow row cuts only the cause", async () => {
    const user = userEvent.setup();
    // The projects with fsloop runs on this machine (common.md → production shape): the widest name at the row's face.
    const PROJECTS = ["db.ren.net", "fsloop", "max-auto", "tga", "tgtrigger"];
    const widest = PROJECTS.reduce((a, b) => (textWidth(b, { weight: 600 }) > textWidth(a, { weight: 600 }) ? b : a));
    expect(widest).toBe("db.ren.net");
    answerWidest(widest);
    renderShell(fx.transport, { path: `/r/${keyOf(0)}` });
    await within(sidebar()).findByText("3 прогона идут");
    await user.click(within(sidebar()).getByRole("button", { name: "Закрытые · 53" }));
    await user.click(within(sidebar()).getByRole("button", { name: "Без записи о прогоне · 3" }));
    await applyStylesheet();
    // The sidebar's width is the shell grid's first column, as the stylesheet computes it.
    const shell = document.querySelector("[data-slot=shell]") as HTMLElement;
    expect(getComputedStyle(shell).gridTemplateColumns).toMatch(/^316px /);
    const rows = [...sidebar().querySelectorAll<HTMLElement>("[data-slot=mini-row]")];
    expect(rows).toHaveLength(4 + 53 + 3);
    const waiting = rows.filter((r) => /^молчит · \d+ [чд] · красный гейт · 2 юнита заблокированы$/.test(r.querySelector("[data-slot=mini-state]")?.textContent ?? ""));
    expect(waiting.length).toBeGreaterThan(0);
    const closed = rows.filter((r) => r.querySelector("[data-slot=mini-state]")?.textContent === "цель не достигнута");
    expect(closed).toHaveLength(53);
    for (const row of [...waiting, ...closed, ...rows]) {
      const line = row.querySelector("[data-slot=mini-line]") as HTMLElement;
      const sizes = flexRow(line, innerWidth(line, sidebar(), 316));
      const project = line.querySelector("[data-slot=mini-project]") as HTMLElement;
      expect(project).toHaveTextContent(widest);
      expect(sizes.get(project), `${row.title}: the project is cut`).toBeGreaterThanOrEqual(contentWidth(project));
      // The state keeps its words; what does not fit is the cause, cut at its end with the whole in the row's title.
      const state = line.querySelector("[data-slot=mini-state]") as HTMLElement;
      const text = state.querySelector("[data-slot=mini-text]") as HTMLElement;
      const fact = text.querySelector("[data-slot=mini-fact]") as HTMLElement;
      // The words' box clips what overflows it: the fact must fit in the box the state leaves it, not only keep its width.
      expect(flexRow(state, sizes.get(state) as number).get(text), `${row.title}: the state is cut`).toBeGreaterThanOrEqual(contentWidth(fact));
    }
  });

  test("p2-verdict-critic-craft-verdict-4#craft-1 · a waiting mini row: the liveness on its own dot, as the run header's «Активность» reads it, the wait on its amber dot where it begins; the row stays one 32 px line", async () => {
    renderShell(fx.transport, { path: "/r/admin/a5b5ec85", wide: false });
    await ready();
    const row = sidebar().querySelector('[data-slot=mini-row][href="/r/admin/a5b5ec85"]') as HTMLElement;
    const state = row.querySelector("[data-slot=mini-state]") as HTMLElement;
    expect(state).toHaveTextContent(/^работает · красный гейт · заблокирован u23$/);
    // Each dot is the tone of the word beside it: the liveness's, then the wait's.
    const dots = [...state.querySelectorAll("[data-slot=dot]")];
    expect(dots.map((d) => d.getAttribute("data-tone"))).toEqual(["neutral", "warning"]);
    expect(dots[0].nextElementSibling?.firstElementChild).toHaveTextContent(/^работает$/);
    expect(dots[1].nextElementSibling).toHaveTextContent(/^красный гейт · заблокирован u23$/);
    // The run header on the same page reads the same liveness on the same tone.
    const activity = () => [...document.querySelectorAll("dt")].find((dt) => dt.textContent === "Активность");
    await waitFor(() => expect(activity()).toBeDefined());
    const value = activity()?.nextElementSibling as HTMLElement;
    expect(value.querySelector("[data-slot=status-dot]")?.textContent).toMatch(/^работает · /);
    expect(value.querySelector("[data-slot=dot]")).toHaveAttribute("data-tone", dots[0].getAttribute("data-tone"));
    // The second dot takes its place in the row's one line: the band's row is still 32 px, its line never wraps.
    await applyStylesheet();
    expect(usedBlockSize(row)).toBe(32);
    expect(getComputedStyle(row.querySelector("[data-slot=mini-line]") as HTMLElement).flexWrap).toBe("nowrap");
  });

  test("p2-verdict-critic-craft-verdict-4#craft-1, #craft-2 · at the 316 px sidebar a waiting mini row keeps the wait's « ·» and amber dot whole after its liveness, the cut only on the cause's tail; an unpushed closed row keeps at least its goal's first word whole on its second line", async () => {
    const user = userEvent.setup();
    const goals = new Map<string, string | null>();
    answerWidest("db.ren.net", goals);
    renderShell(fx.transport, { path: `/r/${keyOf(0)}` });
    await ready();
    await user.click(within(sidebar()).getByRole("button", { name: "Закрытые · 53" }));
    await applyStylesheet();
    const rows = [...sidebar().querySelectorAll<HTMLElement>("[data-slot=mini-row]")];
    const waiting = rows.filter((r) => r.querySelector("[data-slot=mini-waits]"));
    expect(waiting).toHaveLength(4);
    for (const row of waiting) {
      const line = row.querySelector("[data-slot=mini-line]") as HTMLElement;
      const state = line.querySelector("[data-slot=mini-state]") as HTMLElement;
      const text = state.querySelector("[data-slot=mini-text]") as HTMLElement;
      const wait = text.querySelector("[data-slot=mini-waits]") as HTMLElement;
      const [sep, dot, cause] = [...wait.children];
      expect(dot).toHaveAttribute("data-tone", "warning");
      expect(getComputedStyle(dot).width).toBe("7px");
      const stateSize = flexRow(line, innerWidth(line, sidebar(), 316)).get(state) as number;
      const textSize = flexRow(state, stateSize).get(text) as number;
      const parts = flexRow(wait, flexRow(text, textSize).get(wait) as number);
      expect(parts.get(sep), `${row.title}: the « ·» before the wait is cut`).toBeGreaterThanOrEqual(contentWidth(sep));
      expect(parts.get(dot), `${row.title}: the wait's dot is cut`).toBe(7);
      // Only the cause's words give way, at their end.
      expect(cause).toHaveAttribute("data-slot", "mini-cause");
      expect(getComputedStyle(cause).textOverflow).toBe("ellipsis");
      expect(getComputedStyle(sep).flexShrink).toBe("0");
    }
    // the closed fold's rows (a long-silent row's second line is its goal alone — improve-6 (2))
    const closed = rows.filter((r) => r.closest("[data-group=closed]") && r.querySelector("[data-slot=mini-goal]"));
    expect(closed).toHaveLength(53);
    for (const row of closed) {
      const second = row.querySelector("[data-slot=mini-goal]") as HTMLElement;
      const goal = goals.get(row.getAttribute("href") ?? "");
      expect(goal, `${row.title}: no goal`).toBeTruthy();
      const face = second.textContent ?? "";
      expect(face).toMatch(/^коммиты не отправлены · /);
      const at = face.indexOf(goal as string);
      expect(at, `${row.title}: the goal is not on the line`).toBeGreaterThan(0);
      const first = (goal as string).trim().split(/\s+/)[0];
      const size = Number.parseFloat(getComputedStyle(second).fontSize);
      expect(size).toBe(12);
      expect(textWidth(face.slice(0, at) + first, { size }), `${row.title}: the goal's first word «${first}» is cut`).toBeLessThanOrEqual(innerWidth(second, sidebar(), 316));
    }
  });

  test("p1-review cand-3 · the search narrows every group to the runs whose project, id or goal hold its words; none — the filtered empty state and its reset", async () => {
    const user = userEvent.setup();
    renderShell(fx.transport, { path: `/r/${keyOf(0)}` });
    await ready();
    const search = within(sidebar()).getByRole("searchbox", { name: "Поиск: Проект, id, цель" });
    expect(search.closest("[data-slot=sidebar-head]")).not.toBeNull();
    await user.type(search, "admin");
    const shown = () => [...sidebar().querySelectorAll<HTMLAnchorElement>("[data-slot=run-card], [data-slot=mini-row]")].map((a) => a.getAttribute("href"));
    expect(cards().map((c) => c.getAttribute("href"))).toEqual(["/r/admin/a5b5ec85"]);
    for (const href of shown()) expect(href).toMatch(/^\/r\/admin\//);
    await user.type(search, " zzzz");
    expect(shown()).toEqual([]);
    expect(within(sidebar()).getByText("Нет прогонов, подходящих под фильтры")).toBeInTheDocument();
    expect(within(sidebar()).getByText("Фильтры: поиск «admin zzzz»")).toBeInTheDocument();
    expect(within(sidebar()).queryByText("Сейчас ни один прогон не идёт — новый появится здесь сам")).toBeNull();
    await user.click(within(sidebar()).getByRole("button", { name: "Сбросить фильтры" }));
    expect(search).toHaveValue("");
    expect(cards()).toHaveLength(3);
  });

  test("the folds: long-silent 4, closed all 53 scrolling inside, without a record 3 — open state kept in browser storage", async () => {
    const user = userEvent.setup();
    const first = renderShell(fx.transport, { path: `/r/${keyOf(0)}` });
    await ready();
    const silent = within(sidebar()).getByRole("button", { name: foldTitle("Не закрыты и давно молчат", 4) });
    expect(silent).toHaveAttribute("aria-expanded", "true");
    const closed = within(sidebar()).getByRole("button", { name: "Закрытые · 53" });
    expect(closed).toHaveAttribute("aria-expanded", "false");
    const unrecorded = within(sidebar()).getByRole("button", { name: "Без записи о прогоне · 3" });
    await user.click(closed);
    expect(sidebar().querySelectorAll("[data-slot=mini-row]")).toHaveLength(4 + 53);
    // p1-review cand-3 · a closed run's row is two reserved lines: the state, then when it closed and its goal.
    const row = sidebar().querySelector(`[data-slot=mini-row][href="/r/${keyOf(0)}"]`) as HTMLElement;
    expect(row).toHaveClass("h-12");
    // p2-verdict craft-2 · the first line the goal's outcome alone, the push on the second, before when and the goal.
    expect(row.querySelector("[data-slot=mini-state]")).toHaveTextContent(/^цель не достигнута$/);
    expect(row).toHaveAccessibleName(`${keyOf(0).replace("/", " · ")} · цель не достигнута · коммиты не отправлены`);
    expect(row.querySelector("[data-slot=mini-goal]")?.textContent).toMatch(/^коммиты не отправлены · 9 ч назад · Run 0: bring the /);
    expect(row.querySelector("[data-slot=mini-goal]")).toHaveClass("truncate");
    await user.click(unrecorded);
    const bare = sidebar().querySelector(`[data-slot=mini-row][href="/r/${keyOf(7)}"]`) as HTMLElement;
    expect(bare).toHaveTextContent(/не записано: в папке нет run\.json$/);
    expect(bare).toHaveAttribute("title", expect.stringContaining("последняя запись 13.11 19:41 МСК"));
    expect(bare).toHaveClass("h-8");
    expect(sidebar().querySelector("[data-slot=sidebar-list]")).toHaveClass("overflow-y-auto", "[scrollbar-gutter:stable]");
    first.unmount();
    renderShell(fx.transport, { path: `/r/${keyOf(0)}` });
    await ready();
    expect(within(sidebar()).getByRole("button", { name: "Закрытые · 53" })).toHaveAttribute("aria-expanded", "true");
    expect(within(sidebar()).getByRole("button", { name: "Без записи о прогоне · 3" })).toHaveAttribute("aria-expanded", "true");
  });

  test("one Tab stop, ↑/↓ move, Enter opens; a card is one link with nothing focusable inside", async () => {
    const user = userEvent.setup();
    const { probe } = renderShell(fx.transport, { path: `/r/${keyOf(0)}` });
    await ready();
    const items = [...sidebar().querySelectorAll<HTMLElement>("[data-flat-item]")];
    expect(items.filter((el) => el.tabIndex === 0)).toHaveLength(1);
    for (const card of cards()) {
      expect(card.tagName).toBe("A");
      expect(card.querySelectorAll("a, button, input, select, textarea, [tabindex]")).toHaveLength(0);
    }
    act(() => cards()[0].focus());
    await user.keyboard("{ArrowDown}");
    expect(document.activeElement).toBe(cards()[1]);
    await user.keyboard("{Enter}");
    expect(probe.location?.pathname).toBe("/r/bots/42d34077");
    expect(cards()[1]).toHaveAttribute("aria-current", "page");
  });

  test("the held-order strip keeps its line reserved while nothing waits", async () => {
    renderShell(fx.transport, { path: `/r/${keyOf(0)}` });
    await ready();
    const strip = sidebar().querySelector("[data-slot=held-strip]") as HTMLElement;
    expect(strip).toHaveClass("h-strip");
    expect(strip.querySelector("button")).toBeNull();
  });

  test("a list that fails to load says so with «Повторить»", async () => {
    const user = userEvent.setup();
    fx.answer((path) => (path === "/api/runs" ? Promise.resolve(json(500, { error: "корень недоступен" })) : null));
    renderShell(fx.transport, { path: `/r/${keyOf(0)}` });
    expect(await within(sidebar()).findByText("Список прогонов не прочитан: корень недоступен")).toBeInTheDocument();
    fx.answer(null);
    await user.click(within(sidebar()).getByRole("button", { name: "Повторить" }));
    await ready();
  });
});
