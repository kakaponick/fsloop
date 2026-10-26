# fsloop — init

Read on `/fsloop init`. Init writes the project's config, `.claude/fsloop/config.md`: what a run acts on and cannot cheaply look up — each command by role, the shared catalogs and their guards, the role map, where the design lives, the shot recipe — every line proven by running it. Run it once per project, and again when the stack changes (SKILL.md → Project facts says when a run finds it stale).

**The config is short.** Every launch carries it in `common.md`, so each line is a fact a run acts on — a command, a path, a rule — one table row or one bullet. The proof stays in init's run folder: exits, seconds, logs and frames are evidence; a red a run must know is the one exception, a few words after its command. A cell or section with nothing to state is `none — <why>` — a section's one bullet `- none — <why>`.

Init is a run of its own, with one stage, `init`, and seven marked steps — `bootstrap`, `survey`, `commands`, `design`, `shots`, `config`, `land`: each opens with `node <start>/.claude/skills/fsloop/fsl.mjs mark <run folder> <step>` when it starts, and `fsl.mjs timeline <run folder>` lays the run out by them — each step's start and length, the seconds of every command list and launch under it. Steps overlap where their inputs allow, each step says with what: the install runs beside the survey, step 3's background lists beside the design interview and the shots launch; a step's length runs to the later of its last artifact and the next mark. SKILL.md holds: Run id, Run folder, Worktree, Launch records, Command lists (step 3's run one role each with no exit tail — a red is recorded, not stopped on; every other list keeps it), Background commands, Models, Commit message. Its tracked changes are `config.md` and what step 4 writes: `PRODUCT.md`, `DESIGN.md`, and under `.impeccable/` all but the decision page's `questions/` and `mocks/`. Everything else it makes lives in the run folder, the throwaway databases it drops, and `~/.fsloop`.

1. **Bootstrap.** Run id; `mark bootstrap` — it makes the run folder; the worktree as one command list, `logs/init-bootstrap.log` — `fetch`, `worktree`, `env` when the env files are copied, `link` —, then its install as a background list of its own in step 3's shape, `logs/init-install.log` — the survey reads code, so it launches at once, and step 3 waits for the install's line; `common.md`: its head lines (SKILL.md → Project facts; `Mode: init`, `N: —`, `K: 1`), then `fsl.mjs build`, `## Goal` `init`, the existing config verbatim under `## Project`.

2. **Survey.** `mark survey`. One `Explore` (`model: sonnet`, description `map`), `Repo: <wt>`, tables only, the existing config's answer first. The env files hold the developer's live values: an env file is read as its names, `sed 's/=.*//' <env file>`, never the file itself.
   - **commands** — per role of SKILL.md → Project facts, the candidates and where each is stated (`CLAUDE.md`, the rule files it names, package scripts, CI), and one small test file for `test, one file`;
   - **catalogs** — files several units would write (message catalogs, schema and migrations, registries a test enumerates, generated files, the manifest and lockfile), each with the guard test that goes red when it grows, read from the tests;
   - **roles** — per role of `<start>/.claude/skills/fsloop/law/ui.md` → Roles, the component that plays it, by path, or `—`;
   - **design** — `PRODUCT.md`, `DESIGN.md`, `.impeccable/`; the design system in code: a component library and its theme tokens (`components/ui/`, a CSS variables file, a Tailwind theme, a lint contract on the components), or none;
   - **database** — the engine, the env variable naming it (the name only), the base name, how one is created, migrated and dropped; every other variable that reaches an outside service — keys, tokens, and the hosts and URLs of queues, caches, mail and storage — by name;
   - **shots** — the dev server (framework, command, port, the lock a second instance trips on, what it does on boot: migrations, crons, mail); screenshot tooling or browser tests and their doc; how development gets data (seed, fixtures, a mock mode); how a user signs in; locale and theme switches;
   - **accounts and deploy** — an account kit, a production-read skill, what `CLAUDE.md` says a deploy adds.

