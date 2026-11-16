// «Журнал» (surfaces/reading.md → CHOSEN: the journal as a reading list): what the run decided without the user,
// why, and on what basis. Every entry in `#` order as an article: «#n · этап», the question as its heading (Title),
// then «Решение» leading in ink, «Почему» and «Ссылки» as label–value rows — the labels in a hanging column from
// 40 rem of the view, above their text below it. Search and «Этап» narrow it, the hits marked; new entries wait in
// the strip at its end (Live data); the status bar names the entries in view. A journal that cannot be read fails
// in the list's place (rules/ui → Conventions 14).
//
// An entry's address is `?view=journal&entry=<n>` (the design check): the view scrolls to it, marks it with the
// target mark and moves focus to it; hidden by the filters it shows anyway, «вне фильтра»; still held in the strip,
// it is placed at once.
import { useLayoutEffect, useMemo, useRef, useState, type RefObject } from "react";
import { useSearchParams } from "react-router-dom";
import type { JournalEntry } from "../../../shared/model.ts";
import { stageOf, type Step } from "../../../shared/states.ts";
import { NOUNS } from "../../../shared/text.ts";
import { EmptyState, emptyWhen, FactList, HeldStrip, markProps, NotFound, OutOfFilter, PartFailed, RunningText, type Fact, type HeldNoun } from "@/ui";
import { AdaptiveToolbar, ANY_LABEL, FilterControl, filterSummary, Highlight, hitRanges, isSelectFilter, pushHistory, runQuery, SearchBox, StatusBar, tokens, useRunView, useTableView, type FilterDef, type SearchDef, type ToolbarItem } from "@/table";
import { useNow } from "../../app/clock.tsx";
import { resolverFor, routerLink } from "../../app/links.tsx";
import { useUpdatedAt } from "../../app/live.tsx";
import type { LoadedRun, ViewProps } from "../index.ts";
import { fileFailure, folderFailure } from "./failure.ts";
import { isRef, RefLink } from "./ref-link.tsx";

/** The journal's noun: an entry is one decision of the run (PRODUCT.md → Glossary: журнал решений). */
const DECISION_NOUN = NOUNS.decision;
const NOUN: HeldNoun = { forms: DECISION_NOUN, gender: "n" };
export const JOURNAL_VIEW = "journal";
export const LABELS = { decision: "Решение", why: "Почему", refs: "Ссылки" } as const;
export const ENTRY_NOT_FOUND_NEXT = ": в журнале этого прогона её нет — проверьте ссылку";
/** What failed, when the journal cannot be read: «Журнал решений не прочитан: <причина>». */
export const JOURNAL_PART = "Журнал решений";
/** The CSS highlight the search's hits in running text are painted with (the list's `::highlight` rule). */
const HIT = "journal-hit";

/** «#12 · проход 1 · карта». */
export const entryHead = (e: Pick<JournalEntry, "n" | "stage">): string => `#${e.n} · ${e.stage ? stageOf(e.stage).full : "этап не записан"}`;

export function stageFilter(entries: readonly JournalEntry[]): FilterDef<JournalEntry> {
  const stages = [...new Set(entries.map((e) => e.stage))];
  return { id: "stage", label: "Этап", values: (e) => [e.stage], options: stages.map((s) => ({ value: s, label: stageOf(s).full })), placeholder: "Найти этап" };
}

export const SEARCH: SearchDef<JournalEntry> = {
  identifiers: (e) => [`#${e.n}`, `j${e.n}`, ...e.refs.map((r) => r.id)],
  text: (e) => [e.question, e.decision, e.why, stageOf(e.stage).full],
  placeholder: "Вопрос, решение, ссылка",
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

/** The search's hits in the text under `root` — each a DOM range, for the CSS highlight; the kit's own marks
 * (the question's `Highlight`) are left to themselves. */
export function hitRangesIn(root: Node, toks: readonly string[]): Range[] {
  if (!toks.length) return [];
  const out: Range[] = [];
  const doc = root.ownerDocument ?? document;
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (node.parentElement?.closest("mark[data-slot=hit]")) continue;
    for (const [start, end] of hitRanges(node.textContent ?? "", toks)) {
      const range = doc.createRange();
      range.setStart(node, start);
      range.setEnd(node, end);
      out.push(range);
    }
  }
  return out;
}

export function JournalView({ run }: ViewProps) {
  return <Journal key={run.key} run={run} />;
}

