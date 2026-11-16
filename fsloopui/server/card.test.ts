import { mkdtempSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, test } from "vitest";
import { livenessOf } from "../shared/liveness.ts";
import { briefText, writeRecord, writeRun, writeRunningLaunch, writeTranscript, type RunSpec } from "../fixtures/make.ts";
import { cardOf, lastWriteOf } from "./card.ts";
import { readRun } from "./run.ts";

const NOW = Date.parse("2026-11-16T10:00:00Z");
const MIN = 60_000;
const temp = mkdtempSync(join(tmpdir(), "fsloopui-card-"));
afterAll(() => rmSync(temp, { recursive: true, force: true }));

// A goal as long as the longest on this machine: 8 000 characters over 50 lines.
const LONG_GOAL = Array.from({ length: 50 }, (_, k) => `${k + 1}. ${"Keep every fact the operator reads. ".repeat(5)}`.slice(0, 159)).join("\n") + ".";

let n = 0;
function run(over: Partial<RunSpec> = {}) {
  const id = `cafe${String(++n).padStart(4, "0")}`;
  return writeRun(join(temp, id), {
    id,
    mode: "worktree",
    N: 2,
    K: 3,
    goal: LONG_GOAL,
    started: "2026-11-15T10:00:00Z",
    start: "C:/dev/app",
    mtime: NOW - 40 * MIN,
    now: NOW,
    launches: [
      { id: "p1-map-map", stage: "p1-map", agent: "Explore", description: "map", model: "claude-sonnet-5-5", report: "Map.\n" },
      { id: "p1-units-u1-implement", stage: "p1-units", agent: "fsloop-implement", description: "u1 implement", model: "claude-opus-5-5", report: "RESULT: done\n" },
      { id: "p1-units-u2-implement", stage: "p1-units", agent: "fsloop-implement", description: "u2 implement", model: "claude-opus-5-5", report: "RESULT: done\n" },
    ],
    units: [
      { id: "u1", state: "committed 1a2b3c4d", title: "shell", brief: briefText("u1", "shell", []) },
      { id: "u2", state: "implement", title: "list", brief: briefText("u2", "list", []) },
      { id: "u3", state: "blocked: waits for the user — the empty state's wording (j4)", title: "empty", brief: briefText("u3", "empty", [], "u2") },
      { id: "u4", state: "ready", title: "rows", brief: briefText("u4", "rows", []) },
    ],
    gates: [
      { stage: "p1-map", green: true, at: "2026-11-15T11:00:00Z" },
      { stage: "p1-spike", green: true, at: "2026-11-15T11:10:00Z" },
      { stage: "p1-decompose", green: true, at: "2026-11-15T12:00:00Z" },
      { stage: "p1-units", green: false, at: "2026-11-16T09:30:00Z", problems: ["u2: verify.log.lines has no green type-check"] },
    ],
    record: true,
    ...over,
  });
}

