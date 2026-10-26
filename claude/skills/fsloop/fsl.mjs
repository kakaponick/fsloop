#!/usr/bin/env node
// The run folder's one reader. `save` files a launch's final block, `gate` checks that a stage is
// done, `report` writes the report's tables, `build` writes run.json and summary.json — what a UI
// reads. Everything is derived from the run folder's files, the transcripts Claude Code keeps and git;
// the only state fsl.mjs adds is decisions.jsonl, the history the editable findings files lose.
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { appendFileSync, closeSync, existsSync, mkdirSync, openSync, readdirSync, readFileSync, readSync, renameSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** run.json's shape; bumped on every change to it. */
export const VERSION = 3;
export const STEPS = ["map", "spike", "decompose", "units", "review", "fix", "verdict", "assess"];
export const DECISIONS = ["fix", "candidate", "dropped", "declined", "duplicate", "open"];
export const OUTCOMES = ["converged", "stalled", "next", "cap"];
export const BRIEF_SECTIONS = ["problem", "seams", "done-criteria", "files", "reference", "settled", "closes"];
export const HUMAN_VERDICTS = ["agree", "disagree", "wrong-severity", "false-positive"];
const SEVERITIES = ["critical", "major", "minor"];
const NONE = /^(—|-|none)?$/i;

const read = (path) => (existsSync(path) ? readFileSync(path, "utf8") : "");
const compact = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== null && v !== undefined && v !== false && !(Array.isArray(v) && !v.length)));
const orNull =(s) => (s === undefined || s === null || NONE.test(String(s).trim()) ? null : String(s).trim());

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

/** The first header of a table file, lower-cased; null when it has none. */
function tableHeader(text) {
  const lines = text.split(/\r?\n/);
  for (let i = 0; i + 1 < lines.length; i++)
    if (lines[i].trim().startsWith("|") && !isSeparator(lines[i]) && isSeparator(lines[i + 1])) return splitRow(lines[i]).map((h) => h.toLowerCase());
  return null;
}

const cell = (row, ...names) => {
  for (const n of names) if (row[n] !== undefined) return row[n].replace(/[`*]/g, "").trim();
  return "";
};

const HEAD = /^([A-Z][A-Z ]*[A-Z])(?: \([^)]*\))?:\s*(.*)$/;

/** Each `NAME:` section of an agent's final block: its value and its `- ` items, with their line numbers. */
function blockSections(text) {
  const sections = {};
  let current = null;
  text.split(/\r?\n/).forEach((raw, i) => {
    const line = raw.trimEnd();
    if (/^```/.test(line.trim())) return;
    const head = HEAD.exec(line);
    if (head) {
      current = head[1];
      sections[current] = { value: head[2].trim(), items: [], lines: [] };
      return;
    }
    const item = /^(?:- |\d+\. )(.*)$/.exec(line);
    if (item && current && !NONE.test(item[1].trim())) {
      sections[current].items.push(item[1].trim());
      sections[current].lines.push(i + 1);
    }
  });
  return sections;
}

/** `- ` items under each `NAME:` header of an agent's final block, keyed by NAME. */
export function parseBlock(text) {
  return Object.fromEntries(Object.entries(blockSections(text)).map(([k, { value, items }]) => [k, { value, items }]));
}

/** A finding line opens with its id (`code-3`, `craft-12`); any other line under FINDINGS is no finding. */
export const FINDING_ID = /^[a-z][\w-]*-\d+$/i;

const FINDING_LINE = /^(\S+) \[([\w-]+)\] (critical|major|minor) (high|med|low) (\S+) (\S+) — (.+?) — (.+)$/;
// The same grammar as a writer may bend it: markdown around the id, ASCII dashes, extra spaces, capitals.
const FINDING_LOOSE = /^(\S+)\s+\[([\w-]+)\]\s+(critical|major|minor)\s+(high|med|low)\s+(\S+)\s+(\S+)\s+(?:—|--?)\s+(.+?)\s+(?:—|--?)\s+(.+)$/i;

/** One `FINDINGS:` line of fsloop-critic: `<id> [lens] <severity> <confidence> <cause> <file:line> — <rule> — <action>`.
 * `parsed` is `strict` when the line keeps that grammar, `loose` when its fields were recovered or only some were. */
export function parseFinding(line) {
  const strict = FINDING_LINE.exec(line);
  if (strict && FINDING_ID.test(strict[1])) {
    const [, id, category, severity, confidence, cause, location, rule, action] = strict;
    return { id, parsed: "strict", category, severity, confidence, cause, location, rule, action, raw: line };
  }
  const clean = line.replace(/^[*_`]+([^*_`\s]+)[*_`]+:?/, "$1");
  const id = clean.split(/\s+/)[0].replace(/[*_`:.,]+$/, "");
  const loose = FINDING_LOOSE.exec(clean);
  if (loose) {
    const [, , category, severity, confidence, cause, location, rule, action] = loose;
    return { id, parsed: "loose", category, severity: severity.toLowerCase(), confidence: confidence.toLowerCase(), cause, location, rule, action, raw: line };
  }
  const tokens = clean.split(/\s+/);
  return { id, parsed: "loose", severity: tokens.slice(1, 4).find((t) => SEVERITIES.includes(t.toLowerCase()))?.toLowerCase() ?? null, raw: line };
}

/** An implementer's or debugger's NOTES lines `to judge: <decision> — <why>`, in order. */
export const judgeQuestions = (block) =>
  (block.NOTES?.items ?? []).map((i) => /^to judge:\s*(.+)$/i.exec(i)?.[1]).filter(Boolean);

export function parseVerdict(line) {
  const m = /^[*`]*([^\s*`]+)[*`]* (resolved|partial|unresolved)\b\s*(?:—\s*)?(.*)$/.exec(line);
  return m ? { id: m[1], result: m[2], evidence: m[3] } : null;
}

/** prod-check's block: `VERDICT: <ok|degraded|failed> — <line>`, `SHA: <sha> · DEPLOYED: <time>`, `ANOMALIES:`;
 * the colon was once missing, so both forms read. */
export function parseDeploy(text) {
  const v = /^VERDICT:?[ \t]+(ok|degraded|failed)\b[ \t]*(?:—[ \t]*)?(.*)$/m.exec(text);
  if (!v) return null;
  const sha = /^SHA:?[ \t]+([0-9a-f]{7,40})\b(?:.*?\bDEPLOYED:?[ \t]+(.+))?$/im.exec(text);
  const lines = text.split(/\r?\n/);
  const at = lines.findIndex((l) => /^ANOMALIES:?(\s|$)/.test(l));
  const anomalies = [];
  if (at >= 0) {
    const value = lines[at].replace(/^ANOMALIES:?\s*/, "").trim();
    if (!NONE.test(value)) anomalies.push(value);
    for (const l of lines.slice(at + 1)) {
      const item = /^(?:- |\d+\. )(.*)$/.exec(l.trim());
      if (!item) break;
      if (!NONE.test(item[1].trim())) anomalies.push(item[1].trim());
    }
  }
  return { verdict: v[1], line: v[2].trim() || null, sha: sha?.[1] ?? null, deployedAt: sha?.[2]?.trim() ?? null, anomalies };
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

const findingIds = (text) => [...new Set(text.match(/[\p{L}\p{N}._-]+#[\p{L}\p{N}._~-]+/gu) ?? [])];

// A Git Bash path (/c/Users/…) is not one `git -C` takes on Windows.
const nativePath = (p) => (p && process.platform === "win32" ? p.replace(/^\/([a-z])\//i, (_, d) => `${d.toUpperCase()}:/`) : p);

/** The head lines of common.md (`Run:`, `Mode:`, `N:`, `K:`, `Start:`, `Worktree:`, `Started:`, each `Session:`) and its `## Goal`. */
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
    started: field("Started"),
    sessions: [...text.matchAll(/^Session:\s*(\S+)/gm)].map((m) => m[1]),
    goal,
  };
}

export function parseStage(stage) {
  if (stage === "integrate" || stage === "finish" || stage === "init") return { pass: null, step: stage };
  const m = /^p(\d+)-(\w+)$/.exec(stage);
  if (!m || !STEPS.includes(m[2])) return null;
  return { pass: Number(m[1]), step: m[2] };
}

/** Init first, then each pass's steps in order, then integrate and finish. */
const stageKey = (stage) => {
  const p = parseStage(stage);
  if (!p) return [9];
  if (p.step === "init") return [0];
  if (p.step === "integrate") return [2];
  if (p.step === "finish") return [3];
  return [1, p.pass, STEPS.indexOf(p.step)];
};
export const compareStages = (a, b) => {
  const x = stageKey(a);
  const y = stageKey(b);
  for (let i = 0; i < Math.max(x.length, y.length); i++) if ((x[i] ?? -1) !== (y[i] ?? -1)) return (x[i] ?? -1) - (y[i] ?? -1);
  return 0;
};

export const slug = (text) =>
  text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "") || "launch";

// ── transcripts ───────────────────────────────────────────────────────────────────────────────

const projectsRoot = () =>
  process.env.FSL_PROJECTS_ROOT ?? join(process.env.CLAUDE_CONFIG_DIR ?? join(homedir(), ".claude"), "projects");

const agentIdOf = (path) => /agent-([^.\\/]+)\.jsonl$/.exec(path ?? "")?.[1] ?? null;
const isoOf = (ms) => (ms === null || ms === undefined || Number.isNaN(ms) ? null : new Date(ms).toISOString());

/** The first line of a file, reading no further than `limit` bytes — a transcript runs to megabytes. */
export function firstLine(path, limit = 1 << 20) {
  let fd;
  try {
    fd = openSync(path, "r");
  } catch {
    return "";
  }
  try {
    const chunks = [];
    const buf = Buffer.alloc(64 * 1024);
    for (let pos = 0; pos < limit; ) {
      const n = readSync(fd, buf, 0, Math.min(buf.length, limit - pos), pos);
      if (!n) break;
      const nl = buf.subarray(0, n).indexOf(10);
      chunks.push(Buffer.from(buf.subarray(0, nl >= 0 ? nl : n)));
      if (nl >= 0) break;
      pos += n;
    }
    return Buffer.concat(chunks).toString("utf8");
  } finally {
    closeSync(fd);
  }
}

/** The launch's lasting transcript: `subagents/agent-<id>.jsonl` under ~/.claude/projects, found by
 * agent id — the `output_file` an Agent call returns is a temporary copy that may be gone or empty. */
