// An open detail's lists under a live run (rules/ui → Strict 1, Live data 2–3): a list keeps the lines it opened
// with, in their order, each updating its values in place; a line a live change brings waits — counted for the
// section's held-order strip — until the user places it with a click. A line the run no longer lists keeps its place
// with what it read when it was placed, so nothing under it moves. The next open starts from the run as it is.
import { useState } from "react";

export interface Held<T> {
  /** The lines shown: the held ones, in their order. */
  shown: T[];
  /** The lines that arrived since and wait. */
  fresh: number;
  /** Places the waiting lines: the list becomes the run's own, in its order. */
  apply: () => void;
}

/** The held lines over the current ones: each held key reads its current line, else the one it was placed with. */
export function heldLines<T>(held: ReadonlyMap<string, T>, items: readonly T[], key: (item: T) => string): { shown: T[]; fresh: number } {
  const now = new Map(items.map((i) => [key(i), i]));
  return { shown: [...held].map(([k, placed]) => now.get(k) ?? placed), fresh: items.filter((i) => !held.has(key(i))).length };
}

const placed = <T>(items: readonly T[], key: (item: T) => string): ReadonlyMap<string, T> => new Map(items.map((i) => [key(i), i]));

export function useHeld<T>(items: readonly T[], key: (item: T) => string): Held<T> {
  const [held, setHeld] = useState(() => placed(items, key));
  return { ...heldLines(held, items, key), apply: () => setHeld(placed(items, key)) };
}