describe("cardOf", () => {
  const dir = run();
  const card = cardOf({ key: "app/cafe0001", project: "app", run: readRun(dir), lastWriteAt: null });

  test("carries project, id, settings and the run's state", () => {
    expect(card).toMatchObject({ key: "app/cafe0001", project: "app", id: "cafe0001", recorded: true, mode: "worktree", N: 2, K: 3, mirror: true, models: ["claude-sonnet-5-5", "claude-opus-5-5"], stage: "p1-units", stageLabel: "проход 1 · юниты в работе", closed: false, outcome: null, launches: 3, running: 0, commits: null, startedAt: "2026-11-15T10:00:00Z" });
    expect(card.since).toBe("2026-11-15T12:00:00Z");
  });

  test("the facts the run page folds behind «Подробнее»: the run folder, the worktree, the record's version", () => {
    expect(card.dir).toBe(dir);
    expect(card.worktree).toBeNull();
    expect(card.version).toBe(readRun(dir).version ?? null);
    const bare = join(temp, "bare-run");
    writeRun(bare, { id: "bare-run", common: false, mtime: NOW, now: NOW });
    expect(cardOf({ key: "k", project: "app", run: readRun(bare), lastWriteAt: null })).toMatchObject({ recorded: false, dir: bare, worktree: null, version: null });
  });

  test("units by state, the blocked unit with its why", () => {
    expect(card.units).toEqual({ committed: 1, implement: 1, blocked: 1, ready: 1 });
    expect(card.unitsTotal).toBe(4);
    expect(card.blocked).toEqual([{ id: "u3", why: "waits for the user — the empty state's wording (j4)" }]);
  });

  test("the red gate is read where fsl.mjs writes it: now.waitingOn.lastRedGate", () => {
    expect(card.redGate).toEqual({ at: "2026-11-16T09:30:00Z", problems: ["u2: verify.log.lines has no green type-check"] });
  });

  test("the goal's first lines, newlines collapsed; K and sessions survive an 8 000-character goal", () => {
    expect(LONG_GOAL).toHaveLength(8000);
    // At most 300 characters, cut at a word: line 1 whole (159), then line 2 up to the last word that fits.
    const P = "Keep every fact the operator reads. ";
    expect(card.goal).toBe(`1. ${P.repeat(4)}Keep every f 2. ${P.repeat(3)}Keep every fact the operator…`);
    const s = run({ sessions: ["5e550000-0000-4000-8000-00000000000a", "5e550000-0000-4000-8000-00000000000b"] });
    const c = cardOf({ key: "k", project: "app", run: readRun(s), lastWriteAt: null });
    expect(c.K).toBe(3);
    expect(c.sessions).toEqual(["5e550000-0000-4000-8000-00000000000a", "5e550000-0000-4000-8000-00000000000b"]);
  });

  test("a closed run carries its outcome and no stage", () => {
    const closed = run({
      gates: ["p1-map", "p1-spike", "p1-decompose", "p1-units", "p1-review", "p1-fix", "p1-verdict", "integrate", "finish"].map((stage) => ({ stage, green: true, at: "2026-11-16T08:00:00Z" })),
      units: [{ id: "u1", state: "committed 1a2b3c4d", title: "shell", brief: briefText("u1", "shell", []) }],
      files: { "logs/push.log.lines": "1 push — exit 0 — 4 s — main\n" },
    });
    expect(cardOf({ key: "k", project: "app", run: readRun(closed), lastWriteAt: null })).toMatchObject({ closed: true, stage: null, stageLabel: "прогон закрыт", redGate: null, outcome: { pushed: true, goalMet: true, held: [] } });
  });
});

describe("lastWriteOf — the time liveness counts from", () => {
  test("the newest write anywhere under the run folder, nested files included", () => {
    const dir = run();
    utimesSync(join(dir, "units", "u2", "brief.md"), new Date(NOW - 2 * MIN), new Date(NOW - 2 * MIN));
    const at = lastWriteOf(readRun(dir));
    expect(at).toBe(new Date(NOW - 2 * MIN).toISOString());
    expect(livenessOf(at, NOW).label).toBe("работает");
  });

  test("the orchestrator's transcript the run's record names, and its launches still running", () => {
    const projects = join(temp, "config", "projects");
    const session = "5e550000-0000-4000-8000-0000000000c1";
    const dir = run({ sessions: [session] });
    writeTranscript(projects, "C--dev-app", session, NOW - 20 * MIN);
    writeRunningLaunch(projects, "C--dev-app", session, dir, { agentId: "feed01", description: "u2 implement", agent: "fsloop-implement", startedAt: NOW - 30 * MIN, lastAt: NOW - 4 * MIN });
    writeRecord(dir, NOW, projects);
    utimesSync(join(dir, "run.json"), new Date(NOW - 40 * MIN), new Date(NOW - 40 * MIN));
    utimesSync(join(dir, "summary.json"), new Date(NOW - 40 * MIN), new Date(NOW - 40 * MIN));
    const r = readRun(dir);
    expect(r.running[0].lastAt).toBe(new Date(NOW - 4 * MIN).toISOString());
    expect(lastWriteOf(r)).toBe(new Date(NOW - 4 * MIN).toISOString());
    // The running launch's transcript moves on; its last write is read, not the record's copy.
    writeFileSync(join(projects, "C--dev-app", session, "subagents", "agent-feed01.jsonl"), "{}\n");
    utimesSync(join(projects, "C--dev-app", session, "subagents", "agent-feed01.jsonl"), new Date(NOW - MIN), new Date(NOW - MIN));
    expect(lastWriteOf(r)).toBe(new Date(NOW - MIN).toISOString());
  });

  test("no write at all reads «не записано»", () => {
    const empty = join(temp, "empty-run");
    writeRun(empty, { id: "empty-run", common: false, mtime: NOW, now: NOW });
    rmSync(empty, { recursive: true });
    expect(lastWriteOf({ ...readRun(join(temp, "cafe0001")), dir: empty, sessions: [], running: [], launches: [] })).toBeNull();
    expect(livenessOf(null, NOW).label).toBe("не записано");
  });
});
