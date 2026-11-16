// Tabs with counts (rules/ui → Layout 4, Conventions 7; ui → Widths: tabs stay content-width, left-aligned): the
// views of a run and a report's sections. Each tab carries its count in a box three tabular digits wide, so a
// live count never moves its neighbours (Strict 1); a tab whose count is zero is muted whole, its label with its «0»,
// in ink alone, every ink over 4.5:1 (`TAB_INK`, `ZERO_TAB`) — the weight stays, so a count that turns from zero moves nothing (improve-5 (1)); the active tab keeps
// the weight of the others — its underline and ink mark it, so choosing a tab shifts nothing. ←/→ move between tabs.
//
// A sticky strip is this component's own form, written once: the list pinned to the top of the region that scrolls
// it, on the page's ground, a hairline under it, its height reserved, scrolling sideways when narrower than its tabs.
// The root then draws no box, so the list sticks within whatever scrolls its panels — a report's body — or the page.
//
// A sticky strip with `overflow` never scrolls sideways: what does not fit folds from the right into «Ещё N», a menu of the
// folded tabs beside the list (table #14 — the packing is the toolbar's one module). The open tab and the tabs the
// caller keeps never fold, and every label left in the strip is whole. The strip measures its own room — the list
// and its «Ещё N» box together — and its tabs, and folds before the frame paints, so nothing shows clipped and then
// jumps (Strict 1).
import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { flushSync } from "react-dom";
import { count, num, type Forms } from "../../shared/text.ts";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
// the file, not the table's index: the packing is pure and the index reaches back into this folder
import { pack } from "@/table/pack.ts";
import { Menu } from "./menu.tsx";

export interface CountTab {
  value: string;
  label: string;
  /** Null when the count is not known yet: the box stays, empty. */
  count: number | null;
}

/** A count in its reserved box: tabular numerals in its tab's ink — a zero tab is muted whole (`ZERO_TAB`). */
export function TabCount({ n }: { n: number | null }) {
  return (
    <span data-slot="tab-count" className="inline-block min-w-count text-left tabular-nums">
      {n === null ? "" : num(n)}
    </span>
  );
}

/** The tabs' three inks, each over 4.5:1 on the page in both themes (DESIGN.md → The Contrast Floor; craft-3): the
 * chosen tab in ink, a tab that holds something in ink at 80 % — the library's own inactive ink (ink at 60 % in the
 * light theme) falls under the floor —, a zero tab in muted ink, its label with its «0». The library's dark inks are
 * replaced, not stacked; chosen, a zero tab takes the chosen tab's ink like any other. `tokens.test.ts` computes all
 * three from the token values. */
export const TAB_INK = "text-foreground/80 dark:text-foreground/80";
export const ZERO_TAB = "text-muted-foreground dark:text-muted-foreground";
/** «Ещё N» reads as the tabs it folds. */
export const MORE_INK = TAB_INK;

/** «Ещё N» spoken whole: what the trigger folds, in the noun its caller passes — «Ещё 9 частей отчёта» (improve-5 (2)). */
export const moreTabsName = (n: number, noun: Forms): string => `${MORE_TABS} ${count(n, noun)}`;

/** A strip that folds what does not fit into «Ещё N». */
export interface TabsOverflow {
  /** The folded tabs' menu: «Другие части отчёта». */
  label: string;
  /** Tabs that never fold, besides the open one: «Файл отчёта», where an unread line sends the user. */
  keep?: readonly string[];
  /** What the tabs are, for the trigger's name «Ещё 9 частей отчёта» — a noun of `NOUNS` (shared/text.ts). */
  noun: Forms;
}

export interface CountTabsProps {
  value: string;
  onValueChange: (value: string) => void;
  tabs: readonly CountTab[];
  /** The strip's name: «Разделы прогона». */
  label: string;
  /** `CountTabsContent` per tab, when the tabs own their panels. */
  children?: ReactNode;
  /** The strip stays at the top of what scrolls it (the shared sticky form above). */
  sticky?: boolean;
  /** The sticky strip's: what does not fit folds into «Ещё N» instead of scrolling sideways. The caller lays the strip
   * in a row that wraps its panels under it, the list flexible (`className="w-auto min-w-0 flex-1"`), as the reader. */
  overflow?: TabsOverflow;
  /** The root's classes; with `sticky`, the strip's own (its inset), since the root draws no box. */
  className?: string;
}

/** The trigger's word: «Ещё 9» — the menu it opens names the parts. */
export const MORE_TABS = "Ещё";

/** The strip's own room: its list's padding, the gap between tabs, the «Ещё N» trigger's reserved box (w-16). */
export const FOLD = { padding: 6, gap: 4, trigger: 64 } as const;

