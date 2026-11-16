// «Журнал» (surfaces/reading.md → CHOSEN: the journal as a reading list): what the run decided without the user,
// why, and on what basis. Every entry in `#` order as an article: «#n · этап», the question as its heading (Title),
// then «Решение» leading in ink, «Почему» and «Ссылки» as label–value rows — the labels in a hanging column from
// 40 rem of the view, above their text below it. Search and «Этап» narrow it, the hits marked; new entries wait in
// the strip at its end (Live data); the status bar names the entries in view. A journal that cannot be read fails
// in the list's place (rules/ui → Conventions 14).
//
// Volume (ux 6; f16): from 52 rem of the view a rail beside the list names the stages of the entries shown, each
// with its count, the one in view marked, each opening its first entry; then «Последнее решение» and a field that
// opens an entry by its number. The list is one flat list (ui → Keyboard): one Tab stop, ↑/↓ between entries, and
// an entry's links take Tab only while focus is in it. An entry's menu copies its address.
//
// An entry's address is `?view=journal&entry=<n>` (the design check): the view scrolls to it, marks it with the
// target mark and moves focus to it; hidden by the filters it shows anyway, «вне фильтра»; still held in the strip,
// it is placed at once.
import { memo, useLayoutEffect, useMemo, useRef, useState, type FocusEvent, type KeyboardEvent, type ReactNode, type RefObject } from "react";
import { Link, useSearchParams } from "react-router-dom";
import type { JournalEntry } from "../../../shared/model.ts";
import { stageOf, type Step } from "../../../shared/states.ts";
import { count, NOUNS, num } from "../../../shared/text.ts";
import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from "@/components/ui/input-group";
import { cn } from "@/lib/utils";
import { copyItem, Dash, EmptyState, emptyWhen, FactList, flatItem, FlatList, HeldStrip, markProps, Menu, NotFound, OutOfFilter, PartFailed, RunningText, type Fact, type HeldNoun } from "@/ui";
import { AdaptiveToolbar, filterSummary, FilterControl, Highlight, pushHistory, runQuery, SearchBox, StatusBar, tokens, useRunView, useTableView, type FilterDef, type SearchDef, type ToolbarItem } from "@/table";
import { useNow } from "../../app/clock.tsx";
import { resolverFor, routerLink } from "../../app/links.tsx";
import { useUpdatedAt } from "../../app/live.tsx";
import { runPath } from "../../app/routes.ts";
import type { LoadedRun, ViewProps } from "../index.ts";
import { fileFailure, folderFailure } from "./failure.ts";
import { isRef, RefLink } from "./ref-link.tsx";

/** The journal's noun: an entry is one decision of the run (PRODUCT.md → Glossary: журнал решений). */
const DECISION_NOUN = NOUNS.decision;
const NOUN: HeldNoun = { forms: DECISION_NOUN, gender: "n" };
export const JOURNAL_VIEW = "journal";
export const LABELS = { decision: "Решение", why: "Почему", refs: "Ссылки" } as const;
/** What failed, when the journal cannot be read: «Журнал решений не прочитан: <причина>». */
export const JOURNAL_PART = "Журнал решений";
export const RAIL_LABEL = "Этапы журнала";
export const RAIL_HEAD = "Этапы";
export const LATEST = "Последнее решение";
export const GOTO_TEXT = "Перейти к #";
export const GOTO_LABEL = "Перейти к решению: номер";
export const CLOSE = "Закрыть";
/** «Скопировать адрес решения» / «Скопировано: адрес решения»: one form for both, as the copy helper needs. */
export const COPY_ADDRESS = "адрес решения";

/** «#12 · проход 1 · карта». */
export const entryHead = (e: Pick<JournalEntry, "n" | "stage">): string => `#${e.n} · ${e.stage ? stageOf(e.stage).full : "этап не записан"}`;

export function stageFilter(entries: readonly JournalEntry[]): FilterDef<JournalEntry> {
  const stages = [...new Set(entries.map((e) => e.stage))];
  return { id: "stage", label: "Этап", values: (e) => [e.stage], options: stages.map((s) => ({ value: s, label: stageOf(s).full })), placeholder: "Найти этап" };
}

/** The placeholder names every field searched by the entry's own labels — the question, «Решение», «Почему», the
 * stage — and «id» for its number («#12», «j12») and its refs' ids, the product's word for an identifier (cand-20). */
