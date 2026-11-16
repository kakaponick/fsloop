// A finding line split once, for every surface: the rule it cites, what the critic saw, the fix with its
// `/impeccable` command, the operator's question it closes (rules/ui → Conventions 3). fsl.mjs parses the head of
// a FINDINGS line (`<id> [lens] <severity> <confidence> <cause> <file:line> — <rule> — <action>`); critics bend the
// tail of that grammar, so the split reads the markers they use: an observation after the rule's citations,
// `Problem:`, `/impeccable <verb>`, `Fix:`, `Action:`, `Questions it closes:`, `Closes «…»`.
import type { FindingText } from "../shared/model.ts";

const CAUSES = new Set(["local", "component", "token", "conceptual"]);
const DASH = /^(?:—|--?)$/;

export interface FindingHead {
  lens: string;
  severity: "critical" | "major" | "minor";
  confidence: string;
  cause: string | null;
  location: string | null;
  /** The text after the location: `<rule> — <action>` as the critic wrote it. */
  body: string;
}

/** The head of a FINDINGS line fsl.mjs could not read strictly — a cause before a dash, several locations. */
export function headOf(raw: string): FindingHead | null {
  const clean = raw.replace(/^[*_`]+([^*_`\s]+)[*_`]+:?/, "$1");
  const m = /^\S+\s+\[([\w-]+)\]\s+(critical|major|minor)\s+(high|med|low)\s+(.*)$/i.exec(clean);
  if (!m) return null;
  let rest = m[4];
  let cause: string | null = null;
  const first = /^(\S+)\s*(.*)$/.exec(rest);
  if (first && (CAUSES.has(first[1].toLowerCase()) || DASH.test(first[1]))) {
    cause = DASH.test(first[1]) ? null : first[1].toLowerCase();
    rest = first[2];
  }
  rest = rest.replace(/^(?:—|--?)\s+/, "");
  const cut = /\s(?:—|--)\s/.exec(rest);
  return {
    lens: m[1],
    severity: m[2].toLowerCase() as FindingHead["severity"],
    confidence: m[3].toLowerCase(),
    cause,
    location: (cut ? rest.slice(0, cut.index) : rest).trim() || null,
    body: cut ? rest.slice(cut.index + cut[0].length).trim() : "",
  };
}

/** A cited rule: the law's and the project's rule names, impeccable's heuristics, a rule file. */
const CITATION = /\bux \d|`ux|\bui\b|→|\brules?\/|\.md\b|\blaw\b|\bcode\b|\btests? \d|\btable #|impeccable (?:critique|audit)|PRODUCT\.md|DESIGN\.md|\bsource:/;
const QUESTION = /(?:Questions? it closes:|Closes «)/;
const COMMAND = /(?:^|\s)`?\/impeccable\s+([\w-]+)`?\s*:?/;
const MARKER = /(?<=^|\s—\s|[.;]\s{1,3})(?:Fix|fix|Action|action):\s/;
const SENTENCE_END = /\.\s+(?=[A-ZА-ЯЁ«`("])/g;

/** The text's ` — ` segments; a dash inside «…», (…) or `…` belongs to its quote, not to the grammar. */
export function segmentsOf(text: string): string[] {
  const out: string[] = [];
  let paren = 0;
  let quote = 0;
  let code = false;
  let from = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === "`") code = !code;
    else if (code) continue;
    else if (c === "(") paren++;
    else if (c === ")") paren = Math.max(0, paren - 1);
    else if (c === "«") quote++;
    else if (c === "»") quote = Math.max(0, quote - 1);
    else if (!paren && !quote && /\s/.test(c)) {
      const m = /^\s(?:—|--)\s/.exec(text.slice(i, i + 4));
      if (m) {
        out.push(text.slice(from, i));
        from = i + m[0].length;
        i = from - 1;
      }
    }
  }
  out.push(text.slice(from));
  return out;
}

const trimRule =(s: string) => s.replace(/^rule:\s*/i, "").replace(/[\s.;,]+$/, "").trim();
const orNull = (s: string | null | undefined) => (s && s.trim() ? s.trim() : null);

/** The observation a critic wrote into its rule segment, after its citations: «ux 8, impeccable critique: X. Whenever …». */
function tailSplit(rule: string): { rule: string; observation: string } | null {
  const marks = [...rule.matchAll(/impeccable (?:critique|audit):/g)];
  const re = new RegExp(SENTENCE_END.source, "g");
  re.lastIndex = marks.length ? (marks.at(-1)?.index ?? 0) : 0;
  const m = re.exec(rule);
  if (!m) return null;
  const before = rule.slice(0, m.index);
  if (!marks.length && !CITATION.test(before)) return null;
  return { rule: before, observation: rule.slice(m.index + 1).trim() };
}

/** The first whole sentence of a text, for a row: never cut at a colon, at most 220 characters. */
export function firstSentence(text: string): string {
  const t = text.replace(/\s+/g, " ").trim();
  const re = /[.!?](?=\s+[A-ZА-ЯЁ«`("]|$)/g;
  let s = t;
  for (let m = re.exec(t); m; m = re.exec(t))
    if (m.index + 1 >= 40) {
      s = t.slice(0, m.index + 1);
      break;
    }
  if (s.length <= 220) return s;
  const cut = s.lastIndexOf(" ", 219);
  return s.slice(0, cut > 100 ? cut : 219).replace(/[\s,;:—-]+$/, "") + "…";
}

/** Splits a finding's text. `structured` — a critic's line after its location; otherwise (an implementer's OPEN
 * line, a candidate, the run's own finding) the text is kept whole as the observation. */
export function splitText(body: string, { structured }: { structured: boolean }): Omit<FindingText, "summary"> {
  const text = body.trim();
  if (!structured || !text) return { rule: null, observation: orNull(text), fixCommand: null, fix: null, question: null };

  let rest = text;
  let question: string | null = null;
  const q = QUESTION.exec(rest);
  if (q) {
    question = orNull(
      rest
        .slice(q.index)
        .replace(/^(?:Questions? it closes:|Closes)\s*/, "")
        .replace(/\.$/, ""),
    );
    rest = rest.slice(0, q.index).trim();
  }

  const command = COMMAND.exec(rest);
  const marker = MARKER.exec(rest);
  const at = [command ? command.index + (command[0].startsWith(" ") ? 1 : 0) : -1, marker ? marker.index : -1].filter((i) => i >= 0);
  let fixPart: string | null = null;
  let fixCommand: string | null = null;
  if (at.length) {
    const i = Math.min(...at);
    fixPart = rest.slice(i).trim();
    rest = rest.slice(0, i).replace(/\s*(?:—|--)\s*$/, "").trim();
    const c = /^`?\/impeccable\s+([\w-]+)`?\s*:?\s*/.exec(fixPart);
    if (c) {
      fixCommand = c[1];
      fixPart = fixPart.slice(c[0].length);
    } else fixPart = fixPart.replace(/^(?:Fix|fix|Action|action):\s*/, "");
  }

  let rule: string | null;
  let observation: string | null;
  const head = rest.replace(/^rule:\s*/i, "");
  const problem = /\bProblem:\s*/.exec(head);
  if (problem) {
    rule = head.slice(0, problem.index);
    observation = head.slice(problem.index + problem[0].length);
  } else {
    const segments = segmentsOf(head);
    rule = segments[0];
    const middle = segments.slice(1);
    // The grammar's last segment is the action when no marker named it.
    if (!at.length && middle.length >= 2) fixPart = middle.pop() ?? null;
    observation = middle.join(" — ");
    if (!observation.trim()) {
      const t = tailSplit(rule);
      if (t) ({ rule, observation } = t);
    }
  }
  rule = orNull(trimRule(rule ?? ""));
  observation = orNull(observation);
  // A segment with no citation in it is not a rule: the whole text stays one unsplit observation.
  if (rule && !observation && !CITATION.test(rule)) [rule, observation] = [null, rule];
  if (rule && rule === observation) rule = null;
  return { rule, observation, fixCommand, fix: orNull(fixPart), question };
}

/** The frames a text cites — `p<pass>-<moment>-<surface>…` stems of any pass, `init-…` — among the run's shots. */
export function framesOf(texts: (string | null | undefined)[], shots: string[]): string[] {
  const stems = new Set<string>();
  for (const t of texts)
    for (const m of (t ?? "").matchAll(/\b(?:p\d+-[a-z]+-[A-Za-z0-9._-]+|init-[A-Za-z0-9._-]+)/g)) stems.add(m[0].replace(/[.,:;)]+$/, "").replace(/\.png$/, ""));
  if (!stems.size) return [];
  return shots.filter((s) => {
    const name = s.replace(/\.png$/, "");
    return [...stems].some((stem) => name === stem || name.startsWith(stem.endsWith("-") ? stem : `${stem}-`));
  });
}