export function findTranscript(ref, runId) {
  const id = basename(ref).replace(/\.(output|jsonl)$/, "").replace(/^agent-/, "");
  const dirs = subagentDirs();
  for (const dir of dirs) {
    const path = join(dir, `agent-${id}.jsonl`);
    if (existsSync(path)) return path;
  }
  if (existsSync(ref) && read(ref).trim()) return resolve(ref);
  return runId ? findByDescription(dirs, ref, runId) : null;
}

function subagentDirs() {
  const root = projectsRoot();
  const dirs = [];
  if (!existsSync(root)) return dirs;
  for (const project of readdirSync(root)) {
    let sessions;
    try {
      sessions = readdirSync(join(root, project));
    } catch {
      continue;
    }
    for (const session of sessions) {
      const dir = join(root, project, session, "subagents");
      if (existsSync(dir)) dirs.push(dir);
    }
  }
  return dirs;
}

/** A session's own transcript and its sub-agents' folder, wherever its project folder is. */
function sessionPaths(session) {
  const root = projectsRoot();
  if (!existsSync(root)) return null;
  for (const project of readdirSync(root)) {
    const main = join(root, project, `${session}.jsonl`);
    const subagents = join(root, project, session, "subagents");
    if (existsSync(main) || existsSync(subagents)) return { main: existsSync(main) ? main : null, subagents: existsSync(subagents) ? subagents : null };
  }
  return null;
}

// The path as it sits in the JSON line: either slash, backslashes escaped.
const namesRun = (runId) => new RegExp(`[\\\\/]+${runId.replace(/[^\w-]/g, "")}[\\\\/]+common\\.md`);

const readMeta = (path) => {
  try {
    return JSON.parse(read(path) || "{}");
  } catch {
    return {};
  }
};

/** On Resume the agent id may be lost with the session: the launch is the newest transcript whose
 * meta carries this description and whose prompt names this run (`Common: <run folder>/common.md`). */
function findByDescription(dirs, description, runId) {
  const names = namesRun(runId);
  let best = null;
  for (const dir of dirs) {
    for (const file of readdirSync(dir)) {
      if (!file.endsWith(".meta.json")) continue;
      if (readMeta(join(dir, file)).description !== description) continue;
      const path = join(dir, file.replace(/\.meta\.json$/, ".jsonl"));
      if (!names.test(firstLine(path))) continue;
      const mtime = statSync(path).mtimeMs;
      if (!best || mtime > best.mtime) best = { path, mtime };
    }
  }
  return best?.path ?? null;
}

const emptySpend = () => ({ input: 0, output: 0, cacheWrite: 0, cacheRead: 0 });

/** The tokens of a transcript's messages. One API message is written as several entries, one per content
 * block, under one id; each repeats the usage so far, so the message's usage is the largest seen. */
function addUsage(messages, e) {
  const id = e.message.id ?? e.uuid ?? Symbol();
  let m = messages.at(-1);
  if (!m || m.id !== id) messages.push((m = { id, text: [], toolUse: false, usage: emptySpend() }));
  const u = e.message.usage;
  if (u) {
    m.usage.input = Math.max(m.usage.input, u.input_tokens ?? 0);
    m.usage.output = Math.max(m.usage.output, u.output_tokens ?? 0);
    m.usage.cacheWrite = Math.max(m.usage.cacheWrite, u.cache_creation_input_tokens ?? 0);
    m.usage.cacheRead = Math.max(m.usage.cacheRead, u.cache_read_input_tokens ?? 0);
  }
  return m;
}

const sumSpend = (messages) => {
  const spend = emptySpend();
  for (const m of messages) for (const k of Object.keys(spend)) spend[k] += m.usage[k];
  return spend;
};

/** The tokens of a long transcript (the orchestrator's own), parsing only the lines that carry usage. */
function spendOf(path) {
  const messages = [];
  for (const line of read(path).split("\n")) {
    if (!line.includes('"usage"')) continue;
    try {
      const e = JSON.parse(line);
      if (e.type === "assistant" && e.message) addUsage(messages, e);
    } catch {}
  }
  return sumSpend(messages);
}

/** The final message, model, agent type, description, times and tokens of a transcript. A launch is finished
 * when its meta says so, or — older transcripts carry no such flag — when its last message calls no tool;
 * an unfinished one has no final message, whatever text it wrote on the way. */
export function readTranscript(path) {
  const messages = [];
  let model = null;
  let first = null;
  let lastAt = null;
  let agentId = null;
  for (const line of read(path).split("\n")) {
    if (!line.trim()) continue;
    let e;
    try {
      e = JSON.parse(line);
    } catch {
      continue;
    }
    agentId ??= e.agentId ?? null;
    const at = Date.parse(e.timestamp ?? "");
    if (!Number.isNaN(at)) {
      first ??= at;
      lastAt = at;
    }
    if (e.type !== "assistant" || !Array.isArray(e.message?.content)) continue;
    model ??= e.message.model ?? null;
    const m = addUsage(messages, e);
    for (const b of e.message.content) {
      if (b?.type === "text" && b.text.trim()) m.text.push(b.text.trim());
      if (b?.type === "tool_use") m.toolUse = true;
    }
  }
  const meta = path.endsWith(".jsonl") ? readMeta(path.replace(/\.jsonl$/, ".meta.json")) : {};
  const last = messages.at(-1);
  const finished = meta.finished === undefined ? Boolean(last && !last.toolUse && last.text.length) : meta.finished === true;
  return {
    finalText: finished && last?.text.length ? last.text.join("\n") : null,
    model,
    agent: meta.agentType ?? null,
    description: meta.description ?? null,
    agentId: agentId ?? agentIdOf(path),
    startedAt: isoOf(first),
    endedAt: isoOf(lastAt),
    seconds: first !== null ? Math.round((lastAt - first) / 1000) : null,
    spend: sumSpend(messages),
  };
}

/** The sub-agents a launch started — the craft critic's critique A and B, an implementer's cold-read — and theirs,
 * found beside it by the `parentAgentId` their meta carries, with their tokens summed. */
export function childSpend(transcript) {
  const id = agentIdOf(transcript);
  const sum = { launches: 0, ...emptySpend() };
  if (!id) return sum;
  const dir = dirname(transcript);
  const parentOf = new Map();
  for (const file of readdirSync(dir)) {
    if (!file.endsWith(".meta.json")) continue;
    const parent = readMeta(join(dir, file)).parentAgentId;
    if (parent) parentOf.set(file.replace(/^agent-/, "").replace(/\.meta\.json$/, ""), parent);
  }
  for (const child of parentOf.keys()) {
    let p = parentOf.get(child);
    for (let depth = 0; p && p !== id && depth < 32; depth++) p = parentOf.get(p);
    if (p !== id) continue;
    const t = readTranscript(join(dir, `agent-${child}.jsonl`));
    sum.launches++;
    for (const k of Object.keys(t.spend)) sum[k] += t.spend[k];
  }
  return sum;
}

// ── the run folder ────────────────────────────────────────────────────────────────────────────

function git(start, args) {
  const r = spawnSync("git", ["-C", start, ...args], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  return r.status === 0 ? r.stdout : null;
}

const defaultCommitMessage = (start, sha) => (start ? git(start, ["log", "-1", "--format=%B", sha]) : null);

/** The run's commits as git holds them now — a rebase or a pull rewrites the shas units.md recorded. Inline: the
 * start checkout's HEAD; worktree: the run branch, or every ref once it is gone. Null when git cannot answer. */
function runCommits(common, id, runGit) {
  if (!common.start) return null;
  const branch = `fsl/${id}`;
  const refs = common.mode === "inline" ? ["HEAD"] : runGit(common.start, ["rev-parse", "--verify", "--quiet", `refs/heads/${branch}`]) !== null ? [branch] : ["--all"];
  const out = runGit(common.start, ["log", ...refs, "--reverse", "-z", "-F", `--grep=Fsloop-Run: ${id}`, "--format=%H%x1f%cI%x1f%s%x1f%B"]);
  if (out === null) return null;
  const commits = [];
  for (const record of out.split("\0")) {
    if (!record.trim()) continue;
    const [sha, at, subject, body = ""] = record.replace(/^\n+/, "").split("\x1f");
    const trailer = (k) => [...body.matchAll(new RegExp(`^${k}:[ \\t]*(.+)$`, "gm"))].map((m) => m[1].trim());
    if (!trailer("Fsloop-Run").includes(id)) continue;
    const step = trailer("Fsloop-Step")[0] ?? null;
    const pass = /^(\d+)/.exec(trailer("Fsloop-Pass")[0] ?? "")?.[1];
    commits.push({ sha, subject, at, step, unit: /^([uf]\d+)\b/.exec(step ?? "")?.[1] ?? null, pass: pass ? Number(pass) : null, closes: findingIds(trailer("Fsloop-Closes").join(" ")) });
  }
  return commits;
}

function readJsonl(path) {
  return read(path)
    .split("\n")
    .filter((l) => l.trim())
    .map((l) => {
      try {
        return JSON.parse(l);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

const CHECK_LINE = /^(\d+)\s+(.+?)\s+—\s+exit\s+(-?\d+)\b\s*(?:—\s*)?(.*)$/;
const SECONDS_TAIL = /^(\d+(?:\.\d+)?)\s*s\b\s*(?:—\s*)?(.*)$/;

const mtimeOf = (path) => {
  try {
    return statSync(path).mtimeMs;
  } catch {
    return null;
  }
};

/** The `COMMANDS` lines a command list leaves in its `<log>.lines` files. */
function checkLines(dir, prefix) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".lines")).sort())
    for (const line of read(join(dir, file)).split(/\r?\n/)) {
      if (!line.trim()) continue;
      const m = CHECK_LINE.exec(line.trim());
      if (!m) {
        out.push({ file: `${prefix}${file}`, n: null, label: null, exit: null, line: line.trim() });
        continue;
      }
      const s = SECONDS_TAIL.exec(m[4] ?? "");
      const seconds = s ? Number(s[1]) : null;
      const ended = mtimeOf(join(dir, `${file.replace(/\.lines$/, "")}.${m[1]}`));
      out.push({
        file: `${prefix}${file}`,
        n: Number(m[1]),
        label: m[2],
        exit: Number(m[3]),
        line: m[4] || null,
        seconds,
        startedAt: ended !== null && seconds !== null ? isoOf(ended - seconds * 1000) : null,
        endedAt: isoOf(ended),
      });
    }
  return out;
}

/** Frames under shots/: `p<p>-<moment>-<surface>.png`, init's `init-<name>.png`. */
function shotsOf(runDir) {
  const dir = join(runDir, "shots");
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".png"))
    .sort()
    .map((f) => {
      const p = /^p(\d+)-([a-z]+)-(.+)\.png$/.exec(f);
      if (p) return { path: `shots/${f}`, pass: Number(p[1]), moment: p[2], surface: p[3] };
      const init = /^init-(.+)\.png$/.exec(f);
      return { path: `shots/${f}`, pass: null, moment: init ? "init" : null, surface: init?.[1] ?? null };
    });
}

