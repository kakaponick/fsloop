// The run page's fact list in `ux 9` order (rules/ui → Layout 3): outcome rows — the stage, the liveness, what
// waits on the operator, the units — then the verdict of a closed run, then the settings in one muted row; the
// counts and the facts decided by least fold behind «Подробнее». Every value is drawn from the card, so the rows stand
// before the run is read. A value a live change rewrites is one line, the whole of it in its title, so the header
// keeps its height (rules/ui → Strict 1); what waits on the operator is one row per cause, each in full with links
// to its finding or unit — the one fact that asks for him is never cut (`ui` → Page chrome) — in a box held at the
// height it first took, so a cause that arrives live scrolls inside it. The words a new reader may not know — the
// liveness word, each cause — are glossary terms (ux 0).
import { useLayoutEffect, useRef, type ReactNode } from "react";
import { LIVENESS, type LivenessValue } from "../../shared/liveness.ts";
import type { RunCard } from "../../shared/model.ts";
import { count, duration, mskDateTime, mskTime, NOUNS } from "../../shared/text.ts";
import { Dash, Dot, GlossaryTooltip, glossaryFrom, NotRecorded, RunningText, StatusDot, type Fact } from "../ui/index.ts";
import type { LoadedRun } from "../views/index.ts";
import { cn } from "@/lib/utils";
import { resolverFor, routerLink } from "./links.tsx";
import {
  dataFromText,
  launchesLine,
  LIVENESS_TERMS,
  livenessShown,
  NO_RECORD,
  NOTHING_WAITS,
  outcomeLine,
  settingsParts,
  stageLine,
  unitsLine,
  waitCauses,
  WAITS_GLOSSARY,
  type WaitCause,
} from "./words.ts";

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

const LIVENESS_GLOSSARY = glossaryFrom(LIVENESS, LIVENESS_TERMS);
const GLOSSED = new Set<string>(LIVENESS_TERMS);

/** «работает · последняя запись 19:40 МСК» with the state's word as a glossary term; while the connection is lost,
 * «данные от 19:41 МСК» on a neutral dot — nothing past the data's time is claimed. */
function Liveness({ live, lastWriteAt, now }: { live: LivenessValue & { lost: boolean }; lastWriteAt: string | null; now: number }) {
  const lastWrite = lastWriteAt ? `последняя запись ${mskTime(lastWriteAt, now)}` : null;
  const word = live.lost ? dataFromText(now, now) : live.label;
  const whole = [word, lastWrite].filter(Boolean).join(" · ");
  if (live.lost || !GLOSSED.has(live.state)) {
    return (
      <One title={whole}>
        <StatusDot state={{ tone: live.tone, label: word }} detail={[lastWrite]} truncate />
      </One>
    );
  }
  const term = LIVENESS[live.state].compact;
  const rest = [live.label.slice(term.length).replace(/^ · /, ""), lastWrite].filter(Boolean).join(" · ");
  return (
    <One title={whole}>
      {/* StatusDot's look, its word a glossary term: the dot, then «работает · …» in regular text. */}
      <span data-tone={live.tone} className="inline-flex max-w-full min-w-0 items-baseline gap-1.5">
        <Dot tone={live.tone} className="self-center" />
        <span className="truncate">
          <GlossaryTooltip term={term} entries={LIVENESS_GLOSSARY} />
          {rest && ` · ${rest}`}
        </span>
      </span>
    </One>
  );
}

/** A box whose height is set once, from what it first holds, up to six lines, and kept through every live change of
 * its content: a cause that arrives or leaves scrolls inside it and never moves the rows under it (rules/ui →
 * Strict 1). Only a new width — the operator's own resize — measures it again. */
function HeldBox({ slot, children }: { slot: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const box = ref.current;
    if (!box) return;
    let width: number | null = null;
    const measure = () => {
      if (box.clientWidth === width) return;
      width = box.clientWidth;
      box.style.height = "";
      box.style.height = `${box.offsetHeight}px`;
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(box);
    return () => observer.disconnect();
  }, []);
  return (
    <div ref={ref} data-slot={slot} className="max-h-[6lh] overflow-y-auto [scrollbar-gutter:stable]">
      {children}
    </div>
  );
}

