// The run page's frame (rules/ui → Layout 3, Conventions 13): one frame for every view — the identity, the goal
// and the fact list in `ux 9` order, the tab strip with counts, then the view. The header draws from the card the
// list already holds, so it stands before the run is read; the view's region is at its final size from the first
// paint and holds «Загрузка…» until then. Not found and a read error are the frame's own states. The frame draws
// no status bar: each view renders the table kit's, from `useDataAge`.
import { useLocation, useNavigate } from "react-router-dom";
import type { RunCard } from "../../shared/model.ts";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Clamp, CountTabs, FactList, Loading, NotRecorded, PartFailed, RunningText } from "../ui/index.ts";
import { VIEWS, type LoadedRun, type ViewId } from "../views/index.ts";
import { useNow } from "./clock.tsx";
import { runFacts } from "./facts.tsx";
import { resolverFor, routerLink } from "./links.tsx";
import { useLiveStore, useRun, useRuns } from "./live.tsx";
import { LostConnection } from "./lost-connection.tsx";
import { runPath, splitKey, viewOf } from "./routes.ts";
import { useRunTitle } from "./title.ts";
import { RUN_NOT_FOUND_NEXT, runNotFoundText, stageWord } from "./words.ts";

export function RunPage({ runKey }: { runKey: string }) {
  const list = useRuns();
  const state = useRun(runKey);
  const store = useLiveStore();
  const now = useNow();
  const location = useLocation();
  const navigate = useNavigate();
  const card = list.status === "ready" ? (list.cards.find((c) => c.key === runKey) ?? null) : null;
  const run = state.status === "ready" ? state.run : null;
  const { project, id } = card ?? run ?? splitKey(runKey);
  const view = viewOf(location.search);

  useRunTitle(card ? { project, id, stage: stageWord(card) } : null, run?.version ?? null);

  if (state.status === "not-found")
    return (
      <>
        <Identity project={project} id={id} />
        <Message next={RUN_NOT_FOUND_NEXT}>{runNotFoundText(id, list.status === "ready" ? list.roots : [])}</Message>
      </>
    );

  // Before the list holds the run's card there is nothing to draw the frame from: the page's whole region loads.
  // A list that failed leaves the identity alone above the run.
  if (!card && list.status !== "error" && state.status !== "error") return <Loading className="flex-1" />;

  const openView = (next: string) => navigate(runPath(runKey, { view: next === "findings" ? undefined : next }));

  return (
    <>
      {card ? <RunHeader card={card} run={run} now={now} /> : <Identity project={project} id={id} />}
      <ViewTabs run={run} view={view} onView={openView} />
      <section aria-label="Раздел прогона" data-slot="view-body" className="@container/view relative min-h-0 flex-1 overflow-y-auto [scrollbar-gutter:stable]">
        {state.status === "error" ? (
          <div className="px-5 py-4">
            <PartFailed what={`Прогон ${id}`} cause={state.cause} onRetry={() => store.retryRun(runKey)} />
          </div>
        ) : run ? (
          <View view={view} run={run} />
        ) : (
          <div className="size-full px-5 py-4">
            <Loading framed />
          </div>
        )}
      </section>
    </>
  );
}

function View({ view, run }: { view: ViewId; run: LoadedRun }) {
  const Component = (VIEWS.find((v) => v.id === view) ?? VIEWS[0]).component;
  return <Component run={run} />;
}

/** The page header's role: identity only — «project · id» (shell → BLOCKS). */
function Identity({ project, id }: { project: string; id: string }) {
  return (
    <div data-slot="run-header" className="shrink-0 border-b px-5 py-4">
      <Title project={project} id={id} />
    </div>
  );
}

function Title({ project, id }: { project: string; id: string }) {
  return (
    <h1 className="flex min-w-0 items-baseline gap-2 text-lg font-semibold">
      <span className="min-w-0 truncate">{project}</span>
      <span aria-hidden="true" className="font-normal text-muted-foreground">
        ·
      </span>
      <span className="shrink-0 font-mono text-base font-normal">{id}</span>
    </h1>
  );
}

function RunHeader({ card, run, now }: { card: RunCard; run: LoadedRun | null; now: number }) {
  const { facts, more } = runFacts(card, now);
  return (
    <header data-slot="run-header" className="@container/header max-h-[50dvh] shrink-0 overflow-y-auto border-b px-5 pt-4 pb-4 [scrollbar-gutter:stable]">
      <Title project={card.project} id={card.id} />
      <div className="mt-3 grid items-start gap-x-10 gap-y-4 @min-[60rem]/header:grid-cols-[minmax(0,var(--container-measure))_minmax(0,1fr)]">
        <Goal goal={run ? run.goal : card.goal} run={run} />
        <FactList facts={facts} more={more} foldKey="run" label="Прогон" />
      </div>
    </header>
  );
}

/** The goal clamped to two lines, newlines collapsed — from the card's first lines before the run is read, the
 * same two lines after; «развернуть» once the whole goal is here and the clamp hides some of it; expanded, the
 * goal is running text with its line breaks and lists, in a capped region that scrolls inside. */
function Goal({ goal, run }: { goal: string | null; run: LoadedRun | null }) {
  if (!goal) return <NotRecorded cause="цели нет в common.md" />;
  return (
    <Clamp what="цель прогона" expandable={run !== null} className="max-w-measure text-muted-foreground">
      {/* The clamp shows the line, its open region the running text: one class each, read off the clamp's state. */}
      <span data-slot="goal-line" className="in-[[data-slot=clamp][data-state=open]]:hidden">
        {goal.replace(/\s+/g, " ").trim()}
      </span>
      {run && (
        <div data-slot="goal-text" className="hidden text-foreground in-[[data-slot=clamp][data-state=open]]:block">
          <RunningText text={goal} measure={false} resolve={resolverFor(run)} renderLink={routerLink} />
        </div>
      )}
    </Clamp>
  );
}

function ViewTabs({ run, view, onView }: { run: LoadedRun | null; view: ViewId; onView: (view: string) => void }) {
  const tabs = VIEWS.map((v) => ({ value: v.id, label: v.label, count: run ? v.count(run) : null }));
  return (
    <div data-slot="view-tabs" className="@container/tabs flex h-10 shrink-0 items-end gap-4 border-b px-5">
      <CountTabs value={view} onValueChange={onView} tabs={tabs} label="Разделы прогона" className="shrink-0" />
      <LostConnection className="mb-2.5 ml-auto" />
    </div>
  );
}

/** A frame's message in the page's place: what happened, then what is left to do. */
function Message({ children, next }: { children: string; next?: string }) {
  return (
    <Empty className="flex-1 border-0">
      <EmptyHeader className="max-w-measure">
        <EmptyTitle className="font-normal text-muted-foreground">{children}</EmptyTitle>
        {next && <EmptyDescription className="text-sm">{next}</EmptyDescription>}
      </EmptyHeader>
    </Empty>
  );
}

export { Message };
