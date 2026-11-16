// run.json — fsl.mjs's record, or the same document built live from the folder — read as `unknown` through small
// typed readers (code-review cand-1). Every field the server reads is named in a type here, so a mistyped name fails
// at compile time; a field of another type than fsl.mjs writes reads as absent (rules/ui → Conventions 4), never
// passed on to the client.
import type { Pass, SurfaceScore, UnitCheck, UnparsedLine } from "../shared/model.ts";
import type { Spend } from "../shared/text.ts";

type Obj = Record<string, unknown>;

const objOf = (v: unknown): Obj | null => (typeof v === "object" && v !== null && !Array.isArray(v) ? (v as Obj) : null);
const str = (v: unknown): string | null => (typeof v === "string" ? v : null);
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const bool = (v: unknown): boolean | null => (typeof v === "boolean" ? v : null);
const strs = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
const objs = (v: unknown): Obj[] => (Array.isArray(v) ? v.map(objOf).filter((o): o is Obj => o !== null) : []);
/** A list read item by item; an item the reader rejects is left out. */
const listOf = <T>(v: unknown, read: (o: Obj) => T | null): T[] => objs(v).map(read).filter((x): x is T => x !== null);

export interface LaunchSpendJson extends Spend {
  /** Absent from a launches.md written before its boot column. */
  boot: number | null;
  /** Absent from a launches.md written before its children columns. */
  children: (Spend & { launches: number }) | null;
}

export interface SectionJson {
  value: string;
  items: string[];
}

export interface LaunchJson {
  id: string;
  stage: string;
  agent: string | null;
  description: string | null;
  model: string | null;
  unit: string | null;
  startedAt: string | null;
  endedAt: string | null;
  seconds: number | null;
  spend: LaunchSpendJson | null;
  transcript: string | null;
  report: string | null;
  reportMissing: boolean;
  block: Record<string, SectionJson>;
  unparsed: UnparsedLine[];
  agentId: string | null;
}

export interface RunningJson {
  agentId: string;
  description: string | null;
  agent: string | null;
  startedAt: string | null;
  lastAt: string | null;
}

export interface UnitJson {
  id: string;
  pass: number | null;
  state: string | null;
  sha: string | null;
  commits: string[];
  blockedWhy: string | null;
  tree: string | null;
  title: string | null;
  brief: string | null;
  kind: string | null;
  blockedBy: string[];
  closes: string[];
  launches: string[];
  /** Null when the record carries no checks list. */
  checks: UnitCheck[] | null;
}

export interface FindingJson {
  id: string;
  local: string;
  launch: string | null;
  stage: string;
  pass: number | null;
  own: boolean;
  category: string | null;
  severity: string | null;
  confidence: string | null;
  cause: string | null;
  location: string | null;
  /** fsl.mjs split the line into its rule and action (either key present, a null one too). */
  split: boolean;
  rule: string | null;
  action: string | null;
  raw: string | null;
  evidence: string | null;
  decision: string | null;
  ref: string | null;
  refKind: string | null;
  why: string | null;
  status: string | null;
  effectiveStatus: string | null;
  unit: string | null;
  journal: string[];
  duplicateOf: string | null;
  repeatedBy: string | null;
}

export interface JournalJson {
  n: string;
  stage: string;
  question: string;
  decision: string;
  why: string;
  refs: { id: string; kind: string | null }[];
}

export interface StageJson {
  stage: string;
  green: boolean | null;
  at: string | null;
  startedAt: string | null;
  problems: string[];
}

export interface RecordJson {
  id: string | null;
  closed: boolean | null;
  version: number | null;
  goal: string | null;
  mode: string | null;
  N: number | null;
  K: number | null;
  mirror: boolean | null;
  start: string | null;
  worktree: string | null;
  /** common.md's session ids — a record older than `orchestrator`. */
  sessions: string[];
  /** The orchestrator's sessions with their transcripts; null when the record has none. */
  orchestrator: { id: string; transcript: string | null }[] | null;
  startedAt: string | null;
  updatedAt: string | null;
  now: { stage: string | null; step: string | null; since: string | null; redGate: { at: string; problems: string[] } | null } | null;
  outcome: { pushed: boolean; goalMet: boolean | null; held: string[] } | null;
  stages: StageJson[];
  units: UnitJson[];
  launches: LaunchJson[];
  running: RunningJson[];
  /** Null when the record keeps no commits list. */
  commits: number | null;
  findings: FindingJson[];
  surfaces: Record<string, SurfaceScore[]>;
  audits: { surface: string | null; line: string }[];
  journal: JournalJson[];
  passes: Pass[];
}

