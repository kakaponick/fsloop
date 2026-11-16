// The server's runtime numbers (p1-review-critic-runtime#cand-1, #cand-2), taken on a fixture root by one command:
//   node fixtures/measure.ts [<root>]   — default fixtures/root (`npm run fixtures` writes it)
// start to listening and to the first list; a normal tick and a fifth (full) tick, each with the longest stretch the
// event loop was held; /api/runs latency while the poller runs; the version moves per minute and the bytes a watching
// client re-reads from the live run at the production maximum while a Verify streams its log into the run folder (a
// write every 5 s) and its running launch and the orchestrator write their transcripts (improve-17).
import { spawn } from "node:child_process";
import { appendFileSync, mkdtempSync, readFileSync, rmSync, statSync, utimesSync, writeFileSync } from "node:fs";
import { createConnection, createServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createApp } from "../server/http.ts";
import { PROJECTS, runId } from "./make.ts";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(process.argv[2] ?? join(here, "root"));
const ms = (n: number) => `${Math.round(n)} ms`;
const quantile = (xs: number[], q: number) => [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor(q * xs.length))] ?? NaN;
const wait = (t: number) => new Promise((done) => setTimeout(done, t));

function freePort(): Promise<number> {
  return new Promise((done) => {
    const s = createServer().listen(0, "127.0.0.1", () => {
      const port = (s.address() as { port: number }).port;
      s.close(() => done(port));
    });
  });
}

const accepts = (port: number) =>
  new Promise<boolean>((done) => {
    const c = createConnection({ port, host: "127.0.0.1" }, () => {
      c.destroy();
      done(true);
    });
    c.on("error", () => done(false));
  });

/** The longest stretch the event loop was held while `work` ran: a 1 ms timer's largest gap. */
async function held(work: () => unknown): Promise<{ wall: number; block: number }> {
  let last = performance.now();
  let block = 0;
  const timer = setInterval(() => {
    const t = performance.now();
    block = Math.max(block, t - last);
    last = t;
  }, 1);
  const t0 = performance.now();
  last = t0;
  await work();
  const wall = performance.now() - t0;
  block = Math.max(block, performance.now() - last);
  clearInterval(timer);
  return { wall, block };
}

let first = 0;
const maxProject = PROJECTS.find((p) => (first += p.runs) > 40)?.name ?? "";
const maxKey = `${maxProject}/${runId(40)}`;
const maxDir = join(root, maxProject, ".claude", "fsloop", "runs", runId(40));
// The max run's session and its running launch, as fixtures/make.ts writes them.
const session = join(root, ".claude-config", "projects", maxProject, `5e55${runId(40)}-0000-4000-8000-000000000001`);
const transcripts = [`${session}.jsonl`, join(session, "subagents", `agent-a${runId(40)}u30.jsonl`)];

// ── the server as `npm start` runs it ─────────────────────────────────────────────────────────
const port = await freePort();
const t0 = performance.now();
const server = spawn(process.execPath, [join(here, "..", "server", "main.ts"), root, `--port=${port}`], { stdio: "ignore" });
while (!(await accepts(port))) await wait(5);
const listening = performance.now() - t0;
const base = `http://127.0.0.1:${port}`;
const firstList = (await (await fetch(`${base}/api/runs`)).json()) as { list: unknown[] };
const listed = performance.now() - t0;

// ── /api/runs while the poller runs (every 2 s, a full tick every 5th) ─────────────────────────
const latencies: number[] = [];
const until = performance.now() + 24_000;
while (performance.now() < until) {
  const t = performance.now();
  await (await fetch(`${base}/api/runs`)).arrayBuffer();
  latencies.push(performance.now() - t);
  await wait(25);
}