/** A folder of an older version, `.claude/fsloop/<id>/`: only its report is read. */
const isLegacy = (runDir) => basename(dirname(resolve(runDir))) === "fsloop";
const samePath = (a, b) => {
  const norm = (p) => resolve(p).replace(/\\/g, "/").replace(/\/+$/, "");
  return process.platform === "win32" ? norm(a).toLowerCase() === norm(b).toLowerCase() : norm(a) === norm(b);
};

const opensFindings = (l) => ["fsloop-implement", "fsloop-debug"].includes(l.agent) || /^(?:[uf]\d+ (?:implement|debug)|integrate (?:fix|debug))$/.test(l.description);

/** Everything the run folder holds, parsed and joined. `git` is injectable, as `gate`'s commitMessage is. */
export function collect(runDir, { git: runGit = git } = {}) {
  const common = parseCommon(read(join(runDir, "common.md")));
  const id = common.run ?? basename(runDir);

  const launches = parseTable(read(join(runDir, "launches.md"))).map((r) => {
    const transcript = cell(r, "transcript");
    const description = cell(r, "description");
    const num = (k) => Number(cell(r, k)) || 0;
    return {
      id: cell(r, "launch"),
      stage: cell(r, "stage"),
      agent: cell(r, "agent"),
      description,
      model: cell(r, "model"),
      unit: /^([uf]\d+)\b/.exec(description)?.[1] ?? null,
      agentId: orNull(cell(r, "agent id")) ?? agentIdOf(transcript),
      startedAt: orNull(cell(r, "started")),
      endedAt: orNull(cell(r, "ended")),
      seconds: Number(cell(r, "seconds")) || null,
      spend: {
        input: num("input"),
        output: num("output"),
        cacheWrite: num("cache write"),
        cacheRead: num("cache read"),
        // A row saved before the column existed: unknown, not zero.
        children: r.children === undefined ? null : { launches: num("children"), input: num("children input"), output: num("children output"), cacheWrite: num("children cache write"), cacheRead: num("children cache read") },
      },
      transcript,
      transcriptGone: Boolean(transcript) && !existsSync(transcript),
      report: cell(r, "report"),
    };
  });

  const findings = new Map();
  const verdicts = [];
  const audits = [];
  const judges = [];
  const judged = [];
  const deploys = [];
  for (const l of launches) {
    const text = read(join(runDir, l.report));
    l.reportMissing = !text.trim();
    const block = blockSections(text);
    l.unparsed = [];
    // Every line is kept: a local id met twice in one report is told apart by position (`code-1`, `code-1~2`).
    const take = (local, f) => {
      let key = local;
      for (let k = 2; findings.has(`${l.id}#${key}`); k++) key = `${local}~${k}`;
      findings.set(`${l.id}#${key}`, { ...f, id: `${l.id}#${key}`, local: key, launch: l.id, stage: l.stage, own: false });
    };
    const unparsed = (section, k, text) => l.unparsed.push({ id: `${l.id}#line-${block[section].lines[k]}`, section, line: block[section].lines[k], text });
    block.FINDINGS?.items.forEach((line, k) => {
      const f = parseFinding(line);
      if (FINDING_ID.test(f.id)) take(f.id, f);
      else unparsed("FINDINGS", k, line);
    });
    // An implementer's or debugger's OPEN line is above the bar (SKILL.md → Bar): a finding, decided like the critics'.
    const openLines = opensFindings(l);
    if (openLines) block.OPEN?.items.forEach((line, k) => take(`open-${k + 1}`, { parsed: "loose", severity: null, raw: line }));
    block.VERDICT?.items.forEach((line, k) => {
      const v = parseVerdict(line);
      if (v) verdicts.push({ ...v, launch: l.id, stage: l.stage });
      else unparsed("VERDICT", k, line);
    });
    for (const line of [block.AUDIT?.value, ...(block.AUDIT?.items ?? [])])
      if (line && !NONE.test(line)) audits.push({ launch: l.id, stage: l.stage, line });
    for (const q of judgeQuestions(block)) {
      const qid = `${l.id}#judge-${judges.filter((j) => j.launch === l.id).length + 1}`;
      judges.push({ id: qid, launch: l.id, stage: l.stage, text: q });
    }
    for (const line of block.JUDGED?.items ?? []) {
      const m = /^[*`]*(\S+#judge-\d+)[*`]*\s+(.*)$/.exec(line);
      if (!m) continue;
      const named = /\bfinding\s+([^\s,;]+?)[.,;]?(?:\s|$)/.exec(m[2])?.[1] ?? null;
      const finding = named ? (named.includes("#") ? named : `${l.id}#${named}`) : null;
      const result = /— upheld\b/.test(m[2]) ? "upheld" : named || /\bfinding\b/.test(m[2]) ? "finding" : null;
      judged.push({ id: m[1], text: m[2], result, finding, launch: l.id, stage: l.stage });
    }
    if (l.description === "prod check" || l.agent === "prod-check") {
      const d = parseDeploy(text);
      if (d) deploys.push({ ...d, launch: l.id });
    }
    l.block = Object.fromEntries(Object.entries(block).filter(([name]) => name !== "FINDINGS" && !(openLines && name === "OPEN")).map(([name, { value, items }]) => [name, { value, items }]));
  }

  const decisions = new Map();
  const repeaters = new Map();
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
        evidence: cell(r, "evidence"),
      }));
      for (const row of rowsByStage[stage]) {
        if (!decisions.has(row.finding)) decisions.set(row.finding, row);
        if (!NONE.test(row.repeat) && !repeaters.has(row.repeat)) repeaters.set(row.repeat, row.finding);
        // The run's own finding — a red suite line, a failed end-to-end step — has no report to come from.
        const own = new RegExp(`^${stage}-own#(\\S+)$`).exec(row.finding);
        const severity = SEVERITIES.includes(row.severity) ? row.severity : null;
        if (own && !findings.has(row.finding))
          findings.set(row.finding, { id: row.finding, local: own[1], launch: null, stage, severity, evidence: orNull(row.evidence), own: true, parsed: null });
        const open = findings.get(row.finding);
        if (open && /#open-\d+$/.test(open.id) && severity) open.severity = severity;
      }
    }
  }

  const commits = runCommits(common, id, runGit);
  const units = parseTable(read(join(runDir, "units.md"))).map((r) => {
    const unit = cell(r, "unit");
    const state = cell(r, "state");
    const committed = /^committed\s+([0-9a-f]{7,40})\b/i.exec(state);
    const blocked = /^blocked\b:?\s*(.*)$/i.exec(state);
    const briefPath = join("units", unit, "brief.md");
    const briefText = read(join(runDir, briefPath));
    const own = commits?.filter((c) => c.unit === unit).map((c) => c.sha) ?? [];
    return {
      id: unit,
      pass: Number(cell(r, "pass").replace(/^p/, "")) || 1,
      state: committed ? "committed" : blocked ? "blocked" : state || "unknown",
      // git's sha when the commit is found by its trailer; units.md's as written otherwise.
      sha: own.at(-1) ?? committed?.[1] ?? null,
      recordedSha: committed?.[1] ?? null,
      commits: own,
      blockedWhy: blocked?.[1] ?? null,
      tree: cell(r, "tree"),
      title: cell(r, "title"),
      brief: briefText ? briefPath.replace(/\\/g, "/") : null,
      ...(briefText ? parseBrief(briefText) : { kind: "", blockedBy: [], sections: null, closes: [] }),
      launches: launches.filter((l) => l.unit === unit).map((l) => l.id),
      checks: checkLines(join(runDir, "units", unit), ""),
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

  const gates = readJsonl(join(runDir, "gates.jsonl"));
  const decisionLog = readJsonl(join(runDir, "decisions.jsonl"));
  const human = readJsonl(join(runDir, "human.jsonl")).filter((h) => HUMAN_VERDICTS.includes(h.verdict) && (h.finding || h.launch || h.journal));

  // A VERDICT line names a finding by its id, or by the short id its pass's review gave it once.
  for (const v of verdicts) {
    if (findings.has(v.id)) v.matched = v.id;
    else if (v.stage.endsWith("-verdict")) {
      const review = v.stage.replace(/-verdict$/, "-review");
      const same = [...findings.values()].filter((f) => f.stage === review && f.local.replace(/~\d+$/, "") === v.id);
      v.matched = same.length === 1 ? same[0].id : null;
    } else v.matched = null;
  }

  // Surface slugs as Map named them: the `craft <surface>` launches, the frames, the SHAPE files.
  const known = new Set([
    ...launches.map((l) => /^craft (.+)$/.exec(l.description)?.[1]).filter(Boolean),
    ...shotsOf(runDir).map((s) => s.surface).filter(Boolean),
    ...(existsSync(join(runDir, "surfaces")) ? readdirSync(join(runDir, "surfaces")).filter((f) => f.endsWith(".md")).map((f) => f.replace(/\.md$/, "")) : []),
  ]);
  const surfaces = {};
  for (const a of audits) {
    const audit = /\baudit (\d+)\/(\d+)/.exec(a.line);
    const critique = /\bcritique (\d+)\/(\d+)/.exec(a.line);
    a.surface = null;
    if (!audit && !critique) continue;
    // Map's baseline and each Assess name the surface in the description; Review's critic on each AUDIT line.
    const named = /^craft (.+)$/.exec(launches.find((l) => l.id === a.launch)?.description ?? "")?.[1];
    const text = slug(a.line.split(/\s+(?:audit|critique)\s+\d/)[0]);
    a.surface = named ?? ([...known].filter((k) => text === k || text.startsWith(`${k}-`) || text.endsWith(`-${k}`) || text.includes(`-${k}-`)).sort((x, y) => y.length - x.length)[0] ?? text);
    (surfaces[a.surface] ??= []).push({
      stage: a.stage,
      launch: a.launch,
      audit: audit ? Number(audit[1]) : null,
      auditMax: audit ? Number(audit[2]) : null,
      critique: critique ? Number(critique[1]) : null,
      critiqueMax: critique ? Number(critique[2]) : null,
    });
  }

  // The orchestrator: the sessions common.md names, the newest one's launches still in flight.
  const sessions = common.sessions.map((s) => ({ id: s, paths: sessionPaths(s) }));
  const running = runningLaunches(id, launches, sessions.at(-1)?.paths?.subagents);
  const mains = sessions.map((s) => s.paths?.main).filter(Boolean);
  const orchestrator = {
    sessions: sessions.map((s) => ({ id: s.id, transcript: s.paths?.main ?? null, transcriptGone: !s.paths?.main })),
    spend: mains.length ? mains.map(spendOf).reduce((a, b) => Object.fromEntries(Object.keys(a).map((k) => [k, a[k] + b[k]]))) : null,
  };

  let updated = 0;
  const touch = (path) => {
    try {
      updated = Math.max(updated, statSync(path).mtimeMs);
    } catch {}
  };
  for (const f of ["common.md", "journal.md", "units.md", "launches.md", "passes.md", "gates.jsonl", "marks.jsonl", "decisions.jsonl", "human.jsonl", "report.md"]) touch(join(runDir, f));
  for (const d of ["findings", "logs", "reports"]) if (existsSync(join(runDir, d))) for (const f of readdirSync(join(runDir, d))) touch(join(runDir, d, f));

  return {
    runDir,
    id,
    common,
    mirror: Boolean(common.start) && !samePath(join(common.start, ".claude", "fsloop", "runs", id), runDir),
    launches,
    findings,
    verdicts,
    audits,
    surfaces,
    judges,
    judged,
    deploys,
    decisions,
    repeaters,
    rowsByStage,
    units,
    commits,
    journal,
    passes,
    gates,
    marks: readJsonl(join(runDir, "marks.jsonl")).filter((m) => m.step && m.at),
    decisionLog,
    human,
    shots: shotsOf(runDir),
    logs: checkLines(join(runDir, "logs"), "logs/"),
    running,
    orchestrator,
    updatedAt: isoOf(updated || null),
  };
}

/** The orchestrator's launches not saved yet: top-level transcripts of its session whose prompt names this run. */
function runningLaunches(runId, launches, dir) {
  if (!dir) return [];
  const saved = new Set(launches.map((l) => l.agentId).filter(Boolean));
  const names = namesRun(runId);
  const out = [];
  for (const file of readdirSync(dir)) {
    if (!file.endsWith(".meta.json")) continue;
    const agentId = file.replace(/^agent-/, "").replace(/\.meta\.json$/, "");
    if (saved.has(agentId)) continue;
    const meta = readMeta(join(dir, file));
    if (meta.parentAgentId) continue;
    const path = join(dir, `agent-${agentId}.jsonl`);
    const first = firstLine(path);
    if (!names.test(first)) continue;
    const stat = statSync(path);
    const startedAt = /"timestamp":"([^"]+)"/.exec(first)?.[1] ?? isoOf(stat.birthtimeMs);
    // A launch relaunched under its description and saved since is no longer in flight.
    if (launches.some((l) => l.description === meta.description && l.startedAt && l.startedAt >= startedAt)) continue;
    out.push({ agentId, description: meta.description ?? null, agent: meta.agentType ?? null, startedAt, lastAt: isoOf(stat.mtimeMs), finished: typeof meta.finished === "boolean" ? meta.finished : null });
  }
  return out.sort((a, b) => (a.startedAt ?? "").localeCompare(b.startedAt ?? ""));
}

