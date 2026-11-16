// The finding article (surfaces/findings.md → BLOCKS → FindingDetail; rules/ui → Tables 3, Layout 5, 7): what a
// finding's row expands into, in «Находки», under a unit in «Юниты» and in a report in «Отчёты» — one article for
// all three (j12). A fact line; then the text as the critic wrote it, split once by the server into «Наблюдение»,
// «Правка», «Вопрос, который закрывает», «Правило» — or one «Текст находки» where the line has no split, never a
// section twice; then the run's decision with its units, the user's verdict and the frames the text cites.
import { CopyIcon } from "lucide-react";
import type { ReactNode } from "react";
import type { Finding, Run } from "../../shared/model.ts";
import { DECISION, FINDING_STATUS, stageOf, UNIT_STATE } from "../../shared/states.ts";
import { frameSrc } from "@/api";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { copyLabel, copyText, FrameStrip, Hint, NotRecorded, PLACE_WHAT, RunningText, StatusDot, type Frame } from "@/ui";
import { ObjectLink, resolverFor, routerLink } from "../app/links.tsx";
import { SeverityCell } from "./cells.tsx";
import { CAUSE, CONFIDENCE, enumFact, FACT, reportWord, SECTION, verdictValue } from "./words.ts";

type ArticleRun = Pick<Run, "findings" | "units" | "launches" | "journal"> & { key: string };

export interface FindingArticleProps {
  run: ArticleRun;
  finding: Finding;
  /** The verdict's place: the findings view puts the verdict control here; elsewhere the saved verdict is read-only. */
  verdict?: ReactNode;
  /** The shared clock, for the saved verdict's time. */
  now: number;
  /** The article is a table row's detail: the row right above shows the severity, so the fact line leaves it out. */
  inRow?: boolean;
  className?: string;
}

/** The sections the text splits into, in reading order; one «Текст находки» when it has no split. */
export function textSections(f: Pick<Finding, "rule" | "observation" | "fix" | "fixCommand" | "question" | "raw" | "evidence">): { title: string; text: string }[] {
  if (!f.rule && !f.fix && !f.question) {
    const whole = f.observation ?? f.raw ?? f.evidence;
    return whole ? [{ title: SECTION.whole, text: whole }] : [];
  }
  const out: { title: string; text: string }[] = [];
  if (f.observation) out.push({ title: SECTION.observation, text: f.observation });
  if (f.fix || f.fixCommand) out.push({ title: SECTION.fix, text: [f.fixCommand ? `\`/impeccable ${f.fixCommand}\`` : null, f.fix].filter(Boolean).join(" — ") });
  if (f.question) out.push({ title: SECTION.question, text: f.question });
  if (f.rule) out.push({ title: SECTION.rule, text: f.rule });
  return out;
}

function Section({ title, children, id }: { title: string; children: ReactNode; id: string }) {
  return (
    <section aria-labelledby={id} className="flex min-w-0 flex-col gap-1">
      <h3 id={id} className="m-0 text-xs font-normal text-muted-foreground">
        {title}
      </h3>
      {children}
    </section>
  );
}

const Sep = () => (
  <span aria-hidden="true" className="text-muted-foreground">
    ·
  </span>
);

function FactLine({ run, finding: f, inRow }: { run: ArticleRun; finding: Finding; inRow: boolean }) {
  const label = (text: string) => <span className="text-muted-foreground">{text}</span>;
  // a row's detail leaves out the severity its row shows right above it (ux 2)
  const facts: { key: string; node: ReactNode }[] = inRow ? [] : [{ key: "severity", node: <SeverityCell finding={f} form="full" /> }];
  // the critic's enums in Russian, the raw value and its meaning in the title (ux 0)
  for (const [key, words, name, value] of [
    ["confidence", CONFIDENCE, FACT.confidence, f.confidence],
    ["cause", CAUSE, FACT.cause, f.cause],
  ] as const) {
    if (!value) continue;
    const fact = enumFact(words, name, value);
    facts.push({ key, node: <span title={fact.title}>{fact.text}</span> });
  }
  facts.push({
    key: "report",
    node: (
      <span>
        {label(FACT.report)}{" "}
        {f.launch ? (
          <ObjectLink run={run} kind="report" id={f.launch}>
            {f.launchName}
          </ObjectLink>
        ) : f.source === "own" ? (
          reportWord(f)
        ) : (
          <NotRecorded />
        )}
      </span>
    ),
  });
  facts.push({ key: "stage", node: <span>{stageOf(f.stage).full}</span> });
  facts.push({
    key: "location",
    node: f.location ? (
      <span className="inline-flex min-w-0 items-center gap-1">
        {label(FACT.location)} <span className="min-w-0 font-mono text-xs break-all">{f.location}</span>
        <Hint label={copyLabel(PLACE_WHAT)}>
          <Button variant="ghost" size="icon-xs" aria-label={copyLabel(PLACE_WHAT)} onClick={() => void copyText(f.location ?? "", PLACE_WHAT)}>
            <CopyIcon />
          </Button>
        </Hint>
      </span>
    ) : (
      <span className="inline-flex items-center gap-1">
        {label(FACT.location)} <NotRecorded />
      </span>
    ),
  });
  return (
    <p data-slot="finding-facts" className="m-0 flex flex-wrap items-center gap-x-2 gap-y-1">
      {facts.map((fact, i) => (
        <span key={fact.key} className="inline-flex min-w-0 items-center gap-2">
          {i > 0 && <Sep />}
          {fact.node}
        </span>
      ))}
    </p>
  );
}

