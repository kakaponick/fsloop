import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { after, before, describe, test } from "node:test";
import { fileURLToPath } from "node:url";

import { commandFits, findPolluter, refusedAsTooLong, victimCases } from "./find-polluter.mjs";

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), "find-polluter.mjs");

// A runner for the repo fixture: runs the files in order in one "process" — a file holding POLLUTE
// leaves state behind, VICTIM fails when it finds that state, BROKEN always fails — and writes JUnit.
const FAKE_RUNNER = `
import { readFileSync, writeFileSync } from "node:fs";
const [junit, ...files] = process.argv.slice(2);
let polluted = false;
const cases = files.map((file) => {
  const body = readFileSync(file, "utf8");
  const failed = body.includes("BROKEN") || (body.includes("VICTIM") && polluted);
  if (body.includes("POLLUTE")) polluted = true;
  const path = file.replace(/^\\.\\//, "");
  return '<testsuite name="' + path + '"><testcase name="t" classname="' + path + '">' + (failed ? "<failure/>" : "") + "</testcase></testsuite>";
});
writeFileSync(junit, "<testsuites>" + cases.join("") + "</testsuites>");
`;

describe("findPolluter", () => {
  const files = ["a", "b", "c", "d", "e", "f", "g", "h", "i"];

  test("narrows the candidates down to the one file that turns the victim red", async () => {
    for (const culprit of files) {
      const { polluter } = await findPolluter(files, (set) => set.includes(culprit));
      assert.equal(polluter, culprit);
    }
  });

  test("stops with the set when only two files from different halves together turn it red", async () => {
    const result = await findPolluter(files, (set) => set.includes("b") && set.includes("h"));
    assert.deepEqual(result, { polluter: null, set: files });
  });

  test("splits a half that is too long to run instead of calling it green", async () => {
    const { polluter } = await findPolluter(files, (set) => (set.length > 4 ? null : set.includes("c")));
    assert.equal(polluter, "c");
  });
});

describe("command length on Windows", () => {
  const line = (length) => `bun test ${"x".repeat(length - 9)}`;

  test("holds a command to cmd.exe's 8191-character line on win32", () => {
    assert.equal(commandFits(line(9_000), "win32"), false);
    assert.equal(commandFits(line(7_900), "win32"), true);
    assert.equal(commandFits(line(9_000), "linux"), true);
  });

  test("reads cmd.exe's refusal as too long, never as a red run", () => {
    assert.equal(refusedAsTooLong("The command line is too long.\r\n"), true);
    assert.equal(refusedAsTooLong("", { code: "E2BIG" }), true);
    assert.equal(refusedAsTooLong("1 fail\n"), false);
  });
});

describe("victimCases", () => {
  test("reads bun's file attribute", () => {
    const xml = '<testsuite name="x"><testcase name="t" file="lib/a.test.ts"><failure/></testcase><testcase name="u" file="lib/b.test.ts"/></testsuite>';
    assert.deepEqual(victimCases(xml, "lib/a.test.ts"), [{ failed: true }]);
  });

  test("reads vitest's suite name", () => {
    const xml = '<testsuites><testsuite name="lib/a.test.ts"><testcase name="t" classname="lib/a.test.ts"/></testsuite><testsuite name="lib/b.test.ts"><testcase name="t" classname="lib/b.test.ts"><failure/></testcase></testsuite></testsuites>';
    assert.deepEqual(victimCases(xml, "lib/a.test.ts"), [{ failed: false }]);
  });

  test("reads pytest's dotted class name", () => {
    const xml = '<testsuites><testsuite name="pytest"><testcase classname="tests.test_a" name="t"><error/></testcase><testcase classname="tests.test_b" name="t"/></testsuite></testsuites>';
    assert.deepEqual(victimCases(xml, "tests/test_a.py"), [{ failed: true }]);
  });
});

describe("find-polluter.mjs in a repo", () => {
  let repo;
  const runArg = "node runner.mjs {junit} {files}";
  const write = (name, body) => {
    mkdirSync(dirname(join(repo, name)), { recursive: true });
    writeFileSync(join(repo, name), body);
  };
  const run = (...args) => spawnSync(process.execPath, [SCRIPT, ...args], { cwd: repo, encoding: "utf8" });

  before(() => {
    repo = mkdtempSync(join(tmpdir(), "find-polluter-repo-"));
    write("runner.mjs", FAKE_RUNNER);
    write("clean.test.ts", "clean");
    write("dirty.test.ts", "POLLUTE");
    write("other.test.ts", "other");
    write("victim.test.ts", "VICTIM");
    write("broken.test.ts", "BROKEN");
    write("live/dirty.live.test.ts", "POLLUTE");
    spawnSync("git", ["init", "-q"], { cwd: repo });
    spawnSync("git", ["add", "."], { cwd: repo });
  });

  after(() => rmSync(repo, { recursive: true, force: true }));

  test("names the file that leaves state behind and the two-file loop", () => {
    const result = run("--run", runArg, "victim.test.ts", "clean", "dirty", "other");
    assert.equal(result.status, 1, result.stdout + result.stderr);
    assert.match(result.stdout, /POLLUTER: dirty\.test\.ts/);
    assert.match(result.stdout, /LOOP: node runner\.mjs \S+loop\.xml \.\/dirty\.test\.ts \.\/victim\.test\.ts/);
  });

  test("reports no polluter under the prefixes and asks to widen them", () => {
    const result = run("--run", runArg, "victim.test.ts", "clean", "other");
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.match(result.stdout, /NO POLLUTER/);
    assert.match(result.stdout, /widen them/);
  });

  test("keeps a skipped test out under a prefix and runs it only when named as a file", () => {
    assert.match(run("--run", runArg, "--skip", "\\.live\\.", "victim.test.ts", "live/").stdout, /· 0 candidates ·/);
    assert.match(run("--run", runArg, "--skip", "\\.live\\.", "victim.test.ts", "live/dirty.live.test.ts").stdout, /POLLUTER: live\/dirty\.live\.test\.ts/);
  });

  test("exits 4 on a usage error, apart from a found polluter", () => {
    assert.equal(run().status, 4);
    assert.equal(run("--run", runArg, "missing.test.ts").status, 4);
    assert.equal(run("victim.test.ts").status, 4);
    assert.equal(run("--run", "node runner.mjs {files}", "victim.test.ts").status, 4);
  });

  test("refuses a victim that is red alone", () => {
    const result = run("--run", runArg, "broken.test.ts", "clean");
    assert.equal(result.status, 2, result.stdout + result.stderr);
    assert.match(result.stdout, /BROKEN: broken\.test\.ts/);
  });
});
