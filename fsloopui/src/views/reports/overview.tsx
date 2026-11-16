// The overview (surfaces/reading.md → BLOCKS 7; LEADS: no report open): what the user reads before choosing a
// report — the run's surfaces ranked by their critical + major findings, each one running-text line with its craft
// scores across stages, every number a link to the report that gave it. A running-text list, not a data table
// (Settled): at most 28 lines, nothing to sort.
import type { Finding, Surface } from "../../../shared/model.ts";
import { SEVERITY } from "../../../shared/states.ts";
import { num } from "../../../shared/text.ts";
import { Dot } from "@/ui";
import { rankSurfaces } from "./model.ts";
import { SurfaceScores } from "./scores.tsx";

export const OVERVIEW_TITLE = "Разделы интерфейса";
// The list of reports is a rail on the left in a wide view and the «Отчёт» picker above in a narrow one: the copy
// names the list, never its side.
export const OVERVIEW_LEAD =
  "Критики craft оценивали эти разделы; сначала идут те, где больше находок critical и major, а при равенстве — с более низкой оценкой. Оценки — аудит из 20 и критика из 40 по этапам прогона; каждое число открывает отчёт, который его поставил. Отчёт любого запуска выбирается в списке отчётов.";
export const OVERVIEW_EMPTY = "Критики craft не оценивали разделов интерфейса в этом прогоне — выберите отчёт в списке отчётов.";
export const NO_SCORES = "критики craft не ставили оценок";

export function Overview({ surfaces, findings, hrefOf }: { surfaces: readonly Surface[]; findings: readonly Finding[]; hrefOf: (launch: string) => string | null }) {
  const lines = rankSurfaces(surfaces, findings);
  return (
    <section aria-labelledby="reports-overview" data-slot="reports-overview" className="flex max-w-measure flex-col gap-3">
      <h2 id="reports-overview" className="m-0 text-lg font-semibold">
        {OVERVIEW_TITLE}
      </h2>
      {lines.length ? (
        <>
          <p className="m-0 text-muted-foreground">{OVERVIEW_LEAD}</p>
          <ol className="m-0 flex list-none flex-col p-0">
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
