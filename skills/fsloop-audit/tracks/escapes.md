# Escapes: which bugs did no critic raise, and would a rule have caught them?

Input: `escapes.json` in the audit folder. `laterFixes`: `fix` commits landed after a run that touch files it changed, with the overlap; a row is a lead, not a verdict. `baseline`: critical and major findings a later run's Map raised on code already there.

1. **Attribute.** For each lead, read the commit and `git log -L` or `git blame` the fixed lines: which run wrote the bug. Drop refactors, product changes an owner asked for, tooling, and fixes to code the same commit's run wrote. For a `baseline` finding, name the run that wrote that code. Done: every lead is attributed or dropped with its reason.
2. **Was it seen?** Search that run's `reports/` and `findings/` for the bug: raised and fixed badly, raised and filtered, or never raised. Check whether a verdict scored the area `resolved`, and whether the critic's prompt carried that file. Done: each bug has its route.
3. **Split what was never raised.** A written rule in `CLAUDE.md`, `.claude/rules/` or `<fsloop>/law/` covers it, so the review missed it; or no rule covers it, so a critic had little reason to raise it. Could a critic have seen it from the diff at all, or does it need the environment or live data? Done: each one is on one side, with the rule quoted when one covers it.

A bug that still stands at the sha from `runs.json` goes to `<audit folder>/groups-update.md` as a block in the shape of [findings.md](findings.md), with `кто поднял: escapes`, so the findings file carries it.

Bias to state in the report: critics are told to cite a rule, so a bug outside the rules is under-represented here.

Report: the bugs per class, with severity, `file:line`, the fixing commit, the run that wrote it, and the route; counts with denominators; the rule split; which lens should have caught each.
