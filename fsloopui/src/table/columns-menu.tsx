// The columns menu (table #3): the one shared menu of a table's columns — an icon-only trigger named by its label,
// a checkbox row per column that can hide, drag to reorder with a keyboard path (Alt + ↑/↓ on a row), the page split
// switch, and «Сбросить» only while something differs from the defaults. Placement is computed by columns.ts.
import { Columns3Icon, GripVerticalIcon } from "lucide-react";
import { useState, type KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverHeader, PopoverTitle, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { Hint, Keys } from "@/ui";
import { moveColumn, placeColumns, toggleColumn, type ColumnLayout, type ColumnsState } from "./columns.ts";

export const COLUMNS_LABEL = "Столбцы";
export const PAGED_LABEL = "Делить строки на страницы";
export const RESET_COLUMNS = "Сбросить столбцы и страницы";
export const ALWAYS_SHOWN = "всегда виден";

export interface ColumnsMenuProps {
  columns: readonly ColumnLayout[];
  state: ColumnsState | null;
  onChange: (state: ColumnsState) => void;
  /** The page split (table #1: switched off here, the counts strip takes its slot). */
  paged: boolean;
  onPagedChange: (paged: boolean) => void;
  /** Something differs from the defaults: columns, widths or the split. */
  changed: boolean;
  onReset: () => void;
  /** A table id, so two tables' rows never share an element id. */
  id: string;
}

export function ColumnsMenu({ columns, state, onChange, paged, onPagedChange, changed, onReset, id }: ColumnsMenuProps) {
  const [dragging, setDragging] = useState<string | null>(null);
  const placed = placeColumns(columns, state);

  const onRowKey = (event: KeyboardEvent<HTMLElement>, columnId: string) => {
    if (!event.altKey || (event.key !== "ArrowUp" && event.key !== "ArrowDown")) return;
    event.preventDefault();
    onChange(moveColumn(columns, state, columnId, event.key === "ArrowUp" ? -1 : 1));
    // keep focus on the moved row's control after the list re-renders
    const target = event.currentTarget.querySelector<HTMLElement>("button, [tabindex]") ?? event.currentTarget;
    requestAnimationFrame(() => target.focus());
  };

  return (
    <Popover>
      <Hint label={COLUMNS_LABEL}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="icon-sm" aria-label={COLUMNS_LABEL} data-slot="columns-menu-trigger">
            <Columns3Icon />
          </Button>
        </PopoverTrigger>
      </Hint>
      <PopoverContent align="end" className="w-64 gap-2 p-2">
        <PopoverHeader className="px-1">
          <PopoverTitle className="text-sm">{COLUMNS_LABEL}</PopoverTitle>
        </PopoverHeader>
        <ul role="list" aria-label={COLUMNS_LABEL} className="m-0 flex list-none flex-col p-0">
          {placed.map(({ column, visible }) => {
            const control = `${id}-col-${column.id}`;
            return (
              <li
                key={column.id}
                data-column={column.id}
                draggable
                onDragStart={(event) => {
                  setDragging(column.id);
                  event.dataTransfer.effectAllowed = "move";
                }}
                onDragOver={(event) => {
                  if (dragging && dragging !== column.id) event.preventDefault();
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  if (dragging && dragging !== column.id) onChange(moveColumn(columns, state, dragging, { before: column.id }));
                  setDragging(null);
                }}
                onDragEnd={() => setDragging(null)}
                onKeyDown={(event) => onRowKey(event, column.id)}
                className={cn("flex h-7 items-center gap-2 rounded-md px-1 hover:bg-muted", dragging === column.id && "bg-muted")}
              >
                <GripVerticalIcon aria-hidden="true" className="size-3.5 shrink-0 cursor-grab text-muted-foreground" />
                {column.primary ? (
                  <span className="flex min-w-0 flex-1 items-baseline justify-between gap-2">
                    <span className="truncate" tabIndex={0} aria-label={`${column.label}: ${ALWAYS_SHOWN}`}>
                      {column.label}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">{ALWAYS_SHOWN}</span>
                  </span>
                ) : (
                  <>
                    <Checkbox id={control} checked={visible} onCheckedChange={(v) => onChange(toggleColumn(columns, state, column.id, v === true))} />
                    <Label htmlFor={control} className="min-w-0 flex-1 truncate font-normal">
                      {column.label}
                    </Label>
                  </>
                )}
              </li>
            );
          })}
        </ul>
        <p className="m-0 flex items-center gap-1 px-1 text-xs text-muted-foreground">
          Порядок: перетащите строку или <Keys codes={["Alt", "ArrowUp"]} />
        </p>
        <Separator />
        <div className="flex h-7 items-center justify-between gap-2 px-1">
          <Label htmlFor={`${id}-paged`} className="font-normal">
            {PAGED_LABEL}
          </Label>
          <Switch id={`${id}-paged`} size="sm" checked={paged} onCheckedChange={onPagedChange} />
        </div>
        {changed && (
          <Button variant="ghost" size="sm" className="justify-start" onClick={onReset}>
            {RESET_COLUMNS}
          </Button>
        )}
      </PopoverContent>
    </Popover>
  );
}
