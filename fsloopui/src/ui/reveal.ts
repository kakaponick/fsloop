// The reveal of an object a list holds (the design check: an object's address is a query key — the view scrolls to it,
// marks it and moves focus to it; rules/ui → Strict 1): «Журнал» and «Соглашения» bring the entry or the convention
// an address names to the top of the list's own scroller, and nothing above that scroller moves — never
// `scrollIntoView`, which scrolls every scrolling ancestor up to the page's body and takes the toolbar out of view.
// An address the user set by clicking the object itself (its number) leaves it where it stands: a click never
// pushes what was clicked.
import { useCallback, useLayoutEffect, useRef } from "react";

/** The room left above a revealed object at its scroller's top, so its target mark shows whole: 8 px. */
export const REVEAL_GAP = 8;

/** A list's scroller. `relative` makes it the containing block of everything in it: an absolutely placed part deep
 * in the list — a screen reader's «нет значения» under «—» — is clipped and scrolled with the list, and never hangs
 * below the view, where it would give the page's body an overflow to scroll (f22: the journal's 48 px). */
export const SCROLLER = "relative min-h-0 overflow-y-auto [scrollbar-gutter:stable]";

export interface RevealOptions {
  /** The room kept between `el` and the scroller's edge: 8 px, more under a sticky strip (a report's 40 px tabs). */
  gap?: number;
  /** Scroll only when `el` is out of the scroller's view, by as little as brings it in (the report rail's open item). */
  nearest?: boolean;
  /** Focus `el` after the scroll, with no scroll of its own; off where focus stays with the user (the outline). */
  focus?: boolean;
}

/** Scrolls `scroller` — and only it — so `el` stands `gap` under its top (or, `nearest`, just inside its view), then
 * focuses `el` with no scroll of its own. */
export function revealIn(scroller: HTMLElement, el: HTMLElement, { gap = REVEAL_GAP, nearest = false, focus = true }: RevealOptions = {}): void {
  const box = scroller.getBoundingClientRect();
  const r = el.getBoundingClientRect();
  if (nearest && r.bottom > box.bottom && r.top >= box.top) scroller.scrollTop += r.bottom - box.bottom + gap;
  else if (!nearest || r.top < box.top) scroller.scrollTop = Math.max(0, r.top - box.top + scroller.scrollTop - gap);
  if (focus) el.focus({ preventScroll: true });
}

/** The reveal of the object an address names (`target`), once per address: `scroller` goes on the list's scroller,
 * `find` picks the object in it. `reveal(id)` brings an object back (a rail link to the entry already open); `hold(id)`
 * marks the next address as the user's own click on that object, which the reveal leaves in place. A list whose
 * scroller holds a sticky heading passes `gap` — the heading's height + `REVEAL_GAP` — so the object stands under it
 * (the design check of pass 3: a sticky heading in a scroller, and a reveal into it). */
export function useReveal(target: string | null, find: (scroller: HTMLElement, id: string) => HTMLElement | null, { gap }: Pick<RevealOptions, "gap"> = {}) {
  const scroller = useRef<HTMLDivElement>(null);
  const held = useRef<string | null>(null);
  // stable, so a memoised row may take them
  const reveal = useCallback(
    (id: string) => {
      const box = scroller.current;
      const el = box ? find(box, id) : null;
      if (box && el) revealIn(box, el, { gap });
    },
    [find, gap],
  );
  const hold = useCallback((id: string) => {
    held.current = id;
  }, []);
  useLayoutEffect(() => {
    // taken and cleared on every new address: a hold on the object that already was the address left the URL as it
    // was, so it never ran this effect, and must not skip that object's next address
    const own = held.current === target;
    held.current = null;
    if (!target || own) return;
    reveal(target);
    // the address alone decides: a `find` the caller rebuilds is the same lookup
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);
  return { scroller, reveal, hold };
}