// ── a watched live run: a Verify streams into units/u31/verify.log.<n>, a write every 5 s; its running launch and
// the orchestrator write their transcripts at the same pace, the orchestrator's tokens growing ─────────────────
const events = await fetch(`${base}/api/events`);
const reader = (events.body as ReadableStream<Uint8Array>).getReader();
const decoder = new TextDecoder();
let buffer = "";
let seen: number | null = null;
let moves = 0;
let bytes = 0;
let watching = true;
const watch = (async () => {
  while (watching) {
    const { value, done } = await reader.read();
    if (done) return;
    buffer += decoder.decode(value, { stream: true });
    for (let end = buffer.indexOf("\n\n"); end >= 0; end = buffer.indexOf("\n\n")) {
      const data = /^event: tick\ndata: (.*)$/m.exec(buffer.slice(0, end));
      buffer = buffer.slice(end + 2);
      if (!data) continue;
      const v = (JSON.parse(data[1]) as { runs: Record<string, number> }).runs[maxKey];
      if (seen !== null && v !== seen) {
        moves++;
        bytes += (await (await fetch(`${base}/api/run?run=${encodeURIComponent(maxKey)}`)).arrayBuffer()).byteLength;
      }
      seen = v;
    }
  }
})();
const streamed: string[] = [];
const kept = transcripts.map((path) => ({ path, text: readFileSync(path, "utf8"), at: statSync(path).mtime }));
const usage = (k: number) => JSON.stringify({ type: "assistant", message: { id: `measure-${k}`, role: "assistant", content: [], usage: { input_tokens: 10 * k, output_tokens: 100 * k, cache_creation_input_tokens: 0, cache_read_input_tokens: 1000 * k } } }) + "\n";
const watchedFor = performance.now();
for (let k = 1; k <= 6; k++) {
  const file = join(maxDir, "units", "u31", `verify.log.${100 + k}`);
  writeFileSync(file, `line ${k}\n`);
  streamed.push(file);
  for (const t of transcripts) appendFileSync(t, usage(k));
  await wait(5_000);
}
await wait(6_000);
const watchedSeconds = (performance.now() - watchedFor) / 1000;
watching = false;
await reader.cancel().catch(() => {});
await watch.catch(() => {});
for (const f of streamed) rmSync(f, { force: true });
for (const t of kept) {
  writeFileSync(t.path, t.text);
  utimesSync(t.path, t.at, t.at);
}
const runBytes = (await (await fetch(`${base}/api/run?run=${encodeURIComponent(maxKey)}`)).arrayBuffer()).byteLength;
server.kill();

// ── ticks in process: a normal one and a full (fifth) one ─────────────────────────────────────
const dist = mkdtempSync(join(tmpdir(), "fsloopui-measure-"));
const app = createApp({ roots: [root], distDir: dist, poll: false });
await app.pulse({ full: true });
const normal: { wall: number; block: number }[] = [];
const full: { wall: number; block: number }[] = [];
for (let k = 1; k <= 10; k++) (k % 5 === 0 ? full : normal).push(await held(() => app.pulse({ full: k % 5 === 0 })));
app.close();
rmSync(dist, { recursive: true, force: true });

const median = (xs: number[]) => quantile(xs, 0.5);
console.log(`root: ${root} — ${firstList.list.length} runs`);
console.log(`start → listening ${ms(listening)} · → first /api/runs answered ${ms(listed)}`);
console.log(`normal tick: ${ms(median(normal.map((t) => t.wall)))} (loop held ${ms(median(normal.map((t) => t.block)))}) · fifth tick: ${ms(median(full.map((t) => t.wall)))} (loop held ${ms(median(full.map((t) => t.block)))})`);
console.log(`/api/runs over ${latencies.length} requests: p50 ${ms(quantile(latencies, 0.5))} · p95 ${ms(quantile(latencies, 0.95))} · max ${ms(Math.max(...latencies))}`);
console.log(`watched live run ${maxKey} (${runBytes} bytes), a launch running: 6 log and transcript writes in ${Math.round(watchedSeconds)} s → ${moves} version moves (${(moves / (watchedSeconds / 60)).toFixed(1)} per minute), ${bytes} bytes re-read`);
