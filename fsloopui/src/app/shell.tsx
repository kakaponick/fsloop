// The shell (rules/ui → Layout 1; shell → CHOSEN B): two regions — the sidebar of runs at a fixed 316 px and the
// opened run's page in the rest. The shell's grid owns the only viewport breakpoint, 980 px: below it the sidebar
// is a band above the page with its own capped height. Each region scrolls on its own.
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import type { RunCard } from "../../shared/model.ts";
import { Loading, PartFailed } from "../ui/index.ts";
import { useLiveStore, useRuns } from "./live.tsx";
import { LostConnection } from "./lost-connection.tsx";
import { runKeyOf, runPath } from "./routes.ts";
import { Message, RunPage } from "./run-page.tsx";
import { Sidebar } from "./sidebar.tsx";
import { useRunTitle } from "./title.ts";
import { emptyRootText } from "./words.ts";

export function Shell() {
  const { pathname } = useLocation();
  const openKey = runKeyOf(pathname);
  return (
    <div data-slot="shell" className="grid h-dvh grid-rows-[auto_minmax(0,1fr)] min-[980px]:grid-cols-[calc(var(--spacing)*79)_minmax(0,1fr)] min-[980px]:grid-rows-1">
      <Sidebar openKey={openKey} />
      <main className="@container/page flex min-h-0 min-w-0 flex-col">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/r/*" element={openKey ? <RunPage key={openKey} runKey={openKey} /> : <Navigate replace to="/" />} />
          <Route path="*" element={<Navigate replace to="/" />} />
        </Routes>
      </main>
    </div>
  );
}

const time = (iso: string | null) => (iso ? Date.parse(iso) || 0 : 0);

/** Where `/` leads: the open run written to last, else the run updated last; null when the root holds none. */
export function defaultRun(cards: readonly RunCard[]): RunCard | null {
  const open = cards.filter((c) => c.recorded && c.closed === false);
  const pool = open.length ? open : cards;
  const at = (c: RunCard) => (open.length ? time(c.lastWriteAt) : Math.max(time(c.updatedAt), time(c.lastWriteAt)));
  return [...pool].sort((a, b) => at(b) - at(a) || time(b.startedAt) - time(a.startedAt) || a.key.localeCompare(b.key))[0] ?? null;
}

/** `/`: replaced by the most recently active run (shell → WALK 1), or the empty root's text. */
function Home() {
  const list = useRuns();
  const store = useLiveStore();
  useRunTitle(null, null);
  if (list.status === "loading") return <Loading className="flex-1" />;
  if (list.status === "error")
    return (
      <div className="px-5 py-4">
        <PartFailed what="Список прогонов" cause={list.cause} onRetry={store.retryList} />
      </div>
    );
  const target = defaultRun(list.cards);
  if (target) return <Navigate replace to={runPath(target.key)} />;
  return (
    <>
      <div className="flex h-10 shrink-0 items-center justify-end px-5">
        <LostConnection />
      </div>
      <Message>{emptyRootText(list.roots)}</Message>
    </>
  );
}
