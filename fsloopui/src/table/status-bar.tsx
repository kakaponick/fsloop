// The status bar (table #8; ui → Page chrome; the design check): the one bottom strip of every view, with a table or
// without — pagination or a counts strip, then «<shown> из <total noun>», then the selection «Выбрано N <noun>» in a
// place reserved before anything is selected (table #5), then «обновлено <compact past>» with the full Moscow time in
// its title, the age given by the caller's shared clock. It holds no actions but paging. Its height is fixed and
// every number keeps its box, so it never moves what is above it or beside it (rules/ui → Strict 1). The order of
// its slots is the caller's prop (`order`); the slots it packs at the right end never move with the strip's width,
// the age never shrinks, and the counts strip shows the form its own room holds whole (`stripFit`): every state,
// else the view's groups, else the groups that fit and «ещё N» — never a clipped count, never a wordless entry.
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { flushSync } from "react-dom";
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

/** The selection's widest three-digit forms: its place is their box, measured by the browser (as the toolbar's «Вид»). */
const SIZED = [111, 222, 555] as const;

/** One form of the selection, unseen and unread: drawn as generated content, it gives the slot its width and is no
 * text anyone reads. */
function SelectedSizer({ text }: { text: string }) {
  return <span aria-hidden="true" data-slot="selected-sizer" data-text={text} className="invisible after:content-[attr(data-text)]" />;
}

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

/** One entry of a counts strip: a state, or a group of states, and how many rows it holds. */
export interface StripEntry {
  key: string;
  tone: Tone;
  /** The word: a state's («закоммичен») or a group's («в работе»). */
  label: string;
  count: number;
  /** The title; by default «<label> <count>», a group's names the states it holds. */
  title?: string;
}

/** A counts strip's forms over the same rows, finest first: every state; then, where the view has them, its groups
 * (the «Вид» presets). */
export interface StripForms {
  entries: readonly StripEntry[];
  groups?: readonly StripEntry[];
}

/** The gap between a strip's entries (`gap-3`) and between the bar's slots (`gap-4`). */
export const STRIP_GAP = 12;
export const BAR_GAP = 16;

/** The form a strip shows, and how many of its entries before «ещё N». */
export interface StripFit {
  form: "entries" | "groups";
  shown: number;
}

/** The strip's one rule (table #8, #10; p2 craft-1, craft-2): on its own room — the bar less its other slots, which
 * never shrink — the first form that fits whole: every state, else the groups; else the leading entries of the
 * coarsest form that fit beside «ещё N <noun>» for the rest. Every entry keeps its word and its count whole; nothing
 * is clipped and nothing goes wordless. `widths` are the forms' entries and the fold's widest form, measured. */
export function stripFit(room: number, widths: { entries: readonly number[]; groups: readonly number[] | null; more: number }): StripFit {
  const line = (ws: readonly number[]) => ws.reduce((s, w) => s + w, 0) + Math.max(0, ws.length - 1) * STRIP_GAP;
  if (line(widths.entries) <= room) return { form: "entries", shown: widths.entries.length };
  const form = widths.groups ? "groups" : "entries";
  const ws = widths.groups ?? widths.entries;
  if (line(ws) <= room) return { form, shown: ws.length };
  let shown = ws.length - 1;
  while (shown > 0 && line([...ws.slice(0, shown), widths.more]) > room) shown--;
  return { form, shown };
}

/** One entry of the counts strip: a dot in the tone, the word, the count in a three-digit box — always all three. A
 * state the filters or a live change empty keeps its slot: a neutral dot and a muted 0 (Strict 1). */
export function StripCount({ tone, label, count: n, title }: Omit<StripEntry, "key">) {
  return (
    <span data-slot="state-count" title={title ?? `${label} ${num(n)}`} className="inline-flex shrink-0 items-center gap-1.5">
      <Dot tone={n ? tone : "neutral"} />
      <span data-slot="strip-label">{label}</span>
      <span data-slot="strip-count" className={cn("inline-block min-w-count tabular-nums", n > 0 && "text-foreground")}>
        {num(n)}
      </span>
    </span>
  );
}

/** «ещё 888 юнитов»: the fold's widest three-digit form, its reserve. */
const MORE_SIZED = 888;
const moreText = (n: number, noun: Forms) => `ещё ${count(n, noun)}`;

/** An entry's room, unseen and unread: the dot's box, the word and a three-digit count drawn as generated content, in
 * the entry's own chrome — measured by the browser, never estimated. */
function StripSizer({ form, label }: { form: "entries" | "groups"; label: string }) {
  return (
    <span data-strip-sizer={form} data-label={label} className="inline-flex shrink-0 items-center gap-1.5">
      <span className="inline-block size-dot shrink-0" />
      <span data-text={label} className="after:content-[attr(data-text)]" />
      <span data-text={MORE_SIZED} className="inline-block min-w-count tabular-nums after:content-[attr(data-text)]" />
    </span>
  );
}

/** The counts strip: the form its room holds (`fit`; null — not measured yet, every state), then «ещё N» naming the
 * entries it folds in its title; under them, out of the flow, the sizers it is measured by. */
