// What a view shows until its own unit replaces it (u4–u6, j13): its count with its noun, or — when the run has
// none yet — the empty state that names the stage that fills it (rules/ui → Conventions 15). It draws no status
// bar: each real view renders the table kit's.
import type { Step } from "../../shared/states.ts";
import { count, type Forms } from "../../shared/text.ts";
import { EmptyState } from "../ui/index.ts";
import type { ViewProps } from "../views/index.ts";

export interface ViewPlaceholderProps extends ViewProps {
  /** What the view lists, and how many the run holds. */
  noun: Forms;
  n: number;
  /** The stage that fills the view, its own lead and subject («Критики ещё не писали отчётов», «находки»). */
  step: Step;
  lead?: string;
  subject?: string;
}

export function ViewPlaceholder({ run, noun, n, step, lead, subject }: ViewPlaceholderProps) {
  if (n === 0) {
    if (run.closed) return <EmptyState form="never" noun={noun} className="py-16" />;
    return <EmptyState form="not-yet" noun={noun} step={step} lead={lead} subject={subject} className="py-16" />;
  }
  return <p className="px-5 py-4 text-muted-foreground tabular-nums">{count(n, noun)}</p>;
}
