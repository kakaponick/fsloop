# Tests Law

Every second of a test is paid by every run of every agent, and an unstable test lies both green and red. A test checks behaviour; it does not wait for time. fsloop's base law for every test a run writes or judges; the project's test rules (`common.md` names them) refine or override it where both speak, and name its guards — the checks that turn red by themselves. Cite a rule by its number: `tests 6`.

## Shape

The test sits beside its module, built with factory helpers. A pure function is called directly, never through a server action or the framework's request layer. A test with a database takes the project's test-database helper — real migrations, a database of its own — and passes the database as the last argument; behaviour of the production driver that the test database does not reproduce is proven by the project's live-driver tests. A parser, codec, format reader or crypto path is proven by a known-answer vector from an external implementation or a real sample — a fixture its own code built proves nothing. An expected value comes from an independent source, never recomputed the way the code computes it. A test reaches its code at a seam — a public interface — never through an internal. A test that reads a file of the tree normalises `\r\n` → `\n`.

## Time

1. **The clock is a seam, not a wait.** Everything that waits — sleep, now, random, an interval, a pacing delay, a limiter — the test replaces: a virtual clock where sleep moves the clock, a fixed `NOW`. A test of «pause 10 minutes» checks that 10 minutes of sleep were asked for; it does not sleep. A literal over a second in a sleep or timer call of a test file is a defect, and a guard where the project keeps one; tests against a live system keep its clock.
2. **Wait for the condition, not for time.** Not a 1.5 s sleep hoping the page polls twice, but a loop until the condition itself (`while (stub.polls() < before + 2) await sleep(20)`) under the test's timeout. A fixed sleep is slow on a quiet machine and red on a busy one.
3. **A timeout under test is a small parameter.** «Expires on timeout» is checked with a timeout of hundreds of milliseconds through an option or a setting, not the 60 s default. No seam → add an optional parameter to the code, never wait in the test.
4. **A time bound catches a hang, not a stopwatch.** An upper bound separates «worked» from «hung» with a margin of at least two times. A lower bound separates the timeout under test from its neighbours but never measures it exactly: an event loop counts a timer from its cached loop time, so after a long synchronous stretch it fires earlier than `now()` read before the call shows. `≥ 1900` of `2000` is already a flake; `≥ 1500` is the norm.
5. **The live clock never leaks in indirectly.** A migration with `now()` (date-named partitions, a seeded «today») makes different things on different days. The test compares with what the migration made, or creates and drops what it needs itself; it never relies on a neighbouring month existing or not.

## Process and resources

6. **Processes.** A runner that runs files in one process lets global singletons (a browser, a limiter, shutdown hooks, a connection pool) outlive a file: a test passes its own instance through a seam instead of inheriting another file's state, and closes in its teardown what it opened. A runner that spreads files over processes runs neighbours at once: shared state on disk is written through a temp file and a rename, a port is `0`, and a test waits for exactly what it then checks (rule 2) — under load a neighbour's signal arrives first.
7. **A database once per file.** Created in the file's setup, reset before each case; a database per case is a defect (and a guard where the project keeps one). A migrated snapshot shared by the process keeps the raise cheap, so a second database in a file is never needed.
8. **A browser once per file.** One browser per file, closed in its teardown; every context closed. Human-like delays are zero unless timing is the subject. A wait for a frame or a navigation counts from the event itself, not from when a poll noticed it.
9. **Setup once.** Expensive shared setup (a stub server, a bridge, a database) — in the file's setup. A case checks one property and does not repeat another case's setup.

## Budget and health

10. **Budget.** One test — up to 5 s. A file longer than 3 s — on average up to 1 s per test. Longer only with an entry in the project's allow list with its reason, and that entry is committed by a human.
11. **A flake is a defect, not a reason to rerun.** A failed file is rerun alone where the tooling can: `broken` — it fails alone too; `flaky` — it fails only in the shared run. Both are red. A red line is work in the same turn: the flake is fixed. Rerunning until green instead of fixing is never done.
12. **Baseline.** Where the project keeps a timing baseline, it is written only after a clean full run: the suite honestly grew in the task — the baseline file goes into the same commit. A red run never writes the baseline, and neither does a loaded machine.
