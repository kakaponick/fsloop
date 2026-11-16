// The absent parts (rules/ui → Conventions 4, 5): «—» where no value exists, «<объект> <id> не найден» where the
// run names an id its folder does not hold, «не записано» with a neutral dot where the folder lacks the field.
// No surface styles its own muted span for any of them.
import { NOT_RECORDED } from "../../shared/states.ts";
import { cn } from "@/lib/utils";
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

/** The objects a run names by id, with the word and the gender its «не найден» agrees with. */
export const OBJECT_WORDS = {
  run: { word: "прогон", feminine: false },
  unit: { word: "юнит", feminine: false },
  finding: { word: "находка", feminine: true },
  report: { word: "отчёт", feminine: false },
  launch: { word: "запуск агента", feminine: false },
  entry: { word: "запись журнала", feminine: true },
  frame: { word: "кадр", feminine: false },
} as const;

export type ObjectKind = keyof typeof OBJECT_WORDS;

/** «юнит u7 не найден», «находка p1-review-craft#craft-3 не найдена»; `start` capitalises a sentence's start. */
export function notFoundText(kind: ObjectKind, id: string, { start = false } = {}): string {
  const { word, feminine } = OBJECT_WORDS[kind];
  const text = `${word} ${id} ${feminine ? "не найдена" : "не найден"}`;
  return start ? text[0].toUpperCase() + text.slice(1) : text;
}

/** An id the run names but its folder does not hold. */
export function NotFound({ kind, id, start = false, className }: { kind: ObjectKind; id: string; start?: boolean; className?: string }) {
  const { word, feminine } = OBJECT_WORDS[kind];
  const head = start ? word[0].toUpperCase() + word.slice(1) : word;
  return (
    <span data-slot="not-found" className={cn("text-muted-foreground", className)}>
      {head} <span className="font-mono text-xs break-all">{id}</span> {feminine ? "не найдена" : "не найден"}
    </span>
  );
}

/** «не записано» with a neutral dot, and what is missing when it is known: «не записано: в папке нет run.json». */
export function NotRecorded({ cause, className }: { cause?: string; className?: string }) {
  return <StatusDot className={className} state={{ tone: "neutral", label: cause ? `${NOT_RECORDED}: ${cause}` : NOT_RECORDED }} />;
}
