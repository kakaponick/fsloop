// The compact read-only finding row (j12): one line per finding where another view lists findings — a unit's
// findings in «Юниты», a report's in «Отчёты». Severity · id as a link to the finding in «Находки» · its first
// sentence · its state; the same parts and widths as the findings table's cells, so a finding reads the same
// everywhere. The sentence takes the slack and truncates, its whole text in the title (rules/ui → Tables 5).
import type { Finding, Run } from "../../shared/model.ts";
import { cn } from "@/lib/utils";
import { ObjectLink } from "../app/links.tsx";
import { SeverityCell, StateCell, stateText } from "./cells.tsx";

type RowRun = Pick<Run, "findings" | "units" | "launches" | "journal"> & { key: string };

export function FindingRow({ run, finding: f, className }: { run: RowRun; finding: Finding; className?: string }) {
  return (
    <div data-slot="finding-row" className={cn("grid h-8 grid-cols-[6.5rem_7rem_minmax(0,1fr)_9rem] items-center gap-x-3", className)}>
      <SeverityCell finding={f} />
      <span className="min-w-0 truncate" title={f.id}>
        <ObjectLink run={run} kind="finding" id={f.id}>
          <span className="font-mono text-xs">{f.local}</span>
        </ObjectLink>
      </span>
      <span className="min-w-0 truncate" title={f.summary}>
        {f.summary}
      </span>
      <span className="min-w-0" title={stateText(f)}>
        <StateCell finding={f} />
      </span>
    </div>
  );
}
