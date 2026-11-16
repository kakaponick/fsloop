import { describe, expect, test } from "vitest";
import { assertLayout, clampWidth, fitsRegion, FRAME, headerWidth, mergeWidths, moveColumn, placeColumns, sameColumns, tableMinWidth, toggleColumn, type ColumnLayout } from "./columns.ts";
import { pack } from "./pack.ts";

const COLS: ColumnLayout[] = [
  { id: "severity", label: "Серьёзность", width: 112 },
  { id: "id", label: "ID", width: 84, primary: true },
  { id: "summary", label: "Находка", min: 240 },
  { id: "report", label: "Отчёт", width: 160, resizable: true, min: 96, max: 360 },
  { id: "state", label: "Состояние", width: 136 },
  { id: "verdict", label: "Оценка", width: 128 },
  { id: "location", label: "Место", width: 200, resizable: true, hidden: true },
];

const order = (state: Parameters<typeof placeColumns>[1]) => placeColumns(COLS, state).map((p) => `${p.column.id}${p.visible ? "" : "-"}`);

describe("placement (table #3)", () => {
  test("the default is the markup order with the default-hidden columns hidden", () => {
    expect(order(null)).toEqual(["severity", "id", "summary", "report", "state", "verdict", "location-"]);
  });

  test("a stored order keeps known ids, drops gone ones and puts a new column after its markup predecessor", () => {
    expect(order({ order: ["summary", "gone", "id", "severity", "state", "verdict"], hidden: ["verdict"] })).toEqual(["summary", "report", "id", "severity", "state", "verdict-", "location-"]);
  });

  test("hide, show and move; the primary column never hides", () => {
    const hidden = toggleColumn(COLS, null, "state", false);
    expect(order(hidden)).toEqual(["severity", "id", "summary", "report", "state-", "verdict", "location-"]);
    expect(order(toggleColumn(COLS, hidden, "location", true))).toEqual(["severity", "id", "summary", "report", "state-", "verdict", "location"]);
    expect(order(toggleColumn(COLS, null, "id", false))).toEqual(order(null));
    expect(order(moveColumn(COLS, null, "verdict", -2))).toEqual(["severity", "id", "summary", "verdict", "report", "state", "location-"]);
    expect(order(moveColumn(COLS, null, "severity", -1))).toEqual(order(null));
    expect(order(moveColumn(COLS, null, "severity", { before: "state" }))).toEqual(["id", "summary", "report", "severity", "state", "verdict", "location-"]);
  });

  test("whether the placement differs from the defaults", () => {
    expect(sameColumns(COLS, null)).toBe(true);
    expect(sameColumns(COLS, toggleColumn(COLS, null, "state", false))).toBe(false);
    expect(sameColumns(COLS, toggleColumn(COLS, toggleColumn(COLS, null, "state", false), "state", true))).toBe(true);
  });
});

describe("widths (table #10, #15)", () => {
  test("exactly one width-free column; a resizable one has a width", () => {
    expect(() => assertLayout(COLS)).not.toThrow();
    expect(() => assertLayout([...COLS, { id: "x", label: "X" }])).toThrow(/2 width-free columns/);
    expect(() => assertLayout(COLS.map((c) => ({ ...c, width: c.width ?? 100 })))).toThrow(/0 width-free/);
    expect(() => assertLayout([{ id: "a", label: "A", primary: true }, { id: "b", label: "B", resizable: true }])).toThrow(/2 width-free/);
  });

  test("a stored width is clamped to its bounds and taken only by a resizable column", () => {
    const report = COLS[3];
    expect(clampWidth(report, 40)).toBe(96);
    expect(clampWidth(report, 9999)).toBe(360);
    expect(mergeWidths(COLS, { report: 9999, severity: 300, location: 250.4, gone: 10 })).toEqual({ severity: 112, id: 84, report: 360, state: 136, verdict: 128, location: 250 });
    expect(mergeWidths(COLS, null).report).toBe(160);
  });

  test("the table's minimum width sums the selection column, the fixed widths and the free column's floor", () => {
    const visible = placeColumns(COLS, null)
      .filter((p) => p.visible)
      .map((p) => p.column);
    expect(tableMinWidth(visible, mergeWidths(COLS, null))).toBe(32 + 112 + 84 + 240 + 160 + 136 + 128);
  });

  test("a header clears its label at the header size plus the sort icon", () => {
    expect(headerWidth("ID")).toBe(50);
    expect(headerWidth("Серьёзность")).toBe(109);
    expect(headerWidth("Запуски", { sortable: false })).toBe(63);
    for (const c of COLS) if (c.width !== undefined) expect(headerWidth(c.label), c.id).toBeLessThanOrEqual(c.width);
  });
});

