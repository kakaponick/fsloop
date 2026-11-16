// @vitest-environment jsdom
import "../ui/test-setup.ts";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { NOUNS } from "../../shared/text.ts";
import { UiProvider } from "../ui/provider.tsx";
import { DataTable, type DataTableProps, type TableColumn } from "./data-table.tsx";
import type { FilterDef, Preset, SearchDef } from "./query.ts";
import { copyAction, type RowAction } from "./row-menu.tsx";

interface F {
  id: string;
  severity: "critical" | "major" | "minor";
  status: "candidate" | "in-progress" | "fixed";
  report: string;
  units: string[];
  text: string;
}

const SEV = { critical: 0, major: 1, minor: 2 } as const;

/** 60 findings: i % 10 = 0 critical, else i % 3 = 0 major, else minor; status by i % 3. */
const make = (n: number, from = 0): F[] =>
  Array.from({ length: n }, (_, k) => {
    const i = k + from;
    return {
      id: `f-${String(i + 1).padStart(3, "0")}`,
      severity: i % 10 === 0 ? "critical" : i % 3 === 0 ? "major" : "minor",
      status: (["candidate", "in-progress", "fixed"] as const)[i % 3],
      report: `report-${i % 5}`,
      units: i % 4 === 0 ? [`u${(i % 8) + 1}`] : [],
      text: `Finding ${i + 1} breaks the rule of the row ${"long ".repeat(i % 7)}`.trim(),
    };
  });
const ROWS = make(60);

const COLUMNS: TableColumn<F>[] = [
  { id: "severity", label: "Серьёзность", width: 112, rank: (r) => SEV[r.severity], cell: (r) => r.severity, text: (r) => r.severity },
  { id: "id", label: "ID", width: 84, primary: true, rank: (r) => r.id, cell: (r, c) => c.hl(r.id), text: (r) => r.id },
  { id: "summary", label: "Находка", min: 240, cell: (r, c) => c.hl(r.text), text: (r) => r.text },
  { id: "report", label: "Отчёт", width: 160, resizable: true, min: 96, max: 360, rank: (r) => r.report, cell: (r) => r.report, text: (r) => r.report },
  { id: "state", label: "Состояние", width: 136, rank: (r) => r.status, cell: (r) => r.status, text: (r) => r.status },
  { id: "location", label: "Место", width: 200, hidden: true, cell: () => "src/x.tsx" },
];

const UNIT_OPTIONS = Array.from({ length: 8 }, (_, i) => ({ value: `u${i + 1}`, label: `u${i + 1}` }));
const FILTERS: FilterDef<F>[] = [
  { id: "severity", label: "Серьёзность", values: (r) => [r.severity], options: (["critical", "major", "minor"] as const).map((v) => ({ value: v, label: v })) },
  { id: "status", label: "Состояние", values: (r) => [r.status], options: (["candidate", "in-progress", "fixed"] as const).map((v) => ({ value: v, label: v })) },
  { id: "unit", label: "Юнит", values: (r) => r.units, options: UNIT_OPTIONS, placeholder: "Найти юнит" },
];
const PRESETS: Preset[] = [
  { id: "all", label: "Все", filters: {} },
  { id: "fix", label: "В исправление", filters: { status: ["in-progress", "fixed"] } },
  { id: "cand", label: "Кандидаты", filters: { status: ["candidate"] } },
];
const SEARCH: SearchDef<F> = { identifiers: (r) => [r.id, ...r.units], text: (r) => [r.text], placeholder: "Текст, id, юнит" };

const openReport = vi.fn();
const rate = vi.fn();
const ACTIONS: RowAction<F>[] = [
  copyAction<F>("copy-id", "id", (r) => r.id),
  { id: "report", label: "Открыть отчёт", scope: "single", group: 2, run: (rows) => openReport(rows.map((r) => r.id)) },
  { id: "rate", label: (rows) => `Оценить ${rows.length} находки…`, scope: "multi", group: 2, run: (rows) => rate(rows.map((r) => r.id)) },
];

const NOUN = { forms: NOUNS.finding, gender: "f" as const };

function view(p: Partial<DataTableProps<F>> = {}) {
  return (
    <DataTable<F>
      id="findings"
      runKey="tga/a098a7d4"
      label="Находки"
      rows={ROWS}
      rowId={(r) => r.id}
      rowTitle={(r) => `${r.id} ${r.text}`}
      noun={NOUN}
      columns={COLUMNS}
      filters={FILTERS}
      presets={PRESETS}
      search={SEARCH}
      actions={ACTIONS}
      detail={(r) => <p>Деталь {r.id}</p>}
      empty={{ form: "not-yet", step: "review" }}
      {...p}
    />
  );
}

