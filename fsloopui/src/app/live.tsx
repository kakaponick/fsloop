// The client's data layer (rules/ui → Live data): the run list and the runs a page watches, kept live by the
// server's tick stream. A tick carries versions only; a moved version re-reads its part, in place — what is shown
// stays until the new copy arrives, so nothing returns to a loading state. A dropped stream is a lost connection:
// the data stays with its time; on reconnect the list and every watched run are re-read whole. A running launch's
// last write and the run's tokens come with the run's card: a list read brings them into every run kept (improve-17).
// The store reaches the server through the API module only; the tree under its provider gets the same API.
import { createContext, useContext, useEffect, useSyncExternalStore, type ReactNode } from "react";
import type { RunCard } from "../../shared/model.ts";
import { ApiProvider, createApi, withLive, type Transport, type Versions } from "@/api";
import type { LoadedRun } from "../views/index.ts";

export type ListState = { status: "loading" } | { status: "ready"; cards: RunCard[]; roots: string[] } | { status: "error"; cause: string };
export type RunState = { status: "loading" } | { status: "ready"; run: LoadedRun } | { status: "not-found" } | { status: "error"; cause: string };
export type Connection = "connecting" | "open" | "lost";

export interface LiveSnapshot {
  list: ListState;
  runs: Readonly<Record<string, RunState>>;
  connection: Connection;
  /** When the shown data was last read (the store's clock); null before the first read. */
  updatedAt: number | null;
}

const LOADING = { status: "loading" } as const;
/** Runs kept read after their page closed, so Back shows one at once. */
const KEEP = 4;

const messageOf = (e: unknown) => (e instanceof Error ? e.message : String(e));

