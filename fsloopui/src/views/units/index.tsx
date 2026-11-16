// «Юниты» (surfaces/units.md, CHOSEN A): every unit of the run in one table under the full table contract — the
// state and pass filters, search, sort, selection, the row menu — each row expanding in place into the unit's facts,
// the findings it closes, its agent launches and its checks. The answer to «Что прогон делает сейчас и что уже
// сделал». The distribution by state is the status bar's counts strip; the findings no unit takes are two toolbar
// facts that open «Находки» — never rows of this table.
//
// The URL holds the open unit (`unit=`), replaced on expand; filters, search and sort are the table's view state in
// the browser (rules/ui → Conventions 12). A link to a unit expands, scrolls to and marks it, «вне фильтра» when the
// filters hide it.
import { useMemo, useState, type ReactNode } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { UNIT_STATE, type UnitState } from "../../../shared/states.ts";
import { NOUNS } from "../../../shared/text.ts";
import { CountLink, Dot, NotFound, type HeldNoun } from "@/ui";
import { copyAction, DataTable, type RowAction } from "@/table";
// From the files, not the index: the index reaches the app's links, which reach this view (a cycle at load time).
import { countFindings, type FindingFilter } from "@/finding/facets.ts";
import { openFindings } from "@/finding/open.ts";
import { useNow } from "../../app/clock.tsx";
import { useUpdatedAt } from "../../app/live.tsx";
import { runPath } from "../../app/routes.ts";
import type { LoadedRun, ViewProps } from "../index.ts";
import { COLUMNS } from "./columns.tsx";
import { UnitDetail } from "./detail.tsx";
import { useUnitMarks } from "./marks.ts";
import { checksOf, DEFAULT_SORT, emptyFor, filtersFor, SEARCH, statesOf, unitRows, unitsFailure, UNITS_TABLE, type UnitRow } from "./query.ts";
import {
  CANDIDATES,
  CANDIDATES_TITLE,
  CANDIDATES_WIDEST,
  NO_BRIEF,
  NO_COMMIT,
  NO_FINDINGS,
  NO_TREE,
  NOT_FOUND_NEXT,
  OPEN_FINDINGS,
  tableLabel,
  UNDECIDED,
  UNDECIDED_TITLE,
  UNDECIDED_WIDEST,
  UNITS_PART,
} from "./words.ts";

const NOUN: HeldNoun = { forms: NOUNS.unit, gender: "m" };
const rowId = (u: UnitRow) => u.id;
const rowTitle = (u: UnitRow) => `${u.id} — ${u.title}`;

export function UnitsView({ run }: ViewProps) {
  // a run of its own: the open rows and the held order never cross to another run
  return <Units key={run.key} run={run} />;
}

/** The slices of «Находки» the toolbar facts open: what no unit takes (surfaces/units.md → ACTIONS). */
export const CANDIDATE_FILTER: FindingFilter = { state: ["candidate"] };
export const UNDECIDED_FILTER: FindingFilter = { state: ["undecided"] };

/** A toolbar fact whose box is reserved at its widest three-digit form, so a live count never moves the line
 * (rules/ui → Strict 1): the widest form sits invisible under the shown one in one grid cell. */
function Fact({ widest, title, children }: { widest: string; title: string; children: ReactNode }) {
  return (
    <span data-slot="toolbar-fact" title={title} className="inline-grid justify-items-end text-sm whitespace-nowrap">
      <span aria-hidden="true" data-slot="fact-reserve" className="invisible col-start-1 row-start-1 inline-flex items-center gap-1.5 tabular-nums">
        <Dot tone="neutral" />
        {widest}
      </span>
      <span className="col-start-1 row-start-1">{children}</span>
    </span>
  );
}

function ToolbarFacts({ run }: { run: LoadedRun }) {
  const navigate = useNavigate();
  const candidates = countFindings(run.findings, CANDIDATE_FILTER);
  const undecided = countFindings(run.findings, UNDECIDED_FILTER);
  const href = runPath(run.key, { view: "findings" });
  return (
    <span data-slot="toolbar-facts" className="flex items-center gap-4">
      <Fact widest={CANDIDATES_WIDEST} title={CANDIDATES_TITLE}>
        <CountLink count={candidates} noun={CANDIDATES} tone="neutral" href={href} onOpen={() => openFindings(run.key, CANDIDATE_FILTER, navigate)} />
      </Fact>
      <Fact widest={UNDECIDED_WIDEST} title={UNDECIDED_TITLE}>
        <CountLink count={undecided} noun={NOUNS.finding} suffix={UNDECIDED} tone="neutral" href={href} onOpen={() => openFindings(run.key, UNDECIDED_FILTER, navigate)} />
      </Fact>
    </span>
  );
}

/** The counts strip (table #8): a dot, the state and its count for every state the run's units are in, each count in
 * a three-digit box; a state the filters leave empty reads a muted 0, so the strip keeps its entries. */
