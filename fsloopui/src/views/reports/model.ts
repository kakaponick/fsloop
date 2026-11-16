// The rail's model (surfaces/reading.md → BLOCKS 1–2, 7): every launch of the run in run order — critics of every
// lens, implementers, the map, research, verdicts — then the launches still running; what each carries for the
// search and the «Агент», «Линза», «Раздел» filters; the stage groups; the held order of a live rail; the overview's
// ranking of surfaces. Pure functions over the run model: the view and the tests read the same ones.
import type { Finding, Launch, Run, RunningLaunch, Surface, SurfaceScore } from "../../../shared/model.ts";
import { agentKind, launchState, stageOf, type Tone } from "../../../shared/states.ts";
import { count, NOUNS, num } from "../../../shared/text.ts";
import type { FilterDef, SearchDef } from "@/table";
import { ofTotal } from "@/table/status-bar.tsx";
import { lensOf, reportFindings, reportKind, resultOf, severityCounts, severityText, verdictCounts, verdictText } from "./sections.ts";

/** The view state's id: filters and search per run, history per view. */
export const REPORTS_VIEW = "reports";

/** A value a launch carries when its field is absent: no lens, no surface. */
export const NONE = "none";

export interface RailItem {
  /** The launch id, or the running agent's id. */
  id: string;
  launch: Launch | null;
  running: RunningLaunch | null;
  stage: string | null;
  /** What the run called the launch: «craft accounts», «u30 implement». */
  description: string;
  /** The agent kind's word: «критик», «исполнитель», «карта», «разведка», another agent as written. */
  kind: string;
  lens: string | null;
  /** The surfaces the report judges: its craft scores and its description. */
  surfaces: string[];
}

type RunLike = Pick<Run, "launches" | "running" | "surfaces" | "now">;

const CRAFT = /^craft\s+(.+)$/;

export function surfacesOf(l: Pick<Launch, "id" | "description">, surfaces: readonly Surface[]): string[] {
  const own = CRAFT.exec(l.description ?? "")?.[1]?.trim();
  return surfaces.filter((s) => s.key === own || s.scores.some((sc) => sc.launch === l.id)).map((s) => s.key);
}

/** The rail's items in run order: the recorded launches, then the running ones under the run's current stage. */
export function railItems(run: RunLike): RailItem[] {
  const done: RailItem[] = run.launches.map((l) => ({
    id: l.id,
    launch: l,
    running: null,
    stage: l.stage,
    description: l.description ?? l.name,
    kind: l.kind,
    lens: reportKind(l) === "critic" ? lensOf(l) : null,
    surfaces: surfacesOf(l, run.surfaces),
  }));
  const running: RailItem[] = run.running.map((r) => ({
    id: r.agentId,
    launch: null,
    running: r,
    stage: run.now?.stage ?? null,
    description: r.description ?? r.name,
    kind: agentKind(r),
    lens: null,
    surfaces: [],
  }));
  return [...done, ...running];
}

const distinct = (xs: readonly string[]) => [...new Set(xs)];

/** «Агент» (a select of at most six kinds), «Линза» and «Раздел» (comboboxes: sets that grow with the run). */
export function filtersFor(items: readonly RailItem[], run: Pick<Run, "surfaces">): { agent: FilterDef<RailItem>; lens: FilterDef<RailItem>; surface: FilterDef<RailItem> } {
  const lenses = distinct(items.map((i) => i.lens).filter((x): x is string => Boolean(x)));
  return {
    agent: { id: "agent", label: "Агент", values: (i) => [i.kind], options: distinct(items.map((i) => i.kind)).map((k) => ({ value: k, label: k })) },
    lens: {
      id: "lens",
      label: "Линза критика",
      values: (i) => [i.lens ?? NONE],
      options: [...lenses.map((l) => ({ value: l, label: l })), ...(items.some((i) => !i.lens) ? [{ value: NONE, label: "без линзы" }] : [])],
      placeholder: "Найти линзу",
    },
    surface: {
      id: "surface",
      label: "Раздел",
      values: (i) => (i.surfaces.length ? i.surfaces : [NONE]),
      options: [...run.surfaces.map((s) => ({ value: s.key, label: s.key })), ...(items.some((i) => !i.surfaces.length) ? [{ value: NONE, label: "без раздела" }] : [])],
      placeholder: "Найти раздел",
    },
  };
}

export const SEARCH: SearchDef<RailItem> = {
  identifiers: (i) => [i.id, ...i.surfaces, i.launch?.report],
  text: (i) => [i.description, i.kind, i.lens],
  placeholder: "Описание, id запуска, раздел",
};

// ── stage groups ─────────────────────────────────────────────────────────────────────────────

export interface RailGroup {
  stage: string | null;
  items: RailItem[];
}

/** The items of each stage, the stages in the order the run reached them, the items in run order within each — one
 * heading per stage, even when a launch of another stage started between two of its own. */
