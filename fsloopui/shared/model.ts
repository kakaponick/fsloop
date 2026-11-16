// The run model the server builds once from a run folder and the client shows (rules/ui → Conventions 3).
// A field the folder lacks is absent, never guessed (Conventions 4); raw ISO times travel here, formatting is
// shared/text.ts's.
import type { Decision, FindingStatus, Severity, UnitState, Verdict } from "./states.ts";
import type { Spend } from "./text.ts";

/** A file of the run folder that could not be read: it fails in its own place, the rest is served. */
export interface FileError {
  file: string;
  cause: string;
}

export interface UserVerdict {
  verdict: Verdict;
  note: string | null;
  at: string | null;
}

/** A finding's text, split once: the rule it cites, what the critic saw, the fix with its command, the
 * operator's question it closes. A line with no split keeps its whole text in `observation`; `rule` and
 * `observation` are never the same string. */
export interface FindingText {
  rule: string | null;
  observation: string | null;
  /** The verb after `/impeccable`, when the fix names one. */
  fixCommand: string | null;
  fix: string | null;
  question: string | null;
  /** The first whole sentence, for a row. */
  summary: string;
}

export type FindingSource = "critic" | "candidate" | "open" | "own";

export interface Finding extends FindingText {
  id: string;
  local: string;
  launch: string | null;
  /** The compact launch name: «craft · notifications», «u2 · исполнитель», «прогон». */
  launchName: string;
  stage: string;
  pass: number | null;
  source: FindingSource;
  lens: string | null;
  severity: Exclude<Severity, "none"> | null;
  confidence: string | null;
  cause: string | null;
  location: string | null;
  /** The line as the report wrote it. */
  raw: string | null;
  evidence: string | null;
  surface: string | null;
  decision: Exclude<Decision, "none"> | null;
  ref: string | null;
  refKind: string | null;
  why: string | null;
  status: FindingStatus;
  effectiveStatus: FindingStatus;
  /** The unit that fixes it, by fsl.mjs's status. */
  unit: string | null;
  /** Every unit whose brief closes it, plus the decision's unit ref. */
  units: string[];
  /** File names under shots/ the finding cites, every pass. */
  frames: string[];
  /** The user's latest verdict; its history in `verdicts`. */
  verdict: UserVerdict | null;
  verdicts: UserVerdict[];
  journal: string[];
  duplicateOf: string | null;
  repeatedBy: string | null;
}

export interface Unit {
  id: string;
  pass: number;
  state: UnitState;
  /** The state as units.md wrote it, when it is not one fsloopUI knows. */
  stateText: string | null;
  sha: string | null;
  commits: string[];
  blockedWhy: string | null;
  tree: string | null;
  title: string;
  brief: string | null;
  kind: string | null;
  blockedBy: string[];
  closes: string[];
  launches: string[];
  /** The running launch's start, else the last check's end; absent when neither is recorded. */
  since?: string;
  /** Every line of the unit's check logs (units/<id>/*.log.lines — verify, land, debug), by log, in order. */
  checks?: UnitCheck[];
}

/** One line of a unit's check log, as fsl.mjs reads it; a line it cannot read keeps only `file` and `line`. */
export interface UnitCheck {
  /** The log's file under the unit's folder: «verify.log.lines». */
  file: string;
  n: number | null;
  label: string | null;
  exit: number | null;
  /** What the line says after its exit code: «31 s — 2 failed». */
  line: string | null;
  seconds?: number | null;
  startedAt?: string | null;
  endedAt?: string | null;
}

/** The launches an agent started itself, and their tokens. */
export interface ChildLaunches {
  launches: number;
  input: number;
  output: number;
  cacheWrite: number;
  cacheRead: number;
}

export interface ReportSection {
  value: string;
  items: string[];
}

export interface UnparsedLine {
  id: string;
  section: string;
  line: number;
  text: string;
}

export interface Launch {
  id: string;
  stage: string;
  agent: string | null;
  description: string | null;
  name: string;
  kind: string;
  model: string | null;
  unit: string | null;
  startedAt: string | null;
  endedAt: string | null;
  seconds: number | null;
  spend: Spend | null;
  /** The tokens of the launch's first request; absent when launches.md has no boot column. */
  boot?: number;
  /** The launches it started itself; absent when launches.md has no children columns. */
  children?: ChildLaunches;
  /** The agent's id; absent when the row names none. */
  agentId?: string;
  transcript: string | null;
  report: string | null;
  reportMissing: boolean;
  /** The report's sections but FINDINGS (and an implementer's OPEN): LENS, AUDIT, CONVENTIONS, UNVERIFIED … */
  sections: Record<string, ReportSection>;
  unparsed: UnparsedLine[];
  /** Its VERDICT lines as fsl.mjs's own grammar reads them (`parseVerdict`); a line it cannot read is in `unparsed`. */
  verdicts: LaunchVerdict[];
  findings: string[];
}

