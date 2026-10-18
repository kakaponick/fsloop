# fsloop — init

Read on `/fsloop init`. Init writes the project's config, `.claude/fsloop/config.md`: every role of SKILL.md → Project facts with the command that fills it and the outcome of running it, the shared catalogs and their guards, the role map, the shot recipe proven by three frames — so a run reads them as stated instead of deriving them (SKILL.md → Project facts). Run it once per project, and again when the stack changes; a run whose config is older than the stack it meets says so in its report.

Init is a run of its own: SKILL.md holds — run id, worktree, Launch records, Command lists, Background commands, Models — with one stage, `init`. It writes no product code and nothing outside `.claude/fsloop/` in `<wt>` and the run folder; what the project lacks for a role (a seed, a test user, a dry mode) is an OPEN line for the user, never built here. An existing config is verified in place: each line a step below owns is replaced by what that step proves; every other line and section is kept verbatim.

1. **Bootstrap.** The run id, the worktree with its install and env files (SKILL.md → Worktree), `common.md` with its six head lines — `Mode: init`, `N: —`, `K: 1` — `## Goal` `init`, and the existing config verbatim under `## Project`.

2. **Survey.** One `Explore` (`model: sonnet`, description `map`), `Repo: <wt>`, tables only, the existing config's answer first in each:
   - **commands** — per role of Project facts, the candidates and where each is stated (`CLAUDE.md`, the rule files it names, the package manifest's scripts, CI config);
   - **catalogs** — the files several units would write (message catalogs, schema and migrations folder, registries a test enumerates, generated files, the package manifest and lockfile), each with the guard test that goes red when it grows, read from the tests;
   - **roles** — per role of `law/ui.md` → Roles, the component that plays it, by path, or `—`; no UI → none;
   - **shots** — the app's kind and dev server (framework, command, port, the lock a second instance trips on); screenshot tooling or browser tests the project already has, and the doc that names them; how the app gets data in development (a seed, fixtures, migrations into a throwaway database, a mock mode); how a user signs in (a seeded test user, a dev bypass, env credentials); locale and theme switches;
   - **accounts and deploy** — an account kit, a production-read skill, what `CLAUDE.md` says the deploy adds.

3. **Commands.** Each role with a candidate runs once in `<wt>`, a command list of its own (`logs/init-<role>.log`), its echo carrying the seconds: `s=$(date +%s); <cmd> > <log>.<n> 2>&1; e=$?; echo "<n> <role> — exit $e — $(( $(date +%s) - s )) s — $(grep -m1 -iE '<pass pattern>|fail|error' <log>.<n>)" | tee -a <log>.lines`. The suite and the build run in the background under the machine lock. What runs and how:
   - install, type-check, lint, guards, suite, build — as stated;
   - test, one file — on one small test file the survey names; unit tests — that file plus the guards;
   - migrate — the generate command, and an apply only into a throwaway database the project can create and drop; never a shared one;
   - worker — its dry mode for a few seconds, or `--help`; never against shared state;
   - machine lock — `node -v` through it; production shape, find-polluter — not run: the first is read-only and named, the second runs on a red file in `debug.md`;
   - impeccable — the launcher's `context` once.

   A command is right when it does what its role says, whatever its exit: red on the default branch is a fact (`exit 2 · 14 s · 3 type errors on main`), recorded, the command kept. A role the project lacks: command `— <why>`, verified `—`.

4. **Shots** — a project with a UI. `fsloop-shots` (description `shots`), `Repo: <wt>`, the survey's shots table, the capture defaults the project states, the run folder's `shots/` and `logs/`. It returns the recipe and three frames. Then **the proof**: a `general-purpose` launch, `model: sonnet`, description `shots proof`, that reads the three frames by path with Read and answers one line each, `FRAME: shots/init-<name>.png ok|bad — <what it shows>` — `bad` for a login form, an error page or overlay, a loading state, a blank page, an empty list where the recipe promised data, or another page than its URL names. A `bad` frame goes back to `fsloop-shots` once, with the proof's lines; still bad → the Shots section keeps what is proven and says `none — <why>` for the rest, and the OPEN lines say what the user would add. No UI → `none — no UI`.

5. **Config.** Write `<wt>/.claude/fsloop/config.md` with Write:

   ```
   # fsloop — config of <project>

   Verified: <date> · <origin/<default> short sha> · run <run id>

   ## Commands
   | role | command | verified |            ← every role of Project facts; verified: exit · seconds · what the log says
   ## Shared catalogs                         ← file — the guard that trips when it grows, or unguarded
   ## Roles
   | role | component |                      ← law/ui.md → Roles; — where none plays it
   ## Shots
   - Raise · Serve · Shoot · Login · Teardown — the commands, from fsloop-shots
   - Refuses — when a raise or serve refuses
   - Capture defaults — locale, theme, width
   - Proof: shots/init-<a>.png, shots/init-<b>.png, shots/init-<c>.png   (or: none — <why>)
   ```

   then `## Accounts` and `## Deploy check` when the survey found them, then every other section the old config had. A login's credentials live in the environment or `.spike/` and its saved session in `.claude/fsloop/auth.json`, outside git; the config names them, never holds them.

6. **Gate, land.** `fsl.mjs gate <run folder> init` — red names what the config lacks: a role without a row or an outcome, a missing section, a frame the proof did not read `ok`. Green → one command list commits the config on `fsl/<run id>` (`git add .claude/fsloop/config.md`, a message per SKILL.md → Commit message, `Fsloop-Step: init`), then SKILL.md step 7's merge and push — no checks beyond them: the config is the only change. Then the shot server's teardown, and the worktree removed as step 7's success says.

7. **Summary**, in the user's language: what each command did on the default branch, the reds named; which roles the project lacks; the catalogs and guards; the role map's empty roles; the shot recipe and the three frames embedded by absolute path; what the user would add for what init could not prove (a seed, a test user, a dry mode) — one line each.
