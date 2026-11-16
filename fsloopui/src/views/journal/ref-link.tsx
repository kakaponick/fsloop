// A journal entry's ref (surfaces/reading.md → BLOCKS «Журнал»; the design check: the ref link is the app's
// `ObjectLink` — this file only maps the journal's ref kinds onto it). A finding opens in «Находки», a unit in
// «Юниты», a launch or a judge in «Отчёты», another entry here; a pass or a free text is plain; an id the run
// does not hold reads «не найден»; «—» is no ref at all.
import type { JournalRef, Run } from "../../../shared/model.ts";
import { NotFound } from "@/ui";
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

/** The «не найден» word for an id-shaped text the run does not hold: a unit «u7», a finding «…#…», else a launch. */
const guessKind = (id: string) => (/^[uf]\d+$/.test(id) ? "unit" : id.includes("#") ? "finding" : "launch");

export function RefLink({ run, refItem }: { run: RunLike; refItem: JournalRef }) {
  if (!isRef(refItem)) return null;
  const target = refObject(refItem);
  if (target)
    return (
      <ObjectLink run={run} kind={target.kind} id={target.id}>
        <span className="font-mono text-xs">{refItem.id}</span>
      </ObjectLink>
    );
  if (!refItem.found) return <NotFound kind={guessKind(refItem.id)} id={refItem.id} />;
  return <span className="font-mono text-xs break-all">{refItem.id}</span>;
}
