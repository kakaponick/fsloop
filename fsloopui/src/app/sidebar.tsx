// The sidebar (shell → BLOCKS): the product with the lost connection beside it, «Прогоны» with how many go and how
// many are silent, the search over the runs, then the runs as one flat list — the running ones as full cards (as mini
// rows in the narrow band), the long-silent, closed and unrecorded ones in folds of mini rows, their open state kept
// in the browser — and the held-order strip at its end. The list holds its order under live updates, and while the
// connection is lost the groups stay as last read (the shell's clock stops at the data's time).
import { ChevronRightIcon } from "lucide-react";
import { useEffect, useState } from "react";
import type { RunCard } from "../../shared/model.ts";
import { NOUNS } from "../../shared/text.ts";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { pushHistory, SearchBox } from "@/table";
import { livenessOf } from "../../shared/liveness.ts";
import { EmptyState, FlatList, GlossaryTooltip, HeldStrip, Loading, PartFailed, readPref, usePref, writePref } from "../ui/index.ts";
import { arrange, heldView, place, type Group, type PlacedCard, type Placement } from "./held.ts";
import { useLiveStore, useRuns } from "./live.tsx";
import { LostConnection, useShellClock } from "./lost-connection.tsx";
import { MiniRow, RunCardItem, type RunItemProps } from "./run-card.tsx";
import { foldTitle, NOTHING_RUNS, PRODUCT, runMatches, runningCount, RUNS_GLOSSARY, SEARCH_PLACEHOLDER } from "./words.ts";

const RUN_NOUN = { forms: NOUNS.run, gender: "m" } as const;
/** The updatedAt of each run when the operator last had it open: a later one reads «новое». */
const SEEN = "runs:seen";
/** The sidebar search's committed terms. */
const HISTORY = "runs:search-history";

const FOLDS: { group: Exclude<Group, "running">; label: string; open: boolean }[] = [
  { group: "silent", label: "Не закрыты и давно молчат", open: true },
  { group: "closed", label: "Закрытые", open: false },
  { group: "unrecorded", label: "Без записи о прогоне", open: false },
];

/** The list's region. In the narrow band it is four whole 32 px rows high — a mini row and a fold's header are both
 * one — so the band never slices a row in two (cand-10), and it has that height from the first paint, so the list
 * lands in it without moving the page (Strict 1); above the breakpoint it takes what the column leaves. */
const LIST = "min-h-0 flex-1 overflow-y-auto px-2 pb-2 [scrollbar-gutter:stable] max-[979px]:h-32";

/** How many of the running group go and how many are silent: «молчит» is not «идёт» (rules/ui → Conventions 4). */
function runningCounts(cards: readonly RunCard[], now: number): { going: number; silent: number } {
  const byKey = new Map(cards.map((c) => [c.key, c]));
  let silent = 0;
  const keys = arrange(cards, now).running;
  for (const key of keys) if (livenessOf(byKey.get(key)?.lastWriteAt, now).state === "silent") silent++;
  return { going: keys.length - silent, silent };
}

/** `band`: below the shell's breakpoint the sidebar is a band above the page — its list capped low, every run a mini
 * row. */
export function Sidebar({ openKey, band = false }: { openKey: string | null; band?: boolean }) {
  const list = useRuns();
  const store = useLiveStore();
  const { now, lost } = useShellClock();
  const counts = list.status === "ready" ? runningCounts(list.cards, now) : { going: 0, silent: 0 };
  // The search is the operator's own narrowing for this visit: kept while the page lives, its terms in the history.
  const [query, setQuery] = useState("");
  const [history, setHistory] = usePref<string[]>(HISTORY, []);
  return (
    <aside aria-label="Прогоны" data-slot="sidebar" className="@container/sidebar flex min-h-0 min-w-0 flex-col border-b min-[980px]:border-r min-[980px]:border-b-0">
      <div data-slot="sidebar-head" className="flex shrink-0 flex-col gap-1 px-4 pt-3 pb-2">
        {/* The product's row holds the lost connection: shell level, in every frame, in a row that is always there. */}
        <div className="flex h-lh min-w-0 items-center justify-between gap-3 text-base">
          <p className="shrink-0 font-semibold">{PRODUCT}</p>
          <LostConnection />
        </div>
        <div className="flex h-lh items-baseline justify-between gap-2 text-xs">
          {/* The list's header carries the glossary of what its cards say: no term inside a card, a link as a whole. */}
          <p className="text-muted-foreground">
            <GlossaryTooltip term="Прогоны" entries={RUNS_GLOSSARY} />
          </p>
          {counts.going + counts.silent > 0 && (
            <span data-slot="running-count" className="truncate text-muted-foreground tabular-nums">
              {runningCount(counts.going, counts.silent)}
            </span>
          )}
        </div>
        {/* p1-review cand-3 · the search's line stands from the first paint, before the list arrives. `/` stays the
            view's own search (rules/ui → Conventions 11). */}
        <SearchBox value={query} onChange={setQuery} placeholder={SEARCH_PLACEHOLDER} history={history} onCommit={(term) => setHistory(pushHistory(history, term))} shortcut={false} className="mt-1" />
      </div>
      {list.status === "ready" ? (
        <RunList cards={list.cards} now={now} lost={lost} openKey={openKey} band={band} query={query} onReset={() => setQuery("")} />
      ) : (
        <>
          <div data-slot="sidebar-list" className={LIST}>
            {list.status === "loading" ? <Loading /> : <PartFailed className="mx-2" what="Список прогонов" cause={list.cause} onRetry={store.retryList} />}
          </div>
          <HeldStrip counts={{ fresh: 0, moved: 0, left: 0 }} noun={RUN_NOUN} leftKind="gone" onApply={() => {}} />
        </>
      )}
    </aside>
  );
}