/** Inside the provider every screen stands in; a rerender keeps it. */
const renderUi = (ui: ReactElement) => render(ui, { wrapper: UiProvider });
const wheel = (el: HTMLElement, deltaY: number, timeStamp: number) => {
  const event = new WheelEvent("wheel", { deltaY, bubbles: true, cancelable: true });
  Object.defineProperty(event, "timeStamp", { value: timeStamp });
  fireEvent(el, event);
};

const row = (id: string) => document.querySelector<HTMLTableRowElement>(`tr[data-row-id="${id}"]`) as HTMLTableRowElement;
const pageIds = () => [...document.querySelectorAll<HTMLTableRowElement>("tr[data-row-id]")].map((tr) => tr.dataset.rowId);
const stored = (key: string) => JSON.parse(window.localStorage.getItem(`fsloopui:${key}`) ?? "null");
const header = (name: string) => screen.getByRole("columnheader", { name: new RegExp(name) });

beforeEach(() => {
  openReport.mockReset();
  rate.mockReset();
});
afterEach(() => vi.restoreAllMocks());

describe("states (rules/ui → Tables 2, Strict 1–2; Conventions 14, 15)", () => {
  test("first load: «Загрузка…» with a spinner framed over the table's place; the strip's and the status bar's lines are already there", () => {
    const { rerender, container } = renderUi(view({ rows: null }));
    const loading = screen.getByRole("status");
    expect(loading).toHaveTextContent("Загрузка…");
    expect(loading).toHaveClass("size-full", "border", "rounded-lg");
    expect(container.querySelector("[data-slot=table-region]")).toContainElement(loading);
    expect(container.querySelector("[data-slot=skeleton]")).toBeNull();
    const bar = container.querySelector("[data-slot=status-bar]");
    const strip = container.querySelector("[data-slot=held-strip]");
    expect(bar).toHaveClass("h-8", "shrink-0");
    expect(strip).toHaveClass("h-strip", "shrink-0");
    // a select that shows its count keeps the box of its longest value with a three-digit count
    const preset = () => (container.querySelector('[data-toolbar-item="preset"]') as HTMLElement).style.minWidth;
    const severity = () => (container.querySelector('[data-toolbar-item="filter-severity"]') as HTMLElement).style.minWidth;
    // «Вид: В исправление», 18 characters: 19.8ch + the count's 3ch; «Серьёзность: critical», 21: 23.1ch + 3ch
    expect(preset()).toBe("calc(22.8ch + 2.75rem)");
    expect(severity()).toBe("calc(26.1ch + 2.75rem)");
    rerender(view());
    expect(preset()).toBe("calc(22.8ch + 2.75rem)");
    // the loaded table lands in the same boxes
    expect(container.querySelector("[data-slot=status-bar]")).toHaveClass("h-8");
    expect(screen.queryByText("Загрузка…")).toBeNull();
    expect(pageIds()).toHaveLength(50);
  });

  test("not yet: the stage that fills the table", () => {
    renderUi(view({ rows: [] }));
    expect(screen.getByText("Находок ещё нет — они появятся на этапе «ревью»")).toBeInTheDocument();
  });

  test("filtered to none: the active filters and «Сбросить фильтры»", async () => {
    const user = userEvent.setup();
    renderUi(view());
    await user.type(screen.getByRole("searchbox"), "zzz");
    expect(screen.getByText("Нет находок, подходящих под фильтры")).toBeInTheDocument();
    expect(screen.getByText("Фильтры: Поиск: «zzz»")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Сбросить фильтры" }));
    expect(pageIds()).toHaveLength(50);
    expect(screen.getByRole("searchbox")).toHaveValue("");
  });

  test("a part that failed: its message in the table's place, with «Повторить»", async () => {
    const retry = vi.fn();
    renderUi(view({ rows: null, failed: { what: "Список находок", cause: "run.json занят другим процессом", onRetry: retry } }));
    expect(screen.getByText("Список находок не прочитан: run.json занят другим процессом")).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: "Повторить" }));
    expect(retry).toHaveBeenCalledOnce();
  });

  test("late parts keep their box: the clear button, the key cap and the sort icons are laid out before they show", () => {
    const { container } = renderUi(view());
    expect(container.querySelector('[aria-label="Очистить поиск"]')).toHaveClass("invisible");
    expect(container.querySelector("[data-slot=table-search] kbd")?.parentElement).not.toHaveClass("invisible");
    for (const name of ["Серьёзность", "ID", "Отчёт", "Состояние"]) expect(within(header(name)).getByRole("button").querySelector("svg")).not.toBeNull();
    expect(container.querySelector("[data-slot=held-strip]")).toBeEmptyDOMElement();
  });
});

