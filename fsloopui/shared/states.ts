// Every enumerated state of a run has one map beside its enum (rules/ui → Conventions 1): value → compact and
// full label, tone, rank, glossary meaning. Card, header, cell, filter, sort and glossary read these; no surface
// writes its own words for a state. Tones per Conventions 2: work in progress neutral, done green, what waits
// for the user amber, severity the one ranked category.
import { duration } from "./text.ts";

export type Tone = "neutral" | "success" | "warning" | "danger";

export interface StateEntry {
  compact: string;
  full: string;
  tone: Tone;
  /** Sort order: lower comes first. */
  rank: number;
  /** The glossary's meaning of the word. */
  meaning: string;
}

const entry = (compact: string, tone: Tone, rank: number, meaning: string, full = compact): StateEntry => ({ compact, full, tone, rank, meaning });

/** What fsloopUI writes for a field the run folder lacks or the parser cannot read (rules/ui → Conventions 4). */
export const NOT_RECORDED = "не записано";

// ── stages ───────────────────────────────────────────────────────────────────────────────────

/** fsl.mjs's STEPS plus init, integrate and finish (the stage words of the design conventions). */
export const STAGE_WORDS = {
  init: "настройка проекта",
  map: "карта",
  spike: "разведка",
  decompose: "декомпозиция",
  units: "юниты в работе",
  review: "ревью",
  fix: "исправление",
  verdict: "проверка исправлений",
  assess: "приёмка",
  integrate: "интеграция",
  finish: "завершение",
} as const;

export type Step = keyof typeof STAGE_WORDS;

export interface StageValue {
  stage: string | null;
  pass: number | null;
  step: Step | null;
  compact: string;
  full: string;
}

/** «p2-review» → «ревью» compact, «проход 2 · ревью» full; integrate, finish and init carry no pass. */
export function stageOf(stage: string | null | undefined): StageValue {
  if (!stage) return { stage: null, pass: null, step: null, compact: NOT_RECORDED, full: NOT_RECORDED };
  if (stage === "init" || stage === "integrate" || stage === "finish") return { stage, pass: null, step: stage, compact: STAGE_WORDS[stage], full: STAGE_WORDS[stage] };
  const m = /^p(\d+)-(\w+)$/.exec(stage);
  if (!m || !(m[2] in STAGE_WORDS)) return { stage, pass: null, step: null, compact: stage, full: stage };
  const step = m[2] as Step;
  return { stage, pass: Number(m[1]), step, compact: STAGE_WORDS[step], full: `проход ${m[1]} · ${STAGE_WORDS[step]}` };
}

// ── units ────────────────────────────────────────────────────────────────────────────────────

export const UNIT_STATE = {
  drafted: entry("черновик", "neutral", 5, "Бриф юнита написан, юнит ещё не готов к работе."),
  ready: entry("готов к работе", "neutral", 4, "Бриф юнита принят, исполнитель ещё не запущен."),
  implement: entry("пишется", "neutral", 3, "Исполнитель пишет код юнита."),
  verify: entry("проверяется", "neutral", 2, "Прогон проверяет код юнита: типы, линт, тесты."),
  debug: entry("отладка", "neutral", 2, "Проверка юнита упала, прогон ищет причину."),
  land: entry("вливается", "neutral", 1, "Код юнита коммитится в ветку прогона."),
  committed: entry("закоммичен", "success", 6, "Код юнита закоммичен в ветку прогона."),
  blocked: entry("заблокирован", "warning", 0, "Юнит остановлен: прогон ждёт решения или другого юнита."),
  unknown: entry(NOT_RECORDED, "neutral", 7, "Состояние юнита в units.md не распознано."),
} satisfies Record<string, StateEntry>;

export type UnitState = keyof typeof UNIT_STATE;

export const unitStateOf = (state: string | null | undefined): UnitState => (state && state in UNIT_STATE ? (state as UnitState) : "unknown");

/** A unit check's outcome: a line of its verify, land or debug log, by its exit code. */
export const CHECK_OUTCOME = {
  passed: entry("прошла", "success", 0, "Проверка юнита завершилась с кодом выхода 0."),
  failed: entry("упала", "warning", 1, "Проверка юнита завершилась с ненулевым кодом выхода."),
} satisfies Record<string, StateEntry>;

