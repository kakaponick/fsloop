// «Отчёты» (surfaces/reading.md, CHOSEN option 1): a rail of every agent launch of the run, grouped by stage in run
// order, beside a reader of the chosen one — the answer to «Что написал каждый запуск агента этого прогона? Прочитать
// целиком и дойти до источника». With no report chosen the reader's place holds the overview: the surfaces ranked
// by critical + major findings with their scores.
//
// The URL holds the report (`report=`, pushed) and its tab (`tab=`, replaced); search and the filters are the view's
// state in the browser (rules/ui → Conventions 12). Back returns to the same report, tab and scroll. New launches
// wait in the rail's strip (Live data). Below the container width for rail + reading column, the rail folds into an
// «Отчёт» combobox above the reader (ui → Layout Paradigm 2: a container query).
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { NOUNS } from "../../../shared/text.ts";
import { cn } from "@/lib/utils";
import { CountCombobox, EmptyState, emptyWhen, HeldStrip, NotFound, SCROLLER, type HeldNoun } from "@/ui";
import { AdaptiveToolbar, FilterControl, filterSummary, pushHistory, runQuery, SearchBox, StatusBar, useRunView, useTableView, type FilterDef, type ToolbarItem } from "@/table";
import { useNow } from "../../app/clock.tsx";
import { useUpdatedAt } from "../../app/live.tsx";
import { runPath } from "../../app/routes.ts";
import type { LoadedRun, ViewProps } from "../index.ts";
import { filtersFor, groupsOf, heldItems, itemState, pickerLabel, placeItems, railItems, REPORTS_VIEW, resolveItem, SEARCH, type RailItem } from "./model.ts";
import { Overview, Spend } from "./overview.tsx";
import { Rail, RAIL_LABEL } from "./rail.tsx";
import { Reader, reportPath } from "./reader.tsx";

const NOUN: HeldNoun = { forms: NOUNS.report, gender: "m" };
export const REPORT_PICKER = "Отчёт";
/** The picker's no-choice word, the overview the reader then shows: «Отчёт: обзор» — one colon, read once (craft-5). */
export const PICKER_OVERVIEW = "обзор";
export const REPORT_NOT_FOUND_NEXT = ": в этом прогоне нет такого запуска — выберите отчёт в списке";

/** Where the reader stood per run, report and tab: Back returns there (rules/ui → Layout 2). */
const scrolls = new Map<string, number>();

/** Why the view is empty before any filter: a closed or init run never had launches; an open one names the map. */
export function emptyFor(run: Pick<LoadedRun, "closed" | "mode">): "never" | "not-yet" {
  return emptyWhen(run, "map").form;
}

export function ReportsView({ run }: ViewProps) {
  // a run of its own: the held order and the scroll never cross to another run
  return <Reports key={run.key} run={run} />;
}

