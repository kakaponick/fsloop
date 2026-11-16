// A run in the sidebar (shell → BLOCKS; the user's words: «карточка содержит: 1. проект 2. выбранные настройки
// текущего прогона 3. состояние текущего прогона»). A running run is a full card in the sidebar's column, any other
// — and every run in the narrow band — a mini row; either is one link as a whole with nothing focusable inside
// (rules/ui → Conventions 8), named by «project · id · liveness», the rest of the card its description. Nothing a
// live change rewrites moves a neighbour or the card's height (rules/ui → Strict 1): the liveness has a box at its
// widest form, «новое» a reserved slot, the line under the head two reserved lines — what waits on the operator,
// else the goal — and every state line is one line, compact, the whole of it in its title.
import { useId, type ReactNode } from "react";
import { Link } from "react-router-dom";
import type { RunCard } from "../../shared/model.ts";
import { Item } from "@/components/ui/item";
import { cn } from "@/lib/utils";
import { Clamp, Dot, EDGE_MARK, flatItem, StatusDot, type DotState } from "../ui/index.ts";
import { runPath } from "./routes.ts";
import { SettingsParts } from "./settings.tsx";
import {
  activityLine,
  cardLabel,
  closedLine,
  LIVENESS_WIDEST,
  livenessShown,
  miniDetail,
  miniTitle,
  NEW_MARK,
  NEW_MARK_TITLE,
  settingsLine,
  stageCompact,
  stageLine,
  unitsLine,
  VANISHED,
  waitsLine,
  waitsShort,
} from "./words.ts";

export interface RunItemProps {
  card: RunCard;
  /** The shell's «now»: the data's time while the connection is lost. */
  now: number;
  /** The connection is lost: the liveness is not confirmed. */
  lost: boolean;
  /** The run the page shows. */
  current: boolean;
  /** Changed since the operator last opened it, or placed new by the strip. */
  fresh: boolean;
  /** Its folder is gone. */
  gone: boolean;
}

function Line({ slot, title, className, children }: { slot: string; title?: string; className?: string; children: ReactNode }) {
  return (
    <span data-slot={slot} title={title} className={cn("block truncate", className)}>
      {children}
    </span>
  );
}

function Caption({ children }: { children: ReactNode }) {
  return <span className="block text-xs text-muted-foreground">{children}</span>;
}

/** «новое» in a slot that is always there: shown or not, it takes the same room (Strict 1). The card's name carries
 * it for assistive technology. */
function NewMark({ fresh }: { fresh: boolean }) {
  return (
    <span data-slot="new-mark" title={fresh ? NEW_MARK_TITLE : undefined} aria-hidden="true" className={cn("shrink-0 text-xs text-muted-foreground", !fresh && "invisible")}>
      {NEW_MARK}
    </span>
  );
}

/** The liveness in a box as wide as its widest form: «работает» turning «молчит · 12 мин» re-cuts nothing. */
function LivenessBox({ state }: { state: DotState }) {
  return (
    <span data-slot="card-liveness" className="ml-auto grid shrink-0 justify-items-end text-xs">
      {/* Each sizer draws its words as generated content: it takes their room and is no text anyone reads. */}
      {[LIVENESS_WIDEST, VANISHED].map((widest) => (
        <span
          key={widest}
          aria-hidden="true"
          data-slot="liveness-sizer"
          data-text={widest}
          className="invisible inline-flex items-baseline gap-1.5 whitespace-nowrap [grid-area:1/1] after:content-[attr(data-text)]"
        >
          <span className="size-dot shrink-0" />
        </span>
      ))}
      <StatusDot state={state} truncate className="[grid-area:1/1]" />
    </span>
  );
}

