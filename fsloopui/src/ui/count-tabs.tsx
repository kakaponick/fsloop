// Tabs with counts (rules/ui → Layout 4, Conventions 7; ui → Widths: tabs stay content-width, left-aligned): the
// views of a run and a report's sections. Each tab carries its count in a box three tabular digits wide, so a
// live count never moves its neighbours (Strict 1); a zero is a muted «0»; the active tab keeps the weight of the
// others — its underline and ink mark it, so choosing a tab shifts nothing. ←/→ move between tabs.
//
// A sticky strip is this component's own form, written once: the list pinned to the top of the region that scrolls
// it, on the page's ground, a hairline under it, its height reserved, scrolling sideways when narrower than its tabs.
// The root then draws no box, so the list sticks within whatever scrolls its panels — a report's body — or the page.
import type { ReactNode } from "react";
import { num } from "../../shared/text.ts";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

export interface CountTab {
  value: string;
  label: string;
  /** Null when the count is not known yet: the box stays, empty. */
  count: number | null;
}

/** A count in its reserved box: tabular numerals, a muted «0». */
export function TabCount({ n }: { n: number | null }) {
  return (
    <span data-slot="tab-count" className={cn("inline-block min-w-count text-left tabular-nums", n === 0 && "text-muted-foreground")}>
      {n === null ? "" : num(n)}
    </span>
  );
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
  /** The root's classes; with `sticky`, the strip's own (its inset), since the root draws no box. */
  className?: string;
}

/** The sticky strip: 40 px on the page's ground with a hairline under it; the active tab's underline sits on it. */
const STICKY_LIST = "sticky top-0 z-10 w-full max-w-full shrink-0 overflow-x-auto overflow-y-hidden border-b bg-background pb-0 group-data-horizontal/tabs:h-10";
const STICKY_TRIGGER = "group-data-horizontal/tabs:after:bottom-0";

export function CountTabs({ value, onValueChange, tabs, label, children, sticky = false, className }: CountTabsProps) {
  return (
    <Tabs value={value} onValueChange={onValueChange} className={cn("gap-0", sticky ? "contents" : className)}>
      <TabsList variant="line" aria-label={label} data-sticky={sticky ? "" : undefined} className={cn("justify-start", sticky && STICKY_LIST, sticky && className)}>
        {tabs.map((tab) => (
          <TabsTrigger key={tab.value} value={tab.value} className={cn("flex-none gap-1.5 px-2", sticky && STICKY_TRIGGER)}>
            {tab.label}
            <TabCount n={tab.count} />
          </TabsTrigger>
        ))}
      </TabsList>
      {children}
    </Tabs>
  );
}

export { TabsContent as CountTabsContent };