/** «прошла», «упала · exit 1»; a line the log did not split — «не записано». */
export function checkOutcome(exit: number | null): string {
  if (exit === null) return NOT_RECORDED;
  return exit === 0 ? CHECK_OUTCOME.passed.compact : `${CHECK_OUTCOME.failed.compact} · exit ${exit}`;
}

// ── findings ─────────────────────────────────────────────────────────────────────────────────

export const SEVERITY = {
  critical: entry("critical", "danger", 0, "Находка ломает работу или данные: её смотрят первой."),
  major: entry("major", "warning", 1, "Находка нарушает правило так, что пользователь это заметит."),
  minor: entry("minor", "neutral", 2, "Мелкое нарушение правила: исправляется при случае."),
  none: entry("без серьёзности", "neutral", 3, "Критик или исполнитель не указал серьёзность."),
} satisfies Record<string, StateEntry>;

export type Severity = keyof typeof SEVERITY;

/** The run's decision on a finding: a row of findings/<stage>.md. */
export const DECISION = {
  fix: entry("в исправление", "neutral", 0, "Прогон взял находку в работу: её исправит юнит."),
  candidate: entry("кандидат", "neutral", 1, "Находка остаётся в отчёте как идея: прогон её не исправляет."),
  open: entry("открыта", "warning", 2, "Прогон оставил находку открытой: она ждёт решения пользователя."),
  duplicate: entry("дубликат", "neutral", 3, "Находка повторяет другую находку прогона."),
  declined: entry("отклонена", "neutral", 4, "Прогон решил находку не исправлять и записал почему."),
  dropped: entry("отброшена", "neutral", 5, "Прогон счёл находку ошибочной."),
  none: entry("без решения", "neutral", 6, "Прогон ещё не принял решения по находке."),
} satisfies Record<string, StateEntry>;

export type Decision = keyof typeof DECISION;

/** The finding's own fate, as fsl.mjs's statusOf names it. */
export const FINDING_STATUS = {
  undecided: entry("без решения", "neutral", 0, "Прогон ещё не принял решения по находке."),
  candidate: entry("кандидат", "neutral", 9, "Находка остаётся в отчёте как идея: прогон её не исправляет."),
  queued: entry("ждёт юнита", "neutral", 3, "Находка взята в исправление, юнит под неё ещё не назначен."),
  "in-progress": entry("исправляется", "neutral", 4, "Юнит, который её исправляет, в работе."),
  blocked: entry("заблокирована", "warning", 1, "Юнит, который её исправляет, заблокирован."),
  fixed: entry("исправлена", "success", 6, "Юнит с исправлением закоммичен."),
  closed: entry("закрыта", "success", 7, "Проверка исправления признала находку решённой."),
  unresolved: entry("не исправлена", "warning", 2, "Проверка исправления признала его неполным."),
  repeated: entry("повторилась", "warning", 2, "Критик прогона снова поднял находку: исправление не удержалось."),
  open: entry("открыта", "warning", 2, "Прогон оставил находку открытой: она ждёт решения пользователя."),
  duplicate: entry("дубликат", "neutral", 10, "Находка повторяет другую находку прогона."),
  declined: entry("отклонена", "neutral", 11, "Прогон решил находку не исправлять и записал почему."),
  dropped: entry("отброшена", "neutral", 12, "Прогон счёл находку ошибочной."),
} satisfies Record<string, StateEntry>;

export type FindingStatus = keyof typeof FINDING_STATUS;

/** The user's verdict on a finding — the one write of fsloopUI, to human.jsonl (rules/ui → Conventions 6). */
export const VERDICT = {
  agree: entry("согласен", "neutral", 0, "Вы согласны с находкой."),
  disagree: entry("не согласен", "neutral", 1, "Вы не согласны с находкой."),
  "wrong-severity": entry("не та серьёзность", "neutral", 2, "Находка верна, но её серьёзность указана неверно."),
  "false-positive": entry("ложная находка", "neutral", 3, "Находки нет: критик ошибся."),
} satisfies Record<string, StateEntry>;

export type Verdict = keyof typeof VERDICT;

// ── launches ─────────────────────────────────────────────────────────────────────────────────

export interface LaunchLike {
  agent: string | null;
  description: string | null;
}

const UNIT_DESCRIPTION = /^([uf]\d+)\b/;

type Kind = "critic" | "implement" | "map" | "spike";
const KIND_WORDS: Record<Kind, string> = { critic: "критик", implement: "исполнитель", map: "карта", spike: "разведка" };

