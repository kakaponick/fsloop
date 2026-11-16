// @vitest-environment jsdom
// Done-criterion 1 (rules/ui → Conventions 6; ux 6): the user's verdict from the detail and from «Оценить…» on a
// selection of 12 with one note — shown at once, written to human.jsonl through u1's handler, kept on a re-read; a
// failing write reverts the rows, keeps the note and raises «Оценка не сохранилась» with «Повторить»; a later
// verdict replaces the earlier one.
import "../../ui/test-setup.ts";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterAll, describe, expect, test } from "vitest";
import { criticReport, lines } from "../../../fixtures/make.ts";
import { readRun } from "../../../server/run.ts";
import { runPath } from "../../app/routes.ts";
import { verdictLine, verdictTitle, VERDICT_PROMPT, SAVE_FAILED, failedCause } from "@/finding";
import { findingsApp, keyOf, MIN, NOW, renderFindings } from "./testing.tsx";

// A live fixture run whose second critic of the map reported 14 findings: one page holds every row, and a
// selection of 12 fits it (the 723-finding run is view.test.tsx's).
const N = 24;
const KEY = keyOf(N);
const app = findingsApp([N]);
app.fx.write(N, "reports/p1-map-craft-schedules.md", criticReport({ lens: "craft assess", findings: Array.from({ length: 14 }, (_, k) => lines.craft(k + 1, "schedules", null)) }), NOW - MIN);
const TOTAL = readRun(app.fx.dirOf(N)).findings.length;
afterAll(() => app.close());

const AT = new Date(NOW).toISOString();
const bodyRows = () => [...document.querySelectorAll<HTMLTableRowElement>("tr[data-row-id]")];
const row = (id: string) => bodyRows().find((r) => r.dataset.rowId === id) as HTMLTableRowElement;
const detail = (id: string) => [...document.querySelectorAll<HTMLElement>("tr[data-detail-for]")].find((r) => r.dataset.detailFor === id) as HTMLElement;
const loaded = () => waitFor(() => expect(bodyRows()).toHaveLength(TOTAL), { timeout: 4000 });
/** Writes a note as one paste: the field, not the keystrokes, is under test. */
const writeNote = async (user: ReturnType<typeof userEvent.setup>, scope: HTMLElement, text: string) => {
  await user.click(within(scope).getByLabelText("Заметка к оценке"));
  await user.paste(text);
};
const verdictCell = (id: string) => row(id).querySelector("td[data-col=verdict]") as HTMLElement;
const linesOf = (id: string) => app.human(N).filter((l) => l.finding === id);

describe("the verdict's words", () => {
  test("the saved line, the dialog's title, the failure's cause", () => {
    expect(verdictLine({ verdict: "agree", at: AT }, NOW)).toBe("Ваша оценка: согласен · 19:41 МСК");
    expect(verdictLine({ verdict: "wrong-severity", at: "2026-11-15T20:00:00Z" }, NOW)).toBe("Ваша оценка: не та серьёзность · 15.11 23:00 МСК");
    expect(verdictLine({ verdict: "false-positive", at: null }, NOW)).toBe("Ваша оценка: ложная находка");
    expect(verdictTitle(Array.from({ length: 12 }, (_, i) => `f${i}`))).toBe("Оценка для 12 находок");
    expect(verdictTitle(Array.from({ length: 21 }, (_, i) => `f${i}`))).toBe("Оценка для 21 находки");
    expect(verdictTitle(["p1-review-critic-craft#craft-12"])).toBe("Оценка находки p1-review-critic-craft#craft-12");
    expect(failedCause("Оценка не сохранилась: EACCES: permission denied")).toBe("EACCES: permission denied");
    expect(failedCause("")).toBe("сервер не ответил");
    expect(VERDICT_PROMPT.split(" ")).toHaveLength(12);
    expect(TOTAL).toBe(18);
  });
});