const spendOf = (o: Obj | null): Spend | null => (o ? { input: num(o.input) ?? 0, output: num(o.output) ?? 0, cacheWrite: num(o.cacheWrite) ?? 0, cacheRead: num(o.cacheRead) ?? 0 } : null);

function launchSpendOf(v: unknown): LaunchSpendJson | null {
  const o = objOf(v);
  const spend = spendOf(o);
  if (!o || !spend) return null;
  const c = objOf(o.children);
  const children = spendOf(c);
  return { ...spend, boot: num(o.boot), children: c && children ? { ...children, launches: num(c.launches) ?? 0 } : null };
}

function launchOf(l: Obj): LaunchJson | null {
  const id = str(l.id);
  if (!id) return null;
  const block = Object.fromEntries(
    Object.entries(objOf(l.block) ?? {})
      .map(([k, v]) => [k, objOf(v)] as const)
      .filter((e): e is readonly [string, Obj] => e[1] !== null)
      .map(([k, v]) => [k, { value: str(v.value) ?? "", items: strs(v.items) }]),
  );
  const unparsed = listOf(l.unparsed, (u): UnparsedLine | null => {
    const text = str(u.text);
    return text === null ? null : { id: str(u.id) ?? id, section: str(u.section) ?? "", line: num(u.line) ?? 0, text };
  });
  return {
    id,
    stage: str(l.stage) ?? "",
    agent: str(l.agent),
    description: str(l.description),
    model: str(l.model),
    unit: str(l.unit),
    startedAt: str(l.startedAt),
    endedAt: str(l.endedAt),
    seconds: num(l.seconds),
    spend: launchSpendOf(l.spend),
    transcript: str(l.transcript),
    report: str(l.report),
    reportMissing: l.reportMissing === true,
    block,
    unparsed,
    agentId: str(l.agentId),
  };
}

const checkOf = (c: Obj): UnitCheck => ({ file: str(c.file) ?? "", n: num(c.n), label: str(c.label), exit: num(c.exit), line: str(c.line), seconds: num(c.seconds), startedAt: str(c.startedAt), endedAt: str(c.endedAt) });

function unitOf(u: Obj): UnitJson | null {
  const id = str(u.id);
  if (!id) return null;
  return {
    id,
    pass: num(u.pass),
    state: str(u.state),
    sha: str(u.sha),
    commits: strs(u.commits),
    blockedWhy: str(u.blockedWhy),
    tree: str(u.tree),
    title: str(u.title),
    brief: str(u.brief),
    kind: str(u.kind),
    blockedBy: strs(u.blockedBy),
    closes: strs(u.closes),
    launches: strs(u.launches),
    checks: Array.isArray(u.checks) ? objs(u.checks).map(checkOf) : null,
  };
}

function findingOf(f: Obj): FindingJson | null {
  const id = str(f.id);
  if (!id) return null;
  return {
    id,
    local: str(f.local) ?? id,
    launch: str(f.launch),
    stage: str(f.stage) ?? "",
    pass: num(f.pass),
    own: f.own === true,
    category: str(f.category),
    severity: str(f.severity),
    confidence: str(f.confidence),
    cause: str(f.cause),
    location: str(f.location),
    split: f.rule !== undefined || f.action !== undefined,
    rule: str(f.rule),
    action: str(f.action),
    raw: str(f.raw),
    evidence: str(f.evidence),
    decision: str(f.decision),
    ref: str(f.ref),
    refKind: str(f.refKind),
    why: str(f.why),
    status: str(f.status),
    effectiveStatus: str(f.effectiveStatus),
    unit: str(f.unit),
    journal: strs(f.journal),
    duplicateOf: str(f.duplicateOf),
    repeatedBy: str(f.repeatedBy),
  };
}

