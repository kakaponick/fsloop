#!/usr/bin/env node
import { appendFileSync, existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, realpathSync, renameSync, symlinkSync, unlinkSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const USAGE = "usage: node install.mjs [<repo>] [--claude-dir <dir>]";
const root = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const flag = args.indexOf("--claude-dir");
const claude = resolve(flag >= 0 ? args.splice(flag, 2)[1] : join(homedir(), ".claude"));
const target = args[0] ? resolve(args[0]) : null;

if (target && !existsSync(join(target, ".git"))) fail(`${target} is not a git repo root\n${USAGE}`, 64);

const LINKS = [
  ["skills/fsloop", "skills/fsloop"],
  ["skills/fsloop-audit", "skills/fsloop-audit"],
  ["agents", "agents/fsloop"],
  ["hooks", "hooks/fsloop"],
];
const agents = readdirSync(join(root, "agents")).filter((f) => f.endsWith(".md"));

function fail(message, code = 1) {
  console.error(`install: ${message}`);
  process.exit(code);
}

const samePath = (a, b) => {
  const norm = (p) => realpathSync(p).replace(/[\\/]+$/, "");
  return process.platform === "win32" ? norm(a).toLowerCase() === norm(b).toLowerCase() : norm(a) === norm(b);
};

function link(from, to) {
  let stat = null;
  try {
    stat = lstatSync(to);
  } catch {}
  if (stat?.isSymbolicLink()) {
    if (existsSync(to) && samePath(to, from)) return `kept ${to}`;
    unlinkSync(to);
  } else if (stat) {
    fail(`${to} is a real ${stat.isDirectory() ? "folder" : "file"}, not a link — move it away and run again`);
  }
  mkdirSync(dirname(to), { recursive: true });
  symlinkSync(from, to, "junction");
  return `linked ${to} → ${from}`;
}

for (const [from, to] of LINKS) console.log(link(join(root, from), join(claude, to)));

for (const name of agents)
  if (existsSync(join(claude, "agents", name))) console.log(`warning: ${join(claude, "agents", name)} is a second ${name} — remove it, agents/fsloop/ holds the one fsloop uses`);

const forward = (p) => p.replaceAll("\\", "/");
const guard = forward(join(claude, "hooks", "fsloop", "spike-guard.mjs"));
const settingsPath = join(claude, "settings.json");
const settingsText = existsSync(settingsPath) ? readFileSync(settingsPath, "utf8") : "{}";
let settings;
try {
  settings = JSON.parse(settingsText);
} catch (e) {
  fail(`${settingsPath} is not plain JSON (${e.message}) — add the spike-guard hook by hand: node "${guard}"`);
}
const pre = ((settings.hooks ??= {}).PreToolUse ??= []);
if (!pre.some((entry) => (entry.hooks ?? []).some((h) => forward(h.command ?? "").includes(guard)))) {
  pre.push({ matcher: "Bash|PowerShell", hooks: [{ type: "command", command: `node "${guard}"` }] });
  const eol = settingsText.includes("\r\n") ? "\r\n" : "\n";
  writeFileSync(settingsPath, JSON.stringify(settings, null, 2).replaceAll("\n", eol) + eol);
  console.log(`added the spike-guard hook → ${settingsPath}`);
}

if (target) setUpRepo(target);

function worktrees(repo) {
  const r = spawnSync("git", ["-C", repo, "worktree", "list", "--porcelain"], { encoding: "utf8" });
  if (r.status !== 0) return [];
  const self = realpathSync.native(repo).toLowerCase();
  return r.stdout
    .split(/\r?\n/)
    .filter((l) => l.startsWith("worktree "))
    .map((l) => resolve(l.slice("worktree ".length)))
    .filter((p) => !existsSync(p) || realpathSync.native(p).toLowerCase() !== self);
}

function moveLegacySpike(repo, spike) {
  const legacy = join(repo, ".spike");
  if (!existsSync(legacy) || lstatSync(legacy).isSymbolicLink()) return;
  if (existsSync(spike)) return console.log(`warning: both ${legacy} and ${spike} exist — merge them by hand, fsloop reads only ${spike}`);
  const sessions = join(legacy, "sessions");
  const held = existsSync(sessions) ? readdirSync(sessions).filter((n) => existsSync(join(sessions, n, ".lease"))) : [];
  if (held.length) fail(`${legacy} has leased sessions (${held.join(", ")}) — release them, then run again`);
  const mirrored = worktrees(repo).filter((wt) => existsSync(join(wt, ".spike")));
  if (mirrored.length) fail(`${mirrored.map((wt) => join(wt, ".spike")).join(", ")} mirror ${legacy} — take each down with the project's own spike-lease.mjs unlink <worktree>, then run again`);
  mkdirSync(dirname(spike), { recursive: true });
  renameSync(legacy, spike);
  console.log(`moved ${legacy} → ${spike}`);
}

function setUpRepo(repo) {
  const spike = join(repo, ".claude", "fsloop", "spike");
  moveLegacySpike(repo, spike);

  const gitignore = join(repo, ".gitignore");
  const ignored = existsSync(gitignore) ? readFileSync(gitignore, "utf8") : "";
  if (!/^\/?\.claude\/fsloop\/spike\/?$/m.test(ignored)) {
    appendFileSync(gitignore, `${ignored && !ignored.endsWith("\n") ? "\n" : ""}.claude/fsloop/spike/\n`);
    console.log("added .claude/fsloop/spike/ → .gitignore");
  }

  const gitPath = spawnSync("git", ["-C", repo, "rev-parse", "--git-path", "info/exclude"], { encoding: "utf8" });
  if (gitPath.status === 0) {
    const rel = gitPath.stdout.trim();
    const exclude = isAbsolute(rel) ? rel : join(repo, rel);
    const lines = (existsSync(exclude) ? readFileSync(exclude, "utf8") : "").split(/\r?\n/);
    const kept = lines.filter((l) => !/^\/?\.claude\/fsloop\/?$/.test(l.trim()));
    const want = [".claude/fsloop/*", "!.claude/fsloop/config.md"];
    const missing = want.filter((w) => !kept.some((l) => l.trim() === w));
    if (missing.length || kept.length !== lines.length) {
      while (kept.length && !kept.at(-1).trim()) kept.pop();
      mkdirSync(dirname(exclude), { recursive: true });
      writeFileSync(exclude, [...kept, ...missing].join("\n") + "\n");
      console.log(`.git/info/exclude: ${want.join(", ")}`);
    }
  }

  const local = join(repo, ".claude");
  if (existsSync(join(local, "fsloop.md")) && !existsSync(join(local, "fsloop", "config.md")))
    console.log("move the config file: git mv .claude/fsloop.md .claude/fsloop/config.md — fsloop reads it only there");

  const copies = [
    join(local, "skills", "fsloop"),
    join(local, "skills", "fsloop-audit"),
    ...agents.map((name) => join(local, "agents", name)),
    ...["spike-guard.mjs", "shell-text.mjs"].map((name) => join(local, "hooks", name)),
  ].filter((p) => existsSync(p));
  const projectSettings = join(local, "settings.json");
  if (existsSync(projectSettings) && readFileSync(projectSettings, "utf8").includes(".claude/hooks/spike-guard.mjs")) copies.push(`${projectSettings} → its spike-guard hook`);
  if (copies.length) console.log(`warning: the project keeps its own fsloop — remove it so the global one runs alone:\n${copies.map((p) => `  ${p}`).join("\n")}`);

  const rules = join(local, "rules");
  const notes = [join(repo, "CLAUDE.md"), ...(existsSync(rules) ? readdirSync(rules).map((f) => join(rules, f)) : [])].filter(
    (p) => existsSync(p) && lstatSync(p).isFile() && /(^|[^\w/])\.spike\b/.test(readFileSync(p, "utf8")),
  );
  if (notes.length) console.log(`warning: these still name .spike/ — point them at .claude/fsloop/spike/:\n${notes.map((p) => `  ${p}`).join("\n")}`);

  const config = join(local, "fsloop", "config.md");
  if (existsSync(config) && readFileSync(config, "utf8").includes(".claude/skills/fsloop/"))
    console.log(`warning: a path into the project's own skill copy — write <start>/.claude/skills/fsloop/ as <skill>/ in:\n  ${config}`);

  for (const d of ["data", "sessions", "toolkits"]) mkdirSync(join(spike, d), { recursive: true });
  const readme = join(spike, "README.md");
  if (!existsSync(readme)) {
    writeFileSync(
      readme,
      `# .claude/fsloop/spike

Research workspace for /fsloop and /fsloop spike. Never committed.

- \`data/\` — proxies, samples, exports: what each file is.
- \`sessions/<name>/\` — one folder per account: what opens it (session string, cookies, 2FA).
- \`toolkits/<topic>/\` — written by spike-researcher.

## Limits

none
`,
    );
    console.log(`created ${readme} — describe your resources and limits there`);
  }
}