describe("setting a verdict over u1's handler", () => {
  test("from the detail: shown at once, one line in human.jsonl, kept on a re-read; its line's box is reserved", async () => {
    const user = userEvent.setup({ delay: null });
    const view = renderFindings(app, KEY, runPath(KEY, { view: "findings" }));
    await loaded();
    const id = bodyRows()[0].dataset.rowId as string;
    await user.click(row(id).querySelector("td[data-col=summary]") as HTMLElement);
    const line = detail(id).querySelector("[data-slot=verdict-line]") as HTMLElement;
    expect(line).toHaveTextContent(VERDICT_PROMPT);
    expect(line).toHaveClass("h-5", "truncate");
    await writeNote(user, detail(id), "верно, проверил");
    await user.click(within(detail(id)).getByRole("radio", { name: "согласен" }));
    // at once, before the write returns
    expect(detail(id).querySelector("[data-slot=verdict-line]")).toHaveTextContent("Ваша оценка: согласен · 19:41 МСК");
    expect(detail(id).querySelector("[data-slot=verdict-line]")).toBe(line);
    expect(line).toHaveClass("h-5");
    expect(verdictCell(id)).toHaveTextContent("согласен");
    await waitFor(() => expect(linesOf(id)).toEqual([{ finding: id, verdict: "agree", note: "верно, проверил", at: AT }]));
    view.unmount();

    // a re-read: the run comes from the server again, the link opens the finding with its verdict and note
    renderFindings(app, KEY, runPath(KEY, { view: "findings", finding: id }));
    await loaded();
    await waitFor(() => expect(detail(id)).toBeTruthy());
    expect(detail(id).querySelector("[data-slot=verdict-line]")).toHaveTextContent("Ваша оценка: согласен · 19:41 МСК");
    expect(within(detail(id)).getByLabelText("Заметка к оценке")).toHaveValue("верно, проверил");
    expect(within(detail(id)).getByRole("radio", { name: "согласен" })).toHaveAttribute("data-state", "on");
  });

  test("«Оценить…» on a selection of 12 with one note: 12 rows at once, 12 lines, kept on a re-read", async () => {
    const user = userEvent.setup({ delay: null });
    const view = renderFindings(app, KEY, runPath(KEY, { view: "findings" }));
    await loaded();
    const twelve = bodyRows()
      .slice(2, 14)
      .map((r) => r.dataset.rowId as string);
    // the first, then Shift on the twelfth: the range between them
    await user.click(within(row(twelve[0])).getByRole("checkbox"));
    await user.keyboard("{Shift>}");
    await user.click(within(row(twelve[11])).getByRole("checkbox"));
    await user.keyboard("{/Shift}");
    fireEvent.contextMenu(row(twelve[3]));
    const menu = await screen.findByRole("menu");
    expect(within(menu).getByText("12 находок")).toBeInTheDocument();
    await user.click(within(menu).getByRole("menuitem", { name: "Оценить…" }));
    const dialog = await screen.findByRole("dialog", { name: "Оценка для 12 находок" });
    expect(within(dialog).getByLabelText("Заметка к оценке")).toHaveFocus();
    await writeNote(user, dialog, "один повод на всех");
    await user.click(within(dialog).getByRole("radio", { name: "не согласен" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    for (const id of twelve) expect(verdictCell(id)).toHaveTextContent("не согласен");
    await waitFor(() => expect(app.human(N).filter((l) => l.note === "один повод на всех")).toHaveLength(12));
    expect(new Set(app.human(N).filter((l) => l.note === "один повод на всех").map((l) => l.finding))).toEqual(new Set(twelve));
    expect(app.sent.at(-1)).toMatchObject({ run: KEY, verdict: "disagree", note: "один повод на всех" });
    expect(new Set(app.sent.at(-1)?.findings)).toEqual(new Set(twelve));
    // the live store re-reads the run: every one of the 12 carries the verdict from the run folder itself
    await waitFor(() => {
      const s = view.store.getSnapshot().runs[KEY];
      expect(s?.status === "ready" ? s.run.findings.filter((f) => f.verdict?.note === "один повод на всех").map((f) => f.id) : []).toHaveLength(12);
    });
    for (const id of twelve) expect(verdictCell(id)).toHaveTextContent("не согласен");
  });

  test("a failing write reverts the row, keeps the note, and «Повторить» on the toast writes it", async () => {
    const user = userEvent.setup({ delay: null });
    renderFindings(app, KEY, runPath(KEY, { view: "findings" }));
    await loaded();
    const id = bodyRows()[16].dataset.rowId as string;
    expect(verdictCell(id)).toHaveTextContent("—");
    await user.click(row(id).querySelector("td[data-col=summary]") as HTMLElement);
    app.fail("Оценка не сохранилась: EACCES: permission denied, open 'human.jsonl'");
    await writeNote(user, detail(id), "ложная: место другое");
    await user.click(within(detail(id)).getByRole("radio", { name: "ложная находка" }));
    const toast = (await screen.findByText(SAVE_FAILED)).closest("[data-sonner-toast]") as HTMLElement;
    expect(toast).toHaveTextContent("EACCES: permission denied, open 'human.jsonl'");
    expect(verdictCell(id)).toHaveTextContent("—");
    expect(detail(id).querySelector("[data-slot=verdict-line]")).toHaveTextContent(VERDICT_PROMPT);
    expect(within(detail(id)).getByLabelText("Заметка к оценке")).toHaveValue("ложная: место другое");
    expect(linesOf(id)).toEqual([]);
    app.fail(null);
    await user.click(within(toast).getByRole("button", { name: "Повторить" }));
    expect(verdictCell(id)).toHaveTextContent("ложная находка");
    await waitFor(() => expect(linesOf(id)).toEqual([{ finding: id, verdict: "false-positive", note: "ложная: место другое", at: AT }]));
  });

  test("a later verdict replaces the earlier one; both stay in human.jsonl", async () => {
    const user = userEvent.setup({ delay: null });
    const view = renderFindings(app, KEY, runPath(KEY, { view: "findings" }));
    await loaded();
    const id = bodyRows()[17].dataset.rowId as string;
    await user.click(row(id).querySelector("td[data-col=summary]") as HTMLElement);
    await user.click(within(detail(id)).getByRole("radio", { name: "согласен" }));
    await waitFor(() => expect(linesOf(id)).toHaveLength(1));
    await user.click(within(detail(id)).getByRole("radio", { name: "не та серьёзность" }));
    expect(detail(id).querySelector("[data-slot=verdict-line]")).toHaveTextContent("Ваша оценка: не та серьёзность · 19:41 МСК");
    await waitFor(() => expect(linesOf(id).map((l) => l.verdict)).toEqual(["agree", "wrong-severity"]));
    await waitFor(() => {
      const s = view.store.getSnapshot().runs[KEY];
      expect(s?.status === "ready" ? s.run.findings.find((f) => f.id === id)?.verdict?.verdict : null).toBe("wrong-severity");
    });
    expect(verdictCell(id)).toHaveTextContent("не та серьёзность");
  });
});
