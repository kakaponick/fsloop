// The cue of content past a box (the design check of pass 3; j68): a hairline of muted ink at the edge the content runs
// past — the theme's `shadow-overflow` at a box's bottom, `shadow-overflow-end` at its right — drawn as an inset shadow
// over the box, never a border or padding, so it takes no room (rules/ui → Strict 1). It shows while the content runs
// past that edge (`scrollHeight > clientHeight`, `scrollWidth > clientWidth`) and hides once the box is scrolled to its
// end, where nothing runs past any more. The data table's box and a wide table in running text take it.
import { useEffect, useLayoutEffect, useState, type RefObject } from "react";
import { cn } from "@/lib/utils";

/** The edge a box's content runs past: its bottom (a list that scrolls down), its end (a table that scrolls sideways). */
export type CueEdge = "bottom" | "end";

/** Whether `el`'s content runs past its `edge`: it scrolls that way and is not at its end. */
export function pastEdge(el: HTMLElement | null, edge: CueEdge): boolean {
  if (!el) return false;
  return edge === "bottom" ? el.scrollHeight - el.scrollTop - el.clientHeight > 1 : el.scrollWidth - el.scrollLeft - el.clientWidth > 1;
}

/** Whether the box `ref` holds runs past its `edge`, measured after every commit — a page, an opened detail, a live row
 * change what the box holds — and on a resize; `measure` goes on the box's `onScroll`. `watch` re-attaches the resize
 * watch when the box itself is replaced. */
export function useOverflowCue(ref: RefObject<HTMLElement | null>, edge: CueEdge, watch?: unknown): { past: boolean; measure: () => void } {
  const [past, setPast] = useState(false);
  const measure = () => setPast(pastEdge(ref.current, edge));
  useLayoutEffect(measure);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(() => setPast(pastEdge(ref.current, edge)));
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref, edge, watch]);
  return { past, measure };
}

/** The cue itself, over its box: its parent is the box's `relative` frame, the scroller inside it. Unread, inert. */
export function OverflowCue({ edge, shown, className }: { edge: CueEdge; shown: boolean; className?: string }) {
  return <span aria-hidden="true" data-slot="overflow-cue" data-cue-edge={edge} className={cn("pointer-events-none absolute inset-0", edge === "bottom" ? "shadow-overflow" : "shadow-overflow-end", !shown && "invisible", className)} />;
}