const refsOf = (row) => row.refs.split(/[\s,;]+/).filter(Boolean);
const journalRow = (run, ref) => run.journal.find((r) => `j${r.n}` === ref) ?? null;
const lastGate = (run, stage) => run.gates.filter((g) => g.stage === stage).at(-1) ?? null;
export const HELD = "— it holds the push";
/** A red integrate gate whose every line is a held finding: the push waits, the run finishes. */
export const heldPush = (g) => Boolean(g && !g.green && g.problems?.length && g.problems.every((p) => p.endsWith(HELD)));
const isGreen = (run, stage) => lastGate(run, stage)?.green === true;
const closers = (run, findingId) => run.units.filter((u) => u.closes.includes(findingId));

/** What a ref or a journal ref names: `j<n>` a journal row, `law:<file> <rule>`, a finding, a question to judge,
 * an unparsed report line, a unit, a launch, a pass — else free text. */
export function refKind(run, ref) {
  if (orNull(ref) === null) return null;
  if (/^j\d+$/.test(ref)) return "journal";
  if (/^law:\S+\s+\S/.test(ref)) return "law";
  if (/#judge-\d+$/.test(ref)) return "judge";
  if (/#line-\d+$/.test(ref)) return "line";
  if (run.findings.has(ref)) return "finding";
  if (run.units.some((u) => u.id === ref)) return "unit";
  if (run.launches.some((l) => l.id === ref)) return "launch";
  if (/^p\d+$/.test(ref)) return "pass";
  return "text";
}

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
  if (step === "finish") {
    if (heldPush(lastGate(run, "integrate"))) return [];
    if (isGreen(run, "integrate")) {
      const line = runPushLine(run) ?? "";
      if (/exit 0\b/.test(line)) return [];
      const skip = skippedPushRef(line);
      if (skip) return journalRow(run, skip) ? [] : [`logs/push.log.lines: push skipped by instruction ${skip} — journal.md has no row # ${skip.slice(1)}`];
      return ["integrate is green but logs/push.log.lines has no `push` line that exited 0 or `skipped — by instruction j<n>` — push first"];
    }
    return [lastGate(run, "integrate") ? "integrate is red for more than held findings — settle the rest, gate it again" : "integrate has no gate yet"];
  }
  // A later pass may skip Map and Spike: a step it ran has a launch or a green gate, a red attempt alone is no run.
  const gated = (s) => run.gates.some((g) => g.stage === s && g.green) || run.launches.some((l) => l.stage === s);
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

/** A FINDINGS or VERDICT line no grammar reads is settled by a journal row whose refs name its `#line-<k>`. */
function checkUnparsed(run, stage) {
  return run.launches
    .filter((l) => l.stage === stage)
    .flatMap((l) => l.unparsed)
    .filter((u) => !run.journal.some((r) => refsOf(r).includes(u.id)))
    .map((u) => `${u.id}: "${u.text}" under ${u.section} is no ${u.section === "VERDICT" ? "verdict" : "finding"} line — a journal row refs it with what it is, or relaunch`);
}

/** A journal row is cited as `j<n>`: two rows under one `#` make that ambiguous. */
function checkJournal(run) {
  const count = new Map();
  for (const r of run.journal) count.set(r.n, (count.get(r.n) ?? 0) + 1);
  return [...count].filter(([n, k]) => !n || k > 1).map(([n, k]) => (n ? `journal.md: # ${n} on ${k} rows — j${n} must name one` : "journal.md: a row with no #"));
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
    const f = run.findings.get(row.finding);
    if (stage === "integrate" && f.own && row.decision === "fix")
      problems.push(`${where}: a check Integrate can still fix is no finding — the run's own is open, or a candidate when flaky`);
    if (f.own && !f.severity) problems.push(`${where}: the run's own finding needs a severity column — critical, major or minor`);
    if (f.own && !f.evidence) problems.push(`${where}: the run's own finding needs an evidence column — the log line that shows it, logs/<log>.lines:<n>`);
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
    if (["dropped", "declined"].includes(row.decision)) {
      const kind = refKind(run, row.ref);
      if (!kind) problems.push(`${where}: ${row.decision} needs a ref — j<n> (the journal row), the finding it rests on, or law:<file> <rule>`);
      else if (kind === "journal" && !journalRow(run, row.ref)) problems.push(`${where}: ref ${row.ref} — journal.md has no row # ${row.ref.slice(1)}`);
      else if (!["journal", "finding", "law"].includes(kind) || row.ref === row.finding)
        problems.push(`${where}: ref "${row.ref}" is not j<n>, another finding's id or law:<file> <rule>`);
    }
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

// Statuses a run gave up on: they hold the push. A `fixed` finding holds it until some check saw it (closedBy).
const GAVE_UP = ["open", "blocked", "unresolved"];
const SETTLED = ["closed", "candidate", "dropped", "declined", "duplicate"];
const holdsPushScope = (f) => Boolean(f) && ["critical", "major"].includes(f.severity) && /-(review|verdict)$|^integrate$/.test(f.stage);

/** What still stands between `stage` and done; empty → green. */
export function gate(run, stage, { commitMessage = defaultCommitMessage } = {}) {
  const parsed = parseStage(stage);
  if (!parsed) return [`unknown stage "${stage}" — p<n>-{${STEPS.join("|")}}, integrate, finish or init`];
  if (parsed.step === "init") return [...checkLaunches(run, stage), ...checkInit(run)];
  const { pass, step } = parsed;
  const problems = [...prerequisites(run, stage), ...checkLaunches(run, stage), ...checkUnparsed(run, stage), ...checkDecisions(run, stage), ...checkJournal(run)];
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
  // A finding a later one repeats speaks through the end of that chain; within this scope, the later one speaks.
  if (step === "integrate") {
    for (const f of run.findings.values()) {
      if (!holdsPushScope(f)) continue;
      let s = statusOf(run, f);
      if (s.status === "repeated" || (s.status === "unresolved" && run.repeaters.has(f.id))) {
        const e = effectiveOf(run, f.id, (id) => statusOf(run, run.findings.get(id)));
        if (holdsPushScope(run.findings.get(e.id))) continue;
        s = e;
      }
      if (SETTLED.includes(s.status) || (s.status === "fixed" && s.closedBy)) continue;
      // Only a finding the run gave up on holds the push; one still on its way to a fix is work left.
      if (GAVE_UP.includes(s.status)) problems.push(`${f.id}: ${f.severity}, ${s.status} ${HELD}`);
      else if (HOLDS_PUSH.includes(s.status)) problems.push(`${f.id}: ${f.severity}, ${s.status} — settle it before the push`);
    }
  }
  // Each question an implementer left to judge is answered by the next critic, or recorded open in the journal:
  // units' at Review, fix units' at the verdicts (with N, Assess takes no prior work — the journal), Integrate's own.
  const asked = { review: `p${pass}-units`, verdict: `p${pass}-fix`, assess: `p${pass}-fix`, integrate: "integrate" }[step];
  if (asked) {
    const answered = new Set(run.judged.filter((j) => j.stage === stage && step !== "assess").map((j) => j.id));
    for (const q of run.judges.filter((j) => j.stage === asked))
      if (!answered.has(q.id) && !run.journal.some((r) => refsOf(r).includes(q.id)))
        problems.push(`${q.id}: to judge "${q.text}" — no JUDGED line opens with its id, no journal row refs it`);
  }
  if (step === "finish") {
    const report = read(join(run.runDir, "report.md"));
    if (!report) problems.push("no report.md");
    else if (!report.includes(TABLES_START)) problems.push("report.md has no tables of fsl.mjs report — run it");
    problems.push(...checkTrees(run));
  }
  return problems;
}

export function checkTrees(run, runGit = git) {
  const { mode, worktree: wt, start } = run.common;
  if (mode !== "worktree" || !wt || !start) return [];
  const same = (p) => resolve(p).toLowerCase() === resolve(wt).toLowerCase();
  const ofRun = (p) => same(p) || resolve(p).toLowerCase().startsWith(`${resolve(wt).toLowerCase()}-`);
  const branch = `fsl/${run.id}`;
  const branches = (runGit(start, ["branch", "--list", "--format=%(refname:short)", branch, `${branch}-*`]) ?? "").split(/\r?\n/).filter(Boolean);
  const head = runGit(start, ["symbolic-ref", "--short", "refs/remotes/origin/HEAD"])?.trim();
  const kept = branches.includes(branch) && !(head && runGit(start, ["merge-base", "--is-ancestor", branch, head]) !== null);
  const parent = dirname(wt);
  const folders = existsSync(parent) ? readdirSync(parent).map((f) => join(parent, f)).filter((p) => ofRun(p) && statSync(p).isDirectory()) : [];
  const listed = (runGit(start, ["worktree", "list", "--porcelain"]) ?? "").split(/\r?\n/).filter((l) => l.startsWith("worktree ")).map((l) => nativePath(l.slice(9))).filter(ofRun);
  const problems = [];
  for (const p of new Set([...folders, ...listed].map((p) => resolve(p))))
    if (!(kept && same(p))) problems.push(`${p} is still ${listed.some((l) => resolve(l) === p) ? "a worktree" : "a folder on disk"} — remove it (SKILL.md → Removal)`);
  for (const b of branches) if (!(kept && b === branch)) problems.push(`branch ${b} still exists — git branch -D it (SKILL.md → Removal)`);
  return problems;
}

const HOLDS_PUSH = ["open", "queued", "in-progress", "undecided", "fixed"];

/** The roles of SKILL.md → Project facts: the config's Commands table has a row for each. */
export const COMMAND_ROLES = ["default", "install", "type-check", "lint", "test, one file", "unit tests", "guards", "suite", "build", "migrate", "worker", "machine lock", "production shape", "shots", "find-polluter", "impeccable"];

/** The roles init runs (init.md step 3); the rest are named, not run. */
const RUN_ROLES = ["install", "type-check", "lint", "test, one file", "unit tests", "guards", "suite", "build", "migrate", "worker", "machine lock", "impeccable"];
export const roleSlug = (role) => role.replace(/[\s,]+/g, "-");

const sectionOf = (text, heading) => {
  const m = new RegExp(`^## ${heading}\\s*\\r?\\n([\\s\\S]*?)(?=^## |(?![\\s\\S]))`, "m").exec(text);
  return m ? m[1].trim() : null;
};

/** A cell or section with nothing to state: `none — <why>`, or a bare `—`. */
const isNone = (text) => /^(?:-\s*)?(?:none\b|—)/i.test(text);

// The proof is pinned to bare FRAME lines, but a list dash, bold or a backticked path still reads as one.
const FRAME_LINE = /^[\s>*_-]*FRAME[*_]*:[*_]*\s*`?([^\s`]+?)`?\s+[*_`]*(ok|bad)\b/gim;

