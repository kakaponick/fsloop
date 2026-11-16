import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, test } from "vitest";
import { criticReport, writeRun } from "../fixtures/make.ts";
import { createApp } from "./http.ts";

const NOW = Date.parse("2026-11-16T10:00:00Z");
const temp = mkdtempSync(join(tmpdir(), "fsloopui-http-"));
const root = join(temp, "projects");
const runs = join(root, "app", ".claude", "fsloop", "runs");
const dist = join(temp, "dist");
mkdirSync(join(dist, "assets"), { recursive: true });
writeFileSync(join(dist, "index.html"), "<!doctype html><title>fsloopUI</title>");
writeFileSync(join(dist, "assets", "app.js"), "console.log(1)");
writeFileSync(join(temp, "secret.txt"), "not served");

const OPEN = "0pen0001";
const CLOSED = "c1053d01";
writeRun(join(runs, OPEN), {
  id: OPEN,
  mtime: NOW,
  now: NOW,
  record: true,
  launches: [{ id: "p1-map-craft-shell", stage: "p1-map", agent: "fsloop-critic", description: "craft shell", report: criticReport({ lens: "craft assess", findings: ["craft-1 [craft] major high local src/shell.tsx:3 — ux 2 — the frame p1-baseline-shell- clips the toolbar — /impeccable adapt: wrap it."] }) }],
  shots: ["p1-baseline-shell-1440-light.png"],
});
writeRun(join(runs, CLOSED), { id: CLOSED, mtime: NOW, now: NOW, record: true, gates: ["integrate", "finish"].map((stage) => ({ stage, green: true, at: "2026-11-16T09:00:00Z" })) });

const app = createApp({ roots: [root], distDir: dist, intervalMs: 20 });
afterAll(() => {
  app.close();
  rmSync(temp, { recursive: true, force: true });
});
const get = (path: string) => app.handle(new Request(`http://127.0.0.1:4747${path}`));

describe("handle — the API", () => {
  test("/api/runs lists the cards with the list's version", async () => {
    const res = await get("/api/runs");
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const body = await res.json();
    expect(typeof body.version).toBe("number");
    // By key; the sidebar places them by its own held order.
    expect(body.list.map((c: { key: string }) => c.key)).toEqual([`app/${OPEN}`, `app/${CLOSED}`]);
    // The roots the server reads, named in the empty-root and not-found texts.
    expect(body.roots).toEqual([root]);
  });

  test("/api/run gives one run's model; an unknown key is a 404 in Russian", async () => {
    const res = await get(`/api/run?run=${encodeURIComponent(`app/${OPEN}`)}`);
    expect(res.status).toBe(200);
    const run = await res.json();
    expect(run).toMatchObject({ key: `app/${OPEN}`, project: "app", id: OPEN });
    expect(typeof run.version).toBe("number");
    expect(run.findings).toHaveLength(1);
    const missing = await get(`/api/run?run=app/nope`);
    expect(missing.status).toBe(404);
    expect(await missing.json()).toEqual({ error: "Прогон app/nope не найден" });
  });

  test("/api/frame serves a frame of the run and refuses any other name", async () => {
    const ok = await get(`/api/frame?run=app/${OPEN}&name=p1-baseline-shell-1440-light.png`);
    expect(ok.status).toBe(200);
    expect(ok.headers.get("content-type")).toBe("image/png");
    expect([...new Uint8Array(await ok.arrayBuffer()).slice(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47]);
    for (const name of ["../run.json", "..%2F..%2Fsecret.txt", "p1.png/../../run.json", "run.json", "a b.png"]) expect((await get(`/api/frame?run=app/${OPEN}&name=${name}`)).status).toBe(400);
    expect((await get(`/api/frame?run=app/nope&name=p1-baseline-shell-1440-light.png`)).status).toBe(404);
    expect((await get(`/api/frame?run=app/${OPEN}&name=p9-none.png`)).status).toBe(404);
  });

  test("/api/events sends a tick at once, then one after a file of the run changes", async () => {
    const res = await get("/api/events");
    expect(res.headers.get("content-type")).toBe("text/event-stream");
    const reader = (res.body as ReadableStream<Uint8Array>).getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    const nextTick = async (): Promise<{ list: number; runs: Record<string, number> }> => {
      for (;;) {
        const end = buffer.indexOf("\n\n");
        if (end >= 0) {
          const message = buffer.slice(0, end);
          buffer = buffer.slice(end + 2);
          const data = /^event: tick\ndata: (.*)$/m.exec(message);
          if (data) return JSON.parse(data[1]);
          continue;
        }
        const { value, done } = await reader.read();
        if (done) throw new Error("stream ended");
        buffer += decoder.decode(value, { stream: true });
      }
    };
    const first = await nextTick();
    expect(first.runs).toHaveProperty(`app/${OPEN}`);
    expect(typeof first.list).toBe("number");
    writeFileSync(join(runs, OPEN, "journal.md"), "| # | stage | question | decision | why | refs |\n|---|---|---|---|---|---|\n| 1 | p1-map | Route? | worktree | many pages | — |\n");
    let next = await nextTick();
    while (next.runs[`app/${OPEN}`] === first.runs[`app/${OPEN}`]) next = await nextTick();
    expect(next.runs[`app/${OPEN}`]).toBeGreaterThan(first.runs[`app/${OPEN}`]);
    expect(next.runs[`app/${CLOSED}`]).toBe(first.runs[`app/${CLOSED}`]);
    await reader.cancel();
  });

  test("an unknown API path is a 404, a wrong method a 405", async () => {
    expect((await get("/api/nothing")).status).toBe(404);
    expect((await app.handle(new Request("http://127.0.0.1:4747/api/runs", { method: "DELETE" }))).status).toBe(405);
  });
});

describe("handle — the built client", () => {
  test("serves its files and falls back to index.html for the client's routes", async () => {
    const index = await get("/");
    expect(index.headers.get("content-type")).toBe("text/html; charset=utf-8");
    expect(await index.text()).toContain("<title>fsloopUI</title>");
    const js = await get("/assets/app.js");
    expect(js.headers.get("content-type")).toBe("text/javascript; charset=utf-8");
    expect(await (await get("/app/0pen0001?view=findings")).text()).toContain("<title>fsloopUI</title>");
  });

  test("never serves a file outside the client's folder", async () => {
    const res = await get("/..%2Fsecret.txt");
    expect(await res.text()).not.toContain("not served");
  });
});
