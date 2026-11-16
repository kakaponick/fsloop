// The view-state store of a table — and of a view that filters a list without one (table #7; rules/ui → Tables 4,
// Conventions 12; the design check). Everything goes through u2's one browser-storage module, read synchronously so
// a persisted view is on first paint. Two scopes:
//
// - per table id: sort, columns, widths, page size, the page split, the pinned row action, the search history;
// - per table id and run: filters and search — their values (a unit, a report) are objects of one run.
//
// Never on the server, never in the URL: the page and the open row are the caller's, for the URL.
import { useCallback } from "react";
import { readPref, usePref, writePref } from "@/ui";
import type { ColumnsState } from "./columns.ts";
import type { Filters, PageSize, SortSpec } from "./query.ts";

export interface TablePrefs {
  sort: SortSpec | null;
  columns: ColumnsState | null;
  widths: Record<string, number>;
  pageSize: PageSize;
  /** Pages on; off shows every row and the counts strip (table #1). */
  paged: boolean;
  /** The pinned row action's id; null — the table's default. */
  pin: string | null;
  /** Recent search terms, the latest first. */
  history: string[];
}

export interface RunPrefs {
  filters: Filters;
  search: string;
}

export const tableKey = (id: string) => `table:${id}`;
export const runKey = (id: string, run: string) => `table:${id}:run:${run}`;

export const TABLE_DEFAULTS: TablePrefs = { sort: null, columns: null, widths: {}, pageSize: 50, paged: true, pin: null, history: [] };
export const RUN_DEFAULTS: RunPrefs = { filters: {}, search: "" };

/** A stored object merged over its defaults: a field a stored value lacks takes its default. */
function merged<T extends object>(stored: Partial<T> | null, defaults: T): T {
  return { ...defaults, ...(stored && typeof stored === "object" ? stored : {}) };
}

function usePrefs<T extends object>(key: string, defaults: T): [T, (patch: Partial<T>) => void] {
  const [stored] = usePref<Partial<T> | null>(key, null);
  const value = merged(stored, defaults);
  const set = useCallback(
    // read the latest stored value, so two patches in one event both land
    (patch: Partial<T>) => writePref(key, { ...merged(readPref<Partial<T> | null>(key, null), defaults), ...patch }),
    // defaults are a module constant or the caller's memoized object
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key],
  );
  return [value, set];
}

/** The table-scope view state; `defaults` overrides the table's defaults (a default sort, the page split). */
export function useTableView(id: string, defaults: Partial<TablePrefs> = {}): [TablePrefs, (patch: Partial<TablePrefs>) => void] {
  return usePrefs(tableKey(id), { ...TABLE_DEFAULTS, ...defaults });
}

/** The run-scope view state: filters and search of one table in one run. */
export function useRunView(id: string, run: string): [RunPrefs, (patch: Partial<RunPrefs>) => void] {
  return usePrefs(runKey(id, run), RUN_DEFAULTS);
}

export const HISTORY_MAX = 8;

/** Adds a term to the search history: trimmed, the latest first, each term once (case aside), at most 8. */
export function pushHistory(history: readonly string[], term: string, max = HISTORY_MAX): string[] {
  const t = term.trim();
  if (!t) return [...history];
  return [t, ...history.filter((h) => h.toLowerCase() !== t.toLowerCase())].slice(0, max);
}
