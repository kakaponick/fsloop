// What a unit's row expands into (surfaces/units.md → BLOCKS → expanded detail; rules/ui → Tables 3, Layout 5): the
// findings it closes first — a unit's row expands into its findings, each expanding in place into the shared article,
// as a report's do in «Отчёты» — then the facts the row does not already show, its agent launches and its checks, each
// list under its section's heading and one muted header row. The detail grows in the table's own scroll box; it has
// no scroll of its own. Every absent value is the shared part for it — «не найден», «не записано» — and a brief that
// failed to read fails here, in its own place (Conventions 4, 5, 14).
//
// An open detail never moves under a live run (rules/ui → Strict 1): its fact rows are the ones it opened with — a
// value that empties reads «—» in place — and each list keeps its lines, a line that arrives waiting in the held-order
// strip of its section's heading line until the user places it. The next open derives everything again.
import { useState, type ReactNode } from "react";
import type { Finding, Run, Unit, UnitCheck } from "../../../shared/model.ts";
import { agentKind, launchState, UNIT_STATE } from "../../../shared/states.ts";
import { mskDateTime, mskTime, tokens } from "../../../shared/text.ts";
import { cn } from "@/lib/utils";
import { Dash, FactList, Fold, GlossaryTooltip, HeldStrip, NotRecorded, PartFailed, StatusDot, type Fact, type GlossaryEntry, type HeldNoun } from "@/ui";
// From the files, not the index: the index reaches the app's links, which reach this view (a cycle at load time).
import { ExpandingFindings } from "@/finding/expanding.tsx";
import { ObjectLink } from "../../app/links.tsx";
import { TITLE_MIN } from "./columns.tsx";
import { useHeld } from "./held.ts";
import { briefFailure, checkGroups, closingIds, launchRows, type CheckLine } from "./query.ts";
import { attemptsText, briefPart, CHECK_HEAD, closesTitle, FACT, HELD_NOUN, LAUNCH_HEAD, LAUNCH_STATE_GLOSSARY, LOG_LINE_GLOSSARY, LOG_WORD, PROVENANCE_FOLD, PROVENANCE_LABEL, SECTION } from "./words.ts";

type DetailRun = Pick<Run, "id" | "units" | "findings" | "launches" | "running" | "journal" | "errors"> & { key: string };

export interface UnitDetailProps {
  run: DetailRun;
  unit: Unit;
  /** The unit's checks; null while the run model does not carry them («не записано»). */
  checks: readonly UnitCheck[] | null;
  /** The shared clock. */
  now: number;
}

/** The characters «Что делает» shows at its floor (13 px text, about 7 px a character): a longer title may be cut in
 * the row, so the detail gives it whole; a shorter one the row already shows (ux 2). */
export const ROW_TITLE_CHARS = Math.floor((TITLE_MIN - 16) / 7);

/** The lists' columns: one template per list, shared by its header row and its lines so they align. */
const LAUNCH_GRID = "grid grid-cols-[minmax(0,1fr)_9rem_7.5rem_9rem_8rem] items-center gap-x-3";
const CHECK_GRID = "grid grid-cols-[minmax(0,12rem)_9rem_6rem_7.5rem_minmax(0,1fr)] items-center gap-x-3";

/** A section: its heading in the page's title type on a 28 px line, which also holds the strip of the lines a live
 * change brought — reserved, so the strip's arrival moves nothing — then its list. A `quiet` section holds nothing to
 * head: its title is one muted line of body type in the same 28 px line, no heading (craft-7). */
function Section({ title, id, strip, quiet = false, children }: { title: string; id: string; strip?: ReactNode; quiet?: boolean; children?: ReactNode }) {
  const Title = quiet ? "p" : "h3";
  return (
    <section aria-labelledby={id} className="flex min-w-0 flex-col gap-1">
      <div data-slot="section-head" className="flex h-7 min-w-0 items-center gap-3">
        <Title id={id} className={cn("m-0 shrink-0 text-sm", quiet ? "text-muted-foreground" : "font-semibold text-foreground")}>
          {title}
        </Title>
        {strip}
      </div>
      {children}
    </section>
  );
}

/** «1 новый запуск агента · показать»: what waits in a section's heading line; empty while nothing does. */
function SectionStrip({ fresh, noun, onApply }: { fresh: number; noun: HeldNoun; onApply: () => void }) {
  return <HeldStrip counts={{ fresh, moved: 0, left: 0 }} noun={noun} onApply={onApply} className="min-w-0 flex-1 border-t-0" />;
}

