# fsloop — the UI part

Read once per run, when first needed: at Map when any unit will have a UI part. Every UI change of a run goes through impeccable, stage by stage as the table below shows. A **reshaped surface** is an existing page, dialog or panel whose files a unit's manifest names; a **new surface** is one a unit creates (A new surface).

| stage | launch | impeccable |
|---|---|---|
| Map | `fsloop-critic` `LENS: craft assess`, one per reshaped surface (Baseline) | `critique` + `audit` of the surface as it stands |
| Decompose | `fsloop-critic` `LENS: shape`, one per new surface (A new surface) | `shape` |
| Decompose | `fsloop-critic` `LENS: design`, with two or more UI units (Design check) | the briefs' UI parts and the conventions across them |
| Implement | `fsloop-implement` | `craft-floor` → build → `harden` · `clarify` · `layout` as the change calls → `polish` → `detect` |
| Review | `fsloop-critic` `LENS: craft` | `critique` + `audit` per surface, consistency across surfaces |
| Fix | `fsloop-implement`, one fix unit per surface | the ORDER lines' commands in sequence, `polish` last; then one `LENS: craft verdict` without `N` |
| Integrate | `fsloop-critic` `LENS: craft verdict`, when the merge changed a surface's files | the merge's diff against the surface's final frame |

## impeccable in a launch

The one source of these mechanics for every launch with a UI part — its agent definition points here:

