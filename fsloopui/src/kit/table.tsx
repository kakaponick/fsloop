// The kit's data-table section: the shared table of src/table at production's sizes — the findings of the largest
// run (723 rows, 50 a page, 15 pages) in the 964 px region beside the 316 px sidebar at 1280 px, the units of the
// largest run (42 rows, one unsplit list with the counts strip), and the table's first-load and empty states. Rows
// are shaped after u1's run model (shared/model.ts) with the counts of surfaces/findings.md and units.md → RANGES.
import { useState, type ReactNode } from "react";
import type { Finding, Unit } from "../../shared/model.ts";
import { FINDING_STATUS, SEVERITY, UNIT_STATE, VERDICT, type FindingStatus, type UnitState } from "../../shared/states.ts";
import { NOUNS } from "../../shared/text.ts";
import { Button } from "@/components/ui/button";
import { Dash, Dot, glossaryFrom, notify, RunningText, StatusDot } from "@/ui";
import { copyAction, DataTable, type FilterDef, type Preset, type RowAction, type SearchDef, type TableColumn } from "@/table";

const NOW = "2026-11-16T07:00:00Z";
const UPDATED = "2026-11-16T06:57:00Z";

// ── findings: 723 = 2 critical, 205 major, 513 minor, 3 without severity; 506 candidates, 163 in work, 54 fixed ──

type KitFinding = Pick<Finding, "id" | "severity" | "summary" | "launchName" | "effectiveStatus" | "units" | "location" | "observation"> & { verdict: Finding["verdict"] };

const LENSES = ["craft", "ux", "audit", "shape", "design", "consistency", "a11y", "copy"];
const SURFACES = ["shell", "findings", "units", "reports"];
const REPORTS = LENSES.flatMap((lens) => SURFACES.map((s) => `${lens} · ${s}`)); // 32
const SENTENCES = [
  "The row wraps its summary onto two lines at the 964 px region",
  "A live update moves the row under the pointer instead of waiting in the strip",
  "The empty state names no stage, so the operator cannot tell whether the run is broken",
  "The filter trigger grows with its value and pushes the search off the toolbar line",
  "Contrast of the muted label on the hover ground falls below 4.5:1 in the dark theme",
  "The status bar shows «обновлено» from before the connection was lost",
  "`launchErrorCause` passes the raw error text of the process into the cell",
];

function kitFindings(n: number, from = 0): KitFinding[] {
  return Array.from({ length: n }, (_, k) => {
    const i = k + from;
    const severity: KitFinding["severity"] = i === 0 || i === 377 ? "critical" : i % 241 === 7 ? null : i % 7 < 2 ? "major" : "minor";
    const status: FindingStatus = i % 13 === 0 ? "fixed" : i % 9 < 2 ? "in-progress" : "candidate";
    const lens = REPORTS[i % REPORTS.length];
    const [lensName, surface] = lens.split(" · ");
    return {
      id: `p1-review-${lensName}-${surface}#${lensName}-${Math.floor(i / REPORTS.length) + 1}`,
      severity,
      summary: SENTENCES[i % SENTENCES.length] + (i % 5 === 0 ? ", and the same holds on every surface that reads a launch's error: the rail, the reader and the unit row" : ""),
      launchName: lens,
      effectiveStatus: status,
      units: status === "candidate" ? [] : [`u${(i % 42) + 1}`],
      location: i % 4 === 0 ? null : `fsloopui/src/${SURFACES[i % 4]}/row.tsx:${(i % 300) + 1}`,
      observation: SENTENCES[(i + 3) % SENTENCES.length],
      verdict: i % 17 === 0 ? { verdict: "agree", note: null, at: NOW } : i % 23 === 0 ? { verdict: "wrong-severity", note: null, at: NOW } : null,
    };
  });
}

const FINDINGS = kitFindings(723);
const SEV_KEYS = ["critical", "major", "minor"] as const;

