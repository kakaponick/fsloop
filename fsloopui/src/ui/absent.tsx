// The absent parts (rules/ui → Conventions 4, 5): «—» where no value exists, «<объект> <id> не найден» where the
// run names an id its folder does not hold, «не записано» with a neutral dot where the folder lacks the field.
// No surface styles its own muted span for any of them. An id a view searches wears the search's mark here too
// (`highlight`, table #12).
import type { ReactNode } from "react";
import { NOT_RECORDED } from "../../shared/states.ts";
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

const capital = (word: string) => word[0].toUpperCase() + word.slice(1);

/** «юнит u7 не найден», «находка p1-review-craft#craft-3 не найдена», «решение 12 не найдено»; `start` capitalises a
 * sentence's start. */
export function notFoundText(kind: ObjectKind, id: string, { start = false } = {}): string {
  const { word, gender } = OBJECT_WORDS[kind];
  return `${start ? capital(word) : word} ${id} ${NOT_FOUND[gender]}`;
}

/** An id the run names but its folder does not hold; `highlight` paints the search's hits in the id. */
export function NotFound({ kind, id, start = false, highlight, className }: { kind: ObjectKind; id: string; start?: boolean; highlight?: (text: string) => ReactNode; className?: string }) {
  const { word, gender } = OBJECT_WORDS[kind];
  return (
    <span data-slot="not-found" className={cn("text-muted-foreground", className)}>
      {start ? capital(word) : word} <span className="font-mono text-xs break-all">{highlight ? highlight(id) : id}</span> {NOT_FOUND[gender]}
    </span>
  );
}

/** «не записано» with a neutral dot, and what is missing when it is known: «не записано: в папке нет run.json». */
export function NotRecorded({ cause, className }: { cause?: string; className?: string }) {
  return <StatusDot className={className} state={{ tone: "neutral", label: cause ? `${NOT_RECORDED}: ${cause}` : NOT_RECORDED }} />;
}
