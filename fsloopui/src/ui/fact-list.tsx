// The fact list (ui → Roles: fact list; ux 9; rules/ui → Layout 3): one label–value table — one label column, one
// value column, one fact to a row. Outcome rows open it, the facts follow, and the facts the user decides by least
// fold behind one «Подробнее» row at its end, open or closed as the user last left it (browser storage).
import { ChevronRightIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { usePref } from "./storage.ts";

export interface Fact {
  label: string;
  value: ReactNode;
  /** A state, its next action, a red gate: an outcome row, placed first (ux 9). */
  outcome?: boolean;
  /** A stable key when two facts share a label. */
  key?: string;
}

export interface FactListProps {
  facts: readonly Fact[];
  /** The facts behind «Подробнее». */
  more?: readonly Fact[];
  /** The storage key of the fold's open state: one per kind of page («run», «report»). */
  foldKey?: string;
  label?: string;
  className?: string;
}

export const MORE = "Подробнее";

function Row({ fact }: { fact: Fact }) {
  return (
    <div className="contents" data-slot="fact" data-outcome={fact.outcome ? "" : undefined}>
      <dt className="text-muted-foreground">{fact.label}</dt>
      <dd className="m-0 min-w-0 break-words">{fact.value}</dd>
    </div>
  );
}

export function FactList({ facts, more = [], foldKey = "facts", label, className }: FactListProps) {
  const [open, setOpen] = usePref(`fold:${foldKey}`, false);
  const ordered = [...facts.filter((f) => f.outcome), ...facts.filter((f) => !f.outcome)];
  return (
    <Collapsible open={open} onOpenChange={setOpen} asChild>
      <dl data-slot="fact-list" aria-label={label} className={cn("m-0 grid grid-cols-[auto_minmax(0,1fr)] content-start items-baseline gap-x-4 gap-y-1", className)}>
        {ordered.map((fact) => (
          <Row key={fact.key ?? fact.label} fact={fact} />
        ))}
        {more.length > 0 && (
          <>
            <div className="col-span-2">
              <CollapsibleTrigger className="group/more -ml-1 inline-flex items-center gap-1 rounded-sm px-1 text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50">
                <ChevronRightIcon aria-hidden="true" className="size-3.5 transition-transform group-data-[state=open]/more:rotate-90 motion-reduce:transition-none" />
                {MORE}
              </CollapsibleTrigger>
            </div>
            <CollapsibleContent className="contents">
              {more.map((fact) => (
                <Row key={fact.key ?? fact.label} fact={fact} />
              ))}
            </CollapsibleContent>
          </>
        )}
      </dl>
    </Collapsible>
  );
}
