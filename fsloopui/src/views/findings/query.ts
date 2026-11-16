// The findings view's pure configuration over the run model (surfaces/findings.md → LEADS, ACTIONS): the columns'
// rank functions, the «Вид» presets, the search's fields and the filters with their options. The query itself —
// sort, filters, counts, search, pages — is the table kit's (src/table/query.ts); nothing here filters a row.
import type { Finding, Run } from "../../../shared/model.ts";
import { FINDING_STATUS, NOT_RECORDED, SEVERITY, STAGE_WORDS, stageOf, VERDICT, type FindingStatus, type Verdict } from "../../../shared/states.ts";
import type { FilterDef, Preset, SearchDef } from "@/table";
// From the file, not the index: the index reaches the app's links, which reach this view (a cycle at load time).
import { DONE_STATES, FACETS, FIX_STATES, MAJOR_UP, NONE, OWN } from "@/finding/facets.ts";

// ── ranks (table #2: states by rank, never by alphabet) ─────────────────────────────────────────

/** The default order (LEADS): severity rank, then the state's rank; ties keep the run's report order (a stable
 * sort over the model's order). A finding without a severity sorts after minor (Conventions 4). */
export const severityRank = (f: Pick<Finding, "severity" | "effectiveStatus">): number => SEVERITY[f.severity ?? "none"].rank * 100 + FINDING_STATUS[f.effectiveStatus].rank;
export const stateRank = (f: Pick<Finding, "effectiveStatus">): number => FINDING_STATUS[f.effectiveStatus].rank;
export const verdictRank = (f: Pick<Finding, "verdict">): number | null => (f.verdict ? VERDICT[f.verdict.verdict].rank : null);
const STEPS = Object.keys(STAGE_WORDS);
export const stageRank = (f: Pick<Finding, "stage">): number | null => {
  const s = stageOf(f.stage);
  return s.step ? (s.pass ?? 0) * 100 + STEPS.indexOf(s.step) : null;
};
const CONFIDENCE: Record<string, number> = { high: 0, med: 1, low: 2 };
export const confidenceRank = (f: Pick<Finding, "confidence">): number | null => (f.confidence ? (CONFIDENCE[f.confidence] ?? 3) : null);

export const DEFAULT_SORT = { id: "severity", desc: false } as const;

// ── «Вид» (rules/ui → Conventions 16) ───────────────────────────────────────────────────────────

export const PRESETS: readonly Preset[] = [
  { id: "all", label: "Все", filters: {} },
  { id: "unrated", label: "Без оценки", filters: { verdict: [NONE] } },
  { id: "fix", label: "В исправление", filters: { state: [...FIX_STATES] } },
  { id: "candidates", label: "Кандидаты", filters: { state: ["candidate"] } },
  { id: "done", label: "Закоммичены", filters: { state: [...DONE_STATES] } },
];

// ── search (table #12) ──────────────────────────────────────────────────────────────────────────

export const SEARCH: SearchDef<Finding> = {
  identifiers: (f) => [f.id, f.location, f.launchName, f.launch, ...f.units],
  text: (f) => [f.summary, f.observation, f.rule, f.fix, f.question, f.why, f.raw, f.evidence],
  placeholder: "Текст, файл, id, юнит",
};

// ── filters (table #11): options over the run, counts from the query ───────────────────────────

export const CAUSES = ["local", "component", "token", "conceptual"] as const;

type FilterRun = Pick<Run, "findings" | "launches" | "units">;

/** The «Отчёт» options: every launch that holds a finding, in the run's order; two launches of one compact name
 * («code» in passes 1 and 2) carry their stage. */
export function reportOptions(run: FilterRun): { value: string; label: string }[] {
  const holding = new Set(run.findings.map((f) => f.launch));
  const launches = run.launches.filter((l) => holding.has(l.id));
  const names = new Map<string, number>();
  const nameOf = (id: string) => run.findings.find((f) => f.launch === id)?.launchName ?? id;
  for (const l of launches) names.set(nameOf(l.id), (names.get(nameOf(l.id)) ?? 0) + 1);
  const out = launches.map((l) => {
    const name = nameOf(l.id);
    return { value: l.id, label: (names.get(name) ?? 0) > 1 ? `${name} · ${stageOf(l.stage).full}` : name };
  });
  if (run.findings.some((f) => f.source === "own")) out.push({ value: OWN, label: "прогон" });
  if (run.findings.some((f) => !f.launch && f.source !== "own")) out.push({ value: NONE, label: NOT_RECORDED });
  return out;
}

export function filtersFor(run: FilterRun): FilterDef<Finding>[] {
  const commands = [...new Set(run.findings.map((f) => f.fixCommand).filter((c): c is string => Boolean(c)))].sort();
  const unitIds = [...new Set([...run.units.map((u) => u.id), ...run.findings.flatMap((f) => f.units)])];
  const title = new Map(run.units.map((u) => [u.id, u.title]));
  return [
    {
      id: "severity",
      label: "Серьёзность",
      values: FACETS.severity,
      options: [{ value: MAJOR_UP, label: "major и выше" }, ...(["critical", "major", "minor"] as const).map((v) => ({ value: v, label: SEVERITY[v].compact })), { value: NONE, label: NOT_RECORDED }],
    },
    { id: "state", label: "Состояние", values: FACETS.state, options: (Object.keys(FINDING_STATUS) as FindingStatus[]).map((v) => ({ value: v, label: FINDING_STATUS[v].compact })), placeholder: "Найти состояние" },
    { id: "report", label: "Отчёт", values: FACETS.report, options: reportOptions(run), placeholder: "Найти отчёт" },
    { id: "unit", label: "Юнит", values: FACETS.unit, options: [...unitIds.map((id) => ({ value: id, label: title.has(id) ? `${id} «${title.get(id)}»` : id })), { value: NONE, label: "без юнита" }], placeholder: "Найти юнит" },
    { id: "verdict", label: "Оценка", values: FACETS.verdict, options: [...(Object.keys(VERDICT) as Verdict[]).map((v) => ({ value: v, label: VERDICT[v].compact })), { value: NONE, label: "без оценки" }] },
    { id: "cause", label: "Охват", values: FACETS.cause, options: [...CAUSES.map((v) => ({ value: v, label: v })), { value: NONE, label: NOT_RECORDED }] },
    { id: "command", label: "Правка", values: FACETS.command, options: [...commands.map((v) => ({ value: v, label: v })), { value: NONE, label: "без команды" }], placeholder: "Найти команду" },
  ];
}
