import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { after, describe, test } from "node:test";
import { fileURLToPath } from "node:url";

import {
  build,
  collect,
  gate,
  gateRecord,
  PARITY_CAP,
  parityCoverage,
  parityParts,
  parseBrief,
  parseCommon,
  parseFinding,
  parseInventory,
  parsePortedLine,
  rekey,
  reportTables,
  trailersVisible,
  usageLimitStop,
  writeParityParts,
} from "./fsl.mjs";

describe("trailersVisible", () => {
  const body = "fix(x): do y\n\nWhy.\n\n";

  test("attribution directly under the trailers keeps them in the last paragraph", () => {
    assert.equal(trailersVisible(`${body}Fsloop-Run: 6ab74c3e\nFsloop-Step: f7 9/9\nCo-Authored-By: Claude <noreply@anthropic.com>\n`, "6ab74c3e"), true);
  });

  test("a blank line before the attribution hides them, as on commit 6777064", () => {
    assert.equal(trailersVisible(`${body}Fsloop-Run: 6ab74c3e\nFsloop-Step: f7 9/9\n\nCo-Authored-By: Claude <noreply@anthropic.com>\n`, "6ab74c3e"), false);
  });
});

describe("usageLimitStop", () => {
  test("the one-line stop of run f1e9b903 is no report", () => {
    assert.equal(usageLimitStop("You've hit your 5-hour limit · resets 4:20pm (Europe/Moscow)"), true);
  });

  test("a real report that mentions Telegram's rate limit stays a report", () => {
    assert.equal(usageLimitStop(`LENS: code\nFINDINGS:\ncode-1 major the rate limit of resolveUsername is not honoured ${"x".repeat(200)}`), false);
  });
});

const HOT = "apps/api/src/leads/score.test.ts:12";
const EMPTY = "apps/api/src/leads/score.test.ts:30";
const SESSION = "apps/api/src/auth/session.test.ts:8";

const inventory = (extra = []) =>
  [
    "# Tests",
    "",
    "| slice | file:line | describe › it |",
    "|---|---|---|",
    `| leads | \`${HOT}\` | score › a hot lead outranks a cold one |`,
    `| leads | \`${EMPTY}\` | score › an empty phone scores zero |`,
    `| auth | \`${SESSION}\` | session › expires after a day |`,
    ...extra,
    "",
  ].join("\n");

const brief = ({ slice = "leads", parity = [`- \`${HOT}\` port`, `- \`${EMPTY}\` drop j1`] } = {}) =>
  [
    "Kind: backend",
    "Blocked by: —",
    ...(slice === null ? [] : [`Slice: ${slice}`]),
    "",
    "## Problem",
    "Leads are scored.",
    "## Seams",
    "`scoreLead(lead)`",
    "## Done-criteria",
    "- `bun test src/server/leads/score.test.ts`",
    "## Files",
    "- `src/server/leads/score.ts`",
    "## Reference",
    "—",
    "## Settled",
    "—",
    "## Closes",
    "—",
    ...(parity === null ? [] : ["## Parity", ...parity]),
    "",
  ].join("\n");

const DROP_ROW = `| 1 | p1-decompose | ${EMPTY} — score › an empty phone scores zero | drop | the new form makes the phone required | u1 ${EMPTY} |`;

const report = (parity) => ["RESULT: done", "CHANGED: src/server/leads/score.ts", "CREATED: —", "RED: —", "GREEN: —", "NOTES:", "- —", "OPEN:", "- —", "PARITY:", ...parity, "VERIFY: type-check pass; lint pass; tests pass", ""].join("\n");
const criticReport = (lens) => [`LENS: ${lens}`, "AUDIT: —", "VERDICT:", "- —", "JUDGED:", "- —", "FINDINGS (ranked):", "- —", "UNVERIFIED:", "- —", "ASSUMPTIONS:", "- —", "CANDIDATES:", "- —", "ORDER:", "- —", ""].join("\n");

const roots = [];
after(() => roots.forEach((r) => rmSync(r, { recursive: true, force: true })));

function runFolder({
  source = true,
  head = [],
  goal = "Port the leads.",
  tail = "",
  N = null,
  units = [{ id: "u1", pass: 1, state: "drafted", brief: brief() }],
  journal = [DROP_ROW],
  launches = [],
  gates = ["p1-map", "p1-spike", "p1-decompose", "p1-units"],
  rows = [],
  inventoryText = null,
  git = null,
  atDecompose = null,
} = {}) {
  const root = mkdtempSync(join(tmpdir(), "fsl-parity-"));
  roots.push(root);
  const repo = join(root, "legacy");
  mkdirSync(join(repo, "docs", "inventory"), { recursive: true });
  writeFileSync(join(repo, "docs", "inventory", "tests.md"), inventoryText ?? inventory(rows));
  const dir = join(root, "run");
  git ??= gitFor(dir);
  mkdirSync(join(dir, "reports"), { recursive: true });
  const sourceHead = source ? [`Source: \`${repo}\``, "Inventory: `docs/inventory`"] : [];
  const start = head.some((h) => h.startsWith("Start:")) ? [] : [`Start: ${join(root, "target").replaceAll("\\", "/")}`];
  writeFileSync(join(dir, "common.md"), ["Run: abc12345", "Mode: worktree", `N: ${N ?? "—"}`, "K: 3", ...sourceHead, ...head, ...start, "", "## Goal", "", goal, "", tail].join("\n"));
  const writeUnits = (list) => {
    writeFileSync(join(dir, "units.md"), ["| unit | pass | state | tree | title |", "|---|---|---|---|---|", ...list.map((u) => `| ${u.id} | ${u.pass} | ${u.state} | — | ${u.id} |`), ""].join("\n"));
    for (const u of list) {
      mkdirSync(join(dir, "units", u.id), { recursive: true });
      writeFileSync(join(dir, "units", u.id, "brief.md"), u.brief);
    }
  };
  writeUnits(atDecompose ?? units);
  writeFileSync(join(dir, "journal.md"), ["| # | stage | question | decision | why | refs |", "|---|---|---|---|---|---|", ...journal, ""].join("\n"));
  writeFileSync(join(dir, "gates.jsonl"), "");
  const before = collect(dir, { git });
  for (const g of gates) before.gates.push(typeof g === "string" ? gateRecord(before, g, [], AT) : { green: true, at: AT, problems: [], ...g });
  writeFileSync(join(dir, "gates.jsonl"), before.gates.map((g) => JSON.stringify(g)).join("\n") + "\n");
  if (atDecompose) {
    for (const u of atDecompose) rmSync(join(dir, "units", u.id), { recursive: true, force: true });
    writeUnits(units);
  }
  writeFileSync(join(dir, "launches.md"), ["| launch | stage | agent | description | report |", "|---|---|---|---|---|", ...launches.map((l) => `| ${l.id} | ${l.stage} | ${l.agent} | ${l.description} | reports/${l.id}.md |`), ""].join("\n"));
  for (const l of launches) writeFileSync(join(dir, "reports", `${l.id}.md`), l.report);
  const run = collect(dir, { git });
  const read = launches.filter((l) => l.readsRows);
  for (const l of read) {
    const part = parityParts(run, l.stage).find((p) => p.description === l.description);
    if (part) writeFileSync(join(dir, "reports", `${l.id}.md`), l.report.replace(/^LENS: .*$/m, (lens) => [lens, ...rowsBlock(part)].join("\n")));
  }
  return { dir, root, repo, run: read.length ? collect(dir, { git }) : run };
}

const AT = "2026-11-09T10:00:00Z";
const gitFor = (dir) => (start, args) => {
  if (args[0] !== "log") return null;
  const landedUnits = [...readFileSync(join(dir, "units.md"), "utf8").matchAll(/^\| ([uf]\d+) \| \d+ \| committed ([0-9a-f]{7,40})\b/gm)];
  return landedUnits.map(([, unit, sha]) => [sha, AT, `feat: ${unit}`, `feat: ${unit}\n\nFsloop-Run: abc12345\nFsloop-Step: ${unit} 1/1\n`].join("\x1f")).join("\0");
};
const reload = (dir) => collect(dir, { git: gitFor(dir) });
const rowsBlock = (part, verdict = () => "kept") => [`ROWS: ${part.seal}`, ...part.rows.map((r) => `- \`${r.key}\` — ${verdict(r)}`)];

const implement = (parity, unit = "u1") => ({ id: `p1-units-${unit}-implement`, stage: "p1-units", agent: "fsloop-implement", description: `${unit} implement`, report: report(parity) });
const critic = (stage, description) => ({
  id: `${stage}-${description.replaceAll(" ", "-").replaceAll("/", "-")}`,
  stage,
  agent: "fsloop-critic",
  description,
  report: criticReport(`${description.replace(/^critic /, "").split(" ")[0]}${stage.endsWith("-assess") ? " assess" : ""}`),
  readsRows: description.startsWith("critic parity"),
});
const landed = () => "feat(leads): score leads\n\nFsloop-Run: abc12345\nFsloop-Step: u1 1/1\n";
const committed = (parity = [`- \`${HOT}\` — ported \`src/server/leads/score.test.ts:40\``], extra = {}) => ({ units: [{ id: "u1", pass: 1, state: "committed abc1234", brief: brief() }], launches: [implement(parity)], ...extra });
const always = () => true;