export function groupsOf(items: readonly RailItem[]): RailGroup[] {
  const out: RailGroup[] = [];
  for (const item of items) {
    const group = out.find((g) => g.stage === item.stage);
    if (group) group.items.push(item);
    else out.push({ stage: item.stage, items: [item] });
  }
  return out;
}

/** The kind most of a group's rows share — a tie keeps the one that came first. The rail names a row's kind only
 * where it differs from it (cand-2): «карта · проход 1» holds the map and 20 critics, and only the map says «карта». */
export function commonKind(items: readonly Pick<RailItem, "kind">[]): string | null {
  const counts = new Map<string, number>();
  for (const i of items) counts.set(i.kind, (counts.get(i.kind) ?? 0) + 1);
  let best: string | null = null;
  for (const [kind, n] of counts) if (best === null || n > (counts.get(best) ?? 0)) best = kind;
  return best;
}

/** A group's implementers (`of`, the recorded ones) and the result most of them share, when two or more share it
 * (improve-10 (3)): the rail says «итог: <result>» only on a row whose result differs from it — «итог: done» on 16
 * rows of one stage ranked nothing — and names the shared one once, under the group's heading (craft-10). */
export function groupResult(items: readonly Pick<RailItem, "launch">[]): { of: number; shared: { result: string; n: number } | null } {
  const counts = new Map<string, number>();
  let of = 0;
  for (const i of items) {
    if (!i.launch || reportKind(i.launch) !== "implement") continue;
    of++;
    const result = resultOf(i.launch);
    if (result) counts.set(result, (counts.get(result) ?? 0) + 1);
  }
  let best: string | null = null;
  for (const [result, n] of counts) if (best === null || n > (counts.get(best) ?? 0)) best = result;
  const n = best === null ? 0 : (counts.get(best) ?? 0);
  return { of, shared: best !== null && n >= 2 ? { result: best, n } : null };
}

/** The line under a group's heading: «итог: done — у 15 из 16 отчётов» (of the group's reports, the heading's own
 * count), or «общего итога нет» where no two share one — then every row says its own. */
export function sharedResultText(shared: { result: string; n: number } | null, total: number): string {
  if (!shared) return "общего итога нет";
  return `итог: ${shared.result} — у ${num(shared.n)} ${ofTotal(total, NOUNS.report)}`;
}

/** The narrow view's «Отчёт» option for an item: what the rail shows of it — the description, its stage heading and
 * its state line (cand-4: the picker stands in for the rail, so it recalls nothing the rail shows). */
export function pickerLabel(item: RailItem, state: ItemState): string {
  const title = groupTitle(item.stage);
  return `${item.description} · ${title.word}${title.pass ? `, ${title.pass}` : ""} · ${state.text}`;
}

/** A group's heading: the stage word, «проход k» — «ревью», «проход 2»; a launch with no stage — «этап не записан». */
export function groupTitle(stage: string | null): { word: string; pass: string | null } {
  if (!stage) return { word: "этап не записан", pass: null };
  const s = stageOf(stage);
  return { word: s.compact, pass: s.pass === null ? null : `проход ${s.pass}` };
}

// ── an item's state line ─────────────────────────────────────────────────────────────────────

export interface ItemState {
  tone: Tone;
  text: string;
}

/** The rail's second line: «2 major · 5 minor», neutral — on a rail of reports in run order every critic would wear
 * the same red, so severity's tone stays where it ranks (the reader, the overview); a verdict's counts; an
 * implementer's result — but for the result its group shares (`usual`), where it reads how long it took; «работает ·
 * 12 мин» while it runs; «нет отчёта», in its warning tone, when its file is missing. */
export function itemState(item: RailItem, findings: readonly Finding[], now: number, { ended = false, usual = null }: { ended?: boolean; usual?: string | null } = {}): ItemState {
  if (item.running) {
    if (ended) return { tone: "neutral", text: launchState({ running: false }, now).label };
    const s = launchState({ running: true, startedAt: item.running.startedAt }, now);
    return { tone: s.tone, text: s.label };
  }
  const l = item.launch as Launch;
  if (l.reportMissing) {
    const s = launchState({ running: false, reportMissing: true }, now);
    return { tone: s.tone, text: s.label };
  }
  const kind = reportKind(l);
  const verdicts = kind === "critic" ? verdictCounts(l) : null;
  if (verdicts) return { tone: "neutral", text: verdictText(verdicts) };
  const own = reportFindings(findings, l.id);
  if (kind === "implement") {
    const result = resultOf(l);
    const open = own.length ? ` · ${count(own.length, NOUNS.finding)}` : "";
    return { tone: "neutral", text: result && result !== usual ? `итог: ${result}${open}` : `${launchState({ running: false, seconds: l.seconds }, now).label}${open}` };
  }
  if (kind === "critic") {
    const counts = severityCounts(own);
    return { tone: "neutral", text: counts.length ? severityText(counts) : "без находок" };
  }
  const s = launchState({ running: false, seconds: l.seconds }, now);
  return { tone: s.tone, text: s.label };
}

