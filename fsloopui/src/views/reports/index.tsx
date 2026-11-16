// A placeholder of the «Отчёты» view: u6 replaces this folder.
import { NOUNS } from "../../../shared/text.ts";
import { ViewPlaceholder } from "../../app/view-placeholder.tsx";
import type { ViewProps } from "../index.ts";

export function ReportsView({ run }: ViewProps) {
  return <ViewPlaceholder run={run} noun={NOUNS.report} n={run.launches.length} step="map" lead="Агенты ещё не писали отчётов" subject="отчёты" />;
}
