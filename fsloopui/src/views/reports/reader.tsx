// The report reader (surfaces/reading.md → BLOCKS 3–6, LEADS; `ux 9`): one launch as an object page — its identity
// (the description as the title with the way to the previous and the next report, the launch id, the report's path
// copied on click, then one muted line: agent · model · duration · tokens), then one fact list of the outcome alone
// (the state; findings by severity, the RESULT, or the verdicts; for a craft report, the scores across stages) with
// every other fact behind «Подробнее». Then the report's parts as tabs with counts, fixed per agent kind, «Кадры» and
// «Файл отчёта» last; the strip stays in view while the report scrolls, and what does not fit its width folds into
// «Ещё N». Bodies are running text at the reading measure, each critic's part led by what it holds; ids in them are
// links; the findings are compact rows that expand in place (craft-13: the product first, in the first viewport).
import { ChevronDownIcon, ChevronRightIcon, ChevronUpIcon, CopyIcon } from "lucide-react";
import { useId, useLayoutEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { flushSync } from "react-dom";
import { Link, useNavigate } from "react-router-dom";
import type { Finding, Launch } from "../../../shared/model.ts";
import { launchState, NOT_RECORDED, reportWord, SEVERITY, stageOf } from "../../../shared/states.ts";
import { ago, count, duration, mskDateTime, mskTime, NOUNS, num, tokens } from "../../../shared/text.ts";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import { frameSrc } from "@/api";
import {
  copyLabel,
  copyText,
  CountLink,
  CountTabs,
  CountTabsContent,
  Dot,
  FactList,
  flatItem,
  FlatList,
  FrameStrip,
  Hint,
  Loading,
  Menu,
  NotRecorded,
  parseBlocks,
  PartFailed,
  RunningText,
  StatusDot,
  usePref,
  useShortcut,
  type Fact,
  type Frame,
} from "@/ui";
// From the files, not the index: the index reaches the app's links, which reach this view (a cycle at load time).
import { FindingArticle } from "@/finding/article.tsx";
import { FindingRow } from "@/finding/row.tsx";
import { openFindings } from "@/finding/open.ts";
import { LINK_CLASS, ObjectLink, resolverFor, routerLink } from "../../app/links.tsx";
import { runPath } from "../../app/routes.ts";
import type { LoadedRun } from "../index.ts";
import { useReportText } from "./report-text.ts";
import { earlierReport, type RailItem } from "./model.ts";
import { SurfaceScores } from "./scores.tsx";
import {
  compareFindings,
  emptyTabText,
  foldTabs,
  lensGlossary,
  partCounts,
  reportKind,
  reportTabs,
  resultOf,
  reportFindings,
  RUNNING_NOTE,
  SECTION_LABELS,
  SECTION_LEADS,
  severityCounts,
  uncounted,
  unparsedText,
  verdictCounts,
  verdictText,
  type ReportTab,
  type TabBody,
} from "./sections.ts";

export const COPY_PATH_WHAT = "путь к отчёту";
export const OPEN_IN_FINDINGS = "Открыть в находках";
export const ALL_CONVENTIONS = "Все соглашения прогона";
/** A report's tabs are its parts: «раздел» is a part of the interface everywhere in fsloopUI (cand-6, ux 1). */
export const SECTIONS_LABEL = "Части отчёта";
export const MORE_SECTIONS = "Другие части отчёта";
export const PREV_REPORT = "Предыдущий отчёт";
export const NEXT_REPORT = "Следующий отчёт";
export const NO_PREV = "Предыдущего отчёта нет: этот — первый в списке";
export const NO_NEXT = "Следующего отчёта нет: этот — последний в списке";
/** J and K, by the physical key: the next and the previous report of the list. */
export const NEXT_KEY = "KeyJ";
export const PREV_KEY = "KeyK";
export const OUTLINE_LABEL = "Содержание отчёта";
export const FINDINGS_LIST_LABEL = "Находки отчёта";
/** The severity chosen over a report's findings: one per view, kept in the browser (cand-3). */
export const SEVERITY_PREF = "reports:severity";

/** The report file's full path: the run folder joined with the launch's relative report path. */
export function reportPath(dir: string, report: string): string {
  const sep = dir.includes("\\") ? "\\" : "/";
  return `${dir.replace(/[\\/]+$/, "")}${sep}${report.replace(/[\\/]/g, sep)}`;
}

const basename = (p: string) => p.split(/[\\/]/).at(-1) ?? p;

export interface ReaderProps {
  run: LoadedRun;
  item: RailItem;
  /** The tab the URL names; an unknown or absent one opens the first. */
  tab: string | null;
  onTab: (tab: string) => void;
  /** The reports before and after this one in the list as the user sees it; null at its ends. */
  prev: string | null;
  next: string | null;
  hrefOf: (id: string) => string;
  now: number;
}

export function Reader({ run, item, tab, onTab, prev, next, hrefOf, now }: ReaderProps) {
  const l = item.launch;
  return (
    <article data-slot="report-reader" aria-labelledby="report-title" className="flex min-w-0 flex-col gap-4">
      <Identity run={run} item={item} prev={prev} next={next} hrefOf={hrefOf} />
      {l ? <Finished run={run} launch={l} item={item} tab={tab} onTab={onTab} now={now} /> : <Running item={item} now={now} />}
    </article>
  );
}

/** ‹ › of the list (p1-review cand-6): a link each, with J and K; at an end the control stays, says why, does nothing. */
function Neighbours({ prev, next, hrefOf }: { prev: string | null; next: string | null; hrefOf: (id: string) => string }) {
  const navigate = useNavigate();
  useShortcut(PREV_KEY, () => prev && navigate(hrefOf(prev)));
  useShortcut(NEXT_KEY, () => next && navigate(hrefOf(next)));
  const step = (id: string | null, name: string, blocked: string, key: string, icon: ReactNode) =>
    id ? (
      <Hint label={name} keys={[key]}>
        <Button asChild variant="ghost" size="icon-sm">
          <Link to={hrefOf(id)} aria-label={name}>
            {icon}
          </Link>
        </Button>
      </Hint>
    ) : (
      <Hint label={blocked}>
        <Button variant="ghost" size="icon-sm" aria-label={name} aria-disabled="true" className="text-muted-foreground opacity-50">
          {icon}
        </Button>
      </Hint>
    );
  return (
    <span data-slot="report-neighbours" className="flex shrink-0 items-center">
      {step(prev, PREV_REPORT, NO_PREV, PREV_KEY, <ChevronUpIcon aria-hidden="true" />)}
      {step(next, NEXT_REPORT, NO_NEXT, NEXT_KEY, <ChevronDownIcon aria-hidden="true" />)}
    </span>
  );
}

function Identity({ run, item, prev, next, hrefOf }: { run: LoadedRun; item: RailItem; prev: string | null; next: string | null; hrefOf: (id: string) => string }) {
  const l = item.launch;
  const path = l?.report ? reportPath(run.dir, l.report) : null;
  return (
    <header className="flex min-w-0 flex-col gap-1">
      <div className="flex min-w-0 items-start gap-2">
        <h2 id="report-title" className="m-0 min-w-0 flex-1 text-lg font-semibold break-words">
          {item.description}
        </h2>
        <Neighbours prev={prev} next={next} hrefOf={hrefOf} />
      </div>
      <p className="m-0 flex min-w-0 flex-wrap items-center gap-x-2 text-muted-foreground">
        <span>{reportWord({ agent: l?.agent ?? item.running?.agent ?? null, description: item.description })}</span>
        <span data-slot="report-id" className="font-mono text-xs break-all text-foreground">
          {item.id}
        </span>
        {l?.report && path && (
          <Hint label={copyLabel(COPY_PATH_WHAT)}>
            <Button variant="ghost" size="sm" data-slot="report-path" className="h-6 max-w-full gap-1.5 px-1.5 font-mono text-xs font-normal" onClick={() => void copyText(path, COPY_PATH_WHAT)}>
              <span className="truncate">{l.report}</span>
              <CopyIcon aria-hidden="true" className="text-muted-foreground" />
            </Button>
          </Hint>
        )}
      </p>
      {l && <MetaLine launch={l} />}
    </header>
  );
}

/** One muted line of what produced the report — agent · model · duration · tokens (the split in the title): the
 * facts the user reads once, kept beside the identity instead of as rows ahead of the outcome. The agent's word is
 * left out where the line above already says it («отчёт критика»); a part the record lacks is left out here and
 * reads «не записано» under «Подробнее». No part, no line. Each «·» is a box of its own whose spaces `pre` keeps: a
 * flex item drops the spaces at its start (craft-2: «claude-opus-5-5· 9 мин»). */
function MetaLine({ launch: l }: { launch: Launch }) {
  const spend = l.spend ? tokens(l.spend) : null;
  const parts: { key: string; node: ReactNode }[] = reportKind(l) === "critic" ? [] : [{ key: "agent", node: <span title={l.agent ?? undefined}>{l.kind}</span> }];
  if (l.model) parts.push({ key: "model", node: <span className="font-mono text-xs">{l.model}</span> });
  if (l.seconds !== null) parts.push({ key: "duration", node: <span title="длительность запуска">{duration(l.seconds * 1000)}</span> });
  if (spend) parts.push({ key: "tokens", node: <span title={spend.title}>{spend.compact}</span> });
  if (!parts.length) return null;
  return (
    <p data-slot="report-meta" className="m-0 flex min-w-0 flex-wrap items-baseline text-muted-foreground tabular-nums">
      {parts.flatMap((p, i) => [
        ...(i > 0
          ? [
              <span key={`${p.key}-sep`} data-slot="meta-sep" aria-hidden="true" className="whitespace-pre">
                {" · "}
              </span>,
            ]
          : []),
        <span key={p.key} className="whitespace-nowrap">
          {p.node}
        </span>,
      ])}
    </p>
  );
}

const Muted = ({ children }: { children: ReactNode }) => <span className="text-muted-foreground">{children}</span>;
const at = (iso: string | null, now: number) => (iso ? <span title={mskDateTime(iso)}>{mskTime(iso, now)}</span> : <NotRecorded />);

function Running({ item, now }: { item: RailItem; now: number }) {
  const r = item.running;
  const state = launchState({ running: true, startedAt: r?.startedAt }, now);
  const facts: Fact[] = [
    { label: "Состояние", outcome: true, value: <StatusDot state={{ tone: state.tone, label: state.label }} /> },
    { label: "Агент", value: <AgentValue kind={item.kind} agent={r?.agent ?? null} /> },
    { label: "Этап", value: item.stage ? stageOf(item.stage).full : <NotRecorded /> },
    { label: "Начало", value: at(r?.startedAt ?? null, now) },
    { label: "Последняя запись в транскрипт", value: r?.lastAt ? <span title={mskDateTime(r.lastAt)}>{ago(r.lastAt, now)}</span> : <NotRecorded /> },
  ];
  return (
    <>
      <FactList facts={facts} foldKey="report" label="Запуск агента" />
      <p data-slot="report-running" role="status" className="m-0 max-w-measure text-muted-foreground">
        {RUNNING_NOTE}
      </p>
    </>
  );
}

function AgentValue({ kind, agent }: { kind: string; agent: string | null }) {
  return (
    <span className="inline-flex flex-wrap items-baseline gap-x-2">
      <span>{kind}</span>
      {agent && agent !== kind && <span className="font-mono text-xs text-muted-foreground">{agent}</span>}
    </span>
  );
}

/** The findings by severity: the total links to «Находки» filtered to this report — only when that list shows the
 * same number (Conventions 7: a critic's ideas are findings there too) — then each severity with its dot. */
function SeverityLine({ run, launch, findings, linkable }: { run: LoadedRun; launch: Launch; findings: readonly Finding[]; linkable: boolean }) {
  const navigate = useNavigate();
  const counts = severityCounts(findings);
  return (
    <span data-slot="report-severity" className="inline-flex flex-wrap items-center gap-x-3 tabular-nums">
      <CountLink count={findings.length} noun={NOUNS.finding} linkable={linkable} href={runPath(run.key, { view: "findings" })} onOpen={() => openFindings(run.key, { report: [launch.id] }, navigate)} />
      {counts.map((c) => (
        <span key={c.severity} className="inline-flex items-center gap-1.5">
          <Dot tone={SEVERITY[c.severity].tone} />
          {num(c.n)} {SEVERITY[c.severity].compact}
        </span>
      ))}
    </span>
  );
}

function Finished({ run, launch: l, item, tab, onTab, now }: { run: LoadedRun; launch: Launch; item: RailItem; tab: string | null; onTab: (tab: string) => void; now: number }) {
  const kind = reportKind(l);
  const findings = reportFindings(run.findings, l.id);
  const all = run.findings.filter((f) => f.launch === l.id).length;
  // the state alone: how long the launch took is on the identity's line
  const state = launchState({ running: false, reportMissing: l.reportMissing }, now);
  const verdicts = kind === "critic" ? verdictCounts(l) : null;
  const result = kind === "implement" ? resultOf(l) : null;
  const scored = run.surfaces.filter((s) => s.scores.some((sc) => sc.launch === l.id));
  const hrefOf = (launch: string) => (run.launches.some((x) => x.id === launch) ? runPath(run.key, { view: "reports", report: launch }) : null);

  // ── the outcome: what the report says, the only rows open by default ───────────────────────────
  const facts: Fact[] = [{ label: "Состояние", outcome: true, value: <StatusDot state={{ tone: state.tone, label: state.label }} form="full" /> }];
  if (kind === "implement") facts.push({ label: "Итог", outcome: true, value: result ? <span className="font-mono text-xs">{result}</span> : <NotRecorded /> });
  if (verdicts) facts.push({ label: SECTION_LABELS.VERDICT, outcome: true, value: <span className="tabular-nums">{verdictText(verdicts)}</span> });
  if (kind === "critic" ? !verdicts || findings.length > 0 : findings.length > 0)
    facts.push({ label: SECTION_LABELS.FINDINGS, outcome: true, value: findings.length ? <SeverityLine run={run} launch={l} findings={findings} linkable={all === findings.length} /> : <Muted>0 — критик не нашёл нарушений</Muted> });
  if (scored.length)
    facts.push({
      label: "Оценки раздела",
      outcome: true,
      value: (
        <span className="flex flex-col gap-1">
          {scored.map((s) => (
            <span key={s.key} data-slot="report-scores" className="flex min-w-0 flex-wrap items-baseline gap-x-2">
              <span className="font-mono text-xs">{s.key}</span>
              <SurfaceScores scores={s.scores} hrefOf={hrefOf} current={l.id} />
            </span>
          ))}
        </span>
      ),
    });

  // ── «Подробнее»: how the launch ran ────────────────────────────────────────────────────────────
  const more: Fact[] = [{ label: "Агент", value: <AgentValue kind={l.kind} agent={l.agent} /> }];
  const lens = l.sections.LENS?.value?.trim();
  if (lens) {
    // cand-7: the lens's words are the critic's own; the label explains each one it holds
    const glossary = lensGlossary(lens);
    more.push({ label: "Линза критика", glossary: glossary.length ? glossary : undefined, value: <span className="font-mono text-xs">{lens}</span> });
  }
  more.push({ label: "Этап", value: stageOf(l.stage).full });
  if (l.unit) more.push({ label: "Юнит", value: <ObjectLink run={run} kind="unit" id={l.unit} /> });
  more.push({ label: "Начало", value: at(l.startedAt, now) });
  // the identity's line holds model, duration and tokens; one the record lacks is said here, never guessed
  if (!l.model) more.push({ label: "Модель", value: <NotRecorded /> });
  if (l.seconds === null) more.push({ label: "Длительность", value: <NotRecorded /> });
  if (!l.spend) more.push({ label: "Токены", value: <NotRecorded /> });
  if (l.spend)
    more.push(
      { label: "Вход", value: <span className="tabular-nums">{count(l.spend.input, NOUNS.token)}</span> },
      { label: "Выход", value: <span className="tabular-nums">{count(l.spend.output, NOUNS.token)}</span> },
      { label: "Запись в кэш", value: <span className="tabular-nums">{count(l.spend.cacheWrite, NOUNS.token)}</span> },
      { label: "Чтение кэша", value: <span className="tabular-nums">{count(l.spend.cacheRead, NOUNS.token)}</span> },
    );
  const noColumn = <NotRecorded cause="в записи запуска нет этой колонки" />;
  more.push({ label: "Первый запрос", value: l.boot !== undefined ? <span className="tabular-nums">{count(l.boot, NOUNS.token)}</span> : noColumn });
  const kids = l.children ? tokens(l.children) : null;
  more.push({
    label: "Дочерние запуски",
    value: l.children && kids ? (
      <span title={kids.title} className="tabular-nums">
        {count(l.children.launches, NOUNS.launch)}
        {l.children.launches > 0 && ` · ${kids.compact}`}
      </span>
    ) : (
      noColumn
    ),
  });
  more.push({ label: "Id агента", value: l.agentId ? <span className="font-mono text-xs break-all">{l.agentId}</span> : <NotRecorded cause="запись запуска его не называет" /> });
  more.push({ label: "Транскрипт", value: l.transcript ? <span className="font-mono text-xs break-all">{l.transcript}</span> : <NotRecorded cause="запись запуска не называет файл" /> });

  // The frames of the report's surface; a report without one shows the frames its findings cite.
  const names = item.surfaces.length ? [...new Set(run.surfaces.filter((s) => item.surfaces.includes(s.key)).flatMap((s) => s.frames))] : [...new Set(findings.flatMap((f) => f.frames))];
  const frames: Frame[] = names.map((name) => ({ src: frameSrc(run.key, name), name }));
  const framesTitle = `Кадры ${item.surfaces.length ? `раздела ${item.surfaces.join(", ")}` : "из находок отчёта"}`;
  const error = l.reportMissing ? run.errors.find((e) => e.file === l.report || e.file === l.id) : null;
  // a craft report the surface had an earlier one for: «Сравнение» (u6 shape, cand-3)
  const earlierId = kind === "critic" ? earlierReport(run.surfaces, l.id) : null;
  const earlier = earlierId ? (run.launches.find((x) => x.id === earlierId) ?? null) : null;
  const tabs = reportTabs(l, findings.length, frames.length, { compare: earlier !== null });

  return (
    <>
      <FactList facts={facts} more={more} foldKey="report" label="Запуск агента" />
      {l.reportMissing ? (
        <PartFailed what={`Отчёт ${basename(l.report ?? l.id)}`} cause={error?.cause ?? NOT_RECORDED} />
      ) : (
        <>
          {l.unparsed.length > 0 && (
            <p data-slot="report-unparsed" className="m-0 flex items-center gap-1.5 text-muted-foreground">
              <Dot tone="neutral" />
              {unparsedText(l.unparsed.length, { inline: tabs.length === 1 })}
            </p>
          )}
          <Sections run={run} launch={l} tabs={tabs} findings={findings} earlier={earlier} frames={frames} framesTitle={framesTitle} tab={tab} onTab={onTab} now={now} />
        </>
      )}
    </>
  );
}

interface SectionsProps {
  run: LoadedRun;
  launch: Launch;
  tabs: ReportTab[];
  findings: Finding[];
  earlier: Launch | null;
  frames: Frame[];
  framesTitle: string;
  tab: string | null;
  onTab: (tab: string) => void;
  now: number;
}

/** The parts as tabs. The strip sticks to the reader's top on the page's ground while its panel scrolls under it, so
 * another part is one click away at any depth; its height is the tab list's own, fixed. A strip wider than the reader
 * folds its tabs from the right into «Ещё N» (craft-1; table #14 — the packing is the toolbar's one module): the open
 * tab and «Файл отчёта» stay, every label in the strip stays whole. The strip measures its own box and its tabs, and
 * folds before the frame paints, so nothing shows clipped and then jumps (Strict 1). A report whose only part is its
 * file draws no one-tab strip (cand-5): the file reads under the facts. */
function Sections({ run, launch: l, tabs, findings, earlier, frames, framesTitle, tab, onTab, now }: SectionsProps) {
  const active = tabs.find((t) => t.id === tab) ?? tabs[0];
  const root = useRef<HTMLElement>(null);
  const widths = useRef(new Map<string, number>());
  const [folded, setFolded] = useState<readonly string[]>([]);
  const hidden = new Set(folded.filter((id) => id !== active.id));
  const shown = tabs.filter((t) => !hidden.has(t.id));
  const ids = tabs.map((t) => t.id).join("|");
  const single = tabs.length === 1;

  useLayoutEffect(() => {
    const el = root.current;
    if (!el || single) return;
    const measure = (sync: boolean) => {
      const strip = el.getBoundingClientRect().width;
      if (strip <= 0) return; // not laid out (hidden, or a test without layout): fold nothing
      const triggers = el.querySelectorAll<HTMLElement>("[role=tablist] > [role=tab]");
      shown.forEach((t, i) => {
        const w = triggers[i]?.getBoundingClientRect().width ?? 0;
        if (w > 0) widths.current.set(t.id, w);
      });
      const next = foldTabs(
        tabs.map((t) => ({ id: t.id, width: widths.current.get(t.id) ?? 0 })),
        active.id,
        strip,
      );
      const apply = () => setFolded((prev) => (prev.join("|") === next.join("|") ? prev : next));
      // a resize commits before paint; inside this effect React already does
      if (sync) flushSync(apply);
      else apply();
    };
    measure(false);
    const observer = new ResizeObserver(() => measure(true));
    observer.observe(el);
    return () => observer.disconnect();
    // the tab set, the fold and the open tab decide what is measured, not each render's arrays
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids, folded, active.id, single]);

  const body = (t: ReportTab) => <Body run={run} launch={l} tab={t} findings={findings} earlier={earlier} frames={frames} framesTitle={framesTitle} now={now} />;
  if (single)
    return (
      <section ref={root} data-slot="report-sections" aria-label={active.label} className="flex min-w-0 flex-col">
        {body(active)}
      </section>
    );
  const folds = tabs.filter((t) => hidden.has(t.id));
  return (
    <section ref={root} data-slot="report-sections" aria-label={SECTIONS_LABEL} className="flex min-w-0 flex-wrap items-start">
      <CountTabs
        sticky
        value={active.id}
        onValueChange={onTab}
        label={SECTIONS_LABEL}
        className="w-auto min-w-0 flex-1"
        tabs={shown.map((t) => ({ value: t.id, label: t.label, count: uncounted(t.id) ? null : t.count }))}
      >
        {folds.length > 0 && (
          <div data-slot="report-sections-more" className="sticky top-0 z-10 flex h-10 w-16 shrink-0 items-center border-b bg-background pl-1">
            <Menu label={MORE_SECTIONS} groups={[folds.map((t) => ({ id: t.id, label: uncounted(t.id) ? t.label : `${t.label} ${num(t.count)}`, onSelect: () => onTab(t.id) }))]}>
              <Button variant="ghost" size="sm" className="w-full px-2 font-medium text-foreground/60 hover:text-foreground">
                <span>Ещё</span> <span className="tabular-nums">{num(folds.length)}</span>
              </Button>
            </Menu>
          </div>
        )}
        {tabs.map((t) => (
          <CountTabsContent key={t.id} value={t.id} className="min-w-0 basis-full pt-4">
            {body(t)}
          </CountTabsContent>
        ))}
      </CountTabs>
    </section>
  );
}

interface BodyProps {
  run: LoadedRun;
  launch: Launch;
  tab: ReportTab;
  findings: Finding[];
  earlier: Launch | null;
  frames: Frame[];
  framesTitle: string;
  now: number;
}

function Body({ run, launch: l, tab, findings, earlier, frames, framesTitle, now }: BodyProps) {
  const body: TabBody = tab.body;
  const resolve = resolverFor(run);
  if (body.kind === "file") return <FileBody run={run} launch={l} />;
  if (body.kind === "frames")
    return (
      <section aria-labelledby="report-frames" className="flex flex-col gap-1.5">
        <h3 id="report-frames" className="m-0 text-xs font-normal text-muted-foreground">
          {framesTitle}
        </h3>
        <FrameStrip frames={frames} limit={16} />
      </section>
    );
  if (body.kind === "compare") return earlier ? <CompareBody run={run} launch={l} earlier={earlier} findings={findings} /> : null;
  // cand-7: a critic's part says what it holds before what it holds — also when the critic wrote nothing into it
  const lead = body.kind === "items" && reportKind(l) === "critic" ? SECTION_LEADS[body.section] : undefined;
  const leadLine = lead ? <Lead>{lead}</Lead> : null;
  if (tab.count === 0)
    return (
      <div className="flex flex-col gap-2">
        {leadLine}
        <p className="m-0 text-muted-foreground">{emptyTabText(reportKind(l))}</p>
      </div>
    );
  if (body.kind === "findings") return <FindingsBody run={run} findings={findings} now={now} />;
  if (body.kind === "parts")
    return (
      <div className="flex max-w-measure flex-col gap-4">
        {body.parts.map((p) => (
          <section key={p.key} aria-label={p.label} className="flex flex-col gap-1">
            <h3 className="m-0 text-xs font-normal text-muted-foreground">{p.label}</h3>
            {p.items.length === 0 ? (
              <Muted>—</Muted>
            ) : p.mono ? (
              <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
                {p.items.map((x, i) => (
                  <li key={i} className="font-mono text-xs break-all">
                    {x}
                  </li>
                ))}
              </ul>
            ) : (
              p.items.map((x, i) => <RunningText key={i} text={x} resolve={resolve} renderLink={routerLink} />)
            )}
          </section>
        ))}
      </div>
    );
  return (
    <div className="flex max-w-measure flex-col gap-3">
      {leadLine}
      {body.value && <RunningText text={body.value} resolve={resolve} renderLink={routerLink} />}
      {body.items.length > 0 && (
        <ol data-slot="section-items" className="m-0 flex list-decimal flex-col gap-2 pl-6 marker:text-muted-foreground marker:tabular-nums">
          {body.items.map((x, i) => (
            <li key={i} className="pl-1">
              <RunningText text={x} resolve={resolve} renderLink={routerLink} measure={false} />
            </li>
          ))}
        </ol>
      )}
      {body.section === "CONVENTIONS" && (
        <p className="m-0">
          <Link to={runPath(run.key, { view: "conventions" })} className={LINK_CLASS}>
            {ALL_CONVENTIONS}
          </Link>{" "}
          <Muted>— по всем проверкам дизайна, в «Соглашениях»</Muted>
        </p>
      )}
    </div>
  );
}

/** What a part holds, one muted line at the top of its panel. */
const Lead = ({ children }: { children: ReactNode }) => (
  <p data-slot="section-lead" className="m-0 max-w-measure text-muted-foreground">
    {children}
  </p>
);

/** «Сравнение» (u6 shape, cand-3): this craft report against the one that scored the surface before it — each part
 * counted then and now, then the findings new, repeated and not repeated, as the run recorded them. */
function CompareBody({ run, launch: l, earlier, findings }: { run: LoadedRun; launch: Launch; earlier: Launch; findings: Finding[] }) {
  const before = reportFindings(run.findings, earlier.id);
  const { fresh, kept, gone } = compareFindings(before, findings);
  const counts = partCounts(reportTabs(earlier, before.length), reportTabs(l, findings.length));
  const groups: { title: string; rows: Finding[] }[] = [
    { title: "Новые", rows: fresh },
    { title: "Повторились", rows: kept },
    { title: "Не повторились", rows: gone },
  ];
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <Lead>
        С отчётом <ObjectLink run={run} kind="report" id={earlier.id} /> — {stageOf(earlier.stage).full}. Повторилась — находка, которую прогон записал дубликатом или повтором прежней.
      </Lead>
      <p data-slot="compare-counts" className="m-0 max-w-measure tabular-nums">
        {counts}
      </p>
      {groups.map((g) => (
        <section key={g.title} data-slot="compare-group" aria-label={g.title} className="flex min-w-0 flex-col gap-1">
          <h3 className="m-0 text-xs font-normal text-muted-foreground">
            {g.title} — {count(g.rows.length, NOUNS.finding)}
          </h3>
          {g.rows.length > 0 && (
            <ol className="m-0 flex list-none flex-col border-t p-0">
              {g.rows.map((f) => (
                <li key={f.id} className="border-b pr-2">
                  <FindingRow run={run} finding={f} />
                </li>
              ))}
            </ol>
          )}
        </section>
      ))}
    </div>
  );
}

