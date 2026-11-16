// The sidebar (shell → BLOCKS): the product, «Прогоны» with how many go, then the runs as one flat list — the
// running ones as full cards, the long-silent, closed and unrecorded ones in folds of mini rows, their open state
// kept in the browser — and the held-order strip at its end. The list holds its order under live updates.
import { ChevronRightIcon } from "lucide-react";
import { useEffect, useState } from "react";
import type { RunCard } from "../../shared/model.ts";
import { NOUNS } from "../../shared/text.ts";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { FlatList, HeldStrip, Loading, PartFailed, readPref, usePref, writePref } from "../ui/index.ts";
import { useNow } from "./clock.tsx";
import { arrange, heldView, place, type Group, type PlacedCard, type Placement } from "./held.ts";
import { useLiveStore, useRuns } from "./live.tsx";
import { MiniRow, RunCardItem, type RunItemProps } from "./run-card.tsx";
import { foldTitle, NOTHING_RUNS, PRODUCT, runningCount } from "./words.ts";

const RUN_NOUN = { forms: NOUNS.run, gender: "m" } as const;
/** The updatedAt of each run when the operator last had it open: a later one reads «новое». */
const SEEN = "runs:seen";

const FOLDS: { group: Exclude<Group, "running">; label: string; open: boolean }[] = [
  { group: "silent", label: "Не закрыты и давно молчат", open: true },
  { group: "closed", label: "Закрытые", open: false },
  { group: "unrecorded", label: "Без записи о прогоне", open: false },
];

export function Sidebar({ openKey }: { openKey: string | null }) {
  const list = useRuns();
  const store = useLiveStore();
  const now = useNow();
  const running = list.status === "ready" ? arrange(list.cards, now).running.length : 0;
  return (
    <aside
      aria-label="Прогоны"
      data-slot="sidebar"
      className="@container/sidebar flex max-h-80 min-h-0 min-w-0 flex-col border-b min-[980px]:max-h-none min-[980px]:border-r min-[980px]:border-b-0"
    >
      <div className="flex shrink-0 flex-col gap-1 px-4 pt-3 pb-2">
        <p className="text-base font-semibold">{PRODUCT}</p>
        <div className="flex h-lh items-baseline justify-between gap-2 text-xs">
          <h2 className="font-normal text-muted-foreground">Прогоны</h2>
          {running > 0 && <span className="whitespace-nowrap text-muted-foreground tabular-nums">{runningCount(running)}</span>}
        </div>
      </div>
      {list.status === "ready" ? (
        <RunList cards={list.cards} now={now} openKey={openKey} />
      ) : (
        <>
          <div data-slot="sidebar-list" className="min-h-0 flex-1 overflow-y-auto px-2 pb-2 [scrollbar-gutter:stable]">
            {list.status === "loading" ? <Loading /> : <PartFailed className="mx-2" what="Список прогонов" cause={list.cause} onRetry={store.retryList} />}
          </div>
          <HeldStrip counts={{ fresh: 0, moved: 0, left: 0 }} noun={RUN_NOUN} onApply={() => {}} />
        </>
      )}
    </aside>
  );
}

function RunList({ cards, now, openKey }: { cards: RunCard[]; now: number; openKey: string | null }) {
  const [placement, setPlacement] = useState<Placement>(() => place(cards, now));
  const [seen] = usePref<Record<string, string>>(SEEN, {});
  const { groups, counts } = heldView(placement, cards, now);
  const openCard = openKey ? cards.find((c) => c.key === openKey) : undefined;
  const openUpdated = openCard?.updatedAt ?? null;

  // The open run is seen as it is now.
  useEffect(() => {
    if (!openKey || !openUpdated) return;
    const all = readPref<Record<string, string>>(SEEN, {});
    if (all[openKey] !== openUpdated) writePref(SEEN, { ...all, [openKey]: openUpdated });
  }, [openKey, openUpdated]);

  const arrived = new Set(placement.arrived);
  const propsOf = ({ key, card, gone }: PlacedCard): RunItemProps => ({
    card,
    now,
    gone,
    current: key === openKey,
    fresh: key !== openKey && (arrived.has(key) || (seen[key] !== undefined && card.updatedAt !== null && card.updatedAt > seen[key])),
  });

  return (
    <>
      <div data-slot="sidebar-list" className="min-h-0 flex-1 overflow-y-auto px-2 pb-2 [scrollbar-gutter:stable]">
        <FlatList label="Прогоны" className="gap-2">
          {groups.running.length ? (
            groups.running.map((p) => <RunCardItem key={p.key} {...propsOf(p)} />)
          ) : (
            <p className="px-2 py-3 text-muted-foreground">{NOTHING_RUNS}</p>
          )}
          {FOLDS.map((fold) =>
            groups[fold.group].length ? <Fold key={fold.group} group={fold.group} label={fold.label} open={fold.open} items={groups[fold.group]} propsOf={propsOf} /> : null,
          )}
        </FlatList>
      </div>
      <HeldStrip counts={counts} noun={RUN_NOUN} onApply={() => setPlacement(place(cards, now, placement))} />
    </>
  );
}

function Fold({ group, label, open: initial, items, propsOf }: { group: Group; label: string; open: boolean; items: PlacedCard[]; propsOf: (p: PlacedCard) => RunItemProps }) {
  const [open, setOpen] = usePref(`fold:sidebar-${group}`, initial);
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="border-t pt-1">
      <CollapsibleTrigger className="group/fold flex h-8 w-full items-center gap-1.5 rounded-md px-2 text-left text-xs text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50">
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
