import { describe, expect, test } from "vitest";
import { ALL_ROWS, hitRanges, nextSort, pageOf, pageOfIndex, presetOf, runQuery, tokens, type FilterDef, type Preset, type QueryState, type SearchDef, type SortColumn } from "./query.ts";

interface Row {
  id: string;
  severity: "critical" | "major" | "minor" | null;
  status: string;
  units: string[];
  report: string;
  location: string | null;
  text: string;
}

const SEV_RANK = { critical: 0, major: 1, minor: 2 } as const;

const ROWS: Row[] = [
  { id: "p1-review-critic-craft#craft-1", severity: "major", status: "candidate", units: [], report: "craft · findings", location: "src/finding/row.tsx:12", text: "The row wraps its summary onto two lines" },
  { id: "p1-review-critic-craft#craft-2", severity: "critical", status: "fixed", units: ["u3"], report: "craft · findings", location: "src/table/query.ts:40", text: "Paging drops the last row of the set" },
  { id: "p1-review-critic-ux#ux-1", severity: "minor", status: "candidate", units: [], report: "ux · shell", location: null, text: "The sidebar card hides the run's goal" },
  { id: "p1-review-critic-ux#ux-2", severity: "major", status: "in-progress", units: ["u3", "u5"], report: "ux · shell", location: "src/app/Shell.tsx:8", text: "A live update moves the row under the pointer" },
  { id: "p1-review-critic-audit#audit-1", severity: null, status: "undecided", units: ["u5"], report: "audit · units", location: "src/units/row.tsx", text: "Contrast of the muted label is below the floor" },
  { id: "p1-review-critic-audit#audit-2", severity: "major", status: "candidate", units: [], report: "audit · units", location: null, text: "The row menu has no header naming the row" },
];

const COLUMNS: SortColumn<Row>[] = [
  { id: "severity", rank: (r) => (r.severity ? SEV_RANK[r.severity] : null) },
  { id: "id", rank: (r) => r.id },
  { id: "report", rank: (r) => r.report },
];

const FILTERS: FilterDef<Row>[] = [
  { id: "severity", label: "Серьёзность", values: (r) => [r.severity ?? "none"], options: [] },
  { id: "status", label: "Состояние", values: (r) => [r.status], options: [] },
  { id: "unit", label: "Юнит", values: (r) => r.units, options: [] },
];

const SEARCH: SearchDef<Row> = {
  identifiers: (r) => [r.id, r.location, ...r.units],
  text: (r) => [r.text, r.report],
  placeholder: "Текст, файл, id, юнит",
};

const state = (s: Partial<QueryState> = {}): QueryState => ({ sort: null, filters: {}, search: "", ...s });
const run = (s: Partial<QueryState> = {}, include?: Set<string>) => runQuery({ rows: ROWS, rowId: (r) => r.id, columns: COLUMNS, filters: FILTERS, search: SEARCH, state: state(s), include });
const ids = (rows: Row[]) => rows.map((r) => r.id.split("#")[1]);

describe("sort", () => {
  test("by the column's rank, ascending and descending, ties in the data's order, an absent rank last both ways", () => {
    expect(ids(run({ sort: { id: "severity", desc: false } }).rows)).toEqual(["craft-2", "craft-1", "ux-2", "audit-2", "ux-1", "audit-1"]);
    expect(ids(run({ sort: { id: "severity", desc: true } }).rows)).toEqual(["ux-1", "craft-1", "ux-2", "audit-2", "craft-2", "audit-1"]);
  });

  test("strings sort by the Russian collation with numbers in order", () => {
    expect(ids(run({ sort: { id: "id", desc: false } }).rows)).toEqual(["audit-1", "audit-2", "craft-1", "craft-2", "ux-1", "ux-2"]);
  });

  test("a click on the same header flips, another header starts descending (table #2)", () => {
    expect(nextSort(null, "id")).toEqual({ id: "id", desc: true });
    expect(nextSort({ id: "id", desc: true }, "id")).toEqual({ id: "id", desc: false });
    expect(nextSort({ id: "id", desc: false }, "id")).toEqual({ id: "id", desc: true });
    expect(nextSort({ id: "id", desc: false }, "report")).toEqual({ id: "report", desc: true });
  });

  test("an unknown sort column keeps the data's order", () => {
    expect(ids(run({ sort: { id: "gone", desc: true } }).rows)).toEqual(["craft-1", "craft-2", "ux-1", "ux-2", "audit-1", "audit-2"]);
  });
});

