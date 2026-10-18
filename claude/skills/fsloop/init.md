# fsloop — init

Read on `/fsloop init`. Init writes the project's config, `.claude/fsloop/config.md`: what a run must know and cannot cheaply look up — each command by role, the shared catalogs and their guards, the role map, where the design lives, the shot recipe — every line proven by running it. Run it once per project, and again when the stack changes.

**The config is short.** Every run reads it and `common.md` carries it verbatim into every launch, so each line is a fact a run acts on — a command, a path, a rule — in a table row or one bullet. The proof stays in init's run folder: exits, seconds, logs and frames are evidence, not config; a red a run must know (type-check red on main) is the one exception, a few words after its command.

Init is a run of its own: SKILL.md's Worktree, Command lists, Background commands, Launch records and Models hold, with one stage, `init`. It writes no product code; what the project lacks for a role (a seed, a test user, a dry mode) goes to the summary. An existing config is verified in place: a line a step below owns is replaced, every other line kept.

1. **Bootstrap.** Run id, worktree with its install and env files, `common.md`: its six head lines (`Mode: init`, `N: —`, `K: 1`), `## Goal` `init`, the existing config verbatim under `## Project`.

2. **Survey.** One `Explore` (`model: sonnet`, description `map`), `Repo: <wt>`, tables only, the existing config's answer first:
   - **commands** — per role of SKILL.md → Project facts, the candidates and where each is stated (`CLAUDE.md`, the rule files it names, package scripts, CI);
   - **catalogs** — files several units would write (message catalogs, schema and migrations, registries a test enumerates, generated files, the manifest and lockfile), each with the guard test that goes red when it grows, read from the tests;
   - **roles** — per role of `law/ui.md` → Roles, the component that plays it, by path, or `—`;
   - **design** — `PRODUCT.md`, `DESIGN.md`, `.impeccable/`; the design system in code: a component library and its theme tokens (`components/ui/`, a CSS variables file, a Tailwind theme, a lint contract on the components), or none;
   - **shots** — the dev server (framework, command, port, the lock a second instance trips on); screenshot tooling or browser tests and their doc; how development gets data (seed, fixtures, a throwaway database, a mock mode); how a user signs in; locale and theme switches;
   - **accounts and deploy** — an account kit, a production-read skill, what `CLAUDE.md` says a deploy adds.

3. **Commands.** Each role with a candidate runs once in `<wt>`, its own command list, log `logs/init-<role>.log` (`<role>` with its spaces and commas as `-`: `test-one-file`); the suite and the build in the background under the machine lock:
   - install, type-check, lint, guards, suite, build — as stated; test, one file — one small test file; unit tests — that file and the guards;
   - migrate — the generate command, an apply only into a throwaway database the project creates and drops;
   - worker — its dry mode for a few seconds, or `--help`; machine lock — `node -v` through it; impeccable — the launcher's `context`;
   - production shape, find-polluter — named, not run.

   A command is right when it does what its role says, whatever its exit: a red stays the command, and the config says `— red on main: <what>`. A role the project lacks: `— none`.

4. **Design** — a project with a UI. The one step where init asks the user: run it yourself, in this thread, with the question tool — impeccable's interviews need a person.
   - Load `impeccable` via the Skill tool. `PRODUCT.md` missing or stale → impeccable `init` (its interview writes `PRODUCT.md` and may record the build path, mockup first or code first).
   - `DESIGN.md` exists → it is the design; nothing to ask.
   - No `DESIGN.md`, a design system in code (the survey's design table) → impeccable `document`: it records the system in `DESIGN.md`, the user reviews it.
   - No design system — the interface is still being designed → ask the user: choose the visual direction now (impeccable's new-work direction picker, `reference/new-work.md`), or later — the first run that builds UI then works inside the code's current look and leaves a new direction to the user (SKILL.md → Bar).

5. **Shots** — a project with a UI. `fsloop-shots` (description `shots`), `Repo: <wt>`, the survey's shots table, the capture defaults the project states, the run folder's `shots/` and `logs/`; it returns the recipe and three frames `shots/init-*.png`. Then the proof: a `general-purpose` launch, `model: sonnet`, description `shots proof`, reading the frames by path with Read, one line each — `FRAME: shots/init-<name>.png ok|bad — <what it shows>`, `bad` for a login form, an error, a loading state, a blank page, an empty list where data was promised, another page than the URL names. A `bad` frame goes back to `fsloop-shots` once with the proof's lines; still bad → `## Shots` is `none — <why>`.

6. **Config.** Write `<wt>/.claude/fsloop/config.md` with Write, in this shape and no longer than it needs:

   ```
   # fsloop config

   Verified: <date> · <origin/<default> short sha> · run <run id>

   ## Commands
   | role | command |                    ← every role of Project facts; `— none`; `… — red on main: <what>`
   ## Shared catalogs
   - `<file>` — `<guard test>` | unguarded
   ## Roles
   | role | component |                  ← law/ui.md → Roles; — where none plays it
   ## Design
   - `PRODUCT.md` · `DESIGN.md` | none — <why> · system: `<paths>` · build: code-led | comp-led
   ## Shots
   - raise · serve · login · shoot · stop — one command each, from fsloop-shots
   - refuses: <when>; defaults: <locale, theme, width>
   ```

   then `## Accounts` and `## Deploy check` when the survey found them, then the old config's other sections. A login's credentials live in the environment or `.spike/`, its session in `.claude/fsloop/auth.json`, outside git; the config names them, never holds them.

7. **Gate, land.** `fsl.mjs gate <run folder> init` — red names what is missing: a role's row, a role's run log, a section, three frames the proof read `ok`. Green → one command list commits the config on `fsl/<run id>` (`Fsloop-Step: init`, SKILL.md → Commit message), then SKILL.md step 7's merge and push; the shot server's teardown; the worktree removed as step 7's success says.

8. **Summary**, in the user's language: the reds on main, the roles the project lacks, the empty roles of the map, where the design lives, the three frames embedded by absolute path, and what the user would add for what init could not prove — one line each.
