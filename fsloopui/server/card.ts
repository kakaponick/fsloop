// The sidebar card of a run and the time its liveness counts from — computed here once, read by every surface.
import { readdirSync, statSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import type { Run, RunCard } from "../shared/model.ts";
import { NOT_RECORDED, stageOf, type UnitState } from "../shared/states.ts";

const GOAL_MAX = 300;

/** The goal's first lines with newlines collapsed, at most 300 characters cut at a word; the run model keeps it whole. */
export function goalLine(goal: string | null): string | null {
  if (!goal) return null;
  const s = goal.replace(/\s+/g, " ").trim();
  if (s.length <= GOAL_MAX) return s || null;
  const cut = s.slice(0, GOAL_MAX + 1).lastIndexOf(" ");
  return s.slice(0, cut > 0 ? cut : GOAL_MAX).replace(/[\s,;:—-]+$/, "") + "…";
}

export function cardOf({ key, project, run, lastWriteAt }: { key: string; project: string; run: Run; lastWriteAt: string | null }): RunCard {
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

function mtime(path: string): number {
  try {
    return statSync(path).mtimeMs;
  } catch {
    return 0;
  }
}

/** The newest mtime of a folder's entries, nested folders included; `skip` — names left out at its top. */
function newestUnder(dir: string, only?: RegExp, skip?: ReadonlySet<string>): number {
  let latest = 0;
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return 0;
  }
  for (const e of entries) {
    if (skip?.has(e.name)) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) latest = Math.max(latest, only ? 0 : mtime(p), newestUnder(p, only));
    else if (!only || only.test(e.name)) latest = Math.max(latest, mtime(p));
  }
  return latest;
}

/** Files of a run folder the run does not write: the user's verdicts, which fsloopUI itself appends. A verdict is
 * not the run working (rules/ui → Live data 4); the version stamp still sees it. */
export const NOT_THE_RUNS: ReadonlySet<string> = new Set(["human.jsonl"]);

/** When the run last wrote anything: its folder's files at any depth but fsloopUI's own; for an open run also the
 * orchestrator's transcripts its record names with their sub-agents' transcripts, the launches' transcripts, and
 * each running launch's last write. Null when nothing is dated. `folderNewest` — the folder's part, when a walk of
 * it already took it (the store's one walk per tick, runtime cand-1). */
export function lastWriteOf(run: Run, folderNewest?: number): string | null {
  let latest = folderNewest ?? newestUnder(run.dir, undefined, NOT_THE_RUNS);
  if (!run.closed) {
    for (const s of run.sessions) {
      if (!s.transcript) continue;
      latest = Math.max(latest, mtime(s.transcript), newestUnder(join(dirname(s.transcript), basename(s.transcript, ".jsonl"), "subagents"), /\.jsonl$/));
    }
    for (const l of run.launches) if (l.transcript) latest = Math.max(latest, mtime(l.transcript));
    for (const r of run.running) latest = Math.max(latest, r.lastAt ? Date.parse(r.lastAt) || 0 : 0);
  }
  return latest ? new Date(latest).toISOString() : null;
}
