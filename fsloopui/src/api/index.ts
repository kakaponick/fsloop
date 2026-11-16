// The client's one way to the server: the run list, a run, the tick stream, the verdict write, a report's text and
// a frame's address. Every call goes through a transport — the browser's `fetch` and `EventSource` in the app, the
// server's own handler in the tests — and every refusal reads as an Error carrying the server's own words.
import { createContext, createElement, useContext, type ReactNode } from "react";
import type { RunCard, ServedRun, UserVerdict } from "../../shared/model.ts";
import type { Verdict } from "../../shared/states.ts";

export interface Versions {
  list: number;
  runs: Record<string, number>;
}

export interface StreamHandlers {
  open(): void;
  tick(versions: Versions): void;
  error(): void;
}

/** How the client reaches the server: a GET, a JSON POST and the tick stream. */
export interface Transport {
  get(path: string): Promise<Response>;
  post(path: string, body: unknown): Promise<Response>;
  /** Opens the stream; the function it returns closes it. */
  events(handlers: StreamHandlers): () => void;
}

export const httpTransport: Transport = {
  get: (path) => fetch(path, { cache: "no-store" }),
  post: (path, body) => fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }),
  events(handlers) {
    const source = new EventSource("/api/events");
    source.addEventListener("open", () => handlers.open());
    source.addEventListener("error", () => handlers.error());
    source.addEventListener("tick", (event) => {
      try {
        handlers.tick(JSON.parse((event as MessageEvent<string>).data));
      } catch {
        // a tick that is not JSON carries nothing
      }
    });
    return () => source.close();
  },
};

export interface RunList {
  version: number;
  list: RunCard[];
  roots: string[];
}

export interface VerdictBody {
  run: string;
  findings: string[];
  verdict: Verdict;
  note: string | null;
}

export interface Api {
  /** The run list with its version. */
  runs(): Promise<RunList>;
  /** One run as served; null when the server has no such run. */
  run(key: string): Promise<ServedRun | null>;
  /** Opens the tick stream; the function it returns closes it. */
  events(handlers: StreamHandlers): () => void;
  /** Saves the user's verdict on the findings named; returns it as the server saved it. */
  verdict(body: VerdictBody): Promise<UserVerdict>;
  /** A launch's report as written. Read again only when the report's record in the run has changed since. */
  report(runKey: string, file: string): Promise<string>;
}

/** The server's words for a refusal: a report's cause first, else its error, else the status. */
async function causeOf(res: Response): Promise<string> {
  try {
    const body = await res.json();
    if (body && typeof body.cause === "string") return body.cause;
    if (body && typeof body.error === "string") return body.error;
  } catch {
    // not JSON
  }
  return `сервер ответил ${res.status}`;
}

async function refused(res: Response): Promise<never> {
  throw new Error(await causeOf(res));
}

const query = (params: Record<string, string>) =>
  Object.entries(params)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join("&");

/** A frame's address, also for a report's frames. */
export const frameSrc = (runKey: string, name: string): string => `/api/frame?${query({ run: runKey, name })}`;

const basename = (p: string) => p.split(/[\\/]/).at(-1) ?? p;

/** A report's stamp in the run: everything the run model read from that file. The served run carries no file
 * times, so a rewrite that moves none of it is not seen; one that moves a section, a finding or a verdict is. */
function reportStamp(run: ServedRun, file: string): string | null {
  const l = run.launches.find((x) => x.report && basename(x.report) === file);
  return l ? JSON.stringify([l.report, l.reportMissing, l.sections, l.unparsed, l.verdicts, l.findings]) : null;
}

/** The run as a view reads it. A running launch's last write moves with every write of the run, so the server keeps
 * it out of the run's version and serves it with its card (improve-17): it is the card's when the card's is later, and
 * the run stays the same object when none is. The run's tokens are read from the card where they are shown (the
 * header), never laid over the run (code-22). */
export function withLive(run: ServedRun, card: Pick<RunCard, "runningLastAt"> | undefined): ServedRun {
  if (!card) return run;
  let moved = false;
  const running = run.running.map((r) => {
    const at = card.runningLastAt[r.agentId];
    if (!at || (r.lastAt !== null && at <= r.lastAt)) return r;
    moved = true;
    return { ...r, lastAt: at };
  });
  return moved ? { ...run, running } : run;
}

/** Runs and report texts kept for the re-read rule: a few, the newest. */
const KEEP = 8;

function remember<K, V>(map: Map<K, V>, key: K, value: V) {
  map.delete(key);
  map.set(key, value);
  for (const old of map.keys()) {
    if (map.size <= KEEP) break;
    map.delete(old);
  }
}

export function createApi(transport: Transport): Api {
  /** The newest copy of each run read lately: where a report's stamp is looked up. */
  const runs = new Map<string, ServedRun>();
  /** The report texts read, with the stamp they were read at. */
  const reads = new Map<string, { stamp: string; text: string }>();

  return {
    async runs() {
      const res = await transport.get("/api/runs");
      if (!res.ok) return refused(res);
      const body = (await res.json()) as { version: number; list: RunCard[]; roots?: string[] };
      return { version: body.version, list: body.list, roots: body.roots ?? [] };
    },
    async run(key) {
      const res = await transport.get(`/api/run?${query({ run: key })}`);
      if (res.status === 404) {
        runs.delete(key);
        return null;
      }
      if (!res.ok) return refused(res);
      const run = (await res.json()) as ServedRun;
      remember(runs, key, run);
      return run;
    },
    events: (handlers) => transport.events(handlers),
    async verdict(body) {
      const res = await transport.post("/api/verdict", body);
      if (!res.ok) return refused(res);
      return ((await res.json()) as { verdict: UserVerdict }).verdict;
    },
    async report(runKey, file) {
      const id = `${runKey}\n${file}`;
      const run = runs.get(runKey);
      const stamp = run ? reportStamp(run, file) : null;
      const kept = reads.get(id);
      if (stamp !== null && kept?.stamp === stamp) return kept.text;
      const res = await transport.get(`/api/report?${query({ run: runKey, file })}`);
      if (!res.ok) return refused(res);
      const text = await res.text();
      if (stamp !== null) remember(reads, id, { stamp, text });
      else reads.delete(id);
      return text;
    },
  };
}

const ApiContext = createContext<Api | null>(null);

/** The API a tree under it calls; the live store's provider sets it from its own transport. */
export function ApiProvider({ value, children }: { value: Api; children: ReactNode }) {
  return createElement(ApiContext.Provider, { value }, children);
}

export function useApi(): Api {
  const api = useContext(ApiContext);
  if (!api) throw new Error("useApi: no ApiProvider above");
  return api;
}
