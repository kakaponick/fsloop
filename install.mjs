#!/usr/bin/env node
import { appendFileSync, cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const target = resolve(process.argv[2] ?? process.cwd());
if (!existsSync(join(target, ".git"))) {
  console.error(`install: ${target} is not a git repo root\nusage: node install.mjs <repo>`);
  process.exit(64);
}
const src = join(dirname(fileURLToPath(import.meta.url)), "claude");
const claude = join(target, ".claude");

// The skill's own tests stay here: a project's runner would pick them up as its own.
cpSync(src, claude, { recursive: true, filter: (path) => !path.endsWith(".test.mjs") });
console.log(`copied skill, agents, hooks → ${claude}`);

const settingsPath = join(claude, "settings.json");
const settings = existsSync(settingsPath) ? JSON.parse(readFileSync(settingsPath, "utf8")) : {};
const command = 'node "$CLAUDE_PROJECT_DIR/.claude/hooks/spike-guard.mjs"';
const pre = ((settings.hooks ??= {}).PreToolUse ??= []);
if (!JSON.stringify(pre).includes("spike-guard.mjs")) {
  pre.push({ matcher: "Bash|PowerShell", hooks: [{ type: "command", command }] });
  writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + "\n");
  console.log(`added spike-guard hook → ${settingsPath}`);
}

const gitignore = join(target, ".gitignore");
const ignored = existsSync(gitignore) ? readFileSync(gitignore, "utf8") : "";
if (!/^\/?\.spike\/?$/m.test(ignored)) {
  appendFileSync(gitignore, `${ignored && !ignored.endsWith("\n") ? "\n" : ""}.spike/\n`);
  console.log("added .spike/ → .gitignore");
}

const gitPath = spawnSync("git", ["-C", target, "rev-parse", "--git-path", "info/exclude"], { encoding: "utf8" });
if (gitPath.status === 0) {
  const rel = gitPath.stdout.trim();
  const exclude = isAbsolute(rel) ? rel : join(target, rel);
  // The run folders stay out of git; the config file is the project's and is committed.
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

if (existsSync(join(claude, "fsloop.md")) && !existsSync(join(claude, "fsloop", "config.md")))
  console.log("move the config file: git mv .claude/fsloop.md .claude/fsloop/config.md — fsloop reads it only there");

const spike = join(target, ".spike");
for (const d of ["data", "sessions", "toolkits"]) mkdirSync(join(spike, d), { recursive: true });
const readme = join(spike, "README.md");
if (!existsSync(readme)) {
  writeFileSync(
    readme,
    `# .spike

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
