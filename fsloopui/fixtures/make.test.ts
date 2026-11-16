import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { beforeAll, describe, expect, inject, test } from "vitest";
import { MAKE_NOW } from "./global-setup.ts";
import { livenessOf } from "../shared/liveness.ts";
import { cardOf, lastWriteOf } from "../server/card.ts";
import { discover } from "../server/discover.ts";
import { startServer } from "../server/main.ts";
import { readRun } from "../server/run.ts";
import { makeFixtureRoot } from "./make.ts";

const NOW = MAKE_NOW;
// The whole root at NOW, written by makeFixtureRoot once in the global setup (fixtures/global-setup.ts), not in this
// file's hook; the global setup removes it after the run. This file is its only reader and writes it again last.
const root = inject("makeFixtureRoot");

/** Every file under the root with its content hash and mtime: equal for two equal roots. */
function snapshot(dir: string): string[] {
  const out: string[] = [];
  const walk = (d: string) => {
    for (const name of readdirSync(d).sort()) {
      const p = join(d, name);
      const s = statSync(p);
      if (s.isDirectory()) walk(p);
      else out.push(`${relative(dir, p)} ${Math.round(s.mtimeMs)} ${createHash("sha1").update(readFileSync(p)).digest("hex")}`);
    }
  };
  walk(dir);
  return out;
}

