// The report reader (surfaces/reading.md → BLOCKS 3–6, LEADS; `ux 9`): one launch as an object page — its identity
// (the description as the title, the launch id, the report's path copied on click), then one fact list whose first
// rows are the outcome (finished or running with its age; findings by severity, the RESULT, or the verdicts) and,
// for a craft report, the scores across stages; the facts follow, the rest behind «Подробнее». Then the frames of
// its surface, and the report's sections as tabs with counts, fixed per agent kind, «Файл отчёта» last. Bodies are
// running text at the reading measure; ids in them are links.
import { CopyIcon } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { Finding, Launch } from "../../../shared/model.ts";
import { launchState, NOT_RECORDED, reportWord, SEVERITY, stageOf } from "../../../shared/states.ts";
import { ago, count, duration, mskDateTime, mskTime, NOUNS, num, tokens } from "../../../shared/text.ts";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import { copyText, CountLink, CountTabs, CountTabsContent, Dot, FactList, FrameStrip, Hint, Loading, NotRecorded, PartFailed, RunningText, StatusDot, type Fact, type Frame } from "@/ui";
// From the files, not the index: the index reaches the app's links, which reach this view (a cycle at load time).
import { FindingArticle, frameSrc } from "@/finding/article.tsx";
import { openFindings } from "@/finding/open.ts";
import { LINK_CLASS, ObjectLink, resolverFor, routerLink } from "../../app/links.tsx";
import { runPath } from "../../app/routes.ts";
import type { LoadedRun } from "../index.ts";
import { useReportText } from "./report-text.ts";
import type { RailItem } from "./model.ts";
import { SurfaceScores } from "./scores.tsx";
import {
  emptyTabText,
  FILE_TAB,
  reportKind,
  reportTabs,
  resultOf,
  reportFindings,
  RUNNING_NOTE,
  SECTION_LABELS,
  severityCounts,
  unparsedText,
  verdictCounts,
  verdictText,
  type ReportTab,
  type TabBody,
} from "./sections.ts";

export const COPY_PATH_WHAT = "путь к отчёту";
export const OPEN_IN_FINDINGS = "Открыть в находках";
export const ALL_CONVENTIONS = "Все соглашения прогона";

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
  now: number;
}

export function Reader({ run, item, tab, onTab, now }: ReaderProps) {
  const l = item.launch;
  return (
    <article data-slot="report-reader" aria-labelledby="report-title" className="flex min-w-0 flex-col gap-5">
      <Identity run={run} item={item} />
      {l ? <Finished run={run} launch={l} item={item} tab={tab} onTab={onTab} now={now} /> : <Running item={item} now={now} />}
    </article>
  );
}

