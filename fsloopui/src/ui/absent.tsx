// The absent parts (rules/ui → Conventions 4, 5): «—» where no value exists, «<объект> <id> не найден» where the
// run names an id its folder does not hold — and, where an address names an object its list lacks, the one line
// that says what the run holds and closes — «не записано» with a neutral dot where the folder lacks the field.
// No surface styles its own muted span for any of them. An id a view searches wears the search's mark here too
// (`highlight`, table #12).
import type { ReactNode } from "react";
import { NOT_RECORDED } from "../../shared/states.ts";
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

/** What the run holds, after a «не найдено»: «: в этом прогоне решения #1–#43», «: в этом прогоне соглашение 1». */
const holdsText = (kind: NumberedKind, [first, last]: readonly [string, string]): string => `: в этом прогоне ${first === last ? OBJECT_WORDS[kind].word : NUMBERED[kind].many} ${numberRange(kind, first, last)}`;

/** The one line for an address its list does not hold: «Решение #99 не найдено: в этом прогоне решения #1–#43.»;
 * `range` — the first and the last number the list holds, null when it holds none. */
export const missingText = (kind: NumberedKind, id: string, range: readonly [string, string] | null): string => `${notFoundText(kind, id, { start: true })}${range ? holdsText(kind, range) : ""}.`;

/** The word of the way out of a «не найдено» line. */
export const CLOSE = "Закрыть";

/** An address that names an object its list does not hold (ux 1: what went wrong, what the run holds, the way out):
 * «Решение #99 не найдено: в этом прогоне решения #1–#43.» and «Закрыть», which the caller turns into dropping the
 * address and focusing its list. A polite status, so a screen reader hears it once. */
export function MissingLine({ kind, id, range, onClose, slot, className }: { kind: NumberedKind; id: string; range: readonly [string, string] | null; onClose: () => void; slot: string; className?: string }) {
  return (
    <p role="status" data-slot={slot} className={cn("m-0 flex max-w-measure flex-wrap items-baseline gap-x-2", className)}>
      <span>
        <NotFound kind={kind} id={id} start />
        {range ? holdsText(kind, range) : ""}.
      </span>
      <Button variant="ghost" size="xs" onClick={onClose}>
        {CLOSE}
      </Button>
    </p>
  );
}

/** «не записано» with a neutral dot, and what is missing when it is known: «не записано: в папке нет run.json». */
export function NotRecorded({ cause, className }: { cause?: string; className?: string }) {
  return <StatusDot className={className} state={{ tone: "neutral", label: cause ? `${NOT_RECORDED}: ${cause}` : NOT_RECORDED }} />;
}
