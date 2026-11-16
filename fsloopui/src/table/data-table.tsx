// The data table (table #1–15 as refined by rules/ui → Tables 1–5, Live data 2–3, Conventions 11–12, 16; ui →
// Roles: data table). One table for every list of a run: the view gives columns, filters, presets, the search's
// fields and row actions as configuration; the table owns the machinery — the query (query.ts), the held order of a
// live list, selection, the row menu and its pin, expanding rows, keyboard and wheel, widths, the view state.
//
// Built on the library's table with @tanstack/react-table as the column model (the shadcn data-table recipe);
// sorting, filtering, searching and paging stay in query.ts, never in the table model.
import { getCoreRowModel, useReactTable, type ColumnDef, type VisibilityState } from "@tanstack/react-table";
import { ArrowDownIcon, ArrowUpDownIcon, ArrowUpIcon, ChevronRightIcon } from "lucide-react";
import { Fragment, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState, type FocusEvent as ReactFocusEvent, type KeyboardEvent, type Ref, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent, type ReactNode, type WheelEvent as ReactWheelEvent } from "react";
import { capital } from "../../shared/text.ts";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { CLOSE, EmptyState, GlossaryTooltip, HeldStrip, isTextField, Loading, markProps, OPEN_FRAME, OutOfFilter, OverflowCue, PartFailed, TARGET_MARK, useOverflowCue, revealIn, WHEEL_GESTURE_GAP, type EmptyWhen, type Gender, type GlossaryEntry, type HeldNoun, type MarkState } from "@/ui";
import { clampWidth, mergeWidths, placeColumns, RESIZE_STEP, SELECT_WIDTH, sameColumns, sameWidths, tableMinWidth, type ColumnLayout } from "./columns.ts";
import { ColumnsMenu } from "./columns-menu.tsx";
import { CollapseAll } from "./collapse-all.tsx";
import { CUSTOM_LABEL, FilterControl, filterSummary, PRESET_LABEL, presetFills, PresetSelect } from "./filters.tsx";
import { FILL_ROWS, nextSort, normalizeFilters, pageOf, pageOfIndex, presetOf, runQuery, tokens as toTokens, type FilterDef, type Preset, type Rank, type RowsPerPage, type SearchDef, type SortSpec } from "./query.ts";
import { OPEN_ACTION, pinnable, RowMenu, type RowAction } from "./row-menu.tsx";
import { CLEAR_LABEL, Highlight, SearchBox } from "./search.tsx";
import { StatusBar, type BarOrder, type StripForms } from "./status-bar.tsx";
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
  /** The counts strip of the status bar when the list is not split: its forms over the kept rows. */
  counts?: (rows: readonly R[]) => StripForms;
  /** The status bar's order, when the view's differs from the bar's own (a module-level constant). */
  barOrder?: BarOrder;
  /** Toolbar facts, at the right end. */
  toolbarEnd?: ReactNode;
  /** The rows' noun after «Свернуть все» («находки», «юниты»): a table whose rows expand draws the kit's
   * «Свернуть все» in its right cluster, after the facts (improve-4; the design check's convention). */
  collapseAll?: string;
  /** One line under the toolbar — the list's not-found line (design-17): its 28 px reserved from the first paint of a
   * notice until the user closes it, a live change that brings the named row included (craft-2). Falsy: no line. */
  notice?: TableNotice | null | false;
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
  /** The ids the table shows, on every page, in its held order — a live row waiting in the strip is not one of them —
   * reported whenever they change: what a view counts as the list the user reads (code-1). */
  onShownChange?: (ids: readonly string[]) => void;
  /** The table's current row — its Tab stop: the row focus was last on, else the page's first — reported whenever it
   * changes, for a view whose keys act on that row from anywhere in the view (the verdict keys of «Находки»), so the
   * view reads it from the kit, never from the kit's markup (code-1). A table that hands it out marks that row as the
   * current item while focus is in its part outside the rows — the toolbar, the notice, the status bar — so the row
   * those keys act on always shows (craft-3). */
  onCurrentChange?: (id: string | null) => void;
  /** The kit's handle for a view that walks the table's rows itself (the verdict keys of «Находки»): the page's rows
   * and a row's reveal by id, so the view reads none of the kit's markup (code-1). */
  handle?: Ref<TableHandle>;
  /** Binds `/` to this table's search (one per view). */
  searchShortcut?: boolean;
  className?: string;
}

