# fsloop — rebuilding a source system

Read at bootstrap when `.claude/fsloop/config.md` has `## Source`: the project rebuilds an older system — the **source** — on its own stack, and a unit is judged by its brief and by what the source did. A behaviour a source test pins or a source document states is **ported** — with a test of this project — or **dropped** or **deferred** by a journal row with its why; one that is none of these is **lost**, a finding (SKILL.md → Bar). `fsloop-implement` reads § Implement and `fsloop-critic` § The parity lens; the rest is the orchestrator's.

## Config

`## Source` of `config.md`, written by hand (init keeps it as an old section the template lacks); paths from the source repo's root:

```
## Source

- repo: `<absolute path of the source checkout>` — read only: never built, run or edited by a run
- inventory: `docs/inventory/` — `tests.md`, one row per source test, `| slice | file:line | describe › it |`, the slice one token with no space or comma; beside it the slice's routes, tables, env, jobs, pages and external systems
- operator guide: `docs/operator-guide.md` — the user paths of the source's UI
- docs: `<files>` — the documents whose statements bind as behaviour
```

`common.md` takes two head lines under the `Session:` lines, above `## Goal`: `Source: <repo>` and `Inventory: <the inventory folder, from the source root as the config writes it>`. `fsl.mjs` reads them from the head alone and keys every source check on them: a run whose head lacks `Source:` is gated as before — and red at every gate while a Source section stands without that line: in `<Start>/.claude/fsloop/config.md` when that file exists, else in `common.md` — a heading of any level and case reading `Source`, alone or followed by `:` or a dash (`## Source`, `## SOURCE`, `## Source — <name>`, `### Source:` nested under `## Project`; never `## Source code layout`), a code block excepted. The gates from Decompose to Integrate are red while `<Source>/<Inventory>/tests.md` is missing, its first table's header is not `| slice | file:line | describe › it |`, or no row parses; Decompose is also red on every line that does not parse — a path with a space, no `:line`, a slice with a space or comma, a second table; Finish never reads it, so a source moved or deleted after Integrate holds nothing. An inventory rebuilt mid-run moves rows to new keys: § Rebuilt inventory. The section itself rides with the rest of the config, verbatim, so every launch finds the source there.

## Map

Map's Explore prompt asks also for a table per source slice the goal ports — the inventory's `slice` values: its rows in `tests.md` (count, and how many call a pure function — no database, network, clock or UI), the source files those tests exercise, the slice's routes, tables, jobs and pages from the inventory, the operator guide's sections on its pages, and the area of this project it lands in. The slice's source code is the reference for behaviour; the idiom stays this project's (`## Reference` cites both, each for its part).

## Decompose

A **source slice** is the measure of the rebuild's progress: the run that names one lists every row of it under some brief's `## Parity`. A u-unit's brief carries a third head line, `Slice: <slice>, …` (`—` for a unit that ports none, a prefactor), and an eighth section after `## Closes`:

- `## Parity` — each row of `tests.md` under its slices, one line each, in one of four forms; `—` when the Slice line is:
  - ``- `<file:line>` port`` — this unit ports it;
  - ``- `<file:line>` ported-earlier `<test file>:<line>` `` — an earlier run ported it; the test stays as it is; the gate takes a test file only (`*.test.*`, `*.spec.*`, `tests/`, `__tests__/`) that stood before this run's first commit with that line inside it, and the Review critic checks the test covers the row;
  - ``- `<file:line>` drop j<n>`` — the rebuild leaves the behaviour behind;
  - ``- `<file:line>` defer j<n>`` — a later run ports it.

  A slice's rows may spread over several briefs, one brief of a pass per row. **A row an earlier pass listed is, in a later pass's brief, only `port`** — at every gate, whenever the line was written. The latest line is the row's fate, except that a blocked unit's line yields to an earlier landed `port` or `ported-earlier`; over a `drop` or `defer` it stands, so a blocked re-port shows the row open.

