// @vitest-environment jsdom
import "../ui/test-setup.ts";
import { act, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { foldTitle, miniDetail, runningCount, settingsLine, stageLine, unitsLine, activityLine, waitsLine } from "./words.ts";
import { fixtureApp, json, keyOf, MIN, NOW, renderShell, type FixtureApp } from "./testing.tsx";

const iso = (ms: number) => new Date(ms).toISOString();
const words = (s: string) => s.split(" ").length;

describe("the card's words, built once", () => {
  test("the running count agrees its verb", () => {
    expect(runningCount(3)).toBe("3 прогона идут");
    expect(runningCount(1)).toBe("1 прогон идёт");
    expect(runningCount(21)).toBe("21 прогон идёт");
    expect(runningCount(0)).toBe("Сейчас ни один прогон не идёт — новый появится здесь сам");
  });

  test("the settings: mode, passes, units at once, models, the mirror", () => {
    expect(settingsLine({ mode: "worktree", N: 2, K: 3, models: ["claude-opus-5-5", "claude-sonnet-5-5"], mirror: true })).toBe("worktree · до 2 проходов · до 3 юнитов сразу · claude-opus-5-5 · claude-sonnet-5-5 · зеркало .spike");
    expect(settingsLine({ mode: "inline", N: null, K: 1, models: [], mirror: false })).toBe("inline · до 1 юнита сразу");
  });

  test("the stage: its word, the pass of N, the step, since when in МСК", () => {
    const s = stageLine({ recorded: true, closed: false, stage: "p2-assess", stageLabel: "проход 2 · приёмка", N: 3, step: "u23 ждёт решения", since: "2026-11-15T18:41:00Z" }, NOW);
    expect(s).toBe("приёмка · проход 2 из 3 · u23 ждёт решения · с 15.11 21:41 МСК");
    expect(words(s)).toBe(15);
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

  test("the activity: how long it goes, agent launches, commits", () => {
    const a = activityLine({ closed: false, startedAt: iso(NOW - 125 * MIN), launches: 34, commits: 2 }, NOW);
    expect(a).toBe("идёт 2 ч 05 мин · 34 запуска агента · 2 коммита");
    expect(words(a)).toBe(12);
    expect(activityLine({ closed: true, startedAt: iso(NOW - 125 * MIN), launches: 1, commits: null }, NOW)).toBe("1 запуск агента");
  });

  test("what waits on the operator: the red gate and a blocked unit in one line", () => {
    const gate = { at: "2026-11-16T16:21:00Z", problems: ["p2-assess-critic-code#code-2 has no decision row"] };
    const both = waitsLine({ redGate: gate, blocked: [{ id: "u23", why: "waits for the user — the empty state's wording (j140)" }] });
    expect(both).toEqual({ tone: "warning", text: "красный гейт: p2-assess-critic-code#code-2 has no decision row · заблокирован u23 — waits for the user — the empty state's wording (j140)" });
    expect(waitsLine({ redGate: { at: gate.at, problems: ["a", "b", "c"] }, blocked: [] }).text).toBe("красный гейт: a и ещё 2");
    expect(waitsLine({ redGate: null, blocked: [{ id: "u7", why: null }, { id: "u9", why: "x" }] }).text).toBe("2 юнита заблокированы: u7, u9");
    expect(waitsLine({ redGate: null, blocked: [] })).toEqual({ tone: "neutral", text: "ничего — прогон идёт сам" });
  });

  test("a fold's title and a mini row's detail", () => {
    expect(foldTitle("Закрытые", 53)).toBe("Закрытые · 53");
    expect(miniDetail({ recorded: true, closed: true, outcome: { pushed: true, goalMet: true, held: [] }, updatedAt: "2026-11-15T20:40:00Z", lastWriteAt: null }, NOW)).toEqual({ tone: "success", text: "цель достигнута · коммиты отправлены · 15.11 23:40 МСК" });
    expect(miniDetail({ recorded: true, closed: false, outcome: null, updatedAt: null, lastWriteAt: "2026-11-16T09:41:00Z" }, NOW)).toEqual({ tone: "warning", text: "молчит · 7 ч · 12:41 МСК" });
    expect(miniDetail({ recorded: false, closed: null, outcome: null, updatedAt: null, lastWriteAt: "2026-11-13T16:41:00Z" }, NOW)).toEqual({ tone: "neutral", text: "не записано: в папке нет run.json · 13.11 19:41 МСК" });
  });
});

describe("the sidebar over the fixture root of 63", () => {
  let fx: FixtureApp;
  beforeAll(() => {
    fx = fixtureApp();
  });
  afterAll(() => fx.close());

  const sidebar = () => screen.getByRole("complementary", { name: "Прогоны" });
  const cards = () => [...sidebar().querySelectorAll<HTMLAnchorElement>("[data-slot=run-card]")];
  const ready = async () => within(sidebar()).findByText("3 прогона идут");

  test("first load: «Загрузка…» with a spinner in the list's region, already at its size", async () => {
    let release!: () => void;
    const held = new Promise<void>((done) => (release = done));
    fx.answer((path) => (path === "/api/runs" ? held.then(() => fx.app.handle(new Request(`http://127.0.0.1${path}`))) : null));
    renderShell(fx.transport, { path: `/r/${keyOf(0)}` });
    const list = sidebar().querySelector("[data-slot=sidebar-list]") as HTMLElement;
    expect(list).toHaveClass("flex-1", "min-h-0");
    expect(within(list).getByRole("status")).toHaveTextContent("Загрузка…");
    fx.answer(null);
    await act(async () => release());
    await ready();
  });

  test("the head: the product, «Прогоны» and how many go; the running group as full cards, newest start first", async () => {
    renderShell(fx.transport, { path: `/r/${keyOf(0)}` });
    await ready();
    expect(within(sidebar()).getByText("fsloopUI")).toBeInTheDocument();
    expect(within(sidebar()).getByRole("heading", { name: "Прогоны" })).toBeInTheDocument();
    expect(cards().map((c) => c.getAttribute("href"))).toEqual(["/r/fsloop/077e72d5", "/r/bots/42d34077", "/r/admin/a5b5ec85"]);
  });

  test("a card: project · id · liveness, the goal clamped to two lines, «Настройки», «Состояние», what waits", async () => {
    renderShell(fx.transport, { path: `/r/${keyOf(0)}` });
    await ready();
    const card = cards()[2];
    const slot = (name: string) => card.querySelector(`[data-slot=${name}]`) as HTMLElement;
    expect(slot("card-project")).toHaveTextContent("admin");
    expect(slot("card-id")).toHaveTextContent("a5b5ec85");
    expect(slot("card-liveness")).toHaveTextContent("работает");
    const goal = slot("card-goal");
    expect(goal.querySelector(".line-clamp-2")).not.toBeNull();
    expect(goal.textContent).not.toContain("\n");
    expect(goal.textContent?.startsWith("1. ")).toBe(true);
    expect(within(card).getByText("Настройки")).toBeInTheDocument();
    expect(slot("card-settings")).toHaveTextContent("worktree · до 2 проходов · до 3 юнитов сразу · claude-opus-5-5");
    expect(within(card).getByText("Состояние")).toBeInTheDocument();
    expect(slot("card-stage")).toHaveTextContent("приёмка · проход 2 из 2 · с 15.11 21:41 МСК");
    expect(slot("card-units")).toHaveTextContent("30 из 42 юнитов закоммичено · 2 в работе");
    expect(slot("card-activity")).toHaveTextContent("идёт 2 д · 97 запусков агента");
    const waits = slot("card-waits");
    expect(waits).toHaveTextContent("красный гейт: p2-assess-critic-code#code-2 has no decision row · заблокирован u23 — waits for the user — the empty state's wording (j140)");
    expect(waits.querySelector("[data-slot=dot]")).toHaveAttribute("data-tone", "warning");
    // A card no gate or block holds keeps the outcome line's box, empty: an amber line that arrives moves nothing.
    const calm = cards()[0].querySelector("[data-slot=card-waits]") as HTMLElement;
    expect(calm).toHaveClass("h-lh");
    expect(calm).toHaveTextContent("");
    expect(waits).toHaveClass("h-lh");
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
    const row = sidebar().querySelector(`[data-slot=mini-row][href="/r/${keyOf(0)}"]`) as HTMLElement;
    expect(row).toHaveTextContent("shop1a2b3c4dцель не достигнута · коммиты не отправлены · 10:41 МСК");
    await user.click(unrecorded);
    expect(sidebar().querySelector(`[data-slot=mini-row][href="/r/${keyOf(7)}"]`)).toHaveTextContent("не записано: в папке нет run.json · 13.11 19:41 МСК");
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