/** «Файл отчёта»: the report as written, read when the tab opens, through the running-text renderer — a markdown
 * table in its own box that scrolls sideways. While it is read, «Загрузка…» holds a region of a fixed height at the
 * panel's end, so the text lands below everything already shown (Strict 1, 2). */
function FileBody({ run, launch: l }: { run: LoadedRun; launch: Launch }) {
  if (!l.report) return <NotRecorded cause="запись запуска не называет файл отчёта" />;
  return <ReportFile run={run} file={basename(l.report)} />;
}

/** The headings a long file opens with as its outline: the top level it uses, when it has three or more. */
function outlineOf(text: string): { text: string; index: number }[] {
  const heads = parseBlocks(text).flatMap((b) => (b.kind === "h" ? [b] : []));
  const top = Math.min(...heads.map((h) => h.level));
  const outline = heads.flatMap((h, index) => (h.level === top ? [{ text: h.text.replace(/`/g, ""), index }] : []));
  return outline.length >= 3 ? outline : [];
}

function ReportFile({ run, file }: { run: LoadedRun; file: string }) {
  const r = useReportText(run.key, file, run.version);
  const box = useRef<HTMLDivElement>(null);
  if (r.status === "loading")
    return (
      <div data-slot="report-file-loading" className="h-48">
        <Loading />
      </div>
    );
  // a read that failed may pass on the next try (a file being written): «Повторить» reads it again (p1-review cand-6)
  if (r.status === "error") return <PartFailed what={`Отчёт ${file}`} cause={r.cause} onRetry={r.retry} />;
  const outline = outlineOf(r.text);
  const go = (index: number) => box.current?.querySelectorAll("h3, h4")[index]?.scrollIntoView({ block: "start" });
  return (
    <div className="flex min-w-0 flex-col gap-4">
      {outline.length > 0 && (
        <nav aria-label={OUTLINE_LABEL} data-slot="report-outline" className="flex max-w-measure flex-col gap-1">
          <h3 className="m-0 text-xs font-normal text-muted-foreground">{OUTLINE_LABEL}</h3>
          <ol className="m-0 flex list-none flex-wrap gap-x-4 gap-y-0.5 p-0">
            {outline.map((h) => (
              <li key={h.index}>
                <Button variant="link" size="xs" className="h-auto px-0 text-sm font-normal" onClick={() => go(h.index)}>
                  {h.text}
                </Button>
              </li>
            ))}
          </ol>
        </nav>
      )}
      {/* a heading the outline brings into view lands under the sticky strip, not behind it */}
      <div ref={box} data-slot="report-file" className="min-w-0 [&_h3]:scroll-mt-12 [&_h4]:scroll-mt-12">
        <RunningText text={r.text} resolve={resolverFor(run)} renderLink={routerLink} />
      </div>
    </div>
  );
}

const ALL = "all";

/** A click on a row's own text toggles it; a link or a button inside the row keeps its own action. */
const ownClick = (e: MouseEvent<HTMLElement>) => !(e.target as HTMLElement).closest("a, button");

/** «Находки»: a severity filter over the report's findings — the words alone, their counts are the outcome row's
 * (cand-1) — kept for the view in the browser (cand-3), each one 32 px `FindingRow` that expands in place into the
 * shared article — several may stay open, so the list reads like «Находки» and the whole report scans in a screen
 * (rules/ui → Tables 3). The list is one Tab stop (craft-3; ui → Keyboard): ↑/↓ move between the rows' chevrons,
 * Enter opens or closes, the id's link is the mouse's — «Открыть в находках» in the open row is the keyboard's. The
 * expansion is the user's own and opens under the row, never above it. */
function FindingsBody({ run, findings, now }: { run: LoadedRun; findings: Finding[]; now: number }) {
  const [stored, setStored] = usePref<string>(SEVERITY_PREF, ALL);
  const [open, setOpen] = useState<ReadonlySet<string>>(() => new Set());
  const list = useRef<HTMLOListElement>(null);
  const base = useId();
  const counts = severityCounts(findings);
  // a severity this report has none of reads «все» here and stays chosen for the next report
  const severity = stored === ALL || counts.some((c) => c.severity === stored) ? stored : ALL;
  const shown = severity === ALL ? findings : findings.filter((f) => (f.severity ?? "none") === severity);
  const toggle = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  // the row's id link leaves the Tab order: one stop for the list
  useLayoutEffect(() => {
    for (const a of list.current?.querySelectorAll<HTMLElement>("[data-slot=report-finding-line] [data-slot=finding-row] a") ?? []) a.tabIndex = -1;
  });
  return (
    <div className="flex min-w-0 flex-col gap-3">
      {counts.length > 1 && (
        <ToggleGroup type="single" variant="outline" size="sm" spacing={0} value={severity} onValueChange={(v) => v && setStored(v)} aria-label="Серьёзность находок">
          {[ALL, ...counts.map((c) => c.severity)].map((s) => (
            <ToggleGroupItem key={s} value={s} className="px-2.5 font-normal">
              {s === ALL ? "все" : SEVERITY[s as keyof typeof SEVERITY].compact}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      )}
      <FlatList label={FINDINGS_LIST_LABEL} onOpen={toggle}>
        <ol ref={list} data-slot="report-findings" className="m-0 flex list-none flex-col border-t p-0">
          {shown.map((f, i) => {
            const isOpen = open.has(f.id);
            const panel = `${base}-${i}`;
            const name = `${isOpen ? "Свернуть" : "Развернуть"} находку ${f.local}`;
            return (
              <li key={f.id} data-finding={f.id} className="border-b">
                <div
                  data-slot="report-finding-line"
                  data-state={isOpen ? "open" : "closed"}
                  onClick={(e) => ownClick(e) && toggle(f.id)}
                  className="grid cursor-default grid-cols-[1.5rem_minmax(0,1fr)] items-center gap-x-1 pr-2 hover:bg-muted data-[state=open]:bg-muted/40"
                >
                  <Hint label={name}>
                    <Button variant="ghost" size="icon-xs" {...flatItem(f.id)} aria-expanded={isOpen} aria-controls={isOpen ? panel : undefined} aria-label={name} onClick={() => toggle(f.id)}>
                      <ChevronRightIcon aria-hidden="true" className={cn("transition-transform motion-reduce:transition-none", isOpen && "rotate-90")} />
                    </Button>
                  </Hint>
                  <FindingRow run={run} finding={f} />
                </div>
                {isOpen && (
                  <div id={panel} data-slot="report-finding-detail" className="flex flex-col gap-2 bg-muted/40 pt-1 pr-4 pb-4 pl-7">
                    <p className="m-0 flex justify-end">
                      <ObjectLink run={run} kind="finding" id={f.id} className="text-xs">
                        {OPEN_IN_FINDINGS}
                      </ObjectLink>
                    </p>
                    <FindingArticle run={run} finding={f} now={now} inRow />
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      </FlatList>
    </div>
  );
}
