#!/usr/bin/env node
// The screenshot engine (puppeteer-core over the installed Chrome) for a project with no tooling of its own (ui.md → The shot server): Serve starts
// the dev server and waits until it answers, Shoot takes one stable frame, Login saves a session, Stop
// ends what Serve started — by the pid and start time it recorded, never by a name.
import { spawn, spawnSync } from "node:child_process";
import { closeSync, existsSync, mkdirSync, openSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const USAGE = `usage:
  node shot.mjs serve --cmd "<dev server command>" --url <ready url> --pidfile <file> [--env K=V (repeat)] [--log <file>] [--cwd <dir>] [--timeout <s>]
                      --cmd runs in the platform shell (cmd.exe on Windows): set variables with --env, not K=V before the command
  node shot.mjs shoot --url <url> --out <png> [frame options]
  node shot.mjs login --url <url> --steps <steps.json> --save <state.json> [frame options]
  node shot.mjs stop  --pidfile <file>     stops only the process serve started: a pidfile empty or gone, or a pid
                                           now another process's (its start time differs), stops nothing
frame options:
  --viewport 1440x900  --full  --region <selector>  --wait <selector>  --settle <ms>  --timeout <ms>
  --theme light|dark (absent: the page's own)  --locale <tag>  --storage <state.json>  --local-storage <key>=<value> (repeat)
  --steps <steps.json | inline JSON>: [{"click": sel} | {"fill": [sel, text]} | {"select": [sel, value]} | {"press": key}
                         | {"hover": sel} | {"wait": sel} | {"goto": url}] — a text "$ENV:NAME" reads the process environment
                         (load env files with: node --env-file=<file> shot.mjs …)
shoot prints one JSON line: ok, finalUrl, status, overlay, consoleErrors, ms.
exit: 0 frame taken · 1 frame taken but suspect (another path, HTTP ≥ 400, an error overlay) · 2 failed · 3 no puppeteer-core or Chrome · 4 usage`;

const OVERLAYS = ["nextjs-portal", "vite-error-overlay", "#webpack-dev-server-client-overlay", "[data-nextjs-dialog]"];

export function parseArgs(argv) {
  const [command, ...rest] = argv;
  const opts = { command, localStorage: [], env: {} };
  for (let i = 0; i < rest.length; i++) {
    const key = rest[i];
    if (!key.startsWith("--")) throw new Error(`unexpected ${key}`);
    const name = key.slice(2);
    if (name === "full") {
      opts.full = true;
      continue;
    }
    const value = rest[++i];
    if (value === undefined) throw new Error(`${key} needs a value`);
    if (name === "local-storage") {
      const at = value.indexOf("=");
      if (at < 1) throw new Error(`--local-storage takes key=value`);
      opts.localStorage.push([value.slice(0, at), value.slice(at + 1)]);
    } else if (name === "env") {
      const at = value.indexOf("=");
      if (at < 1) throw new Error(`--env takes key=value`);
      opts.env[value.slice(0, at)] = value.slice(at + 1);
    } else opts[name.replace(/-(\w)/g, (_, c) => c.toUpperCase())] = value;
  }
  return opts;
}

export function parseViewport(text = "1440x900") {
  const m = /^(\d+)x(\d+)$/.exec(text);
  if (!m) throw new Error(`--viewport takes <width>x<height>, not ${text}`);
  return { width: Number(m[1]), height: Number(m[2]) };
}

/** Steps as written, a `$ENV:NAME` text resolved from the environment so no secret sits in the file. */
export function readSteps(path, env = process.env) {
  if (!path) return [];
  // Inline JSON keeps a recipe's steps in config.md; a file suits a long login.
  const steps = JSON.parse(path.trimStart().startsWith("[") ? path : readFileSync(path, "utf8"));
  if (!Array.isArray(steps)) throw new Error(`${path}: steps are an array`);
  const text = (v) => {
    const m = typeof v === "string" && /^\$ENV:(\w+)$/.exec(v);
    if (!m) return v;
    if (env[m[1]] === undefined) throw new Error(`${path}: ${m[1]} is not set`);
    return env[m[1]];
  };
  return steps.map((s) => Object.fromEntries(Object.entries(s).map(([k, v]) => [k, Array.isArray(v) ? v.map(text) : text(v)])));
}

/** A frame is suspect when the page is not the one asked for: a redirect elsewhere (a login wall), an error status, an overlay. */
export function suspect({ url, finalUrl, status, overlay }) {
  const reasons = [];
  if (new URL(finalUrl).pathname !== new URL(url).pathname) reasons.push(`landed on ${new URL(finalUrl).pathname}`);
  if (status >= 400) reasons.push(`HTTP ${status}`);
  if (overlay) reasons.push(`error overlay ${overlay}`);
  return reasons;
}

// puppeteer-core drives the Chrome the developer already has: no browser to download, and on Windows it
// holds where Playwright's pipe to Chrome stalled before the first page loaded (probed 2026-10-18).
function loadPuppeteer() {
  const homes = [process.cwd(), process.env.FSLOOP_HOME ?? join(homedir(), ".fsloop")];
  for (const home of homes)
    for (const name of ["puppeteer-core", "puppeteer"])
      try {
        return createRequire(join(home, "noop.js"))(name);
      } catch {}
  return null;
}

export function findChrome(env = process.env, platform = process.platform, exists = existsSync, list = safeList) {
  const local = env.LOCALAPPDATA ?? join(homedir(), "AppData", "Local");
  const system = {
    win32: [`${env.ProgramFiles ?? "C:/Program Files"}/Google/Chrome/Application/chrome.exe`, `${env["ProgramFiles(x86)"] ?? "C:/Program Files (x86)"}/Google/Chrome/Application/chrome.exe`, `${local}/Google/Chrome/Application/chrome.exe`],
    darwin: ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/Applications/Chromium.app/Contents/MacOS/Chromium"],
    linux: ["/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/usr/bin/chromium", "/usr/bin/chromium-browser"],
  }[platform] ?? [];
  // A Chromium Playwright downloaded earlier serves too.
  const cache = { win32: join(local, "ms-playwright"), linux: join(homedir(), ".cache", "ms-playwright") }[platform];
  const bin = { win32: ["chrome-win64/chrome.exe", "chrome-win/chrome.exe"], linux: ["chrome-linux64/chrome", "chrome-linux/chrome"] }[platform] ?? [];
  const cached = cache
    ? list(cache)
        .filter((d) => /^chromium-\d+$/.test(d))
        .sort((a, b) => Number(b.slice(9)) - Number(a.slice(9)))
        .flatMap((d) => bin.map((b) => join(cache, d, b)))
    : [];
  return [env.CHROME_PATH, ...system, ...cached].find((p) => p && exists(p)) ?? null;
}

function safeList(dir) {
  try {
    return readdirSync(dir);
  } catch {
    return [];
  }
}

async function frame(opts) {
  const puppeteer = loadPuppeteer();
  const chrome = findChrome();
  if (!puppeteer || !chrome) {
    console.error(
      `shot: ${!puppeteer ? `no puppeteer-core from ${process.cwd()} or ${process.env.FSLOOP_HOME ?? "~/.fsloop"} — install it once outside the repo: npm i --prefix ~/.fsloop puppeteer-core` : ""}` +
        `${!chrome ? " no Chrome found — install Google Chrome, or set CHROME_PATH" : ""}`,
    );
    return 3;
  }
  const timeout = Number(opts.timeout ?? 30000);
  const started = Date.now();
  const args = [...(process.platform === "linux" ? ["--no-sandbox"] : []), ...(opts.locale ? [`--lang=${opts.locale}`] : [])];
  const browser = await (puppeteer.default ?? puppeteer).launch({ executablePath: chrome, headless: true, args });
  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(timeout);
    page.setDefaultNavigationTimeout(timeout);
    await page.setViewport(parseViewport(opts.viewport));
    await page.emulateMediaFeatures([
      ...(opts.theme ? [{ name: "prefers-color-scheme", value: opts.theme === "dark" ? "dark" : "light" }] : []),
      { name: "prefers-reduced-motion", value: "reduce" },
    ]);
    if (opts.locale) await page.setExtraHTTPHeaders({ "Accept-Language": opts.locale });
    const cdp = await page.createCDPSession();
    const state = opts.storage && existsSync(opts.storage) ? JSON.parse(readFileSync(opts.storage, "utf8")) : null;
    if (state?.cookies?.length) await cdp.send("Network.setCookies", { cookies: state.cookies });
    const stored = [...(state?.origins ?? []).flatMap((o) => o.localStorage.map((e) => [o.origin, e.name, e.value])), ...opts.localStorage.map(([k, v]) => [null, k, v])];
    if (stored.length)
      await page.evaluateOnNewDocument((entries) => {
        for (const [origin, k, v] of entries) if (!origin || origin === location.origin) localStorage.setItem(k, v);
      }, stored);
    let consoleErrors = 0;
    page.on("console", (m) => m.type() === "error" && consoleErrors++);
    const response = await page.goto(opts.url, { waitUntil: "load" });
    for (const step of readSteps(opts.steps)) await runStep(page, step);
    if (opts.command === "login") {
      // The Playwright storageState shape, so either engine's file reads back.
      const { cookies } = await cdp.send("Network.getAllCookies");
      const origin = new URL(page.url()).origin;
      const localStorage = await page.evaluate(() => Object.entries(window.localStorage).map(([name, value]) => ({ name, value })));
      mkdirSync(dirname(resolve(opts.save)), { recursive: true });
      writeFileSync(opts.save, JSON.stringify({ cookies, origins: [{ origin, localStorage }] }, null, 2));
      console.log(JSON.stringify({ ok: true, saved: opts.save, finalUrl: page.url() }));
      return 0;
    }
    if (opts.wait) await page.waitForSelector(opts.wait);
    await settle(page, Number(opts.settle ?? 300));
    let overlay = null;
    for (const sel of OVERLAYS) if (await page.$(sel)) overlay ??= sel;
    mkdirSync(dirname(resolve(opts.out)), { recursive: true });
    if (opts.region) {
      const region = await page.$(opts.region);
      if (!region) throw new Error(`--region ${opts.region}: no such element`);
      await region.screenshot({ path: opts.out });
    } else await page.screenshot({ path: opts.out, fullPage: Boolean(opts.full) });
    const result = { url: opts.url, finalUrl: page.url(), status: response?.status() ?? 0, overlay, title: await page.title(), consoleErrors, ms: Date.now() - started };
    const reasons = suspect(result);
    console.log(JSON.stringify({ ok: !reasons.length, out: opts.out, ...result, suspect: reasons }));
    return reasons.length ? 1 : 0;
  } finally {
    await browser.close();
  }
}

