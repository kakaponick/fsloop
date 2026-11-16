// The row context menu (table #4, #13; rules/ui → Tables 4): one menu over every row, built on u2's Menu. Its header
// names the row — or the selection, «12 находок», «28 из 30 находок» when some selected ids are gone from the data;
// the items are the view's, each marked for one row, a selection or both, so the menu for one row and for several
// differ. An item whose object can never exist on these rows is not listed (`hidden`): it earns its place by the
// row's need. A left click and Enter run the pinned item; the pin is chosen here and kept with the table's view state
// in the browser.
import type { ReactNode } from "react";
import { count, num, type Forms } from "../../shared/text.ts";
import { copyLabel, copyText, Menu, type MenuItem } from "@/ui";
import { ofTotal } from "./status-bar.tsx";

export type ActionScope = "single" | "multi" | "both";

export interface RowAction<R> {
  /** Stable: the pin stores it. */
  id: string;
  label: string | ((rows: readonly R[]) => string);
  /** One row, a selection of several, or either (table #4: single-only and multi-only items). */
  scope?: ActionScope;
  run: (rows: readonly R[]) => void;
  /** Items group by this number, a rule between groups. */
  group?: number;
  /** The item's object can never exist on these rows (no unit, no report): the item is not listed. */
  hidden?: (rows: readonly R[]) => boolean;
  /** Why the action cannot run on these rows now, while it may later; the item stays listed, disabled. */
  blocked?: (rows: readonly R[]) => string | undefined;
}

/** «Скопировать <что>» through the copy helper; a selection's values joined by newlines (the design check). */
export function copyAction<R>(id: string, what: string, value: (row: R) => string | null | undefined, scope: ActionScope = "both", group = 1): RowAction<R> {
  return {
    id,
    label: copyLabel(what),
    scope,
    group,
    run: (rows) => void copyText(rows.map(value).filter((v): v is string => Boolean(v)), what),
  };
}

export const PIN_LABEL = "Действие по клику";
/** The title of a degraded header: some selected rows are gone from the data. */
export const PARTLY_GONE = "Не все выбранные строки остались в данных: меню действует на те, что есть";
export const OPEN_ACTION = "open";
const PIN_ID = "pin";

/** The actions that apply to these rows: their scope fits the count, and their object can exist on them. */
export const actionsFor = <R,>(actions: readonly RowAction<R>[], rows: readonly R[]): RowAction<R>[] =>
  actions.filter((a) => ((a.scope ?? "both") === "both" || (a.scope === "single" ? rows.length === 1 : rows.length > 1)) && !a.hidden?.(rows));

/** A single-row action can be pinned to the left click (table #13). */
export const pinnable = <R,>(actions: readonly RowAction<R>[]): RowAction<R>[] => actions.filter((a) => (a.scope ?? "both") !== "multi");

export const actionLabel = <R,>(action: RowAction<R>, rows: readonly R[]): string => (typeof action.label === "function" ? action.label(rows) : action.label);

/** The menu's header: the row's title, the selection's count with its noun, or «28 из 30 находок». */
export function menuHeader(titles: readonly string[], requested: number, noun: Forms): string {
  if (requested <= 1 && titles.length === 1) return titles[0];
  if (titles.length < requested) return `${num(titles.length)} ${ofTotal(requested, noun)}`;
  return count(titles.length, noun);
}

/** The menu's groups for these rows: the actions by their group number, then the pin's choice. */
export function rowMenuGroups<R>(actions: readonly RowAction<R>[], rows: readonly R[], pin: string, onPin: (id: string) => void): MenuItem[][] {
  if (!rows.length) return [];
  const items = actionsFor(actions, rows);
  const numbers = [...new Set(items.map((a) => a.group ?? 0))].sort((a, b) => a - b);
  const groups: MenuItem[][] = numbers.map((g) =>
    items
      .filter((a) => (a.group ?? 0) === g)
      .map((a) => ({ id: a.id, label: actionLabel(a, rows), blocked: a.blocked?.(rows), shortcut: a.id === pin && rows.length === 1 ? "Enter" : undefined, onSelect: () => a.run(rows) })),
  );
  const pins = pinnable(actions);
  if (pins.length > 1) groups.push([{ id: PIN_ID, label: PIN_LABEL, value: pin, onChoose: onPin, choices: pins.map((a) => ({ value: a.id, label: actionLabel(a, rows.slice(0, 1)) })) }]);
  return groups;
}

export interface RowMenuProps<R> {
  /** The area the menu opens on: the table's body. */
  children: ReactNode;
  /** The rows the menu acts on: the row it opened on, or every selected row the table knows. */
  rows: readonly R[];
  /** How many rows were asked for: the selection's size, which may exceed what the data still holds. */
  requested: number;
  title: (row: R) => string;
  noun: Forms;
  actions: readonly RowAction<R>[];
  pin: string;
  onPin: (id: string) => void;
  onOpenChange?: (open: boolean) => void;
  label: string;
}

export function RowMenu<R>({ children, rows, requested, title, noun, actions, pin, onPin, onOpenChange, label }: RowMenuProps<R>) {
  const header = rows.length ? { text: menuHeader(rows.map(title), requested, noun), title: rows.length < requested ? PARTLY_GONE : rows.length === 1 ? title(rows[0]) : undefined } : null;
  return (
    <Menu kind="context" label={label} header={header} groups={rowMenuGroups(actions, rows, pin, onPin)} onOpenChange={onOpenChange} className="max-w-96 min-w-56">
      {children}
    </Menu>
  );
}
