// The words of «Юниты» that code builds (rules/ui → Copy 3–4: each is tested with the widest real input against a
// literal): the detail's section headings, a check's outcome and its attempts, the toolbar facts, a missing unit, the
// cell's cause. State words come from shared/states.ts; the plural, durations and Moscow time from shared/text.ts.
import { launchState } from "../../../shared/states.ts";
import { count, NOUNS, type Forms } from "../../../shared/text.ts";
import type { GlossaryEntry, HeldNoun } from "@/ui";

/** The detail's sections, in reading order (surfaces/units.md → BLOCKS → expanded detail). */
export const SECTION = {
  launches: "Запуски агентов",
  checks: "Проверки юнита",
} as const;

/** A section with nothing to list says so on its one muted line, never a heading over a lone «—» — as a unit that
 * closes nothing reads «Не закрывает ни одной находки» (DESIGN.md → Fact List; p3-verdict-critic-craft-verdict-2#craft-3).
 * True in every state: a launch or a check that arrives later waits in the line's strip. */
export const SECTION_NONE = {
  launches: "Запусков агентов не было",
  checks: "Проверок юнита не было",
} as const;

/** A committed unit's launches and checks behind one «Подробнее» (ux 9 → Provenance): the fold's name for assistive
 * technology, and its storage key. */
export const PROVENANCE_LABEL = "Запуски агентов и проверки юнита";
export const PROVENANCE_FOLD = "unit-provenance";

/** The header row of each list in the detail (ux 1: a column says what its values are; a time says start or end). */
export const LAUNCH_HEAD = ["Агент и задача", "Модель", "Начало", "Состояние", "Токены"] as const;
export const CHECK_HEAD = ["Проверка", "Итог", "Попытки", "Конец", "Строка лога"] as const;

/** The fact list's labels (cold-read: each names its object). */
export const FACT = {
  title: "Что делает",
  kind: "Вид работы",
  waits: "Ждёт юнитов",
  why: "Причина блокировки",
  tree: "Рабочая копия",
  commits: "Коммиты",
  brief: "Бриф юнита",
} as const;

/** «находку» after «закрывает»: the accusative of «находка». */
const FINDINGS_ACC: Forms = ["находку", "находки", "находок"];

/** «Закрывает 3 находки», «Закрывает 1 находку»; none — «Не закрывает ни одной находки». */
export const closesTitle = (n: number): string => (n === 0 ? "Не закрывает ни одной находки" : `Закрывает ${count(n, FINDINGS_ACC)}`);

const ATTEMPTS: Forms = ["попытка", "попытки", "попыток"];

/** «1 попытка», «4 попытки»: how many times a check ran — a check that ran once has a value too, so «—» reads only
 * where none is recorded (rules/ui → Conventions 5; craft-8). */
export const attemptsText = (n: number): string | null => (n > 0 ? count(n, ATTEMPTS) : null);

/** A check's last outcome: the words of shared/states.ts's check-outcome map (code-10). */
export { checkOutcome } from "../../../shared/states.ts";

/** The log a check's line comes from: «verify.log.lines» → «verify». */
export const logName = (file: string): string => file.replace(/\.log\.lines$|\.lines$/, "");

/** The word before a log's name on its group row of «Проверки юнита»: «лог land», the name in mono. */
export const LOG_WORD = "лог";

/** What fsloop recorded on its own: the launch's state, its time, and a check's log line — the header glossaries
 * (ui → Glossary: once, on the header that names the set; never on an item). The values are `launchState`'s own
 * forms, so the glossary reads what the cells read. */
export const LAUNCH_STATE_GLOSSARY: readonly GlossaryEntry[] = [
  { value: launchState({ running: true, startedAt: new Date(0).toISOString() }, 12 * 60_000).label, meaning: "агент ещё не вернул отчёт; время — с его запуска" },
  { value: launchState({ running: false, seconds: 9 * 60 }, 0).label, meaning: "агент вернул отчёт; время — сколько он работал" },
  { value: launchState({ running: false, reportMissing: true }, 0).label, meaning: "запуск записан, но файла его отчёта нет" },
];
export const LOG_LINE_GLOSSARY: readonly GlossaryEntry[] = [{ value: CHECK_HEAD[4], meaning: "что проверка вывела последней строкой, как записано в логе" }];