describe("source inventory and contracts", () => {
  test("rows are read by position, backticks stripped, keyed by file:line", () => {
    assert.deepEqual(parseInventory(inventory())[0], { slice: "leads", key: HOT, name: "score › a hot lead outranks a cold one" });
    assert.equal(parseInventory(inventory()).length, 3);
  });

  test("a brief's Parity takes port, ported-earlier, drop and defer, and skips a bare dash", () => {
    const b = parseBrief(brief({ slice: "leads, auth", parity: [`- \`${HOT}\` ported-earlier \`src/server/leads/score.test.ts:40\``, `- \`${EMPTY}\` defer j2`, `- \`${SESSION}\` port`, "- —"] }));
    assert.deepEqual(b.slices, ["leads", "auth"]);
    assert.deepEqual(
      b.parity.map((p) => [p.fate, p.test ?? p.ref]),
      [
        ["ported-earlier", "src/server/leads/score.test.ts:40"],
        ["defer", "j2"],
        ["port", null],
      ],
    );
  });

  test("a PARITY line names its ported test as file:line, with or without the brief's port word", () => {
    assert.equal(parsePortedLine(`\`${HOT}\` port — ported \`src/server/leads/score.test.ts:40\``).ported, true);
    assert.equal(parsePortedLine(`${HOT} — ported —`).ported, false);
    assert.equal(parsePortedLine(`${HOT} — ported in the scorer`).ported, false);
    assert.deepEqual(parsePortedLine(`\`${HOT}\` — not ported — the scorer is gone`), { key: HOT, ported: false, test: null });
  });

  test("a parity finding cites its row by file:line alone, so a name with « — » cannot cut its rule", () => {
    const row = "| accounts | apps/core/tests/integration/account-channels.test.ts:82 | API: снимок каналов аккаунта › до первого обновления снимка нет; неизвестный аккаунт и не оператор — 404 |";
    const [parsed] = parseInventory(`| slice | file:line | describe › it |\n|---|---|---|\n${row}\n`);
    assert.equal(parsed.name, "API: снимок каналов аккаунта › до первого обновления снимка нет; неизвестный аккаунт и не оператор — 404");
    const f = parseFinding(`parity-1 [parity] major high — src/server/accounts/channels.ts:40 — source: ${parsed.key} — port the 404 for a stranger`);
    assert.deepEqual([f.parsed, f.rule, f.action], ["strict", `source: ${parsed.key}`, "port the 404 for a stranger"]);
  });

  test("Source and Inventory are head lines only, backticks stripped", () => {
    const c = parseCommon("Run: x\nSource: `C:/dev/legacy`\nInventory: `docs/inventory`\n\n## Goal\n\nPort it.\n");
    assert.equal(c.source, "C:/dev/legacy");
    assert.equal(c.inventory, "docs/inventory");
    assert.equal(parseCommon("Run: x\n\n## Goal\n\nПеренеси раздел.\nSource: старый проект\n").source, null);
  });
});

describe("decompose gate on a rebuild", () => {
  const ok = { exists: always };

  test("every row of the named slice ported or dropped by its journal row is green", () => {
    assert.deepEqual(gate(runFolder().run, "p1-decompose", ok), []);
  });

  test("a row of the slice in no brief is named with the slice", () => {
    const { run } = runFolder({ units: [{ id: "u1", pass: 1, state: "drafted", brief: brief({ parity: [`- \`${HOT}\` port`] }) }] });
    assert.deepEqual(gate(run, "p1-decompose", ok), [
      `slice leads: 1 rows in no brief's Parity — ${EMPTY}; each one \`<file:line>\` port | ported-earlier <test file>:<line> | drop j<n> | defer j<n>, or, when no brief lists any row of it, one journal row of this stage deciding drop or defer with slice:leads in its refs`,
    ]);
  });

  test("a drop with no journal row behind it is red", () => {
    assert.deepEqual(gate(runFolder({ journal: [] }).run, "p1-decompose", ok), [`u1: Parity ${EMPTY} drop j1 — journal.md has no row # 1`]);
  });

  test("a drop whose journal row decides otherwise or lacks the row's key is red", () => {
    const { run } = runFolder({ journal: ["| 1 | p1-decompose | the empty phone | keep | the form allows it | u1 |"] });
    assert.deepEqual(gate(run, "p1-decompose", ok), [`u1: Parity ${EMPTY} drop j1 — that journal row decides "keep", not drop`, `u1: Parity ${EMPTY} drop j1 — that journal row's refs lack ${EMPTY}`]);
  });

  test("a brief with no Slice line and no Parity section is red on a rebuild", () => {
    const problems = gate(runFolder({ units: [{ id: "u1", pass: 1, state: "drafted", brief: brief({ slice: null, parity: null }) }] }).run, "p1-decompose", ok);
    assert.ok(problems.some((p) => p.startsWith('u1: brief has no "Slice:" line')));
    assert.ok(problems.some((p) => p.startsWith('u1: brief has no "## Parity" section')));
  });

  test("Slice — with a bare dash under Parity is green", () => {
    assert.deepEqual(gate(runFolder({ units: [{ id: "u1", pass: 1, state: "drafted", brief: brief({ slice: "—", parity: ["- —"] }) }] }).run, "p1-decompose", ok), []);
  });

  test("a row of a slice the brief does not name is red", () => {
    const { run } = runFolder({ units: [{ id: "u1", pass: 1, state: "drafted", brief: brief({ parity: [`- \`${HOT}\` port`, `- \`${EMPTY}\` drop j1`, `- \`${SESSION}\` port`] }) }] });
    assert.deepEqual(gate(run, "p1-decompose", ok), [`u1: Parity ${SESSION} is a row of slice auth, which its Slice line does not name`]);
  });

  test("ported-earlier holds until its test file is at HEAD", () => {
    const { run } = runFolder({ head: ["Worktree: C:/dev/fsl/abc12345"], units: [{ id: "u1", pass: 1, state: "drafted", brief: brief({ parity: [`- \`${HOT}\` ported-earlier \`src/server/leads/score.test.ts:40\``, `- \`${EMPTY}\` drop j1`] }) }] });
    const asked = [];
    assert.deepEqual(gate(run, "p1-decompose", { exists: (...a) => (asked.push(a), true) }), []);
    assert.deepEqual(asked, [["C:/dev/fsl/abc12345", "HEAD", "src/server/leads/score.test.ts"]]);
    assert.deepEqual(gate(run, "p1-decompose", { exists: () => false }), [`u1: Parity ${HOT} ported-earlier src/server/leads/score.test.ts:40 — no such file before this run's first commit (HEAD in C:/dev/fsl/abc12345)`]);
  });

  test("a later pass re-lists a row; two briefs of one pass cannot", () => {
    const pass2 = { id: "u2", pass: 2, state: "drafted", brief: brief({ parity: [`- \`${HOT}\` port`] }) };
    const twin = { id: "u3", pass: 2, state: "drafted", brief: brief({ parity: [`- \`${HOT}\` port`] }) };
    const gates = ["p1-map", "p1-spike", "p1-decompose", "p1-units", "p1-review", "p1-fix", "p1-assess"];
    const passes = (dir) => writeFileSync(join(dir, "passes.md"), "| pass | critical+major | outcome | why |\n|---|---|---|---|\n| p1 | 1 | next | one parity finding |\n");
    const one = runFolder({ N: 2, gates, units: [{ id: "u1", pass: 1, state: "committed abc1234", brief: brief() }, pass2] });
    passes(one.dir);
    assert.deepEqual(gate(reload(one.dir), "p2-decompose", ok), []);
    const two = runFolder({ N: 2, gates, units: [{ id: "u1", pass: 1, state: "committed abc1234", brief: brief() }, pass2, twin] });
    passes(two.dir);
    assert.deepEqual(
      gate(reload(two.dir), "p2-decompose", ok).filter((p) => p.includes("Parity")),
      [`${HOT}: in the Parity of u2, u3, one pass — one brief of a pass carries each row`],
    );
    const dropped = runFolder({ N: 2, gates, units: [{ id: "u1", pass: 1, state: "committed abc1234", brief: brief() }, { ...pass2, brief: brief({ parity: [`- \`${HOT}\` drop j1`] }) }] });
    passes(dropped.dir);
    assert.ok(
      gate(reload(dropped.dir), "p2-decompose", ok).includes(`u2: Parity ${HOT} drop — pass 1 listed it already; a later pass re-lists a row only as port — take the line out to keep pass 1's fate`),
    );
  });

  test("a blocked re-port of pass 2 leaves pass 1's port as the row's fate", () => {
    const { run } = runFolder({
      units: [
        { id: "u1", pass: 1, state: "committed abc1234", brief: brief() },
        { id: "u2", pass: 2, state: "blocked: no seam", brief: brief({ parity: [`- \`${HOT}\` port`] }) },
      ],
      launches: [implement([`- \`${HOT}\` — ported \`src/server/leads/score.test.ts:40\``])],
    });
    assert.deepEqual(parityCoverage(run), [{ slice: "leads", rows: 2, ported: 1, portedEarlier: 0, dropped: 1, deferred: 0, open: 0 }]);
  });

  test("a Source section with no Source: head line is red, nested under ## Project too", () => {
    for (const tail of ["## Source\n\n- repo: `C:/dev/legacy`\n", "## Project\n\n### Source\n\n- repo: `C:/dev/legacy`\n"]) {
      const { run } = runFolder({ source: false, tail });
      assert.ok(gate(run, "p1-decompose", ok).some((p) => p.startsWith("common.md has a Source section but no Source: head line")));
    }
  });

  test("a run with no Source in common.md gates a brief with neither Slice nor Parity as before", () => {
    assert.deepEqual(gate(runFolder({ source: false, units: [{ id: "u1", pass: 1, state: "drafted", brief: brief({ slice: null, parity: null }) }] }).run, "p1-decompose", ok), []);
  });
});

describe("units gate on a rebuild", () => {
  const opts = (changed = () => ["src/server/leads/score.test.ts"]) => ({ commitMessage: landed, exists: always, changed });

  test("a port row with its ported test in the unit's commit is green", () => {
    assert.deepEqual(gate(runFolder(committed()).run, "p1-units", opts()), []);
  });

  test("a ported test no commit of the unit changes is red", () => {
    const asked = [];
    const { run } = runFolder(committed(undefined, { head: ["Start: C:/dev/target"] }));
    assert.deepEqual(gate(run, "p1-units", opts((...a) => (asked.push(a), ["src/server/leads/score.ts", "src/server/leads/score.test.ts"]))), []);
    assert.deepEqual(asked, [["C:/dev/target", "abc1234"]]);
    assert.deepEqual(gate(run, "p1-units", opts(() => ["src/server/leads/score.ts"])), [`u1: Parity ${HOT} — ported src/server/leads/score.test.ts:40, which no commit of u1 changes`]);
  });

  test("a drop rewritten at Verify is checked against the journal at units", () => {
    const b = brief({ parity: [`- \`${HOT}\` drop j9`, `- \`${EMPTY}\` drop j1`] });
    const { run } = runFolder({ units: [{ id: "u1", pass: 1, state: "committed abc1234", brief: b }], launches: [implement([])] });
    assert.deepEqual(gate(run, "p1-units", opts()), [`u1: Parity ${HOT} drop j9 — journal.md has no row # 9`]);
  });

  test("a drop whose journal row has no why is red", () => {
    const { run } = runFolder({ ...committed(), journal: [`| 1 | p1-decompose | ${EMPTY} | drop | — | u1 ${EMPTY} |`] });
    assert.deepEqual(gate(run, "p1-units", opts()), [`u1: Parity ${EMPTY} drop j1 — that journal row's why "—" is no reason; write the ground the goal, PRODUCT.md or the stack gives`]);
  });

  test("a brief row gone from a rebuilt inventory is named at units", () => {
    const b = brief({ parity: [`- \`${HOT}\` port`, `- \`${EMPTY}\` drop j1`, "- `apps/api/src/leads/score.test.ts:99` port"] });
    const { run } = runFolder({ units: [{ id: "u1", pass: 1, state: "committed abc1234", brief: b }], launches: [implement([`- \`${HOT}\` — ported \`src/server/leads/score.test.ts:40\``, "- `apps/api/src/leads/score.test.ts:99` — ported `src/server/leads/score.test.ts:60`"])] });
    assert.ok(gate(run, "p1-units", opts())[0].startsWith("u1: Parity apps/api/src/leads/score.test.ts:99 is no row of"));
  });

  test("a PARITY line keyed by the source's absolute path still names the row", () => {
    assert.deepEqual(gate(runFolder(committed([`- \`C:/dev/legacy/${HOT}\` — ported \`src/server/leads/score.test.ts:40\``])).run, "p1-units", opts()), []);
  });

  test("a port row the report calls not ported holds the stage", () => {
    assert.deepEqual(gate(runFolder(committed([`- \`${HOT}\` — not ported — the scorer moved to the database`])).run, "p1-units", opts()), [
      `u1: Parity ${HOT} — port, but no PARITY line of a u1 launch names its ported test; port it, or drop it: a journal row and drop j<n> in the brief`,
    ]);
  });

  test("a PARITY line in no known form is named as such", () => {
    const problems = gate(runFolder(committed([`- \`${HOT}\` done, see the scorer test`])).run, "p1-units", opts());
    assert.equal(problems[0], `u1: PARITY line "\`${HOT}\` done, see the scorer test" of p1-units-u1-implement is not \`<file:line>\` — ported <test file>:<line> | not ported — <why>`);
  });

  test("with no Source the same report gates green without a PARITY section", () => {
    assert.deepEqual(gate(runFolder({ ...committed([]), source: false }).run, "p1-units", opts()), []);
  });
});

