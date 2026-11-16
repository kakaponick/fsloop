// The edge mark of the units list (rules/ui → Conventions 9): a unit the run changed in the last minutes — its state,
// commit, cause, closes or launches — is marked on its leading edge until the mark ages out on the shared clock. The
// first read marks nothing. The hook is u2's; this file holds the units' sign.
import type { Unit } from "../../../shared/model.ts";
import { useEdgeMarks } from "@/ui";

/** What a change of the run moves: everything a row or its detail shows. */
export const unitSign = (u: Unit): string => JSON.stringify([u.state, u.stateText, u.sha, u.commits, u.blockedWhy, u.blockedBy, u.tree, u.title, u.kind, u.brief, u.closes, u.launches]);

const unitId = (u: Unit) => u.id;

/** Whether a unit carries the edge mark now. */
export const useUnitMarks = (version: number, units: readonly Unit[], now: number): ((id: string) => boolean) => useEdgeMarks(version, units, unitId, unitSign, now);
