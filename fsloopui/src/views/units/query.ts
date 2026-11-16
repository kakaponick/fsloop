// The units view's pure configuration over the run model (surfaces/units.md → LEADS, ACTIONS, BLOCKS): the row a
// unit reads as, the cell's «state · age · cause», the filters, the search's fields, the default sort, the empty
// state, a unit's launches and its checks grouped by log. The query itself — sort, filters, counts, search — is the
// table kit's (src/table/query.ts); nothing here filters a row.
import type { Launch, Run, RunningLaunch, Unit } from "../../../shared/model.ts";
import { UNIT_STATE, type UnitState } from "../../../shared/states.ts";
import { duration } from "../../../shared/text.ts";
import { emptyWhen, type EmptyWhen } from "@/ui";
import type { FilterDef, SearchDef } from "@/table";
// From the file, not the index: the index reaches the app's links, which reach this view (a cycle at load time).
import { countFindings, MAJOR_UP } from "@/finding/facets.ts";
import { checkOutcome, logName, waitsText } from "./words.ts";

/** The units table's id: its view state is kept under it. */
export const UNITS_TABLE = "units";

type RowRun = Pick<Run, "units" | "findings" | "running" | "launches"> & { key: string };

/** A unit as its row reads it: the model's unit with the facts the row counts, computed once per run. */
export interface UnitRow extends Unit {
  runKey: string;
  /** Findings critical and major whose units name this one — what «Находки» shows under the same filter. */
  majorUp: number;
  minor: number;
  /** Recorded launches plus a running one the record does not hold yet. */
  launchCount: number;
  /** The commits after the shown one: «+N». */
  moreCommits: number;
  /** The ids it waits for that are not committed yet. */
  waits: string[];
}

/** The launch of this unit that runs now: its description opens with the unit's id. */
export const runningFor = (running: readonly RunningLaunch[], unit: Pick<Unit, "id">): RunningLaunch[] => running.filter((r) => new RegExp(`^${unit.id}\\b`).test(r.description ?? ""));

/** Each unit of the run as a row, in units.md's order. */
export function unitRows(run: RowRun): UnitRow[] {
  const state = new Map(run.units.map((u) => [u.id, u.state]));
  return run.units.map((u) => {
    return {
      ...u,
      runKey: run.key,
      majorUp: countFindings(run.findings, { unit: [u.id], severity: [MAJOR_UP] }),
      minor: countFindings(run.findings, { unit: [u.id], severity: ["minor"] }),
      launchCount: launchRows(run, u).length,
      moreCommits: u.commits.filter((c) => c !== u.sha).length,
      waits: u.state === "committed" ? [] : u.blockedBy.filter((id) => state.get(id) !== "committed"),
    };
  });
}

/** The cell's «state · age · cause» parts after the word (rules/ui → Conventions 1): the age from the model's
 * `since` while the unit is in work (never a guess, Conventions 4), the cause last — the blocked reason, the units
 * it waits for, or the state as units.md wrote it when fsloopUI does not know it. */
export function stateDetail(u: Pick<UnitRow, "state" | "since" | "blockedWhy" | "waits" | "stateText">, now: number): string[] {
  const out: string[] = [];
  if (u.state !== "committed" && u.since) out.push(duration(now - Date.parse(u.since), { compact: true }));
  const cause = u.state === "unknown" ? u.stateText : u.state === "blocked" ? (u.blockedWhy ?? waitsText(u.waits)) : waitsText(u.waits);
  if (cause) out.push(cause);
  return out;
}

/** The cell's whole text, for its title. */
export const stateText = (u: Parameters<typeof stateDetail>[0], now: number): string => [UNIT_STATE[u.state].compact, ...stateDetail(u, now)].join(" · ");

// ── sort (LEADS: the current pass first, ties in units.md's order) ──────────────────────────────

export const DEFAULT_SORT = { id: "pass", desc: true } as const;

// ── search (table #12) ──────────────────────────────────────────────────────────────────────────

export const SEARCH: SearchDef<UnitRow> = {
  identifiers: (u) => [u.id, u.sha, ...u.commits, ...u.closes],
  text: (u) => [u.title],
  placeholder: "Юнит, коммит, находка или текст задачи",
};

// ── filters (table #11): «Состояние» always, «Проход» only when the run has more than one ───────

const STATES = Object.keys(UNIT_STATE) as UnitState[];

/** The passes the run's units belong to, in order. */
export const passesOf = (units: readonly Pick<Unit, "pass">[]): number[] => [...new Set(units.map((u) => u.pass))].sort((a, b) => a - b);

