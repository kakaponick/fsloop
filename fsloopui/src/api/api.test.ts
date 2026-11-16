// The client's one API module, each function called against a fake transport: the path it asks, what it returns,
// what a refusal reads as — and a walk over src/ that finds no other way to the server.
import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import type { RunCard, RunSpend, ServedRun } from "../../shared/model.ts";
import { createApi, frameSrc, withLive, type StreamHandlers, type Transport } from "./index.ts";

interface Call {
  method: "GET" | "POST";
  path: string;
  body?: unknown;
}

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

/** A transport that records every call and answers each from `answer`. */
function fakeTransport(answer: (call: Call) => Response) {
  const calls: Call[] = [];
  const closed: string[] = [];
  let handlers: StreamHandlers | null = null;
  const transport: Transport = {
    async get(path) {
      const call: Call = { method: "GET", path };
      calls.push(call);
      return answer(call);
    },
    async post(path, body) {
      const call: Call = { method: "POST", path, body };
      calls.push(call);
      return answer(call);
    },
    events(h) {
      handlers = h;
      return () => void closed.push("events");
    },
  };
  return { transport, calls, closed, handlers: () => handlers };
}

const KEY = "tga/a098a7d4";

/** A served run with one launch whose report is `p1-map-map.md`, its parsed record as given. */
function runAt(version: number, map: { lens: string; findings?: string[] }, extra = 0): ServedRun {
  const launch = (id: string, report: string, lens: string, findings: string[] = []) => ({
    id,
    report,
    reportMissing: false,
    sections: { LENS: { line: 1, text: lens } },
    unparsed: [],
    verdicts: [],
    findings,
  });
  const launches = [launch("p1-map-map", "reports/p1-map-map.md", map.lens, map.findings)];
  for (let k = 0; k < extra; k++) launches.push(launch(`p1-review-${k}`, `reports/p1-review-${k}.md`, "code"));
  return { key: KEY, project: "tga", version, launches } as unknown as ServedRun;
}

describe("runs()", () => {
  test("reads /api/runs: the version, the cards and the roots", async () => {
    const fake = fakeTransport(() => json(200, { version: 7, list: [{ key: KEY }], roots: ["C:/dev"] }));
    expect(await createApi(fake.transport).runs()).toEqual({ version: 7, list: [{ key: KEY }], roots: ["C:/dev"] });
    expect(fake.calls).toEqual([{ method: "GET", path: "/api/runs" }]);
  });

  test("a list with no roots reads as none; a refusal throws the server's own words", async () => {
    expect(await createApi(fakeTransport(() => json(200, { version: 1, list: [] })).transport).runs()).toEqual({ version: 1, list: [], roots: [] });
    await expect(createApi(fakeTransport(() => json(500, { error: "Корень не прочитан" })).transport).runs()).rejects.toThrow("Корень не прочитан");
    await expect(createApi(fakeTransport(() => new Response("<html>", { status: 502 })).transport).runs()).rejects.toThrow("сервер ответил 502");
  });
});

describe("run(key)", () => {
  test("reads /api/run with the key encoded; a run the server does not have is null", async () => {
    const fake = fakeTransport((c) => (c.path.endsWith("a098a7d4") ? json(200, runAt(3, { lens: "map" })) : json(404, { error: "Прогон fsloop/deadbeef не найден" })));
    const api = createApi(fake.transport);
    expect((await api.run(KEY))?.version).toBe(3);
    expect(await api.run("fsloop/deadbeef")).toBeNull();
    expect(fake.calls.map((c) => c.path)).toEqual(["/api/run?run=tga%2Fa098a7d4", "/api/run?run=fsloop%2Fdeadbeef"]);
  });

  test("any other refusal throws the server's words", async () => {
    await expect(createApi(fakeTransport(() => json(403, { error: "Запрос не с этого адреса" })).transport).run(KEY)).rejects.toThrow("Запрос не с этого адреса");
  });
});

describe("events(handlers)", () => {
  test("opens the transport's tick stream with the caller's handlers; the function returned closes it", () => {
    const fake = fakeTransport(() => json(200, {}));
    const handlers: StreamHandlers = { open() {}, tick() {}, error() {} };
    const close = createApi(fake.transport).events(handlers);
    expect(fake.handlers()).toBe(handlers);
    close();
    expect(fake.closed).toEqual(["events"]);
  });
});

describe("verdict(body)", () => {
  test("posts the body to /api/verdict and returns the verdict as saved", async () => {
    const saved = { verdict: "agree", note: "по делу", at: "2026-11-16T16:41:00.000Z" };
    const fake = fakeTransport(() => json(200, { verdict: saved }));
    const body = { run: KEY, findings: ["craft-18"], verdict: "agree" as const, note: "по делу" };
    expect(await createApi(fake.transport).verdict(body)).toEqual(saved);
    expect(fake.calls).toEqual([{ method: "POST", path: "/api/verdict", body }]);
  });

  test("a write the server refused throws its words", async () => {
    const fake = fakeTransport(() => json(500, { error: "Оценка не сохранилась: EACCES: permission denied, open 'human.jsonl'" }));
    await expect(createApi(fake.transport).verdict({ run: KEY, findings: ["craft-18"], verdict: "agree", note: null })).rejects.toThrow("Оценка не сохранилась: EACCES: permission denied, open 'human.jsonl'");
  });
});

