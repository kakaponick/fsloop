// Run folders for fsloopUI's tests and frames, written the way an fsloop run writes them; run.json and
// summary.json come from fsl.mjs's own collect and build, so the record is the skill's, not ours.
//   node fixtures/make.ts [<dir>] [--now=<ISO time>]   — the fixture root (default fixtures/root), mtimes from now
import { createHash } from "node:crypto";
import { mkdirSync, readdirSync, rmSync, statSync, utimesSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { crc32, deflateSync } from "node:zlib";
import { build, collect, parseBrief, summarize, timelineOf } from "../../skills/fsloop/fsl.mjs";

// ── one run folder ───────────────────────────────────────────────────────────────────────────

export interface LaunchSpec {
  id: string;
  stage: string;
  agent: string;
  description: string;
  model?: string;
  startedAt?: string;
  endedAt?: string;
  seconds?: number;
  spend?: { input: number; output: number; cacheWrite: number; cacheRead: number };
  /** The tokens of the launch's first request; 0 by default. */
  boot?: number;
  /** The launches it started itself and their tokens; none by default. */
  children?: { launches: number; input: number; output: number; cacheWrite: number; cacheRead: number };
  /** The agent's id; «—» by default. */
  agentId?: string;
  transcript?: string;
  /** The report's text; null writes the row without its file. */
  report: string | null;
  /** The report's path under the run folder; `reports/<id>.md` by default. */
  reportPath?: string;
}

export interface UnitSpec {
  id: string;
  pass?: number;
  state: string;
  title?: string;
  tree?: string;
  /** The brief's text; omitted writes none. */
  brief?: string;
  /** `<n> <label> — exit <code> — <s> s` lines of units/<id>/verify.log.lines, each with its log file. */
  checks?: string[];
  /** Other check logs of the unit by name («land.log», «debug.log»): units/<id>/<name>.lines, same line shape. */
  logs?: Record<string, string[]>;
}

export interface RunSpec {
  /** The run folder's head: false writes no common.md. */
  common?: boolean;
  id: string;
  mode?: string;
  N?: number | null;
  K?: number | null;
  goal?: string;
  start?: string;
  started?: string;
  sessions?: string[];
  launches?: LaunchSpec[];
  /** findings/<stage>.md by stage, as text. */
  findings?: Record<string, string>;
  units?: UnitSpec[];
  journal?: { n: number; stage: string; question: string; decision: string; why: string; refs?: string }[];
  passes?: { pass: number; taken: number; outcome: string; why: string }[];
  gates?: { stage: string; green: boolean; at: string; problems?: string[] }[];
  shots?: string[];
  human?: object[];
  /** Any other file, by its path under the run folder. */
  files?: Record<string, string>;
  /** Empty folders to create. */
  dirs?: string[];
  /** Write run.json and summary.json through fsl.mjs's collect and build. */
  record?: boolean;
  /** Its committed units' commits, one each, as fsloop lands them: "record" — the record reads them as git answers;
   * "repo" — a git repository at `start` also holds them on the run's branch, for a live read. Neither: git is absent. */
  commits?: "record" | "repo";
  /** The time every file of the folder is dated to. */
  mtime: number;
  /** The `now` fsl.mjs's timeline reads, for a reproducible record. */
  now: number;
  /** Where fsl.mjs looks for the orchestrator's transcripts while it builds the record. */
  projectsRoot?: string;
}

const table = (head: string[], rows: (string | number)[][]) =>
  [`| ${head.join(" | ")} |`, `|${head.map(() => "---").join("|")}|`, ...rows.map((r) => `| ${r.map((c) => String(c).replace(/\|/g, "\\|")).join(" | ")} |`), ""].join("\n");

const made = new Set<string>();
function write(path: string, text: string | Buffer) {
  const dir = dirname(path);
  if (!made.has(dir)) {
    mkdirSync(dir, { recursive: true });
    made.add(dir);
  }
  writeFileSync(path, text);
}

/** Dates every file and folder under `dir` to `at`, deepest first. */
export function dateTree(dir: string, at: number) {
  const t = new Date(at);
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) dateTree(p, at);
    utimesSync(p, t, t);
  }
  utimesSync(dir, t, t);
}

const LAUNCH_HEAD = ["launch", "stage", "agent", "description", "model", "started", "ended", "seconds", "input", "output", "cache write", "cache read", "boot", "children", "children input", "children output", "children cache write", "children cache read", "agent id", "transcript", "report"];

