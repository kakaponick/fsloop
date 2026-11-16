// What a finding carries for each filter of the findings view (rules/ui → Conventions 7): a count on the run header,
// a unit row or the report rail links to «Находки» only when it equals what the view will show — `countFindings`
// runs the same values the view's filters run, so the two never disagree. Nothing here reaches the app's routes:
// the view's own modules read these constants while the app is still loading (`open.ts` holds the navigation).
import type { Finding } from "../../shared/model.ts";
import type { FindingStatus } from "../../shared/states.ts";

/** The findings view's table id: its view state is kept under it. */
export const FINDINGS_TABLE = "findings";

/** A value a finding carries when its field is absent: «не записано», «без оценки», «без команды». */
export const NONE = "none";
/** The severity filter's «major и выше»: critical and major together. */
export const MAJOR_UP = "major+";
/** The verdict filter's «с возражением»: every verdict but «согласен» — the user disputes the finding (cand-7). */
export const OBJECTED = "objected";

/** «В исправление»: taken to fix and not yet done — waiting for a unit, in its unit, blocked, or back again. */
export const FIX_STATES: readonly FindingStatus[] = ["queued", "in-progress", "blocked", "unresolved", "repeated"];
/** «Закоммичены»: the fixing unit committed, or the fix's check closed it. */
export const DONE_STATES: readonly FindingStatus[] = ["fixed", "closed"];

/** The «Отчёт» value of the run's own findings (the second table of findings/<stage>.md): «прогон». */
export const OWN = "run";

type FindingLike = Pick<Finding, "severity" | "effectiveStatus" | "launch" | "source" | "units" | "verdict" | "cause" | "fixCommand">;

/** Per filter id, the values a finding carries; a finding may carry several (its units, «major и выше»). */
export const FACETS = {
  severity: (f: FindingLike): string[] => (f.severity ? (f.severity === "minor" ? [f.severity] : [f.severity, MAJOR_UP]) : [NONE]),
  state: (f: FindingLike): string[] => [f.effectiveStatus],
  report: (f: FindingLike): string[] => [f.launch ?? (f.source === "own" ? OWN : NONE)],
  unit: (f: FindingLike): string[] => (f.units.length ? f.units : [NONE]),
  verdict: (f: FindingLike): string[] => (f.verdict ? (f.verdict.verdict === "agree" ? [f.verdict.verdict] : [f.verdict.verdict, OBJECTED]) : [NONE]),
  cause: (f: FindingLike): string[] => [f.cause ?? NONE],
  command: (f: FindingLike): string[] => [f.fixCommand ?? NONE],
} as const;

export type FacetId = keyof typeof FACETS;

/** The slice another surface opens: values per filter, every value a filter's own. */
export type FindingFilter = Partial<Record<FacetId, readonly string[]>>;

/** How many findings the view shows under `filter` with no search: AND across filters, OR within one. */
export function countFindings(findings: readonly FindingLike[], filter: FindingFilter): number {
  const active = (Object.entries(filter) as [FacetId, readonly string[]][]).filter(([, v]) => v.length);
  return findings.filter((f) => active.every(([id, values]) => FACETS[id](f).some((v) => values.includes(v)))).length;
}

