// fsloopUI's server: `node server/main.ts [<root of projects> …] [--port=4747]`. Binds 127.0.0.1 only, reads run
// folders, writes nothing but a run's human.jsonl. Node runs this TypeScript as is (type stripping): no build step.
import { createServer, type IncomingMessage, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { dirname, join, resolve } from "node:path";
import { Readable } from "node:stream";
import { fileURLToPath } from "node:url";
import { createApp, type App } from "./http.ts";

export const HOST = "127.0.0.1";
export const DEFAULT_PORT = 4747;

function requestOf(req: IncomingMessage, origin: string): Request {
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) if (v !== undefined) headers.set(k, Array.isArray(v) ? v.join(", ") : v);
  const body = req.method === "POST" || req.method === "PUT" ? (Readable.toWeb(req) as ReadableStream<Uint8Array>) : undefined;
  return new Request(new URL(req.url ?? "/", origin), { method: req.method, headers, body, duplex: "half" } as RequestInit);
}

export async function startServer({ roots, port = DEFAULT_PORT, intervalMs }: { roots: string[]; port?: number; intervalMs?: number }): Promise<{ server: Server; url: string; runs: number; close: () => Promise<void> }> {
  const distDir = join(dirname(fileURLToPath(import.meta.url)), "..", "dist");
  // The port listens first; a request that comes before the roots are read waits for them (runtime cand-1).
  let made: (app: App) => void = () => {};
  const appReady = new Promise<App>((done) => (made = done));
  const server = createServer(async (req, res) => {
    try {
      const app = await appReady;
      const response = await app.handle(requestOf(req, `http://${HOST}:${(server.address() as AddressInfo).port}`));
      res.writeHead(response.status, Object.fromEntries(response.headers));
      if (!response.body || req.method === "HEAD") return void res.end();
      const reader = response.body.getReader();
      res.on("close", () => void reader.cancel().catch(() => {}));
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        res.write(value);
      }
      res.end();
    } catch (e) {
      console.error("fsloopUI: request failed", e);
      if (!res.headersSent) res.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
      res.end();
    }
  });
  await new Promise<void>((done, fail) => {
    server.once("error", fail);
    server.listen(port, HOST, () => done());
  });
  const url = `http://${HOST}:${(server.address() as AddressInfo).port}/`;
  await new Promise((done) => setImmediate(done));
  const app = createApp({ roots, distDir, intervalMs });
  made(app);
  return {
    server,
    url,
    runs: app.store.list().list.length,
    close: () =>
      new Promise<void>((done) => {
        app.close();
        server.closeAllConnections();
        server.close(() => done());
      }),
  };
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const portArg = args.find((a) => a.startsWith("--port="));
  const port = portArg ? Number(portArg.slice("--port=".length)) : DEFAULT_PORT;
  const roots = args.filter((a) => !a.startsWith("--"));
  const list = (roots.length ? roots : [process.cwd()]).map((r) => resolve(r));
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    console.error(`fsloopUI: --port must be a port number, got ${portArg}`);
    process.exit(4);
  }
  startServer({ roots: list, port }).then(
    ({ url, runs }) => console.log(`fsloopUI on ${url} — ${runs} run folders under ${list.join(", ")}`),
    (e) => {
      console.error(`fsloopUI: cannot listen on ${HOST}:${port} — ${e instanceof Error ? e.message : e}`);
      process.exit(1);
    },
  );
}
