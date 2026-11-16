// @vitest-environment jsdom
import "../ui/test-setup.ts";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";
import { readPref } from "../ui/storage.ts";
import { ObjectLink, objectHref, resolverFor } from "./links.tsx";
import { dataAgeText, lostText, outcomeLine, runNotFoundText, emptyRootText, tabTitle } from "./words.ts";
import { fixtureApp, keyOf, MIN, NOW, renderShell, type FixtureApp } from "./testing.tsx";

const words = (s: string) => s.split(" ").length;

describe("the run page's words, built once", () => {
  test("the verdict of a closed run", () => {
    expect(outcomeLine({ pushed: true, goalMet: true, held: [] })).toEqual({ tone: "success", text: "цель достигнута · коммиты отправлены" });
    expect(outcomeLine({ pushed: false, goalMet: false, held: [] })).toEqual({ tone: "neutral", text: "цель не достигнута · коммиты не отправлены" });
    expect(outcomeLine({ pushed: true, goalMet: null, held: [] })).toEqual({ tone: "neutral", text: "коммиты отправлены" });
    expect(outcomeLine(null)).toEqual({ tone: "neutral", text: "не записано" });
  });

  test("the tab title, «● » on a change the hidden tab missed", () => {
    expect(tabTitle({ project: "admin", id: "a5b5ec85", stage: "приёмка" }, false)).toBe("fsloopUI · admin · a5b5ec85 · приёмка");
    expect(tabTitle({ project: "admin", id: "a5b5ec85", stage: "приёмка" }, true)).toBe("● fsloopUI · admin · a5b5ec85 · приёмка");
  });

  test("the frame's messages name the run, the root and what comes next", () => {
    const missing = runNotFoundText("077e72d5", ["C:/Users/op/dev"]);
    expect(missing).toBe("Прогон 077e72d5 не найден: его папки больше нет в C:/Users/op/dev");
    expect(words(missing)).toBe(10);
    const empty = emptyRootText(["C:/Users/op/dev"]);
    expect(empty).toBe("В C:/Users/op/dev нет прогонов fsloop. Новый появится здесь сам, когда fsloop создаст его папку.");
    expect(words(empty)).toBe(14);
  });

  test("lost connection and data age, in МСК through the shared function", () => {
    expect(lostText(NOW - 3 * MIN, NOW)).toBe("Нет связи с сервером fsloopUI · данные от 19:38 МСК");
    expect(lostText(NOW - 3 * MIN, NOW, { compact: true })).toBe("Нет связи · данные от 19:38 МСК");
    expect(lostText(Date.parse("2026-11-15T20:00:00Z"), NOW)).toBe("Нет связи с сервером fsloopUI · данные от 15.11 23:00 МСК");
    expect(lostText(null, NOW)).toBe("Нет связи с сервером fsloopUI");
    expect(dataAgeText(NOW - 5 * MIN, NOW)).toBe("обновлено 5 мин назад");
    expect(dataAgeText(NOW - 20_000, NOW)).toBe("обновлено меньше минуты назад");
  });
});

