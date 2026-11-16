// The one client module that sorts, filters, searches and pages a table's full row set (rules/ui → Tables 1, an
// override of table → Tables are server-side: a run arrives whole). Every view with a table — and every view that
// filters a list without one — runs its rows through here; nothing sorts, filters, searches or pages elsewhere.
//
// - Sort: by a column's rank function, stable (ties keep the data's order); an absent rank sorts last both ways.
// - Filters combine (AND across filters, OR across one filter's chosen values); an empty choice means «все».
// - Counts: every option of a filter is counted over the set that passes the search and every other filter.
// - Search (table #12): the term splits into tokens; identifier fields match if any token is in any of them, free
//   text if every token is in some free-text field; a row passes if it passes either test.
// - Paging never drops or repeats a row.

/** A sort: the column and its direction. */
export interface SortSpec {
  id: string;
  desc: boolean;
}

/** A column's sort key: a number or a string; null or undefined sorts last in both directions. */
export type Rank = number | string | null | undefined;

export interface SortColumn<R> {
  id: string;
  rank: (row: R) => Rank;
}

/** A filter's chosen values per filter id; an absent or empty list means «все». */
export type Filters = Readonly<Record<string, readonly string[]>>;

export interface FilterOption {
  value: string;
  label: string;
}

export interface FilterDef<R> {
  id: string;
  /** The field's name: «Серьёзность». */
  label: string;
  /** The values a row carries for this field; a row may carry several (a finding's units). */
  values: (row: R) => readonly string[];
  options: readonly FilterOption[];
  /** A combobox's field placeholder: «Найти юнит». */
  placeholder?: string;
}

export interface SearchDef<R> {
  /** Identifier fields — ids, file paths, names: any token in any of them passes the row. */
  identifiers: (row: R) => readonly (string | null | undefined)[];
  /** Free-text fields — a rule, an observation: every token must be in one of them. */
  text: (row: R) => readonly (string | null | undefined)[];
  /** Names the fields searched: «Текст, файл, id, юнит». */
  placeholder: string;
}

/** A named set of filters, the «Вид» select (rules/ui → Conventions 16). */
export interface Preset {
  id: string;
  label: string;
  filters: Filters;
  /** What the slice holds, when its label does not say it alone — its states, from the view's own state map: «пишется,
   * проверяется, отладка, вливается». The «Вид» option's muted second part, and what fills it when it is empty. */
  detail?: string;
}

export interface QueryState {
  sort: SortSpec | null;
  filters: Filters;
  search: string;
}

export interface QueryInput<R> {
  rows: readonly R[];
  rowId: (row: R) => string;
  columns: readonly SortColumn<R>[];
  filters: readonly FilterDef<R>[];
  search: SearchDef<R> | null;
  state: QueryState;
  /** Rows shown even when the filters hide them — a row a link asked for — marked as outside the filter. */
  include?: ReadonlySet<string>;
  presets?: readonly Preset[];
}

export interface QueryResult<R> {
  /** The rows the filters and the search keep, plus the included ones, in sort order. */
  rows: R[];
  /** Ids of the included rows the filters hide. */
  outside: Set<string>;
  /** Rows the filters and the search keep: «{matched} из {total}». */
  matched: number;
  total: number;
  /** Per filter, per option value: the rows that pass the search and every other filter and carry the value;
   * `""` holds the count for «все». */
  counts: Record<string, Record<string, number>>;
  /** Per preset: the rows its filters keep under the current search. */
  presetCounts: Record<string, number>;
}

/** The term's tokens: split on spaces, commas and semicolons, lower-cased, each once. */
export function tokens(term: string): string[] {
  const out: string[] = [];
  for (const raw of term.toLowerCase().split(/[\s,;]+/)) if (raw && !out.includes(raw)) out.push(raw);
  return out;
}

const lower = (fields: readonly (string | null | undefined)[]): string[] => {
  const out: string[] = [];
  for (const f of fields) if (f) out.push(f.toLowerCase());
  return out;
};

/** Whether a row passes the search's tokens (no tokens: every row). */
export function searchPasses<R>(row: R, toks: readonly string[], def: SearchDef<R> | null): boolean {
  if (!toks.length || !def) return true;
  const ids = lower(def.identifiers(row));
  if (toks.some((t) => ids.some((f) => f.includes(t)))) return true;
  const text = lower(def.text(row));
  return text.length > 0 && toks.every((t) => text.some((f) => f.includes(t)));
}

/** The [start, end) ranges of `text` that hold a token, merged and in order: the search's hits to highlight. */
export function hitRanges(text: string, toks: readonly string[]): [number, number][] {
  if (!toks.length || !text) return [];
  const hay = text.toLowerCase();
  const ranges: [number, number][] = [];
  for (const t of toks) {
    for (let at = hay.indexOf(t); at !== -1; at = hay.indexOf(t, at + t.length)) ranges.push([at, at + t.length]);
  }
  ranges.sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [];
  for (const r of ranges) {
    const last = merged[merged.length - 1];
    if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]);
    else merged.push([r[0], r[1]]);
  }
  return merged;
}

const collator = new Intl.Collator("ru", { numeric: true, sensitivity: "base" });

/** Compares two ranks: numbers before strings, an absent rank after both. */
export function compareRanks(a: Rank, b: Rank): number {
  const na = a === null || a === undefined;
  const nb = b === null || b === undefined;
  if (na || nb) return na === nb ? 0 : na ? 1 : -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  if (typeof a === "number") return -1;
  if (typeof b === "number") return 1;
  return collator.compare(a, b);
}

