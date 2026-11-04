import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, test } from "node:test";

import { spikeViolation } from "./spike-guard.mjs";

const denied = (cmd, opts) => assert.notEqual(spikeViolation(cmd, opts)?.why ?? null, null, cmd);
const allowed = (cmd, opts) => assert.equal(spikeViolation(cmd, opts), null, cmd);

describe("spike-guard", () => {
  test("copying or moving a session folder is denied", () => {
    denied("cp -r .claude/fsloop/spike/sessions/ktr11 /tmp/x");
    denied("mv .claude/fsloop/spike/sessions/a .claude/fsloop/spike/sessions/b");
    denied("rsync -a .claude/fsloop/spike/sessions/a/ backup/");
    denied(`Copy-Item ".claude\\fsloop\\spike\\sessions\\a" d:\\b`);
    denied("cd lane && cp -r ../.claude/fsloop/spike/sessions/a ./x");
    denied("robocopy .claude\\fsloop\\spike\\sessions\\a D:\\backup /E");
    denied("Copy-Item -Destination d:\\b -Path .claude\\fsloop\\spike\\sessions\\a");
  });

  test("bringing a new account into the sessions folder passes", () => {
    allowed(`cp -r "/c/Users/u/Downloads/pack/tdata" .claude/fsloop/spike/sessions/new/`);
    allowed(`Copy-Item -Path "C:\\Users\\u\\Downloads\\pack\\tdata" -Destination .claude\\fsloop\\spike\\sessions\\new -Recurse`);
    allowed("robocopy D:\\pack\\tdata .claude\\fsloop\\spike\\sessions\\new\\tdata /E");
    allowed("cp -t .claude/fsloop/spike/sessions/new/ /c/pack/session.txt");
  });

  test("a hand-made link into the workspace is denied", () => {
    denied("ln -s ../.claude/fsloop/spike/sessions/x .claude/fsloop/spike/sessions/x");
    denied("mklink /D .claude\\fsloop\\spike\\sessions\\x ..\\main\\.claude\\fsloop\\spike\\sessions\\x");
    denied("New-Item -ItemType SymbolicLink -Path .claude\\fsloop\\spike -Target ..\\main\\.claude\\fsloop\\spike");
  });

  test("deleting a lease by hand is denied", () => {
    denied("rm .claude/fsloop/spike/sessions/a/.lease");
    denied("Remove-Item .claude\\fsloop\\spike\\sessions\\a\\.lease");
  });

  test("a project not moved yet keeps its .spike guarded", () => {
    denied("cp -r .spike/sessions/ktr11 /tmp/x");
    denied("ln -s ../.spike/sessions/x .spike/sessions/x");
    denied("rm .spike/sessions/a/.lease");
  });

  test("the words inside a heredoc body or a quoted string are not a command", () => {
    allowed("cat > note.md <<'EOF'\nnever copy a session out of .claude/fsloop/spike/sessions\nEOF");
    allowed(`echo "cp .claude/fsloop/spike/sessions/x is forbidden"`);
    allowed(`git commit -m "spike: never mv .claude/fsloop/spike/sessions"`);
  });

  test("reading sessions, the rest of .claude/fsloop and the lease tool pass", () => {
    allowed("ls .claude/fsloop/spike/sessions");
    allowed("cat .claude/fsloop/spike/sessions/a/notes.md");
    allowed("cp -r .claude/fsloop/runs/ab12cd34 /tmp/run");
    allowed("node ~/.claude/skills/fsloop/spike-lease.mjs acquire lane ktr11");
  });

  test("removing a checkout over a standing mirror is denied", () => {
    const opts = { mirrorAt: (p) => /fsl[\\/]run-u1([\\/]\.claude[\\/]fsloop[\\/]spike)?$/i.test(p), linksAt: () => [] };
    denied("git -C C:/dev/fsl/run worktree remove --force C:/dev/fsl/run-u1", opts);
    denied("git worktree remove ../fsl/run-u1", opts);
    denied("rm -rf C:/dev/fsl/run-u1", opts);
    denied("rm -rf C:/dev/fsl/run-u1/.claude/fsloop/spike", opts);
    denied("Remove-Item -Recurse -Force C:\\dev\\fsl\\run-u1", opts);
    allowed("git -C C:/dev/fsl/run worktree remove --force C:/dev/fsl/run-u2", opts);
    allowed("git worktree prune", opts);
    allowed("rm C:/dev/fsl/run-u1/notes.md", opts);
  });

  test("a mirror on disk, at the new home or the old one, stops the checkout's removal", () => {
    const root = mkdtempSync(join(tmpdir(), "spike-guard-"));
    const target = join(root, "main-data");
    mkdirSync(target);
    try {
      for (const home of [join(".claude", "fsloop", "spike"), ".spike"]) {
        const checkout = join(root, home === ".spike" ? "old" : "new");
        mkdirSync(join(checkout, home), { recursive: true });
        symlinkSync(target, join(checkout, home, "data"), "junction");
        denied(`rm -rf ${checkout.replaceAll("\\", "/")}`);
        unlinkSync(join(checkout, home, "data"));
        allowed(`rm -rf ${checkout.replaceAll("\\", "/")}`);
      }
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("removing a checkout over a junction at its root is denied", () => {
    const at = (cmd) => spikeViolation(cmd, { mirrorAt: () => false, linksAt: (p) => (/commit-check$/i.test(p) ? ["node_modules"] : []) });
    assert.match(at('git worktree remove --force "C:/Users/me/AppData/Local/Temp/commit-check"')?.why ?? "", /node_modules/);
    assert.match(at("rm -rf C:/Temp/commit-check")?.why ?? "", /rmdir/);
    assert.equal(at("git worktree remove --force C:/Temp/other-check"), null);
  });
});
