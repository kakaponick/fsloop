// The finding rows that expand in place outside «Находки» (rules/ui → Tables 3, Conventions 8; ui → Keyboard): a
// report's findings in «Отчёты», the findings a unit closes in «Юниты» — one part, written once (code → No
// duplication). Each row is the compact `FindingRow` behind a chevron; it expands under itself into «Открыть в
// находках» and the shared article, several may stay open. The list is one flat list with one Tab stop: ↑/↓ move
// between the rows' chevrons, Enter opens or closes, the id's link is the mouse's — «Открыть в находках» in the open
// row is the keyboard's. A click on a row's own text toggles it; a link or a button inside it keeps its own action.
// An id the run names but does not hold reads «не найдена» in the row's place, with no chevron and no stop.
import { ChevronRightIcon } from "lucide-react";
import { useId, useLayoutEffect, useRef, useState, type MouseEvent } from "react";
import type { Finding, Run } from "../../shared/model.ts";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { flatItem, FlatList, Hint, NotFound } from "@/ui";
import { ObjectLink } from "../app/links.tsx";
import { FindingArticle } from "./article.tsx";
import { FindingRow } from "./row.tsx";
import { findingToggle, OPEN_IN_FINDINGS } from "./words.ts";

type ListRun = Pick<Run, "findings" | "units" | "launches" | "journal"> & { key: string };

export interface ExpandingFindingsProps {
  run: ListRun;
  /** In order: a finding, or the id of one the run names but does not hold. */
  items: readonly (Finding | string)[];
  /** The list's name for assistive technology: «Находки отчёта». */
  label: string;
  /** The shared clock. */
  now: number;
  /** The list's own slot: «report-findings», «unit-closes». */
  slot: string;
  /** A hairline between rows, a hover and an open ground — a list on the page's paper; off for one that already sits
   * on the muted ground (a unit's detail). */
  ruled?: boolean;
}

/** A click on a row's own text toggles it; a link or a button inside the row keeps its own action. */
const ownClick = (e: MouseEvent<HTMLElement>) => !(e.target as HTMLElement).closest("a, button");

export function ExpandingFindings({ run, items, label, now, slot, ruled = true }: ExpandingFindingsProps) {
  const [open, setOpen] = useState<ReadonlySet<string>>(() => new Set());
  const list = useRef<HTMLOListElement>(null);
  const base = useId();
  const toggle = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  // the row's id link leaves the Tab order: one stop for the list
  useLayoutEffect(() => {
    for (const a of list.current?.querySelectorAll<HTMLElement>("[data-slot=finding-line] [data-slot=finding-row] a") ?? []) a.tabIndex = -1;
  });
  return (
    <FlatList label={label} onOpen={toggle}>
      <ol ref={list} data-slot={slot} className={cn("m-0 flex list-none flex-col p-0", ruled && "border-t")}>
        {items.map((item) => {
          if (typeof item === "string")
            return (
              <li key={item} data-finding={item} className={cn("min-w-0", ruled && "border-b")}>
                <span className="flex h-8 items-center pl-7">
                  <NotFound kind="finding" id={item} />
                </span>
              </li>
            );
          const f = item;
          const isOpen = open.has(f.id);
          const panel = `${base}-${f.id.replace(/[^\w-]/g, "-")}`;
          const name = findingToggle(f.local, isOpen);
          return (
            <li key={f.id} data-finding={f.id} className={cn("min-w-0", ruled && "border-b")}>
              <div
                data-slot="finding-line"
                data-state={isOpen ? "open" : "closed"}
                onClick={(e) => ownClick(e) && toggle(f.id)}
                className={cn("grid cursor-default grid-cols-[1.5rem_minmax(0,1fr)] items-center gap-x-1", ruled && "pr-2 hover:bg-muted data-[state=open]:bg-muted/40")}
              >
                <Hint label={name}>
                  <Button variant="ghost" size="icon-xs" {...flatItem(f.id)} aria-expanded={isOpen} aria-controls={isOpen ? panel : undefined} aria-label={name} onClick={() => toggle(f.id)}>
                    <ChevronRightIcon aria-hidden="true" className={cn("transition-transform motion-reduce:transition-none", isOpen && "rotate-90")} />
                  </Button>
                </Hint>
                <FindingRow run={run} finding={f} />
              </div>
              {isOpen && (
                <div id={panel} data-slot="finding-detail" className={cn("flex flex-col gap-2 pt-1 pb-4 pl-7", ruled && "bg-muted/40 pr-4")}>
                  <p className="m-0 flex justify-end">
                    <ObjectLink run={run} kind="finding" id={f.id} className="text-xs">
                      {OPEN_IN_FINDINGS}
                    </ObjectLink>
                  </p>
                  <FindingArticle run={run} finding={f} now={now} inRow />
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </FlatList>
  );
}