function Journal({ run }: { run: LoadedRun }) {
  const now = useNow();
  const updated = useUpdatedAt();
  const [params] = useSearchParams();
  const [placed, setPlaced] = useState(() => new Set(run.journal.map((e) => e.n)));
  const [arrived, setArrived] = useState<ReadonlySet<string>>(new Set());
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

  // The entry a link names is scrolled to and takes focus, once per link.
  const list = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (!target) return;
    const el = list.current?.querySelector<HTMLElement>(`[data-entry="${target}"]`);
    el?.scrollIntoView({ block: "start" });
    el?.focus({ preventScroll: true });
  }, [target]);

  // The search's hits in the running text, painted by the CSS highlight: the markup stays as it is, so nothing moves.
  const rowsKey = q.rows.map((e) => e.n).join(",");
  useLayoutEffect(() => {
    const registry = typeof CSS !== "undefined" ? CSS.highlights : undefined;
    if (!registry || !list.current) return;
    if (!toks.length) {
      registry.delete(HIT);
      return;
    }
    registry.set(HIT, new window.Highlight(...hitRangesIn(list.current, toks)));
    return () => void registry.delete(HIT);
  }, [toks, rowsKey, run]);

  const toolbar: ToolbarItem[] = [
    { id: "search", kind: "pinned", flex: true, node: <SearchBox value={prefs.search} onChange={(v) => setPrefs({ search: v })} placeholder={SEARCH.placeholder} history={table.history} onCommit={(term) => setTable({ history: pushHistory(table.history, term) })} /> },
    {
      id: "filter-stage",
      kind: "ordinary",
      active: Boolean(prefs.filters.stage?.length),
      values: isSelectFilter(filter as FilterDef<unknown>) ? [ANY_LABEL, ...filter.options.map((o) => o.label)].map((v) => `${filter.label}: ${v}`) : undefined,
      node: <FilterControl def={filter} value={prefs.filters.stage ?? []} counts={q.counts.stage} onChange={(v) => setPrefs({ filters: { ...prefs.filters, stage: v } })} />,
    },
  ];

  const missing = entry !== null && !target ? entry : null;
  const never = emptyWhen(run, FIRST).form === "never";

  return (
    <div data-slot="journal-view" className="absolute inset-0 flex flex-col gap-2 px-5 pt-3 pb-1">
      <AdaptiveToolbar items={toolbar} label="Фильтры журнала" />
      <div ref={list} data-slot="journal-scroll" className="min-h-0 flex-1 overflow-y-auto border-t [scrollbar-gutter:stable]">
        {failure ? (
          <PartFailed what={JOURNAL_PART} cause={failure.cause} className="mt-4" />
        ) : (
          <>
            {missing && (
              <p role="status" data-slot="entry-missing" className="m-0 max-w-measure pt-4">
                <NotFound kind="entry" id={missing} start />
                {ENTRY_NOT_FOUND_NEXT}
              </p>
            )}
            {run.journal.length === 0 ? (
              never ? <EmptyState form="never" noun={DECISION_NOUN} className="py-16" /> : <EmptyState form="not-yet" noun={DECISION_NOUN} step={FIRST} className="py-16" />
            ) : q.rows.length === 0 ? (
              <EmptyState form="filtered" noun={DECISION_NOUN} filters={filterSummary([filter], prefs.filters, prefs.search)} onReset={() => setPrefs({ filters: {}, search: "" })} className="py-16" />
            ) : (
              <ol
                aria-label="Журнал решений"
                className="m-0 flex max-w-[calc(var(--container-measure)+8.5rem)] list-none flex-col p-0 py-2 [&_*::highlight(journal-hit)]:bg-muted [&_*::highlight(journal-hit)]:text-foreground [&_*::highlight(journal-hit)]:underline [&_*::highlight(journal-hit)]:decoration-muted-foreground"
              >
                {q.rows.map((e) => (
                  <li key={e.n} className="border-b last:border-b-0">
                    <Entry entry={e} run={run} resolve={resolve} toks={toks} target={e.n === target} edge={arrived.has(e.n)} outside={q.outside.has(e.n)} />
                  </li>
                ))}
              </ol>
            )}
          </>
        )}
      </div>
      <HeldStrip
        counts={{ fresh, moved: 0, left: 0 }}
        noun={NOUN}
        onApply={() => {
          setArrived(new Set(run.journal.filter((e) => !placed.has(e.n)).map((e) => e.n)));
          setPlaced(new Set(run.journal.map((e) => e.n)));
        }}
      />
      <StatusBar counts={<InView list={list} version={`${run.version}:${rowsKey}`} />} shown={q.matched} total={q.total} noun={DECISION_NOUN} updatedAt={updated === null ? null : new Date(updated).toISOString()} now={now} />
    </div>
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

/** One decision: its head, its question, then «Решение» leading, «Почему», «Ссылки» — a ref each line with its fact. */
function Entry({ entry: e, run, resolve, toks, target, edge, outside }: EntryProps) {
  const refs = e.refs.filter(isRef);
  const marks = markProps({ target, edge });
  const facts: Fact[] = [
    { label: LABELS.decision, value: <RunningText text={e.decision} resolve={resolve} renderLink={routerLink} measure={false} className="font-medium text-foreground" /> },
    { label: LABELS.why, value: <RunningText text={e.why} resolve={resolve} renderLink={routerLink} measure={false} /> },
  ];
  if (refs.length)
    facts.push({
      label: LABELS.refs,
      value: (
        <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
          {refs.map((r, i) => (
            <li key={`${r.id}-${i}`} className="min-w-0">
              <RefLink run={run} refItem={r} />
            </li>
          ))}
        </ul>
      ),
    });
  return (
    <article id={`j${e.n}`} tabIndex={-1} data-entry={e.n} aria-labelledby={`j${e.n}-q`} data-target={marks["data-target"]} data-edge={marks["data-edge"]} className={`flex scroll-mt-2 flex-col gap-1 rounded-md px-4 py-3 outline-none ${marks.className}`}>
      <p className="m-0 flex items-baseline gap-2 text-xs text-muted-foreground tabular-nums">
        <span>{entryHead(e)}</span>
        {outside && <OutOfFilter className="ml-auto" />}
      </p>
      <h3 id={`j${e.n}-q`} className="m-0 text-base font-semibold text-balance break-words">
        <Highlight text={e.question} tokens={toks} />
      </h3>
      <FactList facts={facts} className="mt-1 grid-cols-1 gap-y-0.5 @min-[40rem]/view:grid-cols-[5.5rem_minmax(0,1fr)] @min-[40rem]/view:gap-y-1.5" />
    </article>
  );
}

/** «на экране #40–#42» in the status bar: the entries the list shows, measured before paint and on every scroll and
 * resize; its box is reserved at the widest form («на экране #142–#143», 19 characters), so nothing beside it moves. */
function InView({ list, version }: { list: RefObject<HTMLDivElement | null>; version: string }) {
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
  return (
    <span data-slot="in-view" className="inline-block min-w-[21ch]">
      {inViewText(range)}
    </span>
  );
}
