import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { homedir, tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { after, before, describe, test } from "node:test";
import { fileURLToPath } from "node:url";

import { findChrome, parseArgs, parseViewport, readSteps, suspect } from "./shot.mjs";

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), "shot.mjs");

describe("arguments", () => {
  test("flags, repeated local storage and camel-cased names", () => {
    assert.deepEqual(parseArgs(["shoot", "--url", "http://x/a", "--out", "a.png", "--full", "--local-storage", "theme=dark", "--local-storage", "k=a=b"]), {
      command: "shoot",
      url: "http://x/a",
      out: "a.png",
      full: true,
      localStorage: [["theme", "dark"], ["k", "a=b"]],
      env: {},
    });
    assert.equal(parseArgs(["serve", "--cmd", "npm run dev", "--pidfile", "p"]).cmd, "npm run dev");
    assert.deepEqual(parseArgs(["serve", "--env", "PORT=4100", "--env", "DATABASE_URL=postgres://x/db_shots"]).env, { PORT: "4100", DATABASE_URL: "postgres://x/db_shots" });
    assert.throws(() => parseArgs(["shoot", "--url"]), /--url needs a value/);
  });

  test("a viewport is <width>x<height>", () => {
    assert.deepEqual(parseViewport(), { width: 1440, height: 900 });
    assert.deepEqual(parseViewport("390x844"), { width: 390, height: 844 });
    assert.throws(() => parseViewport("wide"), /<width>x<height>/);
  });

  test("a step's $ENV: text comes from the environment, so the file holds no secret", () => {
    const dir = mkdtempSync(join(tmpdir(), "shot-"));
    const path = join(dir, "steps.json");
    writeFileSync(path, JSON.stringify([{ fill: ["#password", "$ENV:SHOT_PASSWORD"] }, { click: "button[type=submit]" }]));
    assert.deepEqual(readSteps(path, { SHOT_PASSWORD: "s3cret" }), [{ fill: ["#password", "s3cret"] }, { click: "button[type=submit]" }]);
    assert.throws(() => readSteps(path, {}), /SHOT_PASSWORD is not set/);
    rmSync(dir, { recursive: true, force: true });
  });

  test("a frame of another page than the one asked for is suspect", () => {
    assert.deepEqual(suspect({ url: "http://x/accounts", finalUrl: "http://x/accounts?tab=1", status: 200, overlay: null }), []);
    assert.deepEqual(suspect({ url: "http://x/accounts", finalUrl: "http://x/login?next=%2Faccounts", status: 200, overlay: null }), ["landed on /login"]);
    assert.deepEqual(suspect({ url: "http://x/a", finalUrl: "http://x/a", status: 500, overlay: "nextjs-portal" }), ["HTTP 500", "error overlay nextjs-portal"]);
  });
});

describe("stop", () => {
  test("an empty or missing pidfile stops nothing — pid 0 would signal fsloop's own process group", () => {
    const dir = mkdtempSync(join(tmpdir(), "shot-stop-"));
    writeFileSync(join(dir, "p.pid"), "");
    for (let i = 0; i < 2; i++) {
      const r = spawnSync(process.execPath, [SCRIPT, "stop", "--pidfile", join(dir, "p.pid")], { encoding: "utf8" });
      assert.equal(r.status, 0);
      assert.deepEqual(JSON.parse(r.stdout), { ok: true, stopped: null });
    }
    assert.equal(existsSync(join(dir, "p.pid")), false);
    rmSync(dir, { recursive: true, force: true });
  });
});

describe("the browser", () => {
  test("CHROME_PATH first, then the system Chrome, then the newest Chromium Playwright left behind", () => {
    const has = (...paths) => (p) => paths.includes(p);
    assert.equal(findChrome({ CHROME_PATH: "/opt/c" }, "linux", has("/opt/c", "/usr/bin/chromium"), () => []), "/opt/c");
    assert.equal(findChrome({}, "linux", has("/usr/bin/chromium"), () => []), "/usr/bin/chromium");
    const cache = join(homedir(), ".cache", "ms-playwright");
    const newest = join(cache, "chromium-1243", "chrome-linux64", "chrome");
    assert.equal(findChrome({}, "linux", has(newest, join(cache, "chromium-1187", "chrome-linux64", "chrome")), () => ["chromium-1187", "chromium_headless_shell-1243", "chromium-1243"]), newest);
    assert.equal(findChrome({}, "linux", () => false, () => []), null);
  });
});