export const FINDING_COLUMNS: TableColumn<KitFinding>[] = [
  {
    id: "severity",
    label: "Серьёзность",
    width: 116,
    rank: (r) => SEVERITY[r.severity ?? "none"].rank,
    glossary: glossaryFrom(SEVERITY, SEV_KEYS),
    cell: (r) => <StatusDot state={SEVERITY[r.severity ?? "none"]} truncate />,
    text: (r) => SEVERITY[r.severity ?? "none"].compact,
  },
  { id: "id", label: "ID", width: 112, primary: true, rank: (r) => r.id, cell: (r, c) => <span className="font-mono text-xs">{c.hl(r.id.split("#")[1])}</span>, text: (r) => r.id },
  { id: "summary", label: "Находка", min: 240, cell: (r, c) => c.hl(r.summary), text: (r) => r.summary },
  { id: "report", label: "Отчёт", width: 160, resizable: true, min: 112, max: 320, rank: (r) => r.launchName, cell: (r, c) => c.hl(r.launchName), text: (r) => r.launchName },
  {
    id: "state",
    label: "Состояние",
    width: 136,
    rank: (r) => FINDING_STATUS[r.effectiveStatus].rank,
    cell: (r) => <StatusDot state={FINDING_STATUS[r.effectiveStatus]} detail={r.units[0]} truncate />,
    text: (r) => [FINDING_STATUS[r.effectiveStatus].compact, r.units[0]].filter(Boolean).join(" · "),
  },
  { id: "verdict", label: "Оценка", width: 128, rank: (r) => (r.verdict ? VERDICT[r.verdict.verdict].rank : null), cell: (r) => (r.verdict ? VERDICT[r.verdict.verdict].compact : <Dash />), text: (r) => (r.verdict ? VERDICT[r.verdict.verdict].compact : undefined) },
  { id: "location", label: "Место", width: 220, resizable: true, hidden: true, cell: (r, c) => (r.location ? <span className="font-mono text-xs">{c.hl(r.location)}</span> : <Dash />), text: (r) => r.location },
];

const FINDING_FILTERS: FilterDef<KitFinding>[] = [
  { id: "severity", label: "Серьёзность", values: (r) => [r.severity ?? "none"], options: (["critical", "major", "minor", "none"] as const).map((v) => ({ value: v, label: SEVERITY[v].compact })) },
  { id: "state", label: "Состояние", values: (r) => [r.effectiveStatus], options: (Object.keys(FINDING_STATUS) as FindingStatus[]).map((v) => ({ value: v, label: FINDING_STATUS[v].compact })), placeholder: "Найти состояние" },
  { id: "report", label: "Отчёт", values: (r) => [r.launchName], options: REPORTS.map((v) => ({ value: v, label: v })), placeholder: "Найти отчёт" },
  { id: "unit", label: "Юнит", values: (r) => r.units, options: Array.from({ length: 42 }, (_, i) => ({ value: `u${i + 1}`, label: `u${i + 1}` })), placeholder: "Найти юнит" },
  { id: "verdict", label: "Оценка", values: (r) => [r.verdict?.verdict ?? "none"], options: [...(Object.keys(VERDICT) as (keyof typeof VERDICT)[]).map((v) => ({ value: v, label: VERDICT[v].compact })), { value: "none", label: "без оценки" }] },
];

const FINDING_PRESETS: Preset[] = [
  { id: "all", label: "Все", filters: {} },
  { id: "unrated", label: "Без оценки", filters: { verdict: ["none"] } },
  { id: "fix", label: "В исправление", filters: { state: ["queued", "in-progress", "blocked"] } },
  { id: "candidates", label: "Кандидаты", filters: { state: ["candidate"] } },
  { id: "fixed", label: "Закоммичены", filters: { state: ["fixed", "closed"] } },
];

