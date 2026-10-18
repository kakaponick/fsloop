import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, test } from "node:test";
import { fileURLToPath } from "node:url";

import { build, collect, gate, parseBlock, parseBrief, parseFinding, parseTable, save, writeReport } from "./fsl.mjs";

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), "fsl.mjs");

let root;
let run;
let projects;

function put(path, text) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text);
}

/** A finished launch's transcript where Claude Code keeps it, with the meta file beside it. */
function transcript(agentId, { agent, description, final, model = "claude-opus-5-5", prompt = "Repo: /repo" }) {
  const dir = join(projects, "C--repo", "session-1", "subagents");
  const lines = [
    { type: "user", message: { role: "user", content: prompt } },
    { type: "assistant", message: { model, content: [{ type: "tool_use", id: "t1", name: "Read", input: {} }] } },
    { type: "assistant", message: { model, content: [{ type: "text", text: final }] } },
  ];
  put(join(dir, `agent-${agentId}.jsonl`), lines.map((l) => JSON.stringify(l)).join("\n") + "\n");
  put(join(dir, `agent-${agentId}.meta.json`), JSON.stringify({ agentType: agent, description }));
}

const critic = (lens, findings) =>
  ["```", `LENS: ${lens}`, "AUDIT: —", "VERDICT:", "- —", "FINDINGS (ranked):", ...findings.map((f) => `- ${f}`), "UNVERIFIED:", "- —", "CANDIDATES:", "- —", "```"].join("\n");

const table = (header, rows) =>
  [`| ${header.join(" | ")} |`, `|${header.map(() => "---").join("|")}|`, ...rows.map((r) => `| ${r.join(" | ")} |`)].join("\n") + "\n";

const brief = ({ kind = "full", blocked = "—", seams = "`createCabinet` in lib/cabinet.ts", closes = "—" } = {}) =>
  [
    `Kind: ${kind}`,
    `Blocked by: ${blocked}`,
    "",
    "## Problem",
    "Operators cannot see the cabinet balance.",
    "## Seams",
    seams,
    "## Done-criteria",
    "- `bun test lib/cabinet.test.ts` red → green",
    "## Files",
    "- lib/cabinet.ts",
    "## Reference",
    "- lib/accounts.ts",
    "## Settled",
    "—",
    "## Closes",
    closes,
  ].join("\n");

function common({ N = "—" } = {}) {
  put(join(run, "common.md"), ["Run: ab12cd34", "Mode: worktree", `N: ${N}`, "K: 3", "Start: /repo", "Worktree: /fsl/ab12cd34", "", "## Goal", "Show cabinet balances.", "", "## Commands", "…"].join("\n"));
}

const green = (...stages) => {
  for (const stage of stages) put(join(run, "gates.jsonl"), readOr(join(run, "gates.jsonl")) + JSON.stringify({ stage, green: true, at: "t", problems: [] }) + "\n");
};
const readOr = (p) => {
  try {
    return readFileSync(p, "utf8");
  } catch {
    return "";
  }
};

const commits = {};
const commitMessage = (_start, sha) => commits[sha] ?? null;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "fsl-"));
  run = join(root, "runs", "ab12cd34");
  projects = join(root, "projects");
  process.env.FSL_PROJECTS_ROOT = projects;
  mkdirSync(run, { recursive: true });
});
afterEach(() => {
  delete process.env.FSL_PROJECTS_ROOT;
  rmSync(root, { recursive: true, force: true });
});

