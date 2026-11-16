// One walk of a run: its folder, and the transcripts its record names — the orchestrator's sessions with their
// sub-agents, and the launches'. It gives the store its version stamp and the card the times its liveness counts
// from, together, once per tick and asynchronously: a request is answered while a walk is in flight (runtime cand-1),
// and nothing else lists these folders on a tick (improve-17).
import { createHash } from "node:crypto";
import { readdir, stat } from "node:fs/promises";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import type { Run } from "../shared/model.ts";
import { NOT_THE_RUNS } from "./card.ts";

/** What a walk reads beside the folder: the run's transcripts, as its last model named them. */
export interface Targets {
  /** The orchestrator's transcripts, each beside its folder of sub-agents — the launches it started. */
  sessions: string[];
  /** The launches' transcripts. */
  launches: string[];
  /** A closed run's transcripts are no longer its writes: only the launches started are listed, for the stamp. */
  open: boolean;
}

export interface Walk {
  /** Every file of the folder with its size and mtime, and the launches started, as one hash: the version stamp. */
  stamp: string;
  /** The folder's part of the stamp, kept for a walk of other transcripts (`walkAgain`). */
  folder: string;
  /** The newest mtime of the run's own writes in its folder: every entry at any depth but fsloopUI's (NOT_THE_RUNS). */
  newest: number;
  /** An open run's transcripts, newest mtime: the sessions', their sub-agents' at any depth, the launches'. */
  transcripts: number;
  /** Each sub-agent transcript's mtime by agent id: a running launch's last write. */
  agents: Map<string, number>;
}

/** The targets of a run read: what the next walk of it reads beside the folder. */
export const targetsOf = (run: Pick<Run, "sessions" | "launches" | "closed">): Targets => ({
  sessions: run.sessions.map((s) => s.transcript).filter((t): t is string => Boolean(t)),
  launches: run.launches.map((l) => l.transcript).filter((t): t is string => Boolean(t)),
  open: run.closed !== true,
});

const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name);
const timeOf = async (path: string) => (await stat(path).catch(() => null))?.mtimeMs ?? 0;

/** The folder listed once, every subfolder at once; null when it is gone. */
async function walkFolder(dir: string): Promise<{ folder: string; newest: number } | null> {
  try {
    if (!(await stat(dir)).isDirectory()) return null;
  } catch {
    return null;
  }
  let newest = 0;
  // The lines come back in name order, so the stamp is stable.
  const walk = async (d: string, top: boolean): Promise<string[]> => {
    let entries;
    try {
      entries = (await readdir(d, { withFileTypes: true })).sort(byName);
    } catch {
      return [];
    }
    const lines = await Promise.all(
      entries.map(async (e) => {
        const p = join(d, e.name);
        const s = await stat(p).catch(() => null);
        if (!s) return [];
        if (!(top && NOT_THE_RUNS.has(e.name))) newest = Math.max(newest, s.mtimeMs);
        return e.isDirectory() ? walk(p, false) : [`${relative(dir, p)}:${s.size}:${s.mtimeMs}\n`];
      }),
    );
    return lines.flat();
  };
  return { folder: createHash("sha1").update((await walk(dir, true)).join("")).digest("hex"), newest };
}

/** The transcripts listed once: each session's sub-agents folder gives the launches started (its meta files) and,
 * for an open run, every sub-agent transcript's time; the sessions' and the launches' own are dated beside it. */
async function walkTranscripts({ sessions, launches, open }: Targets): Promise<{ started: string[]; transcripts: number; agents: Map<string, number> }> {
  const folders = sessions.map((t) => join(dirname(t), basename(t, ".jsonl"), "subagents"));
  let transcripts = 0;
  const agents = new Map<string, number>();
  const under = async (d: string, top: boolean): Promise<string[]> => {
    let entries;
    try {
      entries = (await readdir(d, { withFileTypes: true })).sort(byName);
    } catch {
      return [];
    }
    if (open)
      await Promise.all(
        entries.map(async (e) => {
          const p = join(d, e.name);
          if (e.isDirectory()) return void (await under(p, false));
          if (!e.name.endsWith(".jsonl")) return;
          const at = await timeOf(p);
          transcripts = Math.max(transcripts, at);
          if (top) agents.set(e.name.replace(/^agent-/, "").replace(/\.jsonl$/, ""), at);
        }),
      );
    return top ? entries.filter((e) => e.name.endsWith(".meta.json")).map((e) => e.name) : [];
  };
  const inside = folders.map((d) => resolve(d) + sep);
  const own = open ? [...sessions, ...launches.filter((t) => !inside.some((d) => resolve(t).startsWith(d)))] : [];
  const [started, times] = await Promise.all([Promise.all(folders.map((d) => under(d, true))), Promise.all(own.map(timeOf))]);
  for (const at of times) transcripts = Math.max(transcripts, at);
  return { started: started.flat(), transcripts, agents };
}

const stampOf = (folder: string, started: string[]) => {
  const hash = createHash("sha1").update(folder);
  for (const x of started) hash.update(x);
  return hash.digest("hex");
};

/** The run walked once: its folder and its transcripts. Null when the folder is gone. */
export async function walkRun(dir: string, targets: Targets): Promise<Walk | null> {
  const [folder, t] = await Promise.all([walkFolder(dir), walkTranscripts(targets)]);
  return folder ? { stamp: stampOf(folder.folder, t.started), folder: folder.folder, newest: folder.newest, transcripts: t.transcripts, agents: t.agents } : null;
}

/** A walk's folder with other transcripts: a read whose record names other sessions than the walk read. */
export async function walkAgain(walk: Walk, targets: Targets): Promise<Walk> {
  const t = await walkTranscripts(targets);
  return { ...walk, stamp: stampOf(walk.folder, t.started), transcripts: t.transcripts, agents: t.agents };
}
