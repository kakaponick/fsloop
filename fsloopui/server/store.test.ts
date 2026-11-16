import { appendFileSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { afterAll, beforeEach, describe, expect, test, vi } from "vitest";
import { criticReport, decisionTable, writeRecord, writeRun, writeRunningLaunch, writeTranscript } from "../fixtures/make.ts";
import { createApp } from "./http.ts";
import { createStore, type Store } from "./store.ts";

/** Every folder the server lists while `on`, sync or not: the walks a tick makes, counted (improve-17). */
const reads = vi.hoisted(() => ({ on: false, paths: [] as string[], walks: [] as string[] }));
vi.mock("node:fs", async (importOriginal) => {
  const fs = await importOriginal<typeof import("node:fs")>();
  const readdirSync = ((p: Parameters<typeof fs.readdirSync>[0], o?: unknown) => {
    if (reads.on) reads.paths.push(String(p));
    return (fs.readdirSync as (p: unknown, o?: unknown) => unknown)(p, o);
  }) as typeof fs.readdirSync;
  return { ...fs, default: { ...fs, readdirSync }, readdirSync };
});
vi.mock("node:fs/promises", async (importOriginal) => {
  const fs = await importOriginal<typeof import("node:fs/promises")>();
  const readdir = ((p: Parameters<typeof fs.readdir>[0], o?: unknown) => {
    if (reads.on) {
      reads.paths.push(String(p));
      reads.walks.push(String(p));
    }
    return (fs.readdir as (p: unknown, o?: unknown) => unknown)(p, o);
  }) as typeof fs.readdir;
  return { ...fs, default: { ...fs, readdir }, readdir };
});
const listed = (dir: string) => reads.paths.filter((p) => resolve(p) === resolve(dir)).length;
/** The walks alone (walk.ts lists asynchronously): a model read's own listing of the sub-agents is no walk. */
const walked = (dir: string) => reads.walks.filter((p) => resolve(p) === resolve(dir)).length;

const NOW = Date.parse("2026-11-16T10:00:00Z");
const temp = mkdtempSync(join(tmpdir(), "fsloopui-store-"));
afterAll(() => rmSync(temp, { recursive: true, force: true }));

const ID = "5e7t1e01";
const KEY = `app/${ID}`;
let root = "";
let dir = "";
let store: Store;
let n = 0;

// An open run: one critic with three findings, two of them decided. Every case writes its own copy.
beforeEach(async () => {
  root = join(temp, `root-${++n}`);
  dir = join(root, "app", ".claude", "fsloop", "runs", ID);
  writeRun(dir, {
    id: ID,
    mtime: NOW - 60_000,
    now: NOW,
    record: true,
    launches: [{ id: "p1-map-craft-shell", stage: "p1-map", agent: "fsloop-critic", description: "craft shell", report: criticReport({ lens: "craft assess", findings: [1, 2, 3].map((k) => `craft-${k} [craft] major high local src/shell.tsx:${k} — ux 2 — the toolbar is clipped — /impeccable adapt: wrap it.`) }) }],
    findings: { "p1-map": decisionTable([1, 2].map((k) => ({ finding: `p1-map-craft-shell#craft-${k}`, decision: "fix", ref: "u1", why: "major local — above the bar" }))) },
  });
  store = createStore({ roots: [root], git: () => null });
  await store.refresh({ full: true });
});

const decided = () => store.run(KEY)?.findings.filter((f) => f.decision).length;
const iso = (ms: number) => new Date(ms).toISOString();

/** Writes a file of the run folder dated `at`, as a run writes it. */
function write(rel: string, text: string, at: number) {
  const path = join(dir, rel);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text);
  for (let p = path; p !== dir; p = dirname(p)) utimesSync(p, new Date(at), new Date(at));
}

const journal = (rows: number) => ["| # | stage | question | decision | why | refs |", "|---|---|---|---|---|---|", ...Array.from({ length: rows }, (_, k) => `| ${k + 1} | p1-map | Route ${k + 1}? | worktree | many pages | — |`), ""].join("\n");

