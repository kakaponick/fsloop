// The absent parts (rules/ui → Conventions 4, 5): «—» where no value exists, «<объект> <id> не найден» where the
// run names an id its folder does not hold — and, where an address names an object its list lacks, the one line
// that says what the run holds and closes — «не записано» with a neutral dot where the folder lacks the field.
// No surface styles its own muted span for any of them. An id a view searches wears the search's mark here too
// (`highlight`, table #12).
import type { ReactNode } from "react";
import { NOT_RECORDED } from "../../shared/states.ts";
import { count, NOUNS } from "../../shared/text.ts";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Gender } from "./part-failed.tsx";
import { StatusDot } from "./status-dot.tsx";

/** «—»: the value does not exist. */
export function Dash({ className }: { className?: string }) {
  return (
    <span data-slot="dash" className={cn("text-muted-foreground", className)}>
      <span aria-hidden="true">—</span>
      <span className="sr-only">нет значения</span>
    </span>
  );
}

/** The objects a run names by id, with the word and the gender its «не найден» agrees with. A journal entry is
 * «решение», as everywhere else in the journal (ux 1: one concept, one word). */
export const OBJECT_WORDS = {
  run: { word: "прогон", gender: "m" },
  unit: { word: "юнит", gender: "m" },
  finding: { word: "находка", gender: "f" },
  report: { word: "отчёт", gender: "m" },
  launch: { word: "запуск агента", gender: "m" },
  entry: { word: "решение", gender: "n" },
  convention: { word: "соглашение", gender: "n" },
  frame: { word: "кадр", gender: "m" },
} as const satisfies Record<string, { word: string; gender: Gender }>;

export type ObjectKind = keyof typeof OBJECT_WORDS;

const NOT_FOUND: Record<Gender, string> = { m: "не найден", f: "не найдена", n: "не найдено" };

/** The objects a view lists by their number (a journal's decisions, a run's conventions): how the number is written —
 * a decision «#12», as its head, its range and the glossary write it (PRODUCT.md → Glossary: «решение #12»), a
 * convention its bare ordinal — the plural a range takes, and the genitive of «адрес <чего>». */
export const NUMBERED = {
  entry: { mark: "#", many: "решения", of: "решения" },
  convention: { mark: "", many: "соглашения", of: "соглашения" },
} as const;

export type NumberedKind = keyof typeof NUMBERED;

const isNumbered = (kind: ObjectKind): kind is NumberedKind => kind in NUMBERED;

/** An object's id as its list writes it: «#12» for a decision, «12» for a convention, any other id as it is. */
export const numberText = (kind: ObjectKind, id: string): string => (isNumbered(kind) ? `${NUMBERED[kind].mark}${id}` : id);

/** The numbers a list holds, first to last: «#1–#43», «#5», «1–26». */
export const numberRange = (kind: NumberedKind, first: string, last: string): string => (first === last ? numberText(kind, first) : `${numberText(kind, first)}–${numberText(kind, last)}`);

const capital = (word: string) => word[0].toUpperCase() + word.slice(1);

/** «юнит u7 не найден», «находка p1-review-craft#craft-3 не найдена», «решение #12 не найдено»; `start` capitalises a
 * sentence's start. */
export function notFoundText(kind: ObjectKind, id: string, { start = false } = {}): string {
  const { word, gender } = OBJECT_WORDS[kind];
  return `${start ? capital(word) : word} ${numberText(kind, id)} ${NOT_FOUND[gender]}`;
}

/** An id the run names but its folder does not hold; `highlight` paints the search's hits in the id. */
export function NotFound({ kind, id, start = false, highlight, className }: { kind: ObjectKind; id: string; start?: boolean; highlight?: (text: string) => ReactNode; className?: string }) {
  const { word, gender } = OBJECT_WORDS[kind];
  const shown = numberText(kind, id);
  return (
    <span data-slot="not-found" className={cn("text-muted-foreground", className)}>
      {start ? capital(word) : word} <span className="font-mono text-xs break-all">{highlight ? highlight(shown) : shown}</span> {NOT_FOUND[gender]}
    </span>
  );
}

/** What a list holds, in the form its kind is counted by — one builder per kind: a numbered list its first and last
 * number (null when it holds none), the findings their count, the units their ids. */
