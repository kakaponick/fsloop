// A count (rules/ui → Conventions 7, Copy 3): the number first, its noun agreed by the shared plural function. It
// links to the list it counts only above 0 and only when that list, filtered, shows the same number; otherwise it
// is plain text. A zero is a muted «0» beside a neutral dot — no link, no tone, never an empty state.
import type { MouseEvent } from "react";
import type { Tone } from "../../shared/states.ts";
import { count as countText, num, type Forms } from "../../shared/text.ts";
import { cn } from "@/lib/utils";
import { Dot } from "./status-dot.tsx";

export interface CountLinkProps {
  count: number;
  /** The noun the number counts: «3 находки». Without it the number stands alone (a tab, a cell under a header). */
  noun?: Forms;
  /** The tone of the state counted («2 critical»): a dot before the number; a zero takes a neutral dot. */
  tone?: Tone;
  /** What a word after the number names, when not the noun: «critical». */
  suffix?: string;
  /** The list's address. */
  href?: string;
  /** Opens the list (the app's `openFindings`); the link's default navigation is replaced. */
  onOpen?: () => void;
  /** False when the target list would not show the same number: the count stays plain. */
  linkable?: boolean;
  className?: string;
}

export function CountLink({ count, noun, tone, suffix, href, onOpen, linkable = true, className }: CountLinkProps) {
  const words = [noun ? countText(count, noun) : num(count), suffix].filter(Boolean).join(" ");
  const zero = count === 0;
  const dot = tone ? <Dot tone={zero ? "neutral" : tone} /> : null;
  const wrap = cn("inline-flex items-center gap-1.5 tabular-nums", zero && "text-muted-foreground", className);
  if (zero || !linkable || (!href && !onOpen))
    return (
      <span data-slot="count" className={wrap}>
        {dot}
        {words}
      </span>
    );
  const click = (event: MouseEvent<HTMLAnchorElement>) => {
    if (!onOpen || event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
    event.preventDefault();
    onOpen();
  };
  return (
    <a data-slot="count-link" href={href ?? "#"} onClick={click} className={cn(wrap, "underline decoration-foreground/30 underline-offset-2 hover:decoration-foreground")}>
      {dot}
      {words}
    </a>
  );
}
