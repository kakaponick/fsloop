// What a unit's row expands into (surfaces/units.md → BLOCKS → expanded detail; rules/ui → Tables 3, Layout 5): the
// findings it closes first — a unit's row expands into its findings — then the facts the row does not already show,
// its agent launches and its checks, each list under one muted header row. The detail grows in the table's own
// scroll box; it has no scroll of its own. Every absent value is the shared part for it — «не найден», «не записано»
// — and a brief that failed to read fails here, in its own place (Conventions 4, 5, 14).
import type { ReactNode } from "react";
import type { Finding, Run, Unit, UnitCheck } from "../../../shared/model.ts";
import { agentKind, launchState, UNIT_STATE } from "../../../shared/states.ts";
import { mskDateTime, mskTime, tokens } from "../../../shared/text.ts";
import { cn } from "@/lib/utils";
import { Dash, FactList, NotFound, NotRecorded, PartFailed, StatusDot, type Fact } from "@/ui";
// From the files, not the index: the index reaches the app's links, which reach this view (a cycle at load time).
import { FindingRow } from "@/finding/row.tsx";
import { ObjectLink } from "../../app/links.tsx";
import { TITLE_MIN } from "./columns.tsx";
import { briefFailure, checkGroups, launchRows, type LaunchRow } from "./query.ts";
import { attemptsText, briefPart, CHECK_HEAD, closesTitle, FACT, LAUNCH_HEAD, SECTION } from "./words.ts";

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

function Section({ title, id, children }: { title: string; id: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex min-w-0 flex-col gap-1">
      <h3 id={id} className="m-0 text-xs font-normal text-muted-foreground">
        {title}
      </h3>
      {children}
    </section>
  );
}

/** A list's header row: what each column holds, in small muted type on the lines' grid. */
function HeadRow({ grid, labels, end }: { grid: string; labels: readonly string[]; end?: number }) {
  return (
    <div role="row" data-slot="list-head" className={cn(grid, "h-7 border-b text-xs text-muted-foreground")}>
      {labels.map((l, i) => (
        <span key={l} role="columnheader" className={cn("truncate", i === end && "text-right")}>
          {l}
        </span>
      ))}
    </div>
  );
}

const Mono = ({ children, className }: { children: ReactNode; className?: string }) => <span className={cn("font-mono text-xs break-all", className)}>{children}</span>;

/** «Ждёт юнитов»: each unit it still waits for, linked to its address, with its state; an id the run lacks reads
 * «не найден». */