/** init.md → Done: the config this run verified, each command with the outcome of its run, the shot recipe proven. */
function checkInit(run) {
  // The config is written in the worktree and lands in the start checkout with the push.
  const tree = run.common.worktree ?? run.common.start;
  const path = tree ? join(tree, ".claude", "fsloop", "config.md") : null;
  const text = path ? read(path) : "";
  if (!text) return [`no ${path ?? "config.md — common.md has no Start:"}`];
  const problems = [];
  if (!new RegExp(`^Verified: .*\\brun ${run.id}\\b`, "m").test(text)) problems.push(`config.md: no "Verified: <date> · <sha> · run ${run.id}" line`);
  const commands = sectionOf(text, "Commands");
  if (commands === null) problems.push("config.md: no ## Commands");
  else {
    const rows = parseTable(commands);
    for (const role of COMMAND_ROLES) {
      const row = rows.find((r) => cell(r, "role") === role);
      if (!row) problems.push(`config.md Commands: no row "${role}"`);
      // The proof of a command is its run's log in this run folder, never a line of the config.
      else if (RUN_ROLES.includes(role) && !isNone(cell(row, "command")) && !existsSync(join(run.runDir, "logs", `init-${roleSlug(role)}.log.lines`)))
        problems.push(`config.md Commands ${role}: never run — no logs/init-${roleSlug(role)}.log.lines`);
    }
  }
  for (const heading of ["Shared catalogs", "Roles", "Design"]) if (!sectionOf(text, heading)) problems.push(`config.md: no ## ${heading}, or it is empty — write - none — <why>`);
  const shots = sectionOf(text, "Shots");
  if (!shots) problems.push("config.md: no ## Shots");
  else if (!isNone(shots)) {
    // The recipe is proven by frames in this run folder that the proof read ok; the config holds the recipe alone.
    // With login `—` (no sign-in, or no test user) the page behind a session is not the recipe's to reach.
    const need = ["init-public", ...(/(?:^|[\s·])login:\s*`?—/im.test(shots) ? [] : ["init-authed"]), "init-dialog"].map((n) => `shots/${n}.png`);
    const proof = run.launches.filter((l) => l.stage === "init" && l.description === "shots proof").at(-1);
    // A frame is named relative to the run folder; an absolute path that ends so counts as the same frame.
    const frameName = (p) => {
      const m = /(?:^|[\\/])shots[\\/](init-[\w.-]+\.png)$/.exec(p);
      return m ? `shots/${m[1]}` : p;
    };
    const verdicts = proof ? Object.fromEntries([...read(join(run.runDir, proof.report)).matchAll(FRAME_LINE)].map((m) => [frameName(m[1]), m[2].toLowerCase()])) : {};
    const status = need.map((f) => [f, !existsSync(join(run.runDir, f)) ? "missing" : (verdicts[f] ?? "unread")]);
    const short = status.filter(([, s]) => s !== "ok");
    if (short.length)
      problems.push(
        `Shots: ${need.length - short.length} of ${need.length} frames read ok by a "shots proof" launch${proof ? "" : " (none saved)"} — ${short.map(([f, s]) => `${f} ${s}`).join(", ")}; or ## Shots is - none — <why>`,
      );
  }
  return problems;
}

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
  return run.verdicts.filter((v) => v.matched === findingId).at(-1) ?? null;
}

// ── statuses ──────────────────────────────────────────────────────────────────────────────────
//
// status — the finding's own fate:
//   undecided · candidate · dropped · declined · duplicate · open   (no row, or the row's decision)
//   queued       decided fix; no unit takes it yet (at Integrate: no `integrate fix` launch saved after it)
//   in-progress  its unit is drafted or being built
//   blocked      its unit is blocked
//   fixed        landed; `closedBy` says what saw it since: not-reraised (a later critic of the built result
//                did not raise it again — Review of a u-unit's surface, or Assess), integrate-recheck (the
//                merge's critic ran after the fix), or null (nothing yet)
//   closed       a verdict scored it resolved — closedBy verdict; the only proof that reads the finding itself
//   unresolved   a verdict scored it partial or unresolved
//   repeated     a later finding names it under `repeat`: the fix did not hold
// effectiveStatus — the fate of what a duplicate repeats, or of the finding that repeated it, to the chain's end;
// supersededBy names that end when it is another finding.

const isFixLaunch = (l) => /^integrate (?:fix|debug)$/.test(l.description);

function statusOf(run, f) {
  const d = run.decisions.get(f.id);
  if (!d) return { status: "undecided" };
  if (d.decision !== "fix") return { status: d.decision };
  const repeated = run.repeaters.has(f.id);
  if (f.stage === "integrate") {
    const verdict = verdictOf(run, f.id);
    if (verdict) return { status: verdict.result === "resolved" ? "closed" : "unresolved", closedBy: verdict.result === "resolved" ? "verdict" : null, checkedBy: verdict.launch, verdict };
    const at = run.launches.findIndex((l) => l.id === f.launch);
    const fix = run.launches.findIndex((l, i) => i > at && isFixLaunch(l));
    if (fix < 0) return { status: "queued" };
    if (repeated) return { status: "repeated" };
    const recheck = run.launches.find((l, i) => i > fix && l.stage === "integrate" && l.description.startsWith("critic "));
    return recheck ? { status: "fixed", closedBy: "integrate-recheck", checkedBy: recheck.id } : { status: "fixed" };
  }
  let by = closers(run, f.id);
  // An OPEN line taken by the unit that raised it names that unit as ref; no brief lists it.
  if (!by.length && /^[uf]\d+$/.test(d.ref)) by = run.units.filter((u) => u.id === d.ref);
  if (!by.length) return { status: "queued" };
  const unit = by.at(-1);
  if (unit.state === "blocked") return { status: "blocked", unit: unit.id };
  if (unit.state !== "committed") return { status: "in-progress", unit: unit.id };
  const verdict = verdictOf(run, f.id);
  if (verdict) return { status: verdict.result === "resolved" ? "closed" : "unresolved", closedBy: verdict.result === "resolved" ? "verdict" : null, checkedBy: verdict.launch, unit: unit.id, verdict };
  if (repeated) return { status: "repeated", unit: unit.id };
  // A critic that read the built result after the unit landed and raised it no more — weaker than a verdict.
  const checks = [...(unit.id.startsWith("u") ? [`p${unit.pass}-review`] : []), ...(run.common.N ? [`p${unit.pass}-assess`] : [])].filter((s) => s !== f.stage && isGreen(run, s));
  if (checks.length) return { status: "fixed", closedBy: "not-reraised", checkedBy: checks.at(-1), unit: unit.id };
  return { status: "fixed", unit: unit.id };
}

/** The status at the end of a finding's duplicate and repeat chain, with that finding's id. */
function effectiveOf(run, id, status, seen = new Set()) {
  const own = { id, ...status(id) };
  if (seen.has(id)) return own;
  seen.add(id);
  const d = run.decisions.get(id);
  if (d?.decision === "duplicate" && run.findings.has(d.ref)) return effectiveOf(run, d.ref, status, seen);
  const next = run.repeaters.get(id);
  if (next && run.findings.has(next)) return effectiveOf(run, next, status, seen);
  return own;
}

