// A run's liveness comes from time, not events (rules/ui → Live data 4): the server gives each run's last
// write time, this one function turns its age into the state on the shared clock. The thresholds live here, once.
import type { StateEntry } from "./states.ts";
import { duration } from "./text.ts";

const MIN = 60_000;

/** работает under 5 min, тихо 5–30 min, молчит over 30 min; the sidebar's long-silent group from 6 h. */
export const THRESHOLDS = { quiet: 5 * MIN, silent: 30 * MIN, longSilent: 6 * 60 * MIN } as const;

export type Liveness = "working" | "quiet" | "silent" | "closed" | "unknown";

export const LIVENESS: Record<Liveness, StateEntry> = {
  working: { compact: "работает", full: "работает — прогон писал в последние 5 минут", tone: "neutral", rank: 0, meaning: "Прогон или его агенты писали файлы меньше 5 минут назад." },
  quiet: { compact: "тихо", full: "тихо — прогон не писал от 5 до 30 минут", tone: "neutral", rank: 1, meaning: "Прогон не писал файлы 5–30 минут: агент думает или ждёт долгую команду." },
  silent: { compact: "молчит", full: "молчит — прогон не писал больше 30 минут", tone: "warning", rank: 2, meaning: "Нет записей больше 30 минут: прогон мог встать — проверьте его сессию." },
  closed: { compact: "закрыт", full: "закрыт — прогон завершён", tone: "neutral", rank: 3, meaning: "Прогон прошёл этап «завершение»." },
  unknown: { compact: "не записано", full: "не записано — время последней записи неизвестно", tone: "neutral", rank: 4, meaning: "В папке прогона нет файлов с временем последней записи." },
};

export interface LivenessValue {
  state: Liveness;
  /** «работает», «тихо · 12 мин», «молчит · 3 ч», «закрыт», «не записано». */
  label: string;
  tone: StateEntry["tone"];
  /** Milliseconds since the last write; null when none is recorded. */
  age: number | null;
  /** Open and silent for 6 h or more: the sidebar's «Не закрыты и давно молчат» group. */
  longSilent: boolean;
}

export function livenessOf(lastWriteAt: string | null | undefined, now: number | string, { closed = false } = {}): LivenessValue {
  const at = lastWriteAt ? Date.parse(lastWriteAt) : NaN;
  const age = Number.isNaN(at) ? null : Math.max(0, new Date(now).getTime() - at);
  const of = (state: Liveness, label = LIVENESS[state].compact) => ({ state, label, tone: LIVENESS[state].tone, age, longSilent: state === "silent" && age !== null && age >= THRESHOLDS.longSilent });
  if (closed) return of("closed");
  if (age === null) return of("unknown");
  if (age < THRESHOLDS.quiet) return of("working");
  const span = duration(age, { compact: true });
  if (age < THRESHOLDS.silent) return of("quiet", `${LIVENESS.quiet.compact} · ${span}`);
  return of("silent", `${LIVENESS.silent.compact} · ${span}`);
}
