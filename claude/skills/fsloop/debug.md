Techniques for `fsloop-debug`, read when the red command matches a case below. `diagnosing-bugs` stays the process; each case here builds its Phase 1 loop or ranks its Phase 3 hypotheses. Where the project keeps test rules (`common.md` quotes them), the fix shapes cite them by name. `<start>` is the start checkout `common.md` names; commands run in the `Repo:` tree; `<lock>` is the machine lock of `common.md`, or nothing when it has none.

## Red in a run of many files, green alone

The suite calls it `flaky` when its tooling gives such a verdict; a unit's Verify sees it as a test file red in the list and green by itself. Which run it was decides the cause:

- **One process** — the files ran in one process one after another (a unit's tests in Verify; a runner that shares a process across files — `bun test`, `pytest`, `vitest` or `jest` with isolation off): files share global singletons, the module registry and its mocks, the environment and timers. The discriminator, one command: the red file list again with each file in a fresh global (`bun test --isolate`, `vitest --isolate`, `pytest --forked`). Green with it, red without → **order pollution**. Red with it as well → state outside the process (a file on disk, a database snapshot) or time: `find-polluter` still names a file that leaves disk state; `NO POLLUTER` → **Time**.
- **Parallel** — the files ran in parallel processes, each isolated, so no file sees another's globals; the cause is **concurrency** or **time**.

**Order pollution.** The loop finds the file that leaves the state behind:

```
<lock> node <start>/.claude/skills/fsloop/find-polluter.mjs [--run '<command>'] [--skip <regex>] <victim> [path prefix ...]
```

`--run` is the runner's command for a list of files in one process, writing JUnit XML — `{files}` expands to the files, `{junit}` to the report path (`npx vitest run {files} --no-isolate --no-file-parallelism --reporter=junit --outputFile={junit}`, `python -m pytest -p no:randomly {files} --junitxml={junit}`); a repo with a bun lockfile needs none. `--skip` keeps out the tests that need the lock, a live resource or a browser. Run it as a background command with the maximum timeout: it runs the victim alone (red → `BROKEN`, debug it alone), then every candidate before it in one process, then halves. Each run costs about the candidates' serial time — narrow the candidates by prefix to the files the red run had before the victim, or the victim's area. `POLLUTER:` names the file and prints `LOOP:`, the two-file command that is your tight loop. `INCONCLUSIVE` prints the set: the victim needs two files from different halves together — bisect that set by hand. `NO POLLUTER` with prefixes → widen them to every file the red run had; with none → not order. The fix goes where the state is made: the polluter closes what it opened in its teardown, or the singleton passes through a seam; a pinned order or a reset in the victim alone hides it.

**Concurrency.** Neighbour files run at once: a file on disk written in place instead of through a temp file and rename, a fixed port instead of `0`, a check that a neighbour's signal satisfies first. Raise the reproduction rate (`diagnosing-bugs` → Non-deterministic bugs) with the load and the loop under one lock, so they overlap: the runner's parallel run of the victim's directory at half the cores, and in the same shell the victim repeated twenty times (`bun test --rerun-each=20`, `vitest --repeat`, `pytest --count` of pytest-repeat), started together:

```
<lock> bash -c '<parallel run of the victim dir> & <the victim, repeated>; wait'
```

**Time.** A sleep or a deadline on the wall clock that a loaded machine misses: the clock becomes a seam, the test waits for the condition it then checks instead of a fixed sleep, a timeout under test is a small parameter, a bound keeps a 2× margin, a migration's `now()` is compared with what it made. Loop: the concurrency command above.

## A wrong value deep in the stack

A wrong path, an empty id, another account's row, a database other than the test's: fix where the value is made, not where it fails. From the failing line, ask what passed this value, one caller up at a time, until the line that made it. Where reading stops, a tagged probe before the operation, not after it fails, written to stderr with the stack — `console.error("[DEBUG-<4 hex>]", { value, stack: new Error().stack })`, or the language's equivalent: stderr reaches the output where the app's logger may be silenced under test. The fix is at the source; a guard at the symptom only beside it, never instead.