async function runStep(page, step) {
  if (step.goto) await page.goto(new URL(step.goto, page.url()).href, { waitUntil: "load" });
  else if (step.click) await page.click(step.click);
  else if (step.fill) {
    await page.$eval(step.fill[0], (el) => (el.value = ""));
    await page.type(step.fill[0], step.fill[1]);
  } else if (step.select) await page.select(step.select[0], step.select[1]);
  else if (step.press) await page.keyboard.press(step.press);
  else if (step.hover) await page.hover(step.hover);
  else if (step.wait) await page.waitForSelector(step.wait);
  else throw new Error(`unknown step ${JSON.stringify(step)}`);
}

// A stable frame: requests quiet, fonts in, no motion mid-transition, a beat for late layout.
async function settle(page, ms) {
  await page.waitForNetworkIdle({ idleTime: 500, timeout: 10000 }).catch(() => {});
  await page.addStyleTag({ content: "*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}" });
  await page.evaluate(() => document.fonts.ready);
  await new Promise((r) => setTimeout(r, ms));
}

async function serve(opts) {
  if (!opts.cmd || !opts.url || !opts.pidfile) throw new Error("serve needs --cmd, --url and --pidfile");
  const log = resolve(opts.log ?? `${opts.pidfile}.log`);
  mkdirSync(dirname(log), { recursive: true });
  const fd = openSync(log, "a");
  const child = spawn(opts.cmd, {
    shell: true,
    cwd: opts.cwd ?? process.cwd(),
    env: { ...process.env, ...opts.env },
    detached: true,
    stdio: ["ignore", fd, fd],
    windowsHide: true,
  });
  closeSync(fd);
  writeFileSync(opts.pidfile, `${child.pid} ${startTime(child.pid) ?? ""}\n`);
  let exited = null;
  child.on("exit", (code) => (exited = code));
  child.unref();
  const deadline = Date.now() + Number(opts.timeout ?? 180) * 1000;
  while (Date.now() < deadline) {
    if (exited !== null) {
      console.error(`serve: the server exited ${exited} before answering — ${log}`);
      return 2;
    }
    try {
      const r = await fetch(opts.url, { redirect: "manual" });
      if (r.status < 500) {
        console.log(JSON.stringify({ ok: true, pid: child.pid, url: opts.url, status: r.status, log }));
        return 0;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 1000));
  }
  console.error(`serve: ${opts.url} did not answer in ${opts.timeout ?? 180} s — ${log}`);
  stopPid(child.pid);
  return 2;
}

