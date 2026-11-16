// «Соглашения» (surfaces/reading.md → BLOCKS «Соглашения»): which shared design solutions this run agreed for its
// interface. One reading column: what a convention is, then a heading per design-check launch — a link to its
// report — with its conventions in order. Each convention reads as the design check split it (shared/model.ts →
// Convention): the pattern leads, the solution is the sentence under it, then the example — the places in mono, each
// copied by a click — and the rule, as labelled rows; a line the parser could not split keeps its text whole.
// A report or a run folder that cannot be read fails in its own place (rules/ui → Conventions 14). Read-only.
import { CopyIcon } from "lucide-react";
import { useMemo } from "react";
import { Link } from "react-router-dom";
import type { Convention, Launch } from "../../../shared/model.ts";
import { STAGE_WORDS, stageOf } from "../../../shared/states.ts";
import { count, NOUNS, type Forms } from "../../../shared/text.ts";
import { Button } from "@/components/ui/button";
import { copyLabel, copyText, EmptyState, emptyWhen, FactList, Hint, PartFailed, RunningText, type Fact, type Resolve } from "@/ui";
import { StatusBar } from "@/table";
import { useNow } from "../../app/clock.tsx";
import { LINK_CLASS, resolverFor, routerLink } from "../../app/links.tsx";
import { useUpdatedAt } from "../../app/live.tsx";
import { runPath } from "../../app/routes.ts";
import type { LoadedRun, ViewProps } from "../index.ts";
import { baseName, fileFailure, folderFailure } from "../journal/failure.ts";

export const INTRO = "Соглашение — одно решение на задачу, которую юниты прогона решали бы по-разному. В конце прогона соглашения попадают в правила проекта, `.claude/rules/ui.md`.";
export const DESIGN_CHECK = "Проверка дизайна";
export const NONE_WRITTEN = "Эта проверка дизайна соглашений не записала: юниты не решали одну задачу по-разному.";
/** The never form's noun: the run had no design check, so it has no conventions. */
export const DESIGN_CHECK_NOUN: Forms = ["проверка дизайна", "проверки дизайна", "проверки дизайна"];
export const NEVER_DESCRIPTION = `Проверку дизайна прогон запускает на этапе «${STAGE_WORDS.decompose}», когда интерфейс в этом проходе делают два юнита или больше.`;
/** A convention's labelled rows. */
export const LABELS = { example: "Пример", rule: "Правило" } as const;
/** What the example's button copies: «Скопировать пример», «Скопировано: пример». */
export const EXAMPLE_WHAT = "пример";
/** The whole list, when the run folder could not be read. */
export const CONVENTIONS_PART = "Список соглашений";

/** The places an example names: each `quoted` path, or the example whole when it quotes none. */
export function examplesOf(example: string | null): string[] {
  const text = example?.trim();
  if (!text) return [];
  const quoted = [...text.matchAll(/`([^`]+)`/g)].map((m) => m[1].trim()).filter(Boolean);
  return quoted.length ? quoted : [text];
}

export interface ConventionParts {
  pattern: string;
  solution: string;
  examples: string[];
  rule: string | null;
}

/** The parts the design check's line splits into; null — the line had no split, its text is shown whole. */
export function partsOf(c: Pick<Convention, "pattern" | "solution" | "example" | "rule">): ConventionParts | null {
  const pattern = c.pattern?.trim();
  const solution = c.solution?.trim();
  if (!pattern || !solution) return null;
  return { pattern, solution, examples: examplesOf(c.example), rule: c.rule?.trim() || null };
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
  const groups = useMemo(() => groupsOf(run), [run]);
  const resolve = useMemo(() => resolverFor(run), [run]);
  const total = run.conventions.length;
  const failed = groups.length === 0 ? folderFailure(run) : null;
  return (
    <div data-slot="conventions-view" className="absolute inset-0 flex flex-col gap-2 px-5 pt-3 pb-1">
      <div data-slot="conventions-scroll" className="min-h-0 flex-1 overflow-y-auto [scrollbar-gutter:stable]">
        {failed ? (
          <PartFailed what={CONVENTIONS_PART} cause={failed.cause} className="mt-4" />
        ) : groups.length === 0 ? (
          emptyFor(run) === "not-yet" ? (
            <EmptyState form="not-yet" noun={NOUNS.convention} step="decompose" className="py-16" />
          ) : (
            <EmptyState form="never" noun={DESIGN_CHECK_NOUN} description={NEVER_DESCRIPTION} className="py-16" />
          )
        ) : (
          <div className="flex max-w-[calc(var(--container-measure)+6.5rem)] flex-col gap-8 py-2">
            <RunningText text={INTRO} className="max-w-measure text-muted-foreground" measure={false} />
            {groups.map((g) => {
              const s = stageOf(g.stage);
              const href = run.launches.some((l) => l.id === g.launch) ? runPath(run.key, { view: "reports", report: g.launch }) : null;
              const title = `${DESIGN_CHECK}${s.pass !== null ? `, проход ${s.pass}` : ""}`;
              const failure = reportFailure(run, g.launch);
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
                  ) : g.conventions.length ? (
                    <ol data-slot="convention-list" className="m-0 flex list-none flex-col divide-y p-0">
                      {g.conventions.map((c) => (
                        <li key={c.n} data-convention={c.n} className="py-3 first:pt-0 last:pb-0">
                          <ConventionItem convention={c} resolve={resolve} />
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

/** One convention: the pattern, the solution, then «Пример» and «Правило» in a hanging label column from 40 rem. */
function ConventionItem({ convention, resolve }: { convention: Convention; resolve: Resolve }) {
  const parts = partsOf(convention);
  if (!parts) return <RunningText text={convention.text} resolve={resolve} renderLink={routerLink} measure={false} className="max-w-measure" />;
  const facts: Fact[] = [];
  if (parts.examples.length) facts.push({ label: LABELS.example, value: <Examples places={parts.examples} /> });
  if (parts.rule) facts.push({ label: LABELS.rule, value: <RunningText text={parts.rule} resolve={resolve} renderLink={routerLink} measure={false} /> });
  return (
    <div className="flex flex-col gap-1">
      <p data-slot="convention-pattern" className="m-0 max-w-measure font-semibold text-pretty">
        {parts.pattern}
      </p>
      <div data-slot="convention-solution" className="max-w-measure">
        <RunningText text={parts.solution} resolve={resolve} renderLink={routerLink} measure={false} />
      </div>
      {facts.length > 0 && <FactList facts={facts} className="mt-1 grid-cols-1 gap-y-0.5 text-xs @min-[40rem]/view:grid-cols-[5.5rem_minmax(0,1fr)]" />}
    </div>
  );
}

/** Each place of an example in mono, as a button that copies it («Скопировано: пример»); its box is fixed at 20 px. */
function Examples({ places }: { places: string[] }) {
  return (
    <span className="-ml-1 flex min-w-0 flex-wrap gap-x-1">
      {places.map((p) => (
        <Hint key={p} label={copyLabel(EXAMPLE_WHAT)}>
          <Button variant="ghost" size="sm" aria-label={`${copyLabel(EXAMPLE_WHAT)} ${p}`} className="h-5 max-w-full gap-1 px-1 font-mono text-xs font-normal" onClick={() => void copyText(p, EXAMPLE_WHAT)}>
            <span className="truncate">{p}</span>
            <CopyIcon aria-hidden="true" className="size-3 text-muted-foreground" />
          </Button>
        </Hint>
      ))}
    </span>
  );
}