function Reports({ run }: { run: LoadedRun }) {
  const now = useNow();
  const updated = useUpdatedAt();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const items = useMemo(() => railItems(run), [run]);
  const [held, setHeld] = useState(() => placeItems(items));
  const { shown, fresh, moved } = heldItems(held, items);

  // ── the filters, over the placed rail ──────────────────────────────────────────────────────────
  const filters = useMemo(() => filtersFor(items, run), [items, run]);
  const defs: FilterDef<RailItem>[] = [filters.agent, filters.lens, filters.surface];
  const [prefs, setPrefs] = useRunView(REPORTS_VIEW, run.key);
  const [table, setTable] = useTableView(REPORTS_VIEW);
  const reportId = params.get("report");
  const tab = params.get("tab");
  const item = resolveItem(reportId, items, held.known);
  const q = runQuery({
    rows: shown.map((s) => s.item),
    rowId: (i) => i.id,
    columns: [],
    filters: defs,
    search: SEARCH,
    state: { sort: null, filters: prefs.filters, search: prefs.search },
    include: item ? new Set([item.id]) : undefined,
  });
  const kept = new Set(q.rows.map((i) => i.id));
  const railShown = shown.filter((s) => kept.has(s.item.id));
  const ended = new Set(railShown.filter((s) => s.ended).map((s) => s.item.id));

  const hrefOf = (id: string) => runPath(run.key, { view: "reports", report: id });
  // the previous and the next report of the list as the user sees it — filtered, held, under its stage headings
  // (p1-review cand-6)
  const order = groupsOf(railShown.map((s) => s.item)).flatMap((g) => g.items.map((i) => i.id));
  const at = item ? order.indexOf(item.id) : -1;
  const pathOf = (id: string) => {
    const l = run.launches.find((x) => x.id === id);
    return l?.report ? reportPath(run.dir, l.report) : null;
  };

  // ── the reader's scroll, per report and tab ─────────────────────────────────────────────────────
  const reader = useRef<HTMLDivElement>(null);
  const place = `${run.key}|${reportId ?? ""}|${tab ?? ""}`;
  const lastReport = useRef(reportId);
  useLayoutEffect(() => {
    const el = reader.current;
    if (!el) return;
    const saved = scrolls.get(place);
    const sameReport = lastReport.current === reportId;
    lastReport.current = reportId;
    if (saved !== undefined || !sameReport) {
      el.scrollTop = saved ?? 0;
      return;
    }
    // a section opened for the first time while the strip is pinned: the strip stays where it is and the new
    // section starts right under it, instead of the reader jumping back to the facts
    const sections = el.querySelector<HTMLElement>("[data-slot=report-sections]");
    const top = sections ? sections.getBoundingClientRect().top - el.getBoundingClientRect().top + el.scrollTop : 0;
    el.scrollTop = Math.min(el.scrollTop, Math.max(0, top));
  }, [place, reportId]);
  const onTab = (next: string) =>
    setParams(
      (prev) => {
        const p = new URLSearchParams(prev);
        p.set("tab", next);
        return p;
      },
      { replace: true },
    );

  const toolbar: ToolbarItem[] = [
    {
      id: "search",
      kind: "pinned",
      flex: true,
      node: <SearchBox value={prefs.search} onChange={(v) => setPrefs({ search: v })} placeholder={SEARCH.placeholder} history={table.history} onCommit={(term) => setTable({ history: pushHistory(table.history, term) })} />,
    },
    // a filter's trigger hugs the value the user picked: its change is the user's own (ui → Widths; f9)
    ...defs.map<ToolbarItem>((f) => ({
      id: `filter-${f.id}`,
      kind: "ordinary",
      active: Boolean(prefs.filters[f.id]?.length),
      node: <FilterControl def={f} value={prefs.filters[f.id] ?? []} counts={q.counts[f.id]} onChange={(v) => setPrefs({ filters: { ...prefs.filters, [f.id]: v } })} />,
    })),
    // cand-4: below the width for rail + reading column the rail folds into this picker, in the toolbar's line — no
    // line of its own; each option names what the rail shows of its report: the stage heading and the state. Wide, it
    // takes no room; narrow, the filters fold into «…» before it does.
    {
      id: "report-picker",
      kind: "sticky",
      node: (
        <CountCombobox
          label={REPORT_PICKER}
          single
          value={item ? [item.id] : []}
          onValueChange={(v) => navigate(v[0] ? hrefOf(v[0]) : runPath(run.key, { view: "reports" }))}
          // the closed trigger names the report alone; its stage and state are the reader's, right under it (craft-4)
          options={groupsOf(railShown.map((s) => s.item)).flatMap((g) => g.items.map((i) => ({ value: i.id, label: pickerLabel(i, itemState(i, run.findings, now, { ended: ended.has(i.id) })), short: i.description })))}
          placeholder="Найти отчёт"
          anyLabel={PICKER_OVERVIEW}
          className="@min-[52rem]/reports:hidden"
        />
      ),
    },
  ];

  const empty = items.length === 0 && shown.length === 0;
  const filteredOut = !empty && q.matched === 0;
  const arrived = new Set(held.arrived);

  return (
    <div data-slot="reports-view" className="@container/reports absolute inset-0 flex flex-col gap-2 px-5 pt-3 pb-1">
      <AdaptiveToolbar items={toolbar} label="Фильтры отчётов" />
      <div className="flex min-h-0 flex-1 border-t">
        <nav aria-label={RAIL_LABEL} data-slot="report-rail" className="hidden w-60 shrink-0 flex-col border-r @min-[52rem]/reports:flex">
          {/* each scroller is the containing block of everything in it (`SCROLLER`): a finding row's sr-only never
              hangs below the view to give the page's body an overflow (craft-1) */}
          <div data-slot="rail-scroll" className={cn(SCROLLER, "flex-1 py-1 pr-1")}>
            <Rail
              items={railShown}
              outside={q.outside}
              findings={run.findings}
              current={item?.id ?? null}
              arrived={arrived}
              hrefOf={hrefOf}
              overviewHref={runPath(run.key, { view: "reports" })}
              pathOf={pathOf}
              now={now}
              empty={filteredOut ? <EmptyState form="filtered" noun={NOUNS.report} filters={filterSummary(defs, prefs.filters, prefs.search)} onReset={() => setPrefs({ filters: {}, search: "" })} className="px-2 py-8" /> : undefined}
            />
          </div>
          <HeldStrip counts={{ fresh, moved, left: 0 }} noun={NOUN} onApply={() => setHeld(placeItems(items, held))} />
        </nav>
        <div className="flex min-w-0 flex-1 flex-col">
          <div
            ref={reader}
            data-slot="report-reader-scroll"
            onScroll={(e) => scrolls.set(place, e.currentTarget.scrollTop)}
            className={cn(SCROLLER, "flex-1 py-4 pl-6 @max-[52rem]/reports:pl-0")}
          >
            {empty ? (
              emptyFor(run) === "never" ? (
                <EmptyState form="never" noun={NOUNS.report} className="py-16" />
              ) : (
                <EmptyState form="not-yet" noun={NOUNS.report} step="map" className="py-16" />
              )
            ) : item ? (
              <Reader key={item.id} run={run} item={item} tab={tab} onTab={onTab} prev={order[at - 1] ?? null} next={at < 0 ? null : (order[at + 1] ?? null)} hrefOf={hrefOf} now={now} />
            ) : (
              <div className="flex flex-col gap-6">
                {reportId && (
                  <p role="status" data-slot="report-missing" className="m-0">
                    <NotFound kind="report" id={reportId} start />
                    {REPORT_NOT_FOUND_NEXT}
                  </p>
                )}
                <Overview surfaces={run.surfaces} findings={run.findings} hrefOf={(launch) => (run.launches.some((l) => l.id === launch) ? hrefOf(launch) : null)} />
                <Spend tokens={run.tokens} />
              </div>
            )}
          </div>
        </div>
      </div>
      {/* the total is the run's one launch count, the tab's number (Conventions 3); a launch still in the strip is
          counted there and not yet shown */}
      <StatusBar shown={q.matched} total={run.launchCount} noun={NOUNS.launch} updatedAt={updated === null ? null : new Date(updated).toISOString()} now={now} />
    </div>
  );
}