/** One row per cause, each wrapping to its whole text, its ids linked once the run is read; held in its box. */
function Waits({ causes, run }: { causes: WaitCause[]; run: LoadedRun | null }) {
  const resolve = run ? resolverFor(run) : undefined;
  return (
    <HeldBox slot="waits-box">
      {causes.length ? (
        <ul data-slot="waits" className="m-0 flex list-none flex-col gap-1 p-0">
          {causes.map((cause, i) => (
            <li key={`${cause.kind}-${i}`} data-slot="wait" data-kind={cause.kind} className="grid grid-cols-[auto_auto_minmax(0,1fr)] items-baseline gap-x-1.5">
              <span className="flex h-lh items-center self-start">
                <Dot tone="warning" />
              </span>
              <GlossaryTooltip term={cause.term} entries={WAITS_GLOSSARY} className="whitespace-nowrap" />
              {cause.text ? <RunningText text={cause.text} measure={false} resolve={resolve} renderLink={routerLink} className="pl-0.5" /> : <span />}
            </li>
          ))}
        </ul>
      ) : (
        <StatusDot state={{ tone: "neutral", label: NOTHING_WAITS }} className="text-muted-foreground" />
      )}
    </HeldBox>
  );
}

/** The settings in one muted row: «worktree · до 2 проходов · до 3 юнитов сразу · claude-opus-5-5», an identifier
 * never broken inside. */
function Settings({ card }: { card: RunCard }) {
  const parts = settingsParts(card);
  if (!parts.length) return dash;
  return (
    <span data-slot="settings" className="block text-muted-foreground">
      {parts.map((p, i) => (
        <span key={`${i}-${p.text}`}>
          {i > 0 && " · "}
          <span className={cn("whitespace-nowrap", p.mono && "font-mono text-xs")}>{p.text}</span>
        </span>
      ))}
    </span>
  );
}

export interface RunFactsOptions {
  /** The run once read: its ids link, its launch count is the model's. */
  run?: LoadedRun | null;
  /** The connection is lost: `now` is the data's time. */
  lost?: boolean;
}

export function runFacts(card: RunCard, now: number, { run = null, lost = false }: RunFactsOptions = {}): { facts: Fact[]; more: Fact[] } {
  const live = livenessShown(card, now, lost);
  const activity: Fact = { label: "Активность", outcome: true, value: <Liveness live={live} lastWriteAt={card.lastWriteAt} now={now} /> };
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
        ...(card.mode ? [{ label: "Настройки", value: <Settings card={card} /> }] : []),
      ],
      more: [folder],
    };

  const verdict = outcomeLine(card.outcome);
  const end = card.closed ? card.updatedAt : null;
  const facts: Fact[] = [
    { label: "Этап", outcome: true, value: text(stageLine(card, now)) },
    ...(card.closed ? [] : [activity, { label: "Ждёт вас", outcome: true, value: <Waits causes={waitCauses(card)} run={run} /> }]),
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
    { label: "Настройки", value: <Settings card={card} /> },
  ];
  const more: Fact[] = [
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
    { label: "Запуски агентов", value: text(launchesLine(run?.launchCount ?? card.launchCount, card.running)) },
    { label: "Коммиты", value: card.commits === null ? notRecorded : text(count(card.commits, NOUNS.commit)) },
    { label: "Зеркало .spike", value: card.mirror === null ? notRecorded : text(card.mirror ? "да" : "нет") },
    { label: "Рабочая копия", value: card.worktree ? text(card.worktree, true) : dash },
    { label: "Сессии", value: card.sessions.length ? text(card.sessions.join(", "), true) : dash },
    folder,
    { label: "Версия run.json", value: card.version === null ? notRecorded : text(String(card.version)) },
  ];
  return { facts, more };
}
