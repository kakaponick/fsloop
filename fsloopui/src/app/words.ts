// Every string the shell builds from a run's facts (rules/ui → Copy 3–4): the card's and the page's lines, the
// strip and frame messages, the tab title. State words and their tones come from the shared maps; numbers, times
// and spans from shared/text.ts. Each function is tested against a literal.
import { LIVENESS, livenessOf, type LivenessValue } from "../../shared/liveness.ts";
import type { Outcome, Pass, RunCard, RunSpend } from "../../shared/model.ts";
import { LAUNCH_STATE, NOT_RECORDED, PASS_OUTCOME, stageOf, UNIT_STATE, type PassOutcome, type Tone } from "../../shared/states.ts";
import { addSpend, ago, count, duration, mskTime, NOUNS, num, plural, tokens, type Forms } from "../../shared/text.ts";
import type { GlossaryEntry } from "../ui/tooltip.tsx";

export const PRODUCT = "fsloopUI";

/** Why a folder without run.json shows no state (rules/ui → Conventions 4). */
export const NO_RECORD = "в папке нет run.json";
export const NO_RECORD_TEXT = `${NOT_RECORDED}: ${NO_RECORD}`;
/** A card whose folder is gone, held in its place until the strip is clicked. */
export const VANISHED = "папки больше нет";
/** A card that changed since the operator last opened its run (rules/ui → Conventions 9), and what it means. */
export const NEW_MARK = "новое";
export const NEW_MARK_TITLE = "Прогон изменился с тех пор, как вы открывали его последний раз";
export const NOTHING_RUNS = "Сейчас ни один прогон не идёт — новый появится здесь сам";

const MIN = 60_000;
const iso = (ms: number) => new Date(ms).toISOString();

/** The genitive after «из» and «до»: «из 1 юнита», «из 20 юнитов». */
function genitive(n: number, forms: Forms): string {
  return n % 10 === 1 && n % 100 !== 11 ? forms[1] : forms[2];
}

/** «до 3 проходов», «до 1 юнита». */
export const upTo = (n: number, forms: Forms): string => `до ${num(n)} ${genitive(n, forms)}`;

/** The sidebar's head over the running group: «2 прогона идут · 1 молчит» — a run silent past its threshold is not
 * counted as going (rules/ui → Conventions 4); none — the running group's one muted line. */