describe("parity critics", () => {
  const many = Array.from({ length: PARITY_CAP + 1 }, (_, i) => `| big | \`apps/api/src/big.test.ts:${i + 1}\` | big › case ${i + 1} |`);

  const ported = implement([`- \`${HOT}\` — ported \`src/server/leads/score.test.ts:40\``]);
  const parityProblems = (run, stage) => gate(run, stage).filter((p) => p.includes("critic parity") || p.includes("critic code"));

  test("review is red until each source slice of the pass has its parity critic", () => {
    const { run } = runFolder({ ...committed(), launches: [ported, critic("p1-review", "critic code")] });
    assert.deepEqual(parityProblems(run, "p1-review"), [
      'p1-review: no "critic parity leads" report of fsloop-critic with LENS: parity saved — its rows are the run folder\'s parity/p1-review-leads.md (fsl.mjs parity <run folder> p1-review)',
    ]);
    const done = runFolder({ ...committed(), launches: [ported, critic("p1-review", "critic code"), critic("p1-review", "critic parity leads")] });
    assert.deepEqual(parityProblems(done.run, "p1-review"), []);
  });

  test("a parity report from another agent or lens does not count, nor stands in for critic code", () => {
    const impostor = { ...critic("p1-review", "critic parity leads"), agent: "fsloop-implement" };
    const wrongLens = { ...critic("p1-review", "critic parity leads"), report: criticReport("code") };
    for (const fake of [impostor, wrongLens]) assert.equal(parityProblems(runFolder({ ...committed(), launches: [ported, critic("p1-review", "critic code"), fake] }).run, "p1-review").length, 1);
    const alone = runFolder({ ...committed(), launches: [ported, critic("p1-review", "critic parity leads")] });
    assert.deepEqual(parityProblems(alone.run, "p1-review"), ['p1-review: no "critic code" report of fsloop-critic with LENS: code saved — a parity critic is no code review']);
  });

  test("a blocked unit's slice still gets its parity critic, its rows marked blocked", () => {
    const { run, dir } = runFolder({ units: [{ id: "u1", pass: 1, state: "blocked: the scorer needs a queue", brief: brief() }], N: 2 });
    assert.deepEqual(parityParts(run, "p1-review").map((p) => [p.description, p.rows.map((r) => r.state)]), [["critic parity leads", ["blocked"]]]);
    assert.deepEqual(parityCoverage(run), [{ slice: "leads", rows: 2, ported: 0, portedEarlier: 0, dropped: 1, deferred: 0, open: 1 }]);
    assert.ok(readFileSync(join(dir, writeParityParts(dir, "p1-assess")[0].file), "utf8").includes("| u1 (blocked) | port |"));
  });

  test("a Source head line with no readable inventory is red at review", () => {
    const { dir } = runFolder({ ...committed(), launches: [ported, critic("p1-review", "critic code")] });
    rmSync(join(dir, "..", "legacy", "docs", "inventory", "tests.md"));
    assert.ok(gate(reload(dir), "p1-review").some((p) => p.startsWith("common.md Source:") && p.includes("no inventory at")));
  });

  test("a slice past the cap splits into parts, each its own launch", () => {
    const parity = [`- \`apps/api/src/big.test.ts:1\` port`, ...many.slice(1).map((_, i) => `- \`apps/api/src/big.test.ts:${i + 2}\` port`)];
    const { run } = runFolder({ rows: many, units: [{ id: "u1", pass: 1, state: "committed abc1234", brief: brief({ slice: "big", parity }) }], launches: [implement([])] });
    const parts = parityParts(run, "p1-review");
    assert.deepEqual(
      parts.map((p) => [p.description, p.rows.length, p.file]),
      [
        ["critic parity big 1/2", PARITY_CAP, "parity/p1-review-big-1.md"],
        ["critic parity big 2/2", 1, "parity/p1-review-big-2.md"],
      ],
    );
  });

  test("assess with N asks a parity critic over every row of the run's slices", () => {
    const { run } = runFolder({ ...committed(), N: 2 });
    assert.deepEqual(
      parityParts(run, "p1-assess").map((p) => [p.description, p.rows.map((r) => r.fate)]),
      [["critic parity leads", ["port", "drop"]]],
    );
    assert.ok(gate(run, "p1-assess").some((p) => p.startsWith('p1-assess: no "critic parity leads" report of fsloop-critic with LENS: parity assess saved')));
  });

  test("parity writes each part's rows for the critic's prompt", () => {
    const { dir } = runFolder(committed());
    const parts = writeParityParts(dir, "p1-review");
    const text = readFileSync(join(dir, parts[0].file), "utf8");
    assert.ok(existsSync(join(dir, "parity", "p1-review-leads.md")));
    assert.ok(text.includes(`| \`${HOT}\` | score › a hot lead outranks a cold one | u1 | port | — | \`src/server/leads/score.test.ts:40\` |`));
    const assess = readFileSync(join(dir, writeParityParts(dir, "p1-assess")[0].file), "utf8");
    assert.ok(assess.includes(`| \`${EMPTY}\` | score › an empty phone scores zero | u1 | drop j1 | the new form makes the phone required | — |`));
  });
});

describe("parity coverage", () => {
  test("each named slice counts ported, dropped, deferred and open rows, into run.json and the report", () => {
    const { run } = runFolder(committed());
    assert.deepEqual(parityCoverage(run), [{ slice: "leads", rows: 2, ported: 1, portedEarlier: 0, dropped: 1, deferred: 0, open: 0 }]);
    const json = build(run);
    assert.deepEqual(json.parity, parityCoverage(run));
    assert.ok(reportTables(json).includes("## Parity (source slices)"));
  });

  test("a run with no Source has no parity in run.json", () => {
    assert.equal(build(runFolder({ source: false }).run).parity, undefined);
  });
});

