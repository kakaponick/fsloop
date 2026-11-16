// The adaptive toolbar's packing (table #14): one line, what does not fit folds into «…». Pure and tested; the
// toolbar measures its own box and its items once and asks this module which items show — never a second path.
//
// - Items fold right to left in markup order: ordinary ones first, sticky ones after them; pinned ones never.
// - A flexible item (the search) counts at its floor; it takes the room left over.
// - The «…» trigger takes room only while something is folded.

export type PackKind = "ordinary" | "sticky" | "pinned";

export interface PackItem {
  id: string;
  /** The item's measured width; a flexible item's floor. */
  width: number;
  kind: PackKind;
}

export interface PackOptions {
  /** The gap between items. */
  gap: number;
  /** The «…» trigger's width. */
  overflow: number;
}

/** The ids that fold, in markup order; the rest show. */
export function pack(items: readonly PackItem[], available: number, { gap, overflow }: PackOptions): string[] {
  const shown = new Set(items.map((i) => i.id));
  const width = () => {
    const visible = items.filter((i) => shown.has(i.id));
    const folded = visible.length < items.length;
    const count = visible.length + (folded ? 1 : 0);
    return visible.reduce((s, i) => s + i.width, 0) + (folded ? overflow : 0) + Math.max(0, count - 1) * gap;
  };
  const order = [...items.filter((i) => i.kind === "ordinary").reverse(), ...items.filter((i) => i.kind === "sticky").reverse()];
  for (const item of order) {
    if (width() <= available) break;
    shown.delete(item.id);
  }
  return items.filter((i) => !shown.has(i.id)).map((i) => i.id);
}
