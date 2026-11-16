// The findings view's tests stand on u1's real handler over the fixture root (u3's `fixtureApp`): the live store
// reads runs through it, and the verdict goes to `POST /api/verdict` of a second handler over the same root whose
// clock is the tests' NOW, so the saved time is «19:41 МСК». No network, no browser.
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { render } from "@testing-library/react";
import { useEffect } from "react";
import { MemoryRouter, useLocation, type Location } from "react-router-dom";
import { createApp } from "../../../server/http.ts";
import { Loading, UiProvider } from "@/ui";
import { ClockProvider } from "../../app/clock.tsx";
import { createLiveStore, LiveProvider, useRun } from "../../app/live.tsx";
import { fixtureApp, NOW, type FixtureApp } from "../../app/testing.tsx";
import { FindingsView } from "./index.tsx";
import { VerdictPostProvider, type PostVerdict, type VerdictBody } from "./verdict.tsx";

export { keyOf, MIN, NOW } from "../../app/testing.tsx";

/** u1's app over fixture folders `only`, and a writer whose clock is NOW; `fail` makes the next writes fail. */
export function findingsApp(only: number[]) {
  const fx: FixtureApp = fixtureApp({ only });
  const dist = mkdtempSync(join(tmpdir(), "fsloopui-findings-"));
  const writer = createApp({ roots: [fx.root], distDir: dist, intervalMs: 3_600_000, now: () => NOW, git: () => null });
  const sent: VerdictBody[] = [];
  let failing: string | null = null;
  const post: PostVerdict = async (body) => {
    sent.push(body);
    if (failing !== null) return new Response(JSON.stringify({ error: failing }), { status: 500, headers: { "content-type": "application/json" } });
    // the writer knows the findings a test added to the folder since it started
    writer.store.refresh({ full: true });
    return writer.handle(new Request("http://127.0.0.1:4747/api/verdict", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }));
  };
  return {
    fx,
    post,
    sent,
    /** The next writes answer 500 with this cause; null — they reach the server again. */
    fail(cause: string | null) {
      failing = cause;
    },
    /** human.jsonl of run folder n, line by line. */
    human(n: number): { finding: string; verdict: string; note: string | null; at: string }[] {
      try {
        return readFileSync(join(fx.dirOf(n), "human.jsonl"), "utf8")
          .split("\n")
          .filter(Boolean)
          .map((l) => JSON.parse(l));
      } catch {
        return [];
      }
    },
    close() {
      writer.close();
      fx.close();
      rmSync(dist, { recursive: true, force: true });
    },
  };
}

export type FindingsApp = ReturnType<typeof findingsApp>;

function Host({ runKey }: { runKey: string }) {
  const state = useRun(runKey);
  return (
    <section data-slot="view-body" className="relative h-[40rem]">
      {state.status === "ready" ? <FindingsView run={state.run} /> : <Loading framed />}
    </section>
  );
}

/** The findings view of one run, as the run page mounts it, on a memory router at `path`, the clock at NOW. */
export function renderFindings(app: FindingsApp, runKey: string, path: string) {
  const store = createLiveStore(app.fx.transport, { now: () => NOW });
  const probe = { location: null as Location | null };
  function Probe() {
    const location = useLocation();
    useEffect(() => {
      probe.location = location;
    });
    return null;
  }
  const view = render(
    <UiProvider>
      <ClockProvider now={NOW}>
        <LiveProvider store={store}>
          <VerdictPostProvider value={app.post}>
            <MemoryRouter initialEntries={[path]}>
              <Host runKey={runKey} />
              <Probe />
            </MemoryRouter>
          </VerdictPostProvider>
        </LiveProvider>
      </ClockProvider>
    </UiProvider>,
  );
  return { ...view, store, probe };
}