describe("columns (table #3, #10, #15; rules/ui → Tables 5)", () => {
  test("fixed widths reach head and cell through one colgroup; one column is width-free; the table's floor is their sum", () => {
    const { container } = renderUi(view());
    const cols = [...container.querySelectorAll("colgroup col")].map((c) => [(c as HTMLElement).dataset.col ?? "select", (c as HTMLElement).style.width]);
    expect(cols).toEqual([
      ["select", "32px"],
      ["severity", "112px"],
      ["id", "84px"],
      ["summary", ""],
      ["report", "160px"],
      ["state", "136px"],
    ]);
    expect(container.querySelector("table")).toHaveClass("table-fixed");
    expect((container.querySelector("table") as HTMLElement).style.minWidth).toBe(`${32 + 112 + 84 + 240 + 160 + 136}px`);
  });

  test("a cell is one line, truncated, its full text in its title", () => {
    renderUi(view());
    const cell = within(row("f-007")).getByText(/^Finding 7/).closest("div") as HTMLElement;
    expect(cell).toHaveClass("truncate");
    expect(cell).toHaveAttribute("title", ROWS[6].text);
  });

  test("a resizable column: the handle is always there, nudged by keyboard, clamped, kept per table, reset by a double click", async () => {
    const user = userEvent.setup();
    const { container } = renderUi(view());
    const handle = screen.getByRole("separator", { name: "Ширина столбца «Отчёт»" });
    expect(screen.getAllByRole("separator")).toHaveLength(1);
    expect(handle.firstElementChild).toHaveClass("w-px", "bg-border");
    handle.focus();
    await user.keyboard("{ArrowRight}");
    expect(handle).toHaveAttribute("aria-valuenow", "176");
    expect(stored("table:findings").widths).toEqual({ report: 176 });
    expect((container.querySelector('col[data-col="report"]') as HTMLElement).style.width).toBe("176px");
    for (let i = 0; i < 20; i++) await user.keyboard("{ArrowRight}");
    expect(handle).toHaveAttribute("aria-valuenow", "360");
    await user.dblClick(handle);
    expect(handle).toHaveAttribute("aria-valuenow", "160");
    expect(stored("table:findings").widths).toEqual({});
  });

  test("a drag on the handle resizes and does not sort", () => {
    renderUi(view());
    const handle = screen.getByRole("separator", { name: "Ширина столбца «Отчёт»" });
    fireEvent.pointerDown(handle, { clientX: 100, button: 0 });
    act(() => {
      window.dispatchEvent(new MouseEvent("pointermove", { clientX: 140 }));
    });
    expect(handle).toHaveAttribute("aria-valuenow", "200");
    act(() => {
      window.dispatchEvent(new MouseEvent("pointerup"));
    });
    expect(stored("table:findings").widths).toEqual({ report: 200 });
    expect(header("Отчёт")).toHaveAttribute("aria-sort", "none");
  });

  test("the columns menu shows, hides, reorders by keyboard, switches the page split, and resets only when something differs", async () => {
    const user = userEvent.setup();
    renderUi(view());
    await user.click(screen.getByRole("button", { name: "Столбцы" }));
    const menu = await screen.findByRole("dialog");
    expect(within(menu).queryByRole("button", { name: "Сбросить столбцы и страницы" })).toBeNull();
    expect(within(menu).getByText("всегда виден")).toBeInTheDocument();
    await user.click(within(menu).getByRole("checkbox", { name: "Состояние" }));
    expect(screen.queryByRole("columnheader", { name: /Состояние/ })).toBeNull();
    await user.click(within(menu).getByRole("checkbox", { name: "Место" }));
    expect(header("Место")).toBeInTheDocument();
    within(menu).getByRole("checkbox", { name: "Серьёзность" }).focus();
    await user.keyboard("{Alt>}{ArrowDown}{/Alt}");
    const heads = screen.getAllByRole("columnheader").map((h) => h.textContent);
    expect(heads.slice(1, 3)).toEqual(["ID", "Серьёзность"]);
    await user.click(within(menu).getByRole("switch", { name: "Делить строки на страницы" }));
    expect(pageIds()).toHaveLength(60);
    expect(screen.queryByRole("navigation", { name: "Страницы" })).toBeNull();
    await user.click(within(menu).getByRole("button", { name: "Сбросить столбцы и страницы" }));
    expect(screen.getAllByRole("columnheader").map((h) => h.textContent)).toEqual(["", "Серьёзность", "ID", "Находка", "Отчёт", "Состояние"]);
    expect(pageIds()).toHaveLength(50);
  });
});

