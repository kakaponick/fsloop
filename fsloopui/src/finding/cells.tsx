// A finding's compact parts, one per fact, read by the findings table's cells, the compact finding row other views
// list and the finding article (rules/ui → Conventions 1, 4, 5): the severity, the run's state with its unit, the
// user's verdict. Words and tones come from shared/states.ts; an absent field reads «не записано», never a guess.
import type { Finding } from "../../shared/model.ts";
import { FINDING_STATUS, NOT_RECORDED, SEVERITY, VERDICT } from "../../shared/states.ts";
import { Dash, StatusDot, type DotState } from "@/ui";

type Severe = Pick<Finding, "severity">;

/** The severity's map entry; a finding without one reads «не записано» with a neutral dot (Conventions 4). */
export const severityState = (f: Severe): DotState => (f.severity ? SEVERITY[f.severity] : { tone: "neutral", label: NOT_RECORDED });

/** The unit a state names after its word: the fixing unit, else the first unit whose brief closes it. */
export const stateUnit = (f: Pick<Finding, "unit" | "units">): string | null => f.unit ?? f.units[0] ?? null;

/** «исправляется · u3», «кандидат»: the compact state, the unit last so truncation cuts only it. */
export const stateText = (f: Pick<Finding, "effectiveStatus" | "unit" | "units">): string => [FINDING_STATUS[f.effectiveStatus].compact, stateUnit(f)].filter(Boolean).join(" · ");

export function SeverityCell({ finding, form = "compact" }: { finding: Severe; form?: "compact" | "full" }) {
  return <StatusDot state={severityState(finding)} form={form} truncate />;
}

export function StateCell({ finding }: { finding: Pick<Finding, "effectiveStatus" | "unit" | "units"> }) {
  const unit = stateUnit(finding);
  return <StatusDot state={FINDING_STATUS[finding.effectiveStatus]} detail={unit ?? undefined} truncate />;
}

/** The user's verdict, compact; «—» before one is set. */
export function VerdictCell({ finding }: { finding: Pick<Finding, "verdict"> }) {
  return finding.verdict ? <span>{VERDICT[finding.verdict.verdict].compact}</span> : <Dash />;
}