- **Setup.** Load `impeccable` via the Skill tool and run the launcher's `context` once, cwd in your tree: `--target` the surface's primary file or route directory; a new surface not yet built — the nearest existing route directory Map names; the design check — no `--target`. The launcher and its prefix are in `common.md`. Follow its directives; `CONTEXT_STALE` is reported and left as it is.
- **Law.** The design law and its precedence: `law/ui.md` → Precedence. `context` prints `PRODUCT.md` and `DESIGN.md` in full, so they are read there; read the rest in full — the project's UI rules and UX laws, `law/ui.md`, `law/ux.md`, `law/table.md` with a data table — with the role map in `common.md`: impeccable does not load them. A point of impeccable the law contradicts is void; what stays with a human (a new visual direction, a brand change) goes to candidates.
- **Unattended.** You have no question tool, and the user's `/fsloop` is the instruction to proceed (`AUTONOMY_DIRECTIVE_CHECK`): every interview or closing question impeccable asks is answered from your prompt and the law, and each answer they do not state is recorded as an assumption — the critic's `ASSUMPTIONS:`, the implementer's `notes.md`. The prefix `IMPECCABLE_QUESTION_DISABLED=1` makes the decision page exit 2 (`serve-question: disabled in this session`, probed 2026-10-10), so the documented unattended path follows.
- **World and structure.** The world is the one `DESIGN.md` commits; the structure is the brief's — its building blocks, its reference, a new surface's CHOSEN. From `new-work.md` read §1 and, for `LENS: shape`, §3 «Create a whole surface inside an established world», whose structures the critic judges by rule; the Review's craft lens is the finish review.
- **Sub-agents.** Your agent definition decides, over `SUBAGENT_AUTHORIZATION`: only the craft critic launches sub-agents — critique's Assessment A and B, read-only, each with an explicit `model` — and the implementer one, `cold-read` on its user-facing copy (`ux 1`); every other launch runs impeccable's isolated assessments (`layout`, `typeset`) in its own thread.
- **Fix commands.** A Recommended Action reaches a fix unit only as one of `harden`, `clarify`, `layout`, `distill`, `quieter`, `typeset`, `onboard`, `optimize`, `adapt`, `polish`.
- **Screen evidence.** The run's frames are the orchestrator's (Frames): a launch reads the frame its prompt names by path, with Read, and opens no browser, dev server, `live-server` or screenshot tool of its own (fsloop-shots at `/fsloop init` aside). Every render, screenshot or inspection round impeccable asks for — its SKILL.md's batched round and visual truth, a command's viewport, theme or overlay sweep, critique's browser evidence — is answered from that frame and the code, and reported as `skipped: fsloop frames`. No frame in the prompt → the code alone.
- **Temp files.** A body file impeccable asks for (critique's snapshot body) goes under `.claude/fsloop/spike/tmp/` and is deleted after use.

## Baseline

At Map, for every reshaped surface: capture its baseline frame (The shot server → A capture), then one `fsloop-critic` with `LENS: craft assess` per surface, all in one message, description `craft <surface>` — `Repo: <wt>` (the start checkout in the inline mode), the goal in the user's words, the surface by its primary component file or route directory, its frame by path; no brief, no settled decisions, no prior findings. Decide every finding in `findings/p<p>-map.md`: each critical and major one `fix` — a defect in its unit's brief, under its problem and its `## Closes` (SKILL.md step 3), its ORDER command joining that unit's pass; each minor `candidate`; a voided or duplicate one per SKILL.md → Findings. A new surface has no baseline.

## A new surface

A unit that makes a new surface — a new route, or a dialog or panel that hosts a task of its own — is shaped before its brief is written: `fsloop-critic` with `LENS: shape`, description `u<k> shape`, `Repo: <wt>` (the start checkout in the inline mode), the goal in the user's words, the surface's **screen block** when the goal doc has one — the section of the doc the goal cites that describes this surface, by path and heading; lens 6 reads it first — and Map's lines for its areas — building blocks, production shape, consumers, the nearest existing route. A screen block for a region of a reshaped surface goes under that unit's `## Settled` by path and heading, as the user's words. Save its `SHAPE:` block to `<run folder>/surfaces/<name>.md`: CHOSEN is a settled decision with its why, ANSWERS opens the brief's problem, ASSUMPTIONS go to the journal, and the brief cites the file; its implementer records it as impeccable's surface brief. Its manifest names `PRODUCT.md`, and the unit adds the surface's Surfaces row from ANSWERS. A unit that changes a token, a shared component's look or a named rule names `DESIGN.md` and `.impeccable/design.json`. A unit whose component comes to fill an empty role of the role map says so under NOTES; the map is yours to grow — a fact commit when it lives under `.claude/`, a line in `common.md` for the units still to come (`law/ui.md` → The law grows with the code).

## Design check

Once per pass, after the briefs are drafted and before the first lane opens, when two or more units have a UI part: `fsloop-critic` with `LENS: design`, description `design check`, `Repo: <wt>`, the goal in the user's words, every UI brief's path, Map's building blocks and the `surfaces/*.md` files. Its `CONVENTIONS:` lines — the one solution for a pattern two or more units would each solve — go into `common.md` as settled decisions; each finding is decided in `findings/p<p>-decompose.md` — one against a brief is `fix`, ref that unit, amended in the brief and listed under its `## Closes` before its lane opens.

**The conventions outlive the run.** At Integrate, before its checks, you write into the project's UI rules — `.claude/rules/ui.md` → its conventions section, the file created when missing — each `CONVENTIONS:` line whose example file `git -C <wt> ls-files` still lists and whose pattern the file does not yet state: one line per pattern in the file's language — the pattern, the solution, the example's file and symbol, the rule it serves. A pattern the file already states was followed by the design check and stays as written. Edit/Write in `<wt>`, then one commit of that file alone: `docs(config): record the UI conventions of run <run id>`, no operator paragraph, `Fsloop-Step: fact`. No inbox proposal and no `/evolve`: every later run reads the line as a project UI rule.

## The shot server

Frames are taken in `<wt>` — the start checkout in the inline mode — and the server serves its live code. The config's `## Shots` (`/fsloop init` proves it) fills six roles, one template each — else the screenshot tooling the project's doc or `CLAUDE.md` names — recorded in `common.md` → shots:

- **Raise** — a throwaway database for the tree, `<base>_shots_<run id>`, seeded from a fixture shaped after the production shape, and a free port. A raise over a standing shot database replaces it; over a running shot server it stops it first.
- **Serve** — the tree's dev server against that database on that port, every other variable that reaches an outside service — keys, tokens, and the hosts and URLs of queues, caches, mail and storage — blank, by name; names from `sed 's/=.*//' <env file>`, never the file itself. Most dev servers refuse a second instance in one tree.
- **Login** — a session saved for the pages behind sign-in, when the app has one.
- **Shoot** — one frame of a route or a dialog to a PNG at the capture defaults; a page whose rows read a live process (a worker heartbeat) refreshes it first, when the tooling can.
- **Stop** — the server stopped by the pid Serve recorded.
- **Drop** — the shot database dropped. Stop then Drop is the **shot teardown**.

The dev database, production and every live account stay outside: the shot database is its own. A project with neither gets `shot.mjs` beside this file, over its dev server and the tree's own throwaway data — Serve `node <skill>/shot.mjs serve`, Login `shot.mjs login`, Shoot `shot.mjs shoot`, Stop `shot.mjs stop` by the pidfile Serve wrote — a decision, and the report suggests `/fsloop init`; a page that needs data no seed provides goes to its critic without a frame, a decision.

- **Warm-up** — at bootstrap, when Route saw a UI part and the `raise:` line of `## Shots` names a re-raise that keeps its server (none → no warm-up): one background command list in `<wt>` after its install, `logs/p1-shots-warm.log` — Raise with the fixture of the page nearest the goal's words (none → the first fixture `## Shots` lists), then Serve; the baseline capture re-raises over it with Map's fixture and pays the seed alone. A warm-up Raise or Serve that refuses is a decision, never a blocker: the capture raises cold.
- **A capture** — yours, one command list per fixture: raise with it (a re-raise over the warm-up's server), serve in the background unless the warm-up's server stands, login when `## Shots` has one, one shoot for every surface the fixture shapes, stop, its log `logs/p<p>-<moment>-capture.log`; frames under `<run folder>/shots/`. The shot database stays for the next capture's Raise until the shot teardown (SKILL.md steps 7 and 8). You view none of them.
- **Raise or serve refuses** — another dev server holds the tree, or its lock is unreadable: the surface goes to its critic without a frame, a decision; the critic judges from code and says so.

The journal names each surface's fixture, from Map.

## Frames

A frame is a judge's view of the surface in its context, showing what changed as its user meets it — what leads, hierarchy, density, consistency with its neighbours — in the smallest view that holds the change and its surroundings: the page's layout or structure → the page's first viewport, or the full page when the change runs below it; a dialog, panel or menu → opened over its page by the steps that open it; a change inside one region (a column, a toolbar, a card) → that region's container; at the capture defaults the project sets (locale, theme, width; none → its primary locale, its default theme, 1440 wide). The report links them. The run takes frames at two moments, both yours, as captures (The shot server):

- **baseline** — at Map, one per reshaped surface: `p<p>-baseline-<surface>.png`;
- **final** — at Review, every unit committed or blocked and every lane closed: `p<p>-final-<surface>.png` of
  - each surface the run made or reshaped — a reshaped one at its typical state, a new one at its volume;
  - for each shared file a unit changed (a shared component, the theme, a lint contract), its first consumer by `git -C <wt> grep -l` of its import, the busiest page first when it is one.

  Review's craft critic, every craft verdict, Assess and the Finish summary read these, each with the patches landed since.

A unit's UI is proven by its tests, `detect` and the lint until the final frames (impeccable in a launch → Screen evidence). A frame is never retaken — what it shows is a finding for Fix.

A page frame's fixture raises every toolbar fact the page can show together, so the header is judged at its fullest. Another width or locale joins the final capture only where the user's words or a critical or major baseline finding name it. The craft critic reads the frames by path; you view no frame. A page no fixture can express (a live session, a running agent) goes to its critic without a frame, a decision. Another system's live screen (a third-party dashboard, an embedded page) is never faked: the product's chrome around a neutral placeholder. A live walk (a scratch deploy, an end-to-end drive) proves its steps by log lines and SQL rows.