describe("sort (table #2)", () => {
  test("a header sorts descending first, then flips; its state shows and persists per table", async () => {
    const user = userEvent.setup();
    const { unmount } = renderUi(view());
    await user.click(screen.getByRole("button", { name: "Сортировать: ID" }));
    expect(header("ID")).toHaveAttribute("aria-sort", "descending");
    expect(pageIds()[0]).toBe("f-060");
    await user.click(screen.getByRole("button", { name: "Сортировать: ID" }));
    expect(header("ID")).toHaveAttribute("aria-sort", "ascending");
    await user.click(screen.getByRole("button", { name: "Сортировать: Серьёзность" }));
    expect(header("Серьёзность")).toHaveAttribute("aria-sort", "descending");
    expect(header("ID")).toHaveAttribute("aria-sort", "none");
    expect(stored("table:findings").sort).toEqual({ id: "severity", desc: true });
    unmount();
    renderUi(view());
    expect(header("Серьёзность")).toHaveAttribute("aria-sort", "descending");
  });
});

describe("selection (table #5; the design check)", () => {
  test("a checkbox, a Shift range, Ctrl on a row; never a plain click", async () => {
    const user = userEvent.setup();
    renderUi(view());
    const box = (id: string) => within(row(id)).getByRole("checkbox");
    await user.click(box("f-001"));
    await user.keyboard("{Shift>}");
    await user.click(box("f-004"));
    await user.keyboard("{/Shift}");
    expect(["f-001", "f-002", "f-003", "f-004"].every((id) => row(id).dataset.state === "selected")).toBe(true);
    expect(row("f-005").dataset.state).toBeUndefined();
    await user.keyboard("{Control>}");
    await user.click(within(row("f-006")).getByText("f-006"));
    await user.keyboard("{/Control}");
    expect(row("f-006").dataset.state).toBe("selected");
    await user.click(within(row("f-008")).getByText("f-008"));
    expect(row("f-008").dataset.state).toBeUndefined();
    expect(screen.getByRole("checkbox", { name: "Выбрать все строки по фильтрам" })).toHaveAttribute("aria-checked", "mixed");
  });

  test("drag over the checkbox column selects the rows it crosses", () => {
    renderUi(view());
    const cell = (id: string) => within(row(id)).getByRole("checkbox").closest("td") as HTMLElement;
    fireEvent.pointerDown(cell("f-002"), { button: 0 });
    fireEvent.pointerEnter(cell("f-003"));
    fireEvent.pointerEnter(cell("f-005"));
    act(() => {
      window.dispatchEvent(new MouseEvent("pointerup"));
    });
    fireEvent.pointerEnter(cell("f-007"));
    expect(pageIds().filter((id) => row(id as string).dataset.state === "selected")).toEqual(["f-002", "f-003", "f-004", "f-005"]);
  });

  test("select all takes the filtered set across pages; a search clears the selection", async () => {
    const user = userEvent.setup();
    renderUi(view());
    await user.click(screen.getByRole("checkbox", { name: "Выбрать все строки по фильтрам" }));
    expect(screen.getByRole("checkbox", { name: "Выбрать все строки по фильтрам" })).toHaveAttribute("aria-checked", "true");
    fireEvent.contextMenu(row("f-002"));
    expect(within(await screen.findByRole("menu")).getByText("60 находок")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    await user.type(screen.getByRole("searchbox"), "f-00");
    expect(screen.getByRole("checkbox", { name: "Выбрать все строки по фильтрам" })).toHaveAttribute("aria-checked", "false");
  });
});

describe("the row menu and the pin (table #4, #13; rules/ui → Tables 4)", () => {
  test("one row: its title in the header and the single items; the row it opened on is marked", async () => {
    renderUi(view());
    fireEvent.contextMenu(row("f-002"));
    const menu = await screen.findByRole("menu");
    expect(within(menu).getByText(`f-002 ${ROWS[1].text}`)).toBeInTheDocument();
    expect(within(menu).getAllByRole("menuitem").map((i) => i.textContent)).toEqual(["ОткрытьEnter", "Скопировать id", "Открыть отчёт", "Действие по клику"]);
    expect(row("f-002")).toHaveAttribute("data-menu");
  });

  test("a selection: the count in the header, the multi items, every selected row the table knows", async () => {
    const user = userEvent.setup();
    const { rerender } = renderUi(view());
    for (const id of ["f-001", "f-002", "f-003"]) await user.click(within(row(id)).getByRole("checkbox"));
    fireEvent.contextMenu(row("f-002"));
    let menu = await screen.findByRole("menu");
    expect(within(menu).getByText("3 находки")).toBeInTheDocument();
    expect(within(menu).getAllByRole("menuitem").map((i) => i.textContent)).toEqual(["Скопировать id", "Оценить 3 находки…", "Действие по клику"]);
    await user.click(within(menu).getByRole("menuitem", { name: "Оценить 3 находки…" }));
    expect(rate).toHaveBeenCalledWith(["f-001", "f-002", "f-003"]);
    // a selected row the data no longer holds degrades the header
    rerender(view({ rows: ROWS.filter((r) => r.id !== "f-001") }));
    fireEvent.contextMenu(row("f-002"));
    menu = await screen.findByRole("menu");
    expect(within(menu).getByText("2 из 3 находок")).toBeInTheDocument();
  });

  test("a left click and Enter run the pinned item; the default pin is «Открыть»; another pin is kept in the browser", async () => {
    const user = userEvent.setup();
    const { unmount } = renderUi(view());
    await user.click(within(row("f-001")).getByText("f-001"));
    expect(row("f-001")).toHaveAttribute("aria-expanded", "true");
    fireEvent.contextMenu(row("f-003"));
    const menu = await screen.findByRole("menu");
    within(menu).getByRole("menuitem", { name: "Действие по клику" }).focus();
    await user.keyboard("{ArrowRight}");
    await user.click(await screen.findByRole("menuitemradio", { name: "Открыть отчёт" }));
    expect(stored("table:findings").pin).toBe("report");
    unmount();
    renderUi(view());
    await user.click(within(row("f-004")).getByText("f-004"));
    expect(openReport).toHaveBeenCalledWith(["f-004"]);
    row("f-005").focus();
    await user.keyboard("{Enter}");
    expect(openReport).toHaveBeenLastCalledWith(["f-005"]);
    expect(row("f-004")).toHaveAttribute("aria-expanded", "false");
  });
});

describe("rows expand in place (rules/ui → Tables 3, Live data 3)", () => {
  test("under the row across the table's width, several open at once, reported for the URL, kept through a refresh", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    const { rerender } = renderUi(view({ onOpenChange }));
    await user.click(within(row("f-001")).getByText("f-001"));
    await user.click(within(row("f-003")).getByText("f-003"));
    expect(onOpenChange).toHaveBeenLastCalledWith(["f-001", "f-003"]);
    const detail = document.querySelector('tr[data-detail-for="f-001"]') as HTMLElement;
    expect(detail.previousElementSibling).toBe(row("f-001"));
    expect(detail.querySelector("td")).toHaveAttribute("colspan", "6");
    rerender(view({ onOpenChange, rows: ROWS.map((r) => ({ ...r })) }));
    expect(screen.getByText("Деталь f-001")).toBeInTheDocument();
    expect(screen.getByText("Деталь f-003")).toBeInTheDocument();
  });
});

