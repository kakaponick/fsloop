// A placeholder of the «Журнал» view: u6 replaces this folder.
import { NOUNS } from "../../../shared/text.ts";
import { ViewPlaceholder } from "../../app/view-placeholder.tsx";
import type { ViewProps } from "../index.ts";

export function JournalView({ run }: ViewProps) {
  return <ViewPlaceholder run={run} noun={NOUNS.entry} n={run.journal.length} step="map" lead="Прогон ещё не записал решений" subject="записи" />;
}
