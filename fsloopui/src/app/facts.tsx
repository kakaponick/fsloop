// The run page's fact list in `ux 9` order (rules/ui → Layout 3): outcome rows — the stage, the liveness, what
// waits on the operator, the units — then the verdict of a closed run, then the settings and counts; the facts
// decided by least fold behind «Подробнее». Every value is drawn from the card, so the rows stand before the run
// is read, and every value is one line, the whole of it in its title: a live change never changes the header's
// height (rules/ui → Strict 1).
import type { ReactNode } from "react";
import { livenessOf } from "../../shared/liveness.ts";
import type { RunCard } from "../../shared/model.ts";
import { count, duration, mskDateTime, mskTime, NOUNS, num } from "../../shared/text.ts";
import { Dash, NotRecorded, StatusDot, type Fact } from "../ui/index.ts";
import { cn } from "@/lib/utils";
import { launchesLine, NO_RECORD, outcomeLine, stageLine, unitsLine, upTo, waitsLine } from "./words.ts";

/** One line of a value, cut at the end, the whole of it in its title. */
function One({ title, mono = false, children }: { title?: string; mono?: boolean; children: ReactNode }) {
  return (
    <span title={title} className={cn("block truncate", mono && "font-mono text-xs")}>
      {children}
    </span>
  );
}

const text = (s: string, mono = false) => (
  <One title={s} mono={mono}>
    {s}
  </One>
);
const notRecorded = (
  <One>
    <NotRecorded />
  </One>
);
const dash = (
  <One>
    <Dash />
  </One>
);

export function runFacts(card: RunCard, now: number): { facts: Fact[]; more: Fact[] } {
  const live = livenessOf(card.lastWriteAt, now, { closed: card.closed === true });
  const lastWrite = card.lastWriteAt ? `последняя запись ${mskTime(card.lastWriteAt, now)}` : null;
  const activity: Fact = {
    label: "Активность",
    outcome: true,
    value: (
      <One title={[live.label, lastWrite].filter(Boolean).join(" · ")}>
        <StatusDot state={live} detail={[lastWrite]} truncate />
      </One>
    ),
  };
  const folder: Fact = { label: "Папка прогона", value: text(card.dir, true) };

  if (!card.recorded)
    return {
      facts: [
        {
          label: "Этап",
          outcome: true,
          value: (
            <One>
              <NotRecorded cause={NO_RECORD} />
            </One>
          ),
        },
        activity,
        ...(card.mode ? [{ label: "Режим", value: text(card.mode, true) }] : []),
      ],
      more: [folder],
    };

  const waits = waitsLine(card);
  const verdict = outcomeLine(card.outcome);
  const end = card.closed ? card.updatedAt : null;
  const facts: Fact[] = [
    { label: "Этап", outcome: true, value: text(stageLine(card, now)) },
    ...(card.closed
      ? []
      : [
          activity,
          {
            label: "Ждёт вас",
            outcome: true,
            value: (
              <One title={waits.text}>
                <StatusDot state={{ tone: waits.tone, label: waits.text }} truncate className={cn(waits.tone === "neutral" && "text-muted-foreground")} />
              </One>
            ),
          },
        ]),
    { label: "Юниты", outcome: true, value: text(unitsLine(card.units, card.unitsTotal)) },
    ...(card.closed
      ? [
          {
            label: "Итог",
            outcome: true,
            value: (
              <One title={verdict.text}>
                <StatusDot state={{ tone: verdict.tone, label: verdict.text }} truncate />
              </One>
            ),
          },
        ]
      : []),
    { label: "Режим", value: card.mode ? text(card.mode, true) : notRecorded },
    { label: "Проходы", value: card.N ? text(upTo(card.N, NOUNS.pass)) : notRecorded },
    { label: "Юнитов сразу", value: card.K ? text(`до ${num(card.K)}`) : notRecorded },
    { label: "Модели", value: card.models.length ? text(card.models.join(", "), true) : dash },
    {
      label: "Начат",
      value: card.startedAt ? (
        <One title={mskDateTime(card.startedAt)}>
          <span className="tabular-nums">{mskTime(card.startedAt, now)}</span>
        </One>
      ) : (
        notRecorded
      ),
    },
    { label: "Длительность", value: card.startedAt ? text(duration((end ? Date.parse(end) : now) - Date.parse(card.startedAt))) : notRecorded },
    { label: "Запуски агентов", value: text(launchesLine(card)) },
    { label: "Коммиты", value: card.commits === null ? notRecorded : text(count(card.commits, NOUNS.commit)) },
  ];
  const more: Fact[] = [
    { label: "Зеркало .spike", value: card.mirror === null ? notRecorded : text(card.mirror ? "да" : "нет") },
    { label: "Рабочая копия", value: card.worktree ? text(card.worktree, true) : dash },
    { label: "Сессии", value: card.sessions.length ? text(card.sessions.join(", "), true) : dash },
    folder,
    { label: "Версия run.json", value: card.version === null ? notRecorded : text(String(card.version)) },
  ];
  return { facts, more };
}