export type Holds = { kind: NumberedKind; range: readonly [string, string] | null } | { kind: "finding"; count: number } | { kind: "unit"; ids: readonly string[] };

/** The plural a list of units takes before its ids. */
const UNITS_WORD = "юниты";

/** A run's unit ids as ranges, one per prefix in the run's order: «u1–u32, f1–f10»; an id with no number stands alone. */
function idRanges(ids: readonly string[]): string {
  const groups = new Map<string, { min: number; max: number } | null>();
  for (const id of ids) {
    const m = /^(\D*)(\d+)$/.exec(id);
    if (!m) {
      groups.set(id, null);
      continue;
    }
    const n = Number(m[2]);
    const g = groups.get(m[1]);
    if (g) groups.set(m[1], { min: Math.min(g.min, n), max: Math.max(g.max, n) });
    else groups.set(m[1], { min: n, max: n });
  }
  return [...groups].map(([prefix, g]) => (!g ? prefix : g.min === g.max ? `${prefix}${g.min}` : `${prefix}${g.min}–${prefix}${g.max}`)).join(", ");
}

/** What the run holds, after a «не найдено»: «: в этом прогоне решения #1–#43», «: в этом прогоне соглашение 1»,
 * «: в этом прогоне 723 находки», «: в этом прогоне юниты u1–u32, f1–f10»; nothing when it holds none. */
function heldText(holds: Holds): string {
  const lead = ": в этом прогоне ";
  if (holds.kind === "finding") return holds.count > 0 ? `${lead}${count(holds.count, NOUNS.finding)}` : "";
  if (holds.kind === "unit") return holds.ids.length ? `${lead}${holds.ids.length === 1 ? OBJECT_WORDS.unit.word : UNITS_WORD} ${idRanges(holds.ids)}` : "";
  if (!holds.range) return "";
  const [first, last] = holds.range;
  return `${lead}${first === last ? OBJECT_WORDS[holds.kind].word : NUMBERED[holds.kind].many} ${numberRange(holds.kind, first, last)}`;
}

/** The one line for an address its list does not hold: «Решение #99 не найдено: в этом прогоне решения #1–#43.»,
 * «Находка … не найдена: в этом прогоне 723 находки.», «Юнит u99 не найден: в этом прогоне юниты u1–u32, f1–f10.» */
export function missingText(kind: NumberedKind, id: string, range: readonly [string, string] | null): string;
export function missingText(holds: Holds, id: string): string;
export function missingText(of: NumberedKind | Holds, id: string, range: readonly [string, string] | null = null): string {
  const holds: Holds = typeof of === "string" ? { kind: of, range } : of;
  return `${notFoundText(holds.kind, id, { start: true })}${heldText(holds)}.`;
}

/** The word of the way out of a «не найдено» line. */
export const CLOSE = "Закрыть";

export type MissingLineProps = Holds & { id: string; onClose: () => void; slot: string; className?: string };

/** An address that names an object its list does not hold (ux 1: what went wrong, what the run holds, the way out):
 * «Решение #99 не найдено: в этом прогоне решения #1–#43.» and «Закрыть», which the caller turns into dropping the
 * address and focusing its list. One line, so it sits in a reserved one: the sentence truncates, whole in its title,
 * and «Закрыть» keeps its box. A polite status, so a screen reader hears it once. */
export function MissingLine({ id, onClose, slot, className, ...holds }: MissingLineProps) {
  const of = holds as Holds;
  return (
    <p role="status" data-slot={slot} className={cn("m-0 flex max-w-measure min-w-0 items-baseline gap-x-2", className)}>
      <span data-slot="missing-sentence" className="min-w-0 truncate" title={missingText(of, id)}>
        <NotFound kind={of.kind} id={id} start />
        {heldText(of)}.
      </span>
      <Button variant="ghost" size="xs" className="shrink-0" onClick={onClose}>
        {CLOSE}
      </Button>
    </p>
  );
}

/** «не записано» with a neutral dot, and what is missing when it is known: «не записано: в папке нет run.json». */
export function NotRecorded({ cause, className }: { cause?: string; className?: string }) {
  return <StatusDot className={className} state={{ tone: "neutral", label: cause ? `${NOT_RECORDED}: ${cause}` : NOT_RECORDED }} />;
}
