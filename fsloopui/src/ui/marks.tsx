// The change marks of a list (rules/ui → Conventions 9, 12; the design check): the edge mark — a row changed in the
// last minutes, a neutral bar on its leading edge; the target mark — the object a link opened, framed in ink on the
// muted ground, visibly not the edge mark. Neither carries a signal tone, and both are drawn inside the row's box
// (an inset shadow), so marking moves nothing. A linked object the filters hide shows anyway, «вне фильтра».
import { cn } from "@/lib/utils";

export interface MarkState {
  /** Changed in the last minutes. */
  edge?: boolean;
  /** The object a link opened. */
  target?: boolean;
}

export const EDGE_MARK = "shadow-edge";
export const TARGET_MARK = "bg-muted shadow-target";

/** The attributes of a marked row: data hooks for tests and styling, the mark classes. */
export function markProps({ edge = false, target = false }: MarkState, className?: string) {
  return {
    "data-edge": edge ? "" : undefined,
    "data-target": target ? "" : undefined,
    className: cn(target ? TARGET_MARK : edge && EDGE_MARK, className),
  };
}

export const OUT_OF_FILTER = "вне фильтра";

/** «вне фильтра» on a row the active filters hide but a link or a live change keeps in view. */
export function OutOfFilter({ className }: { className?: string }) {
  return (
    <span data-slot="out-of-filter" className={cn("text-xs text-muted-foreground", className)}>
      {OUT_OF_FILTER}
    </span>
  );
}