describe("probes of the third audit — each red on 2843fad", () => {
  const FSL = join(dirname(fileURLToPath(import.meta.url)), "fsl.mjs");
  const afterDecompose = ["p1-map", "p1-spike", "p1-decompose", "p1-units"];
  const opts = { commitMessage: landed, exists: always, changed: () => ["src/server/leads/score.test.ts"] };
  const original = [{ id: "u1", pass: 1, state: "drafted", brief: brief() }];
  const committedWith = (b, extra = {}) => ({ gates: afterDecompose, atDecompose: original, units: [{ id: "u1", pass: 1, state: "committed abc1234", brief: b }], launches: [implement([])], ...extra });

  test("1 — a slice emptied after Decompose (Slice: —, Parity —) holds units", () => {
    const { run } = runFolder(committedWith(brief({ slice: "—", parity: ["- —"] })));
    const problems = gate(run, "p1-units", opts);
    assert.ok(problems.some((p) => p.startsWith(`${HOT}: port in u1 at p1-decompose, no line now`)));
    assert.ok(problems.some((p) => p.startsWith(`${EMPTY}: drop at p1-decompose, no line now`) || p.startsWith(`${EMPTY}: drop in u1 at p1-decompose, no line now`)));
  });

  test("1 — a port line deleted after Decompose holds units; a slice row written after Decompose releases nothing", () => {
    const { run } = runFolder(committedWith(brief({ parity: [`- \`${EMPTY}\` drop j1`] })));
    assert.ok(gate(run, "p1-units", opts).some((p) => p.startsWith(`${HOT}: port in u1 at p1-decompose, no line now`)));
    const late = runFolder(committedWith(brief({ slice: "—", parity: ["- —"] }), { journal: [DROP_ROW, "| 2 | p1-units | take leads out | drop | the goal retires lead scoring | u1 slice:leads |"] }));
    assert.ok(gate(late.run, "p1-units", opts).some((p) => p.startsWith(`${HOT}: port in u1 at p1-decompose, no line now`)));
  });

  test("1 — a green decompose gate records each row's fate for the later gates", () => {
    const { dir } = runFolder({ gates: ["p1-map", "p1-spike"] });
    const out = spawnSync(process.execPath, [FSL, "gate", dir, "p1-decompose"], { encoding: "utf8" });
    assert.equal(out.status, 0, out.stdout + out.stderr);
    const last = JSON.parse(readFileSync(join(dir, "gates.jsonl"), "utf8").trim().split("\n").at(-1));
    assert.deepEqual(last.parity, {
      slices: ["leads"],
      rows: { [HOT]: { slice: "leads", fate: "port", unit: "u1" }, [EMPTY]: { slice: "leads", fate: "drop", unit: "u1", ref: "j1" } },
    });
  });

  test("2 — ported-earlier takes a test file only, as it stood before the run's first commit", () => {
    const b = (test) => brief({ parity: [`- \`${HOT}\` ported-earlier \`${test}\``, `- \`${EMPTY}\` drop j1`] });
    const { run } = runFolder({ units: [{ id: "u1", pass: 1, state: "drafted", brief: b("package.json:1") }] });
    assert.ok(gate(run, "p1-decompose", { exists: always }).some((p) => p.includes("ported-earlier package.json:1 — not a test file")));
    const log = ["deadbeefdeadbeefdeadbeefdeadbeefdeadbeef", "2026-11-09T10:00:00Z", "docs: spikes", "docs: spikes\n\nFsloop-Run: abc12345\nFsloop-Step: spikes\n"].join("\x1f");
    const git = (start, args) => (args[0] === "log" ? log : "");
    const asked = [];
    const later = runFolder({ head: ["Start: C:/dev/target", "Worktree: C:/dev/fsl/abc12345"], git, units: [{ id: "u1", pass: 1, state: "drafted", brief: b("src/server/leads/score.test.ts:40") }] });
    gate(later.run, "p1-decompose", { exists: (...a) => (asked.push(a), true) });
    assert.deepEqual(asked, [["C:/dev/fsl/abc12345", "deadbeefdeadbeefdeadbeefdeadbeefdeadbeef^", "src/server/leads/score.test.ts"]]);
  });

  test("3 — an inventory with no parsable row is red: header only, swapped columns, a list", () => {
    const head = "| slice | file:line | describe › it |\n|---|---|---|\n";
    for (const inventoryText of [head, "   \n", `| file:line | slice | describe › it |\n|---|---|---|\n| \`${HOT}\` | leads | score |\n`, `- leads ${HOT} score\n`]) {
      const { run } = runFolder({ inventoryText });
      assert.ok(gate(run, "p1-decompose", { exists: always }).some((p) => p.startsWith("common.md Source:")), inventoryText);
    }
  });

  test("4 — a blocked re-port over a drop shows the row open and in the review part, marked", () => {
    const { run } = runFolder({
      units: [
        { id: "u1", pass: 1, state: "committed abc1234", brief: brief() },
        { id: "u2", pass: 2, state: "blocked: no seam", brief: brief({ parity: [`- \`${EMPTY}\` port`] }) },
      ],
      launches: [implement([`- \`${HOT}\` — ported \`src/server/leads/score.test.ts:40\``])],
    });
    assert.deepEqual(parityCoverage(run), [{ slice: "leads", rows: 2, ported: 1, portedEarlier: 0, dropped: 0, deferred: 0, open: 1 }]);
    assert.deepEqual(parityParts(run, "p2-review").map((p) => p.rows.map((r) => [r.key, r.state])), [[[EMPTY, "blocked"]]]);
  });

  test("5 — a later pass's line rewritten to drop at Verify is red at units", () => {
    const passes = "| pass | critical+major | outcome | why |\n|---|---|---|---|\n| p1 | 1 | next | a parity finding |\n";
    const gates = ["p1-map", "p1-spike", "p1-decompose", "p1-units", "p1-review", "p1-fix", "p1-assess", "p2-decompose"];
    const { dir } = runFolder({
      N: 2,
      gates,
      units: [
        { id: "u1", pass: 1, state: "committed abc1234", brief: brief() },
        { id: "u2", pass: 2, state: "committed abc5678", brief: brief({ parity: [`- \`${HOT}\` drop j2`] }) },
      ],
      journal: [DROP_ROW, `| 2 | p2-units | ${HOT} | drop | the scorer moved to the warehouse | u2 ${HOT} |`],
    });
    writeFileSync(join(dir, "passes.md"), passes);
    assert.ok(gate(reload(dir), "p2-units", opts).includes(`u2: Parity ${HOT} drop — pass 1 listed it already; a later pass re-lists a row only as port — take the line out to keep pass 1's fate`));
  });

  test("6 — no agent, a code verdict or a parity assess report counts as no review critic", () => {
    const ported = implement([`- \`${HOT}\` — ported \`src/server/leads/score.test.ts:40\``]);
    const code = critic("p1-review", "critic code");
    const parity = critic("p1-review", "critic parity leads");
    const cases = [
      [{ ...parity, agent: "" }, code],
      [parity, { ...code, report: criticReport("code verdict") }],
      [{ ...parity, report: criticReport("parity assess") }, code],
    ];
    for (const launches of cases) {
      const { run } = runFolder({ ...committed(), launches: [ported, ...launches] });
      assert.equal(gate(run, "p1-review").filter((p) => p.includes('"critic parity leads"') || p.includes('"critic code"')).length, 1);
    }
  });

  test("7 — a merge commit and a Cyrillic path still name the files the unit changed", () => {
    const repo = mkdtempSync(join(tmpdir(), "fsl-git-"));
    roots.push(repo);
    const g = (...args) => spawnSync("git", ["-C", repo, "-c", "user.name=t", "-c", "user.email=t@t", "-c", "commit.gpgsign=false", ...args], { encoding: "utf8" });
    g("init", "-q", "-b", "main");
    writeFileSync(join(repo, "a.txt"), "a\n");
    g("add", "-A");
    g("commit", "-qm", "a");
    g("checkout", "-qb", "side");
    mkdirSync(join(repo, "тесты"));
    writeFileSync(join(repo, "тесты", "счёт.test.ts"), "x\n");
    g("add", "-A");
    g("commit", "-qm", "port");
    g("checkout", "-q", "main");
    writeFileSync(join(repo, "b.txt"), "b\n");
    g("add", "-A");
    g("commit", "-qm", "b");
    g("merge", "-q", "--no-ff", "-m", "merge", "side");
    const sha = g("rev-parse", "HEAD").stdout.trim();
    const { run } = runFolder({
      head: [`Start: ${repo.replaceAll("\\", "/")}`],
      units: [{ id: "u1", pass: 1, state: `committed ${sha}`, brief: brief() }],
      launches: [implement([`- \`${HOT}\` — ported \`тесты/счёт.test.ts:1\``])],
    });
    assert.deepEqual(gate(run, "p1-units", { commitMessage: landed, exists: always }), []);
  });

  test("8 — a stub why (n/a, ., tbd) is no reason", () => {
    for (const why of ["n/a", ".", "tbd"]) {
      const { run } = runFolder({ journal: [`| 1 | p1-decompose | ${EMPTY} | drop | ${why} | u1 ${EMPTY} |`] });
      assert.ok(gate(run, "p1-decompose", { exists: always }).some((p) => p.includes("is no reason")), why);
    }
  });

  test("9 — the Source section is found in every heading form, never inside a code block, and read from the config when there is one", () => {
    for (const tail of ["## Source — legacy\n\n- repo: x\n", "### Source:\n\n- repo: x\n"]) {
      const { run } = runFolder({ source: false, tail });
      assert.ok(gate(run, "p1-decompose", { exists: always }).some((p) => p.startsWith("common.md has a Source section")), tail);
    }
    const fenced = runFolder({ source: false, goal: "Write this:\n\n```md\n### Source\n```\n" });
    assert.equal(gate(fenced.run, "p1-decompose", { exists: always }).filter((p) => p.startsWith("common.md has a Source section")).length, 0);
    const start = mkdtempSync(join(tmpdir(), "fsl-start-"));
    roots.push(start);
    mkdirSync(join(start, ".claude", "fsloop"), { recursive: true });
    writeFileSync(join(start, ".claude", "fsloop", "config.md"), "# fsloop config\n\n## Source\n\n- repo: x\n");
    const configured = runFolder({ source: false, head: [`Start: ${start.replaceAll("\\", "/")}`], goal: "Write this:\n\n```md\n### Source\n```\n" });
    assert.ok(gate(configured.run, "p1-decompose", { exists: always }).some((p) => p.startsWith("common.md has a Source section")));
  });

  test("10 — a slice with no port row of the pass asks no parity critic", () => {
    const { run } = runFolder({ units: [{ id: "u1", pass: 1, state: "committed abc1234", brief: brief({ parity: [`- \`${HOT}\` drop j2`, `- \`${EMPTY}\` drop j1`] }) }], journal: [DROP_ROW, `| 2 | p1-decompose | ${HOT} | drop | the goal retires hot scoring | u1 ${HOT} |`] });
    assert.deepEqual(parityParts(run, "p1-review"), []);
  });

  test("11 — finish never reads the inventory, so a source moved after the run cannot hold it", () => {
    const { dir, repo } = runFolder(committed());
    rmSync(repo, { recursive: true, force: true });
    assert.equal(gate(reload(dir), "finish").filter((p) => p.includes("no inventory")).length, 0);
  });
});

