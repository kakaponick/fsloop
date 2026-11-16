// Every built word of fsloopUI that carries a number or a time: the plural, Moscow time, durations, tokens.
// The server and the client read these; no surface formats a number, a time or a span on its own.

/** The three Russian forms of a noun: for 1, for 2–4, for 5–20 and 0. */
export type Forms = readonly [one: string, few: string, many: string];

/** One noun per fact (rules/ui → Copy 2–3). */
export const NOUNS = {
  run: ["прогон", "прогона", "прогонов"],
  project: ["проект", "проекта", "проектов"],
  finding: ["находка", "находки", "находок"],
  unit: ["юнит", "юнита", "юнитов"],
  launch: ["запуск агента", "запуска агента", "запусков агента"],
  commit: ["коммит", "коммита", "коммитов"],
  report: ["отчёт", "отчёта", "отчётов"],
  frame: ["кадр", "кадра", "кадров"],
  convention: ["соглашение", "соглашения", "соглашений"],
  entry: ["запись", "записи", "записей"],
  pass: ["проход", "прохода", "проходов"],
  token: ["токен", "токена", "токенов"],
} as const satisfies Record<string, Forms>;

export function plural(n: number, forms: Forms): string {
  const a = Math.abs(Math.trunc(n));
  const ten = a % 10;
  const hundred = a % 100;
  if (ten === 1 && hundred !== 11) return forms[0];
  if (ten >= 2 && ten <= 4 && (hundred < 12 || hundred > 14)) return forms[1];
  return forms[2];
}

/** A whole number as Russian prints it: grouped by thousands with a no-break space from five digits. */
export function num(n: number): string {
  const s = String(Math.trunc(n));
  if (Math.abs(n) < 10_000) return s;
  return s.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

/** «3 находки» — the number first, the noun agreed with it. */
export const count = (n: number, forms: Forms): string => `${num(n)} ${plural(n, forms)}`;

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** A span: the largest unit from a minute up — «3 мин», «2 ч 05 мин», «1 д 4 ч», «меньше минуты»;
 * `compact` keeps the largest unit only — «3 ч». */
export function duration(ms: number | null | undefined, { compact = false } = {}): string {
  if (ms === null || ms === undefined || Number.isNaN(ms)) return "—";
  if (ms < MINUTE) return "меньше минуты";
  const d = Math.floor(ms / DAY);
  const h = Math.floor((ms % DAY) / HOUR);
  const m = Math.floor((ms % HOUR) / MINUTE);
  if (d) return compact || !h ? `${d} д` : `${d} д ${h} ч`;
  if (h) return compact || !m ? `${h} ч` : `${h} ч ${String(m).padStart(2, "0")} мин`;
  return `${m} мин`;
}

const MSK = 3 * HOUR;
const pad = (n: number) => String(n).padStart(2, "0");

/** The parts of a moment on Moscow's wall clock (UTC+3, no daylight saving). */
function msk(iso: string | number) {
  const t = new Date(new Date(iso).getTime() + MSK);
  return { y: t.getUTCFullYear(), mo: pad(t.getUTCMonth() + 1), d: pad(t.getUTCDate()), h: pad(t.getUTCHours()), mi: pad(t.getUTCMinutes()), s: pad(t.getUTCSeconds()) };
}

/** «19:41 МСК» today, «15.11 23:40 МСК» off today's Moscow date, «02.03.2025 11:05 МСК» off this year. */
export function mskTime(iso: string, now: string | number): string {
  const a = msk(iso);
  const b = msk(now);
  const time = `${a.h}:${a.mi} МСК`;
  if (a.y === b.y && a.mo === b.mo && a.d === b.d) return time;
  if (a.y === b.y) return `${a.d}.${a.mo} ${time}`;
  return `${a.d}.${a.mo}.${a.y} ${time}`;
}

/** The full form, for a title: «16.11.2026 05:24 МСК». */
export function mskDateTime(iso: string): string {
  const a = msk(iso);
  return `${a.d}.${a.mo}.${a.y} ${a.h}:${a.mi} МСК`;
}

/** A past moment in a narrow place: «5 мин назад», «меньше минуты назад»; the full time goes to the title. */
export const ago = (iso: string, now: string | number): string => `${duration(new Date(now).getTime() - new Date(iso).getTime(), { compact: true })} назад`;

export interface Spend {
  input: number;
  output: number;
  cacheWrite: number;
  cacheRead: number;
}

function compactNumber(n: number): { text: string; scaled: boolean } {
  if (n >= 1_000_000) return { text: `${(Math.round(n / 100_000) / 10).toString().replace(".", ",")} млн`, scaled: true };
  if (n >= 1_000) return { text: `${Math.round(n / 1_000)} тыс.`, scaled: true };
  return { text: String(n), scaled: false };
}

/** A launch's tokens: input + output + cache as one compact total with its noun, the split for its title. */
export function tokens(spend: Spend): { total: number; compact: string; title: string } {
  const total = spend.input + spend.output + spend.cacheWrite + spend.cacheRead;
  const c = compactNumber(total);
  const noun = c.scaled ? NOUNS.token[2] : plural(total, NOUNS.token);
  return {
    total,
    compact: `${c.text} ${noun}`,
    title: `вход ${num(spend.input)} · выход ${num(spend.output)} · запись в кэш ${num(spend.cacheWrite)} · чтение кэша ${num(spend.cacheRead)}`,
  };
}
