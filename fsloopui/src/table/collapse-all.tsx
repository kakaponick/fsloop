// «Свернуть все <noun>» (the design check's convention; ui → Blocked action, Widths; rules/ui → Strict 1): one kit part
// for every table whose rows expand, drawn by the table in its toolbar's right cluster — an icon-only 28 px button,
// always in its box. With no row open it cannot run, so it is the blocked action: shown, focusable, inert, its reason
// in its tooltip — never hidden, never moved.
import { ChevronsDownUpIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Hint } from "@/ui";

/** «Свернуть все находки»: the verb and its object, the rows' noun as the table names them (ui → Tooltip). */
export const collapseAllLabel = (what: string): string => `Свернуть все ${what}`;

/** Why it cannot run while no row is open, then what would let it (ux 1). «строк», not the rows' noun: «открыта» is
 * also a finding's state (cold-read; ux 1, one word one concept). */
export const COLLAPSE_BLOCKED = "Нет открытых строк — откройте строку";

export interface CollapseAllProps {
  /** The rows' noun after «все», as the table names them: «находки», «юниты». */
  what: string;
  /** Whether any row is open: the action runs only then. */
  open: boolean;
  onCollapse: () => void;
}

export function CollapseAll({ what, open, onCollapse }: CollapseAllProps) {
  const label = collapseAllLabel(what);
  return (
    <Hint label={open ? label : COLLAPSE_BLOCKED}>
      <Button
        variant="outline"
        size="icon-sm"
        aria-label={label}
        aria-disabled={open ? undefined : "true"}
        data-slot="collapse-all"
        className={cn(!open && "text-muted-foreground opacity-50")}
        onClick={() => open && onCollapse()}
      >
        <ChevronsDownUpIcon />
      </Button>
    </Hint>
  );
}