describe("probes of the fourth audit — each red on aea3370", () => {
  const SESSION2 = "apps/api/src/auth/session.test.ts:20";
  const authRows = [`| auth | \`${SESSION2}\` | session › refreshes on use |`];
  const opts = { commitMessage: landed, exists: always, changed: () => ["src/server/leads/score.test.ts", "src/server/auth/session.test.ts"] };
  const portedHot = implement([`- \`${HOT}\` — ported \`src/server/leads/score.test.ts:40\``]);
  const passes = (dir) => writeFileSync(join(dir, "passes.md"), "| pass | critical+major | outcome | why |\n|---|---|---|---|\n| p1 | 1 | next | auth is due |\n");
  const twoPasses = ["p1-map", "p1-spike", "p1-decompose", "p1-units", "p1-review", "p1-fix", "p1-assess", "p2-decompose"];

  test("1 — a slice row from an earlier pass does not cover a row pass 2 listed and then erased", () => {
    const auth = (lines) => brief({ slice: "auth", parity: lines });
    const both = [`- \`${SESSION}\` port`, `- \`${SESSION2}\` port`];
    const u1 = { id: "u1", pass: 1, state: "committed abc1234", brief: brief() };
    const { dir } = runFolder({
      N: 2,
      rows: authRows,
      gates: twoPasses,
      journal: [DROP_ROW, "| 2 | p1-decompose | auth later | defer | stage 3 of the plan takes auth | u1 slice:auth |"],
      atDecompose: [u1, { id: "u2", pass: 2, state: "drafted", brief: auth(both) }],
      units: [u1, { id: "u2", pass: 2, state: "committed abc5678", brief: auth([`- \`${SESSION}\` port`]) }],
      launches: [portedHot, { ...implement([`- \`${SESSION}\` — ported \`src/server/auth/session.test.ts:8\``], "u2"), id: "p2-units-u2-implement", stage: "p2-units" }],
    });
    passes(dir);
    const problems = gate(reload(dir), "p2-units", opts);
    assert.ok(problems.some((p) => p.startsWith(`${SESSION2}: port in u2 at p2-decompose, no line now`)), problems.join("\n"));
  });

  test("1 — in one pass, a slice row does not cover a port line erased at Verify", () => {
    const { run } = runFolder({
      journal: [DROP_ROW, "| 2 | p1-decompose | leads later | defer | stage 3 of the plan takes leads | u1 slice:leads |"],
      atDecompose: [{ id: "u1", pass: 1, state: "drafted", brief: brief() }],
      units: [{ id: "u1", pass: 1, state: "committed abc1234", brief: brief({ parity: [`- \`${EMPTY}\` drop j1`] }) }],
      launches: [implement([])],
    });
    assert.ok(gate(run, "p1-units", opts).some((p) => p.startsWith(`${HOT}: port in u1 at p1-decompose, no line now`)));
  });

  test("2 — ported-earlier past its file's end is red, goes to the review critic, and is open while a parity finding cites it", () => {
    const b = (test) => brief({ parity: [`- \`${HOT}\` ported-earlier \`${test}\``, `- \`${EMPTY}\` drop j1`] });
    const far = runFolder({ units: [{ id: "u1", pass: 1, state: "drafted", brief: b("src/shared/format.test.ts:99999") }] });
    assert.ok(gate(far.run, "p1-decompose", { exists: () => 120 }).some((p) => p.includes("line 99999 is past the file's 120 lines")));
    const finding = { ...critic("p1-review", "critic parity leads"), report: criticReport("parity").replace("FINDINGS (ranked):\n- —", `FINDINGS (ranked):\n- parity-1 [parity] major high — src/shared/format.test.ts:12 — source: ${HOT} — cover the hot-lead case`) };
    const { run } = runFolder({ units: [{ id: "u1", pass: 1, state: "committed abc1234", brief: b("src/shared/format.test.ts:12") }], launches: [implement([]), finding] });
    assert.deepEqual(parityParts(run, "p1-review").map((p) => p.rows.map((r) => [r.key, r.fate])), [[[HOT, "ported-earlier"]]]);
    assert.deepEqual(parityCoverage(run), [{ slice: "leads", rows: 2, ported: 0, portedEarlier: 0, dropped: 1, deferred: 0, open: 1 }]);
  });

  test("3 — a stub why (skip it, to do) is no reason", () => {
    for (const why of ["skip it", "to do"]) {
      const { run } = runFolder({ journal: [`| 1 | p1-decompose | ${EMPTY} | drop | ${why} | u1 ${EMPTY} |`] });
      assert.ok(gate(run, "p1-decompose", { exists: always }).some((p) => p.includes("is no reason")), why);
    }
  });

  test("4 — a green decompose with no parity snapshot holds every later gate", () => {
    const { run } = runFolder({ ...committed(), gates: ["p1-map", "p1-spike", { stage: "p1-decompose" }, "p1-units"] });
    assert.ok(gate(run, "p1-units", opts).some((p) => p.startsWith("p1-decompose: its green gate recorded no parity snapshot — gate p1-decompose again")));
  });

  test("5 — a port row with no ported test is red at review too, not only at units", () => {
    const { run } = runFolder({ units: [{ id: "u1", pass: 1, state: "committed abc1234", brief: brief() }], launches: [implement([])] });
    assert.ok(gate(run, "p1-review", opts).some((p) => p.includes("no PARITY line of a u1 launch names its ported test")));
  });

  test("6 — every inventory line that does not parse is red at Decompose", () => {
    const bad = [
      "| leads | `apps/api/src/leads/my score.test.ts:40` | score › spaced path |",
      "| leads | `apps/api/src/leads/score.test.ts` | score › no line |",
      "| lead scoring | `apps/api/src/leads/score.test.ts:50` | score › spaced slice |",
      "",
      "| slice | file:line | describe › it |",
      "|---|---|---|",
      "| leads | `apps/api/src/leads/score.test.ts:60` | score › second table |",
    ];
    const { run } = runFolder({ rows: bad });
    const problems = gate(run, "p1-decompose", { exists: always }).filter((p) => p.includes("tests.md:"));
    assert.equal(problems.length, 5, problems.join("\n"));
  });

  test("7 — whys naming a stage or a decision pass, stubs do not; a Source heading is matched exactly", () => {
    for (const why of ["stage 3", "стадия 3", "по D12"]) {
      const { run } = runFolder({ journal: [`| 1 | p1-decompose | ${EMPTY} | drop | ${why} | u1 ${EMPTY} |`] });
      assert.equal(gate(run, "p1-decompose", { exists: always }).filter((p) => p.includes("is no reason")).length, 0, why);
    }
    for (const why of ["as is", "see above", "см. выше"]) {
      const { run } = runFolder({ journal: [`| 1 | p1-decompose | ${EMPTY} | drop | ${why} | u1 ${EMPTY} |`] });
      assert.ok(gate(run, "p1-decompose", { exists: always }).some((p) => p.includes("is no reason")), why);
    }
    const sourceRed = (tail) => gate(runFolder({ source: false, tail }).run, "p1-decompose", { exists: always }).some((p) => p.startsWith("common.md has a Source section"));
    assert.equal(sourceRed("## Source code layout\n\nsrc/ holds it all.\n"), false);
    assert.equal(sourceRed("- an example:\n\n  ```md\n### Source\n  ```\n"), false);
    assert.equal(sourceRed("## SOURCE\n\n- repo: x\n"), true);
  });

  test("8 — source.md says one thing about ported-earlier and about a whole slice", () => {
    const text = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "source.md"), "utf8").replace(/\r\n/g, "\n");
    assert.equal(text.includes("found at HEAD instead"), false);
    assert.equal(text.includes("A whole slice taken out of the run"), false);
  });
});