function UnitCounts({ rows, states }: { rows: readonly UnitRow[]; states: readonly UnitState[] }) {
  const by = new Map<UnitState, number>();
  for (const r of rows) by.set(r.state, (by.get(r.state) ?? 0) + 1);
  return states.map((s) => {
    const n = by.get(s) ?? 0;
    return (
      <span key={s} data-slot="state-count" className="inline-flex items-center gap-1.5">
        <Dot tone={n ? UNIT_STATE[s].tone : "neutral"} />
        {UNIT_STATE[s].compact}
        <span className={n ? "inline-block min-w-count text-foreground tabular-nums" : "inline-block min-w-count tabular-nums"}>{n}</span>
      </span>
    );
  });
}

function Units({ run }: { run: LoadedRun }) {
  const now = useNow();
  const updated = useUpdatedAt();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const edge = useUnitMarks(run.version, run.units, now);

  const rows = useMemo(() => unitRows(run), [run]);
  const filters = useMemo(() => filtersFor(run), [run]);
  const empty = useMemo(() => emptyFor(run), [run]);
  const states = useMemo(() => statesOf(run.units), [run.units]);
  const failure = unitsFailure(run);

  // ── the URL: the open unit ─────────────────────────────────────────────────────────────────────
  const param = params.get("unit");
  const holds = (id: string | null): id is string => id !== null && run.units.some((u) => u.id === id);
  const [link, setLink] = useState(() => ({ param, target: holds(param) ? param : null }));
  const [written, setWritten] = useState<string | null>(null);
  const [open, setOpen] = useState<string[]>(() => (holds(param) ? [param] : []));
  if (param !== link.param) {
    // a link from elsewhere opens its unit; the param this view wrote on an expand is only remembered
    if (param !== written) {
      setLink({ param, target: holds(param) ? param : null });
      if (holds(param) && !open.includes(param)) setOpen([...open, param]);
    } else setLink({ ...link, param });
  }
  const onOpenChange = (ids: string[]) => {
    setOpen(ids);
    const last = ids.at(-1) ?? null;
    setWritten(last);
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (last) next.set("unit", last);
        else next.delete("unit");
        return next;
      },
      { replace: true },
    );
  };

  // ── the row menu (table #4; the design check's items) ──────────────────────────────────────────
  const actions = useMemo<RowAction<UnitRow>[]>(
    () => [
      {
        id: "open-findings",
        label: OPEN_FINDINGS,
        scope: "single",
        group: 1,
        blocked: (rs) => (rs[0] && countFindings(run.findings, { unit: [rs[0].id] }) > 0 ? undefined : NO_FINDINGS),
        run: (rs) => {
          if (rs[0]) openFindings(run.key, { unit: [rs[0].id] }, navigate);
        },
      },
      copyAction<UnitRow>("copy-id", "id", (u) => u.id, "both", 2),
      { ...copyAction<UnitRow>("copy-sha", "коммит", (u) => u.sha, "both", 2), blocked: (rs) => (rs.every((u) => !u.sha) ? NO_COMMIT : undefined) },
      { ...copyAction<UnitRow>("copy-brief", "путь брифа", (u) => u.brief, "both", 2), blocked: (rs) => (rs.every((u) => !u.brief) ? NO_BRIEF : undefined) },
      { ...copyAction<UnitRow>("copy-tree", "рабочую копию", (u) => u.tree, "both", 2), blocked: (rs) => (rs.every((u) => !u.tree) ? NO_TREE : undefined) },
    ],
    [run, navigate],
  );

  const missing = param !== null && !holds(param) ? param : null;

  return (
    <div data-slot="units-view" className="absolute inset-0 flex flex-col gap-2 px-5 pt-3 pb-1">
      {missing && (
        <p role="status" data-slot="unit-missing" className="m-0 shrink-0">
          <NotFound kind="unit" id={missing} start />
          {NOT_FOUND_NEXT}
        </p>
      )}
      <DataTable<UnitRow>
        id={UNITS_TABLE}
        runKey={run.key}
        label={tableLabel(run.id)}
        rows={rows}
        failed={failure ? { what: UNITS_PART, cause: failure.cause } : null}
        rowId={rowId}
        rowTitle={rowTitle}
        noun={NOUN}
        columns={COLUMNS}
        filters={filters}
        search={SEARCH}
        actions={actions}
        detail={(u) => <UnitDetail run={run} unit={u} checks={checksOf(u)} now={now} />}
        defaultSort={DEFAULT_SORT}
        defaultPaged={false}
        empty={empty}
        counts={(kept) => <UnitCounts rows={kept} states={states} />}
        toolbarEnd={<ToolbarFacts run={run} />}
        open={open}
        onOpenChange={onOpenChange}
        target={link.target}
        marks={(u) => ({ edge: edge(u.id) })}
        updatedAt={updated === null ? null : new Date(updated).toISOString()}
        now={now}
        className="min-h-0 flex-1"
      />
    </div>
  );
}