describe("filters", () => {
  test("filters combine: AND across filters, OR within one", () => {
    expect(ids(run({ filters: { severity: ["major"], status: ["candidate"] } }).rows)).toEqual(["craft-1", "audit-2"]);
    expect(ids(run({ filters: { severity: ["major", "critical"] } }).rows)).toEqual(["craft-1", "craft-2", "ux-2", "audit-2"]);
    expect(ids(run({ filters: { unit: ["u5"] } }).rows)).toEqual(["ux-2", "audit-1"]);
  });

  test("an empty choice is «все»", () => {
    expect(run({ filters: { severity: [] } }).rows).toHaveLength(6);
  });

  test("every option is counted over the set without its own filter", () => {
    const r = run({ filters: { severity: ["major"], status: ["candidate"] } });
    // severity counts: rows with status candidate → craft-1 major, ux-1 minor, audit-2 major
    expect(r.counts.severity).toEqual({ "": 3, major: 2, minor: 1 });
    // status counts: rows with severity major → craft-1 candidate, ux-2 in-progress, audit-2 candidate
    expect(r.counts.status).toEqual({ "": 3, candidate: 2, "in-progress": 1 });
    // unit counts: rows passing both → craft-1 and audit-2, neither carries a unit
    expect(r.counts.unit).toEqual({ "": 2 });
    expect(r.matched).toBe(2);
    expect(r.total).toBe(6);
  });

  test("a row carrying several values counts once per value", () => {
    expect(run().counts.unit).toEqual({ "": 6, u3: 2, u5: 2 });
  });

  test("counts follow the search", () => {
    expect(run({ search: "row" }).counts.severity).toEqual({ "": 5, major: 3, critical: 1, none: 1 });
  });

  test("a preset is matched by its filters whatever their order, else «Свой набор» (null)", () => {
    const presets: Preset[] = [
      { id: "all", label: "Все", filters: {} },
      { id: "fix", label: "В исправление", filters: { status: ["in-progress", "fixed"] } },
    ];
    expect(presetOf({}, presets)?.id).toBe("all");
    expect(presetOf({ severity: [] }, presets)?.id).toBe("all");
    expect(presetOf({ status: ["fixed", "in-progress"] }, presets)?.id).toBe("fix");
    expect(presetOf({ status: ["fixed"] }, presets)).toBeNull();
    const r = runQuery({ rows: ROWS, rowId: (x) => x.id, columns: COLUMNS, filters: FILTERS, search: SEARCH, state: state({ search: "row" }), presets });
    expect(r.presetCounts).toEqual({ all: 5, fix: 2 });
  });
});

describe("search (table #12)", () => {
  test("the term splits into lower-cased tokens on spaces, commas and semicolons, each once", () => {
    expect(tokens("  U3, craft-1;  Row row ")).toEqual(["u3", "craft-1", "row"]);
    expect(tokens("")).toEqual([]);
  });

  test("identifier tokens are OR-matched: a pasted column of ids is a search", () => {
    expect(ids(run({ search: "craft-1\naudit-2\nux-1" }).rows)).toEqual(["craft-1", "ux-1", "audit-2"]);
  });

  test("free-text tokens are AND-matched, each in any free-text field", () => {
    expect(ids(run({ search: "update pointer" }).rows)).toEqual(["ux-2"]);
    expect(ids(run({ search: "update shell" }).rows)).toEqual(["ux-2"]);
    expect(run({ search: "update banana" }).rows).toEqual([]);
  });

  test("a row passes either test: an id token or all the text tokens", () => {
    // «u5» is an identifier of ux-2 and audit-1; «contrast» is text of audit-1 only — the row passes by either
    expect(ids(run({ search: "u5 contrast" }).rows)).toEqual(["ux-2", "audit-1"]);
    expect(ids(run({ search: "query.ts" }).rows)).toEqual(["craft-2"]);
  });

  test("hits are found for highlighting, merged and in order", () => {
    expect(hitRanges("The row menu has no header naming the row", ["row", "he"])).toEqual([
      [1, 3],
      [4, 7],
      [20, 22],
      [35, 37],
      [38, 41],
    ]);
    expect(hitRanges("abc", [])).toEqual([]);
  });
});

describe("a row asked for by id", () => {
  test("shows even when the filters hide it, marked outside, in its sorted place", () => {
    const r = run({ filters: { severity: ["critical"] }, sort: { id: "id", desc: false } }, new Set(["p1-review-critic-ux#ux-1"]));
    expect(ids(r.rows)).toEqual(["craft-2", "ux-1"]);
    expect([...r.outside]).toEqual(["p1-review-critic-ux#ux-1"]);
    expect(r.matched).toBe(1);
  });

  test("a row that passes is not marked", () => {
    expect(run({}, new Set(["p1-review-critic-ux#ux-1"])).outside.size).toBe(0);
  });
});

