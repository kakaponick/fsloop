// The overview (surfaces/reading.md → BLOCKS 7; LEADS: no report open): what the user reads before choosing a
// report, under one name — the rail item's, «Обзор: оценки и токены» (improve-12 (1)). A one-line lead: «Оценки» the
// term its glossary explains for the whole list (design-13), then how the list is ranked, then «Расход токенов», a
// jump to the spend inside the reader's own scroller (design-18). Then the run's surfaces ranked by their critical +
// major findings, each one running-text line with its craft scores across stages, every number a link to the report
// that gave it. A running-text list, not a data table (Settled): at most 28 lines, nothing to sort. Under it, what the
// launches spent (u6-shape cand-1): tokens by stage and by agent kind, as the run records them (`Run.tokens`, a
// launch's children counted with it).
import type { MouseEvent } from "react";
import type { Finding, RunTokens, Surface } from "../../../shared/model.ts";
import { SEVERITY, stageOf } from "../../../shared/states.ts";
import { count, NOUNS, num, tokens as tokensOf, type SpendRow } from "../../../shared/text.ts";
import { Button } from "@/components/ui/button";
import { Dot, FactList, GlossaryTooltip, NotRecorded, revealIn } from "@/ui";
import { rankSurfaces } from "./model.ts";
import { OVERVIEW_ITEM } from "./rail.tsx";
import { SCORES_GLOSSARY, SurfaceScores } from "./scores.tsx";

export const SPEND_TITLE = "Расход токенов";
export const SPEND_NONE = "в записях запусков прогона нет токенов";

/** One spend list: a row per key — a stage in its full words, a kind as the map writes it — its launches and its
 * tokens, the split in the title. */
function SpendList({ title, rows, label }: { title: string; rows: readonly SpendRow[]; label: (key: string) => string }) {
  return (
    <section aria-label={title} className="flex min-w-0 flex-col gap-1">
      <h4 className="m-0 text-xs font-normal text-muted-foreground">{title}</h4>
      <FactList
        label={title}
        facts={rows.map((r) => {
          const t = tokensOf(r.spend);
          return {
            key: r.key,
            label: label(r.key),
            value: (
              <span title={t.title} className="tabular-nums">
                {count(r.launches, NOUNS.launch)} · {t.compact}
              </span>
            ),
          };
        })}
      />
    </section>
  );
}

/** «Расход токенов», a part of the overview under its heading: by stage, then by agent kind; «не записано» where the
 * launches recorded none, never a zero. */
export function Spend({ tokens }: { tokens: RunTokens }) {
  return (
    <section aria-labelledby="reports-spend" data-slot="reports-spend" className="flex max-w-measure flex-col gap-3">
      <h3 id="reports-spend" className="m-0 text-sm font-semibold">
        {SPEND_TITLE}
      </h3>
      {tokens.stage.length || tokens.kind.length ? (
        <>
          <SpendList title="По этапам" rows={tokens.stage} label={(k) => stageOf(k).full} />
          <SpendList title="По агентам" rows={tokens.kind} label={(k) => k} />
        </>
      ) : (
        <p data-slot="spend-none" className="m-0">
          <NotRecorded cause={SPEND_NONE} />
        </p>
      )}
    </section>
  );
}

// The list of reports is a rail on the left in a wide view and the «Отчёт» picker above in a narrow one: the copy
// names the list, never its side.
/** The lead's three parts: the glossary term, how the list is ranked, the jump to the spend (improve-12 (2–4)). */
export const OVERVIEW_LEAD = ["Оценки", " разделов; первыми — где больше находок critical и major · ", SPEND_TITLE] as const;
export const OVERVIEW_EMPTY = "Критики craft не оценивали разделов интерфейса в этом прогоне — выберите отчёт в списке отчётов.";
export const NO_SCORES = "критики craft не ставили оценок";

/** «Расход токенов» from the lead: the spend comes 8 px under the top of the reader's own scroller, and nothing above
 * that scroller moves — the outline's jump, never a `#hash` (DESIGN.md → Object Address; Conventions 12). */
function toSpend(e: MouseEvent<HTMLElement>) {
  const scroller = e.currentTarget.closest<HTMLElement>("[data-slot=report-reader-scroll]");
  const spend = scroller?.querySelector<HTMLElement>("[data-slot=reports-spend]");
  if (scroller && spend) revealIn(scroller, spend, { focus: false });
}

export function Overview({ surfaces, findings, hrefOf }: { surfaces: readonly Surface[]; findings: readonly Finding[]; hrefOf: (launch: string) => string | null }) {
  const lines = rankSurfaces(surfaces, findings);
  return (
    <section aria-labelledby="reports-overview" data-slot="reports-overview" className="flex max-w-measure flex-col gap-3">
      <h2 id="reports-overview" className="m-0 text-lg font-semibold">
        {OVERVIEW_ITEM}
      </h2>
      {lines.length ? (
        <>
          {/* one line, its 20 px box from the first paint (Strict 1) */}
          <p data-slot="overview-lead" className="m-0 h-5 whitespace-nowrap text-muted-foreground">
            <GlossaryTooltip term={OVERVIEW_LEAD[0]} entries={SCORES_GLOSSARY} />
            {OVERVIEW_LEAD[1]}
            <Button variant="link" size="xs" className="h-auto px-0 align-baseline text-sm font-normal" onClick={toSpend}>
              {OVERVIEW_LEAD[2]}
            </Button>
          </p>
          <ol role="list" className="m-0 flex list-none flex-col p-0">
            {lines.map((s) => (
              <li key={s.key} data-surface={s.key} className="flex flex-col gap-0.5 border-t py-2 first:border-t-0">
                <span className="flex min-w-0 items-baseline gap-3">
                  <span className="min-w-0 truncate font-mono text-xs" title={s.label === s.key ? s.key : `${s.key} — ${s.label}`}>
                    {s.key}
                  </span>
                  <span data-slot="surface-severity" className="ml-auto inline-flex shrink-0 items-center gap-3 text-xs tabular-nums">
                    {s.critical + s.major === 0 ? (
                      <span className="text-muted-foreground">0 critical и major</span>
                    ) : (
                      <>
                        {s.critical > 0 && (
                          <span className="inline-flex items-center gap-1.5">
                            <Dot tone={SEVERITY.critical.tone} />
                            {num(s.critical)} critical
                          </span>
                        )}
                        {s.major > 0 && (
                          <span className="inline-flex items-center gap-1.5">
                            <Dot tone={SEVERITY.major.tone} />
                            {num(s.major)} major
                          </span>
                        )}
                      </>
                    )}
                  </span>
                </span>
                <span className="text-sm">
                  {s.scores.length ? <SurfaceScores scores={s.scores} hrefOf={hrefOf} /> : <span className="text-muted-foreground">{NO_SCORES}</span>}
                </span>
              </li>
            ))}
          </ol>
        </>
      ) : (
        <p className="m-0 text-muted-foreground">{OVERVIEW_EMPTY}</p>
      )}
    </section>
  );
}
