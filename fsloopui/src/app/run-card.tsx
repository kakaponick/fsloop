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
import { Clamp, Dot, flatItem, StatusDot, type DotState } from "../ui/index.ts";
import { runPath } from "./routes.ts";
import {
  activityLine,
  cardLabel,
  LIVENESS_WIDEST,
  livenessShown,
  miniDetail,
  NEW_MARK,
  NEW_MARK_TITLE,
  settingsParts,
  stageCompact,
  stageLine,
  unitsLine,
  VANISHED,
  waitsLine,
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

/** «новое» in a slot that is always there: shown or not, it takes the same room (Strict 1). */
function NewMark({ fresh, hidden = false }: { fresh: boolean; hidden?: boolean }) {
  return (
    <span data-slot="new-mark" title={fresh ? NEW_MARK_TITLE : undefined} aria-hidden={hidden || undefined} className={cn("shrink-0 text-xs text-muted-foreground", !fresh && "invisible")}>
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
  const parts = settingsParts(card);
  const waits = waitsLine(card);
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
          {waits.tone === "warning" ? (
            <span data-slot="card-waits" title={waits.text} className="flex h-[2lh] min-w-0 gap-1.5">
              <span className="flex h-lh shrink-0 items-center">
                <Dot tone="warning" />
              </span>
              <span className="line-clamp-2 min-w-0">{waits.text}</span>
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
            <span data-slot="card-settings" title={parts.map((p) => p.text).join(" · ")} className="line-clamp-2 min-h-[2lh] text-xs">
              {parts.map((p, i) => (
                <span key={`${i}-${p.text}`}>
                  {i > 0 && " · "}
                  <span data-slot="setting" className={cn("whitespace-nowrap", p.mono && "font-mono")}>
                    {p.text}
                  </span>
                </span>
              ))}
            </span>
          </span>
          <span className="block">
            <span className="flex items-baseline justify-between gap-2">
              <Caption>Состояние</Caption>
              <NewMark fresh={mark} hidden />
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

export function MiniRow({ card, now, lost, current, fresh, gone }: RunItemProps) {
  const detail = gone ? { tone: "neutral" as const, text: VANISHED } : miniDetail(card, now, { lost });
  const mark = fresh && !gone;
  return (
    <Item asChild size="xs" className="grid h-8 grid-cols-[auto_auto_minmax(0,1fr)_auto] items-baseline gap-2 px-2 py-0 leading-8 aria-[current=page]:bg-muted">
      <Link to={runPath(card.key)} aria-current={current ? "page" : undefined} title={`${card.project} · ${card.id} · ${detail.text}`} data-slot="mini-row" {...flatItem(card.key)}>
        <span className="font-semibold">{card.project}</span>
        <span className="font-mono text-xs text-muted-foreground">{card.id}</span>
        <span className="flex min-w-0 items-baseline justify-end text-xs">
          <StatusDot state={{ tone: detail.tone, label: detail.text }} truncate className={cn(detail.tone === "neutral" && "text-muted-foreground")} />
        </span>
        <NewMark fresh={mark} />
      </Link>
    </Item>
  );
}
