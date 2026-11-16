// «Находки» (surfaces/findings.md, CHOSEN A): every finding of the run from every source in one flat table under the
// full table contract — «Вид», search, filters with counts, sort, pages, selection, the row menu — each row
// expanding in place into its article with the user's verdict. The answer to «Что нашли критики этого прогона, что
// прогон решил по каждой находке и с чем я не согласен?».
//
// The URL holds the open finding (`finding=`) and the page (`page=`), replaced on expand and paging; filters,
// search and sort are the table's view state in the browser (rules/ui → Conventions 12). A link to a finding opens
// its page, expands, scrolls to and marks it, «вне фильтра» when the filters hide it.
//
// The reading pace (improve-14): keys 1–4 set the verdict of the finding in focus — its row, or anything in its
// detail — and move on to the next finding without a verdict that the filters keep: on the page, else on the pages
// after it, else from the first page; its detail opened in place of the rated one's when that was open. With none left,
// the rated finding's detail says so on its verdict line. «Свернуть все находки» — the table kit's part — in the
// toolbar's right cluster closes every detail, blocked, with its reason, while none is open.
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import type { Finding, Run } from "../../../shared/model.ts";
import { stageOf, STEPS, type Step, type Verdict } from "../../../shared/states.ts";
import { NOUNS } from "../../../shared/text.ts";
import { emptyWhen, MissingLine, PLACE_WHAT, type HeldNoun } from "@/ui";
import { copyAction, DataTable, revealRow, type EmptyWhen, type RowAction, type TableNotice } from "@/table";
// From the files, not the index: the index reaches the app's links, which reach this view (a cycle at load time).
import { FindingArticle } from "@/finding/article.tsx";
import { stateUnit } from "@/finding/cells.tsx";
import { FINDINGS_TABLE } from "@/finding/facets.ts";
import { RATE_ACTION } from "@/finding/words.ts";
import { useNow } from "../../app/clock.tsx";
import { objectHref } from "../../app/links.tsx";
import { useUpdatedAt } from "../../app/live.tsx";
import { runPath } from "../../app/routes.ts";
import type { LoadedRun, ViewProps } from "../index.ts";
import { COLUMNS } from "./columns.tsx";
import { useFindingMarks } from "./marks.ts";
import { DEFAULT_SORT, filtersFor, PRESETS, SEARCH } from "./query.ts";
import { FindingVerdict, useVerdictKeys, useVerdicts, VerdictDialog, type Verdicts } from "./verdict.tsx";

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

/** «Свернуть все находки» while no row is open: the kit's one reason (`src/table/collapse-all.tsx`). */
export { COLLAPSE_BLOCKED } from "@/table";

/** The rows' noun after «Свернуть все». */
const COLLAPSE_WHAT = "находки";

/** Why the table is empty before any filter: a closed or init run never had findings; an open one names the stage. */
export function emptyFor(run: Pick<Run, "closed" | "mode" | "now">): EmptyWhen {
  const when = emptyWhen(run, nextCriticStep(run.now?.stage));
  return when.form === "never" ? when : { ...when, lead: EMPTY_LEAD, subject: "находки" };
}

/** The rows of the table's current page, first to last. */
const pageRows = (host: HTMLElement): HTMLElement[] => [...host.querySelectorAll<HTMLElement>("tr[data-row-id]")];
const idOf = (tr: HTMLElement): string => tr.dataset.rowId ?? "";

/** A page turn the keys asked for, settled once the table shows the asked page: the rated finding and whether its
 * detail was open, the page asked, the rows of the page before it, the page the key was pressed on, and whether the
 * walk went past the last page and on from the first. */