export const SEARCH: SearchDef<JournalEntry> = {
  identifiers: (e) => [`#${e.n}`, `j${e.n}`, ...e.refs.map((r) => r.id)],
  text: (e) => [e.question, e.decision, e.why, stageOf(e.stage).full],
  placeholder: "Вопрос, решение, почему, этап, id",
};

/** The stage the first decision comes at: the map writes the route. */
const FIRST: Step = "map";

/** An entry counts as in view when a line of it shows: 20 px, or the whole of a shorter box. */
const IN_VIEW_MIN = 20;

/** The first and the last entry whose box shows in the list's visible band; null — none does. */
export function entriesInView(view: { top: number; bottom: number }, boxes: readonly { n: string; top: number; bottom: number }[]): [string, string] | null {
  const seen = boxes.filter((b) => {
    const shown = Math.min(b.bottom, view.bottom) - Math.max(b.top, view.top);
    return shown > 0 && shown >= Math.min(IN_VIEW_MIN, b.bottom - b.top);
  });
  return seen.length ? [seen[0].n, seen[seen.length - 1].n] : null;
}

/** «на экране #40–#42», «на экране #7»; nothing in view — empty, its box kept. */
export const inViewText = (range: readonly [string, string] | null): string => (!range ? "" : range[0] === range[1] ? `на экране #${range[0]}` : `на экране #${range[0]}–#${range[1]}`);

/** What the run holds, after an unknown entry's «не найдена»: «: в этом прогоне решения #1–#143» (cand-21). */
export function entryRangeText(entries: readonly Pick<JournalEntry, "n">[]): string {
  if (!entries.length) return "";
  const first = entries[0].n;
  const last = entries[entries.length - 1].n;
  return first === last ? `: в этом прогоне решение #${first}` : `: в этом прогоне решения #${first}–#${last}`;
}

/** A stage of the rail: its word, the first and the last entry it holds among the rows, and how many. */
export interface RailStage {
  stage: string;
  label: string;
  first: string;
  last: string;
  count: number;
}

/** The stages of the rows in their order of first appearance (cand-18). */
export function railStages(rows: readonly Pick<JournalEntry, "n" | "stage">[]): RailStage[] {
  const by = new Map<string, RailStage>();
  for (const e of rows) {
    const key = e.stage ?? "";
    const known = by.get(key);
    if (known) {
      known.last = e.n;
      known.count += 1;
    } else by.set(key, { stage: key, label: stageOf(e.stage).full, first: e.n, last: e.n, count: 1 });
  }
  return [...by.values()];
}

/** The stage of the first entry in view; null — none is. */
export const stageAt = (range: readonly [string, string] | null, rows: readonly Pick<JournalEntry, "n" | "stage">[]): string | null => {
  if (!range) return null;
  const e = rows.find((r) => r.n === range[0]);
  return e ? (e.stage ?? "") : null;
};

/** The links and scroll boxes inside an entry take Tab only while focus is in that entry (cand-19). */
const INNER = "a[href], button, input, [tabindex]";
function gateEntries(root: HTMLElement, active: Element | null) {
  for (const item of root.querySelectorAll<HTMLElement>("article[data-entry]")) {
    const open = active !== null && item.contains(active);
    for (const el of item.querySelectorAll<HTMLElement>(INNER)) el.tabIndex = open ? 0 : -1;
  }
}

/** The entry scrolled to the list's top and focused, its own scroll suppressed. */
function revealIn(root: HTMLElement | null, n: string) {
  const el = root?.querySelector<HTMLElement>(`[data-entry="${n}"]`);
  el?.scrollIntoView({ block: "start" });
  el?.focus({ preventScroll: true });
}

export function JournalView({ run }: ViewProps) {
  return <Journal key={run.key} run={run} />;
}