function kindOf(l: LaunchLike): Kind | null {
  if (l.agent === "fsloop-critic") return "critic";
  if (l.agent === "fsloop-implement") return "implement";
  if (l.agent === "spike-researcher") return "spike";
  if (l.agent === "fsloop-map" || l.description === "map") return "map";
  return null;
}

/** «критик», «исполнитель», «карта», «разведка»; any other agent as written. */
export const agentKind = (l: LaunchLike): string => {
  const k = kindOf(l);
  return k ? KIND_WORDS[k] : (l.agent ?? NOT_RECORDED);
};

/** The one compact launch name: «craft · notifications», «u2 · исполнитель», «карта»; null is the run itself. */
export function launchName(l: LaunchLike | null): string {
  if (!l) return "прогон";
  const kind = kindOf(l);
  const description = (l.description ?? "").trim();
  if (kind === "critic") {
    const [head, ...rest] = description.replace(/^critic\s+/, "").split(/\s+/);
    return rest.length ? `${head} · ${rest.join(" ")}` : head || KIND_WORDS.critic;
  }
  if (kind === "map" || kind === "spike") return KIND_WORDS[kind];
  if (kind === "implement") {
    const unit = UNIT_DESCRIPTION.exec(description)?.[1];
    return `${unit ?? description} · ${KIND_WORDS.implement}`;
  }
  return description || l.agent || NOT_RECORDED;
}

/** The launch names of a run by launch id. A name two launches share carries what tells them apart: «code · проход 2»
 * when the pass does, «code · проход 2 · ревью» when two of them share the pass too; launches of one stage that
 * nothing tells apart keep the bare name. Every surface reads these (craft-10: one concept, one word). */
export function launchNames(launches: readonly (LaunchLike & { id: string; stage: string | null })[]): Map<string, string> {
  const all = launches.map((l) => ({ id: l.id, name: launchName(l), stage: stageOf(l.stage) }));
  const groups = new Map<string, typeof all>();
  for (const l of all) groups.set(l.name, [...(groups.get(l.name) ?? []), l]);
  const out = new Map<string, string>();
  for (const l of all) {
    const group = groups.get(l.name) ?? [];
    const alone = (same: (o: (typeof all)[number]) => boolean) => group.filter(same).length === 1;
    if (group.length === 1) out.set(l.id, l.name);
    else if (l.stage.pass !== null && alone((o) => o.stage.pass === l.stage.pass)) out.set(l.id, `${l.name} · проход ${l.stage.pass}`);
    else if (l.stage.stage && alone((o) => o.stage.stage === l.stage.stage)) out.set(l.id, `${l.name} · ${l.stage.full}`);
    else out.set(l.id, l.name);
  }
  return out;
}

/** «отчёт критика» for a critic's report, «отчёт запуска» for any other. */
export const reportWord = (l: LaunchLike): string => (kindOf(l) === "critic" ? "отчёт критика" : "отчёт запуска");

export const LAUNCH_STATE = {
  running: entry("работает", "neutral", 0, "Агент запущен и ещё не вернул отчёт."),
  done: entry("завершён", "neutral", 1, "Агент вернул отчёт, прогон его сохранил."),
  missing: entry("нет отчёта", "warning", 2, "Запуск записан, но файла его отчёта нет."),
} satisfies Record<string, StateEntry>;

export type LaunchState = keyof typeof LAUNCH_STATE;

/** A launch's state with its age: «работает · 12 мин» (neutral), «завершён · 3 мин», «нет отчёта». */
export function launchState(
  l: { running: boolean; startedAt?: string | null; seconds?: number | null; reportMissing?: boolean },
  now: number | string,
): { state: LaunchState; label: string; tone: Tone } {
  if (l.running) {
    const age = l.startedAt ? new Date(now).getTime() - Date.parse(l.startedAt) : null;
    return { state: "running", label: age === null ? LAUNCH_STATE.running.compact : `${LAUNCH_STATE.running.compact} · ${duration(age, { compact: true })}`, tone: LAUNCH_STATE.running.tone };
  }
  if (l.reportMissing) return { state: "missing", label: LAUNCH_STATE.missing.compact, tone: LAUNCH_STATE.missing.tone };
  const took = l.seconds ? ` · ${duration(l.seconds * 1000, { compact: true })}` : "";
  return { state: "done", label: `${LAUNCH_STATE.done.compact}${took}`, tone: LAUNCH_STATE.done.tone };
}
