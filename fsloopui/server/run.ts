// One run folder → the run model the client shows. The skill's own reader parses the folder — fsl.mjs's
// `collect` and `build`, the code behind `fsl.mjs build` — so the interface and the skill agree on every
// finding, decision and status; this module adds what the interface needs on top: the finding text split,
// frames per finding, surfaces, conventions, the user's verdicts read fresh, per-file errors.
// A closed run is read from its run.json; an open one is parsed live, falling back to run.json when that fails.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { build, collect, HUMAN_VERDICTS } from "../../skills/fsloop/fsl.mjs";
import type { Convention, FileError, Finding, FindingSource, JournalEntry, Launch, Run, RunningLaunch, Surface, Unit, UserVerdict } from "../shared/model.ts";
import { agentKind, launchName, unitStateOf, type Decision, type FindingStatus, type Verdict } from "../shared/states.ts";
import { firstSentence, framesOf, headOf, splitText } from "./finding-text.ts";

/** git as fsl.mjs calls it: null when git cannot answer. */
export type Git = (start: string, args: string[]) => string | null;

export interface ReadOptions {
  git?: Git;
}

// run.json is fsl.mjs's untyped shape, read field by field below into the typed model.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = Record<string, any>;

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));
const NONE = /^(—|-|none)?$/i;

function readText(path: string): string | null {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return null;
  }
}

/** run.json as fsl.mjs last wrote it; null when there is none, an error when it cannot be parsed. */
function readRecord(runDir: string, errors: FileError[]): Json | null {
  const path = join(runDir, "run.json");
  if (!existsSync(path)) return null;
  try {
    const json = JSON.parse(readFileSync(path, "utf8"));
    return json && typeof json === "object" && !json.legacy ? json : null;
  } catch (e) {
    errors.push({ file: "run.json", cause: message(e) });
    return null;
  }
}

/** The `projects` folder of the Claude config the orchestrator ran under, from the transcripts its record names —
 * this machine keeps several configs, and only that one holds the run's sessions. */
export function projectsRootOf(record: Json | null): string | null {
  const main = (record?.orchestrator?.sessions ?? []).map((s: Json) => s.transcript).find(Boolean);
  if (main) return dirname(dirname(main));
  const sub = (record?.launches ?? []).map((l: Json) => l.transcript).find((t: unknown) => typeof t === "string" && /[\\/]subagents[\\/]/.test(t));
  return sub ? dirname(dirname(dirname(dirname(sub)))) : null;
}