// ── build ─────────────────────────────────────────────────────────────────────────────────────

let generatorHash = null;
const generator = () => ({ fsl: (generatorHash ??= createHash("sha1").update(readFileSync(fileURLToPath(import.meta.url))).digest("hex").slice(0, 12)) });

/** The stage after `stage` in this run's order; the first when none is done. */
function nextStage(run, stage) {
  if (!stage) return run.common.mode === "init" ? "init" : "p1-map";
  const { pass, step } = parseStage(stage);
  if (step === "init" || step === "finish") return null;
  if (step === "integrate") return "finish";
  const N = run.common.N;
  if (step === (N ? "assess" : "verdict")) return N && run.passes.find((p) => p.pass === pass)?.outcome === "next" ? `p${pass + 1}-decompose` : "integrate";
  let i = STEPS.indexOf(step) + 1;
  if (STEPS[i] === (N ? "verdict" : "assess")) i++;
  return `p${pass}-${STEPS[i]}`;
}

/** Each stage the run reached — gated, launched or with a findings file — in the run's order, each gate kept. */
function stagesOf(run) {
  const names = [...new Set([...run.gates.map((g) => g.stage), ...run.launches.map((l) => l.stage), ...Object.keys(run.rowsByStage)])].filter(parseStage).sort(compareStages);
  const out = [];
  for (const stage of names) {
    const attempts = run.gates.filter((g) => g.stage === stage).map(({ at, green, problems }) => ({ at, green, problems: problems ?? [] }));
    const last = attempts.at(-1);
    const prev = out.at(-1);
    const prevDone = prev ? (prev.attempts.filter((a) => a.green).at(-1) ?? prev.attempts.at(-1))?.at : null;
    const firstLaunch = run.launches.filter((l) => l.stage === stage && l.startedAt).map((l) => l.startedAt).sort()[0] ?? null;
    out.push({
      stage,
      green: last ? last.green : null,
      at: last?.at ?? null,
      problems: last?.problems ?? [],
      startedAt: (prev ? prevDone : run.common.started) ?? firstLaunch,
      attempts,
    });
  }
  return out;
}

function nowOf(run, stages, closed) {
  if (closed) return { stage: null, since: null, waitingOn: null };
  // The held push leaves integrate red, yet done: Finish follows it.
  const done = (s) => s.green === true || (s.stage === "integrate" && heldPush(lastGate(run, "integrate")));
  const lastDone = stages.filter(done).at(-1) ?? null;
  const ahead = stages.filter((s) => !done(s) && (!lastDone || compareStages(s.stage, lastDone.stage) > 0)).at(-1);
  const stage = ahead?.stage ?? nextStage(run, lastDone?.stage ?? null);
  const entry = stages.find((s) => s.stage === stage);
  const mark = stage === "init" ? (run.marks.filter((m) => !m.end).at(-1) ?? null) : null;
  return {
    stage,
    step: mark?.step ?? null,
    since: mark?.at ?? entry?.startedAt ?? lastDone?.at ?? run.common.started ?? null,
    waitingOn: {
      running: run.running.length,
      units: run.units.filter((u) => !["committed", "blocked"].includes(u.state)).map((u) => ({ id: u.id, state: u.state })),
      lastRedGate: entry && entry.green === false ? { at: entry.at, problems: entry.problems } : null,
    },
  };
}

export const INIT_STEPS = ["bootstrap", "survey", "commands", "design", "shots", "config", "land"];
const TIMES_LINE = /^(.+?)\s+(\d+(?:\.\d+)?)\s*s\b/;
const ms = (iso) => (iso ? Date.parse(iso) : NaN);

export const formatSeconds = (s) => {
  if (s === null || s === undefined || Number.isNaN(s)) return "—";
  const n = Math.round(s);
  if (n < 60) return `${n} s`;
  const h = Math.floor(n / 3600);
  const m = Math.floor((n % 3600) / 60);
  const r = n % 60;
  return [h ? `${h} h` : "", m ? `${m} min` : "", r && !h ? `${r} s` : ""].filter(Boolean).join(" ");
};

const clock = (iso) => (iso ? iso.replace(/^.*T/, "").replace(/\.\d+Z$|Z$/, "") : "—");

function shotsTimes(run) {
  const l = run.launches.filter((x) => x.stage === "init" && x.description === "shots").at(-1);
  if (!l) return [];
  const block = blockSections(read(join(run.runDir, l.report)));
  return [block.TIMES?.value, ...(block.TIMES?.items ?? [])]
    .filter(Boolean)
    .map((line) => {
      const m = TIMES_LINE.exec(line);
      return m ? { label: m[1].trim(), seconds: Number(m[2]) } : null;
    })
    .filter(Boolean);
}

function perLog(lines) {
  const byFile = new Map();
  for (const l of lines) {
    const e = byFile.get(l.file) ?? byFile.set(l.file, { label: /^logs\/(?:init-)?(.+)\.log\.lines$/.exec(l.file)?.[1] ?? l.file, seconds: null, exit: 0, startedAt: null, endedAt: null }).get(l.file);
    if (l.seconds !== null) e.seconds = (e.seconds ?? 0) + l.seconds;
    if (l.exit) e.exit = l.exit;
    if (l.startedAt && (!e.startedAt || l.startedAt < e.startedAt)) e.startedAt = l.startedAt;
    if (l.endedAt && (!e.endedAt || l.endedAt > e.endedAt)) e.endedAt = l.endedAt;
  }
  return [...byFile.values()].sort((a, b) => (a.startedAt ?? "").localeCompare(b.startedAt ?? ""));
}

const detailOf = (xs) => xs.map((x) => `${x.label} ${formatSeconds(x.seconds)}${x.exit ? ` exit ${x.exit}` : ""}`).join(" · ") || "—";
const earliest = (isos) => isos.filter(Boolean).sort()[0] ?? null;
const latest = (isos) => isos.filter(Boolean).sort().at(-1) ?? null;
const sumSeconds = (xs) => (xs.some((x) => x.seconds !== null) ? xs.reduce((a, x) => a + (x.seconds ?? 0), 0) : null);

export function timelineOf(run, now = new Date().toISOString()) {
  const closed = isGreen(run, "finish") || (isGreen(run, "init") && /exit 0\b/.test(runPushLine(run) ?? ""));
  if (run.common.mode !== "init" && !run.marks.length) {
    const rows = stagesOf(run).map((s) => ({ step: s.stage, startedAt: s.startedAt, endedAt: s.green ? s.at : null, derived: false, detail: s.green === null ? "—" : s.green ? "green" : `red — ${s.problems.length}` }));
    return finishRows(rows, closed, now, run.common.started, []);
  }
  const logs = run.logs.filter((l) => l.n !== null);
  const launch = (d) => run.launches.filter((l) => l.stage === "init" && l.description === d);
  const bootstrap = [
    ...logs.filter((l) => l.file === "logs/init-bootstrap.log.lines").map((l) => ({ label: l.label, seconds: l.seconds, exit: l.exit, startedAt: l.startedAt, endedAt: l.endedAt })),
    ...perLog(logs.filter((l) => l.file === "logs/init-install.log.lines")),
  ];
  const roles = perLog(logs.filter((l) => /^logs\/init-(?!bootstrap|install)[\w-]+\.log\.lines$/.test(l.file)));
  const land = perLog(logs.filter((l) => /^logs\/land\.log\.lines$/.test(l.file)));
  const gates = run.gates.filter((g) => g.stage === "init");
  const times = shotsTimes(run);
  const launchDetail = (ls) => ls.map((l) => ({ label: `${l.description} (${(l.model ?? "").replace(/^claude-|-\d.*$/g, "")})`, seconds: l.seconds, exit: 0 }));
  const shotsLaunches = [...launch("shots"), ...launch("shots proof")];
  const sources = {
    bootstrap: { startedAt: earliest([...bootstrap.map((b) => b.startedAt), run.common.started]), endedAt: latest(bootstrap.map((b) => b.endedAt)), detail: detailOf(bootstrap) },
    survey: { startedAt: earliest(launch("map").map((l) => l.startedAt)), endedAt: latest(launch("map").map((l) => l.endedAt)), detail: detailOf(launchDetail(launch("map"))) },
    commands: { startedAt: earliest(roles.map((r) => r.startedAt)), endedAt: latest(roles.map((r) => r.endedAt)), detail: detailOf(roles) },
    design: { startedAt: null, endedAt: null, detail: "the user's interview" },
    shots: {
      startedAt: earliest(shotsLaunches.map((l) => l.startedAt)),
      endedAt: latest(shotsLaunches.map((l) => l.endedAt)),
      detail: [detailOf(times.map((t) => ({ ...t, exit: 0 }))), detailOf(launchDetail(shotsLaunches))].filter((d) => d !== "—").join(" · ") || "—",
    },
    config: { startedAt: null, endedAt: null, detail: "—" },
    land: {
      startedAt: earliest([...gates.map((g) => g.at), ...land.map((l) => l.startedAt)]),
      endedAt: latest([...gates.map((g) => g.at), ...land.map((l) => l.endedAt)]),
      detail: [gates.length ? `gate ${gates.map((g) => (g.green ? "green" : "red")).join(", ")}` : "", detailOf(land)].filter((d) => d && d !== "—").join(" · ") || "—",
    },
  };
  const rows = INIT_STEPS.map((step) => {
    const mark = run.marks.find((m) => m.step === step && !m.end) ?? null;
    const endMark = run.marks.find((m) => m.step === step && m.end) ?? null;
    const startedAt = mark?.at ?? sources[step].startedAt;
    return startedAt ? { step, startedAt, endedAt: endMark?.at ?? sources[step].endedAt, marked: Boolean(endMark), derived: !mark, detail: sources[step].detail } : null;
  }).filter(Boolean);
  const pick = (re) => times.find((t) => re.test(t.label))?.seconds ?? null;
  const installed = sumSeconds(bootstrap);
  const serve = pick(/^serve\b/);
  const raise = pick(/^raise\b/);
  const login = pick(/^login\b/);
  const shoot = pick(/^shoot\b/);
  const slowest = roles.filter((r) => r.seconds !== null).sort((a, b) => b.seconds - a.seconds)[0] ?? null;
  const spans = [
    { span: "worktree → installed", seconds: installed, from: bootstrap.map((b) => b.label).join(" + ") || null },
    installed !== null && serve !== null ? { span: "worktree → dev server ready", seconds: installed + (raise ?? 0) + serve, from: "installed + raise + serve" } : null,
    installed !== null && serve !== null && shoot !== null ? { span: "worktree → first frame", seconds: installed + (raise ?? 0) + serve + (login ?? 0) + shoot, from: "dev server ready + login + shoot" } : null,
    slowest ? { span: "slowest command", seconds: slowest.seconds, from: slowest.label } : null,
  ].filter(Boolean);
  const out = finishRows(rows, closed, now, run.common.started, spans);
  const design = out.rows.find((r) => r.step === "design");
  if (design && design.took !== null) out.spans.push({ span: "the user's time", seconds: design.took, from: "design" });
  return out;
}

