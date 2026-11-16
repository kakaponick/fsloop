// The shell's tests stand on u1's real handler over a fixture root — no network: the transport calls `handle`
// directly and reads the live stream from its response. A test can hold or answer one path itself (a slow run, a
// read error) and drop or restore the stream.
import { mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { render } from "@testing-library/react";
import type { ReactElement } from "react";
import { MemoryRouter, useLocation, useNavigate, useNavigationType, type Location, type NavigateFunction, type NavigationType } from "react-router-dom";
import { inject } from "vitest";
import { APP_NOW } from "../../fixtures/global-setup.ts";
import { makeFixtureRoot, PROJECTS, runId } from "../../fixtures/make.ts";
import { createApp } from "../../server/http.ts";
import { UiProvider } from "../ui/provider.tsx";
import { ClockProvider } from "./clock.tsx";
import { createLiveStore, LiveProvider, type StreamHandlers, type Transport } from "./live.tsx";
import { Shell } from "./shell.tsx";

/** 16.11.2026 19:41 МСК — the fixture root's «now» and the clock of every rendered shell. */
export const NOW = APP_NOW;
export const MIN = 60_000;

/** The project of fixture folder n, in the fixture plan's order. */
export function projectOf(n: number): string {
  let first = 0;
  for (const p of PROJECTS) {
    if (n < first + p.runs) return p.name;
    first += p.runs;
  }
  throw new Error(`no fixture folder ${n}`);
}

export const keyOf = (n: number) => `${projectOf(n)}/${runId(n)}`;

interface Connection {
  closed: boolean;
  reader: ReadableStreamDefaultReader<Uint8Array> | null;
  handlers: StreamHandlers;
}

/** u1's app over a fixture root (all 63 folders, the `only` ones, or none) and a transport into its handler. All 63
 * are the root the global setup wrote once for the run (fixtures/global-setup.ts), shared and read-only: a test that
 * writes into a run folder builds its own with `only`. */
export function fixtureApp({ only, empty = false }: { only?: number[]; empty?: boolean } = {}) {
  const temp = mkdtempSync(join(tmpdir(), "fsloopui-app-"));
  const shared = !empty && !only;
  const root = shared ? inject("fixtureRoot") : join(temp, "root");
  if (empty) mkdirSync(root, { recursive: true });
  else if (!shared) makeFixtureRoot(root, { now: NOW, only });
  const dist = join(temp, "dist");
  mkdirSync(dist);
  // No poller (code-1): a write moves the server itself through `pulse()`, and a test waits for its condition.
  const app = createApp({ roots: [root], distDir: dist, poll: false, git: () => null });
  const requests: string[] = [];
  let answer: ((path: string) => Promise<Response> | null) | null = null;
  let current: Connection | null = null;

  const handle = (path: string) => app.handle(new Request(`http://127.0.0.1:4747${path}`));

  async function connect(handlers: StreamHandlers) {
    const c: Connection = { closed: false, reader: null, handlers };
    current = c;
    const res = await handle("/api/events");
    if (c.closed) return;
    c.reader = (res.body as ReadableStream<Uint8Array>).getReader();
    handlers.open();
    const decoder = new TextDecoder();
    let buffer = "";
    try {
      for (;;) {
        const { value, done } = await c.reader.read();
        if (done || c.closed) return;
        buffer += decoder.decode(value, { stream: true });
        for (let end = buffer.indexOf("\n\n"); end >= 0; end = buffer.indexOf("\n\n")) {
          const message = buffer.slice(0, end);
          buffer = buffer.slice(end + 2);
          const data = /^event: tick\ndata: (.*)$/m.exec(message);
          if (data && !c.closed) handlers.tick(JSON.parse(data[1]));
        }
      }
    } catch {
      // cancelled
    }
  }

  const close = (c: Connection | null) => {
    if (!c) return;
    c.closed = true;
    void c.reader?.cancel().catch(() => {});
  };

  const transport: Transport = {
    get(path) {
      requests.push(path);
      return answer?.(path) ?? handle(path);
    },
    events(handlers) {
      void connect(handlers);
      const mine = current;
      return () => close(mine);
    },
  };

  const dirOf = (n: number) => join(root, projectOf(n), ".claude", "fsloop", "runs", runId(n));

  return {
    root: resolve(root),
    app,
    transport,
    requests,
    dirOf,
    /** Answers a path in the test's place; null hands it to the server. */
    answer(fn: ((path: string) => Promise<Response> | null) | null) {
      answer = fn;
    },
    /** Writes a file of run folder n, dated `at` (folder included), as fsloop would, then ticks the server twice: the
     * first tick sees the change, the second reads it settled — and tells the stream. */
    write(n: number, rel: string, text: string, at = NOW - MIN / 2) {
      if (shared) throw new Error("fixtureApp: the shared root of 63 is read-only — build the folders you write with `only`");
      const path = join(dirOf(n), rel);
      mkdirSync(join(path, ".."), { recursive: true });
      writeFileSync(path, text);
      utimesSync(path, new Date(at), new Date(at));
      utimesSync(dirOf(n), new Date(at), new Date(at));
      app.pulse();
      app.pulse();
    },
    /** One tick of the server: what changed on disk outside `write` (a new run folder) is read and told. */
    pulse() {
      app.pulse();
    },
    /** The live stream drops: the store hears its error. */
    drop() {
      const c = current;
      close(c);
      c?.handlers.error();
    },
    /** The stream comes back. */
    restore() {
      if (current) void connect(current.handlers);
    },
    close() {
      close(current);
      app.close();
      rmSync(temp, { recursive: true, force: true });
    },
  };
}

export type FixtureApp = ReturnType<typeof fixtureApp>;

export const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

/** The shell as the app mounts it, on a memory router at `path`, the clock and the store's «now» at NOW. */
export function renderShell(transport: Transport, { path = "/", extra }: { path?: string; extra?: ReactElement } = {}) {
  const store = createLiveStore(transport, { now: () => NOW });
  const probe = { location: null as Location | null, navigate: null as NavigateFunction | null, type: null as NavigationType | null };
  function Probe() {
    probe.location = useLocation();
    probe.navigate = useNavigate();
    probe.type = useNavigationType();
    return null;
  }
  const tree = (
    <UiProvider>
      <ClockProvider now={NOW}>
        <LiveProvider store={store}>
          <MemoryRouter initialEntries={[path]}>
            <Shell />
            <Probe />
            {extra}
          </MemoryRouter>
        </LiveProvider>
      </ClockProvider>
    </UiProvider>
  );
  const view = render(tree);
  return { ...view, store, probe, again: () => view.rerender(tree) };
}
