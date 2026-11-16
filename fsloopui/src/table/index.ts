// fsloopUI's table machinery (DESIGN.md → Data Table; ui → Roles: data table, adaptive toolbar, status bar): the
// table, its toolbar, search with history, filter controls, columns and row menus, the status bar and the view-state
// store — also for views without a table. A view imports from here, never a second copy.
export { assertLayout, clampWidth, defaultColumns, fitsRegion, FRAME, headerWidth, mergeWidths, moveColumn, placeColumns, SELECT_WIDTH, SLACK_MIN, tableMinWidth, toggleColumn, type ColumnLayout, type ColumnsState } from "./columns.ts";
export { ColumnsMenu, COLUMNS_LABEL, type ColumnsMenuProps } from "./columns-menu.tsx";
export { CLOSE_LABEL, DataTable, OPEN_LABEL, type CellContext, type DataTableProps, type EmptyWhen, type PartFailure, type TableColumn } from "./data-table.tsx";
export { ANY, ANY_LABEL, CUSTOM_LABEL, FilterControl, filterSummary, isSelectFilter, PRESET_LABEL, PresetSelect } from "./filters.tsx";
export { pack, type PackItem, type PackKind } from "./pack.ts";
export {
  ALL_ROWS,
  FILL_ROWS,
  hitRanges,
  nextSort,
  pageOf,
  pageOfIndex,
  presetOf,
  runQuery,
  tokens,
  type FilterDef,
  type FilterOption,
  type Filters,
  type PageSize,
  type Preset,
  type QueryResult,
  type QueryState,
  type Rank,
  type SearchDef,
  type SortSpec,
} from "./query.ts";
export { actionsFor, copyAction, menuHeader, OPEN_ACTION, RowMenu, rowMenuGroups, type ActionScope, type RowAction } from "./row-menu.tsx";
export { Highlight, SearchBox, type SearchBoxProps } from "./search.tsx";
export { ageText, DEFAULT_BAR_ORDER, Pager, selectedText, shownText, StatusBar, StripCount, type BarOrder, type BarSlot, type PagerProps, type StatusBarProps } from "./status-bar.tsx";
export { AdaptiveToolbar, type ToolbarItem } from "./toolbar.tsx";
export { pushHistory, useRunView, useTableView, type RunPrefs, type TablePrefs } from "./view-state.ts";
