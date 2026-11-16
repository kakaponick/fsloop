// What a unit's row expands into (surfaces/units.md → BLOCKS → expanded detail; rules/ui → Tables 3, Layout 5–6): the
// fact list, the findings it closes as u4's read-only rows linking to «Находки», its agent launches and its checks,
// in a height-capped region that scrolls inside. Every absent value is the shared part for it — «—», «не найден»,
// «не записано» — and a brief that failed to read fails here, in its own place (Conventions 4, 5, 14).
import type { ReactNode } from "react";
import type { Finding, Run, Unit } from "../../../shared/model.ts";
import { agentKind, launchState, UNIT_STATE } from "../../../shared/states.ts";
import { mskDateTime, mskTime, tokens } from "../../../shared/text.ts";
import { cn } from "@/lib/utils";
import { Dash, FactList, NotFound, NotRecorded, PartFailed, StatusDot, type Fact } from "@/ui";
// From the files, not the index: the index reaches the app's links, which reach this view (a cycle at load time).
import { FindingRow } from "@/finding/row.tsx";
import { ObjectLink } from "../../app/links.tsx";
import { briefFailure, checkGroups, launchRows, type LaunchRow, type UnitCheck } from "./query.ts";
import { attemptsText, briefPart, closesTitle, FACT, SECTION } from "./words.ts";

type DetailRun = Pick<Run, "id" | "units" | "findings" | "launches" | "running" | "journal" | "errors"> & { key: string };

export interface UnitDetailProps {
  run: DetailRun;
  unit: Unit;
  /** The unit's checks; null while the run model does not carry them («не записано»). */
  checks: readonly UnitCheck[] | null;
  /** The shared clock. */
  now: number;
}

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

const Mono = ({ children, className }: { children: ReactNode; className?: string }) => <span className={cn("font-mono text-xs break-all", className)}>{children}</span>;

/** «Ждёт»: each unit it waits for, linked to its address, with its state; an id the run lacks reads «не найден». */
function Waits({ run, ids }: { run: DetailRun; ids: readonly string[] }) {
  if (!ids.length) return <Dash />;
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

function facts(run: DetailRun, u: Unit): Fact[] {
  const failed = briefFailure(run, u);
  const commits = u.commits.length ? u.commits : u.sha ? [u.sha] : [];
  return [
    { label: FACT.title, value: u.title || <NotRecorded /> },
    { label: FACT.kind, value: u.kind ?? <NotRecorded /> },
    { label: FACT.waits, value: <Waits run={run} ids={u.blockedBy} /> },
    { label: FACT.why, value: u.blockedWhy ?? <Dash /> },
    { label: FACT.tree, value: u.tree ? <Mono>{u.tree}</Mono> : <Dash /> },
    {
      label: FACT.commits,
      value: commits.length ? (
        <span className="flex flex-wrap gap-x-3">
          {commits.map((c) => (
            <Mono key={c}>{c}</Mono>
          ))}
        </span>
      ) : (
        <Dash />
      ),
    },
    { label: FACT.brief, value: failed ? <PartFailed what={briefPart(u.brief ?? `units/${u.id}/brief.md`)} cause={failed.cause} /> : u.brief ? <Mono>{u.brief}</Mono> : <NotRecorded /> },
  ];
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
    <li data-slot="unit-launch" className="grid h-8 grid-cols-[minmax(0,1fr)_9rem_7.5rem_9rem_8rem] items-center gap-x-3">
      <span className="min-w-0 truncate" title={`${who} · ${what}`}>
        <span className="text-muted-foreground">{who}</span>{" "}
        {l ? (
          <ObjectLink run={run} kind="report" id={l.id}>
            {what}
          </ObjectLink>
        ) : (
          what
        )}
      </span>
      <span className="min-w-0 truncate" title={l?.model ?? undefined}>
        {l?.model ? <Mono className="break-normal">{l.model}</Mono> : <NotRecorded />}
      </span>
      <span className="truncate tabular-nums" title={row.startedAt ? mskDateTime(row.startedAt) : undefined}>
        {row.startedAt ? mskTime(row.startedAt, now) : <NotRecorded />}
      </span>
      <span className="min-w-0">
        <StatusDot state={{ tone: state.tone, label: state.label }} truncate />
      </span>
      <span className="truncate text-right tabular-nums" title={spend?.title}>
        {spend ? spend.compact : <Dash />}
      </span>
    </li>
  );
}

function Launches({ run, unit, now, id }: { run: DetailRun; unit: Unit; now: number; id: string }) {
  const rows = launchRows(run, unit);
  return (
    <Section title={SECTION.launches} id={id}>
      {rows.length ? (
        <ul data-slot="unit-launches" className="m-0 flex list-none flex-col p-0">
          {rows.map((row) => (
            <LaunchLine key={row.key} run={run} row={row} now={now} />
          ))}
        </ul>
      ) : (
        <Dash />
      )}
    </Section>
  );
}

/** «Проверки»: grouped by log, each label once with its last outcome and «N попыток»; a failed exit is neutral unless
 * the unit is blocked (Conventions 2). */
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
        <div data-slot="unit-checks" className="flex flex-col gap-2">
          {groups.map((g) => (
            <div key={g.log} className="flex min-w-0 flex-col">
              <Mono className="text-muted-foreground">{g.log}</Mono>
              <ul className="m-0 flex list-none flex-col p-0">
                {g.lines.map((c) => {
                  const tone = c.exit !== null && c.exit !== 0 && unit.state === "blocked" ? "warning" : "neutral";
                  const attempts = attemptsText(c.attempts);
                  return (
                    <li key={c.label} data-slot="unit-check" className="grid h-8 grid-cols-[minmax(0,12rem)_9rem_6rem_7.5rem_minmax(0,1fr)] items-center gap-x-3">
                      <Mono className="truncate break-normal">{c.label}</Mono>
                      <StatusDot state={{ tone, label: c.outcome }} truncate />
                      <span className="text-muted-foreground tabular-nums">{attempts ?? ""}</span>
                      <span className="truncate tabular-nums" title={c.endedAt ? mskDateTime(c.endedAt) : undefined}>
                        {c.endedAt ? mskTime(c.endedAt, now) : ""}
                      </span>
                      <span className="min-w-0 truncate text-muted-foreground" title={c.note ?? undefined}>
                        {c.note ?? ""}
                      </span>
                    </li>
                  );
                })}
              </ul>
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
    <article data-slot="unit-detail" aria-label={`Юнит ${unit.id}`} className="flex max-h-112 flex-col gap-4 overflow-y-auto [scrollbar-gutter:stable]">
      <FactList facts={facts(run, unit)} foldKey="unit" label={`Юнит ${unit.id}: факты`} className="max-w-measure" />
      <Closes run={run} unit={unit} id={`${base}-closes`} />
      <Launches run={run} unit={unit} now={now} id={`${base}-launches`} />
      <Checks unit={unit} checks={checks} now={now} id={`${base}-checks`} />
    </article>
  );
}
