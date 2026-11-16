// A run in the sidebar (shell → BLOCKS; the user's words: «карточка содержит: 1. проект 2. выбранные настройки
// текущего прогона 3. состояние текущего прогона»). A running run is a full card, any other a mini row; either is
// one link as a whole with nothing focusable inside (rules/ui → Conventions 8). Every line that a live change
// rewrites is one line, cut at its end with the whole in its title, and the outcome line is always reserved — a
// card never changes its height under the reader (rules/ui → Strict 1). The full facts are on the page it opens.
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { livenessOf } from "../../shared/liveness.ts";
import type { RunCard } from "../../shared/model.ts";
import { Item } from "@/components/ui/item";
import { cn } from "@/lib/utils";
import { Clamp, Dot, flatItem, StatusDot } from "../ui/index.ts";
import { runPath } from "./routes.ts";
import { activityLine, miniDetail, NEW_MARK, settingsParts, stageLine, unitsLine, VANISHED, waitsLine } from "./words.ts";

export interface RunItemProps {
  card: RunCard;
  now: number;
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

export function RunCardItem({ card, now, current, fresh, gone }: RunItemProps) {
  const live = livenessOf(card.lastWriteAt, now, { closed: card.closed === true });
  const parts = settingsParts(card);
  const settings = parts.map((p) => p.text).join(" · ");
  const stage = stageLine(card, now);
  const units = unitsLine(card.units, card.unitsTotal);
  const activity = activityLine(card, now);
  const waits = waitsLine(card);
  return (
    <Item asChild variant="outline" className="flex-col flex-nowrap items-stretch gap-2 px-3 py-2.5 aria-[current=page]:border-foreground aria-[current=page]:bg-muted">
      <Link to={runPath(card.key)} aria-current={current ? "page" : undefined} data-slot="run-card" {...flatItem(card.key)}>
        <span className="flex min-w-0 items-baseline gap-2">
          <span data-slot="card-project" className="min-w-0 truncate text-base font-semibold">
            {card.project}
          </span>
          <span data-slot="card-id" className="shrink-0 font-mono text-xs text-muted-foreground">
            {card.id}
          </span>
          {fresh && !gone && <span className="shrink-0 text-xs text-muted-foreground">{NEW_MARK}</span>}
          <span data-slot="card-liveness" className="ml-auto shrink-0 text-xs">
            <StatusDot state={gone ? { tone: "neutral", label: VANISHED } : live} />
          </span>
        </span>
        {card.goal && (
          <span data-slot="card-goal" className="block text-muted-foreground">
            <Clamp what="цель прогона" expandable={false}>
              {card.goal}
            </Clamp>
          </span>
        )}
        <span className="block">
          <Caption>Настройки</Caption>
          {/* Two lines, always: a settings line the run's models lengthen moves nothing. */}
          <span data-slot="card-settings" title={settings} className="line-clamp-2 min-h-[2lh] text-xs">
            {parts.map((p, i) => (
              <span key={`${i}-${p.text}`}>
                {i > 0 && " · "}
                <span className={cn(p.mono && "font-mono")}>{p.text}</span>
              </span>
            ))}
          </span>
        </span>
        <span className="block">
          <Caption>Состояние</Caption>
          <Line slot="card-stage" title={stage}>
            {stage}
          </Line>
          <Line slot="card-units" title={units} className="text-xs tabular-nums">
            {units}
          </Line>
          <Line slot="card-activity" title={activity} className="text-xs text-muted-foreground tabular-nums">
            {activity}
          </Line>
          <span data-slot="card-waits" title={waits.tone === "warning" ? waits.text : undefined} className="flex h-lh min-w-0 items-center gap-1.5 text-xs">
            {waits.tone === "warning" && (
              <>
                <Dot tone="warning" />
                <span className="truncate">{waits.text}</span>
              </>
            )}
          </span>
        </span>
      </Link>
    </Item>
  );
}

export function MiniRow({ card, now, current, fresh, gone }: RunItemProps) {
  const detail = gone ? { tone: "neutral" as const, text: VANISHED } : miniDetail(card, now);
  return (
    <Item asChild size="xs" className="grid h-8 grid-cols-[auto_auto_minmax(0,1fr)] items-baseline gap-2 px-2 py-0 leading-8 aria-[current=page]:bg-muted">
      <Link to={runPath(card.key)} aria-current={current ? "page" : undefined} title={`${card.project} · ${card.id} · ${detail.text}`} data-slot="mini-row" {...flatItem(card.key)}>
        <span className="font-semibold">{card.project}</span>
        <span className="font-mono text-xs text-muted-foreground">{card.id}</span>
        <span className="flex min-w-0 items-baseline justify-end gap-1.5 text-xs">
          {fresh && !gone && <span className="shrink-0 text-muted-foreground">{NEW_MARK}</span>}
          <StatusDot state={{ tone: detail.tone, label: detail.text }} truncate className={cn(detail.tone === "neutral" && "text-muted-foreground")} />
        </span>
      </Link>
    </Item>
  );
}