/** What a view asks of the table's rows without its markup (code-1). */
export interface TableHandle {
  /** The ids of the rows the page shows, first to last, as the table last rendered them. */
  pageRows: () => readonly string[];
  /** Focus on the row with this id, brought into the table's own box by the kit's one row reveal (`revealRow`); false
   * when the page does not show it. */
  reveal: (id: string) => boolean;
  /** The row whose own line or open detail holds focus now; null — focus is on no row. */
  focused: () => string | null;
}

/** The notice slot's line: the address its list lacks — a link's `finding=`, `unit=` — and the line itself. */
export interface TableNotice {
  /** The id the address names and the rows do not hold. */
  id: string;
  /** The line; its way out calls `close`, the kit's — which releases the slot and puts focus on the table's Tab stop —
   * after its own work (dropping the address), so no view reaches into the kit's markup (code-2). */
  line: (close: () => void) => ReactNode;
}

export const OPEN_LABEL = "Открыть";
export const CLOSE_LABEL = "Свернуть";

const ARRIVED: Record<HeldNoun["gender"], string> ={ m: "появился", f: "появилась", n: "появилось" };

/** The notice slot's line once the row its address named arrives with a live change (craft-2): «Юнит u33 появился.»,
 * «Находка … появилась.» — the noun and its agreement the table's own. */
const arrivedWords = (noun: HeldNoun) => ({ word: capital(noun.forms[0]), verb: ARRIVED[noun.gender] });
export const arrivedText = (noun: HeldNoun, id: string): string => `${arrivedWords(noun).word} ${id} ${arrivedWords(noun).verb}.`;
export const SELECT_ALL = "Выбрать все строки по фильтрам";
export const SELECT_ROW = "Выбрать строку";

/** A collapsed row's and the header's height (DESIGN.md → Data Table: h-8), until the table measures its own. */
const ROW_HEIGHT = 32;
/** «по экрану» before the table's box is measured (a test without layout). */
const FILL_FALLBACK = 50;

// An open row and its detail read as one block (p1 cand-11) inside `@/ui`'s one `OPEN_FRAME`, the frame
// `ExpandingFindings` draws too (design-4): the row its top and sides, the detail its sides and bottom; a link's
// target keeps its ink mark on the row, and the ink frames its detail too.

/** The current item of a list (the design check of pass 3): the muted ground plus 1 px of ink — on a table row the
 * inset `shadow-target`, the target mark's own form; it wins over an edge mark, as on the rail. */
const CURRENT_MARK = TARGET_MARK;

/** The events that end a drag over the selection column. */
const ENDS = ["pointerup", "pointercancel", "blur"] as const;

/** The sort icon in the header's muted ink at full strength (improve-3): a dimmed idle icon fell to about 2:1 on the
 * dark paper, so a column's sort read only on hover. */
const sortIcon = (dir: false | "asc" | "desc") => (dir === "desc" ? <ArrowDownIcon /> : dir === "asc" ? <ArrowUpIcon /> : <ArrowUpDownIcon />);

/** Focus on a table row, brought into the table's own box (improve-3): only that box scrolls, through `revealIn` — a
 * row under the sticky header to just under it, a row past the box's end by as little as brings it in, a row in view
 * not at all — never `scrollIntoView`, which also scrolls the page around the table. The table's arrows use it, and so
 * does a view that moves focus to a row of its own accord (the verdict keys of «Находки»). */