function Identity({ run, item }: { run: LoadedRun; item: RailItem }) {
  const l = item.launch;
  const path = l?.report ? reportPath(run.dir, l.report) : null;
  return (
    <header className="flex min-w-0 flex-col gap-1">
      <h2 id="report-title" className="m-0 text-lg font-semibold break-words">
        {item.description}
      </h2>
      <p className="m-0 flex min-w-0 flex-wrap items-center gap-x-2 text-muted-foreground">
        <span>{reportWord({ agent: l?.agent ?? item.running?.agent ?? null, description: item.description })}</span>
        <span data-slot="report-id" className="font-mono text-xs break-all text-foreground">
          {item.id}
        </span>
        {l?.report && path && (
          <Hint label={`Скопировать ${COPY_PATH_WHAT}`}>
            <Button variant="ghost" size="sm" data-slot="report-path" className="h-6 max-w-full gap-1.5 px-1.5 font-mono text-xs font-normal" onClick={() => void copyText(path, COPY_PATH_WHAT)}>
              <span className="truncate">{l.report}</span>
              <CopyIcon aria-hidden="true" className="text-muted-foreground" />
            </Button>
          </Hint>
        )}
      </p>
    </header>
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
  const state = launchState({ running: false, seconds: l.seconds, reportMissing: l.reportMissing }, now);
  const verdicts = kind === "critic" ? verdictCounts(l) : null;
  const result = kind === "implement" ? resultOf(l) : null;
  const scored = run.surfaces.filter((s) => s.scores.some((sc) => sc.launch === l.id));
  const hrefOf = (launch: string) => (run.launches.some((x) => x.id === launch) ? runPath(run.key, { view: "reports", report: launch }) : null);

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
  facts.push({ label: "Агент", value: <AgentValue kind={l.kind} agent={l.agent} /> });
  const lens = l.sections.LENS?.value?.trim();
  if (lens) facts.push({ label: "Линза критика", value: <span className="font-mono text-xs">{lens}</span> });
  facts.push({ label: "Модель", value: l.model ? <span className="font-mono text-xs">{l.model}</span> : <NotRecorded /> });
  facts.push({ label: "Этап", value: stageOf(l.stage).full });
  if (l.unit) facts.push({ label: "Юнит", value: <ObjectLink run={run} kind="unit" id={l.unit} /> });
  facts.push({ label: "Начало", value: at(l.startedAt, now) });
  facts.push({ label: "Длительность", value: l.seconds !== null ? <span className="tabular-nums">{duration(l.seconds * 1000)}</span> : <NotRecorded /> });
  const spend = l.spend ? tokens(l.spend) : null;
  facts.push({ label: "Токены", value: spend ? <span title={spend.title} className="tabular-nums">{spend.compact}</span> : <NotRecorded /> });
  const more: Fact[] = l.spend
    ? [
        { label: "Вход", value: <span className="tabular-nums">{count(l.spend.input, NOUNS.token)}</span> },
        { label: "Выход", value: <span className="tabular-nums">{count(l.spend.output, NOUNS.token)}</span> },
        { label: "Запись в кэш", value: <span className="tabular-nums">{count(l.spend.cacheWrite, NOUNS.token)}</span> },
        { label: "Чтение кэша", value: <span className="tabular-nums">{count(l.spend.cacheRead, NOUNS.token)}</span> },
      ]
    : [];
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
  const error = l.reportMissing ? run.errors.find((e) => e.file === l.report || e.file === l.id) : null;

  return (
    <>
      <FactList facts={facts} more={more} foldKey="report" label="Запуск агента" />
      {frames.length > 0 && (
        <section aria-labelledby="report-frames" className="flex flex-col gap-1.5">
          <h3 id="report-frames" className="m-0 text-xs font-normal text-muted-foreground">
            Кадры {item.surfaces.length ? `раздела ${item.surfaces.join(", ")}` : "из находок отчёта"}
          </h3>
          <FrameStrip frames={frames} limit={16} />
        </section>
      )}
      {l.reportMissing ? (
        <PartFailed what={`Отчёт ${basename(l.report ?? l.id)}`} cause={error?.cause ?? NOT_RECORDED} />
      ) : (
        <>
          {l.unparsed.length > 0 && (
            <p data-slot="report-unparsed" className="m-0 flex items-center gap-1.5 text-muted-foreground">
              <Dot tone="neutral" />
              {unparsedText(l.unparsed.length)}
            </p>
          )}
          <Sections run={run} launch={l} findings={findings} tab={tab} onTab={onTab} now={now} />
        </>
      )}
    </>
  );
}

function Sections({ run, launch: l, findings, tab, onTab, now }: { run: LoadedRun; launch: Launch; findings: Finding[]; tab: string | null; onTab: (tab: string) => void; now: number }) {
  const tabs = reportTabs(l, findings.length);
  const active = tabs.find((t) => t.id === tab) ?? tabs[0];
  return (
    <section data-slot="report-sections" aria-label="Разделы отчёта" className="flex min-w-0 flex-col">
      <CountTabs
        value={active.id}
        onValueChange={onTab}
        label="Разделы отчёта"
        tabs={tabs.map((t) => ({ value: t.id, label: t.label, count: t.id === FILE_TAB ? null : t.count }))}
        className="min-w-0 [&>[role=tablist]]:max-w-full [&>[role=tablist]]:overflow-x-auto [&>[role=tablist]]:border-b"
      >
        {tabs.map((t) => (
          <CountTabsContent key={t.id} value={t.id} className="pt-4">
            <Body run={run} launch={l} tab={t} findings={findings} now={now} />
          </CountTabsContent>
        ))}
      </CountTabs>
    </section>
  );
}

function Body({ run, launch: l, tab, findings, now }: { run: LoadedRun; launch: Launch; tab: ReportTab; findings: Finding[]; now: number }) {
  const body: TabBody = tab.body;
  const resolve = resolverFor(run);
  if (body.kind === "file") return <FileBody run={run} launch={l} />;
  if (tab.count === 0) return <p className="m-0 text-muted-foreground">{emptyTabText(reportKind(l))}</p>;
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

/** «Файл отчёта»: the report as written, read when the tab opens, through the running-text renderer — a markdown
 * table in its own box that scrolls sideways. While it is read, «Загрузка…» holds a region of a fixed height at the
 * panel's end, so the text lands below everything already shown (Strict 1, 2). */
function FileBody({ run, launch: l }: { run: LoadedRun; launch: Launch }) {
  if (!l.report) return <NotRecorded cause="запись запуска не называет файл отчёта" />;
  return <ReportFile run={run} file={basename(l.report)} />;
}

function ReportFile({ run, file }: { run: LoadedRun; file: string }) {
  const r = useReportText(run.key, file, run.version);
  if (r.status === "loading")
    return (
      <div data-slot="report-file-loading" className="h-48">
        <Loading />
      </div>
    );
  if (r.status === "error") return <PartFailed what={`Отчёт ${file}`} cause={r.cause} />;
  return (
    <div data-slot="report-file" className="min-w-0">
      <RunningText text={r.text} resolve={resolverFor(run)} renderLink={routerLink} />
    </div>
  );
}

const ALL = "all";

/** «Находки»: a severity filter over the report's findings, then each as the shared finding article. */
function FindingsBody({ run, findings, now }: { run: LoadedRun; findings: Finding[]; now: number }) {
  const [severity, setSeverity] = useState(ALL);
  const counts = severityCounts(findings);
  const shown = severity === ALL ? findings : findings.filter((f) => (f.severity ?? "none") === severity);
  return (
    <div className="flex min-w-0 flex-col gap-4">
      {counts.length > 1 && (
        <ToggleGroup type="single" variant="outline" size="sm" spacing={0} value={severity} onValueChange={(v) => v && setSeverity(v)} aria-label="Серьёзность находок">
          {[{ severity: ALL, n: findings.length }, ...counts].map((c) => (
            <ToggleGroupItem key={c.severity} value={c.severity} className="gap-1.5 px-2.5 font-normal">
              {c.severity === ALL ? "все" : SEVERITY[c.severity as keyof typeof SEVERITY].compact}
              <span className="inline-block min-w-count text-left text-muted-foreground tabular-nums">{num(c.n)}</span>
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      )}
      <ol data-slot="report-findings" className="m-0 flex list-none flex-col p-0">
        {shown.map((f) => (
          <li key={f.id} data-finding={f.id} className={cn("flex flex-col gap-2 border-t py-4 first:border-t-0 first:pt-0")}>
            <h3 className="m-0 flex min-w-0 items-baseline gap-3 text-sm font-normal">
              <span className="font-mono text-xs">{f.local}</span>
              <ObjectLink run={run} kind="finding" id={f.id} className="ml-auto shrink-0 text-xs">
                {OPEN_IN_FINDINGS}
              </ObjectLink>
            </h3>
            <FindingArticle run={run} finding={f} now={now} />
          </li>
        ))}
      </ol>
    </div>
  );
}
