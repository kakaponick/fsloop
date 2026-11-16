// @vitest-environment jsdom
// The task walk of surfaces/shell.md → WALK, steps 1–11, one test each.
import "../ui/test-setup.ts";
import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { rmSync } from "node:fs";
import { afterEach, describe, expect, test } from "vitest";
import { emptyRootText, runNotFoundText } from "./words.ts";
import { applyStylesheet, usedBlockSize } from "./layout-testing.ts";
import { fixtureApp, json, keyOf, MIN, NOW, renderShell, type FixtureApp } from "./testing.tsx";

let fx: FixtureApp | null = null;
const open = (options: Parameters<typeof fixtureApp>[0] = { only: [0, 3, 7, 24] }) => (fx = fixtureApp(options));
afterEach(() => {
  fx?.close();
  fx = null;
});

const sidebar = () => screen.getByRole("complementary", { name: "Прогоны" });
const header = () => document.querySelector("[data-slot=run-header]") as HTMLElement;
const body = () => screen.getByRole("region", { name: "Раздел прогона" });
const fact = (label: string) => {
  const dt = [...header().querySelectorAll("dt")].find((el) => el.textContent === label);
  return dt?.nextElementSibling?.textContent ?? null;
};
const loaded = () => screen.findByRole("tab", { name: /Находки/ });

