// The runs the server watches: their cards, their models and a version per run and for the list. A run's version
// rises when its model changes — a file of its folder, or a launch of its session starting, is read and the model
// differs; the list's when a card changes. What moves with every write of a running launch — its last write, the
// orchestrator's tokens — is no part of the model's version: the card carries it (improve-17). Liveness is not a
// version: it comes from each card's last write time and the client's clock. A tick walks each run once,
// asynchronously, its folder and its transcripts together (walk.ts): a request is answered while a walk is in
// flight (runtime cand-1).
import { createHash } from "node:crypto";
import type { Run, RunCard, ServedRun } from "../shared/model.ts";
import { cardOf, writtenOf } from "./card.ts";
import { discover, type FoundRun } from "./discover.ts";
import { readRun, type Git } from "./run.ts";
import { targetsOf, walkAgain, walkRun, type Targets, type Walk } from "./walk.ts";

interface Entry {
  found: FoundRun;
  /** The stamp of the walk the model was read after: every model is read after its folder is walked, so nothing tells
   * whether a write came after the read but the next walk's stamp — never a clock (f35). */
  stamp: string;
  /** A newer stamp seen on the last tick and not read yet: the run is read once a tick finds it unchanged. */
  pending: string | null;
  /** Ticks in a row that found the folder changed and did not read it. */
  waits: number;
  version: number;
  /** The model's hash, its live parts left out: a read that changes nothing else moves no version (runtime cand-2). */
  hash: string;
  card: RunCard;
  /** Kept for a run that is not closed; a closed one is read again when it is asked for. */
  run: Run | null;
  closed: boolean | null;
  /** What the next walk reads beside the folder: the transcripts the last model named. */
  targets: Targets;
  /** The errors of the last model read whole, run.json's own left out. */
  goodErrors: number;
}

const RECORD = "run.json";
/** A folder that changes on every tick is read anyway on the third (verdict-2): a Verify streaming its log for ten
 * minutes would otherwise freeze the run's view. */
const SETTLE_TICKS = 3;
const NO_TARGETS: Targets = { sessions: [], launches: [], open: true };

/** The model as its version sees it: what moves with every write of a running launch — its last write, the
 * orchestrator's tokens — left out; the card carries both (improve-17). */
const versionedOf = (run: Run): Run => ({ ...run, running: run.running.map((r) => ({ ...r, lastAt: null })), spend: run.spend && { ...run.spend, orchestrator: null } });

/** The run whose writes a card dates: a closed one's model is not kept, and only its folder counts. */
const datedOf = (e: Entry): Pick<Run, "closed" | "running"> => e.run ?? { closed: e.closed, running: [] };

