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

  test("ux 9 order (craft-2): identity, the four outcome rows, the settings in one muted row, the counts behind «Подробнее», kept", async () => {
    const user = userEvent.setup();
    renderShell(fx.transport, { path: `/r/${keyOf(40)}` });
    await loaded();
    expect(within(header()).getByRole("heading", { level: 1 })).toHaveTextContent("admin·a5b5ec85");
    expect(facts().map(([label]) => label)).toEqual(["Этап", "Активность", "Ждёт вас", "Юниты", "Настройки"]);
    expect(facts()[0][1]).toBe("приёмка · проход 2 из 2 · с 15.11 21:41 МСК");
    expect(facts()[1][1]).toBe("работает · последняя запись 19:40 МСК");
    expect(facts()[3][1]).toBe("30 из 42 юнитов закоммичено · 2 в работе");
    expect(facts()[4][1]).toBe("worktree · до 2 проходов · до 3 юнитов сразу · claude-opus-5-5");
    const settings = factList().querySelector("[data-slot=settings]") as HTMLElement;
    expect(settings).toHaveClass("text-muted-foreground");
    for (const part of settings.querySelectorAll(":scope > span > span")) expect(part).toHaveClass("whitespace-nowrap");
    await user.click(within(header()).getByRole("button", { name: "Подробнее" }));
    expect(facts().slice(13).map(([label]) => label)).toEqual(["Версия run.json"]);
    expect(facts().slice(5, 13)).toEqual([
      ["Начат", "14.11 19:41 МСК"],
      ["Длительность", "2 д"],
      ["Запуски агентов", "98 запусков агента · 1 работает"],
      ["Коммиты", "не записано"],
      ["Зеркало .spike", "нет"],
      ["Рабочая копия", "—нет значения"],
      ["Сессии", "5e55a5b5ec85-0000-4000-8000-000000000001"],
      ["Папка прогона", fx.dirOf(40)],
    ]);
    expect(readPref("fold:run", false)).toBe(true);
    // Every value a live change rewrites is one line: the header keeps its height (Strict 1). «Ждёт вас» is held in
    // its own box, the settings wrap only between their parts.
    for (const [i, dd] of [...factList().querySelectorAll("dd")].entries())
      if (![2, 4].includes(i)) expect(dd.firstElementChild).toHaveClass("block", "truncate");
  });

  test("craft-3 · «Ждёт вас»: one row per cause, each in full, its finding and unit linked; craft-21 · each cause and the liveness word explained", async () => {
    renderShell(fx.transport, { path: `/r/${keyOf(40)}` });
    await loaded();
    const rows = [...header().querySelectorAll<HTMLElement>("[data-slot=wait]")];
    expect(rows.map((r) => [r.dataset.kind, r.querySelector("[data-slot=glossary-term]")?.textContent])).toEqual([
      ["gate", "красный гейт"],
      ["blocked", "заблокирован"],
    ]);
    expect(rows[0]).toHaveTextContent("красный гейтp2-assess-critic-code#code-2 has no decision row");
    expect(rows[1]).toHaveTextContent("заблокированu23 — waits for the user — the empty state's wording (j140)");
    for (const r of rows) expect(r.querySelector(".truncate, .line-clamp-2, [title]")).toBeNull();
    expect(within(rows[1]).getByRole("link", { name: "u23" })).toHaveAttribute("href", "/r/admin/a5b5ec85?view=units&unit=u23");
    expect(rows[0].querySelector("[data-slot=dot]")).toHaveAttribute("data-tone", "warning");
    const activity = [...factList().querySelectorAll("dt")].find((dt) => dt.textContent === "Активность")?.nextElementSibling as HTMLElement;
    expect(within(activity).getByRole("button", { name: "работает" })).toHaveAttribute("data-slot", "glossary-term");
  });

  test("craft-3 · Strict 1: «Ждёт вас» is held at the height it first took; a live change of its causes scrolls inside, a resize measures again", async () => {
    const measured = { height: 57, width: 400 };
    const offset = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetHeight");
    const client = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientWidth");
    const RO = window.ResizeObserver;
    const observers: ResizeObserverCallback[] = [];
    Object.defineProperty(HTMLElement.prototype, "offsetHeight", { configurable: true, get: () => measured.height });
    Object.defineProperty(HTMLElement.prototype, "clientWidth", { configurable: true, get: () => measured.width });
    window.ResizeObserver = class {
      constructor(cb: ResizeObserverCallback) {
        observers.push(cb);
      }
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
    try {
      const { again } = renderShell(fx.transport, { path: `/r/${keyOf(40)}` });
      await loaded();
      const box = header().querySelector("[data-slot=waits-box]") as HTMLElement;
      expect(box).toHaveClass("max-h-[6lh]", "overflow-y-auto", "[scrollbar-gutter:stable]");
      expect(box.style.height).toBe("57px");
      // More causes arrive: the content would take more, the box keeps its height.
      measured.height = 120;
      again();
      for (const cb of observers) act(() => cb([], {} as ResizeObserver));
      expect(box.style.height).toBe("57px");
      // The operator narrows the window: the box is measured again at its new width.
      measured.width = 300;
      for (const cb of observers) act(() => cb([], {} as ResizeObserver));
      expect(box.style.height).toBe("120px");
    } finally {
      if (offset) Object.defineProperty(HTMLElement.prototype, "offsetHeight", offset);
      if (client) Object.defineProperty(HTMLElement.prototype, "clientWidth", client);
      window.ResizeObserver = RO;
    }
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

  test("the goal: clamped, each of its lines kept, from the card before the run loads; «развернуть» only when the clamp hides text; expanded as running text", async () => {
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
      expect(line).toHaveClass("whitespace-pre-line");
      expect(line.closest(".line-clamp-2")).not.toBeNull();
      // The run is not read yet: no trigger, the body holds «Загрузка…».
      expect(within(header()).queryByRole("button", { name: "Развернуть цель прогона" })).toBeNull();
      expect(within(screen.getByRole("region", { name: "Раздел прогона" })).getByRole("status")).toHaveTextContent("Загрузка…");
      await act(async () => release());
      await loaded();
      const after = header().querySelector("[data-slot=goal-line]")?.textContent ?? "";
      // The clamp opens on the same first line from the card and from the run; the run's numbered lines never run
      // together inline («1. … 2. …»): each starts a line of its own.
      const [first, second] = after.split("\n");
      expect(before.startsWith(first)).toBe(true);
      expect(second).toMatch(/^2\. /);
      expect(after).not.toMatch(/\n\s*\n/);
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
    // The view takes what the header leaves (or, below the shell's breakpoint, the page under the strip).
    expect(body).toHaveClass("[flex:var(--view-flex,1_1_0%)]", "min-h-0", "overflow-y-auto", "[scrollbar-gutter:stable]");
    expect(within(body).getByRole("status")).toHaveClass("size-full");
    await act(async () => release());
    await waitFor(() => expect(screen.getByRole("tab", { name: /Находки/ }).querySelector("[data-slot=tab-count]")?.textContent).not.toBe(""));
    // The tab row is one fixed line; the lost connection is the shell's, so nothing arrives in it.
    expect(screen.getByRole("tablist")).toHaveClass("group-data-horizontal/tabs:h-10", "shrink-0");
  });
});