describe("the shell's walk", () => {
  test("1 · `/` is replaced, not pushed, by the most recently active open run", async () => {
    const app = open();
    const { probe } = renderShell(app.transport, { path: "/" });
    await waitFor(() => expect(probe.location?.pathname).toBe("/r/fsloop/077e72d5"));
    expect(probe.type).toBe("REPLACE");
  });

  test("2 · the header and its fact rows draw from the card at once; the body holds «Загрузка…» until the run is read", async () => {
    const app = open();
    let release!: () => void;
    const held = new Promise<void>((done) => (release = done));
    app.answer((path) => (path.startsWith("/api/run?") ? held.then(() => app.app.handle(new Request(`http://127.0.0.1${path}`))) : null));
    renderShell(app.transport, { path: `/r/${keyOf(24)}` });
    await waitFor(() => expect(header()).not.toBeNull());
    expect(within(header()).getByRole("heading", { level: 1 })).toHaveTextContent("fsloop·077e72d5");
    expect(fact("Этап")).toBe("ревью · проход 1 из 2 · с 15:38 МСК");
    expect(fact("Юниты")).toBe("0 из 1 юнита закоммичено · 1 в работе");
    expect(within(body()).getByRole("status")).toHaveTextContent("Загрузка…");
    await act(async () => release());
    await loaded();
    expect(fact("Этап")).toBe("ревью · проход 1 из 2 · с 15:38 МСК");
  });

  test("3 · loaded: the tab strip with counts, «Находки» the default view", async () => {
    const app = open();
    renderShell(app.transport, { path: `/r/${keyOf(24)}` });
    const findings = await loaded();
    expect(findings).toHaveAttribute("aria-selected", "true");
    const run = app.app.store.run(keyOf(24));
    const counts = screen.getAllByRole("tab").map((t) => t.querySelector("[data-slot=tab-count]")?.textContent);
    expect(counts).toEqual([run?.findings.length, run?.units.length, run?.launches.length, run?.conventions.length, run?.journal.length].map(String));
  });

  test("4 · live: a new run waits in the strip at the sidebar's end and is placed on click", async () => {
    const user = userEvent.setup();
    const app = open();
    renderShell(app.transport, { path: `/r/${keyOf(24)}` });
    await loaded();
    app.write(3, "logs/tick.log", "tick\n");
    await user.click(await within(sidebar()).findByRole("button", { name: "1 прогон сместился · показать" }));
    expect([...sidebar().querySelectorAll("[data-slot=run-card]")].map((c) => c.getAttribute("href"))).toContain("/r/shop/37d5a31e");
  });

  test("6 · lost connection (craft-4): one line at the shell's top with the data's time; nothing ages or regroups while lost; gone on reconnect", async () => {
    const app = open();
    const { setClock } = renderShell(app.transport, { path: `/r/${keyOf(24)}` });
    await loaded();
    const running = () => [...sidebar().querySelectorAll("[data-slot=run-card]")].map((c) => c.getAttribute("href"));
    const before = running();
    act(() => app.drop());
    const lost = await screen.findByRole("status", { name: "Нет связи с сервером fsloopUI · данные от 19:41 МСК" });
    // The shell's own line, in the sidebar's head beside the product: there in every frame of the page.
    expect(lost.closest("[data-slot=sidebar-head]")).not.toBeNull();
    // Forty minutes on the stream is still down: no card turns «молчит», nothing regroups, the page claims nothing
    // past the data's time.
    act(() => setClock(NOW + 40 * MIN));
    const card = within(sidebar()).getByRole("link", { name: /077e72d5/ });
    expect(card).toHaveAccessibleName("fsloop · 077e72d5 · нет связи");
    expect(card.querySelector("[data-slot=card-liveness] [data-slot=dot]")).toHaveAttribute("data-tone", "neutral");
    expect(running()).toEqual(before);
    expect(fact("Активность")).toBe("данные от 19:41 МСК · последняя запись 19:38 МСК");
    act(() => app.restore());
    await waitFor(() => expect(screen.queryByRole("status", { name: /Нет связи/ })).toBeNull());
    // Connected again, the shared clock speaks: forty minutes without a write is «молчит».
    expect(within(sidebar()).getByRole("link", { name: /077e72d5/ })).toHaveAccessibleName(/^fsloop · 077e72d5 · молчит · 4\d мин$/);
  });

  test("6 · craft-4 · the lost line stands in the frames without a run page too: not found", async () => {
    const app = open();
    renderShell(app.transport, { path: "/r/fsloop/deadbeef" });
    await screen.findByText(runNotFoundText("deadbeef", [app.root]));
    act(() => app.drop());
    expect(await within(sidebar()).findByRole("status", { name: /^Нет связи с сервером fsloopUI/ })).toBeInTheDocument();
  });

  test("5 · opening a view or another run pushes history; Back restores the run and the view", async () => {
    const user = userEvent.setup();
    const app = open();
    const { probe } = renderShell(app.transport, { path: `/r/${keyOf(24)}` });
    await loaded();
    await user.click(screen.getByRole("tab", { name: /Юниты/ }));
    expect(probe.location?.search).toBe("?view=units");
    expect(probe.type).toBe("PUSH");
    await user.click(within(sidebar()).getByRole("link", { name: /37d5a31e/ }));
    expect(probe.location?.pathname).toBe("/r/shop/37d5a31e");
    expect(probe.type).toBe("PUSH");
    await loaded();
    act(() => void probe.navigate?.(-1));
    await waitFor(() => expect(probe.location?.pathname).toBe("/r/fsloop/077e72d5"));
    expect(probe.location?.search).toBe("?view=units");
    expect(await screen.findByRole("tab", { name: /Юниты/ })).toHaveAttribute("aria-selected", "true");
  });

  test("7 · the open run's folder vanishes: the frame turns to not-found, the card stays marked until the strip is clicked; craft-23 · «1 прогон пропал · убрать»", async () => {
    const user = userEvent.setup();
    const app = open();
    renderShell(app.transport, { path: `/r/${keyOf(24)}` });
    await loaded();
    rmSync(app.dirOf(24), { recursive: true, force: true });
    app.pulse();
    expect(await screen.findByText(runNotFoundText("077e72d5", [app.root]))).toBeInTheDocument();
    const card = within(sidebar()).getByRole("link", { name: /077e72d5/ });
    expect(within(card).getByText("папки больше нет")).toBeInTheDocument();
    // craft-23 · a vanished card is no move: it is counted as leaving the list in the sidebar's own word — the list
    // has no filter — and the strip's verb is «убрать».
    await user.click(await within(sidebar()).findByRole("button", { name: "1 прогон пропал · убрать" }));
    expect(within(sidebar()).queryByRole("link", { name: /077e72d5/ })).toBeNull();
  });

  test("8 · a read error says what and why, with «Повторить»", async () => {
    const user = userEvent.setup();
    const app = open();
    app.answer((path) => (path.startsWith("/api/run?") ? Promise.resolve(json(500, { error: "нет доступа к run.json" })) : null));
    renderShell(app.transport, { path: `/r/${keyOf(24)}` });
    expect(await within(await screen.findByRole("region", { name: "Раздел прогона" })).findByText("Прогон 077e72d5 не прочитан: нет доступа к run.json")).toBeInTheDocument();
    expect(fact("Этап")).toBe("ревью · проход 1 из 2 · с 15:38 МСК");
    app.answer(null);
    await user.click(within(body()).getByRole("button", { name: "Повторить" }));
    await loaded();
  });

  test("9 · a folder without run.json opens: identity, «не записано» with a neutral dot, the views empty because not yet", async () => {
    const app = open();
    renderShell(app.transport, { path: `/r/${keyOf(7)}` });
    await loaded();
    expect(within(header()).getByRole("heading", { level: 1 })).toHaveTextContent("shop·5f63818a");
    expect(fact("Этап")).toBe("не записано: в папке нет run.json");
    expect(header().querySelector("dd [data-slot=dot]")).toHaveAttribute("data-tone", "neutral");
    expect(within(body()).getByText("Критики ещё не писали отчётов — находки появятся на этапе «карта»")).toBeInTheDocument();
  });

  test("10 · craft-1 · below the shell's one breakpoint: a low band of mini rows above a page that scrolls as one under a sticky tab strip", async () => {
    const app = open();
    const { container } = renderShell(app.transport, { path: `/r/${keyOf(24)}`, wide: false });
    await loaded();
    const shell = container.querySelector("[data-slot=shell]") as HTMLElement;
    // One column, the band first, below 980 px; the 316 px column beside the page above it.
    expect(shell).toHaveClass("grid", "grid-rows-[auto_minmax(0,1fr)]", "min-[980px]:grid-cols-[calc(var(--spacing)*79)_minmax(0,1fr)]", "min-[980px]:grid-rows-1");
    // p2-verdict craft-1 · the band's list is capped by its computed flex: 128 px, four whole rows (sidebar.test.tsx).
    await applyStylesheet();
    expect(usedBlockSize(sidebar().querySelector("[data-slot=sidebar-list]") as HTMLElement)).toBe(128);
    expect(sidebar().querySelectorAll("[data-slot=run-card]")).toHaveLength(0);
    expect(sidebar().querySelectorAll("[data-slot=mini-row]").length).toBeGreaterThan(0);
    expect(sidebar().compareDocumentPosition(screen.getByRole("main")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // The page is the one scroller, its gutter kept; the view takes the page's height under the strip, the header
    // (no cap of its own) scrolls away and the strip sticks.
    const main = screen.getByRole("main");
    expect(main).toHaveClass("overflow-y-auto", "max-[979px]:[scrollbar-gutter:stable]", "max-[979px]:[--view-flex:0_0_calc(100%_-_var(--spacing)*10)]");
    expect(body()).toHaveClass("[flex:var(--view-flex,1_1_0%)]");
    expect(header().className).not.toMatch(/max-h|overflow/);
    expect(screen.getByRole("tablist", { name: "Разделы прогона" })).toHaveClass("sticky", "top-0", "group-data-horizontal/tabs:h-10", "bg-background");
  });

  test("11 · no runs under the root: which root, and that a new run appears by itself", async () => {
    const app = open({ empty: true });
    renderShell(app.transport, { path: "/" });
    expect(await screen.findByText(emptyRootText([app.root]))).toBeInTheDocument();
    expect(within(sidebar()).getByText("Сейчас ни один прогон не идёт — новый появится здесь сам")).toBeInTheDocument();
  });
});
