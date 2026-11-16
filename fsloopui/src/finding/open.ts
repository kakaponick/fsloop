// The one way another surface opens «Находки» filtered (the design check: `openFindings(runKey, filter)`; rules/ui
// → Conventions 7, 12): filters are view state, not URL, so the link writes the findings view's persisted filters
// for that run — the search cleared, so the count the user clicked is the count the view shows — and goes to
// `?view=findings`. The view then reads «Свой набор», or the «Вид» whose filters these are.
import { readPref, writePref } from "@/ui";
import { runPath } from "../app/routes.ts";
import { runKey as viewKey, type RunPrefs } from "../table/view-state.ts";
import { FINDINGS_TABLE, type FindingFilter } from "./facets.ts";

/** Writes `filter` as the findings view's filters for the run and returns the view's address; with `navigate` it
 * also goes there. Every count that links to «Находки» calls this. */
export function openFindings(runKey: string, filter: FindingFilter, navigate?: (to: string) => void): string {
  const key = viewKey(FINDINGS_TABLE, runKey);
  const filters = Object.fromEntries(Object.entries(filter).filter(([, v]) => v && v.length).map(([k, v]) => [k, [...(v as string[])]]));
  writePref<RunPrefs>(key, { ...readPref<Partial<RunPrefs> | null>(key, null), filters, search: "" });
  const to = runPath(runKey, { view: "findings" });
  navigate?.(to);
  return to;
}
