import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, test } from "vitest";
import { briefText, criticReport, decisionTable, implementReport, ownTable, writeRecord, writeRun, writeRunningLaunch, writeTranscript, type RunSpec } from "../fixtures/make.ts";
import { readRun } from "./run.ts";

const NOW = Date.parse("2026-11-16T10:00:00Z");
const temp = mkdtempSync(join(tmpdir(), "fsloopui-run-"));
afterAll(() => rmSync(temp, { recursive: true, force: true }));

// Known-answer lines: real FINDINGS lines of this machine's runs, each split by hand below.
const REAL = {
  // tga a098a7d4 reports/p1-map-craft-actions-bots.md:11 — a strict line whose rule carries the observation.
  craft3: "craft-3 [craft] major high component src/web/actions/queue-buttons.tsx:55 — ux 8 (red marks only a state to act on), ui → Page chrome (the page's main action leads), impeccable critique: Aesthetic and minimalist design / visual hierarchy. Whenever the queue is not empty, the red-tinted «Очистить очередь» is the loudest element on the page in all four frames. It outranks «Передать…», which is grey while blocked. During a pass «Остановить передачу» (:45) puts a second red button beside it. Its variant also flips between red and outline with the queue state. The same `ClearButton` is used on «Изменение чатов», so both pages carry it. DESIGN.md's tinted destructive button does not close this. — /impeccable quieter: «Очистить очередь» is outline at rest on both pages, and red stays on its confirm verb.",
  // a craft line whose fix and operator question sit after the observation, in one segment.
  craft9: "craft-9 [craft] minor low local src/web/dialogs/feed-state.ts:253 — `ux 1` → No ownerless word — «Показано 100 из 200» names no noun. `/impeccable clarify`: a compact string that names messages. Closes «ста чего».",
  // a code line in the grammar: rule — observation — action.
  code29: "code-29 [standards] major low local src/worker/telegram/intake.ts:247 — `code` → No duplication — `senderOf` (`u:`/`c:`/`g:`) repeats the peer-key scheme of `peerKeyOf` (src/worker/telegram/dialog-page.ts:76-81). — Use one peer-key function.",
  // a code line fsl.mjs cannot parse strictly: its cause stands before a dash, its action after «Action:».
  code21: "code-21 [standards] major high conceptual — src/web/chats/farm/page.tsx:128 — code → No duplication — `retryOutcomes`/`retryRows` re-implement `launchOutcomes`/`useLaunchActions.send` (launcher/api.ts:149-207). Action: one batch-command hook.",
  // a runtime line with «rule:», «Problem:» and «action:» markers and a dash inside its rule.
  runtime7: "runtime-7 [runtime] major high — src/server/routes/channel-join.ts:14 — rule: `code` → A mutating action fails loudly; `.claude/rules/code.md` → Лог — `logError` и `app_logs`. Problem: `POST /api/channels/join` is the only mutating channel route without `errorLogFor`; an unexpected throw (DB, queue start) reaches `logUncaughtError`, which writes to stdout only. — action: wrap it in `logged(\"channels.join\", …)` as the other channel routes are.",
  // tga a098a7d4 reports/p1-units-u3-implement.md OPEN.
  open1: "craft-14 (minor) not done: «· версия» in the worker start notice is pinned as old-TGA parity in worker-events.test.ts and forward.test.ts; left for the user. craft-15 and craft-16 (minor) not done.",
};
const FRAMED = "craft-12 [craft] major med local src/web/campaigns/page.tsx:40 — ux 2, impeccable audit: Responsive. The campaign page clips its toolbar at 1280 (p1-baseline-actions-bots-) and again after the fix in p2-final-campaign-page. — /impeccable adapt: let the toolbar wrap.";
const CANDIDATE = "A keyboard shortcut for «Передать…» would save a step.";
const OWN = { finding: "p1-map-own#1", decision: "fix", ref: "u1", why: "the shot raise leaves the pg-boss schema out, so campaign-backed pages frame a failure instead of their state (j11)", severity: "major", evidence: "logs/shots-server.log (85 lines «schema \"pgboss\" does not exist»)" };

