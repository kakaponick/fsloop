// The status bar (table #8; ui → Page chrome; the design check): the one bottom strip of every view, with a table or
// without — pagination or a counts strip, then «<shown> из <total noun>», then the selection «Выбрано N <noun>» in a
// place reserved before anything is selected (table #5), then «обновлено <compact past>» with the full Moscow time in
// its title, the age given by the caller's shared clock. It holds no actions but paging. Its height is fixed and
// every number keeps its box, so it never moves what is above it or beside it (rules/ui → Strict 1). The order of
// its slots is the caller's prop (`order`); the slots it packs at the right end never move with the strip's width,
// the age never shrinks, and the counts strip clips in its own box, its entries compact in a narrow bar.
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import type { ReactNode } from "react";
import { ago, count, mskDateTime, num, plural, type Forms } from "../../shared/text.ts";
import { Button } from "@/components/ui/button";
import { Pagination, PaginationContent, PaginationItem } from "@/components/ui/pagination";
import { cn } from "@/lib/utils";
import { CountSelect, Dot, Hint, type HeldNoun } from "@/ui";
import type { Tone } from "../../shared/states.ts";
import { ALL_ROWS, FILL_ROWS, type PageSize } from "./query.ts";

export const PREV_PAGE = "Предыдущая страница";
export const NEXT_PAGE = "Следующая страница";
export const PAGE_SIZE_LABEL = "Строк";
/** Rows per page (table #1): as many as the table's box shows, 50, 100, every row. */
export const PAGE_SIZES: readonly PageSize[] = [FILL_ROWS, 50, 100, ALL_ROWS];
const PAGE_SIZE_WORDS: Record<string, string> = { [FILL_ROWS]: "по экрану", [ALL_ROWS]: "все" };

const SELECTED_ONE = { m: "Выбран", f: "Выбрана", n: "Выбрано" } as const;

/** «Выбрано 3 находки», «Выбрана 21 находка», «Выбран 1 юнит»: the verb agrees with the number and the noun. */
export const selectedText = (n: number, noun: HeldNoun): string => `${n % 10 === 1 && n % 100 !== 11 ? SELECTED_ONE[noun.gender] : "Выбрано"} ${count(n, noun.forms)}`;

/** The selection's reserved width: its widest three-digit form at a Cyrillic letter's width (toolbar.tsx). */
const selectedWidth = (noun: HeldNoun): string => `${(Math.max(...[111, 222, 555].map((n) => selectedText(n, noun).length)) * 1.1).toFixed(1)}ch`;

/** «из 723 находок», «из 61 находки»: after «из» the noun is genitive — the singular after a number ending in 1
 * (not 11), the plural otherwise; a noun's 2–4 form is its genitive singular, so the shared plural picks it. */
export const ofTotal = (total: number, noun: Forms): string => `из ${num(total)} ${plural(total, [noun[1], noun[2], noun[2]])}`;

/** «128 из 723 находок»: the rows the filters keep of all the rows; «723 находки» when they are all. */
export const shownText = (shown: number, total: number, noun: Forms): string => (shown === total ? count(total, noun) : `${num(shown)} ${ofTotal(total, noun)}`);

/** «обновлено 5 мин назад». */
export const ageText = (at: string, now: string | number): string => `обновлено ${ago(at, now)}`;

export interface PagerProps {
  page: number;
  pageCount: number;
  onPage: (page: number) => void;
  pageSize: PageSize;
  onPageSize: (size: PageSize) => void;
}

export function Pager({ page, pageCount, onPage, pageSize, onPageSize, className }: PagerProps & { className?: string }) {
  return (
    <div data-slot="pager" className={cn("flex items-center gap-2", className)}>
      <Pagination aria-label="Страницы" className="mx-0 w-auto">
        <PaginationContent>
          <PaginationItem>
            <Hint label={PREV_PAGE} keys={["ArrowLeft"]}>
              <Button variant="ghost" size="icon-xs" aria-label={PREV_PAGE} aria-disabled={page <= 1 || undefined} className={cn(page <= 1 && "text-muted-foreground")} onClick={() => page > 1 && onPage(page - 1)}>
                <ChevronLeftIcon />
              </Button>
            </Hint>
          </PaginationItem>
          <PaginationItem className="px-1 tabular-nums">
            стр. <span className="inline-block min-w-count text-right">{page}</span> из <span className="inline-block min-w-count">{pageCount}</span>
          </PaginationItem>
          <PaginationItem>
            <Hint label={NEXT_PAGE} keys={["ArrowRight"]}>
              <Button variant="ghost" size="icon-xs" aria-label={NEXT_PAGE} aria-disabled={page >= pageCount || undefined} className={cn(page >= pageCount && "text-muted-foreground")} onClick={() => page < pageCount && onPage(page + 1)}>
                <ChevronRightIcon />
              </Button>
            </Hint>
          </PaginationItem>
        </PaginationContent>
      </Pagination>
      <CountSelect
        label={PAGE_SIZE_LABEL}
        value={String(pageSize)}
        onValueChange={(v) => onPageSize(v === ALL_ROWS || v === FILL_ROWS ? v : Number(v))}
        options={PAGE_SIZES.map((s) => ({ value: String(s), label: PAGE_SIZE_WORDS[s] ?? String(s) }))}
      />
    </div>
  );
}