interface RunListProps {
  cards: RunCard[];
  now: number;
  lost: boolean;
  openKey: string | null;
  band: boolean;
  query: string;
  onReset: () => void;
}

function RunList({ cards, now, lost, openKey, band, query, onReset }: RunListProps) {
  const [placement, setPlacement] = useState<Placement>(() => place(cards, now));
  const [seen] = usePref<Record<string, string>>(SEEN, {});
  const { groups: held, counts } = heldView(placement, cards, now);
  const openCard = openKey ? cards.find((c) => c.key === openKey) : undefined;
  const openUpdated = openCard?.updatedAt ?? null;

  // The open run is seen as it is now.
  useEffect(() => {
    if (!openKey || !openUpdated) return;
    const all = readPref<Record<string, string>>(SEEN, {});
    if (all[openKey] !== openUpdated) writePref(SEEN, { ...all, [openKey]: openUpdated });
  }, [openKey, openUpdated]);

  const searching = query.trim() !== "";
  const groups = Object.fromEntries(Object.entries(held).map(([g, items]) => [g, items.filter((p) => runMatches(p.card, query))])) as Record<Group, PlacedCard[]>;
  const none = searching && Object.values(groups).every((items) => items.length === 0);

  const arrived = new Set(placement.arrived);
  const propsOf = ({ key, card, gone }: PlacedCard): RunItemProps => ({
    card,
    now,
    lost,
    gone,
    current: key === openKey,
    fresh: key !== openKey && (arrived.has(key) || (seen[key] !== undefined && card.updatedAt !== null && card.updatedAt > seen[key])),
  });

  return (
    <>
      <div data-slot="sidebar-list" className={LIST}>
        {none ? (
          <EmptyState form="filtered" noun={NOUNS.run} filters={[`поиск «${query.trim()}»`]} onReset={onReset} className="py-6" />
        ) : (
          <FlatList label="Прогоны" className={band ? "gap-0" : "gap-2"}>
            {groups.running.length
              ? groups.running.map((p) => (band ? <MiniRow key={p.key} {...propsOf(p)} /> : <RunCardItem key={p.key} {...propsOf(p)} />))
              : // Searching, an empty running group says nothing: «ни один не идёт» would be false.
                !searching && <p className="px-2 py-3 text-muted-foreground">{NOTHING_RUNS}</p>}
            {FOLDS.map((fold) =>
              groups[fold.group].length ? <Fold key={fold.group} group={fold.group} label={fold.label} open={fold.open} items={groups[fold.group]} propsOf={propsOf} /> : null,
            )}
          </FlatList>
        )}
      </div>
      {/* The sidebar has no filter: a run whose folder is gone reads «пропал» (craft-23). */}
      <HeldStrip counts={counts} noun={RUN_NOUN} leftKind="gone" onApply={() => setPlacement(place(cards, now, placement))} />
    </>
  );
}

/** A fold: its header one 32 px row, the hairline above it inside that row, so the band's rows stay whole. */
function Fold({ group, label, open: initial, items, propsOf }: { group: Group; label: string; open: boolean; items: PlacedCard[]; propsOf: (p: PlacedCard) => RunItemProps }) {
  const [open, setOpen] = usePref(`fold:sidebar-${group}`, initial);
  return (
    <Collapsible open={open} onOpenChange={setOpen} data-slot="sidebar-fold">
      <CollapsibleTrigger className="group/fold flex h-8 w-full items-center gap-1.5 border-t px-2 text-left text-xs text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset">
        <ChevronRightIcon aria-hidden="true" className="size-3.5 shrink-0 transition-transform group-data-[state=open]/fold:rotate-90 motion-reduce:transition-none" />
        <span className="tabular-nums">{foldTitle(label, items.length)}</span>
      </CollapsibleTrigger>
      <CollapsibleContent className="flex flex-col">
        {items.map((p) => (
          <MiniRow key={p.key} {...propsOf(p)} />
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}