The rows bind the other sections:
- **Done-criteria** — every `port` row ported (§ Implement), the rows whose source test calls a pure function first — the unit's red tests. A UI part's task walk is the operator guide's path through that page, step by step, each step proven by a test.
- **Problem** — a behaviour a source doc states and no row pins, quoted with its `file:line`, when the unit ports it.
- **Settled** — each `drop j<n>` and `defer j<n>`.

**Drop and defer** — a journal row of its own before the brief cites it, one per row: question `<file:line> — <describe › it>`, decision `drop` or `defer`, why — for a drop the ground the goal, `PRODUCT.md` or the target's stack gives (the new stack makes it moot, the goal retires it, a source bug the test pinned), for a defer the run or stage of the plan that takes it (`stage 3`, `по D12`); effort (`no time`, `too big`), a bare decision (`drop it`, `так решили`), `n/a`, `tbd`, `see above` or one bare word is no why; refs the unit and this row's key, no other row's. The run that takes a deferred slice names it and lists every row again: one an earlier run ported is `ported-earlier`.

**Slice row** — at Decompose only, a slice no brief lists any row of may be decided whole: one journal row of stage `p<p>-decompose`, decision `drop` or `defer`, `slice:<name>` in its refs, a why. Decompose expands it into each row's fate in its snapshot; written at any other stage, or for a slice some brief lists a row of, it decides nothing.

`gate p<p>-decompose` checks it: every u-brief's Slice line and Parity section, every row of every named slice in some brief and in one brief per pass — or, once a snapshot holds it, released — each line's row of a slice its brief names, each `ported-earlier` test, each `drop` and `defer` journal row deciding that fate with the row's key in its refs and a why; a slice with no row in `tests.md` is a typo, or a journal row whose refs carry `slice:<name>` and say why it pins no test. Its green line in `gates.jsonl` records the **snapshot**: the pass's slices, each of their rows' fate and `describe › it`, and a seal — a hash of them that every later gate line repeats. The snapshot is **frozen** from the pass's first green Decompose: Decompose gated again — in its pass or any later one — adds rows and keeps every row already there, its fate as recorded. Replanning before Implement takes a row out only by a release, one journal row per row.

