// The empty state (ui → Empty states; rules/ui → Conventions 15), one component in three forms (the design check's
// convention): not yet — what fills the view and at which stage, the stage word from the shared map, never a
// literal; never — the run is past that stage or closed; filtered to none — the active filters and «Сбросить
// фильтры». An empty state is never a false one: a failed load is the part-failed message, not this.
import { STAGE_WORDS, stageOf, STEPS, type Step } from "../../shared/states.ts";
import type { Forms } from "../../shared/text.ts";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { cn } from "@/lib/utils";

export type EmptyStateProps = (
  | {
      form: "not-yet";
      /** The noun of what the view lists; its genitive plural opens the sentence: «Юнитов ещё нет». */
      noun: Forms;
      /** The stage that fills the view. */
      step: Step;
      /** A lead of the view's own, replacing «<Чего> ещё нет»: «Критики ещё не писали отчётов». */
      lead?: string;
      /** Who appears, when it is not «они»: «находки». */
      subject?: string;
    }
  | { form: "never"; noun: Forms; description?: string }
  | { form: "filtered"; noun: Forms; filters: readonly string[]; onReset: () => void }
) & { className?: string };

const capital = (s: string) => s[0].toUpperCase() + s.slice(1);

/** The words of each form; the component and the tests read the same function. */
export function emptyStateText(props: EmptyStateProps): { title: string; description?: string } {
  switch (props.form) {
    case "not-yet":
      return { title: `${props.lead ?? `${capital(props.noun[2])} ещё нет`} — ${props.subject ?? "они"} появятся на этапе «${STAGE_WORDS[props.step]}»` };
    case "never":
      return { title: `В этом прогоне не было ${props.noun[2]}`, description: props.description };
    case "filtered":
      return { title: `Нет ${props.noun[2]}, подходящих под фильтры`, description: props.filters.length ? `Фильтры: ${props.filters.join(" · ")}` : undefined };
  }
}

export const RESET_FILTERS = "Сбросить фильтры";

/** The stage order is shared/states.ts's (code-verdict cand-2); re-exported for the kit's index until its owner moves it. */
export { STEPS };

/** Why a list is empty before any filter: not yet (the stage that fills it, with a view's own lead) or never. */
export type EmptyWhen = { form: "not-yet"; step: Step; lead?: string; subject?: string } | { form: "never"; description?: string };

/** The one rule of an empty view (Conventions 15): a closed run or an init run never had it; otherwise it is still
 * to come, at the stage that fills it. A list its stage fills once a pass (`once`: the design check's conventions)
 * never comes either when the run is already past that stage. */
export function emptyWhen(run: { closed: boolean | null; mode: string | null; now?: { stage?: string | null } | null }, step: Step, { once = false } = {}): EmptyWhen {
  if (run.closed || run.mode === "init") return { form: "never" };
  const at = stageOf(run.now?.stage).step;
  return once && at !== null && STEPS.indexOf(at) > STEPS.indexOf(step) ? { form: "never" } : { form: "not-yet", step };
}

export function EmptyState(props: EmptyStateProps) {
  const { title, description } = emptyStateText(props);
  return (
    <Empty data-slot="empty-state" data-form={props.form} className={cn("border-0", props.className)}>
      <EmptyHeader className="max-w-measure">
        <EmptyTitle className="font-normal text-muted-foreground">{title}</EmptyTitle>
        {description && <EmptyDescription className="text-sm">{description}</EmptyDescription>}
      </EmptyHeader>
      {props.form === "filtered" && (
        <EmptyContent>
          <Button variant="outline" size="sm" onClick={props.onReset}>
            {RESET_FILTERS}
          </Button>
        </EmptyContent>
      )}
    </Empty>
  );
}
