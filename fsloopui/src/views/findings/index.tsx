// A placeholder of the «Находки» view: u4 replaces this folder.
import { NOUNS } from "../../../shared/text.ts";
import { ViewPlaceholder } from "../../app/view-placeholder.tsx";
import type { ViewProps } from "../index.ts";

export function FindingsView({ run }: ViewProps) {
  return <ViewPlaceholder run={run} noun={NOUNS.finding} n={run.findings.length} step="map" lead="Критики ещё не писали отчётов" subject="находки" />;
}