describe("report(runKey, file)", () => {
  test("reads /api/report with both names encoded and returns the file as written", async () => {
    const fake = fakeTransport(() => new Response("LENS: craft assess\n"));
    expect(await createApi(fake.transport).report(KEY, "p1-map-map.md")).toBe("LENS: craft assess\n");
    expect(fake.calls.map((c) => c.path)).toEqual(["/api/report?run=tga%2Fa098a7d4&file=p1-map-map.md"]);
  });

  test("a file that cannot be read throws the cause, else the error", async () => {
    const cause = fakeTransport(() => json(500, { error: "Отчёт p1-map-map.md не прочитан", cause: "EISDIR: illegal operation on a directory, read" }));
    await expect(createApi(cause.transport).report(KEY, "p1-map-map.md")).rejects.toThrow("EISDIR: illegal operation on a directory, read");
    const error = fakeTransport(() => json(400, { error: "Недопустимое имя отчёта" }));
    await expect(createApi(error.transport).report(KEY, "../x")).rejects.toThrow("Недопустимое имя отчёта");
  });

  test("across versions of an active run, the open report is read again only when its record changes", async () => {
    let run = runAt(1, { lens: "map" });
    let text = "first";
    const fake = fakeTransport((c) => (c.path.startsWith("/api/run?") ? json(200, run) : new Response(text)));
    const api = createApi(fake.transport);
    const reads = () => fake.calls.filter((c) => c.path.startsWith("/api/report")).length;

    await api.run(KEY);
    expect(await api.report(KEY, "p1-map-map.md")).toBe("first");
    // versions 2 and 3: other launches end, this report's record stays — no read
    for (const [version, extra] of [[2, 1], [3, 2]]) {
      run = runAt(version, { lens: "map" }, extra);
      await api.run(KEY);
      expect(await api.report(KEY, "p1-map-map.md")).toBe("first");
    }
    expect(reads()).toBe(1);
    // version 4: the file was written again and its record moved — one read, the new text
    run = runAt(4, { lens: "map", findings: ["map-1"] }, 2);
    text = "second";
    await api.run(KEY);
    expect(await api.report(KEY, "p1-map-map.md")).toBe("second");
    expect(await api.report(KEY, "p1-map-map.md")).toBe("second");
    expect(reads()).toBe(2);
  });

  test("a report of a run it has not read, or one that failed, is read every time", async () => {
    let ok = false;
    const fake = fakeTransport(() => (ok ? new Response("text") : json(500, { error: "Отчёт p1-map-map.md не прочитан", cause: "EBUSY" })));
    const api = createApi(fake.transport);
    await expect(api.report(KEY, "p1-map-map.md")).rejects.toThrow("EBUSY");
    ok = true;
    expect(await api.report(KEY, "p1-map-map.md")).toBe("text");
    expect(await api.report(KEY, "p1-map-map.md")).toBe("text");
    expect(fake.calls).toHaveLength(3);
  });
});

describe("improve-17 · withLive(run, card): what a view reads of a running launch", () => {
  const AT = "2026-11-16T10:00:00.000Z";
  const LATER = "2026-11-16T10:04:30.000Z";
  const spendOf = (orchestratorOutput: number): RunSpend => ({ launches: { input: 100, output: 200, cacheWrite: 300, cacheRead: 400, boot: 10, continuations: 0 }, orchestrator: { input: 1, output: orchestratorOutput, cacheWrite: 0, cacheRead: 5 } });
  const running = (agentId: string, lastAt: string | null) => ({ agentId, description: `${agentId} implement`, agent: "fsloop-implement", name: `${agentId} · исполнитель`, startedAt: AT, lastAt });
  const served = { key: KEY, project: "tga", version: 7, running: [running("u2", AT), running("u3", AT)], spend: spendOf(20), findings: [], launches: [] } as unknown as ServedRun;
  const card = (runningLastAt: RunCard["runningLastAt"], spend: RunSpend | null): Pick<RunCard, "runningLastAt" | "spend"> => ({ runningLastAt, spend });

  test("a running launch's last write and the run's tokens come from the card, the rest of the run as read", () => {
    const run = withLive(served, card({ u2: LATER, u3: AT }, spendOf(90)));
    expect(run.running.map((r) => [r.agentId, r.lastAt])).toEqual([
      ["u2", LATER],
      ["u3", AT],
    ]);
    expect(run.spend?.orchestrator).toEqual({ input: 1, output: 90, cacheWrite: 0, cacheRead: 5 });
    // The same version, the same parts: nothing else was read again.
    expect(run.version).toBe(7);
    expect(run.findings).toBe(served.findings);
    expect(run.launches).toBe(served.launches);
  });

  test("a card no newer than the run gives it nothing back: the same run, so a view does not draw again", () => {
    expect(withLive(served, card({ u2: AT, u3: AT }, spendOf(20)))).toBe(served);
    // A card a tick behind a run just read: an older time and fewer tokens stay the run's.
    expect(withLive(served, card({ u2: "2026-11-16T09:59:00.000Z" }, spendOf(5)))).toBe(served);
    expect(withLive(served, undefined)).toBe(served);
  });
});

describe("frameSrc(runKey, name)", () => {
  test("a frame's address, both names encoded", () => {
    expect(frameSrc(KEY, "u3 shell 1440.png")).toBe("/api/frame?run=tga%2Fa098a7d4&name=u3%20shell%201440.png");
  });
});

describe("one way to the server", () => {
  test("no file under src/ outside src/api/ calls fetch( or opens an EventSource", () => {
    const src = fileURLToPath(new URL("..", import.meta.url));
    const own = fileURLToPath(new URL(".", import.meta.url));
    const found: string[] = [];
    for (const rel of readdirSync(src, { recursive: true }) as string[]) {
      const path = join(src, rel);
      if (!/\.(ts|tsx)$/.test(rel) || path.startsWith(own)) continue;
      const text = readFileSync(path, "utf8");
      if (/\bfetch\(|\bEventSource\b/.test(text)) found.push(relative(src, path).split(sep).join("/"));
    }
    expect(found).toEqual([]);
  });
});
