// The run page's fact list in `ux 9` order (rules/ui → Layout 3): outcome rows — the stage, the liveness, what
// waits on the operator, the units — then the verdict of a closed run, then the settings in one muted row; the
// counts and the facts decided by least fold behind «Подробнее». Every value is drawn from the card, so the rows stand
// before the run is read — the finished passes alone wait for the run, in a row reserved for them. A value a live
// change rewrites is one line, the whole of it in its title, so the header keeps its height (rules/ui → Strict 1);
// what waits on the operator is one row per cause, each in full with links to its finding or unit — the one fact that
// asks for him is never cut (`ui` → Page chrome) — in a box held at the height it first took, at least two lines, so
// a cause that arrives live never moves the rows under it, and the causes past its end are counted on its last line.
// The words a new reader may not know are explained on the label that names them (ux 0; `ui` → Glossary): the
// liveness words on «Активность», the causes on «Ждёт вас», the mode, «проход» and the mirror on «Настройки», the
// pass outcomes on «Проходы» — the values read plain (craft-21, cand-8).
import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { LIVENESS, type LivenessValue } from "../../shared/liveness.ts";
import type { RunCard } from "../../shared/model.ts";
import { count, duration, mskDateTime, mskTime, NOUNS } from "../../shared/text.ts";
import { Dash, Dot, glossaryFrom, Loading, NotRecorded, RunningText, StatusDot, type Fact } from "../ui/index.ts";
import type { LoadedRun } from "../views/index.ts";
import { cn } from "@/lib/utils";
import { resolverFor, routerLink } from "./links.tsx";
import { SettingsParts } from "./settings.tsx";
import {
  dataFromText,
  launchesLine,
  LIVENESS_TERMS,
  livenessShown,
  NO_RECORD,
  NOTHING_WAITS,
  outcomeLine,
  PASSES_GLOSSARY,
  passesLine,
  settingsGlossary,
  settingsParts,
  spendLine,
  stageLine,
  unitsLine,
  waitCauses,
  WAITS_GLOSSARY,
  waitsMoreText,
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

const text = (s: string, mono = false, title = s) => (
  <One title={title} mono={mono}>
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

/** «работает · последняя запись 19:40 МСК»; while the connection is lost, «данные от 19:41 МСК» on a neutral dot —
 * nothing past the data's time is claimed. */
function Liveness({ live, lastWriteAt, now }: { live: LivenessValue & { lost: boolean }; lastWriteAt: string | null; now: number }) {
  const lastWrite = lastWriteAt ? `последняя запись ${mskTime(lastWriteAt, now)}` : null;
  const word = live.lost ? dataFromText(now, now) : live.label;
  return (
    <One title={[word, lastWrite].filter(Boolean).join(" · ")}>
      <StatusDot state={{ tone: live.tone, label: word }} detail={[lastWrite]} truncate />
    </One>
  );
}

/** How many causes a held box of `height` hides: none when the last one ends inside it; otherwise its last line goes
 * to «ещё N», and every cause that starts on or below that line is counted (craft-9). Rows are measured from the
 * box's top. */
export function hiddenCauses(height: number, rows: readonly { top: number; bottom: number }[], line: number): number {
  if (!rows.length || rows[rows.length - 1].bottom <= height + 0.5) return 0;
  const limit = height - line;
  return rows.filter((r) => r.top >= limit - 0.5).length;
}

/** The causes a held box hides now, from its rows as laid out (none before the box is held). */
function hiddenIn(box: HTMLElement): number {
  if (!box.style.height) return 0;
  const line = Number.parseFloat(getComputedStyle(box).lineHeight) || 20;
  const rows = [...box.querySelectorAll<HTMLElement>("[data-slot=wait]")].map((r) => ({ top: r.offsetTop, bottom: r.offsetTop + r.offsetHeight }));
  return hiddenCauses(Number.parseFloat(box.style.height), rows, line);
}

/** A box whose height is set once, from what it first holds — at least two lines, at most six — and kept through
 * every live change of its content: a cause that arrives never moves the rows under it (rules/ui → Strict 1). The
 * causes that start past its last line are counted there, «ещё 2 · показать», never left to a bare scrollbar; the
 * operator's click lets the box take them all (up to six lines, scrolling past). Only a new width — the operator's
 * own resize — measures it again (craft-9). */
function HeldBox({ slot, children }: { slot: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [hidden, setHidden] = useState(0);
  const [open, setOpen] = useState(false);
  const opened = useRef(false);

  useLayoutEffect(() => {
    const box = ref.current;
    if (!box) return;
    let width: number | null = null;
    const measure = () => {
      if (box.clientWidth === width) return;
      width = box.clientWidth;
      if (opened.current) return;
      box.style.height = "";
      box.style.height = `${box.offsetHeight}px`;
      setHidden(hiddenIn(box));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(box);
    return () => observer.disconnect();
  }, []);

  // A live change of the causes: count again what the held box hides.
  useLayoutEffect(() => {
    if (ref.current && !opened.current) setHidden(hiddenIn(ref.current));
  }, [children]);

  const showAll = () => {
    opened.current = true;
    if (ref.current) ref.current.style.height = "";
    setOpen(true);
    setHidden(0);
  };
  const more = open ? 0 : hidden;
  return (
    <div ref={ref} data-slot={slot} className={cn("relative max-h-[6lh] min-h-[2lh] [scrollbar-gutter:stable]", more ? "overflow-hidden" : "overflow-y-auto")}>
      {children}
      {more > 0 && (
        <button
          type="button"
          onClick={showAll}
          className="absolute inset-x-0 bottom-0 h-lh rounded-sm bg-background text-left text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {waitsMoreText(more)}
        </button>
      )}
    </div>
  );
}

/** One row per cause, each wrapping to its whole text, its ids linked once the run is read; held in its box. The
 * cause's word reads plain: «Ждёт вас» explains it. */
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
              <span data-slot="wait-term" className="whitespace-nowrap">
                {cause.term}
              </span>
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

/** The settings in one muted row: «worktree · до 2 проходов · до 3 юнитов сразу · claude-opus-5-5». */
function Settings({ card }: { card: RunCard }) {
  if (!settingsParts(card).length) return dash;
  return (
    <span data-slot="settings" className="block text-muted-foreground">
      <SettingsParts card={card} mono="font-mono text-xs" />
    </span>
  );
}

/** The settings' fact, its label explaining the words its row shows. */
function settingsFact(card: RunCard): Fact {
  const glossary = settingsGlossary(card);
  return { label: "Настройки", value: <Settings card={card} />, glossary: glossary.length ? glossary : undefined };
}

export interface RunFactsOptions {
  /** The run once read: its ids link, its launch count is the model's. */
  run?: LoadedRun | null;
  /** The connection is lost: `now` is the data's time. */
  lost?: boolean;
}

export function runFacts(card: RunCard, now: number, { run = null, lost = false }: RunFactsOptions = {}): { facts: Fact[]; more: Fact[] } {
  const live = livenessShown(card, now, lost);
  const activity: Fact = { label: "Активность", outcome: true, glossary: LIVENESS_GLOSSARY, value: <Liveness live={live} lastWriteAt={card.lastWriteAt} now={now} /> };
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
        ...(card.mode ? [settingsFact(card)] : []),
      ],
      more: [folder],
    };

  const verdict = outcomeLine(card.outcome);
  const end = card.closed ? card.updatedAt : null;
  const spend = spendLine(card.spend);
  const passes = run ? passesLine(run.passes) : null;
  const facts: Fact[] = [
    { label: "Этап", outcome: true, value: text(stageLine(card, now)) },
    ...(card.closed ? [] : [activity, { label: "Ждёт вас", outcome: true, glossary: WAITS_GLOSSARY, value: <Waits causes={waitCauses(card)} run={run} /> }]),
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
    settingsFact(card),
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
    // p1-decompose-u3-shape cand-2 · what the run spent, agents and orchestrator together, the split in the title.
    { label: "Токены", value: spend ? text(spend.text, false, spend.title) : notRecorded },
    // p1-decompose-design-check cand-1 · the finished passes, a row only where the run has passes (N); the run's own
    // record, so the row holds «Загрузка…» in its one line until the run is read.
    ...(card.N ? [{ label: "Проходы", glossary: PASSES_GLOSSARY, value: passes ? text(passes.text, false, passes.title) : <Loading className="h-lh w-auto justify-start" /> }] : []),
    { label: "Коммиты", value: card.commits === null ? notRecorded : text(count(card.commits, NOUNS.commit)) },
    { label: "Зеркало .spike", value: card.mirror === null ? notRecorded : text(card.mirror ? "да" : "нет") },
    { label: "Рабочая копия", value: card.worktree ? text(card.worktree, true) : dash },
    { label: "Сессии", value: card.sessions.length ? text(card.sessions.join(", "), true) : dash },
    folder,
    { label: "Версия run.json", value: card.version === null ? notRecorded : text(String(card.version)) },
  ];
  return { facts, more };
}
