// One run folder → the run model the client shows. The skill's own reader parses the folder — fsl.mjs's
// `collect` and `build`, the code behind `fsl.mjs build` — so the interface and the skill agree on every
// finding, decision and status; this module adds what the interface needs on top: the finding text split,
// frames per finding, surfaces, conventions, the user's verdicts read fresh, per-file errors.
// A closed run is read from its run.json; an open one is parsed live, falling back to run.json when that fails.
// Either document is read as `unknown` through the typed readers of record.ts.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { build, collect, HUMAN_VERDICTS, parseVerdict, summarize } from "../../skills/fsloop/fsl.mjs";
import { RUN_FOLDER, type Convention, type FileError, type Finding, type FindingSource, type JournalEntry, type Launch, type LaunchVerdict, type Run, type RunningLaunch, type Surface, type Unit, type UserVerdict, type VerdictResult } from "../shared/model.ts";
import { agentKind, DECISION, FINDING_STATUS, launchName, launchNames, unitStateOf, type Decision, type FindingStatus, type Verdict } from "../shared/states.ts";
import { addSpend, spendBy, type Spend } from "../shared/text.ts";
import { firstSentence, framesOf, headOf, splitText } from "./finding-text.ts";
import { recordOf, runSpendOf, type FindingJson, type LaunchJson, type RecordJson, type RunningJson, type UnitJson } from "./record.ts";

/** git as fsl.mjs calls it: null when git cannot answer. */
export type Git = (start: string, args: string[]) => string | null;

export interface ReadOptions {
  git?: Git;
}

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));
const NONE = /^(—|-|none)?$/i;

function readText(path: string): string | null {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return null;
  }
}

/** A run document: as written (`raw`, for fsl.mjs's own readers of it) and read field by field (`json`). */
interface Document {
  raw: unknown;
  json: RecordJson;
}

const documentOf = (raw: unknown): Document | null => {
  const json = recordOf(raw);
  return json ? { raw, json } : null;
};

/** run.json as fsl.mjs last wrote it; null when there is none, an error when it cannot be parsed. */
function readRecord(runDir: string, errors: FileError[]): Document | null {
  const path = join(runDir, "run.json");
  if (!existsSync(path)) return null;
  try {
    return documentOf(JSON.parse(readFileSync(path, "utf8")));
  } catch (e) {
    errors.push({ file: "run.json", cause: message(e) });
    return null;
  }
}

/** The `projects` folder of the Claude config the orchestrator ran under, from the transcripts its record names —
 * this machine keeps several configs, and only that one holds the run's sessions. */
export function projectsRootOf(record: RecordJson | null): string | null {
  const main = (record?.orchestrator ?? []).map((s) => s.transcript).find(Boolean);
  if (main) return dirname(dirname(main));
  const sub = (record?.launches ?? []).map((l) => l.transcript).find((t) => typeof t === "string" && /[\\/]subagents[\\/]/.test(t));
  return sub ? dirname(dirname(dirname(dirname(sub)))) : null;
}

/** build(collect(runDir)) with fsl.mjs looking for transcripts under the run's own config. Never writes. */
function liveRaw(runDir: string, record: RecordJson | null, git?: Git): unknown {
  const root = projectsRootOf(record);
  const before = process.env.FSL_PROJECTS_ROOT;
  if (root) process.env.FSL_PROJECTS_ROOT = root;
  try {
    return build(collect(runDir, git ? { git } : {}));
  } finally {
    if (before === undefined) delete process.env.FSL_PROJECTS_ROOT;
    else process.env.FSL_PROJECTS_ROOT = before;
  }
}

/** The user's verdicts in human.jsonl, by finding, in order; lines fsl.mjs would drop are dropped. */
function readHuman(runDir: string, errors: FileError[]): Map<string, UserVerdict[]> {
  const out = new Map<string, UserVerdict[]>();
  const text = readText(join(runDir, "human.jsonl"));
  if (!text) return out;
  text.split(/\r?\n/).forEach((line, i) => {
    if (!line.trim()) return;
    let h: unknown;
    try {
      h = JSON.parse(line);
    } catch {
      errors.push({ file: "human.jsonl", cause: `строка ${i + 1} не прочитана` });
      return;
    }
    const o = typeof h === "object" && h !== null ? (h as Record<string, unknown>) : {};
    const finding = typeof o.finding === "string" ? o.finding : null;
    if (!finding || !HUMAN_VERDICTS.includes(o.verdict as string)) return;
    const list = out.get(finding) ?? [];
    list.push({ verdict: o.verdict as Verdict, note: typeof o.note === "string" && o.note ? o.note : null, at: typeof o.at === "string" ? o.at : null });
    out.set(finding, list);
  });
  return out;
}

