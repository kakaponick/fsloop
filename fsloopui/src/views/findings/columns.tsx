// The findings table's columns (surfaces/findings.md → BLOCKS → FindingRow cells, RANGES → width budget): each a
// fixed width that clears its header, its sort icon and its widest ordinary value; «Находка» is the one width-free
// column. At 964 px beside the sidebar the visible ones fit; «Место», «Уверенность», «Охват», «Этап» start hidden.
import type { Finding } from "../../../shared/model.ts";
import { FINDING_STATUS, SEVERITY, stageOf, VERDICT } from "../../../shared/states.ts";
import { Dash, glossaryFrom, NotRecorded, stateWord, type GlossaryEntry } from "@/ui";
import type { TableColumn } from "@/table";
// From the files, not the index: the index reaches the app's links, which reach this view (a cycle at load time).
import { SeverityCell, severityState, StateCell, stateText, VerdictCell } from "@/finding/cells.tsx";
import { CAUSE, CONFIDENCE, enumGlossary, reportWord } from "@/finding/words.ts";
import { confidenceRank, severityRank, stageRank, stateRank, verdictRank } from "./query.ts";

/** The state words a new reader cannot read alone, in the map's order (ui → Glossary: at most 8). */
const STATE_GLOSSARY = glossaryFrom(FINDING_STATUS, ["candidate", "queued", "blocked", "unresolved", "repeated", "open", "closed", "dropped"]);
const SEVERITY_GLOSSARY = glossaryFrom(SEVERITY, ["critical", "major", "minor"]);
const VERDICT_GLOSSARY = glossaryFrom(VERDICT, ["wrong-severity", "false-positive"]);
// one source with the article's fact line (src/finding/words.ts), so a header's glossary and the detail agree
export const CONFIDENCE_GLOSSARY: readonly GlossaryEntry[] = enumGlossary(CONFIDENCE);
export const CAUSE_GLOSSARY: readonly GlossaryEntry[] = enumGlossary(CAUSE);

export const COLUMNS: readonly TableColumn<Finding>[] = [
  {
    id: "severity",
    label: "Серьёзность",
    width: 116,
    rank: severityRank,
    glossary: SEVERITY_GLOSSARY,
    cell: (f) => <SeverityCell finding={f} />,
    text: (f) => stateWord(severityState(f)),
  },
  { id: "id", label: "ID", width: 112, primary: true, rank: (f) => f.id, cell: (f, c) => <span className="font-mono text-xs">{c.hl(f.local)}</span>, text: (f) => f.id },
  { id: "summary", label: "Находка", min: 240, cell: (f, c) => c.hl(f.summary), text: (f) => f.summary },
  { id: "report", label: "Отчёт", width: 160, resizable: true, min: 112, max: 320, rank: (f) => reportWord(f), cell: (f, c) => c.hl(reportWord(f)), text: (f) => (f.launch ? `${f.launchName} — ${f.launch}` : reportWord(f)) },
  { id: "state", label: "Состояние", width: 136, rank: stateRank, glossary: STATE_GLOSSARY, cell: (f) => <StateCell finding={f} />, text: stateText },
  { id: "verdict", label: "Оценка", width: 128, rank: verdictRank, glossary: VERDICT_GLOSSARY, cell: (f) => <VerdictCell finding={f} />, text: (f) => (f.verdict ? VERDICT[f.verdict.verdict].compact : undefined) },
  { id: "location", label: "Место", width: 220, resizable: true, min: 120, max: 480, hidden: true, rank: (f) => f.location, cell: (f, c) => (f.location ? <span className="font-mono text-xs">{c.hl(f.location)}</span> : <NotRecorded />), text: (f) => f.location },
  { id: "confidence", label: "Уверенность", width: 116, hidden: true, rank: confidenceRank, glossary: CONFIDENCE_GLOSSARY, cell: (f) => f.confidence ?? <Dash />, text: (f) => f.confidence },
  { id: "cause", label: "Охват", width: 108, hidden: true, rank: (f) => f.cause, glossary: CAUSE_GLOSSARY, cell: (f) => f.cause ?? <Dash />, text: (f) => f.cause },
  { id: "stage", label: "Этап", width: 200, hidden: true, rank: stageRank, cell: (f) => stageOf(f.stage).full, text: (f) => stageOf(f.stage).full },
];
