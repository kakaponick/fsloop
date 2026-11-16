// The section-label map of «Отчёты» (surfaces/reading.md → ASSUMPTIONS; the design check: the one map this unit
// owns) and the words code builds for a report: the tab set of each agent kind with its counts, a report's outcome
// in words, the partly-parsed line. The tab set is fixed per kind (and per lens for a critic), so two reports of
// one kind never shift the strip; an empty section stays with a muted «0». Agent kinds, launch states and severity
// words come from shared/states.ts, never from here.
import type { Finding, Launch } from "../../../shared/model.ts";
import { SEVERITY, type Severity, type Tone } from "../../../shared/states.ts";
import { count, num, plural } from "../../../shared/text.ts";

/** A value the report left empty: «—», «-», «none» or nothing. */
const NONE = /^(—|-|none)?$/i;
export const filled = (s: string | null | undefined): s is string => typeof s === "string" && !NONE.test(s.trim());

/** Russian names of report sections (PRODUCT.md → Glossary: «отчёт критика», «отчёт запуска»). */
export const SECTION_LABELS = {
  FINDINGS: "Находки",
  UNVERIFIED: "Не проверено",
  CANDIDATES: "Идеи вне прогона",
  ORDER: "Порядок правок",
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
  FILE: "Файл отчёта",
} as const;

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

/** The tabs of a report, fixed per agent kind, «Файл отчёта» last; `findings` — the report's own (`reportFindings`).
 * A running launch has none. */
export function reportTabs(l: Launch, findings: number): ReportTab[] {
  const findingsTab = (): ReportTab => ({ id: FINDINGS_TAB, label: SECTION_LABELS.FINDINGS, count: findings, body: { kind: "findings" } });
  const kind = reportKind(l);
  const present = Object.keys(l.sections).filter((k) => !FACT_SECTIONS.has(k));
  if (kind === "critic") {
    const lens = l.sections.LENS?.value?.trim() ?? "";
    const extras = LENS_SECTIONS.filter((k) => present.includes(k) || LENS_IMPLIES.some(([re, s]) => s === k && re.test(lens)));
    const known = new Set<string>([...CRITIC_BASE, ...LENS_SECTIONS]);
    const others = present.filter((k) => !known.has(k));
    return [findingsTab(), ...CRITIC_BASE.map((k) => itemsTab(l, k)), ...extras.map((k) => itemsTab(l, k)), ...others.map((k) => itemsTab(l, k)), fileTab];
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
      fileTab,
    ];
  }
  return [...present.map((k) => itemsTab(l, k)), ...(findings ? [findingsTab()] : []), fileTab];
}

/** The body of a tab nothing was written into. */
export function emptyTabText(kind: ReportKind): string {
  return kind === "critic" ? "Критик ничего сюда не записал." : kind === "implement" ? "Исполнитель ничего сюда не записал." : "Запуск ничего сюда не записал.";
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

/** The tone of the worst severity present (Conventions 2: critical red, major amber, minor neutral). */
export const worstTone = (counts: readonly SeverityCount[]): Tone => (counts.length ? SEVERITY[counts[0].severity].tone : "neutral");

export const VERDICT_WORDS = ["resolved", "partial", "unresolved"] as const;
export type VerdictWord = (typeof VERDICT_WORDS)[number];

/** A verdict launch's outcome, counted from its VERDICT lines («<id> resolved — …»); null for another report. */
export function verdictCounts(l: Pick<Launch, "sections">): Record<VerdictWord, number> | null {
  const s = l.sections.VERDICT;
  const lens = l.sections.LENS?.value ?? "";
  if (!s && !/verdict/.test(lens)) return null;
  const out: Record<VerdictWord, number> = { resolved: 0, partial: 0, unresolved: 0 };
  for (const item of (s?.items ?? []).filter(filled)) {
    const word = /\b(unresolved|resolved|partial)\b/.exec(item)?.[1] as VerdictWord | undefined;
    if (word) out[word]++;
  }
  return out;
}

/** «1 resolved · 1 partial · 0 unresolved». */
export const verdictText = (c: Record<VerdictWord, number>): string => VERDICT_WORDS.map((w) => `${num(c[w])} ${w}`).join(" · ");

/** An implementer's RESULT as written: «done», «partial», «blocked». */
export const resultOf = (l: Pick<Launch, "sections">): string | null => (filled(l.sections.RESULT?.value) ? l.sections.RESULT.value.trim() : null);

/** «3 строки не разобраны — они на вкладке «Файл отчёта»». */
export function unparsedText(n: number): string {
  const lines = count(n, ["строка", "строки", "строк"]);
  const verb = plural(n, ["не разобрана", "не разобраны", "не разобраны"]);
  return `${lines} ${verb} — ${n === 1 ? "она" : "они"} на вкладке «${SECTION_LABELS.FILE}»`;
}

/** What the reader says in a running launch's place. */
export const RUNNING_NOTE = "Отчёт появится, когда запуск закончит: его части и находки прогон разберёт из файла отчёта.";