let n = 0;
function fixture(over: Partial<RunSpec> = {}): string {
  // A run folder is named by its run id, as fsloop names it.
  const id = `abc${String(++n).padStart(5, "0")}`;
  const dir = join(temp, id);
  const spec: RunSpec = {
    id,
    mode: "worktree",
    N: 2,
    K: 3,
    goal: "Bring the actions pages to the law.",
    started: "2026-11-16T06:00:00Z",
    mtime: NOW - 10 * 60_000,
    now: NOW,
    launches: [
      { id: "p1-map-craft-actions-bots", stage: "p1-map", agent: "fsloop-critic", description: "craft actions-bots", report: criticReport({ lens: "craft assess", audit: "«Действия → Боты» audit 12/20 · critique 24/40", findings: [REAL.craft3, REAL.craft9, FRAMED], candidates: [CANDIDATE], unverified: ["ux 7 — a 1280 frame would settle it"] }) },
      { id: "p1-units-u1-implement", stage: "p1-units", agent: "fsloop-implement", description: "u1 implement", report: implementReport({ changed: ["src/web/actions/queue-buttons.tsx"], open: [REAL.open1] }) },
      { id: "p1-review-critic-code", stage: "p1-review", agent: "fsloop-critic", description: "critic code", report: criticReport({ lens: "code", findings: [REAL.code29, REAL.code21] }) },
      { id: "p1-assess-critic-runtime", stage: "p1-assess", agent: "fsloop-critic", description: "critic runtime", report: criticReport({ lens: "runtime", findings: [REAL.runtime7] }) },
    ],
    findings: {
      // Two tables in one file: the decisions, then the run's own findings with their severity and evidence.
      "p1-map": decisionTable([
        { finding: "p1-map-craft-actions-bots#craft-3", decision: "fix", ref: "u1", why: "major component — above the bar" },
        { finding: "p1-map-craft-actions-bots#craft-9", decision: "candidate", why: "minor — below the bar" },
        { finding: "p1-map-craft-actions-bots#craft-12", decision: "fix", ref: "u1", why: "major local — above the bar" },
      ]) + "\n\n" + ownTable([OWN]),
      "p1-review": decisionTable([{ finding: "p1-review-critic-code#code-29", decision: "fix", ref: "u1", why: "duplication" }]),
    },
    units: [{ id: "u1", state: "verify", title: "actions pages", brief: briefText("u1", "actions pages", ["p1-map-craft-actions-bots#craft-3", "p1-map-craft-actions-bots#craft-12", "p1-map-own#1"]), checks: ["1 type-check — exit 0 — 12 s — "] }],
    journal: [
      { n: 1, stage: "p1-map", question: "Route?", decision: "worktree", why: "many pages", refs: "p1-map-craft-actions-bots#craft-3, u1" },
      { n: 2, stage: "p1-review", question: "Take code-21?", decision: "later", why: "see u7", refs: "u7 j1" },
    ],
    gates: [{ stage: "p1-map", green: true, at: "2026-11-16T07:00:00Z" }],
    shots: ["p1-baseline-actions-bots-1280-dark.png", "p1-baseline-actions-bots-1440-light.png", "p1-baseline-other-1440-light.png", "p2-final-campaign-page.png"],
    ...over,
  };
  return writeRun(dir, spec);
}

const byLocal = (run: ReturnType<typeof readRun>, id: string) => {
  const f = run.findings.find((x) => x.id === id);
  if (!f) throw new Error(`no finding ${id}`);
  return f;
};