/** «Решение прогона»: the state in full, each unit that fixes it with its state, then the run's why. */
function Decision({ run, finding: f }: { run: ArticleRun; finding: Finding }) {
  const status = FINDING_STATUS[f.effectiveStatus];
  const decision = f.decision ? DECISION[f.decision] : null;
  const units = f.units.map((id) => ({ id, unit: run.units.find((u) => u.id === id) ?? null }));
  return (
    <div className="flex flex-col gap-1.5">
      <p className="m-0 flex flex-wrap items-center gap-x-2">
        <StatusDot state={status} form="full" />
        {decision && decision.compact !== status.compact && (
          <>
            <Sep />
            <span className="text-muted-foreground">решение: {decision.full}</span>
          </>
        )}
      </p>
      {units.length > 0 && (
        <ul className="m-0 flex list-none flex-col gap-1 p-0">
          {units.map(({ id, unit }) => (
            <li key={id} className="flex min-w-0 flex-wrap items-center gap-x-2">
              <ObjectLink run={run} kind="unit" id={id}>
                <span className="font-mono text-xs">{id}</span>
                {unit && <> «{unit.title}»</>}
              </ObjectLink>
              {unit && (
                <>
                  <span aria-hidden="true" className="text-muted-foreground">
                    —
                  </span>
                  <StatusDot state={UNIT_STATE[unit.state]} />
                </>
              )}
            </li>
          ))}
        </ul>
      )}
      {f.duplicateOf && (
        <p className="m-0">
          дубликат находки <ObjectLink run={run} kind="finding" id={f.duplicateOf} />
        </p>
      )}
      {f.repeatedBy && (
        <p className="m-0">
          повторилась в находке <ObjectLink run={run} kind="finding" id={f.repeatedBy} />
        </p>
      )}
      {f.why && <RunningText text={f.why} resolve={resolverFor(run)} renderLink={routerLink} className="text-muted-foreground" />}
    </div>
  );
}

export function FindingArticle({ run, finding: f, verdict, now, inRow = false, className }: FindingArticleProps) {
  const sections = textSections(f);
  // the verdict under its own heading: the control where the view writes it, else the saved one read-only
  const shownVerdict = verdict ?? (f.verdict ? <p className="m-0">{verdictValue(f.verdict, now)}</p> : null);
  const resolve = resolverFor(run);
  const frames: Frame[] = f.frames.map((name) => ({ src: frameSrc(run.key, name), name }));
  const base = `finding-${f.id.replace(/[^\w-]/g, "-")}`;
  return (
    <article data-slot="finding-article" aria-label={`Находка ${f.id}`} className={cn("@container/finding flex flex-col gap-4", className)}>
      <FactLine run={run} finding={f} inRow={inRow} />
      <div className="grid items-start gap-x-10 gap-y-4 @min-[52rem]/finding:grid-cols-[minmax(0,var(--container-measure))_minmax(16rem,1fr)]">
        <div data-slot="finding-text" className="flex min-w-0 flex-col gap-3">
          {sections.length ? (
            sections.map((s, i) => (
              <Section key={s.title} title={s.title} id={`${base}-t${i}`}>
                <RunningText text={s.text} resolve={resolve} renderLink={routerLink} />
              </Section>
            ))
          ) : (
            <Section title={SECTION.whole} id={`${base}-t0`}>
              <NotRecorded />
            </Section>
          )}
        </div>
        <div className="flex min-w-0 flex-col gap-4">
          <Section title={SECTION.decision} id={`${base}-d`}>
            <Decision run={run} finding={f} />
          </Section>
          {shownVerdict && (
            <Section title={SECTION.verdict} id={`${base}-v`}>
              {shownVerdict}
            </Section>
          )}
        </div>
      </div>
      {frames.length > 0 && (
        <Section title={SECTION.frames} id={`${base}-f`}>
          <FrameStrip frames={frames} />
        </Section>
      )}
    </article>
  );
}
