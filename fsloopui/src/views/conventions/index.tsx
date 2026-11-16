// «Соглашения» (surfaces/reading.md → BLOCKS «Соглашения»): which shared design solutions this run agreed for its
// interface. One reading column: a one-line caption on what a convention is, the search, then a heading per
// design-check launch — a link to its report — with its conventions in order. Each convention reads as the design
// check split it (shared/model.ts → Convention): its ordinal — a link to its own address — and the pattern lead, in a
// hanging column on a wide view; the solution is the sentence beside it, then «Пример» — running text as written, each
// place a copy button in place — and «Правило» as labelled rows, «не записано» where the check wrote none; a line the
// parser could not split keeps its text whole. A report or a run folder that cannot be read fails in its own place
// (rules/ui → Conventions 14). Read-only.
//
// A convention's address is `?view=conventions&convention=<n>` (the design check: an object's address is a query
// key): the view scrolls to it, marks it with the target mark and moves focus to it; hidden by the search it shows
// anyway, «вне фильтра».
import { CopyIcon } from "lucide-react";
import { useLayoutEffect, useMemo, useRef, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import type { Convention, Launch } from "../../../shared/model.ts";
import { STAGE_WORDS, stageOf } from "../../../shared/states.ts";
import { count, NOUNS, type Forms } from "../../../shared/text.ts";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { baseName, copyLabel, copyText, EmptyState, emptyWhen, FactList, fileFailure, folderFailure, Hint, markProps, NotFound, NotRecorded, OutOfFilter, PartFailed, RunningText, TOAST_MAX_TITLE, type Fact, type Resolve } from "@/ui";
import { AdaptiveToolbar, filterSummary, Highlight, pushHistory, runQuery, SearchBox, StatusBar, tokens, useRunView, useTableView, type SearchDef, type ToolbarItem } from "@/table";
import { useNow } from "../../app/clock.tsx";
import { LINK_CLASS, resolverFor, routerLink } from "../../app/links.tsx";
import { useUpdatedAt } from "../../app/live.tsx";
import { runPath } from "../../app/routes.ts";
import type { LoadedRun, ViewProps } from "../index.ts";

export const INTRO = "Соглашение — одно решение на задачу, которую юниты решали бы по-разному; в конце прогона соглашения попадают в `.claude/rules/ui.md`.";
export const DESIGN_CHECK = "Проверка дизайна";
export const NONE_WRITTEN = "Эта проверка дизайна соглашений не записала: юниты не решали одну задачу по-разному.";
/** The never form's noun: the run had no design check, so it has no conventions. */
export const DESIGN_CHECK_NOUN: Forms = ["проверка дизайна", "проверки дизайна", "проверки дизайна"];
export const NEVER_DESCRIPTION = `Проверку дизайна прогон запускает на этапе «${STAGE_WORDS.decompose}», когда интерфейс в этом проходе делают два юнита или больше.`;
/** A convention's labelled rows. */
export const LABELS = { example: "Пример", rule: "Правило" } as const;
/** What a place's button copies: «Скопировать место», as a finding's place (finding/article.tsx). */
export const PLACE_WHAT = "место";
/** The whole list, when the run folder could not be read. */
export const CONVENTIONS_PART = "Список соглашений";
/** The view's id for its persisted search (view state, never the URL: rules/ui → Conventions 12). */
export const CONVENTIONS_VIEW = "conventions";
/** What follows the shared «Соглашение <n> не найдено» for a `convention=` the run does not hold: why, what to do. */
export const MISSING_NEXT = ": в этом прогоне его нет — проверьте ссылку";

/** The search looks in every part of a convention; the places and the launch match as identifiers (table #12). */
export const SEARCH: SearchDef<Convention> = {
  identifiers: (c) => [...placesOf(c.example), c.launch],
  text: (c) => (c.pattern ? [c.pattern, c.solution, c.example, c.rule] : [c.text]),
  placeholder: "Задача, решение, пример, правило",
};

/** A bare example that is one token is one place; anything with a space is prose. */
const BARE_PLACE = /^\S+$/;

/** The places an example names: each `quoted` span, or the example whole when it is one bare token. */
export function placesOf(example: string | null): string[] {
  const text = example?.trim();
  if (!text) return [];
  const quoted = [...text.matchAll(/`([^`]+)`/g)].map((m) => m[1].trim()).filter(Boolean);
  if (quoted.length) return quoted;
  return BARE_PLACE.test(text) ? [text] : [];
}

/** The room a place has in the toast's title after «Скопировано: » (13 characters; ui/toast.tsx → copyText). */
const COPIED_ROOM = TOAST_MAX_TITLE - "Скопировано: ".length;

/** The place as the copy's toast names it: whole when it fits the title, else its end — the file name with as many
 * folders before it as fit, «…/reader-panel.tsx:120-145» — so the toast never cuts the file name off. */
export function copiedWhat(place: string): string {
  if (place.length <= COPIED_ROOM) return place;
  const folders = place.split("/");
  let tail = folders.pop() ?? place;
  if (tail.length + 2 > COPIED_ROOM) return `…${place.slice(-(COPIED_ROOM - 1))}`;
  while (folders.length && folders[folders.length - 1].length + tail.length + 3 <= COPIED_ROOM) tail = `${folders.pop()}/${tail}`;
  return `…/${tail}`;
}

/** The address of a convention: `?view=conventions&convention=<n>`, a query key as every object's. */
export const conventionPath = (key: string, n: number): string => runPath(key, { view: CONVENTIONS_VIEW, convention: String(n) });

export interface ConventionParts {
  pattern: string;
  solution: string;
  /** The example as the design check wrote it; null — it wrote none. */
  example: string | null;
  rule: string | null;
}

/** The parts the design check's line splits into; null — the line had no split, its text is shown whole. */
export function partsOf(c: Pick<Convention, "pattern" | "solution" | "example" | "rule">): ConventionParts | null {
  const pattern = c.pattern?.trim();
  const solution = c.solution?.trim();
  if (!pattern || !solution) return null;
  return { pattern, solution, example: c.example?.trim() || null, rule: c.rule?.trim() || null };
}

/** A design-check launch: its description or its lens says so. */
export const isDesignCheck = (l: Pick<Launch, "description" | "sections">): boolean => l.description === "design check" || /^design\b/.test(l.sections.LENS?.value?.trim() ?? "");

/** Empty: before decompose the conventions are still to come; past it, or closed, the run had no design check. */
export function emptyFor(run: Pick<LoadedRun, "closed" | "mode" | "now">): "not-yet" | "never" {
  return emptyWhen(run, "decompose", { once: true }).form;
}

export interface ConventionGroup {
  launch: string;
  stage: string;
  conventions: Convention[];
}

/** Every design-check launch in run order with its conventions; one a launch named but the run lacks, last. */
export function groupsOf(run: Pick<LoadedRun, "launches" | "conventions">): ConventionGroup[] {
  const out: ConventionGroup[] = run.launches.filter(isDesignCheck).map((l) => ({ launch: l.id, stage: l.stage, conventions: run.conventions.filter((c) => c.launch === l.id) }));
  for (const c of run.conventions) {
    if (out.some((g) => g.launch === c.launch)) continue;
    out.push({ launch: c.launch, stage: c.stage, conventions: run.conventions.filter((x) => x.launch === c.launch) });
  }
  return out;
}

/** The design check's report that could not be read: its file and why. */
function reportFailure(run: LoadedRun, launch: string): { file: string; cause: string } | null {
  const l = run.launches.find((x) => x.id === launch);
  if (!l?.reportMissing) return null;
  const file = l.report ?? l.id;
  const error = fileFailure(run, file) ?? fileFailure(run, l.id);
  return error ? { file: baseName(file), cause: error.cause } : null;
}

export function ConventionsView({ run }: ViewProps) {
  const now = useNow();
  const updated = useUpdatedAt();
  const [params] = useSearchParams();
  const groups = useMemo(() => groupsOf(run), [run]);
  const resolve = useMemo(() => resolverFor(run), [run]);
  const total = run.conventions.length;
  const failed = groups.length === 0 ? folderFailure(run) : null;

  const [prefs, setPrefs] = useRunView(CONVENTIONS_VIEW, run.key);
  const [table, setTable] = useTableView(CONVENTIONS_VIEW);
  const wanted = params.get("convention");
  const target = wanted !== null && run.conventions.some((c) => String(c.n) === wanted) ? wanted : null;
  const q = runQuery({ rows: run.conventions, rowId: (c) => String(c.n), columns: [], filters: [], search: SEARCH, state: { sort: null, filters: prefs.filters, search: prefs.search }, include: target ? new Set([target]) : undefined });
  const kept = new Set(q.rows.map((c) => c.n));
  const toks = useMemo(() => tokens(prefs.search), [prefs.search]);
  const searching = toks.length > 0;
  const shownGroups = searching ? groups.filter((g) => g.conventions.some((c) => kept.has(c.n))) : groups;

  // The convention a link names is scrolled to and takes focus, once per link; the ordinal the user clicked stays
  // where it is (Strict 1: a click never pushes what was clicked).
  const scroller = useRef<HTMLDivElement>(null);
  const clicked = useRef<string | null>(null);
  useLayoutEffect(() => {
    if (!target) return;
    if (clicked.current === target) {
      clicked.current = null;
      return;
    }
    const el = scroller.current?.querySelector<HTMLElement>(`li[data-convention="${target}"] > article`);
    el?.scrollIntoView({ block: "start" });
    el?.focus({ preventScroll: true });
  }, [target]);

  const toolbar: ToolbarItem[] = [
    { id: "search", kind: "pinned", flex: true, node: <SearchBox value={prefs.search} onChange={(v) => setPrefs({ search: v })} placeholder={SEARCH.placeholder} history={table.history} onCommit={(term) => setTable({ history: pushHistory(table.history, term) })} /> },
  ];
  const hl = (text: string) => <Highlight text={text} tokens={toks} />;

  return (
    <div data-slot="conventions-view" className="absolute inset-0 flex flex-col gap-2 px-5 pt-3 pb-1">
      {total > 0 && !failed && <AdaptiveToolbar items={toolbar} label="Поиск по соглашениям" />}
      <div ref={scroller} data-slot="conventions-scroll" className="min-h-0 flex-1 overflow-y-auto [scrollbar-gutter:stable]">
        {failed ? (
          <PartFailed what={CONVENTIONS_PART} cause={failed.cause} className="mt-4" />
        ) : groups.length === 0 ? (
          emptyFor(run) === "not-yet" ? (
            <EmptyState form="not-yet" noun={NOUNS.convention} step="decompose" className="py-16" />
          ) : (
            <EmptyState form="never" noun={DESIGN_CHECK_NOUN} description={NEVER_DESCRIPTION} className="py-16" />
          )
        ) : (
          <div className="flex max-w-[calc(var(--container-measure)+26.5rem)] flex-col gap-6 py-2">
            <div data-slot="conventions-intro" className="flex flex-col gap-1">
              <RunningText text={INTRO} measure={false} className="text-xs text-muted-foreground" />
              {wanted !== null && !target && (
                <p role="status" data-slot="convention-missing" className="m-0">
                  <NotFound kind="convention" id={wanted} start />
                  {MISSING_NEXT}
                </p>
              )}
            </div>
            {searching && q.rows.length === 0 ? (
              <EmptyState form="filtered" noun={NOUNS.convention} filters={filterSummary([], prefs.filters, prefs.search)} onReset={() => setPrefs({ filters: {}, search: "" })} className="py-16" />
            ) : (
              shownGroups.map((g) => {
                const s = stageOf(g.stage);
                const href = run.launches.some((l) => l.id === g.launch) ? runPath(run.key, { view: "reports", report: g.launch }) : null;
                const title = `${DESIGN_CHECK}${s.pass !== null ? `, проход ${s.pass}` : ""}`;
                const failure = reportFailure(run, g.launch);
                const rows = g.conventions.filter((c) => kept.has(c.n));
                return (
                  <section key={g.launch} data-launch={g.launch} aria-labelledby={`conv-${g.launch}`} className="flex flex-col gap-2">
                    <header className="flex flex-col gap-0.5">
                      <h2 id={`conv-${g.launch}`} className="m-0 text-base font-semibold">
                        {href ? (
                          <Link to={href} className={LINK_CLASS}>
                            {title}
                          </Link>
                        ) : (
                          title
                        )}
                      </h2>
                      <p className="m-0 flex flex-wrap items-baseline gap-x-2 text-xs text-muted-foreground tabular-nums">
                        <span className="font-mono">{hl(g.launch)}</span>
                        {!failure && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span>{count(g.conventions.length, NOUNS.convention)}</span>
                          </>
                        )}
                      </p>
                    </header>
                    {failure ? (
                      <PartFailed what={`Отчёт ${failure.file}`} cause={failure.cause} />
                    ) : rows.length ? (
                      <ol data-slot="convention-list" role="list" aria-label={title} className="-mx-3 flex list-none flex-col divide-y p-0">
                        {rows.map((c) => (
                          <li key={c.n} id={`convention-${c.n}`} data-convention={c.n}>
                            <ConventionItem
                              convention={c}
                              runKey={run.key}
                              resolve={resolve}
                              toks={toks}
                              target={String(c.n) === target}
                              outside={q.outside.has(String(c.n))}
                              onOrdinal={() => {
                                clicked.current = String(c.n);
                              }}
                            />
                          </li>
                        ))}
                      </ol>
                    ) : (
                      <p className="m-0 text-muted-foreground">{NONE_WRITTEN}</p>
                    )}
                  </section>
                );
              })
            )}
          </div>
        )}
      </div>
      <StatusBar shown={q.matched} total={total} noun={NOUNS.convention} updatedAt={updated === null ? null : new Date(updated).toISOString()} now={now} />
    </div>
  );
}

interface ItemProps {
  convention: Convention;
  runKey: string;
  resolve: Resolve;
  toks: readonly string[];
  target: boolean;
  outside: boolean;
  onOrdinal: () => void;
}

/** One convention: the ordinal and the pattern, then the solution, «Пример» and «Правило» — beside them from 56 rem of
 * the view (the pattern in a hanging 17 rem column), under them, aligned past the ordinal, below it. The search's hits
 * wear the table's one mark in all the text the search looks in (table #12). */
function ConventionItem({ convention: c, runKey, resolve, toks, target, outside, onOrdinal }: ItemProps) {
  const parts = partsOf(c);
  const marks = markProps({ target });
  const hl = (text: string) => <Highlight text={text} tokens={toks} />;
  const text = (value: string) => <RunningText text={value} resolve={resolve} renderLink={routerLink} measure={false} highlight={hl} />;
  const facts: Fact[] = parts
    ? [
        { label: LABELS.example, value: parts.example ? <Example text={parts.example} resolve={resolve} highlight={hl} /> : <NotRecorded /> },
        { label: LABELS.rule, value: parts.rule ? text(parts.rule) : <NotRecorded /> },
      ]
    : [];
  return (
    <article
      tabIndex={-1}
      aria-label={`Соглашение ${c.n}`}
      data-target={marks["data-target"]}
      className={cn("grid scroll-mt-2 gap-x-6 gap-y-1 rounded-md px-3 py-2.5 outline-none @min-[56rem]/view:grid-cols-[17rem_minmax(0,1fr)]", marks.className)}
    >
      <div className={cn("flex min-w-0 items-baseline gap-2", !parts && "@min-[56rem]/view:col-span-2")}>
        <span className="w-[3ch] shrink-0 text-right text-muted-foreground tabular-nums">
          <Link to={conventionPath(runKey, c.n)} replace aria-label={`Ссылка на соглашение ${c.n}`} className={LINK_CLASS} onClick={onOrdinal}>
            {c.n}
          </Link>
        </span>
        {parts ? (
          <p data-slot="convention-pattern" className="m-0 min-w-0 font-semibold text-pretty break-words">
            {hl(parts.pattern)}
          </p>
        ) : (
          <div data-slot="convention-text" className="min-w-0 max-w-measure">
            {text(c.text)}
          </div>
        )}
        {outside && <OutOfFilter className="ml-auto shrink-0" />}
      </div>
      {parts && (
        <div className="flex min-w-0 flex-col gap-1 pl-[calc(3ch+0.5rem)] @min-[56rem]/view:pl-0">
          <div data-slot="convention-solution" className="max-w-measure">
            {text(parts.solution)}
          </div>
          <FactList facts={facts} className="grid-cols-1 gap-y-0.5 text-xs @min-[40rem]/view:grid-cols-[5.5rem_minmax(0,1fr)]" />
        </div>
      )}
    </article>
  );
}

/** The example as the design check wrote it — running text, the words between its places kept — each place a copy
 * button where it stands, through the renderer's own seam for code (`renderCode`); a bare one-token example is that
 * one place. A place wraps inside its button, so its file name is always on screen (craft-4). */
function Example({ text, resolve, highlight }: { text: string; resolve: Resolve; highlight: (text: string) => ReactNode }) {
  const places = new Set(placesOf(text));
  const source = /`/.test(text) || places.size === 0 ? text : `\`${text}\``;
  const renderCode = (body: string, code: ReactNode) => (places.has(body.trim()) ? <PlaceButton place={body.trim()}>{code}</PlaceButton> : null);
  return <RunningText text={source} resolve={resolve} renderLink={routerLink} renderCode={renderCode} measure={false} highlight={highlight} />;
}

/** One place of an example: the inline code itself is the button; a click copies it, «Скопировано: <место>». */
function PlaceButton({ place, children }: { place: string; children: ReactNode }) {
  return (
    <Hint label={copyLabel(PLACE_WHAT)}>
      <Button
        variant="ghost"
        size="xs"
        data-slot="example-place"
        aria-label={`${copyLabel(PLACE_WHAT)} ${place}`}
        className="h-auto min-h-5 max-w-full gap-1 px-0.5 text-left align-baseline font-mono text-xs font-normal whitespace-normal [overflow-wrap:anywhere]"
        onClick={() => void copyText(place, copiedWhat(place))}
      >
        {children}
        <CopyIcon aria-hidden="true" data-icon="inline-end" className="text-muted-foreground" />
      </Button>
    </Hint>
  );
}