export function filtersFor(run: Pick<Run, "units">): FilterDef<UnitRow>[] {
  const out: FilterDef<UnitRow>[] = [
    { id: "state", label: "Состояние", values: (u) => [u.state], options: STATES.map((v) => ({ value: v, label: UNIT_STATE[v].compact })), placeholder: "Найти состояние" },
  ];
  const passes = passesOf(run.units);
  if (passes.length > 1) out.push({ id: "pass", label: "Проход", values: (u) => [String(u.pass)], options: passes.map((p) => ({ value: String(p), label: String(p) })) });
  return out;
}

/** The states the run's units are in, by the map's rank — the counts strip's entries (table #8). */
export const statesOf = (units: readonly Pick<Unit, "state">[]): UnitState[] => STATES.filter((s) => units.some((u) => u.state === s)).sort((a, b) => UNIT_STATE[a].rank - UNIT_STATE[b].rank);

// ── empty (rules/ui → Conventions 15) ───────────────────────────────────────────────────────────

/** A closed or init run never had units; an open one names the stage that brings them. */
export function emptyFor(run: Pick<Run, "closed" | "mode">): EmptyWhen {
  return emptyWhen(run, "decompose");
}

/** «Список юнитов не прочитан»: units.md or the run folder failed. */
export const unitsFailure = (run: Pick<Run, "errors">) => run.errors.find((e) => /(^|[\\/])units\.md$/.test(e.file)) ?? null;

/** «Бриф units/u3/brief.md не прочитан»: the brief named on the unit, or at its usual place, failed. */
export const briefFailure = (run: Pick<Run, "errors">, unit: Pick<Unit, "id" | "brief">) => {
  const paths = [unit.brief, `units/${unit.id}/brief.md`].filter((p): p is string => Boolean(p)).map((p) => p.replace(/\\/g, "/"));
  return run.errors.find((e) => paths.some((p) => e.file.replace(/\\/g, "/").endsWith(p))) ?? null;
};

// ── launches ────────────────────────────────────────────────────────────────────────────────────

export type LaunchRow = { key: string; launch: Launch; running: boolean; startedAt: string | null } | { key: string; launch: null; running: true; startedAt: string | null; live: RunningLaunch };

/** A unit's launches in the run's order; a recorded launch with no end that a running one matches runs now, and a
 * running one the record does not hold yet is listed last. */
export function launchRows(run: Pick<Run, "launches" | "running">, unit: Pick<Unit, "id" | "launches">): LaunchRow[] {
  const live = runningFor(run.running, unit);
  const used = new Set<RunningLaunch>();
  const out: LaunchRow[] = [];
  for (const l of run.launches) {
    if (!unit.launches.includes(l.id)) continue;
    const match = l.endedAt ? undefined : live.find((r) => !used.has(r) && (r.agentId === l.id || r.startedAt === l.startedAt));
    if (match) used.add(match);
    out.push({ key: l.id, launch: l, running: Boolean(match), startedAt: match?.startedAt ?? l.startedAt });
  }
  for (const r of live) if (!used.has(r)) out.push({ key: r.agentId, launch: null, running: true, startedAt: r.startedAt, live: r });
  return out;
}

// ── checks ──────────────────────────────────────────────────────────────────────────────────────

/** A check as fsl.mjs records it in run.json (`units[].checks`, one line of `units/<id>/*.lines`). */
export interface UnitCheck {
  file: string;
  n: number | null;
  label: string | null;
  exit: number | null;
  line: string | null;
  seconds?: number | null;
  startedAt?: string | null;
  endedAt?: string | null;
}

/** The unit's checks when the model carries them; null while it does not (Conventions 4: «не записано»). */
export function checksOf(unit: Unit): readonly UnitCheck[] | null {
  const raw = (unit as Unit & { checks?: unknown }).checks;
  return Array.isArray(raw) ? (raw as UnitCheck[]) : null;
}

export interface CheckLine {
  label: string;
  attempts: number;
  exit: number | null;
  outcome: string;
  /** What the last attempt's line said after its numbers: «2 failed». */
  note: string | null;
  endedAt: string | null;
}

/** The checks grouped by log, each label once with its last outcome and how many times it ran. */
export function checkGroups(checks: readonly UnitCheck[]): { log: string; lines: CheckLine[] }[] {
  const logs = new Map<string, Map<string, CheckLine>>();
  for (const c of checks) {
    const log = logName(c.file);
    const lines = logs.get(log) ?? new Map<string, CheckLine>();
    logs.set(log, lines);
    const label = c.label ?? c.line ?? "";
    const before = lines.get(label);
    lines.set(label, { label, attempts: (before?.attempts ?? 0) + 1, exit: c.exit, outcome: checkOutcome(c.exit), note: c.label ? c.line || null : null, endedAt: c.endedAt ?? null });
  }
  return [...logs].map(([log, lines]) => ({ log, lines: [...lines.values()] }));
}