export function RunCardItem({ card, now, lost, current, fresh, gone }: RunItemProps) {
  const describedBy = useId();
  const live = livenessShown(card, now, lost);
  const state: DotState = gone ? { tone: "neutral", label: VANISHED } : { tone: live.tone, label: live.label };
  const mark = fresh && !gone;
  const waits = waitsLine(card);
  const waitsFew = waitsShort(card);
  return (
    <Item asChild variant="outline" className="flex-col flex-nowrap items-stretch gap-2 px-3 py-2.5 aria-[current=page]:border-foreground aria-[current=page]:bg-muted">
      <Link
        to={runPath(card.key)}
        aria-current={current ? "page" : undefined}
        aria-label={cardLabel(card, gone ? VANISHED : live.label, mark)}
        aria-describedby={describedBy}
        data-slot="run-card"
        {...flatItem(card.key)}
      >
        <span className="flex min-w-0 items-baseline gap-2">
          <span data-slot="card-project" title={card.project} className="min-w-0 truncate text-base font-semibold">
            {card.project}
          </span>
          <span data-slot="card-id" className="shrink-0 font-mono text-xs text-muted-foreground">
            {card.id}
          </span>
          <LivenessBox state={state} />
        </span>
        <span id={describedBy} className="flex flex-col gap-2">
          {/* Two lines, always: what waits on the operator when anything does, else the goal — a gate that arrives
              takes the goal's place and moves nothing. */}
          {waitsFew ? (
            <span data-slot="card-waits" title={waits.text} className="flex h-[2lh] min-w-0 gap-1.5">
              <span className="flex h-lh shrink-0 items-center">
                <Dot tone="warning" />
              </span>
              {/* Every cause in a few words, so none is cut (cand-5); the whole of each is the title and the page's. */}
              <span className="line-clamp-2 min-w-0">{waitsFew}</span>
            </span>
          ) : (
            <span data-slot="card-goal" className="block h-[2lh] text-muted-foreground">
              {card.goal && (
                <Clamp what="цель прогона" expandable={false}>
                  {card.goal}
                </Clamp>
              )}
            </span>
          )}
          <span className="block">
            <Caption>Настройки</Caption>
            {/* Two lines, always: a settings line the run's models lengthen moves nothing; an identifier never breaks. */}
            <span data-slot="card-settings" title={settingsLine(card)} className="line-clamp-2 min-h-[2lh] text-xs">
              <SettingsParts card={card} />
            </span>
          </span>
          <span className="block">
            <span className="flex items-baseline justify-between gap-2">
              <Caption>Состояние</Caption>
              <NewMark fresh={mark} />
            </span>
            <Line slot="card-stage" title={stageLine(card, now)}>
              {stageCompact(card, now)}
            </Line>
            <Line slot="card-units" title={unitsLine(card.units, card.unitsTotal)} className="text-xs tabular-nums">
              {unitsLine(card.units, card.unitsTotal)}
            </Line>
            <Line slot="card-activity" title={activityLine(card, now)} className="text-xs text-muted-foreground tabular-nums">
              {activityLine(card, now, { compact: true })}
            </Line>
          </span>
        </span>
      </Link>
    </Item>
  );
}

/** A run in a fold or in the narrow band: one line — project · id · its state, the state's words whole and the
 * project cut first; no clock time beside an age and no «новое» column, both in its name and title, «новое» also the
 * inset edge mark, which moves nothing (craft-4). A closed run takes a second reserved line: when it closed and its
 * goal's first words, what tells one closed run from the next (p1-review cand-3). Its height comes from whether the
 * run is closed, never from a live change of its words (Strict 1). */
export function MiniRow({ card, now, lost, current, fresh, gone }: RunItemProps) {
  const detail = gone ? { tone: "neutral" as const, text: VANISHED } : miniDetail(card, now, { lost });
  const mark = fresh && !gone;
  const second = card.closed === true;
  return (
    <Item
      asChild
      size="xs"
      className={cn("flex-col flex-nowrap items-stretch justify-center gap-0 px-2 py-0 aria-[current=page]:bg-muted", second ? "h-12" : "h-8", mark && EDGE_MARK)}
    >
      <Link
        to={runPath(card.key)}
        aria-current={current ? "page" : undefined}
        aria-label={cardLabel(card, detail.text, mark)}
        title={miniTitle(card, detail.text, now, mark)}
        data-slot="mini-row"
        data-new={mark ? "" : undefined}
        {...flatItem(card.key)}
      >
        <span className="flex min-w-0 items-baseline gap-2">
          {/* Both shrink from their own width, the project a hundred times faster: an outlier name cuts first. */}
          <span data-slot="mini-project" className="min-w-0 shrink-[100] truncate font-semibold">
            {card.project}
          </span>
          <span className="shrink-0 font-mono text-xs text-muted-foreground">{card.id}</span>
          <span className="flex min-w-0 grow items-baseline justify-end text-xs">
            <StatusDot state={{ tone: detail.tone, label: detail.text }} truncate className={cn(detail.tone === "neutral" && "text-muted-foreground")} />
          </span>
        </span>
        {second && (
          <span data-slot="mini-goal" className="block truncate text-xs text-muted-foreground">
            {closedLine(card, now)}
          </span>
        )}
      </Link>
    </Item>
  );
}