describe("makeFixtureRoot", () => {
  let runs: ReturnType<typeof discover>;
  let models: ReturnType<typeof readRun>[];
  let first: string[];
  beforeAll(() => {
    runs = discover([root]);
    models = runs.map((r) => readRun(r.dir, { git: () => null }));
    first = snapshot(root);
  });

  test("5 projects, 63 run folders", () => {
    expect(new Set(runs.map((r) => r.project))).toEqual(new Set(["shop", "fsloop", "bots", "admin", "trigger"]));
    expect(runs).toHaveLength(63);
  });

  test("3 live, 4 open and long silent, 53 closed, 3 without run.json — liveness from mtimes set by now", () => {
    const states = models.map((run) => {
      const l = livenessOf(lastWriteOf(run), NOW, { closed: run.closed === true });
      return run.recorded ? l.state + (l.longSilent ? "-long" : "") : "unrecorded";
    });
    const tally = (s: string) => states.filter((x) => x === s).length;
    expect({ working: tally("working"), silentLong: tally("silent-long"), closed: tally("closed"), unrecorded: tally("unrecorded") }).toEqual({ working: 3, silentLong: 4, closed: 53, unrecorded: 3 });
  });

  const maximum = () => {
    const max = models.filter((r) => r.findings.length > 700);
    expect(max).toHaveLength(1);
    return max[0];
  };

  test("the maximum run holds 723 findings of every source and lens", () => {
    const max = maximum();
    expect(max.findings).toHaveLength(723);
    expect(new Set(max.findings.map((f) => f.source))).toEqual(new Set(["critic", "candidate", "open", "own"]));
    expect(new Set(max.findings.map((f) => f.lens).filter(Boolean))).toEqual(new Set(["craft", "standards", "runtime", "parity", "improve", "spec"]));
  });

  test("the maximum run holds 42 units across 2 passes, 97 launches, 1 running", () => {
    const max = maximum();
    expect(max.units).toHaveLength(42);
    expect(new Set(max.units.map((u) => u.pass))).toEqual(new Set([1, 2]));
    expect(max.launches).toHaveLength(97);
    expect(max.running).toHaveLength(1);
  });

  test("the maximum run holds 143 journal rows and 26 conventions", () => {
    const max = maximum();
    expect(max.journal).toHaveLength(143);
    expect(max.conventions).toHaveLength(26);
  });

  test("improve-16: the maximum run's goal has the longest real goal's shape, 8 617 characters over 50 lines; its frames span both passes", () => {
    const max = maximum();
    expect(max.goal).toHaveLength(8617);
    expect(max.goal?.split("\n")).toHaveLength(50);
    expect(new Set(max.frames.map((f) => f.slice(0, 3)))).toEqual(new Set(["p1-", "p2-"]));
  });

  test("improve-16: no goal line of any run ends inside a word — each ends a clause, as written goals do", () => {
    const cut = models.flatMap((run) => (run.goal ?? "").split("\n").filter((line) => line.trim() && !/[.;:!?»)]$/.test(line.trimEnd())).map((line) => `${run.id}: …${line.slice(-30)}`));
    expect(cut).toEqual([]);
  });

  test("improve-16: one open silent run also waits for the user", () => {
    const waiting = runs.flatMap((r, i) => {
      const run = models[i];
      const silent = livenessOf(lastWriteOf(run), NOW, { closed: run.closed === true }).state === "silent";
      const card = cardOf({ key: r.key, project: r.project, run, lastWriteAt: null });
      return silent && (card.blocked.length > 0 || card.redGate) ? [{ key: r.key, blocked: card.blocked }] : [];
    });
    expect(waiting).toHaveLength(1);
    expect(waiting[0].blocked[0].why).toMatch(/^waits for the user — /);
  });

  test("improve-16: a report of admin/a5b5ec85 other than p1-review-critic-craft carries three top-level headings, so the reader draws an outline", () => {
    const max = maximum();
    const outlined = max.launches.flatMap((l) => {
      const text = l.report ? readFileSync(join(max.dir, l.report), "utf8") : "";
      const levels = [...text.matchAll(/^(#{1,6}) \S/gm)].map((m) => m[1].length);
      const top = Math.min(...levels);
      return levels.filter((n) => n === top).length >= 3 ? [l.id] : [];
    });
    expect(outlined.filter((id) => id !== "p1-review-critic-craft")).not.toEqual([]);
  });

  test("improve-16: every committed unit carries its commit in the record the server reads", () => {
    // as the server reads it: run.json for a closed run, a live parse with git for an open one
    const read = runs.map((r) => readRun(r.dir));
    const committed = read.flatMap((run) => run.units.filter((u) => u.state === "committed").map((u) => ({ run: run.id, unit: u.id, commits: u.commits.length, ofRun: run.commits })));
    expect(committed.length).toBeGreaterThan(80);
    expect(committed.filter((c) => c.commits === 0 || !c.ofRun)).toEqual([]);
    const max = read.find((run) => run.id === "a5b5ec85");
    expect(max?.commits).toBe(30);
  });

  test("kept for the frames and the end-to-end check: admin/a5b5ec85 with u22 committed, u23 blocked and p1-review-critic-craft; shop/37d5a31e and shop/a49bc6c7 open and silent", () => {
    const at = (key: string) => models[runs.findIndex((r) => r.key === key)];
    const max = at("admin/a5b5ec85");
    expect([max.findings.length, max.units.length, max.journal.length]).toEqual([723, 42, 143]);
    expect(max.units.find((u) => u.id === "u22")?.state).toBe("committed");
    expect(max.units.find((u) => u.id === "u23")?.state).toBe("blocked");
    expect(max.launches.map((l) => l.id)).toContain("p1-review-critic-craft");
    for (const key of ["shop/37d5a31e", "shop/a49bc6c7"]) {
      const run = at(key);
      expect(livenessOf(lastWriteOf(run), NOW, { closed: run.closed === true }).state).toBe("silent");
    }
  });

  test("the maximum run waits on a red gate and a blocked unit", () => {
    const card = cardOf({ key: "k", project: "admin", run: maximum(), lastWriteAt: null });
    expect(card.redGate?.problems).toEqual(["p2-assess-critic-code#code-2 has no decision row"]);
    expect(card.blocked.map((b) => b.id)).toEqual(["u23"]);
  });

  test("one empty init run", () => {
    const init = models.filter((r) => r.mode === "init");
    expect(init).toHaveLength(1);
    expect(init[0]).toMatchObject({ launches: [], findings: [], units: [], closed: false });
  });

  test("the server answers /api/runs with the 63 cards, bound to 127.0.0.1 only", async () => {
    const s = await startServer({ roots: [root], port: 0, intervalMs: 60_000 });
    try {
      expect((s.server.address() as { address: string }).address).toBe("127.0.0.1");
      const body = await (await fetch(`${s.url}api/runs`)).json();
      expect(body.list).toHaveLength(63);
    } finally {
      await s.close();
    }
  });

  // Last: it writes the root again.
  test("is deterministic: the same now writes the same folders", () => {
    // One folder of each kind, written again at the same place (the record names its paths): the maximum (40),
    // live (24), live through its transcript (30), long silent (3), the empty init (60), closed (0), without run.json (7, 33, 55).
    makeFixtureRoot(root, { now: NOW, only: [0, 3, 7, 24, 30, 33, 40, 55, 60] });
    const second = snapshot(root);
    expect(second.length).toBeGreaterThan(250);
    expect(first.filter((line) => second.includes(line))).toEqual(second);
  });
});
