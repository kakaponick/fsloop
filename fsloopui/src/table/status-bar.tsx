// The status bar (table #8; ui → Page chrome; the design check): the one bottom strip of every view, with a table or
// without — pagination or a counts strip, then «<shown> из <total noun>», then the selection «Выбрано N <noun>» in a
// place reserved before anything is selected (table #5), then «обновлено <compact past>» with the full Moscow time in
// its title, the age given by the caller's shared clock. It holds no actions but paging. Its height is fixed and
// every number keeps its box, so it never moves what is above it or beside it (rules/ui → Strict 1).
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import type { ReactNode } from "react";
import { ago, count, mskDateTime, num, plural, type Forms } from "../../shared/text.ts";
import { Button } from "@/components/ui/button";
import { Pagination, PaginationContent, PaginationItem } from "@/components/ui/pagination";
import { cn } from "@/lib/utils";
import { CountSelect, Hint, type HeldNoun } from "@/ui";
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

export function Pager({ page, pageCount, onPage, pageSize, onPageSize }: PagerProps) {
  return (
    <div data-slot="pager" className="flex items-center gap-2">
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
  className?: string;
}

export function StatusBar({ pager, counts, shown, total, noun, selected, updatedAt, now, className }: StatusBarProps) {
  const loaded = shown !== undefined && total !== undefined;
  return (
    <div data-slot="status-bar" className={cn("flex h-8 shrink-0 items-center gap-4 overflow-hidden text-xs whitespace-nowrap text-muted-foreground tabular-nums", className)}>
      {loaded && pager && <Pager {...pager} />}
      {loaded && !pager && counts && <div data-slot="counts-strip" className="flex min-w-0 items-center gap-3">{counts}</div>}
      {loaded && <span data-slot="shown">{shownText(shown, total, noun)}</span>}
      {selected && (
        <span data-slot="selected" aria-live="polite" className="text-foreground" style={{ minWidth: selectedWidth(selected.noun) }}>
          {selected.count > 0 ? selectedText(selected.count, selected.noun) : null}
        </span>
      )}
      {updatedAt && now !== undefined && (
        <span data-slot="age" className="ml-auto" title={mskDateTime(updatedAt)}>
          {ageText(updatedAt, now)}
        </span>
      )}
    </div>
  );
}
