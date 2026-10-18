# fsloop — init

Read on `/fsloop init`. Init writes the project's config, `.claude/fsloop/config.md`: what a run acts on and cannot cheaply look up — each command by role, the shared catalogs and their guards, the role map, where the design lives, the shot recipe — every line proven by running it. Run it once per project, and again when the stack changes (SKILL.md → Project facts says when a run finds it stale).

**The config is short.** Every launch carries it in `common.md`, so each line is a fact a run acts on — a command, a path, a rule — one table row or one bullet. The proof stays in init's run folder: exits, seconds, logs and frames are evidence; a red a run must know is the one exception, a few words after its command.

Init is a run of its own, with one stage, `init`. SKILL.md holds: Run id, Run folder, Worktree, Launch records, Command lists (here each role is a list of one command with no exit tail: a red is recorded, not stopped on), Background commands, Models, Commit message. Its one tracked change is `config.md`; everything else it makes lives in the run folder, a throwaway database it drops, and `~/.fsloop`. An existing config is verified in place: a line a step below owns is replaced, every other line kept.

1. **Bootstrap.** Run id, worktree with its install and env files, `common.md`: its six head lines (`Mode: init`, `N: —`, `K: 1`), `## Goal` `init`, the existing config verbatim under `## Project`.

2. **Survey.** One `Explore` (`model: sonnet`, description `map`), `Repo: <wt>`, tables only, the existing config's answer first:
   - **commands** — per role of SKILL.md → Project facts, the candidates and where each is stated (`CLAUDE.md`, the rule files it names, package scripts, CI), and one small test file for `test, one file`;
   - **catalogs** — files several units would write (message catalogs, schema and migrations, registries a test enumerates, generated files, the manifest and lockfile), each with the guard test that goes red when it grows, read from the tests;
   - **roles** — per role of `<start>/.claude/skills/fsloop/law/ui.md` → Roles, the component that plays it, by path, or `—`;
   - **design** — `PRODUCT.md`, `DESIGN.md`, `.impeccable/`; the design system in code: a component library and its theme tokens (`components/ui/`, a CSS variables file, a Tailwind theme, a lint contract on the components), or none;
   - **shots** — the dev server (framework, command, port, the lock a second instance trips on, what it does on boot: migrations, crons, mail); screenshot tooling or browser tests and their doc; how development gets data (seed, fixtures, a database the project can create, a mock mode); how a user signs in; locale and theme switches;
   - **accounts and deploy** — an account kit, a production-read skill, what `CLAUDE.md` says a deploy adds.

3. **Commands.** Each role runs once in `<wt>`, its log `logs/init-<role>.log` (`<role>` with spaces and commas as `-`: `test-one-file`), the echo carrying the seconds: `s=$(date +%s); <cmd> > <log>.<n> 2>&1; e=$?; echo "<n> <role> — exit $e — $(( $(date +%s) - s )) s — $(grep -m1 -iE '<pass pattern>|fail|error' <log>.<n>)" | tee -a <log>.lines`. Machine lock first; the suite and the build after it, in the background under it. Any command that reaches a database gets `<db>_init_<run id>`, created at its start and dropped at its end in the same list, its variable set on the command — never the copied env's database:
   - install, type-check, lint, guards, suite, build — as stated; test, one file — the survey's small file; unit tests — that file and the guards;
   - migrate — generate, then apply into `<db>_init_<run id>`;
   - worker — `--help`; its dry mode only as `timeout 10 <cmd>` against `<db>_init_<run id>`, exit 124 recorded as `ran 10 s`;
   - machine lock — `node -v` through it; impeccable — the launcher's `context`;
   - default — `git symbolic-ref --short refs/remotes/origin/HEAD`; shots — `## Shots` (step 5); production shape, find-polluter — named, not run.

   A command is right when it does what its role says, whatever its exit: a red keeps the command, and the config adds `— red on main: <what>`. A role the project lacks: `— none`.

4. **Design** — a project with a UI. The one step that asks the user: run it yourself, in this thread, with the question tool — impeccable's interviews need a person. Load `impeccable` via the Skill tool.
   - `PRODUCT.md` missing or stale → impeccable `init`: its interview writes `PRODUCT.md`, and may record the build path, mockup first or code first.
   - `DESIGN.md` exists → that is the design.
   - No `DESIGN.md`, a design system in code → impeccable `document`: it records the system in `DESIGN.md`, the user reviews it.
   - No design system, the interface still being designed → ask: choose the visual direction now (impeccable's new-work direction picker, its `reference/new-work.md`), or later — the first run that builds UI then keeps the code's current look and leaves a new direction to the user (SKILL.md → Bar).

5. **Shots** — a project with a UI; none → `## Shots` is `- none — no UI`.
   - **Launch** `fsloop-shots` (description `shots`), `Repo: <wt>`, the survey's shots table, the capture defaults the project states, the run folder. It returns the recipe and three frames `shots/init-*.png`.
   - **Proof**: a `general-purpose` launch, `model: sonnet`, description `shots proof`, reading the three frames by path with Read, one line each, the frame named relative to the run folder — `FRAME: shots/init-<name>.png ok|bad — <what it shows>`; `bad` for a login form, an error, a loading state, a blank page, an empty list where data was promised, another page than its URL names.
   - **Retry**: a `bad` → `fsloop-shots` once more, with the proof's report path, then a proof of all three frames again — the gate reads the last proof only.
   - **Fallback**: still `bad` → `## Shots` is `- none — <which frame failed, why>`.

6. **Config.** Write `<wt>/.claude/fsloop/config.md` with Write, in this shape:

   ```
   # fsloop config

   Verified: <date> · <origin/<default> short sha> · run <run id>

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

   Commands has a row for every role of Project facts; Roles one for every role of `law/ui.md` → Roles, `—` where none plays it; Design is `- none — <why>` without a UI; Shots carries fsloop-shots' templates as they are. Then `## Accounts` and `## Deploy check` when the survey found them, then the old config's other sections.

7. **Gate, land.** `fsl.mjs gate <run folder> init` — red names what is missing: a role's row, a run role's log, a section, three frames the proof read `ok`. Green closes the run in `run.json`. Then one command list, `logs/land.log`: `git -C <wt> add .claude/fsloop/config.md`, `git commit -F` a message (SKILL.md → Commit message, `Fsloop-Step: init`); `git fetch origin`; `fsl/<run id>..origin/<default>` not empty → `git -C <wt> $MJ merge --no-commit origin/<default>`, `git commit --no-edit`; the push of SKILL.md step 7 → Push, branch-only when `CLAUDE.md` forbids pushing to `<default>`. Then, when `logs/shots-server.pid` holds a pid, `shot.mjs stop` and the drop of `<db>_shots_<run id>`; step 7's success (unlink, worktree removed); Finish's pull of the start checkout, so the next run reads the config there. `gate integrate` and `gate finish` are not init's.

8. **Summary**, in the user's language: the reds on main, the roles the project lacks, the empty roles of the map, where the design lives, the three frames embedded by absolute path, and what the user would add for what init could not prove (a seed, a test user, a dry mode) — one line each.