interface Walk {
  from: string;
  open: boolean;
  page: number;
  seen: readonly string[];
  start: number;
  wrapped: boolean;
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
  const edge = useFindingMarks(run.version, run.findings, now);
  const root = useRef<HTMLDivElement | null>(null);

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
  /** The finding a key rated when none was left without a verdict: its line says the list is rated (improve-14). */
  const [listRated, setListRated] = useState<string | null>(null);
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
    if (listRated && !ids.includes(listRated)) setListRated(null);
    const last = ids.at(-1) ?? null;
    setWritten(last);
    replace({ finding: last });
  };
  const page = Number(params.get("page")) || 1;
  const onPageChange = (p: number) => replace({ page: p > 1 ? String(p) : null });

  // ── the reading pace: a verdict by its key, then the next finding without one (cand-4, improve-14) ──────
  // the findings the table shows, on any page, that have no verdict yet — the ids the kit hands over, so «none left»
  // means none in the list the user reads, and a new one waiting in the strip is not counted (code-1)
  const [shown, setShown] = useState<readonly string[]>([]);
  const left = useMemo(() => {
    const on = new Set(shown);
    return rows.filter((f) => !f.verdict && on.has(f.id)).map(rowId);
  }, [rows, shown]);
  const walk = useRef<Walk | null>(null);
  const turnTo = (p: number) => replace({ page: p > 1 ? String(p) : null });
  /** Focus on the next finding through the kit's row reveal; its detail opened in place of the rated one's when that
   * was open. */
  const moveTo = (tr: HTMLElement, from: string, wasOpen: boolean) => {
    const nextId = idOf(tr);
    if (wasOpen) onOpenChange([...open.filter((x) => x !== from && x !== nextId), nextId]);
    revealRow(tr);
  };
  useVerdictKeys((verdict: Verdict) => {
    const host = root.current;
    const at = document.activeElement;
    if (!host || !(at instanceof HTMLElement) || !host.contains(at)) return;
    const tr = at.closest<HTMLElement>("tr[data-row-id], tr[data-detail-for]");
    const id = tr?.dataset.rowId ?? tr?.dataset.detailFor;
    const finding = id ? rows.find((f) => f.id === id) : undefined;
    if (!id || !finding) return;
    // the note goes with it, as a choice in the detail takes it: the draft, else the saved one
    verdicts.save([id], verdict, verdicts.draft(id) ?? finding.verdict?.note ?? "");
    setListRated(null);
    walk.current = null;
    const rest = new Set(left.filter((x) => x !== id));
    const wasOpen = open.includes(id);
    if (!rest.size) {
      // none left in the list: the keys stop here and its detail says why
      setListRated(id);
      if (!wasOpen) onOpenChange([...open, id]);
      return;
    }
    const shown = pageRows(host);
    const next = shown.slice(shown.findIndex((el) => idOf(el) === id) + 1).find((el) => rest.has(idOf(el)));
    if (next) return moveTo(next, id, wasOpen);
    // none after it on this page: the page turns, through the URL's page as any page turn does
    walk.current = { from: id, open: wasOpen, page: page + 1, seen: shown.map(idOf), start: page, wrapped: false };
    turnTo(page + 1);
  });
  // a page the keys turned to, once the table shows it: its first finding without a verdict, else the page after it;
  // past the last page (the table kept its rows) the walk goes on from the first, and stops at the page it started on
  useEffect(() => {
    const w = walk.current;
    const host = root.current;
    if (!w || !host || page !== w.page) return;
    const shown = pageRows(host);
    const ids = shown.map(idOf);
    if (!w.wrapped && ids.join("\n") === w.seen.join("\n")) {
      walk.current = { ...w, page: 1, seen: ids, wrapped: true };
      turnTo(1);
      return;
    }
    const rest = new Set(left.filter((x) => x !== w.from));
    const next = shown.find((el) => rest.has(idOf(el)));
    if (next || (w.wrapped && w.page >= w.start)) {
      walk.current = null;
      if (next) moveTo(next, w.from, w.open);
      return;
    }
    walk.current = { ...w, page: w.page + 1, seen: ids };
    turnTo(w.page + 1);
  });

  // ── the row menu (table #4) and the verdict dialog ─────────────────────────────────────────────
  const [rating, setRating] = useState<readonly string[] | null>(null);
  const actions = useMemo<RowAction<Finding>[]>(
    () => [
      { id: "rate", label: RATE_ACTION, scope: "both", group: 1, run: (rs) => setRating(rs.map(rowId)) },
      copyAction<Finding>("copy-link", "ссылку", (f) => `${window.location.origin}${runPath(run.key, { view: "findings", finding: f.id })}`, "single", 2),
      copyAction<Finding>("copy-id", "id", (f) => f.id, "both", 2),
      // an item whose object the rows can never have is not listed (table #4; rules/ui → Scope: no disabled action)
      { ...copyAction<Finding>("copy-location", PLACE_WHAT, (f) => f.location, "both", 2), hidden: (rs) => rs.every((f) => !f.location) },
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
  /** The verdicts as the detail and the dialog write them: a choice there ends the line that says the list is rated. */
  const writes: Verdicts = {
    ...verdicts,
    save: (ids, verdict, note) => {
      setListRated(null);
      verdicts.save(ids, verdict, note);
    },
  };

  // an address the run does not hold: the one not-found line in the table's notice slot under its toolbar, with the
  // run's count of findings (improve-13, design-17); «Закрыть» drops `finding=`, and the kit's `close` puts focus on
  // the table's Tab stop (code-2)
  const missing = param !== null && !holds(param) ? param : null;
  const notice: TableNotice | null = missing
    ? {
        id: missing,
        line: (close) => (
          <MissingLine
            kind="finding"
            id={missing}
            count={run.findings.length}
            slot="finding-missing"
            onClose={() => {
              replace({ finding: null });
              close();
            }}
          />
        ),
      }
    : null;

  return (
    <div ref={root} data-slot="findings-view" className="absolute inset-0 flex flex-col gap-2 px-5 pt-3 pb-1">
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
        collapseAll={COLLAPSE_WHAT}
        notice={notice}
        detail={(f) => <FindingDetail run={run} finding={f} verdicts={writes} now={now} listRated={f.id === listRated && left.length === 0} />}
        defaultSort={DEFAULT_SORT}
        empty={empty}
        page={page}
        onPageChange={onPageChange}
        open={open}
        onOpenChange={onOpenChange}
        target={link.target}
        onShownChange={setShown}
        marks={(f) => ({ edge: edge(f.id) })}
        updatedAt={updated === null ? null : new Date(updated).toISOString()}
        now={now}
        className="min-h-0 flex-1"
      />
      <VerdictDialog rows={ratingRows} verdicts={writes} now={now} onClose={() => setRating(null)} />
    </div>
  );
}

function FindingDetail({ run, finding, verdicts, now, listRated }: { run: LoadedRun; finding: Finding; verdicts: Verdicts; now: number; listRated: boolean }) {
  return <FindingArticle run={run} finding={finding} now={now} inRow verdict={<FindingVerdict finding={finding} verdicts={verdicts} now={now} listRated={listRated} />} />;
}