/** A list's header row: what each column holds, in small muted type on the lines' grid; a header that names a set a new
 * user cannot read alone carries its glossary, once, for every line under it (ui → Glossary). */
function HeadRow({ grid, labels, end, glossary = {} }: { grid: string; labels: readonly string[]; end?: number; glossary?: Readonly<Record<string, readonly GlossaryEntry[]>> }) {
  return (
    <div role="row" data-slot="list-head" className={cn(grid, "h-7 border-b text-xs text-muted-foreground")}>
      {labels.map((l, i) => (
        <span key={l} role="columnheader" className={cn("truncate", i === end && "text-right")}>
          {glossary[l] ? <GlossaryTooltip term={l} entries={glossary[l]} className="text-left" /> : l}
        </span>
      ))}
    </div>
  );
}

/** The header glossaries: the launch's state and time, a check's log line. */
const LAUNCH_GLOSSARY = { [LAUNCH_HEAD[3]]: LAUNCH_STATE_GLOSSARY };
const CHECK_GLOSSARY = { [CHECK_HEAD[4]]: LOG_LINE_GLOSSARY };

const Mono = ({ children, className }: { children: ReactNode; className?: string }) => <span className={cn("font-mono text-xs break-all", className)}>{children}</span>;

/** «Ждёт юнитов»: each unit it still waits for, linked to its address, with its state; an id the run lacks reads
 * «не найден». */
function Waits({ run, ids }: { run: DetailRun; ids: readonly string[] }) {
  return (
    <ul role="list" className="m-0 flex list-none flex-col gap-0.5 p-0">
      {ids.map((id) => {
        const other = run.units.find((u) => u.id === id);
        return (
          <li key={id} className="flex min-w-0 flex-wrap items-center gap-x-2">
            <ObjectLink run={run} kind="unit" id={id} />
            {other && <StatusDot state={UNIT_STATE[other.state]} />}
          </li>
        );
      })}
    </ul>
  );
}

type FactKey = keyof typeof FACT;

/** Each fact in the list's order: whether it holds for the unit as it is now, and its value — null when it has none.
 * What asks for action opens the list (ux 9 → Facts: it is outcome, not a fact; craft-7): what the unit still waits
 * for and why it is blocked, then the facts. */
function factRows(run: DetailRun, u: Unit): { key: FactKey; holds: boolean; value: ReactNode }[] {
  const failed = briefFailure(run, u);
  const open = u.state !== "committed";
  const waits = open ? u.blockedBy.filter((id) => run.units.find((o) => o.id === id)?.state !== "committed") : [];
  return [
    { key: "waits", holds: waits.length > 0, value: waits.length ? <Waits run={run} ids={waits} /> : null },
    { key: "why", holds: Boolean(open && u.blockedWhy), value: open && u.blockedWhy ? u.blockedWhy : null },
    { key: "title", holds: !u.title || u.title.length > ROW_TITLE_CHARS, value: u.title || <NotRecorded /> },
    { key: "kind", holds: true, value: u.kind ?? <NotRecorded /> },
    { key: "tree", holds: Boolean(u.tree), value: u.tree ? <Mono>{u.tree}</Mono> : null },
    {
      key: "commits",
      holds: u.commits.some((c) => c !== u.sha),
      value: u.commits.length ? (
        <span className="flex flex-wrap gap-x-3">
          {u.commits.map((c) => (
            <Mono key={c}>{c}</Mono>
          ))}
        </span>
      ) : null,
    },
    { key: "brief", holds: true, value: failed ? <PartFailed what={briefPart(u.brief ?? `units/${u.id}/brief.md`)} cause={failed.cause} /> : u.brief ? <Mono>{u.brief}</Mono> : <NotRecorded /> },
  ];
}

/** The facts the row does not show, and only those that hold for the unit's state (ux 2): what it still waits for and
 * why it is blocked while it is not committed — first, as its outcome —, the whole title when the row may cut it, its
 * own working copy, the commits beyond the one in the row; the kind and the brief always. With `kept` — an open
 * detail's facts — the rows are the ones it opened with, whatever holds now: a value that emptied reads «—» in place
 * (Strict 1). */