describe("readRun — every finding of every source", () => {
  const run = readRun(fixture());

  test("counts the fixture's 9: 3 craft, 1 candidate, 2 code, 1 runtime, 1 implementer's OPEN line, 1 own", () => {
    expect(run.findings).toHaveLength(9);
    expect(run.findings.map((f) => f.source).sort()).toEqual(["candidate", "critic", "critic", "critic", "critic", "critic", "critic", "open", "own"]);
    expect(run.errors).toEqual([]);
  });

  test("the second table of a findings file is read as a table, not as data rows", () => {
    const own = byLocal(run, "p1-map-own#1");
    expect(own).toMatchObject({ source: "own", severity: "major", decision: "fix", ref: "u1", evidence: OWN.evidence, launchName: "прогон" });
    expect(run.findings.some((f) => f.id === "finding" || f.id === "---")).toBe(false);
  });

  test("each finding carries its decision and status", () => {
    expect(byLocal(run, "p1-map-craft-actions-bots#craft-3")).toMatchObject({ decision: "fix", status: "in-progress", unit: "u1", units: ["u1"] });
    expect(byLocal(run, "p1-map-craft-actions-bots#craft-9")).toMatchObject({ decision: "candidate", status: "candidate" });
    expect(byLocal(run, "p1-review-critic-code#code-21")).toMatchObject({ decision: null, status: "undecided" });
    expect(byLocal(run, "p1-map-craft-actions-bots#cand-1")).toMatchObject({ source: "candidate", status: "candidate", observation: CANDIDATE, rule: null });
  });

  test("a craft line: rule apart from the observation its rule segment carries, the fix command apart", () => {
    const f = byLocal(run, "p1-map-craft-actions-bots#craft-3");
    expect(f.rule).toBe("ux 8 (red marks only a state to act on), ui → Page chrome (the page's main action leads), impeccable critique: Aesthetic and minimalist design / visual hierarchy");
    expect(f.observation).toBe(
      "Whenever the queue is not empty, the red-tinted «Очистить очередь» is the loudest element on the page in all four frames. It outranks «Передать…», which is grey while blocked. During a pass «Остановить передачу» (:45) puts a second red button beside it. Its variant also flips between red and outline with the queue state. The same `ClearButton` is used on «Изменение чатов», so both pages carry it. DESIGN.md's tinted destructive button does not close this.",
    );
    expect(f.fixCommand).toBe("quieter");
    expect(f.fix).toBe("«Очистить очередь» is outline at rest on both pages, and red stays on its confirm verb.");
    expect(f.question).toBeNull();
    expect(f.summary).toBe("Whenever the queue is not empty, the red-tinted «Очистить очередь» is the loudest element on the page in all four frames.");
    expect(f).toMatchObject({ lens: "craft", severity: "major", confidence: "high", cause: "component", location: "src/web/actions/queue-buttons.tsx:55", surface: "actions-bots", launchName: "craft · actions-bots" });
  });

  test("a fix and an operator question inside the observation's segment", () => {
    const f = byLocal(run, "p1-map-craft-actions-bots#craft-9");
    expect(f).toMatchObject({ rule: "`ux 1` → No ownerless word", observation: "«Показано 100 из 200» names no noun.", fixCommand: "clarify", fix: "a compact string that names messages.", question: "«ста чего»" });
  });

  test("a code line: rule — observation — action", () => {
    const f = byLocal(run, "p1-review-critic-code#code-29");
    expect(f).toMatchObject({ rule: "`code` → No duplication", observation: "`senderOf` (`u:`/`c:`/`g:`) repeats the peer-key scheme of `peerKeyOf` (src/worker/telegram/dialog-page.ts:76-81).", fix: "Use one peer-key function.", fixCommand: null });
  });

  test("a line fsl.mjs reads only loosely still gets its location, cause and split", () => {
    const f = byLocal(run, "p1-review-critic-code#code-21");
    expect(f).toMatchObject({ lens: "standards", severity: "major", confidence: "high", cause: "conceptual", location: "src/web/chats/farm/page.tsx:128", rule: "code → No duplication", observation: "`retryOutcomes`/`retryRows` re-implement `launchOutcomes`/`useLaunchActions.send` (launcher/api.ts:149-207).", fix: "one batch-command hook." });
  });

  test("«rule:», «Problem:» and «action:» markers, a dash inside the rule", () => {
    const f = byLocal(run, "p1-assess-critic-runtime#runtime-7");
    expect(f.rule).toBe("`code` → A mutating action fails loudly; `.claude/rules/code.md` → Лог — `logError` и `app_logs`");
    expect(f.observation).toBe("`POST /api/channels/join` is the only mutating channel route without `errorLogFor`; an unexpected throw (DB, queue start) reaches `logUncaughtError`, which writes to stdout only.");
    expect(f.fix).toBe("wrap it in `logged(\"channels.join\", …)` as the other channel routes are.");
    expect(f.location).toBe("src/server/routes/channel-join.ts:14");
  });

  test("a line with no rule keeps one unsplit text, never the same string twice", () => {
    const f = byLocal(run, "p1-units-u1-implement#open-1");
    expect(f).toMatchObject({ source: "open", rule: null, observation: REAL.open1, launchName: "u1 · исполнитель" });
    for (const x of run.findings) if (x.rule !== null) expect(x.rule).not.toBe(x.observation);
  });

  test("frames of every pass cited by a finding are linked", () => {
    expect(byLocal(run, "p1-map-craft-actions-bots#craft-12").frames).toEqual(["p1-baseline-actions-bots-1280-dark.png", "p1-baseline-actions-bots-1440-light.png", "p2-final-campaign-page.png"]);
    expect(byLocal(run, "p1-map-craft-actions-bots#craft-3").frames).toEqual([]);
  });

  test("launches carry their report sections; surfaces their scores and frames; journal refs resolve", () => {
    const craft = run.launches.find((l) => l.id === "p1-map-craft-actions-bots");
    expect(craft?.sections.UNVERIFIED.items).toEqual(["ux 7 — a 1280 frame would settle it"]);
    expect(craft?.sections.FINDINGS).toBeUndefined();
    expect(craft?.findings).toHaveLength(4);
    expect(run.surfaces).toEqual([{ key: "actions-bots", label: "Действия → Боты", scores: [{ stage: "p1-map", launch: "p1-map-craft-actions-bots", audit: 12, auditMax: 20, critique: 24, critiqueMax: 40 }], frames: ["p1-baseline-actions-bots-1280-dark.png", "p1-baseline-actions-bots-1440-light.png"], findings: 4 }]);
    expect(run.journal[0].refs).toEqual([
      { id: "p1-map-craft-actions-bots#craft-3", kind: "finding", found: true },
      { id: "u1", kind: "unit", found: true },
    ]);
    expect(run.journal[1].refs).toEqual([
      { id: "u7", kind: "text", found: false },
      { id: "j1", kind: "journal", found: true },
    ]);
  });

  test("a unit's since is its last check's end when no launch of it runs", () => {
    expect(run.units[0]).toMatchObject({ id: "u1", state: "verify", since: new Date(NOW - 10 * 60_000).toISOString() });
  });

  test("a run folder without run.json shows no state it would have to guess", () => {
    expect(run).toMatchObject({ recorded: false, source: "live", now: null, closed: null, goal: "Bring the actions pages to the law.", N: 2, K: 3 });
  });
});

