// The sidebar card of a run and the time its liveness counts from — computed here once, read by every surface.
import type { Run, RunCard } from "../shared/model.ts";
import { NOT_RECORDED, stageOf, type UnitState } from "../shared/states.ts";
import type { Walk } from "./walk.ts";

const GOAL_MAX = 300;

/** The goal's first lines with newlines collapsed, at most 300 characters cut at a word; the run model keeps it whole. */
export function goalLine(goal: string | null): string | null {
  if (!goal) return null;
  const s = goal.replace(/\s+/g, " ").trim();
  if (s.length <= GOAL_MAX) return s || null;
  const cut = s.slice(0, GOAL_MAX + 1).lastIndexOf(" ");
  return s.slice(0, cut > 0 ? cut : GOAL_MAX).replace(/[\s,;:—-]+$/, "") + "…";
}

/** `runningLastAt` — as the tick's walk dated the running launches; the model's own times when absent. */
export function cardOf({ key, project, run, lastWriteAt, runningLastAt = runningLastAtOf(run) }: { key: string; project: string; run: Run; lastWriteAt: string | null; runningLastAt?: Record<string, string | null> }): RunCard {
  const units: Partial<Record<UnitState, number>> = {};
  for (const u of run.units) units[u.state] = (units[u.state] ?? 0) + 1;
  const stage = run.now?.stage ?? null;
  return {
    key,
    project,
    id: run.id,
    recorded: run.recorded,
    goal: goalLine(run.goal),
    mode: run.mode,
    N: run.N,
    K: run.K,
    models: [...new Set(run.launches.map((l) => l.model).filter((m): m is string => Boolean(m)))],
    mirror: run.mirror,
    sessions: run.sessions.map((s) => s.id),
    stage,
    stageLabel: run.closed ? "прогон закрыт" : run.recorded ? stageOf(stage).full : NOT_RECORDED,
    step: run.now?.step ?? null,
    since: run.now?.since ?? null,
    closed: run.closed,
    outcome: run.outcome,
    units,
    unitsTotal: run.units.length,
    blocked: run.units.filter((u) => u.state === "blocked").map((u) => ({ id: u.id, why: u.blockedWhy })),
    launches: run.launches.length,
    running: run.running.length,
    runningLastAt,
    launchCount: run.launchCount,
    spend: run.spend,
    passes: run.passes,
    commits: run.commits,
    redGate: run.now?.redGate ?? null,
    startedAt: run.startedAt,
    updatedAt: run.updatedAt,
    lastWriteAt,
    errors: run.errors.length,
    dir: run.dir,
    worktree: run.worktree,
    version: run.recordVersion,
  };
}

/** Files of a run folder the run does not write: the user's verdicts, which fsloopUI itself appends. A verdict is
 * not the run working (rules/ui → Live data 4); the version stamp still sees it. */
export const NOT_THE_RUNS: ReadonlySet<string> = new Set(["human.jsonl"]);

/** The times a walk of the run took (walk.ts → walkRun): the store's one walk per tick (runtime cand-1, improve-17). */
export type Written = Pick<Walk, "newest" | "transcripts" | "agents">;

const isoOf = (ms: number) => (ms ? new Date(ms).toISOString() : null);

/** When the run last wrote anything: its folder's files at any depth but fsloopUI's own; for an open run also the
 * orchestrator's transcripts its record names with their sub-agents' transcripts, the launches' transcripts, and
 * each running launch's last write. Null when nothing is dated. */
export function lastWriteOf(run: Pick<Run, "closed" | "running">, at: Written): string | null {
  let latest = at.newest;
  if (!run.closed) {
    latest = Math.max(latest, at.transcripts);
    for (const r of run.running) latest = Math.max(latest, at.agents.get(r.agentId) ?? (r.lastAt ? Date.parse(r.lastAt) || 0 : 0));
  }
  return isoOf(latest);
}

/** Each running launch's last write by its agent id: its transcript's time as the walk read it, else the model's. It
 * moves with every write of the launch, so it travels with the card, never in the model's hash (improve-17). */
export function runningLastAtOf(run: Pick<Run, "running">, at?: Written): Record<string, string | null> {
  return Object.fromEntries(run.running.map((r) => [r.agentId, isoOf(at?.agents.get(r.agentId) ?? 0) ?? r.lastAt]));
}

/** What the card carries live of the run's writes, from the tick's walk. */
export const writtenOf = (run: Pick<Run, "closed" | "running">, at: Written): Pick<RunCard, "lastWriteAt" | "runningLastAt"> => ({ lastWriteAt: lastWriteOf(run, at), runningLastAt: runningLastAtOf(run, at) });
