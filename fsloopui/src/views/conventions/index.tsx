// A placeholder of the «Соглашения» view: u6 replaces this folder.
import { NOUNS } from "../../../shared/text.ts";
import { ViewPlaceholder } from "../../app/view-placeholder.tsx";
import type { ViewProps } from "../index.ts";

export function ConventionsView({ run }: ViewProps) {
  return <ViewPlaceholder run={run} noun={NOUNS.convention} n={run.conventions.length} step="decompose" />;
}