describe("keyboard (ui → Keyboard; rules/ui → Conventions 11)", () => {
  test("↑/↓ move the row focus, Enter runs the pin, Space selects, ←/→ page, `/` focuses the search", async () => {
    const user = userEvent.setup();
    renderUi(view());
    expect(row("f-001")).toHaveAttribute("tabindex", "0");
    expect(row("f-002")).toHaveAttribute("tabindex", "-1");
    row("f-001").focus();
    await user.keyboard("{ArrowDown}{ArrowDown}{ArrowUp}");
    expect(row("f-002")).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(row("f-002")).toHaveAttribute("aria-expanded", "true");
    await user.keyboard(" ");
    expect(row("f-002").dataset.state).toBe("selected");
    await user.keyboard("{ArrowRight}");
    expect(pageIds()[0]).toBe("f-051");
    await waitFor(() => expect(row("f-051")).toHaveFocus());
    await user.keyboard("{ArrowLeft}");
    expect(pageIds()[0]).toBe("f-001");
    (document.activeElement as HTMLElement).blur();
    // the shortcut binds the physical key: «/» in the English layout, «.» in the Russian one
    fireEvent.keyDown(document.body, { code: "Slash", key: "." });
    expect(screen.getByRole("searchbox")).toHaveFocus();
  });

  test("the wheel pages past the list's edge, one page per gesture", () => {
    const { container } = renderUi(view());
    const scroll = container.querySelector("[data-slot=table-scroll]") as HTMLElement;
    wheel(scroll, 120, 1000);
    expect(pageIds()[0]).toBe("f-051");
    wheel(scroll, 120, 1050);
    wheel(scroll, -120, 1100);
    expect(pageIds()[0]).toBe("f-051");
    wheel(scroll, -120, 2000);
    expect(pageIds()[0]).toBe("f-001");
  });
});

