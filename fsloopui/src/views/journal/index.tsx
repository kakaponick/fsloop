// «Журнал» (surfaces/reading.md → CHOSEN: the journal as a reading list): what the run decided without the user,
// why, and on what basis. Every entry in `#` order as an article: «#n · этап», the question as its heading (Title),
// then «Решение» leading in ink, «Почему» and «Ссылки» as label–value rows — the labels in a hanging column from
// 40 rem of the view, above their text below it. Search and «Этап» narrow it, the hits marked; new entries wait in
// the strip at its end (Live data); the status bar names the entries in view (`@/ui` → InView). A journal that cannot be read fails
// in the list's place (rules/ui → Conventions 14).
//
// One caption line opens the list's scroller (the design check of pass 3: a view's caption, in INTRO's form): what a
// decision is, what stands beside a ref, and the keys — ↑/↓, and G where the rail shows its field (u12, improve-7).
//
// Volume (ux 6; f16): from 52 rem of the view a rail beside the list names the stages of the entries shown, each
// with its count, the one in view marked, each opening its first entry; then, past a rule, «Последнее решение #143»
// and a field that opens an entry by its number — its placeholder the numbers the journal holds, G its in-field cap
// (the physical key focuses it); a number the journal lacks keeps the field and says so on a line reserved under it.
// The list is one flat list (ui → Keyboard): one Tab stop, ↑/↓ between entries, Enter on an entry opens its address
// menu, and an entry's links take Tab only while focus is in it.
//
// An entry's address is `?view=journal&entry=<n>` (the design check), in the one form of an object on its list
// (`@/ui` → AddressLink, AddressMenu, useReveal): «#n» is a link to it and its menu copies it; the view brings it to
// the top of the list's own scroller — nothing above the list moves — marks it with the target mark and moves focus
// to it; hidden by the filters it shows anyway, «вне фильтра»; still held in the strip, it is placed at once; an
// address the journal lacks reads the shared «не найдено» line with the numbers it holds and «Закрыть».
import { memo, useCallback, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import type { JournalEntry } from "../../../shared/model.ts";
import { stageOf, type Step } from "../../../shared/states.ts";
import { count, NOUNS, num } from "../../../shared/text.ts";
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from "@/components/ui/input-group";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { AddressLink, AddressMenu, Dash, EmptyState, emptyWhen, FactList, FieldCap, fileFailure, flatItem, FlatList, folderFailure, HeldStrip, InView, Keys, markProps, MissingLine, numberRange, numberText, openItemMenu, OutOfFilter, PartFailed, RunningText, SCROLLER, useInView, useReveal, type Fact, type HeldNoun, type InViewRange } from "@/ui";
import { AdaptiveToolbar, filterSummary, FilterControl, Highlight, pushHistory, runQuery, SearchBox, StatusBar, tokens, useRunView, useTableView, type FilterDef, type SearchDef, type ToolbarItem } from "@/table";
import { useNow } from "../../app/clock.tsx";
import { resolverFor, routerLink } from "../../app/links.tsx";
import { useUpdatedAt } from "../../app/live.tsx";
import { runPath } from "../../app/routes.ts";
import type { LoadedRun, ViewProps } from "../index.ts";
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
/** The field's name for a screen reader opens with the words it shows, «Перейти к #» (improve-7). */
export const GOTO_LABEL = `${GOTO_TEXT}: номер решения`;
/** The key that focuses «Перейти к #», by its physical code (rules/ui → Conventions 11). */
export const GOTO_KEY = "KeyG";
/** The caption's words, around the keys' caps: what a decision is, what stands beside a ref, what ↑/↓ and G do. */
export const CAPTION = {
  lead: "Решение — что прогон решил без вас; рядом со ссылкой — что за ней.",
  move: "— по решениям",
  goto: "— к номеру",
} as const;

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

/** The first and the last number of the entries; null — there are none. */
const rangeOf = (entries: readonly Pick<JournalEntry, "n">[]): [string, string] | null => (entries.length ? [entries[0].n, entries[entries.length - 1].n] : null);

/** The answer under «Перейти к #» to a number the journal does not hold, and the numbers it does: «Решения #999 нет:
 * #1–#143» — one line in the 14 rem rail, so the range is the numbers alone (craft-6). */
export const gotoMissText = (n: string, range: readonly [string, string]): string => `Решения ${numberText("entry", n)} нет: ${numberRange("entry", range[0], range[1])}`;

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
export const stageAt = (range: InViewRange | null, rows: readonly Pick<JournalEntry, "n" | "stage">[]): string | null => {
  if (!range) return null;
  const e = rows.find((r) => r.n === range[0]);
  return e ? (e.stage ?? "") : null;
};

/** An entry in the list's scroller, by its number. */
const findEntry = (list: HTMLElement, n: string) => list.querySelector<HTMLElement>(`article[data-entry="${n}"]`);

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
  // the number «Перейти к #» could not open, until the field changes (craft-6)
  const [miss, setMiss] = useState<string | null>(null);
  const gotoStatus = useId();
  const gotoField = useRef<HTMLInputElement>(null);
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

  // The entry a link names is scrolled to the top of the list's own scroller and takes focus, once per link; the
  // entry whose «#n» the user clicked stays where it stands (Strict 1).
  const { scroller: list, reveal, hold } = useReveal(target, findEntry);

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
  // An entry's own «#n»: its address in place, the entry left where the user clicked it (craft-4).
  const openOwn = useCallback(
    (n: string) => {
      hold(n);
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set("entry", n);
          return next;
        },
        { replace: true },
      );
    },
    [hold, setParams],
  );
  // «Перейти к #»: a number the journal holds opens it and clears the field; any other keeps the field, marks it
  // invalid and answers on the line under it, the address left as it is (craft-6).
  const jump = () => {
    const n = goto.trim().replace(/^[#j]/i, "");
    if (!n) return;
    if (!run.journal.some((e) => e.n === n)) {
      setMiss(n);
      return;
    }
    setGoto("");
    setMiss(null);
    open(n);
  };
  const shownRange = rangeOf(shown);

  const rowsKey = q.rows.map((e) => e.n).join(",");
  const range = useInView(list, "entry", `${run.version}:${rowsKey}`);
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
        <div ref={list} data-slot="journal-scroll" className={SCROLLER}>
          {failure ? (
            <PartFailed what={JOURNAL_PART} cause={failure.cause} className="mt-4" />
          ) : (
            <>
              {run.journal.length > 0 && (
                // one line one cap tall, there from the first paint (Strict 1); G only where the rail shows its field
                <p data-slot="journal-caption" className="m-0 min-h-5 px-4 pt-3 text-xs/5 text-muted-foreground">
                  {CAPTION.lead} <Keys codes={["ArrowUp", "ArrowDown"]} /> {CAPTION.move}
                  <span className="hidden @min-[52rem]/view:inline">
                    , <Keys codes={[GOTO_KEY]} /> {CAPTION.goto}
                  </span>
                  .
                </p>
              )}
              {missing && (
                <MissingLine
                  kind="entry"
                  id={missing}
                  range={shownRange}
                  slot="entry-missing"
                  className="pt-4"
                  onClose={() => {
                    go("", { replace: true });
                    // the button goes with the line: focus lands on the list's Tab stop
                    list.current?.querySelector<HTMLElement>('article[data-entry][tabindex="0"]')?.focus({ preventScroll: true });
                  }}
                />
              )}
              {run.journal.length === 0 ? (
                never ? <EmptyState form="never" noun={DECISION_NOUN} className="py-16" /> : <EmptyState form="not-yet" noun={DECISION_NOUN} step={FIRST} className="py-16" />
              ) : q.rows.length === 0 ? (
                <EmptyState form="filtered" noun={DECISION_NOUN} filters={filterSummary([filter], prefs.filters, prefs.search)} onReset={() => setPrefs({ filters: {}, search: "" })} className="py-16" />
              ) : (
                <FlatList label={JOURNAL_PART} gate onOpen={(n) => openItemMenu(list.current && findEntry(list.current, n))}>
                  <ol role="list" className="m-0 flex max-w-[calc(var(--container-measure)+8.5rem)] list-none flex-col p-0 py-2">
                    {q.rows.map((e) => (
                      <li key={e.n} className="border-b last:border-b-0">
                        <Entry entry={e} run={run} resolve={resolve} toks={toks} target={e.n === target} edge={arrived.has(e.n)} outside={q.outside.has(e.n)} onOwn={openOwn} />
                      </li>
                    ))}
                  </ol>
                </FlatList>
              )}
            </>
          )}
        </div>
        <nav aria-label={RAIL_LABEL} data-slot="journal-rail" className={cn(SCROLLER, "hidden flex-col gap-3 py-2 @min-[52rem]/view:flex")}>
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
                    {/* the newest decision is no stage: a rule sets it apart, its number beside its words, out of
                        the counts' column (improve-7) */}
                    <Separator className="my-1.5" />
                    <RailLink href={hrefOf(latest)} item="latest" onOpen={() => open(latest)}>
                      <span className="min-w-0 truncate">
                        {LATEST} <span className="text-xs text-muted-foreground tabular-nums">{numberText("entry", latest)}</span>
                      </span>
                    </RailLink>
                  </FlatList>
                </div>
              )}
              <div className="flex shrink-0 flex-col gap-1">
                <InputGroup className="h-7 w-full">
                  <InputGroupAddon align="inline-start">
                    <InputGroupText>{GOTO_TEXT}</InputGroupText>
                  </InputGroupAddon>
                  <InputGroupInput
                    ref={gotoField}
                    aria-label={GOTO_LABEL}
                    aria-invalid={miss !== null || undefined}
                    aria-describedby={gotoStatus}
                    inputMode="numeric"
                    autoComplete="off"
                    placeholder={shownRange ? numberRange("entry", shownRange[0], shownRange[1]) : undefined}
                    value={goto}
                    onChange={(event) => {
                      setGoto(event.target.value);
                      setMiss(null);
                    }}
                    onKeyDown={(event) => {
                      if (event.key !== "Enter") return;
                      event.preventDefault();
                      jump();
                    }}
                  />
                  {/* G's cap inside the field, at its end — the shared in-field cap, which binds G to the field: hidden
                      while the field is focused or filled, its box kept (the design check: a key that focuses a field —
                      design-14; code-3) */}
                  <InputGroupAddon align="inline-end">
                    <FieldCap field={gotoField} code={GOTO_KEY} filled={Boolean(goto)} />
                  </InputGroupAddon>
                </InputGroup>
                {/* the answer's line, reserved from the first paint (Strict 1); its whole text in its title */}
                <p id={gotoStatus} data-slot="goto-status" aria-live="polite" title={miss && shownRange ? gotoMissText(miss, shownRange) : undefined} className="m-0 h-4 truncate px-2 text-xs/4">
                  {miss && shownRange ? gotoMissText(miss, shownRange) : ""}
                </p>
              </div>
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
      <StatusBar counts={<InView kind="entry" range={range} last={latest} />} shown={q.matched} total={q.total} noun={DECISION_NOUN} updatedAt={updated === null ? null : new Date(updated).toISOString()} now={now} />
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
  /** Opens the entry's own address in place, the entry left where it stands. */
  onOwn: (n: string) => void;
}

