// «Журнал» (surfaces/reading.md → CHOSEN: the journal as a reading list): what the run decided without the user,
// why, and on what basis. Every entry in `#` order as an article at the reading measure — «#n · этап», the question
// as its heading, «Решение» and «Почему» as running text, «Ссылки» to the objects it rests on. Search and «Этап»
// narrow it; new entries wait in the strip at its end (Live data).
//
// An entry's address is `?view=journal&entry=<n>` (the design check): the view scrolls to it and marks it with the
// target mark; hidden by the filters it shows anyway, «вне фильтра».
import { useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import type { JournalEntry } from "../../../shared/model.ts";
import { stageOf, type Step } from "../../../shared/states.ts";
import { NOUNS } from "../../../shared/text.ts";
import { EmptyState, HeldStrip, markProps, NotFound, OutOfFilter, RunningText, type HeldNoun } from "@/ui";
import { AdaptiveToolbar, ANY_LABEL, FilterControl, filterSummary, isSelectFilter, pushHistory, runQuery, SearchBox, StatusBar, useRunView, useTableView, type FilterDef, type SearchDef, type ToolbarItem } from "@/table";
import { useNow } from "../../app/clock.tsx";
import { resolverFor, routerLink } from "../../app/links.tsx";
import { useUpdatedAt } from "../../app/live.tsx";
import type { LoadedRun, ViewProps } from "../index.ts";
import { isRef, RefLink } from "./ref-link.tsx";

/** The journal's noun: an entry is one decision of the run (PRODUCT.md → Glossary: журнал решений). */
const DECISION_NOUN = NOUNS.decision;
const NOUN: HeldNoun = { forms: DECISION_NOUN, gender: "n" };
export const JOURNAL_VIEW = "journal";
export const LABELS = { decision: "Решение", why: "Почему", refs: "Ссылки" } as const;
export const ENTRY_NOT_FOUND_NEXT = ": в журнале этого прогона её нет — проверьте ссылку";

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

export function JournalView({ run }: ViewProps) {
  return <Journal key={run.key} run={run} />;
}

function Journal({ run }: { run: LoadedRun }) {
  const now = useNow();
  const updated = useUpdatedAt();
  const [params] = useSearchParams();
  const [placed, setPlaced] = useState(() => new Set(run.journal.map((e) => e.n)));
  const [arrived, setArrived] = useState<ReadonlySet<string>>(new Set());
  const shown = run.journal.filter((e) => placed.has(e.n));
  const fresh = run.journal.length - shown.length;

  const filter = useMemo(() => stageFilter(run.journal), [run.journal]);
  const [prefs, setPrefs] = useRunView(JOURNAL_VIEW, run.key);
  const [table, setTable] = useTableView(JOURNAL_VIEW);
  const entry = params.get("entry");
  const target = entry !== null && run.journal.some((e) => e.n === entry) ? entry : null;
  const q = runQuery({ rows: shown, rowId: (e) => e.n, columns: [], filters: [filter], search: SEARCH, state: { sort: null, filters: prefs.filters, search: prefs.search }, include: target ? new Set([target]) : undefined });
  const resolve = useMemo(() => resolverFor(run), [run]);

  // The entry a link names is scrolled to, once per link.
  const list = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (!target) return;
    list.current?.querySelector<HTMLElement>(`[data-entry="${target}"]`)?.scrollIntoView({ block: "start" });
  }, [target]);

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
  const never = run.closed || run.mode === "init";

  return (
    <div data-slot="journal-view" className="absolute inset-0 flex flex-col gap-2 px-5 pt-3 pb-1">
      <AdaptiveToolbar items={toolbar} label="Фильтры журнала" />
      <div ref={list} data-slot="journal-scroll" className="min-h-0 flex-1 overflow-y-auto border-t [scrollbar-gutter:stable]">
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
          <ol aria-label="Журнал решений" className="m-0 flex max-w-[calc(var(--container-measure)+2rem)] list-none flex-col p-0 py-2">
            {q.rows.map((e) => {
              const refs = e.refs.filter(isRef);
              const marks = markProps({ target: e.n === target, edge: arrived.has(e.n) });
              return (
                <li key={e.n} className="border-b last:border-b-0">
                  <article id={`j${e.n}`} data-entry={e.n} aria-labelledby={`j${e.n}-q`} data-target={marks["data-target"]} data-edge={marks["data-edge"]} className={`flex scroll-mt-2 flex-col gap-2 rounded-md px-4 py-4 ${marks.className}`}>
                    <p className="m-0 flex items-baseline gap-2 text-xs text-muted-foreground tabular-nums">
                      <span>{entryHead(e)}</span>
                      {q.outside.has(e.n) && <OutOfFilter className="ml-auto" />}
                    </p>
                    <h3 id={`j${e.n}-q`} className="m-0 text-base font-semibold break-words">
                      {e.question}
                    </h3>
                    <Block label={LABELS.decision}>
                      <RunningText text={e.decision} resolve={resolve} renderLink={routerLink} measure={false} />
                    </Block>
                    <Block label={LABELS.why}>
                      <RunningText text={e.why} resolve={resolve} renderLink={routerLink} measure={false} />
                    </Block>
                    {refs.length > 0 && (
                      <Block label={LABELS.refs}>
                        <ul className="m-0 flex list-none flex-wrap gap-x-4 gap-y-1 p-0">
                          {refs.map((r, i) => (
                            <li key={`${r.id}-${i}`} className="min-w-0">
                              <RefLink run={run} refItem={r} />
                            </li>
                          ))}
                        </ul>
                      </Block>
                    )}
                  </article>
                </li>
              );
            })}
          </ol>
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
      <StatusBar shown={q.matched} total={q.total} noun={DECISION_NOUN} updatedAt={updated === null ? null : new Date(updated).toISOString()} now={now} />
    </div>
  );
}

function Block({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section aria-label={label} className="flex min-w-0 flex-col gap-0.5">
      <h4 className="m-0 text-xs font-normal text-muted-foreground">{label}</h4>
      {children}
    </section>
  );
}
