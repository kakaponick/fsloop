// The data table (table #1–15 as refined by rules/ui → Tables 1–5, Live data 2–3, Conventions 11–12, 16; ui →
// Roles: data table). One table for every list of a run: the view gives columns, filters, presets, the search's
// fields and row actions as configuration; the table owns the machinery — the query (query.ts), the held order of a
// live list, selection, the row menu and its pin, expanding rows, keyboard and wheel, widths, the view state.
//
// Built on the library's table with @tanstack/react-table as the column model (the shadcn data-table recipe);
// sorting, filtering, searching and paging stay in query.ts, never in the table model.
import { getCoreRowModel, useReactTable, type ColumnDef, type VisibilityState } from "@tanstack/react-table";
import { ArrowDownIcon, ArrowUpDownIcon, ArrowUpIcon, ChevronRightIcon } from "lucide-react";
import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent, type ReactNode, type WheelEvent as ReactWheelEvent } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { EmptyState, GlossaryTooltip, HeldStrip, Loading, markProps, OutOfFilter, PartFailed, WHEEL_GESTURE_GAP, type EmptyWhen, type Gender, type GlossaryEntry, type HeldNoun, type MarkState } from "@/ui";
import { clampWidth, mergeWidths, placeColumns, RESIZE_STEP, SELECT_WIDTH, sameColumns, sameWidths, tableMinWidth, type ColumnLayout } from "./columns.ts";
import { ColumnsMenu } from "./columns-menu.tsx";
import { CUSTOM_LABEL, FilterControl, filterSummary, PRESET_LABEL, PresetSelect } from "./filters.tsx";
import { FILL_ROWS, nextSort, pageOf, pageOfIndex, runQuery, tokens as toTokens, type FilterDef, type Preset, type Rank, type RowsPerPage, type SearchDef, type SortSpec } from "./query.ts";
import { OPEN_ACTION, pinnable, RowMenu, type RowAction } from "./row-menu.tsx";
import { Highlight, SearchBox } from "./search.tsx";
import { StatusBar, type BarOrder } from "./status-bar.tsx";
import { AdaptiveToolbar, type ToolbarItem } from "./toolbar.tsx";
import { pushHistory, useRunView, useTableView } from "./view-state.ts";

/** What a cell renderer gets besides its row: the search's tokens and a highlighter for its text. */
export interface CellContext {
  tokens: readonly string[];
  hl: (text: string | null | undefined) => ReactNode;
}

export interface TableColumn<R> extends ColumnLayout {
  /** The sort key; a column without one does not sort. Status columns rank by severity, not alphabet (table #2). */
  rank?: (row: R) => Rank;
  /** Counts, durations: right-aligned, tabular (table #9). */
  numeric?: boolean;
  /** Defines the column's term or the values its cells show (ui → Glossary). */
  glossary?: readonly GlossaryEntry[];
  cell: (row: R, ctx: CellContext) => ReactNode;
  /** The cell's full text, for its title when it truncates (table #10, rules/ui → Tables 5). */
  text?: (row: R) => string | null | undefined;
}

/** Why the table is empty before any filter: u2's one rule (`emptyWhen`) gives it. */
export type { EmptyWhen };

export interface PartFailure {
  what: string;
  cause: string;
  gender?: Gender;
  onRetry?: () => void;
}

export interface DataTableProps<R> {
  /** The table's id: its view state is kept under it. */
  id: string;
  /** The run the rows belong to: filters and search are kept per table and run. */
  runKey: string;
  /** The table's accessible name: «Находки прогона a098a7d4». */
  label: string;
  /** null — the first load. */
  rows: readonly R[] | null;
  /** The rows could not be read: the part-failed message in the table's place (Conventions 14). */
  failed?: PartFailure | null;
  rowId: (row: R) => string;
  /** The row's name, for the row menu's header. */
  rowTitle: (row: R) => string;
  noun: HeldNoun;
  /** Module-level constants: a new array each render defeats the memoized query. */
  columns: readonly TableColumn<R>[];
  filters?: readonly FilterDef<R>[];
  presets?: readonly Preset[];
  search: SearchDef<R>;
  /** The row menu's items; «Открыть» comes first when rows expand. */
  actions?: readonly RowAction<R>[];
  /** The row's detail, expanded in place under it (Tables 3). */
  detail?: (row: R) => ReactNode;
  defaultSort?: SortSpec | null;
  /** Pages on by default (50 a page); the units table shows every row. */
  defaultPaged?: boolean;
  empty: EmptyWhen;
  /** The counts strip of the status bar when the list is not split: dots with counts over the kept rows. */
  counts?: (rows: readonly R[]) => ReactNode;
  /** The status bar's order, when the view's differs from the bar's own (a module-level constant). */
  barOrder?: BarOrder;
  /** Toolbar facts, at the right end. */
  toolbarEnd?: ReactNode;
  /** The page from the URL; changes are reported to `onPageChange` for the URL (Conventions 12). */
  page?: number;
  onPageChange?: (page: number) => void;
  /** Open rows from the URL; changes are reported for the URL. */
  open?: readonly string[];
  onOpenChange?: (ids: string[]) => void;
  /** A row a link asked for: shown even when filtered out, marked, its page opened and scrolled to. */
  target?: string | null;
  /** Change marks of a row (Conventions 9). */
  marks?: (row: R) => MarkState;
  /** The data's last update and the shared clock, for the status bar's age. */
  updatedAt?: string | null;
  now?: string | number;
  /** Binds `/` to this table's search (one per view). */
  searchShortcut?: boolean;
  className?: string;
}