/** Writes one run folder as fsloop does and returns its path. */
export function writeRun(dir: string, spec: RunSpec): string {
  made.clear();
  mkdirSync(dir, { recursive: true });
  const w = (rel: string, text: string | Buffer) => write(join(dir, rel), text);
  if (spec.common !== false) {
    const head = [`Run: ${spec.id}`, `Mode: ${spec.mode ?? "worktree"}`, `N: ${spec.N ?? "—"}`, `K: ${spec.K ?? "—"}`];
    if (spec.start) head.push(`Start: ${spec.start}`);
    if (spec.started) head.push(`Started: ${spec.started}`);
    for (const s of spec.sessions ?? []) head.push(`Session: ${s}`);
    w("common.md", [...head, "", "## Goal", "", spec.goal ?? "", "", "## Project", "", "Commands as the project names them.", ""].join("\n"));
  }
  const launches = spec.launches ?? [];
  if (launches.length) {
    w(
      "launches.md",
      table(
        LAUNCH_HEAD,
        launches.map((l) => {
          const s = l.spend ?? { input: 0, output: 0, cacheWrite: 0, cacheRead: 0 };
          const c = l.children ?? { launches: 0, input: 0, output: 0, cacheWrite: 0, cacheRead: 0 };
          return [l.id, l.stage, l.agent, l.description, l.model ?? "claude-opus-5-5", l.startedAt ?? "—", l.endedAt ?? "—", l.seconds ?? "—", s.input, s.output, s.cacheWrite, s.cacheRead, l.boot ?? 0, c.launches, c.input, c.output, c.cacheWrite, c.cacheRead, l.agentId ?? "—", l.transcript ?? "—", l.reportPath ?? `reports/${l.id}.md`];
        }),
      ),
    );
    for (const l of launches) if (l.report !== null) w(l.reportPath ?? `reports/${l.id}.md`, l.report);
  }
  for (const [stage, text] of Object.entries(spec.findings ?? {})) w(`findings/${stage}.md`, text);
  if (spec.units?.length) {
    w("units.md", table(["unit", "pass", "state", "tree", "title"], spec.units.map((u) => [u.id, u.pass ?? 1, u.state, u.tree ?? "—", u.title ?? u.id])));
    for (const u of spec.units) {
      if (u.brief !== undefined) w(`units/${u.id}/brief.md`, u.brief);
      if (u.checks?.length) {
        w(`units/${u.id}/verify.log.lines`, u.checks.join("\n") + "\n");
        u.checks.forEach((_, k) => w(`units/${u.id}/verify.log.${k + 1}`, "ok\n"));
      }
      for (const [name, lines] of Object.entries(u.logs ?? {})) {
        w(`units/${u.id}/${name}.lines`, lines.join("\n") + "\n");
        lines.forEach((_, k) => w(`units/${u.id}/${name}.${k + 1}`, "ok\n"));
      }
    }
  }
  if (spec.journal?.length) w("journal.md", table(["#", "stage", "question", "decision", "why", "refs"], spec.journal.map((r) => [r.n, r.stage, r.question, r.decision, r.why, r.refs ?? "—"])));
  if (spec.passes?.length) w("passes.md", table(["pass", "critical+major", "outcome", "why"], spec.passes.map((p) => [`p${p.pass}`, p.taken, p.outcome, p.why])));
  if (spec.gates?.length) w("gates.jsonl", spec.gates.map((g) => JSON.stringify({ stage: g.stage, green: g.green, at: g.at, problems: g.problems ?? [] })).join("\n") + "\n");
  for (const [i, name] of (spec.shots ?? []).entries()) w(`shots/${name}`, png(16, 10, i));
  if (spec.human?.length) w("human.jsonl", spec.human.map((h) => JSON.stringify(h)).join("\n") + "\n");
  for (const [rel, text] of Object.entries(spec.files ?? {})) w(rel, text);
  for (const d of spec.dirs ?? []) mkdirSync(join(dir, d), { recursive: true });
  dateTree(dir, spec.mtime);
  const commits = spec.commits ? unitCommits(spec) : [];
  if (spec.commits === "repo" && spec.start) writeRepo(spec.start, `fsl/${spec.id}`, commits, spec.mtime);
  if (spec.record) writeRecord(dir, spec.now, spec.projectsRoot ?? join(dir, ".no-config"), spec.mtime, spec.commits ? gitHolding(commits) : undefined);
  return dir;
}

/** git as fsl.mjs calls it: null when git cannot answer. */
export type Git = (start: string, args: string[]) => string | null;

/** run.json and summary.json as `fsl.mjs build` writes them, the timeline read at `now` and git absent unless `git`
 * answers; `mtime` dates the two files and the folder. */
export function writeRecord(dir: string, now: number, projectsRoot: string, mtime?: number, git: Git = () => null) {
  const before = process.env.FSL_PROJECTS_ROOT;
  process.env.FSL_PROJECTS_ROOT = projectsRoot;
  try {
    const run = collect(dir, { git });
    const json = build(run);
    json.timeline = timelineOf(run, new Date(now).toISOString());
    writeFileSync(join(dir, "run.json"), JSON.stringify(json) + "\n");
    writeFileSync(join(dir, "summary.json"), JSON.stringify(summarize(json)) + "\n");
    if (mtime !== undefined) for (const p of [join(dir, "run.json"), join(dir, "summary.json"), dir]) utimesSync(p, new Date(mtime), new Date(mtime));
  } finally {
    if (before === undefined) delete process.env.FSL_PROJECTS_ROOT;
    else process.env.FSL_PROJECTS_ROOT = before;
  }
}

// ── commits ──────────────────────────────────────────────────────────────────────────────────

export interface FixtureCommit {
  sha: string;
  /** Committed at, ms, whole seconds. */
  at: number;
  message: string;
  /** The object as git stores it, before deflate. */
  data: Buffer;
}

const SIGNATURE = "fsloop <fsloop@fixture.invalid>";
const gitObject = (type: string, body: string) => {
  const data = Buffer.concat([Buffer.from(`${type} ${Buffer.byteLength(body)}\0`), Buffer.from(body)]);
  return { sha: createHash("sha1").update(data).digest("hex"), data };
};
const EMPTY_TREE = gitObject("tree", "");

/** One commit per committed unit, oldest first, chained on the run's branch, with the trailers fsloop writes; dated
 * evenly between the run's start and its last write. */
export function unitCommits(spec: RunSpec): FixtureCommit[] {
  const done = (spec.units ?? []).filter((u) => /^committed\b/.test(u.state));
  const from = spec.started ? Date.parse(spec.started) : spec.mtime - DAY;
  let parent: string | null = null;
  return done.map((u, k) => {
    const at = Math.floor((from + ((k + 1) * (spec.mtime - from)) / (done.length + 1)) / 1000);
    // The brief's «## Closes» as fsl.mjs reads it: the trailer names the set the record's unit closes (code-6).
    const closes: string[] = parseBrief(u.brief ?? "").closes;
    const title = u.title ?? u.id;
    const message = [`feat(${u.id}): ${title}`, "", `The ${title} part of the goal, as its brief asks.`, "", `Fsloop-Run: ${spec.id}`, `Fsloop-Step: ${u.id} ${k + 1}/${done.length}`, `Fsloop-Pass: ${u.pass ?? 1}`, ...(closes.length ? [`Fsloop-Closes: ${closes.join(" ")}`] : []), ""].join("\n");
    const o = gitObject("commit", `tree ${EMPTY_TREE.sha}\n${parent ? `parent ${parent}\n` : ""}author ${SIGNATURE} ${at} +0000\ncommitter ${SIGNATURE} ${at} +0000\n\n${message}`);
    parent = o.sha;
    return { sha: o.sha, at: at * 1000, message, data: o.data };
  });
}