export function createLiveStore(transport: Transport, { now = Date.now }: { now?: () => number } = {}) {
  const api = createApi(transport);
  let state: LiveSnapshot = { list: LOADING, runs: {}, connection: "connecting", updatedAt: null };
  const listeners = new Set<() => void>();
  const watchers = new Map<string, number>();
  const recent: string[] = [];
  const known = { list: null as number | null, runs: new Map<string, number>() };
  const wanted = { list: null as number | null, runs: new Map<string, number | null>() };
  const busy = { list: false, runs: new Set<string>() };
  const seq = { list: 0, runs: new Map<string, number>() };
  let lost = false;
  let close: (() => void) | null = null;

  const set = (patch: Partial<LiveSnapshot>) => {
    state = { ...state, ...patch };
    for (const l of listeners) l();
  };
  const setRun = (key: string, run: RunState, patch: Partial<LiveSnapshot> = {}) => set({ ...patch, runs: { ...state.runs, [key]: run } });
  const cardOf = (key: string) => (state.list.status === "ready" ? state.list.cards.find((c) => c.key === key) : undefined);

  async function loadList() {
    const n = ++seq.list;
    busy.list = true;
    try {
      const body = await api.runs();
      if (n !== seq.list) return;
      known.list = body.version;
      // Each run kept takes what its card brings live; a run nothing moved in stays the same object.
      const cards = new Map(body.list.map((c) => [c.key, c]));
      let runs = state.runs;
      for (const [key, r] of Object.entries(state.runs)) {
        if (r.status !== "ready") continue;
        const run = withLive(r.run, cards.get(key));
        if (run !== r.run) runs = { ...runs, [key]: { status: "ready", run } };
      }
      set({ list: { status: "ready", cards: body.list, roots: body.roots }, runs, updatedAt: now() });
    } catch (e) {
      // A failed re-read keeps the list it has; only a first read shows the failure.
      if (n === seq.list && state.list.status !== "ready") set({ list: { status: "error", cause: messageOf(e) } });
    } finally {
      if (n === seq.list) {
        busy.list = false;
        if (wanted.list !== null && wanted.list !== known.list && state.list.status === "ready") void loadList();
      }
    }
  }

  async function loadRun(key: string) {
    const n = (seq.runs.get(key) ?? 0) + 1;
    seq.runs.set(key, n);
    busy.runs.add(key);
    const mine = () => seq.runs.get(key) === n;
    try {
      const run = await api.run(key);
      if (!mine()) return;
      if (!run) {
        known.runs.delete(key);
        setRun(key, { status: "not-found" });
        return;
      }
      known.runs.set(key, run.version);
      setRun(key, { status: "ready", run: withLive(run, cardOf(key)) }, { updatedAt: now() });
    } catch (e) {
      if (mine() && state.runs[key]?.status !== "ready") setRun(key, { status: "error", cause: messageOf(e) });
    } finally {
      if (mine()) {
        busy.runs.delete(key);
        const want = wanted.runs.get(key);
        if (watchers.has(key) && want !== undefined && want !== known.runs.get(key) && state.runs[key]?.status === "ready") void loadRun(key);
      }
    }
  }

  function tick(v: Versions) {
    wanted.list = v.list;
    if (v.list !== known.list && !busy.list) void loadList();
    for (const key of watchers.keys()) {
      const version = v.runs[key] ?? null;
      wanted.runs.set(key, version);
      if (busy.runs.has(key)) continue;
      // A key the tick no longer names: its folder is gone, the next read says not-found.
      if (version === null ? state.runs[key]?.status !== "not-found" : version !== known.runs.get(key)) void loadRun(key);
    }
  }

  function open() {
    const again = lost;
    lost = false;
    set({ connection: "open" });
    if (!again) return;
    // Back after a loss: every part is read whole, whatever the versions say.
    void loadList();
    for (const key of watchers.keys()) void loadRun(key);
  }

  function error() {
    if (lost) return;
    lost = true;
    set({ connection: "lost" });
  }

  return {
    /** The API the store reads through, for the tree under its provider: the verdict write, a report's text. */
    api,
    getSnapshot: () => state,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
    start() {
      if (close) return;
      close = api.events({ open, tick, error });
      void loadList();
    },
    stop() {
      close?.();
      close = null;
    },
    /** A page reads the run and keeps it live while it watches; the function returned stops watching. */
    watch(key: string) {
      watchers.set(key, (watchers.get(key) ?? 0) + 1);
      const at = recent.indexOf(key);
      if (at >= 0) recent.splice(at, 1);
      recent.push(key);
      if (!state.runs[key]) setRun(key, LOADING);
      void loadRun(key);
      return () => {
        const left = (watchers.get(key) ?? 1) - 1;
        if (left > 0) return void watchers.set(key, left);
        watchers.delete(key);
        // Runs no page watches are kept only while recent.
        const idle = recent.filter((k) => !watchers.has(k));
        for (const k of idle.slice(0, Math.max(0, idle.length - KEEP))) {
          recent.splice(recent.indexOf(k), 1);
          known.runs.delete(k);
          const rest = { ...state.runs };
          delete rest[k];
          set({ runs: rest });
        }
      };
    },
    retryRun(key: string) {
      setRun(key, LOADING);
      void loadRun(key);
    },
    retryList() {
      set({ list: LOADING });
      void loadList();
    },
  };
}

export type LiveStore = ReturnType<typeof createLiveStore>;

const LiveContext = createContext<LiveStore | null>(null);

/** Starts the store's stream for the tree under it and stops it when the tree goes; the tree calls the store's API. */
export function LiveProvider({ store, children }: { store: LiveStore; children: ReactNode }) {
  useEffect(() => {
    store.start();
    return () => store.stop();
  }, [store]);
  return (
    <LiveContext.Provider value={store}>
      <ApiProvider value={store.api}>{children}</ApiProvider>
    </LiveContext.Provider>
  );
}

export function useLiveStore(): LiveStore {
  const store = useContext(LiveContext);
  if (!store) throw new Error("useLiveStore: no LiveProvider above");
  return store;
}

function useSnapshot<T>(select: (s: LiveSnapshot) => T): T {
  const store = useLiveStore();
  return useSyncExternalStore(
    store.subscribe,
    () => select(store.getSnapshot()),
    () => select(store.getSnapshot()),
  );
}

/** The run list: loading, its cards and roots, or why it failed. */
export const useRuns = (): ListState => useSnapshot((s) => s.list);

/** One run, read now and kept live while the caller is mounted. */
export function useRun(key: string | null): RunState {
  const store = useLiveStore();
  useEffect(() => (key ? store.watch(key) : undefined), [store, key]);
  return useSnapshot((s) => (key ? s.runs[key] : undefined) ?? LOADING);
}

export const useConnection = (): Connection => useSnapshot((s) => s.connection);
export const useUpdatedAt = (): number | null => useSnapshot((s) => s.updatedAt);
