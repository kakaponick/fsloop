// The in-view strip (the design check of pass 3: «на экране <range>» through one shared part; table #8): which items of
// a numbered list its own scroller shows, in the status bar's counts slot — «на экране #40–#42» in «Журнал»,
// «на экране 12–17» in «Соглашения», each in its list's number form (`numberRange`). The items are the elements that
// carry `data-<kind>` with their number; they are measured before paint and on every scroll and resize. The strip's
// box is reserved at the widest form its list can take, so nothing beside it moves when the range is known or changes
// (Strict 1).
import { useLayoutEffect, useState, type RefObject } from "react";
import { numberRange, numberText, type NumberedKind } from "./absent.tsx";

const PREFIX = "на экране ";

/** An item counts as in view when a line of it shows: 20 px, or the whole of a shorter box. */
const IN_VIEW_MIN = 20;

/** The room the strip keeps past its widest form: a Cyrillic letter is wider than the digit a `ch` measures. */
const SPARE_CH = 2;

export type InViewRange = readonly [string, string];

/** The first and the last item whose box shows in the visible band; null — none does. */
export function itemsInView(view: { top: number; bottom: number }, boxes: readonly { n: string; top: number; bottom: number }[]): [string, string] | null {
  const seen = boxes.filter((b) => {
    const shown = Math.min(b.bottom, view.bottom) - Math.max(b.top, view.top);
    return shown > 0 && shown >= Math.min(IN_VIEW_MIN, b.bottom - b.top);
  });
  return seen.length ? [seen[0].n, seen[seen.length - 1].n] : null;
}

/** «на экране #40–#42», «на экране 12–17», «на экране #7»; nothing in view — empty, its box kept. */
export const inViewText = (kind: NumberedKind, range: InViewRange | null): string => (range ? `${PREFIX}${numberRange(kind, range[0], range[1])}` : "");

export interface InViewOptions {
  /** The scroller's top the list's sticky heading covers, in px: an item under it is not in view. */
  top?: number;
}

/** The items `data-<kind>` marks in `scroller` that show, re-measured when `version` (the rows the list draws)
 * changes, on every scroll and on a resize. */
export function useInView(scroller: RefObject<HTMLElement | null>, kind: NumberedKind, version: string, { top = 0 }: InViewOptions = {}): [string, string] | null {
  const [range, setRange] = useState<[string, string] | null>(null);
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    let frame = 0;
    const measure = () => {
      frame = 0;
      const box = el.getBoundingClientRect();
      const boxes = [...el.querySelectorAll<HTMLElement>(`[data-${kind}]`)].map((item) => {
        const r = item.getBoundingClientRect();
        return { n: item.getAttribute(`data-${kind}`) ?? "", top: r.top, bottom: r.bottom };
      });
      const next = itemsInView({ top: box.top + top, bottom: box.bottom }, boxes);
      setRange((prev) => (prev?.[0] === next?.[0] && prev?.[1] === next?.[1] ? prev : next));
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    measure();
    el.addEventListener("scroll", schedule, { passive: true });
    const resize = typeof ResizeObserver !== "undefined" ? new ResizeObserver(schedule) : null;
    resize?.observe(el);
    return () => {
      el.removeEventListener("scroll", schedule);
      resize?.disconnect();
      if (frame) cancelAnimationFrame(frame);
    };
  }, [scroller, kind, version, top]);
  return range;
}

export interface InViewProps {
  kind: NumberedKind;
  /** What `useInView` measured; null — nothing yet, or nothing in view. */
  range: InViewRange | null;
  /** The list's highest number: its form at both ends is the widest the strip can read: «на экране 26–26» of 26 conventions. */
  last: string | null;
}

/** «на экране …» for the status bar's `counts` slot, in a box as wide as the widest form from the first paint. */
export function InView({ kind, range, last }: InViewProps) {
  // two ends as wide as the highest number, the decisions' «#» included
  const widest = last ? `${PREFIX}${numberText(kind, last)}–${numberText(kind, last)}`.length + SPARE_CH : 0;
  return (
    <span data-slot="in-view" className="inline-block" style={{ minWidth: `${widest}ch` }}>
      {inViewText(kind, range)}
    </span>
  );
}
