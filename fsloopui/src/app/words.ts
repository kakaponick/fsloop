// Every string the shell builds from a run's facts (rules/ui → Copy 3–4): the card's and the page's lines, the
// strip and frame messages, the tab title. State words and their tones come from the shared maps; numbers, times
// and spans from shared/text.ts. Each function is tested against a literal.
import { livenessOf } from "../../shared/liveness.ts";
import type { Outcome, RunCard } from "../../shared/model.ts";
import { LAUNCH_STATE, NOT_RECORDED, stageOf, UNIT_STATE, type Tone } from "../../shared/states.ts";
import { ago, count, duration, mskTime, NOUNS, num, plural, type Forms } from "../../shared/text.ts";

export const PRODUCT = "fsloopUI";

/** Why a folder without run.json shows no state (rules/ui → Conventions 4). */
export const NO_RECORD = "в папке нет run.json";
export const NO_RECORD_TEXT = `${NOT_RECORDED}: ${NO_RECORD}`;
/** A card whose folder is gone, held in its place until the strip is clicked. */
export const VANISHED = "папки больше нет";
/** A card that changed since the operator last opened its run (rules/ui → Conventions 9). */
export const NEW_MARK = "новое";
export const NOTHING_RUNS = "Сейчас ни один прогон не идёт — новый появится здесь сам";

const iso = (ms: number) => new Date(ms).toISOString();

/** The genitive after «из» and «до»: «из 1 юнита», «из 20 юнитов». */
function genitive(n: number, forms: Forms): string {
  return n % 10 === 1 && n % 100 !== 11 ? forms[1] : forms[2];
}

/** «до 3 проходов», «до 1 юнита». */
export const upTo = (n: number, forms: Forms): string => `до ${num(n)} ${genitive(n, forms)}`;

/** «3 прогона идут», «1 прогон идёт»; none — the running group's one muted line. */
export function runningCount(n: number): string {
  if (n === 0) return NOTHING_RUNS;
  return `${count(n, NOUNS.run)} ${plural(n, ["идёт", "идут", "идут"])}`;
}

export interface SettingsPart {
  text: string;
  /** An identifier as fsloop wrote it: set in mono (rules/ui → Copy 1). */
  mono: boolean;
}

/** The run's settings, each a part: mode · до N проходов · до K юнитов сразу · models · зеркало .spike. */
export function settingsParts(card: Pick<RunCard, "mode" | "N" | "K" | "models" | "mirror">): SettingsPart[] {
  const parts: SettingsPart[] = [];
  if (card.mode) parts.push({ text: card.mode, mono: true });
  if (card.N) parts.push({ text: upTo(card.N, NOUNS.pass), mono: false });
  if (card.K) parts.push({ text: `${upTo(card.K, NOUNS.unit)} сразу`, mono: false });
  for (const m of card.models) parts.push({ text: m, mono: true });
  if (card.mirror) parts.push({ text: "зеркало .spike", mono: false });
  return parts;
}

export const settingsLine = (card: Pick<RunCard, "mode" | "N" | "K" | "models" | "mirror">): string =>
  settingsParts(card)
    .map((p) => p.text)
    .join(" · ");

/** «приёмка · проход 2 из 3 · <step> · с 15.11 21:41 МСК»; a closed run's «прогон закрыт». */
export function stageLine(card: Pick<RunCard, "recorded" | "closed" | "stage" | "stageLabel" | "N" | "step" | "since">, now: number): string {
  if (!card.recorded) return NO_RECORD_TEXT;
  if (card.closed) return card.stageLabel;
  const s = stageOf(card.stage);
  const parts = [s.compact];
  if (s.pass !== null) parts.push(card.N ? `проход ${num(s.pass)} из ${num(card.N)}` : `проход ${num(s.pass)}`);
  if (card.step) parts.push(card.step);
  if (card.since) parts.push(`с ${mskTime(card.since, now)}`);
  return parts.join(" · ");
}

/** The stage's word alone, for the tab title. */
export function stageWord(card: Pick<RunCard, "recorded" | "closed" | "stage" | "stageLabel">): string {
  if (!card.recorded) return NOT_RECORDED;
  if (card.closed) return card.stageLabel;
  return stageOf(card.stage).compact;
}

const IN_WORK = ["implement", "verify", "debug", "land"] as const;

/** «2 из 20 юнитов закоммичено · 3 в работе»; «юнитов ещё нет». */
export function unitsLine(units: RunCard["units"], total: number): string {
  if (!total) return "юнитов ещё нет";
  const done = units.committed ?? 0;
  const busy = IN_WORK.reduce((n, s) => n + (units[s] ?? 0), 0);
  const verb = done % 10 === 1 && done % 100 !== 11 ? "закоммичен" : "закоммичено";
  const head = `${num(done)} из ${num(total)} ${genitive(total, NOUNS.unit)} ${verb}`;
  return busy ? `${head} · ${num(busy)} в работе` : head;
}

