# Conformance: do runs do what fsloop says, and did applied changes work?

Inputs: `runs.json`, `funnel.json`, `speed.json` in the audit folder; each run's `run.json`, `launches.md`, `gates.jsonl`, `journal.md`; the transcripts at `launches[].transcript`.

1. **List the checkable rules.** Read `<fsloop>/SKILL.md`, `assess.md`, `~/.claude/agents/fsloop/fsloop-critic.md` and `fsloop-implement.md`. Take every rule the records can test: a number or ceiling (the 500k continuation limit, `K`, `N`), a must on launches (descriptions, `save` before acting, background mode), the orchestrator reading no code, one review per finding. Done: a list with the record that tests each.
2. **Measure each**, per run, oldest first: held in n of m cases. A rule broken across runs gets a cause: unenforced, too strict, or stale. A rule no gate checks gets a note on which gate could. Done: each rule has its count.
3. **Unused machinery.** Parameters, stages and report sections the runs never use, and sections written that nothing reads. Done: each has its use count.
4. **Applied changes.** For each file in `.claude/evolve/archive/applied/` targeting fsloop or its agents, find the commit, split the runs before and after it, and compare its metric: the one named in `## Cost`, or the nearest in `funnel.json` and `speed.json`. Say when too few runs fall on one side. A change that did not move its metric is a finding. Done: each file has a before and after, or the reason it has none.
5. **Waiting proposals.** For each file in `.claude/evolve/inbox/` about fsloop, does its evidence still hold at the current sha? Done: each is marked.

Report: the rules table with counts; broken rules with cause; unused machinery; applied changes with before and after; waiting proposals with whether each still stands.