describe("probes of the fifth audit — each red on df6adf8", () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const cli = (...args) => spawnSync(process.execPath, [join(here, "fsl.mjs"), ...args], { encoding: "utf8" });
  const opts = { commitMessage: landed, exists: always, changed: () => ["src/server/leads/score.test.ts"] };
  const portedHot = implement([`- \`${HOT}\` — ported \`src/server/leads/score.test.ts:40\``]);
  const afterDecompose = ["p1-map", "p1-spike", "p1-decompose", "p1-units"];
  const throughVerdict = [...afterDecompose, "p1-review", "p1-fix", "p1-verdict"];
  const twoPasses = ["p1-map", "p1-spike", "p1-decompose", "p1-units", "p1-review", "p1-fix", "p1-assess", "p2-decompose"];
  const passes = (dir) => writeFileSync(join(dir, "passes.md"), "| pass | critical+major | outcome | why |\n|---|---|---|---|\n| p1 | 1 | next | one parity finding |\n");
  const drafted = [{ id: "u1", pass: 1, state: "drafted", brief: brief() }];
  const emptied = brief({ slice: "—", parity: ["- —"] });
  const gateLines = (dir) => readFileSync(join(dir, "gates.jsonl"), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
  const editGates = (dir, fn) => writeFileSync(join(dir, "gates.jsonl"), fn(gateLines(dir)).map((g) => JSON.stringify(g)).join("\n") + "\n");
  const parityProblems = (run, stage) => gate(run, stage, opts).filter((p) => p.includes("critic parity"));

  test("1 — a second green Decompose after Units only adds to the snapshot", () => {
    const { dir } = runFolder({ ...committed(), atDecompose: drafted });
    writeFileSync(join(dir, "units", "u1", "brief.md"), emptied);
    assert.equal(cli("gate", dir, "p1-decompose").status, 0);
    assert.deepEqual(Object.keys(gateLines(dir).at(-1).parity.rows), [HOT, EMPTY]);
    assert.ok(gate(reload(dir), "p1-units", opts).some((p) => p.startsWith(`${HOT}: port in u1 at p1-decompose, no line now`)));
  });

  test("2 — a row moved into a drafted unit, a unit in an unknown state, are red after Units", () => {
    const moved = runFolder({
      gates: [...afterDecompose, "p1-review"],
      atDecompose: drafted,
      units: [
        { id: "u1", pass: 1, state: "committed abc1234", brief: brief({ parity: [`- \`${EMPTY}\` drop j1`] }) },
        { id: "u3", pass: 1, state: "drafted", brief: brief({ parity: [`- \`${HOT}\` port`] }) },
      ],
      launches: [implement([])],
    });
    assert.ok(gate(moved.run, "p1-review", opts).some((p) => p.startsWith("u3: drafted past p1-units")));
    for (const state of ["abandoned", "landed abc1234"]) {
      const { run } = runFolder({ gates: [...afterDecompose, "p1-review"], units: [{ id: "u1", pass: 1, state, brief: brief() }], launches: [implement([])] });
      assert.ok(gate(run, "p1-review", opts).some((p) => p.startsWith(`u1: state "${state}" is none of units.md's`)), state);
    }
  });

  test("2 — at Integrate a unit of a pass that never ran covers no row", () => {
    const { run } = runFolder({
      gates: throughVerdict,
      units: [
        { id: "u1", pass: 1, state: "committed abc1234", brief: brief() },
        { id: "u2", pass: 3, state: "planned", brief: brief({ parity: [`- \`${HOT}\` port`] }) },
      ],
      launches: [implement([])],
    });
    const problems = gate(run, "integrate", opts);
    assert.ok(problems.some((p) => p.includes("no PARITY line of a u1 launch")), problems.join("\n"));
    assert.equal(problems.filter((p) => p.startsWith("u2")).length, 0);
  });

  test("3 — a fate changed after the parity critic holds Fix, Verdict and Integrate until the critic sees it", () => {
    for (const stage of ["p1-fix", "p1-verdict", "integrate"]) {
      const { dir } = runFolder({ ...committed(), gates: throughVerdict, launches: [portedHot, critic("p1-review", "critic code"), critic("p1-review", "critic parity leads")] });
      assert.deepEqual(parityProblems(reload(dir), stage), [], stage);
      writeFileSync(join(dir, "units", "u1", "brief.md"), brief({ parity: [`- \`${HOT}\` ported-earlier \`src/shared/format.test.ts:12\``, `- \`${EMPTY}\` drop j1`] }));
      const after = parityProblems(reload(dir), stage);
      assert.equal(after.length, 1, stage);
      assert.ok(after[0].includes("carries ROWS:"), after[0]);
    }
  });

  test("4 — a snapshot edited in gates.jsonl is red: rows emptied, a key deleted, the decompose line deleted in pass 2", () => {
    for (const edit of [(g) => ({ ...g, parity: { ...g.parity, rows: {} } }), (g) => ({ ...g, parity: { ...g.parity, rows: { [EMPTY]: g.parity.rows[EMPTY] } } })]) {
      const { dir } = runFolder(committed());
      editGates(dir, (lines) => lines.map((g) => (g.stage === "p1-decompose" ? edit(g) : g)));
      assert.ok(gate(reload(dir), "p1-units", opts).some((p) => p.includes("gates.jsonl")));
    }
    const { dir } = runFolder({ N: 2, gates: [...twoPasses, "p2-units"], units: [{ id: "u1", pass: 1, state: "committed abc1234", brief: brief() }, { id: "u2", pass: 2, state: "committed abc5678", brief: emptied }], launches: [portedHot] });
    passes(dir);
    assert.deepEqual(gate(reload(dir), "p2-units", opts).filter((p) => p.includes("gates.jsonl")), []);
    editGates(dir, (lines) => lines.filter((g) => g.stage !== "p1-decompose"));
    assert.ok(gate(reload(dir), "p2-units", opts).some((p) => p.includes("gates.jsonl")));
  });

  test("5 — a rebuilt inventory is rekeyed by file and describe › it; an unmatched row is named, mapped by hand", () => {
    const moved = (key) => key.replace(/:(\d+)$/, (_, n) => `:${Number(n) + 2}`);
    const rebuilt = (name = "score › a hot lead outranks a cold one") =>
      ["| slice | file:line | describe › it |", "|---|---|---|", `| leads | \`${moved(HOT)}\` | ${name} |`, `| leads | \`${moved(EMPTY)}\` | score › an empty phone scores zero |`, `| auth | \`${SESSION}\` | session › expires after a day |`, ""].join("\n");
    const { dir, repo } = runFolder(committed());
    writeFileSync(join(repo, "docs", "inventory", "tests.md"), rebuilt());
    assert.ok(gate(reload(dir), "p1-units", opts).some((p) => p.startsWith("the inventory was rebuilt: 2 rows")));
    const { map, problems } = rekey(dir);
    assert.deepEqual(problems, []);
    assert.deepEqual(Object.fromEntries(Object.entries(map).map(([k, v]) => [k, v.key])), { [HOT]: moved(HOT), [EMPTY]: moved(EMPTY) });
    assert.ok(readFileSync(join(dir, "units", "u1", "brief.md"), "utf8").includes(`\`${moved(HOT)}\` port`));
    assert.deepEqual(gate(reload(dir), "p1-units", opts), []);
    cli("gate", dir, "p1-units");
    assert.deepEqual(gate(reload(dir), "p1-units", opts).filter((p) => p.includes("gates.jsonl")), []);

    const renamed = runFolder(committed());
    writeFileSync(join(renamed.repo, "docs", "inventory", "tests.md"), rebuilt("score › hot beats cold"));
    const red = rekey(renamed.dir);
    assert.ok(red.problems.some((p) => p.startsWith(`${HOT} «score › a hot lead outranks a cold one» — no row of`)), red.problems.join("\n"));
    assert.equal(existsSync(join(renamed.dir, "parity", "rekey.jsonl")), false);
    assert.deepEqual(rekey(renamed.dir, [`${HOT}=${moved(HOT)}=renamed`]).problems, []);
    assert.deepEqual(gate(reload(renamed.dir), "p1-units", opts), []);
  });

  test("6 — a blocked unit's port names defer as the way out", () => {
    const { run } = runFolder({ units: [{ id: "u1", pass: 1, state: "blocked: the scorer needs a queue", brief: brief() }] });
    const line = gate(run, "p1-units", opts).find((p) => p.startsWith(`${HOT}: port in u1, which is blocked`));
    assert.ok(line.includes("defer j<n>") && !line.includes("port it in a later pass"), line);
  });

  test("7 — a parity report counts only with the part's seal and a verdict per row, a lost one with its finding", () => {
    const parts = (findings, rows) => {
      const { dir, run } = runFolder({ ...committed(), launches: [portedHot, critic("p1-review", "critic code")] });
      const [part] = parityParts(run, "p1-review");
      const body = criticReport("parity").replace("FINDINGS (ranked):\n- —", `FINDINGS (ranked):\n${findings}`);
      const report = rows === null ? "LENS: parity\n" : body.replace("LENS: parity", ["LENS: parity", ...rows(part)].join("\n"));
      writeFileSync(join(dir, "reports", "p1-review-critic-parity-leads.md"), report);
      writeFileSync(join(dir, "launches.md"), `${readFileSync(join(dir, "launches.md"), "utf8")}| p1-review-critic-parity-leads | p1-review | fsloop-critic | critic parity leads | reports/p1-review-critic-parity-leads.md |\n`);
      return parityProblems(reload(dir), "p1-review");
    };
    const finding = `- parity-1 [parity] major high — src/server/leads/score.test.ts:40 — source: ${HOT} — port the tie case`;
    assert.equal(parts("- —", null).length, 1);
    assert.equal(parts("- —", (p) => [`ROWS: ${p.seal}`]).length, 1);
    assert.equal(parts("- —", (p) => rowsBlock(p, () => "lost parity-1")).length, 1);
    assert.equal(parts("- —", (p) => rowsBlock(p, () => "settled")).length, 1);
    assert.deepEqual(parts(finding, (p) => rowsBlock(p, () => "lost parity-1")), []);
    assert.deepEqual(parts("- —", (p) => rowsBlock(p)), []);
  });

  test("8 — a port's ported test must be a test file", () => {
    const { run } = runFolder(committed([`- \`${HOT}\` — ported \`src/auth.ts:1\``]));
    assert.deepEqual(gate(run, "p1-units", { ...opts, changed: () => ["src/auth.ts"] }), [`u1: Parity ${HOT} — ported src/auth.ts:1, which is no test file (*.test.*, *.spec.*, tests/, __tests__/)`]);
  });

  test("9 — effort or a bare decision is no why; a ground is", () => {
    const red = (why) => gate(runFolder({ journal: [`| 1 | p1-decompose | ${EMPTY} | drop | ${why} | u1 ${EMPTY} |`] }).run, "p1-decompose", { exists: always }).some((p) => p.includes("is no reason"));
    for (const why of ["no time", "too big", "drop it", "так решили", "нет времени, перенесём потом", "too big for this run", "time-boxed out"]) assert.equal(red(why), true, why);
    for (const why of ["stage 3 takes it", "the new form makes the phone required", "по D12"]) assert.equal(red(why), false, why);
  });

  test("10 — a drop is a journal row of its own; the texts say what the gates do", () => {
    const both = brief({ parity: [`- \`${HOT}\` drop j1`, `- \`${EMPTY}\` drop j1`] });
    const { run } = runFolder({ units: [{ id: "u1", pass: 1, state: "drafted", brief: both }], journal: [`| 1 | p1-decompose | leads | drop | the goal retires lead scoring | u1 ${HOT} ${EMPTY} |`] });
    assert.ok(gate(run, "p1-decompose", { exists: always }).some((p) => p.includes("each drop or defer is a journal row of its own")));
    const text = (path) => readFileSync(join(here, path), "utf8").replace(/\r\n/g, "\n");
    const source = text("source.md");
    assert.equal(source.includes("lost until a pass ports them"), false);
    assert.equal(source.includes("port it in a later pass"), false);
    assert.ok(source.includes("fsl.mjs rekey"));
    assert.ok(/Block\.\*\*[^\n]*defer j<n>/.test(text("SKILL.md")));
    assert.ok(text("../../agents/fsloop-critic.md").includes("ROWS:"));
  });
});

