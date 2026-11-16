// A journal entry's ref (surfaces/reading.md → BLOCKS «Журнал»; the design check: the ref link is the app's
// `ObjectLink` — this file only maps the journal's ref kinds onto it). A finding opens in «Находки», a unit in
// «Юниты», a launch or a judge in «Отчёты», another entry here; a pass or a free text is plain; an id the run
// does not hold reads «не найден»; «—» is no ref at all. Beside each link, the one-line fact it resolves to, so the
// basis of a decision reads without a click (craft-30): a finding's severity and sentence, a unit's state and title,
// a report's kind and launch, an entry's question — cut at the column's end, whole in its title and where it leads.
import type { JournalRef, Run } from "../../../shared/model.ts";
import { reportWord, SEVERITY, UNIT_STATE } from "../../../shared/states.ts";
import { NotFound, StatusDot, type DotState } from "@/ui";
import { ObjectLink, type ObjectKind } from "../../app/links.tsx";

type RunLike = Pick<Run, "findings" | "units" | "launches" | "journal"> & { key: string };

const NONE = /^(—|-|none)?$/i;

/** The app's object a ref kind opens; null — the ref is plain text. */
export function refObject(ref: Pick<JournalRef, "id" | "kind">): { kind: ObjectKind; id: string } | null {
  switch (ref.kind) {
    case "finding":
      return { kind: "finding", id: ref.id };
    case "unit":
      return { kind: "unit", id: ref.id };
    case "launch":
    case "judge":
      return { kind: "report", id: ref.id };
    case "journal":
      return { kind: "entry", id: ref.id.replace(/^j/, "") };
    default:
      return null;
  }
}

/** Whether a ref names anything: «—» does not. */
export const isRef = (ref: Pick<JournalRef, "id">): boolean => !NONE.test(ref.id.trim());

/** What a ref's object says in one line: its state when it has one, then its text. */
export interface RefFact {
  state?: DotState;
  text: string;
}

/** The fact a ref resolves to; null — the run does not hold its object, or the ref names none. */
export function refFact(run: RunLike, ref: Pick<JournalRef, "id" | "kind">): RefFact | null {
  const target = refObject(ref);
  switch (target?.kind) {
    case "finding": {
      const f = run.findings.find((x) => x.id === target.id);
      return f ? { state: SEVERITY[f.severity ?? "none"], text: f.summary } : null;
    }
    case "unit": {
      const u = run.units.find((x) => x.id === target.id);
      return u ? { state: UNIT_STATE[u.state], text: u.title } : null;
    }
    case "report": {
      const l = run.launches.find((x) => x.id === target.id);
      return l ? { text: `${reportWord(l)} · ${l.name}` } : null;
    }
    case "entry": {
      const e = run.journal.find((x) => x.n === target.id);
      return e ? { text: e.question } : null;
    }
    default:
      return null;
  }
}

/** The «не найден» word for an id-shaped text the run does not hold: a unit «u7», a finding «…#…», else a launch. */
const guessKind = (id: string) => (/^[uf]\d+$/.test(id) ? "unit" : id.includes("#") ? "finding" : "launch");

export function RefLink({ run, refItem }: { run: RunLike; refItem: JournalRef }) {
  if (!isRef(refItem)) return null;
  const target = refObject(refItem);
  if (target) {
    const fact = refFact(run, refItem);
    return (
      <span data-slot="ref" className="flex min-w-0 items-baseline gap-2">
        <ObjectLink run={run} kind={target.kind} id={target.id} className="shrink-0">
          <span className="font-mono text-xs">{refItem.id}</span>
        </ObjectLink>
        {fact &&
          (fact.state ? (
            <StatusDot state={fact.state} detail={fact.text || undefined} truncate className="text-muted-foreground" />
          ) : (
            <span className="min-w-0 truncate text-muted-foreground" title={fact.text}>
              {fact.text}
            </span>
          ))}
      </span>
    );
  }
  if (!refItem.found) return <NotFound kind={guessKind(refItem.id)} id={refItem.id} />;
  return <span className="font-mono text-xs break-all">{refItem.id}</span>;
}
