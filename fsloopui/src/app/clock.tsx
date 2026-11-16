// The one shared clock (rules/ui → Live data 4, Conventions 10): every live age — a run's liveness, «идёт 2 ч»,
// «обновлено 5 мин назад» — ticks on it together, so two surfaces never disagree by a second. A test or the kit
// fixes it with ClockProvider.
import { createContext, useContext, useSyncExternalStore, type ReactNode } from "react";

/** How often the ages move: the coarsest one shown is a minute. */
export const CLOCK_TICK_MS = 15_000;

let now = Date.now();
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | undefined;

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!timer) {
    now = Date.now();
    timer = setInterval(() => {
      now = Date.now();
      for (const l of listeners) l();
    }, CLOCK_TICK_MS);
  }
  return () => {
    listeners.delete(listener);
    if (!listeners.size && timer) {
      clearInterval(timer);
      timer = undefined;
    }
  };
}

const Fixed = createContext<number | null>(null);

/** A fixed «now» for everything under it. */
export function ClockProvider({ now: fixed, children }: { now: number; children: ReactNode }) {
  return <Fixed.Provider value={fixed}>{children}</Fixed.Provider>;
}

/** The shared clock's «now», in milliseconds. */
export function useNow(): number {
  const fixed = useContext(Fixed);
  const live = useSyncExternalStore(
    subscribe,
    () => now,
    () => now,
  );
  return fixed ?? live;
}
