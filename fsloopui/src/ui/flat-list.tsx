// A list that is not a table (rules/ui → Conventions 8; ui → Keyboard): the sidebar's cards and the report rail —
// one flat list with one Tab stop. ↑/↓ move, Home/End jump, Enter on the item opens it — Enter on a link or a
// button inside an item is that control's own. An item with an address is one link as a
// whole and nothing inside it takes focus; headings between items are not stops. The list owns the roving
// tabindex: every element marked by `flatItem(key)` is a stop, the open one (aria-current) holds the Tab stop.
import { useLayoutEffect, useRef, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "@/lib/utils";

const ITEM = "data-flat-item";

/** Marks an element as an item of the enclosing flat list. */
export const flatItem = (key: string) => ({ [ITEM]: key });

export interface FlatListProps {
  /** The list's name for assistive technology: «Прогоны», «Отчёты прогона». */
  label: string;
  children: ReactNode;
  /** Enter on an item that is not a link: the item's key. A link opens by itself. */
  onOpen?: (key: string) => void;
  className?: string;
}

const isCurrent = (el: HTMLElement) => {
  const current = el.getAttribute("aria-current");
  return current !== null && current !== "false";
};

export function FlatList({ label, children, onOpen, className }: FlatListProps) {
  const root = useRef<HTMLDivElement>(null);
  const items = () => Array.from(root.current?.querySelectorAll<HTMLElement>(`[${ITEM}]`) ?? []);
  const rove = (all: HTMLElement[], stop: HTMLElement) => {
    for (const el of all) el.tabIndex = el === stop ? 0 : -1;
  };

  // After every render the list has exactly one Tab stop: the focused item, else the open one, else the last stop.
  useLayoutEffect(() => {
    const all = items();
    if (!all.length) return;
    const stop = all.find((el) => el === document.activeElement) ?? all.find(isCurrent) ?? all.find((el) => el.tabIndex === 0) ?? all[0];
    rove(all, stop);
  });

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const all = items();
    const at = all.findIndex((el) => el === document.activeElement || el.contains(document.activeElement));
    if (at < 0) return;
    let next = -1;
    if (event.key === "ArrowDown") next = Math.min(at + 1, all.length - 1);
    else if (event.key === "ArrowUp") next = Math.max(at - 1, 0);
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = all.length - 1;
    else if (event.key === "Enter") {
      // a link item opens by itself; a link or a button inside an item that is not one is theirs (gap 10)
      if (all[at] instanceof HTMLAnchorElement || document.activeElement !== all[at]) return;
      event.preventDefault();
      onOpen?.(all[at].getAttribute(ITEM) ?? "");
      return;
    } else return;
    event.preventDefault();
    rove(all, all[next]);
    all[next].focus();
  };

  return (
    <div
      ref={root}
      role="group"
      aria-label={label}
      data-slot="flat-list"
      className={cn("flex flex-col", className)}
      onKeyDown={onKeyDown}
      onFocus={(event) => {
        const all = items();
        const item = all.find((el) => el === event.target);
        if (item) rove(all, item);
      }}
    >
      {children}
    </div>
  );
}
