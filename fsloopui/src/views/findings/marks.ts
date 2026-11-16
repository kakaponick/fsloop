// The edge mark of a live list (rules/ui → Conventions 9): a finding the run changed in the last minutes — its
// state, decision, units or text — is marked on its leading edge until the mark ages out on the shared clock. The
// user's own verdict is not a change the run made, and the first read marks nothing.
import { useState } from "react";
import type { Finding } from "../../../shared/model.ts";
import { THRESHOLDS } from "../../../shared/liveness.ts";

/** How long a change stays marked: the same «last minutes» as a fresh write (shared/liveness.ts). */
export const EDGE_MS = THRESHOLDS.quiet;

/** What a change of the run moves: everything a row or its detail shows, but the user's verdict. */
export const changeSign = (f: Finding): string =>
  JSON.stringify([f.severity, f.effectiveStatus, f.decision, f.unit, f.units, f.why, f.summary, f.rule, f.observation, f.fix, f.question, f.location, f.frames, f.duplicateOf, f.repeatedBy]);

interface Seen {
  version: number;
  signs: ReadonlyMap<string, string>;
  changed: Readonly<Record<string, number>>;
}

const signsOf = (findings: readonly Finding[]) => new Map(findings.map((f) => [f.id, changeSign(f)]));

/** Whether a finding carries the edge mark now; recomputed when the run's version moves. */
export function useEdgeMarks(version: number, findings: readonly Finding[], now: number): (id: string) => boolean {
  const [seen, setSeen] = useState<Seen>(() => ({ version, signs: signsOf(findings), changed: {} }));
  let current = seen;
  if (seen.version !== version) {
    const signs = signsOf(findings);
    const changed: Record<string, number> = { ...seen.changed };
    for (const [id, sign] of signs) {
      const before = seen.signs.get(id);
      if (before !== undefined && before !== sign) changed[id] = now;
    }
    current = { version, signs, changed };
    setSeen(current);
  }
  return (id) => {
    const at = current.changed[id];
    return at !== undefined && now - at < EDGE_MS;
  };
}
