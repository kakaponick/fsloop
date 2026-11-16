// A finding's compact parts, one per fact, read by the findings table's cells, the compact finding row other views
// list and the finding article (rules/ui → Conventions 1, 4, 5): the severity, the run's state with its unit, the
// user's verdict. Words and tones come from shared/states.ts; an absent field reads «не записано», never a guess.
import { ImageIcon } from "lucide-react";
import type { Finding } from "../../shared/model.ts";
import { FINDING_STATUS, NOT_RECORDED, SEVERITY, VERDICT } from "../../shared/states.ts";
import { count, NOUNS } from "../../shared/text.ts";
import { Dash, StatusDot, type DotState } from "@/ui";

type Severe = Pick<Finding, "severity">;

/** The severity's map entry; a finding without one reads «не записано» with a neutral dot (Conventions 4). */
export const severityState = (f: Severe): DotState => (f.severity ? SEVERITY[f.severity] : { tone: "neutral", label: NOT_RECORDED });

/** The unit a state names after its word: the fixing unit, else the first unit whose brief closes it — none in that
 * unit's own detail (`host`), where it would repeat the unit the page is about (ux 2). */
export const stateUnit = (f: Pick<Finding, "unit" | "units">, host?: string): string | null => {
  const unit = f.unit ?? f.units[0] ?? null;
  return unit === host ? null : unit;
};

/** «исправляется · u3», «кандидат»: the compact state, the unit last so truncation cuts only it. */
export const stateText = (f: Pick<Finding, "effectiveStatus" | "unit" | "units">): string => stateTextIn(f, undefined);

/** The same, in a list `host` holds: in that unit's own detail the word alone. */
export const stateTextIn = (f: Pick<Finding, "effectiveStatus" | "unit" | "units">, host: string | undefined): string => [FINDING_STATUS[f.effectiveStatus].compact, stateUnit(f, host)].filter(Boolean).join(" · ");

export function SeverityCell({ finding, form = "compact" }: { finding: Severe; form?: "compact" | "full" }) {
  return <StatusDot state={severityState(finding)} form={form} truncate />;
}

export function StateCell({ finding, host }: { finding: Pick<Finding, "effectiveStatus" | "unit" | "units">; host?: string }) {
  const unit = stateUnit(finding, host);
  return <StatusDot state={FINDING_STATUS[finding.effectiveStatus]} detail={unit ?? undefined} truncate />;
}

/** A finding's frames, counted where its sentence stands, so a row with frames shows it before it expands
 * (u4-shape cand-4): a picture's mark and the number, «2 кадра» in its title and for a screen reader. It keeps its
 * width; the sentence beside it truncates (rules/ui → Tables 5). */
export function FrameCount({ frames }: { frames: number }) {
  const full = count(frames, NOUNS.frame);
  return (
    <span data-slot="frame-count" title={full} className="inline-flex shrink-0 items-center gap-1 text-xs text-muted-foreground tabular-nums">
      <ImageIcon aria-hidden="true" className="size-3.5" />
      <span className="sr-only">{full}</span>
      <span aria-hidden="true">{frames}</span>
    </span>
  );
}

/** The user's verdict, compact; «—» before one is set. */
export function VerdictCell({ finding }: { finding: Pick<Finding, "verdict"> }) {
  return finding.verdict ? <span>{VERDICT[finding.verdict.verdict].compact}</span> : <Dash />;
}
