# fsloop — the passes

Read at bootstrap when `/fsloop` got `N`; without `N` nothing here runs. `N` caps the passes. Each pass ends in Assess: it proves the built result runs, hands the next pass its work and decides whether that pass is built.

## Passes

A pass is one of three kinds, by its place:

- **Build** — pass 1: SKILL.md steps 1–6 with the Verdicts, exactly as a run without `N`.
- **Carry** — pass 2, when pass 1 left findings. Its fix list is every finding pass 1 left: decided `candidate` (each critic's CANDIDATES line is one too, `<launch>#cand-<n>`), decided `open`, or scored `partial` or `unresolved` by a verdict. It runs step 6 → Fix on that list — a CANDIDATES line, which names no cause, groups by the file it names — then the Verdicts: a craft finding by `LENS: craft verdict`, every other one, CANDIDATES lines included, by `LENS: code verdict`. No Map, Spike, Decompose, Units or Review: its work is named finding by finding, and the verdicts read each one.
- **Improve** — every later pass, and pass 2 when pass 1 left nothing. Its goal is the improvements the previous Assess took (The improvement search). It runs steps 3–6 with the Verdicts — an improvement is new building, a vertical slice like any unit — and Map or Spike only for a surface no earlier pass mapped (its production shape and baseline) or an unknown no doc covers.

Each pass closes what it raises by SKILL.md's rules: its Review, Fix and Verdicts decide its findings, and a critical or major its verdicts leave open holds the push as in a run without `N`.

The outcome, at Assess: `next` — the next pass has work, findings decided `fix` with ref `p<p+1>`; `converged` — it has none; `cap` — this is pass `N`, and what is left stays as Assess decided it: a defect `open`, an improvement `candidate`.

## Assess

After the Verdicts, every lane closed. In order:

1. **The end-to-end run** — the goal's scenario run for real, per The end-to-end run below (a page's task walk is its implementer's tests, not part of this run). A failed step is the run's own finding `p<p>-assess-own#<n>` (SKILL.md → Findings).
2. **Parity** — with `Source:` in `common.md`: `LENS: parity assess`, one launch per part `fsl.mjs parity <run folder> p<p>-assess` prints (`source.md` → Review), each briefed with the goal in the user's words, the spike docs, the production shape of every surface, the run's file list and the part's path — no unit brief, no settled decision, no prior finding: the built result judged as a stranger would, the one decision it carries each drop's and defer's journal why.
3. **The hand-over** — the next pass's work, unless this is pass `N`:
   - after pass 1, every finding pass 1 left gets its decision again in its own stage's findings file: `fix` with ref `p2`, or `dropped`, `declined` or `duplicate` by the Bar; a CANDIDATES line gets its row there now. When pass 1 left nothing, the improvement search instead;
   - after any later pass, the improvement search.
4. **The suite** — last and alone, every launch done and every shot server stopped: one background command list (SKILL.md → Background commands), its log `logs/p<p>-assess-suite.log`, the suite and the whole-repo lint on the run branch — the pass's only whole-suite run. Its red lines are judged by step 7's suite rules (a red line major, its flaky and time exceptions), each the run's own finding.
5. **Decide** this Assess's findings by the bar in `findings/p<p>-assess.md`. The run's own and parity's: critical or major → `fix` with ref `p<p+1>`, `open` at pass `N`; minor → `fix` with ref `p2` after pass 1, else `candidate`. An improvement → `fix` with ref `p<p+1>`, unless it argues against a settled decision (`dropped`), undoes a change of this run with no rule it broke (Bar → Reversals: `candidate`) or repeats one already taken (`duplicate`). A finding that shows an earlier `fix` finding still standing names it under `repeat`.
6. **The row** in `passes.md`: the pass, `taken` — its findings decided `fix` with ref `p<p+1>`, in whichever stage's file they stand —, the outcome and why.

Done when `gate p<p>-assess` is green: it counts `taken` from the findings files, refuses an outcome the rule does not allow, after pass 1 refuses a finding left neither handed to pass 2 nor settled, and asks for the improvement search wherever it is due.

## The improvement search

One `fsloop-critic`, `LENS: improve`, description `critic improve`, `Repo: <wt>`. It is taste with an anchor: up to `K` improvements — the config's `## Passes` → `improvements: <K>`, else 20 — around the run's main task: the feature itself and what surrounds it, the screens and paths a user of the goal walks and the backend under them, across UI, UX and backend, ranked by what each is worth to that user. Briefed with the goal in the user's words, `PRODUCT.md`, the production shape of every surface, the run's file list, the spike docs, each surface's final frame by path and the **history**: every improvement an earlier search raised, with its decision and, when taken, the unit that built it — so each search proposes the next improvement, never one already taken, declined or undone.

## Handoff

A `next` hands the run to a fresh session: yours holds every brief and report of the pass, and turns are the price, while the run folder holds all the next pass needs (SKILL.md → Resume). Once `gate p<p>-assess` is green, no launch running, no lane open and every background command and Monitor of yours stopped (`TaskStop`): first the journal row `handoff`, then load T3 Code's thread launcher (`ToolSearch` `select:mcp__t3-code__t3_thread_launch`) and launch one thread — `clientRequestId` `fsloop-<run id>-p<p+1>`, the same on a retry; no `projectId`, model or modes (inherited); `workspaceStrategy` `{type: "existing_worktree", worktreePath: <start>}` when `<start>` is not the project's root checkout, none when it is; title `fsloop <run id> · pass <p+1>`; message `/fsloop resume <run id>`, then the user's in-run instructions verbatim, each with its journal row. End your turn with one line and the thread's link. No launcher in reach → the next pass runs in this session, a decision.

Finish's report carries the passes — each one's kind, `taken` and outcome — and each surface's audit and critique scores, baseline → now (`fsl.mjs report`); its summary says converged or cap, at which pass.

## The end-to-end run

The goal's scenario runs for real in `<wt>`: a job enqueued through the service and taken by the worker command (`common.md`) in its dry mode when it has one, against a throwaway database of the run (`<db>_e2e_<run id>` created beside the dev database, the migrate command applied into it, dropped at Finish) — never the shared dev database, whose accounts and jobs another process may hold, and never a live transport from the worker while a live session may be held elsewhere (`backend.md` → Sessions); the row's transitions read back by SQL; a cron's `run` called directly; a client method against the live system where `.claude/fsloop/spike/` allows — that step goes to a `spike-researcher` with the toolkit and the law's path, sessions acquired for `<wt>` for the run's duration and released after (no lane is open at Assess). A project with no worker or no database runs the scenario through its own entry point (a CLI, a request to the dev server), the same evidence rule. Each command list's COMMANDS lines become the evidence table (criterion / command / outcome); a step nothing in `.claude/fsloop/spike/` covers is a decision and `unverified live` in the report. Money — a payment, a paid call, a budget top-up — is never spent by the run: such a step is `unverified live` with the reason, and the report names it for the user.