function listShots(runDir: string): string[] {
  try {
    return readdirSync(join(runDir, "shots"))
      .filter((f) => f.endsWith(".png"))
      .sort();
  } catch {
    return [];
  }
}

const sourceOf = (f: FindingJson): FindingSource => (f.own ? "own" : /#open-\d+$/.test(f.id) ? "open" : /#cand-\d+$/.test(f.id) ? "candidate" : "critic");
const craftSurface = (l: LaunchJson | undefined) => /^craft (.+)$/.exec(l?.description ?? "")?.[1] ?? null;
const SEVERITIES = ["critical", "major", "minor"] as const;
const severityOf = (s: string | null): Finding["severity"] => SEVERITIES.find((x) => x === s) ?? null;
const decisionOf = (d: string | null): Finding["decision"] => (d && d !== "none" && d in DECISION ? (d as Exclude<Decision, "none">) : null);
const statusOf = (s: string | null): FindingStatus => (s && s in FINDING_STATUS ? (s as FindingStatus) : "undecided");

function findingOf(f: FindingJson, launches: Map<string, LaunchJson>, names: Map<string, string>, units: UnitJson[], shots: string[], human: Map<string, UserVerdict[]>): Finding {
  const source = sourceOf(f);
  const launch = f.launch ? launches.get(f.launch) : undefined;
  let head = { lens: f.category, severity: severityOf(f.severity), confidence: f.confidence, cause: f.cause && !NONE.test(f.cause) ? f.cause : null, location: f.location };
  let body: string;
  let structured = source === "critic";
  if (f.split) body = [f.rule, f.action].filter(Boolean).join(" — ");
  else {
    const h = source === "critic" && f.raw ? headOf(f.raw) : null;
    if (h) {
      head = { lens: h.lens, severity: h.severity, confidence: h.confidence, cause: h.cause, location: h.location };
      body = h.body;
    } else {
      body = source === "own" ? "" : (f.raw ?? "");
      structured = false;
    }
  }
  const text = splitText(body, { structured });
  const verdicts = human.get(f.id) ?? [];
  const byBrief = units.filter((u) => u.closes.includes(f.id)).map((u) => u.id);
  const byRef = f.ref && /^[uf]\d+$/.test(f.ref) ? [f.ref] : [];
  const status = statusOf(f.status);
  return {
    ...text,
    summary: firstSentence(text.observation ?? text.rule ?? text.fix ?? f.why ?? f.evidence ?? f.raw ?? f.id),
    id: f.id,
    local: f.local,
    launch: f.launch,
    launchName: (launch && names.get(launch.id)) ?? launchName(launch ? { agent: launch.agent, description: launch.description } : null),
    stage: f.stage,
    pass: f.pass,
    source,
    lens: head.lens,
    severity: head.severity,
    confidence: head.confidence,
    cause: head.cause,
    location: head.location,
    raw: f.raw,
    evidence: f.evidence,
    surface: craftSurface(launch),
    decision: decisionOf(f.decision),
    ref: f.ref,
    refKind: f.refKind,
    why: f.why,
    status,
    effectiveStatus: f.effectiveStatus ? statusOf(f.effectiveStatus) : status,
    unit: f.unit,
    units: [...new Set([...byBrief, ...byRef])],
    frames: framesOf([f.raw, f.rule, f.action, f.evidence], shots),
    verdict: verdicts.at(-1) ?? null,
    verdicts,
    journal: f.journal,
    duplicateOf: f.duplicateOf,
    repeatedBy: f.repeatedBy,
  };
}

function surfacesOf(json: RecordJson, findings: Finding[], shots: string[]): Surface[] {
  const keys = new Set<string>([...Object.keys(json.surfaces), ...findings.map((f) => f.surface).filter((s): s is string => Boolean(s))]);
  const labelOf = (key: string) => {
    const lines = json.audits.filter((a) => a.surface === key).map((a) => a.line);
    const labels = lines
      .map((l) => l.split(/\s+(?:audit|critique)\s+\d/)[0].replace(/[«»`]/g, "").replace(/\s*\([^)]*\)\s*/g, " ").trim())
      .filter((l) => l && !/[\\/]|\.(?:tsx?|jsx?|md|css|html)\b/.test(l));
    return labels.at(-1) ?? key;
  };
  return [...keys].sort().map((key) => ({
    key,
    label: labelOf(key),
    scores: json.surfaces[key] ?? [],
    frames: shots.filter((s) => new RegExp(`^p\\d+-[a-z]+-${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:-|\\.png$)`).test(s)),
    findings: findings.filter((f) => f.surface === key).length,
  }));
}

function conventionsOf(launches: LaunchJson[]): Convention[] {
  const out: Convention[] = [];
  for (const l of launches)
    for (const text of l.block.CONVENTIONS?.items ?? []) {
      const parts = text.split(/\s(?:—|--)\s/);
      const four = parts.length >= 4;
      out.push({ n: out.length + 1, text, pattern: four ? parts[0] : null, solution: four ? parts[1] : null, example: four ? parts[2] : null, rule: four ? parts.slice(3).join(" — ") : null, launch: l.id, stage: l.stage });
    }
  return out;
}

function journalOf(json: RecordJson, findings: Finding[], units: Unit[], launches: Launch[]): JournalEntry[] {
  const rows = json.journal;
  const found = (id: string, kind: string | null) => {
    if (kind === "finding") return findings.some((f) => f.id === id);
    if (kind === "unit") return units.some((u) => u.id === id);
    if (kind === "launch") return launches.some((l) => l.id === id);
    if (kind === "journal") return rows.some((r) => `j${r.n}` === id);
    // An id-shaped ref the folder does not hold: «не найден».
    return !/^[uf]\d+$|#/.test(id);
  };
  return rows.map((r) => ({ n: r.n, stage: r.stage, question: r.question, decision: r.decision, why: r.why, refs: r.refs.map((ref) => ({ id: ref.id, kind: ref.kind, found: found(ref.id, ref.kind) })) }));
}

function sinceOf(u: UnitJson, running: RunningJson[]): string | undefined {
  const run = running.find((r) => new RegExp(`^${u.id}\\b`).test(r.description ?? ""));
  if (run?.startedAt) return run.startedAt;
  const ends = (u.checks ?? []).map((c) => c.endedAt).filter((e): e is string => Boolean(e)).sort();
  return ends.at(-1) ?? undefined;
}

/** A launch's VERDICT lines through fsl.mjs's own grammar — one reader of the line, never a second regex. */
function verdictsOf(l: LaunchJson): LaunchVerdict[] {
  const out: LaunchVerdict[] = [];
  for (const item of l.block.VERDICT?.items ?? []) {
    const v = parseVerdict(item);
    if (v) out.push({ id: v.id, result: v.result as VerdictResult });
  }
  return out;
}

/** A launch's tokens with those of the launches it started: the run's spend counts both (fsl.mjs → summarize). */
const withChildren = (l: LaunchJson): Spend | null => (l.spend ? (l.spend.children ? addSpend(l.spend, l.spend.children) : l.spend) : null);

/** summary.json's `spend`, counted by fsl.mjs's own `summarize` over the same document; null when it cannot be. */
function spendOf(raw: unknown): Run["spend"] {
  try {
    return runSpendOf((summarize(raw) as { spend?: unknown }).spend);
  } catch {
    return null;
  }
}

export function readRun(runDir: string, opts: ReadOptions = {}): Run {
  const errors: FileError[] = [];
  const record = readRecord(runDir, errors);
  let doc: Document | null = null;
  let source: Run["source"] = "live";
  if (record?.json.closed === true) {
    doc = record;
    source = "record";
  } else
    try {
      doc = documentOf(liveRaw(runDir, record?.json ?? null, opts.git));
    } catch (e) {
      errors.push({ file: RUN_FOLDER, cause: message(e) });
      if (record) {
        doc = record;
        source = "record";
      }
    }
  const json = doc?.json ?? (recordOf({}) as RecordJson);
  const recorded = record !== null;
  const shots = listShots(runDir);
  const human = readHuman(runDir, errors);

  const running: RunningLaunch[] = json.running.map((r) => ({ agentId: r.agentId, description: r.description, agent: r.agent, name: launchName({ agent: r.agent, description: r.description }), startedAt: r.startedAt, lastAt: r.lastAt }));
  const units: Unit[] = json.units.map((u) => {
    const state = unitStateOf(u.state);
    const unit: Unit = { id: u.id, pass: u.pass ?? 1, state, stateText: state === "unknown" ? u.state : null, sha: u.sha, commits: u.commits, blockedWhy: u.blockedWhy, tree: u.tree && !NONE.test(u.tree) ? u.tree : null, title: u.title ?? "", brief: u.brief, kind: u.kind || null, blockedBy: u.blockedBy, closes: u.closes, launches: u.launches };
    const since = sinceOf(u, json.running);
    if (since) unit.since = since;
    if (u.checks) unit.checks = u.checks;
    return unit;
  });

  const rawLaunches = json.launches;
  const byId = new Map(rawLaunches.map((l) => [l.id, l]));
  const names = launchNames(rawLaunches.map((l) => ({ id: l.id, stage: l.stage || null, agent: l.agent || null, description: l.description || null })));
  const findings = json.findings.map((f) => findingOf(f, byId, names, json.units, shots, human));
  const launches: Launch[] = rawLaunches.map((l) => {
    if (l.reportMissing) errors.push({ file: l.report || l.id, cause: l.report && existsSync(join(runDir, l.report)) ? "файл пуст" : "файла нет" });
    const launch: Launch = {
      id: l.id,
      stage: l.stage,
      agent: l.agent || null,
      description: l.description || null,
      name: names.get(l.id) ?? launchName({ agent: l.agent || null, description: l.description || null }),
      kind: agentKind({ agent: l.agent || null, description: l.description || null }),
      model: l.model || null,
      unit: l.unit,
      startedAt: l.startedAt,
      endedAt: l.endedAt,
      seconds: l.seconds,
      spend: l.spend ? { input: l.spend.input, output: l.spend.output, cacheWrite: l.spend.cacheWrite, cacheRead: l.spend.cacheRead } : null,
      transcript: l.transcript && !NONE.test(l.transcript) ? l.transcript : null,
      report: l.report || null,
      reportMissing: l.reportMissing,
      sections: l.block,
      unparsed: l.unparsed,
      verdicts: verdictsOf(l),
      findings: findings.filter((f) => f.launch === l.id).map((f) => f.id),
    };
    // Written by the row or absent: a row saved before a column existed is unknown, never zero.
    if (l.spend?.boot !== null && l.spend?.boot !== undefined) launch.boot = l.spend.boot;
    if (l.spend?.children) launch.children = l.spend.children;
    if (l.agentId && !NONE.test(l.agentId)) launch.agentId = l.agentId;
    return launch;
  });

  const closed = recorded ? json.closed === true : null;
  return {
    id: json.id ?? runDir.split(/[\\/]/).at(-1) ?? "",
    dir: runDir,
    recorded,
    source,
    recordVersion: record?.json.version ?? null,
    goal: json.goal,
    mode: json.mode,
    N: json.N,
    K: json.K,
    mirror: json.mirror,
    start: json.start,
    worktree: json.worktree,
    sessions: json.orchestrator ? json.orchestrator : json.sessions.map((id) => ({ id, transcript: null })),
    startedAt: json.startedAt,
    updatedAt: json.updatedAt,
    closed,
    now: recorded && !closed && json.now ? { stage: json.now.stage, step: json.now.step, since: json.now.since, running: running.length, redGate: json.now.redGate } : null,
    outcome: closed && json.outcome ? json.outcome : null,
    stages: recorded ? json.stages : [],
    units,
    launches,
    running,
    launchCount: launches.length + running.length,
    spend: doc ? spendOf(doc.raw) : null,
    tokens: { stage: spendBy(rawLaunches, (l) => l.stage, withChildren), kind: spendBy(rawLaunches, (l) => agentKind({ agent: l.agent || null, description: l.description || null }), withChildren) },
    passes: json.passes,
    commits: json.commits,
    findings,
    surfaces: surfacesOf(json, findings, shots),
    conventions: conventionsOf(rawLaunches),
    journal: journalOf(json, findings, units, launches),
    frames: shots,
    errors,
  };
}
