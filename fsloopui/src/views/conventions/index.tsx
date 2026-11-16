// «Соглашения» (surfaces/reading.md → BLOCKS «Соглашения»): which shared design solutions this run agreed for its
// interface. One reading column: what a convention is, then a heading per design-check launch — a link to its
// report — with its conventions in order, each as written, through the running-text renderer. Read-only.
import { useMemo } from "react";
import { Link } from "react-router-dom";
import type { Convention, Launch } from "../../../shared/model.ts";
import { STAGE_WORDS, stageOf } from "../../../shared/states.ts";
import { count, NOUNS, type Forms } from "../../../shared/text.ts";
import { EmptyState, RunningText } from "@/ui";
import { StatusBar } from "@/table";
import { useNow } from "../../app/clock.tsx";
import { LINK_CLASS, resolverFor, routerLink } from "../../app/links.tsx";
import { useUpdatedAt } from "../../app/live.tsx";
import { runPath } from "../../app/routes.ts";
import type { LoadedRun, ViewProps } from "../index.ts";

export const INTRO = "Соглашение — одно решение на задачу, которую юниты прогона решали бы по-разному. В конце прогона соглашения попадают в правила проекта, `.claude/rules/ui.md`.";
export const DESIGN_CHECK = "Проверка дизайна";
export const NONE_WRITTEN = "Эта проверка дизайна соглашений не записала: юниты не решали одну задачу по-разному.";
/** The never form's noun: the run had no design check, so it has no conventions. */
export const DESIGN_CHECK_NOUN: Forms = ["проверка дизайна", "проверки дизайна", "проверки дизайна"];
export const NEVER_DESCRIPTION = `Проверку дизайна прогон запускает на этапе «${STAGE_WORDS.decompose}», когда интерфейс в этом проходе делают два юнита или больше.`;

const STEPS = Object.keys(STAGE_WORDS);

/** A convention as written, its pattern leading in bold (LEADS: each convention's pattern): «**Pattern 1** — …». */
export function leadText(c: Pick<Convention, "text" | "pattern">): string {
  if (!c.pattern || !c.text.startsWith(c.pattern) || c.pattern.includes("*")) return c.text;
  return `**${c.pattern}**${c.text.slice(c.pattern.length)}`;
}

/** A design-check launch: its description or its lens says so. */
export const isDesignCheck = (l: Pick<Launch, "description" | "sections">): boolean => l.description === "design check" || /^design\b/.test(l.sections.LENS?.value?.trim() ?? "");

/** Empty: before decompose the conventions are still to come; past it, or closed, the run had no design check. */
export function emptyFor(run: Pick<LoadedRun, "closed" | "mode" | "now">): "not-yet" | "never" {
  if (run.closed || run.mode === "init") return "never";
  const step = stageOf(run.now?.stage).step;
  return step === null || STEPS.indexOf(step) < STEPS.indexOf("decompose") ? "not-yet" : "never";
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

export function ConventionsView({ run }: ViewProps) {
  const now = useNow();
  const updated = useUpdatedAt();
  const groups = useMemo(() => groupsOf(run), [run]);
  const resolve = useMemo(() => resolverFor(run), [run]);
  const total = run.conventions.length;
  return (
    <div data-slot="conventions-view" className="absolute inset-0 flex flex-col gap-2 px-5 pt-3 pb-1">
      <div data-slot="conventions-scroll" className="min-h-0 flex-1 overflow-y-auto [scrollbar-gutter:stable]">
        {groups.length === 0 ? (
          emptyFor(run) === "not-yet" ? (
            <EmptyState form="not-yet" noun={NOUNS.convention} step="decompose" className="py-16" />
          ) : (
            <EmptyState form="never" noun={DESIGN_CHECK_NOUN} description={NEVER_DESCRIPTION} className="py-16" />
          )
        ) : (
          <div className="flex max-w-measure flex-col gap-8 py-2">
            <RunningText text={INTRO} className="text-muted-foreground" />
            {groups.map((g) => {
              const s = stageOf(g.stage);
              const href = run.launches.some((l) => l.id === g.launch) ? runPath(run.key, { view: "reports", report: g.launch }) : null;
              const title = `${DESIGN_CHECK}${s.pass !== null ? `, проход ${s.pass}` : ""}`;
              return (
                <section key={g.launch} data-launch={g.launch} aria-labelledby={`conv-${g.launch}`} className="flex flex-col gap-3">
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
                      <span className="font-mono">{g.launch}</span>
                      <span aria-hidden="true">·</span>
                      <span>{count(g.conventions.length, NOUNS.convention)}</span>
                    </p>
                  </header>
                  {g.conventions.length ? (
                    <ol data-slot="convention-list" className="m-0 flex list-decimal flex-col gap-2.5 pl-6 marker:text-muted-foreground marker:tabular-nums">
                      {g.conventions.map((c) => (
                        <li key={c.n} className="pl-1">
                          <RunningText text={leadText(c)} resolve={resolve} renderLink={routerLink} measure={false} />
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p className="m-0 text-muted-foreground">{NONE_WRITTEN}</p>
                  )}
                </section>
              );
            })}
          </div>
        )}
      </div>
      <StatusBar shown={total} total={total} noun={NOUNS.convention} updatedAt={updated === null ? null : new Date(updated).toISOString()} now={now} />
    </div>
  );
}
