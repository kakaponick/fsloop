#!/usr/bin/env node
// The run folder's one reader. `save` files a launch's final block, `gate` checks that a stage is
// done, `build` writes run.json — what a UI reads. Everything here is derived from the run folder's
// files and git; nothing is kept in memory between calls.
import { spawnSync } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const STEPS = ["map", "spike", "decompose", "units", "review", "fix", "verdict", "assess"];
export const DECISIONS = ["fix", "candidate", "dropped", "declined", "duplicate", "open"];
export const OUTCOMES = ["converged", "stalled", "next", "cap"];
export const BRIEF_SECTIONS = ["problem", "seams", "done-criteria", "files", "reference", "settled", "closes"];
const SEVERITIES = ["critical", "major", "minor"];
const NONE = /^(—|-|none)?$/i;

const read = (path) => (existsSync(path) ? readFileSync(path, "utf8") : "");

// ── markdown ──────────────────────────────────────────────────────────────────────────────────

function splitRow(line) {
  const body = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  return body.split(/(?<!\\)\|/).map((c) => c.trim().replace(/\\\|/g, "|"));
}

const isSeparator = (line) => /^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?$/.test(line.trim());

/** Rows of the file's table as objects keyed by lower-cased header; a header is the row above `|---|`. */
export function parseTable(text) {
  const lines = text.split(/\r?\n/);
  const rows = [];
  let header = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line.startsWith("|") || isSeparator(line)) continue;
    if (i + 1 < lines.length && isSeparator(lines[i + 1])) {
      header = splitRow(line).map((h) => h.toLowerCase());
      continue;
    }
    if (!header) continue;
    const cells = splitRow(line);
    rows.push(Object.fromEntries(header.map((h, k) => [h, cells[k] ?? ""])));
  }
  return rows;
}

const cell = (row, ...names) => {
  for (const n of names) if (row[n] !== undefined) return row[n].replace(/[`*]/g, "").trim();
  return "";
};

/** `- ` items under each `NAME:` header of an agent's final block, keyed by NAME. */
export function parseBlock(text) {
  const sections = {};
  let current = null;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trimEnd();
    if (/^```/.test(line.trim())) continue;
    const head = /^([A-Z][A-Z ]*[A-Z])(?: \([^)]*\))?:\s*(.*)$/.exec(line);
    if (head) {
      current = head[1];
      sections[current] = { value: head[2].trim(), items: [] };
      continue;
    }
    const item = /^(?:- |\d+\. )(.*)$/.exec(line);
    if (item && current && !NONE.test(item[1].trim())) sections[current].items.push(item[1].trim());
  }
  return sections;
}

/** One `FINDINGS:` line of fsloop-critic: `<id> [lens] <severity> <confidence> <cause> <file:line> — <rule> — <action>`. */
/** A finding line opens with its id (`code-3`, `craft-12`); any other line under FINDINGS is prose. */
export const FINDING_ID = /^[a-z][\w-]*-\d+$/i;

export function parseFinding(line) {
  const tokens = line.split(/\s+/);
  const id = tokens[0];
  const strict = /^\S+ \[([\w-]+)\] (critical|major|minor) (high|med|low) (\S+) (\S+) — (.+?) — (.+)$/.exec(line);
  if (!strict) return { id, severity: tokens.slice(1, 4).find((t) => SEVERITIES.includes(t)) ?? null, raw: line };
  const [, category, severity, confidence, cause, location, rule, action] = strict;
  return { id, category, severity, confidence, cause, location, rule, action, raw: line };
}

export function parseVerdict(line) {
  const m = /^(\S+) (resolved|partial|unresolved)\b\s*(?:—\s*)?(.*)$/.exec(line);
  return m ? { id: m[1], result: m[2], evidence: m[3] } : null;
}

/** `Kind:`, `Blocked by:` and the `## <section>` bodies of a brief. */
export function parseBrief(text) {
  const kind = /^Kind:\s*(.+)$/im.exec(text)?.[1].trim() ?? "";
  const blocked = /^Blocked by:\s*(.+)$/im.exec(text)?.[1].trim() ?? "";
  const sections = {};
  let name = null;
  for (const line of text.split(/\r?\n/)) {
    const h = /^##\s+(.+?)\s*$/.exec(line);
    if (h) {
      name = h[1].toLowerCase();
      sections[name] = [];
    } else if (name) sections[name].push(line);
  }
  for (const k of Object.keys(sections)) sections[k] = sections[k].join("\n").trim();
  return {
    kind,
    blockedBy: NONE.test(blocked) ? [] : blocked.split(/[\s,]+/).filter(Boolean),
    sections,
    closes: findingIds(sections.closes ?? ""),
  };
}