/** A slot of the bar: «paging» — the pager, or the counts strip in its place; «shown» — «<shown> из <total noun>»;
 * «selected» — the selection; «age» — «обновлено …». */
export type BarSlot = "paging" | "shown" | "selected" | "age";

/** The bar's order: the slots from its start, then the slots packed at its right end. */
export interface BarOrder {
  start: readonly BarSlot[];
  end: readonly BarSlot[];
}

/** Paging first, then the total and the selection; the age alone at the right end. */
export const DEFAULT_BAR_ORDER: BarOrder = { start: ["paging", "shown", "selected"], end: ["age"] };

/** One entry of the counts strip: a dot in the state's tone, the state's word, its count in a three-digit box. In a
 * narrow bar the word goes to the title and the screen reader, the dot and the count stay; a state the filters or a
 * live change empty keeps its slot — a neutral dot and a muted 0 (Strict 1). */
export function StripCount({ tone, label, count: n }: { tone: Tone; label: string; count: number }) {
  return (
    <span data-slot="state-count" title={`${label} ${num(n)}`} className="inline-flex shrink-0 items-center gap-1.5">
      <Dot tone={n ? tone : "neutral"} />
      <span data-slot="strip-label" className="@max-5xl/bar:sr-only">
        {label}
      </span>
      <span data-slot="strip-count" className={cn("inline-block min-w-count tabular-nums", n > 0 && "text-foreground")}>
        {num(n)}
      </span>
    </span>
  );
}

export interface StatusBarProps {
  /** Paging, when the list is split; otherwise the counts strip takes the slot. */
  pager?: PagerProps | null;
  /** The counts strip: status dots with their counts and labels. */
  counts?: ReactNode;
  /** «<shown> из <total noun>»; absent while the data loads. */
  shown?: number;
  total?: number;
  noun: Forms;
  /** The rows selected, for a list that selects: its place is reserved from the first paint, empty at 0. */
  selected?: { count: number; noun: HeldNoun };
  /** The data's last update and the shared clock; absent — no age is shown. */
  updatedAt?: string | null;
  now?: string | number;
  /** The slots' order, the caller's: a view never reaches into the bar's slots. */
  order?: BarOrder;
  className?: string;
}

export function StatusBar({ pager, counts, shown, total, noun, selected, updatedAt, now, order = DEFAULT_BAR_ORDER, className }: StatusBarProps) {
  const loaded = shown !== undefined && total !== undefined;
  // each slot's node, or null when it has nothing to hold; `end` — the first slot packed at the right end
  const slot = (name: BarSlot, end: boolean): ReactNode => {
    const at = end && "ml-auto";
    switch (name) {
      case "paging":
        if (!loaded) return null;
        if (pager) return <Pager key={name} {...pager} className={cn("shrink-0", at)} />;
        // the strip clips in its own box and never paints over a neighbour; its entries go compact in a narrow bar
        return counts ? (
          <div key={name} data-slot="counts-strip" className={cn("flex min-w-0 items-center gap-3 overflow-hidden", at)}>
            {counts}
          </div>
        ) : null;
      case "shown":
        return loaded ? (
          <span key={name} data-slot="shown" className={cn("shrink-0", at)}>
            {shownText(shown, total, noun)}
          </span>
        ) : null;
      case "selected":
        return selected ? (
          <span key={name} data-slot="selected" aria-live="polite" className={cn("shrink-0 text-foreground", at)} style={{ minWidth: selectedWidth(selected.noun) }}>
            {selected.count > 0 ? selectedText(selected.count, selected.noun) : null}
          </span>
        ) : null;
      case "age":
        return updatedAt && now !== undefined ? (
          <span key={name} data-slot="age" className={cn("shrink-0", at)} title={mskDateTime(updatedAt)}>
            {ageText(updatedAt, now)}
          </span>
        ) : null;
    }
  };
  const start = order.start.map((name) => slot(name, false));
  // the end group opens at the bar's right end: its first slot that holds something takes the slack
  const end: ReactNode[] = [];
  for (const name of order.end) end.push(slot(name, !end.some(Boolean)));
  return (
    <div data-slot="status-bar" className={cn("@container/bar flex h-8 shrink-0 items-center gap-4 overflow-hidden text-xs whitespace-nowrap text-muted-foreground tabular-nums", className)}>
      {start}
      {end}
    </div>
  );
}
