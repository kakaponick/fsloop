import { mkdirSync, mkdtempSync, readFileSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeEach, describe, expect, test } from "vitest";
import { criticReport, decisionTable, writeRun } from "../fixtures/make.ts";
import { createStore, type Store } from "./store.ts";

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
  mkdirSync(join(path, ".."), { recursive: true });
  writeFileSync(path, text);
  utimesSync(path, new Date(at), new Date(at));
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
