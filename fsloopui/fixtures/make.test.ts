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

  test("the maximum run's goal is 8 000 characters over 50 lines; its frames span both passes", () => {
    const max = maximum();
    expect(max.goal).toHaveLength(8000);
    expect(max.goal?.split("\n")).toHaveLength(50);
    expect(new Set(max.frames.map((f) => f.slice(0, 3)))).toEqual(new Set(["p1-", "p2-"]));
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
