// The section-label map of «Отчёты» (surfaces/reading.md → ASSUMPTIONS; the design check: the one map this unit
// owns) and the words code builds for a report: the tab set of each agent kind with its counts, what each part of a
// critic's report holds, a lens in words, a report's outcome in words, the partly-parsed line, and a craft report set
// against the surface's earlier one (the fold of a strip too wide for its reader is the shared tabs' own). The tab set is fixed per kind
// (and per lens for a critic), so two reports of one kind never shift the strip; an empty section stays with a muted
// «0»; «Кадры» and «Сравнение» stand only where they hold something. Agent kinds, launch states and severity words
// come from shared/states.ts, never from here.
import type { Finding, Launch } from "../../../shared/model.ts";
import { SEVERITY, type Severity } from "../../../shared/states.ts";
import { count, num, plural } from "../../../shared/text.ts";
import type { GlossaryEntry } from "@/ui";

/** A value the report left empty: «—», «-», «none» or nothing. */
const NONE = /^(—|-|none)?$/i;
export const filled = (s: string | null | undefined): s is string => typeof s === "string" && !NONE.test(s.trim());

/** Russian names of report sections (PRODUCT.md → Glossary: «отчёт критика», «отчёт запуска»). */
export const SECTION_LABELS = {
  FINDINGS: "Находки",
  UNVERIFIED: "Не проверено",
  CANDIDATES: "Идеи",
  ORDER: "План правок",
  ASSUMPTIONS: "Допущения",
  JUDGED: "Решённые вопросы",
  VERDICT: "Вердикты",
  ROWS: "Строки паритета",
  CONVENTIONS: "Соглашения",
  SHAPE: "Форма раздела",
  RESULT: "Итог",
  FILES: "Файлы",
  TESTS: "Тесты",
  NOTES: "Заметки",
  PARITY: "Паритет",
  VERIFY: "Проверка кода",
  FRAMES: "Кадры",
  COMPARE: "Сравнение",
  FILE: "Файл отчёта",
} as const;

/** What each part of a critic's report holds, said at the top of its panel: the tab's word answers «what is this»,
 * the panel it opens the rest (ux 0, ux 1 — a compact string's other questions one step away). */
export const SECTION_LEADS: Readonly<Record<string, string>> = {
  UNVERIFIED: "Что критик не смог подтвердить по коду и кадрам — и чем это проверить.",
  CANDIDATES: "Улучшения, которых не требуют правила проекта: критик предлагает их отдельно от находок.",
  ORDER: "Очередь правок, которую предлагает критик: раздел интерфейса, команда impeccable и находки, которые она закрывает.",
  ASSUMPTIONS: "Вопросы, на которые критик ответил сам, без вас: ответ и откуда он взят.",
  JUDGED: "Решения исполнителей юнитов, которые прогон отдал на суд критика: принято — с правилом, которому решение отвечает, или стало находкой.",
  VERDICT: "Исправлена ли каждая находка прошлого прохода: resolved — да, partial — отчасти, unresolved — нет.",
  ROWS: "Поведение системы, которую проект переносит, строка за строкой: kept — перенесено, lost — потеряно, settled — решено иначе.",
  CONVENTIONS: "Одно решение на задачу, которую юниты решали бы каждый по-своему.",
  SHAPE: "Каким будет новый раздел интерфейса, до брифа его юнита: вопрос, путь пользователя, блоки, выбранный вариант.",
};

/** The words a critic's LENS line is made of («craft assess», «code verdict»), each with what it means. */
const LENS_WORDS: Readonly<Record<string, string>> = {
  craft: "интерфейс раздела: критика и аудит impeccable по кадру и коду",
  code: "код юнитов: бриф, правила проекта, архитектура",
  runtime: "система в работе: поведение кода по логам и выводу проверок",
  shape: "форма нового раздела интерфейса до брифа его юнита",
  design: "общие решения интерфейса для всех юнитов прохода",
  parity: "перенос поведения системы, которую проект заменяет",
  improve: "улучшения готового результата на пути пользователя",
  assess: "оценка как есть, до правок прогона",
  verdict: "исправлены ли находки прошлого прохода",
};