describe("the adaptive toolbar (table #11, #12, #14; rules/ui → Conventions 16)", () => {
  test("in order: «Вид», search, filters, the columns menu", () => {
    const { container } = renderUi(view());
    expect([...container.querySelectorAll<HTMLElement>("[data-toolbar-item]")].map((el) => el.dataset.toolbarItem)).toEqual(["preset", "search", "filter-severity", "filter-status", "filter-unit", "columns"]);
    expect(screen.getByRole("combobox", { name: "Вид" })).toHaveTextContent("Вид:Все60");
    expect(screen.getByRole("searchbox")).toHaveAttribute("placeholder", "Текст, id, юнит");
  });

  test("«Вид» replaces the filters and keeps the search; a filter changed by hand reads «Свой набор»", async () => {
    const user = userEvent.setup();
    renderUi(view());
    await user.type(screen.getByRole("searchbox"), "row");
    screen.getByRole("combobox", { name: "Вид" }).focus();
    await user.keyboard("{Enter}");
    expect((await screen.findAllByRole("option")).map((o) => o.textContent)).toEqual(["Все60", "В исправление40", "Кандидаты20"]);
    await user.keyboard("{ArrowDown}{ArrowDown}{Enter}");
    await waitFor(() => expect(screen.getByRole("combobox", { name: "Вид" })).toHaveTextContent("Вид:Кандидаты20"));
    expect(screen.getByRole("searchbox")).toHaveValue("row");
    expect(screen.getByRole("combobox", { name: "Состояние" })).toHaveTextContent("candidate");
    screen.getByRole("combobox", { name: "Серьёзность" }).focus();
    await user.keyboard("{Enter}");
    // counts over the set without the severity filter: candidates are i % 3 = 0 — critical where i % 30 = 0 (0, 30), the other 18 major
    expect((await screen.findAllByRole("option")).map((o) => o.textContent)).toEqual(["все20", "critical2", "major18", "minor0"]);
    await user.keyboard("{ArrowDown}{ArrowDown}{Enter}");
    await waitFor(() => expect(screen.getByRole("combobox", { name: "Вид" })).toHaveTextContent("Вид:Свой набор"));
    expect(pageIds()).toHaveLength(18);
  });

  test("a filter over more than six values is a combobox of several values", async () => {
    const user = userEvent.setup();
    renderUi(view());
    const unit = screen.getByRole("combobox", { name: "Юнит: все" });
    unit.focus();
    await user.keyboard("{Enter}");
    await screen.findByPlaceholderText("Найти юнит");
    // u1 is carried by i = 0, 8, 16, …, 56: 8 rows
    expect(screen.getAllByRole("option")[0]).toHaveTextContent("u18");
    await user.keyboard("{Enter}");
    expect(screen.getByRole("combobox", { name: "Юнит: u1" })).toBeInTheDocument();
    expect(pageIds()).toHaveLength(8);
  });

  test("search with history: a committed term is kept per table and chosen again", async () => {
    const user = userEvent.setup();
    const { unmount } = renderUi(view());
    await user.type(screen.getByRole("searchbox"), "f-01{Enter}");
    expect(pageIds()).toEqual(["f-010", "f-011", "f-012", "f-013", "f-014", "f-015", "f-016", "f-017", "f-018", "f-019"]);
    expect(within(row("f-010")).getByText("f-01", { selector: "mark" })).toBeInTheDocument();
    expect(stored("table:findings").history).toEqual(["f-01"]);
    unmount();
    renderUi(view({ runKey: "tga/other" }));
    expect(screen.getByRole("searchbox")).toHaveValue("");
    await user.click(screen.getByRole("button", { name: "Недавние запросы" }));
    await user.click(await screen.findByRole("menuitem", { name: "f-01" }));
    expect(screen.getByRole("searchbox")).toHaveValue("f-01");
  });

  test("the last filters fold into «…» as the toolbar narrows; a folded filter with a value marks «…»", async () => {
    const callbacks: (() => void)[] = [];
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(cb: () => void) {
          callbacks.push(cb);
        }
        observe() {}
        disconnect() {}
      },
    );
    let width = 900;
    const WIDTHS: Record<string, number> = { preset: 110, search: 192, "filter-severity": 150, "filter-status": 150, "filter-unit": 110, columns: 28 };
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
      const w = this.dataset.slot === "adaptive-toolbar" ? width : (WIDTHS[this.dataset.toolbarItem ?? ""] ?? 0);
      return { width: w, height: 28, x: 0, y: 0, top: 0, left: 0, right: w, bottom: 28, toJSON: () => ({}) } as DOMRect;
    });
    window.localStorage.setItem("fsloopui:table:findings:run:tga/a098a7d4", JSON.stringify({ filters: { unit: ["u2"] }, search: "" }));
    const { container } = renderUi(view());
    const items = () => [...container.querySelectorAll<HTMLElement>("[data-toolbar-item]")].map((el) => el.dataset.toolbarItem);
    act(() => callbacks.forEach((cb) => cb()));
    expect(items()).toHaveLength(6);
    expect(container.querySelector("[data-slot=toolbar-overflow]")).toBeNull();
    // 740 of items + 5 gaps = 780; at 700 the unit filter folds
    width = 700;
    act(() => callbacks.forEach((cb) => cb()));
    expect(items()).toEqual(["preset", "search", "filter-severity", "filter-status", "columns"]);
    const more = container.querySelector("[data-slot=toolbar-overflow]") as HTMLElement;
    expect(more).toHaveAccessibleName("Ещё фильтры: есть выбранные");
    await userEvent.setup().click(more);
    expect(within(await screen.findByRole("group", { name: "Ещё фильтры" })).getByRole("combobox", { name: "Юнит: u2" })).toBeInTheDocument();
  });
});