describe("probes of the sixth audit — each red on 817a949", () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const cli = (...args) => spawnSync(process.execPath, [join(here, "fsl.mjs"), ...args], { encoding: "utf8" });
  const opts = { commitMessage: landed, exists: always, changed: () => ["src/server/leads/score.test.ts"] };
  const portedHot = implement([`- \`${HOT}\` — ported \`src/server/leads/score.test.ts:40\``]);
  const throughVerdict = ["p1-map", "p1-spike", "p1-decompose", "p1-units", "p1-review", "p1-fix", "p1-verdict"];
  const twoPasses = ["p1-map", "p1-spike", "p1-decompose", "p1-units", "p1-review", "p1-fix", "p1-assess", "p2-decompose"];
  const passes = (dir) => writeFileSync(join(dir, "passes.md"), "| pass | critical+major | outcome | why |\n|---|---|---|---|\n| p1 | 1 | next | one parity finding |\n");
  const emptied = brief({ slice: "—", parity: ["- —"] });
  const drafted = [{ id: "u1", pass: 1, state: "drafted", brief: brief() }];
  const journal = (dir, rows) => writeFileSync(join(dir, "journal.md"), ["| # | stage | question | decision | why | refs |", "|---|---|---|---|---|---|", ...rows, ""].join("\n"));
  const lostHot = `- parity-1 [parity] major high — src/server/leads/score.test.ts:40 — source: ${HOT} — port the tie case`;
  const lostCritic = { ...critic("p1-review", "critic parity leads"), readsRows: false, report: criticReport("parity").replace("FINDINGS (ranked):\n- —", `FINDINGS (ranked):\n${lostHot}`) };
  const decide = (dir, decision, ref, why = "the goal keeps it") =>
    writeFileSync(join(dir, "findings", "p1-review.md"), `| finding | decision | ref | repeat | why | severity | evidence |\n|---|---|---|---|---|---|---|\n| ${lostCritic.id}#parity-1 | ${decision} | ${ref} | — | ${why} | major | — |\n`);

  test("F1 — a Decompose gated again while Units runs keeps every row of the first", () => {
    const { dir } = runFolder({ ...committed(), gates: ["p1-map", "p1-spike", "p1-decompose"], atDecompose: drafted });
    writeFileSync(join(dir, "units", "u1", "brief.md"), emptied);
    assert.equal(cli("gate", dir, "p1-decompose").status, 0);
    assert.ok(gate(reload(dir), "p1-units", opts).some((p) => p.startsWith(`${HOT}: port in u1 at p1-decompose, no line now`)));

    const replan = runFolder({ gates: ["p1-map", "p1-spike", "p1-decompose"] });
    writeFileSync(join(replan.dir, "units", "u1", "brief.md"), brief({ parity: [`- \`${EMPTY}\` drop j1`] }));
    assert.equal(cli("gate", replan.dir, "p1-decompose").status, 1);
    journal(replan.dir, [DROP_ROW, `| 2 | p1-decompose | ${HOT} | defer | stage 3 of the plan takes hot scoring | u1 ${HOT} |`]);
    assert.equal(cli("gate", replan.dir, "p1-decompose").status, 0);
  });

  test("F2 — a stray later gate does not lock Decompose", () => {
    const stray = runFolder({ gates: ["p1-map", "p1-spike", { stage: "integrate", green: false, problems: ["x"] }, { stage: "p2-map", green: false, problems: ["x"] }] });
    assert.equal(cli("gate", stray.dir, "p1-decompose").status, 0);
  });

  test("F3 — a snapshot-less Decompose of pass 1 is gated again in pass 2", () => {
    const old = runFolder({
      N: 2,
      gates: twoPasses.map((g) => (g === "p1-decompose" ? { stage: g } : g)),
      units: [{ id: "u1", pass: 1, state: "committed abc1234", brief: brief() }, { id: "u2", pass: 2, state: "drafted", brief: emptied }],
      launches: [portedHot],
    });
    passes(old.dir);
    assert.ok(gate(reload(old.dir), "p2-units", opts).some((p) => p.includes("recorded no parity snapshot")));
    assert.equal(cli("gate", old.dir, "p1-decompose").status, 0);
    assert.equal(gate(reload(old.dir), "p2-units", opts).filter((p) => p.includes("snapshot") || p.includes("gates.jsonl")).length, 0);
  });

  test("F4 — rekey leaves out a row released after its test left the inventory", () => {
    const { dir, repo } = runFolder(committed());
    const moved = HOT.replace(/:12$/, ":14");
    writeFileSync(join(repo, "docs", "inventory", "tests.md"), ["| slice | file:line | describe › it |", "|---|---|---|", `| leads | \`${moved}\` | score › a hot lead outranks a cold one |`, `| auth | \`${SESSION}\` | session › expires after a day |`, ""].join("\n"));
    writeFileSync(join(dir, "units", "u1", "brief.md"), brief({ parity: [`- \`${HOT}\` port`] }));
    journal(dir, [DROP_ROW, `| 2 | p1-units | ${EMPTY} gone from the inventory | drop | the source no longer tests an empty phone | u1 ${EMPTY} |`]);
    const { map, problems } = rekey(dir);
    assert.deepEqual(problems, []);
    assert.deepEqual(Object.keys(map), [HOT]);
    assert.deepEqual(gate(reload(dir), "p1-units", opts), []);
  });

  test("F5 — a parity finding is fix or open, or let go only by a drop or defer of its row; until fixed and rechecked the row is open", () => {
    const base = () => {
      const r = runFolder({ ...committed(), gates: throughVerdict, launches: [portedHot, critic("p1-review", "critic code"), lostCritic] });
      mkdirSync(join(r.dir, "findings"), { recursive: true });
      return r;
    };
    const red = (dir) => gate(reload(dir), "p1-fix", opts).some((p) => p.startsWith(`${lostCritic.id}#parity-1: a lost behaviour decided`));
    const a = base();
    decide(a.dir, "candidate", "—", "later");
    assert.equal(red(a.dir), true);
    decide(a.dir, "dropped", "j1");
    assert.equal(red(a.dir), true);
    journal(a.dir, [DROP_ROW, `| 2 | p1-review | ${HOT} | drop | the goal retires hot scoring | u1 ${HOT} |`]);
    decide(a.dir, "dropped", "j2");
    assert.equal(red(a.dir), false);
    const b = base();
    decide(b.dir, "fix", "u1");
    assert.equal(red(b.dir), false);
    assert.deepEqual(parityCoverage(reload(b.dir)), [{ slice: "leads", rows: 2, ported: 0, portedEarlier: 0, dropped: 1, deferred: 0, open: 1 }]);
  });

  test("M4 — a pair by hand keeps the slice and the file, and a new name only when confirmed", () => {
    const { dir, repo } = runFolder({ ...committed(), rows: [`| auth | \`apps/api/src/auth/other.test.ts:3\` | session › renamed elsewhere |`] });
    const moved = HOT.replace(/:12$/, ":14");
    writeFileSync(
      join(repo, "docs", "inventory", "tests.md"),
      ["| slice | file:line | describe › it |", "|---|---|---|", `| leads | \`${moved}\` | score › hot beats cold |`, `| leads | \`${EMPTY}\` | score › an empty phone scores zero |`, `| leads | \`apps/api/src/leads/other.test.ts:5\` | score › hot beats cold |`, `| auth | \`${SESSION}\` | session › expires after a day |`, ""].join("\n"),
    );
    assert.equal(rekey(dir, [`${HOT}=${SESSION}=renamed`]).problems.length > 0, true);
    assert.equal(rekey(dir, [`${HOT}=apps/api/src/leads/other.test.ts:5=renamed`]).problems.length > 0, true);
    assert.equal(rekey(dir, [`${HOT}=${moved}`]).problems.length > 0, true);
    assert.deepEqual(rekey(dir, [`${HOT}=${moved}=renamed`]).problems, []);
  });

  test("M5 — committed counts only on a commit of this run git shows, and a silent git is red", () => {
    const shown = (sha) => (start, args) => (args[0] === "log" ? [sha, AT, "feat", "feat\n\nFsloop-Run: abc12345\nFsloop-Step: u1 1/1\n"].join("\x1f") : null);
    const none = runFolder({ ...committed(), git: (start, args) => (args[0] === "log" ? "" : null) });
    assert.ok(gate(none.run, "p1-review", opts).some((p) => p.startsWith("u1: committed, but no commit with Fsloop-Run: abc12345")));
    const silent = runFolder({ ...committed(), git: () => null });
    assert.ok(gate(silent.run, "p1-review", opts).some((p) => p.startsWith("u1: committed, but git gave no commits")));
    const blind = runFolder(committed());
    assert.ok(gate(blind.run, "p1-units", { ...opts, changed: () => null }).some((p) => p.includes("git gave no file list")));
    const phantom = runFolder({
      gates: throughVerdict,
      git: shown("abc1234"),
      units: [{ id: "u1", pass: 1, state: "committed abc1234", brief: brief() }, { id: "u2", pass: 3, state: "committed abc9999", brief: brief({ parity: [`- \`${HOT}\` port`] }) }],
      launches: [implement([]), { ...implement([`- \`${HOT}\` — ported \`src/server/leads/score.test.ts:40\``], "u2"), id: "p3-units-u2-implement", stage: "p3-units" }],
    });
    assert.ok(gate(phantom.run, "integrate", opts).some((p) => p.includes("no PARITY line of a u1 launch")));
  });

  test("M6 — a pass-2 port line taken out does not fall back to pass 1's defer", () => {
    const defer = `| 2 | p1-decompose | ${HOT} | defer | stage 3 of the plan takes hot scoring | u1 ${HOT} |`;
    const u1 = { id: "u1", pass: 1, state: "committed abc1234", brief: brief({ parity: [`- \`${HOT}\` defer j2`, `- \`${EMPTY}\` drop j1`] }) };
    const { dir } = runFolder({
      N: 2,
      gates: [...twoPasses, "p2-units"],
      journal: [DROP_ROW, defer],
      atDecompose: [u1, { id: "u2", pass: 2, state: "drafted", brief: brief({ parity: [`- \`${HOT}\` port`] }) }],
      units: [u1, { id: "u2", pass: 2, state: "committed abc5678", brief: emptied }],
      launches: [implement([])],
    });
    passes(dir);
    assert.ok(gate(reload(dir), "p2-units", opts).some((p) => p.startsWith(`${HOT}: port in u2 at p2-decompose, no line now`)));
  });

  test("m1 — a release counts only at a stage the run can have", () => {
    const at = (stage) => {
      const { dir } = runFolder({ ...committed(), atDecompose: drafted });
      writeFileSync(join(dir, "units", "u1", "brief.md"), brief({ parity: [`- \`${EMPTY}\` drop j1`] }));
      journal(dir, [DROP_ROW, `| 2 | ${stage} | ${HOT} | drop | the goal retires hot scoring | u1 ${HOT} |`]);
      return gate(reload(dir), "p1-units", opts).some((p) => p.startsWith(`${HOT}:`));
    };
    assert.equal(at("p9-units"), true);
    assert.equal(at("p1-assess"), true);
    assert.equal(at("p1-units"), false);
  });

  test("m2 — a blocked re-port of a row pass 1 deferred names the release as its way out", () => {
    const defer = `| 2 | p1-decompose | ${HOT} | defer | stage 3 of the plan takes hot scoring | u1 ${HOT} |`;
    const { run } = runFolder({
      N: 2,
      gates: [...twoPasses, "p2-units"],
      journal: [DROP_ROW, defer],
      units: [{ id: "u1", pass: 1, state: "committed abc1234", brief: brief({ parity: [`- \`${HOT}\` defer j2`, `- \`${EMPTY}\` drop j1`] }) }, { id: "u2", pass: 2, state: "blocked: no seam", brief: brief({ parity: [`- \`${HOT}\` port`] }) }],
      launches: [implement([])],
    });
    const line = gate(run, "p2-units", opts).find((p) => p.startsWith(`${HOT}: port in u2, which is blocked`));
    assert.ok(line?.includes("take the line out and release the row"), line);
  });

  test("m3 — a why is read by words: effort and say-so are no reason, a ground that shares their letters is", () => {
    const red = (why) => gate(runFolder({ journal: [`| 1 | p1-decompose | ${EMPTY} | drop | ${why} | u1 ${EMPTY} |`] }).run, "p1-decompose", { exists: always }).some((p) => p.includes("is no reason"));
    for (const why of ["the new effort score replaces it", "the session lived too long in the source", "зелень статусов теперь считает сервер", "старый воркер не успевал, очередь это снимает"]) assert.equal(red(why), false, why);
    assert.equal(red("because the goal said so"), true);
  });

  test("m4 — a parity report counts at its stage or later", () => {
    const later = runFolder({
      ...committed(),
      N: 2,
      gates: [...twoPasses, "p2-units", "p2-review", "p2-fix"],
      units: [{ id: "u1", pass: 1, state: "committed abc1234", brief: brief() }, { id: "u2", pass: 2, state: "committed abc5678", brief: emptied }],
      launches: [portedHot, critic("p1-review", "critic parity leads"), critic("p1-assess", "critic parity leads")],
    });
    passes(later.dir);
    assert.ok(gate(reload(later.dir), "p2-assess", opts).some((p) => p.startsWith('p2-assess: no "critic parity leads" report')));
  });

  test("m5 — kept is no verdict on a row with no fate", () => {
    const fateless = runFolder({ ...committed(), N: 2, rows: [`| leads | \`apps/api/src/leads/score.test.ts:50\` | score › a row Decompose never saw |`], gates: [...twoPasses.slice(0, 6)], launches: [portedHot, critic("p1-review", "critic parity leads"), critic("p1-assess", "critic parity leads")] });
    assert.ok(gate(fateless.run, "p1-assess", opts).some((p) => p.startsWith('p1-assess: no "critic parity leads" report of fsloop-critic carries ROWS')));
  });

  test("m6 — source.md states the threat model and the frozen snapshot", () => {
    const source = readFileSync(join(here, "source.md"), "utf8").replace(/\r\n/g, "\n");
    assert.ok(source.includes("## Threat model"));
    assert.equal(source.includes("gated again in its pass"), false);
    assert.equal(source.includes("freezes** at the pass's first units gate"), false);
  });
});