/** The glossary of a lens: each word it names that the map knows, in its order; a word it does not know is left
 * unexplained rather than guessed. */
export function lensGlossary(lens: string): GlossaryEntry[] {
  return [...new Set(lens.trim().split(/\s+/))].filter((w) => w in LENS_WORDS).map((w) => ({ value: w, meaning: LENS_WORDS[w] }));
}

/** The parts of a merged implementer section: «Файлы» holds CHANGED and CREATED, «Тесты» RED and GREEN. */
export const PART_LABELS: Record<string, string> = {
  CHANGED: "Изменены",
  CREATED: "Созданы",
  RED: "До правки — тест падает (RED)",
  GREEN: "После правки — тест проходит (GREEN)",
};

export type ReportKind = "critic" | "implement" | "other";

export const reportKind = (l: Pick<Launch, "agent">): ReportKind => (l.agent === "fsloop-critic" ? "critic" : l.agent === "fsloop-implement" ? "implement" : "other");

/** A critic's lens, the first word of its LENS line: «craft assess» → «craft»; null for a launch without one. */
export function lensOf(l: Pick<Launch, "sections">): string | null {
  const value = l.sections.LENS?.value?.trim();
  return value ? value.split(/\s+/)[0] : null;
}

export type TabBody =
  | { kind: "findings" }
  | { kind: "items"; section: string; value: string | null; items: string[] }
  | { kind: "parts"; parts: { key: string; label: string; items: string[]; mono: boolean }[] }
  | { kind: "frames" }
  | { kind: "compare" }
  | { kind: "file" };

export interface ReportTab {
  /** The `tab=` value: lower-case. */
  id: string;
  label: string;
  count: number;
  body: TabBody;
}

export const FILE_TAB = "file";
export const FINDINGS_TAB = "findings";
export const FRAMES_TAB = "frames";
export const COMPARE_TAB = "compare";

/** Sections that are facts of the reader, not tabs: the lens and the craft scores. */
const FACT_SECTIONS = new Set(["LENS", "AUDIT"]);
const CRITIC_BASE = ["UNVERIFIED", "CANDIDATES", "ORDER", "ASSUMPTIONS"] as const;
const LENS_SECTIONS = ["JUDGED", "VERDICT", "ROWS", "CONVENTIONS", "SHAPE"] as const;
/** The section a lens always writes, present or not, so its reports share one strip. */
const LENS_IMPLIES: readonly [RegExp, string][] = [
  [/verdict/, "VERDICT"],
  [/^design/, "CONVENTIONS"],
  [/^shape/, "SHAPE"],
  [/^parity/, "ROWS"],
];
const IMPLEMENT_KNOWN = new Set(["RESULT", "CHANGED", "CREATED", "RED", "GREEN", "NOTES", "PARITY", "VERIFY"]);

const itemsOf = (l: Launch, key: string): { value: string | null; items: string[] } => {
  const s = l.sections[key];
  return { value: filled(s?.value) ? s.value.trim() : null, items: (s?.items ?? []).filter(filled) };
};

function itemsTab(l: Launch, key: string, label?: string): ReportTab {
  const { value, items } = itemsOf(l, key);
  return { id: key.toLowerCase(), label: label ?? SECTION_LABELS[key as keyof typeof SECTION_LABELS] ?? key, count: items.length + (value ? 1 : 0), body: { kind: "items", section: key, value, items } };
}

/** A section's whole list: its value split at commas (CHANGED: a, b), then its items. */
const listOf = (l: Launch, key: string): string[] => {
  const { value, items } = itemsOf(l, key);
  return [...(value ? value.split(/,\s*/).filter(filled) : []), ...items];
};

function partsTab(l: Launch, id: string, label: string, keys: readonly string[], mono: boolean): ReportTab {
  const parts = keys.map((key) => ({ key, label: PART_LABELS[key] ?? key, items: mono ? listOf(l, key) : [itemsOf(l, key).value, ...itemsOf(l, key).items].filter(filled), mono }));
  return { id, label, count: parts.reduce((n, p) => n + p.items.length, 0), body: { kind: "parts", parts } };
}