/** git as it answers fsl.mjs's two reads of a run whose branch holds `commits`: the branch, then its log. */
export function gitHolding(commits: FixtureCommit[]): Git {
  const iso = (ms: number) => new Date(ms).toISOString().replace(/\.\d{3}Z$/, "+00:00");
  return (_start, args) => {
    if (args[0] === "rev-parse") return commits.length ? `${commits[commits.length - 1].sha}\n` : null;
    if (args[0] === "log") return commits.map((c) => [c.sha, iso(c.at), c.message.split("\n")[0], c.message].join("\x1f") + "\0").join("");
    return null;
  };
}

/** A git repository at `dir` with `commits` on `branch`, its HEAD there, every file dated to `at` — what the server's
 * live read of an open run asks git for. */
export function writeRepo(dir: string, branch: string, commits: FixtureCommit[], at: number) {
  const git = join(dir, ".git");
  const put = (rel: string, data: string | Buffer) => {
    mkdirSync(dirname(join(git, rel)), { recursive: true });
    writeFileSync(join(git, rel), data);
  };
  put("HEAD", `ref: refs/heads/${branch}\n`);
  put("config", "[core]\n\trepositoryformatversion = 0\n\tfilemode = false\n\tbare = false\n");
  for (const o of [EMPTY_TREE, ...commits]) put(`objects/${o.sha.slice(0, 2)}/${o.sha.slice(2)}`, deflateSync(o.data));
  mkdirSync(join(git, "refs", "heads"), { recursive: true });
  if (commits.length) put(`refs/heads/${branch}`, `${commits[commits.length - 1].sha}\n`);
  dateTree(git, at);
}