export function unitFacts(run: DetailRun, u: Unit, kept?: ReadonlySet<string>): Fact[] {
  return factRows(run, u)
    .filter((r) => (kept ? kept.has(r.key) : r.holds))
    .map((r) => ({ key: r.key, label: FACT[r.key], value: r.value ?? <Dash /> }));
}

/** «Закрывает N находок»: the findings the run gave the unit — the same set its row counts (Conventions 3) — as the
 * shared rows that expand in place into the article (`@/finding` → ExpandingFindings, as a report's in «Отчёты»),
 * read-only: the verdict is set in «Находки» (Conventions 6); «Открыть в находках» leads there. The detail already
 * sits on the muted ground, so the rows carry no rules of their own. A unit that closes none reads it on one muted
 * line, not a heading over nothing (craft-7) — the same 28 px line, so a finding that arrives moves nothing. */
function Closes({ run, unit, id, now }: { run: DetailRun; unit: Unit; id: string; now: number }) {
  const ids = closingIds(run, unit);
  const held = useHeld(ids, (fid) => fid);
  const byId = new Map<string, Finding>(run.findings.map((f) => [f.id, f]));
  const title = closesTitle(ids.length);
  return (
    <Section title={title} id={id} quiet={ids.length === 0} strip={<SectionStrip fresh={held.fresh} noun={HELD_NOUN.finding} onApply={held.apply} />}>
      {held.shown.length > 0 && <ExpandingFindings run={run} items={held.shown.map((fid) => byId.get(fid) ?? fid)} label={title} now={now} slot="unit-closes" ruled={false} unit={unit.id} />}
    </Section>
  );
}

/** One launch on one line: who and what · model · start · state with its time («завершён за 9 мин») · tokens, the
 * compact number under «Токены» with the split in the title. */
function LaunchLine({ run, row, now }: { run: DetailRun; row: ReturnType<typeof launchRows>[number]; now: number }) {
  const l = row.launch;
  const who = l ? agentKind(l) : agentKind(row.live);
  const what = l ? (l.description ?? l.name) : (row.live.description ?? row.live.name);
  const state = l ? launchState({ running: row.running, startedAt: row.startedAt, seconds: l.seconds, reportMissing: l.reportMissing }, now) : launchState({ running: true, startedAt: row.startedAt }, now);
  const spend = l?.spend ? tokens(l.spend) : null;
  return (
    <div role="row" data-slot="unit-launch" className={cn(LAUNCH_GRID, "h-8")}>
      <span role="cell" className="min-w-0 truncate" title={`${who} · ${what}`}>
        <span className="text-muted-foreground">{who}</span>{" "}
        {l ? (
          <ObjectLink run={run} kind="report" id={l.id}>
            {what}
          </ObjectLink>
        ) : (
          what
        )}
      </span>
      <span role="cell" className="min-w-0 truncate" title={l?.model ?? undefined}>
        {l?.model ? <Mono className="break-normal">{l.model}</Mono> : <NotRecorded />}
      </span>
      <span role="cell" className="truncate tabular-nums" title={row.startedAt ? mskDateTime(row.startedAt) : undefined}>
        {row.startedAt ? mskTime(row.startedAt, now) : <NotRecorded />}
      </span>
      <span role="cell" className="min-w-0">
        <StatusDot state={{ tone: state.tone, label: state.label }} truncate />
      </span>
      <span role="cell" className="truncate text-right tabular-nums" title={spend?.title}>
        {spend ? spend.number : <Dash />}
      </span>
    </div>
  );
}

function Launches({ run, unit, now, id }: { run: DetailRun; unit: Unit; now: number; id: string }) {
  const held = useHeld(launchRows(run, unit), (r) => r.key);
  return (
    <Section title={SECTION.launches} id={id} strip={<SectionStrip fresh={held.fresh} noun={HELD_NOUN.launch} onApply={held.apply} />}>
      {held.shown.length ? (
        <div role="table" aria-labelledby={id} data-slot="unit-launches" className="flex flex-col">
          <HeadRow grid={LAUNCH_GRID} labels={LAUNCH_HEAD} end={LAUNCH_HEAD.length - 1} glossary={LAUNCH_GLOSSARY} />
          {held.shown.map((row) => (
            <LaunchLine key={row.key} run={run} row={row} now={now} />
          ))}
        </div>
      ) : (
        <Dash />
      )}
    </Section>
  );
}

/** A check line with the log it belongs to: one held line of «Проверки». */
interface LoggedCheck {
  log: string;
  line: CheckLine;
}

