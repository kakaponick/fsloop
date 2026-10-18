import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, test } from "node:test";
import { fileURLToPath } from "node:url";

import { build, collect, gate, parseBlock, parseBrief, parseDeploy, parseFinding, parseTable, save, writeReport, writeRunJson } from "./fsl.mjs";

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
    { type: "user", timestamp: "2026-10-18T10:00:00.000Z", message: { role: "user", content: prompt } },
    // The tool call is written as two entries of one message, the usage repeated on both.
    { type: "assistant", timestamp: "2026-10-18T10:00:05.000Z", message: { id: "m1", model, content: [{ type: "text", text: "Reading." }], usage: { input_tokens: 10, output_tokens: 5, cache_creation_input_tokens: 1000, cache_read_input_tokens: 0 } } },
    { type: "assistant", timestamp: "2026-10-18T10:00:06.000Z", message: { id: "m1", model, content: [{ type: "tool_use", id: "t1", name: "Read", input: {} }], usage: { input_tokens: 10, output_tokens: 40, cache_creation_input_tokens: 1000, cache_read_input_tokens: 0 } } },
    { type: "assistant", timestamp: "2026-10-18T10:01:30.000Z", message: { id: "m2", model, content: [{ type: "text", text: final }], usage: { input_tokens: 2, output_tokens: 300, cache_creation_input_tokens: 200, cache_read_input_tokens: 1000 } } },
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

  test("a loose finding line still yields its id and severity, marked loose", () => {
    assert.deepEqual(parseFinding("craft-3 minor the header wraps"), { id: "craft-3", parsed: "loose", severity: "minor", raw: "craft-3 minor the header wraps" });
  });

  test("a finding line bent by markdown or ASCII dashes keeps every field, marked loose", () => {
    const f = parseFinding("**code-2** [spec] Major high local a.ts:3 - u1 criterion 2 - add the guard");
    assert.deepEqual({ ...f, raw: undefined }, { id: "code-2", parsed: "loose", category: "spec", severity: "major", confidence: "high", cause: "local", location: "a.ts:3", rule: "u1 criterion 2", action: "add the guard", raw: undefined });
    assert.equal(parseFinding("code-1 [spec] major high local a.ts:1 — c — x").parsed, "strict");
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

  test("each launch records its time and tokens, a message counted once though written in parts", () => {
    common();
    transcript("sp1", { agent: "fsloop-critic", description: "critic code", final: "LENS: code" });
    save(run, "p1-review", "sp1");
    const launch = build(collect(run)).launches[0];
    assert.equal(launch.seconds, 90);
    assert.deepEqual(launch.spend, { input: 12, output: 340, cacheWrite: 1200, cacheRead: 1000, children: { launches: 0, input: 0, output: 0, cacheWrite: 0, cacheRead: 0 } });
    assert.deepEqual([launch.agentId, launch.startedAt, launch.endedAt, launch.transcriptGone], ["sp1", "2026-10-18T10:00:00.000Z", "2026-10-18T10:01:30.000Z", false]);
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

  test("a fix the next assessment repeats is repeated, its fate the repeat's; one it does not repeat is fixed, not re-raised", () => {
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
    const of = (id) => findings.find((f) => f.id === id);
    const [first, second, again] = [of("p1-review-critic-code#code-1"), of("p1-review-critic-code#code-2"), of("p1-assess-critic-code#code-1")];
    assert.deepEqual([first.status, first.repeatedBy, first.effectiveStatus, first.supersededBy], ["repeated", "p1-assess-critic-code#code-1", "queued", "p1-assess-critic-code#code-1"]);
    assert.deepEqual([second.status, second.closedBy, second.checkedBy], ["fixed", "not-reraised", "p1-assess"]);
    assert.deepEqual([again.status, again.repeat], ["queued", "p1-review-critic-code#code-1"]);
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
    const fate = Object.fromEntries(json.findings.map((f) => [f.id, [f.status, f.closedBy ?? null, f.effectiveStatus]]));
    assert.deepEqual(fate, {
      // Review read the surface u1 built and raised it no more: fixed, though no verdict scored it.
      "p1-map-craft-cabinets#craft-1": ["fixed", "not-reraised", "fixed"],
      "p1-map-craft-cabinets#craft-2": ["candidate", null, "candidate"],
      "p1-review-critic-code#code-1": ["closed", "verdict", "closed"],
      "p1-review-critic-code#code-2": ["duplicate", null, "closed"],
    });
    assert.deepEqual(json.findings.find((f) => f.local === "code-1").duplicates, ["p1-review-critic-code#code-2"]);
    assert.deepEqual(json.stages.map((s) => s.stage), ["p1-map", "p1-spike", "p1-decompose", "p1-units", "p1-review", "p1-fix", "p1-verdict", "integrate", "finish"]);
    assert.deepEqual([json.closed, json.now.stage, json.outcome.pushed, json.outcome.goalMet], [true, null, true, true]);
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
    assert.deepEqual(gate(collect(run), "integrate"), ["p1-review-critic-code#code-1: major, blocked — it holds the push"]);
    const integrateGate = (problems) => put(join(run, "gates.jsonl"), readOr(join(run, "gates.jsonl")) + JSON.stringify({ stage: "integrate", green: false, at: "t", problems }) + "\n");
    put(join(run, "report.md"), "# ab12cd34\n");
    writeReport(run);
    integrateGate(["p1-verdict is not green", "p1-review-critic-code#code-1: major, blocked — it holds the push"]);
    assert.deepEqual(gate(collect(run), "finish"), ["integrate is red for more than held findings — settle the rest, gate it again"]);
    integrateGate(["p1-review-critic-code#code-1: major, blocked — it holds the push"]);
    assert.deepEqual(gate(collect(run), "finish"), []);
    assert.deepEqual(build(collect(run)).outcome, { pushed: false, pushLine: null, held: ["p1-review-critic-code#code-1"], deploy: null, goalMet: null });
  });

  test("a red check the run could not fix is its own finding, with its evidence, and it holds the push", () => {
    common();
    green("p1-verdict");
    put(join(run, "findings", "integrate.md"), table(["finding", "decision", "ref", "repeat", "severity", "evidence", "why"], [["integrate-own#1", "open", "—", "—", "major", "—", "suite: lib/a.test.ts red after fix and debug"]]));
    assert.deepEqual(gate(collect(run), "integrate"), [
      "findings/integrate.md integrate-own#1: the run's own finding needs an evidence column — the log line that shows it, logs/<log>.lines:<n>",
      "integrate-own#1: major, open — it holds the push",
    ]);
    put(join(run, "findings", "integrate.md"), table(["finding", "decision", "ref", "repeat", "severity", "evidence", "why"], [["integrate-own#1", "open", "—", "—", "major", "logs/integrate-checks.log.lines:3", "suite: lib/a.test.ts red after fix and debug"]]));
    assert.deepEqual(gate(collect(run), "integrate"), ["integrate-own#1: major, open — it holds the push"]);
    assert.equal(build(collect(run)).findings[0].evidence, "logs/integrate-checks.log.lines:3");
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

  test("the merge's critic runs again after a fix: a finding is fixed only once an integrate fix ran, and only the last report speaks", () => {
    common();
    green("p1-verdict");
    transcript("ic1", { agent: "fsloop-critic", description: "critic craft verdict", final: critic("craft verdict", ["craft-1 [craft] major high local app/a.tsx:1 — ux 2 — /impeccable layout"]) });
    save(run, "integrate", "ic1");
    put(join(run, "findings", "integrate.md"), table(["finding", "decision", "ref", "repeat", "why"], [["integrate-critic-craft-verdict#craft-1", "fix", "—", "—", "ux 2, the merge clipped the header"]]));
    assert.deepEqual(gate(collect(run), "integrate"), ["integrate-critic-craft-verdict#craft-1: major, queued — settle it before the push"]);
    // A second critic with no fix between them proves nothing: the finding still waits for its fix.
    transcript("ic2", { agent: "fsloop-critic", description: "critic craft verdict", final: critic("craft verdict", []) });
    save(run, "integrate", "ic2");
    assert.deepEqual(gate(collect(run), "integrate"), ["integrate-critic-craft-verdict#craft-1: major, queued — settle it before the push"]);
    transcript("if1", { agent: "fsloop-implement", description: "integrate fix", final: "RESULT: done" });
    save(run, "integrate", "if1");
    assert.deepEqual(gate(collect(run), "integrate"), ["integrate-critic-craft-verdict#craft-1: major, fixed — settle it before the push"]);
    transcript("ic3", { agent: "fsloop-critic", description: "critic craft verdict", final: critic("craft verdict", []) });
    save(run, "integrate", "ic3");
    const r = collect(run);
    assert.deepEqual(gate(r, "integrate"), []);
    const f = build(r).findings[0];
    assert.deepEqual([f.status, f.closedBy, f.checkedBy], ["fixed", "integrate-recheck", "integrate-critic-craft-verdict-3"]);
  });

  test("a merge finding the re-run critic raises again is repeated: the push waits on the repeat", () => {
    common();
    green("p1-verdict");
    transcript("rc1", { agent: "fsloop-critic", description: "critic craft verdict", final: critic("craft verdict", ["craft-1 [craft] major high local app/a.tsx:1 — ux 2 — clip"]) });
    save(run, "integrate", "rc1");
    transcript("rf1", { agent: "fsloop-implement", description: "integrate fix", final: "RESULT: done" });
    save(run, "integrate", "rf1");
    transcript("rc2", { agent: "fsloop-critic", description: "critic craft verdict", final: critic("craft verdict", ["craft-4 [craft] major high local app/a.tsx:1 — ux 2 — still clipped"]) });
    save(run, "integrate", "rc2");
    put(
      join(run, "findings", "integrate.md"),
      table(["finding", "decision", "ref", "repeat", "why"], [
        ["integrate-critic-craft-verdict#craft-1", "fix", "—", "—", "ux 2"],
        ["integrate-critic-craft-verdict-2#craft-4", "open", "—", "integrate-critic-craft-verdict#craft-1", "ux 2, the second critic's major is open"],
      ]),
    );
    const r = collect(run);
    assert.deepEqual(gate(r, "integrate"), ["integrate-critic-craft-verdict-2#craft-4: major, open — it holds the push"]);
    const first = build(r).findings[0];
    assert.deepEqual([first.status, first.effectiveStatus, first.repeatedBy], ["repeated", "open", "integrate-critic-craft-verdict-2#craft-4"]);
  });

  test("the run's own finding needs a severity and counts toward the pass rule", () => {
    common({ N: 2 });
    put(join(run, "findings", "p1-assess.md"), table(["finding", "decision", "ref", "repeat", "severity", "evidence", "why"], [["p1-assess-own#1", "fix", "p2", "—", "major", "logs/p1-assess-suite.log.lines:2", "suite: lib/a.test.ts red"], ["p1-assess-own#2", "candidate", "—", "—", "—", "logs/p1-e2e.log.lines:4", "e2e slow"]]));
    put(join(run, "passes.md"), table(["pass", "critical+major", "outcome", "why"], [["p1", "1", "next", "the suite is red"]]));
    green("p1-fix");
    assert.deepEqual(gate(collect(run), "p1-assess"), ["findings/p1-assess.md p1-assess-own#2: the run's own finding needs a severity column — critical, major or minor"]);
  });
});

describe("init", () => {
  const roles = ["default", "install", "type-check", "lint", "test, one file", "unit tests", "guards", "suite", "build", "migrate", "worker", "machine lock", "production shape", "shots", "find-polluter", "impeccable"];
  const ran = ["install", "type-check", "lint", "test-one-file", "unit-tests", "guards", "suite", "build", "migrate", "machine-lock", "impeccable"];

  function project() {
    const start = join(root, "repo");
    put(join(run, "common.md"), ["Run: ab12cd34", "Mode: init", "N: —", "K: 1", `Start: ${start}`, `Worktree: ${start}`, "", "## Goal", "init"].join("\n"));
    for (const r of ran) put(join(run, "logs", `init-${r}.log.lines`), `1 ${r} — exit 0 — 4 s — ok\n`);
    return start;
  }
  // A short config: commands only, a red in a few words, no evidence.
  const config = ({ shots, skip = [] }) =>
    [
      "# fsloop config",
      "",
      "Verified: 2026-10-18 · 9c16146 · run ab12cd34",
      "",
      "## Commands",
      "",
      table(
        ["role", "command"],
        roles
          .filter((r) => !skip.includes(r))
          .map((r) => [r, r === "worker" ? "none — no job runner" : r === "type-check" ? "`npm run type-check` — red on main: 3 errors" : `\`npm run ${r}\``]),
      ),
      "## Shared catalogs",
      "",
      "- `messages/*.json` — `test/i18n.test.ts`",
      "",
      "## Roles",
      "",
      table(["role", "component"], [["status dot", "`components/status-dot.tsx`"]]),
      "## Design",
      "",
      "- `PRODUCT.md` · `DESIGN.md` · system: `components/ui/`, `app/globals.css` · build: code-led",
      "",
      "## Shots",
      "",
      shots,
    ].join("\n");

  test("done when every role has its row and the ones init runs have their log, the design is named, three frames read ok", () => {
    const start = project();
    rmSync(join(run, "logs", "init-build.log.lines"));
    put(join(start, ".claude", "fsloop", "config.md"), config({ shots: "- serve: `node shot.mjs serve …`\n- shoot: `node shot.mjs shoot …`", skip: ["impeccable"] }));
    for (const f of ["init-public", "init-authed", "init-dialog"]) put(join(run, "shots", `${f}.png`), "png");
    transcript("pr", {
      agent: "general-purpose",
      description: "shots proof",
      // The proof may echo the absolute path it read; it is the same frame.
      final: `FRAME: ${join(run, "shots", "init-public.png")} ok — the landing page\nFRAME: shots/init-authed.png bad — a login form\nFRAME: shots/init-dialog.png ok — the delete dialog over the list`,
    });
    save(run, "init", "pr");
    assert.deepEqual(gate(collect(run), "init"), [
      "config.md Commands build: never run — no logs/init-build.log.lines",
      'config.md Commands: no row "impeccable"',
      'Shots: 2 of 3 frames read ok by a "shots proof" launch — shots/init-authed.png bad; or ## Shots is - none — <why>',
    ]);
  });

  const recipe = (login) => `- raise: \`npm run db:seed\` · serve: \`node shot.mjs serve …\` · login: ${login} · shoot: \`node shot.mjs shoot …\` · stop: \`node shot.mjs stop …\` · drop: \`dropdb <db>\``;
  const proofOf = (final, id = "pr") => {
    transcript(id, { agent: "general-purpose", description: "shots proof", final });
    save(run, "init", id);
  };

  test("a proof's FRAME lines read the same with a list dash, bold or a backticked path", () => {
    const start = project();
    put(join(start, ".claude", "fsloop", "config.md"), config({ shots: recipe("`node shot.mjs login …`") }));
    for (const f of ["init-public", "init-authed", "init-dialog"]) put(join(run, "shots", `${f}.png`), "png");
    proofOf("- FRAME: shots/init-public.png ok — the landing page\n**FRAME:** `shots/init-authed.png` ok — the accounts list\nFRAME: `shots/init-dialog.png` **ok** — the delete dialog");
    assert.deepEqual(gate(collect(run), "init"), []);
  });

  test("with login — the page behind a session is not needed: two frames suffice, a missing one is named", () => {
    const start = project();
    put(join(start, ".claude", "fsloop", "config.md"), config({ shots: `${recipe("—")}\n- refuses: authed pages — no test user` }));
    put(join(run, "shots", "init-public.png"), "png");
    proofOf("FRAME: shots/init-public.png ok — the landing page");
    assert.deepEqual(gate(collect(run), "init"), ['Shots: 1 of 2 frames read ok by a "shots proof" launch — shots/init-dialog.png missing; or ## Shots is - none — <why>']);
    put(join(run, "shots", "init-dialog.png"), "png");
    proofOf("FRAME: shots/init-public.png ok — the landing page\nFRAME: shots/init-dialog.png ok — the menu", "pr2");
    assert.deepEqual(gate(collect(run), "init"), []);
  });

  test("a project without a UI states none — <why> for its roles, design and shots, and a role it lacks needs no log", () => {
    const start = project();
    rmSync(join(run, "logs", "init-impeccable.log.lines"));
    const text = config({ shots: "- none — no UI" })
      .replace("`npm run impeccable`", "none — no UI")
      .replace(/## Roles\n\n[\s\S]*?(?=## Design)/, "## Roles\n\n- none — no UI\n\n")
      .replace(/## Design\n\n.*\n/, "## Design\n\n- none — no UI\n");
    put(join(start, ".claude", "fsloop", "config.md"), text);
    assert.deepEqual(gate(collect(run), "init"), []);
  });

  test("a config without its design, or from another run, is not done", () => {
    const start = project();
    put(join(start, ".claude", "fsloop", "config.md"), config({ shots: "none — a CLI with no UI" }).replace("run ab12cd34", "run 00000000").replace(/## Design\n\n.*\n/, ""));
    assert.deepEqual(gate(collect(run), "init"), ['config.md: no "Verified: <date> · <sha> · run ab12cd34" line', "config.md: no ## Design, or it is empty — write - none — <why>"]);
  });

  test("init closes on its green gate and the land list's push, not before", () => {
    const start = project();
    put(join(start, ".claude", "fsloop", "config.md"), config({ shots: "- none — a CLI with no UI" }));
    const r = collect(run);
    assert.deepEqual(gate(r, "init"), []);
    put(join(run, "gates.jsonl"), JSON.stringify({ stage: "init", green: true, at: "t", problems: [] }) + "\n");
    put(join(run, "logs", "land.log.lines"), "1 commit — exit 0 — 1 file\n2 push — exit 1 — rejected\n");
    assert.deepEqual([build(collect(run)).closed, build(collect(run)).outcome.pushed], [false, false], "a rejected push leaves init open");
    put(join(run, "logs", "land.log.lines"), "1 commit — exit 0 — 1 file\n2 push — exit 1 — rejected\n3 push — exit 0 — main -> main\n");
    const json = build(collect(run));
    assert.deepEqual([json.closed, json.outcome.pushed, json.outcome.goalMet], [true, true, true]);
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

  test("build writes run.json and summary.json whole, unindented, stamped with the shape's version and fsl.mjs's hash", () => {
    common();
    green("p1-map");
    const r = spawnSync(process.execPath, [SCRIPT, "build", run], { encoding: "utf8" });
    assert.equal(r.status, 0);
    const text = readFileSync(join(run, "run.json"), "utf8");
    assert.ok(!text.includes("\n "), "no indentation");
    const json = JSON.parse(text);
    assert.equal(json.version, 2);
    assert.match(json.generator.fsl, /^[0-9a-f]{12}$/);
    const summary = JSON.parse(readFileSync(join(run, "summary.json"), "utf8"));
    assert.deepEqual([summary.id, summary.now.stage, summary.counts.findings.total], ["ab12cd34", "p1-spike", 0]);
  });
});

describe("run.json for a UI", () => {
  const decide = (stage, rows, header = ["finding", "decision", "ref", "repeat", "why"]) => put(join(run, "findings", `${stage}.md`), table(header, rows));
  const journal = (rows) => put(join(run, "journal.md"), table(["#", "stage", "question", "decision", "why", "refs"], rows));
  const commonWith = (...lines) =>
    put(join(run, "common.md"), ["Run: ab12cd34", "Mode: worktree", "N: —", "K: 3", "Start: /repo", "Worktree: /fsl/ab12cd34", ...lines, "", "## Goal", "Show cabinet balances."].join("\n"));

  test("every FINDINGS line is kept: a repeated id by position, a bent line loose, prose held until the journal names it", () => {
    common();
    transcript("k1", {
      agent: "fsloop-critic",
      description: "critic code",
      final: critic("code", ["code-1 [spec] major high local a.ts:1 — c — x", "code-1 [spec] minor low local b.ts:2 — c — y", "**code-2** [spec] major high local c.ts:3 — c — z", "code-3 [spec] major high local d.ts:4 - c - w", "No findings of note beyond these."]),
    });
    save(run, "p1-review", "k1");
    green("p1-units");
    const ids = ["p1-review-critic-code#code-1", "p1-review-critic-code#code-1~2", "p1-review-critic-code#code-2", "p1-review-critic-code#code-3"];
    let json = build(collect(run));
    assert.deepEqual(json.findings.map((f) => [f.id, f.parsed, f.severity]), [[ids[0], "strict", "major"], [ids[1], "strict", "minor"], [ids[2], "loose", "major"], [ids[3], "loose", "major"]]);
    assert.deepEqual([json.findings[0].raw, json.findings[3].rule, json.findings[3].raw], [undefined, "c", "code-3 [spec] major high local d.ts:4 - c - w"]);
    assert.deepEqual(json.launches[0].unparsed, [{ id: "p1-review-critic-code#line-11", section: "FINDINGS", line: 11, text: "No findings of note beyond these." }]);
    assert.equal(json.launches[0].block.FINDINGS, undefined, "finding lines live in findings[], not twice");
    decide("p1-review", ids.map((id) => [id, "candidate", "—", "—", "minor"]));
    assert.deepEqual(gate(collect(run), "p1-review"), ['p1-review-critic-code#line-11: "No findings of note beyond these." under FINDINGS is no finding line — a journal row refs it with what it is, or relaunch']);
    journal([["1", "p1-review", "line 11 of critic code", "prose, no finding", "it names no rule", "p1-review-critic-code#line-11"]]);
    assert.deepEqual(gate(collect(run), "p1-review"), []);
    json = build(collect(run));
    assert.deepEqual(json.journal[0].refs, [{ id: "p1-review-critic-code#line-11", kind: "line" }]);
  });

  test("a re-decided finding keeps each of its rows in decisions.jsonl; run.json shows the earlier ones as its history", () => {
    common();
    transcript("h1", { agent: "fsloop-critic", description: "critic code", final: critic("code", ["code-1 [spec] major high local a.ts:1 — c — x"]) });
    save(run, "p1-review", "h1");
    const id = "p1-review-critic-code#code-1";
    decide("p1-review", [[id, "fix", "—", "—", "major"]]);
    writeRunJson(run, { at: "t1" });
    writeRunJson(run, { at: "t1b" });
    decide("p1-review", [[id, "fix", "f1", "—", "major"]]);
    writeRunJson(run, { at: "t2" });
    decide("p1-review", [[id, "candidate", "—", "—", "the fix needs a file outside the manifest"]]);
    const json = writeRunJson(run, { at: "t3" });
    assert.deepEqual([json.findings[0].decision, json.findings[0].decidedAt], ["candidate", "t3"]);
    assert.deepEqual(json.findings[0].history, [
      { decision: "fix", why: "major", at: "t1" },
      { decision: "fix", ref: "f1", why: "major", at: "t2" },
    ]);
    const log = readFileSync(join(run, "decisions.jsonl"), "utf8").trim().split("\n").map((l) => JSON.parse(l));
    assert.deepEqual(log.map((e) => [e.finding, e.stage, e.from, e.to, e.ref, e.at]), [[id, "p1-review", null, "fix", null, "t1"], [id, "p1-review", "fix", "fix", "f1", "t2"], [id, "p1-review", "fix", "candidate", null, "t3"]]);
  });

  test("a drop or decline rests on j<n>, a finding or law:<file> <rule>; build follows the ref", () => {
    common();
    transcript("g1", { agent: "fsloop-critic", description: "critic code", final: critic("code", ["code-1 [spec] major high local a.ts:1 — c — x", "code-2 [spec] minor low local b.ts:1 — c — y", "code-3 [spec] minor low local c.ts:1 — c — z"]) });
    save(run, "p1-review", "g1");
    green("p1-units");
    const [a, b, c] = ["code-1", "code-2", "code-3"].map((l) => `p1-review-critic-code#${l}`);
    decide("p1-review", [[a, "dropped", "j9", "—", "settled"], [b, "declined", "the user said so", "—", "user"], [c, "dropped", "law:ui.md Precedence", "—", "the design law voids it"]]);
    assert.deepEqual(gate(collect(run), "p1-review"), [
      `findings/p1-review.md ${a}: ref j9 — journal.md has no row # 9`,
      `findings/p1-review.md ${b}: ref "the user said so" is not j<n>, another finding's id or law:<file> <rule>`,
    ]);
    journal([["1", "p1-review", "keep the old loader?", "yes", "the user asked", a]]);
    decide("p1-review", [[a, "dropped", "j1", "—", "settled"], [b, "declined", a, "—", "contradicts it"], [c, "dropped", "law:ui.md Precedence", "—", "the design law voids it"]]);
    const r = collect(run);
    assert.deepEqual(gate(r, "p1-review"), []);
    const f = Object.fromEntries(build(r).findings.map((x) => [x.local, x]));
    assert.deepEqual([f["code-1"].refKind, f["code-1"].refJournal, f["code-1"].journal], ["journal", { n: "1", question: "keep the old loader?", decision: "yes", why: "the user asked" }, ["1"]]);
    assert.deepEqual([f["code-2"].refKind, f["code-3"].refKind], ["finding", "law"]);
  });

  test("a journal # cited twice is ambiguous", () => {
    common();
    green("p1-map");
    journal([["1", "p1-map", "a", "b", "c", "—"], ["1", "p1-map", "d", "e", "f", "—"]]);
    assert.ok(gate(collect(run), "p1-spike").includes("journal.md: # 1 on 2 rows — j1 must name one"));
  });

  test("units and findings carry the commits git holds now, found by trailer; units.md's sha is the fallback", () => {
    common();
    put(join(run, "units.md"), table(["unit", "pass", "state", "tree", "title"], [["u1", "1", "committed 1111111", "—", "page"]]));
    put(join(run, "units", "u1", "brief.md"), brief({ closes: "p1-map-craft-cabinets#craft-1" }));
    const record = (sha, subject, trailers) => `${sha}\x1f2026-10-18T10:00:00+00:00\x1f${subject}\x1f${subject}\n\n${trailers.join("\n")}\n\0`;
    const calls = [];
    const fake = (start, args) => {
      calls.push(args);
      if (args[0] === "rev-parse") return "x\n";
      return [
        record("2222222aaaa", "feat: page", ["Fsloop-Run: ab12cd34", "Fsloop-Step: u1 1/1", "Fsloop-Closes: p1-map-craft-cabinets#craft-1"]),
        record("3333333bbbb", "merge origin/main", ["Fsloop-Run: ab12cd34", "Fsloop-Step: merge"]),
        record("4444444cccc", "another run", ["Fsloop-Run: ab12cd345", "Fsloop-Step: u1 1/1"]),
      ].join("\n");
    };
    const json = build(collect(run, { git: fake }));
    assert.deepEqual(calls.at(-1).slice(0, 2), ["log", "fsl/ab12cd34"]);
    assert.deepEqual(json.commits.map((c) => [c.sha, c.step, c.unit, c.closes]), [["2222222aaaa", "u1 1/1", "u1", ["p1-map-craft-cabinets#craft-1"]], ["3333333bbbb", "merge", null, []]]);
    assert.deepEqual([json.units[0].sha, json.units[0].recordedSha, json.units[0].commits], ["2222222aaaa", "1111111", ["2222222aaaa"]]);
    const offline = build(collect(run, { git: () => null }));
    assert.deepEqual([offline.commits, offline.units[0].sha], [null, "1111111"]);
  });

  test("a launch keeps its whole block; verdicts are exported matched or not; a JUDGED finding is named; OPEN lines are findings", () => {
    common();
    transcript("o1", {
      agent: "fsloop-implement",
      description: "u1 implement",
      final: "RESULT: partial\nCHANGED: a.ts\nNOTES:\n- to judge: kept the loader — one caller\nOPEN:\n- the live criterion needs a session .spike/ lacks\nVERIFY: type-check pass; lint pass; tests pass",
    });
    save(run, "p1-units", "o1");
    transcript("o2", {
      agent: "fsloop-critic",
      description: "critic code",
      final: critic("code", ["code-1 [spec] major high local a.ts:1 — c — x"]).replace("CANDIDATES:\n- —", "CANDIDATES:\n- extract the loader").replace("VERDICT:\n- —", "VERDICT:\n- code-9 resolved — a.ts:2\nJUDGED:\n- p1-units-u1-implement#judge-1 one caller is not a pattern — finding code-1"),
    });
    save(run, "p1-review", "o2");
    let json = build(collect(run));
    const [impl, crit] = json.launches;
    assert.deepEqual([impl.unit, impl.block.RESULT.value, impl.block.OPEN, crit.block.CANDIDATES.items], ["u1", "partial", undefined, ["extract the loader"]]);
    assert.deepEqual(json.findings.find((f) => f.local === "open-1").raw, "the live criterion needs a session .spike/ lacks");
    assert.deepEqual(json.verdicts.map((v) => [v.id, v.matched]), [["code-9", null]]);
    assert.deepEqual([json.judges[0].answer.result, json.judges[0].answer.finding], ["finding", "p1-review-critic-code#code-1"]);
    put(join(run, "units.md"), table(["unit", "pass", "state", "tree", "title"], [["u1", "1", "blocked: no session", "—", "page"]]));
    put(join(run, "units", "u1", "brief.md"), brief());
    green("p1-decompose");
    assert.deepEqual(gate(collect(run), "p1-units"), ["p1-units-u1-implement#open-1: no row in findings/p1-units.md"]);
    decide("p1-units", [["p1-units-u1-implement#open-1", "open", "—", "—", "major", "needs what .spike/ lacks"]], ["finding", "decision", "ref", "repeat", "severity", "why"]);
    assert.deepEqual(gate(collect(run), "p1-units"), []);
    json = build(collect(run));
    assert.deepEqual(json.units[0].launches, ["p1-units-u1-implement"]);
    assert.deepEqual([json.findings.find((f) => f.local === "open-1").severity, json.findings.find((f) => f.local === "open-1").status], ["major", "open"]);
  });

  test("the user's verdicts in human.jsonl join their finding, launch or journal row", () => {
    common();
    transcript("u1", { agent: "fsloop-critic", description: "critic code", final: critic("code", ["code-1 [spec] major high local a.ts:1 — c — x"]) });
    save(run, "p1-review", "u1");
    journal([["1", "p1-review", "q", "d", "w", "—"]]);
    put(
      join(run, "human.jsonl"),
      [
        { finding: "p1-review-critic-code#code-1", verdict: "false-positive", note: "a.ts:1 is generated", at: "t1" },
        { launch: "p1-review-critic-code", verdict: "agree", at: "t2" },
        { journal: "j1", verdict: "disagree", note: "should have asked", at: "t3" },
        { finding: "p1-review-critic-code#code-1", verdict: "maybe", at: "t4" },
      ].map((l) => JSON.stringify(l)).join("\n") + "\n",
    );
    const json = build(collect(run));
    assert.deepEqual(json.findings[0].human, [{ verdict: "false-positive", note: "a.ts:1 is generated", at: "t1" }]);
    assert.deepEqual(json.launches[0].human, [{ verdict: "agree", note: null, at: "t2" }]);
    assert.deepEqual(json.journal[0].human, [{ verdict: "disagree", note: "should have asked", at: "t3" }]);
  });

  test("the orchestrator's session shows where the run is: its launches in flight, its spend, and its sub-agents' spend under their launch", () => {
    commonWith("Started: 2026-10-18T09:59:00.000Z", "Session: session-0", "Session: session-1");
    const prompt = "Repo: /x\nCommon: /repo/.claude/fsloop/runs/ab12cd34/common.md";
    transcript("done", { agent: "fsloop-critic", description: "craft cabinets", final: "LENS: craft assess", prompt });
    // critique A, and the sub-agent it started: both the craft launch's spend.
    const dir = join(projects, "C--repo", "session-1", "subagents");
    const usage = (id, n) => JSON.stringify({ type: "assistant", timestamp: "2026-10-18T10:00:30.000Z", message: { id, model: "m", content: [{ type: "text", text: "ok" }], usage: { input_tokens: n, output_tokens: n, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 } } });
    put(join(dir, "agent-kid.jsonl"), usage("k1", 7) + "\n");
    put(join(dir, "agent-kid.meta.json"), JSON.stringify({ agentType: "general-purpose", description: "critique A", parentAgentId: "done", spawnDepth: 2 }));
    put(join(dir, "agent-grandkid.jsonl"), usage("k2", 3) + "\n");
    put(join(dir, "agent-grandkid.meta.json"), JSON.stringify({ agentType: "general-purpose", description: "probe", parentAgentId: "kid", spawnDepth: 3 }));
    save(run, "p1-map", "done");
    transcript("live", { agent: "Explore", description: "map", final: "| area |", prompt });
    transcript("elsewhere", { agent: "Explore", description: "map", final: "| area |", prompt: "Repo: /x\nCommon: /repo/.claude/fsloop/runs/99999999/common.md" });
    put(join(projects, "C--repo", "session-1.jsonl"), [usage("o1", 100), usage("o1", 120), usage("o2", 5)].join("\n") + "\n");
    const json = build(collect(run));
    assert.deepEqual(json.launches[0].spend.children, { launches: 2, input: 10, output: 10, cacheWrite: 0, cacheRead: 0 });
    assert.deepEqual(json.running.map((l) => [l.agentId, l.description, l.startedAt]), [["live", "map", "2026-10-18T10:00:00.000Z"]]);
    assert.deepEqual(json.orchestrator.spend, { input: 125, output: 125, cacheWrite: 0, cacheRead: 0 });
    assert.deepEqual(json.orchestrator.sessions.map((s) => [s.id, s.transcriptGone]), [["session-0", true], ["session-1", false]]);
    assert.deepEqual([json.sessions, json.startedAt], [["session-0", "session-1"], "2026-10-18T09:59:00.000Z"]);
    assert.deepEqual(json.now, { stage: "p1-map", since: "2026-10-18T09:59:00.000Z", waitingOn: { running: 1, units: [], lastRedGate: null } });
    assert.deepEqual(json.surfaces, {});
  });

  test("a launch whose transcript is gone keeps its report; a launches.md an older fsl.mjs began keeps its columns", () => {
    common();
    put(join(run, "launches.md"), table(["launch", "stage", "agent", "description", "model", "seconds", "input", "output", "cache write", "cache read", "transcript", "report"], [["p1-map-map", "p1-map", "Explore", "map", "m", "3", "1", "1", "0", "0", "/gone/agent-old.jsonl", "reports/p1-map-map.md"]]));
    put(join(run, "reports", "p1-map-map.md"), "RESULT: done\n");
    transcript("n1", { agent: "fsloop-critic", description: "craft cabinets", final: "LENS: craft assess" });
    save(run, "p1-map", "n1");
    const json = build(collect(run));
    assert.deepEqual(json.launches.map((l) => [l.id, l.agentId, l.transcriptGone, l.spend.children]), [["p1-map-map", "old", true, null], ["p1-map-craft-cabinets", "n1", false, null]]);
    assert.equal(json.launches[0].block.RESULT.value, "done");
    assert.equal(json.launches[1].report, "reports/p1-map-craft-cabinets.md");
  });

  test("stages keep the run's order and every attempt, whatever order they were gated in", () => {
    common();
    green("p1-map", "p1-spike", "p1-decompose");
    put(join(run, "gates.jsonl"), readOr(join(run, "gates.jsonl")) + JSON.stringify({ stage: "p1-map", green: false, at: "t4", problems: ["x"] }) + "\n");
    green("p1-map");
    const stages = build(collect(run)).stages;
    assert.deepEqual(stages.map((s) => [s.stage, s.attempts.length, s.green]), [["p1-map", 3, true], ["p1-spike", 1, true], ["p1-decompose", 1, true]]);
    assert.deepEqual(stages[0].attempts.map((a) => a.green), [true, false, true]);
  });

  test("the outcome says pushed, held and the deploy's verdict, prod-check's VERDICT read with or without its colon", () => {
    assert.deepEqual(parseDeploy("VERDICT degraded — worker restarts\nSHA abc1234 DEPLOYED 10:02\n| # | check |\nANOMALIES\n- cron x missing\n"), { verdict: "degraded", line: "worker restarts", sha: "abc1234", deployedAt: "10:02", anomalies: ["cron x missing"] });
    common();
    green("p1-verdict", "integrate");
    put(join(run, "logs", "push.log.lines"), "1 push — exit 0 — main -> main\n");
    transcript("pc", { agent: "prod-check", description: "prod check", final: "VERDICT: failed — the web service is down\nSHA: abc1234 · DEPLOYED: 10:02\nANOMALIES: none" });
    save(run, "finish", "pc");
    green("finish");
    const { outcome } = build(collect(run));
    assert.deepEqual(outcome, { pushed: true, pushLine: "1 push — exit 0 — main -> main", held: [], deploy: { verdict: "failed", line: "the web service is down", sha: "abc1234", deployedAt: "10:02", anomalies: [], launch: "finish-prod-check" }, goalMet: false });
  });

  test("evidence: each unit's and each log's COMMANDS lines, every frame, the review critic's scores by surface", () => {
    common();
    put(join(run, "units.md"), table(["unit", "pass", "state", "tree", "title"], [["u1", "1", "verify", "—", "page"]]));
    put(join(run, "units", "u1", "verify.log.lines"), "1 type-check — exit 0 — Found 0 errors\n2 unit tests — exit 1 — 1 fail\n");
    put(join(run, "logs", "integrate-checks.log.lines"), "1 build — exit 0 — built\n");
    for (const f of ["p1-baseline-cabinets.png", "p1-final-cabinets.png", "init-public.png"]) put(join(run, "shots", f), "png");
    transcript("cr", { agent: "fsloop-critic", description: "critic craft", final: "LENS: craft\nAUDIT:\n- Cabinets (`app/cabinets/`) audit 17/20 Good · critique 30/40\n- Billing page audit 12/20 Fair · critique 20/40\nFINDINGS (ranked):\n- —" });
    save(run, "p1-review", "cr");
    const json = build(collect(run));
    assert.deepEqual(json.units[0].checks, [{ file: "verify.log.lines", n: 1, label: "type-check", exit: 0, line: "Found 0 errors" }, { file: "verify.log.lines", n: 2, label: "unit tests", exit: 1, line: "1 fail" }]);
    assert.deepEqual(json.logs, [{ file: "logs/integrate-checks.log.lines", n: 1, label: "build", exit: 0, line: "built" }]);
    assert.deepEqual(json.shots.map((s) => [s.moment, s.pass, s.surface]), [["init", null, "public"], ["baseline", 1, "cabinets"], ["final", 1, "cabinets"]]);
    assert.deepEqual(Object.keys(json.surfaces), ["cabinets", "billing-page"]);
    assert.deepEqual(json.surfaces.cabinets.map((s) => [s.stage, s.audit, s.critique]), [["p1-review", 17, 30]]);
  });

  test("a legacy folder is listed by its report alone; a lane's mirror says it is one", () => {
    const legacy = join(root, ".claude", "fsloop", "0ld0ld00");
    put(join(legacy, "report.md"), "# old\n");
    const r = spawnSync(process.execPath, [SCRIPT, "build", legacy], { encoding: "utf8" });
    assert.equal(r.status, 0);
    const json = JSON.parse(readFileSync(join(legacy, "run.json"), "utf8"));
    assert.deepEqual([json.legacy, json.id, json.report], [true, "0ld0ld00", "report.md"]);
    assert.ok(existsSync(join(legacy, "summary.json")));
    const home = join(root, "repo", ".claude", "fsloop", "runs", "ab12cd34");
    put(join(home, "common.md"), ["Run: ab12cd34", "Mode: worktree", `Start: ${join(root, "repo")}`].join("\n"));
    assert.equal(build(collect(home)).mirror, false);
    put(join(run, "common.md"), ["Run: ab12cd34", "Mode: worktree", `Start: ${join(root, "repo")}`].join("\n"));
    assert.equal(build(collect(run)).mirror, true);
  });
});
