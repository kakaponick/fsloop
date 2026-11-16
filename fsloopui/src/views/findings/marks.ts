// The edge mark of a live list (rules/ui → Conventions 9): a finding the run changed in the last minutes — its
// state, decision, units or text — is marked on its leading edge until the mark ages out on the shared clock. The
// user's own verdict is not a change the run made, and the first read marks nothing. The hook is u2's
// (`useEdgeMarks`); this file holds the findings' sign, as «Юниты» holds its own (`useUnitMarks`).
import type { Finding } from "../../../shared/model.ts";
import { useEdgeMarks } from "@/ui";

/** What a change of the run moves: everything a row or its detail shows, but the user's verdict. */
export const changeSign = (f: Finding): string =>
  JSON.stringify([f.severity, f.effectiveStatus, f.decision, f.unit, f.units, f.why, f.summary, f.rule, f.observation, f.fix, f.question, f.location, f.frames, f.duplicateOf, f.repeatedBy]);

const findingId = (f: Finding) => f.id;

/** Whether a finding carries the edge mark now. */
export const useFindingMarks = (version: number, findings: readonly Finding[], now: number): ((id: string) => boolean) => useEdgeMarks(version, findings, findingId, changeSign, now);
