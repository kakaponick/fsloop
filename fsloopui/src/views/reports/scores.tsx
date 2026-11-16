// A surface's craft scores across the stages that judged it (surfaces/reading.md → BLOCKS 3, 7): «аудит 16 → 17 →
// 16 из 20 · критика 27 → 27 → 29 из 40», every number a link to the report of its stage; the number of the report
// being read is plain and marked as the current one. Read by the reader's «Оценки» row and the overview alike.
import { Fragment } from "react";
import { Link } from "react-router-dom";
import type { SurfaceScore } from "../../../shared/model.ts";
import { stageOf } from "../../../shared/states.ts";
import { num } from "../../../shared/text.ts";
import type { GlossaryEntry } from "@/ui";
import { LINK_CLASS } from "../../app/links.tsx";
import { series } from "./model.ts";
import { lensGlossary } from "./sections.ts";

export const SCORE_WORDS = { audit: "аудит", critique: "критика" } as const;

/** What the scores are (improve-12 (3), design-13; ui → Glossary): whose scale each is and where its top band starts
 * (impeccable's own bands: audit 18–20, critique 36–40 «Excellent»), the arrow of a series, the critics who give
 * them. One constant, read once per set — on the reader's «Оценки раздела» label and the overview lead's «Оценки». */
export const SCORES_GLOSSARY: readonly GlossaryEntry[] = [
  { value: SCORE_WORDS.audit, meaning: "техническая проверка impeccable audit, из 20; от 18 — отлично" },
  { value: SCORE_WORDS.critique, meaning: "удобство по 10 эвристикам impeccable critique, из 40; от 36 — отлично" },
  { value: "8 → 9", meaning: "оценка раздела на каждом этапе прогона, в порядке этапов" },
  ...lensGlossary("craft"),
];

/** «аудит 16 → 17 → 16 из 20» in words, for a title and the tests. */
export function seriesText(scores: readonly SurfaceScore[], which: "audit" | "critique"): string {
  const s = series(scores, which);
  if (!s.points.length) return `${SCORE_WORDS[which]} —`;
  return `${SCORE_WORDS[which]} ${s.points.map((p) => num(p.value)).join(" → ")}${s.max === null ? "" : ` из ${num(s.max)}`}`;
}

export function ScoreSeries({ scores, which, hrefOf, current }: { scores: readonly SurfaceScore[]; which: "audit" | "critique"; hrefOf: (launch: string) => string | null; current?: string | null }) {
  const s = series(scores, which);
  return (
    <span data-slot={`score-${which}`} title={seriesText(scores, which)} className="whitespace-nowrap tabular-nums">
      <span className="text-muted-foreground">{SCORE_WORDS[which]}</span>{" "}
      {s.points.length === 0 && <span className="text-muted-foreground">—</span>}
      {s.points.map((p, i) => {
        const href = hrefOf(p.launch);
        const label = `${SCORE_WORDS[which]} ${p.value} — ${stageOf(p.stage).full}`;
        return (
          <Fragment key={`${p.launch}-${i}`}>
            {i > 0 && <span className="text-muted-foreground"> → </span>}
            {p.launch === current || !href ? (
              <span aria-current={p.launch === current ? "true" : undefined} title={label} className={p.launch === current ? "underline decoration-2 underline-offset-2" : undefined}>
                {num(p.value)}
              </span>
            ) : (
              <Link to={href} title={label} aria-label={label} className={LINK_CLASS}>
                {num(p.value)}
              </Link>
            )}
          </Fragment>
        );
      })}
      {s.max !== null && <span className="text-muted-foreground"> из {num(s.max)}</span>}
    </span>
  );
}

/** Both series of one surface: «аудит … · критика …». */
export function SurfaceScores({ scores, hrefOf, current }: { scores: readonly SurfaceScore[]; hrefOf: (launch: string) => string | null; current?: string | null }) {
  return (
    <span className="inline-flex flex-wrap items-baseline gap-x-2">
      <ScoreSeries scores={scores} which="audit" hrefOf={hrefOf} current={current} />
      <span aria-hidden="true" className="text-muted-foreground">
        ·
      </span>
      <ScoreSeries scores={scores} which="critique" hrefOf={hrefOf} current={current} />
    </span>
  );
}