/** «идёт 2 ч 05 мин · 34 запуска агента · 2 коммита»; a closed run has no «идёт». */
export function activityLine(card: Pick<RunCard, "closed" | "startedAt" | "launches" | "commits">, now: number): string {
  const parts: string[] = [];
  if (!card.closed && card.startedAt) parts.push(`идёт ${duration(now - Date.parse(card.startedAt))}`);
  parts.push(count(card.launches, NOUNS.launch));
  if (card.commits !== null) parts.push(count(card.commits, NOUNS.commit));
  return parts.join(" · ");
}

/** «97 запусков агента · 1 работает». */
export function launchesLine(card: Pick<RunCard, "launches" | "running">): string {
  const head = count(card.launches, NOUNS.launch);
  if (!card.running) return head;
  return `${head} · ${num(card.running)} ${plural(card.running, [LAUNCH_STATE.running.compact, "работают", "работают"])}`;
}

/** What waits on the operator, one line: a red gate, then the blocked units; amber, or a neutral «ничего». */
export function waitsLine(card: Pick<RunCard, "redGate" | "blocked">): { tone: Tone; text: string } {
  const parts: string[] = [];
  const gate = card.redGate;
  if (gate) {
    const [first, ...rest] = gate.problems;
    parts.push(first ? `красный гейт: ${first}${rest.length ? ` и ещё ${num(rest.length)}` : ""}` : "красный гейт");
  }
  const blocked = card.blocked;
  if (blocked.length === 1) parts.push(`${UNIT_STATE.blocked.compact} ${blocked[0].id}${blocked[0].why ? ` — ${blocked[0].why}` : ""}`);
  else if (blocked.length > 1) parts.push(`${count(blocked.length, NOUNS.unit)} ${plural(blocked.length, [UNIT_STATE.blocked.compact, "заблокированы", "заблокированы"])}: ${blocked.map((b) => b.id).join(", ")}`);
  return parts.length ? { tone: "warning", text: parts.join(" · ") } : { tone: "neutral", text: "ничего — прогон идёт сам" };
}

/** A closed run's verdict: «цель достигнута · коммиты отправлены», green only for a met goal. */
export function outcomeLine(outcome: Outcome | null): { tone: Tone; text: string } {
  if (!outcome) return { tone: "neutral", text: NOT_RECORDED };
  const parts: string[] = [];
  if (outcome.goalMet !== null) parts.push(outcome.goalMet ? "цель достигнута" : "цель не достигнута");
  parts.push(outcome.pushed ? "коммиты отправлены" : "коммиты не отправлены");
  return { tone: outcome.goalMet ? "success" : "neutral", text: parts.join(" · ") };
}

/** A mini row's last column: the outcome or the silence, then the date in МСК. */
export function miniDetail(card: Pick<RunCard, "recorded" | "closed" | "outcome" | "updatedAt" | "lastWriteAt">, now: number): { tone: Tone; text: string } {
  const at = (card.closed ? card.updatedAt : null) ?? card.lastWriteAt;
  const when = at ? ` · ${mskTime(at, now)}` : "";
  if (!card.recorded) return { tone: "neutral", text: `${NO_RECORD_TEXT}${when}` };
  if (card.closed) {
    const o = outcomeLine(card.outcome);
    return { tone: o.tone, text: `${o.text}${when}` };
  }
  const live = livenessOf(card.lastWriteAt, now);
  return { tone: live.tone, text: `${live.label}${when}` };
}

/** «Закрытые · 53». */
export const foldTitle = (label: string, n: number): string => `${label} · ${num(n)}`;

/** The browser tab: «fsloopUI · admin · a5b5ec85 · приёмка», «● » first when the hidden tab missed a change. */
export const tabTitle = ({ project, id, stage }: { project: string; id: string; stage: string }, changed: boolean): string =>
  `${changed ? "● " : ""}${PRODUCT} · ${project} · ${id} · ${stage}`;

const rootsText = (roots: readonly string[]) => (roots.length ? roots.join(", ") : "корне проектов");

/** The open run's folder is gone (rules/ui → Conventions 13). */
export const runNotFoundText = (id: string, roots: readonly string[]): string => `Прогон ${id} не найден: его папки больше нет в ${rootsText(roots)}`;
/** What is left to do then. */
export const RUN_NOT_FOUND_NEXT = "Откройте другой прогон из списка прогонов.";

/** No runs under the root (rules/ui → Conventions 15). */
export const emptyRootText = (roots: readonly string[]): string => `В ${rootsText(roots)} нет прогонов fsloop. Новый появится здесь сам, когда fsloop создаст его папку.`;

/** The lost connection (rules/ui → Live data 5); compact for a narrow row. */
export function lostText(at: number | null, now: number, { compact = false } = {}): string {
  const head = compact ? "Нет связи" : `Нет связи с сервером ${PRODUCT}`;
  return at === null ? head : `${head} · данные от ${mskTime(iso(at), now)}`;
}

/** The status bar's data age: «обновлено 5 мин назад». */
export const dataAgeText = (at: number, now: number): string => `обновлено ${ago(iso(at), now)}`;