const FINDING_SEARCH: SearchDef<KitFinding> = {
  identifiers: (r) => [r.id, r.location, r.launchName, ...r.units],
  text: (r) => [r.summary, r.observation],
  placeholder: "Текст, файл, id, юнит",
};

const FINDING_ACTIONS: RowAction<KitFinding>[] = [
  { id: "rate", label: "Оценить…", scope: "both", group: 1, run: (rows) => notify.success(rows.length === 1 ? "Открыта оценка находки" : `Открыта оценка ${rows.length} находок`) },
  copyAction<KitFinding>("copy-link", "ссылку", (r) => `http://127.0.0.1:4747/r/tga/a098a7d4?view=findings&finding=${encodeURIComponent(r.id)}`, "single", 2),
  copyAction<KitFinding>("copy-id", "id", (r) => r.id, "both", 2),
  // a finding with no file and line has no path to copy, ever: the item is not listed on it (table #4)
  { ...copyAction<KitFinding>("copy-path", "путь", (r) => r.location, "both", 2), hidden: (rows) => rows.every((r) => !r.location) },
  { id: "report", label: "Открыть отчёт", scope: "single", group: 3, run: (rows) => notify.success(`Открыт отчёт ${rows[0].launchName}`) },
  { id: "unit", label: "Открыть юнит", scope: "single", group: 3, hidden: (rows) => !rows[0]?.units.length, run: (rows) => notify.success(`Открыт юнит ${rows[0].units[0]}`) },
];

const FINDING_ROW_ID = (r: KitFinding) => r.id;
const FINDING_TITLE = (r: KitFinding) => `${r.id} — ${r.summary}`;
const FINDING_NOUN = { forms: NOUNS.finding, gender: "f" as const };

function FindingDetail({ row }: { row: KitFinding }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="m-0 text-xs text-muted-foreground">
        {row.launchName} · {row.location ?? "место не указано"}
      </p>
      <RunningText text={`${row.summary}.\n\n${row.observation}.`} />
    </div>
  );
}

// ── units: 42 of the largest run, one unsplit list ────────────────────────────────────────────

type KitUnit = Pick<Unit, "id" | "pass" | "state" | "sha" | "commits" | "title" | "closes" | "launches"> & { major: number; minor: number };

const UNIT_TITLES = ["Chat Creator campaign and page", "The shell: sidebar of run cards, run page frame, live updates", "Findings view on the shared table", "Units view with the counts strip", "Reports rail and the report reader"];

const UNITS: KitUnit[] = Array.from({ length: 42 }, (_, i) => {
  const pass = i < 20 ? 1 : 2;
  const state: UnitState = i < 30 ? "committed" : i === 30 ? "blocked" : i < 34 ? "implement" : i < 36 ? "verify" : i === 36 ? "land" : i < 40 ? "ready" : "drafted";
  return {
    id: i < 20 ? `u${i + 1}` : `f${i - 19}`,
    pass,
    state,
    sha: state === "committed" ? ((0x4c5237ca + i * 0x9e37) >>> 0).toString(16).slice(0, 8) : null,
    commits: [],
    title: UNIT_TITLES[i % UNIT_TITLES.length] + (i % 6 === 0 ? " — and the shared parts every view of the run reads, written once in src/ui" : ""),
    closes: Array.from({ length: i % 9 }, (_, k) => `p1-review-critic-craft#craft-${i * 3 + k}`),
    launches: Array.from({ length: (i % 6) + 1 }, (_, k) => `a${i}${k}`),
    major: i % 5,
    minor: (i * 3) % 11,
  };
});

const UNIT_GLOSSARY_KEYS = ["ready", "verify", "debug", "land"] as const;