const BUCKET = 15_000;
const bucketOf = (at: string | null) => (at ? Math.floor(Date.parse(at) / BUCKET) : null);
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

  /** The entry of a model just read; `at` — the walk that dates its card. */
  function entryOf(found: FoundRun, prev: Entry | undefined, run: Run, { stamp, at }: { stamp: string; at: Walk }): Entry {
    const hash = createHash("sha1").update(JSON.stringify(versionedOf(run))).digest("hex");
    if (!run.closed) forget(found.key);
    else if (closedRuns.has(found.key)) remember(found.key, run);
    return {
      found,
      stamp,
      pending: null,
      waits: 0,
      version: prev && prev.hash === hash ? prev.version : (prev?.version ?? 0) + 1,
      hash,
      card: cardOf({ key: found.key, project: found.project, run, ...writtenOf(run, at) }),
      run: run.closed ? null : run,
      closed: run.closed,
      targets: targetsOf(run),
      goodErrors: run.errors.filter((e) => e.file !== RECORD).length,
    };
  }

  /** Reads a run; `walked` — its walk this tick, when the caller took it. Null when the folder is gone. */
  async function load(found: FoundRun, prev?: Entry, walked?: Walk): Promise<Entry | null> {
    const targets = prev?.targets ?? NO_TARGETS;
    const at = walked ?? (await walkRun(found.dir, targets));
    if (!at) return null;
    let run = readRun(found.dir, { git });
    const recordFailed = run.errors.filter((e) => e.file === RECORD);
    if (recordFailed.length && prev?.card.recorded) {
      // run.json cannot be read right now (half-written, or locked while fsl.mjs renames it): the previous record
      // stands, with the file's error (rules/ui → Conventions 14). On every such path the stamp stays the one the
      // record was read whole at, so the next ticks read the folder again even when its bytes never move (a lock that
      // lifts): verdict-1 with no model kept, verdict-2 with one.
      const before = prev.run ?? closedRuns.get(found.key) ?? null;
      // A closed run with no model kept: the card carries the error.
      if (!before) return { ...prev, pending: null, waits: 0, card: { ...prev.card, errors: prev.goodErrors + recordFailed.length } };
      run = { ...before, errors: [...before.errors.filter((e) => e.file !== RECORD), ...recordFailed] };
      return entryOf(found, prev, run, { stamp: prev.stamp, at });
    }
    // A record that names other transcripts than the walk read — a session, a launch, the run now closed: those
    // transcripts walked, the folder not again (code-24).
    const next = targetsOf(run);
    const walk = JSON.stringify(next) === JSON.stringify(targets) ? at : await walkAgain(at, next);
    return entryOf(found, prev, run, { stamp: walk.stamp, at: walk });
  }

  /** Re-reads what changed. The first tick finds every run folder new: it walks them all at once, then reads each
   * after its walk, so a write that lands meanwhile moves the next walk's stamp and is read — no start-up read ever
   * stands for a walk by the time it was taken, which a file's mtime and the wall clock cannot tell (f35). The server
   * answers after that tick (http.ts). `full` also discovers new run folders and checks the closed runs. A run is re-read only
   * from settled bytes: a tick that finds its folder changed waits, and the next tick that finds it unchanged reads
   * it — a file caught half-written never replaces the last good model (rules/ui → Conventions 4, 14); a folder that
   * changes on every tick is read on the third. Every walk dates its card, read or not. */
  async function refresh({ full = false }: { full?: boolean } = {}) {
    /** The runs read this tick from their first walk: not walked again in it (code-23). */
    const loaded = new Set<string>();
    if (full || !entries.size) {
      const found = discover(roots);
      const keys = new Set(found.map((f) => f.key));
      for (const k of [...entries.keys()]) if (!keys.has(k)) drop(k);
      // The new folders walked at once, then read one by one.
      const fresh = found.filter((f) => !entries.has(f.key));
      const walked = await Promise.all(fresh.map((f) => walkRun(f.dir, NO_TARGETS)));
      for (const [i, f] of fresh.entries()) {
        const at = walked[i];
        const e = at && !entries.has(f.key) ? await load(f, undefined, at) : null;
        if (e) {
          entries.set(f.key, e);
          loaded.add(f.key);
        }
      }
    }
    // The runs this tick checks, walked at once; what changed is then read one run at a time.
    const due = [...entries].filter(([key, e]) => !loaded.has(key) && (full || e.closed !== true));
    const walks = await Promise.all(due.map(([, e]) => walkRun(e.found.dir, e.targets)));
    for (const [i, [key, e]] of due.entries()) {
      const at = walks[i];
      // Read again meanwhile (a verdict's touch): that entry stands.
      if (entries.get(key) !== e) continue;
      // A folder gone is gone now, not at the next full tick (Conventions 13: «его папки больше нет»).
      if (!at) {
        drop(key);
        continue;
      }
      // The run is writing or still: its liveness counts from this walk, read or not (verdict-2, rules/ui → Live data 4).
      e.card = { ...e.card, ...writtenOf(datedOf(e), at) };
      if (at.stamp === e.stamp) {
        e.pending = null;
        e.waits = 0;
        continue;
      }
      e.waits++;
      if (at.stamp !== e.pending && e.waits < SETTLE_TICKS) {
        e.pending = at.stamp;
        continue;
      }
      const next = await load(e.found, e, at);
      if (entries.get(key) !== e) continue;
      if (next) entries.set(key, next);
      else drop(key);
    }
    // A card's times move the list once per bucket, not on every write.
    const sig = JSON.stringify([...entries.values()].map(({ card }) => ({ ...card, lastWriteAt: bucketOf(card.lastWriteAt), runningLastAt: Object.fromEntries(Object.entries(card.runningLastAt).map(([id, at]) => [id, bucketOf(at)])) })));
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
        // A model whose run.json failed is served, never kept: the next ask reads the folder again.
        if (!run.errors.some((x) => x.file === RECORD)) remember(key, run);
      }
      // A running launch's last write as the card has it: the last tick's, newer than the model's read (improve-17).
      const running = run.running.map((r) => ({ ...r, lastAt: e.card.runningLastAt[r.agentId] ?? r.lastAt }));
      return { ...run, running, key, project: e.found.project, version: e.version };
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
