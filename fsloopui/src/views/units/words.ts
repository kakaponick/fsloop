// The words of «Юниты» that code builds (rules/ui → Copy 3–4: each is tested with the widest real input against a
// literal): the detail's section headings, a check's outcome and its attempts, the toolbar facts, a missing unit, the
// cell's cause. State words come from shared/states.ts; the plural, durations and Moscow time from shared/text.ts.
import { count, NOUNS, type Forms } from "../../../shared/text.ts";
import { notFoundText, type GlossaryEntry } from "@/ui";

/** The detail's sections, in reading order (surfaces/units.md → BLOCKS → expanded detail). */
export const SECTION = {
  launches: "Запуски агентов",
  checks: "Проверки юнита",
} as const;

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

/** «4 попытки» — shown only when a check ran more than once. */
export const attemptsText = (n: number): string | null => (n > 1 ? count(n, ATTEMPTS) : null);

/** A check's last outcome: the words of shared/states.ts's check-outcome map (code-10). */
export { checkOutcome } from "../../../shared/states.ts";

/** The log a check's line comes from: «verify.log.lines» → «verify». */
export const logName = (file: string): string => file.replace(/\.log\.lines$|\.lines$/, "");

/** The cause of a waiting unit: «ждёт u2, u23». */
export const waitsText = (ids: readonly string[]): string | null => (ids.length ? `ждёт ${ids.join(", ")}` : null);

/** «Юнит u99 не найден: в этом прогоне его нет — проверьте ссылку» — a link to an id the run does not hold. */
export const unitNotFound = (id: string): string => `${notFoundText("unit", id, { start: true })}${NOT_FOUND_NEXT}`;
export const NOT_FOUND_NEXT = ": в этом прогоне его нет — проверьте ссылку";

/** What a part of the run folder failed as: «Список юнитов не прочитан: …», «Бриф units/u3/brief.md не прочитан: …». */
export const UNITS_PART = "Список юнитов";
export const briefPart = (path: string): string => `Бриф ${path}`;

/** The toolbar facts (surfaces/units.md → ACTIONS): what no unit takes, as counts that open «Находки». */
export const CANDIDATES: Forms = ["находка-кандидат", "находки-кандидата", "находок-кандидатов"];
export const UNDECIDED = "без решения";
export const candidatesText = (n: number): string => count(n, CANDIDATES);
export const undecidedText = (n: number): string => `${count(n, NOUNS.finding)} ${UNDECIDED}`;
/** The widest form each fact takes at three digits: its box is reserved at that width (rules/ui → Strict 1). */
export const CANDIDATES_WIDEST = candidatesText(888);
export const UNDECIDED_WIDEST = undecidedText(888);
/** The facts' titles: what the count is and where it leads (ux 1: one step away). */
export const CANDIDATES_TITLE = "Находки-кандидаты: прогон их не исправляет — открыть в «Находках»";
export const UNDECIDED_TITLE = "Находки без решения прогона — открыть в «Находках»";

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