function CountsStrip({ forms, fit, noun, className }: { forms: StripForms; fit: StripFit | null; noun: Forms; className?: string }) {
  const list = fit?.form === "groups" && forms.groups ? forms.groups : forms.entries;
  const shown = fit ? Math.min(fit.shown, list.length) : list.length;
  const rest = list.slice(shown);
  return (
    <div data-slot="counts-strip" className={cn("relative flex min-w-0 items-center gap-3 overflow-hidden", className)}>
      {list.slice(0, shown).map(({ key, ...e }) => (
        <StripCount key={key} {...e} />
      ))}
      {rest.length > 0 && (
        <span data-slot="strip-more" title={rest.map((e) => `${e.label} ${num(e.count)}`).join(", ")} className="shrink-0">
          {moreText(
            rest.reduce((s, e) => s + e.count, 0),
            noun,
          )}
        </span>
      )}
      <span aria-hidden="true" data-slot="strip-sizers" className="pointer-events-none invisible absolute top-0 left-0 flex items-center whitespace-nowrap">
        {forms.entries.map((e) => (
          <StripSizer key={`e-${e.key}`} form="entries" label={e.label} />
        ))}
        {forms.groups?.map((e) => (
          <StripSizer key={`g-${e.key}`} form="groups" label={e.label} />
        ))}
        <span data-strip-sizer="more" data-label={moreText(MORE_SIZED, noun)} data-text={moreText(MORE_SIZED, noun)} className="shrink-0 after:content-[attr(data-text)]" />
      </span>
    </div>
  );
}

export interface StatusBarProps {
  /** Paging, when the list is split; otherwise the counts strip takes the slot. */
  pager?: PagerProps | null;
  /** The counts strip of a list by state: its forms, the one its room holds shown (`stripFit`). */
  strip?: StripForms;
  /** A strip of the caller's own, in the same slot: «на экране …» in «Журнал». */
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

export function StatusBar({ pager, strip, counts, shown, total, noun, selected, updatedAt, now, order = DEFAULT_BAR_ORDER, className }: StatusBarProps) {
  const loaded = shown !== undefined && total !== undefined;
  const bar = useRef<HTMLDivElement | null>(null);
  const [fit, setFit] = useState<StripFit | null>(null);
  const forms = strip ? [strip.entries, strip.groups ?? []].map((l) => l.map((e) => `${e.key}:${e.label}:${e.count}`).join("|")).join("/") : null;
  // The strip measures its own room — the bar less its other slots — and its forms' sizers, and shows the form that
  // fits whole; the change commits before the frame paints (the observer's first call comes before it), so a cut or a
  // wordless strip is never drawn (Strict 1).
  useLayoutEffect(() => {
    const el = bar.current;
    if (!el || !strip) return;
    const measure = () => {
      const box = el.querySelector<HTMLElement>("[data-slot=counts-strip]");
      const width = el.getBoundingClientRect().width;
      if (!box || width <= 0) return; // not laid out (a test without layout): every state
      const others = [...el.children].filter((c) => c !== box);
      const room = width - others.reduce((s, c) => s + c.getBoundingClientRect().width, 0) - BAR_GAP * others.length;
      const sized = (form: string) => [...box.querySelectorAll<HTMLElement>(`[data-strip-sizer="${form}"]`)].map((s) => s.getBoundingClientRect().width);
      const next = stripFit(room, { entries: sized("entries"), groups: strip.groups ? sized("groups") : null, more: sized("more")[0] ?? 0 });
      flushSync(() => setFit((prev) => (prev && prev.form === next.form && prev.shown === next.shown ? prev : next)));
    };
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    // a neighbour that changes its text («42 юнита» → «3 из 42 юнитов», the age) changes the room
    for (const child of el.children) observer.observe(child);
    return () => observer.disconnect();
    // the forms' words and counts, not each render's arrays, decide what is measured
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [forms, loaded]);
  // each slot's node, or null when it has nothing to hold; `end` — the first slot packed at the right end
  const slot = (name: BarSlot, end: boolean): ReactNode => {
    const at = end && "ml-auto";
    switch (name) {
      case "paging":
        if (!loaded) return null;
        if (pager) return <Pager key={name} {...pager} className={cn("shrink-0", at)} />;
        // the strip shows only whole entries, the form its room holds; a caller's own strip clips in its own box
        if (strip) return <CountsStrip key={name} forms={strip} fit={fit} noun={noun} className={at || undefined} />;
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
          <span key={name} data-slot="selected" aria-live="polite" className={cn("inline-grid shrink-0 text-foreground [&>*]:[grid-area:1/1]", at)}>
            {[...new Set(SIZED.map((n) => selectedText(n, selected.noun)))].map((text) => (
              <SelectedSizer key={text} text={text} />
            ))}
            <span>{selected.count > 0 ? selectedText(selected.count, selected.noun) : null}</span>
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
    <div ref={bar} data-slot="status-bar" className={cn("flex h-8 shrink-0 items-center gap-4 overflow-hidden text-xs whitespace-nowrap text-muted-foreground tabular-nums", className)}>
      {start}
      {end}
    </div>
  );
}