/** A report's findings: what its critic or implementer reported — its CANDIDATES lines, which the run also lists as
 * findings, stay under «Идеи вне прогона». */
export const reportFindings = <F extends Pick<Finding, "launch" | "source">>(findings: readonly F[], launch: string): F[] => findings.filter((f) => f.launch === launch && f.source !== "candidate");

const fileTab: ReportTab = { id: FILE_TAB, label: SECTION_LABELS.FILE, count: 1, body: { kind: "file" } };

/** The tabs of a report, fixed per agent kind, «Кадры» then «Файл отчёта» last; `findings` — the report's own
 * (`reportFindings`); `frames` — the frames of its surface, or those its findings cite. «Кадры» stands only when the
 * report has frames, for every kind (craft-1: a muted «0» there carried nothing and pushed «Файл отчёта» off the
 * strip); `compare` — a craft critic whose surface an earlier report scored gets «Сравнение» before them. A running
 * launch has no tabs. */
export function reportTabs(l: Launch, findings: number, frames = 0, { compare = false }: { compare?: boolean } = {}): ReportTab[] {
  const findingsTab = (): ReportTab => ({ id: FINDINGS_TAB, label: SECTION_LABELS.FINDINGS, count: findings, body: { kind: "findings" } });
  const framed: ReportTab[] = frames > 0 ? [{ id: FRAMES_TAB, label: SECTION_LABELS.FRAMES, count: frames, body: { kind: "frames" } }] : [];
  const kind = reportKind(l);
  const present = Object.keys(l.sections).filter((k) => !FACT_SECTIONS.has(k));
  if (kind === "critic") {
    const lens = l.sections.LENS?.value?.trim() ?? "";
    const extras = LENS_SECTIONS.filter((k) => present.includes(k) || LENS_IMPLIES.some(([re, s]) => s === k && re.test(lens)));
    const known = new Set<string>([...CRITIC_BASE, ...LENS_SECTIONS]);
    const others = present.filter((k) => !known.has(k));
    const compared: ReportTab[] = compare ? [{ id: COMPARE_TAB, label: SECTION_LABELS.COMPARE, count: 0, body: { kind: "compare" } }] : [];
    return [findingsTab(), ...CRITIC_BASE.map((k) => itemsTab(l, k)), ...extras.map((k) => itemsTab(l, k)), ...others.map((k) => itemsTab(l, k)), ...compared, ...framed, fileTab];
  }
  if (kind === "implement") {
    const others = present.filter((k) => !IMPLEMENT_KNOWN.has(k));
    return [
      itemsTab(l, "RESULT"),
      partsTab(l, "files", SECTION_LABELS.FILES, ["CHANGED", "CREATED"], true),
      partsTab(l, "tests", SECTION_LABELS.TESTS, ["RED", "GREEN"], false),
      itemsTab(l, "NOTES"),
      findingsTab(),
      itemsTab(l, "PARITY"),
      itemsTab(l, "VERIFY"),
      ...others.map((k) => itemsTab(l, k)),
      ...framed,
      fileTab,
    ];
  }
  return [...present.map((k) => itemsTab(l, k)), ...(findings ? [findingsTab()] : []), ...framed, fileTab];
}

/** The body of a tab nothing was written into. */
export function emptyTabText(kind: ReportKind): string {
  return kind === "critic" ? "Критик ничего сюда не записал." : kind === "implement" ? "Исполнитель ничего сюда не записал." : "Запуск ничего сюда не записал.";
}

/** A tab that carries no count: the file is one, the comparison is not a count of anything. */
export const uncounted = (id: string): boolean => id === FILE_TAB || id === COMPARE_TAB;

// ── a craft report against the surface's earlier one (u6 shape, cand-3) ────────────────────────

type Linked = Pick<Finding, "id" | "duplicateOf" | "repeatedBy">;

/** The findings of two reports on one surface, matched only by the run's own record: a later finding the run wrote
 * as a duplicate of an earlier one, or an earlier finding the run says a later one repeated. Nothing is matched by
 * its wording — two critics word one defect differently, and a guess would be a false state. */
