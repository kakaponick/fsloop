# Findings: what does the critics' filter drop, and what in it matters?

Inputs in the audit folder: `funnel.json`, `unlabeled.json` (items no label covers yet), `recheck.json` (labeled items, labels hidden). An item is a `line` under a critic's `CANDIDATES`, or a `finding` decided `candidate`.

Classes, by consequence, whether or not a rule is cited:
- `defect`: wrong behaviour, data loss, security, money, a user unable to do a task, a production failure;
- `small`: real, low consequence;
- `imp+`: a design, structure or UX change that would alter how a user works or how the code can evolve;
- `imp`: a routine improvement;
- `product`: a question only the owner can decide;
- `noise`: taste, a restatement, not actionable;
- `unclear`: cannot tell from the item and the code.

1. **Label blind.** Read every item of `unlabeled.json` in full and write `{key, class}` to `<audit folder>/labels.json` as you go; the same for `recheck.json` into `<audit folder>/recheck-labels.json`. Leave `.claude/fsloop/audit/ledger.jsonl`, `.claude/fsloop/audit/groups.md` and any `classes.md` closed until both are written. A first label comes from the item alone; steps 2 and 4 correct it. Done: both files hold every key.
2. **Reliability.** `node <skill>/audit.mjs label <audit folder>/recheck-labels.json --compare` prints agreement, kappa and each disagreement touching `defect`. Reopen each of those against the code and say which label stands. A correction to an existing label goes into `labels.json` as `{key, class}`. Done: each disagreement has a verdict.
3. **Group by root cause.** Open `groups.md`. Put each label under an existing group or add one, setting `group` in `labels.json`. New and changed group blocks go to `<audit folder>/groups-update.md` in the shape below; `audit.mjs work` builds the findings file from these fields. Search `CLAUDE.md`, `.claude/rules/` and `<fsloop>/law/` for the rule. Done: every label has a group.

   ```
   ### <id>
   - класс: <class> · тяжесть: <критическая|высокая|средняя|низкая> · статус: <stands|fixed|wrong|unconfirmed|open> · коммит: <sha, when fixed>
   - что: what breaks, under what condition, what is seen
   - где: repo-relative paths with lines, comma-separated
   - должно: the correct behaviour, for a defect
   - вопрос: the choice only the owner can make, when its fix turns on one
   - кто поднял: runs and ledger keys
   - правило: the written rule, quoted, or нет
   - решение другим путём: a finding of the same or a later run with its decision, or нет
   ```
4. **Check in code.** Every new `defect` and `imp+` group at the sha from `runs.json` (`git show <sha>:<path>`), and every `defect` group already marked `stands`, since it may have been fixed. Trace far enough to name the trigger and what is seen. A group that fails moves class: add every ledger key of that group to `labels.json` with the new class and its `group`. Done: each such group has a status.

The orchestrator merges `labels.json` and `groups-update.md` into the store after it has verified your report.

Report: the funnel per run, severity against decision; class counts with denominators per run and per lens, computed from the ledger plus your `labels.json`; all standing defects in a table; `imp+` groups and `product` questions as lists; of the standing defects, how many a rule covers, which route dropped each, and which lenses produced them; noise share; agreement and kappa. Also note a rule that looks stretched to justify a finding, when you run across one.
