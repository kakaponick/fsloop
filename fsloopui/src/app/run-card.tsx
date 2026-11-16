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
  outcomeLine,
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

/** A run in a fold or in the narrow band: one line — project · id · its state. The project and the id keep their
 * words: the project gives way only past a third of the line, an outlier name; the state keeps its fact — the
 * liveness, the outcome — on the dot of its own tone, and what waits after it is the cause, on its own amber dot, cut
 * at its end (rules/ui → Conventions 1, Tables 5; p2-verdict craft-2; p2-verdict-critic-craft-verdict-4#craft-1). No clock time beside an age and no «новое» column, both in its name and title, «новое» also the
 * inset edge mark, which moves nothing (craft-4). A closed run takes a second reserved line: the push, when it closed
 * and its goal's first words, what tells one closed run from the next (p1-review cand-3) — in the narrow band
 * (`oneLine`), where every row is one 32 px line so the band's scroll never slices one (cand-10), that line follows
 * its state as its cause. Its height comes from whether the run is closed, never from a live change of its words
 * (Strict 1). */
export function MiniRow({ card, now, lost, current, fresh, gone, oneLine = false }: RunItemProps & { oneLine?: boolean }) {
  const detail: ReturnType<typeof miniDetail> = gone ? { tone: "neutral", fact: VANISHED, text: VANISHED } : miniDetail(card, now, { lost });
  const mark = fresh && !gone;
  const closed = card.closed === true;
  const second = closed && !oneLine;
  const waits = detail.waits;
  const cause = closed && oneLine ? ` · ${closedLine(card, now)}` : waits ? "" : detail.text.slice(detail.fact.length);
  // The name and the title say the whole state: a closed run's outcome with its push.
  const whole = closed && !gone ? outcomeLine(card.outcome).text : detail.text;
  return (
    <Item
      asChild
      size="xs"
      className={cn("snap-start flex-col flex-nowrap items-stretch justify-center gap-0 px-2 py-0 aria-[current=page]:bg-muted", second ? "h-12" : "h-8", mark && EDGE_MARK)}
    >
      <Link
        to={runPath(card.key)}
        aria-current={current ? "page" : undefined}
        aria-label={cardLabel(card, whole, mark)}
        title={miniTitle(card, whole, now, mark)}
        data-slot="mini-row"
        data-new={mark ? "" : undefined}
        {...flatItem(card.key)}
      >
        {/* 4 px between the parts: at the 316 px sidebar the widest project of this machine's runs, the id and «цель не
            достигнута» fit one line whole (p2-verdict craft-2); the state sits at the line's end, past any room left. */}
        <span data-slot="mini-line" className="flex min-w-0 items-baseline gap-1">
          <span data-slot="mini-project" className="max-w-[35%] shrink-0 truncate font-semibold">
            {card.project}
          </span>
          <span className="shrink-0 font-mono text-xs text-muted-foreground">{card.id}</span>
          <span
            data-slot="mini-state"
            data-tone={detail.tone}
            className={cn("flex min-w-0 grow items-baseline justify-end gap-1.5 overflow-hidden text-xs", detail.tone === "neutral" && "text-muted-foreground")}
          >
            <Dot tone={detail.tone} className="self-center" />
            <span data-slot="mini-text" className="flex min-w-0 items-baseline">
              <span data-slot="mini-fact" className="shrink-0 whitespace-pre">
                {detail.fact}
              </span>
              {/* What waits on its own amber dot where it begins, as the full card's «Ждёт вас» line: the liveness keeps
                  its own tone (p2-verdict-critic-craft-verdict-4#craft-1). The « ·» and the dot keep their place; only
                  the cause's words give way, at their end. */}
              {waits && (
                <span data-slot="mini-waits" className="flex min-w-0 items-baseline">
                  <span className="shrink-0 whitespace-pre">{" · "}</span>
                  <Dot tone="warning" className="mr-1.5 self-center" />
                  <span data-slot="mini-cause" className="min-w-0 overflow-hidden text-ellipsis whitespace-pre text-foreground">
                    {waits}
                  </span>
                </span>
              )}
              {cause && (
                <span data-slot="mini-cause" className={cn("min-w-0 overflow-hidden text-ellipsis whitespace-pre", closed && "text-muted-foreground")}>
                  {cause}
                </span>
              )}
            </span>
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