describe("createStore — a run re-read only from settled bytes (runtime-2)", () => {
  test("a half-written file keeps the last good model until its stamp stays still for a second tick", async () => {
    // The table as the run finishes writing it: a third decision.
    const whole = decisionTable([1, 2, 3].map((k) => ({ finding: `p1-map-craft-shell#craft-${k}`, decision: "fix", ref: "u1", why: "major local — above the bar" })));
    const version = store.versions().runs[KEY];
    expect(decided()).toBe(2);
    writeFileSync(join(dir, "findings", "p1-map.md"), whole.slice(0, whole.indexOf("#craft-2")));
    await store.refresh();
    // The first tick that sees the change waits: the file may still be written.
    expect(store.versions().runs[KEY]).toBe(version);
    expect(decided()).toBe(2);
    writeFileSync(join(dir, "findings", "p1-map.md"), whole);
    await store.refresh();
    // The bytes moved again: still waiting, still the last good model.
    expect(decided()).toBe(2);
    await store.refresh();
    // Still for a tick: read.
    expect(store.versions().runs[KEY]).toBe(version + 1);
    expect(decided()).toBe(3);
  });

  test("a run.json that cannot be read keeps the previous record, with the file's error", async () => {
    const before = store.run(KEY);
    writeFileSync(join(dir, "run.json"), '{"id":');
    await store.refresh();
    await store.refresh();
    const after = store.run(KEY);
    expect(after).toMatchObject({ recorded: true, closed: false, now: before?.now });
    expect(after?.findings).toHaveLength(3);
    expect(after?.errors.map((e) => e.file)).toEqual(["run.json"]);
    expect(store.list().list[0]).toMatchObject({ key: KEY, recorded: true, errors: 1, stage: before?.now?.stage });
  });

  test("a folder that changes on every tick is read after three ticks in a row, and its last write follows each tick (verdict-2)", async () => {
    const version = store.versions().runs[KEY];
    for (let k = 1; k <= 3; k++) {
      write("journal.md", journal(k), NOW + k * 1000);
      await store.refresh();
      // The card's liveness counts from this tick's write, read or not.
      expect(store.list().list[0].lastWriteAt).toBe(iso(NOW + k * 1000));
      if (k < 3) expect(store.versions().runs[KEY]).toBe(version);
    }
    expect(store.versions().runs[KEY]).toBe(version + 1);
    expect(store.run(KEY)?.journal).toHaveLength(3);
  });

  test("a write the model does not read moves no version; it still counts as the run's write (runtime cand-2)", async () => {
    const version = store.versions().runs[KEY];
    // A Verify streaming its command's output into the unit's folder.
    write("units/u1/verify.log.9", "ok\n", NOW + 5000);
    await store.refresh();
    await store.refresh();
    expect(store.list().list[0].lastWriteAt).toBe(iso(NOW + 5000));
    expect(store.versions().runs[KEY]).toBe(version);
  });

  test("f35 · start-up never asks the wall clock: a report written once the server is up, dated before it started (a test's fixed clock, a clock that drifts), is read by the ticks that follow — the wall clock before that date and after it", async () => {
    // the critic's report, grown to `total` findings
    const report = (total: number) => criticReport({ lens: "craft assess", findings: Array.from({ length: total }, (_, i) => `craft-${i + 1} [craft] major high local src/shell.tsx:${i + 1} — ux 2 — the toolbar is clipped — /impeccable adapt: wrap it.`) });
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      for (const [wall, total] of [
        [NOW - 60 * 60_000, 5],
        [NOW + 60 * 60_000, 7],
      ] as const) {
        vi.setSystemTime(wall);
        const app = createApp({ roots: [root], distDir: join(temp, "dist"), poll: false, git: () => null });
        // written as the server starts, before its first tick, dated by the run's own clock
        write("reports/p1-map-craft-shell.md", report(total), NOW);
        await app.pulse();
        await app.pulse();
        expect(app.store.run(KEY)?.findings.length, `wall clock ${iso(wall)}`).toBe(total);
        app.close();
      }
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("improve-17 · a live run with a launch running", () => {
  const MIN = 60_000;
  const SESSION = "5e550000-0000-4000-8000-0000000017a1";
  const LIVE_ID = "11fe0017";
  const LIVE_KEY = `app/${LIVE_ID}`;
  /** An open run whose orchestrator session has a transcript and one launch running, in a root of its own. */
  function liveRoot() {
    const at = join(temp, `live-${++n}`);
    const runDir = join(at, "app", ".claude", "fsloop", "runs", LIVE_ID);
    const projects = join(at, "config", "projects");
    writeRun(runDir, { id: LIVE_ID, mtime: NOW - MIN, now: NOW, record: true, sessions: [SESSION] });
    const main = writeTranscript(projects, "C--dev-app", SESSION, NOW - 20 * MIN);
    writeRunningLaunch(projects, "C--dev-app", SESSION, runDir, { agentId: "feed17", description: "u1 implement", agent: "fsloop-implement", startedAt: NOW - 30 * MIN, lastAt: NOW - 4 * MIN });
    writeRecord(runDir, NOW, projects);
    for (const f of ["run.json", "summary.json"]) utimesSync(join(runDir, f), new Date(NOW - MIN), new Date(NOW - MIN));
    const subagents = join(projects, "C--dev-app", SESSION, "subagents");
    return { root: at, runDir, main, subagents, launch: join(subagents, "agent-feed17.jsonl") };
  }
  /** The launch writes on: its transcript grows, dated `at`. */
  const launchWrites = (path: string, at: number) => {
    appendFileSync(path, '{"type":"progress"}\n');
    utimesSync(path, new Date(at), new Date(at));
  };
  /** The orchestrator answers once more: one message whose tokens its transcript records. */
  const orchestratorSpends = (path: string, at: number) => {
    appendFileSync(path, JSON.stringify({ type: "assistant", message: { id: "m-17", role: "assistant", content: [], usage: { input_tokens: 10, output_tokens: 20, cache_creation_input_tokens: 0, cache_read_input_tokens: 300 } } }) + "\n");
    utimesSync(path, new Date(at), new Date(at));
  };

  test("read again a tick apart with nothing moved but the launch's last write and the run's live tokens: the model keeps its version — it is not sent again — and the card carries both", async () => {
    const live = liveRoot();
    const s = createStore({ roots: [live.root], git: () => null });
    await s.refresh({ full: true });
    const version = s.versions().runs[LIVE_KEY];
    const listVersion = s.versions().list;
    // A Verify streams into the unit's folder — the run is read again — while the launch and the orchestrator write.
    const log = join(live.runDir, "units", "u1", "verify.log.9");
    mkdirSync(dirname(log), { recursive: true });
    writeFileSync(log, "ok\n");
    for (let p = log; p !== live.runDir; p = dirname(p)) utimesSync(p, new Date(NOW + 5000), new Date(NOW + 5000));
    orchestratorSpends(live.main, NOW + 8000);
    launchWrites(live.launch, NOW + 9000);
    await s.refresh();
    await s.refresh();
    expect(s.versions().runs[LIVE_KEY]).toBe(version);
    const card = s.list().list[0];
    expect(card.lastWriteAt).toBe(iso(NOW + 9000));
    expect(card.runningLastAt).toEqual({ feed17: iso(NOW + 9000) });
    expect(card.spend?.orchestrator).toEqual({ input: 10, output: 20, cacheWrite: 0, cacheRead: 300 });
    // The list moved instead: a client reads the card, a few hundred bytes, and not the run.
    expect(s.versions().list).toBeGreaterThan(listVersion);
    // Whoever reads the run now reads it as fresh as the card.
    const served = s.run(LIVE_KEY);
    expect(served?.running.map((r) => [r.agentId, r.lastAt])).toEqual([["feed17", iso(NOW + 9000)]]);
    expect(served?.spend?.orchestrator).toEqual({ input: 10, output: 20, cacheWrite: 0, cacheRead: 300 });
  });

  test("a tick lists each folder once — the run folder and the session's sub-agents — and the launch's last write comes from that walk", async () => {
    const live = liveRoot();
    const s = createStore({ roots: [live.root], git: () => null });
    await s.refresh({ full: true });
    const version = s.versions().runs[LIVE_KEY];
    launchWrites(live.launch, NOW + 9000);
    reads.paths = [];
    reads.on = true;
    await s.refresh();
    reads.on = false;
    expect([listed(live.runDir), listed(live.subagents)]).toEqual([1, 1]);
    expect(s.list().list[0]).toMatchObject({ lastWriteAt: iso(NOW + 9000), runningLastAt: { feed17: iso(NOW + 9000) } });
    expect(s.versions().runs[LIVE_KEY]).toBe(version);
  });

  test("start-up: the first tick walks each run's folder once and reads it after that walk: the card's last write comes from that walk", async () => {
    const live = liveRoot();
    reads.paths = [];
    reads.on = true;
    const s = createStore({ roots: [live.root], git: () => null });
    await s.refresh({ full: true });
    reads.on = false;
    expect(listed(live.runDir)).toBe(1);
    // The folder's newest write (NOW − 1 min) is newer than the launch's (NOW − 4 min).
    expect(s.list().list[0]).toMatchObject({ key: LIVE_KEY, lastWriteAt: iso(NOW - MIN), runningLastAt: { feed17: iso(NOW - 4 * MIN) } });
  });

  test("code-23 · a run folder that appears while the server is up is walked once in its tick: its folder and the session's sub-agents listed once each, the card dated from that walk", async () => {
    const live = liveRoot();
    // The run's folder is not there yet when the server starts.
    const away = join(live.root, `away-${LIVE_ID}`);
    renameSync(live.runDir, away);
    const s = createStore({ roots: [live.root], git: () => null });
    await s.refresh({ full: true });
    expect(s.has(LIVE_KEY)).toBe(false);
    renameSync(away, live.runDir);
    reads.paths = [];
    reads.walks = [];
    reads.on = true;
    await s.refresh({ full: true });
    reads.on = false;
    expect([listed(live.runDir), walked(live.subagents)]).toEqual([1, 1]);
    expect(s.list().list[0]).toMatchObject({ key: LIVE_KEY, lastWriteAt: iso(NOW - MIN), runningLastAt: { feed17: iso(NOW - 4 * MIN) } });
  });

  test("code-24 · a record that names a new launch whose transcript lies outside the session's sub-agents: the tick that reads it dates the card from that transcript", async () => {
    const live = liveRoot();
    const s = createStore({ roots: [live.root], git: () => null });
    await s.refresh({ full: true });
    // A launch saved with its transcript elsewhere, written after the record's row.
    const transcript = join(live.root, "elsewhere", "agent-be24.jsonl").replace(/\\/g, "/");
    mkdirSync(dirname(transcript), { recursive: true });
    writeFileSync(transcript, '{"type":"progress"}\n');
    utimesSync(transcript, new Date(NOW + 9000), new Date(NOW + 9000));
    const launches = join(live.runDir, "launches.md");
    writeFileSync(launches, ["| launch | stage | agent | description | agent id | transcript | report |", "|---|---|---|---|---|---|---|", `| p1-map-critic-code | p1-map | fsloop-critic | code | be24 | ${transcript} | reports/p1-map-critic-code.md |`, ""].join("\n"));
    utimesSync(launches, new Date(NOW + 5000), new Date(NOW + 5000));
    // The first tick finds the folder changed and waits; the second finds it still and reads it.
    await s.refresh();
    await s.refresh();
    expect(s.run(LIVE_KEY)?.launches.map((l) => l.transcript)).toEqual([transcript]);
    expect(s.list().list[0].lastWriteAt).toBe(iso(NOW + 9000));
  });
});

describe("createStore — a run folder that vanished (runtime-3)", () => {
  test("is dropped on the next tick, full or not: no card, no version, no model", async () => {
    expect(store.has(KEY)).toBe(true);
    rmSync(dir, { recursive: true });
    await store.refresh();
    expect(store.has(KEY)).toBe(false);
    expect(store.run(KEY)).toBeNull();
    expect(store.versions().runs).not.toHaveProperty(KEY);
    expect(store.list().list).toEqual([]);
  });
});

describe("createStore — closed runs, read when asked for", () => {
  /** A closed run with its record; each case gets a root of its own. */
  function closedRoot(ids: string[]): { root: string; dirOf: (id: string) => string } {
    const at = join(temp, `closed-${++n}`);
    const dirOf = (id: string) => join(at, "app", ".claude", "fsloop", "runs", id);
    for (const id of ids) writeRun(dirOf(id), { id, mtime: NOW - 60_000, now: NOW, record: true, goal: `Run ${id}.`, gates: ["integrate", "finish"].map((stage) => ({ stage, green: true, at: "2026-11-16T09:00:00Z" })) });
    return { root: at, dirOf };
  }
  const setGoal = (dir: string, goal: string) => {
    const path = join(dir, "run.json");
    writeFileSync(path, JSON.stringify({ ...JSON.parse(readFileSync(path, "utf8")), goal }) + "\n");
  };

  test("its run.json unreadable with no model cached: the card carries the file's error, and the run is read again once the file is whole (verdict-1)", async () => {
    const { root: at, dirOf } = closedRoot(["c1053d01"]);
    const s = createStore({ roots: [at], git: () => null });
    await s.refresh({ full: true });
    const path = join(dirOf("c1053d01"), "run.json");
    const whole = readFileSync(path, "utf8");
    writeFileSync(path, '{"id":');
    await s.refresh({ full: true });
    await s.refresh({ full: true });
    expect(s.list().list[0]).toMatchObject({ key: "app/c1053d01", recorded: true, closed: true, goal: "Run c1053d01.", errors: 1 });
    writeFileSync(path, whole.replace("Run c1053d01.", "Run c1053d01, written again."));
    await s.refresh({ full: true });
    await s.refresh({ full: true });
    expect(s.list().list[0]).toMatchObject({ key: "app/c1053d01", recorded: true, closed: true, goal: "Run c1053d01, written again.", errors: 0 });
  });

  test("its run.json unreadable while its model is cached: read again on later ticks, the whole record served once readable (verdict-2)", async () => {
    const { root: at, dirOf } = closedRoot(["c1053d01"]);
    const s = createStore({ roots: [at], git: () => null });
    await s.refresh({ full: true });
    const key = "app/c1053d01";
    // Asked for: its model is now in the cache.
    expect(s.run(key)?.goal).toBe("Run c1053d01.");
    const path = join(dirOf("c1053d01"), "run.json");
    // The record as fsl.mjs writes it next, and the same bytes caught unreadable: one length, one time, so the folder's
    // stamp does not move when the file becomes readable — a lock that lifts rather than a write that ends.
    const whole = readFileSync(path, "utf8").replace("Run c1053d01.", "Run c1053d01!");
    const at1 = new Date(NOW + 5000);
    writeFileSync(path, `x${whole.slice(1)}`);
    utimesSync(path, at1, at1);
    await s.refresh({ full: true });
    await s.refresh({ full: true });
    // The previous record stands, with the file's error.
    expect(s.run(key)).toMatchObject({ goal: "Run c1053d01.", recorded: true, closed: true });
    expect(s.run(key)?.errors.map((e) => e.file)).toEqual(["run.json"]);
    writeFileSync(path, whole);
    utimesSync(path, at1, at1);
    await s.refresh({ full: true });
    await s.refresh({ full: true });
    expect(s.run(key)).toMatchObject({ goal: "Run c1053d01!", recorded: true, closed: true, errors: [] });
    expect(s.list().list[0]).toMatchObject({ key, goal: "Run c1053d01!", errors: 0 });
  });

  test("a run read again keeps one place in the cache: the four asked for last are served from it (code cand-4)", async () => {
    const ids = ["c1053d01", "c1053d02", "c1053d03", "c1053d04", "c1053d05"];
    const { root: at, dirOf } = closedRoot(ids);
    const s = createStore({ roots: [at], git: () => null });
    await s.refresh({ full: true });
    for (const id of ids.slice(0, 4)) s.run(`app/${id}`);
    // Read again now, as after a verdict: its model is the newest in the cache.
    await s.touch(`app/${ids[0]}`);
    s.run(`app/${ids[4]}`);
    // The records change under the cache: a run served from it keeps the goal it was read with.
    for (const id of ids.slice(0, 2)) setGoal(dirOf(id), "changed");
    expect(s.run(`app/${ids[0]}`)?.goal).toBe(`Run ${ids[0]}.`);
    expect(s.run(`app/${ids[1]}`)?.goal).toBe("changed");
  });
});