describe("the status bar (table #8; the design check)", () => {
  test("pagination with a page size, «<shown> из <total noun>» through the plural, the data's age with its МСК time", async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();
    const { container } = renderUi(view({ onPageChange, updatedAt: "2026-11-16T04:00:00Z", now: "2026-11-16T04:05:00Z" }));
    const bar = container.querySelector("[data-slot=status-bar]") as HTMLElement;
    expect(within(bar).getByText("60 находок")).toBeInTheDocument();
    expect(within(bar).getByRole("navigation", { name: "Страницы" })).toHaveTextContent("стр. 1 из 2");
    expect(within(bar).getByRole("combobox", { name: "Строк" })).toHaveTextContent("Строк:50");
    expect(within(bar).getByText("обновлено 5 мин назад")).toHaveAttribute("title", "16.11.2026 07:00 МСК");
    await user.click(within(bar).getByRole("button", { name: "Следующая страница" }));
    expect(onPageChange).toHaveBeenLastCalledWith(2);
    expect(pageIds()).toHaveLength(10);
    await user.type(screen.getByRole("searchbox"), "f-00");
    expect(within(bar).getByText("9 из 60 находок")).toBeInTheDocument();
    expect(onPageChange).toHaveBeenLastCalledWith(1);
  });

  test("no split: the counts strip takes the pager's slot", () => {
    renderUi(view({ defaultPaged: false, counts: (rows) => <span>{rows.length} в счёте</span> }));
    expect(screen.queryByRole("navigation", { name: "Страницы" })).toBeNull();
    expect(screen.getByText("60 в счёте")).toBeInTheDocument();
    expect(pageIds()).toHaveLength(60);
  });
});

