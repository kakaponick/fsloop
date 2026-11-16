// «Находки» (surfaces/findings.md, CHOSEN A): every finding of the run from every source in one flat table under the
// full table contract — «Вид», search, filters with counts, sort, pages, selection, the row menu — each row
// expanding in place into its article with the user's verdict. The answer to «Что нашли критики этого прогона, что
// прогон решил по каждой находке и с чем я не согласен?».
//
// The URL holds the open finding (`finding=`) and the page (`page=`), replaced on expand and paging; filters,
// search and sort are the table's view state in the browser (rules/ui → Conventions 12). A link to a finding opens
// its page, expands, scrolls to and marks it, «вне фильтра» when the filters hide it.
import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import type { Finding, Run } from "../../../shared/model.ts";
import { stageOf, type Step } from "../../../shared/states.ts";
import { NOUNS } from "../../../shared/text.ts";
import { emptyWhen, NotFound, STEPS, type HeldNoun } from "@/ui";
import { copyAction, DataTable, type EmptyWhen, type RowAction } from "@/table";
// From the files, not the index: the index reaches the app's links, which reach this view (a cycle at load time).
import { FindingArticle } from "@/finding/article.tsx";
import { stateUnit } from "@/finding/cells.tsx";
import { FINDINGS_TABLE } from "@/finding/facets.ts";
import { NOT_FOUND_NEXT, RATE_ACTION } from "@/finding/words.ts";
import { useNow } from "../../app/clock.tsx";
import { objectHref } from "../../app/links.tsx";
import { useUpdatedAt } from "../../app/live.tsx";
import { runPath } from "../../app/routes.ts";
import type { LoadedRun, ViewProps } from "../index.ts";
import { COLUMNS } from "./columns.tsx";
import { useEdgeMarks } from "./marks.ts";
import { DEFAULT_SORT, filtersFor, PRESETS, SEARCH } from "./query.ts";
import { FindingVerdict, useVerdicts, VerdictDialog, type Verdicts } from "./verdict.tsx";

const NOUN: HeldNoun = { forms: NOUNS.finding, gender: "f" };
const rowId = (f: Finding) => f.id;
const rowTitle = (f: Finding) => `${f.id} — ${f.summary}`;

/** The stages whose critics write findings, in a pass's order. */
const CRITIC_STEPS: readonly Step[] = ["map", "decompose", "review", "assess"];

/** The stage that will bring the first findings: the next one, from where the run stands, whose critics report. */
export function nextCriticStep(stage: string | null | undefined): Step {
  const at = STEPS.indexOf(stageOf(stage).step ?? "init");
  return CRITIC_STEPS.find((s) => STEPS.indexOf(s) >= at) ?? "review";
}

export const EMPTY_LEAD = "Критики ещё не писали отчётов";

/** Why the table is empty before any filter: a closed or init run never had findings; an open one names the stage. */
export function emptyFor(run: Pick<Run, "closed" | "mode" | "now">): EmptyWhen {
  const when = emptyWhen(run, nextCriticStep(run.now?.stage));
  return when.form === "never" ? when : { ...when, lead: EMPTY_LEAD, subject: "находки" };
}

export function FindingsView({ run }: ViewProps) {
  // a run of its own: the open rows, the verdicts on their way and the held order never cross to another run
  return <Findings key={run.key} run={run} />;
}