function stopPid(pid) {
  if (process.platform === "win32") spawnSync("taskkill", ["/PID", String(pid), "/T", "/F"], { stdio: "ignore" });
  else
    try {
      process.kill(-pid, "SIGTERM");
    } catch {}
}

/** When the process `pid` started, as the OS reports it; null when no process has that pid. */
export function startTime(pid, platform = process.platform) {
  if (!Number.isInteger(pid) || pid <= 0) return null;
  const out = (cmd, args) => {
    const r = spawnSync(cmd, args, { encoding: "utf8", windowsHide: true });
    return r.status === 0 && r.stdout.trim() ? r.stdout.trim() : null;
  };
  if (platform === "win32")
    return out("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", `(Get-Process -Id ${pid} -ErrorAction Stop).StartTime.ToUniversalTime().ToString('o')`]);
  if (platform === "linux")
    try {
      // Field 22 of stat, counted from after the command name, which may itself hold spaces and parentheses.
      const stat = readFileSync(`/proc/${pid}/stat`, "utf8");
      return stat.slice(stat.lastIndexOf(")") + 2).split(" ")[19] ?? null;
    } catch {
      return null;
    }
  return out("ps", ["-o", "lstart=", "-p", String(pid)]);
}

function stop(opts) {
  if (!opts.pidfile) throw new Error("stop needs --pidfile");
  const [head = "", ...rest] = existsSync(opts.pidfile) ? readFileSync(opts.pidfile, "utf8").trim().split(" ") : [];
  const pid = Number(head);
  const started = rest.join(" ");
  // An ended server's pid is free for the OS to reuse: only the process with the start time Serve recorded is
  // signalled. A second stop finds no pid, and pid 0 would signal this process's own group, so nothing is sent.
  const ours = Number.isInteger(pid) && pid > 0 && started !== "" && startTime(pid) === started;
  if (ours) stopPid(pid);
  rmSync(opts.pidfile, { force: true });
  console.log(JSON.stringify({ ok: true, stopped: ours ? pid : null, ...(pid > 0 && !ours ? { gone: pid } : {}) }));
  return 0;
}

export async function main(argv) {
  let opts;
  try {
    opts = parseArgs(argv);
    if (opts.command === "serve") return await serve(opts);
    if (opts.command === "stop") return stop(opts);
    if (opts.command === "shoot" && opts.url && opts.out) return await frame(opts);
    if (opts.command === "login" && opts.url && opts.steps && opts.save) return await frame(opts);
  } catch (e) {
    if (!opts) {
      console.error(`${e.message}\n${USAGE}`);
      return 4;
    }
    console.error(`shot: ${e.message}`);
    return 2;
  }
  console.error(USAGE);
  return 4;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = await main(process.argv.slice(2));