export const OPEN_LABEL = "Открыть";
export const CLOSE_LABEL = "Свернуть";
export const SELECT_ALL = "Выбрать все строки по фильтрам";
export const SELECT_ROW = "Выбрать строку";

/** A collapsed row's and the header's height (DESIGN.md → Data Table: h-8), until the table measures its own. */
const ROW_HEIGHT = 32;
/** «по экрану» before the table's box is measured (a test without layout). */
const FILL_FALLBACK = 50;

/** The events that end a drag over the selection column. */
const ENDS = ["pointerup", "pointercancel", "blur"] as const;

const sortIcon = (dir: false | "asc" | "desc") => (dir === "desc" ? <ArrowDownIcon /> : dir === "asc" ? <ArrowUpIcon /> : <ArrowUpDownIcon className="opacity-40" />);

/** An element inside a row that handles its own click. */
const ownClick = (target: EventTarget | null, row: HTMLElement): boolean => {
  const el = target instanceof Element ? target.closest("a, button, input, textarea, select, label, [role='checkbox'], [role='separator'], [data-no-row-click]") : null;
  return el !== null && el !== row && row.contains(el);
};

export function DataTable<R>(props: DataTableProps<R>) {
  const { id, runKey, label, rows, failed, rowId, rowTitle, noun, columns, filters = [], presets = [], search, actions = [], detail, defaultSort = null, defaultPaged = true, empty, counts, barOrder, toolbarEnd, marks, updatedAt, now, searchShortcut = true, className } = props;
  const [tprefs, setT] = useTableView(id, { sort: defaultSort, paged: defaultPaged });
  const [rprefs, setR] = useRunView(id, runKey);
  const target = props.target ?? null;

  // ── the query ──────────────────────────────────────────────────────────────────────────────
  const queryKey = JSON.stringify([tprefs.sort, rprefs.filters, rprefs.search, target]);
  const sortColumns = useMemo(() => columns.flatMap((c) => (c.rank ? [{ id: c.id, rank: c.rank }] : [])), [columns]);
  const result = useMemo(
    () => (rows ? runQuery({ rows, rowId, columns: sortColumns, filters, search, state: { sort: tprefs.sort, filters: rprefs.filters, search: rprefs.search }, include: target ? new Set([target]) : undefined, presets }) : null),
    // the stored values are re-parsed every render; their JSON is the key
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, queryKey, sortColumns, filters, search, presets],
  );
  const toks = useMemo(() => toTokens(rprefs.search), [rprefs.search]);
  const byId = useMemo(() => new Map((rows ?? []).map((r) => [rowId(r), r])), [rows, rowId]);
  const resultIds = useMemo(() => (result ? result.rows.map(rowId) : []), [result, rowId]);

  // ── the held order of a live list (rules/ui → Live data 2–3; ui → Live data) ──────────────────
  const [frozen, setFrozen] = useState<{ key: string; ids: readonly string[] } | null>(null);
  if (result && (!frozen || frozen.key !== queryKey)) setFrozen({ key: queryKey, ids: resultIds });
  const frozenIds = frozen && frozen.key === queryKey ? frozen.ids : resultIds;
  const held = useMemo(() => {
    const resultSet = new Set(resultIds);
    const frozenSet = new Set(frozenIds);
    const display = frozenIds.filter((x) => byId.has(x));
    const left = display.filter((x) => !resultSet.has(x));
    const fresh = resultIds.filter((x) => !frozenSet.has(x)).length;
    const kept = resultIds.filter((x) => frozenSet.has(x));
    const before = display.filter((x) => resultSet.has(x));
    let moved = 0;
    for (let i = 0; i < kept.length; i++) if (kept[i] !== before[i]) moved++;
    const outside = new Set([...left, ...(result?.outside ?? [])]);
    return { display, outside, counts: { fresh, moved, left: left.length } };
  }, [resultIds, frozenIds, byId, result]);
  const display = held.display;

  // ── paging, open rows, selection: in memory; the page and open rows reported for the URL ───────
  // «по экрану» (table #1 Fill): the rows the scroll box shows, measured from a collapsed row; until measured — a
  // test without layout — 50 a page
  const fillMode = tprefs.paged && tprefs.pageSize === FILL_ROWS;
  const [fill, setFill] = useState<number | null>(null);
  const size: RowsPerPage | null = !tprefs.paged ? null : tprefs.pageSize === FILL_ROWS ? (fill ?? FILL_FALLBACK) : tprefs.pageSize;
  const [pageState, setPageState] = useState(props.page ?? 1);
  const [seenSize, setSeenSize] = useState(size);
  if (size !== seenSize) {
    // a new page size keeps the first row of the page in view
    setSeenSize(size);
    if (typeof seenSize === "number") setPageState(pageOfIndex((pageState - 1) * seenSize, size));
  }
  const [seenPageProp, setSeenPageProp] = useState(props.page);
  if (props.page !== undefined && props.page !== seenPageProp) {
    setSeenPageProp(props.page);
    setPageState(props.page);
  }
  const [seenQuery, setSeenQuery] = useState(queryKey);
  const [seenSearch, setSeenSearch] = useState(rprefs.search);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [anchor, setAnchor] = useState<string | null>(null);
  if (queryKey !== seenQuery) {
    // a search, filter or sort change starts at page 1; a search change clears the selection (table #7)
    setSeenQuery(queryKey);
    setPageState(1);
    if (rprefs.search !== seenSearch) {
      setSeenSearch(rprefs.search);
      setSelected(new Set());
    }
  }
  const [seenTarget, setSeenTarget] = useState<string | null>(null);
  if (target !== seenTarget && result) {
    setSeenTarget(target);
    const at = target ? display.indexOf(target) : -1;
    if (at >= 0) setPageState(pageOfIndex(at, size));
  }
  const pg = pageOf(display, pageState, size);
  // The page reaches the caller's URL with the page itself: a page the user turns, or a query change that starts at
  // page 1, is reported in the same event, so both land in one commit; a page the render derives (a link's target, a
  // new page size, rows that shrank) is reported after its commit — a passive effect, because the caller's router
  // ignores a navigation from a layout effect on its first commit.
  const reported = useRef(props.page ?? 1);
  const onPageChange = props.onPageChange;
  const report = (p: number) => {
    if (reported.current === p) return;
    reported.current = p;
    onPageChange?.(p);
  };
  useEffect(() => {
    if (!rows || reported.current === pg.page) return;
    reported.current = pg.page;
    onPageChange?.(pg.page);
  }, [pg.page, rows, onPageChange]);
  /** A search, filter or sort change starts at page 1 (table #7). */
  const restart = () => {
    setPageState(1);
    if (rows) report(1);
  };
  const setQuery = (patch: Partial<typeof rprefs>) => {
    setR(patch);
    restart();
  };
  const setSort = (sort: SortSpec | null) => {
    setT({ sort });
    restart();
  };

  const [openState, setOpenState] = useState<readonly string[]>(props.open ?? []);
  const [seenOpenProp, setSeenOpenProp] = useState(props.open);
  if (props.open !== undefined && props.open !== seenOpenProp) {
    setSeenOpenProp(props.open);
    setOpenState(props.open);
  }
  const openSet = new Set(openState);
  const setOpen = (ids: string[]) => {
    setOpenState(ids);
    props.onOpenChange?.(ids);
  };
  /** A row the user just expanded: once its detail renders, brought to the box's top if the detail runs past its end. */
  const expanded = useRef<string | null>(null);
  const toggleOpen = (rid: string) => {
    const opening = !openSet.has(rid);
    expanded.current = opening ? rid : null;
    setOpen(opening ? [...openState, rid] : openState.filter((x) => x !== rid));
  };

  // ── row actions and the pin (table #13, rules/ui → Tables 4) ─────────────────────────────────
  const allActions: RowAction<R>[] = detail
    ? [{ id: OPEN_ACTION, label: (rs) => (rs.length === 1 && openSet.has(rowId(rs[0])) ? CLOSE_LABEL : OPEN_LABEL), scope: "single", group: 0, run: (rs) => toggleOpen(rowId(rs[0])) }, ...actions]
    : [...actions];
  const pins = pinnable(allActions);
  const pin = pins.find((a) => a.id === tprefs.pin) ?? pins[0];
  const runPinned = (row: R) => pin?.run([row]);

  // ── focus and keyboard ─────────────────────────────────────────────────────────────────────
  const [focusId, setFocusId] = useState<string | null>(null);
  const rowEls = useRef(new Map<string, HTMLTableRowElement>());
  const pendingFocus = useRef<"first" | "last" | null>(null);
  const scroller = useRef<HTMLDivElement | null>(null);
  const region = useRef<HTMLDivElement | null>(null);
  const tableShown = Boolean(!failed && rows?.length && display.length);
  useLayoutEffect(() => {
    if (!fillMode || !tableShown) return;
    const measure = () => {
      const el = scroller.current;
      // inside the frame, less a horizontal scrollbar: the room the rows have under the header
      const inner = el?.clientHeight ?? 0;
      if (!el || inner <= 0) return; // not laid out: keep the fallback
      const head = el.querySelector("thead")?.getBoundingClientRect().height || ROW_HEIGHT;
      const row = el.querySelector("tr[data-row-id]")?.getBoundingClientRect().height || ROW_HEIGHT;
      const n = Math.max(1, Math.floor((inner - head) / row));
      setFill((prev) => (prev === n ? prev : n));
    };
    // measured before the first paint, so the page never shows 50 rows and then shrinks (Strict 1)
    measure();
    const observer = new ResizeObserver(measure);
    if (region.current) observer.observe(region.current);
    return () => observer.disconnect();
  }, [fillMode, tableShown]);
  const pageIds = pg.rows;
  const tabRow = focusId && pageIds.includes(focusId) ? focusId : (pageIds[0] ?? null);
  useEffect(() => {
    if (!pendingFocus.current) return;
    const rid = pendingFocus.current === "first" ? pageIds[0] : pageIds[pageIds.length - 1];
    pendingFocus.current = null;
    if (rid) rowEls.current.get(rid)?.focus();
  });
  const goPage = (p: number, focus: "first" | "last" | null = null) => {
    const next = Math.min(Math.max(1, p), pg.pageCount);
    if (next === pg.page) return;
    pendingFocus.current = focus;
    setPageState(next);
    report(next);
    if (scroller.current) scroller.current.scrollTop = focus === "last" ? scroller.current.scrollHeight : 0;
  };
  const focusRow = (rid: string) => {
    setFocusId(rid);
    const el = rowEls.current.get(rid);
    el?.focus();
    el?.scrollIntoView?.({ block: "nearest" });
  };

  // ── selection (table #5; the design check: a checkbox column, Shift range, drag, Space; never a plain click) ─
  const toggleSelect = (rid: string) => {
    const next = new Set(selected);
    if (next.has(rid)) next.delete(rid);
    else next.add(rid);
    setSelected(next);
    setAnchor(rid);
  };
  const setRange = (from: string, to: string, value: boolean) => {
    const a = display.indexOf(from);
    const b = display.indexOf(to);
    if (a < 0 || b < 0) return;
    const next = new Set(selected);
    for (const x of display.slice(Math.min(a, b), Math.max(a, b) + 1)) {
      if (value) next.add(x);
      else next.delete(x);
    }
    setSelected(next);
  };
  const selectRange = (rid: string) => {
    setRange(anchor ?? rid, rid, true);
    if (!anchor) setAnchor(rid);
  };
  const drag = useRef<{ origin: string; value: boolean } | null>(null);
  const startDrag = (rid: string) => {
    drag.current = { origin: rid, value: !selected.has(rid) };
    // released anywhere, cancelled by the browser or the window losing focus: the drag ends cleanly
    const end = () => {
      drag.current = null;
      for (const type of ENDS) window.removeEventListener(type, end);
    };
    for (const type of ENDS) window.addEventListener(type, end);
  };
  const dragOver = (rid: string) => {
    const d = drag.current;
    if (d && d.origin !== rid) setRange(d.origin, rid, d.value);
  };
  const filteredIds = resultIds;
  const allSelected = filteredIds.length > 0 && filteredIds.every((x) => selected.has(x));
  const someSelected = !allSelected && filteredIds.some((x) => selected.has(x));
  /** The selected rows the data still holds: what the row menu acts on (table #4), counted in the status bar. */
  const selectedCount = [...selected].filter((x) => byId.has(x)).length;

  // ── the row menu: the row it opened on, or every selected row the table knows (table #4) ───────
  const [menuFor, setMenuFor] = useState<readonly string[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRows = menuFor.map((x) => byId.get(x)).filter((r): r is R => r !== undefined);

  // ── widths (table #15) ─────────────────────────────────────────────────────────────────────
  const [live, setLive] = useState<{ id: string; w: number } | null>(null);
  const stored = tprefs.widths;
  const widths = { ...mergeWidths(columns, stored), ...(live ? { [live.id]: live.w } : {}) };
  const setWidth = (column: ColumnLayout, w: number | null) => {
    const next = { ...stored };
    if (w === null) delete next[column.id];
    else next[column.id] = clampWidth(column, w);
    setT({ widths: next });
  };
  const startResize = (event: ReactPointerEvent<HTMLElement>, column: ColumnLayout) => {
    event.preventDefault();
    event.stopPropagation(); // not a drag-select, not a sort
    const startX = event.clientX;
    const startW = widths[column.id] ?? column.width ?? 0;
    let w = startW;
    const move = (e: PointerEvent) => {
      w = clampWidth(column, startW + e.clientX - startX);
      setLive({ id: column.id, w });
    };
    const done = (commit: boolean) => () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
      window.removeEventListener("blur", cancel);
      setLive(null);
      if (commit) setWidth(column, w);
    };
    const up = done(true);
    // a gesture the browser cancels or a window that loses focus leaves the width as it was
    const cancel = done(false);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", cancel);
    window.addEventListener("blur", cancel);
  };

  // ── columns: the placed order and visibility, as the table model's state ─────────────────────
  const placed = placeColumns(columns, tprefs.columns);
  const visible = placed.filter((p) => p.visible).map((p) => p.column as TableColumn<R>);
  const columnVisibility: VisibilityState = Object.fromEntries(placed.map((p) => [p.column.id, p.visible]));
  const columnDefs = useMemo<ColumnDef<R>[]>(() => columns.map((c) => ({ id: c.id, header: c.label, accessorFn: (row: R) => c.text?.(row) ?? "" })), [columns]);
  const pageRowsData = useMemo(() => pageIds.map((x) => byId.get(x)).filter((r): r is R => r !== undefined), [pageIds, byId]);
  // eslint-disable-next-line react-hooks/incompatible-library
  const model = useReactTable({
    data: pageRowsData,
    columns: columnDefs,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => rowId(row),
    state: { columnVisibility, columnOrder: placed.map((p) => p.column.id) },
    manualSorting: true,
    manualFiltering: true,
    manualPagination: true,
  });
  const leaf = model.getVisibleLeafColumns().map((c) => c.id);
  const ordered = leaf.map((x) => visible.find((c) => c.id === x)).filter((c): c is TableColumn<R> => c !== undefined);
  const slack = ordered.find((c) => c.width === undefined);
  const minWidth = tableMinWidth(ordered, widths);
  const changed = !sameColumns(columns, tprefs.columns) || !sameWidths(columns, stored) || tprefs.paged !== defaultPaged;
  const hl = (text: string | null | undefined): ReactNode => (text ? <Highlight text={text} tokens={toks} /> : null);
  const ctx: CellContext = { tokens: toks, hl };

  // ── toolbar ────────────────────────────────────────────────────────────────────────────────
  const items: ToolbarItem[] = [];
  if (presets.length)
    items.push({ id: "preset", kind: "sticky", values: [...presets.map((p) => `${PRESET_LABEL}: ${p.label}`), `${PRESET_LABEL}: ${CUSTOM_LABEL}`], node: <PresetSelect presets={presets} filters={rprefs.filters} counts={result?.presetCounts} onChoose={(p) => setQuery({ filters: p.filters })} /> });
  items.push({
    id: "search",
    kind: "pinned",
    flex: true,
    node: <SearchBox value={rprefs.search} onChange={(v) => setQuery({ search: v })} placeholder={search.placeholder} history={tprefs.history} onCommit={(term) => setT({ history: pushHistory(tprefs.history, term) })} shortcut={searchShortcut} />,
  });
  for (const f of filters)
    items.push({
      id: `filter-${f.id}`,
      kind: "ordinary",
      active: Boolean(rprefs.filters[f.id]?.length),
      // a filter's trigger hugs the value the user picked (table #11): no reserve
      node: <FilterControl def={f} value={rprefs.filters[f.id] ?? []} counts={result?.counts[f.id]} onChange={(v) => setQuery({ filters: { ...rprefs.filters, [f.id]: v } })} />,
    });
  if (toolbarEnd) items.push({ id: "facts", kind: "pinned", end: true, node: toolbarEnd });
  items.push({
    id: "columns",
    kind: "pinned",
    end: !toolbarEnd,
    node: (
      <ColumnsMenu
        id={id}
        columns={columns}
        state={tprefs.columns}
        onChange={(c) => setT({ columns: c })}
        paged={tprefs.paged}
        onPagedChange={(paged) => setT({ paged })}
        changed={changed}
        onReset={() => setT({ columns: null, widths: {}, paged: defaultPaged })}
      />
    ),
  });

  // ── handlers ───────────────────────────────────────────────────────────────────────────────
  const onRowClick = (event: ReactMouseEvent<HTMLTableRowElement>, row: R) => {
    const rid = rowId(row);
    if (ownClick(event.target, event.currentTarget)) return;
    if (event.shiftKey) return selectRange(rid);
    if (event.ctrlKey || event.metaKey) return toggleSelect(rid);
    setFocusId(rid);
    runPinned(row);
  };
  const onBodyKey = (event: KeyboardEvent<HTMLTableSectionElement>) => {
    const tr = (event.target as HTMLElement).closest<HTMLTableRowElement>("tr[data-row-id]");
    if (!tr || event.target !== tr) return;
    const rid = tr.dataset.rowId as string;
    const at = pageIds.indexOf(rid);
    const row = byId.get(rid);
    switch (event.key) {
      case "ArrowDown":
      case "ArrowUp": {
        event.preventDefault();
        const next = pageIds[at + (event.key === "ArrowDown" ? 1 : -1)];
        if (next) focusRow(next);
        return;
      }
      case "Enter":
        event.preventDefault();
        if (row) runPinned(row);
        return;
      case " ":
        event.preventDefault();
        toggleSelect(rid);
        return;
      case "ArrowRight":
      case "ArrowLeft":
        event.preventDefault();
        goPage(pg.page + (event.key === "ArrowRight" ? 1 : -1), "first");
        return;
      case "Home":
      case "End":
        if (!size) return;
        event.preventDefault();
        goPage(event.key === "Home" ? 1 : pg.pageCount, "first");
        return;
    }
  };
  const lastWheel = useRef(-Infinity);
  const onWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    if (!size || pg.pageCount <= 1 || Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
    const gap = event.timeStamp - lastWheel.current;
    lastWheel.current = event.timeStamp;
    if (gap < WHEEL_GESTURE_GAP) return; // one step per gesture
    const el = event.currentTarget;
    if (event.deltaY > 0 && el.scrollTop + el.clientHeight >= el.scrollHeight - 1 && pg.page < pg.pageCount) goPage(pg.page + 1);
    else if (event.deltaY < 0 && el.scrollTop <= 0 && pg.page > 1) goPage(pg.page - 1);
  };
  const onContextMenu = (rid: string) => {
    setMenuFor(selected.has(rid) && selected.size > 1 ? [...selected] : [rid]);
    setFocusId(rid);
  };

  // ── a row brought into view: to the top of the box, under the sticky header, so its detail shows (craft-1) ──
  // Only the table's own box scrolls: the page around it and the header above it stay where the user left them.
  const scrollToTop = (rid: string) => {
    const box = scroller.current;
    const tr = rowEls.current.get(rid);
    const head = box?.querySelector("thead");
    if (!box || !tr || !head) return;
    const by = tr.getBoundingClientRect().top - head.getBoundingClientRect().bottom;
    if (by) box.scrollBy?.({ top: by });
  };
  const targetOnPage = target !== null && pageIds.includes(target);
  useLayoutEffect(() => {
    // once per link: the row it names, on its page
    if (targetOnPage && target) scrollToTop(target);
  }, [targetOnPage, target]);
  useLayoutEffect(() => {
    const rid = expanded.current;
    expanded.current = null;
    const box = scroller.current;
    const detailRow = rid && box ? [...box.querySelectorAll<HTMLElement>("tr[data-detail-for]")].find((tr) => tr.dataset.detailFor === rid) : null;
    if (!rid || !box || !detailRow) return;
    const end = box.getBoundingClientRect().top + box.clientTop + box.clientHeight;
    if (detailRow.getBoundingClientRect().bottom > end) scrollToTop(rid);
  });

  // ── the body ───────────────────────────────────────────────────────────────────────────────
  let body: ReactNode;
  if (failed) body = <div className="flex size-full items-center justify-center rounded-lg border p-4"><PartFailed what={failed.what} cause={failed.cause} gender={failed.gender} onRetry={failed.onRetry} /></div>;
  else if (!rows || !result) body = <Loading framed />;
  else if (!rows.length)
    body = (
      <div className="flex size-full items-center justify-center rounded-lg border">
        {empty.form === "not-yet" ? <EmptyState form="not-yet" noun={noun.forms} step={empty.step} lead={empty.lead} subject={empty.subject} /> : <EmptyState form="never" noun={noun.forms} description={empty.description} />}
      </div>
    );
  else if (!display.length)
    body = (
      <div className="flex size-full items-center justify-center rounded-lg border">
        <EmptyState form="filtered" noun={noun.forms} filters={filterSummary(filters, rprefs.filters, rprefs.search)} onReset={() => setQuery({ filters: {}, search: "" })} />
      </div>
    );
  else
    body = (
      <div
        ref={scroller}
        data-slot="table-scroll"
        onWheel={onWheel}
        className="size-full scroll-pt-8 overflow-auto rounded-lg border [scrollbar-gutter:stable] [&>[data-slot=table-container]]:overflow-visible"
      >
        <Table aria-label={label} className="table-fixed border-separate border-spacing-0" style={{ minWidth }}>
          <colgroup>
            <col style={{ width: SELECT_WIDTH }} />
            {ordered.map((c) => (
              <col key={c.id} data-col={c.id} style={c.width === undefined ? undefined : { width: widths[c.id] }} />
            ))}
            {!slack && <col data-col="spacer" />}
          </colgroup>
          <TableHeader className="sticky top-0 z-10 bg-background">
            <TableRow className="hover:bg-transparent">
              <TableHead className="h-8 border-b px-2">
                <Checkbox aria-label={SELECT_ALL} checked={allSelected ? true : someSelected ? "indeterminate" : false} onCheckedChange={() => setSelected(allSelected ? new Set() : new Set(filteredIds))} />
              </TableHead>
              {ordered.map((c) => (
                <HeaderCell key={c.id} column={c} sort={tprefs.sort} onSort={() => setSort(nextSort(tprefs.sort, c.id))} width={widths[c.id]} onResizeStart={startResize} onResizeKey={(delta) => setWidth(c, (widths[c.id] ?? 0) + delta)} onResizeReset={() => setWidth(c, null)} />
              ))}
              {!slack && <TableHead className="h-8 border-b" aria-hidden="true" />}
            </TableRow>
          </TableHeader>
          <RowMenu
            rows={menuRows}
            requested={menuFor.length}
            title={rowTitle}
            noun={noun.forms}
            actions={allActions}
            pin={pin?.id ?? ""}
            onPin={(p) => setT({ pin: p })}
            onOpenChange={setMenuOpen}
            label={`Действия: ${label}`}
          >
            <TableBody onKeyDown={onBodyKey}>
              {model.getRowModel().rows.map((mrow) => {
                const row = mrow.original;
                const rid = mrow.id;
                const isOpen = Boolean(detail) && openSet.has(rid);
                const outside = held.outside.has(rid);
                const isSelected = selected.has(rid);
                const mark = { ...(marks?.(row) ?? {}), target: rid === target || undefined };
                const mp = markProps(mark);
                return (
                  <Fragment key={rid}>
                    <TableRow
                      ref={(el) => {
                        if (el) rowEls.current.set(rid, el);
                        else rowEls.current.delete(rid);
                      }}
                      data-row-id={rid}
                      data-state={isSelected ? "selected" : undefined}
                      data-menu={menuOpen && menuFor.includes(rid) ? "" : undefined}
                      data-outside={outside ? "" : undefined}
                      data-edge={mp["data-edge"]}
                      data-target={mp["data-target"]}
                      aria-expanded={detail ? isOpen : undefined}
                      tabIndex={rid === tabRow ? 0 : -1}
                      onClick={(e) => onRowClick(e, row)}
                      onFocus={(e) => e.target === e.currentTarget && setFocusId(rid)}
                      onContextMenu={() => onContextMenu(rid)}
                      className={cn("h-8 outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-inset data-[menu]:bg-muted", pin ? "cursor-pointer" : "cursor-default", mp.className)}
                    >
                      <TableCell
                        className="border-b px-2 py-0"
                        onPointerDown={(e) => {
                          if (e.button === 0) startDrag(rid);
                        }}
                        onPointerEnter={() => dragOver(rid)}
                      >
                        <Checkbox
                          aria-label={`${SELECT_ROW}: ${rowTitle(row)}`}
                          checked={isSelected}
                          tabIndex={-1}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (e.shiftKey) selectRange(rid);
                            else toggleSelect(rid);
                          }}
                        />
                      </TableCell>
                      {ordered.map((c) => {
                        const full = c.text?.(row) ?? undefined;
                        return (
                          <TableCell key={c.id} data-col={c.id} className={cn("border-b px-2 py-0", c.numeric && "text-right tabular-nums")}>
                            {c === slack && (outside || detail) ? (
                              <div className="flex min-w-0 items-center gap-1.5">
                                {detail && <ExpandMark open={isOpen} onToggle={() => toggleOpen(rid)} />}
                                <div className="min-w-0 flex-1 truncate" title={full ?? undefined}>
                                  {c.cell(row, ctx)}
                                </div>
                                {outside && <OutOfFilter className="shrink-0" />}
                              </div>
                            ) : (
                              <div className="truncate" title={full ?? undefined}>
                                {c.cell(row, ctx)}
                              </div>
                            )}
                          </TableCell>
                        );
                      })}
                      {!slack && (
                        <TableCell className="border-b p-0">
                          {(outside || detail) && (
                            <div className="flex items-center justify-end gap-1.5 px-2">
                              {outside && <OutOfFilter />}
                              {detail && <ExpandMark open={isOpen} onToggle={() => toggleOpen(rid)} />}
                            </div>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                    {isOpen && detail && (
                      <TableRow data-detail-for={rid} className="hover:bg-transparent">
                        <TableCell colSpan={ordered.length + (slack ? 1 : 2)} className="border-b bg-muted p-0 whitespace-normal">
                          <div className="px-4 py-3">{detail(row)}</div>
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                );
              })}
            </TableBody>
          </RowMenu>
        </Table>
      </div>
    );

  return (
    <div data-slot="data-table" className={cn("@container flex size-full min-h-0 flex-col gap-2", className)}>
      <AdaptiveToolbar items={items} label={`Фильтры: ${label}`} />
      <div ref={region} data-slot="table-region" className="min-h-0 flex-1">
        {body}
      </div>
      <HeldStrip counts={held.counts} noun={noun} onApply={() => setFrozen({ key: queryKey, ids: resultIds })} className="-mt-2 border-t-0" />
      <StatusBar
        noun={noun.forms}
        shown={result?.matched}
        total={result?.total}
        pager={result && size ? { page: pg.page, pageCount: pg.pageCount, onPage: (p) => goPage(p), pageSize: tprefs.pageSize, onPageSize: (s) => setT({ pageSize: s }) } : null}
        counts={result && counts ? counts(result.rows.filter((r) => !result.outside.has(rowId(r)))) : undefined}
        selected={{ count: selectedCount, noun }}
        updatedAt={updatedAt}
        now={now}
        order={barOrder}
      />
    </div>
  );
}

/** The mark of a row that expands (ux 0: the row carries its own meaning): a chevron before the row's name that
 * turns as the detail opens. The row itself is the control — its click, Enter and «Открыть» in its menu; a click on
 * the mark opens the detail whatever action is pinned. */
function ExpandMark({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  return (
    <span
      aria-hidden="true"
      data-slot="row-expand"
      data-no-row-click=""
      onClick={onToggle}
      className={cn("flex size-4 shrink-0 items-center justify-center text-muted-foreground transition-transform motion-reduce:transition-none [&_svg]:size-3.5", open && "rotate-90")}
    >
      <ChevronRightIcon />
    </span>
  );
}

interface HeaderCellProps<R> {
  column: TableColumn<R>;
  sort: SortSpec | null;
  onSort: () => void;
  width: number | undefined;
  onResizeStart: (event: ReactPointerEvent<HTMLElement>, column: ColumnLayout) => void;
  onResizeKey: (delta: number) => void;
  onResizeReset: () => void;
}

function HeaderCell<R>({ column, sort, onSort, width, onResizeStart, onResizeKey, onResizeReset }: HeaderCellProps<R>) {
  const dir = sort?.id === column.id ? (sort.desc ? "desc" : "asc") : false;
  const sortable = Boolean(column.rank);
  const sortLabel = `Сортировать: ${column.label}`;
  return (
    <TableHead
      data-col={column.id}
      aria-sort={dir === "desc" ? "descending" : dir === "asc" ? "ascending" : sortable ? "none" : undefined}
      className={cn("relative h-8 border-b px-2 text-xs font-normal text-muted-foreground", column.numeric && "text-right")}
    >
      <div className={cn("flex min-w-0 items-center gap-1", column.numeric && "justify-end")}>
        {column.glossary ? (
          <>
            <GlossaryTooltip term={column.label} entries={column.glossary} className="truncate" />
            {sortable && (
              <button type="button" aria-label={sortLabel} onClick={onSort} className="flex size-4 shrink-0 items-center justify-center rounded-sm outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 [&_svg]:size-3.5">
                {sortIcon(dir)}
              </button>
            )}
          </>
        ) : sortable ? (
          <button type="button" aria-label={sortLabel} onClick={onSort} className={cn("flex min-w-0 items-center gap-1 rounded-sm outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 [&_svg]:size-3.5 [&_svg]:shrink-0", column.numeric && "flex-row-reverse")}>
            <span className="truncate">{column.label}</span>
            {sortIcon(dir)}
          </button>
        ) : (
          <span className="truncate">{column.label}</span>
        )}
      </div>
      {column.resizable && width !== undefined && (
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label={`Ширина столбца «${column.label}»`}
          aria-valuenow={width}
          aria-valuemin={column.min}
          aria-valuemax={column.max}
          tabIndex={0}
          data-slot="resize-handle"
          onPointerDown={(e) => onResizeStart(e, column)}
          onClick={(e) => e.stopPropagation()}
          onDoubleClick={onResizeReset}
          onKeyDown={(e) => {
            if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
            e.preventDefault();
            onResizeKey(e.key === "ArrowRight" ? RESIZE_STEP : -RESIZE_STEP);
          }}
          className="group/resize absolute inset-y-0 right-0 flex w-2 cursor-col-resize justify-end outline-none"
        >
          <span className="my-1.5 w-px bg-border group-hover/resize:w-0.5 group-hover/resize:bg-muted-foreground group-focus-visible/resize:w-0.5 group-focus-visible/resize:bg-ring group-active/resize:w-0.5 group-active/resize:bg-foreground" />
        </div>
      )}
    </TableHead>
  );
}