function finishRows(rows, closed, now, started, spans) {
  rows.sort((a, b) => (a.startedAt ?? "").localeCompare(b.startedAt ?? ""));
  rows.forEach((r, i) => {
    const next = rows[i + 1]?.startedAt ?? null;
    r.endedAt = r.marked ? r.endedAt : latest([r.endedAt, next]);
    r.running = !closed && !r.endedAt;
    const end = r.endedAt ?? (r.running ? now : null);
    r.took = end ? Math.max(0, (ms(end) - ms(r.startedAt)) / 1000) : null;
  });
  const first = earliest([started, ...rows.map((r) => r.startedAt)]);
  const end = rows.length ? latest(rows.map((r) => r.endedAt ?? (r.running ? now : null))) : null;
  const total = first && end ? Math.max(0, (ms(end) - ms(first)) / 1000) : null;
  return { startedAt: first, endedAt: closed ? end : null, total, rows, spans };
}

export function renderTimeline(t) {
  const lines = ["| step | started (UTC) | took | detail |", "|---|---|---|---|"];
  for (const r of t.rows) lines.push(`| ${r.step}${r.derived ? " ~" : ""} | ${clock(r.startedAt)} | ${formatSeconds(r.took)}${r.running ? " …" : ""} | ${escapeCell(r.detail)} |`);
  lines.push(`| total | ${clock(t.startedAt)} | ${formatSeconds(t.total)}${t.endedAt ? "" : " …"} | ${t.rows.length} steps |`);
  if (t.spans.length) {
    lines.push("", "| span | took | from |", "|---|---|---|");
    for (const s of t.spans) lines.push(`| ${s.span} | ${formatSeconds(s.seconds)} | ${escapeCell(s.from ?? "—")} |`);
  }
  if (t.rows.some((r) => r.derived)) lines.push("", "~ a step with no mark: its start is read off its logs and launches");
  return lines.join("\n");
}

/** Init lands by its own list (init.md → Gate, land): its `push` line, else null. */
function runPushLine(run) {
  return read(join(run.runDir, "logs", run.common.mode === "init" ? "land.log.lines" : "push.log.lines"))
    .split(/\r?\n/)
    .filter((l) => /^\d+ push\b/.test(l))
    .at(-1) ?? null;
}

const skippedPushRef = (line) => /^\d+ push — skipped — by instruction (j\d+)\b/.exec(line ?? "")?.[1] ?? null;

function outcomeOf(run, findings, closed) {
  const pushLine = runPushLine(run);
  const pushed = Boolean(pushLine && /exit 0\b/.test(pushLine));
  const skippedBy = run.common.mode === "init" ? null : skippedPushRef(pushLine);
  const g = lastGate(run, "integrate");
  const held = heldPush(g) ? g.problems.map((p) => /^(\S+?):/.exec(p)?.[1]).filter(Boolean) : [];
  const deploy = run.deploys.at(-1) ?? null;
  const left = findings.some((f) => ["critical", "major"].includes(f.severity) && [...GAVE_UP, "repeated"].includes(f.effectiveStatus));
  // Met in full: pushed, nothing held, the deploy ok when checked, no critical or major finding left standing.
  const goalMet = !closed ? null : run.common.mode === "init" ? pushed : (pushed || Boolean(skippedBy)) && !held.length && (!deploy || deploy.verdict === "ok") && !left;
  return { pushed, pushLine, skippedBy, held, deploy, goalMet };
}

export function build(run) {
  const statusCache = new Map();
  const status = (id) => {
    if (!statusCache.has(id)) statusCache.set(id, statusOf(run, run.findings.get(id)));
    return statusCache.get(id);
  };
  const humanFor = (key, id) => {
    const lines = run.human.filter((h) => String(h[key]).replace(/^j(?=\d)/, "") === String(id)).map(({ verdict, note, at }) => ({ verdict, note: note ?? null, at: at ?? null }));
    return lines.length ? lines : null;
  };
  const history = new Map();
  for (const e of run.decisionLog)
    (history.get(e.finding) ?? history.set(e.finding, []).get(e.finding)).push(compact({ decision: e.to, ref: e.ref, repeat: e.repeat, why: e.why, at: e.at }));
  // The versions of a finding's row before the one it holds now, and when that one was first seen.
  const versions = (id, d) => {
    const all = history.get(id) ?? [];
    const last = all.at(-1);
    const current = d && last && last.decision === d.decision && (last.ref ?? null) === orNull(d.ref) && (last.repeat ?? null) === orNull(d.repeat);
    return current ? { history: all.slice(0, -1), decidedAt: last.at } : { history: all, decidedAt: null };
  };
  const duplicates = new Map();
  for (const [id, d] of run.decisions) if (d.decision === "duplicate") (duplicates.get(d.ref) ?? duplicates.set(d.ref, []).get(d.ref)).push(id);

  const findings = [...run.findings.values()].map((f) => {
    const d = run.decisions.get(f.id);
    const s = status(f.id);
    const e = effectiveOf(run, f.id, status);
    const kind = d ? refKind(run, d.ref) : null;
    const j = kind === "journal" ? journalRow(run, d.ref) : null;
    // The bulk of a big run's run.json: a key whose value is null, false or empty is left out.
    return compact({
      id: f.id,
      local: f.local,
      launch: f.launch,
      stage: f.stage,
      pass: parseStage(f.stage)?.pass ?? null,
      own: f.own,
      parsed: f.parsed,
      category: f.category ?? null,
      severity: f.severity ?? null,
      confidence: f.confidence ?? null,
      cause: f.cause ?? null,
      location: f.location ?? null,
      rule: f.rule ?? null,
      action: f.action ?? null,
      // A strict line is whole in its fields; a loose one keeps its words.
      raw: f.parsed === "loose" ? f.raw : null,
      evidence: f.evidence ?? null,
      decision: d?.decision ?? null,
      ref: d ? orNull(d.ref) : null,
      refKind: kind,
      refJournal: j ? { n: j.n, question: j.question, decision: j.decision, why: j.why } : null,
      repeat: d ? orNull(d.repeat) : null,
      why: d ? orNull(d.why) : null,
      ...versions(f.id, d),
      journal: run.journal.filter((r) => refsOf(r).includes(f.id)).map((r) => r.n),
      status: s.status,
      effectiveStatus: e.status,
      closedBy: s.closedBy ?? null,
      unit: s.unit ?? null,
      commits: run.commits?.filter((c) => c.closes.includes(f.id)).map((c) => c.sha) ?? [],
      verdict: s.verdict ? { launch: s.verdict.launch, result: s.verdict.result, evidence: s.verdict.evidence } : null,
      checkedBy: s.checkedBy ?? null,
      duplicateOf: d?.decision === "duplicate" ? d.ref : null,
      duplicates: duplicates.get(f.id) ?? [],
      repeatedBy: run.repeaters.get(f.id) ?? null,
      supersededBy: e.id !== f.id ? e.id : null,
      human: humanFor("finding", f.id),
    });
  });

  const stages = stagesOf(run);
  // A run is closed by its last stage: finish; /fsloop init by its gate and then its land list's push at exit 0.
  const closed = isGreen(run, "finish") || (isGreen(run, "init") && /exit 0\b/.test(runPushLine(run) ?? ""));
  const startedAt = run.common.started ?? run.launches.map((l) => l.startedAt).filter(Boolean).sort()[0] ?? null;
  return {
    version: VERSION,
    generator: generator(),
    id: run.id,
    legacy: false,
    mirror: run.mirror,
    goal: run.common.goal,
    mode: run.common.mode,
    N: run.common.N,
    K: run.common.K,
    start: run.common.start,
    worktree: run.common.worktree,
    sessions: run.common.sessions,
    startedAt,
    updatedAt: run.updatedAt,
    now: nowOf(run, stages, closed),
    outcome: outcomeOf(run, findings, closed),
    stages,
    closed,
    passes: run.passes,
    units: run.units.map(({ sections, ...u }) => u),
    commits: run.commits,
    launches: run.launches.map(({ reportMissing, ...l }) => ({ ...l, reportMissing, human: humanFor("launch", l.id) })),
    running: run.running,
    orchestrator: run.orchestrator,
    findings,
    verdicts: run.verdicts,
    judges: run.judges.map((q) => {
      const answer = run.judged.filter((j) => j.id === q.id).at(-1);
      const journal = run.journal.find((r) => refsOf(r).includes(q.id));
      return { ...q, answer: answer ? { launch: answer.launch, stage: answer.stage, text: answer.text, result: answer.result, finding: answer.finding } : null, journal: journal?.n ?? null };
    }),
    surfaces: run.surfaces,
    audits: run.audits,
    shots: run.shots,
    logs: run.logs,
    marks: run.marks,
    timeline: timelineOf(run),
    journal: run.journal.map((r) => ({ ...r, refs: refsOf(r).map((id) => ({ id, kind: refKind(run, id) })), human: humanFor("journal", r.n) })),
  };
}

/** The run list's row: what a UI shows before it opens run.json. */
export function summarize(json) {
  const count = (xs, key) => xs.reduce((m, x) => ((m[x[key] ?? "none"] = (m[x[key] ?? "none"] ?? 0) + 1), m), {});
  const spend = emptySpend();
  for (const l of json.launches ?? []) for (const k of Object.keys(spend)) spend[k] += l.spend[k] + (l.spend.children?.[k] ?? 0);
  if (json.legacy) return json;
  return {
    version: json.version,
    generator: json.generator,
    id: json.id,
    legacy: false,
    mirror: json.mirror,
    goal: json.goal,
    mode: json.mode,
    N: json.N,
    start: json.start,
    startedAt: json.startedAt,
    updatedAt: json.updatedAt,
    closed: json.closed,
    now: json.now,
    outcome: json.outcome,
    counts: {
      launches: json.launches.length,
      running: json.running.length,
      units: count(json.units, "state"),
      commits: json.commits?.length ?? null,
      findings: { total: json.findings.length, status: count(json.findings, "status"), effectiveStatus: count(json.findings, "effectiveStatus"), severity: count(json.findings, "severity") },
    },
    spend: { launches: spend, orchestrator: json.orchestrator.spend },
  };
}

