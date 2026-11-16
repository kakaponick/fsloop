// The fact list (ui → Roles: fact list; ux 9; rules/ui → Layout 3): one label–value table — one label column, one
// value column, one fact to a row. Outcome rows open it, the facts follow, and the facts the user decides by least
// fold behind one «Подробнее» row at its end, open or closed as the user last left it (browser storage). A label that
// names a term a new user cannot read alone carries its glossary (ui → Glossary: on the label that names the term,
// never on the value). The label column is as wide as every label, the folded ones included, so opening «Подробнее»
// moves no value (Strict 1).
import { ChevronRightIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { usePref } from "./storage.ts";
import { GlossaryTooltip, type GlossaryEntry } from "./tooltip.tsx";

export interface Fact {
  label: string;
  value: ReactNode;
  /** The values this fact can show that a new user cannot read alone: the label carries them as its glossary. */
  glossary?: readonly GlossaryEntry[];
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

/** A folded label's room in the label column: zero height, drawn as generated content — no text anyone reads — and
 * wrapping as the label itself would, so the column sizes as if every label were shown. */
function LabelSizer({ text }: { text: string }) {
  return <span aria-hidden="true" data-slot="label-sizer" data-text={text} className="invisible block h-0 overflow-hidden after:content-[attr(data-text)]" />;
}

function Row({ fact, sizers = [] }: { fact: Fact; sizers?: readonly string[] }) {
  return (
    <div className="contents" data-slot="fact" data-outcome={fact.outcome ? "" : undefined}>
      <dt className="text-muted-foreground">
        {fact.glossary ? <GlossaryTooltip term={fact.label} entries={fact.glossary} className="text-left" /> : fact.label}
        {sizers.map((text) => (
          <LabelSizer key={text} text={text} />
        ))}
      </dt>
      <dd className="m-0 min-w-0 break-words">{fact.value}</dd>
    </div>
  );
}

export function FactList({ facts, more = [], foldKey = "facts", label, className }: FactListProps) {
  const [open, setOpen] = usePref(`fold:${foldKey}`, false);
  const ordered = [...facts.filter((f) => f.outcome), ...facts.filter((f) => !f.outcome)];
  // the folded labels hold their room in the first label's cell, open or closed
  const sizers = [...new Set(more.map((f) => f.label))];
  return (
    <Collapsible open={open} onOpenChange={setOpen} asChild>
      <dl data-slot="fact-list" aria-label={label} className={cn("m-0 grid grid-cols-[auto_minmax(0,1fr)] content-start items-baseline gap-x-4 gap-y-1", className)}>
        {ordered.map((fact, i) => (
          <Row key={fact.key ?? fact.label} fact={fact} sizers={i === 0 ? sizers : undefined} />
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
