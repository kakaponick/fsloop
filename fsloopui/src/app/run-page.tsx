// The run page's frame (rules/ui → Layout 3, Conventions 13): one frame for every view — the identity, the goal
// and the fact list in `ux 9` order, the tab strip with counts (sticky where the page scrolls as one), then the view.
// The lost connection is the shell's, in the sidebar's head, so it stands in this frame's every state. The header
// draws from the card the list already holds, so it stands before the run is read; the view's region is at its final
// size from the first paint and holds «Загрузка…» until then. Not found and a read error are the frame's own states.
// The frame draws no status bar: each view renders the table kit's, from `useDataAge`.
import { useLayoutEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import type { RunCard } from "../../shared/model.ts";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Clamp, CountTabs, FactList, Loading, NotRecorded, PartFailed, RunningText, usePref } from "../ui/index.ts";
import { VIEWS, type LoadedRun, type ViewId } from "../views/index.ts";
import { runFacts } from "./facts.tsx";
import { resolverFor, routerLink } from "./links.tsx";
import { useLiveStore, useRun, useRuns } from "./live.tsx";
import { useShellClock } from "./lost-connection.tsx";
import { runPath, splitKey, viewOf } from "./routes.ts";
import { useRunTitle } from "./title.ts";
import { goalLines, RUN_NOT_FOUND_NEXT, runNotFoundText, stageWord } from "./words.ts";

/** The run page's «Подробнее»: one open state for every run (FactList keeps it under `fold:<key>`). */
const FACTS_FOLD = "run";

export function RunPage({ runKey }: { runKey: string }) {
  const list = useRuns();
  const state = useRun(runKey);
  const store = useLiveStore();
  const { now, lost } = useShellClock();
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
      {card ? <RunHeader card={card} run={run} now={now} lost={lost} /> : <Identity project={project} id={id} />}
      <ViewTabs run={run} view={view} onView={openView} />
      {/* The view takes what the header leaves (`1 1 0%`), or — where the shell scrolls the page as one — the page's
          height under the tab strip (`--view-flex`, set by the shell below its breakpoint). */}
      <section
        aria-label="Раздел прогона"
        data-slot="view-body"
        className="@container/view relative min-h-0 overflow-y-auto [flex:var(--view-flex,1_1_0%)] [scrollbar-gutter:stable]"
      >
        {/* improve-5 (3) · the outline: h1 the run, this h2 the view — read by a screen reader, drawn by the tab strip
            above — then the view's own headings, so no level is skipped on any view. */}
        <h2 className="sr-only">{viewLabel(view)}</h2>
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

const viewOfId = (view: ViewId) => VIEWS.find((v) => v.id === view) ?? VIEWS[0];
const viewLabel = (view: ViewId) => viewOfId(view).label;

function View({ view, run }: { view: ViewId; run: LoadedRun }) {
  const Component = viewOfId(view).component;
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

/** The page header: identity, the goal and the outcome-first fact list. Its rows are what the operator decides by —
 * the outcome and what waits on him — and the settings and the counts fold behind «Подробнее», so the view keeps the
 * page (`ux 9`: state, next action and product in the first viewport; improve-15). From 64 rem the goal and the facts
 * stand side by side: the facts' column is sized content-out to the widest real value — a «Ждёт вас» cause on one line
 * beside the widest label (`--facts-w`, 40 rem) — and the goal takes the rest, within its reading measure. */
function RunHeader({ card, run, now, lost }: { card: RunCard; run: LoadedRun | null; now: number; lost: boolean }) {
  const { facts, more } = runFacts(card, now, { run, lost });
  const ref = useHeldOnClose(card.closed === true);
  return (
    <header ref={ref} data-slot="run-header" className="@container/header shrink-0 border-b px-5 pt-4 pb-4 [--facts-w:40rem]">
      <Title project={card.project} id={card.id} />
      <div className="mt-3 grid items-start gap-x-10 gap-y-3 @min-[64rem]/header:grid-cols-[minmax(0,1fr)_minmax(0,var(--facts-w))]">
        <Goal goal={run ? run.goal : card.goal} run={run} />
        <FactList facts={facts} more={more} foldKey={FACTS_FOLD} label="Прогон" />
      </div>
    </header>
  );
}

/** A run that closes while its page is open trades «Активность» and «Ждёт вас» for «Итог»: the header keeps the
 * height it had while running, so the tab strip and the view stay where the operator reads (rules/ui → Strict 1;
 * cand-3). The operator's own «Подробнее» or a new width lets it go; a run opened closed holds nothing. */
function useHeldOnClose(closed: boolean) {
  const ref = useRef<HTMLElement>(null);
  const running = useRef<number | null>(null);
  const [fold] = usePref(`fold:${FACTS_FOLD}`, false);
  const foldSeen = useRef(fold);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (fold !== foldSeen.current) {
      foldSeen.current = fold;
      running.current = null;
    }
    if (!closed) {
      el.style.minHeight = "";
      running.current = el.offsetHeight;
    } else el.style.minHeight = running.current === null ? "" : `${running.current}px`;
  });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    let width = el.clientWidth;
    const observer = new ResizeObserver(() => {
      if (el.clientWidth === width) return;
      width = el.clientWidth;
      running.current = null;
      el.style.minHeight = "";
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return ref;
}

/** The goal clamped to two lines, each of its own lines kept — from the card's first lines before the run is read,
 * the same lines after; «развернуть» once the whole goal is here and the clamp hides some of it; expanded, the goal
 * is running text with its line breaks and lists, in a capped region that scrolls inside. */
function Goal({ goal, run }: { goal: string | null; run: LoadedRun | null }) {
  if (!goal) return <NotRecorded cause="цели нет в common.md" />;
  return (
    <Clamp what="цель прогона" expandable={run !== null} className="max-w-measure text-muted-foreground">
      {/* The clamp shows the lines, its open region the running text: one class each, read off the clamp's state. */}
      <span data-slot="goal-line" className="whitespace-pre-line in-[[data-slot=clamp][data-state=open]]:hidden">
        {goalLines(goal)}
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
  // Sticky: where the shell scrolls the page as one, the strip stays at the top once the header has scrolled away —
  // the tabs' own sticky form, 40 px high (the shell's page height under it counts on it).
  return <CountTabs sticky value={view} onValueChange={onView} tabs={tabs} label="Разделы прогона" className="px-5" />;
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
