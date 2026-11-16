// The reading views' tests (Отчёты, Соглашения, Журнал) stand on u1's real handler over the fixture root, as the
// run page mounts them: the live store reads the run through u3's `fixtureApp`, the clock is the tests' NOW. A
// test that drives a live change renders a view over a run object it changes itself (`renderOver`).
import { render } from "@testing-library/react";
import { useEffect, type ComponentType } from "react";
import { MemoryRouter, useLocation, useNavigate, type Location, type NavigateFunction } from "react-router-dom";
import { readRun } from "../../../server/run.ts";
import { Loading, UiProvider } from "@/ui";
import { ClockProvider } from "../../app/clock.tsx";
import type { Transport } from "@/api";
import { createLiveStore, LiveProvider, useRun } from "../../app/live.tsx";
import { NOW, type FixtureApp } from "../../app/testing.tsx";
import type { LoadedRun, ViewProps } from "../index.ts";

/** «Файл отчёта» answered in the server's place: the run's key and the file's name in, the response out. */
export type FetchReport = (runKey: string, file: string) => Promise<Response>;

export { fixtureApp, keyOf, MIN, NOW } from "../../app/testing.tsx";

/** Where the router stands, and a way to go Back. */
export interface Probe {
  location: Location | null;
  navigate: NavigateFunction | null;
}

/** A probe and the component that keeps it current under the router. */
function makeProbe() {
  const probe: Probe = { location: null, navigate: null };
  function ProbeOf() {
    const location = useLocation();
    const navigate = useNavigate();
    useEffect(() => {
      probe.location = location;
      probe.navigate = navigate;
    });
    return null;
  }
  return { probe, ProbeOf };
}

function Host({ runKey, View }: { runKey: string; View: ComponentType<ViewProps> }) {
  const state = useRun(runKey);
  return (
    <section data-slot="view-body" className="@container/view relative h-[40rem]">
      {state.status === "ready" ? <View run={state.run} /> : <Loading framed />}
    </section>
  );
}

/** A reading view of one run over the live store, on a memory router at `path`. */
export function renderView(fx: FixtureApp, runKey: string, path: string, View: ComponentType<ViewProps>) {
  const store = createLiveStore(fx.transport, { now: () => NOW });
  const { probe, ProbeOf } = makeProbe();
  const view = render(
    <UiProvider>
      <ClockProvider now={NOW}>
        <LiveProvider store={store}>
          <MemoryRouter initialEntries={[path]}>
            <Host runKey={runKey} View={View} />
            <ProbeOf />
          </MemoryRouter>
        </LiveProvider>
      </ClockProvider>
    </UiProvider>,
  );
  return { ...view, probe };
}

/** A run of fixture folder n, served as the store serves it. */
export function loadedRun(fx: FixtureApp, n: number, key: string, version = 1): LoadedRun {
  const run = readRun(fx.dirOf(n), { git: () => null });
  return { ...run, key, project: key.split("/")[0], version };
}

/** The report route of u1's handler, as «Файл отчёта» reads it. */
export const handlerReport =
  (fx: FixtureApp): FetchReport =>
  (runKey, file) =>
    fx.app.handle(new Request(`http://127.0.0.1:4747/api/report?run=${encodeURIComponent(runKey)}&file=${encodeURIComponent(file)}`));

/** A view over a run object the test holds, so a live change is the next object: `again(next)`; `fetchReport`
 * answers «Файл отчёта» in the handler's place. */
export function renderOver(fx: FixtureApp, run: LoadedRun, path: string, View: ComponentType<ViewProps>, { fetchReport }: { fetchReport?: FetchReport } = {}) {
  const transport: Transport = fetchReport
    ? {
        ...fx.transport,
        get(path) {
          const url = new URL(path, "http://127.0.0.1:4747");
          return url.pathname === "/api/report" ? fetchReport(url.searchParams.get("run") ?? "", url.searchParams.get("file") ?? "") : fx.transport.get(path);
        },
      }
    : fx.transport;
  const store = createLiveStore(transport, { now: () => NOW });
  const { probe, ProbeOf } = makeProbe();
  const tree = (r: LoadedRun) => (
    <UiProvider>
      <ClockProvider now={NOW}>
        <LiveProvider store={store}>
          <MemoryRouter initialEntries={[path]}>
            <section data-slot="view-body" className="@container/view relative h-[40rem]">
              <View run={r} />
            </section>
            <ProbeOf />
          </MemoryRouter>
        </LiveProvider>
      </ClockProvider>
    </UiProvider>
  );
  const view = render(tree(run));
  return { ...view, probe, again: (next: LoadedRun) => view.rerender(tree(next)) };
}
