// @vitest-environment jsdom
// The reading pace of «Находки» (pass 2, f12): keys 1–4 set the verdict of the finding in focus and move on to the
// next one without a verdict (craft-review cand-4); «Свернуть все» closes every open detail from the toolbar's right
// cluster, its box held whether or not a row is open (u4-shape cand-1; rules/ui → Strict 1).
import "../../ui/test-setup.ts";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterAll, describe, expect, test } from "vitest";
import { criticReport, lines } from "../../../fixtures/make.ts";
import { readRun } from "../../../server/run.ts";
import { runPath } from "../../app/routes.ts";
import { COLLAPSE_ALL } from "@/finding/words.ts";
import { COLLAPSE_BLOCKED } from "./index.tsx";
import { findingsApp, keyOf, MIN, NOW, renderFindings } from "./testing.tsx";
import { VERDICT_KEYS } from "./verdict.tsx";

// The live fixture run of verdict.test.tsx, in a root of its own: 18 findings, one page.
const N = 24;
const KEY = keyOf(N);
const app = findingsApp([N]);
app.fx.write(N, "reports/p1-map-craft-schedules.md", criticReport({ lens: "craft assess", findings: Array.from({ length: 14 }, (_, k) => lines.craft(k + 1, "schedules", null)) }), NOW - MIN);
const TOTAL = readRun(app.fx.dirOf(N)).findings.length;
afterAll(() => app.close());

const bodyRows = () => [...document.querySelectorAll<HTMLTableRowElement>("tr[data-row-id]")];
const ids = () => bodyRows().map((r) => r.dataset.rowId as string);
const row = (id: string) => bodyRows().find((r) => r.dataset.rowId === id) as HTMLTableRowElement;
const detail = (id: string) => [...document.querySelectorAll<HTMLElement>("tr[data-detail-for]")].find((r) => r.dataset.detailFor === id);
const openIds = () => [...document.querySelectorAll<HTMLElement>("tr[data-detail-for]")].map((r) => r.dataset.detailFor);
const loaded = () => waitFor(() => expect(bodyRows()).toHaveLength(TOTAL), { timeout: 4000 });
const verdictCell = (id: string) => row(id).querySelector("td[data-col=verdict]") as HTMLElement;
const sentFor = (id: string) => app.sent.filter((b) => b.findings.includes(id));

describe("cand-1 (u4-shape), p2 craft-4: «Свернуть все»", () => {
  test("always shown in its 28 px box; blocked with its reason while no row is open — focusable, inert; closes every detail once one is", async () => {
    const user = userEvent.setup({ delay: null });
    const view = renderFindings(app, KEY, runPath(KEY, { view: "findings" }));
    await loaded();
    const item = view.container.querySelector("[data-toolbar-item=facts]") as HTMLElement;
    const button = item.querySelector("button") as HTMLButtonElement;
    expect(COLLAPSE_ALL).toBe("Свернуть все находки");
    expect(button).toHaveAttribute("aria-label", COLLAPSE_ALL);
    // nothing open: the button is in view, never `invisible` (ui → Blocked action), and says why it cannot run
    expect(button).toHaveClass("size-7");
    expect(button).not.toHaveClass("invisible");
    expect(button).toHaveAttribute("aria-disabled", "true");
    expect(button).not.toHaveAttribute("disabled");
    expect(button).not.toHaveAttribute("tabindex", "-1");
    expect(COLLAPSE_BLOCKED).toBe("Нет открытых строк — откройте строку");
    expect(COLLAPSE_BLOCKED.split(" ")).toHaveLength(6);
    fireEvent.focus(button);
    expect(await screen.findByRole("tooltip")).toHaveTextContent(new RegExp(`^${COLLAPSE_BLOCKED}$`));
    fireEvent.blur(button);
    const [a, b] = ids();
    await user.click(button);
    expect(openIds()).toEqual([]);
    await user.click(row(a).querySelector("td[data-col=summary]") as HTMLElement);
    await user.click(row(b).querySelector("td[data-col=summary]") as HTMLElement);
    expect(openIds()).toEqual([a, b]);
    // the same box, now an action: a click never moves what was clicked (Strict 1)
    expect(button).toHaveClass("size-7");
    expect(button).not.toHaveAttribute("aria-disabled");
    await user.click(button);
    expect(openIds()).toEqual([]);
    await waitFor(() => expect(new URLSearchParams(view.probe.location?.search).get("finding")).toBeNull());
    expect(button).toHaveAttribute("aria-disabled", "true");
    expect(button).not.toHaveClass("invisible");
    view.unmount();
  });
});

describe("cand-4 (craft review): verdict keys", () => {
  test("1–4 rate the finding in focus at once and move to the next one without a verdict; an open detail moves with it", async () => {
    const user = userEvent.setup({ delay: null });
    const view = renderFindings(app, KEY, runPath(KEY, { view: "findings" }));
    await loaded();
    expect(VERDICT_KEYS).toEqual(["Digit1", "Digit2", "Digit3", "Digit4"]);
    const [a, b, c, d] = ids();

    // a collapsed row: «4» rates it, focus goes to the next row
    row(b).focus();
    await user.keyboard("4");
    expect(verdictCell(b)).toHaveTextContent("ложная находка");
    await waitFor(() => expect(sentFor(b)).toEqual([{ run: KEY, findings: [b], verdict: "false-positive", note: null }]));
    expect(document.activeElement).toBe(row(c));

    // the next one without a verdict: «2» on the first row skips the row rated just now
    row(a).focus();
    await user.keyboard("2");
    expect(verdictCell(a)).toHaveTextContent("не согласен");
    expect(document.activeElement).toBe(row(c));

    // an open row: rated by its key, it closes and the next one without a verdict opens in its place
    await user.click(row(c).querySelector("td[data-col=summary]") as HTMLElement);
    expect(openIds()).toEqual([c]);
    expect(document.activeElement).toBe(row(c));
    await user.keyboard("1");
    expect(verdictCell(c)).toHaveTextContent("согласен");
    expect(openIds()).toEqual([d]);
    expect(document.activeElement).toBe(row(d));
    await waitFor(() => expect(new URLSearchParams(view.probe.location?.search).get("finding")).toBe(d));

    // focus inside the detail rates its finding; in the note a digit is text
    const toggle = within(detail(d) as HTMLElement).getByRole("radio", { name: "не та серьёзность" });
    fireEvent.focus(toggle);
    expect(await screen.findByRole("tooltip")).toHaveTextContent(/^Выбрать клавишами1234$/);    const note = within(detail(d) as HTMLElement).getByLabelText("Заметка к оценке");
    await user.click(note);
    await user.keyboard("3");
    expect(note).toHaveValue("3");
    expect(sentFor(d)).toEqual([]);
    view.unmount();
  });
});
