// Links to the objects of a run (rules/ui → Layout 2, Conventions 5, 12): an id → its address → a link, or the
// «не найден» part when the run names an id its folder does not hold. Views (u4–u6) take these from here, and the
// running-text renderer takes `resolverFor(run)`, so an id in a critic's text links the same way.
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import type { Run } from "../../shared/model.ts";
import { NotFound, type Resolve } from "../ui/index.ts";
import { cn } from "@/lib/utils";
import { runPath } from "./routes.ts";

export type ObjectKind = "finding" | "unit" | "report" | "entry";

export interface ObjectRef {
  kind: ObjectKind;
  id: string;
  /** A report's tab. */
  tab?: string;
}

type RunLike = Pick<Run, "findings" | "units" | "launches" | "journal"> & { key: string };

/** The address of an object of the run, or null when the run does not hold it. */
export function objectHref(run: RunLike, { kind, id, tab }: ObjectRef): string | null {
  switch (kind) {
    case "finding":
      return run.findings.some((f) => f.id === id) ? runPath(run.key, { view: "findings", finding: id }) : null;
    case "unit":
      return run.units.some((u) => u.id === id) ? runPath(run.key, { view: "units", unit: id }) : null;
    case "report":
      return run.launches.some((l) => l.id === id) ? runPath(run.key, { view: "reports", report: id, tab }) : null;
    case "entry":
      return run.journal.some((j) => j.n === id) ? runPath(run.key, { view: "journal", entry: id }) : null;
  }
}

export const LINK_CLASS = "underline decoration-foreground/30 underline-offset-2 hover:decoration-foreground";

/** A link to an object of the run; its id in mono unless children say otherwise; «<объект> <id> не найден» when the run lacks it. */
export function ObjectLink({ run, kind, id, tab, children, className }: { run: RunLike; children?: ReactNode; className?: string } & ObjectRef) {
  const href = objectHref(run, { kind, id, tab });
  if (!href) return <NotFound kind={kind} id={id} className={className} />;
  return (
    <Link to={href} className={cn(LINK_CLASS, className)}>
      {children ?? <span className="font-mono text-xs">{id}</span>}
    </Link>
  );
}

const UNIT_ID = /^[uf]\d+$/;
const ENTRY_ID = /^j(\d+)$/;

/** The ids a running text of this run may name — a finding, a unit, a launch's report, a journal entry «j12» —
 * resolved to their addresses; any other token stays text. */
export function resolverFor(run: RunLike): Resolve {
  const findings = new Set(run.findings.map((f) => f.id));
  const reports = new Set(run.launches.map((l) => l.id));
  return (token) => {
    if (findings.has(token)) return objectHref(run, { kind: "finding", id: token });
    if (UNIT_ID.test(token)) return objectHref(run, { kind: "unit", id: token });
    if (reports.has(token)) return objectHref(run, { kind: "report", id: token });
    const entry = ENTRY_ID.exec(token);
    if (entry) return objectHref(run, { kind: "entry", id: entry[1] });
    return null;
  };
}

/** The router's link for the running-text renderer's `renderLink`. */
export const routerLink = (href: string, children: ReactNode) => (
  <Link to={href} className={LINK_CLASS}>
    {children}
  </Link>
);
