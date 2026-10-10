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
| Integrate | `fsloop-critic` `LENS: craft verdict`, when the merge changed a surface's files | the merge frame against the surface's last frame |

## impeccable in a launch

The one source of these mechanics for every launch with a UI part — its agent definition points here:

- **Setup.** Load `impeccable` via the Skill tool and run the launcher's `context` once, cwd in your tree: `--target` the surface's primary file or route directory; a new surface not yet built — the nearest existing route directory Map names; the design check — no `--target`. The launcher and its prefix are in `common.md`. Follow its directives; `CONTEXT_STALE` is reported and left as it is.
- **Law.** The design law is, in order of precedence, `PRODUCT.md`, `DESIGN.md`, then the UI rules and UX laws the project keeps (the files `CLAUDE.md` names, as `common.md` quotes them). `context` prints the first two in full, so they are read there. Read the rest in full: impeccable does not load them. A point of impeccable the law contradicts is void; what stays with a human (a new visual direction, a brand change) is whatever the project's UI rules reserve, and goes to candidates.
- **Unattended.** You have no question tool, and the user's `/fsloop` is the instruction to proceed (`AUTONOMY_DIRECTIVE_CHECK`): every interview or closing question impeccable asks is answered from your prompt and the law, and each answer they do not state goes into your report as an assumption — the critic's `ASSUMPTIONS:`, the implementer's NOTES. The prefix `IMPECCABLE_QUESTION_DISABLED=1` makes the decision page exit 2 (`serve-question: disabled in this session`, probed 2026-10-10), so the documented unattended path follows.
- **World and structure.** The world is the one `DESIGN.md` commits; the structure is the brief's — its building blocks, its reference, a new surface's CHOSEN. From `new-work.md` read §1 and, for `LENS: shape`, §3 «Create a whole surface inside an established world», whose structures the critic judges by rule; the Review's craft lens is the finish review.
- **Sub-agents.** Your agent definition decides, over `SUBAGENT_AUTHORIZATION`: only the craft critic launches sub-agents — critique's Assessment A and B, read-only, each with an explicit `model`; every other launch runs impeccable's isolated assessments (`layout`, `typeset`) in its own thread.
- **Fix commands.** A Recommended Action reaches a fix unit only as one of `harden`, `clarify`, `layout`, `distill`, `quieter`, `typeset`, `onboard`, `optimize`, `adapt`, `polish`.
- **Temp files.** A body file impeccable asks for (critique's snapshot body) goes under `.spike/tmp/` and is deleted after use.

## Baseline

At Map, for every reshaped surface: its baseline frame, then one `fsloop-critic` with `LENS: craft assess` per surface, all in one message, description `baseline craft <surface>` — `Repo: <wt>` (the start checkout in the inline mode), the goal in the user's words, the surface by its primary component file or route directory, its frame by path; no brief, no settled decisions, no prior findings. Save its final block to `<run folder>/craft/baseline-<surface>.md`. Each critical and major finding is a defect the surface's brief quotes as a done-criterion, and its ORDER command joins that unit's pass. A new surface has no baseline. Map is done when every reshaped surface has one.

## A new surface

A unit that makes a new surface — a new route, or a dialog or panel that hosts a task of its own — is shaped before its brief is written: `fsloop-critic` with `LENS: shape`, description `u<k> shape`, `Repo: <wt>` (the start checkout in the inline mode), the goal in the user's words and Map's lines for its areas — building blocks, production shape, consumers, the nearest existing route. Save its `SHAPE:` block to `<run folder>/surface-<name>.md`: CHOSEN is a settled decision with its why, ANSWERS opens the brief's problem, ASSUMPTIONS go to the journal, and the brief cites the file; its implementer records it as impeccable's surface brief. Its manifest names `PRODUCT.md`, and the unit adds the surface's Surfaces row from ANSWERS. A unit that changes a token, a shared component's look or a named rule names `DESIGN.md` and `.impeccable/design.json`.

## Design check

Once per pass, after the briefs are drafted and before the first lane opens, when two or more units have a UI part: `fsloop-critic` with `LENS: design`, description `design check`, `Repo: <wt>`, the goal in the user's words, every UI brief's path, Map's building blocks and the `surface-*.md` files. Its `CONVENTIONS:` lines — the one solution for a pattern two or more units would each solve — go into `common.md` as settled decisions; each finding against a brief is fixed in that brief before its lane opens, a decision.

## The shot server

Frames are taken in the tree the work is in — the lane; `<wt>` for a unit without a lane; the start checkout in the inline mode — and the server serves the tree's live code. The project's screenshot tooling (its doc or `CLAUDE.md` names it) fills four roles, recorded in `common.md` → shots:

- **Raise** — a throwaway database for the tree, seeded from a fixture shaped after the production shape, and a free port; yours, plumbing, before the launch that shoots. The port goes to `units.md` (the inline mode and `<wt>`: the journal). A raise over a running shot server stops it first.
- **Serve** — the tree's dev server against that database on that port, every other external key blanked: the launch that shoots starts it, takes its frames, and stops it before its report. One launch serves a tree at a time — most dev servers refuse a second instance in one tree — so two launches never shoot one tree at once.
- **Shoot** — one frame of a route or a dialog to a PNG at the capture defaults.
- **Teardown** — the server stopped and, at lane close and Finish, the shot database dropped.

The dev database, production and every live account stay outside: the shot database is its own. A project with no such tooling gets the minimum: Serve is its dev-server command on a free port over the tree's own throwaway data, Shoot is `npx playwright screenshot --viewport-size=1440,900 <url> <png>` (an installed Playwright, a decision), and a page that needs data no seed provides goes to its critic without a frame, a decision.

- **Frames you take** — the baseline and merge frames, as one command list in `<wt>` per fixture Map names: raise with it, serve in the background, one shoot for each surface it shapes, teardown; frames under `<run folder>/shots/`. You view none of them.
- **Raise or serve refuses** — another dev server holds the tree, or its lock is unreadable: the surface goes to its critic without a frame, a decision; the critic judges from code and says so.

Every brief with a UI part names the tree, the fixture, the shot commands and `Shots: <run folder>/shots` as an absolute path.

## Frames

A frame is a review's view of the surface in its context, scoped to the change in its context — a page, a dialog over its page, or a region with its neighbours — at the capture defaults the project sets (locale, theme, width; none → its primary locale, its default theme, 1440 wide), named `<stage>-<surface>.png` (`baseline-brands.png`, `u2-brands.png`, `f1-brands.png`, `merge-brands.png`); a retake adds `-r` (`u2-brands-r.png`). The report links them. The run takes exactly these:

- **baseline** — one per reshaped surface, by you, at Map;
- **surface** — one per surface a unit reshaped or made, by its implementer after its last edit, at the brief's fixture: a reshaped surface at its typical state, a new one at its volume; viewed once, and a defect it shows is fixed and the frame retaken once;
- **regression** — one, by the implementer of a unit whose manifest changes a shared file (a shared component, the theme, a lint contract): its first consumer from Map's list — or, for a shared file only a fix unit edits, `git -C <wt> grep -l` of its import, run by you as plumbing — the busiest page first when it is one;
- **fix** — one per surface a fix unit changed, by it after its last edit;
- **merge** — one per reshaped or new surface whose files the Integrate merge changed, by you.

Another width or locale is taken only where a done-criterion names it — and a done-criterion names it only from the user's words or a critical or major finding. Verify counts the stage's files (`ls <run folder>/shots/<stage>-*.png`): the brief's surfaces plus its regression frame, each with at most one `-r`; more is a spend defect, recorded. The craft critic reads the frames by path; you view no frame. A page no fixture can express (a live session, a running agent) goes to its critic without a frame, a decision. Another system's live screen (a third-party dashboard, an embedded page) is never faked: the product's chrome around a neutral placeholder. A live walk (a scratch deploy, an end-to-end drive) proves its steps by log lines and SQL rows.
