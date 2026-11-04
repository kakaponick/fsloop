import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { commandSegments } from "./shell-text.mjs";

describe("commandSegments", () => {
  test("splits on pipes, chains and newlines", () => {
    assert.deepEqual(commandSegments("ls a | head && cat b; echo c\ngrep d"), [["ls", "a"], ["head"], ["cat", "b"], ["echo", "c"], ["grep", "d"]]);
  });

  test("drops heredoc bodies", () => {
    const cmd = "cat > note.md <<'EOF'\nnever cp a session out of .claude/fsloop/spike/sessions\nEOF\nls after";
    assert.deepEqual(commandSegments(cmd), [["cat", ">", "note.md"], ["ls", "after"]]);
  });

  test("a quoted string is one token", () => {
    assert.deepEqual(commandSegments(`echo "cp .claude/fsloop/spike/sessions/x is forbidden" 'rm CLAUDE.md'`), [["echo", "cp .claude/fsloop/spike/sessions/x is forbidden", "rm CLAUDE.md"]]);
  });

  test("keeps redirect targets as tokens", () => {
    assert.deepEqual(commandSegments("echo x >CLAUDE.md"), [["echo", "x", ">", "CLAUDE.md"]]);
    assert.deepEqual(commandSegments("echo x >> a.md"), [["echo", "x", ">>", "a.md"]]);
  });

  test("windows paths and quoted paths survive as one token", () => {
    assert.deepEqual(commandSegments(`Copy-Item ".claude\\fsloop\\spike\\sessions\\a" d:\\b`), [["Copy-Item", ".claude\\fsloop\\spike\\sessions\\a", "d:\\b"]]);
  });
});
