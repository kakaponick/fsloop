// The change marks of a list (rules/ui → Conventions 9, 12; the design check): the edge mark — a row changed in the
// last minutes, a neutral bar on its leading edge; the target mark — the object a link opened, framed in ink on the
// muted ground, visibly not the edge mark. Neither carries a signal tone, and both are drawn inside the row's box
// (an inset shadow), so marking moves nothing. A linked object the filters hide shows anyway, «вне фильтра».
//
// Which rows carry the edge mark is one hook for every live list: a view passes its rows, their id and its own sign —
// what a change of the run moves on a row (never the user's own verdict); the first read marks nothing, and a mark
// ages out on the shared clock after the same «last minutes» as a fresh write.
import { useState } from "react";
import { THRESHOLDS } from "../../shared/liveness.ts";
import { cn } from "@/lib/utils";

/** How long a change stays marked: the same «last minutes» as a fresh write (shared/liveness.ts). */
export const EDGE_MS = THRESHOLDS.quiet;

interface Seen {
  version: number;
  signs: ReadonlyMap<string, string>;
  changed: Readonly<Record<string, number>>;
}

/** Whether a row carries the edge mark now; recomputed when the run's version moves. `id` and `sign` are read only
 * then, so a view may pass them inline. */
export function useEdgeMarks<R>(version: number, rows: readonly R[], id: (row: R) => string, sign: (row: R) => string, now: number): (rowId: string) => boolean {
  const signsOf = () => new Map(rows.map((r) => [id(r), sign(r)]));
  const [seen, setSeen] = useState<Seen>(() => ({ version, signs: signsOf(), changed: {} }));
  let current = seen;
  if (seen.version !== version) {
    const signs = signsOf();
    const changed: Record<string, number> = { ...seen.changed };
    for (const [key, s] of signs) {
      const before = seen.signs.get(key);
      if (before !== undefined && before !== s) changed[key] = now;
    }
    current = { version, signs, changed };
    setSeen(current);
  }
  return (rowId) => {
    const at = current.changed[rowId];
    return at !== undefined && now - at < EDGE_MS;
  };
}

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

/** The open row's frame (DESIGN.md → Data Table; the design check's one export for the table and ExpandingFindings):
 * an open row and its detail read as one block — the muted ground alone is about 1.1:1 on the dark paper, so a 1 px
 * inset frame runs round them, in muted ink (over 3:1 on both themes), ink on a link's target. The row draws its top
 * and sides, the detail its sides and bottom; inset, so opening moves nothing. A host sets the ink (`muted` or
 * `target`) on both parts. */
export const OPEN_FRAME = {
  muted: "[--frame:var(--muted-foreground)]",
  target: "[--frame:var(--foreground)]",
  /** The theme's `--shadow-open-row` and `--shadow-open-detail` (src/styles/index.css), beside the other two marks. */
  row: "shadow-open-row",
  detail: "shadow-open-detail",
} as const;

export const OUT_OF_FILTER = "вне фильтра";

/** «вне фильтра» on a row the active filters hide but a link or a live change keeps in view. */
export function OutOfFilter({ className }: { className?: string }) {
  return (
    <span data-slot="out-of-filter" className={cn("text-xs text-muted-foreground", className)}>
      {OUT_OF_FILTER}
    </span>
  );
}