describe("parsers", () => {
  test("a table is the rows under the header above |---|, escaped pipes kept, blank lines skipped", () => {
    const rows = parseTable("# Journal\n\n| # | question | decision |\n|---|---|---|\n| 1 | Mode | worktree |\n\n| 2 | a \\| b | yes |\n");
    assert.deepEqual(rows, [
      { "#": "1", question: "Mode", decision: "worktree" },
      { "#": "2", question: "a | b", decision: "yes" },
    ]);
  });

  test("a critic block yields its findings with severity, cause, rule and action", () => {
    const block = parseBlock(critic("code", ["code-1 [standards] major high local app/a.ts:12 — code → No duplication — merge the two loaders"]));
    assert.equal(block.LENS.value, "code");
    assert.deepEqual(block.VERDICT.items, []);
    const f = parseFinding(block.FINDINGS.items[0]);
    assert.equal(f.id, "code-1");
    assert.equal(f.severity, "major");
    assert.equal(f.cause, "local");
    assert.equal(f.location, "app/a.ts:12");
    assert.equal(f.rule, "code → No duplication");
    assert.equal(f.action, "merge the two loaders");
  });

  test("a loose finding line still yields its id and severity", () => {
    assert.deepEqual(parseFinding("craft-3 minor the header wraps"), { id: "craft-3", severity: "minor", raw: "craft-3 minor the header wraps" });
  });

  test("severity is the finding's own, never a word of its rule", () => {
    assert.equal(parseFinding("code-2 [standards] minor med local a.ts:3 — tests → Shape, each breach major — split it").severity, "minor");
    assert.equal(parseFinding("code-2 minor — tests → Shape, each breach major").severity, "minor");
  });

  test("under FINDINGS only id-led top-level items count; prose and sub-notes do not", () => {
    common();
    transcript("p1", { agent: "fsloop-critic", description: "critic code", final: ["LENS: code", "FINDINGS (ranked):", "- No findings of note beyond these.", "1. code-1 [spec] major high local a.ts:1 — c — x", "  - sub note", "- code-2 [spec] minor low local b.ts:1 — c — y"].join("\n") });
    save(run, "p1-review", "p1");
    assert.deepEqual([...collect(run).findings.keys()], ["p1-review-critic-code#code-1", "p1-review-critic-code#code-2"]);
  });

  test("a brief yields its kind, blockers, sections and the finding ids it closes", () => {
    const b = parseBrief(brief({ blocked: "u1, u2", closes: "- p1-review-critic-code#code-1\n- p1-review-critic-code#code-4" }));
    assert.equal(b.kind, "full");
    assert.deepEqual(b.blockedBy, ["u1", "u2"]);
    assert.equal(b.sections.settled, "—");
    assert.deepEqual(b.closes, ["p1-review-critic-code#code-1", "p1-review-critic-code#code-4"]);
  });
});

