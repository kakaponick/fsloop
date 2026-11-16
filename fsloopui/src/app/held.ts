// The sidebar's held order (rules/ui → Live data 1; ui → Live data): the cards keep the places they were given; a
// card's state updates in place, while a new run, a card whose group or rank changed and a card whose folder is
// gone wait in the strip and are placed on its click. Groups and ranks come from the card's own facts and the
// shared clock: running by start, newest first; long-silent by last write; closed by last update; then the
// folders without run.json.
import { livenessOf } from "../../shared/liveness.ts";
import type { RunCard } from "../../shared/model.ts";
import type { HeldCounts } from "../ui/index.ts";

export type Group = "running" | "silent" | "closed" | "unrecorded";
export const GROUPS: readonly Group[] = ["running", "silent", "closed", "unrecorded"];

export function groupOf(card: RunCard, now: number): Group {
  if (!card.recorded) return "unrecorded";
  if (card.closed) return "closed";
  return livenessOf(card.lastWriteAt, now).longSilent ? "silent" : "running";
}

const time = (iso: string | null) => (iso ? Date.parse(iso) || 0 : 0);
const RANK: Record<Group, (c: RunCard) => number> = {
  running: (c) => time(c.startedAt),
  silent: (c) => time(c.lastWriteAt),
  closed: (c) => time(c.updatedAt ?? c.lastWriteAt),
  unrecorded: (c) => time(c.lastWriteAt),
};

const byRank = (group: Group) => (a: RunCard, b: RunCard) => RANK[group](b) - RANK[group](a) || a.key.localeCompare(b.key);

/** Where each card belongs now: the keys of each group in order. */
export function arrange(cards: readonly RunCard[], now: number): Record<Group, string[]> {
  const out: Record<Group, RunCard[]> = { running: [], silent: [], closed: [], unrecorded: [] };
  for (const c of cards) out[groupOf(c, now)].push(c);
  return Object.fromEntries(GROUPS.map((g) => [g, out[g].sort(byRank(g)).map((c) => c.key)])) as Record<Group, string[]>;
}

/** The order the operator sees, and the cards it was taken from (a vanished card is drawn from here). */
export interface Placement {
  order: Record<Group, string[]>;
  cards: Record<string, RunCard>;
  /** Keys placed by a click on the strip that were new runs: they read «новое». */
  arrived: string[];
}

export function place(cards: readonly RunCard[], now: number, previous?: Placement): Placement {
  const before = previous ? new Set(Object.values(previous.order).flat()) : null;
  const keys = new Set(cards.map((c) => c.key));
  const arrived = [...(previous?.arrived.filter((k) => keys.has(k)) ?? []), ...(before ? cards.filter((c) => !before.has(c.key)).map((c) => c.key) : [])];
  return { order: arrange(cards, now), cards: Object.fromEntries(cards.map((c) => [c.key, c])), arrived };
}

export interface PlacedCard {
  key: string;
  card: RunCard;
  /** Its folder is gone; it stays marked until the strip is clicked. */
  gone: boolean;
}

/** The length of the longest increasing run of `xs`: the cards that kept their relative order. */
function keptInOrder(xs: number[]): number {
  const tails: number[] = [];
  for (const x of xs) {
    let lo = 0;
    let hi = tails.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (tails[mid] < x) lo = mid + 1;
      else hi = mid;
    }
    tails[lo] = x;
  }
  return tails.length;
}

/** The held view: each group as placed, with today's cards; and what waits in the strip. */
export function heldView(placement: Placement, cards: readonly RunCard[], now: number): { groups: Record<Group, PlacedCard[]>; counts: HeldCounts } {
  const current = new Map(cards.map((c) => [c.key, c]));
  const ideal = arrange(cards, now);
  const idealGroup = new Map<string, Group>();
  for (const g of GROUPS) for (const k of ideal[g]) idealGroup.set(k, g);
  const placed = new Set(Object.values(placement.order).flat());
  let moved = 0;
  const groups = {} as Record<Group, PlacedCard[]>;
  for (const g of GROUPS) {
    const keys = placement.order[g];
    groups[g] = keys.map((key) => ({ key, card: current.get(key) ?? placement.cards[key], gone: !current.has(key) }));
    moved += keys.filter((k) => !current.has(k) || idealGroup.get(k) !== g).length;
    // Within the group, a card out of the order it should keep with its neighbours has moved.
    const stay = keys.filter((k) => idealGroup.get(k) === g);
    const at = new Map(ideal[g].map((k, i) => [k, i]));
    moved += stay.length - keptInOrder(stay.map((k) => at.get(k) ?? 0));
  }
  const fresh = cards.filter((c) => !placed.has(c.key)).length;
  return { groups, counts: { fresh, moved, left: 0 } };
}