export const UNIT_COLUMNS: TableColumn<KitUnit>[] = [
  { id: "id", label: "Юнит", width: 64, primary: true, rank: (r) => r.id, cell: (r, c) => <span className="font-mono text-xs">{c.hl(r.id)}</span>, text: (r) => r.id },
  { id: "pass", label: "Проход", width: 76, numeric: true, rank: (r) => r.pass, cell: (r) => r.pass, text: (r) => String(r.pass) },
  { id: "state", label: "Состояние", width: 176, rank: (r) => UNIT_STATE[r.state].rank, glossary: glossaryFrom(UNIT_STATE, UNIT_GLOSSARY_KEYS), cell: (r) => <StatusDot state={UNIT_STATE[r.state]} truncate />, text: (r) => UNIT_STATE[r.state].compact },
  { id: "title", label: "Что делает", min: 200, cell: (r, c) => c.hl(r.title), text: (r) => r.title },
  { id: "sha", label: "Коммит", width: 96, rank: (r) => r.sha, cell: (r, c) => (r.sha ? <span className="font-mono text-xs">{c.hl(r.sha)}</span> : <Dash />), text: (r) => r.sha },
  { id: "major", label: "major+", width: 80, numeric: true, rank: (r) => r.major, cell: (r) => r.major, text: (r) => String(r.major) },
  { id: "minor", label: "minor", width: 72, numeric: true, rank: (r) => r.minor, cell: (r) => r.minor, text: (r) => String(r.minor) },
  { id: "launches", label: "Запуски", width: 88, numeric: true, rank: (r) => r.launches.length, cell: (r) => r.launches.length, text: (r) => String(r.launches.length) },
];

const UNIT_FILTERS: FilterDef<KitUnit>[] = [
  { id: "state", label: "Состояние", values: (r) => [r.state], options: (Object.keys(UNIT_STATE) as UnitState[]).map((v) => ({ value: v, label: UNIT_STATE[v].compact })), placeholder: "Найти состояние" },
  { id: "pass", label: "Проход", values: (r) => [String(r.pass)], options: [{ value: "1", label: "1" }, { value: "2", label: "2" }] },
];

const UNIT_SEARCH: SearchDef<KitUnit> = { identifiers: (r) => [r.id, r.sha, ...r.closes], text: (r) => [r.title], placeholder: "Юнит, коммит, находка, название" };
const UNIT_ACTIONS: RowAction<KitUnit>[] = [copyAction<KitUnit>("copy-id", "id", (r) => r.id), copyAction<KitUnit>("copy-sha", "коммит", (r) => r.sha)];
const UNIT_ROW_ID = (r: KitUnit) => r.id;
const UNIT_TITLE = (r: KitUnit) => `${r.id} — ${r.title}`;
const UNIT_NOUN = { forms: NOUNS.unit, gender: "m" as const };

function UnitCounts({ rows }: { rows: readonly KitUnit[] }): ReactNode {
  const by = new Map<UnitState, number>();
  for (const r of rows) by.set(r.state, (by.get(r.state) ?? 0) + 1);
  return (Object.keys(UNIT_STATE) as UnitState[])
    .filter((s) => by.has(s))
    .map((s) => (
      <span key={s} className="inline-flex items-center gap-1.5">
        <Dot tone={UNIT_STATE[s].tone} />
        {UNIT_STATE[s].compact}
        <span className="text-foreground tabular-nums">{by.get(s)}</span>
      </span>
    ));
}

function Heading({ title, rule }: { title: string; rule: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <h2 id="table-title" className="m-0 text-base font-semibold">
        {title}
      </h2>
      <p className="m-0 text-xs text-muted-foreground">{rule}</p>
    </div>
  );
}

function Label({ children }: { children: ReactNode }) {
  return <div className="mb-1.5 text-xs text-muted-foreground">{children}</div>;
}