describe("save", () => {
  test("files the final block by agent id, names it by stage and description, records the launch once", () => {
    transcript("a1", { agent: "fsloop-critic", description: "critic code", final: critic("code", ["code-1 [spec] major high — app/a.ts:1 — u1 criterion 2 — add it"]) });
    common();
    const first = save(run, "p1-review", "a1");
    assert.deepEqual(first, { id: "p1-review-critic-code", report: "reports/p1-review-critic-code.md", existed: false });
    assert.match(readFileSync(join(run, first.report), "utf8"), /^```\nLENS: code/);
    assert.equal(save(run, "p1-review", "C:\\tmp\\tasks\\a1.output").existed, true);
    const launches = parseTable(readFileSync(join(run, "launches.md"), "utf8"));
    assert.equal(launches.length, 1);
    assert.equal(launches[0].agent, "fsloop-critic");
    assert.equal(launches[0].model, "claude-opus-5-5");
  });

  test("a second launch with the same description gets a numbered id", () => {
    transcript("b1", { agent: "fsloop-implement", description: "u1 implement", final: "RESULT: partial" });
    transcript("b2", { agent: "fsloop-implement", description: "u1 implement", final: "RESULT: done" });
    assert.equal(save(run, "p1-units", "b1").id, "p1-units-u1-implement");
    assert.equal(save(run, "p1-units", "b2").id, "p1-units-u1-implement-2");
  });

  test("a launch with no final message is refused — it did not finish", () => {
    const dir = join(projects, "C--repo", "s", "subagents");
    put(join(dir, "agent-c1.jsonl"), JSON.stringify({ type: "user", message: { content: "x" } }) + "\n");
    assert.throws(() => save(run, "p1-review", "c1"), /no final message/);
  });

  test("a launch cut mid-work is refused, though it wrote text on the way", () => {
    const dir = join(projects, "C--repo", "s", "subagents");
    const step = (id, content) => JSON.stringify({ type: "assistant", message: { id, model: "m", content: [content] } });
    // One API message is written as one entry per content block: the text, then the tool call it makes.
    put(join(dir, "agent-c2.jsonl"), [step("msg_1", { type: "text", text: "I'll read common.md first." }), step("msg_1", { type: "tool_use", id: "t", name: "Read", input: {} })].join("\n") + "\n");
    put(join(dir, "agent-c2.meta.json"), JSON.stringify({ agentType: "fsloop-critic", description: "critic code" }));
    assert.throws(() => save(run, "p1-review", "c2"), /no final message/);
    put(join(dir, "agent-c3.jsonl"), step("msg_2", { type: "text", text: "LENS: code" }) + "\n");
    put(join(dir, "agent-c3.meta.json"), JSON.stringify({ agentType: "fsloop-critic", description: "critic code", finished: false }));
    assert.throws(() => save(run, "p1-review", "c3"), /no final message/);
  });

  test("on Resume a launch is found by its description among this run's launches only", () => {
    common();
    transcript("other-run", { agent: "fsloop-implement", description: "u3 implement", final: "RESULT: done", prompt: "Repo: /x\nCommon: /repo/.claude/fsloop/runs/99999999/common.md" });
    transcript("this-run", { agent: "fsloop-implement", description: "u3 implement", final: "RESULT: partial", prompt: "Repo: /x\nCommon: /repo/.claude/fsloop/runs/ab12cd34/common.md" });
    const r = save(run, "p1-units", "u3 implement");
    assert.equal(readFileSync(join(run, r.report), "utf8"), "RESULT: partial\n");
    assert.throws(() => save(run, "p1-units", "u4 implement"), /no launch of run ab12cd34 by that description/);
  });

  test("a launch saved under one stage is not saved again under another", () => {
    transcript("d1", { agent: "fsloop-implement", description: "f1 implement", final: "RESULT: done" });
    save(run, "p1-units", "d1");
    assert.throws(() => save(run, "p1-fix", "d1"), /already saved as p1-units-f1-implement in stage p1-units/);
  });
});

describe("gate", () => {
  function reviewed(rows) {
    common();
    transcript("r1", {
      agent: "fsloop-critic",
      description: "critic code",
      final: critic("code", ["code-1 [standards] major high local app/a.ts:1 — code → Idempotent — guard the retry", "code-2 [standards] minor med local app/b.ts:9 — tests 6 — reset the singleton"]),
    });
    save(run, "p1-review", "r1");
    if (rows) put(join(run, "findings", "p1-review.md"), table(["finding", "decision", "ref", "repeat", "why"], rows));
    green("p1-map", "p1-spike", "p1-decompose", "p1-units");
  }

  test("review is red until every finding has exactly one decided row", () => {
    reviewed([["p1-review-critic-code#code-1", "fix", "—", "—", "code → Idempotent, major on a reshaped surface"]]);
    assert.deepEqual(gate(collect(run), "p1-review"), ["p1-review-critic-code#code-2: no row in findings/p1-review.md"]);
  });

  test("review is green when every finding is decided with its why and ref", () => {
    reviewed([
      ["p1-review-critic-code#code-1", "fix", "—", "—", "code → Idempotent, major on a reshaped surface"],
      ["p1-review-critic-code#code-2", "candidate", "—", "—", "minor in a file no unit touched"],
    ]);
    assert.deepEqual(gate(collect(run), "p1-review"), []);
  });

  test("a decision outside the set, a refless drop and a duplicate of nothing are named", () => {
    reviewed([
      ["p1-review-critic-code#code-1", "later", "—", "—", "not now"],
      ["p1-review-critic-code#code-2", "dropped", "—", "—", "against a settled decision"],
      ["p1-review-critic-code#code-9", "duplicate", "p1-review-critic-code#code-1", "—", "same cause"],
    ]);
    const problems = gate(collect(run), "p1-review");
    assert.ok(problems.some((p) => /code-1: decision "later"/.test(p)));
    assert.ok(problems.some((p) => /code-2: dropped needs a ref/.test(p)));
    assert.ok(problems.some((p) => /code-9: no such finding/.test(p)));
  });

  test("review waits for units", () => {
    common();
    transcript("r2", { agent: "fsloop-critic", description: "critic code", final: critic("code", []) });
    save(run, "p1-review", "r2");
    green("p1-map", "p1-spike", "p1-decompose");
    assert.deepEqual(gate(collect(run), "p1-review"), ["p1-units is not green"]);
  });

  test("decompose checks every brief's sections and that each fix decision is closed by a brief", () => {
    common();
    transcript("m1", { agent: "Explore", description: "map", final: "| area | files |" });
    transcript("m2", { agent: "fsloop-critic", description: "baseline craft cabinets", final: critic("craft assess", ["craft-1 [craft] major high component app/cab.tsx:3 — ux 2 — /impeccable layout"]) });
    save(run, "p1-map", "m1");
    save(run, "p1-map", "m2");
    put(join(run, "findings", "p1-map.md"), table(["finding", "decision", "ref", "repeat", "why"], [["p1-map-baseline-craft-cabinets#craft-1", "fix", "u1", "—", "ux 2 major"]]));
    put(join(run, "units.md"), table(["unit", "pass", "state", "tree", "title"], [["u1", "1", "implement", "—", "cabinet page"], ["u2", "1", "implement", "—", "list"]]));
    put(join(run, "units", "u1", "brief.md"), brief({ seams: "—" }));
    put(join(run, "units", "u2", "brief.md"), brief({ kind: "ui", blocked: "u9", seams: "—" }).replace("## Reference\n- lib/accounts.ts\n", ""));
    green("p1-map", "p1-spike");
    const problems = gate(collect(run), "p1-decompose");
    assert.deepEqual(problems.sort(), [
      "p1-map-baseline-craft-cabinets#craft-1: decided fix, but no u-unit brief of pass 1 lists it under Closes",
      "u1: Kind full has a backend part — its seams cannot be —",
      "u2: Blocked by u9, no such unit in units.md",
      'u2: brief has no "## reference" section',
    ]);
  });

  test("units is green only when each unit is committed with its trailers, or blocked with a reason", () => {
    common();
    transcript("i1", { agent: "fsloop-implement", description: "u1 implement", final: "RESULT: done" });
    save(run, "p1-units", "i1");
    put(join(run, "units.md"), table(["unit", "pass", "state", "tree", "title"], [["u1", "1", "committed 1a2b3c4", "—", "a"], ["u2", "1", "blocked: no Docker", "—", "b"], ["u3", "1", "verify", "—", "c"]]));
    for (const u of ["u1", "u2", "u3"]) put(join(run, "units", u, "brief.md"), brief());
    commits["1a2b3c4"] = "feat: a\n\nFsloop-Run: ab12cd34\nFsloop-Step: u1 1/3\n";
    green("p1-decompose");
    assert.deepEqual(gate(collect(run), "p1-units", { commitMessage }), ["u3: state is verify — committed <sha> or blocked: <why>"]);
  });

  test("without N, verdict scores every committed fix", () => {
    reviewed([
      ["p1-review-critic-code#code-1", "fix", "f1", "—", "major"],
      ["p1-review-critic-code#code-2", "candidate", "—", "—", "minor"],
    ]);
    put(join(run, "units.md"), table(["unit", "pass", "state", "tree", "title"], [["f1", "1", "committed 9f9f9f9", "—", "fix"]]));
    put(join(run, "units", "f1", "brief.md"), brief({ closes: "p1-review-critic-code#code-1" }));
    green("p1-review", "p1-fix");
    assert.deepEqual(gate(collect(run), "p1-verdict"), ["p1-review-critic-code#code-1: fixed, but no VERDICT line scores it in p1-verdict"]);
    transcript("v1", { agent: "fsloop-critic", description: "critic code verdict", final: "LENS: code verdict\nVERDICT:\n- p1-review-critic-code#code-1 resolved — app/a.ts:4 guards it\nFINDINGS (ranked):\n- —" });
    save(run, "p1-verdict", "v1");
    const r = collect(run);
    assert.deepEqual(gate(r, "p1-verdict"), []);
    assert.equal(build(r).findings.find((f) => f.local === "code-1").status, "closed");
  });
});

describe("passes", () => {
  function assessed({ pass, findings, rows, passRow, N = 3 }) {
    common({ N });
    transcript(`as${pass}`, { agent: "fsloop-critic", description: "critic code", final: critic("code assess", findings) });
    save(run, `p${pass}-assess`, `as${pass}`);
    put(join(run, "findings", `p${pass}-assess.md`), table(["finding", "decision", "ref", "repeat", "why"], rows));
    put(join(run, "passes.md"), table(["pass", "critical+major", "outcome", "why"], passRow));
    green(`p${pass}-fix`);
  }

  test("the recorded count must be the findings' count, and the outcome one the rule allows", () => {
    assessed({
      pass: 1,
      findings: ["code-1 [spec] major high local a.ts:1 — goal — do it", "code-2 [spec] critical high local b.ts:1 — goal — do it", "code-3 [spec] minor low local c.ts:1 — taste — skip"],
      rows: [
        ["p1-assess-critic-code#code-1", "fix", "p2", "—", "major"],
        ["p1-assess-critic-code#code-2", "fix", "p2", "—", "critical"],
        ["p1-assess-critic-code#code-3", "candidate", "—", "—", "minor"],
      ],
      passRow: [["p1", "1", "converged", "looks done"]],
    });
    assert.deepEqual(gate(collect(run), "p1-assess"), [
      "passes.md p1: critical+major is 1, the findings count 2",
      "passes.md p1: outcome converged, the rule allows stalled | next",
      "p1-assess-critic-code#code-1: fix, but the run stops at p1 — open",
      "p1-assess-critic-code#code-2: fix, but the run stops at p1 — open",
    ]);
  });

  test("a count that did not fall cannot be next", () => {
    common({ N: 3 });
    put(join(run, "passes.md"), table(["pass", "critical+major", "outcome", "why"], [["p1", "1", "next", "1 > 0"]]));
    assessed({
      pass: 2,
      findings: ["code-1 [spec] major high local a.ts:1 — goal — do it"],
      rows: [["p2-assess-critic-code#code-1", "fix", "p3", "—", "major"]],
      passRow: [["p1", "1", "next", "1 > 0"], ["p2", "1", "next", "still one"]],
    });
    assert.deepEqual(gate(collect(run), "p2-assess"), ["passes.md p2: outcome next, the rule allows stalled"]);
  });

  test("at pass N a fix cannot go to a next pass", () => {
    assessed({
      pass: 1,
      N: 1,
      findings: ["code-1 [spec] major high local a.ts:1 — goal — do it"],
      rows: [["p1-assess-critic-code#code-1", "fix", "p2", "—", "major"]],
      passRow: [["p1", "1", "cap", "N reached"]],
    });
    const problems = gate(collect(run), "p1-assess");
    assert.ok(problems.includes("findings/p1-assess.md p1-assess-critic-code#code-1: p2 is past N=1 — open, not fix"));
  });

  test("a fix the next assessment repeats is open; one it does not repeat is closed", () => {
    common({ N: 2 });
    transcript("rv", { agent: "fsloop-critic", description: "critic code", final: critic("code", ["code-1 [spec] major high local a.ts:1 — c — x", "code-2 [spec] major high local b.ts:1 — c — y"]) });
    save(run, "p1-review", "rv");
    put(join(run, "findings", "p1-review.md"), table(["finding", "decision", "ref", "repeat", "why"], [["p1-review-critic-code#code-1", "fix", "f1", "—", "major"], ["p1-review-critic-code#code-2", "fix", "f1", "—", "major"]]));
    put(join(run, "units.md"), table(["unit", "pass", "state", "tree", "title"], [["f1", "1", "committed abcdef1", "—", "fix"]]));
    put(join(run, "units", "f1", "brief.md"), brief({ closes: "p1-review-critic-code#code-1 p1-review-critic-code#code-2" }));
    transcript("as", { agent: "fsloop-critic", description: "critic code", final: critic("code assess", ["code-1 [spec] major high local a.ts:1 — c — still there"]) });
    save(run, "p1-assess", "as");
    put(join(run, "findings", "p1-assess.md"), table(["finding", "decision", "ref", "repeat", "why"], [["p1-assess-critic-code#code-1", "fix", "p2", "p1-review-critic-code#code-1", "the fix did not hold"]]));
    put(join(run, "passes.md"), table(["pass", "critical+major", "outcome", "why"], [["p1", "1", "next", "1 > 0"]]));
    green("p1-fix", "p1-assess");
    const findings = build(collect(run)).findings;
    const status = (id) => findings.find((f) => f.id === id).status;
    assert.equal(status("p1-review-critic-code#code-1"), "open");
    assert.equal(status("p1-review-critic-code#code-2"), "closed");
    assert.equal(status("p1-assess-critic-code#code-1"), "queued");
  });
});

describe("a whole run", () => {
  test("without N, every stage goes green in order, and run.json tells each finding's fate", () => {
    common();
    const pass = (stage) => {
      assert.deepEqual(gate(collect(run), stage, { commitMessage }), [], stage);
      green(stage);
    };
    const decide = (stage, rows) => put(join(run, "findings", `${stage}.md`), table(["finding", "decision", "ref", "repeat", "why"], rows));

    transcript("w-map", { agent: "Explore", description: "map", final: "| area | files |" });
    transcript("w-base", { agent: "fsloop-critic", description: "craft cabinets", final: critic("craft assess", ["craft-1 [craft] major high local app/cab.tsx:3 — ux 2 — /impeccable layout", "craft-2 [craft] minor low local app/cab.tsx:9 — taste — /impeccable polish"]) });
    save(run, "p1-map", "w-map");
    save(run, "p1-map", "w-base");
    decide("p1-map", [["p1-map-craft-cabinets#craft-1", "fix", "u1", "—", "ux 2, major at baseline"], ["p1-map-craft-cabinets#craft-2", "candidate", "—", "—", "minor at baseline"]]);
    pass("p1-map");
    pass("p1-spike");

    put(join(run, "units.md"), table(["unit", "pass", "state", "tree", "title"], [["u1", "1", "implement", "/fsl/ab12cd34", "cabinet page"]]));
    put(join(run, "units", "u1", "brief.md"), brief({ closes: "p1-map-craft-cabinets#craft-1" }));
    pass("p1-decompose");

    transcript("w-u1", { agent: "fsloop-implement", description: "u1 implement", final: "RESULT: done" });
    save(run, "p1-units", "w-u1");
    commits.aaaaaaa = "feat: cabinet page\n\nFsloop-Run: ab12cd34\nFsloop-Step: u1 1/1\nFsloop-Closes: p1-map-craft-cabinets#craft-1\n";
    put(join(run, "units.md"), table(["unit", "pass", "state", "tree", "title"], [["u1", "1", "committed aaaaaaa", "/fsl/ab12cd34", "cabinet page"]]));
    pass("p1-units");

    transcript("w-rev", { agent: "fsloop-critic", description: "critic code", final: critic("code", ["code-1 [standards] major high local lib/cab.ts:4 — code → Idempotent — guard the retry", "code-2 [standards] major high local lib/cab.ts:4 — code → Idempotent — same retry"]) });
    save(run, "p1-review", "w-rev");
    decide("p1-review", [["p1-review-critic-code#code-1", "fix", "—", "—", "code → Idempotent, major"], ["p1-review-critic-code#code-2", "duplicate", "p1-review-critic-code#code-1", "—", "one cause"]]);
    pass("p1-review");

    decide("p1-review", [["p1-review-critic-code#code-1", "fix", "f1", "—", "code → Idempotent, major"], ["p1-review-critic-code#code-2", "duplicate", "p1-review-critic-code#code-1", "—", "one cause"]]);
    transcript("w-f1", { agent: "fsloop-implement", description: "f1 implement", final: "RESULT: done" });
    save(run, "p1-fix", "w-f1");
    commits.bbbbbbb = "fix: retry once\n\nFsloop-Run: ab12cd34\nFsloop-Step: f1 1/1\nFsloop-Closes: p1-review-critic-code#code-1\n";
    put(join(run, "units.md"), table(["unit", "pass", "state", "tree", "title"], [["u1", "1", "committed aaaaaaa", "—", "cabinet page"], ["f1", "1", "committed bbbbbbb", "—", "retry"]]));
    put(join(run, "units", "f1", "brief.md"), brief({ closes: "p1-review-critic-code#code-1" }));
    pass("p1-fix");

    transcript("w-ver", { agent: "fsloop-critic", description: "critic code verdict", final: "LENS: code verdict\nVERDICT:\n- p1-review-critic-code#code-1 resolved — lib/cab.ts:4\nFINDINGS (ranked):\n- —" });
    save(run, "p1-verdict", "w-ver");
    pass("p1-verdict");

    pass("integrate");
    put(join(run, "report.md"), "# ab12cd34\n\n## Spikes\n\n—\n");
    assert.deepEqual(gate(collect(run), "finish"), [
      "integrate is green but logs/push.log.lines shows no push that exited 0 — push first",
      "report.md has no tables of fsl.mjs report — run it",
    ]);
    put(join(run, "logs", "push.log.lines"), "1 push — exit 0 — main -> main\n");
    writeReport(run);
    writeReport(run);
    const report = readFileSync(join(run, "report.md"), "utf8");
    assert.equal(report.split("## Findings").length, 2, "regenerating replaces the tables, never appends twice");
    assert.match(report, /^# ab12cd34\n\n## Spikes\n/);
    assert.match(report, /\| p1-review-critic-code#code-1 \| major \| code → Idempotent \| fix \| f1 \| closed \|/);
    pass("finish");

    const json = build(collect(run));
    const fate = Object.fromEntries(json.findings.map((f) => [f.id, f.status]));
    assert.deepEqual(fate, {
      "p1-map-craft-cabinets#craft-1": "fixed",
      "p1-map-craft-cabinets#craft-2": "candidate",
      "p1-review-critic-code#code-1": "closed",
      "p1-review-critic-code#code-2": "duplicate",
    });
    assert.deepEqual(json.stages.map((s) => s.stage), ["p1-map", "p1-spike", "p1-decompose", "p1-units", "p1-review", "p1-fix", "p1-verdict", "integrate", "finish"]);
  });
});

describe("integrate and finish", () => {
  test("a major review finding left open holds the push; the run still finishes", () => {
    common();
    transcript("h1", { agent: "fsloop-critic", description: "critic code", final: critic("code", ["code-1 [spec] major high local a.ts:1 — u1 criterion 1 — add it"]) });
    save(run, "p1-review", "h1");
    put(join(run, "findings", "p1-review.md"), table(["finding", "decision", "ref", "repeat", "why"], [["p1-review-critic-code#code-1", "fix", "f1", "—", "major"]]));
    put(join(run, "units.md"), table(["unit", "pass", "state", "tree", "title"], [["f1", "p1", "blocked: no Docker", "—", "fix"]]));
    put(join(run, "units", "f1", "brief.md"), brief({ closes: "p1-review-critic-code#code-1" }));
    green("p1-verdict");
    assert.deepEqual(gate(collect(run), "integrate"), ["p1-review-critic-code#code-1: major, open — it holds the push"]);
    const integrateGate = (problems) => put(join(run, "gates.jsonl"), readOr(join(run, "gates.jsonl")) + JSON.stringify({ stage: "integrate", green: false, at: "t", problems }) + "\n");
    put(join(run, "report.md"), "# ab12cd34\n");
    writeReport(run);
    integrateGate(["p1-verdict is not green", "p1-review-critic-code#code-1: major, open — it holds the push"]);
    assert.deepEqual(gate(collect(run), "finish"), ["integrate is red for more than held findings — settle the rest, gate it again"]);
    integrateGate(["p1-review-critic-code#code-1: major, open — it holds the push"]);
    assert.deepEqual(gate(collect(run), "finish"), []);
  });

  test("a red check the run could not fix is its own finding, and it holds the push", () => {
    common();
    green("p1-verdict");
    put(join(run, "findings", "integrate.md"), table(["finding", "decision", "ref", "repeat", "severity", "why"], [["integrate-own#1", "open", "—", "—", "major", "suite: lib/a.test.ts red after fix and debug"]]));
    assert.deepEqual(gate(collect(run), "integrate"), ["integrate-own#1: major, open — it holds the push"]);
  });

  test("a red check Integrate can still fix is no finding", () => {
    common();
    green("p1-verdict");
    put(join(run, "findings", "integrate.md"), table(["finding", "decision", "ref", "repeat", "severity", "why"], [["integrate-own#1", "fix", "—", "—", "major", "suite red"]]));
    assert.ok(gate(collect(run), "integrate").includes("findings/integrate.md integrate-own#1: a check Integrate can still fix is no finding — the run's own is open, or a candidate when flaky"));
  });

  test("a fix unit's question is answered at the verdicts; a journal row answers only its own id", () => {
    common();
    transcript("q1", { agent: "fsloop-implement", description: "f1 implement", final: "RESULT: done\nNOTES:\n" + Array.from({ length: 10 }, (_, i) => `- to judge: choice ${i + 1}`).join("\n") });
    save(run, "p1-fix", "q1");
    green("p1-fix");
    put(join(run, "journal.md"), table(["#", "stage", "question", "decision", "why", "refs"], [["1", "p1-verdict", "choice 10", "left open", "no lens", Array.from({ length: 9 }, (_, i) => `p1-fix-f1-implement#judge-${i + 2}`).join(" ")]]));
    assert.deepEqual(gate(collect(run), "p1-verdict"), ['p1-fix-f1-implement#judge-1: to judge "choice 1" — no JUDGED line opens with its id, no journal row refs it']);
  });

  test("every question an implementer left to Review is answered by its id, or recorded open", () => {
    common();
    transcript("j1", { agent: "fsloop-implement", description: "u1 implement", final: "RESULT: done\nNOTES:\n- kept the old loader\n- to judge: edited use-page.ts outside the manifest — the width hook lives there\n- to judge: test written after the cell" });
    save(run, "p1-units", "j1");
    transcript("j2", { agent: "fsloop-critic", description: "critic code", final: "LENS: code\nJUDGED:\n- p1-units-u1-implement#judge-1 outside the manifest — upheld — criterion 1 needs that hook\nFINDINGS (ranked):\n- —" });
    save(run, "p1-review", "j2");
    green("p1-units");
    assert.deepEqual(gate(collect(run), "p1-review"), ['p1-units-u1-implement#judge-2: to judge "test written after the cell" — no JUDGED line opens with its id, no journal row refs it']);
    put(join(run, "journal.md"), table(["#", "stage", "question", "decision", "why", "refs"], [["1", "p1-review", "test after the cell", "left open", "no critic ruled", "p1-units-u1-implement#judge-2"]]));
    const r = collect(run);
    assert.deepEqual(gate(r, "p1-review"), []);
    const judges = build(r).judges;
    assert.equal(judges[0].answer.result, "upheld");
    assert.equal(judges[1].journal, "1");
  });

  test("a surface's scores line up from Map's baseline to each Assess", () => {
    common({ N: 2 });
    transcript("s1", { agent: "fsloop-critic", description: "craft cabinets", final: "LENS: craft assess\nAUDIT: Cabinets list (`app/ads-accounts/`) audit 15/20 Good · critique 24/40 Acceptable\nFINDINGS (ranked):\n- —" });
    transcript("s2", { agent: "fsloop-critic", description: "craft cabinets", final: "LENS: craft assess\nAUDIT: Cabinets list `/ads-accounts` audit 16/20 Good · critique 28/40 · Method: dual-agent\nFINDINGS (ranked):\n- —" });
    save(run, "p1-map", "s1");
    save(run, "p1-assess", "s2");
    assert.deepEqual(
      build(collect(run)).surfaces.cabinets.map(({ stage, audit, critique }) => [stage, audit, critique]),
      [["p1-map", 15, 24], ["p1-assess", 16, 28]],
    );
  });

  test("the merge's critic runs again after a fix: only its last report holds the push", () => {
    common();
    green("p1-verdict");
    transcript("ic1", { agent: "fsloop-critic", description: "critic craft verdict", final: critic("craft verdict", ["craft-1 [craft] major high local app/a.tsx:1 — ux 2 — /impeccable layout"]) });
    save(run, "integrate", "ic1");
    put(join(run, "findings", "integrate.md"), table(["finding", "decision", "ref", "repeat", "why"], [["integrate-critic-craft-verdict#craft-1", "fix", "—", "—", "ux 2, the merge clipped the header"]]));
    assert.deepEqual(gate(collect(run), "integrate"), ["integrate-critic-craft-verdict#craft-1: major, queued — settle it before the push"]);
    transcript("ic2", { agent: "fsloop-critic", description: "critic craft verdict", final: critic("craft verdict", []) });
    save(run, "integrate", "ic2");
    const r = collect(run);
    assert.deepEqual(gate(r, "integrate"), []);
    assert.equal(build(r).findings[0].status, "closed");
  });

  test("the run's own finding needs a severity and counts toward the pass rule", () => {
    common({ N: 2 });
    put(join(run, "findings", "p1-assess.md"), table(["finding", "decision", "ref", "repeat", "severity", "why"], [["p1-assess-own#1", "fix", "p2", "—", "major", "suite: lib/a.test.ts red"], ["p1-assess-own#2", "candidate", "—", "—", "—", "e2e slow"]]));
    put(join(run, "passes.md"), table(["pass", "critical+major", "outcome", "why"], [["p1", "1", "next", "the suite is red"]]));
    green("p1-fix");
    assert.deepEqual(gate(collect(run), "p1-assess"), ["findings/p1-assess.md p1-assess-own#2: the run's own finding needs a severity column — critical, major or minor"]);
  });
});

describe("cli", () => {
  test("gate prints the problems, exits 1, and logs the gate into run.json", () => {
    common();
    const r = spawnSync(process.execPath, [SCRIPT, "gate", run, "p1-review"], { encoding: "utf8", env: { ...process.env } });
    assert.equal(r.status, 1);
    assert.equal(r.stdout, "GATE p1-review red — 2\n- p1-units is not green\n- p1-review: no critic report saved\n");
    const json = JSON.parse(readFileSync(join(run, "run.json"), "utf8"));
    assert.equal(json.goal, "Show cabinet balances.");
    assert.equal(json.stages[0].stage, "p1-review");
    assert.equal(json.stages[0].green, false);
  });

  test("an unknown stage is a usage error", () => {
    const r = spawnSync(process.execPath, [SCRIPT, "gate", run, "review"], { encoding: "utf8" });
    assert.equal(r.status, 1);
    assert.match(r.stdout, /unknown stage "review"/);
  });
});
