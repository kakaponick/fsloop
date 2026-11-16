// Tabs with counts (rules/ui → Layout 4, Conventions 7; ui → Widths: tabs stay content-width, left-aligned): the
// views of a run and a report's sections. Each tab carries its count in a box three tabular digits wide, so a
// live count never moves its neighbours (Strict 1); a zero is a muted «0»; the active tab keeps the weight of the
// others — its underline and ink mark it, so choosing a tab shifts nothing. ←/→ move between tabs.
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
  className?: string;
}

export function CountTabs({ value, onValueChange, tabs, label, children, className }: CountTabsProps) {
  return (
    <Tabs value={value} onValueChange={onValueChange} className={cn("gap-0", className)}>
      <TabsList variant="line" aria-label={label} className="justify-start">
        {tabs.map((tab) => (
          <TabsTrigger key={tab.value} value={tab.value} className="flex-none gap-1.5 px-2">
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
