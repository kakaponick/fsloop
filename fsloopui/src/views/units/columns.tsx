// The units table's columns (surfaces/units.md → BLOCKS → table): each a fixed width that clears its header — the
// label at the platform face, its sort control and the cell's padding (table #10; `HEADER_FITS` in view.test.tsx
// holds each) — and its widest ordinary value; «Что делает» is the one width-free column, «Состояние» the one a long
// cause may widen. At 1280 px the view's 924 px beside the sidebar holds every column (922 px with the frame).
import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { UNIT_STATE } from "../../../shared/states.ts";
import { CountLink, Dash, glossaryFrom, StatusDot } from "@/ui";
import type { TableColumn } from "@/table";
// From the files, not the index: the index reaches the app's links, which reach this view (a cycle at load time).
import { MAJOR_UP, type FindingFilter } from "@/finding/facets.ts";
import { openFindings } from "@/finding/open.ts";
import { useNow } from "../../app/clock.tsx";
import { runPath } from "../../app/routes.ts";
import { stateDetail, stateText, type UnitRow } from "./query.ts";
import { AGE_ENTRY, LAUNCHES_ENTRY, MAJOR_ENTRY, MINOR_ENTRY, PASS_ENTRY } from "./words.ts";

/** The state words a new reader cannot read alone, in the map's order, and what the age after them counts. */
export const STATE_GLOSSARY = [...glossaryFrom(UNIT_STATE, ["drafted", "ready", "verify", "debug", "land", "blocked"]), AGE_ENTRY];

/** «Что делает» at its floor: the width-free column never narrows below it. */
export const TITLE_MIN = 184;

/** The sha as the row shows it: its first 8 characters. */
export const shortSha = (sha: string): string => sha.slice(0, 8);

function StateCell({ unit }: { unit: UnitRow }) {
  const now = useNow();
  return <StatusDot state={UNIT_STATE[unit.state]} detail={stateDetail(unit, now)} truncate />;
}

function CommitCell({ unit, hl }: { unit: UnitRow; hl: (text: string) => ReactNode }) {
  if (!unit.sha) return <Dash />;
  return (
    <span className="font-mono text-xs">
      {hl(shortSha(unit.sha))}
      {unit.moreCommits > 0 && <span className="text-muted-foreground"> +{unit.moreCommits}</span>}
    </span>
  );
}

/** A count of the unit's findings that opens «Находки» filtered to the same slice (rules/ui → Conventions 7). */
export function FindingCount({ runKey, count, filter }: { runKey: string; count: number; filter: FindingFilter }) {
  const navigate = useNavigate();
  return <CountLink count={count} href={runPath(runKey, { view: "findings" })} onOpen={() => openFindings(runKey, filter, navigate)} />;
}

export const COLUMNS: readonly TableColumn<UnitRow>[] = [
  { id: "id", label: "Юнит", width: 72, primary: true, rank: (u) => u.id, cell: (u, c) => <span className="font-mono text-xs">{c.hl(u.id)}</span>, text: (u) => u.id },
  { id: "pass", label: "Проход", width: 88, numeric: true, rank: (u) => u.pass, glossary: [PASS_ENTRY], cell: (u) => u.pass, text: (u) => `проход ${u.pass}` },
  {
    id: "state",
    label: "Состояние",
    width: 192,
    resizable: true,
    min: 160,
    max: 480,
    rank: (u) => UNIT_STATE[u.state].rank,
    glossary: STATE_GLOSSARY,
    cell: (u) => <StateCell unit={u} />,
    text: (u) => stateText({ ...u, since: undefined }, 0),
  },
  { id: "title", label: "Что делает", min: TITLE_MIN, cell: (u, c) => c.hl(u.title), text: (u) => u.title },
  { id: "sha", label: "Коммит", width: 96, rank: (u) => u.sha, cell: (u, c) => <CommitCell unit={u} hl={c.hl} />, text: (u) => (u.commits.length ? u.commits.join(", ") : u.sha) },
  {
    id: "major",
    label: "major+",
    width: 80,
    numeric: true,
    rank: (u) => u.majorUp,
    glossary: [MAJOR_ENTRY],
    cell: (u) => <FindingCount runKey={u.runKey} count={u.majorUp} filter={{ unit: [u.id], severity: [MAJOR_UP] }} />,
    text: (u) => String(u.majorUp),
  },
  {
    id: "minor",
    label: "minor",
    width: 72,
    numeric: true,
    rank: (u) => u.minor,
    glossary: [MINOR_ENTRY],
    cell: (u) => <FindingCount runKey={u.runKey} count={u.minor} filter={{ unit: [u.id], severity: ["minor"] }} />,
    text: (u) => String(u.minor),
  },
  { id: "launches", label: "Запуски", width: 88, numeric: true, rank: (u) => u.launchCount, glossary: [LAUNCHES_ENTRY], cell: (u) => u.launchCount, text: (u) => String(u.launchCount) },
];