export function TableSection() {
  const [findings, setFindings] = useState(FINDINGS);
  const [updated, setUpdated] = useState(UPDATED);
  const live = () => {
    // a live update: two findings arrive, one leaves the critical slice
    setFindings((rows) => [...rows.map((r, i) => (i === 377 ? { ...r, severity: "major" as const } : r)), ...kitFindings(2, rows.length)]);
    setUpdated(NOW);
  };
  return (
    <section id="table" aria-labelledby="table-title" className="flex scroll-mt-4 flex-col gap-3">
      <Heading title="Таблица данных" rule="Одна таблица на все списки прогона: фильтры, поиск, сортировка и страницы — в одном модуле на клиенте (rules/ui → Tables 1–5, table #1–15)" />
      <div>
        <Label>Находки самого большого прогона: 723 строки по 50 на странице, область 964 px рядом с сайдбаром 316 px</Label>
        <div className="flex h-[40rem] w-full max-w-[60.25rem] flex-col gap-2">
          <DataTable<KitFinding>
            id="kit-findings"
            runKey="tga/a098a7d4"
            label="Находки прогона a098a7d4"
            rows={findings}
            rowId={FINDING_ROW_ID}
            rowTitle={FINDING_TITLE}
            noun={FINDING_NOUN}
            columns={FINDING_COLUMNS}
            filters={FINDING_FILTERS}
            presets={FINDING_PRESETS}
            search={FINDING_SEARCH}
            actions={FINDING_ACTIONS}
            detail={(r) => <FindingDetail row={r} />}
            defaultSort={{ id: "severity", desc: false }}
            empty={{ form: "not-yet", step: "review", lead: "Критики ещё не писали отчётов", subject: "находки" }}
            updatedAt={updated}
            now={NOW}
          />
        </div>
        <Button variant="outline" size="sm" className="mt-2" onClick={live}>
          Показать живое обновление данных
        </Button>
      </div>
      <div>
        <Label>Юниты самого большого прогона: 42 строки одним списком, распределение — в строке состояния</Label>
        <div className="flex h-[40rem] w-full max-w-[60.25rem] flex-col">
          <DataTable<KitUnit>
            id="kit-units"
            runKey="tga/a098a7d4"
            label="Юниты прогона a098a7d4"
            rows={UNITS}
            rowId={UNIT_ROW_ID}
            rowTitle={UNIT_TITLE}
            noun={UNIT_NOUN}
            columns={UNIT_COLUMNS}
            filters={UNIT_FILTERS}
            search={UNIT_SEARCH}
            actions={UNIT_ACTIONS}
            detail={(r) => <RunningText text={`${r.title}\n\nЗакрывает: ${r.closes.join(", ") || "—"}`} />}
            defaultSort={{ id: "pass", desc: true }}
            defaultPaged={false}
            empty={{ form: "not-yet", step: "decompose" }}
            counts={(rows) => <UnitCounts rows={rows} />}
            updatedAt={UPDATED}
            now={NOW}
            searchShortcut={false}
          />
        </div>
      </div>
      <div className="grid gap-4 @3xl:grid-cols-2">
        <div>
          <Label>Первая загрузка: рамка со спиннером на месте таблицы, строка состояния уже на своём месте</Label>
          <div className="flex h-72 flex-col">
            <DataTable<KitUnit> id="kit-loading" runKey="kit" label="Юниты" rows={null} rowId={UNIT_ROW_ID} rowTitle={UNIT_TITLE} noun={UNIT_NOUN} columns={UNIT_COLUMNS} search={UNIT_SEARCH} empty={{ form: "not-yet", step: "decompose" }} searchShortcut={false} />
          </div>
        </div>
        <div>
          <Label>Ещё нет: этап, на котором появятся строки</Label>
          <div className="flex h-72 flex-col">
            <DataTable<KitUnit> id="kit-empty" runKey="kit" label="Юниты" rows={[]} rowId={UNIT_ROW_ID} rowTitle={UNIT_TITLE} noun={UNIT_NOUN} columns={UNIT_COLUMNS} search={UNIT_SEARCH} empty={{ form: "not-yet", step: "decompose" }} searchShortcut={false} />
          </div>
        </div>
      </div>
    </section>
  );
}
