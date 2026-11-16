// The views of a run (rules/ui → Layout 4): one tab strip with a count on each, the chosen view in the URL
// (`?view=`). This registry is the shell's (u3); each view's folder is its own unit's — Находки u4, Юниты u5,
// Отчёты, Соглашения and Журнал u6 — and replaces its placeholder there, never here.
import type { ComponentType } from "react";
import type { Run, ServedRun } from "../../shared/model.ts";
import { ConventionsView } from "./conventions/index.tsx";
import { FindingsView } from "./findings/index.tsx";
import type { ViewId } from "./ids.ts";
import { JournalView } from "./journal/index.tsx";
import { ReportsView } from "./reports/index.tsx";
import { UnitsView } from "./units/index.tsx";

export { DEFAULT_VIEW, VIEW_IDS, type ViewId } from "./ids.ts";

/** A run as the server serves it: the model, its key, project and version. */
export type LoadedRun = ServedRun;

export interface ViewProps {
  run: LoadedRun;
}

export interface ViewDef {
  id: ViewId;
  /** The tab's word. */
  label: string;
  /** The tab's count: what the view lists. */
  count: (run: Run) => number;
  component: ComponentType<ViewProps>;
}

export const VIEWS: readonly ViewDef[] = [
  { id: "findings", label: "Находки", count: (run) => run.findings.length, component: FindingsView },
  { id: "units", label: "Юниты", count: (run) => run.units.length, component: UnitsView },
  { id: "reports", label: "Отчёты", count: (run) => run.launchCount, component: ReportsView },
  { id: "conventions", label: "Соглашения", count: (run) => run.conventions.length, component: ConventionsView },
  { id: "journal", label: "Журнал", count: (run) => run.journal.length, component: JournalView },
];