// The real thing needs a browser: it runs where puppeteer-core resolves (the project, or FSLOOP_HOME) and Chrome is found.
const home = process.env.FSLOOP_HOME ?? join(homedir(), ".fsloop");
const hasEngine =
  findChrome() !== null &&
  [process.cwd(), home].some((h) => {
    try {
      createRequire(join(h, "noop.js")).resolve("puppeteer-core");
      return true;
    } catch {
      return false;
    }
  });

describe("against a live server", { skip: !hasEngine && "no puppeteer-core or Chrome — set FSLOOP_HOME" }, () => {
  let dir;
  const port = 40000 + Math.floor(Math.random() * 20000);
  const base = `http://127.0.0.1:${port}`;
  const run = (...args) => spawnSync(process.execPath, [SCRIPT, ...args], { encoding: "utf8", cwd: dir, env: process.env, timeout: 120000 });

  before(() => {
    dir = mkdtempSync(join(tmpdir(), "shot-live-"));
    // A page behind a cookie login, with a dialog a step opens.
    writeFileSync(
      join(dir, "server.mjs"),
      `import { createServer } from "node:http";
const page = (body) => "<!doctype html><html><body style='font:16px sans-serif'>" + body + "</body></html>";
createServer((req, res) => {
  const authed = (req.headers.cookie ?? "").includes("session=ok");
  if (req.url.startsWith("/login")) {
    res.setHeader("content-type", "text/html");
    return res.end(page("<form onsubmit=\\"document.cookie='session=ok; path=/'; location='/accounts'; return false\\"><input id=user><button>Sign in</button></form>"));
  }
  if (!authed) { res.statusCode = 302; res.setHeader("location", "/login?next=" + encodeURIComponent(req.url)); return res.end(); }
  res.setHeader("content-type", "text/html");
  res.end(page("<h1>Accounts</h1><table id=t><tr><td>a1</td></tr></table><button id=open onclick=\\"d.showModal()\\">Delete</button><dialog id=d><p>Delete a1?</p></dialog>"));
}).listen(${port});`,
    );
    writeFileSync(join(dir, "login.json"), JSON.stringify([{ fill: ["#user", "$ENV:SHOT_USER"] }, { click: "button" }, { wait: "h1" }]));
    writeFileSync(join(dir, "open.json"), JSON.stringify([{ click: "#open" }, { wait: "dialog[open]" }]));
  });

  after(() => {
    run("stop", "--pidfile", join(dir, "server.pid"));
    rmSync(dir, { recursive: true, force: true });
  });

  test("serve, a login wall flagged, a saved session, a dialog by steps, a region, stop", () => {
    const served = run("serve", "--cmd", `"${process.execPath}" server.mjs`, "--url", `${base}/login`, "--pidfile", join(dir, "server.pid"), "--timeout", "30");
    assert.equal(served.status, 0, served.stderr);

    const walled = run("shoot", "--url", `${base}/accounts`, "--out", join(dir, "wall.png"));
    assert.equal(walled.status, 1, walled.stderr);
    assert.deepEqual(JSON.parse(walled.stdout).suspect, ["landed on /login"]);

    process.env.SHOT_USER = "demo";
    const login = run("login", "--url", `${base}/login`, "--steps", join(dir, "login.json"), "--save", join(dir, "auth", "state.json"));
    assert.equal(login.status, 0, login.stderr);
    assert.match(readFileSync(join(dir, "auth", "state.json"), "utf8"), /session/);

    const shot = run("shoot", "--url", `${base}/accounts`, "--out", join(dir, "dialog.png"), "--storage", join(dir, "auth", "state.json"), "--steps", join(dir, "open.json"), "--theme", "dark");
    assert.equal(shot.status, 0, shot.stderr);
    const result = JSON.parse(shot.stdout);
    assert.equal(result.ok, true);
    assert.equal(result.title, "");
    assert.ok(statSync(join(dir, "dialog.png")).size > 1000);

    const region = run("shoot", "--url", `${base}/accounts`, "--out", join(dir, "table.png"), "--storage", join(dir, "auth", "state.json"), "--region", "#t");
    assert.equal(region.status, 0, region.stderr);
    assert.ok(statSync(join(dir, "table.png")).size < statSync(join(dir, "dialog.png")).size, "a region frame is the region alone");

    const stopped = run("stop", "--pidfile", join(dir, "server.pid"));
    assert.equal(stopped.status, 0);
    assert.ok(JSON.parse(stopped.stdout).stopped > 0);
    assert.equal(existsSync(join(dir, "server.pid")), false);
    assert.equal(JSON.parse(run("stop", "--pidfile", join(dir, "server.pid")).stdout).stopped, null, "a second stop sends nothing");
  });
});
