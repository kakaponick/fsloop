// @vitest-environment jsdom
// The live store, fed by u1's handler over a fixture root (rules/ui → Live data 1, 3, 5).
import "../ui/test-setup.ts";
import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test } from "vitest";
import { writeRun } from "../../fixtures/make.ts";
import { fixtureApp, keyOf, MIN, NOW, renderShell, type FixtureApp } from "./testing.tsx";
import { join } from "node:path";

let fx: FixtureApp | null = null;
const open = () => (fx = fixtureApp({ only: [0, 3, 24] }));
afterEach(() => {
  fx?.close();
  fx = null;
});

const sidebar = () => screen.getByRole("complementary", { name: "Прогоны" });
const cardHrefs = () => [...sidebar().querySelectorAll("[data-slot=run-card]")].map((c) => c.getAttribute("href"));
const loaded = () => screen.findByRole("tab", { name: /Находки/ });
const UNITS_COMMITTED = "| unit | pass | state | tree | title |\n|---|---|---|---|---|\n| u1 | 1 | committed 1a2b3c4d | — | dialogs page |\n";

describe("the live store", () => {
  test("a change in a run folder updates its card in place: same node, same place, no strip", async () => {
    const app = open();
    renderShell(app.transport, { path: `/r/${keyOf(0)}` });
    await within(sidebar()).findByText("1 прогон идёт");
    const card = within(sidebar()).getByRole("link", { name: /077e72d5/ });
    expect(card.querySelector("[data-slot=card-units]")).toHaveTextContent("0 из 1 юнита закоммичено · 1 в работе");
    const order = cardHrefs();
    app.write(24, "units.md", UNITS_COMMITTED);
    await waitFor(() => expect(card.querySelector("[data-slot=card-units]")).toHaveTextContent("1 из 1 юнита закоммичен"));
    expect(within(sidebar()).getByRole("link", { name: /077e72d5/ })).toBe(card);
    expect(cardHrefs()).toEqual(order);
    expect(sidebar().querySelector("[data-slot=held-strip] button")).toBeNull();
  });

  test("new runs and a card whose group changed wait in the strip, and are placed on click", async () => {
    const user = userEvent.setup();
    const app = open();
    renderShell(app.transport, { path: `/r/${keyOf(0)}` });
    await within(sidebar()).findByText("1 прогон идёт");
    const runs = join(app.root, "shop", ".claude", "fsloop", "runs");
    for (const id of ["ne000001", "ne000002"]) writeRun(join(runs, id), { id, goal: `New run ${id}`, started: new Date(NOW - 2 * MIN).toISOString(), mtime: NOW - MIN, now: NOW, record: true });
    // The long-silent run writes again: it belongs to the running group now.
    app.write(3, "logs/tick.log", "tick\n");
    const strip = await within(sidebar()).findByRole("button", { name: "2 новых прогона · 1 прогон сместился · показать" });
    // Held: nothing is placed until the click.
    expect(cardHrefs()).toEqual(["/r/fsloop/077e72d5"]);
    expect(sidebar().querySelector('[data-slot=mini-row][href="/r/shop/37d5a31e"]')).not.toBeNull();
    await user.click(strip);
    // By start time, newest first: the two new runs (a tie, by key), the live run of 10:38, the one of 03:41.
    expect(cardHrefs()).toEqual(["/r/shop/ne000001", "/r/shop/ne000002", "/r/fsloop/077e72d5", "/r/shop/37d5a31e"]);
    expect(sidebar().querySelector('[data-slot=mini-row][href="/r/shop/37d5a31e"]')).toBeNull();
    expect(sidebar().querySelector("[data-slot=held-strip] button")).toBeNull();
    expect(within(sidebar()).getByText("4 прогона идут")).toBeInTheDocument();
  });

  test("the open run re-reads in place: the view keeps its node, the focus stays, no loading state comes back", async () => {
    const app = open();
    const { container } = renderShell(app.transport, { path: `/r/${keyOf(24)}` });
    await loaded();
    const journal = screen.getByRole("tab", { name: /Журнал/ });
    await waitFor(() => expect(journal.querySelector("[data-slot=tab-count]")).toHaveTextContent("1"));
    const view = screen.getByRole("region", { name: "Раздел прогона" });
    const content = view.firstElementChild;
    const tab = screen.getByRole("tab", { name: /Находки/ });
    act(() => tab.focus());
    let loadingSeen = false;
    const watch = new MutationObserver(() => {
      if (container.querySelector("[data-slot=run-header] ~ * [data-slot=loading]")) loadingSeen = true;
    });
    watch.observe(container, { childList: true, subtree: true });
    app.write(24, "journal.md", "| # | stage | question | decision | why | refs |\n|---|---|---|---|---|---|\n| 1 | p1-map | Route? | worktree | many pages | — |\n| 2 | p1-review | Fix? | yes | above the bar | — |\n");
    await waitFor(() => expect(journal.querySelector("[data-slot=tab-count]")).toHaveTextContent("2"));
    watch.disconnect();
    expect(loadingSeen).toBe(false);
    expect(screen.getByRole("region", { name: "Раздел прогона" })).toBe(view);
    expect(view.firstElementChild).toBe(content);
    expect(document.activeElement).toBe(tab);
  });

  test("a dropped stream shows the lost line with the data's time; on reconnect the list and the open run are read whole", async () => {
    const app = open();
    renderShell(app.transport, { path: `/r/${keyOf(24)}` });
    await loaded();
    act(() => app.drop());
    expect(await screen.findByText("Нет связи с сервером fsloopUI · данные от 19:41 МСК")).toBeInTheDocument();
    // Changed while the stream is down: nothing arrives.
    app.write(24, "units.md", UNITS_COMMITTED);
    const card = within(sidebar()).getByRole("link", { name: /077e72d5/ });
    expect(card.querySelector("[data-slot=card-units]")).toHaveTextContent("0 из 1 юнита закоммичено · 1 в работе");
    const before = app.requests.length;
    act(() => app.restore());
    await waitFor(() => expect(card.querySelector("[data-slot=card-units]")).toHaveTextContent("1 из 1 юнита закоммичен"));
    const after = app.requests.slice(before);
    expect(after).toContain("/api/runs");
    expect(after).toContain(`/api/run?run=${encodeURIComponent(keyOf(24))}`);
    expect(screen.queryByText(/Нет связи/)).toBeNull();
  });

  test("connected: neither the lost line nor any «live» mark", async () => {
    const app = open();
    const { container } = renderShell(app.transport, { path: `/r/${keyOf(24)}` });
    await loaded();
    expect(screen.queryByText(/Нет связи/)).toBeNull();
    expect(screen.queryByText(/live/i)).toBeNull();
    expect(container.querySelector(".animate-pulse")).toBeNull();
  });
});
