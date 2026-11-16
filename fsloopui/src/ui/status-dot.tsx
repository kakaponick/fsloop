// The status dot (ui → Roles: status dot; Status color is a dot): the one way a state shows its colour — a dot in
// the state's tone beside its word in regular text. The tone comes from the shared state map entry the caller
// passes (rules/ui → Conventions 1); no caller names a colour, and a dot never stands without its word.
import type { StateEntry, Tone } from "../../shared/states.ts";
import { cn } from "@/lib/utils";

/** A state as the shared maps give it: an entry with its compact and full words, or a value with a built label. */
export type DotState = Pick<StateEntry, "tone" | "compact" | "full"> | { tone: Tone; label: string };

const TONE: Record<Tone, string> = {
  neutral: "bg-muted-foreground",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-destructive",
};

/** The dot alone, for a part that writes its word beside it (a count, a sentence). */
export function Dot({ tone, className }: { tone: Tone; className?: string }) {
  return <span aria-hidden="true" data-slot="dot" data-tone={tone} className={cn("inline-block size-dot shrink-0 rounded-full", TONE[tone], className)} />;
}

/** The word of a state: the entry's compact or full form, or the value's label. */
export const stateWord = (state: DotState, form: "compact" | "full" = "compact"): string => ("label" in state ? state.label : state[form]);

export interface StatusDotProps {
  state: DotState;
  /** «compact» in a cell or a card, «full» in an object page's fact (rules/ui → Conventions 1). */
  form?: "compact" | "full";
  /** What follows the state: «state · age · cause», the cause last so truncation cuts only it. */
  detail?: string | readonly (string | null | undefined)[];
  /** One line, truncated at the end (a cell); otherwise the words wrap. */
  truncate?: boolean;
  className?: string;
}

export function StatusDot({ state, form = "compact", detail, truncate = false, className }: StatusDotProps) {
  const rest = (Array.isArray(detail) ? detail : [detail]).filter((part): part is string => Boolean(part));
  const text = [stateWord(state, form), ...rest].join(" · ");
  return (
    <span data-slot="status-dot" data-tone={state.tone} title={truncate ? text : undefined} className={cn("inline-flex max-w-full min-w-0 items-baseline gap-1.5", className)}>
      <Dot tone={state.tone} className="self-center" />
      <span className={cn(truncate && "truncate")}>{text}</span>
    </span>
  );
}