export function runningCount(going: number, silent = 0): string {
  if (going === 0 && silent === 0) return NOTHING_RUNS;
  const quiet = (n: number) => plural(n, ["молчит", "молчат", "молчат"]);
  if (going === 0) return `${count(silent, NOUNS.run)} ${quiet(silent)}`;
  const head = `${count(going, NOUNS.run)} ${plural(going, ["идёт", "идут", "идут"])}`;
  return silent ? `${head} · ${num(silent)} ${quiet(silent)}` : head;
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

type StageFacts = Pick<RunCard, "recorded" | "closed" | "stage" | "stageLabel" | "N" | "step" | "since">;

function stageHead(card: StageFacts): string[] {
  const s = stageOf(card.stage);
  const parts = [s.compact];
  if (s.pass !== null) parts.push(card.N ? `проход ${num(s.pass)} из ${num(card.N)}` : `проход ${num(s.pass)}`);
  return parts;
}

/** «приёмка · проход 2 из 3 · с 15.11 21:41 МСК · <step>» — the step last, so a cut takes only it; a closed run's
 * «прогон закрыт». */
export function stageLine(card: StageFacts, now: number): string {
  if (!card.recorded) return NO_RECORD_TEXT;
  if (card.closed) return card.stageLabel;
  const parts = stageHead(card);
  if (card.since) parts.push(`с ${mskTime(card.since, now)}`);
  if (card.step) parts.push(card.step);
  return parts.join(" · ");
}

/** The card's compact stage: «приёмка · проход 2 из 3 · на этапе 22 ч · <step>»; the full line goes to its title
 * (rules/ui → Conventions 10: a past moment in a narrow place reads compact). */
export function stageCompact(card: StageFacts, now: number): string {
  if (!card.recorded) return NO_RECORD_TEXT;
  if (card.closed) return card.stageLabel;
  const parts = stageHead(card);
  if (card.since) parts.push(`на этапе ${duration(now - Date.parse(card.since), { compact: true })}`);
  if (card.step) parts.push(card.step);
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

const LAUNCH_SHORT: Forms = ["запуск", "запуска", "запусков"];

/** «идёт 2 ч 05 мин · 34 запуска агента · 2 коммита»; compact for the card — «идёт 2 ч · 34 запуска · 2 коммита»;
 * a closed run has no «идёт». The launches are the model's `launchCount`: the recorded and the running. */
export function activityLine(card: Pick<RunCard, "closed" | "startedAt" | "launchCount" | "commits">, now: number, { compact = false } = {}): string {
  const parts: string[] = [];
  if (!card.closed && card.startedAt) parts.push(`идёт ${duration(now - Date.parse(card.startedAt), { compact })}`);
  parts.push(count(card.launchCount, compact ? LAUNCH_SHORT : NOUNS.launch));
  if (card.commits !== null) parts.push(count(card.commits, NOUNS.commit));
  return parts.join(" · ");
}

/** «98 запусков агента · 1 работает»: every launch, then the running ones. */
export function launchesLine(total: number, running: number): string {
  const head = count(total, NOUNS.launch);
  if (!running) return head;
  return `${head} · ${num(running)} ${plural(running, [LAUNCH_STATE.running.compact, "работают", "работают"])}`;
}

export const RED_GATE = "красный гейт";

/** One cause of «Ждёт вас»: its term, and what fsloop wrote about it — shown as written. */
export interface WaitCause {
  kind: "gate" | "blocked";
  term: string;
  text: string;
}

/** What waits on the operator, one cause to a row (rules/ui → Layout 3.2): the red gate with its problems, then each
 * blocked unit with why. */
export function waitCauses(card: Pick<RunCard, "redGate" | "blocked">): WaitCause[] {
  const causes: WaitCause[] = [];
  if (card.redGate) causes.push({ kind: "gate", term: RED_GATE, text: card.redGate.problems.join("\n") });
  for (const b of card.blocked) causes.push({ kind: "blocked", term: UNIT_STATE.blocked.compact, text: b.why ? `${b.id} — ${b.why}` : b.id });
  return causes;
}

export const NOTHING_WAITS = "ничего — прогон идёт сам";

/** What waits on the operator, one line for the card: a red gate, then the blocked units; amber, or a neutral
 * «ничего». */
export function waitsLine(card: Pick<RunCard, "redGate" | "blocked">): { tone: Tone; text: string } {
  const parts: string[] = [];
  const gate = card.redGate;
  if (gate) {
    const [first, ...rest] = gate.problems;
    parts.push(first ? `${RED_GATE}: ${first}${rest.length ? ` и ещё ${num(rest.length)}` : ""}` : RED_GATE);
  }
  const blocked = card.blocked;
  if (blocked.length === 1) parts.push(`${UNIT_STATE.blocked.compact} ${blocked[0].id}${blocked[0].why ? ` — ${blocked[0].why}` : ""}`);
  else if (blocked.length > 1) parts.push(`${blockedCount(blocked.length)}: ${blocked.map((b) => b.id).join(", ")}`);
  return parts.length ? { tone: "warning", text: parts.join(" · ") } : { tone: "neutral", text: NOTHING_WAITS };
}

const blockedCount = (n: number) => `${count(n, NOUNS.unit)} ${plural(n, [UNIT_STATE.blocked.compact, "заблокированы", "заблокированы"])}`;

/** The causes in a few words, for a mini row: «красный гейт · заблокирован u23»; null when nothing waits. */
export function waitsShort(card: Pick<RunCard, "redGate" | "blocked">): string | null {
  const parts: string[] = [];
  if (card.redGate) parts.push(RED_GATE);
  if (card.blocked.length === 1) parts.push(`${UNIT_STATE.blocked.compact} ${card.blocked[0].id}`);
  else if (card.blocked.length > 1) parts.push(blockedCount(card.blocked.length));
  return parts.length ? parts.join(" · ") : null;
}

/** The glossary on «Ждёт вас»'s terms (ui → Glossary: what the value is). */
export const WAITS_GLOSSARY = [
  { value: RED_GATE, meaning: "проверка этапа нашла нарушения, и прогон не идёт дальше" },
  { value: UNIT_STATE.blocked.compact, meaning: UNIT_STATE.blocked.meaning },
] as const;

/** The liveness words a reader may not know, in the map's order (ui → Glossary). */
export const LIVENESS_TERMS = ["working", "quiet", "silent"] as const;

/** The glossary on the sidebar's «Прогоны», the header of every card and row under it (ui → Glossary): the liveness
 * words, «новое» and what waits on the operator — the words a card shows that a reader may not know. */
export const RUNS_GLOSSARY = [
  ...LIVENESS_TERMS.map((k) => ({ value: LIVENESS[k].compact, meaning: LIVENESS[k].meaning })),
  { value: NEW_MARK, meaning: NEW_MARK_TITLE },
  ...WAITS_GLOSSARY,
] as const;

/** A card's liveness while the connection is lost: nothing is known past the data's time. */
export const LOST_LIVENESS = "нет связи";

/** The widest liveness a running card shows: its box is reserved at this form (rules/ui → Strict 1). A run silent
 * for 6 h leaves the running group, so its age stops below an hour's next unit. */
export const LIVENESS_WIDEST = `${LIVENESS.silent.compact} · ${duration(59 * MIN, { compact: true })}`;

/** A run's liveness as the shell shows it, at the shell's «now» — the data's time while the connection is lost, so
 * nothing ages or regroups — and, while lost, neutral and «нет связи» instead of a state the stream cannot confirm
 * (rules/ui → Conventions 4, Live data 4–5). */
export function livenessShown(card: Pick<RunCard, "lastWriteAt" | "closed">, now: number, lost: boolean): LivenessValue & { lost: boolean } {
  const live = livenessOf(card.lastWriteAt, now, { closed: card.closed === true });
  if (!lost || live.state === "closed") return { ...live, lost: false };
  return { ...live, tone: "neutral", label: LOST_LIVENESS, lost: true };
}

/** «данные от 19:41 МСК»: the time the shown data was read. */
export const dataFromText = (at: number, now: number): string => `данные от ${mskTime(iso(at), now)}`;

/** The card's name for assistive technology: «admin · a5b5ec85 · работает», «· новое» when it changed. */
export const cardLabel = (card: Pick<RunCard, "project" | "id">, liveness: string, fresh: boolean): string =>
  [card.project, card.id, liveness, fresh ? NEW_MARK : null].filter(Boolean).join(" · ");

/** A closed run's verdict: «цель достигнута · коммиты отправлены», green only for a met goal. */
export function outcomeLine(outcome: Outcome | null): { tone: Tone; text: string } {
  if (!outcome) return { tone: "neutral", text: NOT_RECORDED };
  const parts: string[] = [];
  if (outcome.goalMet !== null) parts.push(outcome.goalMet ? "цель достигнута" : "цель не достигнута");
  parts.push(outcome.pushed ? "коммиты отправлены" : "коммиты не отправлены");
  return { tone: outcome.goalMet ? "success" : "neutral", text: parts.join(" · ") };
}

type MiniFacts = Pick<RunCard, "recorded" | "closed" | "outcome" | "updatedAt" | "lastWriteAt" | "redGate" | "blocked">;

/** A mini row's last column: what waits, the outcome or the liveness — no clock time: the liveness's age already says
 * when, and the row's title carries the time (craft-4; rules/ui → Conventions 10). */
export function miniDetail(card: MiniFacts, now: number, { lost = false } = {}): { tone: Tone; text: string } {
  if (!card.recorded) return { tone: "neutral", text: NO_RECORD_TEXT };
  if (card.closed) return outcomeLine(card.outcome);
  const live = livenessShown(card, now, lost);
  const waits = waitsShort(card);
  if (waits) return { tone: "warning", text: `${waits} · ${live.label}` };
  return { tone: live.tone, text: live.label };
}

/** The moment a mini row stands for, with what it is: «закрыт 15.11 23:40 МСК», «последняя запись 12:41 МСК». */
function miniMoment(card: MiniFacts, now: number): string | null {
  if (card.closed && card.updatedAt) return `закрыт ${mskTime(card.updatedAt, now)}`;
  return card.lastWriteAt ? `последняя запись ${mskTime(card.lastWriteAt, now)}` : null;
}

/** A mini row's title, the whole of it: «shop · 37d5a31e · молчит · 7 ч · последняя запись 12:41 МСК · новое». */
export const miniTitle = (card: MiniFacts & Pick<RunCard, "project" | "id">, detail: string, now: number, fresh: boolean): string =>
  [card.project, card.id, detail, miniMoment(card, now), fresh ? NEW_MARK : null].filter(Boolean).join(" · ");

/** A closed run's second line: when it closed and its goal's first words — what tells one closed run from the next
 * (p1-review cand-3): «закрыт 15.11 23:40 МСК · Run 24: bring the …». */
export const closedLine = (card: Pick<RunCard, "updatedAt" | "lastWriteAt" | "goal">, now: number): string => {
  const at = card.updatedAt ?? card.lastWriteAt;
  return [at ? `закрыт ${mskTime(at, now)}` : null, card.goal].filter(Boolean).join(" · ");
};

/** The sidebar's search: the fields it looks in, named in its placeholder (table #12). */
export const SEARCH_PLACEHOLDER = "Проект, id, цель";

/** Whether a run answers the sidebar's search: every word of it in the project, the id or the goal, case aside. */
export function runMatches(card: Pick<RunCard, "project" | "id" | "goal">, query: string): boolean {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const hay = [card.project, card.id, card.goal ?? ""].join("\n").toLowerCase();
  return words.every((w) => hay.includes(w));
}

/** What a settings row's words mean, for the words a new reader cannot read alone (cand-8; ui → Glossary). */
const MODE_MEANING: Record<string, string> = {
  inline: "прогон работает прямо в рабочей копии проекта, без копий для юнитов",
  worktree: "прогон работает в своей копии репозитория, каждый юнит — в своей",
};
const PASS_MEANING = "один круг этапов прогона: работа, ревью, исправление, приёмка";
const MIRROR_MEANING = "общая папка исследований видна в копии каждого юнита";

/** The glossary on «Настройки»: the mode, «проход» and the mirror — only what the row shows, in its order. */
export function settingsGlossary(card: Pick<RunCard, "mode" | "N" | "K" | "models" | "mirror">): GlossaryEntry[] {
  const entries: GlossaryEntry[] = [];
  if (card.mode && MODE_MEANING[card.mode]) entries.push({ value: card.mode, meaning: MODE_MEANING[card.mode] });
  if (card.N) entries.push({ value: NOUNS.pass[0], meaning: PASS_MEANING });
  if (card.mirror) entries.push({ value: "зеркало .spike", meaning: MIRROR_MEANING });
  return entries;
}

/** The run's tokens for «Подробнее»: its agent launches and its own sessions (the orchestrator) in one compact total,
 * the split in the title, in the words of the facts beside it (p1-decompose-u3-shape cand-2); null when the record
 * holds none. */
export function spendLine(spend: RunSpend | null): { text: string; title: string } | null {
  if (!spend) return null;
  const total = spend.orchestrator ? addSpend(spend.launches, spend.orchestrator) : spend.launches;
  const all = tokens(total);
  const own = spend.orchestrator ? `сессии прогона ${tokens(spend.orchestrator).compact}` : "сессии прогона не записаны";
  return { text: all.compact, title: `запуски агентов ${tokens(spend.launches).compact} · ${own}\n${all.title}` };
}

/** The outcome words of a pass, explained on «Проходы» (ui → Glossary). */
export const PASSES_GLOSSARY: readonly GlossaryEntry[] = (["next", "converged", "cap"] as const).map((k) => ({ value: PASS_OUTCOME[k].compact, meaning: PASS_OUTCOME[k].meaning }));

const passWord = (outcome: string): string => (outcome in PASS_OUTCOME ? PASS_OUTCOME[outcome as PassOutcome].compact : outcome);

const NO_PASS = "ни один проход ещё не закончен";

/** The finished passes in one line — «проход 1 — следующий проход · проход 2 — нечего исправлять» — and in the title
 * each with the findings it took into the next and why (p1-decompose-design-check cand-1). An outcome the map lacks
 * reads as written. */
export function passesLine(passes: readonly Pass[]): { text: string; title: string } {
  if (!passes.length) return { text: NO_PASS, title: NO_PASS };
  return {
    text: passes.map((p) => `${NOUNS.pass[0]} ${num(p.pass)} — ${passWord(p.outcome)}`).join(" · "),
    title: passes.map((p) => `Проход ${num(p.pass)} — ${passWord(p.outcome)}${p.taken ? `: ${count(p.taken, NOUNS.finding)} в исправление` : ""}${p.why ? `. ${p.why}` : ""}`).join("\n"),
  };
}

/** «ещё 2 · показать»: the causes past «Ждёт вас»'s held box, and what a click does (craft-9). */
export const waitsMoreText = (n: number): string => `ещё ${num(n)} · показать`;

/** «Закрытые · 53». */
export const foldTitle = (label: string, n: number): string => `${label} · ${num(n)}`;

/** The goal as its own lines, each trimmed, blank ones dropped: a clamp shows its first lines, never its numbered
 * points run together. */
export const goalLines = (goal: string): string =>
  goal
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n");

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
  return at === null ? head : `${head} · ${dataFromText(at, now)}`;
}

/** The status bar's data age: «обновлено 5 мин назад». */
export const dataAgeText = (at: number, now: number): string => `обновлено ${ago(iso(at), now)}`;