function Findings({ run }: { run: LoadedRun }) {
  const now = useNow();
  const updated = useUpdatedAt();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const verdicts = useVerdicts(run.key, now);
  const edge = useEdgeMarks(run.version, run.findings, now);

  // ── the rows: the run's findings with the user's newest verdicts laid over ─────────────────────
  const rows = useMemo(
    () =>
      run.findings.map((f) => {
        const v = verdicts.of(f);
        return v === f.verdict ? f : { ...f, verdict: v };
      }),
    // `verdicts.version` moves whenever a shown verdict does
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [run.findings, verdicts.version],
  );
  const filters = useMemo(() => filtersFor(run), [run]);
  const empty = useMemo(() => emptyFor(run), [run]);

  // ── the URL: the open finding and the page ─────────────────────────────────────────────────────
  const param = params.get("finding");
  const holds = (id: string | null): id is string => id !== null && run.findings.some((f) => f.id === id);
  const [link, setLink] = useState(() => ({ param, target: holds(param) ? param : null }));
  const [written, setWritten] = useState<string | null>(null);
  const [open, setOpen] = useState<string[]>(() => (holds(param) ? [param] : []));
  if (param !== link.param) {
    // a link from elsewhere opens its finding; the param this view wrote on an expand is only remembered
    if (param !== written) {
      setLink({ param, target: holds(param) ? param : null });
      if (holds(param) && !open.includes(param)) setOpen([...open, param]);
    } else setLink({ ...link, param });
  }
  const replace = (patch: Record<string, string | null>) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        for (const [k, v] of Object.entries(patch)) {
          if (v) next.set(k, v);
          else next.delete(k);
        }
        return next;
      },
      { replace: true },
    );
  const onOpenChange = (ids: string[]) => {
    setOpen(ids);
    const last = ids.at(-1) ?? null;
    setWritten(last);
    replace({ finding: last });
  };
  const page = Number(params.get("page")) || 1;
  const onPageChange = (p: number) => replace({ page: p > 1 ? String(p) : null });

  // ── the row menu (table #4) and the verdict dialog ─────────────────────────────────────────────
  const [rating, setRating] = useState<readonly string[] | null>(null);
  const actions = useMemo<RowAction<Finding>[]>(
    () => [
      { id: "rate", label: RATE_ACTION, scope: "both", group: 1, run: (rs) => setRating(rs.map(rowId)) },
      copyAction<Finding>("copy-link", "ссылку", (f) => `${window.location.origin}${runPath(run.key, { view: "findings", finding: f.id })}`, "single", 2),
      copyAction<Finding>("copy-id", "id", (f) => f.id, "both", 2),
      // an item whose object the rows can never have is not listed (table #4; rules/ui → Scope: no disabled action)
      { ...copyAction<Finding>("copy-location", "место", (f) => f.location, "both", 2), hidden: (rs) => rs.every((f) => !f.location) },
      {
        id: "open-report",
        label: "Открыть отчёт",
        scope: "single",
        group: 3,
        hidden: (rs) => !rs[0]?.launch,
        run: (rs) => {
          const href = rs[0]?.launch ? objectHref(run, { kind: "report", id: rs[0].launch }) : null;
          if (href) navigate(href);
        },
      },
      {
        id: "open-unit",
        label: (rs) => (rs[0] && stateUnit(rs[0]) ? `Открыть юнит ${stateUnit(rs[0])}` : "Открыть юнит"),
        scope: "single",
        group: 3,
        hidden: (rs) => !rs[0] || !stateUnit(rs[0]),
        run: (rs) => {
          const unit = rs[0] ? stateUnit(rs[0]) : null;
          const href = unit ? objectHref(run, { kind: "unit", id: unit }) : null;
          if (href) navigate(href);
        },
      },
    ],
    [run, navigate],
  );
  const ratingRows = useMemo(() => (rating ? rows.filter((r) => rating.includes(r.id)) : null), [rating, rows]);

  const missing = param !== null && !holds(param) ? param : null;

  return (
    <div data-slot="findings-view" className="absolute inset-0 flex flex-col gap-2 px-5 pt-3 pb-1">
      {missing && (
        <p role="status" data-slot="finding-missing" className="m-0 shrink-0">
          <NotFound kind="finding" id={missing} start />
          {NOT_FOUND_NEXT}
        </p>
      )}
      <DataTable<Finding>
        id={FINDINGS_TABLE}
        runKey={run.key}
        label={`Находки прогона ${run.id}`}
        rows={rows}
        rowId={rowId}
        rowTitle={rowTitle}
        noun={NOUN}
        columns={COLUMNS}
        filters={filters}
        presets={PRESETS}
        search={SEARCH}
        actions={actions}
        detail={(f) => <FindingDetail run={run} finding={f} verdicts={verdicts} now={now} />}
        defaultSort={DEFAULT_SORT}
        empty={empty}
        page={page}
        onPageChange={onPageChange}
        open={open}
        onOpenChange={onOpenChange}
        target={link.target}
        marks={(f) => ({ edge: edge(f.id) })}
        updatedAt={updated === null ? null : new Date(updated).toISOString()}
        now={now}
        className="min-h-0 flex-1"
      />
      <VerdictDialog rows={ratingRows} verdicts={verdicts} now={now} onClose={() => setRating(null)} />
    </div>
  );
}

function FindingDetail({ run, finding, verdicts, now }: { run: LoadedRun; finding: Finding; verdicts: Verdicts; now: number }) {
  return <FindingArticle run={run} finding={finding} now={now} inRow verdict={<FindingVerdict finding={finding} verdicts={verdicts} now={now} />} />;
}
