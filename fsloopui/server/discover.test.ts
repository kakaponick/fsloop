import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, test } from "vitest";
import { criticReport, writeRun } from "../fixtures/make.ts";
import { cardOf } from "./card.ts";
import { discover } from "./discover.ts";
import { readRun } from "./run.ts";

const NOW = Date.parse("2026-11-16T10:00:00Z");
const temp = mkdtempSync(join(tmpdir(), "fsloopui-discover-"));
afterAll(() => rmSync(temp, { recursive: true, force: true }));

const runsOf = (project: string) => join(project, ".claude", "fsloop", "runs");
const base = { mtime: NOW - 3_600_000, now: NOW };

// Two roots of projects, each with a project named «app»; «work» also holds «site» with three folders.
const home = join(temp, "home");
const work = join(temp, "work");
writeRun(join(runsOf(join(home, "app")), "aaaa0001"), { ...base, id: "aaaa0001", goal: "Home app.", record: true });
writeRun(join(runsOf(join(work, "app")), "aaaa0001"), { ...base, id: "aaaa0001", goal: "Work app.", record: true });
// A v3 run: its review critic's report is named as v3 names it, not `p1-<stage>-craft-<surface>`.
writeRun(join(runsOf(join(work, "site")), "bbbb0002"), {
  ...base,
  id: "bbbb0002",
  record: true,
  launches: [
    { id: "p1-review-critic-craft", stage: "p1-review", agent: "fsloop-critic", description: "critic craft", report: criticReport({ lens: "craft", findings: ["craft-1 [craft] major high local src/a.tsx:3 — ux 1 — the count has no noun — /impeccable clarify: name it."] }) },
    { id: "integrate-critic-craft-verdict", stage: "integrate", agent: "fsloop-critic", description: "critic craft verdict", report: criticReport({ lens: "craft verdict", verdict: [], findings: ["craft-1 [craft] minor med local src/b.tsx:9 — ux 8 — a red word for a done state — /impeccable quieter: neutral."] }) },
  ],
});
// A run folder fsl.mjs never wrote a record into: a head and a log only.
writeRun(join(runsOf(join(work, "site")), "review-cccc0003"), { ...base, id: "review-cccc0003", files: { "logs/bootstrap.log": "x\n" } });
// An empty run folder and a stray file in the runs folder.
mkdirSync(join(runsOf(join(work, "site")), "dddd0004", "logs"), { recursive: true });
// A folder of the root that is no project.
mkdirSync(join(work, "notes"), { recursive: true });

describe("discover", () => {
  const found = discover([home, work]);

  test("finds every run folder, those without run.json included", () => {
    expect(found.map((r) => r.id).sort()).toEqual(["aaaa0001", "aaaa0001", "bbbb0002", "dddd0004", "review-cccc0003"]);
  });

  test("every run has a unique key; two projects of one name are told apart by their parent folder", () => {
    expect(found.map((r) => r.key).sort()).toEqual(["home/app/aaaa0001", "site/bbbb0002", "site/dddd0004", "site/review-cccc0003", "work/app/aaaa0001"]);
    expect(found.find((r) => r.key === "home/app/aaaa0001")).toMatchObject({ project: "home/app", projectDir: join(home, "app") });
  });

  test("a root may itself be a project or a run folder; a run met twice is listed once", () => {
    const again = discover([work, join(work, "site"), join(runsOf(join(work, "site")), "bbbb0002")]);
    expect(again.map((r) => r.key).sort()).toEqual(["app/aaaa0001", "site/bbbb0002", "site/dddd0004", "site/review-cccc0003"]);
  });

  test("a folder without run.json gets a card reading «не записано»", () => {
    const r = found.find((x) => x.id === "review-cccc0003");
    if (!r) throw new Error("not found");
    const card = cardOf({ key: r.key, project: r.project, run: readRun(r.dir), lastWriteAt: null });
    expect(card).toMatchObject({ recorded: false, stage: null, closed: null, stageLabel: "не записано" });
  });

  test("a v3 run's reports give their findings", () => {
    const r = found.find((x) => x.id === "bbbb0002");
    if (!r) throw new Error("not found");
    const run = readRun(r.dir);
    expect(run.findings.map((f) => f.id)).toEqual(["p1-review-critic-craft#craft-1", "integrate-critic-craft-verdict#craft-1"]);
    expect(run.findings[1]).toMatchObject({ launchName: "craft · verdict", fixCommand: "quieter" });
  });
});