describe("paging", () => {
  const list = Array.from({ length: 723 }, (_, i) => i);

  test("723 rows at 50 a page are 15 pages; every row once, in order", () => {
    const seen: number[] = [];
    for (let p = 1; p <= 15; p++) seen.push(...pageOf(list, p, 50).rows);
    expect(seen).toEqual(list);
    expect(pageOf(list, 1, 50).pageCount).toBe(15);
    expect(pageOf(list, 15, 50)).toMatchObject({ page: 15, from: 701, to: 723 });
    expect(pageOf(list, 15, 50).rows).toHaveLength(23);
  });

  test("a page past the end clamps to the last, before the first to the first", () => {
    expect(pageOf(list, 99, 50).page).toBe(15);
    expect(pageOf(list, 0, 50).page).toBe(1);
  });

  test("«все» and no split are one page of everything; an empty list is one empty page", () => {
    expect(pageOf(list, 3, ALL_ROWS)).toMatchObject({ page: 1, pageCount: 1, from: 1, to: 723 });
    expect(pageOf(list.slice(0, 42), 1, null).rows).toHaveLength(42);
    expect(pageOf([], 1, 50)).toEqual({ rows: [], page: 1, pageCount: 1, from: 0, to: 0 });
  });

  test("the page of an index", () => {
    expect(pageOfIndex(0, 50)).toBe(1);
    expect(pageOfIndex(49, 50)).toBe(1);
    expect(pageOfIndex(50, 50)).toBe(2);
    expect(pageOfIndex(722, 50)).toBe(15);
    expect(pageOfIndex(722, ALL_ROWS)).toBe(1);
  });
});

describe("volume: 723 rows × 8 columns", () => {
  interface Big {
    id: string;
    severity: number | null;
    status: string;
    report: string;
    units: string[];
    location: string;
    text: string;
    verdict: string;
  }
  const STATUSES = ["candidate", "in-progress", "fixed"];
  const big: Big[] = Array.from({ length: 723 }, (_, i) => ({
    id: `p1-review-critic-${["craft", "ux", "audit"][i % 3]}#f-${i}`,
    severity: i % 241 === 0 ? null : i % 7 === 0 ? 0 : i % 3 === 0 ? 1 : 2,
    status: STATUSES[i % 3],
    report: `report-${i % 32}`,
    units: i % 5 === 0 ? [`u${i % 42}`] : [],
    location: `src/file-${i % 90}.tsx:${i}`,
    text: `The finding number ${i} breaks rule ${i % 17} on the surface ${i % 6}`,
    verdict: i % 11 === 0 ? "agree" : "none",
  }));
  const columns: SortColumn<Big>[] = [
    { id: "severity", rank: (r) => r.severity },
    { id: "id", rank: (r) => r.id },
    { id: "status", rank: (r) => r.status },
    { id: "report", rank: (r) => r.report },
    { id: "units", rank: (r) => r.units.length },
    { id: "location", rank: (r) => r.location },
    { id: "text", rank: (r) => r.text },
    { id: "verdict", rank: (r) => r.verdict },
  ];
  const filters: FilterDef<Big>[] = [
    { id: "severity", label: "Серьёзность", values: (r) => [String(r.severity)], options: [] },
    { id: "status", label: "Состояние", values: (r) => [r.status], options: [] },
    { id: "report", label: "Отчёт", values: (r) => [r.report], options: [] },
    { id: "unit", label: "Юнит", values: (r) => r.units, options: [] },
    { id: "verdict", label: "Оценка", values: (r) => [r.verdict], options: [] },
  ];
  const search: SearchDef<Big> = { identifiers: (r) => [r.id, r.location, ...r.units], text: (r) => [r.text], placeholder: "" };

  test("sort and filter under 16 ms", () => {
    const q = (s: Partial<QueryState>) => runQuery({ rows: big, rowId: (r) => r.id, columns, filters, search, state: state(s) });
    q({ sort: { id: "text", desc: true } }); // warm up the collator and the JIT
    const t0 = performance.now();
    const r = q({ sort: { id: "location", desc: false }, filters: { status: ["candidate", "fixed"], severity: ["1", "2"] }, search: "rule surface" });
    const elapsed = performance.now() - t0;
    expect(elapsed).toBeLessThan(16);
    expect(r.matched).toBeGreaterThan(0);
    expect(r.rows.every((x) => x.status !== "in-progress" && (x.severity === 1 || x.severity === 2))).toBe(true);
  });

  test("filtering then paging keeps every matched row exactly once", () => {
    const r = runQuery({ rows: big, rowId: (x) => x.id, columns, filters, search, state: state({ sort: { id: "severity", desc: true }, filters: { status: ["candidate"] } }) });
    expect(r.matched).toBe(241);
    const seen = new Set<string>();
    const { pageCount } = pageOf(r.rows, 1, 50);
    expect(pageCount).toBe(5);
    for (let p = 1; p <= pageCount; p++) for (const x of pageOf(r.rows, p, 50).rows) seen.add(x.id);
    expect(seen.size).toBe(241);
  });
});