/** The tabs that fold into «Ещё N» when the strip is narrower than its tabs: from the right, in markup order — the
 * kept ones never fold. `tabs` carry their measured widths, `strip` is the strip's room; every tab left in it shows
 * its label whole. */
export function foldTabs(tabs: readonly { id: string; width: number }[], keep: ReadonlySet<string>, strip: number): string[] {
  return pack(
    tabs.map((t) => ({ id: t.id, width: t.width, kind: keep.has(t.id) ? "pinned" : "ordinary" })),
    strip - FOLD.padding,
    { gap: FOLD.gap, overflow: FOLD.trigger },
  );
}

/** The sticky strip: 40 px on the page's ground with a hairline under it; the active tab's underline sits on it. */
const STICKY_LIST = "sticky top-0 z-10 w-full max-w-full shrink-0 overflow-x-auto overflow-y-hidden border-b bg-background pb-0 group-data-horizontal/tabs:h-10";
const STICKY_TRIGGER = "group-data-horizontal/tabs:after:bottom-0";
/** «Ещё N» beside a sticky list: the same strip's ground, hairline and height. */
const STICKY_MORE = "sticky top-0 z-10 h-10 border-b bg-background";

export function CountTabs({ value, onValueChange, tabs, label, children, sticky = false, overflow, className }: CountTabsProps) {
  const list = useRef<HTMLDivElement>(null);
  const more = useRef<HTMLDivElement>(null);
  const widths = useRef(new Map<string, number>());
  const [folded, setFolded] = useState<readonly string[]>([]);
  const hidden = new Set(sticky && overflow ? folded.filter((id) => id !== value) : []);
  const shown = tabs.filter((t) => !hidden.has(t.value));
  const ids = tabs.map((t) => t.value).join("|");
  const keepKey = overflow?.keep?.join("|") ?? "";
  const folding = sticky && overflow !== undefined;

  useLayoutEffect(() => {
    const el = list.current;
    if (!el || !overflow || !folding) return;
    const measure = (sync: boolean) => {
      const own = el.getBoundingClientRect().width;
      if (own <= 0) return; // not laid out (hidden, or a test without layout): fold nothing
      const strip = own + (more.current?.getBoundingClientRect().width ?? 0);
      const triggers = el.querySelectorAll<HTMLElement>("[role=tab]");
      shown.forEach((t, i) => {
        const w = triggers[i]?.getBoundingClientRect().width ?? 0;
        if (w > 0) widths.current.set(t.value, w);
      });
      const next = foldTabs(
        tabs.map((t) => ({ id: t.value, width: widths.current.get(t.value) ?? 0 })),
        new Set([value, ...(overflow.keep ?? [])]),
        strip,
      );
      const apply = () => setFolded((prev) => (prev.join("|") === next.join("|") ? prev : next));
      // a resize commits before paint; inside this effect React already does
      if (sync) flushSync(apply);
      else apply();
    };
    measure(false);
    const observer = new ResizeObserver(() => measure(true));
    observer.observe(el);
    if (more.current) observer.observe(more.current);
    return () => observer.disconnect();
    // the tab set, the fold and the open tab decide what is measured, not each render's arrays
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids, folded, value, keepKey, folding]);

  const folds = tabs.filter((t) => hidden.has(t.value));
  return (
    <Tabs value={value} onValueChange={onValueChange} className={cn("gap-0", sticky ? "contents" : className)}>
      <TabsList ref={list} variant="line" aria-label={label} data-sticky={sticky ? "" : undefined} className={cn("justify-start", sticky && STICKY_LIST, sticky && className)}>
        {shown.map((tab) => (
          <TabsTrigger key={tab.value} value={tab.value} className={cn("flex-none gap-1.5 px-2", TAB_INK, tab.count === 0 && ZERO_TAB, sticky && STICKY_TRIGGER)}>
            {tab.label}
            <TabCount n={tab.count} />
          </TabsTrigger>
        ))}
      </TabsList>
      {overflow && folds.length > 0 && (
        <div ref={more} data-slot="tabs-more" className={cn("flex w-16 shrink-0 items-center pl-1", STICKY_MORE)}>
          <Menu label={overflow.label} groups={[folds.map((t) => ({ id: t.value, label: t.count === null ? t.label : `${t.label} ${num(t.count)}`, onSelect: () => onValueChange(t.value) }))]}>
            <Button variant="ghost" size="sm" aria-label={moreTabsName(folds.length, overflow.noun)} className={cn("w-full px-2 font-medium hover:text-foreground", MORE_INK)}>
              <span>{MORE_TABS}</span> <span className="tabular-nums">{num(folds.length)}</span>
            </Button>
          </Menu>
        </div>
      )}
      {children}
    </Tabs>
  );
}

export { TabsContent as CountTabsContent };