describe("the production shape (surfaces/findings.md, surfaces/units.md → RANGES)", () => {
  // 1280 px beside the 316 px sidebar leaves a 964 px region
  const REGION = 1280 - 316;

  test("the findings budget fits the 964 px region without a horizontal scroll, and wider", () => {
    const visible = COLS.filter((c) => !c.hidden);
    expect(tableMinWidth(visible, mergeWidths(COLS, null)) + FRAME).toBe(910);
    expect(fitsRegion(visible, mergeWidths(COLS, null), REGION)).toBe(true);
    expect(fitsRegion(visible, mergeWidths(COLS, null), 1440 - 316)).toBe(true);
    // showing «Место» (200 px) costs the region its fit: the table scrolls sideways in its own box
    expect(fitsRegion(COLS, mergeWidths(COLS, null), REGION)).toBe(false);
  });

  test("the units budget fits the same region", () => {
    const units: ColumnLayout[] = [
      { id: "id", label: "Юнит", width: 64, primary: true },
      { id: "pass", label: "Проход", width: 76 },
      { id: "state", label: "Состояние", width: 176 },
      { id: "title", label: "Что делает", min: 200 },
      { id: "sha", label: "Коммит", width: 96 },
      { id: "major", label: "major+", width: 80 },
      { id: "minor", label: "minor", width: 72 },
      { id: "launches", label: "Запуски", width: 88 },
    ];
    expect(() => assertLayout(units)).not.toThrow();
    for (const c of units) if (c.width !== undefined) expect(headerWidth(c.label), c.id).toBeLessThanOrEqual(c.width);
    expect(tableMinWidth(units, mergeWidths(units, null)) + FRAME).toBe(902);
    expect(fitsRegion(units, mergeWidths(units, null), REGION)).toBe(true);
  });
});

describe("the toolbar's packing (table #14)", () => {
  const items = [
    { id: "preset", width: 120, kind: "sticky" as const },
    { id: "search", width: 192, kind: "pinned" as const },
    { id: "severity", width: 150, kind: "ordinary" as const },
    { id: "state", width: 140, kind: "ordinary" as const },
    { id: "report", width: 130, kind: "ordinary" as const },
    { id: "columns", width: 28, kind: "pinned" as const },
  ];
  const opts = { gap: 8, overflow: 28 };
  // all six: 760 + 5 gaps = 800

  test("everything shows when it fits", () => {
    expect(pack(items, 800, opts)).toEqual([]);
  });

  test("ordinary items fold right to left, the «…» trigger taking its room", () => {
    // without report: 630 + 28 + 5 gaps (5 visible + «…») = 698
    expect(pack(items, 799, opts)).toEqual(["report"]);
    expect(pack(items, 698, opts)).toEqual(["report"]);
    expect(pack(items, 697, opts)).toEqual(["state", "report"]);
  });

  test("sticky items fold after every ordinary one; pinned ones never", () => {
    // preset, search, columns and «…»: 368 + 3 gaps = 392
    expect(pack(items, 392, opts)).toEqual(["severity", "state", "report"]);
    expect(pack(items, 391, opts)).toEqual(["preset", "severity", "state", "report"]);
    expect(pack(items, 10, opts)).toEqual(["preset", "severity", "state", "report"]);
  });
});