describe("readRun — the record and its fallbacks", () => {
  test("a closed run is read from its run.json and split the same way", () => {
    const dir = fixture({ gates: ["p1-map", "p1-spike", "p1-decompose", "p1-units", "p1-review", "p1-fix", "p1-verdict", "integrate", "finish"].map((stage) => ({ stage, green: true, at: "2026-11-16T09:00:00Z" })), record: true });
    const run = readRun(dir);
    expect(run).toMatchObject({ recorded: true, source: "record", closed: true, now: null });
    expect(run.findings).toHaveLength(9);
    expect(byLocal(run, "p1-assess-critic-runtime#runtime-7").fix).toBe("wrap it in `logged(\"channels.join\", …)` as the other channel routes are.");
  });

  test("an open run is parsed live, its running launch found through the transcripts its record names", () => {
    const projects = join(temp, "config-1", "projects");
    const session = "5e550000-0000-4000-8000-000000000001";
    const dir = fixture({ sessions: [session], units: [{ id: "u1", state: "implement", title: "actions pages", brief: briefText("u1", "actions pages", []) }] });
    writeTranscript(projects, "C--proj", session, NOW - 60_000);
    writeRunningLaunch(projects, "C--proj", session, dir, { agentId: "abc123", description: "u1 implement", agent: "fsloop-implement", startedAt: NOW - 12 * 60_000, lastAt: NOW - 30_000 });
    writeRecord(dir, NOW, projects);
    const run = readRun(dir);
    expect(run).toMatchObject({ recorded: true, source: "live", closed: false });
    // fsl.mjs's own reading: the furthest stage reached and not yet green.
    expect(run.now?.stage).toBe("p1-assess");
    expect(run.running).toEqual([{ agentId: "abc123", description: "u1 implement", agent: "fsloop-implement", name: "u1 · исполнитель", startedAt: new Date(NOW - 12 * 60_000).toISOString(), lastAt: new Date(NOW - 30_000).toISOString() }]);
    expect(run.units[0].since).toBe(new Date(NOW - 12 * 60_000).toISOString());
    expect(run.sessions).toEqual([{ id: session, transcript: join(projects, "C--proj", `${session}.jsonl`) }]);
  });

  test("a file that cannot be read fails in its own place; the rest of the run is served", () => {
    const dir = fixture({ record: true });
    rmSync(join(dir, "units.md"));
    mkdirSync(join(dir, "units.md"));
    const run = readRun(dir);
    expect(run.source).toBe("record");
    expect(run.findings).toHaveLength(9);
    expect(run.errors).toHaveLength(1);
    expect(run.errors[0].file).toBe("папка прогона");
    expect(run.errors[0].cause).toMatch(/EISDIR/);
  });

  test("a launch whose report file is gone is an error of that file", () => {
    const dir = fixture({ launches: [{ id: "p1-map-craft-gone", stage: "p1-map", agent: "fsloop-critic", description: "craft gone", report: null }] });
    expect(readRun(dir).errors).toEqual([{ file: "reports/p1-map-craft-gone.md", cause: "файла нет" }]);
  });
});

