// The runs the server watches: their cards, their models and a version per run and for the list. A run's version
// rises when its model changes — a file of its folder, or a launch of its session starting, is read and the model
// differs; the list's when a card changes. Liveness is not a version: it comes from each card's last write time and
// the client's clock. A tick walks the folders asynchronously, one walk per folder: a request is answered while a
// walk is in flight (runtime cand-1).
import { createHash } from "node:crypto";
import { readdir, stat } from "node:fs/promises";
import { basename, dirname, join, relative } from "node:path";
import type { Run, RunCard, ServedRun } from "../shared/model.ts";
import { cardOf, lastWriteOf, NOT_THE_RUNS } from "./card.ts";
import { discover, type FoundRun } from "./discover.ts";
import { readRun, type Git } from "./run.ts";

interface Entry {
  found: FoundRun;
  /** The stamp the model was read at; null for a model read at start-up, before its folder was walked. */
  stamp: string | null;
  /** When the model was read: a start-up read stands for the first walk's stamp if nothing was written since. */
  readAt: number;
  /** A newer stamp seen on the last tick and not read yet: the run is read once a tick finds it unchanged. */
  pending: string | null;
  /** Ticks in a row that found the folder changed and did not read it. */
  waits: number;
  version: number;
  /** The model's hash: a read that changes nothing moves no version (runtime cand-2). */
  hash: string;
  card: RunCard;
  /** Kept for a run that is not closed; a closed one is read again when it is asked for. */
  run: Run | null;
  closed: boolean | null;
  sessions: string[];
  /** The errors of the last model read whole, run.json's own left out. */
  goodErrors: number;
}

/** One walk of a run folder. */
interface Walk {
  /** Every file under it with its size and mtime, and the launches started, as one hash: the version stamp. */
  stamp: string;
  /** The newest mtime of the run's own writes: every entry at any depth but fsloopUI's (card.ts → lastWriteOf). */
  newest: number;
}

const RECORD = "run.json";
/** A folder that changes on every tick is read anyway on the third (verdict-2): a Verify streaming its log for ten
 * minutes would otherwise freeze the run's view. */
const SETTLE_TICKS = 3;