3. **Commands.** `mark commands`, once the survey is in and the install's line reads `exit 0`. Each role runs once in `<wt>`, its log `logs/init-<role>.log` (`<role>` with spaces and commas as `-`: `test-one-file`), each command in the command-list shape without its exit tail. The step starts with one database, `<base>_init_<run id>`, created by the survey's command (its log `logs/init-db.log`) and migrated by the migrate role, and ends by dropping it once its background lists have printed their last line. Every command of the step runs with the database variable set to it on the command — its url the env file's with `<base>` swapped, built by `sed` inside the command, so no value reaches your context. Machine lock first; the suite and the build after it, in the background under it:
   - type-check, guards, suite, build — as stated; lint and test, one file — over the survey's small file; unit tests — that file and the guards;
   - migrate — generate, then apply;
   - worker — `--help`; its dry mode only as `timeout 10 <cmd>`: exit 124 is the dry mode alive for 10 s — the log line reads `exit 124`, the cell adds `— dry mode, 10 s`;
   - machine lock — `node -v` through it; impeccable — the launcher's `context`;
   - default — the branch itself (`main`), from `git symbolic-ref --short refs/remotes/origin/HEAD`; shots — its cell is `## Shots`; production shape, find-polluter — named, not run.

   A command is right when it does what its role says, whatever its exit: a red keeps the command, and its cell adds `— red on main: <what>`. A role the project lacks: `none — <why>`. Once the foreground list has printed its lines, steps 4 and 5 start; the background lists run beside them.

4. **Design** — a project with a UI; `mark design` before the first question, `mark design end` after the last — the interview is the one step with no artifact to time it by. The one step that asks the user: run it yourself, in this thread, with the question tool — impeccable's interviews need a person — while step 3's background lists and step 5's launch run. Load `impeccable` via the Skill tool and run it with cwd `<wt>`: every file it writes is under `<wt>`, never the start checkout. First `PRODUCT.md`: missing or stale → impeccable `init`; its interview writes `PRODUCT.md`, and may record the build path, `comp-led` or `code-led`, in `.impeccable/config.json`. Then exactly one of:
   - `DESIGN.md` exists → that is the design;
   - a design system in code → impeccable `document`: it records the system in `DESIGN.md` and `.impeccable/design.json`, the user reviews it;
   - otherwise → ask: choose the visual direction now or later. Now → impeccable `document` in seed mode (`--seed`): the user locks a direction on new-work's picker, and its directional `DESIGN.md` seed is written with the first surface's brief. The step is done when `DESIGN.md` exists; no surface is built, and a decision page it served is stopped by `serve-question --stop --key <its key>`. Later → the config records `direction: later`; the first run that builds UI keeps the code's current look, and a new direction stays the user's (`ui.md` → impeccable in a launch → Law).

5. **Shots** — a project with a UI; `mark shots`; none → `## Shots` is `- none — no UI`. The launch goes out in the background (`run_in_background`) as soon as step 3's foreground list has printed its lines, before step 4's first question; it waits for step 3's background lists only when a machine lock exists, or the survey's shots table names a lock or build directory the dev server shares with the build (`next dev` and `next build` on one `.next`) — a decision either way. Its report is saved when it arrives, between step 4's questions or after them.
   - **Launch** `fsloop-shots` (description `shots`), `Repo: <wt>`, the survey's shots and database tables, the machine lock step 3 proved, the capture defaults the project states, the run folder. It returns the recipe and its frames `shots/init-*.png`.
   - **Proof**: a `general-purpose` launch, `model: sonnet`, description `shots proof`, reading each frame of its FRAMES by path with Read. Its final message is one FRAME line per frame, bare, and nothing else — `FRAME: shots/init-<name>.png ok|bad — <what it shows>`, the frame named relative to the run folder; `bad` for a login form, an error, a loading state, a blank page, an empty list where data was promised, another page than its URL names.
   - **Retry**: `RESULT: partial`, or a proof line `bad` → `fsloop-shots` once more with the proof's report path, then a proof of all its frames — the gate reads the last proof only.
   - **Fallback**: `RESULT: none`, or still short of the frames the gate needs → `## Shots` is `- none — <which frame, why>`.

