// The words of a finding that code builds (rules/ui → Copy 4: each is tested with the widest real input): the
// detail's section headings, the user's saved verdict, the verdict dialog's title, the failed write's toast, the
// fact line's labels. State words come from shared/states.ts, never from here.
import type { Finding, UserVerdict } from "../../shared/model.ts";
import { NOT_RECORDED, VERDICT } from "../../shared/states.ts";
import { count, mskTime } from "../../shared/text.ts";
import { notFoundText } from "@/ui";

/** The detail's sections, in reading order (surfaces/findings.md → BLOCKS → FindingDetail). */
export const SECTION = {
  observation: "Наблюдение",
  fix: "Правка",
  question: "Вопрос, который закрывает правка",
  rule: "Правило",
  /** The text when the report's line has no split: one section, never a repeated one. */
  whole: "Текст находки",
  decision: "Решение прогона",
  verdict: "Ваша оценка",
  frames: "Кадры находки",
} as const;

/** The fact line's labels: «уверенность критика», «охват правки» (the raw value's title), «место src/…». */
export const FACT = {
  confidence: "уверенность критика",
  cause: "охват правки",
  report: "отчёт",
  location: "место",
} as const;

/** A critic's enum in Russian (ux 0): the fact line's words and the column's glossary meaning, one entry per value. */
export interface EnumWord {
  fact: string;
  meaning: string;
}

/** The critic's confidence: «критик скорее уверен» on the fact line, the meaning in the column's glossary. */
export const CONFIDENCE: Readonly<Record<string, EnumWord>> = {
  high: { fact: "критик уверен", meaning: "критик уверен в находке" },
  med: { fact: "критик скорее уверен", meaning: "критик скорее уверен в находке" },
  low: { fact: "критик не уверен", meaning: "критик не уверен: находку стоит перепроверить" },
};

/** The fix's reach: «правка в общем компоненте» on the fact line, the meaning in the column's glossary. */
export const CAUSE: Readonly<Record<string, EnumWord>> = {
  local: { fact: "правка в одном месте", meaning: "правка в одном месте экрана" },
  component: { fact: "правка в общем компоненте", meaning: "правка в общем компоненте: меняются все его экраны" },
  token: { fact: "правка в токене темы", meaning: "правка в токене темы: меняется вид всего продукта" },
  conceptual: { fact: "правка в замысле экрана", meaning: "правка в замысле экрана: меняется его устройство" },
};

/** A column's glossary from an enum's words: «value — meaning», in the map's order. */
export const enumGlossary = (words: Readonly<Record<string, EnumWord>>): { value: string; meaning: string }[] => Object.entries(words).map(([value, w]) => ({ value, meaning: w.meaning }));

/** The fact for a critic's enum value: its Russian words, and the raw value with its meaning in the title
 * («уверенность критика: med — критик скорее уверен в находке»). A value the map lacks reads as written. */
export function enumFact(words: Readonly<Record<string, EnumWord>>, label: string, value: string): { text: string; title: string } {
  const w = words[value];
  return w ? { text: w.fact, title: `${label}: ${value} — ${w.meaning}` } : { text: `${label} ${value}`, title: `${label}: ${value}` };
}

/** «согласен · 19:41 МСК» — the saved verdict under its heading «Ваша оценка»; with no time, the word alone. */
export function verdictValue(v: Pick<UserVerdict, "verdict" | "at">, now: number | string): string {
  const word = VERDICT[v.verdict].compact;
  return v.at ? `${word} · ${mskTime(v.at, now)}` : word;
}

/** «Ваша оценка: согласен · 19:41 МСК» — the saved verdict where no heading names it (the dialog). */
export const verdictLine = (v: Pick<UserVerdict, "verdict" | "at">, now: number | string): string => `${SECTION.verdict}: ${verdictValue(v, now)}`;

/** Before any verdict, under the heading «Ваша оценка», right above the four choices. */
export const VERDICT_PROMPT = "Оценки ещё нет — выберите одну";
/** The dialog over one finding with no verdict: the note above, then the choice that saves and closes. */
export const DIALOG_PROMPT = "Выберите оценку — она сразу сохранится вместе с заметкой";

export const NOTE_LABEL = "Заметка к оценке";
export const NOTE_PLACEHOLDER = "Необязательно: почему вы так считаете";
/** The detail's reserved line under the note while its text differs from the saved one (ux 4). */
export const NOTE_UNSAVED = "Заметка не сохранена";
/** …and before any verdict: the note goes with the first choice. */
export const NOTE_UNSAVED_FIRST = "Заметка не сохранена — она сохранится вместе с оценкой";
export const NOTE_SAVE = "Сохранить заметку";

/** The verdict dialog's title: «Оценка находки p1-map-craft-shell#craft-3», «Оценка для 12 находок». */
export const verdictTitle = (ids: readonly string[]): string => (ids.length === 1 ? `Оценка находки ${ids[0]}` : `Оценка для ${count(ids.length, ["находки", "находок", "находок"])}`);

/** The row menu's item that opens the dialog. */
export const RATE_ACTION = "Оценить…";

/** The failed write's toast: its title, and the cause under it without the server's own copy of the title. */
export const SAVE_FAILED = "Оценка не сохранилась";
export const failedCause = (cause: string): string => cause.replace(/^Оценка не сохранилась:\s*/, "") || "сервер не ответил";

/** «Находка p1-review-critic-code#code-99 не найдена» — a link to an id the run does not hold. */
export const findingNotFound = (id: string): string => `${notFoundText("finding", id, { start: true })}${NOT_FOUND_NEXT}`;
/** What follows «Находка <id> не найдена»: why, and what to do. */
export const NOT_FOUND_NEXT = ": в этом прогоне её нет — проверьте ссылку";

/** The «Отчёт» cell and fact: the compact launch name; the run's own finding is «прогон»; a critic's finding whose
 * launch the record lacks reads «не записано» (Conventions 4). */
export const reportWord = (f: Pick<Finding, "source" | "launch" | "launchName">): string => (f.source === "own" || f.launch ? f.launchName : NOT_RECORDED);