describe("the run page's frame", () => {
  let fx: FixtureApp;
  beforeAll(() => {
    fx = fixtureApp({ only: [0, 7, 24, 40] });
  });
  afterAll(() => fx.close());
  afterEach(() => fx.answer(null));

  const header = () => document.querySelector("[data-slot=run-header]") as HTMLElement;
  const factList = () => header().querySelector("[data-slot=fact-list]") as HTMLElement;
  const facts = () => [...factList().querySelectorAll("dt")].map((dt) => [dt.textContent, (dt.nextElementSibling as HTMLElement).textContent]);
  const loaded = () => screen.findByRole("tab", { name: /Находки/ });

  test("ux 9 order: identity, then outcome rows, then facts, «Подробнее» last and kept", async () => {
    const user = userEvent.setup();
    renderShell(fx.transport, { path: `/r/${keyOf(40)}` });
    await loaded();
    expect(within(header()).getByRole("heading", { level: 1 })).toHaveTextContent("admin·a5b5ec85");
    expect(facts()).toEqual([
      ["Этап", "приёмка · проход 2 из 2 · с 15.11 21:41 МСК"],
      ["Активность", "работает · последняя запись 19:40 МСК"],
      ["Ждёт вас", "красный гейт: p2-assess-critic-code#code-2 has no decision row · заблокирован u23 — waits for the user — the empty state's wording (j140)"],
      ["Юниты", "30 из 42 юнитов закоммичено · 2 в работе"],
      ["Режим", "worktree"],
      ["Проходы", "до 2 проходов"],
      ["Юнитов сразу", "до 3"],
      ["Модели", "claude-opus-5-5"],
      ["Начат", "14.11 19:41 МСК"],
      ["Длительность", "2 д"],
      ["Запуски агентов", "97 запусков агента · 1 работает"],
      ["Коммиты", "не записано"],
    ]);
    await user.click(within(header()).getByRole("button", { name: "Подробнее" }));
    expect(facts().slice(12).map(([label]) => label)).toEqual(["Зеркало .spike", "Рабочая копия", "Сессии", "Папка прогона", "Версия run.json"]);
    expect(facts()[12][1]).toBe("нет");
    expect(facts()[14][1]).toBe("5e55a5b5ec85-0000-4000-8000-000000000001");
    expect(facts()[15][1]).toBe(fx.dirOf(40));
    expect(readPref("fold:run", false)).toBe(true);
    // Every value is one line: a live change of its words never changes the header's height.
    for (const dd of factList().querySelectorAll("dd")) expect(dd.firstElementChild).toHaveClass("block", "truncate");
  });

  test("a closed run: the verdict row after the outcome, no activity and nothing waits", async () => {
    renderShell(fx.transport, { path: `/r/${keyOf(0)}` });
    await loaded();
    expect(facts().slice(0, 3)).toEqual([
      ["Этап", "прогон закрыт"],
      ["Юниты", "1 из 1 юнита закоммичен"],
      ["Итог", "цель не достигнута · коммиты не отправлены"],
    ]);
    expect(facts().map(([label]) => label)).not.toContain("Активность");
    expect(facts().map(([label]) => label)).not.toContain("Ждёт вас");
  });

  test("the goal: clamped, newlines collapsed, from the card before the run loads; «развернуть» only when the clamp hides text; expanded as running text", async () => {
    const user = userEvent.setup();
    let release!: () => void;
    const held = new Promise<void>((done) => (release = done));
    fx.answer((path) => (path.startsWith("/api/run?") ? held.then(() => fx.app.handle(new Request(`http://127.0.0.1${path}`))) : null));
    const heights = { scroll: 900, client: 38 };
    const scroll = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollHeight");
    const client = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientHeight");
    const RO = window.ResizeObserver;
    Object.defineProperty(HTMLElement.prototype, "scrollHeight", { configurable: true, get: () => heights.scroll });
    Object.defineProperty(HTMLElement.prototype, "clientHeight", { configurable: true, get: () => heights.client });
    window.ResizeObserver = class {
      private cb: ResizeObserverCallback;
      constructor(cb: ResizeObserverCallback) {
        this.cb = cb;
      }
      observe() {
        this.cb([], this as unknown as ResizeObserver);
      }
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
    try {
      renderShell(fx.transport, { path: `/r/${keyOf(40)}` });
      const line = await screen.findByText((_, el) => el?.getAttribute("data-slot") === "goal-line");
      const before = line.textContent ?? "";
      expect(before).not.toContain("\n");
      expect(line.closest(".line-clamp-2")).not.toBeNull();
      // The run is not read yet: no trigger, the body holds «Загрузка…».
      expect(within(header()).queryByRole("button", { name: "Развернуть цель прогона" })).toBeNull();
      expect(within(screen.getByRole("region", { name: "Раздел прогона" })).getByRole("status")).toHaveTextContent("Загрузка…");
      await act(async () => release());
      await loaded();
      const after = header().querySelector("[data-slot=goal-line]")?.textContent ?? "";
      // The clamp shows the same first two lines from the card and from the run.
      expect(after.slice(0, 200)).toBe(before.slice(0, 200));
      await user.click(within(header()).getByRole("button", { name: "Развернуть цель прогона" }));
      const region = within(header()).getByRole("region", { name: "цель прогона" });
      expect(region).toHaveClass("max-h-text-cap", "overflow-y-auto");
      // The whole goal of 8 000 characters over 50 lines, list markers drawn as lists.
      expect(region.querySelector("[data-slot=goal-text]")?.textContent?.length).toBeGreaterThan(7500);
      expect(region.querySelectorAll("br").length + region.querySelectorAll("p, li").length).toBeGreaterThan(40);
    } finally {
      if (scroll) Object.defineProperty(HTMLElement.prototype, "scrollHeight", scroll);
      if (client) Object.defineProperty(HTMLElement.prototype, "clientHeight", client);
      window.ResizeObserver = RO;
    }
  });

  test("the tab title names the run and its stage; «● » marks a change the hidden tab missed", async () => {
    renderShell(fx.transport, { path: `/r/${keyOf(24)}` });
    await loaded();
    expect(document.title).toBe("fsloopUI · fsloop · 077e72d5 · ревью");
    const visibility = Object.getOwnPropertyDescriptor(Document.prototype, "visibilityState");
    let state: DocumentVisibilityState = "hidden";
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => state });
    try {
      act(() => void document.dispatchEvent(new Event("visibilitychange")));
      fx.write(24, "journal.md", "| # | stage | question | decision | why | refs |\n|---|---|---|---|---|---|\n| 1 | p1-map | Route? | worktree | many pages | — |\n| 2 | p1-review | Fix? | yes | above the bar | — |\n");
      await waitFor(() => expect(document.title).toBe("● fsloopUI · fsloop · 077e72d5 · ревью"));
      state = "visible";
      act(() => void document.dispatchEvent(new Event("visibilitychange")));
      expect(document.title).toBe("fsloopUI · fsloop · 077e72d5 · ревью");
    } finally {
      delete (document as unknown as Record<string, unknown>).visibilityState;
      if (visibility) Object.defineProperty(Document.prototype, "visibilityState", visibility);
    }
  });

  test("objects by address: objectHref, ObjectLink with «не найден», the running text's resolver", () => {
    const run = fx.app.store.run(keyOf(40));
    if (!run) throw new Error("no run");
    expect(objectHref(run, { kind: "finding", id: "p1-map-craft-accounts#craft-1" })).toBe("/r/admin/a5b5ec85?view=findings&finding=p1-map-craft-accounts%23craft-1");
    expect(objectHref(run, { kind: "unit", id: "u23" })).toBe("/r/admin/a5b5ec85?view=units&unit=u23");
    expect(objectHref(run, { kind: "report", id: "p1-map-map", tab: "sections" })).toBe("/r/admin/a5b5ec85?view=reports&report=p1-map-map&tab=sections");
    expect(objectHref(run, { kind: "entry", id: "12" })).toBe("/r/admin/a5b5ec85?view=journal&entry=12");
    expect(objectHref(run, { kind: "unit", id: "u99" })).toBeNull();
    const resolve = resolverFor(run);
    expect(resolve("u23")).toBe("/r/admin/a5b5ec85?view=units&unit=u23");
    expect(resolve("j12")).toBe("/r/admin/a5b5ec85?view=journal&entry=12");
    expect(resolve("p1-map-map")).toBe("/r/admin/a5b5ec85?view=reports&report=p1-map-map");
    expect(resolve("worktree")).toBeNull();
    render(
      <MemoryRouter>
        <ObjectLink run={run} kind="unit" id="u23" />
        <ObjectLink run={run} kind="unit" id="u99" />
        <ObjectLink run={run} kind="entry" id="999" />
      </MemoryRouter>,
    );
    expect(screen.getByRole("link", { name: "u23" })).toHaveAttribute("href", "/r/admin/a5b5ec85?view=units&unit=u23");
    expect(screen.getByText((_, el) => el?.getAttribute("data-slot") === "not-found" && el.textContent === "юнит u99 не найден")).toBeInTheDocument();
    expect(screen.getByText((_, el) => el?.getAttribute("data-slot") === "not-found" && el.textContent === "запись журнала 999 не найдена")).toBeInTheDocument();
  });

  test("reserved boxes: each tab's count before the run loads; the loading body at the region's size", async () => {
    let release!: () => void;
    const held = new Promise<void>((done) => (release = done));
    fx.answer((path) => (path.startsWith("/api/run?") ? held.then(() => fx.app.handle(new Request(`http://127.0.0.1${path}`))) : null));
    renderShell(fx.transport, { path: `/r/${keyOf(24)}` });
    const tabs = await screen.findAllByRole("tab");
    expect(tabs.map((t) => t.textContent)).toEqual(["Находки", "Юниты", "Отчёты", "Соглашения", "Журнал"]);
    for (const t of tabs) expect(t.querySelector("[data-slot=tab-count]")).toHaveClass("min-w-count", "tabular-nums");
    const body = screen.getByRole("region", { name: "Раздел прогона" });
    expect(body).toHaveClass("flex-1", "min-h-0", "overflow-y-auto", "[scrollbar-gutter:stable]");
    expect(within(body).getByRole("status")).toHaveClass("size-full");
    await act(async () => release());
    await waitFor(() => expect(screen.getByRole("tab", { name: /Находки/ }).querySelector("[data-slot=tab-count]")?.textContent).not.toBe(""));
    // The strip of the lost connection lives in the tab row: its arrival adds no row.
    expect(screen.getByRole("tablist").closest("[data-slot=view-tabs]")).toHaveClass("h-10", "shrink-0");
  });
});