/** A verdict critic's line on one finding: «<id> resolved — …». */
export interface LaunchVerdict {
  id: string;
  result: VerdictResult;
}

export type VerdictResult = "resolved" | "partial" | "unresolved";

export interface RunningLaunch {
  agentId: string;
  description: string | null;
  agent: string | null;
  name: string;
  startedAt: string | null;
  lastAt: string | null;
}

export interface SurfaceScore {
  stage: string;
  launch: string;
  audit: number | null;
  auditMax: number | null;
  critique: number | null;
  critiqueMax: number | null;
}

export interface Surface {
  key: string;
  label: string;
  scores: SurfaceScore[];
  frames: string[];
  findings: number;
}

export interface Convention {
  n: number;
  text: string;
  pattern: string | null;
  solution: string | null;
  example: string | null;
  rule: string | null;
  launch: string;
  stage: string;
}

export interface JournalRef {
  id: string;
  kind: string | null;
  /** False when the id names something the run folder does not hold («не найден»). */
  found: boolean;
}

export interface JournalEntry {
  n: string;
  stage: string;
  question: string;
  decision: string;
  why: string;
  refs: JournalRef[];
}

export interface Gate {
  at: string;
  problems: string[];
}

export interface Now {
  stage: string | null;
  step: string | null;
  since: string | null;
  running: number;
  redGate: Gate | null;
}

export interface Outcome {
  pushed: boolean;
  goalMet: boolean | null;
  held: string[];
}

export interface Stage {
  stage: string;
  green: boolean | null;
  at: string | null;
  startedAt: string | null;
  problems: string[];
}

export interface Session {
  id: string;
  transcript: string | null;
}

export interface Run {
  id: string;
  dir: string;
  /** Whether fsl.mjs has written run.json: without it nothing about the run's state is shown. */
  recorded: boolean;
  /** Where the model came from: a live parse of the folder, or run.json when the live parse failed or the run is closed. */
  source: "live" | "record";
  /** run.json's own `version` (its format), as fsl.mjs wrote it; null without a record. */
  recordVersion: number | null;
  goal: string | null;
  mode: string | null;
  N: number | null;
  K: number | null;
  mirror: boolean | null;
  start: string | null;
  worktree: string | null;
  sessions: Session[];
  startedAt: string | null;
  updatedAt: string | null;
  closed: boolean | null;
  now: Now | null;
  outcome: Outcome | null;
  stages: Stage[];
  units: Unit[];
  launches: Launch[];
  running: RunningLaunch[];
  /** Every launch of the run — the recorded and the running — counted once here (rules/ui → Conventions 3): the
   * «Отчёты» tab, its «Агент» filter and its status bar list this many. */
  launchCount: number;
  commits: number | null;
  findings: Finding[];
  surfaces: Surface[];
  conventions: Convention[];
  journal: JournalEntry[];
  frames: string[];
  errors: FileError[];
}

/** A run as the server serves it: the model, its key, its project and the store's version of it — a counter that
 * rises with each re-read, not run.json's `recordVersion`. */
export type ServedRun = Run & { key: string; project: string; version: number };

/** A run as the server lists it: the run's key and project, its model, its last write. */
export interface RunCard {
  key: string;
  project: string;
  id: string;
  recorded: boolean;
  /** The goal's first lines, newlines collapsed; the whole goal is in the run model. */
  goal: string | null;
  mode: string | null;
  N: number | null;
  K: number | null;
  models: string[];
  mirror: boolean | null;
  sessions: string[];
  stage: string | null;
  /** The stage's full words; «прогон закрыт» for a closed run, «не записано» without a record. */
  stageLabel: string;
  step: string | null;
  since: string | null;
  closed: boolean | null;
  outcome: Outcome | null;
  units: Partial<Record<UnitState, number>>;
  unitsTotal: number;
  blocked: { id: string; why: string | null }[];
  launches: number;
  running: number;
  commits: number | null;
  redGate: Gate | null;
  startedAt: string | null;
  updatedAt: string | null;
  lastWriteAt: string | null;
  errors: number;
  /** The run folder, the worktree and run.json's version: the run page's «Подробнее», drawn before the run is read. */
  dir: string;
  worktree: string | null;
  version: number | null;
}