describe("view state (table #7; rules/ui → Tables 4, Conventions 12)", () => {
  test("filters and search per table and run, sort and page size per table; restored on return; never in the URL", async () => {
    const user = userEvent.setup();
    const url = window.location.href;
    const { unmount } = renderUi(view());
    await user.type(screen.getByRole("searchbox"), "row");
    await user.click(screen.getByRole("button", { name: "Сортировать: Отчёт" }));
    screen.getByRole("combobox", { name: "Состояние" }).focus();
    await user.keyboard("{Enter}");
    await screen.findAllByRole("option");
    await user.keyboard("{ArrowDown}{Enter}");
    await waitFor(() => expect(screen.getByRole("combobox", { name: "Состояние" })).toHaveTextContent("candidate"));
    expect(stored("table:findings:run:tga/a098a7d4")).toEqual({ filters: { status: ["candidate"] }, search: "row" });
    expect(window.location.href).toBe(url);
    unmount();
    const again = renderUi(view());
    expect(screen.getByRole("searchbox")).toHaveValue("row");
    expect(screen.getByRole("combobox", { name: "Состояние" })).toHaveTextContent("candidate");
    expect(header("Отчёт")).toHaveAttribute("aria-sort", "descending");
    again.unmount();
    renderUi(view({ runKey: "tga/other" }));
    expect(screen.getByRole("searchbox")).toHaveValue("");
    expect(header("Отчёт")).toHaveAttribute("aria-sort", "descending");
  });

  test("the page comes from the caller's URL and changes are reported back", () => {
    const onPageChange = vi.fn();
    const { rerender } = renderUi(view({ page: 2, onPageChange }));
    expect(pageIds()[0]).toBe("f-051");
    rerender(view({ page: 1, onPageChange }));
    expect(pageIds()[0]).toBe("f-001");
    expect(onPageChange).toHaveBeenCalledWith(1);
  });
});

describe("live data (rules/ui → Live data 2–3; Conventions 12)", () => {
  test("a row the new data takes out of the filter stays marked «вне фильтра»; new rows wait in the strip; the click places them", async () => {
    const user = userEvent.setup();
    window.localStorage.setItem("fsloopui:table:findings:run:tga/a098a7d4", JSON.stringify({ filters: { severity: ["critical"] }, search: "" }));
    const { rerender, container } = renderUi(view());
    expect(pageIds()).toEqual(["f-001", "f-011", "f-021", "f-031", "f-041", "f-051"]);
    row("f-021").focus();
    // f-011 is no longer critical; f-061 arrives critical
    const next = [...ROWS.map((r) => (r.id === "f-011" ? { ...r, severity: "minor" as const } : r)), { ...make(1, 60)[0], severity: "critical" as const }];
    rerender(view({ rows: next }));
    expect(pageIds()).toEqual(["f-001", "f-011", "f-021", "f-031", "f-041", "f-051"]);
    expect(within(row("f-011")).getByText("вне фильтра")).toBeInTheDocument();
    expect(row("f-021")).toHaveFocus();
    const strip = container.querySelector("[data-slot=held-strip]") as HTMLElement;
    expect(within(strip).getByRole("button")).toHaveAccessibleName("1 новая находка · 1 находка вне фильтра · обновить список");
    expect(within(container.querySelector("[data-slot=status-bar]") as HTMLElement).getByText("6 из 61 находки")).toBeInTheDocument();
    await user.click(within(strip).getByRole("button"));
    expect(pageIds()).toEqual(["f-001", "f-021", "f-031", "f-041", "f-051", "f-061"]);
    expect(strip).toBeEmptyDOMElement();
  });

  test("a row asked for by id shows even when filtered out, marked, on its page", () => {
    window.localStorage.setItem("fsloopui:table:findings:run:tga/a098a7d4", JSON.stringify({ filters: { severity: ["minor"] }, search: "" }));
    const onPageChange = vi.fn();
    renderUi(view({ target: "f-061", rows: [...ROWS, { ...make(1, 60)[0], severity: "critical" as const }], onPageChange }));
    // minor rows: 36 of 60, the target after them in the data's order → page 1 of 50
    expect(row("f-061")).toHaveAttribute("data-target");
    expect(within(row("f-061")).getByText("вне фильтра")).toBeInTheDocument();
    expect(row("f-061")).toHaveClass("shadow-target");
  });

  test("a target on a later page opens that page and reports it", () => {
    const onPageChange = vi.fn();
    renderUi(view({ target: "f-055", onPageChange }));
    expect(pageIds()).toContain("f-055");
    expect(onPageChange).toHaveBeenCalledWith(2);
  });
});
