// The units view's tests stand on u1's real handler over the fixture root (u3's `fixtureApp`): the live store reads
// runs through it, so a test that writes a run folder sees the view update as fsloop's writes would make it. A run
// object can also be mounted as it is, for a state no fixture folder holds. No network, no browser.
import { render } from "@testing-library/react";
import { useEffect } from "react";
import { MemoryRouter, useLocation, type Location } from "react-router-dom";
import { readRun } from "../../../server/run.ts";
import { Loading, UiProvider } from "@/ui";
import { ClockProvider } from "../../app/clock.tsx";
import { createLiveStore, LiveProvider, useRun } from "../../app/live.tsx";
import { fixtureApp, keyOf, NOW, projectOf, type FixtureApp } from "../../app/testing.tsx";
import type { LoadedRun } from "../index.ts";
import { UnitsView } from "./index.tsx";

export { keyOf, MIN, NOW } from "../../app/testing.tsx";

/** Run folder n as the server serves it, read once. */
export function loadedRun(fx: FixtureApp, n: number): LoadedRun {
  return { ...readRun(fx.dirOf(n)), key: keyOf(n), project: projectOf(n), version: 1 };
}

function Host({ runKey }: { runKey: string }) {
  const state = useRun(runKey);
  return (
    <section data-slot="view-body" className="relative h-[40rem]">
      {state.status === "ready" ? <UnitsView run={state.run} /> : <Loading framed />}
    </section>
  );
}

function probeOf() {
  const probe = { location: null as Location | null };
  function Probe() {
    const location = useLocation();
    useEffect(() => {
      probe.location = location;
    });
    return null;
  }
  return { probe, Probe };
}

/** The units view of one run as the run page mounts it, live from the store, on a memory router at `path`. */
export function renderUnits(fx: FixtureApp, runKey: string, path: string) {
  const store = createLiveStore(fx.transport, { now: () => NOW });
  const { probe, Probe } = probeOf();
  const view = render(
    <UiProvider>
      <ClockProvider now={NOW}>
        <LiveProvider store={store}>
          <MemoryRouter initialEntries={[path]}>
            <Host runKey={runKey} />
            <Probe />
          </MemoryRouter>
        </LiveProvider>
      </ClockProvider>
    </UiProvider>,
  );
  return { ...view, store, probe };
}

/** The units view over a run object as given, the clock at NOW. */
export function renderRun(fx: FixtureApp, run: LoadedRun, path: string) {
  const store = createLiveStore(fx.transport, { now: () => NOW });
  const { probe, Probe } = probeOf();
  const view = render(
    <UiProvider>
      <ClockProvider now={NOW}>
        <LiveProvider store={store}>
          <MemoryRouter initialEntries={[path]}>
            <section data-slot="view-body" className="relative h-[40rem]">
              <UnitsView run={run} />
            </section>
            <Probe />
          </MemoryRouter>
        </LiveProvider>
      </ClockProvider>
    </UiProvider>,
  );
  return { ...view, probe };
}

export { fixtureApp };