/** The cause of a waiting unit: «ждёт u2, u23». */
export const waitsText = (ids: readonly string[]): string | null => (ids.length ? `ждёт ${ids.join(", ")}` : null);

// A link to a unit the run does not hold reads the one not-found line, `MissingLine` of `@/ui`, with the run's units as a
// range per prefix (improve-13): «Юнит u99 не найден: в этом прогоне юниты u1–u32, f1–f10.»

/** What a part of the run folder failed as: «Список юнитов не прочитан: …», «Бриф units/u3/brief.md не прочитан: …». */
export const UNITS_PART = "Список юнитов";
export const briefPart = (path: string): string => `Бриф ${path}`;

/** The toolbar facts (surfaces/units.md → ACTIONS): what no unit takes, as counts that open «Находки». Each is a
 * count and the run's own decision word (ui → Page chrome: «count state»): «280 кандидатов», «12 без решения» — the
 * words of the decision filter they open in «Находки». What the count is and where it leads stay in its title.
 * improve-4 cut «находок-кандидатов», craft-5 the noun of «находок без решения»: with it, «Проход» folded into «…» at
 * 1440. */
export const CANDIDATES: Forms = ["кандидат", "кандидата", "кандидатов"];
export const UNDECIDED = "без решения";
export const candidatesText = (n: number): string => count(n, CANDIDATES);
export const undecidedText = (n: number): string => `${n} ${UNDECIDED}`;
/** The widest form each fact takes at three digits: its box is reserved at that width (rules/ui → Strict 1). */
export const CANDIDATES_WIDEST = candidatesText(888);
export const UNDECIDED_WIDEST = undecidedText(888);
/** The facts' titles: what the count is and where it leads (ux 1: one step away). */
export const CANDIDATES_TITLE = "Находки-кандидаты: прогон их не исправляет — открыть в «Находках»";
export const UNDECIDED_TITLE = "Находки, по которым прогон ещё не принял решения, — открыть в «Находках»";

/** What a section of an open detail holds while a live change brings more: the held-order strip's noun in its
 * heading line — «1 новый запуск агента · показать», «2 новых проверки · показать». */
export const HELD_NOUN: Record<"finding" | "launch" | "check", HeldNoun> = {
  finding: { forms: NOUNS.finding, gender: "f" },
  launch: { forms: NOUNS.launch, gender: "m" },
  check: { forms: ["проверка", "проверки", "проверок"], gender: "f" },
};

/** The row menu's item beyond «Открыть» and the copies; it is listed only for a unit that closes findings. */
export const OPEN_FINDINGS = "Открыть находки юнита";

/** The age's entry in the state column's glossary: what «· 12 мин» counts (ui → Glossary: a cell's second part). */
export const AGE_ENTRY: GlossaryEntry = { value: "· 12 мин", meaning: "сколько прошло с запуска исполнителя или с последней проверки" };
export const MAJOR_ENTRY: GlossaryEntry = { value: "major+", meaning: "major и выше: находки critical и major, которые закрывает юнит" };
export const MINOR_ENTRY: GlossaryEntry = { value: "minor", meaning: "находки minor, которые закрывает юнит" };
export const PASS_ENTRY: GlossaryEntry = { value: "Проход", meaning: "круг этапов прогона, в котором прогон завёл юнит" };
export const LAUNCHES_ENTRY: GlossaryEntry = { value: "Запуски", meaning: "сколько раз прогон запускал агентов для этого юнита" };

/** The table's accessible name. */
export const tableLabel = (runId: string): string => `Юниты прогона ${runId}`;
