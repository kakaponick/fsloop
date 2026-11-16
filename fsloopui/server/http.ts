// The HTTP handler of fsloopUI: a web Request in, a Response out — the run list, one run, the live tick stream,
// frames, the verdict write and the built client. main.ts puts it behind node:http on 127.0.0.1.
import { existsSync, readFileSync, statSync } from "node:fs";
import { extname, join, resolve, sep } from "node:path";
import { HUMAN_VERDICTS } from "../../skills/fsloop/fsl.mjs";
import { VERDICT, type Verdict } from "../shared/states.ts";
import type { Git } from "./run.ts";
import { createStore } from "./store.ts";
import { appendVerdict, isVerdict } from "./verdict.ts";

export interface AppOptions {
  /** Roots of projects, projects or run folders. */
  roots: string[];
  /** The built client (dist/). */
  distDir: string;
  /** How often open runs are checked for changes; every fifth check also finds new runs and checks closed ones. */
  intervalMs?: number;
  now?: () => number;
  git?: Git;
}

/** A frame's file name: no folder, no traversal — the run is looked up by key, never joined into a path. */
export const FRAME_NAME = /^[A-Za-z0-9._-]+\.png$/;
const NOTE_MAX = 4000;

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".map": "application/json; charset=utf-8",
};

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
const isFile = (p: string) => {
  try {
    return statSync(p).isFile();
  } catch {
    return false;
  }
};
const notFound = (key: string) => json(404, { error: `Прогон ${key} не найден` });

const ROUTES: Record<string, string> = { "/api/runs": "GET", "/api/run": "GET", "/api/events": "GET", "/api/frame": "GET", "/api/verdict": "POST" };

export function createApp({ roots, distDir, intervalMs = 2000, now = Date.now, git }: AppOptions) {
  const store = createStore({ roots, git });
  store.refresh({ full: true });
  const encoder = new TextEncoder();
  const clients = new Set<ReadableStreamDefaultController<Uint8Array>>();
  const tick = () => encoder.encode(`event: tick\ndata: ${JSON.stringify(store.versions())}\n\n`);
  let sent = JSON.stringify(store.versions());
  const send = (bytes: Uint8Array) => {
    for (const c of clients)
      try {
        c.enqueue(bytes);
      } catch {
        clients.delete(c);
      }
  };
  /** A tick to every client when a version moved since the last one sent. */
  const broadcast = () => {
    const v = JSON.stringify(store.versions());
    if (v === sent) return;
    sent = v;
    send(tick());
  };

  let n = 0;
  const timer = setInterval(() => {
    try {
      store.refresh({ full: ++n % 5 === 0 });
    } catch (e) {
      console.error("fsloopUI: refresh failed", e);
    }
    broadcast();
  }, intervalMs);
  // A comment line keeps proxies from closing a quiet stream.
  const keepAlive = setInterval(() => send(encoder.encode(": ping\n\n")), 15_000);
  timer.unref?.();
  keepAlive.unref?.();

  function events(): Response {
    let self: ReadableStreamDefaultController<Uint8Array>;
    const stream = new ReadableStream<Uint8Array>({
      start(c) {
        self = c;
        clients.add(c);
        c.enqueue(encoder.encode("retry: 2000\n\n"));
        c.enqueue(tick());
      },
      cancel() {
        clients.delete(self);
      },
    });
    return new Response(stream, { headers: { "content-type": "text/event-stream", "cache-control": "no-store", connection: "keep-alive" } });
  }

  function frame(url: URL): Response {
    const key = url.searchParams.get("run") ?? "";
    const name = url.searchParams.get("name") ?? "";
    if (!FRAME_NAME.test(name)) return json(400, { error: "Недопустимое имя кадра" });
    const dir = store.dirOf(key);
    if (!dir) return notFound(key);
    const path = join(dir, "shots", name);
    if (!isFile(path)) return json(404, { error: `Кадр ${name} не найден` });
    return new Response(readFileSync(path), { headers: { "content-type": "image/png", "cache-control": "no-cache" } });
  }

  async function verdict(req: Request): Promise<Response> {
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return json(400, { error: "Тело запроса — не JSON" });
    }
    const key = String(body?.run ?? "");
    const run = store.run(key);
    if (!run) return notFound(key);
    if (!isVerdict(body.verdict)) return json(400, { error: `Оценка ${String(body.verdict)} неизвестна: ${(HUMAN_VERDICTS as Verdict[]).map((v) => VERDICT[v].compact).join(", ")}` });
    const finding = String(body.finding ?? "");
    if (!run.findings.some((f) => f.id === finding)) return json(404, { error: `Находка ${finding} не найдена в прогоне ${key}` });
    const note = body.note ?? null;
    if (note !== null && (typeof note !== "string" || note.length > NOTE_MAX)) return json(400, { error: `Заметка — текст не длиннее ${NOTE_MAX} символов` });
    try {
      const saved = appendVerdict(run.dir, { finding, verdict: body.verdict, note }, new Date(now()).toISOString());
      store.touch(key);
      broadcast();
      return json(200, { verdict: saved });
    } catch (e) {
      return json(500, { error: `Оценка не сохранилась: ${e instanceof Error ? e.message : String(e)}` });
    }
  }

  function client(url: URL): Response {
    let rel = "/";
    try {
      rel = decodeURIComponent(url.pathname);
    } catch {}
    const root = resolve(distDir);
    const file = resolve(root, `.${rel}`);
    const target = file.startsWith(root + sep) && isFile(file) ? file : join(root, "index.html");
    if (!existsSync(target)) return new Response("fsloopUI: the client is not built — run `npm run build` in fsloopui/", { status: 503, headers: { "content-type": "text/plain; charset=utf-8" } });
    return new Response(readFileSync(target), { headers: { "content-type": TYPES[extname(target)] ?? "application/octet-stream", "cache-control": target.endsWith("index.html") ? "no-cache" : "public, max-age=31536000, immutable" } });
  }

  async function handle(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const method = ROUTES[url.pathname];
    if (url.pathname.startsWith("/api/")) {
      if (!method) return json(404, { error: `Нет такого адреса: ${url.pathname}` });
      if (req.method !== method) return json(405, { error: `Метод ${req.method} не поддерживается` });
      // The roots go with the list: the empty-root and not-found texts name them.
      if (url.pathname === "/api/runs") return json(200, { ...store.list(), roots: roots.map((r) => resolve(r)) });
      if (url.pathname === "/api/run") {
        const key = url.searchParams.get("run") ?? "";
        const run = store.run(key);
        return run ? json(200, run) : notFound(key);
      }
      if (url.pathname === "/api/events") return events();
      if (url.pathname === "/api/frame") return frame(url);
      return verdict(req);
    }
    if (req.method !== "GET" && req.method !== "HEAD") return new Response(null, { status: 405 });
    return client(url);
  }

  function close() {
    clearInterval(timer);
    clearInterval(keepAlive);
    for (const c of clients)
      try {
        c.close();
      } catch {}
    clients.clear();
  }

  return { handle, close, store };
}

export type App = ReturnType<typeof createApp>;