**The invariant** — every gate from units to integrate checks one thing: each row of every snapshot of the passes so far has exactly one **acting fate**:
- `port` in a committed unit — a commit git shows on the run branch with this run's `Fsloop-Run` and the unit's `Fsloop-Step` — whose report's last PARITY line for the row names a ported test, a test file the unit's commits change and the run's tree still holds at `HEAD`, its line within the file — a test a later commit deletes holds the run until it is restored or the line comes out and a release takes the row;
- `ported-earlier`, its test checked as above, held by the run's tree at `HEAD` as a port's is, and judged by the parity critic;
- `drop j<n>` or `defer j<n>` in a brief, with its own journal row as above — written in a brief of the latest pass that listed the row, as the snapshots record it (a new unit for the row in that pass's snapshot), so a row a later pass re-listed never falls back to an earlier pass's drop or defer;
- the drop or defer a slice row gave it in the snapshot;
- or, its line gone, a **release**: a journal row of its own numbered after the journal seen by the Decompose of the pass that last listed the row, at a stage this run has (`p<p>-<step>` of a pass a gate ran, `integrate`), deciding drop or defer — the one way a row leaves a snapshot.

A line deleted, a `Slice: —` written, a slice added to a `Slice:` line that no snapshot holds (until its pass's Decompose is gated again), a `port` left in a blocked unit, a unit past its pass's units gate neither committed nor blocked (or in a state `units.md` does not know), a commit git does not show, a git that does not answer, a ported test missing, a journal row gone or turned stub — each holds the run until the row has an acting fate again. Integrate reads the passes a gate ran or a commit of this run shows; a unit drafted for any other pass counts for nothing, whatever its state says. A green Decompose with no snapshot or no seal (gated before seals existed, `Source:` added after it) holds every later gate until Decompose of that pass is gated again, which any time allows.

## Rebuilt inventory

A `tests.md` rebuilt mid-run may move rows to new `file:line` keys: every gate from units on names the snapshot rows that are no row under their `describe › it` any more, a released row left out. `node <skill>/fsl.mjs rekey <run folder>` moves each to the one row of the same slice and file with the same `describe › it` — in every brief and in `journal.md`, and in `parity/rekey.jsonl` for the snapshot and the reports already saved. While a row stays unmatched it writes nothing and lists each. Map it by hand: `<old file:line>=<new file:line>` — the same slice, file and `describe › it`; `=renamed` after it when the name changed; a renamed file as its own pair, `<old file>=<new file>`. Or take its brief line out and release it. Then gate the stage again, and run the parity critics again for each part whose rows moved (§ Review). A rebuild can also add rows to a slice a snapshot holds — a test split in two: every gate from units on is red on each until it has a line in a brief and that pass's Decompose is gated again, which adds it.

## Threat model

The gates guard against a row lost by an honest, careless orchestrator. A forged run folder — seals recomputed, fields or lines deleted from `gates.jsonl`, a line written into `parity/rekey.jsonl` by hand — is out of the model: no check in the folder stops whoever writes the folder. The seals are a cheap guard against accidental damage: a seal that no longer matches the lines before it holds every later gate until the lines read as `fsl.mjs` wrote them. A run with Source begun before `636bb6d`, whose Decompose could replace a snapshot, reads so too: it starts over from Decompose.

## Implement

Read by `fsloop-implement` for a brief with `## Parity`. The source checkout `common.md` → Source names is read-only reference, outside your rule 1's foreign paths. Each `port` row: read the source test at `<repo>/<file>:<line>` and the source code it exercises, then port the test to the brief's seam with the source's inputs and expected values — every case and every assertion it makes; the rows whose source test calls a pure function first, as your rule 2's red tests. The behaviour follows the source; the code follows this project's law and reference. A `ported-earlier`, `drop` or `defer` row is settled: no work. A `port` row whose behaviour contradicts the brief or the target's stack stays unported, its why on its PARITY line. Each `port` row gets one PARITY line keyed as the brief writes it: ``- `<file:line>` — ported `<test file>:<line>` `` (the test file as committed, from the repo root) or ``- `<file:line>` — not ported — <why>``.

## Units

At Verify, before Land: a `not ported` line whose why is effort (size, time, a missing seam) goes back to the implementer, once, by continuation; one whose why is a contradiction with the brief or the stack is a journal row, and then — for a row this pass lists first — the brief's line edited to `drop j<n>` in the start checkout's run folder; for a row an earlier pass listed, the line taken out of this brief: the row keeps that pass's landed `port` or `ported-earlier`, else a release takes it (§ Decompose → The invariant). A `port` stands only with a `ported` line in the last report of that unit's launches that names the row, its test file a test file among the files the unit's commits change — a port is this unit's work, where a `ported-earlier` test stood before the run began. A blocked unit's `port` row has no acting fate and holds `gate p<p>-units`: for a row this pass lists first, its line becomes `defer j<n>` — a later pass may re-list it as `port` — or `drop j<n>`, each with a journal row of its own; for a row an earlier pass listed, the line comes out and a release takes the row (§ Decompose → The invariant). A PARITY line in neither form is named as such. The invariant above checks all of it at every gate from units on.

## Review

On every pass with a committed or blocked unit whose `Slice:` is other than `—`: `node <skill>/fsl.mjs parity <run folder> p<p>-review` writes the parity critics' parts — one per source slice of the pass, the slice's `port` and `ported-earlier` rows of those units, split into parts of 60 rows when it has more; a slice with no such row takes no part — and prints each part's description, `critic parity <slice>` or `critic parity <slice> <k>/<n>`, with the part file's absolute path. Each part file carries `Seal:`, the hash of its rows as written. It exits 1 with no parts while `common.md` has no `Source:` or the inventory cannot be read. Launch one `fsloop-critic` per part, all in one message with Review's other critics, each with that description, `LENS: parity`, the part's path as `PARITY ROWS:`, and the briefs, `notes.md` paths, file list and settled decisions as `LENS: code` gets them. A part counts as checked by a saved report of `fsloop-critic` (the transcript's meta, else `launches.md`'s agent; a mismatch or neither is none) whose `LENS:` is exactly `parity`, whose `ROWS:` is the part's seal as the run stands now, with a line for each of its rows. `gate p<p>-review` is red while a part has no such report saved at its stage or a later one, and while `critic code` has no report whose `LENS:` is exactly `code` — a parity critic is no code review. Its findings go to Fix like code findings, and `LENS: code verdict` scores them. A parity finding is above the bar by its nature: it is decided `fix` or `open`, or `declined` or `dropped` with ref `j<n>` — a journal row of its own deciding drop or defer of the finding's row, with a why; every gate from Review to Integrate is red on any other decision.

A fate, a ported test or a unit's state changed after its critic changes the part's seal: every gate from Review to Integrate is red until `fsl.mjs parity <run folder> p<p>-review` runs again and each changed part gets its critic again, saved at the current stage — Fix, Verdict and Integrate included.

With `N`, Assess runs `fsl.mjs parity <run folder> p<p>-assess` and launches one critic per part as `assess.md` → Assess briefs its critics — the goal, the spike docs, the file list, no briefs and no settled decisions — plus `LENS: parity assess` and the part's path: the parts cover every row of each source slice a committed or blocked unit or a green Decompose named, whatever its fate, each `drop` and `defer` with its journal why — the one decision Assess hands a critic. `gate p<p>-assess` and every later gate count them alike, by seal, with `critic code` at `LENS: code assess`.

`fsl.mjs report` and `run.json` carry each source slice's coverage — rows, ported, ported earlier, dropped, deferred, open; a row a parity finding cites is open until that finding is fixed and checked again — a verdict scores it resolved, or a later critic reads the landed fix and raises it no more — or let go by its drop or defer.

## The parity lens

Read by `fsloop-critic` for `LENS: parity` and `LENS: parity assess`, with `law/code.md` and `law/tests.md`. Its input is the part file the prompt names under `PARITY ROWS:` — its `Seal:`, and a source slice's rows, each with its unit (`(blocked)` when that unit never landed), fate, the journal why of a `drop` or `defer`, and test — and the source's paths in `common.md` → Source.

- A `port` row with no test is the behaviour lost.
- Each other `port` row — the source test at `<repo>/<file>:<line>` and the source code it exercises, against the ported test the row names and the code it reaches: the same inputs, outputs, side effects, errors and edge cases. A ported test that asserts less than the source's — a dropped case, a looser expectation, a mocked-away effect — is the behaviour lost.
- Each `ported-earlier` row — the test it names, written by an earlier run, against the source test: it covers the row's behaviour as a ported test would above, or the row is the behaviour lost.
- Part 1 of each slice also judges what the slice holds beyond its rows — the inventory's routes, tables and jobs of the slice, the operator guide's path through its pages, the statements of the source docs `common.md` names — against what the units built.
- At Review a `drop` or `defer` row is settled. At Assess every row is judged: a `port` or `ported-earlier` row as above; a `drop` or `defer` row is a finding only with evidence that its journal why, given in the part file, fails — the goal, `PRODUCT.md` or the code contradicts it — so a lawful drop never weighs on a pass, and one that is raised reopens the drop (`assess.md` → Assess).

Your report carries, under `LENS:`, `ROWS: <the part's Seal>` and one line per row of the part: ``- `<file:line>` — kept`` (the behaviour holds), ``— lost parity-<n>`` (its finding below) or ``— settled`` (a `drop` or `defer` whose why stands) — the gate counts no report that skips a row. A row with no fate in the part is the behaviour lost.

Every behaviour lost is a finding `parity-<n>` `[parity]`, cause `—`: its rule `source: <file:line>` (the row's key) or `source: <doc>:<line>` and nothing more — an inventory name often holds « — », which would cut the finding line's fields; the name may follow in the action — major — critical when the lost behaviour guards data or money. A behaviour the source states nowhere is no parity finding.