describe("probes of the seventh audit — each red on 636bb6d", () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const opts = { commitMessage: landed, exists: always, changed: () => ["src/server/leads/score.test.ts"] };
  const portedHot = implement([`- \`${HOT}\` — ported \`src/server/leads/score.test.ts:40\``]);
  const throughVerdict = ["p1-map", "p1-spike", "p1-decompose", "p1-units", "p1-review", "p1-fix", "p1-verdict"];
  const twoPasses = ["p1-map", "p1-spike", "p1-decompose", "p1-units", "p1-review", "p1-fix", "p1-assess", "p2-decompose"];
  const passes = (dir, outcome = "next") => writeFileSync(join(dir, "passes.md"), `| pass | critical+major | outcome | why |\n|---|---|---|---|\n| p1 | 0 | ${outcome} | the pass held |\n`);
  const journal = (dir, rows) => writeFileSync(join(dir, "journal.md"), ["| # | stage | question | decision | why | refs |", "|---|---|---|---|---|---|", ...rows, ""].join("\n"));
  const moved = HOT.replace(/:12$/, ":14");
  const shifted = ["| slice | file:line | describe › it |", "|---|---|---|", `| leads | \`${moved}\` | score › a hot lead outranks a cold one |`, `| leads | \`${EMPTY}\` | score › an empty phone scores zero |`, `| auth | \`${SESSION}\` | session › expires after a day |`, ""].join("\n");
  const lostCritic = {
    ...critic("p1-review", "critic parity leads"),
    readsRows: false,
    report: criticReport("parity").replace("FINDINGS (ranked):\n- —", `FINDINGS (ranked):\n- parity-1 [parity] major high — src/server/leads/score.test.ts:40 — source: ${HOT} — port the tie case`),
  };
  const decide = (dir, decision, ref) => {
    mkdirSync(join(dir, "findings"), { recursive: true });
    writeFileSync(join(dir, "findings", "p1-review.md"), `| finding | decision | ref | repeat | why | severity | evidence |\n|---|---|---|---|---|---|---|\n| ${lostCritic.id}#parity-1 | ${decision} | ${ref} | — | the goal keeps it | major | — |\n`);
  };
  const dropHot = `| 2 | p1-review | ${HOT} | drop | the goal retires hot scoring | u1 ${HOT} |`;

  test("1 — a ported test the run's tree no longer holds, or a line past its end, holds the gates", () => {
    const { run } = runFolder({ ...committed(), gates: throughVerdict });
    assert.ok(gate(run, "integrate", { ...opts, exists: () => false }).some((p) => p.startsWith(`u1: Parity ${HOT} — ported src/server/leads/score.test.ts:40, which the run's tree`)));
    assert.ok(gate(run, "p1-units", { ...opts, exists: () => 30 }).some((p) => p.includes("past the file's 30 lines")));
    assert.equal(gate(run, "p1-units", { ...opts, exists: () => 120 }).length, 0);
  });

  test("2 — a pass that does not re-list a row keeps pass 1's drop", () => {
    const { dir } = runFolder({
      N: 2,
      gates: [...twoPasses, "p2-units"],
      units: [
        { id: "u1", pass: 1, state: "committed abc1234", brief: brief() },
        { id: "u2", pass: 2, state: "committed abc5678", brief: brief({ parity: [`- \`${HOT}\` port`] }) },
      ],
      launches: [portedHot, { ...implement([`- \`${HOT}\` — ported \`src/server/leads/score.test.ts:40\``], "u2"), id: "p2-units-u2-implement", stage: "p2-units" }],
    });
    passes(dir);
    assert.equal(gate(reload(dir), "p2-units", opts).filter((p) => p.startsWith(EMPTY)).length, 0);
  });

  test("3 — a row the inventory gained after Decompose holds the gates until a Decompose takes it", () => {
    const { dir, repo } = runFolder(committed());
    writeFileSync(join(repo, "docs", "inventory", "tests.md"), inventory([`| leads | \`apps/api/src/leads/score.test.ts:31\` | score › an empty phone scores zero, second half |`]));
    assert.ok(gate(reload(dir), "p1-units", opts).some((p) => p.startsWith("1 rows of") && p.includes("in no snapshot")));
  });

  test("decision — a snapshot an older fsl.mjs replaced names the restart from Decompose", () => {
    const { dir } = runFolder(committed());
    const lines = readFileSync(join(dir, "gates.jsonl"), "utf8").trim().split("\n").map((l) => JSON.parse(l));
    const decompose = lines.find((g) => g.stage === "p1-decompose");
    const replaced = { stage: "p1-decompose", green: true, at: AT, problems: [], parity: { slices: ["leads"], rows: { [EMPTY]: decompose.parity.rows[EMPTY] } } };
    writeFileSync(join(dir, "gates.jsonl"), [...lines, replaced].map((g) => JSON.stringify(g)).join("\n") + "\n");
    assert.ok(gate(reload(dir), "p1-units", opts).some((p) => p.includes("starts over from Decompose")));
    assert.ok(readFileSync(join(here, "source.md"), "utf8").includes("before `636bb6d`"));
  });

  const declinedRun = () => {
    const r = runFolder({ ...committed(), gates: throughVerdict, launches: [portedHot, lostCritic] });
    journal(r.dir, [DROP_ROW, dropHot]);
    decide(r.dir, "declined", "j2");
    return r;
  };

  test("5 — after rekey a parity finding decided fix still keeps its row open", () => {
    const fixed = runFolder({ ...committed(), gates: throughVerdict, launches: [portedHot, lostCritic] });
    decide(fixed.dir, "fix", "u1");
    writeFileSync(join(fixed.repo, "docs", "inventory", "tests.md"), shifted);
    assert.deepEqual(rekey(fixed.dir).problems, []);
    assert.deepEqual(parityCoverage(reload(fixed.dir)), [{ slice: "leads", rows: 2, ported: 0, portedEarlier: 0, dropped: 1, deferred: 0, open: 1 }]);
  });

  test("5 — a row whose parity finding is declined by its own drop counts dropped", () => {
    assert.deepEqual(parityCoverage(reload(declinedRun().dir)), [{ slice: "leads", rows: 2, ported: 0, portedEarlier: 0, dropped: 2, deferred: 0, open: 0 }]);
  });

  test("7 — rekey keeps a lawful declined lawful", () => {
    const declined = declinedRun();
    writeFileSync(join(declined.repo, "docs", "inventory", "tests.md"), shifted);
    assert.deepEqual(rekey(declined.dir).problems, []);
    assert.equal(gate(reload(declined.dir), "p1-fix", opts).filter((p) => p.includes("a lost behaviour decided")).length, 0);
  });

  const deferHot = `| 2 | p1-decompose | ${HOT} | defer | stage 3 of the plan takes hot scoring | u1 ${HOT} |`;
  const u1Defers = { id: "u1", pass: 1, state: "committed abc1234", brief: brief({ parity: [`- \`${HOT}\` defer j2`, `- \`${EMPTY}\` drop j1`] }) };
  const u2Ports = { id: "u2", pass: 2, state: "drafted", brief: brief({ parity: [`- \`${HOT}\` port`] }) };
  const emptied = brief({ slice: "—", parity: ["- —"] });

  test("final 1 (P2a) — a unit gone from units.md does not undo its pass's re-listing", () => {
    const { dir } = runFolder({ N: 2, gates: [...twoPasses, "p2-units"], journal: [DROP_ROW, deferHot], atDecompose: [u1Defers, u2Ports], units: [u1Defers], launches: [implement([])] });
    passes(dir);
    assert.ok(gate(reload(dir), "p2-units", opts).some((p) => p.startsWith(`${HOT}: port in u2 at p2-decompose, no line now`)));
  });

  test("final 1 (P2b) — a later pass that names the slice keeps the re-listing pass's release", () => {
    const { dir } = runFolder({ N: 3, gates: twoPasses, journal: [DROP_ROW, deferHot], atDecompose: [u1Defers, u2Ports], units: [u1Defers, { ...u2Ports, state: "blocked: no seam", brief: emptied }], launches: [implement([])] });
    journal(dir, [DROP_ROW, deferHot, `| 3 | p2-units | ${HOT} | drop | the goal retires hot scoring | u2 ${HOT} |`]);
    writeFileSync(join(dir, "units.md"), `${readFileSync(join(dir, "units.md"), "utf8")}| u3 | 3 | drafted | — | u3 |\n`);
    mkdirSync(join(dir, "units", "u3"), { recursive: true });
    writeFileSync(join(dir, "units", "u3", "brief.md"), brief({ parity: ["- —"] }));
    const run = reload(dir);
    for (const stage of ["p2-units", "p2-review", "p2-fix", "p2-assess", "p3-decompose"]) run.gates.push(gateRecord(run, stage, [], AT));
    writeFileSync(join(dir, "gates.jsonl"), run.gates.map((g) => JSON.stringify(g)).join("\n") + "\n");
    assert.deepEqual(parityCoverage(reload(dir)), [{ slice: "leads", rows: 2, ported: 0, portedEarlier: 0, dropped: 2, deferred: 0, open: 0 }]);
  });

  test("final 2 — a ported-earlier test the run's tree deleted or cut holds the gates", () => {
    const b = brief({ parity: [`- \`${HOT}\` ported-earlier \`src/server/leads/score.test.ts:40\``, `- \`${EMPTY}\` drop j1`] });
    const { run } = runFolder({ units: [{ id: "u1", pass: 1, state: "committed abc1234", brief: b }], launches: [implement([])] });
    const tree = (head) => ({ ...opts, exists: (t, rev) => (rev === "HEAD" ? head : 120) });
    assert.deepEqual(gate(run, "p1-units", tree(120)), []);
    assert.ok(gate(run, "p1-units", tree(false)).some((p) => p.startsWith(`u1: Parity ${HOT} — ported-earlier src/server/leads/score.test.ts:40, which the run's tree`)));
    assert.ok(gate(run, "p1-units", tree(10)).some((p) => p.includes("past the file's 10 lines in the run's tree")));
  });

  test("final 3 (P3c) — a slice added to a brief after Decompose holds the gates until Decompose is gated again", () => {
    const { dir } = runFolder({ ...committed(), atDecompose: [{ id: "u1", pass: 1, state: "drafted", brief: brief() }] });
    writeFileSync(join(dir, "units", "u1", "brief.md"), brief({ slice: "leads, auth" }));
    assert.ok(gate(reload(dir), "p1-units", opts).some((p) => p.startsWith("u1: Slice auth is in no snapshot")));
  });

  test("6 — a red Decompose of a pass that never began asks no critic of it", () => {
    const { dir } = runFolder({ ...committed(), N: 2, gates: [...twoPasses.slice(0, 7), { stage: "p2-decompose", green: false, problems: ["x"] }] });
    passes(dir, "converged");
    assert.equal(gate(reload(dir), "integrate", opts).filter((p) => p.startsWith("p2-")).length, 0);
  });
});