/** The folder walked once; null when it is gone. */
async function walkFolder(dir: string, extra: string[]): Promise<Walk | null> {
  try {
    if (!(await stat(dir)).isDirectory()) return null;
  } catch {
    return null;
  }
  let newest = 0;
  // Every entry of a folder at once, its subfolders too; the lines come back in name order, so the stamp is stable.
  const walk = async (d: string, top: boolean): Promise<string[]> => {
    let entries;
    try {
      entries = (await readdir(d, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name));
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
  const hash = createHash("sha1").update((await walk(dir, true)).join(""));
  for (const x of extra) hash.update(x);
  return { stamp: hash.digest("hex"), newest };
}

/** The launches the orchestrator started: the meta files beside its session's transcript. */
async function launchesStarted(sessions: string[]): Promise<string[]> {
  const out: string[] = [];
  for (const t of sessions)
    try {
      out.push(...(await readdir(join(dirname(t), basename(t, ".jsonl"), "subagents"))).filter((f) => f.endsWith(".meta.json")));
    } catch {}
  return out;
}

const BUCKET = 15_000;
const CACHE = 4;

export function createStore({ roots, git }: { roots: string[]; git?: Git }) {
  const entries = new Map<string, Entry>();
  /** The closed runs read when asked for, the most recent last; each key once (code-review cand-4). */
  const recent: string[] = [];
  const closedRuns = new Map<string, Run>();
  let listVersion = 0;
  let listSig = "";

  function forget(key: string) {
    closedRuns.delete(key);
    const at = recent.indexOf(key);
    if (at >= 0) recent.splice(at, 1);
  }

  function remember(key: string, run: Run) {
    forget(key);
    closedRuns.set(key, run);
    recent.push(key);
    while (recent.length > CACHE) closedRuns.delete(recent.shift() ?? "");
  }

  function drop(key: string) {
    entries.delete(key);
    forget(key);
  }

  /** The entry of a model just read. */
  function entryOf(found: FoundRun, prev: Entry | undefined, run: Run, { stamp, readAt, lastWriteAt }: { stamp: string | null; readAt: number; lastWriteAt: string | null }): Entry {
    const hash = createHash("sha1").update(JSON.stringify(run)).digest("hex");
    if (!run.closed) forget(found.key);
    else if (closedRuns.has(found.key)) remember(found.key, run);
    return {
      found,
      stamp,
      readAt,
      pending: null,
      waits: 0,
      version: prev && prev.hash === hash ? prev.version : (prev?.version ?? 0) + 1,
      hash,
      card: cardOf({ key: found.key, project: found.project, run, lastWriteAt }),
      run: run.closed ? null : run,
      closed: run.closed,
      sessions: run.sessions.map((s) => s.transcript).filter((t): t is string => Boolean(t)),
      goodErrors: run.errors.filter((e) => e.file !== RECORD).length,
    };
  }

  /** Reads a run; `walked` — its folder's walk this tick, when the caller took it. Null when the folder is gone. */
  async function load(found: FoundRun, prev?: Entry, walked?: Walk): Promise<Entry | null> {
    const sessions = prev?.sessions ?? [];
    const at = walked ?? (await walkFolder(found.dir, await launchesStarted(sessions)));
    if (!at) return null;
    const readAt = Date.now();
    let run = readRun(found.dir, { git });
    const recordFailed = run.errors.filter((e) => e.file === RECORD);
    if (recordFailed.length && prev?.card.recorded) {
      // run.json cannot be read right now (half-written, or locked while fsl.mjs renames it): the previous record
      // stands, with the file's error (rules/ui → Conventions 14). On every such path the stamp and the read time stay
      // the ones the record was read whole at, so the next ticks read the folder again even when its bytes never move
      // (a lock that lifts): verdict-1 with no model kept, verdict-2 with one.
      const before = prev.run ?? closedRuns.get(found.key) ?? null;
      // A closed run with no model kept: the card carries the error.
      if (!before) return { ...prev, pending: null, waits: 0, card: { ...prev.card, errors: prev.goodErrors + recordFailed.length } };
      run = { ...before, errors: [...before.errors.filter((e) => e.file !== RECORD), ...recordFailed] };
      return entryOf(found, prev, run, { stamp: prev.stamp, readAt: prev.readAt, lastWriteAt: lastWriteOf(run, at.newest) });
    }
    const transcripts = run.sessions.map((s) => s.transcript).filter((t): t is string => Boolean(t));
    const stamp = transcripts.join() === sessions.join() ? at.stamp : ((await walkFolder(found.dir, await launchesStarted(transcripts)))?.stamp ?? at.stamp);
    return entryOf(found, prev, run, { stamp, readAt, lastWriteAt: lastWriteOf(run, at.newest) });
  }

  /** The first read of the roots, at once: every run folder and its model, before the server answers anything. The
   * folders are walked by the first tick (`refresh`), which keeps each model unless its folder was written since. */
  function prime() {
    for (const f of discover(roots)) {
      const readAt = Date.now();
      const run = readRun(f.dir, { git });
      entries.set(f.key, entryOf(f, undefined, run, { stamp: null, readAt, lastWriteAt: lastWriteOf(run) }));
    }
  }

  /** Re-reads what changed. `full` also discovers new run folders and checks the closed runs. A run is re-read only
   * from settled bytes: a tick that finds its folder changed waits, and the next tick that finds it unchanged reads
   * it — a file caught half-written never replaces the last good model (rules/ui → Conventions 4, 14); a folder that
   * changes on every tick is read on the third. */
  async function refresh({ full = false }: { full?: boolean } = {}) {
    if (full || !entries.size) {
      const found = discover(roots);
      const keys = new Set(found.map((f) => f.key));
      for (const k of [...entries.keys()]) if (!keys.has(k)) drop(k);
      // The new folders walked at once, then read one by one.
      const fresh = found.filter((f) => !entries.has(f.key));
      const walked = await Promise.all(fresh.map((f) => walkFolder(f.dir, [])));
      for (const [i, f] of fresh.entries()) {
        const at = walked[i];
        const e = at && !entries.has(f.key) ? await load(f, undefined, at) : null;
        if (e) entries.set(f.key, e);
      }
    }
    // The folders this tick checks, walked at once; what changed is then read one run at a time.
    const due = [...entries].filter(([, e]) => full || e.closed !== true);
    const walks = await Promise.all(due.map(async ([, e]) => walkFolder(e.found.dir, await launchesStarted(e.sessions))));
    for (const [i, [key, e]] of due.entries()) {
      const at = walks[i];
      // Read again meanwhile (a verdict's touch): that entry stands.
      if (entries.get(key) !== e) continue;
      // A folder gone is gone now, not at the next full tick (Conventions 13: «его папки больше нет»).
      if (!at) {
        drop(key);
        continue;
      }
      // Read at start-up with no walk: this walk is its stamp, unless the folder was written after the read.
      if (e.stamp === null && at.newest <= e.readAt) {
        e.stamp = at.stamp;
        continue;
      }
      const live = e.run && !e.closed ? e.run : null;
      if (at.stamp === e.stamp) {
        e.pending = null;
        e.waits = 0;
        if (live) e.card = { ...e.card, lastWriteAt: lastWriteOf(live, at.newest) };
        continue;
      }
      e.waits++;
      if (at.stamp !== e.pending && e.waits < SETTLE_TICKS) {
        e.pending = at.stamp;
        // The run is writing: its liveness counts from this write, read or not (verdict-2, rules/ui → Live data 4).
        if (live) e.card = { ...e.card, lastWriteAt: lastWriteOf(live, at.newest) };
        continue;
      }
      const next = await load(e.found, e, at);
      if (entries.get(key) !== e) continue;
      if (next) entries.set(key, next);
      else drop(key);
    }
    const sig = JSON.stringify([...entries.values()].map((e) => ({ ...e.card, lastWriteAt: e.card.lastWriteAt ? Math.floor(Date.parse(e.card.lastWriteAt) / BUCKET) : null })));
    if (sig !== listSig) {
      listSig = sig;
      listVersion++;
    }
  }

  return {
    prime,
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
        // A model whose run.json failed is served, never kept: the next ask reads the folder again.
        if (!run.errors.some((x) => x.file === RECORD)) remember(key, run);
      }
      return { ...run, key, project: e.found.project, version: e.version };
    },
    /** Reads one run again now — after fsloopUI's own write to it. */
    async touch(key: string) {
      const e = entries.get(key);
      if (!e) return;
      const next = await load(e.found, e);
      if (entries.get(key) !== e) return;
      if (next) entries.set(key, next);
      else drop(key);
    },
  };
}

export type Store = ReturnType<typeof createStore>;