/** One decision: its head, its question, then «Решение» leading, «Почему», «Ссылки» — a ref each line with its fact,
 * «—» when the decision names none. The search's hits wear the table's one mark (`Highlight`) in all the text the
 * search looks in — the head («#n» and the stage), the question, the decision, the why and the refs' ids — and
 * nowhere else: never a label (table #12). Its address has the one form of an object on its list (craft-4): «#n» a
 * link to it, and its menu copies it. */
const Entry = memo(function Entry({ entry: e, run, resolve, toks, target, edge, outside, onOwn }: EntryProps) {
  const refs = e.refs.filter(isRef);
  const marks = markProps({ target, edge });
  const hl = (text: string) => <Highlight text={text} tokens={toks} />;
  const facts: Fact[] = [
    { label: LABELS.decision, value: <RunningText text={e.decision} resolve={resolve} renderLink={routerLink} measure={false} highlight={hl} className="text-foreground" /> },
    { label: LABELS.why, value: <RunningText text={e.why} resolve={resolve} renderLink={routerLink} measure={false} highlight={hl} /> },
    {
      label: LABELS.refs,
      value: refs.length ? (
        <ul role="list" className="m-0 flex list-none flex-col gap-0.5 p-0">
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
  const href = runPath(run.key, { view: JOURNAL_VIEW, entry: e.n });
  const own = `#${e.n}`;
  return (
    <AddressMenu kind="entry" href={href} header={{ text: `${own} · ${e.question}`, title: e.question }}>
      <article
        id={`j${e.n}`}
        tabIndex={-1}
        {...flatItem(e.n)}
        data-entry={e.n}
        aria-labelledby={`j${e.n}-q`}
        data-target={marks["data-target"]}
        data-edge={marks["data-edge"]}
        className={cn("flex flex-col gap-1 rounded-md px-4 py-3 outline-none focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset", marks.className)}
      >
        <p className="m-0 flex items-baseline gap-2 text-xs text-muted-foreground tabular-nums">
          <span>
            <AddressLink kind="entry" id={e.n} href={href} onOpen={() => onOwn(e.n)}>
              {hl(own)}
            </AddressLink>
            {hl(entryHead(e).slice(own.length))}
          </span>
          {outside && <OutOfFilter className="ml-auto" />}
        </p>
        <h3 id={`j${e.n}-q`} className="m-0 text-base font-semibold text-balance break-words">
          <Highlight text={e.question} tokens={toks} />
        </h3>
        <FactList facts={facts} className="mt-1 grid-cols-1 gap-y-0.5 @min-[40rem]/view:grid-cols-[5.5rem_minmax(0,1fr)] @min-[40rem]/view:gap-y-1.5" />
      </article>
    </AddressMenu>
  );
});