/** A small valid PNG of one colour — a frame stands in for a screenshot. */
export function png(width: number, height: number, seed: number): Buffer {
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body) >>> 0);
    return Buffer.concat([len, body, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const rgb = [(seed * 53) % 256, (seed * 97 + 80) % 256, (seed * 31 + 160) % 256];
  const row = Buffer.alloc(1 + width * 3);
  for (let x = 0; x < width; x++) row.set(rgb, 1 + x * 3);
  const raw = Buffer.concat(Array.from({ length: height }, () => row));
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}

/** A transcript Claude Code would keep for the orchestrator's session, dated to `at`. */
export function writeTranscript(projectsRoot: string, project: string, session: string, at: number): string {
  const path = join(projectsRoot, project, `${session}.jsonl`);
  write(path, JSON.stringify({ type: "user", timestamp: new Date(at).toISOString(), message: { role: "user", content: "fsloop" } }) + "\n");
  utimesSync(path, new Date(at), new Date(at));
  return path;
}

/** A launch the orchestrator started and fsl.mjs has not saved yet: its transcript under the session's subagents. */
export function writeRunningLaunch(projectsRoot: string, project: string, session: string, runDir: string, launch: { agentId: string; description: string; agent: string; startedAt: number; lastAt: number }) {
  const dir = join(projectsRoot, project, session, "subagents");
  const meta = join(dir, `agent-${launch.agentId}.meta.json`);
  write(meta, JSON.stringify({ description: launch.description, agentType: launch.agent }));
  utimesSync(meta, new Date(launch.startedAt), new Date(launch.startedAt));
  const path = join(dir, `agent-${launch.agentId}.jsonl`);
  const prompt = `Common: ${join(runDir, "common.md").replace(/\\/g, "/")}`;
  write(path, JSON.stringify({ type: "user", timestamp: new Date(launch.startedAt).toISOString(), message: { role: "user", content: prompt } }) + "\n");
  utimesSync(path, new Date(launch.lastAt), new Date(launch.lastAt));
}

// ── report texts ─────────────────────────────────────────────────────────────────────────────

export function criticReport(parts: { lens: string; audit?: string; findings?: string[]; candidates?: string[]; conventions?: string[]; unverified?: string[]; assumptions?: string[]; order?: string[]; verdict?: string[]; shape?: string[] }): string {
  const list = (items: string[] | undefined) => (items?.length ? items.map((i) => `- ${i}`) : ["- —"]);
  const out = [`LENS: ${parts.lens}`];
  if (parts.audit) out.push(`AUDIT: ${parts.audit}`);
  if (parts.conventions) out.push("CONVENTIONS:", ...list(parts.conventions));
  if (parts.shape) out.push("SHAPE:", ...list(parts.shape));
  if (parts.verdict) out.push("VERDICT:", ...list(parts.verdict));
  out.push("FINDINGS (ranked):", ...list(parts.findings));
  out.push("UNVERIFIED:", ...list(parts.unverified));
  out.push("ASSUMPTIONS:", ...list(parts.assumptions));
  out.push("CANDIDATES:", ...list(parts.candidates));
  if (parts.order) out.push("ORDER:", ...list(parts.order));
  return out.join("\n") + "\n";
}

/** The map's free-text report: a top-level heading and a table per part, eight of them and no title over them, as
 * the real maps write them — so the reader draws its outline. */
export function mapReport(): string {
  const parts = ["Functions", "Server", "Parser gaps", "fsl.mjs computes", "Production shape", "Building blocks", "Tokens", "Components"];
  const out = ["What the prototype does, function by function, and what the rebuild reuses.", ""];
  parts.forEach((title, t) => {
    out.push(`## ${t + 1}. ${title}`, "", "| # | what | where | note |", "|---|---|---|---|");
    for (let k = 1; k <= 9; k++) out.push(`| ${k} | ${title.toLowerCase()} item ${k} with a name long enough to need room | template.html:${t * 100 + k * 7} | kept as is, read by \`fsl.mjs\` |`);
    out.push("");
  });
  return out.join("\n");
}

export function implementReport(parts: { changed: string[]; open?: string[]; notes?: string[] }): string {
  const list = (items: string[] | undefined) => (items?.length ? items.map((i) => `- ${i}`) : ["- —"]);
  return [
    "RESULT: done",
    `CHANGED: ${parts.changed.join(", ")}`,
    "CREATED: —",
    "RED: npx vitest run server/run.test.ts → FAIL readRun returns every finding",
    "GREEN: npx vitest run server/run.test.ts → Tests 6 passed (6)",
    "NOTES:",
    ...list(parts.notes),
    "OPEN:",
    ...list(parts.open),
    "PARITY:",
    "- —",
    "VERIFY: type-check pass; lint pass; tests pass",
    "",
  ].join("\n");
}

export const decisionTable = (rows: { finding: string; decision: string; ref?: string; why: string }[]) =>
  table(["finding", "decision", "ref", "repeat", "why"], rows.map((r) => [r.finding, r.decision, r.ref ?? "—", "—", r.why]));

export const ownTable = (rows: { finding: string; decision: string; ref?: string; why: string; severity: string; evidence: string }[]) =>
  table(["finding", "decision", "ref", "repeat", "why", "severity", "evidence"], rows.map((r) => [r.finding, r.decision, r.ref ?? "—", "—", r.why, r.severity, r.evidence]));

export const briefText = (unit: string, title: string, closes: string[], blockedBy = "—") =>
  [`Kind: backend`, `Blocked by: ${blockedBy}`, "", `# ${unit} — ${title}`, "", "## Problem", "", `The ${title} part of the goal.`, "", "## Closes", "", ...(closes.length ? closes.map((c) => `- ${c}`) : ["- —"]), ""].join("\n");

// ── finding lines of every source ────────────────────────────────────────────────────────────

const SEVS = ["critical", "major", "major", "minor", "minor", "minor"] as const;
const sevOf = (k: number) => SEVS[k % SEVS.length];
const VERBS = ["clarify", "harden", "layout", "polish", "quieter", "adapt"];

export const lines = {
  craft: (n: number, surface: string, frame: string | null) =>
    `craft-${n} [craft] ${sevOf(n)} ${["high", "med", "low"][n % 3]} ${["local", "component", "token", "conceptual"][n % 4]} src/web/${surface}/page.tsx:${10 + n * 7} — ux ${n % 10}, ui → Tables, impeccable critique: Visibility of System Status. The «${surface}» page shows state ${n} as a bare word with no age${frame ? `, frames ${frame}` : ""}. — /impeccable ${VERBS[n % VERBS.length]}: give the state its age and its cause. Questions it closes: «когда это случилось?»`,
  code: (n: number) => `code-${n} [standards] ${sevOf(n)} high — src/server/module-${n % 7}.ts:${12 + n}, src/server/other-${n % 5}.ts:${40 + n} — \`code\` → No duplication — the reader is written twice, once per caller (${n}) — extract one reader and call it from both.`,
  runtime: (n: number) => `runtime-${n} [runtime] ${sevOf(n + 1)} med — src/server/watch.ts:${20 + n} — rule: \`code\` → Reading paths degrade. Problem: a missing file ${n} throws out of the read instead of reading as no data. — action: catch the read and return no data.`,
  parity: (n: number) => `parity-${n} [parity] ${sevOf(n + 2)} med — src/server/sort.ts:${n + 3} — source: src/old/sort.py:${n * 11} — The source sorted list ${n} by date; the rebuild sorts by id. Fix: sort by date as the source did.`,
  improve: (n: number) => `improve-${n} [improve] ${n % 2 ? "major" : "minor"} med local src/web/list-${n}.tsx:${n + 1} — PRODUCT.md → Users — a count on list ${n} saves the user a step — show the count beside the title.`,
  design: (n: number, unit: string, path: string) => `design-${n} [spec] ${sevOf(n)} med component ${path}:${10 + n} — \`ux 2\`; \`ui\` → Page chrome — the brief solves pattern ${n} its own way while another brief solves it differently — at ${unit}:${10 + n}, use the shared pattern.`,
  candidate: (n: number, surface: string) => `A shortcut for the ${surface} list would save a step (${n}).`,
  open: (n: number, unit: string) => `${unit}: the empty state of list ${n} is left for the next unit — it needs the shared empty component`,
};

// ── the fixture root ─────────────────────────────────────────────────────────────────────────

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const iso = (ms: number) => new Date(ms).toISOString();
const SURFACES = ["accounts", "bots", "campaigns", "chats", "dialogs", "journal", "leads", "notifications", "overview", "proxies", "roles", "schedules", "seo", "settings", "shell", "sign-in", "traffic", "users", "warmup", "workers"];

/** 5 projects, 63 run folders, as this machine's runs are shaped (Map → production shape). */
export const PROJECTS = [
  { name: "shop", runs: 24 },
  { name: "fsloop", runs: 1 },
  { name: "bots", runs: 11 },
  { name: "admin", runs: 12 },
  { name: "trigger", runs: 15 },
] as const;

export const runId = (i: number) => ((0x1a2b3c4d + i * 0x9e3779b) >>> 0).toString(16).padStart(8, "0").slice(-8);

/** The fixture root: 63 run folders — 3 live, 4 open and long silent (one an empty init, one waiting for the user
 * on a blocked unit), 53 closed, 3 without run.json — and one run at the production maximum, whose project is a git
 * repository holding its commits. Every recorded run's committed units carry their commits. Every mtime is set from
 * `now`, so liveness is reproducible. `only` writes just the folders of those indices (of 0–62), each as the whole
 * root would hold it. */
export function makeFixtureRoot(dir: string, { now, only }: { now: number; only?: number[] }) {
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const projectsRoot = join(dir, ".claude-config", "projects");
  // Which of the 63 folders is which: by its index over the projects in order.
  const plan: { project: string; kind: "max" | "live" | "live-transcript" | "silent" | "silent-waits" | "init" | "closed" | "unrecorded-common" | "unrecorded-empty" | "unrecorded-logs"; age: number }[] = [];
  const special: Record<number, (typeof plan)[number]["kind"]> = { 24: "live", 30: "live-transcript", 40: "max", 3: "silent", 14: "silent", 50: "silent-waits", 60: "init", 7: "unrecorded-common", 33: "unrecorded-empty", 55: "unrecorded-logs" };
  const silentAges: Record<number, number> = { 3: 7 * HOUR, 14: 2 * DAY, 50: 14 * DAY, 60: 25 * DAY };
  let i = 0;
  for (const p of PROJECTS)
    for (let k = 0; k < p.runs; k++, i++) {
      const kind = special[i] ?? "closed";
      const age = kind === "max" ? 2 * MIN : kind === "live" ? 3 * MIN : kind === "live-transcript" ? 40 * MIN : silentAges[i] ?? (i + 1) * 9 * HOUR;
      plan.push({ project: p.name, kind, age });
    }
  plan.forEach((r, n) => {
    if (only && !only.includes(n)) return;
    const id = runId(n);
    const projectDir = join(dir, r.project);
    const runDir = join(projectDir, ".claude", "fsloop", "runs", id);
    const start = projectDir.replace(/\\/g, "/");
    const mtime = now - r.age;
    const base = { id, start, mtime, now, projectsRoot };
    if (r.kind === "unrecorded-common") return writeRun(runDir, { ...base, goal: "Review the sign-in page.", files: { "logs/bootstrap.log": "started\n" } });
    if (r.kind === "unrecorded-empty") return writeRun(runDir, { ...base, common: false, dirs: ["logs", "reports"] });
    if (r.kind === "unrecorded-logs") return writeRun(runDir, { ...base, common: false, files: { "logs/review.log": "review\n" } });
    if (r.kind === "init") return writeRun(runDir, { ...base, mode: "init", started: iso(mtime - HOUR), goal: "Set up fsloop for this project.", record: true, commits: "record" });
    if (r.kind === "max") {
      const session = `5e55${id}-0000-4000-8000-000000000001`;
      writeTranscript(projectsRoot, r.project, session, now - MIN);
      const spec: RunSpec = { ...maxRun(now), ...base, sessions: [session], commits: "repo" };
      writeRun(runDir, spec);
      writeRunningLaunch(projectsRoot, r.project, session, runDir, { agentId: `a${id}u30`, description: "u30 implement", agent: "fsloop-implement", startedAt: now - 12 * MIN, lastAt: now - MIN });
      // The record again, now that the launch runs: it names the launch in running[].
      writeRecord(runDir, now, projectsRoot, mtime, gitHolding(unitCommits(spec)));
      return;
    }
    const live = r.kind === "live" || r.kind === "live-transcript";
    const open = live || r.kind === "silent" || r.kind === "silent-waits";
    const session = `5e55${id}-0000-4000-8000-000000000002`;
    if (r.kind === "live-transcript") writeTranscript(projectsRoot, r.project, session, now - MIN);
    return writeRun(runDir, { ...smallRun(n, mtime, open, r.kind === "silent-waits"), ...base, sessions: live ? [session] : [], record: true, commits: "record" });
  });
  return { dir, projectsRoot, runs: plan.length };
}

/** A run of an ordinary size: a map, two craft critics, a review critic under a v3 name, one or two units; `waits`
 * blocks its first unit on the user. */
function smallRun(n: number, at: number, open: boolean, waits = false): Omit<RunSpec, "id" | "mtime" | "now"> {
  const started = at - 6 * HOUR;
  const s1 = SURFACES[n % SURFACES.length];
  const s2 = SURFACES[(n + 7) % SURFACES.length];
  const craft = (s: string, count: number) => ({
    id: `p1-map-craft-${s}`,
    stage: "p1-map",
    agent: "fsloop-critic",
    description: `craft ${s}`,
    startedAt: iso(started + HOUR),
    endedAt: iso(started + HOUR + 10 * MIN),
    seconds: 600,
    spend: { input: 1200 + n, output: 30_000, cacheWrite: 200_000, cacheRead: 2_000_000 },
    report: criticReport({ lens: "craft assess", audit: `«${s}» audit ${10 + (n % 8)}/20 · critique ${20 + (n % 15)}/40`, findings: Array.from({ length: count }, (_, k) => lines.craft(k + 1, s, k === 0 ? `p1-baseline-${s}-` : null)), candidates: [lines.candidate(1, s)], order: [`${s}: /impeccable clarify, then polish`] }),
  });
  const launches: LaunchSpec[] = [
    { id: "p1-map-map", stage: "p1-map", agent: "Explore", description: "map", startedAt: iso(started), endedAt: iso(started + 20 * MIN), seconds: 1200, report: "Map of the project.\n" },
    craft(s1, 3 + (n % 4)),
    craft(s2, 2 + (n % 3)),
    { id: "p1-units-u1-implement", stage: "p1-units", agent: "fsloop-implement", description: "u1 implement", startedAt: iso(started + 3 * HOUR), endedAt: iso(started + 4 * HOUR), seconds: 3600, report: implementReport({ changed: ["src/a.ts"] }) },
  ];
  if (!open) launches.push({ id: "p1-review-critic-code", stage: "p1-review", agent: "fsloop-critic", description: "critic code", startedAt: iso(started + 5 * HOUR), endedAt: iso(started + 5 * HOUR + 15 * MIN), seconds: 900, reportPath: "reports/p1-review-critic-code.md", report: criticReport({ lens: "code", findings: [lines.code(1), lines.code(2)] }) });
  const fixed = [`p1-map-craft-${s1}#craft-1`, `p1-map-craft-${s1}#craft-2`];
  const gates = ["p1-map", "p1-spike", "p1-decompose", "p1-units", ...(open ? [] : ["p1-review", "p1-fix", "p1-verdict", "integrate", "finish"])].map((stage, k) => ({ stage, green: true, at: iso(started + (k + 1) * 30 * MIN) }));
  return {
    mode: n % 3 ? "worktree" : "inline",
    N: n % 4 === 0 ? 2 : null,
    K: 3,
    goal: `Run ${n}: bring the «${s1}» and «${s2}» pages to the law.\nKeep every fact.\nNo new direction.`,
    started: iso(started),
    launches,
    findings: { "p1-map": decisionTable(fixed.map((f) => ({ finding: f, decision: "fix", ref: "u1", why: "major local — above the bar" }))), ...(open ? {} : { "p1-review": decisionTable([{ finding: "p1-review-critic-code#code-1", decision: "candidate", why: "a smell, not a defect" }]) }) },
    units: [{ id: "u1", state: waits ? `blocked: waits for the user — which words the empty «${s1}» list keeps (j1)` : open ? "implement" : "committed 1a2b3c4d", title: `${s1} page`, brief: briefText("u1", `${s1} page`, fixed) }, ...(n % 2 ? [{ id: "u2", state: open ? "ready" : "committed 5e6f7a8b", title: `${s2} page`, brief: briefText("u2", `${s2} page`, [], "u1") }] : [])],
    journal: [{ n: 1, stage: "p1-map", question: "Route: inline or worktree?", decision: "worktree, K=3", why: "two pages and their shared parts" }],
    gates,
    shots: [`p1-baseline-${s1}-1440-light.png`, `p1-baseline-${s1}-1440-dark.png`],
    files: open ? {} : { "logs/push.log.lines": `1 push — exit ${n % 5 ? 0 : 1} — 4 s — main\n` },
  };
}

/** The longest goal of the real runs, in shape: 8 617 characters over 50 numbered lines of uneven length, each a
 * clause that ends on a whole word. */
function longGoal(): string {
  const words = "bring every section to the law and keep every fact the operator reads while the frames stay dark the tables hold their columns and nothing moves when a row opens or a list grows".split(" ");
  // the last word of a line, by its length: the line ends at its width exactly
  const last = ["", "a", "it", "now", "kept", "first", "always", "exactly", "together", "carefully", "throughout", "predictably", "consistently", "unambiguously", "systematically", "comprehensively"];
  const widths = Array.from({ length: 50 }, (_, k) => 140 + ((k * 37) % 61));
  widths[49] += 8617 - 49 - widths.reduce((a, b) => a + b, 0);
  let w = 0;
  const next = () => words[w++ % words.length];
  return widths
    .map((width, k) => {
      const first = next();
      let line = `${k + 1}. ${first[0].toUpperCase()}${first.slice(1)}`;
      while (width - line.length - 2 > 15) line += ` ${next()}`;
      return `${line} ${last[width - line.length - 2]}.`;
    })
    .join("\n");
}

/** The production maximum: 723 findings of every source, 42 units over 2 passes, 97 launches, 143 journal rows,
 * 26 conventions, frames of both passes, the longest real goal's shape. Live, with a red gate. */
function maxRun(now: number): Omit<RunSpec, "id" | "mtime" | "now"> {
  const t0 = now - 2 * DAY;
  let clock = t0;
  const launches: LaunchSpec[] = [];
  const decisions: Record<string, { finding: string; decision: string; ref?: string; why: string }[]> = {};
  const decide = (stage: string, finding: string, decision: string, ref?: string) => (decisions[stage] ??= []).push({ finding, decision, ref, why: decision === "fix" ? "above the bar by its cited rule" : "below the bar, listed in the report" });
  const add = (l: Omit<LaunchSpec, "startedAt" | "endedAt" | "seconds" | "spend">) => {
    launches.push({ ...l, startedAt: iso(clock), endedAt: iso(clock + 9 * MIN), seconds: 540, spend: { input: 900 + launches.length, output: 40_000, cacheWrite: 250_000, cacheRead: 3_100_000 }, boot: 38_000 + launches.length, agentId: `a${(0x5e0000 + launches.length).toString(16)}` });
    clock += 10 * MIN;
  };
  const closes: Record<string, string[]> = {};
  const takeBy = (unit: string, finding: string) => (closes[unit] ??= []).push(finding);
  const unitFor = (pass: number, k: number) => (pass === 1 ? `u${1 + (k % 16)}` : `u${17 + (k % 16)}`);
  const fixUnit = (pass: number, k: number) => (pass === 1 ? `f${1 + (k % 5)}` : `f${6 + (k % 5)}`);

  add({ id: "p1-map-map", stage: "p1-map", agent: "Explore", description: "map", report: mapReport(), children: { launches: 3, input: 2_400, output: 61_000, cacheWrite: 180_000, cacheRead: 1_450_000 } });
  add({ id: "p1-spike-spike-telegram", stage: "p1-spike", agent: "spike-researcher", description: "spike telegram", report: "SPIKE: telegram\n" });
  SURFACES.forEach((s, si) => {
    const lid = `p1-map-craft-${s}`;
    const found = Array.from({ length: 18 }, (_, k) => lines.craft(k + 1, s, k === 0 ? `p1-baseline-${s}-` : k === 1 && si < 10 ? `p2-final-${s}` : null));
    add({ id: lid, stage: "p1-map", agent: "fsloop-critic", description: `craft ${s}`, report: criticReport({ lens: "craft assess", audit: `«${s[0].toUpperCase()}${s.slice(1)}» audit ${8 + (si % 12)}/20 · critique ${18 + si}/40`, findings: found, candidates: [lines.candidate(1, s), lines.candidate(2, s)], unverified: [`ux 7 — a frame at 1280 would settle it`], assumptions: [`${s} is read by one operator`], order: [`${s}: /impeccable clarify, harden, polish`] }) });
    for (let k = 1; k <= 18; k++) {
      const f = `${lid}#craft-${k}`;
      if (sevOf(k) === "minor") decide("p1-map", f, "candidate");
      else {
        const u = unitFor(1, si + k);
        decide("p1-map", f, "fix", u);
        takeBy(u, f);
      }
    }
  });
  const conventions = Array.from({ length: 26 }, (_, k) => `Pattern ${k + 1} — one solution for every brief — src/web/shared/part-${k + 1}.tsx:${k + 3} — \`ux 1\`, impeccable critique: Consistency and Standards`);
  add({ id: "p1-decompose-design-check", stage: "p1-decompose", agent: "fsloop-critic", description: "design check", report: criticReport({ lens: "design", conventions, findings: Array.from({ length: 10 }, (_, k) => lines.design(k + 1, `u${k + 1}`, `units/u${k + 1}/brief.md`)) }) });
  for (let k = 1; k <= 10; k++) decide("p1-decompose", `p1-decompose-design-check#design-${k}`, "fix", `u${k}`);
  for (let k = 1; k <= 6; k++) add({ id: `p1-decompose-u${k}-shape`, stage: "p1-decompose", agent: "fsloop-critic", description: `u${k} shape`, report: criticReport({ lens: "shape", shape: [`ANSWERS: what is the state of u${k}'s surface`], findings: [] }) });
  for (let k = 1; k <= 16; k++) {
    const open = k <= 5 ? [lines.open(k, `u${k}`)] : [];
    add({ id: `p1-units-u${k}-implement`, stage: "p1-units", agent: "fsloop-implement", description: `u${k} implement`, report: implementReport({ changed: [`src/web/part-${k}.tsx`], open }) });
    if (open.length) decide("p1-units", `p1-units-u${k}-implement#open-1`, "candidate");
  }
  const review = (pass: number, lens: string, count: number, make: (n: number) => string) => {
    const lid = `p${pass}-review-critic-${lens}`;
    add({ id: lid, stage: `p${pass}-review`, agent: "fsloop-critic", description: `critic ${lens}`, report: criticReport({ lens, findings: Array.from({ length: count }, (_, k) => make(k + 1)) }) });
    for (let k = 1; k <= count; k++) {
      const f = `${lid}#${lens}-${k}`;
      if (k % 3 === 0) decide(`p${pass}-review`, f, "candidate");
      else {
        const u = fixUnit(pass, k);
        decide(`p${pass}-review`, f, "fix", u);
        takeBy(u, f);
      }
    }
    return lid;
  };
  const p1code = review(1, "code", 30, lines.code);
  review(1, "runtime", 20, lines.runtime);
  review(1, "craft", 30, (n) => lines.craft(n, SURFACES[n % 20], null));
  review(1, "parity", 10, lines.parity);
  for (let k = 1; k <= 5; k++) add({ id: `p1-fix-f${k}-implement`, stage: "p1-fix", agent: "fsloop-implement", description: `f${k} implement`, report: implementReport({ changed: [`src/server/fix-${k}.ts`] }) });
  add({ id: "p1-verdict-critic-code-verdict", stage: "p1-verdict", agent: "fsloop-critic", description: "critic code verdict", report: criticReport({ lens: "code verdict", verdict: [`${p1code}#code-1 resolved — the reader is one`, `${p1code}#code-2 partial — one caller still copies it`], findings: [] }) });
  add({ id: "p1-verdict-critic-craft-verdict", stage: "p1-verdict", agent: "fsloop-critic", description: "critic craft verdict", report: criticReport({ lens: "craft verdict", verdict: [], findings: [] }) });
  const assess = (pass: number, lens: string, count: number, make: (n: number) => string) => {
    const lid = `p${pass}-assess-critic-${lens}`;
    add({ id: lid, stage: `p${pass}-assess`, agent: "fsloop-critic", description: `critic ${lens}`, report: criticReport({ lens: `${lens} assess`, findings: Array.from({ length: count }, (_, k) => make(k + 1)) }) });
    for (let k = 1; k <= count; k++) decide(`p${pass}-assess`, `${lid}#${lens}-${k}`, k % 2 ? "fix" : "open", k % 2 ? fixUnit(2, k) : undefined);
  };
  assess(1, "improve", 10, lines.improve);
  assess(1, "code", 20, lines.code);
  assess(1, "runtime", 10, lines.runtime);
  assess(1, "craft", 20, (n) => lines.craft(n, SURFACES[(n + 3) % 20], null));
  // pass 2
  add({ id: "p2-decompose-design-check", stage: "p2-decompose", agent: "fsloop-critic", description: "design check", report: criticReport({ lens: "design", conventions: [], findings: Array.from({ length: 5 }, (_, k) => lines.design(k + 1, `u${17 + k}`, `units/u${17 + k}/brief.md`)) }) });
  for (let k = 1; k <= 5; k++) decide("p2-decompose", `p2-decompose-design-check#design-${k}`, "fix", `u${17 + k}`);
  for (let k = 1; k <= 6; k++) add({ id: `p2-decompose-u${16 + k}-shape`, stage: "p2-decompose", agent: "fsloop-critic", description: `u${16 + k} shape`, report: criticReport({ lens: "shape", shape: [`ANSWERS: what is the state of u${16 + k}'s surface`], findings: [] }) });
  for (let k = 17; k <= 32; k++) {
    const open = k <= 19 ? [lines.open(k, `u${k}`)] : [];
    add({ id: `p2-units-u${k}-implement`, stage: "p2-units", agent: "fsloop-implement", description: `u${k} implement`, report: implementReport({ changed: [`src/web/part-${k}.tsx`], open }) });
    if (open.length) decide("p2-units", `p2-units-u${k}-implement#open-1`, "fix", `u${k}`);
  }
  review(2, "code", 30, lines.code);
  review(2, "runtime", 20, lines.runtime);
  review(2, "craft", 30, (n) => lines.craft(n, SURFACES[(n + 5) % 20], n === 1 ? "p2-final-accounts" : null));
  for (let k = 6; k <= 10; k++) add({ id: `p2-fix-f${k}-implement`, stage: "p2-fix", agent: "fsloop-implement", description: `f${k} implement`, report: implementReport({ changed: [`src/server/fix-${k}.ts`] }) });
  add({ id: "p2-verdict-critic-code-verdict", stage: "p2-verdict", agent: "fsloop-critic", description: "critic code verdict", report: criticReport({ lens: "code verdict", verdict: [], findings: [] }) });
  add({ id: "p2-verdict-critic-craft-verdict", stage: "p2-verdict", agent: "fsloop-critic", description: "critic craft verdict", report: criticReport({ lens: "craft verdict", verdict: [], findings: [] }) });
  assess(2, "improve", 10, lines.improve);
  assess(2, "code", 20, lines.code);
  assess(2, "runtime", 10, lines.runtime);
  assess(2, "craft", 20, (n) => lines.craft(n, SURFACES[(n + 9) % 20], null));

  // The run's own findings: the second table of findings/p1-assess.md.
  const own = Array.from({ length: 10 }, (_, k) => ({ finding: `p1-assess-own#${k + 1}`, decision: "fix", ref: fixUnit(2, k), why: `the suite's line ${k + 1} is red after the merge`, severity: k < 2 ? "critical" : "major", evidence: `logs/p1-assess-suite.log.lines (line ${k + 1})` }));
  const findings = Object.fromEntries(Object.entries(decisions).map(([stage, rows]) => [stage, decisionTable(rows)]));
  findings["p1-assess"] += "\n\n" + ownTable(own);

  const units: UnitSpec[] = [];
  for (let k = 1; k <= 32; k++) {
    const pass = k <= 16 ? 1 : 2;
    const state = pass === 1 || k <= 22 ? `committed ${(0xc0ffee00 + k).toString(16)}` : k === 23 ? "blocked: waits for the user — the empty state's wording (j140)" : k === 30 ? "implement" : k === 31 ? "verify" : k <= 26 ? "ready" : "drafted";
    units.push({ id: `u${k}`, pass, state, title: `part ${k}`, brief: briefText(`u${k}`, `part ${k}`, closes[`u${k}`] ?? [], k === 24 ? "u23" : "—"), checks: k === 31 ? [`1 type-check — exit 0 — 14 s — `, `2 tests — exit 1 — 31 s — 2 failed`] : k === 22 ? [`1 type-check — exit 0 — 13 s — `, `2 tests — exit 0 — 40 s — `] : undefined, logs: k === 22 ? { "land.log": [`1 merge — exit 0 — 4 s — `] } : k === 31 ? { "debug.log": [`1 tests — exit 1 — 28 s — 2 failed`, `2 tests — exit 1 — 30 s — 1 failed`] } : undefined });
  }
  for (let k = 1; k <= 10; k++) units.push({ id: `f${k}`, pass: k <= 5 ? 1 : 2, state: k <= 8 ? `committed ${(0xf1f1f100 + k).toString(16)}` : "ready", title: `fixes ${k}`, brief: briefText(`f${k}`, `fixes ${k}`, [...(closes[`f${k}`] ?? []), ...own.filter((o) => o.ref === `f${k}`).map((o) => o.finding)]) });

  const journal = Array.from({ length: 143 }, (_, k) => {
    const n = k + 1;
    const refs = n === 7 ? "u99" : n % 5 === 0 ? `${p1code}#code-${(n % 30) + 1}` : n % 7 === 0 ? `u${(n % 32) + 1}` : n % 11 === 0 ? `j${n - 1}` : "—";
    return { n, stage: n < 60 ? "p1-map" : n < 100 ? "p1-review" : "p2-review", question: `Question ${n}: which way?`, decision: `way ${n}`, why: `because ${n} keeps the law`, refs };
  });
  const gates: NonNullable<RunSpec["gates"]> = ["p1-map", "p1-spike", "p1-decompose", "p1-units", "p1-review", "p1-fix", "p1-verdict", "p1-assess", "p2-decompose", "p2-units", "p2-review", "p2-fix", "p2-verdict"].map((stage, k) => ({ stage, green: true, at: iso(t0 + (k + 1) * 2 * HOUR) }));
  gates.push({ stage: "p2-assess", green: false, at: iso(now - 20 * MIN), problems: ["p2-assess-critic-code#code-2 has no decision row"] });
  const shots = [...SURFACES.flatMap((s) => [`p1-baseline-${s}-1440-light.png`, `p1-baseline-${s}-1440-dark.png`]), ...SURFACES.slice(0, 10).map((s) => `p2-final-${s}.png`)];
  return {
    mode: "worktree",
    N: 2,
    K: 3,
    goal: longGoal(),
    started: iso(t0),
    launches,
    findings,
    units,
    journal,
    passes: [{ pass: 1, taken: 60, outcome: "next", why: "60 critical and major above the bar" }],
    gates,
    shots,
    human: [{ finding: `${p1code}#code-1`, verdict: "agree", note: null, at: iso(now - HOUR) }],
    files: { "surfaces/accounts.md": "SHAPE: accounts\n", "logs/p1-assess-suite.log.lines": "1 suite — exit 1 — 120 s — 10 failed\n" },
  };
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const nowArg = args.find((a) => a.startsWith("--now="))?.slice(6);
  const here = dirname(fileURLToPath(import.meta.url));
  const dir = resolve(args.find((a) => !a.startsWith("--")) ?? join(here, "root"));
  const now = nowArg ? Date.parse(nowArg) : Date.now();
  const r = makeFixtureRoot(dir, { now });
  console.log(`${r.runs} run folders → ${dir}`);
}
