// The held-order strip (ui → Live data; rules/ui → Live data 1–2): a live list never moves under the reader. New
// rows, rows whose place changed and rows that left the filter wait here, one line at the list's end — «2 новых
// прогона · 1 прогон сместился · показать» — and are placed on click. The verb names what the click does:
// «показать» (new or moved only), «убрать» (left the filter only), «обновить список» (both). The line is always
// reserved, so the strip's arrival moves nothing (Strict 1). A narrow host (the sidebar) reads the compact form.
import { count, num, plural, type Forms } from "../../shared/text.ts";
import { cn } from "@/lib/utils";

export type NounGender = "m" | "f" | "n";

export interface HeldCounts {
  /** Rows that arrived. */
  fresh: number;
  /** Rows whose sort place changed. */
  moved: number;
  /** Rows a change took out of the active filter or search, still shown «вне фильтра». */
  left: number;
}

export interface HeldNoun {
  forms: Forms;
  gender: NounGender;
}

const NEW_ONE: Record<NounGender, string> = { m: "новый", f: "новая", n: "новое" };
const MOVED_ONE: Record<NounGender, string> = { m: "сместился", f: "сместилась", n: "сместилось" };

export type HeldVerb = "показать" | "убрать" | "обновить список";

export function heldVerb({ fresh, moved, left }: HeldCounts): HeldVerb | null {
  const arrived = fresh + moved > 0;
  if (arrived && left > 0) return "обновить список";
  if (left > 0) return "убрать";
  if (arrived) return "показать";
  return null;
}

/** The strip's words, full or compact (the noun dropped); null when nothing waits. */
export function heldStripText(counts: HeldCounts, noun: HeldNoun, { compact = false } = {}): string | null {
  const verb = heldVerb(counts);
  if (!verb) return null;
  const one = (n: number) => plural(n, noun.forms) === noun.forms[0];
  const parts: string[] = [];
  if (counts.fresh > 0) {
    const adjective = one(counts.fresh) ? NEW_ONE[noun.gender] : "новых";
    parts.push(compact ? `${num(counts.fresh)} ${adjective}` : `${num(counts.fresh)} ${adjective} ${plural(counts.fresh, noun.forms)}`);
  }
  if (counts.moved > 0) {
    const verbForm = one(counts.moved) ? MOVED_ONE[noun.gender] : "сместились";
    parts.push(compact ? `${num(counts.moved)} ${verbForm}` : `${count(counts.moved, noun.forms)} ${verbForm}`);
  }
  if (counts.left > 0) parts.push(compact ? `${num(counts.left)} вне фильтра` : `${count(counts.left, noun.forms)} вне фильтра`);
  parts.push(verb);
  return parts.join(" · ");
}

export interface HeldStripProps {
  counts: HeldCounts;
  noun: HeldNoun;
  /** Places the held rows: new and moved ones in their places, rows that left the filter gone. */
  onApply: () => void;
  className?: string;
}

export function HeldStrip({ counts, noun, onApply, className }: HeldStripProps) {
  const full = heldStripText(counts, noun);
  const compact = heldStripText(counts, noun, { compact: true });
  return (
    <div data-slot="held-strip" aria-live="polite" className={cn("@container flex h-strip shrink-0 items-center border-t text-xs", className)}>
      {full && (
        <button
          type="button"
          title={full}
          aria-label={full}
          onClick={onApply}
          className="flex h-full w-full min-w-0 items-center px-2 text-left text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset"
        >
          <span className="hidden truncate @md:inline">{full}</span>
          <span className="truncate @md:hidden">{compact}</span>
        </button>
      )}
    </div>
  );
}
