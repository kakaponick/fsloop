// Column placement and widths (table #3, #10, #15): one state owns visibility and order, one map per table owns
// widths, and both are merged, clamped and summed here — never re-derived in a component.
//
// - Placement: the default order is the markup order; a stored order keeps the ids it knows, drops gone ones and
//   puts new ones at their markup place. The primary column is always visible.
// - Widths: a fixed width per column, clamped to its bounds; exactly one column is width-free and absorbs the
//   slack under the fixed layout. The table's minimum width is the sum, so a region narrower than it scrolls.

export interface ColumnLayout {
  id: string;
  /** The header and the columns menu read the same label. */
  label: string;
  /** The fixed width in px; absent on the one width-free column. */
  width?: number;
  /** The width-free column's floor, or a resizable column's bounds. */
  min?: number;
  max?: number;
  /** A variable-content column the user may widen (table #15). */
  resizable?: boolean;
  /** Always visible: the row's identifier. */
  primary?: boolean;
  /** Hidden until the user shows it in the columns menu. */
  hidden?: boolean;
}

/** The persisted placement: the full order and the hidden ids. */
export interface ColumnsState {
  order: string[];
  hidden: string[];
}

/** The selection column's width (table #5; the design check: 32 px). */
export const SELECT_WIDTH = 32;
/** A width-free column's floor when it names none. */
export const SLACK_MIN = 200;
/** A resizable column's bounds when it names none. */
export const RESIZE_MIN = 64;
export const RESIZE_MAX = 640;
/** One keyboard nudge of a resize handle. */
export const RESIZE_STEP = 16;
/** The table's frame: its two hairline borders and the stable scrollbar gutter (rules/ui → Strict 1). */
export const FRAME = 2 + 16;

/** Throws unless exactly one column is width-free and every resizable column has a width — the slack rule. */
export function assertLayout(columns: readonly ColumnLayout[]): void {
  const free = columns.filter((c) => c.width === undefined);
  if (free.length !== 1) throw new Error(`table: ${free.length} width-free columns (${free.map((c) => c.id).join(", ")}), exactly one absorbs the slack`);
  const bad = columns.find((c) => c.resizable && c.width === undefined);
  if (bad) throw new Error(`table: column «${bad.id}» is resizable but width-free`);
  if (!columns.some((c) => c.primary)) throw new Error("table: no primary column");
}

export const defaultColumns = (columns: readonly ColumnLayout[]): ColumnsState => ({ order: columns.map((c) => c.id), hidden: columns.filter((c) => c.hidden && !c.primary).map((c) => c.id) });

/** The columns in their placed order, each with its visibility. */
export function placeColumns<C extends ColumnLayout>(columns: readonly C[], state: ColumnsState | null | undefined): { column: C; visible: boolean }[] {
  const byId = new Map(columns.map((c) => [c.id, c]));
  const base = defaultColumns(columns);
  const stored = state ? state.order.filter((id) => byId.has(id)) : base.order;
  const order = [...stored];
  // a column the stored order lacks goes after its markup predecessor
  columns.forEach((c, i) => {
    if (order.includes(c.id)) return;
    const before = columns
      .slice(0, i)
      .map((x) => x.id)
      .reverse()
      .find((id) => order.includes(id));
    order.splice(before ? order.indexOf(before) + 1 : 0, 0, c.id);
  });
  const hidden = new Set(state ? state.hidden.filter((id) => byId.has(id)) : base.hidden);
  // a new column takes its default visibility
  if (state) for (const c of columns) if (!state.order.includes(c.id) && c.hidden) hidden.add(c.id);
  return order.map((id) => {
    const column = byId.get(id) as C;
    return { column, visible: Boolean(column.primary) || !hidden.has(id) };
  });
}

/** Shows or hides one column; the primary one stays. */
export function toggleColumn(columns: readonly ColumnLayout[], state: ColumnsState | null | undefined, id: string, visible: boolean): ColumnsState {
  const placed = placeColumns(columns, state);
  const order = placed.map((p) => p.column.id);
  const hidden = placed.filter((p) => !p.visible).map((p) => p.column.id);
  const primary = columns.find((c) => c.id === id)?.primary;
  return { order, hidden: visible || primary ? hidden.filter((h) => h !== id) : [...hidden.filter((h) => h !== id), id] };
}

/** Moves one column by `delta` places (the keyboard path of reordering), or to the index of another (a drop). */
export function moveColumn(columns: readonly ColumnLayout[], state: ColumnsState | null | undefined, id: string, to: number | { before: string }): ColumnsState {
  const placed = placeColumns(columns, state);
  const order = placed.map((p) => p.column.id);
  const hidden = placed.filter((p) => !p.visible).map((p) => p.column.id);
  const from = order.indexOf(id);
  if (from === -1) return { order, hidden };
  order.splice(from, 1);
  let at = typeof to === "number" ? Math.min(Math.max(0, from + to), order.length) : order.indexOf(to.before);
  if (at === -1) at = order.length;
  order.splice(at, 0, id);
  return { order, hidden };
}

export function sameColumns(columns: readonly ColumnLayout[], state: ColumnsState | null | undefined): boolean {
  const a = placeColumns(columns, state);
  const b = placeColumns(columns, null);
  return a.every((p, i) => p.column.id === b[i].column.id && p.visible === b[i].visible);
}

/** A column's width clamped to its bounds. */
export function clampWidth(column: ColumnLayout, width: number): number {
  const min = column.min ?? RESIZE_MIN;
  const max = column.max ?? RESIZE_MAX;
  return Math.round(Math.min(max, Math.max(min, width)));
}

/** The stored widths merged over the defaults: only resizable columns take a stored width, clamped; others keep
 * their own; the width-free column has none. */
export function mergeWidths(columns: readonly ColumnLayout[], stored: Readonly<Record<string, number>> | null | undefined): Record<string, number> {
  const out: Record<string, number> = {};
  for (const c of columns) {
    if (c.width === undefined) continue;
    const s = stored?.[c.id];
    out[c.id] = c.resizable && typeof s === "number" && Number.isFinite(s) ? clampWidth(c, s) : c.width;
  }
  return out;
}

/** Whether every stored width equals its default. */
export const sameWidths = (columns: readonly ColumnLayout[], stored: Readonly<Record<string, number>> | null | undefined): boolean =>
  columns.every((c) => c.width === undefined || mergeWidths(columns, stored)[c.id] === c.width);

/** The table's minimum width: the selection column, every visible fixed width and the width-free column's floor. */
export function tableMinWidth(visible: readonly ColumnLayout[], widths: Readonly<Record<string, number>>, { select = true } = {}): number {
  let sum = select ? SELECT_WIDTH : 0;
  for (const c of visible) sum += c.width === undefined ? (c.min ?? SLACK_MIN) : (widths[c.id] ?? c.width);
  // with the width-free column hidden, a trailing spacer absorbs the slack and needs no floor
  return sum;
}

/** Whether the table fits a region of `regionWidth` without a horizontal scroll. */
export const fitsRegion = (visible: readonly ColumnLayout[], widths: Readonly<Record<string, number>>, regionWidth: number): boolean => tableMinWidth(visible, widths) + FRAME <= regionWidth;

/** The width a header needs: its label at the 12 px header size (a Cyrillic letter about 6.6 px), the sort icon
 * and the cell's padding (table #10: a fixed width clears the longest header plus the sort icon). */
export function headerWidth(label: string, { sortable = true } = {}): number {
  return Math.ceil(label.length * 6.6) + (sortable ? 20 : 0) + 16;
}
