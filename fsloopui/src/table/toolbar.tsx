// The adaptive toolbar (table #14; ui → Roles: adaptive toolbar): one line; what does not fit folds into «…», right to
// left — ordinary items first, sticky ones after them, pinned ones never. It measures its own box and its items (a
// container's width, never the viewport's: rules/ui → Layout 1) and asks the packing module which items fold; the
// change commits before the frame paints, so nothing shows unfolded and then jumps (Strict 1). A folded control that
// holds a non-default value marks the «…» trigger, so no one is filtered by a control they cannot see.
import { EllipsisIcon } from "lucide-react";
import { useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { flushSync } from "react-dom";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Dot, Hint } from "@/ui";
import { pack, type PackKind } from "./pack.ts";

export interface ToolbarItem {
  /** Required and stable: the packing remembers widths by it. */
  id: string;
  kind: PackKind;
  node: ReactNode;
  /** Flexible: grows into the room left, its floor counted (the search). */
  flex?: boolean;
  /** Holds a non-default value: marks «…» when folded. */
  active?: boolean;
  /** Starts the right cluster: pushed to the line's end. */
  end?: boolean;
  /** Only for a control whose value changes by itself when another control changes — «Вид», which turns «Свой
   * набор» when a filter is changed by hand and would push the filter clicked (rules/ui → Strict 1): the values it can
   * show, «<field>: <value>». Its box is the widest of them, measured by the browser, and the trigger fills it. A
   * filter passes none: its trigger hugs the value the user picked (table #11, ui → Widths). */
  values?: readonly string[];
}

/** One value's room in a select trigger's chrome (u2's `CountSelect`: a 1 px border, 10 px before and 8 px after,
 * «<field>:» and the value 6 px apart, a 16 px chevron) — invisible, drawn as generated content, so it takes the
 * value's measured width and is no text anyone reads. */
function Sizer({ text }: { text: string }) {
  const at = text.indexOf(": ");
  const field = at < 0 ? "" : `${text.slice(0, at)}:`;
  const value = at < 0 ? text : text.slice(at + 2);
  return (
    <span aria-hidden="true" data-slot="toolbar-sizer" data-field={field} data-value={value} className="invisible flex h-7 items-center gap-1.5 border border-transparent pr-2 pl-2.5 text-sm whitespace-nowrap">
      <span className="flex items-center gap-1.5">
        {field && <span data-text={field} className="after:content-[attr(data-text)]" />}
        <span data-text={value} className="after:content-[attr(data-text)]" />
      </span>
      <span className="size-4 shrink-0" />
    </span>
  );
}

export const GAP = 8;
/** The search's floor and cap (ui → Widths: a toolbar search is flexible with a cap). */
export const FLEX_FLOOR = 192;
export const OVERFLOW_WIDTH = 28;
export const MORE_LABEL = "Ещё фильтры";

export interface AdaptiveToolbarProps {
  items: readonly ToolbarItem[];
  /** The toolbar's accessible name: «Фильтры находок». */
  label: string;
  className?: string;
}

const focusables = (root: HTMLElement) => [...root.querySelectorAll<HTMLElement>("[data-overflow-row]")].map((row) => row.querySelector<HTMLElement>("button, input, [tabindex]:not([tabindex='-1'])")).filter((el): el is HTMLElement => el !== null);

export function AdaptiveToolbar({ items, label, className }: AdaptiveToolbarProps) {
  const root = useRef<HTMLDivElement | null>(null);
  const widths = useRef(new Map<string, number>());
  const [folded, setFolded] = useState<readonly string[]>([]);
  const ids = items.map((i) => `${i.id}:${i.kind}`).join("|");

  useLayoutEffect(() => {
    const el = root.current;
    if (!el) return;
    const measure = () => {
      const available = el.getBoundingClientRect().width;
      if (available <= 0) return; // not laid out (hidden, or a test without layout): fold nothing
      for (const node of el.querySelectorAll<HTMLElement>("[data-toolbar-item]")) {
        const id = node.dataset.toolbarItem as string;
        const w = node.dataset.flex === "" ? FLEX_FLOOR : node.getBoundingClientRect().width;
        if (w > 0) widths.current.set(id, w);
      }
      const next = pack(
        items.map((i) => ({ id: i.id, kind: i.kind, width: widths.current.get(i.id) ?? 0 })),
        available,
        { gap: GAP, overflow: OVERFLOW_WIDTH },
      );
      // commit before paint: the line never shows unfolded and then jumps
      flushSync(() => setFolded((prev) => (prev.join("|") === next.join("|") ? prev : next)));
    };
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    for (const node of el.querySelectorAll<HTMLElement>("[data-toolbar-item]")) observer.observe(node);
    return () => observer.disconnect();
    // the item set, not each render's node objects, decides what is observed
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids, folded]);

  const hidden = new Set(folded);
  const lastFoldable = items.reduce((at, item, i) => (item.kind === "pinned" ? at : i), -1);
  const foldedItems = items.filter((i) => hidden.has(i.id));
  const marked = foldedItems.some((i) => i.active);

  const onOverflowKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const list = focusables(event.currentTarget);
    const at = list.indexOf(document.activeElement as HTMLElement);
    const go = { ArrowDown: at + 1, ArrowUp: at - 1, Home: 0, End: list.length - 1 }[event.key];
    if (go === undefined || !list.length || (event.target as HTMLElement).closest("input")) return;
    event.preventDefault();
    list[(go + list.length) % list.length]?.focus();
  };

  const overflow = (
    <Popover key="…">
      <Hint label={MORE_LABEL}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="icon-sm" aria-label={marked ? `${MORE_LABEL}: есть выбранные` : MORE_LABEL} data-slot="toolbar-overflow" className="relative shrink-0">
            <EllipsisIcon />
            {marked && <Dot tone="neutral" className="absolute top-1 right-1" />}
          </Button>
        </PopoverTrigger>
      </Hint>
      <PopoverContent align="start" className="w-64 p-1">
        <div role="group" aria-label={MORE_LABEL} className="flex flex-col gap-1" onKeyDown={onOverflowKey}>
          {foldedItems.map((item) => (
            <div key={item.id} data-overflow-row={item.id} className="flex w-full [&>*]:w-full [&>*]:justify-between">
              {item.node}
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );

  return (
    <div ref={root} role="toolbar" aria-label={label} data-slot="adaptive-toolbar" className={cn("flex h-7 min-w-0 shrink-0 items-center gap-2 overflow-hidden", className)}>
      {items.map((item, i) => (
        <ItemSlot key={item.id} item={item} hidden={hidden.has(item.id)} after={i === lastFoldable && folded.length > 0 ? overflow : null} />
      ))}
    </div>
  );
}

function ItemSlot({ item, hidden, after }: { item: ToolbarItem; hidden: boolean; after: ReactNode }) {
  return (
    <>
      {!hidden && (
        <div
          data-toolbar-item={item.id}
          data-flex={item.flex ? "" : undefined}
          className={cn("flex shrink-0 items-center", item.values && "grid [&>*]:[grid-area:1/1] [&>*]:w-full", item.flex && "max-w-80 min-w-48 flex-1 shrink", item.end && "ml-auto")}
        >
          {item.node}
          {item.values?.map((v) => (
            <Sizer key={v} text={v} />
          ))}
        </div>
      )}
      {after}
    </>
  );
}