describe("readRun — a launch's boot, child launches and agent id; a unit's checks", () => {
  test("launches.md's boot, children and agent id reach the launch as written", () => {
    const dir = fixture({
      launches: [
        { id: "p1-map-craft-actions-bots", stage: "p1-map", agent: "fsloop-critic", description: "craft actions-bots", agentId: "a1b2c3d4e5", boot: 41_250, children: { launches: 2, input: 1_800, output: 22_000, cacheWrite: 90_000, cacheRead: 610_000 }, report: criticReport({ lens: "craft assess", findings: [REAL.craft9] }) },
        { id: "p1-review-critic-code", stage: "p1-review", agent: "fsloop-critic", description: "critic code", report: criticReport({ lens: "code", findings: [REAL.code29] }) },
      ],
    });
    const [craft, code] = readRun(dir).launches;
    expect(craft.agentId).toBe("a1b2c3d4e5");
    expect(craft.boot).toBe(41_250);
    expect(craft.children).toEqual({ launches: 2, input: 1_800, output: 22_000, cacheWrite: 90_000, cacheRead: 610_000 });
    // no agent id written: absent, never guessed
    expect(code).not.toHaveProperty("agentId");
    expect(code.boot).toBe(0);
  });

  test("a launches.md written before the boot and children columns: both absent", () => {
    const legacy = ["| launch | stage | agent | description | model | started | ended | seconds | input | output | cache write | cache read | transcript | report |", "|---|---|---|---|---|---|---|---|---|---|---|---|---|---|", "| p1-review-critic-code | p1-review | fsloop-critic | critic code | claude-opus-5-5 | — | — | — | 10 | 20 | 30 | 40 | — | reports/p1-review-critic-code.md |", ""].join("\n");
    const dir = fixture({ launches: [], files: { "launches.md": legacy, "reports/p1-review-critic-code.md": criticReport({ lens: "code", findings: [REAL.code29] }) } });
    const [l] = readRun(dir).launches;
    expect(l.id).toBe("p1-review-critic-code");
    expect(l).not.toHaveProperty("boot");
    expect(l).not.toHaveProperty("children");
    expect(l).not.toHaveProperty("agentId");
  });

  test("a unit's checks across its verify, land and debug logs, in the shape the units view reads", () => {
    const dir = fixture({
      units: [
        {
          id: "u1",
          state: "verify",
          title: "actions pages",
          checks: ["1 type-check — exit 0 — 12 s — ", "2 tests — exit 1 — 31 s — 2 failed"],
          logs: { "debug.log": ["1 tests — exit 0 — 20 s — after the fix"], "land.log": ["1 merge — exit 0 — 3 s — "] },
        },
      ],
    });
    const [u] = readRun(dir).units;
    expect(u.checks?.map(({ file, n, label, exit, line, seconds }) => ({ file, n, label, exit, line, seconds }))).toEqual([
      { file: "debug.log.lines", n: 1, label: "tests", exit: 0, line: "20 s — after the fix", seconds: 20 },
      { file: "land.log.lines", n: 1, label: "merge", exit: 0, line: "3 s —", seconds: 3 },
      { file: "verify.log.lines", n: 1, label: "type-check", exit: 0, line: "12 s —", seconds: 12 },
      { file: "verify.log.lines", n: 2, label: "tests", exit: 1, line: "31 s — 2 failed", seconds: 31 },
    ]);
    for (const c of u.checks ?? []) expect(c.endedAt).toBe(new Date(NOW - 10 * 60_000).toISOString());
  });

  test("a unit with no logs carries no checks", () => {
    const dir = fixture({ units: [{ id: "u1", state: "ready", title: "actions pages" }] });
    expect(readRun(dir).units[0].checks).toEqual([]);
  });
});