/** A folder of an older version holds a report and little else: listed, never parsed as a run. */
function legacyJson(runDir) {
  const report = existsSync(join(runDir, "report.md"));
  let updated = null;
  try {
    updated = statSync(join(runDir, report ? "report.md" : ".")).mtimeMs;
  } catch {}
  return { version: VERSION, generator: generator(), id: basename(runDir), legacy: true, report: report ? "report.md" : null, updatedAt: isoOf(updated) };
}

/** Each change of a finding's row since the last one recorded — a findings file is edited in place. */
function recordDecisions(run, at) {
  const last = new Map();
  for (const e of run.decisionLog) last.set(e.finding, e);
  const changes = [];
  for (const [finding, row] of run.decisions) {
    const prev = last.get(finding);
    const next = { to: row.decision || null, ref: orNull(row.ref), repeat: orNull(row.repeat) };
    if (prev && prev.to === next.to && prev.ref === next.ref && prev.repeat === next.repeat) continue;
    changes.push({ finding, stage: row.stage, from: prev?.to ?? null, ...next, why: orNull(row.why), at });
  }
  for (const [finding, prev] of last)
    if (!run.decisions.has(finding) && prev.to !== null) changes.push({ finding, stage: prev.stage, from: prev.to, to: null, ref: null, repeat: null, why: null, at });
  if (changes.length) appendFileSync(join(run.runDir, "decisions.jsonl"), changes.map((c) => JSON.stringify(c)).join("\n") + "\n");
  run.decisionLog.push(...changes);
}

/** Written whole or not at all: a UI reading mid-write never sees half a file. */
function writeAtomic(path, text) {
  const tmp = `${path}.${process.pid}.tmp`;
  writeFileSync(tmp, text);
  for (let i = 0; ; i++)
    try {
      renameSync(tmp, path);
      return;
    } catch (e) {
      // Windows refuses the rename while a reader holds the file open; it lets go within moments.
      if (i >= 20 || !["EPERM", "EBUSY", "EACCES"].includes(e.code)) throw e;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 25);
    }
}

/** run.json and summary.json, after decisions.jsonl took the rows' changes. */
export function writeRunJson(runDir, { at = new Date().toISOString(), ...opts } = {}) {
  if (isLegacy(runDir)) {
    const json = legacyJson(runDir);
    writeAtomic(join(runDir, "run.json"), JSON.stringify(json) + "\n");
    writeAtomic(join(runDir, "summary.json"), JSON.stringify(json) + "\n");
    return json;
  }
  const run = collect(runDir, opts);
  recordDecisions(run, at);
  const json = build(run);
  writeAtomic(join(runDir, "run.json"), JSON.stringify(json) + "\n");
  writeAtomic(join(runDir, "summary.json"), JSON.stringify(summarize(json)) + "\n");
  return json;
}

// ── report ────────────────────────────────────────────────────────────────────────────────────

export const TABLES_START = "<!-- fsl.mjs report: from the run folder; regenerated, never edited -->";
const TABLES_END = "<!-- /fsl.mjs report -->";

const mdTable = (header, rows) =>
  rows.length
    ? [`| ${header.join(" | ")} |`, `|${header.map(() => "---").join("|")}|`, ...rows.map((r) => `| ${r.map(escapeCell).join(" | ")} |`)].join("\n")
    : "—";

/** `fixed (not-reraised)`, `repeated → closed (<the finding that carried it>)`. */
const fate = (f) =>
  [f.status === "fixed" && f.closedBy ? `fixed (${f.closedBy})` : f.status, f.supersededBy ? `→ ${f.effectiveStatus} (${f.supersededBy})` : ""].filter(Boolean).join(" ");

/** The report's tables that the run folder already holds, written between markers in report.md. */
export function reportTables(json) {
  const sections = [
    ["Decisions", mdTable(["#", "stage", "question", "decision", "why"], json.journal.map((r) => [r.n, r.stage, r.question, r.decision, r.why]))],
    ["Units", mdTable(["unit", "pass", "title", "kind", "state", "sha", "closes"], json.units.map((u) => [u.id, u.pass, u.title, u.kind, u.state === "blocked" ? `blocked: ${u.blockedWhy}` : u.state, u.sha ?? "—", u.closes.join(" ") || "—"]))],
    ["Findings", mdTable(["finding", "severity", "rule", "decision", "unit", "status"], json.findings.map((f) => [f.id, f.severity ?? "—", f.rule ?? f.raw ?? f.why, f.decision ?? "—", f.unit ?? "—", fate(f)]))],
    ["To judge", mdTable(["question", "asked", "answer"], json.judges.map((q) => [q.id, q.text, q.answer ? q.answer.text : q.journal ? `open — journal #${q.journal}` : "—"]))],
    ["Candidates", mdTable(["finding", "why"], json.findings.filter((f) => f.decision === "candidate").map((f) => [f.id, f.why]))],
  ];
  if (json.N) sections.push(["Passes", mdTable(["pass", "critical+major", "outcome", "why"], json.passes.map((p) => [`p${p.pass}`, p.criticalMajor, p.outcome, p.why]))]);
  const scores = Object.entries(json.surfaces).map(([s, row]) => [s, row.map((r) => `${r.stage} ${r.audit ?? "?"}/${r.auditMax ?? "?"} · ${r.critique ?? "?"}/${r.critiqueMax ?? "?"}`).join(" → ")]);
  if (scores.length) sections.push(["Surfaces (audit · critique)", mdTable(["surface", "baseline → now"], scores)]);
  return [TABLES_START, ...sections.map(([h, t]) => `\n## ${h}\n\n${t}`), "", TABLES_END].join("\n");
}

export function writeReport(runDir) {
  const path = join(runDir, "report.md");
  const tables = reportTables(build(collect(runDir)));
  const text = read(path);
  const start = text.indexOf(TABLES_START);
  const end = text.indexOf(TABLES_END);
  const next = start >= 0 && end > start ? text.slice(0, start) + tables + text.slice(end + TABLES_END.length) : `${text.trimEnd()}${text ? "\n\n" : ""}${tables}\n`;
  writeFileSync(path, next);
}

// ── save ──────────────────────────────────────────────────────────────────────────────────────

const escapeCell = (s) => String(s ?? "—").replace(/\|/g, "\\|").replace(/\r?\n/g, " ");

export const LAUNCH_COLUMNS = ["launch", "stage", "agent", "description", "model", "started", "ended", "seconds", "input", "output", "cache write", "cache read", "children", "children input", "children output", "children cache write", "children cache read", "agent id", "transcript", "report"];

export function save(runDir, stage, ref, descriptionGiven) {
  if (!parseStage(stage)) throw new Error(`unknown stage "${stage}"`);
  const runId = parseCommon(read(join(runDir, "common.md"))).run ?? basename(runDir);
  const transcript = findTranscript(ref, runId);
  if (!transcript)
    throw new Error(`no transcript for ${ref} — no agent by that id, no such file, no launch of run ${runId} by that description; relaunch it`);
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
  try {
    // Exclusive create: a second save racing the first never writes the header twice.
    writeFileSync(launchesPath, `| ${LAUNCH_COLUMNS.join(" | ")} |\n|${LAUNCH_COLUMNS.map(() => "---").join("|")}|\n`, { flag: "wx" });
  } catch (e) {
    if (e.code !== "EEXIST") throw e;
  }
  const c = childSpend(transcript);
  const values = {
    launch: id,
    stage,
    agent: t.agent,
    description,
    model: t.model,
    started: t.startedAt,
    ended: t.endedAt,
    seconds: t.seconds,
    input: t.spend.input,
    output: t.spend.output,
    "cache write": t.spend.cacheWrite,
    "cache read": t.spend.cacheRead,
    children: c.launches,
    "children input": c.input,
    "children output": c.output,
    "children cache write": c.cacheWrite,
    "children cache read": c.cacheRead,
    "agent id": t.agentId,
    transcript,
    report,
  };
  // A folder an older fsl.mjs started keeps its header: the row follows it, the columns it lacks left out.
  const columns = tableHeader(read(launchesPath)) ?? LAUNCH_COLUMNS;
  appendFileSync(launchesPath, `| ${columns.map((k) => escapeCell(values[k])).join(" | ")} |\n`);
  return { id, report, existed: false };
}

// ── cli ───────────────────────────────────────────────────────────────────────────────────────

const USAGE = `usage:
  node fsl.mjs save  <run folder> <stage> <agent id | output_file | "<description>"> ["<description>"]
                     file a launch's final block; by description on Resume; the last argument names a launch with no meta file
  node fsl.mjs gate   <run folder> <stage>   is the stage done? exit 1 when not
  node fsl.mjs report <run folder>           write the run folder's tables into report.md
  node fsl.mjs build  <run folder>           write run.json and summary.json
  node fsl.mjs mark   <run folder> <step> [end]   stamp the start of an init step — ${INIT_STEPS.join(" | ")} — or, with end, its end (design: the interview has no artifact)
  node fsl.mjs timeline <run folder>         the run by step — started, took, what each command and launch took
stage: p<n>-{${STEPS.join("|")}} | integrate | finish | init`;

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
      for (const q of collect(runDir).judges.filter((j) => j.launch === r.id)) console.log(`to judge ${q.id}: ${q.text}`);
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
  if (command === "report") {
    writeReport(runDir);
    writeRunJson(runDir);
    console.log(`tables → ${join(runDir, "report.md")}`);
    return 0;
  }
  if (command === "build") {
    writeRunJson(runDir);
    console.log(`run.json, summary.json → ${runDir}`);
    return 0;
  }
  if (command === "mark") {
    const [step, end] = rest;
    if (!step || (end && end !== "end")) return (console.error(USAGE), 4);
    mkdirSync(runDir, { recursive: true });
    const at = new Date().toISOString();
    appendFileSync(join(runDir, "marks.jsonl"), JSON.stringify(end ? { step, at, end: true } : { step, at }) + "\n");
    if (existsSync(join(runDir, "common.md"))) writeRunJson(runDir);
    console.log(`mark ${step}${end ? " end" : ""} ${at}`);
    return 0;
  }
  if (command === "timeline") {
    console.log(renderTimeline(timelineOf(collect(runDir))));
    return 0;
  }
  console.error(USAGE);
  return 4;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = main(process.argv.slice(2));
