// A placeholder of the «Юниты» view: u5 replaces this folder.
import { NOUNS } from "../../../shared/text.ts";
import { ViewPlaceholder } from "../../app/view-placeholder.tsx";
import type { ViewProps } from "../index.ts";

export function UnitsView({ run }: ViewProps) {
  return <ViewPlaceholder run={run} noun={NOUNS.unit} n={run.units.length} step="decompose" />;
}
