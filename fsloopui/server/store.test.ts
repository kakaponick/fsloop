import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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
beforeEach(() => {
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
  store.refresh({ full: true });
});

const decided = () => store.run(KEY)?.findings.filter((f) => f.decision).length;

describe("createStore — a run re-read only from settled bytes (runtime-2)", () => {
  test("a half-written file keeps the last good model until its stamp stays still for a second tick", () => {
    const whole = readFileSync(join(dir, "findings", "p1-map.md"), "utf8");
    const version = store.versions().runs[KEY];
    expect(decided()).toBe(2);
    writeFileSync(join(dir, "findings", "p1-map.md"), whole.slice(0, whole.indexOf("#craft-2")));
    store.refresh();
    // The first tick that sees the change waits: the file may still be written.
    expect(store.versions().runs[KEY]).toBe(version);
    expect(decided()).toBe(2);
    writeFileSync(join(dir, "findings", "p1-map.md"), whole);
    store.refresh();
    // The bytes moved again: still waiting, still the last good model.
    expect(decided()).toBe(2);
    store.refresh();
    // Still for a tick: read.
    expect(store.versions().runs[KEY]).toBe(version + 1);
    expect(decided()).toBe(2);
  });

  test("a run.json that cannot be read keeps the previous record, with the file's error", () => {
    const before = store.run(KEY);
    writeFileSync(join(dir, "run.json"), '{"id":');
    store.refresh();
    store.refresh();
    const after = store.run(KEY);
    expect(after).toMatchObject({ recorded: true, closed: false, now: before?.now });
    expect(after?.findings).toHaveLength(3);
    expect(after?.errors.map((e) => e.file)).toEqual(["run.json"]);
    expect(store.list().list[0]).toMatchObject({ key: KEY, recorded: true, errors: 1, stage: before?.now?.stage });
  });
});

describe("createStore — a run folder that vanished (runtime-3)", () => {
  test("is dropped on the next tick, full or not: no card, no version, no model", () => {
    expect(store.has(KEY)).toBe(true);
    rmSync(dir, { recursive: true });
    store.refresh();
    expect(store.has(KEY)).toBe(false);
    expect(store.run(KEY)).toBeNull();
    expect(store.versions().runs).not.toHaveProperty(KEY);
    expect(store.list().list).toEqual([]);
  });
});