/** A cell fsl.mjs keeps as text, a number written as one too. */
const text = (v: unknown): string | null => str(v) ?? (num(v) !== null ? String(v) : null);

function journalOf(r: Obj): JournalJson | null {
  const n = text(r.n);
  if (n === null) return null;
  return {
    n,
    stage: str(r.stage) ?? "",
    question: str(r.question) ?? "",
    decision: str(r.decision) ?? "",
    why: str(r.why) ?? "",
    refs: listOf(r.refs, (ref) => {
      const id = str(ref.id);
      return id === null ? null : { id, kind: str(ref.kind) };
    }),
  };
}

const scoreOf = (s: Obj): SurfaceScore => ({ stage: str(s.stage) ?? "", launch: str(s.launch) ?? "", audit: num(s.audit), auditMax: num(s.auditMax), critique: num(s.critique), critiqueMax: num(s.critiqueMax) });

function passOf(p: Obj): Pass | null {
  const pass = num(p.pass);
  const taken = num(p.taken);
  return pass === null || taken === null ? null : { pass, taken, outcome: str(p.outcome) ?? "", why: str(p.why) ?? "" };
}

function nowOf(v: unknown): RecordJson["now"] {
  const o = objOf(v);
  if (!o) return null;
  const gate = objOf(objOf(o.waitingOn)?.lastRedGate);
  const at = str(gate?.at);
  return { stage: str(o.stage), step: str(o.step), since: str(o.since), redGate: gate && at ? { at, problems: strs(gate.problems) } : null };
}

/** A run document as fsl.mjs writes it, read field by field; null when it is not one (not an object, or legacy). */
export function recordOf(v: unknown): RecordJson | null {
  const o = objOf(v);
  if (!o || o.legacy === true) return null;
  const orchestrator = objOf(o.orchestrator);
  const outcome = objOf(o.outcome);
  return {
    id: str(o.id),
    closed: bool(o.closed),
    version: num(o.version),
    goal: str(o.goal),
    mode: str(o.mode),
    N: num(o.N),
    K: num(o.K),
    mirror: bool(o.mirror),
    start: str(o.start),
    worktree: str(o.worktree),
    sessions: strs(o.sessions),
    orchestrator: Array.isArray(orchestrator?.sessions)
      ? listOf(orchestrator.sessions, (s) => {
          const id = str(s.id);
          return id === null ? null : { id, transcript: str(s.transcript) };
        })
      : null,
    startedAt: str(o.startedAt),
    updatedAt: str(o.updatedAt),
    now: nowOf(o.now),
    outcome: outcome ? { pushed: outcome.pushed === true, goalMet: bool(outcome.goalMet), held: strs(outcome.held) } : null,
    stages: listOf(o.stages, (s) => ({ stage: str(s.stage) ?? "", green: bool(s.green), at: str(s.at), startedAt: str(s.startedAt), problems: strs(s.problems) })),
    units: listOf(o.units, unitOf),
    launches: listOf(o.launches, launchOf),
    running: listOf(o.running, (r) => ({ agentId: str(r.agentId) ?? "", description: str(r.description), agent: str(r.agent), startedAt: str(r.startedAt), lastAt: str(r.lastAt) })),
    commits: Array.isArray(o.commits) ? o.commits.length : null,
    findings: listOf(o.findings, findingOf),
    surfaces: Object.fromEntries(Object.entries(objOf(o.surfaces) ?? {}).map(([k, v]) => [k, objs(v).map(scoreOf)])),
    audits: listOf(o.audits, (a) => ({ surface: str(a.surface), line: text(a.line) ?? "" })),
    journal: listOf(o.journal, journalOf),
    passes: listOf(o.passes, passOf),
  };
}

/** The run's tokens as summary.json counts them, read from fsl.mjs's `summarize(json).spend`; null when unreadable. */
export function runSpendOf(v: unknown): { launches: Spend & { boot: number; continuations: number }; orchestrator: Spend | null } | null {
  const o = objOf(v);
  const launches = objOf(o?.launches);
  const spend = spendOf(launches);
  if (!launches || !spend) return null;
  return { launches: { ...spend, boot: num(launches.boot) ?? 0, continuations: num(launches.continuations) ?? 0 }, orchestrator: spendOf(objOf(o?.orchestrator)) };
}
