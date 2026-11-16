// The runs the server watches: their cards, their models and a version per run and for the list. A run's version
// rises when a file of its folder changes, or a launch of its session starts; the list's when a card changes.
// Liveness is not a version: it comes from each card's last write time and the client's clock.
import { createHash } from "node:crypto";
import { readdirSync, statSync } from "node:fs";
import { basename, dirname, join, relative } from "node:path";
import type { Run, RunCard, ServedRun } from "../shared/model.ts";
import { cardOf, lastWriteOf } from "./card.ts";
import { discover, type FoundRun } from "./discover.ts";
import { readRun, type Git } from "./run.ts";

interface Entry {
  found: FoundRun;
  /** The stamp the model was read at. */
  stamp: string;
  /** A newer stamp seen on the last tick and not read yet: the run is read once a tick finds it unchanged. */
  pending: string | null;
  version: number;
  card: RunCard;
  /** Kept for a run that is not closed; a closed one is read again when it is asked for. */
  run: Run | null;
  closed: boolean | null;
  sessions: string[];
}

const isDir = (p: string) => {
  try {
    return statSync(p).isDirectory();
  } catch {
    return false;
  }
};

const RECORD = "run.json";

/** Every file under a folder with its size and mtime, as one hash. */
function folderStamp(dir: string, extra: string[]): string {
  const hash = createHash("sha1");
  const walk = (d: string) => {
    let entries;
    try {
      entries = readdirSync(d, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      const p = join(d, e.name);
      if (e.isDirectory()) walk(p);
      else
        try {
          const s = statSync(p);
          hash.update(`${relative(dir, p)}:${s.size}:${s.mtimeMs}\n`);
        } catch {}
    }
  };
  walk(dir);
  for (const x of extra) hash.update(x);
  return hash.digest("hex");
}

/** The launches the orchestrator started: the meta files beside its session's transcript. */
function launchesStarted(sessions: string[]): string[] {
  const out: string[] = [];
  for (const t of sessions)
    try {
      out.push(...readdirSync(join(dirname(t), basename(t, ".jsonl"), "subagents")).filter((f) => f.endsWith(".meta.json")));
    } catch {}
  return out;
}

const BUCKET = 15_000;
const CACHE = 4;

export function createStore({ roots, git }: { roots: string[]; git?: Git }) {
  const entries = new Map<string, Entry>();
  const recent: string[] = [];
  const closedRuns = new Map<string, Run>();
  let listVersion = 0;
  let listSig = "";

  function drop(key: string) {
    entries.delete(key);
    closedRuns.delete(key);
  }

  function load(found: FoundRun, prev?: Entry): Entry {
    const sessions = prev?.sessions ?? [];
    const stamp = folderStamp(found.dir, launchesStarted(sessions));
    let run = readRun(found.dir, { git });
    const recordFailed = run.errors.filter((e) => e.file === RECORD);
    if (recordFailed.length && prev?.card.recorded) {
      // run.json cannot be read right now (half-written, or locked while fsl.mjs renames it): the previous record
      // stands, with the file's error; the next change of the folder reads it again (rules/ui → Conventions 14).
      const before = prev.run ?? closedRuns.get(found.key) ?? null;
      if (!before) return { ...prev, stamp, pending: null };
      run = { ...before, errors: [...before.errors.filter((e) => e.file !== RECORD), ...recordFailed] };
    }
    const transcripts = run.sessions.map((s) => s.transcript).filter((t): t is string => Boolean(t));
    closedRuns.delete(found.key);
    return {
      found,
      stamp: transcripts.join() === sessions.join() ? stamp : folderStamp(found.dir, launchesStarted(transcripts)),
      pending: null,
      version: (prev?.version ?? 0) + 1,
      card: cardOf({ key: found.key, project: found.project, run, lastWriteAt: lastWriteOf(run) }),
      run: run.closed ? null : run,
      closed: run.closed,
      sessions: transcripts,
    };
  }

  /** Re-reads what changed. `full` also discovers new run folders and checks the closed runs. A run is re-read only
   * from settled bytes: a tick that finds its folder changed waits, and the next tick that finds it unchanged reads
   * it — a file caught half-written never replaces the last good model (rules/ui → Conventions 4, 14). */
  function refresh({ full = false }: { full?: boolean } = {}) {
    if (full || !entries.size) {
      const found = discover(roots);
      const keys = new Set(found.map((f) => f.key));
      for (const k of [...entries.keys()]) if (!keys.has(k)) drop(k);
      for (const f of found) if (!entries.has(f.key)) entries.set(f.key, load(f));
    }
    for (const [key, e] of entries) {
      if (!full && e.closed === true) continue;
      // A folder gone is gone now, not at the next full tick (Conventions 13: «его папки больше нет»).
      if (!isDir(e.found.dir)) {
        drop(key);
        continue;
      }
      const stamp = folderStamp(e.found.dir, launchesStarted(e.sessions));
      if (stamp === e.stamp) {
        e.pending = null;
        if (e.run && !e.closed) e.card = { ...e.card, lastWriteAt: lastWriteOf(e.run) };
      } else if (stamp !== e.pending) e.pending = stamp;
      else entries.set(key, load(e.found, e));
    }
    const sig = JSON.stringify([...entries.values()].map((e) => ({ ...e.card, lastWriteAt: e.card.lastWriteAt ? Math.floor(Date.parse(e.card.lastWriteAt) / BUCKET) : null })));
    if (sig !== listSig) {
      listSig = sig;
      listVersion++;
    }
  }

  return {
    refresh,
    has: (key: string) => entries.has(key),
    dirOf: (key: string) => entries.get(key)?.found.dir ?? null,
    list: () => ({ version: listVersion, list: [...entries.values()].map((e) => e.card) }),
    versions: () => ({ list: listVersion, runs: Object.fromEntries([...entries].map(([k, e]) => [k, e.version])) }),
    run(key: string): ServedRun | null {
      const e = entries.get(key);
      if (!e) return null;
      let run = e.run ?? closedRuns.get(key) ?? null;
      if (!run) {
        run = readRun(e.found.dir, { git });
        closedRuns.set(key, run);
        recent.push(key);
        while (recent.length > CACHE) closedRuns.delete(recent.shift() ?? "");
      }
      return { ...run, key, project: e.found.project, version: e.version };
    },
    /** Reads one run again now — after fsloopUI's own write to it. */
    touch(key: string) {
      const e = entries.get(key);
      if (e) entries.set(key, load(e.found, e));
    },
  };
}

export type Store = ReturnType<typeof createStore>;