export function revealRow(tr: HTMLElement): void {
  const box = tr.closest<HTMLElement>("[data-slot=table-scroll]");
  if (!box) return tr.focus({ preventScroll: true });
  revealIn(box, tr, { head: box.querySelector("thead")?.getBoundingClientRect().height || ROW_HEIGHT });
}

/** An element inside a row that handles its own click. */
const ownClick = (target: EventTarget | null, row: HTMLElement): boolean => {
  const el = target instanceof Element ? target.closest("a, button, input, textarea, select, label, [role='checkbox'], [role='separator'], [data-no-row-click]") : null;
  return el !== null && el !== row && row.contains(el);
};

export function DataTable<R>(props: DataTableProps<R>) {
  const { id, runKey, label, rows, failed, rowId, rowTitle, noun, columns, filters = [], presets = [], search, actions = [], detail, defaultSort = null, defaultPaged = true, empty, counts, barOrder, toolbarEnd, collapseAll, notice, marks, updatedAt, now, searchShortcut = true, className } = props;
  const [tprefs, setT] = useTableView(id, { sort: defaultSort, paged: defaultPaged });
  const [rprefs, setR] = useRunView(id, runKey);
  // the row the notice's «Открыть» brought in (craft-2): shown, opened and marked as a link's row is, while the caller
  // names none of its own
  const [opened, setOpened] = useState<string | null>(null);
  const target = props.target ?? opened;

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
  // the ids shown, handed to the view whenever they change (code-1): never the query's result, which holds the rows
  // that wait in the strip too
  const shownKey = useRef<string | null>(null);
  const onShownChange = props.onShownChange;
  useEffect(() => {
    if (!result) return;
    const key = display.join("\n");
    if (key === shownKey.current) return;
    shownKey.current = key;
    onShownChange?.(display);
  });

  // ── paging, open rows, selection: in memory; the page and open rows reported for the URL ───────
  // «по экрану» (table #1 Fill): the rows the scroll box shows, measured from a collapsed row; until measured — a
  // test without layout — 50 a page
  const fillMode = tprefs.paged && tprefs.pageSize === FILL_ROWS;
  const [fill, setFill] = useState<number | null>(null);
  const size: RowsPerPage | null = !tprefs.paged ? null : tprefs.pageSize === FILL_ROWS ? (fill ?? FILL_FALLBACK) : tprefs.pageSize;
  const [pageState, setPageState] = useState(props.page ?? 1);
  const [seenSize, setSeenSize] = useState(size);
  if (size !== seenSize) {
    // a new page size keeps a link's row in view while it is on the page — «по экрану» measures the box only after
    // the first render, so a link's page is first taken at 50 rows (p1 craft-1) — and otherwise the page's first row
    setSeenSize(size);
    if (typeof seenSize === "number") {
      const at = target ? display.indexOf(target) : -1;
      const keep = at >= 0 && pageOfIndex(at, seenSize) === pageState ? at : (pageState - 1) * seenSize;
      setPageState(pageOfIndex(keep, size));
    }
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
  /** A row the caller opened — a verdict key moving on to the next row — brought into view once, as one the user
   * expands; a new object for each, so the same row opened again counts again. */
  const [callerOpened, setCallerOpened] = useState<{ id: string } | null>(null);
  if (props.open !== undefined && props.open !== seenOpenProp) {
    setSeenOpenProp(props.open);
    const added = props.open.filter((x) => !openState.includes(x)).at(-1);
    if (added) setCallerOpened({ id: added });
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
  // the current row handed to the view on every change (code-1)
  const onCurrentChange = props.onCurrentChange;
  const currentReported = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (!onCurrentChange || !result || currentReported.current === tabRow) return;
    currentReported.current = tabRow;
    onCurrentChange(tabRow);
  });
  /** Focus in the table's part outside its rows and its text fields — where a digit is no text and the view's keys act
   * on the current row, which then wears the current item's mark (craft-3). */
  const [aside, setAside] = useState(false);
  const onFocusIn = (event: ReactFocusEvent<HTMLDivElement>) => setAside(!isTextField(event.target) && !(event.target as Element).closest("tr[data-row-id], tr[data-detail-for]"));
  const onFocusOut = (event: ReactFocusEvent<HTMLDivElement>) => {
    if (!(event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget))) setAside(false);
  };
  /** Focus moved to a row by the keyboard or by a view: the kit's one row reveal (`revealRow`). */
  const revealRowId = (rid: string): boolean => {
    const el = rowEls.current.get(rid);
    if (el) revealRow(el);
    return Boolean(el);
  };
  useEffect(() => {
    if (!pendingFocus.current) return;
    const rid = pendingFocus.current === "first" ? pageIds[0] : pageIds[pageIds.length - 1];
    pendingFocus.current = null;
    if (rid) revealRowId(rid);
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
    revealRowId(rid);
  };

  // ── the cue of rows or a detail past the box's bottom edge (improve-3; the design check's convention): `@/ui`'s
  // one cue, shown while they run past it and hidden at the scroll's end (code-29) ──────────────────────
  const { past, measure: measurePast } = useOverflowCue(scroller, "bottom", tableShown);
  // ── a table wider than its box (its columns' floor past a narrow region, craft-1): the cue at the box's right edge
  // while the table runs past it, and an open detail's content held to the width the box shows, at its left edge, so
  // what a detail says never runs past the box — measured before paint and on every resize of the box ───────────
  const { past: pastEnd, measure: measureEnd } = useOverflowCue(scroller, "end", tableShown);
  const [boxWidth, setBoxWidth] = useState<number | null>(null);
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!tableShown || !el) return;
    // not laid out (a test without layout): the detail spans the table, as before any measure
    const measure = () => setBoxWidth(el.clientWidth > 0 ? el.clientWidth : null);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [tableShown]);

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
  // the view's handle (code-1): the rows this render draws, set in the commit's layout phase, so a view's effect after a
  // page turn reads the page it asked for
  const drawn = tableShown ? pageRowsData.map(rowId) : [];
  const focusedRow = (): string | null => {
    const at = document.activeElement;
    const tr = at instanceof Element ? at.closest<HTMLElement>("tr[data-row-id], tr[data-detail-for]") : null;
    if (!tr || !scroller.current?.contains(tr)) return null;
    return tr.dataset.rowId ?? tr.dataset.detailFor ?? null;
  };
  useImperativeHandle(props.handle, () => ({ pageRows: () => drawn, reveal: revealRowId, focused: focusedRow }));
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
  // the right cluster: the view's facts, then «Свернуть все» where rows expand — always in its box (Strict 1)
  const collapse = detail && collapseAll ? <CollapseAll what={collapseAll} open={openState.length > 0} onCollapse={() => setOpen([])} /> : null;
  const end = toolbarEnd && collapse ? (
    <span className="flex items-center gap-2">
      {toolbarEnd}
      {collapse}
    </span>
  ) : (toolbarEnd ?? collapse);
  if (end) items.push({ id: "facts", kind: "pinned", end: true, node: end });
  items.push({
    id: "columns",
    kind: "pinned",
    end: !end,
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
  /** The link the scroll was taken for, and whether on its final layout: «по экрану» before its first measure is not. */
  const linkScrolled = useRef<{ target: string | null; final: boolean } | null>(null);
  const layoutFinal = !fillMode || fill !== null;
  useLayoutEffect(() => {
    // once per link: the row it names, on its page — and once more when «по экрану» first measures the box and the
    // page re-forms around it, so the scroll is taken on the final layout, not the 50-row one (p1 craft-1). A later
    // measure (a window resized) or page size the user picks leaves the box's scroll to the user (Strict 1).
    // a new link — or none, so the same link followed again later counts again — starts over
    if (linkScrolled.current?.target !== target) linkScrolled.current = null;
    if (!targetOnPage || !target) return;
    const taken = linkScrolled.current;
    if (taken && (taken.final || !layoutFinal)) return;
    linkScrolled.current = { target, final: layoutFinal };
    scrollToTop(target);
    // `size`: the measured page size is the layout's change; the scroll reads the DOM it produced
  }, [targetOnPage, target, size, layoutFinal]);
  const handledOpen = useRef<{ id: string } | null>(null);
  useLayoutEffect(() => {
    let rid = expanded.current;
    expanded.current = null;
    if (callerOpened && handledOpen.current !== callerOpened) {
      handledOpen.current = callerOpened;
      rid = callerOpened.id;
    }
    const box = scroller.current;
    const detailRow = rid && box ? [...box.querySelectorAll<HTMLElement>("tr[data-detail-for]")].find((tr) => tr.dataset.detailFor === rid) : null;
    if (!rid || !box || !detailRow) return;
    const end = box.getBoundingClientRect().top + box.clientTop + box.clientHeight;
    if (detailRow.getBoundingClientRect().bottom > end) scrollToTop(rid);
  });

  // ── the notice slot (design-17): held from a notice's first paint until the user closes it (craft-2) ────────
  // A live change that brings the row the address named takes the view's line away; the slot keeps its 28 px and says
  // the row arrived, with «Открыть» and «Закрыть», so the table under it never jumps. A notice its view drops while
  // the row is still missing — the address went another way — releases the slot.
  const [slotFor, setSlotFor] = useState<string | null>(null);
  if (notice && notice.id !== slotFor) setSlotFor(notice.id);
  const arrived = !notice && slotFor !== null && byId.has(slotFor) ? slotFor : null;
  if (!notice && slotFor !== null && arrived === null) setSlotFor(null);
  /** The slot's way out, the kit's own (code-2): the slot released, focus on the table's Tab stop. */
  const closeNotice = () => {
    setSlotFor(null);
    const el = tabRow ? rowEls.current.get(tabRow) : undefined;
    el?.focus({ preventScroll: true });
  };
  /** A row to focus once it renders on its page: the arrived row «Открыть» brought in. */
  const focusOnRender = useRef<string | null>(null);
  const openArrived = (rid: string) => {
    setSlotFor(null);
    setOpened(rid);
    if (!openSet.has(rid)) setOpen([...openState, rid]);
    setFocusId(rid);
    focusOnRender.current = rid;
  };
  useEffect(() => {
    const el = focusOnRender.current ? rowEls.current.get(focusOnRender.current) : undefined;
    if (!el) return;
    focusOnRender.current = null;
    el.focus({ preventScroll: true });
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
  else if (!display.length) {
    // a named view with filters of its own names itself and what fills it; its filters are the view, so only the
    // search is listed beside it (rules/ui → Conventions 16; improve-4). A view that holds rows the search alone hides
    // names the search as the cause, and its way out clears the search and keeps the view (craft-6).
    const named = presetOf(rprefs.filters, presets);
    const term = rprefs.search.trim();
    const hid = term && result.unsearched > 0 ? { search: term, count: result.unsearched } : undefined;
    const view = named && Object.keys(normalizeFilters(named.filters)).length ? { label: named.label, fills: presetFills(named, filters), hid } : undefined;
    body = (
      <div className="flex size-full items-center justify-center rounded-lg border">
        <EmptyState
          form="filtered"
          noun={noun.forms}
          filters={filterSummary(filters, view ? {} : rprefs.filters, rprefs.search)}
          view={view}
          resetLabel={view?.hid ? CLEAR_LABEL : undefined}
          onReset={() => setQuery(view?.hid ? { search: "" } : { filters: {}, search: "" })}
        />
      </div>
    );
  } else
    body = (
      <div
        ref={scroller}
        data-slot="table-scroll"
        onWheel={onWheel}
        onScroll={() => {
          measurePast();
          measureEnd();
        }}
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
                const current = Boolean(onCurrentChange) && aside && rid === tabRow;
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
                      data-current={current ? "" : undefined}
                      aria-expanded={detail ? isOpen : undefined}
                      tabIndex={rid === tabRow ? 0 : -1}
                      onClick={(e) => onRowClick(e, row)}
                      onFocus={(e) => e.target === e.currentTarget && setFocusId(rid)}
                      onContextMenu={() => onContextMenu(rid)}
                      className={cn("h-8 outline-none focus:ring-2 focus:ring-ring focus:ring-inset data-[menu]:bg-muted", pin ? "cursor-pointer" : "cursor-default", isOpen && [OPEN_FRAME.muted, OPEN_FRAME.row], mp.className, current && CURRENT_MARK)}
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
                        <TableCell colSpan={ordered.length + (slack ? 1 : 2)} className={cn("border-b bg-muted p-0 whitespace-normal", rid === target ? OPEN_FRAME.target : OPEN_FRAME.muted, OPEN_FRAME.detail)}>
                          <div data-slot="row-detail" className="sticky left-0 px-4 py-3" style={boxWidth === null ? undefined : { width: boxWidth }}>
                            {detail(row)}
                          </div>
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
    <div data-slot="data-table" onFocus={onFocusIn} onBlur={onFocusOut} className={cn("@container flex size-full min-h-0 flex-col gap-2", className)}>
      <AdaptiveToolbar items={items} label={`Фильтры: ${label}`} />
      {(notice || arrived !== null) && (
        <div data-slot="table-notice" className="flex h-7 shrink-0 items-center overflow-hidden text-sm whitespace-nowrap">
          {notice ? notice.line(closeNotice) : arrived !== null && <ArrivedLine noun={noun} id={arrived} onOpen={() => openArrived(arrived)} onClose={closeNotice} />}
        </div>
      )}
      <div ref={region} data-slot="table-region" className="relative min-h-0 flex-1">
        {body}
        {tableShown && <OverflowCue edge="bottom" shown={past} className="rounded-lg" />}
        {tableShown && <OverflowCue edge="end" shown={pastEnd} className="rounded-lg" />}
      </div>
      <HeldStrip counts={held.counts} noun={noun} onApply={() => setFrozen({ key: queryKey, ids: resultIds })} className="-mt-2 border-t-0" />
      <StatusBar
        noun={noun.forms}
        shown={result?.matched}
        total={result?.total}
        pager={result && size ? { page: pg.page, pageCount: pg.pageCount, onPage: (p) => goPage(p), pageSize: tprefs.pageSize, onPageSize: (s) => setT({ pageSize: s }) } : null}
        strip={result && counts ? counts(result.rows.filter((r) => !result.outside.has(rowId(r)))) : undefined}
        selected={{ count: selectedCount, noun }}
        updatedAt={updatedAt}
        now={now}
        order={barOrder}
      />
    </div>
  );
}

/** The notice slot's line once the row its address named arrived (craft-2): one line like the not-found line it
 * replaces — the sentence truncating, whole in its title, the id in mono — then «Открыть» and «Закрыть», which keep
 * their boxes; a polite status, so a screen reader hears that the row came. */
function ArrivedLine({ noun, id, onOpen, onClose }: { noun: HeldNoun; id: string; onOpen: () => void; onClose: () => void }) {
  const { word, verb } = arrivedWords(noun);
  const text = arrivedText(noun, id);
  return (
    <p role="status" data-slot="notice-arrived" className="m-0 flex max-w-measure min-w-0 items-baseline gap-x-2">
      <span className="min-w-0 truncate" title={text}>
        {word} <span className="font-mono text-xs">{id}</span> {verb}.
      </span>
      <Button variant="ghost" size="xs" className="shrink-0" onClick={onOpen}>
        {OPEN_LABEL}
      </Button>
      <Button variant="ghost" size="xs" className="shrink-0" onClick={onClose}>
        {CLOSE}
      </Button>
    </p>
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
            {/* the box that truncates the term clips at its padding edge: 4 px above and below hold the dotted
                underline's 4 px offset inside it, so the term keeps its mark (craft-4), centred in the 32 px header */}
            <GlossaryTooltip term={column.label} entries={column.glossary} className="truncate py-1" />
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
