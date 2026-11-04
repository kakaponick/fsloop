import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, test } from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(ROOT, "install.mjs");

let tmp;
let claude;

const install = (...args) => spawnSync(process.execPath, [SCRIPT, ...args, "--claude-dir", claude], { encoding: "utf8" });
const real = (p) => realpathSync(p).toLowerCase();
const isLink = (p) => {
  try {
    return lstatSync(p).isSymbolicLink();
  } catch {
    return false;
  }
};
const guards = () => JSON.parse(readFileSync(join(claude, "settings.json"), "utf8")).hooks.PreToolUse.filter((e) => e.hooks.some((h) => h.command.includes("spike-guard.mjs")));

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), "fsloop-install-"));
  claude = join(tmp, "claude");
});

afterEach(() => {
  for (const link of ["skills/fsloop", "agents/fsloop", "hooks/fsloop"]) if (isLink(join(claude, link))) unlinkSync(join(claude, link));
  rmSync(tmp, { recursive: true, force: true });
});

describe("install", () => {
  test("links the skill, the agents and the hooks into the Claude directory and adds the guard once", () => {
    mkdirSync(claude, { recursive: true });
    writeFileSync(join(claude, "settings.json"),'{\r\n  "env": {\r\n    "A": "1"\r\n  }\r\n}\r\n');
    for (let run = 0; run < 2; run++) assert.equal(install().status, 0);
    assert.equal(real(join(claude, "skills", "fsloop")), real(join(ROOT, "skills", "fsloop")));
    assert.equal(real(join(claude, "agents", "fsloop")), real(join(ROOT, "agents")));
    assert.ok(existsSync(join(claude, "agents", "fsloop", "fsloop-critic.md")));
    assert.ok(existsSync(join(claude, "hooks", "fsloop", "spike-guard.mjs")));
    const text = readFileSync(join(claude, "settings.json"), "utf8");
    assert.equal(JSON.parse(text).env.A, "1");
    assert.ok(!/[^\r]\n/.test(text), "the settings file keeps its CRLF");
    assert.equal(guards().length, 1);
    assert.match(guards()[0].hooks[0].command, /^node ".*\/hooks\/fsloop\/spike-guard\.mjs"$/);
  });

  test("a link pointing elsewhere is moved to this checkout", () => {
    const elsewhere = join(tmp, "old-skill");
    mkdirSync(elsewhere);
    mkdirSync(join(claude, "skills"), { recursive: true });
    spawnSync(process.execPath, ["-e", `require("fs").symlinkSync(${JSON.stringify(elsewhere)}, ${JSON.stringify(join(claude, "skills", "fsloop"))}, "junction")`]);
    assert.equal(install().status, 0);
    assert.equal(real(join(claude, "skills", "fsloop")), real(join(ROOT, "skills", "fsloop")));
    assert.ok(existsSync(elsewhere));
  });

  test("a real folder where a link goes is left alone and stops the install", () => {
    mkdirSync(join(claude, "skills", "fsloop"), { recursive: true });
    writeFileSync(join(claude, "skills", "fsloop", "SKILL.md"), "mine");
    const r = install();
    assert.equal(r.status, 1);
    assert.match(r.stderr, /is a real folder, not a link/);
    assert.equal(readFileSync(join(claude, "skills", "fsloop", "SKILL.md"), "utf8"), "mine");
  });

  const repoAt = (name) => {
    const repo = join(tmp, name);
    mkdirSync(join(repo, ".claude"), { recursive: true });
    spawnSync("git", ["init", "-q", repo]);
    return repo;
  };

  test("a repo gets its spike workspace and git excludes, and is told of the fsloop it still keeps", () => {
    const repo = repoAt("repo");
    mkdirSync(join(repo, ".claude", "agents"));
    writeFileSync(join(repo, ".claude", "agents", "fsloop-critic.md"), "old");
    writeFileSync(join(repo, ".claude", "settings.json"), JSON.stringify({ hooks: { PreToolUse: [{ hooks: [{ command: 'node "$CLAUDE_PROJECT_DIR/.claude/hooks/spike-guard.mjs"' }] }] } }));
    writeFileSync(join(repo, "CLAUDE.md"), "- **`.spike/` — полный доступ.**\n");
    const r = install(repo);
    assert.equal(r.status, 0);
    assert.match(readFileSync(join(repo, ".gitignore"), "utf8"), /^\.claude\/fsloop\/spike\/$/m);
    const exclude = readFileSync(join(repo, ".git", "info", "exclude"), "utf8");
    assert.ok(exclude.includes(".claude/fsloop/*\n!.claude/fsloop/config.md\n"));
    for (const d of ["data", "sessions", "toolkits"]) assert.ok(existsSync(join(repo, ".claude", "fsloop", "spike", d)));
    assert.ok(!existsSync(join(repo, ".spike")));
    assert.match(r.stdout, /the project keeps its own fsloop/);
    assert.match(r.stdout, /fsloop-critic\.md/);
    assert.match(r.stdout, /its spike-guard hook/);
    assert.match(r.stdout, /still name \.spike\/[\s\S]*CLAUDE\.md/);
  });

  test("an old .spike moves to .claude/fsloop/spike whole", () => {
    const repo = repoAt("old");
    mkdirSync(join(repo, ".spike", "sessions", "acc1"), { recursive: true });
    writeFileSync(join(repo, ".spike", "README.md"), "mine");
    writeFileSync(join(repo, ".spike", "sessions", "acc1", "session.txt"), "secret");
    assert.equal(install(repo).status, 0);
    assert.ok(!existsSync(join(repo, ".spike")));
    assert.equal(readFileSync(join(repo, ".claude", "fsloop", "spike", "README.md"), "utf8"), "mine");
    assert.equal(readFileSync(join(repo, ".claude", "fsloop", "spike", "sessions", "acc1", "session.txt"), "utf8"), "secret");
  });

  test("an old .spike a worktree still mirrors stays where it is", () => {
    const repo = repoAt("mirrored");
    mkdirSync(join(repo, ".spike", "data"), { recursive: true });
    const git = (...a) => spawnSync("git", ["-C", repo, "-c", "user.name=t", "-c", "user.email=t@t", ...a], { encoding: "utf8" });
    git("commit", "-q", "--allow-empty", "-m", "init");
    const wt = join(tmp, "lane");
    assert.equal(git("worktree", "add", "-q", wt).status, 0);
    mkdirSync(join(wt, ".spike"));
    const r = install(repo);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /mirror .*spike-lease\.mjs unlink/);
    assert.ok(existsSync(join(repo, ".spike", "data")));
  });

  test("an old .spike with a held lease stays where it is", () => {
    const repo = repoAt("leased");
    mkdirSync(join(repo, ".spike", "sessions", "acc1"), { recursive: true });
    writeFileSync(join(repo, ".spike", "sessions", "acc1", ".lease"), "{}");
    const r = install(repo);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /leased sessions \(acc1\)/);
    assert.ok(existsSync(join(repo, ".spike", "sessions", "acc1", ".lease")));
    assert.ok(!existsSync(join(repo, ".claude", "fsloop", "spike")));
  });

  test("a path that is not a repo root is refused before anything is linked", () => {
    const r = install(join(tmp, "nowhere"));
    assert.equal(r.status, 64);
    assert.ok(!existsSync(join(claude, "skills")));
  });
});
