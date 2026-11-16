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

/** The fact line's labels: «уверенность критика high», «охват правки component», «место src/…». */
export const FACT = {
  confidence: "уверенность критика",
  cause: "охват правки",
  report: "отчёт",
  location: "место",
} as const;

/** «Ваша оценка: согласен · 19:41 МСК» — the saved verdict; a verdict with no time reads without one. */
export function verdictLine(v: Pick<UserVerdict, "verdict" | "at">, now: number | string): string {
  const word = VERDICT[v.verdict].compact;
  return v.at ? `${SECTION.verdict}: ${word} · ${mskTime(v.at, now)}` : `${SECTION.verdict}: ${word}`;
}

/** Before any verdict: what the four options do, in one line. */
export const VERDICT_PROMPT = "Оценки ещё нет — выберите одну: она сохранится сразу вместе с заметкой";

export const NOTE_LABEL = "Заметка к оценке";
export const NOTE_PLACEHOLDER = "Необязательно: почему вы так считаете";

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