function Waits({ run, ids }: { run: DetailRun; ids: readonly string[] }) {
  return (
    <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
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

/** The facts the row does not show, and only those that hold for the unit's state (ux 2): the whole title when the
 * row may cut it, what it still waits for and why it is blocked while it is not committed, its own working copy, the
 * commits beyond the one in the row; the kind and the brief always. */
export function unitFacts(run: DetailRun, u: Unit): Fact[] {
  const failed = briefFailure(run, u);
  const open = u.state !== "committed";
  const waits = open ? u.blockedBy.filter((id) => run.units.find((o) => o.id === id)?.state !== "committed") : [];
  const facts: Fact[] = [];
  if (!u.title) facts.push({ label: FACT.title, value: <NotRecorded /> });
  else if (u.title.length > ROW_TITLE_CHARS) facts.push({ label: FACT.title, value: u.title });
  facts.push({ label: FACT.kind, value: u.kind ?? <NotRecorded /> });
  if (waits.length) facts.push({ label: FACT.waits, value: <Waits run={run} ids={waits} /> });
  if (open && u.blockedWhy) facts.push({ label: FACT.why, value: u.blockedWhy });
  if (u.tree) facts.push({ label: FACT.tree, value: <Mono>{u.tree}</Mono> });
  if (u.commits.some((c) => c !== u.sha))
    facts.push({
      label: FACT.commits,
      value: (
        <span className="flex flex-wrap gap-x-3">
          {u.commits.map((c) => (
            <Mono key={c}>{c}</Mono>
          ))}
        </span>
      ),
    });
  facts.push({ label: FACT.brief, value: failed ? <PartFailed what={briefPart(u.brief ?? `units/${u.id}/brief.md`)} cause={failed.cause} /> : u.brief ? <Mono>{u.brief}</Mono> : <NotRecorded /> });
  return facts;
}

/** «Закрывает N находок»: u4's compact rows, read-only — the verdict is set in «Находки» (Conventions 6). */
function Closes({ run, unit, id }: { run: DetailRun; unit: Unit; id: string }) {
  const byId = new Map<string, Finding>(run.findings.map((f) => [f.id, f]));
  return (
    <Section title={closesTitle(unit.closes.length)} id={id}>
      {unit.closes.length > 0 && (
        <ul data-slot="unit-closes" className="m-0 flex list-none flex-col p-0">
          {unit.closes.map((fid) => {
            const f = byId.get(fid);
            return (
              <li key={fid} className="min-w-0">
                {f ? (
                  <FindingRow run={run} finding={f} />
                ) : (
                  <span className="flex h-8 items-center">
                    <NotFound kind="finding" id={fid} />
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Section>
  );
}

/** One launch on one line: who and what · model · start · state with its duration · tokens with the split in the title. */
function LaunchLine({ run, row, now }: { run: DetailRun; row: LaunchRow; now: number }) {
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
        {spend ? spend.compact : <Dash />}
      </span>
    </div>
  );
}

function Launches({ run, unit, now, id }: { run: DetailRun; unit: Unit; now: number; id: string }) {
  const rows = launchRows(run, unit);
  return (
    <Section title={SECTION.launches} id={id}>
      {rows.length ? (
        <div role="table" aria-labelledby={id} data-slot="unit-launches" className="flex flex-col">
          <HeadRow grid={LAUNCH_GRID} labels={LAUNCH_HEAD} end={LAUNCH_HEAD.length - 1} />
          {rows.map((row) => (
            <LaunchLine key={row.key} run={run} row={row} now={now} />
          ))}
        </div>
      ) : (
        <Dash />
      )}
    </Section>
  );
}

/** «Проверки»: one header row, then each log by name with its labels, each once with its last outcome and «N
 * попыток»; a failed exit is neutral unless the unit is blocked (Conventions 2). */
function Checks({ unit, checks, now, id }: { unit: Unit; checks: readonly UnitCheck[] | null; now: number; id: string }) {
  if (!checks)
    return (
      <Section title={SECTION.checks} id={id}>
        <NotRecorded />
      </Section>
    );
  const groups = checkGroups(checks);
  return (
    <Section title={SECTION.checks} id={id}>
      {groups.length ? (
        <div role="table" aria-labelledby={id} data-slot="unit-checks" className="flex flex-col">
          <HeadRow grid={CHECK_GRID} labels={CHECK_HEAD} />
          {groups.map((g) => (
            <div key={g.log} role="rowgroup" className="flex min-w-0 flex-col">
              <div role="row" data-slot="check-log" className="flex h-7 items-end">
                <span role="rowheader" className="font-mono text-xs text-muted-foreground">
                  {g.log}
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
                      {attempts ?? ""}
                    </span>
                    <span role="cell" className="truncate tabular-nums" title={c.endedAt ? mskDateTime(c.endedAt) : undefined}>
                      {c.endedAt ? mskTime(c.endedAt, now) : ""}
                    </span>
                    <span role="cell" className="min-w-0 truncate text-muted-foreground" title={c.note ?? undefined}>
                      {c.note ?? ""}
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
  return (
    <article data-slot="unit-detail" aria-label={`Юнит ${unit.id}`} className="flex flex-col gap-4">
      <Closes run={run} unit={unit} id={`${base}-closes`} />
      <FactList facts={unitFacts(run, unit)} foldKey="unit" label={`Юнит ${unit.id}: факты`} className="max-w-measure" />
      <Launches run={run} unit={unit} now={now} id={`${base}-launches`} />
      <Checks unit={unit} checks={checks} now={now} id={`${base}-checks`} />
    </article>
  );
}