export function compareFindings<F extends Linked>(earlier: readonly F[], later: readonly F[]): { fresh: F[]; kept: F[]; gone: F[] } {
  const before = new Set(earlier.map((f) => f.id));
  const repeated = new Map(earlier.flatMap((f) => (f.repeatedBy ? [[f.repeatedBy, f.id] as const] : [])));
  const matched = new Set<string>();
  const kept: F[] = [];
  const fresh: F[] = [];
  for (const f of later) {
    const was = f.duplicateOf && before.has(f.duplicateOf) ? f.duplicateOf : repeated.get(f.id);
    if (was) {
      kept.push(f);
      matched.add(was);
    } else fresh.push(f);
  }
  return { fresh, kept, gone: earlier.filter((f) => !matched.has(f.id)) };
}

/** «Находки 18 → 3 · Не проверено 1 → 1 · …»: the later report's parts that hold writing, each counted in both. */
export function partCounts(earlier: readonly ReportTab[], later: readonly ReportTab[]): string {
  const counted = (t: ReportTab) => t.body.kind === "findings" || t.body.kind === "items" || t.body.kind === "parts";
  const before = new Map(earlier.filter(counted).map((t) => [t.id, t.count]));
  return later
    .filter(counted)
    .map((t) => `${t.label} ${num(before.get(t.id) ?? 0)} → ${num(t.count)}`)
    .join(" · ");
}

// ── outcome words ────────────────────────────────────────────────────────────────────────────

const SEVERITY_ORDER: readonly Severity[] = ["critical", "major", "minor", "none"];

export interface SeverityCount {
  severity: Severity;
  n: number;
}

/** A report's findings by severity, critical first, only the severities present. */
export function severityCounts(findings: readonly Pick<Finding, "severity">[]): SeverityCount[] {
  return SEVERITY_ORDER.map((severity) => ({ severity, n: findings.filter((f) => (f.severity ?? "none") === severity).length })).filter((c) => c.n > 0);
}

/** «2 critical · 5 major · 3 minor» — the severity words as the shared map writes them. */
export const severityText = (counts: readonly SeverityCount[]): string => counts.map((c) => `${num(c.n)} ${SEVERITY[c.severity].compact}`).join(" · ");

export const VERDICT_WORDS = ["resolved", "partial", "unresolved"] as const;
export type VerdictWord = (typeof VERDICT_WORDS)[number];

/** A verdict launch's outcome, counted from the verdicts the model parsed with fsl.mjs's grammar (code-9); a line it
 * left unparsed counts nowhere. Null for another report. */
export function verdictCounts(l: Pick<Launch, "sections" | "verdicts">): Record<VerdictWord, number> | null {
  const lens = l.sections.LENS?.value ?? "";
  if (!l.sections.VERDICT && !/verdict/.test(lens)) return null;
  const out: Record<VerdictWord, number> = { resolved: 0, partial: 0, unresolved: 0 };
  for (const v of l.verdicts) out[v.result]++;
  return out;
}

/** «1 resolved · 1 partial · 0 unresolved». */
export const verdictText = (c: Record<VerdictWord, number>): string => VERDICT_WORDS.map((w) => `${num(c[w])} ${w}`).join(" · ");

/** An implementer's RESULT as written: «done», «partial», «blocked». */
export const resultOf = (l: Pick<Launch, "sections">): string | null => (filled(l.sections.RESULT?.value) ? l.sections.RESULT.value.trim() : null);

/** «3 строки не разобраны — они на вкладке «Файл отчёта»»; `inline` — a report whose file is its only part, shown
 * under the line with no strip: «… — они в тексте отчёта ниже». */
export function unparsedText(n: number, { inline = false }: { inline?: boolean } = {}): string {
  const lines = count(n, ["строка", "строки", "строк"]);
  const verb = plural(n, ["не разобрана", "не разобраны", "не разобраны"]);
  return `${lines} ${verb} — ${n === 1 ? "она" : "они"} ${inline ? "в тексте отчёта ниже" : `на вкладке «${SECTION_LABELS.FILE}»`}`;
}

/** What the reader says in a running launch's place. */
export const RUNNING_NOTE = "Отчёт появится, когда запуск закончит: его части и находки прогон разберёт из файла отчёта.";
