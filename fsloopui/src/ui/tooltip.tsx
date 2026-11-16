// Tooltips (ui → Tooltip, Glossary): a tooltip holds plain text only, one of three — an icon-only control's name
// (at most three words, its shortcut as `Kbd`), a blocked action's reason, or a glossary on a term's dotted label.
// A glossary is bounded: at most 8 entries, each «value — meaning» at most 80 characters.
import type { ReactNode } from "react";
import type { StateEntry } from "../../shared/states.ts";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { Keys } from "./kbd.tsx";

export interface HintProps {
  /** The control's name: a verb and its object, or the noun of what it opens. */
  label: string;
  /** Its shortcut, as physical key codes. */
  keys?: readonly string[];
  children: ReactNode;
}

/** The name of an icon-only control, or a blocked action's reason. */
export function Hint({ label, keys, children }: HintProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent>
        {label}
        {keys && keys.length > 0 && <Keys codes={keys} />}
      </TooltipContent>
    </Tooltip>
  );
}

export const GLOSSARY_MAX_ENTRIES = 8;
export const GLOSSARY_MAX_LINE = 80;

export interface GlossaryEntry {
  value: string;
  meaning: string;
}

/** The glossary's lines, «value — meaning»; throws when a bound is broken, so a test over a glossary pins both. */
export function glossaryLines(entries: readonly GlossaryEntry[]): string[] {
  if (entries.length > GLOSSARY_MAX_ENTRIES) throw new Error(`glossary: ${entries.length} entries, at most ${GLOSSARY_MAX_ENTRIES}`);
  return entries.map(({ value, meaning }) => {
    const line = `${value} — ${meaning}`;
    if (line.length > GLOSSARY_MAX_LINE) throw new Error(`glossary: «${line}» is ${line.length} characters, at most ${GLOSSARY_MAX_LINE}`);
    return line;
  });
}

/** A glossary from a shared state map: the listed values, in the given order, with the map's words and meanings. */
export function glossaryFrom<K extends string>(map: Record<K, Pick<StateEntry, "compact" | "meaning">>, keys: readonly K[]): GlossaryEntry[] {
  return keys.map((key) => ({ value: map[key].compact, meaning: map[key].meaning }));
}

export interface GlossaryTooltipProps {
  /** The term as the header shows it, with a dotted underline. */
  term: string;
  entries: readonly GlossaryEntry[];
  className?: string;
}

export function GlossaryTooltip({ term, entries, className }: GlossaryTooltipProps) {
  const lines = glossaryLines(entries);
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" data-slot="glossary-term" className={cn("cursor-help rounded-sm underline decoration-muted-foreground decoration-dotted underline-offset-4 outline-none focus-visible:ring-3 focus-visible:ring-ring/50", className)}>
          {term}
        </button>
      </TooltipTrigger>
      <TooltipContent className="flex-col items-start gap-1">
        {lines.map((line) => (
          <span key={line} className="block">
            {line}
          </span>
        ))}
      </TooltipContent>
    </Tooltip>
  );
}