6. **Config.** `mark config`, once step 3's background lists have printed their last line and its database is dropped, the design step is done and the last proof is saved. Write `<wt>/.claude/fsloop/config.md` with Write, in this shape:

   ```
   # fsloop config

   Verified: <date> · <sha of origin/default, short> · run <run id>

   ## Commands

   | role | command |
   |---|---|
   | type-check | `npm run type-check` — red on main: 3 errors |

   ## Shared catalogs

   - `messages/*.json` — `test/i18n.test.ts`

   ## Roles

   | role | component |
   |---|---|
   | status dot | `components/status-dot.tsx` |

   ## Design

   - `PRODUCT.md` · `DESIGN.md` · system: `components/ui/`, `app/globals.css` · build: code-led

   ## Shots

   - raise: … · serve: … · login: … · shoot: … · stop: … · drop: …
   - refuses: … · defaults: …
   ```

   Commands has a row for every role of Project facts; Roles one for every role of `law/ui.md` → Roles, `—` where none plays it. A section with nothing to state — Shared catalogs, and Roles and Design without a UI — is `- none — <why>`. Design names what exists of `PRODUCT.md`, `DESIGN.md` and the system in code, `build:` as `.impeccable/config.json` records it, and `direction: later` when the user chose later. Shots carries fsloop-shots' templates as they are, its REFUSES and DEFAULTS as `refuses:` and `defaults:`. Then `## Accounts` and `## Deploy check` when the survey found them, then the old config's sections this template lacks, without their evidence: exits, seconds, logs, frames.

7. **Gate, land.** `mark land`, then `fsl.mjs gate <run folder> init` — red names what is missing: a role's row, a run role's log, a section, the frames the proof read `ok` (three; `init-public` and `init-dialog` when the recipe's login is `—`). Green → write both commit messages (SKILL.md → Commit message: `logs/init-commit.txt` with `Fsloop-Step: init`, `logs/init-merge-commit.txt` with `Fsloop-Step: merge`), then the land list, `logs/land.log`: `git -C <wt> add .claude/fsloop/config.md` and each file step 4 wrote, by path (`git -C <wt> status --porcelain -- PRODUCT.md DESIGN.md .impeccable` lists them); `git -C <wt> commit -F <run folder>/logs/init-commit.txt`; `git fetch origin`; `fsl/<run id>..origin/<default>` not empty → `git -C <wt> $MJ merge --no-commit origin/<default>`, `git -C <wt> commit -F <run folder>/logs/init-merge-commit.txt`; the push of SKILL.md step 7 → Push, label `push`, branch-only when `CLAUDE.md` forbids pushing to `<default>`. Then, pushed or not, what fsloop-shots may have left: `shot.mjs stop` when `logs/shots-server.pid` holds a pid, and always the drop of `<base>_shots_<run id>` by the survey's drop command. The push at `exit 0` → step 7's success (Removal of `<wt>` and `fsl/<run id>`, done only when the folder is gone) and Finish's pull of the start checkout, so the next run reads the config there; otherwise `fsl/<run id>` and `<wt>` stay. `gate integrate` and `gate finish` are not init's.

8. **Summary**, in the user's language. First the output of `node <start>/.claude/skills/fsloop/fsl.mjs timeline <run folder>`, verbatim — the steps and the spans; under it one line naming what a lane will pay before its first frame (the `worktree → first frame` span) and the slowest command. Then one line each: where the config landed — on `<default>`, or the branch to merge, or not pushed with `<wt>` kept; the reds on main, the roles the project lacks, the empty roles of the map, where the design lives, the frames embedded by absolute path, and what the user would add for what init could not prove (a seed, a test user, a dry mode).