/** Sorts by the column's rank, stable; descending flips the order of present ranks, absent ones stay last. */
export function sortRows<R>(rows: readonly R[], column: SortColumn<R> | undefined, desc: boolean): R[] {
  if (!column) return [...rows];
  const keyed = rows.map((row, i) => ({ row, i, k: column.rank(row) }));
  keyed.sort((x, y) => {
    const xa = x.k === null || x.k === undefined;
    const ya = y.k === null || y.k === undefined;
    let c: number;
    if (xa || ya) c = xa === ya ? 0 : xa ? 1 : -1;
    else c = desc ? -compareRanks(x.k, y.k) : compareRanks(x.k, y.k);
    return c || x.i - y.i;
  });
  return keyed.map((k) => k.row);
}

/** The next sort after a click on a header (table #2): the same column flips, another one starts descending. */
export function nextSort(current: SortSpec | null, id: string): SortSpec {
  if (current && current.id === id) return { id, desc: !current.desc };
  return { id, desc: true };
}

/** The filters with empty choices dropped, so «все» equals an absent key. */
export function normalizeFilters(filters: Filters): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const [k, v] of Object.entries(filters)) if (v && v.length) out[k] = [...v].sort();
  return out;
}

export const sameFilters = (a: Filters, b: Filters): boolean => JSON.stringify(normalizeFilters(a)) === JSON.stringify(normalizeFilters(b));

/** The preset whose filters equal the current ones, or null — «Свой набор». */
export const presetOf = (filters: Filters, presets: readonly Preset[]): Preset | null => presets.find((p) => sameFilters(p.filters, filters)) ?? null;

export const activeFilterCount = (filters: Filters): number => Object.keys(normalizeFilters(filters)).length;

export function runQuery<R>({ rows, rowId, columns, filters, search, state, include, presets = [] }: QueryInput<R>): QueryResult<R> {
  const toks = tokens(state.search);
  const chosen = filters.map((f) => {
    const values = state.filters[f.id];
    return values && values.length ? new Set(values) : null;
  });
  const all = (1 << filters.length) - 1;
  const counts: Record<string, Record<string, number>> = {};
  for (const f of filters) counts[f.id] = { "": 0 };
  const presetSets = presets.map((p) => filters.map((f) => (p.filters[f.id]?.length ? new Set(p.filters[f.id]) : null)));
  const presetCounts: Record<string, number> = Object.fromEntries(presets.map((p) => [p.id, 0]));

  const kept: R[] = [];
  const outside = new Set<string>();
  let matched = 0;
  for (const row of rows) {
    const searched = searchPasses(row, toks, search);
    const values = filters.map((f) => f.values(row));
    let mask = 0;
    for (let i = 0; i < filters.length; i++) {
      const set = chosen[i];
      if (!set || values[i].some((v) => set.has(v))) mask |= 1 << i;
    }
    if (searched) {
      for (let i = 0; i < filters.length; i++) {
        if ((mask | (1 << i)) !== all) continue;
        const c = counts[filters[i].id];
        c[""]++;
        for (const v of new Set(values[i])) c[v] = (c[v] ?? 0) + 1;
      }
      presets.forEach((p, pi) => {
        if (presetSets[pi].every((set, i) => !set || values[i].some((v) => set.has(v)))) presetCounts[p.id]++;
      });
    }
    if (searched && mask === all) {
      matched++;
      kept.push(row);
    } else if (include?.has(rowId(row))) {
      outside.add(rowId(row));
      kept.push(row);
    }
  }
  const column = state.sort ? columns.find((c) => c.id === state.sort?.id) : undefined;
  return { rows: sortRows(kept, column, state.sort?.desc ?? false), outside, matched, total: rows.length, counts, presetCounts };
}

/** «все» as a page size: no split. */
export const ALL_ROWS = "all";
/** «по экрану» as a page size (table #1 Fill): as many collapsed rows as the table's box shows, measured by the table
 * and never stored; it reaches the paging below as that number. */
export const FILL_ROWS = "fill";
export type PageSize = number | typeof ALL_ROWS | typeof FILL_ROWS;
/** A page size the paging works with: Fill already measured into its number. */
export type RowsPerPage = number | typeof ALL_ROWS;

export interface Page<T> {
  rows: T[];
  /** 1-based, clamped into the pages that exist. */
  page: number;
  pageCount: number;
  /** 1-based index of the first row shown, 0 when none. */
  from: number;
  to: number;
}

/** One page of a list; `null` or «all» is one page of everything. */
export function pageOf<T>(list: readonly T[], page: number, size: RowsPerPage | null): Page<T> {
  if (size === null || size === ALL_ROWS || size <= 0) return { rows: [...list], page: 1, pageCount: 1, from: list.length ? 1 : 0, to: list.length };
  const pageCount = Math.max(1, Math.ceil(list.length / size));
  const p = Math.min(Math.max(1, Math.trunc(page) || 1), pageCount);
  const start = (p - 1) * size;
  const rows = list.slice(start, start + size);
  return { rows, page: p, pageCount, from: rows.length ? start + 1 : 0, to: start + rows.length };
}

/** The page that holds the item at `index` (0-based). */
export const pageOfIndex = (index: number, size: RowsPerPage | null): number => (size === null || size === ALL_ROWS || size <= 0 || index < 0 ? 1 : Math.floor(index / size) + 1);