// ── the held order (rules/ui → Live data; ui → Live data) ────────────────────────────────────

export interface Held {
  /** The ids in the order the user sees. */
  order: string[];
  /** The last copy of every placed item: a running launch that ended is drawn from here until the strip is clicked. */
  known: Record<string, RailItem>;
  /** Placed by a click on the strip: they carry the edge mark. */
  arrived: string[];
}

export function placeItems(items: readonly RailItem[], previous?: Held): Held {
  const before = previous ? new Set(previous.order) : null;
  return {
    order: items.map((i) => i.id),
    known: Object.fromEntries(items.map((i) => [i.id, i])),
    arrived: before ? items.filter((i) => !before.has(i.id)).map((i) => i.id) : [],
  };
}

export interface HeldItem {
  item: RailItem;
  /** A running launch that has since ended: it waits for the strip in its old place. */
  ended: boolean;
}

/** The rail as placed, with today's copies; what waits in the strip: new launches, and ended ones to re-place. */
export function heldItems(held: Held, items: readonly RailItem[]): { shown: HeldItem[]; fresh: number; moved: number } {
  const current = new Map(items.map((i) => [i.id, i]));
  const placed = new Set(held.order);
  const shown = held.order.map((id) => ({ item: current.get(id) ?? held.known[id], ended: !current.has(id) }));
  return { shown, fresh: items.filter((i) => !placed.has(i.id)).length, moved: shown.filter((s) => s.ended).length };
}

/** The item a `report=` id names: a launch, a running agent, or — once a running agent ended — the launch the run
 * recorded for it: the one whose record names that agent's id, read from the run whenever the page opens (craft-12);
 * for a record that names none, the one placed while it ran, by description (the latest). */
export function resolveItem(id: string | null, items: readonly RailItem[], known: Readonly<Record<string, RailItem>>): RailItem | null {
  if (!id) return null;
  const direct = items.find((i) => i.id === id) ?? items.find((i) => i.launch?.agentId === id);
  if (direct) return direct;
  const was = known[id];
  if (was?.running) return [...items].reverse().find((i) => i.launch && i.description === was.description) ?? was;
  return null;
}

// ── the overview (BLOCKS 7) ──────────────────────────────────────────────────────────────────

export interface SurfaceLine {
  key: string;
  label: string;
  critical: number;
  major: number;
  scores: SurfaceScore[];
}

/** How a surface stood at its latest judged stage: the mean of its audit and critique as shares of their scales;
 * null when no stage scored it. */
function standing(scores: readonly SurfaceScore[]): number | null {
  const last = scores.at(-1);
  if (!last) return null;
  const shares = [
    last.audit !== null && last.auditMax ? last.audit / last.auditMax : null,
    last.critique !== null && last.critiqueMax ? last.critique / last.critiqueMax : null,
  ].filter((x): x is number => x !== null);
  return shares.length ? shares.reduce((a, b) => a + b, 0) / shares.length : null;
}

/** The surfaces ranked by critical + major findings, most first; equal ones by their latest score, the lower first,
 * a surface no stage scored after them; then by key. */
export function rankSurfaces(surfaces: readonly Surface[], findings: readonly Pick<Finding, "surface" | "severity">[]): SurfaceLine[] {
  const rank = (s: SurfaceLine) => standing(s.scores) ?? Number.POSITIVE_INFINITY;
  return surfaces
    .map((s) => {
      const own = findings.filter((f) => f.surface === s.key);
      return { key: s.key, label: s.label, critical: own.filter((f) => f.severity === "critical").length, major: own.filter((f) => f.severity === "major").length, scores: s.scores };
    })
    .sort((a, b) => b.critical + b.major - (a.critical + a.major) || b.critical - a.critical || rank(a) - rank(b) || a.key.localeCompare(b.key));
}

/** The report that scored the same surface just before `launch` — a craft report's earlier counterpart (u6 shape,
 * cand-3: p1-map against p2-assess); null for a surface's first report, or one that scores none. */
export function earlierReport(surfaces: readonly Pick<Surface, "scores">[], launch: string): string | null {
  for (const s of surfaces) {
    const at = s.scores.findIndex((sc) => sc.launch === launch);
    if (at > 0) return s.scores[at - 1].launch;
  }
  return null;
}

/** One score series: the stages that wrote it, in order, and the scale its last stage used. */
export function series(scores: readonly SurfaceScore[], which: "audit" | "critique"): { points: { value: number; stage: string; launch: string }[]; max: number | null } {
  const points = scores.flatMap((s) => (s[which] === null ? [] : [{ value: s[which] as number, stage: s.stage, launch: s.launch }]));
  const maxes = scores.map((s) => (which === "audit" ? s.auditMax : s.critiqueMax)).filter((m): m is number => m !== null);
  return { points, max: maxes.at(-1) ?? null };
}
