// The edge mark of the units list (rules/ui → Conventions 9): a unit the run changed in the last minutes — its state,
// commit, cause, closes or launches — is marked on its leading edge until the mark ages out on the shared clock, the
// same «last minutes» as the findings view's. The first read marks nothing.
import { useState } from "react";
import type { Unit } from "../../../shared/model.ts";
// From the file: the findings view's mark keeps the one span of «last minutes».
import { EDGE_MS } from "../findings/marks.ts";

/** What a change of the run moves: everything a row or its detail shows. */
export const unitSign = (u: Unit): string => JSON.stringify([u.state, u.stateText, u.sha, u.commits, u.blockedWhy, u.blockedBy, u.tree, u.title, u.kind, u.brief, u.closes, u.launches]);

interface Seen {
  version: number;
  signs: ReadonlyMap<string, string>;
  changed: Readonly<Record<string, number>>;
}

const signsOf = (units: readonly Unit[]) => new Map(units.map((u) => [u.id, unitSign(u)]));

/** Whether a unit carries the edge mark now; recomputed when the run's version moves. */
export function useUnitMarks(version: number, units: readonly Unit[], now: number): (id: string) => boolean {
  const [seen, setSeen] = useState<Seen>(() => ({ version, signs: signsOf(units), changed: {} }));
  let current = seen;
  if (seen.version !== version) {
    const signs = signsOf(units);
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
