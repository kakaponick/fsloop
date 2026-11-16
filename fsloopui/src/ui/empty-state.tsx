// The empty state (ui → Empty states; rules/ui → Conventions 15), one component in three forms (the design check's
// convention): not yet — what fills the view and at which stage, the stage word from the shared map, never a
// literal; never — the run is past that stage or closed; filtered to none — the active filters and «Сбросить
// фильтры». An empty state is never a false one: a failed load is the part-failed message, not this.
import { STAGE_WORDS, stageOf, STEPS, type Step } from "../../shared/states.ts";
import { capital, count, type Forms } from "../../shared/text.ts";
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
  | {
      form: "filtered";
      noun: Forms;
      filters: readonly string[];
      onReset: () => void;
      /** The way out's words, when it is not «Сбросить фильтры»: «Очистить поиск» where the search alone emptied it. */
      resetLabel?: string;
      /** The named view («Вид») the list is in, when it is one with filters of its own (rules/ui → Conventions 16):
       * its label and what fills it — its states, from its own definition in the view's query — and, when the view
       * holds rows that the search alone hides, the search and how many it hid (craft-6). */
      view?: { label: string; fills: readonly string[]; hid?: { search: string; count: number } };
    }
) & { className?: string };


/** The words of each form; the component and the tests read the same function. */
export function emptyStateText(props: EmptyStateProps): { title: string; description?: string } {
  switch (props.form) {
    case "not-yet":
      return { title: `${props.lead ?? `${capital(props.noun[2])} ещё нет`} — ${props.subject ?? "они"} появятся на этапе «${STAGE_WORDS[props.step]}»` };
    case "never":
      return { title: `В этом прогоне не было ${props.noun[2]}`, description: props.description };
    case "filtered": {
      const filters = props.filters.length ? `Фильтры: ${props.filters.join(" · ")}` : null;
      if (!props.view) return { title: `Нет ${props.noun[2]}, подходящих под фильтры`, description: filters ?? undefined };
      const { label, fills, hid } = props.view;
      const holds = `В вид ${fills.length === 1 ? "входит" : "входят"}: ${fills.join(", ")}`;
      // the view holds rows and the search alone hid them: the search is the cause, named with what it hid (craft-6)
      if (hid) return { title: `Поиск «${hid.search}» скрыл ${count(hid.count, props.noun)} вида «${label}»`, description: holds };
      // a named view that holds none names itself and what fills it, then the search or filters beside it
      return { title: `В виде «${label}» нет ${props.noun[2]}`, description: [holds, filters].filter(Boolean).join(". ") };
    }
  }
}

export const RESET_FILTERS = "Сбросить фильтры";

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
            {props.resetLabel ?? RESET_FILTERS}
          </Button>
        </EmptyContent>
      )}
    </Empty>
  );
}
