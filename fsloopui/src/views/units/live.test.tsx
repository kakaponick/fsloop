// @vitest-environment jsdom
// Done-criterion 3 (rules/ui → Live data 2–3, Conventions 9, 12): a live run over u1's handler — a unit whose state
// changes updates in place with the edge mark and never moves; new units wait in the strip «1 новый юнит ·
// показать»; open rows, focus and the rows' order survive; a link to a unit the filters hide shows it «вне фильтра».
import "../../ui/test-setup.ts";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { act, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterAll, describe, expect, test } from "vitest";
import { writePref } from "@/ui";
import { runKey as viewKey } from "../../table/view-state.ts";
import { runPath } from "../../app/routes.ts";
import { UNITS_TABLE } from "./query.ts";
import { fixtureApp, keyOf, renderUnits } from "./testing.tsx";

const N = 24; // a live run: one unit at work
const KEY = keyOf(N);
const path = runPath(KEY, { view: "units" });

const bodyRows = () => [...document.querySelectorAll<HTMLTableRowElement>("tr[data-row-id]")];
const ids = () => bodyRows().map((r) => r.dataset.rowId as string);
const row = (id: string) => bodyRows().find((r) => r.dataset.rowId === id) as HTMLTableRowElement;
// the table's own strip, under the table: an open detail holds strips of its own in its sections' heading lines
const strip = () => [...document.querySelectorAll<HTMLElement>("[data-slot=held-strip]")].find((s) => !s.closest("[data-slot=unit-detail]")) as HTMLElement;
const STATE = (id: string) => row(id).querySelector("td[data-col=state]") as HTMLElement;

/** A fresh fixture root per case: each case writes the run folder as fsloop would. */
function setup() {
  const fx = fixtureApp({ only: [N] });
  const file = join(fx.dirOf(N), "units.md");
  const units = () => readFileSync(file, "utf8");
  return { fx, units, writeUnits: (text: string) => fx.write(N, "units.md", text) };
}
const apps: { close: () => void }[] = [];
afterAll(() => apps.forEach((a) => a.close()));

describe("live updates of «Юниты»", () => {
  test("a state change updates the row in place with the edge mark; the open row and the focus survive; the order holds", async () => {
    const user = userEvent.setup({ delay: null });
    const { fx, units, writeUnits } = setup();
    apps.push(fx);
    renderUnits(fx, KEY, path);
    await waitFor(() => expect(bodyRows().length).toBeGreaterThan(0), { timeout: 4000 });
    expect(STATE("u1")).toHaveTextContent("пишется");
    expect(row("u1")).not.toHaveAttribute("data-edge");
    await user.click(row("u1").querySelector("td[data-col=title]") as HTMLElement);
    expect(document.querySelector('tr[data-detail-for="u1"]')).toBeTruthy();
    act(() => row("u1").focus());
    const order = ids();
    writeUnits(units().replace(/\| u1 \| 1 \| implement \|/, "| u1 | 1 | verify |"));
    await waitFor(() => expect(STATE("u1")).toHaveTextContent("проверяется"), { timeout: 4000 });
    expect(row("u1")).toHaveAttribute("data-edge");
    expect(row("u1")).toHaveClass("shadow-edge");
    expect(ids()).toEqual(order);
    expect(document.querySelector('tr[data-detail-for="u1"]')).toBeTruthy();
    expect(row("u1")).toHaveFocus();
    expect(strip()).toBeEmptyDOMElement();
  });

  test("craft-5: an open unit committed live keeps its detail's fact rows — what emptied reads «—» in place", async () => {
    const user = userEvent.setup({ delay: null });
    const { fx, units, writeUnits } = setup();
    apps.push(fx);
    renderUnits(fx, KEY, path);
    await waitFor(() => expect(bodyRows().length).toBeGreaterThan(0), { timeout: 4000 });
    const dts = () => [...(document.querySelector('tr[data-detail-for="u1"] [data-slot=fact-list]') as HTMLElement).querySelectorAll("dt")].map((d) => d.textContent);
    await user.click(row("u1").querySelector("td[data-col=title]") as HTMLElement);
    const opened = dts();
    expect(opened).toContain("Бриф юнита");
    writeUnits(units().replace(/\| u1 \| 1 \| implement \|/, "| u1 | 1 | committed c0ffee99 |"));
    await waitFor(() => expect(STATE("u1")).toHaveTextContent("закоммичен"), { timeout: 4000 });
    expect(dts()).toEqual(opened);
  });

  test("a new unit waits in the strip, «1 новый юнит · показать», and is placed on click", async () => {
    const user = userEvent.setup({ delay: null });
    const { fx, units, writeUnits } = setup();
    apps.push(fx);
    renderUnits(fx, KEY, path);
    await waitFor(() => expect(bodyRows().length).toBeGreaterThan(0), { timeout: 4000 });
    const order = ids();
    writeUnits(`${units().trimEnd()}\n| f1 | 1 | ready | — | fixes the review's findings |\n`);
    await waitFor(() => expect(strip()).toHaveTextContent("1 новый юнит · показать"), { timeout: 4000 });
    expect(ids()).toEqual(order);
    await user.click(within(strip()).getByRole("button", { name: /показать/ }));
    expect(ids()).toEqual([...order, "f1"]);
    expect(strip()).toBeEmptyDOMElement();
  });

  test("a link to a unit the filters hide shows it anyway, marked and «вне фильтра»", async () => {
    const { fx } = setup();
    apps.push(fx);
    writePref(viewKey(UNITS_TABLE, KEY), { filters: { state: ["committed"] }, search: "" });
    renderUnits(fx, KEY, runPath(KEY, { view: "units", unit: "u1" }));
    await waitFor(() => expect(row("u1")).toBeTruthy(), { timeout: 4000 });
    expect(within(row("u1")).getByText("вне фильтра")).toBeInTheDocument();
    expect(row("u1")).toHaveAttribute("data-target");
    expect(row("u1")).toHaveAttribute("aria-expanded", "true");
  });
});