/** build(collect(runDir)) with fsl.mjs looking for transcripts under the run's own config. Never writes. */
function liveJson(runDir: string, record: Json | null, git?: Git): Json {
  const root = projectsRootOf(record);
  const before = process.env.FSL_PROJECTS_ROOT;
  if (root) process.env.FSL_PROJECTS_ROOT = root;
  try {
    return build(collect(runDir, git ? { git } : {})) as Json;
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
    let h: Json;
    try {
      h = JSON.parse(line);
    } catch {
      errors.push({ file: "human.jsonl", cause: `строка ${i + 1} не прочитана` });
      return;
    }
    if (!h.finding || !HUMAN_VERDICTS.includes(h.verdict)) return;
    const list = out.get(h.finding) ?? [];
    list.push({ verdict: h.verdict as Verdict, note: typeof h.note === "string" && h.note ? h.note : null, at: typeof h.at === "string" ? h.at : null });
    out.set(h.finding, list);
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

const sourceOf = (f: Json): FindingSource => (f.own ? "own" : /#open-\d+$/.test(f.id) ? "open" : /#cand-\d+$/.test(f.id) ? "candidate" : "critic");
const craftSurface = (l: Json | undefined) => /^craft (.+)$/.exec(l?.description ?? "")?.[1] ?? null;

function findingOf(f: Json, launches: Map<string, Json>, units: Json[], shots: string[], human: Map<string, UserVerdict[]>): Finding {
  const source = sourceOf(f);
  const launch = f.launch ? launches.get(f.launch) : undefined;
  let head = { lens: f.category ?? null, severity: f.severity ?? null, confidence: f.confidence ?? null, cause: f.cause && !NONE.test(f.cause) ? f.cause : null, location: f.location ?? null };
  let body: string;
  let structured = source === "critic";
  if (f.rule !== undefined || f.action !== undefined) body = [f.rule, f.action].filter(Boolean).join(" — ");
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
  const byBrief = units.filter((u) => (u.closes ?? []).includes(f.id)).map((u) => u.id as string);
  const byRef = f.ref && /^[uf]\d+$/.test(f.ref) ? [f.ref as string] : [];
  return {
    ...text,
    summary: firstSentence(text.observation ?? text.rule ?? text.fix ?? f.why ?? f.evidence ?? f.raw ?? f.id),
    id: f.id,
    local: f.local,
    launch: f.launch ?? null,
    launchName: launchName(launch ? { agent: launch.agent, description: launch.description } : null),
    stage: f.stage,
    pass: f.pass ?? null,
    source,
    lens: head.lens,
    severity: head.severity,
    confidence: head.confidence,
    cause: head.cause,
    location: head.location,
    raw: f.raw ?? null,
    evidence: f.evidence ?? null,
    surface: craftSurface(launch),
    decision: (f.decision as Exclude<Decision, "none">) ?? null,
    ref: f.ref ?? null,
    refKind: f.refKind ?? null,
    why: f.why ?? null,
    status: f.status as FindingStatus,
    effectiveStatus: (f.effectiveStatus ?? f.status) as FindingStatus,
    unit: f.unit ?? null,
    units: [...new Set([...byBrief, ...byRef])],
    frames: framesOf([f.raw, f.rule, f.action, f.evidence], shots),
    verdict: verdicts.at(-1) ?? null,
    verdicts,
    journal: f.journal ?? [],
    duplicateOf: f.duplicateOf ?? null,
    repeatedBy: f.repeatedBy ?? null,
  };
}

function surfacesOf(json: Json, findings: Finding[], shots: string[]): Surface[] {
  const keys = new Set<string>([...Object.keys(json.surfaces ?? {}), ...findings.map((f) => f.surface).filter((s): s is string => Boolean(s))]);
  const labelOf = (key: string) => {
    const lines = (json.audits ?? []).filter((a: Json) => a.surface === key).map((a: Json) => String(a.line));
    const labels = lines
      .map((l: string) => l.split(/\s+(?:audit|critique)\s+\d/)[0].replace(/[«»`]/g, "").replace(/\s*\([^)]*\)\s*/g, " ").trim())
      .filter((l: string) => l && !/[\\/]|\.(?:tsx?|jsx?|md|css|html)\b/.test(l));
    return labels.at(-1) ?? key;
  };
  return [...keys].sort().map((key) => ({
    key,
    label: labelOf(key),
    scores: (json.surfaces?.[key] ?? []).map((s: Json) => ({ stage: s.stage, launch: s.launch, audit: s.audit ?? null, auditMax: s.auditMax ?? null, critique: s.critique ?? null, critiqueMax: s.critiqueMax ?? null })),
    frames: shots.filter((s) => new RegExp(`^p\\d+-[a-z]+-${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:-|\\.png$)`).test(s)),
    findings: findings.filter((f) => f.surface === key).length,
  }));
}

function conventionsOf(launches: Json[]): Convention[] {
  const out: Convention[] = [];
  for (const l of launches)
    for (const text of l.block?.CONVENTIONS?.items ?? []) {
      const parts = String(text).split(/\s(?:—|--)\s/);
      const four = parts.length >= 4;
      out.push({ n: out.length + 1, text, pattern: four ? parts[0] : null, solution: four ? parts[1] : null, example: four ? parts[2] : null, rule: four ? parts.slice(3).join(" — ") : null, launch: l.id, stage: l.stage });
    }
  return out;
}

function journalOf(json: Json, findings: Finding[], units: Unit[], launches: Launch[]): JournalEntry[] {
  const rows = (json.journal ?? []) as Json[];
  const found = (id: string, kind: string | null) => {
    if (kind === "finding") return findings.some((f) => f.id === id);
    if (kind === "unit") return units.some((u) => u.id === id);
    if (kind === "launch") return launches.some((l) => l.id === id);
    if (kind === "journal") return rows.some((r) => `j${r.n}` === id);
    // An id-shaped ref the folder does not hold: «не найден».
    return !/^[uf]\d+$|#/.test(id);
  };
  return rows.map((r) => ({ n: String(r.n), stage: r.stage, question: r.question, decision: r.decision, why: r.why, refs: (r.refs ?? []).map((ref: Json) => ({ id: ref.id, kind: ref.kind ?? null, found: found(ref.id, ref.kind ?? null) })) }));
}

function sinceOf(u: Json, running: RunningLaunch[]): string | undefined {
  const run = running.find((r) => new RegExp(`^${u.id}\\b`).test(r.description ?? ""));
  if (run?.startedAt) return run.startedAt;
  const ends = (u.checks ?? []).map((c: Json) => c.endedAt).filter(Boolean).sort();
  return ends.at(-1) ?? undefined;
}

export function readRun(runDir: string, opts: ReadOptions = {}): Run {
  const errors: FileError[] = [];
  const record = readRecord(runDir, errors);
  let json: Json | null = null;
  let source: Run["source"] = "live";
  if (record?.closed === true) {
    json = record;
    source = "record";
  } else
    try {
      json = liveJson(runDir, record, opts.git);
    } catch (e) {
      errors.push({ file: "папка прогона", cause: message(e) });
      if (record) {
        json = record;
        source = "record";
      }
    }
  json ??= {};
  const recorded = record !== null;
  const shots = listShots(runDir);
  const human = readHuman(runDir, errors);

  const running: RunningLaunch[] = (json.running ?? []).map((r: Json) => ({ agentId: r.agentId, description: r.description ?? null, agent: r.agent ?? null, name: launchName({ agent: r.agent ?? null, description: r.description ?? null }), startedAt: r.startedAt ?? null, lastAt: r.lastAt ?? null }));
  const rawUnits = (json.units ?? []) as Json[];
  const units: Unit[] = rawUnits.map((u) => {
    const state = unitStateOf(u.state);
    const unit: Unit = { id: u.id, pass: u.pass ?? 1, state, stateText: state === "unknown" ? (u.state ?? null) : null, sha: u.sha ?? null, commits: u.commits ?? [], blockedWhy: u.blockedWhy ?? null, tree: u.tree && !NONE.test(u.tree) ? u.tree : null, title: u.title ?? "", brief: u.brief ?? null, kind: u.kind || null, blockedBy: u.blockedBy ?? [], closes: u.closes ?? [], launches: u.launches ?? [] };
    const since = sinceOf(u, running);
    if (since) unit.since = since;
    return unit;
  });

  const rawLaunches = (json.launches ?? []) as Json[];
  const byId = new Map(rawLaunches.map((l) => [l.id as string, l]));
  const findings = ((json.findings ?? []) as Json[]).map((f) => findingOf(f, byId, rawUnits, shots, human));
  const launches: Launch[] = rawLaunches.map((l) => {
    if (l.reportMissing) errors.push({ file: l.report || l.id, cause: l.report && existsSync(join(runDir, l.report)) ? "файл пуст" : "файла нет" });
    const sections = Object.fromEntries(Object.entries((l.block ?? {}) as Json).map(([k, v]) => [k, { value: v.value ?? "", items: v.items ?? [] }]));
    return {
      id: l.id,
      stage: l.stage,
      agent: l.agent || null,
      description: l.description || null,
      name: launchName({ agent: l.agent || null, description: l.description || null }),
      kind: agentKind({ agent: l.agent || null, description: l.description || null }),
      model: l.model || null,
      unit: l.unit ?? null,
      startedAt: l.startedAt ?? null,
      endedAt: l.endedAt ?? null,
      seconds: l.seconds ?? null,
      spend: l.spend ? { input: l.spend.input ?? 0, output: l.spend.output ?? 0, cacheWrite: l.spend.cacheWrite ?? 0, cacheRead: l.spend.cacheRead ?? 0 } : null,
      transcript: l.transcript && !NONE.test(l.transcript) ? l.transcript : null,
      report: l.report || null,
      reportMissing: Boolean(l.reportMissing),
      sections,
      unparsed: l.unparsed ?? [],
      findings: findings.filter((f) => f.launch === l.id).map((f) => f.id),
    };
  });

  const closed = recorded ? json.closed === true : null;
  const waiting = json.now?.waitingOn;
  return {
    id: json.id ?? runDir.split(/[\\/]/).at(-1) ?? "",
    dir: runDir,
    recorded,
    source,
    goal: json.goal ?? null,
    mode: json.mode ?? null,
    N: json.N ?? null,
    K: json.K ?? null,
    mirror: typeof json.mirror === "boolean" ? json.mirror : null,
    start: json.start ?? null,
    worktree: json.worktree ?? null,
    sessions: json.orchestrator?.sessions ? json.orchestrator.sessions.map((s: Json) => ({ id: s.id, transcript: s.transcript ?? null })) : (json.sessions ?? []).map((id: string) => ({ id, transcript: null })),
    startedAt: json.startedAt ?? null,
    updatedAt: json.updatedAt ?? null,
    closed,
    now: recorded && !closed && json.now ? { stage: json.now.stage ?? null, step: json.now.step ?? null, since: json.now.since ?? null, running: running.length, redGate: waiting?.lastRedGate ?? null } : null,
    outcome: closed && json.outcome ? { pushed: Boolean(json.outcome.pushed), goalMet: json.outcome.goalMet ?? null, held: json.outcome.held ?? [] } : null,
    stages: recorded ? (json.stages ?? []).map((s: Json) => ({ stage: s.stage, green: s.green ?? null, at: s.at ?? null, startedAt: s.startedAt ?? null, problems: s.problems ?? [] })) : [],
    units,
    launches,
    running,
    commits: Array.isArray(json.commits) ? json.commits.length : null,
    findings,
    surfaces: surfacesOf(json, findings, shots),
    conventions: conventionsOf(rawLaunches),
    journal: journalOf(json, findings, units, launches),
    frames: shots,
    errors,
  };
}