function Journal({ run }: { run: LoadedRun }) {
  const now = useNow();
  const updated = useUpdatedAt();
  const [params, setParams] = useSearchParams();
  const [placed, setPlaced] = useState(() => new Set(run.journal.map((e) => e.n)));
  const [arrived, setArrived] = useState<ReadonlySet<string>>(new Set());
  const [goto, setGoto] = useState("");
  const entry = params.get("entry");
  // An entry a link names that still waits in the strip is placed at once (Conventions 12: a link shows its object).
  if (entry !== null && !placed.has(entry) && run.journal.some((e) => e.n === entry)) setPlaced(new Set([...placed, entry]));
  const shown = run.journal.filter((e) => placed.has(e.n));
  const fresh = run.journal.length - shown.length;

  const filter = useMemo(() => stageFilter(run.journal), [run.journal]);
  const [prefs, setPrefs] = useRunView(JOURNAL_VIEW, run.key);
  const [table, setTable] = useTableView(JOURNAL_VIEW);
  const target = entry !== null && shown.some((e) => e.n === entry) ? entry : null;
  const q = runQuery({ rows: shown, rowId: (e) => e.n, columns: [], filters: [filter], search: SEARCH, state: { sort: null, filters: prefs.filters, search: prefs.search }, include: target ? new Set([target]) : undefined });
  const resolve = useMemo(() => resolverFor(run), [run]);
  const toks = useMemo(() => tokens(prefs.search), [prefs.search]);
  const failure = fileFailure(run, "journal.md") ?? (run.journal.length === 0 ? folderFailure(run) : null);

  const list = useRef<HTMLDivElement>(null);
  const reveal = (n: string) => revealIn(list.current, n);
  // The entry a link names is scrolled to and takes focus, once per link.
  useLayoutEffect(() => {
    if (target) revealIn(list.current, target);
  }, [target]);
  // After every render the entries' inner stops follow the focus (a live update may add links).
  useLayoutEffect(() => {
    if (list.current) gateEntries(list.current, document.activeElement);
  });

  const go = (n: string, how: { replace: boolean }) => {
    const next = new URLSearchParams(params);
    if (n) next.set("entry", n);
    else next.delete("entry");
    setParams(next, how);
  };
  // A rail link or the field naming the entry already opened scrolls to it again: the address does not change.
  const open = (n: string) => {
    if (n === target) reveal(n);
    else go(n, { replace: true });
  };

  const rowsKey = q.rows.map((e) => e.n).join(",");
  const range = useEntriesInView(list, `${run.version}:${rowsKey}`);
  const stages = railStages(q.rows);
  const current = stageAt(range, q.rows);
  const latest = q.rows.length ? q.rows[q.rows.length - 1].n : null;

  const toolbar: ToolbarItem[] = [
    { id: "search", kind: "pinned", flex: true, node: <SearchBox value={prefs.search} onChange={(v) => setPrefs({ search: v })} placeholder={SEARCH.placeholder} history={table.history} onCommit={(term) => setTable({ history: pushHistory(table.history, term) })} /> },
    {
      id: "filter-stage",
      kind: "ordinary",
      active: Boolean(prefs.filters.stage?.length),
      node: <FilterControl def={filter} value={prefs.filters.stage ?? []} counts={q.counts.stage} onChange={(v) => setPrefs({ filters: { ...prefs.filters, stage: v } })} />,
    },
  ];

  const missing = entry !== null && !target ? entry : null;
  const never = emptyWhen(run, FIRST).form === "never";
  const hrefOf = (n: string) => runPath(run.key, { view: JOURNAL_VIEW, entry: n });

  return (
    <div data-slot="journal-view" className="absolute inset-0 flex flex-col gap-2 px-5 pt-3 pb-1">
      <AdaptiveToolbar items={toolbar} label="Фильтры журнала" />
      <div data-slot="journal-body" className="grid min-h-0 flex-1 grid-cols-1 grid-rows-[minmax(0,1fr)] gap-x-6 border-t @min-[52rem]/view:grid-cols-[minmax(0,calc(var(--container-measure)+9.5rem))_14rem]">
        <div
          ref={list}
          data-slot="journal-scroll"
          className="min-h-0 overflow-y-auto [scrollbar-gutter:stable]"
          onFocus={(event: FocusEvent<HTMLDivElement>) => list.current && gateEntries(list.current, event.target)}
          onBlur={(event: FocusEvent<HTMLDivElement>) => {
            if (list.current && !list.current.contains(event.relatedTarget as Node | null)) gateEntries(list.current, null);
          }}
        >
          {failure ? (
            <PartFailed what={JOURNAL_PART} cause={failure.cause} className="mt-4" />
          ) : (
            <>
              {missing && (
                <p role="status" data-slot="entry-missing" className="m-0 flex max-w-measure flex-wrap items-baseline gap-x-2 pt-4">
                  <span>
                    <NotFound kind="entry" id={missing} start />
                    {entryRangeText(shown)}.
                  </span>
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={() => {
                      go("", { replace: true });
                      // the button goes with the line: focus lands on the list's Tab stop
                      list.current?.querySelector<HTMLElement>('article[data-entry][tabindex="0"]')?.focus({ preventScroll: true });
                    }}
                  >
                    {CLOSE}
                  </Button>
                </p>
              )}
              {run.journal.length === 0 ? (
                never ? <EmptyState form="never" noun={DECISION_NOUN} className="py-16" /> : <EmptyState form="not-yet" noun={DECISION_NOUN} step={FIRST} className="py-16" />
              ) : q.rows.length === 0 ? (
                <EmptyState form="filtered" noun={DECISION_NOUN} filters={filterSummary([filter], prefs.filters, prefs.search)} onReset={() => setPrefs({ filters: {}, search: "" })} className="py-16" />
              ) : (
                <FlatList label={JOURNAL_PART}>
                  {/* Enter on a link inside an entry follows it; the list's own Enter is for the entry itself */}
                  <ol
                    className="m-0 flex max-w-[calc(var(--container-measure)+8.5rem)] list-none flex-col p-0 py-2"
                    onKeyDown={(event: KeyboardEvent<HTMLOListElement>) => {
                      if (event.key === "Enter" && !(event.target as HTMLElement).hasAttribute("data-flat-item")) event.stopPropagation();
                    }}
                  >
                    {q.rows.map((e) => (
                      <li key={e.n} className="border-b last:border-b-0">
                        <Entry entry={e} run={run} resolve={resolve} toks={toks} target={e.n === target} edge={arrived.has(e.n)} outside={q.outside.has(e.n)} />
                      </li>
                    ))}
                  </ol>
                </FlatList>
              )}
            </>
          )}
        </div>
        <nav aria-label={RAIL_LABEL} data-slot="journal-rail" className="hidden min-h-0 flex-col gap-3 overflow-y-auto py-2 [scrollbar-gutter:stable] @min-[52rem]/view:flex">
          {!failure && run.journal.length > 0 && (
            <>
              {stages.length > 0 && latest && (
                <div className="flex flex-col">
                  <p aria-hidden="true" className="m-0 flex h-7 items-center px-2 text-xs text-muted-foreground">
                    {RAIL_HEAD}
                  </p>
                  <FlatList label={RAIL_HEAD}>
                    {stages.map((s) => (
                      <RailLink key={s.stage} href={hrefOf(s.first)} item={s.stage} current={s.stage === current} title={`${s.label}: ${s.first === s.last ? `#${s.first}` : `#${s.first}–#${s.last}`}, ${count(s.count, DECISION_NOUN)}`} onOpen={() => open(s.first)}>
                        <span className="min-w-0 truncate">{s.label}</span>
                        <span className="ml-auto min-w-count shrink-0 text-right text-xs text-muted-foreground tabular-nums">{num(s.count)}</span>
                      </RailLink>
                    ))}
                    <RailLink href={hrefOf(latest)} item="latest" className="mt-2" onOpen={() => open(latest)}>
                      <span className="min-w-0 truncate">{LATEST}</span>
                      <span className="ml-auto shrink-0 text-xs text-muted-foreground tabular-nums">#{latest}</span>
                    </RailLink>
                  </FlatList>
                </div>
              )}
              <InputGroup className="h-7 w-full shrink-0">
                <InputGroupAddon align="inline-start">
                  <InputGroupText>{GOTO_TEXT}</InputGroupText>
                </InputGroupAddon>
                <InputGroupInput
                  aria-label={GOTO_LABEL}
                  inputMode="numeric"
                  autoComplete="off"
                  value={goto}
                  onChange={(event) => setGoto(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key !== "Enter") return;
                    const n = goto.trim().replace(/^[#j]/i, "");
                    if (!n) return;
                    event.preventDefault();
                    setGoto("");
                    open(n);
                  }}
                />
              </InputGroup>
            </>
          )}
        </nav>
      </div>
      <HeldStrip
        counts={{ fresh, moved: 0, left: 0 }}
        noun={NOUN}
        onApply={() => {
          setArrived(new Set(run.journal.filter((e) => !placed.has(e.n)).map((e) => e.n)));
          setPlaced(new Set(run.journal.map((e) => e.n)));
        }}
      />
      <StatusBar counts={<InView range={range} />} shown={q.matched} total={q.total} noun={DECISION_NOUN} updatedAt={updated === null ? null : new Date(updated).toISOString()} now={now} />
    </div>
  );
}

/** A rail item: one link with a fixed 28 px line; the stage in view on the muted ground (it holds the rail's Tab stop). */
function RailLink({ href, item, current = false, title, className, onOpen, children }: { href: string; item: string; current?: boolean; title?: string; className?: string; onOpen: () => void; children: ReactNode }) {
  return (
    <Link
      to={href}
      replace
      {...flatItem(item)}
      aria-current={current ? "location" : undefined}
      title={title}
      onClick={(event) => {
        // a click with a modifier keeps the browser's own meaning (a new tab, a new window)
        if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        onOpen();
      }}
      className={cn("flex h-7 min-w-0 shrink-0 items-center gap-2 rounded-md px-2 outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset", current && "bg-muted", className)}
    >
      {children}
    </Link>
  );
}

interface EntryProps {
  entry: JournalEntry;
  run: LoadedRun;
  resolve: ReturnType<typeof resolverFor>;
  toks: readonly string[];
  target: boolean;
  edge: boolean;
  outside: boolean;
}

/** One decision: its head, its question, then «Решение» leading, «Почему», «Ссылки» — a ref each line with its fact,
 * «—» when the decision names none. The search's hits wear the table's one mark (`Highlight`) in all the text the
 * search looks in — the head («#n» and the stage), the question, the decision, the why and the refs' ids — and
 * nowhere else: never a label (table #12). Its menu copies its address. */
const Entry = memo(function Entry({ entry: e, run, resolve, toks, target, edge, outside }: EntryProps) {
  const refs = e.refs.filter(isRef);
  const marks = markProps({ target, edge });
  const hl = (text: string) => <Highlight text={text} tokens={toks} />;
  const facts: Fact[] = [
    { label: LABELS.decision, value: <RunningText text={e.decision} resolve={resolve} renderLink={routerLink} measure={false} highlight={hl} className="text-foreground" /> },
    { label: LABELS.why, value: <RunningText text={e.why} resolve={resolve} renderLink={routerLink} measure={false} highlight={hl} /> },
    {
      label: LABELS.refs,
      value: refs.length ? (
        <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
          {refs.map((r, i) => (
            <li key={`${r.id}-${i}`} className="min-w-0">
              <RefLink run={run} refItem={r} highlight={hl} />
            </li>
          ))}
        </ul>
      ) : (
        <Dash />
      ),
    },
  ];
  const address = new URL(runPath(run.key, { view: JOURNAL_VIEW, entry: e.n }), window.location.origin).href;
  return (
    <Menu kind="context" groups={[[copyItem(COPY_ADDRESS, address)]]} header={{ text: `#${e.n} · ${e.question}`, title: e.question }} label={`Решение #${e.n}`}>
      <article
        id={`j${e.n}`}
        tabIndex={-1}
        {...flatItem(e.n)}
        data-entry={e.n}
        aria-labelledby={`j${e.n}-q`}
        data-target={marks["data-target"]}
        data-edge={marks["data-edge"]}
        className={`flex scroll-mt-2 flex-col gap-1 rounded-md px-4 py-3 outline-none focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset ${marks.className}`}
      >
        <p className="m-0 flex items-baseline gap-2 text-xs text-muted-foreground tabular-nums">
          <span>{hl(entryHead(e))}</span>
          {outside && <OutOfFilter className="ml-auto" />}
        </p>
        <h3 id={`j${e.n}-q`} className="m-0 text-base font-semibold text-balance break-words">
          <Highlight text={e.question} tokens={toks} />
        </h3>
        <FactList facts={facts} className="mt-1 grid-cols-1 gap-y-0.5 @min-[40rem]/view:grid-cols-[5.5rem_minmax(0,1fr)] @min-[40rem]/view:gap-y-1.5" />
      </article>
    </Menu>
  );
});

/** The entries the list shows, measured before paint and on every scroll and resize. */
function useEntriesInView(list: RefObject<HTMLDivElement | null>, version: string): [string, string] | null {
  const [range, setRange] = useState<[string, string] | null>(null);
  useLayoutEffect(() => {
    const el = list.current;
    if (!el) return;
    let frame = 0;
    const measure = () => {
      frame = 0;
      const view = el.getBoundingClientRect();
      const boxes = [...el.querySelectorAll<HTMLElement>("article[data-entry]")].map((a) => {
        const r = a.getBoundingClientRect();
        return { n: a.dataset.entry ?? "", top: r.top, bottom: r.bottom };
      });
      const next = entriesInView(view, boxes);
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
  }, [list, version]);
  return range;
}

/** «на экране #40–#42» in the status bar; its box is reserved at the widest form («на экране #142–#143»,
 * 19 characters), so nothing beside it moves. */
function InView({ range }: { range: [string, string] | null }) {
  return (
    <span data-slot="in-view" className="inline-block min-w-[21ch]">
      {inViewText(range)}
    </span>
  );
}