/** «Проверки»: one header row, then each log as «лог verify» with its labels, each once with its last outcome and «N
 * попыток»; the log line as fsloop wrote it, in mono — never rewritten into a duration; an empty cell is the shared
 * «—». A failed exit is neutral unless the unit is blocked (Conventions 2). */
function Checks({ unit, checks, now, id }: { unit: Unit; checks: readonly UnitCheck[] | null; now: number; id: string }) {
  const lines: LoggedCheck[] = checks ? checkGroups(checks).flatMap((g) => g.lines.map((line) => ({ log: g.log, line }))) : [];
  const held = useHeld(lines, (c) => `${c.log}\u0000${c.line.label}`);
  // the held lines by log, in the order their logs first appear
  const groups: { log: string; lines: CheckLine[] }[] = [];
  for (const c of held.shown) {
    const group = groups.find((g) => g.log === c.log);
    if (group) group.lines.push(c.line);
    else groups.push({ log: c.log, lines: [c.line] });
  }
  return (
    <Section title={SECTION.checks} id={id} strip={<SectionStrip fresh={held.fresh} noun={HELD_NOUN.check} onApply={held.apply} />}>
      {!checks ? (
        <NotRecorded />
      ) : groups.length ? (
        <div role="table" aria-labelledby={id} data-slot="unit-checks" className="flex flex-col">
          <HeadRow grid={CHECK_GRID} labels={CHECK_HEAD} glossary={CHECK_GLOSSARY} />
          {groups.map((g) => (
            <div key={g.log} role="rowgroup" className="flex min-w-0 flex-col">
              <div role="row" data-slot="check-log" className="flex h-7 items-end">
                <span role="rowheader" className="text-xs text-muted-foreground">
                  {LOG_WORD} <span className="font-mono">{g.log}</span>
                </span>
              </div>
              {g.lines.map((c) => {
                const tone = c.exit !== null && c.exit !== 0 && unit.state === "blocked" ? "warning" : "neutral";
                const attempts = attemptsText(c.attempts);
                return (
                  <div key={c.label} role="row" data-slot="unit-check" className={cn(CHECK_GRID, "h-8")}>
                    <span role="cell" className="min-w-0 truncate">
                      <Mono className="break-normal">{c.label}</Mono>
                    </span>
                    <span role="cell" className="min-w-0">
                      <StatusDot state={{ tone, label: c.outcome }} truncate />
                    </span>
                    <span role="cell" className="text-muted-foreground tabular-nums">
                      {attempts ?? <Dash />}
                    </span>
                    <span role="cell" className="truncate tabular-nums" title={c.endedAt ? mskDateTime(c.endedAt) : undefined}>
                      {c.endedAt ? mskTime(c.endedAt, now) : <Dash />}
                    </span>
                    <span role="cell" className="min-w-0 truncate" title={c.note ?? undefined}>
                      {c.note ? <Mono className="break-normal">{c.note}</Mono> : <Dash />}
                    </span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      ) : (
        <Dash />
      )}
    </Section>
  );
}

export function UnitDetail({ run, unit, checks, now }: UnitDetailProps) {
  const base = `unit-${unit.id}`;
  // the fact rows this open shows, whatever a live change makes of them (Strict 1)
  const [kept] = useState<ReadonlySet<string>>(() => new Set(factRows(run, unit).flatMap((r) => (r.holds ? [r.key] : []))));
  // how the unit was produced (ux 9 → Provenance): open while it is in work, waits or is blocked; once committed,
  // behind one «Подробнее». Decided once per open, so a unit committed under an open detail folds nothing (Strict 1).
  const [folded] = useState(() => unit.state === "committed");
  const provenance = (
    <>
      <Launches run={run} unit={unit} now={now} id={`${base}-launches`} />
      <Checks unit={unit} checks={checks} now={now} id={`${base}-checks`} />
    </>
  );
  return (
    <article data-slot="unit-detail" aria-label={`Юнит ${unit.id}`} className="flex flex-col gap-4">
      <Closes run={run} unit={unit} id={`${base}-closes`} now={now} />
      <FactList facts={unitFacts(run, unit, kept)} foldKey="unit" label={`Юнит ${unit.id}: факты`} className="max-w-measure" />
      {folded ? (
        <Fold foldKey={PROVENANCE_FOLD} label={PROVENANCE_LABEL}>
          {provenance}
        </Fold>
      ) : (
        provenance
      )}
    </article>
  );
}
