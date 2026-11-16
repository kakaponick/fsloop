// @vitest-environment jsdom
// gap 3 (f13, f14; code → No duplication): the finding rows that expand in place outside «Находки» — a report's in
// «Отчёты», a unit's in «Юниты» — are one shared part, in f14's form: one Tab stop over the rows' chevrons, ↑/↓ move,
// Enter opens and closes, the id's link the mouse's; an open row holds «Открыть в находках» and the shared article.
import "../ui/test-setup.ts";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterAll, describe, expect, test } from "vitest";
import { readRun } from "../../server/run.ts";
import { UiProvider } from "../ui/provider.tsx";
import { runPath } from "../app/routes.ts";
import { fixtureApp, keyOf, NOW } from "../app/testing.tsx";
import { ExpandingFindings } from "./expanding.tsx";
import { findingToggle, OPEN_IN_FINDINGS } from "./words.ts";

const N = 40;
const KEY = keyOf(N);
const fx = fixtureApp({ only: [N] });
afterAll(() => fx.close());
const run = { ...readRun(fx.dirOf(N)), key: KEY };
const five = run.findings.slice(0, 5);

const show = (items: Parameters<typeof ExpandingFindings>[0]["items"], ruled = true) =>
  render(
    <MemoryRouter>
      <UiProvider>
        <ExpandingFindings run={run} items={items} label="Находки отчёта" now={NOW} slot="report-findings" ruled={ruled} />
      </UiProvider>
    </MemoryRouter>,
  );

describe("gap 3: the shared expanding finding rows", () => {
  test("the words: «Развернуть находку <id>» / «Свернуть находку <id>», «Открыть в находках»", () => {
    expect(findingToggle("craft-3", false)).toBe("Развернуть находку craft-3");
    expect(findingToggle("craft-3", true)).toBe("Свернуть находку craft-3");
    expect(OPEN_IN_FINDINGS).toBe("Открыть в находках");
  });

  test("one Tab stop — the first row's chevron; the id links leave the Tab order; ↑/↓ move, Enter opens and closes in place", async () => {
    const user = userEvent.setup({ delay: null });
    const { container } = show(five);
    const list = container.querySelector("[data-slot=report-findings]") as HTMLElement;
    const toggles = within(list).getAllByRole("button", { name: /^Развернуть находку / });
    expect(toggles).toHaveLength(5);
    const stops = [...list.querySelectorAll<HTMLElement>("a, button, [tabindex]")].filter((el) => el.tabIndex >= 0);
    expect(stops).toEqual([toggles[0]]);
    for (const t of toggles) expect(t).not.toHaveAttribute("aria-controls");
    toggles[0].focus();
    await user.keyboard("{ArrowDown}{ArrowDown}{Enter}");
    expect(toggles[2]).toHaveFocus();
    expect(toggles[2]).toHaveAttribute("aria-expanded", "true");
    expect(toggles[2]).toHaveAccessibleName(findingToggle(five[2].local, true));
    const panel = document.getElementById(toggles[2].getAttribute("aria-controls") as string) as HTMLElement;
    expect(panel).toHaveAttribute("data-slot", "finding-detail");
    // the detail opens under its row, never above it
    expect(panel.closest("li")).toBe(toggles[2].closest("li"));
    expect(within(panel).getByRole("link", { name: OPEN_IN_FINDINGS })).toHaveAttribute("href", runPath(KEY, { view: "findings", finding: five[2].id }));
    expect(panel.querySelectorAll("[data-slot=finding-article]")).toHaveLength(1);
    await user.keyboard("{Enter}");
    expect(toggles[2]).toHaveAttribute("aria-expanded", "false");
    expect(toggles[2]).not.toHaveAttribute("aria-controls");
  });

  test("a click on a row's own text opens it, several stay open; a link inside keeps its own action", async () => {
    const user = userEvent.setup({ delay: null });
    const { container } = show(five);
    const lines = [...container.querySelectorAll<HTMLElement>("[data-slot=finding-line]")];
    await user.click(lines[0].querySelector("[data-slot=finding-row] > span:nth-child(3)") as HTMLElement);
    await user.click(lines[1].querySelector("[data-slot=finding-row] > span:nth-child(3)") as HTMLElement);
    expect(container.querySelectorAll("[data-slot=finding-article]")).toHaveLength(2);
    expect(lines[0]).toHaveAttribute("data-state", "open");
  });

  test("an id the run does not hold reads «не найдена» in the row's place — no chevron, no stop", () => {
    const { container } = show([five[0], "p9-review-critic-code#code-99"]);
    const missing = container.querySelector("li[data-finding='p9-review-critic-code#code-99']") as HTMLElement;
    expect(missing).toHaveTextContent("находка p9-review-critic-code#code-99 не найдена");
    // the row's own 32 px line, aligned past the chevrons' column (Strict 1)
    expect(missing.firstElementChild).toHaveClass("h-8", "pl-7");
    expect(within(missing).queryByRole("button")).toBeNull();
    expect(screen.getAllByRole("button", { name: /^Развернуть находку / })).toHaveLength(1);
  });

  test("ruled — a hairline between rows, a hover and an open ground (a report's list); plain — none (a unit's detail, already on muted ground)", () => {
    const ruled = show(five);
    expect(ruled.container.querySelector("[data-slot=report-findings]")).toHaveClass("border-t");
    expect(ruled.container.querySelector("[data-slot=report-findings] > li")).toHaveClass("border-b");
    expect(ruled.container.querySelector("[data-slot=finding-line]")).toHaveClass("hover:bg-muted", "data-[state=open]:bg-muted/40");
    ruled.unmount();
    const plain = show(five, false);
    expect(plain.container.querySelector("[data-slot=report-findings]")).not.toHaveClass("border-t");
    expect(plain.container.querySelector("[data-slot=report-findings] > li")).not.toHaveClass("border-b");
    expect(plain.container.querySelector("[data-slot=finding-line]")).not.toHaveClass("hover:bg-muted");
    // the row's box is one fixed line either way
    for (const r of plain.container.querySelectorAll("[data-slot=finding-row]")) expect(r).toHaveClass("h-8");
  });

  test("p2-verdict-critic-craft-verdict#craft-6: plain, the row's hover and the chevron's hover and open ground step off the muted ground — ink over it, never muted on muted", async () => {
    const user = userEvent.setup();
    const plain = show(five, false);
    const line = plain.container.querySelector("[data-slot=finding-line]") as HTMLElement;
    expect(line).toHaveClass("hover:bg-foreground/4");
    const chevron = within(line).getByRole("button", { name: `Развернуть находку ${five[0].local}` });
    expect(chevron).toHaveClass("hover:bg-foreground/8", "dark:hover:bg-foreground/8", "aria-expanded:bg-foreground/8");
    // the ghost button's own grounds are the detail's own muted: they would show nothing there
    for (const muted of ["hover:bg-muted", "aria-expanded:bg-muted", "dark:hover:bg-muted/50"]) expect(chevron).not.toHaveClass(muted);
    await user.click(chevron);
    expect(chevron).toHaveAttribute("aria-expanded", "true");
    plain.unmount();
    // ruled, on the page's paper, the ghost's muted ground shows, and stays
    const ruled = show(five);
    expect(within(ruled.container.querySelector("[data-slot=finding-line]") as HTMLElement).getByRole("button", { name: `Развернуть находку ${five[0].local}` })).toHaveClass("hover:bg-muted");
  });
});