const findingIds = (text) => [...new Set(text.match(/[\p{L}\p{N}._-]+#[\p{L}\p{N}._-]+/gu) ?? [])];

// A Git Bash path (/c/Users/…) is not one `git -C` takes on Windows.
const nativePath = (p) => (p && process.platform === "win32" ? p.replace(/^\/([a-z])\//i, (_, d) => `${d.toUpperCase()}:/`) : p);

/** The header lines of common.md (`Run:`, `Mode:`, `N:`, `K:`, `Start:`, `Worktree:`) and its `## Goal`. */
export function parseCommon(text) {
  const field = (k) => new RegExp(`^${k}:\\s*(.+)$`, "m").exec(text)?.[1].trim() ?? null;
  const n = field("N");
  const goal = /^## Goal\s*\r?\n([\s\S]*?)(?=^## |(?![\s\S]))/m.exec(text)?.[1].trim() ?? null;
  return {
    run: field("Run"),
    mode: field("Mode"),
    N: n && /^\d+$/.test(n) ? Number(n) : null,
    K: Number(field("K")) || null,
    start: nativePath(field("Start")),
    worktree: nativePath(field("Worktree")),
    goal,
  };
}

export function parseStage(stage) {
  if (stage === "integrate" || stage === "finish") return { pass: null, step: stage };
  const m = /^p(\d+)-(\w+)$/.exec(stage);
  if (!m || !STEPS.includes(m[2])) return null;
  return { pass: Number(m[1]), step: m[2] };
}

export const slug = (text) =>
  text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "") || "launch";

// ── transcripts ───────────────────────────────────────────────────────────────────────────────

const projectsRoot = () =>
  process.env.FSL_PROJECTS_ROOT ?? join(process.env.CLAUDE_CONFIG_DIR ?? join(homedir(), ".claude"), "projects");

/** The launch's lasting transcript: `subagents/agent-<id>.jsonl` under ~/.claude/projects, found by
 * agent id — the `output_file` an Agent call returns is a temporary copy that may be gone or empty. */
export function findTranscript(ref) {
  const id = basename(ref).replace(/\.(output|jsonl)$/, "").replace(/^agent-/, "");
  const root = projectsRoot();
  if (existsSync(root)) {
    for (const project of readdirSync(root)) {
      const projectDir = join(root, project);
      let sessions;
      try {
        sessions = readdirSync(projectDir);
      } catch {
        continue;
      }
      for (const session of sessions) {
        const path = join(projectDir, session, "subagents", `agent-${id}.jsonl`);
        if (existsSync(path)) return path;
      }
    }
  }
  return existsSync(ref) && read(ref).trim() ? resolve(ref) : null;
}

/** The final message, model, agent type and description of a transcript. A launch is finished when
 * its meta says so, or — older transcripts carry no such flag — when its last message calls no tool;
 * an unfinished one has no final message, whatever text it wrote on the way. */
export function readTranscript(path) {
  const messages = [];
  let model = null;
  for (const line of read(path).split("\n")) {
    if (!line.trim()) continue;
    let e;
    try {
      e = JSON.parse(line);
    } catch {
      continue;
    }
    if (e.type !== "assistant" || !Array.isArray(e.message?.content)) continue;
    model ??= e.message.model ?? null;
    // One API message is written as several entries, one per content block, under one id.
    const id = e.message.id ?? e.uuid ?? Symbol();
    let m = messages.at(-1);
    if (!m || m.id !== id) messages.push((m = { id, text: [], toolUse: false }));
    for (const b of e.message.content) {
      if (b?.type === "text" && b.text.trim()) m.text.push(b.text.trim());
      if (b?.type === "tool_use") m.toolUse = true;
    }
  }
  let meta = {};
  if (path.endsWith(".jsonl"))
    try {
      meta = JSON.parse(read(path.replace(/\.jsonl$/, ".meta.json")) || "{}");
    } catch {}
  const last = messages.at(-1);
  const finished = meta.finished === undefined ? Boolean(last && !last.toolUse && last.text.length) : meta.finished === true;
  return {
    finalText: finished && last?.text.length ? last.text.join("\n") : null,
    model,
    agent: meta.agentType ?? null,
    description: meta.description ?? null,
  };
}

// ── the run folder ────────────────────────────────────────────────────────────────────────────

function git(start, args) {
  const r = spawnSync("git", ["-C", start, ...args], { encoding: "utf8" });
  return r.status === 0 ? r.stdout : null;
}

const defaultCommitMessage = (start, sha) => (start ? git(start, ["log", "-1", "--format=%B", sha]) : null);

/** Everything the run folder holds, parsed and joined. */
export function collect(runDir) {
  const common = parseCommon(read(join(runDir, "common.md")));
  const id = common.run ?? basename(runDir);

  const launches = parseTable(read(join(runDir, "launches.md"))).map((r) => ({
    id: cell(r, "launch"),
    stage: cell(r, "stage"),
    agent: cell(r, "agent"),
    description: cell(r, "description"),
    model: cell(r, "model"),
    transcript: cell(r, "transcript"),
    report: cell(r, "report"),
  }));

  const findings = new Map();
  const verdicts = [];
  const audits = [];
  for (const l of launches) {
    const text = read(join(runDir, l.report));
    l.reportMissing = !text.trim();
    const block = parseBlock(text);
    l.lens = block.LENS?.value || null;
    l.result = block.RESULT?.value || null;
    for (const line of block["FINDINGS"]?.items ?? []) {
      const f = parseFinding(line);
      if (!FINDING_ID.test(f.id)) continue;
      const gid = `${l.id}#${f.id}`;
      findings.set(gid, { ...f, id: gid, local: f.id, launch: l.id, stage: l.stage });
    }
    for (const line of block.VERDICT?.items ?? []) {
      const v = parseVerdict(line);
      if (v) verdicts.push({ ...v, launch: l.id, stage: l.stage });
    }
    for (const line of [block.AUDIT?.value, ...(block.AUDIT?.items ?? [])])
      if (line && !NONE.test(line)) audits.push({ launch: l.id, stage: l.stage, line });
  }

  const decisions = new Map();
  const findingsDir = join(runDir, "findings");
  const rowsByStage = {};
  if (existsSync(findingsDir)) {
    for (const file of readdirSync(findingsDir).filter((f) => f.endsWith(".md"))) {
      const stage = file.replace(/\.md$/, "");
      rowsByStage[stage] = parseTable(read(join(findingsDir, file))).map((r) => ({
        stage,
        finding: cell(r, "finding"),
        decision: cell(r, "decision").toLowerCase(),
        ref: cell(r, "ref"),
        repeat: cell(r, "repeat"),
        why: cell(r, "why"),
        severity: cell(r, "severity").toLowerCase(),
      }));
      for (const row of rowsByStage[stage]) {
        if (!decisions.has(row.finding)) decisions.set(row.finding, row);
        // The run's own finding — a red suite line, a failed end-to-end step — has no report to come from.
        const own = new RegExp(`^${stage}-own#(\\S+)$`).exec(row.finding);
        if (own && !findings.has(row.finding))
          findings.set(row.finding, { id: row.finding, local: own[1], launch: null, stage, severity: SEVERITIES.includes(row.severity) ? row.severity : null, raw: row.why, own: true });
      }
    }
  }

  const units = parseTable(read(join(runDir, "units.md"))).map((r) => {
    const unit = cell(r, "unit");
    const state = cell(r, "state");
    const committed = /^committed\s+([0-9a-f]{7,40})\b/i.exec(state);
    const blocked = /^blocked\b:?\s*(.*)$/i.exec(state);
    const briefPath = join("units", unit, "brief.md");
    const briefText = read(join(runDir, briefPath));
    return {
      id: unit,
      pass: Number(cell(r, "pass").replace(/^p/, "")) || 1,
      state: committed ? "committed" : blocked ? "blocked" : state || "unknown",
      sha: committed?.[1] ?? null,
      blockedWhy: blocked?.[1] ?? null,
      tree: cell(r, "tree"),
      title: cell(r, "title"),
      brief: briefText ? briefPath.replace(/\\/g, "/") : null,
      ...(briefText ? parseBrief(briefText) : { kind: "", blockedBy: [], sections: null, closes: [] }),
    };
  });

  const journal = parseTable(read(join(runDir, "journal.md"))).map((r) => ({
    n: cell(r, "#"),
    stage: cell(r, "stage"),
    question: cell(r, "question"),
    decision: cell(r, "decision"),
    why: cell(r, "why"),
    refs: cell(r, "refs"),
  }));

  const passes = parseTable(read(join(runDir, "passes.md"))).map((r) => ({
    pass: Number(cell(r, "pass").replace(/^p/, "")),
    criticalMajor: Number(cell(r, "critical+major")),
    outcome: cell(r, "outcome").toLowerCase(),
    why: cell(r, "why"),
  }));

  const gates = read(join(runDir, "gates.jsonl"))
    .split("\n")
    .filter(Boolean)
    .map((l) => {
      try {
        return JSON.parse(l);
      } catch {
        return null;
      }
    })
    .filter(Boolean);

  return { runDir, id, common, launches, findings, verdicts, audits, decisions, rowsByStage, units, journal, passes, gates };
}

const lastGate = (run, stage) => run.gates.filter((g) => g.stage === stage).at(-1) ?? null;
const isGreen = (run, stage) => lastGate(run, stage)?.green === true;
const closers = (run, findingId) => run.units.filter((u) => u.closes.includes(findingId));

/** Critical and major assess findings above the bar — the count the pass rule runs on. */
export function weight(run, pass) {
  let n = 0;
  for (const f of run.findings.values()) {
    if (f.stage !== `p${pass}-assess` || !["critical", "major"].includes(f.severity)) continue;
    const d = run.decisions.get(f.id)?.decision;
    if (d === "fix" || d === "open") n++;
  }
  return n;
}

// ── gate ──────────────────────────────────────────────────────────────────────────────────────

function prerequisites(run, stage) {
  const { pass, step } = parseStage(stage);
  const N = run.common.N;
  const need = [];
  if (step === "integrate") {
    const last = Math.max(0, ...run.gates.filter((g) => g.green).map((g) => parseStage(g.stage)?.pass ?? 0));
    if (!last) return ["no pass has a green gate"];
    const closing = `p${last}-${N ? "assess" : "verdict"}`;
    if (!isGreen(run, closing)) need.push(closing);
    const outcome = run.passes.find((p) => p.pass === last)?.outcome;
    if (N && outcome === "next") return [...need.map((s) => `${s} is not green`), `p${last} outcome is next — pass ${last + 1} first`];
    return need.map((s) => `${s} is not green`);
  }
  // A red integrate is a held push — the run still finishes, its report says why.
  if (step === "finish") return lastGate(run, "integrate") ? [] : ["integrate has no gate yet"];
  const gated = (s) => run.gates.some((g) => g.stage === s) || run.launches.some((l) => l.stage === s);
  const previousAssess = () => {
    const prev = `p${pass - 1}-assess`;
    if (!isGreen(run, prev)) return [`${prev} is not green`];
    const outcome = run.passes.find((p) => p.pass === pass - 1)?.outcome;
    return outcome === "next" ? [] : [`p${pass - 1} outcome is ${outcome ?? "missing"}, not next`];
  };
  const order = {
    map: [],
    spike: [`p${pass}-map`],
    decompose: [`p${pass}-map`, `p${pass}-spike`],
    units: [`p${pass}-decompose`],
    review: [`p${pass}-units`],
    fix: [`p${pass}-review`],
    verdict: [`p${pass}-fix`],
    assess: [`p${pass}-fix`],
  }[step];
  const problems = [];
  if (pass > 1 && ["map", "spike", "decompose"].includes(step)) problems.push(...previousAssess());
  for (const s of order) {
    const optional = pass > 1 && /-(map|spike)$/.test(s) && !gated(s);
    if (!optional && !isGreen(run, s)) problems.push(`${s} is not green`);
  }
  if (step === "verdict" && N) problems.push("verdict runs without N — this run has N, its check is assess");
  if (step === "assess" && !N) problems.push("assess runs only with N — common.md has none");
  return problems;
}

function checkLaunches(run, stage) {
  return run.launches.filter((l) => l.stage === stage && l.reportMissing).map((l) => `${l.id}: report ${l.report} is missing or empty`);
}

function checkDecisions(run, stage) {
  const problems = [];
  const expected = [...run.findings.values()].filter((f) => f.stage === stage);
  const rows = run.rowsByStage[stage] ?? [];
  const seen = new Map();
  for (const row of rows) seen.set(row.finding, (seen.get(row.finding) ?? 0) + 1);
  for (const f of expected) {
    const n = seen.get(f.id) ?? 0;
    if (n === 0) problems.push(`${f.id}: no row in findings/${stage}.md`);
    if (n > 1) problems.push(`${f.id}: ${n} rows in findings/${stage}.md`);
  }
  const { pass, step } = parseStage(stage);
  for (const row of rows) {
    const where = `findings/${stage}.md ${row.finding}`;
    if (!run.findings.has(row.finding) || run.findings.get(row.finding).stage !== stage) {
      problems.push(`${where}: no such finding in a ${stage} report`);
      continue;
    }
    if (run.findings.get(row.finding).own && !run.findings.get(row.finding).severity)
      problems.push(`${where}: the run's own finding needs a severity column — critical, major or minor`);
    if (!DECISIONS.includes(row.decision)) problems.push(`${where}: decision "${row.decision}" is not one of ${DECISIONS.join(" · ")}`);
    if (!row.why || NONE.test(row.why)) problems.push(`${where}: why is empty`);
    if (row.decision === "fix") {
      const next = /^p(\d+)$/.exec(row.ref);
      if (step === "assess") {
        if (!next) problems.push(`${where}: an assess finding is fixed by the next pass — ref p${pass + 1}`);
        else if (Number(next[1]) !== pass + 1) problems.push(`${where}: ref ${row.ref} — the next pass is p${pass + 1}`);
        else if (run.common.N && pass + 1 > run.common.N) problems.push(`${where}: p${pass + 1} is past N=${run.common.N} — open, not fix`);
      } else if (!NONE.test(row.ref) && !/^[uf]\d+$/.test(row.ref))
        problems.push(`${where}: a fix's ref is the unit that takes it (u<k>, f<k>) or —`);
    }
    if (row.decision === "duplicate" && (!run.findings.has(row.ref) || row.ref === row.finding))
      problems.push(`${where}: duplicate needs the finding it repeats as ref`);
    if (["dropped", "declined"].includes(row.decision) && NONE.test(row.ref))
      problems.push(`${where}: ${row.decision} needs a ref — the journal row or finding it rests on`);
    if (row.repeat && !NONE.test(row.repeat)) {
      const earlier = run.decisions.get(row.repeat);
      if (!run.findings.has(row.repeat) || row.repeat === row.finding) problems.push(`${where}: repeat ${row.repeat} is no finding`);
      else if (earlier?.decision !== "fix") problems.push(`${where}: repeat ${row.repeat} was not taken to fix`);
    }
  }
  return problems;
}

function checkBriefs(run, units) {
  const problems = [];
  const known = new Set(run.units.map((u) => u.id));
  for (const u of units) {
    if (!u.brief) {
      problems.push(`${u.id}: no units/${u.id}/brief.md`);
      continue;
    }
    for (const s of BRIEF_SECTIONS) {
      if (u.sections[s] === undefined) problems.push(`${u.id}: brief has no "## ${s}" section`);
      else if (!u.sections[s]) problems.push(`${u.id}: brief's "## ${s}" is empty — write — when it has none`);
    }
    for (const s of ["problem", "done-criteria", "files"])
      if (u.sections[s] !== undefined && NONE.test(u.sections[s])) problems.push(`${u.id}: brief's "## ${s}" cannot be —`);
    const kind = /^(ui|backend|full)( \+ table)?$/.exec(u.kind);
    if (!kind) problems.push(`${u.id}: Kind "${u.kind}" is not ui | backend | full [+ table]`);
    else if (kind[1] !== "ui" && u.sections.seams !== undefined && NONE.test(u.sections.seams))
      problems.push(`${u.id}: Kind ${kind[1]} has a backend part — its seams cannot be —`);
    for (const b of u.blockedBy) if (!known.has(b)) problems.push(`${u.id}: Blocked by ${b}, no such unit in units.md`);
    for (const id of u.closes) {
      const d = run.decisions.get(id);
      if (!run.findings.has(id)) problems.push(`${u.id}: closes ${id}, no such finding`);
      else if (d?.decision !== "fix") problems.push(`${u.id}: closes ${id}, which is ${d?.decision ?? "undecided"}, not fix`);
    }
  }
  return problems;
}

/** Every fix decision of `stages` is closed by a unit of `pass` whose id starts with `prefix`. */
function checkTaken(run, stages, pass, prefix) {
  const problems = [];
  for (const row of stages.flatMap((s) => run.rowsByStage[s] ?? [])) {
    if (row.decision !== "fix") continue;
    if (/^p\d+$/.test(row.ref) && Number(row.ref.slice(1)) !== pass) continue;
    const by = closers(run, row.finding).filter((u) => u.pass === pass && u.id.startsWith(prefix));
    if (!by.length) problems.push(`${row.finding}: decided fix, but no ${prefix}-unit brief of pass ${pass} lists it under Closes`);
    else if (/^[uf]\d+$/.test(row.ref) && !by.some((u) => u.id === row.ref))
      problems.push(`${row.finding}: ref ${row.ref}, but it is closed by ${by.map((u) => u.id).join(", ")}`);
  }
  return problems;
}

function checkLanded(run, units, stage, commitMessage) {
  const problems = [];
  for (const u of units) {
    if (u.state === "blocked") {
      if (!u.blockedWhy) problems.push(`${u.id}: blocked with no reason`);
      continue;
    }
    if (u.state !== "committed") {
      problems.push(`${u.id}: state is ${u.state} — committed <sha> or blocked: <why>`);
      continue;
    }
    const msg = commitMessage(run.common.start, u.sha);
    if (msg === null) problems.push(`${u.id}: commit ${u.sha} not found in ${run.common.start ?? "the start checkout (common.md has no Start:)"}`);
    else {
      if (!msg.includes(`Fsloop-Run: ${run.id}`)) problems.push(`${u.id}: commit ${u.sha} has no Fsloop-Run: ${run.id}`);
      if (!new RegExp(`^Fsloop-Step: ${u.id}\\b`, "m").test(msg)) problems.push(`${u.id}: commit ${u.sha} has no Fsloop-Step: ${u.id}`);
      if (u.closes.length) {
        const trailer = [...msg.matchAll(/^Fsloop-Closes:\s*(.+)$/gm)].map((m) => m[1]).join(" ");
        const missing = u.closes.filter((id) => !findingIds(trailer).includes(id));
        if (missing.length) problems.push(`${u.id}: commit ${u.sha} Fsloop-Closes lacks ${missing.join(", ")}`);
      }
    }
    if (!run.launches.some((l) => l.stage === stage && l.description.startsWith(`${u.id} `)))
      problems.push(`${u.id}: no launch "${u.id} …" saved in stage ${stage}`);
  }
  return problems;
}

/** What still stands between `stage` and done; empty → green. */
export function gate(run, stage, { commitMessage = defaultCommitMessage } = {}) {
  const parsed = parseStage(stage);
  if (!parsed) return [`unknown stage "${stage}" — p<n>-{${STEPS.join("|")}}, integrate or finish`];
  const { pass, step } = parsed;
  const problems = [...prerequisites(run, stage), ...checkLaunches(run, stage), ...checkDecisions(run, stage)];
  const ofPass = (prefix) => run.units.filter((u) => u.pass === pass && u.id.startsWith(prefix));

  if (step === "map" && !run.launches.some((l) => l.stage === stage)) problems.push(`${stage}: no launch saved — Map's report goes through save`);
  if (step === "decompose") {
    const units = ofPass("u");
    if (!units.length) problems.push(`no u-unit of pass ${pass} in units.md`);
    problems.push(...checkBriefs(run, units));
    const sources = [`p${pass}-map`, `p${pass}-decompose`, ...(pass > 1 ? [`p${pass - 1}-assess`] : [])];
    problems.push(...checkTaken(run, sources, pass, "u"));
  }
  if (step === "units") problems.push(...checkLanded(run, ofPass("u"), stage, commitMessage));
  if (step === "review" && !run.launches.some((l) => l.stage === stage && l.description.startsWith("critic ")))
    problems.push(`${stage}: no critic report saved`);
  if (step === "fix") {
    const units = ofPass("f");
    problems.push(...checkBriefs(run, units), ...checkTaken(run, [`p${pass}-review`], pass, "f"));
    problems.push(...checkLanded(run, units, stage, commitMessage));
  }
  if (step === "verdict") {
    for (const row of run.rowsByStage[`p${pass}-review`] ?? []) {
      if (row.decision !== "fix" || !closers(run, row.finding).some((u) => u.state === "committed")) continue;
      if (!verdictOf(run, row.finding)) problems.push(`${row.finding}: fixed, but no VERDICT line scores it in ${stage}`);
    }
  }
  if (step === "assess") {
    const row = run.passes.find((p) => p.pass === pass);
    const n = weight(run, pass);
    if (!row) problems.push(`passes.md has no row for pass ${pass}`);
    else {
      if (row.criticalMajor !== n) problems.push(`passes.md p${pass}: critical+major is ${row.criticalMajor}, the findings count ${n}`);
      const allowed = allowedOutcomes(run, pass, n);
      if (!allowed.includes(row.outcome)) problems.push(`passes.md p${pass}: outcome ${row.outcome || "—"}, the rule allows ${allowed.join(" | ")}`);
      if (row.outcome !== "next")
        for (const r of run.rowsByStage[stage] ?? [])
          if (r.decision === "fix") problems.push(`${r.finding}: fix, but the run stops at p${pass} — open`);
    }
  }
  // Green here is the push's precondition: a critical or major finding of a review, a verdict or the
  // merge still open after Fix holds it (SKILL.md step 7). Assess findings are the passes' to judge.
  if (step === "integrate")
    for (const f of run.findings.values()) {
      if (!["critical", "major"].includes(f.severity) || !/-(review|verdict)$|^integrate$/.test(f.stage)) continue;
      const { status } = statusOf(run, f, run.decisions.get(f.id));
      if (HOLDS_PUSH.includes(status)) problems.push(`${f.id}: ${f.severity}, ${status} — it holds the push`);
    }
  if (step === "finish" && !existsSync(join(run.runDir, "report.md"))) problems.push("no report.md");
  return problems;
}

const HOLDS_PUSH = ["open", "queued", "in-progress", "undecided", "fixed"];

/** The pass rule of assess.md: what outcome the count permits. */
export function allowedOutcomes(run, pass, n) {
  if (n === 0) return ["converged"];
  const previous = run.passes.find((p) => p.pass === pass - 1)?.criticalMajor;
  const allowed = ["stalled"];
  if (run.common.N && pass >= run.common.N) allowed.push("cap");
  else if (previous === undefined || n < previous) allowed.push("next");
  return allowed;
}

function verdictOf(run, findingId) {
  const f = run.findings.get(findingId);
  const exact = run.verdicts.filter((v) => v.id === findingId);
  if (exact.length) return exact.at(-1);
  // A verdict that echoes the short id (`code-3`) counts only for its own pass's review, and only
  // when that review has one finding by that id.
  if (!f || !f.stage.endsWith("-review")) return null;
  const verdictStage = f.stage.replace(/-review$/, "-verdict");
  const local = run.verdicts.filter((v) => v.id === f.local && v.stage === verdictStage);
  const sameLocal = [...run.findings.values()].filter((x) => x.local === f.local && x.stage === f.stage);
  return local.length && sameLocal.length === 1 ? local.at(-1) : null;
}

// ── build ─────────────────────────────────────────────────────────────────────────────────────

function statusOf(run, f, decision) {
  if (!decision) return { status: "undecided" };
  if (decision.decision !== "fix") return { status: decision.decision };
  const by = closers(run, f.id);
  if (!by.length) return { status: "queued" };
  const unit = by.at(-1);
  if (unit.state === "blocked") return { status: "open", unit: unit.id, why: `${unit.id} blocked` };
  if (unit.state !== "committed") return { status: "in-progress", unit: unit.id };
  const verdict = verdictOf(run, f.id);
  if (verdict) return { status: verdict.result === "resolved" ? "closed" : "open", unit: unit.id, verdict };
  const repeatedBy = [...run.decisions.values()].find((d) => d.repeat === f.id);
  if (repeatedBy) return { status: "open", unit: unit.id, repeatedBy: repeatedBy.finding };
  const assess = `p${unit.pass}-assess`;
  if (run.common.N && isGreen(run, assess)) return { status: "closed", unit: unit.id, checkedBy: assess };
  return { status: "fixed", unit: unit.id };
}

export function build(run) {
  const stages = [];
  for (const g of run.gates) {
    const i = stages.findIndex((s) => s.stage === g.stage);
    if (i >= 0) stages.splice(i, 1);
    stages.push(g);
  }
  return {
    version: 1,
    id: run.id,
    goal: run.common.goal,
    mode: run.common.mode,
    N: run.common.N,
    K: run.common.K,
    start: run.common.start,
    worktree: run.common.worktree,
    stages,
    passes: run.passes,
    units: run.units.map(({ sections, ...u }) => u),
    launches: run.launches.map(({ reportMissing, ...l }) => l),
    findings: [...run.findings.values()].map((f) => {
      const d = run.decisions.get(f.id);
      return {
        ...f,
        decision: d?.decision ?? null,
        ref: d?.ref ?? null,
        repeat: d?.repeat && !NONE.test(d.repeat) ? d.repeat : null,
        why: d?.why ?? null,
        ...statusOf(run, f, d),
      };
    }),
    audits: run.audits,
    journal: run.journal,
  };
}

const writeRunJson = (runDir) => writeFileSync(join(runDir, "run.json"), JSON.stringify(build(collect(runDir)), null, 2) + "\n");

// ── save ──────────────────────────────────────────────────────────────────────────────────────

const escapeCell = (s) => String(s ?? "—").replace(/\|/g, "\\|").replace(/\r?\n/g, " ");

export function save(runDir, stage, ref, descriptionGiven) {
  if (!parseStage(stage)) throw new Error(`unknown stage "${stage}"`);
  const transcript = findTranscript(ref);
  if (!transcript) throw new Error(`no transcript for ${ref} — neither ~/.claude/projects/*/*/subagents/agent-<id>.jsonl nor a non-empty file`);
  const t = readTranscript(transcript);
  if (!t.finalText) throw new Error(`${transcript}: no final message — the launch did not finish; relaunch it`);

  const launchesPath = join(runDir, "launches.md");
  const existing = parseTable(read(launchesPath));
  const same = existing.find((r) => cell(r, "transcript") === transcript);
  if (same && cell(same, "stage") !== stage)
    throw new Error(`already saved as ${cell(same, "launch")} in stage ${cell(same, "stage")}, not ${stage}`);
  if (same) return { id: cell(same, "launch"), report: cell(same, "report"), existed: true };

  const description = t.description ?? descriptionGiven;
  if (!description) throw new Error(`${transcript}: no meta file names the launch — pass its description: save <run folder> <stage> <ref> "<description>"`);
  const base = `${stage}-${slug(description)}`;
  const taken = new Set(existing.map((r) => cell(r, "launch")));
  mkdirSync(join(runDir, "reports"), { recursive: true });
  let id = base;
  for (let k = 2; ; k++) {
    if (!taken.has(id))
      try {
        // Exclusive create: two saves racing for one id never overwrite each other's report.
        writeFileSync(join(runDir, "reports", `${id}.md`), t.finalText + "\n", { flag: "wx" });
        break;
      } catch (e) {
        if (e.code !== "EEXIST") throw e;
      }
    id = `${base}-${k}`;
  }
  const report = `reports/${id}.md`;
  if (!existsSync(launchesPath))
    writeFileSync(launchesPath, "| launch | stage | agent | description | model | transcript | report |\n|---|---|---|---|---|---|---|\n");
  const row = [id, stage, t.agent ?? "—", description, t.model ?? "—", transcript, report].map(escapeCell);
  appendFileSync(launchesPath, `| ${row.join(" | ")} |\n`);
  return { id, report, existed: false };
}

// ── cli ───────────────────────────────────────────────────────────────────────────────────────

const USAGE = `usage:
  node fsl.mjs save  <run folder> <stage> <agent id | output_file> ["<description>"]   file a launch's final block
  node fsl.mjs gate  <run folder> <stage>    is the stage done? exit 1 when not
  node fsl.mjs build <run folder>            write run.json
stage: p<n>-{${STEPS.join("|")}} | integrate | finish`;

function main(argv) {
  const [command, dir, ...rest] = argv;
  if (!command || !dir) {
    console.error(USAGE);
    return 4;
  }
  const runDir = resolve(dir);
  if (command === "save") {
    const [stage, ref, description] = rest;
    if (!stage || !ref) return (console.error(USAGE), 4);
    try {
      const r = save(runDir, stage, ref, description);
      console.log(`${r.existed ? "already saved" : "saved"} ${r.id} → ${r.report}`);
    } catch (e) {
      console.error(`save: ${e.message}`);
      return 1;
    }
    writeRunJson(runDir);
    return 0;
  }
  if (command === "gate") {
    const [stage] = rest;
    if (!stage) return (console.error(USAGE), 4);
    const run = collect(runDir);
    const problems = gate(run, stage);
    if (parseStage(stage))
      appendFileSync(join(runDir, "gates.jsonl"), JSON.stringify({ stage, green: !problems.length, at: new Date().toISOString(), problems }) + "\n");
    writeRunJson(runDir);
    if (!problems.length) {
      console.log(`GATE ${stage} green`);
      return 0;
    }
    console.log(`GATE ${stage} red — ${problems.length}`);
    for (const p of problems) console.log(`- ${p}`);
    return 1;
  }
  if (command === "build") {
    writeRunJson(runDir);
    console.log(`run.json → ${join(runDir, "run.json")}`);
    return 0;
  }
  console.error(USAGE);
  return 4;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = main(process.argv.slice(2));
